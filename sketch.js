// === Interactive Wallpaper Evolution UI ===

let population = [];
let palettes;
let history = [];
let gen = 0;
let mode = "mutate"; // "mutate", "combine", "random"
let selectedParents = [];
let previewGenome = null;
let wq, hq;
let thumbH = 100;

function setup() {
  createCanvas(1000, 1000);
  angleMode(RADIANS);
  noLoop();

  wq = width / 2;
  hq = (height * 0.7) / 2;

  palettes = {
    warm: ["#e63946", "#f1faee", "#a8dadc", "#ffbe0b", "#fb5607"],
    cool: ["#457b9d", "#1d3557", "#a8dadc", "#118ab2", "#06d6a0"],
    earth: ["#2a9d8f", "#e9c46a", "#f4a261", "#264653", "#dda15e"],
    vivid: ["#ffb703", "#fb8500", "#023047", "#8ecae6", "#219ebc"]
  };

  for (let i = 0; i < 4; i++) population.push(randomGenome());
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
function mutateGenome(g) {
  let m = structuredClone(g);
  m.hueShift += random(-10, 10);
  m.motifScale *= random(0.8, 1.3);
  if (random() < 0.3) m.palette = random(Object.keys(palettes));
  if (random() < 0.3) m.group = random(["632", "442", "333", "2222"]);
  for (let s of m.shapes) {
    if (random() < 0.5) s.fatness += random(-0.1, 0.1);
  }
  return m;
}

function combineGenomes(a, b) {
  let c = structuredClone(a);
  c.palette = random([a.palette, b.palette]);
  c.group = random([a.group, b.group]);
  c.hueShift = (a.hueShift + b.hueShift) / 2 + random(-10, 10);
  c.motifScale = (a.motifScale + b.motifScale) / 2 * random(0.9, 1.1);
  c.shapes = [];
  let n = floor(random(min(a.shapes.length, b.shapes.length), max(a.shapes.length, b.shapes.length) + 1));
  for (let i = 0; i < n; i++) {
    let parent = random([a, b]);
    c.shapes.push(structuredClone(random(parent.shapes)));
  }
  c.numShapes = c.shapes.length;
  return c;
}

// === draw ===
function drawScreen() {
  background(245);
  drawQuadrants();
  drawHistory();
  drawModeButtons();
  if (previewGenome) drawPreview();
}

function drawQuadrants() {
  for (let q = 0; q < 4; q++) {
    let g = population[q];
    let x0 = (q % 2) * wq;
    let y0 = floor(q / 2) * hq;
    drawQuadrant(g, x0, y0, wq, hq);
  }
}

function drawQuadrant(g, x, y, w, h) {
  let pg = createGraphics(w, h);
  pg.background(240);
  pg.translate(w / 2, h / 2);
  drawWallpaperOn(pg, g);
  image(pg, x, y);
  stroke(0);
  strokeWeight(4);
  noFill();
  rect(x, y, w, h);
  fill(0);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(18);
  text(g.group, x + w / 2, y + 20);
}

function drawHistory() {
  let y = height * 0.7;
  let thumbW = width / 10;
  for (let i = 0; i < history.length; i++) {
    let g = history[i];
    let pg = createGraphics(thumbW, thumbH);
    pg.background(255);
    pg.translate(pg.width / 2, pg.height / 2);
    pg.scale(0.3);
    drawWallpaperOn(pg, g);
    image(pg, i * thumbW, y);
    stroke(0);
    noFill();
    rect(i * thumbW, y, thumbW, thumbH);
  }
  fill(0);
  textAlign(LEFT, CENTER);
  textSize(18);
  text(`Generation ${gen}`, 10, y + thumbH + 20);
}

function drawModeButtons() {
  let y = height * 0.9;
  let labels = ["Mutate", "Combine", "Random"];
  let wbtn = width / 3;
  for (let i = 0; i < 3; i++) {
    let x = i * wbtn;
    fill(mode === labels[i].toLowerCase() ? "#ffb703" : 255);
    stroke(0);
    rect(x, y, wbtn, 50);
    fill(0);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(20);
    text(labels[i], x + wbtn / 2, y + 25);
  }
}

function drawPreview() {
  let pg = createGraphics(300, 300);
  pg.background(255);
  pg.translate(pg.width / 2, pg.height / 2);
  drawWallpaperOn(pg, previewGenome);
  image(pg, width / 2 - 150, height / 2 - 150);
  stroke(0);
  noFill();
  rect(width / 2 - 150, height / 2 - 150, 300, 300);
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(24);
  text("Preview", width / 2, height / 2 - 180);
  drawAcceptRejectButtons();
}

function drawAcceptRejectButtons() {
  let bx = width / 2 - 100;
  let by = height / 2 + 180;
  fill("#06d6a0");
  rect(bx, by, 80, 40);
  fill("#ef233c");
  rect(bx + 140, by, 80, 40);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  text("Accept", bx + 40, by + 20);
  text("Reject", bx + 180, by + 20);
}

// === interaction ===
function mousePressed() {
  if (previewGenome) {
    // accept/reject buttons
    let bx = width / 2 - 100;
    let by = height / 2 + 180;
    if (mouseY > by && mouseY < by + 40) {
      if (mouseX > bx && mouseX < bx + 80) acceptPreview();
      if (mouseX > bx + 140 && mouseX < bx + 220) rejectPreview();
    }
    return;
  }

  // mode buttons
  let ybtn = height * 0.9;
  if (mouseY > ybtn && mouseY < ybtn + 50) {
    let idx = floor(mouseX / (width / 3));
    mode = ["mutate", "combine", "random"][idx];
    redraw();
    return;
  }

  // top 4 quadrants
  if (mouseY < height * 0.7) {
    let qx = floor(mouseX / wq);
    let qy = floor(mouseY / hq);
    let index = qx + 2 * qy;
    if (index < population.length) handleSelection(population[index]);
  }

  // history thumbnails
  let yhist = height * 0.7;
  if (mouseY > yhist && mouseY < yhist + thumbH) {
    let idx = floor(mouseX / (width / 10));
    if (idx < history.length) handleSelection(history[idx]);
  }
}

function handleSelection(g) {
  if (mode === "mutate") previewGenome = mutateGenome(g);
  else if (mode === "combine") {
    selectedParents.push(g);
    if (selectedParents.length === 2) {
      previewGenome = combineGenomes(selectedParents[0], selectedParents[1]);
      selectedParents = [];
    }
  } else if (mode === "random") previewGenome = randomGenome();
  drawScreen();
}

function acceptPreview() {
  population = [];
  for (let i = 0; i < 4; i++) population.push(mutateGenome(previewGenome));
  history.push(previewGenome);
  if (history.length > 10) history.splice(0, history.length - 10);
  previewGenome = null;
  gen++;
  drawScreen();
}

function rejectPreview() {
  previewGenome = null;
  drawScreen();
}

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
  colorMode(HSB, 360, 100, 100);
  let chosenCols = [];
  for (let i = 0; i < g.numShapes; i++) {
    let base = color(random(paletteSet));
    let h = (hue(base) + g.hueShift + random(-8, 8)) % 360;
    let sat = constrain(saturation(base) + random(-10, 10), 40, 100);
    let bri = constrain(brightness(base) + random(-10, 10), 40, 100);
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
