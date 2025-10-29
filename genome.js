/*
 * Genome model overview
 * ---------------------
 * Each wallpaper genome encapsulates the traits that drive rendering:
 *   - group: wallpaper symmetry group id ("632", "442", "333", "2222").
 *   - palette: key into the shared palettes map.
 *   - motifScale, rotation, hueShift: numeric controls for motif tiling and colour.
 *   - shapes: ordered array of motif parts, each with type, curveBias, fatness.
 *   - shapeStyle: desired shape vocabulary ("curved" | "straight" | "mixed").
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
  return {
    type,
    curveBias: constrain(baseCurve + random(-0.15, 0.15), 0.02, 0.95),
    fatness: constrain(baseFat + random(-0.2, 0.2), fatMin, fatMax)
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
    }
  }
  return shapes;
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
  const groups = ["632", "442", "333", "2222"];
  const paletteKeys = Object.keys(palettes);
  const motifScale = random(48, 88);
  const hueShift = random(-12, 12);
  const shapeStyle = random(["curved", "straight", "mixed", "mixed"]);
  let numShapes = floor(random(5, 9));
  let shapes = [];
  for (let i = 0; i < numShapes; i++) {
    const template = shapes.length > 0 && random() < 0.45 ? random(shapes) : null;
    shapes.push(randomShape(template, shapeStyle));
  }
  return {
    group: random(groups),
    palette: random(paletteKeys),
    motifScale,
    rotation: random(TWO_PI),
    hueShift,
    shapeStyle,
    numShapes: shapes.length,
    shapes
  };
}

// === evolution functions ===
function mutateGenome(g, rate = 0.25) {
  // rate in [0,1], scaling mutation intensity and probability
  let m = structuredClone(g);
  m.hueShift += random(-6, 6) * rate;
  // scale multiplicative change towards 1 by rate
  let scaleJitter = lerp(1, random(0.9, 1.15), rate);
  m.motifScale = constrain(m.motifScale * scaleJitter, 32, 140);
  if (random() < 0.12 * rate) m.palette = random(Object.keys(palettes));
  if (random() < 0.15 * rate) m.group = random(["632", "442", "333", "2222"]);
  const priorStyle = m.shapeStyle || "mixed";
  if (random() < 0.1 * rate) {
    const styles = ["curved", "straight", "mixed"];
    m.shapeStyle = random(styles.filter(s => s !== m.shapeStyle)) || m.shapeStyle;
  }
  const styleForShapes = m.shapeStyle || "mixed";
  for (let s of m.shapes) {
    if (random() < 0.45 * rate) s.fatness = constrain((s.fatness ?? 0.5) + random(-0.18, 0.18) * rate, 0.2, 1.6);
    if (random() < 0.45 * rate) s.curveBias = constrain((s.curveBias ?? 0.5) + random(-0.18, 0.18) * rate, 0.05, 0.95);
    if (random() < 0.12 * rate) s.type = random(allowedTypesForStyle(styleForShapes));
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
      }
    } else {
      if (random() < 0.4) {
        const donor = pickParent();
        const donorShape = donor.shapes[i % donor.shapes.length];
        if (donorShape) {
          shp.type = donorShape.type;
          shp.fatness = donorShape.fatness;
          shp.curveBias = donorShape.curveBias;
        }
      }
    }
    if (!allowedTypesForStyle(styleForShapes).includes(shp.type)) {
      const replacement = randomShape(shp, styleForShapes);
      shp.type = replacement.type;
      shp.fatness = replacement.fatness;
      shp.curveBias = replacement.curveBias;
    }
    c.shapes.push(shp);
  }
  c.numShapes = c.shapes.length;

  // Light mutation to bring variation
  c = mutateGenome(c, mut);
  harmonizeShapesWithStyle(c.shapes, c.shapeStyle || "mixed");
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
    shapes: (g.shapes || []).map(s => ({ t: s.type, cb: Math.round((s.curveBias || 0) * 100) / 100, f: Math.round((s.fatness || 0) * 100) / 100 }))
  };
  const str = JSON.stringify(obj);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
