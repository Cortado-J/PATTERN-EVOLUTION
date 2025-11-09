// === wallpaper rendering ===
// Implements motif generation and wallpaper tiling logic for genomes.
// Lattice and transform helpers have been moved to wallpaper_math.js

function drawWallpaperOn(pg, g) {
  const a = g.motifScale;
  const spec = getGroupSpec(g.group);
  const motif = createMotif(pg, g, a * 0.4, ensureGenomeColors(g), spec);

  const cellBounds = estimateCellSize({ group: g.group, motifScale: a });
  const cellW = Math.max(1, cellBounds.w || 1);
  const cellH = Math.max(1, cellBounds.h || 1);
  const rangeX = Math.ceil((pg.width || 0) / (2 * cellW)) + 3;
  const rangeY = Math.ceil((pg.height || 0) / (2 * cellH)) + 3;
  const diagonal = Math.hypot(pg.width || 0, pg.height || 0);
  const minCell = Math.max(1, Math.min(cellW, cellH));
  const rangeDiag = Math.ceil(diagonal / (2 * minCell)) + 3;
  const tileRange = Math.max(6, rangeX, rangeY, rangeDiag);

  const relTransforms = buildTransformSet(spec, a);
  const baseRotation = matAbout(matRotate(g.rotation || 0), 0, 0);
  const transforms = relTransforms.map(M => matMul(M, baseRotation));

  for (const shape of motif){
    for (let i=-tileRange; i<=tileRange; i++){
      for (let j=-tileRange; j<=tileRange; j++){
        const p = latticePointFrom(spec, a, i, j);
        const Tcell = matTranslate(p.x, p.y);
        for (const M of transforms){
          const Mp = matMul(Tcell, M);
          pg.push();
          pg.applyMatrix(Mp.a, Mp.b, Mp.c, Mp.d, Mp.e, Mp.f);
          drawMotifShape(pg, shape);
          pg.pop();
        }
      }
    }
  }

  drawSymmetryGuides(pg, spec, g, { a, tileRange });
}



// === motif & shapes ===
function createMotif(pg, g, s, palette, spec) {
  let motif = [];
  let paletteSet = palettes[g.palette];

  // Stateful stream
  function splitmix32(a) {
    return function () {
      let z = (a += 0x9e3779b9) | 0;           // Weyl sequence
      z ^= z >>> 16;  z = Math.imul(z, 0x21f0aaad);
      z ^= z >>> 15;  z = Math.imul(z, 0x735a2d97);
      z ^= z >>> 15;
      return ((z >>> 0) / 4294967296);
    };
  }
  // Seed RNG purely from genome traits so previews and saved pool items match
  const seedBase = genomeHash(g);
  const rng = splitmix32(seedBase);

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

  const validModes = typeof OVERLAP_MODES !== "undefined" ? OVERLAP_MODES : ["overlap", "touch", "space", "mixed"]; 
  const mode = validModes.includes(g.overlapMode) ? g.overlapMode : "overlap";
  const count = max(1, g.numShapes || 0);
  const ringRadius = s * 0.85;
  const order = symmetryOrder(spec);
  const wedgeAngle = TWO_PI / order;
  const angularMargin = wedgeAngle * 0.45;

  function pickMode(baseMode) {
    if (baseMode !== "mixed") return baseMode;
    const pick = rng();
    if (pick < 0.33) return "overlap";
    if (pick < 0.66) return "touch";
    return "space";
  }

  for (let i = 0; i < g.numShapes; i++) {
    let shape = g.shapes[i];
    const localMode = pickMode(mode);
    let baseRadiusFactor = 0.35;
    let baseScaleFactor = 1;
    if (localMode === "space") {
      baseRadiusFactor = 0.85;
      baseScaleFactor = 0.85;
    } else if (localMode === "touch") {
      baseRadiusFactor = 0.6;
      baseScaleFactor = 0.95;
    }
    const offsetRadius = ringRadius * baseRadiusFactor;
    const noiseRadius = (rng() - 0.5) * ringRadius * 0.12;
    const jitterRadius = (shape?.radiusJitter ?? 0) * ringRadius;
    const jitterAngle = shape?.angleJitter ?? 0;
    const jitterScale = constrain(1 + (shape?.sizeJitter ?? 0), 0.4, 1.6);
    const baseAngle = -angularMargin + ((i + 0.5) / count) * angularMargin * 2;
    const randomAngle = (rng() - 0.5) * angularMargin * 0.35;
    const finalAngle = baseAngle + randomAngle + jitterAngle;
    const finalRadius = max(0, offsetRadius + noiseRadius + jitterRadius);
    const offsetX = cos(finalAngle) * finalRadius;
    const offsetY = sin(finalAngle) * finalRadius;
    const scaleFactor = baseScaleFactor * jitterScale;
    motif.push({
      type: shape.type,
      curveBias: shape.curveBias,
      fatness: shape.fatness,
      rotation: finalAngle + rng() * wedgeAngle * 0.1,
      colour: chosenCols[i % chosenCols.length],
      offsetX,
      offsetY,
      scaleFactor
    });
  }
  return motif;
}

