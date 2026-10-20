// Detailed Wilds props as cached sprites (art & perf pass): trees (broadleaf / pine / autumn / dead / the Elderoak),
// rocks, ridge cliffs, ruin pillars, menhirs, the old watchtower, ruin walls, bushes, reeds. Each prop kind is painted
// once per (kind, zone, variant bucket, size bucket) at the current pixel scale and blitted after that.
import { INK, circle, ellipse, shade, rrect } from './art.js';
import { lgrad, rimArc, ink, ball, oval, poly } from './dunesfx.js';
import { sprite, blit } from './sprite.js';
import { glowSprite } from './wildsfx.js';

const TAU = Math.PI * 2, LA = -2.3;
const H = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const LEAF = { 0: ['#4fb548', '#7ad763', '#2f7f3a'], 1: ['#45a844', '#6fcf5a', '#2b7536'], 2: ['#3a8f46', '#5cb257', '#245f33'], 3: ['#df8a2d', '#f6b950', '#a8561c'], 4: ['#6b5a7a', '#8e7aa4', '#463a55'] };
const bucket = (size, step = 8) => Math.max(1, Math.round(size / step));

// ------------------------------------------------------------------ trees
function treeType(o) {
  if (o.giant) return 'giant';
  if (o.dead) return 'dead';
  if (o.zone === 2 && o.variant % 3 === 0) return 'pine';
  if (o.zone === 4 && o.variant % 2 === 0) return 'dead';
  return 'leaf';
}
export function drawTreeShadowD(ctx, o) {
  const s = o.size, c = sprite('tsh', 200, 120, 100, 60, (g) => { const gr = g.createRadialGradient(0, 0, 4, 0, 0, 100); gr.addColorStop(0, 'rgba(20,30,20,.34)'); gr.addColorStop(0.7, 'rgba(20,30,20,.2)'); gr.addColorStop(1, 'rgba(20,30,20,0)'); g.scale(1, 0.6); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 100, 0, TAU); g.fill(); });
  blit(ctx, c, o.x + 10, o.y + 14, s / 55);
  // trunk base (visible under a faded canopy)
  const tb = sprite('trunk', 40, 40, 20, 20, (g) => { ball(g, 0, 0, 11, '#7a5232', LA, 3, 0.5); g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.strokeStyle = 'rgba(40,20,10,.4)'; g.lineWidth = 1.5; g.stroke(); });
  if (treeType(o) !== 'dead') blit(ctx, tb, o.x, o.y, s / 60);
}
export function drawTreeD(ctx, o, alpha = 1) {
  const type = treeType(o), sb = bucket(o.size, type === 'giant' ? 20 : 8), S = sb * (type === 'giant' ? 20 : 8), vb = o.variant % 6;
  const R = S * 1.35;
  const c = sprite(`tree:${type}:${o.zone}:${vb}:${sb}`, R * 2, R * 2, R, R, (g) => paintTree(g, type, o.zone, vb, S), { rim: 0.45, ao: 0.3, shade: 0.22 });
  if (alpha < 1) { ctx.globalAlpha = alpha; blit(ctx, c, o.x, o.y, o.size / S); ctx.globalAlpha = 1; } else blit(ctx, c, o.x, o.y, o.size / S);
}
function paintTree(g, type, zone, v, s) {
  const [base, hi, dk] = LEAF[zone] || LEAF[1];
  if (type === 'pine') {
    for (let layer = 0; layer < 4; layer++) {
      const r = s * (1.02 - layer * 0.24), pts = [];
      for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU + layer * 0.2 + v, rr = i % 2 ? r * 0.74 : r; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      poly(g, pts); g.fillStyle = lgrad(g, 0, 0, r, ['#2a6e38', '#358545', '#43994f', '#5cb35c'][layer]); g.fill(); ink(g, 3.6);
      for (let i = 0; i < 18; i += 2) { const a = (i / 18) * TAU + layer * 0.2 + v; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); g.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); g.strokeStyle = 'rgba(20,50,25,.35)'; g.lineWidth = 1.6; g.stroke(); }
    }
    circle(g, 0, 0, s * 0.1, '#7a5232', 2);
    return;
  }
  if (type === 'dead') {
    g.lineCap = 'round';
    const n = 5 + (v % 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + v * 0.9, L = s * (0.62 + (v * (i + 1) % 3) * 0.12);
      const mx = Math.cos(a) * L * 0.55, my = Math.sin(a) * L * 0.55, ex = Math.cos(a + 0.35) * L, ey = Math.sin(a + 0.35) * L;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(mx, my, ex, ey);
      g.strokeStyle = INK; g.lineWidth = 16; g.stroke(); g.strokeStyle = '#6a5446'; g.lineWidth = 10; g.stroke(); g.strokeStyle = 'rgba(255,230,200,.25)'; g.lineWidth = 2.5; g.stroke();
      const fx = Math.cos(a + 0.7) * L * 0.8, fy = Math.sin(a + 0.7) * L * 0.8;
      g.beginPath(); g.moveTo(mx, my); g.lineTo(fx, fy); g.strokeStyle = INK; g.lineWidth = 8; g.stroke(); g.strokeStyle = '#5c473b'; g.lineWidth = 4; g.stroke();
      if (zone === 4) { ball(g, ex, ey, 7, '#9a6fb8', LA, 2.6, 0.5); ball(g, fx, fy, 5, '#b78ad6', LA, 2, 0.5); }
      else if (zone === 3) { ball(g, ex, ey, 6, '#d9852a', LA, 2.4, 0.5); }
    }
    ball(g, 0, 0, s * 0.3, '#6a5446', LA, 4.5, 0.4);
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, s * (0.08 + i * 0.07), 0, TAU); g.strokeStyle = 'rgba(30,15,10,.35)'; g.lineWidth = 1.4; g.stroke(); }
    return;
  }
  // broadleaf (and the giant Elderoak): a lobed canopy, layered clumps, leaf strokes, decals
  const big = type === 'giant';
  const lobes = big ? 9 : 7, pts = [];
  for (let i = 0; i < lobes * 4; i++) { const a = (i / (lobes * 4)) * TAU + v, k = 1 + 0.09 * Math.sin(a * lobes + v); pts.push([Math.cos(a) * s * k, Math.sin(a) * s * k]); }
  g.beginPath(); g.arc(4, 6, s * 1.02, 0, TAU); g.fillStyle = 'rgba(15,40,20,.22)'; g.fill();
  poly(g, pts); g.fillStyle = lgrad(g, 0, 0, s, base, LA, 0.25, -0.3); g.fill(); ink(g, big ? 5.5 : 4.5);
  // clumps: dark under-layer, mid, highlight - each a small lit ball
  const clumps = big ? 16 : 9;
  for (let layer = 0; layer < 3; layer++) for (let i = 0; i < clumps - layer * 3; i++) {
    const a = H(v * 7 + i, layer) * TAU, r = s * (0.18 + H(i, v + layer) * (0.62 - layer * 0.14)), x = Math.cos(a) * r - layer * s * 0.06, y = Math.sin(a) * r - layer * s * 0.07;
    const cr = s * (0.22 - layer * 0.04) * (0.8 + H(i + 3, v) * 0.4);
    g.beginPath(); g.arc(x, y, cr, 0, TAU); g.fillStyle = layer === 0 ? dk : layer === 1 ? base : hi; g.globalAlpha = layer === 0 ? 0.55 : 0.9; g.fill(); g.globalAlpha = 1;
    if (layer > 0) { g.beginPath(); g.arc(x, y, cr, LA - 0.9, LA + 0.9); g.strokeStyle = 'rgba(255,255,220,.35)'; g.lineWidth = 1.6; g.stroke(); g.beginPath(); g.arc(x, y, cr, LA + 2.2, LA + 4); g.strokeStyle = 'rgba(20,40,20,.35)'; g.lineWidth = 1.6; g.stroke(); }
  }
  // leaf strokes
  g.lineCap = 'round';
  for (let i = 0; i < (big ? 40 : 18); i++) { const a = H(i, v + 40) * TAU, r = s * (0.15 + H(v, i + 40) * 0.75), x = Math.cos(a) * r, y = Math.sin(a) * r, d = H(i, 9) * TAU; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(d) * 5, y + Math.sin(d) * 5); g.strokeStyle = i % 2 ? 'rgba(20,50,20,.35)' : 'rgba(240,255,200,.4)'; g.lineWidth = 1.8; g.stroke(); }
  g.beginPath(); g.ellipse(-s * 0.32, -s * 0.38, s * 0.22, s * 0.13, -0.6, 0, TAU); g.fillStyle = 'rgba(255,255,240,.28)'; g.fill();
  if (zone <= 1 && v % 3 === 0) for (let i = 0; i < 5; i++) ball(g, Math.cos(v + i * 1.4) * s * 0.55, Math.sin(v + i * 1.4) * s * 0.55, 4.2, '#ff5e5b', LA, 2.2, 0.7);
  if (zone === 3 && v % 2 === 0) for (let i = 0; i < 5; i++) ball(g, Math.cos(v + i * 2) * s * 0.5, Math.sin(v + i * 2) * s * 0.5, 3.8, '#ffdd66', LA, 2, 0.7);
  if (big) { for (let i = 0; i < 10; i++) { const a = i * 0.63 + 0.3, r = s * (0.3 + H(i, 3) * 0.5); circle(g, Math.cos(a) * r, Math.sin(a) * r, 3, '#fff6a0', 0); } }
}

