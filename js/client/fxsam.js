// Samurai effects + sounds: ink-brush slash trails, cherry petals and moonlight (white / pink / silver on black ink).
// Driven by 'sam' (predicted: casts, finishers, every cut) and 'samx' (server: parries, counters, Delayed Cut bursts, Focus,
// Moment of Death, the Perfect Cut split, the petal-storm burst). Adds two particle types ('ink', 'petal') drawn by
// SAM_PARTS and three cinematics (samline, samsplit, samfreeze) merged into the FX core's CINE / UNDER tables.
const TAU = Math.PI * 2;
export const SAM_COL = { pink: '#ff8cc6', petal: '#ffc2e0', hi: '#fff3fa', silver: '#dfe8ff', moon: '#bcd4ff', ink: '#170d1f', gold: '#ffe7a8' };
const C = SAM_COL;
const rnd = (a, b) => a + Math.random() * (b - a);
const lite = (fx) => fx.partMul !== undefined && fx.partMul < 1;
const N = (fx, n) => Math.max(1, Math.round(n * (fx.partMul ?? 1)));
const at = (ev, d, da = 0) => [ev.x + Math.cos((ev.ang || 0) + da) * d, ev.y + Math.sin((ev.ang || 0) + da) * d];

// ---- building blocks
/** Ink-brush stroke along a line: a black ink body tapered at both ends, a coloured wash and a white-hot edge, drying splatter. */
function ink(fx, x, y, ang, len, w, col = C.pink, hi = C.hi, life = 0.42, o = {}) { fx.add({ type: 'ink', mode: 'line', x, y, ang, len, w, color: col, hi, life, seed: rnd(0, 99), lite: lite(fx), drag: 1, ...o }); }
/** Ink-brush stroke along an arc (centre x,y; radius r; arc centred on ang). */
function inkArc(fx, x, y, ang, arc, r, w, col = C.pink, hi = C.hi, life = 0.4, dir = 1, o = {}) { fx.add({ type: 'ink', mode: 'arc', x, y, ang, arc, r, w, color: col, hi, life, dir, seed: rnd(0, 99), lite: lite(fx), drag: 1, ...o }); }
function petals(fx, x, y, n, spread = 50, sp = 160, col = null, o = {}) {
  for (let i = 0; i < N(fx, n); i++) { const a = rnd(0, TAU), s = rnd(sp * 0.3, sp); fx.add({ type: 'petal', x: x + rnd(-spread, spread) * 0.5, y: y + rnd(-spread, spread) * 0.35, vx: Math.cos(a) * s, vy: Math.sin(a) * s - rnd(10, 60), life: rnd(0.9, 1.6), size: rnd(4, 7.5), color: col || (Math.random() < 0.25 ? C.hi : Math.random() < 0.5 ? C.pink : C.petal), rot: rnd(0, TAU), vr: rnd(-7, 7), drag: 0.93, seed: rnd(0, 9), ...o }); }
}
function glow(fx, x, y, size, col, life = 0.3, a = 0.8) { if (!Number.isFinite(x + y + size)) return; /* (never hand the canvas a NaN gradient) */ if (!lite(fx)) fx.add({ type: 'glow', x, y, size, color: col, life, a }); }
function rays(fx, x, y, r, col, n = 12, life = 0.35, w = 5) { fx.add({ type: 'rays', x, y, r, color: col, n: Math.max(6, N(fx, n)), life, w, seed: rnd(0, TAU) }); }
function ghost(fx, x, y, ang, a = 0.45, life = 0.3) { fx.add({ type: 'wghost', x, y, ang, color: '#c9b8e8', hi: C.silver, len: 46, life, a, lite: lite(fx) }); }
function flash(fx, me, col, amt) { if (me) { fx.flash = Math.max(fx.flash || 0, amt); fx.flashColor = col; } }
function dark(fx, pid, life, a, col) { fx.cine.push({ kind: 'dark', t: 0, life, a, pid, col }); }
function endDark(fx, pid, after = 0.3) { for (const c of fx.cine) if (c.kind === 'dark' && c.pid === pid) c.life = Math.min(c.life, c.t + after); }
/** A clean katana impact: white star, silver ring, pink sparks, a few petals. */
function cutHit(fx, x, y, ang, size = 1, col = C.pink) {
  fx.add({ type: 'flash', x, y, life: 0.1, size: 60 * size, color: C.hi }); glow(fx, x, y, 90 * size, col, 0.26, 0.6);
  fx.sparks(x, y, ang, N(fx, 9 * size), C.hi, 480, 0.7); fx.ring(x, y, 46 * size, C.silver, 0.2, 4); petals(fx, x, y, 3 * size, 30, 140);
}
/** An X of ink slashes over a point (Delayed Cut marks bursting). */
function xcut(fx, x, y, r, col, n = 2, life = 0.34) {
  for (let i = 0; i < n; i++) { const a = -0.8 + (i * 1.9) % 3.2 + rnd(-0.2, 0.2); ink(fx, x - Math.cos(a) * r, y - Math.sin(a) * r, a, r * 2, 9 + r * 0.08, col, C.hi, life, { speed: 7 }); }
}

