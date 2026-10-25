// Grimoire Summoner: pages and ink. Every creature arrives in its own coloured summoning circle with an element crest (fire = ember orange triangle,
// frost wyrm = pale cyan snowflake serpent, thunder roc = violet storm with feathers and bolts, phoenix = golden wings of flame, kraken = deep teal
// tentacles over an ink whirlpool). Glowing rune lines are drawn across the ground, book pages fly and flip, ink splashes the floor; chains braid two
// element colours together. The base look stays teal ink + gold (see fxarcana.js); The Final Chapter keeps its own engine moment (fxmoment.js).
import { TAU, clamp, lerp, seeded } from './fxsk_core.js';
import { bloom, ease } from './fxglow.js';
import { drawBook } from './fxarcana.js';

const FIRE = { col: '#ff7a2c', hi: '#ffd27a', b: '#ffb347', deep: '#3a1005' };
const FROST = { col: '#9fe8ff', hi: '#f0fcff', b: '#5fb8e8', deep: '#0a2a44' };
const STORM = { col: '#a99bff', hi: '#fff6a0', b: '#7a5cff', deep: '#1d1442' };
const PHX = { col: '#ff9a3a', hi: '#fff2a0', b: '#ffd86a', deep: '#4a1608' };
const INK = { col: '#3ff0c8', hi: '#e6fff8', b: '#2a9fb0', deep: '#06222a' };
const GOLD = { col: '#ffd86a', hi: '#fff6d0', b: '#ff9a3a', deep: '#3a2a08' };
const o = (e, x) => ({ col: e.col, hi: e.hi, b: e.b, deep: e.deep, ...x });
const ang2 = (x0, y0, x1, y1) => Math.atan2(y1 - y0, x1 - x0);

// ------------------------------------------------------------------ drawing helpers for the class pieces
function glowLine(ctx, pts, w, col, hi, a) { // a polyline in three passes: wide colour, highlight, white core
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [m, c, al] of [[2.6, col, 0.35], [1, hi || col, 0.8], [0.35, '#fff', 1]]) {
    ctx.lineWidth = w * m; ctx.strokeStyle = c; ctx.globalAlpha = a * al; ctx.beginPath();
    pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.stroke();
  }
}
function crestGlyph(ctx, el, r, c, a, sp) { // the element emblem in the middle of a summoning circle (drawn in the squashed ground plane)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const stroke = (w) => { ctx.globalAlpha = a * 0.55; ctx.strokeStyle = c.col; ctx.lineWidth = w * 2.4; ctx.stroke(); ctx.globalAlpha = a * 0.95; ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = w; ctx.stroke(); };
  ctx.beginPath();
  if (el === 'fire') { // a flame triangle with a core ring
    for (let i = 0; i <= 3; i++) { const an = -Math.PI / 2 + i * TAU / 3; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * r, Math.sin(an) * r); } stroke(2.6);
    ctx.beginPath(); ctx.arc(0, r * 0.16, r * 0.26, 0, TAU); stroke(2);
    ctx.beginPath(); for (let i = 0; i < 3; i++) { const an = -Math.PI / 2 + i * TAU / 3; ctx.moveTo(Math.cos(an) * r * 1.05, Math.sin(an) * r * 1.05); ctx.lineTo(Math.cos(an) * r * 1.3, Math.sin(an) * r * 1.3); } stroke(2);
  } else if (el === 'frost') { // a six-armed snowflake
    for (let i = 0; i < 3; i++) {
      const an = i * Math.PI / 3 + sp * 0.12, x = Math.cos(an) * r, y = Math.sin(an) * r; ctx.moveTo(-x, -y); ctx.lineTo(x, y);
      for (const s of [-1, 1]) for (const q of [0.5, 0.8]) { const dir = an + (s > 0 ? 0 : Math.PI); for (const sg of [-1, 1]) { ctx.moveTo(s * x * q, s * y * q); ctx.lineTo(s * x * q + Math.cos(dir - sg * 2.5) * r * 0.22, s * y * q + Math.sin(dir - sg * 2.5) * r * 0.22); } }
    } stroke(2.2);
  } else if (el === 'storm') { // a thunderbolt inside four storm dots
    const P = [[0.25, -1], [-0.4, 0.08], [0.02, 0.08], [-0.28, 1], [0.5, -0.22], [0.08, -0.22]]; P.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0] * r, p[1] * r)); ctx.closePath(); stroke(2.4);
    ctx.beginPath(); for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + Math.PI / 4 + sp * 0.3; ctx.moveTo(Math.cos(an) * r * 1.15 + 1, Math.sin(an) * r * 1.15); ctx.arc(Math.cos(an) * r * 1.15, Math.sin(an) * r * 1.15, 2.5, 0, TAU); } stroke(2);
  } else if (el === 'phoenix') { // a sun with two wings of flame
    ctx.arc(0, 0, r * 0.28, 0, TAU); for (let i = 0; i < 8; i++) { const an = i / 8 * TAU + sp * 0.2; ctx.moveTo(Math.cos(an) * r * 0.4, Math.sin(an) * r * 0.4); ctx.lineTo(Math.cos(an) * r * 0.62, Math.sin(an) * r * 0.62); } stroke(2.2);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.3, 0); ctx.quadraticCurveTo(s * r * 0.9, -r * 0.9, s * r * 1.3, -r * 0.3); ctx.quadraticCurveTo(s * r * 0.95, -r * 0.35, s * r * 1.15, r * 0.15); ctx.quadraticCurveTo(s * r * 0.8, 0, s * r * 0.9, r * 0.5); ctx.quadraticCurveTo(s * r * 0.55, r * 0.1, s * r * 0.3, r * 0.2); stroke(2); }
  } else if (el === 'kraken') { // a three-armed ink spiral
    for (let arm = 0; arm < 3; arm++) { for (let i = 0; i <= 18; i++) { const u = i / 18, an = arm * TAU / 3 + u * 4.2 - sp * 0.5, rr = r * (0.1 + 0.95 * u); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); } } stroke(2.4);
  } else { // an open book
    for (const s of [-1, 1]) { ctx.moveTo(0, r * 0.5); ctx.quadraticCurveTo(s * r * 0.5, r * 0.25, s * r * 1.05, r * 0.35); ctx.lineTo(s * r * 1.05, -r * 0.6); ctx.quadraticCurveTo(s * r * 0.5, -r * 0.7, 0, -r * 0.45); ctx.closePath(); }
    ctx.moveTo(0, -r * 0.45); ctx.lineTo(0, r * 0.5); stroke(2.2);
  }
}
function rune(ctx, kind, s) { // one little glyph (in a rotated frame, centred on 0,0)
  ctx.beginPath();
  switch (kind % 5) {
    case 0: ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.moveTo(-s * 0.6, -s * 0.2); ctx.lineTo(s * 0.6, s * 0.4); break;
    case 1: ctx.moveTo(-s * 0.7, -s * 0.7); ctx.lineTo(s * 0.7, s * 0.7); ctx.moveTo(s * 0.7, -s * 0.7); ctx.lineTo(-s * 0.7, s * 0.7); break;
    case 2: ctx.moveTo(-s * 0.8, s * 0.5); ctx.lineTo(0, -s * 0.7); ctx.lineTo(s * 0.8, s * 0.5); break;
    case 3: ctx.moveTo(-s, -s * 0.5); ctx.lineTo(-s * 0.3, s * 0.5); ctx.lineTo(s * 0.3, -s * 0.5); ctx.lineTo(s, s * 0.5); break;
    default: ctx.arc(0, 0, s * 0.55, 0, TAU); ctx.moveTo(0, -s * 0.55); ctx.lineTo(0, -s * 1.1);
  }
  ctx.stroke();
}
function flameDrop(ctx, s, c, a, t) { // a teardrop of flame facing +x with a wavy tail and a bright head
  const wv = Math.sin(t * 24) * s * 0.25;
  for (const [m, col, al] of [[1, c.col, 0.55], [0.7, c.b || c.col, 0.8], [0.4, c.hi || '#fff', 0.95], [0.18, '#fff', 1]]) {
    ctx.globalAlpha = a * al; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(s * m * 1.1, 0);
    ctx.quadraticCurveTo(s * m * 0.5, -s * m * 0.95, -s * m * 0.5, -s * m * 0.5); ctx.quadraticCurveTo(-s * m * 1.7, -s * 0.2 + wv, -s * m * 2.7, wv * 0.6);
    ctx.quadraticCurveTo(-s * m * 1.6, s * 0.2 + wv, -s * m * 0.5, s * m * 0.5); ctx.quadraticCurveTo(s * m * 0.5, s * m * 0.95, s * m * 1.1, 0); ctx.fill();
  }
}
function birdShape(ctx, s, flap, c, a) { // a bird seen from above facing +x: feathered wings, tail plumes, beak (roc / phoenix)
  const L = 1 + 0.3 * Math.sin(flap), T = [[0.05, 2.25], [-0.3, 2.0], [-0.6, 1.7], [-0.9, 1.3], [-1.05, 0.8], [-1.0, 0.3]];
  bloom(ctx, 0, 0, s * 2.8, c.col, 0.5 * a);
  for (const sy of [-1, 1]) {
    const g = ctx.createLinearGradient(0, 0, 0, sy * s * 2.3 * L); g.addColorStop(0, c.hi || '#fff'); g.addColorStop(0.4, c.col); g.addColorStop(1, c.b || c.col);
    ctx.fillStyle = g; ctx.globalAlpha = a * 0.9; ctx.beginPath(); ctx.moveTo(s * 0.45, sy * s * 0.12);
    for (const [tx, ty] of T) ctx.lineTo(s * tx, sy * s * ty * L);
    ctx.lineTo(-s * 0.4, sy * s * 0.15); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 1.4; ctx.globalAlpha = a * 0.6; ctx.beginPath(); for (const [tx, ty] of T) { ctx.moveTo(s * 0.2, sy * s * 0.15); ctx.lineTo(s * tx * 0.9, sy * s * ty * L * 0.95); } ctx.stroke();
  }
  ctx.globalAlpha = a * 0.85; ctx.fillStyle = c.col;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.5, 0); ctx.quadraticCurveTo(-s * 1.3, i * s * 0.35, -s * 2.1, i * s * 0.6); ctx.quadraticCurveTo(-s * 1.2, i * s * 0.12, -s * 0.5, i * s * 0.1); ctx.fill(); }
  ctx.globalAlpha = a; ctx.fillStyle = c.deep || '#1a1030'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.8, s * 0.3, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(s * 0.78, 0, s * 0.25, 0, TAU); ctx.fill();
  ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.8, s * 0.3, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = c.hi || '#fff'; ctx.beginPath(); ctx.moveTo(s * 0.98, -s * 0.09); ctx.lineTo(s * 1.3, 0); ctx.lineTo(s * 0.98, s * 0.09); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.86, -s * 0.1, s * 0.06, 0, TAU); ctx.arc(s * 0.86, s * 0.1, s * 0.06, 0, TAU); ctx.fill();
}

