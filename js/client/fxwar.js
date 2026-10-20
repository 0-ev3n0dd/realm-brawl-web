// Warrior (Weapon Master) effects + sounds: every stance hit, swap transition, shout, Trinity and both finishers.
// Colours: Greatsword cyan-blue, Twin Axes blood red, Warhammer molten gold. Impact = screen shake + punch + slow-mo on the
// big moments (the sim adds the hit-stop). Driven by the 'wm' (predicted: casts, swaps, strikes, shouts) and 'wmx' (server:
// Trinity, Glory, Bleed detonations, weapon lit in the ult window, the Titanfall crit) events.
import { drawSword, drawHatchet, drawHammer } from './art.js';
const TAU = Math.PI * 2;
export const WM_COL = { G: '#5ec8ff', A: '#ff4d5e', H: '#ffb52e' };
const WM_HI = { G: '#dff6ff', A: '#ffd0d6', H: '#fff0b8' };
const rnd = (a, b) => a + Math.random() * (b - a);

/** Chain / finisher banner colours (by the weapon that lands it). */
export const WM_CHAIN = { rift_cleave: 'G', reavers_return: 'A', earthshatter_recall: 'H', cyclone_cleave: 'G', seismic_arc: 'G', thunder_hurl: 'H', warlords_rally: 'A', executioners_verdict: 'G', crimson_tempest: 'A', titanfall: 'H' };
const lite = (fx) => fx.partMul !== undefined && fx.partMul < 1; // phone on low quality: no additive blooms
const N = (fx, n) => Math.max(1, Math.round(n * (fx.partMul ?? 1)));
const at = (ev, d, da = 0) => [ev.x + Math.cos((ev.ang || 0) + da) * d, ev.y + Math.sin((ev.ang || 0) + da) * d];

// ---- building blocks (all layered strokes / additive fills, no shadowBlur: cheap enough for phones)
function wslash(fx, x, y, ang, arc, r, col, hi, width = 24, dir = 1, life = 0.26, o = {}) { fx.add({ type: 'wslash', x, y, ang, arc, r, life, color: col, hi, width, dir, lite: lite(fx), ...o }); }
function glow(fx, x, y, size, col, life = 0.3, a = 0.8) { if (!lite(fx)) fx.add({ type: 'glow', x, y, size, color: col, life, a }); }
function rays(fx, x, y, r, col, n = 12, life = 0.35, w = 6) { fx.add({ type: 'rays', x, y, r, color: col, n: Math.max(6, N(fx, n)), life, w, seed: rnd(0, TAU) }); }
function pillar(fx, x, y, size, col, life = 0.5, h = 460) { fx.add({ type: 'pillar', x, y, size, color: col, life, h, lite: lite(fx) }); }
function decal(fx, x, y, r, col, life = 1.6, n = 7) { fx.add({ type: 'crack', x, y, r, life, seed: rnd(0, TAU), glow: true, col, n, lite: lite(fx) }); }
function bolt(fx, x, y, x2, y2, col, width = 8, life = 0.3, jit = 7) {
  const L = Math.hypot(x2 - x, y2 - y), n = Math.max(3, Math.round(L / 34)), nx = -(y2 - y) / (L || 1), ny = (x2 - x) / (L || 1), pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, o = i && i < n ? rnd(-16, 16) : 0; pts.push([x + (x2 - x) * t + nx * o, y + (y2 - y) * t + ny * o]); }
  fx.add({ type: 'bolt', x, y, pts, color: col, width, life, jit, lite: lite(fx) });
}
function ghost(fx, x, y, ang, col, hi, len = 40, twin = false, life = 0.32, a = 0.5) { fx.add({ type: 'wghost', x, y, ang, color: col, hi, len, twin, life, a, lite: lite(fx) }); }
function embers(fx, x, y, n, col, spread = 60, up = 220) { for (let i = 0; i < N(fx, n); i++) fx.add({ type: 'dot', x: x + rnd(-spread, spread), y: y + rnd(-spread * 0.4, spread * 0.4), vx: rnd(-30, 30), vy: -rnd(up * 0.5, up), life: rnd(0.5, 0.9), size: rnd(2.5, 4.5), color: col, drag: 0.96 }); }
function blood(fx, x, y, ang, n, sp = 300) { fx.sparks(x, y, ang, N(fx, n), '#e0102a', sp, 0.9); fx.puffs(x, y, N(fx, Math.ceil(n / 2)), '#8a0018', 7, sp * 0.5, 0.45); }
function flash(fx, me, col, amt) { if (me) { fx.flash = Math.max(fx.flash || 0, amt); fx.flashColor = col; } }
function dark(fx, pid, life, a, col) { fx.cine.push({ kind: 'dark', t: 0, life, a, pid, col }); }
/** A heavy impact: bloom, star, rays, sparks, shock rings. */
function impact(fx, x, y, col, hi, size = 1, ang = null) {
  glow(fx, x, y, 120 * size, col, 0.35); fx.add({ type: 'flash', x, y, life: 0.12, size: 70 * size, color: hi });
  fx.add({ type: 'star', x, y, life: 0.22, size: 34 * size, color: hi }); rays(fx, x, y, 150 * size, col, 12, 0.32, 6 * size);
  if (ang != null) fx.sparks(x, y, ang, N(fx, 14 * size), hi, 460, 0.9); else fx.sparks(x, y, 0, N(fx, 16 * size), hi, 440, Math.PI);
  fx.ring(x, y, 90 * size, col, 0.32, 9); fx.ring(x, y, 55 * size, '#ffffff', 0.2, 5);
}
/** Ground slam: glowing crack decal, stacked shockwaves, flying rock chunks, dust. */
function quake(fx, x, y, r, col, big = 1) {
  decal(fx, x, y, r * 0.95, col, 1.3 + big * 0.5, 7 + Math.round(big * 2));
  fx.add({ type: 'crack', x, y, r: r * 0.6, life: 1.4 + big * 0.4, seed: rnd(0, TAU), glow: false });
  for (let i = 0; i < (big > 1.2 ? 3 : 2); i++) fx.ring(x, y, r * (1 - i * 0.25), i ? '#ffffff' : col, 0.38 + i * 0.1, 12 * big - i * 3);
  glow(fx, x, y, r * 1.1, col, 0.45, 0.7);
  if (fx.chunks) fx.chunks(x, y, N(fx, 10 * big), '#8a6a4a', 300 * big);
  fx.puffs(x, y, N(fx, 10 * big), 'rgba(200,180,150,.8)', 16, 150 * big, 0.7);
  fx.add({ type: 'flash', x, y, life: 0.14, size: r, color: WM_HI.H });
  rays(fx, x, y, r * 1.3, col, 14, 0.4, 7 * big);
}
function sky(fx, x, y, col, size = 90) { pillar(fx, x, y, size, col, 0.55); fx.add({ type: 'beam', x, y, life: 0.45, size: size * 0.8, color: col }); }

