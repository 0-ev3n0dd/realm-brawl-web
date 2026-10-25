// Dragoon effects + sounds: lance thrusts, sky dives with landing reticles, crimson dragon fire and the indigo dragon spirit.
// Driven by 'drg' (predicted: casts, finishers, strikes, leaps, the Roar) and 'drgx' (server: Blood gains, pins, fire echoes,
// dive chaining, Wyrmstorm rain, Nidhogg's Fall). Exports the dragon spirit drawer (render.js draws it over the hero in
// Dragon Form), the airborne lift curve (DRG_AIR in the sim), the Skyborne aura, cinematics merged into the FX core's CINE
// table and UNDER (landing reticles under the actors).
import { DRG_AIR } from '../sim/dragoon.js';
import { drawSpear } from './art.js';
import { momFin, momNidMark, momNidhogg } from './fxmoment.js'; // the Nidhogg's Fall signature moment
const TAU = Math.PI * 2;
export const DRG_COL = { indigo: '#5a4bff', violet: '#9a6bff', crimson: '#ff3048', fire: '#ff7a1e', ember: '#ffb347', hi: '#fff1e0', sky: '#bcd4ff', blood: '#d0102a' };
const C = DRG_COL;
const rnd = (a, b) => a + Math.random() * (b - a);
const lite = (fx) => fx.partMul !== undefined && fx.partMul < 1;
const N = (fx, n) => Math.max(1, Math.round(n * (fx.partMul ?? 1)));
const below = (ev, extra = 0) => ev.y + (ev.r || 24) + 34 + extra;

