// The Frostveil / Emberdeep trials, client side (sim/trials.js): the two arenas (Skaldra's Hoarfrost Mirror: a frozen lake
// that cracks tile by tile; Pyrrhex's Heart-Chamber: an obsidian floor over a magma sea), every telegraph (numbers,
// arrows, gauges, shadow wedges: the answer is always on the floor), the trial bosses (the classic Skaldra / Pyrrhex art
// plus a trial crown / Extreme aura), the HUD (boss bar + phase gates, the ENRAGE clock, mechanic cards, the chill meter,
// the Arrhythmia beat track, the wipe / retry screen), the minimap, event FX and sounds. Reads `sim.trial` (solo: the
// live state, normalised through packTrial once per tick; co-op: the snapshot copy).
import { cueOf } from '../sim/telegraph.js';
import { INK, circle, ENEMY_DRAW, shade } from './art.js';
import { drawText } from './textcache.js';
import './frostfx.js'; import './emberfx.js'; import './tombfx.js'; // (registers the classic Skaldra / Pyrrhex art the trial bosses wrap)
import { TRIAL_POS, TRIAL_R, TRIAL_EXIT_DY, trialAt } from '../sim/trialconst.js';
import { packTrial, FIGHTS, MECH_NAMES, TR, cellCenter } from '../sim/trials.js';
import { drawNefUnder, drawNefOver, drawNefSky, drawNefIntroHud, drawNefHud, nefTeleHide, nefTeleLabel } from './neferakhfx.js'; // (encounter revamp Part 1)

const TAU = Math.PI * 2, R = TRIAL_R;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
let CACHE = { sim: null, tick: -1, v: null };
/** the trial state in packed form (solo sims are packed at most once per tick) */
export function trialView(sim) {
  const T = sim && sim.trial; if (!T) return null;
  if (T.nph) return T; // (already packed: co-op snapshot)
  if (CACHE.sim === sim && CACHE.tick === sim.tick && CACHE.v) return CACHE.v;
  CACHE = { sim, tick: sim.tick, v: packTrial(sim) };
  return CACHE.v;
}
const fightCol = (V) => (V.sv ? (V.form ? '#ff5a7a' : FIGHTS[V.k].colS) : V.x ? FIGHTS[V.k].colX : FIGHTS[V.k].col);
export const trialNameOf = (V) => (V.sv ? (V.form && FIGHTS[V.k].nameE ? FIGHTS[V.k].nameE : FIGHTS[V.k].nameS) : V.x ? FIGHTS[V.k].nameX : FIGHTS[V.k].name);
const phaseList = (V) => (V.sv ? (V.form && FIGHTS[V.k].e ? FIGHTS[V.k].e : FIGHTS[V.k].s) : V.x ? FIGHTS[V.k].x : FIGHTS[V.k].n);
function mk(w, h) { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; } return null; }
function label(ctx, s, x, y, size, col, lw = 5) { drawText(ctx, s, x, y, `bold ${size}px "Lilita One", "Arial Black", sans-serif`, col, 'center', lw, INK, size); } // (piece 4 perf: baked once, blitted: the countdown numbers were re-stroked per bomb per frame)
// balance pass perf (the Pyrrhex P3 bomb-over-flood dip): circle telegraphs, lava pools and rafts are baked once per
// radius / colour into sprites and blitted (software raster paid for every translucent arc fill + stroke per frame)
const SPR = new Map();
function sprite(key, r, draw) {
  let c = SPR.get(key); if (c !== undefined) return c;
  const S = Math.ceil(r * 2 + 12); c = mk(S, S) || 0;
  if (c) { const g = c.getContext('2d'); g.translate(S / 2, S / 2); draw(g); }
  SPR.set(key, c); if (SPR.size > 240) SPR.delete(SPR.keys().next().value);
  return c;
}
function blit(ctx, c, x, y, k = 1) { const S = c.width * k; ctx.drawImage(c, x - S / 2, y - S / 2, S, S); }
// the Meltdown flood: one cached gradient disc (a full-arena radial gradient per frame was the bomb-burst fps dip)
let FLOOD = null;
function floodArt() {
  if (FLOOD !== null) return FLOOD;
  const S = Math.ceil(R * 2), c = mk(S, S); if (!c) return (FLOOD = 0);
  const g = c.getContext('2d'), h = S / 2, gr = g.createRadialGradient(h, h, 20, h, h, h); gr.addColorStop(0, '#ffb43c'); gr.addColorStop(1, '#d8301a');
  g.beginPath(); g.arc(h, h, h - 4, 0, TAU); g.fillStyle = gr; g.fill();
  return (FLOOD = c);
}
// the heart-chamber disc with the flood already painted on (one blit while the flood is fully up, not two layers)
let FLOODED = null;
function floodedArt() {
  if (FLOODED !== null) return FLOODED;
  const d = discArt('py'), f = floodArt(); if (!d || !f) return (FLOODED = 0);
  const c = mk(d.width, d.height); if (!c) return (FLOODED = 0);
  const g = c.getContext('2d'), sc = d.width / ((R + PADR) * 2); g.drawImage(d, 0, 0); g.globalAlpha = 0.82; g.drawImage(f, PADR * sc, PADR * sc, R * 2 * sc, R * 2 * sc);
  return (FLOODED = c);
}
const floodFull = (V) => !!(V && V.o && V.o.flood && V.o.flood.t >= 25);
const hash = (i) => { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; return (h >>> 0) / 4294967296; };

