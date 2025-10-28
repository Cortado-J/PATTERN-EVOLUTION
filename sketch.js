// === Interactive Wallpaper Evolution UI ===

let population = []; // deprecated: no longer used for display
let palettes;
let pool = []; // main list of all patterns
let gen = 0;

// Visible version tag for easy cache-busting verification
const APP_VERSION = "v1.0.4";

// Parent selection + control panel state
let selectedParents = []; // array of genomes currently selected (max 4)
let mutationRate = 0.25; // 0..1
let combineMethod = "random-trait"; // "random-trait" | "average"
let paletteOverride = -1; // -1 means mixed; otherwise index into selectedParents

// Layout caches
let wq, hq;
let thumbH = 100;

// Grid and layout constants
const GRID_COLS = 8;
const GRID_ROWS = 6; // changed from 8 to 6
const HEADER_H = 48; // title bar height
const PANEL_H = 80;  // control panel height

// Modal offspring preview
// Generate mode (live preview panel)
let generateMode = false;
let liveOffspring = null; // array of 4 genomes
let liveOffspringSelected = [false, false, false, false];

function panelHeight() {
  return generateMode ? 180 : 80;
}

// UI hit regions (computed each frame)
let uiRegions = {
  genBtn: null,
  rateMinus: null,
  ratePlus: null,
  methodRandom: null,
  methodAverage: null,
  paletteCycle: null,
};

let nextId = 1;

function withMeta(g) {
  g.id = nextId++;
  g.createdAt = Date.now();
  g.selectCount = 0;
  return g;
}

function setup() {
  createCanvas(1000, 1000);
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

  // Prime pool with 10 random patterns
  for (let i = 0; i < 10; i++) pool.push(withMeta(randomGenome()));
  drawScreen();
}

// === genome creation ===
function randomGenome() {
  const groups = ["632", "442", "333", "2222"];
  const paletteKeys = Object.keys(palettes);
  let numShapes = floor(random(3, 6));
  let shapes = [];
  for (let i = 0; i < numShapes; i++) {
    shapes.push({
      type: random(["petal", "leaf", "blade", "drop", "arc"]),
      curveBias: random(0.2, 0.8),
      fatness: random(0.3, 1.0)
    });
  }
  return {
    group: random(groups),
    palette: random(paletteKeys),
    motifScale: random(60, 120),
    rotation: random(TWO_PI),
    hueShift: random(-20, 20),
    numShapes,
    shapes
  };
}

// === evolution functions ===
function mutateGenome(g, rate = 0.25) {
  // rate in [0,1], scaling mutation intensity and probability
  let m = structuredClone(g);
  m.hueShift += random(-10, 10) * rate;
  // scale multiplicative change towards 1 by rate
  let scaleJitter = lerp(1, random(0.8, 1.3), rate);
  m.motifScale = constrain(m.motifScale * scaleJitter, 20, 200);
  if (random() < 0.3 * rate) m.palette = random(Object.keys(palettes));
  if (random() < 0.3 * rate) m.group = random(["632", "442", "333", "2222"]);
  for (let s of m.shapes) {
    if (random() < 0.5) {
      s.fatness = constrain(s.fatness + random(-0.1, 0.1) * rate, 0.1, 2);
      s.curveBias = constrain((s.curveBias ?? 0.5) + random(-0.1, 0.1) * rate, 0, 1);
    }
  }
  m.numShapes = m.shapes.length;
  return m;
}

function combineGenomes(a, b) {
  // Legacy 2-parent combine retained for history thumbnails or fallback
  return mixGenomes([a, b], { method: "random-trait", mutationRate: 0.1, paletteOverride: -1 });
}

