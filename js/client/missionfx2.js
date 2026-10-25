// Missions revamp, part 2 (2026-10-08): the client art of the new Mobile Defense + Assault.
//  World: the escort route (a winding road over the void: a cached floor built from per-leg capsules, the bridge, cliff
//  lips, wall breaches, the hack pads + the final plaza), the carrier per biome (Seed Ark / Sun Barge / Rune Sledge /
//  Forge Crawler: a y-sorted prop with its HP ring, wheels / runners / treads, jam sparks), the hack ring + beam, the
//  collapsed floor (jagged void holes), the route guide, the hunter's mark, the boss's drain tether + break meter; the
//  stronghold's pylons (custom art) + shield beams to the first gate, trap grates / jet nozzles, the champion's ring.
//  Telegraphs (render.js drawArea hook via missionfx.drawOpsArea): 'oamb' 'ocollapse' 'ocrumble' 'ovolley' 'owhirl'
//  'obeam' 'orune' 'otrap_line' 'otrap_circle' (biome-themed). HUD: the tracker panels, the top objective lines + boss
//  bars, minimap layers, event banners / bursts. Perf: `lite` (phone) drops gradients / additive passes / particles.
import { INK, circle, rrect } from './art.js';
import { drawText } from './textcache.js';
import { OPS, OPS_TYPE, OPS_BIOME, OPS_MOBILE, OPS_ASSAULT, routeAt, inArenaFloor } from '../sim/opsconst.js';
import { OPS_HAZ, WEEKLY } from '../sim/opsmods.js';

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const nowS = () => (typeof performance !== 'undefined' ? performance.now() / 1000 : 0);
const hash = (i) => { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
function label(ctx, s, x, y, size, col, lw = 5) { drawText(ctx, s, x, y, `bold ${size}px "Lilita One", "Arial Black", sans-serif`, col, 'center', lw, INK, size); }
function shade(hex, amt) { const n = parseInt(String(hex).slice(1), 16), f = (v) => Math.max(0, Math.min(255, v + amt)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
let FOCUS = null; // the local hero (trap telegraphs far from it fade: the trap hall / courtyard read cleaner)
export function setOpsFocus(p) { FOCUS = p; }
let BIOME = 'wilds'; // (the trap telegraphs carry no biome: the live layer sets it each frame)
const CART_COL = { wilds: ['#8a5a32', '#7dff6a', '#d9b77a'], dunes: ['#c8913e', '#ffd23f', '#fff0c0'], frost: ['#5b7fa8', '#8ff0ff', '#e6f6ff'], ember: ['#4a3a38', '#ff8a2a', '#ffcf8a'], rift: ['#3a2c66', '#b48cff', '#e8dcff'] };
const TRAP_COL = { wilds: ['#5aa543', '#b9f08a'], dunes: ['#d4a24a', '#fff0c0'], frost: ['#6fc8ff', '#ffffff'], ember: ['#ff6a1a', '#ffd23f'], rift: ['#9a6aff', '#e8dcff'] };

// ------------------------------------------------------------------ the route floor (opsfx floorArt calls these)
/** a union of per-leg capsules (nonzero winding); grow(i) -> px to grow leg i, or null to skip it */
export function routePath(g, A, grow) {
  g.beginPath();
  const P = A.path;
  for (let i = 0; i < P.length - 1; i++) {
    const gr = typeof grow === 'function' ? grow(i) : grow; if (gr == null) continue;
    const a = P[i], b = P[i + 1], R = A.pathR[i] + gr, dx = b.x - a.x, dy = b.y - a.y;
    if (Math.hypot(dx, dy) < 1) { g.moveTo(a.x + R, a.y); g.arc(a.x, a.y, R, 0, TAU); continue; }
    const an = Math.atan2(dy, dx);
    g.moveTo(b.x + Math.cos(an - Math.PI / 2) * R, b.y + Math.sin(an - Math.PI / 2) * R);
    g.arc(b.x, b.y, R, an - Math.PI / 2, an + Math.PI / 2); g.arc(a.x, a.y, R, an + Math.PI / 2, an + Math.PI * 1.5); g.closePath();
  }
}
const BR = (A) => (A.bridge ? A.bridge.leg : -1);
/** walls + floor base of a route arena (before the shared flagstones); returns the clip path builder */
export function routeBase(g, A) {
  const B = OPS_BIOME[A.biome], br = BR(A);
  routePath(g, A, (i) => (i === br ? 8 : 52)); g.fillStyle = INK; g.fill();
  routePath(g, A, (i) => (i === br ? null : 46)); g.fillStyle = B.wall; g.fill();
  routePath(g, A, (i) => (i === br ? 2 : 12)); g.fillStyle = shade(B.floor[0], -46); g.fill(); // (the cliff lip)
  routePath(g, A, 0); g.fillStyle = B.floor[0]; g.fill();
}
/** markings + the bridge + battlements + breaches of a route arena (after the shared texture, inside the floor clip) */
export function routeMarks(g, A) {
  const B = OPS_BIOME[A.biome], T = OPS_TYPE.mobile, br = BR(A), C = CART_COL[A.biome];
  // the bridge: planks / ice / basalt slabs over the void
  if (br >= 0) {
    const a = A.path[br], b = A.path[br + 1], an = Math.atan2(b.y - a.y, b.x - a.x), L = Math.hypot(b.x - a.x, b.y - a.y), R = A.pathR[br];
    g.save(); g.translate(a.x, a.y); g.rotate(an);
    g.fillStyle = B.voidc; g.fillRect(0, -R - 4, L, R * 2 + 8);
    const plank = { wilds: ['#9a6a3a', '#7a5028'], dunes: ['#c89a5a', '#a87a3a'], frost: ['#bfe6ff', '#9fd0f0'], ember: ['#5a4a46', '#463834'], rift: ['#4a3c7a', '#362a5c'] }[A.biome];
    for (let x = -10, i = 0; x < L + 10; x += 46, i++) { rrectG(g, x, -R + 18, 40, R * 2 - 36, 6); g.fillStyle = plank[i % 2]; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); if (A.biome === 'ember') { g.fillStyle = 'rgba(255,120,40,.5)'; g.fillRect(x + 4, -2, 32, 4); } }
    for (const sy of [-1, 1]) { g.fillStyle = A.biome === 'frost' ? '#e6f6ff' : '#5a3c22'; g.fillRect(-10, sy * (R - 14) - 4, L + 20, 8); for (let x = 0; x <= L; x += 115) { rrectG(g, x - 8, sy * (R - 14) - 12, 16, 24, 4); g.fillStyle = shade(B.wall, 10); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); } }
    g.restore();
  }
  // the route line + the hack pads + the final plaza
  g.strokeStyle = T.col; g.globalAlpha = 0.3; g.lineWidth = 10; g.setLineDash([46, 34]); g.beginPath(); A.path.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.stroke(); g.setLineDash([]);
  g.globalAlpha = 0.55;
  for (const H of A.hacks) { hexG(g, H.x, H.y, H.r); g.fillStyle = 'rgba(77,232,255,.14)'; g.fill(); g.lineWidth = 8; g.strokeStyle = T.col; g.stroke(); hexG(g, H.x, H.y, H.r * 0.55); g.lineWidth = 4; g.stroke(); }
  const F = A.final; g.lineWidth = 10; g.strokeStyle = '#ff3b6b'; for (const r of [F.r, F.r * 1.7]) { g.beginPath(); g.arc(F.x, F.y, r, 0, TAU); g.stroke(); }
  for (let i = 0; i < 12; i++) { const an = i * TAU / 12; g.beginPath(); g.moveTo(F.x + Math.cos(an) * F.r, F.y + Math.sin(an) * F.r); g.lineTo(F.x + Math.cos(an) * F.r * 1.7, F.y + Math.sin(an) * F.r * 1.7); g.lineWidth = 5; g.stroke(); }
  g.globalAlpha = 1; void C;
}
/** battlements / cliff rocks round a route + the wall breaches (outside the floor clip) */
export function routeRim(g, A) {
  const B = OPS_BIOME[A.biome], br = BR(A), P = A.path;
  for (let i = 0; i < P.length - 1; i++) {
    if (i === br) continue;
    const a = P[i], b = P[i + 1], R = A.pathR[i] + 30, L = Math.hypot(b.x - a.x, b.y - a.y);
    const pts = [];
    if (L < 1) for (let k = 0; k < Math.round(TAU * R / 110); k++) { const an = k * 110 / R; pts.push([a.x + Math.cos(an) * R, a.y + Math.sin(an) * R]); }
    else { const an = Math.atan2(b.y - a.y, b.x - a.x), nx = -Math.sin(an), ny = Math.cos(an); for (let s = 0; s <= L; s += 110) for (const sd of [-1, 1]) pts.push([a.x + Math.cos(an) * s + nx * R * sd, a.y + Math.sin(an) * s + ny * R * sd]); for (let k = 1; k < 6; k++) for (const [o, s0] of [[b, an], [a, an + Math.PI]]) { const aa = s0 - Math.PI / 2 + k * Math.PI / 6; pts.push([o.x + Math.cos(aa) * R, o.y + Math.sin(aa) * R]); } }
    for (const [x, y] of pts) { if (inArenaFloor(A, x, y, -8)) continue; rrectG(g, x - 15, y - 15, 30, 30, 5); g.fillStyle = shade(B.wall, 20); g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); }
  }
  (A.spawns || []).forEach((s, i) => { if (i % 3) return; const q = routeAt(A, s.s), nx = s.x - q.x, ny = s.y - q.y, d = Math.hypot(nx, ny) || 1, R = A.pathR[q.leg]; g.beginPath(); g.ellipse(q.x + nx / d * (R + 6), q.y + ny / d * (R + 6), 42, 28, Math.atan2(ny, nx) + Math.PI / 2, 0, TAU); g.fillStyle = 'rgba(20,10,20,.7)'; g.fill(); });
}
/** the stronghold's static dressing: trap grates / jet nozzles, the pylon daises, the champion's ring (inside the floor clip) */
export function assaultMarks(g, A) {
  const B = OPS_BIOME[A.biome], tc = TRAP_COL[A.biome];
  for (const T of A.traps) {
    if (T.k === 'line') { g.globalAlpha = 0.35; g.fillStyle = INK; g.fillRect(T.x, T.y - T.w / 2, T.len, T.w); g.globalAlpha = 0.5; g.strokeStyle = tc[0]; g.lineWidth = 3; g.setLineDash([18, 14]); g.beginPath(); g.moveTo(T.x, T.y); g.lineTo(T.x + T.len, T.y); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
    else { g.beginPath(); g.arc(T.x, T.y, T.r, 0, TAU); g.fillStyle = 'rgba(30,24,36,.55)'; g.fill(); g.lineWidth = 6; g.strokeStyle = shade(B.wall, 30); g.stroke(); g.save(); g.clip(); g.strokeStyle = 'rgba(20,12,24,.6)'; g.lineWidth = 5; for (let x = -T.r; x <= T.r; x += 22) { g.beginPath(); g.moveTo(T.x + x, T.y - T.r); g.lineTo(T.x + x, T.y + T.r); g.stroke(); } g.restore(); }
  }
  for (const q of A.pylons) { g.beginPath(); g.arc(q.x, q.y, 70, 0, TAU); g.fillStyle = shade(B.wall, 25); g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke(); g.globalAlpha = 0.5; g.lineWidth = 4; g.strokeStyle = '#ff5a4a'; g.beginPath(); g.arc(q.x, q.y, 56, 0, TAU); g.stroke(); g.globalAlpha = 1; }
  const C = A.champAt; g.globalAlpha = 0.45; g.strokeStyle = '#ffcf3a'; g.lineWidth = 9; g.beginPath(); g.arc(C.x, C.y, 300, 0, TAU); g.stroke(); g.setLineDash([24, 20]); g.beginPath(); g.arc(C.x, C.y, 230, 0, TAU); g.lineWidth = 5; g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
}
/** the jet nozzles on the walls (outside the clip) */
export function assaultRim(g, A) {
  for (const T of A.traps) if (T.k === 'line') for (const x of [T.x - 6, T.x + T.len + 6]) { rrectG(g, x - 18, T.y - 26, 36, 52, 8); g.fillStyle = '#4a4252'; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); circle(g, x, T.y, 10, TRAP_COL[A.biome][0], 3); }
}
function rrectG(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function hexG(g, x, y, r) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + Math.PI / 6; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8); } g.closePath(); }

