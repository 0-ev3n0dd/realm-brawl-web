// Monk effects + sounds: motion-streak punches, impact rings, golden chi and the Awakened Spirit (gold / orange / white).
// Driven by 'monk' (predicted: casts, finishers, every strike) and 'monkx' (server: Chi gains, tier-ups, counter drops,
// spirit mirror hits, Flow dodges, Pressure Point pops, the Hundred Fists burst, the Heaven-Splitting Palm).
// Adds particle types ('mstreak', 'mfist', 'mseal') drawn by MONK_PARTS, cinematics (monkspirit, monkheaven) merged into the
// FX core's CINE table and a golden wash (monkwash) in UNDER. Chains get bigger with the hit-counter tier (ev.tier 0/1/2).
// Big world texts sit BELOW the target (y + r + 70) so they never overlap the finisher banner at the top of the screen.
const TAU = Math.PI * 2;
export const MONK_COL = { gold: '#ffd23f', sun: '#ffb02e', orange: '#ff8a1e', saffron: '#ff9a2e', hi: '#fffaf0', white: '#ffffff', ember: '#ff5a1a', ink: '#3a1a05', spirit: '#ffe58a' };
const C = MONK_COL;
const TIER_COL = [C.sun, C.gold, C.hi];
const rnd = (a, b) => a + Math.random() * (b - a);
const lite = (fx) => fx.partMul !== undefined && fx.partMul < 1;
const N = (fx, n) => Math.max(1, Math.round(n * (fx.partMul ?? 1)));
const at = (ev, d, da = 0) => [ev.x + Math.cos((ev.ang || 0) + da) * d, ev.y + Math.sin((ev.ang || 0) + da) * d];
const below = (ev, extra = 0) => ev.y + (ev.r || 24) + 34 + extra; // world texts go under the target (never under the banner)
const tsz = (ev) => 1 + (ev.tier || 0) * 0.28; // tier size scale

// ---- building blocks
function glow(fx, x, y, size, col, life = 0.3, a = 0.8) { if (!Number.isFinite(x + y + size)) return; if (!lite(fx)) fx.add({ type: 'glow', x, y, size, color: col, life, a }); }
function rays(fx, x, y, r, col, n = 12, life = 0.35, w = 5) { fx.add({ type: 'rays', x, y, r, color: col, n: Math.max(6, N(fx, n)), life, w, seed: rnd(0, TAU) }); }
function flash(fx, me, col, amt) { if (me) { fx.flash = Math.max(fx.flash || 0, amt); fx.flashColor = col; } }
function dark(fx, pid, life, a, col) { fx.cine.push({ kind: 'dark', t: 0, life, a, pid, col }); }
function endDark(fx, pid, after = 0.3) { for (const c of fx.cine) if (c.kind === 'dark' && c.pid === pid) c.life = Math.min(c.life, c.t + after); }
/** Motion streak: 3 tapered speed lines trailing a punch from (x,y) toward ang, length len. */
function streak(fx, x, y, ang, len, w = 10, col = C.gold, life = 0.22) {
  for (const [o, ww, l] of [[0, w, 1], [w * 0.9, w * 0.45, 0.7], [-w * 0.9, w * 0.45, 0.75]]) {
    const nx = -Math.sin(ang) * o, ny = Math.cos(ang) * o;
    fx.add({ type: 'mstreak', x: x + nx, y: y + ny, ang, len: len * l, w: ww, color: col, life, lite: lite(fx), drag: 1 });
  }
}
/** A punch impact: white star, gold impact ring(s), orange sparks. Bigger with tier. */
function punchHit(fx, x, y, ang, size = 1, tier = 0) {
  const s = size * (1 + tier * 0.2), col = TIER_COL[tier] || C.gold;
  fx.add({ type: 'flash', x, y, life: 0.09, size: 56 * s, color: C.white }); glow(fx, x, y, 80 * s, col, 0.22, 0.6);
  fx.ring(x, y, 40 * s, col, 0.2, 5); if (tier) fx.ring(x, y, 62 * s, C.hi, 0.26, 3);
  fx.sparks(x, y, ang, N(fx, 7 * s), C.orange, 460, 0.8);
}
function fist(fx, x, y, ang, size = 1, life = 0.3, col = C.spirit) { fx.add({ type: 'mfist', x, y, ang, size, color: col, life, lite: lite(fx), drag: 1, vx: Math.cos(ang) * 220, vy: Math.sin(ang) * 220 }); }
function whirl(fx, x, y, r, tier, life = 0.36, dir = 1) { // a whirlwind kick: two arcs of wind + a spinning ring
  const col = TIER_COL[tier] || C.gold;
  for (let i = 0; i < 2 + tier; i++) fx.add({ type: 'slash', x, y, ang: rnd(0, TAU), arc: 3.4, r: r * (0.75 + i * 0.12), life: life + i * 0.05, color: i % 2 ? C.orange : col, width: 14 + tier * 4, dir });
  fx.ring(x, y, r, col, life, 6 + tier * 2); if (tier >= 2) rays(fx, x, y, r * 1.1, C.hi, 14, 0.3, 5);
}

