// Part F: THE ULTIMATE · "The Unwritten" (sim/ultimate.js), classic code-drawn style with flashy VFX. The Unwritten Throne:
// an open page of starlight floating in the void (a gold-inked disc, five phase seals around its rim that light up as the
// echoes fall), the telegraphs on the shared renderer (client/telefx.js) with the variation labels, the Crunch wall, the
// variation sigil over the boss (the tell: ⟳ / ⟲, IN / OUT, ROWS / COLUMNS, → / ←, FRONT / BACK, STACK / SPREAD), the HUD
// (boss bar, the 1-5 phase strip, the enrage clock, attempts, the call), the minimap, the event FX and the five bosses:
// the four echoes are the Rift bosses' own art in an astral wash (ghost trails, a starlit rim); Aeon is new.
// State: packUlt (local sim, memoised per tick) or the co-op snapshot (sim.ultV).
import { INK, circle, ellipse, shade, ENEMY_DRAW } from './art.js';
import { bloom } from './fxglow.js';
import { drawTele, drawLegend } from './telefx.js';
import './riftart.js';
import { packUlt, ULT_PH, ULT_N, ARENA } from '../sim/ultimate.js';
import { trialAt } from '../sim/trialconst.js';

const TAU = Math.PI * 2, FONT = "'Lilita One', sans-serif", A = ARENA;
const H = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
let memo = { k: -1, s: null, v: null };
export function ultState(sim) {
  if (!sim) return null;
  if (sim.ultV !== undefined) return sim.ultV || null;
  if (memo.s === sim && memo.k === sim.tick) return memo.v;
  memo = { k: sim.tick, s: sim, v: sim.ult ? packUlt(sim) : null };
  return memo.v;
}
export const inUlt = (p) => !!(p && p.y < -28000 && trialAt(p.x, p.y) === 'ul');
const label = (ctx, s, x, y, size, col, lw = 4) => { ctx.font = `${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y); };
const SIG = { cw: '⟳', ccw: '⟲', in: 'IN', out: 'OUT', rows: 'ROWS', cols: 'COLS', left: '←', right: '→', front: 'FRONT', back: 'BACK', stack: 'STACK', spread: 'SPREAD' };
const SIG_TXT = { cw: 'clockwise', ccw: 'anti-clockwise', in: 'get in', out: 'get out', rows: 'rows first', cols: 'columns first', left: 'shift left', right: 'shift right', front: 'front first', back: 'back first', stack: 'stack', spread: 'spread' };
export const sigGlyph = (s) => SIG[s] || '';

// ------------------------------------------------------------------ the page (baked once: the static disc)
let DISC = null;
function mk(w, h) { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; } return null; }
function disc() {
  if (DISC !== null) return DISC;
  const P = 80, S = (A.r + P) * 2, c = mk(S, S); if (!c) return (DISC = false);
  const g = c.getContext('2d'), cx = S / 2, cy = S / 2;
  // the page: parchment-white starlight fading to gold at the rim
  const rg = g.createRadialGradient(cx, cy - 60, 40, cx, cy, A.r); rg.addColorStop(0, '#2d2a52'); rg.addColorStop(0.7, '#1d1a3c'); rg.addColorStop(1, '#3b2e5a');
  g.beginPath(); g.arc(cx, cy, A.r, 0, TAU); g.fillStyle = rg; g.fill();
  // the written lines of the page (faint gold script)
  g.save(); g.beginPath(); g.arc(cx, cy, A.r - 10, 0, TAU); g.clip(); g.strokeStyle = 'rgba(255,226,150,.13)'; g.lineWidth = 2;
  for (let y = -A.r; y < A.r; y += 34) { g.beginPath(); let x = -A.r; g.moveTo(cx + x, cy + y); while (x < A.r) { const w = 10 + H(x, y) * 40; x += w; if (H(y, x) < 0.2) g.moveTo(cx + x, cy + y); else g.lineTo(cx + x, cy + y + (H(x * 3, y) - 0.5) * 3); } g.stroke(); }
  g.restore();
  // rune rings
  for (const [r, w, col] of [[A.r - 6, 7, '#e8c46a'], [A.r - 22, 2, 'rgba(255,233,170,.55)'], [A.r * 0.55, 2, 'rgba(255,233,170,.3)'], [150, 2, 'rgba(255,233,170,.35)']]) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.lineWidth = w + 3; g.strokeStyle = INK; g.stroke(); g.lineWidth = w; g.strokeStyle = col; g.stroke(); }
  g.font = `16px ${FONT}`; g.textAlign = 'center'; g.fillStyle = 'rgba(255,233,170,.5)';
  const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU; g.save(); g.translate(cx + Math.cos(a) * (A.r - 36), cy + Math.sin(a) * (A.r - 36)); g.rotate(a + Math.PI / 2); g.fillText(RUNES[i % RUNES.length], 0, 5); g.restore(); }
  // the quadrant axes (memory reads), faint
  g.strokeStyle = 'rgba(255,233,170,.12)'; g.lineWidth = 2; g.setLineDash([10, 14]); g.beginPath(); g.moveTo(cx - A.r, cy); g.lineTo(cx + A.r, cy); g.moveTo(cx, cy - A.r); g.lineTo(cx, cy + A.r); g.stroke(); g.setLineDash([]);
  // the centre seal: an open book
  g.save(); g.translate(cx, cy); g.globalAlpha = 0.28; g.fillStyle = '#ffe9b0'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, 30); g.quadraticCurveTo(s * 40, 10, s * 80, 22); g.lineTo(s * 80, -26); g.quadraticCurveTo(s * 40, -38, 0, -18); g.closePath(); g.fill(); } g.restore();
  return (DISC = c);
}
// the five seals around the rim (one per phase)
const sealPos = (i) => { const a = -Math.PI / 2 + (i / ULT_N) * TAU; return [A.x + Math.cos(a) * (A.r + 46), A.y + Math.sin(a) * (A.r + 46)]; };

export function drawUltGround(ctx, view, t, sim) {
  ctx.fillStyle = '#05040f'; ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  // a slow starfield and drifting torn pages
  const S = 140;
  for (let gx = Math.floor(view.x0 / S) * S; gx < view.x1; gx += S) for (let gy = Math.floor(view.y0 / S) * S; gy < view.y1; gy += S) {
    const h = H(gx / S, gy / S); if (h > 0.55) continue;
    const x = gx + H(gy, gx) * S, y = gy + H(gx + 3, gy) * S; ctx.globalAlpha = 0.25 + 0.6 * h * (0.6 + 0.4 * Math.sin(t * 2 + h * 40)); ctx.fillStyle = h < 0.1 ? '#ffe9b0' : '#c9d4ff'; ctx.fillRect(x, y, h < 0.08 ? 3 : 2, h < 0.08 ? 3 : 2);
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 9; i++) { const a = t * 0.05 + i * 0.7, rr = A.r + 160 + (i % 3) * 90, x = A.x + Math.cos(a) * rr, y = A.y + Math.sin(a) * rr * 0.8; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.3 + i); ctx.globalAlpha = 0.25; ctx.fillStyle = '#f3e6c4'; ctx.fillRect(-14, -10, 28, 20); ctx.restore(); }
  const U = ultState(sim);
  bloom(ctx, A.x, A.y, A.r * 1.35, U && U.last ? '#ff5e7a' : '#8f7bff', 0.35);
  const D = disc(); if (D) ctx.drawImage(D, A.x - A.r - 80, A.y - A.r - 80, (A.r + 80) * 2, (A.r + 80) * 2);
  // the seals
  for (let i = 0; i < ULT_N; i++) {
    const [x, y] = sealPos(i), P = ULT_PH[i], done = U && (U.ph > i + 1 || U.st === 'victory'), cur = U && U.ph === i + 1 && U.st !== 'victory';
    if (cur) bloom(ctx, x, y, 70, P.col, 0.5 + 0.3 * Math.sin(t * 4));
    circle(ctx, x, y, 22, done ? shade(P.col, -0.45) : cur ? P.col : '#2a2440', 3.5);
    label(ctx, ['I', 'II', 'III', 'IV', 'V'][i], x, y + 6, 16, done ? '#8a7f9c' : '#fff');
    if (done) { ctx.strokeStyle = '#fff1b8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 14, y - 14); ctx.lineTo(x + 14, y + 14); ctx.stroke(); }
  }
  return true;
}
export function drawUltUnder(ctx, sim, local, t) {
  const U = ultState(sim); if (!U || !inUlt(local)) return;
  if (U.crunch) { // the Crunch: everything outside the folding wall is unwritten
    ctx.save(); ctx.beginPath(); ctx.arc(A.x, A.y, A.r + 4, 0, TAU); ctx.arc(A.x, A.y, U.crunch, 0, TAU, true); ctx.fillStyle = 'rgba(10,6,20,.78)'; ctx.fill('evenodd');
    ctx.beginPath(); ctx.arc(A.x, A.y, U.crunch, 0, TAU); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#fff1b8'; ctx.setLineDash([18, 10]); ctx.lineDashOffset = -t * 60; ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }
  for (const te of U.tele || []) drawTele(ctx, te, t, A);
  // the variation sigil over the boss (the tell)
  const b = U.bid && sim.enemyById && sim.enemyById.get(U.bid);
  if (b && U.sig && SIG[U.sig]) {
    const y = b.y - b.r - 64, s = SIG[U.sig], w = Math.max(52, s.length * 16 + 22), P = ULT_PH[(U.ph | 0) - 1] || ULT_PH[0];
    bloom(ctx, b.x, y, 60, P.col, 0.45 + 0.25 * Math.sin(t * 6));
    ctx.save(); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(b.x - w / 2, y - 22, w, 40, 12) : ctx.rect(b.x - w / 2, y - 22, w, 40); ctx.fillStyle = 'rgba(20,14,40,.9)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = P.col; ctx.stroke(); ctx.restore();
    label(ctx, s, b.x, y + 9, s.length > 2 ? 20 : 28, '#fff', 5);
  }
}

// ------------------------------------------------------------------ HUD (screen space; the phone shares it, scaled by w)
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60) | 0).padStart(2, '0')}`;
export function drawUltHud(ctx, sim, p, w, h, txt, bar, time = 0) {
  const U = ultState(sim); if (!U || !inUlt(p)) return 0;
  const sm = w < 760, P = ULT_PH[(U.ph | 0) - 1] || ULT_PH[0], y = sm ? 84 : 112, bbw = Math.min(640, w * (sm ? 0.8 : 0.52)), bbx = w / 2 - bbw / 2;
  // the phase strip: five seals, the current one lit
  const sw = Math.min(46, bbw / 6), sx = w / 2 - (sw * ULT_N) / 2;
  for (let i = 0; i < ULT_N; i++) { const Q = ULT_PH[i], done = U.ph > i + 1 || U.st === 'victory', cur = U.ph === i + 1 && U.st !== 'victory', cx = sx + sw * (i + 0.5), cy = y - (sm ? 34 : 40);
    if (cur) bloom(ctx, cx, cy, 26, Q.col, 0.6); circle(ctx, cx, cy, sm ? 10 : 12, done ? '#4a4260' : cur ? Q.col : '#1d1830', 2.5, done ? '#8a7f9c' : INK); txt(ctx, ['I', 'II', 'III', 'IV', 'V'][i], cx, cy + 4, sm ? 10 : 11, done ? '#8a7f9c' : '#fff', 'center', 2); }
  txt(ctx, `ATTEMPT ${U.attempts + 1}${U.tt > 0 ? ` · ${fmt(Math.round(U.tt / 60))}` : ''}`, bbx + bbw, y - (sm ? 30 : 36), sm ? 11 : 13, '#c9b6ff', 'right', 3);
  if (U.st === 'victory') { txt(ctx, 'THE UNWRITTEN FALLS', w / 2, y + 6, sm ? 20 : 26, '#fff1b8', 'center', 5); txt(ctx, 'Prestige earned · home soon', w / 2, y + 30, 14, '#fff', 'center', 3); }
  else if (U.st === 'wipe') { txt(ctx, 'THE PAGE IS BLANK', w / 2, y + 6, sm ? 20 : 24, '#ff8a7a', 'center', 5); txt(ctx, 'No checkpoints · back to phase 1', w / 2, y + 30, 14, '#fff', 'center', 3); }
  else if (U.st === 'pull' || U.st === 'inter') { txt(ctx, U.st === 'pull' ? 'THE ULTIMATE' : `NEXT · ${P.name.toUpperCase()}`, w / 2, y + 6, sm ? 18 : 22, P.col, 'center', 4); txt(ctx, `in ${Math.max(0, Math.ceil(U.at / 60))}…`, w / 2, y + 28, 14, '#fff', 'center', 3); if (U.st === 'pull' && !sm) drawLegend(ctx, w - 250, y + 150); }
  else {
    const b = U.bid && sim.enemyById && sim.enemyById.get(U.bid);
    txt(ctx, P.name, w / 2, y - 4, sm ? 17 : 22, P.col, 'center', 4);
    if (b) bar(ctx, bbx, y + 8, bbw, sm ? 16 : 22, b.hp / b.maxHp, U.last ? '#ff5e7a' : P.col, `${Math.ceil(b.hp)} / ${b.maxHp}`);
    if (P.final) { ctx.fillStyle = INK; ctx.fillRect(bbx + bbw * 0.15 - 2, y + 6, 4, sm ? 20 : 26); }
    const ey = y + (sm ? 40 : 50);
    if (U.enraged) txt(ctx, 'THE UNMAKING', w / 2, ey, sm ? 14 : 16, '#ff3b3b', 'center', 3);
    else if (U.enr > 0) txt(ctx, `Enrage ${fmt(Math.ceil(U.enr / 60))}`, w / 2, ey, sm ? 12 : 14, U.enr < 60 * 30 ? '#ff6a5a' : '#ffb8a8', 'center', 3);
    if (U.last) txt(ctx, 'THE LAST PAGE', w / 2, ey + 18, 13, '#ff8aa0', 'center', 3);
    if (U.sig && SIG[U.sig]) { const cx = bbx - (sm ? 26 : 34), cy = y + 18; circle(ctx, cx, cy, sm ? 18 : 22, 'rgba(20,14,40,.92)', 3, P.col); txt(ctx, SIG[U.sig], cx, cy + 5, SIG[U.sig].length > 2 ? 9 : 16, '#fff', 'center', 3); if (!sm) txt(ctx, SIG_TXT[U.sig], cx, cy + 36, 11, '#fff', 'center', 3); }
  }
  if (U.call && U.call.t > 0) {
    const a = Math.min(1, U.call.t / 30, (U.call.d - U.call.t + 6) / 12);
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    txt(ctx, U.call.txt, w / 2, h * 0.3, sm ? 26 : 40, U.call.col || '#fff', 'center', 7);
    if (U.call.sub) txt(ctx, U.call.sub, w / 2, h * 0.3 + (sm ? 24 : 30), sm ? 13 : 18, '#fff', 'center', 4);
    ctx.restore();
  }
  return y + (sm ? 66 : 80);
}
export function drawUltMinimap(ctx, x, y, R, sim, p, CLASSES) {
  const U = ultState(sim), k = (R - 6) / (A.r + 40);
  circle(ctx, x, y, R + 5, INK, 0); ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip(); ctx.fillStyle = '#120f26'; ctx.fillRect(x - R, y - R, R * 2, R * 2);
  circle(ctx, x, y, A.r * k, '#2d2a52', 2, '#e8c46a');
  if (U && U.crunch) circle(ctx, x, y, U.crunch * k, null, 2, '#fff1b8');
  for (const e of sim.enemies || []) { if (e.dead || !e.ult && !(e.type || '').startsWith('ult')) continue; ctx.fillStyle = e.boss ? '#ff5e5b' : '#ff9a4d'; ctx.fillRect(x + (e.x - A.x) * k - 2.5, y + (e.y - A.y) * k - 2.5, 5, 5); }
  if (sim.players) for (const q of sim.players.values()) if (q.id !== p.id && !q.dead) circle(ctx, x + (q.x - A.x) * k, y + (q.y - A.y) * k, 3, CLASSES[q.cls] ? CLASSES[q.cls].color : '#fff', 1.2);
  circle(ctx, x + (p.x - A.x) * k, y + (p.y - A.y) * k, 3.5, '#fff', 1.6);
  ctx.restore(); circle(ctx, x, y, R + 3, null, 5, INK); circle(ctx, x, y, R, null, 2, 'rgba(255,241,184,.5)');
  return true;
}

// ------------------------------------------------------------------ events (fx.js routes {type:'ult'} here)
export function ultEventFx(fx, ev, me) {
  const x = ev.x, y = ev.y, P = ULT_PH[(ev.phase | 0) - 1];
  switch (ev.ph) {
    case 'pull': fx.flashColor = '#fff1b8'; fx.flash = 0.4; fx.ring(x, y, A.r, '#fff1b8', 1.0, 10); break;
    case 'phase': fx.shake(0.6); fx.flashColor = P ? P.col : '#fff'; fx.flash = 0.45; fx.ring(x, y, 520, P ? P.col : '#fff', 1.0, 16); fx.ring(x, y, 260, '#ffffff', 0.6, 8); fx.sparks(x, y, -Math.PI / 2, 40, P ? P.col : '#fff', 520, 2.4); if (fx.chunks) fx.chunks(x, y, 30, '#fff1b8', 420); break;
    case 'shatter': fx.shake(0.9); fx.flashColor = '#ffffff'; fx.flash = 0.7; fx.ring(x, y, 700, '#fff1b8', 1.3, 18); fx.ring(x, y, 380, P ? P.col : '#c9b6ff', 0.9, 12); if (fx.chunks) fx.chunks(x, y, 70, P ? P.col : '#fff', 640); fx.puffs(x, y, 30, '#fff6dc', 40, 360, 1.1);
      fx.banner(`${P ? P.short : 'ECHO'} IS UNWRITTEN`, '#fff1b8', `Phase ${ev.phase} cleared in ${fmt(ev.t | 0)}`, 2.8, 52); break;
    case 'cast': fx.ring(x, y, 140, P ? P.col : '#fff', 0.45, 6); if (ev.sig) fx.puffs(x, y - 80, 8, '#fff1b8', 14, 120, 0.5); break;
    case 'boom': { const big = ev.k === 'unmake' || ev.k === 'genesis' || ev.k === 'dusk' || ev.k === 'orbit' || ev.k === 'eclipse'; fx.shake(big ? 0.35 : 0.1); if (x != null) { fx.puffs(x, y, big ? 16 : 6, ev.k === 'star' ? '#ffe27a' : '#e8dcff', big ? 30 : 14, big ? 320 : 160, 0.45); if (ev.sh === 'circle' || ev.sh === 'tower') fx.ring(x, y, ev.r || 100, '#ffffff', 0.3, 5); } break; }
    case 'blink': fx.ring(x, y, 160, '#6ae6ff', 0.4, 8); fx.sparks(x, y, 0, 24, '#bff8ff', 420, TAU); fx.shake(0.2); break;
    case 'hit': if (me) fx.text(x, y - 40, String(ev.what || 'Hit').toUpperCase(), { size: 16, color: '#ff9a8a', vy: -30, life: 0.8 }); break;
    case 'revive': fx.ring(x, y, 80, '#7dffb0', 0.6, 6); fx.sparks(x, y, -Math.PI / 2, 14, '#c8ffd8', 300, 1); break;
    case 'burst': fx.shake(0.4); fx.ring(x, y, A.r, '#ff4d5e', 0.7, 12); break;
    case 'enrage': fx.shake(0.8); fx.flashColor = '#ff3b3b'; fx.flash = 0.45; fx.banner('THE UNMAKING', '#ff5e5b', 'The phase ran out of time', 2.4, 50); break;
    case 'last': fx.shake(0.6); fx.flashColor = '#ff5e7a'; fx.flash = 0.4; fx.ring(x, y, 600, '#ff8aa0', 1.1, 14); fx.banner('THE LAST PAGE', '#ff8aa0', 'Aeon writes faster', 2.4, 50); break;
    case 'wipe': fx.banner('THE PAGE IS BLANK', '#ff5e5b', `Attempt ${ev.attempts} · no checkpoints: back to phase 1`, 3, 46, 'defeat'); break;
    case 'retry': fx.ring(x, y, A.r, '#c9b6ff', 0.8, 10); break;
    case 'victory': fx.flashColor = '#fff6dc'; fx.flash = 1; fx.shake(1); fx.ring(x, y, 900, '#fff1b8', 1.8, 24); fx.ring(x, y, 500, '#c9b6ff', 1.4, 14); if (fx.chunks) fx.chunks(x, y, 90, '#fff1b8', 720); fx.sparks(x, y, -Math.PI / 2, 60, '#ffffff', 700, TAU);
      fx.banner('THE UNWRITTEN FALLS', '#fff1b8', `The Ultimate cleared in ${fmt(ev.t | 0)} · ${ev.attempts + 1} attempt${ev.attempts ? 's' : ''}`, 5, 64, 'victory'); break;
  }
}

// ------------------------------------------------------------------ the bosses
/** an echo: the original's art in an astral wash: two ghost trails behind, a starlit rim, the colour pushed to light */
function echo(base, tint) {
  return function drawEcho(ctx, e, t, col) {
    const f = ENEMY_DRAW[base]; if (!f) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.18;
    for (let i = 1; i <= 2; i++) { ctx.save(); ctx.translate(-i * 10 - Math.sin(t * 3) * 4, Math.cos(t * 2 + i) * 4); f(ctx, e, t - i * 0.08, tint); ctx.restore(); }
    ctx.restore();
    bloom(ctx, 0, 0, e.r * 2.3, tint, 0.35 + 0.15 * Math.sin(t * 2));
    f(ctx, e, t, shade(col, 0.15));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.22 + 0.08 * Math.sin(t * 5); circle(ctx, 0, 0, e.r * 1.05, tint, 0); ctx.restore();
    for (let i = 0; i < 6; i++) { const a = t * 0.8 + i * TAU / 6, r = e.r * (1.35 + 0.1 * Math.sin(t * 3 + i)); ctx.fillStyle = '#fff6dc'; ctx.fillRect(Math.cos(a) * r - 2, Math.sin(a) * r - 2, 4, 4); }
  };
}
/** Aeon, the Unwritten: a tall robed figure of starlight with an open book for a heart, a halo of turning pages and six quills */
function aeon(ctx, e, t, col) {
  const r = e.r, br = Math.sin(t * 1.6) * 0.05;
  ellipse(ctx, 0, r * 0.75, r * 1.3, r * 0.45, 'rgba(0,0,10,.4)', 0);
  bloom(ctx, 0, 0, r * 2.8, '#fff1b8', 0.45 + 0.15 * Math.sin(t * 2));
  // the halo of pages
  for (let i = 0; i < 12; i++) { const a = t * 0.4 + i * TAU / 12, rr = r * 1.55; ctx.save(); ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr); ctx.rotate(a + Math.PI / 2 + Math.sin(t + i) * 0.3); ctx.fillStyle = i % 3 ? '#f3e6c4' : '#fff6dc'; ctx.fillRect(-9, -12, 18, 24); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.strokeRect(-9, -12, 18, 24); ctx.fillStyle = 'rgba(80,60,40,.6)'; ctx.fillRect(-6, -7, 12, 2); ctx.fillRect(-6, -2, 9, 2); ctx.fillRect(-6, 3, 11, 2); ctx.restore(); }
  // the robe (drawn facing +x: a long cloak behind, two sleeves)
  ctx.save(); ctx.scale(1 + br, 1 - br);
  ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.55); ctx.quadraticCurveTo(-r * 0.4, -r * 1.1, -r * 1.25, -r * 0.6); ctx.lineTo(-r * 1.1, r * 0.6); ctx.quadraticCurveTo(-r * 0.4, r * 1.1, r * 0.5, r * 0.55); ctx.closePath();
  const g = ctx.createLinearGradient(-r, 0, r, 0); g.addColorStop(0, '#3a2c6a'); g.addColorStop(0.6, '#6a58b0'); g.addColorStop(1, '#d8ccff'); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.strokeStyle = '#e8c46a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(r * 0.4, -r * 0.5); ctx.quadraticCurveTo(-r * 0.4, -r * 1.0, -r * 1.15, -r * 0.55); ctx.moveTo(r * 0.4, r * 0.5); ctx.quadraticCurveTo(-r * 0.4, r * 1.0, -r * 1.05, r * 0.55); ctx.stroke();
  for (let i = 0; i < 7; i++) { const x = -r * 0.9 + i * r * 0.2, y = Math.sin(i * 1.7) * r * 0.4; ctx.fillStyle = '#fff6dc'; ctx.fillRect(x, y, 2.5, 2.5); }
  ctx.restore();
  // the open book (its heart)
  ctx.save(); ctx.translate(r * 0.15, 0);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(r * 0.12, s * r * 0.25, 0, s * r * 0.5); ctx.lineTo(r * 0.5, s * r * 0.45); ctx.quadraticCurveTo(r * 0.6, s * r * 0.22, r * 0.5, 0); ctx.closePath(); ctx.fillStyle = '#fff6dc'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.globalCompositeOperation = 'lighter'; bloom(ctx, r * 0.25, 0, r * 0.6, '#ffe9a0', 0.8); ctx.restore();
  // the hood and the starlit face
  circle(ctx, r * 0.55, 0, r * 0.38, '#2a2050', 3.5);
  circle(ctx, r * 0.68, 0, r * 0.22, '#fff1b8', 0);
  for (const s of [-1, 1]) circle(ctx, r * 0.74, s * r * 0.08, 3, INK, 0);
  // the crown of quills
  for (let i = 0; i < 6; i++) { const a = (i - 2.5) * 0.28; ctx.save(); ctx.translate(r * 0.55 + Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(r * 0.45, 0); ctx.lineTo(0, 3); ctx.closePath(); ctx.fillStyle = '#fff6dc'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); }
  // ink wisps rising off it
  for (let i = 0; i < 5; i++) { const ph = (t * 0.6 + i / 5) % 1; ctx.globalAlpha = (1 - ph) * 0.6; circle(ctx, -r * (0.2 + ph * 1.2), Math.sin(i * 2 + t) * r * 0.6, 4 + ph * 6, '#1a1030', 0); }
  ctx.globalAlpha = 1;
}
Object.assign(ENEMY_DRAW, { ultnyx: echo('nyxara', '#c9a0ff'), ultorr: echo('orrery', '#ffe9a0'), ultzer: echo('zerath', '#a8f4ff'), ultvor: echo('raidboss', '#b8a4ff'), ultaeon: aeon });
