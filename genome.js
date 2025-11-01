/*
 * Genome model overview
 * ---------------------
 * Each wallpaper genome encapsulates the traits that drive rendering:
 *   - overlapMode: spatial relationship among motif shapes ("overlap" | "touch" | "space" | "mixed").
 *   - group: wallpaper symmetry group id ("632", "442", "333", "2222").
 *   - shapeStyle: desired shape vocabulary ("curved" | "straight" | "mixed").
 *   - palette: key into the shared palettes map.
 *   - motifScale, rotation, hueShift: numeric controls for motif tiling and colour.
 *   - shapes: ordered array of motif parts, each with type, curveBias, fatness.
 *   - numShapes mirrors shapes.length for quick reference during mutation/mixing.
 *
 * `withMeta` decorates raw genomes with UI bookkeeping (id, timestamps, selectCount).
 * `randomGenome` seeds a fresh genome with randomly chosen traits.
 * `mutateGenome` produces a tweaked clone, respecting bounds so changes stay viewable.
 * `mixGenomes` (and legacy `combineGenomes`) fuse multiple parents using either
 * random-trait selection or averaging, with optional palette override, then apply
 * a light mutation pass for variation.
 * Supporting helpers (`genomeHash`, etc.) keep previews deterministic.
 */
const CURVED_SHAPES = ["petal", "leaf", "blade", "drop", "arc"];
const STRAIGHT_SHAPES = ["bar", "triangle", "kite", "spoke", "chevron"];
const OVERLAP_MODES = ["overlap", "touch", "space", "mixed"];
const OVERLAP_SUMMARY_CODES = {
  overlap: "Oo",
  touch: "Ot",
  space: "Os",
  mixed: "Om",
};
const SHAPE_STYLE_SUMMARY_CODES = {
  curved: "Sc",
  straight: "Ss",
  mixed: "Sm",
};

function normalizeColorHSB(colorHSB) {
  if (!colorHSB) return { h: 0, s: 60, b: 80 };
  const h = ((colorHSB.h ?? 0) % 360 + 360) % 360;
  const s = constrain(colorHSB.s ?? 60, 0, 100);
  const b = constrain(colorHSB.b ?? 80, 0, 100);
  return { h, s, b };
}

function cloneColors(colors = []) {
  return colors.map(c => normalizeColorHSB({ ...c }));
}

function paletteColorsForKey(key) {
  if (!key || !palettes || !palettes[key]) return [];
  return palettes[key].map(hex => normalizeColorHSB(hexToHSB(hex)));
}

function ensureGenomeColors(g) {
  if (!g) return [];
  if (!Array.isArray(g.colors) || g.colors.length === 0) {
    g.colors = paletteColorsForKey(g.palette);
  } else {
    g.colors = g.colors.map(normalizeColorHSB);
  }
  return g.colors;
}