// ------------------------------------------------------------------ the class pieces (prefix sum_)
const prims = {
  /** A summoning circle on the ground with an element crest in the middle: el = fire | frost | storm | phoenix | kraken | book. */
  sum_crest(ctx, c, k, time) {
    const inK = ease.out(clamp(k / 0.2)), a = inK * ease.in(clamp((1 - k) / 0.3)); if (a < 0.02) return;
    const R = c.R * (0.75 + 0.25 * inK), sp = (c.spin || 1) * time;
    ctx.save(); ctx.translate(c.x, c.y + 14); ctx.scale(1, 0.55); bloom(ctx, 0, 0, R * 1.15, c.col, 0.5 * a);
    const ring = (r, w, col, al) => { ctx.globalAlpha = a * al; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); };
    ring(R, 6, c.col, 0.55); ring(R, 2, '#fff', 0.85); ring(R * 0.8, 2.4, c.b || c.col, 0.7);
    ctx.save(); ctx.rotate(sp * 0.6); ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) { const an = i / 14 * TAU; ctx.save(); ctx.translate(Math.cos(an) * R * 0.89, Math.sin(an) * R * 0.89); ctx.rotate(an + Math.PI / 2); ctx.globalAlpha = a * 0.85; rune(ctx, i, R * 0.05); ctx.restore(); }
    ctx.restore(); ctx.save(); ctx.rotate(-sp * 0.2); crestGlyph(ctx, c.el, R * 0.5, c, a, sp); ctx.restore(); ctx.restore();
  },
  /** Glowing rune lines drawn across the ground from (x,y) to (x2,y2): two rails with glyphs lighting up as the line is written. */
  sum_runes(ctx, c, k) {
    const ext = ease.out(clamp(k / 0.35)), a = ease.in(clamp((1 - k) / 0.45)), dx = c.x2 - c.x, dy = c.y2 - c.y, L = Math.hypot(dx, dy) || 1, an = Math.atan2(dy, dx), gap = c.gap || 13, nx = -dy / L, ny = dx / L, R = seeded(c.seed);
    if (a < 0.02) return;
    for (const s of [-1, 1]) glowLine(ctx, [[c.x + nx * gap * s, c.y + ny * gap * s], [c.x + dx * ext + nx * gap * s, c.y + dy * ext + ny * gap * s]], 1.6, c.col, c.hi, a * 0.8);
    const n = Math.max(2, Math.floor(L / 34)); ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, kind = (R() * 5) | 0; if (u > ext) continue;
      const lit = 0.55 + 0.45 * Math.max(0, 1 - Math.abs(k * 1.6 - u) * 3);
      ctx.save(); ctx.translate(c.x + dx * u, c.y + dy * u); ctx.rotate(an + Math.PI / 2); ctx.strokeStyle = lit > 0.8 ? '#fff' : c.hi || c.col; ctx.lineWidth = 2; ctx.globalAlpha = a * lit; rune(ctx, kind, gap * 0.5); ctx.restore();
      bloom(ctx, c.x + dx * u, c.y + dy * u, gap * 1.6, c.col, 0.35 * a * lit);
    }
    bloom(ctx, c.x + dx * ext, c.y + dy * ext, gap * 2.6, c.hi || c.col, 0.7 * a);
  },
  /** Book pages flying out of (x,y): n pages fan along ang (spread = fan width, TAU = all around), flipping and twisting on the way. */
  sum_pages(ctx, c, k, time) {
    const R = seeded(c.seed);
    for (let i = 0; i < c.n; i++) {
      const an = c.ang + (R() - 0.5) * c.spread, dist = c.len * (0.4 + 0.6 * R()), ph = R() * TAU, sz = (c.size || 10) * (0.8 + 0.4 * R()), st = R() * 0.25, u = clamp((k - st) / 0.7);
      if (u <= 0 || u >= 1) continue;
      const e = ease.out(u), an2 = an + (c.twist || 0) * e, x = c.x + Math.cos(an2) * dist * e, y = c.y + Math.sin(an2) * dist * e * (c.sq ?? 0.7) - (c.lift ?? 30) * Math.sin(Math.PI * u), al = (1 - ease.in(u)) * Math.min(1, u * 8), flip = Math.cos(u * 9 + ph);
      const x0 = c.x + Math.cos(an2) * dist * ease.out(Math.max(0, u - 0.1)), y0 = c.y + Math.sin(an2) * dist * ease.out(Math.max(0, u - 0.1)) * (c.sq ?? 0.7) - (c.lift ?? 30) * Math.sin(Math.PI * Math.max(0, u - 0.1));
      ctx.globalAlpha = al * 0.6; ctx.strokeStyle = c.col; ctx.lineWidth = sz * 0.35; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke(); bloom(ctx, x, y, sz * 2.4, c.col, 0.5 * al);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ph + u * 4); ctx.scale(flip, 1); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = al * 0.95; ctx.fillStyle = '#f4ead2'; ctx.fillRect(-sz * 0.7, -sz, sz * 1.4, sz * 2);
      ctx.fillStyle = c.col; ctx.globalAlpha = al * 0.85; for (let l = 0; l < 4; l++) ctx.fillRect(-sz * 0.5, -sz * 0.7 + l * sz * 0.45, sz * (l % 2 ? 0.7 : 1), 1.8);
      ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 1.2; ctx.strokeRect(-sz * 0.7, -sz, sz * 1.4, sz * 2); ctx.restore();
    }
  },
  /** An ink splash on the ground: a dark glowing-rimmed pool with droplets; spiral:true turns it into a whirlpool. */
  sum_ink(ctx, c, k, time) {
    const grow = ease.out(clamp(k / 0.22)), a = 1 - ease.in(clamp((k - 0.62) / 0.38)), R = c.R * grow, rg = seeded(c.seed); if (R < 3 || a < 0.02) return;
    const blobs = [[0, 0, 0.6]]; for (let i = 0; i < 9; i++) { const an = rg() * TAU, d = 0.35 + rg() * 0.45, s = 0.22 + rg() * 0.22; blobs.push([Math.cos(an) * d, Math.sin(an) * d, s]); }
    ctx.save(); ctx.translate(c.x, c.y + 14); ctx.scale(1, 0.55);
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = c.deep || '#06222a'; ctx.globalAlpha = a * 0.82;
    for (const [bx, by, bs] of blobs) { ctx.beginPath(); ctx.arc(bx * R, by * R, bs * R, 0, TAU); ctx.fill(); }
    for (let i = 0; i < 14; i++) { const an = rg() * TAU, d = R * (1.0 + rg() * 0.35) * grow, s = 2 + rg() * 5; ctx.beginPath(); ctx.arc(Math.cos(an) * d, Math.sin(an) * d, s, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = c.col; ctx.lineWidth = 3; ctx.globalAlpha = a * 0.55;
    for (const [bx, by, bs] of blobs) { ctx.beginPath(); ctx.arc(bx * R, by * R, bs * R, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 1.2; ctx.globalAlpha = a * 0.5; for (const [bx, by, bs] of blobs.slice(0, 5)) { ctx.beginPath(); ctx.arc(bx * R, by * R, bs * R * 0.96, 0.3, 1.7); ctx.stroke(); }
    if (c.spiral) for (let arm = 0; arm < 4; arm++) { const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24, an = arm * TAU / 4 + time * 3 + u * 5, rr = R * (0.08 + 0.85 * u); pts.push([Math.cos(an) * rr, Math.sin(an) * rr]); } glowLine(ctx, pts, 3, c.col, c.hi, a * 0.85); }
    ctx.restore(); bloom(ctx, c.x, c.y + 14, R * 0.9, c.col, 0.28 * a);
  },
  /** A creature in flight from (x,y) to (x2,y2) seen from above: feathered wings, tail plumes and a glowing trail (roc = violet, phoenix = gold flame). */
  sum_bird(ctx, c, k, time) {
    const u = ease.inOut(clamp(k / 0.82)), a = Math.min(1, k * 10) * (1 - ease.in(clamp((k - 0.82) / 0.18)));
    const pos = (v) => ({ x: lerp(c.x, c.x2, v), y: lerp(c.y, c.y2, v) - (c.lift || 0) * Math.sin(Math.PI * v) });
    const trail = []; for (let j = 12; j >= 0; j--) { const p = pos(Math.max(0, u - j * 0.028)); trail.push([p.x, p.y]); }
    glowLine(ctx, trail, c.s * 0.22, c.col, c.hi, a * 0.8);
    const p = pos(u), p2 = pos(clamp(u + 0.02)), an = Math.atan2(p2.y - p.y || c.y2 - c.y, p2.x - p.x || c.x2 - c.x);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(an); ctx.scale(1, 0.62); birdShape(ctx, c.s, time * (c.flap || 16), c, a); ctx.restore();
  },
  /** Tentacle ribbons rising out of the ground around (x,y); crush:true makes them close in on the centre (kraken). */
  sum_tent(ctx, c, k, time) {
    const rise = ease.back(clamp(k / 0.25)), a = ease.out(clamp(k / 0.1)) * ease.in(clamp((1 - k) / 0.3)), R = seeded(c.seed); if (a < 0.02) return;
    const list = []; for (let i = 0; i < c.n; i++) list.push({ g: i / c.n * TAU + R() * 0.5, h: c.h * (0.75 + R() * 0.5), ph: R() * TAU }); list.sort((p, q) => Math.sin(p.g) - Math.sin(q.g));
    for (const q of list) {
      const rr = c.R * (c.crush ? 1 - 0.55 * ease.inOut(clamp(k / 0.5)) : 1), bx = c.x + Math.cos(q.g) * rr, by = c.y + 14 + Math.sin(q.g) * rr * 0.5, dir = Math.cos(q.g) < 0 ? 1 : -1, H = q.h * Math.max(0, rise), pts = [];
      for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push([bx + Math.sin(u * 3 + time * 4 + q.ph) * c.w * 1.5 * u + dir * u * u * c.w * 2.2 * (c.crush ? 1.6 : 1), by - H * u + (u > 0.85 ? (u - 0.85) * 4 * c.w * 2 : 0)]); }
      ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'source-over';
      for (let i = 1; i < pts.length; i++) { const u = i / pts.length, lw = c.w * (1 - u * 0.85); ctx.globalAlpha = a * 0.92; ctx.strokeStyle = c.deep || '#0d3b44'; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
      ctx.globalCompositeOperation = 'lighter'; glowLine(ctx, pts, c.w * 0.18, c.col, c.hi, a * 0.9);
      ctx.fillStyle = c.hi || '#fff'; for (let i = 2; i < pts.length - 1; i += 2) { ctx.globalAlpha = a * 0.8; ctx.beginPath(); ctx.arc(pts[i][0] + c.w * 0.2, pts[i][1], c.w * 0.1 * (1 - i / 14) + 1, 0, TAU); ctx.fill(); }
      bloom(ctx, pts[pts.length - 1][0], pts[pts.length - 1][1], c.w * 1.6, c.col, 0.6 * a); bloom(ctx, bx, by, c.w * 2, c.col, 0.4 * a);
    }
  },
  /** Fire sprites: n flame spirits arc from (x,y) to (x2,y2), spread = how far apart their arcs bow; they flare on arrival. */
  sum_sprite(ctx, c, k, time) {
    const R = seeded(c.seed);
    for (let i = 0; i < c.n; i++) {
      const side = (i - (c.n - 1) / 2) * (c.spread || 40), st = (i / Math.max(1, c.n)) * 0.22, u = clamp((k - st) / 0.55), jx = (R() - 0.5) * 50, jy = (R() - 0.5) * 36, tx = c.x2 + jx, ty = c.y2 + jy, dx = tx - c.x, dy = ty - c.y, L = Math.hypot(dx, dy) || 1;
      const pos = (v) => { const e = ease.inOut(v), w = Math.sin(Math.PI * v); return [c.x + dx * e - dy / L * side * w, c.y + dy * e + dx / L * side * w - (c.lift ?? 40) * w]; };
      if (u <= 0) continue;
      if (u < 1) {
        for (let j = 5; j >= 1; j--) { const q = pos(Math.max(0, u - j * 0.035)); bloom(ctx, q[0], q[1], c.size * (1.9 - j * 0.2), c.col, 0.45 * (1 - j / 6)); }
        const p = pos(u), p2 = pos(Math.min(1, u + 0.02)); ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(Math.atan2(p2[1] - p[1], p2[0] - p[0])); bloom(ctx, 0, 0, c.size * 3, c.col, 0.7); flameDrop(ctx, c.size, c, 1, time + i); ctx.restore();
      } else { const v = clamp((k - st - 0.55) / 0.3); if (v < 1) { bloom(ctx, tx, ty, c.size * (2.5 + 3 * ease.out(v)), c.col, 0.8 * (1 - v)); bloom(ctx, tx, ty, c.size * 1.4, '#fff', 0.8 * (1 - v), 1); } }
    }
  },
  /** A small open grimoire that rises out of (x,y), flutters and fades (the existing book art from fxarcana). */
  sum_book(ctx, c, k, time) {
    const rise = ease.out(clamp(k / 0.28)), a = clamp(k / 0.08) * ease.in(clamp((1 - k) / 0.35)); if (a < 0.02) return;
    ctx.globalCompositeOperation = 'source-over'; drawBook(ctx, c.x, c.y - (c.lift ?? 60) * rise, c.s * (0.8 + 0.2 * rise), ease.out(clamp(k / 0.3)), time, a, c.col);
  },
  /** A dark storm cloud hovering over (x,y) at height h, lit from inside, raining hail down onto the ground. */
  sum_cloud(ctx, c, k, time) {
    const grow = ease.out(clamp(k / 0.25)), a = ease.in(clamp((1 - k) / 0.25)) * clamp(k / 0.1), R = seeded(c.seed), cy = c.y - c.h; if (a < 0.02) return;
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    const puffs = []; for (let i = 0; i < 12; i++) puffs.push([(R() - 0.5) * c.R * 1.7 * grow, (R() - 0.5) * c.R * 0.25, c.R * (0.22 + R() * 0.2) * grow]);
    ctx.fillStyle = c.deep || '#1d1442'; ctx.globalAlpha = a * 0.88; for (const [px, py, ps] of puffs) { ctx.beginPath(); ctx.ellipse(c.x + px, cy + py + ps * 0.25, ps, ps * 0.62, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#4a3c8c'; ctx.globalAlpha = a * 0.55; for (const [px, py, ps] of puffs) { ctx.beginPath(); ctx.ellipse(c.x + px, cy + py - ps * 0.18, ps * 0.85, ps * 0.42, 0, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'lighter'; puffs.forEach(([px, py, ps], i) => bloom(ctx, c.x + px, cy + py, ps * 1.5, c.col, 0.7 * a * Math.pow(Math.max(0, Math.sin(time * 11 + i * 2.3)), 6)));
    bloom(ctx, c.x, cy + c.R * 0.1, c.R * 1.1, c.col, 0.2 * a);
    ctx.lineCap = 'round'; ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 2;
    for (let i = 0; i < (c.hail || 30); i++) { const f = (time * 1.7 + R()) % 1, hx = c.x + (R() - 0.5) * c.R * 1.8, gy = c.y + (R() - 0.5) * c.R * 0.5; if (f > 0.97) continue; ctx.globalAlpha = a * 0.8 * (f < 0.1 ? f * 10 : 1); const yy = lerp(cy + c.R * 0.1, gy, f), xx = hx - f * 14; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx - 5, yy - 20); ctx.stroke(); }
    ctx.restore();
  },
};

// ------------------------------------------------------------------ recipes
export default {
  pal: { a: '#3ff0c8', b: '#ffd86a', hi: '#e6fff8', deep: '#06222a', ink: '#04141a', edge: '#b9fff0' },
  prims, underPrims: ['sum_crest', 'sum_runes', 'sum_ink'],
  skills: {
    fire_sprites(k) { // an ember circle opens, a rune line runs to the target and three flame spirits arc along it and burst
      const b = k.ahead(56);
      k.sum_crest(o(FIRE, { x: b.x, y: b.y, R: 78, el: 'fire', life: 0.9 }));
      k.sum_runes(o(FIRE, { x: k.x, y: k.y + 8, x2: k.tx, y2: k.ty + 8, life: 0.75 }));
      k.sum_sprite(o(FIRE, { x: b.x, y: b.y - 24, x2: k.tx, y2: k.ty - 10, n: 3, spread: 46, size: 15, d: 0.06, life: 0.7 }));
      k.ring(o(FIRE, { x: k.tx, y: k.ty, R: 100, d: 0.38 })); k.flash(o(FIRE, { x: k.tx, y: k.ty, R: 110, d: 0.38 }));
      k.motes(o(FIRE, { x: k.tx, y: k.ty, n: 14, type: 'ember', spd: 220, g: -60, size: 6, col2: FIRE.hi, ang: -Math.PI / 2, spread: 2.6, d: 0.4 }));
      k.motes({ x: k.x, y: k.y - 30, n: 5, type: 'page', spd: 190, g: 30, size: 7, col: INK.col, ang: k.ang, spread: 1.2, d: 0.02, opt: true });
    },
    frost_wyrm(k) { // a snowflake circle behind you, a cyan serpent coils out along the aim and breathes a rime cone studded with ice
      const b = k.ahead(-34), e = k.ahead(270);
      k.sum_crest(o(FROST, { x: b.x, y: b.y, R: 88, el: 'frost', life: 1.0 }));
      k.sum_runes(o(FROST, { x: k.x, y: k.y + 8, x2: e.x, y2: e.y + 8, life: 0.9 }));
      k.serpent(o(FROST, { x: b.x, y: b.y - 30, ang: k.ang, len: 340, amp: 46, w: 18, d: 0.03, life: 0.85 }));
      k.wave(o(FROST, { x: k.x, y: k.y - 8, ang: k.ang, arc: 1.25, r: 270, n: 3, w: 16, d: 0.22, life: 0.7 }));
      k.spires(o(FROST, { x: k.x, y: k.y, ang: k.ang, fan: 1.1, R: 220, R0: 70, n: 6, h: 92, wd: 15, shape: 'ice', d: 0.28 }));
      k.motes(o(FROST, { x: k.x, y: k.y - 10, n: 26, type: 'snow', spd: 360, g: 40, size: 6, ang: k.ang, spread: 1.25, d: 0.22, life: 1.0 }));
    },
    thunder_roc(k) { // a violet storm circle, the roc banks down the line trailing feathers while four bolts strike in its wake
      const e = k.ahead(540), a = k.ahead(-60);
      k.sum_crest(o(STORM, { x: k.x, y: k.y, R: 80, el: 'storm', life: 0.9 }));
      k.sum_runes(o(STORM, { x: k.x, y: k.y + 8, x2: e.x, y2: e.y + 8, life: 0.9 }));
      k.sum_bird(o(STORM, { x: a.x, y: a.y - 70, x2: e.x, y2: e.y - 70, s: 42, lift: 40, d: 0.04, life: 0.6 }));
      for (let i = 0; i < 4; i++) { const p = k.ahead(120 + i * 130, (i % 2 ? 1 : -1) * 22), d = 0.13 + i * 0.07; k.bolt(o(STORM, { x: p.x + 26, y: p.y - 520, x2: p.x, y2: p.y, w: 5, forks: 3, d, life: 0.4 })); k.ring(o(STORM, { x: p.x, y: p.y, R: 85, d })); }
      k.motes(o(STORM, { x: k.ahead(300).x, y: k.ahead(300).y - 70, n: 16, type: 'feather', spd: 120, g: 50, size: 8, col2: STORM.hi, spread: TAU, d: 0.15, life: 1.3 }));
    },
    turn_the_page(k) { // the grimoire flips open above you, a ring of pages spirals out, two teal cuts and a gold rune puff mark the empowered next summon
      k.sum_book(o(INK, { x: k.x, y: k.y - 20, s: 30, lift: 64, life: 0.75 }));
      k.sum_crest(o(INK, { x: k.x, y: k.y, R: 112, el: 'book', life: 0.85 }));
      k.sum_pages(o(INK, { x: k.x, y: k.y - 20, ang: 0, spread: TAU, n: 14, len: 160, twist: 1.6, size: 11, d: 0.05, life: 0.9 }));
      k.arc(o(INK, { x: k.x, y: k.y, a0: k.ang - 2.4, sw: 4.8, r: 118, w: 12, d: 0.06, sq: 0.85, life: 0.4 }));
      k.arc(o(GOLD, { x: k.x, y: k.y, a0: k.ang + 0.8, sw: 4.4, r: 90, w: 8, d: 0.1, sq: 0.85, life: 0.4 }));
      k.ring(o(INK, { x: k.x, y: k.y, R: 150, d: 0.08 }));
      k.motes(o(GOLD, { x: k.x, y: k.y - 20, n: 8, type: 'rune', spd: 110, g: -40, size: 7, ang: -Math.PI / 2, spread: 1.4, d: 0.15, life: 1.1 }));
    },
    legendary_page(k) { // a gold legendary book opens; packs get a phoenix streaking down the line, a boss near the aim gets an ink whirlpool and kraken
      k.sum_crest(o(GOLD, { x: k.x, y: k.y, R: 112, el: 'book', life: 1.1 }));
      k.sum_book(o(GOLD, { x: k.x, y: k.y - 20, s: 44, lift: 92, life: 1.0 }));
      k.motes(o(GOLD, { x: k.x, y: k.y - 60, n: 12, type: 'page', spd: 260, g: 40, size: 9, col: GOLD.col, spread: TAU, d: 0.05, life: 1.2 }));
      if (k.boss) {
        k.sum_crest(o(INK, { x: k.tx, y: k.ty, R: 150, el: 'kraken', d: 0.25, life: 1.2 }));
        k.sum_ink(o(INK, { x: k.tx, y: k.ty, R: 170, spiral: true, d: 0.3, life: 1.3 }));
        k.sum_tent(o(INK, { x: k.tx, y: k.ty, R: 110, n: 7, h: 210, w: 24, d: 0.45, life: 1.0 }));
      } else {
        const e = k.ahead(680);
        k.sum_runes(o(PHX, { x: k.x, y: k.y + 8, x2: e.x, y2: e.y + 8, d: 0.2, life: 1.0 }));
        k.sum_bird(o(PHX, { x: k.x, y: k.y - 40, x2: e.x, y2: e.y - 40, s: 58, lift: 50, d: 0.3, life: 0.75, flap: 13 }));
        k.wings(o(PHX, { x: k.x, y: k.y, span: 170, d: 0.25, life: 0.9 }));
        k.motes(o(PHX, { x: k.ahead(340).x, y: k.ahead(340).y, n: 28, type: 'ember', spd: 150, g: -110, size: 6, col2: PHX.hi, ang: -Math.PI / 2, spread: 2.6, R0: 200, d: 0.4, life: 1.2 }));
      }
    },
  },
  basic(k, ev) { // a razor page cuts out of the book; the third swing snaps it shut with a rune burst
    if (ev.idx === 2) {
      const p = k.ahead(70);
      k.sum_book(o(INK, { x: p.x, y: p.y, s: 22, lift: 30, life: 0.45 }));
      k.ring(o(INK, { x: p.x, y: p.y, R: 95, d: 0.1 })); k.burst(o(GOLD, { x: p.x, y: p.y - 10, n: 8, len: 90, d: 0.1, life: 0.5 }));
      k.motes(o(GOLD, { x: p.x, y: p.y - 10, n: 8, type: 'rune', spd: 220, g: 80, size: 6, spread: TAU, d: 0.1, life: 0.7, opt: true }));
    } else {
      const c = ev.idx ? GOLD : INK, s = ev.idx ? -1 : 1;
      k.streak(o(c, { x: k.x, y: k.y - 18, ang: k.ang + s * 0.08, len: 150, w: 6, d: 0.03, life: 0.3 }));
      k.sum_pages(o(c, { x: k.x, y: k.y - 18, ang: k.ang, spread: 0.5, n: 2, len: 190, size: 7, lift: 14, sq: 1, d: 0.02, life: 0.5 }));
    }
  },
  ult(k) { // Grimoire Unbound: the book tears open over a huge rune circle, five element crests light up around it and all five creatures break out
    const x = k.x, y = k.y, ring = 215, el = ['fire', 'frost', 'storm', 'phoenix', 'kraken'], cl = [FIRE, FROST, STORM, PHX, INK];
    k.sigil(o(GOLD, { x, y, R: 300, n: 8, d: 0.05, life: 2.0, hold: 0.8 }));
    k.sum_ink(o(INK, { x, y, R: 220, spiral: true, d: 0.2, life: 1.8 }));
    k.sum_book(o(GOLD, { x, y: y - 30, s: 66, lift: 110, life: 1.5 }));
    for (let i = 0; i < 5; i++) {
      const an = -Math.PI / 2 + i / 5 * TAU, px = x + Math.cos(an) * ring, py = y + Math.sin(an) * ring * 0.62, d = 0.2 + i * 0.05;
      k.sum_crest(o(cl[i], { x: px, y: py, R: 62, el: el[i], d, life: 1.5 }));
      k.sum_runes(o(cl[i], { x: x, y: y + 8, x2: px, y2: py + 8, d, life: 1.0, opt: true }));
    }
    k.sum_sprite(o(FIRE, { x, y: y - 30, x2: x + Math.cos(-Math.PI / 2) * 230, y2: y - 150, n: 4, spread: 50, size: 15, d: 0.4, life: 0.7 }));
    k.serpent(o(FROST, { x, y: y - 30, ang: -Math.PI / 2 + TAU / 5, len: 300, amp: 40, w: 16, d: 0.4, life: 0.9 }));
    k.sum_bird(o(STORM, { x, y: y - 60, x2: x + Math.cos(-Math.PI / 2 + TAU * 2 / 5) * 300, y2: y + Math.sin(-Math.PI / 2 + TAU * 2 / 5) * 190 - 60, s: 40, lift: 60, d: 0.4, life: 0.7 }));
    k.sum_bird(o(PHX, { x, y: y - 60, x2: x + Math.cos(-Math.PI / 2 + TAU * 3 / 5) * 300, y2: y + Math.sin(-Math.PI / 2 + TAU * 3 / 5) * 190 - 60, s: 46, lift: 60, d: 0.45, life: 0.7, flap: 12 }));
    k.sum_tent(o(INK, { x: x + Math.cos(-Math.PI / 2 + TAU * 4 / 5) * 180, y: y + Math.sin(-Math.PI / 2 + TAU * 4 / 5) * 110, R: 80, n: 5, h: 170, w: 20, d: 0.45, life: 1.0 }));
    k.ring(o(INK, { x, y, R: 300, n: 3, w: 30, d: 0.3 })); k.burst(o(GOLD, { x, y: y - 20, n: 16, len: 280, d: 0.3 }));
    k.sum_pages(o(INK, { x, y: y - 40, ang: 0, spread: TAU, n: 28, len: 320, twist: 1.2, size: 12, d: 0.3, life: 1.3 }));
    k.kick(0.06); k.shake(0.9);
  },
  chains: {
    wildfire(k, s) { // six flame spirits dive onto the pack, then a fire circle burns the ground
      k.sum_crest(o(FIRE, { x: s.x, y: s.y, R: 170, el: 'fire', d: 0.2, life: 1.4 }));
      k.sum_sprite(o(FIRE, { x: k.x, y: k.y - 30, x2: s.x, y2: s.y - 10, n: 6, spread: 70, size: 15, d: 0.04, life: 0.7 }));
      k.ring(o(FIRE, { x: s.x, y: s.y, R: 180, n: 2, d: 0.4 }));
      k.spires(o(FIRE, { x: s.x, y: s.y, n: 8, R: 140, h: 170, wd: 20, shape: 'flame', d: 0.4, life: 1.1 }));
      k.motes(o(FIRE, { x: s.x, y: s.y, n: 24, type: 'ember', spd: 170, g: -90, size: 6, col2: FIRE.hi, ang: -Math.PI / 2, spread: 2.4, d: 0.4 }));
    },
    frozen_thunder(k, s) { // a frost ribbon and a storm ribbon braid down to the target, ice spires rise and three bolts strike through them
      const a = ang2(k.x, k.y, s.x, s.y), L = Math.hypot(s.x - k.x, s.y - k.y) + 90;
      k.serpent(o(FROST, { x: k.x, y: k.y - 24, ang: a, len: L, amp: 42, w: 14, life: 0.8 })); k.serpent(o(STORM, { x: k.x, y: k.y - 24, ang: a, len: L, amp: -42, w: 14, d: 0.02, life: 0.8 }));
      k.sigil(o(FROST, { x: s.x, y: s.y, R: 130, n: 6, b: STORM.col, d: 0.25, life: 1.3, hold: 0.8 }));
      k.spires(o(FROST, { x: s.x, y: s.y, n: 7, R: 110, h: 190, wd: 18, shape: 'ice', d: 0.3 }));
      for (let i = 0; i < 3; i++) k.bolt(o(STORM, { x: s.x + (i - 1) * 90, y: s.y - 520, x2: s.x + (i - 1) * 24, y2: s.y, w: 6, forks: 3, d: 0.42 + i * 0.08, life: 0.4 }));
      k.flash(o(STORM, { x: s.x, y: s.y, R: 160, d: 0.42 }));
    },
    elemental_rise(k, s) { // three sprites fuse into a column of fire over the target: five punches, then a slam with a cracked floor
      k.sum_sprite(o(FIRE, { x: k.x, y: k.y - 30, x2: s.x, y2: s.y - 30, n: 3, spread: 36, size: 15, life: 0.55 }));
      k.sum_crest(o(FIRE, { x: s.x, y: s.y, R: 135, el: 'fire', d: 0.15, life: 1.4 }));
      k.pillar(o(FIRE, { x: s.x, y: s.y, h: 400, w: 32, d: 0.2, life: 0.9 }));
      k.sum_pages(o(INK, { x: s.x, y: s.y - 30, ang: 0, spread: TAU, n: 10, len: 130, twist: 2, size: 9, d: 0.25, life: 1.0 }));
      for (let i = 0; i < 5; i++) { const an = s.a0 + i * 2.4; k.flash(o(FIRE, { x: s.x + Math.cos(an) * 40, y: s.y + Math.sin(an) * 26 - 20, R: 70, d: 0.25 + i * 0.07 })); }
      k.ring(o(FIRE, { x: s.x, y: s.y, R: 180, n: 2, d: 0.65 })); k.crack(o(FIRE, { x: s.x, y: s.y, R: 150, n: 8, d: 0.65 })); k.shake(0.3);
    },
    storm_front(k, s) { // the roc drags a blizzard down the line: rune rails, hail waves and bolts breaking through the snow
      const e = k.ahead(560), a = k.ahead(-40);
      k.sum_runes(o(FROST, { x: k.x, y: k.y + 8, x2: e.x, y2: e.y + 8, life: 1.1 }));
      k.sum_bird(o(STORM, { x: a.x, y: a.y - 80, x2: k.ahead(620).x, y2: k.ahead(620).y - 80, s: 44, lift: 30, life: 0.7 }));
      k.wave(o(FROST, { x: k.x, y: k.y - 8, ang: k.ang, arc: 0.55, r: 560, n: 4, w: 20, d: 0.15, life: 0.8 }));
      for (let i = 0; i < 3; i++) { const p = k.ahead(180 + i * 160); k.motes(o(FROST, { x: p.x, y: p.y - 20, n: 12, type: 'snow', spd: 170, g: 70, size: 6, spread: TAU, R0: 80, d: 0.12 + i * 0.1, life: 1.0 })); k.bolt(o(STORM, { x: p.x + 40, y: p.y - 500, x2: p.x, y2: p.y, w: 5, forks: 2, d: 0.18 + i * 0.1, life: 0.35 })); }
    },
    glacier_coil(k, s) { // the wyrm winds a cyclone of ice round the target which freezes into a hex block with spires, then a second breath
      const a = ang2(k.x, k.y, s.x, s.y);
      k.sum_crest(o(FROST, { x: s.x, y: s.y, R: 142, el: 'frost', life: 1.5 }));
      k.swirl(o(FROST, { x: s.x, y: s.y + 20, R: 112, h: 260, arms: 3, spin: 7, w: 10, d: 0.05, life: 1.1 }));
      k.hex(o(FROST, { x: s.x, y: s.y, R: 120, d: 0.3, life: 1.0 }));
      k.spires(o(FROST, { x: s.x, y: s.y, n: 8, R: 120, h: 220, wd: 20, shape: 'ice', d: 0.3 }));
      k.wave(o(FROST, { x: k.x, y: k.y - 8, ang: a, arc: 1.25, r: Math.hypot(s.x - k.x, s.y - k.y) + 130, n: 3, w: 18, d: 0.55, life: 0.7 }));
      k.motes(o(FROST, { x: s.x, y: s.y - 20, n: 22, type: 'snow', spd: 240, g: 40, size: 6, spread: TAU, d: 0.55 })); k.flash(o(FROST, { x: s.x, y: s.y, R: 200, d: 0.58 }));
    },
    firestorm_flight(k, s) { // the roc swoops over the target dropping the sprites: six fire meteors land across the area
      const a = ang2(k.x, k.y, s.x, s.y), e = { x: k.x + Math.cos(a) * (Math.hypot(s.x - k.x, s.y - k.y) + 220), y: k.y + Math.sin(a) * (Math.hypot(s.x - k.x, s.y - k.y) + 220) };
      k.sum_bird(o(STORM, { x: k.x - Math.cos(a) * 60, y: k.y - 70, x2: e.x, y2: e.y - 100, s: 52, lift: 70, life: 0.8 }));
      k.sum_crest(o(FIRE, { x: s.x, y: s.y, R: 200, el: 'fire', d: 0.25, life: 1.2 }));
      for (let i = 0; i < 6; i++) { const an = i / 6 * TAU + s.a0, r = 40 + (i % 3) * 52; k.comet(o(FIRE, { x: s.x + Math.cos(an) * r, y: s.y + Math.sin(an) * r * 0.6, from: -1.9 + (i % 3) * 0.15, len: 600, size: 14, impact: 95, d: 0.2 + i * 0.07, life: 0.65, hit: 0.5 })); }
      k.motes(o(FIRE, { x: s.x, y: s.y, n: 20, type: 'ember', spd: 200, g: -80, size: 6, col2: STORM.hi, ang: -Math.PI / 2, spread: 2.6, d: 0.55 }));
    },
    tri_element(k, s) { // fire, ice and lightning take the corners of a triangle drawn in runes, then a thunderclap fires from the middle
      const V = [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6].map((an) => ({ x: s.x + Math.cos(an) * 115, y: s.y + Math.sin(an) * 85 }));
      [[0, 1], [1, 2], [2, 0]].forEach(([p, q], i) => k.sum_runes(o(GOLD, { x: V[p].x, y: V[p].y + 6, x2: V[q].x, y2: V[q].y + 6, d: i * 0.07, life: 1.2 })));
      k.sum_crest(o(FIRE, { x: V[0].x, y: V[0].y, R: 80, el: 'fire', d: 0.05, life: 1.2 })); k.spires(o(FIRE, { x: V[0].x, y: V[0].y, n: 5, R: 60, h: 150, wd: 16, shape: 'flame', d: 0.12 })); k.ring(o(FIRE, { x: V[0].x, y: V[0].y, R: 130, d: 0.12 }));
      k.sum_crest(o(FROST, { x: V[1].x, y: V[1].y, R: 80, el: 'frost', d: 0.15, life: 1.1 })); k.spires(o(FROST, { x: V[1].x, y: V[1].y, n: 5, R: 60, h: 150, wd: 15, shape: 'ice', d: 0.22 })); k.ring(o(FROST, { x: V[1].x, y: V[1].y, R: 130, d: 0.22 }));
      k.sum_crest(o(STORM, { x: V[2].x, y: V[2].y, R: 80, el: 'storm', d: 0.25, life: 1.0 })); k.bolt(o(STORM, { x: V[2].x + 30, y: V[2].y - 520, x2: V[2].x, y2: V[2].y, w: 6, forks: 3, d: 0.32, life: 0.4 })); k.ring(o(STORM, { x: V[2].x, y: V[2].y, R: 130, d: 0.32 }));
      [FIRE, FROST, STORM].forEach((e, i) => k.ring(o(e, { x: s.x, y: s.y, R: 150 + i * 45, n: 1, w: 24, d: 0.5 + i * 0.07 })));
      k.burst(o(STORM, { x: s.x, y: s.y - 10, n: 14, len: 200, d: 0.5 })); k.shake(0.4);
    },
    thunderhead(k, s) { // a storm cloud gathers above the target and rains hail with violet flicker inside, then three bolts strike out of it
      k.sum_crest(o(STORM, { x: s.x, y: s.y, R: 200, el: 'storm', life: 1.9 }));
      k.sum_cloud(o(STORM, { x: s.x, y: s.y, R: 190, h: 200, hail: 36, life: 1.9 }));
      for (let i = 0; i < 3; i++) { const p = { x: s.x + (i - 1) * 90, y: s.y + (i % 2 ? 14 : -10) }; k.bolt(o(STORM, { x: p.x + 20, y: s.y - 420, x2: p.x, y2: p.y, w: 7, forks: 4, d: 0.75 + i * 0.1, life: 0.45 })); k.ring(o(STORM, { x: p.x, y: p.y, R: 150, d: 0.75 + i * 0.1 }));  }
      k.motes(o(FROST, { x: s.x, y: s.y - 30, n: 24, type: 'snow', spd: 160, g: 90, size: 5, spread: TAU, R0: 120, d: 0.3, life: 1.3 })); k.shake(0.3);
    },
    living_inferno(k, s) { // flame claws close on the target from four sides (the elemental grab), then a violet bolt detonates it
      k.sum_crest(o(FIRE, { x: s.x, y: s.y, R: 140, el: 'fire', life: 1.7 }));
      for (let i = 0; i < 4; i++) { const an = s.a0 + i * Math.PI / 2, d = 0.05 + i * 0.09; k.streak(o(FIRE, { x: s.x - Math.cos(an) * 210, y: s.y - Math.sin(an) * 130, ang: Math.atan2(Math.sin(an) * 130, Math.cos(an) * 210), len: 230, w: 26, d, life: 0.4, ticks: 4 })); k.flash(o(FIRE, { x: s.x, y: s.y, R: 80, d: d + 0.1 })); }
      k.spires(o(FIRE, { x: s.x, y: s.y, n: 9, R: 90, h: 200, wd: 22, shape: 'flame', d: 0.3 }));
      k.bolt(o(STORM, { x: s.x + 40, y: s.y - 620, x2: s.x, y2: s.y, w: 10, forks: 5, d: 0.65, life: 0.5 })); k.pillar(o(STORM, { x: s.x, y: s.y, h: 700, w: 36, d: 0.65, life: 0.6 }));
      k.flash(o(FIRE, { x: s.x, y: s.y, R: 270, d: 0.68 })); k.burst(o(FIRE, { x: s.x, y: s.y - 10, n: 16, len: 280, d: 0.68 })); k.crack(o(FIRE, { x: s.x, y: s.y, R: 200, n: 9, d: 0.68 }));
      k.motes(o(FIRE, { x: s.x, y: s.y - 10, n: 36, type: 'ember', spd: 420, g: 260, size: 6, col2: STORM.col, mix: 0.4, ang: -Math.PI / 2, spread: 2.8, d: 0.7 })); k.shake(0.7);
    },
    wyrms_embrace(k, s) { // three cyan ribbons wind around the target like coils, four violet bolts strike it frozen, and the final breath bursts out as a cone
      const a = ang2(k.x, k.y, s.x, s.y);
      for (let i = 0; i < 3; i++) { const g = s.a0 + i * TAU / 3; k.serpent(o(FROST, { x: s.x + Math.cos(g) * 150, y: s.y + Math.sin(g) * 90 - 30, ang: g + Math.PI / 2 + 0.4, len: 300, amp: 34, w: 14, d: i * 0.06, life: 0.9 })); }
      k.hex(o(FROST, { x: s.x, y: s.y, R: 110, d: 0.2, life: 1.2 })); k.sum_crest(o(FROST, { x: s.x, y: s.y, R: 150, el: 'frost', life: 1.7 }));
      k.sum_pages(o(INK, { x: s.x, y: s.y - 30, ang: 0, spread: TAU, n: 10, len: 150, twist: -2, size: 9, d: 0.2, life: 1.0, opt: true }));
      for (let i = 0; i < 4; i++) { const an = s.a0 + i * Math.PI / 2 + 0.5; k.bolt(o(STORM, { x: s.x + Math.cos(an) * 160, y: s.y - 520, x2: s.x + Math.cos(an) * 40, y2: s.y + Math.sin(an) * 24, w: 6, forks: 3, d: 0.3 + i * 0.07, life: 0.4 })); }
      k.wave(o(FROST, { x: k.x, y: k.y - 8, ang: a, arc: 1.3, r: Math.hypot(s.x - k.x, s.y - k.y) + 150, n: 3, w: 20, d: 0.68, life: 0.7 })); k.flash(o(FROST, { x: s.x, y: s.y, R: 230, d: 0.7 }));
      k.motes(o(FROST, { x: s.x, y: s.y - 20, n: 26, type: 'snow', spd: 260, g: 40, size: 6, spread: TAU, d: 0.7 }));
    },
    phoenix_page(k, s) { // the legendary page opens in gold; a phoenix sweeps the line twice on a gold rune road, then is reborn in a feather and flame explosion
      const e = k.ahead(680);
      k.sum_crest(o(GOLD, { x: k.x, y: k.y, R: 120, el: 'book', life: 1.3 })); k.sum_book(o(GOLD, { x: k.x, y: k.y - 20, s: 46, lift: 96, life: 1.0 }));
      k.sum_runes(o(PHX, { x: k.x, y: k.y + 8, x2: e.x, y2: e.y + 8, d: 0.15, life: 1.2 }));
      k.sum_bird(o(PHX, { x: k.x, y: k.y - 40, x2: e.x, y2: e.y - 40, s: 62, lift: 50, d: 0.25, life: 0.7, flap: 13 }));
      k.sum_bird(o(PHX, { x: e.x, y: e.y - 40, x2: k.x, y2: k.y - 40, s: 54, lift: 90, d: 0.5, life: 0.7, flap: 13 }));
      for (let i = 0; i < 3; i++) { const p = k.ahead(220 + i * 150, (i - 1) * 60); k.bolt(o(STORM, { x: p.x + 20, y: p.y - 500, x2: p.x, y2: p.y, w: 5, forks: 2, d: 0.75 + i * 0.05, life: 0.35 })); }
      k.wings(o(PHX, { x: k.x, y: k.y, span: 260, d: 0.95, life: 1.0 })); k.flash(o(PHX, { x: k.x, y: k.y, R: 320, d: 0.95 }));
      k.ring(o(PHX, { x: k.x, y: k.y, R: 320, n: 3, w: 30, d: 0.95 })); k.pillar(o(GOLD, { x: k.x, y: k.y, h: 700, w: 44, d: 0.95, life: 0.7 }));
      k.motes(o(PHX, { x: k.x, y: k.y - 40, n: 34, type: 'feather', spd: 380, g: 60, size: 9, col2: PHX.hi, ang: -Math.PI / 2, spread: 3, d: 0.97, life: 1.4 }));
    },
    kraken_page(k, s) { // an ink whirlpool opens under the frozen boss, kraken tentacles crush in on it and the whirlpool swallows the ground
      k.sum_book(o(GOLD, { x: k.x, y: k.y - 20, s: 40, lift: 90, life: 1.0 }));
      k.sum_ink(o(INK, { x: s.x, y: s.y, R: 270, spiral: true, d: 0.1, life: 2.0 }));
      k.sum_crest(o(INK, { x: s.x, y: s.y, R: 175, el: 'kraken', d: 0.1, life: 1.9 }));
      k.spires(o(FROST, { x: s.x, y: s.y, n: 6, R: 90, h: 160, wd: 16, shape: 'ice', d: 0.15, life: 1.0 }));
      k.sum_tent(o(INK, { x: s.x, y: s.y, R: 160, n: 8, h: 250, w: 26, crush: true, d: 0.25, life: 1.3 }));
      k.ring(o(INK, { x: s.x, y: s.y, R: 250, n: 3, w: 30, d: 0.8 })); k.flash(o(INK, { x: s.x, y: s.y, R: 290, d: 0.8 })); k.crack(o(INK, { x: s.x, y: s.y, R: 210, n: 9, d: 0.8 }));
      k.motes(o(INK, { x: s.x, y: s.y - 20, n: 28, type: 'rune', spd: 300, g: 100, size: 7, spread: TAU, d: 0.82 })); k.shake(0.7);
    },
    bestiary_stampede(k, s) { // all five creatures run side by side down five rune lanes (sprites, wyrm, roc, phoenix, kraken's ink) and the phoenix bursts over the pack
      const a = ang2(k.x, k.y, s.x, s.y), nx = -Math.sin(a), ny = Math.cos(a), L = Math.hypot(s.x - k.x, s.y - k.y) + 120, EL = [FIRE, FROST, STORM, PHX, INK], EN = ['fire', 'frost', 'storm', 'phoenix', 'kraken'];
      for (let i = 0; i < 5; i++) {
        const off = (i - 2) * 64, x0 = k.x + nx * off, y0 = k.y + ny * off, x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L, d = i * 0.04;
        k.sum_crest(o(EL[i], { x: x0, y: y0, R: 52, el: EN[i], d, life: 0.9 })); k.sum_runes(o(EL[i], { x: x0, y: y0 + 8, x2: x1, y2: y1 + 8, d, life: 1.0, gap: 9 }));
      }
      k.sum_sprite(o(FIRE, { x: k.x + nx * -128, y: k.y + ny * -128 - 20, x2: s.x + nx * -128, y2: s.y + ny * -128 - 10, n: 3, spread: 24, size: 14, d: 0.1, life: 0.7 }));
      k.serpent(o(FROST, { x: k.x + nx * -64, y: k.y + ny * -64 - 24, ang: a, len: L, amp: 28, w: 14, d: 0.14, life: 0.8 }));
      k.sum_bird(o(STORM, { x: k.x, y: k.y - 60, x2: k.x + Math.cos(a) * L, y2: k.y + Math.sin(a) * L - 60, s: 40, lift: 0, d: 0.18, life: 0.7 }));
      k.sum_bird(o(PHX, { x: k.x + nx * 64, y: k.y + ny * 64 - 60, x2: k.x + nx * 64 + Math.cos(a) * L, y2: k.y + ny * 64 + Math.sin(a) * L - 60, s: 44, lift: 0, d: 0.22, life: 0.7, flap: 13 }));
      k.sum_ink(o(INK, { x: s.x + nx * 128, y: s.y + ny * 128, R: 110, d: 0.45, life: 1.0 })); k.sum_tent(o(INK, { x: s.x + nx * 128, y: s.y + ny * 128, R: 60, n: 4, h: 150, w: 18, d: 0.5, life: 0.9, opt: true }));
      k.wings(o(PHX, { x: s.x, y: s.y, span: 250, d: 0.75, life: 0.9 })); k.flash(o(PHX, { x: s.x, y: s.y, R: 300, d: 0.78 }));
      k.motes(o(GOLD, { x: s.x, y: s.y - 30, n: 24, type: 'page', spd: 380, g: 60, size: 10, col: INK.col, spread: TAU, d: 0.78, life: 1.3 })); k.shake(0.5);
    },
    final_chapter(k, s) { // light layer under the engine's own moment: an ink pool, a gold rune circle and pages flying out of the book's blast
      k.sum_ink(o(INK, { x: s.x, y: s.y, R: 210, spiral: true, life: 1.7 }));
      k.sigil(o(GOLD, { x: s.x, y: s.y, R: 210, n: 7, d: 0.1, life: 1.8, hold: 0.8 }));
      k.sum_pages(o(INK, { x: s.x, y: s.y - 30, ang: 0, spread: TAU, n: 22, len: 260, twist: 2.4, size: 11, d: 0.4, life: 1.3 }));
      k.motes(o(GOLD, { x: s.x, y: s.y - 20, n: 18, type: 'rune', spd: 260, g: 60, size: 8, spread: TAU, d: 0.45, life: 1.2 }));
    },
  },
  routes: {
    bestiary_stampede: { title: 'BESTIARY STAMPEDE', sub: 'EVERY PAGE RUNS  ·  PACK FINISHER', sfx: 'ゴゴゴゴッ', kanji: '獣', seal: '書', rot: -0.08 },
    final_chapter: { title: 'THE FINAL CHAPTER', sub: 'THE BOOK SLAMS SHUT  ·  BOSS FINISHER', sfx: 'ドォォン', kanji: '終', seal: '書', rot: 0.06 },
    phoenix_page: { title: 'PHOENIX PAGE', sub: 'REBORN IN FLAME  ·  PACK FINISHER', sfx: 'ボォォッ', kanji: '炎', seal: '書', rot: -0.06 },
    kraken_page: { title: 'KRAKEN PAGE', sub: 'THE INK WHIRLPOOL  ·  BOSS FINISHER', sfx: 'ズズズズッ', kanji: '墨', seal: '書', rot: 0.07 },
  },
  notes: {
    fire_sprites: 'An ember-orange circle with a flame triangle opens, a rune line is written to the target and three flame spirits arc along it and burst.',
    frost_wyrm: 'A pale snowflake circle opens behind you, a cyan serpent coils along the aim and breathes a three-wave rime cone studded with ice spires.',
    thunder_roc: 'A violet storm circle opens, a feathered roc banks down the rune line and four lightning bolts strike behind it with rings and falling feathers.',
    turn_the_page: 'The grimoire flips open above you in a teal book circle, a ring of flipping pages spirals out with two page-edge cuts and gold runes for the empowered next summon.',
    legendary_page: 'A gold book opens; on a pack a phoenix streaks down the line on a rune road with fire wings, near a boss an ink whirlpool opens and kraken tentacles rise.',
    grimoire_unbound: 'The book tears open over a huge gold rune circle and an ink whirlpool; five element circles light up around it and a flame spirit, wyrm, roc, phoenix and kraken break out with a flurry of pages.',
    basic: 'Each swing throws a razor page with a teal or gold streak; the third swing snaps a small book shut with a ring, rays and gold runes.',
    wildfire: 'Six flame spirits dive onto the target from the caster, an ember circle opens under them and flame spires and embers burn the ground.',
    frozen_thunder: 'A cyan frost ribbon and a violet storm ribbon braid down to the target, ice spires rise and three lightning bolts strike through them.',
    elemental_rise: 'Three flame spirits fuse into a column of fire inside an ember circle, five flash punches land, then a slam cracks the floor.',
    storm_front: 'A roc flies down the line over a frost rune road while hail waves roll out and lightning bolts break through the snow.',
    glacier_coil: 'A cyclone of ice winds around the target, freezes into a hexagon block with tall ice spires, then a second breath cone follows.',
    firestorm_flight: 'A roc passes over the target and six fire meteors land across an ember circle, throwing embers with a hint of violet.',
    tri_element: 'Fire, ice and lightning each take one corner of a triangle drawn in gold runes, then three coloured rings and a starburst fire from the middle.',
    thunderhead: 'A dark storm cloud with violet flashes inside gathers above the target and rains hail, then three lightning bolts drop out of it.',
    living_inferno: 'Four flame claws close in on the target from four sides, then a violet lightning bolt detonates it into a fire starburst, embers and cracked floor.',
    wyrms_embrace: 'Three cyan ribbons coil around the target inside a frost hexagon, four violet bolts strike it, then the last breath bursts out as a cone.',
    phoenix_page: 'A gold book opens, a phoenix sweeps the line twice on a gold rune road with roc lightning in its wake, then bursts in a ring of fire, feathers and a gold pillar.',
    kraken_page: 'A huge ink whirlpool opens under the target with a teal spiral circle, ice spires and eight kraken tentacles that crush in, then rings and cracks spread out.',
    bestiary_stampede: 'Five coloured circles and rune lanes open side by side and a flame spirit swarm, wyrm, roc and phoenix race down them while an ink splash waits at the end, then the phoenix bursts.',
    final_chapter: 'A light layer under the big book finisher: a teal ink whirlpool, a gold seven-point rune circle, flying pages and gold runes.',
  },
};