// ---- particle painters (called by the FX core for type 'ink' / 'petal')
function inkPath(ctx, p, s0, s1, wmul, dx = 0, dy = 0) { // tapered brush polygon between fractions s0..s1
  const n = 14, pts = [], L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const f = s0 + (s1 - s0) * (i / n), taper = Math.sin(Math.PI * Math.min(1, Math.max(0, (f - s0) / Math.max(0.001, s1 - s0)))) ** 0.6;
    const wob = 1 + 0.18 * Math.sin(p.seed + f * 13), hw = p.w * 0.5 * taper * wob * wmul;
    let x, y, nx, ny;
    if (p.mode === 'arc') { const a = p.ang - (p.dir || 1) * p.arc / 2 + (p.dir || 1) * p.arc * f; x = p.x + Math.cos(a) * p.r; y = p.y + Math.sin(a) * p.r; nx = Math.cos(a); ny = Math.sin(a); }
    else { x = p.x + Math.cos(p.ang) * p.len * f; y = p.y + Math.sin(p.ang) * p.len * f; nx = -Math.sin(p.ang); ny = Math.cos(p.ang); }
    L.push([x + nx * hw + dx, y + ny * hw + dy]); R.push([x - nx * hw * 0.55 + dx, y - ny * hw * 0.55 + dy]); pts.push([x, y]);
  }
  ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (const q of L) ctx.lineTo(q[0], q[1]); for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]); ctx.closePath();
  return pts;
}
export const SAM_PARTS = {
  ink(ctx, p, k, inv) {
    const sp = p.speed || 5, head = Math.min(1, k * sp), tail = Math.max(0, k * 1.5 - 0.45), s0 = Math.min(head, tail), s1 = head;
    if (s1 - s0 < 0.01) return;
    const fade = p.hang ? Math.min(1, (p.life - p.t) * 6) * (0.85 + 0.15 * Math.sin(p.t * 16 + p.seed)) : Math.min(1, inv * 1.6);
    const hs0 = p.hang ? 0 : s0; // hanging cuts stay drawn until they burst
    ctx.save();
    if (!p.lite) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.28 * fade; inkPath(ctx, p, hs0, s1, 2.3); ctx.fillStyle = p.color; ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    ctx.globalAlpha = 0.92 * fade; inkPath(ctx, p, hs0, s1, 1.15, 2, 3); ctx.fillStyle = C.ink; ctx.fill(); // the black ink body (offset: a brush shadow)
    ctx.globalAlpha = fade; inkPath(ctx, p, hs0, s1, 0.9); ctx.fillStyle = p.color; ctx.fill();
    const pts = inkPath(ctx, p, hs0, s1, 0.34); ctx.fillStyle = p.hi || '#fff'; ctx.fill();
    if (!p.lite && k < 0.5) { const e = pts[pts.length - 1]; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(e[0], e[1], p.w * 0.35 + 2, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); }
    if (!p.lite && k > 0.25) { ctx.globalAlpha = 0.7 * fade; ctx.fillStyle = C.ink; for (let i = 0; i < 4; i++) { const q = pts[Math.floor(((p.seed * 7 + i * 3.7) % 1) * pts.length) % pts.length] || pts[0]; const o = ((p.seed * 13 + i * 5.3) % 1 - 0.5) * p.w * 1.6; ctx.beginPath(); ctx.arc(q[0] + o, q[1] - o * 0.6, 1.5 + (i % 3), 0, TAU); ctx.fill(); } } // splatter
    ctx.restore();
  },
  petal(ctx, p, k, inv) {
    const sway = Math.sin(p.t * 5 + p.seed) * 6, s = p.size * (p.frozen ? 1 : Math.min(1, inv * 2));
    ctx.save(); ctx.translate(p.x + sway, p.y); ctx.rotate(p.rot || 0); ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.t * 4 + p.seed)));
    ctx.globalAlpha = Math.min(1, inv * 2.2);
    ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(-s * 0.2, -s * 0.9, s, -s * 0.15); ctx.lineTo(s * 0.7, 0); ctx.lineTo(s, s * 0.15); ctx.quadraticCurveTo(-s * 0.2, s * 0.9, -s, 0);
    ctx.fillStyle = p.color; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(120,30,80,.55)'; ctx.stroke();
    ctx.restore();
  },
};