// ---- Arsenal Toss: the thrown / planted / recalled weapon (G)
/** Draw a Warrior weapon (w = G/A/H) along +x, scaled up a bit: it is the hero of the shot. */
function drawW(ctx, w, glow, k = 1.35) {
  ctx.save(); ctx.scale(k, k);
  if (w === 'A') { ctx.save(); ctx.rotate(-0.35); drawHatchet(ctx, 26, glow, 1); ctx.restore(); ctx.save(); ctx.rotate(0.35); drawHatchet(ctx, 26, glow, -1); ctx.restore(); }
  else if (w === 'H') drawHammer(ctx, 44, glow); else drawSword(ctx, 58, glow);
  ctx.restore();
}
const unPlant = (fx, pid) => { for (const c of fx.cine) if (c.kind === 'wmplant' && c.pid === pid) c.life = Math.min(c.life, c.t + 0.12); };
export const WM_CINE = {
  wmfly(fx, ctx, c) { // the toss: the weapon cartwheels along a high arc, a ribbon of its colour behind it
    const k = Math.min(1, c.t / c.T), col = WM_COL[c.w], pos = (q) => [c.x + (c.tx - c.x) * q, c.y + (c.ty - c.y) * q - Math.sin(q * Math.PI) * c.h];
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 10; i >= 1; i--) { const q = Math.max(0, k - i * 0.035), [x, y] = pos(q); ctx.globalAlpha = (1 - i / 11) * 0.5; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 14 - i, 0, TAU); ctx.fill(); }
    ctx.restore();
    const [x, y] = pos(k); ctx.save(); ctx.translate(x, y); ctx.rotate(c.t * (c.rev ? -26 : 22)); ctx.translate(-20, 0); drawW(ctx, c.w, col); ctx.restore();
    if (k >= 1) c.life = 0;
  },
  wmrecall(fx, ctx, c) { // the recall: it rips back along the ground to the hand, a streak + afterimages
    const k = Math.min(1, c.t / c.T), col = WM_COL[c.w], e = k * k, x = c.x + (c.tx - c.x) * e, y = c.y + (c.ty - c.y) * e, ang = Math.atan2(c.ty - c.y, c.tx - c.x);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.globalAlpha = 0.7; ctx.strokeStyle = col; ctx.lineWidth = c.big ? 30 : 20; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(x, y); ctx.stroke();
    ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.stroke(); ctx.restore();
    for (let i = 3; i >= 0; i--) { const q = Math.max(0, e - i * 0.08); ctx.save(); ctx.globalAlpha = i ? 0.25 : 1; ctx.translate(c.x + (c.tx - c.x) * q, c.y + (c.ty - c.y) * q); ctx.rotate(ang + Math.PI + c.t * 30); ctx.translate(-20, 0); drawW(ctx, c.w, col); ctx.restore(); }
    if (k >= 1) c.life = 0;
  },
  wmplant(fx, ctx, c) { // the planted weapon: stuck in a glowing crater with its reach ring, timer arc and a per-weapon aura
    const col = WM_COL[c.w], hi = WM_HI[c.w], fade = Math.min(1, (c.life - c.t) / 0.3), pulse = 0.5 + 0.5 * Math.sin(c.t * 7), drop = Math.min(1, c.t / 0.12);
    ctx.save(); ctx.globalAlpha = fade;
    // its effect radius (dashed, rotating) + aura
    ctx.setLineDash([10, 12]); ctx.lineDashOffset = -c.t * 40; ctx.strokeStyle = col; ctx.globalAlpha = 0.35 * fade; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r, c.r * 0.55, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, 90); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = (0.35 + 0.25 * pulse) * fade; ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c.x, c.y, 90, 50, 0, 0, TAU); ctx.fill();
    if (c.w === 'A') { ctx.globalAlpha = (0.18 + 0.12 * pulse) * fade; ctx.fillStyle = '#c0102a'; ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r, c.r * 0.55, 0, 0, TAU); ctx.fill(); }
    if (c.w === 'H') for (let i = 0; i < 3; i++) { const a = c.t * 3 + i * 2.1; ctx.globalAlpha = 0.5 * fade * pulse; ctx.strokeStyle = hi; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(a) * 46, c.y + Math.sin(a) * 26); ctx.stroke(); }
    // timer arc
    ctx.globalAlpha = 0.8 * fade; ctx.strokeStyle = hi; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y - 92, 12, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, 1 - c.t / c.life)); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    // crater cracks
    ctx.globalAlpha = 0.7 * fade; ctx.strokeStyle = 'rgba(30,20,10,.8)'; ctx.lineWidth = 2.5; for (let i = 0; i < 6; i++) { const a = c.seed + i * 1.05; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(a) * 34, c.y + Math.sin(a) * 18); ctx.stroke(); }
    // the weapon, blade down in the earth, wobbling as it lands
    const wob = Math.sin(c.t * 40) * Math.max(0, 0.25 - c.t) * 1.2;
    ctx.globalAlpha = fade; ctx.translate(c.x, c.y - (1 - drop) * 60); ctx.rotate(-Math.PI / 2 + 0.22 + wob);
    ctx.translate(c.w === 'G' ? -78 : -64, 0); drawW(ctx, c.w, pulse > 0.5 ? col : null);
    ctx.restore();
  },
};

