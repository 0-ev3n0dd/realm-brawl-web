// Missions revamp, part 3 (2026-10-08): the client art of the new Capture (sim/opsrun3.js).
//  World: the hunting ground (route floor from missionfx2 + clearing rings, disturbed ground at every clue spot, net
//  crate pads, the rig daises), the live layer (the footprint trail to the next clue, the clue marker + its reading
//  ring, the biome snares (faint: look before you step), net crates, the real quarry's glowing footprints, the bolt line
//  to a rig, the Hunter's Ring), the escape rigs (Vine Rope / Sand Glider / Ice Sled / Smoke Balloon: drawn instead of
//  the enemy art), flying nets + the net over a pinned quarry. Telegraphs: 'osnare' 'oburn'. HUD: the tracker panel,
//  the top lines (clue reading, the pin meter + escape clock + nets, the capture fight bar), minimap layers, events.
//  Perf: `lite` (phone) halves the prints and drops glows / particles.
import { INK, circle, rrect } from './art.js';
import { drawText } from './textcache.js';
import { OPS, OPS_TYPE, OPS_BIOME, OPS_CAPTURE, capRoute } from '../sim/opsconst.js';
import { WEEKLY } from '../sim/opsmods.js';

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const nowS = () => (typeof performance !== 'undefined' ? performance.now() / 1000 : 0);
const hash = (i) => { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
function label(ctx, s, x, y, size, col, lw = 5) { drawText(ctx, s, x, y, `bold ${size}px "Lilita One", "Arial Black", sans-serif`, col, 'center', lw, INK, size); }
function shade(hex, amt) { const n = parseInt(String(hex).slice(1), 16), f = (v) => Math.max(0, Math.min(255, v + amt)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
const fmt = (ticks) => { const s = Math.max(0, Math.ceil(ticks / 60)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const T = OPS_TYPE.capture;
/** per biome: snare colours [body, glow], print colour */
const SN_COL = { wilds: ['#7a5a3a', '#b9f08a'], dunes: ['#c8913e', '#ffe39a'], frost: ['#6fc8ff', '#ffffff'], ember: ['#3a2622', '#ff8a2a'], rift: ['#2a1e4a', '#b48cff'] };
let BIOME = 'wilds';

// ------------------------------------------------------------------ cached floor marks (opsfx floorArt)
export function captureMarks(g, A) {
  const B = OPS_BIOME[A.biome];
  // clearing rings (hunting-ground markers) + trail chevrons
  g.globalAlpha = 0.28; g.strokeStyle = shade(B.wall, 20); g.lineWidth = 10; g.setLineDash([34, 26]);
  for (const C of A.clear) { g.beginPath(); g.arc(C.x, C.y, C.r - 60, 0, TAU); g.stroke(); }
  g.setLineDash([]);
  // disturbed ground at every clue spot (only 3 hold a real clue each run)
  for (const S of A.clueAt) { g.globalAlpha = 0.35; g.fillStyle = shade(B.floor[0], -40); g.beginPath(); g.ellipse(S.x, S.y, 70, 40, 0.3, 0, TAU); g.fill(); g.globalAlpha = 0.5; g.strokeStyle = shade(B.floor[0], -70); g.lineWidth = 3; for (let i = 0; i < 5; i++) { const a = i * 1.3; g.beginPath(); g.moveTo(S.x + Math.cos(a) * 20, S.y + Math.sin(a) * 12); g.lineTo(S.x + Math.cos(a) * 52, S.y + Math.sin(a) * 30); g.stroke(); } }
  // net crate pads
  for (const N of A.netAt) { g.globalAlpha = 0.6; g.fillStyle = shade(B.wall, 30); g.beginPath(); g.ellipse(N.x, N.y, 54, 30, 0, 0, TAU); g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); g.globalAlpha = 0.5; g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.setLineDash([8, 6]); g.beginPath(); g.ellipse(N.x, N.y, 44, 22, 0, 0, TAU); g.stroke(); g.setLineDash([]); }
  // the rig daises
  for (const X of A.exits) { g.globalAlpha = 0.9; g.fillStyle = shade(B.wall, 25); g.beginPath(); g.ellipse(X.x, X.y + 6, 84, 44, 0, 0, TAU); g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke(); g.globalAlpha = 0.45; g.strokeStyle = T.col; g.lineWidth = 4; g.beginPath(); g.ellipse(X.x, X.y + 6, 70, 34, 0, 0, TAU); g.stroke(); }
  // the camp (start)
  const S0 = A.clear[0]; g.globalAlpha = 0.4; g.strokeStyle = T.col; g.lineWidth = 8; g.beginPath(); g.arc(S0.x, S0.y + 120, 120, 0, TAU); g.stroke();
  g.globalAlpha = 1;
}

// ------------------------------------------------------------------ live layer (under the characters)
function trailPts(A, V) {
  const ci = V.ci | 0; if (!V.cl || ci >= 3) return null;
  const from = ci === 0 ? 0 : V.cl[ci - 1], to = V.cl[ci], R = capRoute(from, to);
  const pts = [ci === 0 ? { x: A.start.x, y: A.start.y } : A.clueAt[from]];
  for (const c of R.slice(1, -1)) pts.push({ x: A.clear[c].x, y: A.clear[c].y });
  if (R.length > 1 || ci === 0) pts.push({ x: A.clear[to].x, y: A.clear[to].y });
  pts.push(A.clueAt[to]);
  return pts;
}
function paw(ctx, x, y, a, s, col, alpha) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2); ctx.globalAlpha = alpha; ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0, 3 * s, 6 * s, 8 * s, 0, 0, TAU); ctx.fill();
  for (const [dx, dy] of [[-6, -7], [0, -10], [6, -7]]) { ctx.beginPath(); ctx.arc(dx * s, dy * s, 2.6 * s, 0, TAU); ctx.fill(); }
  ctx.restore();
}
export function drawCaptureUnder(ctx, A, V, t, lite, sim, local) {
  BIOME = A.biome;
  const N = OPS_CAPTURE[A.biome], B = OPS_BIOME[A.biome], sc = SN_COL[A.biome];
  // net crates
  A.netAt.forEach((q, i) => {
    const on = V.cr ? V.cr[i] : 1;
    if (!on) { ctx.save(); ctx.globalAlpha = 0.35; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(q.x, q.y - 6, 26, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.restore(); return; }
    const bob = Math.sin(t * 3 + i) * 2;
    rrect(ctx, q.x - 24, q.y - 34 + bob, 48, 34, 5); ctx.fillStyle = '#a2723e'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = '#5a3c22'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(q.x - 24, q.y - 17 + bob); ctx.lineTo(q.x + 24, q.y - 17 + bob); ctx.stroke();
    ctx.strokeStyle = '#f2ead8'; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.9; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(q.x + k * 9, q.y - 46 + bob); ctx.lineTo(q.x + k * 9 + 6, q.y - 30 + bob); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(q.x - 22, q.y - 40 + bob); ctx.quadraticCurveTo(q.x, q.y - 52 + bob, q.x + 22, q.y - 40 + bob); ctx.stroke(); ctx.globalAlpha = 1;
    if (local && Math.hypot(local.x - q.x, local.y - q.y) < 260) label(ctx, 'NET', q.x, q.y - 56 + bob, 12, '#f2ead8', 3);
  });
  // the trail to the next clue (track)
  if (V.ph === 'track') {
    const pts = trailPts(A, V);
    if (pts) {
      const step = lite ? 70 : 46, col = shade(B.floor[0], -95); let s = 0, n = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.y - a.y), an = Math.atan2(b.y - a.y, b.x - a.x), nx = -Math.sin(an), ny = Math.cos(an);
        for (let d = (step - (s % step)) % step; d < L; d += step) {
          const x = a.x + Math.cos(an) * d, y = a.y + Math.sin(an) * d, side = n % 2 ? 1 : -1, px = x + nx * side * 12, py = y + ny * side * 12;
          n++;
          if (local && Math.abs(px - local.x) > 1300) continue;
          const near = local ? clamp01(1 - (Math.hypot(px - local.x, py - local.y) - 500) / 900) : 1;
          const wave = 0.5 + 0.5 * Math.sin((s + d) * 0.012 - t * 5);
          paw(ctx, px, py, an, 1.25, col, (0.35 + 0.35 * wave) * near);
        }
        s += L;
      }
    }
  }
  // clues
  if (V.cl) V.cl.forEach((ci, k) => {
    const S = A.clueAt[ci];
    if (k < (V.ci | 0)) { circle(ctx, S.x, S.y - 4, 16, '#7dffb0', 3); label(ctx, '✓', S.x, S.y + 2, 16, '#ffffff', 3); return; }
    if (k !== (V.ci | 0) || V.ph !== 'track') return;
    const f = clamp01(V.ex || 0), pul = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.save(); ctx.globalAlpha = 0.18 + 0.12 * pul; circle(ctx, S.x, S.y, OPS.capture.clueR, T.col, 0); ctx.globalAlpha = 0.9; ctx.setLineDash([12, 9]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(S.x, S.y, OPS.capture.clueR, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = T.col; ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    if (f > 0) { ctx.beginPath(); ctx.arc(S.x, S.y, OPS.capture.clueR + 10, -Math.PI / 2, -Math.PI / 2 + f * TAU); ctx.lineWidth = 9; ctx.strokeStyle = '#ffffff'; ctx.stroke(); }
    // the clue object itself: a little bundle with a "?" over it
    rrect(ctx, S.x - 16, S.y - 18, 32, 20, 6); ctx.fillStyle = '#d8c39a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    const qy = S.y - 52 + Math.sin(t * 3) * 5; circle(ctx, S.x, qy, 16, T.col, 3); label(ctx, '?', S.x, qy + 6, 20, '#ffffff', 3);
    label(ctx, f > 0 ? 'READING…' : `CLUE ${k + 1}`, S.x, S.y + OPS.capture.clueR - 18, 14, '#ead8ff', 4);
  });
  // snares (faint: look before you step)
  for (const s of V.sn || []) {
    if (local && (Math.abs(s[0] - local.x) > 1100 || Math.abs(s[1] - local.y) > 800)) continue;
    const armed = s[2], a = (armed ? 0.5 : 0.25) + 0.18 * Math.sin(t * 4 + s[0] * 0.01);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(s[0], s[1]);
    if (A.biome === 'wilds') { ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.fillStyle = sc[0]; ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#d8d0c0'; for (let i = 0; i < 8; i++) { const an = i * TAU / 8; ctx.beginPath(); ctx.moveTo(Math.cos(an) * 18, Math.sin(an) * 18); ctx.lineTo(Math.cos(an + 0.2) * 26, Math.sin(an + 0.2) * 26); ctx.lineTo(Math.cos(an + 0.4) * 18, Math.sin(an + 0.4) * 18); ctx.fill(); } }
    else if (A.biome === 'dunes') { ctx.lineWidth = 3; ctx.strokeStyle = sc[0]; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 8 + i * 8, t * 2 + i, t * 2 + i + 4); ctx.stroke(); } }
    else if (A.biome === 'frost') { ctx.fillStyle = sc[0]; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(12, 0); ctx.lineTo(0, 16); ctx.lineTo(-12, 0); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.stroke(); }
    else { ctx.fillStyle = sc[0]; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = sc[1]; ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(t * 9)); ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // the real quarry's glowing footprints (decoys leave none)
  const pr = V.pr || [];
  for (let i = 0; i < pr.length; i += lite ? 2 : 1) { const q = pr[i], age = clamp01(1 - q[3] / (OPS.capture.prints * OPS.capture.printEvery * (V.ph === 'fight' ? 2 : 1))); if (age <= 0) continue; if (!lite) { ctx.save(); ctx.globalAlpha = 0.25 * age; circle(ctx, q[0], q[1], 16, T.glow, 0); ctx.restore(); } paw(ctx, q[0] + (i % 2 ? 8 : -8) * Math.cos(q[2] + Math.PI / 2), q[1] + (i % 2 ? 8 : -8) * Math.sin(q[2] + Math.PI / 2), q[2], 1.35, T.col, 0.85 * age); }
  // the bolt: a line to the rig it is running for
  if (V.bolt >= 0 && V.tx) { const X = A.exits[V.bolt]; ctx.save(); ctx.setLineDash([22, 14]); ctx.lineDashOffset = -t * 90; ctx.globalAlpha = 0.85; ctx.lineWidth = 7; ctx.strokeStyle = '#ff5e5b'; ctx.beginPath(); ctx.moveTo(V.tx, V.ty); ctx.lineTo(X.x, X.y); ctx.stroke(); ctx.restore(); label(ctx, 'ESCAPE!', X.x, X.y - 120, 20, '#ff5e5b', 5); }
  // the Hunter's Ring
  if (V.ring) {
    const [rx, ry, rr] = V.ring;
    ctx.save(); if (!lite) { ctx.globalAlpha = 0.12; circle(ctx, rx, ry, rr, T.col, 0); }
    ctx.globalAlpha = 0.9; ctx.lineWidth = 9; ctx.strokeStyle = '#8a6a3a'; ctx.beginPath(); ctx.arc(rx, ry, rr, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = T.col; ctx.setLineDash([16, 10]); ctx.lineDashOffset = t * 30; ctx.beginPath(); ctx.arc(rx, ry, rr - 10, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 16; i++) { const an = i * TAU / 16; rrect(ctx, rx + Math.cos(an) * rr - 5, ry + Math.sin(an) * rr - 26, 10, 30, 3); ctx.fillStyle = '#6a5236'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); }
    ctx.restore();
  }
}
/** an escape rig (drawn instead of the enemy art) */
export function drawRig(ctx, e, t, biome) {
  const k = clamp01(e.hp / Math.max(1, e.maxHp)), x = e.x, y = e.y, fl = e.flash > 0;
  ctx.save(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.ellipse(x, y + 6, 54, 18, 0, 0, TAU); ctx.fillStyle = 'rgba(20,12,24,.4)'; ctx.fill();
  if (biome === 'dunes') { // Sand Glider: a sail on a frame
    ctx.fillStyle = '#8a6a3a'; rrect(ctx, x - 40, y - 14, 80, 12, 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 4, y - 14); ctx.lineTo(x - 4, y - 120); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 2, y - 118); ctx.quadraticCurveTo(x + 50 + Math.sin(t * 3) * 6, y - 80, x - 2, y - 24); ctx.closePath(); ctx.fillStyle = fl ? '#ffffff' : '#ffe39a'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c84a3a'; ctx.fillRect(x + 4, y - 80, 24, 6);
  } else if (biome === 'frost') { // Ice Sled
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 48, y); ctx.lineTo(x + 40, y); ctx.quadraticCurveTo(x + 56, y, x + 52, y - 16); ctx.stroke();
    ctx.lineWidth = 3.5; rrect(ctx, x - 40, y - 34, 76, 24, 6); ctx.fillStyle = fl ? '#ffffff' : '#7fa8d0'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 10, y - 34); ctx.lineTo(x - 10, y - 110); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 8, y - 108); ctx.lineTo(x + 34 + Math.sin(t * 2.5) * 4, y - 60); ctx.lineTo(x - 8, y - 40); ctx.closePath(); ctx.fillStyle = '#e6f6ff'; ctx.fill(); ctx.stroke();
  } else if (biome === 'ember') { // Smoke Balloon
    const by = y - 120 + Math.sin(t * 1.6) * 6;
    ctx.beginPath(); ctx.moveTo(x - 22, by + 36); ctx.lineTo(x - 16, y - 26); ctx.moveTo(x + 22, by + 36); ctx.lineTo(x + 16, y - 26); ctx.stroke();
    rrect(ctx, x - 20, y - 28, 40, 26, 5); ctx.fillStyle = '#7a5a3a'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, by, 42, 50, 0, 0, TAU); ctx.fillStyle = fl ? '#ffffff' : '#c84a2a'; ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffb03a'; ctx.beginPath(); ctx.ellipse(x - 12, by - 10, 10, 26, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(80,70,70,.45)'; for (let i = 0; i < 3; i++) { const ph = (t * 0.6 + i / 3) % 1; ctx.beginPath(); ctx.arc(x + Math.sin(i + t) * 8, y - 30 - ph * 40, 6 + ph * 10, 0, TAU); ctx.fill(); }
  } else { // Vine Rope: a post with a coiled grapple rope
    rrect(ctx, x - 8, y - 110, 16, 112, 4); ctx.fillStyle = '#6a5236'; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = fl ? '#ffffff' : '#5aa543'; ctx.lineWidth = 6; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x, y - 30 - i * 16, 22, 8, 0, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 110); ctx.quadraticCurveTo(x + 40, y - 150 + Math.sin(t * 2) * 6, x + 70, y - 170); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 70, y - 170); ctx.lineTo(x + 82, y - 180); ctx.moveTo(x + 70, y - 170); ctx.lineTo(x + 80, y - 160); ctx.stroke();
  }
  ctx.restore();
  const bw = 90; rrect(ctx, x - bw / 2 - 2, y - 196, bw + 4, 12, 5); ctx.fillStyle = INK; ctx.fill(); rrect(ctx, x - bw / 2, y - 194, bw * k, 8, 4); ctx.fillStyle = '#ff5e5b'; ctx.fill();
  label(ctx, String(e.name || 'RIG').toUpperCase(), x, y - 206, 12, '#ffd0c8', 3);
}

