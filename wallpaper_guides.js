// === wallpaper symmetry guide rendering ===
// Relies on wallpaper_math.js helpers for lattice/transform utilities.

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
  deduplicateRotationCenters(ctx);
  const graph = buildRotationOrbitGraph(ctx);
  const orbitInfo = computeRotationOrbits(ctx, graph);
  const centerAngle = computeRotationAngles(ctx, graph, orbitInfo);

  return {
    uvArr: graph.uvArr,
    minNeighborDist: graph.minNeighborDist,
    centerOrbit: orbitInfo.centerOrbit,
    displayOrbit: orbitInfo.displayOrbit,
    centerAngle,
  };
}

function deduplicateRotationCenters(ctx) {
  const rotCenters = ctx.rotCenters;
  const uv = rotCenters.map((rc) => ctx.xyToUV(rc.C.x, rc.C.y));
  const keep = new Array(rotCenters.length).fill(true);
  const tol2 = 1e-5;

  const wrapD = (d) => d - Math.round(d);

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
}

function buildRotationOrbitGraph(ctx) {
  const rotCenters = ctx.rotCenters;
  const n = rotCenters.length;
  const uvArr = new Array(n);
  const minNeighborDist = new Array(n).fill(Infinity);

  for (let i = 0; i < n; i++) {
    const { C } = rotCenters[i];
    const { u, v } = ctx.xyToUV(C.x, C.y);
    uvArr[i] = { u, v };
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
  const translations = [
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
    for (const T of translations) {
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

  const adjacency = Array.from({ length: n }, () => new Set());
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
      if (bestJ >= 0 && bestD < 1e-5) {
        adjacency[i].add(bestJ);
        adjacency[bestJ].add(i);
      }
    }
  }

  return {
    uvArr,
    minNeighborDist,
    adjacency,
  };
}

function computeRotationOrbits(ctx, graph) {
  const n = ctx.rotCenters.length;
  const parents = Array.from({ length: n }, (_, i) => i);

  const find = (x) => (parents[x] === x ? x : (parents[x] = find(parents[x])));
  const unite = (a, b) => {
    a = find(a);
    b = find(b);
    if (a !== b) parents[b] = a;
  };

  for (let i = 0; i < n; i++) {
    for (const j of graph.adjacency[i]) {
      unite(i, j);
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
      if ((ctx.rotCenters[i].ord || 0) !== 4) continue;
      const uv = graph.uvArr[i];
      const du0 = wrap01Delta(uv.u - 0);
      const dv0 = wrap01Delta(uv.v - 0);
      const d0 = du0 * du0 + dv0 * dv0;
      const du1 = wrap01Delta(uv.u - 0.5);
      const dv1 = wrap01Delta(uv.v - 0.5);
      const d1 = du1 * du1 + dv1 * dv1;
      const cluster = d1 < d0 ? 1 : 0;
      displayOrbit[i] = displayOrbit[i] * 2 + cluster;
    }
  }

  return {
    centerOrbit,
    displayOrbit,
  };
}

function computeRotationAngles(ctx, graph, orbitInfo) {
  const { centerOrbit } = orbitInfo;
  const n = ctx.rotCenters.length;
  const centerAngle = new Array(n).fill(0);

  const orbitMembers = Array.from({ length: Math.max(...centerOrbit, 0) + 1 }, () => []);
  for (let i = 0; i < n; i++) orbitMembers[centerOrbit[i]].push(i);

  const transforms = buildTransformSet(ctx.spec, ctx.a) || [];
  const T1v = ctx.uvToXY(1, 0);
  const T2v = ctx.uvToXY(0, 1);
  const translations = [
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
    for (const T of translations) {
      const Tin = matTranslate(-(T.e || 0), -(T.f || 0));
      transforms2.push(matMul(matMul(T, G), Tin));
    }
  }
  for (const rc of ctx.rotCenters) {
    const ord = Math.max(2, rc.ord || 2);
    for (let k = 1; k < ord; k++) {
      const Rk = matAbout(matRotate((2 * Math.PI * k) / ord), rc.C.x, rc.C.y);
      transforms2.push(Rk);
    }
  }

  for (let oid = 0; oid < orbitMembers.length; oid++) {
    const members = orbitMembers[oid];
    if (!members || !members.length) continue;
    let root = members[0];
    for (const idx of members) {
      const uv = graph.uvArr[idx];
      const uvroot = graph.uvArr[root];
      if (uv.u < uvroot.u - 1e-6 || (Math.abs(uv.u - uvroot.u) < 1e-6 && uv.v < uvroot.v)) {
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
        const du = wrap01Delta(uvp.u - graph.uvArr[member].u);
        const dv = wrap01Delta(uvp.v - graph.uvArr[member].v);
        const d2 = du * du + dv * dv;
        if (d2 < bestD) {
          bestD = d2;
          bestAng = Math.atan2(M.b, M.a);
        }
      }
      if (bestD < 1e-5) centerAngle[member] = bestAng;
    }
  }

  return centerAngle;
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
