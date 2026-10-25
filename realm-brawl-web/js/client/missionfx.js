// Missions revamp, part 1 (2026-10-08): the client art of the new Defense + Swarm and the shared framework.
//  World: the six build sockets + their turrets / spike traps / wards, the relic's charge ring + the pulse, the Swarm safe
//  ring with the corruption outside it, the biome hazard telegraphs (render.js drawArea hook: kinds 'ohz_*'), the siege /
//  Queen telegraphs ('oslam', 'obomb', 'oacid', 'oacidhit', 'odonut', 'ovol'), turret tracers, brood eggs, storm overlays.
//  HUD: the objective tracker (left), the combo meter, the build-phase prompt, the weekly chips, the results / grade panel.
//  Perf: every overlay takes `lite` (phone / low quality: no gradients, no additive passes, fewer particles); the floor-wide
//  layers are a few fills per frame. Reads the packed mission view (solo: packed once a tick; co-op: the snapshot copy).
import { INK, circle, rrect } from './art.js';
import { drawText } from './textcache.js';
import { OPS, OPS_TYPE, OPS_BIOME, WAVE_MODS } from '../sim/opsconst.js';
import { OPS_HAZ, WEEKLY, GRADES } from '../sim/opsmods.js';
import { drawOpsArea2, drawMission2Over } from './missionfx2.js';
import { drawOpsArea3, drawMission3Over } from './missionfx3.js'; // (part 3: Capture snares / nets) // (part 2: Mobile Defense + Assault telegraphs / trap bursts)
import { BEST, bestFor } from './bestgrade.js'; // part 3: the results panel's best grade line

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const nowS = () => (typeof performance !== 'undefined' ? performance.now() / 1000 : 0);
const hash = (i) => { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
function label(ctx, s, x, y, size, col, lw = 5) { drawText(ctx, s, x, y, `bold ${size}px "Lilita One", "Arial Black", sans-serif`, col, 'center', lw, INK, size); }
const BUILD_K = { t: 'turret', s: 'spike', w: 'ward' };
export const BUILD_INFO = {
  turret: { name: 'Turret', col: '#ffcf4a', desc: 'Shoots the nearest enemy (long range)' },
  spike: { name: 'Spike Trap', col: '#ff8a6a', desc: 'Cuts and slows everything on it' },
  ward: { name: 'Ward', col: '#7de8ff', desc: 'Pulses a slowing, damaging field' },
};
export const sockKind = (V, i) => (V && V.so && V.so[i] ? BUILD_K[V.so[i][0]] || '' : '');

// ------------------------------------------------------------------ transient world fx (fed by missionEventFx)
const TR = [], WAVES = [], BOMBS = [], FLASH = { t0: -9, col: '#fff' };
function prune(L, life) { const n = nowS(); while (L.length && n - L[0].t0 > life) L.shift(); }

// ------------------------------------------------------------------ world: under the characters
/** Defense: sockets (empty plates / spike traps / ward fields), the relic charge ring, the build-phase guides */
export function drawDefenseUnder(ctx, A, V, t, lite, local) {
  const R = A.relic, build = V.ph === 'build' && V.st === 'run', H = OPS_HAZ[A.biome];
  // the charge ring round the relic: fills with heroes near it + kills round it; full = PULSE READY
  const ck = clamp01((V.chg || 0) / 100), full = ck >= 1;
  ctx.save();
  ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(R.x, R.y, OPS.defense.charge.near, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.setLineDash([6, 14]); ctx.stroke(); ctx.setLineDash([]);
  ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(R.x, R.y, 150, 0, TAU); ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(20,12,24,.55)'; ctx.stroke();
  if (ck > 0) { ctx.beginPath(); ctx.arc(R.x, R.y, 150, -Math.PI / 2, -Math.PI / 2 + ck * TAU); ctx.lineWidth = 8; ctx.strokeStyle = full ? (Math.sin(t * 10) > 0 ? '#ffffff' : H.col) : H.col; ctx.stroke(); }
  if (full && !lite) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 8); ctx.beginPath(); ctx.arc(R.x, R.y, 150, 0, TAU); ctx.lineWidth = 26; ctx.strokeStyle = H.col; ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
  // the sockets
  A.socks.forEach((s, i) => {
    const q = (V.so && V.so[i]) || ['', 0, 0], k = BUILD_K[q[0]] || '', lv = q[1] | 0, off = !!q[2];
    ctx.beginPath(); ctx.ellipse(s.x, s.y + 4, 54, 26, 0, 0, TAU); ctx.fillStyle = 'rgba(20,12,24,.32)'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(s.x, s.y, 50, 24, 0, 0, TAU); ctx.fillStyle = '#7d7589'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(s.x, s.y - 2, 40, 18, 0, 0, TAU); ctx.fillStyle = k ? shade(BUILD_INFO[k].col, -40) : '#9d95a8'; ctx.fill();
    if (!k) {
      ctx.save(); ctx.globalAlpha = build ? 0.75 + 0.25 * Math.sin(t * 5 + i) : 0.35; ctx.setLineDash([8, 7]); ctx.lineDashOffset = -t * 24;
      ctx.beginPath(); ctx.ellipse(s.x, s.y - 2, 46, 21, 0, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = build ? H.matCol : '#d8d0e2'; ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = build ? '#ffffff' : '#d8d0e2'; ctx.fillRect(s.x - 10, s.y - 4, 20, 5); ctx.fillRect(s.x - 2.5, s.y - 11, 5, 19); ctx.restore();
      if (build && local && Math.hypot(local.x - s.x, local.y - s.y) < 260) label(ctx, 'BUILD', s.x, s.y + 40, 14, H.matCol, 4);
      return;
    }
    if (k === 'spike') { // the trap is floor art: a plate of blades
      const r = OPS.defense.build.spike.r[lv - 1];
      ctx.save(); ctx.globalAlpha = 0.22; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fillStyle = off ? '#777' : '#ff8a6a'; ctx.fill(); ctx.restore();
      const n = 7 + lv * 3, pump = off ? 0 : Math.max(0, Math.sin(t * 6 + i)) * 4;
      for (let j = 0; j < n; j++) { const a = j * TAU / n + i, rr = r * (0.35 + 0.5 * hash(j + i * 31)), x = s.x + Math.cos(a) * rr, y = s.y + Math.sin(a) * rr * 0.6; ctx.beginPath(); ctx.moveTo(x - 6, y + 3); ctx.lineTo(x, y - 16 - pump); ctx.lineTo(x + 6, y + 3); ctx.closePath(); ctx.fillStyle = off ? '#8a8494' : '#e6e1ee'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
    } else if (k === 'ward') { // the field it pulses
      const r = OPS.defense.build.ward.r[lv - 1], ph = (t * 0.9 + i * 0.3) % 1;
      ctx.save(); ctx.globalAlpha = off ? 0.08 : 0.12; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fillStyle = '#7de8ff'; ctx.fill();
      ctx.globalAlpha = off ? 0.2 : 0.55; ctx.lineWidth = 3; ctx.strokeStyle = '#bff6ff'; ctx.setLineDash([12, 10]); ctx.lineDashOffset = t * 20; ctx.stroke(); ctx.setLineDash([]);
      if (!off) { ctx.globalAlpha = 0.45 * (1 - ph); ctx.beginPath(); ctx.arc(s.x, s.y, r * ph, 0, TAU); ctx.lineWidth = 5; ctx.stroke(); }
      ctx.restore();
    } else if (build) { const r = OPS.defense.build.turret.range[lv - 1]; ctx.save(); ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = '#ffcf4a'; ctx.setLineDash([10, 12]); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
  });
}
/** the structures that stand up (y-sorted props: turrets + ward totems) */
export function defenseProps(A, V, view) {
  const out = []; if (!V || !V.so) return out;
  A.socks.forEach((s, i) => { const q = V.so[i]; if (!q || !q[0] || q[0] === 's') return; if (s.x < view.x0 - 120 || s.x > view.x1 + 120 || s.y < view.y0 - 40 || s.y > view.y1 + 240) return; out.push({ kind: 'oprop', st: BUILD_K[q[0]], lv: q[1], off: q[2], s, i, A, y: s.y }); });
  return out;
}
export function drawStructure(ctx, e, t) {
  const s = e.s, off = !!e.off, lv = e.lv | 0, B = OPS_BIOME[e.A.biome];
  if (e.st === 'turret') {
    const h = 58 + lv * 10;
    rrect(ctx, s.x - 16, s.y - h, 32, h + 2, 7); ctx.fillStyle = shade(B.wall, 26); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(s.x - 11, s.y - h + 6, 6, h - 10);
    const ang = off ? 0.6 : turretAim(e.i, t), hy = s.y - h - 6;
    ctx.save(); ctx.translate(s.x, hy); ctx.rotate(ang);
    rrect(ctx, -6, -7, 42 + lv * 6, 14, 5); ctx.fillStyle = off ? '#777' : '#5c5468'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
    if (lv > 1) { rrect(ctx, -6, -15, 40, 8, 3); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(s.x, hy, 15, 0, TAU); ctx.fillStyle = off ? '#8a8494' : '#ffcf4a'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.arc(s.x - 4, hy - 4, 5, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
    if (lv > 1) label(ctx, 'II', s.x, s.y - 20, 12, '#ffffff', 3);
  } else if (e.st === 'ward') {
    const h = 64 + lv * 8, fy = s.y - h - 12 + Math.sin(t * 2.5 + e.i) * 4;
    ctx.beginPath(); ctx.moveTo(s.x - 14, s.y + 2); ctx.lineTo(s.x - 8, s.y - h); ctx.lineTo(s.x + 8, s.y - h); ctx.lineTo(s.x + 14, s.y + 2); ctx.closePath(); ctx.fillStyle = shade(B.wall, 18); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    for (let k = 0; k < 3; k++) { ctx.fillStyle = off ? '#666' : '#7de8ff'; ctx.fillRect(s.x - 6, s.y - 20 - k * 18, 12, 4); }
    ctx.beginPath(); ctx.arc(s.x, fy, 14 + lv * 2, 0, TAU); ctx.fillStyle = off ? '#8a8494' : '#bff6ff'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
    if (!off) { ctx.save(); ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 6); ctx.beginPath(); ctx.arc(s.x, fy, 26, 0, TAU); ctx.fillStyle = '#7de8ff'; ctx.fill(); ctx.restore(); }
  }
  if (off) { label(ctx, 'OFFLINE', s.x, s.y - 100, 12, '#ff8a6a', 3); }
}
const AIM = new Map();
function turretAim(i, t) { const a = AIM.get(i); return a && nowS() - a.t0 < 1.5 ? a.ang : Math.sin(t * 0.7 + i) * 1.2 + i; }
/** Swarm: the safe ring (the corruption outside it, the next ring while it shrinks), the centre sigil */
export function drawSwarmUnder(ctx, A, V, t, lite, view) {
  const r = V.sr || OPS.swarm.safe[0], H = OPS_HAZ[A.biome], cx = A.cx, cy = A.cy, shrinking = (V.shk || 0) > 0;
  // the corruption outside the ring (an even-odd fill: the view minus the circle)
  ctx.save();
  ctx.beginPath(); ctx.rect(view.x0 - 20, view.y0 - 20, view.x1 - view.x0 + 40, view.y1 - view.y0 + 40); ctx.arc(cx, cy, r, 0, TAU, true);
  ctx.fillStyle = 'rgba(70,14,60,.42)'; ctx.fill('evenodd');
  if (!lite) { ctx.globalAlpha = 0.5; for (let i = 0; i < 18; i++) { const a = i * TAU / 18 + t * 0.15, rr = r + 40 + 60 * hash(i), x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; ctx.beginPath(); ctx.arc(x, y, 10 + 8 * Math.sin(t * 3 + i), 0, TAU); ctx.fillStyle = '#a03a9a'; ctx.fill(); } }
  ctx.restore();
  // the edge: a bright dashed rim + teeth
  ctx.save(); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = 6; ctx.strokeStyle = shrinking ? (Math.sin(t * 12) > 0 ? '#ff5e5b' : '#ffd23f') : '#ff6fd8'; ctx.setLineDash([26, 16]); ctx.lineDashOffset = -t * 50; ctx.stroke(); ctx.setLineDash([]);
  if (!lite) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.22; ctx.lineWidth = 22; ctx.strokeStyle = '#ff6fd8'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
  if (shrinking && V.srt < r - 4) { ctx.save(); ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 10); ctx.beginPath(); ctx.arc(cx, cy, V.srt, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = '#ffd23f'; ctx.setLineDash([12, 12]); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
  // the centre sigil (the wave count lights its spokes)
  ctx.save(); ctx.globalAlpha = 0.5; const n = OPS.swarm.waves;
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * TAU / n, on = i < (V.w > n ? n : (V.w || 0) - (V.brk > 0 || V.left > 0 ? 1 : 0)); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70); ctx.lineTo(cx + Math.cos(a) * 130, cy + Math.sin(a) * 130); ctx.lineWidth = 9; ctx.strokeStyle = on ? OPS_TYPE.swarm.col : 'rgba(255,255,255,.25)'; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(cx, cy, 64, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = H.col; ctx.stroke(); ctx.restore();
}

// ------------------------------------------------------------------ telegraphs (render.js drawArea hook)
const k01 = (a) => Math.min(1, (a.t || 0) / Math.max(1, a.delay || 1));
export function drawOpsArea(ctx, a, t, lite = false) {
  const kd = a.kind; if (!kd || kd[0] !== 'o') return false;
  if (kd.startsWith('ohz_')) return drawHazArea(ctx, a, t, kd.slice(4), lite);
  const k = k01(a);
  switch (kd) {
    case 'oslam': { // the siege slam: a heavy ring closing in
      ctx.save(); ctx.globalAlpha = 0.16 + 0.18 * k; circle(ctx, a.x, a.y, a.r, '#ff3b2b', 0);
      ctx.globalAlpha = 0.9; ctx.lineWidth = 6; ctx.strokeStyle = '#ff3b2b'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = '#ffd0c8'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r * (1 - 0.85 * k) + 8, 0, TAU); ctx.stroke();
      for (let i = 0; i < 8; i++) { const an = i * TAU / 8; ctx.beginPath(); ctx.moveTo(a.x + Math.cos(an) * a.r * 0.5, a.y + Math.sin(an) * a.r * 0.5); ctx.lineTo(a.x + Math.cos(an) * a.r * 0.95, a.y + Math.sin(an) * a.r * 0.95); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,90,60,.6)'; ctx.stroke(); }
      ctx.restore(); return true;
    }
    case 'obomb': { // a boulder on its way down: the shadow grows, the rock falls in
      if (a.t >= a.delay) return true;
      ctx.save(); ctx.globalAlpha = 0.2 + 0.25 * k; circle(ctx, a.x, a.y, a.r, '#ff5a3a', 0);
      ctx.globalAlpha = 0.9; ctx.lineWidth = 4; ctx.strokeStyle = '#ff5a3a'; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.ellipse(a.x, a.y, a.r * 0.5 * k, a.r * 0.25 * k, 0, 0, TAU); ctx.fillStyle = INK; ctx.fill();
      const ry = a.y - 520 * (1 - k) - 20; ctx.globalAlpha = 1; ctx.save(); ctx.translate(a.x, ry); ctx.rotate(t * 5); ctx.beginPath(); for (let i = 0; i < 7; i++) { const an = i * TAU / 7, rr = 22 + 6 * hash(i + 3); ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fillStyle = '#8a7a6a'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
      ctx.restore(); return true;
    }
    case 'oacidhit': { // an acid glob arcing in
      if (a.t >= a.delay) return true;
      ctx.save(); ctx.globalAlpha = 0.18 + 0.22 * k; circle(ctx, a.x, a.y, a.r, '#9cff3a', 0); ctx.globalAlpha = 0.9; ctx.lineWidth = 3.5; ctx.strokeStyle = '#6ad41a'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(a.x, a.y, a.r * k, 0, TAU); ctx.lineWidth = 2; ctx.stroke();
      ctx.globalAlpha = 1; circle(ctx, a.x + 60 * (1 - k), a.y - 360 * (1 - k) * (1 - k) - 10, 9 + 5 * k, '#c8ff6a', 3);
      ctx.restore(); return true;
    }
    case 'oacid': { // the pool it leaves
      if (a.t < a.delay) return true;
      const life = a.delay + (a.pulses - 1) * a.every, fade = clamp01((life + 10 - a.t) / 14);
      ctx.save(); ctx.globalAlpha = 0.5 * fade; circle(ctx, a.x, a.y, a.r, '#7fd62a', 0); ctx.globalAlpha = 0.85 * fade; ctx.lineWidth = 3; ctx.strokeStyle = '#3d7a12'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke();
      for (let i = 0; i < (lite ? 3 : 6); i++) { const an = i * 2.1 + t * 1.5, rr = a.r * (0.2 + 0.6 * hash(i + a.id)), bx = a.x + Math.cos(an) * rr, by = a.y + Math.sin(an) * rr * 0.7, ph = (t * 1.6 + i * 0.3) % 1; ctx.globalAlpha = fade * (1 - ph); circle(ctx, bx, by - ph * 10, 4 + 6 * ph, '#d8ff8a', 1.5); }
      ctx.restore(); return true;
    }
    case 'odonut': { // the Queen's Screech: safe hugging her or far out
      const r0 = a.r0 || 0;
      ctx.save(); ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.arc(a.x, a.y, r0, 0, TAU, true); ctx.globalAlpha = 0.18 + 0.25 * k; ctx.fillStyle = '#d04aff'; ctx.fill('evenodd');
      ctx.globalAlpha = 0.95; ctx.lineWidth = 6; ctx.strokeStyle = '#d04aff'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#7dffb0'; ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.arc(a.x, a.y, r0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 0.7; ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(a.x, a.y, r0 + (a.r - r0) * k, 0, TAU); ctx.stroke();
      ctx.restore(); label(ctx, 'HUG HER OR GET OUT!', a.x, a.y - a.r - 14, 15, '#f0c8ff', 4); return true;
    }
    case 'ovol': { // a volatile corpse about to burst
      ctx.save(); ctx.globalAlpha = 0.2 + 0.3 * k; circle(ctx, a.x, a.y, a.r, '#ff9a3a', 0); ctx.globalAlpha = 0.9; ctx.lineWidth = 3; ctx.strokeStyle = Math.sin(t * 20) > 0 ? '#ffd23f' : '#ff5e2b'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke();
      circle(ctx, a.x, a.y, 6 + 8 * k, '#fff1a8', 2); ctx.restore(); return true;
    }
  }
  return drawOpsArea3(ctx, a, t, lite) || drawOpsArea2(ctx, a, t, lite);
}
function drawHazArea(ctx, a, t, id, lite) {
  const k = k01(a), pre = a.t < a.delay;
  ctx.save();
  if (id === 'thorns') {
    if (pre) { ctx.globalAlpha = 0.16 + 0.2 * k; circle(ctx, a.x, a.y, a.r, '#5aa543', 0); ctx.globalAlpha = 0.9; ctx.lineWidth = 3.5; ctx.strokeStyle = '#9cff5a'; ctx.setLineDash([9, 7]); ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      for (let i = 0; i < 7; i++) { const an = i * TAU / 7 + a.id, rr = a.r * 0.6, x = a.x + Math.cos(an) * rr, y = a.y + Math.sin(an) * rr * 0.7; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x, y - 6 - 16 * k); ctx.lineTo(x + 4, y); ctx.closePath(); ctx.fillStyle = '#3f8a35'; ctx.fill(); } }
    else { const f = clamp01(1 - (a.t - a.delay) / 40); ctx.globalAlpha = f; for (let i = 0; i < 12; i++) { const an = i * TAU / 12 + a.id, rr = a.r * (0.2 + 0.7 * hash(i + a.id)), x = a.x + Math.cos(an) * rr, y = a.y + Math.sin(an) * rr * 0.7, h = 30 + 20 * hash(i * 7 + a.id); ctx.beginPath(); ctx.moveTo(x - 7, y + 4); ctx.quadraticCurveTo(x - 10, y - h * 0.6, x + 3, y - h); ctx.quadraticCurveTo(x + 2, y - h * 0.5, x + 7, y + 4); ctx.closePath(); ctx.fillStyle = i % 3 ? '#4f9a3a' : '#2f6a28'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); if (i % 4 === 0) circle(ctx, x + 3, y - h, 4, '#ff6fb5', 1.5); } }
  } else if (id === 'sandstorm') {
    if (pre) { ctx.globalAlpha = 0.14 + 0.2 * k; circle(ctx, a.x, a.y, a.r, '#e8b45a', 0); ctx.globalAlpha = 0.85; ctx.lineWidth = 3; ctx.strokeStyle = '#ffcf6a'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(a.x, a.y, a.r * (0.4 + i * 0.3), t * (3 + i) + i, t * (3 + i) + i + 3.5); ctx.stroke(); } }
    else { const f = clamp01((a.delay + (a.pulses - 1) * a.every + 12 - a.t) / 14); ctx.globalAlpha = 0.55 * f; for (let i = 0; i < 6; i++) { const yy = a.y - i * 22, rw = a.r * (0.35 + i * 0.13); ctx.beginPath(); ctx.ellipse(a.x + Math.sin(t * 9 + i) * 8, yy, rw, rw * 0.32, 0, t * 8 + i, t * 8 + i + 4.6); ctx.lineWidth = 7 - i * 0.6; ctx.strokeStyle = i % 2 ? '#e8b45a' : '#fff0c0'; ctx.stroke(); } ctx.globalAlpha = 0.2 * f; circle(ctx, a.x, a.y, a.r, '#c8823a', 0); }
  } else if (id === 'blizzard') {
    if (pre) { ctx.globalAlpha = 0.2 + 0.25 * k; circle(ctx, a.x, a.y, a.r, '#3d8fd6', 0); ctx.globalAlpha = 0.95; ctx.lineWidth = 4; ctx.strokeStyle = '#1f5fa8'; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r * (1 - 0.8 * k), 0, TAU); ctx.stroke(); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(a.x, a.y, a.r * 0.35 * k, a.r * 0.18 * k, 0, 0, TAU); ctx.fillStyle = INK; ctx.fill();
      const iy = a.y - 560 * (1 - k) * (1 - k) - 30; ctx.globalAlpha = 1; ctx.beginPath(); ctx.moveTo(a.x - 13, iy - 40); ctx.lineTo(a.x + 13, iy - 40); ctx.lineTo(a.x, iy + 22); ctx.closePath(); ctx.fillStyle = '#dff6ff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
    else { const f = clamp01(1 - (a.t - a.delay) / 30); ctx.globalAlpha = f; for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + a.id, x = a.x + Math.cos(an) * a.r * 0.45, y = a.y + Math.sin(an) * a.r * 0.3; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 2, y - 18); ctx.lineTo(x + 8, y); ctx.closePath(); ctx.fillStyle = '#dff6ff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); } ctx.globalAlpha = 0.35 * f; circle(ctx, a.x, a.y, a.r * 0.8, '#ffffff', 0); }
  } else if (id === 'starfall') { // game loop C3: a star falls out of the torn sky (violet ring + a falling star) -> a burst of starlight
    if (pre) { ctx.globalAlpha = 0.16 + 0.24 * k; circle(ctx, a.x, a.y, a.r, '#8a5ae0', 0); ctx.globalAlpha = 0.95; ctx.lineWidth = 4; ctx.strokeStyle = '#c9a8ff'; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 3; ctx.strokeStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r * k, 0, TAU); ctx.stroke();
      const sy = a.y - 620 * (1 - k) * (1 - k) - 20, sx = a.x + 160 * (1 - k); ctx.globalAlpha = 0.6; ctx.lineCap = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = '#b48cff'; ctx.beginPath(); ctx.moveTo(sx + 70, sy - 110); ctx.lineTo(sx, sy); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const an = i * TAU / 10 - Math.PI / 2 + t * 4, rr = i % 2 ? 7 : 17; ctx.lineTo(sx + Math.cos(an) * rr, sy + Math.sin(an) * rr); } ctx.closePath(); ctx.fillStyle = '#fff4b0'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
    else { const f = clamp01(1 - (a.t - a.delay) / 30); ctx.globalAlpha = 0.7 * f; circle(ctx, a.x, a.y, a.r * (0.6 + 0.4 * (1 - f)), '#e8dcff', 0); ctx.globalAlpha = f; ctx.lineWidth = 4; ctx.strokeStyle = '#ffe27a';
      for (let i = 0; i < 8; i++) { const an = i * TAU / 8 + a.id, r1 = a.r * (0.3 + 0.9 * (1 - f)); ctx.beginPath(); ctx.moveTo(a.x + Math.cos(an) * r1 * 0.4, a.y + Math.sin(an) * r1 * 0.3); ctx.lineTo(a.x + Math.cos(an) * r1, a.y + Math.sin(an) * r1 * 0.7); ctx.stroke(); } }
  } else { // lava vents: a cracking vent -> eruption -> a lava pool
    if (pre) { ctx.globalAlpha = 0.18 + 0.25 * k; circle(ctx, a.x, a.y, a.r, '#ff5e2b', 0); ctx.globalAlpha = 0.9; ctx.lineWidth = 3.5; ctx.strokeStyle = '#ff8a3a'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { const an = i * TAU / 5 + a.id; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + Math.cos(an) * a.r * 0.8 * k, a.y + Math.sin(an) * a.r * 0.55 * k); ctx.stroke(); } }
    else { const life = a.delay + (a.pulses - 1) * a.every, f = clamp01((life + 12 - a.t) / 16), e = clamp01(1 - (a.t - a.delay) / 26);
      ctx.globalAlpha = 0.65 * f; circle(ctx, a.x, a.y, a.r * 0.9, '#ff6a1a', 0); ctx.globalAlpha = 0.9 * f; ctx.lineWidth = 4; ctx.strokeStyle = '#5a1a0a'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r * 0.9, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.6 * f; circle(ctx, a.x + Math.sin(t * 2 + a.id) * 14, a.y + 6, a.r * 0.4, '#ffd23f', 0);
      if (e > 0) { ctx.globalAlpha = e; for (let i = 0; i < 8; i++) { const an = -Math.PI / 2 + (hash(i + a.id) - 0.5) * 1.6, h = 90 * (1 - e) + 40; circle(ctx, a.x + Math.cos(an) * h * 0.6, a.y - h * hash(i * 3 + a.id) * 1.4, 7 * e + 3, i % 2 ? '#ffd23f' : '#ff6a1a', 0); } } }
  }
  ctx.restore();
  return true;
}

// ------------------------------------------------------------------ world: over the characters
/** turret tracers, pulse shockwaves, flying boulders, the storm overlay (lite: a flat tint, no particles) */
export function drawMissionOver(ctx, sim, A, V, view, t, lite) {
  const n = nowS();
  prune(TR, 0.25); prune(WAVES, 0.9); prune(BOMBS, 2);
  for (const q of TR) { const k = (n - q.t0) / 0.25; ctx.save(); ctx.globalAlpha = 1 - k; ctx.lineCap = 'round'; ctx.lineWidth = (q.lv > 1 ? 7 : 5) * (1 - k) + 1; ctx.strokeStyle = '#ffcf4a'; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x2, q.y2); ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.restore(); }
  for (const w of WAVES) { const k = (n - w.t0) / 0.9, r = w.r * (0.15 + 0.85 * Math.sqrt(k)); ctx.save(); ctx.globalAlpha = 0.85 * (1 - k); ctx.beginPath(); ctx.arc(w.x, w.y, r, 0, TAU); ctx.lineWidth = 26 * (1 - k) + 4; ctx.strokeStyle = w.col; ctx.stroke(); if (!lite) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 * (1 - k); ctx.fillStyle = w.col; ctx.fill(); } ctx.restore(); }
  for (const b of BOMBS) { const k = clamp01((n - b.t0) / b.dur); if (k >= 1) continue; const x = b.x0 + (b.x - b.x0) * k, y = b.y0 + (b.y - b.y0) * k - Math.sin(Math.PI * k) * 300; ctx.save(); ctx.translate(x, y); ctx.rotate(n * 6); ctx.beginPath(); for (let i = 0; i < 7; i++) { const an = i * TAU / 7; ctx.lineTo(Math.cos(an) * 20, Math.sin(an) * 20); } ctx.closePath(); ctx.fillStyle = '#8a7a6a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); }
  // the storm (V.hs): a biome tint + driving particles over the arena
  if (V && V.hs) drawStorm(ctx, A, view, t, lite, V.hst || 0);
  drawMission2Over(ctx, A, V, view, t, lite);
  drawMission3Over(ctx, A, V, sim, t, lite);
  if (n - FLASH.t0 < 0.35) { ctx.save(); ctx.globalAlpha = 0.35 * (1 - (n - FLASH.t0) / 0.35); ctx.fillStyle = FLASH.col; ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0); ctx.restore(); }
}
function drawStorm(ctx, A, view, t, lite, left) {
  const id = OPS_HAZ[A.biome].id, W = view.x1 - view.x0, Hh = view.y1 - view.y0, fade = clamp01(left / 60);
  const tint = { thorns: 'rgba(40,90,30,.18)', sandstorm: 'rgba(170,120,50,.28)', blizzard: 'rgba(235,248,255,.32)', lava: 'rgba(120,30,10,.22)', starfall: 'rgba(40,20,90,.30)' }[id];
  ctx.save(); ctx.globalAlpha = fade; ctx.fillStyle = tint; ctx.fillRect(view.x0, view.y0, W, Hh);
  const N = lite ? 30 : 90;
  for (let i = 0; i < N; i++) {
    const h1 = hash(i * 13 + 1), h2 = hash(i * 7 + 5), sp = 0.6 + h2;
    if (id === 'sandstorm') { const x = view.x0 + ((h1 * W + t * 700 * sp) % W), y = view.y0 + ((h2 * Hh + Math.sin(t + i) * 30) % Hh + Hh) % Hh; ctx.fillStyle = i % 3 ? '#e8c27a' : '#fff0c0'; ctx.fillRect(x, y, 14 * sp, 2.5); }
    else if (id === 'blizzard') { const x = view.x0 + ((h1 * W + t * 260 * sp) % W), y = view.y0 + ((h2 * Hh + t * 420 * sp) % Hh); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 2 + 2.5 * h2, 0, TAU); ctx.fill(); }
    else if (id === 'starfall') { const x = view.x0 + ((h1 * W - t * 220 * sp) % W + W) % W, y = view.y0 + ((h2 * Hh + t * 360 * sp) % Hh); ctx.strokeStyle = i % 3 ? '#e8dcff' : '#ffe27a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18 * sp, y - 30 * sp); ctx.stroke(); }
    else if (id === 'lava') { const x = view.x0 + ((h1 * W - t * 80 * sp) % W + W) % W, y = view.y0 + ((h2 * Hh + t * 300 * sp) % Hh); ctx.fillStyle = i % 2 ? '#ffd23f' : '#ff6a1a'; ctx.fillRect(x, y, 3, 7); }
    else { const x = view.x0 + ((h1 * W + Math.sin(t * 0.8 + i) * 60 + t * 40) % W + W) % W, y = view.y0 + ((h2 * Hh + t * 60 * sp) % Hh); ctx.fillStyle = i % 4 ? '#9cff5a' : '#ff6fb5'; ctx.beginPath(); ctx.ellipse(x, y, 5, 2.5, t + i, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}
/** a brood egg (drawn instead of the enemy art) */
export function drawEgg(ctx, e, t, biome) {
  const H = OPS_HAZ[biome] || OPS_HAZ.wilds, k = clamp01(1 - (e.hp / Math.max(1, e.maxHp))), wob = Math.sin(t * 9 + e.id) * 0.06;
  ctx.save(); ctx.translate(e.x, e.y);
  ctx.beginPath(); ctx.ellipse(0, 8, 30, 12, 0, 0, TAU); ctx.fillStyle = 'rgba(20,12,24,.35)'; ctx.fill();
  ctx.rotate(wob); ctx.beginPath(); ctx.ellipse(0, -24, 24, 32, 0, 0, TAU); ctx.fillStyle = shade(H.col2, -10); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.save(); ctx.globalAlpha = 0.45 + 0.3 * Math.sin(t * 6 + e.id); ctx.beginPath(); ctx.ellipse(0, -24, 13, 18, 0, 0, TAU); ctx.fillStyle = H.col; ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.ellipse(-8, -36, 6, 9, -0.4, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill();
  if (k > 0.2) { ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-14, -30); ctx.lineTo(-4, -22); ctx.lineTo(-10, -12); if (k > 0.55) { ctx.moveTo(12, -40); ctx.lineTo(4, -28); ctx.lineTo(12, -18); } ctx.stroke(); }
  if (e.flash > 0) { ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.ellipse(0, -24, 24, 32, 0, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); }
  ctx.restore();
}

// ------------------------------------------------------------------ HUD
const TRACK_W = 250;
/** the objective tracker (left, under the portrait) + the combo meter. Returns nothing. */
export function drawTracker(ctx, A, V, p, w, h, txt, bar, t, keyLabel) {
  if (!V || V.st === 'intro' || V.st === 'results') return;
  const x = 14, H = OPS_HAZ[A.biome], T = OPS_TYPE[A.type];
  let y = Math.min(h * 0.28, 196);
  const lines = [];
  if (A.type === 'defense') {
    if (V.st === 'choice') lines.push(['Choose: Extract or Continue', '#ffe9a0']);
    else if (V.ph === 'build') { lines.push([`Build phase · wave ${V.w + 1} in ${Math.ceil((V.bt || 0) / 60)} s`, H.matCol]); lines.push([`Spend ${H.mat} at the sockets`, '#ffffff']); lines.push([`Ready up at the relic (${keyLabel('interact')})`, '#d8d0e2']); }
    else { lines.push([`Wave ${V.w}/${V.nw} · ${V.left} left`, '#ffffff']); lines.push([V.chg >= 100 ? `PULSE READY: ${keyLabel('interact')} at the relic` : `Relic charge ${V.chg}% (stand close)`, V.chg >= 100 ? '#ffffff' : H.col]); }
  } else if (A.type === 'swarm') {
    if (V.w > V.nw) lines.push(['Slay the Swarm Queen', '#ffd0ff'], ['Break her eggs before they hatch', '#ffffff']);
    else if (V.brk > 0) lines.push([`Wave ${Math.min(V.nw, V.w + 1)} in ${Math.ceil(V.brk / 60)} s`, '#ffffff']);
    else lines.push([`Wave ${V.w}/${V.nw} · ${V.left} left`, '#ffffff']);
    lines.push([`Stay inside the ring${(V.shk || 0) > 0 ? ' · SHRINKING!' : ''}`, (V.shk || 0) > 0 ? '#ff8a8a' : '#ffb8f0']);
  }
  const rowH = 19, panelH = 38 + lines.length * rowH + (A.type === 'defense' && V.st !== 'choice' ? 54 : 0) + (A.type === 'swarm' ? 30 : 0);
  ctx.save(); rrect(ctx, x, y, TRACK_W, panelH, 12); ctx.fillStyle = 'rgba(28,20,40,.72)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = T.col; ctx.fillRect(x + 3, y + 3, 5, panelH - 6); ctx.restore();
  txt(ctx, 'OBJECTIVE', x + 18, y + 20, 15, T.col, 'left', 3);
  if (V.mods && V.mods.length) txt(ctx, V.mods.map((k) => WEEKLY[k] ? WEEKLY[k].name : k).join(' · '), x + TRACK_W - 10, y + 19, 11, '#ffe7a0', 'right', 3);
  let yy = y + 40;
  for (const [s, c] of lines) { txt(ctx, s, x + 18, yy, 13.5, c, 'left', 3); yy += rowH; }
  if (A.type === 'defense' && V.st !== 'choice') {
    bar(ctx, x + 16, yy - 6, TRACK_W - 32, 16, clamp01(V.hp / OPS.defense.relicHp), V.hp < 35 ? '#ff5e5b' : T.col, `RELIC ${V.hp}%`);
    if (V.sh > 0) { rrect(ctx, x + 18, yy - 10, (TRACK_W - 36) * clamp01(V.sh / OPS.defense.shield), 4, 2); ctx.fillStyle = '#bff3ff'; ctx.fill(); }
    // materials + the wave modifier chip
    gem(ctx, x + 26, yy + 26, 8, H.matCol); txt(ctx, `${V.mat} ${H.mat}`, x + 40, yy + 31, 14, H.matCol, 'left', 3);
    const wm = V.ph === 'build' ? (V.wms && V.wms[V.w]) : V.wm;
    if (wm && WAVE_MODS[wm]) chip(ctx, txt, x + TRACK_W - 16, yy + 26, (V.ph === 'build' ? 'NEXT: ' : '') + WAVE_MODS[wm].name.toUpperCase(), WAVE_MODS[wm].col, 'right');
  }
  if (A.type === 'swarm') { for (let i = 0; i < Math.max(3, V.lv || 0); i++) heart(ctx, x + 26 + i * 22, yy + 4, i < (V.lv || 0)); txt(ctx, 'party lives', x + 30 + Math.max(3, V.lv || 0) * 22, yy + 9, 12, '#d8d0e2', 'left', 3); }
  if (A.type === 'swarm') drawCombo(ctx, V, x, y + panelH + 10, txt, t);
}
function gem(ctx, x, y, r, col) { ctx.beginPath(); ctx.moveTo(x, y - r * 1.3); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.3); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); }
function heart(ctx, x, y, on) { ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.moveTo(0, 7); ctx.bezierCurveTo(-12, -2, -6, -11, 0, -4); ctx.bezierCurveTo(6, -11, 12, -2, 0, 7); ctx.fillStyle = on ? '#ff5e7a' : 'rgba(255,255,255,.15)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); }
function chip(ctx, txt, x, y, s, col, align = 'left') { const wd = s.length * 7.2 + 16, x0 = align === 'right' ? x - wd : x; rrect(ctx, x0, y - 10, wd, 20, 8); ctx.fillStyle = 'rgba(20,12,24,.8)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke(); txt(ctx, s, x0 + wd / 2, y + 5, 11.5, col, 'center', 2); }
/** the Swarm combo meter: the count, the window draining, the tier ladder + the loot multiplier */
function drawCombo(ctx, V, x, y, txt, t) {
  const K = OPS.swarm.combo, n = V.cb || 0, win = clamp01((V.cbt || 0) / K.window);
  let tier = 0; while (tier < K.tiers.length && n >= K.tiers[tier]) tier++;
  const mul = tier ? K.mul[tier - 1] : 1, next = K.tiers[tier], col = ['#ffffff', '#7dffb0', '#6ec8ff', '#ffcf4a', '#ff6fd8'][tier];
  const Wd = TRACK_W, Hd = 74;
  ctx.save(); rrect(ctx, x, y, Wd, Hd, 12); ctx.fillStyle = 'rgba(28,20,40,.72)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = n ? col : INK; ctx.stroke(); ctx.restore();
  const pop = n && win > 0.92 ? 1 + (win - 0.92) * 3 : 1;
  ctx.save(); ctx.translate(x + 50, y + 42); ctx.scale(pop, pop); txt(ctx, n ? `x${n}` : 'x0', 0, 6, 30, n ? col : 'rgba(255,255,255,.4)', 'center', 5); ctx.restore();
  txt(ctx, 'COMBO', x + 50, y + 16, 12, '#d8d0e2', 'center', 3);
  txt(ctx, `LOOT x${mul.toFixed(2).replace(/0$/, '')}`, x + 100, y + 22, 15, tier ? col : '#d8d0e2', 'left', 3);
  txt(ctx, next ? `${next - n} more for x${K.mul[tier]}` : 'MAX TIER', x + 100, y + 40, 12, '#ffffff', 'left', 3);
  // tier pips
  for (let i = 0; i < K.tiers.length; i++) { rrect(ctx, x + 100 + i * 34, y + 48, 30, 7, 3); ctx.fillStyle = i < tier ? ['#7dffb0', '#6ec8ff', '#ffcf4a', '#ff6fd8'][i] : 'rgba(255,255,255,.18)'; ctx.fill(); }
  // the window draining
  rrect(ctx, x + 12, y + Hd - 10, Wd - 24, 5, 2); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill();
  if (n) { rrect(ctx, x + 12, y + Hd - 10, (Wd - 24) * win, 5, 2); ctx.fillStyle = win < 0.3 ? '#ff5e5b' : col; ctx.fill(); }
  txt(ctx, `best x${V.best || 0}`, x + Wd - 12, y + 16, 11, '#d8d0e2', 'right', 3);
}
/** the build-phase banner prompt (centre, under the top HUD) */
export function drawBuildPrompt(ctx, A, V, p, w, y, txt, t, keyLabel) {
  if (A.type !== 'defense' || V.st !== 'run' || V.ph !== 'build') return y;
  const H = OPS_HAZ[A.biome], s = Math.ceil((V.bt || 0) / 60);
  txt(ctx, `BUILD PHASE · ${s} s`, w / 2, y + 22, 24, Math.sin(t * 6) > 0 ? H.matCol : '#ffffff', 'center', 5);
  txt(ctx, `${keyLabel('interact')} at a socket: Turret ${OPS.defense.build.turret.cost} · Spikes ${OPS.defense.build.spike.cost} · Ward ${OPS.defense.build.ward.cost} ${H.mat}  ·  at the relic: start the wave`, w / 2, y + 42, 13, '#ffffff', 'center', 3);
  return y + 52;
}
/** the results panel: grade stamp, score lines, the reward multiplier (centre) */
export function drawResults(ctx, A, V, w, h, txt, t, mobile) {
  const G = V.gr; if (!G) return false;
  const T = OPS_TYPE[A.type], pw = Math.min(460, w - 30), lh = 22, ph = 164 + G.l.length * lh + 34, x = w / 2 - pw / 2, y = Math.max(120, h * 0.5 - ph / 2 - 20);
  const k = clamp01((V.endT || 0) / 40), ok = V.res !== 'fail';
  ctx.save(); ctx.globalAlpha = k; rrect(ctx, x, y, pw, ph, 18); ctx.fillStyle = 'rgba(24,16,36,.88)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = G.c; ctx.stroke(); ctx.restore();
  if (k < 0.2) return true;
  const title = V.res === 'clear' ? 'MISSION COMPLETE' : V.res === 'extract' ? 'EXTRACTED' : 'MISSION FAILED';
  txt(ctx, title, w / 2, y + 34, 26, ok ? '#7dffb0' : '#ff5e5b', 'center', 5);
  txt(ctx, V.msg || '', w / 2, y + 56, 13.5, '#ffffff', 'center', 3);
  // the grade stamp (slams in)
  const sk = clamp01(((V.endT || 0) - 20) / 22), sc = 1 + 1.6 * (1 - sk) * (1 - sk), sx = x + pw - 66, sy = y + 112;
  if (sk > 0) { ctx.save(); ctx.translate(sx, sy); ctx.rotate(-0.18); ctx.scale(sc, sc); ctx.globalAlpha = sk; circle(ctx, 0, 0, 42, 'rgba(20,12,24,.9)', 5, G.c); txt(ctx, G.g, 0, 18, 54, G.c, 'center', 6); ctx.restore(); }
  txt(ctx, `SCORE ${G.s}`, x + 24, y + 92, 18, G.c, 'left', 4);
  txt(ctx, `Rewards x${G.m}${G.bn ? ` (grade x${G.gm} · weekly +${Math.round(G.bn * 100)}%)` : ''}`, x + 24, y + 114, 13, '#ffe7a0', 'left', 3);
  { const L = BEST.last, nb = L && L.k === A.type && L.g === G.g && L.s === G.s, r = bestFor(A.type); // part 3: your best grade for this mission type
    if (nb && L.best) txt(ctx, `NEW BEST ${OPS_TYPE[A.type].name.toUpperCase()} GRADE!${L.prev ? ` (was ${L.prev.g} ${L.prev.s})` : ''}`, x + 24, y + 134, 13.5, Math.sin(t * 8) > 0 ? '#ffd23f' : '#ffffff', 'left', 3);
    else if (r) txt(ctx, `Your best ${OPS_TYPE[A.type].name}: ${r.g} · ${r.s} pts${nb && L.here ? ' · new best on this map!' : ''}`, x + 24, y + 134, 12.5, '#cfc6e6', 'left', 3); }
  let yy = y + 164; // (part 3: below the grade stamp + the best-grade line)
  G.l.forEach((L, i) => {
    const show = (V.endT || 0) > 26 + i * 8; if (!show) return;
    txt(ctx, L[0], x + 24, yy, 14, '#ffffff', 'left', 3); txt(ctx, L[3] || '', x + pw * 0.48, yy, 12.5, '#d8d0e2', 'left', 3);
    txt(ctx, `${L[1]}/${L[2]}`, x + pw - 24, yy, 14, L[1] >= L[2] ? '#7dffb0' : '#ffffff', 'right', 3);
    yy += lh;
  });
  txt(ctx, `${GRADES.map((g) => `${g[0]} ${g[1]}+`).join(' · ')}  ·  home in ${Math.max(0, Math.ceil((OPS.results - (V.endT || 0)) / 60))} s · loot is in your bag`, w / 2, y + ph - 14, 11.5, '#bfb4d0', 'center', 3);
  return true;
}

// ------------------------------------------------------------------ event fx (opsfx.opsEventFx calls this first)
export function missionEventFx(fx, ev, me) {
  const x = ev.x, y = ev.y, has = x != null, H = OPS_HAZ[ev.b] || OPS_HAZ.wilds, n = nowS();
  switch (ev.ph) {
    case 'build': fx.banner(`BUILD PHASE`, H.matCol, `Wave ${ev.w} in ${Math.round(ev.t / 60)} s · ${ev.mat} ${H.mat}${ev.next && WAVE_MODS[ev.next] ? ` · next: ${WAVE_MODS[ev.next].name}` : ''}`, 2.2, 44); if (ev.clean) fx.text(x, y - 150, `+${ev.clean} ${H.mat} · clean wave!`, { color: H.matCol, size: 22, life: 1.6 }); return true;
    case 'built': if (has) { fx.ring(x, y, 90, H.matCol, 0.5, 8); fx.sparks(x, y - 30, -Math.PI / 2, fx.lite ? 8 : 18, H.matCol, 320, 1.6); fx.puffs(x, y, 8, '#d8d0e2', 14, 120, 0.6); fx.text(x, y - 90, ev.lv > 1 ? 'UPGRADED!' : `${(BUILD_INFO[ev.sk] || {}).name || 'Built'}!`, { color: '#ffffff', size: 20 }); } return true;
    case 'ready': fx.banner('READY!', '#ffffff', 'The wave is coming', 0.9, 36); return true;
    case 'mat': if (has) fx.text(x, y - 40, `+${ev.n} ${H.mat}`, { color: H.matCol, size: 18, life: 1.1 }); return true;
    case 'charged': if (has) { fx.ring(x, y - 60, 160, H.col, 0.6, 10); fx.text(x, y - 170, 'PULSE READY', { color: '#ffffff', size: 24, life: 1.4 }); } return true;
    case 'pulse': if (has) { WAVES.push({ x, y: y - 30, r: ev.r, col: H.col, t0: n }); WAVES.push({ x, y: y - 30, r: ev.r * 0.6, col: '#ffffff', t0: n + 0.08 }); fx.add({ type: 'shock', x, y: y - 30, r0: 40, r1: ev.r, life: 0.5, color: H.col, width: 20 }); fx.sparks(x, y - 90, 0, fx.lite ? 14 : 40, H.col, 620, TAU); fx.shake(0.45); FLASH.t0 = n; FLASH.col = H.col; fx.banner('RELIC PULSE!', H.col, ev.n ? `${ev.n} enemies blasted` : '', 1.1, 40); } return true;
    case 'tshot': AIM.set(ev.i, { ang: Math.atan2(ev.y2 - ev.y, ev.x2 - ev.x), t0: n }); TR.push({ x: ev.x, y: ev.y, x2: ev.x2, y2: ev.y2, lv: ev.lv, t0: n }); if (TR.length > 40) TR.shift(); if (!fx.lite) fx.sparks(ev.x2, ev.y2, 0, 5, '#ffcf4a', 240, TAU); return true;
    case 'spike': if (has && !fx.lite) fx.sparks(x, y, -Math.PI / 2, 6, '#ffd0c8', 200, 2); return true;
    case 'ward': if (has && ev.n && !fx.lite) fx.ring(x, y, ev.r, '#7de8ff', 0.45, 4); return true;
    case 'siege': fx.banner(String(ev.name || 'SIEGE').toUpperCase(), '#ff3b6b', 'The siege marches on the relic: stop it!', 2.6, 48); if (has) { fx.ring(x, y, 260, '#ff3b6b', 0.8, 12); fx.puffs(x, y, 16, '#3a2a40', 20, 220, 0.8); } fx.shake(0.5); return true;
    case 'siegeWind': return true;
    case 'siegeSlam': if (has) { fx.add({ type: 'shock', x, y, r0: 40, r1: ev.r, life: 0.45, color: '#ffb08a', width: 22 }); fx.chunks && fx.chunks(x, y, fx.lite ? 6 : 14, '#8a7a6a', 320); fx.puffs(x, y, 12, '#c8b8a8', 20, 240, 0.7); } fx.shake(0.6); if (ev.off) fx.text(x, y - 140, `${ev.off} defense${ev.off > 1 ? 's' : ''} offline!`, { color: '#ff8a6a', size: 20 }); return true;
    case 'siegeBomb': if (ev.pts) for (const q of ev.pts) BOMBS.push({ x0: x, y0: y - 80, x: q.x, y: q.y, t0: n, dur: ev.t / 60 }); return true;
    case 'siegeRam': if (has) { fx.ring(x, y - 40, 180, '#ff5e5b', 0.5, 12); fx.sparks(x, y - 60, 0, 20, '#ffd0c8', 420, TAU); } fx.shake(0.7); fx.banner('THE RELIC IS RAMMED!', '#ff5e5b', '', 1, 32); return true;
    case 'siegePound': if (has) { fx.ring(x, y - 40, 120, '#ff5e5b', 0.3, 6); fx.puffs(ev.ex, ev.ey, 6, '#c8b8a8', 16, 160, 0.5); } fx.shake(0.25); return true;
    case 'queen': fx.banner(String(ev.name || 'THE SWARM QUEEN').toUpperCase(), '#ff6fd8', 'Break her eggs · dodge the acid · hug her or flee the Screech', 3, 50); if (has) { fx.ring(x, y, 360, '#ff6fd8', 1, 14); fx.sparks(x, y - 40, -Math.PI / 2, 40, '#ffc8f0', 520, 2.4); } fx.shake(0.6); return true;
    case 'queenEnrage': fx.banner('THE QUEEN IS ENRAGED!', '#ff3b6b', 'Faster attacks, more eggs', 1.6, 40); if (has) fx.ring(x, y, 220, '#ff3b6b', 0.7, 10); return true;
    case 'queenEggs': if (has) { fx.ring(x, y, 200, '#ff6fd8', 0.6, 8); fx.text(x, y - 120, 'EGGS! break them', { color: '#ffc8f0', size: 22 }); } return true;
    case 'queenAcid': if (has && !fx.lite) fx.sparks(x, y - 40, -Math.PI / 2, 12, '#c8ff6a', 360, 1.4); return true;
    case 'queenLand': if (has) { fx.puffs(x, y, 10, '#e0c8f0', 18, 200, 0.6); fx.ring(x, y, 120, '#ff6fd8', 0.35, 8); } fx.shake(0.3); return true;
    case 'queenScreechWind': fx.banner('SCREECH!', '#d04aff', 'Hug her or get out of the ring', 1.2, 40); return true;
    case 'queenScreech': if (has) { fx.add({ type: 'shock', x, y, r0: ev.r0, r1: ev.r, life: 0.5, color: '#d04aff', width: 26 }); fx.ring(x, y, ev.r, '#ffffff', 0.4, 6); } fx.shake(0.5); return true;
    case 'hatch': if (has) { fx.puffs(x, y - 20, 10, '#ffc8f0', 16, 200, 0.6); fx.text(x, y - 70, 'HATCHED!', { color: '#ff8a8a', size: 18 }); } return true;
    case 'wave': if (ev.k !== 'swarm' && ev.k !== 'defense') return false;
      if (ev.k === 'swarm') { fx.banner(`WAVE ${ev.w}/${OPS.swarm.waves}`, '#ff6fd8', ev.surge ? `${H.name} surge!` : `${ev.n} incoming`, 1.6, 46); return true; }
      fx.banner(ev.mod === 'siege' ? 'FINAL WAVE: SIEGE' : `WAVE ${ev.w}/${OPS.defense.waves}`, ev.mod ? (WAVE_MODS[ev.mod] || {}).col || '#ff9a4c' : '#ff9a4c', ev.mod && WAVE_MODS[ev.mod] ? `${WAVE_MODS[ev.mod].name}: ${WAVE_MODS[ev.mod].desc}` : `Round ${ev.r}`, 1.8, 46);
      for (const [px, py] of [[ev.x, ev.y], [ev.x2, ev.y2], [ev.x3, ev.y3]]) if (px != null) { fx.ring(px, py, 160, '#ff5e5b', 0.6, 8); fx.puffs(px, py, 10, '#3a2a40', 16, 200, 0.7); }
      return true;
    case 'waveClear': fx.banner(`WAVE ${ev.w} CLEARED`, '#7dffb0', ev.w >= OPS.swarm.waves ? 'The Queen is coming…' : '5 s breather', 1.4, 40); return true;
    case 'shrink': fx.banner('THE ARENA SHRINKS!', '#ffd23f', 'Get inside the ring: the corruption burns', 1.8, 42); return true;
    case 'combo': fx.banner(`COMBO x${ev.n}!`, ['#7dffb0', '#6ec8ff', '#ffcf4a', '#ff6fd8'][ev.t - 1] || '#ffffff', `LOOT x${ev.mul}`, 1.1, 40); if (has) fx.sparks(x, y, -Math.PI / 2, fx.lite ? 8 : 20, '#ffd23f', 360, 1.8); return true;
    case 'comboEnd': if (me) fx.text(me.x, me.y - 90, `combo x${ev.n} ended`, { color: '#d8d0e2', size: 18 }); return true;
    case 'wipe': fx.banner(ev.lives > 0 ? 'PARTY DOWN!' : 'OUT OF LIVES', '#ff5e5b', ev.lives > 0 ? `${ev.lives} li${ev.lives === 1 ? 'fe' : 'ves'} left` : '', 2, 46); return true;
    case 'storm': fx.banner(String(ev.name || H.storm).toUpperCase() + '!', H.col, 'Hazards strike twice as often', 1.8, 42); FLASH.t0 = n; FLASH.col = H.col; return true;
    case 'stormEnd': fx.banner(`${ev.name || H.storm} passes`, '#d8d0e2', '', 1, 30); return true;
    case 'hz': if (has) { if (ev.hz === 'lava' && ev.n === 0) { fx.sparks(x, y, -Math.PI / 2, fx.lite ? 8 : 20, '#ffb03a', 460, 1.2); fx.shake(0.12); } else if (ev.hz === 'blizzard') { fx.chunks && fx.chunks(x, y, fx.lite ? 4 : 10, '#dff6ff', 260); fx.ring(x, y, ev.r, '#ffffff', 0.3, 5); } else if (ev.hz === 'thorns') fx.ring(x, y, ev.r, '#9cff5a', 0.35, 6); else if (ev.hz === 'starfall') { fx.ring(x, y, ev.r, '#ffe27a', 0.35, 7); fx.sparks(x, y, -Math.PI / 2, fx.lite ? 6 : 16, '#c9a8ff', 380, 1); fx.shake(0.1); } else if (ev.n === 0) fx.puffs(x, y, 8, '#e8c27a', 16, 160, 0.6); } return true;
    case 'end': if (ev.gr && has) { const c = ev.gr.c || '#ffd23f'; fx.ring(x, y, 420, c, 1, 14); if (ev.gr.g === 'S') fx.sparks(x, y - 60, -Math.PI / 2, fx.lite ? 20 : 60, '#ffd23f', 560, 2.6); } return false; // (the base callout runs too)
  }
  return false;
}
function shade(hex, amt) { const n = parseInt(String(hex).slice(1), 16), f = (v) => Math.max(0, Math.min(255, v + amt)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