// ------------------------------------------------------------------ the dragon spirit
/** A serpentine indigo/violet dragon with crimson fire glow, wings, a horned head and glowing eyes, coiling around (x, y). */
export function drawDragon(ctx, x, y, ang, t, a = 0.8, scale = 1, seed = 0) {
  if (!(a > 0)) return;
  const s = scale, ph = t * 2.2 + (typeof seed === 'number' ? seed : 0) * 0.7, n = 18, pts = [];
  for (let i = 0; i < n; i++) { // body: a coil behind and around the hero, head leading toward `ang`
    const k = i / (n - 1), th = ang + Math.PI * 0.15 - k * Math.PI * 1.7 + Math.sin(ph + k * 4) * 0.25, rr = (70 + k * 40) * s;
    pts.push([x + Math.cos(th) * rr, y - 60 * s + Math.sin(th) * rr * 0.55 - Math.sin(ph * 0.8 + k * 5) * 14 * s]);
  }
  ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // fire glow under the body
  ctx.globalCompositeOperation = 'lighter';
  for (let i = n - 1; i >= 0; i -= 2) { const [px, py] = pts[i], g = ctx.createRadialGradient(px, py, 0, px, py, 36 * s); g.addColorStop(0, 'rgba(255,60,72,.45)'); g.addColorStop(1, 'rgba(255,60,72,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 36 * s, 0, TAU); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
  // wings (from the 4th segment), beating
  const [wx, wy] = pts[4], beat = Math.sin(t * 6 + ph) * 0.35;
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(wx, wy); ctx.rotate(ang + side * (1.2 + beat)); ctx.scale(s, s * side);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(40, -70, 110, -60); ctx.lineTo(80, -30); ctx.lineTo(95, -10); ctx.lineTo(60, 0); ctx.lineTo(70, 18); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 110, -60); g.addColorStop(0, 'rgba(70,40,170,.85)'); g.addColorStop(1, 'rgba(200,60,120,.55)');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,200,230,.7)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
  // body: thick tapering stroke, scales stripe, spines
  for (let i = n - 1; i > 0; i--) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i - 1], w = (8 + (1 - i / n) * 18) * s;
    ctx.strokeStyle = '#1c1240'; ctx.lineWidth = w + 5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = i % 2 ? '#5a4bff' : '#7b5cff'; ctx.lineWidth = w; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,120,140,.75)'; ctx.lineWidth = w * 0.3; ctx.stroke();
    if (i % 3 === 0) { const nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny) || 1; ctx.fillStyle = '#ff3048'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + nx / L * w * 0.9, y0 + ny / L * w * 0.9 - 4 * s); ctx.lineTo(x1, y1); ctx.fill(); }
  }
  // head
  const [hx, hy] = pts[0], [nx2, ny2] = pts[1], ha = Math.atan2(hy - ny2, hx - nx2);
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(ha); ctx.scale(s, s);
  ctx.fillStyle = '#4636c8'; ctx.strokeStyle = '#1c1240'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-14, -14); ctx.quadraticCurveTo(14, -16, 34, -5); ctx.lineTo(38, 2); ctx.lineTo(20, 6); ctx.lineTo(34, 12); ctx.quadraticCurveTo(10, 18, -14, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#e8dcff'; ctx.lineWidth = 3.5; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-6, sd * 10); ctx.quadraticCurveTo(-22, sd * 20, -34, sd * 14); ctx.stroke(); } // horns
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(14, -6, 3.4, 0, TAU); ctx.fill();
  const eg = ctx.createRadialGradient(14, -6, 0, 14, -6, 14); eg.addColorStop(0, 'rgba(255,90,60,.9)'); eg.addColorStop(1, 'rgba(255,90,60,0)'); ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(14, -6, 14, 0, TAU); ctx.fill();
  // ember breath wisps
  for (let i = 0; i < 4; i++) { const q = (t * 3 + i * 0.25) % 1; ctx.globalAlpha = a * (1 - q) * 0.8; ctx.fillStyle = i % 2 ? '#ff7a1e' : '#ff3048'; ctx.beginPath(); ctx.arc(38 + q * 50, 4 + Math.sin(i * 2 + t * 9) * 6 * q, 5 * (1 - q) + 2, 0, TAU); ctx.fill(); }
  ctx.restore(); ctx.restore();
}
/** The Dragoon's airborne lift: { h (px above the ground), k (0..1), hide? } or null. */
export function drgLift(a) {
  if (!a || a.kind !== 'skill') return null;
  const f = DRG_AIR[a.chain ? (a.chain.id || a.chain) : a.id];
  return f ? f({ t: a.t, data: a.data || {} }) : null;
}
/** Skyborne: wind streaks + an indigo halo around the airborne-ready hero. */
export function drawSkyAura(ctx, x, y, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y - 20, 4, x, y - 20, 64); g.addColorStop(0, 'rgba(120,110,255,.35)'); g.addColorStop(1, 'rgba(120,110,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 20, 64, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(188,212,255,.8)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const q = (t * 1.6 + i / 5) % 1, sx = x + Math.cos(i * 1.3) * 26; ctx.globalAlpha = 1 - q; ctx.beginPath(); ctx.moveTo(sx, y + 10 - q * 80); ctx.lineTo(sx, y - 6 - q * 80); ctx.stroke(); }
  ctx.restore();
}

