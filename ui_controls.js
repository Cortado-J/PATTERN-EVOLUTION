// UI control state shared between UI rendering and sketch input handlers
// Hosts interaction regions, mutation slider state, and shared mouse/key handlers.
const MUTATION_MIN = 0.0;
const MUTATION_MAX = 0.6;
const MUTATION_STEP = 0.01;

const PATTERN_SIZES = [1, 1.5, 2]; // More conservative size multipliers
const PATTERN_SIZE_LABELS = ["1x", "1.5x", "2x"];

// Available wallpaper groups for the dropdown filter
const WALLPAPER_GROUPS = ["Any", "632", "*632", "442", "*442", "4*2", "333", "*333", "3*3", "2222", "2*22", "*2222", "22*", "22x"];

const uiRegions = {
  actionButtons: {},
  patternSizeButtons: {},
  groupDropdown: null,
};

let mutationRate = 0.05; // default 5%
let patternSizeIndex = 0; // default to 1x size
let selectedGroupFilter = "Any"; // default to no group filter

function getPatternSize() {
  return PATTERN_SIZES[patternSizeIndex];
}

function setPatternSize(index, redraw = true) {
  patternSizeIndex = constrain(index, 0, PATTERN_SIZES.length - 1);
  if (redraw) drawScreen();
}

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
    bottom: nudgeY + 30,
    // Pass through button metrics for pattern size section
    columnX: buttonMetrics.columnX,
    buttonAreaWidth: buttonMetrics.buttonAreaWidth,
  };
}

function drawPatternSizeSection(layout, sliderMetrics) {
  // Position pattern size buttons lower to avoid mutation controls
  const sizeY = layout.innerY + 250;
  
  const buttonW = min(50, sliderMetrics.buttonAreaWidth / 4);
  const buttonH = 30;
  const buttonGap = 6;
  const totalWidth = PATTERN_SIZES.length * buttonW + (PATTERN_SIZES.length - 1) * buttonGap;
  const startX = sliderMetrics.columnX + (sliderMetrics.buttonAreaWidth - totalWidth) / 2;

  // Check if we have enough space
  const availableHeight = layout.innerY + layout.innerH - sizeY;
  if (availableHeight < buttonH + 20) {
    return { bottom: sizeY };
  }

  // Draw the pattern size label
  stroke(0);
  fill(60);
  textAlign(LEFT, CENTER);
  textSize(14);
  text("Display Size:", sliderMetrics.columnX, sizeY + buttonH / 2);

  // Draw the size buttons
  PATTERN_SIZES.forEach((size, idx) => {
    const bx = startX + idx * (buttonW + buttonGap);
    const by = sizeY;
    const region = { x: bx, y: by, w: buttonW, h: buttonH };
    uiRegions.patternSizeButtons[idx] = region;
    
    const isSelected = idx === patternSizeIndex;
    stroke(0);
    fill(isSelected ? "#06d6a0" : 245);
    rect(region.x, region.y, region.w, region.h, 6);
    noStroke();
    fill(isSelected ? 255 : 0);
    textAlign(CENTER, CENTER);
    textSize(14);
    text(PATTERN_SIZE_LABELS[idx], region.x + region.w / 2, region.y + region.h / 2);
  });

  return {
    bottom: sizeY + buttonH,
  };
}

function drawGroupFilterSection(layout, sliderMetrics) {
  const dropdownY = layout.innerY + 210;
  const dropdownH = 30;
  const dropdownW = min(140, sliderMetrics.buttonAreaWidth);
  const dropdownX = sliderMetrics.columnX;

  // Check if we have enough space
  const availableHeight = layout.innerY + layout.innerH - dropdownY;
  if (availableHeight < dropdownH + 10) {
    return { bottom: dropdownY };
  }

  // Draw the group filter label
  stroke(0);
  fill(60);
  textAlign(LEFT, CENTER);
  textSize(14);
  text("Random Group:", dropdownX, dropdownY + dropdownH / 2);

  // Draw the dropdown
  const dropdownX2 = dropdownX + 95;
  const region = { x: dropdownX2, y: dropdownY, w: dropdownW, h: dropdownH };
  uiRegions.groupDropdown = region;

  stroke(0);
  fill(255);
  rect(region.x, region.y, region.w, region.h, 6);
  noStroke();
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(14);
  text(selectedGroupFilter, region.x + region.w / 2, region.y + region.h / 2);

  // Draw dropdown arrow
  const arrowX = region.x + region.w - 12;
  const arrowY = region.y + region.h / 2;
  stroke(0);
  strokeWeight(2);
  line(arrowX - 4, arrowY - 3, arrowX, arrowY + 3);
  line(arrowX + 4, arrowY - 3, arrowX, arrowY + 3);
  strokeWeight(1);

  return {
    bottom: dropdownY + dropdownH,
    columnX: sliderMetrics.columnX,
    buttonAreaWidth: sliderMetrics.buttonAreaWidth,
  };
}

