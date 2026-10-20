// Horde AoE VFX (mobbing pass 3): the class shapes from sim/hordeaoe.js ('hEcho' events), drawn bold and flat in the
// game's classic style (ink outlines, bright fills, white cores): the Warrior's molten Earthsplitter cracks, the
// Paladin's golden Holy Shockwave, the Ninja's violet Shadow Marks dashing between enemies, the Samurai's white-crimson
// Iaido Crescents, the Monk's Chi Ripple bouncing palm to palm, the Dragoon's azure Skewer lances, the Ranger's green
// Ricochet tracers (now Sylva's Hawk's Eye Volley: a fan of spirit arrows + the spirit hawk strafing the line), the Mage's Starfall (a cosmic meteor streaks down on the struck enemy and bursts in a starry crater;
// 2026-10-08 buff, was the Arc Lash lightning), the Summoner's Ink Splash (now Mirelle's Grimoire Page Storm), and the
// Warrior's Warcry Quake (Brakka's molten cleave shockwave + a quake under the struck enemy; was Earthsplitter).
// The 2026-10-08 signature shapes use soft pre-rendered glow sprites (one cached canvas per colour, drawn additively),
// so they stay cheap; the low quality levels ('lite') skip the glow sprites and the extra particles. A pulse (a lingering chain burst) redraws
// the shape fainter. Budgeted: at most MAX live shapes; the low quality levels drop the glow layers.
import { INK } from './art.js';
const TAU = Math.PI * 2;
const MAX = 28;
const HEAVY = new Set(['volley', 'pages', 'warcry']), SIG_CAP = 7, SIG_CAP_LITE = 3; // (visual only: the sim's damage is unaffected)
export const AOE_COL = {
  warrior: { a: '#ff7a2a', b: '#ffd36b', ink: '#3a1204', c: '#ff3b1f' }, // (Brakka: molten orange, a red-hot core)
  cleric: { a: '#ffd84a', b: '#fffbe0', ink: '#4a3200' },
  bladedancer: { a: '#b28cff', b: '#ff8ae0', ink: '#1a0f2e' },
  samurai: { a: '#ff3b4e', b: '#ffffff', ink: '#2a0408' },
  monk: { a: '#3fe0c8', b: '#fff6b0', ink: '#06302a' },
  dragoon: { a: '#4aa8ff', b: '#e0f4ff', ink: '#06183a' },
  ranger: { a: '#5fe0a0', b: '#f4fff0', ink: '#0c2a1c', c: '#ffd86b' }, // (Sylva: spirit-emerald arrows, a golden hawk)
  mage: { a: '#9a7bff', b: '#fff2b0', ink: '#140a3a', c: '#5fd8ff' }, // (Starfall: cosmic violet, star gold, a cyan tail)
  summoner: { a: '#a05aff', b: '#ffe9ff', ink: '#1a0630', c: '#ffd36b' }, // (Mirelle: violet grimoire magic, gilded page edges)
};
const LIFE = { fissure: 0.55, shock: 0.5, marks: 0.42, wave: 0.38, pierce: 0.36, ripple: 0.45, bounce: 0.3, arc: 0.3, splash: 0.45, starfall: 0.55, volley: 0.42, pages: 0.62, warcry: 0.6 };
// a tiny deterministic jitter (cracks / lightning look the same every frame of one effect)
const jit = (seed, i) => { const s = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return s - Math.floor(s) - 0.5; };