function mixGenomes(parents, options) {
  const { method = "random-trait", mutationRate: mut = 0.1, paletteOverride: palIdx = -1 } = options || {};
  const p = parents.filter(Boolean);
  if (p.length === 0) return randomGenome();
  if (p.length === 1) return mutateGenome(p[0], mut);

  // Start from a random parent's clone
  let c = structuredClone(random(p));

  // Helpers
  const pickParent = () => random(p);
  const majority = (arr) => {
    const counts = {};
    let best = arr[0], maxC = 0;
    for (const v of arr) {
      counts[v] = (counts[v] || 0) + 1;
      if (counts[v] > maxC) { maxC = counts[v]; best = v; }
    }
    return best;
  };

  // Palette
  if (palIdx >= 0 && palIdx < p.length) c.palette = p[palIdx].palette;
  else c.palette = method === "average" ? majority(p.map(x => x.palette)) : pickParent().palette;

  // Group
  c.group = method === "average" ? majority(p.map(x => x.group)) : pickParent().group;

  // Numeric traits
  if (method === "average") {
    c.hueShift = p.map(x => x.hueShift).reduce((a, b) => a + b, 0) / p.length;
    let ms = p.map(x => x.motifScale).reduce((a, b) => a + b, 0) / p.length;
    c.motifScale = constrain(ms, 20, 200);
    // rotation average naive
    c.rotation = (p.map(x => x.rotation).reduce((a, b) => a + b, 0) / p.length) % TWO_PI;
  } else {
    const pr = pickParent();
    c.hueShift = pr.hueShift;
    c.motifScale = pr.motifScale;
    c.rotation = pr.rotation;
  }

  // Shapes
  let targetN = method === "average"
    ? round(p.map(x => x.shapes.length).reduce((a, b) => a + b, 0) / p.length)
    : pickParent().shapes.length;
  targetN = constrain(targetN, 1, 8);
  c.shapes = [];
  for (let i = 0; i < targetN; i++) {
    // Try to assemble shapes using i-th shape from random parent (if it exists), else random shape from a parent
    let src = pickParent();
    let base = src.shapes[i] || random(src.shapes);
    let shp = structuredClone(base);
    if (method === "average") {
      // average comparable shapes at index i where available
      let pool = p.map(pp => pp.shapes[i]).filter(Boolean);
      if (pool.length > 1) {
        // type: majority vote
        const t = majority(pool.map(s => s.type));
        const fb = pool.map(s => s.fatness ?? 0.5).reduce((a, b) => a + b, 0) / pool.length;
        const cb = pool.map(s => s.curveBias ?? 0.5).reduce((a, b) => a + b, 0) / pool.length;
        shp.type = t;
        shp.fatness = fb;
        shp.curveBias = cb;
      }
    }
    c.shapes.push(shp);
  }
  c.numShapes = c.shapes.length;

  // Light mutation to bring variation
  c = mutateGenome(c, mut);
  return c;
}

// === draw ===
function drawScreen() {
  background(245);
  drawTitle();
  drawPoolGrid();
  drawControls();
  
  // Draw live previews in Generate mode
  if (generateMode && liveOffspring) {
    const previewY = height - panelHeight() + 60;
    const previewW = width / 4;
    const previewH = 100;
    
    // Draw previews
    for (let i = 0; i < 4; i++) {
      if (!liveOffspring[i]) continue;
      
      const px = i * previewW;
      const py = previewY;
      
      // Draw selection highlight
      if (liveOffspringSelected[i]) {
        fill(100, 200, 100, 100);
        noStroke();
        rect(px, py, previewW, previewH);
      }
      
      // Draw pattern preview
      const pg = createGraphics(100, 100);
      drawWallpaperOn(pg, liveOffspring[i]);
      image(pg, px + 10, py + 10, 80, 80);
      
      // Draw border and selection indicator
      noFill();
      stroke(0);
      rect(px, py, previewW, previewH);
      
      // Store hit region
      if (!uiRegions.liveOffspring) uiRegions.liveOffspring = [];
      uiRegions.liveOffspring[i] = { x: px, y: py, w: previewW, h: previewH };
    }
  }
}

