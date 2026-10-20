// Part 0S: the Savage first-clear aura - "Black Sun Breaker": a slow ember ring at the hero's feet with a black-sun ember and its red
// corona circling, and sparks drifting up. Earned by the first-ever clear of any Savage (sim/savage.js clear keys); everyone sees it in
// co-op (net/protocol.js: bit 64 of the Ascension byte).
import { SAVAGE, SAVAGE_IDS } from '../sim/savage.js';
const TAU = Math.PI * 2;
/** has this hero's account cleared a Savage? (the local sim has unlocks; a co-op view carries svA) */
export const savageAura = (e) => !!(e && (e.svA || (e.unlocks && SAVAGE_IDS.some((k) => e.unlocks[SAVAGE[k].clear]))));
export function drawSavageAura(ctx, x, y, t, lite = false) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.28 + 0.08 * Math.sin(t * 2); ctx.beginPath(); ctx.ellipse(x, y + 10, 34, 12, 0, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = '#ff6a3d'; ctx.stroke();
  const a = t * 0.9, sx = x + Math.cos(a) * 34, sy = y + 10 + Math.sin(a) * 12;
  ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, TAU); ctx.fillStyle = '#ff3a1a'; ctx.fill();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(sx, sy, 4, 0, TAU); ctx.fillStyle = '#0a0406'; ctx.fill();
  if (!lite) { ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 4; i++) { const ph = (t * 0.6 + i / 4) % 1, px = x + Math.sin(i * 2.1 + t) * 22, py = y + 6 - ph * 46; ctx.globalAlpha = 0.5 * (1 - ph); ctx.fillStyle = '#ffb07a'; ctx.fillRect(px - 1.5, py - 1.5, 3, 3); } }
  ctx.restore();
}