// ------------------------------------------------------------------ live: Mobile Defense
function drawHole(ctx, h, i, B, lite) {
  const n = 14;
  ctx.beginPath(); for (let k = 0; k < n; k++) { const an = k * TAU / n, rr = h.r * (0.9 + 0.16 * hash(i * 31 + k)); ctx.lineTo(h.x + Math.cos(an) * rr, h.y + Math.sin(an) * rr * 0.92); } ctx.closePath();
  ctx.fillStyle = B.voidc; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = shade(B.floor[0], -60); ctx.stroke();
  if (!lite) { ctx.save(); ctx.clip(); ctx.globalAlpha = 0.5; ctx.fillStyle = B.accent; for (let k = 0; k < 5; k++) { const an = hash(i * 7 + k) * TAU, rr = h.r * 0.7 * hash(k + i), y = (nowS() * 30 + k * 40) % (h.r * 2); ctx.fillRect(h.x + Math.cos(an) * rr, h.y - h.r + y, 3, 3); } ctx.restore(); }
}
export function drawMobileUnder(ctx, A, V, t, lite, sim, local) {
  BIOME = A.biome;
  const B = OPS_BIOME[A.biome], T = OPS_TYPE.mobile, M = OPS.mobile, N = OPS_MOBILE[A.biome];
  // the collapsed floor
  (V.ho || []).forEach((h, i) => drawHole(ctx, { x: h[0], y: h[1], r: h[2] }, i, B, lite));
  // the hack consoles (a pylon at each hack point; done = green)
  A.hacks.forEach((H, i) => {
    const done = i < (V.done | 0), act = V.ms === 'hack' && V.i === i, col = done ? '#7dffb0' : act ? T.col : '#8d8597', x = H.x + 150, y = H.y - 120;
    ctx.beginPath(); ctx.ellipse(x, y + 6, 34, 14, 0, 0, TAU); ctx.fillStyle = 'rgba(20,12,24,.35)'; ctx.fill();
    rrect(ctx, x - 20, y - 84, 40, 88, 8); ctx.fillStyle = '#5c5468'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 118 + Math.sin(t * 3 + i) * 4); ctx.lineTo(x + 14, y - 96); ctx.lineTo(x, y - 74); ctx.lineTo(x - 14, y - 96); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    label(ctx, `${N.hack.toUpperCase()} ${i + 1}`, x, y + 26, 13, done ? '#7dffb0' : '#ffffff', 4);
    if (act) { ctx.save(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 9); ctx.lineWidth = 5; ctx.strokeStyle = V.jam ? '#ff5e5b' : T.col; ctx.setLineDash([12, 10]); ctx.lineDashOffset = -t * 80; ctx.beginPath(); ctx.moveTo(x, y - 96); ctx.lineTo(V.cx, V.cy - 70); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
  });
  // the route guide: chevrons from the carrier to its next stop
  if (V.st === 'run' && V.ms === 'move') {
    const tgt = V.i < 2 ? A.hackS[V.i] : A.finalS;
    ctx.save(); ctx.globalAlpha = 0.65; ctx.fillStyle = T.col;
    for (let s = (V.cs || 0) + 120 - ((t * 120) % 90); s < tgt; s += 90) { const q = routeAt(A, s); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.ang); ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -14); ctx.lineTo(-2, 0); ctx.lineTo(-8, 14); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.restore();
  }
  const cx = V.cx, cy = V.cy;
  // the escort ring / the hack ring
  if (V.st === 'run') {
    if (V.ms === 'hack') {
      const f = clamp01((V.hk || 0) / Math.max(1, V.hn || 1));
      ctx.save(); ctx.globalAlpha = 0.14 + 0.06 * Math.sin(t * 4); circle(ctx, cx, cy, M.hackR, V.jam ? '#ff5e5b' : T.col, 0); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, M.hackR, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = V.jam ? '#ff5e5b' : T.col; ctx.setLineDash([18, 12]); ctx.lineDashOffset = -t * 50; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(cx, cy, M.hackR + 14, -Math.PI / 2, -Math.PI / 2 + f * TAU); ctx.lineWidth = 12; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = V.jam ? '#ff5e5b' : T.col; ctx.stroke(); ctx.restore();
    } else if (V.ms === 'move') {
      ctx.save(); ctx.globalAlpha = V.mv ? 0.28 : 0.5 + 0.3 * Math.sin(t * 8); ctx.setLineDash([8, 14]); ctx.lineDashOffset = t * 30; ctx.beginPath(); ctx.arc(cx, cy, M.escortR, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = V.mv ? T.col : '#ffcf4a'; ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }
  }
  // the boss's drain tether + break meter
  if (V.dk >= 0 && sim && sim.enemyById) {
    const b = sim.enemyById.get(V.bid);
    if (b && !b.dead) {
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#ff3b6b'; ctx.lineWidth = 10; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(b.x, b.y - 40);
      for (let k = 1; k <= 8; k++) { const f = k / 8; ctx.lineTo(b.x + (cx - b.x) * f + (k < 8 ? Math.sin(t * 30 + k) * 12 : 0), b.y - 40 + (cy - 60 - b.y + 40) * f + (k < 8 ? Math.cos(t * 27 + k) * 12 : 0)); }
      ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 3; ctx.strokeStyle = '#ffd0dc'; ctx.stroke(); ctx.restore();
      const bw = 150, bx = b.x - bw / 2, by = b.y - b.r - 110;
      rrect(ctx, bx - 3, by - 3, bw + 6, 20, 8); ctx.fillStyle = INK; ctx.fill(); rrect(ctx, bx, by, bw * clamp01(V.dk), 14, 6); ctx.fillStyle = '#ffd23f'; ctx.fill();
      label(ctx, 'BREAK THE DRAIN!', b.x, by - 10, 15, Math.sin(t * 12) > 0 ? '#ffd23f' : '#ffffff', 4);
    }
  }
  // the hunter's mark (a reticle on the marked hero)
  if (V.hm && sim && sim.players) { const p = sim.players.get(V.hm); if (p && !p.dead) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 1.6); ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 4; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.stroke(); for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(56, 0); ctx.stroke(); } ctx.restore(); if (local && p.id === local.id) label(ctx, 'MARKED', p.x, p.y + 64, 13, '#ff8a8a', 4); } }
}
/** the carrier (y-sorted prop): per-biome body, wheels / runners / treads, the core, its HP ring, the jam sparks */
export function drawCart(ctx, A, V, t) {
  const C = CART_COL[A.biome], x = V.cx, y = V.cy, q = routeAt(A, V.cs || 0), dir = Math.cos(q.ang) < 0 ? -1 : 1, mv = V.mv === 1 && V.ms === 'move', hp = clamp01((V.hp || 0) / OPS.mobile.cartHp), N = OPS_MOBILE[A.biome];
  const bob = mv ? Math.sin(t * 10) * 2 : 0, jam = V.jam && Math.sin(t * 14) > 0;
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.ellipse(0, 6, 78, 24, 0, 0, TAU); ctx.fillStyle = 'rgba(20,12,24,.4)'; ctx.fill();
  ctx.scale(dir, 1); ctx.translate(0, bob);
  // the running gear
  if (A.biome === 'frost') { for (const sy of [0]) { ctx.beginPath(); ctx.moveTo(-70, sy); ctx.lineTo(62, sy); ctx.quadraticCurveTo(84, sy, 80, sy - 18); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#e6f6ff'; ctx.stroke(); } }
  else if (A.biome === 'ember') { rrect(ctx, -70, -18, 140, 26, 12); ctx.fillStyle = '#2a2220'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); for (let k = 0; k < 7; k++) { const ox = ((k * 20 + (mv ? t * 60 : 0)) % 140) - 70; ctx.fillStyle = '#6a5a56'; ctx.fillRect(ox, -16, 6, 22); } }
  else { for (const wx of [-44, 44]) { ctx.save(); ctx.translate(wx, -6); ctx.rotate(mv ? t * 6 : 0); circle(ctx, 0, 0, 17, shade(C[0], -30), 4); ctx.strokeStyle = INK; ctx.lineWidth = 3; for (let k = 0; k < 3; k++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke(); } ctx.restore(); } }
  // the body
  ctx.beginPath(); ctx.moveTo(-74, -20); ctx.lineTo(74, -20); ctx.lineTo(62, -62); ctx.lineTo(-62, -62); ctx.closePath(); ctx.fillStyle = C[0]; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-60, -58, 120, 8);
  ctx.strokeStyle = 'rgba(20,12,24,.35)'; ctx.lineWidth = 3; for (const lx of [-30, 0, 30]) { ctx.beginPath(); ctx.moveTo(lx, -24); ctx.lineTo(lx, -58); ctx.stroke(); }
  // the biome topper
  if (A.biome === 'dunes') { ctx.beginPath(); ctx.moveTo(-8, -62); ctx.lineTo(-8, -150); ctx.lineWidth = 6; ctx.strokeStyle = '#6a4a28'; ctx.stroke(); ctx.beginPath(); ctx.moveTo(-4, -146); ctx.quadraticCurveTo(46 + Math.sin(t * 2) * 6, -120, -4, -78); ctx.closePath(); ctx.fillStyle = C[2]; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
  if (A.biome === 'ember') { rrect(ctx, 30, -100, 22, 40, 4); ctx.fillStyle = '#3a2e2c'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); for (let k = 0; k < 3; k++) { const ph = (t * 0.8 + k / 3) % 1; ctx.globalAlpha = 0.5 * (1 - ph); circle(ctx, 41 + ph * 10, -104 - ph * 60, 6 + ph * 12, '#8a7a76', 0); } ctx.globalAlpha = 1; }
  if (A.biome === 'wilds') { for (const lx of [-40, 40]) { ctx.beginPath(); ctx.ellipse(lx, -70, 16, 8, lx < 0 ? -0.5 : 0.5, 0, TAU); ctx.fillStyle = '#4f9a3a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); } }
  // the core
  const cy2 = -94 + Math.sin(t * 2.6) * 5, col = jam ? '#ff5e5b' : V.hp < 35 ? '#ff8a6a' : C[1];
  ctx.save(); ctx.globalAlpha = 0.35; circle(ctx, 0, cy2, 34, col, 0); ctx.restore();
  ctx.beginPath(); ctx.moveTo(0, cy2 - 30); ctx.lineTo(20, cy2); ctx.lineTo(0, cy2 + 26); ctx.lineTo(-20, cy2); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, cy2 - 30); ctx.lineTo(7, cy2); ctx.lineTo(0, cy2 + 26); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fill();
  if (V.jam) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; for (let k = 0; k < 4; k++) { const an = t * 9 + k * 1.7; ctx.beginPath(); ctx.moveTo(Math.cos(an) * 24, cy2 + Math.sin(an) * 24); ctx.lineTo(Math.cos(an) * 40, cy2 + Math.sin(an) * 40 + 6); ctx.stroke(); } }
  ctx.restore();
  // HP ring + name
  const ry = y - 150;
  rrect(ctx, x - 62, ry - 6, 124, 14, 6); ctx.fillStyle = INK; ctx.fill(); rrect(ctx, x - 60, ry - 4, 120 * hp, 10, 4); ctx.fillStyle = V.hp < 35 ? '#ff5e5b' : C[1]; ctx.fill();
  label(ctx, V.jam ? 'JAMMED! REBOOT' : N.cart.toUpperCase(), x, ry - 14, V.jam ? 16 : 13, V.jam ? (jam ? '#ff5e5b' : '#ffffff') : '#ffffff', 4);
  if (V.st === 'run' && V.ms === 'move' && !V.mv) label(ctx, 'ESCORT IT: STAY CLOSE', x, y + 50, 14, '#ffcf4a', 4);
  else if (V.ms === 'move' && V.mv === 2) label(ctx, 'SLOWED: CLEAR THE CROWD', x, y + 50, 13, '#ff8a6a', 4);
}