function drawPoolGrid() {
  const cols = GRID_COLS;
  const rows = GRID_ROWS;
  const cellW = width / cols;
  const gridH = height - HEADER_H - panelHeight();
  const cellH = gridH / rows;
  for (let i = 0; i < min(pool.length, cols * rows); i++) {
    const r = floor(i / cols);
    const c = i % cols;
    const x = c * cellW;
    const y = HEADER_H + r * cellH;
    const g = pool[i];
    const isSel = selectedParents.includes(g);
    drawQuadrant(g, x, y, cellW, cellH, isSel, i);
  }
}

function drawQuadrant(g, x, y, w, h, isSelected = false, idx = 0) {
  let pg = createGraphics(w, h);
  pg.background(240);
  pg.translate(w / 2, h / 2);
  drawWallpaperOn(pg, g);
  image(pg, x, y);
  
  // Border
  stroke(0);
  strokeWeight(4);
  noFill();
  rect(x, y, w, h);

  // Selection UI only when in generate mode
  if (generateMode) {
    // Selected marker: green inset border and checkbox (match dialog style)
    if (isSelected) {
      stroke("#2ecc71");
      strokeWeight(4);
      noFill();
      rect(x + 3, y + 3, w - 6, h - 6, 6);
    }
    // Checkbox indicator in top-right
    const pad = 6;
    const cb = max(14, min(w, h) * 0.12);
    noStroke();
    fill(isSelected ? "#2ecc71" : 255);
    rect(x + w - pad - cb, y + pad, cb, cb, 4);
    stroke(0); noFill();
    rect(x + w - pad - cb, y + pad, cb, cb, 4);
  }

  fill(0);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(18);
  text(g.group, x + w / 2, y + 16);
}

// drawHistory removed in favor of full grid

