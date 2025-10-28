// UI state and rendering
function panelHeight() {
  return 220;
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
  const gridH = height - HEADER_H - panelHeight();
  const cellWBase = width / cols;
  const cellHBase = gridH / rows;
  const s = min(cellWBase, cellHBase);
  const gap = max(4, s * 0.08);
  const tile = max(10, s - gap);
  const originX = (width - cols * s) / 2;
  const originYBase = HEADER_H + gap / 2;
  const maxOriginY = HEADER_H + gridH - rows * s;
  const originY = min(originYBase, maxOriginY);
  for (let i = 0; i < min(pool.length, cols * rows); i++) {
    const r = floor(i / cols);
    const c = i % cols;
    const x = originX + c * s + (s - tile) / 2;
    const y = originY + r * s + (s - tile) / 2;
    const g = pool[i];
    const isSel = selectedParents.includes(g);
    drawQuadrant(g, x, y, tile, tile, isSel, i);
  }
}

function drawQuadrant(g, x, y, w, h, isSelected = false, idx = 0) {
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

  // Border
  stroke(0);
  strokeWeight(4);
  noFill();
  rect(x, y, w, h, 4);

  // Text label retained for possible reuse; comment out to hide numbers for now.
  // fill(0);
  // noStroke();
  // textAlign(CENTER, CENTER);
  // textSize(18);
  // text(g.group, x + w / 2, y + 16);
}

function drawControls() {
  const h = panelHeight();
  const y = height - h;
  uiRegions.actionButtons = {};

  // Align control panel with pool width and styling
  const cols = GRID_COLS;
  const rows = GRID_ROWS;
  const gridH = height - HEADER_H - panelHeight();
  const cellWBase = width / cols;
  const cellHBase = gridH / rows;
  const s = min(cellWBase, cellHBase);
  const gap = max(4, s * 0.08);
  const tile = max(10, s - gap);
  const gridOriginX = (width - cols * s) / 2;
  const panelX = gridOriginX + (s - tile) / 2;
  const panelWidth = tile + (cols - 1) * s;
  const panelTop = y + 8;
  const panelHeightInner = h - 16;
  const panelPadding = 16;
  const innerX = panelX + panelPadding;
  const innerY = panelTop + panelPadding;
  const innerW = panelWidth - panelPadding * 2;
  const innerH = panelHeightInner - panelPadding * 2;

  noStroke();
  fill(240);
  rect(panelX, panelTop, panelWidth, panelHeightInner, 8);
  stroke(0);
  strokeWeight(4);
  noFill();
  rect(panelX, panelTop, panelWidth, panelHeightInner, 4);
  strokeWeight(1);

  const buttonW = min(160, innerW * 0.35);
  const buttonH = 40;
  const buttonGap = 8;
  const columnX = innerX;
  let buttonY = innerY;

  // Action buttons column
  const actions = [
    { key: "R", label: "Random", action: "random", enabled: true },
    { key: "C", label: "Clone", action: "clone", enabled: selectedParents.length > 0 },
    { key: "A", label: "Average", action: "average", enabled: selectedParents.length >= 2 },
    { key: "S", label: "Select", action: "select", enabled: selectedParents.length > 0 },
  ];
  textAlign(CENTER, CENTER);
  textSize(16);
  for (const { action, label, key, enabled } of actions) {
    const region = { x: columnX, y: buttonY, w: buttonW, h: buttonH, enabled: false };
    region.enabled = Boolean(isActionEnabled(action));
    uiRegions.actionButtons[action] = region;
    stroke(0);
    fill(region.enabled ? "#06d6a0" : 200);
    rect(region.x, region.y, region.w, region.h, 8);
    noStroke();
    fill(region.enabled ? 255 : 80);
    text(`${label} (${key})`, region.x + region.w / 2, region.y + region.h / 2);
    buttonY += buttonH + buttonGap;
  }

  // Preview area
  const previewSpacing = max(16, buttonW * 0.15);
  const previewX = columnX + buttonW + previewSpacing;
  const previewY = innerY;
  const previewW = innerX + innerW - previewX;
  const previewH = innerH;

  stroke(0);
  fill(240);
  rect(previewX, previewY, previewW, previewH, 8);

  noStroke();
  fill(0);
  textAlign(LEFT, TOP);
  textSize(16);
  text(`Selected parents: ${selectedParents.length}`, previewX + 16, previewY + 16);

  textSize(14);
  const infoY = previewY + 44;
  if (previewActive()) {
    const total = pendingPreview ? pendingPreview.items.length : 1;
    const index = pendingPreview ? pendingPreview.index + 1 : 1;
    const label = pendingPreview ? pendingPreview.label : "Preview";
    text(`${label} offspring ${index}/${total}`, previewX + 16, infoY);
    text("Press Space to add, any other key to cancel.", previewX + 16, infoY + 20);

    const item = currentPreviewItem();
    if (item && item.genome) {
      const artSize = min(previewW - 40, previewH - 96);
      const artX = previewX + (previewW - artSize) / 2;
      const artY = previewY + previewH - artSize - 20;
      const pg = createGraphics(artSize, artSize);
      pg.background(240);
      pg.translate(pg.width / 2, pg.height / 2);
      const scaleFactor = displayScaleForPattern ? displayScaleForPattern(item.genome, artSize, artSize, 3) : 1;
      if (scaleFactor !== 1) pg.scale(scaleFactor);
      drawWallpaperOn(pg, item.genome);
      image(pg, artX, artY);
      stroke(0);
      strokeWeight(4);
      noFill();
      rect(artX, artY, artSize, artSize, 4);
      strokeWeight(1);
    }
  } else {
    text("Choose an action or press R/C/A/S to preview.", previewX + 16, infoY);
    text("Press Space to confirm a preview when shown.", previewX + 16, infoY + 20);
  }

  // Generation counter on the right edge within preview panel
  textAlign(RIGHT, TOP);
  textSize(14);
  text(`Gen ${gen}`, previewX + previewW - 16, previewY + 16);
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
  else selectedParents.push(g);
}

