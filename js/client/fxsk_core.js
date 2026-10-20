// Skill / chain effect library ("Star Ocean" flavoured): ~25 reusable world-space pieces + the Kit helper recipes are written with.
//
//   const k = makeKit(fx, ev, sim, pal);   // k.x/k.y caster, k.ang aim, k.tx/k.ty target point, k.pal palette
//   k.arc({ r: 150, sw: 4, ... });         // push a piece (every piece takes d: delay in seconds, life: seconds)
//
// Pieces are plain data pushed onto fx.cine ({ kind: 'sk' | 'skU', prim, ... }) and drawn each frame from that data (no hidden state), so they
// replay identically from a seed. Everything is drawn additively over the engine's own effects; the shader layer blooms it.
import { bloom, ease } from './fxglow.js';
import { vfxPref } from './fxns.js'; // Reduce screen flashes

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a, b) => a + Math.random() * (b - a);
const lite = (fx) => fx.partMul !== undefined && fx.partMul < 1;
export const seeded = (seed) => { let s = (Math.imul(seed | 0, 9301) + 49297) >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
export const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
const HEAD = "'Lilita One','Impact',sans-serif";

/** Pieces drawn UNDER the actors (flat ground art). */
const UNDER_PRIMS = new Set(['ring', 'sigil', 'web', 'hex', 'rift', 'crack']);

// ------------------------------------------------------------------ drawing helpers
function band(ctx, pts, w0, w1) { // a tapered ribbon along a polyline (width w0 at the start, w1 at the end)
  const n = pts.length; if (n < 2) return;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, w = lerp(w0, w1, i / (n - 1)) / 2;
    L.push([pts[i][0] - dy / d * w, pts[i][1] + dx / d * w]); R.push([pts[i][0] + dy / d * w, pts[i][1] - dx / d * w]);
  }
  ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]); for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]); ctx.closePath(); ctx.fill();
}
const glowBand = (ctx, pts, w, c, col, hi, a) => { // three stacked passes: wide colour, narrower highlight, white core
  ctx.globalAlpha = a * 0.4; ctx.fillStyle = col; band(ctx, pts, w * 0.2, w * 2.4);
  ctx.globalAlpha = a * 0.8; ctx.fillStyle = hi || col; band(ctx, pts, w * 0.1, w * 1.1);
  ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; band(ctx, pts, w * 0.05, w * 0.4);
};
function star4(ctx, x, y, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const an = rot + i * Math.PI / 4, rr = i % 2 ? r * 0.2 : r; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
  ctx.closePath(); ctx.fill();
}
function noteShape(ctx, x, y, s, rot) { // a vector eighth note (no font needed)
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.3, -0.4, 0, TAU); ctx.fill();
  ctx.fillRect(s * 0.3, -s * 1.15, s * 0.1, s * 1.15);
  ctx.beginPath(); ctx.moveTo(s * 0.4, -s * 1.15); ctx.quadraticCurveTo(s * 0.95, -s * 0.9, s * 0.7, -s * 0.4); ctx.quadraticCurveTo(s * 0.8, -s * 0.8, s * 0.4, -s * 0.85); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ the pieces: PRIMS[name](ctx, c, k, time, fx)   (k = progress 0..1 of this piece, c = its data)
