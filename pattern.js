// === wallpaper rendering ===
// Implements motif generation and wallpaper tiling logic for genomes.
const GROUP_SPECS = {
  // Hexagonal / triangular lattices
  "632": {                        // p6
    basis: [ {x: Math.sqrt(3), y: 0}, {x: Math.sqrt(3)/2, y: 1.5} ],
    compositionDepth: 2,
    generators: [
      { type: "rotation", order: 6, centers: [{u:0, v:0}] }
    ]
  },
  "*632": {                       // p6m
    basis: [ {x: Math.sqrt(3), y: 0}, {x: Math.sqrt(3)/2, y: 1.5} ],
    compositionDepth: 2,
    generators: [
      { type: "rotation", order: 6, centers: [{u:0, v:0}] },
      { type: "reflection", angle: 0,          offsets: [{u:0, v:0}] },
      { type: "reflection", angle: Math.PI/6,  offsets: [{u:0, v:0}] },
      { type: "reflection", angle: Math.PI/3,  offsets: [{u:0, v:0}] },
      { type: "reflection", angle: Math.PI/2,  offsets: [{u:0, v:0}] },
      { type: "reflection", angle: 2*Math.PI/3, offsets: [{u:0, v:0}] },
      { type: "reflection", angle: 5*Math.PI/6, offsets: [{u:0, v:0}] }
    ]
  },

  "333": {                        // p3
    basis: [ {x: 1, y: 0}, {x: 0.5, y: Math.sqrt(3)/2} ],
    generators: [
      { type: "rotation", order: 3, centers: [{u:0, v:0}] }
    ]
  },
  "*333": {                       // p3m1
    basis: [ {x: 1, y: 0}, {x: 0.5, y: Math.sqrt(3)/2} ],
    generators: [
      { type: "rotation", order: 3, centers: [{u:0, v:0}] },
      { type: "reflection", angle: 0,            offsets: [{u:0, v:0}] },
      { type: "reflection", angle: Math.PI/3,    offsets: [{u:0, v:0}] },
      { type: "reflection", angle: (2*Math.PI)/3, offsets: [{u:0, v:0}] }
    ]
  },
  "3*3": {                        // p31m
    basis: [ {x: 1, y: 0}, {x: 0.5, y: Math.sqrt(3)/2} ],
    generators: [
      { type: "rotation", order: 3, centers: [{u:0, v:0}] },
      { type: "reflection", angle: Math.PI/6,      offsets: [{u: 1/3, v: 1/3}] },
      { type: "reflection", angle: Math.PI/2,      offsets: [{u: 1/3, v: 1/3}] },
      { type: "reflection", angle: 5*Math.PI/6,    offsets: [{u: 1/3, v: 1/3}] }
    ]
  },

  // Square lattices
  "442": {                        // p4
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    generators: [
      { type: "rotation", order: 4, centers: [{u:0, v:0}] }
    ]
  },
  "*442": {                       // p4m
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    generators: [
      { type: "rotation", order: 4, centers: [{u:0, v:0}] },
      { type: "reflection", angle: 0,           offsets: [{u:0, v:0}] },
      { type: "reflection", angle: Math.PI/4,   offsets: [{u:0, v:0}] },
      { type: "reflection", angle: Math.PI/2,   offsets: [{u:0, v:0}] },
      { type: "reflection", angle: 3*Math.PI/4, offsets: [{u:0, v:0}] }
    ]
  },
  "4*2": {                        // p4g
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    compositionDepth: 2,
    generators: [
      { type: "rotation", order: 4, centers: [{u:0, v:0}] },
      { type: "glide", angle: Math.PI/4,   offsets: [{u:0, v:0}, {u:0.5, v:0.5}], by: {u:0.5, v:0.5} },
      { type: "glide", angle: (3*Math.PI)/4, offsets: [{u:0, v:0}, {u:0.5, v:0.5}], by: {u:0.5, v:0.5} }
    ]
  },

  // Rectangular / centered-rectangular
  "2222": {                       // p2
    basis: [ {x:1, y:0}, {x:0.5, y:0.6} ],  // keep your oblique choice
    generators: [
      { type: "rotation", order: 2, centers: [{u:0, v:0}] }
    ]
  },
  "*2222": {                      // pmm
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    generators: [
      { type: "reflection", angle: 0,            offsets: [{u:0, v:0}] },
      { type: "reflection", angle: Math.PI/2,    offsets: [{u:0, v:0}] },
      { type: "rotation",  order: 2,             centers: [{u:0.5, v:0.5}] }
    ]
  },
  "2*22": {                       // cmm (diagonal mirrors)
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    generators: [
      { type: "reflection", angle: Math.PI/4,        offsets: [{u:0, v:0}] },
      { type: "reflection", angle: (3*Math.PI)/4,    offsets: [{u:0, v:0}] },
      { type: "rotation",  order: 2,                 centers: [{u:0.5, v:0}, {u:0, v:0.5}] }
    ]
  },
  "22*": {                        // pmg
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    compositionDepth: 2,
    generators: [
      { type: "reflection", angle: Math.PI/2, offsets: [{u:0, v:0}, {u:0.5, v:0.5}] },  // vertical mirrors at two parities
      { type: "glide",      angle: 0,         offsets: [{u:0, v:0}, {u:0, v:0.5}], by: {u:0.5, v:0} }, // horizontal glides at y=0 and y=b/2
      // 2-fold rotations will appear as compositions of vertical mirrors and horizontal glides
    ]
  },

  // Glide-only families and trivial
  "xx": {                         // pg
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    generators: [
      { type: "glide", angle: 0, offsets: [{u:0, v:0}, {u:0, v:0.5}], by: {u:0.5, v:0} }
    ]
  },
  "*x": {                         // cm
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    compositionDepth: 2,
    generators: [
      { type: "reflection", angle: Math.PI/2, offsets: [{u:0, v:0}] },       // vertical mirrors
      { type: "glide",      angle: 0,         offsets: [{u:0, v:0.5}], by: {u:0.5, v:0} } // horizontal glide mid-row
    ]
  },
  "**": {                         // pm
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    generators: [
      { type: "reflection", angle: Math.PI/2, offsets: [{u:0, v:0}] }
    ]
  },
  "22x": {                        // pgg
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    // Two perpendicular glides; their composition gives the 180° rotations.
    compositionDepth: 2,  // allow generator compositions up to length 2 to realize double-glide copies
    generators: [
      { type: "glide", angle: 0,           offsets: [{u:0, v:0}], by: {u:0.5, v:0} },     // horizontal
      { type: "glide", angle: Math.PI/2,   offsets: [{u:0, v:0}], by: {u:0, v:0.5} }      // vertical
    ]
  },
  "o": {                          // p1
    basis: [ {x:1, y:0}, {x:0, y:1} ],
    generators: []
  }
};