// ------------------------------------------------------------------ telegraphs (missionfx.drawOpsArea delegates)
const k01 = (a) => Math.min(1, (a.t || 0) / Math.max(1, a.delay || 1));
export function drawOpsArea3(ctx, a, t, lite) {
  const kd = a.kind;
  if (kd === 'osnare') { // a snare springing (or the quarry's Snare Toss)
    const k = k01(a), [c1, c2] = SN_COL[BIOME] || SN_COL.wilds;
    if (a.t >= a.delay) return true;
    ctx.save(); ctx.globalAlpha = 0.2 + 0.3 * k; circle(ctx, a.x, a.y, a.r, c1, 0); ctx.globalAlpha = 0.95; ctx.lineWidth = 4; ctx.strokeStyle = c2; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r * (1 - 0.85 * k) + 4, 0, TAU); ctx.stroke();
    if (!lite) { ctx.fillStyle = c2; for (let i = 0; i < 8; i++) { const an = i * TAU / 8 + a.id, rr = a.r * 0.75; ctx.beginPath(); ctx.moveTo(a.x + Math.cos(an) * rr, a.y + Math.sin(an) * rr); ctx.lineTo(a.x + Math.cos(an) * (rr - 18 * k), a.y + Math.sin(an) * (rr - 18 * k)); ctx.lineWidth = 3; ctx.strokeStyle = c2; ctx.stroke(); } }
    ctx.restore(); return true;
  }
  if (kd === 'oburn') { // cinders smouldering on the floor
    if (a.t < a.delay - 4) return true;
    const life = a.delay + (a.pulses - 1) * a.every, f = clamp01((life + 10 - a.t) / 14);
    ctx.save(); ctx.globalAlpha = 0.45 * f; circle(ctx, a.x, a.y, a.r, '#ff6a1a', 0); ctx.globalAlpha = 0.9 * f; ctx.lineWidth = 3; ctx.strokeStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke();
    if (!lite) for (let i = 0; i < 6; i++) { const ph = (t * 1.4 + i / 6) % 1; ctx.globalAlpha = f * (1 - ph); circle(ctx, a.x + Math.cos(i * 2.1) * a.r * 0.5, a.y + Math.sin(i * 2.1) * a.r * 0.35 - ph * 30, 4, '#ffd23f', 0); }
    ctx.restore(); return true;
  }
  return false;
}

