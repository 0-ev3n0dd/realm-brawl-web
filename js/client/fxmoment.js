// "Signature moments": the cinematic layer for three boss finishers (Dragoon - Nidhogg's Fall, Monk - Heaven-Splitting Palm,
// Grimoire Summoner - The Final Chapter). Everything here is presentation only (the sim is untouched) and is driven by the real
// finisher events, so it stays in step with the real timings and the real slow-motion.
//
// Three kinds of pieces, all stored in fx.cine (so they follow real time and are cleared with the rest):
//   MOM_CINE   world space, drawn over the actors (the falling dragon, the giant palm, the open grimoire, the carved 天).
//   MOM_UNDER  world space, under the actors (ground shock rings).
//   SCR        screen space: letterbox bars, vignette, speed lines, flash, the ink-brushed kanji, the title band, the sound-effect
//              stamp. Drawn by drawMomentScreen() in two layers (0: under the HUD, 1: over it).
// momentSplitPost() is the one post-process: it cuts the rendered frame in two along the boss and slides the halves apart.
import { bloom, ease } from './fxglow.js';
import { drawDragon } from './fxdragoon.js';
import { drawBook } from './fxarcana.js';
import { FIN, FIN_KEEP, FIN_LIFE } from './fxfinish.js';
import { vfxPref } from './fxns.js'; // Reduce screen flashes / Ult cinematics options

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lite = (fx) => fx.partMul !== undefined && fx.partMul < 1;
const HEAD = "'Lilita One','Impact',sans-serif";
const KANJI = (s) => `900 ${s | 0}px "Noto Serif JP","Yu Mincho","Hiragino Mincho ProN","Noto Serif CJK JP","MS Mincho","Songti SC",serif`;
const KANA = (s) => `900 ${s | 0}px "Noto Sans JP","Yu Gothic","Hiragino Sans","Noto Sans CJK JP","Meiryo",sans-serif`;
const seeded = (seed) => { let s = (seed * 9301 + 49297) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

export const MOM = {
  drg: { a: '#ff3048', b: '#ffb347', hi: '#fff1e0', deep: '#2a0410', ink: '#12020a', edge: '#ff7a8a' },
  monk: { a: '#ffd23f', b: '#ff9a2c', hi: '#fff6d8', deep: '#2a1600', ink: '#140a00', edge: '#fff0b0' },
  sum: { a: '#3ff0c8', b: '#ffd86a', hi: '#e6fff8', deep: '#06222a', ink: '#04141a', edge: '#b9fff0' },
};

// ------------------------------------------------------------------ public helpers (called from the class FX files)
const push = (fx, o) => { const c = { t: 0, ...o }; fx.cine.push(c); return c; };
const find = (fx, kind, pid) => fx.cine.find((c) => c.kind === kind && (pid === undefined || c.pid === pid));
function endScene(fx, pid, after) {
  for (const c of fx.cine) if ((c.kind === 'dark' || c.kind === 'scrBars' || c.kind === 'scrVig') && c.pid === pid) c.life = Math.min(c.life, c.t + after);
}
const flashMe = (fx, me, col, a) => { if (me) { fx.flash = Math.max(fx.flash || 0, vfxPref.reduceFlash ? Math.min(a, FLASH_CAP) : a); fx.flashColor = col; } };
const kick = (fx, ev, k) => { if (ev && ev.pid !== undefined && fx.localPid != null && ev.pid !== fx.localPid) return; fx.zoomK = Math.min(0.3, Math.max(fx.zoomK || 0, k)); }; // (co-op: only your own finisher punches your camera) // camera punch: render.js multiplies the zoom by (1 + fx.zoomK), fx.update decays it
/** Pixel-art sparks (the 2D-sprite look inside the HD lighting): square, grid-snapped, hot white fading to the colour then to dark. */
function pixBurst(fx, x, y, n, cols, spd, o = {}) {
  const { up = 0.4, g = 520, life = [0.7, 1.5], size = [3, 7], spread = Math.PI * 2, base = -Math.PI / 2 } = o;
  const p = [];
  for (let i = 0; i < (lite(fx) ? n * 0.5 : n); i++) { const a = base + (Math.random() - 0.5) * spread, v = spd * (0.25 + Math.random() * 0.75); p.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up * spd * 0.3, g, life: rnd(life[0], life[1]), s: rnd(size[0], size[1]), c: cols[(Math.random() * cols.length) | 0] }); }
  push(fx, { kind: 'momPix', life: life[1] + 0.1, p, a0: 0 });
}

/** The "Star Ocean" flashy stack at an impact: a tunnel of tumbling light blocks, speed-streak slashes, forking lightning, a starburst with sparkles. */
function flashyImpact(fx, ev, scene, o = {}) {
  const base = { drg: 1.05, monk: -0.12, sum: -0.55 }[scene] ?? ((Math.imul(scene.length * 31 + (ev.x | 0), 2654435761) >>> 0) % 628) / 100 - 3.14;
  push(fx, { kind: 'scrVortex', life: 1.55, x: ev.x, y: ev.y, scene, pid: ev.pid, amp: scene === 'monk' ? 0.7 : 1 });
  push(fx, { kind: 'scrBurst', life: 1.3, x: ev.x, y: ev.y, scene, pid: ev.pid });
  const n = lite(fx) ? 3 : 6; for (let i = 0; i < n; i++) push(fx, { kind: 'scrSlash', life: 0.62, delay: 0.04 + i * 0.065, x: ev.x + rnd(-60, 60), y: ev.y + rnd(-40, 40), ang: base + (i % 2 ? 1 : -1) * rnd(0.05, 0.5), len: rnd(0.75, 1.15), scene, pid: ev.pid });
  if (!lite(fx)) push(fx, { kind: 'scrBolt', life: 0.7, x: ev.x, y: ev.y, scene, pid: ev.pid, n: o.bolts || 3 });
  push(fx, { kind: 'momSpikes', life: 1.9, x: ev.x, y: ev.y, scene, n: o.spikes || 11, R: o.R || 210 });
}
/** The charge-up: the same tunnel, running inward toward the target. */
function flashyCharge(fx, ev, scene, life) { push(fx, { kind: 'scrVortex', life, x: ev.x, y: ev.y, scene, pid: ev.pid, amp: 0.5, inward: true }); }

/** The finisher starts (boss route): letterbox bars + a deep tint. `label` is printed in the lower bar. */
export function momFin(fx, ev, scene, label, keys) {
  const P = MOM[scene];
  push(fx, { kind: 'dark', life: 7, a: scene === 'monk' ? 0.62 : 0.7, pid: ev.pid, col: scene === 'drg' ? 'rgba(34,2,12,' : scene === 'monk' ? 'rgba(28,14,0,' : 'rgba(2,14,24,' });
  push(fx, { kind: 'scrBars', life: 7.5, pid: ev.pid, scene, label, keys, ch: '' });
  push(fx, { kind: 'scrVig', life: 7, pid: ev.pid, col: P.a, a: 0.5 });
}

