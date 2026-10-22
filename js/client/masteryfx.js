// Game loop B1 (2026-10-09): the Mastery emblem under a hero (rank 5 bronze, 10 silver, 15 gold, 20 prismatic sigil) +
// the Mastery pick / respec event FX. Drawn on the ground, under the hero (client/render.js). Cheap: a few arcs.
import { emblemOf, masteryOf } from '../sim/mastery.js';
const TAU = Math.PI * 2;
/** the emblem tier of a live player (null below rank 5); cached per kill / mxp change */
export function emblemFor(p) {
  const k = (p.kills | 0) + ':' + Math.floor(p.mxp || 0);
  if (p._emK !== k) { p._emK = k; const r = masteryOf(p).rank; p._em = emblemOf(r); p._emR = r; }
  return p._em;
}
export function drawMasteryEmblem(ctx, x, y, em, t, lite = false) {
  if (!em) return;
  const [rank, id, , col] = em, R = 27 + (rank >= 10 ? 3 : 0);
  ctx.save(); ctx.translate(x, y + 12); ctx.scale(1, 0.42);
  const hue = (t * 70) % 360, c = id === 'prism' ? `hsl(${hue},95%,72%)` : col;
  // the dark outline ring (classic outlined look) + the coloured band
  ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(43,36,51,.55)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  ctx.lineWidth = 3.5; ctx.strokeStyle = c; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  // turning rune ticks (4 bronze, 6 silver, 8 gold / prism)
  const n = rank >= 15 ? 8 : rank >= 10 ? 6 : 4, a0 = t * 0.6;
  ctx.globalAlpha = 0.95; ctx.fillStyle = c;
  for (let i = 0; i < n; i++) { const a = a0 + (i * TAU) / n; ctx.save(); ctx.rotate(a); ctx.translate(R, 0); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore(); }
  if (rank >= 10) { ctx.lineWidth = 1.8; ctx.globalAlpha = 0.6; ctx.setLineDash([5, 6]); ctx.lineDashOffset = -t * 18; ctx.beginPath(); ctx.arc(0, 0, R - 8, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  if (rank >= 15 && !lite) { // a soft glow pool
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, R + 8); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, id === 'prism' ? `hsla(${hue},95%,70%,.18)` : 'rgba(255,210,63,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R + 8, 0, TAU); ctx.fill();
  }
  ctx.restore();
  if (rank >= 15 && !lite) { // motes rising off the sigil (prismatic: rainbow)
    ctx.save();
    for (let i = 0; i < (id === 'prism' ? 5 : 3); i++) {
      const u = (t * 0.5 + i * 0.29) % 1, a = i * 2.1 + t * 0.7, px = x + Math.cos(a) * R * 0.9, py = y + 12 + Math.sin(a) * R * 0.38 - u * 34;
      ctx.globalAlpha = (1 - u) * 0.85; ctx.fillStyle = id === 'prism' ? `hsl(${(hue + i * 70) % 360},95%,72%)` : '#fff2b0';
      ctx.beginPath(); ctx.arc(px, py, 2.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}
/** the pick / respec event: a ring burst at the hero */
export function masteryEventFx(fx, ev, me, audio) {
  if (ev.type !== 'mastery') return;
  if (ev.op === 'pick') { fx.ring(ev.x, ev.y, 70, '#ffd23f', 0.5, 6); if (me) fx.text(ev.x, ev.y - 60, 'MASTERY +1%', { size: 18, color: '#ffd23f', vy: -50, pop: 1.4, life: 1.1 }); }
  else { fx.ring(ev.x, ev.y, 60, '#c9a2ff', 0.45, 5); if (me) fx.text(ev.x, ev.y - 60, 'PERKS RESET', { size: 17, color: '#c9a2ff', vy: -50, pop: 1.3, life: 1.1 }); }
  if (me && audio && audio.play) try { audio.play('levelup'); } catch { /* */ }
}
