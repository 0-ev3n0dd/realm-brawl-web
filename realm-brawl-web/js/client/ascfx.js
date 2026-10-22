// Part B: the Ascended look + the Astral Echo VFX. Classic art, flashy light: an orbit of five stars and a soft
// class-coloured halo under an Ascended hero (cached glow sprites, no per-frame gradients), and for the Echo a star
// rune + pillar + motes in the class colour, then the strike flashes where it lands.
import { glowSprite, blit } from './sprite.js';
import { CLASSES } from '../sim/data/classes.js';
import { ASC_ULT } from '../sim/ascended.js';
const TAU = Math.PI * 2;
const colOf = (cls) => { const c = (CLASSES[cls] || {}).color || '#c9b6ff'; return /^#[0-9a-f]{6}$/i.test(c) ? c : '#c9b6ff'; };
export function drawAscAura(ctx, x, y, cls, t, rk = 1, lite = false) {
  const col = colOf(cls), R = Math.max(1, Math.min(5, rk | 0)), n = R >= 4 ? 7 : 5; // (Part D: the aura grows with the rank; A5 = Starborn)
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = (R >= 5 ? 0.5 : 0.35) + 0.1 * Math.sin(t * 2.4); blit(ctx, glowSprite(col, R >= 5 ? 52 : R >= 3 ? 44 : 40), x, y + 6);
  if (R >= 5) { ctx.globalAlpha = 0.3 + 0.1 * Math.sin(t * 3.1); blit(ctx, glowSprite('#ffe9a8', 30), x, y + 6); }
  for (let i = 0; i < n; i++) {
    const a = t * 1.3 + (i / n) * TAU, rx = 30, ry = 11, sx = x + Math.cos(a) * rx, sy = y + 8 + Math.sin(a) * ry, k = 0.6 + 0.4 * Math.sin(t * 5 + i);
    ctx.globalAlpha = 0.55 * k; blit(ctx, glowSprite('#fff4d6', 6), sx, sy);
    ctx.globalAlpha = k; ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(sx, sy, 1.8, 0, TAU); ctx.fill();
  }
  if (R >= 2) { // A2+: a second, counter-turning ring of class-coloured motes
    const m = R >= 4 ? 6 : 4;
    for (let i = 0; i < m; i++) { const a = -t * 0.9 + (i / m) * TAU, sx = x + Math.cos(a) * 40, sy = y + 8 + Math.sin(a) * 15; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 4 + i * 2); blit(ctx, glowSprite(col, 5), sx, sy); }
  }
  if (R >= 5) { // A5 Starborn: a turning eight-point star sigil on the ground + motes rising off it
    ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2.2; ctx.beginPath();
    for (let i = 0; i <= 16; i++) { const a = t * 0.4 + (i / 16) * TAU, r = i % 2 ? 20 : 46; const px = x + Math.cos(a) * r, py = y + 8 + Math.sin(a) * r * 0.36; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.stroke();
    if (!lite) for (let i = 0; i < 6; i++) { const ph = (t * 0.6 + i / 6) % 1, a = i * 2.39996, px = x + Math.cos(a) * 24, py = y + 8 - ph * 60; ctx.globalAlpha = 0.7 * (1 - ph); blit(ctx, glowSprite(i % 2 ? col : '#fff4d6', 4), px, py); }
  }
  ctx.restore();
}
/** Part D A5: the Starborn model trim: a starlit circlet over the head and twin shoulder stars (drawn over the model) */
export function drawAscTrim(ctx, x, y, cls, t, top = 30) {
  const col = colOf(cls), hy = y - top;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.85; ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, hy, 13, 4.5, 0, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, hy, 16, 6, 0, 0, TAU); ctx.stroke();
  for (let i = 0; i < 5; i++) { const a = t * 1.8 + (i / 5) * TAU, sx = x + Math.cos(a) * 13, sy = hy + Math.sin(a) * 4.5, k = 0.55 + 0.45 * Math.sin(t * 6 + i);
    ctx.globalAlpha = k; blit(ctx, glowSprite('#fff4d6', 5), sx, sy - (Math.sin(a) < 0 ? 2 : 0)); }
  for (const sx of [-1, 1]) { const px = x + sx * 13, py = y - top * 0.45, k = 0.6 + 0.4 * Math.sin(t * 4 + sx); ctx.globalAlpha = 0.9 * k; star4(ctx, px, py, 5 + 1.5 * k, '#fffbe8'); ctx.globalAlpha = 0.5 * k; blit(ctx, glowSprite(col, 8), px, py); }
  ctx.restore();
}
/** Part D (all ten heroes Ascended): the Constellation Mantle: a slow, faint constellation drawn behind any hero of the account */
export function drawAscMantle(ctx, x, y, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const P = []; for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.42 + Math.sin(t * 0.5 + i) * 0.03, r = 38 + (i % 2) * 12; P.push([x + Math.cos(a) * r, y - 14 + Math.sin(a) * r * 0.9]); }
  ctx.globalAlpha = 0.28; ctx.strokeStyle = '#c9e4ff'; ctx.lineWidth = 1; ctx.beginPath(); P.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
  P.forEach(([px, py], i) => { const k = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7); ctx.globalAlpha = 0.35 + 0.45 * k; blit(ctx, glowSprite('#dff1ff', 4), px, py); });
  ctx.restore();
}
function star4(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU - Math.PI / 2, q = i % 2 ? r * 0.3 : r; if (i) ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); else ctx.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } ctx.closePath(); ctx.fill(); }
/** the Astral Echo: fx + banner (fx = client/fx.js) */
export function ascUltFx(fx, ev, mine) {
  const col = colOf(ev.cls), U = ASC_ULT[ev.cls] || {};
  if (ev.shape === 'line') { for (let i = 0; i <= 6; i++) { const k = i / 6; fx.ring(ev.x + Math.cos(ev.ang) * ev.len * k, ev.y + Math.sin(ev.ang) * ev.len * k, ev.w * 0.6, col, 0.7, 5); } }
  else { fx.ring(ev.x, ev.y, ev.r, col, 0.9, 8); fx.ring(ev.x, ev.y, ev.r * 0.6, '#fff4d6', 0.7, 4); }
  fx.puffs(ev.x, ev.y, 18, col, 14, 160, 0.9); fx.sparks(ev.x, ev.y, -Math.PI / 2, 22, '#fff4d6', 520, Math.PI);
  if (mine) { fx.banner('ASTRAL ECHO', col, U.name || ev.name || '', 1.8, 34); fx.shake(0.5); }
}
/** Part D A3: an Astral skill variant was cast: a quick class-coloured star burst where it lands */
export function ascAltFx(fx, ev) {
  const col = colOf(ev.cls);
  if (ev.shape === 'line') { for (let i = 0; i <= 4; i++) { const k = i / 4; fx.ring(ev.x + Math.cos(ev.ang) * ev.len * k, ev.y + Math.sin(ev.ang) * ev.len * k, ev.w * 0.45, col, 0.45, 4); } }
  else { fx.ring(ev.x, ev.y, ev.r, col, 0.55, 5); if (ev.r0) fx.ring(ev.x, ev.y, ev.r0, '#fff4d6', 0.4, 3); }
  fx.sparks(ev.x, ev.y, -Math.PI / 2, 10, '#fff4d6', 360, Math.PI);
}
/** Part D A3: the variant's area while it gathers: a star rune in the class colour that fills toward impact */
export function drawAscAlt(ctx, a, t, cls) {
  const col = colOf(cls), k = Math.min(1, a.t / Math.max(1, a.delay)), live = a.t < a.delay + (a.pulses - 1) * a.every + 8;
  if (!live) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.fillStyle = col;
  if (a.shape === 'line') {
    const c = Math.cos(a.ang), s = Math.sin(a.ang), w = a.w / 2, L = a.len;
    ctx.globalAlpha = 0.18 + 0.25 * k; ctx.beginPath(); ctx.moveTo(a.x - s * w, a.y + c * w); ctx.lineTo(a.x + c * L - s * w, a.y + s * L + c * w); ctx.lineTo(a.x + c * L + s * w, a.y + s * L - c * w); ctx.lineTo(a.x + s * w, a.y - c * w); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.8; ctx.stroke();
  } else {
    const R = a.r, R0 = a.r0 || 0;
    ctx.globalAlpha = 0.16 + 0.22 * k; ctx.beginPath(); ctx.arc(a.x, a.y, R, 0, TAU); if (R0) { ctx.moveTo(a.x + R0, a.y); ctx.arc(a.x, a.y, R0, 0, TAU, true); } ctx.fill('evenodd');
    ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(a.x, a.y, R, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.7; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = (i % 2 ? 0.42 : 0.92) * R * (0.55 + 0.45 * k), an = t * 0.8 + (i / 10) * TAU; ctx.lineTo(a.x + Math.cos(an) * r, a.y + Math.sin(an) * r); } ctx.closePath(); ctx.stroke();
  }
  ctx.globalAlpha = 0.9; blit(ctx, glowSprite('#fff4d6', 10), a.x, a.y);
  ctx.restore();
}