export const PRIMS = {
  /** A crescent blade sweep around (x,y): a0 start angle, sw signed sweep, r radius, w thickness. */
  arc(ctx, c, k) {
    const head = c.a0 + c.sw * ease.out(clamp(k / 0.42)), tail = c.a0 + c.sw * ease.in(clamp((k - 0.1) / 0.9)), a = 1 - ease.in(clamp((k - 0.5) / 0.5)), pts = [];
    for (let i = 0; i <= 26; i++) { const an = lerp(tail, head, i / 26); pts.push([c.x + Math.cos(an) * c.r, c.y + Math.sin(an) * c.r * (c.sq || 1)]); }
    glowBand(ctx, pts, c.w, c, c.col, c.hi, a);
    const e = pts[pts.length - 1]; bloom(ctx, e[0], e[1], c.w * 3.2, c.hi || c.col, 0.8 * a);
  },
  /** A straight tapered blade of light from (x,y) along ang for len: thrusts, arrows, lances, slashes. */
  streak(ctx, c, k) {
    const head = ease.out(clamp(k / 0.3)), tail = ease.in(clamp((k - 0.12) / 0.88)), a = 1 - ease.in(clamp((k - 0.4) / 0.6)), ca = Math.cos(c.ang), sa = Math.sin(c.ang), pts = [];
    for (let i = 0; i <= 10; i++) { const u = lerp(tail, head, i / 10) * c.len; pts.push([c.x + ca * u + (c.bend ? -sa * Math.sin(i / 10 * Math.PI) * c.bend : 0), c.y + sa * u + (c.bend ? ca * Math.sin(i / 10 * Math.PI) * c.bend : 0)]); }
    glowBand(ctx, pts, c.w, c, c.col, c.hi, a);
    const e = pts[pts.length - 1]; bloom(ctx, e[0], e[1], c.w * 3, '#ffffff', 0.7 * a);
    if (c.ticks) { const R = seeded(c.seed); ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; for (let i = 0; i < c.ticks; i++) { const p = pts[(R() * pts.length) | 0], sd = R() < 0.5 ? -1 : 1, d0 = c.w * (0.8 + R()), d1 = d0 + c.w * (1 + R() * 2); ctx.globalAlpha = a * (0.4 + R() * 0.5); ctx.lineWidth = 1.2 + R() * 1.4; ctx.beginPath(); ctx.moveTo(p[0] - sa * sd * d0, p[1] + ca * sd * d0); ctx.lineTo(p[0] - sa * sd * d1 + ca * R() * 24, p[1] + ca * sd * d1 + sa * R() * 24); ctx.stroke(); } }
  },
  /** Flattened ground shock rings. */
  ring(ctx, c, k) {
    ctx.save(); ctx.translate(c.x, c.y + 14); ctx.scale(1, 0.62);
    for (let i = 0; i < (c.n || 2); i++) {
      const kk = clamp((k - i * 0.1) / 0.7); if (kk <= 0 || kk >= 1) continue;
      ctx.globalAlpha = (1 - kk) * (1 - i * 0.25); ctx.lineWidth = (c.w || 22) * (1 - kk) + 2; ctx.strokeStyle = i === 0 ? '#ffffff' : c.col; ctx.beginPath(); ctx.arc(0, 0, c.R * ease.out(kk) * (1 - i * 0.12), 0, TAU); ctx.stroke();
    }
    ctx.restore(); bloom(ctx, c.x, c.y + 14, c.R * 0.7 * (0.4 + 0.6 * ease.out(clamp(k / 0.5))), c.col, 0.7 * (1 - k));
  },
  /** A rotating rune circle on the ground: rings, ticks, glyph blocks and an {n/2} star. c.hold keeps it up until that progress. */
  sigil(ctx, c, k, time) {
    const inK = ease.out(clamp(k / 0.2)), outK = ease.in(clamp((1 - k) / 0.25)), a = inK * outK, R = c.R * (0.7 + 0.3 * inK) * (k > (c.hold || 0.8) ? 1 + (k - (c.hold || 0.8)) * 1.4 : 1), sp = (c.spin || 1) * time;
    if (a <= 0.01) return;
    ctx.save(); ctx.translate(c.x, c.y + 14); ctx.scale(1, 0.55); bloom(ctx, 0, 0, R * 1.2, c.col, 0.5 * a);
    const ring = (r, w, col, al) => { ctx.globalAlpha = a * al; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); };
    ring(R, 6, c.col, 0.55); ring(R, 2, '#fff', 0.9); ring(R * 0.82, 2.5, c.b || c.col, 0.7);
    ctx.save(); ctx.rotate(sp * 0.5);
    for (let i = 0; i < 30; i++) { const an = i / 30 * TAU; ctx.globalAlpha = a * (i % 3 ? 0.45 : 0.95); ctx.strokeStyle = i % 3 ? c.hi : '#fff'; ctx.lineWidth = i % 3 ? 2 : 3; ctx.beginPath(); ctx.moveTo(Math.cos(an) * R * 0.9, Math.sin(an) * R * 0.9); ctx.lineTo(Math.cos(an) * R * (i % 3 ? 0.95 : 0.99), Math.sin(an) * R * (i % 3 ? 0.95 : 0.99)); ctx.stroke(); }
    for (let i = 0; i < 10; i++) { const an = i / 10 * TAU, rr = R * 0.73; ctx.save(); ctx.translate(Math.cos(an) * rr, Math.sin(an) * rr); ctx.rotate(an + Math.PI / 2); ctx.globalAlpha = a * 0.85; ctx.fillStyle = i % 2 ? c.b || c.col : c.hi; const w = R * 0.04; ctx.fillRect(-w, -w * 1.4, w * 2, w * 2.8); ctx.restore(); }
    ctx.restore(); ctx.save(); ctx.rotate(-sp * 0.7);
    const n = c.n || 5, step = n % 2 ? (n - 1) / 2 : 2, rr = R * 0.6; ctx.globalAlpha = a * 0.9; ctx.strokeStyle = c.hi; ctx.lineWidth = 2.6; ctx.beginPath();
    for (let i = 0; i <= n; i++) { const an = i * step / n * TAU - Math.PI / 2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); } ctx.stroke();
    for (let i = 0; i < n; i++) { const an = i / n * TAU - Math.PI / 2; bloom(ctx, Math.cos(an) * rr, Math.sin(an) * rr, R * 0.1, c.hi, 0.8 * a); }
    ctx.restore(); ctx.restore();
  },
  /** Starburst: radial rays + a hot core. */
  burst(ctx, c, k) {
    const e = ease.out(clamp(k / 0.18)), a = Math.pow(1 - k, 1.5), R = seeded(c.seed);
    ctx.save(); ctx.translate(c.x, c.y);
    const g = ctx.createLinearGradient(0, 0, 1, 0); g.addColorStop(0, '#fff'); g.addColorStop(0.3, c.hi || c.col); g.addColorStop(1, 'rgba(0,0,0,0)'); // (one unit gradient per burst, scaled per ray: was a new gradient for every ray every frame)
    for (let i = 0; i < c.n; i++) {
      const an = (i / c.n) * TAU + (c.rot || 0) + (R() - 0.5) * 0.2, L = c.len * (0.55 + R() * 0.5) * e, w = (c.w || 0.05) * (0.6 + R() * 0.8), b = c.len * 0.06;
      if (L < 1) { R(); continue; }
      ctx.globalAlpha = a * (0.6 + R() * 0.4); ctx.fillStyle = g;
      ctx.save(); ctx.rotate(an); ctx.scale(L, L); // unit space: the ray runs 0..1 along +x
      const bx = b / L, by = Math.sin(w) * b / L; ctx.beginPath(); ctx.moveTo(Math.cos(w) * bx, -by); ctx.lineTo(1, 0); ctx.lineTo(Math.cos(w) * bx, by); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.globalAlpha = a; ctx.fillStyle = '#fff'; star4(ctx, 0, 0, c.len * 0.35 * e, c.rot || 0);
    ctx.restore(); bloom(ctx, c.x, c.y, c.len * 0.7, c.col, 0.8 * a); bloom(ctx, c.x, c.y, c.len * 0.25, '#fff', 0.9 * (1 - clamp(k / 0.4)), 1);
  },
  /** A column of light from the sky (or from the ground up) with a base ring. */
  pillar(ctx, c, k) {
    const grow = ease.out(clamp(k / 0.15)), a = ease.in(clamp((1 - k) / 0.4)) * grow, w = c.w * (1 + 0.2 * Math.sin(k * 40)) * (1 - 0.3 * clamp((k - 0.5) / 0.5)), top = c.y - c.h * (c.down ? 1 : grow);
    const g = ctx.createLinearGradient(0, top, 0, c.y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, c.col); g.addColorStop(1, c.hi || '#fff');
    ctx.globalAlpha = a * 0.55; ctx.fillStyle = g; ctx.fillRect(c.x - w * 1.6, top, w * 3.2, c.y - top);
    ctx.globalAlpha = a * 0.9; ctx.fillStyle = g; ctx.fillRect(c.x - w * 0.7, top, w * 1.4, c.y - top);
    ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.fillRect(c.x - w * 0.2, top, w * 0.4, c.y - top);
    bloom(ctx, c.x, c.y, w * 4, c.col, 0.8 * a); bloom(ctx, c.x, c.y, w * 1.6, '#fff', 0.7 * a, 1);
  },
  /** Forking lightning from (x,y) to (x2,y2), re-rolled every few frames so it crackles. */
  bolt(ctx, c, k) {
    const a = (1 - ease.in(clamp((k - 0.3) / 0.7))) * (0.55 + 0.45 * Math.sin(k * (c.life - c.d) * 90) ** 2), R = seeded(Math.floor(k * (c.life - c.d) * 22) * 131 + c.seed);
    const jag = (x0, y0, x1, y1, amp, d, out) => { if (!d) { out.push([x1, y1]); return; } const mx = (x0 + x1) / 2 + (R() - 0.5) * amp, my = (y0 + y1) / 2 + (R() - 0.5) * amp; jag(x0, y0, mx, my, amp / 2, d - 1, out); jag(mx, my, x1, y1, amp / 2, d - 1, out); };
    const len = Math.hypot(c.x2 - c.x, c.y2 - c.y), paths = [], main = [[c.x, c.y]]; jag(c.x, c.y, c.x2, c.y2, Math.max(30, len * 0.28), 5, main); paths.push(main);
    for (let f = 0; f < (c.forks ?? 3); f++) { const o = main[(main.length * (0.2 + R() * 0.6)) | 0], an = Math.atan2(c.y2 - c.y, c.x2 - c.x) + (R() - 0.5) * 2, L = len * (0.15 + R() * 0.25), br = [o]; jag(o[0], o[1], o[0] + Math.cos(an) * L, o[1] + Math.sin(an) * L, 40, 3, br); paths.push(br); }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [w, col, al] of [[(c.w || 5) * 3.2, c.col, 0.3], [(c.w || 5) * 1.3, c.hi || c.col, 0.7], [(c.w || 5) * 0.5, '#fff', 1]]) { ctx.lineWidth = w; ctx.strokeStyle = col; ctx.globalAlpha = a * al; for (const p of paths) { ctx.beginPath(); p.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q[0], q[1])); ctx.stroke(); } }
    bloom(ctx, c.x2, c.y2, (c.w || 5) * 9, '#fff', 0.7 * a);
  },
  /** Spires bursting from the ground. shape: crystal | ice | stone | flame | thorn. */
  spires(ctx, c, k) {
    const R = seeded(c.seed), list = [];
    for (let i = 0; i < c.n; i++) { const an = c.fan ? c.ang + (R() - 0.5) * c.fan : R() * TAU, rr = (c.R0 || 0) + c.R * (0.15 + R() * 0.85); list.push({ x: c.x + Math.cos(an) * rr, y: c.y + 18 + Math.sin(an) * rr * (c.fan ? 0.9 : 0.46), h: c.h * (0.5 + R() * 0.7), w: c.wd * (0.7 + R() * 0.7), d: R() * 0.22, lean: (R() - 0.5) * 0.5, ph: R() * TAU }); }
    list.sort((p, q) => p.y - q.y);
    for (const q of list) {
      const grow = ease.out(clamp((k - q.d) / 0.18)), out = 1 - ease.in(clamp((k - 0.62) / 0.38)), a = out * clamp((k - q.d) / 0.05); if (grow <= 0 || a <= 0.01) continue;
      const h = q.h * grow, tx = q.x + q.lean * h, ty = q.y - h;
      ctx.globalCompositeOperation = 'source-over';
      if (c.shape === 'flame') { // a licking tongue of fire
        ctx.globalCompositeOperation = 'lighter'; const fl = Math.sin(k * 30 + q.ph) * q.w * 0.5;
        for (const [sc, col, al] of [[1, c.col, 0.5], [0.62, c.hi || c.col, 0.8], [0.3, '#fff', 0.95]]) { ctx.globalAlpha = a * al; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(q.x - q.w * sc, q.y); ctx.quadraticCurveTo(q.x - q.w * sc * 0.6 + fl, q.y - h * 0.6, tx + fl * 1.4, ty); ctx.quadraticCurveTo(q.x + q.w * sc * 0.6 + fl, q.y - h * 0.5, q.x + q.w * sc, q.y); ctx.closePath(); ctx.fill(); }
      } else if (c.shape === 'thorn') { // a curved briar
        ctx.globalAlpha = a * 0.9; ctx.fillStyle = c.col; ctx.beginPath(); ctx.moveTo(q.x - q.w, q.y); ctx.quadraticCurveTo(q.x - q.w * 0.4, q.y - h * 0.7, tx + q.lean * 90, ty); ctx.quadraticCurveTo(q.x + q.w * 0.2, q.y - h * 0.5, q.x + q.w, q.y); ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.7; ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
      } else if (c.shape === 'stone') { // a blocky slab
        ctx.globalAlpha = a; ctx.fillStyle = c.deep || '#3a2a20'; ctx.beginPath(); ctx.moveTo(q.x - q.w, q.y); ctx.lineTo(q.x - q.w * 0.7, ty + h * 0.1); ctx.lineTo(tx - q.w * 0.2, ty); ctx.lineTo(tx + q.w * 0.5, ty + h * 0.08); ctx.lineTo(q.x + q.w, q.y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c.col; ctx.globalAlpha = a * 0.5; ctx.beginPath(); ctx.moveTo(q.x - q.w, q.y); ctx.lineTo(q.x - q.w * 0.7, ty + h * 0.1); ctx.lineTo(tx - q.w * 0.2, ty); ctx.lineTo(q.x, q.y); ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.8; ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
      } else { // crystal / ice: translucent faceted spire
        const gl = ctx.createLinearGradient(q.x, q.y, tx, ty); gl.addColorStop(0, c.col); gl.addColorStop(0.55, c.hi || '#fff'); gl.addColorStop(1, '#fff');
        ctx.fillStyle = gl; ctx.globalAlpha = a * 0.78; ctx.beginPath(); ctx.moveTo(q.x - q.w, q.y); ctx.lineTo(tx, ty); ctx.lineTo(q.x, q.y + q.w * 0.35); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c.deep || '#10202a'; ctx.globalAlpha = a * 0.5; ctx.beginPath(); ctx.moveTo(q.x, q.y + q.w * 0.35); ctx.lineTo(tx, ty); ctx.lineTo(q.x + q.w, q.y); ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(q.x - q.w, q.y); ctx.lineTo(tx, ty); ctx.lineTo(q.x + q.w, q.y); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter'; bloom(ctx, tx, ty + h * 0.1, 26 + q.w, c.hi || c.col, 0.5 * a); bloom(ctx, q.x, q.y, q.w * 3, c.col, 0.45 * a);
    }
  },
  /** A flock of small particles: pix | spark | petal | feather | note | snow | ember | star | leaf | shuriken | page | rune. */
  motes(ctx, c, k) {
    const R = seeded(c.seed), L0 = c.life - c.d, t = k * L0, life = c.pl || L0 * 0.8;
    for (let i = 0; i < c.n; i++) {
      const an = c.ang + (R() - 0.5) * (c.spread ?? TAU), v = c.spd * (0.25 + R() * 0.75), d = R() * (c.stagger ?? 0.25) * L0, u = (t - d) / life, sz = (c.size || 6) * (0.6 + R() * 0.8), ph = R() * TAU, rr = R() * (c.R0 || 0);
      if (u <= 0 || u >= 1) continue;
      const vx = Math.cos(an) * v, vy = Math.sin(an) * v, tt = u * life;
      let x = c.x + Math.cos(an) * rr + vx * tt * (1 - 0.35 * u) + (c.sway ? Math.sin(tt * 4 + ph) * c.sway : 0), y = c.y + Math.sin(an) * rr * 0.6 + vy * tt * (1 - 0.35 * u) + 0.5 * (c.g || 0) * tt * tt;
      const fade = Math.min(1, (1 - u) * 1.8) * Math.min(1, u * 8), col = R() < (c.mix ?? 0.3) ? (c.col2 || '#fff') : c.col; ctx.globalAlpha = fade; ctx.fillStyle = col; ctx.strokeStyle = col;
      switch (c.type) {
        case 'spark': { const sp = Math.hypot(vx, vy + (c.g || 0) * tt) || 1; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.strokeStyle = u < 0.3 ? '#fff' : col; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - vx / sp * sz * 2.4, y - (vy + (c.g || 0) * tt) / sp * sz * 2.4); ctx.stroke(); break; }
        case 'petal': { ctx.save(); ctx.translate(x, y); ctx.rotate(ph + tt * 3); ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.9, sz * 0.45, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = fade * 0.7; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-sz * 0.2, 0, sz * 0.4, sz * 0.15, 0, 0, TAU); ctx.fill(); ctx.restore(); break; }
        case 'feather': { ctx.save(); ctx.translate(x, y); ctx.rotate(ph + Math.sin(tt * 5 + ph) * 0.6); ctx.beginPath(); ctx.ellipse(0, 0, sz * 1.5, sz * 0.4, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-sz * 1.5, 0); ctx.lineTo(sz * 1.5, 0); ctx.stroke(); ctx.restore(); break; }
        case 'note': { noteShape(ctx, x, y, sz * 1.6, Math.sin(tt * 3 + ph) * 0.4); bloom(ctx, x, y, sz * 2.4, col, 0.3 * fade); break; }
        case 'snow': { bloom(ctx, x, y, sz * 1.6, col, 0.5 * fade); ctx.fillStyle = '#fff'; ctx.fillRect(x - 1.2, y - sz * 0.6, 2.4, sz * 1.2); ctx.fillRect(x - sz * 0.6, y - 1.2, sz * 1.2, 2.4); break; }
        case 'ember': { const f = 0.6 + 0.4 * Math.sin(tt * 18 + ph); bloom(ctx, x, y, sz * 2.2, col, 0.6 * f * fade); ctx.fillStyle = '#fff'; ctx.fillRect(x - sz * 0.25, y - sz * 0.25, sz * 0.5, sz * 0.5); break; }
        case 'star': { star4(ctx, x, y, sz * (0.5 + 0.5 * Math.sin(Math.PI * u)) * 1.6, tt); bloom(ctx, x, y, sz * 2, col, 0.4 * fade); break; }
        case 'leaf': { ctx.save(); ctx.translate(x, y); ctx.rotate(ph + tt * 4); ctx.beginPath(); ctx.moveTo(-sz, 0); ctx.quadraticCurveTo(0, -sz * 0.7, sz, 0); ctx.quadraticCurveTo(0, sz * 0.7, -sz, 0); ctx.fill(); ctx.restore(); break; }
        case 'shuriken': { ctx.save(); ctx.translate(x, y); ctx.rotate(tt * 18 + ph); ctx.fillStyle = '#e8e8f4'; star4(ctx, 0, 0, sz * 1.3); ctx.restore(); bloom(ctx, x, y, sz * 2, col, 0.4 * fade); break; }
        case 'page': { ctx.save(); ctx.translate(x, y); ctx.rotate(ph + tt * 3); ctx.scale(Math.cos(tt * 5 + ph), 1); ctx.fillStyle = '#f4ead2'; ctx.globalAlpha = fade * 0.9; ctx.fillRect(-sz * 0.7, -sz, sz * 1.4, sz * 2); ctx.fillStyle = col; ctx.globalAlpha = fade * 0.7; for (let l = 0; l < 3; l++) ctx.fillRect(-sz * 0.5, -sz * 0.6 + l * sz * 0.5, sz, 1.6); ctx.restore(); break; }
        case 'rune': { ctx.save(); ctx.translate(x, y); ctx.rotate(ph); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(0, sz); ctx.moveTo(-sz * 0.6, -sz * 0.3); ctx.lineTo(sz * 0.6, sz * 0.4); ctx.moveTo(sz * 0.6, -sz * 0.3); ctx.lineTo(-sz * 0.2, sz * 0.2); ctx.stroke(); ctx.restore(); bloom(ctx, x, y, sz * 2, col, 0.3 * fade); break; }
        default: { const s2 = Math.max(2, Math.round(sz * (1 - u * 0.5) / 2) * 2); bloom(ctx, x, y, s2 * 3, col, 0.35 * fade); ctx.fillStyle = u < 0.25 ? '#fff' : col; ctx.fillRect(Math.round(x / 3) * 3 - s2 / 2, Math.round(y / 3) * 3 - s2 / 2, s2, s2); }
      }
    }
  },
  /** n orbs circling (x,y) that, from `launch` progress on, fly to (x2,y2). */
  orbit(ctx, c, k, time) {
    const R = seeded(c.seed), a = ease.out(clamp(k / 0.12)) * (1 - ease.in(clamp((k - 0.9) / 0.1)));
    for (let i = 0; i < c.n; i++) {
      const an0 = i / c.n * TAU + time * (c.speed || 4) * (i % 2 ? 1 : 0.8), rr = c.R * (0.8 + R() * 0.4), lk = clamp((k - (c.launch ?? 0.5) - i * 0.03) / 0.22);
      const ox = c.x + Math.cos(an0) * rr, oy = c.y + Math.sin(an0) * rr * 0.6 - 30 * ease.out(clamp(k / 0.2));
      const x = lerp(ox, c.x2 ?? ox, ease.in(lk)), y = lerp(oy, c.y2 ?? oy, ease.in(lk)), sz = (c.size || 9) * (1 - 0.4 * lk);
      if (lk > 0.001 && lk < 1) { ctx.strokeStyle = c.col; ctx.globalAlpha = a * 0.6; ctx.lineWidth = sz * 0.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lerp(ox, x, 0.3), lerp(oy, y, 0.3)); ctx.stroke(); }
      if (lk >= 1) continue;
      ctx.globalAlpha = a; bloom(ctx, x, y, sz * 3, c.col, 0.7); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, sz * 0.5, 0, TAU); ctx.fill(); ctx.fillStyle = c.hi || c.col; ctx.globalAlpha = a * 0.8; ctx.beginPath(); ctx.arc(x, y, sz * 0.9, 0, TAU); ctx.fill();
    }
  },
  /** A falling streak (meteor / arrow / star) that lands on (x,y) with a flash. */
  comet(ctx, c, k) {
    const hit = c.hit ?? 0.55, fall = clamp(k / hit), dx = Math.cos(c.from), dy = Math.sin(c.from), pos = 1 - ease.in(fall) * 1, hx = c.x + dx * c.len * pos, hy = c.y + dy * c.len * pos;
    if (k < hit) {
      const tl = Math.min(c.len * 0.5, c.len * (1 - pos) + 40);
      const tail = []; for (let i = 0; i <= 8; i++) tail.push([hx + dx * tl * (1 - i / 8), hy + dy * tl * (1 - i / 8)]);
      glowBand(ctx, tail.reverse(), c.size, c, c.col, c.hi, 0.9); bloom(ctx, hx, hy, c.size * 3.4, c.hi || c.col, 0.9); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, c.size * 0.55, 0, TAU); ctx.fill();
    } else {
      const u = clamp((k - hit) / (1 - hit)), a = 1 - u; bloom(ctx, c.x, c.y, (c.impact || 80) * (0.6 + 0.8 * ease.out(u)), c.col, 0.9 * a); bloom(ctx, c.x, c.y, (c.impact || 80) * 0.4, '#fff', 0.9 * (1 - ease.out(u)), 1);
      ctx.save(); ctx.translate(c.x, c.y + 8); ctx.scale(1, 0.6); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5 * a + 1; ctx.beginPath(); ctx.arc(0, 0, (c.impact || 80) * ease.out(u), 0, TAU); ctx.stroke(); ctx.restore();
    }
  },
  /** A tornado / cyclone: spiral arms of light rising around (x,y). */
  swirl(ctx, c, k, time) {
    const a = ease.out(clamp(k / 0.15)) * ease.in(clamp((1 - k) / 0.3));
    for (let arm = 0; arm < c.arms; arm++) {
      const pts = []; for (let i = 0; i <= 22; i++) { const u = i / 22, an = (arm / c.arms) * TAU + time * (c.spin || 8) * (c.dir || 1) + u * 5.5, rr = c.R * (0.25 + 0.75 * Math.pow(u, 0.8)) * (c.cone ? 1 : 1 - 0.25 * Math.sin(u * Math.PI)); pts.push([c.x + Math.cos(an) * rr, c.y - u * c.h + Math.sin(an) * rr * 0.4]); }
      glowBand(ctx, pts, c.w || 10, c, c.col, c.hi, a * 0.9);
    }
    bloom(ctx, c.x, c.y - c.h * 0.4, c.R * 1.3, c.col, 0.25 * a); ctx.save(); ctx.translate(c.x, c.y + 10); ctx.scale(1, 0.4); ctx.globalAlpha = a * 0.5; ctx.strokeStyle = c.hi || c.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, c.R * 0.9, 0, TAU); ctx.stroke(); ctx.restore();
  },
  /** A thick beam from (x,y) to (x2,y2) that extends, holds and thins out. */
  beam(ctx, c, k) {
    const ext = ease.out(clamp(k / 0.18)), a = ease.in(clamp((1 - k) / 0.35)), x2 = lerp(c.x, c.x2, ext), y2 = lerp(c.y, c.y2, ext), w = c.w * (0.6 + 0.4 * Math.sin(k * 50)) * a;
    ctx.lineCap = 'round'; for (const [m, col, al] of [[3, c.col, 0.35], [1.6, c.hi || c.col, 0.7], [0.55, '#fff', 1]]) { ctx.strokeStyle = col; ctx.globalAlpha = a * al; ctx.lineWidth = w * m; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(x2, y2); ctx.stroke(); }
    bloom(ctx, x2, y2, w * 3.4, c.col, 0.8 * a); bloom(ctx, c.x, c.y, w * 2.4, c.hi || c.col, 0.6 * a);
  },
  /** A tear in the world: dark void with a bright rim and radial cracks (Shadow, Void). */
  rift(ctx, c, k) {
    const open = ease.out(clamp(k / 0.18)) * (1 - ease.in(clamp((k - 0.7) / 0.3))), R = c.R * open; if (R < 2) return;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.ang || 0); ctx.scale(1, 0.34 + 0.5 * (c.tall ?? 0));
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.92 * open; const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, '#000'); g.addColorStop(0.7, c.deep || '#12021a'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = c.col; ctx.lineWidth = 5; ctx.globalAlpha = 0.8 * open; ctx.beginPath(); ctx.arc(0, 0, R * 0.92, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
    const Rr = seeded(c.seed); for (let i = 0; i < 9; i++) { const an = Rr() * TAU, L = R * (0.9 + Rr() * 0.5); ctx.globalAlpha = 0.7 * open; ctx.strokeStyle = c.hi || c.col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(Math.cos(an) * R * 0.9, Math.sin(an) * R * 0.9); ctx.lineTo(Math.cos(an + 0.1) * L * 1.1, Math.sin(an + 0.1) * L * 1.1); ctx.stroke(); }
    for (let i = 0; i < 14; i++) { const an = Rr() * TAU, rr = Rr() * R * 0.7; ctx.globalAlpha = 0.7 * open * (0.5 + 0.5 * Math.sin(k * 30 + i)); ctx.fillStyle = '#fff'; ctx.fillRect(Math.cos(an) * rr, Math.sin(an) * rr, 2, 2); }
    ctx.restore();
  },
  /** A spider web: radial strands + ringed polygons, drawn inward. */
  web(ctx, c, k) {
    const inK = ease.out(clamp(k / 0.25)), a = ease.in(clamp((1 - k) / 0.3)), n = c.n || 8;
    ctx.save(); ctx.translate(c.x, c.y + 10); ctx.scale(1, 0.6); ctx.strokeStyle = c.col; ctx.lineWidth = 2.2; ctx.globalAlpha = a * 0.9;
    for (let i = 0; i < n; i++) { const an = i / n * TAU + (c.rot || 0); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * c.R * inK, Math.sin(an) * c.R * inK); ctx.stroke(); }
    for (let r = 1; r <= 4; r++) { const rr = c.R * r / 4 * inK; ctx.beginPath(); for (let i = 0; i <= n; i++) { const an = i / n * TAU + (c.rot || 0), sag = 0.9 + 0.1 * Math.cos(i * 2.1); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr * (i % 1 ? 1 : sag), Math.sin(an) * rr * sag); } ctx.stroke(); }
    ctx.restore(); bloom(ctx, c.x, c.y + 10, c.R * 0.8, c.col, 0.35 * a);
  },
  /** An expanding band of arcs in front of the caster (cones, sound, shockwaves). */
  wave(ctx, c, k) {
    const a = ease.in(clamp((1 - k) / 0.5)); ctx.lineCap = 'round';
    for (let i = 0; i < (c.n || 3); i++) {
      const kk = clamp((k - i * 0.1) / 0.8); if (kk <= 0 || kk >= 1) continue;
      const r = c.r * ease.out(kk), arc = c.arc * (0.55 + 0.45 * kk); ctx.globalAlpha = a * (1 - kk) * 0.95; ctx.strokeStyle = i ? c.col : c.hi || '#fff'; ctx.lineWidth = (c.w || 14) * (1 - kk * 0.6);
      ctx.beginPath(); ctx.arc(c.x, c.y, r, c.ang - arc / 2, c.ang + arc / 2); ctx.stroke();
    }
  },
  /** Afterimage silhouettes along a path (dashes, blinks, shadow steps). */
  ghost(ctx, c, k) {
    const n = c.n || 6;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), life = 1 - ease.in(clamp((k - 0.15 - u * 0.3) / 0.5)); if (life <= 0.01) continue;
      const x = lerp(c.x, c.x2, u), y = lerp(c.y, c.y2, u), ang = Math.atan2(c.y2 - c.y, c.x2 - c.x);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = life * 0.55; ctx.fillStyle = c.col; ctx.beginPath(); ctx.ellipse(0, -8, c.size * 1.5, c.size * 0.8, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(c.size * 0.9, -c.size * 1.3, c.size * 0.55, 0, TAU); ctx.fill();
      ctx.globalAlpha = life; ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, -8, c.size * 1.5, c.size * 0.8, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
    const pts = [[c.x, c.y], [lerp(c.x, c.x2, 0.5), lerp(c.y, c.y2, 0.5)], [c.x2, c.y2]]; glowBand(ctx, pts, c.size * 0.8, c, c.col, c.hi, 1 - ease.in(clamp((k - 0.3) / 0.7)));
  },
  /** A radial pop of light. */
  flash(ctx, c, k) { const a = Math.pow(1 - k, 1.6) * (vfxPref.reduceFlash ? 0.5 : 1); bloom(ctx, c.x, c.y, c.R * (0.5 + 0.7 * ease.out(k)), c.col, 0.9 * a); bloom(ctx, c.x, c.y, c.R * 0.35, '#fff', 0.95 * (1 - ease.out(clamp(k / 0.5))), 1); },
  /** A sinuous ribbon with a head (dragons, wyrms, krakens, whips, hawks' flight lines). */
  serpent(ctx, c, k, time) {
    const hd = ease.out(clamp(k / 0.5)), a = ease.in(clamp((1 - k) / 0.3)), ca = Math.cos(c.ang), sa = Math.sin(c.ang), pts = [], N = 26;
    for (let i = 0; i <= N; i++) { const u = i / N, along = (hd - (1 - u) * (c.body || 0.45)) * c.len; if (along < 0) continue; const env = Math.sin(clamp(along / c.len) * Math.PI) ** 0.6, off = Math.sin(along * (c.freq || 0.02) - time * (c.speed || 9)) * c.amp * env; pts.push([c.x + ca * along - sa * off, c.y + sa * along + ca * off]); }
    if (pts.length < 2) return; glowBand(ctx, pts, c.w, c, c.col, c.hi, a);
    const h = pts[pts.length - 1], p2 = pts[pts.length - 2], an = Math.atan2(h[1] - p2[1], h[0] - p2[0]); ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(an); ctx.globalAlpha = a; ctx.fillStyle = c.hi || '#fff'; ctx.beginPath(); ctx.moveTo(c.w * 1.1, 0); ctx.lineTo(-c.w * 0.6, c.w * 0.9); ctx.lineTo(-c.w * 0.2, 0); ctx.lineTo(-c.w * 0.6, -c.w * 0.9); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c.w * 0.1, -c.w * 0.3, c.w * 0.18, 0, TAU); ctx.fill(); ctx.restore(); bloom(ctx, h[0], h[1], c.w * 3, c.col, 0.8 * a);
  },
  /** A hexagonal energy barrier (shields, wards). */
  hex(ctx, c, k, time) {
    const a = ease.out(clamp(k / 0.15)) * ease.in(clamp((1 - k) / 0.3)); ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.62); ctx.rotate(time * 0.3);
    for (let r = 0; r < 3; r++) { const rr = c.R * (0.55 + r * 0.22); ctx.globalAlpha = a * (0.9 - r * 0.2); ctx.strokeStyle = r % 2 ? c.hi : c.col; ctx.lineWidth = 3 - r * 0.6; ctx.beginPath(); for (let i = 0; i <= 6; i++) { const an = i / 6 * TAU; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); } ctx.stroke(); }
    ctx.globalAlpha = a * 0.18; ctx.fillStyle = c.col; ctx.beginPath(); for (let i = 0; i <= 6; i++) { const an = i / 6 * TAU; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * c.R, Math.sin(an) * c.R); } ctx.fill(); ctx.restore();
  },
  /** Angel wings of light behind (x,y). */
  wings(ctx, c, k) {
    const sp = ease.out(clamp(k / 0.25)), a = ease.in(clamp((1 - k) / 0.4));
    for (const s of [-1, 1]) for (let i = 0; i < 7; i++) {
      const an = -Math.PI / 2 + s * (0.35 + i * 0.2) * sp, L = c.span * (1 - i * 0.07), w = c.span * 0.07;
      const x1 = c.x + Math.cos(an) * L, y1 = c.y + Math.sin(an) * L * 0.9 - 40;
      ctx.globalAlpha = a * (0.85 - i * 0.07); const g = ctx.createLinearGradient(c.x, c.y - 40, x1, y1); g.addColorStop(0, '#fff'); g.addColorStop(0.5, c.hi || c.col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(c.x + s * 8, c.y - 40); ctx.quadraticCurveTo(c.x + Math.cos(an - s * 0.25) * L * 0.6, c.y - 40 + Math.sin(an - s * 0.25) * L * 0.5, x1, y1); ctx.quadraticCurveTo(c.x + Math.cos(an + s * 0.2) * L * 0.55, c.y - 40 + Math.sin(an + s * 0.2) * L * 0.55, c.x + s * 8, c.y - 40 + w); ctx.fill();
    }
    bloom(ctx, c.x, c.y - 40, c.span * 0.6, c.col, 0.4 * a);
  },
  /** A music staff sweeping out from (x,y) along ang with notes riding it (Bard). */
  staff(ctx, c, k) {
    const hd = ease.out(clamp(k / 0.45)), a = ease.in(clamp((1 - k) / 0.35)), ca = Math.cos(c.ang), sa = Math.sin(c.ang), R = seeded(c.seed);
    for (let l = 0; l < 5; l++) { const off = (l - 2) * (c.gap || 9), pts = []; for (let i = 0; i <= 18; i++) { const u = i / 18 * hd, along = u * c.len, w = Math.sin(along * 0.025 - k * 12) * (c.amp || 10) * Math.min(1, u * 4) + off; pts.push([c.x + ca * along - sa * w, c.y + sa * along + ca * w]); } ctx.globalAlpha = a * 0.9; ctx.strokeStyle = l % 2 ? c.hi || c.col : c.col; ctx.lineWidth = 2.4; ctx.beginPath(); pts.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q[0], q[1])); ctx.stroke(); }
    for (let i = 0; i < (c.notes || 6); i++) { const u = (i + 1) / ((c.notes || 6) + 1) * hd, along = u * c.len, w = Math.sin(along * 0.025 - k * 12) * (c.amp || 10) * Math.min(1, u * 4) + (Math.floor(R() * 5) - 2) * (c.gap || 9); ctx.globalAlpha = a; ctx.fillStyle = i % 2 ? '#fff' : c.hi || c.col; noteShape(ctx, c.x + ca * along - sa * w, c.y + sa * along + ca * w, 15, 0); }
  },
  /** Chain trace: the positions of the chain's steps linked by a glowing line, numbered, then collapsing to the finale. */
  trace(ctx, c, k) {
    const a = ease.in(clamp((1 - k) / 0.4)), draw = ease.out(clamp(k / 0.5)), pts = c.pts, n = pts.length; if (n < 2) return;
    const end = pts[n - 1], col = c.col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, cc, al] of [[8, col, 0.3], [3.5, c.hi || col, 0.8], [1.4, '#fff', 1]]) { ctx.lineWidth = w; ctx.strokeStyle = cc; ctx.globalAlpha = a * al; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); const upto = draw * (n - 1); for (let i = 1; i < n; i++) { const f = clamp(upto - (i - 1)); if (f <= 0) break; const p = pts[i - 1], q = pts[i]; ctx.lineTo(lerp(p.x, q.x, f), lerp(p.y, q.y, f)); } ctx.stroke(); }
    ctx.font = `15px ${HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    pts.forEach((p, i) => { const f = clamp(draw * (n - 1) - (i - 1) + 0.001); if (i > 0 && f <= 0) return; const pop = 1 + 0.5 * Math.max(0, 1 - Math.abs(k * 6 - i)); ctx.globalAlpha = a; bloom(ctx, p.x, p.y, 26 * pop, col, 0.7); ctx.fillStyle = '#10121a'; ctx.beginPath(); ctx.arc(p.x, p.y, 11 * pop, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillText(p.key || String(i + 1), p.x, p.y + 1); });
    bloom(ctx, end.x, end.y, 60 * (1 + 1.5 * (1 - a)), col, 0.5 * a);
  },
  /** A ground crack with glowing seams. */
  crack(ctx, c, k) {
    const R = seeded(c.seed), a = ease.in(clamp((1 - k) / 0.45)), e = ease.out(clamp(k / 0.2));
    ctx.save(); ctx.translate(c.x, c.y + 12); ctx.scale(1, 0.62); ctx.lineCap = 'round';
    for (let i = 0; i < c.n; i++) { const an = i / c.n * TAU + R() * 0.4, pts = [[0, 0]]; let x = 0, y = 0, aa = an; const L = c.R * (0.6 + R() * 0.5) * e; for (let s = 1; s <= 6; s++) { aa += (R() - 0.5) * 0.9; x += Math.cos(aa) * L / 6; y += Math.sin(aa) * L / 6; pts.push([x, y]); }
      for (const [w, col, al] of [[8, c.col, 0.35], [3, c.hi || c.col, 0.9]]) { ctx.strokeStyle = col; ctx.lineWidth = w * (1 - k * 0.4); ctx.globalAlpha = a * al; ctx.beginPath(); pts.forEach((q, j) => ctx[j ? 'lineTo' : 'moveTo'](q[0], q[1])); ctx.stroke(); } }
    ctx.restore(); bloom(ctx, c.x, c.y + 12, c.R * 0.5, c.col, 0.4 * a);
  },
};
export const PRIM_NAMES = Object.keys(PRIMS);
/** Register extra pieces (class modules export `prims: { cls_name(ctx, c, k, time, fx) {...} }`; prefix names with the class to avoid clashes). */
export function registerPrims(map, under = []) { for (const n of Object.keys(map || {})) { if (PRIMS[n]) { console.warn('skfx: piece name clash', n); continue; } PRIMS[n] = map[n]; if (under.includes(n)) UNDER_PRIMS.add(n); } }

// ------------------------------------------------------------------ CINE entries
const DEFAULT_LIFE = { arc: 0.5, streak: 0.5, ring: 0.9, sigil: 1.4, burst: 0.7, pillar: 0.8, bolt: 0.5, spires: 1.1, motes: 1.2, orbit: 1.1, comet: 0.8, swirl: 1.2, beam: 0.7, rift: 1.1, web: 1.1, wave: 0.8, ghost: 0.6, flash: 0.45, serpent: 1.0, hex: 1.2, wings: 1.0, staff: 1.0, trace: 1.3, crack: 1.4 };
// (skill fx clarity + perf pass, 2026-10-18: pieces are culled off-screen, capped by a budget that scales with the quality level, and other
//  players' casts are thinned so your own skills read clearly in a crowded co-op fight)
const EXT_KEYS = ['R', 'r', 'len', 'h', 'span', 'impact', 'w'];
/** Rough world-space extent of a piece (px): the biggest of its size fields, so culling never clips a visible piece. */
export function pieceExtent(c) { let e = 120; for (const k of EXT_KEYS) { const v = c[k]; if (v > 0 && v < 4000) e = Math.max(e, k === 'w' ? v * 3 : v); } return e * (c.prim === 'comet' || c.prim === 'beam' || c.prim === 'bolt' ? 1.5 : 1.15) + 60; }
/** True when a piece can touch the view rect (a bolt / beam / ghost also counts its far end). */
export function pieceVisible(c, V) {
  if (!V) return true;
  const e = pieceExtent(c);
  const hit = (x, y) => x + e > V.x0 && x - e < V.x1 && y + e > V.y0 && y - e < V.y1;
  return hit(c.x, c.y) || (c.x2 != null && hit(c.x2, c.y2));
}
/** Other players' casts are drawn at this fraction of full strength: additive whites stack, and in a crowded fight your own cast has to stay the brightest thing on screen. */
export const OTHERS_DIM = 0.55;
const DIMS = new WeakMap();
/** A forwarding view of a 2D context whose globalAlpha is scaled by `s` (pieces set alpha absolutely, so this is the one place to dim any of them). One view per context; `s` is set on every fetch. */
export function dimCtx(ctx, s = OTHERS_DIM) {
  let st = DIMS.get(ctx); if (st) { st.s = s; return st.p; }
  const fns = new Map(); st = { s, p: null };
  st.p = new Proxy(ctx, {
    get(t, k) { if (k === 'globalAlpha') return t.globalAlpha / st.s; const v = t[k]; if (typeof v !== 'function') return v; let f = fns.get(k); if (!f) fns.set(k, f = v.bind(t)); return f; },
    set(t, k, v) { t[k] = k === 'globalAlpha' ? v * st.s : v; return true; },
  });
  DIMS.set(ctx, st); return st.p;
}
function drawSk(fx, ctx, c, time) {
  if (c.t < c.d) return;
  if (c.prim !== 'trace' && !pieceVisible(c, fx.view)) return;
  const k = clamp((c.t - c.d) / (c.life - c.d)), f = PRIMS[c.prim]; if (!f) return;
  const sv = vfxPref.skill, theirs = c.pid != null && fx.localPid != null && c.pid !== fx.localPid && c.prim !== 'trace', sc = sv * (theirs ? OTHERS_DIM : 1); // (the chain trace is never dimmed for others: it shows the combo you are watching)
  const g = sc < 0.999 ? dimCtx(ctx, Math.max(0.02, sc)) : ctx;
  ctx.save(); ctx.globalCompositeOperation = c.src ? 'source-over' : 'lighter'; g.globalAlpha = 1; f(g, c, k, time, fx); ctx.restore();
}
export const SK_CINE = { sk: drawSk };
export const SK_UNDER = { skU: drawSk };

/** Decorative pieces: the first to go when the budget is spent. The shape-defining ones (arcs, streaks, rings, sigils, beams, traces) are never dropped for your own casts. */
const DECOR = new Set(['motes', 'flash', 'burst', 'orbit', 'ghost', 'crack', 'web']);
export const SK_BUDGET = 90;
/** How many skill pieces may be alive at once at the current quality level (partMul 1 -> 90 ... 0.2 -> 18). */
export const skBudget = (fx) => Math.max(18, Math.round(SK_BUDGET * (fx.partMul !== undefined ? fx.partMul : 1) * (0.3 + 0.7 * vfxPref.skill))); // (the Options slider thins the crowd too)
function skCounts(fx) { let mine = 0, other = 0; for (const c of fx.cine) { if (c.kind !== 'sk' && c.kind !== 'skU') continue; if (c.pid == null || c.pid === fx.localPid) mine++; else other++; } return { mine, other }; }

/** Push one piece. Delay d, life default per piece; `under` forces the ground layer. Returns the piece. */
export function addPiece(fx, prim, o = {}) {
  if (!PRIMS[prim] || vfxPref.skill <= 0) return null; // (Options > Skill effects at 0 = off)
  if (lite(fx)) { if (o.opt) return null; if (prim === 'motes') o = { ...o, n: Math.ceil((o.n || 8) * 0.5) }; }
  const theirs = o.pid != null && fx.localPid != null && o.pid !== fx.localPid;
  if (theirs) { // someone else's cast: shape pieces stay (you still see what is coming) but the decoration is halved, big pops shrink
    if (o.opt) return null;
    if (prim === 'motes') o = { ...o, n: Math.ceil((o.n || 8) * 0.5) };
    else if (prim === 'flash' || prim === 'burst') o = { ...o, ...(o.R ? { R: o.R * 0.7 } : {}), ...(o.len ? { len: o.len * 0.75 } : {}) };
  }
  const cap = skBudget(fx), cnt = skCounts(fx);
  if (theirs ? cnt.other >= Math.round(cap * 0.4) && (DECOR.has(prim) || cnt.other >= cap * 0.6) : cnt.mine >= cap && (DECOR.has(prim) || cnt.mine >= cap * 2)) return null;
  const d = o.d || 0, life = (o.life ?? DEFAULT_LIFE[prim] ?? 0.8) + d;
  const c = { kind: UNDER_PRIMS.has(prim) || o.under ? 'skU' : 'sk', prim, t: 0, d, life, seed: o.seed ?? ((Math.random() * 1e9) | 0), ...o };
  if (o.under === false) c.kind = 'sk';
  fx.cine.push(c); return c;
}

// ------------------------------------------------------------------ the Kit
/** Find the thing the caster is aiming at: the enemy nearest the aim ray within `reach`, else a point along the aim. */
export function targetOf(sim, x, y, ang, reach = 640) {
  let best = null, bd = 1e9;
  const list = sim && sim.enemies ? sim.enemies : [];
  for (const e of list) {
    if (e.dead) continue; const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy); if (d > reach + (e.r || 0)) continue;
    let da = Math.abs(((Math.atan2(dy, dx) - ang + Math.PI * 3) % TAU) - Math.PI); if (da > 0.9 && d > 120) continue;
    const score = d + da * 220 - (e.boss ? 160 : 0); if (score < bd) { bd = score; best = e; }
  }
  return best ? { x: best.x, y: best.y, e: best, boss: !!best.boss } : { x: x + Math.cos(ang) * 320, y: y + Math.sin(ang) * 320, e: null, boss: false };
}

/** The helper every recipe gets. Shorthand methods mirror the pieces; positions default to the caster, `at()` gives common anchors. */
export function makeKit(fx, ev, sim, pal) {
  const x = ev.x, y = ev.y, ang = ev.ang ?? 0, T = targetOf(sim, x, y, ang);
  const k = {
    fx, ev, sim, pal, x, y, ang, tx: T.x, ty: T.y, boss: T.boss, enemy: T.e, dist: Math.hypot(T.x - x, T.y - y), me: ev.pid === fx.localPid,
    ca: Math.cos(ang), sa: Math.sin(ang), lite: lite(fx),
    /** a point `r` px from the caster along the aim (plus `side` px to the left of it) */
    ahead(r, side = 0) { return { x: x + this.ca * r - this.sa * side, y: y + this.sa * r + this.ca * side }; },
    add(prim, o = {}) { return addPiece(fx, prim, { x, y, col: pal.a, hi: pal.hi, b: pal.b, deep: pal.deep, pid: ev.pid, ...o }); }, // (pid: the shader only reacts to your own pieces)
    shake(n) { if (fx.shake) fx.shake(this.me ? n : n * 0.2); }, // (co-op: others' casts barely shake your screen)
    kick(z) { if (this.me) fx.zoomK = Math.min(0.3, Math.max(fx.zoomK || 0, z)); }, // camera punch: only your own casts, clamped
    flash(col, a) { if (this.me) { fx.flash = Math.max(fx.flash || 0, vfxPref.reduceFlash ? Math.min(a, 0.25) : a); fx.flashColor = col; } },
  };
  for (const p of Object.keys(PRIMS)) k[p] = (o = {}) => k.add(p, o); // (includes class-module prims registered at load)
  return k;
}