// ------------------------------------------------------------------ arenas (cached disc art)
const DISC = {};
const DS = 0.75, PADR = 150;
function discArt(k) {
  if (DISC[k] !== undefined) return DISC[k];
  const S = Math.ceil((R + PADR) * 2 * DS), c = mk(S, S); DISC[k] = c;
  if (!c) return null;
  const g = c.getContext('2d'); g.scale(DS, DS); g.translate(R + PADR, R + PADR);
  if (k === 'sk') {
    // the frozen lake: pale mirror ice, faint rings, hairline frost veins, snow banks + ice teeth on the rim
    const gr = g.createRadialGradient(-120, -160, 40, 0, 0, R); gr.addColorStop(0, '#f4fbff'); gr.addColorStop(0.6, '#cfe9f8'); gr.addColorStop(1, '#9fcbe6');
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(120,170,210,.25)'; g.lineWidth = 2; for (let r = 90; r < R; r += 90) { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.6;
    for (let i = 0; i < 46; i++) { let a = hash(i) * TAU, rr = hash(i + 99) * R * 0.95, x = Math.cos(a) * rr, y = Math.sin(a) * rr; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 4; j++) { a += (hash(i * 7 + j) - 0.5) * 1.6; x += Math.cos(a) * 26; y += Math.sin(a) * 26; g.lineTo(x, y); } g.stroke(); }
    // the frozen sigil under her (mirror rune)
    g.strokeStyle = 'rgba(110,170,230,.35)'; g.lineWidth = 5; g.beginPath(); g.arc(0, -40, 150, 0, TAU); g.stroke();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 150, -40 + Math.sin(a) * 150); g.lineTo(Math.cos(a + 2.1) * 150, -40 + Math.sin(a + 2.1) * 150); g.stroke(); }
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.lineWidth = 34; g.strokeStyle = '#f7fbff'; g.stroke(); g.lineWidth = 5; g.strokeStyle = INK; g.beginPath(); g.arc(0, 0, R + 17, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, R - 17, 0, TAU); g.lineWidth = 3; g.strokeStyle = 'rgba(80,120,170,.6)'; g.stroke();
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU + hash(i) * 0.05, h = 26 + hash(i + 3) * 30, w = 14; g.save(); g.translate(Math.cos(a) * (R + 22), Math.sin(a) * (R + 22)); g.rotate(a + Math.PI / 2); g.beginPath(); g.moveTo(-w, 0); g.lineTo(0, -h * 0.2); g.lineTo(w, 0); g.lineTo(0, h); g.closePath(); g.fillStyle = i % 2 ? '#dff4ff' : '#bfe6ff'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); g.restore(); }
  } else if (k === 'nf') {
    // the Sun-Eaten Throne: a sandstone disc inlaid with a gold sun, ringed by hieroglyph blocks over a dark sand pit
    const mo = g.createRadialGradient(0, 0, R, 0, 0, R + PADR); mo.addColorStop(0, '#6a4a22'); mo.addColorStop(0.4, '#3a2610'); mo.addColorStop(1, 'rgba(20,10,4,0)');
    g.beginPath(); g.arc(0, 0, R + PADR, 0, TAU); g.fillStyle = mo; g.fill();
    const gr = g.createRadialGradient(-110, -150, 30, 0, 0, R); gr.addColorStop(0, '#f2d79a'); gr.addColorStop(0.65, '#d9b06a'); gr.addColorStop(1, '#b4864a');
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(120,80,30,.28)'; g.lineWidth = 2; // flagstone joints: rings + spokes
    for (let r = 120; r < R; r += 110) { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); }
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU + (i % 2) * 0.06; g.beginPath(); g.moveTo(Math.cos(a) * 120, Math.sin(a) * 120); g.lineTo(Math.cos(a) * (R - 20), Math.sin(a) * (R - 20)); g.stroke(); }
    for (let i = 0; i < 50; i++) { const a = hash(i + 3) * TAU, rr = hash(i + 61) * R * 0.95; g.fillStyle = 'rgba(140,96,40,.18)'; g.beginPath(); g.ellipse(Math.cos(a) * rr, Math.sin(a) * rr, 10 + hash(i) * 18, 4 + hash(i + 1) * 6, a, 0, TAU); g.fill(); }
    // the gold sun inlay under the throne
    g.save(); g.translate(0, -40); g.strokeStyle = 'rgba(255,214,110,.75)'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 150, 0, TAU); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 112, 0, TAU); g.stroke();
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 160, Math.sin(a) * 160); g.lineTo(Math.cos(a + 0.09) * (i % 2 ? 200 : 230), Math.sin(a + 0.09) * (i % 2 ? 200 : 230)); g.lineTo(Math.cos(a + 0.18) * 160, Math.sin(a + 0.18) * 160); g.closePath(); g.fillStyle = i % 2 ? 'rgba(255,200,90,.45)' : 'rgba(255,226,140,.6)'; g.fill(); }
    g.restore();
    // the rim: sandstone blocks with gold caps and hieroglyph marks
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.lineWidth = 30; g.strokeStyle = '#c99a58'; g.stroke(); g.lineWidth = 5; g.strokeStyle = INK; g.beginPath(); g.arc(0, 0, R + 15, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, R - 15, 0, TAU); g.lineWidth = 3; g.strokeStyle = 'rgba(110,70,20,.7)'; g.stroke();
    for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; g.save(); g.translate(Math.cos(a) * R, Math.sin(a) * R); g.rotate(a + Math.PI / 2); g.strokeStyle = 'rgba(90,56,20,.75)'; g.lineWidth = 2.5; g.beginPath(); if (i % 3 === 0) { g.arc(0, 0, 5, 0, TAU); } else if (i % 3 === 1) { g.moveTo(-6, -6); g.lineTo(6, 6); g.moveTo(6, -6); g.lineTo(-6, 6); } else { g.moveTo(-7, 0); g.lineTo(7, 0); g.moveTo(0, -7); g.lineTo(0, 7); } g.stroke(); g.restore(); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; g.save(); g.translate(Math.cos(a) * (R + 30), Math.sin(a) * (R + 30)); g.fillStyle = '#d9b06a'; g.fillRect(-16, -16, 32, 32); g.lineWidth = 4; g.strokeStyle = INK; g.strokeRect(-16, -16, 32, 32); g.fillStyle = '#ffd86a'; g.beginPath(); g.moveTo(-10, -16); g.lineTo(0, -30); g.lineTo(10, -16); g.closePath(); g.fill(); g.stroke(); g.restore(); }
  } else {
    // the heart-chamber: an obsidian floor veined with lava, a magma moat
    const mo = g.createRadialGradient(0, 0, R, 0, 0, R + PADR); mo.addColorStop(0, '#ff9a2a'); mo.addColorStop(0.35, '#e8461a'); mo.addColorStop(1, 'rgba(90,10,10,0)');
    g.beginPath(); g.arc(0, 0, R + PADR, 0, TAU); g.fillStyle = mo; g.fill();
    const gr = g.createRadialGradient(-100, -140, 30, 0, 0, R); gr.addColorStop(0, '#4a3438'); gr.addColorStop(1, '#22161b');
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fillStyle = gr; g.fill();
    g.lineCap = 'round';
    for (let i = 0; i < 14; i++) { let a = i / 14 * TAU + hash(i) * 0.3, x = Math.cos(a) * 110, y = Math.sin(a) * 110; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 7; j++) { a += (hash(i * 11 + j) - 0.5) * 0.7; x += Math.cos(a) * 62; y += Math.sin(a) * 62; if (Math.hypot(x, y) > R - 20) break; g.lineTo(x, y); } g.strokeStyle = 'rgba(255,90,30,.55)'; g.lineWidth = 9; g.stroke(); g.strokeStyle = '#ffc04a'; g.lineWidth = 3; g.stroke(); }
    for (let i = 0; i < 70; i++) { const a = hash(i + 5) * TAU, rr = hash(i + 50) * R * 0.95; g.beginPath(); g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); g.lineTo(Math.cos(a) * rr + 14, Math.sin(a) * rr + 6); g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; g.stroke(); }
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.lineWidth = 8; g.strokeStyle = INK; g.stroke(); g.beginPath(); g.arc(0, 0, R - 9, 0, TAU); g.lineWidth = 6; g.strokeStyle = '#5a3a3e'; g.stroke();
    g.beginPath(); g.arc(0, -40, 170, 0, TAU); g.strokeStyle = 'rgba(255,120,40,.35)'; g.lineWidth = 6; g.stroke();
  }
  return c;
}
/** Draw the arena when the local hero is inside it (replaces the world ground). Returns true when drawn. */
export function drawTrialGround(ctx, view, t, sim, local) {
  const k = local && local.y < -28000 && trialAt(local.x, local.y);
  if (!k || k === 'ul') return false; // (Part F: the Unwritten Throne draws itself, client/ultfx.js)
  const C = TRIAL_POS[k], V = trialView(sim);
  if (k === 'py') { const p = 0.5 + 0.5 * Math.sin(t * 2.2), a = 0.06 + 0.05 * p; ctx.fillStyle = `rgb(${Math.round(28 + (255 - 28) * a)},${Math.round(8 + (70 - 8) * a)},${Math.round(6 + (20 - 6) * a)})`; } // (piece 4 perf: the pulsing magma tint pre-mixed into one opaque fill instead of a second full-screen alpha layer)
  else ctx.fillStyle = k === 'nf' ? '#1c1208' : '#0e1c30';
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  if (k === 'sk') { ctx.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 40; i++) { const x = view.x0 + ((hash(i) * 3000 + t * 18 * (0.5 + hash(i + 1))) % (view.x1 - view.x0)), y = view.y0 + ((hash(i + 7) * 3000 + t * 40 * (0.6 + hash(i + 2))) % (view.y1 - view.y0)); ctx.fillRect(x, y, 3, 3); } }
  const art = k === 'py' && floodFull(V) && floodedArt() ? floodedArt() : discArt(k);
  if (art) ctx.drawImage(art, C.x - R - PADR, C.y - R - PADR, (R + PADR) * 2, (R + PADR) * 2);
  if (k === 'py') { // the heartbeat glow on the floor
    const p = Math.pow(0.5 + 0.5 * Math.sin(t * 5.4), 6);
    if (p > 0.04) { ctx.save(); ctx.globalAlpha = 0.18 * p; circle(ctx, C.x, C.y - 40, 260, '#ff5a20', 0); ctx.restore(); } // (skipped while invisible)
  }
  if (k === 'nf') { const p = 0.5 + 0.5 * Math.sin(t * 1.6); ctx.save(); ctx.globalAlpha = 0.08 + 0.06 * p; circle(ctx, C.x, C.y - 40, 240, '#fff2a0', 0); ctx.restore(); } // (the sun inlay breathes)
  if (V && V.o && V.o.ice) drawIce(ctx, V, C, t);
  return true;
}
function drawIce(ctx, V, C, t) {
  const s = V.o.ice, G = TR.ice.G, c = TR.ice.cell, x0 = C.x - G * c / 2, y0 = C.y - G * c / 2;
  ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y, R - 16, 0, TAU); ctx.clip();
  ctx.strokeStyle = 'rgba(90,140,190,.18)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 1; i < G; i++) { ctx.moveTo(x0 + i * c, y0); ctx.lineTo(x0 + i * c, y0 + G * c); ctx.moveTo(x0, y0 + i * c); ctx.lineTo(x0 + G * c, y0 + i * c); }
  ctx.stroke();
  for (let i = 0; i < s.length; i++) {
    const lv = s.charCodeAt(i) - 48; if (lv <= 0) continue;
    const x = x0 + (i % G) * c, y = y0 + Math.floor(i / G) * c, cx = x + c / 2, cy = y + c / 2;
    if (lv >= 3) { // broken: freezing black water with a ripple and floes
      ctx.fillStyle = '#1b3550'; ctx.fillRect(x + 2, y + 2, c - 4, c - 4);
      ctx.strokeStyle = 'rgba(160,220,255,.5)'; ctx.lineWidth = 2; const ph = (t * 0.8 + hash(i)) % 1; ctx.beginPath(); ctx.arc(cx, cy, 8 + ph * 26, 0, TAU); ctx.globalAlpha = 1 - ph; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#e8f6ff'; ctx.fillRect(cx - 18 + hash(i + 1) * 8, cy + 10, 12, 6);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(x + 2, y + 2, c - 4, c - 4);
      continue;
    }
    ctx.strokeStyle = lv === 2 ? 'rgba(30,60,110,.85)' : 'rgba(40,80,130,.6)'; ctx.lineWidth = lv === 2 ? 3 : 2;
    ctx.beginPath();
    const n = lv === 2 ? 6 : 3;
    for (let j = 0; j < n; j++) { const a = hash(i * 13 + j) * TAU, l = c * (0.3 + 0.25 * hash(i + j)); ctx.moveTo(cx, cy); const mx = cx + Math.cos(a) * l * 0.5 + (hash(j + i) - 0.5) * 8, my = cy + Math.sin(a) * l * 0.5; ctx.lineTo(mx, my); ctx.lineTo(cx + Math.cos(a + 0.2) * l, cy + Math.sin(a + 0.2) * l); }
    ctx.stroke();
    if (lv === 2) { ctx.fillStyle = 'rgba(40,90,150,.18)'; ctx.fillRect(x + 4, y + 4, c - 8, c - 8); }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ under: telegraphs + floor mechanics
const TCOL = { icicle: ['rgba(150,215,255,', '#8fd8ff'], frostbite: ['rgba(120,190,255,', '#6fc0ff'], breath: ['rgba(170,235,255,', '#bff6ff'], beam: ['rgba(210,245,255,', '#ffffff'],
  lunge: ['rgba(100,200,255,', '#5fd0ff'], spikes: ['rgba(190,240,255,', '#e8fbff'], bomb: ['rgba(255,150,40,', '#ffb43c'], meteor: ['rgba(255,190,60,', '#ffd36a'], fist: ['rgba(255,100,40,', '#ff7a3a'],
  snap: ['rgba(255,40,80,', '#ff4a6a'], beatring: ['rgba(255,60,60,', '#ff5a5a'],
  spear: ['rgba(255,214,90,', '#ffd86a'], scarab: ['rgba(60,200,150,', '#6fe0b0'], sand: ['rgba(220,170,90,', '#f0c878'], day: ['rgba(255,240,150,', '#fff2a0'], night: ['rgba(110,60,200,', '#b07cff'],
  judge: ['rgba(255,150,40,', '#ffb43c'], curse: ['rgba(255,80,200,', '#ff7ad8'] };
const CUE_RGB = { away: ['rgba(255,77,94,', '#ff4d5e'], close: ['rgba(77,166,255,', '#4da6ff'], soak: ['rgba(255,210,63,', '#ffd23f'], spread: ['rgba(192,107,255,', '#c06bff'], safe: ['rgba(92,255,157,', '#5cff9d'] };
/** a trial telegraph's cue: GET IN (night) = blue, safe zones = green, otherwise red (the per-kind theme tints were retired) */
const cueCol = (q) => CUE_RGB[q.cue || (q.safe ? 'safe' : q.k === 'night' ? 'close' : cueOf(q))] || CUE_RGB.away;
function telePath(ctx, q, k) {
  if (q.sh === 'circle') ctx.arc(q.x, q.y, Math.max(0.1, q.r * k), 0, TAU);
  else if (q.sh === 'donut') { ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.moveTo(q.x + q.r0, q.y); ctx.arc(q.x, q.y, q.r0, TAU, 0, true); }
  else if (q.sh === 'cone') { ctx.moveTo(q.x, q.y); ctx.arc(q.x, q.y, Math.max(0.1, q.r * k), q.ang - q.arc / 2, q.ang + q.arc / 2); ctx.closePath(); }
  else if (q.sh === 'line') { const c = Math.cos(q.ang), s = Math.sin(q.ang), hw = q.w / 2, L = q.len * k; ctx.moveTo(q.x - s * hw, q.y + c * hw); ctx.lineTo(q.x - s * hw + c * L, q.y + c * hw + s * L); ctx.lineTo(q.x + s * hw + c * L, q.y - c * hw + s * L); ctx.lineTo(q.x + s * hw, q.y - c * hw); ctx.closePath(); }
}
function drawTele(ctx, q, t, ghost = false) {
  const [fill, edge] = cueCol(q), k = clamp01(q.t / q.d);
  if (ghost) { ctx.save(); ctx.globalAlpha *= 0.35; drawTele(ctx, q, t); ctx.restore(); return; } // (Part A1: the game-wide colour grammar, sim/telegraph.js CUES)
  if (q.done) { const f = 1 - (q.t - q.d) / 14; if (f <= 0) return; ctx.save(); ctx.globalAlpha = f * 0.8; ctx.beginPath(); if (q.sh === 'path') { pathLine(ctx, q.pts); ctx.lineWidth = q.w; ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round'; ctx.stroke(); } else { telePath(ctx, q, 1); ctx.fillStyle = '#ffffff'; ctx.fill(); } ctx.restore(); return; }
  ctx.save();
  if (q.sh === 'path') { // the bouncing beam: the whole route, filling from the mouth outward as it charges
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); pathLine(ctx, q.pts); ctx.lineWidth = q.w + 8; ctx.strokeStyle = 'rgba(20,40,70,.55)'; ctx.stroke();
    ctx.lineWidth = q.w; ctx.strokeStyle = fill + '0.22)'; ctx.stroke();
    ctx.setLineDash([18, 14]); ctx.lineDashOffset = -t * 120; ctx.lineWidth = 4; ctx.strokeStyle = edge; ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); pathLine(ctx, q.pts, k); ctx.lineWidth = q.w * 0.55; ctx.strokeStyle = fill + '0.55)'; ctx.stroke();
    for (let i = 2; i + 1 < q.pts.length - 2; i += 2) { circle(ctx, q.pts[i], q.pts[i + 1], 12, '#ffffff', 3); } // bounce points
    ctx.restore(); return;
  }
  const ga = ctx.globalAlpha, rr = Math.round(q.r);
  const so = q.sh === 'circle' && sprite('to' + fill + rr, rr, (g) => { g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.fillStyle = fill + '0.16)'; g.fill(); });
  if (so) { // (sprites: the outer disc, its pulsing rim, the inner disc growing with the charge)
    blit(ctx, so, q.x, q.y);
    ctx.globalAlpha = ga * (0.75 + 0.25 * Math.sin(t * 16)); blit(ctx, sprite('te' + edge + rr, rr, (g) => { g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.lineWidth = 3.5; g.strokeStyle = edge; g.stroke(); }), q.x, q.y); ctx.globalAlpha = ga;
    if (k > 0.02) blit(ctx, sprite('ti' + fill + rr, rr, (g) => { g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.fillStyle = fill + '0.34)'; g.fill(); }), q.x, q.y, k);
  } else {
    ctx.beginPath(); telePath(ctx, q, 1); ctx.fillStyle = fill + '0.16)'; ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = edge; ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 16); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.beginPath(); telePath(ctx, q, k); ctx.fillStyle = fill + '0.34)'; ctx.fill();
  }
  if (q.k === 'meteor' || q.k === 'bomb') { const h = (1 - k) * 380; circle(ctx, q.x + h * 0.35, q.y - h, 16 + 8 * k, q.k === 'bomb' ? '#3a2422' : '#5a3a2a', 4); circle(ctx, q.x + h * 0.35 - 4, q.y - h - 4, 6, '#ffb43c', 0); }
  if (q.k === 'icicle') { const h = (1 - k) * 300; ctx.beginPath(); ctx.moveTo(q.x - 12, q.y - h - 50); ctx.lineTo(q.x + 12, q.y - h - 50); ctx.lineTo(q.x, q.y - h + 6); ctx.closePath(); ctx.fillStyle = '#e8fbff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
  if (q.k === 'scarab') { // the tide: beetles crawling down the lane as it charges
    const c = Math.cos(q.ang), s = Math.sin(q.ang), L = q.len * k;
    for (let i = 0; i < 3; i++) { const f = L - i * 34, off = (i - 1) * q.w * 0.25; if (f < 0) break; const bx = q.x + c * f - s * off, by = q.y + s * f + c * off; ctx.beginPath(); ctx.ellipse(bx, by, 11, 8, q.ang, 0, TAU); ctx.fillStyle = '#1e5a48'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); }
  }
  if (q.k === 'spear') { const h = (1 - k) * 60; circle(ctx, q.x, q.y - h, 16, '#fff2a0', 4); }
  if (q.k === 'day' || q.k === 'night') label(ctx, q.k === 'day' ? 'DAY · GET OUT' : 'NIGHT · GET IN', q.x, q.y - (q.k === 'day' ? q.r + 26 : 0) + (q.k === 'night' ? 120 : 0), 26, q.k === 'day' ? '#fff2a0' : '#d8b8ff', 6);
  if (!(NFK.has(q.k) && nefTeleLabel(ctx, q, k)) && q.n) label(ctx, String(q.n), q.x, q.y, k > 0.75 ? 46 : 38, k > 0.75 ? '#ffffff' : edge, 6);
  ctx.restore();
}
const NFK = new Set(['hammer', 'gullet', 'csun', 'cmoon', 'cscarab', 'sandq', 'psun', 'rim']);
function pathLine(ctx, pts, k = 1) {
  let total = 0; for (let i = 0; i + 3 < pts.length; i += 2) total += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
  let left = total * k; ctx.moveTo(pts[0], pts[1]);
  for (let i = 0; i + 3 < pts.length; i += 2) { const L = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]); if (left >= L) { ctx.lineTo(pts[i + 2], pts[i + 3]); left -= L; } else { const f = L ? left / L : 0; ctx.lineTo(pts[i] + (pts[i + 2] - pts[i]) * f, pts[i + 1] + (pts[i + 3] - pts[i + 1]) * f); break; } }
}
let DIVE = 0, XART = 0;
/** the trial's share of the governor's scene load (balance pass perf): its telegraphs / pools / rafts are not sim areas, so
 *  a heavy trial phase read as an empty scene and the governor kept probing a level up mid-fight (each change = a hitch) */
