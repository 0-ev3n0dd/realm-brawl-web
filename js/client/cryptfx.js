// The Glacier Crypt (world expansion 1), classic code-drawn style: three round ice vaults hanging in a black glacier
// void, then Osric's 8 x 8 chessboard sanctum. Ground, telegraphs (tile gambits, Absolute Zero, castling / throne slam,
// piece hops, Checkmate), falling icicles, the reliquary, the rime-doors, the HUD tracker + Osric's bar, the minimap and
// the crypt event FX. State comes from packCrypt (local sim, memoised per tick) or the co-op snapshot (sim.frostV.c).
import { INK, circle, rrect, star } from './art.js';
import { bloom } from './fxglow.js';
import { lgrad, ink } from './dunesfx.js';
import { CRYPT_ROOMS, CRYPT_BOUNDS as CB, CRYPT_X, SANCTUM, BOARD_N as N, BOARD_T as TS, boardHalf, cryptDoor, inCryptArea, cryptRoomAt, CRYPT_NAME } from '../sim/frostconst.js';
import { packCrypt, isWhite, CRYPT } from '../sim/crypt.js';

const TAU = Math.PI * 2, FONT = "'Lilita One', sans-serif";
const H = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const cryptVisible = (view) => view.x1 > CB.x0 - 300 && view.x0 < CB.x1 + 300 && view.y1 > CB.y0 - 300 && view.y0 < CB.y1 + 300;
let memo = { k: -1, s: null, v: null };
export function cryptState(sim) {
  if (sim.frostV !== undefined) return (sim.frostV && sim.frostV.c) || null;
  if (memo.s === sim && memo.k === sim.tick) return memo.v;
  memo = { k: sim.tick, s: sim, v: packCrypt(sim) };
  return memo.v;
}
const BX0 = SANCTUM.x - boardHalf(), BY0 = SANCTUM.y - boardHalf();
const cellXY = (k) => [BX0 + (k % N) * TS, BY0 + Math.floor(k / N) * TS];
const TELE_COL = { gambit: '#ff4d5e', zero: '#ff4d5e', hop: '#ff4d5e', sink: '#ff4d5e', mate: '#ff4d5e' }; // (the game-wide colour grammar: every tile that hits is RED)

