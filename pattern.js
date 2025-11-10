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
  const globalScope = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this);
  if (typeof globalScope.palettes === "undefined" && typeof palettes !== "undefined") {
    globalScope.palettes = palettes;
  }
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
  const seedBase = genomeHash(Object.assign({}, g, { motifScale: g.seedMotifScale ?? g.motifScale }));
  const rng = splitmix32(seedBase);

  colorMode(HSB, 360, 100, 100);
  let chosenCols = [];
  const baseColorsHSB = ensureGenomeColors(g);
  for (let i = 0; i < g.numShapes; i++) {
    const baseCol = baseColorsHSB[(i) % max(1, baseColorsHSB.length)] || { h: 0, s: 60, b: 80 };
    const h = (baseCol.h + (g.hueShift || 0)) % 360;
    const sat = constrain(baseCol.s, 0, 100);
    const bri = constrain(baseCol.b, 0, 100);
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
    let baseScaleFactor = 1.05;
    if (localMode === "space") {
      baseRadiusFactor = 0.85;
      baseScaleFactor = 0.9;
    } else if (localMode === "touch") {
      baseRadiusFactor = 0.6;
      baseScaleFactor = 0.97;
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
    const baseSize = constrain(s * 1.35, 34, 95);
    const progressiveScale = count > 1 ? 1 - 0.3 * (i / (count - 1)) : 1;
    const finalSize = baseSize * progressiveScale;
    motif.push({
      type: shape.type,
      curveBias: shape.curveBias,
      fatness: shape.fatness,
      rotation: finalAngle + rng() * wedgeAngle * 0.1,
      colour: chosenCols[i % chosenCols.length],
      offsetX,
      offsetY,
      scaleFactor,
      size: finalSize
    });
  }
  return motif;
}

function drawMotifShape(pg, s) {
  if (!s) return;
  const ox = s.offsetX || 0;
  const oy = s.offsetY || 0;
  const scaleFactor = s.scaleFactor || 1;
  const baseSize = s.size || 40;
  pg.push();
  pg.translate(ox, oy);
  if (abs(scaleFactor - 1) > 0.001) pg.scale(scaleFactor);
  pg.fill(s.colour);
  pg.noStroke();
  pg.rotate(s.rotation);
  drawShapeVariant(pg, s.type, baseSize, s.curveBias, s.fatness);
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
    case "oval": {
      const rx = s * (0.45 + 0.4 * bias);
      const ry = s * (0.3 + 0.5 * fat);
      const segments = 18;
      for (let i = 0; i < segments; i++) {
        const angle = (TWO_PI * i) / segments;
        pg.vertex(rx * cos(angle), ry * sin(angle));
      }
      break;
    }
    case "heart": {
      const width = s * (0.55 + 0.35 * bias);
      const height = s * (0.65 + 0.25 * fat);
      pg.vertex(0, -height * 0.25);
      pg.bezierVertex(width * 0.6, -height, width, -height * 0.15, 0, height);
      pg.bezierVertex(-width, -height * 0.15, -width * 0.6, -height, 0, -height * 0.25);
      break;
    }
    case "crescent": {
      const outerR = s * (0.6 + 0.3 * fat);
      const innerR = outerR * (0.45 + 0.25 * bias);
      const offset = s * (0.2 + 0.2 * bias);
      const steps = 16;
      for (let i = 0; i <= steps; i++) {
        const angle = -HALF_PI + (PI * i) / steps;
        pg.vertex(outerR * cos(angle), outerR * sin(angle));
      }
      for (let i = steps; i >= 0; i--) {
        const angle = -HALF_PI + (PI * i) / steps;
        pg.vertex(innerR * cos(angle) - offset, innerR * sin(angle));
      }
      break;
    }
    case "wave": {
      const width = s * (0.8 + 0.2 * bias);
      const amplitude = s * (0.35 + 0.25 * fat);
      pg.vertex(-width * 0.5, amplitude * 0.2);
      pg.bezierVertex(-width * 0.35, -amplitude, -width * 0.15, -amplitude, 0, 0);
      pg.bezierVertex(width * 0.15, amplitude, width * 0.35, amplitude, width * 0.5, 0);
      pg.vertex(width * 0.5, amplitude * 0.45);
      pg.vertex(-width * 0.5, amplitude * 0.45);
      break;
    }
    case "shell": {
      const width = s * (0.55 + 0.3 * bias);
      const height = s * (0.75 + 0.2 * fat);
      pg.vertex(0, -height);
      pg.bezierVertex(width, -height * 0.6, width * 0.7, height * 0.2, 0, height * 0.85);
      pg.bezierVertex(-width * 0.7, height * 0.2, -width, -height * 0.6, 0, -height);
      pg.bezierVertex(width * 0.35, -height * 0.5, width * 0.25, -height * 0.2, 0, -height * 0.1);
      pg.bezierVertex(-width * 0.25, -height * 0.2, -width * 0.35, -height * 0.5, 0, -height);
      break;
    }
    case "diamond": {
      const width = s * (0.45 + 0.35 * bias);
      const height = s * (0.7 + 0.2 * fat);
      pg.vertex(0, -height);
      pg.vertex(width, 0);
      pg.vertex(0, height);
      pg.vertex(-width, 0);
      break;
    }
    case "arrow": {
      const shaftWidth = s * (0.18 + 0.2 * fat);
      const shaftLength = s * (0.45 + 0.3 * bias);
      const headWidth = s * (0.55 + 0.3 * bias);
      const headLength = s * (0.5 + 0.2 * fat);
      pg.vertex(-shaftWidth, -shaftLength);
      pg.vertex(shaftWidth, -shaftLength);
      pg.vertex(shaftWidth, 0);
      pg.vertex(headWidth, 0);
      pg.vertex(0, headLength);
      pg.vertex(-headWidth, 0);
      pg.vertex(-shaftWidth, 0);
      break;
    }
    case "cross": {
      const arm = s * (0.25 + 0.35 * fat);
      const thickness = s * (0.14 + 0.25 * bias);
      pg.vertex(-thickness, -arm);
      pg.vertex(thickness, -arm);
      pg.vertex(thickness, -thickness);
      pg.vertex(arm, -thickness);
      pg.vertex(arm, thickness);
      pg.vertex(thickness, thickness);
      pg.vertex(thickness, arm);
      pg.vertex(-thickness, arm);
      pg.vertex(-thickness, thickness);
      pg.vertex(-arm, thickness);
      pg.vertex(-arm, -thickness);
      pg.vertex(-thickness, -thickness);
      break;
    }
    case "trapezoid": {
      const bottom = s * (0.5 + 0.4 * fat);
      const top = s * (0.25 + 0.35 * bias);
      const height = s * (0.6 + 0.2 * fat);
      pg.vertex(-bottom, height * 0.5);
      pg.vertex(bottom, height * 0.5);
      pg.vertex(top, -height * 0.5);
      pg.vertex(-top, -height * 0.5);
      break;
    }
    case "zigzag": {
      const width = s * (0.55 + 0.35 * bias);
      const height = s * (0.65 + 0.25 * fat);
      pg.vertex(-width, -height * 0.3);
      pg.vertex(-width * 0.45, -height * 0.6);
      pg.vertex(0, -height * 0.1);
      pg.vertex(width * 0.45, -height * 0.6);
      pg.vertex(width, -height * 0.3);
      pg.vertex(width * 0.25, height * 0.6);
      pg.vertex(-width * 0.25, height * 0.6);
      break;
    }
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
