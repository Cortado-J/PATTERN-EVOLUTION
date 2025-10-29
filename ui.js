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

  const buttonW = min(150, innerW * 0.28);
  const buttonH = 40;
  const buttonGap = 8;
  const buttonHGap = buttonGap + 12;
  const actions = [
    { key: "R", label: "Random", action: "random" },
    { key: "C", label: "Clone", action: "clone" },
    { key: "A", label: "Average", action: "average" },
    { key: "S", label: "Select", action: "select" },
    { key: "D", label: "Delete", action: "delete" }
  ];

  const columnX = innerX;
  const columnY = innerY;
  const buttonCols = 2;
  const buttonRows = ceil(actions.length / buttonCols);
  const buttonAreaWidth = buttonCols * buttonW + (buttonCols - 1) * buttonHGap;

  textAlign(CENTER, CENTER);
  textSize(16);
  actions.forEach(({ action, label, key }, idx) => {
    const col = idx % buttonCols;
    const row = floor(idx / buttonCols);
    const bx = columnX + col * (buttonW + buttonHGap);
    const by = columnY + row * (buttonH + buttonGap);
    const region = { x: bx, y: by, w: buttonW, h: buttonH, enabled: false };
    region.enabled = Boolean(isActionEnabled(action));
    uiRegions.actionButtons[action] = region;
    stroke(0);
    fill(region.enabled ? "#06d6a0" : 200);
    rect(region.x, region.y, region.w, region.h, 8);
    noStroke();
    fill(region.enabled ? 255 : 80);
    text(`${label} (${key})`, region.x + region.w / 2, region.y + region.h / 2);
  });

  // Mutation slider row beneath buttons
  const sliderY = columnY + buttonRows * (buttonH + buttonGap) + 16;
  const sliderHeight = 32;
  const sliderLabel = "Mutation";
  const sliderValue = `${(mutationRate * 100).toFixed(0)}%`;
  const sliderTrackW = buttonAreaWidth;
  const sliderTrackX = columnX;
  const sliderTrackY = sliderY + sliderHeight / 2;
  const knobRadius = 10;

  stroke(0);
  fill(60);
  textAlign(LEFT, CENTER);
  textSize(14);
  text(sliderLabel, sliderTrackX, sliderY - 4);
  textAlign(RIGHT, CENTER);
  text(sliderValue, sliderTrackX + sliderTrackW, sliderY - 4);

  stroke(0);
  strokeWeight(2);
  line(sliderTrackX, sliderTrackY, sliderTrackX + sliderTrackW, sliderTrackY);
  const sliderNorm = constrain(map(mutationRate, MUTATION_MIN, MUTATION_MAX, 0, 1, true), 0, 1);
  const knobX = sliderTrackX + sliderTrackW * sliderNorm;
  fill(30);
  circle(knobX, sliderTrackY, knobRadius * 2);
  strokeWeight(1);

  mutationSlider.region = {
    x: sliderTrackX,
    y: sliderTrackY - knobRadius,
    w: sliderTrackW,
    h: knobRadius * 2
  };

  // Nudge buttons for mutation +/-
  const nudgeGap = 8;
  const nudgeW = (buttonAreaWidth - nudgeGap) / 2;
  const nudgeY = sliderTrackY + knobRadius + 10;
  mutationSlider.decrease = { x: sliderTrackX, y: nudgeY, w: nudgeW, h: 30 };
  mutationSlider.increase = { x: sliderTrackX + nudgeW + nudgeGap, y: nudgeY, w: nudgeW, h: 30 };

  textAlign(CENTER, CENTER);
  textSize(14);
  stroke(0);
  fill(245);
  rect(mutationSlider.decrease.x, mutationSlider.decrease.y, mutationSlider.decrease.w, mutationSlider.decrease.h, 6);
  rect(mutationSlider.increase.x, mutationSlider.increase.y, mutationSlider.increase.w, mutationSlider.increase.h, 6);
  noStroke();
  fill(0);
  text("-", mutationSlider.decrease.x + mutationSlider.decrease.w / 2, mutationSlider.decrease.y + mutationSlider.decrease.h / 2);
  text("+", mutationSlider.increase.x + mutationSlider.increase.w / 2, mutationSlider.increase.y + mutationSlider.increase.h / 2);

  const controlsBottom = mutationSlider.increase.y + mutationSlider.increase.h;

  // Preview area
  const previewSpacing = max(24, buttonW * 0.2);
  const previewX = columnX + buttonAreaWidth + previewSpacing;
  const previewY = innerY;
  const previewW = innerX + innerW - previewX;
  const previewH = innerH;

  stroke(0);
  fill(240);
  rect(previewX, previewY, previewW, previewH, 8);

  noStroke();
  fill(0);
  textAlign(LEFT, TOP);
  textSize(14);
  const genY = previewY + 16;
  text(`Gen ${gen}`, previewX + 16, genY);

  textSize(16);
  const parentsY = genY + 22;
  text(`Selected parents: ${selectedParents.length}`, previewX + 16, parentsY);

  textSize(14);
  const infoY = parentsY + 30;
  if (previewActive()) {
    const total = pendingPreview ? pendingPreview.items.length : 1;
    const index = pendingPreview ? pendingPreview.index + 1 : 1;
    const label = pendingPreview ? pendingPreview.label : "Preview";
    text(`${label} offspring ${index}/${total}`, previewX + 16, infoY);
    text("Press Space to add, any other key to cancel.", previewX + 16, infoY + 20);

    const item = currentPreviewItem();
    if (item && item.genome) {
      const artSize = tile;
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
