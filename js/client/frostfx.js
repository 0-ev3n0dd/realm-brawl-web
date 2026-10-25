// Frostveil Peaks art (world expansion 1), classic code-drawn style (art.js / dunesfx.js kit: light from the upper left,
// gradient fills, rim light, ink outlines). The snow ground (danger bands, sastrugi, crevasses, packed-snow trails, the
// camp, boss arena floors, ice floes in the sea) and every low prop (ice ridges, boulders, pine trunks, tents, ribs,
// rune stones, drifts, bushes) are baked into the ground tiles (client/ground.js); pine canopies go into the merged
// canopy layer; tall props (crystals, the Frozen Falls, the Shardglass Spire, the titan skull, arena posts) are cached
// sprites y-sorted with the characters. Also: the Frostveil enemies + bosses, ice / snow bullets, the boss telegraph
// kinds (Stillwind, Glacial Mirror, Shake the Globe, echo ghosts, wraith statues, Whiteout), snowfall, Crypt portals,
// the Frostveil event FX. The Glacier Crypt itself is client/cryptfx.js.
import { INK, circle, shadow, rrect, shade, star, ENEMY_DRAW, ENEMY_ANIM } from './art.js';
import { bloom } from './fxglow.js';
import { lgrad, ball, oval, ink, rimArc } from './dunesfx.js';
import { shapePath, roadPath } from './wildsfx.js';
import { sprite, blit } from './sprite.js';
import { FROST_SHAPE as FS, FROST_RINGS, FROST_ROADS, FROST_CAMP, FROST_CAMP_R, FROST_SITES, FROST_BOUNDS, FROST_RR, inFrostArea } from '../sim/frostconst.js';
import { CPORTAL } from '../sim/frost.js';

const TAU = Math.PI * 2, LA = -2.3, FONT = "'Lilita One', sans-serif";
const H = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const FB = FROST_BOUNDS, PADV = 700;
export const frostVisible = (view) => view.x1 > FB.x0 - PADV && view.x0 < FB.x1 + PADV && view.y1 > FB.y0 - PADV && view.y0 < FB.y1 + PADV;
/** snow per danger band (camp, D4 tundra, D5 taiga, D6 glacier, D7 crown) */
export const SNOW_BANDS = ['#f4efe4', '#eef4f8', '#e2ecf1', '#d3e7f5', '#c9d3ee'];
const near = (view, P, r) => view.y0 < P.y + r && view.y1 > P.y - r && view.x0 < P.x + r && view.x1 > P.x - r;
let FROADS = null;

// ------------------------------------------------------------------ the static ground (baked into tiles)
export function paintFrostStatic(g, view) {
  if (!frostVisible(view)) return false;
  floes(g, view);
  g.fillStyle = 'rgba(225,246,255,.55)'; g.fill(shapePath(FS, FROST_RR, 90), 'evenodd'); // shelf ice
  g.fillStyle = '#b9d3e4'; g.fill(shapePath(FS, FROST_RR, FS.shore), 'evenodd');
  g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke(shapePath(FS, FROST_RR, FS.shore));
  g.save(); g.clip(shapePath(FS, FROST_RR, 8), 'evenodd');
  const R = FROST_RINGS;
  g.fillStyle = SNOW_BANDS[R.length - 1]; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  for (let i = R.length - 2; i >= 1; i--) { g.fillStyle = SNOW_BANDS[i]; g.fill(shapePath(FS, R[i], 0), 'evenodd'); }
  for (let i = 1; i < R.length - 1; i++) { g.lineWidth = 34; g.strokeStyle = 'rgba(255,255,255,.22)'; g.stroke(shapePath(FS, R[i] - 18, 0)); g.strokeStyle = 'rgba(60,90,130,.07)'; g.stroke(shapePath(FS, R[i] + 18, 0)); }
  sastrugi(g, view);
  crevasses(g, view);
  if (!FROADS) FROADS = FROST_ROADS.map(roadPath);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const p of FROADS) {
    g.strokeStyle = 'rgba(70,100,140,.16)'; g.lineWidth = 96; g.stroke(p);
    g.strokeStyle = '#dfe8ef'; g.lineWidth = 76; g.stroke(p);
    g.strokeStyle = 'rgba(160,185,210,.5)'; g.lineWidth = 3; g.setLineDash([8, 22]); g.lineDashOffset = 0;
    g.save(); g.translate(-14, 0); g.stroke(p); g.restore(); g.save(); g.translate(14, 6); g.stroke(p); g.restore(); g.setLineDash([]);
  }
  g.restore();
  for (let i = 1; i < R.length - 1; i++) {
    const p = shapePath(FS, R[i], 0);
    g.strokeStyle = 'rgba(40,70,110,.18)'; g.lineWidth = 11; g.stroke(p);
    g.setLineDash([26, 20]); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 4; g.stroke(p); g.setLineDash([]);
  }
  g.lineWidth = 4; g.strokeStyle = 'rgba(40,70,110,.4)'; g.stroke(shapePath(FS, FROST_RR, 10));
  if (near(view, FROST_CAMP, FROST_CAMP_R + 80)) campFloor(g);
  const S = FROST_SITES;
  if (near(view, S.skaldra, S.skaldra.r + 120)) summitFloor(g, S.skaldra);
  if (near(view, S.vyrnhal, S.vyrnhal.r + 120)) echoFloor(g, S.vyrnhal);
  if (near(view, S.morwen, S.morwen.r + 120)) globeFloor(g, S.morwen);
  if (near(view, S.falls, 360)) { g.beginPath(); g.ellipse(S.falls.x, S.falls.y + 110, 230, 90, 0, 0, TAU); g.fillStyle = lgrad(g, S.falls.x, S.falls.y + 110, 230, '#bfe6fa'); g.fill(); ink(g, 3); glints(g, S.falls.x, S.falls.y + 110, 200, 70, 9, 3); }
  if (near(view, S.spire, 300)) { g.beginPath(); g.arc(S.spire.x, S.spire.y, S.spire.r + 40, 0, TAU); g.fillStyle = 'rgba(160,140,255,.16)'; g.fill(); }
  if (near(view, S.ribs, 400)) { g.beginPath(); g.ellipse(S.ribs.x + 60, S.ribs.y, 330, 140, 0, 0, TAU); g.fillStyle = 'rgba(120,110,140,.12)'; g.fill(); }
  return true;
}
function floes(g, view) { // broken pack ice drifting off the coast
  const C = 160;
  g.lineJoin = 'round';
  for (let cx = Math.floor(view.x0 / C); cx <= Math.floor(view.x1 / C); cx++) for (let cy = Math.floor(view.y0 / C); cy <= Math.floor(view.y1 / C); cy++) {
    const h = H(cx * 7 + 3, cy * 13 - 5); if (h > 0.42) continue;
    const x = cx * C + H(cx, cy + 9) * C, y = cy * C + H(cx + 4, cy) * C, d = FS.sd(x, y);
    if (d < 40 || d > 650 || h > 0.42 * (1 - d / 700)) continue;
    const r = 14 + H(cx + 1, cy + 2) * 34, n = 6, pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + h * 9, rr = r * (0.7 + H(cx + i, cy - i) * 0.5); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7]); }
    g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py + 5) : g.moveTo(px, py + 5))); g.closePath(); g.fillStyle = 'rgba(20,60,110,.25)'; g.fill();
    g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fillStyle = '#eef8ff'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = 'rgba(43,36,51,.75)'; g.stroke();
  }
}
function sastrugi(g, view) { // wind-carved snow ridges (one batched stroke per tile)
  const C = 120, lite = new Path2D(), dark = new Path2D();
  for (let cx = Math.floor(view.x0 / C); cx <= Math.floor(view.x1 / C); cx++) for (let cy = Math.floor(view.y0 / C); cy <= Math.floor(view.y1 / C); cy++) {
    const h = H(cx + 911, cy - 17); if (h > 0.55) continue;
    const x = cx * C + H(cx, cy + 5) * C, y = cy * C + H(cx + 3, cy) * C, w = 16 + h * 30;
    lite.moveTo(x - w, y); lite.quadraticCurveTo(x, y - 8, x + w, y + 2);
    dark.moveTo(x - w * 0.8, y + 4); dark.quadraticCurveTo(x, y - 3, x + w * 0.8, y + 6);
  }
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; g.stroke(lite);
  g.strokeStyle = 'rgba(90,130,170,.16)'; g.lineWidth = 2.5; g.stroke(dark);
}
function crevasses(g, view) { // the glacier + the crown: blue cracks in the ice
  const C = 260, p = new Path2D();
  for (let cx = Math.floor(view.x0 / C); cx <= Math.floor(view.x1 / C); cx++) for (let cy = Math.floor(view.y0 / C); cy <= Math.floor(view.y1 / C); cy++) {
    const h = H(cx - 77, cy + 301); if (h > 0.35) continue;
    const x = cx * C + H(cx, cy + 1) * C, y = cy * C + H(cx + 2, cy) * C;
    if (!FS.inside(x, y, -80) || FS.re(x, y) < FROST_RINGS[2] + 60) continue;
    const a = H(cx + 5, cy + 5) * Math.PI, L = 40 + h * 140, n = 5;
    p.moveTo(x, y); for (let i = 1; i <= n; i++) { const k = i / n; p.lineTo(x + Math.cos(a) * L * k + (H(cx + i, cy) - 0.5) * 26, y + Math.sin(a) * L * k + (H(cx, cy + i) - 0.5) * 26); }
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = 'rgba(40,90,160,.35)'; g.lineWidth = 6; g.stroke(p);
  g.strokeStyle = 'rgba(120,200,255,.65)'; g.lineWidth = 2.5; g.stroke(p);
}
function glints(g, x, y, rx, ry, n, seed) { for (let i = 0; i < n; i++) { const a = H(seed, i) * TAU, r = Math.sqrt(H(i, seed)); star(g, x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r, 4 + H(i + 3, seed) * 4, 'rgba(255,255,255,.9)', 0); } }
function campFloor(g) { // Hearthstone Camp: trampled warm snow, a ring of stones, log benches
  const { x, y } = FROST_CAMP, R = FROST_CAMP_R;
  g.beginPath(); g.arc(x, y, R, 0, TAU); g.fillStyle = SNOW_BANDS[0]; g.fill();
  g.beginPath(); g.arc(x, y, R * 0.55, 0, TAU); g.fillStyle = '#e8dcc6'; g.fill();
  for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU, sx = x + Math.cos(a) * R, sy = y + Math.sin(a) * R; g.beginPath(); g.ellipse(sx, sy, 15 + H(i, 1) * 6, 11, a, 0, TAU); g.fillStyle = lgrad(g, sx, sy, 16, '#a9b2bf'); g.fill(); ink(g, 2.4); g.beginPath(); g.ellipse(sx - 3, sy - 5, 10, 5, a, 0, TAU); g.fillStyle = '#ffffff'; g.fill(); }
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.5, bx = x + Math.cos(a) * 120, by = y + Math.sin(a) * 100; g.save(); g.translate(bx, by); g.rotate(a + Math.PI / 2); rrect(g, -44, -10, 88, 20, 9); g.fillStyle = lgrad(g, 0, 0, 44, '#9a6a42'); g.fill(); ink(g, 2.6); g.beginPath(); g.moveTo(-36, -2); g.lineTo(36, -2); g.strokeStyle = 'rgba(60,35,20,.35)'; g.lineWidth = 2; g.stroke(); g.beginPath(); g.ellipse(0, -8, 40, 5, 0, 0, TAU); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill(); g.restore(); }
}
function summitFloor(g, S) { // Skaldra's Crown: a mirror-ice plateau with a frozen sigil
  g.beginPath(); g.arc(S.x, S.y, S.r + 30, 0, TAU); g.fillStyle = '#9fc8e8'; g.fill();
  g.beginPath(); g.arc(S.x, S.y, S.r, 0, TAU); const gr = g.createRadialGradient(S.x - 80, S.y - 90, 20, S.x, S.y, S.r); gr.addColorStop(0, '#f2fbff'); gr.addColorStop(0.6, '#bfe3fa'); gr.addColorStop(1, '#8fbfe6'); g.fillStyle = gr; g.fill(); ink(g, 4);
  g.strokeStyle = 'rgba(60,120,190,.35)'; g.lineWidth = 3; for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU + 0.2; g.beginPath(); g.moveTo(S.x + Math.cos(a) * 60, S.y + Math.sin(a) * 60); for (let k = 1; k <= 4; k++) g.lineTo(S.x + Math.cos(a + (H(i, k) - 0.5) * 0.25) * (60 + k * (S.r - 70) / 4), S.y + Math.sin(a + (H(k, i) - 0.5) * 0.25) * (60 + k * (S.r - 70) / 4)); g.stroke(); }
  g.beginPath(); g.arc(S.x, S.y, S.r * 0.55, 0, TAU); g.setLineDash([18, 12]); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 5; g.stroke(); g.setLineDash([]);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.beginPath(); g.moveTo(S.x + Math.cos(a) * S.r * 0.2, S.y + Math.sin(a) * S.r * 0.2); g.lineTo(S.x + Math.cos(a) * S.r * 0.5, S.y + Math.sin(a) * S.r * 0.5); g.strokeStyle = 'rgba(80,150,220,.5)'; g.lineWidth = 6; g.stroke(); }
  glints(g, S.x, S.y, S.r * 0.9, S.r * 0.9, 16, 11);
}
function echoFloor(g, S) { // Vyrnhal's Icefall: hoof-trodden snow with echo rings
  g.beginPath(); g.arc(S.x, S.y, S.r + 20, 0, TAU); g.fillStyle = '#d7ecf8'; g.fill(); ink(g, 4);
  for (let i = 1; i <= 4; i++) { g.beginPath(); g.arc(S.x, S.y, (S.r * i) / 4.4, 0, TAU); g.strokeStyle = `rgba(110,200,255,${0.5 - i * 0.08})`; g.lineWidth = 7 - i; g.stroke(); }
  for (let i = 0; i < 26; i++) { const a = H(i, 8) * TAU, r = Math.sqrt(H(8, i)) * S.r * 0.9, hx = S.x + Math.cos(a) * r, hy = S.y + Math.sin(a) * r; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(hx + sd * 4, hy, 3, 6, a, 0, TAU); g.fillStyle = 'rgba(70,110,150,.3)'; g.fill(); } }
}
function globeFloor(g, S) { // Morwen's Hollow: the snow globe's wooden base + glass rim + a festive rug
  g.beginPath(); g.arc(S.x, S.y, S.r + 34, 0, TAU); g.fillStyle = lgrad(g, S.x, S.y, S.r + 34, '#8a5a36'); g.fill(); ink(g, 4);
  g.beginPath(); g.arc(S.x, S.y, S.r + 14, 0, TAU); g.fillStyle = '#c99a5a'; g.fill(); ink(g, 3);
  g.beginPath(); g.arc(S.x, S.y, S.r, 0, TAU); g.fillStyle = '#f7f9ff'; g.fill(); ink(g, 3);
  g.beginPath(); g.arc(S.x, S.y, S.r - 6, 0, TAU); g.strokeStyle = 'rgba(150,220,255,.8)'; g.lineWidth = 6; g.stroke();
  for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(S.x, S.y, 50 + i * 26, 0, TAU); g.strokeStyle = i % 2 ? '#d94a5a' : '#3f9b5e'; g.lineWidth = 9; g.stroke(); }
  g.beginPath(); g.arc(S.x, S.y, 46, 0, TAU); g.fillStyle = '#f2d06a'; g.fill(); ink(g, 3);
}

