// The Tomb of the Sun-Eaten King (Phase 1 dungeon) art: the floating sandstone chambers (hieroglyph rims, tiled floors
// with a per-room inlay, torches, sarcophagi, offerings), rising-dead telegraphs, the bonus chest, the sun-doors,
// Neferakh's sanctum (obelisks, braziers, god rays in the SUN, a real darkness with light holes in the DARK, the
// Twilight split), his telegraphs, Neferakh himself, the Tomb HUD / minimap and event FX. Detailed code-drawn style
// (shared kit from dunesfx.js): gradients lit from the upper left, rim light, ink outlines, texture and decals.
import { ENEMY_ENV, enemyTop } from './enemypaint.js';
import { heroArt } from './heropaint.js';
import { INK, circle, ellipse, shadow, rrect, shade, star, ENEMY_DRAW } from './art.js';
import { bloom } from './fxglow.js';
import { newCanvas, spriteScale } from './sprite.js';
import { WP, wpOn, wpTile, wpPattern, wpDecal, wpProp, wpPropDirect, wpPiece, wpHas, dunesPropArt, drawPaintedProp } from './worldpaint.js';
import { lgrad, rimArc, ink, ball, oval, glyph, lightLocal, obelisk } from './dunesfx.js';
import { TOMB_BOUNDS as TB, TOMB_X } from '../sim/dunesconst.js';
import { TOMB_ROOMS, BRAZIERS, OBELISKS, roomDoor, roomEntry, inTombArea, tombRoomAt, TOMB_NAME } from '../sim/dunesconst.js';
import { packTomb, TOMB, BOSS_ROOM } from '../sim/tomb.js';

const TAU = Math.PI * 2;
const LA = -2.3;
const FONT = "'Lilita One', sans-serif";
const H = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const B = TOMB.boss;
const COL = { sun: '#ffcf4a', dark: '#8a5cff', sand: '#d9b77a' };
export const tombVisible = (view) => view.x1 > TB.x0 && view.x0 < TB.x1 && view.y1 > TB.y0 && view.y0 < TB.y1;
let memo = { k: -1, s: null, v: null };
/** The packed Tomb state (the live sim packs it once per tick; the net view gets it from the snapshot). */
export function tombState(sim) {
  if (sim.tombV !== undefined) return sim.tombV;
  if (memo.s === sim && memo.k === sim.tick) return memo.v;
  memo = { k: sim.tick, s: sim, v: packTomb(sim) };
  return memo.v;
}
let CUR = null; // this frame's Tomb state (Neferakh's draw reads the light from it)

