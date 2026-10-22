// Special-skill effects + sounds + icons (the 4th skill slot: Warlord's Decree, Shadow Clone Jutsu, Storm of Arrows,
// Grand Meteor, Divine Hammer, Iaijutsu: Void Draw, Dragon's Descent) and the looks of the 28 Special chains.
// Driven by 'spx' events from the server / solo sim (ph: cast, impact, hit, chain, echo, cloneCopy, clonesEnd, pop,
// decreeSwing). Adds particle types ('spline', 'spcross') drawn by SPEC_PARTS and cinematics merged into the FX core's CINE.
import { CLASSES } from '../sim/data/classes.js';
const TAU = Math.PI * 2;
export const SPEC_PAL = {
  warrior: { a: '#ff5e3b', b: '#ffd27a', hi: '#fff4d6', w: { G: '#5ec8ff', A: '#ff4d5e', H: '#ffb52e' } },
  ranger: { a: '#7af0ff', b: '#b8ff7a', hi: '#f4fff0' },
  mage: { a: '#ff7a2c', b: '#ffd23f', hi: '#fff1c8', ice: '#9fe8ff' },
  cleric: { a: '#ffd23f', b: '#fff0a0', hi: '#ffffff' },
  bladedancer: { a: '#b28cff', b: '#ff8ad8', hi: '#f5ecff', dark: '#1a0f2e' },
  samurai: { a: '#dfe8ff', b: '#ffb3d9', hi: '#ffffff', dark: '#07060c' },
  monk: { a: '#ffd23f', b: '#ff8a1e', hi: '#fffaf0' },
  dragoon: { a: '#ff3048', b: '#9a6bff', hi: '#fff1e0' },
  summoner: { a: '#3ff0c8', b: '#ffb347', hi: '#f0fff8', ice: '#9fe8ff' },
  bard: { a: '#ff7ab8', b: '#ffd86a', hi: '#fff6e8' },
};
const PAL = (cls) => SPEC_PAL[cls] || SPEC_PAL.warrior;
const rnd = (a, b) => a + Math.random() * (b - a);
const lite = (fx) => fx.partMul !== undefined && fx.partMul < 1;
const N = (fx, n) => Math.max(1, Math.round(n * (fx.partMul ?? 1)));
const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
/** Chains v2: the Special 5-steps (id -> chain), for the finale banner. */
const FIVE_STEP = new Map(Object.values(CLASSES).flatMap((c) => (c.chains || []).filter((ch) => ch.sp && ch.seq.length === 5).map((ch) => [ch.id, ch])));
const spName = (cls) => (CLASSES[cls] && CLASSES[cls].skills.SP ? CLASSES[cls].skills.SP.name : 'Special');

// ---- building blocks
function glow(fx, x, y, size, col, life = 0.3, a = 0.8) { if (!lite(fx)) fx.add({ type: 'glow', x, y, size, color: col, life, a }); }
function rays(fx, x, y, r, col, n = 12, life = 0.35, w = 5) { fx.add({ type: 'rays', x, y, r, color: col, n: Math.max(6, N(fx, n)), life, w, seed: rnd(0, TAU) }); }
function flash(fx, me, col, amt) { if (me) { fx.flash = Math.max(fx.flash || 0, amt); fx.flashColor = col; } }
function line(fx, x, y, ang, len, w, col, core, life = 0.35) { fx.add({ type: 'spline', x, y, ang, len, w, color: col, core: core || '#ffffff', life, lite: lite(fx) }); }
function cross(fx, x, y, r, col, life = 0.3, ang = rnd(0, TAU)) { fx.add({ type: 'spcross', x, y, r, color: col, life, ang, lite: lite(fx) }); }
function slashRing(fx, x, y, r, col, n = 2, life = 0.34, width = 14) { for (let i = 0; i < n; i++) fx.add({ type: 'slash', x, y, ang: rnd(0, TAU), arc: 3.6, r: r * (0.8 + i * 0.12), life: life + i * 0.05, color: col, width, dir: i % 2 ? -1 : 1 }); }
function boom(fx, x, y, r, P, big = 1) {
  fx.add({ type: 'flash', x, y, life: 0.12, size: r * 0.9 * big, color: P.hi });
  glow(fx, x, y, r * 1.6 * big, P.a, 0.4, 0.7);
  fx.ring(x, y, r * big, P.a, 0.4, 8); fx.ring(x, y, r * 0.7 * big, P.hi, 0.3, 4);
  rays(fx, x, y, r * 1.1 * big, P.b, 14, 0.4, 6);
  fx.sparks(x, y, rnd(0, TAU), N(fx, 12 * big), P.b, 520, 3.2);
}
function pillar(fx, x, y, size, col, life = 0.5, h = 520) { fx.add({ type: 'pillar', x, y, size, color: col, life, h, lite: lite(fx) }); }

