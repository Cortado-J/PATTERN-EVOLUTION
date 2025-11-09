// === wallpaper math utilities ===
// Provides lattice helpers and affine transform builders for wallpaper rendering.

function latticePointFrom(spec, a, i, j) {
  const b1 = spec.basis[0];
  const b2 = spec.basis[1];
  const x = (i * b1.x + j * b2.x) * a;
  const y = (i * b1.y + j * b2.y) * a;
  return createVector(x, y);
}

// === 2D affine helpers (p5.js applyMatrix order: a,b,c,d,e,f) ===
function matIdentity() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; }
function matMul(n, m) {
  return {
    a: n.a * m.a + n.c * m.b,
    b: n.b * m.a + n.d * m.b,
    c: n.a * m.c + n.c * m.d,
    d: n.b * m.c + n.d * m.d,
    e: n.a * m.e + n.c * m.f + n.e,
    f: n.b * m.e + n.d * m.f + n.f,
  };
}
function matTranslate(tx, ty) { return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty }; }
function matRotate(theta) {
  const ct = Math.cos(theta), st = Math.sin(theta);
  return { a: ct, b: st, c: -st, d: ct, e: 0, f: 0 };
}
function matScale(sx, sy) { return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 }; }
function matAbout(m, cx, cy) {
  // T(cx,cy) * m * T(-cx,-cy)
  return matMul(matMul(matTranslate(cx, cy), m), matTranslate(-cx, -cy));
}
function matReflectThrough(angle) {
  // Reflection through origin at angle
  const R = matRotate(angle);
  const Ri = matRotate(-angle);
  return matMul(matMul(R, matScale(1, -1)), Ri);
}

function buildBaseTransforms(spec, a) {
  const b1 = spec.basis[0], b2 = spec.basis[1];
  function uvToXY(u, v) { return { x: (u * b1.x + v * b2.x) * a, y: (u * b1.y + v * b2.y) * a }; }

  const base = [];

  for (const g of (spec.generators || [])) {
    if (g.type === "rotation") {
      const centers = g.centers && g.centers.length ? g.centers : [{ u: 0, v: 0 }];
      for (const c of centers) {
        const P = uvToXY(c.u, c.v);
        for (let k = 0; k < g.order; k++) {
          const theta = (2 * Math.PI * k) / g.order;
          const R = matAbout(matRotate(theta), P.x, P.y);
          base.push(R);
        }
      }
    } else if (g.type === "reflection") {
      const offs = g.offsets && g.offsets.length ? g.offsets : [{ u: 0, v: 0 }];
      for (const o of offs) {
        const P = uvToXY(o.u, o.v);
        const M = matAbout(matReflectThrough(g.angle || 0), P.x, P.y);
        base.push(M);
      }
    } else if (g.type === "glide") {
      const offs = g.offsets && g.offsets.length ? g.offsets : [{ u: 0, v: 0 }];
      const by = g.by || { u: 0.5, v: 0 };
      const Gvec = uvToXY(by.u, by.v);
      const Refl0 = matReflectThrough(g.angle || 0);
      for (const o of offs) {
        const P = uvToXY(o.u, o.v);
        const M = matMul(matTranslate(Gvec.x, Gvec.y), matAbout(Refl0, P.x, P.y));
        base.push(M);
      }
    }
  }
  base.push(matIdentity());
  return base;
}

function buildTransformSet(spec, a) {
  const depth = Math.max(1, spec.compositionDepth || 1);
  const gens = buildBaseTransforms(spec, a);
  const seed = dedup(gens);
  let current = seed.slice();
  let all = seed.slice();
  for (let d = 2; d <= depth; d++) {
    const next = [];
    for (const g of seed) {
      for (const h of current) {
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

  function dedup(arr) {
    const key = (m) => [
      m.a.toFixed(9), m.b.toFixed(9), m.c.toFixed(9),
      m.d.toFixed(9), m.e.toFixed(9), m.f.toFixed(9),
    ].join(",");
    const seen = new Set();
    const out = [];
    for (const m of arr) {
      const k = key(m);
      if (!seen.has(k)) { seen.add(k); out.push(m); }
    }
    return out;
  }
}

function symmetryOrder(spec) {
  if (!spec) return 1;
  let order = 1;
  for (const gen of (spec.generators || [])) {
    if (gen.type === "rotation") {
      order = Math.max(order, gen.order || 1);
    }
  }
  return order;
}

function wrap01Delta(d) {
  return d - Math.round(d);
}