// ---- cinematics
export const SAM_CINE = {
  samline(fx, ctx, c) { // One Perfect Cut: a single white hairline across the whole (black) screen
    const v = fx.view || { x0: c.x - 1500, x1: c.x + 1500 }, L = Math.max(1600, (v.x1 - v.x0) * 1.2);
    const grow = Math.min(1, c.t / 0.14), x0 = c.x - Math.cos(c.ang) * L * grow, y0 = c.y - Math.sin(c.ang) * L * grow, x1 = c.x + Math.cos(c.ang) * L * grow, y1 = c.y + Math.sin(c.ang) * L * grow;
    const fade = Math.min(1, (c.life - c.t) / 0.25), shimmer = 0.8 + 0.2 * Math.sin(c.t * 40);
    ctx.save(); ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * fade; ctx.strokeStyle = '#d8e4ff'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = fade * shimmer; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.restore();
  },
  samsplit(fx, ctx, c) { // ...and the boss splits open along it: a blinding slit, the two halves drift apart
    const k = Math.min(1, c.t / c.life), open = 1 - Math.pow(1 - Math.min(1, c.t / 0.5), 3), nx = -Math.sin(c.ang), ny = Math.cos(c.ang), R = c.r + 18, gap = open * (14 + c.r * 0.35);
    ctx.save();
    for (const sgn of [1, -1]) { // shadowed halves (a half-disc each side of the cut line) sliding apart
      ctx.globalAlpha = 0.55 * (1 - k); ctx.beginPath(); ctx.arc(c.x + nx * gap * sgn, c.y + ny * gap * sgn, R, c.ang + (sgn > 0 ? 0 : Math.PI), c.ang + (sgn > 0 ? Math.PI : TAU)); ctx.closePath();
      ctx.fillStyle = 'rgba(10,4,18,1)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.hi; ctx.stroke();
    }
    const L = R * 2.6, w = (1 - k) * (10 + gap * 1.4);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9 * (1 - k); ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round'; ctx.lineWidth = w + 2;
    ctx.beginPath(); ctx.moveTo(c.x - Math.cos(c.ang) * L, c.y - Math.sin(c.ang) * L); ctx.lineTo(c.x + Math.cos(c.ang) * L, c.y + Math.sin(c.ang) * L); ctx.stroke();
    ctx.strokeStyle = C.pink; ctx.globalAlpha = 0.5 * (1 - k); ctx.lineWidth = w * 2.4 + 6; ctx.stroke();
    ctx.restore();
  },
};
export const SAM_UNDER = {
  samfreeze(fx, ctx, c) { // Moment of Death: time stops - a pale silver wash, a slowly turning ring of stillness
    const v = fx.view; if (!v) return;
    const k = Math.min(1, c.t / 0.12) * Math.min(1, (c.life - c.t) / 0.25);
    ctx.save(); ctx.globalAlpha = 0.34 * k; ctx.fillStyle = '#c9d6f2'; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    ctx.globalAlpha = 0.5 * k; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([18, 14]); ctx.lineDashOffset = -c.t * 30;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r * (0.35 + 0.1 * Math.sin(c.t * 2)), 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  },
};

