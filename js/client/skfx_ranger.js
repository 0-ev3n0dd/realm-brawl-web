// Ranger: wind and feathers, green-and-gold light, hawk silhouettes, arrow rain, snares and nets of light, Quarry reticles, long precise streaks.
// The engine already draws the arrow projectiles, traps and Quarry marks; this layer adds real arrow shapes with fletching, rain that sticks in the ground,
// hawks that dive, a lock-on reticle and a lattice net. Clean and sharp: a marksman, not a mage.
import { TAU, clamp, lerp, seeded } from './fxsk_core.js';
import { bloom, ease } from './fxglow.js';

const C = { g: '#7fe36a', gold: '#ffe27a', hi: '#f1ffe0', cy: '#7af0ff', lime: '#b8ff7a', pale: '#d8ffb0', silk: '#e8ffd0' };

// ------------------------------------------------------------------ drawing helpers (local pieces)
function tri(ctx, x0, y0, x1, y1, w, col, a) { // a tapered blade of light: a point at (x0,y0) widening to w at (x1,y1)
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, px = -dy / d * w / 2, py = dx / d * w / 2;
  ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + px, y1 + py); ctx.lineTo(x1 - px, y1 - py); ctx.closePath(); ctx.fill();
}
function ribbon(ctx, pts, w0, w1) { // a tapered ribbon along a polyline
  const n = pts.length; if (n < 2) return;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, w = lerp(w0, w1, i / (n - 1)) / 2;
    L.push([pts[i][0] - dy / d * w, pts[i][1] + dx / d * w]); R.push([pts[i][0] + dy / d * w, pts[i][1] - dx / d * w]);
  }
  ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]); for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]); ctx.closePath(); ctx.fill();
}
function arrowShape(ctx, x, y, ang, w, col, hi, a) { // an arrow with its tip at (x,y): shaft, two feathers, a white head
  const L = w * 7;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = a;
  ctx.fillStyle = col; ctx.fillRect(-L, -w * 0.16, L, w * 0.32);
  ctx.fillStyle = hi; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-L * 0.98, 0); ctx.lineTo(-L * 1.14, s * w * 0.8); ctx.lineTo(-L * 0.8, s * w * 0.66); ctx.lineTo(-L * 0.66, 0); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(w * 1.7, 0); ctx.lineTo(-w * 0.2, -w * 0.62); ctx.lineTo(w * 0.2, 0); ctx.lineTo(-w * 0.2, w * 0.62); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function hawkShape(ctx, s, flap, col, hi, a) { // a diving hawk seen from above, nose along +x: dark body with a bright rim so it reads as a silhouette
  const g = 0.82 + 0.28 * Math.sin(flap), op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#17482a'; ctx.strokeStyle = hi; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.globalAlpha = a;
  const part = () => { ctx.fill(); ctx.stroke(); };
  for (const sd of [-1, 1]) {
    const W = (x, y) => ctx.lineTo(s * x, sd * s * y * g);
    ctx.beginPath(); ctx.moveTo(s * 0.3, sd * s * 0.1); ctx.quadraticCurveTo(s * 0.3, sd * s * 0.95 * g, -s * 0.1, sd * s * 1.45 * g);
    W(-0.28, 1.15); W(-0.4, 1.4); W(-0.5, 1.0); W(-0.68, 1.22); W(-0.66, 0.8); W(-0.9, 0.86); W(-0.55, 0.14); ctx.closePath(); part();
    ctx.globalAlpha = a * 0.7; ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.beginPath(); for (const [x, y] of [[0.1, 0.35], [-0.1, 0.4], [-0.3, 0.45]]) { ctx.moveTo(s * x, sd * s * y); ctx.lineTo(s * (x - 0.28), sd * s * y * g * 2.4); } ctx.stroke(); ctx.globalAlpha = a; ctx.strokeStyle = hi; ctx.lineWidth = 2;
  }
  ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.1); ctx.lineTo(-s * 1.1, -s * 0.3); ctx.lineTo(-s * 1.0, 0); ctx.lineTo(-s * 1.1, s * 0.3); ctx.lineTo(-s * 0.5, s * 0.1); ctx.closePath(); part();
  ctx.beginPath(); ctx.ellipse(-s * 0.02, 0, s * 0.6, s * 0.22, 0, 0, TAU); part(); ctx.beginPath(); ctx.arc(s * 0.52, 0, s * 0.18, 0, TAU); part();
  ctx.fillStyle = C.gold; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(s * 0.64, -s * 0.08); ctx.lineTo(s * 0.95, s * 0.04); ctx.lineTo(s * 0.64, s * 0.1); ctx.closePath(); part();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.56, -s * 0.07, s * 0.045, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = op;
}

