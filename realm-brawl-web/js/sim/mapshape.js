// Organic map shapes + layouts for the two open-world biomes (The Wilds, Sunscorch Dunes). Pure geometry, no
// imports, so constants.js / dunesconst.js / world.js / the renderer can all use it without import cycles.
// Pass 2: the land is NOT a star around a centre any more. A coastline is a smooth union of rotated elliptical lobes
// (plus carved bays and fbm noise) baked into a signed-distance raster, and danger is a continuous field from weighted
// region seeds (domain-warped inverse-distance blend) baked into a second raster. `re(x, y)` maps that field onto the
// old "effective radius" scale so every zone threshold (WILDS_RINGS / DUNES_RINGS) keeps working, but the zones are now
// irregular regions / lobes, not rings. Iso-lines (coast, zone borders) come out of marching squares.
const TAU = Math.PI * 2, DEG = Math.PI / 180;

function hash2(i, j, s = 0) { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s = 0) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, y, s = 0) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.07 + 5.3, y * 2.07 - 1.7, s + 1) * 0.3 + vnoise(x * 4.3 - 2.1, y * 4.3 + 7.7, s + 2) * 0.15;
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function ellSd(x, y, [ex, ey, a, b, rot = 0]) {
  const c = Math.cos(rot * DEG), s = Math.sin(rot * DEG), dx = x - ex, dy = y - ey, u = dx * c + dy * s, v = -dx * s + dy * c;
  const q = Math.hypot(u / a, v / b); return (q - 1) * Math.min(a, b);
}
function lerpKnots(kn, D) {
  if (D <= kn[0][0]) return kn[0][1] + (D - kn[0][0]) * (kn[1][1] - kn[0][1]) / (kn[1][0] - kn[0][0]);
  for (let i = 1; i < kn.length; i++) if (D <= kn[i][0]) { const [d0, r0] = kn[i - 1], [d1, r1] = kn[i]; return r0 + (r1 - r0) * (D - d0) / (d1 - d0); }
  const n = kn.length; return kn[n - 1][1] + (D - kn[n - 1][0]) * (kn[n - 1][1] - kn[n - 2][1]) / (kn[n - 1][0] - kn[n - 2][0]);
}

/** Marching squares over a W x H raster (origin x0, y0, cell C): closed loops (flat [x, y, ...]) of value == level.
 *  The raster border counts as "outside" so every loop closes. */
export function contours(arr, W, H, x0, y0, C, level) {
  const val = (i, j) => (i <= 0 || j <= 0 || i >= W - 1 || j >= H - 1 ? Infinity : arr[j * W + i]);
  const pt = new Map(), adj = new Map();
  const ept = (id) => {
    let p = pt.get(id); if (p) return p;
    const k = id >> 1, i = k % W, j = (k / W) | 0, a = val(i, j);
    if (id & 1) { const b = val(i, j + 1), t = a === Infinity ? 1 : b === Infinity ? 0 : (level - a) / (b - a); p = [x0 + i * C, y0 + (j + Math.max(0, Math.min(1, t))) * C]; }
    else { const b = val(i + 1, j), t = a === Infinity ? 1 : b === Infinity ? 0 : (level - a) / (b - a); p = [x0 + (i + Math.max(0, Math.min(1, t))) * C, y0 + j * C]; }
    pt.set(id, p); return p;
  };
  const link = (e1, e2) => { let l = adj.get(e1); if (!l) adj.set(e1, (l = [])); l.push(e2); l = adj.get(e2); if (!l) adj.set(e2, (l = [])); l.push(e1); };
  for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) {
    const tl = val(i, j) < level, tr = val(i + 1, j) < level, br = val(i + 1, j + 1) < level, bl = val(i, j + 1) < level;
    const c = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0); if (c === 0 || c === 15) continue;
    const T = (j * W + i) * 2, B = ((j + 1) * W + i) * 2, L = (j * W + i) * 2 + 1, R = (j * W + i + 1) * 2 + 1;
    switch (c) {
      case 1: case 14: link(L, B); break;
      case 2: case 13: link(B, R); break;
      case 3: case 12: link(L, R); break;
      case 4: case 11: link(T, R); break;
      case 5: link(L, T); link(B, R); break;
      case 6: case 9: link(T, B); break;
      case 7: case 8: link(L, T); break;
      case 10: link(T, R); link(L, B); break;
    }
  }
  const seen = new Set(), loops = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop = []; let prev = -1, cur = start;
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur); const p = ept(cur); loop.push(p[0], p[1]);
      const l = adj.get(cur); const nx = l[0] !== prev ? l[0] : l[1]; prev = cur; cur = nx;
    }
    if (loop.length >= 8) loops.push(loop);
  }
  return loops;
}

