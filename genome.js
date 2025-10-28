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
function mutateGenome(g, rate = 0.25) {
  // rate in [0,1], scaling mutation intensity and probability
  let m = structuredClone(g);
  m.hueShift += random(-10, 10) * rate;
  // scale multiplicative change towards 1 by rate
  let scaleJitter = lerp(1, random(0.8, 1.3), rate);
  m.motifScale = constrain(m.motifScale * scaleJitter, 20, 200);
  if (random() < 0.3 * rate) m.palette = random(Object.keys(palettes));
  if (random() < 0.3 * rate) m.group = random(["632", "442", "333", "2222"]);
  for (let s of m.shapes) {
    if (random() < 0.5) {
      s.fatness = constrain(s.fatness + random(-0.1, 0.1) * rate, 0.1, 2);
      s.curveBias = constrain((s.curveBias ?? 0.5) + random(-0.1, 0.1) * rate, 0, 1);
    }
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

  // Palette
  if (palIdx >= 0 && palIdx < p.length) c.palette = p[palIdx].palette;
  else c.palette = method === "average" ? majority(p.map(x => x.palette)) : pickParent().palette;

  // Group
  c.group = method === "average" ? majority(p.map(x => x.group)) : pickParent().group;

  // Numeric traits
  if (method === "average") {
    c.hueShift = p.map(x => x.hueShift).reduce((a, b) => a + b, 0) / p.length;
    let ms = p.map(x => x.motifScale).reduce((a, b) => a + b, 0) / p.length;
    c.motifScale = constrain(ms, 20, 200);
    // rotation average naive
    c.rotation = (p.map(x => x.rotation).reduce((a, b) => a + b, 0) / p.length) % TWO_PI;
  } else {
    const pr = pickParent();
    c.hueShift = pr.hueShift;
    c.motifScale = pr.motifScale;
    c.rotation = pr.rotation;
  }

  // Shapes
  let targetN = method === "average"
    ? round(p.map(x => x.shapes.length).reduce((a, b) => a + b, 0) / p.length)
    : pickParent().shapes.length;
  targetN = constrain(targetN, 1, 8);
  c.shapes = [];
  for (let i = 0; i < targetN; i++) {
    // Try to assemble shapes using i-th shape from random parent (if it exists), else random shape from a parent
    let src = pickParent();
    let base = src.shapes[i] || random(src.shapes);
    let shp = structuredClone(base);
    if (method === "average") {
      // average comparable shapes at index i where available
      let pool = p.map(pp => pp.shapes[i]).filter(Boolean);
      if (pool.length > 1) {
        // type: majority vote
        const t = majority(pool.map(s => s.type));
        const fb = pool.map(s => s.fatness ?? 0.5).reduce((a, b) => a + b, 0) / pool.length;
        const cb = pool.map(s => s.curveBias ?? 0.5).reduce((a, b) => a + b, 0) / pool.length;
        shp.type = t;
        shp.fatness = fb;
        shp.curveBias = cb;
      }
    }
    c.shapes.push(shp);
  }
  c.numShapes = c.shapes.length;

  // Light mutation to bring variation
  c = mutateGenome(c, mut);
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
