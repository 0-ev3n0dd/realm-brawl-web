// Shared helpers for the seeded open-world layouts (world.js = The Wilds, dunesgen.js = Sunscorch Dunes):
// a spatial hash for fast "is this spot clear?" checks, ridge-wall chains with gaps, ring sampling that follows the
// organic coastline (sim/mapshape.js). Pure + deterministic (only the Rng passed in).
import { roadDist } from './mapshape.js';
const DEG = Math.PI / 180;

export class Placer {
  constructor(cell = 200) { this.cell = cell; this.map = new Map(); }
  add(x, y, r, tag = 0) { const c = this.cell, k = Math.floor(x / c) + ',' + Math.floor(y / c); let l = this.map.get(k); if (!l) this.map.set(k, (l = [])); l.push({ x, y, r, tag }); }
  /** true if a circle (x, y, r) keeps `gap` clear of everything added (items tagged in `ignore` are skipped) */
  clear(x, y, r, gap = 0, ignore = -1) {
    const c = this.cell, reach = r + gap + 140, x0 = Math.floor((x - reach) / c), x1 = Math.floor((x + reach) / c), y0 = Math.floor((y - reach) / c), y1 = Math.floor((y + reach) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const l = this.map.get(cx + ',' + cy); if (!l) continue;
      for (const o of l) { if (o.tag === ignore) continue; const m = o.r + r + gap; if ((o.x - x) ** 2 + (o.y - y) ** 2 < m * m) return false; }
    }
    return true;
  }
}

/** A random land point in a danger band [re0, re1) of a shape (rejection-sampled over the danger field). */
export function ringPoint(rng, S, re0, re1) { return S.sample(rng, re0, re1); }

/** Ridge walls: overlapping boulders ("cliff"/"mesa" obstacles) along rings (with gaps) and radial spurs.
 *  Never placed on a road (roads punch their own gaps) or inside a protected circle. */
export function buildWalls(rng, S, spec, roads, protect, kind, zoneOf, extra = {}) {
  const out = [], step = extra.step || 64;
  const ok = (x, y) => roadDist(roads, x, y) > (extra.roadGap || 95) && !protect.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + 70);
  const push = (x, y) => {
    if (!ok(x, y)) return;
    const size = Math.round((extra.s0 || 58) + rng.next() * ((extra.s1 || 78) - (extra.s0 || 58)));
    out.push({ kind, x: Math.round(x), y: Math.round(y), size, r: Math.round(size * 0.74), zone: zoneOf(x, y), variant: Math.floor(rng.next() * 1000), wall: 1, ...(extra.tag || {}) });
  };
  // cliff chains: wound polylines ({x, y}) with a little jitter (pass 2 layouts)
  for (const pts of spec.chains || []) for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.round(L / step));
    for (let k = 0; k < n; k++) { const t = k / n, j = (rng.next() - 0.5) * 30; push(a.x + (b.x - a.x) * t + j, a.y + (b.y - a.y) * t + (rng.next() - 0.5) * 30); }
  }
  for (const ring of spec.rings || []) {
    let a = 0;
    while (a < 360) {
      const p = S.at(a, ring.re), dist = Math.hypot(p.x - S.cx, p.y - S.cy);
      const inGap = ring.gaps.some((g) => { let d = Math.abs(((a - g) % 360 + 540) % 360 - 180); return d * DEG * dist < (extra.gap || 150); });
      if (!inGap) { const j = (rng.next() - 0.5) * 36, q = S.at(a, ring.re + j); push(q.x, q.y); }
      a += (step / dist) / DEG;
    }
  }
  for (const [deg, r0, r1] of spec.spurs || []) {
    const p0 = S.at(deg, r0), p1 = S.at(deg, r1), L = Math.hypot(p1.x - p0.x, p1.y - p0.y), n = Math.ceil(L / step), nx = -(p1.y - p0.y) / L, ny = (p1.x - p0.x) / L;
    for (let i = 0; i <= n; i++) { const k = i / n, j = (rng.next() - 0.5) * 28 + Math.sin(k * 6 + deg) * 30; push(p0.x + (p1.x - p0.x) * k + nx * j, p0.y + (p1.y - p0.y) * k + ny * j); }
  }
  return out;
}

/** A boss nook: a cliff horseshoe round a site (radius r + pad) open toward `toward` (an {x, y} the road comes from). */
export function nookWall(rng, site, toward, kind, zone, extra = {}) {
  const out = [], R = site.r + (extra.pad || 120), open = Math.atan2(toward.y - site.y, toward.x - site.x), gap = extra.gap || 0.55;
  const n = Math.ceil((Math.PI * 2 * R) / (extra.step || 70));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, off = Math.abs(Math.atan2(Math.sin(a - open), Math.cos(a - open))); if (off < gap) continue;
    const rr = R + (rng.next() - 0.3) * 50 + (off > 2.2 ? 40 : 0), size = Math.round((extra.s0 || 60) + rng.next() * ((extra.s1 || 82) - (extra.s0 || 60)));
    out.push({ kind, x: Math.round(site.x + Math.cos(a) * rr), y: Math.round(site.y + Math.sin(a) * rr), size, r: Math.round(size * 0.74), zone, variant: Math.floor(rng.next() * 1000), wall: 1, nook: 1, ...(extra.tag || {}) });
  }
  return out;
}
/** Where a road arrives at a site: the road point about r + 400 out from it (for nook openings / arena gaps). */
export function roadEntry(roads, site) {
  let best = null, bd = 1e9;
  for (const pts of roads) for (const q of pts) { const d = Math.hypot(q.x - site.x, q.y - site.y); if (d > site.r + 900) continue; const e = Math.abs(d - site.r - 400); if (e < bd) { bd = e; best = q; } }
  return best || { x: site.x, y: site.y + 1 };
}
