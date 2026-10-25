// Brightwater Village (the hub town): ground, buildings, the Mission Counter + its clerk, lanterns, bunting, trees and
// the town minimap. Pure drawing from sim/townconst.js geometry (the town has no gameplay state of its own).
import { drawGatePost } from './dunesfx.js';
import { drawVillageProp, drawVillageOver, drawVillagePins, npcMark } from './villagefx.js';
import { GATES } from '../sim/dunesconst.js';
import { INK, circle, shadow, rrect, shade, drawHero, drawTree, drawTreeShadow, drawBush } from './art.js';
import { sprite, blit, newCanvas } from './sprite.js';
import { TOWN_POS as T, TOWN_R, TOWN_PROPS, COUNTER, CLERK, TOWN_NAME, inTownArea, nearCounter, TOWN_ROADS, TOWN_PAVES, FENCE, TOWN_BUNTING, DISTRICTS } from '../sim/townconst.js';
import { weeklyBoard, barrel, bench, rack, fpost, statue, windmill, oakTrunk, oakCanopy, pond, forgeSign } from './townprops.js';
import { STATION, nearStation } from '../sim/village.js';

const TAU = Math.PI * 2;
const R0 = (a, b) => ((Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1 + 1) % 1;
// perf pass 3: per-item view culling (off-screen flowers / bushes / trees / bunting were drawn every frame)
const inV = (v, x, y, m) => x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m;
export const townVisible = (view) => view.x1 > T.x - TOWN_R - 160 && view.x0 < T.x + TOWN_R + 160 && view.y1 > T.y - TOWN_R - 160 && view.y0 < T.y + TOWN_R + 160;
const CLERK_APP = { skin: 1, hairStyle: 4, hairColor: 2, outfit: 6 };
/** distance from (x, y) to the polyline pts (world) */
const segD = (x, y, ax, ay, bx, by) => { const ex = bx - ax, ey = by - ay, L = ex * ex + ey * ey, k = L ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / L)) : 0; return Math.hypot(x - ax - ex * k, y - ay - ey * k); };
const ROADS_W = TOWN_ROADS.map((r) => ({ ...r, P: r.pts.map(([dx, dy]) => [T.x + dx, T.y + dy]) }));
const onRoad = (x, y, pad = 0) => ROADS_W.some((r) => r.P.some((p, i) => i > 0 && segD(x, y, r.P[i - 1][0], r.P[i - 1][1], p[0], p[1]) < r.w / 2 + pad));
const nearProp = (x, y, pad) => TOWN_PROPS.some((o) => o.kind !== 'tree' && (o.sh === 'circle' ? Math.hypot(x - o.x, y - o.y) < o.r + pad : Math.abs(x - o.x) < o.w / 2 + pad && Math.abs(y - o.y) < o.h / 2 + pad));
const onPave = (x, y, pad = 0) => Math.hypot(x - T.x, y - T.y) < 280 + pad || TOWN_PAVES.some((v) => ((x - T.x - v.dx) / (v.rx + pad)) ** 2 + ((y - T.y - v.dy) / (v.ry + pad)) ** 2 < 1)
  || ((x - T.x) / 420) ** 2 + ((y - T.y - 640) / 160) ** 2 < 1 || ((x - T.x + 600) / 205) ** 2 + ((y - T.y - 330) / 150) ** 2 < 1;
// flower beds: clusters on the lawns (never on a road, paving or under a prop)
const FLOWERS = [];
for (let i = 0; FLOWERS.length < 230 && i < 2400; i++) {
  const a = R0(i, 1) * TAU, r = 120 + Math.sqrt(R0(i, 2)) * (TOWN_R - 160), x = T.x + Math.cos(a) * r, y = T.y + Math.sin(a) * r;
  if (onRoad(x, y, 12) || onPave(x, y, 14) || nearProp(x, y, 26)) continue;
  for (let k = 0; k < 3 && FLOWERS.length < 230; k++) FLOWERS.push({ x: x + (R0(i, k + 4) - 0.5) * 30, y: y + (R0(k, i + 9) - 0.5) * 20, c: ['#fff', '#ffe45c', '#ff8fb1', '#9fd4ff', '#ffb35c'][(i + k) % 5] });
}
const BUSHES = Array.from({ length: 30 }, (_, i) => { const a = (i / 30) * TAU + 0.3, r = 950 + R0(i, 5) * 30; return { x: Math.round(T.x + Math.cos(a) * r), y: Math.round(T.y + Math.sin(a) * r), size: 22 + (i % 3) * 5, zone: 0, variant: i * 17 }; }).filter((b) => !onRoad(b.x, b.y, 20) && !onPave(b.x, b.y, 20));
/** lawn patches (darker / lighter greens) for depth */
const PATCHES = Array.from({ length: 22 }, (_, i) => { const a = R0(i, 21) * TAU, r = 200 + R0(i, 22) * (TOWN_R - 280); return { x: T.x + Math.cos(a) * r, y: T.y + Math.sin(a) * r, rx: 70 + R0(i, 23) * 110, ry: 40 + R0(i, 24) * 60, rot: R0(i, 25) * 3, c: i % 3 ? 'rgba(40,120,50,.16)' : 'rgba(200,255,150,.14)' }; });
const POND = TOWN_PROPS.find((o) => o.kind === 'pond');
let COBBLE = null;
function cobblePattern(ctx) {
  if (COBBLE) return COBBLE;
  const S = 64, c = newCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#b8ad94'; g.fillRect(0, 0, S, S);
  for (let row = 0; row < 4; row++) for (let i = -1; i < 4; i++) {
    const j = R0(row, i + 7), x = i * 18 + (row % 2) * 9 + 2, y = row * 16 + 2;
    rrect(g, x, y, 15, 12, 4); g.fillStyle = j < 0.2 ? '#c4b99e' : j > 0.8 ? '#e2d8bf' : '#d4caaf'; g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)'; rrect(g, x + 2, y + 1.5, 10, 4, 2); g.fill();
    rrect(g, x, y, 15, 12, 4); g.lineWidth = 1; g.strokeStyle = 'rgba(43,36,51,.32)'; g.stroke();
  }
  COBBLE = ctx.createPattern(c, 'repeat');
  return COBBLE;
}
function road(ctx, r, t) {
  ctx.beginPath(); r.P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (r.k === 'cobble') {
    ctx.strokeStyle = '#8f8574'; ctx.lineWidth = r.w + 10; ctx.stroke();
    ctx.strokeStyle = cobblePattern(ctx); ctx.lineWidth = r.w; ctx.stroke();
  } else {
    ctx.strokeStyle = '#c9a36b'; ctx.lineWidth = r.w; ctx.stroke(); ctx.strokeStyle = '#dcbb82'; ctx.lineWidth = r.w - 16; ctx.stroke();
    ctx.setLineDash([22, 30]); ctx.strokeStyle = 'rgba(150,110,60,.28)'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]); // worn ruts
  }
  void t;
}

