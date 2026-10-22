// The Astral Rift's own creatures (2026-10-15): bodies of their own instead of recoloured Wilds / Dunes ones.
// Classic look: ink outlines, flat shading with one light side, small glows (fxglow bloom) for the star / void parts.
// Drawn facing +x (art.js rotates by e.face); t = seconds (animation), col = the type colour (elites are re-tinted).
import { INK, circle, ellipse, shade, ENEMY_DRAW, ENEMY_ANIM } from './art.js';
import { bloom } from './fxglow.js';
const TAU = Math.PI * 2;
function star(ctx, x, y, r1, r2, n, rot, fill, lw = 2.5) {
  ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = rot + (i / (n * 2)) * TAU; i ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); }
}
function poly(ctx, pts, fill, lw = 3) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); } }
const wind = (e) => (e.state === 'wind' || e.state === 'cast' || e.state === 'slamwind' ? Math.min(1, (e.st || 0) / 30) : 0);

const DRAW = {
  /** Voidling: a hopping knot of void with a star-shaped maw and three motes circling it */
  voidling(ctx, e, t, col) {
    const r = e.r, hop = Math.abs(Math.sin(t * 7 + (e.id || 0))) * r * 0.35;
    ellipse(ctx, 0, r * 0.7, r * 0.9, r * 0.35, 'rgba(20,10,40,.35)', 0);
    ctx.save(); ctx.translate(0, -hop);
    star(ctx, 0, 0, r * 1.15, r * 0.82, 7, t * 0.8, col, 3);
    circle(ctx, 0, 0, r * 0.62, shade(col, -0.55), 0);
    star(ctx, r * 0.18, 0, r * 0.42, r * 0.18, 4, t * -2, '#fff4ff', 0); bloom(ctx, r * 0.18, 0, r * 1.1, '#d6b8ff', 0.55);
    for (let i = 0; i < 3; i++) { const a = t * 3 + i * TAU / 3; circle(ctx, Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.9, 2.4, '#ffe27a', 0); }
    ctx.restore();
  },
  /** Rift Stalker: a lean four-legged hunter with a ridge of void crystals and a torn, fading tail */
  riftstalker(ctx, e, t, col) {
    const r = e.r, run = Math.sin(t * 12 + (e.id || 0)), k = wind(e);
    ellipse(ctx, 0, r * 0.75, r * 1.4, r * 0.4, 'rgba(20,10,40,.3)', 0);
    for (let i = 0; i < 5; i++) { const x = -r * (1.1 + i * 0.45), y = Math.sin(t * 6 + i) * 3; ctx.globalAlpha = 0.6 - i * 0.11; circle(ctx, x, y, r * (0.42 - i * 0.06), '#6ae6ff', 0); }
    ctx.globalAlpha = 1;
    for (const s of [-1, 1]) for (const f of [-0.55, 0.55]) { ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(r * f, s * r * 0.35); ctx.lineTo(r * f + run * s * 5, s * r * 0.95); ctx.stroke(); }
    ellipse(ctx, 0, 0, r * 1.25, r * 0.62, col, 3.5);
    ellipse(ctx, -r * 0.1, -r * 0.18, r * 0.8, r * 0.26, shade(col, 0.25), 0);
    for (let i = 0; i < 4; i++) poly(ctx, [[-r * 0.7 + i * r * 0.42, -r * 0.1], [-r * 0.55 + i * r * 0.42, -r * (0.95 + (i % 2) * 0.25)], [-r * 0.4 + i * r * 0.42, -r * 0.1]], '#9ff3ff', 2);
    ctx.save(); ctx.translate(r * 1.15 + k * 6, 0); ellipse(ctx, 0, 0, r * 0.55, r * 0.42, shade(col, 0.1), 3);
    for (const s of [-1, 1]) { ctx.fillStyle = '#6ae6ff'; ctx.beginPath(); ctx.ellipse(r * 0.2, s * r * 0.16, r * 0.17, r * 0.05, s * 0.3, 0, TAU); ctx.fill(); }
    bloom(ctx, r * 0.2, 0, r * 0.7, '#6ae6ff', 0.5 + k * 0.5); ctx.restore();
  },
  /** Star Wisp: a five-point star of light in a slowly turning halo, its core flaring as it casts */
  starwisp(ctx, e, t, col) {
    const r = e.r, k = wind(e), pul = 1 + Math.sin(t * 5) * 0.08 + k * 0.25;
    bloom(ctx, 0, 0, r * 3.2 * pul, '#ffe9a8', 0.6 + k * 0.4);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,240,200,.75)'; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.arc(0, 0, r * 1.55, t, t + TAU); ctx.stroke(); ctx.setLineDash([]);
    star(ctx, 0, 0, r * 1.25 * pul, r * 0.55 * pul, 5, -Math.PI / 2 + t * 0.6, col, 3);
    star(ctx, 0, 0, r * 0.7 * pul, r * 0.3 * pul, 5, -Math.PI / 2 + t * 0.6, '#fffdf0', 0);
    circle(ctx, r * 0.15, -r * 0.1, 2, INK, 0); circle(ctx, r * 0.15, r * 0.2, 2, INK, 0);
  },
  /** Void Archer: a hooded star-cloak with a crescent bow of starlight */
  voidarcher(ctx, e, t, col) {
    const r = e.r, k = wind(e);
    ellipse(ctx, 0, r * 0.8, r, r * 0.35, 'rgba(20,10,40,.3)', 0);
    poly(ctx, [[-r * 1.1, -r * 0.9], [r * 0.4, -r * 0.7], [r * 0.6, r * 0.7], [-r * 1.1, r * 0.9], [-r * 0.7, 0]], shade(col, -0.45), 3.5);
    for (let i = 0; i < 6; i++) circle(ctx, -r * 0.8 + (i % 3) * r * 0.4, -r * 0.4 + ((i / 3) | 0) * r * 0.7, 1.4, '#e8f0ff', 0);
    circle(ctx, 0, 0, r * 0.62, col, 3);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(r * 0.12, 0, r * 0.38, -1.1, 1.1); ctx.fill();
    circle(ctx, r * 0.3, -r * 0.13, 2, '#9ff3ff', 0); circle(ctx, r * 0.3, r * 0.13, 2, '#9ff3ff', 0);
    ctx.save(); ctx.translate(r * 0.95, 0);
    ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(-r * 0.4, 0, r * 1.05, -1.0, 1.0); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#bff8ff'; ctx.beginPath(); ctx.arc(-r * 0.4, 0, r * 1.05, -1.0, 1.0); ctx.stroke();
    const dr = k * r * 0.5; ctx.strokeStyle = 'rgba(230,250,255,.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(r * 0.14, -r * 0.88); ctx.lineTo(-dr, 0); ctx.lineTo(r * 0.14, r * 0.88); ctx.stroke();
    if (k > 0) { ctx.strokeStyle = '#6ae6ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-dr, 0); ctx.lineTo(r * 0.9, 0); ctx.stroke(); bloom(ctx, r * 0.9, 0, r * 0.9, '#6ae6ff', k); }
    ctx.restore();
  },
  /** Astral Knight: night-blue plate traced with constellations, a star crest and a starsteel blade */
  astralknight(ctx, e, t, col) {
    const r = e.r, k = wind(e);
    ellipse(ctx, 0, r * 0.75, r * 1.05, r * 0.38, 'rgba(10,10,40,.32)', 0);
    ctx.save(); ctx.rotate(-0.5 - k * 0.9); ctx.translate(r * 0.55, r * 0.75);
    poly(ctx, [[0, -4], [r * 1.7, -2.5], [r * 1.95, 0], [r * 1.7, 2.5], [0, 4]], '#dfe8ff', 2.5); bloom(ctx, r * 1.2, 0, r * 0.8, '#9fb8ff', 0.35 + k * 0.5);
    ctx.restore();
    circle(ctx, -r * 0.2, -r * 0.55, r * 0.45, shade(col, 0.2), 3); circle(ctx, -r * 0.2, r * 0.55, r * 0.45, shade(col, 0.2), 3);
    circle(ctx, 0, 0, r * 0.82, col, 3.5);
    const P = [[-0.45, -0.3], [-0.05, -0.45], [0.3, -0.1], [0.05, 0.35], [-0.4, 0.3]];
    ctx.strokeStyle = 'rgba(200,220,255,.85)'; ctx.lineWidth = 1.3; ctx.beginPath(); P.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r))); ctx.stroke();
    for (const [x, y] of P) circle(ctx, x * r, y * r, 2.2, '#fff4c0', 0);
    circle(ctx, r * 0.35, 0, r * 0.42, shade(col, 0.35), 3); ctx.fillStyle = '#9ff3ff'; ctx.fillRect(r * 0.5, -r * 0.2, r * 0.08, r * 0.4);
    star(ctx, r * 0.05, 0, r * 0.3, r * 0.13, 4, t, '#ffe27a', 2);
  },
  /** Voidglass Golem: faceted black glass around a swirling void core, shards orbiting its shoulders */
  voidgolem(ctx, e, t, col) {
    const r = e.r, k = wind(e);
    ellipse(ctx, 0, r * 0.8, r * 1.2, r * 0.4, 'rgba(10,5,30,.35)', 0);
    for (const s of [-1, 1]) poly(ctx, [[r * 0.2, s * r * 0.7], [r * 0.95 + k * 6, s * r * 0.95], [r * 0.75 + k * 6, s * r * 1.35], [-r * 0.1, s * r * 1.15]], shade(col, 0.15), 3);
    const H = Array.from({ length: 6 }, (_, i) => [Math.cos(i * TAU / 6 + 0.5) * r * 0.95, Math.sin(i * TAU / 6 + 0.5) * r * 0.95]);
    poly(ctx, H, col, 4);
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(220,200,255,.45)'; ctx.beginPath(); for (const [x, y] of H) { ctx.moveTo(0, 0); ctx.lineTo(x, y); } ctx.stroke();
    poly(ctx, [H[4], H[5], [0, 0]], shade(col, 0.35), 0);
    circle(ctx, 0, 0, r * 0.38, '#140a26', 2.5);
    ctx.save(); ctx.rotate(t * 3); for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.strokeStyle = '#c9a8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r * 0.1, 0, r * 0.2, 0, 2.2); ctx.stroke(); } ctx.restore();
    bloom(ctx, 0, 0, r * (1 + k), '#b48cff', 0.45 + k * 0.5);
    for (let i = 0; i < 4; i++) { const a = t * 1.6 + i * TAU / 4; poly(ctx, [[Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45 - 5], [Math.cos(a) * r * 1.45 + 4, Math.sin(a) * r * 1.45 + 3], [Math.cos(a) * r * 1.45 - 4, Math.sin(a) * r * 1.45 + 3]], '#e0d0ff', 1.5); }
  },
  /** Nyxara, the Void Matriarch: a moth-winged void queen, six spindle legs, a crown of horns, an eye-studded abdomen */
  nyxara(ctx, e, t, col) {
    const r = e.r, k = wind(e), fl = Math.sin(t * 3) * 0.12;
    ellipse(ctx, 0, r * 0.6, r * 1.5, r * 0.6, 'rgba(20,0,40,.35)', 0);
    for (const s of [-1, 1]) { ctx.save(); ctx.scale(1, s); ctx.rotate(fl + k * 0.3);
      poly(ctx, [[-r * 0.2, r * 0.2], [-r * 1.1, r * 1.6], [-r * 0.1, r * 2.0], [r * 0.6, r * 1.2]], shade(col, -0.35), 3.5);
      ctx.fillStyle = 'rgba(255,226,122,.85)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-r * 0.25 + i * r * 0.18, r * (0.9 + i * 0.18), 2.2, 0, TAU); ctx.fill(); }
      circle(ctx, -r * 0.2, r * 1.3, r * 0.22, '#6ae6ff', 2); ctx.restore(); }
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const a = s * (0.7 + i * 0.55), w = Math.sin(t * 6 + i * 2) * 0.12; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); ctx.lineTo(Math.cos(a + w) * r * 1.25, Math.sin(a + w) * r * 1.25); ctx.lineTo(Math.cos(a + w * 2) * r * 1.6 + r * 0.2, Math.sin(a + w * 2) * r * 1.5); ctx.stroke(); }
    ellipse(ctx, -r * 0.65, 0, r * 0.8, r * 0.62, shade(col, -0.2), 3.5);
    for (let i = 0; i < 5; i++) { const x = -r * (0.4 + (i % 3) * 0.28), y = (i - 2) * r * 0.2; circle(ctx, x, y, 3.5, '#ffe27a', 1.5); circle(ctx, x + 0.8, y, 1.4, INK, 0); }
    ellipse(ctx, r * 0.2, 0, r * 0.55, r * 0.48, col, 3.5);
    for (const s of [-1, 1]) poly(ctx, [[r * 0.45, s * r * 0.2], [r * 0.9, s * r * 0.75], [r * 0.55, s * r * 0.35]], '#2a1a44', 2.5);
    poly(ctx, [[r * 0.55, -r * 0.08], [r * 1.0, 0], [r * 0.55, r * 0.08]], '#2a1a44', 2);
    circle(ctx, r * 0.55, -r * 0.16, 3, '#ff7ad9', 0); circle(ctx, r * 0.55, r * 0.16, 3, '#ff7ad9', 0);
    bloom(ctx, -r * 0.6, 0, r * (1.6 + k), '#b06cff', 0.35 + k * 0.5);
  },
  /** The Shattered Orrery: a cracked golden sun turning inside three orbit rings, each carrying its planet */
  orrery(ctx, e, t, col) {
    const r = e.r, k = wind(e);
    ellipse(ctx, 0, r * 0.7, r * 1.4, r * 0.5, 'rgba(40,20,0,.28)', 0);
    const rings = [[1.25, 0.55, 0.4, '#9ff3ff'], [1.6, 0.7, -0.9, '#ff9a4a'], [1.95, 0.9, 1.6, '#c9a8ff']];
    for (const [rx, ry, rot] of rings) { ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.ellipse(0, 0, r * rx, r * ry, rot, 0, TAU); ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#e6c46a'; ctx.stroke(); }
    bloom(ctx, 0, 0, r * (2.2 + k), '#ffe27a', 0.55 + k * 0.45);
    circle(ctx, 0, 0, r * 0.8, col, 4);
    ctx.lineWidth = 2.5; ctx.strokeStyle = shade(col, -0.45); ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.3); ctx.lineTo(-r * 0.05, r * 0.05); ctx.lineTo(r * 0.3, -r * 0.45); ctx.moveTo(-r * 0.05, r * 0.05); ctx.lineTo(r * 0.1, r * 0.6); ctx.stroke();
    circle(ctx, -r * 0.25, -r * 0.25, r * 0.22, '#fff6d0', 0);
    star(ctx, r * 0.2, 0, r * 0.32, r * 0.16, 8, t, '#fffdf0', 2);
    rings.forEach(([rx, ry, rot, pc], i) => { const a = t * (1.2 - i * 0.3) + i * 2, x = Math.cos(a) * r * rx, y = Math.sin(a) * r * ry, X = x * Math.cos(rot) - y * Math.sin(rot), Y = x * Math.sin(rot) + y * Math.cos(rot); circle(ctx, X, Y, r * (0.2 + i * 0.04), pc, 3); circle(ctx, X - 2, Y - 2, r * 0.07, 'rgba(255,255,255,.7)', 0); });
  },
  /** Zerath, the Rift Herald: a winged herald in torn rift-silk with a cleaver of broken sky and a cracked halo */
  zerath(ctx, e, t, col) {
    const r = e.r, k = wind(e), fl = Math.sin(t * 2.5) * 0.1;
    ellipse(ctx, 0, r * 0.65, r * 1.45, r * 0.55, 'rgba(0,10,30,.35)', 0);
    for (const s of [-1, 1]) { ctx.save(); ctx.scale(1, s); ctx.rotate(fl);
      poly(ctx, [[-r * 0.3, r * 0.3], [-r * 1.6, r * 1.1], [-r * 1.0, r * 1.25], [-r * 1.4, r * 1.6], [-r * 0.6, r * 1.5], [-r * 0.7, r * 1.9], [r * 0.1, r * 0.8]], '#1a2a4a', 3.5);
      ctx.strokeStyle = '#6ae6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.4); ctx.lineTo(-r * 1.2, r * 1.3); ctx.moveTo(-r * 0.2, r * 0.6); ctx.lineTo(-r * 0.6, r * 1.6); ctx.stroke(); ctx.restore(); }
    poly(ctx, [[-r * 0.9, -r * 0.5], [r * 0.3, -r * 0.6], [r * 0.5, r * 0.6], [-r * 0.9, r * 0.5], [-r * 1.2, 0]], shade(col, -0.5), 3.5);
    circle(ctx, 0, 0, r * 0.6, col, 3.5);
    ctx.save(); ctx.rotate(0.6 - k * 1.6); ctx.translate(r * 0.4, r * 0.55);
    poly(ctx, [[0, -6], [r * 1.5, -r * 0.35], [r * 1.75, r * 0.05], [r * 1.35, r * 0.3], [0, 6]], '#0d1830', 3);
    ctx.strokeStyle = '#bff8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r * 0.2, -2); ctx.lineTo(r * 0.7, -r * 0.15); ctx.lineTo(r * 1.0, r * 0.05); ctx.lineTo(r * 1.5, -r * 0.2); ctx.stroke();
    bloom(ctx, r * 1.1, 0, r * 0.9, '#6ae6ff', 0.4 + k * 0.6); ctx.restore();
    circle(ctx, r * 0.35, 0, r * 0.36, '#d8e6ff', 3);
    ctx.fillStyle = '#6ae6ff'; ctx.fillRect(r * 0.48, -r * 0.16, r * 0.1, r * 0.32);
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(-r * 0.1, 0, r * 0.95, 0.4, 2.6); ctx.arc(-r * 0.1, 0, r * 0.95, 3.0, 5.9); ctx.stroke();
    bloom(ctx, -r * 0.1, 0, r * 1.6, '#6ae6ff', 0.3 + k * 0.4);
  },
};
for (const [k, f] of Object.entries(DRAW)) ENEMY_DRAW[k] = f;
// idle sprite caching like the other mobs (art.js ENEMY_ANIM: [cycle speed, frames]); bosses draw live
Object.assign(ENEMY_ANIM, { voidling: [7, 6], riftstalker: [12, 6], starwisp: [5, 6], voidarcher: [3, 4], astralknight: [3, 4], voidgolem: [3, 6] });