// Export list of available wallpaper groups
function getAvailableGroups() {
  return Object.keys(GROUP_SPECS);
}

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

// === 2D affine helpers (p5.js applyMatrix order: a,b,c,d,e,f) ===
function matIdentity(){ return {a:1,b:0,c:0,d:1,e:0,f:0}; }
function matMul(n, m){
  return {
    a: n.a*m.a + n.c*m.b,
    b: n.b*m.a + n.d*m.b,
    c: n.a*m.c + n.c*m.d,
    d: n.b*m.c + n.d*m.d,
    e: n.a*m.e + n.c*m.f + n.e,
    f: n.b*m.e + n.d*m.f + n.f
  };
}
function matTranslate(tx,ty){ return {a:1,b:0,c:0,d:1,e:tx,f:ty}; }
function matRotate(theta){
  const ct=Math.cos(theta), st=Math.sin(theta);
  return {a:ct,b:st,c:-st,d:ct,e:0,f:0};
}
function matScale(sx,sy){ return {a:sx,b:0,c:0,d:sy,e:0,f:0}; }
function matAbout(m, cx, cy){ // T(cx,cy) * m * T(-cx,-cy)
  return matMul(matMul(matTranslate(cx,cy), m), matTranslate(-cx,-cy));
}
function matReflectThrough(angle){ // through origin at angle
  const R  = matRotate(angle);
  const Ri = matRotate(-angle);
  return matMul(matMul(R, matScale(1,-1)), Ri);
}

