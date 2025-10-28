// UI state and rendering
function panelHeight() {
  return generateMode ? 260 : 80;
}

function drawScreen() {
  background(245);
  drawTitle();
  drawPoolGrid();
  drawControls();
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
  // Live offspring previews (draw first so controls appear on top)
  if (!liveOffspring || liveOffspring.length !== 4) {
    liveOffspring = buildOffspringPreview();
    liveOffspringSelected = [false, false, false, false];
  }
  if (liveOffspring && liveOffspring.length === 4) {
    const pad = 12;
    const pw = (width - 5 * pad) / 4;
    const ph = h - 110; // more room for top controls
    const py = y + 92; // push previews further down
    uiRegions.liveOffspring = [];
    for (let i = 0; i < 4; i++) {
      const px = pad + i * (pw + pad);
      // Square thumbnail size and centering
      const s = Math.min(pw, ph);
      const sx = px + (pw - s) / 2;
      const sy = py + (ph - s) / 2;

      const pg = createGraphics(s, s);
      pg.background(240);
      pg.translate(pg.width / 2, pg.height / 2);
      pg.scale(0.5);
      drawWallpaperOn(pg, liveOffspring[i]);
      image(pg, sx, sy);
      // preview card border
      stroke(0); noFill(); rect(px, py, pw, ph, 6);
      if (liveOffspringSelected[i]) {
        stroke("#2ecc71"); strokeWeight(3); rect(px + 3, py + 3, pw - 6, ph - 6, 6); strokeWeight(1);
      }
      // checkbox (top-right of card)
      const cb = 18;
      noStroke(); fill(liveOffspringSelected[i] ? "#2ecc71" : 255);
      rect(px + pw - cb - 6, py + 6, cb, cb, 4);
      stroke(0); noFill(); rect(px + pw - cb - 6, py + 6, cb, cb, 4);
      uiRegions.liveOffspring[i] = { x: px, y: py, w: pw, h: ph };
    }
  }

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

  // Always show Send to Pool button (disabled if none selected)
  const anySelected = liveOffspringSelected.some(x => x);
  const gW = 180, gH = 40, gX = width - gW - 16, gY = y + h - gH - 12;
  uiRegions.genBtn = { x: gX, y: gY, w: gW, h: gH };
  stroke(0);
  fill(anySelected ? "#06d6a0" : 200);
  rect(gX, gY, gW, gH, 6);
  noStroke(); fill(anySelected ? 255 : 80); textAlign(CENTER, CENTER); textSize(18); text("Send to Pool", gX + gW / 2, gY + gH / 2);
  // Generation counter
  fill(0); noStroke(); textAlign(RIGHT, CENTER); textSize(14);
  text(`Gen ${gen}`, gX - 10, gY + gH / 2);
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

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function toggleParentSelection(g) {
  let i = selectedParents.indexOf(g);
  if (i >= 0) selectedParents.splice(i, 1);
  else if (selectedParents.length < 4) selectedParents.push(g);
}

function mousePressed() {
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
      // In generate mode this button means 'Send to Pool'
      sendLiveOffspringToPool();
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