// ------------------------------------------------------------------ ground: the abyss, the chambers
export function drawTombGround(ctx, view, t, sim) {
  if (!tombVisible(view)) return false;
  const T = (CUR = tombState(sim)); ENEMY_ENV.dark = !!(T && T.b && T.b.light === 'dark');
  { // the void the chambers float in: deep indigo with drifting sand-motes and far stars (covers the world ocean here)
    const x0 = Math.max(view.x0, TB.x0 - 300), x1 = Math.min(view.x1, TB.x1 + 300), y0 = Math.max(view.y0, TB.y0 - 300), y1 = Math.min(view.y1, TB.y1 + 300);
    if (x1 > x0 && y1 > y0) {
      const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#120a22'); g.addColorStop(0.5, '#1b1030'); g.addColorStop(1, '#140b26');
      ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      const S = 120;
      for (let gx = Math.floor(x0 / S) * S; gx < x1; gx += S) for (let gy = Math.floor(y0 / S) * S; gy < y1; gy += S) {
        const h = H(gx / S, gy / S); if (h > 0.55) continue;
        const sx = gx + H(gy, gx) * S, sy = gy + H(gx + 3, gy) * S, tw = 0.35 + 0.35 * Math.sin(t * 1.7 + h * 40);
        ctx.globalAlpha = tw; ctx.fillStyle = h < 0.12 ? '#ffe9a0' : h < 0.3 ? '#8f7ad6' : '#4a3a78';
        ctx.fillRect(sx, sy, h < 0.12 ? 3 : 2, h < 0.12 ? 3 : 2);
      }
      ctx.globalAlpha = 1;
    }
  }
  for (let i = 0; i < TOMB_ROOMS.length; i++) {
    const R = TOMB_ROOMS[i];
    if (R.x + R.r + 300 < view.x0 || R.x - R.r - 300 > view.x1 || R.y + R.r + 300 < view.y0 || R.y - R.r - 300 > view.y1) continue;
    const g = ctx.createRadialGradient(R.x, R.y, R.r * 0.8, R.x, R.y, R.r + 320); g.addColorStop(0, 'rgba(18,10,30,.96)'); g.addColorStop(0.7, 'rgba(24,14,40,.75)'); g.addColorStop(1, 'rgba(24,14,40,0)');
    ctx.beginPath(); ctx.arc(R.x, R.y, R.r + 320, 0, TAU); ctx.fillStyle = g; ctx.fill();
    for (let k = 0; k < 18; k++) { const a = H(i, k) * TAU + t * 0.03, rr = R.r + 80 + H(k, i) * 200, tw = 0.4 + 0.4 * Math.sin(t * 2 + k); star(ctx, R.x + Math.cos(a) * rr, R.y + Math.sin(a) * rr, 1.6 + tw * 1.4, k % 3 ? '#ffe9a0' : '#bfa8ff', 0); }
  }
  for (let i = 0; i < TOMB_ROOMS.length; i++) {
    const R = TOMB_ROOMS[i];
    if (R.x + R.r + 80 < view.x0 || R.x - R.r - 80 > view.x1 || R.y + R.r + 80 < view.y0 || R.y - R.r - 80 > view.y1) continue;
    chamber(ctx, i, R, t, T);
  }
  return true;
}
const MOTIF = ['offering', 'eye', 'scarab', 'eclipse'];
// perf pass 2: the chamber's static body (walls, glyph band, floor, inlay, sarcophagi, archway) is painted once into an
// offscreen canvas per room (+ the eclipse inlay's sun state) and blitted; only torches and the sun-door are drawn live.
const CH = new Map();
function chamber(ctx, i, R, t, T) {
  const pt = tombPainted(), sun = !!(CUR && CUR.b && CUR.b.light === 'sun'), key = i + (i === 3 && sun ? 's' : '') + (pt ? 'p' + WP.epoch : ''), q = Math.min(1.25, spriteScale());
  let c = CH.get(key);
  if (c && c.q !== q) c = null;
  if (!c && typeof document !== 'undefined') {
    const x0 = R.x - R.r - 70, y0 = R.y - R.r - 70, w = R.r * 2 + 140, h = R.r * 2.1 + 170;
    c = newCanvas(Math.ceil(w * q), Math.ceil(h * q)); c.q = q; c.x0 = x0; c.y0 = y0; c.w = w; c.h = h;
    const g = c.getContext('2d'); g.setTransform(q, 0, 0, q, -x0 * q, -y0 * q); g.lineJoin = 'round'; g.lineCap = 'round';
    chamberBody(g, i, R, 0, T);
    CH.set(key, c);
  }
  if (c) ctx.drawImage(c, c.x0, c.y0, c.w, c.h); else chamberBody(ctx, i, R, t, T);
  if (CH.size > 10) for (const k of [...CH.keys()]) if (k !== key) CH.delete(k); // (stale painted epochs / style flips)
  const boss = i === 3, X = R.x, Y = R.y, r = R.r;
  const tn = boss ? 0 : 8;
  for (let k = 0; k < tn; k++) { const a = (k / tn) * TAU + Math.PI / 8; torch(ctx, X + Math.cos(a) * (r + 4), Y + Math.sin(a) * (r + 4), t, k + i * 9); }
  if (i < 3) sunDoor(ctx, i, t, T && T.room === i && T.door);
  archway(ctx, X, Y + r + 8);
}
function chamberBody(ctx, i, R, t, T) {
  const boss = i === 3, X = R.x, Y = R.y, r = R.r;
  // the floating block's underside + drop shadow
  ctx.beginPath(); ctx.ellipse(X + 16, Y + r * 0.2 + 40, r + 40, r * 0.9 + 40, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
  ctx.beginPath(); ctx.arc(X, Y + 34, r + 46, 0, TAU); ctx.fillStyle = '#6e4e2e'; ctx.fill(); ink(ctx, 4);
  for (let k = 0; k < 14; k++) { const a = 0.15 + (k / 13) * (Math.PI - 0.3); ctx.beginPath(); ctx.moveTo(X + Math.cos(a) * (r + 44), Y + 34 + Math.sin(a) * (r + 44)); ctx.lineTo(X + Math.cos(a) * (r + 44), Y + Math.sin(a) * (r + 44)); ctx.strokeStyle = 'rgba(40,24,12,.5)'; ctx.lineWidth = 2; ctx.stroke(); }
  // the wall ring: carved blocks
  const n = boss ? 40 : 32;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * TAU + 0.012, a1 = ((k + 1) / n) * TAU - 0.012;
    ctx.beginPath(); ctx.arc(X, Y, r + 46, a0, a1); ctx.arc(X, Y, r, a1, a0, true); ctx.closePath();
    ctx.fillStyle = lgrad(ctx, X + Math.cos((a0 + a1) / 2) * (r + 23), Y + Math.sin((a0 + a1) / 2) * (r + 23), 30, boss ? (k % 2 ? '#4a3b5e' : '#3e3150') : (k % 2 ? '#d7b47a' : '#c9a46a')); ctx.fill(); ink(ctx, 2.2);
  }
  // hieroglyph band (lapis with gold glyphs) on the wall's inner face
  ctx.beginPath(); ctx.arc(X, Y, r + 12, 0, TAU); ctx.strokeStyle = boss ? '#1b1230' : '#1f3f7a'; ctx.lineWidth = 15; ctx.stroke();
  ctx.beginPath(); ctx.arc(X, Y, r + 4.5, 0, TAU); ctx.strokeStyle = '#f2c14a'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.beginPath(); ctx.arc(X, Y, r + 19.5, 0, TAU); ctx.stroke();
  const gn = Math.round((r * TAU) / 26);
  for (let k = 0; k < gn; k++) { const a = (k / gn) * TAU; glyph(ctx, X + Math.cos(a) * (r + 12), Y + Math.sin(a) * (r + 12), k + i, 0.85, boss ? 'rgba(200,160,255,.85)' : 'rgba(255,214,110,.9)'); }
  ctx.beginPath(); ctx.arc(X, Y, r + 44, Math.PI * 1.05, Math.PI * 1.7); ctx.strokeStyle = 'rgba(255,248,222,.45)'; ctx.lineWidth = 2.4; ctx.stroke();
  if (tombPainted()) { chamberFloorPainted(ctx, i, R); return; }
  // the floor
  ctx.save(); ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.clip();
  const fg = ctx.createRadialGradient(X - r * 0.2, Y - r * 0.25, 20, X, Y, r); fg.addColorStop(0, boss ? '#5a4a6e' : '#e6c68e'); fg.addColorStop(0.7, boss ? '#3f3352' : '#d2ad72'); fg.addColorStop(1, boss ? '#2a2038' : '#a8814e');
  ctx.fillStyle = fg; ctx.fillRect(X - r, Y - r, r * 2, r * 2);
  const S = 64, x0 = X - r - ((X - r) % S), y0 = Y - r - ((Y - r) % S);
  for (let gx = x0; gx < X + r; gx += S) for (let gy = y0; gy < Y + r; gy += S) { const h = H(gx, gy); if (h < 0.45) { ctx.fillStyle = h < 0.2 ? 'rgba(255,240,210,.07)' : 'rgba(60,30,10,.07)'; ctx.fillRect(gx + 2, gy + 2, S - 4, S - 4); } if (h > 0.93) { ctx.beginPath(); ctx.moveTo(gx + 10, gy + 14); ctx.lineTo(gx + 26, gy + 30); ctx.lineTo(gx + 22, gy + 48); ctx.strokeStyle = 'rgba(50,25,10,.35)'; ctx.lineWidth = 1.5; ctx.stroke(); } }
  ctx.beginPath(); for (let gx = x0; gx < X + r; gx += S) { ctx.moveTo(gx, Y - r); ctx.lineTo(gx, Y + r); } for (let gy = y0; gy < Y + r; gy += S) { ctx.moveTo(X - r, gy); ctx.lineTo(X + r, gy); }
  ctx.strokeStyle = boss ? 'rgba(10,5,20,.35)' : 'rgba(80,50,20,.25)'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); for (let gx = x0; gx < X + r; gx += S) { ctx.moveTo(gx + 2, Y - r); ctx.lineTo(gx + 2, Y + r); } ctx.strokeStyle = 'rgba(255,245,215,.07)'; ctx.lineWidth = 1.5; ctx.stroke();
  inlay(ctx, MOTIF[i], X, Y, boss ? 230 : 150, t, T);
  for (let k = 0; k < 6; k++) { const a = H(i, k + 40) * TAU, rr = r - 30 - H(k, i) * 30; ctx.beginPath(); ctx.ellipse(X + Math.cos(a) * rr, Y + Math.sin(a) * rr, 46, 16, a + Math.PI / 2, 0, TAU); ctx.fillStyle = boss ? 'rgba(120,100,150,.25)' : 'rgba(240,214,160,.45)'; ctx.fill(); }
  ctx.restore();
  circle(ctx, X, Y, r, null, 4, INK);
  ctx.beginPath(); ctx.arc(X, Y, r - 3, Math.PI * 0.1, Math.PI * 0.9); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 6; ctx.stroke();
  if (!boss) { // sarcophagi + offerings along the wall
    for (const [a, rot] of [[Math.PI * 0.82, 0.3], [Math.PI * 0.18, -0.3]]) sarcophagus(ctx, X + Math.cos(a) * (r - 70), Y + Math.sin(a) * (r - 70), a + Math.PI / 2 + rot, i);
    for (let k = 0; k < 7; k++) { const a = Math.PI * 1.08 + (k / 6) * Math.PI * 0.84 + H(k, i) * 0.06, rr = r - 34; offering(ctx, X + Math.cos(a) * rr, Y + Math.sin(a) * rr, (k + i * 3) % 4); }
  }
}
// ------------------------------------------------------------------ painted world (Art style = Painted)
const tombPainted = () => wpOn() && !!wpTile('T10') && wpHas('d_inlay_scarab', 'd_inlay_eye', 'd_inlay_ankh', 'sarcophagus', 'offering');
const INLAY_ART = { offering: 'd_inlay_ankh', eye: 'd_inlay_eye', scarab: 'd_inlay_scarab' };
function chamberFloorPainted(ctx, i, R) {
  const boss = i === 3, X = R.x, Y = R.y, r = R.r;
  ctx.save(); ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.clip();
  ctx.fillStyle = wpPattern(ctx, 'T10', 300); ctx.fillRect(X - r, Y - r, r * 2, r * 2);
  if (boss) { ctx.fillStyle = 'rgba(40,20,70,.45)'; ctx.fillRect(X - r, Y - r, r * 2, r * 2); }
  const vg = ctx.createRadialGradient(X - r * 0.2, Y - r * 0.25, r * 0.3, X, Y, r); vg.addColorStop(0, 'rgba(255,230,180,.10)'); vg.addColorStop(1, 'rgba(40,20,10,.38)');
  ctx.fillStyle = vg; ctx.fillRect(X - r, Y - r, r * 2, r * 2);
  if (boss) inlay(ctx, 'eclipse', X, Y, 230, 0, null); else wpDecal(ctx, INLAY_ART[MOTIF[i]], X, Y, 320);
  ctx.restore();
  circle(ctx, X, Y, r, null, 4, INK);
  ctx.beginPath(); ctx.arc(X, Y, r - 3, Math.PI * 0.1, Math.PI * 0.9); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 6; ctx.stroke();
  if (!boss) { // painted sarcophagi standing against the wall + offering heaps
    for (const a of [Math.PI * 1.22, Math.PI * 1.78]) wpPropDirect(ctx, 'sarcophagus', X + Math.cos(a) * (r - 46), Y + Math.sin(a) * (r - 46) + 40, 96, a > Math.PI * 1.5);
    for (const a of [Math.PI * 0.8, Math.PI * 0.2]) wpPropDirect(ctx, 'offering', X + Math.cos(a) * (r - 52), Y + Math.sin(a) * (r - 52) + 18, 54, a < 1);
  }
}
/** Floor inlays: a different gold-lapis-turquoise mosaic per chamber. */
function inlay(ctx, kind, X, Y, R, t, T) {
  ctx.save(); ctx.translate(X, Y);
  circle(ctx, 0, 0, R, 'rgba(30,20,50,.18)', 0);
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.strokeStyle = '#c99a3a'; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = 'rgba(255,230,150,.6)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, R - 14, 0, TAU); ctx.strokeStyle = '#1f4fa8'; ctx.lineWidth = 5; ctx.stroke();
  if (kind === 'eclipse') {
    const sun = CUR && CUR.b && CUR.b.light === 'sun';
    ctx.globalAlpha *= 0.55; // a worn floor mosaic: it must never read as a live telegraph
    for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.05) * R * 0.45, Math.sin(a - 0.05) * R * 0.45); ctx.lineTo(Math.cos(a) * (R - 22), Math.sin(a) * (R - 22)); ctx.lineTo(Math.cos(a + 0.05) * R * 0.45, Math.sin(a + 0.05) * R * 0.45); ctx.closePath(); ctx.fillStyle = k % 2 ? (sun ? '#8f6f34' : '#5b3fa0') : (sun ? '#b8924a' : '#7a56d0'); ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke(); }
    circle(ctx, 0, 0, R * 0.42, sun ? '#a8843e' : '#140a26', 4);
    circle(ctx, R * 0.08, -R * 0.04, R * 0.36, sun ? 'rgba(255,255,255,.18)' : '#2a1850', 0);
  } else if (kind === 'eye') {
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.7, R * 0.34, 0, 0, TAU); ctx.fillStyle = '#e9dcb8'; ctx.fill(); ink(ctx, 3);
    circle(ctx, 0, 0, R * 0.26, '#1f4fa8', 3); circle(ctx, 0, 0, R * 0.12, '#140a26', 0); circle(ctx, -R * 0.06, -R * 0.06, R * 0.04, '#fff', 0);
    ctx.beginPath(); ctx.moveTo(-R * 0.1, R * 0.32); ctx.lineTo(-R * 0.18, R * 0.62); ctx.moveTo(R * 0.12, R * 0.32); ctx.quadraticCurveTo(R * 0.3, R * 0.62, R * 0.5, R * 0.5); ctx.strokeStyle = '#1f4fa8'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-R * 0.75, -R * 0.42); ctx.quadraticCurveTo(0, -R * 0.7, R * 0.7, -R * 0.42); ctx.stroke();
  } else if (kind === 'scarab') {
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, -R * 0.1); ctx.quadraticCurveTo(sd * R * 0.9, -R * 0.6, sd * R * 0.8, R * 0.05); ctx.quadraticCurveTo(sd * R * 0.5, -R * 0.05, 0, R * 0.1); ctx.closePath(); ctx.fillStyle = sd > 0 ? '#2fb7a8' : '#1f8f86'; ctx.fill(); ink(ctx, 2.5); for (let f = 1; f < 5; f++) { ctx.beginPath(); ctx.moveTo(sd * R * 0.12 * f, -R * 0.05); ctx.lineTo(sd * R * (0.15 + f * 0.15), -R * 0.42 + f * 0.06 * R); ctx.strokeStyle = 'rgba(255,230,150,.6)'; ctx.lineWidth = 1.6; ctx.stroke(); } }
    oval(ctx, 0, R * 0.12, R * 0.28, R * 0.36, '#e9b43a', LA, 3); oval(ctx, 0, -R * 0.24, R * 0.16, R * 0.12, '#c99a3a', LA, 2.5);
    circle(ctx, 0, -R * 0.5, R * 0.16, '#ff8a2a', 3);
  } else {
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(R * 0.3, 0); ctx.quadraticCurveTo(R * 0.55, -R * 0.14, R * 0.75, 0); ctx.quadraticCurveTo(R * 0.55, R * 0.14, R * 0.3, 0); ctx.fillStyle = k % 2 ? '#2fb7a8' : '#e9b43a'; ctx.fill(); ink(ctx, 2); ctx.restore(); }
    circle(ctx, 0, 0, R * 0.26, '#e9b43a', 3); circle(ctx, 0, 0, R * 0.14, '#1f4fa8', 2);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + Math.PI / 4; ellipse(ctx, Math.cos(a) * R * 0.18, Math.sin(a) * R * 0.18, 3.5, 2.2, '#fff3b0', 1, a); }
  }
  ctx.restore();
  void T; void t;
}
function sarcophagus(ctx, x, y, rot, v) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  shadow(ctx, 6, 8, 48, 22, 0.3);
  ctx.beginPath(); ctx.moveTo(-44, -14); ctx.quadraticCurveTo(-50, 0, -44, 14); ctx.lineTo(30, 18); ctx.quadraticCurveTo(48, 0, 30, -18); ctx.closePath();
  ctx.fillStyle = lgrad(ctx, 0, 0, 46, '#c99a3a', LA - rot); ctx.fill(); ink(ctx, 3);
  ctx.save(); ctx.clip(); for (let k = -36; k < 20; k += 9) { ctx.beginPath(); ctx.moveTo(k, -20); ctx.lineTo(k, 20); ctx.strokeStyle = k % 2 ? '#1f4fa8' : '#2fb7a8'; ctx.lineWidth = 3.4; ctx.stroke(); } ctx.restore();
  ctx.beginPath(); ctx.moveTo(-44, -14); ctx.quadraticCurveTo(-50, 0, -44, 14); ctx.lineTo(30, 18); ctx.quadraticCurveTo(48, 0, 30, -18); ctx.closePath(); ink(ctx, 3);
  oval(ctx, 30, 0, 13, 15, '#f2c14a', LA - rot, 2.6, 0, 0.6);
  ctx.beginPath(); ctx.moveTo(26, -16); ctx.lineTo(18, -18); ctx.lineTo(18, 18); ctx.lineTo(26, 16); ctx.fillStyle = '#1f4fa8'; ctx.fill(); ink(ctx, 1.6);
  circle(ctx, 34, -5, 2, INK, 0); circle(ctx, 34, 5, 2, INK, 0);
  ctx.beginPath(); ctx.moveTo(43, 0); ctx.lineTo(50, 0); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#1f4fa8'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-40, -12); ctx.lineTo(24, -16); ctx.strokeStyle = 'rgba(255,245,210,.55)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.restore(); void v;
}
function offering(ctx, x, y, k) {
  if (k === 0) { shadow(ctx, x + 2, y + 9, 9, 4, 0.25); ctx.beginPath(); ctx.moveTo(x - 5, y - 10); ctx.lineTo(x + 5, y - 10); ctx.quadraticCurveTo(x + 11, y, x + 5, y + 8); ctx.lineTo(x - 5, y + 8); ctx.quadraticCurveTo(x - 11, y, x - 5, y - 10); ctx.closePath(); ctx.fillStyle = lgrad(ctx, x, y, 10, '#c0703a'); ctx.fill(); ink(ctx, 2); ctx.beginPath(); ctx.moveTo(x - 7, y - 2); ctx.lineTo(x + 7, y - 2); ctx.strokeStyle = '#1f4fa8'; ctx.lineWidth = 1.6; ctx.stroke(); }
  else if (k === 1) { for (let i = 0; i < 3; i++) ball(ctx, x + (i - 1) * 6, y + (i % 2) * 4, 4.5, ['#ff5e5b', '#ffcf4a', '#7dc95e'][i], LA, 1.6, 0.5); }
  else if (k === 2) { ctx.beginPath(); ctx.moveTo(x - 9, y - 2); ctx.lineTo(x + 3, y - 4); ctx.lineTo(x + 9, y + 3); ctx.lineTo(x - 4, y + 5); ctx.closePath(); ctx.fillStyle = '#b8743e'; ctx.fill(); ink(ctx, 1.6); ctx.beginPath(); ctx.moveTo(x + 5, y - 7); ctx.lineTo(x + 12, y - 5); ctx.lineTo(x + 9, y); ctx.closePath(); ctx.fillStyle = '#a5652f'; ctx.fill(); ink(ctx, 1.4); }
  else { ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#efe3c6'; ctx.lineWidth = 2.6; ctx.stroke(); ball(ctx, x - 9, y, 3, '#efe3c6', LA, 1.4, 0); ball(ctx, x + 9, y, 3, '#efe3c6', LA, 1.4, 0); }
}
function torch(ctx, x, y, t, k) {
  const f = Math.sin(t * 13 + k * 1.7) * 2 + Math.sin(t * 21 + k) * 1.2;
  bloom(ctx, x, y - 8, 70, '#ffb347', 0.32 + 0.04 * f);
  if (wpOn() && wpProp(ctx, 'torch', x, y + 10, 46)) return;
  rrect(ctx, x - 5, y - 4, 10, 12, 3); ctx.fillStyle = lgrad(ctx, x, y, 6, '#7a5230'); ctx.fill(); ink(ctx, 2);
  ctx.beginPath(); ctx.moveTo(x - 8, y - 6); ctx.lineTo(x + 8, y - 6); ctx.lineTo(x + 5, y); ctx.lineTo(x - 5, y); ctx.closePath(); ctx.fillStyle = '#c99a3a'; ctx.fill(); ink(ctx, 1.8);
  ctx.beginPath(); ctx.moveTo(x - 6, y - 7); ctx.quadraticCurveTo(x - 7 + f * 0.4, y - 18, x + f * 0.6, y - 26 - f); ctx.quadraticCurveTo(x + 7, y - 16, x + 6, y - 7); ctx.closePath(); ctx.fillStyle = '#ff7a2c'; ctx.fill(); ink(ctx, 1.8);
  ctx.beginPath(); ctx.moveTo(x - 3, y - 7); ctx.quadraticCurveTo(x - 3, y - 14, x + f * 0.3, y - 19 - f * 0.5); ctx.quadraticCurveTo(x + 4, y - 12, x + 3, y - 7); ctx.closePath(); ctx.fillStyle = '#ffd23f'; ctx.fill();
  circle(ctx, x, y - 9, 1.8, '#fff6c8', 0);
}
function archway(ctx, x, y) {
  if (wpOn() && wpProp(ctx, 'archway', x, y + 14, 92)) return;
  for (const sd of [-1, 1]) { rrect(ctx, x + sd * 46 - 10, y - 26, 20, 40, 4); ctx.fillStyle = lgrad(ctx, x + sd * 46, y - 6, 14, '#d7b47a'); ctx.fill(); ink(ctx, 2.6); glyph(ctx, x + sd * 46, y - 8, sd > 0 ? 1 : 0, 0.8); }
  rrect(ctx, x - 58, y - 36, 116, 14, 4); ctx.fillStyle = lgrad(ctx, x, y - 29, 58, '#e3c48c'); ctx.fill(); ink(ctx, 2.6);
  ctx.beginPath(); ctx.moveTo(x - 52, y - 33); ctx.lineTo(x + 50, y - 33); ctx.strokeStyle = 'rgba(255,250,232,.7)'; ctx.lineWidth = 1.6; ctx.stroke();
}
/** The sun-door on a chamber's north rim: sealed (glyph seal) until the room is cleared, then a blazing gold gateway. */
function sunDoor(ctx, i, t, open) {
  const d = roomDoor(i), x = d.x, y = d.y - 20;
  if (wpOn() && wpPiece('sundoor') && wpPiece('sundoor_open')) {
    if (open) bloom(ctx, x, y - 10, 130, '#ffcf4a', 0.55 + 0.15 * Math.sin(t * 4));
    wpProp(ctx, open ? 'sundoor_open' : 'sundoor', x, y + 30, 112);
    if (open) { ctx.font = `16px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; const s = i === 2 ? 'TO THE SANCTUM ▲' : 'NEXT CHAMBER ▲'; ctx.strokeText(s, x, y + 50); ctx.fillStyle = '#ffe9a0'; ctx.fillText(s, x, y + 50); }
    return;
  }
  if (open) { bloom(ctx, x, y + 10, 130, '#ffcf4a', 0.55 + 0.15 * Math.sin(t * 4)); ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 5; k++) { const a = Math.PI / 2 + (k - 2) * 0.22 + Math.sin(t + k) * 0.03; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a - 0.05) * 180, y + Math.sin(a - 0.05) * 180); ctx.lineTo(x + Math.cos(a + 0.05) * 180, y + Math.sin(a + 0.05) * 180); ctx.closePath(); ctx.fillStyle = 'rgba(255,214,110,.12)'; ctx.fill(); } ctx.restore(); }
  for (const sd of [-1, 1]) { rrect(ctx, x + sd * 48 - 12, y - 46, 24, 70, 5); const g = ctx.createLinearGradient(x + sd * 48 - 12, 0, x + sd * 48 + 12, 0); g.addColorStop(0, '#efd8a8'); g.addColorStop(0.55, '#d4b07a'); g.addColorStop(1, '#a8804c'); ctx.fillStyle = g; ctx.fill(); ink(ctx, 2.8); for (let k = 0; k < 3; k++) glyph(ctx, x + sd * 48, y - 32 + k * 18, k + sd, 0.75); }
  ctx.beginPath(); ctx.moveTo(x - 36, y + 24); ctx.lineTo(x - 36, y - 30); ctx.quadraticCurveTo(x, y - 62, x + 36, y - 30); ctx.lineTo(x + 36, y + 24); ctx.closePath();
  if (open) { const g = ctx.createRadialGradient(x, y - 6, 4, x, y - 6, 50); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.4, '#ffd86a'); g.addColorStop(1, '#e98a1a'); ctx.fillStyle = g; ctx.fill(); ink(ctx, 3); ctx.save(); ctx.clip(); for (let arm = 0; arm < 3; arm++) { ctx.beginPath(); for (let k = 0; k <= 16; k++) { const a = t * 3 + arm * 2.09 + k * 0.3, rr = k * 3; const px = x + Math.cos(a) * rr, py = y - 6 + Math.sin(a) * rr; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2.4; ctx.stroke(); } ctx.restore(); }
  else { ctx.fillStyle = lgrad(ctx, x, y, 40, '#9c7a4c'); ctx.fill(); ink(ctx, 3); ctx.beginPath(); ctx.moveTo(x, y - 46); ctx.lineTo(x, y + 24); ctx.strokeStyle = 'rgba(40,20,10,.5)'; ctx.lineWidth = 2; ctx.stroke(); circle(ctx, x, y - 6, 14, '#5b3fa0', 2.6); glyph(ctx, x, y - 7, 0, 1.3, '#ffd86a'); }
  rrect(ctx, x - 66, y - 60, 132, 16, 4); ctx.fillStyle = lgrad(ctx, x, y - 52, 66, '#e3c48c'); ctx.fill(); ink(ctx, 2.6);
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sd * 8, y - 54); ctx.quadraticCurveTo(x + sd * 34, y - 66, x + sd * 58, y - 54); ctx.quadraticCurveTo(x + sd * 32, y - 48, x + sd * 8, y - 48); ctx.closePath(); ctx.fillStyle = '#f2c14a'; ctx.fill(); ink(ctx, 1.6); }
  ball(ctx, x, y - 52, 8, open ? '#ffcf4a' : '#c8433a', LA, 2.2);
  if (open) { ctx.font = `16px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; const s = i === 2 ? 'TO THE SANCTUM ▲' : 'NEXT CHAMBER ▲'; ctx.strokeText(s, x, y + 50); ctx.fillStyle = '#ffe9a0'; ctx.fillText(s, x, y + 50); }
}

// ------------------------------------------------------------------ braziers (decor) + Tomb obelisks (obstacles)
export function drawTombDecor(ctx, d, t) {
  if (d.kind !== 'brazier') return false;
  const i = BRAZIERS.findIndex((b) => b.x === d.x && b.y === d.y), s = CUR && CUR.b && CUR.b.braz ? CUR.b.braz[i] : null;
  const lit = s ? s[0] : 0, hold = s ? s[1] / B.brazier.hold : 0, dark = CUR && CUR.b && CUR.b.light === 'dark';
  const x = d.x, y = d.y;
  if (dark && !lit) { ctx.beginPath(); ctx.arc(x, y, B.brazier.r, 0, TAU); ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 20; ctx.strokeStyle = 'rgba(255,207,74,.7)'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; if (hold > 0) { ctx.beginPath(); ctx.arc(x, y, B.brazier.r + 6, -Math.PI / 2, -Math.PI / 2 + hold * TAU); ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke(); } }
  if (lit) { circle(ctx, x, y, B.brazier.light, 'rgba(255,190,80,.08)', 2, 'rgba(255,207,74,.45)'); bloom(ctx, x, y - 14, 90, '#ffb347', 0.6 + 0.1 * Math.sin(t * 9)); }
  shadow(ctx, x + 4, y + 14, 22, 8, 0.3);
  if (wpOn() && wpPiece('brazier')) { // painted brazier; unlit = the bowl and stand only (the painted flame clipped off)
    if (lit) wpProp(ctx, 'brazier', x, y + 16, 78);
    else { ctx.save(); ctx.beginPath(); ctx.rect(x - 60, y - 22, 120, 60); ctx.clip(); wpProp(ctx, 'brazier', x, y + 16, 78); ctx.restore(); ctx.beginPath(); ctx.ellipse(x, y - 21, 15, 4, 0, 0, TAU); ctx.fillStyle = dark ? '#5a2a1a' : '#2a1e18'; ctx.fill(); }
    return true;
  }
  ctx.lineCap = 'round';
  for (const sd of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(x + sd * 6, y - 4); ctx.lineTo(x + sd * 15, y + 14); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2.6; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x - 20, y - 12); ctx.quadraticCurveTo(x, y + 6, x + 20, y - 12); ctx.closePath(); ctx.fillStyle = lgrad(ctx, x, y - 6, 20, '#c99a3a'); ctx.fill(); ink(ctx, 2.6);
  ctx.beginPath(); ctx.ellipse(x, y - 12, 20, 6, 0, 0, TAU); ctx.fillStyle = lit ? '#ff7a2c' : '#3a2a22'; ctx.fill(); ink(ctx, 2.2);
  for (let k = 0; k < 4; k++) circle(ctx, x - 9 + k * 6, y - 12 + (k % 2), 2, lit ? '#ffd23f' : (dark ? '#a8402a' : '#5a3a2a'), 0);
  if (lit) {
    const f = Math.sin(t * 14 + x) * 2;
    ctx.beginPath(); ctx.moveTo(x - 14, y - 13); ctx.quadraticCurveTo(x - 12, y - 32, x + f, y - 46 - f); ctx.quadraticCurveTo(x + 13, y - 30, x + 14, y - 13); ctx.closePath(); ctx.fillStyle = '#ff7a2c'; ctx.fill(); ink(ctx, 2);
    ctx.beginPath(); ctx.moveTo(x - 7, y - 13); ctx.quadraticCurveTo(x - 6, y - 26, x + f * 0.5, y - 34); ctx.quadraticCurveTo(x + 7, y - 24, x + 7, y - 13); ctx.closePath(); ctx.fillStyle = '#ffd23f'; ctx.fill();
  }
  return true;
}
export function drawTombObstacle(ctx, o, t) {
  if (wpOn() && o.tomb) { const a = dunesPropArt(o); if (a && wpPiece(a.name)) { drawPaintedProp(ctx, a, o.x, o.y + o.size * 0.45); if (o.kind === 'tombobelisk' && CUR && CUR.b && CUR.b.light === 'sun') bloom(ctx, o.x, o.y + o.size * 0.45 - a.h * 0.9, o.size * 1.6, '#ffcf4a', 0.6 + 0.2 * Math.sin(t * 2.5 + o.variant)); return true; } }
  if (o.kind === 'tombobelisk') { obelisk(ctx, o, t, true, CUR && CUR.b && CUR.b.light === 'sun'); return true; }
  if (o.kind === 'tombpillar') { pillar(ctx, o); return true; }
  return false;
}
/** A painted lotus column (2.5D): plinth, fluted shaft with painted bands and a glyph column, a lotus capital. */
function pillar(ctx, o) {
  const s = o.size, x = o.x, y = o.y + s * 0.55, Ht = s * 2.6, w = s * 1.15;
  ctx.save(); ctx.globalAlpha = 0.28; ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w * 1.9, y + s * 0.8); ctx.lineTo(x + w * 2.3, y + s * 0.4); ctx.lineTo(x + w / 2, y - 4); ctx.closePath(); ctx.fillStyle = '#1a1020'; ctx.fill(); ctx.restore();
  rrect(ctx, x - w * 0.75, y - s * 0.25, w * 1.5, s * 0.5, 4); ctx.fillStyle = lgrad(ctx, x, y, w, '#c9a46a'); ctx.fill(); ink(ctx, 2.6);
  rrect(ctx, x - w / 2, y - Ht, w, Ht, 6);
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, '#f2dcae'); g.addColorStop(0.45, '#d9b77a'); g.addColorStop(1, '#9e7a48'); ctx.fillStyle = g; ctx.fill(); ink(ctx, 2.8);
  ctx.save(); rrect(ctx, x - w / 2, y - Ht, w, Ht, 6); ctx.clip();
  for (let k = 1; k < 5; k++) { const fx = x - w / 2 + (k / 5) * w; ctx.beginPath(); ctx.moveTo(fx, y - Ht); ctx.lineTo(fx, y); ctx.strokeStyle = 'rgba(80,50,20,.25)'; ctx.lineWidth = 1.4; ctx.stroke(); }
  for (const [yy, c] of [[0.18, '#1f4fa8'], [0.24, '#f2c14a'], [0.3, '#c8433a'], [0.78, '#c8433a'], [0.84, '#f2c14a'], [0.9, '#1f4fa8']]) { ctx.beginPath(); ctx.ellipse(x, y - Ht * yy, w / 2 + 1, 4, 0, 0, Math.PI); ctx.strokeStyle = c; ctx.lineWidth = 4.5; ctx.stroke(); }
  for (let k = 0; k < 3; k++) glyph(ctx, x - w * 0.08, y - Ht * (0.42 + k * 0.11), k + o.variant, s / 32, 'rgba(60,35,15,.75)');
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(x - w / 2 + 3, y - Ht + 8); ctx.lineTo(x - w / 2 + 3, y - 4); ctx.strokeStyle = 'rgba(255,250,232,.7)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - w / 2, y - Ht + 4); ctx.quadraticCurveTo(x - w * 0.95, y - Ht - s * 0.25, x - w * 0.62, y - Ht - s * 0.48); ctx.lineTo(x + w * 0.62, y - Ht - s * 0.48); ctx.quadraticCurveTo(x + w * 0.95, y - Ht - s * 0.25, x + w / 2, y - Ht + 4); ctx.closePath();
  ctx.fillStyle = lgrad(ctx, x, y - Ht - s * 0.2, w, '#2fb7a8'); ctx.fill(); ink(ctx, 2.6);
  ctx.strokeStyle = 'rgba(10,60,55,.55)'; ctx.lineWidth = 1.4; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x + k * w * 0.12, y - Ht + 2); ctx.lineTo(x + k * w * 0.26, y - Ht - s * 0.44); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(x, y - Ht - s * 0.48, w * 0.64, s * 0.14, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, x, y - Ht - s * 0.5, w * 0.6, '#e3c48c'); ctx.fill(); ink(ctx, 2.4);
}

