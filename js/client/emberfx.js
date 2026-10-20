// Emberdeep Caldera art (world expansion 2), classic code-drawn style (art.js / dunesfx.js kit: light from the upper
// left, gradient fills, rim light, ink outlines). The ash ground (danger bands, cracked basalt, cinder speckle), the
// glowing lava rivers + their basalt bridges, the lava sea round the coast, roads, the outpost, the boss arena floors
// and every low prop (basalt ridges, magma rocks, charred ash trees, sulphur clusters, smithy tents, fossil ribs) are
// baked into the ground tiles (client/ground.js); tall props (obsidian spires, the Brimstone Falls, the Dragon's Jaw,
// braziers, the obelisk, glass panes, gnomons, the Forge's anvils + slag vats) are cached sprites y-sorted with the
// characters. Live: the flowing lava core, vents steaming, the outpost beacon, ash fall + rising embers. Also: the
// Emberdeep enemies + bosses, ember / basalt / magma / glass / sun bullets, every Emberdeep telegraph kind (the sun and
// its gnomon shadows, the tide wedge, the rafts, shelters, panes...), Forge portals and the Emberdeep event FX.
// The Forge of Cinders itself is client/forgefx.js.
import { INK, circle, shadow, rrect, shade, star, ENEMY_DRAW, ENEMY_ANIM } from './art.js';
import { bloom } from './fxglow.js';
import { lgrad, ball, oval, ink, rimArc } from './dunesfx.js';
import { shapePath, roadPath } from './wildsfx.js';
import { sprite, blit } from './sprite.js';
import { EMBER_SHAPE as ES, EMBER_RINGS, EMBER_ROADS, EMBER_CAMP, EMBER_CAMP_R, EMBER_SITES, EMBER_BOUNDS, EMBER_RR, EMBER_LAVA, EMBER_BRIDGES, EMBER_VENTS, LAVA_W, inEmberArea, inForgeArea } from '../sim/emberconst.js';
import { FPORTAL, VENT } from '../sim/ember.js';
import { sunPos, inWedge, tideAng, raftPos, TIDE, RAFT, SUN, PANE } from '../sim/emberai.js';
import { gnomons } from '../sim/embergen.js';

const TAU = Math.PI * 2, LA = -2.3, FONT = "'Lilita One', sans-serif";
const H = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const EB = EMBER_BOUNDS, PADV = 900;
export const emberVisible = (view) => view.x1 > EB.x0 - PADV && view.x0 < EB.x1 + PADV && view.y1 > EB.y0 - PADV && view.y0 < EB.y1 + PADV;
/** ash per danger band (outpost, D4 flats, D5 wastes, D6 rift, D7 heart) */
export const ASH_BANDS = ['#a08a76', '#8f7c6c', '#7a6a66', '#6a5552', '#5a403c'];
const near = (view, P, r) => view.y0 < P.y + r && view.y1 > P.y - r && view.x0 < P.x + r && view.x1 > P.x - r;
let EROADS = null, ELAVA = null;
const lavaPaths = () => ELAVA || (ELAVA = EMBER_LAVA.map(roadPath));
const GN = gnomons();

// ------------------------------------------------------------------ the static ground (baked into tiles)
export function paintEmberStatic(g, view) {
  if (!emberVisible(view)) return false;
  lavaSea(g, view);
  g.fillStyle = '#3a2a28'; g.fill(shapePath(ES, EMBER_RR, ES.shore), 'evenodd'); // the cooled basalt shelf
  g.lineWidth = 6; g.strokeStyle = 'rgba(255,120,40,.55)'; g.stroke(shapePath(ES, EMBER_RR, ES.shore));
  g.fillStyle = '#4a3834'; g.fill(shapePath(ES, EMBER_RR, 30), 'evenodd');
  g.save(); g.clip(shapePath(ES, EMBER_RR, 8), 'evenodd');
  const R = EMBER_RINGS;
  g.fillStyle = ASH_BANDS[R.length - 1]; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  for (let i = R.length - 2; i >= 1; i--) { g.fillStyle = ASH_BANDS[i]; g.fill(shapePath(ES, R[i], 0), 'evenodd'); }
  for (let i = 1; i < R.length - 1; i++) { g.lineWidth = 34; g.strokeStyle = 'rgba(255,220,180,.07)'; g.stroke(shapePath(ES, R[i] - 18, 0)); g.strokeStyle = 'rgba(30,10,10,.1)'; g.stroke(shapePath(ES, R[i] + 18, 0)); }
  ashSpeckle(g, view);
  basaltCracks(g, view);
  if (!EROADS) EROADS = EMBER_ROADS.map(roadPath);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const p of EROADS) {
    g.strokeStyle = 'rgba(30,15,10,.25)'; g.lineWidth = 96; g.stroke(p);
    g.strokeStyle = '#b39a80'; g.lineWidth = 76; g.stroke(p);
    g.strokeStyle = 'rgba(90,60,40,.45)'; g.lineWidth = 3; g.setLineDash([10, 24]);
    g.save(); g.translate(-14, 0); g.stroke(p); g.restore(); g.save(); g.translate(14, 6); g.stroke(p); g.restore(); g.setLineDash([]);
  }
  lavaRivers(g);
  for (const b of EMBER_BRIDGES) if (near(view, b, 200)) bridge(g, b);
  g.restore();
  for (let i = 1; i < R.length - 1; i++) {
    const p = shapePath(ES, R[i], 0);
    g.strokeStyle = 'rgba(20,8,6,.25)'; g.lineWidth = 11; g.stroke(p);
    g.setLineDash([26, 20]); g.strokeStyle = 'rgba(255,170,90,.75)'; g.lineWidth = 4; g.stroke(p); g.setLineDash([]);
  }
  g.lineWidth = 4; g.strokeStyle = 'rgba(20,8,6,.5)'; g.stroke(shapePath(ES, EMBER_RR, 10));
  if (near(view, EMBER_CAMP, EMBER_CAMP_R + 80)) outpostFloor(g);
  const S = EMBER_SITES;
  if (near(view, S.pyrrhex, S.pyrrhex.r + 140)) craterFloor(g, S.pyrrhex);
  if (near(view, S.solgrim, S.solgrim.r + 140)) dialFloor(g, S.solgrim);
  if (near(view, S.vitrea, S.vitrea.r + 140)) kilnFloor(g, S.vitrea);
  if (near(view, S.falls, 380)) { g.beginPath(); g.ellipse(S.falls.x, S.falls.y + 90, 240, 100, 0, 0, TAU); const gr = g.createRadialGradient(S.falls.x, S.falls.y + 90, 20, S.falls.x, S.falls.y + 90, 240); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(0.35, '#ff9a2a'); gr.addColorStop(1, '#a8301a'); g.fillStyle = gr; g.fill(); ink(g, 3.5); crust(g, S.falls.x, S.falls.y + 90, 200, 80, 9, 5); }
  if (near(view, S.obelisk, 300)) { g.beginPath(); g.arc(S.obelisk.x, S.obelisk.y, S.obelisk.r + 40, 0, TAU); g.fillStyle = 'rgba(40,20,50,.25)'; g.fill(); }
  if (near(view, S.skull, 420)) { g.beginPath(); g.ellipse(S.skull.x + 40, S.skull.y, 330, 150, 0, 0, TAU); g.fillStyle = 'rgba(60,30,20,.16)'; g.fill(); }
  if (near(view, S.shrine, 260)) { g.beginPath(); g.arc(S.shrine.x, S.shrine.y, S.shrine.r + 30, 0, TAU); g.fillStyle = 'rgba(255,140,60,.12)'; g.fill(); }
  return true;
}
function lavaSea(g, view) { // the island sits in a slow lava sea: dark crust plates with glowing seams
  const C = 150, crustP = new Path2D(), seams = new Path2D();
  let any = false;
  for (let cx = Math.floor(view.x0 / C); cx <= Math.floor(view.x1 / C); cx++) for (let cy = Math.floor(view.y0 / C); cy <= Math.floor(view.y1 / C); cy++) {
    const x = cx * C + C / 2, y = cy * C + C / 2;
    if (x < EB.x0 - 1400 || x > EB.x1 + 1400 || y < EB.y0 - 1400 || y > EB.y1 + 1400) continue;
    const d = ES.sd(x, y); if (d < -C) continue;
    any = true;
    const jx = (H(cx, cy) - 0.5) * 30, jy = (H(cy, cx + 3) - 0.5) * 30, r = C * 0.44;
    const pts = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + H(cx + i, cy) * 0.4; pts.push([x + jx + Math.cos(a) * r * (0.8 + H(cx, cy + i) * 0.3), y + jy + Math.sin(a) * r * (0.8 + H(cx - i, cy) * 0.3)]); }
    crustP.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < 6; i++) crustP.lineTo(pts[i][0], pts[i][1]); crustP.closePath();
    if (H(cx + 7, cy - 7) < 0.3) { seams.moveTo(x + jx - r * 0.5, y + jy); seams.lineTo(x + jx + r * 0.4, y + jy + r * 0.2); }
  }
  if (!any) return;
  g.save();
  const gr = g.createLinearGradient(view.x0, view.y0, view.x1, view.y1); gr.addColorStop(0, '#ff6a1a'); gr.addColorStop(0.5, '#ff9a2a'); gr.addColorStop(1, '#e8501a');
  g.fillStyle = gr; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  g.fillStyle = '#3b2522'; g.fill(crustP); g.lineWidth = 3; g.strokeStyle = 'rgba(255,200,90,.6)'; g.stroke(crustP);
  g.lineCap = 'round'; g.strokeStyle = 'rgba(255,150,60,.75)'; g.lineWidth = 2.5; g.stroke(seams);
  g.restore();
}
function ashSpeckle(g, view) { // pale ash flecks + dark cinders (two batched fills per tile)
  const C = 90, lite = new Path2D(), dark = new Path2D();
  for (let cx = Math.floor(view.x0 / C); cx <= Math.floor(view.x1 / C); cx++) for (let cy = Math.floor(view.y0 / C); cy <= Math.floor(view.y1 / C); cy++) {
    const h = H(cx + 311, cy - 47); if (h > 0.7) continue;
    const x = cx * C + H(cx, cy + 5) * C, y = cy * C + H(cx + 3, cy) * C, r = 2 + h * 4;
    (h < 0.35 ? lite : dark).moveTo(x + r, y); (h < 0.35 ? lite : dark).ellipse(x, y, r * 1.6, r, h * 3, 0, TAU);
  }
  g.fillStyle = 'rgba(235,220,200,.22)'; g.fill(lite);
  g.fillStyle = 'rgba(30,15,15,.22)'; g.fill(dark);
}
function basaltCracks(g, view) { // the wastes + the heart: hexagonal basalt joints, glowing deeper in
  const C = 240, p = new Path2D(), hot = new Path2D();
  for (let cx = Math.floor(view.x0 / C); cx <= Math.floor(view.x1 / C); cx++) for (let cy = Math.floor(view.y0 / C); cy <= Math.floor(view.y1 / C); cy++) {
    const h = H(cx - 71, cy + 333); if (h > 0.42) continue;
    const x = cx * C + H(cx, cy + 1) * C, y = cy * C + H(cx + 2, cy) * C;
    if (!ES.inside(x, y, -80)) continue;
    const re = ES.re(x, y); if (re < EMBER_RINGS[1] + 60) continue;
    const r = 26 + h * 40, pth = re > EMBER_RINGS[3] ? hot : p;
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * TAU + h; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.8; i ? pth.lineTo(px, py) : pth.moveTo(px, py); }
    for (let b = 0; b < 2; b++) { const a = (b * 3 / 6) * TAU + h; pth.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8); pth.lineTo(x + Math.cos(a) * r * 1.9, y + Math.sin(a) * r * 1.5); }
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = 'rgba(25,10,10,.35)'; g.lineWidth = 4; g.stroke(p);
  g.strokeStyle = 'rgba(25,10,10,.45)'; g.lineWidth = 6; g.stroke(hot);
  g.strokeStyle = 'rgba(255,110,40,.7)'; g.lineWidth = 2.2; g.stroke(hot);
}
function lavaRivers(g) { // a dark crust bank, the molten body, a bright core (the live flow is drawn over it: drawEmberLive)
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const p of lavaPaths()) {
    g.strokeStyle = '#2e1d1b'; g.lineWidth = LAVA_W + 34; g.stroke(p);
    g.strokeStyle = 'rgba(255,120,40,.35)'; g.lineWidth = LAVA_W + 18; g.stroke(p);
    g.strokeStyle = '#d8401a'; g.lineWidth = LAVA_W; g.stroke(p);
    g.strokeStyle = '#ff8a2a'; g.lineWidth = LAVA_W * 0.66; g.stroke(p);
    g.strokeStyle = '#ffd36a'; g.lineWidth = LAVA_W * 0.26; g.stroke(p);
  }
  // cooling crust plates riding the flow
  g.fillStyle = 'rgba(60,30,25,.75)';
  for (const L of EMBER_LAVA) for (let i = 1; i < L.length; i++) {
    const a = L[i - 1], b = L[i], n = Math.max(1, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 70));
    for (let k = 0; k < n; k++) { const h = H(i * 31 + k, L.length); if (h > 0.45) continue; const t = (k + 0.5) / n, x = a.x + (b.x - a.x) * t + (H(k, i) - 0.5) * LAVA_W * 0.6, y = a.y + (b.y - a.y) * t + (H(i, k) - 0.5) * LAVA_W * 0.6; g.beginPath(); g.ellipse(x, y, 10 + h * 22, 6 + h * 10, h * 6, 0, TAU); g.fill(); }
  }
}
function bridge(g, b) { // a basalt slab bridge across the lava, along the road
  g.save(); g.translate(b.x, b.y); g.rotate(b.ang);
  const L = LAVA_W + 150, W = 92;
  g.fillStyle = 'rgba(20,8,6,.45)'; rrect(g, -L / 2 + 6, -W / 2 + 10, L, W, 14); g.fill();
  rrect(g, -L / 2, -W / 2, L, W, 14); g.fillStyle = lgrad(g, 0, 0, L / 2, '#6e5c58'); g.fill(); ink(g, 3.5);
  g.strokeStyle = 'rgba(30,15,15,.45)'; g.lineWidth = 2.5; for (let i = 1; i < 6; i++) { const x = -L / 2 + (L / 6) * i; g.beginPath(); g.moveTo(x, -W / 2 + 4); g.lineTo(x + (H(i, 3) - 0.5) * 12, W / 2 - 4); g.stroke(); }
  for (const sd of [-1, 1]) { rrect(g, -L / 2 + 8, sd * (W / 2) - 7, L - 16, 14, 6); g.fillStyle = '#4b3b38'; g.fill(); ink(g, 2.4); for (let i = 0; i < 5; i++) circle(g, -L / 2 + 24 + i * (L - 48) / 4, sd * (W / 2), 7, '#5d4b48', 2.2); }
  g.beginPath(); g.moveTo(-L / 2 + 14, -W / 2 + 10); g.lineTo(L / 2 - 14, -W / 2 + 10); g.strokeStyle = 'rgba(255,230,200,.25)'; g.lineWidth = 3; g.stroke();
  g.restore();
}
function crust(g, x, y, rx, ry, n, seed) { for (let i = 0; i < n; i++) { const a = H(seed, i) * TAU, r = Math.sqrt(H(i, seed)); g.beginPath(); g.ellipse(x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r, 10 + H(i + 3, seed) * 14, 6 + H(seed, i + 3) * 6, a, 0, TAU); g.fillStyle = 'rgba(60,25,20,.7)'; g.fill(); } }
function outpostFloor(g) { // Cinderwatch Outpost: a paved basalt plaza, a ring of iron posts, a forge-anvil
  const { x, y } = EMBER_CAMP, R = EMBER_CAMP_R;
  g.beginPath(); g.arc(x, y, R, 0, TAU); g.fillStyle = ASH_BANDS[0]; g.fill();
  g.beginPath(); g.arc(x, y, R * 0.62, 0, TAU); g.fillStyle = '#7d6c66'; g.fill(); ink(g, 3);
  for (let r = 50; r < R * 0.62; r += 46) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.strokeStyle = 'rgba(30,15,15,.25)'; g.lineWidth = 2.5; g.stroke(); }
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; g.beginPath(); g.moveTo(x + Math.cos(a) * 50, y + Math.sin(a) * 50); g.lineTo(x + Math.cos(a) * R * 0.62, y + Math.sin(a) * R * 0.62); g.strokeStyle = 'rgba(30,15,15,.2)'; g.lineWidth = 2; g.stroke(); }
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, sx = x + Math.cos(a) * R, sy = y + Math.sin(a) * R; g.beginPath(); g.ellipse(sx, sy, 9, 9, 0, 0, TAU); g.fillStyle = lgrad(g, sx, sy, 9, '#6b6266'); g.fill(); ink(g, 2.4); circle(g, sx - 2, sy - 3, 2.4, '#ffb36a', 0); }
}
function craterFloor(g, S) { // Pyrrhex: a cracked obsidian crater bowl with a molten heart-pool rim
  g.beginPath(); g.arc(S.x, S.y, S.r + 44, 0, TAU); g.fillStyle = '#2b1c1c'; g.fill();
  g.beginPath(); g.arc(S.x, S.y, S.r + 26, 0, TAU); g.strokeStyle = '#ff6a1a'; g.lineWidth = 10; g.stroke();
  g.beginPath(); g.arc(S.x, S.y, S.r, 0, TAU); const gr = g.createRadialGradient(S.x - 60, S.y - 80, 20, S.x, S.y, S.r); gr.addColorStop(0, '#5a3a36'); gr.addColorStop(0.7, '#3e2826'); gr.addColorStop(1, '#2a1a1a'); g.fillStyle = gr; g.fill(); ink(g, 4);
  g.lineCap = 'round';
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + 0.1; g.beginPath(); g.moveTo(S.x + Math.cos(a) * 70, S.y + Math.sin(a) * 70); for (let k = 1; k <= 5; k++) g.lineTo(S.x + Math.cos(a + (H(i, k) - 0.5) * 0.3) * (70 + k * (S.r - 80) / 5), S.y + Math.sin(a + (H(k, i) - 0.5) * 0.3) * (70 + k * (S.r - 80) / 5)); g.strokeStyle = 'rgba(20,6,6,.6)'; g.lineWidth = 7; g.stroke(); g.strokeStyle = 'rgba(255,120,40,.8)'; g.lineWidth = 2.5; g.stroke(); }
  for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(S.x, S.y, i * 120, 0, TAU); g.strokeStyle = 'rgba(255,140,60,.18)'; g.lineWidth = 4; g.setLineDash([16, 18]); g.stroke(); g.setLineDash([]); }
  g.beginPath(); g.arc(S.x, S.y, 64, 0, TAU); const hg = g.createRadialGradient(S.x, S.y, 4, S.x, S.y, 64); hg.addColorStop(0, '#fff2a0'); hg.addColorStop(0.5, '#ff8a2a'); hg.addColorStop(1, '#a8301a'); g.fillStyle = hg; g.fill(); ink(g, 3.5);
}
function dialFloor(g, S) { // Solgrim: a brass-inlaid sundial face of 12 hour sectors on pale sandstone
  g.beginPath(); g.arc(S.x, S.y, S.r + 30, 0, TAU); g.fillStyle = '#6a4a2a'; g.fill(); ink(g, 4);
  g.beginPath(); g.arc(S.x, S.y, S.r + 10, 0, TAU); g.fillStyle = lgrad(g, S.x, S.y, S.r, '#d8b27a'); g.fill(); ink(g, 3);
  for (let h = 0; h < 12; h++) { const a0 = (h / 12) * TAU - Math.PI / 2 - TAU / 24; g.beginPath(); g.moveTo(S.x, S.y); g.arc(S.x, S.y, S.r, a0, a0 + TAU / 12); g.closePath(); g.fillStyle = h % 2 ? 'rgba(160,100,40,.18)' : 'rgba(255,240,200,.18)'; g.fill(); g.strokeStyle = 'rgba(90,50,20,.55)'; g.lineWidth = 3; g.stroke(); }
  for (let h = 0; h < 12; h++) { const a = (h / 12) * TAU - Math.PI / 2, x = S.x + Math.cos(a) * (S.r - 34), y = S.y + Math.sin(a) * (S.r - 34); g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); g.fillStyle = '#7a4a1a'; for (let k = 0; k <= (h % 4); k++) g.fillRect(-2 - (h % 4) * 4 + k * 8, -10, 4, 20); g.restore(); }
  g.beginPath(); g.arc(S.x, S.y, S.r * 0.45, 0, TAU); g.strokeStyle = '#c8902a'; g.lineWidth = 6; g.stroke();
  g.beginPath(); g.arc(S.x, S.y, 40, 0, TAU); g.fillStyle = '#e8b04a'; g.fill(); ink(g, 3);
  star(g, S.x, S.y, 22, '#fff2a0', 2.4);
}
function kilnFloor(g, S) { // Vitrea: the glassworks floor: blue-green slag tiles, a kiln ring, broken glass glints
  g.beginPath(); g.arc(S.x, S.y, S.r + 30, 0, TAU); g.fillStyle = '#3a4a4a'; g.fill(); ink(g, 4);
  g.save(); g.beginPath(); g.arc(S.x, S.y, S.r + 8, 0, TAU); g.clip();
  const T = 64; for (let i = -7; i <= 7; i++) for (let j = -7; j <= 7; j++) { const x = S.x + i * T, y = S.y + j * T; g.fillStyle = (i + j) & 1 ? '#5f7a76' : '#6f8c86'; g.fillRect(x - T / 2, y - T / 2, T, T); }
  g.strokeStyle = 'rgba(20,30,30,.35)'; g.lineWidth = 2; for (let i = -7; i <= 7; i++) { g.beginPath(); g.moveTo(S.x + i * T - T / 2, S.y - S.r - 20); g.lineTo(S.x + i * T - T / 2, S.y + S.r + 20); g.moveTo(S.x - S.r - 20, S.y + i * T - T / 2); g.lineTo(S.x + S.r + 20, S.y + i * T - T / 2); g.stroke(); }
  g.restore();
  g.beginPath(); g.arc(S.x, S.y, S.r + 8, 0, TAU); ink(g, 3);
  g.beginPath(); g.arc(S.x, S.y, 70, 0, TAU); g.fillStyle = '#3a2a28'; g.fill(); ink(g, 3); g.beginPath(); g.arc(S.x, S.y, 46, 0, TAU); const kg = g.createRadialGradient(S.x, S.y, 4, S.x, S.y, 46); kg.addColorStop(0, '#fff6c8'); kg.addColorStop(1, '#ff7a2a'); g.fillStyle = kg; g.fill();
  for (let i = 0; i < 18; i++) { const a = H(i, 4) * TAU, r = 90 + Math.sqrt(H(4, i)) * (S.r - 110); star(g, S.x + Math.cos(a) * r, S.y + Math.sin(a) * r, 4 + H(i, 9) * 4, 'rgba(210,255,250,.85)', 0); }
}