// ------------------------------------------------------------------ the class's own pieces
const prims = {
  /** A real arrow (shaft, feathers, head) flying from (x,y) along ang for len, with a tapered light trail; stick keeps it standing where it lands. */
  rng_arrow(ctx, c, k) {
    const fly = c.fly ?? 0.55, u = clamp(k / fly), pos = Math.pow(u, c.acc ?? 1), v = clamp((k - fly) / (1 - fly)), ca = Math.cos(c.ang), sa = Math.sin(c.ang), len = c.len, w = c.w || 6;
    const shud = k > fly && c.stick ? Math.sin(v * 38) * (1 - v) * 2.5 : 0, hx = c.x + ca * len * pos - sa * shud, hy = c.y + sa * len * pos + ca * shud;
    const a = k > fly ? (c.stick ? 1 - ease.in(clamp((v - 0.45) / 0.55)) : 1 - clamp(v * 2.4)) : 1; if (a <= 0.01) return;
    const tl = Math.min(len * pos, c.trail ?? 200) * (k > fly ? 1 - ease.out(v) : 1);
    if (tl > 2) { const tx = hx - ca * tl, ty = hy - sa * tl; tri(ctx, tx, ty, hx, hy, w * 2.6, c.col, a * 0.35); tri(ctx, tx, ty, hx, hy, w * 1.3, c.hi || c.col, a * 0.75); tri(ctx, tx, ty, hx, hy, w * 0.5, '#fff', a); }
    arrowShape(ctx, hx, hy, c.ang, w, c.col, c.hi || c.col, a);
    bloom(ctx, hx, hy, w * (k > fly ? 5 * (1 - v) + 2 : 3.4), c.hi || c.col, 0.85 * a);
  },
  /** Arrow rain over a circle: each arrow drops in on its own beat, lands with a pop and a short ring, and stays standing a moment. */
  rng_rain(ctx, c, k) {
    const R = seeded(c.seed), L = c.life - c.d, t = k * L, fd = c.fd ?? 0.2, fromA = c.from ?? -1.75, dx = Math.cos(fromA), dy = Math.sin(fromA), hd = fromA + Math.PI, len = c.len || 440, w = c.w || 6.5, gap = c.stay ?? 0.45;
    for (let i = 0; i < c.n; i++) {
      const st = R() * Math.max(0.05, L - fd - gap), an = R() * TAU, rr = Math.sqrt(R()) * c.R, gold = R() < 0.3, col = gold ? C.gold : c.col, hi = gold ? '#fff6c8' : c.hi || '#fff', jit = (R() - 0.5) * 0.3;
      const u = (t - st) / fd; if (u <= 0) continue;
      const lx = c.x + Math.cos(an) * rr, ly = c.y + Math.sin(an) * rr * 0.6, ex = Math.cos(fromA + jit), ey = Math.sin(fromA + jit), h2 = hd + jit;
      if (u < 1) {
        const p = Math.pow(u, 1.25), hx = lx + ex * len * (1 - p), hy = ly + ey * len * (1 - p), tl = Math.min(len * 0.26, len * p);
        tri(ctx, hx + ex * tl, hy + ey * tl, hx, hy, w * 1.8, col, 0.5); tri(ctx, hx + ex * tl, hy + ey * tl, hx, hy, w * 0.7, '#fff', 0.9);
        arrowShape(ctx, hx, hy, h2, w * 0.9, col, hi, 1);
      } else {
        const lu = clamp((u - 1) * fd / gap); if (lu >= 1) continue; const a = 1 - lu;
        bloom(ctx, lx, ly, w * 9 * (1 - lu * 0.6), col, 0.8 * a); arrowShape(ctx, lx, ly, h2, w * 0.75, col, hi, a * (1 - ease.in(lu)));
        ctx.save(); ctx.translate(lx, ly); ctx.scale(1, 0.6); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, 6 + 24 * ease.out(lu), 0, TAU); ctx.stroke(); ctx.restore();
      }
    }
  },
  /** A hawk that stoops onto (x,y) from the sky along a curved line, wings flicking, then bursts on the target and climbs away. */
  rng_hawk(ctx, c, k, time) {
    const hit = c.hit ?? 0.55, s = c.size || 32, fa = c.from ?? -2.2, len = c.len || 340, curve = c.curve ?? 0.2, sx = c.x + Math.cos(fa) * len, sy = c.y + Math.sin(fa) * len, px = -Math.sin(fa), py = Math.cos(fa);
    const Q = (kk) => (kk < hit ? Math.pow(kk / hit, 1.25) : 1 + 0.4 * (kk - hit) / (1 - hit));
    const P = (q) => { const m = clamp(q, 0, 1); return [lerp(sx, c.x, q) + px * curve * len * Math.sin(Math.PI * m), lerp(sy, c.y, q) + py * curve * len * Math.sin(Math.PI * m)]; };
    const q = Q(k), p = P(q), p2 = P(q + 0.03), p1 = P(Math.max(0, q - 0.03)), ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]), a = k < hit ? clamp(k / 0.08) : 1 - ease.in(clamp((k - hit - 0.1) / (1 - hit - 0.1)));
    if (a > 0.01) {
      const pts = []; for (let j = 8; j >= 0; j--) pts.push(P(Math.max(0, Q(k) - j * (k < hit ? 0.05 : 0.02))));
      ctx.globalAlpha = a * 0.35; ctx.fillStyle = c.col; ribbon(ctx, pts, 2, s * 1.1); ctx.globalAlpha = a * 0.8; ctx.fillStyle = '#fff'; ribbon(ctx, pts, 1, s * 0.25);
      bloom(ctx, p[0], p[1], s * 2.6, c.col, 0.55 * a);
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(ang); hawkShape(ctx, s, time * 14 + c.seed % 7, c.col, c.hi || '#fff', a); ctx.restore();
    }
    if (k >= hit) {
      const u = clamp((k - hit) / (1 - hit)), e = 1 - u;
      bloom(ctx, c.x, c.y, s * 2.6 * (0.5 + ease.out(u)), c.col, 0.55 * e); bloom(ctx, c.x, c.y, s * 0.9, '#fff', 0.6 * (1 - ease.out(clamp(u * 2))), 1);
      ctx.save(); ctx.translate(c.x, c.y); ctx.strokeStyle = c.hi || '#fff'; ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) { const an = i / 8 * TAU + fa, r0 = s * 0.5 * ease.out(u), r1 = s * (0.9 + 1.3 * ease.out(u)); ctx.globalAlpha = e; ctx.lineWidth = 2.4 * e + 0.6; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0 * 0.7); ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1 * 0.7); ctx.stroke(); }
      ctx.restore();
    }
  },
  /** The Quarry reticle: brackets close in from far out, lock with a pulse, then hold on the target. */
  rng_reticle(ctx, c, k, time) {
    const lock = c.lock ?? 0.3, e = ease.out(clamp(k / lock)), R = c.R * lerp(2.4, 1, e), a = ease.in(clamp((1 - k) / 0.3)) * clamp(k / 0.08), rot = time * (c.spin ?? 1.2) * (k < lock ? 1 : 0.25);
    ctx.save(); ctx.translate(c.x, c.y); ctx.lineCap = 'round';
    ctx.globalAlpha = a * 0.9; ctx.strokeStyle = c.col; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    ctx.globalAlpha = a * 0.55; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, R * 0.8, 0, TAU); ctx.stroke();
    ctx.globalAlpha = a; ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(Math.cos(an) * R * 1.32, Math.sin(an) * R * 1.32); ctx.lineTo(Math.cos(an) * R * 0.4, Math.sin(an) * R * 0.4); ctx.stroke(); }
    ctx.strokeStyle = c.b || c.col; ctx.lineWidth = 5; for (let i = 0; i < 4; i++) { const an = rot + i * Math.PI / 2; ctx.beginPath(); ctx.arc(0, 0, R * 1.08, an - 0.32, an + 0.32); ctx.stroke(); }
    const pl = k >= lock ? 1 - clamp((k - lock) / 0.16) : 0, dm = R * (0.12 + 0.05 * pl);
    ctx.save(); ctx.rotate(Math.PI / 4); ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.fillRect(-dm, -dm, dm * 2, dm * 2); ctx.restore();
    if (pl > 0) { ctx.globalAlpha = a * pl; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R * (1 + (1 - pl) * 0.6), 0, TAU); ctx.stroke(); }
    ctx.restore(); bloom(ctx, c.x, c.y, R * 1.3, c.col, 0.3 * a + 0.55 * pl * a);
  },
  /** A precision lane: two thin rails with range ticks and chevrons racing down it. */
  rng_lane(ctx, c, k) {
    const ext = ease.out(clamp(k / 0.2)), a = ease.in(clamp((1 - k) / 0.4)) * clamp(k / 0.05), ca = Math.cos(c.ang), sa = Math.sin(c.ang), len = c.len * ext, w = c.w || 14;
    const at = (d, o) => [c.x + ca * d - sa * o, c.y + sa * d + ca * o];
    ctx.lineCap = 'round';
    ctx.globalAlpha = a * 0.12; ctx.fillStyle = c.col; ctx.beginPath(); let q = at(0, -w); ctx.moveTo(q[0], q[1]); q = at(len, -w * 0.3); ctx.lineTo(q[0], q[1]); q = at(len, w * 0.3); ctx.lineTo(q[0], q[1]); q = at(0, w); ctx.lineTo(q[0], q[1]); ctx.closePath(); ctx.fill();
    for (const sd of [-1, 1]) { ctx.globalAlpha = a * 0.8; ctx.strokeStyle = c.hi || c.col; ctx.lineWidth = 1.8; ctx.beginPath(); q = at(0, sd * w); ctx.moveTo(q[0], q[1]); q = at(len, sd * w * 0.3); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
    ctx.globalAlpha = a * 0.55; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let d = 50; d < len; d += 50) { const ww = lerp(w, w * 0.3, d / c.len); q = at(d, -ww); ctx.moveTo(q[0], q[1]); q = at(d, -ww + 7); ctx.lineTo(q[0], q[1]); q = at(d, ww); ctx.moveTo(q[0], q[1]); q = at(d, ww - 7); ctx.lineTo(q[0], q[1]); } ctx.stroke();
    ctx.strokeStyle = c.b || c.hi; ctx.lineWidth = 2.4; for (let i = 0; i < 4; i++) { const d = ((k * 2.2 + i / 4) % 1) * len, ww = lerp(w, w * 0.3, d / c.len) * 0.7; ctx.globalAlpha = a * (1 - d / (len + 1)) * 0.9; ctx.beginPath(); q = at(d - ww * 0.8, -ww); ctx.moveTo(q[0], q[1]); q = at(d, 0); ctx.lineTo(q[0], q[1]); q = at(d - ww * 0.8, ww); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
    q = at(len, 0); bloom(ctx, q[0], q[1], w * 2.2, c.col, 0.6 * a);
  },
  /** A net of light dropped on the ground: a diamond lattice with glowing knots inside a rope rim, pulled tight at the end. */
  rng_net(ctx, c, k, time) {
    const inK = ease.out(clamp(k / 0.22)), pull = ease.in(clamp((k - 0.62) / 0.38)), a = ease.in(clamp((1 - k) / 0.28)) * clamp(k / 0.05), R = c.R * (0.4 + 0.6 * inK) * (1 - 0.2 * pull), cell = R / 3.2;
    ctx.save(); ctx.translate(c.x, c.y + 12); ctx.scale(1, 0.6);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip(); ctx.rotate(c.rot || 0.2); ctx.strokeStyle = c.col; ctx.lineWidth = 1.8; ctx.globalAlpha = a * 0.85;
    for (const fam of [Math.PI / 4, -Math.PI / 4]) { ctx.save(); ctx.rotate(fam); ctx.beginPath(); for (let i = -6; i <= 6; i++) { ctx.moveTo(-R * 1.5, i * cell); ctx.lineTo(R * 1.5, i * cell + Math.sin(i * 1.7) * 3); } ctx.stroke(); ctx.restore(); }
    ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.rotate(Math.PI / 4); for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) { const x = i * cell, y = j * cell; if (Math.hypot(x, y) < R * 0.96) ctx.fillRect(x - 2, y - 2, 4, 4); }
    ctx.restore();
    ctx.globalAlpha = a * 0.6; ctx.strokeStyle = c.col; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke(); ctx.globalAlpha = a * 0.95; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.stroke();
    for (let i = 0; i < 12; i++) { const an = i / 12 * TAU + time * 0.4; bloom(ctx, Math.cos(an) * R, Math.sin(an) * R, 11, c.b || c.col, 0.7 * a); }
    ctx.restore(); bloom(ctx, c.x, c.y + 12, R * 0.9, c.col, 0.25 * a + 0.4 * pull * a);
  },
  /** A snap trap: a ring of teeth opens, then clamps inward on the plate and flashes. */
  rng_trapjaw(ctx, c, k) {
    const open = ease.out(clamp(k / 0.16)), snap = ease.in(clamp((k - 0.2) / 0.1)), a = ease.in(clamp((1 - k) / 0.3)) * clamp(k / 0.04), N = c.n || 10, R = c.R, pop = k > 0.3 ? 1 - clamp((k - 0.3) / 0.2) : 0;
    ctx.save(); ctx.translate(c.x, c.y + 12); ctx.scale(1, 0.6);
    ctx.globalAlpha = a * 0.7; ctx.strokeStyle = c.col; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, R * 0.96 * open, 0, TAU); ctx.stroke(); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    for (let i = 0; i < N; i++) {
      const an = i / N * TAU + 0.3, tip = lerp(R * 0.62, R * 0.1, snap) * (i % 2 ? 0.82 : 1) * open, base = R * 0.94 * open, wd = 0.17;
      ctx.beginPath(); ctx.moveTo(Math.cos(an - wd) * base, Math.sin(an - wd) * base); ctx.lineTo(Math.cos(an) * tip, Math.sin(an) * tip); ctx.lineTo(Math.cos(an + wd) * base, Math.sin(an + wd) * base); ctx.closePath();
      ctx.globalAlpha = a * 0.5; ctx.fillStyle = c.col; ctx.fill(); ctx.globalAlpha = a * 0.95; ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 1.8; ctx.stroke();
    }
    ctx.globalAlpha = a * 0.9; ctx.strokeStyle = c.b || c.gold || c.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R * 0.17, 0, TAU); ctx.stroke();
    ctx.restore(); bloom(ctx, c.x, c.y + 12, R * (0.5 + 0.4 * pop), c.b || c.col, (0.12 + 0.35 * pop) * a);
  },
  /** A bright zig-zag line through a list of points (a ricochet path): it is drawn out along the points, then lingers and fades with a diamond at every bounce. */
  rng_path(ctx, c, k) {
    const pts = c.pts, n = pts.length, draw = clamp(k / (c.reveal ?? 0.5)), a = ease.in(clamp((1 - k) / 0.45)), upto = draw * (n - 1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, col, al] of [[16, c.col, 0.3], [6, c.hi || c.col, 0.8], [2.2, "#fff", 1]]) {
      ctx.lineWidth = w; ctx.strokeStyle = col; ctx.globalAlpha = a * al; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < n; i++) { const f = clamp(upto - (i - 1)); if (f <= 0) break; ctx.lineTo(lerp(pts[i - 1].x, pts[i].x, f), lerp(pts[i - 1].y, pts[i].y, f)); } ctx.stroke();
    }
    for (let i = 1; i < n; i++) { if (upto < i) break; const pop = 1 + Math.max(0, 1 - (upto - i) * 3), sz = (i === 1 ? 11 : 8) * pop; ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y - sz); ctx.lineTo(pts[i].x + sz * 0.7, pts[i].y); ctx.lineTo(pts[i].x, pts[i].y + sz); ctx.lineTo(pts[i].x - sz * 0.7, pts[i].y); ctx.closePath(); ctx.fill(); bloom(ctx, pts[i].x, pts[i].y, sz * 2.4, c.col, 0.6 * a); }
  },
  /** Wind: a handful of thin curved gust lines sweeping along ang. */
  rng_wind(ctx, c, k) {
    const R = seeded(c.seed), a = ease.in(clamp((1 - k) / 0.5)), ca = Math.cos(c.ang), sa = Math.sin(c.ang); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < c.n; i++) {
      const off = (R() - 0.5) * 2 * (c.spread || 30), st = R() * 0.3, ln = c.len * (0.5 + R() * 0.6), ph = R() * TAU, lw = 1 + R() * 2.2, white = i % 3 === 0, al = 0.4 + R() * 0.5, u = clamp((k - st) / 0.55);
      if (u <= 0) continue; const head = ease.out(u), tail = ease.in(clamp((u - 0.25) / 0.75)); ctx.beginPath();
      for (let j = 0; j <= 8; j++) { const d = lerp(tail, head, j / 8) * ln, o = off + Math.sin(d * 0.022 + ph) * (c.amp ?? 9); ctx[j ? 'lineTo' : 'moveTo'](c.x + ca * d - sa * o, c.y + sa * d + ca * o); }
      ctx.globalAlpha = a * al; ctx.strokeStyle = white ? '#fff' : c.col; ctx.lineWidth = lw; ctx.stroke();
    }
  },
};