// ------------------------------------------------------------------ under layer: rising dead, the chest, boss telegraphs
export function drawTombUnder(ctx, sim, local, t) {
  const T = (CUR = tombState(sim)); ENEMY_ENV.dark = !!(T && T.b && T.b.light === 'dark');
  if (!T) return;
  if (T.pend) for (const [x, y, el] of T.pend.pts) riseMark(ctx, x, y, el, 1 - T.pend.t / TOMB.rise, t);
  if (T.chest) chest(ctx, T.chest, t);
  const Bd = T.b;
  if (!Bd) return;
  for (const te of Bd.tele) if (!te.done) tele(ctx, te, t, local);
}
function riseMark(ctx, x, y, elite, k, t) {
  const col = elite ? '#ffcf3a' : '#ff6a3c', r = 34 + k * 10;
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.6, 0, 0, TAU); ctx.fillStyle = `rgba(40,20,10,${0.25 + 0.35 * k})`; ctx.fill();
  ctx.rotate(t * 2); ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.6, 0, 0, TAU); ctx.setLineDash([8, 6]); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
  ctx.rotate(-t * 2);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + t, rr = r * (1 - ((t * 1.5 + i / 6) % 1)); circle(ctx, Math.cos(a) * rr, Math.sin(a) * rr * 0.6, 2.4, '#e2b775', 0); }
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 8, 4); ctx.lineTo(sd * (10 + k * 6), -6 - k * 16); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#e9dcb8'; ctx.lineWidth = 3.4; ctx.stroke(); }
  ctx.restore();
  if (elite) { ctx.font = `12px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeText('ELITE', x, y - 30); ctx.fillStyle = '#ffcf3a'; ctx.fillText('ELITE', x, y - 30); }
}
function chest(ctx, c, t) {
  const x = c.x, y = c.y, open = c.open;
  if (!open) { bloom(ctx, x, y - 8, 80, '#ffcf4a', 0.45 + 0.15 * Math.sin(t * 4)); for (let i = 0; i < 6; i++) { const ph = (t * 0.7 + i / 6) % 1; star(ctx, x + Math.cos(i * 2.3) * 26, y - 10 - ph * 50, 3 * (1 - ph) + 1, '#fff3b0', 0); } }
  shadow(ctx, x + 4, y + 16, 34, 10, 0.32);
  if (wpOn() && wpPiece('tchest') && wpPiece('tchest_open')) {
    wpProp(ctx, open ? 'tchest_open' : 'tchest', x, y + 18, open ? 70 : 58);
    if (open) bloom(ctx, x, y - 18, 40, '#fff3b0', 0.3);
  } else {
  rrect(ctx, x - 30, y - 16, 60, 32, 6); ctx.fillStyle = lgrad(ctx, x, y, 30, '#1f4fa8'); ctx.fill(); ink(ctx, 3);
  for (const bx of [-18, 18]) { rrect(ctx, x + bx - 4, y - 16, 8, 32, 2); ctx.fillStyle = '#f2c14a'; ctx.fill(); ink(ctx, 1.6); }
  if (open) { ctx.beginPath(); ctx.moveTo(x - 30, y - 16); ctx.lineTo(x - 26, y - 42); ctx.lineTo(x + 26, y - 42); ctx.lineTo(x + 30, y - 16); ctx.closePath(); ctx.fillStyle = '#16367a'; ctx.fill(); ink(ctx, 2.6); bloom(ctx, x, y - 18, 40, '#fff3b0', 0.5); }
  else { ctx.beginPath(); ctx.moveTo(x - 32, y - 14); ctx.quadraticCurveTo(x, y - 40, x + 32, y - 14); ctx.closePath(); ctx.fillStyle = lgrad(ctx, x, y - 24, 32, '#2a5fc0'); ctx.fill(); ink(ctx, 3); ctx.beginPath(); ctx.moveTo(x - 26, y - 20); ctx.quadraticCurveTo(x - 6, y - 34, x + 12, y - 30); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.stroke(); }
  ball(ctx, x, y - 13, 6, '#f2c14a', LA, 2);
  }
  ctx.font = `13px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = INK; const s = open ? 'LOOTED' : 'BONUS CHEST: walk up'; ctx.strokeText(s, x, y + 34); ctx.fillStyle = open ? '#b9b3c6' : '#ffe9a0'; ctx.fillText(s, x, y + 34);
}
function tele(ctx, te, t, local) {
  const k = Math.min(1, te.t / te.d), sun = te.col === 'sun', cue = te.pid ? 'spread' : 'away', base = cue === 'spread' ? '192,107,255' : '255,77,94', edge = cue === 'spread' ? '#c06bff' : '#ff4d5e'; // (the game-wide colour grammar)
  const pulse = 0.5 + 0.5 * Math.sin(t * (10 + k * 14));
  ctx.save();
  if (te.sh === 'circle') {
    circle(ctx, te.x, te.y, te.r, `rgba(${base},${0.12 + 0.12 * k})`, 3, edge);
    circle(ctx, te.x, te.y, te.r * k, `rgba(${base},${0.25 + 0.2 * pulse})`, 0);
    if (sun) { for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + t; ctx.beginPath(); ctx.moveTo(te.x + Math.cos(a) * te.r, te.y + Math.sin(a) * te.r); ctx.lineTo(te.x + Math.cos(a) * (te.r + 10), te.y + Math.sin(a) * (te.r + 10)); ctx.strokeStyle = edge; ctx.lineWidth = 3; ctx.stroke(); } bloom(ctx, te.x, te.y - 200 * (1 - k), 30 + 20 * k, '#ffe08a', 0.7); }
    else { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU - t * 1.5; ctx.beginPath(); ctx.moveTo(te.x + Math.cos(a) * te.r, te.y + Math.sin(a) * te.r); ctx.quadraticCurveTo(te.x + Math.cos(a + 0.6) * te.r * 0.5, te.y + Math.sin(a + 0.6) * te.r * 0.5, te.x + Math.cos(a + 1.2) * te.r * 0.15 * (1 - k), te.y + Math.sin(a + 1.2) * te.r * 0.15 * (1 - k)); ctx.strokeStyle = 'rgba(30,10,60,.7)'; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#b69cff'; ctx.lineWidth = 2; ctx.stroke(); } }
    if (te.pid && local && te.pid === local.id) { ctx.font = `14px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText('SUNFALL ON YOU: SPREAD!', te.x, te.y - te.r - 12); ctx.fillStyle = '#c06bff'; ctx.fillText('SUNFALL ON YOU: SPREAD!', te.x, te.y - te.r - 12); }
  } else if (te.sh === 'rect') {
    ctx.translate(te.x, te.y); ctx.rotate(te.ang);
    ctx.fillStyle = `rgba(${base},${0.12 + 0.1 * k})`; ctx.fillRect(-te.len / 2, -te.w / 2, te.len, te.w);
    ctx.fillStyle = `rgba(${base},${0.28 + 0.15 * pulse})`; ctx.fillRect(-te.len / 2, -te.w / 2, te.len * k, te.w);
    ctx.strokeStyle = edge; ctx.lineWidth = 3; ctx.strokeRect(-te.len / 2, -te.w / 2, te.len, te.w);
    ctx.beginPath(); ctx.moveTo(-te.len / 2, 0); ctx.lineTo(te.len / 2, 0); ctx.setLineDash([16, 14]); ctx.lineDashOffset = -t * 60; ctx.strokeStyle = sun ? 'rgba(255,250,220,.7)' : 'rgba(220,200,255,.6)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
  } else if (te.sh === 'shade') { // NOON FLARE: the whole sanctum burns except the obelisks' shadows
    const R = BOSS_ROOM;
    ctx.beginPath(); ctx.arc(R.x, R.y, R.r, 0, TAU);
    for (const [x, y, a] of te.z) { const c = Math.cos(a), s = Math.sin(a), hl = te.len / 2, hw = te.w / 2; ctx.moveTo(x - c * hl + s * hw, y - s * hl - c * hw); ctx.lineTo(x - c * hl - s * hw, y - s * hl + c * hw); ctx.lineTo(x + c * hl - s * hw, y + s * hl + c * hw); ctx.lineTo(x + c * hl + s * hw, y + s * hl - c * hw); ctx.closePath(); }
    ctx.fillStyle = `rgba(214,28,52,${0.2 + 0.4 * k})`; ctx.fill('evenodd');
    for (const [x, y, a] of te.z) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = 'rgba(30,20,70,.4)'; ctx.fillRect(-te.len / 2, -te.w / 2, te.len, te.w); ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.strokeRect(-te.len / 2, -te.w / 2, te.len, te.w); ctx.setLineDash([]); ctx.rotate(-a); ctx.font = `13px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeText('SHADE', 0, 4); ctx.fillStyle = '#7dffb0'; ctx.fillText('SHADE', 0, 4); ctx.restore(); }
    bloom(ctx, R.x, R.y - R.r * 0.2, R.r * (0.6 + k * 0.6), '#fff3b0', 0.2 + 0.35 * k);
  } else if (te.sh === 'half') {
    const R = BOSS_ROOM, c = Math.cos(te.ang), s = Math.sin(te.ang);
    ctx.beginPath(); ctx.arc(R.x, R.y, R.r, 0, TAU); ctx.clip();
    ctx.beginPath(); ctx.moveTo(R.x - s * 900, R.y + c * 900); ctx.lineTo(R.x + s * 900, R.y - c * 900); ctx.lineTo(R.x + s * 900 + c * 900, R.y - c * 900 + s * 900); ctx.lineTo(R.x - s * 900 + c * 900, R.y + c * 900 + s * 900); ctx.closePath();
    ctx.fillStyle = `rgba(${base},${0.12 + 0.22 * k})`; ctx.fill();
    ctx.beginPath(); ctx.moveTo(R.x - s * 600, R.y + c * 600); ctx.lineTo(R.x + s * 600, R.y - c * 600); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.setLineDash([22, 12]); ctx.lineDashOffset = -t * 40; ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ Neferakh, the Sun-Eaten King
ENEMY_DRAW.neferakh = function neferakh(ctx, e, t, col) {
  const r = e.r, la = lightLocal(e), Bd = CUR && CUR.b, light = Bd ? Bd.light : 'sun', dark = light === 'dark', p3 = e.phase === 3, bob = Math.sin(t * 2) * 3;
  ctx.translate(0, bob * 0.3);
  if (!dark) { ctx.save(); ctx.rotate(t * 0.5); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.08) * r * 1.1, Math.sin(a - 0.08) * r * 1.1); ctx.lineTo(Math.cos(a) * r * (i % 2 ? 1.7 : 2.0), Math.sin(a) * r * (i % 2 ? 1.7 : 2.0)); ctx.lineTo(Math.cos(a + 0.08) * r * 1.1, Math.sin(a + 0.08) * r * 1.1); ctx.closePath(); ctx.fillStyle = i % 2 ? 'rgba(255,207,74,.55)' : 'rgba(255,150,40,.45)'; ctx.fill(); } ctx.restore(); }
  else { ctx.save(); ctx.globalAlpha *= 0.55; for (let i = 0; i < 7; i++) { const a = t * 0.8 + (i / 7) * TAU, rr = r * (1.25 + 0.15 * Math.sin(t * 3 + i)); ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, r * 0.35, 0, TAU); ctx.fillStyle = 'rgba(60,20,110,.6)'; ctx.fill(); } ctx.restore(); }
  // the folded wing-cloak: rows of feathers (lapis / gold / turquoise)
  for (const sd of [-1, 1]) {
    ctx.save(); ctx.scale(1, sd);
    for (let row = 0; row < 3; row++) {
      const n = 6, rr = r * (1.45 - row * 0.22);
      for (let i = n - 1; i >= 0; i--) { const a = Math.PI * 0.42 + (i / n) * Math.PI * 0.55 + Math.sin(t * 1.5 + i) * 0.02, fx = Math.cos(a) * rr - r * 0.25, fy = Math.sin(a) * rr; ctx.beginPath(); ctx.ellipse(fx, fy, r * 0.26, r * 0.11, a, 0, TAU); ctx.fillStyle = lgrad(ctx, fx, fy, r * 0.26, ['#1f4fa8', '#e9b43a', '#2fb7a8'][row], la); ctx.fill(); ink(ctx, 2); ctx.beginPath(); ctx.moveTo(fx - Math.cos(a) * r * 0.2, fy - Math.sin(a) * r * 0.2); ctx.lineTo(fx + Math.cos(a) * r * 0.2, fy + Math.sin(a) * r * 0.2); ctx.strokeStyle = 'rgba(255,250,220,.45)'; ctx.lineWidth = 1.2; ctx.stroke(); }
    }
    ctx.restore();
  }
  // body + usekh collar
  oval(ctx, -r * 0.1, 0, r * 0.78, r * 0.82, dark ? '#3a2e52' : '#f3ead2', la, 4, 0, 0.5);
  for (const [rr, c] of [[0.74, '#1f4fa8'], [0.64, '#f2c14a'], [0.54, '#2fb7a8'], [0.44, '#c8433a'], [0.36, '#f2c14a']]) { ctx.beginPath(); ctx.arc(r * 0.22, 0, r * rr, Math.PI * 0.52, Math.PI * 1.48); ctx.strokeStyle = c; ctx.lineWidth = r * 0.085; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(r * 0.22, 0, r * 0.79, Math.PI * 0.52, Math.PI * 1.48); ink(ctx, 2);
  for (let i = 0; i < 11; i++) { const a = Math.PI * 0.55 + (i / 10) * Math.PI * 0.9; circle(ctx, r * 0.22 + Math.cos(a) * r * 0.79, Math.sin(a) * r * 0.79, 2.6, '#f2c14a', 1.2); }
  // the swallowed sun in his chest (an eclipse in the DARK)
  const cx = -r * 0.32, cr = r * 0.3, beat = 1 + 0.06 * Math.sin(t * 6);
  if (!dark) bloom(ctx, cx, 0, r * 1.1, '#ffcf4a', 0.85);
  else bloom(ctx, cx, 0, r * 0.9, '#8a5cff', 0.7);
  circle(ctx, cx, 0, cr * 1.18 * beat, dark ? '#1a0c30' : '#ff9a2a', 3);
  circle(ctx, cx, 0, cr * beat, dark ? '#0a0414' : '#fff3b0', 0);
  if (dark) { ctx.beginPath(); ctx.arc(cx, 0, cr * beat, 0, TAU); ctx.strokeStyle = '#c9a8ff'; ctx.lineWidth = 3; ctx.stroke(); }
  ctx.strokeStyle = dark ? '#b69cff' : '#ffcf4a'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * cr * 1.15, Math.sin(a) * cr * 1.15); ctx.lineTo(cx + Math.cos(a + 0.2) * cr * 1.6, Math.sin(a + 0.2) * cr * 1.6); ctx.lineTo(cx + Math.cos(a) * cr * 2.0, Math.sin(a) * cr * 2.0); ctx.stroke(); }
  // crook and flail, crossed
  ctx.save(); ctx.translate(r * 0.2, 0);
  for (const sd of [-1, 1]) { ctx.save(); ctx.rotate(sd * 0.55); ctx.beginPath(); ctx.moveTo(-r * 0.3, 0); ctx.lineTo(r * 0.9, 0); ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.stroke(); ctx.save(); ctx.setLineDash([7, 7]); ctx.strokeStyle = '#1f4fa8'; ctx.lineWidth = 5; ctx.stroke(); ctx.lineDashOffset = 7; ctx.strokeStyle = '#f2c14a'; ctx.stroke(); ctx.restore(); if (sd < 0) { ctx.beginPath(); ctx.arc(r * 0.9, -r * 0.14, r * 0.14, Math.PI / 2, Math.PI * 1.9, true); ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = '#f2c14a'; ctx.lineWidth = 4.5; ctx.stroke(); } else { for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(r * 0.9, 0); ctx.quadraticCurveTo(r * 1.1, k * r * 0.1 + Math.sin(t * 5 + k) * 3, r * 1.25, k * r * 0.22); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.setLineDash([3, 3]); ctx.strokeStyle = k ? '#c8433a' : '#2fb7a8'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]); } } ctx.restore(); }
  ctx.restore();
  // nemes headdress + gold mask
  const hx = r * 0.5;
  ctx.beginPath(); ctx.moveTo(hx - r * 0.42, -r * 0.5); ctx.quadraticCurveTo(hx + r * 0.1, -r * 0.62, hx + r * 0.3, -r * 0.3); ctx.lineTo(hx + r * 0.3, r * 0.3); ctx.quadraticCurveTo(hx + r * 0.1, r * 0.62, hx - r * 0.42, r * 0.5); ctx.quadraticCurveTo(hx - r * 0.6, 0, hx - r * 0.42, -r * 0.5); ctx.closePath();
  ctx.fillStyle = lgrad(ctx, hx, 0, r * 0.5, '#1f4fa8', la); ctx.fill(); ink(ctx, 3.2);
  ctx.save(); ctx.clip(); for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(hx - r * 0.6, i * r * 0.1); ctx.lineTo(hx + r * 0.4, i * r * 0.1 * 0.8); ctx.strokeStyle = '#f2c14a'; ctx.lineWidth = r * 0.04; ctx.stroke(); } ctx.restore();
  oval(ctx, hx + r * 0.1, 0, r * 0.25, r * 0.28, '#f2c14a', la, 2.8, 0, 0.7);
  ctx.beginPath(); ctx.moveTo(hx + r * 0.32, -r * 0.05); ctx.lineTo(hx + r * 0.48, 0); ctx.lineTo(hx + r * 0.32, r * 0.05); ctx.closePath(); ctx.fillStyle = '#1f4fa8'; ctx.fill(); ink(ctx, 1.6); // beard
  const eyeC = dark ? '#c9a8ff' : '#fffbe0';
  bloom(ctx, hx + r * 0.18, 0, r * 0.3, dark ? '#8a5cff' : '#ffcf4a', 0.7);
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + r * 0.16, sd * r * 0.1, r * 0.06, r * 0.035, 0, 0, TAU); ctx.fillStyle = eyeC; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke(); }
  // uraeus cobra
  ctx.beginPath(); ctx.moveTo(hx + r * 0.3, 0); ctx.quadraticCurveTo(hx + r * 0.42, -r * 0.08, hx + r * 0.52, 0); ctx.quadraticCurveTo(hx + r * 0.42, r * 0.08, hx + r * 0.3, 0); ctx.fillStyle = '#e9b43a'; ctx.fill(); ink(ctx, 1.6);
  circle(ctx, hx + r * 0.46, 0, 2.2, '#c8433a', 0);
  if (p3) { ctx.beginPath(); ctx.moveTo(hx + r * 0.05, -r * 0.2); ctx.lineTo(hx + r * 0.14, -r * 0.05); ctx.lineTo(hx + r * 0.08, r * 0.12); ctx.lineTo(hx + r * 0.2, r * 0.22); ctx.strokeStyle = dark ? '#c9a8ff' : '#ff7a2c'; ctx.lineWidth = 2.2; ctx.stroke(); }
  void col;
};