// ------------------------------------------------------------------ decor (baked)
export function drawEmberDecor(g, d) {
  const x = d.x, y = d.y, s = d.size, v = d.variant || 0;
  switch (d.kind) {
    case 'ashpile': {
      g.beginPath(); g.ellipse(x + 3, y + 4, s * 1.3, s * 0.55, 0, 0, TAU); g.fillStyle = 'rgba(30,15,15,.18)'; g.fill();
      g.beginPath(); g.ellipse(x, y, s * 1.25, s * 0.5, (H(v, 1) - 0.5) * 0.5, 0, TAU); g.fillStyle = '#b8aca0'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = 'rgba(60,40,30,.45)'; g.stroke();
      g.beginPath(); g.ellipse(x - s * 0.25, y - s * 0.12, s * 0.55, s * 0.16, 0, Math.PI, TAU); g.strokeStyle = 'rgba(240,232,220,.8)'; g.lineWidth = 2.2; g.stroke();
      return true;
    }
    case 'cinders': {
      for (let i = 0; i < 6; i++) { const a = H(v, i) * TAU, r = H(i, v) * s; const cx = x + Math.cos(a) * r, cy = y + Math.sin(a) * r * 0.6; g.beginPath(); g.ellipse(cx, cy, 3 + H(i, 2) * 3, 2.4, a, 0, TAU); g.fillStyle = i % 3 ? '#2e2220' : '#ff7a2a'; g.fill(); }
      return true;
    }
    case 'magmacrack': {
      g.lineCap = 'round'; g.beginPath(); const a0 = H(v, 2) * TAU;
      for (let b = 0; b < 3; b++) { const a = a0 + b * 2.1; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.42); g.lineTo(x + Math.cos(a + 0.4) * s * 1.2, y + Math.sin(a + 0.4) * s * 0.84); }
      g.strokeStyle = 'rgba(20,6,6,.55)'; g.lineWidth = 5; g.stroke(); g.strokeStyle = '#ff7a2a'; g.lineWidth = 2.2; g.stroke(); g.strokeStyle = 'rgba(255,230,140,.8)'; g.lineWidth = 0.9; g.stroke();
      return true;
    }
    case 'bones': {
      g.save(); g.translate(x, y); g.rotate(H(v, 4) * TAU);
      for (const [dx, dy, a] of [[-6, 0, 0.3], [6, 4, -0.5]]) { g.save(); g.translate(dx, dy); g.rotate(a); g.beginPath(); g.moveTo(-s * 0.5, 0); g.lineTo(s * 0.5, 0); g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = 'round'; g.stroke(); g.strokeStyle = '#e8dcc4'; g.lineWidth = 3; g.stroke(); g.restore(); }
      g.restore(); return true;
    }
    case 'vent': { // a steam vent: a cracked cone mouth (the eruption ring + steam are live / telegraphs)
      g.beginPath(); g.arc(x, y, s, 0, TAU); g.fillStyle = 'rgba(40,20,20,.25)'; g.fill();
      g.beginPath(); g.arc(x, y, s * 0.62, 0, TAU); g.fillStyle = lgrad(g, x, y, s * 0.62, '#8a7068'); g.fill(); ink(g, 3);
      g.beginPath(); g.arc(x, y, s * 0.36, 0, TAU); const gr = g.createRadialGradient(x, y, 2, x, y, s * 0.36); gr.addColorStop(0, '#ffd36a'); gr.addColorStop(0.5, '#e85a1a'); gr.addColorStop(1, '#3a1a14'); g.fillStyle = gr; g.fill(); ink(g, 2.6);
      g.strokeStyle = 'rgba(240,220,120,.55)'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + v; g.beginPath(); g.moveTo(x + Math.cos(a) * s * 0.66, y + Math.sin(a) * s * 0.66); g.lineTo(x + Math.cos(a) * s * 0.95, y + Math.sin(a) * s * 0.95); g.stroke(); }
      return true;
    }
    case 'embershrine': {
      g.beginPath(); g.arc(x, y, s + 10, 0, TAU); g.fillStyle = lgrad(g, x, y, s + 10, '#7a5a4a'); g.fill(); ink(g, 3.5);
      g.beginPath(); g.arc(x, y, s - 18, 0, TAU); g.fillStyle = '#5a3a30'; g.fill(); ink(g, 2.6);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - Math.PI / 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (s - 18), y + Math.sin(a) * (s - 18)); g.strokeStyle = '#ffb36a'; g.lineWidth = 4; g.stroke(); }
      g.beginPath(); g.arc(x, y, 30, 0, TAU); const gr = g.createRadialGradient(x, y, 3, x, y, 30); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(1, '#ff6a1a'); g.fillStyle = gr; g.fill(); ink(g, 3);
      return true;
    }
    case 'beacon': { // the outpost's stone fire-pit (the flame is live)
      g.beginPath(); g.arc(x, y, s * 0.8, 0, TAU); g.fillStyle = '#2e2220'; g.fill();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, sx = x + Math.cos(a) * s * 0.8, sy = y + Math.sin(a) * s * 0.66; g.beginPath(); g.ellipse(sx, sy, 12, 10, a, 0, TAU); g.fillStyle = lgrad(g, sx, sy, 12, '#7a6a66'); g.fill(); ink(g, 2.2); }
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------ obstacles
/** low Emberdeep props baked into the ground tiles */
export const EMBER_BAKE = new Set(['basaltcliff', 'magmarock', 'ashtree', 'sulfur', 'forgetent', 'fossilrib']);
/** tall Emberdeep / Forge props: cached sprites, y-sorted with the characters */
export const EMBER_TALL = new Set(['obsidian', 'lavafall', 'dragonskull', 'brazier', 'obelisk', 'glasspane', 'gnomon', 'anvil', 'slagvat']);
export function drawEmberBaked(g, o) {
  switch (o.kind) {
    case 'basaltcliff': basaltCliff(g, o); return true;
    case 'magmarock': magmaRock(g, o); return true;
    case 'ashtree': ashTree(g, o); return true;
    case 'sulfur': sulfur(g, o); return true;
    case 'forgetent': forgeTent(g, o); return true;
    case 'fossilrib': fossilRib(g, o); return true;
  }
  return false;
}
function blob(g, x, y, s, n, v, sq = 0.78) { const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU + v * 0.37, r = s * (0.8 + H(v, i) * 0.32); pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * sq]); } g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); return pts; }
function basaltCliff(g, o) { // stacked hexagonal basalt columns, seen from above
  const s = o.size, v = o.variant, x = o.x, y = o.y;
  shadow(g, x + s * 0.25, y + s * 0.35, s * 1.15, s * 0.55, 0.3);
  blob(g, x, y + s * 0.12, s * 1.02, 9, v); g.fillStyle = '#3a2c2c'; g.fill(); ink(g, 3.4);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + v * 0.7, rr = i ? s * 0.48 : 0, cx = x + Math.cos(a) * rr, cy = y - s * 0.1 + Math.sin(a) * rr * 0.7, hr = s * (i ? 0.34 : 0.4) * (0.9 + H(v, i) * 0.2);
    g.beginPath(); for (let k = 0; k < 6; k++) { const b = (k / 6) * TAU + 0.5; const px = cx + Math.cos(b) * hr, py = cy + Math.sin(b) * hr * 0.82; k ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath();
    g.fillStyle = lgrad(g, cx, cy, hr, i ? '#6a5a58' : '#7a6866', LA, 0.4, -0.2); g.fill(); ink(g, 2.4);
  }
  rimArc(g, x - s * 0.1, y - s * 0.2, s * 0.8, LA, 'rgba(255,220,190,.35)', 2, 0.5);
}
function magmaRock(g, o) { // a dark boulder with glowing magma veins
  const s = o.size, v = o.variant, x = o.x, y = o.y;
  shadow(g, x + s * 0.2, y + s * 0.3, s * 1.0, s * 0.45, 0.25);
  const pts = blob(g, x, y, s, 8, v); g.fillStyle = lgrad(g, x, y, s, '#5a4644'); g.fill(); ink(g, 3);
  g.lineCap = 'round'; g.beginPath(); const p0 = pts[v % pts.length], p1 = pts[(v + 4) % pts.length]; g.moveTo((p0[0] + x) / 2, (p0[1] + y) / 2); g.quadraticCurveTo(x + (H(v, 3) - 0.5) * s * 0.4, y, (p1[0] + x) / 2, (p1[1] + y) / 2);
  g.strokeStyle = 'rgba(20,6,6,.5)'; g.lineWidth = 4.5; g.stroke(); g.strokeStyle = '#ff7a2a'; g.lineWidth = 2; g.stroke();
  rimArc(g, x, y, s * 0.8, LA, 'rgba(255,220,190,.35)', 2, 0.6);
}
function ashTree(g, o) { // a charred dead tree from above: a burnt trunk stub with bare black branches spreading out
  const s = o.size, v = o.variant, x = o.x, y = o.y;
  g.beginPath(); g.ellipse(x + s * 0.3, y + s * 0.3, s * 0.95, s * 0.5, 0.3, 0, TAU); g.fillStyle = 'rgba(30,10,10,.2)'; g.fill();
  g.lineCap = 'round';
  const br = (x0, y0, a, L, w, depth) => { const x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L * 0.85; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.strokeStyle = INK; g.lineWidth = w + 2.4; g.stroke(); g.strokeStyle = '#3a2a28'; g.lineWidth = w; g.stroke(); if (depth > 0) { br(x1, y1, a - 0.5, L * 0.6, w * 0.6, depth - 1); br(x1, y1, a + 0.45, L * 0.55, w * 0.6, depth - 1); } else if (H(v, Math.round(a * 10)) < 0.3) circle(g, x1, y1, 2.2, '#ff8a2a', 0); };
  const n = 4 + (v % 2); for (let i = 0; i < n; i++) br(x, y - s * 0.3, (i / n) * TAU + v * 0.3, s * 0.5, s * 0.12, 2);
  g.beginPath(); g.ellipse(x, y - s * 0.3, s * 0.2, s * 0.17, 0, 0, TAU); g.fillStyle = lgrad(g, x, y - s * 0.3, s * 0.2, '#4a3634'); g.fill(); ink(g, 2.4);
  g.beginPath(); g.ellipse(x, y - s * 0.32, s * 0.1, s * 0.08, 0, 0, TAU); g.fillStyle = '#ff7a2a'; g.fill();
}
function sulfur(g, o) { // yellow sulphur crystals round a steaming crack
  const s = o.size, v = o.variant, x = o.x, y = o.y;
  shadow(g, x + 4, y + s * 0.3, s * 0.85, s * 0.35, 0.22);
  g.beginPath(); g.ellipse(x, y, s * 0.8, s * 0.42, 0, 0, TAU); g.fillStyle = '#c9b24a'; g.fill(); ink(g, 2.4);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + v * 0.2, px = x + Math.cos(a) * s * 0.4, py = y + Math.sin(a) * s * 0.2, h = s * (0.4 + H(v, i) * 0.4); g.beginPath(); g.moveTo(px - 5, py); g.lineTo(px - 2, py - h); g.lineTo(px + 3, py - h * 0.9); g.lineTo(px + 6, py); g.closePath(); g.fillStyle = lgrad(g, px, py - h / 2, h / 2, '#f2e05a'); g.fill(); ink(g, 2); }
  g.beginPath(); g.moveTo(x - s * 0.3, y + s * 0.05); g.lineTo(x + s * 0.3, y - s * 0.05); g.strokeStyle = '#ff9a2a'; g.lineWidth = 2; g.stroke();
}
function forgeTent(g, o) { // an outpost smithy tent: canvas over iron poles, a soot-black door
  const s = o.size, x = o.x, y = o.y, col = ['#8a5a3a', '#6a5a7a', '#7a6a3a', '#8a4a4a'][o.variant % 4];
  shadow(g, x + 8, y + s * 0.5, s * 1.1, s * 0.45, 0.25);
  g.beginPath(); g.moveTo(x, y - s * 0.95); g.lineTo(x + s, y + s * 0.4); g.lineTo(x - s, y + s * 0.4); g.closePath(); g.fillStyle = lgrad(g, x, y, s, col); g.fill(); ink(g, 3);
  g.beginPath(); g.moveTo(x, y - s * 0.95); g.lineTo(x, y + s * 0.4); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2.5; g.stroke();
  g.beginPath(); g.moveTo(x - s * 0.2, y + s * 0.4); g.lineTo(x, y - s * 0.08); g.lineTo(x + s * 0.2, y + s * 0.4); g.closePath(); g.fillStyle = '#1e1618'; g.fill();
  g.beginPath(); g.ellipse(x - s * 0.1, y - s * 0.5, s * 0.25, s * 0.08, -0.6, 0, TAU); g.fillStyle = 'rgba(40,30,30,.5)'; g.fill(); // soot
  circle(g, x + s * 0.55, y + s * 0.2, 4, '#ffb36a', 1.6);
}
function fossilRib(g, o) {
  const s = o.size, x = o.x, y = o.y, sd = o.side || 1;
  g.save(); g.translate(x, y); g.scale(1, sd);
  g.beginPath(); g.moveTo(-s * 0.15, s * 0.5); g.quadraticCurveTo(-s * 0.4, -s * 0.6, s * 0.3, -s * 1.1); g.strokeStyle = INK; g.lineWidth = s * 0.32 + 5; g.lineCap = 'round'; g.stroke(); g.strokeStyle = '#d8c8a8'; g.lineWidth = s * 0.32; g.stroke();
  g.beginPath(); g.moveTo(-s * 0.2, s * 0.3); g.quadraticCurveTo(-s * 0.36, -s * 0.5, s * 0.2, -s * 0.95); g.strokeStyle = 'rgba(80,40,20,.35)'; g.lineWidth = 3; g.stroke();
  g.restore();
}
/** tall props (y-sorted): returns true when drawn (baked kinds: nothing to draw here) */
export function drawEmberObstacle(ctx, o, t) {
  if (!o.ember && !o.forge) return false;
  if (!EMBER_TALL.has(o.kind)) return EMBER_BAKE.has(o.kind);
  const s = o.size, v = o.variant % 6, W = Math.ceil(s * 4 + 60), Ht = Math.ceil(s * 6 + 80);
  const c = sprite(`ep:${o.kind}:${v}:${s}`, W, Ht, W / 2, Ht * 0.78, (g) => TALL_FN[o.kind](g, { ...o, x: 0, y: 0, variant: v }));
  blit(ctx, c, o.x, o.y);
  if (o.kind === 'brazier') bloom(ctx, o.x, o.y - s * 1.5, s * 1.4, '#ff8a2a', 0.5 + 0.15 * Math.sin(t * 9 + o.x));
  else if (o.kind === 'lavafall') bloom(ctx, o.x, o.y, s * 1.8, '#ff7a1a', 0.45 + 0.1 * Math.sin(t * 2));
  else if (o.kind === 'obelisk') bloom(ctx, o.x, o.y - s * 2.1, s * 0.9, '#c86aff', 0.3 + 0.12 * Math.sin(t * 2.4));
  else if (o.kind === 'slagvat') bloom(ctx, o.x, o.y - s * 1.1, s * 1.1, '#ff8a2a', 0.35);
  return true;
}
function spike(g, x, y, h, w, a, col, hot) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.beginPath(); g.moveTo(-w, 0); g.lineTo(-w * 0.55, -h * 0.7); g.lineTo(0, -h); g.lineTo(w * 0.6, -h * 0.65); g.lineTo(w, 0); g.lineTo(0, w * 0.4); g.closePath();
  const gr = g.createLinearGradient(-w, 0, w, 0); gr.addColorStop(0, shade(col, 0.45)); gr.addColorStop(0.48, col); gr.addColorStop(0.52, shade(col, -0.25)); gr.addColorStop(1, shade(col, -0.45)); g.fillStyle = gr; g.fill(); ink(g, 2.8);
  g.beginPath(); g.moveTo(-w * 0.55, -h * 0.1); g.lineTo(-w * 0.4, -h * 0.62); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.stroke();
  if (hot) { g.beginPath(); g.moveTo(w * 0.2, -h * 0.15); g.lineTo(w * 0.05, -h * 0.5); g.strokeStyle = '#ff7a2a'; g.lineWidth = 2; g.stroke(); }
  g.restore();
}
const TALL_FN = {
  obsidian(g, o) { const s = o.size; shadow(g, 5, s * 0.15, s * 0.85, s * 0.3, 0.28); for (const [dx, h, w, a] of [[-s * 0.35, s * 1.1, s * 0.28, -0.3], [s * 0.34, s * 0.95, s * 0.26, 0.28], [0, s * 1.7, s * 0.36, 0]]) spike(g, dx, 0, h, w, a, '#3a2e44', o.variant % 2); },
  lavafall(g, o) {
    const s = o.size; shadow(g, 0, s * 0.3, s * 1.6, s * 0.4, 0.25);
    g.beginPath(); g.moveTo(-s * 1.5, s * 0.2); g.lineTo(-s * 1.3, -s * 1.6); g.lineTo(-s * 0.5, -s * 2.1); g.lineTo(s * 0.6, -s * 2.0); g.lineTo(s * 1.4, -s * 1.5); g.lineTo(s * 1.5, s * 0.2); g.closePath(); g.fillStyle = lgrad(g, 0, -s, s * 1.6, '#4a3634'); g.fill(); ink(g, 3.5);
    for (let i = 0; i < 6; i++) { const hx = -s * 1.1 + i * s * 0.44; g.beginPath(); g.moveTo(hx, -s * 1.7); g.lineTo(hx + 8, -s * 0.8); g.strokeStyle = 'rgba(20,8,8,.35)'; g.lineWidth = 2.4; g.stroke(); }
    g.beginPath(); g.moveTo(-s * 0.6, -s * 1.9); g.quadraticCurveTo(-s * 0.7, -s * 0.6, -s * 0.85, s * 0.2); g.lineTo(s * 0.8, s * 0.2); g.quadraticCurveTo(s * 0.65, -s * 0.6, s * 0.6, -s * 1.85); g.closePath();
    const gr = g.createLinearGradient(-s * 0.7, 0, s * 0.7, 0); gr.addColorStop(0, '#ff6a1a'); gr.addColorStop(0.5, '#ffd36a'); gr.addColorStop(1, '#e8501a'); g.fillStyle = gr; g.fill(); ink(g, 3);
    g.strokeStyle = 'rgba(255,250,200,.8)'; g.lineWidth = 3; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * s * 0.22, -s * 1.8); g.quadraticCurveTo(i * s * 0.26, -s * 0.8, i * s * 0.3, s * 0.1); g.stroke(); }
    g.beginPath(); g.ellipse(0, -s * 1.95, s * 0.8, s * 0.16, 0, Math.PI, TAU); g.fillStyle = '#2e1e1c'; g.fill();
  },
  dragonskull(g, o) { // the Dragon's Jaw: a huge horned fossil skull, jaw agape (facing west)
    const s = o.size; shadow(g, 6, s * 0.4, s * 1.4, s * 0.45, 0.28);
    g.beginPath(); g.moveTo(-s * 1.3, -s * 0.3); g.quadraticCurveTo(-s * 0.4, -s * 1.3, s * 0.6, -s * 1.1); g.quadraticCurveTo(s * 1.2, -s * 0.8, s * 1.0, -s * 0.1); g.lineTo(-s * 1.1, -s * 0.05); g.closePath(); g.fillStyle = lgrad(g, 0, -s * 0.6, s, '#e2d4b4'); g.fill(); ink(g, 3.5);
    g.beginPath(); g.moveTo(-s * 1.2, s * 0.15); g.lineTo(s * 0.8, s * 0.05); g.lineTo(s * 0.7, s * 0.35); g.lineTo(-s * 1.0, s * 0.4); g.closePath(); g.fillStyle = lgrad(g, 0, s * 0.25, s, '#d4c4a2'); g.fill(); ink(g, 3);
    for (let i = 0; i < 6; i++) { const tx = -s * 1.05 + i * s * 0.3; g.beginPath(); g.moveTo(tx, -s * 0.07); g.lineTo(tx + 6, s * 0.12); g.lineTo(tx + 12, -s * 0.06); g.closePath(); g.fillStyle = '#f4ead4'; g.fill(); ink(g, 1.6); }
    g.beginPath(); g.ellipse(s * 0.25, -s * 0.7, s * 0.22, s * 0.16, 0, 0, TAU); g.fillStyle = '#2b2020'; g.fill(); circle(g, s * 0.25, -s * 0.7, s * 0.07, '#ff7a2a', 0);
    g.beginPath(); g.moveTo(s * 0.5, -s * 1.05); g.quadraticCurveTo(s * 1.0, -s * 1.8, s * 1.5, -s * 1.6); g.quadraticCurveTo(s * 1.05, -s * 1.4, s * 0.8, -s * 0.9); g.closePath(); g.fillStyle = lgrad(g, s, -s * 1.3, s * 0.5, '#cbb894'); g.fill(); ink(g, 2.8);
  },
  brazier(g, o) { const s = o.size; shadow(g, 3, s * 0.2, s * 0.6, s * 0.22, 0.25); g.beginPath(); g.moveTo(-s * 0.3, 0); g.lineTo(-s * 0.18, -s * 1.1); g.lineTo(s * 0.18, -s * 1.1); g.lineTo(s * 0.3, 0); g.closePath(); g.fillStyle = lgrad(g, 0, -s * 0.5, s * 0.4, '#5a4a48'); g.fill(); ink(g, 2.6); g.beginPath(); g.ellipse(0, -s * 1.15, s * 0.55, s * 0.2, 0, 0, TAU); g.fillStyle = '#3a2a28'; g.fill(); ink(g, 2.6); for (let i = 0; i < 3; i++) { const k = 1 - i * 0.28; g.beginPath(); g.moveTo(-s * 0.4 * k, -s * 1.15); g.quadraticCurveTo(-s * 0.3 * k, -s * 1.6 * k - s * 0.2, 0, -s * 1.15 - s * 0.9 * k); g.quadraticCurveTo(s * 0.3 * k, -s * 1.6 * k - s * 0.2, s * 0.4 * k, -s * 1.15); g.closePath(); g.fillStyle = ['#ff6a2a', '#ffb43c', '#fff2a0'][i]; g.fill(); if (!i) ink(g, 2); } },
  obelisk(g, o) { const s = o.size; shadow(g, 8, s * 0.2, s * 0.9, s * 0.32, 0.3); g.beginPath(); g.moveTo(-s * 0.42, 0); g.lineTo(-s * 0.3, -s * 2.4); g.lineTo(0, -s * 2.8); g.lineTo(s * 0.3, -s * 2.4); g.lineTo(s * 0.42, 0); g.closePath(); const gr = g.createLinearGradient(-s * 0.4, 0, s * 0.4, 0); gr.addColorStop(0, '#5a4a6a'); gr.addColorStop(0.5, '#2a2036'); gr.addColorStop(1, '#16101e'); g.fillStyle = gr; g.fill(); ink(g, 3); g.strokeStyle = '#c86aff'; g.lineWidth = 2.6; for (let i = 0; i < 4; i++) { const yy = -s * (0.5 + i * 0.45); g.beginPath(); g.moveTo(-s * 0.12, yy); g.lineTo(0, yy - s * 0.15); g.lineTo(s * 0.12, yy); g.stroke(); } g.beginPath(); g.moveTo(-s * 0.2, -s * 2.3); g.lineTo(-s * 0.3, -s * 0.2); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.stroke(); },
  glasspane(g, o) { const s = o.size; shadow(g, 3, s * 0.15, s * 0.6, s * 0.2, 0.22); rrect(g, -s * 0.45, -s * 1.8, s * 0.9, s * 1.8, 4); const gr = g.createLinearGradient(-s * 0.45, -s * 1.8, s * 0.45, 0); gr.addColorStop(0, 'rgba(220,255,250,.85)'); gr.addColorStop(0.5, 'rgba(120,220,210,.55)'); gr.addColorStop(1, 'rgba(60,140,140,.75)'); g.fillStyle = gr; g.fill(); ink(g, 2.6); g.beginPath(); g.moveTo(-s * 0.25, -s * 1.6); g.lineTo(-s * 0.05, -s * 1.1); g.moveTo(s * 0.1, -s * 0.8); g.lineTo(s * 0.25, -s * 0.5); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2.4; g.stroke(); rrect(g, -s * 0.55, -s * 0.12, s * 1.1, s * 0.2, 3); g.fillStyle = '#4a3a38'; g.fill(); ink(g, 2); },
  gnomon(g, o) { const s = o.size; shadow(g, 6, s * 0.15, s * 0.8, s * 0.3, 0.3); g.beginPath(); g.ellipse(0, 0, s * 0.8, s * 0.32, 0, 0, TAU); g.fillStyle = '#8a6a3a'; g.fill(); ink(g, 2.6); g.beginPath(); g.moveTo(-s * 0.3, 0); g.lineTo(-s * 0.2, -s * 2.3); g.lineTo(s * 0.05, -s * 2.6); g.lineTo(s * 0.3, 0); g.closePath(); g.fillStyle = lgrad(g, 0, -s * 1.2, s * 0.5, '#d8a84a'); g.fill(); ink(g, 3); g.beginPath(); g.moveTo(-s * 0.1, -s * 2.2); g.lineTo(-s * 0.18, -s * 0.2); g.strokeStyle = 'rgba(255,250,210,.7)'; g.lineWidth = 2.4; g.stroke(); circle(g, s * 0.02, -s * 2.0, s * 0.12, '#fff2a0', 2); },
  anvil(g, o) { const s = o.size; shadow(g, 4, s * 0.3, s * 1.0, s * 0.35, 0.3); rrect(g, -s * 0.35, -s * 0.6, s * 0.7, s * 0.7, 4); g.fillStyle = lgrad(g, 0, -s * 0.3, s * 0.5, '#4a4448'); g.fill(); ink(g, 2.6); g.beginPath(); g.moveTo(-s * 1.0, -s * 1.0); g.lineTo(s * 0.7, -s * 1.0); g.quadraticCurveTo(s * 1.2, -s * 0.95, s * 1.1, -s * 0.75); g.lineTo(-s * 0.7, -s * 0.6); g.closePath(); g.fillStyle = lgrad(g, 0, -s * 0.85, s, '#6a6468'); g.fill(); ink(g, 3); g.beginPath(); g.moveTo(-s * 0.8, -s * 0.95); g.lineTo(s * 0.6, -s * 0.95); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2; g.stroke(); rrect(g, -s * 0.3, -s * 1.12, s * 0.5, s * 0.12, 3); g.fillStyle = '#ff8a2a'; g.fill(); },
  slagvat(g, o) { const s = o.size; shadow(g, 4, s * 0.3, s * 0.95, s * 0.35, 0.3); g.beginPath(); g.moveTo(-s * 0.8, -s * 1.0); g.lineTo(-s * 0.65, 0); g.lineTo(s * 0.65, 0); g.lineTo(s * 0.8, -s * 1.0); g.closePath(); g.fillStyle = lgrad(g, 0, -s * 0.5, s * 0.8, '#5a4a40'); g.fill(); ink(g, 3); for (const yy of [-0.25, -0.75]) { g.beginPath(); g.moveTo(-s * 0.78, s * yy); g.lineTo(s * 0.78, s * yy); g.strokeStyle = '#2e2420'; g.lineWidth = 4; g.stroke(); } g.beginPath(); g.ellipse(0, -s * 1.0, s * 0.8, s * 0.26, 0, 0, TAU); g.fillStyle = '#2e1e1a'; g.fill(); ink(g, 2.6); g.beginPath(); g.ellipse(0, -s * 1.0, s * 0.62, s * 0.18, 0, 0, TAU); const gr = g.createRadialGradient(0, -s, 2, 0, -s, s * 0.6); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(0.6, '#ff8a2a'); gr.addColorStop(1, '#a8301a'); g.fillStyle = gr; g.fill(); },
};

