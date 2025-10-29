// UI control state shared between UI rendering and sketch input handlers
const MUTATION_MIN = 0.0;
const MUTATION_MAX = 0.6;
const MUTATION_STEP = 0.01;

const uiRegions = {
  actionButtons: {},
};

let mutationRate = 0.05; // default 5%

const mutationSlider = {
  region: null,
  decrease: null,
  increase: null,
  dragging: false,
  clamp(value) {
    return constrain(value, MUTATION_MIN, MUTATION_MAX);
  },
  set(value, redraw = true) {
    mutationRate = this.clamp(value);
    if (redraw) drawScreen();
  },
  current() {
    return mutationRate;
  },
  valueFromMouse(mx) {
    if (!this.region) return mutationRate;
    const t = constrain((mx - this.region.x) / this.region.w, 0, 1);
    return this.clamp(lerp(MUTATION_MIN, MUTATION_MAX, t));
  },
  beginDrag(mx) {
    this.dragging = true;
    this.set(this.valueFromMouse(mx));
  },
  drag(mx) {
    if (!this.dragging) return;
    mutationRate = this.valueFromMouse(mx);
    redraw();
  },
  endDrag() {
    this.dragging = false;
  }
};

function computeControlPanelLayout() {
  const h = panelHeight();
  const panelY = height - h;

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
  const panelTop = panelY + 8;
  const panelHeightInner = h - 16;
  const panelPadding = 16;
  const innerX = panelX + panelPadding;
  const innerY = panelTop + panelPadding;
  const innerW = panelWidth - panelPadding * 2;
  const innerH = panelHeightInner - panelPadding * 2;

  return {
    panelY,
    panelX,
    panelWidth,
    panelTop,
    panelHeightInner,
    innerX,
    innerY,
    innerW,
    innerH,
    tile,
  };
}

function drawControlPanelContainer(layout) {
  noStroke();
  fill(240);
  rect(layout.panelX, layout.panelTop, layout.panelWidth, layout.panelHeightInner, 8);
  stroke(0);
  strokeWeight(4);
  noFill();
  rect(layout.panelX, layout.panelTop, layout.panelWidth, layout.panelHeightInner, 4);
  strokeWeight(1);
}

function renderActionButtonGrid(actions, layout, { buttonCols = 2 } = {}) {
  const buttonW = min(150, layout.innerW * 0.28);
  const buttonH = 40;
  const buttonGap = 8;
  const buttonHGap = buttonGap + 12;
  const columnX = layout.innerX;
  const columnY = layout.innerY;

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

  return {
    columnX,
    columnY,
    buttonW,
    buttonH,
    buttonGap,
    buttonHGap,
    buttonCols,
    buttonRows,
    buttonAreaWidth,
    buttonsBottom: columnY + buttonRows * (buttonH + buttonGap) - buttonGap,
  };
}

function drawMutationSliderSection(layout, buttonMetrics) {
  const sliderY = buttonMetrics.columnY + buttonMetrics.buttonRows * (buttonMetrics.buttonH + buttonMetrics.buttonGap) + 16;
  const sliderHeight = 32;
  const sliderLabel = "Mutation";
  const sliderValue = `${(mutationRate * 100).toFixed(0)}%`;
  const sliderTrackW = buttonMetrics.buttonAreaWidth;
  const sliderTrackX = buttonMetrics.columnX;
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
    h: knobRadius * 2,
  };

  const nudgeGap = 8;
  const nudgeW = (sliderTrackW - nudgeGap) / 2;
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

  return {
    sliderTrackX,
    sliderTrackY,
    sliderTrackW,
    sliderY,
    sliderHeight,
    knobRadius,
    bottom: mutationSlider.increase.y + mutationSlider.increase.h,
  };
}

function mousePressed() {
  if (uiRegions.actionButtons) {
    for (const [action, region] of Object.entries(uiRegions.actionButtons)) {
      if (!region || !pointInRect(mouseX, mouseY, region)) continue;
      if (!region.enabled) return;
      if (previewActive()) discardPreview(false);
      handleAction(action);
      return;
    }
  }

  if (mutationSlider.region && pointInRect(mouseX, mouseY, mutationSlider.region)) return mutationSlider.beginDrag(mouseX);
  if (mutationSlider.decrease && pointInRect(mouseX, mouseY, mutationSlider.decrease)) return mutationSlider.set(mutationRate - MUTATION_STEP);
  if (mutationSlider.increase && pointInRect(mouseX, mouseY, mutationSlider.increase)) return mutationSlider.set(mutationRate + MUTATION_STEP);

  handlePoolClick(mouseX, mouseY);
}

function mouseReleased() {
  mutationSlider.endDrag();
}

function mouseDragged() {
  mutationSlider.drag(mouseX);
}

function keyTyped() {
  if (key === "-" || key === "_") {
    mutationSlider.set(mutationRate - MUTATION_STEP);
  } else if (key === "+" || key === "=") {
    mutationSlider.set(mutationRate + MUTATION_STEP);
  }
}

function handlePoolClick(mx, my) {
  const cols = GRID_COLS;
  const rows = GRID_ROWS;
  if (my < HEADER_H || my >= height - panelHeight()) return;
  const gridH = height - HEADER_H - panelHeight();
  const cellWBase = width / cols;
  const cellHBase = gridH / rows;
  const s = min(cellWBase, cellHBase);
  const gap = max(4, s * 0.08);
  const originX = (width - cols * s) / 2;
  const originYBase = HEADER_H + gap / 2;
  const maxOriginY = HEADER_H + gridH - rows * s;
  const originY = min(originYBase, maxOriginY);
  if (mx < originX || mx >= originX + cols * s || my < originY || my >= originY + rows * s) return;
  const c = floor((mx - originX) / s);
  const r = floor((my - originY) / s);
  const localX = (mx - originX) - c * s;
  const localY = (my - originY) - r * s;
  if (localX < gap / 2 || localX > s - gap / 2 || localY < gap / 2 || localY > s - gap / 2) return;
  const idx = r * cols + c;
  if (idx < 0 || idx >= pool.length) return;
  const genome = pool[idx];
  if (selectedParents.includes(genome)) selectedParents = selectedParents.filter(p => p !== genome);
  else selectedParents.push(genome);
  drawScreen();
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
