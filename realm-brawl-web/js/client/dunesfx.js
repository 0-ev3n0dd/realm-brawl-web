// Sunscorch Dunes art (Phase 1 of the world plan): the desert disc (danger-ring sand, dune swells, ripples, per-zone
// decals, the Oasis of Ra, Khepra's sunken arena), its props, the Dunes enemies + Khepra, sand / sun bullets, Tomb
// portals, Solar Glyphs, the Realm Gate plaza in Brightwater Village, the Dunes minimap and the Dunes event FX.
// Same code-drawn style as art.js, drawn in a more detailed pass: every solid shape gets a light-to-shade gradient
// (light from the upper left), a rim light on the lit edge, a tidy ink outline, texture strokes and small decals.
import { INK, circle, ellipse, shadow, rrect, shade, star, ENEMY_DRAW } from './art.js';
import { bloom } from './fxglow.js';
import { DUNES_POS as DP, DUNES_R, DUNES_ZONES, OVERLORD_POS as OP, OVERLORD_R, DUNES_SPAWN, GATES, GATE_R, inDunesArea, dunesZoneAt } from '../sim/dunesconst.js';
import { TOWN_POS as TP } from '../sim/townconst.js';
import { packDunes, PORTAL } from '../sim/dunes.js';
import { DUNES_SHAPE, DUNES_RINGS, DUNES_ROADS, dunesSite } from '../sim/mapshape.js';
import { shapePath, roadPath } from './wildsfx.js';
import { sprite, blit } from './sprite.js';
import { wpOn, wpTile, wpPattern, wpDecal, wpHas, wpProp, wpPiece, dunesPropArt, drawPaintedProp } from './worldpaint.js';

const TAU = Math.PI * 2;
const LA = -2.3; // world light direction (upper left)
const FONT = "'Lilita One', sans-serif";
const H = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const dunesVisible = (view) => view.x1 > DP.x - DBB && view.x0 < DP.x + DBB && view.y1 > DP.y - DBB && view.y0 < DP.y + DBB;
export const DUNES_DANGER_COL = { 3: '#ffd23f', 4: '#ffa53a', 5: '#ff6a3c', 6: '#ff3b5c' };

// ------------------------------------------------------------------ shared detailed-style kit
/** Linear light->shade gradient across a shape of radius r centred on (x, y), lit from angle la. */
export function lgrad(ctx, x, y, r, base, la = LA, hi = 0.32, lo = -0.36) {
  const c = Math.cos(la) * r, s = Math.sin(la) * r, g = ctx.createLinearGradient(x + c, y + s, x - c, y - s);
  g.addColorStop(0, shade(base, hi)); g.addColorStop(0.5, base); g.addColorStop(1, shade(base, lo)); return g;
}
export function rimArc(ctx, x, y, r, la = LA, col = 'rgba(255,248,222,.72)', w = 2.4, span = 0.95) {
  if (r <= 0) return;
  ctx.beginPath(); ctx.arc(x, y, r, la - span, la + span); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
}
export function ink(ctx, w = 3) { ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = w; ctx.strokeStyle = INK; ctx.stroke(); }
/** A shaded ball: gradient fill, ink outline, rim light. */
export function ball(ctx, x, y, r, base, la = LA, lw = 3, rim = 0.6) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = lgrad(ctx, x, y, r, base, la); ctx.fill();
  if (lw) ink(ctx, lw);
  if (rim) rimArc(ctx, x, y, r - lw * 0.6 - 1.4, la, `rgba(255,250,228,${rim})`, Math.max(1.4, r * 0.09), 0.85);
}
export function oval(ctx, x, y, rx, ry, base, la = LA, lw = 3, rot = 0, rim = 0.55) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fillStyle = lgrad(ctx, x, y, Math.max(rx, ry), base, la); ctx.fill();
  if (lw) ink(ctx, lw);
  if (rim) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(1, rx - lw * 0.6 - 1.5), Math.max(1, ry - lw * 0.6 - 1.5), rot, la - rot - 0.85, la - rot + 0.85); ctx.strokeStyle = `rgba(255,250,228,${rim})`; ctx.lineWidth = Math.max(1.4, Math.min(rx, ry) * 0.12); ctx.lineCap = 'round'; ctx.stroke(); }
}
export function poly(ctx, pts, ox = 0, oy = 0) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x, oy + y) : ctx.moveTo(ox + x, oy + y))); ctx.closePath(); }
/** Rim-light the lit side of a closed polygon (clip to the half facing the light, stroke an inset copy). */
export function rimPoly(ctx, pts, ox, oy, k = 0.9, col = 'rgba(255,246,214,.7)', w = 2.6) {
  ctx.save();
  const c = Math.cos(LA), s = Math.sin(LA), F = 4000;
  ctx.beginPath(); ctx.moveTo(ox - s * F, oy + c * F); ctx.lineTo(ox + c * F - s * F, oy + s * F + c * F); ctx.lineTo(ox + c * F + s * F, oy + s * F - c * F); ctx.lineTo(ox + s * F, oy - c * F); ctx.closePath(); ctx.clip();
  poly(ctx, pts.map(([x, y]) => [x * k, y * k]), ox, oy); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
}
export const lightLocal = (e) => LA - (e.face || 0); // the light direction inside a face-rotated enemy draw
/** Tiny carved hieroglyphs: eye, ankh, bird, water. */
export function glyph(ctx, x, y, k, s, col = 'rgba(70,40,20,.7)') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = col; ctx.lineWidth = 1.4 / s; ctx.lineCap = 'round'; ctx.beginPath();
  switch (((k % 4) + 4) % 4) {
    case 0: ctx.ellipse(0, 0, 4, 2, 0, 0, TAU); ctx.moveTo(0, 2); ctx.lineTo(-1, 5); ctx.moveTo(1, 2); ctx.quadraticCurveTo(3, 5, 5, 4); break;
    case 1: ctx.ellipse(0, -3, 2, 2.5, 0, 0, TAU); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.moveTo(0, -0.5); ctx.lineTo(0, 6); break;
    case 2: ctx.moveTo(-4, 3); ctx.quadraticCurveTo(-1, -3, 2, -2); ctx.lineTo(4, -4); ctx.moveTo(-1, 2); ctx.lineTo(-1, 5); ctx.moveTo(1, 2); ctx.lineTo(1, 5); break;
    default: ctx.moveTo(-5, 0); for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(-4 + i * 2.5, -2.5 * (i % 2 ? -1 : 1), -2.5 + i * 2.5, 0);
  }
  ctx.stroke(); ctx.restore();
}