// ---- Dragoon: Nidhogg's Fall
export function momNidMark(fx, ev) {
  push(fx, { kind: 'drgreticle', life: 1.3, x: ev.x, y: ev.y, r: 130, mk: 1, pid: ev.pid });
  push(fx, { kind: 'momCircle', life: 1.9, x: ev.x, y: ev.y, R: 250, scene: 'drg', n: 5, hitK: 1.35 });
  push(fx, { kind: 'momDragon', life: 2.2, x: ev.x, y: ev.y, pid: ev.pid });
  push(fx, { kind: 'scrLines', life: 1.25, x: ev.x, y: ev.y, inward: true, col: MOM.drg.edge, n: 26, pid: ev.pid });
  flashyCharge(fx, ev, 'drg', 1.3);
}
export function momNidhogg(fx, ev, me) {
  const P = MOM.drg, d = find(fx, 'momDragon');
  if (d) { d.hitT = d.t; d.life = d.t + 0.75; }
  for (const c of fx.cine) if (c.kind === 'momCircle' && c.scene === 'drg') c.shatterT = c.t;
  pixBurst(fx, ev.x, ev.y + 20, 90, [P.hi, P.b, P.a, '#ffffff'], 760, { up: 1, spread: Math.PI * 1.15 });
  push(fx, { kind: 'scrFlare', life: 1.0, x: ev.x, y: ev.y, scene: 'drg', pid: ev.pid });
  push(fx, { kind: 'scrShards', life: 0.9, x: ev.x, y: ev.y, scene: 'drg', pid: ev.pid });
  kick(fx, ev, 0.11); flashyImpact(fx, ev, 'drg', { spikes: 13, R: 230, bolts: 4 });
  push(fx, { kind: 'momShock', life: 1.4, x: ev.x, y: ev.y, R: 560, col: P.a, pid: ev.pid });
  push(fx, { kind: 'scrFlash', life: 0.3, col: '#ffffff', col2: P.a, a: 0.85, pid: ev.pid });
  push(fx, { kind: 'scrLines', life: 0.8, x: ev.x, y: ev.y, col: '#ffffff', n: 44, pid: ev.pid });
  push(fx, { kind: 'scrKanji', life: 2.1, ch: '竜', seal: '墜', scene: 'drg', x: ev.x, y: ev.y, size: 0.72, pid: ev.pid });
  push(fx, { kind: 'scrTitle', life: 2.3, str: "NIDHOGG'S FALL", sub: `THE DRAGON DESCENDS  ·  ×${ev.mul}`, scene: 'drg', pid: ev.pid });
  push(fx, { kind: 'scrSfx', life: 1.4, str: 'ドォォォン', fx: 0.72, fy: 0.62, rot: -0.12, scene: 'drg', pid: ev.pid });
  endScene(fx, ev.pid, 2.0);
  if (!lite(fx)) for (let i = 0; i < 26; i++) { const a = rnd(0, TAU); fx.add({ type: 'dot', x: ev.x, y: ev.y, vx: Math.cos(a) * rnd(160, 620), vy: Math.sin(a) * rnd(160, 620) - 120, life: rnd(0.6, 1.2), size: rnd(2.5, 6), color: i % 3 ? P.b : P.hi }); }
  flashMe(fx, me, '#ffffff', 0.3); fx.shake(1.4); if (me) fx.punch && fx.punch(Math.PI / 2, 14);
}

// ---- Monk: Heaven-Splitting Palm
export function momPalmCharge(fx, ev) {
  push(fx, { kind: 'momPalm', life: 2.2, x: ev.x, y: ev.y, pid: ev.pid });
  push(fx, { kind: 'momCircle', life: 2.4, x: ev.x, y: ev.y, R: 230, scene: 'monk', n: 8, hitK: 1.5 });
  pixBurst(fx, ev.x, ev.y, 40, [MOM.monk.hi, MOM.monk.a, '#ffffff'], 220, { up: 2, g: -140, spread: Math.PI * 2, life: [0.9, 1.6], size: [2, 5] });
  push(fx, { kind: 'scrLines', life: 1.0, x: ev.x, y: ev.y, inward: true, col: MOM.monk.hi, n: 34, pid: ev.pid });
  flashyCharge(fx, ev, 'monk', 1.4);
}
export function momHeaven(fx, ev, me) {
  const P = MOM.monk, pm = find(fx, 'momPalm');
  if (pm) { pm.hitT = pm.t; pm.life = pm.t + 0.5; }
  for (const c of fx.cine) if (c.kind === 'momCircle' && c.scene === 'monk') c.shatterT = c.t;
  pixBurst(fx, ev.x, ev.y, 110, [P.hi, P.a, P.b, '#ffffff'], 820, { up: 1, g: 420 });
  push(fx, { kind: 'scrFlare', life: 1.0, x: ev.x, y: ev.y, scene: 'monk', pid: ev.pid });
  push(fx, { kind: 'scrShards', life: 0.9, x: ev.x, y: ev.y, scene: 'monk', pid: ev.pid });
  kick(fx, ev, 0.1); flashyImpact(fx, ev, 'monk', { spikes: 9, R: 190, bolts: 3 });
  push(fx, { kind: 'momTen', life: 1.6, x: ev.x, y: ev.y, pid: ev.pid });
  push(fx, { kind: 'momSplit', life: 1.5, x: ev.x, y: ev.y, pid: ev.pid });
  push(fx, { kind: 'scrFlash', life: 0.3, col: '#ffffff', col2: P.a, a: 0.85, pid: ev.pid });
  push(fx, { kind: 'scrLines', life: 0.9, x: ev.x, y: ev.y, col: P.hi, n: 48, pid: ev.pid });
  push(fx, { kind: 'scrTitle', life: 2.4, str: 'HEAVEN-SPLITTING PALM', sub: `${ev.n || 0} PRESSURE POINTS  ·  ×${ev.mul}`, scene: 'monk', pid: ev.pid });
  push(fx, { kind: 'scrSfx', life: 1.4, str: 'パァァァン', fx: 0.28, fy: 0.64, rot: 0.1, scene: 'monk', pid: ev.pid });
  endScene(fx, ev.pid, 2.0);
  flashMe(fx, me, '#ffffff', 0.3); fx.shake(1.3);
}

// ---- Grimoire Summoner: The Final Chapter
const CH_NAMES = { sprite: 'THE EMBER SPRITE', wyrm: 'THE FROST WYRM', roc: 'THE STORM ROC', phoenix: 'THE PHOENIX', kraken: 'THE INK KRAKEN' };
const CH_COL = { sprite: '#ff7a2c', wyrm: '#9fe8ff', roc: '#a99bff', phoenix: '#ffb347', kraken: '#3ff0c8' };
export function momBookOpen(fx, ev) {
  if (find(fx, 'momBook')) return;
  push(fx, { kind: 'momBook', life: 3.4, x: ev.x, y: ev.y, pid: ev.pid, n: 0, col: MOM.sum.a, flipT: -9 });
  push(fx, { kind: 'momCircle', life: 3.0, x: ev.x, y: ev.y, R: 270, scene: 'sum', n: 6, hitK: 1.3 });
  flashyCharge(fx, ev, 'sum', 1.2);
}
export function momChapter(fx, ev, me) {
  const b = find(fx, 'momBook'); if (!b) return false;
  const k = ev.kind || 'sprite', col = CH_COL[k] || MOM.sum.a;
  b.n++; b.flipT = b.t; b.col = col;
  pixBurst(fx, ev.x, ev.y - 40, 26, [col, '#ffffff', MOM.sum.hi], 420, { up: 1.2, g: 300, life: [0.5, 1.1] });
  fx.text(ev.x, ev.y + 128, `CHAPTER ${['I', 'II', 'III', 'IV', 'V'][(ev.i ?? b.n - 1) % 5]}  ·  ${CH_NAMES[k] || ''}`, { size: 20, color: col, pop: 1.6, life: 0.9, vy: 14 });
  push(fx, { kind: 'scrFlash', life: 0.3, col, col2: col, a: 0.3, pid: ev.pid });
  return false; // (the engine's own creature attack still plays)
}
/** The book slams shut. Returns true when it took over the slam (so the engine's plain falling book is skipped). */
export function momBookSlam(fx, ev, me) {
  const b = find(fx, 'momBook'); if (!b) return false;
  const P = MOM.sum;
  b.slamT = b.t; b.life = b.t + 1.0;
  for (const c of fx.cine) if (c.kind === 'momCircle' && c.scene === 'sum') c.shatterT = c.t;
  pixBurst(fx, ev.x, ev.y, 110, [P.a, P.hi, P.b, '#ffffff'], 760, { up: 1, g: 380 });
  push(fx, { kind: 'scrFlare', life: 1.0, x: ev.x, y: ev.y, scene: 'sum', pid: ev.pid });
  push(fx, { kind: 'scrShards', life: 0.9, x: ev.x, y: ev.y, scene: 'sum', pid: ev.pid });
  kick(fx, ev, 0.1); flashyImpact(fx, ev, 'sum', { spikes: 12, R: 240, bolts: 4 });
  push(fx, { kind: 'momShock', life: 1.3, x: ev.x, y: ev.y, R: 480, col: P.a, pid: ev.pid });
  push(fx, { kind: 'scrFlash', life: 0.3, col: '#ffffff', col2: P.a, a: 0.85, pid: ev.pid });
  push(fx, { kind: 'scrLines', life: 0.8, x: ev.x, y: ev.y, col: P.hi, n: 40, pid: ev.pid });
  push(fx, { kind: 'scrKanji', life: 2.2, ch: '終', seal: '完', scene: 'sum', x: ev.x, y: ev.y, size: 0.72, pid: ev.pid });
  push(fx, { kind: 'scrTitle', life: 2.4, str: 'THE FINAL CHAPTER', sub: 'EVERY PAGE WRITTEN  ·  THE END', scene: 'sum', pid: ev.pid });
  push(fx, { kind: 'scrSfx', life: 1.4, str: 'ドンッ', fx: 0.74, fy: 0.6, rot: -0.1, scene: 'sum', pid: ev.pid });
  endScene(fx, ev.pid, 2.0);
  fx.add({ type: 'crack', x: ev.x, y: ev.y, r: ev.r || 220, life: 1.5, seed: rnd(0, TAU), glow: true, col: P.a, n: 9 });
  if (!lite(fx)) for (let i = 0; i < 30; i++) { const a = rnd(0, TAU); fx.add({ type: 'dot', x: ev.x, y: ev.y - 40, vx: Math.cos(a) * rnd(120, 520), vy: Math.sin(a) * rnd(120, 520) - 160, life: rnd(0.7, 1.3), size: rnd(3, 7), color: i % 2 ? '#fff8e6' : P.a }); }
  flashMe(fx, me, '#ffffff', 0.3); fx.shake(1.2);
  return true;
}