// ------------------------------------------------------------------ rocks, cliffs, ruins
const ROCK = { 0: '#a8adb5', 1: '#a3a9b2', 2: '#9aa1ab', 3: '#b09a84', 4: '#6d6a78' };
export function drawRockD(ctx, o) {
  const sb = bucket(o.size, 4), S = sb * 4, vb = o.variant % 8, R = S * 1.6;
  const c = sprite(`rock:${o.zone}:${vb}:${sb}`, R * 2, R * 2, R * 0.9, R * 0.85, (g) => paintRock(g, S, vb, ROCK[o.zone] || ROCK[2], 0.75), { rim: 0.5, ao: 0.3, shade: 0.2 });
  blit(ctx, c, o.x, o.y, o.size / S);
}
function rockPts(s, v, n = 9, sq = 0.8) { const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU + v * 0.4, r = s * (0.82 + H(v, i) * 0.3); pts.push([Math.cos(a) * r, Math.sin(a) * r * sq]); } return pts; }
function paintRock(g, s, v, col, sq) {
  const pts = rockPts(s, v, 9, sq), hgt = s * 0.38;
  g.beginPath(); g.ellipse(s * 0.25, hgt + s * 0.3, s * 1.15, s * 0.5, 0, 0, TAU); g.fillStyle = 'rgba(20,15,30,.25)'; g.fill();
  poly(g, pts, 0, hgt * 0.6); g.fillStyle = shade(col, -0.35); g.fill(); ink(g, 3.8);
  poly(g, pts, 0, 0); g.fillStyle = lgrad(g, 0, 0, s, col, LA, 0.3, -0.25); g.fill(); ink(g, 3.8);
  // facets + cracks + moss
  g.beginPath(); g.moveTo(pts[1][0] * 0.4, pts[1][1] * 0.4); g.lineTo(pts[4][0] * 0.6, pts[4][1] * 0.6); g.lineTo(pts[6][0] * 0.5, pts[6][1] * 0.5); g.strokeStyle = 'rgba(40,30,50,.35)'; g.lineWidth = 2; g.stroke();
  g.beginPath(); g.moveTo(-s * 0.5, -s * 0.15); g.quadraticCurveTo(-s * 0.2, -s * 0.5, s * 0.25, -s * 0.45); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2.2; g.stroke();
  if (v % 3 === 0) { g.beginPath(); g.ellipse(-s * 0.2, -s * 0.25, s * 0.35, s * 0.15, -0.3, 0, TAU); g.fillStyle = 'rgba(110,170,70,.55)'; g.fill(); }
  for (let i = 0; i < 4; i++) { const a = H(i, v) * TAU, r = s * 0.5 * H(v, i + 7); g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r * sq, 1.4, 0, TAU); g.fillStyle = 'rgba(40,30,50,.35)'; g.fill(); }
}
const CLIFF = { 0: '#9a9488', 1: '#958f84', 2: '#8d8a84', 3: '#a08670', 4: '#5e5868' };
export function drawCliffD(ctx, o) {
  const sb = bucket(o.size, 6), S = sb * 6, vb = o.variant % 8, R = S * 1.5;
  const c = sprite(`cliff:${o.zone}:${vb}:${sb}`, R * 2, R * 2.2, R, R * 1.2, (g) => paintCliff(g, S, vb, CLIFF[o.zone] || CLIFF[2]), { rim: 0.5, ao: 0.35, shade: 0.24 });
  blit(ctx, c, o.x, o.y, o.size / S);
}
function paintCliff(g, s, v, col) {
  // a tall crag: dark base plinth, stepped strata, a lit top cap with cracks and grass tufts
  const pts = rockPts(s * 0.95, v, 10, 0.78), hgt = s * 0.55;
  g.beginPath(); g.ellipse(s * 0.2, hgt + s * 0.35, s * 1.1, s * 0.45, 0, 0, TAU); g.fillStyle = 'rgba(15,10,25,.28)'; g.fill();
  poly(g, pts, 0, hgt); g.fillStyle = shade(col, -0.45); g.fill(); ink(g, 4);
  for (const [k, c2] of [[0.66, shade(col, -0.3)], [0.33, shade(col, -0.15)]]) { poly(g, pts.map(([x, y]) => [x * (0.97 + k * 0.03), y]), 0, hgt * k); g.fillStyle = c2; g.fill(); g.lineWidth = 1.8; g.strokeStyle = 'rgba(30,20,40,.45)'; g.stroke(); }
  poly(g, pts.map(([x, y]) => [x * 0.92, y * 0.92]), 0, -s * 0.05); g.fillStyle = lgrad(g, 0, -s * 0.05, s, col, LA, 0.3, -0.2); g.fill(); ink(g, 3.6);
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const a = H(v, i + 2) * TAU, r = s * 0.4; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2 - s * 0.05); g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.7 - s * 0.05); g.lineTo(Math.cos(a + 0.4) * r * 1.4, Math.sin(a + 0.4) * r - s * 0.05); g.strokeStyle = 'rgba(30,20,40,.45)'; g.lineWidth = 2; g.stroke(); }
  g.beginPath(); g.moveTo(-s * 0.55, -s * 0.25); g.quadraticCurveTo(-s * 0.15, -s * 0.62, s * 0.35, -s * 0.5); g.strokeStyle = 'rgba(255,255,240,.45)'; g.lineWidth = 2.4; g.stroke();
  if (v % 2 === 0) for (let i = 0; i < 3; i++) { const x = (H(i, v) - 0.5) * s, y = (H(v, i) - 0.6) * s * 0.5; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x - 2, y - 7); g.moveTo(x, y); g.lineTo(x, y - 9); g.moveTo(x + 4, y); g.lineTo(x + 2, y - 7); g.strokeStyle = '#4f8f3a'; g.lineWidth = 2.4; g.stroke(); }
}
export function drawPillarD(ctx, o) {
  const c = sprite(`pillar:${o.size}`, 110, 130, 55, 70, (g) => {
    const s = o.size;
    g.beginPath(); g.ellipse(8, 20, s * 1.15, s * 0.55, 0, 0, TAU); g.fillStyle = 'rgba(15,10,25,.3)'; g.fill();
    ball(g, 0, 8, s * 1.02, '#4a4558', LA, 4.5, 0.3);
    ball(g, 0, 0, s, '#5d586b', LA, 4.5, 0.55);
    ball(g, 0, -2, s * 0.7, '#77718a', LA, 3, 0.5);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.beginPath(); g.moveTo(Math.cos(a) * s * 0.72, Math.sin(a) * s * 0.72 - 2); g.lineTo(Math.cos(a) * s * 0.98, Math.sin(a) * s * 0.98); g.strokeStyle = 'rgba(30,20,40,.4)'; g.lineWidth = 1.6; g.stroke(); }
    g.beginPath(); g.moveTo(-s * 0.3, -s * 0.4); g.lineTo(-s * 0.05, -s * 0.1); g.lineTo(-s * 0.2, s * 0.2); g.strokeStyle = 'rgba(20,10,30,.45)'; g.lineWidth = 1.6; g.stroke();
  }, { rim: 0.45, ao: 0.3 });
  blit(ctx, c, o.x, o.y);
  const gl = glowSprite('#ff3b1f', 18); blit(ctx, gl, o.x, o.y - 2); circle(ctx, o.x, o.y - 2, 4.5, '#ff6a3b', 0); circle(ctx, o.x - 1, o.y - 3, 1.6, '#ffe0b0', 0);
}
export function drawMenhirD(ctx, o) {
  const c = sprite(`menhir:${o.variant % 4}`, 80, 120, 40, 90, (g) => {
    const v = o.variant % 4;
    g.beginPath(); g.ellipse(6, 4, 26, 11, 0, 0, TAU); g.fillStyle = 'rgba(15,10,25,.3)'; g.fill();
    const pts = [[-16, 4], [-19, -30], [-12, -62 - v * 3], [4, -70 - v * 2], [16, -48], [18, 4]];
    poly(g, pts); g.fillStyle = lgrad(g, 0, -30, 40, '#a8a492'); g.fill(); ink(g, 3.6);
    poly(g, [[4, -70 - v * 2], [16, -48], [18, 4], [6, 6], [6, -40]]); g.fillStyle = 'rgba(40,30,50,.28)'; g.fill();
    g.beginPath(); g.moveTo(-6, -50); g.lineTo(-2, -40); g.lineTo(-8, -28); g.moveTo(-2, -40); g.lineTo(4, -34); g.strokeStyle = 'rgba(60,200,180,.8)'; g.lineWidth = 2.4; g.stroke();
    g.beginPath(); g.ellipse(-6, -8, 10, 6, 0, 0, TAU); g.fillStyle = 'rgba(110,170,70,.6)'; g.fill();
  }, { rim: 0.5, ao: 0.3 });
  blit(ctx, c, o.x, o.y);
}
export function drawRuinWallD(ctx, o) {
  const c = sprite(`rwall:${o.variant % 4}`, 100, 100, 50, 60, (g) => {
    const v = o.variant % 4;
    g.beginPath(); g.ellipse(6, 10, 34, 13, 0, 0, TAU); g.fillStyle = 'rgba(15,10,25,.3)'; g.fill();
    for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - (row === 2 && v % 2 ? 1 : 0); i++) {
      const x = -26 + i * 18 + (row % 2) * 9, y = 4 - row * 13, w = 17, h = 12;
      rrect(g, x, y - h, w, h, 2.5); g.fillStyle = lgrad(g, x + w / 2, y - h / 2, 10, H(i, row + v) < 0.5 ? '#a7a0a8' : '#958e98'); g.fill(); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.moveTo(x + 2, y - h + 2); g.lineTo(x + w - 3, y - h + 2); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1.3; g.stroke();
    }
    g.beginPath(); g.moveTo(-20, -24); g.quadraticCurveTo(-5, -34, 12, -26); g.strokeStyle = '#4f8f3a'; g.lineWidth = 3; g.stroke();
  }, { rim: 0.45, ao: 0.3 });
  blit(ctx, c, o.x, o.y);
}
export function drawTowerD(ctx, o) {
  const c = sprite('wtower', 220, 280, 110, 190, (g) => {
    g.beginPath(); g.ellipse(14, 10, 90, 34, 0, 0, TAU); g.fillStyle = 'rgba(15,10,25,.32)'; g.fill();
    // broken round tower: stone courses, a slit window, a jagged top, ivy
    g.beginPath(); g.moveTo(-60, 0); g.lineTo(-60, -110); g.lineTo(-48, -128); g.lineTo(-30, -118); g.lineTo(-14, -150); g.lineTo(6, -136); g.lineTo(24, -158); g.lineTo(42, -126); g.lineTo(60, -134); g.lineTo(60, 0); g.quadraticCurveTo(0, 22, -60, 0); g.closePath();
    g.fillStyle = lgrad(g, 0, -70, 90, '#a49ca6'); g.fill(); ink(g, 4.5);
    g.save(); g.clip();
    for (let row = 0; row < 11; row++) { const y = -row * 14; g.beginPath(); g.moveTo(-60, y + Math.abs(0) ); g.quadraticCurveTo(0, y + 18, 60, y); g.strokeStyle = 'rgba(40,30,50,.35)'; g.lineWidth = 2; g.stroke(); for (let i = 0; i < 6; i++) { const x = -54 + i * 21 + (row % 2) * 10; g.beginPath(); g.moveTo(x, y + 4 + (1 - Math.abs(x / 60)) * 12); g.lineTo(x, y - 10 + (1 - Math.abs(x / 60)) * 12); g.stroke(); } }
    g.fillStyle = 'rgba(30,20,40,.3)'; g.fillRect(20, -160, 40, 170);
    g.restore();
    rrect(g, -8, -96, 14, 34, 6); g.fillStyle = '#2a2232'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.ellipse(0, -132, 50, 14, 0, 0, TAU); g.fillStyle = '#3a3240'; g.fill(); g.lineWidth = 2; g.stroke();
    g.lineCap = 'round';
    for (let i = 0; i < 14; i++) { const x = -56 + H(i, 3) * 40, y = -20 - H(i, 4) * 90; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fillStyle = i % 2 ? '#4f8f3a' : '#6fb24c'; g.fill(); }
  }, { rim: 0.5, ao: 0.32 });
  blit(ctx, c, o.x, o.y);
}