// ------------------------------------------------------------------ building blocks
function glow(fx, x, y, size, col, life = 0.3, a = 0.8) { if (!Number.isFinite(x + y + size)) return; if (!lite(fx)) fx.add({ type: 'glow', x, y, size, color: col, life, a }); }
function rays(fx, x, y, r, col, n = 12, life = 0.35, w = 6) { fx.add({ type: 'rays', x, y, r, color: col, n: Math.max(6, N(fx, n)), life, w, seed: rnd(0, TAU) }); }
function flash(fx, me, col, amt) { if (me) { fx.flash = Math.max(fx.flash || 0, amt); fx.flashColor = col; } }
function dark(fx, pid, life, a, col) { fx.cine.push({ kind: 'dark', t: 0, life, a, pid, col }); }
function crack(fx, x, y, r, col = C.fire, life = 1.3, n = 7) { fx.add({ type: 'crack', x, y, r, life, seed: rnd(0, TAU), glow: true, col, n, lite: lite(fx) }); }
function embers(fx, x, y, n, col = C.ember, spread = 60, up = 240) { for (let i = 0; i < N(fx, n); i++) fx.add({ type: 'dot', x: x + rnd(-spread, spread), y: y + rnd(-spread * 0.4, spread * 0.4), vx: rnd(-40, 40), vy: -rnd(up * 0.5, up), life: rnd(0.5, 0.9), size: rnd(2, 4.5), color: col }); }
function fire(fx, x, y, r, big = 1) { // a burst of dragon fire: crimson/orange bloom, embers, smoke
  glow(fx, x, y, r * 1.2, C.crimson, 0.4, 0.75); glow(fx, x, y, r * 0.7, C.fire, 0.3, 0.8);
  fx.add({ type: 'flash', x, y, life: 0.12, size: r * 0.8, color: C.hi });
  embers(fx, x, y, 10 * big, C.ember, r * 0.6, 280); fx.puffs(x, y, N(fx, 6 * big), 'rgba(60,30,40,.7)', 14, 120, 0.7);
  fx.sparks(x, y, 0, N(fx, 10 * big), C.fire, 420, Math.PI);
}
function lanceLine(fx, x, y, ang, L, col = C.violet, w = 1) { // a spear thrust: a violet streak + spear afterimages + a white core
  const x2 = x + Math.cos(ang) * L, y2 = y + Math.sin(ang) * L;
  fx.add({ type: 'trail', x, y, x2, y2, life: 0.34, color: col }); fx.add({ type: 'trail', x, y, x2, y2, life: 0.18, color: '#ffffff' });
  for (let i = 1; i <= 3; i++) fx.add({ type: 'wghost', x: x + Math.cos(ang) * L * i / 4, y: y + Math.sin(ang) * L * i / 4, ang, color: col, hi: C.hi, len: 60 * w, life: 0.18 + i * 0.05, a: 0.15 + i * 0.08, lite: lite(fx) });
  return [x2, y2];
}
function landing(fx, x, y, r, big = 1) { // a dive landing: shock rings, a fire crater, rock chunks, dust
  for (let i = 0; i < 3; i++) fx.ring(x, y, r * (1 - i * 0.25), [C.crimson, C.violet, '#ffffff'][i], 0.35 + i * 0.08, 12 * big - i * 3);
  crack(fx, x, y, r * 0.9, C.fire, 1.4 + big * 0.4, 8); fire(fx, x, y, r * 0.8, big);
  if (fx.chunks) fx.chunks(x, y, N(fx, 10 * big), '#6a4a5a', 300 * big);
  rays(fx, x, y, r * 1.3, C.crimson, 14, 0.4, 7 * big);
}