/** Effects for 'wm' / 'wmx' events. Returns true (handled). */
export function wmFx(fx, ev, me) {
  const col = WM_COL[ev.w] || '#fff', hi = WM_HI[ev.w] || '#fff';
  if (ev.type === 'wm') switch (ev.ph) {
    case 'swap': {
      const c2 = WM_COL[ev.to];
      fx.ring(ev.x, ev.y, 80, c2, 0.3, 8); fx.puffs(ev.x, ev.y, N(fx, 10), c2, 10, 160, 0.4); glow(fx, ev.x, ev.y, 90, c2, 0.3, 0.5);
      fx.text(ev.x, ev.y - 78, ev.name.toUpperCase() + (ev.emp ? '!' : ''), { size: me ? 24 : 18, color: c2, pop: 1.8, life: 0.9, vy: -30 });
      fx.shake(0.12);
      return true;
    }
    case 'toss': {
      fx.cine.push({ kind: 'wmfly', t: 0, life: 2, x: ev.x, y: ev.y - 30, tx: ev.tx, ty: ev.ty, T: (ev.T || 12) / 60, h: ev.reaver ? 60 : 130, w: ev.w, pid: ev.pid });
      ghost(fx, ev.x, ev.y, Math.atan2(ev.ty - ev.y, ev.tx - ev.x), col, hi, 50, ev.w === 'A', 0.25, 0.5); fx.ring(ev.x, ev.y, 60, col, 0.25, 6);
      if (me && !ev.reaver) fx.text(ev.x, ev.y - 90, 'ARSENAL TOSS', { size: 18, color: hi, pop: 1.6, life: 0.7, vy: -30 });
      fx.shake(0.08); return true;
    }
    case 'plant': {
      unPlant(fx, ev.pid);
      fx.cine.push({ kind: 'wmplant', t: 0, life: (ev.t || 360) / 60, x: ev.x, y: ev.y, w: ev.w, pid: ev.pid, seed: rnd(0, TAU), r: ev.r || 160 });
      impact(fx, ev.x, ev.y, col, hi, 0.9); decal(fx, ev.x, ev.y, 70, col, 1.6, 6); pillar(fx, ev.x, ev.y, 50, col, 0.4, 260);
      if (fx.chunks) fx.chunks(ev.x, ev.y, N(fx, 8), '#8a6a4a', 260);
      fx.text(ev.x, ev.y - 110, { G: 'BLADE PLANTED', A: 'AXES PLANTED', H: 'HAMMER PLANTED' }[ev.w], { size: me ? 20 : 15, color: hi, pop: 1.8, life: 1, vy: -24 });
      fx.shake(0.28); if (me) fx.punch(Math.PI / 2, 6); return true;
    }
    case 'unplant': unPlant(fx, ev.pid); fx.puffs(ev.x, ev.y, N(fx, 8), 'rgba(200,180,150,.7)', 10, 120, 0.4); return true;
    case 'recall': {
      unPlant(fx, ev.pid);
      fx.cine.push({ kind: 'wmrecall', t: 0, life: 2, x: ev.x, y: ev.y - 20, tx: ev.tx, ty: ev.ty - 20, T: (ev.T || 8) / 60, w: ev.w, big: ev.big, pid: ev.pid });
      glow(fx, ev.x, ev.y, 110, col, 0.3, 0.7); fx.ring(ev.x, ev.y, 70, col, 0.3, 7); fx.sparks(ev.x, ev.y, Math.atan2(ev.ty - ev.y, ev.tx - ev.x), N(fx, 12), hi, 420, 0.6);
      if (!ev.reaver) fx.text(ev.x, ev.y - 90, 'RECALL!', { size: me ? 24 : 16, color: hi, pop: 2, life: 0.8, vy: -30 });
      return true;
    }
    case 'cast': {
      const c = WM_COL[ev.w] || '#fff';
      fx.ring(ev.x, ev.y, ev.chain ? 70 : 46, c, 0.24, ev.chain ? 7 : 4); glow(fx, ev.x, ev.y, ev.chain ? 110 : 70, c, 0.25, 0.55);
      if (ev.chain) { fx.sparks(ev.x, ev.y, 0, N(fx, 10), WM_HI[ev.w] || '#fff', 300, Math.PI); ghost(fx, ev.x - Math.cos(ev.ang) * 26, ev.y - Math.sin(ev.ang) * 26, ev.ang, c, WM_HI[ev.w], ev.w === 'G' ? 52 : 38, ev.w === 'A', 0.3, 0.45); }
      if (ev.gm) { fx.ring(ev.x, ev.y, 100, '#ffc93b', 0.4, 9); embers(fx, ev.x, ev.y, 10, '#ffd23f', 50, 200); fx.text(ev.x, ev.y - 110, `GLORY ×${ev.gm}`, { size: 22, color: '#ffe7a0', pop: 2, life: 0.9, vy: -30 }); }
      return true;
    }
    case 'fin': {
      const boss = ev.route === 'boss', c = boss ? WM_COL.H : WM_COL.A;
      fx.banner(ev.name.toUpperCase(), c, ev.gm > 1.01 ? `FINISHER · Glory ×${ev.gm}` : 'FINISHER', 2.4, 64);
      dark(fx, ev.pid, 2.6, boss ? 0.5 : 0.45, boss ? 'rgba(30,18,4,' : 'rgba(34,2,8,');
      pillar(fx, ev.x, ev.y, 150, c, 0.8, 560); for (const [i, cc] of [WM_COL.G, WM_COL.A, WM_COL.H].entries()) fx.ring(ev.x, ev.y, 140 + i * 50, cc, 0.5 + i * 0.1, 10);
      rays(fx, ev.x, ev.y, 260, c, 18, 0.5, 9); embers(fx, ev.x, ev.y, 24, boss ? '#ffe7a0' : '#ff6a7a', 90, 300);
      flash(fx, me, boss ? '#ffd27a' : '#ff8a9a', 0.45); if (me) fx.slowmo(0.35, 0.35);
      fx.shake(0.45);
      return true;
    }
    case 'shout': {
      if (ev.id === 'war_cry') {
        for (let i = 0; i < 4; i++) fx.ring(ev.x, ev.y, ev.r * (0.3 + i * 0.25), i % 2 ? '#ffffff' : WM_COL.G, 0.35 + i * 0.12, 11 - i * 2);
        rays(fx, ev.x, ev.y, ev.r, WM_COL.G, 20, 0.45, 7); glow(fx, ev.x, ev.y, ev.r * 0.8, WM_COL.G, 0.45, 0.6);
        fx.sparks(ev.x, ev.y, 0, N(fx, 24), WM_HI.G, 520, Math.PI);
        fx.text(ev.x, ev.y - 90, 'WAR CRY!', { size: 34, color: WM_HI.G, pop: 2.4, life: 1.1 }); fx.shake(0.4); if (me) fx.punch(-Math.PI / 2, 5);
      } else if (ev.id === 'rally') {
        pillar(fx, ev.x, ev.y, 120, '#ffd23f', 0.8, 500); fx.ring(ev.x, ev.y, ev.r, WM_COL.A, 0.55, 8); fx.ring(ev.x, ev.y, 110, '#ffd23f', 0.4, 10); fx.ring(ev.x, ev.y, 60, '#ffffff', 0.3, 6);
        glow(fx, ev.x, ev.y, 200, '#ffd23f', 0.6, 0.6); rays(fx, ev.x, ev.y, 220, '#ffd23f', 16, 0.5, 7);
        embers(fx, ev.x, ev.y, 26, '#ffd23f', 80, 300); embers(fx, ev.x, ev.y, 10, '#ff6a7a', 60, 220);
        fx.text(ev.x, ev.y - 100, 'RALLY!', { size: 36, color: '#ffd23f', pop: 2.4, life: 1.1 }); flash(fx, me, '#ffe7a0', 0.18); fx.shake(0.25);
      } else if (ev.id === 'challenge') {
        if (ev.tx != null) {
          bolt(fx, ev.x, ev.y, ev.tx, ev.ty, WM_COL.H, 7, 0.45, 8); bolt(fx, ev.x, ev.y, ev.tx, ev.ty, '#fff0b8', 3, 0.3, 12);
          fx.ring(ev.tx, ev.ty, 100, WM_COL.H, 0.55, 8); fx.ring(ev.tx, ev.ty, 60, '#fff', 0.35, 5); glow(fx, ev.tx, ev.ty, 120, WM_COL.H, 0.5, 0.6); rays(fx, ev.tx, ev.ty, 130, WM_COL.H, 10, 0.4, 5);
          fx.text(ev.tx, ev.ty - 90, 'CHALLENGED!', { size: 28, color: WM_COL.H, pop: 2.2, life: 1.2 });
        }
        fx.text(ev.x, ev.y - 90, 'FACE ME!', { size: 24, color: WM_HI.H, pop: 1.8, life: 0.9 }); fx.shake(0.2);
      }
      return true;
    }
    case 'hit': {
      const big = ev.emp ? 1.3 : 1, n = ev.n || 0, R = ev.r || 120;
      switch (ev.fx) {
        case 'cleave': case 'cleave2': { // Q Sweeping Cleave: a wide blue crescent with an echo, sword afterimages and wind streaks
          const d = ev.fx === 'cleave2' ? -1 : 1, arc = Math.min(ev.arc || 2.6, TAU);
          wslash(fx, ev.x, ev.y, ev.ang, arc, R, col, hi, 30 * big, d, 0.3);
          wslash(fx, ev.x, ev.y, ev.ang - d * 0.25, arc * 0.9, R * 0.8, '#2f7fd0', '#dff6ff', 14, d, 0.36, { speed: 3 });
          for (const k of [-0.6, 0, 0.6]) { const [gx, gy] = at(ev, 24, k * arc * 0.5); ghost(fx, gx, gy, ev.ang + k * arc * 0.5, col, hi, 56, false, 0.26, 0.35); }
          for (let i = 0; i < 5; i++) { const aa = ev.ang + (i / 4 - 0.5) * arc; fx.add({ type: 'spark', x: ev.x + Math.cos(aa) * R * 0.9, y: ev.y + Math.sin(aa) * R * 0.9, vx: Math.cos(aa) * 420, vy: Math.sin(aa) * 420, life: 0.22, size: 3.5, color: hi, drag: 0.86 }); }
          const [ix, iy] = at(ev, R * 0.7); glow(fx, ix, iy, 110 * big, col, 0.28, 0.6);
          if (n) { fx.sparks(ix, iy, ev.ang, N(fx, 10), hi, 400); fx.ring(ix, iy, 50, col, 0.2, 5); }
          fx.shake(0.14 + (n ? 0.1 : 0)); if (n && me) fx.punch(ev.ang, 4); break;
        }
        case 'crescent': case 'fin_crescent': {
          wslash(fx, ev.x, ev.y, ev.ang, ev.arc || 2, R, col, hi, 44, 1, 0.36); wslash(fx, ev.x, ev.y, ev.ang, (ev.arc || 2) * 0.8, R * 0.6, '#2f7fd0', hi, 20, -1, 0.3);
          const [ix, iy] = at(ev, R * 0.8); glow(fx, ix, iy, 180, col, 0.35, 0.6); rays(fx, ix, iy, 140, col, 10, 0.3, 5);
          fx.sparks(ix, iy, ev.ang, N(fx, 14), hi, 520); fx.shake(ev.fx === 'fin_crescent' ? 0.35 : 0.2); if (me) fx.punch(ev.ang, 6); break;
        }
        case 'lunge': case 'windblade': case 'thrust': case 'fin_impale': { // blue thrust / Shatterstep dash / Verdict impale
          const L = ev.len || 200, x2 = ev.x + Math.cos(ev.ang) * L, y2 = ev.y + Math.sin(ev.ang) * L, fin = ev.fx === 'fin_impale';
          fx.add({ type: 'trail', x: ev.x, y: ev.y, x2, y2, life: 0.36, color: col }); fx.add({ type: 'trail', x: ev.x, y: ev.y, x2, y2, life: 0.2, color: '#ffffff' });
          for (let i = 1; i <= 4; i++) ghost(fx, ev.x + Math.cos(ev.ang) * L * i / 5, ev.y + Math.sin(ev.ang) * L * i / 5, ev.ang, col, hi, 50, false, 0.2 + i * 0.06, 0.18 + i * 0.07);
          impact(fx, x2, y2, col, hi, fin ? 1.4 : 0.8, ev.ang);
          if (fin) { wslash(fx, x2, y2, ev.ang + Math.PI / 4, 1.4, 70, col, hi, 22, 1, 0.3); wslash(fx, x2, y2, ev.ang - Math.PI / 4, 1.4, 70, col, hi, 22, -1, 0.3); decal(fx, x2, y2, 90, col, 1.4); flash(fx, me, '#dff6ff', 0.2); }
          fx.shake(fin ? 0.5 : 0.16); if (me) fx.punch(ev.ang, fin ? 10 : 5); break;
        }
        case 'spin': case 'axespin': case 'cyclone': case 'cyclone2': case 'ravage': case 'fin_cyclone': { // whirlwinds: two spinning rings of trails + debris
          const d = ev.fx === 'cyclone2' ? -1 : 1, axes = ev.w === 'A';
          wslash(fx, ev.x, ev.y, rnd(0, TAU), TAU * 0.9, R, col, hi, 26 * big, d, 0.26, { speed: 5 });
          wslash(fx, ev.x, ev.y, rnd(0, TAU), TAU * 0.7, R * 0.72, axes ? '#a0102a' : '#2f7fd0', hi, 12, d, 0.3, { speed: 4 });
          if (ev.fx !== 'fin_cyclone' || n) glow(fx, ev.x, ev.y, R, col, 0.3, 0.45);
          for (let i = 0; i < N(fx, 6); i++) { const aa = rnd(0, TAU); fx.add({ type: 'spark', x: ev.x + Math.cos(aa) * R * 0.85, y: ev.y + Math.sin(aa) * R * 0.85, vx: Math.cos(aa + d * 1.4) * 380, vy: Math.sin(aa + d * 1.4) * 380, life: 0.22, size: 3, color: hi, drag: 0.88 }); }
          if (axes) { fx.puffs(ev.x, ev.y, N(fx, 6), '#b0001a', 7, 150, 0.4); if (n) blood(fx, ev.x, ev.y, rnd(0, TAU), 6, 260); }
          else fx.puffs(ev.x, ev.y + 10, N(fx, 5), 'rgba(200,220,240,.6)', 12, 160, 0.4);
          fx.shake(ev.fx === 'fin_cyclone' ? 0.08 : 0.18); break;
        }
        case 'earthcleave': { const L = ev.len || 400; fx.add({ type: 'trail', x: ev.x, y: ev.y, x2: ev.x + Math.cos(ev.ang) * L, y2: ev.y + Math.sin(ev.ang) * L, life: 0.3, color: col }); for (let dd = 60; dd < L; dd += 70) decal(fx, ev.x + Math.cos(ev.ang) * dd, ev.y + Math.sin(ev.ang) * dd, 60, col, 1.1, 5); fx.shake(0.4); fx.punch(ev.ang, 8); break; }
        case 'warcry': fx.ring(ev.x, ev.y, R, WM_COL.G, 0.3, 10); fx.shake(0.2); break;
        case 'flurryL': case 'flurryR': case 'fin_flurry': { // E Rending Flurry: alternating red hatchet X-cuts, blood sparks, hatchet afterimages
          const d = ev.fx === 'flurryL' ? -1 : 1, [ix, iy] = at(ev, (R || 120) * 0.55);
          wslash(fx, ev.x, ev.y, ev.ang + d * 0.2, 1.5, R || 120, col, hi, 18, d, 0.18, { speed: 6 });
          wslash(fx, ix, iy, ev.ang + d * 0.9, 1.1, 46, '#ff8a9a', '#fff', 10, -d, 0.16, { speed: 6 });
          ghost(fx, ev.x + Math.cos(ev.ang + d * 0.5) * 20, ev.y + Math.sin(ev.ang + d * 0.5) * 20, ev.ang + d * 0.5, col, hi, 30, true, 0.18, 0.4);
          glow(fx, ix, iy, 70, col, 0.18, 0.5);
          if (n) { blood(fx, ix, iy, ev.ang, 7, 320); fx.add({ type: 'star', x: ix, y: iy, life: 0.12, size: 16, color: '#ffd0d6' }); }
          fx.shake(ev.fx === 'fin_flurry' ? 0.08 : 0.06); break;
        }
        case 'hemorrhage': case 'rupture': { // Rupture Smash: red X-rend, then the hammer bursts the Bleed
          const [cx, cy] = at(ev, R * 0.55);
          wslash(fx, cx, cy, ev.ang + 0.8, 1.3, 76, col, hi, 22, 1, 0.24); wslash(fx, cx, cy, ev.ang - 0.8, 1.3, 76, col, hi, 22, -1, 0.24);
          if (ev.fx === 'rupture') { quake(fx, cx, cy, 100, WM_COL.H, 0.9); ghost(fx, cx - Math.cos(ev.ang) * 30, cy - Math.sin(ev.ang) * 30, ev.ang, WM_COL.H, WM_HI.H, 44, false, 0.3, 0.5); }
          glow(fx, cx, cy, 150, '#e0102a', 0.4, 0.7); blood(fx, cx, cy, ev.ang, 16, 360); fx.puffs(cx, cy, N(fx, 10), '#b0001a', 10, 220, 0.55);
          flash(fx, me, '#ff8a9a', 0.12); fx.shake(0.3); if (me) fx.punch(ev.ang, 8); break;
        }
        case 'bloodnova': fx.ring(ev.x, ev.y, R, '#d0102a', 0.5, 10); fx.ring(ev.x, ev.y, R * 0.5, '#ff4d5e', 0.35, 8); glow(fx, ev.x, ev.y, R, '#e0102a', 0.4, 0.6); fx.shake(0.3); break;
        case 'skull': { // R Skullcrusher: the hammer comes down overhead: gold bloom, rays, cracked ground, chunks, a flash
          const [cx, cy] = at(ev, 70);
          ghost(fx, cx - Math.cos(ev.ang) * 40, cy - Math.sin(ev.ang) * 40 - 30, ev.ang, col, hi, 44, false, 0.18, 0.5);
          wslash(fx, ev.x, ev.y, ev.ang, 1.1, 96, col, hi, 26, 1, 0.2, { speed: 7 });
          quake(fx, cx, cy, 95 * big, col, 0.9 * big); impact(fx, cx, cy, col, hi, 0.9 * big);
          flash(fx, me, '#fff0b8', 0.12); fx.shake(0.45); if (me) fx.punch(ev.ang, 11); break;
        }
        case 'toss': impact(fx, ev.x, ev.y, col, hi, 1); quake(fx, ev.x, ev.y, R, col, 0.7); fx.shake(0.25); break;
        case 'recall': { // the returning arc: a weapon-coloured streak along the whole path, cuts on everything in it
          const L = ev.len || 200, x2 = ev.x + Math.cos(ev.ang) * L, y2 = ev.y + Math.sin(ev.ang) * L;
          fx.add({ type: 'trail', x: ev.x, y: ev.y, x2, y2, life: 0.45, color: col }); fx.add({ type: 'trail', x: ev.x, y: ev.y, x2, y2, life: 0.25, color: '#ffffff' });
          if (ev.w === 'H') bolt(fx, ev.x, ev.y, x2, y2, WM_COL.H, 7, 0.35, 10);
          for (let i = 1; i <= 5; i++) { const q = i / 6; ghost(fx, ev.x + (x2 - ev.x) * q, ev.y + (y2 - ev.y) * q, ev.ang, col, hi, 44, ev.w === 'A', 0.18 + q * 0.2, 0.15 + q * 0.25); }
          if (n) { impact(fx, x2, y2, col, hi, 0.8, ev.ang); flash(fx, me, hi, 0.12); }
          fx.shake(n ? 0.3 : 0.15); if (me) fx.punch(ev.ang, n ? 7 : 3); break;
        }
        case 'plantcleave': { // the planted greatsword answers Q: a spectral blade sweeps a full circle around it
          wslash(fx, ev.x, ev.y, rnd(0, TAU), TAU * 0.95, R, WM_COL.G, WM_HI.G, 34, 1, 0.34, { speed: 4 });
          wslash(fx, ev.x, ev.y, rnd(0, TAU), TAU * 0.8, R * 0.7, '#2f7fd0', '#fff', 16, -1, 0.3, { speed: 5 });
          pillar(fx, ev.x, ev.y, 60, WM_COL.G, 0.45, 300); glow(fx, ev.x, ev.y, R, WM_COL.G, 0.35, 0.6); rays(fx, ev.x, ev.y, R * 1.1, WM_COL.G, 12, 0.35, 6);
          if (n) fx.sparks(ev.x, ev.y, 0, N(fx, 10), WM_HI.G, 420, Math.PI); fx.shake(me ? 0.18 : 0.08); break;
        }
        case 'riftcleave': { // Rift Cleave: a 360 blue crescent that tears the ground into a glowing rift
          wslash(fx, ev.x, ev.y, rnd(0, TAU), TAU, R, WM_COL.G, WM_HI.G, 44, 1, 0.38, { speed: 3 });
          wslash(fx, ev.x, ev.y, rnd(0, TAU), TAU, R * 0.65, '#2f7fd0', '#fff', 20, -1, 0.32, { speed: 4 });
          decal(fx, ev.x, ev.y, R * 0.9, WM_COL.G, 1.8, 10); impact(fx, ev.x, ev.y, WM_COL.G, WM_HI.G, 1.3); fx.ring(ev.x, ev.y, R * 1.15, '#fff', 0.35, 8);
          flash(fx, me, WM_HI.G, 0.22); if (me) fx.slowmo(0.1, 0.4); fx.shake(0.45); break;
        }
        case 'plantbleed': { // planted axes: a pulse of red mist + blood drops rolling out over the aura
          fx.ring(ev.x, ev.y, R, '#d0102a', 0.4, 5); glow(fx, ev.x, ev.y, R * 0.8, '#e0102a', 0.3, 0.4); fx.puffs(ev.x, ev.y, N(fx, 6), 'rgba(176,0,26,.6)', 12, R * 0.8, 0.5);
          if (n) blood(fx, ev.x, ev.y, rnd(0, TAU), 4 + n, 200); break;
        }
        case 'reaver': { // Reaver's Return: the hurled axes chew the target (red X-cuts + blood)
          wslash(fx, ev.x, ev.y, rnd(0, TAU), 1.6, 80, WM_COL.A, WM_HI.A, 20, 1, 0.18, { speed: 7 }); wslash(fx, ev.x, ev.y, rnd(0, TAU), 1.6, 80, WM_COL.A, WM_HI.A, 20, -1, 0.18, { speed: 7 });
          if (n) blood(fx, ev.x, ev.y, rnd(0, TAU), 10, 300); glow(fx, ev.x, ev.y, 90, '#e0102a', 0.25, 0.6); fx.shake(0.1); break;
        }
        case 'quake': case 'aftershock': quake(fx, ev.x, ev.y, R, col, ev.fx === 'quake' ? 1 : 0.6); fx.shake(ev.fx === 'quake' ? 0.35 : 0.2); break;
        case 'anvil': case 'skyfall': case 'warlord': case 'fin_meteor': case 'fin_quake': { // leaps and slams from the sky
          const b = ev.fx === 'fin_quake' || ev.fx === 'fin_meteor' ? 1.8 : ev.fx === 'warlord' ? 1.5 : 1.15;
          const c = ev.fx === 'warlord' ? '#ffd27a' : col, rr = Math.min(R, 360);
          sky(fx, ev.x, ev.y, c, 70 * b); quake(fx, ev.x, ev.y, rr, c, b); impact(fx, ev.x, ev.y, c, WM_HI.H, 0.8 * b);
          fx.add({ type: 'trail', x: ev.x - 40, y: ev.y - 380, x2: ev.x, y2: ev.y, life: 0.2, color: '#fff0b8' }); // the streak of the fall
          if (ev.fx === 'warlord' || ev.fx === 'fin_quake') { for (const [i, cc] of [WM_COL.G, WM_COL.A, WM_COL.H].entries()) fx.ring(ev.x, ev.y, rr * (0.55 + i * 0.2), cc, 0.5 + i * 0.1, 10); }
          if (ev.fx === 'fin_quake' && R > 360) { fx.ring(ev.x, ev.y, R, WM_COL.H, 0.7, 14); decal(fx, ev.x, ev.y, 300, WM_COL.A, 2.2, 12); }
          embers(fx, ev.x, ev.y, 14 * b, WM_HI.H, 80, 260);
          flash(fx, me, '#fff0b8', 0.12 * b); fx.shake(0.45 * b); if (me && b > 1.4) fx.slowmo(0.2, 0.4); break;
        }
        case 'seismic': { // Seismic Arc: a rising blue arc tearing a fan of rock spikes out of the ground, knocked-up streaks
          wslash(fx, ev.x, ev.y, ev.ang, ev.arc || 2.6, R, col, hi, 36, 1, 0.32);
          wslash(fx, ev.x, ev.y, ev.ang, (ev.arc || 2.6) * 0.85, R * 0.7, WM_COL.H, WM_HI.H, 14, -1, 0.3);
          for (let i = 0; i < 7; i++) { const aa = ev.ang + (i / 6 - 0.5) * (ev.arc || 2.6) * 0.9, dd = R * (0.5 + (i % 3) * 0.15), x = ev.x + Math.cos(aa) * dd, y = ev.y + Math.sin(aa) * dd; decal(fx, x, y, 40, WM_COL.H, 0.9, 4); fx.add({ type: 'trail', x, y, x2: x, y2: y - 70, life: 0.3, color: hi }); }
          if (fx.chunks) fx.chunks(ev.x + Math.cos(ev.ang) * R * 0.6, ev.y + Math.sin(ev.ang) * R * 0.6, N(fx, 12), '#8a6a4a', 320);
          fx.puffs(ev.x + Math.cos(ev.ang) * 90, ev.y + Math.sin(ev.ang) * 90, N(fx, 12), 'rgba(200,180,150,.8)', 14, 200, 0.55);
          glow(fx, ...at(ev, R * 0.6), 160, col, 0.35, 0.6); fx.shake(0.32); if (me) fx.punch(ev.ang, 8); break;
        }
        case 'hurl': { // Thunder Hurl: the hammer flies out on a lightning bolt and bursts in thunder
          const L = ev.len || 380, x2 = ev.x + Math.cos(ev.ang) * L, y2 = ev.y + Math.sin(ev.ang) * L;
          fx.add({ type: 'trail', x: ev.x, y: ev.y, x2, y2, life: 0.3, color: WM_COL.H });
          bolt(fx, ev.x, ev.y, x2, y2, WM_COL.H, 9, 0.35, 9); bolt(fx, ev.x, ev.y, x2, y2, '#bfe8ff', 4, 0.25, 14);
          impact(fx, x2, y2, WM_COL.H, '#fff0b8', 1.1, ev.ang); for (let i = 0; i < 3; i++) { const aa = rnd(0, TAU); bolt(fx, x2, y2, x2 + Math.cos(aa) * 90, y2 + Math.sin(aa) * 90, '#fff0b8', 4, 0.25, 6); }
          flash(fx, me, '#fff0b8', 0.1); fx.shake(0.3); break;
        }
        case 'fin_rise': sky(fx, ev.x, ev.y, '#fff0b8', 110); fx.ring(ev.x, ev.y, 70, '#fff0b8', 0.45, 9); rays(fx, ev.x, ev.y, 160, '#fff0b8', 12, 0.4, 6); embers(fx, ev.x, ev.y, 16, '#fff0b8', 40, 420); fx.text(ev.x, ev.y - 100, '▲', { size: 34, color: '#fff0b8', life: 0.6, vy: -140 }); break;
        default: wslash(fx, ev.x, ev.y, ev.ang, 2, R, col, hi, 20);
      }
      return true;
    }
  }
  if (ev.type === 'wmx') switch (ev.ph) {
    case 'pulse': return wmFx(fx, { ...ev, type: 'wm', ph: 'hit' }, me); // a planted weapon acting on its own (server)
    case 'trinity':
      for (const [i, c] of [WM_COL.G, WM_COL.A, WM_COL.H].entries()) { fx.ring(ev.x, ev.y, 90 + i * 45, c, 0.45 + i * 0.1, 10); rays(fx, ev.x, ev.y, 170 + i * 30, c, 6, 0.4, 6); }
      fx.add({ type: 'tri', x: ev.x, y: ev.y, r: 110, life: 0.8, seed: rnd(0, TAU), cols: [WM_COL.G, WM_COL.A, WM_COL.H] });
      glow(fx, ev.x, ev.y, 220, '#fff2b0', 0.5, 0.7); embers(fx, ev.x, ev.y, 18, '#fff2b0', 70, 260);
      fx.text(ev.x, ev.y - 110, 'TRINITY!', { size: me ? 46 : 30, color: '#fff2b0', pop: 2.8, life: 1.2, vy: -20 });
      flash(fx, me, '#fff2b0', 0.25); if (me) fx.slowmo(0.12, 0.45);
      fx.shake(0.35);
      return true;
    case 'glory': if (me && ev.why !== 'trinity') fx.text(ev.x, ev.y, `+${ev.n} Glory`, { size: 16, color: '#ffc93b', life: 0.8, vy: -40 }); else if (me) fx.text(ev.x + 50, ev.y - 30, `+${ev.n} Glory`, { size: 18, color: '#ffc93b', life: 1, vy: -40 }); return true;
    case 'ut': if (me) fx.text(ev.x, ev.y, `${{ G: 'GREATSWORD', A: 'AXES', H: 'HAMMER' }[ev.w]} ✓`, { size: 18, color: WM_COL[ev.w], life: 0.9, vy: -40 }); return true;
    case 'tri': return true;
    case 'pop': fx.ring(ev.x, ev.y, 40 + ev.r + ev.n * 6, '#d0102a', 0.35, 8); glow(fx, ev.x, ev.y, 60 + ev.n * 10, '#e0102a', 0.3, 0.6); blood(fx, ev.x, ev.y, 0, 6 + ev.n, 280); fx.text(ev.x, ev.y - ev.r - 40, `BLEED ×${ev.n}${ev.keep ? '' : '!'}`, { size: 18 + Math.min(12, ev.n * 1.5), color: '#ff4d5e', pop: 1.8, life: 0.9 }); fx.shake(0.1 + Math.min(0.3, ev.n * 0.03)); return true;
    case 'verdict': { // Executioner's Verdict: a giant spectral greatsword drops on the Challenged target
      pillar(fx, ev.x, ev.y, 80, WM_COL.G, 0.6, 520); fx.add({ type: 'trail', x: ev.x, y: ev.y - 420, x2: ev.x, y2: ev.y, life: 0.3, color: '#dff6ff' });
      impact(fx, ev.x, ev.y, WM_COL.G, '#e9f6ff', 1.5); decal(fx, ev.x, ev.y, 120, WM_COL.G, 1.8, 9);
      wslash(fx, ev.x, ev.y, Math.PI / 4, 1.2, 80, WM_COL.G, '#fff', 20, 1, 0.3); wslash(fx, ev.x, ev.y, -Math.PI / 4, 1.2, 80, WM_COL.G, '#fff', 20, -1, 0.3);
      fx.ring(ev.x, ev.y, 150, WM_COL.G, 0.5, 12); fx.text(ev.x, ev.y - 110, `VERDICT ×${ev.mul}`, { size: 38, color: '#e9f6ff', pop: 2.6, life: 1.2 });
      flash(fx, me, '#dff6ff', 0.3); fx.shake(0.65); if (me) fx.slowmo(0.22, 0.3); return true;
    }
    case 'titan': // Titanfall: a meteor-sized hammer impact
      sky(fx, ev.x, ev.y, '#fff0b8', 180); quake(fx, ev.x, ev.y, 240, WM_COL.H, 2); impact(fx, ev.x, ev.y, WM_COL.H, '#fff0b8', 2.2);
      fx.ring(ev.x, ev.y, 320, '#fff0b8', 0.8, 16); decal(fx, ev.x, ev.y, 260, '#ff7a2e', 2.6, 12);
      fx.text(ev.x, ev.y - 130, ev.bonus ? 'EXECUTED!' : 'TITANFALL!', { size: 50, color: '#fff0b8', pop: 3.2, life: 1.5 });
      fx.shake(1); flash(fx, me, '#fff0b8', 0.6); if (me) fx.slowmo(0.4, 0.3); return true;
  }
  return true;
}

