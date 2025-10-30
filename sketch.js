// === Interactive Wallpaper Evolution UI ===

let palettes;
let pool = []; // main list of all patterns
let gen = 0;

// Visible version tag for easy cache-busting verification
const APP_VERSION = "v1.0.4";

// Parent selection + control panel state
let selectedParents = []; // array of genomes currently selected (max 4)
let pendingPreview = null; // { action, label, items: [{ genome, parents }], index }

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

const ACTION_LABELS = {
  random: "Random",
  clone: "Clone",
  average: "Average",
  select: "Select",
  delete: "Delete",
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

  palettes = {
    warm: ["#e63946", "#f1faee", "#a8dadc", "#ffbe0b", "#fb5607"],
    cool: ["#457b9d", "#1d3557", "#a8dadc", "#118ab2", "#06d6a0"],
    earth: ["#2a9d8f", "#e9c46a", "#f4a261", "#264653", "#dda15e"],
    vivid: ["#ffb703", "#fb8500", "#023047", "#8ecae6", "#219ebc"]
  };

  // Prime pool with 6 random patterns
  for (let i = 0; i < 6; i++) pool.push(withMeta(randomGenome()));
  drawScreen();
}

function handleAction(action) {
  if (!isActionEnabled(action)) return;

  const parents = [...selectedParents];
  const items = [];

  switch (action) {
    case "random": {
      const genome = randomGenome();
      // Apply group filter if one is selected
      if (typeof selectedGroupFilter !== "undefined" && selectedGroupFilter !== "Any") {
        genome.group = selectedGroupFilter;
      }
      items.push({ genome: withMeta(genome), parents: [] });
      break;
    }
    case "clone": {
      const rate = mutationSlider.current();
      for (const parent of parents) {
        const clone = withMeta(mutateGenome(parent, rate));
        items.push({ genome: clone, parents: [parent] });
      }
      break;
    }
    case "average": {
      const rate = mutationSlider.current();
      const child = withMeta(mixGenomes(parents, {
        method: "average",
        mutationRate: rate,
        paletteOverride: -1,
      }));
      items.push({ genome: child, parents });
      break;
    }
    case "select": {
      const rate = mutationSlider.current();
      const child = withMeta(mixGenomes(parents, {
        method: "random-trait",
        mutationRate: rate,
        paletteOverride: -1,
      }));
      items.push({ genome: child, parents });
      break;
    }
    case "delete": {
      let removed = false;
      for (const parent of parents) {
        const idx = pool.indexOf(parent);
        if (idx >= 0) {
          pool.splice(idx, 1);
          removed = true;
        }
      }
      if (removed) {
        selectedParents = selectedParents.filter(p => pool.includes(p));
        drawScreen();
      }
      return;
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
  if (lower === "r") return "random";
  if (lower === "c") return "clone";
  if (lower === "a") return "average";
  if (lower === "s") return "select";
  if (lower === "d") return "delete";
  return null;
}

function isActionEnabled(action) {
  switch (action) {
    case "random":
      return true;
    case "clone":
      return selectedParents.length > 0;
    case "average":
      return selectedParents.length >= 2;
    case "select":
      return selectedParents.length > 0;
    case "delete":
      return selectedParents.length > 0;
    default:
      return false;
  }
}