// ------------------------------------------------------------------ decor (baked)
export function drawFrostDecor(g, d) {
  const x = d.x, y = d.y, s = d.size, v = d.variant || 0;
  switch (d.kind) {
    case 'drift': {
      g.beginPath(); g.ellipse(x + 3, y + 4, s * 1.4, s * 0.6, 0, 0, TAU); g.fillStyle = 'rgba(70,110,160,.16)'; g.fill();
      g.beginPath(); g.ellipse(x, y, s * 1.35, s * 0.55, (H(v, 1) - 0.5) * 0.5, 0, TAU); g.fillStyle = '#fbfdff'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = 'rgba(120,150,190,.45)'; g.stroke();
      g.beginPath(); g.ellipse(x - s * 0.3, y - s * 0.15, s * 0.6, s * 0.18, 0, Math.PI, TAU); g.strokeStyle = '#ffffff'; g.lineWidth = 2.4; g.stroke();
      return true;
    }
    case 'frostbush': {
      shadow(g, x + 4, y + s * 0.4, s * 0.9, s * 0.35, 0.18);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + v, bx = x + Math.cos(a) * s * 0.45, by = y + Math.sin(a) * s * 0.3; g.beginPath(); g.arc(bx, by, s * 0.42, 0, TAU); g.fillStyle = lgrad(g, bx, by, s * 0.42, '#4f7f6a'); g.fill(); ink(g, 2); }
      for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + v * 2, bx = x + Math.cos(a) * s * 0.3, by = y + Math.sin(a) * s * 0.2 - s * 0.18; g.beginPath(); g.ellipse(bx, by, s * 0.26, s * 0.14, 0, 0, TAU); g.fillStyle = '#ffffff'; g.fill(); }
      if (H(v, 3) < 0.35) for (let i = 0; i < 3; i++) circle(g, x + (H(v, i) - 0.5) * s, y + (H(i, v) - 0.5) * s * 0.6, 2.6, '#e8455a', 1);
      return true;
    }
    case 'icecrack': {
      g.lineCap = 'round'; g.beginPath(); const a0 = H(v, 2) * TAU;
      for (let b = 0; b < 3; b++) { const a = a0 + b * 2.1; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.42); g.lineTo(x + Math.cos(a + 0.4) * s * 1.2, y + Math.sin(a + 0.4) * s * 0.84); }
      g.strokeStyle = 'rgba(40,90,160,.35)'; g.lineWidth = 3.5; g.stroke(); g.strokeStyle = 'rgba(180,230,255,.9)'; g.lineWidth = 1.4; g.stroke();
      return true;
    }
    case 'bones': {
      g.save(); g.translate(x, y); g.rotate(H(v, 4) * TAU);
      for (const [dx, dy, a] of [[-6, 0, 0.3], [6, 4, -0.5]]) { g.save(); g.translate(dx, dy); g.rotate(a); g.beginPath(); g.moveTo(-s * 0.5, 0); g.lineTo(s * 0.5, 0); g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = 'round'; g.stroke(); g.strokeStyle = '#f2ecdc'; g.lineWidth = 3; g.stroke(); g.restore(); }
      g.restore(); return true;
    }
    case 'moonwell': {
      g.beginPath(); g.arc(x, y, s + 20, 0, TAU); g.fillStyle = lgrad(g, x, y, s + 20, '#a9b6c8'); g.fill(); ink(g, 3.5);
      g.beginPath(); g.arc(x, y, s - 8, 0, TAU); const gr = g.createRadialGradient(x - s * 0.3, y - s * 0.3, 4, x, y, s); gr.addColorStop(0, '#f4ffff'); gr.addColorStop(0.5, '#8fe0ff'); gr.addColorStop(1, '#3f6fd0'); g.fillStyle = gr; g.fill(); ink(g, 3);
      g.beginPath(); g.arc(x + s * 0.25, y - s * 0.1, s * 0.3, 0.6, Math.PI * 1.7); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 4; g.stroke();
      return true;
    }
    case 'hearth': {
      g.beginPath(); g.arc(x, y, s * 0.75, 0, TAU); g.fillStyle = '#3a2a24'; g.fill();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, sx = x + Math.cos(a) * s * 0.75, sy = y + Math.sin(a) * s * 0.62; g.beginPath(); g.ellipse(sx, sy, 11, 9, a, 0, TAU); g.fillStyle = lgrad(g, sx, sy, 11, '#8d96a4'); g.fill(); ink(g, 2.2); }
      for (const a of [0.4, 1.9, 3.4]) { g.save(); g.translate(x, y); g.rotate(a); rrect(g, -s * 0.5, -6, s, 12, 5); g.fillStyle = '#6b4428'; g.fill(); ink(g, 2); g.restore(); }
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------ obstacles
/** low frost props baked into the ground tiles */
export const FROST_BAKE = new Set(['icecliff', 'snowrock', 'pine', 'tent', 'runestone', 'rib']);
/** tall frost props: cached sprites, y-sorted with the characters */
export const FROST_TALL = new Set(['crystal', 'frozenfalls', 'spire', 'titanskull', 'echopillar', 'candycane', 'cryptpillar']);
export function drawFrostBaked(g, o) {
  switch (o.kind) {
    case 'icecliff': iceCliff(g, o); return true;
    case 'snowrock': snowRock(g, o); return true;
    case 'pine': pineBase(g, o); return true;
    case 'tent': tent(g, o); return true;
    case 'runestone': runeStone(g, o); return true;
    case 'rib': rib(g, o); return true;
  }
  return false;
}
function blob(g, x, y, s, n, v, sq = 0.78) { const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU + v * 0.37, r = s * (0.8 + H(v, i) * 0.32); pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * sq]); } g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); return pts; }
function iceCliff(g, o) {
  const s = o.size, v = o.variant, x = o.x, y = o.y;
  shadow(g, x + s * 0.25, y + s * 0.35, s * 1.15, s * 0.55, 0.22);
  blob(g, x, y + s * 0.12, s * 1.02, 9, v); g.fillStyle = '#5f86b0'; g.fill(); ink(g, 3.4);
  const top = blob(g, x - s * 0.06, y - s * 0.12, s * 0.9, 9, v + 1); g.fillStyle = lgrad(g, x, y - s * 0.12, s * 0.9, '#a9d4f2', LA, 0.4, -0.2); g.fill(); ink(g, 3);
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2.2; g.beginPath(); for (let i = 0; i < 3; i++) { const p = top[(i * 3 + v) % top.length]; g.moveTo(x - s * 0.06, y - s * 0.12); g.lineTo((p[0] + x) / 2, (p[1] + y) / 2); } g.stroke();
  blob(g, x - s * 0.22, y - s * 0.32, s * 0.5, 7, v + 2, 0.55); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = 'rgba(120,160,200,.6)'; g.stroke();
}
function snowRock(g, o) {
  const s = o.size, v = o.variant, x = o.x, y = o.y;
  shadow(g, x + s * 0.2, y + s * 0.3, s * 1.0, s * 0.45, 0.2);
  blob(g, x, y, s, 8, v); g.fillStyle = lgrad(g, x, y, s, '#8b95a6'); g.fill(); ink(g, 3);
  blob(g, x - s * 0.12, y - s * 0.28, s * 0.66, 7, v + 5, 0.5); g.fillStyle = '#fbfdff'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(120,150,190,.55)'; g.stroke();
  rimArc(g, x, y, s * 0.8, LA, 'rgba(255,255,255,.5)', 2, 0.6);
}
function pineBase(g, o) { // the shadow + trunk (the snowy canopy is in the canopy layer)
  const s = o.size, x = o.x, y = o.y;
  g.beginPath(); g.ellipse(x + s * 0.35, y + s * 0.35, s * 1.0, s * 0.55, 0.3, 0, TAU); g.fillStyle = 'rgba(40,70,110,.2)'; g.fill();
  rrect(g, x - s * 0.1, y - s * 0.15, s * 0.2, s * 0.32, s * 0.06); g.fillStyle = '#6b4428'; g.fill(); ink(g, 2.2);
}
/** the snowy pine canopy (3 tiers, top-down), painted into the canopy layer */
export function drawPineTop(g, o) {
  const s = o.size, v = o.variant, x = o.x, y = o.y - s * 0.45;
  const tiers = [[1, 0, '#2f5d4c'], [0.7, -s * 0.18, '#3a7059'], [0.42, -s * 0.34, '#4a8468']];
  for (const [k, dy, col] of tiers) {
    const r = s * k, n = 9, cy = y + dy;
    g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU + v * 0.1, rr = i % 2 ? r * 0.72 : r * (0.96 + H(v, i) * 0.08); const px = x + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.86; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath();
    g.fillStyle = lgrad(g, x, cy, r, col, LA, 0.25, -0.35); g.fill(); g.lineWidth = 2.6; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
    g.beginPath(); for (let i = 0; i <= 8; i++) { const a = Math.PI * 0.95 + (i / 8) * Math.PI * 0.9, rr = r * (i % 2 ? 0.62 : 0.84); const px = x + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.86; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.quadraticCurveTo(x, cy - r * 0.15, x + Math.cos(Math.PI * 0.95) * r * 0.84, cy + Math.sin(Math.PI * 0.95) * r * 0.84 * 0.86); g.fillStyle = 'rgba(255,255,255,.95)'; g.fill();
  }
  circle(g, x - s * 0.05, y - s * 0.42, s * 0.1, '#ffffff', 1.4);
}
function tent(g, o) {
  const s = o.size, x = o.x, y = o.y, col = ['#b0603a', '#5f7fb0', '#7f9a4f', '#a0577f'][o.variant % 4];
  shadow(g, x + 8, y + s * 0.5, s * 1.1, s * 0.45, 0.22);
  g.beginPath(); g.moveTo(x, y - s * 0.95); g.lineTo(x + s, y + s * 0.4); g.lineTo(x - s, y + s * 0.4); g.closePath(); g.fillStyle = lgrad(g, x, y, s, col); g.fill(); ink(g, 3);
  g.beginPath(); g.moveTo(x, y - s * 0.95); g.lineTo(x, y + s * 0.4); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2.5; g.stroke();
  g.beginPath(); g.moveTo(x - s * 0.18, y + s * 0.4); g.lineTo(x, y - s * 0.05); g.lineTo(x + s * 0.18, y + s * 0.4); g.closePath(); g.fillStyle = '#2b2433'; g.fill();
  g.beginPath(); g.moveTo(x - s * 0.35, y - s * 0.45); g.lineTo(x, y - s * 0.95); g.lineTo(x + s * 0.2, y - s * 0.62); g.closePath(); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill();
}
function runeStone(g, o) {
  const s = o.size, x = o.x, y = o.y;
  shadow(g, x + 5, y + s * 0.3, s * 0.7, s * 0.3, 0.22);
  rrect(g, x - s * 0.35, y - s * 1.1, s * 0.7, s * 1.25, s * 0.18); g.fillStyle = lgrad(g, x, y - s * 0.5, s * 0.6, '#8f9ab0'); g.fill(); ink(g, 2.8);
  g.beginPath(); g.moveTo(x, y - s * 0.85); g.lineTo(x - s * 0.15, y - s * 0.55); g.lineTo(x + s * 0.12, y - s * 0.45); g.lineTo(x - s * 0.05, y - s * 0.15); g.strokeStyle = '#8fe3ff'; g.lineWidth = 2.6; g.stroke();
  g.beginPath(); g.ellipse(x - s * 0.05, y - s * 1.06, s * 0.32, s * 0.12, 0, 0, TAU); g.fillStyle = '#fff'; g.fill();
}
function rib(g, o) {
  const s = o.size, x = o.x, y = o.y, sd = o.side || 1;
  g.save(); g.translate(x, y); g.scale(1, sd);
  g.beginPath(); g.moveTo(-s * 0.15, s * 0.5); g.quadraticCurveTo(-s * 0.4, -s * 0.6, s * 0.3, -s * 1.1); g.strokeStyle = INK; g.lineWidth = s * 0.32 + 5; g.lineCap = 'round'; g.stroke(); g.strokeStyle = '#efe8d8'; g.lineWidth = s * 0.32; g.stroke();
  g.beginPath(); g.moveTo(-s * 0.2, s * 0.3); g.quadraticCurveTo(-s * 0.36, -s * 0.5, s * 0.2, -s * 0.95); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; g.stroke();
  g.restore();
}
/** tall props (y-sorted): returns true when drawn (baked kinds: nothing to draw here) */
export function drawFrostObstacle(ctx, o, t) {
  if (!o.frost && !o.crypt) return false;
  if (!FROST_TALL.has(o.kind)) return FROST_BAKE.has(o.kind);
  const s = o.size, v = o.variant % 6, W = Math.ceil(s * 4 + 60), Ht = Math.ceil(s * 6 + 80);
  const c = sprite(`fp:${o.kind}:${v}:${s}`, W, Ht, W / 2, Ht * 0.78, (g) => TALL_FN[o.kind](g, { ...o, x: 0, y: 0, variant: v }));
  blit(ctx, c, o.x, o.y);
  if (o.kind === 'spire') bloom(ctx, o.x, o.y - s * 2.4, s * 1.6, '#b49cff', 0.35 + 0.12 * Math.sin(t * 2.4));
  else if (o.kind === 'echopillar') bloom(ctx, o.x, o.y - s * 1.9, s * 0.9, '#8fe3ff', 0.28 + 0.12 * Math.sin(t * 3 + o.x));
  return true;
}
function shard(g, x, y, h, w, a, col) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.beginPath(); g.moveTo(-w, 0); g.lineTo(-w * 0.8, -h * 0.75); g.lineTo(0, -h); g.lineTo(w * 0.8, -h * 0.75); g.lineTo(w, 0); g.lineTo(0, w * 0.4); g.closePath();
  const gr = g.createLinearGradient(-w, 0, w, 0); gr.addColorStop(0, shade(col, 0.55)); gr.addColorStop(0.48, col); gr.addColorStop(0.52, shade(col, -0.2)); gr.addColorStop(1, shade(col, -0.4)); g.fillStyle = gr; g.fill(); ink(g, 2.8);
  g.beginPath(); g.moveTo(0, -h); g.lineTo(0, w * 0.4); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.6; g.stroke();
  g.beginPath(); g.moveTo(-w * 0.6, -h * 0.1); g.lineTo(-w * 0.5, -h * 0.65); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.stroke();
  g.restore();
}
const TALL_FN = {
  crystal(g, o) { const s = o.size; shadow(g, 4, s * 0.15, s * 0.8, s * 0.3, 0.22); for (const [dx, h, w, a] of [[-s * 0.35, s * 1.1, s * 0.3, -0.35], [s * 0.32, s * 0.9, s * 0.28, 0.3], [0, s * 1.6, s * 0.38, 0]]) shard(g, dx, 0, h, w, a, '#9fdcff'); },
  spire(g, o) { const s = o.size; shadow(g, 10, s * 0.2, s * 1.1, s * 0.4, 0.25); for (const [dx, h, w, a, c] of [[-s * 0.55, s * 1.6, s * 0.36, -0.3, '#a9b8ff'], [s * 0.5, s * 1.9, s * 0.4, 0.25, '#b9c6ff'], [0, s * 3.2, s * 0.55, 0, '#c8bfff']]) shard(g, dx, 0, h, w, a, c); },
  frozenfalls(g, o) {
    const s = o.size; shadow(g, 0, s * 0.3, s * 1.6, s * 0.4, 0.25);
    g.beginPath(); g.moveTo(-s * 1.5, s * 0.2); g.lineTo(-s * 1.3, -s * 1.6); g.lineTo(-s * 0.5, -s * 2.1); g.lineTo(s * 0.6, -s * 2.0); g.lineTo(s * 1.4, -s * 1.5); g.lineTo(s * 1.5, s * 0.2); g.closePath(); g.fillStyle = lgrad(g, 0, -s, s * 1.6, '#7d8aa0'); g.fill(); ink(g, 3.5);
    g.beginPath(); g.moveTo(-s * 0.6, -s * 1.9); g.quadraticCurveTo(-s * 0.7, -s * 0.6, -s * 0.85, s * 0.2); g.lineTo(s * 0.8, s * 0.2); g.quadraticCurveTo(s * 0.65, -s * 0.6, s * 0.6, -s * 1.85); g.closePath();
    const gr = g.createLinearGradient(-s * 0.7, 0, s * 0.7, 0); gr.addColorStop(0, '#dff6ff'); gr.addColorStop(0.5, '#9fdcff'); gr.addColorStop(1, '#6fb3e8'); g.fillStyle = gr; g.fill(); ink(g, 3);
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * s * 0.22, -s * 1.8); g.quadraticCurveTo(i * s * 0.26, -s * 0.8, i * s * 0.3, s * 0.1); g.stroke(); }
    for (let i = 0; i < 7; i++) { const ix = -s * 1.2 + i * s * 0.4; g.beginPath(); g.moveTo(ix - 7, -s * 1.85 + (i % 2) * 10); g.lineTo(ix, -s * 1.85 + 30 + (i % 3) * 12); g.lineTo(ix + 7, -s * 1.85 + (i % 2) * 10); g.closePath(); g.fillStyle = '#e8f8ff'; g.fill(); ink(g, 1.6); }
    g.beginPath(); g.ellipse(0, -s * 1.95, s * 1.1, s * 0.2, 0, Math.PI, TAU); g.fillStyle = '#fff'; g.fill();
  },
  titanskull(g, o) {
    const s = o.size; shadow(g, 6, s * 0.4, s * 1.3, s * 0.45, 0.25);
    g.beginPath(); g.ellipse(0, -s * 0.5, s * 1.1, s * 0.9, 0, 0, TAU); g.fillStyle = lgrad(g, 0, -s * 0.5, s, '#ece4d2'); g.fill(); ink(g, 3.5);
    for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * s * 0.42, -s * 0.55, s * 0.26, s * 0.3, 0, 0, TAU); g.fillStyle = '#2b2433'; g.fill(); circle(g, sd * s * 0.42, -s * 0.55, s * 0.08, '#8fe3ff', 0); }
    g.beginPath(); g.moveTo(-s * 0.1, -s * 0.2); g.lineTo(0, -s * 0.05); g.lineTo(s * 0.1, -s * 0.2); g.fillStyle = '#2b2433'; g.fill();
    for (let i = -3; i <= 3; i++) { rrect(g, i * s * 0.14 - s * 0.06, s * 0.08, s * 0.12, s * 0.22, 3); g.fillStyle = '#f4efe2'; g.fill(); ink(g, 1.8); }
    g.beginPath(); g.ellipse(-s * 0.2, -s * 1.15, s * 0.7, s * 0.22, -0.1, 0, TAU); g.fillStyle = '#fff'; g.fill();
    g.beginPath(); g.moveTo(s * 0.3, -s * 1.2); g.lineTo(s * 0.5, -s * 0.85); g.lineTo(s * 0.4, -s * 0.7); g.strokeStyle = 'rgba(80,60,40,.4)'; g.lineWidth = 2.4; g.stroke();
  },
  echopillar(g, o) {
    const s = o.size; shadow(g, 4, s * 0.25, s * 0.7, s * 0.28, 0.24);
    rrect(g, -s * 0.38, -s * 2.2, s * 0.76, s * 2.35, s * 0.2); g.fillStyle = lgrad(g, 0, -s, s * 0.6, '#9fd6f2'); g.fill(); ink(g, 3);
    g.beginPath(); g.moveTo(-s * 0.2, -s * 2.0); g.lineTo(-s * 0.2, -s * 0.2); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2.4; g.stroke();
    g.beginPath(); g.arc(0, -s * 1.5, s * 0.2, 0, TAU); g.moveTo(-s * 0.18, -s * 1.0); g.lineTo(s * 0.18, -s * 0.8); g.strokeStyle = '#2f6fd0'; g.lineWidth = 2.6; g.stroke();
    g.beginPath(); g.ellipse(0, -s * 2.18, s * 0.42, s * 0.14, 0, 0, TAU); g.fillStyle = '#fff'; g.fill(); ink(g, 2);
  },
  candycane(g, o) {
    const s = o.size; shadow(g, 3, s * 0.2, s * 0.5, s * 0.2, 0.24);
    g.beginPath(); g.moveTo(0, s * 0.1); g.lineTo(0, -s * 2.2); g.arc(s * 0.4, -s * 2.2, s * 0.4, Math.PI, TAU); g.lineTo(s * 0.8, -s * 1.8); g.lineCap = 'round';
    g.strokeStyle = INK; g.lineWidth = s * 0.38 + 5; g.stroke(); g.strokeStyle = '#fbf6f0'; g.lineWidth = s * 0.38; g.stroke();
    g.setLineDash([s * 0.3, s * 0.3]); g.strokeStyle = '#e0384f'; g.lineWidth = s * 0.38; g.stroke(); g.setLineDash([]);
    g.beginPath(); g.moveTo(-s * 0.08, -s * 0.1); g.lineTo(-s * 0.08, -s * 2.1); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.stroke();
  },
  cryptpillar(g, o) {
    const s = o.size; shadow(g, 5, s * 0.25, s * 0.95, s * 0.35, 0.3);
    g.beginPath(); g.ellipse(0, 0, s * 0.95, s * 0.4, 0, 0, TAU); g.fillStyle = '#566a88'; g.fill(); ink(g, 3);
    rrect(g, -s * 0.7, -s * 3.0, s * 1.4, s * 3.0, s * 0.2); g.fillStyle = lgrad(g, 0, -s * 1.5, s * 0.9, '#8aa6c8'); g.fill(); ink(g, 3);
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-s * 0.7, -s * 0.75 * i); g.lineTo(s * 0.7, -s * 0.75 * i); g.strokeStyle = 'rgba(30,40,70,.3)'; g.lineWidth = 2; g.stroke(); }
    for (let i = 0; i < 5; i++) { const ix = -s * 0.55 + i * s * 0.28; g.beginPath(); g.moveTo(ix - 4, -s * 2.4); g.lineTo(ix, -s * 2.4 + 14 + (i % 2) * 10); g.lineTo(ix + 4, -s * 2.4); g.fillStyle = '#dff4ff'; g.fill(); }
    g.beginPath(); g.ellipse(0, -s * 3.0, s * 0.75, s * 0.28, 0, 0, TAU); g.fillStyle = '#eef8ff'; g.fill(); ink(g, 2.4);
  },
};

