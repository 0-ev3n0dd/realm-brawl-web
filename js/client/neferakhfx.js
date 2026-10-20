// Neferakh Unbound, client side (encounter revamp Part 1, sim/neferakh.js): every mechanic's floor art + the music-synced intro and the
// stage tints of the in-gameplay transitions. The answer is always drawn: hourglass numbers + the sand that settled (safe), the golden
// scarab's gap + its arrow to the next gap, the sundial's shade + the way it turns (and the flip warning), each hero's HEART / FEATHER
// mark, the inhale streaks, the cartouche glyphs written over his head. Called from client/trialfx.js when V.k === 'nf'.
import { INK, circle } from './art.js';
import { drawText } from './textcache.js';
import { NEF } from '../sim/neferakh.js';
import { VULN } from '../sim/savage.js';
import { TRIAL_R } from '../sim/trialconst.js';

const TAU = Math.PI * 2, R = TRIAL_R, clamp01 = (v) => Math.max(0, Math.min(1, v));
const label = (ctx, s, x, y, size, col, lw = 5) => drawText(ctx, s, x, y, `bold ${size}px "Lilita One", "Arial Black", sans-serif`, col, 'center', lw, INK, size);
const hash = (i) => { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; return (h >>> 0) / 4294967296; };
/** the intro clock: bars into the first pull (null = not in the intro) */
export const introBars = (V) => (V && V.k === 'nf' && V.st === 'pull' && V.pull >= NEF.pull && V.at < NEF.pull ? Math.max(0, (V.at - 1) / NEF.bar) : null);

