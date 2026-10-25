// Mission dungeons, client side (sim/ops.js + sim/opsconst.js): the fixed entrances in the open world (stone arches with a
// swirling portal in the type's colour + its glyph), the instanced arenas (a cached floor in the map's palette: flagstones,
// grass / sand / snow / ash, the rim wall, the type's markings), the live objective art (the relic + its shield, terminal
// capture rings, the data shard, Extract / Continue pads, the Assault gates, the Capture exits + the fleeing target's
// trail), the mission HUD (objective HP, wave / timer, terminal progress, the target arrow, the kill counter), the arena
// minimap and the event callouts. Reads `sim.ops` (solo: the live state, packed once per tick; co-op: the snapshot copy).
import { INK, circle, rrect } from './art.js';
import { drawText } from './textcache.js';
import { OPS, OPS_TYPE, OPS_BIOME, SWARM_TIERS, OPS_Y, opsArenaAt, arenaOf, OPS_GATE_R, gateName } from '../sim/opsconst.js';
import { packOps } from '../sim/ops.js';
import { drawOpsIcon, iconOf } from './opsicons.js';
import { drawDefenseUnder, drawSwarmUnder, defenseProps, drawStructure, drawTracker, drawBuildPrompt, drawResults, missionEventFx } from './missionfx.js'; // revamp part 1: Defense + Swarm art, tracker, grades
import { routePath, routeBase, routeMarks, routeRim, assaultMarks, assaultRim, drawMobileUnder, drawCart, drawAssaultUnder, setOpsFocus, drawTracker2, hud2, minimap2, missionEventFx2 } from './missionfx2.js'; // part 2: Mobile Defense + Assault
import { captureMarks, drawCaptureUnder, drawTracker3, hud3, minimap3, missionEventFx3 } from './missionfx3.js'; // part 3: Capture
import { CAP_RIGS } from '../sim/opsconst.js';
import { bestFor, drawGradeMedal } from './bestgrade.js'; // part 3: best grade per mission type

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const hash = (i) => { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
const fmt = (ticks) => { const s = Math.max(0, Math.ceil(ticks / 60)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function label(ctx, s, x, y, size, col, lw = 5) { drawText(ctx, s, x, y, `bold ${size}px "Lilita One", "Arial Black", sans-serif`, col, 'center', lw, INK, size); }
function mk(w, h) { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; } return null; }

let CACHE = { sim: null, tick: -1, v: null };
/** the mission state in packed form (solo sims are packed at most once per tick; co-op: the snapshot copy) */
export function opsView(sim) {
  const O = sim && sim.ops; if (!O) return null;
  if (!O.A) return O; // (already packed)
  if (CACHE.sim === sim && CACHE.tick === sim.tick && CACHE.v) return CACHE.v;
  CACHE = { sim, tick: sim.tick, v: packOps(sim) };
  return CACHE.v;
}
/** the arena the local hero stands in (or null) */
export const opsHere = (p) => (p && p.y < OPS_Y ? opsArenaAt(p.x, p.y) : null);

// ------------------------------------------------------------------ the open-world entrances
/** the entrance the hero can use right now (within reach), or null */
export function nearGate(sim, p, pad = 0) {
  if (!p || p.dead || !sim || !sim.world || !sim.world.opsGates) return null;
  let best = null, bd = OPS_GATE_R + pad;
  for (const g of sim.world.opsGates) { const d = Math.hypot(p.x - g.x, p.y - g.y); if (d < bd) { bd = d; best = g; } }
  return best;
}
/** the glowing platform + rune ring under each entrance in view (ground layer) */
export function drawGatesUnder(ctx, sim, view, t) {
  const L = sim && sim.world && sim.world.opsGates; if (!L) return;
  for (const g of L) {
    if (g.x < view.x0 - 160 || g.x > view.x1 + 160 || g.y < view.y0 - 200 || g.y > view.y1 + 160) continue;
    const I = iconOf(g), big = g.type === 'boss' ? 1.25 : 1;
    ctx.save(); ctx.translate(g.x, g.y); ctx.scale(big, big);
    ctx.beginPath(); ctx.ellipse(0, 6, 86, 40, 0, 0, TAU); ctx.fillStyle = 'rgba(43,36,51,.28)'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, 78, 34, 0, 0, TAU); ctx.fillStyle = '#8d8597'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -2, 66, 27, 0, 0, TAU); ctx.fillStyle = '#b2aabb'; ctx.fill();
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 3 + g.id); ctx.setLineDash([10, 9]); ctx.lineDashOffset = -t * 30;
    ctx.beginPath(); ctx.ellipse(0, -2, 58, 22, 0, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = I.col; ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
}
/** the arch itself (y-sorted with the characters by the renderer) */
export function drawGateArch(ctx, g, t, local) {
  const I = iconOf(g), big = g.type === 'boss' ? 1.25 : 1, near = local && Math.hypot(local.x - g.x, local.y - g.y) < OPS_GATE_R;
  ctx.save(); ctx.translate(g.x, g.y); ctx.scale(big, big);
  if (g.type !== 'boss') gateBanners(ctx, g, I, t);
  // the portal oval: a swirl in the type's colour
  const pr = 34, ph = 58, cy = -62;
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, cy, pr, ph, 0, 0, TAU); ctx.clip();
  const gr = ctx.createRadialGradient(0, cy, 4, 0, cy, ph); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, I.col); gr.addColorStop(1, g.type === 'boss' ? '#1a1024' : INK);
  ctx.fillStyle = gr; ctx.fillRect(-pr, cy - ph, pr * 2, ph * 2);
  ctx.globalAlpha = 0.55; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, cy, pr * (0.3 + i * 0.25), ph * (0.3 + i * 0.25), 0, t * (1.6 + i * 0.4) + i * 2, t * (1.6 + i * 0.4) + i * 2 + 2.2); ctx.stroke(); }
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, cy, pr, ph, 0, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  // the stone arch: two pillars + a lintel
  for (const sx of [-1, 1]) { rrect(ctx, sx * 46 - 13, -128, 26, 132, 5); ctx.fillStyle = '#a49cad'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(sx * 46 - 9, -122, 6, 120); for (let k = 0; k < 4; k++) { ctx.fillStyle = 'rgba(43,36,51,.25)'; ctx.fillRect(sx * 46 - 13, -100 + k * 28, 26, 2.5); } }
  rrect(ctx, -66, -146, 132, 26, 7); ctx.fillStyle = '#bcb4c6'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = I.col; ctx.globalAlpha = 0.8; ctx.fillRect(-58, -126, 116, 3); ctx.globalAlpha = 1;
  // the glyph plaque
  ctx.beginPath(); ctx.arc(0, -150, 21, 0, TAU); ctx.fillStyle = INK; ctx.fill();
  drawOpsIcon(ctx, I.icon, 0, -150, 1.6, I.col, false);
  ctx.restore();
  // name tag (+ the prompt hint when close)
  const nm = (g.type === 'boss' ? gateName(g) : `${OPS_TYPE[g.type].name}`).toUpperCase();
  label(ctx, nm, g.x, g.y + 52 * big, g.type === 'boss' ? 17 : 16, I.col, 5);
  if (g.type !== 'boss') { const r = bestFor(g.type, g.biome); drawGradeMedal(ctx, g.x + 76, g.y - 150, 17, r ? r.g : '', 'BEST'); } // (part 3: your best grade for this mission on this map)
  if (near) label(ctx, 'MISSION CARD', g.x, g.y + 72 * big, 12, '#ffffff', 4);
}