// ------------------------------------------------------------------ cinematics
export const DRG_CINE = {
  drgspear(fx, ctx, c) { // a thrown spear in flight (Spear Throw / Crimson Comet), a flame ribbon behind it
    const k = Math.min(1, c.t / c.T), x = c.x + (c.tx - c.x) * k, y = c.y + (c.ty - c.y) * k - Math.sin(k * Math.PI) * (c.h || 0), ang = Math.atan2(c.ty - c.y, c.tx - c.x);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.globalAlpha = 0.65; ctx.strokeStyle = C.crimson; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(c.x + (c.tx - c.x) * Math.max(0, k - 0.35), c.y + (c.ty - c.y) * Math.max(0, k - 0.35)); ctx.lineTo(x, y); ctx.stroke();
    ctx.globalAlpha = 0.9; ctx.strokeStyle = C.ember; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.translate(-50, 0); ctx.scale(1.2, 1.2); drawSpear(ctx, 70, C.crimson, 26); ctx.restore();
    if (k >= 1) c.life = 0;
  },
  drgroar(fx, ctx, c) { // Dragon's Roar: the dragon swoops out along the aim and breathes a river of fire
    const k = Math.min(1, c.t / c.life), x = c.x + Math.cos(c.ang) * c.len * Math.min(1, k * 1.6), y = c.y + Math.sin(c.ang) * c.len * Math.min(1, k * 1.6);
    const fade = k < 0.8 ? 1 : (1 - k) * 5;
    if (k > 0.15 && !lite(fx)) { // the breath: a widening crimson cone
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 * fade;
      const g = ctx.createLinearGradient(c.x, c.y, c.x + Math.cos(c.ang) * c.len, c.y + Math.sin(c.ang) * c.len); g.addColorStop(0, 'rgba(255,240,200,.9)'); g.addColorStop(0.4, 'rgba(255,90,40,.8)'); g.addColorStop(1, 'rgba(200,20,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(c.x, c.y);
      const nx = -Math.sin(c.ang), ny = Math.cos(c.ang), L = c.len, W = c.w * (0.6 + 0.4 * Math.sin(c.t * 20));
      ctx.lineTo(c.x + Math.cos(c.ang) * L + nx * W, c.y + Math.sin(c.ang) * L + ny * W); ctx.lineTo(c.x + Math.cos(c.ang) * L - nx * W, c.y + Math.sin(c.ang) * L - ny * W); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    drawDragon(ctx, x, y + 40, c.ang, c.t, 0.9 * fade, 1.5, 3);
  },
  drgreticle(fx, ctx, c) { // a dive's landing reticle: a shrinking crimson target ring, crosshair and a falling shadow
    const k = Math.min(1, c.t / c.life), r = c.r * (1.6 - k * 0.6);
    ctx.save(); ctx.globalAlpha = 0.8 * (1 - k * 0.3); ctx.strokeStyle = c.mk ? C.fire : C.crimson; ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]); ctx.lineDashOffset = c.t * 60; ctx.beginPath(); ctx.ellipse(c.x, c.y, r, r * 0.55, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + c.t * 2; ctx.moveTo(c.x + Math.cos(a) * r * 0.5, c.y + Math.sin(a) * r * 0.28); ctx.lineTo(c.x + Math.cos(a) * r * 0.95, c.y + Math.sin(a) * r * 0.52); } ctx.stroke();
    ctx.fillStyle = `rgba(20,0,10,${0.25 + k * 0.3})`; ctx.beginPath(); ctx.ellipse(c.x, c.y, 26 * (0.4 + k * 0.6), 13 * (0.4 + k * 0.6), 0, 0, TAU); ctx.fill();
    ctx.restore();
  },
  drgnid(fx, ctx, c) { // Nidhogg's Fall: a colossal dragon plunges from the sky onto the target
    const k = Math.min(1, c.t / c.life), h = 900 * Math.pow(1 - Math.min(1, k * 1.4), 2);
    drawDragon(ctx, c.x, c.y - h + 60, Math.PI / 2, c.t, k < 0.85 ? 1 : (1 - k) * 6.6, 2.6, 5);
  },
  drgwyrm(fx, ctx, c) { // Wyrmstorm / Dragon Form: the dragon circles the battlefield over the hero
    const pl = fx.sim && fx.sim.players && fx.sim.players.get(c.pid), x = pl ? pl.x : c.x, y = pl ? pl.y : c.y, a = c.t * 2.4, fade = Math.min(1, c.t / 0.3, (c.life - c.t) / 0.4);
    drawDragon(ctx, x + Math.cos(a) * 180, y + Math.sin(a) * 90 - 80, a + Math.PI / 2, c.t, 0.85 * fade, 1.7, 7);
  },
};
export const DRG_UNDER = {};
export const DRG_PARTS = {};

