// VFX overhaul: a quality layer on top of every class's own effects. It never replaces a class look; it adds the things that
// make them read as high quality: a soft cast bloom at the hands, a rotating rune circle under every chain (bigger per tier,
// golden for 5-steps / finishers), a light pillar + shock band + rising motes for ultimates, soft blooms and shaped motes on
// finales, kills and basics. Everything scales with fx.partMul and is skipped in 'lite' quality.
import { CLASSES, chainById } from '../sim/data/classes.js';
import { bloom, mote, ease, rgba } from './fxglow.js';
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
/** Per-class palette: [main, highlight, mote shape]. */
export const PAL = {
  warrior: ['#ffb347', '#fff1c4', 'diamond'], ranger: ['#8dff6a', '#eaffd8', 'feather'], mage: ['#a98bff', '#efe8ff', 'star4'],
  cleric: ['#ffe27a', '#fffbe0', 'star4'], bladedancer: ['#ff6fc4', '#ffe0f4', 'petal'], samurai: ['#ff9ad0', '#fff0f8', 'petal'],
  monk: ['#ffc24a', '#fff4d0', 'diamond'], dragoon: ['#8a6bff', '#ffd9e0', 'diamond'], summoner: ['#3ff0c8', '#e6fff8', 'page'], bard: ['#ff7ab8', '#fff0c8', 'note'],
};
const N = (fx, n) => Math.max(1, Math.round(n * (fx.partMul ?? 1)));
const clsOf = (fx, ev) => ev.cls || (fx.sim && fx.sim.players && fx.sim.players.get(ev.pid) || {}).cls;
const posOf = (fx, ev) => { const p = fx.sim && fx.sim.players && fx.sim.players.get(ev.pid); return p ? { x: p.x, y: p.y } : { x: ev.x, y: ev.y }; };
function motes(fx, x, y, n, col, shape, speed = 160, life = 0.7, size = 6, up = 60) {
  for (let i = 0; i < N(fx, n); i++) {
    const a = rnd(0, TAU), s = rnd(speed * 0.35, speed);
    fx.add({ type: 'mote', shape, x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 8, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, drag: 0.9, life: rnd(life * 0.6, life), size: rnd(size * 0.6, size), color: col, rot: rnd(0, TAU), spin: rnd(-6, 6), grow: true });
  }
}
function embers(fx, x, y, n, col, spread = 50, up = 200) {
  for (let i = 0; i < N(fx, n); i++) fx.add({ type: 'ember', x: x + rnd(-spread, spread), y: y + rnd(-spread * 0.5, spread * 0.5), vx: rnd(-30, 30), vy: -rnd(up * 0.4, up), drag: 0.95, life: rnd(0.5, 1.0), size: rnd(1.6, 3.2), color: col, seed: rnd(0, 9) });
}
export function polishFx(fx, ev, me) {
  if (fx.lite) return;
  switch (ev.type) {
    case 'skill': { // a soft cast bloom at the hands + a few shaped motes
      const P = PAL[ev.cls]; if (!P) return;
      const hx = ev.x + Math.cos(ev.ang || 0) * 22, hy = ev.y - 8 + Math.sin(ev.ang || 0) * 22;
      fx.add({ type: 'glow', x: hx, y: hy, size: 46, color: P[0], life: 0.22, a: 0.7 });
      motes(fx, hx, hy, 4, P[1], P[2], 120, 0.45, 4.5, 20);
      return;
    }
    case 'chain': { // a rotating rune circle under the hero, bigger per tier (5-steps / finishers: golden, with rays)
      const cls = clsOf(fx, ev), P = PAL[cls]; if (!P) return;
      const ch = cls && chainById(cls, ev.id), tier = ev.fin ? 6 : ch ? ch.seq.length : 2, at = posOf(fx, ev);
      const gold = tier >= 5, col = gold ? '#ffd86a' : P[0];
      fx.cine.push({ kind: 'polrune', t: 0, life: 0.55 + tier * 0.08, x: at.x, y: at.y + 6, r: 46 + tier * 14, col, hi: gold ? '#fff6d0' : P[1], n: 4 + tier, pid: ev.pid, follow: ev.pid });
      fx.add({ type: 'glow', x: at.x, y: at.y - 10, size: 60 + tier * 16, color: col, life: 0.3, a: 0.55 });
      motes(fx, at.x, at.y - 10, 4 + tier * 2, gold ? '#fff2b0' : P[1], P[2], 160 + tier * 30, 0.6, 5 + tier * 0.6, 50);
      if (gold) fx.add({ type: 'rays', x: at.x, y: at.y - 10, r: 120 + tier * 20, color: '#ffe8a0', n: 14, life: 0.4, w: 5, seed: rnd(0, TAU) });
      return;
    }
    case 'ult': { // ultimates: a big rune circle, a light pillar, a shock band and rising motes; a colour flash for you
      const P = PAL[ev.cls]; if (!P) return;
      fx.cine.push({ kind: 'polrune', t: 0, life: 1.4, x: ev.x, y: ev.y + 6, r: 150, col: P[0], hi: P[1], n: 12, pid: ev.pid, follow: ev.pid, big: 1 });
      fx.add({ type: 'pillar', x: ev.x, y: ev.y + 10, size: 120, h: 640, life: 0.7, color: P[0] });
      fx.add({ type: 'shock', x: ev.x, y: ev.y, r0: 30, r1: 340, life: 0.6, color: P[0], width: 22 });
      fx.add({ type: 'glow', x: ev.x, y: ev.y - 20, size: 260, color: P[0], life: 0.6, a: 0.7 });
      motes(fx, ev.x, ev.y - 10, 26, P[1], P[2], 260, 1.1, 8, 120); embers(fx, ev.x, ev.y, 24, P[0], 120, 320);
      if (me) { fx.flash = Math.max(fx.flash || 0, 0.35); fx.flashColor = P[1]; }
      return;
    }
    case 'ultEnd': if (ev.finisher) { const P = PAL[ev.cls] || PAL.warrior; fx.add({ type: 'shock', x: ev.x, y: ev.y, r0: 60, r1: 520, life: 0.7, color: P[0], width: 26 }); embers(fx, ev.x, ev.y, 30, P[1], 260, 380); } return;
    case 'spx': {
      if (ev.ph === 'hit' && ev.look === 'finale') { // 5-step finale: bloom + shock band + gold motes
        const P = PAL[ev.cls] || PAL.warrior, r = ev.r || 200;
        fx.add({ type: 'glow', x: ev.x, y: ev.y, size: r * 1.3, color: P[0], life: 0.4, a: 0.45 });
        fx.add({ type: 'shock', x: ev.x, y: ev.y, r0: r * 0.3, r1: r * 1.35, life: 0.55, color: '#ffd86a', width: 24 });
        motes(fx, ev.x, ev.y, 22, '#fff2b0', P[2], 320, 0.9, 8, 80); embers(fx, ev.x, ev.y, 20, P[0], r * 0.5, 300);
      } else if (ev.ph === 'cast') { const P = PAL[ev.cls]; if (P) { fx.add({ type: 'glow', x: ev.x, y: ev.y - 14, size: 140, color: P[0], life: 0.4, a: 0.6 }); motes(fx, ev.x, ev.y - 10, 12, P[1], P[2], 200, 0.8, 6, 60); } }
      return;
    }
    case 'swing': { const P = PAL[ev.cls]; if (!P) return; const R = (ev.range || 100) * 0.8; fx.add({ type: 'glow', x: ev.x + Math.cos(ev.ang) * R, y: ev.y + Math.sin(ev.ang) * R, size: ev.heavy ? 70 : 44, color: P[0], life: 0.16, a: 0.5 }); if (ev.heavy) motes(fx, ev.x + Math.cos(ev.ang) * R, ev.y + Math.sin(ev.ang) * R, 5, P[1], P[2], 180, 0.4, 5, 10); return; }
    case 'shoot': { const P = PAL[ev.cls]; if (!P) return; fx.add({ type: 'glow', x: ev.x + Math.cos(ev.ang) * 24, y: ev.y + Math.sin(ev.ang) * 24, size: ev.heavy ? 60 : 38, color: P[0], life: 0.15, a: 0.55 }); return; }
    case 'death': if (!ev.boss) { fx.add({ type: 'glow', x: ev.x, y: ev.y, size: (ev.r || 20) * 4, color: '#fff2d0', life: 0.3, a: 0.5 }); embers(fx, ev.x, ev.y, ev.elite ? 14 : 6, '#ffd27a', ev.r || 20, 160); } return;
  }
}
/** The rune circle (drawn under the actors). */
export const POL_UNDER = {
  polrune(fx, ctx, c, time) {
    let x = c.x, y = c.y;
    if (c.follow && fx.sim && fx.sim.players) { const p = fx.sim.players.get(c.follow); if (p) { x = p.x; y = p.y + 6; } }
    const k = c.t / c.life, inK = ease.back(Math.min(1, c.t / 0.18)), out = 1 - ease.in(Math.max(0, (k - 0.55) / 0.45));
    const R = c.r * (0.55 + 0.45 * inK), a = out, rot = time * (c.big ? 0.9 : 1.6) + c.n;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.42);
    bloom(ctx, 0, 0, R * 1.5, c.col, 0.35 * a);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * 0.9; ctx.strokeStyle = c.col; ctx.lineWidth = c.big ? 5 : 3.5; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    ctx.globalAlpha = a * 0.7; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R * 0.78, 0, TAU); ctx.stroke();
    ctx.strokeStyle = c.hi; ctx.globalAlpha = a; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, R * 1.02, 0, TAU); ctx.stroke();
    // tick marks + glyph diamonds rotating between the rings
    ctx.strokeStyle = c.col; ctx.lineWidth = 2;
    for (let i = 0; i < c.n * 3; i++) { const g = rot + i * TAU / (c.n * 3); ctx.globalAlpha = a * 0.6; ctx.beginPath(); ctx.moveTo(Math.cos(g) * R * 0.8, Math.sin(g) * R * 0.8); ctx.lineTo(Math.cos(g) * R * 0.9, Math.sin(g) * R * 0.9); ctx.stroke(); }
    for (let i = 0; i < c.n; i++) {
      const g = -rot * 0.7 + i * TAU / c.n, gx = Math.cos(g) * R * 0.89, gy = Math.sin(g) * R * 0.89;
      ctx.globalAlpha = a; ctx.fillStyle = c.hi; ctx.beginPath(); ctx.moveTo(gx, gy - 7); ctx.lineTo(gx + 4, gy); ctx.lineTo(gx, gy + 7); ctx.lineTo(gx - 4, gy); ctx.closePath(); ctx.fill();
    }
    // inner star polygon
    ctx.globalAlpha = a * 0.55; ctx.strokeStyle = c.col; ctx.lineWidth = 2; ctx.beginPath();
    const m = c.n % 2 ? c.n : c.n + 1, step = Math.floor(m / 2);
    for (let i = 0; i <= m; i++) { const g = rot * 0.5 + ((i * step) % m) * TAU / m; const px = Math.cos(g) * R * 0.74, py = Math.sin(g) * R * 0.74; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.stroke();
    ctx.restore();
  },
};
void rgba; void CLASSES;