/** mission-spread pass (2026-10-07): the entrances stand out in the wilds now, so each gets a little site round it:
 *  two banner poles in the type's colour + a themed prop (defense: a broken pillar, mobile: a signpost, assault: a
 *  spiked barricade, capture: a flag, swarm: a skull totem). */
function gateBanners(ctx, g, I, t) {
  for (const sx of [-1, 1]) {
    const x = sx * 96, w = Math.sin(t * 2.4 + sx + g.id) * 4;
    rrect(ctx, x - 4, -150, 8, 154, 3); ctx.fillStyle = '#6a5236'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + sx * 4, -146); ctx.lineTo(x + sx * (34 + w), -138); ctx.lineTo(x + sx * (28 + w), -116); ctx.lineTo(x + sx * (34 + w), -94); ctx.lineTo(x + sx * 4, -100); ctx.closePath();
    ctx.fillStyle = I.col; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, -152, 5, 0, TAU); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.stroke();
  }
  ctx.save(); ctx.translate(-138, 6); ctx.lineWidth = 3; ctx.strokeStyle = INK;
  switch (g.type) {
    case 'defense': rrect(ctx, -14, -58, 28, 60, 4); ctx.fillStyle = '#a49cad'; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-14, -58); ctx.lineTo(-4, -70); ctx.lineTo(6, -60); ctx.lineTo(14, -66); ctx.lineTo(14, -58); ctx.fill(); ctx.stroke(); rrect(ctx, 18, -12, 22, 14, 4); ctx.fill(); ctx.stroke(); break;
    case 'mobile': rrect(ctx, -3, -64, 6, 66, 2); ctx.fillStyle = '#6a5236'; ctx.fill(); ctx.stroke(); for (const [dy, d] of [[-58, 1], [-40, -1]]) { ctx.beginPath(); ctx.moveTo(0, dy); ctx.lineTo(d * 30, dy); ctx.lineTo(d * 38, dy + 7); ctx.lineTo(d * 30, dy + 14); ctx.lineTo(0, dy + 14); ctx.closePath(); ctx.fillStyle = '#d9b77a'; ctx.fill(); ctx.stroke(); } break;
    case 'assault': ctx.fillStyle = '#7a5a3a'; rrect(ctx, -30, -18, 60, 10, 3); ctx.fill(); ctx.stroke(); for (const sx2 of [-20, 0, 20]) { ctx.beginPath(); ctx.moveTo(sx2 - 6, -8); ctx.lineTo(sx2 + 8, -44); ctx.lineTo(sx2 + 6, -8); ctx.closePath(); ctx.fillStyle = '#c8d0e0'; ctx.fill(); ctx.stroke(); } break;
    case 'capture': rrect(ctx, -3, -70, 6, 72, 2); ctx.fillStyle = '#6a5236'; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(3, -68); ctx.lineTo(40 + Math.sin(t * 3) * 3, -58); ctx.lineTo(3, -46); ctx.closePath(); ctx.fillStyle = I.col; ctx.fill(); ctx.stroke(); break;
    default: rrect(ctx, -4, -60, 8, 62, 2); ctx.fillStyle = '#5a4630'; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -64, 13, 0, TAU); ctx.fillStyle = '#efe6d2'; ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-5, -65, 3, 0, TAU); ctx.arc(5, -65, 3, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ arenas: cached floor art
const FLOORS = new Map();
function capsulePath(g, A, grow = 0) {
  const dx = A.bx - A.ax, dy = A.by - A.ay, L = Math.hypot(dx, dy), R = A.R + grow;
  g.beginPath();
  if (L < 1) { g.arc(A.ax, A.ay, R, 0, TAU); return; }
  const a = Math.atan2(dy, dx);
  g.arc(A.bx, A.by, R, a - Math.PI / 2, a + Math.PI / 2); g.arc(A.ax, A.ay, R, a + Math.PI / 2, a + Math.PI * 1.5); g.closePath();
}
function floorArt(A) {
  let F = FLOORS.get(A.id); if (F) return F;
  const b = A.box, W = b.x1 - b.x0, H = b.y1 - b.y0, DS = Math.min(0.5, 2400 / Math.max(W, H));
  const c = mk(Math.ceil(W * DS), Math.ceil(H * DS)); if (!c) return null;
  const g = c.getContext('2d'), B = OPS_BIOME[A.biome];
  g.scale(DS, DS); g.translate(-b.x0, -b.y0);
  // the rim wall (under) + the floor (a route arena: per-leg capsules, sim/opsconst.js A.path)
  const route = !!A.path, shape = (gr) => (route ? routePath(g, A, gr) : capsulePath(g, A, gr));
  if (route) routeBase(g, A);
  else { capsulePath(g, A, 46); g.fillStyle = B.wall; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke(); capsulePath(g, A, 0); g.fillStyle = B.floor[0]; g.fill(); }
  g.save(); shape(0); g.clip();
  // flagstones (a staggered grid, each stone its own shade), then the biome's own texture over them
  const S = 120;
  for (let y = b.y0 - S; y < b.y1 + S; y += S) for (let x = b.x0 - S; x < b.x1 + S; x += S) {
    const i = Math.round(x / S) * 7919 + Math.round(y / S) * 104729, ox = (Math.round(y / S) % 2) * S * 0.5, h = hash(i);
    g.fillStyle = h < 0.33 ? B.floor[1] : h < 0.66 ? B.floor[2] : B.floor[0];
    rrectG(g, x + ox + 4, y + 4, S - 8, S - 8, 14); g.fill();
    if (A.biome === 'frost') { // (Frostveil: stronger blue grout + an ice sheen, so the bright floor reads instead of washing out)
      g.globalAlpha = 0.5; g.lineWidth = 4; g.strokeStyle = '#5f86ab'; g.stroke();
      if (h > 0.4) { g.globalAlpha = 0.55; g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + ox + 22, y + S - 34); g.lineTo(x + ox + S - 40, y + 20); g.moveTo(x + ox + 40, y + S - 22); g.lineTo(x + ox + 62, y + S - 44); g.stroke(); }
      g.globalAlpha = 1;
    } else { g.globalAlpha = 0.18; g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); g.globalAlpha = 1; }
  }
  for (let i = 0; i < Math.round((W * H) / 26000); i++) {
    const x = b.x0 + hash(i * 3 + 1) * W, y = b.y0 + hash(i * 3 + 2) * H, h = hash(i * 3 + 3);
    if (A.biome === 'wilds') { g.strokeStyle = h < 0.5 ? '#3f8a35' : '#5aa543'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x - 4, y - 9); g.moveTo(x, y); g.lineTo(x, y - 12); g.moveTo(x + 6, y); g.lineTo(x + 4, y - 9); g.stroke(); if (h > 0.85) { g.fillStyle = h > 0.93 ? '#ffd23f' : '#ff8ad8'; g.beginPath(); g.arc(x + 9, y - 4, 4, 0, TAU); g.fill(); } }
    else if (A.biome === 'dunes') { g.strokeStyle = 'rgba(160,110,50,.35)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y + 30, 38 + h * 30, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); }
    else if (A.biome === 'frost') { if (h < 0.6) { g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(x, y, 30 + h * 30, 12 + h * 8, 0, 0, TAU); g.fill(); } else { g.strokeStyle = 'rgba(80,130,190,.6)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20, y + 8); g.lineTo(x + 34, y - 4); g.stroke(); } }
    else { if (h < 0.5) { g.strokeStyle = 'rgba(255,120,40,.55)'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18, y + 10); g.lineTo(x + 30, y + 2); g.lineTo(x + 46, y + 14); g.stroke(); } else { g.fillStyle = 'rgba(20,10,8,.35)'; g.beginPath(); g.arc(x, y, 6 + h * 10, 0, TAU); g.fill(); } }
  }
  // the type's markings
  const B2 = OPS_TYPE[A.type];
  g.strokeStyle = B2.col; g.globalAlpha = 0.35; g.lineWidth = 8;
  if (A.type === 'defense') { g.beginPath(); g.arc(A.relic.x, A.relic.y, 300, 0, TAU); g.stroke(); g.beginPath(); g.arc(A.relic.x, A.relic.y, 180, 0, TAU); g.stroke(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; g.beginPath(); g.moveTo(A.relic.x + Math.cos(a) * 180, A.relic.y + Math.sin(a) * 180); g.lineTo(A.relic.x + Math.cos(a) * 300, A.relic.y + Math.sin(a) * 300); g.stroke(); } }
  else if (A.type === 'swarm') { for (const r of [240, 420]) { g.beginPath(); g.arc(A.cx, A.cy, r, 0, TAU); g.stroke(); } }
  else if (A.type === 'capture') { g.globalAlpha = 1; captureMarks(g, A); }
  else if (A.type === 'mobile') { g.globalAlpha = 1; routeMarks(g, A); }
  else { for (const gy of A.gates) { g.beginPath(); g.moveTo(A.cx - A.R, gy); g.lineTo(A.cx + A.R, gy); g.lineWidth = 14; g.stroke(); } g.beginPath(); g.arc(A.bossAt.x, A.bossAt.y, 360, 0, TAU); g.lineWidth = 10; g.stroke(); g.globalAlpha = 1; assaultMarks(g, A); }
  g.globalAlpha = 1;
  // the rim's inner shadow
  if (!route) { capsulePath(g, A, 0); g.lineWidth = 40; g.strokeStyle = 'rgba(20,12,24,.22)'; g.stroke(); }
  g.restore();
  if (route) { routeRim(g, A); F = { c, x0: b.x0, y0: b.y0, W, H }; FLOORS.set(A.id, F); if (FLOORS.size > 2) FLOORS.delete(FLOORS.keys().next().value); return F; }
  // battlements on the wall + spawn breaches / capture exits
  const dx = A.bx - A.ax, dy = A.by - A.ay, L = Math.hypot(dx, dy), per = 2 * Math.PI * (A.R + 30) + 2 * L, n = Math.round(per / 110);
  for (let i = 0; i < n; i++) { const q = rimPoint(A, (i + 0.5) / n, 34); rrectG(g, q.x - 15, q.y - 15, 30, 30, 5); g.fillStyle = shadeHex(B.wall, 20); g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); }
  for (const s of A.spawns || []) { const sp = spineD(A, s.x, s.y); if (sp > A.R - 160) { g.beginPath(); g.ellipse(s.x, s.y, 46, 30, 0, 0, TAU); g.fillStyle = 'rgba(20,10,20,.55)'; g.fill(); } }
  if (A.type === 'assault') assaultRim(g, A);
  if (A.exits) for (const X of A.exits) { g.save(); g.translate(X.x, X.y); g.rotate(X.a + Math.PI / 2); rrectG(g, -70, -40, 140, 90, 18); g.fillStyle = B.wall; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke(); g.beginPath(); g.ellipse(0, 0, 50, 34, 0, 0, TAU); g.fillStyle = '#140c1c'; g.fill(); g.restore(); }
  F = { c, x0: b.x0, y0: b.y0, W, H };
  FLOORS.set(A.id, F); if (FLOORS.size > 2) FLOORS.delete(FLOORS.keys().next().value);
  return F;
}
function rrectG(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function hexG(g, x, y, r) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + Math.PI / 6; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8); } g.closePath(); }
function shadeHex(hex, amt) { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, v + amt)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
function spineD(A, x, y) { const dx = A.bx - A.ax, dy = A.by - A.ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((x - A.ax) * dx + (y - A.ay) * dy) / L)) : 0; return Math.hypot(x - (A.ax + dx * t), y - (A.ay + dy * t)); }
/** a point on the capsule rim at fraction f of its perimeter (+ out px outward) */
function rimPoint(A, f, out = 0) {
  const dx = A.bx - A.ax, dy = A.by - A.ay, L = Math.hypot(dx, dy), R = A.R + out, arc = Math.PI * R, per = 2 * arc + 2 * L, s = f * per;
  if (L < 1) { const a = f * TAU; return { x: A.ax + Math.cos(a) * R, y: A.ay + Math.sin(a) * R }; }
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, a0 = Math.atan2(dy, dx);
  if (s < L) return { x: A.ax + ux * s + nx * R, y: A.ay + uy * s + ny * R };
  if (s < L + arc) { const a = a0 + Math.PI / 2 - (s - L) / R; return { x: A.bx + Math.cos(a) * R, y: A.by + Math.sin(a) * R }; }
  if (s < 2 * L + arc) { const k = s - L - arc; return { x: A.bx - ux * k - nx * R, y: A.by - uy * k - ny * R }; }
  const a = a0 - Math.PI / 2 - (s - 2 * L - arc) / R; return { x: A.ax + Math.cos(a) * R, y: A.ay + Math.sin(a) * R };
}
/** the arena's ground (covers the view: the void + the cached floor). true when drawn. */
export function drawOpsGround(ctx, view, t, sim, local) {
  const A = opsHere(local); if (!A) return false;
  const B = OPS_BIOME[A.biome];
  ctx.fillStyle = B.voidc; ctx.fillRect(view.x0 - 10, view.y0 - 10, view.x1 - view.x0 + 20, view.y1 - view.y0 + 20);
  // drifting motes over the void (a little life outside the walls)
  ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = B.accent;
  for (let i = 0; i < 26; i++) { const x = view.x0 + ((hash(i) * 4000 + t * 18 * (0.5 + hash(i + 9))) % (view.x1 - view.x0)), y = view.y0 + ((hash(i + 40) * 3000 - t * 10) % (view.y1 - view.y0) + (view.y1 - view.y0)) % (view.y1 - view.y0); ctx.fillRect(x, y, 3, 3); }
  ctx.restore();
  const F = floorArt(A);
  if (F) { const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.drawImage(F.c, F.x0, F.y0, F.W, F.H); ctx.imageSmoothingEnabled = sm; }
  return true;
}
/** pillars as y-sorted props (the renderer pushes them into its entity list) */
export function opsProps(local, view, sim = null) {
  const A = opsHere(local); if (!A) return null;
  const out = [];
  for (const o of A.pillars) if (o.x > view.x0 - 80 && o.x < view.x1 + 80 && o.y > view.y0 - 40 && o.y < view.y1 + 220) out.push({ kind: 'oprop', o, A, y: o.y });
  if (A.type === 'defense' && sim) { const V = opsView(sim); if (V && V.k === 'defense' && V.b === A.biome) out.push(...defenseProps(A, V, view)); } // turrets / ward totems
  if (A.type === 'mobile' && sim) { const V = opsView(sim); if (V && V.k === 'mobile' && V.b === A.biome && V.cx != null) out.push({ kind: 'oprop', cart: V, A, y: V.cy }); } // the carrier
  return out;
}
export function drawOpsProp(ctx, e) {
  if (e.st) return drawStructure(ctx, e, typeof performance !== 'undefined' ? performance.now() / 1000 : 0);
  if (e.cart) return drawCart(ctx, e.A, e.cart, typeof performance !== 'undefined' ? performance.now() / 1000 : 0);
  const o = e.o, B = OPS_BIOME[e.A.biome], r = o.r, h = r * 2.6;
  ctx.beginPath(); ctx.ellipse(o.x, o.y + 4, r * 1.25, r * 0.55, 0, 0, TAU); ctx.fillStyle = 'rgba(20,12,24,.35)'; ctx.fill();
  rrect(ctx, o.x - r, o.y - h, r * 2, h + 4, 8); ctx.fillStyle = shadeHex(B.wall, 30); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(o.x - r + 6, o.y - h + 8, 7, h - 12);
  ctx.beginPath(); ctx.ellipse(o.x, o.y - h, r, r * 0.42, 0, 0, TAU); ctx.fillStyle = shadeHex(B.wall, 55); ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.globalAlpha = 0.8; ctx.fillStyle = B.accent; ctx.fillRect(o.x - r, o.y - h * 0.55, r * 2, 4); ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ arenas: the live objective art
export function drawOpsUnder(ctx, sim, local, t, lite = false, view = null) {
  const A = opsHere(local), V = opsView(sim); if (!A || !V || V.k !== A.type || V.b !== A.biome) return;
  const T = OPS_TYPE[A.type], B = OPS_BIOME[A.biome];
  if (A.type === 'defense') {
    drawDefenseUnder(ctx, A, V, t, lite, local);
    const R = A.relic, k = clamp01(V.hp / OPS.defense.relicHp), hurt = 1 - k;
    // the guard ring (raiders inside it chip the relic)
    ctx.save(); ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 3); ctx.setLineDash([16, 12]); ctx.lineDashOffset = -t * 40; ctx.beginPath(); ctx.arc(R.x, R.y, R.r + OPS.defense.reach + 20, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = k < 0.35 ? '#ff5e5b' : T.col; ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    // pedestal + the floating crystal
    ctx.beginPath(); ctx.ellipse(R.x, R.y + 8, 70, 34, 0, 0, TAU); ctx.fillStyle = 'rgba(20,12,24,.35)'; ctx.fill();
    rrect(ctx, R.x - 54, R.y - 30, 108, 46, 12); ctx.fillStyle = '#9a92a6'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(R.x, R.y - 30, 54, 20, 0, 0, TAU); ctx.fillStyle = '#c4bccf'; ctx.fill(); ctx.stroke();
    const fy = R.y - 92 + Math.sin(t * 2.2) * 6, col = k < 0.35 ? '#ff8a6a' : B.accent;
    ctx.save(); ctx.globalAlpha = 0.35; const gl = ctx.createRadialGradient(R.x, fy, 4, R.x, fy, 70); gl.addColorStop(0, col); gl.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(R.x, fy, 70, 0, TAU); ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(R.x, fy - 46); ctx.lineTo(R.x + 24, fy); ctx.lineTo(R.x, fy + 40); ctx.lineTo(R.x - 24, fy); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R.x, fy - 46); ctx.lineTo(R.x + 8, fy); ctx.lineTo(R.x, fy + 40); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill();
    if (hurt > 0.2) { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(R.x - 10, fy - 20); ctx.lineTo(R.x + 2, fy - 4); ctx.lineTo(R.x - 6, fy + 10); if (hurt > 0.55) { ctx.moveTo(R.x + 12, fy - 8); ctx.lineTo(R.x + 4, fy + 6); ctx.lineTo(R.x + 10, fy + 22); } ctx.stroke(); }
    // the shield bubble (hex shimmer)
    if (V.sh > 0) {
      const sk = clamp01(V.sh / OPS.defense.shield);
      ctx.save(); ctx.globalAlpha = 0.18 + 0.3 * sk; ctx.beginPath(); ctx.arc(R.x, R.y - 50, 110, 0, TAU); ctx.fillStyle = 'rgba(160,230,255,.25)'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#bff3ff'; ctx.stroke();
      ctx.globalAlpha = 0.25 * sk; ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + t * 0.4; ctx.beginPath(); ctx.arc(R.x + Math.cos(a) * 62, R.y - 50 + Math.sin(a) * 62, 22, 0, TAU); ctx.stroke(); }
      ctx.restore();
    }
    // the choice pads
    if (V.st === 'choice') for (const key of ['extract', 'cont']) {
      const P = A.pads[key], c = key === 'extract' ? '#7dffb0' : '#ffcf4a', on = V.pad === key, f = on ? clamp01(V.pt / OPS.defense.padT) : 0;
      pad(ctx, P, c, f, key === 'extract' ? 'EXTRACT' : 'CONTINUE', t);
    }
  } else if (A.type === 'mobile') {
    drawMobileUnder(ctx, A, V, t, lite, sim, local);
  } else if (A.type === 'assault') {
    setOpsFocus(local); drawAssaultUnder(ctx, A, V, t, lite);
  } else if (A.type === 'capture') {
    drawCaptureUnder(ctx, A, V, t, lite, sim, local);
  } else if (A.type === 'swarm') {
    drawSwarmUnder(ctx, A, V, t, lite, view || { x0: A.box.x0, y0: A.box.y0, x1: A.box.x1, y1: A.box.y1 });
  }
}
function pad(ctx, P, c, f, txt, t) {
  ctx.save(); ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 5); ctx.beginPath(); ctx.arc(P.x, P.y, P.r, 0, TAU); ctx.fillStyle = c; ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.arc(P.x, P.y, P.r, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = c; ctx.stroke();
  if (f > 0) { ctx.beginPath(); ctx.arc(P.x, P.y, P.r + 10, -Math.PI / 2, -Math.PI / 2 + f * TAU); ctx.lineWidth = 9; ctx.strokeStyle = '#ffffff'; ctx.stroke(); }
  ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = c; ctx.fillRect(P.x - 5, P.y - 220, 10, 220); ctx.restore();
  label(ctx, txt, P.x, P.y + 6, 17, '#ffffff', 5);
}

