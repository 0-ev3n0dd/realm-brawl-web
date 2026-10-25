// Piece 4, client side of sim/exotic.js: the visuals + sounds of the Trial / Extreme procs and the biome set mechanics,
// the local hero's Heat / Stardust meter, and the item-tier look (tooltip lines, colours) shared by desktop + phone.
// World visuals are kept in a short list built from the 'gear' events (so co-op guests see their friends' procs too).
import { INK, circle } from './art.js';
import { EXOTIC, GX, gearMeter } from '../sim/exotic.js';
import { RARITIES, SLOT_LABEL } from '../sim/data/items.js';
import { setBlock } from './geartip.js';

const TAU = Math.PI * 2;
let NOW = 0; const LIST = []; const CHARGE = {}; // (co-op: the Heat / Stardust of a hero comes from 'charge' events) // { k, x, y, r, born, life, red }
const MAX = 40;
function add(o) { if (LIST.length >= MAX) LIST.shift(); LIST.push({ born: NOW, ...o }); }
/** 'gear' events -> world visuals + screen FX */
export function gearEventFx(fx, ev, me) {
  const x = ev.x, y = ev.y; if (x == null) return;
  switch (ev.ph) {
    case 'zero': add({ k: 'zero', x, y, r: ev.r, life: ev.d / 60 }); if (me) fx.banner('ABSOLUTE ZERO', '#bff6ff', '', 0.8, 26); break;
    case 'beat': add({ k: ev.red ? 'redbeat' : 'beat', x, y, r: ev.r, life: ev.red ? ev.d / 60 : 0.35 }); if (ev.red && me) fx.shake(0.15); break;
    case 'star': add({ k: 'star', x, y, r: ev.r, life: ev.d / 60 }); break;
    case 'nova': add({ k: 'nova', x, y, r: ev.r, life: 0.6 }); fx.ring(x, y, ev.r, '#ffe27a', 0.5, 10); fx.sparks(x, y, 0, 26, '#fff6c8', 520, TAU); fx.shake(0.45); if (me) fx.banner('SUPERNOVA', '#ffe27a', '', 0.9, 30); break;
    case 'erupt': add({ k: 'pool', x, y, r: GX.erupt.poolR, life: GX.erupt.pool / 60 }); fx.ring(x, y, ev.r, '#ff7a3a', 0.45, 10); fx.puffs(x, y, 16, '#5a3a30', 18, 260, 0.8); fx.sparks(x, y, -Math.PI / 2, 22, '#ffb43c', 460, TAU); fx.shake(0.35); if (me) fx.banner('ERUPTION', '#ff7a3a', '', 0.8, 26); break;
    case 'valve': fx.ring(x, y, ev.r, '#ff9a4a', 0.35, 8); fx.puffs(x, y, 10, '#d8c8c0', 14, 200, 0.6); fx.shake(0.15); break;
    case 'freeze': add({ k: 'ice', x, y, r: Math.max(26, ev.r + 8), life: GX.shatter.freeze / 60 }); fx.puffs(x, y, 6, '#e8fbff', 10, 120, 0.4); break;
    case 'shatter': fx.ring(x, y, ev.r, '#8fe3ff', 0.35, 8); fx.sparks(x, y, 0, 22, '#e8fbff', 420, TAU); fx.shake(0.2); for (const q of LIST) if (q.k === 'ice' && Math.hypot(q.x - x, q.y - y) < 40) q.life = 0; break;
    // gear expansion: set 4-piece procs
    case 'frostnova': add({ k: 'fnova', x, y, r: ev.r, life: 0.75 }); fx.ring(x, y, ev.r, '#bff6ff', 0.4, 9); fx.sparks(x, y, 0, 18, '#e8fbff', 380, TAU); fx.puffs(x, y, 8, '#e8fbff', 12, 160, 0.5); fx.shake(0.18); if (me) fx.banner('FROST NOVA', '#bff6ff', '', 0.6, 22); break;
    case 'sandstorm': add({ k: 'sand', x, y, r: ev.r, life: 0.9 }); fx.puffs(x, y, 14, '#e6c27a', 16, 240, 0.8); fx.ring(x, y, ev.r, '#ffd98a', 0.35, 7); fx.shake(0.15); break;
    case 'bramble': add({ k: 'thorn', x, y, r: ev.r, life: 0.45 }); fx.sparks(x, y, 0, 14, '#7ad65a', 320, TAU); fx.ring(x, y, ev.r, '#5aa83a', 0.3, 6); break;
    // game loop A2: Neferakh's families
    case 'brand': add({ k: 'brand', x, y, r: ev.r, life: ev.d / 60, eid: ev.eid }); break;
    case 'flare': for (const q of LIST) if (q.k === 'brand' && Math.hypot(q.x - x, q.y - y) < 260) q.life = 0; add({ k: 'flare', x, y, r: ev.r, life: 0.55 }); fx.ring(x, y, ev.r, '#ffd86a', 0.4, 9); fx.sparks(x, y, -Math.PI / 2, 20, '#fff2a0', 420, TAU); fx.shake(0.18); if (me) fx.banner('SOLAR BRAND', '#ffd86a', '', 0.6, 22); break;
    case 'bsun': add({ k: 'bsun', x, y, r: ev.r, life: ev.d / 60 }); if (me) fx.banner('BLACK SUN', '#b07cff', '', 0.8, 26); break;
    case 'collapse': add({ k: 'collapse', x, y, r: ev.r, life: 0.6 }); fx.ring(x, y, ev.r, '#b07cff', 0.5, 12); fx.ring(x, y, ev.r * 0.6, '#ffd86a', 0.4, 6); fx.sparks(x, y, 0, 28, '#d8b8ff', 520, TAU); fx.shake(0.4); break;
    case 'constellation': add({ k: 'cons', x, y, r: ev.r, life: 0.9 }); fx.ring(x, y, ev.r, '#b48cff', 0.45, 8); fx.sparks(x, y, 0, 20, '#fff4b0', 420, TAU); if (me) fx.shake(0.12); break; // Astral Regalia 4-piece (game loop C3)
    case 'moonlit': fx.ring(x, y, ev.r, '#ffe9a0', 0.45, 8); fx.sparks(x, y, -Math.PI / 2, 16, '#efffd0', 360, TAU); break; // Mothwing 4-piece (the Glowmire Hollow)
    case 'thunder': fx.ring(x, y, ev.r, '#9fdcff', 0.35, 8); fx.sparks(x, y - 200, Math.PI / 2, 10, '#ffffff', 900, 0.15); if (me) fx.shake(0.1); break; // Stormbound (Vharok's Trial)
    case 'skyfall': fx.ring(x, y, ev.r, '#c9a2ff', 0.5, 10); fx.sparks(x, y, 0, 24, '#ffffff', 520, TAU); if (me) fx.shake(0.2); break; // Skyfall (Vharok's Extreme)
    case 'charge': CHARGE[ev.pid] = { k: ev.k, n: ev.n }; break;
  }
  if ((ev.ph === 'erupt' || ev.ph === 'nova') && ev.pid != null) CHARGE[ev.pid] = { k: ev.ph === 'erupt' ? 'heat' : 'dust', n: 0 };
}
export function gearSound(a, ev, me) {
  switch (ev.ph) {
    case 'zero': a.tone('triangle', 1760, 880, 0.9, 0.08); a.hiss(6000, 1500, 0.9, 0.08, 1, 'highpass'); break;
    case 'beat': if (ev.red) { a.tone('sine', 70, 40, 0.35, 0.3); a.tone('sawtooth', 140, 70, 0.3, 0.08); } else if (me) a.tone('sine', 60, 45, 0.12, 0.12); break;
    case 'star': a.tone('triangle', 1320, 1980, 0.3, 0.06); break;
    case 'nova': a.tone('sine', 220, 55, 1.0, 0.3); a.hiss(5000, 200, 1, 0.25, 0.6); [523, 784, 1046].forEach((f, i) => a.tone('triangle', f, f, 0.3, 0.08, 0.1 + i * 0.07)); break;
    case 'erupt': a.tone('sine', 90, 35, 0.6, 0.32); a.hiss(1200, 120, 0.6, 0.3, 0.7, 'lowpass'); break;
    case 'valve': a.hiss(3000, 600, 0.35, 0.16, 0.8); break;
    case 'freeze': a.tone('triangle', 2093, 1568, 0.18, 0.05); break;
    case 'shatter': a.hiss(8000, 2500, 0.3, 0.2, 1, 'highpass'); a.tone('triangle', 1568, 784, 0.25, 0.08); break;
    case 'frostnova': a.tone('triangle', 1760, 1175, 0.22, 0.06); a.hiss(7000, 2000, 0.25, 0.12, 1, 'highpass'); break;
    case 'sandstorm': a.hiss(1500, 400, 0.6, 0.14, 0.7, 'bandpass'); break;
    case 'bramble': a.tone('square', 330, 220, 0.12, 0.04); break;
    case 'brand': a.tone('triangle', 880, 1320, 0.18, 0.05); break;
    case 'flare': a.tone('sine', 520, 1040, 0.25, 0.1); a.hiss(4000, 900, 0.3, 0.12, 0.8); break;
    case 'bsun': a.tone('sawtooth', 110, 55, 1.2, 0.08); a.tone('sine', 55, 40, 2.8, 0.12); break;
    case 'collapse': a.tone('sine', 180, 40, 0.8, 0.32); a.hiss(3000, 120, 0.8, 0.25, 0.6); [392, 523].forEach((f, i) => a.tone('triangle', f * 2, f, 0.3, 0.06, i * 0.08)); break;
    case 'constellation': [1046, 1318, 1568].forEach((f, i) => a.tone('triangle', f, f * 1.5, 0.22, 0.06, i * 0.05)); break;
    case 'moonlit': a.tone('sine', 784, 1175, 0.3, 0.08); break;
    case 'thunder': case 'skyfall': a.tone('square', 220, 55, 0.3, 0.14); a.hiss(4000, 400, 0.35, 0.14, 0.8); break;
    case 'charge': if (me && ev.n >= 100 || me && ev.k === 'dust' && ev.n >= 30) a.tone('triangle', 660, 990, 0.2, 0.1); break;
  }
}
/** under the actors: closing zero rings, magma pools, frozen shells, heartbeat rings, star markers */
export function drawGearUnder(ctx, t) {
  NOW = t;
  if (!LIST.length) return;
  for (let i = LIST.length - 1; i >= 0; i--) if (t - LIST[i].born > LIST[i].life + 0.25) LIST.splice(i, 1);
  for (const q of LIST) {
    const k = Math.min(1, (t - q.born) / Math.max(0.01, q.life));
    ctx.save();
    if (q.k === 'zero') { // the ring closes in: frost on the edge, a gauge fills
      const r = q.r * (1 - k * 0.92);
      ctx.globalAlpha = 0.25; circle(ctx, q.x, q.y, q.r, '#bff6ff', 0);
      ctx.globalAlpha = 0.9; circle(ctx, q.x, q.y, r, null, 8, '#e8fbff'); circle(ctx, q.x, q.y, r, null, 3, INK);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + k * 2; ctx.beginPath(); ctx.moveTo(q.x + Math.cos(a) * r, q.y + Math.sin(a) * r); ctx.lineTo(q.x + Math.cos(a) * (r + 18), q.y + Math.sin(a) * (r + 18)); ctx.lineWidth = 4; ctx.strokeStyle = '#8fe3ff'; ctx.stroke(); }
      if (k >= 1) { ctx.globalAlpha = Math.max(0, 1 - (t - q.born - q.life) * 4); circle(ctx, q.x, q.y, q.r, 'rgba(232,251,255,.7)', 0); }
    } else if (q.k === 'pool') {
      ctx.globalAlpha = Math.min(1, (q.life - (t - q.born)) * 3);
      circle(ctx, q.x, q.y, q.r, '#c8381a', 4); circle(ctx, q.x - 12, q.y - 8, q.r * 0.55, '#ff9a2a', 0);
      for (let i = 0; i < 3; i++) { const ph = (t * 1.5 + i / 3) % 1; circle(ctx, q.x + Math.cos(i * 2.1) * q.r * 0.5, q.y + Math.sin(i * 2.1) * q.r * 0.4, 3 + ph * 7, null, 2, '#ffd36a'); }
    } else if (q.k === 'ice') {
      ctx.globalAlpha = 0.75; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; ctx.lineTo(q.x + Math.cos(a) * q.r, q.y + Math.sin(a) * q.r * 0.9); } ctx.closePath();
      ctx.fillStyle = 'rgba(191,246,255,.55)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#e8fbff'; ctx.stroke();
    } else if (q.k === 'redbeat' || q.k === 'beat') {
      const r = q.k === 'beat' ? 40 + k * 50 : q.r * k;
      ctx.globalAlpha = 1 - k * 0.6; circle(ctx, q.x, q.y, r, null, q.k === 'beat' ? 3 : 12, q.k === 'beat' ? '#ff9a7a' : '#ff3a1a');
      if (q.k === 'redbeat') { circle(ctx, q.x, q.y, r, null, 3, INK); circle(ctx, q.x, q.y, Math.max(0, r - 10), null, 3, '#ffd36a'); }
    } else if (q.k === 'star') { // a target + the star dropping onto it
      ctx.globalAlpha = 0.8; circle(ctx, q.x, q.y, q.r * (0.6 + 0.4 * k), null, 4, '#c9b8ff'); circle(ctx, q.x, q.y, q.r * 0.25, 'rgba(201,184,255,.35)', 0);
      const sy = q.y - 400 * (1 - k); star(ctx, q.x, sy, 18, '#fff6c8');
      if (k >= 1) { ctx.globalAlpha = Math.max(0, 1 - (t - q.born - q.life) * 4); circle(ctx, q.x, q.y, q.r, 'rgba(255,246,200,.6)', 0); }
    } else if (q.k === 'fnova') { // an icy burst: a frosted disc, an inked frost ring and crystal shards riding the edge
      const r = q.r * (0.3 + 0.7 * Math.sqrt(k)); ctx.globalAlpha = Math.min(1, 1.6 * (1 - k));
      circle(ctx, q.x, q.y, r, 'rgba(150,228,255,.38)', 0);
      circle(ctx, q.x, q.y, r, null, 10, '#e8fbff'); circle(ctx, q.x, q.y, r, null, 3, INK); circle(ctx, q.x, q.y, r * 0.62, null, 3, 'rgba(143,227,255,.8)');
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + 0.25, x0 = q.x + Math.cos(a) * r, y0 = q.y + Math.sin(a) * r, l = 16 + (i % 3) * 6;
        ctx.beginPath(); ctx.moveTo(x0 + Math.cos(a + 1.57) * 5, y0 + Math.sin(a + 1.57) * 5); ctx.lineTo(x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); ctx.lineTo(x0 - Math.cos(a + 1.57) * 5, y0 - Math.sin(a + 1.57) * 5); ctx.closePath();
        ctx.fillStyle = '#dff8ff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); }
    } else if (q.k === 'sand') { // a swirling sand vortex
      ctx.globalAlpha = 0.7 * (1 - k);
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (0.4 + i * 0.25), t * 6 + i * 2, t * 6 + i * 2 + 3.6); ctx.lineWidth = 7 - i * 2; ctx.strokeStyle = i ? '#e6c27a' : '#ffd98a'; ctx.stroke(); }
    } else if (q.k === 'thorn') { // a ring of thorn spikes
      ctx.globalAlpha = 1 - k; const r = q.r * (0.5 + 0.5 * k);
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + 0.2; ctx.beginPath(); ctx.moveTo(q.x + Math.cos(a - 0.12) * r * 0.6, q.y + Math.sin(a - 0.12) * r * 0.6); ctx.lineTo(q.x + Math.cos(a) * r, q.y + Math.sin(a) * r); ctx.lineTo(q.x + Math.cos(a + 0.12) * r * 0.6, q.y + Math.sin(a + 0.12) * r * 0.6); ctx.closePath(); ctx.fillStyle = '#5aa83a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
    } else if (q.k === 'brand') { // a sun glyph burns onto the target, its rays growing toward the flare
      ctx.globalAlpha = 0.85; const r = 26 + 12 * k, sp = t * 2;
      circle(ctx, q.x, q.y, q.r * k, 'rgba(255,216,106,.14)', 0); circle(ctx, q.x, q.y, q.r, null, 2, 'rgba(255,216,106,.5)');
      for (let i = 0; i < 8; i++) { const a = sp + i / 8 * TAU; ctx.beginPath(); ctx.moveTo(q.x + Math.cos(a) * r * 0.7, q.y + Math.sin(a) * r * 0.7); ctx.lineTo(q.x + Math.cos(a) * (r + 10 + 14 * k), q.y + Math.sin(a) * (r + 10 + 14 * k)); ctx.lineWidth = 4; ctx.strokeStyle = '#ffd86a'; ctx.stroke(); }
      circle(ctx, q.x, q.y, r * 0.55, '#fff2a0', 3);
    } else if (q.k === 'flare') { // the flare: a hot gold bloom with a white core
      ctx.globalAlpha = 1 - k; circle(ctx, q.x, q.y, q.r * (0.4 + 0.6 * Math.sqrt(k)), 'rgba(255,216,106,.45)', 6, '#fff6c8');
      ctx.globalAlpha = (1 - k) * 0.9; circle(ctx, q.x, q.y, q.r * 0.35 * (1 - k), '#ffffff', 0);
    } else if (q.k === 'bsun') { // the black sun: a dark disc with a violet corona, the pull drawn as spiralling streaks
      const grow = Math.min(1, k * 6), r = 34 * grow;
      ctx.globalAlpha = 0.22; circle(ctx, q.x, q.y, q.r, '#2a1040', 0);
      ctx.globalAlpha = 0.9; circle(ctx, q.x, q.y, q.r, null, 3, 'rgba(176,124,255,.7)');
      for (let i = 0; i < 6; i++) { const a = -t * 3 + i / 6 * TAU, rr = q.r * (1 - ((t * 0.9 + i / 6) % 1)); ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1, rr), a, a + 0.7); ctx.lineWidth = 4; ctx.strokeStyle = '#c9a2ff'; ctx.stroke(); }
      ctx.globalAlpha = 1; circle(ctx, q.x, q.y - 60, r + 10 + 3 * Math.sin(t * 9), 'rgba(176,124,255,.55)', 0); circle(ctx, q.x, q.y - 60, r, '#0c0614', 4); circle(ctx, q.x, q.y - 60, r, null, 2, '#ffd86a');
    } else if (q.k === 'collapse') {
      ctx.globalAlpha = 1 - k; circle(ctx, q.x, q.y, q.r * (1 - 0.7 * k), 'rgba(40,10,70,.5)', 8, '#c9a2ff'); circle(ctx, q.x, q.y, q.r * 0.3 * k + 10, '#ffffff', 0);
    } else if (q.k === 'cons') { // the constellation: 7 stars on a ring chained star to star, then a burst
      const pts = []; for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + i / 7 * TAU + q.x * 0.001; pts.push([q.x + Math.cos(a) * q.r * 0.7, q.y + Math.sin(a) * q.r * 0.5]); }
      const n = Math.min(7, Math.floor(k * 14) + 1); ctx.globalAlpha = 1 - k * 0.8; ctx.lineWidth = 3; ctx.strokeStyle = '#c9a8ff'; ctx.beginPath(); for (let i = 0; i < n; i++) { const [px, py] = pts[i]; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } if (n === 7) ctx.closePath(); ctx.stroke();
      for (let i = 0; i < n; i++) star(ctx, pts[i][0], pts[i][1], 9, '#fff4b0');
      if (k > 0.5) { ctx.globalAlpha = (1 - k) * 2; circle(ctx, q.x, q.y, q.r * (k - 0.3), 'rgba(180,140,255,.35)', 5, '#fff4b0'); }
    } else if (q.k === 'nova') {
      ctx.globalAlpha = 1 - k; circle(ctx, q.x, q.y, q.r * (0.3 + 0.7 * k), 'rgba(255,226,122,.35)', 6, '#fff6c8');
    }
    ctx.restore();
  }
}
function star(ctx, x, y, r, col) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
/** the local hero's Heat (Caldera 3-piece) / Stardust (Big Bang) meter above the skill bar; returns true if drawn */
export function drawGearMeter(ctx, p, x, y, w, sc, txt) {
  const m = gearMeter(p); if (!m) return false;
  if (!p.gx && CHARGE[p.id] && CHARGE[p.id].k === m.k) m.n = CHARGE[p.id].n;
  const k = Math.min(1, m.n / m.need), full = k >= 1, col = m.k === 'heat' ? '#ff7a3a' : '#ffe27a';
  ctx.fillStyle = INK; ctx.fillRect(x - 2, y - 2, w + 4, 12 * sc + 4);
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, y, w, 12 * sc);
  ctx.fillStyle = full ? (Math.sin(NOW * 12) > 0 ? '#ffffff' : col) : col; ctx.fillRect(x, y, w * k, 12 * sc);
  if (txt) txt(ctx, `${m.k === 'heat' ? 'HEAT' : 'STARDUST'} ${Math.floor(m.n)}/${m.need}${full ? ' · next hit!' : ''}`, x + w / 2, y + 10 * sc, Math.round(11 * sc), '#ffffff', 'center', 3);
  return true;
}
// ------------------------------------------------------------------ item tiers (tooltips; desktop + phone)
export const TIER_LABEL = { 4: 'Set', 6: 'Trial', 7: 'Extreme' };
/** the tooltip sub line for a Trial / Extreme piece (null otherwise) */
export function exoticSub(item, clsName) {
  const F = item && item.ex && EXOTIC[item.ex]; if (!F) return null;
  return `${F.rarity === 7 ? 'Extreme' : 'Trial'} ${item.slot === 'armor' ? 'Chest' : SLOT_LABEL[item.slot] || item.slot}${clsName && item.cls ? ' · ' + clsName : ''} · ${F.boss} · Tier ${item.tier}`;
}
/** the tooltip proc block for a Trial / Extreme piece ('' otherwise) */
export function exoticExtra(item, p) {
  const F = item && item.ex && EXOTIC[item.ex]; if (!F) return '';
  const R = RARITIES[F.rarity], worn = p && p.equipment && Object.values(p.equipment).some((e) => e && e.ex === item.ex);
  return `<div style="color:${F.color};font-weight:bold;margin-top:6px">${F.procName}${F.rarity === 7 ? ' <span style="color:#ff3b3b">(Extreme proc)</span>' : ''}</div>`
    + `<div style="color:${worn ? '#fff' : 'rgba(255,255,255,.75)'}">${F.procText}</div>`
    + `<div style="opacity:.65;margin-top:2px">${F.source} · one proc per family, however many pieces you wear</div>`
    + setBlock(item, p)
    + `<div style="color:${R.color};opacity:.85;font-size:11px;margin-top:2px">${R.name} tier · above Set, ${F.rarity === 7 ? 'the highest tier' : 'below Extreme'}</div>`;
}
