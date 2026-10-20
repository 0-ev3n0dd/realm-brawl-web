// The Astral Rift art (game loop C3, Map 5), classic code-drawn style (art.js / dunesfx.js kit: light from the upper
// left, gradient fills, rim light, ink outlines). Static (baked into the ground tiles, client/ground.js): the void sea of
// stars round the coast, violet danger bands, star-dust speckle, the roads, the void tears + their star bridges, Starfall
// Camp's floor and the three world-boss arena floors, plus every low prop (shattered ridges, void rocks, star blooms,
// star-silk tents, orbit stones). Tall props (crystal spires, star trees, the Fallen Star, the Sleeping Colossus, moon
// pillars, the Void Monolith) are cached sprites y-sorted with the characters. Live: tears shimmer, the camp beacon,
// starwells breathe, motes drift; the starwell telegraph, the rift enemy aliases and the rift event FX.
import { INK, circle, shadow, rrect, shade, ENEMY_DRAW } from './art.js';
import { bloom } from './fxglow.js';
import './riftart.js'; // (2026-10-15: the Rift's own creature bodies; registers before the alias fallback below)
import { lgrad, ink } from './dunesfx.js';
import { shapePath, roadPath } from './wildsfx.js';
import { sprite, blit } from './sprite.js';
import { RIFT_SHAPE as RS, RIFT_RINGS, RIFT_ROADS, RIFT_CAMP, RIFT_CAMP_R, RIFT_SITES, RIFT_BOUNDS, RIFT_RR, RIFT_TEARS, RIFT_BRIDGES, RIFT_WELLS, TEAR_W, inRiftArea } from '../sim/riftconst.js';

const TAU = Math.PI * 2;
const H = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const RB = RIFT_BOUNDS, PADV = 900;
export const riftVisible = (view) => view.x1 > RB.x0 - PADV && view.x0 < RB.x1 + PADV && view.y1 > RB.y0 - PADV && view.y0 < RB.y1 + PADV;
const inRB = (x, y) => x > RB.x0 - 400 && x < RB.x1 + 400 && y > RB.y0 - 400 && y < RB.y1 + 400;
/** ground per danger band (camp, D4 steppe, D5 barrens, D6 reaches, D7 the Breach) */
export const RIFT_BANDS = ['#8a84b8', '#7a72a8', '#675e98', '#544a86', '#3f3570'];
export const RIFT_SEA = '#0e0a24';
const near = (view, P, r) => view.y0 < P.y + r && view.y1 > P.y - r && view.x0 < P.x + r && view.x1 > P.x - r;
let RROADS = null, RTEARS = null;
const tearPaths = () => RTEARS || (RTEARS = RIFT_TEARS.map(roadPath));