// ------------------------------------------------------------------ live overlays (cheap, every frame)
export function drawEmberLive(ctx, view, t) {
  if (!emberVisible(view)) return false;
  // the lava flows: a bright dashed core sliding downstream (one stroke per river)
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([46, 64]); ctx.lineDashOffset = -t * 60;
  ctx.globalAlpha = 0.55 + 0.15 * Math.sin(t * 2.2); ctx.strokeStyle = '#fff2b0'; ctx.lineWidth = LAVA_W * 0.16;
  const P = lavaPaths();
  for (let i = 0; i < P.length; i++) { const L = EMBER_LAVA[i]; let vis = false; for (const q of L) if (q.x > view.x0 - 200 && q.x < view.x1 + 200 && q.y > view.y0 - 200 && q.y < view.y1 + 200) { vis = true; break; } if (vis) ctx.stroke(P[i]); }
  ctx.restore();
  const C = EMBER_CAMP;
  if (near(view, C, 400)) { const f = 0.6 + 0.25 * Math.sin(t * 9) + 0.15 * Math.sin(t * 23); bloom(ctx, C.x, C.y, 160, '#ff9a3a', 0.4 * f); fire(ctx, C.x, C.y, t); }
  const S = EMBER_SITES.shrine;
  if (near(view, S, 300)) bloom(ctx, S.x, S.y, S.r * 1.6, '#ff8a3a', 0.25 + 0.08 * Math.sin(t * 1.6));
  for (const v of EMBER_VENTS) { // idle vents breathe a little steam
    if (!near(view, v, 160)) continue;
    for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i / 3 + v.ph * 0.01) % 1; ctx.globalAlpha = 0.35 * (1 - ph); circle(ctx, v.x + Math.sin(t + i * 2) * 8, v.y - ph * 70, 10 + ph * 18, '#e8e0d8', 0); }
    ctx.globalAlpha = 1;
  }
  return true;
}
function fire(ctx, x, y, t) {
  for (let i = 0; i < 3; i++) { const k = 1 - i * 0.28, fl = Math.sin(t * 14 + i * 2) * 3; ctx.beginPath(); ctx.moveTo(x - 22 * k, y + 4); ctx.quadraticCurveTo(x - 16 * k + fl, y - 26 * k, x + fl, y - 50 * k); ctx.quadraticCurveTo(x + 16 * k + fl, y - 26 * k, x + 22 * k, y + 4); ctx.closePath(); ctx.fillStyle = ['#ff6a2a', '#ffb43c', '#fff2a0'][i]; ctx.fill(); if (!i) ink(ctx, 2.4); }
}
/** over the characters: falling ash + rising embers (heavier deeper in), a red sky during an Eruption */
export function drawEmberOver(ctx, sim, local, view, t, lite) {
  if (!emberVisible(view) || !local || !inEmberArea(local.x, local.y, 600) || inForgeArea(local.x, local.y)) return;
  const re = ES.re(local.x, local.y), n = lite ? 18 : re > EMBER_RINGS[3] ? 60 : 38;
  const W = view.x1 - view.x0, Hh = view.y1 - view.y0;
  ctx.fillStyle = 'rgba(210,200,190,.7)';
  for (let i = 0; i < n; i++) {
    const sp = 30 + H(i, 7) * 40, ph = (t * sp + H(i, 3) * Hh) % Hh, x = view.x0 + ((H(i, 1) * W + Math.sin(t * 0.7 + i) * 26 + t * 14) % W + W) % W, y = view.y0 + ph, r = 1.4 + H(i, 9) * 2.2;
    ctx.fillRect(x, y, r * 1.6, r);
  }
  ctx.fillStyle = '#ffb04a';
  for (let i = 0; i < (lite ? 6 : 16); i++) { const sp = 50 + H(i, 17) * 50, ph = (t * sp + H(i, 13) * Hh) % Hh, x = view.x0 + ((H(i, 11) * W + Math.sin(t * 2 + i) * 18) % W + W) % W, y = view.y1 - ph; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 9 + i); ctx.fillRect(x, y, 2.6, 2.6); }
  ctx.globalAlpha = 1;
  for (const a of sim.areas) {
    if (a.kind !== 'eruptwarn' || Math.hypot(local.x - a.x, local.y - a.y) > a.r) continue;
    const k = Math.max(0, Math.min(1, a.t / 40)) * (0.5 + 0.5 * (a.t / Math.max(1, a.delay)));
    ctx.fillStyle = `rgba(200,40,10,${0.16 * k})`; ctx.fillRect(view.x0, view.y0, W, Hh);
    break;
  }
}