// ------------------------------------------------------------------ live overlays (cheap, every frame)
export function drawFrostLive(ctx, view, t) {
  if (!frostVisible(view)) return false;
  const C = FROST_CAMP;
  if (near(view, C, 400)) { const f = 0.6 + 0.25 * Math.sin(t * 9) + 0.15 * Math.sin(t * 23); bloom(ctx, C.x, C.y, 150, '#ff9a3a', 0.35 * f); fire(ctx, C.x, C.y, t); }
  const S = FROST_SITES.shrine;
  if (near(view, S, 300)) bloom(ctx, S.x, S.y, S.r * 1.6, '#8fe0ff', 0.22 + 0.08 * Math.sin(t * 1.6));
  return true;
}
function fire(ctx, x, y, t) {
  for (let i = 0; i < 3; i++) { const k = 1 - i * 0.28, fl = Math.sin(t * 14 + i * 2) * 3; ctx.beginPath(); ctx.moveTo(x - 18 * k, y + 4); ctx.quadraticCurveTo(x - 14 * k + fl, y - 22 * k, x + fl, y - 40 * k); ctx.quadraticCurveTo(x + 14 * k + fl, y - 22 * k, x + 18 * k, y + 4); ctx.closePath(); ctx.fillStyle = ['#ff6a2a', '#ffb43c', '#fff2a0'][i]; ctx.fill(); if (!i) ink(ctx, 2.4); }
}
/** over the characters: snowfall (heavier on the crown), the Whiteout fog around the local hero */
export function drawFrostOver(ctx, sim, local, view, t, lite) {
  if (!frostVisible(view) || !local || !inFrostArea(local.x, local.y, 600)) return;
  const re = FS.re(local.x, local.y), n = lite ? 24 : re > FROST_RINGS[3] ? 90 : 55;
  const W = view.x1 - view.x0, Hh = view.y1 - view.y0;
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < n; i++) {
    const sp = 40 + H(i, 7) * 50, ph = (t * sp + H(i, 3) * Hh) % Hh, x = view.x0 + ((H(i, 1) * W + Math.sin(t * 0.8 + i) * 30 + t * 20) % W + W) % W, y = view.y0 + ph, r = 1.4 + H(i, 9) * 2.6;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  for (const a of sim.areas) {
    if (a.kind !== 'whiteout' || Math.hypot(local.x - a.x, local.y - a.y) > a.r) continue;
    const k = Math.max(0, Math.min(1, a.t / 40, (a.delay - a.t) / 30));
    const gr = ctx.createRadialGradient(local.x, local.y, 120, local.x, local.y, 360);
    gr.addColorStop(0, 'rgba(240,248,255,0)'); gr.addColorStop(0.5, `rgba(240,248,255,${0.75 * k})`); gr.addColorStop(1, `rgba(236,246,255,${0.96 * k})`);
    ctx.fillStyle = gr; ctx.fillRect(view.x0, view.y0, W, Hh);
    break;
  }
}