// ------------------------------------------------------------------ world space
function dragonFall(c) { return c.hitT !== undefined ? 1 : Math.min(1, c.t / 1.2); }
function symbolCircle(ctx, c, time, under) { // a rotating symbology circle in perspective: rings, ticks, glyph blocks, a {n/2} star
  const P = MOM[c.scene], inK = ease.out(clamp(c.t / 0.45)), outK = c.shatterT !== undefined ? 1 - clamp((c.t - c.shatterT) / 0.35) : ease.in(clamp((c.life - c.t) / 0.4)), a = inK * outK;
  if (a <= 0.01) return;
  const R = c.R * (0.6 + 0.4 * inK) * (c.shatterT !== undefined ? 1 + 0.6 * clamp((c.t - c.shatterT) / 0.35) : 1), pulse = 0.85 + 0.15 * Math.sin(time * 6);
  ctx.save(); ctx.translate(c.x, c.y + 22); ctx.scale(1, 0.5); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
  bloom(ctx, 0, 0, R * 1.25, P.a, 0.55 * a * pulse);
  const ring = (r, w, col, al) => { ctx.globalAlpha = a * al; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); };
  ring(R, 7, P.a, 0.55); ring(R, 2.5, '#ffffff', 0.95); ring(R * 0.84, 3, P.b, 0.7); ring(R * 0.66, 2, P.hi, 0.6);
  // tick marks + glyph blocks on the outer band, rotating one way
  ctx.save(); ctx.rotate(time * 0.5 * c.hitK);
  for (let i = 0; i < 36; i++) { const an = i / 36 * TAU, r0 = R * 0.9, r1 = R * (i % 3 ? 0.95 : 0.99); ctx.globalAlpha = a * (i % 3 ? 0.5 : 0.95); ctx.strokeStyle = i % 3 ? P.hi : '#ffffff'; ctx.lineWidth = i % 3 ? 2 : 3.5; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); ctx.stroke(); }
  for (let i = 0; i < 12; i++) { const an = i / 12 * TAU + 0.13, rr = R * 0.77; ctx.save(); ctx.translate(Math.cos(an) * rr, Math.sin(an) * rr); ctx.rotate(an + Math.PI / 2); ctx.globalAlpha = a * 0.85; ctx.fillStyle = i % 2 ? P.b : P.hi; const w = R * 0.045; ctx.fillRect(-w, -w * 1.5, w * 2, w * 3); ctx.globalAlpha = a; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.strokeRect(-w * 0.5, -w * 0.9, w, w * 1.8); ctx.restore(); }
  ctx.restore();
  // the inner {n/2} star + polygon, rotating the other way
  ctx.save(); ctx.rotate(-time * 0.7 * c.hitK);
  const n = c.n, step = n % 2 ? (n - 1) / 2 : 2, rr = R * 0.62; ctx.globalAlpha = a * 0.9; ctx.strokeStyle = P.hi; ctx.lineWidth = 3;
  ctx.beginPath(); for (let i = 0; i <= n; i++) { const an = (i * step) / n * TAU - Math.PI / 2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); } ctx.stroke();
  ctx.globalAlpha = a * 0.6; ctx.strokeStyle = P.a; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= n; i++) { const an = i / n * TAU - Math.PI / 2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); } ctx.stroke();
  for (let i = 0; i < n; i++) { const an = i / n * TAU - Math.PI / 2; bloom(ctx, Math.cos(an) * rr, Math.sin(an) * rr, R * 0.12, P.hi, 0.9 * a * pulse); }
  ctx.restore();
  // converging light motes (charging)
  if (!c.shatterT) for (let i = 0; i < 10; i++) { const k = ((time * 0.8 + i / 10) % 1), an = i * 2.4 + time * 0.3, r = R * (1 - k); ctx.globalAlpha = a * (1 - k) * 0.9; ctx.fillStyle = '#ffffff'; const sz = 4 * (1 - k * 0.5); ctx.fillRect(Math.round(Math.cos(an) * r / 3) * 3 - sz / 2, Math.round(Math.sin(an) * r / 3) * 3 - sz / 2, sz, sz); }
  ctx.restore();
}
export const MOM_CINE = {
  momCircle(fx, ctx, c, time) { symbolCircle(ctx, c, time, false); },
  momPix(fx, ctx, c) { // grid-snapped square sparks: white-hot, then the colour, then dark ember
    const t = c.t; ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const q of c.p) {
      if (t > q.life) continue; const u = t / q.life, x = q.x + q.vx * t * (1 - 0.35 * u), y = q.y + q.vy * t + 0.5 * q.g * t * t, sz = Math.max(2, Math.round(q.s * (1 - u * 0.55) / 2) * 2), gx = Math.round(x / 3) * 3, gy = Math.round(y / 3) * 3;
      ctx.globalAlpha = Math.min(1, (1 - u) * 1.6); bloom(ctx, gx, gy, sz * 3.2, q.c, 0.35 * (1 - u));
      ctx.globalAlpha = Math.min(1, (1 - u) * 1.6); ctx.fillStyle = u < 0.25 ? '#ffffff' : q.c; ctx.fillRect(gx - sz / 2, gy - sz / 2, sz, sz);
    }
    ctx.restore();
  },
  momSpikes(fx, ctx, c) { // translucent crystal spires bursting out of the ground (the Blood Scylla look)
    const P = MOM[c.scene], R = seeded(Math.round(c.x * 7 + c.y * 3) | 1), list = [];
    for (let i = 0; i < c.n; i++) { const an = R() * TAU, rr = c.R * (0.15 + R() * 0.9), h = 150 + R() * 260, w = 20 + R() * 26, d = R() * 0.22; list.push({ x: c.x + Math.cos(an) * rr, y: c.y + 24 + Math.sin(an) * rr * 0.46, h, w, d, lean: (R() - 0.5) * 0.5 }); }
    list.sort((a, b) => a.y - b.y);
    ctx.save();
    for (const q of list) {
      const grow = ease.out(clamp((c.t - q.d) / 0.2)), out = 1 - ease.in(clamp((c.t - (c.life - 0.6)) / 0.6)), a = out * clamp((c.t - q.d) / 0.05);
      if (grow <= 0 || a <= 0.01) continue;
      const h = q.h * grow, tx = q.x + q.lean * h, ty = q.y - h;
      ctx.globalAlpha = a; ctx.globalCompositeOperation = 'source-over';
      const gl = ctx.createLinearGradient(q.x, q.y, tx, ty); gl.addColorStop(0, P.a); gl.addColorStop(0.55, P.hi); gl.addColorStop(1, '#ffffff');
      ctx.fillStyle = gl; ctx.globalAlpha = a * 0.78; ctx.beginPath(); ctx.moveTo(q.x - q.w, q.y); ctx.lineTo(tx, ty); ctx.lineTo(q.x, q.y + q.w * 0.35); ctx.closePath(); ctx.fill(); // lit face
      ctx.fillStyle = P.deep; ctx.globalAlpha = a * 0.5; ctx.beginPath(); ctx.moveTo(q.x, q.y + q.w * 0.35); ctx.lineTo(tx, ty); ctx.lineTo(q.x + q.w, q.y); ctx.closePath(); ctx.fill(); // shaded face
      ctx.fillStyle = P.a; ctx.globalAlpha = a * 0.35; ctx.beginPath(); ctx.moveTo(q.x, q.y + q.w * 0.35); ctx.lineTo(tx, ty); ctx.lineTo(q.x + q.w * 0.5, q.y); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q.x - q.w, q.y); ctx.lineTo(tx, ty); ctx.lineTo(q.x + q.w, q.y); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(q.x, q.y + q.w * 0.35); ctx.lineTo(tx, ty); ctx.stroke();
      bloom(ctx, tx, ty + h * 0.08, 34 + q.w, P.hi, 0.55 * a * (1 - clamp((c.t - q.d) / 1.2) * 0.6)); bloom(ctx, q.x, q.y, q.w * 3, P.a, 0.5 * a);
    }
    ctx.restore();
  },
  momDragon(fx, ctx, c, time) { // a colossal dragon dives from beyond the top of the screen onto the target
    const k = dragonFall(c), fall = Math.pow(k, 1.25), H = 640, sc = 3.1;
    const y = c.y - H * (1 - fall) + 70, hitK = c.hitT !== undefined ? clamp((c.t - c.hitT) / 0.7) : 0, a = 1 - ease.in(hitK);
    // the plummeting column of crimson light behind it
    const v = fx.view, top = v ? v.y0 - 80 : y - 900;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, top, 0, y); g.addColorStop(0, 'rgba(255,48,72,0)'); g.addColorStop(1, `rgba(255,70,90,${0.5 * a})`);
    ctx.fillStyle = g; const w = 150 + 80 * fall; ctx.fillRect(c.x - w / 2, top, w, Math.max(0, y - top));
    ctx.restore();
    bloom(ctx, c.x, y, 260 * sc / 3, MOM.drg.a, 0.9 * a);
    drawDragon(ctx, c.x, y, Math.PI / 2, c.t * 1.6, a, sc, 5);
    if (!lite(fx) && k < 1) for (let i = 0; i < 2; i++) fx.add({ type: 'dot', x: c.x + rnd(-130, 130), y: y + rnd(-60, 20), vx: rnd(-30, 30), vy: -rnd(120, 360), life: rnd(0.3, 0.6), size: rnd(2.5, 5), color: i ? MOM.drg.b : MOM.drg.a });
  },
  momPalm(fx, ctx, c, time) { // a colossal golden palm hangs above the boss, gathering light, then falls
    const k = clamp(c.t / 1.1), rise = ease.out(k);
    const hit = c.hitT !== undefined, hk = hit ? clamp((c.t - c.hitT) / 0.12) : 0, fade = hit ? 1 - clamp((c.t - c.hitT) / 0.5) : 1;
    const y = c.y - 330 * (1 - hk) * (0.55 + 0.45 * rise) + (hit ? 20 * hk : 0), s = (1.15 + 0.45 * rise) * (hit ? 1 - 0.25 * hk : 1);
    ctx.save(); ctx.translate(c.x, y); ctx.globalAlpha = (0.2 + 0.8 * rise) * fade;
    bloom(ctx, 0, 0, 340 * s, MOM.monk.a, 0.8); bloom(ctx, 0, 0, 160 * s, '#ffffff', 0.5);
    ctx.scale(s, s);
    ctx.globalCompositeOperation = 'lighter';
    // the open palm: a rounded heel, four tapering fingers, a thumb, drawn as a glowing silhouette with a hot core
    const fing = [[-62, -30, -0.28, 118], [-24, -52, -0.09, 150], [18, -52, 0.08, 150], [58, -32, 0.26, 126]];
    const hand = (lw, col, a2) => {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.globalAlpha = a2 * (0.2 + 0.8 * rise) * fade; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(-72, 78); ctx.quadraticCurveTo(-92, 20, -72, -14);
      for (const [fx0, fy0, ang, len] of fing) { ctx.moveTo(fx0, fy0 + 40); ctx.lineTo(fx0 + Math.sin(ang) * len, fy0 - Math.cos(ang) * len); }
      ctx.moveTo(-76, 6); ctx.quadraticCurveTo(-136, -4, -150, -58);
      ctx.moveTo(-70, 78); ctx.quadraticCurveTo(0, 124, 72, 78); ctx.quadraticCurveTo(100, 20, 78, -14); ctx.stroke();
    };
    hand(34, MOM.monk.b, 0.28); hand(18, MOM.monk.a, 0.6); hand(6, '#ffffff', 0.95);
    ctx.globalAlpha = 0.9 * fade * (0.2 + 0.8 * rise); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; // the palm's lines
    ctx.beginPath(); ctx.moveTo(-40, 50); ctx.quadraticCurveTo(0, 20, 44, 52); ctx.moveTo(-30, 20); ctx.quadraticCurveTo(10, 4, 40, 24); ctx.stroke();
    ctx.restore();
    if (!lite(fx) && !hit && Math.random() < 0.6) fx.add({ type: 'dot', x: c.x + rnd(-180, 180), y: c.y + rnd(-200, 40), vx: 0, vy: -rnd(40, 160), life: rnd(0.5, 0.9), size: rnd(2, 4), color: MOM.monk.hi });
  },
  momTen(fx, ctx, c, time) { // 天 carved in light over the boss (the screen split slices it in two)
    const k = clamp(c.t / c.life), pop = ease.out(clamp(c.t / 0.14)), a = (1 - ease.in(clamp((k - 0.55) / 0.45))) * 0.95, S = 420 * (1.35 - 0.35 * pop);
    ctx.save(); ctx.translate(c.x, c.y - 70); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = KANJI(S);
    bloom(ctx, 0, 0, S * 0.8, MOM.monk.b, 0.4 * a);
    ctx.lineJoin = 'round'; ctx.lineWidth = S * 0.1; ctx.strokeStyle = 'rgba(52,22,0,.95)'; ctx.strokeText('天', 0, 0);
    const g = ctx.createLinearGradient(0, -S / 2, 0, S / 2); g.addColorStop(0, '#fff3c4'); g.addColorStop(0.45, '#ffd23f'); g.addColorStop(1, '#ff8a1c');
    ctx.fillStyle = g; ctx.fillText('天', 0, 0);
    ctx.lineWidth = S * 0.014; ctx.strokeStyle = '#ffffff'; ctx.strokeText('天', 0, 0);
    ctx.restore();
  },
  momBook(fx, ctx, c, time) { // the open grimoire above the boss: pages turn with every chapter, then it slams shut
    const rise = ease.out(clamp(c.t / 0.45)), slam = c.slamT !== undefined, sk = slam ? clamp((c.t - c.slamT) / 0.16) : 0;
    const open = slam ? 1 - ease.in(sk) : rise;
    const y = c.y - 150 * (1 - ease.in(sk)) - 30 * (1 - rise) + 6 * Math.sin(time * 3), fade = slam ? 1 - clamp((c.t - c.slamT - 0.45) / 0.55) : clamp(c.t / 0.2);
    const flip = c.flipT > -5 ? clamp((c.t - c.flipT) / 0.35) : 1;
    bloom(ctx, c.x, y - 40, 300, c.col, (0.45 + 0.4 * (1 - flip)) * fade);
    drawBook(ctx, c.x, y, 190 * (slam ? 1 + 0.12 * sk : 1), open, time, fade, c.col);
    if (!lite(fx) && !slam && Math.random() < 0.7) fx.add({ type: 'dot', x: c.x + rnd(-170, 170), y: y - rnd(20, 150), vx: rnd(-20, 20), vy: -rnd(30, 120), life: rnd(0.6, 1.1), size: rnd(2, 4.5), color: Math.random() < 0.5 ? '#fff8e6' : c.col });
  },
};
export const MOM_UNDER = {
  momShock(fx, ctx, c) { // ground shock rings (flattened for the top-down perspective) + a hot core
    const k = c.t / c.life, e = ease.out(clamp(c.t / 0.5));
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.62); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const kk = clamp((c.t - i * 0.07) / 0.55); if (kk <= 0) continue;
      const r = c.R * ease.out(kk) * (1 - i * 0.18), a = (1 - kk) * (1 - i * 0.2);
      ctx.globalAlpha = a; ctx.lineWidth = 30 * (1 - kk) + 3; ctx.strokeStyle = i === 0 ? '#ffffff' : c.col; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    bloom(ctx, c.x, c.y, c.R * 0.9 * (0.5 + 0.5 * e), c.col, (1 - k) * 0.9);
    bloom(ctx, c.x, c.y, c.R * 0.35, '#ffffff', (1 - clamp(c.t / 0.35)) * 0.9, 1);
  },
};