function drawControls() {
  // Bottom control panel
  const h = panelHeight();
  const y = height - h;
  // Panel background
  noStroke();
  fill(255);
  rect(0, y, width, h);
  stroke(0);
  noFill();
  rect(0, y, width, h);
  // Generate mode toggle (visible always)
  const toggleW = 150, toggleH = 28, tX = width - 16 - toggleW, tY = y + 12;
  uiRegions.genModeToggle = { x: tX, y: tY, w: toggleW, h: toggleH };
  stroke(0); fill(generateMode ? "#ffb703" : 255); rect(tX, tY, toggleW, toggleH, 6);
  noStroke(); fill(0); textAlign(CENTER, CENTER); textSize(14); text("Generate Mode", tX + toggleW / 2, tY + toggleH / 2);

  // If not in generate mode, show only the toggle and exit
  if (!generateMode) {
    uiRegions.genBtn = null;
    uiRegions.liveOffspring = null;
    uiRegions.rateMinus = null;
    uiRegions.ratePlus = null;
    uiRegions.methodRandom = null;
    uiRegions.methodAverage = null;
    uiRegions.paletteCycle = null;
    return;
  }

  // In generate mode, show full controls and live previews
  // Selected count
  noStroke();
  fill(0);
  textAlign(LEFT, CENTER);
  textSize(16);
  text(`Selected parents: ${selectedParents.length}/4`, 12, y + 20);

  // Mutation rate controls
  const rateX = 12, rateY = y + 50;
  textAlign(LEFT, CENTER);
  textSize(14);
  text(`Mutation: ${(mutationRate * 100).toFixed(0)}%`, rateX, rateY);
  // - button
  uiRegions.rateMinus = { x: rateX + 110, y: rateY - 12, w: 24, h: 24 };
  uiRegions.ratePlus = { x: rateX + 140, y: rateY - 12, w: 24, h: 24 };
  stroke(0); noFill(); rect(uiRegions.rateMinus.x, uiRegions.rateMinus.y, 24, 24); rect(uiRegions.ratePlus.x, uiRegions.ratePlus.y, 24, 24);
  noStroke(); fill(0); textAlign(CENTER, CENTER); text("-", uiRegions.rateMinus.x + 12, uiRegions.rateMinus.y + 12); text("+", uiRegions.ratePlus.x + 12, uiRegions.ratePlus.y + 12);

  // Method toggles (visible only when 2+ parents selected)
  const parentCount = selectedParents.length;
  const mBaseX = width / 2 - 200, mY = y + 20, mW = 130, mH = 28;
  function drawToggle(r, label, active) {
    stroke(0); fill(active ? "#ffb703" : 255); rect(r.x, r.y, r.w, r.h, 6);
    noStroke(); fill(0); textAlign(CENTER, CENTER); textSize(14); text(label, r.x + r.w / 2, r.y + r.h / 2);
  }
  uiRegions.methodRandom = null;
  uiRegions.methodAverage = null;
  let modeDescriptor = "";
  if (parentCount === 0) modeDescriptor = "Random";
  else if (parentCount === 1) modeDescriptor = "Clone";
  else modeDescriptor = "Combine";
  // Descriptor text
  noStroke(); fill(0); textAlign(LEFT, CENTER); textSize(14);
  text(`Mode: ${modeDescriptor}`, mBaseX, mY - 14);
  if (parentCount >= 2) {
    uiRegions.methodRandom = { x: mBaseX, y: mY, w: mW, h: mH };
    uiRegions.methodAverage = { x: mBaseX + mW + 12, y: mY, w: mW, h: mH };
    drawToggle(uiRegions.methodRandom, "Mix", combineMethod === "random-trait");
    drawToggle(uiRegions.methodAverage, "Average", combineMethod === "average");
  }

  // Palette override cycle
  const palX = width / 2 - 200, palY = y + 50, palW = 240, palH = 24;
  uiRegions.paletteCycle = { x: palX, y: palY, w: palW, h: palH };
  stroke(0); fill(255); rect(palX, palY, palW, palH, 6);
  noStroke(); fill(0); textAlign(CENTER, CENTER); textSize(13);
  let palLabel = "Palette: Mix";
  if (paletteOverride >= 0 && paletteOverride < selectedParents.length) palLabel = `Palette: P${paletteOverride + 1}`;
  text(palLabel, palX + palW / 2, palY + palH / 2);

  // Show Send to Pool button only if at least one child is selected
  const anySelected = liveOffspringSelected.some(x => x);
  if (anySelected) {
    const gW = 180, gH = 40, gX = width - gW - 16, gY = y + h - gH - 12;
    uiRegions.genBtn = { x: gX, y: gY, w: gW, h: gH };
    stroke(0); fill("#06d6a0"); rect(gX, gY, gW, gH, 6);
    noStroke(); fill(255); textAlign(CENTER, CENTER); textSize(18); text("Send to Pool", gX + gW / 2, gY + gH / 2);
    // Generation counter
    fill(0); noStroke(); textAlign(RIGHT, CENTER); textSize(14);
    text(`Gen ${gen}`, gX - 10, gY + gH / 2);
  } else {
    uiRegions.genBtn = null;
  }

  // Live offspring previews (always show in generate mode)
  if (!liveOffspring || liveOffspring.length !== 4) {
    liveOffspring = buildOffspringPreview();
    liveOffspringSelected = [false, false, false, false];
  }
  if (liveOffspring && liveOffspring.length === 4) {
    const pad = 12;
    const pw = (width - 5 * pad) / 4;
    const ph = h - 80; // space after controls
    const py = y + 72;
    uiRegions.liveOffspring = [];
    for (let i = 0; i < 4; i++) {
      const px = pad + i * (pw + pad);
      const pg = createGraphics(pw, ph);
      pg.background(240);
      pg.translate(pg.width / 2, pg.height / 2);
      pg.scale(0.5);
      drawWallpaperOn(pg, liveOffspring[i]);
      image(pg, px, py);
      // border
      stroke(0); noFill(); rect(px, py, pw, ph, 6);
      if (liveOffspringSelected[i]) {
        stroke("#2ecc71"); strokeWeight(3); rect(px + 3, py + 3, pw - 6, ph - 6, 6); strokeWeight(1);
      }
      // checkbox
      const cb = 18;
      noStroke(); fill(liveOffspringSelected[i] ? "#2ecc71" : 255);
      rect(px + pw - cb - 6, py + 6, cb, cb, 4);
      stroke(0); noFill(); rect(px + pw - cb - 6, py + 6, cb, cb, 4);
      uiRegions.liveOffspring[i] = { x: px, y: py, w: pw, h: ph };
    }
  }
}