let PLAZA = null;
function bakePlaza() {
  const k = 1.5, S = 548, c = newCanvas(Math.ceil(S * k), Math.ceil(S * k)), g = c.getContext('2d');
  g.scale(k, k); g.translate(274, 274); g.lineJoin = 'round';
  g.beginPath(); g.arc(0, 0, 268, 0, TAU); g.fillStyle = '#a99f88'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  g.save(); g.beginPath(); g.arc(0, 0, 265, 0, TAU); g.clip();
  for (let ring = 0; ring < 7; ring++) {
    const rr = 64 + ring * 30, n = Math.round(TAU * rr / 26);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + ring * 0.21 + (R0(ring, i) - 0.5) * 0.04, j = R0(i, ring);
      const sw = TAU * rr / n - 3, sh = 25 + (j - 0.5) * 3;
      g.save(); g.translate(Math.cos(a) * rr, Math.sin(a) * rr); g.rotate(a + Math.PI / 2 + (j - 0.5) * 0.12);
      rrect(g, -sw / 2, -sh / 2, sw, sh, 5);
      const base = j < 0.15 ? [196, 186, 160] : j > 0.85 ? [226, 216, 192] : [212, 202, 178];
      g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fill();
      const la = Math.cos(a + 2.3); // which edge faces the light (in world space) - approximate with a shaded half
      g.fillStyle = 'rgba(255,255,255,.22)'; rrect(g, -sw / 2 + 2, -sh / 2 + 2, sw - 6, sh * 0.35, 4); g.fill();
      g.fillStyle = 'rgba(60,40,30,.16)'; rrect(g, -sw / 2 + 3, sh * 0.15, sw - 5, sh * 0.32, 4); g.fill();
      if (j > 0.93) { g.strokeStyle = 'rgba(60,50,40,.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-sw / 3, -4); g.lineTo(0, 2); g.lineTo(sw / 4, -1); g.stroke(); }
      if (j < 0.06) { g.fillStyle = 'rgba(90,150,60,.5)'; g.beginPath(); g.arc(sw / 2, sh / 2, 3, 0, TAU); g.fill(); }
      rrect(g, -sw / 2, -sh / 2, sw, sh, 5); g.lineWidth = 1.5; g.strokeStyle = 'rgba(43,36,51,.35)'; g.stroke();
      g.restore();
    }
  }
  // worn footpath sheen + edge kerb
  const sh = g.createRadialGradient(-80, -90, 20, 0, 0, 268); sh.addColorStop(0, 'rgba(255,250,230,.18)'); sh.addColorStop(0.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(40,30,20,.22)');
  g.fillStyle = sh; g.fillRect(-270, -270, 540, 540);
  g.restore();
  g.beginPath(); g.arc(0, 0, 262, 0, TAU); g.lineWidth = 7; g.strokeStyle = '#8f8574'; g.stroke();
  g.beginPath(); g.arc(0, 0, 262, Math.PI * 0.9, Math.PI * 1.6); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.4)'; g.stroke();
  g.beginPath(); g.arc(0, 0, 268, 0, TAU); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  return c;
}