// ------------------------------------------------------------------ helpers for the recipes
const T = (dist, speed) => dist / speed; // flight time of an engine projectile
const ang2 = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

export default {
  pal: { a: '#7fe36a', b: '#ffe27a', hi: '#f1ffe0', deep: '#0e2410', ink: '#08140a', edge: '#c8f5a0' },
  prims, underPrims: ['rng_net', 'rng_trapjaw'],
  skills: {
    dashshot(k) { // a backflip leaves wind and ghosts behind while a heavy gold arrow flies forward
      const back = k.ang + Math.PI, e = k.ahead(-240), o = k.ahead(-90), hitD = Math.min(k.dist, 560);
      k.ghost({ x: k.x, y: k.y, x2: e.x, y2: e.y, n: 5, size: 16, col: C.g, hi: C.hi, life: 0.5 });
      k.rng_wind({ x: k.x, y: k.y, ang: back, len: 300, n: 9, spread: 34, col: C.pale, life: 0.5 });
      k.ring({ x: k.x, y: k.y, R: 85, col: C.g });
      k.motes({ x: k.x, y: k.y, n: 12, type: 'feather', spd: 260, size: 8, col: C.hi, col2: C.g, spread: TAU, g: 60, life: 0.9 });
      k.rng_arrow({ x: o.x, y: o.y, ang: k.ang, len: 630, w: 9, trail: 300, fly: 0.93, life: 0.72, d: 0.07, col: C.gold, hi: '#fff6c8' });
      k.streak({ x: o.x, y: o.y, ang: k.ang, len: 620, w: 13, col: C.g, hi: C.hi, d: 0.07, life: 0.4, ticks: 5 });
      if (k.enemy) { const p = k.ahead(hitD); k.burst({ x: p.x, y: p.y, n: 8, len: 100, col: C.gold, hi: '#fff', d: 0.07 + T(hitD - 90, 950) }); }
    },
    pierce(k) { // a long, precise lane, then one white-green arrow that runs through everything in line
      const o = k.ahead(26), L = 735, d0 = 0.17, hitD = Math.min(k.dist, L);
      k.flash({ x: o.x, y: o.y, R: 70, col: C.gold, d: 0.02, life: 0.3 });
      k.ring({ x: k.x, y: k.y, R: 70, col: C.g, d: 0.02, n: 1 });
      k.motes({ x: o.x, y: o.y, n: 8, type: 'star', spd: 140, size: 6, col: C.gold, col2: '#fff', spread: TAU, d: 0.02, life: 0.5 });
      k.rng_lane({ x: o.x, y: o.y, ang: k.ang, len: L, w: 16, d: 0.05, life: 0.95, col: C.g, hi: C.hi, b: C.gold });
      k.rng_arrow({ x: o.x, y: o.y, ang: k.ang, len: L, w: 11, trail: 380, fly: 0.95, life: 0.72, d: d0, col: C.lime, hi: '#fff' });
      k.streak({ x: o.x, y: o.y, ang: k.ang, len: L, w: 10, col: C.g, hi: C.hi, d: d0, life: 0.45, ticks: 7 });
      if (k.enemy) { const p = k.ahead(hitD); k.rng_reticle({ x: p.x, y: p.y, R: 44, d: d0 + T(hitD, 1050) - 0.05, life: 0.6, lock: 0.2, col: C.g, hi: C.hi, b: C.gold }); k.burst({ x: p.x, y: p.y, n: 8, len: 120, col: C.g, hi: '#fff', d: d0 + T(hitD, 1050) }); }
    },
    volley(k) { // three shafts go up, then a pinned circle on the ground and arrows rain into it, sticking in the dirt
      const p = k.ahead(Math.min(k.dist, 430));
      for (let i = 0; i < 3; i++) k.rng_arrow({ x: k.x + (i - 1) * 14, y: k.y - 26, ang: -Math.PI / 2 + (i - 1) * 0.2, len: 520, w: 5, trail: 240, fly: 0.85, life: 0.5, d: 0.02 + i * 0.05, col: C.gold, hi: '#fff6c8' });
      k.sigil({ x: p.x, y: p.y, R: 115, n: 5, col: C.g, hi: C.hi, b: C.gold, d: 0.1, life: 1.7, hold: 0.85 });
      k.rng_rain({ x: p.x, y: p.y, R: 115, n: 30, len: 460, from: -1.8, d: 0.45, life: 1.15, fd: 0.2, col: C.g, hi: C.hi });
    },
    trap(k) { // an arrow pins the trap to the ground, a ring of teeth opens and snaps inward, with a puff of leaves
      const p = k.ahead(Math.min(k.dist, 170)), an = 1.45, Ln = 460;
      k.rng_arrow({ x: p.x - Math.cos(an) * Ln, y: p.y - Math.sin(an) * Ln, ang: an, len: Ln, w: 7, trail: 220, fly: 0.36, life: 0.95, d: 0.02, stick: true, col: C.gold, hi: '#fff6c8' });
      k.rng_trapjaw({ x: p.x, y: p.y, R: 85, n: 10, d: 0.18, life: 1.8, col: C.g, hi: C.hi, b: C.gold });
      k.motes({ x: p.x, y: p.y, n: 12, type: 'leaf', spd: 220, g: 120, size: 7, col: C.lime, col2: '#fff', spread: TAU, d: 0.18 });
    },
    storm_of_arrows(k) { // one arrow into the sky bursts open, a rune circle and a funnel of wind answer with a wide rain
      const p = k.ahead(Math.min(k.dist, 470));
      k.rng_arrow({ x: k.x, y: k.y - 20, ang: -Math.PI / 2, len: 430, w: 12, trail: 260, fly: 0.7, life: 0.6, d: 0.03, col: C.gold, hi: '#fff' });
      k.burst({ x: k.x, y: k.y - 440, n: 14, len: 150, col: C.gold, hi: '#fff', d: 0.28, life: 0.7 });
      k.sigil({ x: p.x, y: p.y, R: 210, n: 8, col: C.g, hi: C.hi, b: C.gold, d: 0.15, life: 2.3, hold: 0.88 });
      k.swirl({ x: p.x, y: p.y + 30, R: 150, h: 340, arms: 3, col: '#9fe8b0', hi: '#d8f6e0', spin: 7, w: 6, d: 0.25, life: 1.5, cone: 1 });
      k.rng_rain({ x: p.x, y: p.y, R: 210, n: 38, len: 560, from: -1.95, d: 0.3, life: 1.6, fd: 0.18, col: C.g, hi: C.hi });
      k.motes({ x: p.x, y: p.y, n: 18, type: 'feather', spd: 200, g: -30, size: 8, col: C.hi, col2: C.gold, ang: -Math.PI / 2, spread: 2.8, sway: 24, d: 0.3, life: 1.6, opt: true });
      k.shake(0.2);
    },
  },
  basic(k, ev) { // short arrow with a light trail; the third shot is a gold fan of three with a small wind arc
    const s = k.ahead(26);
    if (ev && (ev.idx === 2 || ev.heavy)) {
      for (const da of [-0.2, 0, 0.2]) k.rng_arrow({ x: s.x, y: s.y, ang: k.ang + da, len: 340, w: da ? 4.5 : 6.5, trail: 170, fly: 0.9, life: 0.42, d: 0.03, col: da ? C.lime : C.gold, hi: da ? C.hi : '#fff6c8' });
      k.ring({ x: s.x, y: s.y, R: 44, n: 1, w: 10, col: C.gold, d: 0.03, life: 0.4 });
      k.wave({ x: s.x, y: s.y, ang: k.ang, arc: 1.2, r: 90, n: 2, w: 8, col: C.g, hi: C.hi, d: 0.03, life: 0.3 });
    } else {
      k.rng_arrow({ x: s.x, y: s.y, ang: k.ang, len: 300, w: 4.5, trail: 150, fly: 0.85, life: 0.36, d: 0.03, col: C.g, hi: C.hi });
      k.motes({ x: s.x, y: s.y, n: 3, type: 'feather', spd: 120, size: 6, col: C.hi, ang: k.ang + Math.PI, spread: 1.4, d: 0.03, life: 0.5, opt: true });
    }
  },
  ult(k) { // Arrow Storm: a giant shaft opens the sky, hawk wings spread over a double rune circle, four light shafts and two waves of rain
    const p = k.ahead(Math.min(k.dist, 480));
    k.rng_arrow({ x: p.x - 30, y: p.y + 40, ang: -Math.PI / 2, len: 520, w: 16, trail: 320, fly: 0.7, life: 0.65, d: 0.04, col: C.gold, hi: '#fff' });
    k.flash({ x: p.x, y: p.y - 330, R: 200, col: C.gold, d: 0.3 });
    k.wings({ x: p.x, y: p.y - 230, span: 300, col: C.g, hi: '#f4ffe0', d: 0.28, life: 1.6 });
    k.sigil({ x: p.x, y: p.y, R: 190, n: 7, col: C.g, hi: C.hi, b: C.gold, d: 0.2, life: 4.3, hold: 0.9 }); // (4.3 s = the sim's storm area: delay 18 + 16 pulses x 15 ticks)
    k.sigil({ x: p.x, y: p.y, R: 112, n: 5, col: C.gold, hi: '#fff', b: C.g, d: 0.3, life: 4.0, hold: 0.9, spin: -1.5 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.7; k.pillar({ x: p.x + Math.cos(a) * 190, y: p.y + Math.sin(a) * 112, h: 460, w: 6, col: C.g, hi: C.g, d: 0.28 + i * 0.06, life: 1.3 }); }
    k.rng_rain({ x: p.x, y: p.y, R: 190, n: 40, len: 560, from: -1.85, d: 0.5, life: 2.2, fd: 0.2, col: C.g, hi: C.hi });
    k.rng_rain({ x: p.x, y: p.y, R: 190, n: 32, len: 560, from: -1.7, d: 2.6, life: 2.0, fd: 0.2, col: C.g, hi: C.hi, opt: true });
    k.ring({ x: p.x, y: p.y, R: 215, n: 2, w: 16, col: C.g, d: 0.4 });
    k.motes({ x: p.x, y: p.y, n: 26, type: 'feather', spd: 170, g: -30, size: 9, col: C.hi, col2: C.gold, ang: -Math.PI / 2, spread: 3, d: 0.4, life: 1.8, opt: true });
    k.kick(0.05); k.shake(0.6);
  },
  chains: {
    evasive_barrage(k, s) { // the backflip trails wind, and the volley lands at once: a dense, fast sheet of arrows
      const e = k.ahead(-200);
      k.ghost({ x: k.x, y: k.y, x2: e.x, y2: e.y, n: 5, size: 16, col: C.g, hi: C.hi, life: 0.5 });
      k.rng_wind({ x: k.x, y: k.y, ang: k.ang + Math.PI, len: 280, n: 8, spread: 30, col: C.pale, life: 0.5 });
      k.rng_rain({ x: s.x, y: s.y, R: 150, n: 32, len: 420, from: -1.7, d: 0.05, life: 0.8, fd: 0.16, stay: 0.4, col: C.g, hi: C.hi });
      k.ring({ x: s.x, y: s.y, R: 150, n: 2, w: 16, col: C.g, d: 0.18 });
      k.motes({ x: s.x, y: s.y, n: 14, type: 'spark', spd: 280, size: 6, col: C.gold, col2: '#fff', spread: TAU, d: 0.15, g: 260 });
    },
    rapid_finale(k, s) { // three arrows converge on the boss, then one thick piercing arrow lands and cracks the ground (knockdown)
      const o = k.ahead(24), D = Math.hypot(s.x - o.x, s.y - o.y), A = ang2(o, s), hitT = 0.22 + T(D, 1050);
      for (let i = -1; i <= 1; i++) { const ox = o.x - Math.sin(A) * i * 46, oy = o.y + Math.cos(A) * i * 46, a = Math.atan2(s.y - oy, s.x - ox); k.rng_arrow({ x: ox, y: oy, ang: a, len: Math.hypot(s.x - ox, s.y - oy) + 40, w: 6, trail: 200, fly: 0.9, life: 0.4, d: 0.02 + Math.abs(i) * 0.03, col: i ? C.lime : C.gold, hi: '#fff' }); }
      k.rng_arrow({ x: o.x, y: o.y, ang: A, len: D + 300, w: 14, trail: 380, fly: 0.9, life: 0.7, d: 0.22, col: C.gold, hi: '#fff' });
      k.streak({ x: o.x, y: o.y, ang: A, len: D + 300, w: 14, col: C.g, hi: C.hi, d: 0.22, life: 0.4, ticks: 6 });
      k.rng_reticle({ x: s.x, y: s.y, R: 62, d: 0.18, life: 0.9, lock: 0.25, col: C.g, hi: C.hi, b: C.gold });
      k.burst({ x: s.x, y: s.y, n: 10, len: 130, col: C.gold, hi: '#fff', d: hitT });
      k.crack({ x: s.x, y: s.y, R: 150, n: 7, col: C.gold, hi: '#fff', d: hitT });
      k.motes({ x: s.x, y: s.y, n: 14, type: 'pix', spd: 300, g: 420, size: 5, col: C.gold, col2: '#fff', ang: -Math.PI / 2, spread: 2.2, d: hitT });
      k.shake(0.3);
    },
    hawkstorm(k, s) { // eight hawks stoop out of the sky onto the pack from different sides, feathers drifting after them
      k.rng_wind({ x: k.x, y: k.y, ang: k.ang, len: 200, n: 6, spread: 26, col: C.pale, life: 0.4 });
      for (let i = 0; i < 8; i++) { const a = s.a0 + i / 8 * TAU, r = 30 + (i % 3) * 45; k.rng_hawk({ x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r * 0.6, from: -2.7 + (i % 4) * 0.62, len: 340, size: 50, curve: i % 2 ? 0.2 : -0.2, d: i * 0.06, life: 0.8, hit: 0.55, col: C.g, hi: C.hi }); }
      k.rng_reticle({ x: s.x, y: s.y, R: 70, d: 0.35, life: 0.9, lock: 0.25, col: C.g, hi: C.hi, b: C.gold });
      k.motes({ x: s.x, y: s.y - 20, n: 22, type: 'feather', spd: 180, g: 30, size: 9, col: C.hi, col2: C.g, spread: TAU, d: 0.3, life: 1.4 });
    },
    snare_web(k, s) { // arrows pin a falling net of light to the ground; two traps nearby snap shut into the web
      k.rng_rain({ x: s.x, y: s.y, R: 150, n: 16, len: 380, from: -1.6, d: 0, life: 0.6, fd: 0.14, stay: 0.4, col: C.silk, hi: '#fff' });
      k.rng_net({ x: s.x, y: s.y, R: 190, d: 0.22, life: 1.5, col: C.silk, b: C.g });
      k.ring({ x: s.x, y: s.y, R: 200, n: 2, w: 14, col: C.silk, d: 0.22 });
      for (let i = 0; i < 2; i++) k.rng_trapjaw({ x: s.x + (i ? 115 : -115), y: s.y + (i ? 36 : -30), R: 62, n: 8, d: 0.26 + i * 0.05, life: 1.3, col: C.g, hi: C.hi, b: C.gold, opt: i > 0 });
      k.motes({ x: s.x, y: s.y, n: 14, type: 'snow', spd: 220, size: 6, col: C.silk, spread: TAU, d: 0.22, life: 1.0 });
    },
    deadeye(k, s) { // a reticle closes slowly on the target, Quarry orbs collapse into the shot, then one thin white sniper arrow
      const o = k.ahead(24), D = Math.hypot(s.x - o.x, s.y - o.y), A = ang2(o, s);
      k.rng_reticle({ x: s.x, y: s.y, R: 84, d: 0.04, life: 1.1, lock: 0.45, spin: 1.6, col: C.g, hi: C.hi, b: C.gold });
      k.orbit({ x: s.x, y: s.y, n: 5, R: 70, speed: 5, launch: 0.45, x2: s.x, y2: s.y - 10, size: 7, col: C.g, hi: C.hi, d: 0.02, life: 0.9 });
      k.rng_lane({ x: o.x, y: o.y, ang: A, len: D + 260, w: 10, d: 0.2, life: 0.9, col: C.gold, hi: '#fff', b: C.g });
      k.rng_arrow({ x: o.x, y: o.y, ang: A, len: D + 260, w: 8, trail: 500, fly: 0.7, life: 0.45, d: 0.5, col: '#ffffff', hi: '#ffffff' });
      k.streak({ x: o.x, y: o.y, ang: A, len: D + 420, w: 5, col: '#ffffff', hi: '#ffffff', d: 0.5, life: 0.35 });
      k.flash({ x: s.x, y: s.y, R: 100, col: C.gold, d: 0.58 });
      k.burst({ x: s.x, y: s.y, n: 6, len: 190, w: 0.03, col: C.gold, hi: '#fff', d: 0.58 });
      k.ring({ x: s.x, y: s.y, R: 150, n: 2, col: C.gold, d: 0.58 });
      k.shake(0.5);
    },
    storm_lance(k, s) { // a crackling cyan-green arrow flies into the volley zone and splits into a ring of arrows that each fly out
      const o = k.ahead(24), D = Math.hypot(s.x - o.x, s.y - o.y), A = ang2(o, s), tf = 0.12 + D / 1300;
      k.rng_arrow({ x: o.x, y: o.y, ang: A, len: D, w: 12, trail: 280, fly: 0.85, life: tf + 0.1, d: 0.02, col: C.cy, hi: '#ffffff' });
      k.bolt({ x: o.x, y: o.y, x2: s.x, y2: s.y, forks: 2, w: 4, col: C.cy, hi: '#eaffff', d: 0.04, life: 0.4 });
      k.flash({ x: s.x, y: s.y, R: 100, col: C.cy, d: tf });
      for (let i = 0; i < 9; i++) k.rng_arrow({ x: s.x, y: s.y, ang: s.a0 + i / 9 * TAU, len: 240, w: 6, trail: 130, fly: 0.7, life: 0.5, d: tf + 0.02, col: i % 2 ? C.lime : C.cy, hi: '#fff' });
      for (let i = 0; i < 3; i++) k.bolt({ x: s.x, y: s.y, x2: s.x + Math.cos(s.a0 + i * 2.1) * 220, y2: s.y + Math.sin(s.a0 + i * 2.1) * 130, forks: 1, w: 3, col: C.cy, hi: '#fff', d: tf + 0.02, life: 0.3, opt: true });
      k.ring({ x: s.x, y: s.y, R: 230, n: 2, col: C.cy, d: tf });
    },
    ricochet(k, s) { // one gold arrow zig-zags between enemies with a flash at each bounce
      const o = k.ahead(24), R = seeded(Math.floor(s.v * 1e6) + 5), pts = [{ x: o.x, y: o.y }, { x: s.x, y: s.y }];
      let dir = s.a0; for (let i = 0; i < 6; i++) { const q = pts[pts.length - 1]; dir += (R() < 0.5 ? -1 : 1) * (1.6 + R() * 1.2); const L = 230 + R() * 200; pts.push({ x: q.x + Math.cos(dir) * L, y: q.y + Math.sin(dir) * L * 0.7 }); }
      let tt = 0; for (let i = 1; i < pts.length; i++) tt += Math.max(0.1, Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) / 1500);
      k.rng_path({ pts, col: C.gold, hi: C.hi, d: 0.02, life: tt + 0.9, reveal: tt / (tt + 0.9) });
      let d = 0.02;
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1], q = pts[i], L = Math.hypot(q.x - p.x, q.y - p.y), seg = Math.max(0.1, L / 1500);
        k.rng_arrow({ x: p.x, y: p.y, ang: ang2(p, q), len: L, w: 6, trail: Math.min(220, L), fly: seg / (seg + 0.2), life: seg + 0.2, d, col: i % 2 ? C.gold : C.lime, hi: '#fff' });
        d += seg; k.flash({ x: q.x, y: q.y, R: i === 1 ? 90 : 56, col: C.gold, d, life: 0.3 }); if (i % 2) k.burst({ x: q.x, y: q.y, n: 6, len: 60, col: C.gold, hi: '#fff', d, life: 0.4, opt: true });
      }
    },
    hunters_mark(k, s) { // hawks stoop, the trap clamps, the reticle locks, then a fan of three arrows lands together on the marked boss
      const o = k.ahead(24), D = Math.hypot(s.x - o.x, s.y - o.y), A = ang2(o, s), hitT = 0.17 + T(D, 1050);
      k.rng_hawk({ x: s.x - 40, y: s.y, from: -2.4, len: 340, size: 52, curve: 0.2, d: 0, life: 0.75, col: C.g, hi: C.hi });
      k.rng_hawk({ x: s.x + 40, y: s.y, from: -0.7, len: 340, size: 52, curve: -0.2, d: 0.08, life: 0.75, col: C.g, hi: C.hi });
      k.rng_trapjaw({ x: s.x, y: s.y, R: 95, n: 12, d: 0.1, life: 1.6, col: C.g, hi: C.hi, b: C.gold });
      k.rng_reticle({ x: s.x, y: s.y, R: 76, d: 0.15, life: 1.3, lock: 0.3, col: C.gold, hi: '#fff', b: C.g });
      for (const off of [-0.16, 0, 0.16]) {
        k.rng_arrow({ x: o.x, y: o.y, ang: A + off, len: D + 260, w: off ? 8 : 11, trail: 340, fly: 0.9, life: 0.7, d: 0.17, col: off ? C.lime : C.gold, hi: '#fff' });
        k.streak({ x: o.x, y: o.y, ang: A + off, len: D + 260, w: 9, col: C.g, hi: C.hi, d: 0.17, life: 0.4, ticks: 4, opt: !!off });
      }
      k.burst({ x: s.x, y: s.y, n: 12, len: 130, col: C.gold, hi: '#fff', d: hitT });
      k.motes({ x: s.x, y: s.y, n: 18, type: 'star', spd: 280, size: 7, col: C.gold, col2: '#fff', spread: TAU, d: hitT, life: 1.0 });
    },
    skyline_scatter(k, s) { // a flip back, a bright horizon line, then three explosive salvos fall on the cursor, the last one cracking the ground
      const e = k.ahead(-180), sa = [-0.4, 0.4, 0];
      k.ghost({ x: k.x, y: k.y, x2: e.x, y2: e.y, n: 5, size: 16, col: C.g, hi: C.hi, life: 0.5 });
      k.rng_wind({ x: k.x, y: k.y, ang: k.ang + Math.PI, len: 260, n: 7, spread: 28, col: C.pale, life: 0.45 });
      k.streak({ x: s.x - 400, y: s.y - 300, ang: 0, len: 800, w: 5, col: C.gold, hi: '#fff', d: 0.05, life: 0.7 });
      for (let i = 0; i < 3; i++) {
        const d = 0.13 + i * 0.12, ox = s.x + sa[i] * 200 * 0.5, last = i === 2;
        k.rng_rain({ x: ox, y: s.y, R: 160, n: 12, len: 520, from: -1.45 + i * 0.25, d, life: 0.55, fd: 0.16, stay: 0.2, col: C.g, hi: C.hi });
        k.flash({ x: ox, y: s.y, R: last ? 190 : 140, col: C.gold, d: d + 0.26 });
        k.ring({ x: ox, y: s.y, R: last ? 250 : 190, n: last ? 3 : 1, w: 18, col: C.gold, d: d + 0.26 });
      }
      k.crack({ x: s.x, y: s.y, R: 200, n: 8, col: C.gold, hi: '#fff', d: 0.62 });
      k.burst({ x: s.x, y: s.y, n: 12, len: 160, col: C.gold, hi: '#fff', d: 0.62 });
      k.shake(0.4);
    },
    snarestorm_execution(k, s) { // a thorn cage and a net hold the boss, Quarry orbs are drawn in, and one blazing gold beam-arrow runs through it
      const o = k.ahead(24), A = ang2(o, s), D = Math.hypot(s.x - o.x, s.y - o.y), d0 = 0.5;
      k.rng_net({ x: s.x, y: s.y, R: 170, d: 0.04, life: 1.5, col: C.silk, b: C.g });
      k.rng_trapjaw({ x: s.x, y: s.y, R: 90, n: 10, d: 0.1, life: 1.4, col: C.g, hi: C.hi, b: C.gold });
      k.spires({ x: s.x, y: s.y, n: 8, R: 130, h: 120, wd: 10, shape: 'thorn', col: C.g, hi: C.silk, d: 0.12 });
      k.orbit({ x: s.x, y: s.y, n: 6, R: 80, speed: 5, launch: 0.5, x2: o.x, y2: o.y, size: 7, col: C.gold, hi: '#fff', d: 0.2, life: 0.8 });
      k.rng_reticle({ x: s.x, y: s.y, R: 90, d: 0.25, life: 1.0, lock: 0.3, col: C.gold, hi: '#fff', b: C.g });
      k.beam({ x: o.x, y: o.y, x2: o.x + Math.cos(A) * Math.max(D + 160, 800), y2: o.y + Math.sin(A) * Math.max(D + 160, 800), w: 20, col: C.gold, hi: '#fff', d: d0, life: 0.6 });
      k.rng_arrow({ x: o.x, y: o.y, ang: A, len: D + 300, w: 18, trail: 320, fly: 0.7, life: 0.55, d: d0, col: C.gold, hi: '#fff' });
      k.burst({ x: s.x, y: s.y, n: 12, len: 150, col: C.gold, hi: '#fff', d: d0 + 0.12 });
      k.crack({ x: s.x, y: s.y, R: 160, n: 8, col: C.gold, hi: '#fff', d: d0 + 0.12 });
      k.shake(0.6);
    },
    tempest_barrage(k, s) { // a tornado of arrows and six waves of squall rain, then it all collapses into one thunder-arrow that nails the ground
      const sx = s.x, sy = s.y;
      k.swirl({ x: sx, y: sy + 30, R: 170, h: 400, arms: 4, col: C.cy, hi: '#fff', spin: 8, w: 10, d: 0.02, life: 1.2 });
      k.rng_rain({ x: sx, y: sy, R: 190, n: 36, len: 520, from: -2.0, d: 0.06, life: 1.2, fd: 0.17, stay: 0.3, col: C.cy, hi: C.hi });
      for (let i = 0; i < 3; i++) k.bolt({ x: sx + (i - 1) * 120, y: sy - 520, x2: sx + (i - 1) * 50, y2: sy, forks: 3, w: 5, col: C.cy, hi: '#eef8ff', d: 0.6 + i * 0.05, life: 0.4 });
      k.rng_arrow({ x: sx - 60, y: sy - 700, ang: Math.atan2(700, 60), len: Math.hypot(700, 60), w: 26, trail: 500, fly: 0.45, life: 0.95, d: 0.78, stick: true, col: C.gold, hi: '#fff' });
      k.flash({ x: sx, y: sy, R: 200, col: C.cy, d: 0.9 });
      k.ring({ x: sx, y: sy, R: 270, n: 3, w: 24, col: C.cy, d: 0.9 });
      k.crack({ x: sx, y: sy, R: 240, n: 10, col: C.gold, hi: '#fff', d: 0.9 });
      k.burst({ x: sx, y: sy, n: 16, len: 260, col: C.cy, hi: '#fff', d: 0.9 });
      k.shake(0.7);
    },
    deathmark_volley(k, s) { // a double Deathmark reticle, three sniper arrows down one lane, then a last arrow drops straight onto the heart
      const o = k.ahead(24), D = Math.hypot(s.x - o.x, s.y - o.y), A = ang2(o, s);
      k.rng_reticle({ x: s.x, y: s.y, R: 70, d: 0.02, life: 1.6, lock: 0.3, spin: 1.5, col: C.gold, hi: '#fff', b: C.g });
      k.rng_reticle({ x: s.x, y: s.y, R: 118, d: 0.08, life: 1.6, lock: 0.4, spin: -1.1, col: C.g, hi: C.hi, b: C.gold });
      k.rng_lane({ x: o.x, y: o.y, ang: A, len: Math.max(D + 260, 750), w: 18, d: 0.1, life: 1.0, col: C.g, hi: C.hi, b: C.gold });
      for (let i = 0; i < 3; i++) { const d = 0.2 + i * 0.1; k.rng_arrow({ x: o.x, y: o.y, ang: A, len: D + 260, w: 9, trail: 400, fly: 0.7, life: 0.45, d, col: i === 1 ? C.gold : C.lime, hi: '#fff' }); k.streak({ x: o.x, y: o.y, ang: A, len: D + 260, w: 7, col: C.g, hi: C.hi, d, life: 0.3, opt: i > 0 }); k.flash({ x: s.x, y: s.y, R: 70, col: C.gold, d: d + 0.2, life: 0.3 }); }
      k.beam({ x: s.x, y: s.y - 620, x2: s.x, y2: s.y, w: 24, col: C.gold, hi: '#fff', d: 0.7, life: 0.55 });
      k.rng_arrow({ x: s.x, y: s.y - 620, ang: Math.PI / 2, len: 620, w: 18, trail: 360, fly: 0.5, life: 0.8, d: 0.7, stick: true, col: C.gold, hi: '#fff' });
      k.burst({ x: s.x, y: s.y, n: 16, len: 230, col: C.gold, hi: '#fff', d: 0.85 });
      k.ring({ x: s.x, y: s.y, R: 190, n: 3, w: 20, col: C.gold, d: 0.85 });
      k.shake(0.6);
    },
    skyfall(k, s) { // finisher: one arrow into the clouds, a huge rune circle, three layers of arrow rain and big falling arrows that explode
      const sx = s.x, sy = s.y;
      k.rng_arrow({ x: k.x, y: k.y - 20, ang: -Math.PI / 2, len: 560, w: 18, trail: 380, fly: 0.7, life: 0.6, d: 0.02, col: C.gold, hi: '#fff' });
      k.flash({ x: k.x, y: k.y - 520, R: 220, col: C.gold, d: 0.35 });
      k.sigil({ x: sx, y: sy, R: 330, n: 9, col: C.g, hi: C.hi, b: C.gold, d: 0.2, life: 2.6, hold: 0.9 });
      for (let i = 0; i < 3; i++) k.rng_rain({ x: sx, y: sy, R: 330, n: 36, len: 720, from: -2.0 + i * 0.16, d: 0.35 + i * 0.35, life: 1.0, fd: 0.2, stay: 0.3, col: C.g, hi: C.hi, opt: i === 2 });
      for (let i = 0; i < 4; i++) k.comet({ x: sx + (i - 1.5) * 150, y: sy + (i % 2 ? 40 : -40), from: -2.1 + i * 0.12, len: 760, size: 15, col: C.gold, hi: '#fff', impact: 120, d: 0.5 + i * 0.16, life: 0.7, hit: 0.5 });
      k.ring({ x: sx, y: sy, R: 340, n: 3, w: 22, col: C.g, d: 0.7 });
      k.crack({ x: sx, y: sy, R: 280, n: 10, col: C.gold, hi: '#fff', d: 0.7 });
      k.motes({ x: sx, y: sy, n: 30, type: 'feather', spd: 220, g: -20, size: 9, col: C.hi, col2: C.gold, spread: TAU, d: 0.7, life: 1.6, opt: true });
    },
    heavens_arrow(k, s) { // finisher: wings and a rune circle gather around the archer, a giant reticle locks, then one enormous gold arrow and a pillar of light
      const o = k.ahead(24), D = Math.hypot(s.x - o.x, s.y - o.y), A = ang2(o, s), L = Math.max(D + 380, 780), d0 = 0.7;
      k.sigil({ x: k.x, y: k.y, R: 120, n: 6, col: C.g, hi: C.hi, b: C.gold, d: 0, life: 1.4, hold: 0.7 });
      k.wings({ x: k.x, y: k.y, span: 230, col: C.g, hi: '#f4ffe0', d: 0.05, life: 1.2 });
      k.motes({ x: k.x, y: k.y, n: 18, type: 'star', spd: 120, size: 7, col: C.gold, col2: '#fff', ang: -Math.PI / 2, spread: TAU, d: 0.1, life: 1.0, g: -60, opt: true });
      k.rng_reticle({ x: s.x, y: s.y, R: 110, d: 0.05, life: 1.7, lock: 0.5, spin: 1.8, col: C.gold, hi: '#fff', b: C.g });
      k.rng_lane({ x: o.x, y: o.y, ang: A, len: L, w: 24, d: 0.3, life: 1.2, col: C.gold, hi: '#fff', b: C.g });
      k.beam({ x: o.x, y: o.y, x2: o.x + Math.cos(A) * L, y2: o.y + Math.sin(A) * L, w: 60, col: C.gold, hi: '#fff', d: d0, life: 0.8 });
      k.rng_arrow({ x: o.x, y: o.y, ang: A, len: L, w: 28, trail: 600, fly: 0.5, life: 0.7, d: d0, col: C.gold, hi: '#fff' });
      k.pillar({ x: s.x, y: s.y, h: 760, w: 40, col: C.gold, hi: '#fffbe0', d: d0 + 0.12, life: 1.0 });
      k.burst({ x: s.x, y: s.y, n: 18, len: 280, col: C.gold, hi: '#fff', d: d0 + 0.12 });
      k.ring({ x: s.x, y: s.y, R: 280, n: 3, w: 24, col: C.gold, d: d0 + 0.12 });
      k.shake(0.8);
    },
  },
  routes: {
    skyfall: { title: 'SKYFALL', sub: 'THE SKY ANSWERS  ·  PACK FINISHER', sfx: 'ヒュゴォォッ', kanji: '空', seal: '矢', rot: -0.08 },
    heavens_arrow: { title: "HEAVEN'S ARROW", sub: 'ONE SHOT  ·  BOSS FINISHER', sfx: 'ズバァァッ', kanji: '天', seal: '射', rot: 0.06 },
    tempest_barrage: { title: 'TEMPEST BARRAGE', sub: 'THE SQUALL COLLAPSES  ·  PACK FINISHER', sfx: 'ゴォォォッ', kanji: '嵐', seal: '矢', rot: -0.06 },
    deathmark_volley: { title: 'DEATHMARK VOLLEY', sub: 'ONE LAST HEART-ARROW  ·  BOSS FINISHER', sfx: 'ズドォッ', kanji: '印', seal: '矢', rot: 0.07 },
  },
  notes: {
    dashshot: 'A backflip leaves ghost images and gust lines behind while a heavy gold arrow with feathers and a long trail flies forward and bursts on its target.',
    pierce: 'A thin precision lane with range ticks lights up ahead, then one bright green arrow runs the whole line and a lock-on reticle snaps onto the first enemy.',
    volley: 'Three arrows shoot into the sky, a rune circle marks the zone, and arrows rain in one by one, each standing in the ground with a small ring.',
    trap: 'An arrow drops in and pins the trap to the ground, then a ring of steel teeth opens and snaps shut with a gold flash and a puff of leaves.',
    storm_of_arrows: 'One gold arrow shoots straight up and bursts, a wide rune circle and a wind funnel open, and a dense rain of arrows covers the whole zone.',
    basic: 'Each shot leaves a short feathered arrow with a light trail; the third shot sends a gold fan of three arrows with a small wind arc.',
    arrowstorm: 'A giant arrow opens the sky, hawk wings spread over a double rune circle, four green light shafts rise, and two long waves of arrows rain down.',
    evasive_barrage: 'The backflip leaves gust lines and ghost images, and the volley lands at once as a thick, fast sheet of arrows with a green ring.',
    rapid_finale: 'Three arrows converge on the target, then one thick gold piercing arrow lands, a reticle locks on and the ground cracks.',
    hawkstorm: 'Eight green hawks stoop out of the sky from different sides onto the pack, each bursting on impact, with feathers drifting behind.',
    snare_web: 'Arrows pin a net of light to the ground, it pulls tight, and two nearby traps snap shut into the web.',
    deadeye: 'A big reticle slowly closes on the target while Quarry orbs collapse into the shot, then one thin white sniper arrow fires down a long lane.',
    storm_lance: 'A crackling cyan arrow flies into the target and splits into a ring of arrows that each fly outward with lightning.',
    ricochet: 'One gold arrow zig-zags from enemy to enemy in sharp angles with a flash at every bounce.',
    hunters_mark: 'Two hawks stoop, a trap clamps shut, a gold reticle locks, then three arrows in a fan land together with a big starburst.',
    skyline_scatter: 'A flip back, a bright line across the skyline, then three salvos of arrows fall in turn and explode, the last cracking the ground.',
    snarestorm_execution: 'A thorn cage, a net and a trap hold the boss, Quarry orbs are pulled into the bow, and one blazing gold beam-arrow runs through it.',
    tempest_barrage: 'A cyan tornado of arrows and a squall of rain build up, lightning strikes, then one huge thunder-arrow slams down with a triple ring.',
    deathmark_volley: 'A double Deathmark reticle spins on the target, three sniper arrows hit down one lane, then a last arrow drops straight from the sky onto it.',
    skyfall: 'Finisher: one arrow into the clouds, a huge rune circle, three layers of arrow rain and big gold arrows that crash down and explode.',
    heavens_arrow: 'Finisher: wings and a rune circle gather around the archer, a giant reticle locks on, then one enormous gold arrow and a pillar of light hit.',
  },
};
