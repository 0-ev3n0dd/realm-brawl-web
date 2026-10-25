// Astrael / Astrael (Extreme) (The Star Sanctum): the night-sky arena (disc / 4 floating platforms / zodiac clock),
// constellation shapes, suns, comets, planets, the mirror clone, threads, debuff icons, telegraphs, the goddess herself,
// the cinematic camera (zoom + pan), letterbox bars, name cards, boss lines, the HP bar with its phase timeline, the Big
// Bang countdown / white-out, the wipe screen and the kill dissolve. Reads plain `sim.astrael` data (a local sim in solo,
// the snapshot copy in co-op) and never mutates the sim. `q` = render quality 0..2 (mobile auto quality).
import { CUE_RGB } from './telefx.js';
import { uiOn, uiAround, uiIcon } from './uipaint.js';
import { drawPaintedAstrael, drawPaintedAegis, paintedEnemyReady } from './enemypaint.js';
import { AST_POS as C, AST_R, PLAT, platCenter, inAstArea } from '../sim/astraelconst.js';
import { wpOn, wpPiece, wpProp } from './worldpaint.js';
import { AST, segsOf, nameOf, AST_COL, DEBUFF_NAMES, DEBUFF_HINT, signAng, segLabel } from '../sim/astrael.js';
import { INK, circle, rrect, shade } from './art.js';
import { sprite } from './sprite.js';

