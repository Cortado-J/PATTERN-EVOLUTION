// === wallpaper rendering ===
// Implements motif generation and wallpaper tiling logic for genomes.
const GROUP_SPECS = {
  "632": {
    order: 6,
    basis: [
      { x: Math.sqrt(3), y: 0 },
      { x: Math.sqrt(3) / 2, y: 1.5 },
    ],
  },
  "*632": {
    order: 6,
    basis: [
      { x: Math.sqrt(3), y: 0 },
      { x: Math.sqrt(3) / 2, y: 1.5 },
    ],
    mirrorAngles: [0, Math.PI / 6],
  },
  "442": {
    order: 4,
    basis: [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
  },
  "*442": {
    order: 4,
    basis: [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
    mirrorAngles: [0, Math.PI / 4],
  },
  "4*2": {
    order: 4,
    basis: [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
    glideAngles: [Math.PI / 4],
    glideOffsets: [{ u: 0.5, v: 0.5 }],
  },
  "333": {
    order: 3,
    basis: [
      { x: 1, y: 0 },
      { x: 0.5, y: Math.sqrt(3) / 2 },
    ],
  },
  "*333": {
    order: 3,
    basis: [
      { x: 1, y: 0 },
      { x: 0.5, y: Math.sqrt(3) / 2 },
    ],
    mirrorAngles: [0, Math.PI / 3],
  },
  "3*3": {
    order: 3,
    basis: [
      { x: 1, y: 0 },
      { x: 0.5, y: Math.sqrt(3) / 2 },
    ],
    mirrorAngles: [0, Math.PI / 3, (2 * Math.PI) / 3],
    mirrorOffsets: [{ u: 1 / 3, v: 1 / 3 }],
  },
  "2222": {
    order: 2,
    basis: [
      { x: 1, y: 0 },
      { x: 0.5, y: 0.6 },
    ],
  },
  "2*22": {
    order: 2,
    basis: [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
    mirrorAngles: [Math.PI / 4, (3 * Math.PI) / 4],
    mirrorOffsets: [{ u: 0, v: 0 }],
  },
  "*2222": {
    order: 2,
    basis: [
      { x: 1, y: 0 },
      { x: 0.5, y: 0.6 },
    ],
    mirrorAngles: [0, Math.PI / 2],
  },
  "22*": {
    order: 2,  // 2-fold rotation (0° and 180°)
    basis: [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
    mirrorAngles: [Math.PI / 2],  // vertical mirrors
    rotationOffsets: [{ u: 0, v: 0 }, { u: 0.5, v: 0.5 }],  // rotation centers at lattice points and (a/2, b/2)
    mirrorOffsets: [{ u: 0, v: 0 }, { u: 0.5, v: 0.5 }],  // mirrors at same positions as rotations for pmg
    // pmg: vertical mirrors + offset rotation centers = horizontal glides emerge
  },
  "22x": {
    order: 1,  // We'll handle the operations manually
    basis: [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
    // pgg requires explicit glide reflections, not just rotation centers
    // Mark this as requiring special handling
    requiresSpecialHandling: true,
  },
  "o": {
    // P1 - simplest wallpaper group, only translations
    order: 1,  // No rotations
    basis: [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
    // No mirrors, no glides, no special operations
    // Just the motif repeated at each lattice point
  },
};

function getGroupSpec(key) {
  if (GROUP_SPECS[key]) return GROUP_SPECS[key];
  return GROUP_SPECS["442"]; // fallback to square lattice
}

function latticePointFrom(spec, a, i, j) {
  const b1 = spec.basis[0];
  const b2 = spec.basis[1];
  const x = (i * b1.x + j * b2.x) * a;
  const y = (i * b1.y + j * b2.y) * a;
  return createVector(x, y);
}
function drawWallpaperOn(pg, g) {
  const a = g.motifScale;
  const spec = getGroupSpec(g.group);
  
  // Debug: Check if 22x is being processed
  let debugDrawCount = 0;
  if (g.group === "22x") {
    console.log("=== drawWallpaperOn called with 22x ===");
    console.log("Group spec:", spec);
    console.log("requiresSpecialHandling:", spec.requiresSpecialHandling);
  }
  
  const wedge = TWO_PI / spec.order;
  const hasMirrors = Array.isArray(spec.mirrorAngles) && spec.mirrorAngles.length > 0;
  const alpha = hasMirrors ? spec.mirrorAngles[0] : 0; // one representative mirror axis in world coords
  const mirrorAnglesArr = Array.isArray(spec.mirrorAngles) ? spec.mirrorAngles : [];
  const mirrorOffsets = (Array.isArray(spec.mirrorOffsets) && spec.mirrorOffsets.length) ? spec.mirrorOffsets : [{ u: 0, v: 0 }];
  const rotationOffsets = (Array.isArray(spec.rotationOffsets) && spec.rotationOffsets.length) ? spec.rotationOffsets : [{ u: 0, v: 0 }];
  const hasGlides = Array.isArray(spec.glideAngles) && spec.glideAngles.length > 0;
  const motif = createMotif(pg, g, a * 0.4, ensureGenomeColors(g), spec);
  const base = g.rotation || 0;
  const tileRange = 4;

  // helper: reflect about world-angle `alpha` after rotating by `theta`
  function reflectAbout(pg, alpha, theta) {
    const delta = alpha - theta;    // conjugation: R(theta)^{-1} M(alpha) R(theta)
    pg.rotate(delta);
    pg.scale(1, -1);
    pg.rotate(-delta);
  }

  for (const shape of motif) {
    for (let i = -tileRange; i <= tileRange; i++) {
      for (let j = -tileRange; j <= tileRange; j++) {
        const p = latticePointFrom(spec, a, i, j);
        
        // Special handling for 22x (pgg) - explicit glide reflections
        if (g.group === "22x") {
          // Debug logging for 22x pattern
          if (i === 0 && j === 0 && shape === motif[0]) {
            console.log("=== 22x (pgg) Debug Info ===");
            console.log("Genome:", g);
            console.log("motifScale (a):", a);
            console.log("base rotation:", base);
            console.log("Number of shapes in motif:", motif.length);
            console.log("First shape:", shape);
            console.log("Lattice point (0,0):", p);
            console.log("Unit cell size:", a);
            console.log("Positions for 4 copies:");
            console.log("  1. Original at:", p.x, p.y);
            console.log("  2. H-glide at:", p.x + a/2, p.y, "with vertical flip");
            console.log("  3. V-glide at:", p.x, p.y + a/2, "with horizontal flip");
            console.log("  4. Double at:", p.x + a/2, p.y + a/2, "with 180° rotation");
          }
          
          // pgg pattern from glide reflections (matching reference code case 6)
          // For pgg, ignore base rotation - the pattern is defined by glides
          // This matches how the reference code handles pgg (case 6)
          
          // 1. Original motif at lattice point
          pg.push();
          pg.translate(p.x, p.y);
          drawMotifShape(pg, shape);
          pg.pop();
          debugDrawCount++;
          
          // 2. Horizontal glide: translate by a/2, reflect vertically
          pg.push();
          pg.translate(p.x + a/2, p.y);
          pg.scale(1, -1);
          drawMotifShape(pg, shape);
          pg.pop();
          debugDrawCount++;
          
          // 3. Vertical glide: translate by a/2, reflect horizontally  
          pg.push();
          pg.translate(p.x, p.y + a/2);
          pg.scale(-1, 1);
          drawMotifShape(pg, shape);
          pg.pop();
          debugDrawCount++;
          
          // 4. Double glide: both transformations = 180° rotation
          pg.push();
          pg.translate(p.x + a/2, p.y + a/2);
          pg.scale(-1, -1);
          drawMotifShape(pg, shape);
          pg.pop();
          debugDrawCount++;
          
          continue;  // Skip standard handling for 22x
        }
        
        // Standard handling for all other groups including 22*
        for (const rotOfst of rotationOffsets) {
          const rx = (rotOfst.u * spec.basis[0].x + rotOfst.v * spec.basis[1].x) * a;
          const ry = (rotOfst.u * spec.basis[0].y + rotOfst.v * spec.basis[1].y) * a;
          
          for (let r = 0; r < spec.order; r++) {
            const theta = base + r * wedge;

            // chiral copy at rotation offset
            pg.push();
            pg.translate(p.x + rx, p.y + ry);
            pg.rotate(theta);
            drawMotifShape(pg, shape);
            pg.pop();

            if (hasMirrors) {
              // mirrored copies for all specified mirror angles
              for (const ang of mirrorAnglesArr) {
                for (const ofst of mirrorOffsets) {
                  const mx = (ofst.u * spec.basis[0].x + ofst.v * spec.basis[1].x) * a;
                  const my = (ofst.u * spec.basis[0].y + ofst.v * spec.basis[1].y) * a;
                  pg.push();
                  pg.translate(p.x + mx, p.y + my);
                  pg.rotate(theta);
                  reflectAbout(pg, ang, theta);
                  drawMotifShape(pg, shape);
                  pg.pop();
                }
              }
            }
          }
        }
        
        // Handle explicit glides
        if (hasGlides) {
          for (let r = 0; r < spec.order; r++) {
            const theta = base + r * wedge;
            const ga = spec.glideAngles[0];
            const glides = (Array.isArray(spec.glideOffsets) && spec.glideOffsets.length) ? spec.glideOffsets : [{ u: 0.5, v: 0.5 }];
            for (const ofst of glides) {
              const gx = (ofst.u * spec.basis[0].x + ofst.v * spec.basis[1].x) * a;
              const gy = (ofst.u * spec.basis[0].y + ofst.v * spec.basis[1].y) * a;
              pg.push();
              pg.translate(p.x + gx, p.y + gy);
              pg.rotate(theta);
              // Apply glide reflection
              pg.rotate(ga);
              pg.scale(1, -1);
              pg.rotate(-ga);
              drawMotifShape(pg, shape);
              pg.pop();
            }
          }
        }
      }
    }
  }

  if (typeof showSymmetryGuides !== "undefined" && showSymmetryGuides) {
    const b1 = spec.basis[0];
    const b2 = spec.basis[1];
    const L = 5000;
    pg.push();
    pg.noFill();
    if (hasMirrors) {
      pg.stroke(0, 180, 255, 160);
      pg.strokeWeight(1);
      for (const ang of mirrorAnglesArr) {
        for (const ofst of mirrorOffsets) {
          const ox = (ofst.u * b1.x + ofst.v * b2.x) * a;
          const oy = (ofst.u * b1.y + ofst.v * b2.y) * a;
          const dx = Math.cos(ang);
          const dy = Math.sin(ang);
          for (let i = -tileRange; i <= tileRange; i++) {
            for (let j = -tileRange; j <= tileRange; j++) {
              const p = latticePointFrom(spec, a, i, j);
              const cx = p.x + ox;
              const cy = p.y + oy;
              pg.line(cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L);
            }
          }
        }
      }
    }
    if (hasGlides) {
      const glideAnglesArr = Array.isArray(spec.glideAngles) ? spec.glideAngles : [];
      const glideOffsets = (Array.isArray(spec.glideOffsets) && spec.glideOffsets.length) ? spec.glideOffsets : [{ u: 0.5, v: 0.5 }];
      pg.stroke(255, 0, 160, 160);
      pg.strokeWeight(1);
      for (const ang of glideAnglesArr) {
        for (const ofst of glideOffsets) {
          const ox = (ofst.u * b1.x + ofst.v * b2.x) * a;
          const oy = (ofst.u * b1.y + ofst.v * b2.y) * a;
          const dx = Math.cos(ang);
          const dy = Math.sin(ang);
          for (let i = -tileRange; i <= tileRange; i++) {
            for (let j = -tileRange; j <= tileRange; j++) {
              const p = latticePointFrom(spec, a, i, j);
              const cx = p.x + ox;
              const cy = p.y + oy;
              pg.line(cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L);
            }
          }
        }
      }
    }
    // Show rotation centers for 22*
    if (g.group === "22*" && spec.rotationOffsets) {
      pg.noStroke();
      pg.fill(255, 200, 0, 120); // Orange for 22*
      for (const center of spec.rotationOffsets) {
        for (let i = -tileRange; i <= tileRange; i++) {
          for (let j = -tileRange; j <= tileRange; j++) {
            const p = latticePointFrom(spec, a, i, j);
            const cx = (center.u * b1.x + center.v * b2.x) * a;
            const cy = (center.u * b1.y + center.v * b2.y) * a;
            pg.ellipse(p.x + cx, p.y + cy, 8, 8);
          }
        }
      }
    }
    
    // Show glide axes for 22x (pgg)
    if (g.group === "22x") {
      pg.strokeWeight(2);
      pg.noFill();
      
      // Horizontal glide axes at y = 0 and y = 0.5
      pg.stroke(255, 0, 160, 160); // Magenta for horizontal glides
      for (let i = -tileRange; i <= tileRange; i++) {
        for (let j = -tileRange; j <= tileRange; j++) {
          const p = latticePointFrom(spec, a, i, j);
          // Glide at y = 0 (through lattice points)
          pg.line(p.x - L, p.y, p.x + L, p.y);
          // Glide at y = 0.5
          pg.line(p.x - L, p.y + a/2, p.x + L, p.y + a/2);
        }
      }
      
      // Vertical glide axes at x = 0 and x = 0.5
      pg.stroke(0, 255, 160, 160); // Cyan for vertical glides
      for (let i = -tileRange; i <= tileRange; i++) {
        for (let j = -tileRange; j <= tileRange; j++) {
          const p = latticePointFrom(spec, a, i, j);
          // Glide at x = 0 (through lattice points)
          pg.line(p.x, p.y - L, p.x, p.y + L);
          // Glide at x = 0.5
          pg.line(p.x + a/2, p.y - L, p.x + a/2, p.y + L);
        }
      }
      
      // Show the four 2-fold rotation centers that result from the glides
      pg.noStroke();
      pg.fill(255, 200, 0, 80); // Semi-transparent orange
      for (let i = -tileRange; i <= tileRange; i++) {
        for (let j = -tileRange; j <= tileRange; j++) {
          const p = latticePointFrom(spec, a, i, j);
          // Centers at (0,0), (a/2,0), (0,a/2), (a/2,a/2)
          pg.ellipse(p.x, p.y, 6, 6);
          pg.ellipse(p.x + a/2, p.y, 6, 6);
          pg.ellipse(p.x, p.y + a/2, 6, 6);
          pg.ellipse(p.x + a/2, p.y + a/2, 6, 6);
        }
      }
    }
    pg.pop();
  }
  
  // Report debug info for 22x
  if (g.group === "22x") {
    console.log("=== 22x Pattern Complete ===");
    console.log("Total shapes drawn:", debugDrawCount);
    console.log("Expected: ~", motif.length * 4 * (tileRange * 2 + 1) * (tileRange * 2 + 1), 
                "(", motif.length, "shapes × 4 copies ×", (tileRange * 2 + 1) * (tileRange * 2 + 1), "tiles)");
    console.log("=============================");
  }
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
  const order = spec?.order || 1;
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
