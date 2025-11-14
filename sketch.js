// === Interactive Wallpaper Evolution UI ===
let pool = []; // main list of all patterns
let gen = 0;

const SAVE_PREVIEW_SIZE = 420;
let saveButton = null;
let saveButtonOriginalLabel = null;
let saveFeedbackEl = null;
let saveFeedbackTimer = null;
let saveTargetLabelEl = null;
let saveTarget = null;

// Visible version tag for easy cache-busting verification
const APP_VERSION = "v1.0.4";

// Parent selection + control panel state
let selectedParents = []; // array of genomes currently selected (max 4)
let pendingPreview = null; // { action, label, items: [{ genome, parents }], index }

function wireSaveButton() {
  if (typeof document === "undefined") return;
  const button = document.getElementById("save-pattern");
  const feedback = document.getElementById("save-feedback");
  const targetLabel = document.getElementById("save-target-label");
  if (!button) return;
  if (saveButton) return; // already wired
  saveButton = button;
  saveButtonOriginalLabel = button.textContent;
  saveFeedbackEl = feedback;
  saveTargetLabelEl = targetLabel;
  updateSaveTargetLabel();
  saveButton.addEventListener("click", handleSavePatternClick);
}

function handleSavePatternClick() {
  if (!window.PatternStorage) {
    showSaveFeedback("error", "Storage unavailable in this browser.");
    return;
  }

  const genome = resolveGenomeForSave();
  if (!genome) {
    showSaveFeedback("error", "No pattern ready to save yet.");
    return;
  }

  setSaveBusy(true);

  try {
    const { cleanGenome, meta } = normalizeGenomeForSave(genome);
    const preview = renderGenomePreview(cleanGenome);
    const now = new Date();
    const { persistPattern, formatTimestamp } = window.PatternStorage;
    const timestampIso = now.toISOString();
    const timestampLabel = typeof formatTimestamp === "function"
      ? formatTimestamp(now)
      : timestampIso.replace(/[:T]/g, "-").slice(0, 19);
    const name = `Pattern ${timestampLabel}`;

    const record = {
      name,
      timestamp: timestampIso,
      genome: cleanGenome,
      preview,
      meta: {
        ...meta,
        savedAtMs: now.getTime(),
        summary: typeof genomeSummary === "function" ? genomeSummary(cleanGenome) : null,
        generation: gen,
      },
    };

    const saved = persistPattern(record);
    showSaveFeedback("success", `${name} saved to gallery.`);
    notifyParentOfSave({ name, timestamp: timestampIso, total: saved?.length || 0 });
  } catch (error) {
    console.error("[PatternSave] Save failed", error);
    showSaveFeedback("error", "Couldn't save pattern. Check console for details.");
  } finally {
    setSaveBusy(false);
  }
}

function resolveGenomeForSave() {
  if (saveTarget && pool.includes(saveTarget)) return saveTarget;
  if (hoverPreview?.genome) return hoverPreview.genome;
  if (selectedParents.length > 0) return selectedParents[selectedParents.length - 1];
  if (pool.length > 0) return pool[pool.length - 1];
  return null;
}

function normalizeGenomeForSave(genome) {
  const clone = cloneGenome(genome);
  const meta = {};
  if (typeof clone.id !== "undefined") {
    meta.sourcePoolId = clone.id;
    delete clone.id;
  }
  if (typeof clone.createdAt !== "undefined") {
    meta.createdAt = clone.createdAt;
    delete clone.createdAt;
  }
  if (typeof clone.selectCount !== "undefined") {
    meta.selectCount = clone.selectCount;
    delete clone.selectCount;
  }
  ensureGenomeColors(clone);
  return { cleanGenome: clone, meta };
}

function cloneGenome(genome) {
  if (Array.isArray(genome)) {
    return genome.map((value) => (value && typeof value === "object") ? cloneGenome(value) : value);
  }
  if (typeof structuredClone === "function") {
    return structuredClone(genome);
  }
  try {
    return JSON.parse(JSON.stringify(genome));
  } catch (error) {
    const clone = {};
    for (const key in genome) {
      const value = genome[key];
      clone[key] = value && typeof value === "object" ? cloneGenome(value) : value;
    }
    return clone;
  }
}