// ---- particle painters (type 'spline' / 'spcross')
export const SPEC_PARTS = {
  spline(ctx, p, k, inv) { // a glowing cut / beam: soft wide body + bright core, grows out fast, thins as it fades
    const grow = ease(k * 5), L = p.len * grow, x1 = p.x + Math.cos(p.ang) * L, y1 = p.y + Math.sin(p.ang) * L;
    ctx.save(); ctx.lineCap = 'round'; if (!p.lite) ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45 * inv; ctx.strokeStyle = p.color; ctx.lineWidth = p.w * (0.6 + inv * 0.6); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.globalAlpha = 0.95 * inv; ctx.lineWidth = Math.max(2, p.w * 0.28 * inv); ctx.strokeStyle = p.core; ctx.stroke();
    ctx.restore();
  },
  spcross(ctx, p, k, inv) { // an X of two fast slashes
    const g = ease(k * 4), r = p.r * g;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang); ctx.lineCap = 'round'; if (!p.lite) ctx.globalCompositeOperation = 'lighter';
    for (const s of [1, -1]) { ctx.globalAlpha = inv; ctx.strokeStyle = p.color; ctx.lineWidth = 12 * inv + 2; ctx.beginPath(); ctx.moveTo(-r, -r * 0.35 * s); ctx.lineTo(r, r * 0.35 * s); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * inv + 1; ctx.stroke(); ctx.rotate(1.2); }
    ctx.restore();
  },
};