export function trialLoad(sim) { const V = trialView(sim); if (!V) return 0; const O = V.o || {}; return 6 + (V.tele || []).length * 2 + (O.pools || []).length + (O.rafts || []).length + (O.flood ? 4 : 0); }
export function drawTrialUnder(ctx, sim, local, t) {
  const V = trialView(sim); DIVE = 0;
  if (!V || !local || trialAt(local.x, local.y) !== V.k) return;
  const C = TRIAL_POS[V.k], O = V.o || {}, b = sim.enemyById && sim.enemyById.get(V.bid);
  DIVE = V.dive; XART = V.x;
  if (O.zero) { ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y, R, 0, TAU); ctx.arc(C.x, C.y, O.zero.r, 0, TAU, true); ctx.fillStyle = 'rgba(225,240,255,.55)'; ctx.fill('evenodd'); ctx.beginPath(); ctx.arc(C.x, C.y, O.zero.r, 0, TAU); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#9fe8ff'; ctx.setLineDash([16, 10]); ctx.lineDashOffset = t * 40; ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
  if (O.pools && O.pools.length) { // (sprite per radius; every pool's bubbles go into one stroked path)
    const ga = ctx.globalAlpha; ctx.beginPath();
    for (const q of O.pools) { const pr = Math.round(q.r); ctx.globalAlpha = ga * Math.min(1, q.life / 30); blit(ctx, sprite('pool' + pr, pr + 4, (g) => { circle(g, 0, 0, pr, '#e8461a', 4); circle(g, -10, -8, pr * 0.55, '#ff9a2a', 0); }), q.x, q.y); if (q.life < 30) continue; for (let i = 0; i < 3; i++) { const ph = (t * 1.4 + i / 3 + hash(q.x)) % 1, bx = q.x + Math.cos(i * 2.1) * q.r * 0.5, by = q.y + Math.sin(i * 2.1) * q.r * 0.4, br = 3 + ph * 6; ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, TAU); } }
    ctx.globalAlpha = ga; ctx.lineWidth = 2; ctx.strokeStyle = '#ffd36a'; ctx.stroke();
  }
  if (O.flood) { const k = clamp01(O.flood.t / 25); ctx.save(); ctx.globalAlpha = 0.82 * k; const fa = floodArt(); if (k >= 1 && floodedArt()) { /* baked into the floor blit (drawTrialGround) */ } else if (fa) ctx.drawImage(fa, C.x - R, C.y - R, R * 2, R * 2); else { ctx.beginPath(); ctx.arc(C.x, C.y, R - 8, 0, TAU); const g = ctx.createRadialGradient(C.x, C.y, 40, C.x, C.y, R); g.addColorStop(0, '#ffb43c'); g.addColorStop(1, '#d8301a'); ctx.fillStyle = g; ctx.fill(); } ctx.globalAlpha = 0.35 * k; { ctx.beginPath(); for (let i = 0; i < 18; i++) { const a = hash(i) * TAU + t * 0.2, rr = hash(i + 4) * R * 0.9, gx = C.x + Math.cos(a) * rr, gy = C.y + Math.sin(a) * rr, gr = 8 + 6 * Math.sin(t * 3 + i); ctx.moveTo(gx + gr, gy); ctx.arc(gx, gy, gr, 0, TAU); } ctx.fillStyle = '#fff2a0'; ctx.fill(); } /* (one path, one fill) */ ctx.restore(); }
  for (const q of O.rafts || []) { const qr = Math.round(q.r), fl = O.flood ? 1 : 0; blit(ctx, sprite('raft' + qr + fl, qr + 4, (g) => { circle(g, 0, 0, qr, '#2b1e24', 5); circle(g, -qr * 0.2, -qr * 0.25, qr * 0.55, '#3d2c33', 0); g.globalAlpha = 0.6; circle(g, 0, 0, qr - 6, null, 3, fl ? '#7dffb0' : '#ff9a4a'); }), q.x, q.y); }
  if (O.light) drawLight(ctx, O.light, C, t);
  for (const q of O.shades || []) drawShade(ctx, q, C, t);
  for (const v of O.valves || []) drawValve(ctx, v, t);
  for (const f of O.fires || []) drawFire(ctx, f, t);
  for (const w of O.walls || []) drawWall(ctx, w, t);
  if (O.pillars && b) for (const q of O.pillars) shadowWedge(ctx, b, q, C, O.gaze);
  if (V.k === 'nf') { drawNefUnder(ctx, V, C, t, b); const H = nefTeleHide(V); for (const q of V.tele || []) if (!H.hide.has(q.id)) drawTele(ctx, q, t, H.ghost(q)); }
  else for (const q of V.tele || []) drawTele(ctx, q, t);
  for (const g of O.rings || []) { ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y - 40, g.r, g.gap + g.arc / 2, g.gap - g.arc / 2 + TAU); ctx.lineWidth = 22; ctx.strokeStyle = 'rgba(255,60,40,.55)'; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#ffd36a'; ctx.stroke(); ctx.restore(); }
  for (const s of O.shadows || []) drawShadow(ctx, s, t, sim);
  if (O.gaze && b) drawGaze(ctx, b, O.gaze, C, t);
}
function drawShade(ctx, q, C, t) { // an obsidian obelisk and its cool shade pool
  ctx.save(); ctx.globalAlpha = 0.5; circle(ctx, q.x, q.y, q.r, 'rgba(40,40,110,.55)', 0); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 20; ctx.lineWidth = 3; ctx.strokeStyle = '#9fd8ff'; ctx.stroke(); ctx.setLineDash([]);
  const a = Math.atan2(q.y - C.y, q.x - C.x), ox = q.x - Math.cos(a) * 20, oy = q.y - Math.sin(a) * 20;
  ctx.beginPath(); ctx.moveTo(ox - 14, oy + 8); ctx.lineTo(ox - 10, oy - 64); ctx.lineTo(ox, oy - 80); ctx.lineTo(ox + 10, oy - 64); ctx.lineTo(ox + 14, oy + 8); ctx.closePath(); ctx.fillStyle = '#2e2440'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ox - 10, oy - 64); ctx.lineTo(ox, oy - 80); ctx.lineTo(ox + 10, oy - 64); ctx.closePath(); ctx.fillStyle = '#ffd86a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore();
}
function drawLight(ctx, L, C, t) { // the Black Sun: the throne goes dark except one wandering patch of light
  ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y, R, 0, TAU); ctx.arc(L.x, L.y, L.r, 0, TAU, true); ctx.fillStyle = 'rgba(14,4,28,.62)'; ctx.fill('evenodd');
  ctx.globalAlpha = 0.18 + 0.06 * Math.sin(t * 5); circle(ctx, L.x, L.y, L.r, '#fff2a0', 0); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(L.x, L.y, L.r, 0, TAU); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#ffd86a'; ctx.setLineDash([16, 10]); ctx.lineDashOffset = -t * 40; ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}