function mousePressed() {
  // Action buttons
  if (uiRegions.actionButtons) {
    for (const [action, region] of Object.entries(uiRegions.actionButtons)) {
      if (!region || !pointInRect(mouseX, mouseY, region)) continue;
      if (!region.enabled) return;
      if (previewActive()) discardPreview(false);
      handleAction(action);
      return;
    }
  }

  // Grid selection
  const cols = GRID_COLS;
  const rows = GRID_ROWS;
  if (mouseY >= HEADER_H && mouseY < height - panelHeight()) {
    const gridH = height - HEADER_H - panelHeight();
    const cellWBase = width / cols;
    const cellHBase = gridH / rows;
    const s = min(cellWBase, cellHBase);
    const gap = max(4, s * 0.08);
    const originX = (width - cols * s) / 2;
    const originYBase = HEADER_H + gap / 2;
    const maxOriginY = HEADER_H + gridH - rows * s;
    const originYClamped = min(originYBase, maxOriginY);
    if (mouseX >= originX && mouseX < originX + cols * s && mouseY >= originYClamped && mouseY < originYClamped + rows * s) {
      const c = floor((mouseX - originX) / s);
      const r = floor((mouseY - originYClamped) / s);
      const localX = (mouseX - originX) - c * s;
      const localY = (mouseY - originYClamped) - r * s;
      if (localX < gap / 2 || localX > s - gap / 2 || localY < gap / 2 || localY > s - gap / 2) {
        return; // click fell in the gutter between tiles
      }
      const idx = r * cols + c;
      if (idx >= 0 && idx < pool.length) {
        toggleParentSelection(pool[idx]);
        return drawScreen();
      }
    }
  }
}