// ------------------------------------------------------------------ the static ground (baked into tiles)
export function paintRiftStatic(g, view) {
  if (!riftVisible(view)) return false;
  voidSea(g, view);
  g.fillStyle = '#2a2250'; g.fill(shapePath(RS, RIFT_RR, RS.shore), 'evenodd'); // the crumbling shelf
  g.lineWidth = 6; g.strokeStyle = 'rgba(180,140,255,.6)'; g.stroke(shapePath(RS, RIFT_RR, RS.shore));
  g.fillStyle = '#3a3068'; g.fill(shapePath(RS, RIFT_RR, 30), 'evenodd');
  g.save(); g.clip(shapePath(RS, RIFT_RR, 8), 'evenodd');
  const R = RIFT_RINGS;
  g.fillStyle = RIFT_BANDS[R.length - 1]; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  for (let i = R.length - 2; i >= 1; i--) { g.fillStyle = RIFT_BANDS[i]; g.fill(shapePath(RS, R[i], 0), 'evenodd'); }
  for (let i = 1; i < R.length - 1; i++) { g.lineWidth = 34; g.strokeStyle = 'rgba(230,220,255,.07)'; g.stroke(shapePath(RS, R[i] - 18, 0)); g.strokeStyle = 'rgba(10,6,30,.12)'; g.stroke(shapePath(RS, R[i] + 18, 0)); }
  dust(g, view);
  if (!RROADS) RROADS = RIFT_ROADS.map(roadPath);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const p of RROADS) {
    g.strokeStyle = 'rgba(10,6,30,.3)'; g.lineWidth = 96; g.stroke(p);
    g.strokeStyle = '#a69cd0'; g.lineWidth = 76; g.stroke(p);
    g.strokeStyle = 'rgba(255,240,180,.35)'; g.lineWidth = 3; g.setLineDash([4, 30]);
    g.save(); g.translate(-14, 0); g.stroke(p); g.restore(); g.save(); g.translate(14, 6); g.stroke(p); g.restore(); g.setLineDash([]);
  }
  tears(g);
  for (const b of RIFT_BRIDGES) if (near(view, b, 200)) bridge(g, b);
  g.restore();
  for (let i = 1; i < R.length - 1; i++) {
    const p = shapePath(RS, R[i], 0);
    g.strokeStyle = 'rgba(10,6,30,.25)'; g.lineWidth = 11; g.stroke(p);
    g.setLineDash([26, 20]); g.strokeStyle = 'rgba(200,170,255,.75)'; g.lineWidth = 4; g.stroke(p); g.setLineDash([]);
  }
  g.lineWidth = 4; g.strokeStyle = 'rgba(10,6,30,.5)'; g.stroke(shapePath(RS, RIFT_RR, 10));
  if (near(view, RIFT_CAMP, RIFT_CAMP_R + 80)) campFloor(g);
  const S = RIFT_SITES;
  if (near(view, S.zerath, S.zerath.r + 140)) breachFloor(g, S.zerath);
  if (near(view, S.orrery, S.orrery.r + 140)) orreryFloor(g, S.orrery);
  if (near(view, S.nyxara, S.nyxara.r + 140)) observatoryFloor(g, S.nyxara);
  if (near(view, S.star, 340)) { g.beginPath(); g.ellipse(S.star.x, S.star.y, 260, 170, 0, 0, TAU); g.fillStyle = 'rgba(20,10,40,.28)'; g.fill(); g.beginPath(); g.ellipse(S.star.x, S.star.y, 200, 130, 0, 0, TAU); g.strokeStyle = 'rgba(255,226,122,.35)'; g.lineWidth = 6; g.stroke(); }
  if (near(view, S.shrine, 260)) { g.beginPath(); g.arc(S.shrine.x, S.shrine.y, S.shrine.r + 40, 0, TAU); g.fillStyle = 'rgba(220,230,255,.14)'; g.fill(); }
  return true;
}
function voidSea(g, view) { // the island floats in the void: deep violet with baked stars + faint nebula wisps
  const x0 = view.x0, y0 = view.y0, W = view.x1 - x0, Hh = view.y1 - y0;
  g.fillStyle = RIFT_SEA; g.fillRect(x0, y0, W, Hh);
  const C = 260, i0 = Math.floor(x0 / C), j0 = Math.floor(y0 / C), i1 = Math.ceil(view.x1 / C), j1 = Math.ceil(view.y1 / C);
  const neb = new Path2D(), st = new Path2D(), big = new Path2D();
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const h = H(i, j);
    if (h < 0.18) neb.ellipse(i * C + H(j, i) * C, j * C + h * C * 4, 220, 90, H(i + 7, j) * TAU, 0, TAU);
    for (let k = 0; k < 4; k++) { const sx = i * C + H(i * 4 + k, j) * C, sy = j * C + H(j * 4 + k, i) * C; st.rect(sx, sy, 2.2, 2.2); }
    if (h > 0.86) { const sx = i * C + H(j + 3, i) * C, sy = j * C + H(i + 3, j) * C; big.moveTo(sx + 6, sy); big.arc(sx, sy, 6, 0, TAU); }
  }
  g.fillStyle = 'rgba(120,70,200,.16)'; g.fill(neb);
  g.fillStyle = 'rgba(230,220,255,.8)'; g.fill(st);
  g.fillStyle = 'rgba(255,240,180,.9)'; g.fill(big);
}
function dust(g, view) { // pale star-dust flecks + dark void grit (two batched fills)
  const C = 90, i0 = Math.floor(view.x0 / C), j0 = Math.floor(view.y0 / C), i1 = Math.ceil(view.x1 / C), j1 = Math.ceil(view.y1 / C);
  const lt = new Path2D(), dk = new Path2D();
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const h = H(i * 3, j * 5); if (h > 0.55) continue;
    const x = i * C + H(i, j) * C, y = j * C + H(j, i) * C;
    if (h < 0.3) lt.rect(x, y, 3, 3); else dk.rect(x, y, 4, 2.5);
  }
  g.fillStyle = 'rgba(235,225,255,.45)'; g.fill(lt); g.fillStyle = 'rgba(20,12,50,.3)'; g.fill(dk);
}
function tears(g) { // the void tears: a ragged dark rim, the starry void inside, a violet glow edge
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const p of tearPaths()) {
    g.strokeStyle = '#1a1238'; g.lineWidth = TEAR_W + 34; g.stroke(p);
    g.strokeStyle = 'rgba(180,140,255,.45)'; g.lineWidth = TEAR_W + 16; g.stroke(p);
    g.strokeStyle = '#08061a'; g.lineWidth = TEAR_W; g.stroke(p);
    g.strokeStyle = 'rgba(90,50,170,.55)'; g.lineWidth = TEAR_W * 0.5; g.stroke(p);
  }
  g.fillStyle = 'rgba(240,235,255,.85)';
  for (const L of RIFT_TEARS) for (let i = 1; i < L.length; i++) {
    const a = L[i - 1], b = L[i], n = Math.max(1, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 50));
    for (let k = 0; k < n; k++) { const t = (k + H(i, k)) / n, x = a.x + (b.x - a.x) * t + (H(k, i) - 0.5) * TEAR_W * 0.6, y = a.y + (b.y - a.y) * t + (H(i * 3, k) - 0.5) * TEAR_W * 0.6; g.fillRect(x, y, 2.5, 2.5); }
  }
}
function bridge(g, b) { // a star-glass bridge across the tear, along the road
  g.save(); g.translate(b.x, b.y); g.rotate(b.ang);
  const L = TEAR_W + 150, W = 92;
  g.fillStyle = 'rgba(10,6,30,.45)'; rrect(g, -L / 2 + 6, -W / 2 + 10, L, W, 14); g.fill();
  rrect(g, -L / 2, -W / 2, L, W, 14); g.fillStyle = lgrad(g, 0, 0, L / 2, '#9a8ad8'); g.fill(); ink(g, 3.5);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2.5; for (let i = 1; i < 6; i++) { const x = -L / 2 + (L / 6) * i; g.beginPath(); g.moveTo(x, -W / 2 + 4); g.lineTo(x + (H(i, 3) - 0.5) * 12, W / 2 - 4); g.stroke(); }
  for (const sd of [-1, 1]) { rrect(g, -L / 2 + 8, sd * (W / 2) - 7, L - 16, 14, 6); g.fillStyle = '#5a4a9a'; g.fill(); ink(g, 2.4); for (let i = 0; i < 5; i++) circle(g, -L / 2 + 24 + i * (L - 48) / 4, sd * (W / 2), 6, '#ffe27a', 2.2); }
  g.restore();
}
function campFloor(g) { // Starfall Camp: pale moonstone flags, a ring of star posts
  const C = RIFT_CAMP, r = RIFT_CAMP_R;
  g.beginPath(); g.arc(C.x, C.y, r, 0, TAU); g.fillStyle = '#b8b4d8'; g.fill(); g.lineWidth = 8; g.strokeStyle = 'rgba(30,20,70,.5)'; g.stroke();
  g.strokeStyle = 'rgba(80,60,140,.35)'; g.lineWidth = 3;
  for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(C.x, C.y, r * k / 4, 0, TAU); g.stroke(); }
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; g.beginPath(); g.moveTo(C.x + Math.cos(a) * r * 0.25, C.y + Math.sin(a) * r * 0.25); g.lineTo(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r); g.stroke(); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; circle(g, C.x + Math.cos(a) * (r - 14), C.y + Math.sin(a) * (r - 14), 9, '#ffe27a', 2.5); }
}
function sigilRing(g, S, n, col, r0 = 0.82) { g.lineWidth = 5; g.strokeStyle = col; g.beginPath(); g.arc(S.x, S.y, S.r * r0, 0, TAU); g.stroke(); for (let i = 0; i < n; i++) { const a = (i / n) * TAU; g.beginPath(); g.arc(S.x + Math.cos(a) * S.r * r0, S.y + Math.sin(a) * S.r * r0, 10, 0, TAU); g.fillStyle = col; g.fill(); } }
function breachFloor(g, S) { // Zerath: the heart of the Breach, cracked black glass over the void
  g.beginPath(); g.arc(S.x, S.y, S.r, 0, TAU); g.fillStyle = '#231a48'; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  g.strokeStyle = 'rgba(106,230,255,.55)'; g.lineWidth = 3;
  for (let i = 0; i < 11; i++) { const a = H(i, 9) * TAU; g.beginPath(); g.moveTo(S.x, S.y); g.lineTo(S.x + Math.cos(a) * S.r * 0.5, S.y + Math.sin(a) * S.r * 0.5); g.lineTo(S.x + Math.cos(a + 0.2) * S.r * 0.95, S.y + Math.sin(a + 0.2) * S.r * 0.95); g.stroke(); }
  sigilRing(g, S, 7, 'rgba(180,140,255,.7)');
}
function orreryFloor(g, S) { // the Shattered Orrery: brass orbit rings inlaid in moonstone
  g.beginPath(); g.arc(S.x, S.y, S.r, 0, TAU); g.fillStyle = '#5a5288'; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  for (let k = 1; k <= 4; k++) { g.beginPath(); g.ellipse(S.x, S.y, S.r * k / 4.6, S.r * k / 5.4, 0.3, 0, TAU); g.strokeStyle = 'rgba(255,214,110,.6)'; g.lineWidth = 4; g.stroke(); }
  circle(g, S.x, S.y, 34, '#ffe27a', 4);
}
function observatoryFloor(g, S) { // Nyxara's observatory: a star chart on dark slate
  g.beginPath(); g.arc(S.x, S.y, S.r, 0, TAU); g.fillStyle = '#2e2858'; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  const pts = []; for (let i = 0; i < 9; i++) { const a = H(i, 4) * TAU, r = S.r * (0.2 + 0.7 * H(4, i)); pts.push([S.x + Math.cos(a) * r, S.y + Math.sin(a) * r]); }
  g.strokeStyle = 'rgba(200,180,255,.55)'; g.lineWidth = 2.5; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  for (const [x, y] of pts) circle(g, x, y, 6, '#ffffff', 0);
  sigilRing(g, S, 5, 'rgba(176,108,255,.6)', 0.9);
}