function buildOffspringPreview() {
  let children = [];
  if (selectedParents.length === 0) {
    for (let i = 0; i < 4; i++) children.push(randomGenome());
  } else if (selectedParents.length === 1) {
    for (let i = 0; i < 4; i++) children.push(mutateGenome(selectedParents[0], mutationRate));
  } else {
    for (let i = 0; i < 4; i++) {
      children.push(
        mixGenomes(selectedParents, {
          method: combineMethod,
          mutationRate: mutationRate * 0.5,
          paletteOverride: paletteOverride,
        })
      );
    }
  }
  return children;
}

function sendLiveOffspringToPool() {
  let added = 0;
  for (let i = 0; i < 4; i++) {
    if (liveOffspringSelected[i] && liveOffspring && liveOffspring[i]) {
      pool.push(withMeta(liveOffspring[i]));
      added++;
    }
  }
  if (added > 0) {
    for (const p of selectedParents) p.selectCount = (p.selectCount || 0) + 1;
    enforceCapacity(GRID_COLS * GRID_ROWS, selectedParents);
    gen++;
    
    // Show feedback
    console.log(`Added ${added} patterns to the pool`);
    
    // Keep the same parents but generate new previews
    liveOffspring = buildOffspringPreview();
    liveOffspringSelected = [false, false, false, false];
  } else {
    // If nothing was selected, just generate new previews
    liveOffspring = buildOffspringPreview();
    liveOffspringSelected = [false, false, false, false];
  }
}

function drawTitle() {
  // Title bar at the top
  noStroke();
  fill(255);
  rect(0, 0, width, HEADER_H);
  stroke(0);
  noFill();
  rect(0, 0, width, HEADER_H);
  noStroke();
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(22);
  text(`Pattern Evolution ${APP_VERSION}`, width / 2, HEADER_H / 2);
}

// modal flow removed in favor of live Generate mode