function buildBaseTransforms(spec, a){
  const b1=spec.basis[0], b2=spec.basis[1];
  function uvToXY(u,v){ return { x:(u*b1.x+v*b2.x)*a, y:(u*b1.y+v*b2.y)*a }; }

  const base = [];

  for (const g of (spec.generators||[])) {
    if (g.type === "rotation") {
      const centers = g.centers && g.centers.length ? g.centers : [{u:0, v:0}];
      for (const c of centers) {
        const P = uvToXY(c.u, c.v);
        for (let k=0; k<g.order; k++){
          const theta = (2*Math.PI*k)/g.order;
          const R = matAbout(matRotate(theta), P.x, P.y);
          base.push(R);
        }
      }
    } else if (g.type === "reflection") {
      const offs = g.offsets && g.offsets.length ? g.offsets : [{u:0,v:0}];
      for (const o of offs){
        const P = uvToXY(o.u, o.v);
        const M = matAbout(matReflectThrough(g.angle||0), P.x, P.y);
        base.push(M);
      }
    } else if (g.type === "glide") {
      const offs = g.offsets && g.offsets.length ? g.offsets : [{u:0,v:0}];
      const by   = g.by || {u:0.5, v:0};
      const Gvec = uvToXY(by.u, by.v);
      const Refl0 = matReflectThrough(g.angle||0);
      for (const o of offs){
        const P = uvToXY(o.u, o.v);
        const M = matMul(matTranslate(Gvec.x, Gvec.y), matAbout(Refl0, P.x, P.y));
        base.push(M);
      }
    }
  }
  base.push(matIdentity());
  return base;
}

function buildTransformSet(spec, a){
  const depth = Math.max(1, spec.compositionDepth || 1);
  const gens = buildBaseTransforms(spec, a);
  const seed = dedup(gens);
  let current = seed.slice();
  let all = seed.slice();
  for (let d=2; d<=depth; d++){
    const next = [];
    for (const g of seed){
      for (const h of current){
        const comp = matMul(g, h);
        next.push(comp);
      }
    }
    const uniq = dedup(next.concat(all));
    if (uniq.length === all.length) break;
    all = uniq;
    current = next;
  }
  return all;

  function dedup(arr){
    const key = (m)=>[
      m.a.toFixed(9), m.b.toFixed(9), m.c.toFixed(9),
      m.d.toFixed(9), m.e.toFixed(9), m.f.toFixed(9)
    ].join(",");
    const seen = new Set();
    const out = [];
    for (const m of arr){
      const k = key(m);
      if (!seen.has(k)){ seen.add(k); out.push(m); }
    }
    return out;
  }
}

function symmetryOrder(spec){
  if (!spec) return 1;
  let order = 1;
  for (const gen of (spec.generators || [])){
    if (gen.type === "rotation"){
      order = Math.max(order, gen.order || 1);
    }
  }
  return order;
}

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

function drawSymmetryGuides(pg, spec, g, { a, tileRange }) {
  if (typeof showSymmetryGuides === "undefined" || !showSymmetryGuides) return;

  const ctx = createGuideContext(pg, spec, g, { a, tileRange });

  collectGeneratorGuides(ctx);
  collectTransformGuides(ctx);
  applyLatticeHeuristics(ctx);

  renderLineGuides(ctx);

  if (ctx.rotCenters.length) {
    const rotationMeta = prepareRotationCenterMetadata(ctx);
    renderRotationCenters(ctx, rotationMeta);
  }

  ctx.pg.pop();
}