// ---- the weapons / hammer / dragon painters
function drawBlade(ctx, x, y, col, kind, a = 1) { // a planted weapon: greatsword / axe / hammer head up
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a; ctx.lineCap = 'round';
  ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -46); ctx.stroke();
  ctx.strokeStyle = kind === 'G' ? '#e9eef5' : '#8a6a4a'; ctx.lineWidth = kind === 'G' ? 5 : 4; ctx.stroke();
  ctx.fillStyle = col; ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 2.5;
  if (kind === 'G') { ctx.fillRect(-11, -18, 22, 5); ctx.strokeRect(-11, -18, 22, 5); }
  else if (kind === 'A') { ctx.beginPath(); ctx.moveTo(0, -44); ctx.quadraticCurveTo(18, -40, 16, -26); ctx.lineTo(0, -32); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else { ctx.fillRect(-13, -52, 26, 15); ctx.strokeRect(-13, -52, 26, 15); }
  ctx.restore();
}
function drawHammer(ctx, x, y, s, a, P) { // the Divine Hammer: a giant glowing warhammer, head down
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0, -10, 4, 0, -10, 90); g.addColorStop(0, 'rgba(255,240,160,.7)'); g.addColorStop(1, 'rgba(255,210,63,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -10, 90, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#8a6a3a'; ctx.strokeStyle = '#2a1a08'; ctx.lineWidth = 4; ctx.fillRect(-6, -150, 12, 130); ctx.strokeRect(-6, -150, 12, 130);
  ctx.fillStyle = '#ffe27a'; ctx.fillRect(-46, -34, 92, 40); ctx.strokeRect(-46, -34, 92, 40);
  ctx.fillStyle = '#fff6c8'; ctx.fillRect(-40, -28, 80, 8);
  ctx.strokeStyle = P.hi; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, -14); ctx.lineTo(10, -14); ctx.moveTo(0, -24); ctx.lineTo(0, -2); ctx.stroke(); // holy cross
  ctx.restore();
}
function drawDragon(ctx, pts, t, a, P, thick = 1) { // a golden chi dragon: a tapering segmented body with a head at pts[last]
  if (pts.length < 2) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [w, col, al] of [[34 * thick, P.b, 0.35], [20 * thick, P.a, 0.7], [7 * thick, P.hi, 0.9]]) {
    ctx.globalAlpha = a * al; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (const q of pts) ctx.lineTo(q.x, q.y); ctx.stroke();
  }
  ctx.globalAlpha = a * 0.8; for (let i = 2; i < pts.length - 1; i += 3) { const q = pts[i], n = pts[i + 1], an = Math.atan2(n.y - q.y, n.x - q.x) + Math.PI / 2; ctx.strokeStyle = P.hi; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(q.x + Math.cos(an) * 16 * thick, q.y + Math.sin(an) * 16 * thick); ctx.lineTo(q.x + Math.cos(an) * 26 * thick, q.y + Math.sin(an) * 26 * thick); ctx.stroke(); } // fins
  const h = pts[pts.length - 1], p2 = pts[pts.length - 2], ha = Math.atan2(h.y - p2.y, h.x - p2.x);
  ctx.translate(h.x, h.y); ctx.rotate(ha); ctx.globalAlpha = a;
  ctx.fillStyle = P.a; ctx.beginPath(); ctx.moveTo(34 * thick, 0); ctx.lineTo(-6, -20 * thick); ctx.lineTo(-14, 0); ctx.lineTo(-6, 20 * thick); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = P.hi; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-4, -18 * thick); ctx.lineTo(-26, -34 * thick); ctx.moveTo(-4, 18 * thick); ctx.lineTo(-26, 34 * thick); ctx.stroke(); // horns
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(8, -7 * thick, 3.5, 0, TAU); ctx.arc(8, 7 * thick, 3.5, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- cinematics (fx.cine entries; drawn in world space)
export const SPEC_CINE = {
  spDecree(fx, ctx, c, time) { // three planted weapons + a crimson war banner aura that pulses while the Decree lasts
    const P = PAL('warrior'), fade = Math.min(1, (c.life - c.t) / 0.4, c.t / 0.15);
    const pl = fx.sim && fx.sim.players && fx.sim.players.get(c.pid);
    ctx.save(); ctx.globalAlpha = 0.5 * fade; ctx.setLineDash([18, 12]); ctx.lineDashOffset = -time * 40; ctx.strokeStyle = P.a; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y, 84, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    ['G', 'A', 'H'].forEach((w, i) => { const an = -Math.PI / 2 + i * TAU / 3 + 0.2; drawBlade(ctx, c.x + Math.cos(an) * 62, c.y + Math.sin(an) * 44 + 10, P.w[w], w, fade); });
    if (pl && !pl.dead) {
      const pulse = 0.6 + 0.4 * Math.sin(time * 10);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * fade * pulse;
      const g = ctx.createRadialGradient(pl.x, pl.y, 6, pl.x, pl.y, 70); g.addColorStop(0, 'rgba(255,120,60,.8)'); g.addColorStop(1, 'rgba(255,60,30,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pl.x, pl.y, 70, 0, TAU); ctx.fill();
      for (let i = 0; i < 3; i++) { const an = time * 3 + i * TAU / 3; ctx.globalAlpha = 0.9 * fade; ctx.fillStyle = P.w[['G', 'A', 'H'][i]]; ctx.beginPath(); ctx.arc(pl.x + Math.cos(an) * 40, pl.y + Math.sin(an) * 22 - 10, 6, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  },
  spClones(fx, ctx, c, time) { // two shadow clones flanking the ninja, mirroring its facing
    const pl = fx.sim && fx.sim.players && fx.sim.players.get(c.pid);
    if (!pl || pl.dead) return;
    const fade = Math.min(1, (c.life - c.t) / 0.3, c.t / 0.2), ang = pl.aim || 0, fl = c.fl > 0 ? 1 : 0;
    const O = pl.shd ? { x: pl.shd[0], y: pl.shd[1] } : pl; // (boss form: the clones flank the shadow doing the skill, not the hero standing back - 2026-10-20 fix)
    for (const s of [1, -1]) {
      const off = 46 + 6 * Math.sin(time * 3 + s), bx = O.x - Math.cos(ang) * 16 + -Math.sin(ang) * off * s, by = O.y - Math.sin(ang) * 16 + Math.cos(ang) * off * s;
      c.pos = c.pos || {}; c.pos[s] = { x: bx, y: by };
      ctx.save(); ctx.globalAlpha = 0.25 * fade; ctx.fillStyle = '#6a4aa0'; ctx.beginPath(); ctx.arc(bx, by + 4, 22 + 3 * Math.sin(time * 6 + s), 0, TAU); ctx.fill(); ctx.restore(); // smoke
      fx.shadowFigure(ctx, bx, by, ang, 0.85 * fade, fl);
    }
  },
  spHammer(fx, ctx, c, time) { // the Divine Hammer: a rune circle on the ground, the hammer dropping out of the sky, then embedded
    const P = PAL('cleric'), D = c.delay, k = Math.min(1, c.t / D), fade = Math.min(1, (c.life - c.t) / 0.35);
    ctx.save(); ctx.globalAlpha = 0.8 * fade; ctx.strokeStyle = P.a; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * ease(k * 1.6), 0, TAU); ctx.stroke();
    ctx.setLineDash([10, 14]); ctx.lineDashOffset = time * 30; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.7 * ease(k * 1.6), 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 8; i++) { const an = time * 0.7 + i * TAU / 8; ctx.fillStyle = P.hi; ctx.fillRect(c.x + Math.cos(an) * c.r * 0.85 - 3, c.y + Math.sin(an) * c.r * 0.85 - 8, 6, 16); }
    ctx.restore();
    const fall = c.t < D ? Math.pow(k, 2.2) : 1, hy = c.y - (1 - fall) * 620;
    drawHammer(ctx, c.x, hy, 1.25, fade * (c.t < D ? 0.4 + 0.6 * k : 1), P);
  },
  spRune(fx, ctx, c, time) { // Grand Meteor: a spinning fire rune + heat under the falling star; the crash is spawned once at the delay
    const P = PAL('mage'), D = c.delay, k = Math.min(1, c.t / D), fade = Math.min(1, (c.life - c.t) / 0.3);
    if (c.t < D) {
      ctx.save(); ctx.globalAlpha = (0.4 + 0.5 * k) * fade; ctx.translate(c.x, c.y); ctx.rotate(time * 1.2);
      ctx.strokeStyle = P.a; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, c.r, 0, TAU); ctx.stroke();
      ctx.beginPath(); for (let i = 0; i <= 6; i++) { const an = i * TAU * 2 / 6 * 1.0; const q = [Math.cos(an) * c.r * 0.9, Math.sin(an) * c.r * 0.9]; i ? ctx.lineTo(...q) : ctx.moveTo(...q); } ctx.strokeStyle = P.b; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0, 0, 4, 0, 0, c.r); g.addColorStop(0, `rgba(255,140,40,${0.45 * k})`); g.addColorStop(1, 'rgba(255,80,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, c.r, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (!c.boomed) {
      c.boomed = true;
      boom(fx, c.x, c.y, c.r, P, 1.5); pillar(fx, c.x, c.y, c.r * 1.2, P.a, 0.6, 700); fx.chunks(c.x, c.y, N(fx, 30), '#6b4a3a', 520);
      fx.shake(c.me ? 1 : 0.3); flash(fx, c.me, '#ffb070', 0.5); fx.text(c.x, c.y + c.r * 0.6, 'GRAND METEOR!', { size: 30, color: P.b, life: 1.1, vy: -30, pop: 2.2 });
    }
  },
  spStorm(fx, ctx, c, time) { // Storm of Arrows: a dark storm cloud over the circle with lightning flickers
    const P = PAL('ranger'), fade = Math.min(1, (c.life - c.t) / 0.4, c.t / 0.2);
    ctx.save(); ctx.globalAlpha = 0.55 * fade;
    for (let i = 0; i < 9; i++) { const an = i * 0.7 + time * 0.3, rr = c.r * (0.3 + (i % 3) * 0.3); ctx.fillStyle = i % 2 ? '#2d3a48' : '#3c4a5c'; ctx.beginPath(); ctx.arc(c.x + Math.cos(an) * rr, c.y - 150 + Math.sin(an) * rr * 0.35, 46 + (i % 3) * 10, 0, TAU); ctx.fill(); }
    if (Math.sin(time * 23 + c.x) > 0.93) { ctx.globalAlpha = 0.9 * fade; ctx.strokeStyle = P.a; ctx.lineWidth = 3; ctx.beginPath(); let x = c.x + rnd(-c.r, c.r) * 0.6, y = c.y - 150; ctx.moveTo(x, y); for (let j = 0; j < 5; j++) { x += rnd(-18, 18); y += 30; ctx.lineTo(x, y); } ctx.stroke(); }
    ctx.restore();
  },
  spVoid(fx, ctx, c, time) { // Void Draw: during the charge the world dims and ink streams into the blade; a preview line shows the cut
    const P = PAL('samurai'), pl = fx.sim && fx.sim.players && fx.sim.players.get(c.pid);
    const x = pl ? pl.x : c.x, y = pl ? pl.y : c.y, ang = pl && c.me ? pl.aim : c.ang, k = Math.min(1, c.t / c.life);
    const v = fx.view;
    if (v) { ctx.save(); ctx.globalAlpha = 0.35 * k; ctx.fillStyle = P.dark; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0); ctx.restore(); }
    ctx.save(); ctx.globalAlpha = 0.25 + 0.5 * k; ctx.setLineDash([22, 14]); ctx.lineDashOffset = -time * 80; ctx.strokeStyle = P.hi; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * c.len, y + Math.sin(ang) * c.len); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 10; i++) { const an = i * TAU / 10 + time * 2, d = 90 * (1 - ((time * 1.8 + i * 0.1) % 1)); ctx.fillStyle = i % 2 ? P.hi : P.b; ctx.beginPath(); ctx.arc(x + Math.cos(an) * d, y + Math.sin(an) * d, 3, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 * k; ctx.fillStyle = P.hi; ctx.beginPath(); ctx.arc(x + Math.cos(ang) * 18, y + Math.sin(ang) * 18, 6 + 8 * k, 0, TAU); ctx.fill();
    ctx.restore();
  },
  spVoidCut(fx, ctx, c, time) { // the cut itself: a white line with black void edges across the screen, then a lingering crack
    const P = PAL('samurai'), k = c.t / c.life, open = ease(c.t / 0.08), inv = 1 - k;
    const x1 = c.x + Math.cos(c.ang) * c.len * open, y1 = c.y + Math.sin(c.ang) * c.len * open;
    ctx.save(); ctx.lineCap = 'round';
    ctx.globalAlpha = 0.85 * inv; ctx.strokeStyle = P.dark; ctx.lineWidth = c.w * (0.4 + 0.6 * inv); ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = inv; ctx.strokeStyle = P.b; ctx.lineWidth = c.w * 0.35 * inv + 2; ctx.stroke();
    ctx.strokeStyle = P.hi; ctx.lineWidth = 5 * inv + 1.5; ctx.stroke();
    ctx.restore();
  },
  spDragon(fx, ctx, c, time) { // Dragon's Descent: a chi dragon rides the leap arc, head on the monk, then coils at the crash
    const P = PAL('monk'), pl = fx.sim && fx.sim.players && fx.sim.players.get(c.pid);
    const T = c.T, k = Math.min(1, c.t / T), fade = Math.min(1, (c.life - c.t) / 0.35);
    const pts = [];
    if (k < 1) {
      const hx = pl ? pl.x : c.x + (c.tx - c.x) * k, hy = pl ? pl.y : c.y + (c.ty - c.y) * k;
      for (let i = 0; i <= 18; i++) { const u = i / 18 * k, bx = c.x + (c.tx - c.x) * u, by = c.y + (c.ty - c.y) * u - Math.sin(u * Math.PI) * 180; const w = Math.sin(i * 0.9 - time * 14) * 18; const an = Math.atan2(c.ty - c.y, c.tx - c.x) + Math.PI / 2; pts.push({ x: bx + Math.cos(an) * w, y: by + Math.sin(an) * w }); }
      pts.push({ x: hx, y: hy - Math.sin(k * Math.PI) * 60 });
      drawDragon(ctx, pts, time, fade, P, 1.2);
    } else {
      const u = Math.min(1, (c.t - T) / 0.5);
      for (let i = 0; i <= 26; i++) { const an = i / 26 * TAU * 1.1 + time * 5, rr = c.r * (0.55 + 0.3 * u) * (0.6 + 0.4 * i / 26); pts.push({ x: c.tx + Math.cos(an) * rr, y: c.ty + Math.sin(an) * rr * 0.6 - 20 }); }
      drawDragon(ctx, pts, time, fade * (1 - u * 0.6), P, 1);
    }
  },
};

// ---- chain looks
function chainLook(fx, ev, P, me) {
  const { x, y } = ev, r = ev.r || 120, ang = ev.ang || 0, L = ev.look;
  switch (L) {
    case 'spin': slashRing(fx, x, y, r, P.a, 2, 0.3, 16); fx.ring(x, y, r, P.b, 0.3, 6); break;
    case 'slash': cross(fx, x, y, Math.min(90, r), P.a, 0.25); fx.sparks(x, y, ang, N(fx, 5), P.b, 420, 1.4); break;
    case 'slam': case 'pillar': case 'holy':
      pillar(fx, x, y, r * (L === 'holy' ? 0.9 : 0.7), P.a, 0.5); fx.ring(x, y, r, P.b, 0.4, 7); rays(fx, x, y, r * 1.1, P.hi, 12, 0.35, 5);
      if (L !== 'holy') fx.chunks(x, y, N(fx, 10), '#8a7a6a', 320);
      break;
    case 'burst': case 'meteor': boom(fx, x, y, r, P, L === 'meteor' ? 1.2 : 0.8); if (L === 'meteor') pillar(fx, x, y, r, P.a, 0.5, 620); break;
    case 'nova': fx.ring(x, y, r, P.ice || P.a, 0.45, 10); fx.ring(x, y, r * 0.75, P.a, 0.4, 6); for (let i = 0; i < N(fx, 14); i++) { const a = rnd(0, TAU); fx.add({ type: 'shard', x, y, ang: a, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, size: 10, color: '#e8fbff', edge: P.ice || P.a, life: 0.4, drag: 0.88 }); } glow(fx, x, y, r * 1.4, P.a, 0.4, 0.6); break;
    case 'rain': for (let i = 0; i < N(fx, 7); i++) { const a = rnd(0, TAU), d = Math.sqrt(Math.random()) * r; fx.add({ type: 'arrowfall', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, size: 10, color: P.a, life: 0.3, h: 360 }); } fx.ring(x, y, r, P.b, 0.25, 4); break;
    case 'beam': case 'charge': line(fx, x, y, ang, ev.len || 400, ev.w || 50, P.a, P.hi, L === 'beam' ? 0.4 : 0.3); glow(fx, x + Math.cos(ang) * (ev.len || 400), y + Math.sin(ang) * (ev.len || 400), 120, P.b, 0.3, 0.6); break;
    case 'void': line(fx, x, y, ang, ev.len || 400, ev.w || 60, P.b, P.hi, 0.45); fx.cine.push({ kind: 'spVoidCut', t: 0, life: 0.5, x, y, ang, len: ev.len || 400, w: (ev.w || 60) * 0.7 }); break;
    case 'crescent': fx.add({ type: 'slash', x, y, ang, arc: ev.arc || 2.6, r: r * 0.9, life: 0.32, color: P.b, width: 20, dir: ev.i % 2 ? -1 : 1 }); fx.add({ type: 'slash', x, y, ang, arc: (ev.arc || 2.6) * 0.9, r: r * 0.7, life: 0.28, color: P.hi, width: 8, dir: ev.i % 2 ? -1 : 1 }); break;
    case 'lotus': for (let i = 0; i < 3; i++) fx.add({ type: 'slash', x, y, ang: (ev.i || 0) * 0.8 + i * TAU / 3, arc: 1.4, r: r * (0.6 + 0.3 * Math.random()), life: 0.28, color: i % 2 ? P.b : P.a, width: 12, dir: 1 }); if (!ev.i) fx.puffs(x, y, N(fx, 10), 'rgba(80,50,120,.7)', 26, 160, 0.6); break;
    case 'thrust': case 'x': case 'kick': case 'palm':
      cross(fx, x, y, r * 0.9, P.a, 0.3, ang); fx.add({ type: 'flash', x, y, life: 0.1, size: r * 0.9, color: P.hi }); rays(fx, x, y, r * 1.3, P.b, 12, 0.3, 5);
      if (L === 'palm' || L === 'kick') { pillar(fx, x, y, r * 0.8, P.a, 0.45); fx.ring(x, y, r * 1.6, P.hi, 0.4, 6); }
      break;
    case 'fists': for (let i = 0; i < 2; i++) { const a = ang + rnd(-(ev.arc || 1.6) / 2, (ev.arc || 1.6) / 2); line(fx, x, y, a, r, 18, P.a, P.hi, 0.18); } fx.add({ type: 'flash', x: x + Math.cos(ang) * r * 0.7, y: y + Math.sin(ang) * r * 0.7, life: 0.08, size: 40, color: P.hi }); break;
    case 'finale': { // chains v2: the 5-step FINALE - a class-colored multi-ring burst, a pillar, shards, a big shake
      boom(fx, x, y, r, P, 1.3); pillar(fx, x, y, r * 0.9, P.a, 0.6, 760); pillar(fx, x, y, r * 0.45, P.hi, 0.45, 900);
      for (let i = 0; i < 3; i++) fx.ring(x, y, r * (0.6 + i * 0.35), i % 2 ? P.b : P.a, 0.35 + i * 0.12, 10 - i * 2);
      rays(fx, x, y, r * 1.6, P.hi, 20, 0.55, 8);
      for (let i = 0; i < N(fx, 16); i++) { const a = rnd(0, TAU), v = rnd(380, 680); fx.add({ type: 'shard', x, y, ang: a, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: rnd(8, 13), color: i % 2 ? P.a : P.b, edge: P.hi, drag: 0.9, life: rnd(0.4, 0.7) }); }
      fx.add({ type: 'flash', x, y, life: 0.16, size: r * 1.8, color: P.hi });
      fx.shake(me ? 0.85 : 0.3); flash(fx, me, P.a, 0.35);
      if (me) fx.text(x, y - r * 0.6 - 20, 'FINALE!', { size: 30, color: P.hi, life: 1.1, vy: -30, pop: 2 });
      break;
    }
    default: boom(fx, x, y, r, P, 0.6);
  }
  if (ev.last && ev.n && me) fx.shake(0.25);
}

/** Effects for 'spx' events. */
export function specFx(fx, ev, me, sim) {
  const P = PAL(ev.cls), name = spName(ev.cls);
  switch (ev.ph) {
    case 'cast':
      if (me) fx.text(ev.x, ev.y - 70, name.toUpperCase(), { size: 24, color: P.b, life: 1.1, vy: -40, pop: 2 });
      if (ev.id === 'warlords_decree') { fx.ring(ev.x, ev.y, ev.r, P.a, 0.25, 6); for (let i = 0; i < 3; i++) fx.add({ type: 'slash', x: ev.x, y: ev.y, ang: i * 2.1, arc: 2.2, r: ev.r * 0.8, life: 0.25, color: P.a, width: 10, dir: -1 }); }
      if (ev.id === 'storm_of_arrows') { fx.cine.push({ kind: 'spStorm', t: 0, life: (ev.dur + 10) / 60, x: ev.x, y: ev.y, r: ev.r }); for (let i = 0; i < N(fx, 10); i++) line(fx, ev.x + rnd(-40, 40), ev.y - 60, -Math.PI / 2 + rnd(-0.2, 0.2), 500, 6, P.a, P.hi, 0.35); }
      if (ev.id === 'grand_meteor') { fx.cine.push({ kind: 'spRune', t: 0, life: ev.delay / 60 + 0.3, delay: ev.delay / 60, x: ev.x, y: ev.y, r: ev.r, me }); if (me) fx.shake(0.15); }
      if (ev.id === 'divine_hammer') { fx.cine.push({ kind: 'spHammer', t: 0, life: ev.delay / 60 + 0.8, delay: ev.delay / 60, x: ev.x, y: ev.y, r: ev.r }); pillar(fx, ev.x, ev.y, 60, P.hi, 0.3, 700); }
      if (ev.id === 'shadow_clone') { fx.puffs(ev.x, ev.y, N(fx, 16), 'rgba(90,60,140,.8)', 30, 200, 0.7); }
      if (ev.id === 'void_draw') { fx.cine.push({ kind: 'spVoid', t: 0, life: ev.charge / 60, x: ev.x, y: ev.y, ang: ev.ang, len: ev.len, pid: ev.pid, me }); }
      if (ev.id === 'dragons_descent') { fx.cine.push({ kind: 'spDragon', t: 0, life: ev.T / 60 + 0.7, T: ev.T / 60, x: ev.x, y: ev.y, tx: ev.tx, ty: ev.ty, r: ev.r, pid: ev.pid }); fx.puffs(ev.x, ev.y, N(fx, 8), 'rgba(255,210,63,.6)', 20, 160, 0.4); }
      return;
    case 'impact':
      if (ev.id === 'warlords_decree') {
        boom(fx, ev.x, ev.y, ev.r * 0.8, P, 1); pillar(fx, ev.x, ev.y, 110, P.a, 0.55, 600); fx.chunks(ev.x, ev.y, N(fx, 18), '#7a5a3a', 420);
        fx.cine.push({ kind: 'spDecree', t: 0, life: ev.dur / 60, x: ev.x, y: ev.y, pid: ev.pid });
        if (me) { fx.shake(0.7); flash(fx, me, '#ff8a4a', 0.35); fx.text(ev.x, ev.y + 60, 'DECREE! ×3 WEAPONS', { size: 22, color: P.b, life: 1.2, vy: -20 }); }
      }
      if (ev.id === 'divine_hammer') {
        boom(fx, ev.x, ev.y, ev.r, P, 1.3); pillar(fx, ev.x, ev.y, ev.r * 1.1, P.a, 0.7, 800); fx.chunks(ev.x, ev.y, N(fx, 24), '#b0a080', 480);
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + rnd(-0.2, 0.2); line(fx, ev.x, ev.y, a, ev.r * 1.3, 10, P.b, P.hi, 0.5); }
        fx.shake(me ? 0.9 : 0.25); flash(fx, me, '#fff6c8', 0.45);
        fx.text(ev.x, ev.y + ev.r * 0.55, ev.sh > 1 ? `SHIELDED ×${ev.sh}` : 'SHIELDED', { size: 20, color: '#bfefff', life: 1.1, vy: -30 });
      }
      if (ev.id === 'shadow_clone') {
        slashRing(fx, ev.x, ev.y, ev.r, P.a, 3, 0.32, 12); fx.puffs(ev.x, ev.y, N(fx, 12), 'rgba(60,30,100,.8)', 30, 220, 0.8);
        fx.cine.push({ kind: 'spClones', t: 0, life: ev.dur / 60, pid: ev.pid });
        for (const s of [1, -1]) { const a = (ev.ang || 0) + (s * Math.PI) / 2; fx.add({ type: 'ghost', x: ev.x + Math.cos(a) * 46, y: ev.y + Math.sin(a) * 46, ang: ev.ang || 0, life: 0.5 }); }
        if (me) { fx.shake(0.3); fx.text(ev.x, ev.y + 50, 'KAGE BUNSHIN! ×3 CHAINS', { size: 20, color: P.b, life: 1.2, vy: -20 }); }
      }
      if (ev.id === 'void_draw') {
        const P2 = PAL('samurai');
        fx.cine.push({ kind: 'spVoidCut', t: 0, life: 0.75, x: ev.x, y: ev.y, ang: ev.ang, len: ev.len, w: ev.w });
        line(fx, ev.x, ev.y, ev.ang, ev.len, ev.w * 1.4, P2.b, P2.hi, 0.5);
        for (let i = 0; i < N(fx, 10); i++) { const d = rnd(0, ev.len); fx.add({ type: 'petal', x: ev.x + Math.cos(ev.ang) * d, y: ev.y + Math.sin(ev.ang) * d, vx: rnd(-80, 80), vy: rnd(-120, -20), life: rnd(0.6, 1.1), size: rnd(5, 8), color: '#ffc4df', seed: rnd(0, 6), rot: rnd(0, TAU), vr: rnd(-6, 6), drag: 0.95 }); }
        if (me) { fx.shake(0.8); flash(fx, me, '#ffffff', 0.55); fx.slowmo(0.18, 0.25); }
        fx.text(ev.x + Math.cos(ev.ang) * 180, ev.y + Math.sin(ev.ang) * 180 + 50, ev.still ? 'VOID DRAW · STILL' : 'VOID DRAW', { size: 26, color: P2.hi, life: 1.1, vy: -20, pop: 2 });
      }
      if (ev.id === 'dragons_descent') {
        boom(fx, ev.x, ev.y, ev.r, P, 1.2); pillar(fx, ev.x, ev.y, ev.r, P.a, 0.6, 700); fx.chunks(ev.x, ev.y, N(fx, 20), '#8a6a3a', 460);
        rays(fx, ev.x, ev.y, ev.r * 1.5, P.hi, 18, 0.5, 7);
        if (me) { fx.shake(0.8); flash(fx, me, '#ffe58a', 0.4); }
      }
      return;
    case 'chain': { const ch = FIVE_STEP.get(ev.id); const rt = fx._route; if (rt && rt.id === ev.id && rt.pid === ev.pid && (fx.time || 0) - rt.t < 1) return; if (ch && me) { /* (skipped above when the 5-step moment's title band already played) */ fx.banner('★ 5-STEP · ' + ch.name.toUpperCase(), P.b, (ch.kind === 'boss' ? 'BOSS' : 'MOB') + ' FINISHER · ' + spName(ev.cls).toUpperCase(), 1.3, 36); fx.ring(ev.x, ev.y, 90, P.a, 0.35, 8); } return; }
    case 'hit': chainLook(fx, ev, P, me); return;
    case 'pop': { fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.12, size: 70, color: P.hi }); fx.ring(ev.x, ev.y, (ev.r || 30) + 50, P.b, 0.3, 6); fx.text(ev.x, ev.y + (ev.r || 30) + 50, `×${ev.n} ${ev.kind.toUpperCase()} BURST`, { size: 18, color: P.b, life: 0.9, vy: -30 }); return; }
    case 'decreeSwing': { const W = PAL('warrior').w[ev.w] || P.a; fx.add({ type: 'wghost', x: ev.x, y: ev.y, ang: ev.ang, color: W, w: ev.w, life: 0.3 }); return; }
    case 'cloneCopy': for (const c of fx.cine) if (c.kind === 'spClones' && c.pid === ev.pid) { c.fl = 1; c.flT = c.t; } if (me) fx.text(ev.x, ev.y - 64, ev.n > 0 ? `CLONES COPY · ${ev.n} LEFT` : 'CLONES COPY · LAST', { size: 15, color: '#c9b8ff', life: 0.8, vy: -30 }); return;
    case 'clonesEnd': for (const c of fx.cine) if (c.kind === 'spClones' && c.pid === ev.pid) c.life = Math.min(c.life, c.t + 0.3); fx.puffs(ev.x, ev.y, N(fx, 8), 'rgba(90,60,140,.7)', 24, 120, 0.5); return;
    case 'echo': {
      const cl = fx.cine.find((c) => c.kind === 'spClones' && c.pid === ev.pid), from = cl && cl.pos ? cl.pos[ev.c ? -1 : 1] : null;
      if (from) fx.add({ type: 'dashclone', x: from.x, y: from.y, x2: ev.x, y2: ev.y, life: 0.22 });
      cross(fx, ev.x, ev.y, (ev.r || 24) + 20, ev.c ? '#ff8ad8' : '#b28cff', 0.2);
      return;
    }
  }
}
/** The clones' flash on copy fades (called per frame by the cine painter via c.fl). */
export function specTick(fx) { for (const c of fx.cine) if (c.kind === 'spClones' && c.fl && c.t - (c.flT || 0) > 0.25) c.fl = 0; }

