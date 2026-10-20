// The Wilds, redrawn for the bigger organic island (art & world pass): ground painter (baked into the ground tile
// cache by client/ground.js: coast, danger-ring grass bands, mottled light patches, grass/flower/pebble texture
// strokes, dirt roads, landmarks, boss-arena floors), the live overlays (campfire, arena rims, lake glints) and the
// detailed props (trees, rocks, ridge cliffs, ruin pillars, menhirs, the watchtower, bushes) as cached sprites.
// Same code-drawn style as the Dunes/Tomb art: layered shading, rim light, ink outlines, texture strokes, decals.
import { INK, circle, ellipse, shadow, shade, star, rrect } from './art.js';
import { lgrad, rimArc, ink, ball, oval, poly } from './dunesfx.js';
import { sprite, blit, glowSprite } from './sprite.js';
import { wpOn, wpTile, wpPattern, wpDecal, wpPropDirect, wpHas } from './worldpaint.js';
import { ZONES, BOSS_POS, BOSS_ARENA_R, zoneAt } from '../sim/constants.js';
import { WILDS_SHAPE as WS, WILDS_R, WILDS_RINGS, WILDS_ROADS, WILDS_RIVER, WILDS_BRIDGES, wildsSite } from '../sim/mapshape.js';

const TAU = Math.PI * 2, LA = -2.3;
export const ZONE_GROUND = ['#8fd664', '#72c44e', '#a9b95b', '#cfa862', '#7e6b88'];
const ZONE_DARK = ['#6fb54c', '#5aa83e', '#8a9a48', '#b08a4c', '#62536e'];
const ZONE_LITE = ['#b5ea86', '#97dc6c', '#c6d37a', '#e6c47e', '#9a88a8'];
export const WATER = '#3fa9e0';
const H = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const SITES = { grimtusk: wildsSite('grimtusk'), thornmaw: wildsSite('thornmaw'), ashfang: wildsSite('ashfang'), lake: wildsSite('lake'), stones: wildsSite('stones'), tower: wildsSite('tower') };
export { SITES as WILDS_SITE_POS };
const BB = WS.max + 120;
export const wildsVisible = (view) => view.x1 > -BB && view.x0 < BB && view.y1 > -BB && view.y0 < BB;

const pathCache = new Map();
/** Path2D of a shape iso-line (effective radius re, extra pad in world units). */
export function shapePath(S, re, pad = 0, n = 540) {
  const k = S.cx + ':' + S.cy + ':' + re + ':' + pad;
  let p = pathCache.get(k);
  if (!p) { p = new Path2D(); const L = S.loops ? S.loops(re, pad) : [S.outline(re, n, pad)]; for (const pts of L) { p.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]); p.closePath(); } pathCache.set(k, p); }
  return p;
}
/** Smooth road path (quadratic through midpoints). */
export function roadPath(pts) {
  const p = new Path2D(); p.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) { const m = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 }; p.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y); }
  const L = pts[pts.length - 1]; p.lineTo(L.x, L.y); return p;
}
let ROADS_ = null; const roadsP = () => ROADS_ || (ROADS_ = WILDS_ROADS.map(roadPath));

// ------------------------------------------------------------------ the sea (static: baked into tiles)
export function paintWater(g, view) {
  g.fillStyle = WATER; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  const C = 90;
  g.lineCap = 'round';
  const lite = new Path2D(), dark = new Path2D();
  for (let cx = Math.floor(view.x0 / C); cx <= Math.floor(view.x1 / C); cx++) for (let cy = Math.floor(view.y0 / C); cy <= Math.floor(view.y1 / C); cy++) {
    const h = H(cx + 501, cy - 77); if (h > 0.5) continue;
    const x = cx * C + H(cx, cy + 3) * C, y = cy * C + H(cx + 5, cy) * C, w = 14 + h * 22;
    (h < 0.25 ? lite : dark).moveTo(x - w, y); (h < 0.25 ? lite : dark).quadraticCurveTo(x, y - 7, x + w, y);
  }
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 3.5; g.stroke(lite);
  g.strokeStyle = 'rgba(16,80,140,.22)'; g.lineWidth = 3; g.stroke(dark);
}