/**
 * A land shape. spec: { cx, cy, R, cell, lobes: [[x, y, a, b, rotDeg]], bays: [...same], blend, noise,
 *   seeds: [[x, y, D, weight?]], knots: [[D, re]], warp }
 */
export function makeLand(spec) {
  const C = spec.cell || 50, blend = spec.blend || 700, noise = spec.noise ?? 160, warp = spec.warp ?? 320;
  // map fix pass: the walkable edge is the drawn beach / shelf (the client paints sand / ice / basalt out to sd = shore),
  // not the raw coast (sd = 0): heroes stand on the sand, their feet just touching the foam line (centre <= shore - r/2).
  const shore = spec.shore ?? 0;
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const [x, y, a, b] of spec.lobes) { const m = Math.max(a, b) + 700; bx0 = Math.min(bx0, x - m); by0 = Math.min(by0, y - m); bx1 = Math.max(bx1, x + m); by1 = Math.max(by1, y + m); }
  const x0 = Math.floor(bx0 / C) * C, y0 = Math.floor(by0 / C) * C, W = Math.ceil((bx1 - x0) / C) + 1, H = Math.ceil((by1 - y0) / C) + 1;
  const sd = new Float32Array(W * H), dg = new Float32Array(W * H), seeds = spec.seeds, kn = spec.knots, ns = spec.nseed || 0;
  let mx0 = Infinity, my0 = Infinity, mx1 = -Infinity, my1 = -Infinity;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = x0 + i * C, y = y0 + j * C;
    let d = Infinity; for (const L of spec.lobes) d = d === Infinity ? ellSd(x, y, L) : smin(d, ellSd(x, y, L), blend);
    for (const B of spec.bays || []) d = Math.max(d, -ellSd(x, y, B));
    d += (fbm(x / 1100, y / 1100, ns) - 0.5) * 2 * noise + (vnoise(x / 280, y / 280, ns + 9) - 0.5) * noise * 0.45;
    sd[j * W + i] = d;
    if (d < 0) { mx0 = Math.min(mx0, x); my0 = Math.min(my0, y); mx1 = Math.max(mx1, x); my1 = Math.max(my1, y); }
    const wx = x + warp * (fbm(x / 1500, y / 1500, ns + 20) - 0.5) * 2, wy = y + warp * (fbm(x / 1500 + 9, y / 1500 - 4, ns + 21) - 0.5) * 2;
    let num = 0, den = 0;
    for (const s of seeds) { const d2 = (wx - s[0]) ** 2 + (wy - s[1]) ** 2 + 4e4, w = (s[3] || 1) / (d2 * d2); num += w * s[2]; den += w; }
    dg[j * W + i] = lerpKnots(kn, num / den);
  }
  const sample = (arr, x, y, out) => {
    const fx = (x - x0) / C, fy = (y - y0) / C, i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= W - 1 || j >= H - 1) return out;
    const tx = fx - i, ty = fy - j, k = j * W + i, a = arr[k], b = arr[k + 1], c = arr[k + W], d = arr[k + W + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  const cx = spec.cx, cy = spec.cy, R = spec.R;
  const max = Math.max(cx - mx0, mx1 - cx, cy - my0, my1 - cy) + C;
  const cache = new Map();
  // the walk / draw raster: the coast field plus land carved under the roads (S.carve); world generation keeps using the
  // raw field (S.inside) so the seeded layout (camps, props, sites) is unchanged
  let sw = sd;
  const S = {
    cx, cy, R, max, cell: C, shore, raster: { sd, dg, W, H, x0, y0 },
    bounds: { x0: mx0 - C, y0: my0 - C, x1: mx1 + C, y1: my1 + C },
    /** signed distance to the drawn coast (negative = on land; includes the land carved under roads) */
    sd: (x, y) => sample(sw, x, y, 1e4),
    /** effective (danger) radius of a point: same scale as the old rings (WILDS_RINGS / DUNES_RINGS) */
    re: (x, y) => sample(dg, x, y, R),
    inside: (x, y, pad = 0) => sample(sd, x, y, 1e4) < pad,
    /** can a circle of radius r stand here (the drawn beach counts: centre up to shore - r/2 past the coast)? */
    walkable: (x, y, r = 0) => sample(sw, x, y, 1e4) <= shore - r * 0.5,
    /** keep a circle entity on the walkable ground (land + the drawn beach); true if it was moved */
    clamp(e) {
      const r = e.r || 0, off = r * 0.5 - shore; let d = sample(sw, e.x, e.y, 1e4) + off; if (d <= 0) return false;
      for (let it = 0; it < 4 && d > 0; it++) {
        const gx = sample(sw, e.x + C * 0.5, e.y, 1e4) - sample(sw, e.x - C * 0.5, e.y, 1e4), gy = sample(sw, e.x, e.y + C * 0.5, 1e4) - sample(sw, e.x, e.y - C * 0.5, 1e4), gl = Math.hypot(gx, gy);
        if (!(gl > 1e-6) || d > 5000) { const dx = cx - e.x, dy = cy - e.y, l = Math.hypot(dx, dy) || 1; e.x += dx / l * Math.min(d + 2, l); e.y += dy / l * Math.min(d + 2, l); }
        else { e.x -= gx / gl * (d + 1); e.y -= gy / gl * (d + 1); }
        d = sample(sw, e.x, e.y, 1e4) + off;
      }
      return true;
    },
    /** closed loops (flat [x, y, ...] lists) of the coast (re >= R, offset outward by pad) or a danger iso-line */
    loops(re = R, pad = 0) {
      const k = re + ':' + pad; let l = cache.get(k);
      if (!l) { l = re >= R ? contours(sw, W, H, x0, y0, C, pad) : contours(dg, W, H, x0, y0, C, re); cache.set(k, l); }
      return l;
    },
    /** map fix pass: guarantee land under the roads (a road never runs over the beach / the sea): the walk / draw field
     *  becomes a smooth min of the coast and (distance to the road - hw). Call once, right after the roads exist. */
    carve(roads, hw = 110, k = 160) {
      sw = Float32Array.from(sd);
      for (const pts of roads) for (let s = 1; s < pts.length; s++) {
        const a = pts[s - 1], b = pts[s], vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1, reach = hw + k + 60;
        const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - reach - x0) / C)), i1 = Math.min(W - 1, Math.ceil((Math.max(a.x, b.x) + reach - x0) / C));
        const j0 = Math.max(0, Math.floor((Math.min(a.y, b.y) - reach - y0) / C)), j1 = Math.min(H - 1, Math.ceil((Math.max(a.y, b.y) + reach - y0) / C));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const x = x0 + i * C, y = y0 + j * C, t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / L2));
          const d = Math.hypot(x - a.x - vx * t, y - a.y - vy * t) - hw, q = j * W + i;
          if (d < sw[q] + k) sw[q] = smin(sw[q], d, k);
        }
      }
      cache.clear(); return S;
    },
    /** the longest loop of loops(re, pad), flat (legacy single-outline callers) */
    outline(re = R, n = 0, pad = 0) { let best = []; for (const l of S.loops(re, pad)) if (l.length > best.length) best = l; return best; },
    /** walk out from the centre along an angle until the danger field reaches re (legacy polar lookup) */
    at(deg, re) { const a = deg * DEG; let x = cx, y = cy; for (let s = 0; s < 400; s++) { const nx = x + Math.cos(a) * 40, ny = y + Math.sin(a) * 40; if (S.re(nx, ny) >= re || !S.inside(nx, ny, -60)) break; x = nx; y = ny; } return { x: Math.round(x), y: Math.round(y) }; },
    /** a random land point with re in [re0, re1) (rng: { next() }) */
    sample(rng, re0, re1, pad = -40) {
      const b = S.bounds; let p = null;
      for (let t = 0; t < 600; t++) { const x = b.x0 + (b.x1 - b.x0) * rng.next(), y = b.y0 + (b.y1 - b.y0) * rng.next(); if (!S.inside(x, y, pad)) continue; const r = S.re(x, y); p = { x: Math.round(x), y: Math.round(y) }; if (r >= re0 && r < re1) return p; }
      return p || { x: cx, y: cy };
    },
  };
  return S;
}