function renderGenomePreview(genome, size = SAVE_PREVIEW_SIZE) {
  function drawQuadrant(g, x, y, w, h, isSelected = false, idx = 0, isSaveTargetTile = false) {
    let pg = createGraphics(w, h);
    pg.background(240);
    pg.translate(w / 2, h / 2);
    const baseScale = displayScaleForPattern ? displayScaleForPattern(g, w, h, 3) : 1;
    if (baseScale !== 1) pg.scale(baseScale);
    drawWallpaperOn(pg, g);
    image(pg, x, y);

    if (isSelected) {
      push();
      noStroke();
      fill(46, 204, 113, 120);
      rect(x + 4, y + 4, w - 8, h - 8, 4);
      pop();
    }

    if (isSaveTargetTile) {
      push();
      noFill();
      stroke('#ffd166');
      strokeWeight(6);
      rect(x + 3, y + 3, w - 6, h - 6, 6);
      stroke('#ffad46');
      strokeWeight(2);
      rect(x + 8, y + 8, w - 16, h - 16, 6);
      pop();
    }

    // Border
    stroke(0);
    strokeWeight(4);
    noFill();
    if (typeof pg.remove === "function") pg.remove();
  }

  const pg = createGraphics(size, size);
  pg.pixelDensity(1);
  pg.background(240);
  pg.translate(size / 2, size / 2);
  const scale = typeof displayScaleForPattern === "function"
    ? displayScaleForPattern(genome, size, size, 2.6)
    : 1;
  if (scale !== 1) pg.scale(scale);
  drawWallpaperOn(pg, genome);
  const canvasEl = pg.canvas || pg.elt;
  const dataUrl = typeof canvasEl?.toDataURL === "function" ? canvasEl.toDataURL("image/png", 0.92) : null;
  if (typeof pg.remove === "function") pg.remove();
  return dataUrl;
}

function setSaveBusy(isBusy) {
  if (!saveButton) return;
  saveButton.disabled = isBusy;
  saveButton.setAttribute("aria-busy", isBusy ? "true" : "false");
  if (saveButtonOriginalLabel) {
    saveButton.textContent = isBusy ? "Saving…" : saveButtonOriginalLabel;
  }
}

function showSaveFeedback(type, message) {
  if (!saveFeedbackEl) return;
  saveFeedbackEl.textContent = message;
  saveFeedbackEl.classList.remove("hidden", "success", "error", "info");
  if (type === "success") saveFeedbackEl.classList.add("success");
  else if (type === "error") saveFeedbackEl.classList.add("error");
  else saveFeedbackEl.classList.add("info");
  clearTimeout(saveFeedbackTimer);
  saveFeedbackTimer = setTimeout(() => {
    saveFeedbackEl.classList.add("hidden");
  }, type === "success" ? 3200 : 5000);
}

function notifyParentOfSave(payload) {
  if (typeof window === "undefined") return;
  if (!window.parent || window.parent === window) return;
  try {
    window.parent.postMessage({ type: "pattern:saved", payload }, "*");
  } catch (error) {
    console.warn("[PatternSave] postMessage failed", error);
  }
}

function setSaveTarget(genome, { redraw = true } = {}) {
  if (!genome) {
    saveTarget = null;
    updateSaveTargetLabel();
    if (redraw) drawScreen();
    return;
  }
  if (!pool.includes(genome)) return;
  saveTarget = genome;
  updateSaveTargetLabel(genome);
  if (redraw) drawScreen();
}

function updateSaveTargetLabel(genome) {
  if (!saveTargetLabelEl) return;
  const activeGenome = genome || (pool.includes(saveTarget) ? saveTarget : null);
  saveTargetLabelEl.classList.remove("inactive");
  if (!activeGenome) {
    if (pool.length) {
      saveTargetLabelEl.textContent = "Defaulting to the most recent tile.";
    } else {
      saveTargetLabelEl.textContent = "No tiles available to save yet.";
      saveTargetLabelEl.classList.add("inactive");
    }
    return;
  }
  const idx = pool.indexOf(genome || saveTarget);
  if (idx >= 0) {
    saveTargetLabelEl.textContent = `Saving tile #${idx + 1} (latest selection).`;
  } else {
    saveTargetLabelEl.textContent = "Selected tile no longer available.";
  }
}