function drawMotifShape(pg, s) {
  if (!s) return;
  const ox = s.offsetX || 0;
  const oy = s.offsetY || 0;
  const scaleFactor = s.scaleFactor || 1;
  pg.push();
  pg.translate(ox, oy);
  if (abs(scaleFactor - 1) > 0.001) pg.scale(scaleFactor);
  pg.fill(s.colour);
  pg.noStroke();
  pg.rotate(s.rotation);
  drawShapeVariant(pg, s.type, 40, s.curveBias, s.fatness);
  pg.pop();
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
    case "bar":
      pg.vertex(-s * 0.5, -s * 0.15);
      pg.vertex(s * 0.5, -s * 0.15);
      pg.vertex(s * 0.5, s * 0.15);
      pg.vertex(-s * 0.5, s * 0.15);
      break;
    case "triangle":
      pg.vertex(0, -s * 0.6);
      pg.vertex(s * 0.5, s * 0.4);
      pg.vertex(-s * 0.5, s * 0.4);
      break;
    case "kite":
      pg.vertex(0, -s * 0.7);
      pg.vertex(s * 0.45, 0);
      pg.vertex(0, s * 0.7);
      pg.vertex(-s * 0.45, 0);
      break;
    case "spoke":
      pg.vertex(-s * 0.1, -s * 0.7);
      pg.vertex(s * 0.1, -s * 0.7);
      pg.vertex(s * 0.1, s * 0.2);
      pg.vertex(s * 0.4, s * 0.2);
      pg.vertex(s * 0.4, s * 0.4);
      pg.vertex(-s * 0.4, s * 0.4);
      pg.vertex(-s * 0.4, s * 0.2);
      pg.vertex(-s * 0.1, s * 0.2);
      break;
    case "chevron":
      pg.vertex(-s * 0.6, -s * 0.2);
      pg.vertex(-s * 0.3, -s * 0.5);
      pg.vertex(0, -s * 0.2);
      pg.vertex(s * 0.3, -s * 0.5);
      pg.vertex(s * 0.6, -s * 0.2);
      pg.vertex(0, s * 0.6);
      break;
  }
  pg.endShape(CLOSE);
}

function estimateCellSize(g) {
  const a = g?.motifScale || 1;
  const spec = getGroupSpec(g?.group);
  const corners = [
    { x: 0, y: 0 },
    { x: spec.basis[0].x, y: spec.basis[0].y },
    { x: spec.basis[1].x, y: spec.basis[1].y },
    {
      x: spec.basis[0].x + spec.basis[1].x,
      y: spec.basis[0].y + spec.basis[1].y,
    },
  ].map(v => ({ x: v.x * a, y: v.y * a }));
  const xs = corners.map(c => c.x);
  const ys = corners.map(c => c.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return {
    w: width || a,
    h: height || a,
  };
}

function displayScaleForPattern(g, width, height, repeats = 3) {
  const { w: cellW, h: cellH } = estimateCellSize(g);
  const targetRepeats = max(1, repeats);
  const safeCW = max(1, cellW || 1);
  const safeCH = max(1, cellH || 1);
  const scaleX = width / (targetRepeats * safeCW);
  const scaleY = height / (targetRepeats * safeCH);
  const scale = min(1, scaleX, scaleY);
  return max(scale, 0.0001);
}