// ------------------------------------------------------------------ ground
export const SAND_STOPS = [[0, '#f8eabd'], [0.16, '#f5dfa6'], [0.405, '#efd393'], [0.415, '#ebc685'], [0.622, '#e2b775'], [0.632, '#ddad69'], [0.818, '#d49d5d'], [0.828, '#ca8a50'], [1, '#a96b3d']];
const DS = DUNES_SHAPE, DBB = DS.max + 260;
const DSITE = { ankhara: dunesSite('ankhara'), sekhem: dunesSite('sekhem'), crater: dunesSite('crater'), sphinx: dunesSite('sphinx'), colossus: dunesSite('colossus') };
const nearSite = (x, y, pad) => Math.hypot(x - OP.x, y - OP.y) < OVERLORD_R + pad || Math.hypot(x - DSITE.ankhara.x, y - DSITE.ankhara.y) < DSITE.ankhara.r + pad || Math.hypot(x - DSITE.sekhem.x, y - DSITE.sekhem.y) < DSITE.sekhem.r + pad;
let DROADS = null;
/** Static Dunes ground (baked into the ground tile cache): organic coast, danger bands, swells, ripples, decals, roads, oasis, arenas. */
export function paintDunesStatic(ctx, view) {
  if (!dunesVisible(view)) return false;
  if (wpOn() && dunesPaintedReady()) return paintDunesPainted(ctx, view);
  ctx.fillStyle = 'rgba(160,230,255,.32)'; ctx.fill(shapePath(DS, DUNES_R, 86), 'evenodd');
  ctx.fillStyle = '#d6b77b'; ctx.fill(shapePath(DS, DUNES_R, DS.shore), 'evenodd');
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.stroke(shapePath(DS, DUNES_R, DS.shore));
  // danger regions (pass 2: an irregular field of basins / gorges / spurs, not rings), clipped to the coast
  ctx.save(); ctx.clip(shapePath(DS, DUNES_R, 8), 'evenodd');
  const rings = DUNES_RINGS, cols = SAND_BANDS;
  ctx.fillStyle = cols[rings.length - 1]; ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  for (let i = rings.length - 2; i >= 1; i--) { ctx.fillStyle = cols[i]; ctx.fill(shapePath(DS, rings[i], 0), 'evenodd'); }
  ctx.fillStyle = cols[0]; ctx.fill(shapePath(DS, rings[1] * 0.75, 0), 'evenodd');
  // soft seams: a light lip on the inside of each band border, a dark one outside
  for (let i = 1; i < rings.length - 1; i++) { ctx.lineWidth = 34; ctx.strokeStyle = 'rgba(255,240,200,.16)'; ctx.stroke(shapePath(DS, rings[i] - 18, 0)); ctx.strokeStyle = 'rgba(110,60,25,.10)'; ctx.stroke(shapePath(DS, rings[i] + 18, 0)); }
  ctx.strokeStyle = 'rgba(80,40,10,.045)'; ctx.lineWidth = 3; ctx.beginPath();
  const G = 110;
  for (let x = Math.floor(view.x0 / G) * G; x < view.x1; x += G) { ctx.moveTo(x, view.y0); ctx.lineTo(x, view.y1); }
  for (let y = Math.floor(view.y0 / G) * G; y < view.y1; y += G) { ctx.moveTo(view.x0, y); ctx.lineTo(view.x1, y); }
  ctx.stroke();
  // caravan roads (packed sand + wheel ruts + stone markers)
  if (!DROADS) DROADS = DUNES_ROADS.map(roadPath);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const p of DROADS) { ctx.strokeStyle = 'rgba(120,70,30,.20)'; ctx.lineWidth = 92; ctx.stroke(p); ctx.strokeStyle = '#e9c98e'; ctx.lineWidth = 74; ctx.stroke(p); ctx.strokeStyle = 'rgba(255,245,215,.35)'; ctx.lineWidth = 40; ctx.stroke(p); ctx.setLineDash([16, 22]); ctx.strokeStyle = 'rgba(120,75,35,.28)'; ctx.lineWidth = 3; ctx.save(); ctx.translate(-16, 0); ctx.stroke(p); ctx.translate(32, 0); ctx.stroke(p); ctx.restore(); ctx.setLineDash([]); }
  duneSwells(ctx, view);
  ripples(ctx, view);
  zoneDecals(ctx, view, 0);
  ctx.restore();
  for (let i = 1; i < rings.length - 1; i++) {
    const p = shapePath(DS, rings[i], 0);
    ctx.strokeStyle = 'rgba(70,35,15,.22)'; ctx.lineWidth = 11; ctx.stroke(p);
    ctx.setLineDash([26, 20]); ctx.strokeStyle = i === 1 ? 'rgba(255,255,255,.75)' : 'rgba(255,236,190,.5)'; ctx.lineWidth = 4; ctx.stroke(p); ctx.setLineDash([]);
  }
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(90,50,20,.35)'; ctx.stroke(shapePath(DS, DUNES_R, 10));
  const near = (P, r) => view.y0 < P.y + r && view.y1 > P.y - r && view.x0 < P.x + r && view.x1 > P.x - r;
  if (near(OP, OVERLORD_R + 140)) overlordArena(ctx, 0, true);
  if (near(DP, 330)) oasis(ctx, 0);
  if (near(DSITE.ankhara, DSITE.ankhara.r + 120)) glassArena(ctx, DSITE.ankhara);
  if (near(DSITE.sekhem, DSITE.sekhem.r + 120)) sunArena(ctx, DSITE.sekhem);
  if (near(DSITE.crater, DSITE.crater.r + 120)) craterFloor(ctx, DSITE.crater);
  return true;
}
// ------------------------------------------------------------------ painted world (Art style = Painted)
const D_TILES = ['T6', 'T6', 'T7', 'T8', 'T9'];
function dunesPaintedReady() { let ok = true; for (const t of ['T6', 'T7', 'T8', 'T9', 'T5']) if (!wpTile(t)) ok = false; return ok && wpHas('d_khepra', 'd_oasis', 'd_ankhara', 'd_sekhem', 'd_crater', 'd_scorch'); }
function paintDunesPainted(ctx, view) {
  ctx.fillStyle = 'rgba(160,230,255,.32)'; ctx.fill(shapePath(DS, DUNES_R, 86), 'evenodd');
  ctx.fillStyle = '#d6b77b'; ctx.fill(shapePath(DS, DUNES_R, DS.shore), 'evenodd');
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.stroke(shapePath(DS, DUNES_R, DS.shore));
  ctx.save(); ctx.clip(shapePath(DS, DUNES_R, 8), 'evenodd');
  const rings = DUNES_RINGS, P = (i) => wpPattern(ctx, D_TILES[i], 460);
  ctx.fillStyle = P(rings.length - 1); ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  for (let i = rings.length - 2; i >= 1; i--) { ctx.fillStyle = P(i); ctx.fill(shapePath(DS, rings[i], 0), 'evenodd'); }
  for (let i = 1; i < rings.length - 1; i++) {
    const p = shapePath(DS, rings[i], 0);
    ctx.globalAlpha = 0.45; ctx.lineWidth = 130; ctx.strokeStyle = P(i); ctx.stroke(p);
    ctx.globalAlpha = 0.35; ctx.lineWidth = 60; ctx.strokeStyle = P(i + 1); ctx.stroke(p); ctx.globalAlpha = 1;
  }
  const B = 320;
  for (let cx = Math.floor(view.x0 / B) - 1; cx <= Math.floor(view.x1 / B) + 1; cx++) for (let cy = Math.floor(view.y0 / B) - 1; cy <= Math.floor(view.y1 / B) + 1; cy++) {
    const h = H(cx * 5 + 1, cy * 13 - 7), x = cx * B + H(cx, cy + 4) * B, y = cy * B + H(cx + 6, cy) * B;
    ctx.fillStyle = h < 0.5 ? '#fff4d0' : '#5a3010'; ctx.globalAlpha = 0.05 + H(cx, cy) * 0.05;
    ctx.beginPath(); ctx.ellipse(x, y, 130 + h * 150, 60 + H(cy, cx) * 70, -0.2 + H(cx + 3, cy) * 0.4, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (!DROADS) DROADS = DUNES_ROADS.map(roadPath);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const p of DROADS) { ctx.strokeStyle = 'rgba(120,70,30,.20)'; ctx.lineWidth = 92; ctx.stroke(p); ctx.strokeStyle = wpPattern(ctx, 'T5', 300); ctx.globalAlpha = 0.85; ctx.lineWidth = 72; ctx.stroke(p); ctx.globalAlpha = 1; }
  ctx.restore();
  for (let i = 1; i < rings.length - 1; i++) { ctx.setLineDash([26, 20]); ctx.strokeStyle = i === 1 ? 'rgba(255,255,255,.5)' : 'rgba(255,236,190,.35)'; ctx.lineWidth = 4; ctx.stroke(shapePath(DS, rings[i], 0)); ctx.setLineDash([]); }
  const near = (Q, r) => view.y0 < Q.y + r && view.y1 > Q.y - r && view.x0 < Q.x + r && view.x1 > Q.x - r;
  const dec = (name, Q, d) => { if (near(Q, d / 2 + 20)) wpDecal(ctx, name, Q.x, Q.y, d); };
  dec('d_oasis', DP, 640);
  dec('d_khepra', OP, (OVERLORD_R + 70) * 2);
  dec('d_ankhara', DSITE.ankhara, (DSITE.ankhara.r + 60) * 2);
  dec('d_sekhem', DSITE.sekhem, (DSITE.sekhem.r + 60) * 2);
  dec('d_crater', DSITE.crater, (DSITE.crater.r + 90) * 2);
  dec('d_scorch', DSITE.colossus, 460);
  return true;
}
const SAND_BANDS = ['#f8eabd', '#f2dba0', '#e8c787', '#dcae6b', '#c99158'];
/** Animated Dunes bits drawn every frame over the cached tiles (cheap): Khepra's danger rim, oasis ripples, arena rims. */
export function drawDunesLive(ctx, view, t) {
  if (!dunesVisible(view)) return false;
  const near = (P, r) => view.y0 < P.y + r && view.y1 > P.y - r && view.x0 < P.x + r && view.x1 > P.x - r;
  if (near(OP, OVERLORD_R + 40)) { ctx.beginPath(); ctx.arc(OP.x, OP.y, OVERLORD_R - 10, 0, TAU); ctx.setLineDash([18, 14]); ctx.lineDashOffset = -t * 20; ctx.strokeStyle = `rgba(255,96,50,${0.45 + 0.2 * Math.sin(t * 3)})`; ctx.lineWidth = 6; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; }
  for (const [P, col] of [[DSITE.ankhara, '120,240,230'], [DSITE.sekhem, '255,190,60']]) if (near(P, P.r + 40)) { ctx.beginPath(); ctx.arc(P.x, P.y, P.r - 8, 0, TAU); ctx.setLineDash([20, 16]); ctx.lineDashOffset = t * 18; ctx.strokeStyle = `rgba(${col},${0.4 + 0.2 * Math.sin(t * 2.4)})`; ctx.lineWidth = 5; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; }
  if (near(DP, 170)) {
    ctx.save(); ctx.beginPath(); ctx.ellipse(DP.x, DP.y, 150, 105, 0, 0, TAU); ctx.clip();
    for (let k = 0; k < 2; k++) { const ph = (t * 0.35 + k * 0.5) % 1, rr = 20 + ph * 70; ctx.beginPath(); ctx.ellipse(DP.x + 30, DP.y + 10, rr, rr * 0.66, 0, 0, TAU); ctx.strokeStyle = `rgba(255,255,255,${0.4 * (1 - ph)})`; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
  }
  return true;
}
/** Legacy single-call path (no tile cache): static paint + live overlays. */
export function drawDunesGround(ctx, view, t) { if (!paintDunesStatic(ctx, view)) return false; drawDunesLive(ctx, view, t); return true; }
function glassArena(ctx, P) {
  const g = ctx.createRadialGradient(P.x, P.y, 20, P.x, P.y, P.r + 20); g.addColorStop(0, '#9fd8cf'); g.addColorStop(0.6, '#c9d9b0'); g.addColorStop(1, 'rgba(230,205,150,0)');
  ctx.beginPath(); ctx.arc(P.x, P.y, P.r + 20, 0, TAU); ctx.fillStyle = g; ctx.fill();
  for (let i = 0; i < 22; i++) { const a = H(i, 51) * TAU, r = P.r * Math.sqrt(H(52, i)) * 0.9; glassPatch(ctx, P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, i * 7, 0); }
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.2; ctx.beginPath(); ctx.moveTo(P.x + Math.cos(a) * 40, P.y + Math.sin(a) * 40); ctx.lineTo(P.x + Math.cos(a + 0.15) * P.r * 0.6, P.y + Math.sin(a + 0.15) * P.r * 0.6); ctx.lineTo(P.x + Math.cos(a - 0.05) * P.r * 0.95, P.y + Math.sin(a - 0.05) * P.r * 0.95); ctx.strokeStyle = 'rgba(40,110,110,.45)'; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = 'rgba(230,255,250,.5)'; ctx.lineWidth = 1.2; ctx.stroke(); }
  circle(ctx, P.x, P.y, P.r, null, 5, INK);
}
function sunArena(ctx, P) {
  circle(ctx, P.x, P.y, P.r + 18, '#e9c587', 0);
  const g = ctx.createRadialGradient(P.x, P.y, 10, P.x, P.y, P.r); g.addColorStop(0, '#f4d89a'); g.addColorStop(1, '#c79a5e');
  ctx.beginPath(); ctx.arc(P.x, P.y, P.r, 0, TAU); ctx.fillStyle = g; ctx.fill();
  // a great sundial: paved rings, 12 hour wedges, carved glyphs, the gnomon disc
  for (const r of [P.r * 0.92, P.r * 0.62, P.r * 0.3]) { ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, TAU); ctx.strokeStyle = 'rgba(90,55,25,.4)'; ctx.lineWidth = 5; ctx.stroke(); ctx.beginPath(); ctx.arc(P.x - 1, P.y - 2, r, LA - 0.9, LA + 0.9); ctx.strokeStyle = 'rgba(255,245,215,.5)'; ctx.lineWidth = 2; ctx.stroke(); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.beginPath(); ctx.moveTo(P.x + Math.cos(a) * P.r * 0.3, P.y + Math.sin(a) * P.r * 0.3); ctx.lineTo(P.x + Math.cos(a) * P.r * 0.92, P.y + Math.sin(a) * P.r * 0.92); ctx.strokeStyle = 'rgba(90,55,25,.35)'; ctx.lineWidth = 3; ctx.stroke(); glyph(ctx, P.x + Math.cos(a + 0.26) * P.r * 0.77, P.y + Math.sin(a + 0.26) * P.r * 0.77, i, 2.2); }
  ball(ctx, P.x, P.y, P.r * 0.22, '#ffcf5a', LA, 4, 0.7);
  star(ctx, P.x, P.y, P.r * 0.12, '#fff3c0', 2);
  circle(ctx, P.x, P.y, P.r, null, 5, INK);
}
function craterFloor(ctx, P) {
  const g = ctx.createRadialGradient(P.x - 20, P.y - 20, 10, P.x, P.y, P.r + 40); g.addColorStop(0, '#6b4a34'); g.addColorStop(0.55, '#8d6440'); g.addColorStop(0.85, '#c79a62'); g.addColorStop(1, 'rgba(220,180,120,0)');
  ctx.beginPath(); ctx.arc(P.x, P.y, P.r + 40, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.arc(P.x, P.y, P.r, Math.PI * 0.15, Math.PI * 0.95); ctx.strokeStyle = 'rgba(255,230,180,.5)'; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.arc(P.x, P.y, P.r, Math.PI * 1.1, Math.PI * 1.9); ctx.strokeStyle = 'rgba(50,25,10,.45)'; ctx.lineWidth = 6; ctx.stroke();
  for (let i = 0; i < 14; i++) { const a = H(i, 81) * TAU, r = P.r * 0.8 * Math.sqrt(H(82, i)); glassPatch(ctx, P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, i * 13, 0); }
}
function zoneOfD(d) { for (const z of DUNES_ZONES) if (d < z.r1) return z; return DUNES_ZONES[DUNES_ZONES.length - 1]; }
const reD = (x, y) => (DS.inside(x, y, -70) ? DS.re(x, y) : 1e9); // (off the land counts as 'past the rim')
function duneSwells(ctx, view) {
  const C = 240;
  for (let cx = Math.floor(view.x0 / C); cx <= Math.floor(view.x1 / C); cx++) for (let cy = Math.floor(view.y0 / C); cy <= Math.floor(view.y1 / C); cy++) {
    const h = H(cx * 3 + 11, cy * 5 + 7); if (h > 0.58) continue;
    const x = cx * C + H(cx + 3, cy) * C, y = cy * C + H(cx, cy + 5) * C, d = reD(x, y);
    if (d > DUNES_R - 70 || Math.hypot(x - DP.x, y - DP.y) < 310 || nearSite(x, y, 60)) continue;
    const L = 58 + h * 110, hg = 12 + h * 20, a = 0.32 + (H(cx, cy + 9) - 0.5) * 0.5;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(-L, 0); ctx.quadraticCurveTo(0, -hg * 2.1, L, 0); ctx.quadraticCurveTo(0, -hg * 0.5, -L, 0); ctx.fillStyle = 'rgba(255,248,226,.24)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-L, 0); ctx.quadraticCurveTo(0, -hg * 2.1, L, 0); ctx.quadraticCurveTo(L * 0.2, hg * 1.1, -L, 0); ctx.fillStyle = 'rgba(122,70,28,.14)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-L * 0.92, -hg * 0.12); ctx.quadraticCurveTo(0, -hg * 2.0, L * 0.92, -hg * 0.12); ctx.strokeStyle = 'rgba(255,251,232,.6)'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-L * 0.6, hg * 0.25); ctx.quadraticCurveTo(0, -hg * 0.35, L * 0.55, hg * 0.3); ctx.strokeStyle = 'rgba(122,70,28,.16)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
}
function ripples(ctx, view) {
  const C = 64, dark = new Path2D(), lite = new Path2D();
  for (let cx = Math.floor(view.x0 / C); cx <= Math.floor(view.x1 / C); cx++) for (let cy = Math.floor(view.y0 / C); cy <= Math.floor(view.y1 / C); cy++) {
    const h = H(cx + 101, cy - 33); if (h > 0.55) continue;
    const x = cx * C + H(cx, cy + 1) * C, y = cy * C + H(cx + 2, cy) * C, d = reD(x, y);
    if (d > DUNES_R - 20 || Math.hypot(x - DP.x, y - DP.y) < 285) continue;
    const w = 10 + h * 12, n = 2 + ((h * 10) | 0) % 2;
    for (let i = 0; i < n; i++) { const oy = (i - (n - 1) / 2) * 7; dark.moveTo(x - w, y + oy + 1.8); dark.quadraticCurveTo(x, y + oy - 4, x + w, y + oy + 1.8); lite.moveTo(x - w, y + oy); lite.quadraticCurveTo(x, y + oy - 5.5, x + w, y + oy); }
  }
  ctx.lineCap = 'round'; ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(128,78,34,.2)'; ctx.stroke(dark);
  ctx.strokeStyle = 'rgba(255,248,222,.42)'; ctx.stroke(lite);
}
function zoneDecals(ctx, view, t) {
  const C = 92;
  for (let cx = Math.floor(view.x0 / C); cx <= Math.floor(view.x1 / C); cx++) for (let cy = Math.floor(view.y0 / C); cy <= Math.floor(view.y1 / C); cy++) {
    const h = H(cx - 71, cy + 59); if (h > 0.34) continue;
    const x = cx * C + H(cx + 9, cy) * C, y = cy * C + H(cx, cy + 13) * C, d = reD(x, y);
    if (d > DUNES_R - 30 || Math.hypot(x - DP.x, y - DP.y) < 300 || nearSite(x, y, 30)) continue;
    const z = zoneOfD(d).danger, k = h / 0.34, v = (cx * 31 + cy * 17) & 1023;
    if (z === 3) { if (k < 0.3) glassPatch(ctx, x, y, v, t); else beads(ctx, x, y, v); }
    else if (z === 4) { if (k < 0.3) burrowHole(ctx, x, y, v); else if (k < 0.65) tracks(ctx, x, y, v); else pebbles(ctx, x, y, v, '#b48858'); }
    else if (z === 5) { if (k < 0.35) miragePool(ctx, x, y, v, t); else if (k < 0.62) buriedDrum(ctx, x, y, v); else dryTuft(ctx, x, y, v); }
    else { if (k < 0.42) hardpan(ctx, x, y, v, t); else if (k < 0.66) ribs(ctx, x, y, v); else pebbles(ctx, x, y, v, '#7a5236'); }
  }
}
function beads(ctx, x, y, v) {
  const cols = ['#c9fbff', '#8fe6e6', '#ffe9a8', '#ffffff', '#9fd4ff'];
  for (let i = 0; i < 6; i++) { const bx = x + (H(v, i) - 0.5) * 34, by = y + (H(i, v) - 0.5) * 22, r = 1.8 + H(v + i, 3) * 2.2; circle(ctx, bx, by, r, cols[(v + i) % 5], 1.2, 'rgba(43,36,51,.45)'); circle(ctx, bx - r * 0.35, by - r * 0.35, r * 0.35, '#fff', 0); }
}
function glassPatch(ctx, x, y, v, t) {
  const pts = []; for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, r = 12 + H(v, i) * 12; pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.6]); }
  poly(ctx, pts, x, y); ctx.fillStyle = 'rgba(120,226,220,.38)'; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(40,110,110,.45)'; ctx.stroke();
  poly(ctx, pts.map(([a, b]) => [a * 0.55, b * 0.55]), x - 2, y - 2); ctx.fillStyle = 'rgba(220,255,250,.35)'; ctx.fill();
  const gl = 0.5 + 0.5 * Math.sin(t * 2.2 + v); ctx.globalAlpha = 0.35 + 0.5 * gl;
  ctx.beginPath(); ctx.moveTo(x - 8, y - 2); ctx.lineTo(x + 4, y - 6); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
  star(ctx, x + 6, y - 6, 3.2 * gl + 1, '#ffffff', 0); ctx.globalAlpha = 1;
}
function burrowHole(ctx, x, y, v) {
  ellipse(ctx, x + 2, y - 3, 17, 9, '#f3d9a2', 0);
  ellipse(ctx, x, y, 12, 6.5, '#5a3a1e', 2); ctx.beginPath(); ctx.ellipse(x, y + 1, 8, 3.8, 0, 0, TAU); ctx.fillStyle = '#2b1c10'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, y, 12, 6.5, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.strokeStyle = 'rgba(255,240,205,.7)'; ctx.lineWidth = 1.8; ctx.stroke();
  for (let i = 0; i < 3; i++) circle(ctx, x + (H(v, i) - 0.5) * 34, y + 6 + H(i, v) * 6, 1.6, '#a87a48', 0);
}
function tracks(ctx, x, y, v) {
  const a = H(v, 7) * TAU, c = Math.cos(a), s = Math.sin(a);
  ctx.fillStyle = 'rgba(110,66,30,.3)';
  for (let i = -4; i <= 4; i++) { const w = Math.sin(i * 0.8 + v) * 3, px = x + c * i * 8 - s * w, py = y + s * i * 8 + c * w; for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(px - s * side * 5, py + c * side * 5, 1.7, 0, TAU); ctx.fill(); } }
  ctx.beginPath(); ctx.moveTo(x - c * 34, y - s * 34); ctx.quadraticCurveTo(x + s * 4, y - c * 4, x + c * 34, y + s * 34); ctx.strokeStyle = 'rgba(110,66,30,.13)'; ctx.lineWidth = 2; ctx.stroke();
}
function pebbles(ctx, x, y, v, col) {
  for (let i = 0; i < 3; i++) { const px = x + (H(v, i + 4) - 0.5) * 26, py = y + (H(i + 4, v) - 0.5) * 16, r = 2.5 + H(v, i) * 3.5; ball(ctx, px, py, r, col, LA, 1.6, 0.5); }
}
function miragePool(ctx, x, y, v, t) {
  const a = 0.22 + 0.14 * Math.sin(t * 1.6 + v);
  ctx.save(); ctx.globalAlpha = Math.min(1, a * 2.2);
  const g = ctx.createRadialGradient(x, y, 2, x, y, 34); g.addColorStop(0, 'rgba(170,225,255,.9)'); g.addColorStop(0.7, 'rgba(150,210,255,.45)'); g.addColorStop(1, 'rgba(150,210,255,0)');
  ctx.beginPath(); ctx.ellipse(x, y, 34, 11, 0, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const yy = y - 4 + i * 4, o = Math.sin(t * 3 + i + v) * 5; ctx.beginPath(); ctx.moveTo(x - 18 + o, yy); ctx.lineTo(x - 4 + o, yy); ctx.moveTo(x + 3 - o, yy); ctx.lineTo(x + 15 - o, yy); ctx.stroke(); }
  ctx.restore();
}
function buriedDrum(ctx, x, y, v) {
  ellipse(ctx, x + 4, y + 6, 22, 9, 'rgba(120,70,30,.18)', 0);
  oval(ctx, x, y, 16, 10, '#d8c49a', LA, 2.4, 0, 0.5);
  ctx.strokeStyle = 'rgba(90,60,30,.35)'; ctx.lineWidth = 1.3;
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 9, y + Math.sin(a) * 5.5); ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 8.6); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(x + 8, y + 7, 14, 5, -0.2, 0, Math.PI); ctx.fillStyle = '#e2b775'; ctx.fill();
  if (v & 1) { ctx.beginPath(); ctx.moveTo(x - 5, y - 2); ctx.lineTo(x + 2, y + 1); ctx.lineTo(x - 1, y + 5); ctx.strokeStyle = 'rgba(60,40,20,.5)'; ctx.lineWidth = 1.4; ctx.stroke(); }
}
function dryTuft(ctx, x, y, v) {
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.28 + (H(v, i) - 0.5) * 0.2, L = 8 + H(i, v) * 8; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + 2, y + Math.sin(a) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.strokeStyle = i % 2 ? '#a67c45' : '#c79d5d'; ctx.lineWidth = 2; ctx.stroke(); }
}
function hardpan(ctx, x, y, v, t) {
  const glow = 0.4 + 0.3 * Math.sin(t * 2 + v);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = new Path2D();
  for (let i = 0; i < 5; i++) { let a = (i / 5) * TAU + H(v, i), px = x, py = y; path.moveTo(px, py); for (let j = 0; j < 3; j++) { a += (H(v + j, i) - 0.5) * 0.9; px += Math.cos(a) * (8 + H(i, j + v) * 9); py += Math.sin(a) * (6 + H(j, i + v) * 7); path.lineTo(px, py); } }
  ctx.strokeStyle = 'rgba(70,32,14,.55)'; ctx.lineWidth = 3; ctx.stroke(path);
  if (v % 3 === 0) { ctx.globalAlpha = glow; ctx.strokeStyle = '#ff8a3c'; ctx.lineWidth = 1.2; ctx.stroke(path); ctx.globalAlpha = 1; }
  ctx.save(); ctx.translate(-1, -1.5); ctx.strokeStyle = 'rgba(255,220,170,.25)'; ctx.lineWidth = 1; ctx.stroke(path); ctx.restore();
}
function ribs(ctx, x, y, v) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(H(v, 2) * TAU); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#f1e6cc'; ctx.lineWidth = 2.6; ctx.stroke();
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 8, 0); ctx.quadraticCurveTo(i * 8 + 6, -10, i * 8 + 2, -16); ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.stroke(); ctx.strokeStyle = '#efe3c6'; ctx.lineWidth = 2.2; ctx.stroke(); }
  ctx.restore();
}