// ------------------------------------------------------------------ ground
export function drawCryptGround(ctx, view, t, sim) {
  if (!cryptVisible(view)) return false;
  const T = cryptState(sim);
  const x0 = Math.max(view.x0, CB.x0 - 300), x1 = Math.min(view.x1, CB.x1 + 300), y0 = Math.max(view.y0, CB.y0 - 300), y1 = Math.min(view.y1, CB.y1 + 300);
  if (x1 > x0 && y1 > y0) {
    const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#060c1c'); g.addColorStop(1, '#0b1730'); ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    const S = 140;
    for (let gx = Math.floor(x0 / S) * S; gx < x1; gx += S) for (let gy = Math.floor(y0 / S) * S; gy < y1; gy += S) {
      const h = H(gx / S, gy / S); if (h > 0.45) continue;
      const sx = gx + H(gy, gx) * S, sy = gy + ((H(gx + 3, gy) * S + t * 14 * (0.5 + h)) % S);
      ctx.globalAlpha = 0.25 + 0.4 * h; ctx.fillStyle = h < 0.1 ? '#bff0ff' : '#5a7fb8'; ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  // the ice spine joining the vaults
  ctx.save(); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(CRYPT_X, CRYPT_ROOMS[0].y); ctx.lineTo(CRYPT_X, SANCTUM.y); ctx.lineWidth = 150; ctx.strokeStyle = '#1b2d52'; ctx.stroke(); ctx.lineWidth = 110; ctx.strokeStyle = '#2d4a7a'; ctx.stroke();
  ctx.setLineDash([30, 40]); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(191,240,255,.35)'; ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  for (let i = 0; i < 3; i++) vault(ctx, CRYPT_ROOMS[i], i, T, t, view);
  board(ctx, T, t, view);
  return true;
}
function vault(ctx, R, i, T, t, view) {
  if (R.x + R.r + 200 < view.x0 || R.x - R.r - 200 > view.x1 || R.y + R.r + 200 < view.y0 || R.y - R.r - 200 > view.y1) return;
  bloom(ctx, R.x, R.y, R.r + 160, '#3d6fb8', 0.25);
  circle(ctx, R.x, R.y, R.r + 34, '#24406e', 5);
  for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU, x = R.x + Math.cos(a) * (R.r + 30), y = R.y + Math.sin(a) * (R.r + 30); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 40, y + Math.sin(a) * 40); ctx.lineTo(x + Math.cos(a + 0.12) * 4, y + Math.sin(a + 0.12) * 4); ctx.lineTo(x + Math.cos(a - 0.12) * 4, y + Math.sin(a - 0.12) * 4); ctx.closePath(); ctx.fillStyle = k % 2 ? '#bfe3ff' : '#8fbfe6'; ctx.fill(); ink(ctx, 2); }
  const g = ctx.createRadialGradient(R.x - R.r * 0.3, R.y - R.r * 0.3, 20, R.x, R.y, R.r); g.addColorStop(0, '#dff4ff'); g.addColorStop(0.7, '#a9cdea'); g.addColorStop(1, '#7ea6cf');
  circle(ctx, R.x, R.y, R.r, g, 4);
  ctx.save(); ctx.beginPath(); ctx.arc(R.x, R.y, R.r, 0, TAU); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
  for (let k = 0; k < 9; k++) { const a = H(i, k) * TAU, l = R.r * (0.3 + H(k, i) * 0.6); ctx.beginPath(); ctx.moveTo(R.x, R.y); ctx.lineTo(R.x + Math.cos(a) * l * 0.5 + 20, R.y + Math.sin(a) * l * 0.5); ctx.lineTo(R.x + Math.cos(a) * l, R.y + Math.sin(a) * l); ctx.stroke(); }
  for (const rr of [R.r * 0.35, R.r * 0.7]) { ctx.beginPath(); ctx.arc(R.x, R.y, rr, 0, TAU); ctx.strokeStyle = 'rgba(70,110,160,.25)'; ctx.lineWidth = 6; ctx.stroke(); }
  // frozen dead under the ice
  for (let k = 0; k < 6; k++) { const a = H(k, i + 9) * TAU, rr = R.r * (0.25 + H(i + 9, k) * 0.6), x = R.x + Math.cos(a) * rr, y = R.y + Math.sin(a) * rr; ctx.globalAlpha = 0.18; circle(ctx, x, y, 14, '#2d4a7a', 0); ctx.fillStyle = '#2d4a7a'; ctx.fillRect(x - 3, y + 10, 6, 26); ctx.fillRect(x - 14, y + 18, 28, 5); ctx.globalAlpha = 1; }
  ctx.restore();
  // the rime-door (north rim) + the entry (south rim)
  const D = cryptDoor(i), open = T && T.room === i && T.door;
  ctx.save(); ctx.translate(D.x, D.y - 40);
  rrect(ctx, -54, -40, 108, 80, 30); ctx.fillStyle = open ? '#bff6ff' : '#3d5f8f'; ctx.fill(); ink(ctx, 4);
  if (open) { bloom(ctx, 0, 0, 120, '#9fe8ff', 0.7 + 0.3 * Math.sin(t * 4)); star(ctx, 0, 0, 16, '#ffffff', 2); }
  else for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * 26, -34); ctx.lineTo(k * 26 + 6, 10); ctx.lineTo(k * 26 - 6, 10); ctx.closePath(); ctx.fillStyle = '#dff4ff'; ctx.fill(); ink(ctx, 2); }
  ctx.restore();
  ctx.font = `14px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(R.name.toUpperCase(), R.x, R.y + R.r + 26); ctx.fillStyle = '#bfeaff'; ctx.fillText(R.name.toUpperCase(), R.x, R.y + R.r + 26);
}
function board(ctx, T, t, view) {
  const R = SANCTUM, h = boardHalf();
  if (R.x + h + 300 < view.x0 || R.x - h - 300 > view.x1 || R.y + h + 300 < view.y0 || R.y - h - 300 > view.y1) return;
  const Bd = T && T.b, shrink = (Bd && Bd.shrink) || 0;
  bloom(ctx, R.x, R.y, h * 1.9, '#3d6fb8', 0.3);
  rrect(ctx, R.x - h - 40, R.y - h - 40, h * 2 + 80, h * 2 + 80, 18); ctx.fillStyle = lgrad(ctx, R.x, R.y, h + 40, '#4d6fa8'); ctx.fill(); ink(ctx, 5);
  for (let k = 0; k < N; k++) { // rank / file letters on the frame
    ctx.font = `13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#dff4ff';
    ctx.fillText('ABCDEFGH'[k], BX0 + (k + 0.5) * TS, R.y + h + 26); ctx.fillText(String(N - k), R.x - h - 20, BY0 + (k + 0.5) * TS + 5);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = BX0 + i * TS, y = BY0 + j * TS, sunk = shrink && (i < shrink || j < shrink || i >= N - shrink || j >= N - shrink);
    if (sunk) { ctx.fillStyle = '#0a1426'; ctx.fillRect(x, y, TS, TS); ctx.strokeStyle = `rgba(120,180,255,${0.15 + 0.1 * Math.sin(t * 2 + i + j)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + TS / 2, y + TS / 2, 20 + ((t * 20 + (i * 7 + j * 3) * 5) % 30), 0, TAU); ctx.stroke(); continue; }
    const w = isWhite(i, j); ctx.fillStyle = w ? '#e8f6ff' : '#6f8fb8'; ctx.fillRect(x, y, TS, TS);
    ctx.fillStyle = w ? 'rgba(255,255,255,.7)' : 'rgba(191,227,255,.25)'; ctx.fillRect(x + 6, y + 6, TS * 0.4, 5);
    if (H(i, j) < 0.25) { ctx.beginPath(); ctx.moveTo(x + TS * H(j, i), y); ctx.lineTo(x + TS * 0.5, y + TS * 0.5); ctx.lineTo(x + TS, y + TS * H(i + 1, j)); ctx.strokeStyle = w ? 'rgba(111,143,184,.35)' : 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeRect(BX0, BY0, h * 2, h * 2);
  // the throne dais behind the king's start
  const tx = R.x, ty = R.y - TS * 2.5;
  ctx.save(); ctx.globalAlpha = 0.5; circle(ctx, tx, ty, 70, null, 4, '#ffe27a'); ctx.restore();
  // the way out once he falls
  if (Bd && Bd.st === 'victory') { const D = cryptDoor(3); bloom(ctx, D.x, D.y, 120, '#9fe8ff', 0.8); circle(ctx, D.x, D.y, 46, 'rgba(191,246,255,.6)', 4, '#ffffff'); ctx.font = `16px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText('EXIT', D.x, D.y + 6); ctx.fillStyle = '#fff'; ctx.fillText('EXIT', D.x, D.y + 6); }
}