/** Effects for 'sam' / 'samx' events. */
export function samFx(fx, ev, me) {
  if (ev.type === 'sam') switch (ev.ph) {
    case 'cast': {
      const ch = !!ev.chain;
      fx.ring(ev.x, ev.y, ch ? 64 : 40, ch ? C.pink : C.silver, 0.22, ch ? 6 : 3); glow(fx, ev.x, ev.y, ch ? 100 : 60, C.pink, 0.22, 0.45);
      if (ch) petals(fx, ev.x, ev.y, 6, 30, 120);
      if (ev.id === 'void_blade') { // Blade of the Void: the window opens
        fx.banner('BLADE OF THE VOID', C.silver, 'FREE SHEATHES · FOCUS KEPT · 10 s', 1.8, 58);
        dark(fx, ev.pid, 1.2, 0.5, 'rgba(10,6,24,'); for (let i = 0; i < 3; i++) fx.ring(ev.x, ev.y, 90 + i * 60, i % 2 ? C.pink : C.silver, 0.45 + i * 0.1, 8);
        rays(fx, ev.x, ev.y, 240, C.moon, 18, 0.5, 7); petals(fx, ev.x, ev.y, 36, 80, 320); flash(fx, me, C.silver, 0.3); if (me) fx.slowmo(0.2, 0.4); fx.shake(0.35);
      }
      if (ev.fm && me) fx.text(ev.x, ev.y - 96, `FOCUS ×${ev.fm}`, { size: 22, color: C.gold, pop: 2, life: 0.9, vy: -30 });
      return true;
    }
    case 'fin': {
      const boss = ev.route === 'boss';
      fx.banner(ev.name.toUpperCase(), boss ? '#ffffff' : C.pink, ev.fm > 1.01 ? `FINISHER · Focus ×${ev.fm}` : 'FINISHER', 2.4, 64);
      if (boss) dark(fx, ev.pid, 1.95, 0.94, 'rgba(2,2,8,'); // One Perfect Cut: the screen goes black
      else { dark(fx, ev.pid, 1.8, 0.5, 'rgba(40,6,26,'); petals(fx, ev.x, ev.y, 40, 200, 380); }
      rays(fx, ev.x, ev.y, 260, boss ? '#ffffff' : C.pink, 18, 0.5, 8); fx.ring(ev.x, ev.y, 170, C.silver, 0.5, 10);
      flash(fx, me, boss ? '#000000' : C.pink, 0.3); fx.shake(0.3); if (me) fx.slowmo(0.25, 0.4);
      return true;
    }
    case 'hit': return samHit(fx, ev, me);
  }
  if (ev.type === 'samx') switch (ev.ph) {
    case 'hit': return samHit(fx, ev, me);
    case 'focus': if (me) fx.text(ev.x, ev.y, `+${ev.n} Focus`, { size: ev.why === 'parry' ? 22 : 15, color: C.gold, life: 0.8, vy: -40 }); return true;
    case 'parry': { // PERFECT PARRY: blades clash, time hitches
      const x = ev.tx ?? ev.x, y = ev.ty ?? ev.y;
      fx.add({ type: 'flash', x, y, life: 0.14, size: 110, color: '#ffffff' }); fx.add({ type: 'star', x, y, life: 0.24, size: 44, color: '#ffffff' });
      rays(fx, x, y, 170, C.silver, 16, 0.35, 6); fx.ring(x, y, 110, ev.moon ? C.moon : C.silver, 0.35, 8); fx.ring(ev.x, ev.y, 70, C.pink, 0.28, 5);
      fx.sparks(x, y, ev.ang + Math.PI, N(fx, 22), '#ffffff', 560, 1.3); glow(fx, x, y, 160, C.moon, 0.35, 0.7);
      fx.text(ev.x, ev.y - 92, ev.moon ? 'MOONLIT GUARD!' : 'PARRY!', { size: me ? 36 : 24, color: '#ffffff', pop: 2.6, life: 1, stroke: C.ink });
      flash(fx, me, '#ffffff', 0.22); if (me) { fx.slowmo(0.18, 0.25); fx.punch(ev.ang + Math.PI, 6); } fx.shake(0.3);
      return true;
    }
    case 'burst': { // Delayed Cuts burst on an enemy: all its marks slash open at once
      const n = ev.n || 1, r = (ev.r || 20) + 8, col = ev.dbl ? C.gold : ev.fx === 'storm' ? C.pink : C.hi;
      xcut(fx, ev.x, ev.y - 6, r, ev.dbl ? C.gold : C.pink, Math.min(6, 1 + Math.ceil(n / 2)), 0.36);
      glow(fx, ev.x, ev.y, 70 + n * 8, ev.dbl ? C.gold : C.pink, 0.3, 0.7); fx.ring(ev.x, ev.y, r + 20 + n * 3, col, 0.3, 6);
      petals(fx, ev.x, ev.y, 3 + Math.min(10, n), r, 200); fx.sparks(ev.x, ev.y, 0, N(fx, 6 + n), '#ffffff', 420, Math.PI);
      fx.text(ev.x, ev.y - r - 34, `${n} CUT${n > 1 ? 'S' : ''}${ev.dbl ? ' ×2' : ''}`, { size: 16 + Math.min(14, n * 1.2), color: col, pop: 1.8, life: 0.9, vx: 0, stroke: C.ink });
      fx.shake(0.06 + Math.min(0.2, n * 0.02)); return true;
    }
    case 'bloom': fx.ring(ev.x, ev.y, ev.r, C.petal, 0.35, 6); petals(fx, ev.x, ev.y, 6, ev.r, 160); return true;
    case 'sheathed': // the blade clicks home
      if (ev.n > 0) { fx.text(ev.x, ev.y - 104, `${ev.bl ? 'BLOSSOM · ' : ''}${ev.n} CUTS BURST${ev.dbl ? ' ×2' : ''}`, { size: me ? 22 : 16, color: ev.dbl ? C.gold : C.petal, pop: 1.8, life: 1, vy: -30, stroke: C.ink }); if (me) fx.slowmo(0.08, 0.4); }
      return true;
    case 'death': { // Moment of Death: the guaranteed crit
      impactBig(fx, ev.x, ev.y, ev.ang, C.hi, 1.4);
      xcut(fx, ev.x, ev.y, 60, '#ffffff', 3, 0.5);
      fx.text(ev.x, ev.y + (ev.r || 30) + 70, `MOMENT OF DEATH · ${ev.n} CUT${ev.n === 1 ? '' : 'S'} · ×${ev.mul}`, { size: 22, color: '#ffffff', vy: -26, pop: 1.6, life: 1.5, vx: 0, stroke: C.ink });
      for (const c of fx.cine) if (c.kind === 'samfreeze' && c.pid === ev.pid) c.life = Math.min(c.life, c.t + 0.25);
      flash(fx, me, '#ffffff', 0.35); if (me) fx.slowmo(0.22, 0.3); fx.shake(0.55); return true;
    }
    case 'split': { // One Perfect Cut lands: the boss splits open along the white line
      fx.cine.push({ kind: 'samsplit', t: 0, life: 1.1, x: ev.x, y: ev.y, r: ev.r || 30, ang: ev.ang, pid: ev.pid });
      impactBig(fx, ev.x, ev.y, ev.ang, '#ffffff', 2);
      petals(fx, ev.x, ev.y, 70, 60, 520); for (let i = 0; i < 3; i++) fx.ring(ev.x, ev.y, 160 + i * 90, i % 2 ? C.pink : '#ffffff', 0.5 + i * 0.15, 12 - i * 3);
      fx.text(ev.x, ev.y + (ev.r || 30) + 70, `ONE PERFECT CUT · ${ev.n} CUT${ev.n === 1 ? '' : 'S'} · ×${ev.mul}`, { size: me ? 30 : 22, color: '#ffffff', pop: 2.4, life: 1.8, vx: 0, vy: -20, stroke: C.ink });
      endDark(fx, ev.pid, 0.5); flash(fx, me, '#ffffff', 0.7); if (me) fx.slowmo(0.45, 0.25); fx.shake(1); return true;
    }
    case 'vmark': { const r = (ev.r || 30) + 40; fx.ring(ev.x, ev.y, r + 50, C.ink, 0.9, 12); fx.ring(ev.x, ev.y, r, C.pink, 1.1, 7); petals(fx, ev.x, ev.y, 18, r, 160); fx.text(ev.x, ev.y - r - 40, 'VOID MARK', { size: me ? 22 : 16, color: C.petal, pop: 1.8, life: 1.1, vx: 0, vy: -20, stroke: C.ink }); return true; }
    case 'held': petals(fx, ev.x, ev.y, 4, (ev.r || 30) + 10, 90); if (me) fx.text(ev.x, ev.y - (ev.r || 30) - 56, `${ev.n} HELD`, { size: 15, color: C.petal, life: 0.8, vx: 0, vy: -24, stroke: C.ink }); return true;
    case 'stormburst': { // Thousand Petal Storm: one sheathe click, every cut on the screen bursts
      for (const q of fx.parts) if (q.type === 'ink' && q.hang && q.pid === ev.pid) { q.hang = false; q.t = q.life * 0.55; } // the hanging cuts flare out
      for (let i = 0; i < 4; i++) fx.ring(ev.x, ev.y, 200 + i * 130, i % 2 ? C.pink : C.hi, 0.5 + i * 0.12, 12 - i * 2);
      petals(fx, ev.x, ev.y, 90, 500, 520); rays(fx, ev.x, ev.y, 420, C.pink, 24, 0.6, 9); glow(fx, ev.x, ev.y, 420, C.pink, 0.6, 0.6);
      fx.text(ev.x, ev.y + (ev.r || 30) + 70, `THOUSAND PETALS · ${ev.n} CUTS`, { size: me ? 34 : 24, color: C.petal, pop: 2.6, life: 1.6, vx: 0, vy: -20, stroke: C.ink });
      endDark(fx, ev.pid, 0.6); flash(fx, me, C.hi, 0.45); if (me) fx.slowmo(0.35, 0.3); fx.shake(0.8); return true;
    }
  }
  return true;
}
function impactBig(fx, x, y, ang, col, size) {
  fx.add({ type: 'flash', x, y, life: 0.16, size: 110 * size, color: '#ffffff' }); fx.add({ type: 'star', x, y, life: 0.28, size: 46 * size, color: col });
  glow(fx, x, y, 160 * size, C.pink, 0.45, 0.7); rays(fx, x, y, 200 * size, C.silver, 16, 0.45, 7);
  fx.sparks(x, y, ang || 0, N(fx, 18 * size), '#ffffff', 560, Math.PI); fx.ring(x, y, 120 * size, '#ffffff', 0.4, 10); petals(fx, x, y, 14 * size, 50, 320);
}