/** The Oasis of Ra: grass, a paved rim, a deep pool with caustics, lilies, reeds and the arrival mosaic. */
function oasis(ctx, t) {
  const X = DP.x, Y = DP.y;
  circle(ctx, X, Y, 290, 'rgba(150,180,90,.35)', 0);
  const g = ctx.createRadialGradient(X, Y - 30, 30, X, Y, 272); g.addColorStop(0, '#93d466'); g.addColorStop(0.75, '#79bf55'); g.addColorStop(1, '#5f9f45');
  ctx.beginPath(); ctx.arc(X, Y, 272, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * TAU + H(i, 1) * 0.05, r = i % 3 === 0 ? 180 + H(i, 2) * 70 : 255 + H(i, 3) * 20, x = X + Math.cos(a) * r, y = Y + Math.sin(a) * r * 0.95;
    ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x - 3, y - 8); ctx.moveTo(x, y); ctx.lineTo(x, y - 11); ctx.moveTo(x + 5, y); ctx.lineTo(x + 3, y - 8);
    ctx.strokeStyle = i % 2 ? '#4f8f3a' : '#a6dd78'; ctx.lineWidth = 2.6; ctx.stroke();
  }
  for (let i = 0; i < 16; i++) { const a = H(i, 9) * TAU, r = 190 + H(i, 8) * 60; circle(ctx, X + Math.cos(a) * r, Y + Math.sin(a) * r, 3.6, ['#fff', '#ffe45c', '#ff8fb1', '#ffb35c'][i % 4], 1.6); }
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU, x = X + Math.cos(a) * 166, y = Y + Math.sin(a) * 120;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
    rrect(ctx, -15, -9, 30, 18, 5); ctx.fillStyle = lgrad(ctx, 0, 0, 16, i % 2 ? '#e3cfa1' : '#d4bb88', LA - a - Math.PI / 2); ctx.fill(); ink(ctx, 2.2);
    ctx.beginPath(); ctx.moveTo(-11, -5); ctx.lineTo(9, -5); ctx.strokeStyle = 'rgba(255,250,230,.6)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();
  }
  ctx.save(); ctx.beginPath(); ctx.ellipse(X, Y, 150, 105, 0, 0, TAU);
  const w = ctx.createRadialGradient(X - 20, Y - 15, 10, X, Y, 150); w.addColorStop(0, '#126a9e'); w.addColorStop(0.6, '#1f93c6'); w.addColorStop(1, '#5fd0ec');
  ctx.fillStyle = w; ctx.fill(); ctx.clip();
  ctx.strokeStyle = 'rgba(200,245,255,.28)'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) { const yy = Y - 90 + i * 22; ctx.beginPath(); for (let x = X - 150; x <= X + 150; x += 15) { const yv = yy + Math.sin(x * 0.05 + t * 1.6 + i) * 4; x === X - 150 ? ctx.moveTo(x, yv) : ctx.lineTo(x, yv); } ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(X - 50, Y - 48, 60, 14, -0.15, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(X, Y, 150, 105, 0, 0, TAU); ink(ctx, 3.5);
  ctx.beginPath(); ctx.ellipse(X, Y + 2, 146, 101, 0, 0.2, Math.PI - 0.2); ctx.strokeStyle = 'rgba(10,50,80,.35)'; ctx.lineWidth = 4; ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = H(i, 21) * TAU, r = 40 + H(i, 22) * 70, x = X + Math.cos(a) * r, y = Y + Math.sin(a) * r * 0.62, s = 9 + H(i, 23) * 5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, s, a + 0.4, a + TAU - 0.2); ctx.closePath(); ctx.fillStyle = lgrad(ctx, x, y, s, '#4cae4f'); ctx.fill(); ink(ctx, 2);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a + 2) * s * 0.8, y + Math.sin(a + 2) * s * 0.8); ctx.strokeStyle = 'rgba(220,255,200,.5)'; ctx.lineWidth = 1.3; ctx.stroke();
    if (i % 2 === 0) { for (let p = 0; p < 5; p++) { const pa = (p / 5) * TAU + t * 0.2; ellipse(ctx, x + Math.cos(pa) * 3.5, y + Math.sin(pa) * 3.5, 3.6, 2, '#ffb3d1', 1.2, pa); } circle(ctx, x, y, 2, '#ffe45c', 0); }
  }
  for (const [dx, dy] of [[-140, -30], [132, 34], [-60, 92], [90, -86]]) for (let i = 0; i < 5; i++) {
    const x = X + dx + (i - 2) * 6, y = Y + dy + (i % 2) * 4, sw = Math.sin(t * 1.5 + i + dx) * 2, top = y - 26 - (i % 3) * 4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sw, y - 14, x + sw * 2, top); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#6fae46'; ctx.lineWidth = 2; ctx.stroke();
    if (i % 2) ellipse(ctx, x + sw * 2, top - 2, 2.6, 6, '#7a4a26', 1.5);
  }
  const ax = DUNES_SPAWN.x, ay = DUNES_SPAWN.y + 44;
  circle(ctx, ax, ay, 40, '#e8d3a2', 3);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + t * 0.1; ctx.beginPath(); ctx.moveTo(ax + Math.cos(a - 0.12) * 16, ay + Math.sin(a - 0.12) * 16); ctx.lineTo(ax + Math.cos(a) * 35, ay + Math.sin(a) * 35); ctx.lineTo(ax + Math.cos(a + 0.12) * 16, ay + Math.sin(a + 0.12) * 16); ctx.closePath(); ctx.fillStyle = i % 2 ? '#2fb7a8' : '#ffcf4a'; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = INK; ctx.stroke(); }
  ball(ctx, ax, ay, 14, '#ffb43c', LA, 2.5);
  circle(ctx, ax, ay, 40, null, 2, 'rgba(255,255,255,.4)');
}

/** Khepra's arena: a sunken sand bowl, a slow sand spiral, the old queen's skeleton half buried, a danger rim. */
function overlordArena(ctx, t, stat = false) {
  const X = OP.x, Y = OP.y, R = OVERLORD_R;
  circle(ctx, X, Y, R + 26, '#ecc88c', 0);
  const g = ctx.createRadialGradient(X, Y, 20, X, Y, R); g.addColorStop(0, '#8d5d33'); g.addColorStop(0.65, '#b07c47'); g.addColorStop(1, '#cf9e64');
  ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.clip();
  ctx.lineCap = 'round';
  for (let arm = 0; arm < 7; arm++) {
    const base = (arm / 7) * TAU + t * 0.12;
    for (const [col, off, w] of [['rgba(90,50,20,.22)', 2, 4], ['rgba(255,236,196,.28)', 0, 2.4]]) {
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) { const r = 30 + i * 11, a = base + i * 0.13, x = X + Math.cos(a) * r + off, y = Y + Math.sin(a) * r + off; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
    }
  }
  ctx.save(); ctx.translate(X - 40, Y + 30); ctx.rotate(-0.4);
  for (let i = 0; i < 9; i++) {
    const a = -1.1 + i * 0.27, sx = Math.cos(a) * 170, sy = Math.sin(a) * 170 + 120;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + Math.cos(a + s * 1.4) * 40, sy + Math.sin(a + s * 1.4) * 40, sx + Math.cos(a + s * 1.9) * 58, sy + Math.sin(a + s * 1.9) * 58); ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = '#efe2c2'; ctx.lineWidth = 4.5; ctx.stroke(); ctx.strokeStyle = 'rgba(150,110,70,.5)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ball(ctx, sx, sy, 10, '#efe2c2', LA + 0.4, 2.6, 0.5);
  }
  ctx.restore();
  ctx.restore();
  for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU, x = X + Math.cos(a) * (R + 12), y = Y + Math.sin(a) * (R + 12); ball(ctx, x, y, 8 + H(i, 5) * 5, i % 3 ? '#c9a06a' : '#b58a58', LA, 2.2, 0.5); }
  if (!stat) { ctx.beginPath(); ctx.arc(X, Y, R - 10, 0, TAU); ctx.setLineDash([18, 14]); ctx.lineDashOffset = -t * 20;
  ctx.strokeStyle = `rgba(255,96,50,${0.45 + 0.2 * Math.sin(t * 3)})`; ctx.lineWidth = 6; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; }
  circle(ctx, X, Y, R, null, 5, INK);
}

// ------------------------------------------------------------------ props (obstacles)
export function drawDunesObstacle(ctx, o, t) {
  if (wpOn() && o.dunes) { const a = dunesPropArt(o); if (a && wpPiece(a.name)) { drawPaintedProp(ctx, a, o.x, o.y + (o.kind === 'palm' ? 4 : o.size * 0.22)); if (o.kind === 'sunobelisk') obeliskGlow(ctx, o, t); return true; } }
  switch (o.kind) {
    case 'sandrock': case 'cactus': case 'ruin': case 'mesa': case 'sphinx': case 'glass': case 'colossus': cachedProp(ctx, o); return true;
    case 'palm': palmTrunk(ctx, o); return true;
    case 'sunobelisk': obelisk(ctx, o, t, false); return true;
    default: return false;
  }
}
// Static Dunes props are painted once per (kind, variant bucket, size) into sprites (perf pass): the per-prop gradients
// and rim strokes used to be redrawn every frame.
const PROP_FN = { sandrock: (g, o) => sandrock(g, o), cactus: (g, o) => cactus(g, o), ruin: (g, o) => ruin(g, o), mesa: (g, o) => mesa(g, o), sphinx: (g, o) => sphinx(g, o), glass: (g, o) => glassSpire(g, o), colossus: (g, o) => colossus(g, o) };
function cachedProp(ctx, o) {
  const s = o.size, v = o.kind === 'mesa' || o.kind === 'sandrock' ? o.variant % 12 : o.variant % 8, W = Math.ceil(s * 4.2 + 40), Ht = Math.ceil(s * 4.6 + 40);
  const c = sprite(`dp:${o.kind}:${v}:${s}`, W, Ht, W / 2, Ht * 0.62, (g) => PROP_FN[o.kind](g, { ...o, x: 0, y: 0, variant: v }));
  blit(ctx, c, o.x, o.y);
}
function mesa(ctx, o) {
  // a tall red-rock butte: stepped strata, a lit cap, cracks, a sand drift at the foot
  const s = o.size, v = o.variant, x = o.x, y = o.y, n = 10, hg = s * 0.8, pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + v * 0.3, r = s * (0.82 + H(v, i) * 0.26); pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.74]); }
  shadow(ctx, x + s * 0.35, y + hg + s * 0.3, s * 1.25, s * 0.55, 0.3);
  poly(ctx, pts, x, y + hg); ctx.fillStyle = '#7e4a2c'; ctx.fill(); ink(ctx, 4);
  for (const [k, c] of [[0.75, '#93573a'], [0.5, '#a7653f'], [0.25, '#b9744a']]) { poly(ctx, pts.map(([a, b]) => [a * (0.99 - k * 0.03), b]), x, y + hg * k); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(60,25,10,.5)'; ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(x - s * 0.4, y + hg + s * 0.5, s * 0.8, s * 0.24, 0.1, 0, TAU); ctx.fillStyle = '#efd49a'; ctx.fill();
  poly(ctx, pts.map(([a, b]) => [a * 0.9, b * 0.9]), x, y - s * 0.04); ctx.fillStyle = lgrad(ctx, x, y, s, '#d48b55'); ctx.fill(); ink(ctx, 3.6);
  rimPoly(ctx, pts.map(([a, b]) => [a * 0.9, b * 0.9]), x, y - s * 0.04, 0.9);
  ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(70,30,12,.5)'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(x - s * 0.3, y - s * 0.3); ctx.lineTo(x - s * 0.05, y - s * 0.05); ctx.lineTo(x - s * 0.15, y + s * 0.25); ctx.moveTo(x + s * 0.25, y - s * 0.2); ctx.lineTo(x + s * 0.45, y + s * 0.05); ctx.stroke();
  for (let i = 0; i < 5; i++) { const px = x + (H(v, i) - 0.5) * s * 1.2, py = y + (H(i, v) - 0.5) * s * 0.7; ctx.beginPath(); ctx.moveTo(px - 6, py); ctx.lineTo(px + 6, py); ctx.strokeStyle = 'rgba(255,225,180,.35)'; ctx.lineWidth = 1.6; ctx.stroke(); }
  for (let i = 0; i < 3; i++) ball(ctx, x + (H(v, i + 7) - 0.3) * s * 1.5, y + hg + s * 0.6 + H(i, v) * 6, 3.5 + H(v + i, 2) * 4, '#a8673f', LA, 1.8, 0.5);
}
function sphinx(ctx, o) {
  // the half-buried Sphinx: lion body in sand, a striped nemes headdress, a broken nose, glyph-carved paws
  const x = o.x, y = o.y, s = o.size / 120;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  shadow(ctx, 30, 70, 150, 40, 0.3);
  ctx.beginPath(); ctx.ellipse(0, 60, 140, 34, 0, 0, TAU); ctx.fillStyle = '#e8cd92'; ctx.fill();
  // body + haunch
  ctx.beginPath(); ctx.moveTo(-40, 40); ctx.quadraticCurveTo(-20, -20, 60, -10); ctx.quadraticCurveTo(130, 0, 120, 50); ctx.quadraticCurveTo(40, 72, -40, 40); ctx.closePath(); ctx.fillStyle = lgrad(ctx, 40, 20, 90, '#d9b276'); ctx.fill(); ink(ctx, 4);
  ctx.beginPath(); ctx.ellipse(92, 22, 30, 26, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, 92, 22, 30, '#cfa66a'); ctx.fill(); ink(ctx, 3);
  // paws
  for (const px of [-96, -60]) { rrect(ctx, px, 30, 46, 22, 10); ctx.fillStyle = lgrad(ctx, px + 23, 41, 24, '#dcb87c'); ctx.fill(); ink(ctx, 3); for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(px + i * 11, 34); ctx.lineTo(px + i * 11, 48); ctx.strokeStyle = 'rgba(80,50,20,.5)'; ctx.lineWidth = 1.6; ctx.stroke(); } glyph(ctx, px + 22, 40, px, 1.2); }
  // headdress
  ctx.beginPath(); ctx.moveTo(-74, 10); ctx.lineTo(-82, -40); ctx.quadraticCurveTo(-50, -86, -18, -40); ctx.lineTo(-26, 10); ctx.closePath(); ctx.fillStyle = lgrad(ctx, -50, -30, 50, '#3e7fb0'); ctx.fill(); ink(ctx, 4);
  ctx.save(); ctx.clip(); for (let i = -6; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-90, -40 + i * 10); ctx.lineTo(-10, -40 + i * 10 + 8); ctx.strokeStyle = '#e8c35a'; ctx.lineWidth = 4; ctx.stroke(); } ctx.restore();
  ctx.beginPath(); ctx.moveTo(-74, 10); ctx.lineTo(-82, -40); ctx.quadraticCurveTo(-50, -86, -18, -40); ctx.lineTo(-26, 10); ctx.closePath(); ink(ctx, 4);
  // face
  ctx.beginPath(); ctx.ellipse(-50, -30, 20, 26, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, -50, -30, 24, '#dcb47a'); ctx.fill(); ink(ctx, 3);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(-58, -36, 4, 2.5, 0, 0, TAU); ctx.ellipse(-42, -36, 4, 2.5, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-50, -30); ctx.lineTo(-47, -22); ctx.lineTo(-53, -22); ctx.strokeStyle = 'rgba(70,40,15,.7)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-58, -14); ctx.quadraticCurveTo(-50, -10, -42, -14); ctx.stroke();
  rrect(ctx, -55, -8, 10, 18, 3); ctx.fillStyle = '#c99a5a'; ctx.fill(); ink(ctx, 2);
  ctx.beginPath(); ctx.ellipse(-56, -46, 10, 6, -0.5, 0, TAU); ctx.fillStyle = 'rgba(255,248,222,.3)'; ctx.fill();
  // cracks + sand drift over the back
  ctx.beginPath(); ctx.moveTo(20, -8); ctx.lineTo(30, 14); ctx.lineTo(22, 30); ctx.moveTo(70, 4); ctx.lineTo(80, 24); ctx.strokeStyle = 'rgba(80,45,20,.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10, 46); ctx.quadraticCurveTo(60, 20, 130, 50); ctx.quadraticCurveTo(70, 66, 10, 46); ctx.fillStyle = '#efd49a'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(20, 44); ctx.quadraticCurveTo(60, 24, 120, 46); ctx.strokeStyle = 'rgba(255,250,230,.8)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}