function drawValve(ctx, v, t) {
  circle(ctx, v.x, v.y, 42, '#3a2a2c', 5); circle(ctx, v.x, v.y, 26, v.on ? '#ff6a2a' : '#5a4a48', 3);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + t * (v.on ? 2 : 0.2); ctx.beginPath(); ctx.moveTo(v.x + Math.cos(a) * 28, v.y + Math.sin(a) * 28); ctx.lineTo(v.x + Math.cos(a) * 40, v.y + Math.sin(a) * 40); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); }
  if (!v.on) return;
  const k = clamp01(v.p / 100), col = k > 0.75 ? '#ff3b3b' : k > 0.45 ? '#ffb43c' : '#7dffb0';
  ctx.save(); ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * (6 + k * 14)); circle(ctx, v.x, v.y, TR.valve.r, col, 0); ctx.restore();
  ctx.beginPath(); ctx.arc(v.x, v.y, 58, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = col; ctx.stroke();
  ctx.beginPath(); ctx.arc(v.x, v.y, TR.valve.r, 0, TAU); ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 30; ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke(); ctx.setLineDash([]);
  if (k > 0.7) { ctx.save(); ctx.globalAlpha = 0.6; for (let i = 0; i < 5; i++) { const ph = (t * 2 + i / 5) % 1; circle(ctx, v.x + Math.sin(i * 3 + t) * 10, v.y - ph * 90, 6 + ph * 10, '#bba8a0', 0); } ctx.restore(); }
  label(ctx, `${Math.round(v.p)}%`, v.x, v.y - 74, 20, col, 4);
}
function drawFire(ctx, f, t) {
  const gut = f.life < TR.chill.warn, fl = gut ? 0.5 + 0.5 * Math.sin(t * 20) : 1;
  ctx.save(); ctx.globalAlpha = 0.22 * fl; circle(ctx, f.x, f.y, TR.chill.fire, '#ffb43c', 0); ctx.restore();
  ctx.beginPath(); ctx.arc(f.x, f.y, TR.chill.fire, 0, TAU); ctx.setLineDash([12, 9]); ctx.lineWidth = 3; ctx.strokeStyle = '#ffcf4a'; ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.ellipse(f.x, f.y + 8, 26, 12, 0, 0, TAU); ctx.fillStyle = '#5a4a48'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  const h = (gut ? 18 : 34) * (0.9 + 0.1 * Math.sin(t * 13));
  ctx.beginPath(); ctx.moveTo(f.x - 16, f.y + 4); ctx.quadraticCurveTo(f.x - 18, f.y - h * 0.6, f.x, f.y - h); ctx.quadraticCurveTo(f.x + 18, f.y - h * 0.6, f.x + 16, f.y + 4); ctx.closePath(); ctx.fillStyle = '#ff8a2a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(f.x - 7, f.y + 2); ctx.quadraticCurveTo(f.x, f.y - h * 0.7, f.x + 7, f.y + 2); ctx.fillStyle = '#ffe27a'; ctx.fill();
  if (f.nx != null) { // the next brazier: where to go when this one gutters
    ctx.save(); ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 8); ctx.beginPath(); ctx.arc(f.nx, f.ny, TR.chill.fire, 0, TAU); ctx.setLineDash([6, 10]); ctx.lineWidth = 4; ctx.strokeStyle = '#ffcf4a'; ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.nx, f.ny); ctx.setLineDash([4, 14]); ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]); label(ctx, 'NEXT FIRE', f.nx, f.ny, 18, '#ffcf4a', 4); ctx.restore();
  }
}
function drawWall(ctx, w, t) {
  ctx.save(); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(w.x1, w.y1 + 10); ctx.lineTo(w.x2, w.y2 + 10); ctx.lineWidth = 20; ctx.strokeStyle = 'rgba(20,40,70,.25)'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.lineWidth = 22; ctx.strokeStyle = INK; ctx.stroke();
  const g = ctx.createLinearGradient(w.x1, w.y1, w.x2, w.y2); g.addColorStop(0, '#bfe8ff'); g.addColorStop(0.5 + 0.3 * Math.sin(t * 1.5), '#ffffff'); g.addColorStop(1, '#9fd4ff');
  ctx.lineWidth = 14; ctx.strokeStyle = g; ctx.stroke();
  ctx.restore();
}
function shadowWedge(ctx, b, q, C, G) { // the safe shadow behind an obsidian pillar (green while the gaze is up)
  const a = Math.atan2(q.y - b.y, q.x - b.x), d = Math.hypot(q.x - b.x, q.y - b.y), h = Math.asin(Math.min(1, q.r / d)), L = R * 2;
  ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y, R - 4, 0, TAU); ctx.clip(); ctx.beginPath();
  ctx.moveTo(q.x + Math.cos(a - Math.PI / 2) * q.r, q.y + Math.sin(a - Math.PI / 2) * q.r);
  ctx.lineTo(b.x + Math.cos(a - h) * L, b.y + Math.sin(a - h) * L); ctx.lineTo(b.x + Math.cos(a + h) * L, b.y + Math.sin(a + h) * L);
  ctx.lineTo(q.x + Math.cos(a + Math.PI / 2) * q.r, q.y + Math.sin(a + Math.PI / 2) * q.r); ctx.closePath();
  ctx.fillStyle = G && G.on ? 'rgba(80,255,150,.22)' : 'rgba(80,255,150,.12)'; ctx.fill();
  ctx.restore();
  // the pillar itself (obsidian, with a hot core)
  ctx.save(); ctx.beginPath(); ctx.ellipse(q.x, q.y + q.r * 0.5, q.r * 1.05, q.r * 0.45, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
  ctx.beginPath(); for (let i = 0; i < 6; i++) { const aa = i / 6 * TAU + 0.3; ctx.lineTo(q.x + Math.cos(aa) * q.r, q.y + Math.sin(aa) * q.r * 0.8 - 30); } ctx.closePath(); ctx.fillStyle = '#2a1e26'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = '#3a2a34'; ctx.fillRect(q.x - q.r * 0.9, q.y - 30, q.r * 1.8, 30); ctx.strokeRect(q.x - q.r * 0.9, q.y - 30, q.r * 1.8, 30);
  ctx.beginPath(); for (let i = 0; i < 6; i++) { const aa = i / 6 * TAU + 0.3; ctx.lineTo(q.x + Math.cos(aa) * q.r * 0.86, q.y + Math.sin(aa) * q.r * 0.68 - 32); } ctx.closePath(); ctx.fillStyle = '#5a4352'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#ffb06a'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(q.x - q.r * 0.3, q.y - 52); ctx.lineTo(q.x + q.r * 0.2, q.y - 20); ctx.lineWidth = 3; ctx.strokeStyle = '#ff7a3a'; ctx.stroke();
  ctx.restore();
}
function drawGaze(ctx, b, G, C, t) {
  ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y, R, 0, TAU); ctx.clip();
  const L = R * 2.2;
  if (!G.on) { // the warning: the eye's starting line + its turning direction
    ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 14); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(G.a) * L, b.y + Math.sin(G.a) * L); ctx.lineWidth = 6; ctx.setLineDash([20, 12]); ctx.strokeStyle = '#ff6a2a'; ctx.stroke(); ctx.setLineDash([]);
    const aa = G.a + G.dir * 0.35; ctx.beginPath(); ctx.arc(b.x, b.y, 220, G.a, aa, G.dir < 0); ctx.lineWidth = 8; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x + Math.cos(aa) * 220, b.y + Math.sin(aa) * 220); ctx.lineTo(b.x + Math.cos(aa - G.dir * 0.08) * 240, b.y + Math.sin(aa - G.dir * 0.08) * 240); ctx.lineTo(b.x + Math.cos(aa - G.dir * 0.08) * 200, b.y + Math.sin(aa - G.dir * 0.08) * 200); ctx.closePath(); ctx.fillStyle = '#ff6a2a'; ctx.fill();
  } else {
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, L, G.a - G.w / 2, G.a + G.w / 2); ctx.closePath(); ctx.fillStyle = 'rgba(255,120,40,.45)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, L, G.a - G.w / 5, G.a + G.w / 5); ctx.closePath(); ctx.fillStyle = 'rgba(255,240,180,.55)'; ctx.fill();
  }
  ctx.restore();
}
function drawShadow(ctx, s, t, sim) {
  const p = sim.players && sim.players.get ? sim.players.get(s.pid) : null; void p;
  ctx.save(); ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.ellipse(s.x, s.y + 14, 18, 7, 0, 0, TAU); ctx.fillStyle = 'rgba(40,80,130,.35)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(s.x - 15, s.y + 12); ctx.quadraticCurveTo(s.x - 18, s.y - 20, s.x, s.y - 30); ctx.quadraticCurveTo(s.x + 18, s.y - 20, s.x + 15, s.y + 12); ctx.closePath();
  ctx.fillStyle = 'rgba(200,240,255,.75)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#2a5a8a'; ctx.stroke();
  circle(ctx, s.x, s.y - 32, 11, 'rgba(225,248,255,.85)', 3);
  circle(ctx, s.x - 4, s.y - 33, 2.4, '#2a5a8a', 0); circle(ctx, s.x + 4, s.y - 33, 2.4, '#2a5a8a', 0);
  ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 6); circle(ctx, s.x, s.y - 8, 36, null, 3, '#9fe8ff');
  ctx.restore();
}

