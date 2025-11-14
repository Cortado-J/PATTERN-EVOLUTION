// UI state and rendering
// Coordinates top-level layout, pool grid drawing, and control panel composition.
const TILE_SCALE = 0.9;
function panelHeight() {
  return 350; // Increased significantly to ensure all controls are visible
}

function displayScaleForPattern(genome, width, height, paddingFactor = 3) {
  if (!genome) return 1;
  const spec = getGroupSpec(genome.group || "632");
  const cell = estimateCellSize({ group: genome.group, motifScale: genome.motifScale });
  const cellW = Math.max(1, cell.w || 1);
  const cellH = Math.max(1, cell.h || 1);
  const padX = typeof paddingFactor === "number" ? paddingFactor : 3;
  const padY = padX;
  const scaleX = width / (cellW * padX);
  const scaleY = height / (cellH * padY);
  const scale = Math.min(scaleX, scaleY);
  return isFinite(scale) && scale > 0 ? scale : 1;
}

function calculatePoolLayout() {
  const cols = GRID_COLS;
  const gridH = height - HEADER_H - panelHeight();
  const gridW = width - 100; // Leave some margin for scrollbar
  const cellHBase = gridH / GRID_ROWS; // Use original GRID_ROWS for base calculation
  const cellWBase = gridW / cols;
  const scrollbarWidth = 24;
  const minScrollbarGap = 14;
  const gridAvailableWidth = max(120, width - scrollbarWidth - minScrollbarGap);

  // Apply pattern size multiplier to make tiles bigger/smaller
  const patternSize = typeof getPatternSize === "function" ? getPatternSize() : 1;
  const sizeMultiplier = patternSize;

  let cellSize = min(width / cols, cellHBase);
  cellSize = min(cellSize, gridAvailableWidth / cols);
  
  // Apply size multiplier 
  cellSize = cellSize * sizeMultiplier;
  
  // Only constrain height, allow width to overflow with horizontal scrolling
  const maxCellHeight = gridH;
  cellSize = min(cellSize, maxCellHeight); // Only constrain height
  cellSize = max(cellSize, 20); // Minimum tile size

  // Calculate how many rows can actually fit with the larger tiles
  const visibleRows = max(1, floor(gridH / cellSize));
  
  // Calculate how many columns can actually fit in the visible area
  const visibleCols = max(1, floor(gridW / cellSize));

  const gap = max(4, cellSize * 0.08);
  const tileBase = max(10, cellSize - gap);
  const tile = max(10, tileBase * TILE_SCALE);
  
  // Use visibleCols for viewport width instead of full cols
  const viewportWidth = visibleCols * cellSize;
  const scrollbarGapMax = max(minScrollbarGap, width - viewportWidth - scrollbarWidth);
  const scrollbarGap = constrain(max(gap, minScrollbarGap), minScrollbarGap, scrollbarGapMax);
  const totalWidth = viewportWidth + scrollbarGap + scrollbarWidth;
  const originX = (width - totalWidth) / 2;
  const originYBase = HEADER_H + gap / 2;
  
  // Calculate viewport height based on actual visible rows
  const viewportHeight = visibleRows * cellSize;
  
  const maxOriginY = HEADER_H + gridH - viewportHeight;
  const viewportTop = min(originYBase, maxOriginY);
  const totalRows = max(1, ceil(pool.length / visibleCols)); // Use visibleCols for total rows calculation
  const contentHeight = totalRows * cellSize;
  const maxScroll = max(0, contentHeight - viewportHeight);
  const scrollbarX = originX + viewportWidth + scrollbarGap;

  return {
    cols,
    visibleCols,
    visibleRows,
    gap,
    tile,
    cellSize,
    originX,
    viewportTop,
    viewportHeight,
    viewportWidth,
    totalRows,
    contentHeight,
    maxScroll,
    scrollbarWidth,
    scrollbarGap,
    scrollbarX,
  };
}