// ------------------------------------------------------------------ the island ground (static: baked into tiles)
export function paintWilds(g, view) {
  if (!wildsVisible(view)) return false;
  if (wpOn() && paintedReady()) return paintWildsPainted(g, view);
  // shallows, beach, wet sand, foam
  g.fillStyle = 'rgba(150,225,250,.45)'; g.fill(shapePath(WS, WILDS_R, 120), 'evenodd');
  g.fillStyle = 'rgba(190,240,255,.35)'; g.fill(shapePath(WS, WILDS_R, 70), 'evenodd');
  g.fillStyle = '#f2dc9b'; g.fill(shapePath(WS, WILDS_R, WS.shore), 'evenodd');
  g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke(shapePath(WS, WILDS_R, 50));
  g.lineWidth = 10; g.strokeStyle = 'rgba(200,160,90,.35)'; g.stroke(shapePath(WS, WILDS_R, 14));
  // danger regions (pass 2: an irregular field, not rings): the whole island in Dread-Frontier ground, then each safer
  // region on top, clipped to the coast; soft blended seams along every region border
  g.save(); g.clip(shapePath(WS, WILDS_R, 0), 'evenodd');
  g.fillStyle = ZONE_GROUND[ZONES.length - 1]; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  for (let i = ZONES.length - 1; i >= 2; i--) { g.fillStyle = ZONE_GROUND[i - 1]; g.fill(shapePath(WS, ZONES[i].r0, 0), 'evenodd'); }
  for (let i = 2; i < ZONES.length; i++) {
    const p = shapePath(WS, ZONES[i].r0, 0);
    g.globalAlpha = 0.35; g.lineWidth = 110; g.strokeStyle = ZONE_GROUND[i - 1]; g.stroke(p);
    g.lineWidth = 50; g.strokeStyle = ZONE_GROUND[i]; g.globalAlpha = 0.3; g.stroke(p); g.globalAlpha = 1;
  }
  // big mottled light / shade patches (layered shading on the ground)
  const B = 260;
  for (let cx = Math.floor(view.x0 / B) - 1; cx <= Math.floor(view.x1 / B) + 1; cx++) for (let cy = Math.floor(view.y0 / B) - 1; cy <= Math.floor(view.y1 / B) + 1; cy++) {
    const h = H(cx * 7 + 3, cy * 11 - 5), x = cx * B + H(cx, cy + 1) * B, y = cy * B + H(cx + 2, cy) * B, z = zoneAt(x, y).id;
    g.fillStyle = h < 0.5 ? ZONE_LITE[z] : ZONE_DARK[z]; g.globalAlpha = 0.18 + H(cx, cy) * 0.14;
    g.beginPath(); g.ellipse(x, y, 90 + h * 120, 60 + H(cy, cx) * 80, H(cx + 9, cy) * 3, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
  // haven
  g.fillStyle = ZONE_GROUND[0]; g.beginPath(); g.arc(0, 0, ZONES[0].r1, 0, TAU); g.fill();
  g.globalAlpha = 0.4; g.lineWidth = 60; g.strokeStyle = ZONE_GROUND[0]; g.stroke(); g.globalAlpha = 1;
  southmeadow(g, view);
  river(g, view);
  roads(g, view);
  bridges(g, view);
  texture(g, view);
  // zone borders (soft dark seam + dashed light line)
  for (let i = 1; i < ZONES.length; i++) {
    const p = i === 1 ? null : shapePath(WS, ZONES[i].r0, 0);
    if (i === 1) { g.beginPath(); g.arc(0, 0, ZONES[1].r0, 0, TAU); }
    g.strokeStyle = 'rgba(40,30,50,.16)'; g.lineWidth = 12; p ? g.stroke(p) : g.stroke();
    g.setLineDash([26, 20]); g.strokeStyle = i === 1 ? 'rgba(255,255,255,.65)' : 'rgba(255,240,200,.42)'; g.lineWidth = 4; p ? g.stroke(p) : g.stroke(); g.setLineDash([]);
  }
  plaza(g);
  landmarks(g, view);
  arenas(g, view);
  g.restore();
  return true;
}
// ------------------------------------------------------------------ painted world (Art style = Painted)
const W_TILES = ['T1', 'T2', 'T3', 'T4', 'T5', 'T13'];
const ZT = ['T1', 'T1', 'T2', 'T3', 'T4'];
function paintedReady() { let ok = true; for (const t of W_TILES) if (!wpTile(t)) ok = false; return ok && wpHas('d_grimtusk', 'd_thornmaw', 'd_ashfang', 'd_stones', 'd_lake', 'd_rubble', 'campfire'); }
function paintWildsPainted(g, view) {
  // same coast as the code-drawn island (shallows, beach, foam), then the painted ground textures per danger region
  g.fillStyle = 'rgba(150,225,250,.45)'; g.fill(shapePath(WS, WILDS_R, 120), 'evenodd');
  g.fillStyle = 'rgba(190,240,255,.35)'; g.fill(shapePath(WS, WILDS_R, 70), 'evenodd');
  g.fillStyle = '#e9d39a'; g.fill(shapePath(WS, WILDS_R, WS.shore), 'evenodd');
  g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,.6)'; g.stroke(shapePath(WS, WILDS_R, 50));
  g.save(); g.clip(shapePath(WS, WILDS_R, 0), 'evenodd');
  const P = (id) => wpPattern(g, id, 440);
  g.fillStyle = P(ZT[4]); g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  for (let i = ZONES.length - 1; i >= 2; i--) { g.fillStyle = P(ZT[i - 1]); g.fill(shapePath(WS, ZONES[i].r0, 0), 'evenodd'); }
  // soft seams: each border stroked wide with both neighbouring textures at partial alpha
  for (let i = 2; i < ZONES.length; i++) {
    const p = shapePath(WS, ZONES[i].r0, 0);
    g.globalAlpha = 0.45; g.lineWidth = 130; g.strokeStyle = P(ZT[i - 1]); g.stroke(p);
    g.globalAlpha = 0.35; g.lineWidth = 60; g.strokeStyle = P(ZT[i]); g.stroke(p);
    g.globalAlpha = 0.5; g.lineWidth = 16; g.strokeStyle = 'rgba(40,30,30,.18)'; g.stroke(p); g.globalAlpha = 1;
  }
  // gentle light / shade mottling (breaks up the texture repeat)
  const B = 300;
  for (let cx = Math.floor(view.x0 / B) - 1; cx <= Math.floor(view.x1 / B) + 1; cx++) for (let cy = Math.floor(view.y0 / B) - 1; cy <= Math.floor(view.y1 / B) + 1; cy++) {
    const h = H(cx * 7 + 3, cy * 11 - 5), x = cx * B + H(cx, cy + 1) * B, y = cy * B + H(cx + 2, cy) * B;
    g.fillStyle = h < 0.5 ? 'rgba(255,245,200,1)' : 'rgba(20,30,20,1)'; g.globalAlpha = 0.05 + H(cx, cy) * 0.06;
    g.beginPath(); g.ellipse(x, y, 110 + h * 140, 70 + H(cy, cx) * 90, H(cx + 9, cy) * 3, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
  // haven: a warmer sunlit clearing
  const hv = g.createRadialGradient(0, 0, 60, 0, 0, ZONES[0].r1 + 60); hv.addColorStop(0, 'rgba(255,240,170,.16)'); hv.addColorStop(1, 'rgba(255,240,170,0)');
  g.fillStyle = hv; g.beginPath(); g.arc(0, 0, ZONES[0].r1 + 60, 0, TAU); g.fill();
  river(g, view);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = 84; g.strokeStyle = 'rgba(60,45,25,.22)'; for (const p of roadsP()) g.stroke(p);
  g.lineWidth = 66; g.strokeStyle = wpPattern(g, 'T5', 300); for (const p of roadsP()) g.stroke(p);
  g.lineWidth = 6; g.strokeStyle = 'rgba(70,55,30,.25)'; for (const p of roadsP()) g.stroke(p);
  bridges(g, view);
  for (let i = 1; i < ZONES.length; i++) { // zone borders: faint dashed line only (the textures already change)
    const p = i === 1 ? null : shapePath(WS, ZONES[i].r0, 0);
    if (i === 1) { g.beginPath(); g.arc(0, 0, ZONES[1].r0, 0, TAU); }
    g.setLineDash([26, 20]); g.strokeStyle = i === 1 ? 'rgba(255,255,255,.45)' : 'rgba(255,240,200,.3)'; g.lineWidth = 4; p ? g.stroke(p) : g.stroke(); g.setLineDash([]);
  }
  // plaza (painted cobble disc) + the campfire
  if (near(view, 0, 0, 220)) {
    circle(g, 0, 0, 178, 'rgba(50,35,25,.22)', 0);
    g.fillStyle = wpPattern(g, 'T13', 260); g.beginPath(); g.arc(0, 0, 170, 0, TAU); g.fill();
    g.lineWidth = 6; g.strokeStyle = 'rgba(60,45,35,.55)'; g.stroke();
    wpPropDirect(g, 'campfire', 0, 22, 66);
  }
  // landmarks + boss arenas: painted decals (A1)
  const dec = (name, s, d) => { if (near(view, s.x, s.y, d / 2 + 20)) wpDecal(g, name, s.x, s.y, d); };
  dec('d_lake', SITES.lake, (SITES.lake.r + 70) * 2);
  dec('d_stones', SITES.stones, (SITES.stones.r + 70) * 2);
  dec('d_rubble', SITES.tower, 440);
  dec('d_grimtusk', BOSS_POS, (BOSS_ARENA_R + 60) * 2);
  dec('d_thornmaw', SITES.thornmaw, (SITES.thornmaw.r + 70) * 2);
  dec('d_ashfang', SITES.ashfang, (SITES.ashfang.r + 70) * 2);
  g.restore();
  return true;
}

const near = (view, x, y, r) => x + r > view.x0 && x - r < view.x1 && y + r > view.y0 && y - r < view.y1;

// ------------------------------------------------------------------ the river Ashwater + its bridges (baked into tiles)
let RIVER_P_ = null; const riverP = () => RIVER_P_ || (RIVER_P_ = roadPath(WILDS_RIVER)); const RC = 160, RIVER_GRID = new Map();
for (let i = 1; i < WILDS_RIVER.length; i++) { const a = WILDS_RIVER[i - 1], b = WILDS_RIVER[i], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 30); for (let k = 0; k < n; k++) { const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n, key = Math.floor(x / RC) + ',' + Math.floor(y / RC); let l = RIVER_GRID.get(key); if (!l) RIVER_GRID.set(key, (l = [])); l.push(x, y); } }
/** is (x, y) within pad of the river's centre line? */
export function nearRiver(x, y, pad) {
  const cx = Math.floor(x / RC), cy = Math.floor(y / RC), p2 = pad * pad;
  for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) { const l = RIVER_GRID.get(i + ',' + j); if (l) for (let k = 0; k < l.length; k += 2) if ((l[k] - x) ** 2 + (l[k + 1] - y) ** 2 < p2) return true; }
  return false;
}
function river(g, view) {
  if (!WILDS_RIVER.some((q) => near(view, q.x, q.y, 400))) return;
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [w, col] of [[200, 'rgba(70,60,40,.22)'], [176, '#8c7a50'], [158, '#6f8f4e'], [140, '#2b78b4'], [118, '#3492cc'], [76, '#45a6dc'], [30, 'rgba(120,200,240,.55)']]) { g.lineWidth = w; g.strokeStyle = col; g.stroke(riverP()); }
  // reed clumps + wet stones on the banks, flow streaks on the water
  for (let i = 1; i < WILDS_RIVER.length; i++) {
    const a = WILDS_RIVER[i - 1], b = WILDS_RIVER[i], L = Math.hypot(b.x - a.x, b.y - a.y), nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
    if (!near(view, a.x, a.y, 300)) continue;
    for (let k = 0; k < 3; k++) {
      const t = H(i, k + 40), s = H(k, i + 40) < 0.5 ? -1 : 1, x = a.x + (b.x - a.x) * t + nx * s * (80 + H(i + k, 3) * 18), y = a.y + (b.y - a.y) * t + ny * s * (80 + H(i + k, 3) * 18);
      if (WILDS_BRIDGES.some((q) => Math.hypot(q.x - x, q.y - y) < 160)) continue;
      if (k === 2) { g.fillStyle = '#7c7568'; g.beginPath(); g.ellipse(x, y, 9, 6, t * 3, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(x - 2, y - 2, 4, 2.5, 0, 0, TAU); g.fill(); continue; }
      g.strokeStyle = '#3f6a2a'; g.lineWidth = 3; g.beginPath();
      for (let r = 0; r < 5; r++) { const ox = (r - 2) * 4; g.moveTo(x + ox, y + 4); g.quadraticCurveTo(x + ox * 1.6, y - 10, x + ox * 2.2, y - 20 - (r % 2) * 6); }
      g.stroke(); g.fillStyle = '#7a4a26'; g.beginPath(); g.ellipse(x + 3, y - 20, 2.5, 6, 0.2, 0, TAU); g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 3;
    for (let k = 0; k < 2; k++) { const t = H(i, k + 70), o = (H(k + 70, i) - 0.5) * 70, x = a.x + (b.x - a.x) * t + nx * o, y = a.y + (b.y - a.y) * t + ny * o, ux = (b.x - a.x) / L, uy = (b.y - a.y) / L; g.beginPath(); g.moveTo(x - ux * 22, y - uy * 22); g.quadraticCurveTo(x + nx * 4, y + ny * 4, x + ux * 22, y + uy * 22); g.stroke(); }
  }
}
function bridges(g, view) {
  for (const q of WILDS_BRIDGES) {
    if (!near(view, q.x, q.y, 220)) continue;
    g.save(); g.translate(q.x, q.y); g.rotate(q.ang);
    const L = 125, W = 46;
    g.fillStyle = 'rgba(20,30,40,.3)'; g.fillRect(-L + 6, -W + 10, L * 2, W * 2);
    g.fillStyle = '#5a3d24'; g.fillRect(-L, -W, L * 2, W * 2);
    for (let x = -L + 4; x < L - 4; x += 15) { g.fillStyle = (x / 15 | 0) % 2 ? '#a8794a' : '#9a6c40'; g.fillRect(x, -W + 4, 13, W * 2 - 8); g.fillStyle = 'rgba(255,230,190,.25)'; g.fillRect(x, -W + 4, 13, 3); }
    for (const s of [-1, 1]) { g.fillStyle = '#4a321e'; g.fillRect(-L, s * W - 5, L * 2, 10); g.fillStyle = 'rgba(255,220,170,.35)'; g.fillRect(-L, s * W - 5, L * 2, 2.5); for (let x = -L; x <= L; x += 50) { g.fillStyle = '#3c2716'; g.fillRect(x - 6, s * W - 8, 12, 16); g.fillStyle = 'rgba(255,220,170,.4)'; g.fillRect(x - 6, s * W - 8, 12, 3); } }
    g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(-L, -W - 5, L * 2, W * 2 + 10);
    g.restore();
  }
}
function southmeadow(g, view) {
  if (!near(view, 0, 975, 1500)) return;
  for (let i = 0; i < 26; i++) {
    const x = -1150 + H(i, 3) * 2300, y = 320 + H(i, 7) * 1300; if (!near(view, x, y, 120)) continue;
    g.fillStyle = 'rgba(190,240,140,.25)'; g.beginPath(); g.ellipse(x, y, 80 + H(i, 9) * 70, 40 + H(i, 1) * 40, H(i, 2) * 3, 0, TAU); g.fill();
    for (let k = 0; k < 14; k++) { const fx = x + (H(i, k + 20) - 0.5) * 150, fy = y + (H(k + 20, i) - 0.5) * 80; flower(g, fx, fy, ['#fff', '#ffe45c', '#ff8fb1', '#9fd4ff', '#ffb35c'][(i + k) % 5]); }
  }
}
function roads(g, view) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [w, col] of [[78, 'rgba(90,70,40,.22)'], [64, '#a88a5c'], [54, '#cdb07a'], [40, '#dcc290']]) { g.lineWidth = w; g.strokeStyle = col; for (const p of roadsP()) g.stroke(p); }
  // wheel ruts + stones along the roads
  g.setLineDash([30, 14]); g.lineWidth = 3; g.strokeStyle = 'rgba(120,90,50,.35)';
  for (const p of roadsP()) { g.save(); g.translate(-8, -6); g.stroke(p); g.translate(16, 12); g.stroke(p); g.restore(); }
  g.setLineDash([]);
  for (const pts of WILDS_ROADS) for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.floor(L / 46);
    for (let k = 0; k < n; k++) {
      const t = k / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, h = H(Math.round(x), Math.round(y)); if (h > 0.55 || !near(view, x, y, 40)) continue;
      const ox = (H(k, i) - 0.5) * 50, oy = (H(i, k) - 0.5) * 50;
      g.fillStyle = h < 0.2 ? '#b8a07a' : '#9c8662'; g.beginPath(); g.ellipse(x + ox, y + oy, 3 + h * 6, 2 + h * 4, h * 3, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,250,230,.55)'; g.beginPath(); g.ellipse(x + ox - 1, y + oy - 1, 1.5 + h * 2, 1 + h * 1.3, 0, 0, TAU); g.fill();
    }
  }
}
function flower(g, x, y, col) {
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; g.beginPath(); g.arc(x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6, 2.9, 0, TAU); g.fillStyle = col; g.fill(); }
  g.beginPath(); g.arc(x, y, 2.3, 0, TAU); g.fillStyle = '#ffb52e'; g.fill();
  g.beginPath(); g.arc(x - 1, y - 1, 0.9, 0, TAU); g.fillStyle = '#fff6c8'; g.fill();
}
function tuft(g, x, y, dark, lite) {
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(x - 6, y); g.quadraticCurveTo(x - 6, y - 5, x - 4, y - 9); g.moveTo(x, y); g.quadraticCurveTo(x + 1, y - 6, x, y - 12); g.moveTo(x + 6, y); g.quadraticCurveTo(x + 6, y - 5, x + 4, y - 9);
  g.strokeStyle = dark; g.lineWidth = 3.2; g.stroke();
  g.beginPath(); g.moveTo(x - 0.8, y - 2); g.quadraticCurveTo(x, y - 6, x - 0.6, y - 10); g.strokeStyle = lite; g.lineWidth = 1.3; g.stroke();
}
/** hash-grid texture: grass tufts, flowers, clover, pebbles, bones, cracks, embers - per danger ring */
function texture(g, view) {
  const C = 58;
  for (let cx = Math.floor(view.x0 / C); cx <= Math.floor(view.x1 / C); cx++) for (let cy = Math.floor(view.y0 / C); cy <= Math.floor(view.y1 / C); cy++) {
    const h = H(cx, cy); if (h > 0.55) continue;
    const x = cx * C + H(cx + 7, cy) * C, y = cy * C + H(cx, cy + 9) * C, d = Math.hypot(x, y);
    if (d < 175 || !WS.inside(x, y, -16) || nearRiver(x, y, 100)) continue;
    const z = zoneAt(x, y).id, k = h / 0.55;
    if (z <= 1) {
      if (k < 0.12) flower(g, x, y, ['#fff', '#ffe45c', '#ff8fb1', '#9fd4ff'][(h * 1000 | 0) % 4]);
      else if (k < 0.2) { for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x + i * 5 - 5, y + (i % 2) * 3, 3, 0, TAU); g.fillStyle = '#5fae46'; g.fill(); } }
      else tuft(g, x, y, shade(ZONE_GROUND[Math.max(z, 0)], -0.2), shade(ZONE_GROUND[Math.max(z, 0)], 0.25));
    } else if (z === 2) {
      if (k < 0.25) pebble(g, x, y, h, '#b6b8a8');
      else if (k < 0.33) { g.strokeStyle = 'rgba(70,70,40,.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x, y - 3); g.lineTo(x + 9, y + 2); g.stroke(); }
      else tuft(g, x, y, shade(ZONE_GROUND[2], -0.22), shade(ZONE_GROUND[2], 0.25));
    } else if (z === 3) {
      if (k < 0.12) bone(g, x, y, h * 20);
      else if (k < 0.35) pebble(g, x, y, h, '#b89870');
      else tuft(g, x, y, '#a07c3e', '#e8c888');
    } else {
      if (k < 0.18) { g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fillStyle = 'rgba(255,90,50,.25)'; g.fill(); g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fillStyle = '#ff7a4c'; g.fill(); g.beginPath(); g.arc(x - 0.8, y - 0.8, 1, 0, TAU); g.fillStyle = '#ffe0a0'; g.fill(); }
      else if (k < 0.5) crack(g, x, y, h);
      else if (k < 0.62) pebble(g, x, y, h, '#7a7088');
      else tuft(g, x, y, '#4e4258', '#a090b8');
    }
  }
}
function pebble(g, x, y, h, col) {
  const r = 3 + h * 7;
  g.beginPath(); g.ellipse(x + 1.5, y + 2, r * 1.1, r * 0.6, 0, 0, TAU); g.fillStyle = 'rgba(30,20,40,.18)'; g.fill();
  g.beginPath(); g.ellipse(x, y, r, r * 0.75, h * 3, 0, TAU); g.fillStyle = col; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(43,36,51,.5)'; g.stroke();
  g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.25, -0.5, 0, TAU); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill();
}
function bone(g, x, y, a) {
  g.save(); g.translate(x, y); g.rotate(a); g.lineCap = 'round';
  g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.strokeStyle = INK; g.lineWidth = 6; g.stroke(); g.strokeStyle = '#f1eadb'; g.lineWidth = 3; g.stroke();
  for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 8, -1.5, 2.4, 0, TAU); g.arc(s * 8, 1.5, 2.4, 0, TAU); g.fillStyle = '#f1eadb'; g.fill(); }
  g.restore();
}
function crack(g, x, y, h) {
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y + 4 - h * 10); g.lineTo(x + 18, y + 2); g.moveTo(x + 10, y + 4 - h * 10); g.lineTo(x + 12, y + 12);
  g.strokeStyle = 'rgba(30,15,30,.38)'; g.lineWidth = 2.6; g.stroke();
  g.save(); g.translate(-1, -1); g.strokeStyle = 'rgba(255,200,170,.18)'; g.lineWidth = 1; g.stroke(); g.restore();
}