function createGuideContext(pg, spec, g, { a, tileRange }) {
  const b1 = spec.basis[0];
  const b2 = spec.basis[1];
  const basisLen1 = Math.hypot(b1.x * a, b1.y * a);
  const basisLen2 = Math.hypot(b2.x * a, b2.y * a);

  const ctx = {
    pg,
    spec,
    genome: g,
    a,
    tileRange,
    b1,
    b2,
    fallbackNeighborDist: Math.max(basisLen1, basisLen2, Math.max(a, 1)),
    L: 5000,
    rotColors: [
      { r: 255, g: 64, b: 64 },
      { r: 64, g: 224, b: 255 },
      { r: 64, g: 255, b: 96 },
      { r: 255, g: 224, b: 64 },
      { r: 255, g: 64, b: 224 },
      { r: 128, g: 96, b: 255 },
    ],
    lineGuides: [],
    rotCenters: [],
    centerKeys: new Set(),
    centerIndex: new Map(),
  };

  ctx.uvToXY = (u, v) => ({
    x: (u * ctx.b1.x + v * ctx.b2.x) * ctx.a,
    y: (u * ctx.b1.y + v * ctx.b2.y) * ctx.a,
  });

  ctx.xyToUV = (x, y) => {
    const A = ctx.a * ctx.b1.x;
    const B = ctx.a * ctx.b2.x;
    const Cc = ctx.a * ctx.b1.y;
    const D = ctx.a * ctx.b2.y;
    const det = A * D - B * Cc || 1e-12;
    const invA = D / det;
    const invB = -B / det;
    const invC = -Cc / det;
    const invD = A / det;
    return {
      u: invA * x + invB * y,
      v: invC * x + invD * y,
    };
  };

  ctx.norm01 = (t) => {
    const shifted = t - Math.floor(t);
    return shifted < 0 ? shifted + 1 : shifted;
  };

  ctx.uvKey = (u, v) => {
    const uf = ctx.norm01(u);
    const vf = ctx.norm01(v);
    const ur = Math.round(uf * 10000) / 10000;
    const vr = Math.round(vf * 10000) / 10000;
    return `${ur}|${vr}`;
  };

  ctx.applyToPoint = (M, x, y) => ({
    x: M.a * x + M.c * y + M.e,
    y: M.b * x + M.d * y + M.f,
  });

  ctx.addLine = (ang, P, isGlide) => {
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const nx = -dy;
    const ny = dx;
    const dist = (nx * P.x + ny * P.y) / Math.max(ctx.a, 1e-6);
    const key = `${isGlide ? "g" : "r"}|${Math.round(dx * 1e6) / 1e6},${
      Math.round(dy * 1e6) / 1e6
    }|${Math.round(dist * 1e3) / 1e3}`;
    for (const existing of ctx.lineGuides) {
      if (existing.key === key) return;
    }
    ctx.lineGuides.push({ ang, P, isGlide, key });
  };

  ctx.addCenter = (C, ord) => {
    const key = `${Math.round((C.x / Math.max(ctx.a, 1e-6)) * 1e4) / 1e4},${
      Math.round((C.y / Math.max(ctx.a, 1e-6)) * 1e4) / 1e4
    }`;
    if (ctx.centerIndex.has(key)) {
      const idx = ctx.centerIndex.get(key);
      if ((ctx.rotCenters[idx].ord || 1) < (ord || 1)) {
        ctx.rotCenters[idx].ord = ord;
      }
      return;
    }
    ctx.centerKeys.add(key);
    ctx.centerIndex.set(key, ctx.rotCenters.length);
    ctx.rotCenters.push({ C, ord });
  };

  pg.push();
  pg.noFill();

  return ctx;
}

function collectGeneratorGuides(ctx) {
  for (const gen of ctx.spec.generators || []) {
    if (gen.type === "reflection") {
      const offs = gen.offsets && gen.offsets.length ? gen.offsets : [{ u: 0, v: 0 }];
      for (const ofst of offs) {
        const O = ctx.uvToXY(ofst.u, ofst.v);
        ctx.addLine(gen.angle || 0, O, false);
      }
    } else if (gen.type === "glide") {
      const offs = gen.offsets && gen.offsets.length ? gen.offsets : [{ u: 0, v: 0 }];
      const ang = gen.angle || 0;
      for (const ofst of offs) {
        const O = ctx.uvToXY(ofst.u, ofst.v);
        ctx.addLine(ang, O, true);
      }
    } else if (gen.type === "rotation") {
      const centers = gen.centers && gen.centers.length ? gen.centers : [{ u: 0, v: 0 }];
      const ord = gen.order || 2;
      for (const c of centers) {
        const C = ctx.uvToXY(c.u, c.v);
        ctx.addCenter(C, ord);
      }
    }
  }
}