// ------------------------------------------------------------------ over: balls, tethers, the eye, chill, the exit
export function drawTrialOver(ctx, sim, local, t) {
  const V = trialView(sim);
  if (!V || !local || trialAt(local.x, local.y) !== V.k) return;
  const C = TRIAL_POS[V.k], O = V.o || {}, b = sim.enemyById && sim.enemyById.get(V.bid);
  if (O.teth && b) for (const q of O.teth) { const p = sim.players.get(q.pid); if (!p || p.dead) continue; const d = Math.hypot(p.x - b.x, p.y - b.y), ok = d >= (O.tmin || 320);
    ctx.save(); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b.x, b.y); const mx = (b.x + p.x) / 2 + Math.sin(t * 7 + q.pid) * 14, my = (b.y + p.y) / 2 + Math.cos(t * 6) * 14; ctx.quadraticCurveTo(mx, my, p.x, p.y);
    ctx.lineWidth = 11; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = ok ? '#7dffb0' : (Math.sin(t * 18) > 0 ? '#ff3b5c' : '#ff9aa8'); ctx.stroke();
    const ph = (t * 1.6) % 1; circle(ctx, b.x + (p.x - b.x) * ph, b.y + (p.y - b.y) * ph, 6, '#ff4a6a', 2); ctx.restore();
    if (p.id === local.id && !ok) label(ctx, 'STRETCH IT!', p.x, p.y - 74, 18, '#ff6a7a', 4); }
  for (const q of O.balls || []) drawBall(ctx, q, C, t);
  if (O.eye && b) drawEye(ctx, b, O.eye, t);
  if (O.heat) for (const id in O.heat) { const p = sim.players.get(+id) || sim.players.get(id); if (!p || p.dead) continue; const k = clamp01(O.heat[id] / 100), w = 46; ctx.fillStyle = INK; ctx.fillRect(p.x - w / 2 - 2, p.y + 26, w + 4, 9); ctx.fillStyle = k > 0.75 ? '#ffffff' : '#ffb43c'; ctx.fillRect(p.x - w / 2, p.y + 28, w * k, 5); if (k > 0.75) { ctx.save(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 12); circle(ctx, p.x, p.y - 10, 30, null, 4, '#ffd86a'); ctx.restore(); } }
  if (O.light && b && V.st === 'fight') drawBlackSun(ctx, b, t);
  if (V.k === 'nf') { drawNefSky(ctx, V, C, t, b); drawNefOver(ctx, V, C, t, b, sim, local); }
  if (O.chill) for (const id in O.chill) { const p = sim.players.get(+id) || sim.players.get(id); if (!p || p.dead) continue; const k = clamp01(O.chill[id] / 100), w = 46; ctx.fillStyle = INK; ctx.fillRect(p.x - w / 2 - 2, p.y + 26, w + 4, 9); ctx.fillStyle = k > 0.75 ? '#ffffff' : '#7fd0ff'; ctx.fillRect(p.x - w / 2, p.y + 28, w * k, 5); if (k > 0.75) { ctx.save(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 12); circle(ctx, p.x, p.y - 10, 30, null, 4, '#e8fbff'); ctx.restore(); } }
  if (V.st === 'victory') { const ex = C.x, ey = C.y + TRIAL_EXIT_DY; ctx.save(); for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.5 + 0.2 * i; ctx.beginPath(); ctx.arc(ex, ey, 34 - i * 9, t * (2 + i), t * (2 + i) + 4.5); ctx.lineWidth = 6; ctx.strokeStyle = i === 1 ? '#ffffff' : fightCol(V); ctx.stroke(); } ctx.restore(); label(ctx, 'EXIT', ex, ey - 52, 20, '#ffffff', 4); }
}
function drawBlackSun(ctx, b, t) { const x = b.x, y = b.y - b.r - 150, r = 46 + 3 * Math.sin(t * 4); ctx.save(); ctx.globalAlpha = 0.5; circle(ctx, x, y, r + 26, '#7a40d8', 0); ctx.globalAlpha = 1; for (let i = 0; i < 12; i++) { const a = t * 0.8 + i / 12 * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.lineTo(x + Math.cos(a + 0.12) * (r + 22 + 8 * Math.sin(t * 6 + i)), y + Math.sin(a + 0.12) * (r + 22 + 8 * Math.sin(t * 6 + i))); ctx.lineWidth = 4; ctx.strokeStyle = '#c9a2ff'; ctx.stroke(); } circle(ctx, x, y, r, '#08040e', 5); circle(ctx, x, y, r - 6, null, 2, '#ffd86a'); ctx.restore(); }
function drawBall(ctx, q, C, t) {
  // the arrow: where it rolls next, up to its next bounce on the rim
  const sp = Math.hypot(q.vx, q.vy) || 1, dx = q.vx / sp, dy = q.vy / sp, fx = q.x - C.x, fy = q.y - C.y, bq = fx * dx + fy * dy, cq = fx * fx + fy * fy - (R - q.r) ** 2, tc = Math.max(0, -bq + Math.sqrt(Math.max(0, bq * bq - cq)));
  const ex = q.x + dx * tc, ey = q.y + dy * tc;
  ctx.save(); ctx.setLineDash([16, 12]); ctx.lineDashOffset = -t * 90; ctx.beginPath(); ctx.moveTo(q.x + dx * q.r, q.y + dy * q.r); ctx.lineTo(ex, ey); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke(); ctx.setLineDash([]);
  circle(ctx, ex, ey, 10, '#ff5a6a', 3);
  const ax = q.x + dx * (q.r + 46), ay = q.y + dy * (q.r + 46), a = Math.atan2(dy, dx); ctx.beginPath(); ctx.moveTo(ax + Math.cos(a) * 22, ay + Math.sin(a) * 22); ctx.lineTo(ax + Math.cos(a + 2.5) * 18, ay + Math.sin(a + 2.5) * 18); ctx.lineTo(ax + Math.cos(a - 2.5) * 18, ay + Math.sin(a - 2.5) * 18); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.ellipse(q.x, q.y + q.r * 0.75, q.r * 0.95, q.r * 0.3, 0, 0, TAU); ctx.fillStyle = 'rgba(30,60,100,.3)'; ctx.fill();
  const g = ctx.createRadialGradient(q.x - q.r * 0.35, q.y - q.r * 0.45, q.r * 0.1, q.x, q.y, q.r); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#bcdcf0');
  ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
  const roll = (q.x + q.y) / q.r; ctx.clip(); ctx.strokeStyle = 'rgba(120,170,210,.6)'; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) { const aa = roll + i * 2.1; ctx.beginPath(); ctx.arc(q.x + Math.cos(aa) * q.r * 0.5, q.y + Math.sin(aa) * q.r * 0.5, q.r * 0.35, 0, TAU); ctx.stroke(); }
  ctx.restore();
}
function drawEye(ctx, b, E, t) {
  const x = b.x, y = b.y - b.r - 120, open = E.s === 'open' ? 1 : E.s === 'warn' ? clamp01(E.t / Math.max(1, E.d)) * 0.6 : 0.05;
  ctx.save();
  if (E.s === 'open') { ctx.globalAlpha = 0.25; circle(ctx, x, y, 120, '#ff3b5c', 0); ctx.globalAlpha = 1; }
  ctx.beginPath(); ctx.ellipse(x, y, 74, 44 * open + 3, 0, 0, TAU); ctx.fillStyle = '#f4fbff'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
  if (open > 0.2) { ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, 74, 44 * open + 3, 0, 0, TAU); ctx.clip(); circle(ctx, x, y, 26, E.s === 'open' ? '#ff3b5c' : '#5fb8ff', 4); circle(ctx, x, y, 11, INK, 0); circle(ctx, x - 7, y - 8, 5, '#ffffff', 0); ctx.restore(); }
  ctx.beginPath(); ctx.moveTo(x - 82, y); ctx.quadraticCurveTo(x, y - 44 * open - 40, x + 82, y); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
  label(ctx, E.s === 'open' ? 'FREEZE!' : E.s === 'warn' ? 'STOP...' : 'MOVE', x, y + 70, E.s === 'open' ? 34 : 26, E.s === 'open' ? '#ff4a6a' : E.s === 'warn' ? '#ffd36a' : '#7dffb0', 6);
  ctx.restore();
}