/** Island, shore, lawns, roads, plazas, the pond, the training ring and the harbour (over the sea, under everything else). */
export function drawTownGround(ctx, view, t) {
  if (!townVisible(view)) return false;
  // shimmering shallows + sand + grass
  circle(ctx, T.x, T.y, TOWN_R + 80, 'rgba(160,230,255,.35)', 0);
  circle(ctx, T.x, T.y, TOWN_R + 38, '#f2dc9b', 0);
  circle(ctx, T.x, T.y, TOWN_R + 38, null, 5, 'rgba(255,255,255,.6)');
  circle(ctx, T.x, T.y, TOWN_R + 6, '#78c860', 0);
  ctx.save(); ctx.beginPath(); ctx.arc(T.x, T.y, TOWN_R + 6, 0, TAU); ctx.clip();
  // Windmill Hill: a lighter rise in the north-west
  const hg = ctx.createRadialGradient(T.x - 760, T.y - 560, 20, T.x - 760, T.y - 560, 330); hg.addColorStop(0, 'rgba(220,255,170,.45)'); hg.addColorStop(1, 'rgba(220,255,170,0)'); ctx.fillStyle = hg; ctx.fillRect(T.x - 1100, T.y - 900, 700, 700);
  for (const p of PATCHES) { ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx, p.ry, p.rot, 0, TAU); ctx.fillStyle = p.c; ctx.fill(); }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const r of ROADS_W) if (r.k !== 'cobble') road(ctx, r, t);
  for (const r of ROADS_W) if (r.k === 'cobble') road(ctx, r, t);
  // the guild square + the market square: cobbled ellipses with a kerb
  for (const v of TOWN_PAVES) { ctx.beginPath(); ctx.ellipse(T.x + v.dx, T.y + v.dy, v.rx, v.ry, 0, 0, TAU); ctx.fillStyle = cobblePattern(ctx); ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = '#8f8574'; ctx.stroke(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke(); }
  // the training ring: raked sand inside the fence + the fence ropes
  ctx.save(); ctx.beginPath(); ctx.ellipse(T.x - 600, T.y + 330, 196, 142, 0, 0, TAU); ctx.fillStyle = '#e2c995'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(120,80,40,.5)'; ctx.stroke(); ctx.clip();
  ctx.strokeStyle = 'rgba(160,120,70,.3)'; ctx.lineWidth = 2; for (let k = -6; k <= 6; k++) { ctx.beginPath(); ctx.ellipse(T.x - 600, T.y + 330, 30 + Math.abs(k) * 22, (30 + Math.abs(k) * 22) * 0.72, 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = '#c9a36b'; ctx.lineWidth = 3;
  for (let i = 1; i <= FENCE.length; i++) { const [ax, ay] = FENCE[i - 1], [bx, by] = FENCE[i % FENCE.length]; if (Math.hypot(ax - bx, ay - by) > 60) continue; ctx.beginPath(); ctx.moveTo(T.x + ax, T.y + ay - 20); ctx.quadraticCurveTo(T.x + (ax + bx) / 2, T.y + (ay + by) / 2 - 14, T.x + bx, T.y + by - 20); ctx.stroke(); }
  ctx.restore();
  // the fountain plaza (pass 2: irregular bevelled setts with mortar + wear, baked once)
  if (!PLAZA) PLAZA = bakePlaza();
  ctx.drawImage(PLAZA, T.x - 274, T.y - 274, 548, 548);
  if (POND) pond(ctx, POND, t);
  // the counter's welcome mat (gold ring pulses when you can interact)
  ctx.save(); ctx.translate(COUNTER.x, COUNTER.y + 6);
  rrect(ctx, -90, -26, 180, 52, 14); ctx.fillStyle = '#c0483a'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  rrect(ctx, -78, -16, 156, 32, 10); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
  // flower beds
  for (const f of FLOWERS) if (inV(view, f.x, f.y, 12)) { circle(ctx, f.x, f.y, 4.5, f.c, 2); circle(ctx, f.x, f.y, 1.6, '#ffd23f', 0); }
  // the harbour pier on the east shore + two moored boats
  ctx.save(); ctx.translate(T.x + TOWN_R - 30, T.y + 120);
  for (let i = 0; i < 8; i++) { rrect(ctx, i * 22 - 8, -40, 18, 80, 3); ctx.fillStyle = i % 2 ? '#a8733f' : '#b98248'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
  for (const sx of [8, 96, 160]) for (const sy of [-44, 44]) circle(ctx, sx, sy, 7, '#7a5230', 3);
  for (const [bx, by, c] of [[90, -92, '#3a8ee8'], [150, 90, '#ff5e5b']]) {
    const bob = Math.sin(t * 1.6 + bx) * 3;
    ctx.save(); ctx.translate(bx, by + bob); ctx.rotate(Math.sin(t * 1.1 + by) * 0.04);
    ctx.beginPath(); ctx.moveTo(-46, -10); ctx.quadraticCurveTo(0, -22, 46, -10); ctx.quadraticCurveTo(40, 16, 0, 18); ctx.quadraticCurveTo(-40, 16, -46, -10); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-36, -8); ctx.quadraticCurveTo(0, -16, 36, -8); ctx.quadraticCurveTo(30, 6, 0, 8); ctx.quadraticCurveTo(-30, 6, -36, -8); ctx.closePath(); ctx.fillStyle = '#b98248'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  // gentle waves around the island
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 4;
  for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU + t * 0.03, r = TOWN_R + 100 + Math.sin(t * 1.4 + i) * 10; ctx.beginPath(); ctx.arc(T.x + Math.cos(a) * r, T.y + Math.sin(a) * r, 16, a + 1.2, a + 2.0); ctx.stroke(); }
  for (const o of TOWN_PROPS) if (o.kind === 'tree' && inV(view, o.x, o.y, o.size * 2 + 40)) drawTreeShadow(ctx, { x: o.x, y: o.y, size: o.size });
  for (const b of BUSHES) if (inV(view, b.x, b.y, b.size * 2 + 30)) drawBush(ctx, b);
  return true;
}

// pass 2: houses are timber-framed (plaster panels, beams, stone plinth, shingled roof with ridge cap, framed windows
// with shutters and flower boxes), painted once per house into a sprite; only the window glow and smoke are live.
function houseStatic(g, o) {
  const w = o.w, h = o.h, x = -w / 2, y = -h / 2, H = 64, rc = o.roof || '#d9483b', top = y - H * 0.35;
  // walls: plaster with a light wash from the upper left
  const wg = g.createLinearGradient(x, top, x + w, y + h); wg.addColorStop(0, '#fbf0d8'); wg.addColorStop(1, '#e2cfa8');
  rrect(g, x, top, w, h + H * 0.35, 5); g.fillStyle = wg; g.fill();
  // plaster blotches
  for (let i = 0; i < 10; i++) { const px = x + 8 + R0(o.x + i, o.y) * (w - 16), py = top + 6 + R0(o.y + i, o.x) * (h + H * 0.35 - 20); g.fillStyle = 'rgba(150,110,60,.08)'; g.beginPath(); g.ellipse(px, py, 6 + R0(i, o.x) * 8, 3 + R0(o.x, i) * 4, 0, 0, TAU); g.fill(); }
  // stone plinth
  const py0 = y + h - 14;
  g.fillStyle = '#a49a8e'; g.fillRect(x + 2, py0, w - 4, 12);
  g.strokeStyle = 'rgba(43,36,51,.45)'; g.lineWidth = 1.5;
  for (let sx = x + 4, k = 0; sx < x + w - 4; k++) { const sw = 12 + R0(k, o.x) * 10; g.strokeRect(sx, py0 + (k % 2) * 1, Math.min(sw, x + w - 4 - sx), 11); sx += sw; }
  // timber frame: posts, rail, braces
  g.strokeStyle = '#6e4428'; g.lineWidth = 6;
  const posts = [x + 5, x + w * 0.33, x + w * 0.67, x + w - 5];
  g.beginPath(); for (const px of posts) { g.moveTo(px, top + 3); g.lineTo(px, py0); }
  g.moveTo(x + 3, top + 4); g.lineTo(x + w - 3, top + 4); g.moveTo(x + 3, top + (py0 - top) * 0.45); g.lineTo(x + w - 3, top + (py0 - top) * 0.45);
  g.moveTo(x + 5, top + 4); g.lineTo(x + w * 0.33, top + (py0 - top) * 0.45); g.moveTo(x + w - 5, top + 4); g.lineTo(x + w * 0.67, top + (py0 - top) * 0.45);
  g.stroke();
  g.strokeStyle = 'rgba(255,220,170,.25)'; g.lineWidth = 1.5; g.beginPath(); for (const px of posts) { g.moveTo(px - 2, top + 5); g.lineTo(px - 2, py0); } g.stroke();
  rrect(g, x, top, w, h + H * 0.35, 5); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
  // door: planks, iron straps, stone step
  g.fillStyle = '#8f877c'; rrect(g, -20, y + h - 6, 40, 8, 3); g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
  rrect(g, -14, y + h - 42, 28, 38, 9); g.fillStyle = '#7d4f2e'; g.fill();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.5; g.beginPath(); for (const dx of [-5, 2, 8]) { g.moveTo(dx, y + h - 40); g.lineTo(dx, y + h - 5); } g.stroke();
  g.strokeStyle = '#3c3640'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-13, y + h - 30); g.lineTo(13, y + h - 30); g.moveTo(-13, y + h - 14); g.lineTo(13, y + h - 14); g.stroke();
  rrect(g, -14, y + h - 42, 28, 38, 9); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  circle(g, 7, y + h - 22, 2.5, '#ffd23f', 0);
  // window frames, shutters, flower boxes (the glass glow is live)
  for (const wx of [x + 20, x + w - 46]) {
    const wy = y + h - 46;
    for (const [sx, d] of [[wx - 9, -1], [wx + 26, 1]]) { rrect(g, sx, wy - 1, 9, 24, 2); g.fillStyle = shade(rc, -0.1); g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.beginPath(); for (let k = 1; k < 4; k++) { g.moveTo(sx + 1, wy + k * 6); g.lineTo(sx + 8, wy + k * 6); } g.stroke(); }
    rrect(g, wx - 2, wy - 2, 30, 26, 4); g.fillStyle = '#5a3a22'; g.fill();
    g.fillStyle = '#2e2a3a'; g.fillRect(wx + 1, wy + 1, 24, 20);
    rrect(g, wx - 4, wy + 22, 34, 7, 2); g.fillStyle = '#8a5a35'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
    for (let k = 0; k < 5; k++) circle(g, wx - 1 + k * 7, wy + 21, 3, ['#ff8fb1', '#fff', '#ffe45c', '#ff5e5b', '#9fd4ff'][(k + (o.x | 0)) % 5], 1);
  }
  // eaves shadow on the wall
  g.fillStyle = 'rgba(40,20,10,.22)'; g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x + w, y + 4); g.lineTo(x + w, y + 14); g.lineTo(x, y + 14); g.fill();
  // roof: staggered shingles, darker towards the eaves, ridge cap + rim light
  const ry = y - H;
  const roofPath = () => { g.beginPath(); g.moveTo(x - 14, y + 4); g.lineTo(0, ry - 20); g.lineTo(x + w + 14, y + 4); g.closePath(); };
  roofPath(); const rg = g.createLinearGradient(0, ry - 20, 0, y + 4); rg.addColorStop(0, shade(rc, 0.12)); rg.addColorStop(1, shade(rc, -0.18)); g.fillStyle = rg; g.fill();
  g.save(); roofPath(); g.clip();
  for (let row = 0, yy = ry - 16; yy < y + 6; row++, yy += 11) {
    g.strokeStyle = shade(rc, -0.32); g.lineWidth = 2; g.beginPath(); g.moveTo(x - 20, yy); g.lineTo(x + w + 20, yy); g.stroke();
    for (let xx = x - 20 + (row % 2) * 8; xx < x + w + 20; xx += 16) {
      g.beginPath(); g.moveTo(xx, yy - 11); g.lineTo(xx, yy); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(xx + 1, yy - 10, 6, 3);
      if (R0(xx, yy + o.x) > 0.9) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(xx + 1, yy - 10, 14, 9); }
    }
  }
  // right roof face in shade
  g.fillStyle = 'rgba(30,10,20,.18)'; g.beginPath(); g.moveTo(0, ry - 20); g.lineTo(x + w + 14, y + 4); g.lineTo(0, y + 4); g.fill();
  g.restore();
  roofPath(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.moveTo(x - 14, y + 4); g.lineTo(0, ry - 20); g.strokeStyle = 'rgba(255,240,220,.45)'; g.lineWidth = 3; g.stroke();
  g.beginPath(); g.moveTo(x - 10, y + 2); g.lineTo(x + w + 10, y + 2); g.strokeStyle = shade(rc, -0.4); g.lineWidth = 4; g.stroke();
  // chimney: stacked stones with a cap
  const cx0 = x + w * 0.68;
  rrect(g, cx0, ry - 4, 16, 26, 2); g.fillStyle = '#9a8f86'; g.fill();
  g.strokeStyle = 'rgba(43,36,51,.4)'; g.lineWidth = 1; g.beginPath(); for (let k = 1; k < 4; k++) { g.moveTo(cx0, ry - 4 + k * 6.5); g.lineTo(cx0 + 16, ry - 4 + k * 6.5); } g.stroke();
  rrect(g, cx0, ry - 4, 16, 26, 2); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  rrect(g, cx0 - 3, ry - 8, 22, 6, 2); g.fillStyle = '#7d736b'; g.fill(); g.lineWidth = 2.5; g.stroke();
}
function house(ctx, o, t) {
  const y = o.y - o.h / 2, H = 64, ry = y - H, x = o.x - o.w / 2;
  shadow(ctx, o.x + 10, o.y + o.h / 2 + 6, o.w * 0.6, 18, 0.25);
  const c = sprite(`house2:${o.x | 0}:${o.y | 0}:${o.w}:${o.h}:${o.roof}`, o.w + 60, o.h + H + 70, o.w / 2 + 30, o.h / 2 + H + 50, (g) => houseStatic(g, o));
  blit(ctx, c, o.x, o.y);
  for (const wx of [x + 20, x + o.w - 46]) { ctx.fillStyle = `rgba(255,${210 + Math.sin(t * 2 + wx) * 20 | 0},120,.95)`; ctx.fillRect(wx + 1, y + o.h - 45, 24, 20); ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx + 13, y + o.h - 45); ctx.lineTo(wx + 13, y + o.h - 25); ctx.moveTo(wx + 1, y + o.h - 35); ctx.lineTo(wx + 25, y + o.h - 35); ctx.stroke(); }
  if (o.sign === 'forge') forgeSign(ctx, o, t);
  for (let k = 0; k < 3; k++) { const f = (t * 0.4 + k / 3) % 1; circle(ctx, x + o.w * 0.68 + 8 + Math.sin(f * 6) * 6, ry - 14 - f * 40, 5 + f * 6, `rgba(240,240,240,${0.5 * (1 - f)})`, 0); }
}
function counterHall(ctx, o, t) {
  const x = o.x - o.w / 2, y = o.y - o.h / 2, H = 80;
  shadow(ctx, o.x + 12, o.y + o.h / 2 + 8, o.w * 0.58, 22, 0.25);
  rrect(ctx, x, y - H * 0.35, o.w, o.h + H * 0.35, 8); ctx.fillStyle = '#f7ead0'; ctx.fill(); ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke();
  // timber frame
  ctx.strokeStyle = '#8a5a35'; ctx.lineWidth = 7;
  for (const fx of [x + 16, x + o.w - 16, o.x - 60, o.x + 60]) { ctx.beginPath(); ctx.moveTo(fx, y - H * 0.35 + 6); ctx.lineTo(fx, y + o.h - 4); ctx.stroke(); }
  // big open counter window with the quest board inside
  rrect(ctx, o.x - 52, y + 6, 104, o.h - 20, 8); ctx.fillStyle = '#5b3a24'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  for (let i = 0; i < 5; i++) { const px = o.x - 40 + (i % 3) * 30 + (i > 2 ? 14 : 0), py = y + 14 + (i > 2 ? 28 : 0); ctx.save(); ctx.translate(px, py); ctx.rotate((i - 2) * 0.06); ctx.fillStyle = ['#fff4d6', '#ffe0a8', '#ffd0d0', '#e0f0ff', '#fff4d6'][i]; ctx.fillRect(0, 0, 20, 22); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(0, 0, 20, 22); circle(ctx, 10, 2, 2, '#e84c3d', 0); ctx.restore(); }
  // side windows with lantern light
  for (const wx of [x + 34, x + o.w - 64]) { rrect(ctx, wx, y + 12, 30, 26, 5); ctx.fillStyle = `rgba(255,${214 + Math.sin(t * 3 + wx) * 16 | 0},120,.95)`; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
  // roof: a wide red gable with a gold crest
  const ry = y - H, rc = o.roof || '#d9483b';
  ctx.beginPath(); ctx.moveTo(x - 20, y + 2); ctx.lineTo(x + 30, ry - 16); ctx.lineTo(x + o.w - 30, ry - 16); ctx.lineTo(x + o.w + 20, y + 2); ctx.closePath();
  ctx.fillStyle = rc; ctx.fill(); ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.save(); ctx.clip(); ctx.strokeStyle = shade(rc, -0.22); ctx.lineWidth = 3;
  for (let xx = x - 20; xx < x + o.w + 20; xx += 22) { ctx.beginPath(); ctx.moveTo(xx, ry - 20); ctx.lineTo(xx, y + 4); ctx.stroke(); }
  ctx.restore();
  // signboard
  ctx.save(); ctx.translate(o.x, ry - 26);
  rrect(ctx, -92, -20, 184, 36, 10); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.font = "19px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.fillText('MISSION COUNTER', 0, -1);
  ctx.restore();
  // banners
  for (const bx of [x + 6, x + o.w - 6]) { const sw = Math.sin(t * 2 + bx) * 3; ctx.beginPath(); ctx.moveTo(bx - 10, y - 20); ctx.lineTo(bx + 10, y - 20); ctx.lineTo(bx + 10 + sw, y + 36); ctx.lineTo(bx + sw, y + 26); ctx.lineTo(bx - 10 + sw, y + 36); ctx.closePath(); ctx.fillStyle = '#3a8ee8'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); circle(ctx, bx + sw * 0.5, y + 4, 5, '#ffd23f', 2); }
}
function desk(ctx, o) {
  shadow(ctx, o.x + 6, o.y + 16, o.w * 0.55, 10, 0.25);
  rrect(ctx, o.x - o.w / 2, o.y - o.h / 2 - 10, o.w, o.h + 12, 6); ctx.fillStyle = '#b07a45'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  rrect(ctx, o.x - o.w / 2, o.y - o.h / 2 - 14, o.w, 12, 5); ctx.fillStyle = '#d49a5a'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  // ledger, quill and a bell
  ctx.save(); ctx.translate(o.x - 50, o.y - 14); ctx.rotate(-0.1); ctx.fillStyle = '#fff4d6'; ctx.fillRect(-16, -8, 32, 14); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-16, -8, 32, 14); ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 6); ctx.stroke(); ctx.restore();
  circle(ctx, o.x + 52, o.y - 12, 7, '#ffd23f', 2.5); circle(ctx, o.x + 52, o.y - 19, 2, INK, 0);
}
function stall(ctx, o, t) {
  const x = o.x - o.w / 2, y = o.y - o.h / 2;
  shadow(ctx, o.x + 6, o.y + o.h / 2 + 4, o.w * 0.55, 12, 0.22);
  rrect(ctx, x, y, o.w, o.h, 6); ctx.fillStyle = '#b98248'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  // produce
  const goods = o.roof === '#ffd23f' ? ['#ff5e5b', '#ffb52e', '#6fe05a'] : ['#9fd4ff', '#ff8fb1', '#ffe45c'];
  for (let i = 0; i < 7; i++) circle(ctx, x + 14 + i * 15, y + 16 + (i % 2) * 8, 7, goods[i % 3], 2.5);
  // striped awning on poles
  for (const px of [x + 4, x + o.w - 4]) { ctx.beginPath(); ctx.moveTo(px, y + o.h); ctx.lineTo(px, y - 46); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = '#8a5a35'; ctx.lineWidth = 3.5; ctx.stroke(); }
  const ay = y - 52 + Math.sin(t * 1.5 + o.x) * 1.5;
  for (let i = 0; i < 6; i++) { const sx = x - 8 + i * (o.w + 16) / 6; rrect(ctx, sx, ay, (o.w + 16) / 6 + 1, 30, 3); ctx.fillStyle = i % 2 ? '#fff' : o.roof; ctx.fill(); }
  rrect(ctx, x - 8, ay, o.w + 16, 30, 6); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x - 8 + (i + 0.5) * (o.w + 16) / 6, ay + 30, (o.w + 16) / 12, 0, Math.PI); ctx.fillStyle = i % 2 ? '#fff' : o.roof; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke(); }
}
function fountain(ctx, o, t) {
  shadow(ctx, o.x + 8, o.y + 18, o.r * 1.1, o.r * 0.5, 0.25);
  circle(ctx, o.x, o.y, o.r, '#a8adb5', 5);
  circle(ctx, o.x, o.y, o.r - 10, '#5fc7f0', 3);
  // (f in [0,1) even for a negative render clock: a negative arc radius throws and kills the frame loop)
  for (let i = 0; i < 3; i++) { const f = (((t * 0.6 + i / 3) % 1) + 1) % 1; ctx.beginPath(); ctx.arc(o.x, o.y, Math.max(0, 8 + f * (o.r - 18)), 0, TAU); ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - f)})`; ctx.lineWidth = 2.5; ctx.stroke(); }
  circle(ctx, o.x, o.y - 6, 16, '#c3c8cf', 4);
  circle(ctx, o.x, o.y - 26, 9, '#d8dde3', 3.5);
  // water spout arcs
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + t * 0.3; ctx.beginPath(); ctx.moveTo(o.x, o.y - 32); ctx.quadraticCurveTo(o.x + Math.cos(a) * 22, o.y - 58, o.x + Math.cos(a) * 30, o.y - 6 + Math.sin(a) * 18); ctx.strokeStyle = 'rgba(190,240,255,.85)'; ctx.lineWidth = 3; ctx.stroke(); }
  circle(ctx, o.x, o.y - 36, 4, '#e8f8ff', 0);
}
function lamp(ctx, o, t) {
  shadow(ctx, o.x + 4, o.y + 6, 12, 5, 0.25);
  ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x, o.y - 52); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = '#555b66'; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.save(); ctx.shadowColor = '#ffcf6a'; ctx.shadowBlur = 18;
  rrect(ctx, o.x - 9, o.y - 70, 18, 20, 5); ctx.fillStyle = `rgba(255,${214 + Math.sin(t * 5 + o.x) * 20 | 0},110,1)`; ctx.fill(); ctx.restore();
  rrect(ctx, o.x - 9, o.y - 70, 18, 20, 5); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(o.x - 12, o.y - 70); ctx.lineTo(o.x, o.y - 80); ctx.lineTo(o.x + 12, o.y - 70); ctx.closePath(); ctx.fillStyle = '#555b66'; ctx.fill(); ctx.stroke();
}
function well(ctx, o) {
  shadow(ctx, o.x + 5, o.y + 10, o.r * 1.2, o.r * 0.55, 0.25);
  circle(ctx, o.x, o.y, o.r, '#9aa1ab', 4); circle(ctx, o.x, o.y, o.r - 8, '#2f5d7a', 3);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(o.x + s * o.r, o.y); ctx.lineTo(o.x + s * o.r, o.y - 44); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = '#8a5a35'; ctx.lineWidth = 3.5; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(o.x - o.r - 8, o.y - 40); ctx.lineTo(o.x, o.y - 60); ctx.lineTo(o.x + o.r + 8, o.y - 40); ctx.closePath(); ctx.fillStyle = '#d9483b'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
}
function board(ctx, o) {
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(o.x + s * 28, o.y + 6); ctx.lineTo(o.x + s * 28, o.y - 40); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = '#8a5a35'; ctx.lineWidth = 3.5; ctx.stroke(); }
  rrect(ctx, o.x - 36, o.y - 52, 72, 40, 5); ctx.fillStyle = '#b07a45'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#fff4d6', '#ffe0a8', '#e0f0ff', '#ffd0d0'][i]; ctx.fillRect(o.x - 30 + i * 15, o.y - 46 + (i % 2) * 6, 12, 16); }
}
/** The clerk behind the desk (a waving villager in a ribbon bonnet) with a "!" bubble. */
function clerk(ctx, t, local) {
  const near = local && nearCounter(local.x, local.y, 40);
  const bob = Math.sin(t * 2.2) * 1.5, LIFT = 26; // on the hall step: her torso clears the desk top (the desk is drawn after her)
  drawHero(ctx, { x: CLERK.x, y: CLERK.y - LIFT + bob, ang: local ? Math.atan2(local.y - CLERK.y, local.x - CLERK.x) : Math.PI / 2, cls: 'cleric', app: CLERK_APP, time: t, anim: null, scale: 1.1, moving: false, noWeapon: true });
  // bubble
  const by = CLERK.y - 84 + Math.sin(t * 3) * 3;
  ctx.save(); ctx.translate(CLERK.x + 22, by);
  circle(ctx, 0, 0, 15, near ? '#ffd23f' : npcMark('hana') === 'ready' ? '#7dff9a' : npcMark('hana') ? '#ffd23f' : '#fff', 3.5);
  ctx.font = "20px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.fillText(near ? '…' : npcMark('hana') === 'ready' ? '★' : '!', 0, 1);
  ctx.restore();
}

/** Y-sorted town props (drawn with the characters: roofs hide players walking behind a building). */
export function townSprites(view, local) {
  if (!townVisible(view)) return [];
  const out = [];
  for (const o of TOWN_PROPS) {
    if (o.kind === 'tree' || o.kind === 'pond') continue; // (trees: over pass; the pond: ground pass)
    const y = o.sh === 'rect' ? o.y + o.h / 2 : o.y + (o.r || 0) * 0.3;
    out.push({ kind: 'townprop', o, y, local });
  }
  out.push({ kind: 'townprop', o: { kind: 'clerk' }, y: CLERK.y, local });
  return out;
}
export function drawTownSprite(ctx, s, t, local) {
  const o = s.o;
  switch (o.kind) {
    case 'house': return house(ctx, o, t);
    case 'counter': return counterHall(ctx, o, t);
    case 'desk': return desk(ctx, o);
    case 'stall': return stall(ctx, o, t);
    case 'fountain': return fountain(ctx, o, t);
    case 'lamp': return lamp(ctx, o, t);
    case 'well': return well(ctx, o);
    case 'board': return board(ctx, o);
    case 'clerk': return clerk(ctx, t, local);
    case 'gatepost': return drawGatePost(ctx, o, t);
    case 'wboard': return weeklyBoard(ctx, o, t, !!(local && nearStation(local.x, local.y) === STATION.weekly));
    case 'barrel': return barrel(ctx, o);
    case 'bench': return bench(ctx, o);
    case 'rack': return rack(ctx, o, t);
    case 'fpost': return fpost(ctx, o);
    case 'statue': return statue(ctx, o, t);
    case 'windmill': return windmill(ctx, o, t);
    case 'oak': return oakTrunk(ctx, o);
    default: return drawVillageProp(ctx, o, t, s.local || local);
  }
}
/** Over everything: tree canopies (fade when you're under one), bunting across the plaza, the counter's interact ring. */
export function drawTownOver(ctx, view, t, local) {
  if (!townVisible(view)) return;
  // bunting strings between the lamp posts
  const lamps = TOWN_PROPS.filter((o) => o.kind === 'lamp');
  const pairs = TOWN_BUNTING;
  const cols = ['#ff5e5b', '#ffd23f', '#3a8ee8', '#3cc15b', '#ec6fb0'];
  for (const [i, k] of pairs) {
    const a = lamps[i], b = lamps[k]; if (!a || !b) continue;
    const ax = a.x, ay = a.y - 70, bx = b.x, by = b.y - 70, mx = (ax + bx) / 2, my = (ay + by) / 2 + 26;
    if (Math.max(ax, bx) < view.x0 - 20 || Math.min(ax, bx) > view.x1 + 20 || Math.max(ay, by) + 60 < view.y0 || Math.min(ay, by) - 20 > view.y1) continue;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.strokeStyle = 'rgba(43,36,51,.7)'; ctx.lineWidth = 2; ctx.stroke();
    for (let f = 0.08; f < 0.95; f += 0.12) {
      const x = (1 - f) * (1 - f) * ax + 2 * (1 - f) * f * mx + f * f * bx, y = (1 - f) * (1 - f) * ay + 2 * (1 - f) * f * my + f * f * by;
      const sw = Math.sin(t * 3 + f * 10) * 2;
      ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.lineTo(x + sw, y + 13); ctx.closePath(); ctx.fillStyle = cols[Math.round(f * 20) % 5]; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
    }
  }
  for (const o of TOWN_PROPS) {
    if (o.kind === 'oak') { const under = local && Math.abs(local.x - o.x) < 130 && local.y < o.y + 10 && local.y > o.y - 300; oakCanopy(ctx, o, t, under ? 0.4 : 1); continue; }
    if (o.kind !== 'tree' || !inV(view, o.x, o.y, o.size * 3 + 80)) continue;
    const under = local && Math.hypot(local.x - o.x, local.y - o.y) < o.size + 6;
    drawTree(ctx, { x: o.x, y: o.y, size: o.size, zone: 0, variant: o.variant }, under ? 0.45 : 1);
  }
  // the interact ring at the counter
  if (local && inTownArea(local.x, local.y)) {
    const near = nearCounter(local.x, local.y);
    ctx.beginPath(); ctx.arc(COUNTER.x, COUNTER.y + 6, 56 + Math.sin(t * 4) * 4, 0, TAU);
    ctx.setLineDash([12, 9]); ctx.lineDashOffset = -t * 30; ctx.strokeStyle = near ? 'rgba(255,210,63,.95)' : 'rgba(255,255,255,.5)'; ctx.lineWidth = near ? 5 : 3; ctx.stroke(); ctx.setLineDash([]);
    drawVillageOver(ctx, t, local); // the village services: name plates + interact rings
  }
}

// ------------------------------------------------------------------ minimap (the whole village)
export function drawTownMinimap(g, S, p, others, t) {
  const k = S / (TOWN_R * 2 + 120), cx = S / 2, cy = S / 2;
  g.fillStyle = '#4db6e8'; g.fillRect(0, 0, S, S);
  const X = (x) => cx + (x - T.x) * k, Y = (y) => cy + (y - T.y) * k;
  circle(g, cx, cy, (TOWN_R + 30) * k, '#f2dc9b', 0);
  circle(g, cx, cy, TOWN_R * k, '#78c860', 0);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const r of ROADS_W) { g.beginPath(); r.P.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.strokeStyle = r.k === 'cobble' ? '#d9cfb4' : '#dcbb82'; g.lineWidth = Math.max(2, r.w * k); g.stroke(); }
  for (const v of TOWN_PAVES) { g.beginPath(); g.ellipse(X(T.x + v.dx), Y(T.y + v.dy), v.rx * k, v.ry * k, 0, 0, TAU); g.fillStyle = '#d9cfb4'; g.fill(); }
  circle(g, cx, cy, 268 * k, '#d9cfb4', 0);
  g.beginPath(); g.ellipse(X(T.x - 600), Y(T.y + 330), 196 * k, 142 * k, 0, 0, TAU); g.fillStyle = '#e2c995'; g.fill();
  for (const o of TOWN_PROPS) {
    if (o.sh === 'rect') { if (o.kind === 'house' || o.kind === 'counter' || o.kind === 'stall') { g.fillStyle = o.kind === 'counter' ? '#ffd23f' : o.roof || '#b07a45'; g.fillRect(X(o.x - o.w / 2), Y(o.y - o.h / 2), o.w * k, o.h * k); } }
    else if (o.kind === 'tree' || o.kind === 'oak') circle(g, X(o.x), Y(o.y), Math.max(2, o.r * k * (o.kind === 'oak' ? 2.6 : 1.4)), '#3a8f46', 0);
    else if (o.kind === 'fountain' || o.kind === 'pond') circle(g, X(o.x), Y(o.y), o.r * k, '#5fc7f0', 1.5);
    else if (o.kind === 'windmill') circle(g, X(o.x), Y(o.y), Math.max(3, o.r * k), '#f2ead8', 1.5);
  }
  for (const gt of GATES) circle(g, X(T.x + gt.dx), Y(T.y + gt.dy), Math.max(3, 34 * k), gt.col || '#ffd23f', 1.5); // the Realm Gates
  // the counter marker
  g.save(); g.translate(X(COUNTER.x), Y(COUNTER.y) - 6); g.font = "bold 14px 'Lilita One', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
  circle(g, 0, 0, 8, '#ff5e5b', 2); g.fillStyle = '#fff'; g.fillText('!', 0, 1); g.restore();
  drawVillagePins(g, X, Y);
  for (const o of others) circle(g, X(o.x), Y(o.y), 4, '#3a8ee8', 2);
  circle(g, X(p.x), Y(p.y), 5, '#fff', 2.5);
  void t;
}
/** the district you are in (the HUD's area line + the minimap title) */
export function townDistrict(x, y) {
  let best = null, bd = 1e9;
  for (const d of DISTRICTS) { const dd = Math.hypot(x - T.x - d.dx, y - T.y - d.dy); if (dd < bd) { bd = dd; best = d; } }
  return best && bd < 420 ? best.name : TOWN_NAME;
}
export { TOWN_NAME };

// ------------------------------------------------------------------ hub event banners
export function hubEventFx(fx, ev, me) {
  if (ev.ph === 'mission') {
    if (String(ev.id).startsWith('op_')) return; // (mission dungeons: their own 'ops start' callout)
    const sub = { field: 'Danger rises the further you go from the campfire', vorthax: 'The Rift Sanctum: break the wards, mind the lanes', astrael: 'The Star Sanctum: break her acts to skip ahead', astraelx: 'Faster, harder, overlapping. Good luck.', skaldrat: 'The Hoarfrost Mirror: keep moving on the thin ice', skaldrax: 'Faster tells, combined mechanics, Absolute Zero', pyrrhext: 'The Heart-Chamber: bleed the valves, dodge on the red beat', pyrrhexx: 'Two valves, crumbling rafts, the Heart of the World', dunes: 'Safe at the oasis; deadlier toward the rim. Hunt the Overlord for a Tomb portal', tomb: 'Three chambers of the sun-eaten dead, then Neferakh' }[ev.id] || '';
    fx.banner(`MISSION: ${String(ev.name || ev.id).toUpperCase()}`, '#ffd23f', sub, 2.6, 46);
  } else if (ev.ph === 'town') {
    if (ev.pid && !me) return;
    const sub = ev.why === 'clear' ? 'Mission cleared! Welcome home' : ev.why === 'wipe' ? 'Carted back to the village: regroup and try again' : ev.why === 'death' ? 'Patched up at the village: gear up and head back out' : ev.why === 'travel' ? 'Home again: the Forge, the Mission Counter and the Weekly Board are close by' : 'Back in town: talk to the Mission Counter to depart';
    fx.banner(TOWN_NAME.toUpperCase(), '#9fe0ff', sub, 2.6, 44);
  } else if (ev.ph === 'gate') { if (ev.ops) { fx.ring(ev.x, ev.y - 60, 140, '#ffffff', 0.6, 10); fx.sparks(ev.x, ev.y - 60, -Math.PI / 2, 22, '#ffffff', 380, 2.4); } fx.ring(ev.x, ev.y, 80, '#ffe9a0', 0.6, 8); fx.puffs(ev.x, ev.y, 14, '#fff4d6', 14, 160, 0.7); fx.sparks(ev.x, ev.y, -Math.PI / 2, 16, '#ffcf4a', 320, 1.6);
  } else if (ev.ph === 'deny' && me) fx.banner("CAN'T DEPART", '#ff5e5b', ev.why, 1.8, 34);
}