/** Turn a list of [x, y] control points into a winding polyline ({x, y}): every leg is split into ~seg-long pieces whose
 *  interior points swing sideways (two sine bends of random phase + a little noise), endpoints stay put. */
export function wind(ctrl, amp = 160, seed = 1, seg = 230) {
  const out = [{ x: ctrl[0][0], y: ctrl[0][1] }];
  for (let k = 1; k < ctrl.length; k++) {
    const [ax, ay] = ctrl[k - 1], [bx, by] = ctrl[k], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / seg)), nx = -(by - ay) / L, ny = (bx - ax) / L;
    const ph = hash2(seed, k) * TAU, m = 1 + Math.floor(hash2(k, seed, 3) * 2), A = amp * Math.min(1, L / 900);
    for (let i = 1; i <= n; i++) {
      const t = i / n, off = i === n ? 0 : (Math.sin(t * Math.PI * m + ph) * Math.sin(t * Math.PI) * A + (hash2(seed + i, k, 7) - 0.5) * amp * 0.25);
      out.push({ x: Math.round(ax + (bx - ax) * t + nx * off), y: Math.round(ay + (by - ay) * t + ny * off) });
    }
  }
  return out;
}
/** crossings of two polylines ({x, y} lists): [{ x, y, ang (direction of b) }] */
export function crossings(a, b) {
  const out = [];
  for (let i = 1; i < a.length; i++) for (let j = 1; j < b.length; j++) {
    const p = a[i - 1], r = { x: a[i].x - p.x, y: a[i].y - p.y }, q = b[j - 1], s = { x: b[j].x - q.x, y: b[j].y - q.y }, den = r.x * s.y - r.y * s.x;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((q.x - p.x) * s.y - (q.y - p.y) * s.x) / den, u = ((q.x - p.x) * r.y - (q.y - p.y) * r.x) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) out.push({ x: Math.round(p.x + r.x * t), y: Math.round(p.y + r.y * t), ang: Math.atan2(s.y, s.x) });
  }
  return out;
}
/** distance from (x, y) to the nearest road segment */
export function roadDist(roads, x, y) {
  let best = 1e9;
  for (const pts of roads) for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], vx = b.x - a.x, vy = b.y - a.y, L = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / L));
    best = Math.min(best, Math.hypot(x - a.x - vx * t, y - a.y - vy * t));
  }
  return best;
}