function getPoolScrollbarMetrics(layout) {
  const buttonHeight = max(20, min(36, layout.viewportHeight * 0.12));
  const topButton = {
    x: layout.scrollbarX,
    y: layout.viewportTop,
    w: layout.scrollbarWidth,
    h: buttonHeight,
  };
  const bottomButton = {
    x: layout.scrollbarX,
    y: layout.viewportTop + layout.viewportHeight - buttonHeight,
    w: layout.scrollbarWidth,
    h: buttonHeight,
  };
  const track = {
    x: layout.scrollbarX,
    y: topButton.y + topButton.h,
    w: layout.scrollbarWidth,
    h: layout.viewportHeight - topButton.h - bottomButton.h,
  };

  const knobHeight = layout.maxScroll <= 0
    ? track.h
    : max(24, track.h * (track.h / layout.contentHeight));
  const knobTravel = max(0, track.h - knobHeight);
  const knobY = knobTravel === 0
    ? track.y
    : track.y + knobTravel * (poolScroll / layout.maxScroll || 0);

  return {
    bounds: {
      x: layout.scrollbarX,
      y: layout.viewportTop,
      w: layout.scrollbarWidth,
      h: layout.viewportHeight,
    },
    topButton,
    bottomButton,
    track,
    knob: {
      x: track.x,
      y: knobY,
      w: track.w,
      h: knobHeight,
    },
    knobTravel,
    rowStep: layout.cellSize,
    pageStep: max(layout.cellSize, layout.viewportHeight - layout.cellSize),
  };
}

function scrollPoolToLatest() {
  const layout = calculatePoolLayout();
  poolScroll = constrain(layout.maxScroll, 0, layout.maxScroll);
}

function drawScreen() {
  background(245);
  drawTitle();
  drawPoolGrid();
  drawControls();
  if (typeof drawHoverPreview === "function") drawHoverPreview();
}

function drawPoolGrid() {
  const layout = calculatePoolLayout();
  poolScroll = constrain(poolScroll, 0, layout.maxScroll);

  push();
  textAlign(LEFT, BOTTOM);
  textSize(18);
  fill(40);
  text("Session Pool", layout.originX, layout.viewportTop - 8);
  textSize(12);
  fill(70);
  text("Temporary workspace — use Gallery to keep favourites", layout.originX, layout.viewportTop - 22);
  pop();

  const firstRow = floor(poolScroll / layout.cellSize);
  const rowOffset = poolScroll - firstRow * layout.cellSize;
  const remainingRows = max(0, layout.totalRows - firstRow);
  const rowsToDraw = min(layout.visibleRows + 1, remainingRows);

  push();
  noStroke();
  fill(245);
  rect(layout.originX, layout.viewportTop, layout.viewportWidth, layout.viewportHeight);

  const ctx = typeof drawingContext !== "undefined" ? drawingContext : null;
  if (ctx && typeof ctx.save === "function") {
    ctx.save();
    ctx.beginPath();
    ctx.rect(layout.originX, layout.viewportTop, layout.viewportWidth, layout.viewportHeight);
    ctx.clip();
  }

  for (let row = 0; row < rowsToDraw; row++) {
    const globalRow = firstRow + row;
    const yBase = layout.viewportTop + row * layout.cellSize - rowOffset;
    // Use visibleCols for index calculation instead of original cols
    const idxBase = globalRow * layout.visibleCols;

    // Draw all visible columns
    for (let col = 0; col < layout.visibleCols; col++) {
      const idx = idxBase + col;
      if (idx >= pool.length) break;
      const x = layout.originX + col * layout.cellSize + (layout.cellSize - layout.tile) / 2;
      const y = yBase + (layout.cellSize - layout.tile) / 2;
      const g = pool[idx];
      const isSel = selectedParents.includes(g);
      drawQuadrant(g, x, y, layout.tile, layout.tile, isSel, idx);
      drawGenomeSummaryLabel(genomeSummary(g), x, y + layout.tile + 4, layout.tile);
    }
  }

  if (ctx && typeof ctx.restore === "function") {
    ctx.restore();
  }
  pop();

  drawPoolScrollbar(layout);
}