function samHit(fx, ev, me) {
  const n = ev.n || 0, R = ev.r || 120, emp = ev.emp ? 1.25 : 1, L = ev.len || 200, ang = ev.ang || 0;
  const endX = ev.x + Math.cos(ang) * L, endY = ev.y + Math.sin(ang) * L;
  switch (ev.fx) {
    case 'iaido': case 'wind': case 'wind2': { // quick-draw line cut: one brush stroke through everything, silver afterimages
      const w = (ev.lw || 70) * 0.55 * emp;
      ink(fx, ev.x, ev.y, ang, L + 30, w, ev.fx === 'iaido' ? C.pink : C.moon, C.hi, 0.46, { speed: 9 });
      if (!lite(fx)) ink(fx, ev.x + Math.cos(ang + 1.57) * 10, ev.y + Math.sin(ang + 1.57) * 10, ang, L * 0.8, w * 0.35, C.silver, '#fff', 0.3, { speed: 10 });
      for (let i = 1; i <= 3; i++) ghost(fx, ev.x + Math.cos(ang) * L * i / 4, ev.y + Math.sin(ang) * L * i / 4, ang, 0.12 + i * 0.08, 0.2 + i * 0.05);
      for (let d = 30; d < L; d += 60) petals(fx, ev.x + Math.cos(ang) * d, ev.y + Math.sin(ang) * d, 1, 20, 90);
      if (n) cutHit(fx, endX - Math.cos(ang) * L * 0.3, endY - Math.sin(ang) * L * 0.3, ang, 0.9);
      fx.shake(n ? 0.16 : 0.08); if (n && me) fx.punch(ang, 4); return true;
    }
    case 'kesa': { // Kesa Slash: a diagonal shoulder-to-hip ink slash, a crimson-pink cut line hangs in the air
      const arc = Math.min(ev.arc || 2, TAU), d = ang + 0.5;
      inkArc(fx, ev.x, ev.y, ang, arc, R * 0.95, 26 * emp, C.pink, C.hi, 0.42, -1, { speed: 7 });
      const x1 = ev.x + Math.cos(d - 1.2) * R, y1 = ev.y + Math.sin(d - 1.2) * R, x2 = ev.x + Math.cos(d + 0.6) * R * 0.4, y2 = ev.y + Math.sin(d + 0.6) * R * 0.4, la = Math.atan2(y2 - y1, x2 - x1);
      ink(fx, x1, y1, la, Math.hypot(x2 - x1, y2 - y1) + 60, 18 * emp, C.hi, '#fff', 0.5, { speed: 10 });
      const [ix, iy] = at(ev, R * 0.6); glow(fx, ix, iy, 120, C.pink, 0.3, 0.6); petals(fx, ix, iy, 8, 60, 220);
      if (n) cutHit(fx, ix, iy, la, 1); fx.shake(n ? 0.18 : 0.08); if (n && me) fx.punch(la, 5); return true;
    }
    case 'crescent': case 'drawcut': case 'mooncrescent': { // wide ink crescents (parry whiff / Blossom draw / Moonlit Guard whiff)
      const moon = ev.fx === 'mooncrescent', col = moon ? C.moon : C.pink, arc = Math.min(ev.arc || 2.4, TAU);
      inkArc(fx, ev.x, ev.y, ang, arc, R * 0.9, 22 * emp, col, C.hi, 0.4, 1, { speed: 6 });
      if (!lite(fx)) inkArc(fx, ev.x, ev.y, ang, arc * 0.8, R * 0.62, 10, C.silver, '#fff', 0.34, -1, { speed: 7 });
      const [ix, iy] = at(ev, R * 0.7); glow(fx, ix, iy, 110, col, 0.28, 0.55); petals(fx, ix, iy, 5, 50, 180);
      if (moon) { rays(fx, ix, iy, 140, C.moon, 10, 0.32, 5); fx.ring(ev.x, ev.y, R, C.moon, 0.3, 6); }
      if (n) fx.sparks(ix, iy, ang, N(fx, 10), C.hi, 420); fx.shake(0.14 + (n ? 0.06 : 0)); return true;
    }
    case 'counter': case 'mooncounter': { // the counter-slash after a perfect parry: a guaranteed crit crescent
      const moon = ev.fx === 'mooncounter', col = moon ? C.moon : C.pink;
      inkArc(fx, ev.x, ev.y, ang, ev.arc || 2.4, R, 30, col, '#ffffff', 0.45, 1, { speed: 8 });
      inkArc(fx, ev.x, ev.y, ang, (ev.arc || 2.4) * 0.8, R * 0.7, 16, C.silver, '#ffffff', 0.4, -1, { speed: 8 });
      const [ix, iy] = at(ev, R * 0.7); impactBig(fx, ix, iy, ang, col, moon ? 1.1 : 0.8);
      if (me) fx.punch(ang, 8); fx.shake(0.35); return true;
    }
    case 'click': { // the sheathe: the blade clicks home - a silver ring, a thin white horizon line
      fx.ring(ev.x, ev.y, ev.emp ? 90 : 60, C.silver, 0.25, 4); fx.add({ type: 'flash', x: ev.x, y: ev.y - 14, life: 0.1, size: 40, color: '#ffffff' });
      ink(fx, ev.x - 46, ev.y - 12, 0, 92, 5, C.silver, '#fff', 0.3, { speed: 12 });
      fx.text(ev.x + 30, ev.y - 60, 'click', { size: 14, color: C.silver, life: 0.6, vy: -20, pop: 1.2 }); return true;
    }
    case 'ring': case 'petalring': case 'voidend': { // the sheathe shockwave: a brush circle + a ring of petals
      const rr = ev.fx === 'voidend' ? 220 : R;
      inkArc(fx, ev.x, ev.y, rnd(0, TAU), TAU * 0.92, rr * 0.9, ev.fx === 'petalring' ? 18 : 12, ev.fx === 'voidend' ? C.moon : C.pink, C.hi, 0.42, 1, { speed: 5 });
      fx.ring(ev.x, ev.y, rr, C.petal, 0.35, 6); petals(fx, ev.x, ev.y, ev.fx === 'petalring' ? 22 : 10, rr * 0.8, 240);
      glow(fx, ev.x, ev.y, rr, C.pink, 0.3, 0.4); fx.shake(ev.fx === 'voidend' ? 0.4 : 0.14);
      if (ev.fx === 'voidend') { rays(fx, ev.x, ev.y, 260, C.silver, 18, 0.5, 7); fx.text(ev.x, ev.y - 110, 'VOID SHEATHE', { size: 26, color: C.silver, pop: 2, life: 1.1 }); }
      return true;
    }
    case 'wave': case 'wavebig': { // Riposte Wave: a crescent of moonlight rolling down a line
      const big = ev.fx === 'wavebig' ? 1.35 : 1;
      for (let i = 0; i < 4; i++) { const d = L * (0.2 + i * 0.22); inkArc(fx, ev.x + Math.cos(ang) * (d - 40), ev.y + Math.sin(ang) * (d - 40), ang, 1.7, 46 * big + i * 6, 14 * big, i % 2 ? C.moon : C.pink, C.hi, 0.3 + i * 0.07, 1, { speed: 7 }); }
      ink(fx, ev.x, ev.y, ang, L, 18 * big, C.silver, '#fff', 0.36, { speed: 6 });
      glow(fx, endX, endY, 120 * big, C.moon, 0.3, 0.5); petals(fx, endX, endY, 8, 60, 220);
      if (big > 1) { fx.text(ev.x, ev.y - 90, 'RIPOSTE!', { size: 26, color: C.moon, pop: 2, life: 0.9 }); rays(fx, endX, endY, 160, C.moon, 12, 0.35, 6); }
      fx.shake(0.2 * big); if (me) fx.punch(ang, 5); return true;
    }
    case 'petal': { // Petal Rain: one dash-cut of the 8-hit flurry
      const fx0 = ev.fx0 ?? ev.x, fy0 = ev.fy0 ?? ev.y, a2 = Math.atan2(ev.y - fy0, ev.x - fx0), d = Math.hypot(ev.x - fx0, ev.y - fy0);
      ink(fx, fx0, fy0, a2, d + 20, 16, (ev.i || 0) % 2 ? C.pink : C.moon, C.hi, 0.34, { speed: 10 });
      ghost(fx, fx0, fy0, a2, 0.3, 0.25); petals(fx, ev.x, ev.y, 4, 30, 180);
      if (n) cutHit(fx, ev.x, ev.y, a2, 0.7); fx.shake(0.06); return true;
    }
    case 'freeze': { // Moment of Death begins: time stops
      fx.cine.push({ kind: 'samfreeze', t: 0, life: 1.2, x: ev.x, y: ev.y, r: ev.r || 700, pid: ev.pid });
      fx.ring(ev.x, ev.y, 260, '#ffffff', 0.5, 5); for (let i = 0; i < N(fx, 16); i++) fx.add({ type: 'petal', frozen: true, x: ev.x + rnd(-300, 300), y: ev.y + rnd(-200, 200), vx: 0, vy: 0, drag: 1, life: 1.1, size: rnd(4, 7), color: i % 3 ? C.petal : C.hi, rot: rnd(0, TAU), vr: 0, seed: rnd(0, 9) });
      fx.text(ev.x, ev.y - 100, '— stillness —', { size: 22, color: '#ffffff', pop: 1.4, life: 1, vy: -10 });
      if (me) fx.slowmo(0.3, 0.2); return true;
    }
    case 'deathline': ink(fx, ev.x, ev.y, ang, L + 40, 26, '#ffffff', '#ffffff', 0.5, { speed: 14 }); ghost(fx, ev.x, ev.y, ang, 0.5, 0.4); fx.shake(0.3); return true;
    case 'moonA': case 'moonB': { // Twin Moons: two crescent draws, the second a guaranteed crit
      const b = ev.fx === 'moonB';
      inkArc(fx, ev.x, ev.y, ang, ev.arc || 1.7, R, b ? 28 : 20, b ? C.pink : C.moon, C.hi, 0.4, b ? -1 : 1, { speed: 8 });
      const [ix, iy] = at(ev, R * 0.75); glow(fx, ix, iy, b ? 150 : 100, b ? C.pink : C.moon, 0.3, 0.6);
      if (b) { rays(fx, ix, iy, 150, C.hi, 12, 0.35, 6); fx.text(ix, iy - 70, '☾☽', { size: 30, color: C.hi, pop: 2, life: 0.8 }); }
      if (n) cutHit(fx, ix, iy, ang, b ? 1.1 : 0.8, b ? C.pink : C.moon); fx.shake(b ? 0.3 : 0.14); if (me && b) fx.punch(ang, 7); return true;
    }
    case 'void': { // the ult-opening void cut
      ink(fx, ev.x, ev.y, ang, L + 40, 46, '#6c5cff', '#ffffff', 0.55, { speed: 9 }); ink(fx, ev.x, ev.y, ang, L, 18, C.silver, '#fff', 0.45, { speed: 11 });
      glow(fx, endX, endY, 200, '#8f7cff', 0.4, 0.6); petals(fx, endX, endY, 20, 120, 300); fx.shake(0.4); if (me) fx.punch(ang, 8); return true;
    }
    case 'storm': { // Thousand Petal Storm: cuts appear all over the screen and HANG until the sheathe click
      inkArc(fx, ev.x, ev.y, ang, 1.2, 26 + ((ev.i || 0) % 5) * 5, 10, (ev.i || 0) % 3 ? C.pink : C.hi, '#ffffff', 3, (ev.i || 0) % 2 ? 1 : -1, { speed: 14, hang: true, pid: ev.pid });
      if ((ev.i || 0) % 2 === 0) petals(fx, ev.x, ev.y, 2, 30, 100); if (n) fx.sparks(ev.x, ev.y, ang, N(fx, 3), '#fff', 300);
      if ((ev.i || 0) % 6 === 0) fx.shake(0.05); return true;
    }
    case 'stormpose': ghost(fx, ev.x, ev.y, ang, 0.6, 0.6); fx.ring(ev.x, ev.y, 60, C.silver, 0.5, 4); fx.text(ev.x, ev.y - 80, '…', { size: 34, color: '#ffffff', life: 0.8, vy: -10 }); return true;
    case 'stormclick': fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.2, size: 200, color: '#ffffff' }); ink(fx, ev.x - 80, ev.y - 14, 0, 160, 7, C.silver, '#fff', 0.4, { speed: 12 }); fx.text(ev.x + 40, ev.y - 70, 'click.', { size: 24, color: '#ffffff', life: 1, vy: -16 }); return true;
    case 'whiteline': fx.cine.push({ kind: 'samline', t: 0, life: 1.05, x: ev.x + Math.cos(ang) * L * 0.5, y: ev.y + Math.sin(ang) * L * 0.5, ang, pid: ev.pid }); if (me) fx.slowmo(0.4, 0.3); return true;
    case 'splitline': ink(fx, ev.x, ev.y, ang, L, 30, '#ffffff', '#ffffff', 0.6, { speed: 10 }); return true;
    default: inkArc(fx, ev.x, ev.y, ang, ev.arc || 2, R, 18, C.pink, C.hi, 0.35); return true;
  }
}