// ------------------------------------------------------------------ screen space
function kanjiInk(ctx, ch, x, y, S, P, a, rot, seed, splat) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = KANJI(S);
  if (splat > 0) { // ink splatter around the stroke
    const R = seeded(seed); ctx.fillStyle = P.ink;
    for (let i = 0; i < 26; i++) { const an = R() * TAU, d = S * (0.34 + R() * 0.55), r = S * (0.006 + R() * R() * 0.05) * splat; ctx.globalAlpha = a * 0.8; ctx.beginPath(); ctx.arc(Math.cos(an) * d, Math.sin(an) * d * 0.9, r, 0, TAU); ctx.fill(); }
  }
  bloom(ctx, 0, 0, S * 0.85, P.a, 0.55 * a);
  ctx.globalAlpha = a; ctx.lineJoin = 'round'; ctx.lineWidth = S * 0.07; ctx.strokeStyle = P.ink; ctx.strokeText(ch, 0, 0);
  const g = ctx.createLinearGradient(0, -S / 2, 0, S / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, P.hi); g.addColorStop(1, P.a);
  ctx.fillStyle = g; ctx.fillText(ch, 0, 0);
  ctx.lineWidth = S * 0.012; ctx.strokeStyle = P.a; ctx.strokeText(ch, 0, 0);
  ctx.restore();
}
function sealStamp(ctx, ch, x, y, s, P, a) { // a red hanko seal
  ctx.save(); ctx.translate(x, y); ctx.rotate(0.06); ctx.globalAlpha = a;
  ctx.fillStyle = '#c4122b'; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.strokeStyle = '#7a0a1a'; ctx.lineWidth = s * 0.06; ctx.strokeRect(-s / 2 + s * 0.05, -s / 2 + s * 0.05, s * 0.9, s * 0.9);
  ctx.fillStyle = '#ffe9e0'; ctx.font = KANJI(s * 0.66); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, 0, s * 0.03);
  ctx.restore();
}