// ------------------------------------------------------------------ HUD
const TYPE_LINE = { defense: 'DEFENSE', mobile: 'MOBILE DEFENSE', assault: 'ASSAULT', capture: 'CAPTURE', swarm: 'SWARM' };
/** the mission HUD (top centre). Returns the y below it (0: not in a mission). */
export function drawOpsHud(ctx, sim, p, w, h, txt, bar, t, keyLabel = () => 'F') {
  const A = opsHere(p), V = opsView(sim); if (!A || !V || V.k !== A.type) return 0;
  const T = OPS_TYPE[A.type], B = OPS_BIOME[A.biome], cx = w / 2;
  let y = 112;
  const bw = Math.min(560, w * 0.5), bx = cx - bw / 2;
  txt(ctx, `${TYPE_LINE[A.type]} · ${B.name}`, cx, y, 20, T.col, 'center', 4);
  txt(ctx, `${V.kl} kills`, bx + bw, y, 14, '#ffffff', 'right', 3);
  y += 14;
  let obj = null;
  if (V.st === 'results') {
    if (drawResults(ctx, A, V, w, h, txt, t)) return y + 10;
    const ok = V.res !== 'fail', title = V.res === 'clear' ? 'MISSION COMPLETE' : V.res === 'extract' ? 'EXTRACTED' : 'MISSION FAILED';
    txt(ctx, title, cx, y + 26, 30, ok ? '#7dffb0' : '#ff5e5b', 'center', 6);
    txt(ctx, `${V.msg} · rewards in your bag · home in ${Math.max(0, Math.ceil((OPS.results - V.endT) / 60))} s`, cx, y + 50, 15, '#ffffff', 'center', 3);
    return y + 64;
  }
  if (V.st === 'intro') { txt(ctx, T.obj, cx, y + 22, 15, '#ffffff', 'center', 3); return y + 34; }
  if (A.type === 'defense' || A.type === 'swarm') drawTracker(ctx, A, V, p, w, h, txt, bar, t, keyLabel);
  else if (A.type === 'mobile' || A.type === 'assault') drawTracker2(ctx, A, V, p, w, h, txt, bar, t, keyLabel);
  else if (A.type === 'capture') drawTracker3(ctx, A, V, p, w, h, txt, bar, t, keyLabel);
  if (A.type === 'defense') {
    bar(ctx, bx, y + 6, bw, 20, clamp01(V.hp / OPS.defense.relicHp), V.hp < 35 ? '#ff5e5b' : T.col, `RELIC ${V.hp}%`);
    if (V.sh > 0) { rrect(ctx, bx + 2, y + 2, (bw - 4) * clamp01(V.sh / OPS.defense.shield), 5, 2); ctx.fillStyle = '#bff3ff'; ctx.fill(); }
    if (V.st === 'choice') {
      txt(ctx, `ROUND ${V.r} CLEARED · ${V.rd} set piece${V.rd === 1 ? '' : 's'} banked`, cx, y + 48, 18, '#ffe9a0', 'center', 4);
      txt(ctx, `Stand on EXTRACT (keep the loot) or CONTINUE (harder, more loot) · ${keyLabel('interact')}: choose · ${Math.ceil(V.ch / 60)} s`, cx, y + 68, 13.5, '#ffffff', 'center', 3);
      obj = { x: A.pads.cont.x, y: A.pads.cont.y };
      return hudArrow(ctx, w, h, p, obj, T.col, t), y + 80;
    }
    if (V.ph === 'build') { y = drawBuildPrompt(ctx, A, V, p, w, y + 22, txt, t, keyLabel); obj = A.relic; }
    else {
      const sg = V.sg && sim.enemyById && sim.enemyById.get(V.sg);
      if (sg && !sg.dead) { bar(ctx, bx + bw * 0.1, y + 32, bw * 0.8, 14, clamp01(sg.hp / sg.maxHp), '#ff3b6b', String(sg.name || 'SIEGE').toUpperCase()); y += 20; }
      txt(ctx, `Round ${V.r} · Wave ${Math.max(1, V.w)}/${V.nw} · ${V.left} left${V.chg >= 100 ? ' · PULSE READY' : ''}`, cx, y + 46, 16, V.chg >= 100 ? '#ffffff' : '#ffffff', 'center', 3);
      obj = A.relic; y += 56;
    }
  } else if (A.type === 'mobile' || A.type === 'assault') {
    const r = hud2(ctx, A, V, p, w, y, txt, bar, t, keyLabel); y = r.y; obj = r.obj;
  } else if (A.type === 'capture') {
    const r = hud3(ctx, A, V, p, w, y, txt, bar, t, keyLabel); y = r.y; obj = r.obj;
  } else {
    if (V.w > V.nw && V.qn) { bar(ctx, bx, y + 6, bw, 20, V.qhp, '#ff6fd8', V.qn.toUpperCase()); txt(ctx, 'Break the eggs · dodge the acid · Screech: hug her or get out', cx, y + 46, 13.5, '#ffffff', 'center', 3); y += 54; }
    else {
      txt(ctx, V.brk > 0 ? `Wave ${Math.min(V.nw, V.w + 1)}/${V.nw} in ${Math.ceil(V.brk / 60)} s` : `Wave ${V.w}/${V.nw} · ${V.left} left`, cx, y + 22, 18, T.col, 'center', 4);
      for (let i = 0; i < V.nw; i++) { const px = cx - (V.nw - 1) * 13 + i * 26; circle(ctx, px, y + 40, 7, i < V.w - (V.brk > 0 ? 0 : 1) ? T.col : 'rgba(255,255,255,.18)', 2); }
      if ((V.shk || 0) > 0) txt(ctx, 'THE RING IS SHRINKING: get inside!', cx, y + 64, 14, '#ffd23f', 'center', 3);
      y += 70;
    }
    const d = Math.hypot(p.x - A.cx, p.y - A.cy); if (d > (V.sr || 1000) - 40) { txt(ctx, 'OUTSIDE THE RING: get back in!', cx, y + 14, 18, Math.sin(t * 10) > 0 ? '#ff5e5b' : '#ffffff', 'center', 4); obj = { x: A.cx, y: A.cy }; y += 24; }
  }
  if (obj) hudArrow(ctx, w, h, p, obj, T.col, t);
  return y;
}
function hudArrow(ctx, w, h, p, o, col, t) {
  const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
  if (d < 380) return;
  const a = Math.atan2(dy, dx), R = 96, ax = w / 2 + Math.cos(a) * R, ay = h / 2 + Math.sin(a) * R;
  ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 6);
  ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-8, -13); ctx.lineTo(-2, 0); ctx.lineTo(-8, 13); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ minimap (in a mission)