// ------------------------------------------------------------------ events
function drgHit(fx, ev, me) {
  const n = ev.n || 0, R = ev.r || 110, ang = ev.ang || 0, L = ev.len || 220, emp = ev.emp ? 1.25 : 1;
  switch (ev.fx) {
    case 'thrust': case 'lance': case 'impale': case 'impale2': case 'fang': case 'geir': case 'breath0': case 'breath': {
      const big = ev.fx === 'geir' ? 2 : ev.fx === 'fang' || ev.fx === 'impale2' ? 1.4 : 1;
      const [x2, y2] = lanceLine(fx, ev.x, ev.y, ang, L, ev.fx.startsWith('breath') ? C.fire : C.violet, big);
      if (ev.fx === 'geir' || ev.fx.startsWith('breath')) { for (let d = 60; d < L; d += 80) fire(fx, ev.x + Math.cos(ang) * d, ev.y + Math.sin(ang) * d, 60 * big, 0.5); }
      if (n || big > 1) { fx.add({ type: 'star', x: x2, y: y2, life: 0.2, size: 30 * big, color: C.hi }); fx.ring(x2, y2, 60 * big, C.crimson, 0.25, 6); fx.sparks(x2, y2, ang, N(fx, 10 * big), C.ember, 460, 0.7); }
      if (ev.fx === 'geir') { flash(fx, me, '#ffd0a0', 0.35); fx.text(ev.x + Math.cos(ang) * L * 0.5, ev.y - 90, 'GEIRSKOGUL!', { size: 34, color: C.ember, pop: 2.4, life: 1.1 }); if (me) fx.slowmo(0.15, 0.4); }
      fx.shake(0.12 * big + (n ? 0.06 : 0)); if (me && n) fx.punch(ang, 4 * big); return true;
    }
    case 'geircharge': { const x2 = ev.x + Math.cos(ang) * L, y2 = ev.y + Math.sin(ang) * L; fx.add({ type: 'trail', x: ev.x, y: ev.y, x2, y2, life: 0.5, color: C.indigo }); glow(fx, ev.x, ev.y - 60, 140, C.violet, 0.5, 0.6); embers(fx, ev.x, ev.y - 60, 14, C.violet, 40, 160); return true; }
    case 'throw': {
      fx.cine.push({ kind: 'drgspear', t: 0, life: 1, x: ev.x, y: ev.y - 30, tx: ev.tx, ty: ev.ty - 20, T: 4 / 60, h: 30, pid: ev.pid });
      fx.ring(ev.x, ev.y, 50, C.violet, 0.2, 5); if (me) fx.text(ev.x, ev.y - 90, 'SPEAR THROW', { size: 16, color: C.sky, life: 0.6, vy: -30 });
      setTimeout(() => { fire(fx, ev.tx, ev.ty, 70, 0.7); fx.ring(ev.tx, ev.ty, 70, C.crimson, 0.3, 7); crack(fx, ev.tx, ev.ty, 50, C.crimson, 1, 5); fx.shake(0.12); }, 70);
      return true;
    }
    case 'cometthrow': fx.cine.push({ kind: 'drgspear', t: 0, life: 1, x: ev.x, y: ev.y - 120, tx: ev.tx, ty: ev.ty, T: 14 / 60, h: 160, pid: ev.pid }); return true;
    case 'arc': case 'whirl': case 'tempest': case 'cyclone': case 'cyclone2': { // spear spins: a violet ring of streaks, fire at higher power
      fx.add({ type: 'slash', x: ev.x, y: ev.y, ang: rnd(0, TAU), arc: TAU * 0.9, r: R, life: 0.28, color: C.violet, width: 22 * emp });
      fx.add({ type: 'slash', x: ev.x, y: ev.y, ang: rnd(0, TAU), arc: TAU * 0.7, r: R * 0.7, life: 0.3, color: ev.fx.startsWith('cyclone') ? C.fire : C.sky, width: 10 });
      if (ev.fx.startsWith('cyclone') || ev.fx === 'tempest') { glow(fx, ev.x, ev.y, R, C.crimson, 0.3, 0.5); embers(fx, ev.x, ev.y, 10, C.fire, R * 0.6, 200); }
      fx.puffs(ev.x, ev.y + 10, N(fx, 5), 'rgba(200,200,240,.6)', 12, 160, 0.4); fx.shake(0.14); return true;
    }
    case 'land': case 'markdive': case 'dragondive': case 'hop': case 'hop3': case 'spine': case 'highjump': case 'comet': case 'formslam': case 'stormdive': case 'stormcrash': case 'nidring': {
      const big = { highjump: 1.8, comet: 1.6, stormcrash: 2, nidring: 2.2, formslam: 1.5, dragondive: 1.3, spine: 1.3, markdive: 1.2, hop3: 1.2 }[ev.fx] || 1;
      landing(fx, ev.x, ev.y, R, big);
      if (ev.fx === 'highjump') { fx.add({ type: 'pillar', x: ev.x, y: ev.y, size: 90, color: C.violet, life: 0.6, h: 560, lite: lite(fx) }); fx.text(ev.x, below(ev, 30), 'HIGH JUMP!', { size: 30, color: C.sky, pop: 2.2, life: 1 }); flash(fx, me, '#c8c0ff', 0.25); }
      if (ev.fx === 'markdive') fx.text(ev.x, below(ev), 'DIVE!', { size: 22, color: C.fire, pop: 2, life: 0.8 });
      fx.shake(0.18 * big); if (me) fx.punch(Math.PI / 2, 5 * big); return true;
    }
    case 'volley': { for (let i = -2; i <= 2; i++) { const a = ang + i * 0.18; lanceLine(fx, ev.x, ev.y, a, 420, C.fire, 0.8); } glow(fx, ev.x, ev.y, 120, C.crimson, 0.3, 0.6); fx.shake(0.16); return true; }
    case 'nidrise': { fx.add({ type: 'pillar', x: ev.x, y: ev.y, size: 120, color: C.crimson, life: 0.9, h: 700, lite: lite(fx) }); embers(fx, ev.x, ev.y, 30, C.ember, 60, 520); fx.shake(0.3); return true; }
    case 'nidmark': { momNidMark(fx, ev); return true; } // (the dragon dives while the reticle closes; momDragon in fxmoment.js)
    case 'wrath': { fire(fx, ev.x, ev.y, R, 1.5); fx.ring(ev.x, ev.y, R, C.crimson, 0.4, 10); fx.text(ev.x, ev.y - 100, "DRAGON'S WRATH", { size: 30, color: C.crimson, pop: 2.2, life: 1.1 }); fx.shake(0.4); return true; }
    default: fx.ring(ev.x, ev.y, R, C.violet, 0.25, 6); if (n) fire(fx, ev.x, ev.y, R * 0.6, 0.6); return true;
  }
}