function glassSpire(ctx, o) {
  // a fused-glass crystal cluster (teal, translucent faces, a white glint)
  const x = o.x, y = o.y, s = o.size, v = o.variant;
  shadow(ctx, x + s * 0.3, y + s * 0.25, s * 0.9, s * 0.35, 0.25);
  const shards = [[-0.45, 0.7, -0.35], [0.4, 0.8, 0.3], [0, 1.25, 0.02], [0.2, 0.55, 0.6], [-0.2, 0.5, -0.7]];
  for (let i = 0; i < shards.length; i++) {
    const [ox, hh, lean] = shards[(i + v) % shards.length], bx = x + ox * s, by = y + s * 0.15, w = s * 0.24, tx = bx + lean * s * 0.4, ty = by - hh * s * 1.2;
    ctx.beginPath(); ctx.moveTo(bx - w, by); ctx.lineTo(tx - w * 0.2, ty + w * 0.6); ctx.lineTo(tx, ty); ctx.lineTo(tx + w * 0.3, ty + w * 0.5); ctx.lineTo(bx + w, by); ctx.closePath();
    ctx.fillStyle = 'rgba(110,220,215,.85)'; ctx.fill(); ink(ctx, 2.6);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.lineTo(tx + w * 0.3, ty + w * 0.5); ctx.lineTo(bx + w, by); ctx.closePath(); ctx.fillStyle = 'rgba(30,110,120,.45)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx - w * 0.5, by - 4); ctx.lineTo(tx - w * 0.15, ty + w); ctx.strokeStyle = 'rgba(240,255,255,.8)'; ctx.lineWidth = 2; ctx.stroke();
  }
  star(ctx, x - s * 0.1, y - s * 1.1, 4, '#ffffff', 0);
}
function colossus(ctx, o) {
  // a toppled colossus head: a giant pharaoh face lying in the sand, one eye socket, a cracked crown
  const x = o.x, y = o.y, s = o.size / 100;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  shadow(ctx, 20, 50, 120, 36, 0.3);
  ctx.beginPath(); ctx.ellipse(0, 46, 112, 26, 0, 0, TAU); ctx.fillStyle = '#e8cd92'; ctx.fill();
  ctx.save(); ctx.rotate(-0.35);
  ctx.beginPath(); ctx.ellipse(0, 0, 70, 58, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, 0, 0, 70, '#c9a46c'); ctx.fill(); ink(ctx, 4.5);
  // crown
  ctx.beginPath(); ctx.moveTo(-50, -38); ctx.lineTo(-30, -96); ctx.quadraticCurveTo(10, -110, 36, -90); ctx.lineTo(50, -38); ctx.closePath(); ctx.fillStyle = lgrad(ctx, 0, -70, 60, '#e9e2cf'); ctx.fill(); ink(ctx, 4);
  ctx.beginPath(); ctx.moveTo(-8, -100); ctx.lineTo(4, -78); ctx.lineTo(-6, -60); ctx.strokeStyle = 'rgba(70,50,30,.6)'; ctx.lineWidth = 2.4; ctx.stroke();
  ball(ctx, 0, -50, 8, '#d94f3a', LA, 2.4, 0.6);
  // face
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(-24, -6, 12, 7, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(24, -6, 12, 7, 0, 0, TAU); ctx.fillStyle = '#efe6cc'; ctx.fill(); ink(ctx, 2.4); circle(ctx, 24, -6, 4.5, '#3a7fb0', 0);
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(6, 18); ctx.lineTo(-6, 18); ctx.closePath(); ctx.fillStyle = 'rgba(90,60,30,.35)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-18, 32); ctx.quadraticCurveTo(0, 38, 18, 32); ctx.strokeStyle = 'rgba(70,40,15,.7)'; ctx.lineWidth = 3; ctx.stroke();
  rimArc(ctx, 0, 0, 64, LA + 0.35, 'rgba(255,248,222,.6)', 3);
  ctx.beginPath(); ctx.moveTo(30, -40); ctx.lineTo(44, -10); ctx.lineTo(36, 20); ctx.strokeStyle = 'rgba(70,40,15,.55)'; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(-90, 40); ctx.quadraticCurveTo(-30, 18, 40, 48); ctx.quadraticCurveTo(-20, 62, -90, 40); ctx.fillStyle = '#efd49a'; ctx.fill();
  ctx.restore();
}
function sandrock(ctx, o) {
  const s = o.size, v = o.variant, x = o.x, y = o.y, n = 9, hg = s * 0.45, pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + v * 0.013, r = s * (0.8 + H(v, i) * 0.32); pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.78]); }
  shadow(ctx, x + s * 0.3, y + hg + s * 0.35, s * 1.2, s * 0.55, 0.28);
  poly(ctx, pts, x, y + hg); ctx.fillStyle = '#9c6a3e'; ctx.fill(); ink(ctx, 3.5);
  for (const [k, c] of [[0.66, '#b27a49'], [0.33, '#c18a56']]) { poly(ctx, pts, x, y + hg * k); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(70,35,15,.45)'; ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(x - s * 0.55, y + hg + s * 0.48, s * 0.62, s * 0.2, 0.15, 0, TAU); ctx.fillStyle = '#efd49a'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(x - s * 0.55, y + hg + s * 0.44, s * 0.5, s * 0.12, 0.15, Math.PI * 1.1, Math.PI * 1.9); ctx.strokeStyle = 'rgba(255,250,230,.8)'; ctx.lineWidth = 1.8; ctx.stroke();
  poly(ctx, pts, x, y); ctx.fillStyle = lgrad(ctx, x, y, s, '#dcaa6c'); ctx.fill(); ink(ctx, 3.5);
  poly(ctx, pts.map(([a, b]) => [a * 0.62, b * 0.62]), x + s * 0.05, y + s * 0.03); ctx.fillStyle = 'rgba(255,236,196,.22)'; ctx.fill();
  rimPoly(ctx, pts, x, y, 0.9);
  ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(80,40,15,.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - s * 0.2, y - s * 0.25); ctx.lineTo(x + s * 0.02, y - s * 0.02); ctx.lineTo(x - s * 0.06, y + s * 0.22);
  ctx.moveTo(x + s * 0.3, y - s * 0.1); ctx.lineTo(x + s * 0.45, y + s * 0.1); ctx.stroke();
  for (let i = 0; i < 3; i++) ball(ctx, x + (H(v, i + 7) - 0.3) * s * 1.4, y + hg + s * 0.55 + H(i, v) * 6, 3 + H(v + i, 2) * 4, '#b48455', LA, 1.8, 0.5);
}
function cactus(ctx, o) {
  const s = o.size, v = o.variant, x = o.x, base = o.y + s * 0.25, Ht = s * 1.75, w = s * 0.56;
  ctx.save(); ctx.translate(x, base); ctx.transform(1, 0, 0.9, 0.35, 0, 0); ctx.globalAlpha = 0.22; rrect(ctx, -w / 2, 0, w, Ht, w / 2); ctx.fillStyle = '#3a2a1a'; ctx.fill(); ctx.restore();
  ellipse(ctx, x, base, w * 0.95, w * 0.32, '#e6c486', 0);
  const arms = [[-1, 0.45, 0.62], [1, 0.62, 0.48]].slice(0, 1 + (v % 2));
  const armPath = (sd, at, ln, ox = 0, oy = 0) => { const ay = base - Ht * at + oy, ax = x + sd * w * 0.35 + ox, ex = x + sd * (w * 0.5 + s * 0.42) + ox; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex - sd * 6, ay); ctx.quadraticCurveTo(ex, ay, ex, ay - 8); ctx.lineTo(ex, ay - Ht * ln * 0.55); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [sd, at, ln] of arms) { armPath(sd, at, ln); ctx.strokeStyle = INK; ctx.lineWidth = w * 0.62 + 6; ctx.stroke(); ctx.strokeStyle = '#3f8a45'; ctx.lineWidth = w * 0.62; ctx.stroke(); armPath(sd, at, ln, -w * 0.13, -1); ctx.strokeStyle = 'rgba(190,240,160,.55)'; ctx.lineWidth = 2.4; ctx.stroke(); }
  rrect(ctx, x - w / 2, base - Ht, w, Ht, w / 2);
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, '#8fd06c'); g.addColorStop(0.45, '#4f9e4b'); g.addColorStop(1, '#2c6738');
  ctx.fillStyle = g; ctx.fill(); ink(ctx, 3);
  for (const [dx, c] of [[-0.24, 'rgba(210,255,180,.55)'], [0, 'rgba(30,70,35,.45)'], [0.24, 'rgba(30,70,35,.45)']]) { ctx.beginPath(); ctx.moveTo(x + dx * w, base - Ht + w * 0.35); ctx.lineTo(x + dx * w, base - 4); ctx.strokeStyle = c; ctx.lineWidth = 1.8; ctx.stroke(); }
  ctx.strokeStyle = '#fff4d6'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) { const sy = base - Ht * (0.12 + i * 0.09), sx = x + (i % 2 ? w / 2 : -w / 2); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (i % 2 ? 4 : -4), sy - 2); ctx.stroke(); }
  if (v % 3 !== 1) { const fy = base - Ht + 1; for (let p = 0; p < 5; p++) { const a = (p / 5) * TAU + v; ellipse(ctx, x + Math.cos(a) * 4, fy + Math.sin(a) * 2.6, 3.8, 2.4, '#ff7ab8', 1.3, a); } circle(ctx, x, fy, 2.2, '#ffe45c', 1); }
}
function block(ctx, x, y, w, d, h, top, side) {
  rrect(ctx, x - w / 2, y - h, w, h, 3); ctx.fillStyle = side; ctx.fill(); ink(ctx, 2.6);
  rrect(ctx, x - w / 2, y - h - d, w, d, 3); ctx.fillStyle = lgrad(ctx, x, y - h - d / 2, w / 2, top); ctx.fill(); ink(ctx, 2.6);
  ctx.beginPath(); ctx.moveTo(x - w / 2 + 3, y - h - d + 2.5); ctx.lineTo(x + w / 2 - 6, y - h - d + 2.5); ctx.strokeStyle = 'rgba(255,248,222,.7)'; ctx.lineWidth = 1.8; ctx.stroke();
}
function ruin(ctx, o) {
  const s = o.size, v = o.variant, x = o.x, y = o.y + s * 0.3;
  shadow(ctx, x + s * 0.25, y + s * 0.1, s * 1.25, s * 0.45, 0.26);
  ball(ctx, x + s * 0.95, y + s * 0.15, s * 0.22, '#d2b07a', LA, 2.4, 0.5);
  const hs = [0.8, 1.2, 0.55].map((k, i) => s * k * (0.85 + H(v, i) * 0.3));
  const bw = s * 0.62, d = s * 0.4;
  for (let i = 0; i < 3; i++) {
    const bx = x + (i - 1) * bw, h = hs[i];
    block(ctx, bx, y, bw, d, h, '#e3c48c', '#b98f5c');
    for (let r = 0; r < 2; r++) glyph(ctx, bx - bw * 0.18 + r * bw * 0.36, y - h * 0.55, v + i * 2 + r, s / 36, 'rgba(80,45,20,.65)');
    ctx.beginPath(); ctx.moveTo(bx - bw / 2 + 2, y - h * 0.25); ctx.lineTo(bx + bw / 2 - 2, y - h * 0.25); ctx.strokeStyle = 'rgba(70,40,20,.35)'; ctx.lineWidth = 1.3; ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(x + bw * 1.5 - 1, y - hs[2] - d); ctx.lineTo(x + bw * 1.5 - 9, y - hs[2] - d); ctx.lineTo(x + bw * 1.5 - 1, y - hs[2] - d + 8); ctx.closePath(); ctx.fillStyle = '#a07648'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - bw * 1.7, y + 4); ctx.quadraticCurveTo(x - bw * 0.8, y - s * 0.35, x + bw * 0.2, y + 4); ctx.closePath(); ctx.fillStyle = '#ecd096'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - bw * 1.5, y + 1); ctx.quadraticCurveTo(x - bw * 0.8, y - s * 0.3, x + bw * 0.05, y + 1); ctx.strokeStyle = 'rgba(255,250,230,.85)'; ctx.lineWidth = 1.8; ctx.stroke();
}
function palmTop(o) { const s = o.size, lean = (H(o.variant, 1) - 0.5) * s * 0.7; return { x: o.x + lean, y: o.y - s * 1.25 }; }
function palmTrunk(ctx, o) {
  const s = o.size, top = palmTop(o);
  ctx.save(); ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.ellipse(o.x + s * 0.55, o.y + s * 0.42, s * 1.15, s * 0.5, 0, 0, TAU); ctx.fillStyle = '#1f3a18'; ctx.fill(); ctx.restore();
  ellipse(ctx, o.x, o.y + 4, 13, 5, 'rgba(60,40,20,.25)', 0);
  const N = 8, bend = (k) => Math.sin(k * Math.PI * 0.5);
  for (let i = 0; i < N; i++) {
    const k0 = i / N, k1 = (i + 1) / N;
    const x0 = o.x + (top.x - o.x) * bend(k0), y0 = o.y + (top.y - o.y) * k0, x1 = o.x + (top.x - o.x) * bend(k1), y1 = o.y + (top.y - o.y) * k1, w = 9 - i * 0.45;
    ctx.beginPath(); ctx.moveTo(x0 - w, y0); ctx.lineTo(x1 - w + 1, y1); ctx.lineTo(x1 + w - 1, y1); ctx.lineTo(x0 + w, y0); ctx.closePath();
    const g = ctx.createLinearGradient(x0 - w, 0, x0 + w, 0); g.addColorStop(0, '#c9965c'); g.addColorStop(0.5, '#a87240'); g.addColorStop(1, '#704622');
    ctx.fillStyle = g; ctx.fill(); ink(ctx, 2.2);
    ctx.beginPath(); ctx.moveTo(x0 - w + 2, y0 - 1); ctx.quadraticCurveTo(x0, y0 - 5, x0 + w - 2, y0 - 1); ctx.strokeStyle = 'rgba(60,35,15,.55)'; ctx.lineWidth = 1.4; ctx.stroke();
  }
}
/** Palm canopy (over the characters; fades when the local player stands under it). */
export function drawPalmCanopy(ctx, o, t, alpha = 1) {
  const s = o.size, c = palmTop(o), v = o.variant;
  ctx.save(); ctx.globalAlpha *= alpha;
  const frond = (a, L, col, dark) => {
    const aa = a + Math.sin(t * 1.3 + a * 3 + v) * 0.05, ex = c.x + Math.cos(aa) * L, ey = c.y + Math.sin(aa) * L * 0.8 + L * 0.18, mx = c.x + Math.cos(aa) * L * 0.55, my = c.y + Math.sin(aa) * L * 0.44 - L * 0.12;
    const nx = -Math.sin(aa), ny = Math.cos(aa);
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.quadraticCurveTo(mx + nx * L * 0.2, my + ny * L * 0.2, ex, ey); ctx.quadraticCurveTo(mx - nx * L * 0.2, my - ny * L * 0.2, c.x, c.y);
    ctx.fillStyle = col; ctx.fill(); ink(ctx, 2.4);
    ctx.strokeStyle = dark; ctx.lineWidth = 1.3; ctx.beginPath();
    for (let i = 1; i < 8; i++) { const k = i / 8, px = (1 - k) * (1 - k) * c.x + 2 * (1 - k) * k * mx + k * k * ex, py = (1 - k) * (1 - k) * c.y + 2 * (1 - k) * k * my + k * k * ey, wl = L * 0.18 * Math.sin(k * Math.PI); ctx.moveTo(px, py); ctx.lineTo(px + nx * wl + Math.cos(aa) * 5, py + ny * wl + Math.sin(aa) * 5); ctx.moveTo(px, py); ctx.lineTo(px - nx * wl + Math.cos(aa) * 5, py - ny * wl + Math.sin(aa) * 5); }
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.strokeStyle = 'rgba(230,255,190,.6)'; ctx.lineWidth = 1.6; ctx.stroke();
  };
  for (let i = 0; i < 7; i++) frond((i / 7) * TAU + 0.25 + v * 0.1, s * 1.0, '#3f8a3a', 'rgba(20,50,20,.5)');
  for (let i = 0; i < 6; i++) frond((i / 6) * TAU + v * 0.1, s * 0.86, '#69b84e', 'rgba(30,80,30,.45)');
  for (let i = 0; i < 3; i++) ball(ctx, c.x + Math.cos(i * 2.1) * 6, c.y + 4 + Math.sin(i * 2.1) * 4, 5.2, '#7a4a22', LA, 2, 0.45);
  ctx.restore();
}
/** Sun obelisks (Khepra's arena) / Tomb obelisks (Neferakh's shade-casters): a 2.5D shaft, glyph column, gold cap. */
export function obelisk(ctx, o, t, tomb, lit = 0) {
  const s = o.size, x = o.x, y = o.y + s * 0.5, Ht = s * 3.3, bw = s * 0.92, tw = s * 0.52;
  const face = tomb ? '#3a2e4f' : '#d8b276', side = tomb ? '#221a33' : '#a8804c';
  ctx.save(); ctx.globalAlpha = 0.24; ctx.beginPath(); ctx.moveTo(x - bw / 2, y); ctx.lineTo(x + bw * 1.8, y + s * 0.9); ctx.lineTo(x + bw * 2.4, y + s * 0.6); ctx.lineTo(x + bw / 2, y - 4); ctx.closePath(); ctx.fillStyle = '#1a1020'; ctx.fill(); ctx.restore();
  rrect(ctx, x - bw * 0.8, y - s * 0.18, bw * 1.6, s * 0.5, 4); ctx.fillStyle = tomb ? '#2a2238' : '#b48a55'; ctx.fill(); ink(ctx, 2.6);
  ctx.beginPath(); ctx.moveTo(x + bw / 2, y); ctx.lineTo(x + bw / 2 + s * 0.28, y - s * 0.16); ctx.lineTo(x + tw / 2 + s * 0.2, y - Ht - s * 0.1); ctx.lineTo(x + tw / 2, y - Ht); ctx.closePath(); ctx.fillStyle = side; ctx.fill(); ink(ctx, 2.6);
  ctx.beginPath(); ctx.moveTo(x - bw / 2, y); ctx.lineTo(x + bw / 2, y); ctx.lineTo(x + tw / 2, y - Ht); ctx.lineTo(x - tw / 2, y - Ht); ctx.closePath();
  const g = ctx.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0); g.addColorStop(0, shade(face, 0.28)); g.addColorStop(0.6, face); g.addColorStop(1, shade(face, -0.18)); ctx.fillStyle = g; ctx.fill(); ink(ctx, 2.8);
  ctx.beginPath(); ctx.moveTo(x - bw / 2 + 3, y - 3); ctx.lineTo(x - tw / 2 + 2, y - Ht + 3); ctx.strokeStyle = tomb ? 'rgba(255,214,120,.55)' : 'rgba(255,248,222,.75)'; ctx.lineWidth = 2; ctx.stroke();
  if (tomb) { ctx.beginPath(); ctx.moveTo(x - bw * 0.32, y - 6); ctx.lineTo(x - tw * 0.3, y - Ht + 8); ctx.moveTo(x + bw * 0.32, y - 6); ctx.lineTo(x + tw * 0.3, y - Ht + 8); ctx.strokeStyle = 'rgba(242,193,74,.7)'; ctx.lineWidth = 1.4; ctx.stroke(); }
  for (let i = 0; i < 4; i++) glyph(ctx, x, y - Ht * (0.2 + i * 0.17), i + o.variant, s / 34, tomb ? 'rgba(255,200,90,.85)' : 'rgba(80,45,20,.7)');
  const sy = y - Ht * 0.86, pulse = 0.6 + 0.4 * Math.sin(t * 2.5 + o.variant);
  if (!tomb || lit) bloom(ctx, x, sy, s * (tomb ? 1.6 : 1.1), tomb ? '#ffcf4a' : '#ffb43c', (tomb ? 0.7 : 0.35) * pulse);
  circle(ctx, x, sy, s * 0.15, tomb ? (lit ? '#ffe9a0' : '#8a5cff') : '#ffcf4a', 1.8);
  ctx.beginPath(); ctx.moveTo(x - tw / 2, y - Ht); ctx.lineTo(x + tw / 2, y - Ht); ctx.lineTo(x, y - Ht - s * 0.62); ctx.closePath(); ctx.fillStyle = lgrad(ctx, x, y - Ht - s * 0.3, s * 0.4, '#f2c14a'); ctx.fill(); ink(ctx, 2.6);
  ctx.beginPath(); ctx.moveTo(x, y - Ht - s * 0.62); ctx.lineTo(x + tw / 2 + s * 0.2, y - Ht - s * 0.1); ctx.lineTo(x + tw / 2, y - Ht); ctx.closePath(); ctx.fillStyle = '#b8862a'; ctx.fill(); ink(ctx, 2.2);
  star(ctx, x - tw * 0.18, y - Ht - s * 0.34, 3 + pulse * 2, '#fffbe0', 0);
}