/** the arena minimap (the capsule fitted into the circle): objective, mobs, the party. true when drawn. */
export function drawOpsMinimap(ctx, x, y, R, sim, p, CLASSES) {
  const A = opsHere(p); if (!A) return false;
  const V = opsView(sim), T = OPS_TYPE[A.type], B = OPS_BIOME[A.biome];
  const b = A.box, W = Math.max(b.x1 - b.x0, b.y1 - b.y0), k = (R * 1.8) / W, mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
  const X = (wx) => x + (wx - mx) * k, Y = (wy) => y + (wy - my) * k;
  circle(ctx, x, y, R + 5, INK, 0); circle(ctx, x, y, R, B.voidc, 0);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
  ctx.save(); ctx.translate(x - mx * k, y - my * k); ctx.scale(k, k); if (A.path) routePath(ctx, A, 0); else capsulePath(ctx, A, 0); ctx.restore();
  ctx.fillStyle = B.floor[0]; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = B.wall; ctx.stroke();
  for (const o of A.pillars) circle(ctx, X(o.x), Y(o.y), Math.max(1.5, o.r * k), B.wall, 0);
  if (A.type === 'defense') { drawOpsIcon(ctx, 'shield', X(A.relic.x), Y(A.relic.y), 0.8, T.col); if (V && V.so) A.socks.forEach((s, i) => circle(ctx, X(s.x), Y(s.y), 2.5, V.so[i] && V.so[i][0] ? '#ffcf4a' : 'rgba(255,255,255,.35)', 1)); }
  if (A.type === 'swarm' && V && V.sr) { ctx.beginPath(); ctx.arc(X(A.cx), Y(A.cy), V.sr * k, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = '#ff6fd8'; ctx.stroke(); }
  if ((A.type === 'mobile' || A.type === 'assault') && V) { minimap2(ctx, A, V, X, Y, k, T); if (A.type === 'assault') drawOpsIcon(ctx, 'swords', X(A.bossAt.x), Y(A.bossAt.y), 0.6, T.col); }
  if (A.type === 'defense' && V && V.st === 'choice') for (const P of Object.values(A.pads)) circle(ctx, X(P.x), Y(P.y), 4, '#7dffb0', 1.5);
  for (const e of sim.enemies) { if (e.dead || !(e.y < OPS_Y)) continue; const big = e.opsTgt || e.r >= 44; if (e.name && (e.name.endsWith(' Pylon') || CAP_RIGS.has(e.name))) continue; ctx.fillStyle = big ? (e.opsTgt ? T.col : '#ff3b6b') : e.name === 'Brood Egg' ? '#ff6fd8' : e.elite ? '#ffcf3a' : '#ff4d4d'; const s = big ? 7 : 3; ctx.fillRect(X(e.x) - s / 2, Y(e.y) - s / 2, s, s); }
  if (A.type === 'capture' && V) minimap3(ctx, A, V, X, Y, k, sim);
  if (sim.players) for (const q of sim.players.values()) { if (q.id === p.id || q.dead) continue; circle(ctx, X(q.x), Y(q.y), 3.5, CLASSES[q.cls] ? CLASSES[q.cls].color : '#fff', 1.5); }
  ctx.restore();
  ctx.save(); ctx.translate(X(p.x), Y(p.y)); ctx.rotate(p.aim || 0); ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-2, 0); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  circle(ctx, x, y, R + 3, null, 5, INK); circle(ctx, x, y, R, null, 2, 'rgba(255,255,255,.35)');
  return true;
}