const SCR = {
  scrFin(fx, ctx, c, W, H, rend) { // the class's own finisher centrepiece (see fxfinish.js)
    const f = FIN[c.cls]; if (!f) return; const P = MOM[c.scene], s = rend.worldToScreen(c.x, c.y);
    ctx.save(); try { f(ctx, c, W, H, s, P, fx); } catch (e) { /* presentation must never break the frame */ } ctx.restore();
  },
  scrFlare(fx, ctx, c, W, H, rend) { // anamorphic lens streak + a 4-point star at the impact (the HD-2D 'bloom flare')
    const P = MOM[c.scene], s = rend.worldToScreen(c.x, c.y), k = clamp(c.t / c.life), a = Math.pow(1 - k, 1.6), e = ease.out(clamp(c.t / 0.14));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(s.x, s.y);
    const L = W * 0.95 * e, h = Math.max(4, H * 0.012) * (1 - k * 0.7);
    let g = ctx.createLinearGradient(-L / 2, 0, L / 2, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = a * 0.9; ctx.fillStyle = g; ctx.fillRect(-L / 2, -h / 2, L, h);
    g = ctx.createLinearGradient(-L / 2, 0, L / 2, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, P.a); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a * 0.7; ctx.fillStyle = g; ctx.fillRect(-L / 2, -h * 2.4, L, h * 4.8);
    const R = Math.min(W, H) * 0.34 * e; ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? R * 0.09 : (i % 4 === 0 ? R : R * 0.55); ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  scrShards(fx, ctx, c, W, H, rend) { // crystalline shards blown outward (the Break burst)
    const P = MOM[c.scene], s = rend.worldToScreen(c.x, c.y), t = c.t, R = seeded(Math.round(c.x * 3 + c.y) | 1), far = Math.hypot(W, H) * 0.7;
    ctx.save(); ctx.translate(s.x, s.y);
    for (let i = 0; i < 34; i++) {
      const an = R() * TAU, sp = 0.25 + R() * 0.75, life = c.life * (0.6 + R() * 0.4), u = t / life; if (u >= 1) { R(); R(); continue; }
      const d = far * sp * ease.out(clamp(u)), sz = (14 + R() * 46) * (1 - u * 0.5), rot = R() * TAU + t * (R() - 0.5) * 9, a = (1 - u) * 0.9;
      ctx.save(); ctx.translate(Math.cos(an) * d, Math.sin(an) * d * 0.8); ctx.rotate(rot); ctx.globalAlpha = a;
      const g = ctx.createLinearGradient(-sz, -sz, sz, sz); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.55, P.hi); g.addColorStop(1, P.a);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.55, sz * 0.5); ctx.lineTo(-sz * 0.35, -sz * 0.7); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  },
  scrVortex(fx, ctx, c, W, H, rend, time) { // a tunnel of tumbling light blocks around a white-hot core (the Star Ocean 'break' burst)
    const P = MOM[c.scene], s = rend.worldToScreen(c.x, c.y), t = c.t, inw = !!c.inward, amp = c.amp, far = Math.hypot(W, H) * 0.62;
    const inK = ease.out(clamp(t / (inw ? 0.3 : 0.07))), outK = inw ? ease.in(clamp((c.life - t) / 0.25)) : 1 - ease.out(clamp((t - 0.25) / (c.life - 0.25))), a = inK * outK * amp;
    if (a <= 0.01) return;
    c.k = a; // read by the shader layer (swirl strength)
    ctx.save(); ctx.translate(s.x, s.y); ctx.globalCompositeOperation = 'lighter';
    // the colour flood and the white core
    const flood = ctx.createRadialGradient(0, 0, 0, 0, 0, far * 1.15); flood.addColorStop(0, P.hi); flood.addColorStop(0.2, P.a); flood.addColorStop(0.55, P.b); flood.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.12 * a * (inw ? 0.5 : 1); ctx.fillStyle = flood; ctx.fillRect(-W, -H, W * 2, H * 2);
    const NR = lite(fx) ? 7 : 16, spin = t * (inw ? -1.4 : 1.4);
    for (let i = 0; i < NR; i++) {
      const R = seeded(1000 + i * 77), u0 = (i / NR + (inw ? -t : t) * 0.9), u = u0 - Math.floor(u0), r = far * 0.03 * Math.pow(38, u), m = 16 + ((i * 7) % 13), dir = i % 2 ? 1 : -1, rot = spin * dir * (0.55 + (i % 4) * 0.16) + i * 1.3;
      const fade = Math.sin(Math.PI * Math.pow(u, 0.6)), arc = TAU * r / m;
      for (let j = 0; j < m; j++) {
        const rj = R(); if (rj < 0.22) { R(); R(); continue; }
        const an = rot + j / m * TAU + (R() - 0.5) * 0.12, w = arc * (0.45 + 0.4 * R()), h = r * (0.045 + 0.08 * R()), tum = (time * 2.2 + j) * (rj - 0.4) * 1.2;
        const x = Math.cos(an) * r, y = Math.sin(an) * r;
        ctx.save(); ctx.translate(x, y); ctx.rotate(an + Math.PI / 2 + tum * 0.25);
        const al = Math.min(1, fade * a * 1.6), hot = j % 4 === 0;
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = al * 0.85; ctx.fillStyle = P.deep; ctx.fillRect(-w / 2 + w * 0.2, -h / 2 + h * 0.5, w, h); ctx.globalCompositeOperation = 'lighter';          // the block's depth face
        ctx.globalAlpha = al; ctx.fillStyle = hot ? '#ffffff' : (j % 3 ? P.b : P.hi); ctx.fillRect(-w / 2, -h / 2, w, h); // its lit face
        ctx.globalAlpha = al; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, r * 0.006); ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.restore();
      }
    }
    bloom(ctx, 0, 0, far * 0.6, P.a, 0.6 * a); bloom(ctx, 0, 0, far * 0.2, '#ffffff', 0.8 * a * (inw ? 0.4 : 1), 1);
    ctx.restore();
  },
  scrSlash(fx, ctx, c, W, H, rend) { // Tetanus-Wind-style speed streaks: a tapered white blade of light with a coloured wake and tick sparks
    const k = (c.t - c.delay) / (c.life - c.delay); if (k <= 0 || k >= 1) return;
    const P = MOM[c.scene], s = rend.worldToScreen(c.x, c.y), L = Math.hypot(W, H) * c.len, head = ease.out(clamp(k / 0.35)), tail = ease.in(clamp((k - 0.2) / 0.8)), a = 1 - ease.in(clamp((k - 0.45) / 0.55));
    const x0 = -L / 2 + L * tail, x1 = -L / 2 + L * head; if (x1 - x0 < 2) return;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(c.ang); ctx.globalCompositeOperation = 'lighter';
    const blade = (hw, col, al) => { ctx.globalAlpha = al * a; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.quadraticCurveTo((x0 + x1) * 0.62, -hw, x1, 0); ctx.quadraticCurveTo((x0 + x1) * 0.62, hw, x0, 0); ctx.closePath(); ctx.fill(); };
    blade(Math.max(26, H * 0.05), P.a, 0.45); blade(Math.max(11, H * 0.022), P.hi, 0.85); blade(Math.max(3.5, H * 0.007), '#ffffff', 1);
    bloom(ctx, x1, 0, 70, '#ffffff', 0.9 * a);
    const R = seeded(Math.round(c.delay * 100) + 5); ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const px = x0 + (x1 - x0) * R(), sd = R() < 0.5 ? -1 : 1, d0 = 12 + R() * 28, d1 = d0 + 16 + R() * 40; ctx.globalAlpha = a * (0.5 + R() * 0.5); ctx.lineWidth = 1.4 + R() * 1.6; ctx.beginPath(); ctx.moveTo(px, sd * d0); ctx.lineTo(px + (R() - 0.2) * 40, sd * d1); ctx.stroke(); }
    ctx.restore();
  },
  scrBolt(fx, ctx, c, W, H, rend) { // forking lightning striking the impact from above, re-rolled every few frames so it crackles
    const P = MOM[c.scene], s = rend.worldToScreen(c.x, c.y), k = clamp(c.t / c.life), a = (1 - ease.in(clamp((k - 0.35) / 0.65))) * (0.55 + 0.45 * Math.sin(c.t * 90) ** 2); if (a <= 0.02) return;
    const R = seeded(Math.floor(c.t * 22) * 131 + 7 + Math.round(c.x));
    const jag = (x0, y0, x1, y1, amp, depth, out) => { if (depth === 0) { out.push([x1, y1]); return; } const mx = (x0 + x1) / 2 + (R() - 0.5) * amp, my = (y0 + y1) / 2 + (R() - 0.5) * amp * 0.5; jag(x0, y0, mx, my, amp / 2, depth - 1, out); jag(mx, my, x1, y1, amp / 2, depth - 1, out); };
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const paths = [];
    for (let b = 0; b < c.n; b++) {
      const sx = s.x + (b - (c.n - 1) / 2) * W * 0.17 + (R() - 0.5) * 60, pts = [[sx, -20]]; jag(sx, -20, s.x + (R() - 0.5) * 50, s.y, Math.max(70, H * 0.2), 5, pts); paths.push(pts);
      for (let f = 0; f < 3; f++) { const o = pts[(pts.length * (0.25 + R() * 0.55)) | 0], ex = o[0] + (R() - 0.5) * W * 0.34, ey = o[1] + H * (0.12 + R() * 0.2), br = [o]; jag(o[0], o[1], ex, ey, 60, 3, br); paths.push(br); }
    }
    for (const [w, col, al] of [[16, P.a, 0.3], [6, P.hi, 0.7], [2.2, '#ffffff', 1]]) { ctx.lineWidth = w; ctx.strokeStyle = col; ctx.globalAlpha = a * al; for (const pts of paths) { ctx.beginPath(); pts.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q[0], q[1])); ctx.stroke(); } }
    bloom(ctx, s.x, s.y, 120, '#ffffff', 0.8 * a);
    ctx.restore();
  },
  scrBurst(fx, ctx, c, W, H, rend, time) { // the Faerie-Light starburst: long thin rays and twinkling four-point sparkles
    const P = MOM[c.scene], s = rend.worldToScreen(c.x, c.y), t = c.t, k = clamp(t / c.life), far = Math.hypot(W, H), R = seeded(Math.round(c.x * 5 + c.y) | 1);
    const e = ease.out(clamp(t / 0.16)), a = Math.pow(1 - k, 1.4);
    ctx.save(); ctx.translate(s.x, s.y); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      const an = i / 16 * TAU + R() * 0.2 + t * 0.12, L = far * (0.28 + R() * 0.3) * e, w = 0.012 + R() * 0.018; ctx.globalAlpha = a * (0.55 + R() * 0.4);
      const g = ctx.createLinearGradient(0, 0, Math.cos(an) * L, Math.sin(an) * L); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, P.hi); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(Math.cos(an - w) * 30, Math.sin(an - w) * 30); ctx.lineTo(Math.cos(an) * L, Math.sin(an) * L); ctx.lineTo(Math.cos(an + w) * 30, Math.sin(an + w) * 30); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const n = lite(fx) ? 14 : 38; ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const bx = R() * W, by = R() * H, birth = R() * 0.5, life = 0.5 + R() * 0.6, u = (t - birth) / life, big = 5 + R() * 15, hue = R() < 0.5; if (u <= 0 || u >= 1) continue;
      const sc = Math.sin(Math.PI * u), r = big * sc, dx = (bx - s.x) * 0.06 * u, dy = -30 * u;
      ctx.globalAlpha = sc; ctx.fillStyle = hue ? '#ffffff' : P.hi;
      ctx.beginPath(); ctx.moveTo(bx + dx, by + dy - r * 2.4); ctx.lineTo(bx + dx + r * 0.35, by + dy - r * 0.35); ctx.lineTo(bx + dx + r * 2.4, by + dy); ctx.lineTo(bx + dx + r * 0.35, by + dy + r * 0.35); ctx.lineTo(bx + dx, by + dy + r * 2.4); ctx.lineTo(bx + dx - r * 0.35, by + dy + r * 0.35); ctx.lineTo(bx + dx - r * 2.4, by + dy); ctx.lineTo(bx + dx - r * 0.35, by + dy - r * 0.35); ctx.closePath(); ctx.fill();
      bloom(ctx, bx + dx, by + dy, r * 3.2, P.a, 0.35 * sc);
    }
    ctx.restore();
  },
  scrBars(fx, ctx, c, W, H, rend, time) { // letterbox bars with the finisher route printed in them
    const P = MOM[c.scene], inK = ease.out(clamp(c.t / 0.3)), outK = ease.in(clamp((c.life - c.t) / 0.35)), k = Math.min(inK, outK), bh = Math.min(96, H * 0.105) * k;
    ctx.save(); ctx.fillStyle = P.ink; ctx.globalAlpha = 0.96;
    ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
    ctx.globalAlpha = 0.9 * k; ctx.fillStyle = P.a; ctx.fillRect(0, bh - 3, W, 3); ctx.fillRect(0, H - bh, W, 3);
    ctx.restore();
  },
  scrVig(fx, ctx, c, W, H) {
    const k = ease.out(clamp(c.t / 0.4)) * ease.in(clamp((c.life - c.t) / 0.5)), g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.58);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.55 * k})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.6); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, c.col + '');
    ctx.save(); ctx.globalAlpha = 0.28 * k * c.a; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H); ctx.restore();
  },
  scrFlash(fx, ctx, c, W, H) {
    const k = clamp(c.t / c.life); ctx.save();
    ctx.globalAlpha = Math.pow(1 - k, 2.2) * (vfxPref.reduceFlash ? Math.min(c.a, FLASH_CAP) : c.a); ctx.fillStyle = k < 0.18 ? c.col : c.col2; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },
  scrLines(fx, ctx, c, W, H, rend) { // radial speed / impact lines from the world point
    const s = rend.worldToScreen(c.x, c.y), k = clamp(c.t / c.life), R = seeded(Math.round(c.x + c.y) | 1), far = Math.hypot(W, H);
    ctx.save(); ctx.translate(s.x, s.y); ctx.fillStyle = c.col; ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < c.n; i++) {
      const an = (i / c.n) * TAU + R() * 0.12, w = 0.006 + R() * 0.014, len = far * (0.35 + R() * 0.45);
      const r0 = c.inward ? far * 0.6 * (1 - ease.out(k)) + 60 : 40 + far * 0.55 * ease.out(k), r1 = Math.min(far, r0 + len * (c.inward ? 0.5 : 0.3 * (1 - k) + 0.1));
      ctx.globalAlpha = (c.inward ? ease.out(Math.min(1, k * 3)) * (1 - k * 0.4) : 1 - k) * 0.75;
      ctx.beginPath(); ctx.moveTo(Math.cos(an - w) * r1, Math.sin(an - w) * r1); ctx.lineTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an + w) * r1, Math.sin(an + w) * r1); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  },
  scrKanji(fx, ctx, c, W, H, rend) { // the ink-brushed character slams down behind the action
    const P = MOM[c.scene], S = Math.min(H * 0.95, W * 0.8) * c.size, slam = ease.in(clamp(c.t / 0.11)), sc = 2.4 - 1.4 * slam + 0.04 * clamp((c.t - 0.11) / 1.5);
    const a = slam * (c.t < 0.2 ? 0.55 : 0.26) * ease.in(clamp((c.life - c.t) / 0.55));
    if (a <= 0.01) return;
    const s = rend.worldToScreen(c.x, c.y);
    ctx.save(); ctx.translate(W * 0.5 + (s.x - W * 0.5) * 0.15, H * 0.5 + (s.y - H * 0.5) * 0.1); ctx.scale(sc, sc);
    kanjiInk(ctx, c.ch, 0, 0, S, P, a, c.scene === 'drg' ? -0.06 : 0.04, c.ch.charCodeAt(0), clamp((c.t - 0.1) / 0.1));
    sealStamp(ctx, c.seal, S * 0.33, S * 0.4, S * 0.15 * clamp((c.t - 0.18) / 0.08), P, a);
    ctx.restore();
  },
  scrTitle(fx, ctx, c, W, H) { // the diagonal title band: a dark slash with the finisher's name slammed over it
    const P = MOM[c.scene], inK = ease.out(clamp(c.t / 0.2)), outK = ease.in(clamp((c.life - c.t) / 0.4)), k = Math.min(inK, outK);
    if (k <= 0) return;
    const fs = Math.max(26, Math.min(78, W / (c.str.length * 0.62 + 2))), y = H * 0.3, bh = fs * 1.9, slam = 1 + 0.5 * (1 - ease.out(clamp(c.t / 0.14)));
    ctx.save(); ctx.globalAlpha = k;
    ctx.translate(W / 2, y); ctx.rotate(-0.045);
    const bw = W * 1.2 * inK; ctx.fillStyle = 'rgba(0,0,0,.78)'; ctx.beginPath(); ctx.moveTo(-bw / 2, -bh / 2); ctx.lineTo(bw / 2, -bh / 2 - 8); ctx.lineTo(bw / 2, bh / 2 - 8); ctx.lineTo(-bw / 2, bh / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.a; ctx.fillRect(-bw / 2, -bh / 2 - 3, bw, 4); ctx.fillRect(-bw / 2, bh / 2 - 1, bw, 4);
    ctx.save(); ctx.scale(slam, slam); ctx.transform(1, 0, -0.16, 1, 0, 0); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${fs}px ${HEAD}`;
    ctx.lineJoin = 'round'; ctx.lineWidth = fs * 0.2; ctx.strokeStyle = P.ink; ctx.strokeText(c.str, 0, -fs * 0.12);
    const g = ctx.createLinearGradient(0, -fs * 0.6, 0, fs * 0.5); g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, P.hi); g.addColorStop(1, P.a);
    ctx.fillStyle = g; ctx.fillText(c.str, 0, -fs * 0.12);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k * 0.35; ctx.fillStyle = P.a; ctx.fillText(c.str, 0, -fs * 0.12);
    ctx.restore();
    ctx.globalAlpha = k * clamp((c.t - 0.12) / 0.2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.max(12, fs * 0.3)}px ${HEAD}`; ctx.fillStyle = P.edge;
    const sub = c.sub.split('').join(String.fromCharCode(8202)); ctx.fillText(sub, 0, bh * 0.3);
    ctx.restore();
  },
  scrSfx(fx, ctx, c, W, H) { // the sound-effect stamp
    const P = MOM[c.scene], pop = ease.back(clamp(c.t / 0.18)), a = ease.in(clamp((c.life - c.t) / 0.4)), fs = Math.max(34, Math.min(120, W * 0.09));
    if (a <= 0 || pop <= 0) return;
    const jx = (Math.sin(c.t * 70) * 3) * (1 - clamp(c.t / 0.5)), jy = (Math.cos(c.t * 63) * 3) * (1 - clamp(c.t / 0.5));
    ctx.save(); ctx.translate(W * c.fx + jx, H * c.fy + jy); ctx.rotate(c.rot); ctx.scale(pop, pop); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = KANA(fs);
    ctx.transform(1, 0, -0.12, 1, 0, 0); ctx.lineJoin = 'round';
    ctx.lineWidth = fs * 0.28; ctx.strokeStyle = P.ink; ctx.strokeText(c.str, 0, 0);
    ctx.lineWidth = fs * 0.12; ctx.strokeStyle = P.a; ctx.strokeText(c.str, 0, 0);
    ctx.fillStyle = '#ffffff'; ctx.fillText(c.str, 0, 0);
    ctx.restore();
  },
};
const PRE = new Set(['scrVig', 'scrBars', 'scrLines', 'scrKanji', 'scrFlash', 'scrFlare', 'scrShards']), TOP = new Set(['scrTitle', 'scrSfx']), GL = new Set(['scrVortex', 'scrBurst', 'scrSlash', 'scrBolt', 'scrFin']);
export const SCR_KINDS = SCR;
/** Reduce screen flashes: the ceiling for a full-screen flash layer. */
export const FLASH_CAP = 0.25;
/** Co-op: screen-space pieces (and shader reactions) only for your own effects; pieces without an owner are shared. */
export const mine = (fx, c) => c.pid === undefined || fx.localPid == null || c.pid === fx.localPid;
/** The local player's finisher letterbox is up (hud.js hides the stacked banners under it). */
export const momentOn = (fx) => vfxPref.cine && fx.cine.some((c) => c.kind === 'scrBars' && mine(fx, c));