/** painted sun obelisk: the pulsing sun-disc bloom on top of the painted sprite */
function obeliskGlow(ctx, o, t) { const a = dunesPropArt(o), pulse = 0.6 + 0.4 * Math.sin(t * 2.5 + o.variant); bloom(ctx, o.x, o.y + o.size * 0.22 - a.h * 0.9, o.size * 1.2, '#ffb43c', 0.35 * pulse); }

// ------------------------------------------------------------------ decor
export function drawDunesDecor(ctx, d, t) {
  if (d.kind === 'drybush') { tumble(ctx, d, t); return true; }
  if (d.kind === 'skull') { skull(ctx, d); return true; }
  return false;
}
function tumble(ctx, d, t) {
  const s = d.size * 0.8, v = d.variant, x = d.x + Math.sin(t * 0.7 + v) * 1.5, y = d.y;
  shadow(ctx, x + 3, y + s * 0.6, s * 1.05, s * 0.38, 0.2);
  ctx.lineCap = 'round';
  for (const [col, w, n, k] of [['#6e5130', 2.4, 9, 0.95], ['#a98457', 2, 10, 0.85], ['#d3b07a', 1.3, 6, 0.7]]) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = H(v, i * 3 + w * 10) * TAU, r = s * k * (0.5 + H(i, v) * 0.5); ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.arc(x, y, r, a, a + 1.2 + H(v + i, 5)); }
    ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.strokeStyle = 'rgba(43,36,51,.55)'; ctx.lineWidth = 1.6; ctx.stroke();
}
function skull(ctx, d) {
  const s = d.size * 0.55, x = d.x, y = d.y, rot = (H(d.variant, 3) - 0.5) * 0.8;
  shadow(ctx, x + 3, y + s * 0.8, s * 1.5, s * 0.45, 0.22);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.lineCap = 'round';
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * s * 0.55, -s * 0.35); ctx.quadraticCurveTo(sd * s * 1.6, -s * 0.6, sd * s * 1.5, -s * 1.3); ctx.strokeStyle = INK; ctx.lineWidth = s * 0.42 + 4; ctx.stroke(); ctx.strokeStyle = '#e9dcc0'; ctx.lineWidth = s * 0.42; ctx.stroke(); ctx.strokeStyle = 'rgba(140,110,70,.45)'; ctx.lineWidth = 1.2; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-s * 0.6, -s * 0.5); ctx.quadraticCurveTo(0, -s * 0.85, s * 0.6, -s * 0.5); ctx.lineTo(s * 0.32, s * 0.8); ctx.quadraticCurveTo(0, s * 0.95, -s * 0.32, s * 0.8); ctx.closePath();
  ctx.fillStyle = lgrad(ctx, 0, 0, s, '#f2e8d2', LA - rot); ctx.fill(); ink(ctx, 2.4);
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * s * 0.27, -s * 0.18, s * 0.17, s * 0.13, sd * 0.4, 0, TAU); ctx.fillStyle = '#3a2a22'; ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(-s * 0.08, s * 0.35); ctx.lineTo(s * 0.08, s * 0.35); ctx.lineTo(0, s * 0.52); ctx.closePath(); ctx.fillStyle = '#3a2a22'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.6); ctx.lineTo(s * 0.2, -s * 0.38); ctx.lineTo(s * 0.12, -s * 0.28); ctx.strokeStyle = 'rgba(90,70,50,.55)'; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(x + s * 0.4, y + s * 0.75, s * 0.9, s * 0.25, 0, Math.PI, TAU); ctx.fillStyle = '#e6c27f'; ctx.fill();
}