// ------------------------------------------------------------------ telegraph kinds (render.js drawArea hook)
const prog = (a) => Math.min(1, a.t / Math.max(1, a.delay));
const fadeOf = (a, inn = 10, out = 14) => Math.max(0, Math.min(1, a.t / inn, (a.delay - a.t) / out + 1));
function path(ctx, a, k) {
  ctx.beginPath();
  if (a.shape === 'circle') ctx.arc(a.x, a.y, Math.max(0.1, a.r * k), 0, TAU);
  else if (a.shape === 'donut') { const r = Math.max(a.r0 + 0.1, a.r0 + (a.r - a.r0) * k); ctx.arc(a.x, a.y, r, 0, TAU); ctx.moveTo(a.x + a.r0, a.y); ctx.arc(a.x, a.y, a.r0, TAU, 0, true); }
  else if (a.shape === 'cone') { ctx.moveTo(a.x, a.y); ctx.arc(a.x, a.y, Math.max(0.1, a.r * k), a.ang - a.arc / 2, a.ang + a.arc / 2); ctx.closePath(); }
  else if (a.shape === 'line') { const c = Math.cos(a.ang), s = Math.sin(a.ang), hw = a.w / 2, L = a.len * k; ctx.moveTo(a.x - s * hw, a.y + c * hw); ctx.lineTo(a.x - s * hw + c * L, a.y + c * hw + s * L); ctx.lineTo(a.x + s * hw + c * L, a.y - c * hw + s * L); ctx.lineTo(a.x + s * hw, a.y - c * hw); ctx.closePath(); }
}
/** fire-styled danger telegraph: molten fill, a fill-up showing the moment it lands, ember edge */
function fireTele(ctx, a, t, edge = '#ff6a1a', fill = '255,90,30') {
  const p = prog(a);
  ctx.save();
  path(ctx, a, 1); ctx.fillStyle = `rgba(${fill},.16)`; ctx.fill('evenodd');
  ctx.lineWidth = 3.5; ctx.strokeStyle = edge; ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 18); ctx.stroke(); ctx.globalAlpha = 1;
  if (a.t < a.delay) { path(ctx, a, p); ctx.fillStyle = `rgba(${fill},.34)`; ctx.fill('evenodd'); }
  ctx.restore();
}
function laneArrow(ctx, a, t, col) { // a visual dash / roll lane: chevrons racing along it
  const c = Math.cos(a.ang), s = Math.sin(a.ang), k = Math.min(1, a.t / 8);
  ctx.save(); ctx.globalAlpha = 0.85 * k;
  path(ctx, a, 1); ctx.fillStyle = 'rgba(255,90,30,.14)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.setLineDash([14, 10]); ctx.stroke(); ctx.setLineDash([]);
  ctx.translate(a.x, a.y); ctx.rotate(a.ang);
  for (let i = 0; i < 5; i++) { const px = ((i / 5 + t * 1.4) % 1) * (a.len - 40) + 20; ctx.beginPath(); ctx.moveTo(px, -a.w * 0.3); ctx.lineTo(px + 22, 0); ctx.lineTo(px, a.w * 0.3); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.lineWidth = 4.5; ctx.strokeStyle = '#ffd08a'; ctx.stroke(); }
  ctx.restore(); void c; void s;
}
function countdown(ctx, x, y, r, left, col, w = 10) { ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.max(0, left) * TAU); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); }
function lavaFill(ctx, t) { const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 600); g.addColorStop(0, '#ffb43c'); g.addColorStop(1, '#e8501a'); return g; }
const inEB = (x, y) => (x > EB.x0 - 400 && x < EB.x1 + 400 && y > EB.y0 - 400 && y < EB.y1 + 400) || inForgeArea(x, y); // (kind names like 'sun' / 'ember' are shared with other biomes)
export function drawEmberArea(ctx, a, t) {
  if (!inEB(a.x, a.y)) return false;
  switch (a.kind) {
    case 'firepool': {
      if (a.t < a.delay) { fireTele(ctx, a, t); return true; }
      const life = a.delay + (a.pulses - 1) * a.every, f = Math.max(0, Math.min(1, (life + 10 - a.t) / 16));
      ctx.save(); ctx.globalAlpha = f * (0.55 + 0.1 * Math.sin(t * 12 + a.x));
      const gr = ctx.createRadialGradient(a.x, a.y, 2, a.x, a.y, a.r); gr.addColorStop(0, 'rgba(255,230,120,.9)'); gr.addColorStop(0.55, 'rgba(255,110,30,.7)'); gr.addColorStop(1, 'rgba(160,30,10,.0)'); circle(ctx, a.x, a.y, a.r, gr, 0);
      for (let i = 0; i < 5; i++) { const an = i * 1.3 + (a.id || 0), rr = a.r * 0.55, fx = a.x + Math.cos(an) * rr * Math.sin(t + i), fy = a.y + Math.sin(an) * rr * 0.6, k = 0.7 + 0.3 * Math.sin(t * 14 + i); ctx.beginPath(); ctx.moveTo(fx - 7 * k, fy); ctx.quadraticCurveTo(fx, fy - 22 * k, fx + 1, fy - 26 * k); ctx.quadraticCurveTo(fx + 3, fy - 10 * k, fx + 7 * k, fy); ctx.closePath(); ctx.fillStyle = i % 2 ? '#ffb43c' : '#ff6a2a'; ctx.fill(); }
      ctx.restore(); return true;
    }
    case 'fuse': {
      const left = Math.max(0, 1 - a.t / Math.max(1, a.delay));
      ctx.save(); ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * (10 + (1 - left) * 30)); circle(ctx, a.x, a.y, a.r, '#ff3b2b', 0); ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 60; ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 4; ctx.stroke(); ctx.setLineDash([]);
      countdown(ctx, a.x, a.y, a.r - 14, left, '#ff3b2b', 8);
      ctx.restore(); return true;
    }
    case 'dive': laneArrow(ctx, a, t, '#ffb36a'); return true;
    case 'roll': laneArrow(ctx, a, t, '#ff8a3a'); return true;
    case 'firebomb': case 'kindleboom': case 'crack': case 'smash': case 'eelerupt': case 'shell': case 'fist': case 'tailslam': case 'tail': case 'pipe': case 'anneal':
      fireTele(ctx, a, t, a.kind === 'anneal' ? '#ff4b1f' : a.kind === 'pipe' ? '#7ff0e0' : '#ff6a1a', a.kind === 'pipe' ? '120,240,220' : '255,90,30');
      if (a.kind === 'eelerupt' && a.t < a.delay) { ctx.save(); ctx.globalAlpha = 0.7; for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU + t; circle(ctx, a.x + Math.cos(an) * a.r * 0.5, a.y + Math.sin(an) * a.r * 0.4, 4 + 2 * Math.sin(t * 8 + i), '#ffb43c', 0); } ctx.restore(); }
      if (a.kind === 'shell' && a.t < a.delay) { const k = 1 - prog(a); ctx.save(); circle(ctx, a.x, a.y - 400 * k, 10 + 4 * (1 - k), '#3a2a28', 3); bloom(ctx, a.x, a.y - 400 * k, 22, '#ff8a2a', 0.6); ctx.restore(); }
      return true;
    case 'hammer': if (a.shape !== 'cone') return false; fireTele(ctx, a, t, '#ffb36a'); return true;
    case 'hour': { fireTele(ctx, a, t, '#ffb02e', '255,170,40'); return true; }
    case 'beat': {
      const p = prog(a); ctx.save();
      path(ctx, a, 1); ctx.fillStyle = 'rgba(255,70,40,.12)'; ctx.fill('evenodd');
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r0 + (a.r - a.r0) * p, 0, TAU); ctx.strokeStyle = '#ff4b2b'; ctx.lineWidth = 5; ctx.globalAlpha = 0.5 + 0.5 * p; ctx.stroke();
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.strokeStyle = '#ffb36a'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore(); return true;
    }
    case 'geyser': {
      const p = prog(a), left = 1 - p; ctx.save();
      circle(ctx, a.x, a.y, a.r, 'rgba(255,255,255,.14)', 0); ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 20); ctx.setLineDash([12, 10]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      circle(ctx, a.x, a.y, a.r * p, 'rgba(255,240,220,.28)', 0); countdown(ctx, a.x, a.y, a.r + 8, left, '#ffd36a', 6);
      for (let i = 0; i < 4; i++) { const ph = (t * 1.6 + i / 4) % 1; ctx.globalAlpha = 0.5 * (1 - ph) * p; circle(ctx, a.x + Math.sin(t * 3 + i) * 14, a.y - ph * 110 * p, 12 + ph * 22, '#f4eee8', 0); }
      ctx.restore(); return true;
    }
    case 'pane': { // a mirror pane (centred on x, y): cool glass, red-hot while it anneals
      const hot = Math.max(0, Math.min(1, (a.t - (a.delay - PANE.anneal)) / PANE.anneal)), k = Math.min(1, a.t / 16);
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.ang); ctx.globalAlpha = k;
      const L = a.len / 2;
      shadow(ctx, 6, 10, L, 10, 0.25);
      rrect(ctx, -L, -9, L * 2, 18, 6); const gr = ctx.createLinearGradient(-L, 0, L, 0); gr.addColorStop(0, hot ? '#ffb36a' : '#d8fffa'); gr.addColorStop(0.5, hot ? '#ff4b1f' : '#7fe0d6'); gr.addColorStop(1, hot ? '#ffd36a' : '#bff6f0'); ctx.fillStyle = gr; ctx.fill(); ink(ctx, 3);
      for (let i = 0; i < 4; i++) { const ph = (t * 0.6 + i / 4) % 1; star(ctx, -L + ph * L * 2, -2, 4, 'rgba(255,255,255,.9)', 0); }
      if (hot > 0) { ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 30); rrect(ctx, -L - 6, -15, L * 2 + 12, 30, 10); ctx.strokeStyle = '#ff3b1b'; ctx.lineWidth = 4; ctx.stroke(); }
      ctx.restore(); return true;
    }
    case 'redhot': { const p = prog(a); ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * p; circle(ctx, a.x, a.y, a.r * (0.4 + 0.6 * p), 'rgba(255,80,30,.45)', 3, '#ffd36a'); ctx.restore(); return true; }
    case 'sun': drawSun(ctx, a, t); return true;
    case 'flare': {
      const left = 1 - prog(a); ctx.save();
      ctx.globalAlpha = 0.1 + 0.18 * (1 - left); circle(ctx, a.x, a.y, a.r, '#fff1a0', 0); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 6; ctx.setLineDash([24, 14]); ctx.lineDashOffset = -t * 40; ctx.stroke(); ctx.setLineDash([]);
      countdown(ctx, a.x, a.y, a.r - 30, left, '#ff9a2a', 12);
      ctx.restore(); return true;
    }
    case 'noonshade': { const left = 1 - prog(a); ctx.save(); circle(ctx, a.x, a.y, a.r, 'rgba(40,60,120,.32)', 0); ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = '#7dffb0'; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 8); ctx.stroke(); ctx.globalAlpha = 1; countdown(ctx, a.x, a.y, a.r + 10, left, '#7dffb0', 6); ctx.restore(); return true; }
    case 'tide': drawTide(ctx, a, t); return true;
    case 'shelter': { // a basalt shelter: a stone mushroom cap (safe under it)
      const k = Math.min(1, a.t / 24); ctx.save();
      circle(ctx, a.x, a.y, a.r, 'rgba(40,40,60,.35)', 0);
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = '#7dffb0'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 7); ctx.stroke(); ctx.globalAlpha = 1;
      const hgt = 70 * k; rrect(ctx, a.x - 14, a.y - hgt, 28, hgt, 6); ctx.fillStyle = lgrad(ctx, a.x, a.y - hgt / 2, 20, '#5a4a48'); ctx.fill(); ink(ctx, 2.6);
      ctx.beginPath(); ctx.ellipse(a.x, a.y - hgt, a.r * 0.75 * k, a.r * 0.32 * k, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, a.x, a.y - hgt, a.r * 0.75, '#6a5a58'); ctx.fill(); ink(ctx, 3);
      ctx.restore(); return true;
    }
    case 'eruptwarn': { const left = 1 - prog(a); ctx.save(); ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.strokeStyle = '#ff4b1f'; ctx.lineWidth = 7; ctx.setLineDash([30, 16]); ctx.lineDashOffset = t * 50; ctx.stroke(); ctx.setLineDash([]); countdown(ctx, a.x, a.y, a.r - 36, left, '#ffcf4a', 12); ctx.restore(); return true; }
    case 'meteor': {
      if (a.team !== 'enemy') return false;
      const p = prog(a), k = 1 - p; ctx.save();
      circle(ctx, a.x, a.y, a.r * (0.4 + 0.6 * p), 'rgba(255,80,30,.25)', 3, '#ff6a1a');
      const mx = a.x + 140 * k, my = a.y - 520 * k;
      ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + 60, my - 200); ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(255,140,40,.6)'; ctx.lineCap = 'round'; ctx.stroke(); ctx.globalAlpha = 1;
      bloom(ctx, mx, my, 40, '#ff7a2c', 0.8); circle(ctx, mx, my, 16 + 6 * p, '#3a2a28', 3); circle(ctx, mx - 4, my - 4, 6, '#ff8a2a', 0);
      ctx.restore(); return true;
    }
    case 'lavafloor': drawFloor(ctx, a, t); return true;
  }
  return false;
}
function drawSun(ctx, a, t) { // Solgrim's sun: gnomon shadows on the dial (the safe shade), then the burning sun on its orbit
  const sp = sunPos(a, a.t);
  ctx.save();
  for (const g of GN) {
    const dx = g.x - sp.x, dy = g.y - sp.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy, py = ux, w0 = g.r + 14, w1 = g.r + 14 + SUN.shadow * 0.1;
    ctx.beginPath(); ctx.moveTo(g.x + px * w0, g.y + py * w0); ctx.lineTo(g.x + ux * SUN.shadow + px * w1, g.y + uy * SUN.shadow + py * w1); ctx.lineTo(g.x + ux * SUN.shadow - px * w1, g.y + uy * SUN.shadow - py * w1); ctx.lineTo(g.x - px * w0, g.y - py * w0); ctx.closePath();
    ctx.fillStyle = 'rgba(30,40,90,.38)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(125,255,176,.55)'; ctx.stroke();
  }
  bloom(ctx, sp.x, sp.y, 150, '#ffcf4a', 0.75);
  ctx.translate(sp.x, sp.y); ctx.rotate(t * 0.6);
  for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(40, -8); ctx.lineTo(70 + (i % 2) * 16, 0); ctx.lineTo(40, 8); ctx.closePath(); ctx.fillStyle = i % 2 ? '#ffb02e' : '#ffe27a'; ctx.fill(); ink(ctx, 2); }
  const g = ctx.createRadialGradient(-10, -10, 4, 0, 0, 40); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.6, '#ffd23f'); g.addColorStop(1, '#ff8a2a'); circle(ctx, 0, 0, 40, g, 3.5);
  ctx.rotate(-t * 0.6); circle(ctx, -12, -6, 4, INK, 0); circle(ctx, 12, -6, 4, INK, 0); ctx.beginPath(); ctx.arc(0, 4, 14, 0.2, Math.PI - 0.2); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
}
function drawTide(ctx, a, t) { // MAGMA TIDE: lava over the crater except one turning safe wedge
  const ang = tideAng(a, a.t), half = TIDE.arc / 2, up = Math.min(1, a.t / TIDE.warn), end = Math.max(0, Math.min(1, (a.delay - a.t) / 20));
  ctx.save(); ctx.globalAlpha = end;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.arc(a.x, a.y, a.r, ang + half, ang - half + TAU); ctx.closePath();
  if (a.t < TIDE.warn) { ctx.fillStyle = `rgba(255,90,30,${0.12 + 0.2 * up})`; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#ff6a1a'; ctx.stroke(); }
  else { ctx.save(); ctx.translate(a.x, a.y); ctx.fillStyle = lavaFill(ctx, t); ctx.restore(); ctx.save(); ctx.translate(a.x, a.y); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, a.r, ang + half, ang - half + TAU); ctx.closePath(); ctx.globalAlpha = 0.62 * end; ctx.fill(); ctx.globalAlpha = end; ctx.setLineDash([20, 26]); ctx.lineDashOffset = -t * 40; ctx.strokeStyle = '#fff2b0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, a.r * 0.6, ang + half, ang - half + TAU); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
  // the safe wedge
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.arc(a.x, a.y, a.r, ang - half, ang + half); ctx.closePath(); ctx.fillStyle = 'rgba(125,255,176,.12)'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#7dffb0'; ctx.globalAlpha = end * (0.7 + 0.3 * Math.sin(t * 8)); ctx.stroke();
  const ax = a.x + Math.cos(ang + Math.sign(a.spin || 1) * half) * a.r * 0.7, ay = a.y + Math.sin(ang + Math.sign(a.spin || 1) * half) * a.r * 0.7; star(ctx, ax, ay, 9, '#7dffb0', 2);
  ctx.restore();
}
function drawFloor(ctx, a, t) { // THE FLOOR IS LAVA: the crater floods; four obsidian rafts drift round
  const up = Math.min(1, a.t / 60), end = Math.max(0, Math.min(1, (a.delay - a.t) / 30));
  ctx.save(); ctx.globalAlpha = end;
  ctx.save(); ctx.translate(a.x, a.y); ctx.fillStyle = lavaFill(ctx, t); ctx.globalAlpha = (0.15 + 0.5 * up) * end; ctx.beginPath(); ctx.arc(0, 0, a.r, 0, TAU); ctx.fill(); ctx.restore();
  if (a.t < 60) { ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.lineWidth = 6; ctx.strokeStyle = '#ff4b1f'; ctx.setLineDash([24, 14]); ctx.stroke(); ctx.setLineDash([]); }
  for (let k = 0; k < RAFT.n; k++) {
    const q = raftPos(a, k, a.t);
    shadow(ctx, q.x + 6, q.y + 10, RAFT.r, RAFT.r * 0.4, 0.3);
    ctx.beginPath(); for (let i = 0; i < 7; i++) { const an = (i / 7) * TAU + k; const rr = RAFT.r * (0.92 + H(k, i) * 0.1); i ? ctx.lineTo(q.x + Math.cos(an) * rr, q.y + Math.sin(an) * rr * 0.8) : ctx.moveTo(q.x + Math.cos(an) * rr, q.y + Math.sin(an) * rr * 0.8); } ctx.closePath();
    ctx.fillStyle = lgrad(ctx, q.x, q.y, RAFT.r, '#3a2e44'); ctx.fill(); ink(ctx, 3.5);
    ctx.lineWidth = 4; ctx.strokeStyle = '#7dffb0'; ctx.globalAlpha = end * (0.6 + 0.3 * Math.sin(t * 6 + k)); ctx.stroke(); ctx.globalAlpha = end;
  }
  ctx.restore();
}

// ------------------------------------------------------------------ bullets
const PSTY = new Set(['basalt', 'mine', 'magma', 'glass', 'sun', 'ember']);
export function drawEmberProjectile(ctx, pr, x, y, lite, t) {
  if (!PSTY.has(pr.style) || !inEB(x, y)) return false;
  const still = !pr.vx && !pr.vy, r = pr.r + 1;
  if (!still) pr.lastAng = Math.atan2(pr.vy, pr.vx);
  const ang = pr.lastAng ?? (pr.id || 0) * 2.4;
  switch (pr.style) {
    case 'ember': if (!lite) bloom(ctx, x, y, r * 3, '#ff8a3c', 0.6); ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(r * 1.6, 0); ctx.quadraticCurveTo(0, -r, -r * 1.2, 0); ctx.quadraticCurveTo(0, r, r * 1.6, 0); ctx.fillStyle = '#ff8a3c'; ctx.fill(); ink(ctx, 2.4); circle(ctx, r * 0.3, 0, r * 0.4, '#fff2a0', 0); ctx.restore(); return true;
    case 'basalt': ctx.save(); ctx.translate(x, y); ctx.rotate(t * 8 + (pr.id || 0)); ctx.beginPath(); for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU; i ? ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r) : ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fillStyle = lgrad(ctx, 0, 0, r, '#5a4a48'); ctx.fill(); ink(ctx, 2.6); ctx.beginPath(); ctx.moveTo(-r * 0.4, 0); ctx.lineTo(r * 0.3, r * 0.2); ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); return true;
    case 'mine': { const k = 0.7 + 0.3 * Math.sin(t * 10 + (pr.id || 0)); if (!lite) bloom(ctx, x, y, r * 3.2, '#ff6a1a', 0.55 * k); circle(ctx, x, y, r, '#3a2420', 2.6); circle(ctx, x, y, r * 0.55 * k, '#ffb43c', 0); for (let i = 0; i < 4; i++) { const an = (i / 4) * TAU + t; ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r, y + Math.sin(an) * r); ctx.lineTo(x + Math.cos(an) * (r + 5), y + Math.sin(an) * (r + 5)); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke(); } if (still) { ctx.save(); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(x, y, r + 8, 0, TAU); ctx.setLineDash([4, 4]); ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); ctx.restore(); } return true; }
    case 'magma': { if (!lite) bloom(ctx, x, y, r * 3.4, '#ff5a1a', 0.7); ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3, r, 0, 0, TAU); const g = ctx.createRadialGradient(r * 0.3, -r * 0.3, 1, 0, 0, r * 1.3); g.addColorStop(0, '#fff2a0'); g.addColorStop(0.5, '#ff8a2a'); g.addColorStop(1, '#a8301a'); ctx.fillStyle = g; ctx.fill(); ink(ctx, 2.8); ctx.beginPath(); ctx.moveTo(-r * 1.2, -r * 0.4); ctx.lineTo(-r * 2.2, -r * 0.2); ctx.moveTo(-r * 1.2, r * 0.4); ctx.lineTo(-r * 2.0, r * 0.3); ctx.strokeStyle = 'rgba(255,140,40,.7)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); return true; }
    case 'glass': { if (!lite) bloom(ctx, x, y, r * 3, '#7ff0e0', 0.5); ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(r * 1.7, 0); ctx.lineTo(0, -r * 0.6); ctx.lineTo(-r * 1.1, 0); ctx.lineTo(0, r * 0.6); ctx.closePath(); ctx.fillStyle = (pr.refl ? '#ffd36a' : '#bff6f0'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.beginPath(); ctx.moveTo(r * 1.4, 0); ctx.lineTo(-r * 0.7, 0); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); return true; }
    case 'sun': { if (!lite) bloom(ctx, x, y, r * 3.2, '#ffd23f', 0.7); ctx.save(); ctx.translate(x, y); ctx.rotate(t * 6); star(ctx, 0, 0, r * 1.3, '#ffe27a', 2.4); ctx.restore(); circle(ctx, x, y, r * 0.45, '#fffbe0', 0); return true; }
  }
  return false;
}