// ------------------------------------------------------------------ over layer: god rays in the SUN, real darkness in the DARK
let darkCv = null;
function darkLayer() { if (!darkCv && typeof document !== 'undefined') { darkCv = document.createElement('canvas'); darkCv.width = darkCv.height = 300; } return darkCv; }
export function drawTombOver(ctx, sim, local, t) {
  const T = CUR || tombState(sim);
  if (!T || !T.b || !local || tombRoomAt(local.x, local.y, 60) !== 3) return;
  const Bd = T.b, R = BOSS_ROOM, light = Bd.light;
  if (light === 'sun' && Bd.st !== 'pull') {
    ctx.save(); ctx.beginPath(); ctx.arc(R.x, R.y, R.r + 40, 0, TAU); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { const x = R.x - R.r + ((i * 190 + t * 25) % (R.r * 2 + 200)) - 100, w = 50 + (i % 3) * 30; ctx.beginPath(); ctx.moveTo(x, R.y - R.r - 60); ctx.lineTo(x + w, R.y - R.r - 60); ctx.lineTo(x + w + 380, R.y + R.r + 60); ctx.lineTo(x + 380, R.y + R.r + 60); ctx.closePath(); ctx.fillStyle = `rgba(255,214,120,${0.05 + 0.03 * Math.sin(t * 1.3 + i)})`; ctx.fill(); }
    for (let i = 0; i < 24; i++) { const a = H(i, 7) * TAU, rr = H(i, 8) * R.r, y = R.y + Math.sin(a) * rr - ((t * 20 + i * 40) % 120); star(ctx, R.x + Math.cos(a) * rr, y, 1.6, '#fff3b0', 0); }
    ctx.restore();
  }
  const cv = darkLayer();
  if (cv && (light === 'dark' || light === 'twilight') && Bd.st === 'fight') {
    const S = 600 / cv.width * 2, size = cv.width * S / 2 * 2, ox = R.x - size / 2, oy = R.y - size / 2, k = cv.width / size;
    const g = cv.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = light === 'dark' ? 'rgba(6,2,18,.88)' : 'rgba(10,4,26,.7)';
    if (light === 'twilight' && Bd.tw) { const c = Math.cos(Bd.tw.ang), s = Math.sin(Bd.tw.ang), cx = (R.x - ox) * k, cy = (R.y - oy) * k, F = 400; g.beginPath(); g.moveTo(cx - s * F, cy + c * F); g.lineTo(cx + s * F, cy - c * F); g.lineTo(cx + s * F - c * F, cy - c * F - s * F); g.lineTo(cx - s * F - c * F, cy + c * F - s * F); g.closePath(); g.fill(); }
    else g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a = 1) => { const hx = (x - ox) * k, hy = (y - oy) * k, hr = r * k, gr = g.createRadialGradient(hx, hy, hr * 0.35, hx, hy, hr); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(hx, hy, hr, 0, TAU); g.fill(); };
    const lift = heroArt.painted ? 40 : 0; // (painted heroes are tall: the light hole sits on the chest)
    for (const p of sim.players.values()) if (!p.dead) hole(p.x, p.y - lift, 130, 0.95);
    BRAZIERS.forEach((b, i) => { const s = Bd.braz[i]; if (s && s[0]) hole(b.x, b.y, B.brazier.light + 30, 1); else if (s && s[1] > 0) hole(b.x, b.y, 50 + 100 * (s[1] / B.brazier.hold), 0.7); else hole(b.x, b.y, 46, 0.35); });
    const nb = sim.enemies.find((e) => e.type === 'neferakh'); if (nb) { const top = enemyTop(nb); if (top) hole(nb.x, nb.y - top * 0.45, top * 0.5, 0.6); else hole(nb.x, nb.y, 80, 0.6); } // (painted: the whole 280-unit figure shows through the shroud, dimmed)
    ctx.save(); ctx.beginPath(); ctx.arc(R.x, R.y, R.r + 50, 0, TAU); ctx.clip(); ctx.drawImage(cv, ox, oy, size, size); ctx.restore();
    if (light === 'dark') { ctx.save(); ctx.globalAlpha = 0.5; for (let i = 0; i < 10; i++) { const a = t * 0.3 + i * 0.63, rr = R.r * (0.4 + 0.5 * H(i, 3)); ctx.beginPath(); ctx.arc(R.x + Math.cos(a) * rr, R.y + Math.sin(a) * rr, 26, 0, TAU); ctx.fillStyle = 'rgba(90,40,160,.18)'; ctx.fill(); } ctx.restore(); }
  }
  if (Bd.flip > 0) { const k = 1 - Bd.flip / B.flip, sun = light === 'sun'; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.arc(R.x, R.y, R.r * k * 1.2, 0, TAU); ctx.lineWidth = 30 * (1 - k) + 4; ctx.strokeStyle = sun ? `rgba(255,214,110,${1 - k})` : `rgba(160,110,255,${1 - k})`; ctx.stroke(); ctx.restore(); }
}