// ------------------------------------------------------------------ decor (baked)
export function drawRiftDecor(g, d) {
  const x = d.x, y = d.y, s = d.size, v = d.variant || 0;
  switch (d.kind) {
    case 'stardust': for (let i = 0; i < 6; i++) { const a = H(v, i) * TAU, r = H(i, v) * s; circle(g, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 1.6 + H(i, 2) * 2, i % 3 ? '#e8dcff' : '#ffe27a', 0); } return true;
    case 'moonmoss': g.beginPath(); g.ellipse(x, y, s, s * 0.5, H(v, 1), 0, TAU); g.fillStyle = 'rgba(160,220,255,.35)'; g.fill(); for (let i = 0; i < 4; i++) circle(g, x + (H(v, i) - 0.5) * s, y + (H(i, v) - 0.5) * s * 0.4, 3, '#bfe8ff', 0); return true;
    case 'voidcrack': {
      g.lineCap = 'round'; g.beginPath(); const a0 = H(v, 2) * TAU;
      for (let b = 0; b < 3; b++) { const a = a0 + b * 2.1; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.42); g.lineTo(x + Math.cos(a + 0.4) * s * 1.2, y + Math.sin(a + 0.4) * s * 0.84); }
      g.strokeStyle = 'rgba(8,6,26,.7)'; g.lineWidth = 5; g.stroke(); g.strokeStyle = '#9a6aff'; g.lineWidth = 2; g.stroke(); return true;
    }
    case 'shards': for (let i = 0; i < 3; i++) { const a = H(v, i) * TAU, r = H(i, v) * s * 0.7, sx = x + Math.cos(a) * r, sy = y + Math.sin(a) * r * 0.6; g.beginPath(); g.moveTo(sx - 5, sy + 3); g.lineTo(sx, sy - 10); g.lineTo(sx + 5, sy + 3); g.closePath(); g.fillStyle = '#9ad8ff'; g.fill(); ink(g, 1.6); } return true;
    case 'starwell': { // a ring of moonstone round a pool of starlight (the eruption is a telegraph)
      g.beginPath(); g.arc(x, y, s * 0.75, 0, TAU); g.fillStyle = lgrad(g, x, y, s * 0.75, '#8a80c0'); g.fill(); ink(g, 3);
      g.beginPath(); g.arc(x, y, s * 0.5, 0, TAU); const gr = g.createRadialGradient(x, y, 2, x, y, s * 0.5); gr.addColorStop(0, '#fff8d0'); gr.addColorStop(0.5, '#b48cff'); gr.addColorStop(1, '#2a1a5a'); g.fillStyle = gr; g.fill(); ink(g, 2.4);
      return true;
    }
    case 'moonshrine': {
      g.beginPath(); g.arc(x, y, s + 10, 0, TAU); g.fillStyle = lgrad(g, x, y, s + 10, '#c8c4e8'); g.fill(); ink(g, 3.5);
      g.beginPath(); g.arc(x, y, s - 18, 0, TAU); g.fillStyle = '#5a5090'; g.fill(); ink(g, 2.6);
      g.beginPath(); g.arc(x, y, 34, 0, TAU); g.fillStyle = '#f4f0ff'; g.fill(); ink(g, 3); g.beginPath(); g.arc(x + 12, y - 6, 28, 0, TAU); g.fillStyle = '#5a5090'; g.fill();
      return true;
    }
    case 'starbeacon': {
      g.beginPath(); g.arc(x, y, s * 0.8, 0, TAU); g.fillStyle = '#4a4080'; g.fill(); ink(g, 3);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, sx = x + Math.cos(a) * s * 0.8, sy = y + Math.sin(a) * s * 0.66; g.beginPath(); g.ellipse(sx, sy, 11, 9, a, 0, TAU); g.fillStyle = lgrad(g, sx, sy, 11, '#c8c0f0'); g.fill(); ink(g, 2); }
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------ obstacles
/** low rift props baked into the ground tiles */
export const RIFT_BAKE = new Set(['voidcliff', 'voidrock', 'starbloom', 'startent', 'orbitstone']);
/** tall rift props: cached sprites, y-sorted with the characters */
export const RIFT_TALL = new Set(['riftspire', 'startree', 'fallenstar', 'colossus', 'moonpillar', 'monolith']);
function blob(g, x, y, s, n, v, sq = 0.78) { g.beginPath(); for (let i = 0; i < n; i++) { const a = (i / n) * TAU + v * 0.37, r = s * (0.8 + H(v, i) * 0.32), px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * sq; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath(); }
export function drawRiftBaked(g, o) {
  const x = o.x, y = o.y, s = o.size, v = o.variant || 0;
  switch (o.kind) {
    case 'voidcliff': { // a shattered ridge of dark violet glass slabs
      blob(g, x + 5, y + 8, s, 7, v); g.fillStyle = 'rgba(10,6,30,.35)'; g.fill();
      blob(g, x, y, s, 7, v); g.fillStyle = lgrad(g, x, y, s, '#4a3e7e'); g.fill(); ink(g, 3.5);
      for (let i = 0; i < 3; i++) { const a = H(v, i) * TAU, r = s * 0.45; g.beginPath(); g.moveTo(x + Math.cos(a) * r - 10, y + Math.sin(a) * r * 0.7 + 6); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7 - 18); g.lineTo(x + Math.cos(a) * r + 10, y + Math.sin(a) * r * 0.7 + 6); g.closePath(); g.fillStyle = '#7a68c0'; g.fill(); ink(g, 2); }
      return true;
    }
    case 'voidrock': blob(g, x + 4, y + 6, s, 6, v); g.fillStyle = 'rgba(10,6,30,.3)'; g.fill(); blob(g, x, y, s, 6, v); g.fillStyle = lgrad(g, x, y, s, '#5e5490'); g.fill(); ink(g, 3); g.beginPath(); g.moveTo(x - s * 0.4, y - s * 0.1); g.lineTo(x + s * 0.2, y + s * 0.2); g.strokeStyle = '#b48cff'; g.lineWidth = 2; g.stroke(); return true;
    case 'starbloom': for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + v; g.beginPath(); g.ellipse(x + Math.cos(a) * s * 0.4, y + Math.sin(a) * s * 0.3, s * 0.42, s * 0.2, a, 0, TAU); g.fillStyle = i % 2 ? '#c9a8ff' : '#9ad8ff'; g.fill(); ink(g, 2); } circle(g, x, y, s * 0.22, '#ffe27a', 2.4); return true;
    case 'startent': { g.beginPath(); g.moveTo(x - s, y + s * 0.5); g.lineTo(x, y - s * 0.7); g.lineTo(x + s, y + s * 0.5); g.closePath(); g.fillStyle = lgrad(g, x, y, s, '#e8e0ff'); g.fill(); ink(g, 3); g.beginPath(); g.moveTo(x, y - s * 0.7); g.lineTo(x, y + s * 0.5); g.strokeStyle = '#8a7ac8'; g.lineWidth = 2.5; g.stroke(); circle(g, x, y - s * 0.7, 6, '#ffe27a', 2); return true; }
    case 'orbitstone': { g.beginPath(); g.ellipse(x, y, s * 0.7, s * 0.5, 0, 0, TAU); g.fillStyle = lgrad(g, x, y, s * 0.7, '#9a90c8'); g.fill(); ink(g, 3); g.beginPath(); g.ellipse(x, y, s * 0.95, s * 0.3, 0.4, 0, TAU); g.strokeStyle = '#ffd66e'; g.lineWidth = 3; g.stroke(); return true; }
  }
  return false;
}
function crystal(g, x, y, h, w, col) {
  g.beginPath(); g.moveTo(x - w, y); g.lineTo(x - w * 0.6, y - h * 0.75); g.lineTo(x, y - h); g.lineTo(x + w * 0.6, y - h * 0.72); g.lineTo(x + w, y); g.lineTo(x, y + w * 0.4); g.closePath();
  const gr = g.createLinearGradient(x - w, 0, x + w, 0); gr.addColorStop(0, shade(col, 0.45)); gr.addColorStop(0.48, col); gr.addColorStop(0.52, shade(col, -0.25)); gr.addColorStop(1, shade(col, -0.45)); g.fillStyle = gr; g.fill(); ink(g, 3);
  g.beginPath(); g.moveTo(x - w * 0.5, y - h * 0.1); g.lineTo(x - w * 0.35, y - h * 0.62); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.stroke();
}
function starShape(g, x, y, r1, r2, n = 5, rot = -Math.PI / 2) { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * TAU, r = i % 2 ? r2 : r1; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); }
const TALL_FN = {
  riftspire(g, o) { const s = o.size; shadow(g, 4, s * 0.15, s * 0.8, s * 0.28, 0.28); crystal(g, -s * 0.32, 0, s * 1.0, s * 0.24, '#7a5ae0'); crystal(g, s * 0.3, 0, s * 0.85, s * 0.22, '#5aa8e8'); crystal(g, 0, 4, s * 1.6, s * 0.32, '#9a7af0'); },
  startree(g, o) { const s = o.size; shadow(g, 4, s * 0.2, s * 0.9, s * 0.3, 0.25); rrect(g, -s * 0.1, -s * 0.9, s * 0.2, s * 0.9, 4); g.fillStyle = lgrad(g, 0, -s * 0.5, s * 0.5, '#4a3e7a'); g.fill(); ink(g, 2.6);
    for (const [dx, dy, r] of [[-s * 0.4, -s * 1.1, s * 0.42], [s * 0.38, -s * 1.15, s * 0.4], [0, -s * 1.45, s * 0.5]]) { g.beginPath(); g.arc(dx, dy, r, 0, TAU); g.fillStyle = lgrad(g, dx, dy, r, '#6a8ae0'); g.fill(); ink(g, 2.6); }
    for (let i = 0; i < 4; i++) { starShape(g, (H(o.variant, i) - 0.5) * s, -s * (1.0 + H(i, o.variant) * 0.6), 6, 2.6); g.fillStyle = '#fff4b0'; g.fill(); } },
  fallenstar(g, o) { const s = o.size; shadow(g, 6, s * 0.3, s * 1.3, s * 0.4, 0.3); starShape(g, 0, -s * 0.6, s * 0.95, s * 0.42, 5, -Math.PI / 2 + 0.25); const gr = g.createRadialGradient(-s * 0.2, -s * 0.8, 4, 0, -s * 0.6, s); gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.6, '#ffd84a'); gr.addColorStop(1, '#d8901a'); g.fillStyle = gr; g.fill(); ink(g, 4); },
  colossus(g, o) { const s = o.size; shadow(g, 6, s * 0.4, s * 1.3, s * 0.4, 0.3); g.beginPath(); g.ellipse(0, -s * 0.6, s * 1.05, s * 0.85, 0, 0, TAU); g.fillStyle = lgrad(g, 0, -s * 0.6, s, '#9a94c0'); g.fill(); ink(g, 4);
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * s * 0.55, -s * 0.75); g.lineTo(sd * s * 0.2, -s * 0.7); g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); }
    g.beginPath(); g.moveTo(-s * 0.1, -s * 0.55); g.lineTo(0, -s * 0.35); g.lineTo(s * 0.1, -s * 0.55); g.stroke(); g.beginPath(); g.moveTo(-s * 0.3, -s * 0.15); g.lineTo(s * 0.3, -s * 0.15); g.stroke();
    g.beginPath(); g.moveTo(-s * 0.7, -s * 1.2); g.lineTo(-s * 0.3, -s * 0.9); g.strokeStyle = '#b48cff'; g.lineWidth = 3; g.stroke(); },
  moonpillar(g, o) { const s = o.size; shadow(g, 3, s * 0.15, s * 0.5, s * 0.2, 0.25); rrect(g, -s * 0.3, -s * 2.0, s * 0.6, s * 2.0, 4); g.fillStyle = lgrad(g, 0, -s, s * 0.6, '#d0ccf0'); g.fill(); ink(g, 2.6); g.beginPath(); g.arc(0, -s * 2.2, s * 0.3, 0, TAU); g.fillStyle = '#f4f0ff'; g.fill(); ink(g, 2.4); },
  monolith(g, o) { const s = o.size; shadow(g, 8, s * 0.2, s * 0.9, s * 0.32, 0.3); g.beginPath(); g.moveTo(-s * 0.42, 0); g.lineTo(-s * 0.32, -s * 2.4); g.lineTo(s * 0.32, -s * 2.5); g.lineTo(s * 0.42, 0); g.closePath(); g.fillStyle = lgrad(g, 0, -s, s, '#1e1838'); g.fill(); ink(g, 3.5);
    g.strokeStyle = '#b48cff'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0, -s * (0.6 + i * 0.45), s * 0.1, 0, TAU); g.stroke(); } },
};
export function drawRiftObstacle(ctx, o, t) {
  if (!o.rift) return false;
  if (!RIFT_TALL.has(o.kind)) return RIFT_BAKE.has(o.kind);
  const s = o.size, v = (o.variant || 0) % 6, W = Math.ceil(s * 4 + 60), Ht = Math.ceil(s * 6 + 80);
  const c = sprite(`rp:${o.kind}:${v}:${s}`, W, Ht, W / 2, Ht * 0.78, (g) => TALL_FN[o.kind](g, { ...o, x: 0, y: 0, variant: v }));
  blit(ctx, c, o.x, o.y);
  if (o.kind === 'fallenstar') bloom(ctx, o.x, o.y - s * 0.6, s * 1.6, '#ffd84a', 0.45 + 0.12 * Math.sin(t * 2.4));
  else if (o.kind === 'monolith') bloom(ctx, o.x, o.y - s * 1.4, s, '#b48cff', 0.3 + 0.12 * Math.sin(t * 2));
  else if (o.kind === 'riftspire' && s > 40) bloom(ctx, o.x, o.y - s, s * 0.8, '#9a7af0', 0.22);
  return true;
}