function mousePressed() {
  if (typeof clearHoverPreview === "function") clearHoverPreview();
  if (uiRegions.actionButtons) {
    for (const [action, region] of Object.entries(uiRegions.actionButtons)) {
      if (!region || !pointInRect(mouseX, mouseY, region)) continue;
      if (!region.enabled) return;
      if (previewActive()) discardPreview(false);
      handleAction(action);
      return;
    }
  }

  // Check pattern size buttons
  if (uiRegions.patternSizeButtons) {
    for (const [index, region] of Object.entries(uiRegions.patternSizeButtons)) {
      if (!region || !pointInRect(mouseX, mouseY, region)) continue;
      setPatternSize(parseInt(index));
      return;
    }
  }

  // Check group filter dropdown
  if (uiRegions.groupDropdown && pointInRect(mouseX, mouseY, uiRegions.groupDropdown)) {
    const currentIndex = WALLPAPER_GROUPS.indexOf(selectedGroupFilter);
    const nextIndex = (currentIndex + 1) % WALLPAPER_GROUPS.length;
    selectedGroupFilter = WALLPAPER_GROUPS[nextIndex];
    drawScreen();
    return;
  }

  if (mutationSlider.region && pointInRect(mouseX, mouseY, mutationSlider.region)) return mutationSlider.beginDrag(mouseX);
  if (mutationSlider.decrease && pointInRect(mouseX, mouseY, mutationSlider.decrease)) return mutationSlider.set(mutationRate - MUTATION_STEP);
  if (mutationSlider.increase && pointInRect(mouseX, mouseY, mutationSlider.increase)) return mutationSlider.set(mutationRate + MUTATION_STEP);

  const layout = calculatePoolLayout();
  const metrics = getPoolScrollbarMetrics(layout);

  if (pointInRect(mouseX, mouseY, metrics.bounds)) {
    if (layout.maxScroll <= 0) return;

    if (pointInRect(mouseX, mouseY, metrics.topButton)) {
      poolScroll = max(0, poolScroll - metrics.rowStep);
      drawScreen();
      return;
    }

    if (pointInRect(mouseX, mouseY, metrics.bottomButton)) {
      poolScroll = min(layout.maxScroll, poolScroll + metrics.rowStep);
      drawScreen();
      return;
    }

    if (pointInRect(mouseX, mouseY, metrics.knob)) {
      if (metrics.knobTravel > 0) {
        poolScrollDragging = true;
        poolScrollDragOffset = mouseY - metrics.knob.y;
      }
      return;
    }

    if (pointInRect(mouseX, mouseY, metrics.track)) {
      if (mouseY < metrics.knob.y) {
        poolScroll = max(0, poolScroll - metrics.pageStep);
      } else if (mouseY > metrics.knob.y + metrics.knob.h) {
        poolScroll = min(layout.maxScroll, poolScroll + metrics.pageStep);
      }
      drawScreen();
      return;
    }
  }

  handlePoolClick(mouseX, mouseY);
}

function mouseReleased() {
  mutationSlider.endDrag();
  poolScrollDragging = false;
  poolScrollDragOffset = 0;
}

function mouseDragged() {
  if (poolScrollDragging) {
    const layout = calculatePoolLayout();
    const metrics = getPoolScrollbarMetrics(layout);
    if (layout.maxScroll > 0 && metrics.knobTravel > 0) {
      const knobTop = mouseY - poolScrollDragOffset;
      const ratio = constrain((knobTop - metrics.track.y) / metrics.knobTravel, 0, 1);
      poolScroll = ratio * layout.maxScroll;
      drawScreen();
    }
    return;
  }

  mutationSlider.drag(mouseX);
}

function keyTyped() {
  if (key === "-" || key === "_") {
    mutationSlider.set(mutationRate - MUTATION_STEP);
  } else if (key === "+" || key === "=") {
    mutationSlider.set(mutationRate + MUTATION_STEP);
  }
}

function mouseWheel(event) {
  const layout = calculatePoolLayout();
  const metrics = getPoolScrollbarMetrics(layout);
  const withinPoolY = mouseY >= layout.viewportTop && mouseY <= layout.viewportTop + layout.viewportHeight;
  const withinPoolX = mouseX >= layout.originX && mouseX <= layout.originX + layout.viewportWidth;
  const withinScrollbar = pointInRect(mouseX, mouseY, metrics.bounds);
  if (!(withinPoolX && withinPoolY) && !withinScrollbar) return;
  if (layout.maxScroll <= 0) return;

  const delta = event.delta;
  if (delta === 0) return;

  poolScroll = constrain(poolScroll + delta, 0, layout.maxScroll);
  drawScreen();
  return false;
}

function mouseMoved() {
  if (poolScrollDragging) return;
  if (typeof setHoverPreviewTarget !== "function") return;
  const hit = resolvePoolTileAt(mouseX, mouseY);
  if (hit) setHoverPreviewTarget({ genome: hit.genome, idx: hit.idx });
  else setHoverPreviewTarget(null);
}

function mouseOut() {
  if (typeof setHoverPreviewTarget !== "function") return;
  setHoverPreviewTarget(null);
}

function handlePoolClick(mx, my) {
  const hit = resolvePoolTileAt(mx, my);
  if (!hit) return;
  const genome = hit.genome;
  if (selectedParents.includes(genome)) selectedParents = selectedParents.filter(p => p !== genome);
  else selectedParents.push(genome);
  drawScreen();
}

function resolvePoolTileAt(mx, my) {
  const layout = calculatePoolLayout();
  const viewportBottom = layout.viewportTop + layout.viewportHeight;
  if (my < layout.viewportTop || my >= viewportBottom) return null;

  if (mx < layout.originX || mx >= layout.originX + layout.viewportWidth) return null;

  const localX = mx - layout.originX;
  const localY = my - layout.viewportTop + poolScroll;
  const c = floor(localX / layout.cellSize);
  const r = floor(localY / layout.cellSize);
  if (c < 0 || c >= layout.visibleCols || r < 0 || r >= layout.totalRows) return null;

  const innerX = localX - c * layout.cellSize;
  const innerY = localY - r * layout.cellSize;
  const margin = (layout.cellSize - layout.tile) / 2;
  if (innerX < margin || innerX > layout.cellSize - margin || innerY < margin || innerY > layout.cellSize - margin) return null;

  const idx = r * layout.visibleCols + c;
  if (idx < 0 || idx >= pool.length) return null;
  return { idx, genome: pool[idx] };
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