/** Effects for 'drg' / 'drgx'. */
export function drgFx(fx, ev, me) {
  if (ev.type === 'drg') switch (ev.ph) {
    case 'cast': {
      fx.ring(ev.x, ev.y, ev.chain ? 70 : 44, ev.fe ? C.sky : C.violet, 0.24, ev.chain ? 7 : 4); glow(fx, ev.x, ev.y, ev.chain ? 110 : 60, C.indigo, 0.25, 0.5);
      if (ev.fe && me) fx.text(ev.x, ev.y - 96, 'SKYBORNE!', { size: 18, color: C.sky, pop: 1.8, life: 0.7, vy: -30 });
      if (ev.fm) { fx.ring(ev.x, ev.y, 100, C.crimson, 0.4, 9); embers(fx, ev.x, ev.y, 12, C.crimson, 50, 220); fx.text(ev.x, ev.y - 116, `BLOOD ×${ev.fm}`, { size: 22, color: '#ff9aa6', pop: 2, life: 0.9, vy: -30 }); }
      if (ev.id === 'dragon_form') {
        fx.banner('DRAGON FORM', C.crimson, 'route: Wyrmstorm (packs) · Nidhogg\'s Fall (bosses)', 2.2, 60); dark(fx, ev.pid, 1.4, 0.4, 'rgba(20,6,30,');
        fx.cine.push({ kind: 'drgwyrm', t: 0, life: 1.6, x: ev.x, y: ev.y, pid: ev.pid }); fire(fx, ev.x, ev.y, 200, 2); flash(fx, me, '#ffb0a0', 0.35); fx.shake(0.5); if (me) fx.slowmo(0.25, 0.4);
      }
      return true;
    }
    case 'fin': {
      const boss = ev.route === 'boss';
      if (boss && ev.id === 'nidhoggs_fall') { // the signature moment: letterbox + tint now, the dragon and the title land with the hit
        momFin(fx, ev, 'drg', "DRAGOON  ·  NIDHOGG'S FALL", 'R  E  Q  E  R');
        fx.ring(ev.x, ev.y, 150, C.crimson, 0.5, 10); flash(fx, me, '#ffb0a0', 0.3); fx.shake(0.3); return true;
      }
      fx.banner(ev.name.toUpperCase(), boss ? C.crimson : C.violet, ev.fm > 1.01 ? `FINISHER · Blood ×${ev.fm}` : 'FINISHER', 2.4, 64);
      dark(fx, ev.pid, 2.6, 0.5, boss ? 'rgba(30,2,10,' : 'rgba(10,6,34,');
      fx.add({ type: 'pillar', x: ev.x, y: ev.y, size: 150, color: boss ? C.crimson : C.indigo, life: 0.8, h: 620, lite: lite(fx) });
      for (const [i, cc] of [C.crimson, C.violet, C.fire].entries()) fx.ring(ev.x, ev.y, 140 + i * 50, cc, 0.5 + i * 0.1, 10);
      if (!boss) fx.cine.push({ kind: 'drgwyrm', t: 0, life: 2.4, x: ev.x, y: ev.y, pid: ev.pid });
      flash(fx, me, boss ? '#ffb0a0' : '#c8c0ff', 0.45); if (me) fx.slowmo(0.35, 0.35); fx.shake(0.45); return true;
    }
    case 'hit': return drgHit(fx, ev, me);
    case 'leap': {
      fx.puffs(ev.x, ev.y, N(fx, 10), 'rgba(200,200,240,.7)', 14, 180, 0.5); fx.ring(ev.x, ev.y, 70, C.sky, 0.3, 6);
      for (let i = 0; i < 3; i++) fx.add({ type: 'trail', x: ev.x + rnd(-14, 14), y: ev.y, x2: ev.x + rnd(-14, 14), y2: ev.y - 260, life: 0.3, color: i ? C.sky : '#ffffff' });
      fx.cine.push({ kind: 'drgreticle', t: 0, life: Math.max(0.2, (ev.T || 26) / 60), x: ev.tx, y: ev.ty, r: ev.r || 110, mk: ev.mk, pid: ev.pid });
      if (ev.mk && me) fx.text(ev.tx, ev.ty - 100, 'DIVE TARGET', { size: 16, color: C.fire, life: 0.7, vy: -30 });
      return true;
    }
    case 'roar': {
      fx.cine.push({ kind: 'drgroar', t: 0, life: Math.max(0.8, ((ev.at || 10) + (ev.pulses || 4) * (ev.every || 6)) / 60 + 0.3), x: ev.x, y: ev.y, ang: ev.ang, len: ev.len || 640, w: ev.w || 140, pid: ev.pid });
      fx.ring(ev.x, ev.y, 160, C.crimson, 0.5, 12); fx.ring(ev.x, ev.y, 240, C.violet, 0.6, 8); flash(fx, me, '#ffb0a0', 0.25); fx.shake(0.5); if (me) fx.punch(ev.ang || 0, 8); return true;
    }
  }
  if (ev.type === 'drgx') switch (ev.ph) {
    case 'hit': return drgHit(fx, ev, me);
    case 'blood': if (me) fx.text(ev.x, ev.y, `+${ev.n} Blood`, { size: 16, color: '#ff6a7a', life: 0.8, vy: -40 }); return true;
    case 'echo': fire(fx, ev.x, ev.y, ev.r || 120, 1.2); fx.ring(ev.x, ev.y, ev.r || 120, C.crimson, 0.35, 8); return true;
    case 'fireball': fire(fx, ev.x, ev.y, 80 + (ev.big ? 50 : 0), ev.big ? 1.3 : 0.8); return true;
    case 'pins': fx.ring(ev.x, ev.y, 40 + (ev.r || 20) + ev.n * 6, C.violet, 0.35, 8); fx.sparks(ev.x, ev.y, 0, N(fx, 8 + ev.n), C.sky, 360, Math.PI); fx.text(ev.x, below(ev), `RIPPED ×${ev.n}`, { size: 20, color: C.sky, pop: 1.8, life: 0.9 }); return true;
    case 'pinned': fx.ring(ev.x, ev.y, 50 + (ev.r || 20), C.fire, 0.4, 7); fx.text(ev.x, below(ev), 'PINNED', { size: 16, color: C.fire, life: 0.8 }); return true;
    case 'chain': if (me) fx.text(ev.x, ev.y - 100, ev.left > 0 ? `DIVE AGAIN ×${ev.left}` : 'LAST DIVE', { size: 22, color: C.fire, pop: 2, life: 0.9, vy: -30 }); return true;
    case 'rain': fire(fx, ev.x, ev.y, ev.r || 120, 1); fx.add({ type: 'trail', x: ev.x - 120, y: ev.y - 420, x2: ev.x, y2: ev.y, life: 0.25, color: C.fire }); crack(fx, ev.x, ev.y, (ev.r || 120) * 0.7); fx.shake(0.12); return true;
    case 'stormburst': landing(fx, ev.x, ev.y, 260, 2.2); fx.text(ev.x, below(ev, 40), `WYRMSTORM ×${ev.n}`, { size: 40, color: C.ember, pop: 2.8, life: 1.3 }); flash(fx, me, '#ffd0a0', 0.5); fx.shake(0.9); if (me) fx.slowmo(0.3, 0.3); return true;
    case 'nidhogg': landing(fx, ev.x, ev.y, 300, 2.6); fx.add({ type: 'pillar', x: ev.x, y: ev.y, size: 200, color: C.crimson, life: 0.9, h: 800, lite: lite(fx) }); momNidhogg(fx, ev, me); if (me) fx.slowmo(0.4, 0.3); return true;
  }
  return true;
}