// ------------------------------------------------------------------ live overlays (cheap, every frame)
export function drawRiftLive(ctx, view, t) {
  if (!riftVisible(view)) return false;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([20, 90]); ctx.lineDashOffset = -t * 40;
  ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 1.8); ctx.strokeStyle = '#c9a8ff'; ctx.lineWidth = TEAR_W * 0.12;
  const P = tearPaths();
  for (let i = 0; i < P.length; i++) { const L = RIFT_TEARS[i]; let vis = false; for (const q of L) if (q.x > view.x0 - 300 && q.x < view.x1 + 300 && q.y > view.y0 - 300 && q.y < view.y1 + 300) { vis = true; break; } if (vis) ctx.stroke(P[i]); }
  ctx.restore();
  const C = RIFT_CAMP;
  if (near(view, C, 400)) { const f = 0.6 + 0.3 * Math.sin(t * 3); bloom(ctx, C.x, C.y, 170, '#c9a8ff', 0.4 * f); ctx.save(); ctx.translate(C.x, C.y - 40 + Math.sin(t * 2) * 6); ctx.rotate(t * 0.8); starShape(ctx, 0, 0, 22, 9); ctx.fillStyle = '#fff4b0'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); }
  for (const v of RIFT_WELLS) {
    if (!near(view, v, 160)) continue;
    bloom(ctx, v.x, v.y, v.r * 0.9, '#b48cff', 0.25 + 0.1 * Math.sin(t * 2 + v.ph));
    for (let i = 0; i < 3; i++) { const ph = (t * 0.4 + i / 3 + v.ph * 0.01) % 1; ctx.globalAlpha = 0.6 * (1 - ph); circle(ctx, v.x + Math.sin(t + i * 2) * 10, v.y - ph * 80, 3, '#fff4b0', 0); }
    ctx.globalAlpha = 1;
  }
  return true;
}
/** over the characters: drifting star motes (more in the Breach) */
export function drawRiftOver(ctx, sim, local, view, t, lite) {
  if (!riftVisible(view) || !local || !inRiftArea(local.x, local.y, 600)) return;
  const re = RS.re(local.x, local.y), n = lite ? 14 : re > RIFT_RINGS[3] ? 50 : 30;
  const W = view.x1 - view.x0, Hh = view.y1 - view.y0;
  for (let i = 0; i < n; i++) {
    const sp = 14 + H(i, 7) * 24, ph = (t * sp + H(i, 3) * Hh) % Hh, x = view.x0 + ((H(i, 1) * W + Math.sin(t * 0.5 + i) * 30) % W + W) % W, y = view.y1 - ph;
    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 3 + i); ctx.fillStyle = i % 4 ? '#e8dcff' : '#ffe27a'; ctx.fillRect(x, y, 2.5, 2.5);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ telegraph kinds (render.js drawArea hook)
// the Rift's own telegraphs: [fill, rim, flash] per kind (circle / line / cone, from the sim area shape)
const RK = { voidpop: ['#5a2a9a', '#c9a8ff', '#f0e0ff'], riftrend: ['#1a6a8a', '#6ae6ff', '#e0fbff'], riftlane: ['#1a6a8a', '#bff8ff', '#ffffff'],
  starseal: ['#6a5a20', '#ffe27a', '#fff6d0'], glassslam: ['#3a1a6a', '#b48cff', '#efe4ff'], voidthread: ['#4a1a6a', '#ff7ad9', '#ffe0f4'],
  voidnova: ['#20103a', '#b06cff', '#f4e8ff'], planet: ['#6a3a10', '#ff9a4a', '#fff0d0'], meteor: ['#7a3a10', '#ffb04a', '#fff4d0'],
  heraldcleave: ['#0d2a4a', '#6ae6ff', '#e0fbff'], rifttear: ['#102a40', '#9ff3ff', '#ffffff'] };
function areaPath(ctx, a, rr) {
  ctx.beginPath();
  if (a.shape === 'line') { const c = Math.cos(a.ang), s = Math.sin(a.ang), w = a.w / 2; ctx.moveTo(a.x - s * w, a.y + c * w); ctx.lineTo(a.x + c * a.len - s * w, a.y + s * a.len + c * w); ctx.lineTo(a.x + c * a.len + s * w, a.y + s * a.len - c * w); ctx.lineTo(a.x + s * w, a.y - c * w); ctx.closePath(); }
  else if (a.shape === 'cone') { ctx.moveTo(a.x, a.y); ctx.arc(a.x, a.y, Math.max(0.1, rr), a.ang - a.arc / 2, a.ang + a.arc / 2); ctx.closePath(); }
  else ctx.arc(a.x, a.y, Math.max(0.1, rr), 0, TAU);
}
function drawRiftKind(ctx, a, t, P) {
  const k = Math.min(1, a.t / Math.max(1, a.delay)); ctx.save();
  if (a.t < a.delay) {
    ctx.globalAlpha = 0.14 + 0.26 * k; ctx.fillStyle = P[0]; areaPath(ctx, a, a.r); ctx.fill();
    ctx.globalAlpha = 0.95; ctx.lineWidth = 3.5; ctx.strokeStyle = P[1]; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -t * 40; areaPath(ctx, a, a.r); ctx.stroke(); ctx.setLineDash([]);
    if (a.shape === 'line') { const c = Math.cos(a.ang), s = Math.sin(a.ang); ctx.lineWidth = 3; ctx.strokeStyle = P[2]; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + c * a.len * k, a.y + s * a.len * k); ctx.stroke(); bloom(ctx, a.x + c * a.len * k, a.y + s * a.len * k, 34, P[1], 0.8); }
    else { ctx.lineWidth = 3; ctx.strokeStyle = P[2]; areaPath(ctx, a, a.r * k); ctx.stroke(); }
    if (a.kind === 'meteor' || a.kind === 'planet') bloom(ctx, a.x - 120 * (1 - k), a.y - 260 * (1 - k), 40 + 30 * k, P[1], 0.6 + 0.4 * k);
    if (a.kind === 'starseal' || a.kind === 'voidthread') { ctx.globalAlpha = 0.8; ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(t * 1.5); ctx.strokeStyle = P[1]; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 6; i++) { const q = i * TAU / 6, q2 = q + TAU / 3; ctx.moveTo(Math.cos(q) * a.r * 0.8, Math.sin(q) * a.r * 0.8); ctx.lineTo(Math.cos(q2) * a.r * 0.8, Math.sin(q2) * a.r * 0.8); } ctx.stroke(); ctx.restore(); }
  } else { const f = Math.max(0, 1 - (a.t - a.delay) / 22); ctx.globalAlpha = 0.75 * f; ctx.fillStyle = P[2]; areaPath(ctx, a, a.r); ctx.fill();
    const cx = a.shape === 'line' ? a.x + Math.cos(a.ang) * a.len / 2 : a.x, cy = a.shape === 'line' ? a.y + Math.sin(a.ang) * a.len / 2 : a.y;
    bloom(ctx, cx, cy, (a.shape === 'line' ? a.len / 2 : a.r) * 1.5, P[1], f); }
  ctx.restore(); return true;
}
export function drawRiftArea(ctx, a, t) {
  const P = RK[a.kind]; if (P) return drawRiftKind(ctx, a, t, P);
  if (a.kind !== 'starwell' || !inRB(a.x, a.y)) return false;
  const k = Math.min(1, a.t / Math.max(1, a.delay));
  ctx.save();
  if (a.t < a.delay) {
    ctx.globalAlpha = 0.16 + 0.24 * k; circle(ctx, a.x, a.y, a.r, '#8a5ae0', 0);
    ctx.globalAlpha = 0.95; ctx.lineWidth = 4; ctx.strokeStyle = '#c9a8ff'; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r * k, 0, TAU); ctx.stroke();
  } else { const f = Math.max(0, 1 - (a.t - a.delay) / 24); ctx.globalAlpha = 0.7 * f; circle(ctx, a.x, a.y, a.r, '#fff4d0', 0); bloom(ctx, a.x, a.y, a.r * 1.6, '#b48cff', f); }
  ctx.restore(); return true;
}