export class HordeAoeFX {
  constructor(fx) { this.fx = fx; this.live = []; this.n = 0; }
  handle(ev) {
    if (ev.type !== 'hEcho') return false;
    const pulse = ev.src === 'pulse';
    if (this.live.length >= MAX) { if (pulse) return true; this.live.shift(); }
    if (HEAVY.has(ev.k) && ev.src !== 'chain') { // (perf cap: the signature shapes proc on nearly every hit; at most SIG_CAP of a kind on screen, chains always show)
      let n = 0; for (const e of this.live) if (e.k === ev.k && e.src !== 'chain') n++;
      if (n >= (this.fx.lite ? SIG_CAP_LITE : SIG_CAP) && !ev.hawk) return true;
    }
    this.live.push({ ...ev, t: 0, life: (ev.hawk ? 0.7 : LIFE[ev.k] || 0.4) * (pulse ? 0.8 : ev.src === 'chain' ? 1.25 : 1), a: pulse ? 0.55 : 1, seed: (this.n++ % 997) + 1 });
    const fx = this.fx, me = ev.pid === fx.localPid;
    if (!pulse && fx.shake && me) fx.shake(ev.src === 'chain' ? 0.18 : 0.07);
    if (!pulse && fx.sparks && !fx.lite && ev.pts) for (let i = 1; i < Math.min(ev.pts.length, 8); i++) fx.sparks(ev.pts[i][0], ev.pts[i][1], 0, 4, (AOE_COL[ev.cls] || AOE_COL.mage).b, 240, TAU);
    return true;
  }
  update(dt) {
    if (!this.live.length) return;
    for (const e of this.live) e.t += dt;
    this.live = this.live.filter((e) => e.t < e.life);
  }
  draw(ctx, view, time) {
    if (!this.live.length) return;
    const lite = !!this.fx.lite; LITE = lite;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const e of this.live) {
      const R = Math.max(e.r || 0, e.len || 0, e.hawk ? e.hawk[2] : 0) || 400;
      if (view && (e.x + R < view.x0 - 60 || e.x - R > view.x1 + 60 || e.y + R < view.y0 - 60 || e.y - R > view.y1 + 60)) continue;
      const k = e.t / e.life, C = AOE_COL[e.cls] || AOE_COL.mage;
      ctx.globalAlpha = 1;
      try { (DRAW[e.k] || DRAW.arc)(ctx, e, k, C, lite, time); } catch { /* (a bad event never breaks the frame) */ }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
}

const easeOut = (k) => 1 - (1 - k) * (1 - k);
/** a stroked band: ink under, colour, then a white core (the classic look) */
let LITE = false;
function band(ctx, pathFn, w, col, core, a, ink = INK) {
  ctx.globalAlpha = a;
  if (!LITE || w >= 6) { ctx.strokeStyle = ink; ctx.lineWidth = w + 5; pathFn(); ctx.stroke(); } // (low quality: thin bands skip the ink pass)
  ctx.strokeStyle = col; ctx.lineWidth = w; pathFn(); ctx.stroke();
  if (core) { ctx.strokeStyle = core; ctx.lineWidth = Math.max(1.5, w * 0.35); pathFn(); ctx.stroke(); }
}
function glowLine(ctx, pathFn, w, col, a) {
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.35; ctx.strokeStyle = col; ctx.lineWidth = w * 2.6; pathFn(); ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
}
function polyPath(ctx, pts) { return () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); }; }
function diamond(ctx, x, y, s, fill, a) {
  ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.7, y); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
}