/** Sounds for 'wm' / 'wmx' (au = the Audio object: play / tone / hiss). */
export function wmSound(au, ev, me) {
  if (!au.ctx || au.muted) return;
  if (ev.type === 'wm') switch (ev.ph) {
    case 'swap': au.play('heavy'); au.tone('triangle', { G: 520, A: 660, H: 330 }[ev.to] || 440, ({ G: 520, A: 660, H: 330 }[ev.to] || 440) * 1.5, 0.12, 0.08); return;
    case 'cast': { const f = { G: 520, A: 660, H: 330 }[ev.w] || 440; au.tone('triangle', f, f * 1.5, 0.1, 0.06); if (ev.gm) au.tone('sawtooth', 220, 660, 0.18, 0.1); return; }
    case 'toss': au.hiss(3000, 900, 0.25, 0.14, 1); au.tone('triangle', 300, 600, 0.2, 0.06); return;
    case 'plant': au.play('slam'); au.tone('square', 140, 70, 0.25, 0.1); return;
    case 'recall': au.hiss(900, 4200, 0.2, 0.16, 1.2); au.tone('triangle', 400, 900, 0.18, 0.08); return;
    case 'unplant': return;
    case 'fin': au.play('roar'); au.tone('sawtooth', 110, 55, 0.8, 0.2); return;
    case 'shout': au.play('roar'); if (ev.id === 'rally') [392, 523, 659].forEach((f, i) => au.tone('square', f, f, 0.15, 0.06, i * 0.06)); return;
    case 'hit':
      if (/riftcleave|plantcleave/.test(ev.fx)) { au.play('heavy'); au.tone('sawtooth', 660, 220, 0.25, 0.08); }
      else if (/quake|anvil|skyfall|warlord|meteor|skull|rupture|earthcleave/.test(ev.fx)) { au.play('slam'); if (/meteor|fin_quake|warlord/.test(ev.fx)) au.play('boom'); }
      else if (/flurry/.test(ev.fx)) au.hiss(5200, 1400, 0.06, 0.18, 1.4);
      else au.play('heavy');
      return;
  }
  if (ev.type === 'wmx') switch (ev.ph) {
    case 'trinity': [523, 659, 784, 1046].forEach((f, i) => au.tone('triangle', f, f, 0.18, 0.12, i * 0.05)); au.play('chain'); return;
    case 'pulse': if (ev.fx === 'quake') au.play('slam'); else if (ev.fx === 'plantcleave') au.hiss(2600, 700, 0.15, 0.08, 1.2); return;
    case 'pop': au.play('crit'); return;
    case 'titan': case 'verdict': au.play('detonate'); return;
    case 'ut': if (me) au.tone('triangle', 880, 1320, 0.1, 0.1); return;
  }
}