// ------------------------------------------------------------------ telegraph kinds (render.js drawArea hook)
export function drawFrostArea(ctx, a, t) {
  switch (a.kind) {
    case 'whiteout': return true;
    case 'still': {
      const k = Math.min(1, a.t / 12), left = Math.max(0, 1 - a.t / Math.max(1, a.delay));
      ctx.save(); ctx.globalAlpha = 0.16 * k; circle(ctx, a.x, a.y, a.r, '#bfeaff', 0); ctx.globalAlpha = 0.8 * k;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.setLineDash([22, 14]); ctx.strokeStyle = '#dff6ff'; ctx.lineWidth = 6; ctx.stroke(); ctx.setLineDash([]);
      for (let i = 0; i < 12; i++) { const an = (i / 12) * TAU - Math.PI / 2; ctx.beginPath(); ctx.moveTo(a.x + Math.cos(an) * (a.r - 30), a.y + Math.sin(an) * (a.r - 30)); ctx.lineTo(a.x + Math.cos(an) * (a.r - 6), a.y + Math.sin(an) * (a.r - 6)); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = i % 3 ? 3 : 7; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r - 40, -Math.PI / 2, -Math.PI / 2 + left * TAU); ctx.strokeStyle = '#7fd8ff'; ctx.lineWidth = 10; ctx.stroke();
      ctx.restore(); return true;
    }
    case 'mirror': {
      const c = Math.cos(a.ang), s = Math.sin(a.ang), k = Math.min(1, a.t / 20), fade = Math.min(1, (a.delay - a.t) / 30);
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(k, fade));
      const x2 = a.x + c * a.len, y2 = a.y + s * a.len, gr = ctx.createLinearGradient(a.x, a.y, x2, y2);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.2, '#e8fbff'); gr.addColorStop(0.5, '#9fe8ff'); gr.addColorStop(0.8, '#e8fbff'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(x2, y2); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(43,36,51,.6)'; ctx.lineWidth = a.w + 8; ctx.stroke(); ctx.strokeStyle = gr; ctx.lineWidth = a.w; ctx.stroke();
      for (let i = 0; i < 8; i++) { const ph = (t * 0.5 + i / 8) % 1; star(ctx, a.x + c * a.len * ph, a.y + s * a.len * ph, 5 + 3 * Math.sin(t * 6 + i), '#ffffff', 0); }
      ctx.restore(); return true;
    }
    case 'shake': {
      const prog = Math.min(1, a.t / Math.max(1, a.delay));
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.ang);
      ctx.globalAlpha = 0.25; rrect(ctx, 0, -a.w / 2, a.len, a.w, a.w / 2); ctx.fillStyle = '#ff5e7a'; ctx.fill();
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < 6; i++) { const px = ((i / 6 + t * 0.9) % 1) * (a.len - 80) + 20; ctx.beginPath(); ctx.moveTo(px, -a.w * 0.35); ctx.lineTo(px + 40, 0); ctx.lineTo(px, a.w * 0.35); ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = '#ffe3ea'; ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(a.len + 30, 0); ctx.lineTo(a.len - 40, -a.w * 0.7); ctx.lineTo(a.len - 40, a.w * 0.7); ctx.closePath(); ctx.fillStyle = '#ff5e7a'; ctx.fill(); ink(ctx, 4);
      ctx.globalAlpha = 0.6; rrect(ctx, 0, a.w / 2 + 6, a.len * prog, 8, 4); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.restore(); return true;
    }
    case 'echoghost': {
      const k = Math.min(1, a.t / 10) * Math.max(0, Math.min(1, (a.delay - a.t) / 14));
      ctx.save(); ctx.globalAlpha = 0.45 * k; ctx.translate(a.x, a.y); ctx.rotate(a.ang || 0);
      drawVyrnhal(ctx, { x: 0, y: 0, r: a.r || 60, face: a.ang || 0, state: 'idle', st: 0, id: 7, ghost: 1 }, t, '#bff0ff');
      ctx.restore(); return true;
    }
    case 'statue': {
      const k = Math.max(0, Math.min(1, a.t / 6, (a.delay - a.t) / 20));
      ctx.save(); ctx.globalAlpha = 0.7 * k; ctx.translate(a.x, a.y); ctx.rotate(a.ang || 0);
      ENEMY_DRAW.rimewraith(ctx, { x: 0, y: 0, r: a.r || 18, face: 0, state: 'statue', st: 0, id: 3 }, t, '#dff4ff');
      ctx.restore(); return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------ bullets
export function drawFrostProjectile(ctx, pr, x, y, lite, t) {
  if (pr.style !== 'ice' && pr.style !== 'snow') return false;
  const still = !pr.vx && !pr.vy;
  if (pr.style === 'snow') {
    if (!lite) bloom(ctx, x, y, pr.r * 3, '#dff4ff', 0.4);
    circle(ctx, x, y, pr.r + 2, '#ffffff', 3.2);
    circle(ctx, x - pr.r * 0.35, y - pr.r * 0.35, pr.r * 0.4, '#ffffff', 0);
    ctx.beginPath(); ctx.arc(x, y, pr.r - 1, 0.3, 1.9); ctx.strokeStyle = 'rgba(120,170,220,.6)'; ctx.lineWidth = 2; ctx.stroke();
  } else {
    if (!still) pr.lastAng = Math.atan2(pr.vy, pr.vx);
    const ang = pr.lastAng ?? (pr.id || 0) * 2.4, r = pr.r + 2;
    if (!lite) bloom(ctx, x, y, r * 3.2, '#8fe3ff', 0.55);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(r * 1.7, 0); ctx.lineTo(0, -r * 0.62); ctx.lineTo(-r * 1.2, 0); ctx.lineTo(0, r * 0.62); ctx.closePath();
    ctx.fillStyle = '#bfefff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 1.4, 0); ctx.lineTo(-r * 0.8, 0); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  if (still) { ctx.save(); ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 10 + (pr.id || 0)); ctx.beginPath(); ctx.arc(x, y, pr.r + 7, 0, TAU); ctx.setLineDash([4, 4]); ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
  return true;
}

// ------------------------------------------------------------------ Crypt portals (in Frostveil)
export function cryptPortals(sim) {
  if (sim.frostV !== undefined) return ((sim.frostV && sim.frostV.cp) || []).map(([x, y, t, big]) => ({ x, y, t, big }));
  return sim.cryptPortals || [];
}
export function drawFrostUnder(ctx, sim, local, t, view) {
  if (!frostVisible(view)) return;
  for (const pt of cryptPortals(sim)) if (pt.x > view.x0 - 80 && pt.x < view.x1 + 80 && pt.y > view.y0 - 80 && pt.y < view.y1 + 80) cryptPortal(ctx, pt.x, pt.y, pt.t, pt.big, t, local);
}
export function cryptPortal(ctx, x, y, life, big, t, local) {
  const R = CPORTAL.r * (big ? 1.25 : 1), fade = Math.min(1, life / 120);
  ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * fade;
  bloom(ctx, x, y, R * 2.4, '#6fb8ff', 0.5);
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.62);
  circle(ctx, 0, 0, R + 10, '#3d5f8f', 3.5);
  const gg = ctx.createRadialGradient(0, 0, 2, 0, 0, R); gg.addColorStop(0, '#ffffff'); gg.addColorStop(0.35, '#9fe8ff'); gg.addColorStop(1, '#1d3f8a'); circle(ctx, 0, 0, R, gg, 3);
  for (let arm = 0; arm < 3; arm++) { ctx.beginPath(); ctx.moveTo(0, 0); for (let i = 1; i <= 14; i++) { const k = i / 14, a = -t * 2.2 + arm * 2.09 + k * 4; ctx.lineTo(Math.cos(a) * R * k, Math.sin(a) * R * k); } ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.stroke(); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + t * 0.6; ctx.save(); ctx.translate(Math.cos(a) * (R + 10), Math.sin(a) * (R + 10)); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(0, -12); ctx.lineTo(5, 0); ctx.closePath(); ctx.fillStyle = '#dff6ff'; ctx.fill(); ink(ctx, 1.6); ctx.restore(); }
  ctx.restore();
  if (local && Math.hypot(local.x - x, local.y - y) < 260) {
    ctx.font = `16px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText('GLACIER CRYPT', x, y - R - 18); ctx.fillStyle = '#bfeaff'; ctx.fillText('GLACIER CRYPT', x, y - R - 18);
    const s = `step in · ${Math.ceil(life / 60)}s`; ctx.font = `12px ${FONT}`; ctx.strokeText(s, x, y - R - 2); ctx.fillStyle = '#fff'; ctx.fillText(s, x, y - R - 2);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ enemies (registered into art.js ENEMY_DRAW)
const lightLocal = (e) => LA - (e.face || 0);
const upright = (ctx, e) => ctx.rotate(-(e.face || 0));
Object.assign(ENEMY_ANIM, { penguin: [10, 4], yeti: [4, 4], shardwisp: [6, 6], rimewraith: [5, 6], acolyte: [4, 6], icepawn: [0, 1], iceknight: [0, 1] });
function chessBase(ctx, r, col) {
  ctx.beginPath(); ctx.ellipse(0, r * 0.25, r * 1.0, r * 0.5, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, 0, r * 0.25, r, shade(col, -0.15)); ctx.fill(); ink(ctx, 3);
  ctx.beginPath(); ctx.moveTo(-r * 0.75, r * 0.2); ctx.lineTo(-r * 0.4, -r * 0.5); ctx.lineTo(r * 0.4, -r * 0.5); ctx.lineTo(r * 0.75, r * 0.2); ctx.closePath(); ctx.fillStyle = lgrad(ctx, 0, 0, r, col, LA, 0.45, -0.3); ctx.fill(); ink(ctx, 2.8);
  ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.4); ctx.lineTo(-r * 0.45, r * 0.15); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2.4; ctx.stroke();
}
Object.assign(ENEMY_DRAW, {
  /** Glacier Penguin: a navy waddler with a white belly; belly-slides with its flippers swept back */
  penguin(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e);
    if (e.state === 'slide') {
      ctx.save(); ctx.globalAlpha *= 0.6; for (let i = 1; i <= 4; i++) circle(ctx, -r * 0.9 * i, (i % 2 ? -1 : 1) * 5, r * (0.5 - i * 0.08), '#ffffff', 0); ctx.restore();
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(-r * 0.6, sd * r * 0.75, r * 0.6, r * 0.18, sd * 0.3, 0, TAU); ctx.fillStyle = shade(col, -0.2); ctx.fill(); ink(ctx, 2.4); }
      oval(ctx, 0, 0, r * 1.25, r * 0.72, col, la, 3, 0, 0.45);
      ctx.beginPath(); ctx.ellipse(r * 0.25, 0, r * 0.8, r * 0.46, 0, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * 1.15, -r * 0.12); ctx.lineTo(r * 1.55, 0); ctx.lineTo(r * 1.15, r * 0.12); ctx.closePath(); ctx.fillStyle = '#ffa53a'; ctx.fill(); ink(ctx, 2);
      return;
    }
    ctx.rotate(Math.sin(t * 10 + (e.id || 0)) * 0.12);
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(r * 0.55, sd * r * 0.35, r * 0.28, r * 0.16, 0, 0, TAU); ctx.fillStyle = '#ffa53a'; ctx.fill(); ink(ctx, 2); }
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(-r * 0.05, sd * r * 0.95, r * 0.42, r * 0.17, sd * (0.5 + Math.sin(t * 10) * 0.3), 0, TAU); ctx.fillStyle = shade(col, -0.15); ctx.fill(); ink(ctx, 2.2); }
    ball(ctx, 0, 0, r, col, la, 3, 0.4);
    ctx.beginPath(); ctx.ellipse(r * 0.28, 0, r * 0.62, r * 0.66, 0, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
    circle(ctx, r * 0.42, -r * 0.3, 2.6, INK, 0); circle(ctx, r * 0.42, r * 0.3, 2.6, INK, 0);
    ctx.beginPath(); ctx.moveTo(r * 0.75, -r * 0.14); ctx.lineTo(r * 1.2, 0); ctx.lineTo(r * 0.75, r * 0.14); ctx.closePath(); ctx.fillStyle = '#ffa53a'; ctx.fill(); ink(ctx, 2);
    if (e.state === 'wind') { ctx.globalAlpha *= 0.5 + 0.5 * Math.sin(t * 30); circle(ctx, 0, 0, r * 1.25, null, 3, '#8fe3ff'); }
  },
  /** Frostback Yeti: a huge shaggy ball of white fur with a blue face, curled horns and big fists */
  yeti(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e), thr = e.state === 'throw', slam = e.state === 'slamwind';
    const arm = (sd, lift) => { const ax = r * (0.35 + lift * 0.3), ay = sd * r * (1.0 - lift * 0.25); ball(ctx, ax, ay, r * 0.38, '#dfeaf6', la, 2.6, 0.3); circle(ctx, ax + r * 0.18, ay, r * 0.2, '#6f8fb8', 2); };
    arm(-1, slam ? 1 : 0); arm(1, slam || thr ? 1 : 0);
    ctx.beginPath(); for (let i = 0; i < 22; i++) { const a = (i / 22) * TAU, rr = r * (i % 2 ? 0.92 : 1.08); i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath();
    ctx.fillStyle = lgrad(ctx, 0, 0, r, col, la); ctx.fill(); ink(ctx, 3.2);
    ctx.beginPath(); ctx.ellipse(r * 0.45, 0, r * 0.4, r * 0.48, 0, 0, TAU); ctx.fillStyle = '#7fa6d6'; ctx.fill(); ink(ctx, 2.4);
    circle(ctx, r * 0.6, -r * 0.18, 3, '#fff', 0); circle(ctx, r * 0.6, r * 0.18, 3, '#fff', 0); circle(ctx, r * 0.63, -r * 0.18, 1.6, INK, 0); circle(ctx, r * 0.63, r * 0.18, 1.6, INK, 0);
    ctx.beginPath(); ctx.moveTo(r * 0.72, -r * 0.12); ctx.lineTo(r * 0.8, 0); ctx.lineTo(r * 0.72, r * 0.12); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.2, sd * r * 0.42); ctx.quadraticCurveTo(-r * 0.05, sd * r * 0.9, r * 0.3, sd * r * 0.95); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#e8dcc0'; ctx.stroke(); }
    if (thr) ball(ctx, r * 0.7, r * 1.0, r * 0.45, '#ffffff', la, 2.6, 0.5);
  },
  /** Shard Wisp: a floating ice crystal core with orbiting shards */
  shardwisp(ctx, e, t, col) {
    const r = e.r; upright(ctx, e);
    ctx.translate(0, Math.sin(t * 4 + (e.id || 0)) * 3 - 6);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.35; circle(ctx, 0, 0, r * 1.5, col, 0); ctx.restore();
    ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r * 0.7, 0); ctx.lineTo(0, r * 1.2); ctx.lineTo(-r * 0.7, 0); ctx.closePath(); ctx.fillStyle = lgrad(ctx, 0, 0, r, col, LA, 0.5, -0.3); ctx.fill(); ink(ctx, 2.8);
    ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(0, r * 1.2); ctx.moveTo(-r * 0.7, 0); ctx.lineTo(r * 0.7, 0); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.6; ctx.stroke();
    const n = e.state === 'cast' ? 6 : 4;
    for (let i = 0; i < n; i++) { const a = t * 2.5 + (i / n) * TAU; ctx.save(); ctx.translate(Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.8); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(0, -4); ctx.lineTo(8, 0); ctx.lineTo(0, 4); ctx.closePath(); ctx.fillStyle = '#e8fbff'; ctx.fill(); ink(ctx, 1.6); ctx.restore(); }
    circle(ctx, 0, -r * 0.1, 3, '#ffffff', 0);
  },
  /** Rime Wraith: a tattered ice-blue shroud with a hood and two cold eyes; fades between dashes */
  rimewraith(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e), statue = e.state === 'statue';
    if (e.state === 'fade') ctx.globalAlpha *= 0.3;
    ctx.beginPath(); ctx.moveTo(r * 0.6, -r * 0.7);
    for (let i = 0; i <= 8; i++) { const k = i / 8, a = -Math.PI / 2 - k * Math.PI, rr = r * (1 + (i % 2) * 0.35); ctx.lineTo(-r * 0.3 + Math.cos(a) * rr * 1.3 + (statue ? 0 : Math.sin(t * 8 + i) * 2), Math.sin(a) * rr * 0.9); }
    ctx.lineTo(r * 0.6, r * 0.7); ctx.closePath();
    ctx.fillStyle = lgrad(ctx, 0, 0, r, statue ? '#dff4ff' : col, la); ctx.fill(); ink(ctx, 2.8);
    ctx.beginPath(); ctx.ellipse(r * 0.3, 0, r * 0.52, r * 0.56, 0, 0, TAU); ctx.fillStyle = statue ? '#bfe3ff' : shade(col, -0.25); ctx.fill(); ink(ctx, 2.4);
    ctx.beginPath(); ctx.ellipse(r * 0.45, 0, r * 0.3, r * 0.36, 0, 0, TAU); ctx.fillStyle = statue ? '#8fbfe6' : '#141a33'; ctx.fill();
    if (!statue) { circle(ctx, r * 0.55, -r * 0.13, 2.6, '#9ff6ff', 0); circle(ctx, r * 0.55, r * 0.13, 2.6, '#9ff6ff', 0); }
    else { ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.4); ctx.lineTo(0, 0); ctx.lineTo(-r * 0.3, r * 0.5); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.stroke(); }
    if (e.state === 'dash') { ctx.save(); ctx.globalAlpha *= 0.4; for (let i = 1; i <= 3; i++) circle(ctx, -r * 1.1 * i, 0, r * (0.7 - i * 0.15), col, 0); ctx.restore(); }
  },
  /** Frozen Sentinel: an ice-armoured statue knight with a halberd (frosted over while dormant) */
  sentinel(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e), dormant = !e.woke && (e.state === 'idle' || !e.state);
    ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.95); ctx.lineTo(r * 1.6, r * 0.95); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#8a6a48'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 1.4, r * 0.6); ctx.quadraticCurveTo(r * 1.9, r * 0.95, r * 1.4, r * 1.3); ctx.lineTo(r * 1.55, r * 0.95); ctx.closePath(); ctx.fillStyle = '#dff4ff'; ctx.fill(); ink(ctx, 2.2);
    ball(ctx, 0, 0, r, col, la, 3.2, 0.5);
    ctx.beginPath(); ctx.ellipse(r * 0.3, 0, r * 0.5, r * 0.62, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, r * 0.3, 0, r * 0.6, '#a9c4e0', la); ctx.fill(); ink(ctx, 2.4);
    ctx.beginPath(); ctx.moveTo(r * 0.55, -r * 0.3); ctx.lineTo(r * 0.55, r * 0.3); ctx.strokeStyle = '#2b3a5a'; ctx.lineWidth = 4; ctx.stroke();
    if (e.state === 'guard') { ctx.beginPath(); ctx.ellipse(r * 1.0, 0, r * 0.3, r * 0.9, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, r, 0, r * 0.9, '#cfe9ff', la); ctx.fill(); ink(ctx, 3); star(ctx, r * 1.0, 0, 6, '#8fe3ff', 1.4); }
    if (dormant) { ctx.save(); ctx.globalAlpha *= 0.55; circle(ctx, 0, 0, r * 1.1, '#e8f8ff', 2, '#bfe3ff'); ctx.restore(); for (let i = 0; i < 4; i++) { const a = i * 1.7; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); ctx.lineTo(Math.cos(a + 0.3) * r * 0.9, Math.sin(a + 0.3) * r * 0.9); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.stroke(); } }
    else { circle(ctx, r * 0.62, -r * 0.14, 2.2, '#9ff6ff', 0); circle(ctx, r * 0.62, r * 0.14, 2.2, '#9ff6ff', 0); }
  },
  /** Rime Acolyte: a hooded frost cultist with a crystal staff */
  acolyte(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e);
    ctx.beginPath(); ctx.moveTo(0, r * 0.75); ctx.lineTo(r * 1.4, r * 0.75); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#d8e4f0'; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.save(); ctx.translate(r * 1.5, r * 0.75); ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fillStyle = '#8fe3ff'; ctx.fill(); ink(ctx, 2); ctx.restore();
    if (e.state === 'cast') bloom(ctx, r * 1.5, r * 0.75, 26, '#8fe3ff', 0.7);
    ctx.beginPath(); for (let i = 0; i <= 10; i++) { const a = Math.PI * 0.5 + (i / 10) * Math.PI, rr = r * (1 + (i % 2) * 0.12); ctx.lineTo(Math.cos(a) * rr * 1.05, Math.sin(a) * rr); } ctx.lineTo(r * 0.5, -r * 0.7); ctx.lineTo(r * 0.5, r * 0.7); ctx.closePath();
    ctx.fillStyle = lgrad(ctx, 0, 0, r, col, la); ctx.fill(); ink(ctx, 2.8);
    ctx.beginPath(); ctx.ellipse(r * 0.25, 0, r * 0.48, r * 0.5, 0, 0, TAU); ctx.fillStyle = shade(col, -0.3); ctx.fill(); ink(ctx, 2.2);
    ctx.beginPath(); ctx.ellipse(r * 0.4, 0, r * 0.26, r * 0.3, 0, 0, TAU); ctx.fillStyle = '#10142a'; ctx.fill();
    circle(ctx, r * 0.48, -r * 0.1, 1.8, '#9ff6ff', 0); circle(ctx, r * 0.48, r * 0.1, 1.8, '#9ff6ff', 0);
  },
  /** Ice Pawn: a glassy chess pawn standing on its tile */
  icepawn(ctx, e, t, col) { const r = e.r; upright(ctx, e); chessBase(ctx, r, col); ctx.beginPath(); ctx.ellipse(0, -r * 0.45, r * 0.55, r * 0.2, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, 0, -r * 0.45, r * 0.55, col); ctx.fill(); ink(ctx, 2.6); ball(ctx, 0, -r * 0.95, r * 0.5, col, LA, 3, 0.7); },
  /** Ice Knight: a glassy chess knight (horse head) */
  iceknight(ctx, e, t, col) {
    const r = e.r; upright(ctx, e); chessBase(ctx, r, col);
    ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 0.2); ctx.lineTo(-r * 0.5, -r * 1.2); ctx.quadraticCurveTo(-r * 0.2, -r * 1.9, r * 0.4, -r * 1.6); ctx.lineTo(r * 0.75, -r * 1.05); ctx.lineTo(r * 0.45, -r * 0.85); ctx.lineTo(r * 0.1, -r * 1.0); ctx.quadraticCurveTo(r * 0.4, -r * 0.5, r * 0.45, -r * 0.2); ctx.closePath();
    ctx.fillStyle = lgrad(ctx, 0, -r, r, col, LA, 0.45, -0.3); ctx.fill(); ink(ctx, 3);
    circle(ctx, r * 0.1, -r * 1.35, 2.6, '#1d3f8a', 0);
    ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 1.25); ctx.quadraticCurveTo(-r * 0.75, -r * 0.8, -r * 0.5, -r * 0.4); ctx.strokeStyle = '#8fd0ff'; ctx.lineWidth = 3; ctx.stroke();
  },
  /** Wrapped Gift (Morwen): a ribboned box that shakes when it is about to burst */
  gift(ctx, e, t, col) {
    const r = e.r; upright(ctx, e);
    const hot = e.life != null && e.life < 120; if (hot) ctx.translate(Math.sin(t * 50) * 3, 0);
    rrect(ctx, -r, -r * 0.9, r * 2, r * 1.8, 4); ctx.fillStyle = lgrad(ctx, 0, 0, r, col); ctx.fill(); ink(ctx, 3);
    ctx.fillStyle = '#ffe27a'; ctx.fillRect(-r * 0.18, -r * 0.9, r * 0.36, r * 1.8); ctx.fillRect(-r, -r * 0.15, r * 2, r * 0.3);
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * r * 0.4, -r * 1.05, r * 0.42, r * 0.24, sd * 0.4, 0, TAU); ctx.fillStyle = '#ffe27a'; ctx.fill(); ink(ctx, 2.4); }
    if (hot) { ctx.globalAlpha *= 0.5 + 0.5 * Math.sin(t * 20); circle(ctx, 0, 0, r * 1.4, null, 4, '#ff3b5c'); }
  },
  morwen: drawMorwen, vyrnhal: drawVyrnhal, skaldra: drawSkaldra, osric: drawOsric,
});

// ------------------------------------------------------------------ bosses
/** Mother Morwen, the Snow Globe: an old lilac crone sealed inside a glass dome full of drifting snow, a brass clock ring
 *  round the base with two needle hands; the snow inside whirls during the blizzard */
function drawMorwen(ctx, e, t, col) {
  const r = e.r; upright(ctx, e);
  const shk = e.state === 'shake' ? Math.sin(t * 40) * 4 : 0; ctx.translate(shk, 0);
  ctx.beginPath(); ctx.ellipse(0, r * 0.72, r * 1.05, r * 0.36, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, 0, r * 0.7, r, '#b8863a'); ctx.fill(); ink(ctx, 3.4);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; circle(ctx, Math.cos(a) * r * 0.92, r * 0.72 + Math.sin(a) * r * 0.3, 2.2, '#ffe9a8', 0); }
  ctx.beginPath(); ctx.moveTo(-r * 0.05, r * 0.72); ctx.lineTo(Math.cos(e.rot || 0) * r * 0.9, r * 0.72 + Math.sin(e.rot || 0) * r * 0.3); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.95, 0, TAU); ctx.clip();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 4, 0, 0, r); g.addColorStop(0, '#f6fbff'); g.addColorStop(1, '#a9c9ef'); ctx.fillStyle = g; ctx.fillRect(-r, -r * 1.1, r * 2, r * 2.1);
  // the crone inside
  ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.75); ctx.quadraticCurveTo(-r * 0.45, -r * 0.1, 0, -r * 0.2); ctx.quadraticCurveTo(r * 0.45, -r * 0.1, r * 0.5, r * 0.75); ctx.closePath(); ctx.fillStyle = lgrad(ctx, 0, r * 0.2, r * 0.6, col); ctx.fill(); ink(ctx, 2.6);
  ball(ctx, 0, -r * 0.38, r * 0.3, '#f3dcc8', LA, 2.6, 0.4);
  ctx.beginPath(); ctx.arc(0, -r * 0.42, r * 0.33, Math.PI * 1.05, Math.PI * 1.95); ctx.lineWidth = 7; ctx.strokeStyle = '#f4f4ff'; ctx.stroke();
  circle(ctx, -r * 0.1, -r * 0.38, 2.4, INK, 0); circle(ctx, r * 0.1, -r * 0.38, 2.4, INK, 0);
  ctx.beginPath(); ctx.arc(0, -r * 0.27, r * 0.08, 0.2, Math.PI - 0.2); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  const spin = e.state === 'blizzard' || e.phase >= 2 ? 3 : 0.6;
  for (let i = 0; i < 26; i++) { const a = i * 2.39 + t * spin * (i % 2 ? 1 : -0.7), rr = r * (0.25 + ((i * 37) % 60) / 85); const fy = ((i * 0.13 + t * 0.12) % 1); circle(ctx, Math.cos(a) * rr, -r * 0.9 + fy * r * 1.6 * (spin > 1 ? 0.5 : 1) + (spin > 1 ? Math.sin(a) * rr * 0.6 + r * 0.4 : 0), 2 + (i % 3), '#ffffff', 0); }
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.95, 0, TAU); ctx.lineWidth = 3.6; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.82, Math.PI * 1.1, Math.PI * 1.45); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.stroke();
  if (e.phase >= 2) { ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.95); ctx.lineTo(r * 0.35, -r * 0.6); ctx.lineTo(r * 0.25, -r * 0.4); ctx.lineTo(r * 0.5, -r * 0.2); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke(); }
}
/** Vyrnhal, the Echo Stag: a pale-blue crystal stag (top-down: long body, neck, head forward) with huge branching antlers */
function drawVyrnhal(ctx, e, t, col) {
  const r = e.r, la = lightLocal(e), run = e.state === 'charge' || e.state === 'stampede';
  const gait = run ? Math.sin(t * 22) : Math.sin(t * 6) * 0.4;
  for (const [lx, sd, ph] of [[0.55, -1, 0], [0.55, 1, Math.PI], [-0.55, -1, Math.PI], [-0.55, 1, 0]]) { const sw = Math.sin(t * (run ? 22 : 6) + ph) * r * 0.18; ctx.beginPath(); ctx.moveTo(r * lx, sd * r * 0.3); ctx.lineTo(r * lx + sw, sd * r * 0.62); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = shade(col, -0.25); ctx.lineWidth = 3.5; ctx.stroke(); }
  oval(ctx, -r * 0.1, 0, r * 0.95, r * 0.45, col, la, 3.4, 0, 0.5);
  ctx.beginPath(); ctx.ellipse(-r * 0.95, 0, r * 0.16, r * 0.12, 0, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); ink(ctx, 2);
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.6 + i * r * 0.3, -r * 0.25); ctx.lineTo(-r * 0.5 + i * r * 0.3, 0); ctx.lineTo(-r * 0.6 + i * r * 0.3, r * 0.25); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.stroke(); }
  oval(ctx, r * 0.75, gait * 2, r * 0.4, r * 0.22, col, la, 3, 0, 0.5);
  oval(ctx, r * 1.1, gait * 2, r * 0.28, r * 0.17, shade(col, 0.1), la, 2.8, 0, 0.5);
  circle(ctx, r * 1.38, gait * 2, r * 0.07, '#2b3a5a', 0);
  circle(ctx, r * 1.12, gait * 2 - r * 0.11, 2.4, e.ghost ? '#fff' : '#1d3f8a', 0); circle(ctx, r * 1.12, gait * 2 + r * 0.11, 2.4, e.ghost ? '#fff' : '#1d3f8a', 0);
  const lit = e.state === 'antlers' || e.state === 'crown';
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(r * 1.0, gait * 2 + sd * r * 0.12); ctx.quadraticCurveTo(r * 0.85, sd * r * 0.8, r * 0.35, sd * r * 1.15);
    ctx.moveTo(r * 0.9, sd * r * 0.5); ctx.lineTo(r * 1.25, sd * r * 0.85); ctx.moveTo(r * 0.72, sd * r * 0.78); ctx.lineTo(r * 0.85, sd * r * 1.2); ctx.moveTo(r * 0.5, sd * r * 1.02); ctx.lineTo(r * 0.45, sd * r * 1.4);
    ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = lit ? '#ffffff' : '#bff0ff'; ctx.lineWidth = 4; ctx.stroke();
  }
  if (lit && !e.ghost) bloom(ctx, r * 0.8, 0, r * 1.6, '#9fe8ff', 0.5);
}
/** Skaldra, the Glacier Wyrm: a long serpentine ice dragon coiled on the summit (top-down: segmented body trailing behind,
 *  crested head forward, crystal spines); in the Whiteout she is a moving mound of snow */
function drawSkaldra(ctx, e, t, col) {
  const r = e.r, la = lightLocal(e);
  if (e.state === 'whiteout' || e.untargetable) {
    ctx.save(); ctx.globalAlpha *= 0.9; ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, rr = r * (0.9 + 0.12 * Math.sin(i * 3 + t * 6)); i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.8) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.8); } ctx.closePath();
    ctx.fillStyle = lgrad(ctx, 0, 0, r, '#f4faff', la); ctx.fill(); ink(ctx, 3); ctx.restore();
    for (let i = 0; i < 5; i++) { const a = t * 3 + i * 1.3; circle(ctx, Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.5, 4, '#ffffff', 1.4); }
    return;
  }
  const n = 7, wav = Math.sin(t * 3);
  const segs = []; for (let i = n; i >= 1; i--) segs.push([-r * 0.62 * i, Math.sin(t * 3 - i * 0.7) * r * 0.32 * (i / n + 0.3), r * (0.62 - i * 0.055)]);
  ctx.beginPath(); ctx.moveTo(-r * 0.62 * (n + 0.9), Math.sin(t * 3 - n * 0.7) * r * 0.3); ctx.lineTo(segs[0][0], segs[0][1] - 4); ctx.lineTo(segs[0][0], segs[0][1] + 4); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ink(ctx, 2.4);
  for (const [x, y, rr] of segs) { ball(ctx, x, y, rr, shade(col, -0.05), la, 3, 0.45); ctx.beginPath(); ctx.moveTo(x - rr * 0.3, y); ctx.lineTo(x + rr * 0.2, y - rr * 0.1); ctx.lineTo(x + rr * 0.2, y + rr * 0.1); ctx.closePath(); ctx.fillStyle = '#e8fbff'; ctx.fill(); ink(ctx, 1.6); }
  // wings: spread ice sails while breathing / avalanche
  const spread = e.state === 'breath' || e.state === 'avalanche' ? 1 : 0.55 + 0.1 * wav;
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(-r * 0.1, sd * r * 0.3); ctx.lineTo(-r * 0.7, sd * r * (0.9 + spread * 0.9)); ctx.lineTo(-r * 0.95, sd * r * (0.5 + spread * 0.5)); ctx.lineTo(-r * 1.3, sd * r * (0.7 + spread * 0.6)); ctx.lineTo(-r * 0.9, sd * r * 0.3); ctx.closePath();
    ctx.fillStyle = lgrad(ctx, -r * 0.6, sd * r * 0.8, r, '#bfe8ff', la, 0.4, -0.25); ctx.fill(); ink(ctx, 2.8);
  }
  ball(ctx, 0, 0, r * 0.62, col, la, 3.4, 0.5);
  ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.34); ctx.quadraticCurveTo(r * 1.3, -r * 0.3, r * 1.25, 0); ctx.quadraticCurveTo(r * 1.3, r * 0.3, r * 0.3, r * 0.34); ctx.closePath(); ctx.fillStyle = lgrad(ctx, r * 0.8, 0, r * 0.6, shade(col, 0.08), la); ctx.fill(); ink(ctx, 3.2);
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.45, sd * r * 0.3); ctx.lineTo(r * 0.0, sd * r * 0.75); ctx.lineTo(r * 0.35, sd * r * 0.42); ctx.closePath(); ctx.fillStyle = '#e8fbff'; ctx.fill(); ink(ctx, 2.2); circle(ctx, r * 0.85, sd * r * 0.16, 3.2, e.phase >= 3 ? '#ff5e7a' : '#1d3f8a', 0); }
  if (e.state === 'breath') { bloom(ctx, r * 1.3, 0, r * 0.9, '#9fe8ff', 0.8); }
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.4 + i * r * 0.2, -4); ctx.lineTo(-r * 0.3 + i * r * 0.2, -r * 0.16); ctx.lineTo(-r * 0.2 + i * r * 0.2, -4); ctx.fillStyle = '#ffffff'; ctx.fill(); ink(ctx, 1.4); }
}
/** Osric, the Rimeking: a giant glass chess king on his throne tile (upright), crown with a cross, a frost-blue cloak */
function drawOsric(ctx, e, t, col) {
  const r = e.r; upright(ctx, e);
  ctx.beginPath(); ctx.ellipse(0, r * 0.55, r * 1.05, r * 0.45, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, 0, r * 0.55, r, '#4d6fa8'); ctx.fill(); ink(ctx, 3.4);
  ctx.beginPath(); ctx.moveTo(-r * 0.85, r * 0.5); ctx.quadraticCurveTo(-r * 0.6, -r * 0.2, -r * 0.35, -r * 0.55); ctx.lineTo(r * 0.35, -r * 0.55); ctx.quadraticCurveTo(r * 0.6, -r * 0.2, r * 0.85, r * 0.5); ctx.closePath();
  ctx.fillStyle = lgrad(ctx, 0, 0, r, col, LA, 0.45, -0.3); ctx.fill(); ink(ctx, 3.2);
  ctx.beginPath(); ctx.moveTo(-r * 0.25, -r * 0.45); ctx.lineTo(-r * 0.5, r * 0.35); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -r * 0.6, r * 0.55, r * 0.17, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, 0, -r * 0.6, r * 0.55, col); ctx.fill(); ink(ctx, 2.8);
  ball(ctx, 0, -r * 0.95, r * 0.36, '#e8f6ff', LA, 3, 0.6);
  circle(ctx, -r * 0.12, -r * 0.98, 3, '#1d3f8a', 0); circle(ctx, r * 0.12, -r * 0.98, 3, '#1d3f8a', 0);
  ctx.beginPath(); ctx.moveTo(-r * 0.38, -r * 1.15); for (let i = 0; i <= 4; i++) ctx.lineTo(-r * 0.38 + i * r * 0.19, -r * (i % 2 ? 1.3 : 1.48)); ctx.lineTo(r * 0.38, -r * 1.15); ctx.closePath(); ctx.fillStyle = '#ffe27a'; ctx.fill(); ink(ctx, 2.6);
  ctx.fillStyle = '#ffe27a'; rrect(ctx, -r * 0.06, -r * 1.85, r * 0.12, r * 0.4, 2); ctx.fill(); ink(ctx, 2); rrect(ctx, -r * 0.18, -r * 1.73, r * 0.36, r * 0.11, 2); ctx.fill(); ink(ctx, 2);
  if (e.cc && e.cc.stun > 0) { ctx.save(); ctx.globalAlpha *= 0.5 + 0.3 * Math.sin(t * 12); circle(ctx, 0, -r * 0.2, r * 1.3, null, 5, '#7dffb0'); ctx.restore(); }
}

// ------------------------------------------------------------------ events (fx.js routes {type:'frost'} here)
export const FROST_UNLOCK_TXT = {
  frost: ['FROSTVEIL GATE FOUND', '#8fe3ff', 'Attune it on the Realm Gate map with 2 Sunbound Sigils (Neferakh Unbound)'],
  crypt: ['GLACIER CRYPT CLEARED', '#bfeaff', 'Replay the Crypt from the Mission Counter any time'],
};
export function frostEventFx(fx, ev, me) {
  const x = ev.x, y = ev.y, has = x != null;
  const lp = fx.sim && fx.sim.players && fx.sim.players.get ? fx.sim.players.get(fx.localPid) : null; // (me = this event is about the local player)
  const near = (R) => !lp || !has || Math.hypot(lp.x - x, lp.y - y) < R;
  switch (ev.ph) {
    case 'call': if (near(1800)) fx.banner(ev.txt, ev.col || '#9fe8ff', ev.sub || '', 2.4, 40); break;
    case 'roar': if (has) { fx.ring(x, y, 220, '#e8fbff', 0.6, 9); fx.puffs(x, y, 20, '#ffffff', 18, 300, 0.8); } fx.shake(0.45); break;
    case 'portal': if (!near(2600)) break; if (has) { fx.ring(x, y, ev.big ? 140 : 100, '#6fb8ff', 0.8, 8); fx.ring(x, y, 60, '#ffffff', 0.6, 5); fx.sparks(x, y, -Math.PI / 2, 24, '#dff6ff', 420, 1.6); } fx.banner('THE GLACIER CRYPT OPENS!', '#8fe3ff', 'Step into the portal before it freezes shut', 2.6, 40); break;
    case 'giftPop': if (has) { fx.sparks(x, y, 0, 10, '#ffe27a', 220, TAU); fx.ring(x, y, 40, '#ff8fb0', 0.3, 4); } break;
    case 'giftTick': if (has) fx.ring(x, y, 30, '#ff3b5c', 0.25, 3); break;
    case 'giftBoom': if (has) { fx.ring(x, y, ev.r || 120, '#ff8fb0', 0.45, 9); fx.sparks(x, y, 0, 20, '#ffe27a', 380, TAU); fx.puffs(x, y, 10, '#ffffff', 14, 200, 0.6); } fx.shake(0.25); break;
    case 'snowball': if (has) { fx.puffs(x, y, 10, '#ffffff', 14, 200, 0.6); fx.ring(x, y, ev.r || 70, '#e8fbff', 0.35, 5); } break;
    case 'shards': if (has) fx.sparks(x, y, 0, 16, '#bfefff', 320, TAU); break;
    case 'erupt': if (has) { fx.ring(x, y, ev.r || 140, '#ffffff', 0.5, 10); fx.puffs(x, y, 24, '#f4faff', 22, 340, 0.9); fx.sparks(x, y, 0, 18, '#9fe8ff', 420, TAU); } fx.shake(0.55); break;
    case 'echo': if (has) { fx.ring(x, y, 90, '#9fe8ff', 0.5, 5); fx.ring(x, y, 50, '#ffffff', 0.35, 3); } break;
    case 'stillCast': if (has) { fx.ring(x, y, 420, '#ffffff', 0.9, 10); fx.ring(x, y, 220, '#9fe8ff', 0.7, 6); } break;
    case 'still': if (has) fx.ring(x, y, 600, '#dff6ff', 0.6, 14); if (lp && near(900)) fx.text(lp.x, lp.y - 60, 'TIME RESUMES', { size: 20, color: '#9fe8ff', vy: -40, life: 0.9 }); break;
    case 'mirror': if (has) { fx.ring(x, y, 80, '#e8fbff', 0.45, 6); fx.sparks(x, y, 0, 14, '#ffffff', 300, TAU); } break;
    case 'shake': if (near(1200)) fx.shake(0.6); break;
    case 'flung': if (has) fx.puffs(x, y, 8, '#ffffff', 12, 160, 0.5); if (lp && ev.id === lp.id) fx.text(lp.x, lp.y - 50, 'FLUNG!', { size: 18, color: '#ff8fb0', vy: -40, life: 0.8 }); break;
    case 'avalanche': if (has) { fx.puffs(x, y, 30, '#ffffff', 26, 380, 1); fx.ring(x, y, 260, '#e8fbff', 0.7, 12); } fx.shake(0.7); break;
    case 'whiteout': if (near(1600)) fx.banner('WHITEOUT', '#ffffff', 'Follow the moving snow mound · she erupts under you', 2, 36); break;
    case 'bounce': if (has) fx.sparks(x, y, 0, 8, '#bfefff', 200, TAU); break;
    case 'wake': if (has) { fx.sparks(x, y, 0, 18, '#dff4ff', 300, TAU); fx.ring(x, y, 60, '#bfe3ff', 0.4, 5); } break;
  }
}