/** Sounds for 'sam' / 'samx' (au = the Audio object: play / tone / hiss). */
export function samSound(au, ev, me) {
  if (!au.ctx || au.muted) return;
  if (ev.type === 'sam') switch (ev.ph) {
    case 'cast': au.hiss(6200, 2400, 0.05, 0.12, 1.2); if (ev.id === 'void_blade') { au.play('roar'); au.tone('sine', 220, 110, 0.9, 0.16); } return;
    case 'fin': au.tone('sine', 880, 440, 1.2, 0.12); au.play('chain'); return;
    case 'hit':
      if (ev.fx === 'click' || ev.fx === 'stormclick') { au.tone('square', 1800, 1400, 0.04, 0.08); au.tone('triangle', 900, 900, 0.06, 0.06, 0.03); return; }
      if (ev.fx === 'storm') { if ((ev.i || 0) % 3 === 0) au.hiss(7000, 3000, 0.03, 0.06, 1.6); return; }
      if (ev.fx === 'whiteline') { au.tone('sine', 1760, 1760, 0.8, 0.07); return; }
      if (ev.fx === 'freeze') { au.tone('sine', 1320, 660, 0.6, 0.1); return; }
      au.hiss(7200, 1800, 0.05, 0.16, 1.4); if (ev.n) au.play('heavy'); return;
  }
  if (ev.type === 'samx') switch (ev.ph) {
    case 'parry': au.tone('square', 2400, 1800, 0.06, 0.12); au.tone('triangle', 1200, 1600, 0.2, 0.1, 0.02); au.play('crit'); return;
    case 'burst': au.play('crit'); return;
    case 'death': case 'split': case 'stormburst': au.play('detonate'); au.tone('sine', 110, 55, 0.8, 0.2); return;
    case 'focus': if (me && ev.why === 'parry') au.tone('triangle', 988, 1480, 0.12, 0.08); return;
  }
}