/** Sounds for 'spx' events. */
export function specSound(au, ev, me) {
  if (!au.ctx || au.muted) return;
  switch (ev.ph) {
    case 'cast':
      if (ev.id === 'warlords_decree') { au.play('roar'); au.tone('sawtooth', 110, 55, 0.5, 0.12); }
      else if (ev.id === 'storm_of_arrows') { au.hiss(4000, 800, 0.6, 0.12, 0.8); au.tone('triangle', 660, 330, 0.3, 0.06); }
      else if (ev.id === 'grand_meteor') { au.tone('sine', 880, 110, ev.delay / 60, 0.1); au.hiss(1800, 300, ev.delay / 60, 0.08, 0.6); }
      else if (ev.id === 'divine_hammer') { au.tone('triangle', 523, 1046, 0.4, 0.1); au.tone('sine', 784, 392, 0.6, 0.08, 0.1); }
      else if (ev.id === 'shadow_clone') { au.hiss(2400, 600, 0.3, 0.1, 1.0); au.tone('square', 330, 660, 0.12, 0.05); }
      else if (ev.id === 'void_draw') { au.tone('sine', 110, 440, ev.charge / 60, 0.08); }
      else if (ev.id === 'dragons_descent') { au.play('roar'); au.tone('triangle', 196, 784, 0.4, 0.1); }
      return;
    case 'impact':
      if (ev.id === 'void_draw') { au.hiss(9000, 2000, 0.25, 0.2, 1.4); au.play('crit'); au.tone('sine', 1760, 220, 0.5, 0.1); return; }
      au.play('detonate'); au.tone('sine', 98, 49, 0.6, 0.18); if (ev.id === 'divine_hammer') au.tone('triangle', 1046, 523, 0.8, 0.08); return;
    case 'hit': if (ev.i === 0 || ev.last) { au.play(ev.n ? 'heavy' : 'swing'); } return;
    case 'pop': au.play('crit'); return;
    case 'echo': au.tone('sine', 520, 260, 0.06, 0.03); return;
  }
}