const TAU = Math.PI * 2;
const SIGNS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
const SIGN_NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
function hash(i) { let h = (i * 374761393) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const nearAst = (view) => view.x1 > C.x - AST_R - 900 && view.x0 < C.x + AST_R + 900 && view.y1 > C.y - AST_R - 900 && view.y0 < C.y + AST_R + 900;
const label = (ctx, s, x, y, size, col, lw = 4) => { ctx.font = `${size}px 'Lilita One', sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y); };
const bossOf = (sim, A) => (sim.enemyById && sim.enemyById.get(A.bid)) || sim.enemies.find((e) => e.id === A.bid);
const posOf = (sim, m) => { if (m.pid) { const p = sim.players.get(m.pid); if (p && !p.dead) return p; } return m.x != null ? m : null; };

// ------------------------------------------------------------------ the sky + the floor
export function drawAstraelGround(ctx, view, time, sim, q = 2) {
  if (!nearAst(view)) return;
  const A = sim.astrael, st = A ? A.st : 'none';
  const won = st === 'victory' || st === 'kill';
  ctx.save();
  // night sky (deep blue -> violet nebula), brighter once the sky is reborn
  // night sky + nebula wisps: smooth gradients only, so they are baked once per variant into a low-res offscreen canvas
  // and blitted (perf pass 2026-10-07: 7 overlapping full-view gradient fills per frame -> one blit; same look)
  const sv = won ? 2 : A && A.clock ? 1 : 0, sk = skyCanvas(sv, q > 0);
  ctx.fillStyle = SKY_END[sv]; ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  if (sk) ctx.drawImage(sk, sk.x0, sk.y0, sk.ww, sk.wh); else skyPaint(ctx, sv, q > 0);
  const N = q === 0 ? 90 : q === 1 ? 180 : 320;
  for (let i = 0; i < N; i++) {
    const x = C.x + (hash(i) - 0.5) * 3400, y = C.y + (hash(i + 999) - 0.5) * 2800;
    if (x < view.x0 || x > view.x1 || y < view.y0 || y > view.y1) continue;
    ctx.globalAlpha = 0.3 + 0.6 * Math.abs(Math.sin(time * (0.4 + hash(i + 3)) + i));
    circle(ctx, x, y, i % 9 === 0 ? 2.6 : 1.3, i % 11 === 0 ? '#ffe7a0' : i % 7 === 0 ? '#9fc4ff' : '#ffffff', 0);
  }
  ctx.globalAlpha = 1;
  if (st === 'kill' || st === 'victory') drawSkyReborn(ctx, A, time, q);
  if (!A || (!A.plats && !(st === 'collapse' && A.cine && A.cine.t < AST.cine.collapse * 0.5))) { drawDisc(ctx, A, time, q); }
  else if (A.plats) drawPlatforms(ctx, A, time, q);
  else drawDisc(ctx, A, time, q, clamp01(A.cine.t / (AST.cine.collapse * 0.5)));
  ctx.restore();
  if (sim.starPortal) drawStarPortal(ctx, sim.starPortal.x, sim.starPortal.y, time, 'Astrael');
  if (A && A.st === 'victory') drawStarPortal(ctx, C.x, C.y + AST_R - 40, time, 'EXIT');
}
const SKY_STOPS = [['#16204a', '#0b1030', '#04050f'], ['#3a1430', '#1c0c26', '#07040f'], ['#2b3a7a', '#1a2150', '#0a0c24']];
const SKY_END = SKY_STOPS.map((s) => s[2]);
/** the sky gradient + the six nebula wisps, in world units (live fallback + the bake) */
function skyPaint(g, sv, neb) {
  const st = SKY_STOPS[sv], R3 = AST_R * 3.2, gr = g.createRadialGradient(C.x, C.y, AST_R * 0.4, C.x, C.y, R3);
  gr.addColorStop(0, st[0]); gr.addColorStop(0.5, st[1]); gr.addColorStop(1, st[2]);
  g.fillStyle = gr; g.fillRect(C.x - R3, C.y - R3, R3 * 2, R3 * 2);
  if (neb) for (let i = 0; i < 6; i++) { const x = C.x + (hash(i + 50) - 0.5) * 2600, y = C.y + (hash(i + 70) - 0.5) * 2000, r = 300 + hash(i + 90) * 400; const n = g.createRadialGradient(x, y, 10, x, y, r); n.addColorStop(0, i % 2 ? 'rgba(160,90,255,.16)' : 'rgba(80,160,255,.14)'); n.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = n; g.fillRect(x - r, y - r, r * 2, r * 2); }
}
const SKY = new Map();
export const SKY_PX = 0.3; // baked px per world unit (smooth gradients: the upscale is invisible)
function skyCanvas(sv, neb) {
  const k = sv * 2 + (neb ? 1 : 0); if (SKY.has(k)) return SKY.get(k);
  if (typeof OffscreenCanvas === 'undefined' && typeof document === 'undefined') return null;
  const R3 = AST_R * 3.2, x0 = Math.min(C.x - R3, C.x - 1700), y0 = Math.min(C.y - R3, C.y - 1400), x1 = Math.max(C.x + R3, C.x + 1700), y1 = Math.max(C.y + R3, C.y + 1400);
  const w = Math.ceil((x1 - x0) * SKY_PX), h = Math.ceil((y1 - y0) * SKY_PX);
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const g = c.getContext('2d'); g.fillStyle = SKY_END[sv]; g.fillRect(0, 0, w, h);
  g.setTransform(SKY_PX, 0, 0, SKY_PX, -x0 * SKY_PX, -y0 * SKY_PX); skyPaint(g, sv, neb);
  c.x0 = x0; c.y0 = y0; c.ww = x1 - x0; c.wh = y1 - y0; SKY.set(k, c); return c;
}
function drawDisc(ctx, A, time, q, crack = 0) {
  const R = AST_R, clock = A && A.clock;
  ctx.fillStyle = '#05061a'; ctx.beginPath(); ctx.ellipse(C.x, C.y + 40, R + 10, R + 6, 0, 0, TAU); ctx.fill();
  const fg = ctx.createRadialGradient(C.x, C.y - 80, 40, C.x, C.y, R);
  if (clock) { fg.addColorStop(0, '#4a2440'); fg.addColorStop(1, '#231231'); } else { fg.addColorStop(0, '#2c3a78'); fg.addColorStop(1, '#161d46'); }
  circle(ctx, C.x, C.y, R + 8, '#0e1236', 6, INK); circle(ctx, C.x, C.y, R, fg, 0);
  ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y, R, 0, TAU); ctx.clip();
  const DS = wpOn() && wpPiece('d_star');
  if (DS) { // painted: the zodiac star-disc (lapis + gold), warmed to the clock colours in the Celestial Clock phase
    const { im, p } = DS, d = (R + 8) * 2; ctx.drawImage(im, p.x, p.y, p.w, p.h, C.x - d / 2, C.y - d / 2 * (p.h / p.w), d, d * (p.h / p.w));
    if (clock) { ctx.fillStyle = 'rgba(120,40,60,.38)'; ctx.fillRect(C.x - R, C.y - R, R * 2, R * 2); }
  } else {
  // star-map rings + meridians
  ctx.strokeStyle = clock ? 'rgba(255,190,140,.16)' : 'rgba(160,200,255,.16)'; ctx.lineWidth = 2;
  for (let r = 1; r <= 4; r++) { ctx.beginPath(); ctx.arc(C.x, C.y, r * R / 4.3, 0, TAU); ctx.stroke(); }
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; ctx.beginPath(); ctx.moveTo(C.x + Math.cos(a) * 70, C.y + Math.sin(a) * 70); ctx.lineTo(C.x + Math.cos(a) * R, C.y + Math.sin(a) * R); ctx.stroke(); }
  }
  if (q > 0) for (let i = 0; i < 40; i++) { const a = hash(i + 300) * TAU, d = 60 + hash(i + 400) * (R - 80); ctx.globalAlpha = 0.25 + 0.3 * Math.sin(time * 2 + i); circle(ctx, C.x + Math.cos(a) * d, C.y + Math.sin(a) * d, 1.6, '#dfe8ff', 0); }
  ctx.globalAlpha = 1;
  if (clock) drawClock(ctx, A, time);
  if (crack > 0) { // Collapse of Heaven: glowing cracks along the platform split lines
    ctx.strokeStyle = `rgba(255,230,160,${0.4 + 0.5 * crack})`; ctx.lineWidth = 3 + crack * 6;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(C.x, C.y); for (let k = 1; k <= 6; k++) { const d = k * R / 6, j = (hash(i * 10 + k) - 0.5) * 40 * crack; ctx.lineTo(C.x + Math.cos(a) * d - Math.sin(a) * j, C.y + Math.sin(a) * d + Math.cos(a) * j); } ctx.stroke(); }
  }
  ctx.restore();
  circle(ctx, C.x, C.y, R, null, 5, clock ? '#ffb88a' : '#9fc4ff');
  for (let i = 0; i < 24; i++) { const a = i * TAU / 24 + time * 0.04; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(time * 3 + i); circle(ctx, C.x + Math.cos(a) * (R - 14), C.y + Math.sin(a) * (R - 14), 3, clock ? '#ffd0a0' : '#dfe8ff', 0); }
  ctx.globalAlpha = 1;
}
function drawClock(ctx, A, time) {
  const W = A.wheel;
  for (let i = 0; i < 12; i++) {
    const a = signAng(i), x = C.x + Math.cos(a) * (AST_R - 58), y = C.y + Math.sin(a) * (AST_R - 58);
    const pointed = W && W.ptr >= 0 && W.seq[W.ptr] === i;
    ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = i % 2 ? '#ff9a6a' : '#ffd08a';
    ctx.beginPath(); ctx.moveTo(C.x + Math.cos(a - Math.PI / 12) * 60, C.y + Math.sin(a - Math.PI / 12) * 60); ctx.arc(C.x, C.y, AST_R, a - Math.PI / 12, a + Math.PI / 12); ctx.lineTo(C.x + Math.cos(a + Math.PI / 12) * 60, C.y + Math.sin(a + Math.PI / 12) * 60); ctx.closePath(); ctx.fill();
    ctx.restore();
    circle(ctx, x, y, pointed ? 30 : 22, pointed ? '#ffe7a0' : 'rgba(40,16,40,.8)', 3, pointed ? '#ffffff' : '#ffb88a');
    label(ctx, SIGNS[i], x, y + 8, pointed ? 26 : 20, pointed ? '#2b1a10' : '#ffd8b0', 3);
  }
  circle(ctx, C.x, C.y, 60, 'rgba(30,10,30,.6)', 3, '#ffb88a');
  if (W && W.ptr >= 0) { // she points at the sign: a golden beam from the centre (remember it!)
    const a = signAng(W.seq[W.ptr]), k = clamp01(((W.t - 30) % 90) / 25);
    ctx.save(); ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ffe7a0'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(C.x, C.y); ctx.lineTo(C.x + Math.cos(a) * (AST_R - 90) * k, C.y + Math.sin(a) * (AST_R - 90) * k); ctx.stroke(); ctx.restore();
    label(ctx, `${W.ptr + 1}`, C.x + Math.cos(a) * (AST_R - 110), C.y + Math.sin(a) * (AST_R - 110) + 8, 26, '#ffe7a0', 5);
  }
}
function drawPlatforms(ctx, A, time, q) {
  const fall = A.st === 'fall' && A.cine ? clamp01(A.cine.t / AST.cine.fall) : 0;
  ctx.save();
  // light bridges (a ring)
  for (let i = 0; i < 4; i++) {
    const a = platCenter(i), b = platCenter(i + 1);
    ctx.globalAlpha = (0.55 + 0.15 * Math.sin(time * 3 + i)) * (1 - fall); ctx.strokeStyle = '#9ff7ff'; ctx.lineWidth = PLAT.bw * 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.globalAlpha = 0.9 * (1 - fall); ctx.strokeStyle = '#e8ffff'; ctx.lineWidth = 3; ctx.setLineDash([12, 10]); ctx.lineDashOffset = -time * 30; ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 4; i++) {
    const c = platCenter(i), dy = fall * fall * 900, s = 1 - fall * 0.5, bob = Math.sin(time * 1.4 + i) * 2;
    ctx.save(); ctx.translate(c.x, c.y + dy + bob); ctx.scale(s, s);
    ctx.fillStyle = '#05061a'; ctx.beginPath(); ctx.ellipse(0, 34, PLAT.r + 6, PLAT.r * 0.95, 0, 0, TAU); ctx.fill();
    for (let k = 0; k < 7; k++) { const a = Math.PI * (0.15 + k * 0.11); ctx.beginPath(); ctx.moveTo(Math.cos(a) * PLAT.r, Math.sin(a) * PLAT.r); ctx.lineTo(Math.cos(a) * PLAT.r * 0.6, Math.sin(a) * PLAT.r + 60 + hash(k + i * 9) * 50); ctx.lineTo(Math.cos(a + 0.12) * PLAT.r, Math.sin(a + 0.12) * PLAT.r); ctx.fillStyle = '#10143a'; ctx.fill(); }
    const SP = wpOn() && wpPiece('d_starplat');
    if (SP) { const { im, p } = SP, d = PLAT.r * 2 + 10, k = d / p.w; ctx.drawImage(im, p.x, p.y, p.w, p.h, -d / 2, -p.h * 0.47 * k, d, p.h * k); }
    else {
    const fg = ctx.createRadialGradient(0, -30, 10, 0, 0, PLAT.r); fg.addColorStop(0, '#34428a'); fg.addColorStop(1, '#1a2152');
    circle(ctx, 0, 0, PLAT.r, fg, 5, INK);
    ctx.strokeStyle = 'rgba(160,200,255,.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, PLAT.r * 0.6, 0, TAU); ctx.stroke();
    }
    circle(ctx, 0, 0, PLAT.r, null, SP ? 2.5 : 4, '#9fc4ff');
    label(ctx, ['SE', 'SW', 'NW', 'NE'][i], 0, 8, 18, 'rgba(200,220,255,.35)', 0);
    ctx.restore();
  }
  ctx.restore();
  void q;
}
function drawSkyReborn(ctx, A, time, q) {
  const k = A.st === 'victory' ? 1 : clamp01((A.cine ? A.cine.t : 0) / (AST.cine.kill * 0.8));
  ctx.save(); ctx.globalAlpha = k;
  const n = q === 0 ? 8 : 14;
  for (let c = 0; c < n; c++) { // constellations re-forming across the sky
    const x0 = C.x + (hash(c + 700) - 0.5) * 2600, y0 = C.y + (hash(c + 800) - 0.5) * 2000;
    ctx.strokeStyle = 'rgba(255,231,160,.55)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let s = 0; s < 5; s++) { const x = x0 + (hash(c * 7 + s) - 0.5) * 260, y = y0 + (hash(c * 7 + s + 50) - 0.5) * 200; s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    for (let s = 0; s < 5; s++) { const x = x0 + (hash(c * 7 + s) - 0.5) * 260, y = y0 + (hash(c * 7 + s + 50) - 0.5) * 200; circle(ctx, x, y, 3 + Math.sin(time * 3 + s) , '#fff4c8', 0); }
  }
  ctx.restore();
}
/** The star portal (Vorthax's sanctum after he falls) and the exit star. */
export function drawStarPortal(ctx, x, y, time, text = 'STAR') {
  if (wpOn() && wpPiece('starportal')) {
    ctx.save(); const g = ctx.createRadialGradient(x, y, 4, x, y, 90); g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(0.4, 'rgba(255,231,160,.35)'); g.addColorStop(1, 'rgba(60,80,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + 20, 90, 50, 0, 0, TAU); ctx.fill(); ctx.restore();
    wpProp(ctx, 'starportal', x, y + 40, 150 + Math.sin(time * 2) * 2);
    label(ctx, text, x, y - 118, 15, '#ffe7a0'); return;
  }
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 4, x, y, 70); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.35, '#ffe7a0'); g.addColorStop(1, 'rgba(60,80,200,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 62, 48, 0, 0, TAU); ctx.fill();
  ctx.translate(x, y); ctx.rotate(time * 0.8);
  ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 14 : 38, a = i * TAU / 10; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fillStyle = '#fff8dc'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#9fb8ff'; ctx.stroke();
  ctx.restore();
  label(ctx, text, x, y - 62, 15, '#ffe7a0');
}

// ------------------------------------------------------------------ telegraphs, markers (under the characters)
export function drawAstraelUnder(ctx, sim, local, time) {
  const A = sim.astrael;
  if (!A) return;
  for (const f of A.fields || []) { const k = f.t < 60 ? f.t / 60 : 1; ctx.save(); ctx.globalAlpha = 0.25 + 0.2 * k + 0.1 * Math.sin(time * 9); circle(ctx, f.x, f.y, f.r, '#ff7a3a', 3, '#ffd08a'); ctx.restore(); if (f.t < 60) label(ctx, 'STARFIRE', f.x, f.y + 6, 14, '#ffd08a'); }
  if (A.suns) drawSuns(ctx, A.suns, time);
  for (const s of A.stars || []) drawConstellation(ctx, s, time);
  for (const t of A.tele || []) drawTele(ctx, A, t, time, local);
  for (const m of A.marks || []) drawMark(ctx, sim, A, m, time, local);
  if (A.planets) drawPlanets(ctx, A, time);
  for (const pl of A.pylons || []) { ctx.save(); ctx.fillStyle = '#10143a'; ctx.beginPath(); ctx.moveTo(pl.x, pl.y - 60); ctx.lineTo(pl.x + 16, pl.y); ctx.lineTo(pl.x - 16, pl.y); ctx.closePath(); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = AST_COL.thread; ctx.stroke(); circle(ctx, pl.x, pl.y - 60, 7 + Math.sin(time * 6) * 2, '#e8ffff', 0); ctx.restore(); }
  if (A.mirror) drawMirrorPlats(ctx, A, time);
}
const shown = (t) => t.done || t.d - t.t <= (t.show ?? t.d);
function drawTele(ctx, A, t, time, local) {
  if (!shown(t)) return;
  const k = clamp01(t.t / Math.max(1, t.d)), done = t.done || t.t >= t.d, flash = done ? Math.max(0, 1 - (t.t - t.d) / 16) : 0;
  const pulse = 0.5 + 0.5 * Math.sin(time * (8 + k * 14));
  ctx.save();
  if (t.sh === 'notwedge') { // zodiac: everything except the sign's wedge burns
    const path = (danger) => { ctx.beginPath(); if (danger) { ctx.moveTo(C.x + AST_R, C.y); ctx.arc(C.x, C.y, AST_R, 0, TAU); } ctx.moveTo(C.x + Math.cos(t.ang - t.half) * t.rin, C.y + Math.sin(t.ang - t.half) * t.rin); ctx.arc(C.x, C.y, AST_R, t.ang - t.half, t.ang + t.half); ctx.arc(C.x, C.y, t.rin, t.ang + t.half, t.ang - t.half, true); ctx.closePath(); };
    ctx.globalAlpha = done ? flash * 0.8 : 0.22 + 0.25 * k; ctx.fillStyle = done ? '#fff0e0' : CUE_RGB.away[1]; path(true); ctx.fill('evenodd');
    if (!done) { ctx.globalAlpha = 0.35 + 0.3 * pulse; ctx.fillStyle = 'rgba(92,255,157,.5)'; path(false); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = CUE_RGB.safe[1]; ctx.lineWidth = 5; path(false); ctx.stroke(); label(ctx, SIGNS[t.sign] || '', C.x + Math.cos(t.ang) * 250, C.y + Math.sin(t.ang) * 250 + 12, 40, '#eafff2', 6); }
    ctx.restore(); return;
  }
  if (t.sh === 'plat') { // mirror smash: both platforms look the same (read the boss, not the floor)
    const c = platCenter(t.plat);
    if (done) { if (!t.fake) { ctx.globalAlpha = flash * 0.85; circle(ctx, c.x, c.y, PLAT.r, '#fff0ff', 0); } }
    else { ctx.globalAlpha = 0.18 + 0.2 * pulse; circle(ctx, c.x, c.y, PLAT.r, CUE_RGB.away[1], 0); ctx.globalAlpha = 0.9; ctx.lineWidth = 5; ctx.strokeStyle = CUE_RGB.away[1]; ctx.setLineDash([16, 10]); ctx.lineDashOffset = -time * 40; ctx.beginPath(); ctx.arc(c.x, c.y, PLAT.r - 4, 0, TAU); ctx.stroke(); ctx.setLineDash([]); label(ctx, '?', c.x, c.y + 14, 44, '#e6d8ff', 6); }
    ctx.restore(); return;
  }
  if (t.sh === 'ring') { // shield knockback: arrows pushing out from her
    const R = A.plats ? AST.kb.a2 : AST.kb.a1;
    ctx.globalAlpha = done ? flash : 0.7; ctx.strokeStyle = CUE_RGB.away[1]; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(t.x, t.y, 90 + k * 30, 0, TAU); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + time * 0.3, d = 120 + ((time * 120 + i * 13) % 80); ctx.save(); ctx.translate(t.x + Math.cos(a) * d, t.y + Math.sin(a) * d); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-6, -11); ctx.lineTo(-6, 11); ctx.closePath(); ctx.fillStyle = '#dff0ff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); }
    if (!done) label(ctx, `KNOCKBACK ${R}`, t.x, t.y - 130, 16, '#dff0ff');
    ctx.restore(); return;
  }
  const col = CUE_RGB[t.cue || (t.k === 'stack' ? 'close' : t.k === 'spread' ? 'spread' : 'away')][1]; // (the game-wide colour grammar, client/telefx.js)
  const path = (kk = 1) => {
    ctx.beginPath();
    if (t.sh === 'circle') ctx.arc(t.x, t.y, Math.max(1, t.r * kk), 0, TAU);
    else if (t.sh === 'cone') { ctx.moveTo(t.x, t.y); ctx.arc(t.x, t.y, Math.max(1, t.len * kk), t.ang - t.arc / 2, t.ang + t.arc / 2); ctx.closePath(); }
    else if (t.sh === 'rect') { ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.ang); ctx.rect(-t.len / 2, -t.w / 2 * kk, t.len, t.w * kk); ctx.restore(); }
  };
  if (done) { ctx.globalAlpha = flash * 0.8; ctx.fillStyle = '#fff6f0'; path(); ctx.fill(); ctx.restore(); return; }
  ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y, AST_R + 6, 0, TAU); ctx.clip();
  ctx.globalAlpha = 0.16 + 0.12 * pulse; ctx.fillStyle = col; path(); ctx.fill();
  ctx.globalAlpha = 0.95; ctx.strokeStyle = col; ctx.lineWidth = 4; path(); ctx.stroke();
  ctx.globalAlpha = 0.35; ctx.fillStyle = col; path(k); ctx.fill();
  ctx.restore();
  if (t.k === 'lance' && t.pid && local && t.pid === local.id) label(ctx, 'STARLANCE ON YOU', local.x, local.y - 70, 16, '#ff9ae8');
  ctx.restore();
}
/** Constellation: floor stars trace the weapon (sword / shield / crown) around her; read the shape. */
function drawConstellation(ctx, s, time) {
  const k = clamp01(s.t / Math.min(s.d, 90));
  const pts = {
    sword: [[-230, 0], [-160, 0], [-90, 0], [-20, 0], [60, 0], [140, 0], [230, 0], [-160, -50], [-160, 50]],
    shield: [[0, -130], [95, -95], [110, 10], [60, 100], [0, 140], [-60, 100], [-110, 10], [-95, -95]],
    crown: [[-120, 60], [120, 60], [120, -40], [60, 10], [0, -90], [-60, 10], [-120, -40]],
  }[s.shape] || [];
  const lines = { sword: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [7, 8]], shield: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0]], crown: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]] }[s.shape] || [];
  const ang = s.shape === 'sword' ? s.ang : 0, cx = s.x, cy = s.y + (s.shape === 'sword' ? 0 : -150);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  ctx.strokeStyle = s.shape === 'crown' ? AST_COL.stack : s.shape === 'shield' ? '#bfe0ff' : '#ffffff'; ctx.lineWidth = 4; ctx.globalAlpha = 0.85; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 12;
  const nL = Math.floor(lines.length * k);
  ctx.beginPath(); for (let i = 0; i < nL; i++) { const [a, b] = lines[i]; ctx.moveTo(pts[a][0], pts[a][1]); ctx.lineTo(pts[b][0], pts[b][1]); } ctx.stroke();
  ctx.shadowBlur = 0;
  pts.forEach(([x, y], i) => { ctx.globalAlpha = i / pts.length <= k + 0.05 ? 1 : 0.25; circle(ctx, x, y, 6 + Math.sin(time * 6 + i) * 1.5, '#fff8dc', 2, '#9fb8ff'); });
  ctx.restore();
}
function drawSuns(ctx, S, time) {
  const k = clamp01(S.t / S.d);
  for (const [x, y, warm] of [[S.wx, S.wy, true], [S.cx, S.cy, false]]) {
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 10, x, y, S.r); g.addColorStop(0, warm ? 'rgba(255,200,90,.55)' : 'rgba(140,220,255,.55)'); g.addColorStop(1, warm ? 'rgba(255,120,40,.08)' : 'rgba(60,140,255,.08)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, S.r, 0, TAU); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = warm ? AST_COL.warm : AST_COL.cold; ctx.beginPath(); ctx.arc(x, y, S.r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, S.r + 8, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    // the sun itself hovering above its light
    const hy = y - 40 + Math.sin(time * 2) * 4;
    circle(ctx, x, hy, 30 + k * 8, warm ? '#ffb13b' : '#6fd3ff', 4, warm ? '#fff0b0' : '#e0f6ff');
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + time * (warm ? 1 : -1); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 40, hy + Math.sin(a) * 40); ctx.lineTo(x + Math.cos(a) * 54, hy + Math.sin(a) * 54); ctx.strokeStyle = warm ? '#ffd27a' : '#bfefff'; ctx.lineWidth = 4; ctx.stroke(); }
    label(ctx, warm ? 'WARM' : 'COLD', x, y + S.r - 16, 16, warm ? '#ffd27a' : '#bfefff');
    ctx.restore();
  }
}
function drawMark(ctx, sim, A, m, time, local) {
  const p = posOf(sim, m); if (!p) return;
  const k = clamp01(m.t / Math.max(1, m.d));
  ctx.save();
  if (m.k === 'crown') {
    ctx.globalAlpha = 0.2 + 0.12 * Math.sin(time * 8); circle(ctx, p.x, p.y, m.r, AST_COL.stack, 0);
    ctx.globalAlpha = 1; ctx.lineWidth = 5; ctx.strokeStyle = AST_COL.stack; ctx.beginPath(); ctx.arc(p.x, p.y, m.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, m.r + 7, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    drawCrownIcon(ctx, p.x, p.y - (m.pid ? 76 : 0), m.pid ? 1 : 1.4);
    const n = [...sim.players.values()].filter((q) => !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < m.r).length;
    label(ctx, m.solo ? 'SOAK THE CROWN' : `STACK ${n}/${m.need}${m.grp ? ' · B' : A.marks.some((x) => x.k === 'tag') ? ' · A' : ''}`, p.x, p.y - m.r - 14, 16, AST_COL.stack);
  } else if (m.k === 'tag') {
    label(ctx, m.txt, p.x + 26, p.y - 44, 22, m.txt === 'A' ? '#ffd84a' : '#8ad8ff', 5);
  } else if (m.k === 'sun') {
    const warm = m.c === 'warm', y = p.y - 70;
    circle(ctx, p.x, y, 13, warm ? AST_COL.warm : AST_COL.cold, 3, INK);
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + time * 2; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * 16, y + Math.sin(a) * 16); ctx.lineTo(p.x + Math.cos(a) * 22, y + Math.sin(a) * 22); ctx.strokeStyle = warm ? AST_COL.warm : AST_COL.cold; ctx.lineWidth = 3; ctx.stroke(); }
    if (local && m.pid === local.id) label(ctx, warm ? 'WARM BRAND → go COLD' : 'COLD BRAND → go WARM', p.x, y - 24, 15, warm ? '#ffd27a' : '#bfefff');
  } else if (m.k === 'comet') {
    ctx.globalAlpha = 0.2 + 0.15 * Math.sin(time * 10); circle(ctx, p.x, p.y, m.r, AST_COL.comet, 0);
    ctx.globalAlpha = 1; ctx.lineWidth = 4; ctx.strokeStyle = AST_COL.comet; ctx.beginPath(); ctx.arc(p.x, p.y, m.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, m.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    const h = (1 - k) * 420, cx = p.x + (1 - k) * 160, cy = p.y - h; // the comet falling in
    ctx.strokeStyle = 'rgba(255,190,120,.7)'; ctx.lineWidth = 10 * k + 2; ctx.beginPath(); ctx.moveTo(cx + 60, cy - 110); ctx.lineTo(cx, cy); ctx.stroke();
    circle(ctx, cx, cy, 10 + k * 14, '#fff0d0', 3, AST_COL.comet);
    const mine = local && m.pid === local.id;
    label(ctx, A.n > 1 || (m.n > 1) ? `${m.n}` : 'SOAK', p.x, p.y + 8, A.n > 1 ? 30 : 18, mine ? '#ffffff' : '#ffd0a8', 5);
    if (mine && A.n > 1) label(ctx, 'YOURS', p.x, p.y + 30, 13, '#ffffff');
  } else if (m.k === 'spread') {
    ctx.globalAlpha = 0.14 + 0.1 * Math.sin(time * 10); circle(ctx, p.x, p.y, m.r, AST_COL.spread, 0);
    ctx.globalAlpha = 0.9; ctx.lineWidth = 4; ctx.strokeStyle = '#d98cff'; ctx.setLineDash(m.echo ? [10, 8] : []); ctx.beginPath(); ctx.arc(p.x, p.y, m.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.35; circle(ctx, p.x, p.y, m.r * k, AST_COL.spread, 0);
    ctx.globalAlpha = 1; label(ctx, m.echo ? 'ECHO' : 'SPREAD', p.x, p.y - m.r - 10, 14, '#e6c2ff');
  }
  ctx.restore();
}
function drawCrownIcon(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-18, 10); ctx.lineTo(-20, -10); ctx.lineTo(-9, 0); ctx.lineTo(0, -16); ctx.lineTo(9, 0); ctx.lineTo(20, -10); ctx.lineTo(18, 10); ctx.closePath();
  ctx.fillStyle = AST_COL.stack; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
}
const PLANET = { kb: ['MARS', '#ff6a4a', 'KNOCKBACK'], stack: ['JUPITER', '#ffb86a', 'STACK'], spread: ['SATURN', '#d9c38a', 'SPREAD'] };
function drawPlanets(ctx, A, time) {
  const P = A.planets;
  P.list.forEach((pl, i) => {
    const a = P.ang + i * TAU / 3 + (P.t / 60) * 0.35, R = AST_R + 90, x = C.x + Math.cos(a) * R, y = C.y + Math.sin(a) * R * 0.9;
    const [name, col, what] = PLANET[pl.k], r = pl.lit ? 44 : 32;
    ctx.save();
    ctx.globalAlpha = pl.done ? 0.3 : 1;
    if (pl.lit) { const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.6); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill(); }
    circle(ctx, x, y, r, pl.lit ? col : '#3a3f66', 4, pl.lit ? '#ffffff' : '#8a90c0');
    if (pl.k === 'stack') for (let s = -1; s <= 1; s++) { ctx.fillStyle = 'rgba(120,60,20,.5)'; ctx.fillRect(x - r * 0.9, y + s * r * 0.35 - 3, r * 1.8, 6); }
    if (pl.k === 'spread') { ctx.strokeStyle = pl.lit ? '#fff2c0' : '#9aa0c8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x, y, r * 1.7, r * 0.45, -0.3, 0, TAU); ctx.stroke(); }
    if (pl.k === 'kb') for (let s = 0; s < 3; s++) circle(ctx, x - 12 + s * 11, y - 8 + (s % 2) * 14, 4, 'rgba(120,20,10,.5)', 0);
    if (pl.lit) { label(ctx, name, x, y - r - 12, 18, col); label(ctx, what, x, y + r + 22, 15, '#ffffff'); }
    ctx.restore();
  });
}
function drawMirrorPlats(ctx, A, time) { void ctx; void A; void time; }

// ------------------------------------------------------------------ tethers, debuff icons, the mirror clone (over)
export function drawAstraelOver(ctx, sim, local, time) {
  const A = sim.astrael;
  if (!A) return;
  XM = !!A.x;
  for (const th of A.teth || []) {
    const a = sim.players.get(th.a), b = th.b ? sim.players.get(th.b) : { x: th.ax, y: th.ay - 50 };
    if (!a || !b) continue;
    const d = Math.hypot(a.x - b.x, a.y - (th.b ? b.y : th.ay)), ok = d >= th.lo && d <= th.hi, col = ok ? AST_COL.safe : d < th.lo ? '#ffb13b' : AST_COL.danger;
    ctx.save(); ctx.lineCap = 'round';
    ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(a.x, a.y - 10); ctx.lineTo(b.x, b.y - 10); ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([14, 8]); ctx.lineDashOffset = -time * 80; ctx.stroke(); ctx.setLineDash([]);
    if (th.a === local.id || th.b === local.id) label(ctx, `${Math.round(d)}  (${th.lo}-${th.hi}) ${ok ? 'OK' : d < th.lo ? 'TOO NEAR' : 'TOO FAR'}`, (a.x + b.x) / 2, (a.y + b.y) / 2 - 24, 16, col);
    ctx.restore();
  }
  // delayed debuffs over each player (icon + seconds; the local player's list is also on the HUD)
  const by = new Map();
  for (const d of A.ds || []) { if (!by.has(d.pid)) by.set(d.pid, []); by.get(d.pid).push(d); }
  for (const [pid, list] of by) {
    const p = sim.players.get(pid); if (!p || p.dead) continue;
    list.sort((x, y) => (x.d - x.t) - (y.d - y.t)).forEach((d, i) => drawDebuffIcon(ctx, p.x - (list.length - 1) * 19 + i * 38, p.y - 92, d, time));
  }
  if (A.mirror) drawClone(ctx, A, time);
  if (A.st === 'kill' && A.cine) drawDissolve(ctx, A, time);
}
const DB_ICON = { nova: 'burn', gravity: 'root', still: 'stillness', move: 'flow' };
const DB_COL = { nova: '#ff7a3a', gravity: '#b99cff', still: '#6fd3ff', move: '#6dffb0' };
function drawDebuffIcon(ctx, x, y, d, time) {
  const left = Math.max(0, Math.ceil((d.d - d.t) / 60)), soon = d.d - d.t < 120;
  ctx.save(); circle(ctx, x, y, 16, DB_COL[d.k], 3, soon && Math.sin(time * 20) > 0 ? '#ffffff' : INK);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillStyle = INK;
  if (uiOn() && uiIcon(ctx, DB_ICON[d.k], x, y, 30, 15)) circle(ctx, x, y, 15.5, null, 3, soon && Math.sin(time * 20) > 0 ? '#ffffff' : DB_COL[d.k]); // painted: B1 / B2 icon in the debuff's colour ring
  else if (d.k === 'nova') { for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); ctx.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11); ctx.stroke(); } }
  else if (d.k === 'gravity') { ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU * 0.8); ctx.stroke(); }
  else if (d.k === 'still') { ctx.fillRect(x - 6, y - 7, 4, 14); ctx.fillRect(x + 2, y - 7, 4, 14); }
  else { ctx.beginPath(); ctx.moveTo(x - 6, y - 8); ctx.lineTo(x + 8, y); ctx.lineTo(x - 6, y + 8); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  label(ctx, `${left}`, x, y + 32, 16, soon ? '#ffffff' : '#dfe8ff');
}
/** The reflection: same body, but NO shadow, a SILVER halo and a mirrored crescent (the real one: shadow + gold halo). */
function drawClone(ctx, A, time) {
  const M = A.mirror;
  drawGoddess(ctx, M.fx, M.fy, time, { clone: true, cast: clamp01(M.t / M.d) });
}
function drawDissolve(ctx, A, time) {
  const k = clamp01(A.cine.t / (AST.cine.kill * 0.7));
  ctx.save(); ctx.globalAlpha = 1 - k; drawGoddess(ctx, A.kx, A.ky, time, { fade: k }); ctx.restore();
  for (let i = 0; i < 70; i++) { // she dissolves into stars that rise and scatter into the sky
    const a = hash(i) * TAU, sp = 60 + hash(i + 5) * 420, t = k * (0.6 + hash(i + 9) * 0.6);
    const x = A.kx + Math.cos(a) * sp * t, y = A.ky - 30 + Math.sin(a) * sp * t * 0.7 - t * 260;
    ctx.globalAlpha = Math.max(0, 1 - t * 0.8); circle(ctx, x, y, 2 + hash(i + 2) * 4, i % 3 ? '#fff4c8' : '#9fc4ff', 0);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ the goddess + her Aegis Stars
export function drawAstraelEnemy(ctx, e, sim, time) {
  const A = sim.astrael;
  if (e.type === 'astralstar' || e.type === 'astralshard') { drawAegis(ctx, e, time); return; } // (C2: the Astral World's shards wear the Aegis Star)
  XM = !!(A && A.x);
  drawGoddess(ctx, e.x, e.y, time, { hurt: e.flash > 0 ? e.flash : 0, shield: A && A.shield === 1 ? 1 : 0, bigbang: A && A.st === 'bigbang', mirror: !!(A && A.mirror), cast: !!(A && A.tele && A.tele.some((q) => q.t < (q.show ?? q.d) + 10)) });
}
let XM = false; // Astrael (Extreme): her own painted art
function drawGoddess(ctx, x, y, time, o = {}) {
  // painted (Options > Art style: Painted): the goddess / her cast pose / the Reflection / the Extreme art; the shield bubble stays
  if (drawPaintedAstrael(ctx, x, y, { t: time, extreme: XM && !o.clone, cast: o.cast === true, clone: !!o.clone, hurt: o.hurt || 0, bigbang: o.bigbang })) {
    if (o.shield) { ctx.save(); ctx.globalAlpha *= 0.25 + 0.15 * Math.sin(time * 6); circle(ctx, x, y - 70, 72 * 1.6, 'rgba(200,220,255,.35)', 3, '#dfe8ff'); ctx.restore(); }
    return;
  }
  const r = 72, bob = Math.sin(time * 1.8) * 6;
  ctx.save(); ctx.translate(x, y);
  if (!o.clone) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, r * 0.7, r * 0.9, r * 0.32, 0, 0, TAU); ctx.fill(); } // the real one casts a shadow
  ctx.translate(0, -20 + bob);
  if (o.clone) ctx.scale(-1, 1); // the reflection is mirrored
  const aura = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.2); aura.addColorStop(0, o.bigbang ? 'rgba(255,255,255,.7)' : o.clone ? 'rgba(200,210,255,.35)' : 'rgba(160,190,255,.45)'); aura.addColorStop(1, 'rgba(40,40,120,0)');
  ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, TAU); ctx.fill();
  // starry robe (a long flowing gown)
  const robe = ctx.createLinearGradient(0, -r, 0, r * 1.2); robe.addColorStop(0, o.clone ? '#9aa4d8' : '#3b4aa8'); robe.addColorStop(1, o.clone ? '#dfe4ff' : '#131a4a');
  ctx.beginPath(); ctx.moveTo(-22, -20); ctx.quadraticCurveTo(-r * 0.9, r * 0.6, -r * 0.8 + Math.sin(time * 2) * 6, r * 1.05); ctx.lineTo(r * 0.8 + Math.sin(time * 2 + 1) * 6, r * 1.05); ctx.quadraticCurveTo(r * 0.9, r * 0.6, 22, -20); ctx.closePath();
  ctx.fillStyle = robe; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  for (let i = 0; i < 12; i++) circle(ctx, (hash(i) - 0.5) * r * 1.2, hash(i + 4) * r, 1.5 + hash(i + 8) * 1.5, '#fff8dc', 0);
  // arms raised, holding starlight
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 18, -14); ctx.quadraticCurveTo(s * 52, -30, s * 60, -64 + Math.sin(time * 2 + s) * 5); ctx.lineWidth = 9; ctx.strokeStyle = o.clone ? '#e8ecff' : '#cfd8ff'; ctx.stroke(); circle(ctx, s * 60, -68 + Math.sin(time * 2 + s) * 5, 8 + Math.sin(time * 5) * 2, '#fff4c8', 2, '#9fb8ff'); }
  // head + flowing star hair
  ctx.beginPath(); ctx.moveTo(-16, -44); ctx.quadraticCurveTo(-40, -10, -30 + Math.sin(time * 1.5) * 8, 30); ctx.lineTo(30 + Math.sin(time * 1.5 + 1) * 8, 30); ctx.quadraticCurveTo(40, -10, 16, -44); ctx.closePath(); ctx.fillStyle = o.clone ? '#c8d0ff' : '#6a7dff'; ctx.fill();
  circle(ctx, 0, -46, 17, o.clone ? '#f4f6ff' : '#e8ecff', 3.5, INK);
  ctx.fillStyle = o.clone ? '#8a94c8' : '#2b3a8a'; ctx.beginPath(); ctx.arc(-6, -46, 2.6, 0, TAU); ctx.arc(6, -46, 2.6, 0, TAU); ctx.fill();
  // the crescent on her brow (points the other way on the clone because the whole body is mirrored)
  ctx.beginPath(); ctx.arc(-3, -62, 7, Math.PI * 0.3, Math.PI * 1.7); ctx.arc(-1, -62, 5, Math.PI * 1.6, Math.PI * 0.4, true); ctx.closePath(); ctx.fillStyle = '#fff4c8'; ctx.fill();
  // halo: GOLD on the real one, SILVER on the reflection
  ctx.save(); ctx.rotate(time * 0.5); ctx.lineWidth = 5; ctx.strokeStyle = o.clone ? '#e6ecff' : '#ffd84a'; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.ellipse(0, -52, 34, 34, 0, 0, TAU); ctx.stroke();
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; circle(ctx, Math.cos(a) * 34, -52 + Math.sin(a) * 34, 3.5, o.clone ? '#ffffff' : '#fff0a0', 0); }
  ctx.restore();
  if (o.shield) { ctx.globalAlpha = 0.25 + 0.15 * Math.sin(time * 6); circle(ctx, 0, 0, r * 1.25, 'rgba(200,220,255,.35)', 3, '#dfe8ff'); ctx.globalAlpha = 1; }
  if (o.hurt) { ctx.globalAlpha = 0.35; circle(ctx, 0, 0, r * 0.9, '#ffffff', 0); ctx.globalAlpha = 1; }
  ctx.restore();
}
/** Aegis Star (the Collapse of Heaven add): a layered celestial construct - a bevelled gold star-shield of overlapping
 *  plates with engraved trim, a runed inner ring and a faceted crystal core (static layers cached), shards orbiting live. */
function aegisBody(g) {
  const L = -2.3, plate = (n, R0, R1, col, rot) => {
    g.beginPath(); for (let i = 0; i < n * 2; i++) { const rr = i % 2 ? R1 : R0, a = rot + i * Math.PI / n; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath();
    const gr = g.createLinearGradient(Math.cos(L) * R0, Math.sin(L) * R0, -Math.cos(L) * R0, -Math.sin(L) * R0); gr.addColorStop(0, shade(col, 0.45)); gr.addColorStop(0.5, col); gr.addColorStop(1, shade(col, -0.4));
    g.fillStyle = gr; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
    // bevel: a facet line from every point to the centre ring, lit facets lighter
    for (let i = 0; i < n; i++) { const a = rot + i * TAU / n, lit = Math.cos(a - L); g.beginPath(); g.moveTo(Math.cos(a) * R0, Math.sin(a) * R0); g.lineTo(Math.cos(a) * R1 * 0.55, Math.sin(a) * R1 * 0.55); g.strokeStyle = lit > 0 ? 'rgba(255,250,225,.55)' : 'rgba(60,30,10,.35)'; g.lineWidth = 1.4; g.stroke(); }
  };
  plate(8, 40, 19, '#c99a3a', Math.PI / 8);
  plate(8, 34, 17, '#ffe08a', 0);
  g.beginPath(); g.arc(0, 0, 19, 0, TAU); g.fillStyle = '#2a2350'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.arc(0, 0, 16.5, 0, TAU); g.strokeStyle = '#f2c14a'; g.lineWidth = 1.6; g.stroke();
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; g.save(); g.translate(Math.cos(a) * 14, Math.sin(a) * 14); g.rotate(a); g.beginPath(); g.moveTo(-1.6, -1.6); g.lineTo(1.6, 0); g.lineTo(-1.6, 1.6); if (i % 3 === 0) { g.moveTo(0, -2); g.lineTo(0, 2); } g.strokeStyle = '#9ff7ff'; g.lineWidth = 1; g.stroke(); g.restore(); }
  // faceted crystal core
  g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + Math.PI / 6; g.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); } g.closePath();
  const cg = g.createLinearGradient(-8, -8, 8, 8); cg.addColorStop(0, '#f2ffff'); cg.addColorStop(0.45, '#8ff3ff'); cg.addColorStop(1, '#3a6fd0'); g.fillStyle = cg; g.fill(); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
  g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + Math.PI / 6; g.moveTo(0, 0); g.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); } g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 0.9; g.stroke();
  g.beginPath(); g.ellipse(-3.5, -4, 3, 1.6, -0.6, 0, TAU); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
  // rim light on the lit edge of the outer plate
  g.beginPath(); g.arc(0, 0, 37, L - 0.7, L + 0.7); g.strokeStyle = 'rgba(255,248,220,.6)'; g.lineWidth = 2; g.stroke();
}
function drawAegis(ctx, e, time) {
  const pa = paintedEnemyReady('astralstar');
  ctx.save(); ctx.translate(e.x, e.y - (pa ? 40 : 10) + Math.sin(time * 3 + e.id) * 4);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, pa ? 70 : 40, 26, 9, 0, 0, TAU); ctx.fill();
  if (!pa || !drawPaintedAegis(ctx, e, time)) {
    const spr = sprite('aegis2', 92, 92, 46, 46, aegisBody);
    ctx.save(); ctx.rotate(time * 1.2); ctx.drawImage(spr, -spr.ox, -spr.oy, spr.sw, spr.sh); ctx.restore();
  }
  for (let i = 0; i < 4; i++) { const a = -time * 2 + i * TAU / 4; ctx.save(); ctx.translate(Math.cos(a) * 50, Math.sin(a) * 50); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(0, 6); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fillStyle = '#cff6ff'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); }
  ctx.globalAlpha = 0.5 + 0.2 * Math.sin(time * 5); ctx.lineWidth = 4; ctx.strokeStyle = '#9ff7ff'; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  const k = Math.max(0, e.hp / e.maxHp); rrect(ctx, -34, -62, 68, 9, 3); ctx.fillStyle = INK; ctx.fill(); rrect(ctx, -32, -60, 64 * k, 5, 2); ctx.fillStyle = '#ffe27a'; ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ camera
/** Cinematic camera: zoom out for the collapse / Big Bang, pan to the centre, zoom in on the kill. Smoothed per frame.
 *  Returns { z, x, y } = zoom multiplier + camera pull (0..1) towards (x, y). */
export function astCamera(state, sim, local, dt) {
  const A = sim.astrael, s = state.astCam || (state.astCam = { z: 1, k: 0, x: C.x, y: C.y });
  let z = 1, k = 0, x = C.x, y = C.y;
  if (A && local && inAstArea(local.x, local.y)) {
    z = A.plats ? 0.8 : 0.86; k = 0.18;
    const cn = A.cine && A.cine.k;
    if (cn === 'collapse' || cn === 'fall') { z = 0.56; k = 1; }
    else if (cn === 'orrery' || cn === 'ignite') { z = 0.62; k = 0.9; }
    else if (cn === 'bbcine' || A.st === 'bigbang' || A.st === 'whiteout') { z = 0.7; k = 0.7; }
    else if (A.st === 'kill') { z = 1.25; k = 1; x = A.kx; y = A.ky - 40; }
    else if (A.st === 'wipe' || A.st === 'pull') { z = 0.66; k = 0.8; }
    else if (A.st === 'victory') { z = 0.8; k = 0.4; }
    if (A.planets && A.planets.list.some((p) => p.lit)) { z = Math.min(z, 0.68); k = Math.max(k, 0.6); } // see the orbiting planets
    if (A.wheel && A.wheel.ptr >= 0) { z = Math.min(z, 0.74); k = Math.max(k, 0.5); }
  }
  const f = 1 - Math.pow(0.02, dt);
  s.z += (z - s.z) * f; s.k += (k - s.k) * f; s.x += (x - s.x) * f; s.y += (y - s.y) * f;
  return s;
}

// ------------------------------------------------------------------ HUD
const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec) % 60).padStart(2, '0')}`;
const SEG_COL = { a1: '#7fa8ff', collapse: '#ffe3a0', adds: '#ffe3a0', orrery: '#ffe3a0', a2: '#c69cff', ignite: '#ffb8a0', a3: '#ff9a7a', bbcine: '#ffffff', bigbang: '#ffffff' };
/** Everything screen-space for Astrael. Returns the bottom y of the boss bar (0 = not in the sanctum). */
export function drawAstraelHud(ctx, sim, p, w, h, sc, txt, bar, time = 0) {
  const A = sim.astrael;
  if (!A || !p || !inAstArea(p.x, p.y)) return 0;
  const b = bossOf(sim, A);
  // letterbox bars (big attacks, cinematics, the Big Bang)
  const lbk = clamp01((A.lb || 0) / 20) * (A.st === 'wipe' ? 0 : 1), lbh = Math.round(h * 0.09 * lbk);
  if (lbh > 0) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, lbh); ctx.fillRect(0, h - lbh, w, lbh); }
  // the boss bar + the phase timeline
  let y = Math.max(lbh + 8 * sc, 96 * sc);
  const bbw = Math.min(700 * sc, w * (sc < 1 ? 0.84 : 0.58)), bbx = w / 2 - bbw / 2, H = Math.round(20 * sc);
  if (A.st !== 'wipe' && A.st !== 'victory') {
    const SEGS = segsOf(A);
    txt(ctx, nameOf(A), w / 2, y - 4 * sc, Math.round(21 * sc), A.x ? '#ffb8d8' : '#dfe8ff', 'center');
    const k = b ? Math.max(0, b.hp / b.maxHp) : A.st === 'kill' ? 0 : 1;
    bar(ctx, bbx, y + 10 * sc, bbw, H, k, A.st === 'bigbang' ? '#ffffff' : A.act === 3 ? '#ff8a6a' : A.act === 2 ? '#b98cff' : '#7fa8ff', b && sc >= 1 ? `${Math.ceil(b.hp)} / ${b.maxHp}` : null);
    for (const f of [AST.floors.a1, AST.floors.a2, AST.floors.a3]) { ctx.fillStyle = INK; ctx.fillRect(bbx + bbw * f - 2, y + 8 * sc, 4, H + 4); }
    if (A.shield === 2) txt(ctx, A.gate ? (A.st === 'a3' ? 'THE LAST LIGHT: the Big Bang comes after this mechanic' : 'ACT BROKEN: she moves on after this mechanic') : 'STAR-SHIELD: hold on until the act ends', w / 2, y + 10 * sc + H + 12 * sc, Math.round(12 * sc), '#fff2b0', 'center', 3);
    // timeline strip
    const ty = y + 10 * sc + H + (A.shield === 2 ? 22 : 8) * sc, th = Math.round(8 * sc), total = SEGS.reduce((s, x) => s + x[1], 0);
    let xx = bbx;
    for (const [k2, d] of SEGS) { const ww = bbw * d / total; ctx.fillStyle = SEG_COL[k2]; ctx.globalAlpha = 0.5; ctx.fillRect(xx, ty, ww - 1, th); xx += ww; }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bbx + bbw * (A.prog || 0) - 2, ty - 3 * sc, 4, th + 6 * sc);
    if (A.best > 0 && A.best < 1) { ctx.fillStyle = '#ffd84a'; ctx.fillRect(bbx + bbw * A.best - 1, ty - 3 * sc, 2, th + 6 * sc); }
    const lab = segLabel(A.st) + (/^a[123]$/.test(A.st) && A.jobNames && A.jobNames.length ? ' · ' + A.jobNames.join(' + ') : '');
    txt(ctx, `${lab}${A.wipes ? ` · attempt ${A.wipes + 1}` : ''}`, w / 2, ty + th + 12 * sc, Math.round(13 * sc), '#d9c6ff', 'center', 3);
    y = ty + th + 20 * sc;
    if (A.check && A.st === 'adds') { // the Aegis Star damage check
      const left = Math.max(0, (A.check.d - A.check.t) / 60);
      txt(ctx, `AEGIS STARS · ${left.toFixed(0)}s before the platforms fall`, w / 2, y + 8 * sc, Math.round(15 * sc), left < 10 ? '#ff6a6a' : '#ffe3a0', 'center', 3);
      rrect(ctx, bbx + bbw * 0.2, y + 16 * sc, bbw * 0.6 * (left / (A.check.d / 60)), 6 * sc, 3); ctx.fillStyle = '#ffe3a0'; ctx.fill();
      y += 28 * sc;
    }
  }
  // local player's delayed debuffs (HUD list, in resolve order)
  const mine = (A.ds || []).filter((d) => d.pid === p.id).sort((a, c) => (a.d - a.t) - (c.d - c.t));
  mine.forEach((d, i) => { const yy = h * 0.62 + i * 26 * sc; txt(ctx, `${Math.max(0, (d.d - d.t) / 60).toFixed(1)}s  ${DEBUFF_NAMES[d.k]} — ${DEBUFF_HINT[d.k]}`, w / 2, yy, Math.round(16 * sc), DB_COL[d.k], 'center', 4); });
  // name card (mechanic / act) with a sweep band
  const c = A.call;
  if (c) {
    const age = (c.d - c.t) / 60, pop = Math.max(0, 1 - age * 4), fade = Math.min(1, c.t / 20), cy = h * (sc < 1 ? 0.33 : 0.3);
    ctx.save(); ctx.globalAlpha = fade * 0.55; const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(10,14,40,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, cy - 40 * sc, w, 84 * sc); ctx.restore();
    ctx.save(); ctx.globalAlpha = fade; ctx.translate(w / 2, cy); const s = 1 + Math.round(pop * 3) / 10; ctx.scale(s, s); // (stepped pop: few text bakes)
    txt(ctx, c.txt, 0, 0, Math.round((c.txt.length > 22 ? 34 : 42) * sc), c.col, 'center', Math.round(8 * sc));
    if (c.sub) txt(ctx, c.sub, 0, 30 * sc, Math.round(16 * sc), '#ffffff', 'center', 4);
    ctx.restore();
  }
  // boss line (on-screen text)
  const L = A.line;
  if (L) { const fade = Math.min(1, L.t / 20, (L.d - L.t) / 12); ctx.save(); ctx.globalAlpha = fade; txt(ctx, `“${L.txt}”`, w / 2, h * 0.72, Math.round(19 * sc), '#e6ecff', 'center', 4); txt(ctx, 'ASTRAEL', w / 2, h * 0.72 - 26 * sc, Math.round(12 * sc), '#9fb8ff', 'center', 3); ctx.restore(); }
  // the Big Bang countdown + white-out
  if (A.st === 'bigbang' && A.bb) {
    const left = Math.max(0, (A.bb.d - A.bb.t) / 60);
    ctx.save(); ctx.globalAlpha = 0.15 + 0.5 * (1 - left / 20); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.restore();
    txt(ctx, left.toFixed(1), w / 2, h * 0.5, Math.round((64 + (1 - left / 20) * 40) * sc), left < 5 ? '#ff4d6a' : '#ffffff', 'center', Math.round(10 * sc));
    txt(ctx, `BURN HER DOWN · +${Math.round((AST.bigbang.vuln - 1) * 100)}% DAMAGE`, w / 2, h * 0.5 + 34 * sc, Math.round(16 * sc), '#ffe7a0', 'center', 4);
  }
  if (A.st === 'whiteout') { const k = clamp01(A.cine ? A.cine.t / (AST.cine.whiteout * 0.6) : 1); ctx.fillStyle = `rgba(255,255,255,${k})`; ctx.fillRect(0, 0, w, h); }
  if (A.st === 'fall') { const k = clamp01(A.cine ? A.cine.t / AST.cine.fall : 1); ctx.fillStyle = `rgba(0,0,10,${k * 0.7})`; ctx.fillRect(0, 0, w, h); }
  if (A.st === 'wipe') drawWipe(ctx, A, w, h, sc, txt);
  return y;
}
const REASON = { fallen: 'The party fell', fall: 'The Aegis Stars survived: the platforms fell', bigbang: 'The Big Bang: too slow (soft enrage)', lost: 'The goddess vanished', dev: 'Reset' };
function drawWipe(ctx, A, w, h, sc, txt) {
  const k = clamp01(A.at / 30), W = A.lastWipe || {}, SEGS = segsOf(A);
  ctx.fillStyle = `rgba(4,6,20,${0.82 * k})`; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.globalAlpha = k;
  if (uiOn()) { ctx.font = `${Math.round(48 * sc)}px 'Lilita One', sans-serif`; const iw = ctx.measureText('THE HEAVENS RESET').width + 60 * sc; uiAround(ctx, 'defeat', w / 2 - iw / 2, h * 0.28 - 32 * sc, iw, 84 * sc); } // U3 defeat banner (painted)
  txt(ctx, 'THE HEAVENS RESET', w / 2, h * 0.28, Math.round(48 * sc), '#ff6a8a', 'center', Math.round(9 * sc));
  txt(ctx, REASON[W.reason] || 'Wipe', w / 2, h * 0.28 + 38 * sc, Math.round(18 * sc), '#ffffff', 'center', 4);
  const bw = Math.min(620 * sc, w * 0.8), bx = w / 2 - bw / 2, by = h * 0.45, total = SEGS.reduce((s, x) => s + x[1], 0);
  let xx = bx;
  for (const [k2, d, name] of SEGS) { const ww = bw * d / total; ctx.fillStyle = SEG_COL[k2]; ctx.globalAlpha = k * 0.35; ctx.fillRect(xx, by, ww - 1, 18 * sc); xx += ww; void name; }
  ctx.globalAlpha = k; ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by, bw * (W.prog || 0) / 100, 18 * sc);
  if (A.best) { ctx.fillStyle = '#ffd84a'; ctx.fillRect(bx + bw * A.best - 2, by - 5 * sc, 4, 28 * sc); }
  const segAt = (key) => { let t = 0; for (const [k3, d] of SEGS) { if (k3 === key) return t; t += d; } return t; };
  for (const [name, at] of [['I', segAt('a1')], ['II', segAt('a2')], ['III', segAt('a3')], ['BB', segAt('bigbang')]]) txt(ctx, name, bx + bw * at / total + 12 * sc, by + 36 * sc, Math.round(13 * sc), '#bfc8ff', 'center', 3);
  txt(ctx, `You reached ${W.prog || 0}% · ${W.seg || ''}${W.mech && W.mech.length ? ' · ' + W.mech.join(' + ') : ''}`, w / 2, by + 62 * sc, Math.round(18 * sc), '#dfe8ff', 'center', 4);
  txt(ctx, `${nameOf(A)} at ${W.hp ?? 100}% HP · ${fmt(W.t || 0)} into the fight · best ${Math.round((A.best || 0) * 100)}%`, w / 2, by + 88 * sc, Math.round(15 * sc), '#bfc8ff', 'center', 3);
  txt(ctx, A.hub ? `Returning to Brightwater Village in ${Math.max(0, Math.ceil((AST.wipe - A.at) / 60))}s` : `Attempt ${A.wipes + 1} begins in ${Math.max(0, Math.ceil((AST.wipe - A.at) / 60))}s — the whole fight restarts`, w / 2, by + 124 * sc, Math.round(16 * sc), '#ffe7a0', 'center', 4);
  ctx.restore();
}
/** Minimap inside the sanctum. */
export function drawAstraelMinimap(ctx, x, y, R, sim, p, classes) {
  const A = sim.astrael, k = (R - 6) / AST_R;
  circle(ctx, x, y, R + 5, INK, 0); circle(ctx, x, y, R, '#0b1030', 0);
  if (A && A.plats) for (let i = 0; i < 4; i++) { const c = platCenter(i); circle(ctx, x + (c.x - C.x) * k, y + (c.y - C.y) * k, PLAT.r * k, '#2c3a78', 1.5, '#9fc4ff'); }
  else circle(ctx, x, y, R - 6, A && A.clock ? '#3a1a34' : '#1c2656', 2, '#9fc4ff');
  if (A) { const b = bossOf(sim, A); if (b) circle(ctx, x + (b.x - C.x) * k, y + (b.y - C.y) * k, 6, '#ffd84a', 2); }
  for (const q of sim.players.values()) if (!q.dead && inAstArea(q.x, q.y)) circle(ctx, x + (q.x - C.x) * k, y + (q.y - C.y) * k, q.id === p.id ? 4.5 : 3.5, q.id === p.id ? '#ffffff' : (classes[q.cls] ? classes[q.cls].color : '#fff'), 1.5);
}

