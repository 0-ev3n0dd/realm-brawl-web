// The Glowmire Hollow (the Wilds' dungeon, 2026-10-18) + Vharok's Stormcrown Tor (its Trial / Extreme), classic
// code-drawn style: three mossy glowcap grottoes strung on a root path, then the Moonlit Bower (Lumivex), and,
// south of it, the storm-lashed hilltop Tor (Vharok). Ground, telegraphs (rings / circles / rects / cones / safe
// lanterns / the gale wall / the Eye of the Storm), spore pods, burning dust lanes, the chest + doors, the HUD
// tracker + boss bar, the minimap, the glow event FX and the new mobs. State comes from packGlow (local sim,
// memoised per tick) or the co-op snapshot (sim.glowV).
import { INK, circle, rrect, star, shade, ENEMY_DRAW, ENEMY_ANIM } from './art.js';
import { bloom } from './fxglow.js';
import { drawTele, drawLegend } from './telefx.js';
import { lgrad, ball, ink } from './dunesfx.js';
import { HOLLOW_ROOMS, BOWER, TOR, HOLLOW_BOUNDS as HB, hollowDoor, inHollowArea, inTorArea } from '../sim/glowconst.js';
import { packGlow, FIGHTS } from '../sim/glowmire.js';

const TAU = Math.PI * 2, FONT = "'Lilita One', sans-serif", LA = -Math.PI * 0.75;
const H = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const X0 = -900, X1 = 900;
export const glowVisible = (view) => view.x1 > X0 - 300 && view.x0 < X1 + 300 && view.y1 > HB.y0 - 300 && view.y0 < HB.y1 + 300;
let memo = { k: -1, s: null, v: null };
export function glowState(sim) {
  if (sim.glowV !== undefined) return sim.glowV || null;
  if (memo.s === sim && memo.k === sim.tick) return memo.v;
  memo = { k: sim.tick, s: sim, v: packGlow(sim) };
  return memo.v;
}
const ALL = [...HOLLOW_ROOMS, BOWER, TOR];
const inView = (R, view, pad = 200) => !(R.x + R.r + pad < view.x0 || R.x - R.r - pad > view.x1 || R.y + R.r + pad < view.y0 || R.y - R.r - pad > view.y1);
const label = (ctx, s, x, y, col) => { ctx.font = `14px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y); };

// ------------------------------------------------------------------ ground
export function drawGlowGround(ctx, view, t, sim) {
  if (!glowVisible(view)) return false;
  const T = glowState(sim);
  const x0 = Math.max(view.x0, X0 - 300), x1 = Math.min(view.x1, X1 + 300), y0 = Math.max(view.y0, HB.y0 - 300), y1 = Math.min(view.y1, HB.y1 + 300);
  if (x1 > x0 && y1 > y0) {
    const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#07130c'); g.addColorStop(1, '#0b1a14'); ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    const S = 130; // drifting fireflies in the dark
    for (let gx = Math.floor(x0 / S) * S; gx < x1; gx += S) for (let gy = Math.floor(y0 / S) * S; gy < y1; gy += S) {
      const h = H(gx / S, gy / S); if (h > 0.4) continue;
      const sx = gx + H(gy, gx) * S + Math.sin(t * (0.6 + h) + h * 9) * 12, sy = gy + H(gx + 3, gy) * S + Math.cos(t * 0.8 + h * 7) * 10;
      ctx.globalAlpha = 0.25 + 0.5 * h * (0.6 + 0.4 * Math.sin(t * 3 + h * 30)); ctx.fillStyle = h < 0.12 ? '#e9ff9a' : '#7fe0a0'; ctx.fillRect(sx, sy, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
  }
  // the root path joining the grottoes to the Bower (and the stair down to the Tor)
  ctx.save(); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, HOLLOW_ROOMS[0].y); ctx.lineTo(0, BOWER.y); ctx.lineWidth = 150; ctx.strokeStyle = '#1c2e1c'; ctx.stroke(); ctx.lineWidth = 110; ctx.strokeStyle = '#33502e'; ctx.stroke();
  ctx.setLineDash([24, 46]); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(201,242,122,.35)'; ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  HOLLOW_ROOMS.forEach((R, i) => { if (inView(R, view)) grotto(ctx, R, i, T, t); });
  if (inView(BOWER, view)) bower(ctx, T, t);
  if (inView(TOR, view)) tor(ctx, T, t);
  return true;
}
function grotto(ctx, R, i, T, t) {
  bloom(ctx, R.x, R.y, R.r + 170, '#4c8f3a', 0.25);
  circle(ctx, R.x, R.y, R.r + 34, '#24381e', 5);
  const g = ctx.createRadialGradient(R.x - R.r * 0.3, R.y - R.r * 0.3, 20, R.x, R.y, R.r); g.addColorStop(0, '#6f9a4a'); g.addColorStop(0.7, '#4a7334'); g.addColorStop(1, '#2f4f24');
  circle(ctx, R.x, R.y, R.r, g, 4);
  ctx.save(); ctx.beginPath(); ctx.arc(R.x, R.y, R.r, 0, TAU); ctx.clip();
  for (let k = 0; k < 26; k++) { const a = H(i, k) * TAU, rr = R.r * (0.15 + H(k, i) * 0.8), x = R.x + Math.cos(a) * rr, y = R.y + Math.sin(a) * rr; ctx.globalAlpha = 0.35; circle(ctx, x, y, 10 + H(k + 2, i) * 26, '#3b5f2a', 0); }
  ctx.globalAlpha = 1;
  if (i === 1) for (let k = 0; k < 5; k++) { const a = k * 1.3 + 0.4, x = R.x + Math.cos(a) * R.r * 0.55, y = R.y + Math.sin(a) * R.r * 0.55; ctx.beginPath(); ctx.ellipse(x, y, 70, 38, a, 0, TAU); ctx.fillStyle = 'rgba(40,90,90,.55)'; ctx.fill(); }
  ctx.restore();
  for (let k = 0; k < 14; k++) { // glowcaps round the rim
    const a = (k / 14) * TAU + i, x = R.x + Math.cos(a) * (R.r + 8), y = R.y + Math.sin(a) * (R.r + 8), s = 10 + H(k, i + 4) * 10, pu = 0.6 + 0.4 * Math.sin(t * 2 + k);
    bloom(ctx, x, y - s, s * 3, '#c9f27a', 0.25 * pu);
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x - 3, y - s, 6, s); ctx.beginPath(); ctx.ellipse(x, y - s, s, s * 0.6, 0, Math.PI, 0); ctx.fillStyle = k % 3 ? '#c9f27a' : '#7ff0d8'; ctx.fill(); ink(ctx, 2);
  }
  const D = hollowDoor(i), open = T && T.f === 'lumivex' && T.room === i && T.door;
  ctx.save(); ctx.translate(D.x, D.y);
  rrect(ctx, -54, -40, 108, 80, 30); ctx.fillStyle = open ? '#e9ffb0' : '#3d5a2a'; ctx.fill(); ink(ctx, 4);
  if (open) { bloom(ctx, 0, 0, 120, '#c9f27a', 0.7 + 0.3 * Math.sin(t * 4)); star(ctx, 0, 0, 16, '#ffffff', 2); }
  else for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * 26, -34); ctx.quadraticCurveTo(k * 26 + 14, 0, k * 26, 34); ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 7; ctx.stroke(); }
  ctx.restore();
  label(ctx, R.name.toUpperCase(), R.x, R.y - R.r - 18, '#d8ff9a');
}
function bower(ctx, T, t) {
  const R = BOWER;
  bloom(ctx, R.x, R.y, R.r * 1.9, '#8fa8ff', 0.3);
  circle(ctx, R.x, R.y, R.r + 40, '#1f2440', 5);
  const g = ctx.createRadialGradient(R.x, R.y, 30, R.x, R.y, R.r); g.addColorStop(0, '#6a7fb0'); g.addColorStop(0.6, '#3e4f7a'); g.addColorStop(1, '#283456'); circle(ctx, R.x, R.y, R.r, g, 4);
  for (const rr of [R.r * 0.3, R.r * 0.6, R.r * 0.9]) { ctx.beginPath(); ctx.arc(R.x, R.y, rr, 0, TAU); ctx.strokeStyle = 'rgba(220,230,255,.18)'; ctx.lineWidth = 5; ctx.stroke(); }
  // a full moon reflected in the floor
  ctx.save(); ctx.globalAlpha = 0.4 + 0.1 * Math.sin(t); circle(ctx, R.x, R.y, 90, '#eef3ff', 0); ctx.restore();
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU, x = R.x + Math.cos(a) * (R.r - 30), y = R.y + Math.sin(a) * (R.r - 30); bloom(ctx, x, y, 60, '#ffe9a0', 0.35); circle(ctx, x, y, 12, '#ffe9a0', 2.5); }
  label(ctx, R.name.toUpperCase(), R.x, R.y - R.r - 22, '#cfd8ff');
  void T;
}
function tor(ctx, T, t) {
  const R = TOR, Bd = T && T.b && T.f !== 'lumivex' ? T.b : null;
  bloom(ctx, R.x, R.y, R.r * 1.8, '#6fa8ff', 0.25);
  circle(ctx, R.x, R.y, R.r + 44, '#2a2a33', 5);
  const g = ctx.createRadialGradient(R.x, R.y, 40, R.x, R.y, R.r); g.addColorStop(0, '#7b8a6a'); g.addColorStop(0.7, '#5a684c'); g.addColorStop(1, '#3d4636'); circle(ctx, R.x, R.y, R.r, g, 4);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, x = R.x + Math.cos(a) * (R.r + 14), y = R.y + Math.sin(a) * (R.r + 14); ctx.beginPath(); ctx.moveTo(x - 14, y + 10); ctx.lineTo(x - 8, y - 38); ctx.lineTo(x + 9, y - 30); ctx.lineTo(x + 14, y + 10); ctx.closePath(); ctx.fillStyle = '#6d6f7a'; ctx.fill(); ink(ctx, 2.5); }
  // crack runes on the summit
  ctx.save(); ctx.strokeStyle = 'rgba(160,210,255,.35)'; ctx.lineWidth = 3;
  for (let k = 0; k < 6; k++) { const a = k * 1.05; ctx.beginPath(); ctx.moveTo(R.x + Math.cos(a) * 80, R.y + Math.sin(a) * 80); ctx.lineTo(R.x + Math.cos(a + 0.2) * 260, R.y + Math.sin(a + 0.2) * 260); ctx.lineTo(R.x + Math.cos(a - 0.1) * 420, R.y + Math.sin(a - 0.1) * 420); ctx.stroke(); }
  ctx.restore();
  if (Bd && Bd.eye) { // the Eye of the Storm: everything outside the calm is the storm
    ctx.save(); ctx.beginPath(); ctx.arc(R.x, R.y, R.r + 60, 0, TAU); ctx.arc(R.x, R.y, Bd.eye, 0, TAU, true); ctx.fillStyle = `rgba(40,60,110,${0.45 + 0.1 * Math.sin(t * 5)})`; ctx.fill('evenodd');
    ctx.beginPath(); ctx.arc(R.x, R.y, Bd.eye, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = '#bfe3ff'; ctx.setLineDash([18, 12]); ctx.lineDashOffset = -t * 60; ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }
  label(ctx, (T && T.f === 'vharokx' ? 'THE STORMCROWN TOR · EXTREME' : R.name.toUpperCase()), R.x, R.y - R.r - 26, '#bfe3ff');
}

// ------------------------------------------------------------------ under the characters: pods, lanes, chest, telegraphs
export function drawGlowUnder(ctx, sim, local, t) {
  const T = glowState(sim);
  if (!T) return;
  for (const [x, y, ct, d] of T.pods || []) {
    const k = Math.min(1, ct / Math.max(1, d));
    ctx.save(); ctx.globalAlpha = 0.3 + 0.4 * k; circle(ctx, x, y, 80, 'rgba(201,242,122,.25)', 0);
    ctx.beginPath(); ctx.arc(x, y, 80, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = '#c9f27a'; ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 80 * k, 0, TAU); ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.globalAlpha = 1; ball(ctx, x, y - 10, 16 + 6 * k, '#b6e05a', LA, 2.6, 0.4); ctx.restore();
  }
  if (T.chest) { const c = T.chest; bloom(ctx, c.x, c.y, 90, '#c9f27a', 0.5 + 0.2 * Math.sin(t * 3)); rrect(ctx, c.x - 30, c.y - 20, 60, 40, 8); ctx.fillStyle = c.open ? '#6b4a2a' : '#8a5f34'; ctx.fill(); ink(ctx, 3); ctx.fillStyle = '#c9f27a'; ctx.fillRect(c.x - 30, c.y - 6, 60, 8); }
  const Bd = T.b; if (!Bd) return;
  for (const [x, y, ang, len, w] of Bd.lanes || []) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = 0.45 + 0.15 * Math.sin(t * 8); ctx.fillStyle = '#ff9a3a'; ctx.fillRect(0, -w / 2, len, w); ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2; ctx.strokeRect(0, -w / 2, len, w); ctx.restore(); }
  if (Bd.gale && Bd.gale.t >= 0) { // wind streaks across the Tor
    const A = TOR, cx = Math.cos(Bd.gale.ang), cy = Math.sin(Bd.gale.ang);
    ctx.save(); ctx.strokeStyle = 'rgba(220,240,255,.5)'; ctx.lineWidth = 3;
    for (let k = 0; k < 30; k++) { const u = ((H(k, 7) * 1200 + t * 700) % 1200) - 600, v = (H(7, k) - 0.5) * 1100, x = A.x + cx * u - cy * v, y = A.y + cy * u + cx * v; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cx * 60, y + cy * 60); ctx.stroke(); }
    ctx.restore();
  }
  for (const te of Bd.tele || []) tele(ctx, te, t);
  void local;
}
function tele(ctx, te, t) { // (Part A1: the shared renderer + colour grammar, client/telefx.js)
  const A = Math.hypot(te.x - TOR.x, te.y - TOR.y) < TOR.r + 400 ? TOR : BOWER;
  drawTele(ctx, te, t, A);
  if (te.k === 'rod' && !te.done) { ctx.save(); ctx.fillStyle = '#d8e6ff'; ctx.fillRect(te.x - 4, te.y - 70, 8, 70); star(ctx, te.x, te.y - 76, 10, '#bfe3ff', 1.6); ctx.restore(); }
}
// ------------------------------------------------------------------ HUD (screen space)
const BOSS_NAME = { lumivex: 'Lumivex, the Moth Matriarch', vharok: 'Vharok, the Stormhorn', vharokx: 'Vharok, the Stormhorn · EXTREME' };
const BOSS_TYPE = { lumivex: 'lumivex', vharok: 'trvharok', vharokx: 'trvharokx' };
export function drawGlowHud(ctx, sim, p, w, h, txt, bar) {
  const T = glowState(sim);
  if (!T || !p || !(inHollowArea(p.x, p.y) || inTorArea(p.x, p.y))) return 0;
  let y = 92;
  if (T.st === 'room' || T.st === 'clear') {
    txt(ctx, `Grotto ${T.room + 1}/3 · ${(HOLLOW_ROOMS[T.room] || {}).name || ''}`, w / 2, y + 18, 20, '#fff', 'center', 4);
    txt(ctx, T.st === 'clear' ? 'CLEARED: take the glowing root-door' : `Wave ${Math.max(1, T.wave)}/${T.nw}`, w / 2, y + 42, 16, T.st === 'clear' ? '#7dffb0' : '#d8ff9a', 'center', 3);
    if (T.ch) {
      const cw = 320, cx = w / 2 - cw / 2, cy = y + 56, pod = T.ch.k === 'pod', done = pod ? T.ch.done : (T.ch.done || T.ch.n >= T.ch.need);
      rrect(ctx, cx, cy, cw, 40, 10); ctx.fillStyle = 'rgba(30,43,30,.8)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = done ? '#7dffb0' : pod ? '#ff8a7a' : '#d8ff9a'; ctx.stroke();
      txt(ctx, `GLOWCAP CHEST · ${T.ch.text}`, cx + 12, cy + 17, 13, done ? '#7dffb0' : '#efffd0', 'left', 3);
      if (pod) txt(ctx, `Pod hits ${T.ch.n}/${T.ch.need}`, cx + 12, cy + 33, 12, T.ch.n > T.ch.need ? '#ff5e5b' : '#fff', 'left', 3);
      else for (let i = 0; i < T.ch.need; i++) { const px = cx + 14 + i * Math.min(24, (cw - 28) / T.ch.need); circle(ctx, px + 6, cy + 30, 5.5, i < T.ch.n ? (done ? '#7dffb0' : '#d8ff9a') : 'rgba(255,255,255,.18)', 1.6); }
      y = cy + 44;
    } else y += 52;
  } else if (T.b) {
    const Bd = T.b, b = sim.enemies.find((e) => e.type === BOSS_TYPE[T.f] && !e.dead);
    const bbw = Math.min(640, w * 0.52), bbx = w / 2 - bbw / 2, bby = y, F = FIGHTS[T.f] || {};
    if (Bd.st === 'victory') { txt(ctx, T.f === 'lumivex' ? 'THE MATRIARCH FALLS' : 'THE STORM BREAKS', w / 2, bby - 4, 20, '#d8ff9a', 'center', 4); txt(ctx, 'Grab the loot · the exit is back the way you came', w / 2, bby + 18, 15, '#fff', 'center', 3); return bby + 30; }
    if (Bd.st === 'wipe') { txt(ctx, 'WIPED · regroup at the entrance', w / 2, bby + 10, 20, '#ff8a7a', 'center', 4); return bby + 30; }
    txt(ctx, BOSS_NAME[T.f] || '', w / 2, bby - 4, 22, F.col || '#fff', 'center', 4);
    if (Bd.st === 'pull') { txt(ctx, `Engaging in ${Math.ceil(Bd.pull / 60)}…`, w / 2, bby + 24, 18, '#fff', 'center', 3); drawLegend(ctx, w - 250, bby + 150); }
    else if (b) {
      bar(ctx, bbx, bby + 10, bbw, 22, b.hp / b.maxHp, Bd.bonus > 0 ? '#7dffb0' : (F.col || '#ffd27a'), `${Math.ceil(b.hp)} / ${b.maxHp}`);
      for (const ph of (F.ph || [])) if (ph.floor > 0) { ctx.fillStyle = INK; ctx.fillRect(bbx + bbw * ph.floor - 2, bby + 8, 4, 26); }
      txt(ctx, `Phase ${Bd.phase}`, bbx + bbw + 8, bby + 22, 14, '#fff', 'left', 3);
      const pn = ((F.ph || [])[Bd.phase - 1] || {}).name;
      if (Bd.bonus > 0) txt(ctx, `EXPOSED · +25% damage · ${Math.ceil(Bd.bonus / 60)}s`, w / 2, bby + 54, 18, '#7dffb0', 'center', 4);
      else if (pn) txt(ctx, pn, w / 2, bby + 54, 15, '#fff', 'center', 3);
      if (Bd.enraged) txt(ctx, T.f === 'lumivex' ? 'ECLIPSE' : 'SKYFALL', w / 2, bby + 76, 16, '#ff5e5b', 'center', 3);
      else if (Bd.enr > 0 && Bd.enr < 60 * 60) txt(ctx, `Enrage in ${Math.ceil(Bd.enr / 60)}s`, w / 2, bby + 76, 13, '#ff9a8a', 'center', 3);
    }
    y = bby + 96;
  }
  if (T.call && T.call.t > 0) {
    const a = Math.min(1, T.call.t / 30, (T.call.d - T.call.t + 6) / 12);
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    txt(ctx, T.call.txt, w / 2, h * 0.32, 40, T.call.col || '#fff', 'center', 8);
    if (T.call.sub) txt(ctx, T.call.sub, w / 2, h * 0.32 + 30, 18, '#fff', 'center', 4);
    ctx.restore();
  }
  return y;
}

// ------------------------------------------------------------------ minimap
export function drawGlowMinimap(ctx, x, y, R, sim, p, CLASSES) {
  const T = glowState(sim), torSide = inTorArea(p.x, p.y);
  circle(ctx, x, y, R + 5, INK, 0);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
  ctx.fillStyle = '#0a160e'; ctx.fillRect(x - R, y - R, R * 2, R * 2);
  const cy = torSide ? TOR.y : (HOLLOW_ROOMS[0].y + BOWER.y) / 2, k = (R * 2 - 16) / (torSide ? 1500 : 5000), X = (wx) => x + wx * k, Y = (wy) => y + (wy - cy) * k;
  ctx.beginPath(); ctx.moveTo(X(0), Y(HOLLOW_ROOMS[0].y)); ctx.lineTo(X(0), Y(BOWER.y)); ctx.strokeStyle = 'rgba(201,242,122,.4)'; ctx.lineWidth = 3; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
  const cur = T ? (T.f !== 'lumivex' ? 4 : T.b ? 3 : T.room) : -1;
  ALL.forEach((Rm, i) => circle(ctx, X(Rm.x), Y(Rm.y), Rm.r * k, cur === i ? '#8fbf5a' : i < cur ? '#4d6f3a' : '#26391e', 2, cur === i ? '#ffffff' : INK));
  for (const e of sim.enemies) { if (e.dead || !(inHollowArea(e.x, e.y) || inTorArea(e.x, e.y))) continue; ctx.fillStyle = e.boss ? '#ff5e5b' : e.elite ? '#ffcf3a' : '#ff4d4d'; ctx.fillRect(X(e.x) - 1.5, Y(e.y) - 1.5, 3, 3); }
  if (sim.players) for (const q of sim.players.values()) if (q.id !== p.id && !q.dead) circle(ctx, X(q.x), Y(q.y), 3, CLASSES[q.cls] ? CLASSES[q.cls].color : '#fff', 1.2);
  circle(ctx, X(p.x), Y(p.y), 3.5, '#fff', 1.6);
  ctx.restore();
  circle(ctx, x, y, R + 3, null, 5, INK); circle(ctx, x, y, R, null, 2, 'rgba(255,255,255,.35)');
}

// ------------------------------------------------------------------ events (fx.js routes {type:'glow'} here)
export function glowEventFx(fx, ev, me) {
  const x = ev.x, y = ev.y;
  switch (ev.ph) {
    case 'wave': for (const [px, py, el] of ev.pts || []) { fx.puffs(px, py, 8, '#c9f27a', 14, 140, 0.7); if (el) fx.ring(px, py, 46, '#ffcf3a', 0.5, 5); } break;
    case 'roomClear': fx.ring(x, y, 320, '#d8ff9a', 0.8, 8); break;
    case 'chest': fx.ring(x, y, 80, '#c9f27a', 0.6, 8); fx.sparks(x, y, -Math.PI / 2, 26, '#ffffff', 420, 1.8); fx.shake(0.2); break;
    case 'chal': if (me) fx.text(x, y - 50, `CHAIN ${ev.n}/${ev.need}`, { size: 18, color: '#d8ff9a', vy: -40, pop: 1, life: 0.9 }); break;
    case 'chalDone': fx.banner('CHALLENGE COMPLETE', '#7dffb0', 'Clear the grotto to open the glowcap chest', 2.2, 36); break;
    case 'chalFail': fx.banner('CHALLENGE FAILED', '#ff8a7a', 'Too many spore-pod hits: no chest this grotto', 2.2, 36); break;
    case 'pod': fx.puffs(x, y, 12, '#c9f27a', 18, 200, 0.8); fx.ring(x, y, 80, '#c9f27a', 0.35, 5); fx.shake(0.06); break;
    case 'bossPull': fx.shake(0.3); break;
    case 'bossStart': fx.flashColor = ev.f === 'lumivex' ? '#efe8ff' : '#cfe6ff'; fx.flash = 0.5; fx.shake(0.4); fx.ring(x, y, 420, ev.f === 'lumivex' ? '#ffe27a' : '#9fd0ff', 0.9, 14); break;
    case 'cast': fx.ring(x, y, 120, ev.f === 'lumivex' ? '#ffe27a' : '#9fd0ff', 0.4, 6); break;
    case 'bonus': fx.ring(x, y, 180, '#7dffb0', 0.6, 10); fx.sparks(x, y, -Math.PI / 2, 20, '#7dffb0', 380, 1.6); fx.banner('EXPOSED', '#7dffb0', 'A clean dodge: +25% damage for 4 s', 1.6, 34); break;
    case 'phase': fx.shake(0.5); fx.ring(x, y, 360, '#ffffff', 0.7, 12); break;
    case 'enrage': fx.shake(0.5); fx.flashColor = '#ff5e7a'; fx.flash = 0.3; break;
    case 'boom': fx.shake(ev.k === 'quake' || ev.k === 'charge' ? 0.2 : 0.08); if (x != null) fx.puffs(x, y, 6, ev.k === 'rod' || ev.k === 'arc' ? '#dff0ff' : '#ffe9a0', 14, 160, 0.4); break;
    case 'hit': if (me) fx.text(x, y - 40, String(ev.what || 'Hit').toUpperCase(), { size: 16, color: '#ff9a8a', vy: -30, life: 0.8 }); break;
    case 'wipe': fx.banner('WIPED', '#ff5e5b', 'The encounter resets: try again', 2.6, 42, 'defeat'); break;
    case 'victory': fx.flashColor = '#efffd0'; fx.flash = 0.8; fx.shake(0.7); fx.ring(x, y, 600, '#d8ff9a', 1.2, 20); fx.banner(ev.f === 'lumivex' ? 'THE MATRIARCH FALLS' : ev.f === 'vharokx' ? 'THE STORMHORN BOWS · EXTREME' : 'THE STORMHORN BOWS', '#d8ff9a', `cleared in ${ev.t || '?'}s`, 4, 50, 'victory'); break;
  }
}

// ------------------------------------------------------------------ enemies (registered into art.js ENEMY_DRAW)
const lightLocal = (e) => LA - (e.face || 0);
Object.assign(ENEMY_ANIM, { mirecap: [6, 4], mothling: [12, 6], thornhound: [10, 4], bogbrute: [4, 4], stormhound: [10, 4] });
function wings(ctx, r, t, col, n = 1) { const f = Math.sin(t * 18) * 0.35 * n; for (const sd of [-1, 1]) { ctx.save(); ctx.rotate(sd * (0.5 + f)); ctx.beginPath(); ctx.ellipse(-r * 0.4, sd * r * 0.9, r * 0.9, r * 0.55, 0, 0, TAU); ctx.fillStyle = col; ctx.fill(); ink(ctx, 2.2); circle(ctx, -r * 0.5, sd * r * 0.95, r * 0.22, '#ffe9a0', 1.6); ctx.restore(); } }
function quad(ctx, e, t, col, horns) {
  const r = e.r, la = lightLocal(e), run = Math.sin(t * 12 + (e.id || 0));
  for (const [lx, ly] of [[0.5, -0.55], [0.5, 0.55], [-0.5, -0.55], [-0.5, 0.55]]) circle(ctx, r * lx + run * r * 0.1 * Math.sign(lx), r * ly, r * 0.2, shade(col, -0.3), 2);
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.1, r * 0.7, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, 0, 0, r, col, la); ctx.fill(); ink(ctx, 3);
  ball(ctx, r * 0.95, 0, r * 0.45, shade(col, 0.05), la, 2.6, 0.3);
  circle(ctx, r * 1.15, -r * 0.16, 2.4, horns === 'storm' ? '#bfe3ff' : '#ffe27a', 0); circle(ctx, r * 1.15, r * 0.16, 2.4, horns === 'storm' ? '#bfe3ff' : '#ffe27a', 0);
  if (horns) for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.9, sd * r * 0.3); ctx.quadraticCurveTo(r * 0.7, sd * r * 0.95, r * 1.3, sd * r * 0.9); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = horns === 'storm' ? '#dfe8ff' : '#8a6a48'; ctx.stroke(); }
}
function drawVharok(ctx, e, t, col) {
  const r = e.r, la = lightLocal(e), ex = e.type === 'trvharokx';
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.3 + 0.15 * Math.sin(t * 6); circle(ctx, 0, 0, r * 1.6, ex ? '#ff9a6a' : '#6fa8ff', 0); ctx.restore();
  for (const [lx, ly] of [[0.55, -0.6], [0.55, 0.6], [-0.55, -0.6], [-0.55, 0.6]]) circle(ctx, r * lx, r * ly, r * 0.22, '#3a3a44', 2.5);
  ctx.beginPath(); ctx.ellipse(-r * 0.1, 0, r * 1.15, r * 0.78, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, 0, 0, r, col, la); ctx.fill(); ink(ctx, 3.6);
  for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.moveTo(-r * 0.8 + k * r * 0.22, -r * 0.4); ctx.lineTo(-r * 0.7 + k * r * 0.22, 0); ctx.lineTo(-r * 0.8 + k * r * 0.22, r * 0.4); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 3; ctx.stroke(); }
  ball(ctx, r * 0.95, 0, r * 0.5, shade(col, 0.08), la, 3, 0.3);
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.85, sd * r * 0.35); ctx.bezierCurveTo(r * 0.4, sd * r * 1.3, r * 1.5, sd * r * 1.4, r * 1.7, sd * r * 0.8); ctx.lineWidth = 11; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = '#eef3ff'; ctx.stroke(); }
  // a sparking crown between the horns
  for (let k = 0; k < 3; k++) { const a = t * 9 + k * 2.1; ctx.beginPath(); ctx.moveTo(r * 1.2, 0); ctx.lineTo(r * 1.2 + Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); ctx.strokeStyle = '#dff0ff'; ctx.lineWidth = 2; ctx.stroke(); }
  circle(ctx, r * 1.25, -r * 0.18, 3.5, '#bfe3ff', 0); circle(ctx, r * 1.25, r * 0.18, 3.5, '#bfe3ff', 0);
}
Object.assign(ENEMY_DRAW, {
  /** Mirecap: a waddling glowcap mushroom with a spotted cap */
  mirecap(ctx, e, t, col) { const r = e.r, la = lightLocal(e); ctx.rotate(Math.sin(t * 6 + (e.id || 0)) * 0.1); ball(ctx, 0, 0, r * 0.6, '#e8dcc0', la, 2.4, 0.3); ball(ctx, -r * 0.1, 0, r, col, la, 3, 0.5); for (let k = 0; k < 5; k++) circle(ctx, Math.cos(k * 1.3) * r * 0.55, Math.sin(k * 1.3) * r * 0.55, r * 0.14, '#efffd0', 0); },
  /** Mothling: a fluttering little moth with lantern-eyed wings */
  mothling(ctx, e, t, col) { const r = e.r, la = lightLocal(e); wings(ctx, r, t, shade(col, 0.1)); ball(ctx, 0, 0, r * 0.55, col, la, 2.6, 0.4); circle(ctx, r * 0.4, -r * 0.15, 2, INK, 0); circle(ctx, r * 0.4, r * 0.15, 2, INK, 0); },
  /** Thornhound: a bramble-backed wolf */
  thornhound(ctx, e, t, col) { quad(ctx, e, t, col, null); const r = e.r; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-r * 0.6 + k * r * 0.3, -r * 0.2); ctx.lineTo(-r * 0.5 + k * r * 0.3, -r * 0.75); ctx.lineTo(-r * 0.4 + k * r * 0.3, -r * 0.2); ctx.fillStyle = '#5a7a2a'; ctx.fill(); ink(ctx, 1.6); } },
  /** Bog Brute: a hulking moss-covered troll */
  bogbrute(ctx, e, t, col) { const r = e.r, la = lightLocal(e); for (const sd of [-1, 1]) ball(ctx, r * 0.3, sd * r * 0.95, r * 0.38, shade(col, -0.1), la, 2.6, 0.3); ball(ctx, 0, 0, r, col, la, 3.2, 0.45); for (let k = 0; k < 6; k++) circle(ctx, Math.cos(k) * r * 0.5 - r * 0.2, Math.sin(k) * r * 0.6, r * 0.18, '#5f8a3a', 0); circle(ctx, r * 0.6, -r * 0.2, 3, '#ffe27a', 0); circle(ctx, r * 0.6, r * 0.2, 3, '#ffe27a', 0); },
  /** Stormhound: a crackling blue hound (Vharok's pack) */
  stormhound(ctx, e, t, col) { quad(ctx, e, t, col, 'storm'); if (Math.sin(t * 20 + (e.id || 0)) > 0.6) { ctx.beginPath(); ctx.moveTo(-e.r, 0); ctx.lineTo(-e.r * 0.3, -e.r * 0.5); ctx.lineTo(e.r * 0.2, e.r * 0.2); ctx.strokeStyle = '#dff0ff'; ctx.lineWidth = 2; ctx.stroke(); } },
  /** Lumivex, the Moth Matriarch: a great pale moth with four eyed wings and a lantern-glow thorax */
  lumivex(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.35 + 0.15 * Math.sin(t * 3); circle(ctx, 0, 0, r * 1.9, '#ffe9a0', 0); ctx.restore();
    const f = Math.sin(t * 5) * 0.25;
    for (const sd of [-1, 1]) for (const [ox, sz, rot] of [[0.1, 1.25, 0.35], [-0.6, 0.85, 0.9]]) {
      ctx.save(); ctx.rotate(sd * (rot + f)); ctx.beginPath(); ctx.ellipse(ox * r, sd * r * 1.05, r * sz, r * sz * 0.62, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, 0, sd * r, r * sz, col, la); ctx.fill(); ink(ctx, 3.2);
      circle(ctx, ox * r, sd * r * 1.1, r * sz * 0.28, '#3b2f5a', 2.4); circle(ctx, ox * r, sd * r * 1.1, r * sz * 0.14, '#ffe27a', 0); ctx.restore();
    }
    ctx.beginPath(); ctx.ellipse(-r * 0.2, 0, r * 0.75, r * 0.36, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, 0, 0, r * 0.7, '#f2ecff', la); ctx.fill(); ink(ctx, 3);
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-r * 0.7 + k * r * 0.25, -r * 0.3); ctx.lineTo(-r * 0.7 + k * r * 0.25, r * 0.3); ctx.strokeStyle = 'rgba(80,60,120,.45)'; ctx.lineWidth = 3; ctx.stroke(); }
    ball(ctx, r * 0.6, 0, r * 0.32, '#f2ecff', la, 2.6, 0.3);
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.8, sd * r * 0.12); ctx.quadraticCurveTo(r * 1.3, sd * r * 0.2, r * 1.45, sd * r * 0.6); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke(); }
    circle(ctx, r * 0.72, -r * 0.14, 4, '#ffe27a', 0); circle(ctx, r * 0.72, r * 0.14, 4, '#ffe27a', 0);
    bloom(ctx, -r * 0.2, 0, r * 0.6, '#ffe27a', 0.5 + 0.3 * Math.sin(t * 4));
  },
  trvharok: drawVharok,
  trvharokx: drawVharok,
});
void star;
