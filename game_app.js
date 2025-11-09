(function (global) {
  "use strict";

  const HOLD_DURATION_MS = 700;
  const PATTERN_REPEATS_X = 3;
  const PATTERN_REPEATS_Y = 6;
  const BACKGROUND_COLOR = 20;

  const GameConfig = global.GameConfig;
  const GameService = global.GameService;

  if (!GameConfig || !GameService) {
    throw new Error("GameConfig and GameService must be loaded before game_app.js");
  }

  const APP_VERSION = "v2.0.0";

  const cloneDeep = typeof structuredClone === "function"
    ? structuredClone
    : (value) => JSON.parse(JSON.stringify(value));

  const state = {
    runActive: false,
    level: null,
    runState: null,
    currentItem: null,
    currentGenome: null,
    baseGenome: null,
    showGuides: false,
    holdStates: new Map(),
    orbButtons: new Map(),
    disabledOrbs: new Set(),
    availableHints: { 1: true, 2: true, 3: true, 4: true },
    timers: {
      lastFrame: null,
      itemStart: null,
    },
  };

  const elements = {};

  const overlaysLibrary = createOverlayLibrary();

  const service = new GameService({
    selectItems: sampleItemsForLevel,
    renderers: {
      hint1: (itemId) => activateHintOverlay(1, itemId),
      hint2: (itemId) => activateHintOverlay(2, itemId),
      hint3: (itemId) => activateHintOverlay(3, itemId),
      hint4: (itemId) => activateHintOverlay(4, itemId),
    },
    persistence: global.GamePersistence,
    runConfig: GameConfig.cloneRunConfig(),
  });

  function createOverlayLibrary() {
    const rotate = (order, extra = "") => ({ textCue: `Watch for ${order}-fold rotation centres.${extra ? " " + extra : ""}` });
    return {
      "632": { ...rotate("six"), rotations: [{}], mirrors: [{}] },
      "*632": { ...rotate("six"), rotations: [{}], mirrors: [{}, {}], textCue: "Mirrors slice the hexagonal lattice every 30°." },
      "442": { ...rotate("four"), rotations: [{}], mirrors: [{}, {}], textCue: "Quarter-turn centres sit on the square grid." },
      "*442": { rotations: [{}], mirrors: [{}, {}], textCue: "Both axial and diagonal mirrors accompany 4-fold centres." },
      "4*2": { rotations: [{}], mirrors: [{}], textCue: "Glide mirrors run diagonally between 4-fold centres." },
      "333": { ...rotate("three"), rotations: [{}], mirrors: [], textCue: "Triangles repeat with only 120° rotations." },
      "*333": { rotations: [{}], mirrors: [{}, {}, {}], textCue: "Mirrors radiate every 60° around triangular hubs." },
      "3*3": { rotations: [{}], mirrors: [{}, {}, {}], textCue: "Alternate mirrors pair with 3-fold rotations." },
      "2222": { rotations: [{}], mirrors: [], textCue: "Pairs of 180° turns tile the plane." },
      "*2222": { rotations: [{}], mirrors: [{}, {}], textCue: "Mirrors cross at right angles with 2-fold centres between." },
      "2*22": { rotations: [{}], mirrors: [{}, {}], textCue: "Diagonal mirrors with 2-fold rotations on the axes." },
      "22*": { rotations: [{}], mirrors: [{}, {}], textCue: "Vertical mirrors combine with horizontal glides." },
      "22×": { rotations: [{}], mirrors: [], textCue: "Only glides—no mirrors—shift the brickwork rows." },
      "**": { rotations: [], mirrors: [{}, {}], textCue: "Parallel mirrors repeat without rotations." },
      "*×": { rotations: [], mirrors: [{}, {}], textCue: "Vertical mirrors pair with horizontal glides between rows." },
      "××": { rotations: [], mirrors: [], textCue: "Perpendicular glides create staggered motifs." },
      "o": { rotations: [], mirrors: [], textCue: "Pure translation—no mirrors, no rotations." },
    };
  }

  const orbMapping = {
    "22×": "22x",
    "*×": "*x",
    "××": "xx",
  };

  const inverseOrbMapping = Object.entries(orbMapping).reduce((acc, [orb, group]) => {
    acc[group] = orb;
    return acc;
  }, {});

  function orbToGroup(orb) {
    return orbMapping[orb] || orb;
  }

  function groupToOrb(group) {
    return inverseOrbMapping[group] || group;
  }

  function ensureOrb(orb) {
    return GameConfig.ensureOrbifold(orb);
  }

  function formatOrbLabel(orb) {
    return ensureOrb(orb).replace(/x/g, "×");
  }

  function sampleItemsForLevel(level) {
    const allowed = level.allowed.map(ensureOrb);
    const items = [];
    let cursor = 0;
    let counter = 0;
    while (items.length < level.poolSize) {
      const orb = allowed[cursor % allowed.length];
      items.push(createPatternItem(orb, level.id, counter++));
      cursor++;
    }
    return items;
  }

  function createPatternItem(orb, levelId, index) {
    const overlaySpec = overlaysLibrary[orb] || { rotations: [], mirrors: [], textCue: `Classify the ${orb} signature.` };
    return {
      id: `${levelId}-${orb}-${Date.now()}-${index}`,
      imageUrl: `orb://${orb}`,
      truth: orb,
      overlays: {
        rotations: overlaySpec.rotations || [],
        mirrors: overlaySpec.mirrors || [],
        textCue: overlaySpec.textCue || `Identify the ${orb} symmetry signature.`,
      },
      tags: [levelId, "auto"],
      genome: createGenomeForOrb(orb),
    };
  }

  function createGenomeForOrb(orb) {
    const group = orbToGroup(orb);
    let genome = global.withMeta ? global.withMeta(global.randomGenome()) : global.randomGenome();
    genome.group = group;
    genome.motifScale = genome.motifScale || 80;
    genome.seedMotifScale = genome.motifScale;
    return genome;
  }

  function init() {
    cacheDom();
    renderOrbifoldGrid();
    bindControls();
    refreshLevelSelect();
    updateHudIdle();
    attachServiceEvents();
    startFrameLoop();
    exposeVersion();
    global.GameTests?.runGameTests?.();
  }

  function cacheDom() {
    elements.appVersion = document.getElementById("app-version");
    elements.levelSelect = document.getElementById("level-select");
    elements.startRun = document.getElementById("start-run");
    elements.endRun = document.getElementById("end-run");
    elements.hintButtons = [
      document.getElementById("hint-1"),
      document.getElementById("hint-2"),
      document.getElementById("hint-3"),
      document.getElementById("hint-4"),
    ];
    elements.hintOverlay = document.getElementById("hint-overlay");
    elements.hintRotation = document.getElementById("hint-rotations");
    elements.hintMirror = document.getElementById("hint-mirrors");
    elements.hintText = document.getElementById("hint-text");
    elements.hintTarget = document.getElementById("hint-target");
    elements.hudRunTimer = document.getElementById("hud-run-timer");
    elements.hudItemTimer = document.getElementById("hud-item-timer");
    elements.hudScore = document.getElementById("hud-score");
    elements.hudStreak = document.getElementById("hud-streak");
    elements.hudProgress = document.getElementById("hud-progress");
    elements.hudGate = document.getElementById("hud-gate");
    elements.summaryBanner = document.getElementById("summary-banner");
    elements.summaryTitle = document.getElementById("summary-title");
    elements.summaryScore = document.getElementById("summary-score");
    elements.summaryAccuracy = document.getElementById("summary-accuracy");
    elements.summaryMedian = document.getElementById("summary-median");
    elements.summaryStreak = document.getElementById("summary-streak");
    elements.summaryClose = document.getElementById("summary-close");
    elements.patternView = document.getElementById("pattern-view");
    elements.orbGrid = document.getElementById("orbifold-grid");
  }

  function exposeVersion() {
    if (elements.appVersion) {
      elements.appVersion.textContent = `Game Mode ${APP_VERSION}`;
    }
  }

  function renderOrbifoldGrid() {
    const layout = GameConfig.ORBIFOLD_GRID_LAYOUT;
    elements.orbGrid.innerHTML = "";
    for (const row of layout) {
      for (const entry of row) {
        if (!entry) {
          const spacer = document.createElement("div");
          spacer.className = "orb-button grid-spacer";
          elements.orbGrid.appendChild(spacer);
          continue;
        }
        const orb = ensureOrb(entry);
        const btn = document.createElement("button");
        btn.className = "orb-button";
        btn.type = "button";
        btn.dataset.orb = orb;
        btn.setAttribute("aria-pressed", "false");
        btn.innerHTML = `<span class="hold-ring"></span><span class="label">${formatOrbLabel(orb)}</span>`;
        elements.orbGrid.appendChild(btn);
        state.orbButtons.set(orb, btn);
        attachHoldHandlers(btn, orb);
      }
    }
  }

  function bindControls() {
    elements.startRun?.addEventListener("click", () => {
      if (state.runActive) return;
      const levelId = elements.levelSelect.value;
      try {
        service.startRun(levelId);
      } catch (err) {
        console.error("Unable to start run", err);
      }
    });

    elements.endRun?.addEventListener("click", () => {
      if (!state.runActive) return;
      service.endRun({ reason: "manual" });
    });

    elements.summaryClose?.addEventListener("click", () => {
      hideSummary();
    });

    elements.levelSelect?.addEventListener("change", () => {
      const level = GameConfig.LEVELS.find(l => l.id === elements.levelSelect.value);
      state.level = level || null;
      updateGateHud(level);
    });

    elements.hintButtons.forEach((btn, index) => {
      const order = index + 1;
      btn?.addEventListener("click", () => {
        if (!state.runActive) return;
        if (!isHintAvailable(order)) return;
        service.onHintRequest(order);
      });
    });
  }

  function refreshLevelSelect() {
    const unlocked = new Set(service.progress?.unlockedLevels || ["L1-rotate"]);
    const select = elements.levelSelect;
    if (!select) return;
    select.innerHTML = "";
    for (const level of GameConfig.LEVELS) {
      const option = document.createElement("option");
      option.value = level.id;
      option.textContent = `${level.label}`;
      if (!unlocked.has(level.id)) {
        option.disabled = true;
        option.textContent += " (Locked)";
      }
      select.appendChild(option);
    }
    const firstEnabled = [...select.options].find(opt => !opt.disabled);
    if (firstEnabled) {
      select.value = firstEnabled.value;
      state.level = GameConfig.LEVELS.find(l => l.id === firstEnabled.value) || null;
      updateGateHud(state.level);
    }
  }

  function updateGateHud(level) {
    if (!elements.hudGate) return;
    if (!level) {
      elements.hudGate.textContent = "--";
      return;
    }
    const gate = level.gate;
    if (!gate) {
      elements.hudGate.textContent = "--";
      return;
    }
    const accuracy = Math.round((gate.minAccuracy || 0) * 100);
    const median = gate.maxMedianItemSeconds || "–";
    elements.hudGate.textContent = `≥${accuracy}% | < ${median}s`;
  }

  function updateHudIdle() {
    elements.hudRunTimer.textContent = "00:00";
    elements.hudItemTimer.textContent = "00:00";
    elements.hudScore.textContent = "0";
    elements.hudStreak.textContent = "0";
    elements.hudProgress.textContent = "0 / 0";
  }

  function attachServiceEvents() {
    const events = GameService.EVENTS;
    service.on(events.RUN_STARTED, ({ runState, level }) => {
      state.runActive = true;
      state.runState = runState;
      state.level = level;
      state.showGuides = false;
      state.currentItem = null;
      state.disabledOrbs.clear();
      elements.startRun.disabled = true;
      elements.endRun.disabled = false;
      updateGateHud(level);
      resetHintUi();
      hideSummary();
      updateHud(runState);
    });

    service.on(events.RUN_TICK, ({ runState }) => {
      state.runState = runState;
      updateRunTimer(runState);
    });

    service.on(events.ITEM_ACTIVE, ({ item, index, runState }) => {
      state.currentItem = item;
      state.runState = runState;
      state.disabledOrbs.clear();
      resetHintUiForItem(item);
      activateItem(item, index, runState.items.length);
    });

    service.on(events.HINT_USED, ({ order }) => {
      setHintState(order);
    });

    service.on(events.GUESS_EVALUATED, ({ guess }) => {
      const orb = ensureOrb(guess);
      const btn = state.orbButtons.get(orb);
      if (btn) {
        btn.classList.add("incorrect");
        btn.disabled = true;
      }
    });

    service.on(events.ITEM_RESOLVED, ({ result, runState }) => {
      state.runState = runState;
      highlightResolution(result);
      updateHud(runState);
    });

    service.on(events.RUN_ENDED, ({ summary, gatePassed }) => {
      state.runActive = false;
      state.runState = null;
      state.currentItem = null;
      elements.startRun.disabled = false;
      elements.endRun.disabled = true;
      updateHudIdle();
      showSummary(summary, gatePassed);
      refreshLevelSelect();
    });
  }

  function activateItem(item, index, total) {
    state.timers.itemStart = performance.now();
    elements.hudProgress.textContent = `${index + 1} / ${total}`;
    state.orbButtons.forEach(btn => {
      btn.disabled = false;
      btn.classList.remove("incorrect", "correct", "assisted");
      resetHoldVisuals(btn);
    });
    renderPatternForItem(item);
    service.onItemShown?.(item.id);
  }

  function renderPatternForItem(item) {
    if (!item) return;
    state.baseGenome = cloneDeep(item.genome || createGenomeForOrb(item.truth));
    state.currentGenome = scaleGenomeForView(state.baseGenome);
    state.showGuides = false;
    global.showSymmetryGuides = false;
    queuePatternRender();
  }

  function scaleGenomeForView(genome) {
    const container = elements.patternView;
    if (!container) return cloneDeep(genome);
    const rect = container.getBoundingClientRect();
    const base = cloneDeep(genome);
    const baseScale = genome.seedMotifScale || genome.motifScale || 1;
    const cell = estimateCellSize(genome);
    const horizontalSpan = Math.max(1, cell.w) * baseScale * PATTERN_REPEATS_X;
    const verticalSpan = Math.max(1, cell.h) * baseScale * PATTERN_REPEATS_Y;
    const scaleFactor = Math.min(rect.width / horizontalSpan, rect.height / verticalSpan);
    base.motifScale = baseScale * (Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1);
    base.seedMotifScale = baseScale;
    return base;
  }

  function setHintState(order) {
    if (!state.currentItem) return;
    for (let i = 0; i < order; i++) {
      const btn = elements.hintButtons[i];
      if (btn) {
        btn.disabled = false;
        btn.classList.add("active");
      }
    }
    const overlays = state.currentItem.overlays || {};
    switch (order) {
      case 1:
        if (overlays.textCue) {
          elements.hintRotation.textContent = overlays.textCue;
        }
        state.showGuides = true;
        global.showSymmetryGuides = true;
        elements.hintOverlay.classList.add("active");
        queuePatternRender();
        break;
      case 2:
        elements.hintMirror.textContent = overlays.textCue || "Mirror families highlighted.";
        break;
      case 3:
        elements.hintText.textContent = overlays.textCue || "Focus on the distinguishing feature.";
        break;
      case 4:
        revealTargetOrb(state.currentItem.truth);
        break;
      default:
        break;
    }
    enableNextHint(order + 1);
  }

  function revealTargetOrb(truth) {
    const orb = ensureOrb(truth);
    const btn = state.orbButtons.get(orb);
    if (!btn) return;
    btn.classList.add("assisted");
    elements.hintTarget.textContent = `Target: ${formatOrbLabel(orb)}`;
    elements.hintTarget.style.display = "block";
  }

  function enableNextHint(order) {
    elements.hintButtons.forEach((btn, idx) => {
      const hintOrder = idx + 1;
      if (hintOrder === order) {
        btn.disabled = !isHintAvailable(hintOrder);
      } else if (hintOrder > order) {
        btn.disabled = true;
      }
    });
  }

  function resetHintUi() {
    elements.hintButtons.forEach((btn, idx) => {
      btn.disabled = idx !== 0;
      btn.classList.remove("active");
    });
    elements.hintOverlay.classList.remove("active");
    elements.hintRotation.textContent = "";
    elements.hintMirror.textContent = "";
    elements.hintText.textContent = "";
    elements.hintTarget.textContent = "";
    elements.hintTarget.style.display = "none";
  }

  function resetHintUiForItem(item) {
    resetHintUi();
    state.availableHints = {
      1: Boolean(item.overlays && item.overlays.rotations && item.overlays.rotations.length !== undefined),
      2: Boolean(item.overlays && item.overlays.mirrors && item.overlays.mirrors.length !== undefined),
      3: Boolean(item.overlays && item.overlays.textCue),
      4: true,
    };
    elements.hintButtons[0].disabled = !state.availableHints[1];
  }

  function isHintAvailable(order) {
    return state.availableHints[order] !== false;
  }

  function highlightResolution(result) {
    const truth = ensureOrb(result.truth);
    const picked = result.picked ? ensureOrb(result.picked) : null;
    state.orbButtons.forEach(btn => (btn.disabled = true));
    const truthBtn = state.orbButtons.get(truth);
    if (truthBtn) truthBtn.classList.add("correct");
    if (picked && picked !== truth) {
      const pickedBtn = state.orbButtons.get(picked);
      if (pickedBtn) pickedBtn.classList.add(result.assisted ? "assisted" : "incorrect");
    }
    if (result.assisted && truthBtn) {
      truthBtn.classList.add("assisted");
    }
  }

  function updateHud(runState) {
    if (!runState) return;
    updateRunTimer(runState);
    elements.hudScore.textContent = `${runState.score | 0}`;
    elements.hudStreak.textContent = `${runState.currentStreak | 0}`;
  }

  function updateRunTimer(runState) {
    const remaining = Math.max(0, runState.runTimeRemaining || 0);
    elements.hudRunTimer.textContent = formatSeconds(remaining);
    if (state.timers.itemStart) {
      const elapsed = (performance.now() - state.timers.itemStart) / 1000;
      elements.hudItemTimer.textContent = formatSeconds(elapsed);
    } else {
      elements.hudItemTimer.textContent = "00:00";
    }
  }

  function formatSeconds(seconds) {
    const sec = Math.max(0, seconds);
    const whole = Math.floor(sec);
    const mm = String(Math.floor(whole / 60)).padStart(2, "0");
    const ss = String(whole % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function showSummary(summary, gatePassed) {
    if (!summary) return;
    elements.summaryTitle.textContent = gatePassed ? "Level Gate Passed" : "Run Summary";
    elements.summaryScore.textContent = `${summary.totalScore | 0}`;
    elements.summaryAccuracy.textContent = `${Math.round((summary.accuracy || 0) * 100)}%`;
    elements.summaryMedian.textContent = `${(summary.medianItemSeconds || 0).toFixed(1)} s`;
    elements.summaryStreak.textContent = `${summary.longestStreak | 0}`;
    elements.summaryBanner.classList.add("active");
    elements.summaryBanner.setAttribute("aria-hidden", "false");
  }

  function hideSummary() {
    elements.summaryBanner.classList.remove("active");
    elements.summaryBanner.setAttribute("aria-hidden", "true");
  }

  function startFrameLoop() {
    function frame(ts) {
      if (state.timers.lastFrame != null) {
        const delta = ts - state.timers.lastFrame;
        if (delta > 0) {
          service.onTick(delta);
        }
      }
      state.timers.lastFrame = ts;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function attachHoldHandlers(btn, orb) {
    btn.addEventListener("pointerdown", (ev) => {
      if (btn.disabled || !state.runActive) return;
      ev.preventDefault();
      beginHold(btn, orb);
    });
    btn.addEventListener("pointerup", () => finishHold(btn, true));
    btn.addEventListener("pointerleave", () => finishHold(btn, false));
    btn.addEventListener("pointercancel", () => finishHold(btn, false));
    btn.addEventListener("keydown", (ev) => {
      if (btn.disabled || !state.runActive) return;
      if (ev.code === "Space" || ev.code === "Enter") {
        ev.preventDefault();
        beginHold(btn, orb);
      }
    });
    btn.addEventListener("keyup", (ev) => {
      if (ev.code === "Space" || ev.code === "Enter") {
        finishHold(btn, true);
      }
    });
  }

  function beginHold(btn, orb) {
    if (state.holdStates.has(btn)) return;
    const hold = {
      start: performance.now(),
      orb,
      frame: null,
      triggered: false,
    };
    btn.style.setProperty("--hold-active", "1");
    const step = () => {
      const elapsed = performance.now() - hold.start;
      const progress = Math.min(1, elapsed / HOLD_DURATION_MS);
      btn.style.setProperty("--hold-progress", `${progress}`);
      if (progress >= 1 && !hold.triggered) {
        hold.triggered = true;
        completeHold(btn, orb);
        return;
      }
      hold.frame = requestAnimationFrame(step);
    };
    hold.frame = requestAnimationFrame(step);
    state.holdStates.set(btn, hold);
  }

  function finishHold(btn, commit) {
    const hold = state.holdStates.get(btn);
    if (!hold) return;
    if (hold.frame) cancelAnimationFrame(hold.frame);
    state.holdStates.delete(btn);
    if (!hold.triggered) {
      resetHoldVisuals(btn);
    }
  }

  function completeHold(btn, orb) {
    resetHoldVisuals(btn);
    btn.disabled = true;
    service.onGuess(orb);
  }

  function resetHoldVisuals(btn) {
    btn.style.setProperty("--hold-progress", "0");
    btn.style.setProperty("--hold-active", "0");
  }

  function activateHintOverlay(order, itemId) {
    if (!state.currentItem || state.currentItem.id !== itemId) return;
    const overlays = state.currentItem.overlays || {};
    switch (order) {
      case 1:
        elements.hintRotation.textContent = overlays.rotations && overlays.rotations.length
          ? "Rotation centres highlighted"
          : "No rotation overlays available";
        break;
      case 2:
        elements.hintMirror.textContent = overlays.mirrors && overlays.mirrors.length
          ? "Mirror directions highlighted"
          : "No mirror overlays available";
        break;
      case 3:
        elements.hintText.textContent = overlays.textCue || "Study the distinctive motif";
        break;
      case 4:
        elements.hintTarget.textContent = `Target: ${formatOrbLabel(state.currentItem.truth)}`;
        elements.hintTarget.style.display = "block";
        break;
      default:
        break;
    }
  }

  function setupP5Sketch(p5) {
    const container = elements.patternView;
    const rect = container.getBoundingClientRect();
    p5.createCanvas(rect.width, rect.height).parent(container);
    p5.angleMode(p5.RADIANS);
    p5.noLoop();
    renderPattern(p5);
  }

  function renderPattern(p5) {
    p5.background(BACKGROUND_COLOR);
    if (!state.currentGenome) return;
    const clone = cloneDeep(state.currentGenome);
    const pg = p5.createGraphics(p5.width, p5.height);
    pg.background(BACKGROUND_COLOR);
    pg.push();
    pg.translate(pg.width / 2, pg.height / 2);
    const prior = global.showSymmetryGuides;
    global.showSymmetryGuides = state.showGuides;
    drawWallpaperOn(pg, clone);
    global.showSymmetryGuides = prior;
    pg.pop();
    p5.image(pg, 0, 0, p5.width, p5.height);
  }

  function onWindowResized(p5) {
    const container = elements.patternView;
    const rect = container.getBoundingClientRect();
    p5.resizeCanvas(rect.width, rect.height);
    if (state.baseGenome) {
      state.currentGenome = scaleGenomeForView(state.baseGenome);
    }
    renderPattern(p5);
  }

  function queueP5Redraw(p5) {
    renderPattern(p5);
  }

  function installP5() {
    new p5((sketch) => {
      sketch.setup = () => setupP5Sketch(sketch);
      sketch.draw = () => renderPattern(sketch);
      sketch.windowResized = () => onWindowResized(sketch);
      global.redrawPattern = () => queueP5Redraw(sketch);
    });
  }

  function queuePatternRender() {
    if (typeof global.redrawPattern === "function") {
      global.redrawPattern();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      installP5();
      init();
    });
  } else {
    installP5();
    init();
  }
})(typeof window !== "undefined" ? window : this);