function enforceCapacity(capacity, preserveList = []) {
  if (pool.length <= capacity) return;
  const toRemove = pool.length - capacity;
  const preserve = new Set(preserveList);
  const candidates = pool.filter(g => !preserve.has(g));
  candidates.sort((a, b) => {
    const ca = (a.selectCount || 0) - (b.selectCount || 0);
    if (ca !== 0) return ca;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
  let removed = 0;
  for (let i = 0; i < candidates.length && removed < toRemove; i++) {
    const g = candidates[i];
    const idx = pool.indexOf(g);
    if (idx >= 0) { pool.splice(idx, 1); removed++; }
  }
  if (removed < toRemove) {
    pool.sort((a, b) => {
      const ca = (a.selectCount || 0) - (b.selectCount || 0);
      if (ca !== 0) return ca;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    pool.splice(0, toRemove - removed);
  }
}

function mousePressed() {
  // Check if we're in generate mode and clicking on save button
  if (generateMode && uiRegions.saveBtn && pointInRect(mouseX, mouseY, uiRegions.saveBtn)) {
    sendLiveOffspringToPool();
    return drawScreen();
  }
  
  // Controls panel hit-testing
  if (uiRegions.genModeToggle && pointInRect(mouseX, mouseY, uiRegions.genModeToggle)) {
    generateMode = !generateMode;
    // reset live previews when toggled on
    liveOffspring = null;
    liveOffspringSelected = [false, false, false, false];
    return drawScreen();
  }
  
  // Generate new previews button
  if (uiRegions.genBtn && pointInRect(mouseX, mouseY, uiRegions.genBtn)) {
    if (generateMode) {
      // Generate new previews
      liveOffspring = buildOffspringPreview();
      liveOffspringSelected = [false, false, false, false];
    } else {
      // Enter generate mode if not already
      generateMode = true;
      liveOffspring = null;
    }
    return drawScreen();
  }
  if (uiRegions.rateMinus && pointInRect(mouseX, mouseY, uiRegions.rateMinus)) {
    mutationRate = constrain(mutationRate - 0.05, 0, 1);
    if (generateMode) liveOffspring = null;
    return drawScreen();
  }
  if (uiRegions.ratePlus && pointInRect(mouseX, mouseY, uiRegions.ratePlus)) {
    mutationRate = constrain(mutationRate + 0.05, 0, 1);
    if (generateMode) liveOffspring = null;
    return drawScreen();
  }
  if (uiRegions.methodRandom && pointInRect(mouseX, mouseY, uiRegions.methodRandom)) {
    combineMethod = "random-trait";
    if (generateMode) liveOffspring = null;
    return drawScreen();
  }
  if (uiRegions.methodAverage && pointInRect(mouseX, mouseY, uiRegions.methodAverage)) {
    combineMethod = "average";
    if (generateMode) liveOffspring = null;
    return drawScreen();
  }
  if (uiRegions.paletteCycle && pointInRect(mouseX, mouseY, uiRegions.paletteCycle)) {
    if (selectedParents.length === 0) {
      paletteOverride = -1;
    } else {
      if (paletteOverride === -1) paletteOverride = 0;
      else if (paletteOverride < selectedParents.length - 1) paletteOverride++;
      else paletteOverride = -1; // cycle back to Mix
    }
    if (generateMode) liveOffspring = null;
    return drawScreen();
  }

  // Grid selection (only in generate mode)
  const cols = GRID_COLS;
  const rows = GRID_ROWS;
  if (mouseY >= HEADER_H && mouseY < height - panelHeight()) {
    const cellW = width / cols;
    const cellH = (height - HEADER_H - panelHeight()) / rows;
    const c = floor(mouseX / cellW);
    const r = floor((mouseY - HEADER_H) / cellH);
    const idx = r * cols + c;
    if (idx >= 0 && idx < pool.length) {
      if (generateMode) {
        toggleParentSelection(pool[idx]);
        // changing parents should rebuild previews
        liveOffspring = null;
      }
      return drawScreen();
    }
  }

  // Live preview selection (generate mode)
  if (generateMode && uiRegions.liveOffspring) {
    for (let i = 0; i < 4; i++) {
      const r = uiRegions.liveOffspring[i];
      if (r && pointInRect(mouseX, mouseY, r)) {
        liveOffspringSelected[i] = !liveOffspringSelected[i];
        return drawScreen();
      }
    }
  }
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function toggleParentSelection(g) {
  let i = selectedParents.indexOf(g);
  if (i >= 0) selectedParents.splice(i, 1);
  else if (selectedParents.length < 4) selectedParents.push(g);
}

// Generate 4 offspring based on current parent selection and settings
// generateOffspring removed (live preview replaces it)

// Preview flow removed in favor of immediate generation

// === wallpaper rendering ===
function drawWallpaperOn(pg, g) {
  let a = g.motifScale;
  let palette = palettes[g.palette];
  let lattice;
  if (g.group === "632")
    lattice = (i, j) => createVector(i * a * sqrt(3) + (j % 2) * a * sqrt(3) / 2, j * a * 1.5);
  if (g.group === "442")
    lattice = (i, j) => createVector(i * a, j * a);
  if (g.group === "333")
    lattice = (i, j) => createVector(i * a + (j % 2) * a / 2, j * a * sqrt(3) / 2);
  if (g.group === "2222")
    lattice = (i, j) => createVector(i * a, j * a * 0.6);

  let motif = createMotif(pg, g, a * 0.4, palette);
  let n = 4;
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      let p = lattice(i, j);
      pg.push();
      pg.translate(p.x, p.y);
      drawMotif(pg, motif);
      pg.pop();
    }
  }
}

// === motif & shapes ===
function createMotif(pg, g, s, palette) {
  let motif = [];
  let paletteSet = palettes[g.palette];

  // Deterministic color selection per genome to avoid re-render color changes
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5) | 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const seedBase = ((g.id || genomeHash(g)) ^ (g.createdAt || 0)) >>> 0;
  const rng = mulberry32(seedBase);

  colorMode(HSB, 360, 100, 100);
  let chosenCols = [];
  for (let i = 0; i < g.numShapes; i++) {
    // choose base palette index deterministically
    const baseIdx = floor(rng() * paletteSet.length) % paletteSet.length;
    let base = color(paletteSet[baseIdx]);
    let h = (hue(base) + g.hueShift + (rng() * 16 - 8)) % 360;
    let sat = constrain(saturation(base) + (rng() * 20 - 10), 40, 100);
    let bri = constrain(brightness(base) + (rng() * 20 - 10), 40, 100);
    chosenCols.push(color(h, sat, bri));
  }
  colorMode(RGB, 255);

  let n = { "632": 6, "442": 4, "333": 3, "2222": 2 }[g.group];
  for (let i = 0; i < g.numShapes; i++) {
    let shape = g.shapes[i];
    motif.push({
      type: shape.type,
      curveBias: shape.curveBias,
      fatness: shape.fatness,
      rotation: (TWO_PI / n) * i,
      colour: chosenCols[i % chosenCols.length]
    });
  }
  return motif;
}

function genomeHash(g) {
  // Simple non-cryptographic hash of salient genome parts for deterministic preview seeding
  const obj = {
    group: g.group,
    palette: g.palette,
    motifScale: Math.round(g.motifScale * 100) / 100,
    rotation: Math.round(((g.rotation || 0) % (Math.PI * 2)) * 1000) / 1000,
    hueShift: Math.round(g.hueShift * 10) / 10,
    shapes: (g.shapes || []).map(s => ({ t: s.type, cb: Math.round((s.curveBias || 0) * 100) / 100, f: Math.round((s.fatness || 0) * 100) / 100 }))
  };
  const str = JSON.stringify(obj);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function drawMotif(pg, motif) {
  for (let s of motif) {
    pg.push();
    pg.fill(s.colour);
    pg.rotate(s.rotation);
    drawShapeVariant(pg, s.type, 40, s.curveBias, s.fatness);
    pg.pop();
  }
}

function drawShapeVariant(pg, type, s, bias, fat) {
  pg.beginShape();
  switch (type) {
    case "petal":
      pg.vertex(0, 0);
      pg.bezierVertex(s * bias, -s * 0.3 * fat, s * 0.8, s * 0.2 * fat, s, 0);
      pg.bezierVertex(s * 0.5, s * 0.6 * fat, s * 0.2, s * 0.5 * fat, 0, s * 0.8);
      break;
    case "leaf":
      pg.vertex(0, 0);
      pg.bezierVertex(s * 0.2, -s * 0.4, s * 0.8, -s * 0.1, s, 0);
      pg.bezierVertex(s * 0.6, s * 0.4, s * 0.2, s * 0.3, 0, s * 0.8);
      break;
    case "blade":
      pg.vertex(0, 0);
      pg.bezierVertex(s * 0.3, -s * 0.7, s * 0.7, 0, s, 0);
      pg.bezierVertex(s * 0.7, s * 0.6, s * 0.2, s * 0.6, 0, s * 0.8);
      break;
    case "drop":
      pg.vertex(0, 0);
      pg.bezierVertex(s * 0.2, -s * 0.2, s * 0.6, -s * 0.3, s, 0);
      pg.bezierVertex(s * 0.4, s * 0.5, s * 0.2, s * 0.5, 0, s * 0.8);
      break;
    case "arc":
      pg.vertex(0, 0);
      for (let a = 0; a < PI / 2; a += PI / 12) {
        pg.vertex(s * cos(a), s * sin(a));
      }
      break;
  }
  pg.endShape(CLOSE);
}