function collectTransformGuides(ctx) {
  const relTs = buildTransformSet(ctx.spec, ctx.a) || [];
  const eps = 1e-6;

  for (const M of relTs) {
    const a11 = M.a;
    const a12 = M.c;
    const a21 = M.b;
    const a22 = M.d;
    const tx = M.e;
    const ty = M.f;
    const det = a11 * a22 - a21 * a12;

    if (Math.abs(det - 1) < eps) {
      const angle = Math.atan2(a21, a11);
      let angN = angle % (2 * Math.PI);
      if (angN < 0) angN += 2 * Math.PI;
      if (Math.abs(angN) < 1e-4) continue;

      const A = 1 - a11;
      const B = -a12;
      const Cc = -a21;
      const D = 1 - a22;
      const det2 = A * D - B * Cc;
      if (Math.abs(det2) < eps) continue;

      const cx = (D * tx - B * ty) / det2;
      const cy = (-Cc * tx + A * ty) / det2;
      const candidates = [2, 3, 4, 6];
      let best = 2;
      let bestErr = Infinity;
      for (const n of candidates) {
        const target = (2 * Math.PI) / n;
        const k = Math.max(1, Math.round(angN / Math.max(target, 1e-9)));
        const err = Math.abs(angN - k * target);
        if (err < bestErr) {
          bestErr = err;
          best = n;
        }
      }
      ctx.addCenter({ x: cx, y: cy }, best);
    } else if (Math.abs(det + 1) < eps) {
      const twoTheta = Math.atan2(a21, a11);
      const theta = twoTheta / 2;
      const vx = Math.cos(theta);
      const vy = Math.sin(theta);
      const nx = -vy;
      const ny = vx;
      const tdotn = nx * tx + ny * ty;
      const alpha = 0.5 * tdotn;
      const P = { x: alpha * nx, y: alpha * ny };
      const tdotv = vx * tx + vy * ty;
      const isGlide = Math.abs(tdotv) > 1e-5;
      ctx.addLine(theta, P, isGlide);
    }
  }
}

function applyLatticeHeuristics(ctx) {
  const gens = ctx.spec.generators || [];
  const hasOrder6 = gens.some((gen) => gen.type === "rotation" && (gen.order || 0) === 6);
  const hasOrder3 = gens.some((gen) => gen.type === "rotation" && (gen.order || 0) === 3);
  const hasOrder4 = gens.some((gen) => gen.type === "rotation" && (gen.order || 0) === 4);
  const hasOrder2 = gens.some((gen) => gen.type === "rotation" && (gen.order || 0) === 2);
  const hasReflections = gens.some((gen) => gen.type === "reflection");
  const hasGlides = gens.some((gen) => gen.type === "glide");

  const len1 = Math.hypot(ctx.b1.x, ctx.b1.y);
  const len2 = Math.hypot(ctx.b2.x, ctx.b2.y);
  const dot = ctx.b1.x * ctx.b2.x + ctx.b1.y * ctx.b2.y;
  const ang = Math.acos(Math.max(-1, Math.min(1, dot / Math.max(1e-9, len1 * len2))));

  const triLattice =
    hasOrder6 && Math.abs(len1 - len2) / Math.max(1, len1) < 0.02 && Math.abs(ang - Math.PI / 3) < 0.03;
  if (triLattice) {
    const offs3 = [
      { u: 1 / 3, v: 1 / 3 },
      { u: 2 / 3, v: 2 / 3 },
    ];
    const offs2 = [
      { u: 0.5, v: 0 },
      { u: 0, v: 0.5 },
      { u: 0.5, v: 0.5 },
    ];
    for (const o of offs3) ctx.addCenter(ctx.uvToXY(o.u, o.v), 3);
    for (const o of offs2) ctx.addCenter(ctx.uvToXY(o.u, o.v), 2);
  }

  const triLatticeP3 =
    !hasOrder6 &&
    hasOrder3 &&
    Math.abs(len1 - len2) / Math.max(1, len1) < 0.02 &&
    Math.abs(ang - Math.PI / 3) < 0.03;
  if (triLatticeP3) {
    const offs3p3 = [
      { u: 1 / 3, v: 1 / 3 },
      { u: 2 / 3, v: 2 / 3 },
    ];
    for (const o of offs3p3) ctx.addCenter(ctx.uvToXY(o.u, o.v), 3);
  }

  const squareLattice = Math.abs(len1 - len2) / Math.max(1, len1) < 0.02 && Math.abs(ang - Math.PI / 2) < 0.03;
  if (squareLattice && hasOrder4 && hasGlides && !hasReflections) {
    const offs2p4g = [
      { u: 0.5, v: 0 },
      { u: 0, v: 0.5 },
    ];
    for (const o of offs2p4g) ctx.addCenter(ctx.uvToXY(o.u, o.v), 2);
  }

  if (squareLattice && hasOrder4) {
    ctx.addCenter(ctx.uvToXY(0, 0), 4);
    ctx.addCenter(ctx.uvToXY(0.5, 0.5), 4);
    const offs2p4 = [
      { u: 0.5, v: 0 },
      { u: 0, v: 0.5 },
    ];
    for (const o of offs2p4) ctx.addCenter(ctx.uvToXY(o.u, o.v), 2);
  }

  if (hasOrder2) {
    const offs2rect = [
      { u: 0, v: 0 },
      { u: 0.5, v: 0 },
      { u: 0, v: 0.5 },
      { u: 0.5, v: 0.5 },
    ];
    for (const o of offs2rect) ctx.addCenter(ctx.uvToXY(o.u, o.v), 2);
  }

  const reflAngles = gens.filter((gen) => gen.type === "reflection").map((gen) => gen.angle || 0);
  const hasHoriz = reflAngles.some((a) => Math.abs(((a % Math.PI) + Math.PI) % Math.PI) < 1e-3);
  const hasVert = reflAngles.some((a) => Math.abs((((a - Math.PI / 2) % Math.PI) + Math.PI) % Math.PI) < 1e-3);
  const rectLattice = Math.abs(ang - Math.PI / 2) < 0.03;
  if (rectLattice && hasHoriz) ctx.addLine(0, ctx.uvToXY(0, 0.5), false);
  if (rectLattice && hasVert) ctx.addLine(Math.PI / 2, ctx.uvToXY(0.5, 0), false);
}