// ------------------------------------------------------------------ The Wilds (the campfire Haven at 0,0)
export const WILDS_R = 5800;
/** danger thresholds on the effective-radius scale; the Haven is a plain 300 circle round the campfire */
export const WILDS_RINGS = [300, 1500, 2800, 4150, WILDS_R];
export const WILDS_SHAPE = makeLand({
  cx: 0, cy: 0, R: WILDS_R, cell: 50, blend: 900, noise: 170, warp: 380, nseed: 11, shore: 46, // (beach: client/wildsfx.js)
  lobes: [
    [0, 400, 2500, 2000, 0],          // Greenwood Glade: the Haven + Southmeadow
    [-3500, 700, 2200, 1500, 18],     // Stonefang Hills: the west lobe
    [-900, -3500, 1500, 2500, -12],   // the Grimtusk highlands: a long north lobe
    [2900, -2500, 2200, 1500, -32],   // the Ashen plateau (north-east, across the river)
    [5500, -700, 1600, 800, 18],      // the Ashfang spit: a narrow east peninsula
    [-2800, 4100, 1900, 1150, -28],   // Thornmaw's mire (south-west)
    [2700, 2700, 1800, 1300, 32],     // the Sunken Fields (south-east, across the river)
    [-4700, -2500, 1250, 750, 38],    // the Bonepoint (far north-west)
  ],
  bays: [[1200, -5200, 900, 1300, 10], [-4700, -900, 650, 500, 0], [500, 4400, 900, 700, 0], [4300, 1300, 700, 600, 0]],
  // danger seeds [x, y, D(1..4), weight]
  seeds: [
    [0, 0, 1, 3], [0, 1300, 1, 2], [-1300, 400, 1.1], [1100, 300, 1.25], [100, -1200, 1.35], [-700, 2300, 1.4],
    [-3100, 800, 2], [-4600, 1200, 2.3], [-2500, 2300, 1.95], [-2000, -500, 1.9],
    [-3300, 4400, 3.0], [-4300, 4700, 3.3], [-1900, 3900, 2.6],
    [2600, 2500, 2.0], [3600, 3200, 3.1], [4300, 3500, 3.9], [1800, 1700, 1.8],
    [2300, -1800, 2.6], [3200, -2700, 3.0], [4100, -1600, 3.5], [4300, -2900, 4.0], [2700, -3600, 3.9],
    [5300, -700, 3.8], [6400, -500, 4.3],
    [-500, -2500, 2.6], [-900, -3900, 3.6], [-1100, -5300, 4.3, 1.5], [-2000, -3300, 3.7],
    [-3700, -1700, 3.2], [-4900, -2600, 4.1],
  ],
  knots: [[1, 800], [1.5, 1500], [2.5, 2800], [3.5, 4150], [4.5, 5500]],
});
/** world bosses + landmarks: explicit spots; bosses sit in their own walled nooks at the end of a road */
export const WILDS_SITES = {
  grimtusk: { x: -1000, y: -5100, r: 340 },
  thornmaw: { x: -3650, y: 4650, r: 360 },
  ashfang: { x: 6150, y: -520, r: 360 },
  lake: { x: -2650, y: 1850, r: 175 },
  stones: { x: -4500, y: 450, r: 150 },
  tower: { x: 3350, y: -2950, r: 120 },
  elderoak: { x: -950, y: 850, r: 60 },
};
export const wildsSite = (k) => { const s = WILDS_SITES[k]; return { x: s.x, y: s.y, r: s.r }; };
/** dirt roads (control points; they are wound into meandering polylines) */
const WP = [
  [[0, -180], [-350, -1300], [-950, -2300], [-550, -3300], [-1250, -4200], [-1000, -4700]],      // north to Grimtusk's warcamp
  [[180, -40], [1150, -350], [2050, -900], [2900, -1250], [3900, -1450], [4800, -900], [5720, -560]], // east over the river to the Ashfang spit
  [[-140, 190], [-850, 1350], [-1750, 2550], [-2550, 3500], [-3300, 4280]],                        // south-west down into the mire
  [[-200, -20], [-1450, -250], [-2650, 380], [-3700, 650], [-4320, 520]],                          // west to the standing stones
  [[150, 220], [900, 1300], [1950, 1950], [2800, 2650], [3700, 3250]],                             // south-east over the river to the Sunken Fields
  [[2900, -1250], [3250, -2700], [2350, -3700], [1150, -4200], [-150, -3800], [-550, -3300]],      // the high loop: plateau, ford, highlands
  [[-3700, 650], [-3950, -650], [-3800, -1750], [-4700, -2450]],                                   // west lobe north to the Bonepoint
];
export const WILDS_ROADS = WP.map((c, i) => wind(c, 170, 31 + i * 7));
WILDS_SHAPE.carve(WILDS_ROADS); // (map fix: the south-west road to Thornmaw's mire ran over the beach / the sea)
/** the river Ashwater: a winding channel from the north coast to the south coast (impassable except at bridges / the ford) */
export const WILDS_RIVER = wind([[1250, -6200], [700, -4600], [1500, -3300], [1250, -2000], [1900, -950], [2050, 300], [1500, 1500], [2300, 2700], [1300, 3900], [1150, 5600]], 260, 777, 200);
export const WILDS_BRIDGES = WILDS_ROADS.flatMap((r) => crossings(WILDS_RIVER, r));
/** cliff escarpments between regions (wound polylines; roads punch gaps) */
export const WILDS_CLIFFS = [
  [[-1700, -1500], [-2300, -2400], [-2200, -3500], [-2700, -4300]],
  [[-300, -1900], [-1500, -1700], [-1700, -1500]],
  [[-1600, 2400], [-2500, 2900], [-3700, 3100], [-4500, 3500]],
  [[2400, -3900], [3600, -3700], [4400, -2700]],
  [[2900, 1600], [3700, 2000], [4300, 2700]],
  [[-4400, 1900], [-3600, 2050], [-3000, 1500]],
].map((c, i) => wind(c, 140, 901 + i * 13, 180));
export const WILDS_WALLS = { rings: [], spurs: [], chains: WILDS_CLIFFS };
export const WILDS_ELITES = [
  { x: -3300, y: 1900, zone: 2, group: ['boar', 'boar', 'skeleton', 'skeleton'] },
  { x: 2500, y: 2200, zone: 2, group: ['shroom', 'shroom', 'skeleton', 'boar'] },
  { x: 2700, y: -2900, zone: 3, group: ['golem', 'wisp', 'wisp', 'wolf'] },
  { x: -450, y: -2750, zone: 3, group: ['wolf', 'wolf', 'wolf', 'wolf', 'wisp'] },
  { x: 5200, y: -1000, zone: 4, group: ['knight', 'imp', 'imp', 'imp'] },
  { x: -4800, y: -2700, zone: 4, group: ['knight', 'knight', 'imp'] },
  { x: -1850, y: -4500, zone: 4, group: ['imp', 'imp', 'imp', 'imp'] },
];