/** telegraphs this layer hides: a 3-beat slam only shows its live beat (the later beats wait their turn) */
export function nefTeleHide(V) {
  const hide = new Set(), first = new Map();
  for (const q of V.tele || []) { if (!q.beat || q.done) continue; const key = `${q.k}|${q.x}|${q.y}`, f = first.get(key); if (!f || q.beat < f.beat) first.set(key, q); }
  for (const q of V.tele || []) { if (!q.beat || q.done) continue; const f = first.get(`${q.k}|${q.x}|${q.y}`); if (f && f !== q) hide.add(q.id); }
  // the sandglass: only the next quarter to bury shows at full strength; the rest are ghosts (their hourglass numbers carry the order)
  let nx = null; for (const q of V.tele || []) if (q.k === 'sandq' && !q.done && (!nx || q.d - q.t < nx.d - nx.t)) nx = q;
  return { hide, ghost: (q) => q.k === 'sandq' && !q.done && nx && q !== nx };
}
/** text + pips drawn on a telegraph (trialfx drawTele calls this for nf kinds) */
export function nefTeleLabel(ctx, q, k) {
  if (q.beat) { const n = q.beat; label(ctx, n === 3 ? 'BEAT 3 · HEAVY' : `BEAT ${n}`, q.x, q.y + 6, n === 3 ? 22 : 18, n === 3 ? '#ffffff' : '#ffe0a0', 5); for (let i = 1; i <= 3; i++) circle(ctx, q.x - 28 + (i - 1) * 28, q.y + 32, 7, i < n ? '#5a4a3a' : i === n ? '#ffd23f' : '#fff2c0', 3); return true; }
  if (q.k === 'psun') return true; // (the Pinax tablet draws its own number + rule)
  if (q.k === 'rim') { label(ctx, 'THE RIM BURNS · WALK IN', q.x, q.y + q.r0 + 40, 24, '#ff9a6a', 6); return true; }
  if (q.inv && q.k === 'csun') { label(ctx, 'ECLIPSE · MOON GLYPH = GET OUT', q.x, q.y - q.r - 24, 24, '#ffb0c0', 6); return true; }
  if (q.inv && q.k === 'cmoon') { label(ctx, 'ECLIPSE · SUN GLYPH = GET IN', q.x, q.y + 120, 24, '#ffb0c0', 6); return true; }
  if (q.inv && q.k === 'cscarab' && q.n) { label(ctx, 'SCARAB · THE CROSS', q.x + Math.cos(q.ang) * q.len * 0.5 + 140, q.y + Math.sin(q.ang) * q.len * 0.5 - 140, 22, '#9fe8c0', 6); return true; }
  if (q.k === 'csun') { label(ctx, 'SUN · GET OUT', q.x, q.y - q.r - 24, 24, '#fff2a0', 6); return true; }
  if (q.k === 'cmoon') { label(ctx, 'MOON · GET IN', q.x, q.y + 120, 24, '#cfe0ff', 6); return true; }
  if (q.k === 'cscarab' && q.n) { label(ctx, 'SCARAB · DIAGONALS', q.x + Math.cos(q.ang) * q.len * 0.5 + 140, q.y + Math.sin(q.ang) * q.len * 0.5 - 140, 22, '#9fe8c0', 6); return true; }
  return false;
}
function hourglass(ctx, x, y, n, k, done, safe, t) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#c99a58'; ctx.fillRect(-22, -38, 44, 8); ctx.fillRect(-22, 30, 44, 8); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeRect(-22, -38, 44, 8); ctx.strokeRect(-22, 30, 44, 8);
  ctx.beginPath(); ctx.moveTo(-16, -30); ctx.lineTo(16, -30); ctx.lineTo(3, 0); ctx.lineTo(16, 30); ctx.lineTo(-16, 30); ctx.lineTo(-3, 0); ctx.closePath(); ctx.fillStyle = 'rgba(220,240,255,.35)'; ctx.fill(); ctx.stroke();
  const top = done ? 0 : 1 - k, bot = done ? 1 : k;
  if (top > 0.02) { const h = 26 * top; ctx.beginPath(); ctx.moveTo(-14 * (h / 26) - 2, -h); ctx.lineTo(14 * (h / 26) + 2, -h); ctx.lineTo(2, -2); ctx.lineTo(-2, -2); ctx.closePath(); ctx.fillStyle = '#f0c878'; ctx.fill(); }
  if (bot > 0.02) { const h = 26 * bot; ctx.beginPath(); ctx.moveTo(-15, 28); ctx.lineTo(15, 28); ctx.lineTo(15 - 10 * bot, 28 - h); ctx.lineTo(-15 + 10 * bot, 28 - h); ctx.closePath(); ctx.fillStyle = '#e0a850'; ctx.fill(); }
  if (!done && top > 0.02) { ctx.fillStyle = '#f0c878'; ctx.fillRect(-1, -2, 2, 30 - 26 * bot); }
  ctx.restore();
  label(ctx, String(n), x, y - 54, done ? 26 : 34, safe ? '#7dffb0' : done ? '#a08060' : '#ffffff', 6);
  if (safe) label(ctx, 'SAFE', x, y + 62, 18, '#7dffb0', 5);
  void t;
}
export function drawNefUnder(ctx, V, C, t, b) {
  const O = V.o || {};
  // SANDGLASS: the hourglasses on the rim (number = order), the buried quarters as settled sand; the last one buried is SAFE
  if (O.glass) {
    const live = new Map(); for (const q of V.tele || []) if (q.k === 'sandq' && !q.done) live.set(Math.round(q.ang * 100), q);
    const buried = O.glass.filter((g) => !live.has(Math.round(g.a * 100))), lastN = buried.reduce((m, g) => Math.max(m, g.n), 0);
    for (const g of buried) { const safe = g.n === lastN && buried.length < 4; ctx.save(); ctx.beginPath(); ctx.moveTo(C.x, C.y); ctx.arc(C.x, C.y, R - 6, g.a - Math.PI / 4, g.a + Math.PI / 4); ctx.closePath(); ctx.fillStyle = safe ? 'rgba(125,255,176,.16)' : 'rgba(200,150,80,.30)'; ctx.fill(); if (safe) { ctx.lineWidth = 4; ctx.strokeStyle = '#7dffb0'; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 30; ctx.stroke(); ctx.setLineDash([]); } ctx.restore(); }
    for (const g of O.glass) { const q = live.get(Math.round(g.a * 100)), k = q ? clamp01(q.t / q.d) : 1; hourglass(ctx, g.gx, g.gy, g.n, k, !q, !q && g.n === lastN && buried.length < 4, t); }
    // the order on the floor too (the hourglasses sit on the rim, often off-screen): big numbers mid-quarter, the next one bright
    let nxt = 9; for (const g of O.glass) if (live.has(Math.round(g.a * 100))) nxt = Math.min(nxt, g.n);
    for (const g of O.glass) { const q = live.get(Math.round(g.a * 100)), x = C.x + Math.cos(g.a) * R * 0.48, y = C.y + Math.sin(g.a) * R * 0.48;
      if (q) label(ctx, String(g.n), x, y, g.n === nxt ? 64 : 44, g.n === nxt ? '#ffffff' : 'rgba(255,240,210,.7)', 8);
      else if (g.n === lastN && buried.length < 4) label(ctx, 'SAFE', x, y, 40, '#7dffb0', 7); }
  }
  // SCARAB TIDE: the gap (gold), the golden scarab at its mouth, the arrow to the next gap
  if (O.tide && O.tide.at != null) {
    const T = O.tide, c = Math.cos(T.dir), s = Math.sin(T.dir), o = (T.gi - (T.lanes - 1) / 2) * T.w, mx = C.x - s * o, my = C.y + c * o;
    ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y, R - 4, 0, TAU); ctx.clip();
    const L = R * 2 + 40, x0 = mx - c * L / 2, y0 = my - s * L / 2, hw = T.w / 2 - 3; // (the lanes are drawn 10 px narrower than their spacing: the strip is the true safe width)
    ctx.beginPath(); ctx.moveTo(x0 - s * hw, y0 + c * hw); ctx.lineTo(x0 - s * hw + c * L, y0 + c * hw + s * L); ctx.lineTo(x0 + s * hw + c * L, y0 - c * hw + s * L); ctx.lineTo(x0 + s * hw, y0 - c * hw); ctx.closePath();
    ctx.fillStyle = 'rgba(255,214,90,.18)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#ffd86a'; ctx.setLineDash([18, 12]); ctx.lineDashOffset = -t * 60; ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    // chevrons down the whole gap, on the side the next gap opens (readable wherever you stand)
    if (T.wave < T.waves) { ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y, R - 4, 0, TAU); ctx.clip(); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; const pa = Math.atan2(c * T.step, -s * T.step);
      for (let d = -R; d <= R; d += 170) { const px = mx + c * d - s * T.step * (T.w * 0.5 - 18), py = my + s * d + c * T.step * (T.w * 0.5 - 18); ctx.beginPath(); ctx.moveTo(px + Math.cos(pa) * 16, py + Math.sin(pa) * 16); ctx.lineTo(px + Math.cos(pa + 2.5) * 13, py + Math.sin(pa + 2.5) * 13); ctx.lineTo(px + Math.cos(pa - 2.5) * 13, py + Math.sin(pa - 2.5) * 13); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.restore(); }
    // the golden scarab at the rim + the arrow to where the gap goes next
    const bx = mx - c * (R - 40), by = my - s * (R - 40);
    ctx.save(); ctx.translate(bx, by); ctx.rotate(T.dir); ctx.beginPath(); ctx.ellipse(0, 0, 22, 16, 0, 0, TAU); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.lineWidth = 2; ctx.stroke(); circle(ctx, 22, 0, 8, '#b08a20', 3); ctx.restore();
    if (T.wave < T.waves) { const ax = bx - s * T.step * 70, ay = by + c * T.step * 70, a = Math.atan2(c * T.step, -s * T.step);
      ctx.save(); ctx.beginPath(); ctx.moveTo(ax + Math.cos(a) * 26, ay + Math.sin(a) * 26); ctx.lineTo(ax + Math.cos(a + 2.4) * 20, ay + Math.sin(a + 2.4) * 20); ctx.lineTo(ax + Math.cos(a - 2.4) * 20, ay + Math.sin(a - 2.4) * 20); ctx.closePath(); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
      label(ctx, 'NEXT', ax - s * T.step * 40, ay + c * T.step * 40, 16, '#ffd86a', 4); }
    label(ctx, `WAVE ${T.wave}/${T.waves}`, bx - c * 50, by - s * 50 - 30, 15, '#fff2c0', 4);
  }
  // SUNDIAL: the noon light everywhere but the shade wedge (and the cool ring at his feet); the arrow shows the turn
  if (O.dial) {
    const D = O.dial, a0 = D.a - D.arc / 2, a1 = D.a + D.arc / 2;
    ctx.save();
    if (D.on) { ctx.beginPath(); ctx.arc(C.x, C.y, R, 0, TAU); ctx.moveTo(D.x, D.y); ctx.arc(D.x, D.y, R * 2.2, a1, a0, true); ctx.closePath(); ctx.fillStyle = `rgba(255,236,150,${0.26 + 0.06 * Math.sin(t * 9)})`; ctx.fill('evenodd'); }
    ctx.beginPath(); ctx.moveTo(D.x, D.y); ctx.arc(D.x, D.y, R * 2.2, a0, a1); ctx.closePath(); ctx.save(); ctx.clip(); ctx.beginPath(); ctx.arc(C.x, C.y, R, 0, TAU); ctx.fillStyle = D.on ? 'rgba(30,50,120,.36)' : 'rgba(30,50,120,.18)'; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(D.x, D.y); ctx.lineTo(D.x + Math.cos(a0) * R * 1.5, D.y + Math.sin(a0) * R * 1.5); ctx.moveTo(D.x, D.y); ctx.lineTo(D.x + Math.cos(a1) * R * 1.5, D.y + Math.sin(a1) * R * 1.5); ctx.lineWidth = 4; ctx.strokeStyle = '#5cff9d'; ctx.setLineDash(D.on ? [] : [14, 10]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(D.x, D.y, D.inner, 0, TAU); ctx.fillStyle = 'rgba(30,50,120,.30)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#5cff9d'; ctx.stroke();
    // the turn arrow: an arc ahead of the shade's leading edge
    const lead = D.dir > 0 ? a1 : a0, rr = 330, sweep = 0.5 * D.dir, aa = lead + sweep;
    ctx.beginPath(); ctx.arc(D.x, D.y, rr, Math.min(lead, aa), Math.max(lead, aa)); ctx.lineWidth = 8; ctx.strokeStyle = D.flip ? (Math.sin(t * 16) > 0 ? '#ff4d5e' : '#ffffff') : '#ffffff'; ctx.stroke();
    const hx = D.x + Math.cos(aa) * rr, hy = D.y + Math.sin(aa) * rr, ha = aa + D.dir * Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(hx + Math.cos(ha) * 22, hy + Math.sin(ha) * 22); ctx.lineTo(hx + Math.cos(ha + 2.4) * 18, hy + Math.sin(ha + 2.4) * 18); ctx.lineTo(hx + Math.cos(ha - 2.4) * 18, hy + Math.sin(ha - 2.4) * 18); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    const mx = D.x + Math.cos(D.a) * 250, my = D.y + Math.sin(D.a) * 250;
    label(ctx, D.flip ? 'IT TURNS BACK!' : D.on ? 'SHADE' : 'THE SHADE · STAND HERE', mx, my, D.flip ? 26 : 22, D.flip ? '#ff8a9a' : '#9fffc8', 6);
    ctx.restore();
  }
  // (Savage) BALANCE OF DAY AND NIGHT: the four braziers (sun gold, moon blue) and their reach; a countdown ring on each
  if (O.bal) { const B = O.bal, k = clamp01((B.t0 || 0) / Math.max(1, B.at));
    for (const q of B.br) { const sun = q.k === 'sun', col = sun ? '#ffd23f' : '#9fc0ff';
      ctx.save(); ctx.globalAlpha = 0.22; circle(ctx, q.x, q.y, B.brR, col, 0); ctx.restore(); circle(ctx, q.x, q.y, B.brR, null, 4, col);
      ctx.beginPath(); ctx.arc(q.x, q.y, B.brR + 10, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k)); ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      glyph(ctx, sun ? 'sun' : 'moon', q.x, q.y - 4, 54); label(ctx, sun ? 'SUN BRAZIER' : 'MOON BRAZIER', q.x, q.y + B.brR + 26, 17, col, 5);
      if (B.inv && B.sw && !B.swd) { const w = clamp01((B.t0 || 0) / B.sw); ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 14); circle(ctx, q.x, q.y, B.brR + 22, null, 6, sun ? '#9fc0ff' : '#ffd23f'); ctx.restore();
        label(ctx, `SWAPS → ${sun ? 'MOON' : 'SUN'} ${Math.max(0, (B.sw - (B.t0 || 0)) / 60).toFixed(1)}s`, q.x, q.y - B.brR - 22, 18, sun ? '#9fc0ff' : '#ffd23f', 5); void w; } } }
  // (Savage) THE PINAX: four corner tablets; number = order; SUN = get off, MOON = someone stands on it; the next one pulses, judged ones fade
  if (O.pinax) { const X = O.pinax, showing = X.rev && X.t < X.show;
    if (X.rev) label(ctx, showing ? 'READ THE ORDER...' : 'REVERSED · 4 → 1', C.x, C.y - R * 0.12, showing ? 34 : 40, showing ? '#fff2c0' : '#ff9ab0', 7);
    for (const q of X.tiles) { const L = q.at - X.t, done = L < 0, next = q.n === X.next, sun = q.k === 'sun', col = sun ? '#ffd23f' : '#9fc0ff';
      ctx.save(); ctx.globalAlpha = done ? 0.18 : next ? 0.42 + 0.14 * Math.sin(t * 10) : 0.26; ctx.fillStyle = sun ? '#d89a2a' : '#3a5aa8'; ctx.fillRect(q.x - q.h, q.y - q.h, q.h * 2, q.h * 2); ctx.restore();
      ctx.save(); ctx.lineWidth = next ? 6 : 4; ctx.strokeStyle = done ? 'rgba(255,255,255,.3)' : col; ctx.setLineDash(sun ? [] : [16, 10]); ctx.lineDashOffset = -t * 40; ctx.strokeRect(q.x - q.h, q.y - q.h, q.h * 2, q.h * 2); ctx.setLineDash([]); ctx.restore();
      if (!done) { const f = clamp01(L / 240); ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(q.x - q.h, q.y + q.h - 10, q.h * 2 * (1 - f), 10); ctx.restore();
        glyph(ctx, sun ? 'sun' : 'moon', q.x, q.y - 30, next ? 70 : 54); label(ctx, String(q.n), q.x, q.y + 36, next ? 52 : 38, next ? '#ffffff' : 'rgba(255,240,210,.8)', 7);
        label(ctx, sun ? 'SUN · GET OFF' : X.need > 1 ? `MOON · ${X.need} ON IT` : 'MOON · STAND ON IT', q.x, q.y - q.h - 18, next ? 20 : 16, col, 5); } } }
  // (Eclipse) DEVOURING COURT: sand streaks blowing OUT of him, the burning rim, the coming count's glyph
  if (O.exhale) { const X = O.exhale, k = clamp01(X.t / Math.max(1, X.d));
    ctx.save(); ctx.strokeStyle = 'rgba(255,150,110,.6)'; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i < 36; i++) { const a = hash(i) * TAU, ph = (t * (0.9 + 0.6 * k) + hash(i + 7)) % 1, r1 = ph * R * 1.05 + 60, r2 = r1 + 40 + 60 * k; ctx.moveTo(X.x + Math.cos(a) * r1, X.y + Math.sin(a) * r1); ctx.lineTo(X.x + Math.cos(a) * r2, X.y + Math.sin(a) * r2); }
    ctx.stroke(); ctx.restore();
    if (X.t <= X.d) label(ctx, 'WALK IN AGAINST THE PUSH', X.x, X.y + 140, 20, '#ff9a6a', 5);
    glyph(ctx, X.g, X.x, X.y - 150, 56); label(ctx, 'THEN: ' + ({ sun: 'SUN · OUT', moon: 'MOON · IN', scarab: 'SCARAB · DIAGONALS' }[X.g] || ''), X.x, X.y - 98, 18, '#ffe0c0', 5); }
  // DEVOUR: sand streaks pouring into his mouth
  if (O.inhale) {
    const I = O.inhale, k = clamp01(I.t / Math.max(1, I.d));
    ctx.save(); ctx.strokeStyle = 'rgba(240,200,130,.6)'; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i < 36; i++) { const a = hash(i) * TAU, ph = (t * (0.9 + 0.6 * k) + hash(i + 7)) % 1, r1 = (1 - ph) * R * 1.05 + 60, r2 = r1 + 40 + 60 * k; ctx.moveTo(I.x + Math.cos(a) * r1, I.y + Math.sin(a) * r1); ctx.lineTo(I.x + Math.cos(a) * r2, I.y + Math.sin(a) * r2); }
    ctx.stroke(); ctx.globalAlpha = 0.2 + 0.25 * k; circle(ctx, I.x, I.y, 70, '#1a0c04', 0); ctx.restore();
    label(ctx, 'WALK AGAINST THE PULL', I.x, I.y + 140, 20, '#ffb070', 5);
  }
  void b;
}
function glyph(ctx, g, x, y, s) {
  ctx.save(); ctx.translate(x, y);
  if (g === 'sun') { circle(ctx, 0, 0, s * 0.45, '#ffd23f', 3); ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.moveTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55); ctx.lineTo(Math.cos(a) * s * 0.8, Math.sin(a) * s * 0.8); } ctx.lineWidth = 4; ctx.strokeStyle = '#ffd23f'; ctx.stroke(); }
  else if (g === 'moon') { ctx.beginPath(); ctx.arc(0, 0, s * 0.55, 0, TAU); ctx.arc(s * 0.25, -s * 0.12, s * 0.45, 0, TAU, true); ctx.fillStyle = '#b8c8ff'; ctx.fill('evenodd'); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
  else if (g === 'scarab') { ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.55, 0, 0, TAU); ctx.fillStyle = '#4fd0a0'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -s * 0.55); ctx.lineTo(0, s * 0.55); ctx.moveTo(-s * 0.7, -s * 0.2); ctx.lineTo(s * 0.7, -s * 0.2); ctx.stroke(); }
  else if (g === 'scales') { ctx.lineWidth = 3; ctx.strokeStyle = '#ffe0c0'; ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.2); ctx.lineTo(s * 0.5, -s * 0.2); ctx.moveTo(0, -s * 0.5); ctx.lineTo(0, s * 0.45); ctx.stroke(); ctx.beginPath(); ctx.arc(-s * 0.36, s * 0.05, s * 0.18, 0, Math.PI); ctx.moveTo(s * 0.54, s * 0.05); ctx.arc(s * 0.36, s * 0.05, s * 0.18, 0, Math.PI); ctx.fillStyle = '#ff9ab0'; ctx.fill(); ctx.stroke(); }
  else label(ctx, '?', 0, 10, Math.round(s * 0.9), '#fff2c0', 5);
  ctx.restore();
}
export function drawNefOver(ctx, V, C, t, b, sim, local) {
  const O = V.o || {};
  // HEART / FEATHER: every hero's mark over their head; yours is big and says what to do
  if (O.marks) for (const id in O.marks) {
    const p = sim.players.get(+id) || sim.players.get(id); if (!p || p.dead) continue;
    const mk = O.marks[id], me = local && p.id === local.id, x = p.x, y = p.y - (me ? 96 : 80), s = me ? 1.3 : 0.9, pop = O.scales && O.scales.sw ? 1 + 0.15 * Math.max(0, Math.sin(t * 10)) : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(s * pop, s * pop);
    if (mk === 'heart') { ctx.beginPath(); ctx.moveTo(0, 12); ctx.bezierCurveTo(-26, -6, -12, -26, 0, -12); ctx.bezierCurveTo(12, -26, 26, -6, 0, 12); ctx.fillStyle = '#ff5a7a'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(-4, 16); ctx.quadraticCurveTo(-14, -6, 6, -22); ctx.quadraticCurveTo(10, 0, -4, 16); ctx.fillStyle = '#f4fbff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.beginPath(); ctx.moveTo(-4, 16); ctx.lineTo(4, -12); ctx.lineWidth = 1.6; ctx.stroke(); }
    ctx.restore();
    if (me) label(ctx, mk === 'heart' ? 'HEART · CLOSE TO HIM' : 'FEATHER · FAR OUT', x, y - 34, 18, mk === 'heart' ? '#ff9ab0' : '#e8f4ff', 5);
  }
  // (Savage) BALANCE: each hero's charge over their head (sun / moon) + the pairing reach; yours says what you need
  if (O.bal) { const B = O.bal, k = clamp01((B.t0 || 0) / Math.max(1, B.at));
    for (const id in B.ch) { const p = sim.players.get(+id) || sim.players.get(id); if (!p || p.dead) continue;
      const sun = B.ch[id] === 'sun', me = local && p.id === local.id, col = sun ? '#ffd23f' : '#9fc0ff', y = p.y - (me ? 100 : 82);
      ctx.save(); ctx.globalAlpha = 0.14 + 0.1 * k; circle(ctx, p.x, p.y, B.r, col, 0); ctx.restore(); ctx.save(); ctx.setLineDash([10, 8]); circle(ctx, p.x, p.y, B.r, null, 3, col); ctx.restore();
      glyph(ctx, sun ? 'sun' : 'moon', p.x, y, me ? 56 : 40);
      if (me) { ctx.beginPath(); ctx.arc(p.x, y, 34, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k)); ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        label(ctx, B.inv ? (sun ? 'SUN · STAND WITH A SUN' : 'MOON · STAND WITH A MOON') : sun ? 'SUN · STAND WITH A MOON' : 'MOON · STAND WITH A SUN', p.x, y - 46, 18, col, 5); } } }
  // SUN-STRUCK: the sun's light pinned on him (the damage window)
  if (O.struck && O.struck.t > 0 && b) { const k = O.struck.t / O.struck.d; ctx.save(); ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 8); circle(ctx, b.x, b.y, b.r * 1.6, '#fff2a0', 0); ctx.restore(); ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.7, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.lineWidth = 7; ctx.strokeStyle = '#ffd23f'; ctx.stroke(); label(ctx, 'SUN-STRUCK', b.x, b.y - b.r - 60, 24, '#fff2a0', 6); }
  if (V.st === 'eclipse') { drawEclipseCine(ctx, V, C, t, b); return; }
  if (V.form && b && !b.dead) drawEclipseForm(ctx, b, t, 1);
  // the intro (first pull only): the seal cracks, the sand runs, the sun is eaten, he rises
  const ib = introBars(V); if (ib != null) drawIntroWorld(ctx, ib, C, t, b);
  // the transitions' stages (the fight never pauses: these tint the live arena)
  const cn = sim.cine && sim.cine.find((c) => c.enc === 'nf' || c.stage === 'night' || c.stage === 'blacksun' || c.stage === 'verdict');
  if (cn && cn.stage === 'verdict') { drawVerdictCine(ctx, cn, C, t, b); return; }
  if (cn) { const k = Math.sin(Math.PI * clamp01(cn.t / cn.dur)); ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y, R + 200, 0, TAU); ctx.fillStyle = cn.stage === 'blacksun' ? `rgba(20,4,40,${0.55 * k})` : `rgba(12,10,40,${0.45 * k})`; ctx.fill(); ctx.fillStyle = `rgba(255,255,255,${0.7 * k})`; for (let i = 0; i < 40; i++) ctx.fillRect(C.x + (hash(i) - 0.5) * R * 2, C.y + (hash(i + 40) - 0.5) * R * 2, 3, 3); ctx.restore();
    const sx = C.x, sy = C.y - R * 0.55; ctx.save(); ctx.globalAlpha = k; circle(ctx, sx, sy, 70, cn.stage === 'blacksun' ? '#08040e' : '#e8ecff', 5); if (cn.stage === 'blacksun') circle(ctx, sx, sy, 82, null, 5, '#c9a2ff'); else circle(ctx, sx + 26, sy - 10, 60, '#0c0a28', 0); ctx.restore(); }
}
/** (Savage) THE COURT OF THE BLACK SUN - the final-phase cinematic, in gameplay: the throne goes crimson-dark, six judgement
 *  pillars rise round the rim one by one, the black sun climbs behind him with a red corona, the scales hang over his head. */