/** a soft round glow sprite per colour (pre-rendered once; drawn additively with drawImage = cheap soft particles) */
const SOFT = new Map();
function soft(col) {
  let c = SOFT.get(col);
  if (c !== undefined) return c;
  c = null;
  try {
    const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(64, 64) : typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: 64, height: 64 }) : null;
    if (cv) { const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, col); gr.addColorStop(0.35, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); c = cv; }
  } catch { c = null; }
  SOFT.set(col, c);
  return c;
}
/** additive soft dot (skipped on 'lite'; falls back to a plain circle without a canvas) */
function glow(ctx, x, y, r, col, a) {
  if (LITE || a <= 0.01) return;
  const sp = soft(col);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a);
  if (sp) ctx.drawImage(sp, x - r, y - r, r * 2, r * 2); else { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, TAU); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
}
/** a tapered trail (a filled wedge from the tail to the head) with a white core line */
function trail(ctx, x0, y0, x1, y1, w, col, core, a, ink) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  ctx.globalAlpha = a;
  if (ink && !LITE) { ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + nx * (w / 2 + 2.5), y1 + ny * (w / 2 + 2.5)); ctx.lineTo(x1 - nx * (w / 2 + 2.5), y1 - ny * (w / 2 + 2.5)); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + nx * w / 2, y1 + ny * w / 2); ctx.lineTo(x1 - nx * w / 2, y1 - ny * w / 2); ctx.closePath(); ctx.fill();
  if (core) { ctx.strokeStyle = core; ctx.lineWidth = Math.max(1.5, w * 0.28); ctx.beginPath(); ctx.moveTo(x0 + dx * 0.35, y0 + dy * 0.35); ctx.lineTo(x1, y1); ctx.stroke(); }
}
/** Sylva's spirit hawk: swept wings that beat, a gold body, drawn heading along `ang` */
function hawkShape(ctx, x, y, ang, s, beat, C, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = a; ctx.lineJoin = 'round';
  const wy = 0.72 + 0.38 * beat; // (the wings beat)
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
  ctx.fillStyle = C.a; ctx.beginPath(); ctx.moveTo(-s * 0.42, 0); ctx.lineTo(-s * 0.98, -s * 0.24); ctx.lineTo(-s * 0.9, 0); ctx.lineTo(-s * 0.98, s * 0.24); ctx.closePath(); ctx.fill(); ctx.stroke(); // tail fan
  for (const g of [-1, 1]) { // wings: a curved leading edge out to the swept tip, feathered trailing edge back
    ctx.fillStyle = C.a; ctx.beginPath(); ctx.moveTo(s * 0.22, g * s * 0.08);
    ctx.bezierCurveTo(s * 0.12, g * s * 0.62 * wy, -s * 0.18, g * s * 1.02 * wy, -s * 0.58, g * s * 1.12 * wy);
    ctx.lineTo(-s * 0.46, g * s * 0.86 * wy); ctx.lineTo(-s * 0.56, g * s * 0.8 * wy); ctx.lineTo(-s * 0.4, g * s * 0.6 * wy); ctx.lineTo(-s * 0.48, g * s * 0.52 * wy); ctx.lineTo(-s * 0.3, g * s * 0.34 * wy); ctx.lineTo(-s * 0.34, g * s * 0.2 * wy); ctx.lineTo(-s * 0.16, g * s * 0.1);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = C.b; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(s * 0.16, g * s * 0.16); ctx.bezierCurveTo(s * 0.06, g * s * 0.6 * wy, -s * 0.2, g * s * 0.95 * wy, -s * 0.5, g * s * 1.04 * wy); ctx.stroke(); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; // (light on the leading edge)
  }
  ctx.fillStyle = C.c || C.b; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.15, 0, 0, TAU); ctx.fill(); ctx.stroke(); // body
  ctx.beginPath(); ctx.arc(s * 0.5, 0, s * 0.13, 0, TAU); ctx.fill(); ctx.stroke(); // head
  ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.moveTo(s * 0.6, -s * 0.05); ctx.lineTo(s * 0.76, 0); ctx.lineTo(s * 0.6, s * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke(); // beak
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(s * 0.53, -s * 0.05, s * 0.025, 0, TAU); ctx.arc(s * 0.53, s * 0.05, s * 0.025, 0, TAU); ctx.fill(); // eyes
  ctx.restore();
}