// ------------------------------------------------------------------ live: Assault
export function drawAssaultUnder(ctx, A, V, t, lite) {
  BIOME = A.biome;
  const T = OPS_TYPE.assault, py = V.py || [];
  A.gates.forEach((gy, i) => {
    const closed = V.gy != null && i >= V.s; if (!closed) return;
    const x0 = A.cx - A.R, x1 = A.cx + A.R, cur = i === V.s, shield = i === 0 && py.some((v) => v > 0);
    ctx.save(); ctx.globalAlpha = cur ? 0.8 : 0.45;
    if (!lite) { const gr = ctx.createLinearGradient(0, gy - 34, 0, gy + 34); gr.addColorStop(0, 'rgba(255,90,74,0)'); gr.addColorStop(0.5, shield ? '#ff8a6a' : cur ? '#ff5a4a' : '#9a4a4a'); gr.addColorStop(1, 'rgba(255,90,74,0)'); ctx.fillStyle = gr; } else ctx.fillStyle = 'rgba(255,90,74,.5)';
    ctx.fillRect(x0, gy - 34, x1 - x0, 68);
    ctx.strokeStyle = '#ffd0c8'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = x0; x <= x1; x += 24) { const yy = gy + Math.sin(x * 0.05 + t * 8) * 10; if (x === x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); } ctx.stroke();
    if (shield && !lite) { ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 5); for (let x = x0; x < x1; x += 60) { ctx.beginPath(); for (let k = 0; k < 6; k++) { const an = k * TAU / 6; ctx.lineTo(x + 30 + Math.cos(an) * 26, gy + Math.sin(an) * 26); } ctx.closePath(); ctx.lineWidth = 2; ctx.stroke(); } }
    ctx.restore();
    // the portcullis bars
    ctx.save(); ctx.globalAlpha = cur ? 0.9 : 0.5; for (let x = x0 + 30; x < x1; x += 54) { rrect(ctx, x - 5, gy - 50, 10, 64, 3); ctx.fillStyle = '#5a5262'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); } ctx.restore();
    if (cur) label(ctx, i === 0 && shield ? `SHIELDED · BREAK ${py.filter((v) => v > 0).length} PYLON${py.filter((v) => v > 0).length === 1 ? '' : 'S'}` : i === 2 ? 'SEALED · DEFEAT THE CHAMPION' : `GATE ${i + 1} · ${V.left} LEFT`, A.cx, gy + 62, 18, '#ffd0c8', 5);
  });
  // shield beams: each live pylon feeds the first gate
  if (V.s === 0) A.pylons.forEach((q, i) => {
    if (!(py[i] > 0)) return;
    const gx = A.cx + (i - 1) * 180, gy = A.gates[0];
    ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha = 0.22 + 0.1 * Math.sin(t * 7 + i); ctx.lineWidth = 7; // (thinner, quieter beams: the courtyard's telegraphs read over them) ctx.strokeStyle = '#ff5a4a'; ctx.beginPath(); ctx.moveTo(q.x, q.y - 90); ctx.quadraticCurveTo((q.x + gx) / 2, (q.y + gy) / 2 - 120, gx, gy); ctx.stroke(); ctx.globalAlpha = 0.55; ctx.lineWidth = 2; ctx.strokeStyle = '#ffe0d8'; ctx.stroke(); ctx.restore();
  });
  if (V.s === 2 && V.chp > 0) { ctx.save(); ctx.globalAlpha = 0.25 + 0.12 * Math.sin(t * 4); ctx.lineWidth = 8; ctx.strokeStyle = '#ffcf3a'; ctx.beginPath(); ctx.arc(A.champAt.x, A.champAt.y, 300, 0, TAU); ctx.stroke(); ctx.restore(); }
  void T;
}
/** a shield pylon (drawn instead of the enemy art) */
export function drawPylon(ctx, e, t, biome) {
  const B = OPS_BIOME[biome] || OPS_BIOME.wilds, k = clamp01(e.hp / Math.max(1, e.maxHp)), fy = e.y - 100 + Math.sin(t * 2 + e.id) * 6, cast = e.state === 'cast';
  ctx.save();
  ctx.beginPath(); ctx.ellipse(e.x, e.y + 6, 50, 18, 0, 0, TAU); ctx.fillStyle = 'rgba(20,12,24,.4)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(e.x - 34, e.y + 4); ctx.lineTo(e.x - 22, e.y - 66); ctx.lineTo(e.x + 22, e.y - 66); ctx.lineTo(e.x + 34, e.y + 4); ctx.closePath(); ctx.fillStyle = shade(B.wall, 30); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = '#ff5a4a'; ctx.globalAlpha = 0.8; ctx.fillRect(e.x - 26, e.y - 40, 52, 5); ctx.globalAlpha = 1;
  ctx.globalAlpha = 0.3 + (cast ? 0.3 : 0); circle(ctx, e.x, fy, 46, '#ff5a4a', 0); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.moveTo(e.x, fy - 40); ctx.lineTo(e.x + 22, fy); ctx.lineTo(e.x, fy + 34); ctx.lineTo(e.x - 22, fy); ctx.closePath(); ctx.fillStyle = e.flash > 0 ? '#ffffff' : k < 0.35 ? '#ff8a6a' : '#ff5a4a'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(e.x, fy - 40); ctx.lineTo(e.x + 7, fy); ctx.lineTo(e.x, fy + 34); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fill();
  if (k < 0.66) { ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(e.x - 8, fy - 18); ctx.lineTo(e.x + 3, fy - 2); ctx.lineTo(e.x - 5, fy + 12); if (k < 0.33) { ctx.moveTo(e.x + 10, fy - 26); ctx.lineTo(e.x + 4, fy - 10); } ctx.stroke(); }
  ctx.strokeStyle = '#ffd0c8'; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.7; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(e.x, fy, 40 + i * 10, 12 + i * 4, 0, t * (2 + i) , t * (2 + i) + 4); ctx.stroke(); }
  ctx.restore();
  const bw = 90; rrect(ctx, e.x - bw / 2 - 2, e.y - 168, bw + 4, 12, 5); ctx.fillStyle = INK; ctx.fill(); rrect(ctx, e.x - bw / 2, e.y - 166, bw * k, 8, 4); ctx.fillStyle = '#ff5a4a'; ctx.fill();
}