function drawVerdictCine(ctx, cn, C, t, b) {
  const u = clamp01(cn.t / cn.dur), k = Math.sin(Math.PI * Math.min(1, u * 1.15)), rise = clamp01(u * 1.6);
  ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y, R + 220, 0, TAU); ctx.fillStyle = `rgba(40,4,6,${0.62 * k})`; ctx.fill(); ctx.restore();
  for (let i = 0; i < 6; i++) { const on = clamp01(u * 7 - i * 0.9); if (on <= 0) continue; const a = -Math.PI / 2 + (i + 0.5) / 6 * TAU, x = C.x + Math.cos(a) * (R - 40), y = C.y + Math.sin(a) * (R - 40), hgt = 140 * on;
    ctx.save(); ctx.globalAlpha = 0.9 * k; ctx.fillStyle = '#2a0c0a'; ctx.fillRect(x - 18, y - hgt, 36, hgt); ctx.lineWidth = 3; ctx.strokeStyle = '#ff6a3d'; ctx.strokeRect(x - 18, y - hgt, 36, hgt);
    ctx.globalAlpha = k * on; circle(ctx, x, y - hgt - 14, 14, '#ff6a3d', 3); ctx.restore(); }
  const bx = b ? b.x : C.x, by = b ? b.y : C.y - 40, sx = bx, sy = by - 160 - 160 * rise, cr = 90 + 8 * Math.sin(t * 5);
  ctx.save(); ctx.globalAlpha = 0.55 * k; circle(ctx, sx, sy, cr + 34, '#ff3a1a', 0); ctx.globalAlpha = k; circle(ctx, sx, sy, cr, '#07030a', 6); circle(ctx, sx, sy, cr + 12, null, 5, '#ff8a4a');
  ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + t * 0.6; ctx.moveTo(sx + Math.cos(a) * (cr + 18), sy + Math.sin(a) * (cr + 18)); ctx.lineTo(sx + Math.cos(a) * (cr + 46 + 10 * Math.sin(t * 7 + i)), sy + Math.sin(a) * (cr + 46 + 10 * Math.sin(t * 7 + i))); } ctx.lineWidth = 4; ctx.strokeStyle = '#ffb07a'; ctx.stroke();
  // the scales of the court over his head (they tip once, the gavel)
  const tip = Math.sin(clamp01((u - 0.55) / 0.2) * Math.PI) * 0.22, hx = bx, hy = by - 120;
  ctx.translate(hx, hy); ctx.rotate(tip); ctx.lineWidth = 5; ctx.strokeStyle = '#ffd8a0'; ctx.beginPath(); ctx.moveTo(-90, 0); ctx.lineTo(90, 0); ctx.moveTo(0, 0); ctx.lineTo(0, 36); ctx.stroke();
  for (const sx2 of [-90, 90]) { ctx.beginPath(); ctx.moveTo(sx2, 0); ctx.lineTo(sx2 - 22, 34); ctx.lineTo(sx2 + 22, 34); ctx.closePath(); ctx.stroke(); }
  ctx.restore();
  if (u > 0.35 && u < 0.95) label(ctx, 'THE COURT OF THE BLACK SUN', C.x, C.y + R * 0.38, 34, '#ff8a5a', 8);
}
function drawIntroWorld(ctx, ib, C, t, b) {
  const cx = C.x, cy = C.y - 40;
  // bar 1: the seal cracks - gold fissures race out of the sun inlay
  { const k = clamp01(ib / 0.8), fade = ib > 3 ? clamp01(1 - (ib - 3)) : 1; if (fade > 0) { ctx.save(); ctx.globalAlpha = fade; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i < 9; i++) { let a = i / 9 * TAU + hash(i) * 0.4, x = cx + Math.cos(a) * 60, y = cy + Math.sin(a) * 60; ctx.moveTo(x, y); const steps = Math.ceil(6 * k); for (let j = 0; j < steps; j++) { a += (hash(i * 9 + j) - 0.5) * 0.9; x += Math.cos(a) * 34; y += Math.sin(a) * 34; ctx.lineTo(x, y); } } ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(255,150,40,.55)'; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff2a0'; ctx.stroke(); ctx.restore(); } }
  // bar 2: the sand runs from the rim in eight streams
  if (ib >= 1 && ib < 4) { const k = clamp01(ib - 1), fade = ib > 3 ? 1 - (ib - 3) : 1; ctx.save(); ctx.globalAlpha = fade * 0.8; ctx.fillStyle = '#f0c878'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; for (let j = 0; j < 14; j++) { const f = ((t * 0.9 + j / 14) % 1) * k, r = R - 20 - f * (R - 200); ctx.fillRect(C.x + Math.cos(a) * r - 3 + Math.sin(j) * 6, C.y + Math.sin(a) * r - 3, 6, 6); } } ctx.restore(); }
  // bar 3: the sun is eaten - darkness falls on the throne
  if (ib >= 2) { const k = ib < 3 ? clamp01(ib - 2) : ib < 4 ? 1 : clamp01(1 - (ib - 4) * 1.5); ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y, R + 220, 0, TAU); ctx.fillStyle = `rgba(14,6,2,${0.5 * k})`; ctx.fill(); ctx.restore(); }
  // bar 4: he rises - a pillar of light on him
  if (ib >= 3 && b) { const k = clamp01(ib - 3), f = ib > 4.6 ? clamp01(1 - (ib - 4.6) * 2.5) : 1; ctx.save(); ctx.globalAlpha = 0.55 * f; const g = ctx.createLinearGradient(0, b.y - 600, 0, b.y); g.addColorStop(0, 'rgba(255,242,160,0)'); g.addColorStop(1, '#fff2a0'); ctx.fillStyle = g; ctx.fillRect(b.x - 60 * k - 10, b.y - 600, 120 * k + 20, 600); ctx.globalAlpha = f; circle(ctx, b.x, b.y, b.r * (1 + 0.6 * k), null, 6, '#ffd23f'); ctx.restore(); }
}
/** the sky over the throne during the intro: the sun, eaten by a black disc (bar 3), screen-space-free (world, over the boss) */
export function drawNefSky(ctx, V, C, t, b) {
  const ib = introBars(V); if (ib == null || ib < 1.5) return;
  const sx = b ? b.x : C.x, sy = (b ? b.y : C.y - 200) - 250, k = clamp01((ib - 2) / 0.9), f = ib > 4.4 ? clamp01(1 - (ib - 4.4) * 2) : clamp01((ib - 1.5) * 2);
  ctx.save(); ctx.globalAlpha = f; circle(ctx, sx, sy, 96, '#ffd86a', 5); circle(ctx, sx, sy, 76, '#fff2a0', 0);
  ctx.beginPath(); ctx.arc(sx - 200 + 200 * k, sy - 30 + 30 * k, 98, 0, TAU); ctx.fillStyle = '#0a0604'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#c9a2ff'; if (k >= 1) ctx.stroke(); ctx.restore(); void t;
}
/** CARTOUCHE (HUD: always on screen - it is a memory check): the glyphs as he writes them, then hidden ('?'); the one resolving next lit */
/** (Savage) live Vuln stacks by hero id, fed from the 'savage' events (works on a co-op snapshot too) */
export const NEF_VULN = new Map();
export function nefSavageEvent(ev) { if (ev.type === 'savage' && ev.ph === 'vuln') { if (ev.n >= 2) NEF_VULN.delete(ev.pid); else NEF_VULN.set(ev.pid, { n: ev.n, by: ev.by, at: Date.now(), until: Date.now() + VULN.t / 60 * 1000 }); } if (ev.type === 'trial' && (ev.ph === 'wipe' || ev.ph === 'revive' || ev.ph === 'pull')) NEF_VULN.clear(); }
/** the Vuln HUD icon (any Savage): a cracked red shield, the stack count, the time left and the rule */
export function drawVulnHud(ctx, p, w, h, sc, t) {
  const q = p && NEF_VULN.get(p.id); if (!q || p.dead) return; const left = (q.until - Date.now()) / 1000; if (left <= 0) { NEF_VULN.delete(p.id); return; }
  const x = w / 2 - 210 * sc, y = h - 168 * sc, s = 30 * sc, pulse = left < 5 ? 0.6 + 0.4 * Math.sin(t * 12) : 1;
  ctx.save(); ctx.globalAlpha = pulse; ctx.translate(x, y); ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.85, -s * 0.6); ctx.lineTo(s * 0.7, s * 0.4); ctx.lineTo(0, s); ctx.lineTo(-s * 0.7, s * 0.4); ctx.lineTo(-s * 0.85, -s * 0.6); ctx.closePath(); ctx.fillStyle = '#c2242c'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.8); ctx.lineTo(s * 0.12, -s * 0.2); ctx.lineTo(-s * 0.1, s * 0.15); ctx.lineTo(s * 0.15, s * 0.7); ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffd0d0'; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, s * 1.25, -Math.PI / 2, -Math.PI / 2 + TAU * (left / (VULN.t / 60))); ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.restore();
  label(ctx, `VULN ×${q.n} · ${Math.ceil(left)}s`, x, y + s + 20 * sc, Math.round(16 * sc), '#ff8a8a', 4);
  label(ctx, 'another failed solve = KO', x, y + s + 38 * sc, Math.round(12 * sc), '#ffd0d0', 3);
}
/** (Savage) BLACK SUN VERDICT (HUD): the whole sentence, the count resolving next lit, a bar to it */
function drawVerdictHud(ctx, V, w, h, sc, t) {
  const Q = V.o.verdict, n = Q.g.length, s = 48 * sc, gap = 66 * sc, x0 = w / 2 - (n - 1) * gap / 2, y = h * 0.42, bw = (n - 1) * gap + 90 * sc;
  ctx.save(); ctx.fillStyle = 'rgba(36,6,8,.88)'; ctx.fillRect(w / 2 - bw / 2, y - 38 * sc, bw, 76 * sc); ctx.lineWidth = 4; ctx.strokeStyle = '#ff6a3d'; ctx.strokeRect(w / 2 - bw / 2, y - 38 * sc, bw, 76 * sc); ctx.restore();
  const AT = (i) => (Q.at ? Q.at[i] : Q.at0 + i * Q.every);
  if (Q.inv) { ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = '#ff5a7a'; ctx.setLineDash([8, 6]); ctx.strokeRect(w / 2 - bw / 2 - 6, y - 44 * sc, bw + 12, 88 * sc); ctx.restore(); }
  for (let i = 0; i < n; i++) { const x = x0 + i * gap, at = AT(i), L = at - Q.t, past = L < 0, cur = !past && (i === 0 || AT(i - 1) - Q.t < 0);
    if (cur) { ctx.save(); ctx.globalAlpha = 0.45 + 0.3 * Math.sin(t * 12); circle(ctx, x, y, 32 * sc, '#ffd0b0', 0); ctx.restore(); }
    ctx.save(); ctx.globalAlpha = past ? 0.25 : 1; glyph(ctx, Q.g[i], x, y, s); ctx.restore();
    label(ctx, String(i + 1), x, y + 52 * sc, Math.round(15 * sc), cur ? '#ffffff' : '#c98a6a', 4);
    if (cur) { const f = clamp01(L / Q.every); ctx.save(); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 24 * sc, y + 30 * sc, 48 * sc * f, 5 * sc); ctx.restore(); } }
  const nx = Q.g.findIndex((_, i) => AT(i) - Q.t >= 0), g = Q.g[nx];
  const say = (Q.inv ? { sun: 'SUN · INVERTED: GET IN', moon: 'MOON · INVERTED: GET OUT', scarab: 'SCARAB · THE CROSS', scales: 'SCALES · YOUR MARK' } : { sun: 'SUN · GET OUT', moon: 'MOON · GET IN', scarab: 'SCARAB · DIAGONALS', scales: 'SCALES · YOUR MARK' })[g] || '';
  label(ctx, nx >= 0 ? `${Q.inv ? 'THE ECLIPSE VERDICT' : 'THE VERDICT'} · COUNT ${nx + 1}/${n} · ${say}` : 'THE VERDICT', w / 2, y - 50 * sc, Math.round(17 * sc), '#ffb08a', 4);
}
export function drawNefHud(ctx, V, w, h, sc, t, p) {
  if (V.st === 'eclipse') drawEclipseHud(ctx, V, w, h, sc, t);
  if (V.sv) drawVulnHud(ctx, p, w, h, sc, t);
  if (V.o && V.o.verdict && V.st === 'fight') drawVerdictHud(ctx, V, w, h, sc, t);
  const K = V.o && V.o.cart; if (!K || V.st !== 'fight') return;
  const n = K.g.length, s = 46 * sc, gap = 62 * sc, x0 = w / 2 - (n - 1) * gap / 2, y = h * 0.42;
  ctx.save(); ctx.fillStyle = 'rgba(40,26,10,.85)'; const bw = (n - 1) * gap + 84 * sc; ctx.fillRect(w / 2 - bw / 2, y - 36 * sc, bw, 72 * sc); ctx.lineWidth = 4; ctx.strokeStyle = '#ffd86a'; ctx.strokeRect(w / 2 - bw / 2, y - 36 * sc, bw, 72 * sc);
  ctx.beginPath(); ctx.ellipse(w / 2 - bw / 2, y, 10 * sc, 36 * sc, 0, 0, TAU); ctx.moveTo(w / 2 + bw / 2 + 10 * sc, y); ctx.ellipse(w / 2 + bw / 2, y, 10 * sc, 36 * sc, 0, 0, TAU); ctx.fillStyle = '#c99a58'; ctx.fill(); ctx.stroke(); ctx.restore();
  for (let i = 0; i < n; i++) {
    const x = x0 + i * gap, shown = i < K.shown, cur = K.next === i + 1, past = K.next > i + 1;
    if (cur) { ctx.save(); ctx.globalAlpha = 0.45 + 0.3 * Math.sin(t * 10); circle(ctx, x, y, 30 * sc, '#ffffff', 0); ctx.restore(); }
    ctx.save(); ctx.globalAlpha = past ? 0.3 : 1; glyph(ctx, shown && (!K.hidden || past) ? K.g[i] : shown ? '?' : null, x, y, s); ctx.restore();
    if (shown) label(ctx, String(i + 1), x, y + 50 * sc, Math.round(15 * sc), cur ? '#ffffff' : '#c9a66a', 4);
  }
  label(ctx, K.hidden ? (K.next ? 'IN THE ORDER WRITTEN' : 'REMEMBER THEM') : 'HE WRITES...', w / 2, y - 48 * sc, Math.round(16 * sc), '#ffe08a', 4);
}
/** the intro title (HUD, bar 5) */
export function drawNefIntroHud(ctx, V, w, h, sc, txt) {
  const ib = introBars(V); if (ib == null || ib < 3.9) return;
  const a = clamp01((ib - 3.9) * 3) * clamp01((5 - ib) * 4 + 0.15), cy = h * 0.32;
  ctx.save(); ctx.globalAlpha = a; const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(48,30,6,.92)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, cy - 56 * sc, w, 110 * sc);
  txt(ctx, V.sv ? 'NEFERAKH UNBOUND · SAVAGE' : V.x ? 'NEFERAKH UNBOUND · EXTREME' : 'NEFERAKH UNBOUND', w / 2, cy, Math.round(50 * sc), V.sv ? '#ff6a3d' : V.x ? '#c9a2ff' : '#ffd86a', 'center', Math.round(9 * sc));
  txt(ctx, V.sv ? 'THE SUN-EATEN THRONE · STRICT SOLVES · A 2ND VULN STACK IS A KO' : 'THE SUN-EATEN THRONE', w / 2, cy + 36 * sc, Math.round(18 * sc), '#fff2c0', 'center', 4); ctx.restore();
}
/** (Savage) the verdict camera: pull back wide so the whole court (six pillars, the black sun) is framed, then hand back */
export function nefVerdictCam(sim, C) { const cn = sim && sim.cine && sim.cine.find((c) => c.stage === 'verdict'); if (!cn) return null; const u = clamp01(cn.t / cn.dur), w = clamp01(u * 4) * clamp01((1 - u) * 4); return { x: C.x, y: C.y - 140, z: 0.6, k: 0.85 * w }; }
/** the intro camera: start wide on the throne, push in on him as he rises */
export function nefIntroCam(V, C, b) { const ib = introBars(V); if (ib == null) return null; const by = b ? b.y : C.y - 200, k = clamp01((ib - 2.4) / 1.8), e = k * k * (3 - 2 * k), w = clamp01(ib * 2) * clamp01((5 - ib) * 2.5); return { x: C.x, y: (C.y - 60) * (1 - e) + (by - 60) * e, z: 0.72 + 0.3 * e, k: 0.9 * w }; } // (k is the frame's blend weight: 0.9 = framed; it lets go over the last 0.4 bar)