const DRAW = {
  // Warrior: molten cracks race out from the hero, glow, then cool to dark scars with rubble
  fissure(ctx, e, k, C, lite) {
    const grow = Math.min(1, k / 0.3), fade = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45, A = e.a * fade;
    for (let r = 0; r < (e.angs || []).length; r++) {
      const ang = e.angs[r], L = e.len * easeOut(grow), seg = 12, pts = [];
      const c = Math.cos(ang), s = Math.sin(ang);
      for (let i = 0; i <= seg; i++) { const d = (L * i) / seg, o = i === 0 ? 0 : jit(e.seed + r * 13, i) * 52; pts.push([e.x + c * d - s * o, e.y + s * d * 0.92 + c * o]); }
      const p = polyPath(ctx, pts), w = 14 * (1 - k * 0.5);
      if (!lite) for (let i = 2; i < pts.length; i += 3) { const q = pts[i], z = 7 + 4 * jit(e.seed, i + r); ctx.globalAlpha = A; ctx.fillStyle = '#6b4a3a'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(q[0] - z, q[1] + z * 0.4); ctx.lineTo(q[0] - z * 0.2, q[1] - z - 6 * (1 - k)); ctx.lineTo(q[0] + z, q[1] + z * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke(); } // rock shards kicked up along the crack
      if (!lite) glowLine(ctx, p, w, C.a, A);
      band(ctx, p, w, k < 0.4 ? C.a : '#5a2a14', k < 0.35 ? C.b : null, k < 0.4 ? A : A * 0.6, C.ink); // (molten, then a cooling scar)
      if (!lite && grow < 1) { const q = pts[pts.length - 1]; ctx.globalAlpha = A; ctx.fillStyle = C.b; ctx.beginPath(); ctx.arc(q[0], q[1], 9, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = A * 0.7; ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(e.x, e.y, 60 + 90 * k, (60 + 90 * k) * 0.55, 0, 0, TAU); ctx.stroke();
  },
  // Paladin: a golden ring of light sweeps out over the crowd, with a cross of rays and a white leading edge
  shock(ctx, e, k, C, lite) {
    const R = e.r * easeOut(Math.min(1, k / 0.6)), A = e.a * (1 - k * k);
    if (!lite) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = A * 0.18; ctx.fillStyle = C.a; ctx.beginPath(); ctx.ellipse(e.x, e.y, R, R * 0.62, 0, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    const ring = () => { ctx.beginPath(); ctx.ellipse(e.x, e.y, R, R * 0.62, 0, 0, TAU); };
    if (!lite) glowLine(ctx, ring, 16, C.a, A);
    band(ctx, ring, 14 * (1 - k * 0.6) + 2, C.a, C.b, A, C.ink);
    for (let i = 0; i < (lite ? 4 : 8); i++) { // holy cross rays
      const a = (i / 8) * TAU + 0.2, r0 = R * 0.6, r1 = R * 0.97;
      const ray = () => { ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * r0, e.y + Math.sin(a) * r0 * 0.62); ctx.lineTo(e.x + Math.cos(a) * r1, e.y + Math.sin(a) * r1 * 0.62); };
      band(ctx, ray, i % 2 ? 4 : 7, C.a, i % 2 ? null : C.b, A * 0.85, C.ink);
    }
    if (k < 0.35) { ctx.globalAlpha = A; ctx.fillStyle = C.b; ctx.strokeStyle = C.ink; ctx.lineWidth = 3; const s = 26; ctx.beginPath(); ctx.rect(e.x - 6, e.y - 70 - s, 12, s * 2); ctx.rect(e.x - s * 0.7, e.y - 70 - 8, s * 1.4, 12); ctx.fill(); ctx.stroke(); }
  },
  // Ninja: shadow dashes leap from the first mark to every other one; each target gets a violet mark that bursts
  marks(ctx, e, k, C, lite) {
    const P = e.pts || [], o = P[0], A = e.a * (1 - Math.max(0, k - 0.5) * 2);
    if (!o) return;
    for (let i = 1; i < P.length; i++) {
      const q = P[i], d = Math.min(1, k / 0.25 + i * 0.02), tx = o[0] + (q[0] - o[0]) * d, ty = o[1] + (q[1] - o[1]) * d;
      const p = () => { ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(tx, ty); };
      if (!lite) glowLine(ctx, p, 5, C.b, A);
      band(ctx, p, 5 * (1 - k), i % 2 ? C.a : C.b, '#ffffff', A * 0.9, C.ink);
      if (d >= 1) diamond(ctx, q[0], q[1] - 30, 11 + 10 * Math.max(0, 1 - Math.abs(k - 0.35) * 4), i % 2 ? C.b : C.a, A);
    }
    diamond(ctx, o[0], o[1] - 30, 16, '#ffffff', A);
  },
  // Samurai: white-crimson crescents fly out along the cut(s)
  wave(ctx, e, k, C, lite) {
    const A = e.a * (1 - k), d = e.len * easeOut(k);
    for (const ang of e.angs || [e.ang]) {
      const cx = e.x + Math.cos(ang) * d, cy = e.y + Math.sin(ang) * d, hw = e.w * 0.55;
      const arc = () => { ctx.beginPath(); ctx.arc(cx - Math.cos(ang) * hw * 0.6, cy - Math.sin(ang) * hw * 0.6, hw, ang - 1.1, ang + 1.1); };
      if (!lite) glowLine(ctx, arc, 10, C.a, A);
      band(ctx, arc, 12 * (1 - k * 0.5), C.a, C.b, A, C.ink);
      const tr = () => { ctx.beginPath(); ctx.moveTo(e.x + Math.cos(ang) * d * 0.25, e.y + Math.sin(ang) * d * 0.25); ctx.lineTo(cx, cy); };
      band(ctx, tr, 3, C.b, null, A * 0.6, C.ink);
    }
  },
  // Dragoon: azure lances skewer through the line, head first
  pierce(ctx, e, k, C, lite) {
    const A = e.a * (1 - k * k), d = e.len * easeOut(Math.min(1, k / 0.45));
    for (const ang of e.angs || [e.ang]) {
      const c = Math.cos(ang), s = Math.sin(ang), hx = e.x + c * d, hy = e.y + s * d;
      const shaft = () => { ctx.beginPath(); ctx.moveTo(e.x + c * d * 0.15, e.y + s * d * 0.15); ctx.lineTo(hx, hy); };
      if (!lite) glowLine(ctx, shaft, 8, C.a, A);
      band(ctx, shaft, 8, C.a, C.b, A, C.ink);
      ctx.globalAlpha = A; ctx.beginPath(); ctx.moveTo(hx + c * 30, hy + s * 30); ctx.lineTo(hx - s * 13, hy + c * 13); ctx.lineTo(hx + s * 13, hy - c * 13); ctx.closePath();
      ctx.fillStyle = C.b; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke();
    }
  },
  // Monk: a chi palm hops target to target, leaving palm rings
  ripple(ctx, e, k, C, lite) { hops(ctx, e, k, C, lite, 'palm'); },
  bounce(ctx, e, k, C, lite) { hops(ctx, e, k, C, lite, 'arrow'); },
  arc(ctx, e, k, C, lite) { hops(ctx, e, k, C, lite, 'bolt'); },
  // Mage: Starfall. A meteor streaks down out of the sky along the cast (gold head, violet/cyan tail), then the impact
  // flashes, a crater ring bursts out to the AoE radius with star rays, and little stars scatter and twinkle out.
  starfall(ctx, e, k, C, lite, time) {
    const FALL = 0.28, ang = e.ang || 0, R0 = e.r || 240;
    const dx = Math.cos(ang) * -0.45, sx = e.x + dx * 520 - 90, sy = e.y - 560; // (comes in from high up, slanted against the cast)
    if (k < FALL) {
      const f = easeOut(k / FALL), hx = sx + (e.x - sx) * f, hy = sy + (e.y - 26 - sy) * f, tl = 0.32;
      const tx = hx - (e.x - sx) * tl, ty = hy - (e.y - sy) * tl;
      const tail = () => { ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); };
      if (!lite) glowLine(ctx, tail, 16, C.c || C.a, e.a);
      band(ctx, tail, 12, C.a, C.c || C.b, e.a, C.ink);
      ctx.globalAlpha = e.a * 0.25; ctx.beginPath(); ctx.ellipse(e.x, e.y, R0 * 0.35 * f, R0 * 0.35 * f * 0.62, 0, 0, TAU); ctx.fillStyle = C.ink; ctx.fill(); // (the landing shadow grows)
      star(ctx, hx, hy, 20, 9, C.b, e.a, (time || 0) * 6, C.ink);
      return;
    }
    const q = (k - FALL) / (1 - FALL), R = R0 * easeOut(Math.min(1, q / 0.45)), A = e.a * (1 - q * q);
    if (q < 0.22) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = e.a * (1 - q / 0.22) * 0.7; ctx.fillStyle = C.b; ctx.beginPath(); ctx.ellipse(e.x, e.y, R0 * 0.55, R0 * 0.34, 0, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; } // impact flash
    if (!lite) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = A * 0.2; ctx.fillStyle = C.a; ctx.beginPath(); ctx.ellipse(e.x, e.y, R, R * 0.62, 0, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    ctx.globalAlpha = A * 0.5; ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(e.x, e.y, R0 * 0.22, R0 * 0.14, 0, 0, TAU); ctx.fill(); // the crater
    const ring = () => { ctx.beginPath(); ctx.ellipse(e.x, e.y, R, R * 0.62, 0, 0, TAU); };
    if (!lite) glowLine(ctx, ring, 14, C.a, A);
    band(ctx, ring, 12 * (1 - q * 0.6) + 2, C.a, C.b, A, C.ink);
    for (let i = 0; i < (lite ? 5 : 10); i++) { // star rays
      const a = (i / 10) * TAU + e.seed, r0 = R * 0.25, r1 = R * (i % 2 ? 0.7 : 0.95);
      const ray = () => { ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * r0, e.y + Math.sin(a) * r0 * 0.62); ctx.lineTo(e.x + Math.cos(a) * r1, e.y + Math.sin(a) * r1 * 0.62); };
      band(ctx, ray, i % 2 ? 3 : 6, i % 2 ? (C.c || C.a) : C.a, i % 2 ? null : C.b, A * 0.85, C.ink);
    }
    if (!lite) for (let i = 0; i < 7; i++) { // stardust scattering up and out
      const a = (i / 7) * TAU + e.seed * 0.7, rr = R * (0.5 + 0.5 * q) * (0.85 + 0.3 * jit(e.seed, i));
      star(ctx, e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr * 0.62 - 50 * q, 9 * (1 - q * 0.5), 4, i % 3 ? C.b : (C.c || C.a), A, i + q * 4, C.ink);
    }
    if (q < 0.4) star(ctx, e.x, e.y - 30 - 40 * q, 26 * (1 - q), 11, '#ffffff', A, e.seed, C.ink);
  },
  // Ranger (Sylva): the arrow splits into a fan of spirit arrows streaking on through the line (tapered trails, soft
  // heads); now and then the spirit hawk dives from behind the hero down the line, a wind wake and feathers behind it
  volley(ctx, e, k, C, lite, time) {
    const A = e.a * (1 - Math.max(0, k - 0.55) / 0.45), go = easeOut(Math.min(1, k / 0.55)), n = (e.angs || []).length;
    if (k < 0.2) glow(ctx, e.x, e.y - 18, 46 * (1 - k / 0.2) + 18, C.c, e.a * 0.9); // the split flash
    for (let i = 0; i < n; i++) {
      const a = e.angs[i], c = Math.cos(a), s = Math.sin(a), d = e.len * go, hx = e.x + c * d, hy = e.y + s * d - 18;
      const tl = Math.min(d, 150 + 80 * (1 - k)), tx = hx - c * tl, ty = hy - s * tl;
      trail(ctx, tx, ty, hx, hy, 13 * (1 - k * 0.4), C.a, C.b, A * 0.9, C.ink);
      glow(ctx, hx, hy, 30, C.a, A * 0.9);
      ctx.globalAlpha = A; ctx.fillStyle = C.b; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; // the spirit arrowhead
      ctx.beginPath(); ctx.moveTo(hx + c * 22, hy + s * 22); ctx.lineTo(hx - s * 10, hy + c * 10); ctx.lineTo(hx + s * 10, hy - c * 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (!lite && i % 2 === 0) for (let j = 1; j <= 3; j++) glow(ctx, hx - c * j * 34 + jit(e.seed + i, j) * 14, hy - s * j * 34 + jit(e.seed, i + j) * 14, 7, C.c, A * (0.6 - j * 0.15)); // sparkle motes
    }
    if (e.hawk) {
      const [x0, y0, L, W] = e.hawk, ang = e.ang || 0, c = Math.cos(ang), s = Math.sin(ang), hk = Math.min(1, k / 0.62), d = L * (hk * hk * (3 - 2 * hk)), ha = e.a * (k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25);
      const bx = x0 + c * d, by = y0 + s * d - 70 + Math.sin(hk * Math.PI) * 38; // (it swoops: drops into the line, then climbs away)
      const wl = Math.min(d, 380), wx = bx - c * wl, wy = by - s * wl;
      ctx.globalAlpha = ha * 0.22; ctx.fillStyle = C.a; ctx.beginPath(); ctx.ellipse((wx + bx) / 2, (wy + by) / 2 + 60, wl / 2 + 20, W * 0.32, ang, 0, TAU); ctx.fill(); // the wind wake on the ground
      if (!lite) for (let j = 0; j < 4; j++) { const t = (j + 1) / 5; glowLine(ctx, () => { ctx.beginPath(); ctx.moveTo(wx - s * (j - 1.5) * 26, wy + c * (j - 1.5) * 26); ctx.lineTo(bx - c * 30 * t - s * (j - 1.5) * 10, by - s * 30 * t + c * (j - 1.5) * 10); }, 4, C.b, ha * 0.8); }
      trail(ctx, wx, wy, bx - c * 30, by - s * 30, 34, C.a, C.b, ha * 0.6, null);
      glow(ctx, bx, by, 95, C.c, ha * 0.6);
      hawkShape(ctx, bx, by, ang, 66, Math.sin((time || 0) * 26 + e.seed), C, ha);
      if (!lite) for (let j = 0; j < 6; j++) { const t = ((j * 0.17 + k * 1.3) % 1), fx = bx - c * t * 300 + jit(e.seed, j) * 40, fy = by - s * t * 300 + jit(e.seed + 3, j) * 40 + t * 40; ctx.globalAlpha = ha * (1 - t); ctx.fillStyle = j % 2 ? C.c : C.b; ctx.beginPath(); ctx.ellipse(fx, fy, 7, 3, ang + t * 4 + j, 0, TAU); ctx.fill(); } // feathers
    }
  },
  // Summoner (Mirelle): a rune circle unfolds under the struck enemy and grimoire pages whirl out of it in a spiral,
  // gilded edges glowing, soft violet motes in the storm
  pages(ctx, e, k, C, lite, time) {
    const A = e.a * (1 - Math.max(0, k - 0.6) / 0.4), R = e.r * easeOut(Math.min(1, k / 0.5)), spin = (e.ang || 0) + k * 5.5;
    glow(ctx, e.x, e.y, R * 0.9, C.a, A * 0.35);
    const ring = () => { ctx.beginPath(); ctx.ellipse(e.x, e.y, R, R * 0.6, 0, 0, TAU); };
    ctx.setLineDash(lite ? [] : [18, 10]); band(ctx, ring, 5, C.a, C.c, A * 0.9, C.ink); ctx.setLineDash([]);
    if (!lite) { const r2 = R * 0.62; band(ctx, () => { ctx.beginPath(); ctx.ellipse(e.x, e.y, r2, r2 * 0.6, 0, 0, TAU); }, 3, C.b, null, A * 0.6, C.ink); }
    if (!lite) for (let i = 0; i < 6; i++) { const a = spin * 0.5 + (i / 6) * TAU, rx = e.x + Math.cos(a) * R * 0.82, ry = e.y + Math.sin(a) * R * 0.82 * 0.6; ctx.globalAlpha = A; ctx.fillStyle = C.c; ctx.font = 'bold 18px serif'; ctx.textAlign = 'center'; ctx.fillText('ᚱᛟᚨᛞᛗᛖ'[i], rx, ry + 6); } // runes on the circle
    const N = lite ? 5 : 9;
    for (let i = 0; i < N; i++) { // the pages: out along a spiral, tumbling
      const ph = i / N, a = spin + ph * TAU, rr = R * (0.25 + 0.85 * Math.min(1, k * 1.6 + ph * 0.25)), px = e.x + Math.cos(a) * rr, py = e.y + Math.sin(a) * rr * 0.6 - 30 - 40 * Math.sin(k * Math.PI + ph * 3);
      if (!lite) { const a0 = a - 0.5, r0 = rr * 0.85; trail(ctx, e.x + Math.cos(a0) * r0, e.y + Math.sin(a0) * r0 * 0.6 - 30, px, py, 6, C.a, null, A * 0.35, null); }
      ctx.save(); ctx.translate(px, py); ctx.rotate(a * 1.3 + i); ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin((time || 0) * 9 + i * 1.7)));
      ctx.globalAlpha = A; ctx.fillStyle = '#fff8ea'; ctx.strokeStyle = C.c; ctx.lineWidth = 3; ctx.beginPath(); ctx.rect(-11, -14, 22, 28); ctx.fill(); ctx.stroke(); // (gilded edge)
      ctx.strokeStyle = C.a; ctx.lineWidth = 1.5; ctx.beginPath(); for (let l = -7; l <= 7; l += 4.5) { ctx.moveTo(-6, l); ctx.lineTo(6, l); } ctx.stroke(); // (the script)
      ctx.restore();
      glow(ctx, px, py, 18, C.a, A * 0.5);
    }
    if (k < 0.25) glow(ctx, e.x, e.y - 30, 60, C.c, e.a * (1 - k / 0.25)); // the grimoire flash
  },
  // Warrior (Brakka): a molten cleave shockwave sweeps out of the hero along the swing (a crescent of fire with a red-hot
  // core, rubble kicked up along its edge), the ground quakes round the struck enemy (a crack star + a ring), and the
  // warcry itself rings out round the hero
  warcry(ctx, e, k, C, lite, time) {
    const hx = e.hx ?? e.x, hy = e.hy ?? e.y, ang = e.ang || 0, half = (e.arc || 3) / 2;
    const gk = easeOut(Math.min(1, k / 0.5)), R = (e.len || 600) * gk, A = e.a * (1 - Math.max(0, k - 0.45) / 0.55);
    for (let i = 0; i < (lite ? 1 : 3); i++) { const rr = 50 + (k * 1.8 + i * 0.22) * 160; if (rr > 60 && k + i * 0.12 < 0.8) band(ctx, () => { ctx.beginPath(); ctx.ellipse(hx, hy - 20, rr, rr * 0.55, 0, 0, TAU); }, 3, C.b, null, A * (1 - k) * 0.5, C.ink); } // the warcry rings
    const arc = () => { ctx.beginPath(); ctx.ellipse(hx, hy, R, R * 0.62, 0, ang - half, ang + half); };
    if (!lite) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = A * 0.2; ctx.fillStyle = C.a; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.ellipse(hx, hy, R, R * 0.62, 0, ang - half, ang + half); ctx.closePath(); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; glowLine(ctx, arc, 20, C.a, A); }
    band(ctx, arc, 18 * (1 - k * 0.5) + 3, k < 0.35 ? C.c : C.a, C.b, A, C.ink);
    if (!lite) for (let i = 0; i <= 10; i++) { const a = ang - half + (i / 10) * half * 2, x = hx + Math.cos(a) * R, y = hy + Math.sin(a) * R * 0.62, z = 6 + 4 * jit(e.seed, i); glow(ctx, x, y - 10, 26, C.a, A * 0.5); ctx.globalAlpha = A; ctx.fillStyle = '#6b4a3a'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - z, y + 3); ctx.lineTo(x, y - z - 14 * (1 - k) * Math.abs(jit(e.seed + 5, i) * 2)); ctx.lineTo(x + z, y + 2); ctx.closePath(); ctx.fill(); ctx.stroke(); } // rubble on the edge
    // the quake under the struck enemy
    const qk = Math.min(1, k / 0.3), qR = (e.r || 240) * easeOut(qk), qa = e.a * (1 - k);
    for (let r = 0; r < (lite ? 4 : 7); r++) { const a = (r / 7) * TAU + e.seed, pts = []; for (let j = 0; j <= 5; j++) { const d = (qR * j) / 5; pts.push([e.x + Math.cos(a) * d + jit(e.seed + r, j) * 18, e.y + Math.sin(a) * d * 0.6 + jit(e.seed + 2 * r, j) * 12]); } band(ctx, polyPath(ctx, pts), 6 * (1 - k * 0.5), k < 0.4 ? C.a : '#5a2a14', k < 0.3 ? C.b : null, qa, C.ink); }
    band(ctx, () => { ctx.beginPath(); ctx.ellipse(e.x, e.y, qR, qR * 0.6, 0, 0, TAU); }, 5, C.a, null, qa * 0.8, C.ink);
    if (k < 0.2) glow(ctx, e.x, e.y, 90, C.c, e.a * (1 - k / 0.2));
  },
  // Summoner: an ink blot splashes out with droplets
  splash(ctx, e, k, C, lite) {
    const A = e.a * (1 - k), R = e.r * easeOut(Math.min(1, k / 0.4));
    ctx.globalAlpha = A * 0.55; ctx.fillStyle = C.ink; ctx.beginPath();
    for (let i = 0; i <= 14; i++) { const a = (i / 14) * TAU, rr = R * (0.8 + 0.25 * jit(e.seed, i)); ctx[i ? 'lineTo' : 'moveTo'](e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr * 0.6); }
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = A; ctx.strokeStyle = C.a; ctx.lineWidth = 4; ctx.stroke();
    if (!lite) for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + e.seed, rr = R * 1.1; ctx.fillStyle = C.b; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr * 0.6, 5, 0, TAU); ctx.fill(); }
  },
};
/** a 5-point star (Starfall's meteor head and stardust) */
function star(ctx, x, y, ro, ri, fill, a, rot = 0, ink = INK) {
  ctx.globalAlpha = a; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? ri : ro, t = rot + (i / 10) * TAU - Math.PI / 2; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(t) * r, y + Math.sin(t) * r); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.stroke();
}
function hops(ctx, e, k, C, lite, style) {
  const P = e.pts || []; if (P.length < 2) return;
  const n = P.length - 1, head = Math.min(n, (k / 0.6) * n), A = e.a * (1 - Math.max(0, k - 0.6) / 0.4);
  for (let i = 0; i < n && i < head; i++) {
    const a = P[i], b = P[i + 1], f = Math.min(1, head - i), bx = a[0] + (b[0] - a[0]) * f, by = a[1] + (b[1] - a[1]) * f;
    let p;
    if (style === 'bolt') { const pts = [[a[0], a[1] - 20]]; for (let j = 1; j < 6; j++) { const t = (j / 6) * f; pts.push([a[0] + (b[0] - a[0]) * t + jit(e.seed + i, j) * 26, a[1] + (b[1] - a[1]) * t - 20 + jit(e.seed + 7 * i, j) * 26]); } pts.push([bx, by - 20]); p = polyPath(ctx, pts); }
    else { const mx = (a[0] + bx) / 2, my = (a[1] + by) / 2 - (style === 'palm' ? 50 : 24); p = () => { ctx.beginPath(); ctx.moveTo(a[0], a[1] - 20); ctx.quadraticCurveTo(mx, my - 20, bx, by - 20); }; }
    if (!lite) glowLine(ctx, p, 5, C.a, A);
    band(ctx, p, style === 'arrow' ? 3 : 5, C.a, C.b, A, C.ink);
    if (f >= 1) {
      if (style === 'palm') { ctx.globalAlpha = A; ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(b[0], b[1], 30, 18, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = C.a; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = C.b; ctx.beginPath(); ctx.arc(b[0], b[1] - 20, 7, 0, TAU); ctx.fill(); }
      else { ctx.globalAlpha = A; ctx.fillStyle = C.b; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(b[0], b[1] - 20, style === 'bolt' ? 9 : 6, 0, TAU); ctx.fill(); ctx.stroke(); }
    }
  }
}