// ------------------------------------------------------------------ baked decor (painted straight into ground tiles)
const BUSH = { 0: ['#3fa33e', '#6fd05c'], 1: ['#3a9c3c', '#66c858'], 2: ['#4d8f3a', '#74b057'], 3: ['#b7822f', '#dcab52'], 4: ['#5c4a66', '#86719a'] };
export function paintBush(g, d) {
  const [col, hi] = BUSH[d.zone] || BUSH[1], s = d.size, x = d.x, y = d.y;
  g.beginPath(); g.ellipse(x + 4, y + s * 0.45, s * 1.1, s * 0.42, 0, 0, TAU); g.fillStyle = 'rgba(20,30,20,.22)'; g.fill();
  const lobes = [[-0.45, 0.1, 0.62], [0.45, 0.12, 0.6], [0, -0.3, 0.7]];
  g.beginPath(); for (const [lx, ly, r] of lobes) { g.moveTo(x + lx * s + r * s, y + ly * s); g.arc(x + lx * s, y + ly * s, r * s, 0, TAU); }
  g.lineWidth = 7; g.strokeStyle = INK; g.stroke(); g.fillStyle = col; g.fill();
  for (const [lx, ly, r] of lobes) { g.beginPath(); g.arc(x + lx * s - r * s * 0.15, y + ly * s - r * s * 0.18, r * s * 0.62, 0, TAU); g.fillStyle = hi; g.globalAlpha = 0.7; g.fill(); g.globalAlpha = 1; g.beginPath(); g.arc(x + lx * s, y + ly * s, r * s - 2, LA - 0.8, LA + 0.8); g.strokeStyle = 'rgba(255,255,230,.45)'; g.lineWidth = 1.6; g.stroke(); }
  for (let i = 0; i < 6; i++) { const a = H(d.variant, i) * TAU, r = s * 0.5 * H(i, d.variant); g.beginPath(); g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.lineTo(x + Math.cos(a) * r + 3, y + Math.sin(a) * r - 3); g.strokeStyle = 'rgba(20,50,20,.4)'; g.lineWidth = 1.5; g.stroke(); }
  if (d.variant % 3 === 0 && d.zone <= 1) { ball(g, x + s * 0.3, y - s * 0.1, 3.4, '#ff6b8b', LA, 1.8, 0.7); ball(g, x - s * 0.4, y + s * 0.05, 3.4, '#ffe45c', LA, 1.8, 0.7); }
  if (d.zone === 4 && d.variant % 2 === 0) { ball(g, x + s * 0.2, y - s * 0.3, 2.8, '#ff7ad8', LA, 1.5, 0.7); }
}
export function paintReeds(g, d) {
  g.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const x = d.x + (i - 2) * 5, y = d.y + (i % 2) * 3, top = y - d.size - (i % 3) * 4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 2, y - d.size * 0.5, x + 3, top); g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); g.strokeStyle = '#6fae46'; g.lineWidth = 2; g.stroke(); if (i % 2) ellipse(g, x + 3, top - 2, 2.6, 6, '#7a4a26', 1.5); }
}
export function paintWildsDecor(g, d) {
  if (d.kind === 'bush') return paintBush(g, d), true;
  if (d.kind === 'reeds') return paintReeds(g, d), true;
  if (d.kind === 'altar') return true; // (painted by the ground landmark pass)
  return false;
}

/** Dispatch for render.js: draw a Wilds obstacle (under-entity layer). Returns false for kinds it does not own. */
export function drawWildsObstacle(ctx, o) {
  switch (o.kind) {
    case 'rock': drawRockD(ctx, o); return true;
    case 'cliff': drawCliffD(ctx, o); return true;
    case 'pillar': drawPillarD(ctx, o); return true;
    case 'tree': drawTreeShadowD(ctx, o); return true;
    case 'pond': case 'river': return true;
    default: return false;
  }
}
/** Tall Wilds props that y-sort with the characters. */
export const WILDS_TALL = new Set(['menhir', 'ruinwall', 'ruintower']);
export function drawWildsTall(ctx, o) {
  if (o.kind === 'menhir') drawMenhirD(ctx, o); else if (o.kind === 'ruinwall') drawRuinWallD(ctx, o); else if (o.kind === 'ruintower') drawTowerD(ctx, o); else return false;
  return true;
}