// ------------------------------------------------------------------ over the characters: flying nets, the net on a pinned quarry
const NETS = [];
export function drawMission3Over(ctx, A, V, sim, t, lite) {
  if (!A || A.type !== 'capture') { NETS.length = 0; return; }
  const n = nowS(); while (NETS.length && n - NETS[0].t0 > 0.45) NETS.shift();
  for (const q of NETS) { const k = clamp01((n - q.t0) / 0.3); const x = q.x + (q.x2 - q.x) * k, y = q.y - 40 + (q.y2 - 40 - (q.y - 40)) * k - Math.sin(Math.PI * k) * 90; netMesh(ctx, x, y, 18 + 26 * k, t, 1 - Math.max(0, (n - q.t0 - 0.3) / 0.15)); }
  if (V && V.nt > 0 && V.tid) {
    const e = sim.enemyById ? sim.enemyById.get(V.tid) : (sim.enemies || []).find((m) => m.id === V.tid);
    const x = e ? e.x : V.tx, y = e ? e.y : V.ty;
    netMesh(ctx, x, y - 30, 56, t, 0.9);
    label(ctx, `NETTED ${(V.nt / 60).toFixed(1)} s`, x, y - 110, 15, '#f2ead8', 4);
  }
  void lite;
}
function netMesh(ctx, x, y, r, t, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.lineWidth = 2.2; ctx.strokeStyle = '#f2ead8';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  for (let i = -3; i <= 3; i++) { const d = i * r / 3.5, h = Math.sqrt(Math.max(0, r * r - d * d)); ctx.beginPath(); ctx.moveTo(d, -h); ctx.lineTo(d, h); ctx.moveTo(-h, d); ctx.lineTo(h, d); ctx.stroke(); }
  ctx.fillStyle = '#c8a46a'; for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + t; ctx.beginPath(); ctx.arc(Math.cos(an) * r, Math.sin(an) * r, 3.5, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ------------------------------------------------------------------ HUD
const TRACK_W = 250;
function dot(ctx, x, y, on, cur, col) { circle(ctx, x, y, cur ? 8 : 6, on ? '#7dffb0' : cur ? col : 'rgba(255,255,255,.18)', 2.5); }
const myNets = (V, p) => { const r = (V.nets || []).find((q) => q[0] === p.id); return r ? r[1] : 0; };
/** the left objective panel */
export function drawTracker3(ctx, A, V, p, w, h, txt, bar, t, keyLabel) {
  if (!V || V.st === 'intro' || V.st === 'results') return;
  const x = 14, N = OPS_CAPTURE[A.biome], lines = [], ph = V.ph || 'track';
  let y = Math.min(h * 0.28, 196);
  if (ph === 'track') { lines.push([`Track the ${N.quarry[1]}: clue ${Math.min(3, (V.ci | 0) + 1)}/3`, '#ffffff'], ['Follow the footprints · stand by the clue', '#d8d0e2']); }
  else if (ph === 'chase') {
    lines.push([V.bolt >= 0 ? `BOLTING for the ${N.rig}!` : `Pin it: ${V.pin | 0}% · escapes in ${fmt(V.esc)}`, V.bolt >= 0 ? '#ff8a8a' : '#ffffff']);
    lines.push([`${N.rig}s: ${(V.rg || []).filter((v) => v > 0).length}/3 intact · nets ${myNets(V, p)}`, '#ead8ff']);
    lines.push(['Only the real one leaves glowing prints', '#d8d0e2']);
  } else lines.push([`Capture the ${N.quarry[1]}`, '#ffb0c8'], ['It can’t leave the Hunter’s Ring', '#d8d0e2']);
  if (V.sh) lines.push([`${N.snare}s sprung: ${V.sh}`, '#ffb08a']);
  const rowH = 19, panelH = 66 + lines.length * rowH + 4;
  ctx.save(); rrect(ctx, x, y, TRACK_W, panelH, 12); ctx.fillStyle = 'rgba(28,20,40,.72)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = T.col; ctx.fillRect(x + 3, y + 3, 5, panelH - 6); ctx.restore();
  txt(ctx, 'OBJECTIVE', x + 18, y + 20, 15, T.col, 'left', 3);
  if (V.mods && V.mods.length) txt(ctx, V.mods.map((k) => (WEEKLY[k] ? WEEKLY[k].name : k)).join(' · '), x + TRACK_W - 10, y + 19, 11, '#ffe7a0', 'right', 3);
  const cur = ph === 'track' ? 0 : ph === 'chase' ? 1 : 2;
  for (let i = 0; i < 3; i++) { const dx = x + 26 + i * 30; if (i) { ctx.fillStyle = i <= cur ? '#7dffb0' : 'rgba(255,255,255,.18)'; ctx.fillRect(dx - 22, y + 37, 14, 3); } dot(ctx, dx, y + 38, i < cur, i === cur, T.col); }
  txt(ctx, ['TRACK', 'CHASE', 'CAPTURE'][cur], x + TRACK_W - 12, y + 43, 12.5, '#ffffff', 'right', 3);
  let yy = y + 64;
  for (const [s, c] of lines) { txt(ctx, s, x + 18, yy, 13.5, c, 'left', 3); yy += rowH; }
}
/** the top-centre lines; returns { y, obj } */
export function hud3(ctx, A, V, p, w, y, txt, bar, t, keyLabel) {
  const cx = w / 2, bw = Math.min(560, w * 0.5), bx = cx - bw / 2, N = OPS_CAPTURE[A.biome], ph = V.ph || 'track';
  if (ph === 'track') {
    const ci = Math.min(2, V.ci | 0), S = A.clueAt[V.cl ? V.cl[ci] : 0];
    txt(ctx, `TRACK THE ${N.quarry[1].toUpperCase()} · CLUE ${ci + 1}/3`, cx, y + 22, 18, '#ead8ff', 'center', 4);
    if ((V.ex || 0) > 0) bar(ctx, bx + bw * 0.2, y + 32, bw * 0.6, 12, clamp01(V.ex), T.col, 'READING THE CLUE');
    else txt(ctx, ci === 2 ? 'The last clue leads to its lair: get ready to chase' : 'Follow the footprints to the next clue', cx, y + 42, 13.5, '#ffffff', 'center', 3);
    return { y: y + 52, obj: S };
  }
  if (ph === 'chase') {
    const nets = myNets(V, p), danger = V.bolt >= 0 || V.esc < 20 * 60;
    bar(ctx, bx, y + 6, bw, 16, V.thp || 0, T.col, (V.tn || 'QUARRY').toUpperCase());
    bar(ctx, bx + bw * 0.12, y + 26, bw * 0.76, 12, clamp01((V.pin || 0) / 100), '#ffd23f', `PIN ${V.pin | 0}%`);
    const line = V.bolt >= 0 ? `BOLTING FOR THE ${N.rig.toUpperCase()}! Net it or break the rig` : V.nt > 0 ? `NETTED! The clock is paused · ${(V.nt / 60).toFixed(1)} s` : `escapes in ${fmt(V.esc)} · nets: ${nets}${nets ? ` · ${keyLabel('interact')} in reach to throw` : ' · grab one from a crate'}`;
    txt(ctx, line, cx, y + 58, 14, danger ? (Math.sin(t * 10) > 0 ? '#ff5e5b' : '#ffffff') : V.nt > 0 ? '#ffd23f' : '#ffffff', 'center', 3);
    const pr = V.pr || [], last = pr[pr.length - 1];
    return { y: y + 66, obj: V.bolt >= 0 ? A.exits[V.bolt] : last ? { x: last[0], y: last[1] } : null };
  }
  bar(ctx, bx, y + 6, bw, 20, V.bhp || 0, '#ff6fd8', `CAPTURE ${String(V.bn || N.quarry[1]).toUpperCase()}`);
  txt(ctx, 'Pounce slash · snare toss · bola fan · caltrop ring · smoke swap: find the real one', cx, y + 46, 13.5, '#ffffff', 'center', 3);
  return { y: y + 54, obj: V.ring ? { x: V.ring[0], y: V.ring[1] } : null };
}
/** minimap layers */
export function minimap3(ctx, A, V, X, Y, k, sim) {
  if (!V) return;
  if (V.ph === 'track' && V.cl) { const S = A.clueAt[V.cl[Math.min(2, V.ci | 0)]]; circle(ctx, X(S.x), Y(S.y), 6, T.col, 2, '#ffffff'); label(ctx, '?', X(S.x), Y(S.y) + 4, 10, '#ffffff', 2); }
  A.netAt.forEach((q, i) => { if (V.cr && V.cr[i]) { ctx.fillStyle = '#f2ead8'; ctx.fillRect(X(q.x) - 2, Y(q.y) - 2, 4, 4); } });
  A.exits.forEach((Xx, i) => { const up = V.rg ? V.rg[i] > 0 : true; ctx.save(); ctx.translate(X(Xx.x), Y(Xx.y)); ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fillStyle = up ? (V.bolt === i ? '#ffffff' : '#ff5e5b') : '#5a5262'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); });
  if (V.ring) { ctx.beginPath(); ctx.arc(X(V.ring[0]), Y(V.ring[1]), V.ring[2] * k, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = '#ff6fd8'; ctx.stroke(); }
  const ids = new Set(V.qd || []);
  if (ids.size) for (const e of sim.enemies || []) { if (e.dead || !ids.has(e.id)) continue; circle(ctx, X(e.x), Y(e.y), 4.5, T.col, 1.5, '#ffffff'); }
}

// ------------------------------------------------------------------ events
export function missionEventFx3(fx, ev, me) {
  if (ev.ph === 'trophy') { if (ev.x != null) { fx.text(ev.x, ev.y - 70, 'TROPHY!', { color: '#ffd23f', size: 20 }); fx.sparks(ev.x, ev.y - 30, -Math.PI / 2, fx.lite ? 6 : 16, '#ffd23f', 360, 1.4); fx.ring(ev.x, ev.y, 110, '#ffd23f', 0.5, 7); } return true; }
  if (ev.k !== 'capture') return false;
  const x = ev.x, y = ev.y, has = x != null, b = ev.b || 'wilds', N = OPS_CAPTURE[b], lite = !!fx.lite, sc = SN_COL[b];
  switch (ev.ph) {
    case 'go': return true;
    case 'track': fx.banner(`HUNT: ${String(ev.name || N.quarry[1]).toUpperCase()}`, T.col, 'Follow the footprints to its first clue', 2.6, 46); return true;
    case 'clue': fx.banner(`CLUE ${ev.i}/3: ${String(ev.name || '').toUpperCase()}`, '#ead8ff', ev.last ? 'Its lair! It’s breaking cover…' : 'The trail goes on: follow the new footprints', 2, 40); if (has) { fx.ring(x, y, 160, T.col, 0.6, 8); fx.sparks(x, y - 30, -Math.PI / 2, lite ? 6 : 16, '#ead8ff', 300, 1.6); } return true;
    case 'flush': fx.banner(`${String(ev.name || N.quarry[1]).toUpperCase()} BREAKS COVER!`, '#ff6fd8', `Pin it before it escapes (${Math.round((ev.t || 0) / 60)} s): nets, break its ${N.rig}s, hit it`, 3, 46); if (has) { fx.ring(x, y, 260, T.col, 0.8, 12); fx.puffs(x, y, lite ? 6 : 16, '#5a4a60', 20, 240, 0.8); } fx.shake(0.4); return true;
    case 'blink': if (has) { fx.puffs(x, y, lite ? 4 : 10, '#8a7a96', 16, 180, 0.5); fx.ring(ev.x2, ev.y2, 80, T.col, 0.35, 5); } return true;
    case 'snare': if (has) fx.text(x, y - 50, `${N.snare.toUpperCase()}!`, { color: sc[1], size: 18 }); return true;
    case 'snareHit': if (has) { fx.ring(x, y, OPS.capture.snareR, sc[1], 0.4, 7); if (!lite) fx.sparks(x, y, -Math.PI / 2, 10, sc[1], 260, TAU); } return true;
    case 'netGet': if (me && ev.pid === me.id) fx.text(me.x, me.y - 90, `+1 NET (${ev.n})`, { color: '#f2ead8', size: 17 }); return true;
    case 'net': NETS.push({ x: ev.x, y: ev.y, x2: ev.x2, y2: ev.y2, t0: nowS() }); if (ev.real) { fx.text(ev.x2, ev.y2 - 100, 'NETTED! +30 PIN', { color: '#ffd23f', size: 22 }); fx.ring(ev.x2, ev.y2, 90, '#f2ead8', 0.5, 6); } return true;
    case 'decoys': if (has) { fx.puffs(x, y, lite ? 8 : 22, '#6a5a76', 26, 260, 1); fx.ring(x, y, 180, T.col, 0.5, 8); } fx.banner(ev.fight ? 'SMOKE!' : 'DECOYS!', T.col, 'Only the real one leaves glowing footprints', 1.6, 40); return true;
    case 'decoyPop': case 'decoyGone': if (has) { fx.puffs(x, y, lite ? 5 : 12, '#9a8aa6', 18, 200, 0.6); fx.text(x, y - 60, ev.ph === 'decoyPop' ? 'DECOY!' : 'poof', { color: '#ead8ff', size: ev.ph === 'decoyPop' ? 18 : 13 }); } return true;
    case 'guards': if (has) fx.ring(x, y, 180, '#ff5e5b', 0.5, 7); fx.banner('IT CALLS ITS GUARDS', '#ff8a8a', '', 1, 30); return true;
    case 'rigDown': fx.banner(`${String(ev.name || N.rig).toUpperCase()} WRECKED!`, '#ffd23f', `${ev.left ? `${ev.left} escape route${ev.left === 1 ? '' : 's'} left` : 'No way out left for it'}${ev.bonus ? ` · +${ev.bonus} s · +20 pin` : ' · +20 pin'}`, 1.8, 42); if (has) { fx.ring(x, y - 40, 200, '#ffd23f', 0.6, 10); fx.chunks && fx.chunks(x, y - 40, lite ? 6 : 14, '#8a6a3a', 320); } fx.shake(0.35); return true;
    case 'bolt': fx.banner(`IT’S BOLTING FOR THE ${String(ev.name || N.rig).toUpperCase()}!`, '#ff5e5b', 'Net it, stun it, or wreck the rig first', 2.4, 46); fx.shake(0.3); return true;
    case 'noEscape': fx.banner('NOWHERE TO RUN!', '#7dffb0', 'Every rig is wrecked', 1.6, 40); return true;
    case 'cornered': fx.banner('CORNERED!', '#ff6fd8', `The Hunter’s Ring closes${ev.left ? ` · ${ev.left} s to spare` : ''}: capture it!`, 2.6, 52); if (ev.x2 != null) { fx.ring(ev.x2, ev.y2, ev.r || 470, '#ff6fd8', 1, 14); fx.puffs(ev.x2, ev.y2, lite ? 8 : 18, '#6a5a76', 22, 260, 0.9); } fx.shake(0.6); return true;
    case 'smoke': if (has) fx.puffs(x, y, lite ? 8 : 20, '#6a5a76', 24, 220, 0.9); return true;
    case 'smokeSwap': for (const [px, py] of ev.pts || []) { fx.puffs(px, py, lite ? 5 : 12, '#6a5a76', 22, 220, 0.8); fx.ring(px, py, 90, T.col, 0.4, 6); } return true;
    case 'adds': if (has) fx.ring(x, y, 260, T.col, 0.6, 8); fx.banner('GUARDS!', '#ff8a8a', 'It whistles for help', 1, 32); fx.shake(0.3); return true;
    case 'bossWind': return true;
  }
  return false;
}
export { TRACK_W };