// ------------------------------------------------------------------ under the characters: telegraphs, icicle shadows, chest
export function drawCryptUnder(ctx, sim, local, t) {
  const T = cryptState(sim);
  if (!T) return;
  if (T.pend) for (const [x, y, el] of T.pend.pts) { const k = 1 - T.pend.t / CRYPT.rise; ctx.save(); ctx.globalAlpha = 0.4 + 0.5 * k; ctx.beginPath(); ctx.ellipse(x, y, 30 + k * 12, (30 + k * 12) * 0.6, 0, 0, TAU); ctx.fillStyle = 'rgba(20,40,80,.5)'; ctx.fill(); ctx.setLineDash([8, 6]); ctx.lineWidth = 3; ctx.strokeStyle = el ? '#ffcf3a' : '#8fe3ff'; ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
  for (const [x, y, ct, d] of T.ic) {
    if (ct > d) { ctx.save(); ctx.globalAlpha = 1 - (ct - d) / 10; circle(ctx, x, y, 40, 'rgba(255,255,255,.5)', 0); ctx.restore(); continue; }
    const k = ct / d, r = CRYPT.icicle.r;
    ctx.save(); ctx.globalAlpha = 0.25 + 0.35 * k; circle(ctx, x, y, r * (0.4 + 0.6 * k), 'rgba(20,40,90,.55)', 0); ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = '#bfefff'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + k * TAU); ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.restore();
  }
  if (T.chest) reliquary(ctx, T.chest, t);
  const Bd = T.b;
  if (!Bd) return;
  for (const te of Bd.tele) tele(ctx, te, t, local);
}
function reliquary(ctx, c, t) {
  ctx.save(); ctx.translate(c.x, c.y);
  if (!c.open) bloom(ctx, 0, 0, 110, '#9fe8ff', 0.5 + 0.3 * Math.sin(t * 3));
  ctx.beginPath(); ctx.moveTo(-40, 24); ctx.lineTo(-30, -20); ctx.lineTo(30, -20); ctx.lineTo(40, 24); ctx.closePath(); ctx.fillStyle = lgrad(ctx, 0, 0, 40, c.open ? '#7ea6cf' : '#bfe8ff'); ctx.fill(); ink(ctx, 3.5);
  if (!c.open) { for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 14, -20); ctx.lineTo(k * 14 + 5, -42 - (k % 2) * 8); ctx.lineTo(k * 14 + 10, -20); ctx.closePath(); ctx.fillStyle = '#e8fbff'; ctx.fill(); ink(ctx, 2); } star(ctx, 0, 2, 9, '#ffe27a', 2); }
  else { ctx.beginPath(); ctx.ellipse(0, -20, 30, 8, 0, 0, TAU); ctx.fillStyle = '#ffe27a'; ctx.fill(); ink(ctx, 2); }
  ctx.restore();
}
function tele(ctx, te, t, local) {
  const k = Math.min(1, te.t / Math.max(1, te.d)), done = te.done;
  if (te.sh === 'tiles') {
    const col = te.k === 'zero' ? (te.white ? '#ffffff' : '#0d1a33') : TELE_COL[te.k] || '#7fd8ff';
    ctx.save();
    if (done) { ctx.globalAlpha = Math.max(0, 1 - (te.t - te.d) / 40) * 0.85; ctx.fillStyle = te.k === 'zero' && !te.white ? '#9fd8ff' : '#ffffff'; for (const c of te.c) { const [x, y] = cellXY(c); ctx.fillRect(x, y, TS, TS); } ctx.restore(); return; }
    const pulse = 0.5 + 0.5 * Math.sin(t * (6 + 14 * k));
    ctx.globalAlpha = 0.25 + 0.45 * k; ctx.fillStyle = 'rgba(255,77,94,.72)';
    for (const c of te.c) { const [x, y] = cellXY(c); ctx.fillRect(x + 4, y + 4, TS - 8, TS - 8); }
    ctx.globalAlpha = 0.7 + 0.3 * pulse; ctx.lineWidth = 3; ctx.strokeStyle = te.k === 'zero' ? col : '#ffffff';
    if (te.k === 'zero') { ctx.globalAlpha = 1; for (const c of te.c) { const [x, y] = cellXY(c); ctx.fillStyle = te.white ? '#ffffff' : '#0d1a33'; ctx.fillRect(x + TS / 2 - 7, y + TS / 2 - 7, 14, 14); ctx.strokeStyle = '#ff4d5e'; ctx.lineWidth = 2; ctx.strokeRect(x + TS / 2 - 7, y + TS / 2 - 7, 14, 14); } ctx.globalAlpha = 0.7 + 0.3 * pulse; ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; } // (which colour square: a chip)
    for (const c of te.c) { const [x, y] = cellXY(c), s = (TS - 8) * k; ctx.strokeRect(x + TS / 2 - s / 2, y + TS / 2 - s / 2, s, s); }
    ctx.restore();
    if (te.marks && te.piece) for (const [, i, j] of te.marks) { const x = BX0 + (i + 0.5) * TS, y = BY0 + (j + 0.5) * TS; pieceGlyph(ctx, te.piece, x, y, 30, t); }
    return;
  }
  if (te.sh === 'circle') {
    const throne = te.k === 'throne';
    ctx.save();
    if (done) { ctx.globalAlpha = Math.max(0, 1 - (te.t - te.d) / 30); circle(ctx, te.x, te.y, te.r * 1.1, 'rgba(255,255,255,.5)', 0); ctx.restore(); return; }
    ctx.globalAlpha = 0.25 + 0.3 * k; circle(ctx, te.x, te.y, te.r, 'rgba(255,77,94,' + (throne ? '.6)' : '.38)'), 0);
    ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(te.x, te.y, te.r, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = '#ff4d5e'; ctx.stroke();
    ctx.beginPath(); ctx.arc(te.x, te.y, te.r * k, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    if (te.k === 'castle') { pieceGlyph(ctx, 'rook', te.x, te.y - 60, 26, t); if (local && te.pid === local.id) { ctx.font = `16px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText('YOU CASTLE!', te.x, te.y - 94); ctx.fillStyle = '#ffe27a'; ctx.fillText('YOU CASTLE!', te.x, te.y - 94); } }
    ctx.restore();
  }
}
/** a small chess-piece silhouette (the gambit's piece over the marked tile) */
function pieceGlyph(ctx, pc, x, y, s, t) {
  ctx.save(); ctx.translate(x, y + Math.sin(t * 4) * 3); ctx.globalAlpha = 0.9;
  ctx.beginPath();
  if (pc === 'rook') { ctx.moveTo(-s * 0.4, s * 0.5); ctx.lineTo(-s * 0.3, -s * 0.2); ctx.lineTo(-s * 0.45, -s * 0.2); ctx.lineTo(-s * 0.45, -s * 0.55); for (let k = 0; k < 5; k++) ctx.lineTo(-s * 0.45 + k * s * 0.225, k % 2 ? -s * 0.4 : -s * 0.55); ctx.lineTo(s * 0.45, -s * 0.2); ctx.lineTo(s * 0.3, -s * 0.2); ctx.lineTo(s * 0.4, s * 0.5); }
  else if (pc === 'bishop') { ctx.moveTo(-s * 0.4, s * 0.5); ctx.quadraticCurveTo(-s * 0.4, -s * 0.2, 0, -s * 0.6); ctx.quadraticCurveTo(s * 0.4, -s * 0.2, s * 0.4, s * 0.5); }
  else if (pc === 'knight') { ctx.moveTo(-s * 0.4, s * 0.5); ctx.lineTo(-s * 0.35, -s * 0.3); ctx.quadraticCurveTo(-s * 0.1, -s * 0.7, s * 0.3, -s * 0.5); ctx.lineTo(s * 0.45, -s * 0.15); ctx.lineTo(s * 0.1, -s * 0.15); ctx.lineTo(s * 0.4, s * 0.5); }
  else { ctx.moveTo(-s * 0.4, s * 0.5); ctx.lineTo(-s * 0.5, -s * 0.45); ctx.lineTo(-s * 0.25, -s * 0.15); ctx.lineTo(0, -s * 0.6); ctx.lineTo(s * 0.25, -s * 0.15); ctx.lineTo(s * 0.5, -s * 0.45); ctx.lineTo(s * 0.4, s * 0.5); }
  ctx.closePath(); ctx.fillStyle = '#ff5e7a'; ctx.fill(); ink(ctx, 3);
  ctx.restore();
}

// ------------------------------------------------------------------ over the characters: the falling icicles themselves
export function drawCryptOver(ctx, sim, local, t) {
  const T = cryptState(sim);
  if (!T) return;
  for (const [x, y, ct, d] of T.ic) {
    if (ct >= d) continue;
    const k = ct / d, hgt = (1 - k * k) * 520;
    ctx.save(); ctx.translate(x, y - hgt); ctx.globalAlpha = Math.min(1, k * 3);
    ctx.beginPath(); ctx.moveTo(-14, -60); ctx.lineTo(14, -60); ctx.lineTo(0, 16); ctx.closePath(); ctx.fillStyle = lgrad(ctx, 0, -30, 40, '#dff6ff'); ctx.fill(); ink(ctx, 3);
    ctx.beginPath(); ctx.moveTo(-5, -52); ctx.lineTo(0, 4); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
}

// ------------------------------------------------------------------ HUD (screen space)
export function drawCryptHud(ctx, sim, p, w, h, txt, bar, time) {
  const T = cryptState(sim);
  if (!T || !p || !inCryptArea(p.x, p.y)) return 0;
  let y = 92;
  if (T.st === 'room' || T.st === 'clear') {
    txt(ctx, `Vault ${T.room + 1}/3 · ${(CRYPT_ROOMS[T.room] || {}).name || ''}`, w / 2, y + 18, 20, '#fff', 'center', 4);
    const wv = T.st === 'clear' ? 'CLEARED: take the rime-door north' : `Wave ${Math.max(1, T.wave)}/${T.nw}`;
    txt(ctx, wv, w / 2, y + 42, 16, T.st === 'clear' ? '#7dffb0' : '#9fe8ff', 'center', 3);
    if (T.ch) {
      const cw = 320, cx = w / 2 - cw / 2, cy = y + 56, ice = T.ch.k === 'icicle', done = ice ? T.ch.done : (T.ch.done || T.ch.n >= T.ch.need);
      rrect(ctx, cx, cy, cw, 40, 10); ctx.fillStyle = 'rgba(43,36,51,.8)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = done ? '#7dffb0' : ice ? '#ff8a7a' : '#9fe8ff'; ctx.stroke();
      txt(ctx, `RELIQUARY · ${T.ch.text}`, cx + 12, cy + 17, 13, done ? '#7dffb0' : '#dff6ff', 'left', 3);
      if (ice) txt(ctx, `Icicle hits ${T.ch.n}/${T.ch.need}`, cx + 12, cy + 33, 12, T.ch.n > T.ch.need ? '#ff5e5b' : '#fff', 'left', 3);
      else for (let i = 0; i < T.ch.need; i++) { const px = cx + 14 + i * Math.min(24, (cw - 28) / T.ch.need); circle(ctx, px + 6, cy + 30, 5.5, i < T.ch.n ? (done ? '#7dffb0' : '#9fe8ff') : 'rgba(255,255,255,.18)', 1.6); }
      if (done) txt(ctx, '✔', cx + cw - 22, cy + 26, 20, '#7dffb0', 'center', 3);
      y = cy + 44;
    } else y += 52;
  } else if (T.b) {
    const Bd = T.b, b = sim.enemies.find((e) => e.type === 'osric' && !e.dead);
    const bbw = Math.min(640, w * 0.52), bbx = w / 2 - bbw / 2, bby = y;
    if (Bd.st === 'victory') { txt(ctx, 'THE KING IS TOPPLED', w / 2, bby - 4, 20, '#bff6ff', 'center', 4); txt(ctx, 'Grab the loot · the EXIT is at the south edge of the board', w / 2, bby + 18, 15, '#fff', 'center', 3); return bby + 30; }
    if (Bd.st === 'wipe') { txt(ctx, 'STALEMATE · the board resets', w / 2, bby + 10, 20, '#ff8a7a', 'center', 4); return bby + 30; }
    txt(ctx, 'Osric, the Rimeking', w / 2, bby - 4, 22, '#cfeaff', 'center', 4);
    if (Bd.st === 'pull') txt(ctx, `His move in ${Math.ceil(Bd.pull / 60)}…`, w / 2, bby + 24, 18, '#fff', 'center', 3);
    else if (b) {
      bar(ctx, bbx, bby + 10, bbw, 22, b.hp / b.maxHp, Bd.check > 0 ? '#7dffb0' : '#7fc8ff', `${Math.ceil(b.hp)} / ${b.maxHp}`);
      for (const k of [0.66, 0.33]) { ctx.fillStyle = INK; ctx.fillRect(bbx + bbw * k - 2, bby + 8, 4, 26); }
      txt(ctx, `Phase ${Bd.phase}`, bbx + bbw + 8, bby + 22, 14, '#fff', 'left', 3);
      if (Bd.check > 0) txt(ctx, `IN CHECK · +50% damage · ${Math.ceil(Bd.check / 60)}s`, w / 2, bby + 54, 18, '#7dffb0', 'center', 4);
      else txt(ctx, Bd.phase >= 3 ? 'Stay off the black water · Queen gambits: a knight\'s jump is safe' : Bd.phase === 2 ? 'Kill the hopping pieces · a clean gambit puts him in check' : 'Dodge every gambit cleanly to put him IN CHECK', w / 2, bby + 54, 14, '#fff', 'center', 3);
      if (Bd.enraged) txt(ctx, 'CHECKMATE', w / 2, bby + 76, 16, '#ff5e5b', 'center', 3);
      else if (Bd.enr > 0 && Bd.enr < 60 * 60) txt(ctx, `Checkmate in ${Math.ceil(Bd.enr / 60)}s`, w / 2, bby + 76, 13, '#ff9a8a', 'center', 3);
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
  void time;
  return y;
}

// ------------------------------------------------------------------ minimap
export function drawCryptMinimap(ctx, x, y, R, sim, p, CLASSES) {
  const T = cryptState(sim);
  circle(ctx, x, y, R + 5, INK, 0);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
  ctx.fillStyle = '#0a1426'; ctx.fillRect(x - R, y - R, R * 2, R * 2);
  const cy = (CRYPT_ROOMS[0].y + SANCTUM.y) / 2, k = (R * 2 - 16) / 5200, X = (wx) => x + (wx - CRYPT_X) * k, Y = (wy) => y + (wy - cy) * k;
  ctx.beginPath(); ctx.moveTo(X(CRYPT_X), Y(CRYPT_ROOMS[0].y)); ctx.lineTo(X(CRYPT_X), Y(SANCTUM.y)); ctx.strokeStyle = 'rgba(159,232,255,.4)'; ctx.lineWidth = 3; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
  const cur = T ? (T.b ? 3 : T.room) : -1;
  CRYPT_ROOMS.forEach((Rm, i) => {
    const fill = cur === i ? '#a9cdea' : i < cur ? '#4d6f9a' : '#24406e';
    if (Rm.board) { const s = boardHalf() * k; ctx.fillStyle = fill; ctx.fillRect(X(Rm.x) - s, Y(Rm.y) - s, s * 2, s * 2); ctx.lineWidth = 2; ctx.strokeStyle = cur === i ? '#ffffff' : INK; ctx.strokeRect(X(Rm.x) - s, Y(Rm.y) - s, s * 2, s * 2); ctx.font = `bold 11px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe27a'; ctx.fillText('♚', X(Rm.x), Y(Rm.y) + 4); }
    else circle(ctx, X(Rm.x), Y(Rm.y), Rm.r * k, fill, 2, cur === i ? '#ffffff' : INK);
  });
  for (const e of sim.enemies) { if (e.dead || !inCryptArea(e.x, e.y)) continue; ctx.fillStyle = e.boss ? '#ff5e5b' : e.elite ? '#ffcf3a' : '#ff4d4d'; ctx.fillRect(X(e.x) - 1.5, Y(e.y) - 1.5, 3, 3); }
  if (sim.players) for (const q of sim.players.values()) if (q.id !== p.id && !q.dead) circle(ctx, X(q.x), Y(q.y), 3, CLASSES[q.cls] ? CLASSES[q.cls].color : '#fff', 1.2);
  circle(ctx, X(p.x), Y(p.y), 3.5, '#fff', 1.6);
  ctx.restore();
  circle(ctx, x, y, R + 3, null, 5, INK); circle(ctx, x, y, R, null, 2, 'rgba(255,255,255,.35)');
}

// ------------------------------------------------------------------ events (fx.js routes {type:'crypt'} here; 'call' is drawn by the HUD)
export function cryptEventFx(fx, ev, me) {
  const x = ev.x, y = ev.y;
  switch (ev.ph) {
    case 'wave': for (const [px, py, el] of ev.pts || []) { fx.puffs(px, py, 8, '#dff4ff', 14, 140, 0.7); if (el) fx.ring(px, py, 46, '#ffcf3a', 0.5, 5); } break; // (the HUD tracker shows the wave count)
    case 'roomClear': fx.ring(x, y, 320, '#bff6ff', 0.8, 8); break;
    case 'chest': fx.ring(x, y, 80, '#9fe8ff', 0.6, 8); fx.sparks(x, y, -Math.PI / 2, 26, '#ffffff', 420, 1.8); fx.shake(0.2); break;
    case 'chal': if (me) fx.text(x, y - 50, `CHAIN ${ev.n}/${ev.need}`, { size: 18, color: '#9fe8ff', vy: -40, pop: 1, life: 0.9 }); break;
    case 'chalDone': fx.banner('CHALLENGE COMPLETE', '#7dffb0', 'Clear the vault to open the reliquary', 2.2, 36); break;
    case 'chalFail': fx.banner('CHALLENGE FAILED', '#ff8a7a', 'Too many icicle hits: no reliquary this vault', 2.2, 36); break;
    case 'icicle': fx.sparks(x, y, 0, 12, '#dff6ff', 300, TAU); fx.puffs(x, y, 6, '#ffffff', 12, 120, 0.5); fx.ring(x, y, CRYPT.icicle.r, '#bfefff', 0.3, 4); fx.shake(0.06); break;
    case 'bossPull': fx.shake(0.3); break;
    case 'bossStart': fx.flashColor = '#dff6ff'; fx.flash = 0.5; fx.shake(0.4); fx.ring(x, y, 420, '#9fe8ff', 0.9, 14); break;
    case 'castle': fx.ring(x, y, 90, '#ffe27a', 0.5, 8); fx.ring(ev.bx, ev.by, 90, '#ffe27a', 0.5, 8); fx.sparks(ev.bx, ev.by, 0, 14, '#ffe27a', 300, TAU); break;
    case 'check': fx.ring(x, y, 160, '#7dffb0', 0.6, 10); fx.sparks(x, y, -Math.PI / 2, 20, '#7dffb0', 380, 1.6); fx.shake(0.25); break;
    case 'hop': fx.puffs(x, y, 8, '#dff6ff', 14, 160, 0.5); fx.ring(x, y, 60, '#bfe3ff', 0.35, 5); break;
    case 'phase': fx.shake(0.5); fx.ring(x, y, 320, '#bfe3ff', 0.7, 12); break;
    case 'sunk': fx.flashColor = '#0a1426'; fx.flash = 0.5; fx.shake(0.6); break;
    case 'enrage': fx.shake(0.5); break;
    case 'boom': if (ev.c) { const n = Math.min(ev.c.length, 24); for (let i = 0; i < n; i++) { const c = ev.c[Math.floor((i / n) * ev.c.length)], cx = BX0 + (c % N + 0.5) * TS, cy = BY0 + (Math.floor(c / N) + 0.5) * TS; fx.sparks(cx, cy, 0, 3, ev.k === 'mate' ? '#ff8fa0' : '#dff6ff', 240, TAU); } fx.shake(ev.k === 'mate' ? 0.5 : 0.18); } else { fx.ring(x, y, ev.r || 120, '#ff5e7a', 0.45, 10); fx.shake(0.35); } break;
    case 'hit': if (me) fx.text(x, y - 40, String(ev.what || 'Hit').toUpperCase(), { size: 16, color: '#ff9a8a', vy: -30, life: 0.8 }); break;
    case 'wipe': fx.banner('STALEMATE', '#ff5e5b', 'Osric resets the board: try again', 2.6, 42, 'defeat'); break;
    case 'victory': fx.flashColor = '#dff6ff'; fx.flash = 0.8; fx.shake(0.7); fx.ring(x, y, 600, '#9fe8ff', 1.2, 20); fx.banner('THE RIMEKING FALLS', '#bff6ff', `${CRYPT_NAME} cleared in ${ev.t || '?'}s`, 4, 50, 'victory'); break;
  }
}
void cryptRoomAt;