// ------------------------------------------------------------------ Savage v2: THE ECLIPSE ASCENDANT
/** the cinematic's clock in seconds of the FULL version (the short retry version maps onto its last beats: the rise + the title) */
const eclSec = (V) => { const s = Math.max(0, (V.at - 1) / 60); return V.eShort ? 9.5 + s * (4.5 / 3) : s; };
const ease = (k) => k * k * (3 - 2 * k);
/** the new form, drawn over his sprite: a corona halo, four arms holding sun / moon / scale / sand, obsidian cracks with molten seams.
 *  k = how far the transformation has come (0..1) */
function drawEclipseForm(ctx, b, t, k) {
  if (k <= 0) return;
  const x = b.x, y = b.y, r = (b.r || 60) * (1 + 0.25 * k);
  ctx.save(); ctx.globalAlpha = 0.55 * k; circle(ctx, x, y - r * 0.4, r * 1.55 + 6 * Math.sin(t * 4), '#ff2a4a', 0); ctx.globalAlpha = k; circle(ctx, x, y - r * 0.4, r * 1.25, '#07030a', 6);
  ctx.beginPath(); for (let i = 0; i < 20; i++) { const a = i / 20 * TAU + t * 0.5, l = r * (1.32 + 0.18 * Math.sin(t * 6 + i)); ctx.moveTo(x + Math.cos(a) * r * 1.27, y - r * 0.4 + Math.sin(a) * r * 1.27); ctx.lineTo(x + Math.cos(a) * l, y - r * 0.4 + Math.sin(a) * l); } ctx.lineWidth = 4; ctx.strokeStyle = '#ff9ab0'; ctx.stroke(); ctx.restore();
  // four arms (two up, two out) with what he judges with
  const arms = [[-1.05, 'sun'], [-0.35, 'moon'], [0.35, 'scales'], [1.05, 'scarab']];
  for (let i = 0; i < 4; i++) { const [a0, g] = arms[i], a = -Math.PI / 2 + a0 + Math.sin(t * 1.6 + i) * 0.08, L = r * 1.5 * ease(clamp01(k * 1.2 - i * 0.05)), hx = x + Math.cos(a) * L, hy = y - r * 0.2 + Math.sin(a) * L;
    ctx.save(); ctx.globalAlpha = k; ctx.lineCap = 'round'; ctx.lineWidth = 16; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x, y - r * 0.2); ctx.lineTo(hx, hy); ctx.stroke(); ctx.lineWidth = 10; ctx.strokeStyle = '#2a1420'; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#ff7a4a'; ctx.stroke(); ctx.restore();
    if (L > r) { ctx.save(); ctx.globalAlpha = k; glyph(ctx, g, hx, hy - 8, 34); ctx.restore(); } }
  // molten seams across the body
  ctx.save(); ctx.globalAlpha = k * (0.7 + 0.3 * Math.sin(t * 5)); ctx.lineWidth = 3; ctx.strokeStyle = '#ffb04a'; ctx.beginPath();
  for (let i = 0; i < 6; i++) { let a = hash(i + 90) * TAU, px = x + Math.cos(a) * r * 0.2, py = y + Math.sin(a) * r * 0.2; ctx.moveTo(px, py); for (let j = 0; j < 4; j++) { a += (hash(i * 5 + j + 3) - 0.5) * 1.4; px += Math.cos(a) * r * 0.22; py += Math.sin(a) * r * 0.22; ctx.lineTo(px, py); } }
  ctx.stroke(); ctx.restore();
}
/** THE ECLIPSE ASCENDANT (world layer), beat by beat (seconds of the full 14 s version):
 *  0 the killing blow + hit-stop · 1 the six Verdict pillars crack, the scales fall and shatter · 3 the black sun drops into his chest,
 *  the floor goes dark, the sand freezes in the air · 5 the inversion: sky and floor flip colours · 7 he rises, re-formed ·
 *  9.5 the title · 11 the shockwave · 13 the camera hands back */