// ------------------------------------------------------------------ Sunscorch Dunes (its own island far to the north)
export const DUNES_C = { x: 0, y: -16000 };
export const DUNES_RR = 3900;
export const DUNES_RINGS = [270, 1500, 2400, 3150, DUNES_RR];
const dx = (x) => x, dy = (y) => y - 16000; // (layout below is written relative to the oasis)
export const DUNES_SHAPE = makeLand({
  cx: DUNES_C.x, cy: DUNES_C.y, R: DUNES_RR, cell: 50, blend: 750, noise: 150, warp: 300, nseed: 47, shore: 44, // (sand rim: client/dunesfx.js)
  lobes: [
    [dx(0), dy(200), 1750, 1500, 0],          // the Oasis basin + Glassbead Flats
    [dx(-2300), dy(-500), 1700, 1050, -25],   // the Scarab Wastes (west)
    [dx(600), dy(-2900), 1150, 1700, 15],     // the Sunscar gorge (north): Khepra's nook at its head
    [dx(2600), dy(-900), 1500, 1050, 35],     // the Mirage Expanse (east)
    [dx(3600), dy(1300), 1100, 750, -20],     // Sekhem's terrace (south-east spur)
    [dx(-1700), dy(2300), 1500, 950, 20],     // the Glass Barrens (south-west): Ankhara's crater
    [dx(-3600), dy(-2300), 900, 600, 50],     // the Bone Shelf (far north-west)
  ],
  bays: [[dx(-1300), dy(-2600), 700, 600, 0], [dx(1900), dy(1800), 650, 500, 0], [dx(2500), dy(-2700), 600, 700, 0]],
  seeds: [
    [dx(0), dy(0), 1, 3], [dx(0), dy(1100), 1.05, 2], [dx(-900), dy(-300), 1.2], [dx(900), dy(-200), 1.25], [dx(300), dy(-1100), 1.4],
    [dx(-2100), dy(-400), 2.0], [dx(-3000), dy(-900), 2.4], [dx(-1500), dy(800), 1.8],
    [dx(500), dy(-2200), 2.6], [dx(700), dy(-3300), 3.6], [dx(500), dy(-4300), 4.3, 1.5],
    [dx(2000), dy(-600), 2.4], [dx(3000), dy(-1300), 3.0], [dx(3600), dy(-500), 3.2],
    [dx(3500), dy(1300), 3.7], [dx(4300), dy(1400), 4.2],
    [dx(-1500), dy(2200), 2.9], [dx(-2600), dy(2700), 3.3],
    [dx(-3600), dy(-2300), 4.0], [dx(-2900), dy(-1700), 3.2],
  ],
  knots: [[1, 900], [1.5, 1500], [2.5, 2400], [3.5, 3150], [4.5, 3850]],
});
export const DUNES_SITES = {
  khepra: { x: dx(520), y: dy(-3850), r: 300 },
  ankhara: { x: dx(-2050), y: dy(2450), r: 360 },
  sekhem: { x: dx(3950), y: dy(1450), r: 360 },
  sphinx: { x: dx(-1150), y: dy(500), r: 150 },
  crater: { x: dx(2350), y: dy(-1050), r: 190 },
  colossus: { x: dx(-2900), y: dy(-1000), r: 130 },
};
export const dunesSite = (k) => { const s = DUNES_SITES[k]; return { x: s.x, y: s.y, r: s.r }; };
const DP = [
  [[0, -180], [350, -1300], [250, -2300], [700, -3000], [520, -3480]],                // north up the gorge to Khepra
  [[180, -60], [1200, -350], [2000, -800], [2950, -1200], [3600, -600]],             // east into the Mirage Expanse
  [[3600, -600], [3500, 400], [3650, 1050]],                                         // down to Sekhem's terrace
  [[-170, 80], [-1100, 500], [-2100, -200], [-2900, -800], [-3500, -1700]],          // west through the Wastes to the Bone Shelf
  [[-80, 230], [-700, 1300], [-1400, 1800], [-1750, 2150]],                          // south-west to Ankhara's crater
  [[250, -2300], [-700, -1700], [-2100, -200]],                                      // the caravan cut-across (gorge to Wastes)
].map((c) => c.map(([x, y]) => [dx(x), dy(y)]));
export const DUNES_ROADS = DP.map((c, i) => wind(c, 150, 61 + i * 7));
DUNES_SHAPE.carve(DUNES_ROADS);
/** cliffs (mesa escarpments) splitting the regions; roads punch gaps */
export const DUNES_CLIFFS = [
  [[-800, -1500], [-1300, -2200], [-2000, -1900]],
  [[1300, -1600], [1500, -2600], [1900, -3200]],
  [[1400, 900], [2400, 500], [3000, 300]],
  [[-600, 1700], [-1100, 2700], [-700, 3300]],
  [[-2600, 1000], [-3400, 600]],
].map((c, i) => wind(c.map(([x, y]) => [dx(x), dy(y)]), 120, 401 + i * 11, 170));
export const DUNES_WALLS = { rings: [], spurs: [], chains: DUNES_CLIFFS };
export const DUNES_ELITES = [
  { x: dx(-1700), y: dy(-600), danger: 4, group: ['scarab', 'scarab', 'jackal', 'jackal'] },
  { x: dx(1700), y: dy(-500), danger: 4, group: ['sandwurm', 'scarab', 'scarab'] },
  { x: dx(3000), y: dy(-1600), danger: 5, group: ['mirage', 'mirage', 'jackal', 'jackal'] },
  { x: dx(-1100), y: dy(2100), danger: 5, group: ['sandwurm', 'mirage', 'mirage'] },
  { x: dx(4300), y: dy(1100), danger: 6, group: ['sandwurm', 'sandwurm', 'jackal', 'jackal'] },
  { x: dx(-3500), y: dy(-2300), danger: 6, group: ['mirage', 'mirage', 'mirage', 'scarab'] },
  { x: dx(900), y: dy(-3600), danger: 6, group: ['jackal', 'jackal', 'jackal', 'jackal', 'jackal'] },
];
