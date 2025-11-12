(function (global) {
  "use strict";

  const WRONG_GUESS_LOCK_MS = 1000;
  const PATTERN_REPEATS_X = 3;
  const PATTERN_REPEATS_Y = 6;
  const BACKGROUND_COLOR = 20;

  const GameConfig = global.GameConfig;
  const GameService = global.GameService;
  const GameAppGlobal = (global.GameApp = global.GameApp || {});

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
    guideMode: "off",
    orbButtons: new Map(),
    disabledOrbs: new Set(),
    allowedOrbs: null,
    inputLocked: false,
    inputLockTimer: null,
    availableHints: { 1: true, 2: true, 3: true, 4: true },
    nextHintOrder: null,
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

  global.symmetryGuideMode = "off";

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
    console.log("[DEBUG] createGenomeForOrb: orb =", orb, "group =", group, "initial numShapes =", genome.numShapes, "shapes.length =", genome.shapes?.length);
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
    elements.setupScreen = document.getElementById("setup-screen");
    elements.setupStart = document.getElementById("setup-start");
    elements.stagePath = document.getElementById("stage-path");
    elements.stageNextLabel = document.getElementById("stage-next-label");
    elements.hintButton = document.getElementById("hint-button");
    elements.hintNumber = elements.hintButton ? elements.hintButton.querySelector(".hint-number") : null;
    elements.hintOverlay = document.getElementById("hint-overlay");
    elements.hintRotation = document.getElementById("hint-rotations");
    elements.hintMirror = document.getElementById("hint-mirrors");
    elements.hintText = document.getElementById("hint-text");
    elements.hintTarget = document.getElementById("hint-target");
    elements.hudRunTimer = document.getElementById("hud-run-timer");
    elements.hudItemTimer = document.getElementById("hud-item-timer");
    elements.hudStreak = document.getElementById("hud-streak");
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

  function handleOrbGuess(btn, orb) {
    if (btn.disabled || !state.runActive || state.inputLocked) return;
    btn.disabled = true;
    service.onGuess(orb);
  }

  function clearInputLockTimer() {
    if (!state.inputLockTimer) return;
    clearTimeout(state.inputLockTimer);
    state.inputLockTimer = null;
  }

  function setInputLock(active, durationMs) {
    if (!elements.orbGrid) return;
    if (active) {
      clearInputLockTimer();
      state.inputLocked = true;
      elements.orbGrid.classList.add("input-locked");
      if (durationMs) {
        state.inputLockTimer = setTimeout(() => {
          state.inputLockTimer = null;
          setInputLock(false);
        }, durationMs);
      }
    } else {
      clearInputLockTimer();
      state.inputLocked = false;
      elements.orbGrid.classList.remove("input-locked");
    }
  }

  function isOrbAllowed(orb) {
    if (!state.allowedOrbs) return true;
    return state.allowedOrbs.has(ensureOrb(orb));
  }

  function setAllowedOrbs(level) {
    if (level && Array.isArray(level.allowed) && level.allowed.length) {
      state.allowedOrbs = new Set(level.allowed.map(ensureOrb));
    } else {
      state.allowedOrbs = null;
    }
    applyOrbButtonAvailability();
  }

  function applyOrbButtonAvailability() {
    state.orbButtons.forEach((btn, orb) => {
      if (state.runActive) {
        if (!isOrbAllowed(orb)) {
          btn.disabled = true;
        } else if (!btn.classList.contains("incorrect") && !btn.classList.contains("correct") && !btn.classList.contains("assisted")) {
          btn.disabled = false;
        }
      } else {
        btn.disabled = false;
      }
    });
  }

  function attachOrbHandlers(btn, orb) {
    btn.addEventListener("click", () => handleOrbGuess(btn, orb));
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
        btn.innerHTML = `<span class="label">${formatOrbLabel(orb)}</span>`;
        elements.orbGrid.appendChild(btn);
        state.orbButtons.set(orb, btn);
        attachOrbHandlers(btn, orb);
      }
    }
    applyOrbButtonAvailability();
  }

  function bindControls() {
    console.log("[DEBUG] bindControls: Starting to bind controls");
    console.log("[DEBUG] bindControls: setupStart element:", elements.setupStart);

    elements.setupStart?.addEventListener("click", () => {
      console.log("[DEBUG] setupStart clicked");
      if (state.runActive) {
        console.log("[DEBUG] setupStart: runActive is true, returning");
        return;
      }
      if (!state.level) {
        console.log("[DEBUG] setupStart: no current level set, returning");
        return;
      }
      try {
        console.log("[DEBUG] setupStart: calling service.startRun with", state.level.id);
        service.startRun(state.level.id);
      } catch (err) {
        console.error("Unable to start run", err);
      }
    });

    elements.hintButton?.addEventListener("click", () => {
      if (!state.runActive) return;
      if (!Number.isInteger(state.nextHintOrder)) return;
      service.onHintRequest(state.nextHintOrder);
    });

    elements.summaryClose?.addEventListener("click", () => {
      hideSummary();
      showSetupScreen();
    });
    
    console.log("[DEBUG] bindControls: Finished binding controls");
  }

  function refreshLevelSelect() {
    console.log("[DEBUG] refreshLevelSelect: rendering stage path");
    const container = elements.stagePath;
    if (!container) {
      console.log("[DEBUG] refreshLevelSelect: stagePath element missing");
      return;
    }

    const progress = service.progress || {};
    const modeId = progress.selectedModeId || GameConfig.DEFAULT_MODE_ID;
    const allLevels = GameConfig.LEVELS.filter(lvl => lvl.modeId === modeId).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    if (allLevels.length === 0) {
      container.innerHTML = "<p>No training levels configured.</p>";
      elements.stageNextLabel.textContent = "Next up: not available";
      elements.setupStart.disabled = true;
      state.level = null;
      return;
    }

    const unlocked = new Set(progress.unlockedLevels || []);
    if (unlocked.size === 0 && allLevels.length > 0) {
      unlocked.add(allLevels[0].id);
    }
    let currentLevelId = progress.lastLevelId && allLevels.some(lvl => lvl.id === progress.lastLevelId)
      ? progress.lastLevelId
      : allLevels[0].id;
    let currentIndex = allLevels.findIndex(lvl => lvl.id === currentLevelId);
    if (currentIndex < 0) {
      currentIndex = 0;
      currentLevelId = allLevels[0].id;
    }

    const statusById = {};
    allLevels.forEach((lvl, idx) => {
      let status;
      if (idx < currentIndex) {
        status = "completed";
      } else if (idx === currentIndex) {
        status = "current";
      } else {
        status = unlocked.has(lvl.id) ? "pending" : "locked";
      }
      statusById[lvl.id] = status;
    });

    const stagesMap = new Map();
    allLevels.forEach((lvl) => {
      const key = lvl.stageId || "stage-unknown";
      if (!stagesMap.has(key)) {
        stagesMap.set(key, {
          id: key,
          label: lvl.stageLabel || lvl.stageCode || "Stage",
          order: lvl.stageOrder || 0,
          levels: [],
        });
      }
      stagesMap.get(key).levels.push(lvl);
    });

    const stages = Array.from(stagesMap.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
    container.innerHTML = "";

    let nextLevel = allLevels[currentIndex] || null;
    if (!nextLevel && allLevels.length > 0) {
      nextLevel = allLevels[0];
      currentIndex = 0;
    }
    state.level = nextLevel || null;

    stages.forEach((stage, index) => {
      const node = document.createElement("div");
      node.className = "stage-node";

      const stageLevels = (stage.levels || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
      const levelStatuses = stageLevels.map(lvl => statusById[lvl.id]);
      const stageCompleted = levelStatuses.every(status => status === "completed");
      const stageCurrent = levelStatuses.includes("current");
      if (stageCompleted) node.classList.add("completed");
      if (stageCurrent) node.classList.add("current");

      const marker = document.createElement("div");
      marker.className = "stage-marker";
      if (stageCompleted) marker.classList.add("completed");
      if (stageCurrent) marker.classList.add("current");
      marker.textContent = `${index + 1}`;
      node.appendChild(marker);

      const details = document.createElement("div");
      details.className = "stage-details";

      const title = document.createElement("div");
      title.className = "stage-title";
      title.textContent = stage.label;
      details.appendChild(title);

      const summarySource = stageLevels.find(lvl => lvl.summary);
      if (summarySource) {
        const desc = document.createElement("div");
        desc.className = "stage-desc";
        desc.textContent = summarySource.summary;
        details.appendChild(desc);
      }

      const pills = document.createElement("div");
      pills.className = "level-label";
      stageLevels.forEach((lvl) => {
        const pill = document.createElement("span");
        pill.className = "level-pill";
        const status = statusById[lvl.id];
        if (status === "completed") pill.classList.add("completed");
        if (status === "current") pill.classList.add("current");
        pill.textContent = lvl.label || lvl.code || lvl.id;
        pills.appendChild(pill);
      });
      details.appendChild(pills);

      node.appendChild(details);
      container.appendChild(node);
    });

    if (elements.stageNextLabel) {
      if (state.level) {
        const stageName = state.level.stageLabel || state.level.stageCode || state.level.modeLabel || "";
        const text = `Next up: <strong>${stageName}</strong> · ${state.level.label}`;
        elements.stageNextLabel.innerHTML = text;
      } else {
        elements.stageNextLabel.textContent = "Next up: complete";
      }
    }

    if (elements.setupStart) {
      elements.setupStart.disabled = !state.level;
    }

    console.log("[DEBUG] refreshLevelSelect: Stage path rendered, next level:", state.level?.id);
  }

  function updateHudIdle() {
    elements.hudRunTimer.textContent = "00:00";
    elements.hudItemTimer.textContent = "00:00";
    elements.hudStreak.textContent = "0";
    state.nextHintOrder = null;
    updateHintButton();
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
      setAllowedOrbs(level);
      setInputLock(false);
      hideSetupScreen();
      resetHintUi();
      hideSummary();
      updateHud(runState);
    });

    service.on(events.RUN_TICK, ({ runState }) => {
      state.runState = runState;
      updateRunTimer(runState);
    });

    service.on(events.ITEM_ACTIVE, ({ item, index, runState }) => {
      console.log("[DEBUG] ITEM_ACTIVE event received:", { item: item?.id, index, runState });
      state.currentItem = item;
      state.runState = runState;
      state.disabledOrbs.clear();
      resetHintUiForItem(item);
      console.log("[DEBUG] ITEM_ACTIVE: About to call activateItem");
      activateItem(item, index, runState.items.length);
      console.log("[DEBUG] ITEM_ACTIVE: activateItem completed");
    });

    service.on(events.HINT_USED, ({ order }) => {
      setHintState(order);
    });

    service.on(events.GUESS_EVALUATED, ({ guess, correct }) => {
      const orb = ensureOrb(guess);
      const btn = state.orbButtons.get(orb);
      if (btn) {
        btn.classList.add("incorrect");
        btn.disabled = true;
      }
      if (!correct) {
        setInputLock(true, WRONG_GUESS_LOCK_MS);
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
      state.nextHintOrder = null;
      updateHintButton();
      updateHudIdle();
      showSummary(summary, gatePassed);
      refreshLevelSelect();
      setInputLock(false);
      setAllowedOrbs(null);
    });
  }

  function activateItem(item, index, total) {
    console.log("[DEBUG] activateItem: Starting with item:", item?.id);
    state.timers.itemStart = performance.now();
    setInputLock(false);
    state.orbButtons.forEach(btn => {
      btn.classList.remove("incorrect", "correct", "assisted", "throb");
    });
    elements.hintTarget.textContent = "";
    elements.hintTarget.style.display = "none";
    applyGuideMode("off");
    applyOrbButtonAvailability();
    console.log("[DEBUG] activateItem: About to call renderPatternForItem");
    renderPatternForItem(item);
    console.log("[DEBUG] activateItem: renderPatternForItem completed");
    service.onItemShown?.(item.id);
    console.log("[DEBUG] activateItem: Completed");
  }

  function renderPatternForItem(item) {
    console.log("[DEBUG] renderPatternForItem: Starting with item:", item?.id);
    if (!item) {
      console.log("[DEBUG] renderPatternForItem: No item provided");
      return;
    }
    console.log("[DEBUG] renderPatternForItem: Creating base genome");
    state.baseGenome = cloneDeep(item.genome || createGenomeForOrb(item.truth));
    state.currentGenome = scaleGenomeForView(state.baseGenome);
    applyGuideMode("off");
    console.log("[DEBUG] renderPatternForItem: About to call queuePatternRender");
    queuePatternRender();
    console.log("[DEBUG] renderPatternForItem: queuePatternRender completed");
  }

  function scaleGenomeForView(genome) {
    console.log("[DEBUG] scaleGenomeForView: input genome numShapes =", genome.numShapes, "shapes.length =", genome.shapes?.length);
    const container = elements.patternView;
    if (!container) return cloneDeep(genome);
    const rect = container.getBoundingClientRect();
    const base = cloneDeep(genome);
    const baseScale = genome.seedMotifScale || genome.motifScale || 1;
    const unitCell = estimateCellSize({ group: genome.group, motifScale: 1 });
    const cellWidth = Math.max(1, unitCell.w) * baseScale;
    const cellHeight = Math.max(1, unitCell.h) * baseScale;
    const horizontalSpan = cellWidth * PATTERN_REPEATS_X;
    const verticalSpan = cellHeight * PATTERN_REPEATS_Y;
    const scaleFactor = Math.min(rect.width / horizontalSpan, rect.height / verticalSpan);
    base.motifScale = baseScale * (Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1);
    base.seedMotifScale = baseScale;
    return base;
  }

  function setHintState(order) {
    if (!state.currentItem) return;
    const overlays = state.currentItem.overlays || {};
    switch (order) {
      case 1:
        elements.hintRotation.textContent = overlays.rotations && overlays.rotations.length
          ? "Rotation centres highlighted."
          : "Focus on the rotational anchor points.";
        elements.hintOverlay.classList.add("active");
        applyGuideMode("rotations");
        queuePatternRender();
        break;
      case 2:
        elements.hintMirror.textContent = overlays.mirrors && overlays.mirrors.length
          ? "Mirror lines and glide axes highlighted." 
          : "Trace mirrored motifs and glide repeats.";
        elements.hintOverlay.classList.add("active");
        applyGuideMode("all");
        queuePatternRender();
        break;
      case 3:
        throbTargetOrb(state.currentItem.truth);
        break;
      default:
        break;
    }
    state.nextHintOrder = computeNextHintOrder(order);
    updateHintButton();
  }

  function revealTargetOrb(truth) {
    const orb = ensureOrb(truth);
    const btn = state.orbButtons.get(orb);
    if (!btn) return;
    btn.classList.add("assisted");
    elements.hintTarget.textContent = `Target: ${formatOrbLabel(orb)}`;
    elements.hintTarget.style.display = "block";
  }

  function resetHintUi() {
    elements.hintOverlay.classList.remove("active");
    elements.hintRotation.textContent = "";
    elements.hintMirror.textContent = "";
    elements.hintText.textContent = "";
    elements.hintTarget.textContent = "";
    elements.hintTarget.style.display = "none";
    state.availableHints = { 1: false, 2: false, 3: false };
    state.nextHintOrder = null;
    applyGuideMode("off");
    updateHintButton();
  }

  function resetHintUiForItem(item) {
    resetHintUi();
    state.availableHints = { 1: true, 2: true, 3: true };
    state.nextHintOrder = computeNextHintOrder(0);
    updateHintButton();
  }

  function isHintAvailable(order) {
    return state.availableHints[order] !== false;
  }

  function highlightResolution(result) {
    const truth = ensureOrb(result.truth);
    const picked = result.picked ? ensureOrb(result.picked) : null;
    state.orbButtons.forEach(btn => {
      btn.disabled = true;
      btn.classList.remove("throb");
    });
    const truthBtn = state.orbButtons.get(truth);
    if (truthBtn) truthBtn.classList.add("correct");
    if (picked && picked !== truth) {
      const pickedBtn = state.orbButtons.get(picked);
      if (pickedBtn) pickedBtn.classList.add(result.assisted ? "assisted" : "incorrect");
    }
    if (result.assisted && truthBtn) {
      truthBtn.classList.add("assisted");
    }
    applyGuideMode("off");
    state.nextHintOrder = null;
    updateHintButton();
    setInputLock(false);
  }

  function activateHintOverlay(order, itemId) {
    if (!state.currentItem || state.currentItem.id !== itemId) return;
    const overlays = state.currentItem.overlays || {};
    switch (order) {
      case 1:
        elements.hintRotation.textContent = overlays.rotations && overlays.rotations.length
          ? "Rotation centres highlighted"
          : "No rotation overlays available";
        elements.hintOverlay.classList.add("active");
        applyGuideMode("rotations");
        queuePatternRender();
        break;
      case 2:
        elements.hintMirror.textContent = overlays.mirrors && overlays.mirrors.length
          ? "Mirror lines and glide axes highlighted."
          : "No mirror overlays available";
        elements.hintOverlay.classList.add("active");
        applyGuideMode("all");
        queuePatternRender();
        break;
      case 3:
        throbTargetOrb(state.currentItem.truth);
        break;
      default:
        break;
    }
  }

  function computeNextHintOrder(afterOrder) {
    for (let i = 1; i <= 3; i++) {
      if (isHintAvailable(i) && i > afterOrder) {
        return i;
      }
    }
    return null;
  }

  function updateHintButton() {
    const btn = elements.hintButton;
    if (!btn) return;
    const numberEl = elements.hintNumber;
    const next = state.runActive ? state.nextHintOrder : null;
    if (numberEl) {
      numberEl.textContent = next ? `${next}` : "–";
    }
    btn.disabled = !Number.isInteger(next);
  }

  function applyGuideMode(mode) {
    const normalized = mode === "rotations" || mode === "mirrors" || mode === "all" ? mode : "off";
    const changed = state.guideMode !== normalized;
    state.guideMode = normalized;
    if (normalized === "off") {
      state.showGuides = false;
      global.showSymmetryGuides = false;
    } else {
      state.showGuides = true;
      global.showSymmetryGuides = true;
    }
    global.symmetryGuideMode = normalized;
    return changed;
  }

  function updateHud(runState) {
    if (!runState) return;
    updateRunTimer(runState);
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

  function formatPercent(value) {
    if (!Number.isFinite(value)) return "0%";
    return `${Math.round(value * 100)}%`;
  }

  function showSummary(summary, gatePassed) {
    if (!elements.summaryBanner) return;
    const data = summary || {};
    const passed = Boolean(gatePassed);
    if (elements.summaryTitle) {
      elements.summaryTitle.textContent = passed ? "Gate passed!" : "Run complete";
    }
    if (elements.summaryScore) {
      elements.summaryScore.textContent = `${data.totalScore ?? 0}`;
    }
    if (elements.summaryAccuracy) {
      elements.summaryAccuracy.textContent = formatPercent(data.accuracy ?? 0);
    }
    if (elements.summaryMedian) {
      elements.summaryMedian.textContent = formatSeconds(data.medianItemSeconds ?? 0);
    }
    if (elements.summaryStreak) {
      elements.summaryStreak.textContent = `${data.longestStreak ?? 0}`;
    }
    elements.summaryBanner.classList.remove("hidden");
    elements.summaryBanner.classList.add("active");
    elements.summaryBanner.setAttribute("aria-hidden", "false");
  }

  function hideSummary() {
    if (!elements.summaryBanner) return;
    elements.summaryBanner.classList.add("hidden");
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

  function showSetupScreen() {
    if (elements.setupScreen) {
      elements.setupScreen.classList.remove("hidden");
      elements.setupScreen.setAttribute("aria-hidden", "false");
    }
  }

  function hideSetupScreen() {
    if (elements.setupScreen) {
      elements.setupScreen.classList.add("hidden");
      elements.setupScreen.setAttribute("aria-hidden", "true");
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
    console.log("[DEBUG] renderPattern: Starting");
    console.log("[DEBUG] renderPattern: state.currentGenome:", !!state.currentGenome);
    p5.background(BACKGROUND_COLOR);
    if (!state.currentGenome) {
      console.log("[DEBUG] renderPattern: No currentGenome, returning");
      return;
    }
    console.log("[DEBUG] renderPattern: Creating clone and graphics");
    const clone = cloneDeep(state.currentGenome);
    const pg = p5.createGraphics(p5.width, p5.height);
    pg.background(BACKGROUND_COLOR);
    pg.push();
    pg.translate(pg.width / 2, pg.height / 2);
    const prior = global.showSymmetryGuides;
    global.showSymmetryGuides = state.showGuides;
    console.log("[DEBUG] renderPattern: About to call drawWallpaperOn");
    try {
      drawWallpaperOn(pg, clone);
      console.log("[DEBUG] renderPattern: drawWallpaperOn completed");
    } catch (err) {
      console.error("[DEBUG] renderPattern: drawWallpaperOn threw error:", err);
      throw err;
    }
    global.showSymmetryGuides = prior;
    pg.pop();
    p5.image(pg, 0, 0, p5.width, p5.height);
    console.log("[DEBUG] renderPattern: Completed");
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

  function ensureP5Globals(p5Instance) {
    console.log("[DEBUG] ensureP5Globals: Starting");
    if (!p5Instance || GameAppGlobal._p5GlobalsReady) {
      console.log("[DEBUG] ensureP5Globals: Early return - p5Instance:", !!p5Instance, "_p5GlobalsReady:", GameAppGlobal._p5GlobalsReady);
      return;
    }

    const bind = (fn) => (...args) => fn.apply(p5Instance, args);

    const maybeAssign = (name, value) => {
      if (typeof global[name] === "undefined") {
        global[name] = value;
        console.log("[DEBUG] ensureP5Globals: Assigned global", name, "=", value);
      } else {
        console.log("[DEBUG] ensureP5Globals: Global", name, "already exists, skipping");
      }
    };

    const p5Aliases = {
      random: bind(p5Instance.random),
      randomSeed: bind(p5Instance.randomSeed),
      noise: bind(p5Instance.noise),
      noiseSeed: bind(p5Instance.noiseSeed),
      constrain: bind(p5Instance.constrain),
      map: bind(p5Instance.map),
      lerp: bind(p5Instance.lerp),
      radians: bind(p5Instance.radians),
      degrees: bind(p5Instance.degrees),
      colorMode: bind(p5Instance.colorMode),
      color: bind(p5Instance.color),
      createVector: bind(p5Instance.createVector),
    };

    console.log("[DEBUG] ensureP5Globals: Processing p5Aliases");
    Object.entries(p5Aliases).forEach(([name, fn]) => {
      if (typeof fn === "function" && typeof global[name] !== "function") {
        global[name] = fn;
        console.log("[DEBUG] ensureP5Globals: Bound p5 function", name);
      }
    });

    const mathAliases = {
      floor: Math.floor,
      round: Math.round,
      ceil: Math.ceil,
      abs: Math.abs,
      min: Math.min,
      max: Math.max,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      atan2: Math.atan2,
      sqrt: Math.sqrt,
      pow: Math.pow,
      log: Math.log,
      exp: Math.exp,
    };

    console.log("[DEBUG] ensureP5Globals: Processing mathAliases");
    Object.entries(mathAliases).forEach(([name, fn]) => {
      if (typeof global[name] !== "function") {
        global[name] = fn;
      }
    });

    maybeAssign("PI", Math.PI);
    maybeAssign("TWO_PI", Math.PI * 2);
    maybeAssign("HALF_PI", Math.PI / 2);
    maybeAssign("QUARTER_PI", Math.PI / 4);
    maybeAssign("HSB", p5Instance.HSB);
    maybeAssign("RGB", p5Instance.RGB);
    if (p5Instance.CLOSE !== undefined) {
      maybeAssign("CLOSE", p5Instance.CLOSE);
    }

    maybeAssign("estimateCellSize", window.estimateCellSize);

    GameAppGlobal._p5GlobalsReady = true;
    console.log("[DEBUG] ensureP5Globals: Completed, _p5GlobalsReady set to true");
  }

  function installP5() {
    if (GameAppGlobal._p5Installed) return;
    const instance = new p5(p5 => {
      p5.setup = () => setupP5Sketch(p5);
      p5.draw = () => renderPattern(p5);
      p5.windowResized = () => onWindowResized(p5);
    });
    GameAppGlobal._p5Instance = instance;
    ensureP5Globals(instance);
    GameAppGlobal._p5Installed = true;
    global.redrawPattern = () => {
      console.log("[DEBUG] redrawPattern: Starting");
      if (GameAppGlobal._p5Instance) {
        console.log("[DEBUG] redrawPattern: About to call p5.redraw()");
        GameAppGlobal._p5Instance.redraw();
        console.log("[DEBUG] redrawPattern: p5.redraw() completed");
      } else {
        console.log("[DEBUG] redrawPattern: No p5 instance available");
      }
      console.log("[DEBUG] redrawPattern: Completed");
    };
  }

  function queuePatternRender() {
    console.log("[DEBUG] queuePatternRender: Starting");
    console.log("[DEBUG] queuePatternRender: global.redrawPattern type:", typeof global.redrawPattern);
    if (typeof global.redrawPattern === "function") {
      console.log("[DEBUG] queuePatternRender: Calling global.redrawPattern");
      global.redrawPattern();
      console.log("[DEBUG] queuePatternRender: global.redrawPattern completed");
    } else {
      console.log("[DEBUG] queuePatternRender: global.redrawPattern is not a function");
    }
  }

  function init() {
    console.log("[DEBUG] init: Starting initialization");
    installP5();
    console.log("[DEBUG] init: installP5 completed");

    if (!GameAppGlobal._initialized) {
      console.log("[DEBUG] init: First time initialization");
      cacheDom();
      console.log("[DEBUG] init: cacheDom completed");
      renderOrbifoldGrid();
      console.log("[DEBUG] init: renderOrbifoldGrid completed");
      bindControls();
      console.log("[DEBUG] init: bindControls completed");
      attachServiceEvents();
      console.log("[DEBUG] init: attachServiceEvents completed");
      startFrameLoop();
      console.log("[DEBUG] init: startFrameLoop completed");
      exposeVersion();
      console.log("[DEBUG] init: exposeVersion completed");
      GameAppGlobal._initialized = true;
      console.log("[DEBUG] init: _initialized set to true");
    } else if (!elements.setupLevelSelect) {
      console.log("[DEBUG] init: Already initialized but missing setupLevelSelect, calling cacheDom");
      cacheDom();
    }

    refreshLevelSelect();
    console.log("[DEBUG] init: refreshLevelSelect completed");
    updateHudIdle();
    console.log("[DEBUG] init: updateHudIdle completed");
    showSetupScreen();
    console.log("[DEBUG] init: showSetupScreen completed");
    global.GameTests?.runGameTests?.();
    console.log("[DEBUG] init: Initialization complete");
  }

  GameAppGlobal.init = init;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      GameAppGlobal.init();
    });
  } else {
    GameAppGlobal.init();
  }
})(typeof window !== "undefined" ? window : this);