// ------------------------------------------------------------------ enemies (registered into art.js ENEMY_DRAW)
function legs(ctx, r, n, t, id, col, len = 1, speed = 14) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) for (const sd of [-1, 1]) {
    const bx = r * (0.45 - i * (0.9 / Math.max(1, n - 1))), sw = Math.sin(t * speed + id + i * 2 + (sd > 0 ? Math.PI : 0)) * 0.3;
    const kx = bx + Math.cos(sd * 1.3 + sw) * r * 0.35 * len, ky = sd * r * 0.9 * len, fx = kx + r * 0.3 * len * (1 - i), fy = ky + sd * r * 0.32 * len;
    ctx.beginPath(); ctx.moveTo(bx, sd * r * 0.4); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy);
    ctx.strokeStyle = INK; ctx.lineWidth = 4.6; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.stroke();
  }
}
/** Iridescent beetle-shell sheen (gold -> teal -> violet band across the lit side). */
function sheen(ctx, x, y, rx, ry, la) {
  ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.clip();
  const c = Math.cos(la), s = Math.sin(la), g = ctx.createLinearGradient(x + c * rx, y + s * ry, x - c * rx, y - s * ry);
  g.addColorStop(0, 'rgba(255,230,140,0)'); g.addColorStop(0.28, 'rgba(255,214,110,.55)'); g.addColorStop(0.44, 'rgba(140,255,230,.28)'); g.addColorStop(0.6, 'rgba(160,120,255,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2); ctx.restore();
}
Object.assign(ENEMY_DRAW, {
  /** Gilded Scarab: an iridescent teal-and-gold beetle; curls into a spinning ball for its roll. */
  scarab(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e);
    if (e.state === 'roll') {
      ctx.save(); ctx.globalAlpha *= 0.4; for (let i = 1; i <= 3; i++) circle(ctx, -r * 0.7 * i, (i % 2 ? -1 : 1) * 4, r * (0.55 - i * 0.1), '#e8cd94', 0); ctx.restore();
      ball(ctx, 0, 0, r * 1.05, col, la, 3.5);
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r * 1.02, 0, TAU); ctx.clip(); ctx.rotate(t * 22);
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.42, -r * 1.2); ctx.quadraticCurveTo(i * r * 0.42 + r * 0.3, 0, i * r * 0.42, r * 1.2); ctx.strokeStyle = i % 2 ? 'rgba(255,214,110,.75)' : 'rgba(10,60,60,.55)'; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.restore(); sheen(ctx, 0, 0, r, r, la); return;
    }
    if (e.state === 'wind') ctx.translate(Math.sin(t * 60) * 1.5, 0);
    legs(ctx, r, 3, t, e.id, '#0f4d48');
    oval(ctx, r * 0.62, 0, r * 0.4, r * 0.46, shade(col, -0.25), la, 2.8, 0, 0.45);
    ctx.beginPath(); ctx.moveTo(r * 0.85, -r * 0.1); ctx.quadraticCurveTo(r * 1.35, -r * 0.05, r * 1.3, -r * 0.45); ctx.quadraticCurveTo(r * 1.2, -r * 0.05, r * 0.85, r * 0.1); ctx.closePath(); ctx.fillStyle = lgrad(ctx, r, -r * 0.2, r * 0.3, '#f2c14a', la); ctx.fill(); ink(ctx, 2.2);
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.92, sd * r * 0.2); ctx.quadraticCurveTo(r * 1.25, sd * r * 0.32, r * 1.18, sd * r * 0.05); ctx.strokeStyle = INK; ctx.lineWidth = 3.6; ctx.stroke(); ctx.strokeStyle = '#d9a33a'; ctx.lineWidth = 1.6; ctx.stroke(); }
    oval(ctx, -r * 0.18, 0, r * 0.88, r * 0.78, col, la, 3.2, 0, 0.5);
    sheen(ctx, -r * 0.18, 0, r * 0.88, r * 0.78, la);
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(-r * 0.18, 0, r * 0.8, r * 0.7, 0, sd > 0 ? 0.25 : Math.PI + 0.25, sd > 0 ? Math.PI - 0.25 : TAU - 0.25); ctx.strokeStyle = '#f2c14a'; ctx.lineWidth = 1.8; ctx.stroke(); ctx.beginPath(); ctx.moveTo(r * 0.4, sd * r * 0.12); ctx.quadraticCurveTo(-r * 0.2, sd * r * 0.55, -r * 0.85, sd * r * 0.18); ctx.strokeStyle = 'rgba(10,50,50,.35)'; ctx.lineWidth = 1.2; ctx.stroke(); } // elytra trim + grooves
    ctx.beginPath(); ctx.moveTo(r * 0.68, 0); ctx.lineTo(-r * 1.02, 0); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.fillStyle = 'rgba(10,50,50,.4)';
    for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(-r * 0.7 + i * r * 0.3, sd * r * 0.42, 1.6, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.42, r * 0.38, r * 0.1, 0.1, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.fill();
    circle(ctx, r * 0.86, -r * 0.24, 2.4, '#ffd23f', 1.2); circle(ctx, r * 0.86, r * 0.24, 2.4, '#ffd23f', 1.2);
  },
  scarabling(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e);
    legs(ctx, r, 3, t, e.id, '#15605a', 0.9, 20);
    oval(ctx, r * 0.6, 0, r * 0.42, r * 0.48, shade(col, -0.3), la, 2.2, 0, 0.4);
    oval(ctx, -r * 0.15, 0, r * 0.85, r * 0.75, col, la, 2.4, 0, 0.5);
    sheen(ctx, -r * 0.15, 0, r * 0.85, r * 0.75, la);
    ctx.beginPath(); ctx.moveTo(r * 0.55, 0); ctx.lineTo(-r * 0.95, 0); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
    circle(ctx, r * 0.8, -r * 0.22, 1.6, '#ffd23f', 0); circle(ctx, r * 0.8, r * 0.22, 1.6, '#ffd23f', 0);
  },
  /** Burrowing Sandwurm: a travelling mound while underground, a toothed maw breaching a crater when up. */
  sandwurm(ctx, e, t, col) {
    const r = e.r;
    if (e.state === 'under' || e.state === 'erupt' || e.state === 'idle') { mound(ctx, e, t, r, e.state === 'erupt' ? Math.min(1, e.st / 42) : 0); return; }
    const k = e.state === 'dive' ? Math.max(0.15, 1 - e.st / 24) : Math.min(1, 0.35 + e.st / 12);
    wurmHead(ctx, e, t, r, col, k);
  },
  /** Mirage Caster: a hooded robed sorcerer with a mirror-disc staff and heat-haze echoes (fakes are identical). */
  mirage(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e), mirror = e.state === 'mirror' || e.state === 'mirrorWind';
    ctx.translate(0, Math.sin(t * 3 + e.id) * 0.8);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.22 + 0.08 * Math.sin(t * 7 + e.id);
    circle(ctx, -3, -3, r * 1.05, '#7fe8ff', 0); circle(ctx, 3, 3, r * 1.05, '#ff7ad9', 0); ctx.restore();
    ctx.beginPath(); ctx.moveTo(r * 0.45, -r * 0.6);
    for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 - (i / 10) * Math.PI, rr = r * (1.0 + (i % 2) * 0.18 + Math.sin(t * 6 + i + e.id) * 0.05); ctx.lineTo(-r * 0.2 + Math.cos(a) * rr * 1.05, Math.sin(a) * rr * 0.92); }
    ctx.lineTo(r * 0.45, r * 0.6); ctx.closePath();
    ctx.fillStyle = lgrad(ctx, 0, 0, r * 1.1, col, la); ctx.fill(); ink(ctx, 3);
    ctx.beginPath(); ctx.arc(-r * 0.2, 0, r * 0.86, Math.PI * 0.6, Math.PI * 1.4); ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); for (let i = 0; i <= 12; i++) { const a = Math.PI * 0.62 + (i / 12) * Math.PI * 0.76, rr = r * (i % 2 ? 0.74 : 0.8); ctx.lineTo(-r * 0.2 + Math.cos(a) * rr, Math.sin(a) * rr); } ctx.strokeStyle = 'rgba(255,207,74,.7)'; ctx.lineWidth = 1.2; ctx.stroke(); // embroidered hem
    ctx.strokeStyle = 'rgba(30,10,70,.35)'; ctx.lineWidth = 1.6; for (const a of [2.3, 3.14, 4.0]) { ctx.beginPath(); ctx.moveTo(-r * 0.1, 0); ctx.lineTo(-r * 0.2 + Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.82); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(r * 0.1, r * 0.55); ctx.lineTo(r * 1.15, r * 0.55); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#c9963a'; ctx.lineWidth = 2.6; ctx.stroke();
    const mg = ctx.createLinearGradient(r * 1.1, r * 0.25, r * 1.5, r * 0.85); mg.addColorStop(0, '#e9fdff'); mg.addColorStop(0.5, '#7fd8f0'); mg.addColorStop(1, '#3a6fd0');
    ctx.beginPath(); ctx.arc(r * 1.3, r * 0.55, r * 0.34, 0, TAU); ctx.fillStyle = mg; ctx.fill(); ctx.lineWidth = 4.6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#f2c14a'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 1.16, r * 0.42); ctx.lineTo(r * 1.36, r * 0.33); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.stroke();
    oval(ctx, r * 0.2, 0, r * 0.55, r * 0.52, shade(col, -0.2), la, 2.8, 0, 0.45);
    ctx.beginPath(); ctx.ellipse(r * 0.42, 0, r * 0.26, r * 0.32, 0, 0, TAU); ctx.fillStyle = '#140a26'; ctx.fill();
    circle(ctx, r * 0.5, -r * 0.12, 2.3, '#8ff3ff', 0); circle(ctx, r * 0.5, r * 0.12, 2.3, '#8ff3ff', 0);
    ctx.beginPath(); ctx.moveTo(r * 0.05, -r * 0.42); ctx.quadraticCurveTo(r * 0.2, 0, r * 0.05, r * 0.42); ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 1.8; ctx.stroke();
    if (mirror) {
      for (let i = 0; i < 6; i++) { const a = t * 3 + (i / 6) * TAU; ctx.save(); ctx.translate(Math.cos(a) * r * 1.6, Math.sin(a) * r * 1.6); ctx.rotate(a * 2); ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(0, 6); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fillStyle = '#cff6ff'; ctx.fill(); ink(ctx, 1.6); ctx.beginPath(); ctx.moveTo(-1, -3); ctx.lineTo(1.5, -1); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); }
      ctx.save(); ctx.globalAlpha *= 0.3 + 0.2 * Math.sin(t * 12); circle(ctx, 0, 0, r * 1.3, null, 3, '#8ff3ff'); ctx.restore();
    } else for (let i = 0; i < 3; i++) { const a = t * 1.5 + (i / 3) * TAU; star(ctx, Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3, 2.6, '#fff6c8', 0); }
  },
  /** Anubite Jackal: a black temple hound with a gold-and-lapis usekh collar and gilded ears. */
  jackal(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e), gait = Math.sin(t * 16 + e.id);
    ctx.save(); ctx.translate(-r * 0.95, 0); ctx.rotate(Math.PI + Math.sin(t * 9 + e.id) * 0.35);
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.quadraticCurveTo(r * 0.6, -6, r * 0.9, 0); ctx.quadraticCurveTo(r * 0.6, 6, 0, 3); ctx.closePath(); ctx.fillStyle = shade(col, 0.08); ctx.fill(); ink(ctx, 2.2); ctx.restore();
    ctx.lineCap = 'round';
    for (const [lx, sd] of [[r * 0.45, -1], [r * 0.45, 1], [-r * 0.5, -1], [-r * 0.5, 1]]) { const sw = gait * (lx > 0 ? 1 : -1) * sd * 4; ctx.beginPath(); ctx.moveTo(lx, sd * r * 0.4); ctx.lineTo(lx + sw, sd * r * 0.8); ctx.strokeStyle = INK; ctx.lineWidth = 5.5; ctx.stroke(); ctx.strokeStyle = shade(col, 0.15); ctx.lineWidth = 3; ctx.stroke(); }
    oval(ctx, -r * 0.05, 0, r * 1.05, r * 0.66, col, la, 3, 0, 0.55);
    for (let i = 0; i < 3; i++) { const x = -r * 0.62 + i * r * 0.3; ctx.beginPath(); ctx.moveTo(x - r * 0.14, -r * 0.4); ctx.quadraticCurveTo(x + r * 0.14, 0, x - r * 0.14, r * 0.4); ctx.lineTo(x + r * 0.02, r * 0.44); ctx.quadraticCurveTo(x + r * 0.3, 0, x + r * 0.02, -r * 0.44); ctx.closePath(); ctx.fillStyle = i % 2 ? '#1f4fa8' : '#241d2c'; ctx.fill(); ink(ctx, 1.5); ctx.beginPath(); ctx.moveTo(x + r * 0.02, -r * 0.42); ctx.quadraticCurveTo(x + r * 0.28, 0, x + r * 0.02, r * 0.42); ctx.strokeStyle = '#f2c14a'; ctx.lineWidth = 1.3; ctx.stroke(); } // segmented back armour, gold-edged
    ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(r * 0.4, 0); ctx.strokeStyle = '#d9a33a'; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,180,.5)'; ctx.lineWidth = 0.8; ctx.stroke();
    for (const [rr, c] of [[0.62, '#2fb7a8'], [0.52, '#f2c14a'], [0.42, '#1f4fa8']]) { ctx.beginPath(); ctx.arc(r * 0.55, 0, r * rr, Math.PI * 0.55, Math.PI * 1.45); ctx.strokeStyle = c; ctx.lineWidth = 3.4; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(r * 0.55, 0, r * 0.68, Math.PI * 0.55, Math.PI * 1.45); ink(ctx, 1.6);
    oval(ctx, r * 0.85, 0, r * 0.45, r * 0.4, shade(col, 0.06), la, 2.8, 0, 0.5);
    ctx.beginPath(); ctx.moveTo(r * 1.05, -r * 0.2); ctx.lineTo(r * 1.62, -r * 0.08); ctx.lineTo(r * 1.62, r * 0.08); ctx.lineTo(r * 1.05, r * 0.2); ctx.closePath(); ctx.fillStyle = lgrad(ctx, r * 1.3, 0, r * 0.3, shade(col, 0.1), la); ctx.fill(); ink(ctx, 2.4);
    circle(ctx, r * 1.62, 0, 2.6, '#0a0810', 0);
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.8, sd * r * 0.2); ctx.lineTo(r * 0.45, sd * r * 0.85); ctx.lineTo(r * 1.0, sd * r * 0.32); ctx.closePath(); ctx.fillStyle = shade(col, -0.05); ctx.fill(); ink(ctx, 2.2); ctx.beginPath(); ctx.moveTo(r * 0.82, sd * r * 0.28); ctx.lineTo(r * 0.6, sd * r * 0.66); ctx.lineTo(r * 0.92, sd * r * 0.34); ctx.closePath(); ctx.fillStyle = '#f2c14a'; ctx.fill(); }
    circle(ctx, r * 1.05, -r * 0.16, 2.2, '#ffd23f', 0); circle(ctx, r * 1.05, r * 0.16, 2.2, '#ffd23f', 0);
  },
  /** Bound Mummy: wrapped body with trailing bandages (more once unravelled), reaching arms, eyes glowing through. */
  mummy(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e), low = e.hp / (e.maxHp || 1) < 0.5, lash = e.state === 'lash', snare = e.state === 'snare';
    ctx.lineCap = 'round';
    for (let i = 0; i < (low ? 6 : 3); i++) { const y0 = (i - (low ? 2.5 : 1)) * r * 0.32, w = Math.sin(t * 5 + i * 1.7 + e.id); ctx.beginPath(); ctx.moveTo(-r * 0.6, y0); ctx.bezierCurveTo(-r * 1.1, y0 + w * 6, -r * 1.4, y0 - w * 8, -r * (1.7 + (i % 2) * 0.4), y0 + w * 10); ctx.strokeStyle = INK; ctx.lineWidth = 6.5; ctx.stroke(); ctx.strokeStyle = '#e9dcb8'; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = 'rgba(150,120,80,.5)'; ctx.lineWidth = 1; ctx.stroke(); }
    for (const sd of [-1, 1]) { const L = lash && sd === -1 ? r * (1.4 + Math.min(1, e.st / 20) * 1.2) : r * 1.15; ctx.save(); ctx.translate(r * 0.2, sd * r * 0.55); rrect(ctx, 0, -r * 0.16, L, r * 0.32, r * 0.14); ctx.fillStyle = lgrad(ctx, L / 2, 0, L / 2, col, la); ctx.fill(); ink(ctx, 2.4); ctx.strokeStyle = 'rgba(140,110,70,.55)'; ctx.lineWidth = 1.2; for (let x = 6; x < L - 4; x += 6) { ctx.beginPath(); ctx.moveTo(x, -r * 0.16); ctx.lineTo(x - 4, r * 0.16); ctx.stroke(); } ctx.restore(); }
    if (snare) { ctx.beginPath(); ctx.moveTo(r * 1.2, r * 0.5); for (let i = 1; i < 8; i++) ctx.lineTo(r * 1.2 + i * r * 0.35, r * 0.5 + Math.sin(t * 18 + i) * 4); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#e9dcb8'; ctx.lineWidth = 3; ctx.stroke(); }
    oval(ctx, 0, 0, r * 0.82, r * 0.92, col, la, 3.2, 0, 0.5);
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.8, r * 0.9, 0, 0, TAU); ctx.clip();
    for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.2 - r, -r); ctx.lineTo(i * r * 0.2 + r * 0.5, r); ctx.strokeStyle = i % 2 ? 'rgba(130,100,60,.4)' : 'rgba(255,250,230,.45)'; ctx.lineWidth = i % 2 ? 1.6 : 2.4; ctx.stroke(); }
    circle(ctx, -r * 0.3, r * 0.35, r * 0.14, 'rgba(120,80,40,.3)', 0); circle(ctx, r * 0.1, -r * 0.5, r * 0.08, 'rgba(120,80,40,.3)', 0);
    ctx.restore();
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.3, sd * r * 0.2); ctx.quadraticCurveTo(-r * 0.2, sd * r * 0.9, -r * 0.62, sd * r * 0.55); ctx.strokeStyle = INK; ctx.lineWidth = 4.2; ctx.stroke(); ctx.strokeStyle = '#efe3c2'; ctx.lineWidth = 2.6; ctx.stroke(); } // loose cross-wraps over the shoulders
    circle(ctx, r * 0.08, 0, r * 0.17, '#f2c14a', 2); circle(ctx, r * 0.08, 0, r * 0.09, '#2fb7a8', 0); // a scarab amulet on the chest
    oval(ctx, r * 0.42, 0, r * 0.42, r * 0.4, shade(col, 0.05), la, 2.6, 0, 0.45);
    ctx.beginPath(); ctx.moveTo(r * 0.35, -r * 0.3); ctx.lineTo(r * 0.75, r * 0.05); ctx.moveTo(r * 0.25, -r * 0.05); ctx.lineTo(r * 0.6, r * 0.32); ctx.strokeStyle = 'rgba(130,100,60,.55)'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(r * 0.62, 0, r * 0.1, r * 0.26, 0, 0, TAU); ctx.fillStyle = '#1a1410'; ctx.fill();
    const glow = low ? '#ff6a3c' : '#7dff8a';
    bloom(ctx, r * 0.65, 0, r * 0.45, glow, 0.5);
    circle(ctx, r * 0.65, -r * 0.1, 2, glow, 0); circle(ctx, r * 0.65, r * 0.1, 2, glow, 0);
  },
  /** Sun-Eaten Priest: white-and-gold robes, a nemes headdress, a blazing solar disc behind him, an ankh staff. */
  sunpriest(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e), cast = e.state === 'ray' || e.state === 'wind', dk = cast ? 1 + 0.12 * Math.sin(t * 20) : 1;
    if (cast) bloom(ctx, -r * 0.1, 0, r * 2.2, '#ffb43c', 0.75);
    ctx.save(); ctx.rotate(t * 0.8); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.1) * r * 0.85, Math.sin(a - 0.1) * r * 0.85); ctx.lineTo(Math.cos(a) * r * 1.25 * dk, Math.sin(a) * r * 1.25 * dk); ctx.lineTo(Math.cos(a + 0.1) * r * 0.85, Math.sin(a + 0.1) * r * 0.85); ctx.closePath(); ctx.fillStyle = i % 2 ? '#ffcf4a' : '#ff8a2a'; ctx.fill(); ink(ctx, 1.4); } ctx.restore();
    ball(ctx, -r * 0.1, 0, r * 0.88, col, la, 2.6);
    oval(ctx, -r * 0.05, 0, r * 0.72, r * 0.8, '#f3ead2', la, 3, 0, 0.5);
    ctx.save(); ctx.beginPath(); ctx.ellipse(-r * 0.05, 0, r * 0.7, r * 0.78, 0, 0, TAU); ctx.clip();
    for (const [y, c] of [[-r * 0.3, '#c8433a'], [0, '#f2c14a'], [r * 0.3, '#c8433a']]) { ctx.beginPath(); ctx.moveTo(-r, y); ctx.lineTo(r * 0.2, y); ctx.strokeStyle = c; ctx.lineWidth = 2.6; ctx.stroke(); }
    ctx.restore();
    for (const [rr, c] of [[0.5, '#f2c14a'], [0.4, '#2fb7a8'], [0.3, '#f2c14a']]) { ctx.beginPath(); ctx.arc(r * 0.25, 0, r * rr, Math.PI * 0.5, Math.PI * 1.5); ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -r * 0.62); ctx.lineTo(r * 1.35, -r * 0.62); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#d9a33a'; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.save(); ctx.translate(r * 1.5, -r * 0.62); ctx.beginPath(); ctx.ellipse(r * 0.12, 0, r * 0.14, r * 0.1, 0, 0, TAU); ctx.moveTo(-r * 0.02, -r * 0.2); ctx.lineTo(-r * 0.02, r * 0.2); ctx.moveTo(-r * 0.02, 0); ctx.lineTo(-r * 0.3, 0); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = cast ? '#fff3b0' : '#f2c14a'; ctx.lineWidth = 2.6; ctx.stroke(); ctx.restore();
    oval(ctx, r * 0.42, 0, r * 0.38, r * 0.42, '#1f4fa8', la, 2.6, 0, 0.4);
    ctx.save(); ctx.beginPath(); ctx.ellipse(r * 0.42, 0, r * 0.36, r * 0.4, 0, 0, TAU); ctx.clip(); for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(0, i * r * 0.12); ctx.lineTo(r, i * r * 0.12); ctx.strokeStyle = '#f2c14a'; ctx.lineWidth = 1.6; ctx.stroke(); } ctx.restore();
    ctx.beginPath(); ctx.ellipse(r * 0.6, 0, r * 0.18, r * 0.2, 0, 0, TAU); ctx.fillStyle = '#c9905a'; ctx.fill(); ink(ctx, 1.6);
    circle(ctx, r * 0.68, -r * 0.08, 1.6, cast ? '#fff' : INK, 0); circle(ctx, r * 0.68, r * 0.08, 1.6, cast ? '#fff' : INK, 0);
  },
  /** Khepra, the Sandwurm Queen (the Dunes Overlord). */
  khepra(ctx, e, t, col) {
    if (e.state === 'under' || e.state === 'erupt') { mound(ctx, e, t, e.r * 1.2, e.state === 'erupt' ? Math.min(1, e.st / 52) : 0, true); return; }
    wurmBody(ctx, e, t, e.r, col);
  },
});
/** A burrowing mound: sand hump, cracks, a bow wave, a wake behind and bouncing grit; `k` = eruption charge. */
function mound(ctx, e, t, r, k, big = false) {
  if (k > 0) ctx.translate(Math.sin(t * 70) * 2 * k, 0);
  ctx.save(); ctx.globalAlpha *= 0.55;
  for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(-r * (0.9 + i * 0.75), Math.sin(t * 4 + i) * 2, r * (0.75 - i * 0.15), r * (0.45 - i * 0.08), 0, 0, TAU); ctx.fillStyle = `rgba(214,170,105,${0.9 - i * 0.22})`; ctx.fill(); }
  ctx.restore();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.3); g.addColorStop(0, '#f7dfa8'); g.addColorStop(0.6, '#d9ac6c'); g.addColorStop(1, '#a8743e');
  ctx.beginPath(); ctx.ellipse(0, 0, r * (1.25 + k * 0.25), r * (0.85 + k * 0.2), 0, 0, TAU); ctx.fillStyle = g; ctx.fill(); ink(ctx, 2.6);
  ctx.strokeStyle = k > 0.5 ? `rgba(255,120,40,${k})` : 'rgba(110,62,26,.6)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  const n = big ? 7 : 5;
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + e.id; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.15, Math.sin(a) * r * 0.12); ctx.lineTo(Math.cos(a + 0.25) * r * 0.55, Math.sin(a + 0.25) * r * 0.4); ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.65); ctx.stroke(); }
  for (let i = 0; i < 3; i++) { const ph = (t * 1.8 + i / 3) % 1; ctx.beginPath(); ctx.arc(r * (0.9 + ph * 0.6), 0, r * (0.6 + ph * 0.4), -0.9, 0.9); ctx.strokeStyle = `rgba(255,245,215,${0.6 * (1 - ph)})`; ctx.lineWidth = 2; ctx.stroke(); }
  for (let i = 0; i < (big ? 9 : 5); i++) { const a = e.id * 3 + i * 1.3, hop = Math.abs(Math.sin(t * (6 + k * 10) + i)) * (6 + k * 14); circle(ctx, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.55 - hop, 2 + (i % 3), i % 2 ? '#c99a5e' : '#e8c88a', 1.2); }
  if (big) { ctx.save(); ctx.rotate(t * 2); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, r * (1.5 + i * 0.25), i * 2, i * 2 + 1.6); ctx.strokeStyle = 'rgba(230,190,120,.45)'; ctx.lineWidth = 3; ctx.stroke(); } ctx.restore(); }
}
/** A sandwurm breaching a crater: plated ring segments rising, then a round maw of tooth rings seen from above. */
function wurmHead(ctx, e, t, r, col, k) {
  const la = lightLocal(e);
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.45, r * 1.15, 0, 0, TAU); ctx.fillStyle = '#8f5f32'; ctx.fill();
  ctx.lineWidth = 7; ctx.strokeStyle = '#e8c88a'; ctx.stroke(); ink(ctx, 2);
  ctx.save(); ctx.scale(k, k);
  for (let i = 2; i >= 0; i--) {
    const x = r * 0.18 * (2 - i), rr = r * (0.95 - i * 0.08);
    ball(ctx, x, 0, rr, shade(col, -0.08 * i), la, 3, 0.5);
    ctx.beginPath(); ctx.arc(x, 0, rr * 0.8, la + 0.6, la + 0.6 + Math.PI * 1.2); ctx.strokeStyle = 'rgba(80,45,15,.45)'; ctx.lineWidth = 2; ctx.stroke();
    for (let s = 0; s < 6; s++) { const a = (s / 6) * TAU + i; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * rr * 0.92, Math.sin(a) * rr * 0.92); ctx.lineTo(x + Math.cos(a) * rr * 1.12, Math.sin(a) * rr * 1.12); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#f1e6cc'; ctx.lineWidth = 2; ctx.stroke(); }
  }
  const mx = r * 0.4, open = 0.75 + 0.1 * Math.sin(t * 6 + e.id);
  circle(ctx, mx, 0, r * 0.62 * open, '#5a1626', 3);
  for (const [rr, n] of [[0.58, 12], [0.42, 9], [0.27, 7]]) for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rr * 3 + t * 0.3, R = r * rr * open; ctx.beginPath(); ctx.moveTo(mx + Math.cos(a - 0.18) * R, Math.sin(a - 0.18) * R); ctx.lineTo(mx + Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72); ctx.lineTo(mx + Math.cos(a + 0.18) * R, Math.sin(a + 0.18) * R); ctx.closePath(); ctx.fillStyle = '#fff8e6'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke(); }
  bloom(ctx, mx, 0, r * 0.3, '#ff5e3b', 0.6); circle(ctx, mx, 0, r * 0.1, '#ffb347', 0);
  ctx.restore();
}
/** Khepra: a crowned scarab-headed wurm queen; her ringed, spined body coils behind her. */
function wurmBody(ctx, e, t, r, col) {
  const la = lightLocal(e), p3 = e.phase === 3, roar = e.state === 'roar' || e.state === 'quake';
  if (e.state === 'sandstorm') { ctx.save(); ctx.rotate(t * 4); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, r * (1.5 + i * 0.3), i, i + 2.2); ctx.strokeStyle = 'rgba(232,196,130,.5)'; ctx.lineWidth = 5; ctx.stroke(); } ctx.restore(); }
  for (let i = 5; i >= 1; i--) {
    const x = -r * (0.55 + 0.6 * i), y = Math.sin(t * 2.2 + i * 0.9 + e.id) * r * 0.22, rr = r * (0.8 - i * 0.09);
    ball(ctx, x, y, rr, shade(col, -0.05 * i), la, 3.5, 0.5);
    ctx.beginPath(); ctx.arc(x, y, rr * 0.78, -1.3, 1.3); ctx.strokeStyle = 'rgba(80,45,15,.45)'; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(x + rr * 0.15, y, rr * 0.55, -1.0, 1.0); ctx.strokeStyle = 'rgba(255,240,200,.3)'; ctx.lineWidth = 1.6; ctx.stroke();
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x - rr * 0.25, y + sd * rr * 0.85); ctx.lineTo(x - rr * 0.05, y + sd * rr * 1.35); ctx.lineTo(x + rr * 0.2, y + sd * rr * 0.85); ctx.closePath(); ctx.fillStyle = '#f1e6cc'; ctx.fill(); ink(ctx, 2.2); }
    if (p3) { ctx.beginPath(); ctx.moveTo(x - rr * 0.3, y - rr * 0.2); ctx.lineTo(x, y + rr * 0.1); ctx.lineTo(x - rr * 0.1, y + rr * 0.4); ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = 2; ctx.stroke(); }
  }
  const op = roar ? 0.75 : 0.35 + 0.12 * Math.sin(t * 5);
  for (const sd of [-1, 1]) for (const [L, off] of [[1.15, 0.38], [0.85, 0.15]]) {
    ctx.save(); ctx.translate(r * 0.7, sd * r * off); ctx.rotate(sd * op);
    ctx.beginPath(); ctx.moveTo(0, -sd * 6); ctx.quadraticCurveTo(r * L * 0.6, -sd * r * 0.35, r * L, sd * r * 0.05); ctx.quadraticCurveTo(r * L * 0.5, -sd * r * 0.05, 0, sd * 6); ctx.closePath();
    ctx.fillStyle = lgrad(ctx, r * L * 0.5, 0, r * L * 0.5, '#e9c46a', la - sd * op); ctx.fill(); ink(ctx, 2.6); ctx.restore();
  }
  circle(ctx, r * 0.85, 0, r * 0.28, '#5a1626', 2.6);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.beginPath(); ctx.moveTo(r * 0.85 + Math.cos(a) * r * 0.27, Math.sin(a) * r * 0.27); ctx.lineTo(r * 0.85 + Math.cos(a) * r * 0.14, Math.sin(a) * r * 0.14); ctx.strokeStyle = '#fff8e6'; ctx.lineWidth = 2.6; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(r * 0.75, -r * 0.55); ctx.quadraticCurveTo(r * 0.2, -r * 1.05, -r * 0.45, -r * 0.62); ctx.quadraticCurveTo(-r * 0.7, 0, -r * 0.45, r * 0.62); ctx.quadraticCurveTo(r * 0.2, r * 1.05, r * 0.75, r * 0.55); ctx.quadraticCurveTo(r * 0.95, 0, r * 0.75, -r * 0.55); ctx.closePath();
  ctx.fillStyle = lgrad(ctx, 0, 0, r, col, la); ctx.fill(); ink(ctx, 4);
  sheen(ctx, 0.1 * r, 0, r * 0.8, r * 0.8, la);
  ctx.strokeStyle = 'rgba(80,45,15,.5)'; ctx.lineWidth = 2.2;
  for (const k of [0.35, 0.6]) { ctx.beginPath(); ctx.moveTo(r * 0.65, -r * k); ctx.quadraticCurveTo(-r * 0.1, -r * k * 1.3, -r * 0.4, -r * k * 0.5); ctx.moveTo(r * 0.65, r * k); ctx.quadraticCurveTo(-r * 0.1, r * k * 1.3, -r * 0.4, r * k * 0.5); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-r * 0.55, 0); ctx.lineTo(r * 0.8, 0); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.12); ctx.quadraticCurveTo(r * 0.75, -r * 0.2, r * 1.0, -r * 0.62); ctx.quadraticCurveTo(r * 0.7, -r * 0.05, r * 0.2, r * 0.12); ctx.closePath(); ctx.fillStyle = lgrad(ctx, r * 0.6, -r * 0.3, r * 0.4, '#f2c14a', la); ctx.fill(); ink(ctx, 2.6);
  bloom(ctx, -r * 0.05, 0, r * 0.5, p3 ? '#ff5e3b' : '#ffcf4a', 0.55);
  ball(ctx, -r * 0.05, 0, r * 0.2, p3 ? '#ff6a3c' : '#ffcf4a', la, 2.6);
  for (const [x, y] of [[0.62, -0.32], [0.62, 0.32], [0.48, -0.18], [0.48, 0.18]]) circle(ctx, r * x, r * y, 3.2, p3 ? '#ff3b1f' : '#ffb347', 1.4);
}