// ------------------------------------------------------------------ enemies: the rift's mobs + bosses reuse classic bodies
// (tinted by their own colours; looked up at call time so later registrations still apply)
const ALIAS = { voidling: 'cinderling', riftstalker: 'wolf', starwisp: 'wisp', voidarcher: 'skeleton', astralknight: 'knight', voidgolem: 'golem', nyxara: 'ankhara', orrery: 'sekhem', zerath: 'raidboss' };
for (const [k, to] of Object.entries(ALIAS)) if (!ENEMY_DRAW[k]) ENEMY_DRAW[k] = (ctx, e, t, col) => { const f = ENEMY_DRAW[to]; if (f) f(ctx, e, t, col); else circle(ctx, 0, 0, e.r, col, 3); };

// ------------------------------------------------------------------ events (fx.js routes {type:'rift'} here)
export const RIFT_UNLOCK_TXT = {
  rift: ['ASTRAL RIFT GATE FOUND', '#c9a8ff', 'Attune it on the Realm Gate map with 2 Cinder Sigils (Pyrrhex Trial)'],
  atr: ['THE ASTRAL RIFT IS OPEN', '#c9a8ff', 'Step through the Realm Gate · Map 5, Lv 41-48'],
  vtx: ['THE RIFT SANCTUM IS CLEARED', '#6ae6ff', 'Replay Vorthax any time · the Astral Sanctum gate is found'],
  ats: ['THE ASTRAL SANCTUM IS OPEN', '#b48cff', 'Astrael awaits · the Lv 50 Trial'],
};
export function riftEventFx(fx, ev, me) {
  const x = ev.x, y = ev.y, has = x != null;
  const lp = fx.sim && fx.sim.players && fx.sim.players.get ? fx.sim.players.get(fx.localPid) : null;
  const mine = lp && ev.pid === lp.id;
  switch (ev.ph) {
    case 'tear': if (mine) { fx.text(lp.x, lp.y - 50, 'THE VOID!', { size: 18, color: '#c9a8ff', vy: -40, life: 0.7 }); fx.puffs(x, y, 5, '#8a5ae0', 10, 120, 0.5); } break;
    case 'blinkOut': if (has) { fx.ring(x, y, 60, '#c9a8ff', 0.3, 5); fx.puffs(x, y, 8, '#5a2a9a', 14, 160, 0.45); } break;
    case 'blinkIn': if (has) { fx.ring(x, y, 70, '#f0e0ff', 0.3, 6); fx.sparks(x, y, 0, 14, '#c9a8ff', 300, Math.PI); } break;
    case 'rend': if (has) { fx.sparks(x, y, ev.ang, 12, '#6ae6ff', 420, 0.5); } break;
    case 'novaCharge': if (has) { fx.ring(x, y, 90, '#ffe9a8', 0.6, 4); fx.text(x, y - 40, '✦', { size: 22, color: '#ffe27a', vy: -30, life: 0.6 }); } break;
    case 'nova': if (has) { fx.ring(x, y, 150, '#fffdf0', 0.4, 8); fx.sparks(x, y, 0, 24, '#ffe27a', 460, Math.PI); } break;
    case 'lane': if (has) { fx.sparks(x, y, ev.ang, 8, '#bff8ff', 380, 0.25); } break;
    case 'seals': if (has) { fx.ring(x, y, 80, '#ffe27a', 0.5, 4); } break;
    case 'gravity': if (has) { fx.ring(x, y, 220, '#b48cff', 0.7, 6); fx.puffs(x, y, 10, '#3a1a6a', 20, 120, 0.7); } break;
    case 'web': if (has) { fx.ring(x, y, 180, '#ff7ad9', 0.6, 5); fx.sparks(x, y, 0, 18, '#ff7ad9', 340, Math.PI); } break;
    case 'eclipse': if (has) { fx.ring(x, y, 320, '#b06cff', 1.0, 10); fx.text(x, y - 120, 'ECLIPSE', { size: 26, color: '#c9a8ff', vy: -20, life: 1.2 }); fx.puffs(x, y, 16, '#20103a', 30, 200, 0.9); } break;
    case 'align': if (has) { fx.ring(x, y, 260, '#ffe27a', 0.8, 7); fx.text(x, y - 130, 'ALIGNMENT', { size: 24, color: '#ffe27a', vy: -20, life: 1.1 }); fx.sparks(x, y, ev.ang || 0, 20, '#ff9a4a', 520, 0.35); } break;
    case 'heraldOut': if (has) { fx.ring(x, y, 120, '#6ae6ff', 0.4, 8); fx.puffs(x, y, 14, '#0d2a4a', 24, 220, 0.6); } break;
    case 'heraldIn': if (has) { fx.ring(x, y, 160, '#e0fbff', 0.4, 9); fx.sparks(x, y, 0, 26, '#6ae6ff', 520, Math.PI); } break;
    case 'grid': if (has) { fx.ring(x, y, 240, '#9ff3ff', 0.7, 5); fx.text(x, y - 110, 'THE SKY TEARS', { size: 22, color: '#9ff3ff', vy: -20, life: 1.1 }); } break;
    case 'well': if (has) { fx.ring(x, y, 110, '#ffe27a', 0.45, 8); fx.sparks(x, y, -Math.PI / 2, 16, '#c9a8ff', 380, 1.4); } break;
  }
}