// ------------------------------------------------------------------ telegraphs (missionfx.drawOpsArea delegates the part-2 kinds)
const k01 = (a) => Math.min(1, (a.t || 0) / Math.max(1, a.delay || 1));
function lineArea(ctx, a, fill, edge, k, lite, fade = 1) {
  ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.ang || 0);
  ctx.globalAlpha = (0.16 + 0.2 * k) * fade; ctx.fillStyle = fill; ctx.fillRect(0, -a.w / 2, a.len, a.w);
  ctx.globalAlpha = 0.9 * fade; ctx.lineWidth = fade < 1 ? 2.5 : 4; ctx.strokeStyle = edge; ctx.strokeRect(0, -a.w / 2, a.len, a.w);
  ctx.globalAlpha = 0.45 * fade; ctx.fillStyle = edge; ctx.fillRect(0, -a.w / 2, a.len * k, a.w);
  ctx.restore(); void lite;
}
/** trap telegraphs: full strength only near the hero and close to firing; far / just-armed ones are faint outlines
 *  (the Assault trap hall and courtyard stack many: only the ones that matter now stand out) */
export function trapFade(a, k) {
  let d = 0;
  if (FOCUS) {
    if (a.shape === 'line') { const c = Math.cos(a.ang || 0), s = Math.sin(a.ang || 0), dx = FOCUS.x - a.x, dy = FOCUS.y - a.y, al = Math.max(0, Math.min(a.len, dx * c + dy * s)); d = Math.max(0, Math.hypot(dx - c * al, dy - s * al) - a.w / 2); }
    else d = Math.max(0, Math.hypot(FOCUS.x - a.x, FOCUS.y - a.y) - (a.r || 0));
  }
  const near = d < 260 ? 1 : d > 640 ? 0 : 1 - (d - 260) / 380;
  const soon = k > 0.6 ? (k - 0.6) / 0.4 : 0; // (about to fire: comes up even far away, to 65%)
  return 0.28 + 0.72 * Math.max(near, soon * 0.5);
}
export function drawOpsArea2(ctx, a, t, lite) {
  const kd = a.kind, k = k01(a);
  switch (kd) {
    case 'oamb': { // a wall cracking open (packs burst out)
      ctx.save(); ctx.globalAlpha = 0.2 + 0.25 * k; circle(ctx, a.x, a.y, a.r, '#ff5e5b', 0); ctx.globalAlpha = 0.95; ctx.lineWidth = 4; ctx.strokeStyle = '#ff5e5b'; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 40; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + a.id; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + Math.cos(an) * a.r * k, a.y + Math.sin(an) * a.r * k * 0.8); ctx.stroke(); }
      ctx.restore(); label(ctx, 'AMBUSH!', a.x, a.y - a.r - 10, 15, '#ff8a8a', 4); return true;
    }
    case 'ocollapse': case 'ocrumble': { // the floor about to fall away
      ctx.save(); ctx.globalAlpha = 0.18 + 0.32 * k; circle(ctx, a.x, a.y, a.r, kd === 'ocollapse' ? '#ff7a2a' : '#ffb03a', 0);
      ctx.globalAlpha = 0.95; ctx.lineWidth = 5; ctx.strokeStyle = Math.sin(t * 16) > 0 ? '#ffd23f' : '#ff5e2b'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 3.5; for (let i = 0; i < 7; i++) { const an = hash(i + a.id) * TAU; ctx.beginPath(); ctx.moveTo(a.x + Math.cos(an) * a.r * 0.1, a.y + Math.sin(an) * a.r * 0.1); ctx.lineTo(a.x + Math.cos(an + 0.2) * a.r * (0.3 + 0.6 * k), a.y + Math.sin(an + 0.2) * a.r * (0.3 + 0.6 * k)); ctx.stroke(); }
      ctx.restore(); if (kd === 'ocollapse' && a.r > 200) label(ctx, 'COLLAPSING!', a.x, a.y, 18, '#ffd23f', 5); return true;
    }
    case 'ovolley': lineArea(ctx, a, '#ff3b3b', '#ff8a6a', k, lite); { ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.ang || 0); ctx.fillStyle = '#ffd0c8'; for (let x = 40; x < a.len; x += 70) { ctx.beginPath(); ctx.moveTo(x + 16, 0); ctx.lineTo(x, -9); ctx.lineTo(x, 9); ctx.closePath(); ctx.fill(); } ctx.restore(); } return true;
    case 'obeam': lineArea(ctx, a, '#ff9a3a', '#ffd23f', k, lite); return true;
    case 'orune': { lineArea(ctx, a, '#b04aff', '#e0b0ff', k, lite); ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.ang || 0); ctx.strokeStyle = '#f0d8ff'; ctx.lineWidth = 2.5; for (let x = 60; x < a.len; x += 110) { ctx.beginPath(); ctx.arc(x, 0, 14, 0, TAU); ctx.moveTo(x - 10, -10); ctx.lineTo(x + 10, 10); ctx.stroke(); } ctx.restore(); return true; }
    case 'owhirl': { const on = a.t >= a.delay; ctx.save(); ctx.globalAlpha = on ? 0.35 : 0.15 + 0.2 * k; circle(ctx, a.x, a.y, a.r, '#ffcf3a', 0); ctx.globalAlpha = 0.9; ctx.lineWidth = 5; ctx.strokeStyle = '#ffcf3a'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(a.x, a.y, a.r * (0.5 + i * 0.25), t * 9 + i * 2, t * 9 + i * 2 + 2.2); ctx.stroke(); } ctx.restore(); return true; }
    case 'otrap_line': case 'otrap_circle': return drawTrapArea(ctx, a, t, k, lite);
  }
  return false;
}
function drawTrapArea(ctx, a, t, k, lite) {
  const [c1, c2] = TRAP_COL[BIOME] || TRAP_COL.wilds, fd = trapFade(a, k);
  if (a.shape === 'line') {
    lineArea(ctx, a, c1, c2, k, lite, fd);
    ctx.save(); ctx.translate(a.x, a.y); ctx.globalAlpha = 0.9 * fd; ctx.fillStyle = c2;
    if (!lite && fd > 0.6) for (let x = 20; x < a.len; x += 60) { const h = 6 + 10 * k * hash(x + a.id); ctx.beginPath(); ctx.moveTo(x - 6, 4); ctx.lineTo(x, -h); ctx.lineTo(x + 6, 4); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  } else {
    ctx.save(); ctx.globalAlpha = (0.2 + 0.3 * k) * fd; circle(ctx, a.x, a.y, a.r, c1, 0); ctx.globalAlpha = 0.95 * fd; ctx.lineWidth = fd < 1 ? 2.5 : 4; ctx.strokeStyle = c2; ctx.setLineDash([9, 7]); ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(a.x, a.y, a.r * (1 - 0.8 * k), 0, TAU); ctx.stroke();
    if (BIOME === 'frost') { const iy = a.y - 400 * (1 - k) * (1 - k) - 30; ctx.globalAlpha = 1; ctx.beginPath(); ctx.moveTo(a.x - 14, iy - 44); ctx.lineTo(a.x + 14, iy - 44); ctx.lineTo(a.x, iy + 20); ctx.closePath(); ctx.fillStyle = '#dff6ff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
    ctx.restore();
  }
  return true;
}

// ------------------------------------------------------------------ HUD
const TRACK_W = 250;
function dot(ctx, x, y, on, cur, col) { circle(ctx, x, y, cur ? 8 : 6, on ? '#7dffb0' : cur ? col : 'rgba(255,255,255,.18)', 2.5); }
/** the left objective panel for Mobile Defense / Assault */
export function drawTracker2(ctx, A, V, p, w, h, txt, bar, t, keyLabel) {
  if (!V || V.st === 'intro' || V.st === 'results') return;
  const x = 14, T = OPS_TYPE[A.type], lines = [];
  let y = Math.min(h * 0.28, 196);
  if (A.type === 'mobile') {
    const N = OPS_MOBILE[A.biome];
    if (V.ms === 'hack') lines.push([V.jam ? `JAMMED! ${keyLabel('interact')} at the ${N.cart}` : `Hold the ring: hack ${Math.round(clamp01(V.hk / Math.max(1, V.hn)) * 100)}%`, V.jam ? '#ff8a8a' : '#ffffff']);
    else if (V.ms === 'boss') lines.push([`Slay ${V.bn || 'the boss'}`, '#ffb0c8'], [V.dk >= 0 ? 'HIJACK! Hit it hard or stun it' : 'Protect the carrier', V.dk >= 0 ? '#ffd23f' : '#ffffff']);
    else lines.push([V.mv ? `Escort the ${N.cart}` : `Stay close: the ${N.cart} stopped`, V.mv ? '#ffffff' : '#ffcf4a']);
    if (V.hu > 0) lines.push([`Hunter squad: ${V.hu} left${V.hm === p.id ? ' · YOU ARE MARKED' : ''}`, '#ff8a8a']); else if (V.hd) lines.push(['Hunter squad down', '#7dffb0']);
  } else {
    const N = OPS_ASSAULT[A.biome], s = V.s | 0;
    lines.push([N.rooms[Math.min(3, s)], '#ffd0c8']);
    lines.push([s === 0 ? `Break the pylons: ${(V.py || []).filter((v) => v > 0).length}/3 up` : s === 1 ? `Clear the hall: ${V.left} left` : s === 2 ? `Defeat ${V.chn || 'the champion'}` : `Defeat ${V.bn || 'the Gatekeeper'}`, '#ffffff']);
    if (s >= 1 && s <= 2) lines.push(['Traps hit enemies too: lure them', '#d8d0e2']);
  }
  const rowH = 19, panelH = 66 + lines.length * rowH + (A.type === 'mobile' ? 26 : 8);
  ctx.save(); rrect(ctx, x, y, TRACK_W, panelH, 12); ctx.fillStyle = 'rgba(28,20,40,.72)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = T.col; ctx.fillRect(x + 3, y + 3, 5, panelH - 6); ctx.restore();
  txt(ctx, 'OBJECTIVE', x + 18, y + 20, 15, T.col, 'left', 3);
  if (V.mods && V.mods.length) txt(ctx, V.mods.map((k) => (WEEKLY[k] ? WEEKLY[k].name : k)).join(' · '), x + TRACK_W - 10, y + 19, 11, '#ffe7a0', 'right', 3);
  // stage / room dots
  const n = A.type === 'mobile' ? 3 : 4, cur = A.type === 'mobile' ? (V.i | 0) : (V.s | 0);
  for (let i = 0; i < n; i++) { const dx = x + 26 + i * 30; if (i) { ctx.fillStyle = i <= cur ? '#7dffb0' : 'rgba(255,255,255,.18)'; ctx.fillRect(dx - 22, y + 37, 14, 3); } dot(ctx, dx, y + 38, i < cur, i === cur, T.col); }
  txt(ctx, A.type === 'mobile' ? `STAGE ${Math.min(3, cur + 1)}/3` : `ROOM ${Math.min(4, cur + 1)}/4`, x + TRACK_W - 12, y + 43, 12.5, '#ffffff', 'right', 3);
  let yy = y + 64;
  for (const [s, c] of lines) { txt(ctx, s, x + 18, yy, 13.5, c, 'left', 3); yy += rowH; }
  if (A.type === 'mobile') bar(ctx, x + 16, yy - 6, TRACK_W - 32, 16, clamp01((V.hp || 0) / OPS.mobile.cartHp), V.hp < 35 ? '#ff5e5b' : T.col, `CARRIER ${V.hp}%`);
}
/** the top-centre objective lines (+ boss bars); returns { y, obj } */
export function hud2(ctx, A, V, p, w, y, txt, bar, t, keyLabel) {
  const cx = w / 2, bw = Math.min(560, w * 0.5), bx = cx - bw / 2, T = OPS_TYPE[A.type];
  if (A.type === 'mobile') {
    const N = OPS_MOBILE[A.biome];
    if (V.ms === 'boss') {
      bar(ctx, bx, y + 6, bw, 20, V.bhp || 0, '#ff3b6b', String(V.bn || 'BOSS').toUpperCase());
      bar(ctx, bx + bw * 0.2, y + 30, bw * 0.6, 10, clamp01((V.hp || 0) / OPS.mobile.cartHp), V.hp < 35 ? '#ff5e5b' : T.col, '');
      txt(ctx, V.dk >= 0 ? 'HIJACK! Hit it hard or stun it to break the drain' : `Protect the ${N.cart} · charge, quake, pounce, hijack`, cx, y + 58, 14, V.dk >= 0 ? (Math.sin(t * 10) > 0 ? '#ffd23f' : '#ffffff') : '#ffffff', 'center', 3);
      return { y: y + 66, obj: { x: V.cx, y: V.cy } };
    }
    if (V.ms === 'hack') {
      const f = clamp01((V.hk || 0) / Math.max(1, V.hn || 1));
      bar(ctx, bx, y + 6, bw, 18, f, V.jam ? '#ff5e5b' : T.col, `${N.hack.toUpperCase()} ${V.i + 1}/2 · HACK ${Math.round(f * 100)}%`);
      bar(ctx, bx + bw * 0.2, y + 30, bw * 0.6, 10, clamp01((V.hp || 0) / OPS.mobile.cartHp), V.hp < 35 ? '#ff5e5b' : '#c8fbff', '');
      txt(ctx, V.jam ? `JAMMED! ${keyLabel('interact')} at the ${N.cart} to reboot it` : 'Hold the ring: progress only with a hero inside', cx, y + 56, 14, V.jam ? (Math.sin(t * 10) > 0 ? '#ff5e5b' : '#ffffff') : '#ffffff', 'center', 3);
      return { y: y + 64, obj: { x: V.cx, y: V.cy } };
    }
    const tgt = V.i < 2 ? A.hackS[V.i] : A.finalS, s0 = V.i === 0 ? 0 : V.i === 1 ? A.hackS[0] : A.hackS[1];
    bar(ctx, bx, y + 6, bw, 16, clamp01(((V.cs || 0) - s0) / Math.max(1, tgt - s0)), T.col, `STAGE ${V.i + 1}/3 · ${V.i < 2 ? `TO ${N.hack.toUpperCase()} ${V.i + 1}` : 'TO THE FINAL POINT'}`);
    bar(ctx, bx + bw * 0.2, y + 28, bw * 0.6, 10, clamp01((V.hp || 0) / OPS.mobile.cartHp), V.hp < 35 ? '#ff5e5b' : '#c8fbff', '');
    txt(ctx, !V.mv ? `Stay near the ${N.cart} to move it` : V.mv === 2 ? `Slowed: clear the enemies round the ${N.cart}` : `Escorting the ${N.cart} · ${V.hp}%`, cx, y + 54, 14, !V.mv ? '#ffcf4a' : V.mv === 2 ? '#ff8a6a' : '#ffffff', 'center', 3);
    return { y: y + 62, obj: { x: V.cx, y: V.cy } };
  }
  const s = V.s | 0, N = OPS_ASSAULT[A.biome];
  if (s >= 3 && V.bn) { bar(ctx, bx, y + 6, bw, 20, V.bhp || 0, T.col, V.bn.toUpperCase()); txt(ctx, 'Hammer combo · ripple quake · sweeping beams · rune cross · wardens at 66% / 33%', cx, y + 46, 13.5, '#ffffff', 'center', 3); return { y: y + 54, obj: A.bossAt }; }
  if (s === 2) { bar(ctx, bx + bw * 0.1, y + 6, bw * 0.8, 18, V.chp || 0, '#ffcf3a', String(V.chn || 'CHAMPION').toUpperCase()); txt(ctx, `${N.rooms[2]} · cleave, leap slam, whirlwind under 50%`, cx, y + 44, 13.5, '#ffffff', 'center', 3); return { y: y + 52, obj: A.champAt }; }
  if (s === 0) {
    const py = V.py || [], up = py.filter((v) => v > 0).length;
    txt(ctx, `${N.rooms[0]} · break the shield pylons: ${up}/3 up`, cx, y + 22, 18, '#ffd0c8', 'center', 4);
    py.forEach((v, i) => { const px = cx - 70 + i * 70; rrect(ctx, px - 26, y + 34, 52, 9, 4); ctx.fillStyle = INK; ctx.fill(); if (v > 0) { rrect(ctx, px - 25, y + 35, 50 * v / 100, 7, 3); ctx.fillStyle = '#ff5a4a'; ctx.fill(); } else txt(ctx, '✓', px, y + 44, 13, '#7dffb0', 'center', 3); });
    let obj = null, bd = Infinity; A.pylons.forEach((q, i) => { if (py[i] > 0) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; obj = q; } } });
    return { y: y + 52, obj };
  }
  txt(ctx, `${N.rooms[1]} · clear the hall: ${V.left} left`, cx, y + 22, 18, '#ffd0c8', 'center', 4);
  txt(ctx, `${N.line}s and ${N.circle}s fire on a cycle: watch the telegraphs`, cx, y + 42, 13.5, '#ffffff', 'center', 3);
  return { y: y + 50, obj: V.left ? null : { x: A.cx, y: A.gates[1] } };
}
/** minimap layers (called inside the minimap transform helpers) */
export function minimap2(ctx, A, V, X, Y, k, T) {
  if (A.type === 'mobile' && V) {
    (V.ho || []).forEach((h) => circle(ctx, X(h[0]), Y(h[1]), Math.max(2, h[2] * k), OPS_BIOME[A.biome].voidc, 0));
    A.hacks.forEach((H, i) => circle(ctx, X(H.x), Y(H.y), 5, i < (V.done | 0) ? '#7dffb0' : i === V.i ? T.col : '#8d8597', 1.5));
    circle(ctx, X(A.final.x), Y(A.final.y), 6, '#ff3b6b', 1.5);
    ctx.save(); ctx.translate(X(V.cx), Y(V.cy)); ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(7, 0); ctx.lineTo(0, 7); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fillStyle = V.jam ? '#ff5e5b' : T.col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  }
  if (A.type === 'assault' && V) {
    A.gates.forEach((gy, i) => { if (V.gy != null && i >= V.s) { ctx.fillStyle = '#ff5a4a'; ctx.fillRect(X(A.cx - A.R), Y(gy) - 1.5, A.R * 2 * k, 3); } });
    if (V.s === 0) A.pylons.forEach((q, i) => { if ((V.py || [])[i] > 0) circle(ctx, X(q.x), Y(q.y), 4.5, '#ff5a4a', 1.5, '#ffd0c8'); });
    if (V.s <= 2) circle(ctx, X(A.champAt.x), Y(A.champAt.y), 4, V.s === 2 ? '#ffcf3a' : 'rgba(255,207,58,.4)', 1.5);
  }
}