// ------------------------------------------------------------------ event callouts
export function opsEventFx(fx, ev, me) {
  if (missionEventFx3(fx, ev, me) || missionEventFx2(fx, ev, me) || missionEventFx(fx, ev, me)) return;
  const T = OPS_TYPE[ev.k] || { col: '#ffd23f', name: 'Mission' }, B = OPS_BIOME[ev.b] || { name: '' }, x = ev.x, y = ev.y, has = x != null;
  switch (ev.ph) {
    case 'start': fx.banner(`${T.name.toUpperCase()}`, T.col, `${B.name} · ${T.obj}`, 3, 50); break;
    case 'go': { const G = { defense: ['DEFEND THE RELIC!', 'Build at the sockets, then hold 5 waves: charge the relic to pulse'], mobile: ['GRAB THE SHARD!', 'Carry it to Terminal 1'], assault: ['PUSH!', 'Clear each hall to open its gate'], capture: ['HUNT IT DOWN!', 'It runs, it blinks, it calls for help'], swarm: ['SURVIVE THE SWARM!', '8 waves, a shrinking arena, then the Queen · chain kills for loot'] }[ev.k]; if (G) fx.banner(G[0], T.col, G[1], 2.2, 46); break; }
    case 'wave': fx.banner(`WAVE ${ev.w}/5`, '#ff9a4c', `Round ${ev.r}`, 1.6, 44); if (has) { fx.ring(x, y, 160, '#ff5e5b', 0.6, 8); fx.puffs && fx.puffs(x, y, 12, '#3a2a40', 16, 200, 0.7); } if (ev.x2 != null) fx.ring(ev.x2, ev.y2, 160, '#ff5e5b', 0.6, 8); break;
    case 'relicHit': if (has) fx.ring(x, y - 60, 70, '#ff5e5b', 0.3, 4); break;
    case 'shieldBreak': if (has) { fx.ring(x, y - 50, 140, '#bff3ff', 0.5, 9); fx.sparks(x, y - 50, 0, 22, '#bff3ff', 380, TAU); } fx.banner('RELIC SHIELD DOWN!', '#ff5e5b', 'Clear the raiders off it', 1.4, 36); break;
    case 'round': fx.banner(`ROUND ${ev.r} CLEARED!`, '#ffcf4a', 'EXTRACT (left pad) or CONTINUE (right pad): harder, more loot', 3, 50); if (has) { fx.ring(x, y, 320, '#ffcf4a', 0.8, 10); fx.sparks(x, y - 60, -Math.PI / 2, 30, '#fff1a8', 420, 1.8); } break;
    case 'continue': fx.banner(`ROUND ${ev.r}`, '#ff9a4c', 'Tougher waves · another set piece on the line', 2, 48); break;
    case 'plug': fx.banner(`TERMINAL ${ev.i + 1}: HOLD!`, T.col, 'Stay in the ring for 45 s · enemies inside wear it down', 2.2, 44); if (has) { fx.ring(x, y, 260, T.col, 0.7, 10); fx.sparks(x, y, -Math.PI / 2, 20, '#c8fbff', 360, 1.6); } break;
    case 'term': fx.banner(`TERMINAL ${ev.i + 1} SECURED`, '#7dffb0', ev.i < 2 ? 'Pick the shard back up: next terminal' : '', 2, 44); if (has) fx.ring(x, y, 300, '#7dffb0', 0.8, 10); break;
    case 'pick': if (has) fx.ring(x, y, 60, T.col, 0.35, 5); break;
    case 'drop': if (has) fx.ring(x, y, 80, '#ff5e5b', 0.4, 5); fx.banner('SHARD DROPPED', '#ff5e5b', 'Pick it back up', 1.2, 32); break;
    case 'termHit': if (has) fx.ring(x, y, 240, '#ff5e5b', 0.25, 4); break;
    case 'gate': fx.banner(`GATE ${ev.i + 1} OPEN`, '#ffd0c8', ev.i < 2 ? 'Push on' : 'The Gatekeeper waits', 1.6, 44); if (has) { fx.ring(x, y, 420, '#ff5a4a', 0.7, 12); fx.sparks(x, y, -Math.PI / 2, 30, '#ffd0c8', 420, 3); } fx.shake(0.35); break;
    case 'boss': fx.banner(String(ev.name || 'THE GATEKEEPER').toUpperCase(), T.col, 'Adds at 66% and 33%', 2.4, 46); break;
    case 'adds': if (has) fx.ring(x, y, 260, T.col, 0.6, 8); fx.shake(0.3); break;
    case 'target': fx.banner(`CAPTURE: ${String(ev.name).toUpperCase()}`, T.col, "Down it before it escapes through an exit", 2.6, 46); break;
    case 'summon': if (has) { fx.ring(x, y, 150, T.col, 0.5, 7); fx.sparks(x, y, 0, 14, '#ead8ff', 300, TAU); } break;
    case 'blink': if (has) { fx.ring(x, y, 70, T.col, 0.4, 6); fx.sparks(x, y, 0, 12, '#ead8ff', 300, TAU); fx.ring(ev.x2, ev.y2, 90, '#ffffff', 0.4, 6); } break;
    case 'bolt': fx.banner("IT'S BOLTING FOR THE EXIT!", '#ff5e5b', 'Cut it off: stuns and slows stop it', 2.2, 44); break;
    case 'tier': fx.banner(`${String(ev.name).toUpperCase()} TIER!`, T.col, 'Another reward tier banked · extract any time', 2, 46); break;
    case 'end': { const ok = ev.why !== 'fail'; fx.shake(0.25); if (has) fx.sparks(x, y, -Math.PI / 2, 30, ok ? '#7dffb0' : '#ff8a6a', 420, 2.4); if (has) fx.ring(x, y, 360, ok ? '#7dffb0' : '#ff5e5b', 0.9, 12); break; }
  }
}
export { TYPE_LINE, arenaOf };
