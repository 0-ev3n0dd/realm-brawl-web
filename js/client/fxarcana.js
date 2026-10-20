// Grimoire Summoner + Bard VFX (VFX overhaul quality bar): detailed procedural creature and music art drawn as cine entries.
// Summoner: fire sprites, a fire elemental, a segmented frost wyrm, a thunder roc, a phoenix with flame wings, kraken tentacles
// over an ink whirlpool, an open grimoire with flying pages. Bard: riff sound waves with staff lines, a golden hymn circle,
// a violet dissonance cone, the Crescendo build-up + shockwave, giant falling notes, a swinging bell, a tuning fork, a golden
// staff sweep and song auras. Server-only looks arrive as 'arcx' events; casts as 'arc'; Specials / 5-steps as 'spx'.
import { bloom, soft, mote, ribbon, ease, rgba } from './fxglow.js';
const TAU = Math.PI * 2;
import { momFin, momBookOpen, momChapter, momBookSlam } from './fxmoment.js'; // the Final Chapter signature moment
const rnd = (a, b) => a + Math.random() * (b - a);
const lite = (fx) => fx.partMul !== undefined && fx.partMul < 1;
const N = (fx, n) => Math.max(1, Math.round(n * (fx.partMul ?? 1)));
export const AC = {
  ink: '#3ff0c8', inkHi: '#e6fff8', inkD: '#0d3b44', fire: '#ff7a2c', fireHi: '#ffd27a', frost: '#9fe8ff', frostHi: '#f0fcff', storm: '#a99bff', volt: '#fff6a0',
  pink: '#ff7ab8', pinkHi: '#ffe0f0', gold: '#ffd86a', goldHi: '#fff6d0', violet: '#b48cff', violetD: '#3a1d5c',
};
export const SONG_COL = { valor: '#ff9a4a', haste: '#7af0ff', mending: '#7dff9a', requiem: '#b48cff' };
const KIND_COL = { sprite: AC.fire, fire: AC.fire, wyrm: AC.frost, roc: AC.storm, phoenix: '#ff9a3a', kraken: AC.ink };
const pl = (fx, id) => fx.sim && fx.sim.players && fx.sim.players.get(id);
const cine = (fx, o) => fx.cine.push({ t: 0, ...o });
function glow(fx, x, y, size, color, life = 0.3, a = 0.8) { if (!lite(fx) && Number.isFinite(x + y + size)) fx.add({ type: 'glow', x, y, size, color, life, a }); }
function motes(fx, x, y, n, color, shape, speed = 200, life = 0.8, size = 6, up = 40) {
  for (let i = 0; i < N(fx, n); i++) { const a = rnd(0, TAU), s = rnd(speed * 0.3, speed); fx.add({ type: lite(fx) ? 'dot' : 'mote', shape, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, drag: 0.9, life: rnd(life * 0.6, life), size: rnd(size * 0.6, size), color, rot: rnd(0, TAU), spin: rnd(-5, 5), grow: true }); }
}
function embers(fx, x, y, n, color, spread = 40, up = 220) { for (let i = 0; i < N(fx, n); i++) fx.add({ type: lite(fx) ? 'dot' : 'ember', x: x + rnd(-spread, spread), y: y + rnd(-spread * 0.5, spread * 0.5), vx: rnd(-40, 40), vy: -rnd(up * 0.4, up), drag: 0.95, life: rnd(0.45, 0.9), size: rnd(1.6, 3.2), color, seed: rnd(0, 9) }); }
function shock(fx, x, y, r, color, life = 0.4, w = 14) { fx.add({ type: 'shock', x, y, r0: r * 0.25, r1: r, life, color, width: w }); fx.add({ type: 'ring', x, y, r0: r * 0.2, r1: r * 0.95, life: life * 0.9, color, width: Math.max(3, w * 0.4) }); }
function flashMe(fx, me, col, a) { if (me) { fx.flash = Math.max(fx.flash || 0, a); fx.flashColor = col; } }
function burst(fx, x, y, r, col, hi, shape, big = 1) {
  glow(fx, x, y, r * 1.6 * big, col, 0.3, 0.6); fx.add({ type: 'flash', x, y, life: 0.1, size: r * 0.5, color: hi });
  shock(fx, x, y, r * 1.1, col, 0.35, 7 * big); motes(fx, x, y, 6 * big, hi, shape, 240 * big, 0.6, 6);
}