function hexToHSB(hex) {
  if (typeof hex !== "string") return { h: 0, s: 0, b: 100 };
  let str = hex.trim().replace(/^#/, "");
  if (str.length === 3) {
    str = str.split("").map(ch => ch + ch).join("");
  }
  if (str.length !== 6) return { h: 0, s: 0, b: 100 };
  const intVal = parseInt(str, 16);
  if (Number.isNaN(intVal)) return { h: 0, s: 0, b: 100 };
  const r = (intVal >> 16) & 0xff;
  const g = (intVal >> 8) & 0xff;
  const b = intVal & 0xff;
  return rgbToHSB(r, g, b);
}

function rgbToHSB(r, g, b) {
  const rn = constrain(r, 0, 255) / 255;
  const gn = constrain(g, 0, 255) / 255;
  const bn = constrain(b, 0, 255) / 255;
  const maxVal = Math.max(rn, gn, bn);
  const minVal = Math.min(rn, gn, bn);
  const delta = maxVal - minVal;

  let h;
  if (delta === 0) {
    h = 0;
  } else if (maxVal === rn) {
    h = ((gn - bn) / delta) % 6;
  } else if (maxVal === gn) {
    h = (bn - rn) / delta + 2;
  } else {
    h = (rn - gn) / delta + 4;
  }
  h = (h * 60 + 360) % 360;

  const s = maxVal === 0 ? 0 : (delta / maxVal) * 100;
  const v = maxVal * 100;

  return { h, s, b: v };
}

function mutateColorHSB(colorHSB, rate = 0.2) {
  const base = normalizeColorHSB(colorHSB);
  const scaledRate = constrain(rate, 0, 1.5);
  const baseScale = 0.05 + scaledRate * 0.7;
  const jumpScale = 0.18 + scaledRate;

  const hueSmall = random(-14, 14) * baseScale;
  const satSmall = random(-10, 10) * baseScale;
  const briSmall = random(-10, 10) * baseScale;

  const hueJumpChance = constrain(0.05 + scaledRate * 0.18, 0.05, 0.35);
  const toneJumpChance = constrain(0.04 + scaledRate * 0.14, 0.04, 0.25);

  const hueJump = random() < hueJumpChance ? random(-160, 160) * jumpScale : 0;
  const satJump = random() < toneJumpChance ? random(-50, 50) * (jumpScale * 0.6) : 0;
  const briJump = random() < toneJumpChance ? random(-50, 50) * (jumpScale * 0.6) : 0;

  const hueDelta = hueSmall + hueJump;
  const satDelta = satSmall + satJump;
  const briDelta = briSmall + briJump;
  return normalizeColorHSB({
    h: base.h + hueDelta,
    s: base.s + satDelta,
    b: base.b + briDelta,
  });
}

function lerpHueDeg(a, b, t) {
  const delta = ((b - a + 540) % 360) - 180;
  return ((a + delta * constrain(t, 0, 1)) % 360 + 360) % 360;
}

function averageHue(hues = []) {
  if (!hues.length) return 0;
  let sumX = 0;
  let sumY = 0;
  for (const h of hues) {
    const rad = radians(h);
    sumX += cos(rad);
    sumY += sin(rad);
  }
  let angle = degrees(atan2(sumY, sumX));
  if (angle < 0) angle += 360;
  return angle % 360;
}

function allowedTypesForStyle(style) {
  if (style === "curved") return CURVED_SHAPES;
  if (style === "straight") return STRAIGHT_SHAPES;
  return CURVED_SHAPES.concat(STRAIGHT_SHAPES);
}

function randomShape(template = null, style = "mixed") {
  const allowed = allowedTypesForStyle(style);
  const templateTypeAllowed = template && allowed.includes(template.type);
  const type = templateTypeAllowed && random() < 0.6 ? template.type : random(allowed);
  const curveMin = style === "straight" ? 0.02 : 0.25;
  const curveMax = style === "straight" ? 0.25 : 0.75;
  const fatMin = style === "straight" ? 0.2 : 0.35;
  const fatMax = style === "straight" ? 1.0 : 1.6;
  const baseCurve = template?.curveBias ?? random(curveMin, curveMax);
  const baseFat = template?.fatness ?? random(fatMin, fatMax);
  const baseRadiusJitter = constrain(template?.radiusJitter ?? random(-0.12, 0.12), -0.6, 0.6);
  const baseAngleJitter = constrain(template?.angleJitter ?? random(-PI / 18, PI / 18), -PI / 6, PI / 6);
  const baseSizeJitter = constrain(template?.sizeJitter ?? random(-0.1, 0.1), -0.5, 0.5);
  return {
    type,
    curveBias: constrain(baseCurve + random(-0.15, 0.15), 0.02, 0.95),
    fatness: constrain(baseFat + random(-0.2, 0.2), fatMin, fatMax),
    radiusJitter: baseRadiusJitter,
    angleJitter: baseAngleJitter,
    sizeJitter: baseSizeJitter
  };
}

function harmonizeShapesWithStyle(shapes = [], style = "mixed") {
  const allowed = allowedTypesForStyle(style);
  for (const shp of shapes) {
    if (!allowed.includes(shp.type)) {
      const template = allowed.includes(shp.type) ? shp : null;
      const replacement = randomShape(template, style);
      shp.type = replacement.type;
      shp.curveBias = replacement.curveBias;
      shp.fatness = replacement.fatness;
      shp.radiusJitter = replacement.radiusJitter ?? 0;
      shp.angleJitter = replacement.angleJitter ?? 0;
      shp.sizeJitter = replacement.sizeJitter ?? 0;
    }
    if (shp.radiusJitter === undefined) shp.radiusJitter = 0;
    if (shp.angleJitter === undefined) shp.angleJitter = 0;
    if (shp.sizeJitter === undefined) shp.sizeJitter = 0;
  }
  return shapes;
}

function genomeSummary(g) {
  if (!g) return "";

  const overlapKey = (g.overlapMode || "mixed").toLowerCase();
  const styleKey = (g.shapeStyle || "mixed").toLowerCase();

  const overlapCode = OVERLAP_SUMMARY_CODES[overlapKey] || "O?";
  const styleCode = SHAPE_STYLE_SUMMARY_CODES[styleKey] || "S?";
  const groupCode = g.group ? `G${g.group}` : "G?";

  let paletteCode = "P?";
  if (g.palette) {
    const paletteKeys = palettes ? Object.keys(palettes) : [];
    const paletteIndex = paletteKeys.indexOf(g.palette);
    if (paletteIndex >= 0) {
      paletteCode = `P${paletteIndex + 1}`;
    } else if (/^p\d+$/i.test(g.palette)) {
      paletteCode = g.palette.replace(/^p/, "P");
    }
  }

  const shapeCount = g.numShapes ?? (Array.isArray(g.shapes) ? g.shapes.length : 0);
  const countCode = `N${shapeCount || 0}`;

  return groupCode + overlapCode + styleCode + paletteCode + countCode;
}

let nextId = 1;

function withMeta(g) {
  g.id = nextId++;
  g.createdAt = Date.now();
  g.selectCount = 0;
  return g;
}

// === genome creation ===
function randomGenome() {
  const groups = ["632", "*632", "442", "*442", "4*2", "333", "*333", "3*3", "2222", "2*22", "*2222", "22*", "22x"];
  const paletteKeys = Object.keys(palettes);
  const motifScale = random(48, 88);
  const hueShift = random(-12, 12);
  const shapeStyle = random(["curved", "straight", "mixed", "mixed"]);
  const overlapMode = random(["overlap", "touch", "space", "mixed"]);
  let numShapes = floor(random(5, 9));
  let shapes = [];
  for (let i = 0; i < numShapes; i++) {
    const template = shapes.length > 0 && random() < 0.45 ? random(shapes) : null;
    shapes.push(randomShape(template, shapeStyle));
  }
  const paletteKey = random(paletteKeys);
  const basePalette = paletteColorsForKey(paletteKey);
  const paletteForGenome = basePalette.length ? basePalette : [normalizeColorHSB({ h: random(360), s: random(45, 95), b: random(55, 95) })];
  const colors = paletteForGenome.map(col => mutateColorHSB(col, 0.15));
  return {
    group: random(groups),
    palette: paletteKey,
    motifScale,
    rotation: random(TWO_PI),
    hueShift,
    shapeStyle,
    overlapMode,
    numShapes: shapes.length,
    shapes,
    colors,
  };
}

// === evolution functions ===
function mutateGenome(g, rate = 0.25) {
  // rate in [0,1], scaling mutation intensity and probability
  let m = structuredClone(g);
  ensureGenomeColors(m);
  m.hueShift += random(-6, 6) * rate;
  // scale multiplicative change towards 1 by rate
  let scaleJitter = lerp(1, random(0.9, 1.15), rate);
  m.motifScale = constrain(m.motifScale * scaleJitter, 32, 140);
  if (random() < 0.12 * rate) m.palette = random(Object.keys(palettes));
  if (random() < 0.15 * rate) m.group = random(["632", "*632", "442", "*442", "4*2", "333", "*333", "3*3", "2222", "2*22", "*2222", "22*"]); 
  const priorStyle = m.shapeStyle || "mixed";
  if (random() < 0.1 * rate) {
    const styles = ["curved", "straight", "mixed"];
    m.shapeStyle = random(styles.filter(s => s !== m.shapeStyle)) || m.shapeStyle;
  }
  const priorOverlap = m.overlapMode || "mixed";
  if (random() < 0.1 * rate) {
    const modes = ["overlap", "touch", "space", "mixed"];
    m.overlapMode = random(modes.filter(s => s !== m.overlapMode)) || m.overlapMode;
  }
  const styleForShapes = m.shapeStyle || "mixed";
  for (let s of m.shapes) {
    if (random() < 0.45 * rate) s.fatness = constrain((s.fatness ?? 0.5) + random(-0.18, 0.18) * rate, 0.2, 1.6);
    if (random() < 0.45 * rate) s.curveBias = constrain((s.curveBias ?? 0.5) + random(-0.18, 0.18) * rate, 0.05, 0.95);
    if (random() < 0.12 * rate) s.type = random(allowedTypesForStyle(styleForShapes));
    if (s.radiusJitter === undefined) s.radiusJitter = 0;
    if (s.angleJitter === undefined) s.angleJitter = 0;
    if (s.sizeJitter === undefined) s.sizeJitter = 0;
    if (random() < 0.4 * rate) s.radiusJitter = constrain((s.radiusJitter ?? 0) + random(-0.12, 0.12) * rate, -0.6, 0.6);
    if (random() < 0.4 * rate) s.angleJitter = constrain((s.angleJitter ?? 0) + random(-PI / 32, PI / 32) * rate, -PI / 6, PI / 6);
    if (random() < 0.4 * rate) s.sizeJitter = constrain((s.sizeJitter ?? 0) + random(-0.1, 0.1) * rate, -0.5, 0.5);
  }
  if (random() < 0.08 * rate && m.shapes.length < 8) {
    const template = m.shapes.length ? random(m.shapes) : null;
    const insertAt = floor(random(m.shapes.length + 1));
    m.shapes.splice(insertAt, 0, randomShape(template, styleForShapes));
  }
  if (random() < 0.06 * rate && m.shapes.length > 4) {
    m.shapes.splice(floor(random(m.shapes.length)), 1);
  }
  if (styleForShapes !== priorStyle || random() < 0.12 * rate) {
    harmonizeShapesWithStyle(m.shapes, styleForShapes);
  }
  if (m.overlapMode !== priorOverlap) {
    // Placeholder for future spatial re-layout if needed.
  }
  const paletteKeys = palettes ? Object.keys(palettes) : [];
  if (random() < 0.08 * rate && paletteKeys.length) {
    // Occasionally adopt a new palette base but keep hues nearby.
    const newPalette = paletteColorsForKey(random(paletteKeys));
    if (newPalette.length) {
      const blendRatio = constrain(rate * 0.5 + random(0, 0.2), 0, 1);
      const baseColors = ensureGenomeColors(m);
      const maxLen = max(newPalette.length, baseColors.length || 1);
      const blended = [];
      for (let i = 0; i < maxLen; i++) {
        const fromOld = baseColors[i % baseColors.length] || baseColors[0];
        const fromNew = newPalette[i % newPalette.length];
        if (!fromOld) {
          blended.push(normalizeColorHSB(fromNew));
        } else {
          blended.push(normalizeColorHSB({
            h: lerpHueDeg(fromOld.h, fromNew.h, blendRatio),
            s: lerp(fromOld.s, fromNew.s, blendRatio),
            b: lerp(fromOld.b, fromNew.b, blendRatio),
          }));
        }
      }
      m.colors = blended;
    }
  }

  const baseColors = ensureGenomeColors(m);
  const mutationStrength = max(0.05, rate * 0.45);
  m.colors = baseColors.map(col => {
    const shouldMutate = random() < (0.4 + rate * 0.4);
    const mutated = shouldMutate ? mutateColorHSB(col, mutationStrength) : normalizeColorHSB(col);
    return { ...mutated };
  });
  if (random() < 0.05 * rate && m.colors.length < 6 && m.colors.length > 0) {
    const addSource = random(m.colors);
    m.colors.push(mutateColorHSB(addSource, mutationStrength * 1.2));
  }
  if (random() < 0.03 * rate && m.colors.length > 3) {
    m.colors.splice(floor(random(m.colors.length)), 1);
  }
  m.numShapes = m.shapes.length;
  return m;
}

function combineGenomes(a, b) {
  // Legacy 2-parent combine retained for history thumbnails or fallback
  return mixGenomes([a, b], { method: "random-trait", mutationRate: 0.1, paletteOverride: -1 });
}

function mixGenomes(parents, options) {
  const { method = "random-trait", mutationRate: mut = 0.1, paletteOverride: palIdx = -1 } = options || {};
  const p = parents.filter(Boolean);
  if (p.length === 0) return randomGenome();
  if (p.length === 1) return mutateGenome(p[0], mut);

  // Start from a random parent's clone
  let c = structuredClone(random(p));

  // Helpers
  const pickParent = () => random(p);
  const majority = (arr) => {
    const counts = {};
    let best = arr[0], maxC = 0;
    for (const v of arr) {
      counts[v] = (counts[v] || 0) + 1;
      if (counts[v] > maxC) { maxC = counts[v]; best = v; }
    }
    return best;
  };
  const blendNumeric = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const fallbackStyle = (val) => (val === "curved" || val === "straight" || val === "mixed") ? val : "mixed";
  const fallbackOverlap = (val) => OVERLAP_MODES.includes(val) ? val : "mixed";

  // Palette
  if (palIdx >= 0 && palIdx < p.length) c.palette = p[palIdx].palette;
  else {
    const paletteVotes = p.map(x => x.palette);
    const paletteChoice = majority(paletteVotes);
    c.palette = method === "average" || random() < 0.65 ? paletteChoice : pickParent().palette;
  }

  // Group
  const groupVotes = p.map(x => x.group);
  c.group = method === "average" || random() < 0.6 ? majority(groupVotes) : pickParent().group;

  // Shape style
  const styleVotes = p.map(x => fallbackStyle(x.shapeStyle || "mixed"));
  const styleMajority = majority(styleVotes);
  if (method === "average") c.shapeStyle = styleMajority;
  else c.shapeStyle = fallbackStyle(random() < 0.55 ? styleMajority : pickParent().shapeStyle || styleMajority);
  const styleForShapes = c.shapeStyle || "mixed";
  // Overlap mode
  const overlapVotes = p.map(x => fallbackOverlap(x.overlapMode || "mixed"));
  const overlapMajority = majority(overlapVotes);
  if (method === "average") c.overlapMode = overlapMajority;
  else c.overlapMode = fallbackOverlap(random() < 0.55 ? overlapMajority : pickParent().overlapMode || overlapMajority);

  // Numeric traits
  if (method === "average") {
    c.hueShift = blendNumeric(p.map(x => x.hueShift));
    let ms = blendNumeric(p.map(x => x.motifScale));
    c.motifScale = constrain(ms, 32, 140);
    c.rotation = blendNumeric(p.map(x => x.rotation)) % TWO_PI;
  } else {
    const pr = pickParent();
    c.hueShift = lerp(pr.hueShift, blendNumeric(p.map(x => x.hueShift)), 0.25);
    c.motifScale = constrain(lerp(pr.motifScale, blendNumeric(p.map(x => x.motifScale)), 0.3), 32, 140);
    c.rotation = pr.rotation;
  }

  // Shapes
  let targetN;
  if (method === "average") {
    targetN = round(blendNumeric(p.map(x => x.shapes.length)));
  } else {
    const maxShapes = max(...p.map(x => x.shapes.length));
    targetN = round(lerp(maxShapes, blendNumeric(p.map(x => x.shapes.length)), 0.4));
  }
  targetN = constrain(targetN, 4, 9);
  c.shapes = [];
  for (let i = 0; i < targetN; i++) {
    const available = p.map(pp => pp.shapes[i]).filter(Boolean);
    let base;
    if (available.length) base = structuredClone(available[random(available.length) | 0]);
    else {
      const src = pickParent();
      base = structuredClone(src.shapes[i % src.shapes.length]);
    }
    let shp = structuredClone(base);
    if (method === "average") {
      // average comparable shapes at index i where available
      let pool = p.map(pp => pp.shapes[i]).filter(Boolean);
      if (pool.length > 1) {
        // type: majority vote
        const t = majority(pool.map(s => s.type));
        const fb = blendNumeric(pool.map(s => s.fatness ?? 0.5));
        const cb = blendNumeric(pool.map(s => s.curveBias ?? 0.5));
        shp.type = t;
        shp.fatness = fb;
        shp.curveBias = cb;
        const rj = blendNumeric(pool.map(s => (s?.radiusJitter ?? 0)));
        const aj = blendNumeric(pool.map(s => (s?.angleJitter ?? 0)));
        const sj = blendNumeric(pool.map(s => (s?.sizeJitter ?? 0)));
        shp.radiusJitter = constrain(rj, -0.6, 0.6);
        shp.angleJitter = constrain(aj, -PI / 6, PI / 6);
        shp.sizeJitter = constrain(sj, -0.5, 0.5);
      }
    } else {
      if (random() < 0.4) {
        const donor = pickParent();
        const donorShape = donor.shapes[i % donor.shapes.length];
        if (donorShape) {
          shp.type = donorShape.type;
          shp.fatness = donorShape.fatness;
          shp.curveBias = donorShape.curveBias;
          if (donorShape.radiusJitter !== undefined) shp.radiusJitter = donorShape.radiusJitter;
          if (donorShape.angleJitter !== undefined) shp.angleJitter = donorShape.angleJitter;
          if (donorShape.sizeJitter !== undefined) shp.sizeJitter = donorShape.sizeJitter;
        }
      }
    }
    if (!allowedTypesForStyle(styleForShapes).includes(shp.type)) {
      const replacement = randomShape(shp, styleForShapes);
      shp.type = replacement.type;
      shp.fatness = replacement.fatness;
      shp.curveBias = replacement.curveBias;
      shp.radiusJitter = replacement.radiusJitter ?? 0;
      shp.angleJitter = replacement.angleJitter ?? 0;
      shp.sizeJitter = replacement.sizeJitter ?? 0;
    }
    if (shp.radiusJitter === undefined) shp.radiusJitter = 0;
    if (shp.angleJitter === undefined) shp.angleJitter = 0;
    if (shp.sizeJitter === undefined) shp.sizeJitter = 0;
    c.shapes.push(shp);
  }
  c.numShapes = c.shapes.length;

  const parentColors = p.map(parent => cloneColors(ensureGenomeColors(parent))).filter(arr => arr.length > 0);
  let combinedColors = [];
  if (parentColors.length) {
    if (method === "average") {
      const maxLen = parentColors.reduce((acc, arr) => max(acc, arr.length), 0);
      for (let i = 0; i < maxLen; i++) {
        const samples = parentColors.map(arr => arr[i % arr.length]).filter(Boolean);
        if (!samples.length) continue;
        const hue = averageHue(samples.map(s => s.h));
        const sat = samples.reduce((sum, s) => sum + s.s, 0) / samples.length;
        const bri = samples.reduce((sum, s) => sum + s.b, 0) / samples.length;
        combinedColors.push(normalizeColorHSB({ h: hue, s: sat, b: bri }));
      }
    } else {
      const seed = cloneColors(random(parentColors));
      combinedColors = seed;
      for (const colors of parentColors) {
        colors.forEach((col, idx) => {
          if (!combinedColors[idx] || random() < 0.3) {
            combinedColors[idx] = normalizeColorHSB(col);
          }
        });
      }
    }
  }

  if (!combinedColors.length) {
    combinedColors = paletteColorsForKey(c.palette);
    if (!combinedColors.length) {
      combinedColors = [normalizeColorHSB({ h: random(360), s: random(45, 95), b: random(55, 95) })];
    }
  }

  combinedColors = combinedColors.map(col => mutateColorHSB(col, mut * 0.6 + 0.1));
  c.colors = combinedColors;

  // Light mutation to bring variation
  c = mutateGenome(c, mut * 0.8);
  harmonizeShapesWithStyle(c.shapes, c.shapeStyle || "mixed");
  // Future: spatial re-layout for overlapMode can be added here.
  return c;
}

function genomeHash(g) {
  // Simple non-cryptographic hash of salient genome parts for deterministic preview seeding
  const obj = {
    group: g.group,
    palette: g.palette,
    motifScale: Math.round(g.motifScale * 100) / 100,
    rotation: Math.round(((g.rotation || 0) % (Math.PI * 2)) * 1000) / 1000,
    hueShift: Math.round(g.hueShift * 10) / 10,
    shapeStyle: g.shapeStyle || "mixed",
    overlapMode: g.overlapMode || "mixed",
    shapes: (g.shapes || []).map(s => ({
      t: s.type,
      cb: Math.round((s.curveBias || 0) * 100) / 100,
      f: Math.round((s.fatness || 0) * 100) / 100,
      rj: Math.round((s.radiusJitter || 0) * 1000) / 1000,
      aj: Math.round((s.angleJitter || 0) * 1000) / 1000,
      sj: Math.round((s.sizeJitter || 0) * 1000) / 1000
    }))
  };
  const str = JSON.stringify(obj);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