function renderLineGuides(ctx) {
  for (const guide of ctx.lineGuides) {
    ctx.pg.stroke(guide.isGlide ? 255 : 0, guide.isGlide ? 0 : 180, guide.isGlide ? 160 : 255, 160);
    ctx.pg.strokeWeight(1);
    if (ctx.pg.drawingContext && ctx.pg.drawingContext.setLineDash) {
      ctx.pg.drawingContext.setLineDash(guide.isGlide ? [6, 6] : []);
    }
    const dx = Math.cos(guide.ang);
    const dy = Math.sin(guide.ang);
    for (let i = -ctx.tileRange; i <= ctx.tileRange; i++) {
      for (let j = -ctx.tileRange; j <= ctx.tileRange; j++) {
        const p = latticePointFrom(ctx.spec, ctx.a, i, j);
        const cx = p.x + guide.P.x;
        const cy = p.y + guide.P.y;
        ctx.pg.line(cx - dx * ctx.L, cy - dy * ctx.L, cx + dx * ctx.L, cy + dy * ctx.L);
      }
    }
    if (ctx.pg.drawingContext && ctx.pg.drawingContext.setLineDash) {
      ctx.pg.drawingContext.setLineDash([]);
    }
  }
}

function prepareRotationCenterMetadata(ctx) {
  const rotCenters = ctx.rotCenters;
  const uv = rotCenters.map((rc) => ctx.xyToUV(rc.C.x, rc.C.y));
  const keep = new Array(rotCenters.length).fill(true);
  const wrapD = (d) => d - Math.round(d);
  const tol2 = 1e-5;

  for (let i = 0; i < rotCenters.length; i++) {
    if (!keep[i]) continue;
    for (let j = 0; j < rotCenters.length; j++) {
      if (i === j) continue;
      if ((rotCenters[j].ord || 1) <= (rotCenters[i].ord || 1)) continue;
      const du = wrapD(uv[i].u - uv[j].u);
      const dv = wrapD(uv[i].v - uv[j].v);
      const d2 = du * du + dv * dv;
      if (d2 < tol2) {
        keep[i] = false;
        break;
      }
    }
  }

  const filtered = [];
  for (let i = 0; i < rotCenters.length; i++) {
    if (keep[i]) filtered.push(rotCenters[i]);
  }
  rotCenters.length = 0;
  Array.prototype.push.apply(rotCenters, filtered);

  const n = rotCenters.length;
  const parents = Array.from({ length: n }, (_, i) => i);
  const find = (x) => (parents[x] === x ? x : (parents[x] = find(parents[x])));
  const unite = (a, b) => {
    a = find(a);
    b = find(b);
    if (a !== b) parents[b] = a;
  };

  const uvArr = [];
  const uvMap = new Map();
  const minNeighborDist = new Array(n).fill(Infinity);

  for (let i = 0; i < n; i++) {
    const { C } = rotCenters[i];
    const { u, v } = ctx.xyToUV(C.x, C.y);
    uvArr[i] = { u, v };
    const key = ctx.uvKey(u, v);
    if (!uvMap.has(key)) uvMap.set(key, i);
  }

  for (let i = 0; i < n; i++) {
    let best = Infinity;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const du = wrap01Delta(uvArr[j].u - uvArr[i].u);
      const dv = wrap01Delta(uvArr[j].v - uvArr[i].v);
      const delta = ctx.uvToXY(du, dv);
      const dist = Math.hypot(delta.x, delta.y);
      if (dist > 1e-6 && dist < best) best = dist;
    }
    if (!Number.isFinite(best) || best <= 0) best = ctx.fallbackNeighborDist;
    minNeighborDist[i] = best;
  }

  const transforms = buildTransformSet(ctx.spec, ctx.a) || [];
  const T1v = ctx.uvToXY(1, 0);
  const T2v = ctx.uvToXY(0, 1);
  const Ts = [
    matIdentity(),
    matTranslate(T1v.x, T1v.y),
    matTranslate(T2v.x, T2v.y),
    matTranslate(-T1v.x, -T1v.y),
    matTranslate(-T2v.x, -T2v.y),
    matTranslate(T1v.x + T2v.x, T1v.y + T2v.y),
    matTranslate(T1v.x - T2v.x, T1v.y - T2v.y),
    matTranslate(-T1v.x + T2v.x, -T1v.y + T2v.y),
    matTranslate(-T1v.x - T2v.x, -T1v.y - T2v.y),
  ];

  const transforms2 = transforms.slice();
  for (const G of transforms) {
    for (const T of Ts) {
      const Tin = matTranslate(-(T.e || 0), -(T.f || 0));
      transforms2.push(matMul(matMul(T, G), Tin));
    }
  }
  for (const rc of rotCenters) {
    const ord = Math.max(2, rc.ord || 2);
    for (let k = 1; k < ord; k++) {
      const Rk = matAbout(matRotate((2 * Math.PI * k) / ord), rc.C.x, rc.C.y);
      transforms2.push(Rk);
    }
  }

  for (let i = 0; i < n; i++) {
    for (const M of transforms2) {
      const P = rotCenters[i].C;
      const Pp = ctx.applyToPoint(M, P.x, P.y);
      const uvp = ctx.xyToUV(Pp.x, Pp.y);
      let bestJ = -1;
      let bestD = Infinity;
      for (let j = 0; j < n; j++) {
        if ((rotCenters[i].ord || 2) !== (rotCenters[j].ord || 2)) continue;
        const du = wrap01Delta(uvp.u - uvArr[j].u);
        const dv = wrap01Delta(uvp.v - uvArr[j].v);
        const d2 = du * du + dv * dv;
        if (d2 < bestD) {
          bestD = d2;
          bestJ = j;
        }
      }
      if (bestJ >= 0 && bestD < 1e-5) unite(i, bestJ);
    }
  }

  const orbitId = new Map();
  let orbitCount = 0;
  const centerOrbit = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!orbitId.has(r)) orbitId.set(r, orbitCount++);
    centerOrbit[i] = orbitId.get(r);
  }

  const displayOrbit = centerOrbit.slice();
  if (ctx.genome && ctx.genome.group === "4*2") {
    for (let i = 0; i < n; i++) {
      if ((rotCenters[i].ord || 0) !== 4) continue;
      const uvp = uvArr[i];
      const du0 = wrap01Delta(uvp.u - 0);
      const dv0 = wrap01Delta(uvp.v - 0);
      const d0 = du0 * du0 + dv0 * dv0;
      const du1 = wrap01Delta(uvp.u - 0.5);
      const dv1 = wrap01Delta(uvp.v - 0.5);
      const d1 = du1 * du1 + dv1 * dv1;
      const cluster = d1 < d0 ? 1 : 0;
      displayOrbit[i] = displayOrbit[i] * 2 + cluster;
    }
  }

  const centerAngle = new Array(n).fill(0);
  const orbitMembers = Array.from({ length: orbitCount }, () => []);
  for (let i = 0; i < n; i++) orbitMembers[centerOrbit[i]].push(i);

  for (let oid = 0; oid < orbitCount; oid++) {
    const members = orbitMembers[oid];
    if (!members.length) continue;
    let root = members[0];
    for (const idx of members) {
      const uvr = uvArr[idx];
      const uvroot = uvArr[root];
      if (uvr.u < uvroot.u - 1e-6 || (Math.abs(uvr.u - uvroot.u) < 1e-6 && uvr.v < uvroot.v)) {
        root = idx;
      }
    }
    for (const member of members) {
      let bestD = Infinity;
      let bestAng = 0;
      for (const M of transforms2) {
        const detM = M.a * M.d - M.b * M.c;
        if (Math.abs(detM - 1) > 1e-6) continue;
        const Pp = ctx.applyToPoint(M, ctx.rotCenters[root].C.x, ctx.rotCenters[root].C.y);
        const uvp = ctx.xyToUV(Pp.x, Pp.y);
        const du = wrap01Delta(uvp.u - uvArr[member].u);
        const dv = wrap01Delta(uvp.v - uvArr[member].v);
        const d2 = du * du + dv * dv;
        if (d2 < bestD) {
          bestD = d2;
          bestAng = Math.atan2(M.b, M.a);
        }
      }
      if (bestD < 1e-5) centerAngle[member] = bestAng;
    }
  }

  return {
    uvArr,
    minNeighborDist,
    centerOrbit,
    displayOrbit,
    centerAngle,
  };
}