/** the campfire plaza (static part) */
function plaza(g) {
  circle(g, 0, 0, 176, 'rgba(60,40,30,.15)', 0);
  circle(g, 0, 0, 170, '#d9cfb4', 5);
  for (let ring = 0; ring < 3; ring++) {
    const rr = 60 + ring * 38, n = 10 + ring * 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + ring * 0.3;
      g.save(); g.translate(Math.cos(a) * rr, Math.sin(a) * rr); g.rotate(a);
      rrect(g, -12, -9, 24, 18, 5); g.fillStyle = lgrad(g, 0, 0, 13, ring % 2 ? '#c8bd9f' : '#e6dcc3', LA - a); g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(43,36,51,.4)'; g.stroke();
      g.beginPath(); g.moveTo(-8, -5); g.lineTo(6, -5); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1.5; g.stroke();
      if (H(i, ring) < 0.3) { g.beginPath(); g.moveTo(-3, 2); g.lineTo(2, 5); g.strokeStyle = 'rgba(80,60,40,.35)'; g.lineWidth = 1.2; g.stroke(); }
      g.restore();
    }
  }
  circle(g, 0, 0, 34, 'rgba(40,30,30,.3)', 0);
  circle(g, 0, 0, 30, '#6f7480', 4);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ball(g, Math.cos(a) * 26, Math.sin(a) * 26, 7.5, '#9aa1ab', LA, 2.8, 0.6); }
  g.lineCap = 'round';
  for (const a of [0.5, 2.1, 3.7]) { g.beginPath(); g.moveTo(Math.cos(a) * 16, Math.sin(a) * 16); g.lineTo(-Math.cos(a) * 16, -Math.sin(a) * 16); g.strokeStyle = INK; g.lineWidth = 9; g.stroke(); g.strokeStyle = '#8a5a35'; g.lineWidth = 5; g.stroke(); g.strokeStyle = 'rgba(255,220,170,.4)'; g.lineWidth = 1.5; g.stroke(); }
}
function landmarks(g, view) {
  const L = SITES.lake;
  if (near(view, L.x, L.y, L.r + 120)) {
    g.fillStyle = 'rgba(80,120,50,.35)'; g.beginPath(); g.ellipse(L.x, L.y, L.r + 60, (L.r + 60) * 0.9, 0.2, 0, TAU); g.fill();
    g.fillStyle = '#e8d6a0'; g.beginPath(); g.ellipse(L.x, L.y, L.r + 16, (L.r + 16) * 0.9, 0.2, 0, TAU); g.fill();
    const w = g.createRadialGradient(L.x - 30, L.y - 30, 10, L.x, L.y, L.r); w.addColorStop(0, '#1580b8'); w.addColorStop(0.7, '#2a9fd2'); w.addColorStop(1, '#6fd6f0');
    g.fillStyle = w; g.beginPath(); g.ellipse(L.x, L.y, L.r, L.r * 0.9, 0.2, 0, TAU); g.fill(); ink(g, 4);
    g.save(); g.clip();
    g.strokeStyle = 'rgba(210,248,255,.3)'; g.lineWidth = 2.5;
    for (let i = 0; i < 12; i++) { const yy = L.y - L.r + i * (L.r / 6); g.beginPath(); for (let x = L.x - L.r; x <= L.x + L.r; x += 18) { const yv = yy + Math.sin(x * 0.04 + i) * 4; x === L.x - L.r ? g.moveTo(x, yv) : g.lineTo(x, yv); } g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.ellipse(L.x - L.r * 0.35, L.y - L.r * 0.45, L.r * 0.4, L.r * 0.1, -0.2, 0, TAU); g.fill();
    for (let i = 0; i < 9; i++) { const a = H(i, 31) * TAU, r = L.r * (0.3 + H(i, 32) * 0.55), x = L.x + Math.cos(a) * r, y = L.y + Math.sin(a) * r * 0.9, s = 9 + H(i, 33) * 6;
      g.beginPath(); g.moveTo(x, y); g.arc(x, y, s, a + 0.4, a + TAU - 0.2); g.closePath(); g.fillStyle = lgrad(g, x, y, s, '#4cae4f'); g.fill(); ink(g, 2);
      if (i % 3 === 0) { for (let p = 0; p < 5; p++) { const pa = (p / 5) * TAU; ellipse(g, x + Math.cos(pa) * 3.5, y + Math.sin(pa) * 3.5, 3.6, 2, '#ffd1e6', 1.2, pa); } circle(g, x, y, 2, '#ffe45c', 0); } }
    g.restore();
    g.beginPath(); g.ellipse(L.x, L.y + 3, L.r - 3, L.r * 0.9 - 3, 0.2, 0.3, Math.PI - 0.3); g.strokeStyle = 'rgba(10,50,80,.35)'; g.lineWidth = 5; g.stroke();
  }
  const S = SITES.stones;
  if (near(view, S.x, S.y, S.r + 80)) {
    circle(g, S.x, S.y, S.r + 30, 'rgba(90,90,70,.18)', 0);
    for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 14 + ring * 8; i++) {
      const a = (i / (14 + ring * 8)) * TAU, r = 50 + ring * 45, x = S.x + Math.cos(a) * r, y = S.y + Math.sin(a) * r;
      g.save(); g.translate(x, y); g.rotate(a); rrect(g, -14, -10, 28, 20, 5); g.fillStyle = lgrad(g, 0, 0, 14, ring ? '#b9b6a2' : '#cfcbb4', LA - a); g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(43,36,51,.45)'; g.stroke();
      if (H(i, ring + 5) < 0.4) { g.beginPath(); g.moveTo(-8, 4); g.lineTo(6, 6); g.strokeStyle = 'rgba(80,120,60,.6)'; g.lineWidth = 3; g.stroke(); }
      g.restore();
    }
    // the altar slab (carved spiral)
    g.save(); g.translate(S.x, S.y); rrect(g, -34, -22, 68, 44, 8); g.fillStyle = lgrad(g, 0, 0, 34, '#a8a492'); g.fill(); ink(g, 3.5);
    g.beginPath(); for (let i = 0; i < 60; i++) { const a = i * 0.32, r = 2 + i * 0.28; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.7) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.7); } g.strokeStyle = 'rgba(60,200,180,.75)'; g.lineWidth = 2; g.stroke();
    g.restore();
  }
  const T = SITES.tower;
  if (near(view, T.x, T.y, 240)) {
    circle(g, T.x, T.y, 200, 'rgba(70,60,70,.16)', 0);
    for (let i = 0; i < 40; i++) { const a = H(i, 51) * TAU, r = 60 + H(i, 52) * 140; pebble(g, T.x + Math.cos(a) * r, T.y + Math.sin(a) * r, H(i, 53), '#a7a0a8'); }
  }
}
function arenas(g, view) {
  const B = BOSS_POS;
  if (near(view, B.x, B.y, BOSS_ARENA_R + 60)) {
    circle(g, B.x, B.y, BOSS_ARENA_R + 20, 'rgba(40,20,50,.25)', 0);
    const fl = g.createRadialGradient(B.x, B.y, 30, B.x, B.y, BOSS_ARENA_R); fl.addColorStop(0, '#6d5a78'); fl.addColorStop(1, '#4e3f58');
    g.fillStyle = fl; g.beginPath(); g.arc(B.x, B.y, BOSS_ARENA_R, 0, TAU); g.fill();
    g.save(); g.clip();
    for (let r = 70; r < BOSS_ARENA_R; r += 62) for (let i = 0; i < Math.floor(r / 9); i++) { const a = (i / Math.floor(r / 9)) * TAU + r; g.save(); g.translate(B.x + Math.cos(a) * r, B.y + Math.sin(a) * r); g.rotate(a); rrect(g, -20, -26, 40, 52, 4); g.strokeStyle = 'rgba(20,10,30,.25)'; g.lineWidth = 2; g.stroke(); g.restore(); }
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const a = i * 0.52 + 0.2, R = BOSS_ARENA_R; g.beginPath(); g.moveTo(B.x + Math.cos(a) * 50, B.y + Math.sin(a) * 50); g.lineTo(B.x + Math.cos(a + 0.2) * R * 0.6, B.y + Math.sin(a + 0.2) * R * 0.6); g.lineTo(B.x + Math.cos(a) * R, B.y + Math.sin(a) * R); g.stroke(); }
    // war banners' blood sigil
    g.beginPath(); for (let i = 0; i < 3; i++) { const a = i * TAU / 3 - Math.PI / 2; g.moveTo(B.x, B.y); g.lineTo(B.x + Math.cos(a) * 120, B.y + Math.sin(a) * 120); } g.strokeStyle = 'rgba(190,40,40,.35)'; g.lineWidth = 9; g.stroke();
    g.beginPath(); g.arc(B.x, B.y, 120, 0, TAU); g.stroke();
    g.restore();
    circle(g, B.x, B.y, BOSS_ARENA_R, null, 6, INK);
  }
  const Tm = SITES.thornmaw;
  if (near(view, Tm.x, Tm.y, Tm.r + 80)) {
    const fl = g.createRadialGradient(Tm.x, Tm.y, 20, Tm.x, Tm.y, Tm.r + 30); fl.addColorStop(0, '#4f7a34'); fl.addColorStop(0.8, '#5f8a3a'); fl.addColorStop(1, 'rgba(95,138,58,0)');
    g.fillStyle = fl; g.beginPath(); g.arc(Tm.x, Tm.y, Tm.r + 30, 0, TAU); g.fill();
    g.lineCap = 'round';
    for (let i = 0; i < 16; i++) { // great roots radiating from the heart of the hollow
      const a = (i / 16) * TAU + H(i, 4) * 0.3; let x = Tm.x + Math.cos(a) * 40, y = Tm.y + Math.sin(a) * 40;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 1; k <= 5; k++) { const aa = a + Math.sin(k * 1.7 + i) * 0.25, r = 40 + k * (Tm.r / 5.2); x = Tm.x + Math.cos(aa) * r; y = Tm.y + Math.sin(aa) * r; g.lineTo(x, y); }
      g.strokeStyle = INK; g.lineWidth = 14 - (i % 3) * 2; g.stroke(); g.strokeStyle = '#6a4a2c'; g.lineWidth = 9 - (i % 3) * 2; g.stroke(); g.strokeStyle = 'rgba(255,220,170,.25)'; g.lineWidth = 2; g.stroke();
    }
    for (let i = 0; i < 30; i++) { const a = H(i, 61) * TAU, r = H(i, 62) * Tm.r; g.beginPath(); g.ellipse(Tm.x + Math.cos(a) * r, Tm.y + Math.sin(a) * r, 10 + H(i, 63) * 14, 6 + H(i, 64) * 8, a, 0, TAU); g.fillStyle = 'rgba(140,200,80,.4)'; g.fill(); }
    g.beginPath(); g.arc(Tm.x, Tm.y, Tm.r, 0, TAU); g.setLineDash([8, 10]); g.strokeStyle = 'rgba(40,60,20,.6)'; g.lineWidth = 5; g.stroke(); g.setLineDash([]);
  }
  const A = SITES.ashfang;
  if (near(view, A.x, A.y, A.r + 80)) {
    const fl = g.createRadialGradient(A.x, A.y, 20, A.x, A.y, A.r + 20); fl.addColorStop(0, '#5a5560'); fl.addColorStop(0.85, '#6d6774'); fl.addColorStop(1, 'rgba(109,103,116,0)');
    g.fillStyle = fl; g.beginPath(); g.arc(A.x, A.y, A.r + 20, 0, TAU); g.fill();
    for (let i = 0; i < 22; i++) { const a = H(i, 71) * TAU, r = 40 + H(i, 72) * (A.r - 60), x = A.x + Math.cos(a) * r, y = A.y + Math.sin(a) * r, rot = H(i, 73) * TAU; // claw gouges
      g.save(); g.translate(x, y); g.rotate(rot); for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(-18, k * 7); g.quadraticCurveTo(0, k * 7 - 4, 18, k * 8); g.strokeStyle = 'rgba(25,15,30,.45)'; g.lineWidth = 3.2; g.stroke(); g.strokeStyle = 'rgba(255,230,210,.15)'; g.lineWidth = 1; g.stroke(); } g.restore(); }
    for (let i = 0; i < 10; i++) { const a = H(i, 81) * TAU, r = 60 + H(i, 82) * (A.r - 80); bone(g, A.x + Math.cos(a) * r, A.y + Math.sin(a) * r, H(i, 83) * 6); }
    g.beginPath(); g.arc(A.x, A.y, A.r, 0, TAU); g.strokeStyle = 'rgba(30,20,40,.45)'; g.lineWidth = 6; g.stroke();
  }
}