// ------------------------------------------------------------------ projectiles
export function drawDunesProjectile(ctx, pr, x, y, lite, t) {
  if (pr.style === 'sand') {
    const a = Math.atan2(pr.vy, pr.vx), r = pr.r + 2, rot = t * 9 + x * 0.01;
    ctx.save(); ctx.globalAlpha = 0.45; for (let i = 1; i <= 3; i++) circle(ctx, x - Math.cos(a) * i * 9, y - Math.sin(a) * i * 9, r * (0.85 - i * 0.18), '#e8c98e', 0); ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath(); for (let i = 0; i < 7; i++) { const aa = (i / 7) * TAU, rr = r * (i % 2 ? 0.78 : 1.05); i ? ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr) : ctx.moveTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } ctx.closePath();
    ctx.fillStyle = lgrad(ctx, 0, 0, r, '#e0b06a', LA - rot); ctx.fill(); ink(ctx, 2.6);
    circle(ctx, -r * 0.3, -r * 0.25, 1.6, '#fff4d6', 0); circle(ctx, r * 0.25, r * 0.2, 1.3, '#8a5a2e', 0);
    ctx.restore(); return true;
  }
  if (pr.style === 'sun') {
    const r = pr.r;
    if (!lite) bloom(ctx, x, y, r * 4, '#ffb43c', 0.65);
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 5);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.22) * r, Math.sin(a - 0.22) * r); ctx.lineTo(Math.cos(a) * r * 1.75, Math.sin(a) * r * 1.75); ctx.lineTo(Math.cos(a + 0.22) * r, Math.sin(a + 0.22) * r); ctx.closePath(); ctx.fillStyle = i % 2 ? '#ffcf4a' : '#ff8a2a'; ctx.fill(); ink(ctx, 1.5); }
    ctx.restore();
    ball(ctx, x, y, r, '#ffd84a', LA, 2.8, 0.8);
    circle(ctx, x - r * 0.25, y - r * 0.25, r * 0.35, '#fffbe0', 0);
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ Tomb portals + Solar Glyphs (from packDunes)
let memo = { k: -1, s: null, v: null };
export function dunesState(sim) {
  if (sim.dunesV !== undefined) return sim.dunesV;
  if (memo.s === sim && memo.k === sim.tick) return memo.v;
  memo = { k: sim.tick, s: sim, v: packDunes(sim) };
  return memo.v;
}
export function drawDunesUnder(ctx, sim, local, t, view) {
  const D = dunesState(sim);
  if (!D) return;
  for (const [x, y, life, big] of D.tp || []) if (!view || (x > view.x0 - 90 && x < view.x1 + 90 && y > view.y0 - 90 && y < view.y1 + 90)) tombPortal(ctx, x, y, life, big, t);
  for (const [x, y, life, pid] of D.gl || []) solarGlyph(ctx, x, y, life, t, local && pid === local.id);
}
export function tombPortal(ctx, x, y, life, big, t) {
  const R = big ? 50 : 40, fade = life < 300 ? 0.5 + 0.5 * Math.sin(t * 18) : 1;
  if (wpOn() && wpPiece('tombportal')) { // painted: the gilded sun-arch with its teal vortex
    const Ht = R * 3.1, top = y + R * 0.75 - Ht;
    shadow(ctx, x, y + R * 0.75, R * 1.4, R * 0.4, 0.3);
    bloom(ctx, x, y - R * 0.3, R * 2.6, '#2ee6c4', 0.35 * fade);
    ctx.save(); ctx.globalAlpha *= fade; wpProp(ctx, 'tombportal', x, y + R * 0.75, Ht); ctx.restore();
    for (let i = 0; i < 7; i++) { const ph = (t * 0.6 + i / 7) % 1, a = i * 2.4 + t * 0.4; star(ctx, x + Math.cos(a) * R * 0.6, y - R * 0.3 - ph * R * 1.2, 2.6 * (1 - ph) + 0.8, i % 2 ? '#ffe9a0' : '#bffcf0', 0); }
    const k = Math.max(0, Math.min(1, life / PORTAL.life)), bw = R * 1.6;
    rrect(ctx, x - bw / 2, y + R * 0.95, bw, 6, 3); ctx.fillStyle = 'rgba(20,14,24,.7)'; ctx.fill();
    rrect(ctx, x - bw / 2, y + R * 0.95, bw * k, 6, 3); ctx.fillStyle = k < 0.2 ? '#ff5e5b' : '#ffcf4a'; ctx.fill();
    ctx.font = `15px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK;
    ctx.strokeText('TOMB OF THE SUN-EATEN KING', x, top - 10); ctx.fillStyle = '#ffe9a0'; ctx.fillText('TOMB OF THE SUN-EATEN KING', x, top - 10);
    const lbl = `${Math.ceil(life / 60)}s · walk in`;
    ctx.font = `12px ${FONT}`; ctx.strokeText(lbl, x, y + R + 30); ctx.fillStyle = '#bffcf0'; ctx.fillText(lbl, x, y + R + 30);
    return;
  }
  shadow(ctx, x, y + R * 0.75, R * 1.3, R * 0.45, 0.3);
  bloom(ctx, x, y, R * 2.4, '#2ee6c4', 0.35 * fade);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
  const g = ctx.createRadialGradient(x, y, 2, x, y, R); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.18, '#2ee6c4'); g.addColorStop(0.6, '#0d4f55'); g.addColorStop(1, '#ffcf4a');
  ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
  ctx.lineCap = 'round';
  for (let arm = 0; arm < 4; arm++) { ctx.beginPath(); for (let i = 0; i <= 20; i++) { const k = i / 20, a = t * 2.4 + arm * (TAU / 4) + k * 4.2, rr = R * (0.1 + k * 0.95), px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.strokeStyle = arm % 2 ? 'rgba(255,215,90,.75)' : 'rgba(180,255,240,.6)'; ctx.lineWidth = 3; ctx.stroke(); }
  ctx.restore();
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU + 0.03, a1 = ((i + 1) / n) * TAU - 0.03, am = (a0 + a1) / 2;
    ctx.beginPath(); ctx.arc(x, y, R + 13, a0, a1); ctx.arc(x, y, R, a1, a0, true); ctx.closePath();
    ctx.fillStyle = lgrad(ctx, x, y, R + 13, i % 2 ? '#e2c38a' : '#cfa96e'); ctx.fill(); ink(ctx, 2);
    glyph(ctx, x + Math.cos(am) * (R + 6.5), y + Math.sin(am) * (R + 6.5), i, 0.62, 'rgba(70,40,20,.75)');
  }
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4, sx = x + Math.cos(a) * (R + 6.5), sy = y + Math.sin(a) * (R + 6.5); ball(ctx, sx, sy, 5, '#f2c14a', LA, 1.8); circle(ctx, sx, sy, 2, '#1f4fa8', 0); }
  for (let i = 0; i < 7; i++) { const ph = (t * 0.6 + i / 7) % 1, a = i * 2.4 + t * 0.4; star(ctx, x + Math.cos(a) * R * 0.9, y + Math.sin(a) * R * 0.5 - ph * R * 1.4, 2.6 * (1 - ph) + 0.8, i % 2 ? '#ffe9a0' : '#bffcf0', 0); }
  const k = Math.max(0, Math.min(1, life / PORTAL.life));
  ctx.beginPath(); ctx.arc(x, y, R + 19, -Math.PI / 2, -Math.PI / 2 + k * TAU); ctx.strokeStyle = k < 0.2 ? '#ff5e5b' : '#ffcf4a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
  ctx.font = `15px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK;
  ctx.strokeText('TOMB OF THE SUN-EATEN KING', x, y - R - 30); ctx.fillStyle = '#ffe9a0'; ctx.fillText('TOMB OF THE SUN-EATEN KING', x, y - R - 30);
  const lbl = `${Math.ceil(life / 60)}s · walk in`;
  ctx.font = `12px ${FONT}`; ctx.strokeText(lbl, x, y + R + 36); ctx.fillStyle = '#bffcf0'; ctx.fillText(lbl, x, y + R + 36);
}
function solarGlyph(ctx, x, y, life, t, mine) {
  const a = life < 90 ? 0.4 + 0.4 * Math.sin(t * 20) : 0.9, R = 30;
  if (wpOn() && wpPiece('solarglyph')) {
    ctx.save(); ctx.globalAlpha *= a; bloom(ctx, x, y, R * 1.6, '#2ee6c4', mine ? 0.45 : 0.25);
    ctx.translate(x, y); ctx.scale(1, 0.62); ctx.rotate(t * 1.2); wpProp(ctx, 'solarglyph', 0, R * 1.1, R * 2.2); ctx.restore(); return;
  }
  ctx.save(); ctx.globalAlpha *= a;
  bloom(ctx, x, y, R * 1.6, '#2ee6c4', mine ? 0.45 : 0.25);
  ctx.translate(x, y); ctx.rotate(t * 1.5);
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.strokeStyle = '#2ee6c4'; ctx.lineWidth = 3; ctx.stroke();
  for (let i = 0; i < 8; i++) { const aa = (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(aa) * R, Math.sin(aa) * R); ctx.lineTo(Math.cos(aa) * (R + 9), Math.sin(aa) * (R + 9)); ctx.strokeStyle = i % 2 ? '#ffcf4a' : '#bffcf0'; ctx.lineWidth = 2.6; ctx.stroke(); }
  ctx.rotate(-t * 3); ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, TAU); ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 2.2; ctx.stroke(); circle(ctx, 0, 0, 3.4, '#fffbe0', 0);
  ctx.restore();
}