/** Draw the screen-space pieces of one layer (-1: the glowing pieces, drawn before the shader so they bloom and swirl; 0: just above the world, under the HUD; 1: above the HUD). */
export function drawMomentScreen(fx, ctx, rend, layer) {
  if (!rend || !fx.cine.length || !vfxPref.cine) return; // (Ult cinematics off: no screen-space layers)
  const W = rend.w, H = rend.h, set = layer < 0 ? GL : layer ? TOP : PRE;
  let any = false; for (const c of fx.cine) if (set.has(c.kind) && mine(fx, c)) { any = true; break; }
  if (!any) return;
  ctx.save(); ctx.setTransform(rend.dpr || 1, 0, 0, rend.dpr || 1, 0, 0); // (the HUD may have scaled the context)
  // bars + vignette first so the rest sits above them
  for (const k of layer < 0 ? ['scrVortex', 'scrBurst', 'scrSlash', 'scrBolt', 'scrFin'] : layer ? ['scrTitle', 'scrSfx'] : ['scrVig', 'scrKanji', 'scrLines', 'scrShards', 'scrBars', 'scrFlare', 'scrFlash']) for (const c of fx.cine) if (c.kind === k && mine(fx, c)) { ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; SCR[k](fx, ctx, c, W, H, rend, fx.time || 0); }
  ctx.restore();
}

