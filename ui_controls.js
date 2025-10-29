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