/** Sounds for 'drg' / 'drgx'. */
export function drgSound(au, ev, me) {
  if (!au.ctx || au.muted) return;
  if (ev.type === 'drg') switch (ev.ph) {
    case 'cast': au.tone('triangle', 440, 660, 0.1, 0.06); if (ev.id === 'dragon_form') { au.play('roar'); au.tone('sawtooth', 90, 45, 0.9, 0.2); } return;
    case 'fin': au.play('roar'); au.tone('sawtooth', 110, 55, 0.8, 0.2); return;
    case 'leap': au.hiss(600, 3200, 0.25, 0.14, 1.2); return;
    case 'roar': au.play('roar'); au.hiss(400, 1600, 0.8, 0.2, 0.8); return;
    case 'hit': if (/land|dive|hop|spine|highjump|comet|formslam|storm|nid/.test(ev.fx)) { au.play('slam'); if (/highjump|comet|stormcrash|nidring/.test(ev.fx)) au.play('boom'); } else if (ev.fx === 'throw') au.hiss(3000, 800, 0.2, 0.14, 1.2); else au.play('heavy'); return;
  }
  if (ev.type === 'drgx') switch (ev.ph) {
    case 'pins': au.play('crit'); return;
    case 'echo': case 'fireball': case 'rain': au.hiss(800, 200, 0.3, 0.12, 0.8); return;
    case 'stormburst': case 'nidhogg': au.play('detonate'); au.play('boom'); return;
    case 'chain': if (me) au.tone('triangle', 660, 990, 0.1, 0.1); return;
  }
}