function drawEclipseCine(ctx, V, C, t, b) {
  const s = eclSec(V), bx = b ? b.x : C.x, by = b ? b.y : C.y - 40, out = clamp01((14 - s) / 0.8);
  // 0-1: hit-stop flash on him
  if (s < 1.2) { const k = 1 - s / 1.2; ctx.save(); ctx.globalAlpha = 0.8 * k; circle(ctx, bx, by, 120 + 300 * (1 - k), '#fff6e0', 0); ctx.restore(); }
  // 1-3.5: the pillars crack and fall; the scales over him drop and shatter
  if (s >= 1 && s < 4.5) { const u = clamp01((s - 1) / 2), f = clamp01((4.5 - s) / 1);
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i + 0.5) / 6 * TAU, x = C.x + Math.cos(a) * (R - 40), y = C.y + Math.sin(a) * (R - 40), hgt = 140 * (1 - clamp01(u * 1.6 - i * 0.1)), tilt = (hash(i) - 0.5) * u * 1.2;
      ctx.save(); ctx.globalAlpha = f; ctx.translate(x, y); ctx.rotate(tilt); ctx.fillStyle = '#2a0c0a'; ctx.fillRect(-18, -hgt, 36, hgt); ctx.lineWidth = 3; ctx.strokeStyle = '#ff6a3d'; ctx.strokeRect(-18, -hgt, 36, hgt);
      ctx.beginPath(); ctx.moveTo(-18, -hgt * 0.4); ctx.lineTo(4, -hgt * 0.55); ctx.lineTo(18, -hgt * 0.3); ctx.strokeStyle = '#ffd0a0'; ctx.stroke(); ctx.restore(); }
    const fall = ease(clamp01((s - 1.4) / 0.9)), hy = by - 130 + fall * 110, br = clamp01((s - 2.3) / 0.8);
    if (br <= 0) { ctx.save(); ctx.globalAlpha = f; ctx.translate(bx, hy); ctx.rotate(fall * 0.5); ctx.lineWidth = 5; ctx.strokeStyle = '#ffd8a0'; ctx.beginPath(); ctx.moveTo(-90, 0); ctx.lineTo(90, 0); ctx.moveTo(0, 0); ctx.lineTo(0, 36); ctx.stroke(); ctx.restore(); }
    else { ctx.save(); ctx.globalAlpha = f * (1 - br * 0.6); ctx.fillStyle = '#ffd8a0'; for (let i = 0; i < 26; i++) { const a = hash(i + 5) * TAU, d = 30 + br * (120 + 260 * hash(i + 11)); ctx.fillRect(bx + Math.cos(a) * d - 4, hy + Math.sin(a) * d - 4, 8, 8); } ctx.restore(); } }
  // 3-: the floor goes dark; the sand freezes mid-air (motes that stop)
  if (s >= 3) { const k = clamp01((s - 3) / 1.2) * out; ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y, R + 220, 0, TAU); ctx.fillStyle = `rgba(6,2,10,${0.7 * k})`; ctx.fill();
    ctx.fillStyle = 'rgba(240,200,120,.9)'; for (let i = 0; i < 70; i++) { const fr = Math.min(s, 3.4), x = C.x + (hash(i) - 0.5) * R * 2, y = C.y + (hash(i + 70) - 0.5) * R * 2 - fr * 30 * hash(i + 3); ctx.globalAlpha = k * 0.8; ctx.fillRect(x, y, 4, 4); } ctx.restore(); }
  // 3-5: the black sun drops into his chest
  if (s >= 2.6 && s < 5.4) { const u = ease(clamp01((s - 2.6) / 2)), sy = by - 380 + u * 360, rr = 90 * (1 - 0.7 * u); ctx.save(); ctx.globalAlpha = clamp01((5.4 - s) * 2); circle(ctx, bx, sy, rr + 26, '#ff3a1a', 0); circle(ctx, bx, sy, rr, '#07030a', 5); ctx.restore(); }
  // 5-7: the inversion - the floor glyph ring redraws in the opposite colours, a wave sweeping out from him
  if (s >= 5) { const u = clamp01((s - 5) / 1.6), k = out; ctx.save(); ctx.globalAlpha = 0.85 * k; ctx.lineWidth = 10; ctx.strokeStyle = '#ff5a7a'; ctx.beginPath(); ctx.arc(bx, by, 40 + u * (R + 200), 0, TAU); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, x = C.x + Math.cos(a) * R * 0.82, y = C.y + Math.sin(a) * R * 0.82, on = clamp01(u * 12 - i * 0.6); if (on <= 0) continue; ctx.globalAlpha = k * on; glyph(ctx, i % 2 ? 'sun' : 'moon', x, y, 46); ctx.lineWidth = 4; ctx.strokeStyle = '#ff5a7a'; ctx.beginPath(); ctx.moveTo(x - 30, y + 30); ctx.lineTo(x + 30, y - 30); ctx.stroke(); } ctx.restore(); }
  // 7-: he rises re-formed (a pillar of crimson light, the form growing in)
  if (s >= 6.6 && b) { const k = ease(clamp01((s - 6.6) / 2.2)); ctx.save(); ctx.globalAlpha = 0.55 * clamp01((10 - s) / 1.5) * out; const g = ctx.createLinearGradient(0, by - 700, 0, by); g.addColorStop(0, 'rgba(255,60,90,0)'); g.addColorStop(1, '#ff5a7a'); ctx.fillStyle = g; ctx.fillRect(bx - 80 * k - 10, by - 700, 160 * k + 20, 700); ctx.restore(); drawEclipseForm(ctx, b, t, k); }
  // 11-12.5: the shockwave
  if (s >= 11 && s < 12.6) { const u = (s - 11) / 1.6; ctx.save(); ctx.globalAlpha = 1 - u; ctx.lineWidth = 18 * (1 - u) + 4; ctx.strokeStyle = '#ffe0e8'; ctx.beginPath(); ctx.arc(bx, by, 60 + u * (R + 100), 0, TAU); ctx.stroke(); ctx.restore(); }
}
/** the cinematic's HUD: letterbox bars, the title (beat 6), the skip hint on the short retry version */
function drawEclipseHud(ctx, V, w, h, sc, t) {
  const s = eclSec(V), k = clamp01(s / 0.6) * clamp01((14 - s) / 0.6), bar = 70 * sc * k;
  ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, bar); ctx.fillRect(0, h - bar, w, bar); ctx.restore();
  if (s >= 9.5 && s < 13.6) { const a = clamp01((s - 9.5) * 3) * clamp01((13.6 - s) * 2), cy = h * 0.3; ctx.save(); ctx.globalAlpha = a; const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(40,4,16,.92)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, cy - 60 * sc, w, 118 * sc);
    label(ctx, 'NEFERAKH, ECLIPSE ASCENDANT', w / 2, cy, Math.round(50 * sc), '#ff5a7a', Math.round(9 * sc)); label(ctx, 'SAVAGE · EVERYTHING YOU LEARNED IS INVERTED', w / 2, cy + 38 * sc, Math.round(18 * sc), '#ffe0e8', 4); ctx.restore(); }
  if (V.eShort) label(ctx, 'SPACE · ENTER · ESC  —  skip', w - 170 * sc, h - bar - 24 * sc, Math.round(15 * sc), '#ffffff', 4);
  void t;
}
/** the camera: push in on him for the fall and the black sun, pull back wide for the inversion + the rise, hand back at the end */
export function nefEclipseCam(V, C, b) {
  if (!V || V.k !== 'nf' || V.st !== 'eclipse') return null;
  const s = eclSec(V), by = b ? b.y : C.y - 40, bx = b ? b.x : C.x, inK = ease(clamp01(s / 1.2)) * (1 - ease(clamp01((s - 4.6) / 1.4))), w = clamp01(s * 3) * clamp01((14 - s) / 0.9);
  return { x: bx, y: by - 60 - 60 * (1 - inK), z: 0.62 + 0.5 * inK, k: 0.9 * w };
}
let skipOn = false, skipBound = false;
/** the short (retry) transformation: Space / Enter / Esc skips it (the sim checks it's the short one) */
export function nefEclipseSkip(on) {
  skipOn = !!on; if (skipBound || typeof window === 'undefined') return; skipBound = true;
  window.addEventListener('keydown', (e) => { if (!skipOn || !(e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) return; const g = (window.__rb && window.__rb.game) || (window.__rbm && window.__rbm.game); if (g && g.command) { e.preventDefault(); g.command({ type: 'eclSkip' }); skipOn = false; } }, true);
}