function ensureSaveTargetValidity({ redraw = false } = {}) {
  if (saveTarget && pool.includes(saveTarget)) {
    updateSaveTargetLabel(saveTarget);
    if (redraw) drawScreen();
    return;
  }
  if (pool.length) {
    setSaveTarget(pool[pool.length - 1], { redraw });
  } else {
    setSaveTarget(null, { redraw });
  }
}

function ensureSaveTargetValidity({ redraw = false } = {}) {
  if (saveTarget && pool.includes(saveTarget)) {
    updateSaveTargetLabel(saveTarget);
    if (redraw) drawScreen();
    return;
  }
  if (pool.length) {
    setSaveTarget(pool[pool.length - 1], { redraw });
  } else {
    setSaveTarget(null, { redraw });
  }
}

function setHoverPreviewTarget(target) {
  if (hoverPreviewTimer) {
    clearTimeout(hoverPreviewTimer);
    hoverPreviewTimer = null;
  }

  const targetChanged = !hoverPreviewTarget || hoverPreviewTarget.idx !== (target && target.idx);
  hoverPreviewTarget = target;

  if (!target) {
    if (hoverPreview) {
      hoverPreview = null;
      drawScreen();
    }
    return;
  }

  hoverPreviewTimer = setTimeout(() => {
    if (hoverPreviewTarget && target && hoverPreviewTarget.idx === target.idx) {
      hoverPreview = target;
      drawScreen();
    }
  }, HOVER_PREVIEW_DELAY);

  if (targetChanged && hoverPreview) {
    hoverPreview = null;
    drawScreen();
  }
}

function clearHoverPreview() {
  if (hoverPreviewTimer) {
    clearTimeout(hoverPreviewTimer);
    hoverPreviewTimer = null;
  }
  hoverPreviewTarget = null;
  if (hoverPreview) {
    hoverPreview = null;
    drawScreen();
  }
}

// Pool viewport scrolling state
let poolScroll = 0;
let poolScrollDragging = false;
let poolScrollDragOffset = 0;

// Layout caches
let wq, hq;
let thumbH = 100;

let hoverPreview = null; // { genome, idx }
let hoverPreviewTimer = null;
let hoverPreviewTarget = null;

// Grid and layout constants
const GRID_COLS = 6;
const GRID_ROWS = 5;
const HEADER_H = 48; // title bar height
const PANEL_H = 72;  // control panel height

const HOVER_PREVIEW_DELAY = 500; // ms

let showSymmetryGuides = false;

const ACTION_LABELS = {
  create: "Create",
  mutate: "Mutate",
  blend: "Blend",
};

function setup() {
  createCanvas(1000, 1300); // Increased height further to accommodate larger control panel
  angleMode(RADIANS);
  noLoop();
  // Also show version in browser tab
  if (typeof document !== 'undefined') {
    document.title = `Pattern Evolution ${APP_VERSION}`;
  }

  wq = width / 2;
  hq = (height * 0.7) / 2;

  // Prime pool with 6 random patterns
  for (let i = 0; i < 6; i++) pool.push(withMeta(randomGenome()));
  if (pool.length) setSaveTarget(pool[pool.length - 1], { redraw: false });
  drawScreen();
  wireSaveButton();
}

function latestPoolEntries(limit = 1) {
  const results = [];
  const seen = new Set();
  for (let i = pool.length - 1; i >= 0 && results.length < limit; i--) {
    const genome = pool[i];
    if (genome && !seen.has(genome)) {
      results.push(genome);
      seen.add(genome);
    }
  }
  return results;
}

function resolveMutateTargets() {
  if (selectedParents.length > 0) return [...selectedParents];
  if (saveTarget && pool.includes(saveTarget)) return [saveTarget];
  const latest = latestPoolEntries(1);
  return latest.length ? latest : [];
}

function resolveBlendTargets() {
  if (selectedParents.length >= 2) return [...selectedParents];

  const seeds = selectedParents.length === 1 ? [...selectedParents] : [];
  const seen = new Set(seeds);

  const latest = latestPoolEntries(3);
  for (const genome of latest) {
    if (!seen.has(genome)) {
      seeds.push(genome);
      seen.add(genome);
    }
    if (seeds.length >= 2) break;
  }
  return seeds.length >= 2 ? seeds : [];
}