// ------------------------------------------------------------------ HUD (screen space)
const ROOM_SUB = ['Hall of Offerings', 'Gallery of Mirages', 'Sanctum of Scarabs'];
export function drawTombHud(ctx, sim, p, w, h, txt, bar, time) {
  const T = tombState(sim);
  if (!T || !p || !inTombArea(p.x, p.y)) return 0;
  let y = 92;
  if (T.st === 'room' || T.st === 'clear') {
    txt(ctx, `Chamber ${T.room + 1}/3 · ${ROOM_SUB[T.room] || ''}`, w / 2, y + 18, 20, '#fff', 'center', 4);
    const wv = T.st === 'clear' ? 'CLEARED: through the sun-door' : `Wave ${Math.max(1, T.wave)}/${T.nw}`;
    txt(ctx, wv, w / 2, y + 42, 16, T.st === 'clear' ? '#7dffb0' : '#ffcf4a', 'center', 3);
    if (T.ch) { // the chain challenge tracker
      const cw = 300, cx = w / 2 - cw / 2, cy = y + 56, done = T.ch.done || T.ch.n >= T.ch.need;
      rrect(ctx, cx, cy, cw, 40, 10); ctx.fillStyle = 'rgba(43,36,51,.8)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = done ? '#7dffb0' : '#ffcf4a'; ctx.stroke();
      txt(ctx, `BONUS CHEST · ${T.ch.text}`, cx + 12, cy + 17, 13, done ? '#7dffb0' : '#ffe9a0', 'left', 3);
      for (let i = 0; i < T.ch.need; i++) { const px = cx + 14 + i * Math.min(24, (cw - 28) / T.ch.need); circle(ctx, px + 6, cy + 30, 5.5, i < T.ch.n ? (done ? '#7dffb0' : '#ffcf4a') : 'rgba(255,255,255,.18)', 1.6); }
      if (done) txt(ctx, '✔', cx + cw - 22, cy + 26, 20, '#7dffb0', 'center', 3);
      y = cy + 44;
    } else y += 52;
  } else if (T.b) {
    const Bd = T.b, nb = sim.enemies.find((e) => e.type === 'neferakh');
    const bbw = Math.min(640, w * 0.52), bbx = w / 2 - bbw / 2, bby = y;
    if (Bd.st === 'victory') { txt(ctx, 'THE SUN IS FREED', w / 2, bby - 4, 20, '#ffe9a0', 'center', 4); txt(ctx, 'Grab the loot: back to the village shortly', w / 2, bby + 18, 15, '#fff', 'center', 3); return bby + 30; }
    txt(ctx, 'Neferakh, the Sun-Eaten King', w / 2, bby - 4, 22, '#ffcf4a', 'center', 4);
    if (Bd.st === 'pull') txt(ctx, `He wakes in ${Math.ceil(Bd.pull / 60)}…`, w / 2, bby + 24, 18, '#fff', 'center', 3);
    else if (nb) {
      bar(ctx, bbx, bby + 10, bbw, 22, nb.hp / nb.maxHp, Bd.light === 'dark' ? '#8a5cff' : '#ffb43c', `${Math.ceil(nb.hp)} / ${nb.maxHp}`);
      for (const k of [0.66, 0.33]) { ctx.fillStyle = INK; ctx.fillRect(bbx + bbw * k - 2, bby + 8, 4, 26); }
      txt(ctx, `Phase ${Bd.phase}`, bbx + bbw + 8, bby + 22, 14, '#fff', 'left', 3);
      // the light dial
      const dk = Bd.ld ? Bd.lt / Bd.ld : 0, lc = Bd.light === 'sun' ? '#ffcf4a' : Bd.light === 'dark' ? '#8a5cff' : '#ff7ab8';
      const dx = w / 2, dy = bby + 64;
      circle(ctx, dx, dy, 20, 'rgba(43,36,51,.85)', 3);
      ctx.beginPath(); ctx.moveTo(dx, dy); ctx.arc(dx, dy, 17, -Math.PI / 2, -Math.PI / 2 + dk * TAU); ctx.closePath(); ctx.fillStyle = lc; ctx.fill();
      if (Bd.light === 'sun') { star(ctx, dx, dy, 9, '#fff6c8', 1.5); } else if (Bd.light === 'dark') { circle(ctx, dx, dy, 8, '#140a26', 2, '#c9a8ff'); } else { ctx.beginPath(); ctx.arc(dx, dy, 8, -Math.PI / 2, Math.PI / 2); ctx.fillStyle = '#ffcf4a'; ctx.fill(); ctx.beginPath(); ctx.arc(dx, dy, 8, Math.PI / 2, Math.PI * 1.5); ctx.fillStyle = '#140a26'; ctx.fill(); circle(ctx, dx, dy, 8, null, 1.5); }
      const label = Bd.light === 'sun' ? 'HIGH SUN' : Bd.light === 'dark' ? 'NIGHT' : 'TWILIGHT';
      txt(ctx, label, dx - 30, dy + 6, 18, lc, 'right', 4);
      let tip = '';
      if (Bd.light === 'sun') tip = 'Full damage · dodge lances, spread Sunfall, hide in obelisk shade at Noon';
      else if (Bd.light === 'dark') { const exposed = nb && BRAZIERS.some((b, i) => Bd.braz[i] && Bd.braz[i][0] && Math.hypot(nb.x - b.x, nb.y - b.y) < B.brazier.light + nb.r * 0.4); tip = exposed ? 'EXPOSED in the brazier light: x1.3 damage!' : 'SHROUDED (x0.2) · stand on a brazier to light it, pull him into the light'; }
      else tip = 'Stand on the LIT half to hurt him · the dark half bites next';
      txt(ctx, `${Math.ceil(Bd.lt / 60)}s`, dx + 30, dy + 6, 16, '#fff', 'left', 3);
      txt(ctx, tip, w / 2, dy + 36, 14, '#fff', 'center', 3);
      if (Bd.enraged) txt(ctx, 'ENDLESS NIGHT', w / 2, dy + 56, 16, '#ff5e5b', 'center', 3);
      else if (Bd.enr > 0 && Bd.enr < 60 * 60) txt(ctx, `Endless Night in ${Math.ceil(Bd.enr / 60)}s`, w / 2, dy + 56, 13, '#ff9a8a', 'center', 3);
    }
    y = bby + 120;
  }
  if (T.call && T.call.t > 0) { // big callouts
    const a = Math.min(1, T.call.t / 30, (T.call.d - T.call.t + 6) / 12);
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    txt(ctx, T.call.txt, w / 2, h * 0.32, 40, T.call.col || '#fff', 'center', 8);
    if (T.call.sub) txt(ctx, T.call.sub, w / 2, h * 0.32 + 30, 18, '#fff', 'center', 4);
    ctx.restore();
  }
  void time;
  return y;
}