// ------------------------------------------------------------------ Forge portals (in Emberdeep)
export function forgePortals(sim) {
  if (sim.emberV !== undefined) return ((sim.emberV && sim.emberV.fp) || []).map(([x, y, t, big]) => ({ x, y, t, big }));
  return sim.forgePortals || [];
}
export function drawEmberUnder(ctx, sim, local, t, view) {
  if (!emberVisible(view)) return;
  for (const pt of forgePortals(sim)) if (pt.x > view.x0 - 80 && pt.x < view.x1 + 80 && pt.y > view.y0 - 80 && pt.y < view.y1 + 80) forgePortal(ctx, pt.x, pt.y, pt.t, pt.big, t, local);
}
export function forgePortal(ctx, x, y, life, big, t, local) {
  const R = FPORTAL.r * (big ? 1.25 : 1), fade = Math.min(1, life / 120);
  ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * fade;
  bloom(ctx, x, y, R * 2.4, '#ff8a2a', 0.55);
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.62);
  circle(ctx, 0, 0, R + 12, '#4a3634', 3.5);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; rrect(ctx, Math.cos(a) * (R + 6) - 6, Math.sin(a) * (R + 6) - 6, 12, 12, 2); ctx.fillStyle = '#7a6a66'; ctx.fill(); ink(ctx, 1.6); }
  const gg = ctx.createRadialGradient(0, 0, 2, 0, 0, R); gg.addColorStop(0, '#fffbe0'); gg.addColorStop(0.35, '#ffb43c'); gg.addColorStop(1, '#8a2010'); circle(ctx, 0, 0, R, gg, 3);
  for (let arm = 0; arm < 3; arm++) { ctx.beginPath(); ctx.moveTo(0, 0); for (let i = 1; i <= 14; i++) { const k = i / 14, a = t * 2.4 + arm * 2.09 + k * 4; ctx.lineTo(Math.cos(a) * R * k, Math.sin(a) * R * k); } ctx.strokeStyle = 'rgba(255,250,210,.6)'; ctx.lineWidth = 3; ctx.stroke(); }
  ctx.restore();
  // a little anvil glyph floats over it
  ctx.save(); ctx.translate(x, y - R * 0.9 + Math.sin(t * 3) * 4); ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(10, -6); ctx.quadraticCurveTo(18, -5, 16, 0); ctx.lineTo(-8, 2); ctx.closePath(); ctx.fillStyle = '#5a5458'; ctx.fill(); ink(ctx, 2); ctx.fillRect(-5, 2, 8, 6); ctx.restore();
  if (local && Math.hypot(local.x - x, local.y - y) < 260) {
    ctx.font = `16px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText('FORGE OF CINDERS', x, y - R - 22); ctx.fillStyle = '#ffd08a'; ctx.fillText('FORGE OF CINDERS', x, y - R - 22);
    const s = `step in · ${Math.ceil(life / 60)}s`; ctx.font = `12px ${FONT}`; ctx.strokeText(s, x, y - R - 6); ctx.fillStyle = '#fff'; ctx.fillText(s, x, y - R - 6);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ enemies (registered into art.js ENEMY_DRAW)
const lightLocal = (e) => LA - (e.face || 0);
const upright = (ctx, e) => ctx.rotate(-(e.face || 0));
Object.assign(ENEMY_ANIM, { kindler: [10, 4], moth: [8, 6], lavaeel: [6, 4], cinderling: [12, 4], thrall: [4, 4], construct: [4, 4], mortar: [3, 4] });
function hotEyes(ctx, x, dy, r, col = '#ffd36a') { circle(ctx, x, -dy, r, col, 0); circle(ctx, x, dy, r, col, 0); }
Object.assign(ENEMY_DRAW, {
  /** Cinder Imp: a small red-orange devil with a flame tuft and a firebomb; KINDLED it glows white-hot and shakes */
  kindler(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e), kin = e.state === 'kindle';
    if (kin) { ctx.translate(Math.sin(t * 60) * 2, 0); bloom(ctx, 0, 0, r * 3, '#ffd36a', 0.5 + 0.4 * Math.sin(t * 30)); }
    ctx.rotate(Math.sin(t * 12 + (e.id || 0)) * 0.1);
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-r * 0.2, sd * r * 0.6); ctx.lineTo(-r * 0.9, sd * r * 1.25); ctx.lineTo(-r * 0.4, sd * r * 0.75); ctx.closePath(); ctx.fillStyle = shade(col, -0.3); ctx.fill(); ink(ctx, 2); } // little wings
    ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.quadraticCurveTo(-r * 1.6, r * 0.5, -r * 1.7, -r * 0.1); ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.stroke(); ctx.strokeStyle = shade(col, -0.2); ctx.lineWidth = 2.2; ctx.stroke(); // tail
    ball(ctx, 0, 0, r, kin ? '#fff2a0' : col, la, 3, 0.45);
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.3, sd * r * 0.55); ctx.lineTo(r * 0.15, sd * r * 1.05); ctx.lineTo(r * 0.6, sd * r * 0.6); ctx.closePath(); ctx.fillStyle = '#3a2420'; ctx.fill(); ink(ctx, 1.8); }
    hotEyes(ctx, r * 0.5, r * 0.26, 2.6);
    ctx.beginPath(); ctx.arc(r * 0.5, 0, r * 0.25, -0.9, 0.9); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 0; i < 3; i++) { const k = 1 - i * 0.3, fl = Math.sin(t * 16 + i) * 2; ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.3 * k); ctx.quadraticCurveTo(-r * 1.1 + fl, 0, -r * 0.4, r * 0.3 * k); ctx.closePath(); ctx.fillStyle = ['#ff6a2a', '#ffb43c', '#fff2a0'][i]; ctx.fill(); }
    if (e.state === 'throw') { circle(ctx, r * 0.9, r * 0.8, r * 0.38, '#3a2420', 2.4); bloom(ctx, r * 0.9, r * 0.8, r * 0.6, '#ff8a2a', 0.8); }
  },
  /** Basalt Golem: MOLTEN = a glowing lava body with dripping cracks; HARDENED = a dark hex-column shell (statue) */
  basalt(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e), hard = e.state === 'harden', smash = e.state === 'smash';
    const fist = (sd, lift) => { const ax = r * (0.4 + lift * 0.45), ay = sd * r * (0.95 - lift * 0.2); ball(ctx, ax, ay, r * 0.4, hard ? '#4a3e44' : '#5a3a30', la, 2.8, 0.3); if (!hard) circle(ctx, ax + r * 0.1, ay, r * 0.14, '#ff8a2a', 0); };
    fist(-1, smash ? 1 : 0); fist(1, smash ? 1 : 0);
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.5; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.92) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.92); } ctx.closePath();
    if (hard) { ctx.fillStyle = lgrad(ctx, 0, 0, r, '#4a3e44', la, 0.35, -0.35); ctx.fill(); ink(ctx, 3.4); ctx.strokeStyle = 'rgba(20,10,10,.6)'; ctx.lineWidth = 2.4; for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); } if (e.st > 84) { ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.3); ctx.lineTo(0, 0); ctx.lineTo(r * 0.3, r * 0.5); ctx.stroke(); } }
    else { const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r); g.addColorStop(0, '#ffd36a'); g.addColorStop(0.45, '#ff6a1a'); g.addColorStop(1, '#7a2414'); ctx.fillStyle = g; ctx.fill(); ink(ctx, 3.2); for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.2, rr = r * 0.6; ctx.beginPath(); ctx.ellipse(Math.cos(a) * rr, Math.sin(a) * rr, r * 0.22, r * 0.16, a, 0, TAU); ctx.fillStyle = 'rgba(60,30,25,.85)'; ctx.fill(); } bloom(ctx, 0, 0, r * 1.4, '#ff7a1a', 0.3); }
    circle(ctx, r * 0.55, -r * 0.2, 3, hard ? '#ff8a2a' : '#fff2a0', 0); circle(ctx, r * 0.55, r * 0.2, 3, hard ? '#ff8a2a' : '#fff2a0', 0);
  },
  /** Ember Moth: a fuzzy amber moth with eye-spotted wings; dives with the wings swept back */
  moth(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e), dash = e.state === 'dash', flap = dash ? 0.15 : 0.6 + 0.4 * Math.sin(t * 22 + (e.id || 0));
    if (!dash) ctx.translate(0, Math.sin(t * 5 + (e.id || 0)) * 2);
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(r * 0.1, sd * r * 0.2); ctx.quadraticCurveTo(r * 0.9, sd * r * (0.6 + flap * 1.2), -r * 0.2, sd * r * (0.5 + flap * 1.5)); ctx.quadraticCurveTo(-r * 1.0, sd * r * (0.4 + flap), -r * 0.4, sd * r * 0.15); ctx.closePath();
      ctx.fillStyle = lgrad(ctx, 0, sd * r, r, col, la, 0.35, -0.3); ctx.fill(); ink(ctx, 2.4);
      circle(ctx, r * 0.05, sd * r * (0.45 + flap * 0.9), r * 0.2, '#3a2420', 1.6); circle(ctx, r * 0.05, sd * r * (0.45 + flap * 0.9), r * 0.09, '#fff2a0', 0);
    }
    oval(ctx, 0, 0, r * 0.75, r * 0.32, shade(col, -0.25), la, 2.6, 0, 0.4);
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.6, sd * r * 0.1); ctx.quadraticCurveTo(r * 1.0, sd * r * 0.35, r * 1.15, sd * r * 0.5); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke(); }
    if (!dash) bloom(ctx, -r * 0.6, 0, r * 0.8, '#ff8a2a', 0.5);
  },
  /** Magma Eel: a long glowing serpent; under the ash only a moving ripple of embers shows */
  lavaeel(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e);
    if (e.state === 'under') { ctx.save(); ctx.globalAlpha *= 0.85; for (let i = 0; i < 5; i++) { const k = i / 5; circle(ctx, -r * 2 * k, Math.sin(t * 8 - i) * r * 0.3, r * (0.5 - k * 0.3), 'rgba(80,40,30,.6)', 0); } for (let i = 0; i < 4; i++) circle(ctx, -r * i * 0.6, Math.sin(t * 12 + i) * 6, 2.4, '#ffb43c', 0); ctx.restore(); return; }
    const n = 6; for (let i = n; i >= 1; i--) { const k = i / n; ball(ctx, -r * 0.55 * i, Math.sin(t * 6 - i * 0.8) * r * 0.35, r * (0.75 - k * 0.4), i % 2 ? col : shade(col, -0.2), la, 2.6, 0.3); }
    ball(ctx, 0, 0, r * 0.82, col, la, 3, 0.45);
    ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.4); ctx.lineTo(r * 1.15, 0); ctx.lineTo(r * 0.5, r * 0.4); ctx.closePath(); ctx.fillStyle = shade(col, -0.15); ctx.fill(); ink(ctx, 2.4);
    hotEyes(ctx, r * 0.55, r * 0.26, 2.6, '#fff2a0');
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.2 - i * r * 0.5, -r * 0.5); ctx.lineTo(-r * 0.4 - i * r * 0.5, -r * 0.9); ctx.lineTo(-r * 0.6 - i * r * 0.5, -r * 0.45); ctx.fillStyle = '#3a2420'; ctx.fill(); }
    if (e.state === 'erupt' && e.st < 40) { ctx.globalAlpha *= 0.4; }
  },
  /** Ashen Bombardier: a hunched grey ash-golem with a mortar barrel on its back */
  mortar(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e), fire = e.state === 'barrage' || e.state === 'flare';
    ball(ctx, 0, 0, r, col, la, 3, 0.4);
    ctx.save(); ctx.rotate(Math.PI); rrect(ctx, -r * 0.2, -r * 0.42, r * 1.25, r * 0.84, r * 0.2); ctx.restore(); ctx.fillStyle = lgrad(ctx, -r * 0.6, 0, r, '#4a4448', la); ctx.fill(); ink(ctx, 2.8);
    circle(ctx, -r * 1.35, 0, r * 0.34, '#2a2224', 2.4); if (fire) { bloom(ctx, -r * 1.35, 0, r * 0.8, '#ff8a2a', 0.8); circle(ctx, -r * 1.35, 0, r * 0.2, '#ffb43c', 0); }
    for (const sd of [-1, 1]) ball(ctx, r * 0.5, sd * r * 0.85, r * 0.3, shade(col, -0.15), la, 2.4, 0.3);
    circle(ctx, r * 0.62, 0, r * 0.3, '#3a3034', 2.2); circle(ctx, r * 0.7, 0, 3, '#ff8a2a', 0);
  },
  /** Forge Thrall: a hulking chained smith in a leather apron swinging a sledge; enraged = red eyes, steam */
  thrall(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e), sw = e.state === 'combo' ? Math.sin(((e.st % 30) / 30) * Math.PI) : 0;
    ctx.save(); ctx.rotate(-0.9 + sw * 1.8); ctx.beginPath(); ctx.moveTo(r * 0.3, r * 0.5); ctx.lineTo(r * 1.6, r * 0.5); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 3.5; ctx.stroke(); rrect(ctx, r * 1.4, r * 0.15, r * 0.45, r * 0.7, 3); ctx.fillStyle = lgrad(ctx, r * 1.6, r * 0.5, r * 0.4, '#6a6468'); ctx.fill(); ink(ctx, 2.6); ctx.restore();
    ball(ctx, 0, 0, r, col, la, 3.2, 0.4);
    ctx.beginPath(); ctx.ellipse(r * 0.25, 0, r * 0.62, r * 0.7, 0, -1.2, 1.2); ctx.fillStyle = '#4a2e22'; ctx.fill(); ink(ctx, 2.2); // apron
    for (let i = 0; i < 4; i++) circle(ctx, -r * 0.6 + i * r * 0.15, r * (0.85 - i * 0.05), 3.4, '#8a8488', 1.6); // chain
    ball(ctx, r * 0.45, 0, r * 0.42, '#c89a7a', la, 2.6, 0.3);
    hotEyes(ctx, r * 0.68, r * 0.15, 2.4, e.rage ? '#ff3b2b' : '#ffd36a');
    if (e.rage) { ctx.save(); ctx.globalAlpha *= 0.4; circle(ctx, -r * 0.4, -r * 0.7 - (t * 30 % 20), 6, '#e8e0d8', 0); ctx.restore(); }
  },
  /** Slag Construct: a riveted iron shell full of slag; ROLLS curled into a ball with molten seams */
  construct(ctx, e, t, col) {
    const r = e.r, la = lightLocal(e), roll = e.state === 'roll' || e.state === 'wind';
    if (roll) { ctx.rotate(t * (e.state === 'roll' ? 30 : 6)); ball(ctx, 0, 0, r, '#5a4e50', la, 3.2, 0.4); for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 3; ctx.stroke(); } for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.4; circle(ctx, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, 2.4, '#bdb6b8', 0); } return; }
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, sd * r * 0.7); ctx.lineTo(r * 0.6, sd * r * 1.2); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#6a6468'; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fillStyle = lgrad(ctx, 0, 0, r, '#6a5e60', la); ctx.fill(); ink(ctx, 3);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, TAU); const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 0.55); g.addColorStop(0, '#fff2a0'); g.addColorStop(0.6, col); g.addColorStop(1, '#7a2414'); ctx.fillStyle = g; ctx.fill(); ink(ctx, 2.4);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.4; circle(ctx, Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, 2.2, '#bdb6b8', 0); }
    if (e.state === 'unfold') bloom(ctx, 0, 0, r * 1.6, '#ff8a2a', 0.5);
  },
  /** Cinderling: a hopping spark of living flame */
  cinderling(ctx, e, t, col) {
    const r = e.r, hop = Math.abs(Math.sin(t * 9 + (e.id || 0))); upright(ctx, e); ctx.translate(0, -hop * 8);
    bloom(ctx, 0, 0, r * 2.2, '#ffb43c', 0.5);
    for (let i = 0; i < 3; i++) { const k = 1 - i * 0.3, fl = Math.sin(t * 18 + i) * 2; ctx.beginPath(); ctx.moveTo(-r * k, r * 0.4); ctx.quadraticCurveTo(-r * 0.8 * k + fl, -r * 0.6 * k, fl, -r * 1.5 * k); ctx.quadraticCurveTo(r * 0.8 * k + fl, -r * 0.6 * k, r * k, r * 0.4); ctx.closePath(); ctx.fillStyle = ['#ff6a2a', col, '#fff2a0'][i]; ctx.fill(); if (!i) ink(ctx, 2.2); }
    circle(ctx, -r * 0.25, -r * 0.1, 2, INK, 0); circle(ctx, r * 0.25, -r * 0.1, 2, INK, 0);
  },
  /** Glass Bubble: a wobbling soap-glass sphere (a hero sealed inside when it has caught one) */
  glassorb(ctx, e, t, col) {
    const r = e.r; upright(ctx, e);
    const wob = 1 + Math.sin(t * 6 + (e.id || 0)) * 0.04, tr = e.trap;
    ctx.save(); ctx.scale(wob, 2 - wob);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 2, 0, 0, r); g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(0.4, tr ? 'rgba(160,240,230,.25)' : 'rgba(191,246,255,.35)'); g.addColorStop(1, 'rgba(90,200,200,.55)'); ctx.fillStyle = g; ctx.fill(); ink(ctx, 2.8);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.78, Math.PI * 1.1, Math.PI * 1.5); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0.2, 0.9); ctx.strokeStyle = 'rgba(255,170,220,.6)'; ctx.lineWidth = 2; ctx.stroke();
    if (tr) { const left = Math.max(0, 1 - (e.tt || 0) / 150); ctx.beginPath(); ctx.arc(0, 0, r + 6, -Math.PI / 2, -Math.PI / 2 + left * TAU); ctx.strokeStyle = left < 0.3 ? '#ff3b2b' : '#ffd36a'; ctx.lineWidth = 4; ctx.stroke(); if (left < 0.35) { ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(0, r * 0.1); ctx.lineTo(r * 0.3, -r * 0.4); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); } }
    ctx.restore();
  },
  vitrea: drawVitrea, solgrim: drawSolgrim, pyrrhex: drawPyrrhex,
});

// ------------------------------------------------------------------ bosses
/** Vitrea, the Glassblower: a tall teal glass-golem artisan in a leather apron, a long blowpipe glowing at the tip, a
 *  half-blown bubble on it; her body is translucent with a coal heart */
function drawVitrea(ctx, e, t, col) {
  const r = e.r, la = lightLocal(e), pipe = e.state === 'pipe', bolts = e.state === 'bolts';
  // the blowpipe (forward)
  ctx.beginPath(); ctx.moveTo(r * 0.4, r * 0.3); ctx.lineTo(r * 1.9, r * 0.15); ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#8a6a48'; ctx.lineWidth = 4; ctx.stroke();
  const bub = e.state === 'bubbles' ? 1 : 0.55; ctx.beginPath(); ctx.arc(r * 2.1, r * 0.14, r * 0.32 * bub + 6, 0, TAU); ctx.fillStyle = 'rgba(191,246,255,.5)'; ctx.fill(); ink(ctx, 2.2);
  if (pipe || bolts) bloom(ctx, r * 2.0, r * 0.15, r * 0.9, pipe ? '#7ff0e0' : '#ffd36a', 0.85);
  // body
  ctx.save(); ctx.globalAlpha *= 0.92; ball(ctx, 0, 0, r * 0.95, col, la, 3.4, 0.6); ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.95, Math.PI * 1.1, Math.PI * 1.55); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 5; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(r * 0.15, 0, r * 0.6, r * 0.75, 0, -1.3, 1.3); ctx.fillStyle = '#6a4a32'; ctx.fill(); ink(ctx, 2.6); // apron
  bloom(ctx, -r * 0.2, 0, r * 0.6, '#ff8a2a', 0.6 + 0.2 * Math.sin(t * 4)); circle(ctx, -r * 0.2, 0, r * 0.18, '#ffb43c', 2);
  // head: a glass bell with goggles
  ball(ctx, r * 0.55, 0, r * 0.38, shade(col, 0.15), la, 3, 0.6);
  for (const sd of [-1, 1]) { circle(ctx, r * 0.72, sd * r * 0.15, r * 0.12, '#3a2420', 2); circle(ctx, r * 0.74, sd * r * 0.15, r * 0.07, e.phase >= 2 ? '#ff6a2a' : '#fff2a0', 0); }
  for (const sd of [-1, 1]) ball(ctx, r * 0.2, sd * r * 0.95, r * 0.25, shade(col, -0.1), la, 2.4, 0.4);
  if (e.phase >= 2) { ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.6); ctx.lineTo(-r * 0.2, -r * 0.2); ctx.lineTo(-r * 0.4, r * 0.1); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.stroke(); }
}
/** Solgrim, the Ember Sundial: a great bronze salamander (top-down) with a sundial disc set into its back, a gnomon fin
 *  standing up from it, molten-gold seams; the hour marks glow as it strikes */
function drawSolgrim(ctx, e, t, col) {
  const r = e.r, la = lightLocal(e), sway = Math.sin(t * 3) * 0.25;
  // tail
  ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.25); ctx.quadraticCurveTo(-r * 1.6, Math.sin(t * 3) * r * 0.6, -r * 2.2, Math.sin(t * 3 - 1) * r * 0.5); ctx.quadraticCurveTo(-r * 1.6, Math.sin(t * 3) * r * 0.6 + r * 0.2, -r * 0.7, r * 0.25); ctx.closePath(); ctx.fillStyle = lgrad(ctx, -r * 1.4, 0, r, shade(col, -0.2), la); ctx.fill(); ink(ctx, 3);
  for (const [lx, sd, ph] of [[0.55, -1, 0], [0.55, 1, Math.PI], [-0.45, -1, Math.PI], [-0.45, 1, 0]]) { const sw = Math.sin(t * 6 + ph) * r * 0.15; ctx.beginPath(); ctx.moveTo(r * lx, sd * r * 0.5); ctx.lineTo(r * lx + sw + r * 0.2, sd * r * 1.05); ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = shade(col, -0.25); ctx.lineWidth = 6; ctx.stroke(); circle(ctx, r * lx + sw + r * 0.2, sd * r * 1.05, 5, shade(col, -0.3), 2); }
  oval(ctx, 0, 0, r * 0.95, r * 0.7, col, la, 3.4, 0, 0.5);
  // the dial on its back
  ctx.beginPath(); ctx.arc(-r * 0.05, 0, r * 0.55, 0, TAU); ctx.fillStyle = lgrad(ctx, 0, 0, r * 0.55, '#e8c47a', la); ctx.fill(); ink(ctx, 2.8);
  const strike = e.state === 'hour' || e.state === 'flare' || e.state === 'noon';
  for (let h = 0; h < 12; h++) { const a = (h / 12) * TAU - Math.PI / 2; ctx.beginPath(); ctx.moveTo(-r * 0.05 + Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4); ctx.lineTo(-r * 0.05 + Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52); ctx.strokeStyle = strike && h % 3 === 0 ? '#ff6a1a' : '#7a4a1a'; ctx.lineWidth = h % 3 ? 2 : 4; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-r * 0.05, 0); ctx.lineTo(-r * 0.05 + Math.cos(sway) * r * 0.5, Math.sin(sway) * r * 0.5); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 3; ctx.stroke(); // the gnomon fin
  if (strike) bloom(ctx, 0, 0, r * 1.4, '#ffcf4a', 0.45);
  // head
  oval(ctx, r * 1.05, 0, r * 0.45, r * 0.36, shade(col, 0.08), la, 3, 0, 0.5);
  for (const sd of [-1, 1]) { circle(ctx, r * 1.2, sd * r * 0.2, r * 0.1, '#fff2a0', 2); circle(ctx, r * 1.23, sd * r * 0.2, r * 0.045, INK, 0); }
  if (e.state === 'spit') bloom(ctx, r * 1.5, 0, r * 0.7, '#ffd23f', 0.8);
}
/** Pyrrhex, the Caldera Heart: a colossal beating heart of magma (top-down) in an obsidian ribcage, arteries of lava
 *  snaking out across the ground; it swells on each beat */
function drawPyrrhex(ctx, e, t, col) {
  const r = e.r; upright(ctx, e);
  const beat = e.state === 'heartbeat' ? Math.max(0, Math.sin(t * 9)) ** 6 : Math.max(0, Math.sin(t * 3)) ** 8 * 0.5, sw = 1 + beat * 0.1;
  // lava arteries
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); ctx.quadraticCurveTo(Math.cos(a + 0.3) * r * 1.2, Math.sin(a + 0.3) * r * 1.2, Math.cos(a + 0.1) * r * 1.7, Math.sin(a + 0.1) * r * 1.7); ctx.strokeStyle = INK; ctx.lineWidth = 13; ctx.stroke(); ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 2.5; ctx.stroke(); }
  bloom(ctx, 0, 0, r * 2.2, '#ff5a1a', 0.45 + beat * 0.4);
  // obsidian ribs
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(r * 0.75, -r * 0.18); ctx.quadraticCurveTo(r * 1.15, 0, r * 0.75, r * 0.18); ctx.lineTo(r * 0.95, 0); ctx.closePath(); ctx.fillStyle = '#2e2436'; ctx.fill(); ink(ctx, 2.6); ctx.restore(); }
  // the heart
  ctx.save(); ctx.scale(sw, sw);
  ctx.beginPath(); ctx.moveTo(0, r * 0.75); ctx.bezierCurveTo(-r * 1.05, r * 0.1, -r * 0.7, -r * 0.85, 0, -r * 0.38); ctx.bezierCurveTo(r * 0.7, -r * 0.85, r * 1.05, r * 0.1, 0, r * 0.75); ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, 4, 0, 0, r); g.addColorStop(0, '#fff2a0'); g.addColorStop(0.35, '#ff8a2a'); g.addColorStop(0.8, col); g.addColorStop(1, '#6a1a10'); ctx.fillStyle = g; ctx.fill(); ink(ctx, 4);
  ctx.strokeStyle = 'rgba(60,20,15,.7)'; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo((i - 1.5) * r * 0.25, -r * 0.3); ctx.quadraticCurveTo((i - 1.5) * r * 0.35, r * 0.1, (i - 1.5) * r * 0.15, r * 0.5); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.35, r * 0.18, Math.PI, Math.PI * 1.8); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4; ctx.stroke();
  // the crown of vents
  for (const sd of [-1, 0, 1]) { ctx.beginPath(); ctx.ellipse(sd * r * 0.3, -r * 0.55 - (sd ? 0 : r * 0.1), r * 0.12, r * 0.18, 0, 0, TAU); ctx.fillStyle = '#3a2420'; ctx.fill(); ink(ctx, 2.4); circle(ctx, sd * r * 0.3, -r * 0.58 - (sd ? 0 : r * 0.1), r * 0.06, '#ffd36a', 0); }
  ctx.restore();
  if (e.phase >= 3) { ctx.save(); ctx.globalAlpha *= 0.5 + 0.3 * Math.sin(t * 10); circle(ctx, 0, 0, r * 1.25, null, 5, '#ff3b1b'); ctx.restore(); }
}

// ------------------------------------------------------------------ events (fx.js routes {type:'ember'} here)
export const EMBER_UNLOCK_TXT = {
  ember: ['EMBERDEEP GATE FOUND', '#ff8a3a', 'Attune it on the Realm Gate map with 2 Rimebound Sigils (Skaldra Trial)'],
  forge: ['FORGE OF CINDERS CLEARED', '#ffd08a', 'Replay the Forge from the Mission Counter any time'],
};
export function emberEventFx(fx, ev, me) {
  const x = ev.x, y = ev.y, has = x != null;
  const lp = fx.sim && fx.sim.players && fx.sim.players.get ? fx.sim.players.get(fx.localPid) : null;
  const near = (R) => !lp || !has || Math.hypot(lp.x - x, lp.y - y) < R;
  const mine = lp && ev.pid === lp.id;
  switch (ev.ph) {
    case 'call': if (near(1800)) fx.banner(ev.txt, ev.col || '#ffb36a', ev.sub || '', 2.4, 40); break;
    case 'roar': if (!near(1800)) break; if (has) { fx.ring(x, y, 240, '#ffb36a', 0.6, 10); fx.puffs(x, y, 18, '#5a4a48', 20, 300, 0.9); fx.sparks(x, y, 0, 24, '#ffd36a', 420, TAU); } fx.shake(0.5); break;
    case 'portal': if (!near(2600)) break; if (has) { fx.ring(x, y, ev.big ? 140 : 100, '#ff8a2a', 0.8, 8); fx.ring(x, y, 60, '#fff2a0', 0.6, 5); fx.sparks(x, y, -Math.PI / 2, 24, '#ffd36a', 420, 1.6); } fx.banner('THE FORGE OF CINDERS OPENS!', '#ffb36a', 'Step into the portal before it cools', 2.6, 40); break;
    case 'burn': if (mine) { fx.text(lp.x, lp.y - 50, 'LAVA!', { size: 18, color: '#ff6a1a', vy: -40, life: 0.7 }); fx.puffs(x, y, 5, '#ff8a2a', 10, 120, 0.5); } break;
    case 'mothPop': if (has) { fx.sparks(x, y, 0, 12, '#ffb347', 240, TAU); fx.ring(x, y, 40, '#ff8a2a', 0.3, 4); } break;
    case 'kindle': if (has) { fx.ring(x, y, 130, '#ffd36a', 0.45, 10); fx.sparks(x, y, 0, 22, '#ff8a2a', 380, TAU); fx.puffs(x, y, 10, '#4a3a38', 16, 220, 0.6); } if (near(900)) fx.shake(0.3); break;
    case 'fuse': if (has) fx.ring(x, y, 50, '#ff3b2b', 0.3, 4); break;
    case 'harden': if (has) { fx.puffs(x, y, 10, '#e8e0d8', 16, 160, 0.7); fx.ring(x, y, 50, '#6a5a58', 0.4, 6); } break;
    case 'crack': if (has) { fx.ring(x, y, 170, '#ff6a1a', 0.5, 10); fx.sparks(x, y, 0, 18, '#5a4a48', 340, TAU); } if (near(900)) fx.shake(0.35); break;
    case 'dive': if (has) fx.puffs(x, y, 8, '#6a5a58', 14, 140, 0.5); break;
    case 'eel': if (has) { fx.ring(x, y, 90, '#ff6a1a', 0.45, 8); fx.sparks(x, y, -Math.PI / 2, 16, '#ffb43c', 380, 1.4); } break;
    case 'barrage': if (has) fx.puffs(x, y, 6, '#8a7f78', 12, 120, 0.5); break;
    case 'bounce': if (has) fx.sparks(x, y, 0, 8, '#ff8a2a', 200, TAU); break;
    case 'panes': if (has) fx.ring(x, y, 320, '#bff6f0', 0.6, 6); break;
    case 'reflect': if (has) { fx.sparks(x, y, 0, 8, '#ffffff', 220, TAU); } break;
    case 'anneal': if (has) fx.ring(x, y, 120, '#ff4b1f', 0.5, 6); break;
    case 'burst': if (has) { fx.ring(x, y, 140, '#7ff0e0', 0.45, 9); fx.sparks(x, y, 0, 20, '#d8fffa', 360, TAU); } if (near(1000)) fx.shake(0.3); break;
    case 'storm': if (near(1600)) fx.banner('SHATTERSTORM', '#7ff0e0', 'Every pane bursts · keep clear of the glass', 2, 36); break;
    case 'encase': if (has) { fx.ring(x, y, 50, '#bff6ff', 0.4, 6); fx.sparks(x, y, 0, 10, '#ffffff', 200, TAU); } if (mine) fx.banner('ENCASED!', '#bff6ff', 'Break the glass from inside · allies can help', 1.6, 34); break;
    case 'freed': if (has) { fx.sparks(x, y, 0, 16, '#d8fffa', 300, TAU); fx.ring(x, y, 60, '#ffffff', 0.35, 5); } break;
    case 'shatter': if (has) { fx.sparks(x, y, 0, 22, '#d8fffa', 380, TAU); fx.ring(x, y, 90, '#ff6a8a', 0.4, 8); } break;
    case 'pop': if (has) fx.sparks(x, y, 0, 10, '#bff6ff', 200, TAU); break;
    case 'flareCast': if (has && near(1400)) fx.ring(x, y, 500, '#ffcf4a', 0.9, 10); break;
    case 'flare': if (!near(1400)) break; fx.flash = 0.6; fx.flashColor = '#fff1a0'; if (has) fx.ring(x, y, 560, '#ffcf4a', 0.7, 16); fx.shake(0.45); break;
    case 'noonCast': if (has && near(1400)) fx.ring(x, y, 150, '#7dffb0', 0.8, 8); break;
    case 'noon': if (!near(1400)) break; fx.flash = 0.7; fx.flashColor = '#ffffff'; fx.shake(0.5); break;
    case 'hour': if (has && near(1400)) fx.ring(x, y, 420, '#ffb02e', 0.6, 8); break;
    case 'beat': if (!near(1500)) break; if (has) fx.ring(x, y, ev.dbl ? 160 : 110, '#ff4b2b', 0.4, ev.dbl ? 10 : 6); fx.shake(ev.dbl ? 0.3 : 0.15); break;
    case 'tide': if (has && near(1600)) { fx.ring(x, y, 520, '#ff8a2a', 0.9, 12); fx.puffs(x, y, 16, '#5a4a48', 22, 260, 0.9); } break;
    case 'eruptCast': if (near(1600)) fx.shake(0.25); break;
    case 'erupt': if (!near(1600)) break; if (has) { fx.ring(x, y, 520, '#ff6a1a', 0.8, 18); fx.sparks(x, y, -Math.PI / 2, 40, '#ffd36a', 600, 2.4); fx.puffs(x, y, 24, '#3a2a28', 26, 380, 1.1); } fx.flash = 0.5; fx.flashColor = '#ff6a1a'; fx.shake(0.75); break;
    case 'floor': if (near(1600)) { fx.shake(0.6); if (has) fx.ring(x, y, 460, '#ff4b1f', 1, 14); } break;
    case 'geyser': if (has) { fx.puffs(x, y, 14, '#f4eee8', 22, 300, 0.9); fx.ring(x, y, VENT.near ? 110 : 100, '#ffffff', 0.4, 6); } break;
  }
}