function handleAction(action) {
  if (!isActionEnabled(action)) return;

  const items = [];

  switch (action) {
    case "create": {
      const genome = randomGenome();
      if (typeof selectedGroupFilter !== "undefined" && selectedGroupFilter !== "Any") {
        genome.group = selectedGroupFilter;
      }
      items.push({ genome: withMeta(genome), parents: [] });
      break;
    }
    case "mutate": {
      const targets = resolveMutateTargets();
      if (!targets.length) break;
      const rate = mutationSlider.current();
      if (targets.length === 1) {
        const child = withMeta(mutateGenome(targets[0], rate));
        items.push({ genome: child, parents: [targets[0]] });
      } else {
        const child = withMeta(mixGenomes(targets, {
          method: "average",
          mutationRate: rate,
          paletteOverride: -1,
        }));
        items.push({ genome: child, parents: targets });
      }
      break;
    }
    case "blend": {
      const targets = resolveBlendTargets();
      if (targets.length < 2) break;
      const rate = mutationSlider.current();
      const child = withMeta(mixGenomes(targets, {
        method: "random-trait",
        mutationRate: rate,
        paletteOverride: -1,
      }));
      items.push({ genome: child, parents: targets });
      break;
    }
    default:
      return;
  }

  if (items.length === 0) return;

  pendingPreview = {
    action,
    label: ACTION_LABELS[action] || action,
    items,
    index: 0,
  };
  drawScreen();
}

function keyPressed() {
  if (keyCode === DELETE || keyCode === BACKSPACE) {
    removeSelectedFromPool();
    return;
  }
  if (key === "m" || key === "M") {
    showSymmetryGuides = !showSymmetryGuides;
    drawScreen();
    return;
  }
  if (previewActive()) {
    if (key === " ") {
      acceptPreview();
      return;
    }
    const nextAction = keyToAction(key);
    const shouldRedraw = discardPreview(false);
    if (nextAction) handleAction(nextAction);
    else if (shouldRedraw) drawScreen();
    return;
  }

  const action = keyToAction(key);
  if (action) handleAction(action);
}

function previewActive() {
  return pendingPreview && pendingPreview.items && pendingPreview.index < pendingPreview.items.length;
}

function currentPreviewItem() {
  if (!previewActive()) return null;
  return pendingPreview.items[pendingPreview.index];
}

function acceptPreview() {
  if (!previewActive()) return;
  const item = pendingPreview.items[pendingPreview.index];
  pool.push(item.genome);
  setSaveTarget(item.genome, { redraw: false });

  if (item.parents && item.parents.length > 0) {
    const seen = new Set();
    for (const parent of item.parents) {
      if (parent && !seen.has(parent)) {
        parent.selectCount = (parent.selectCount || 0) + 1;
        seen.add(parent);
      }
    }
  }

  if (typeof scrollPoolToLatest === "function") {
    scrollPoolToLatest();
  }

  pendingPreview.index++;
  if (!previewActive()) {
    pendingPreview = null;
    gen++;
  }
  drawScreen();
}

function discardPreview(redraw = true) {
  if (!previewActive()) return false;
  pendingPreview = null;
  if (redraw) drawScreen();
  return true;
}

function keyToAction(k) {
  if (!k) return null;
  const lower = k.toLowerCase();
  if (lower === "r" || lower === "c") return "create";
  if (lower === "m") return "mutate";
  if (lower === "b") return "blend";
  return null;
}

function isActionEnabled(action) {
  switch (action) {
    case "create":
      return true;
    case "mutate":
      return resolveMutateTargets().length > 0;
    case "blend":
      return resolveBlendTargets().length >= 2;
    default:
      return false;
  }
}

function clearSelectedParents() {
  if (!selectedParents.length) return;
  selectedParents = [];
  drawScreen();
}

function removeSelectedFromPool() {
  if (!selectedParents.length) return;
  let removed = false;
  for (const parent of [...selectedParents]) {
    const idx = pool.indexOf(parent);
    if (idx >= 0) {
      pool.splice(idx, 1);
      removed = true;
    }
  }
  if (!removed) return;
  selectedParents = selectedParents.filter((p) => pool.includes(p));
  ensureSaveTargetValidity({ redraw: false });
  drawScreen();
}