function renderRotationCenters(ctx, meta) {
  const { uvArr, minNeighborDist, centerOrbit, displayOrbit, centerAngle } = meta;

  for (let idx = 0; idx < ctx.rotCenters.length; idx++) {
    const rc = ctx.rotCenters[idx];
    const neighborDist = Math.max(minNeighborDist[idx] || 0, 1e-6);
    const markerSize = Math.max(neighborDist / 8, 4);
    const col = ctx.rotColors[(displayOrbit[idx] ?? centerOrbit[idx]) % ctx.rotColors.length];
    ctx.pg.stroke(0);
    ctx.pg.strokeWeight(1);
    ctx.pg.fill(col.r, col.g, col.b);
    const ord = rc.ord || 2;

    for (let i = -ctx.tileRange; i <= ctx.tileRange; i++) {
      for (let j = -ctx.tileRange; j <= ctx.tileRange; j++) {
        const p = latticePointFrom(ctx.spec, ctx.a, i, j);
        const cx = p.x + rc.C.x;
        const cy = p.y + rc.C.y;
        const r = markerSize * 0.5;

        if (ord === 2) {
          const phi = centerAngle[idx] || 0;
          const halfH = r;
          const halfW = r * 0.5;
          const pts = [
            { x: 0, y: -halfH },
            { x: halfW, y: 0 },
            { x: 0, y: halfH },
            { x: -halfW, y: 0 },
          ];
          ctx.pg.beginShape();
          for (const v of pts) {
            const vx = cx + Math.cos(phi) * v.x - Math.sin(phi) * v.y;
            const vy = cy + Math.sin(phi) * v.x + Math.cos(phi) * v.y;
            ctx.pg.vertex(vx, vy);
          }
          ctx.pg.endShape(CLOSE);
        } else {
          const sides = ord >= 6 ? 6 : ord >= 4 ? 4 : 3;
          const baseRot = sides === 3 ? -Math.PI / 2 : 0;
          const phi = (centerAngle[idx] || 0) + baseRot;
          ctx.pg.beginShape();
          for (let k = 0; k < sides; k++) {
            const ang = phi + (2 * Math.PI * k) / sides;
            const vx = cx + Math.cos(ang) * r;
            const vy = cy + Math.sin(ang) * r;
            ctx.pg.vertex(vx, vy);
          }
          ctx.pg.endShape(CLOSE);
        }
      }
    }
  }
}

function wrap01Delta(d) {
  return d - Math.round(d);
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