// ------------------------------------------------------------------ over layer: palm canopies, heat shimmer, drifting grit
export function drawDunesOver(ctx, sim, local, view, t) {
  if (!dunesVisible(view)) return;
  for (const o of sim.world.obstacles) {
    if (o.kind !== 'palm' || (wpOn() && wpPiece('palm1'))) continue; // (painted palms are whole upright sprites)
    const c = palmTop(o); if (c.x < view.x0 - 80 || c.x > view.x1 + 80 || c.y < view.y0 - 80 || c.y > view.y1 + 80) continue;
    const under = local && Math.hypot(local.x - c.x, local.y - c.y) < o.size;
    drawPalmCanopy(ctx, o, t, under ? 0.45 : 1);
  }
  if (!local || !inDunesArea(local.x, local.y, 0)) return;
  const z = dunesZoneAt(local.x, local.y);
  ctx.save(); ctx.lineCap = 'round';
  if (z.danger >= 5) {
    for (let i = 0; i < 9; i++) { const yy = view.y1 - ((t * 40 + i * 120) % (view.y1 - view.y0 + 200)); ctx.beginPath(); for (let x = view.x0; x <= view.x1; x += 40) { const y = yy + Math.sin(x * 0.02 + t * 3 + i) * 6; x === view.x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.strokeStyle = `rgba(255,240,210,${z.danger === 6 ? 0.07 : 0.05})`; ctx.lineWidth = 10; ctx.stroke(); }
  }
  ctx.fillStyle = 'rgba(255,236,190,.55)';
  const W = view.x1 - view.x0, Hh = view.y1 - view.y0;
  for (let i = 0; i < 30; i++) { const x = view.x0 + ((H(i, 1) * 9999 + t * (60 + H(i, 2) * 80)) % W), y = view.y0 + (((H(i, 3) * 9999 + Math.sin(t + i) * 20) % Hh) + Hh) % Hh; ctx.fillRect(x, y, 2.4, 1.4); }
  ctx.restore();
}

// ------------------------------------------------------------------ the Realm Gate plaza (Brightwater Village, south)
let GATE_U = { dunes: false, frost: false, ember: false, rift: false };
export function setGateUnlocks(u) { if (u) GATE_U = u; }
const gatePos = (g) => ({ x: TP.x + g.dx, y: TP.y + g.dy });
const gateOpen = (g) => !g.lock || !!GATE_U[g.lock];
export function drawGatePlaza(ctx, t) {
  const cx = TP.x, cy = TP.y + GATES[0].dy + 20; // (2026-10-09 town layout: at the south end of the main street)
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, 390, 140, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, cx, cy, 300, '#e2cfa2', LA, 0.18, -0.15); ctx.fill(); ink(ctx, 3.5);
  ctx.clip();
  for (let r = 0; r < 8; r++) { const n = 18 + r * 7; for (let i = 0; i < n; i++) { const a = (i / n) * TAU + r * 0.2, x = cx + Math.cos(a) * (60 + r * 44), y = cy + Math.sin(a) * (24 + r * 16); ctx.save(); ctx.translate(x, y); ctx.rotate(a); rrect(ctx, -10, -6, 20, 12, 3.5); ctx.fillStyle = r % 2 ? '#d2bd8f' : '#eadbb5'; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(43,36,51,.3)'; ctx.stroke(); ctx.restore(); } }
  ctx.restore();
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.45);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU - Math.PI / 2; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.25) * 16, Math.sin(a - 0.25) * 16); ctx.lineTo(Math.cos(a) * (i % 2 ? 36 : 52), Math.sin(a) * (i % 2 ? 36 : 52)); ctx.lineTo(Math.cos(a + 0.25) * 16, Math.sin(a + 0.25) * 16); ctx.closePath(); ctx.fillStyle = i % 2 ? '#2fb7a8' : '#ffcf4a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
  circle(ctx, 0, 0, 14, '#1f4fa8', 2.4); ctx.restore();
  for (const g of GATES) gatePad(ctx, g, t);
}
function gatePad(ctx, g, t) {
  const { x, y } = gatePos(g), open = gateOpen(g), R = GATE_R + 10;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.62);
  circle(ctx, 0, 0, R + 12, '#bba57a', 3.2);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (R + 2), Math.sin(a) * (R + 2)); ctx.lineTo(Math.cos(a) * (R + 11), Math.sin(a) * (R + 11)); ctx.strokeStyle = 'rgba(60,40,20,.4)'; ctx.lineWidth = 1.6; ctx.stroke(); }
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();
  if (open) {
    const gg = ctx.createRadialGradient(0, 0, 2, 0, 0, R); gg.addColorStop(0, '#ffffff'); gg.addColorStop(0.3, g.col); gg.addColorStop(1, shade(g.col, -0.55)); ctx.fillStyle = gg; ctx.fillRect(-R, -R, R * 2, R * 2);
    for (let arm = 0; arm < 3; arm++) { ctx.beginPath(); ctx.moveTo(0, 0); for (let i = 1; i <= 16; i++) { const k = i / 16, a = t * 2.6 + arm * 2.09 + k * 4, rr = R * k; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.stroke(); }
  } else { ctx.fillStyle = '#2a2433'; ctx.fillRect(-R, -R, R * 2, R * 2); ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 3; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 12 - R, -R); ctx.lineTo(i * 12 + R, R); ctx.stroke(); } }
  ctx.restore();
  circle(ctx, 0, 0, R, null, 3.5, INK);
  ctx.restore();
  if (open) bloom(ctx, x, y, R * 1.8, g.col, 0.35 + 0.1 * Math.sin(t * 3));
}
/** Gate posts (y-sorted with the characters): carved pillars with a banner and a lantern. */
export function drawGatePost(ctx, o, t) {
  const g = GATES.find((q) => q.id === o.gate) || GATES[0], open = gateOpen(g);
  const x = o.x, y = o.y + 6, Ht = 96, w = 22, side = o.side || 1;
  shadow(ctx, x + 10, y + 4, 22, 9, 0.28);
  rrect(ctx, x - w * 0.8, y - 12, w * 1.6, 16, 4); ctx.fillStyle = lgrad(ctx, x, y - 4, w, '#c9b38a'); ctx.fill(); ink(ctx, 2.6);
  rrect(ctx, x - w / 2, y - Ht, w, Ht - 8, 5);
  const gr = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); gr.addColorStop(0, '#efe0bc'); gr.addColorStop(0.55, '#d4bd90'); gr.addColorStop(1, '#a88e62'); ctx.fillStyle = gr; ctx.fill(); ink(ctx, 2.8);
  ctx.beginPath(); ctx.moveTo(x - w / 2 + 3, y - Ht + 6); ctx.lineTo(x - w / 2 + 3, y - 14); ctx.strokeStyle = 'rgba(255,250,232,.8)'; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 3; i++) glyph(ctx, x, y - Ht * (0.3 + i * 0.2), i + (o.gate === 'dunes' ? 1 : 0), 0.7, 'rgba(80,55,30,.7)');
  rrect(ctx, x - w * 0.7, y - Ht - 10, w * 1.4, 12, 3); ctx.fillStyle = lgrad(ctx, x, y - Ht - 4, w, '#e6d4ac'); ctx.fill(); ink(ctx, 2.4);
  const sw = Math.sin(t * 2.5 + x) * 3;
  ctx.beginPath(); ctx.moveTo(x - w * 0.42, y - Ht + 4); ctx.lineTo(x + w * 0.42, y - Ht + 4); ctx.lineTo(x + w * 0.42 + sw, y - Ht + 40); ctx.lineTo(x + sw * 0.5, y - Ht + 32); ctx.lineTo(x - w * 0.42 + sw, y - Ht + 40); ctx.closePath();
  ctx.fillStyle = open ? g.col : '#6b6577'; ctx.fill(); ink(ctx, 2);
  ctx.beginPath(); ctx.moveTo(x - w * 0.3, y - Ht + 9); ctx.lineTo(x + w * 0.3, y - Ht + 9); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.save(); ctx.translate(x + sw * 0.4, y - Ht + 20);
  if (o.gate === 'dunes') circle(ctx, 0, 0, 5, '#fff3b0', 1.4);
  else if (o.gate === 'frost') { for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); ctx.lineTo(-Math.cos(a) * 6, -Math.sin(a) * 6); ctx.strokeStyle = '#eafaff'; ctx.lineWidth = 2.4; ctx.stroke(); } }
  else if (o.gate === 'ember') { ctx.beginPath(); ctx.moveTo(0, -8); ctx.quadraticCurveTo(7, -1, 4, 5); ctx.quadraticCurveTo(0, 8, -4, 5); ctx.quadraticCurveTo(-7, -1, 0, -8); ctx.fillStyle = '#ffd36a'; ctx.fill(); ink(ctx, 1.2); }
  else { ctx.beginPath(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(6, 0, 0, 6); ctx.quadraticCurveTo(-6, 0, 0, -6); ctx.fillStyle = '#e8ffd6'; ctx.fill(); ink(ctx, 1.2); }
  ctx.restore();
  const lx = x + side * (w * 0.5 + 6), ly = y - Ht + 50;
  ctx.beginPath(); ctx.moveTo(x + side * w * 0.5, ly - 10); ctx.lineTo(lx, ly - 10); ctx.lineTo(lx, ly - 6); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  if (open) bloom(ctx, lx, ly, 22, '#ffcf6a', 0.55 + 0.1 * Math.sin(t * 7 + x));
  rrect(ctx, lx - 5, ly - 6, 10, 13, 3); ctx.fillStyle = open ? '#ffe08a' : '#6b6577'; ctx.fill(); ink(ctx, 1.8);
}
/** Over the characters: the lintel + name plate across each gate, the lock seal, and the travel prompt. */
const nearestGate = (p) => { let b = null, bd = 1e9; for (const q of GATES) { const o = gatePos(q), d = Math.hypot(p.x - o.x, p.y - o.y); if (d < bd) { bd = d; b = q; } } return b; };
export function drawGateOver(ctx, t, local) {
  for (const g of GATES) {
    const { x, y } = gatePos(g), open = gateOpen(g), ly = y - 104;
    rrect(ctx, x - 62, ly - 14, 124, 22, 6); ctx.fillStyle = lgrad(ctx, x, ly - 3, 62, '#e8d6ae'); ctx.fill(); ink(ctx, 3);
    ctx.beginPath(); ctx.moveTo(x - 56, ly - 10); ctx.lineTo(x + 54, ly - 10); ctx.strokeStyle = 'rgba(255,250,232,.8)'; ctx.lineWidth = 1.8; ctx.stroke();
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sd * 7, ly - 5); ctx.quadraticCurveTo(x + sd * 26, ly - 14, x + sd * 40, ly - 6); ctx.quadraticCurveTo(x + sd * 24, ly - 2, x + sd * 7, ly + 1); ctx.closePath(); ctx.fillStyle = open ? '#f2c14a' : '#8d8798'; ctx.fill(); ink(ctx, 1.6); }
    ball(ctx, x, ly - 3, 7, open ? g.col : '#8d8798', LA, 2);
    rrect(ctx, x - 70, ly + 12, 140, 34, 8); ctx.fillStyle = 'rgba(43,36,51,.82)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = open ? g.col : '#77708a'; ctx.stroke();
    ctx.font = `15px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = open ? '#fff' : '#b9b3c6'; ctx.fillText(g.name.toUpperCase(), x, ly + 28);
    ctx.font = `11px ${FONT}`; ctx.fillStyle = open ? g.col : '#9a93ab'; ctx.fillText(open ? g.sub : 'SEALED', x, ly + 41);
    if (!open) {
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x - 40, y - 10 + sd * 6); ctx.lineTo(x + 40, y - 10 - sd * 6); ctx.setLineDash([6, 4]); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#9aa1ab'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]); }
      rrect(ctx, x - 9, y - 18, 18, 15, 3); ctx.fillStyle = lgrad(ctx, x, y - 10, 9, '#d9a33a'); ctx.fill(); ink(ctx, 2);
      ctx.beginPath(); ctx.arc(x, y - 18, 5, Math.PI, TAU); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
    }
    if (local && g === nearestGate(local) && Math.hypot(local.x - x, local.y - y) < 120) { // (only the nearest gate's prompt)
      const s = open ? `Walk into the portal: ${g.name}` : g.lockText;
      ctx.font = `14px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(s, x, y + 52); ctx.fillStyle = open ? '#ffe9a0' : '#ff9a8a'; ctx.fillText(s, x, y + 52);
    }
  }
}

// ------------------------------------------------------------------ minimap (the whole Dunes disc)
export function drawDunesMinimap(ctx, x, y, R, sim, p, CLASSES, pings) {
  const k = R / (DUNES_R + 40), X = (wx) => x + (wx - DP.x) * k, Y = (wy) => y + (wy - DP.y) * k;
  circle(ctx, x, y, R + 5, INK, 0);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
  ctx.fillStyle = '#4db6e8'; ctx.fillRect(x - R, y - R, R * 2, R * 2);
  const g = ctx.createRadialGradient(x, y, 0, x, y, DUNES_R * k); for (const [kk, c] of SAND_STOPS) g.addColorStop(kk, c);
  ctx.beginPath(); ctx.arc(x, y, DUNES_R * k, 0, TAU); ctx.fillStyle = g; ctx.fill();
  for (const z of DUNES_ZONES) if (z.r0 > 0) circle(ctx, x, y, z.r0 * k, null, 1, 'rgba(70,35,15,.4)');
  circle(ctx, x, y, 270 * k, '#79bf55', 0); ctx.beginPath(); ctx.ellipse(x, y, 150 * k, 105 * k, 0, 0, TAU); ctx.fillStyle = '#2aa0d0'; ctx.fill();
  circle(ctx, X(OP.x), Y(OP.y), OVERLORD_R * k, '#9a6a3a', 1, INK);
  ctx.fillStyle = 'rgba(120,70,30,.6)';
  for (const o of sim.world.obstacles) if (o.dunes && (o.kind === 'sandrock' || o.kind === 'ruin')) ctx.fillRect(X(o.x) - 1.5, Y(o.y) - 1.5, 3, 3);
  for (const b of sim.bags) if (b.ownerId === p.id) { ctx.fillStyle = ['#e8d2b0', '#4aa8ff', '#b86bff', '#ffb52e', '#2ee6c4', '#ff4f7b'][b.rarity] || '#fff'; ctx.fillRect(X(b.x) - 2, Y(b.y) - 2, 4, 4); }
  for (const e of sim.enemies) { if (e.boss || Math.abs(e.x - p.x) > 700 || Math.abs(e.y - p.y) > 700) continue; ctx.fillStyle = e.elite ? '#ffcf3a' : '#ff4d4d'; ctx.fillRect(X(e.x) - 1.5, Y(e.y) - 1.5, 3, 3); }
  const D = dunesState(sim);
  if (D) for (const [px, py] of D.tp || []) circle(ctx, X(px), Y(py), 4 + 2 * (0.5 + 0.5 * Math.sin(performance.now() / 150)), '#2ee6c4', 2);
  if (sim.players) for (const q of sim.players.values()) { if (q.id === p.id || q.dead) continue; circle(ctx, X(q.x), Y(q.y), 3.5, CLASSES[q.cls] ? CLASSES[q.cls].color : '#fff', 1.5); }
  if (pings) for (const pg of pings) circle(ctx, X(pg.x), Y(pg.y), 5, '#ffd23f', 2);
  ctx.restore();
  const boss = sim.enemies.find((e) => e.type === 'khepra');
  ctx.save(); ctx.translate(X(OP.x), Y(OP.y)); circle(ctx, 0, 0, 6, boss ? '#ff5e5b' : 'rgba(255,255,255,.4)', 2); circle(ctx, -2, -1, 1.4, INK, 0); circle(ctx, 2, -1, 1.4, INK, 0); ctx.restore();
  ctx.save(); ctx.translate(X(p.x), Y(p.y)); ctx.rotate(p.aim || 0); ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-3, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  circle(ctx, x, y, R + 3, null, 5, INK); circle(ctx, x, y, R, null, 2, 'rgba(255,255,255,.35)');
}

// ------------------------------------------------------------------ events
export function dunesEventFx(fx, ev, me) {
  switch (ev.ph) {
    case 'erupt': { const r = ev.r || 95, big = !!ev.big; fx.ring(ev.x, ev.y, r, '#e8c88a', 0.5, big ? 12 : 8); fx.ring(ev.x, ev.y, r * 0.6, '#fff4d6', 0.35, 5); fx.puffs(ev.x, ev.y, big ? 26 : 14, '#e2b775', big ? 22 : 15, big ? 320 : 220, 0.8); fx.sparks(ev.x, ev.y, 0, big ? 22 : 12, '#c99a5e', 380, TAU); fx.shake(big ? 0.6 : 0.25); break; }
    case 'dive': fx.puffs(ev.x, ev.y, ev.big ? 18 : 9, '#d9ac6c', ev.big ? 18 : 12, 160, 0.6); fx.ring(ev.x, ev.y, ev.big ? 110 : 55, '#c99a5e', 0.4, 5); break;
    case 'fade': case 'shatter': fx.sparks(ev.x, ev.y, 0, 16, '#cff6ff', 320, TAU); fx.sparks(ev.x, ev.y, 0, 8, '#ff7ad9', 240, TAU); fx.ring(ev.x, ev.y, 40, '#8ff3ff', 0.3, 4); if (ev.ph === 'shatter') fx.text(ev.x, ev.y - 30, 'MIRAGE!', { size: 18, color: '#8ff3ff', vy: -40, life: 0.8 }); break;
    case 'mirrorWind': fx.ring(ev.x, ev.y, 70, '#8ff3ff', 0.6, 4); break;
    case 'mirror': fx.ring(ev.x, ev.y, 90, '#cff6ff', 0.45, 6); for (const [x, y] of ev.pts || []) { fx.sparks(x, y, 0, 10, '#cff6ff', 260, TAU); fx.ring(x, y, 34, '#8ff3ff', 0.35, 4); } break;
    case 'unravel': fx.puffs(ev.x, ev.y, 10, '#e9dcb8', 12, 150, 0.7); fx.text(ev.x, ev.y - 36, 'UNRAVELLED', { size: 16, color: '#ff9a6a', vy: -30, life: 0.9 }); break;
    case 'queenRoar': fx.shake(0.7); fx.ring(ev.x, ev.y, 260, '#ffb347', 0.7, 10); fx.puffs(ev.x, ev.y, 30, '#e2b775', 24, 360, 1); fx.banner(ev.phase === 3 ? 'THE QUEEN IS ENRAGED' : 'THE QUEEN BURROWS DEEPER', '#ffb347', ev.phase === 3 ? 'Faster eruptions, glass storms' : 'Twin eruptions incoming', 2, 36); break;
    case 'brood': fx.puffs(ev.x, ev.y, 14, '#e2b775', 14, 200, 0.7); fx.ring(ev.x, ev.y, 120, '#2fb7a8', 0.4, 5); break;
    case 'split': fx.sparks(ev.x, ev.y, 0, 12, '#2fb7a8', 260, TAU); fx.sparks(ev.x, ev.y, 0, 6, '#ffd36a', 200, TAU); break;
    case 'portal': fx.ring(ev.x, ev.y, ev.big ? 140 : 100, '#2ee6c4', 0.8, 8); fx.ring(ev.x, ev.y, 60, '#ffcf4a', 0.6, 5); fx.sparks(ev.x, ev.y, -Math.PI / 2, 24, '#ffe9a0', 420, 1.6); fx.banner('A TOMB PORTAL OPENS!', '#2ee6c4', 'The Tomb of the Sun-Eaten King: walk in before it closes', 2.6, 40); break;
    case 'glyph': fx.ring(ev.x, ev.y, 34, '#2ee6c4', 0.35, 4); break;
    case 'glyphBurst': { const r = ev.r || 170; fx.ring(ev.x, ev.y, r, '#2ee6c4', 0.45, ev.big ? 12 : 8); fx.ring(ev.x, ev.y, r * 0.55, '#ffcf4a', 0.35, 6); fx.sparks(ev.x, ev.y, 0, ev.big ? 30 : 18, '#bffcf0', 480, TAU); if (ev.big) fx.shake(0.3); if (me) fx.text(ev.x, ev.y - 50, ev.big ? 'SOLAR CASCADE!' : 'SOLAR GLYPH!', { size: ev.big ? 24 : 18, color: '#2ee6c4', vy: -50, pop: 1, life: 1 }); break; }
  }
}
