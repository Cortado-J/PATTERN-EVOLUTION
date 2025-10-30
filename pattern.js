// === wallpaper rendering ===
// Implements motif generation and wallpaper tiling logic for genomes.
function drawWallpaperOn(pg, g) {
  let a = g.motifScale;
  let palette = ensureGenomeColors(g);
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
      
      // Apply rotational symmetries based on wallpaper group
      let rotations = 1; // Default: no rotation (just translation)
      if (g.group === "632") {
        rotations = 6; // 6-fold rotation
      } else if (g.group === "442") {
        rotations = 4; // 4-fold rotation
      } else if (g.group === "333") {
        rotations = 3; // 3-fold rotation
      } else if (g.group === "2222") {
        rotations = 2; // 2-fold rotation
      }
      
      // Draw rotated copies at each lattice position
      for (let r = 0; r < rotations; r++) {
        pg.push();
        pg.translate(p.x, p.y);
        pg.rotate((TWO_PI * r) / rotations);
        drawMotif(pg, motif);
        pg.pop();
      }
    }
  }
}

// === motif & shapes ===
function createMotif(pg, g, s, palette) {
  let motif = [];
  let paletteSet = palettes[g.palette];

  // Deterministic color selection per genome to avoid re-render color changes
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5) | 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Seed RNG purely from genome traits so previews and saved pool items match
  const seedBase = genomeHash(g);
  const rng = mulberry32(seedBase);

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
  const angleOffset = rng() * TWO_PI;
  const ringRadius = s * 0.85;

  function pickMode(baseMode) {
    if (baseMode !== "mixed") return baseMode;
    const pick = rng();
    if (pick < 0.33) return "overlap";
    if (pick < 0.66) return "touch";
    return "space";
  }

  let n = { "632": 6, "442": 4, "333": 3, "2222": 2 }[g.group];
  for (let i = 0; i < g.numShapes; i++) {
    let shape = g.shapes[i];
    const localMode = pickMode(mode);
    const angle = angleOffset + (TWO_PI * i) / count;
    let offsetRadius = 0;
    let baseScaleFactor = 1;
    if (localMode === "space") {
      offsetRadius = ringRadius;
      baseScaleFactor = 0.85;
    } else if (localMode === "touch") {
      offsetRadius = ringRadius * 0.6;
      baseScaleFactor = 0.95;
    }
    const noiseRadius = (rng() - 0.5) * ringRadius * 0.12;
    const jitterRadius = (shape?.radiusJitter ?? 0) * ringRadius;
    const jitterAngle = shape?.angleJitter ?? 0;
    const jitterScale = constrain(1 + (shape?.sizeJitter ?? 0), 0.4, 1.6);
    const finalAngle = angle + jitterAngle;
    const finalRadius = max(0, offsetRadius + noiseRadius + jitterRadius);
    const offsetX = cos(finalAngle) * finalRadius;
    const offsetY = sin(finalAngle) * finalRadius;
    const scaleFactor = baseScaleFactor * jitterScale;
    motif.push({
      type: shape.type,
      curveBias: shape.curveBias,
      fatness: shape.fatness,
      rotation: (TWO_PI / n) * i,
      colour: chosenCols[i % chosenCols.length],
      offsetX,
      offsetY,
      scaleFactor
    });
  }
  return motif;
}

function drawMotif(pg, motif) {
  if (!Array.isArray(motif)) return;
  for (let s of motif) {
    if (!s) continue;
    const ox = s.offsetX || 0;
    const oy = s.offsetY || 0;
    const scaleFactor = s.scaleFactor || 1;
    pg.push();
    pg.translate(ox, oy);
    if (abs(scaleFactor - 1) > 0.001) pg.scale(scaleFactor);
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
  switch (g?.group) {
    case "632":
      return { w: a * sqrt(3), h: a * 1.5 };
    case "442":
      return { w: a, h: a };
    case "333":
      return { w: a, h: a * sqrt(3) / 2 };
    case "2222":
      return { w: a, h: a * 0.6 };
    default:
      return { w: a, h: a };
  }
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
