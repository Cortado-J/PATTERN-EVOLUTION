// UI state and rendering
// Coordinates top-level layout, pool grid drawing, and control panel composition.
const TILE_SCALE = 0.9;
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
  const tileBase = max(10, s - gap);
  const tile = max(10, tileBase * TILE_SCALE);
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
    drawGenomeSummaryLabel(genomeSummary(g), x, y + tile + 4, tile);
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

function drawGenomeSummaryLabel(summary, x, y, width) {
  if (!summary) return;
  push();
  noStroke();
  fill(32);
  textSize(15);
  textAlign(CENTER, TOP);
  text(summary, x + width / 2, y);
  pop();
}

function drawControls() {
  const layout = computeControlPanelLayout();
  uiRegions.actionButtons = {};

  drawControlPanelContainer(layout);

  const actions = [
    { key: "R", label: "Random", action: "random" },
    { key: "C", label: "Clone", action: "clone" },
    { key: "A", label: "Average", action: "average" },
    { key: "S", label: "Select", action: "select" },
    { key: "D", label: "Delete", action: "delete" }
  ];

  const buttonMetrics = renderActionButtonGrid(actions, layout, { buttonCols: 2 });
  drawMutationSliderSection(layout, buttonMetrics);

  const previewSpacing = max(24, buttonMetrics.buttonW * 0.2);
  const previewX = buttonMetrics.columnX + buttonMetrics.buttonAreaWidth + previewSpacing;
  const previewY = layout.innerY;
  const previewW = layout.innerX + layout.innerW - previewX;
  const previewH = layout.innerH;

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
      const artSize = layout.tile;
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
      drawGenomeSummaryLabel(genomeSummary(item.genome), artX, artY + artSize + 6, artSize);
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