// ------------------------------------------------------------------ the trial bosses (classic Skaldra / Pyrrhex art + a crown / Extreme aura)
function crown(ctx, e, t, col) {
  ctx.save(); ctx.globalAlpha *= 0.5 + 0.2 * Math.sin(t * 3); ctx.beginPath(); ctx.arc(0, 0, e.r * 1.35, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = col; ctx.setLineDash([14, 10]); ctx.lineDashOffset = t * 30; ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}
ENEMY_DRAW.trskaldra = function (ctx, e, t, col) { crown(ctx, e, t, '#bff6ff'); ENEMY_DRAW.skaldra(ctx, DIVE ? { ...e, untargetable: 1 } : e, t, col); };
ENEMY_DRAW.trskaldrax = function (ctx, e, t, col) { crown(ctx, e, t, '#d8b8ff'); crown(ctx, { r: e.r * 1.18 }, -t, '#8f6bff'); ENEMY_DRAW.skaldra(ctx, DIVE ? { ...e, untargetable: 1 } : e, t, shade(col, 0.05)); };
ENEMY_DRAW.trpyrrhex = function (ctx, e, t, col) { crown(ctx, e, t, '#ffcf4a'); ENEMY_DRAW.pyrrhex(ctx, e, t, col); };
ENEMY_DRAW.trneferakh = function (ctx, e, t, col) { crown(ctx, e, t, '#ffd86a'); ENEMY_DRAW.neferakh(ctx, e, t, col); };
ENEMY_DRAW.trneferakhx = function (ctx, e, t, col) { crown(ctx, e, t, '#c9a2ff'); crown(ctx, { r: e.r * 1.18 }, -t, '#ffd86a'); ENEMY_DRAW.neferakh(ctx, e, t, col); };
ENEMY_DRAW.trpyrrhexx = function (ctx, e, t, col) { crown(ctx, e, t, '#ff8ab0'); crown(ctx, { r: e.r * 1.18 }, -t, '#ff2a6a'); ENEMY_DRAW.pyrrhex(ctx, e, t, col); };
void XART;

// ------------------------------------------------------------------ HUD
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
/** Boss bar + phase gates, enrage clock, mechanic names, cards, the chill meter, the beat track, the wipe screen. Returns
 *  the y under the bar (0 = not in a trial). sc = HUD scale (phone < 1). */
export function drawTrialHud(ctx, sim, p, w, h, sc, txt, bar, time = 0) {
  const V = trialView(sim);
  if (!V || !p || trialAt(p.x, p.y) !== V.k) return 0;
  const b = sim.enemyById && sim.enemyById.get(V.bid), PH = phaseList(V), col = fightCol(V);
  let y = 96 * sc;
  const bbw = Math.min(700 * sc, w * (sc < 1 ? 0.6 : 0.58)), bbx = w / 2 - bbw / 2, H = Math.round(20 * sc);
  if (V.st !== 'wipe' && V.st !== 'victory') {
    txt(ctx, trialNameOf(V), w / 2, y - 4 * sc, Math.round(21 * sc), col, 'center');
    const k = b ? Math.max(0, b.hp / b.maxHp) : V.st === 'kill' ? 0 : 1;
    bar(ctx, bbx, y + 10 * sc, bbw, H, k, V.k === 'nf' ? (V.ph >= 4 ? '#b07cff' : V.ph === 3 ? '#ff9a3a' : V.ph === 2 ? '#ffd86a' : '#f0c878') : V.k === 'sk' ? (V.ph >= 4 ? '#ffffff' : V.ph === 3 ? '#9fe8ff' : V.ph === 2 ? '#b98cff' : '#6fb8ff') : (V.ph >= 4 ? '#ff2a6a' : V.ph === 3 ? '#ffb43c' : V.ph === 2 ? '#ff6a3a' : '#ff8a4a'), b && sc >= 1 ? `${Math.ceil(b.hp)} / ${b.maxHp}` : null);
    for (const ph of PH) if (ph.floor > 0) { ctx.fillStyle = INK; ctx.fillRect(bbx + bbw * ph.floor - 2, y + 8 * sc, 4, H + 4); }
    // the enrage clock (right of the bar) + the phase line under it
    const left = Math.max(0, (V.enr - V.t) / 60), ecol = left < 30 ? (Math.sin(time * 10) > 0 ? '#ff3b5c' : '#ffffff') : left < 90 ? '#ffb43c' : '#ffffff';
    const phone = sc < 1; // (phones: the clock joins the phase line so it never slides under the ultimate button)
    if (!phone) txt(ctx, `ENRAGE ${mmss(left)}`, bbx + bbw + 10 * sc, y + 10 * sc + H / 2 + 5 * sc, Math.round(15 * sc), ecol, 'left', 3);
    const ph = PH[Math.max(0, V.ph - 1)], mech = (V.mechs || []).map((id) => MECH_NAMES[id] || id).join(' + ');
    const line = (phone && V.st !== 'enrage' ? `ENRAGE ${mmss(left)} · ` : '') + (V.st === 'pull' ? 'The pull' : V.st === 'set' ? 'THE SUNBEARER · carry the sun to the altar' : V.st === 'eclipse' ? 'THE ECLIPSE ASCENDANT · he transforms' : V.st === 'trans' ? `${V.form ? 'Eclipse' : 'Phase'} ${V.ph + 1} incoming` : V.st === 'enrage' ? 'ENRAGE' : V.st === 'kill' ? 'Defeated' : `${V.form ? 'Eclipse' : 'Phase'} ${V.ph}/${V.nph} · ${ph ? ph.name : ''}${mech ? ' · ' + mech : ''}`);
    txt(ctx, `${line}${V.wipes ? ` · attempt ${V.wipes + 1}` : ''}`, w / 2, y + 10 * sc + H + 14 * sc, Math.round(13 * sc), '#e2e8ff', 'center', 3);
    y += 10 * sc + H + 24 * sc;
    if (V.gate && V.st !== 'set') { txt(ctx, 'PHASE BROKEN: the next phase starts after this mechanic', w / 2, y + 4 * sc, Math.round(12 * sc), '#fff2b0', 'center', 3); y += 16 * sc; }
    if (V.chk) { const l2 = Math.max(0, (V.chk.d - V.chk.t) / 60); txt(ctx, `${V.k === 'sk' ? 'ABSOLUTE ZERO' : V.k === 'nf' ? 'THE BLACK SUN' : 'HEART OF THE WORLD'} · ${l2.toFixed(0)}s · burn her down!`, w / 2, y + 8 * sc, Math.round(16 * sc), l2 < 10 ? '#ff5a6a' : '#ffffff', 'center', 3); ctx.fillStyle = INK; ctx.fillRect(bbx + bbw * 0.2 - 2, y + 15 * sc, bbw * 0.6 + 4, 9 * sc); ctx.fillStyle = col; ctx.fillRect(bbx + bbw * 0.2, y + 17 * sc, bbw * 0.6 * (l2 / (V.chk.d / 60)), 5 * sc); y += 30 * sc; }
  }
  const O = V.o || {};
  // the chill meter (Heart of Winter)
  if (O.chill && O.chill[p.id] != null && V.st === 'fight') { const k = clamp01(O.chill[p.id] / 100), ww = 260 * sc, xx = w / 2 - ww / 2, yy = h - 150 * sc; txt(ctx, k > 0.75 ? 'FREEZING! get to a brazier' : 'CHILL', w / 2, yy - 8 * sc, Math.round(15 * sc), k > 0.75 ? '#ffffff' : '#9fe8ff', 'center', 3); ctx.fillStyle = INK; ctx.fillRect(xx - 3, yy - 1, ww + 6, 16 * sc + 2); ctx.fillStyle = '#1b3550'; ctx.fillRect(xx, yy + 1, ww, 16 * sc - 2); ctx.fillStyle = k > 0.75 ? '#ffffff' : '#7fd0ff'; ctx.fillRect(xx, yy + 1, ww * k, 16 * sc - 2); }
  // the heat meter (Sun-Eaten)
  if (O.heat && O.heat[p.id] != null && V.st === 'fight') { const k = clamp01(O.heat[p.id] / 100), ww = 260 * sc, xx = w / 2 - ww / 2, yy = h - 150 * sc; txt(ctx, k > 0.75 ? 'SCORCHING! get into the shade' : 'HEAT', w / 2, yy - 8 * sc, Math.round(15 * sc), k > 0.75 ? '#ffffff' : '#ffd86a', 'center', 3); ctx.fillStyle = INK; ctx.fillRect(xx - 3, yy - 1, ww + 6, 16 * sc + 2); ctx.fillStyle = '#3a2410'; ctx.fillRect(xx, yy + 1, ww, 16 * sc - 2); ctx.fillStyle = k > 0.75 ? '#ffffff' : '#ffb43c'; ctx.fillRect(xx, yy + 1, ww * k, 16 * sc - 2); }
  // the Arrhythmia beat track: beats slide in from the right to the hit line (RED = dodge exactly then)
  if (O.beat) {
    const B = O.beat, ww = 420 * sc, xx = w / 2 - ww / 2, yy = h * 0.7, hitX = xx + 60 * sc, pxPerT = 2.2 * sc;
    ctx.fillStyle = 'rgba(10,6,12,.7)'; ctx.fillRect(xx, yy - 22 * sc, ww, 44 * sc); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(xx, yy - 22 * sc, ww, 44 * sc);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(hitX - 2, yy - 24 * sc, 4, 48 * sc);
    for (let i = 0; i < B.n; i++) { const dt = B.first + i * B.every - B.t, x = hitX + dt * pxPerT; if (x < xx - 10 || x > xx + ww) continue; const red = B.red.includes(i), pop = Math.abs(dt) < 6; circle(ctx, x, yy, (red ? 15 : 9) * sc * (pop ? 1.35 : 1), red ? '#ff3b5c' : '#ffb7a0', 3); if (red) txt(ctx, 'DODGE', x, yy - 26 * sc, Math.round(11 * sc), '#ff6a7a', 'center', 3); }
    txt(ctx, 'ARRHYTHMIA · dodge-roll on RED', w / 2, yy + 36 * sc, Math.round(13 * sc), '#ffd0d8', 'center', 3);
  }
  // the name card + the boss line
  const c = V.call;
  if (c) {
    const age = (c.d - c.t) / 60, pop = Math.max(0, 1 - age * 4), fade = Math.min(1, c.t / 20), cy = h * (sc < 1 ? 0.33 : 0.3);
    ctx.save(); ctx.globalAlpha = fade * 0.55; const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, V.k === 'sk' ? 'rgba(10,24,48,.9)' : V.k === 'nf' ? 'rgba(48,30,6,.9)' : 'rgba(40,10,8,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, cy - 40 * sc, w, 84 * sc); ctx.restore();
    ctx.save(); ctx.globalAlpha = fade; ctx.translate(w / 2, cy); const s = 1 + Math.round(pop * 3) / 10; ctx.scale(s, s); // (piece 4 perf: the pop steps 1.3 / 1.2 / 1.1 / 1: 4 text bakes per card instead of one per frame)
    txt(ctx, c.txt, 0, 0, Math.round((c.txt.length > 22 ? 34 : 42) * sc), c.col, 'center', Math.round(8 * sc));
    if (c.sub) txt(ctx, c.sub, 0, 30 * sc, Math.round(16 * sc), '#ffffff', 'center', 4);
    ctx.restore();
  }
  if (V.line) { const f = Math.min(1, V.line.t / 20); ctx.save(); ctx.globalAlpha = f; txt(ctx, `“${V.line.txt}”`, w / 2, h - 96 * sc, Math.round(17 * sc), col, 'center', 4); ctx.restore(); }
  if (V.st === 'enrage') { ctx.save(); ctx.globalAlpha = clamp01(V.at / 200) * 0.7; ctx.fillStyle = V.k === 'sk' ? '#ffffff' : V.k === 'nf' ? '#fff2c0' : '#ff3a10'; ctx.fillRect(0, 0, w, h); ctx.restore(); }
  if (V.k === 'nf') { drawNefIntroHud(ctx, V, w, h, sc, txt); drawNefHud(ctx, V, w, h, sc, time, p); }
  if (V.st === 'wipe') drawWipe(ctx, V, w, h, sc, txt, col);
  return y;
}
function drawWipe(ctx, V, w, h, sc, txt, col) {
  ctx.save(); ctx.fillStyle = 'rgba(6,8,18,.78)'; ctx.fillRect(0, 0, w, h); ctx.restore();
  const L = V.lastWipe || {}, cy = h * 0.34, left = Math.max(0, (TR.wipe - V.at) / 60);
  txt(ctx, 'PARTY WIPED', w / 2, cy, Math.round(54 * sc), '#ff5a6a', 'center', Math.round(9 * sc));
  const why = { fallen: 'Everyone fell', enrage: 'Enrage: the timer ran out', zero: 'Absolute Zero: the circle closed', heart: 'The last heartbeat', blacksun: 'The Black Sun: the last light went out', sunburst: 'The sun burst: it never reached the altar', lost: 'The boss slipped away', dev: 'Reset' }[L.reason] || 'Everyone fell';
  txt(ctx, `${why} · Phase ${L.ph || 1} (${L.name || ''}) · boss at ${L.hp ?? 100}% · ${mmss(L.t || 0)} in`, w / 2, cy + 44 * sc, Math.round(18 * sc), '#ffffff', 'center', 4);
  if (L.mech && L.mech.length) txt(ctx, `During: ${L.mech.join(' + ')}`, w / 2, cy + 72 * sc, Math.round(16 * sc), '#ffd0a0', 'center', 4);
  const bw = 420 * sc, bx = w / 2 - bw / 2, by = cy + 96 * sc; ctx.fillStyle = INK; ctx.fillRect(bx - 3, by - 3, bw + 6, 18 * sc + 6); ctx.fillStyle = '#2a2a3a'; ctx.fillRect(bx, by, bw, 18 * sc); ctx.fillStyle = col; ctx.fillRect(bx, by, bw * (L.prog || 0) / 100, 18 * sc);
  if (V.best > 0) { ctx.fillStyle = '#ffd84a'; ctx.fillRect(bx + bw * V.best - 2, by - 4, 4, 18 * sc + 8); }
  txt(ctx, `Progress ${L.prog || 0}% · best ${Math.round((V.best || 0) * 100)}% · attempt ${V.wipes + 1} next`, w / 2, by + 40 * sc, Math.round(15 * sc), '#cfd8ff', 'center', 3);
  txt(ctx, `Retrying in ${left.toFixed(0)}s · Pause → Return to Town to leave`, w / 2, by + 70 * sc, Math.round(18 * sc), '#7dffb0', 'center', 4);
}
/** the trial arena minimap */
export function drawTrialMinimap(ctx, x, y, r, sim, p, classes) {
  const V = trialView(sim); if (!V) return false;
  const C = TRIAL_POS[V.k], k = r / (R + 40), O = V.o || {};
  circle(ctx, x, y, r + 5, INK, 0); circle(ctx, x, y, r, V.k === 'sk' ? '#bfe0f4' : V.k === 'nf' ? '#c9a66a' : '#3a262c', 0);
  const P = (q) => [x + (q.x - C.x) * k, y + (q.y - C.y) * k];
  for (const v of O.valves || []) if (v.on) { const [a, c] = P(v); circle(ctx, a, c, 5, v.p > 70 ? '#ff3b3b' : '#7dffb0', 1.5); }
  for (const f of O.fires || []) { const [a, c] = P(f); circle(ctx, a, c, 5, '#ffb43c', 1.5); }
  for (const q of O.balls || []) { const [a, c] = P(q); circle(ctx, a, c, Math.max(3, q.r * k), '#ffffff', 1.5); }
  for (const q of O.pillars || []) { const [a, c] = P(q); circle(ctx, a, c, 4, '#1a1014', 1.5); }
  for (const q of O.shades || []) { const [a, c] = P(q); circle(ctx, a, c, Math.max(4, q.r * k), 'rgba(60,60,140,.7)', 1.5); }
  if (O.light) { const [a, c] = P(O.light); circle(ctx, a, c, Math.max(4, O.light.r * k), 'rgba(255,242,160,.8)', 1.5); }
  const b = sim.enemyById && sim.enemyById.get(V.bid); if (b) { const [a, c] = P(b); circle(ctx, a, c, 7, fightCol(V), 2); }
  for (const q of sim.players.values()) if (!q.dead && trialAt(q.x, q.y) === V.k) { const [a, c] = P(q); circle(ctx, a, c, q.id === p.id ? 4.5 : 3.5, q.id === p.id ? '#ffffff' : (classes[q.cls] ? classes[q.cls].color : '#7dffb0'), 1.5); }
  return true;
}
/** the board / unlock banners (fx.js) */
export const TRIAL_UNLOCK_TXT = {
  skt: ['SKALDRA (TRIAL) UNLOCKED', '#bfeaff', 'A new trial waits at the Mission Counter: the Hoarfrost Mirror'],
  skx: ['SKALDRA (EXTREME) UNLOCKED', '#cdb4ff', 'Faster, combined, and a new final phase: Absolute Zero'],
  skxc: ['SKALDRA (EXTREME) CLEARED', '#cdb4ff', "Her Frozen Heart is yours"],
  pyt: ['PYRRHEX (TRIAL) UNLOCKED', '#ffc08a', 'A new trial waits at the Mission Counter: the Heart-Chamber'],
  pyx: ['PYRRHEX (EXTREME) UNLOCKED', '#ff8ab0', 'Faster, combined, and a new final phase: Heart of the World'],
  pyxc: ['PYRRHEX (EXTREME) CLEARED', '#ff8ab0', 'His Molten Core is yours'],
  nfx: ['NEFERAKH UNBOUND (EXTREME) UNLOCKED', '#c9a2ff', 'Faster, combined, and a new final phase: the Black Sun'],
  nfxc: ['NEFERAKH UNBOUND (EXTREME) CLEARED', '#c9a2ff', 'His Eclipse Heart is yours'],
};

// ------------------------------------------------------------------ events
/** fx.js routes {type:'trial'} here (me = the local hero is the subject). Name cards are drawn by the HUD, not banners. */
export function trialEventFx(fx, ev, me) {
  const x = ev.x, y = ev.y, has = x != null, ice = ev.k === 'sk', sun = ev.k === 'nf';
  const lp = fx.sim && fx.sim.players && fx.sim.players.get ? fx.sim.players.get(fx.localPid) : null;
  const near = (Rr) => !lp || !has || Math.hypot(lp.x - x, lp.y - y) < Rr;
  if (!near(2200)) return;
  const A = ice ? '#bff6ff' : sun ? '#ffd86a' : '#ffb43c', B = ice ? '#ffffff' : sun ? '#fff6c8' : '#ff5a2a';
  switch (ev.ph) {
    case 'boom': {
      const big = ev.tk === 'lunge' || ev.tk === 'beam' || ev.tk === 'snap' || ev.tk === 'meteor';
      if (ev.sh === 'circle') { fx.ring(x, y, ev.r, ev.tk === 'bomb' || ev.tk === 'meteor' || ev.tk === 'fist' ? '#ffcf4a' : A, 0.35, 8); fx.puffs(x, y, big ? 12 : ev.tk === 'bomb' ? 4 : 7, ice ? '#e8fbff' : sun ? '#e6c27a' : '#5a4a48', 14, 200, 0.5); if (ev.tk === 'icicle') fx.sparks(x, y, -Math.PI / 2, 10, '#e8fbff', 300, 2.4); else if (!ice) fx.sparks(x, y, 0, ev.tk === 'bomb' ? 6 : 12, '#ffb43c', 320, TAU); } // (balance pass perf: a bomb volley bursts lighter)
      else fx.sparks(x, y, 0, 10, B, 300, TAU);
      fx.shake(big ? 0.3 : 0.12); break;
    }
    case 'hit': if (me) { fx.flash = Math.max(fx.flash || 0, 0.3); fx.flashColor = ice ? '#bfe8ff' : sun ? '#ffd86a' : '#ff5a2a'; } break;
    case 'scorched': if (has) { fx.ring(x, y, 70, '#ffd86a', 0.5, 8); fx.sparks(x, y, -Math.PI / 2, 18, '#fff2a0', 300, TAU); } if (me) fx.banner('SUNSTROKE', '#ffd86a', 'Cool off in an obelisk shade before the heat fills', 1.4, 30); break;
    case 'eclipse': fx.shake(0.2); if (has) fx.ring(x, y - 40, 260, ev.s === 'day' ? '#fff2a0' : '#b07cff', 0.6, 10); break;
    case 'blacksun': fx.shake(0.6); fx.flash = Math.max(fx.flash || 0, 0.6); fx.flashColor = '#1a0830'; break;
    case 'heat': case 'spears': case 'scarabs': case 'sandfall': case 'judgment': case 'curse': break;
    // Neferakh (revamp Part 1)
    case 'intro': if (ev.n === 1) { fx.shake(0.5); fx.ring(TRIAL_POS.nf.x, TRIAL_POS.nf.y - 40, 240, '#ffd86a', 0.6, 10); } else if (ev.n === 3) { fx.shake(0.3); } else if (ev.n === 4) { fx.shake(0.6); fx.ring(TRIAL_POS.nf.x, TRIAL_POS.nf.y - 40, 420, '#fff2a0', 0.8, 12); } else if (ev.n === 5) fx.shake(0.4); break;
    case 'dialflip': if (lp) fx.banner('THE SHADE TURNS BACK', '#ff8a9a', 1.2); break;
    case 'scaletip': if (lp) fx.banner('THE SCALES TIP · YOUR MARK SWAPPED', '#ff9ab0', 1.4); fx.shake(0.25); break;
    case 'judged': if (has) fx.ring(x, y, 60, ev.mk === 'heart' ? '#ff5a7a' : '#ffffff', 0.45, 7); break;
    case 'struck': fx.shake(0.7); fx.flash = Math.max(fx.flash || 0, 0.5); fx.flashColor = '#fff2a0'; break;
    case 'land': fx.shake(0.6); if (has) fx.ring(x, y, 300, '#ffd86a', 0.6, 12); break;
    case 'glyph': case 'hammer': case 'sandglass': case 'sundial': case 'scales': case 'weighed': case 'devour': case 'cartouche': break;
    case 'caught': if (has) { fx.ring(x, y, 50, '#bff6ff', 0.4, 6); fx.sparks(x, y, 0, 12, '#ffffff', 220, TAU); } if (me) fx.banner('CAUGHT BY YOUR SHADOW', '#bff6ff', 'Keep moving: it walks your path', 1.4, 30); break;
    case 'seen': if (has) { fx.ring(x, y, 60, '#ff4a6a', 0.45, 7); fx.puffs(x, y, 10, '#e8fbff', 14, 160, 0.6); } if (me) fx.banner('SHE SAW YOU MOVE', '#ff6a7a', 'Freeze while her eye is open', 1.4, 30); break;
    case 'frozen': if (has) { fx.ring(x, y, 70, '#ffffff', 0.5, 8); fx.sparks(x, y, 0, 18, '#bff6ff', 300, TAU); } if (me) fx.banner('FROZEN SOLID', '#ffffff', 'Warm up at a brazier before the chill fills', 1.4, 30); break;
    case 'splash': if (me && has) fx.puffs(x, y, 6, '#9fd4ff', 10, 120, 0.4); break;
    case 'break': if (has) { fx.puffs(x, y, 8, '#e8fbff', 12, 140, 0.5); fx.ring(x, y, 50, '#5f9fd8', 0.3, 4); } break;
    case 'bounce': if (has) { fx.puffs(x, y, 10, '#ffffff', 16, 180, 0.5); } fx.shake(0.12); break;
    case 'burst': if (has) { fx.ring(x, y, (ev.r || 100) + 40, '#ffffff', 0.45, 10); fx.puffs(x, y, 20, '#ffffff', 20, 260, 0.7); } fx.shake(0.3); break;
    case 'lungeWarn': if (has) { fx.puffs(x, y, 14, '#e8fbff', 18, 220, 0.6); fx.ring(x, y, 90, '#9fe8ff', 0.4, 8); } break;
    case 'lunge': if (has) fx.sparks(x, y, 0, 16, '#e8fbff', 320, TAU); fx.shake(0.4); break;
    case 'blowout': if (has) { fx.ring(x, y, 600, '#ffd36a', 0.6, 14); fx.puffs(x, y, 26, '#bba8a0', 24, 340, 1); } fx.shake(0.8); if (lp) fx.banner('BLOWOUT!', '#ff5a2a', 'A valve burst · bleed them before they fill', 1.6, 36); break;
    case 'vent': if (has) { fx.puffs(x, y, 14, '#d8ccc8', 16, 200, 0.8); fx.ring(x, y, 70, '#7dffb0', 0.4, 6); } break;
    case 'valve': if (has) fx.ring(x, y, 80, '#ff6a2a', 0.5, 8); break;
    case 'redbeat': if (has) fx.ring(x, y, 520, '#ff3b5c', 0.4, 12); fx.shake(0.35); break;
    case 'beat': if (has) fx.ring(x, y, 160, '#ff8a6a', 0.3, 8); break;
    case 'heartbeat': if (has) fx.ring(x, y, 120, '#ff3b5c', 0.3, 10); fx.shake(0.15); break;
    case 'snap': fx.shake(0.25); break;
    case 'flood': fx.shake(0.4); break;
    case 'crumble': case 'drain': break;
    case 'gate': fx.shake(0.3); break;
    case 'phase': if (has) { fx.ring(x, y, 400, A, 0.7, 12); fx.sparks(x, y, 0, 30, B, 420, TAU); } fx.shake(0.5); break;
    case 'enrage': fx.shake(0.6); break;
    case 'enrageHit': fx.shake(1); fx.flash = Math.max(fx.flash || 0, 1); fx.flashColor = ice ? '#ffffff' : sun ? '#fff2c0' : '#ff3a10'; break;
    case 'kill': if (has) { fx.ring(x, y, 300, A, 0.9, 14); fx.ring(x, y, 160, '#ffffff', 0.7, 8); fx.sparks(x, y, 0, 40, B, 520, TAU); fx.puffs(x, y, 30, ice ? '#e8fbff' : sun ? '#e6c27a' : '#5a4a48', 24, 320, 1.2); } fx.shake(1); break;
    case 'victory': if (has) { fx.ring(x, y, 520, '#fff6c8', 1, 10); fx.sparks(x, y, -Math.PI / 2, 40, '#ffe27a', 480, TAU); } break; // (the HUD card carries the TRIAL CLEARED text)
    case 'wipe': fx.shake(0.5); break;
  }
}
/** audio.js routes {type:'trial'} here: built from the shared tone / hiss voices */
export function trialSound(a, ev, me) {
  const ice = ev.k === 'sk', sun = ev.k === 'nf';
  switch (ev.ph) {
    case 'call': if (sun) { a.tone('triangle', 587, 880, 0.18, 0.1); a.tone('sine', 880, 1175, 0.3, 0.08, 0.1); break; } a.tone('triangle', ice ? 880 : 330, ice ? 1320 : 495, 0.18, 0.1); a.tone('sine', ice ? 1320 : 495, ice ? 1760 : 660, 0.3, 0.08, 0.1); break;
    case 'pull': a.tone('sawtooth', ice ? 110 : 73, ice ? 82 : 55, 1.4, 0.14); a.tone('sine', ice ? 440 : 147, ice ? 330 : 110, 1.6, 0.12, 0.2); break;
    case 'start': case 'phase': [0, 1, 2].forEach((i) => a.tone('square', (ice ? 330 : 165) * (1 + i * 0.25), (ice ? 330 : 165) * (1 + i * 0.25), 0.18, 0.1, i * 0.12)); a.hiss(400, 2400, 0.6, 0.12, 0.7); break;
    case 'boom': if (ev.tk === 'icicle') { a.tone('triangle', 2093, 1568, 0.25, 0.08); a.hiss(6000, 1500, 0.2, 0.12, 1, 'highpass'); } else if (ev.tk === 'bomb' || ev.tk === 'meteor') { a.tone('sine', 110, 40, 0.4, 0.28); a.hiss(1200, 150, 0.4, 0.22, 0.7, 'lowpass'); } else if (ev.tk === 'beam') { a.tone('sawtooth', 1200, 300, 0.4, 0.1); a.hiss(8000, 2000, 0.4, 0.15, 1, 'highpass'); } else { a.tone('sine', ice ? 300 : 140, ice ? 120 : 50, 0.3, 0.18); a.hiss(ice ? 3000 : 900, 300, 0.25, 0.12, 0.8); } break;
    case 'hit': if (me) a.tone('square', 200, 120, 0.12, 0.12); break;
    case 'spears': [1175, 1568].forEach((f, i) => a.tone('triangle', f, f * 1.5, 0.2, 0.06, i * 0.1)); break;
    case 'scarabs': a.hiss(2500, 1200, 1.4, 0.1, 0.4, 'bandpass'); break;
    case 'sandfall': a.hiss(900, 300, 1.0, 0.12, 0.6, 'lowpass'); break;
    case 'eclipse': if (ev.s === 'day') a.tone('triangle', 784, 1568, 0.6, 0.1); else a.tone('sine', 196, 98, 0.8, 0.14); break;
    case 'judgment': a.tone('square', 147, 147, 0.25, 0.1); a.tone('square', 220, 220, 0.25, 0.08, 0.3); break;
    case 'curse': [880, 831, 784].forEach((f, i) => a.tone('sine', f, f, 0.2, 0.06, i * 0.1)); break;
    case 'heat': a.hiss(500, 1500, 1.0, 0.08, 0.5, 'lowpass'); break;
    case 'intro': if (ev.n === 1) a.hiss(5200, 700, 0.5, 0.3, 1.5); else if (ev.n === 2) a.hiss(900, 300, 1.6, 0.08, 0.6, 'lowpass'); else if (ev.n === 4) a.tone('sine', 110, 55, 1.4, 0.2); break;
    case 'hammer': a.tone('square', 196, 196, 0.12, 0.08); break;
    case 'sandglass': a.hiss(900, 300, 1.0, 0.1, 0.6, 'lowpass'); a.tone('triangle', 1175, 1175, 0.15, 0.06); break;
    case 'sundial': a.tone('triangle', 587, 880, 0.5, 0.08); break;
    case 'dialflip': a.tone('square', 880, 440, 0.25, 0.1); a.tone('square', 880, 440, 0.25, 0.1, 0.3); break;
    case 'scales': a.tone('sine', 523, 523, 0.3, 0.08); a.tone('sine', 622, 622, 0.3, 0.08, 0.3); break;
    case 'scaletip': a.tone('triangle', 784, 392, 0.4, 0.12); break;
    case 'weighed': a.tone('square', 147, 110, 0.3, 0.1); break;
    case 'devour': a.hiss(400, 2400, 3.4, 0.12, 0.5); a.tone('sawtooth', 55, 82, 3.4, 0.06); break;
    case 'cartouche': [587, 698, 880].forEach((f, i) => a.tone('triangle', f, f, 0.15, 0.06, i * 0.1)); break;
    case 'glyph': a.tone('triangle', ev.g === 'sun' ? 1175 : ev.g === 'moon' ? 587 : 880, ev.g === 'sun' ? 1175 : ev.g === 'moon' ? 587 : 880, 0.2, 0.08); break;
    case 'struck': a.tone('sine', 1320, 660, 1.2, 0.14); a.hiss(4000, 600, 0.6, 0.18, 0.8); break;
    case 'land': a.tone('sine', 70, 30, 0.9, 0.35); a.hiss(1800, 100, 0.8, 0.25, 0.6, 'lowpass'); break;
    case 'scorched': if (me) { a.tone('sawtooth', 660, 330, 0.4, 0.1); a.hiss(4000, 800, 0.4, 0.12, 0.8); } break;
    case 'blacksun': a.tone('sine', 1320, 55, 2.5, 0.14); a.tone('sawtooth', 110, 55, 2.5, 0.06); break;
    case 'caught': case 'seen': case 'frozen': if (me) { a.tone('triangle', 1760, 880, 0.4, 0.14); a.hiss(9000, 3000, 0.4, 0.15, 1, 'highpass'); } break;
    case 'break': a.tone('triangle', 1400 + Math.random() * 400, 700, 0.18, 0.05); break;
    case 'splash': if (me) a.hiss(1500, 300, 0.25, 0.1, 0.6, 'lowpass'); break;
    case 'bounce': a.tone('sine', 90, 60, 0.25, 0.22); a.hiss(800, 200, 0.2, 0.12, 0.7, 'lowpass'); break;
    case 'burst': a.hiss(5000, 800, 0.5, 0.2, 0.8); a.tone('sine', 160, 60, 0.4, 0.2); break;
    case 'snowball': a.hiss(600, 200, 1.2, 0.1, 0.7, 'lowpass'); break;
    case 'shadow': [988, 784, 659].forEach((f, i) => a.tone('sine', f, f * 0.98, 0.3, 0.07, i * 0.12)); break;
    case 'icicles': [2093, 1760, 1568, 1319].forEach((f, i) => a.tone('triangle', f, f, 0.12, 0.05, i * 0.07)); break;
    case 'walls': a.tone('sine', 660, 1320, 0.6, 0.1); a.tone('sine', 990, 1980, 0.6, 0.06, 0.1); break;
    case 'prism': a.tone('sawtooth', 500, 1500, 0.5, 0.06); break;
    case 'eye': if (ev.s === 'warn') { a.tone('square', 440, 440, 0.1, 0.1); a.tone('square', 440, 440, 0.1, 0.1, 0.25); } else if (ev.s === 'open') { a.tone('sawtooth', 880, 1760, 0.3, 0.14); a.tone('sine', 220, 220, 0.8, 0.12); } else a.tone('triangle', 660, 440, 0.25, 0.08); break;
    case 'dive': a.hiss(2000, 200, 0.8, 0.18, 0.7); break;
    case 'lungeWarn': a.tone('sine', 220, 440, 0.3, 0.12); break;
    case 'lunge': a.hiss(3000, 400, 0.4, 0.22, 0.8); a.tone('sine', 120, 50, 0.4, 0.22); break;
    case 'chill': case 'fire': a.hiss(300, 900, 0.5, 0.08, 0.6, 'lowpass'); break;
    case 'zero': a.tone('sine', 1760, 220, 2.5, 0.12); break;
    case 'valve': a.tone('square', 196, 220, 0.2, 0.08); break;
    case 'vent': a.hiss(2500, 500, 0.8, 0.18, 0.6); break;
    case 'blowout': a.tone('sine', 70, 30, 0.9, 0.4); a.hiss(1800, 100, 1.0, 0.35, 0.6, 'lowpass'); break;
    case 'beat': a.tone('sine', 70, 45, 0.18, 0.3); break;
    case 'redbeat': a.tone('sine', 90, 40, 0.25, 0.4); a.tone('square', 660, 660, 0.1, 0.1); break;
    case 'heartbeat': a.tone('sine', 80, 45, 0.2, 0.35); a.tone('sine', 70, 40, 0.2, 0.25, 0.18); break;
    case 'arrhythmia': a.tone('sine', 70, 45, 0.18, 0.3); a.tone('sine', 70, 45, 0.18, 0.3, 0.2); break;
    case 'pillars': a.tone('sawtooth', 60, 90, 0.8, 0.14); break;
    case 'gaze': a.tone('sawtooth', 300, 900, 0.6, 0.1); a.hiss(400, 2000, 3.5, 0.08, 0.5); break;
    case 'arteries': a.tone('sine', 140, 110, 0.6, 0.15); break;
    case 'snap': a.tone('triangle', 900, 200, 0.2, 0.14); break;
    case 'meteors': a.hiss(4000, 600, 1.0, 0.12, 0.6); break;
    case 'flood': a.hiss(300, 1200, 1.2, 0.2, 0.5, 'lowpass'); a.tone('sine', 60, 50, 1.4, 0.2); break;
    case 'gate': a.tone('triangle', 1046, 1568, 0.4, 0.14); break;
    case 'trans': a.tone('sine', 220, 880, 1.2, 0.12); break;
    case 'count': if (ev.n <= 10) a.tone('square', 880, 880, 0.06, 0.08); break;
    case 'enrage': a.tone('sawtooth', 220, 55, 3.5, 0.2); a.hiss(200, 3000, 3.5, 0.15, 0.4); break;
    case 'enrageHit': a.hiss(3000, 60, 1.6, 0.5, 0.5, 'lowpass'); a.tone('sine', 60, 25, 1.5, 0.5); break;
    case 'kill': a.tone('sine', ice ? 880 : 220, ice ? 220 : 55, 2.2, 0.25); a.hiss(4000, 200, 2, 0.3, 0.6); break;
    case 'victory': [523, 659, 784, 1046].forEach((f, i) => a.tone('triangle', f, f, 0.35, 0.14, i * 0.14)); break;
    case 'wipe': a.tone('sawtooth', 330, 82, 1.6, 0.14); break;
    case 'revive': if (me) a.tone('sine', 440, 880, 0.4, 0.12); break;
  }
}
void TCOL; // (kept for reference: the pre-A1 theme tints)