function drawPoolScrollbar(layout) {
  const metrics = getPoolScrollbarMetrics(layout);
  const track = metrics.track;
  const knob = metrics.knob;

  push();
  stroke(0);
  strokeWeight(2);
  fill(235);
  rect(metrics.bounds.x, metrics.bounds.y, metrics.bounds.w, metrics.bounds.h, 6);

  // Buttons
  fill(220);
  rect(metrics.topButton.x, metrics.topButton.y, metrics.topButton.w, metrics.topButton.h, 6, 6, 0, 0);
  rect(metrics.bottomButton.x, metrics.bottomButton.y, metrics.bottomButton.w, metrics.bottomButton.h, 0, 0, 6, 6);
  fill(70);
  const arrowPadding = metrics.topButton.h * 0.3;
  const arrowMidX = metrics.topButton.x + metrics.topButton.w / 2;
  triangle(
    arrowMidX,
    metrics.topButton.y + arrowPadding,
    arrowMidX - (metrics.topButton.w / 3),
    metrics.topButton.y + metrics.topButton.h - arrowPadding,
    arrowMidX + (metrics.topButton.w / 3),
    metrics.topButton.y + metrics.topButton.h - arrowPadding
  );
  const bottomArrowPadding = arrowPadding;
  triangle(
    arrowMidX,
    metrics.bottomButton.y + metrics.bottomButton.h - bottomArrowPadding,
    arrowMidX - (metrics.bottomButton.w / 3),
    metrics.bottomButton.y + bottomArrowPadding,
    arrowMidX + (metrics.bottomButton.w / 3),
    metrics.bottomButton.y + bottomArrowPadding
  );

  // Track background
  fill(210);
  rect(track.x, track.y, track.w, track.h, 6);

  if (layout.maxScroll <= 0 || knob.h >= track.h) {
    fill(160);
    rect(track.x, track.y, track.w, track.h, 6);
  } else {
    fill(90);
    rect(knob.x, knob.y, knob.w, knob.h, 6);
  }

  pop();
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
    { key: "C", label: "Create", action: "create" },
    { key: "M", label: "Mutate", action: "mutate" },
    { key: "B", label: "Blend", action: "blend" },
  ];

  const buttonMetrics = renderActionButtonGrid(actions, layout, { buttonCols: 1 });
  const sliderMetrics = drawMutationSliderSection(layout, buttonMetrics);
  const groupMetrics = drawGroupFilterSection(layout, sliderMetrics);
  const sizeMetrics = drawPatternSizeSection(layout, groupMetrics);

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
  text(`Selected tiles: ${selectedParents.length}`, previewX + 16, parentsY);

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
    text("Choose an action or press C/R, M, or B to preview.", previewX + 16, infoY);
    text("Space accepts previews. Backspace removes selected tiles.", previewX + 16, infoY + 20);
  }

  const tipsY = infoY + 48;
  text("Session tip: tap a tile again to deselect.", previewX + 16, tipsY);
  text("Session pool clears when you leave—save favourites to Gallery.", previewX + 16, tipsY + 18);

  // Generation counter on the right edge within preview panel
  textAlign(RIGHT, TOP);
  textSize(14);
  text(`Gen ${gen}`, previewX + previewW - 16, previewY + 16);
}

function drawHoverPreview() {
  if (!hoverPreview) return;
  const { genome } = hoverPreview;
  if (!genome) return;

  const overlayMargin = 60;
  const boxX = overlayMargin;
  const boxY = overlayMargin;
  const boxW = width - overlayMargin * 2;
  const boxH = height - overlayMargin * 2;

  push();
  noStroke();
  fill(0, 180);
  rect(0, 0, width, height);
  pop();

  push();
  stroke(255);
  strokeWeight(4);
  fill(20, 200);
  rect(boxX, boxY, boxW, boxH, 12);
  pop();

  const padding = 24;
  const artW = boxW - padding * 2;
  const artH = boxH - padding * 2;
  const artSize = min(artW, artH);
  const artX = boxX + (boxW - artSize) / 2;
  const artY = boxY + (boxH - artSize) / 2;

  const pg = createGraphics(artSize, artSize);
  pg.background(240);
  pg.translate(pg.width / 2, pg.height / 2);
  const layout = calculatePoolLayout();
  const tileSize = max(1, layout.tile || 1);
  const baseScale = displayScaleForPattern ? displayScaleForPattern(genome, tileSize, tileSize, 3) : 1;
  const scaleFactor = baseScale * (artSize / tileSize);
  if (abs(scaleFactor - 1) > 0.0001) pg.scale(scaleFactor);
  drawWallpaperOn(pg, genome);
  image(pg, artX, artY);

  push();
  stroke(255);
  strokeWeight(4);
  noFill();
  rect(artX, artY, artSize, artSize, 8);
  pop();

  const label = genomeSummary ? genomeSummary(genome) : null;
  if (label) {
    push();
    textAlign(CENTER, TOP);
    textSize(24);
    fill(255);
    text(label, width / 2, artY + artSize + 24);
    pop();
  }

  push();
  textAlign(CENTER, TOP);
  textSize(18);
  fill(255);
  text("Move the mouse away to close", width / 2, boxY + boxH - 36);
  pop();
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