// ------------------------------------------------------------------ live overlays (cheap, every frame)
export function drawWildsLive(ctx, view, t, quality = 2) {
  if (!wildsVisible(view)) return;
  if (near(view, 0, 0, 80)) { // campfire flame (cached glow sprite, no per-frame shadowBlur)
    const f = Math.sin(t * 12) * 2, gl = glowSprite('#ffb347', 70);
    ctx.globalAlpha = 0.55 + 0.1 * Math.sin(t * 9); blit(ctx, gl, 0, -4); ctx.globalAlpha = 1;
    if (wpOn() && wpHas('campfire')) { for (let i = 0; i < 3; i++) { const ph = (t * 0.9 + i / 3) % 1; circle(ctx, Math.sin(t * 3 + i * 2) * 6, -30 - ph * 40, 2.2 * (1 - ph), '#ffd27a', 0); } return void liveRest(ctx, view, t, quality); }
    circle(ctx, 0, -2, 14 + f, '#ff7a2c', 3); circle(ctx, 0, -4, 8 + f * 0.5, '#ffd23f', 0); circle(ctx, 0, -5, 3.5, '#fff6c8', 0);
    for (let i = 0; i < 3; i++) { const ph = (t * 0.9 + i / 3) % 1; circle(ctx, Math.sin(t * 3 + i * 2) * 6, -10 - ph * 40, 2.2 * (1 - ph), '#ffd27a', 0); }
  }
  liveRest(ctx, view, t, quality);
}
function liveRest(ctx, view, t, quality) {
  const ring = (x, y, r, col) => {
    if (!near(view, x, y, r + 20)) return;
    ctx.beginPath(); ctx.arc(x, y, r - 12, 0, TAU); ctx.setLineDash([18, 14]); ctx.lineDashOffset = -t * 20;
    ctx.strokeStyle = col.replace('A', (0.45 + 0.2 * Math.sin(t * 3)).toFixed(2)); ctx.lineWidth = 6; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
  };
  ring(BOSS_POS.x, BOSS_POS.y, BOSS_ARENA_R, 'rgba(255,80,50,A)');
  ring(SITES.thornmaw.x, SITES.thornmaw.y, SITES.thornmaw.r, 'rgba(150,255,90,A)');
  ring(SITES.ashfang.x, SITES.ashfang.y, SITES.ashfang.r, 'rgba(220,220,255,A)');
  const L = SITES.lake;
  if (quality > 0 && near(view, L.x, L.y, L.r)) { // lake glints
    ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const ph = (t * 0.3 + i / 6) % 1, a = H(i, 91) * TAU, r = L.r * 0.7 * H(i, 92); const x = L.x + Math.cos(a) * r, y = L.y + Math.sin(a) * r * 0.9; ctx.globalAlpha = Math.sin(ph * Math.PI); ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
}
const glows = new Map();
/** A soft radial glow baked once (replaces per-frame shadowBlur / gradients). */
export { glowSprite };