/** HUD icons for the Specials (hud.js icon() hook). `stroke(col, lw)` strokes the current path with an ink outline. */
export function specIcon(ctx, id, stroke) {
  switch (id) {
    case 'dragons_roar': // a horned dragon head breathing a fire cone
      ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(16, -12); ctx.lineTo(16, 10); ctx.closePath(); stroke('#ff7a1e', 3);
      ctx.beginPath(); ctx.arc(-6, 0, 8, 0, Math.PI * 2); stroke('#9a6bff', 4);
      ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(-16, -15); ctx.moveTo(-4, -7); ctx.lineTo(-6, -17); stroke('#e8dcff', 2.5);
      ctx.beginPath(); ctx.arc(-4, -2, 1.6, 0, Math.PI * 2); stroke('#ffd23f', 2); return true;
    case 'warlords_decree': // three weapons crossed + a banner
      ctx.beginPath(); ctx.moveTo(-14, 14); ctx.lineTo(10, -12); stroke('#5ec8ff', 4);
      ctx.beginPath(); ctx.moveTo(14, 14); ctx.lineTo(-10, -12); stroke('#ff4d5e', 4);
      ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(0, -8); stroke('#ffb52e', 4);
      ctx.beginPath(); ctx.rect(-8, -18, 16, 8); stroke('#ffb52e', 3);
      return true;
    case 'storm_of_arrows':
      ctx.beginPath(); ctx.arc(-6, -10, 8, Math.PI, 0); ctx.arc(6, -10, 8, Math.PI, 0); stroke('#9fb0c4', 3);
      for (const x of [-10, 0, 10]) { ctx.beginPath(); ctx.moveTo(x, -2); ctx.lineTo(x - 3, 14); stroke('#7af0ff', 3); }
      return true;
    case 'grand_meteor':
      ctx.beginPath(); ctx.moveTo(14, -14); ctx.lineTo(-2, 2); stroke('#ffd23f', 6);
      ctx.beginPath(); ctx.arc(-6, 6, 9, 0, TAU); stroke('#ff7a2c', 5);
      return true;
    case 'divine_hammer':
      ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(0, -4); stroke('#c8a060', 4);
      ctx.beginPath(); ctx.rect(-12, -16, 24, 12); stroke('#ffe27a', 4);
      ctx.beginPath(); ctx.moveTo(-4, -10); ctx.lineTo(4, -10); stroke('#ffffff', 2);
      return true;
    case 'shadow_clone':
      for (const [x, c] of [[-10, '#6a4aa0'], [10, '#6a4aa0'], [0, '#b28cff']]) { ctx.beginPath(); ctx.arc(x, -6, 6, 0, TAU); stroke(c, 3); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 12); stroke(c, 4); }
      return true;
    case 'void_draw':
      ctx.beginPath(); ctx.moveTo(-16, 10); ctx.lineTo(16, -10); stroke('#ffffff', 3);
      ctx.beginPath(); ctx.arc(-10, 12, 5, 0, TAU); stroke('#ffb3d9', 3);
      ctx.beginPath(); ctx.moveTo(-16, -12); ctx.lineTo(-4, -12); ctx.moveTo(4, 12); ctx.lineTo(16, 12); stroke('#dfe8ff', 2);
      return true;
    case 'dragons_descent':
      ctx.beginPath(); ctx.moveTo(-14, -12); ctx.quadraticCurveTo(10, -14, 0, 0); ctx.quadraticCurveTo(-10, 12, 12, 12); stroke('#ffd23f', 5);
      ctx.beginPath(); ctx.arc(12, 12, 3, 0, TAU); stroke('#fffaf0', 2);
      return true;
  }
  return false;
}