// ------------------------------------------------------------------ event reactions + sounds
export function astraelEventFx(fx, ev, me) {
  switch (ev.ph) {
    case 'portal': fx.banner('A STAR HAS FALLEN', '#ffe7a0', 'Step into it to take the party to Astrael', 3, 48); fx.ring(ev.x, ev.y, 160, '#ffe7a0', 0.8, 10); break;
    case 'enter': fx.ring(ev.x, ev.y, 90, '#ffe7a0', 0.5, 8); fx.puffs(ev.x, ev.y, 14, '#9fc4ff', 14, 140, 0.6); if (me) { fx.flash = Math.max(fx.flash || 0, 0.5); fx.flashColor = '#dfe8ff'; } break;
    case 'leave': fx.puffs(ev.x, ev.y, 10, '#ffe7a0', 12, 110, 0.5); break;
    case 'start': fx.shake(0.5); fx.ring(ev.x, ev.y, 300, '#9fc4ff', 0.8, 14); break;
    case 'act': fx.shake(0.6); fx.ring(ev.x, ev.y, 420, ev.act === 3 ? '#ffb8a0' : ev.act === 2 ? '#c69cff' : '#9fc4ff', 1, 16); fx.flash = Math.max(fx.flash || 0, 0.4); fx.flashColor = '#ffffff'; break;
    case 'boom': {
      const col = ev.k === 'comet' ? AST_COL.comet : ev.k === 'crown' ? AST_COL.stack : ev.k === 'spread' ? AST_COL.spread : ev.k === 'lance' ? '#ff4fd8' : ev.k === 'zodiac' ? '#ffd08a' : '#ffffff';
      if (ev.sh === 'circle') { fx.ring(ev.x, ev.y, (ev.r || 100) * 1.1, col, 0.4, 10); fx.sparks(ev.x, ev.y, 0, 12, col, 360, Math.PI); }
      else if (ev.sh === 'cone') fx.add({ type: 'slash', x: ev.x, y: ev.y, ang: ev.ang, arc: ev.arc, r: ev.len, life: 0.3, color: col, width: 26, dir: 1 });
      else if (ev.sh === 'rect') fx.add({ type: 'trail', x: ev.x - Math.cos(ev.ang) * ev.len / 2, y: ev.y - Math.sin(ev.ang) * ev.len / 2, x2: ev.x + Math.cos(ev.ang) * ev.len / 2, y2: ev.y + Math.sin(ev.ang) * ev.len / 2, life: 0.35, color: '#ffffff' });
      else if (ev.sh === 'notwedge') { fx.flash = Math.max(fx.flash || 0, 0.3); fx.flashColor = '#ffb08a'; }
      else if (ev.sh === 'plat' && !ev.fake) { fx.ring(ev.x, ev.y, 200, AST_COL.mirror, 0.4, 12); }
      fx.shake(ev.sh === 'notwedge' ? 0.5 : 0.25);
      break;
    }
    case 'constBoom': fx.shake(ev.shape === 'shield' ? 0.7 : 0.4); fx.ring(ev.x, ev.y, 260, ev.shape === 'crown' ? AST_COL.stack : '#dfe8ff', 0.5, 12); break;
    case 'sunBurst': fx.ring(ev.wx, ev.wy, ev.r, AST_COL.warm, 0.6, 16); fx.ring(ev.cx, ev.cy, ev.r, AST_COL.cold, 0.6, 16); fx.shake(0.6); fx.flash = Math.max(fx.flash || 0, 0.35); fx.flashColor = '#fff4d0'; break;
    case 'cometFail': fx.shake(1); fx.flash = Math.max(fx.flash || 0, 0.6); fx.flashColor = '#ff8a4a'; fx.banner('UNSOAKED COMET', '#ff8a4a', 'Someone missed their marker', 1.4, 44); break;
    case 'planet': fx.ring(ev.x, ev.y, 520, '#ffcf8a', 0.5, 6); break;
    case 'mirrorRes': fx.puffs(ev.fx, ev.fy, 20, '#e6ecff', 16, 160, 0.8); break;
    case 'threadOk': fx.sparks(ev.x, ev.y, 0, 14, AST_COL.safe, 300, Math.PI); break;
    case 'threadFail': fx.sparks(ev.x, ev.y, 0, 24, AST_COL.danger, 420, Math.PI); fx.shake(0.5); fx.text(ev.x, ev.y - 20, 'THREAD SNAPPED', { size: 18, color: '#ff6a8a', vy: -40, pop: 1.4, life: 0.9 }); break;
    case 'nova': fx.ring(ev.x, ev.y, ev.r, '#ff7a3a', 0.5, 14); fx.sparks(ev.x, ev.y, 0, 30, '#ffd08a', 520, Math.PI); fx.shake(0.6); break;
    case 'gravity': fx.ring(ev.x, ev.y, 260, '#b99cff', 0.5, 10); break;
    case 'debuffRes': fx.text(ev.x, ev.y - 70, ev.ok ? 'OK!' : ev.k === 'still' ? 'YOU MOVED' : 'STOOD STILL', { size: 18, color: ev.ok ? '#6dffb0' : '#ff6a8a', vy: -30, pop: 1.3, life: 0.9 }); break;
    case 'sign': fx.ring(ev.x, ev.y, 480, '#ffe7a0', 0.4, 6); break;
    case 'shatter': fx.shake(1.2); fx.flash = Math.max(fx.flash || 0, 0.7); fx.flashColor = '#ffe3a0'; fx.ring(ev.x, ev.y, 600, '#ffe3a0', 0.9, 20); fx.chunks && fx.chunks(ev.x, ev.y, 40, '#2c3a78', 520); break;
    case 'merge': fx.shake(0.9); fx.flash = Math.max(fx.flash || 0, 0.6); fx.flashColor = '#ffb8a0'; fx.ring(ev.x, ev.y, 560, '#ffb8a0', 0.9, 18); break;
    case 'bigbang': fx.shake(1.2); fx.flash = Math.max(fx.flash || 0, 0.8); fx.flashColor = '#ffffff'; break;
    case 'count': if (ev.n <= 5) fx.shake(0.3); break;
    case 'fall': if (me) fx.banner('FALL FROM HEAVEN', '#9fc4ff', 'Knocked off the edge', 1.2, 40); fx.puffs(ev.x, ev.y, 12, '#dfe8ff', 14, 140, 0.6); break;
    case 'hit': if (me) fx.text(ev.x, ev.y - 70, ev.what.toUpperCase(), { size: 18, color: '#ff8a9a', vy: -30, pop: 1.3, life: 1 }); break;
    case 'mend': fx.text(ev.x, ev.y - 64, 'CLEAN! STARLIGHT MEND', { size: me ? 18 : 14, color: '#7dffb0', vy: -40, pop: 1.3, life: 1 }); fx.ring(ev.x, ev.y + 10, 50, '#7dffb0', 0.4, 5); break;
    case 'revive': fx.ring(ev.x, ev.y, 80, '#fff4c8', 0.6, 8); break;
    case 'kill': fx.shake(1.4); fx.flash = Math.max(fx.flash || 0, 0.9); fx.flashColor = '#fff4c8'; fx.ring(ev.x, ev.y, 700, '#fff4c8', 1.4, 20); break;
    case 'gate': fx.shake(0.5); fx.ring(ev.x, ev.y, 360, '#fff2b0', 0.7, 12); break;
    case 'unlock': if (me) { fx.banner('ASTRAEL (EXTREME) UNLOCKED', '#ffb8d8', 'Pick it at the Mission Counter in Brightwater Village', 5, 50); } break;
    case 'victory': fx.banner('THE SKY IS REBORN', '#ffe27a', `${ev.ex ? 'Astrael (Extreme)' : 'Astrael'} cleared in ${fmt(ev.t)}${ev.wipes ? ` after ${ev.wipes} wipe${ev.wipes > 1 ? 's' : ''}` : ''}`, 5, 60, 'victory'); break;
    case 'wipe': fx.shake(0.8); break;
    case 'cine': if (ev.k === 'whiteout') { fx.flash = 1; fx.flashColor = '#ffffff'; } break;
    default: break;
  }
}
export function astraelSound(au, ev, me) {
  switch (ev.ph) {
    case 'call': au.tone('triangle', 520, 780, 0.18, 0.16); au.tone('sine', 1040, 1560, 0.3, 0.1, 0.12); break;
    case 'line': au.tone('sine', 330, 440, 0.4, 0.08); break;
    case 'boom': case 'constBoom': au.tone('sine', 130, 40, 0.4, 0.4); au.hiss(1600, 200, 0.3, 0.25); break;
    case 'sunBurst': case 'nova': au.tone('sawtooth', 200, 60, 0.5, 0.3); au.hiss(3000, 300, 0.4, 0.3); break;
    case 'hit': if (me) au.tone('square', 220, 90, 0.18, 0.14); break;
    case 'mend': if (me) au.tone('sine', 880, 1320, 0.2, 0.12); break;
    case 'planet': case 'sign': au.tone('triangle', 660 + (ev.i || 0) * 220, 660 + (ev.i || 0) * 220, 0.35, 0.18); break;
    case 'threadOk': au.tone('triangle', 1200, 1600, 0.12, 0.12); break;
    case 'threadFail': case 'cometFail': au.tone('sawtooth', 160, 40, 0.5, 0.35); break;
    case 'shatter': case 'merge': case 'bigbang': au.tone('sawtooth', 90, 30, 1.2, 0.4); au.hiss(700, 60, 1, 0.45); break;
    case 'count': au.tone('sine', ev.n <= 5 ? 1200 : 800, ev.n <= 5 ? 1200 : 800, 0.08, 0.14); break;
    case 'kill': [392, 523, 659, 784, 1046, 1318].forEach((f, i) => au.tone('triangle', f, f, 0.5, 0.18, i * 0.14)); break;
    case 'victory': [523, 659, 784, 1046].forEach((f, i) => au.tone('triangle', f, f, 0.3, 0.2, i * 0.12)); break;
    case 'wipe': au.tone('sine', 300, 60, 1.2, 0.35); break;
    case 'portal': case 'enter': case 'leave': au.tone('sine', 500, 1500, 0.4, 0.2); au.tone('sine', 750, 2200, 0.4, 0.12, 0.08); break;
    case 'act': case 'start': case 'pull': au.tone('sine', 110, 220, 1, 0.3); au.tone('triangle', 440, 660, 0.8, 0.12, 0.2); break;
    default: return false;
  }
  return true;
}
/** (Old pause-menu button: replaced by the town's Mission Counter + "Return to Town"; hidden if an old page has it.) */
export function syncAstraelButton(game) {
  const btn = typeof document !== 'undefined' && document.getElementById('astraelBtn');
  if (btn) btn.classList.add('hidden');
  void game;
}
/** Slow-motion scale for a solo client (ev.slow on 'cine' / big hits); co-op only shows the letterbox + camera. */
export const astraelSlow = (ev) => (ev.type === 'astrael' && ev.slow > 0 ? { sec: ev.ph === 'kill' ? 1.2 : ev.ph === 'cine' ? 0.8 : 0.35, scale: Math.max(0.25, ev.slow) } : null);