// ------------------------------------------------------------------ minimap (the chain of chambers)
export function drawTombMinimap(ctx, x, y, R, sim, p, CLASSES) {
  const T = tombState(sim);
  circle(ctx, x, y, R + 5, INK, 0);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
  ctx.fillStyle = '#1a1028'; ctx.fillRect(x - R, y - R, R * 2, R * 2);
  const cy = (TOMB_ROOMS[0].y + TOMB_ROOMS[3].y) / 2, k = (R * 2 - 16) / 4800, X = (wx) => x + (wx - TOMB_X) * k, Y = (wy) => y + (wy - cy) * k;
  ctx.beginPath(); ctx.moveTo(X(TOMB_X), Y(TOMB_ROOMS[0].y)); ctx.lineTo(X(TOMB_X), Y(TOMB_ROOMS[3].y)); ctx.strokeStyle = 'rgba(255,207,74,.4)'; ctx.lineWidth = 3; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
  TOMB_ROOMS.forEach((Rm, i) => { const cur = T && (T.st === 'boss' || T.b ? 3 : T.room) === i; circle(ctx, X(Rm.x), Y(Rm.y), Rm.r * k, cur ? '#d9b77a' : (T && i < (T.b ? 3 : T.room) ? '#7a6a52' : '#4a3b5e'), 2, cur ? '#ffcf4a' : INK); if (i === 3) { ctx.font = `bold 11px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffcf4a'; ctx.fillText('☀', X(Rm.x), Y(Rm.y) + 4); } });
  for (const e of sim.enemies) { if (!inTombArea(e.x, e.y)) continue; ctx.fillStyle = e.boss ? '#ff5e5b' : e.elite ? '#ffcf3a' : '#ff4d4d'; ctx.fillRect(X(e.x) - 1.5, Y(e.y) - 1.5, 3, 3); }
  if (sim.players) for (const q of sim.players.values()) if (q.id !== p.id && !q.dead) circle(ctx, X(q.x), Y(q.y), 3, CLASSES[q.cls] ? CLASSES[q.cls].color : '#fff', 1.2);
  circle(ctx, X(p.x), Y(p.y), 3.5, '#fff', 1.6);
  ctx.restore();
  circle(ctx, x, y, R + 3, null, 5, INK); circle(ctx, x, y, R, null, 2, 'rgba(255,255,255,.35)');
}

// ------------------------------------------------------------------ events
export function tombEventFx(fx, ev, me) {
  switch (ev.ph) {
    case 'start': fx.banner(TOMB_NAME.toUpperCase(), '#ffcf4a', 'Three chambers of the sun-eaten dead, then the King', 3, 42); break;
    case 'room': fx.banner(`CHAMBER ${ev.room + 1}`, '#ffe9a0', ROOM_SUB[ev.room] || '', 2.2, 40); break;
    case 'wave': for (const [x, y, el] of ev.pts || []) { fx.puffs(x, y, 8, '#e2b775', 14, 140, 0.7); if (el) fx.ring(x, y, 46, '#ffcf3a', 0.5, 5); } fx.banner(`WAVE ${ev.wave}/${ev.nw}`, '#ffcf4a', '', 1.4, 32); break;
    case 'roomClear': fx.banner('CHAMBER CLEARED', '#7dffb0', ev.chest ? 'Challenge done: the bonus chest is yours!' : 'The sun-door opens', 2.4, 40); fx.ring(ev.x, ev.y, 300, '#ffcf4a', 0.8, 8); break;
    case 'chest': fx.ring(ev.x, ev.y, 80, '#ffcf4a', 0.6, 8); fx.sparks(ev.x, ev.y, -Math.PI / 2, 26, '#fff3b0', 420, 1.8); fx.shake(0.2); break;
    case 'chal': if (me) fx.text(ev.x, ev.y - 50, `CHAIN ${ev.n}/${ev.need}`, { size: 18, color: '#ffcf4a', vy: -40, pop: 1, life: 0.9 }); break;
    case 'chalDone': fx.banner('CHALLENGE COMPLETE', '#7dffb0', 'Clear the chamber to open the bonus chest', 2.2, 36); break;
    case 'bossPull': fx.banner('NEFERAKH STIRS', '#ffcf4a', 'The King who swallowed the sun', 3, 46); fx.shake(0.3); break;
    case 'bossStart': fx.flashColor = '#ffe9a0'; fx.flash = 0.5; fx.shake(0.5); fx.ring(ev.x, ev.y, 400, '#ffcf4a', 0.9, 14); break;
    case 'flip': { const sun = ev.light === 'sun', tw = ev.light === 'twilight'; fx.flashColor = sun ? '#fff3b0' : tw ? '#ff9ad0' : '#2a1050'; fx.flash = 0.6; fx.shake(0.4); fx.ring(ev.x, ev.y, 560, sun ? '#ffcf4a' : tw ? '#ff7ab8' : '#8a5cff', 0.9, 18); fx.banner(sun ? 'HIGH SUN' : tw ? 'TWILIGHT DIVIDE' : 'NIGHT FALLS', sun ? '#ffcf4a' : tw ? '#ff7ab8' : '#b69cff', sun ? 'He burns bright: full damage' : tw ? 'Only the lit half can hurt him' : 'Light the braziers: he is shrouded in the dark', 2, 44); break; }
    case 'boom': {
      const c = ev.col === 'dark' ? '#8a5cff' : '#ffcf4a';
      if (ev.sh === 'circle') { fx.ring(ev.x, ev.y, ev.r, c, 0.45, 10); fx.puffs(ev.x, ev.y, 10, c, 16, 200, 0.6); fx.sparks(ev.x, ev.y, 0, 14, ev.col === 'dark' ? '#c9a8ff' : '#fff3b0', 360, TAU); }
      else if (ev.sh === 'rect') { const c2 = Math.cos(ev.ang), s2 = Math.sin(ev.ang); for (let i = -4; i <= 4; i++) fx.sparks(ev.x + c2 * i * ev.len / 9, ev.y + s2 * i * ev.len / 9, ev.ang + Math.PI / 2, 3, c, 260, 0.8); fx.shake(0.25); }
      else { fx.flashColor = ev.col === 'dark' ? '#3a1870' : '#fff6c8'; fx.flash = 0.7; fx.shake(0.6); }
      break;
    }
    case 'cast': if (ev.k === 'flare') fx.banner('NOON FLARE', '#ffcf4a', 'Hide in the obelisks\' shade!', 1.8, 40); else if (ev.k === 'twilight') fx.banner('TWILIGHT DIVIDE', '#ff7ab8', 'Leave the burning half, then the dark half', 1.8, 36); else if (ev.k === 'umbral') fx.text(ev.x, ev.y - 90, 'UMBRAL MIRAGE', { size: 20, color: '#b69cff', vy: -30, life: 1 }); break;
    case 'brazier': fx.ring(ev.x, ev.y, 200, '#ffb347', 0.7, 10); fx.sparks(ev.x, ev.y - 20, -Math.PI / 2, 20, '#ffd23f', 380, 1.4); fx.text(ev.x, ev.y - 60, 'LIT!', { size: 22, color: '#ffcf4a', vy: -40, pop: 1, life: 0.9 }); break;
    case 'phase': fx.shake(0.5); fx.ring(ev.x, ev.y, 300, '#ff7ab8', 0.7, 12); fx.banner(ev.phase === 3 ? 'THE SUN-EATER UNBOUND' : 'THE KING RISES', '#ff7ab8', ev.phase === 3 ? 'Twilight joins the cycle' : 'Faster cycles, umbral mirages', 2.4, 42); break;
    case 'enrage': fx.banner('ENDLESS NIGHT', '#ff3b3b', 'Finish him!', 2.4, 46); fx.shake(0.5); break;
    case 'hit': if (me) fx.text(ev.x, ev.y - 40, String(ev.what || 'Hit').toUpperCase(), { size: 16, color: '#ff9a8a', vy: -30, life: 0.8 }); break;
    case 'mend': fx.ring(ev.x, ev.y, 60, '#7dffb0', 0.5, 6); break;
    case 'wipe': fx.banner('THE SUN SETS ON YOU', '#ff5e5b', 'Neferakh resets: try again', 2.6, 42, 'defeat'); break;
    case 'victory': fx.flashColor = '#fff3b0'; fx.flash = 0.8; fx.shake(0.7); fx.ring(ev.x, ev.y, 600, '#ffcf4a', 1.2, 20); fx.banner('THE SUN-EATER FALLS', '#ffcf4a', `Tomb cleared in ${ev.t || '?'}s · walk south to leave`, 4, 50, 'victory'); break;
    case 'end': break;
  }
}