// ------------------------------------------------------------------ events
const STREAKS = [];
export function missionEventFx2(fx, ev, me) {
  if (ev.k !== 'mobile' && ev.k !== 'assault') return false;
  const x = ev.x, y = ev.y, has = x != null, T = OPS_TYPE[ev.k], b = ev.b || 'wilds', NM = OPS_MOBILE[b], NA = OPS_ASSAULT[b], lite = !!fx.lite;
  switch (ev.ph) {
    case 'go': if (ev.k === 'mobile') fx.banner(`ESCORT THE ${NM.cart.toUpperCase()}!`, T.col, 'Stay close to move it · 2 hack points, then the final point', 2.4, 46); else fx.banner('RAID THE STRONGHOLD!', T.col, `Break the shield pylons in ${NA.rooms[0]}`, 2.4, 46); return true;
    case 'breach': if (has && !lite) { fx.ring(x, y, 110, '#ff5e5b', 0.45, 6); fx.puffs(x, y, 8, '#3a2a40', 14, 140, 0.6); } return true;
    case 'hack': fx.banner(`${NM.hack.toUpperCase()} ${ev.i + 1}: HOLD THE RING!`, T.col, `${Math.round((ev.t || 0) / 60)} s of hacking · a hero must stay inside`, 2.2, 44); if (has) { fx.ring(x, y, OPS.mobile.hackR, T.col, 0.7, 10); fx.sparks(x, y - 60, -Math.PI / 2, lite ? 8 : 20, '#c8fbff', 360, 1.6); } return true;
    case 'hackElite': if (has) fx.ring(x, y, 160, '#ffcf3a', 0.6, 8); fx.banner('ELITES INBOUND', '#ffcf3a', '', 1.1, 34); return true;
    case 'jam': fx.banner(`THE ${String(ev.name || NM.cart).toUpperCase()} JAMMED!`, '#ff5e5b', 'Reboot it: interact / TAP at the carrier', 2, 44); if (has) { fx.ring(x, y - 60, 140, '#ff5e5b', 0.6, 8); fx.sparks(x, y - 90, 0, lite ? 8 : 20, '#ffd23f', 380, TAU); } fx.shake(0.25); return true;
    case 'reboot': fx.banner('REBOOTED!', '#7dffb0', 'The hack resumes', 1.1, 36); if (has) { fx.ring(x, y - 60, 160, '#7dffb0', 0.6, 9); fx.sparks(x, y - 90, -Math.PI / 2, lite ? 6 : 16, '#c8fbff', 320, 1.6); } return true;
    case 'hacked': fx.banner(`${NM.hack.toUpperCase()} ${ev.i + 1} HACKED`, '#7dffb0', ev.i < 1 ? 'Move out: escort it to the next point' : 'The last stretch: the final point', 2, 44); if (has) fx.ring(x, y, 320, '#7dffb0', 0.8, 10); return true;
    case 'cartHit': if (has && ev.big) { fx.ring(x, y - 60, 120, '#ff5e5b', 0.4, 8); fx.shake(0.25); } else if (has && !lite) fx.ring(x, y - 60, 70, '#ff5e5b', 0.25, 4); return true;
    case 'cartRam': if (has) { fx.sparks(x, y - 60, 0, lite ? 8 : 20, '#ffd0c8', 420, TAU); fx.text(x, y - 170, 'RAMMED!', { color: '#ff5e5b', size: 22 }); } fx.shake(0.5); return true;
    case 'ambush': fx.banner('AMBUSH!', '#ff5e5b', 'They burst from the walls', 1.4, 44); return true;
    case 'ambushHit': for (const [ax, ay] of ev.pts || []) { fx.ring(ax, ay, 150, '#ff5e5b', 0.5, 9); fx.chunks && fx.chunks(ax, ay, lite ? 5 : 12, '#7a6a5a', 300); fx.puffs(ax, ay, 10, '#5a4a40', 18, 200, 0.7); } fx.shake(0.4); return true;
    case 'collapse': fx.banner('THE BRIDGE IS COLLAPSING!', '#ffb03a', 'Get across: anything left on it falls', 2.2, 46); fx.shake(0.4); return true;
    case 'crumble': if (has) fx.text(x, y - 40, 'CRUMBLING!', { color: '#ffd23f', size: 18 }); return true;
    case 'holes': for (const [hx, hy, hr] of ev.pts || []) { fx.chunks && fx.chunks(hx, hy, lite ? 4 : 10, '#8a7a6a', 280); fx.puffs(hx, hy, lite ? 4 : 10, '#c8b8a8', 20, 220, 0.8); if (!lite) fx.ring(hx, hy, hr, '#ffffff', 0.35, 5); } fx.shake(ev.bridge ? 0.7 : 0.3); if (ev.fell && me) fx.text(me.x, me.y - 110, `${ev.fell} fell!`, { color: '#ffd23f', size: 20 }); return true;
    case 'thrown': if (has) fx.ring(x, y, 90, '#ffffff', 0.4, 6); return true;
    case 'hunters': fx.banner(`HUNTER SQUAD: ${String(ev.name || '').toUpperCase()}`, '#ff3b3b', me && ev.pid === me.id ? 'They marked YOU: kite them, or turn and fight' : 'They have marked a hero: protect them', 2.6, 46); if (has) { fx.ring(x, y, 240, '#ff3b3b', 0.8, 10); fx.puffs(x, y, 12, '#3a2a40', 18, 200, 0.7); } fx.shake(0.4); return true;
    case 'mark': if (me && ev.pid === me.id) fx.banner('YOU ARE MARKED!', '#ff3b3b', 'The hunters are coming for you', 1.4, 40); return true;
    case 'volley': return true;
    case 'huntDown': fx.banner('HUNTER SQUAD DOWN!', '#7dffb0', `Bonus loot · ${ev.t || 0} s`, 1.8, 44); if (has) { fx.ring(x, y, 260, '#7dffb0', 0.8, 10); fx.sparks(x, y - 40, -Math.PI / 2, lite ? 12 : 30, '#ffd23f', 420, 2); } return true;
    case 'surge': fx.banner('HAZARD SURGE!', '#ffb03a', 'The map turns on you: hazards strike faster', 1.8, 44); return true;
    case 'surgeEnd': fx.banner('the surge passes', '#d8d0e2', '', 1, 30); return true;
    case 'wayBoss': fx.banner(String(ev.name || 'THE BOSS').toUpperCase(), '#ff3b6b', `It wants the ${ev.cart || 'carrier'}: break its HIJACK drain by hitting it hard or stunning it`, 3, 50); if (has) { fx.ring(x, y, 360, '#ff3b6b', 1, 14); fx.puffs(x, y, 16, '#3a2a40', 22, 240, 0.8); } fx.shake(0.6); return true;
    case 'bossWind': return true;
    case 'bossLeap': if (has) { fx.puffs(ev.x2, ev.y2, lite ? 5 : 12, '#d8c8b8', 18, 220, 0.6); fx.ring(ev.x2, ev.y2, 160, '#ff5e5b', 0.4, 9); } fx.shake(0.35); return true;
    case 'drain': fx.banner('HIJACK!', '#ff3b6b', 'It is draining the carrier: hit it hard or stun it!', 1.8, 44); if (has) fx.ring(x, y - 60, 180, '#ff3b6b', 0.6, 10); return true;
    case 'drainBreak': fx.banner('DRAIN BROKEN!', '#ffd23f', "It's staggered: punish it", 1.4, 42); if (has) { fx.ring(x, y, 220, '#ffd23f', 0.6, 12); fx.sparks(x, y - 40, 0, lite ? 10 : 26, '#fff1a8', 460, TAU); } fx.shake(0.5); return true;
    case 'drainDone': fx.banner('THE CARRIER IS OVERLOADED!', '#ff5e5b', '', 1.2, 36); if (has) fx.add({ type: 'shock', x, y, r0: 40, r1: 230, life: 0.45, color: '#ff5e5b', width: 20 }); fx.shake(0.6); return true;
    case 'adds': if (has) fx.ring(x, y, 260, T.col, 0.6, 8); fx.shake(0.3); return true;
    // ---- Assault
    case 'pylonShot': if (has && !lite) fx.sparks(x, y - 100, ev.ang || 0, 6, '#ffd0c8', 260, 0.6); return true;
    case 'pylon': fx.banner('PYLON DOWN!', '#ffd0c8', ev.left ? `${ev.left} left` : 'The shield falls', 1.2, 40); if (has) { fx.ring(x, y - 60, 200, '#ff5a4a', 0.6, 10); fx.chunks && fx.chunks(x, y - 60, lite ? 6 : 14, '#ff8a6a', 340); fx.sparks(x, y - 100, -Math.PI / 2, lite ? 10 : 26, '#ffd0c8', 420, 2.2); } fx.shake(0.4); return true;
    case 'shieldDown': fx.banner('THE SHIELD FALLS!', '#ffd0c8', 'Gate 1 is open: into the trap hall', 2, 46); if (has) { fx.ring(x, y, 460, '#ff5a4a', 0.8, 14); fx.sparks(x, y, -Math.PI / 2, lite ? 14 : 36, '#ffd0c8', 460, 3); } fx.shake(0.5); return true;
    case 'room': fx.banner(String(ev.name || '').toUpperCase(), '#ffd0c8', ev.i === 1 ? `${NA.line}s + ${NA.circle}s: watch the telegraphs, lure them in` : ev.i === 2 ? 'The champion waits' : ev.i === 3 ? 'The Gatekeeper' : '', 2, 44); return true;
    case 'gate': if (ev.i > 0) fx.banner(`GATE ${ev.i + 1} OPEN`, '#ffd0c8', '', 1.2, 40); // (gate 1: THE SHIELD FALLS says it)
       if (has) { fx.ring(x, y, 420, '#ff5a4a', 0.7, 12); fx.sparks(x, y, -Math.PI / 2, lite ? 12 : 30, '#ffd0c8', 420, 3); } fx.shake(0.35); return true;
    case 'champ': fx.banner(String(ev.name || 'THE CHAMPION').toUpperCase(), '#ffcf3a', 'Cleave · leap slam · whirlwind under 50% · lure it into the plates', 2.6, 48); if (has) fx.ring(x, y, 300, '#ffcf3a', 0.9, 12); fx.shake(0.4); return true;
    case 'champCry': fx.banner('WAR CRY!', '#ffcf3a', 'It calls its guards', 1.2, 38); if (has) fx.add({ type: 'shock', x, y, r0: 40, r1: 300, life: 0.5, color: '#ffcf3a', width: 16 }); return true;
    case 'boss': fx.banner(String(ev.name || 'THE GATEKEEPER').toUpperCase(), T.col, 'Hammer combo · ripple quake · sweeping beams · rune cross', 2.6, 48); if (has) { fx.ring(x, y, 380, T.col, 1, 14); fx.puffs(x, y, 14, '#3a2a40', 22, 240, 0.8); } fx.shake(0.6); return true;
    case 'trap': {
      if (!has) return true;
      STREAKS.push({ x, y, b, t0: nowS(), i: ev.i });
      if (!lite) fx.sparks(x, y, -Math.PI / 2, 6, TRAP_COL[b][1], 260, 1.4);
      return true;
    }
  }
  return false;
}
/** part-2 overlays over the characters: trap bursts (jets along their lines, plates erupting) */
export function drawMission2Over(ctx, A, V, view, t, lite) {
  if (!A || A.type !== 'assault') { STREAKS.length = 0; return; }
  const n = nowS(); while (STREAKS.length && n - STREAKS[0].t0 > 0.5) STREAKS.shift();
  const [c1, c2] = TRAP_COL[A.biome];
  for (const s of STREAKS) {
    const T = A.traps[s.i]; if (!T) continue; const k = (n - s.t0) / 0.5;
    ctx.save(); ctx.globalAlpha = 1 - k;
    if (T.k === 'line') {
      ctx.lineCap = 'round'; ctx.lineWidth = T.w * (1 - k * 0.5); ctx.strokeStyle = c1; ctx.beginPath(); ctx.moveTo(T.x, T.y); ctx.lineTo(T.x + T.len, T.y); ctx.stroke();
      ctx.lineWidth = T.w * 0.4; ctx.strokeStyle = c2; ctx.stroke();
      if (!lite) { ctx.fillStyle = c2; for (let x = 0; x < T.len; x += 40) { const h = (20 + 40 * hash(x + s.i)) * (1 - k); ctx.beginPath(); ctx.moveTo(T.x + x - 7, T.y); ctx.lineTo(T.x + x, T.y - h); ctx.lineTo(T.x + x + 7, T.y); ctx.closePath(); ctx.fill(); } }
    } else {
      circle(ctx, T.x, T.y, T.r * (0.6 + 0.4 * k), c1, 0);
      ctx.fillStyle = c2; for (let i = 0; i < (lite ? 5 : 9); i++) { const an = i * TAU / 9 + s.i, rr = T.r * 0.55, h = (30 + 30 * hash(i + s.i)) * (1 - k * 0.6); const px = T.x + Math.cos(an) * rr * hash(i * 3 + s.i), py = T.y + Math.sin(an) * rr * 0.7 * hash(i * 5 + s.i); ctx.beginPath(); ctx.moveTo(px - 8, py + 4); ctx.lineTo(px, py - h); ctx.lineTo(px + 8, py + 4); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
    }
    ctx.restore();
  }
  void V; void view; void t;
}
export { OPS_HAZ };