// ---- particle painters (called by the FX core for type 'mstreak' / 'mfist' / 'mseal')
export const MONK_PARTS = {
  mstreak(ctx, p, k, inv) { // a speed line: a tapered wedge from tail to head, bright white core
    const head = Math.min(1, k * 4), tail = Math.max(0, k * 1.6 - 0.2); if (head - tail < 0.02) return;
    const x0 = p.x + Math.cos(p.ang) * p.len * tail, y0 = p.y + Math.sin(p.ang) * p.len * tail, x1 = p.x + Math.cos(p.ang) * p.len * head, y1 = p.y + Math.sin(p.ang) * p.len * head;
    const nx = -Math.sin(p.ang), ny = Math.cos(p.ang), hw = p.w * 0.5 * inv + 0.5;
    ctx.save(); if (!p.lite) ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, inv * 1.8); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + nx * hw, y1 + ny * hw); ctx.lineTo(x1 + Math.cos(p.ang) * hw, y1 + Math.sin(p.ang) * hw); ctx.lineTo(x1 - nx * hw, y1 - ny * hw); ctx.closePath();
    ctx.fillStyle = p.color; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = C.hi; ctx.lineWidth = Math.max(1, hw * 0.5); ctx.stroke();
    ctx.restore();
  },
  mfist(ctx, p, k, inv) { // a translucent golden spirit fist flying forward
    const s = 22 * p.size * (0.7 + 0.3 * Math.min(1, k * 5));
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang); if (!p.lite) ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * inv; ctx.fillStyle = p.color; ctx.fillRect(-s * 2.4, -s * 0.55, s * 2.2, s * 1.1); // the trail
    ctx.globalAlpha = 0.85 * inv; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.85, 0, 0, TAU); ctx.fillStyle = p.color; ctx.fill();
    ctx.strokeStyle = C.hi; ctx.lineWidth = 2.5; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(s * 0.45, i * s * 0.33); ctx.lineTo(s * 0.9, i * s * 0.3); ctx.stroke(); } // knuckles
    ctx.globalAlpha = inv; ctx.beginPath(); ctx.ellipse(s * 0.2, 0, s * 0.45, s * 0.35, 0, 0, TAU); ctx.fillStyle = C.hi; ctx.fill();
    ctx.restore();
  },
  mseal(ctx, p, k, inv) { // a Seven Seals mark: a spinning golden seal glyph that hangs until it pops
    const fade = Math.min(1, (p.life - p.t) * 5), grow = 1 - Math.pow(1 - Math.min(1, p.t * 5), 3), R = p.r * grow, rot = p.t * 2 + p.seed;
    ctx.save(); ctx.translate(p.x, p.y); if (!p.lite) ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9 * fade;
    ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    ctx.beginPath(); for (let i = 0; i <= 5; i++) { const a = rot + i * TAU * 2 / 5; const x = Math.cos(a) * R * 0.8, y = Math.sin(a) * R * 0.8; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();
    ctx.fillStyle = C.hi; ctx.font = `${Math.round(R * 0.7)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String((p.i ?? 0) + 1), 0, 1);
    ctx.restore();
  },
};

/** The Awakened Spirit: a giant golden translucent monk behind the player (render.js calls this while the ult window is open). */
export function drawSpirit(ctx, x, y, ang, t, a = 0.55, punch = 0, scale = 1) {
  const s = 2.6 * scale, bob = Math.sin(t * 2.2) * 4;
  ctx.save(); ctx.translate(x - Math.cos(ang) * 26, y - Math.sin(ang) * 26 + bob); ctx.rotate(ang);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 70 * s); g.addColorStop(0, 'rgba(255,229,138,.55)'); g.addColorStop(1, 'rgba(255,160,40,0)');
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 70 * s, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, a) * 0.5; ctx.fillStyle = '#ffc93a';
  ctx.beginPath(); ctx.ellipse(-4 * s, 0, 14 * s, 21 * s, 0, 0, TAU); ctx.fill(); // body
  ctx.beginPath(); ctx.arc(2 * s, 0, 11 * s, 0, TAU); ctx.fill(); // head
  const pr = punch * 20 * s, side = Math.floor(t * 9) % 2;
  for (const sg of [1, -1]) { const ext = (sg > 0) === !!side ? pr : 0; ctx.beginPath(); ctx.arc(16 * s + ext, sg * 11 * s, 6.5 * s, 0, TAU); ctx.fill(); }
  for (const [col, lw] of [['#e0701a', 5], [C.hi, 2]]) { ctx.globalAlpha = a * (lw > 3 ? 0.8 : 1); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.ellipse(-4 * s, 0, 14 * s, 21 * s, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(2 * s, 0, 11 * s, 0, TAU); ctx.stroke(); }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a * 0.9; ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(9 * s, -4 * s, 1.8 * s, 0, TAU); ctx.arc(9 * s, 4 * s, 1.8 * s, 0, TAU); ctx.fill(); // glowing eyes
  ctx.restore();
}

// ---- cinematics
import { momFin, momPalmCharge, momHeaven } from './fxmoment.js'; // the Heaven-Splitting Palm signature moment
export const MONK_CINE = {
  monkspirit(fx, ctx, c) { // the ult cast: a colossal spirit rises behind the monk, then settles to the in-world size
    const k = Math.min(1, c.t / c.life), rise = Math.min(1, c.t / 0.35), a = (k < 0.8 ? 0.8 : (1 - k) * 4) * rise;
    drawSpirit(ctx, c.x, c.y, c.ang || 0, c.t, a, 0, 1.6 + (1 - rise) * 1.4);
  },
  monkheaven(fx, ctx, c) { // Heaven-Splitting Palm: the sky splits - a blinding vertical column + a horizontal crack of light
    const v = fx.view || { x0: c.x - 1200, x1: c.x + 1200, y0: c.y - 800, y1: c.y + 800 }, k = Math.min(1, c.t / c.life), open = 1 - Math.pow(1 - Math.min(1, c.t / 0.2), 3), fade = Math.min(1, (c.life - c.t) / 0.4);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const w = (40 + c.r * 2) * open * (1 - k * 0.5);
    const g = ctx.createLinearGradient(c.x - w, 0, c.x + w, 0); g.addColorStop(0, 'rgba(255,200,60,0)'); g.addColorStop(0.5, 'rgba(255,250,235,1)'); g.addColorStop(1, 'rgba(255,200,60,0)');
    ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = g; ctx.fillRect(c.x - w, v.y0 - 50, w * 2, c.y - v.y0 + 50);
    ctx.globalAlpha = 0.6 * fade; ctx.strokeStyle = C.hi; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.moveTo(v.x0, c.y); ctx.lineTo(v.x1, c.y); ctx.stroke();
    ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 40 + k * 500, 0, TAU); ctx.stroke();
    ctx.restore();
  },
};
export const MONK_UNDER = {
  monkwash(fx, ctx, c) { // Hundred Fists: a warm golden wash over the whole screen
    const v = fx.view; if (!v) return;
    const k = Math.min(1, c.t / 0.15) * Math.min(1, (c.life - c.t) / 0.3);
    ctx.save(); ctx.globalAlpha = 0.22 * k; ctx.fillStyle = '#ffcf5a'; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0); ctx.restore();
  },
};

/** Effects for 'monk' / 'monkx' events. */
export function monkFx(fx, ev, me) {
  if (ev.type === 'monk') switch (ev.ph) {
    case 'cast': {
      const ch = !!ev.chain, T = ev.tier || 0, col = TIER_COL[T];
      fx.ring(ev.x, ev.y, ch ? 58 + T * 12 : 38, ch ? col : C.sun, 0.22, ch ? 5 + T : 3); glow(fx, ev.x, ev.y, ch ? 90 + T * 20 : 56, C.gold, 0.22, 0.45);
      if (ev.fe) { rays(fx, ev.x, ev.y, 120, C.hi, 10, 0.3, 4); if (me) fx.text(ev.x, ev.y + 70, 'FLOW ×1.3', { size: 18, color: C.hi, life: 0.8, vy: 20, stroke: C.ink }); }
      if (ev.id === 'awakened_spirit') { // Awakened Spirit: the window opens
        fx.banner('AWAKENED SPIRIT', C.gold, 'THE SPIRIT MIRRORS EVERY HIT · 10 s', 1.8, 58);
        fx.cine.push({ kind: 'monkspirit', t: 0, life: 1.1, x: ev.x, y: ev.y, ang: ev.ang, pid: ev.pid });
        dark(fx, ev.pid, 1.0, 0.45, 'rgba(40,18,0,'); for (let i = 0; i < 3; i++) fx.ring(ev.x, ev.y, 90 + i * 70, i % 2 ? C.orange : C.gold, 0.45 + i * 0.1, 9);
        rays(fx, ev.x, ev.y, 260, C.gold, 20, 0.55, 7); fx.add({ type: 'pillar', x: ev.x, y: ev.y, size: 120, h: 520, color: C.gold, life: 0.8 });
        flash(fx, me, C.gold, 0.3); if (me) fx.slowmo(0.2, 0.4); fx.shake(0.4);
      }
      if (ev.id === 'flow_state') { for (let i = 0; i < N(fx, 8); i++) { const a = rnd(0, TAU); streak(fx, ev.x + Math.cos(a) * 40, ev.y + Math.sin(a) * 40, a + 1.6, 60, 5, C.hi, 0.3); } }
      if (ev.fm && me) fx.text(ev.x, ev.y + 90, `CHI ×${ev.fm}`, { size: 20, color: C.gold, pop: 2, life: 0.9, vy: 24, stroke: C.ink });
      return true;
    }
    case 'fin': {
      const boss = ev.route === 'boss';
      if (boss && ev.id === 'heaven_splitting_palm') { // the signature moment: letterbox + warm tint; the palm and the split land with the hit
        momFin(fx, ev, 'monk', 'MONK  ·  HEAVEN-SPLITTING PALM', 'R  E  Q  E  R');
        fx.cine.push({ kind: 'monkspirit', t: 0, life: 1.4, x: ev.x, y: ev.y, ang: ev.ang, pid: ev.pid });
        rays(fx, ev.x, ev.y, 280, C.gold, 20, 0.5, 8); fx.ring(ev.x, ev.y, 180, C.hi, 0.5, 10); flash(fx, me, C.gold, 0.3); fx.shake(0.3); return true;
      }
      fx.banner(ev.name.toUpperCase(), boss ? C.hi : C.gold, ev.fm > 1.01 ? `FINISHER · Chi ×${ev.fm}` : 'FINISHER', 2.4, 64);
      dark(fx, ev.pid, boss ? 1.9 : 1.7, boss ? 0.7 : 0.4, boss ? 'rgba(20,10,0,' : 'rgba(50,24,0,');
      if (!boss) fx.cine.push({ kind: 'monkwash', t: 0, life: 1.6, pid: ev.pid });
      fx.cine.push({ kind: 'monkspirit', t: 0, life: 1.4, x: ev.x, y: ev.y, ang: ev.ang, pid: ev.pid });
      rays(fx, ev.x, ev.y, 280, C.gold, 20, 0.5, 8); fx.ring(ev.x, ev.y, 180, C.hi, 0.5, 10);
      flash(fx, me, C.gold, 0.3); fx.shake(0.3); if (me) fx.slowmo(0.25, 0.4);
      return true;
    }
    case 'hit': return monkHit(fx, ev, me);
  }
  if (ev.type === 'monkx') switch (ev.ph) {
    case 'hit': return monkHit(fx, ev, me);
    case 'chi': if (me && ev.n >= 3) fx.text(ev.x, ev.y, `+${ev.n} Chi`, { size: 14, color: C.gold, life: 0.7, vy: -36 }); return true;
    case 'tier': { // the counter crosses 10 / 20: every chain evolves
      const col = TIER_COL[ev.tier] || C.gold;
      for (let i = 0; i < 1 + ev.tier; i++) fx.ring(ev.x, ev.y, 90 + i * 50, col, 0.4 + i * 0.1, 7);
      rays(fx, ev.x, ev.y, 150 + ev.tier * 40, col, 14, 0.4, 6); glow(fx, ev.x, ev.y, 160, C.gold, 0.4, 0.6);
      fx.add({ type: 'pillar', x: ev.x, y: ev.y, size: 60 + ev.tier * 20, h: 360, color: col, life: 0.5 });
      fx.text(ev.x, ev.y + 78, `${String(ev.name || '').toUpperCase()}!  CHAINS EVOLVE`, { size: me ? 24 : 16, color: col, pop: 2.2, life: 1.2, vy: 16, stroke: C.ink });
      if (me) { fx.shake(0.2); flash(fx, me, C.gold, 0.12); }
      return true;
    }
    case 'drop': if (me) { fx.text(ev.x, ev.y + 70, `combo lost (${ev.n})`, { size: 16, color: '#c9b79a', life: 0.9, vy: 20 }); fx.ring(ev.x, ev.y, 50, '#c9b79a', 0.3, 3); } return true;
    case 'mirror': { // the spirit echoes a hit: a golden fist streaks into the target
      const a = ev.ang || 0, sx = ev.x - Math.cos(a) * 90, sy = ev.y - Math.sin(a) * 90;
      fist(fx, sx, sy, a, 1.2, 0.26); streak(fx, sx - Math.cos(a) * 30, sy - Math.sin(a) * 30, a, 90, 12, C.spirit, 0.22);
      fx.ring(ev.x, ev.y, (ev.r || 20) + 24, C.spirit, 0.22, 4); return true;
    }
    case 'dodge': { // Flow: an effortless auto-dodge
      fx.add({ type: 'wghost', x: ev.x, y: ev.y, ang: ev.ang || 0, color: C.gold, hi: C.hi, len: 10, life: 0.35, a: 0.5, lite: lite(fx) });
      for (let i = 0; i < 3; i++) streak(fx, ev.x - Math.cos(ev.ang) * 30, ev.y - Math.sin(ev.ang) * 30 + (i - 1) * 12, ev.ang, 70, 5, C.hi, 0.25);
      fx.text(ev.x, ev.y + 64, 'FLOW', { size: me ? 20 : 14, color: C.hi, life: 0.6, vy: 20, stroke: C.ink }); return true;
    }
    case 'pop': { // Pressure Points pop: gold starbursts per point
      const n = ev.n || 1, r = (ev.r || 20) + 10, big = ev.fx === 'heaven' || ev.fx === 'release' || ev.fx === 'seal';
      for (let i = 0; i < Math.min(8, n); i++) { const a = i * TAU / Math.min(8, n) + rnd(-0.2, 0.2); const x = ev.x + Math.cos(a) * r * 0.7, y = ev.y + Math.sin(a) * r * 0.7; fx.add({ type: 'star', x, y, life: 0.22, size: 18 + n, color: C.gold }); }
      fx.ring(ev.x, ev.y, r + 20 + n * 4, big ? C.hi : C.gold, 0.3, 6); glow(fx, ev.x, ev.y, 70 + n * 10, C.orange, 0.3, 0.7);
      fx.sparks(ev.x, ev.y, 0, N(fx, 6 + n), C.hi, 420, Math.PI);
      fx.text(ev.x, below(ev, -10), `${n} POINT${n > 1 ? 'S' : ''}`, { size: 16 + Math.min(14, n * 1.4), color: C.gold, pop: 1.8, life: 0.9, vx: 0, vy: 18, stroke: C.ink });
      fx.shake(0.06 + Math.min(0.22, n * 0.025)); return true;
    }
    case 'fistsburst': { // Hundred Fists ends: every Pressure Point on the screen bursts at once
      for (let i = 0; i < 4; i++) fx.ring(ev.x, ev.y, 220 + i * 130, i % 2 ? C.orange : C.gold, 0.5 + i * 0.12, 12 - i * 2);
      rays(fx, ev.x, ev.y, 440, C.gold, 26, 0.6, 9); glow(fx, ev.x, ev.y, 420, C.gold, 0.6, 0.6);
      fx.text(ev.x, below({ y: ev.y, r: 40 }), `${ev.n || 0} POINTS BURST`, { size: me ? 30 : 20, color: C.gold, pop: 2.6, life: 1.6, vx: 0, vy: 12, stroke: C.ink });
      endDark(fx, ev.pid, 0.6); flash(fx, me, C.hi, 0.4); if (me) fx.slowmo(0.3, 0.3); fx.shake(0.8); return true;
    }
    case 'heaven': { // Heaven-Splitting Palm lands: the sky splits over the boss
      momHeaven(fx, ev, me);
      fx.cine.push({ kind: 'monkheaven', t: 0, life: 1.3, x: ev.x, y: ev.y, r: ev.r || 30, pid: ev.pid });
      fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.2, size: 260, color: C.white }); fx.add({ type: 'star', x: ev.x, y: ev.y, life: 0.3, size: 90, color: C.gold });
      for (let i = 0; i < 3; i++) fx.ring(ev.x, ev.y, 170 + i * 100, i % 2 ? C.gold : C.hi, 0.5 + i * 0.15, 12 - i * 3);
      rays(fx, ev.x, ev.y, 380, C.hi, 24, 0.55, 9); fx.sparks(ev.x, ev.y, ev.ang || 0, N(fx, 30), C.gold, 620, Math.PI);
      fx.text(ev.x, below(ev), `${ev.n || 0} POINTS · ×${ev.mul}`, { size: me ? 30 : 20, color: C.hi, pop: 2.4, life: 1.8, vx: 0, vy: 10, stroke: C.ink });
      endDark(fx, ev.pid, 0.5); flash(fx, me, C.white, 0.7); if (me) { fx.slowmo(0.45, 0.25); fx.punch(ev.ang || 0, 10); } fx.shake(1); return true;
    }
  }
  return true;
}

function monkHit(fx, ev, me) {
  const n = ev.n || 0, T = ev.tier || 0, s = tsz(ev), ang = ev.ang || 0, R = ev.r || 110, col = TIER_COL[T] || C.gold;
  switch (ev.fx) {
    case 'tiger0': case 'tiger1': case 'tiger2': case 'jab': { // punches: a motion streak into the target + an impact ring at the knuckles
      const i = +(ev.fx.slice(-1)) || 0, side = i % 2 ? -1 : 1, reach = (ev.r || 100) * 0.7;
      const [hx, hy] = at(ev, reach, side * 0.12);
      streak(fx, ev.x + Math.cos(ang + side * 1.57) * 8, ev.y + Math.sin(ang + side * 1.57) * 8, ang, reach, ev.fx === 'jab' ? 8 : 10 * s, col, 0.18);
      if (n || ev.fx === 'tiger2') punchHit(fx, hx, hy, ang, ev.fx === 'tiger2' ? 1.1 : 0.7, T); else fx.ring(hx, hy, 26, col, 0.16, 3);
      fx.shake(n ? 0.07 : 0.03); if (n && me && ev.fx === 'tiger2') fx.punch(ang, 4); return true;
    }
    case 'crane': case 'palmkick': case 'sweeppunch': { // a spinning kick / lead punch
      if (ev.fx === 'sweeppunch') { const [hx, hy] = at(ev, R * 0.6); streak(fx, ev.x, ev.y, ang, R * 0.7, 12 * s, col, 0.2); punchHit(fx, hx, hy, ang, 0.9, T); fx.shake(0.08); return true; }
      whirl(fx, ev.x, ev.y, R, T, 0.3); fx.sparks(ev.x, ev.y, ang, N(fx, 8), C.orange, 360, Math.PI);
      if (ev.fx === 'crane') { fx.add({ type: 'crack', x: ev.x, y: ev.y, r: R * 0.8, n: 6, seed: rnd(0, TAU), life: 0.8, col: C.orange, lite: lite(fx) }); }
      fx.shake(0.14); if (n && me) fx.punch(ang, 5); return true;
    }
    case 'ironpalm': { // Iron Palm: a huge golden palm print slams forward, a Pressure Point glyph burns on what it hits
      const [hx, hy] = at(ev, R * 0.6);
      streak(fx, ev.x, ev.y, ang, R * 0.8, 18 * s, col, 0.22); fist(fx, hx, hy, ang, 1.3 + T * 0.15, 0.3);
      fx.add({ type: 'flash', x: hx, y: hy, life: 0.14, size: 100 * s, color: C.white }); punchHit(fx, hx, hy, ang, 1.1, T);
      for (let i = 0; i < 3; i++) fx.add({ type: 'slash', x: ev.x, y: ev.y, ang, arc: ev.arc || 1.1, r: R * (0.55 + i * 0.25), life: 0.24 + i * 0.05, color: i % 2 ? C.orange : col, width: 10 + T * 2 });
      if (n) { rays(fx, hx, hy, 120, C.hi, 10, 0.3, 5); fx.text(hx, hy - 60, '✋ PRESSURE POINT', { size: 15, color: C.hi, life: 0.8, vy: -30 }); }
      fx.shake(n ? 0.2 : 0.1); if (me) fx.punch(ang, 6); return true;
    }
    case 'flow': { // Flow State opens: a wind shell of gold streaks
      fx.ring(ev.x, ev.y, R, C.hi, 0.3, 4); glow(fx, ev.x, ev.y, R * 1.2, C.gold, 0.3, 0.4);
      for (let i = 0; i < N(fx, 10); i++) { const a = i * TAU / 10; streak(fx, ev.x + Math.cos(a) * R * 0.6, ev.y + Math.sin(a) * R * 0.6, a + 1.4, 70, 5, i % 2 ? C.gold : C.hi, 0.3); }
      return true;
    }
    case 'sweep': case 'sweep2': case 'cyclone': { // Dragon Sweep whirlwinds / Cyclone Kick spins (pull-in lines at higher tiers)
      whirl(fx, ev.x, ev.y, R, T, 0.36 + T * 0.04, ev.fx === 'sweep2' ? -1 : 1);
      if (ev.fx === 'cyclone') for (let i = 0; i < N(fx, 6 + T * 3); i++) { const a = rnd(0, TAU), d = R + 60; streak(fx, ev.x + Math.cos(a) * d, ev.y + Math.sin(a) * d, a + Math.PI, 70, 6, C.hi, 0.25); }
      if (T >= 1) fx.add({ type: 'crack', x: ev.x, y: ev.y, r: R * 0.7, n: 7, seed: rnd(0, TAU), life: 0.7, col: C.orange, lite: lite(fx) });
      fx.shake(0.12 + T * 0.05); if (n && me) fx.punch(ang, 3 + T); return true;
    }
    case 'rush': { // Hundred Hands: a dash streak between enemies, a flurry of fists at each stop
      const fx0 = ev.fx0 ?? ev.x, fy0 = ev.fy0 ?? ev.y, a2 = Math.atan2(ev.y - fy0, ev.x - fx0), d = Math.hypot(ev.x - fx0, ev.y - fy0);
      if (d > 4) streak(fx, fx0, fy0, a2, d + 10, 14 * s, (ev.i || 0) % 2 ? C.orange : col, 0.25);
      fx.add({ type: 'wghost', x: fx0, y: fy0, ang: a2, color: C.gold, hi: C.hi, len: 12, life: 0.25, a: 0.35, lite: lite(fx) });
      for (let k = 0; k < 2 + T; k++) { const b = a2 + rnd(-0.5, 0.5); fist(fx, ev.x - Math.cos(b) * 40, ev.y - Math.sin(b) * 40, b, 0.6 + T * 0.1, 0.18); }
      if (n) punchHit(fx, ev.x + Math.cos(a2) * 26, ev.y + Math.sin(a2) * 26, a2, 0.8, T); fx.shake(0.06); return true;
    }
    case 'palm': case 'palm2': { // Shockwave Palm: a cone of rolling shock rings
      const L = ev.r || 260;
      for (let i = 0; i < 3 + T; i++) { const d = L * (0.2 + i * 0.22); const [x, y] = at(ev, d); fx.add({ type: 'slash', x: ev.x, y: ev.y, ang, arc: ev.arc || 1.2, r: d, life: 0.26 + i * 0.05, color: i % 2 ? C.orange : col, width: 12 + T * 3 }); glow(fx, x, y, 60 + T * 20, C.gold, 0.25, 0.4); }
      const [hx, hy] = at(ev, 40); fx.add({ type: 'flash', x: hx, y: hy, life: 0.12, size: 90 * s, color: C.white });
      if (T >= 2) rays(fx, hx, hy, L, C.hi, 12, 0.3, 5);
      fx.shake(0.2 + T * 0.05); if (me) fx.punch(ang, 6); return true;
    }
    case 'nerve': { const [hx, hy] = at(ev, 70); punchHit(fx, hx, hy, ang, 1.2, T); for (let i = 0; i < 6; i++) { const b = rnd(0, TAU); streak(fx, hx, hy, b, 40 + T * 15, 4, i % 2 ? C.gold : C.hi, 0.3); } fx.text(hx, hy + 60, 'NERVE STRIKE', { size: 16, color: C.gold, life: 0.8, vy: 16, stroke: C.ink }); fx.shake(0.2); return true; }
    case 'flip': fx.add({ type: 'wghost', x: ev.x, y: ev.y, ang, color: C.gold, hi: C.hi, len: 10, life: 0.35, a: 0.45, lite: lite(fx) }); streak(fx, ev.x, ev.y, ang + Math.PI, 90, 8, C.hi, 0.3); return true;
    case 'sealmark': fx.add({ type: 'mseal', x: ev.x, y: ev.y, r: 20 + T * 5, color: col, life: 1.2, i: ev.i ?? 0, seed: rnd(0, TAU), lite: lite(fx), drag: 1 }); fx.ring(ev.x, ev.y, 30, col, 0.2, 3); return true;
    case 'seal': { const [hx, hy] = at(ev, 60); punchHit(fx, hx, hy, ang, 0.8, T); return true; }
    case 'sealpop': { // Seven Seals: each seal explodes in sequence (the last one biggest)
      const last = (ev.i || 0) >= 6, sz = last ? 1.8 : 0.9;
      for (const q of fx.parts) if (q.type === 'mseal' && q.t < q.life - 0.2 && Math.hypot(q.x - ev.x, q.y - ev.y) < 60) { q.life = q.t + 0.15; break; }
      fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.12, size: 80 * sz, color: C.white }); fx.ring(ev.x, ev.y, 60 * sz, col, 0.28, 6); glow(fx, ev.x, ev.y, 100 * sz, C.orange, 0.3, 0.6);
      fx.sparks(ev.x, ev.y, 0, N(fx, 6 * sz), C.gold, 400, Math.PI);
      fx.text(ev.x, ev.y + 50, `${(ev.i || 0) + 1}`, { size: last ? 34 : 20, color: C.hi, pop: 2, life: 0.6, vy: 14, stroke: C.ink });
      if (last) { rays(fx, ev.x, ev.y, 200, C.gold, 16, 0.4, 7); fx.add({ type: 'pillar', x: ev.x, y: ev.y, size: 80, h: 400, color: C.gold, life: 0.5 }); fx.shake(0.4); } else fx.shake(0.08); return true;
    }
    case 'dragon': { // Rising Dragon: an uppercut that throws a coiling dragon of fire upward
      const [hx, hy] = at(ev, (ev.r || 150) * 0.5);
      punchHit(fx, hx, hy, ang, 1.4, T); fx.add({ type: 'pillar', x: hx, y: hy, size: 70 + T * 20, h: 460, color: C.orange, life: 0.55 });
      for (let i = 0; i < 12; i++) { const t0 = i / 12; fx.add({ type: 'glow', x: hx + Math.sin(t0 * 9) * 24, y: hy - t0 * 260, size: 40 - i * 2, color: i % 2 ? C.orange : C.gold, life: 0.3 + t0 * 0.3, a: 0.8, vy: -140 }); }
      fx.text(hx, hy + 70, 'INTERRUPT!', { size: 18, color: C.orange, life: 0.8, vy: 14, stroke: C.ink }); fx.shake(0.35); if (me) fx.punch(ang, 7); return true;
    }
    case 'spiritslam': { // the ult opening: the spirit's two fists slam the ground
      for (let i = 0; i < 3; i++) fx.ring(ev.x, ev.y, R * (0.6 + i * 0.3), i % 2 ? C.gold : C.hi, 0.4 + i * 0.1, 10);
      fx.add({ type: 'crack', x: ev.x, y: ev.y, r: R, n: 9, seed: rnd(0, TAU), life: 1.1, col: C.gold, lite: lite(fx) });
      fist(fx, ev.x - 60, ev.y - 90, 1.2, 2.4, 0.3); fist(fx, ev.x + 60, ev.y - 90, 1.9, 2.4, 0.3); fx.shake(0.6); return true;
    }
    case 'fist': { // Hundred Fists: one spirit fist of sixty, anywhere on screen
      const a = ev.ang || 0; fist(fx, ev.x - Math.cos(a) * 60, ev.y - Math.sin(a) * 60, a, 1.4, 0.22);
      if (n) punchHit(fx, ev.x, ev.y, a, 0.9, 2); else fx.ring(ev.x, ev.y, 30, C.spirit, 0.18, 3);
      if ((ev.i || 0) % 5 === 0) fx.shake(0.05); return true;
    }
    case 'fistslam': for (let i = 0; i < 3; i++) fx.ring(ev.x, ev.y, R * (0.5 + i * 0.3), C.gold, 0.4 + i * 0.1, 10); fx.add({ type: 'pillar', x: ev.x, y: ev.y, size: 180, h: 600, color: C.gold, life: 0.7 }); fx.shake(0.7); return true;
    case 'palmcharge': { // Heaven-Splitting Palm: a step in, a palm drawn back, light gathering
      momPalmCharge(fx, ev);
      glow(fx, ev.x, ev.y, 200, C.gold, 0.5, 0.7); for (let i = 0; i < N(fx, 14); i++) { const a = rnd(0, TAU), d = rnd(160, 260); streak(fx, ev.x + Math.cos(a) * d, ev.y + Math.sin(a) * d, a + Math.PI, d * 0.7, 5, C.hi, 0.35); }
      fx.ring(ev.x, ev.y, (ev.r || 30) + 90, C.hi, 0.5, 4); if (me) fx.slowmo(0.25, 0.5); return true;
    }
    case 'heavenring': whirl(fx, ev.x, ev.y, R, 2, 0.45); return true;
    case 'release': { // the window ran out: Spirit Release pops every Pressure Point
      for (let i = 0; i < 3; i++) fx.ring(ev.x, ev.y, 200 + i * 150, i % 2 ? C.orange : C.gold, 0.5 + i * 0.12, 10);
      glow(fx, ev.x, ev.y, 400, C.gold, 0.5, 0.5); fx.text(ev.x, ev.y + 90, 'SPIRIT RELEASE', { size: me ? 26 : 18, color: C.gold, pop: 2, life: 1.2, vy: 12, stroke: C.ink }); fx.shake(0.4); return true;
    }
    default: fx.ring(ev.x, ev.y, R, col, 0.25, 5); return true;
  }
}

/** Sounds for 'monk' / 'monkx' (au = the Audio object: play / tone / hiss). */
export function monkSound(au, ev, me) {
  if (!au.ctx || au.muted) return;
  if (ev.type === 'monk') switch (ev.ph) {
    case 'cast': au.hiss(3200, 1200, 0.05, 0.1, 1.1); if (ev.id === 'awakened_spirit') { au.play('roar'); au.tone('sine', 196, 392, 0.9, 0.16); au.tone('triangle', 294, 588, 0.9, 0.1, 0.05); } if (ev.id === 'flow_state') au.tone('sine', 660, 990, 0.25, 0.06); return;
    case 'fin': au.tone('sine', 392, 784, 1.2, 0.12); au.play('chain'); return;
    case 'hit':
      if (ev.fx === 'fist') { if ((ev.i || 0) % 3 === 0) au.tone('square', 180, 90, 0.05, 0.06); return; }
      if (ev.fx === 'sealmark') { au.tone('triangle', 1320 + (ev.i || 0) * 60, 1320, 0.08, 0.05); return; }
      if (ev.fx === 'sealpop') { au.play('heavy'); return; }
      if (ev.fx === 'palmcharge') { au.tone('sine', 220, 880, 0.7, 0.1); return; }
      au.tone('square', 240 + (ev.tier || 0) * 60, 120, 0.05, 0.07); au.hiss(2600, 900, 0.04, 0.08, 1.2); if (ev.n) au.play('heavy'); return;
  }
  if (ev.type === 'monkx') switch (ev.ph) {
    case 'tier': if (me) { au.tone('triangle', 523, 1046, 0.3, 0.1); au.tone('triangle', 659, 1318, 0.3, 0.08, 0.08); } return;
    case 'dodge': au.hiss(5200, 2200, 0.08, 0.08, 1.3); return;
    case 'pop': au.play('crit'); return;
    case 'mirror': au.tone('sine', 330, 165, 0.08, 0.04); return;
    case 'fistsburst': case 'heaven': au.play('detonate'); au.tone('sine', 98, 49, 0.9, 0.2); return;
  }
}
