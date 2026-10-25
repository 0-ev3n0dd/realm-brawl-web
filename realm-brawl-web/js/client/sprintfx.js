// Dodge rework + sprint (2026-10-19), the client side shared by the PC and phone games:
//   sprintEnded   the sprint toggle ends on entering combat (any damage dealt / taken after it was armed)
//   evadedFx      a proper evade (sim event 'evaded'): a gold flash on the hero for the 0.3 s window + a burst + "EVADED"
//   drawEvadeGlow the gold flash itself (client/render.js, over the hero; any hero, so co-op allies see it too)
//   drawSprintFx  dust puffs and speed streaks at a sprinting hero's feet (classic outlined puffs, cheap)
//   dodgePips     the 3 charge pips (PC skill bar slot + the phone DODGE button)
import { DODGE } from '../sim/data/classes.js';
const TAU = Math.PI * 2;
export const EVADE_FLASH = 0.3; // s (= DODGE.evade ticks)
/** has combat started since the sprint was armed? (c: the input controller holding sprintOn) */
export function sprintEnded(p, c) {
  if (!p) return false;
  const k = Math.max(p.lastCombat ?? -1e9, p.lastHurt ?? -1e9);
  if (c._sprK == null) { c._sprK = k; return false; }
  if (k > c._sprK) { c._sprK = null; return true; }
  return false;
}
const FLASH = new Map(); // pid -> until (s, performance clock)
const nowS = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
export function evadedFx(fx, ev, me) {
  if (ev.shove) { // dodge pass 2: a timed evade cancelled a knockback / pull / shove (no i-frames: no gold glow)
    fx.ring(ev.x, ev.y, 60, '#bfe8ff', 0.3, 4); fx.text(ev.x, ev.y - 54, 'STEADY', { size: me ? 22 : 16, color: '#bfe8ff', vy: -60, pop: 1.4, life: 0.65 }); return;
  }
  FLASH.set(ev.pid, nowS() + EVADE_FLASH + 0.12); if (FLASH.size > 64) FLASH.clear();
  fx.ring(ev.x, ev.y, 70, '#ffd23f', 0.32, 7); fx.ring(ev.x, ev.y, 110, '#fff3b0', 0.4, 3);
  fx.sparks(ev.x, ev.y - 10, 0, 14, '#ffe27a', 420, Math.PI);
  fx.text(ev.x, ev.y - 54, 'EVADED', { size: me ? 24 : 18, color: '#ffd23f', vy: -70, pop: 1.6, life: 0.7 });
  if (me) fx.shake(0.08);
}
/** dodge pass 2: a timed Dodge broke a snare / freeze / root / the glass bubble early */
export function holdBreakFx(fx, ev, me) {
  fx.ring(ev.x, ev.y, 80, '#9fe8ff', 0.35, 6); fx.sparks(ev.x, ev.y - 12, 0, 18, '#dff8ff', 480, Math.PI);
  fx.text(ev.x, ev.y - 58, 'BROKE FREE', { size: me ? 24 : 18, color: '#9fe8ff', vy: -70, pop: 1.6, life: 0.8 }); if (me) fx.shake(0.1);
}
export const evadeFlashOn = (pid, t = nowS()) => { const u = FLASH.get(pid); return u != null && t < u ? (u - t) / (EVADE_FLASH + 0.12) : 0; };
export function drawEvadeGlow(ctx, x, y, k, t, lite = false) {
  if (!(k > 0)) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (!lite) { const g = ctx.createRadialGradient(x, y - 14, 4, x, y - 14, 46); g.addColorStop(0, `rgba(255,236,150,${0.75 * k})`); g.addColorStop(0.55, `rgba(255,200,60,${0.35 * k})`); g.addColorStop(1, 'rgba(255,200,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 14, 46, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = Math.min(1, k * 1.3); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y - 14, 22 + (1 - k) * 10, 30 + (1 - k) * 12, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#fff6d0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y - 14, 17, 25, 0, 0, TAU); ctx.stroke();
  for (let i = 0; i < 4; i++) { const a = t * 6 + (i * TAU) / 4; ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 26, y - 14 + Math.sin(a) * 34, 2.4, 0, TAU); ctx.fill(); }
  ctx.restore();
}
/** dust at the feet + streaks behind (ang = facing) */
export function drawSprintFx(ctx, x, y, ang, t, lite = false) {
  const bx = -Math.cos(ang), by = -Math.sin(ang);
  ctx.save();
  for (let i = 0; i < (lite ? 2 : 4); i++) {
    const u = (t * 2.6 + i * 0.25) % 1, d = 10 + u * 34, r = 4 + u * 7;
    ctx.globalAlpha = 0.55 * (1 - u); ctx.fillStyle = '#e8dcc0'; ctx.strokeStyle = 'rgba(43,36,51,.5)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x + bx * d + Math.sin(i * 2.1 + t * 9) * 5, y + 12 + by * d * 0.5 - u * 6, r, 0, TAU); ctx.fill(); ctx.stroke();
  }
  if (!lite) { ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) { const ox = -by * i * 9, oy = bx * i * 9, ph = (t * 5 + i) % 1; ctx.globalAlpha = 0.45 * (1 - ph); ctx.beginPath(); ctx.moveTo(x + ox + bx * (18 + ph * 10), y - 10 + oy + by * (18 + ph * 10)); ctx.lineTo(x + ox + bx * (40 + ph * 16), y - 10 + oy + by * (40 + ph * 16)); ctx.stroke(); } }
  ctx.restore();
}
/** charge pips over a dodge slot / button: full = gold, refilling = a filling ring */
export function dodgePips(ctx, cx, cy, R, p, sc = 1) {
  const n = DODGE.charges, have = Math.max(0, Math.min(n, p.dodgeN ?? n)), fillK = have < n ? (p.dodgeRe | 0) / DODGE.recharge : 0;
  const pr = 4.2 * sc, span = 0.55;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * span, x = cx + Math.cos(a) * (R + 3 * sc), y = cy + Math.sin(a) * (R + 3 * sc);
    ctx.beginPath(); ctx.arc(x, y, pr + 1.6 * sc, 0, TAU); ctx.fillStyle = 'rgba(43,36,51,.9)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, pr, 0, TAU); ctx.fillStyle = i < have ? '#ffd23f' : 'rgba(80,70,100,.9)'; ctx.fill();
    if (i === have && fillK > 0) { ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, pr, -Math.PI / 2, -Math.PI / 2 + TAU * fillK); ctx.closePath(); ctx.fillStyle = 'rgba(255,210,63,.6)'; ctx.fill(); }
  }
}
/** the dodge button's cooldown fraction: the short gap after a dash, or (no charge left) the next charge's refill */
export function dodgeCdK(p, D) { if ((p.dodgeN ?? DODGE.charges) <= 0) return 1 - (p.dodgeRe | 0) / DODGE.recharge; return D.dur + D.cd > 0 ? (p.dodgeCd | 0) / (D.dur + D.cd) : 0; }
/** PC skill-bar slot: the 3 charge pips in a row along the slot's bottom edge */
export function dodgePipsRow(ctx, cx, y, p, sc = 1) {
  const n = DODGE.charges, have = Math.max(0, Math.min(n, p.dodgeN ?? n)), fillK = have < n ? (p.dodgeRe | 0) / DODGE.recharge : 0, pr = 4.5 * sc, gap = 12 * sc;
  for (let i = 0; i < n; i++) {
    const x = cx + (i - (n - 1) / 2) * gap;
    ctx.beginPath(); ctx.arc(x, y, pr + 1.8 * sc, 0, TAU); ctx.fillStyle = 'rgba(43,36,51,.95)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, pr, 0, TAU); ctx.fillStyle = i < have ? '#ffd23f' : 'rgba(90,80,110,.95)'; ctx.fill();
    if (i === have && fillK > 0) { ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, pr, -Math.PI / 2, -Math.PI / 2 + TAU * fillK); ctx.closePath(); ctx.fillStyle = 'rgba(255,210,63,.65)'; ctx.fill(); }
  }
}
/** the SPRINT chip (armed: grey "waits for calm" in combat, gold while sprinting) */
export function sprintChip(ctx, x, y, p, armed, txt, sc = 1, key = '') {
  if (!armed && !p.sprint) return;
  const on = !!p.sprint, w = 74 * sc, h = 17 * sc;
  ctx.save(); ctx.beginPath(); const r = 6 * sc; ctx.moveTo(x - w / 2 + r, y - h / 2); ctx.arcTo(x + w / 2, y - h / 2, x + w / 2, y + h / 2, r); ctx.arcTo(x + w / 2, y + h / 2, x - w / 2, y + h / 2, r); ctx.arcTo(x - w / 2, y + h / 2, x - w / 2, y - h / 2, r); ctx.arcTo(x - w / 2, y - h / 2, x + w / 2, y - h / 2, r); ctx.closePath();
  ctx.fillStyle = on ? '#ffd23f' : 'rgba(60,52,84,.9)'; ctx.fill(); ctx.lineWidth = 2 * sc; ctx.strokeStyle = '#2b2433'; ctx.stroke(); ctx.restore();
  txt(ctx, on ? 'SPRINT ▸▸' : 'SPRINT · calm', x, y + 0.5 * sc, Math.round(10 * sc), on ? '#2b2433' : '#cfc6e6', 'center', 0);
}