// ------------------------------------------------------------------ creature painters (local coords, facing +x)
function flame(ctx, s, t, outer, mid, core) { // a layered flickering tongue of fire, base at (0,0), pointing up
  const fl = Math.sin(t * 23) * 0.12, fl2 = Math.cos(t * 17) * 0.1;
  const tongue = (w, h, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.bezierCurveTo(-w * 1.1, -h * 0.45, -w * 0.3 + fl * w * 3, -h * 0.7, w * fl2 * 4, -h); ctx.bezierCurveTo(w * 0.4 + fl * w * 2, -h * 0.65, w * 1.15, -h * 0.4, w, 0); ctx.quadraticCurveTo(0, w * 0.8, -w, 0); ctx.fill(); };
  tongue(s * 0.6, s * 1.7, outer); tongue(s * 0.42, s * 1.25, mid); tongue(s * 0.24, s * 0.8, core);
}
function drawSprite(ctx, x, y, s, t, a) { // a little fire spirit: flame body, dark face, glowing eyes
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
  bloom(ctx, 0, -s * 0.5, s * 2.6, AC.fire, 0.7 * a);
  flame(ctx, s, t, 'rgba(255,90,30,.9)', '#ffb347', '#fff2c0');
  ctx.fillStyle = '#5a1a08'; ctx.beginPath(); ctx.ellipse(-s * 0.18, -s * 0.45, s * 0.1, s * 0.14, 0, 0, TAU); ctx.ellipse(s * 0.18, -s * 0.45, s * 0.1, s * 0.14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.arc(-s * 0.16, -s * 0.48, s * 0.04, 0, TAU); ctx.arc(s * 0.2, -s * 0.48, s * 0.04, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawElemental(ctx, x, y, s, t, a, slam) { // a big fire elemental: molten core torso, flame mane, rock shoulders, arms
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
  bloom(ctx, 0, -s * 1.1, s * 3.2, AC.fire, 0.6 * a);
  for (let i = -2; i <= 2; i++) { ctx.save(); ctx.translate(i * s * 0.28, -s * 1.5 + Math.abs(i) * s * 0.18); ctx.scale(0.7, 0.9); flame(ctx, s * 0.55, t + i, 'rgba(255,80,20,.85)', '#ffa040', '#fff0b0'); ctx.restore(); }
  const g = ctx.createRadialGradient(0, -s * 1.0, s * 0.1, 0, -s * 1.0, s * 0.9); g.addColorStop(0, '#fff6c8'); g.addColorStop(0.35, '#ff9a3a'); g.addColorStop(1, '#5a1608');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-s * 0.55, -s * 1.5); ctx.quadraticCurveTo(-s * 0.75, -s * 0.6, -s * 0.3, 0); ctx.lineTo(s * 0.3, 0); ctx.quadraticCurveTo(s * 0.75, -s * 0.6, s * 0.55, -s * 1.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2a0c06'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; // cracks of the rock crust
  ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 1.3); ctx.lineTo(-s * 0.2, -s * 0.9); ctx.lineTo(-s * 0.35, -s * 0.5); ctx.moveTo(s * 0.35, -s * 1.2); ctx.lineTo(s * 0.15, -s * 0.8); ctx.lineTo(s * 0.3, -s * 0.4); ctx.stroke();
  ctx.fillStyle = '#4a2418'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * s * 0.62, -s * 1.42, s * 0.3, s * 0.2, sx * 0.4, 0, TAU); ctx.fill(); }
  const arm = slam ? Math.min(1, t * 6) : 0.3 + 0.2 * Math.sin(t * 8); // arms raise, then smash down
  ctx.strokeStyle = '#ff8a3a'; ctx.lineCap = 'round'; ctx.lineWidth = s * 0.28;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * s * 0.62, -s * 1.4); ctx.quadraticCurveTo(sx * s * 1.1, -s * (1.8 - arm * 1.3), sx * s * 0.5, -s * (2.1 - arm * 2.0)); ctx.stroke(); bloom(ctx, sx * s * 0.5, -s * (2.1 - arm * 2.0), s * 0.6, '#fff0b0', a); }
  ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.ellipse(-s * 0.18, -s * 1.62, s * 0.1, s * 0.05, 0.3, 0, TAU); ctx.ellipse(s * 0.18, -s * 1.62, s * 0.1, s * 0.05, -0.3, 0, TAU); ctx.fill();
  bloom(ctx, 0, -s * 1.62, s * 0.5, '#fff0b0', 0.8 * a);
  ctx.restore();
}
function drawWyrm(ctx, pts, s, a, t) { // a segmented frost serpent along pts (tail first, head last): gradient scales, spines, horned head
  if (pts.length < 2) return;
  ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const n = pts.length;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 1; i < n; i++) { const k = i / n; ctx.globalAlpha = a * 0.35; ctx.strokeStyle = AC.frost; ctx.lineWidth = s * (0.4 + 0.9 * k) * 1.9; ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 1; i < n; i++) {
    const k = i / n, w = s * (0.4 + 0.9 * k);
    ctx.globalAlpha = a; ctx.strokeStyle = i % 2 ? '#5fb8e8' : '#7fd0f4'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    ctx.strokeStyle = AC.frostHi; ctx.lineWidth = w * 0.25; ctx.stroke(); // belly highlight
    if (i % 2 === 0) { const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], an = Math.atan2(dy, dx) - Math.PI / 2; ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.moveTo(pts[i][0] + Math.cos(an) * w * 0.4, pts[i][1] + Math.sin(an) * w * 0.4); ctx.lineTo(pts[i][0] + Math.cos(an) * w * 0.95 - dx * 0.3, pts[i][1] + Math.sin(an) * w * 0.95 - dy * 0.3); ctx.lineTo(pts[i][0] + Math.cos(an) * w * 0.4 - dx * 0.5, pts[i][1] + Math.sin(an) * w * 0.4 - dy * 0.5); ctx.fill(); }
  }
  const h = pts[n - 1], p = pts[n - 2], ang = Math.atan2(h[1] - p[1], h[0] - p[0]);
  ctx.translate(h[0], h[1]); ctx.rotate(ang);
  const g = ctx.createLinearGradient(-s, 0, s * 1.4, 0); g.addColorStop(0, '#5fb8e8'); g.addColorStop(1, '#e8fbff');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-s * 0.6, -s * 0.7); ctx.quadraticCurveTo(s * 0.6, -s * 0.8, s * 1.5, -s * 0.15); ctx.lineTo(s * 1.5, s * 0.15); ctx.quadraticCurveTo(s * 0.6, s * 0.8, -s * 0.6, s * 0.7); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; for (const sy of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-s * 0.2, sy * s * 0.55); ctx.quadraticCurveTo(-s * 0.9, sy * s * 1.2, -s * 1.3, sy * s * 1.0); ctx.stroke(); }
  ctx.fillStyle = '#0a2a4a'; ctx.beginPath(); ctx.arc(s * 0.5, -s * 0.32, s * 0.12, 0, TAU); ctx.arc(s * 0.5, s * 0.32, s * 0.12, 0, TAU); ctx.fill();
  bloom(ctx, s * 0.5, -s * 0.32, s * 0.35, '#bff6ff', a); bloom(ctx, s * 0.5, s * 0.32, s * 0.35, '#bff6ff', a);
  ctx.restore();
}
function drawBird(ctx, x, y, ang, s, flap, body, wing, hi, a) { // a winged bird (roc / phoenix): layered wing feathers, tail, beak
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = a;
  bloom(ctx, 0, 0, s * 2.6, wing, 0.55 * a);
  for (const sy of [-1, 1]) {
    const up = Math.sin(flap) * 0.9;
    for (let f = 0; f < 4; f++) { // feathers fan out along the wing
      const L = s * (1.9 - f * 0.25), spread = (0.5 + f * 0.28) * sy, ex = -s * 0.2 - Math.cos(spread + up * sy * 0.3) * L * 0.35, ey = Math.sin(spread) * L * (0.85 + up * 0.3);
      ctx.fillStyle = f % 2 ? wing : hi; ctx.globalAlpha = a * (0.95 - f * 0.12);
      ctx.beginPath(); ctx.moveTo(s * 0.2, sy * s * 0.15); ctx.quadraticCurveTo(ex * 0.3 + s * 0.4, ey * 0.7, ex, ey); ctx.quadraticCurveTo(ex * 0.5 - s * 0.2, ey * 0.4, -s * 0.4, sy * s * 0.2); ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalAlpha = a; ctx.fillStyle = wing; // tail plumes
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.4, 0); ctx.quadraticCurveTo(-s * 1.2, i * s * 0.4, -s * 1.8, i * s * 0.55); ctx.quadraticCurveTo(-s * 1.1, i * s * 0.15, -s * 0.4, 0); ctx.fill(); }
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.75, s * 0.32, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.72, 0, s * 0.26, 0, TAU); ctx.fill();
  ctx.fillStyle = hi; ctx.beginPath(); ctx.moveTo(s * 0.92, -s * 0.08); ctx.lineTo(s * 1.25, 0); ctx.lineTo(s * 0.92, s * 0.08); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(s * 0.8, -s * 0.1, s * 0.06, 0, TAU); ctx.fill();
  ctx.restore();
}
function tentacle(ctx, x, y, h, bend, w, t, a, col = '#2a6f78') { // a kraken tentacle rising from (x,y): tapered, curling tip, sucker dots
  const pts = []; for (let i = 0; i <= 10; i++) { const k = i / 10; pts.push([x + Math.sin(k * 2.6 + t * 4 + bend) * w * 1.6 * k + bend * k * k * w * 2, y - h * k]); }
  ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
  for (let i = 1; i < pts.length; i++) { const k = i / pts.length, lw = w * (1 - k * 0.85); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); ctx.strokeStyle = '#6fe0d0'; ctx.lineWidth = lw * 0.25; ctx.stroke(); }
  ctx.fillStyle = '#d8fff6'; for (let i = 2; i < pts.length - 2; i += 2) { const k = i / pts.length; ctx.beginPath(); ctx.arc(pts[i][0] + w * 0.25 * (1 - k), pts[i][1], w * 0.12 * (1 - k) + 1, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function whirl(ctx, x, y, r, t, a) { // an ink whirlpool on the ground: dark disc + glowing spiral arms
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.5); ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(2,10,16,.95)'); g.addColorStop(0.6, 'rgba(10,50,60,.7)'); g.addColorStop(1, 'rgba(10,50,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = AC.ink; ctx.lineCap = 'round';
  for (let arm = 0; arm < 4; arm++) { ctx.lineWidth = 3; ctx.globalAlpha = a * 0.7; ctx.beginPath(); for (let i = 0; i <= 24; i++) { const k = i / 24, ang = arm * TAU / 4 + t * 3 + k * 5, rr = r * (0.1 + 0.85 * k); if (i) ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); else ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } ctx.stroke(); }
  ctx.restore();
}
export function drawBook(ctx, x, y, s, open, t, a, glowCol = AC.ink) { // an open grimoire: leather cover, curved pages, glowing runes, a fluttering page
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
  bloom(ctx, 0, -s * 0.3, s * 2.4, glowCol, 0.6 * a);
  const o = open * 0.9;
  ctx.fillStyle = '#3a1f4a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * 1.1, -s * 0.15 - s * o * 0.2); ctx.lineTo(-s * 1.1, -s * 0.85 - s * o * 0.2); ctx.lineTo(0, -s * 0.7); ctx.lineTo(s * 1.1, -s * 0.85 - s * o * 0.2); ctx.lineTo(s * 1.1, -s * 0.15 - s * o * 0.2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = AC.gold; ctx.lineWidth = 2; ctx.stroke();
  for (const sx of [-1, 1]) { const g = ctx.createLinearGradient(0, 0, sx * s, 0); g.addColorStop(0, '#d8cfb4'); g.addColorStop(1, '#fff8e6'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -s * 0.08); ctx.quadraticCurveTo(sx * s * 0.5, -s * 0.2 - s * o * 0.25, sx * s, -s * 0.22 - s * o * 0.18); ctx.lineTo(sx * s, -s * 0.78 - s * o * 0.18); ctx.quadraticCurveTo(sx * s * 0.5, -s * 0.76 - s * o * 0.25, 0, -s * 0.66); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = glowCol; ctx.lineWidth = 1.6; ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(t * 12)); // rune lines
  for (const sx of [-1, 1]) for (let l = 0; l < 4; l++) { const yy = -s * (0.32 + l * 0.11) - s * o * 0.1; ctx.beginPath(); ctx.moveTo(sx * s * 0.15, yy); ctx.lineTo(sx * s * (0.4 + (l % 2) * 0.2), yy - s * 0.02); ctx.lineTo(sx * s * 0.8, yy); ctx.stroke(); }
  ctx.globalAlpha = a; const fp = (t * 2.2) % 1, fa = Math.PI * fp; // a page turning over
  ctx.fillStyle = 'rgba(255,250,235,.9)'; ctx.beginPath(); ctx.moveTo(0, -s * 0.08); ctx.lineTo(Math.cos(fa) * s * 0.95, -s * 0.2 - Math.sin(fa) * s * 0.5); ctx.lineTo(Math.cos(fa) * s * 0.95, -s * 0.76 - Math.sin(fa) * s * 0.5); ctx.lineTo(0, -s * 0.66); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawStaff(ctx, x, y, R, a0, a1, a, col, w = 22) { // five glowing staff lines along an arc (the Bard's music staff)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const rr = R - w + i * (w / 2); if (rr <= 0) continue; ctx.globalAlpha = a * (i === 2 ? 0.95 : 0.6); ctx.strokeStyle = i === 2 ? '#ffffff' : col; ctx.lineWidth = i === 2 ? 2.2 : 1.6; ctx.beginPath(); ctx.arc(x, y, rr, a0, a1); ctx.stroke(); }
  ctx.restore();
}
function drawBell(ctx, x, y, s, swing, a) { // a golden bell: gradient body, rim, clapper
  ctx.save(); ctx.translate(x, y); ctx.rotate(swing); ctx.globalAlpha = a;
  bloom(ctx, 0, s * 0.5, s * 2.2, AC.gold, 0.6 * a);
  const g = ctx.createLinearGradient(-s, 0, s, 0); g.addColorStop(0, '#8a5a12'); g.addColorStop(0.35, '#ffe08a'); g.addColorStop(0.6, '#ffc94a'); g.addColorStop(1, '#7a4a0a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-s * 0.25, 0); ctx.quadraticCurveTo(-s * 0.55, s * 0.1, -s * 0.6, s * 0.7); ctx.quadraticCurveTo(-s * 0.7, s * 0.95, -s * 0.95, s * 1.05); ctx.lineTo(s * 0.95, s * 1.05); ctx.quadraticCurveTo(s * 0.7, s * 0.95, s * 0.6, s * 0.7); ctx.quadraticCurveTo(s * 0.55, s * 0.1, s * 0.25, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff2c0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, s * 1.05, s * 0.95, s * 0.14, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#5a3a08'; ctx.beginPath(); ctx.arc(Math.sin(-swing * 2) * s * 0.3, s * 1.1, s * 0.13, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(0, -s * 0.08, s * 0.14, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawNote(ctx, x, y, s, rot, col, a) { // a big glossy eighth note
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = a;
  bloom(ctx, 0, 0, s * 2.2, col, 0.7 * a);
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(-s * 0.28, s * 0.55, s * 0.45, s * 0.32, -0.4, 0, TAU); ctx.fill();
  ctx.fillRect(s * 0.08, -s * 0.95, s * 0.12, s * 1.5);
  ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.95); ctx.quadraticCurveTo(s * 0.85, -s * 0.6, s * 0.65, -s * 0.05); ctx.quadraticCurveTo(s * 0.6, -s * 0.45, s * 0.2, -s * 0.55); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(-s * 0.38, s * 0.47, s * 0.14, s * 0.07, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawFork(ctx, x, y, s, t, a) { // a vibrating tuning fork
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a; const v = Math.sin(t * 90) * s * 0.04;
  bloom(ctx, 0, -s * 0.6, s * 1.8, AC.pink, 0.6 * a);
  ctx.strokeStyle = '#e8eef8'; ctx.lineCap = 'round'; ctx.lineWidth = s * 0.12;
  ctx.beginPath(); ctx.moveTo(0, s * 0.5); ctx.lineTo(0, -s * 0.15); ctx.moveTo(-s * 0.22 - v, -s * 1.2); ctx.lineTo(-s * 0.22, -s * 0.25); ctx.quadraticCurveTo(0, -s * 0.02, s * 0.22, -s * 0.25); ctx.lineTo(s * 0.22 + v, -s * 1.2); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * 0.03; ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ cine entries (on top of the actors)
export const ARC_CINE = {
  arSprite(fx, ctx, c, time) { // a fire sprite flies to its target and bursts
    const k = Math.min(1, c.t / c.fly), e = ease.inOut(k), x = c.fx + (c.x - c.fx) * e, y = c.fy + (c.y - c.fy) * e - Math.sin(k * Math.PI) * 50;
    if (k < 1) { if (!lite(fx) && Math.random() < 0.6) fx.add({ type: 'ember', x, y: y - 6, vx: rnd(-30, 30), vy: rnd(-80, -20), drag: 0.95, life: 0.4, size: 2.2, color: AC.fire, seed: rnd(0, 9) }); drawSprite(ctx, x, y + 8, c.s, time + c.seed, 1); }
    else if (!c.done) { c.done = 1; burst(fx, c.x, c.y, c.r, AC.fire, AC.fireHi, 'diamond', c.big || 1); embers(fx, c.x, c.y, 8, AC.fire, c.r * 0.4, 260); }
  },
  arElemental(fx, ctx, c, time) { const k = c.t / c.life, a = Math.min(1, c.t / 0.08) * (1 - ease.in(k)); drawElemental(ctx, c.x, c.y + 20, c.s * (0.8 + 0.2 * ease.back(Math.min(1, c.t / 0.15))), c.t, a, c.slam); },
  arWyrm(fx, ctx, c, time) { // the frost wyrm coils out of the ground behind the caster and breathes along the cone
    const k = c.t / c.life, a = Math.min(1, c.t / 0.1) * (1 - ease.in(Math.max(0, (k - 0.6) / 0.4)));
    const pts = [], bx = c.x + Math.cos(c.ang) * 24, by = c.y + Math.sin(c.ang) * 24 - 58, rise = ease.out(Math.min(1, c.t / 0.25));
    for (let i = 0; i < 12; i++) { const q = i / 11, d = (q - 1) * 140 * rise; pts.push([bx + Math.cos(c.ang) * d + Math.cos(c.ang + Math.PI / 2) * Math.sin(q * 6 + time * 6) * 26, by + Math.sin(c.ang) * d + Math.sin(c.ang + Math.PI / 2) * Math.sin(q * 6 + time * 6) * 26 - q * 30]); }
    drawWyrm(ctx, pts, c.s, a, time);
  },
  arRoc(fx, ctx, c, time) { // the thunder roc flies the line, lightning trailing behind
    const k = Math.min(1, c.t / c.T), x = c.x + Math.cos(c.ang) * c.len * ease.inOut(k), y = c.y + Math.sin(c.ang) * c.len * ease.inOut(k) - 90;
    c.trail = c.trail || []; c.trail.push([x, y]); if (c.trail.length > 14) c.trail.shift();
    if (!lite(fx)) ribbon(ctx, c.trail, 10, AC.storm, Math.min(1, (c.life - c.t) * 3), AC.volt);
    drawBird(ctx, x, y, c.ang, 44 * (c.emp ? 1.25 : 1), time * 14, '#3a3070', AC.storm, AC.volt, Math.min(1, (c.life - c.t) * 4));
  },
  arPhoenix(fx, ctx, c, time) { // the phoenix sweeps the line, wings of fire, a fire ribbon in its wake
    const k = Math.min(1, c.t / c.T), d = c.len * ease.inOut(k), x = c.x + Math.cos(c.ang) * d, y = c.y + Math.sin(c.ang) * d - 30;
    c.trail = c.trail || []; c.trail.push([x, y]); if (c.trail.length > 18) c.trail.shift();
    if (!lite(fx)) { ribbon(ctx, c.trail, c.w * 0.25, '#ff6a20', Math.min(1, (c.life - c.t) * 3), '#fff2c0'); if (Math.random() < 0.8) embers(fx, x, y, 2, AC.fire, 20, 120); }
    drawBird(ctx, x, y, c.ang, c.s, time * 12, '#ffb347', '#ff5a1e', '#fff2a0', Math.min(1, (c.life - c.t) * 4));
  },
  arKraken(fx, ctx, c, time) { // tentacles burst up around the point and squeeze in
    const k = c.t / c.life, a = Math.min(1, c.t / 0.12) * (1 - ease.in(Math.max(0, (k - 0.7) / 0.3))), rise = ease.back(Math.min(1, c.t / 0.25));
    for (let i = 0; i < c.n; i++) { const g = c.seed + i * TAU / c.n, R = c.r * (c.crush ? 1 - 0.5 * ease.inOut(Math.min(1, c.t / 0.35)) : 0.9); tentacle(ctx, c.x + Math.cos(g) * R, c.y + Math.sin(g) * R * 0.5, c.h * rise, Math.cos(g) < 0 ? 1 : -1, c.w, time + i, a); }
  },
  arBook(fx, ctx, c, time) { const k = c.t / c.life, a = Math.min(1, c.t / 0.1) * (1 - ease.in(k)); const p = pl(fx, c.pid); drawBook(ctx, (p ? p.x : c.x), (p ? p.y : c.y) - 52 - 10 * ease.out(Math.min(1, c.t / 0.2)), c.s, ease.out(Math.min(1, c.t / 0.25)), time, a, c.col); },
  arBookSlam(fx, ctx, c, time) { // a giant book falls closed onto the point
    const k = Math.min(1, c.t / 0.3), y = c.y - 260 * (1 - ease.in(k)), a = 1 - ease.in(Math.max(0, (c.t - 0.3) / (c.life - 0.3)));
    drawBook(ctx, c.x, y, c.s, 1 - k, time, a, AC.ink);
    if (k >= 1 && !c.done) { c.done = 1; burst(fx, c.x, c.y, c.r, AC.ink, AC.inkHi, 'page', 1.6); fx.add({ type: 'crack', x: c.x, y: c.y, r: c.r, life: 1.2, seed: rnd(0, TAU), glow: true, col: AC.ink, n: 8 }); fx.shake(0.5); }
  },
  arWave(fx, ctx, c, time) { // the Bard's riff: sound-wave arcs travel the line on a music staff
    const k = c.t / c.life, a = 1 - ease.in(k), L = c.len * ease.out(Math.min(1, c.t / 0.22));
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.ang); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) { const yy = (i - 2) * c.w * 0.13; ctx.globalAlpha = a * (i === 2 ? 0.8 : 0.45); ctx.strokeStyle = i === 2 ? '#ffffff' : c.col; ctx.lineWidth = i === 2 ? 2 : 1.4; ctx.beginPath(); for (let s = 0; s <= 24; s++) { const xx = (s / 24) * L; ctx.lineTo(xx, yy + Math.sin(xx * 0.05 - time * 20) * 4); } ctx.stroke(); }
    for (let j = 0; j < 4; j++) { const xx = ((c.t * 900 + j * c.len / 4) % L); ctx.globalAlpha = a * 0.9; ctx.strokeStyle = c.col; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(xx - c.w * 0.4, 0, c.w * 0.5, -0.7, 0.7); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.restore();
  },
  arCone(fx, ctx, c, time) { // dissonance: a jagged violet cone of distorted sound
    const k = c.t / c.life, a = 1 - ease.in(k), R = c.r * ease.out(Math.min(1, c.t / 0.18));
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.ang);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, rgba(AC.violet, 0.0)); g.addColorStop(0.5, rgba(AC.violet, 0.35 * a)); g.addColorStop(1, rgba(AC.violetD, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -c.arc / 2, c.arc / 2); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
    for (let w = 0; w < 4; w++) { const rr = R * (0.3 + w * 0.22) * (0.9 + 0.1 * Math.sin(time * 30 + w)); ctx.globalAlpha = a * 0.8; ctx.strokeStyle = w % 2 ? '#ffffff' : AC.violet; ctx.lineWidth = w % 2 ? 1.5 : 4; ctx.beginPath(); for (let s = 0; s <= 12; s++) { const g2 = -c.arc / 2 + (s / 12) * c.arc, j = Math.sin(s * 1.9 + time * 28 + w) * 6; ctx.lineTo(Math.cos(g2) * Math.max(0, rr + j), Math.sin(g2) * Math.max(0, rr + j)); } ctx.stroke(); }
    ctx.restore();
  },
  arCharge(fx, ctx, c, time) { // Crescendo build-up: staff rings converge on the bard, notes spiral in
    const p = pl(fx, c.pid), x = p ? p.x : c.x, y = p ? p.y : c.y, k = Math.min(1, c.t / c.life);
    for (let i = 0; i < 3; i++) { const q = ((k * 1.6 + i / 3) % 1), R = c.r * (1 - ease.in(q)); drawStaff(ctx, x, y, R, 0, TAU, (1 - q) * 0.8, c.col, 18); }
    for (let i = 0; i < 6; i++) { const g = time * 5 + i * TAU / 6, R = c.r * 0.7 * (1 - k); mote(ctx, x + Math.cos(g) * R, y + Math.sin(g) * R * 0.6 - 20, 'note', 9, 0, i % 2 ? AC.gold : c.col, 0.9, !lite(fx)); }
    bloom(ctx, x, y - 10, 60 + 60 * k, c.col, 0.3 + 0.3 * k);
  },
  arBigNote(fx, ctx, c, time) { // a giant note drops from the sky and smashes
    const k = Math.min(1, c.t / 0.22), y = c.y - 300 * (1 - ease.in(k));
    if (k < 1) drawNote(ctx, c.x, y, c.s, Math.sin(c.t * 10) * 0.2, c.col, 1);
    else { if (!c.done) { c.done = 1; burst(fx, c.x, c.y, c.r, c.col, AC.goldHi, 'note', 1.2); } drawNote(ctx, c.x, c.y - 10, c.s * (1 + (c.t - 0.22) * 2), 0, c.col, Math.max(0, 1 - (c.t - 0.22) / (c.life - 0.22))); }
  },
  arBell(fx, ctx, c, time) { const k = c.t / c.life, a = Math.min(1, c.t / 0.1) * (1 - ease.in(k)); drawBell(ctx, c.x, c.y - c.s * 2.4, c.s, Math.sin(c.t * 14) * 0.45 * (1 - k), a); },
  arFork(fx, ctx, c, time) { const k = c.t / c.life; drawFork(ctx, c.x, c.y - 30, c.s, time, Math.min(1, c.t / 0.08) * (1 - ease.in(k))); },
  arStaffSweep(fx, ctx, c, time) { // a golden music staff swept around the bard
    const k = c.t / c.life, sw = ease.out(Math.min(1, c.t / 0.25)), p = pl(fx, c.pid), x = p ? p.x : c.x, y = p ? p.y : c.y;
    drawStaff(ctx, x, y, c.r, c.ang - c.arc / 2, c.ang - c.arc / 2 + c.arc * sw, 1 - ease.in(k), AC.gold, 28);
    for (let i = 0; i < 4; i++) { const g = c.ang - c.arc / 2 + c.arc * sw * (i + 0.5) / 4; mote(ctx, x + Math.cos(g) * c.r, y + Math.sin(g) * c.r, 'note', 10, 0, AC.goldHi, 1 - ease.in(k), !lite(fx)); }
  },
  arEcho(fx, ctx, c, time) { // a note hops from enemy to enemy (Echo)
    const k = Math.min(1, c.t / 0.14), x = c.fx + (c.x - c.fx) * ease.out(k), y = c.fy + (c.y - c.fy) * ease.out(k) - Math.sin(k * Math.PI) * 40;
    c.trail = c.trail || []; c.trail.push([x, y]); if (c.trail.length > 8) c.trail.shift();
    const a = 1 - ease.in(c.t / c.life);
    if (!lite(fx)) ribbon(ctx, c.trail, 5, AC.pink, a, '#ffffff');
    mote(ctx, x, y, 'note', 11, 0, AC.pinkHi, a, !lite(fx));
  },
  arSong(fx, ctx, c, time) { // a song wave: a staff ring expanding from the bard with the song's colour
    const k = c.t / c.life, R = c.r * ease.out(k);
    drawStaff(ctx, c.x, c.y, R, 0, TAU, (1 - k) * 0.85, c.col, 16);
  },
};
// ------------------------------------------------------------------ ground layer (under the actors)
export const ARC_UNDER = {
  arWhirl(fx, ctx, c, time) { const k = c.t / c.life, a = Math.min(1, c.t / 0.15) * (1 - ease.in(Math.max(0, (k - 0.6) / 0.4))); whirl(ctx, c.x, c.y, c.r * (0.6 + 0.4 * ease.out(Math.min(1, c.t / 0.3))), time, a); },
  arStorm(fx, ctx, c, time) { // a dark storm-cloud shadow with frost glints
    const k = c.t / c.life, a = Math.min(1, c.t / 0.2) * (1 - ease.in(k));
    ctx.save(); ctx.globalAlpha = a * 0.45; ctx.translate(c.x, c.y); ctx.scale(1, 0.5); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, c.r); g.addColorStop(0, 'rgba(30,24,70,.9)'); g.addColorStop(1, 'rgba(30,24,70,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, c.r, 0, TAU); ctx.fill(); ctx.restore();
  },
  arHymn(fx, ctx, c, time) { // a golden hymn circle on the ground with a cross and rotating notes
    const k = c.t / c.life, a = Math.min(1, c.t / 0.12) * (1 - ease.in(k)), R = c.r * ease.out(Math.min(1, c.t / 0.25));
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.45);
    bloom(ctx, 0, 0, R * 1.2, AC.gold, 0.35 * a);
    drawStaff(ctx, 0, 0, R, 0, TAU, a, AC.gold, 20);
    ctx.restore();
  },
};

// ------------------------------------------------------------------ song auras on heroes (render.js)
/** Soft coloured halos + orbiting notes for every active song on a hero. */
export function drawSongAura(ctx, p, time, liteMode) {
  const S = p.songs; if (!S) return;
  let i = 0;
  for (const k of ['valor', 'haste', 'mending', 'requiem']) {
    const s = S[k]; if (!s || !(s.t > 0)) continue;
    const col = SONG_COL[k], R = (p.r || 18) + 14 + i * 5;
    if (!liteMode) bloom(ctx, p.x, p.y + 4, R * 1.4, col, 0.18);
    ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(p.x, p.y + 12, R, R * 0.38, 0, 0, TAU); ctx.stroke(); ctx.restore();
    const g = time * (1.6 + i * 0.3) + i * 1.7;
    mote(ctx, p.x + Math.cos(g) * R, p.y + 12 + Math.sin(g) * R * 0.38 - 10, 'note', 5.5, 0, col, 0.9, !liteMode);
    i++;
  }
}

// ------------------------------------------------------------------ event handler
function hitLook(fx, ev, me) {
  const { x, y } = ev, r = ev.r || 100, ang = ev.ang || 0, L = ev.look, emp = ev.emp ? 1.25 : 1;
  switch (L) {
    case 'sprite': case 'auto':
      if (L === 'auto' && ev.kind && ev.kind !== 'sprite') return hitLook(fx, { ...ev, look: ev.kind === 'wyrm' ? 'breathpuff' : ev.kind === 'roc' ? 'bolt' : ev.kind === 'phoenix' ? 'phoenixpuff' : 'kraken' }, me);
      cine(fx, { kind: 'arSprite', life: 0.6, fly: 0.16, fx: ev.fx ?? x - 60, fy: ev.fy ?? y - 40, x, y, s: 14 * emp, r, seed: rnd(0, 9) }); return;
    case 'elemental': case 'elementalslam': {
      if (!fx.cine.some((c) => c.kind === 'arElemental' && c.pid === ev.pid && c.t < c.life - 0.15)) cine(fx, { kind: 'arElemental', life: 0.75, x, y, s: 46 * emp, pid: ev.pid });
      if (L === 'elementalslam') { const c = fx.cine.find((q) => q.kind === 'arElemental' && q.pid === ev.pid); if (c) { c.slam = 1; c.t = 0; c.life = 0.55; } burst(fx, x, y, r, AC.fire, AC.fireHi, 'diamond', 1.5); fx.add({ type: 'crack', x, y, r, life: 1.2, seed: rnd(0, TAU), glow: true, col: '#ff7a2c', n: 7 }); embers(fx, x, y, 18, AC.fire, r * 0.5, 320); fx.shake(0.35); }
      else { fx.sparks(x, y, rnd(0, TAU), N(fx, 6), AC.fireHi, 360, 1.6); glow(fx, x, y, r * 1.4, AC.fire, 0.2, 0.6); }
      return;
    }
    case 'breath': case 'breathpuff': {
      if (L === 'breath' && ev.i === 0 && ev.arc) cine(fx, { kind: 'arWyrm', life: 0.9, x, y, ang, s: 18 * emp });
      const R = ev.arc ? r : 70, ar = ev.arc || 1.2, base = L === 'breath' ? ang : rnd(0, TAU);
      for (let i = 0; i < N(fx, L === 'breath' ? 9 : 5); i++) { const g = base + rnd(-ar / 2, ar / 2), s = rnd(R * 1.2, R * 2.4); fx.add({ type: lite(fx) ? 'puff' : 'mote', shape: i % 3 ? 'snow' : 'diamond', x: x + (L === 'breath' ? Math.cos(base) * 30 : 0), y: y + (L === 'breath' ? Math.sin(base) * 30 : 0), vx: Math.cos(g) * s, vy: Math.sin(g) * s, drag: 0.88, life: rnd(0.4, 0.7), size: rnd(5, 10), color: i % 2 ? AC.frost : AC.frostHi, rot: rnd(0, TAU), spin: rnd(-4, 4), grow: true }); }
      fx.puffs(x + Math.cos(base) * R * 0.5, y + Math.sin(base) * R * 0.5, N(fx, 4), 'rgba(190,240,255,.5)', 24, 160, 0.6);
      return;
    }
    case 'bolt': {
      const pts = [[x + rnd(-30, 30), y - 520]]; for (let i = 1; i < 7; i++) pts.push([x + rnd(-26, 26) * (1 - i / 7), y - 520 + i * (520 / 7)]); pts.push([x, y]);
      fx.add({ type: 'bolt', pts, life: 0.22, color: AC.storm, width: 7 * emp, jit: 7 });
      burst(fx, x, y, r, AC.storm, AC.volt, 'star4', emp); if (ev.emp) fx.add({ type: 'pillar', x, y, size: 34, h: 520, life: 0.18, color: AC.storm });
      return;
    }
    case 'phoenix': case 'phoenixpuff':
      if (L === 'phoenix' && ev.len && (ev.i || 0) === 0) cine(fx, { kind: 'arPhoenix', life: 0.6, T: 0.42, x, y, ang, len: ev.len, w: ev.w || 150, s: 52 });
      embers(fx, x + Math.cos(ang) * (ev.len || 0) * 0.5, y + Math.sin(ang) * (ev.len || 0) * 0.5, 10, AC.fire, 80, 260); return;
    case 'kraken': case 'krakencrush': case 'chapterpull':
      if (L === 'chapterpull') momBookOpen(fx, ev);
      if (L !== 'kraken' || !fx.cine.some((c) => c.kind === 'arKraken' && Math.hypot(c.x - x, c.y - y) < 60 && c.t < c.life - 0.2)) {
        cine(fx, { kind: 'arWhirl', life: L === 'kraken' ? 0.9 : 1.2, x, y, r: r * 1.3 });
        cine(fx, { kind: 'arKraken', life: L === 'kraken' ? 0.8 : 0.9, x, y, r: r * 0.9, n: L === 'krakencrush' ? 8 : 5, h: r * 1.3, w: 16 + r * 0.06, seed: rnd(0, TAU), crush: L !== 'kraken' });
      }
      if (L === 'krakencrush') { burst(fx, x, y, r, AC.ink, AC.inkHi, 'diamond', 1.6); fx.shake(0.4); flashMe(fx, me, AC.inkD, 0.3); }
      else fx.puffs(x, y, N(fx, 4), 'rgba(10,60,70,.7)', 20, 140, 0.5);
      return;
    case 'page': cine(fx, { kind: 'arBook', life: 0.7, x, y, s: 34, pid: ev.pid, col: AC.ink }); burst(fx, x, y, r, AC.ink, AC.inkHi, 'page', 1.2); motes(fx, x, y - 30, 14, '#fff8e6', 'page', 320, 1.0, 8, 60); return;
    case 'unbound': cine(fx, { kind: 'arBook', life: 1.2, x, y, s: 60, pid: ev.pid, col: AC.ink }); burst(fx, x, y, r, AC.ink, AC.inkHi, 'page', 2); cine(fx, { kind: 'arWhirl', life: 1.0, x, y, r }); motes(fx, x, y - 30, 26, '#fff8e6', 'page', 420, 1.2, 9, 80); fx.shake(0.6); flashMe(fx, me, AC.ink, 0.35); return;
    case 'lastpage': case 'bookslam': if (L === 'bookslam' && momBookSlam(fx, ev, me)) return; cine(fx, { kind: 'arBookSlam', life: 0.9, x, y, s: L === 'bookslam' ? 110 : 80, r }); motes(fx, x, y - 40, 20, '#fff8e6', 'page', 380, 1.1, 9, 60); return;
    case 'stampede': case 'chapterhit': {
      if (L === 'chapterhit') momChapter(fx, ev, me);
      const k = ev.kind || 'sprite', fx0 = ev.fx ?? x - 300, fy0 = ev.fy ?? y - 60;
      if (k === 'wyrm') { cine(fx, { kind: 'arWyrm', life: 0.7, x: fx0, y: fy0, ang: Math.atan2(y - fy0, x - fx0), s: 16 }); hitLook(fx, { ...ev, look: 'breathpuff' }, me); }
      else if (k === 'roc') { cine(fx, { kind: 'arRoc', life: 0.45, T: 0.3, x: fx0, y: fy0 + 90, ang: Math.atan2(y - fy0, x - fx0), len: Math.hypot(x - fx0, y - fy0) }); hitLook(fx, { ...ev, look: 'bolt' }, me); }
      else if (k === 'kraken') hitLook(fx, { ...ev, look: 'kraken' }, me);
      else if (k === 'phoenix') { cine(fx, { kind: 'arPhoenix', life: 0.5, T: 0.32, x: fx0, y: fy0, ang: Math.atan2(y - fy0, x - fx0), len: Math.hypot(x - fx0, y - fy0), w: 100, s: 40 }); burst(fx, x, y, r, AC.fire, AC.fireHi, 'feather', 1.2); }
      else cine(fx, { kind: 'arSprite', life: 0.55, fly: 0.2, fx: fx0, fy: fy0, x, y, s: 20, r, seed: rnd(0, 9), big: 1.3 });
      return;
    }
    case 'rebirth': // the phoenix is reborn: a pillar of fire, a huge wing-shaped burst, feathers
      cine(fx, { kind: 'arPhoenix', life: 0.7, T: 0.5, x, y: y + 60, ang: -Math.PI / 2, len: 260, w: 200, s: 90 });
      burst(fx, x, y, r, AC.fire, AC.fireHi, 'feather', 2.2); fx.add({ type: 'pillar', x, y, size: 160, h: 700, life: 0.6, color: '#ff7a2c' });
      embers(fx, x, y, 40, AC.fire, r * 0.6, 420); fx.shake(0.8); flashMe(fx, me, '#ffb347', 0.5); return;
    // ---- Bard
    case 'riff': cine(fx, { kind: 'arWave', life: 0.45, x, y, ang, len: ev.len || 420, w: ev.w || 90, col: AC.pink }); motes(fx, x + Math.cos(ang) * 80, y + Math.sin(ang) * 80, 6, AC.pinkHi, 'note', 220, 0.8, 7, 60); return;
    case 'hymn': cine(fx, { kind: 'arHymn', life: 0.9, x, y, r: ev.hr || r }); burst(fx, x, y, r, AC.gold, AC.goldHi, 'note', 1); for (let i = 0; i < N(fx, 10); i++) fx.add({ type: 'plus', x: x + rnd(-r * 0.6, r * 0.6), y: y + rnd(-r * 0.3, r * 0.3), vx: 0, vy: rnd(-120, -60), life: rnd(0.6, 1), size: rnd(5, 8), color: '#bfffc8', drag: 0.97 }); return;
    case 'disso': cine(fx, { kind: 'arCone', life: 0.5, x, y, ang, arc: ev.arc || 1.4, r }); motes(fx, x + Math.cos(ang) * r * 0.5, y + Math.sin(ang) * r * 0.5, 8, AC.violet, 'note', 260, 0.6, 7, 0); fx.shake(0.15); return;
    case 'crescendo': {
      const k = ev.k || 0; for (let i = 0; i <= Math.min(3, k); i++) fx.add({ type: 'shock', x, y, r0: 30 + i * 20, r1: r * (0.7 + i * 0.12), life: 0.45 + i * 0.07, color: i % 2 ? AC.gold : AC.pink, width: 11 + i * 3 });
      glow(fx, x, y, r * 1.1, AC.pink, 0.4, 0.5); fx.add({ type: 'rays', x, y, r: r * 1.1, color: AC.goldHi, n: 16 + k * 4, life: 0.45, w: 6, seed: rnd(0, TAU) });
      motes(fx, x, y - 20, 14 + k * 4, AC.goldHi, 'note', 460, 1.0, 9, 40); fx.shake(0.4 + k * 0.1); flashMe(fx, me, AC.pinkHi, 0.2 + k * 0.04); return;
    }
    case 'encore': case 'finalbow': burst(fx, x, y, r, AC.gold, AC.goldHi, 'note', L === 'encore' ? 2 : 1.5); fx.add({ type: 'pillar', x, y, size: 140, h: 700, life: 0.6, color: AC.gold }); for (let i = 0; i < 3; i++) cine(fx, { kind: 'arSong', life: 0.7 + i * 0.12, x, y, r: r * (0.8 + i * 0.25), col: [AC.pink, AC.gold, '#7af0ff'][i] }); fx.shake(0.5); return;
    case 'bignote': cine(fx, { kind: 'arBigNote', life: 0.6, x, y, s: 30, r, col: ev.i % 2 ? AC.gold : AC.pink }); return;
    case 'finalchord': for (let i = 0; i < 4; i++) fx.add({ type: 'shock', x, y, r0: 40, r1: r * (0.8 + i * 0.15), life: 0.5 + i * 0.1, color: [AC.pink, AC.gold, AC.violet, '#ffffff'][i], width: 24 }); fx.add({ type: 'rays', x, y, r: r * 1.2, color: AC.goldHi, n: 24, life: 0.6, w: 8, seed: rnd(0, TAU) }); motes(fx, x, y, 34, AC.goldHi, 'note', 560, 1.2, 10, 40); fx.shake(1); flashMe(fx, me, AC.goldHi, 0.6); return;
    case 'toll': cine(fx, { kind: 'arBell', life: 0.6, x, y, s: 34 }); shock(fx, x, y, r * 1.2, AC.violet, 0.5, 14); motes(fx, x, y - 60, 5, AC.violet, 'note', 160, 0.7, 7, 30); return;
    case 'knell': cine(fx, { kind: 'arBell', life: 1.0, x, y, s: 70 }); for (let i = 0; i < 3; i++) fx.add({ type: 'shock', x, y, r0: 40, r1: r * (0.9 + i * 0.2), life: 0.55 + i * 0.12, color: i % 2 ? AC.gold : AC.violet, width: 22 }); fx.add({ type: 'pillar', x, y, size: 120, h: 700, life: 0.5, color: AC.violet }); fx.shake(0.9); flashMe(fx, me, AC.violetD, 0.5); return;
    default: burst(fx, x, y, r, ev.cls === 'bard' ? AC.pink : AC.ink, '#ffffff', ev.cls === 'bard' ? 'note' : 'page', 1);
  }
}
export function arcFx(fx, ev, me, sim) {
  if (ev.type === 'spx') { // Specials + 5-step stages for these two classes: add creature / music art (fxspec draws the banners)
    const P = ev.cls === 'bard';
    if (ev.ph === 'cast' && ev.id === 'legendary_page') { cine(fx, { kind: 'arBook', life: 1.0, x: ev.x, y: ev.y, s: 52, pid: ev.pid, col: AC.gold }); motes(fx, ev.x, ev.y - 50, 18, '#fff8e6', 'page', 300, 1.1, 9, 80); }
    if (ev.ph === 'cast' && ev.id === 'crescendo') cine(fx, { kind: 'arCharge', life: 0.32, x: ev.x, y: ev.y, r: 220, pid: ev.pid, col: AC.pink });
    if (ev.ph === 'hit') {
      const m = { phoenix: 'phoenix', thunder: 'bolt', kraken: 'kraken', krakenslam: 'krakencrush' }[ev.look];
      if (m) hitLook(fx, { ...ev, look: m, i: ev.i || 0 }, me);
      if (ev.look === 'fork') cine(fx, { kind: 'arFork', life: 0.5, x: ev.x, y: ev.y, s: 40 }), shock(fx, ev.x, ev.y, (ev.r || 100) * 1.1, AC.pink, 0.35, 10);
      if (ev.look === 'staff') cine(fx, { kind: 'arStaffSweep', life: 0.55, x: ev.x, y: ev.y, r: (ev.r || 200) * 0.8, ang: ev.ang || 0, arc: ev.arc || 3, pid: ev.pid });
      if (ev.look === 'finale') motes(fx, ev.x, ev.y, 20, P ? AC.goldHi : '#fff8e6', P ? 'note' : 'page', 420, 1.1, 10, 60);
    }
    return;
  }
  if (ev.type === 'arc') {
    const P = ev.cls === 'bard', col = P ? AC.pink : AC.ink, hx = ev.x + Math.cos(ev.ang || 0) * 22, hy = ev.y - 10 + Math.sin(ev.ang || 0) * 22;
    if (ev.ph === 'cast') {
      glow(fx, hx, hy, ev.emp ? 90 : 56, ev.emp ? AC.gold : col, 0.25, 0.75); motes(fx, hx, hy, ev.emp ? 8 : 4, ev.emp ? AC.goldHi : col, P ? 'note' : 'rune', 160, 0.6, 6, 30);
      if (ev.spend && me) fx.text(ev.x, ev.y - 70, P ? 'IN TUNE!' : 'FULL BOOK!', { size: 18, color: P ? AC.gold : AC.ink, life: 0.9, vy: -40, pop: 1.5 });
    } else if (ev.ph === 'fin' && ev.id === 'final_chapter' && ev.route === 'boss') { momFin(fx, ev, 'sum', 'GRIMOIRE SUMMONER  ·  THE FINAL CHAPTER', 'R  E  Q  E  R'); fx.add({ type: 'pillar', x: ev.x, y: ev.y, size: 120, h: 700, life: 0.6, color: col });
    } else if (ev.ph === 'fin') { if (me) fx.banner((ev.name || '').toUpperCase(), P ? AC.gold : AC.ink, 'FINISHER', 1.4, 56); fx.add({ type: 'pillar', x: ev.x, y: ev.y, size: 120, h: 700, life: 0.6, color: col }); }
    return;
  }
  switch (ev.ph) { // 'arcx'
    case 'hit': hitLook(fx, ev, me); return;
    case 'full': burst(fx, ev.x, ev.y - 20, 60, AC.ink, AC.inkHi, 'page', 1); cine(fx, { kind: 'arBook', life: 0.8, x: ev.x, y: ev.y, s: 26, pid: ev.pid, col: AC.gold }); if (me) fx.text(ev.x, ev.y - 80, 'INSCRIBED!', { size: 22, color: AC.gold, life: 1.1, vy: -40, pop: 2 }); return;
    case 'gain': if (me && !lite(fx)) motes(fx, ev.x, ev.y + 30, 2, ev.cls === 'bard' ? AC.pinkHi : AC.inkHi, ev.cls === 'bard' ? 'note' : 'rune', 60, 0.5, 4, 60); return;
    case 'song': {
      const col = SONG_COL[ev.kind] || AC.pink;
      cine(fx, { kind: 'arSong', life: 0.7, x: ev.x, y: ev.y, r: 220, col }); motes(fx, ev.x, ev.y - 20, 8, col, 'note', 200, 1.0, 7, 90);
      for (const id of ev.ids || []) { const q = pl(fx, id); if (q && id !== ev.pid) { glow(fx, q.x, q.y, 70, col, 0.35, 0.6); motes(fx, q.x, q.y - 20, 4, col, 'note', 100, 0.8, 6, 80); } }
      if (me && pl(fx, ev.pid)) fx.text(ev.x, ev.y - 64, ev.kind.toUpperCase(), { size: 15, color: col, life: 0.8, vy: -50 });
      return;
    }
    case 'echo': cine(fx, { kind: 'arEcho', life: 0.3, fx: ev.fx, fy: ev.fy, x: ev.x, y: ev.y }); if (!ev.miss) glow(fx, ev.x, ev.y, 60, AC.pink, 0.2, 0.6); return;
    case 'roc': cine(fx, { kind: 'arRoc', life: (ev.T || 30) / 60 + 0.2, T: (ev.T || 30) / 60, x: ev.x, y: ev.y, ang: ev.ang, len: ev.len || 500, emp: ev.emp }); cine(fx, { kind: 'arStorm', life: (ev.T || 30) / 60 + 0.4, x: ev.x + Math.cos(ev.ang) * (ev.len || 500) / 2, y: ev.y + Math.sin(ev.ang) * (ev.len || 500) / 2, r: (ev.len || 500) * 0.6 }); return;
    case 'krakenrise': cine(fx, { kind: 'arWhirl', life: 1.6, x: ev.x, y: ev.y, r: (ev.r || 140) * 1.5 }); cine(fx, { kind: 'arKraken', life: 1.4, x: ev.x, y: ev.y, r: ev.r || 140, n: 8, h: 220, w: 26, seed: rnd(0, TAU), crush: 1 }); fx.shake(0.4); return;
    case 'phoenixrise': cine(fx, { kind: 'arPhoenix', life: 0.9, T: 0.7, x: ev.x, y: ev.y, ang: ev.ang, len: ev.len || 600, w: ev.w || 170, s: 78 }); flashMe(fx, me, '#ffb347', 0.3); return;
  }
}
export function arcSound(au, ev, me) {
  if (!au.ctx || au.muted) return;
  const bard = ev.cls === 'bard', scale = [523, 587, 659, 784, 880, 1046];
  const chord = (fs, type = 'triangle', d = 0.25, v = 0.07) => fs.forEach((f, i) => au.tone(type, f, f, d, v, i * 0.03));
  if (ev.type === 'arc') { if (ev.ph === 'cast') { if (bard) au.tone('triangle', scale[(ev.key || 'Q').charCodeAt(0) % 6], scale[(ev.key || 'Q').charCodeAt(0) % 6] * 1.5, 0.12, 0.08); else au.tone('sine', 300, 900, 0.12, 0.07); } else if (ev.ph === 'fin') chord(bard ? [523, 659, 784, 1046] : [220, 330, 440], bard ? 'triangle' : 'sawtooth', 0.6, 0.08); return; }
  if (ev.type === 'spx') { if (ev.ph === 'cast' && ev.id === 'crescendo') au.tone('sawtooth', 220, 880, 0.3, 0.06); return; }
  switch (ev.ph) {
    case 'hit':
      switch (ev.look) {
        case 'sprite': case 'auto': case 'stampede': case 'chapterhit': au.hiss(1200, 300, 0.15, 0.12, 1); break;
        case 'bolt': au.play('bolt'); au.hiss(5000, 800, 0.2, 0.15, 0.8); break;
        case 'breath': if (!ev.i) au.play('ice'); break;
        case 'elementalslam': case 'krakencrush': case 'bookslam': case 'lastpage': case 'rebirth': au.play('slam'); au.play('boom'); break;
        case 'phoenix': if (!ev.i) au.hiss(600, 2400, 0.4, 0.18, 0.8); break;
        case 'riff': chord([392, 494, 587], 'sawtooth', 0.18, 0.05); break;
        case 'hymn': chord([523, 659, 784], 'sine', 0.5, 0.07); break;
        case 'disso': chord([466, 494, 523], 'square', 0.25, 0.04); break;
        case 'crescendo': chord([262, 330, 392, 523, 659], 'sawtooth', 0.6, 0.06); au.play('boom'); break;
        case 'bignote': au.tone('triangle', scale[(ev.i || 0) % 6], scale[(ev.i || 0) % 6], 0.25, 0.1); break;
        case 'finalchord': case 'encore': case 'finalbow': chord([262, 330, 392, 523, 659, 784], 'triangle', 0.9, 0.07); au.play('boom'); break;
        case 'toll': case 'knell': au.tone('sine', ev.look === 'knell' ? 110 : 220, ev.look === 'knell' ? 105 : 215, 1.2, 0.2); au.tone('sine', ev.look === 'knell' ? 277 : 554, 550, 0.9, 0.06); break;
        default: au.play(ev.n ? 'hit' : 'swing');
      }
      return;
    case 'song': chord(ev.kind === 'requiem' ? [220, 262, 311] : ev.kind === 'haste' ? [659, 784, 988] : [523, 659, 784], 'triangle', 0.35, 0.05); return;
    case 'full': [523, 659, 784, 1046].forEach((f, i) => au.tone('sine', f, f, 0.15, 0.08, i * 0.05)); return;
    case 'echo': au.tone('sine', 880, 1320, 0.08, 0.04); return;
    case 'roc': au.hiss(400, 3000, 0.5, 0.15, 0.8); return;
    case 'krakenrise': au.tone('sine', 80, 40, 0.8, 0.3); au.hiss(500, 120, 0.8, 0.25, 0.7, 'lowpass'); return;
    case 'phoenixrise': au.hiss(500, 3000, 0.6, 0.2, 0.8); return;
  }
}
void soft;
/** Class art around the hero: a small floating grimoire with orbiting pages (Summoner) / drifting notes (Bard);
 *  in the ult window the open Grimoire Unbound hovers over the Summoner and a spotlight + staff ring circles the Bard. */
export function drawArcanaHalo(ctx, x, y, e, time, liteMode) {
  const bard = e.cls === 'bard', col = bard ? AC.pink : AC.ink, emp = e.ar || (e.arc && e.arc.emp);
  if (e.uw) {
    if (bard) {
      ctx.save(); if (!liteMode) bloom(ctx, x, y - 30, 120, AC.gold, 0.35);
      const g = ctx.createLinearGradient(x, y - 300, x, y + 10); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(1, 'rgba(255,230,160,.22)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 30, y - 300); ctx.lineTo(x + 30, y - 300); ctx.lineTo(x + 60, y + 14); ctx.lineTo(x - 60, y + 14); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(x, y + 12); ctx.scale(1, 0.4); drawStaff(ctx, 0, 0, 70, time * 1.5, time * 1.5 + TAU * 0.8, 0.8, AC.gold, 16); ctx.restore();
    } else drawBook(ctx, x, y - 70 + Math.sin(time * 3) * 4, 30, 1, time, 0.95, AC.gold);
  }
  const n = bard ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const g = time * (bard ? 1.4 : 2) + i * TAU / n, R = 30;
    const px = x + Math.cos(g) * R, py = y - 18 + Math.sin(g) * R * 0.35 - (bard ? ((time * 0.6 + i * 0.5) % 1) * 20 : 0);
    mote(ctx, px, py, bard ? 'note' : 'page', emp ? 6 : 4.5, bard ? 0 : g * 2, emp ? AC.gold : (bard ? col : '#e6fff8'), bard ? 0.85 - ((time * 0.6 + i * 0.5) % 1) * 0.5 : 0.85, !liteMode);
  }
}