// ------------------------------------------------------------------ the heaven split (a post-process on the rendered world)
let tmp = null;
/** Cut the frame along the boss, slide the halves apart and pour light into the gap. Skipped on low-quality settings. */
export function momentSplitPost(fx, ctx, rend) {
  const c = fx.cine.find((q) => q.kind === 'momSplit' && mine(fx, q)); if (!c || lite(fx) || !vfxPref.cine) return;
  const cv = ctx.canvas, dpr = rend.dpr || 1, W = cv.width, H = cv.height;
  const open = ease.out(clamp(c.t / 0.14)) * (1 - ease.in(clamp((c.t - 0.55) / 0.85))); // snaps open, hangs, closes
  if (open <= 0.01) return;
  if (!tmp) tmp = document.createElement('canvas');
  if (tmp.width !== W || tmp.height !== H) { tmp.width = W; tmp.height = H; }
  const tc = tmp.getContext('2d'); tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, W, H); tc.drawImage(cv, 0, 0);
  const s = rend.worldToScreen(c.x, c.y), cx = Math.round(s.x * dpr), gap = Math.round(Math.min(W * 0.12, 150 * dpr) * open), tilt = 0.02 * open;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  // the light behind the cut
  const g = ctx.createLinearGradient(cx - gap, 0, cx + gap, 0); g.addColorStop(0, '#ffcf5a'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#ffcf5a');
  ctx.fillStyle = g; ctx.fillRect(cx - gap, 0, gap * 2, H);
  // left half and right half slide apart (clipped to their sides, sheared slightly so the cut looks torn)
  ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(cx - gap + H * tilt, 0); ctx.lineTo(cx - gap - H * tilt, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip();
  ctx.drawImage(tmp, -gap, 0); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.moveTo(cx + gap + H * tilt, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(cx + gap - H * tilt, H); ctx.closePath(); ctx.clip();
  ctx.drawImage(tmp, gap, 0); ctx.restore();
  // hot rims on both edges of the cut
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 3 * dpr * open;
  for (const sx of [-1, 1]) { ctx.globalAlpha = 0.9 * open; ctx.beginPath(); ctx.moveTo(cx + sx * gap + H * tilt, 0); ctx.lineTo(cx + sx * gap - H * tilt, H); ctx.stroke(); }
  ctx.restore();
}

// ------------------------------------------------------------------ generic 5-step finisher (every class except the three bespoke moments above)
const BESPOKE = new Set(['nidhoggs_fall', 'heaven_splitting_palm', 'final_chapter']);
/** The 5-step route finisher's moment: the vortex/slash/lightning/starburst stack, a title band, a sound-effect stamp, an optional ink kanji, a camera punch. */
export function momRoute(fx, ev, o) { // returns true when it played (the caller drops the older 5-step banner)
  if (BESPOKE.has(o.id)) return false;
  const cls = { ninja: 'bladedancer', paladin: 'cleric' }[o.cls] || o.cls, P = o.pal, scene = 'r_' + cls; MOM[scene] = MOM[scene] || { a: P.a, b: P.b, hi: P.hi, deep: P.deep, ink: P.ink, edge: P.edge };
  const R = o.route || {}, me = o.me, K = FIN_KEEP[cls] || { vortex: 0.6, burst: 1, slashes: 3, bolts: 0, shards: 1, flare: 1, lines: 1 };
  // the class's own centrepiece first, then only the generic layers that fit the class
  push(fx, { kind: 'scrFin', cls, scene, life: FIN_LIFE[cls] || 2, x: ev.x, y: ev.y, pid: ev.pid, seed: (Math.random() * 1e6) | 0 });
  if (K.vortex) push(fx, { kind: 'scrVortex', life: 1.55, x: ev.x, y: ev.y, scene, pid: ev.pid, amp: K.vortex });
  if (K.burst) push(fx, { kind: 'scrBurst', life: 1.3, x: ev.x, y: ev.y, scene, pid: ev.pid });
  if (K.flare) push(fx, { kind: 'scrFlare', life: 1.0, x: ev.x, y: ev.y, scene, pid: ev.pid });
  kick(fx, ev, 0.09);
  pixBurst(fx, ev.x, ev.y, 50, [P.hi, P.a, P.b, '#ffffff'], 600, { up: 1 });
  push(fx, { kind: 'momShock', life: 1.3, x: ev.x, y: ev.y, R: 420, col: P.a, pid: ev.pid });
  push(fx, { kind: 'scrFlash', life: 0.22, col: '#ffffff', col2: P.a, a: 0.55, pid: ev.pid });
  if (K.lines) push(fx, { kind: 'scrLines', life: 0.8, x: ev.x, y: ev.y, col: P.hi, n: 40, pid: ev.pid });
  if (R.kanji) push(fx, { kind: 'scrKanji', life: 2.1, ch: R.kanji, seal: R.seal || '終', scene, x: ev.x, y: ev.y, size: 0.72, pid: ev.pid });
  push(fx, { kind: 'scrTitle', life: 2.3, str: R.title || o.name.toUpperCase(), sub: R.sub || 'FINISHER', scene, pid: ev.pid });
  push(fx, { kind: 'scrSfx', life: 1.4, str: R.sfx || 'ドォォン', fx: R.fx ?? 0.74, fy: R.fy ?? 0.62, rot: R.rot ?? -0.1, scene, pid: ev.pid });
  flashMe(fx, me, '#ffffff', 0.2);
  fx.shake && fx.shake(me ? 1.2 : 0.25);
  return true;
}
