// Dragoon: crimson lances with ember-orange dragon fire and a violet spear glint. Thrusts are long piercing streaks with a shock cone, jumps leave rising trails
// and land in cratered flame spires, spins are swirling arcs, wyrmfire is a rain of ember comets, the Roar is expanding red rings and Dragon Form grows wings of embers.
import { TAU, clamp, lerp } from './fxsk_core.js';
import { bloom, ease } from './fxglow.js';
const CR = '#ff3048', FI = '#ff7a1e', EM = '#ffb347', HI = '#fff1e0', VI = '#9a6bff', SK = '#bcd4ff', DEEP = '#2a0410';
const land = (k, far = 420) => k.ahead(k.enemy ? Math.min(far, k.dist) : far * 0.8); // where a leap comes down
const angTo = (k, s) => Math.atan2(s.y - k.y, s.x - k.x);

export default {
  pal: { a: '#ff3048', b: '#ffb347', hi: '#fff1e0', deep: '#2a0410', ink: '#12020a', edge: '#ff7a8a' },

  // ------------------------------------------------------------------ own piece: a flying spear with a flame tail (thrown, falls from the sky, lunges)
  prims: {
    drg_lance(ctx, c, k) {
      const fly = c.fly || 0.45, t = clamp(k / fly), u = ease.out(t), hold = 1 - ease.in(clamp((k - fly - 0.08) / (1 - fly)));
      const ca = Math.cos(c.ang), sa = Math.sin(c.ang), s = c.size || 1, x = c.x + ca * c.len * u, y = c.y + sa * c.len * u, a = (t < 1 ? 1 : hold);
      if (a <= 0.01) return;
      const tail = Math.min(c.len * u, 240 * s), pts = [];
      for (let i = 0; i <= 8; i++) { const q = i / 8; pts.push([x - ca * tail * (1 - q), y - sa * tail * (1 - q)]); }
      ctx.lineCap = 'round';
      for (const [w, col, al] of [[16 * s, c.col, 0.35], [7 * s, c.b || c.col, 0.7], [2.4 * s, '#fff', 0.95]]) { ctx.strokeStyle = col; ctx.globalAlpha = a * al * (t < 1 ? 1 : 0.5); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(x, y); ctx.stroke(); }
      ctx.save(); ctx.translate(x, y); ctx.rotate(c.ang); ctx.globalAlpha = a; // the spear: shaft, leaf blade, crossguard
      ctx.fillStyle = c.hi || '#fff'; ctx.fillRect(-62 * s, -2 * s, 62 * s, 4 * s);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(34 * s, 0); ctx.lineTo(4 * s, -9 * s); ctx.lineTo(-6 * s, 0); ctx.lineTo(4 * s, 9 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.col; ctx.globalAlpha = a * 0.8; ctx.beginPath(); ctx.moveTo(30 * s, 0); ctx.lineTo(6 * s, -6 * s); ctx.lineTo(-2 * s, 0); ctx.lineTo(6 * s, 6 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.b || c.col; ctx.globalAlpha = a; ctx.fillRect(-9 * s, -7 * s, 4 * s, 14 * s);
      ctx.restore(); bloom(ctx, x, y, 34 * s, c.col, 0.8 * a); bloom(ctx, x + ca * 26 * s, y + sa * 26 * s, 14 * s, '#fff', 0.8 * a, 1);
    },
  },

  skills: {
    piercing_thrust(k) { // a long red lance of light pierces the whole line, a violet needle inside it, then a shock cone and ember spray at the tip
      const p = k.ahead(18), e = k.ahead(270);
      k.streak({ x: p.x, y: p.y - 10, ang: k.ang, len: 310, w: 20, col: '#ff3048', hi: EM, d: 0.05, life: 0.4, ticks: 5 });
      k.streak({ x: p.x, y: p.y - 10, ang: k.ang, len: 340, w: 7, col: VI, hi: '#fff', d: 0.03, life: 0.3 });
      k.wave({ x: k.x, y: k.y - 8, ang: k.ang, arc: 0.9, r: 300, n: 3, w: 12, col: CR, hi: EM, d: 0.1, life: 0.5 });
      k.burst({ x: e.x, y: e.y - 10, n: 8, len: 90, col: CR, hi: EM, rot: k.ang, d: 0.12, life: 0.4 });
      k.motes({ x: e.x, y: e.y, n: 14, type: 'ember', spd: 340, g: 80, size: 5, col: FI, col2: '#fff', ang: k.ang, spread: 1.0, d: 0.12 });
    },
    sweeping_arc(k) { // the spear spins: a wide crimson blade and a tighter violet one orbit you, with a ring of embers thrown out
      k.arc({ x: k.x, y: k.y, a0: k.ang - 2.4, sw: 5.0, r: 150, w: 24, col: CR, hi: EM, d: 0.06, sq: 0.85 });
      k.arc({ x: k.x, y: k.y, a0: k.ang + 2.6, sw: -4.4, r: 112, w: 12, col: VI, hi: '#fff', d: 0.1, sq: 0.85 });
      k.swirl({ x: k.x, y: k.y + 12, R: 150, h: 70, arms: 3, col: FI, hi: EM, spin: 12, w: 8, d: 0.05, life: 0.55, opt: true });
      k.ring({ R: 180, col: CR, d: 0.1 });
      k.motes({ n: 20, type: 'ember', spd: 330, g: 60, size: 5, col: FI, col2: '#fff', spread: TAU, d: 0.1 });
      k.shake(0.2);
    },
    jump(k) { // three trails rush skyward and the lancer comes down as a red comet: shock rings, a cracked crater, flame spires
      for (let i = 0; i < 3; i++) k.streak({ x: k.x + (i - 1) * 18, y: k.y, ang: -Math.PI / 2, len: 300 + i * 40, w: 9, col: i === 1 ? VI : SK, hi: '#fff', d: i * 0.03, life: 0.4 });
      k.flash({ R: 90, col: SK }); k.ring({ R: 80, col: SK }); k.motes({ y: k.y - 10, n: 10, type: 'ember', spd: 200, g: -120, size: 5, col: SK, col2: '#fff', ang: -Math.PI / 2, spread: 0.8, life: 0.9 });
      const L = land(k);
      k.comet({ x: L.x, y: L.y, from: -Math.PI / 2, len: 560, size: 20, col: CR, hi: EM, impact: 150, d: 0.1, life: 0.72, hit: 0.5 });
      k.ring({ x: L.x, y: L.y, R: 175, n: 2, w: 26, col: CR, d: 0.46 }); k.crack({ x: L.x, y: L.y, R: 150, n: 8, col: FI, hi: EM, d: 0.46 });
      k.spires({ x: L.x, y: L.y, n: 7, R: 120, h: 150, wd: 22, shape: 'flame', col: FI, hi: '#ff9a40', d: 0.46 });
      k.motes({ x: L.x, y: L.y, n: 18, type: 'pix', spd: 360, g: 480, size: 6, col: '#ff8a50', col2: '#fff', ang: -Math.PI / 2, spread: 2.4, d: 0.46 });
    },
    spear_throw(k) { // the spear flies on a flame tail and sticks, leaving a burning rune where the next dive will land
      const len = k.enemy ? Math.min(560, k.dist) : 560, e = k.ahead(len);
      k.drg_lance({ x: k.x, y: k.y - 20, ang: k.ang, len, fly: 0.3, size: 1, col: CR, b: EM, hi: HI, life: 1.1, d: 0.04 });
      k.motes({ x: k.x, y: k.y - 20, n: 12, type: 'ember', spd: 120, g: 20, size: 4, col: FI, col2: EM, ang: k.ang, spread: 0.3, R0: len * 0.5, d: 0.06, life: 0.8 });
      k.burst({ x: e.x, y: e.y - 10, n: 9, len: 110, col: CR, hi: EM, d: 0.36, life: 0.45 }); k.ring({ x: e.x, y: e.y, R: 110, col: CR, d: 0.36 });
      k.spires({ x: e.x, y: e.y, n: 4, R: 50, h: 80, wd: 12, shape: 'flame', col: FI, hi: '#ff9a40', d: 0.36 });
      k.sigil({ x: e.x, y: e.y, R: 70, n: 4, col: FI, hi: EM, b: CR, d: 0.38, life: 2.6, hold: 0.88 });
    },
    dragons_roar(k) { // expanding red sound rings and a fire cone roll out, two flame serpents race down the aim, the screen edge shakes
      k.wave({ x: k.x, y: k.y - 20, ang: 0, arc: TAU, r: 330, n: 4, w: 10, col: CR, hi: '#ff8a8a', life: 0.95 });
      k.wave({ x: k.x, y: k.y - 20, ang: k.ang, arc: 1.5, r: 650, n: 4, w: 14, col: CR, hi: FI, d: 0.08, life: 1.0 });
      for (let i = 0; i < 2; i++) k.serpent({ x: k.x, y: k.y - 20, ang: k.ang + (i ? 0.22 : -0.22), len: 640, amp: 46, w: 13, col: FI, hi: FI, d: 0.1 + i * 0.1, life: 1.0 });
      k.ring({ R: 270, n: 2, w: 20, col: CR, d: 0.05 });
      k.motes({ x: k.x, y: k.y - 20, n: 22, type: 'ember', spd: 520, g: 60, size: 6, col: FI, col2: '#fff', ang: k.ang, spread: 1.2, d: 0.1, life: 1.2 });
      k.shake(0.9); k.flash(CR, 0.25);
    },
  },

  basic(k, ev) { // a short red thrust streak; the third drive adds a flame burst at the tip
    const p = k.ahead(16), heavy = ev.idx === 2, L = heavy ? 190 : 140;
    if (ev.idx === 1) k.arc({ x: k.x, y: k.y, a0: k.ang - 1.1, sw: 2.2, r: 96, w: 12, col: VI, hi: '#fff', d: 0.04, life: 0.3, sq: 0.9 });
    else k.streak({ x: p.x, y: p.y - 8, ang: k.ang, len: L, w: heavy ? 15 : 9, col: CR, hi: EM, d: 0.04, life: heavy ? 0.34 : 0.28 });
    if (heavy) { const e = k.ahead(150); k.burst({ x: e.x, y: e.y - 8, n: 7, len: 70, col: CR, hi: EM, d: 0.1, life: 0.3 }); k.motes({ x: e.x, y: e.y, n: 8, type: 'ember', spd: 260, g: 100, size: 5, col: FI, spread: 1.2, ang: k.ang, d: 0.1 }); }
  },

  ult(k) { // Dragon Form: wings of embers unfold, a seven-point sigil, a pillar and three rings as the dragon and lancer crash down
    k.wings({ x: k.x, y: k.y + 36, span: 240, col: CR, hi: EM, life: 1.5 });
    k.sigil({ R: 270, n: 7, col: CR, hi: EM, b: VI, d: 0.1, life: 2.3, hold: 0.8 });
    k.pillar({ h: 720, w: 34, col: CR, hi: EM, d: 0.35, life: 0.9 });
    k.ring({ R: 250, n: 3, w: 30, col: CR, d: 0.4 }); k.ring({ R: 350, n: 1, w: 22, col: VI, d: 0.5 });
    k.crack({ R: 260, n: 10, col: FI, hi: EM, d: 0.4 });
    k.spires({ n: 12, R: 230, h: 210, wd: 24, shape: 'flame', col: FI, hi: '#ff9a40', d: 0.4 });
    k.motes({ n: 40, type: 'ember', spd: 170, g: -110, size: 6, col: FI, col2: EM, ang: -Math.PI / 2, spread: 2.8, R0: 200, d: 0.2, life: 1.6 });
    k.kick(0.07); k.shake(1.0);
  },

  chains: {
    dragon_dive(k, s) { // 2-step: a red comet from the sky, a huge round shockwave and a ring of flame
      k.comet({ x: s.x, y: s.y, from: -Math.PI / 2 + 0.25, len: 760, size: 26, col: CR, hi: EM, impact: 230, d: 0.05, life: 0.8, hit: 0.55 });
      k.wings({ x: s.x, y: s.y - 20, span: 160, col: FI, hi: EM, d: 0.1, life: 0.6 });
      k.wave({ x: s.x, y: s.y - 10, ang: 0, arc: TAU, r: 270, n: 4, w: 20, col: CR, hi: EM, d: 0.49 });
      k.crack({ x: s.x, y: s.y, R: 220, n: 8, col: FI, hi: EM, d: 0.49 });
      k.spires({ x: s.x, y: s.y, n: 9, R: 170, h: 170, wd: 22, shape: 'flame', col: FI, hi: '#ff9a40', d: 0.49 });
    },
    impale_rush(k, s) { // 2-step: two lances driven into the same spot, leaving violet pins standing in the ground
      const a = angTo(k, s), d = Math.hypot(s.x - k.x, s.y - k.y);
      for (let i = 0; i < 2; i++) {
        k.streak({ x: k.x, y: k.y - 12, ang: a + (i ? 0.06 : -0.06), len: d + 130, w: 17, col: i ? VI : CR, hi: i ? SK : EM, d: i * 0.15, life: 0.4, ticks: 4 });
        k.burst({ x: s.x, y: s.y - 10, n: 8, len: 100, col: i ? VI : CR, hi: EM, rot: a, d: i * 0.15 + 0.1, life: 0.4 });
      }
      k.spires({ x: s.x, y: s.y, n: 6, R: 60, h: 130, wd: 10, shape: 'thorn', col: VI, hi: SK, d: 0.25 }); k.ring({ x: s.x, y: s.y, R: 120, col: CR, d: 0.25 });
    },
    spineshatter(k, s) { // 2-step: a spear pins the target, then the lancer falls onto it and the ground shatters into glowing slabs
      const a = angTo(k, s), d = Math.hypot(s.x - k.x, s.y - k.y);
      k.drg_lance({ x: k.x, y: k.y - 20, ang: a, len: d, fly: 0.3, size: 1, col: VI, b: SK, hi: '#fff', life: 1.0 });
      k.comet({ x: s.x, y: s.y, from: -Math.PI / 2, len: 620, size: 22, col: CR, hi: EM, impact: 190, d: 0.3, life: 0.75, hit: 0.5 });
      k.spires({ x: s.x, y: s.y, n: 9, R: 150, h: 130, wd: 28, shape: 'stone', col: FI, deep: DEEP, hi: EM, d: 0.68 });
      k.ring({ x: s.x, y: s.y, R: 190, n: 3, w: 24, col: CR, d: 0.68 }); k.motes({ x: s.x, y: s.y, n: 22, type: 'pix', spd: 400, g: 520, size: 6, col: '#ff8a50', col2: '#fff', ang: -Math.PI / 2, spread: 2.6, d: 0.68 });
    },
    high_jump(k, s) { // 2-step: a violet column carries the lancer out of sight, then a very long fall lands in a sigil of fire
      k.pillar({ x: k.x, y: k.y, h: 820, w: 20, col: VI, hi: SK, life: 0.7 }); k.flash({ x: k.x, y: k.y, R: 110, col: SK });
      for (let i = 0; i < 4; i++) k.streak({ x: k.x + (i - 1.5) * 20, y: k.y, ang: -Math.PI / 2, len: 400 + i * 40, w: 8, col: SK, hi: '#fff', d: i * 0.03, life: 0.45 });
      k.comet({ x: s.x, y: s.y, from: -1.35, len: 1100, size: 30, col: CR, hi: EM, impact: 260, d: 0.45, life: 0.9, hit: 0.6 });
      const t = 0.45 + 0.9 * 0.6;
      k.sigil({ x: s.x, y: s.y, R: 210, n: 5, col: CR, hi: EM, b: VI, d: t, life: 1.6, hold: 0.8 }); k.ring({ x: s.x, y: s.y, R: 240, n: 2, w: 28, col: CR, d: t });
      k.pillar({ x: s.x, y: s.y, h: 520, w: 30, col: CR, hi: EM, d: t, life: 0.7 });
    },
    tempest_spin(k, s) { // 3-step: a red cyclone and three arcs that pull inward, ending in an outward ring
      k.swirl({ x: s.x, y: s.y + 20, R: 190, h: 270, arms: 4, col: CR, hi: EM, spin: 10, w: 11, life: 1.1 });
      for (let i = 0; i < 3; i++) k.arc({ x: s.x, y: s.y, a0: s.a0 + i * 2.1, sw: -4.6, r: 210 - i * 45, w: 20, col: i === 1 ? VI : (i ? FI : CR), hi: i === 1 ? '#fff' : EM, d: i * 0.14, sq: 0.8 });
      k.ring({ x: s.x, y: s.y, R: 220, n: 2, col: CR, d: 0.45 }); k.motes({ x: s.x, y: s.y, n: 24, type: 'ember', spd: 230, g: -150, size: 5, col: FI, col2: EM, spread: TAU, ang: -Math.PI / 2, d: 0.1 });
    },
    nosedive_barrage(k, s) { // 3-step: three quick red hops in a row across the pack, each with its own ring and small fires
      for (let i = 0; i < 3; i++) {
        const ox = s.x + (i - 1) * 150, oy = s.y + (i % 2 ? 45 : -30), d = i * 0.2;
        k.comet({ x: ox, y: oy, from: -1.9 + i * 0.25, len: 600, size: 17, col: i === 1 ? FI : CR, hi: EM, impact: 135, d, life: 0.55, hit: 0.5 });
        k.ring({ x: ox, y: oy, R: 140, col: i === 1 ? FI : CR, d: d + 0.27 }); k.spires({ x: ox, y: oy, n: 4, R: 55, h: 100, wd: 14, shape: 'flame', col: FI, hi: '#ff9a40', d: d + 0.27 });
      }
      k.motes({ x: s.x, y: s.y, n: 20, type: 'pix', spd: 330, g: 480, size: 5, col: '#ff8a50', ang: -Math.PI / 2, spread: 2.4, d: 0.5 });
    },
    geirskogul(k, s) { // 3-step: a dragon beam fired from the sky down the aim, two flame serpents wrapped round it, rings along its length
      const L = 760, e = k.ahead(L);
      k.flash({ x: k.x, y: k.y - 20, R: 130, col: CR });
      k.beam({ x: k.x, y: k.y - 24, x2: e.x, y2: e.y - 24, w: 44, col: CR, hi: EM, d: 0.08, life: 0.8 });
      for (let i = 0; i < 2; i++) k.serpent({ x: k.x, y: k.y - 24, ang: k.ang, len: L, amp: i ? -42 : 42, w: 15, col: FI, hi: EM, d: 0.1 + i * 0.05, life: 0.9, speed: 12 });
      for (let i = 1; i <= 3; i++) { const q = k.ahead(L * i / 4); k.ring({ x: q.x, y: q.y, R: 110 + i * 12, col: CR, d: 0.1 + i * 0.07 }); }
      k.burst({ x: e.x, y: e.y - 24, n: 14, len: 200, col: CR, hi: EM, d: 0.22 }); k.motes({ x: e.x, y: e.y, n: 24, type: 'ember', spd: 400, g: 100, size: 6, col: FI, col2: '#fff', ang: k.ang, spread: 1.6, d: 0.2 });
    },
    whirling_lance(k, s) { // 4-step: a double spin round the lancer, then the spear is flung 380 px down the aim on a flame tail
      const e = k.ahead(380);
      k.arc({ x: k.x, y: k.y, a0: k.ang - 2.0, sw: 5.6, r: 160, w: 22, col: CR, hi: EM, d: 0.02, sq: 0.85 }); k.arc({ x: k.x, y: k.y, a0: k.ang + 2.2, sw: -5.0, r: 120, w: 12, col: VI, hi: '#fff', d: 0.06, sq: 0.85 });
      k.swirl({ x: k.x, y: k.y + 10, R: 150, h: 120, arms: 3, col: FI, hi: EM, spin: 14, w: 9, life: 0.6 }); k.ring({ R: 170, col: CR, d: 0.08 });
      k.drg_lance({ x: k.x, y: k.y - 20, ang: k.ang, len: 380, fly: 0.3, size: 1.35, col: CR, b: EM, hi: HI, d: 0.28, life: 1.0 });
      k.burst({ x: e.x, y: e.y - 10, n: 11, len: 150, col: CR, hi: EM, d: 0.58 }); k.ring({ x: e.x, y: e.y, R: 150, n: 2, col: CR, d: 0.58 });
      k.motes({ x: e.x, y: e.y, n: 20, type: 'ember', spd: 360, g: 120, size: 6, col: FI, col2: '#fff', spread: TAU, d: 0.58 });
    },
    wyrmfire_volley(k, s) { // 4-step: a rain of small ember comets across the target area, each pooling into a licking flame
      for (let i = 0; i < 9; i++) {
        const u = i / 8 - 0.5, ox = s.x + u * 360 + ((i * 53) % 40 - 20), oy = s.y + (((i * 37) % 100) - 50) * 0.9, d = i * 0.07;
        k.comet({ x: ox, y: oy, from: -2.2 + (i % 3) * 0.28, len: 700, size: 11, col: i % 2 ? FI : EM, hi: HI, impact: 85, d, life: 0.55, hit: 0.55 });
        if (i % 2 === 0) k.spires({ x: ox, y: oy, n: 3, R: 30, h: 90, wd: 12, shape: 'flame', col: FI, hi: '#ff9a40', d: d + 0.3 });
      }
      k.motes({ x: s.x, y: s.y, n: 26, type: 'ember', spd: 180, g: -130, size: 5, col: FI, col2: EM, ang: -Math.PI / 2, spread: 2.4, R0: 150, d: 0.3, life: 1.3 });
      k.flash({ x: s.x, y: s.y, R: 220, col: FI, d: 0.7 });
    },
    crimson_comet(k, s) { // 4-step: one huge flaming spear falls from the sky onto the target: flash, starburst, sigil, spires
      const an = -1.95, L = 1000;
      k.drg_lance({ x: s.x - Math.cos(an) * L, y: s.y - Math.sin(an) * L, ang: an + Math.PI, len: L, fly: 0.55, size: 2.4, col: CR, b: EM, hi: HI, d: 0.02, life: 1.3 });
      const t = 0.02 + 1.3 * 0.55 * 0.62 + 0.1;
      k.flash({ x: s.x, y: s.y, R: 320, col: CR, d: t }); k.burst({ x: s.x, y: s.y - 10, n: 16, len: 330, col: CR, hi: EM, d: t });
      k.sigil({ x: s.x, y: s.y, R: 240, n: 6, col: CR, hi: EM, b: VI, d: t, life: 2.0, hold: 0.8 }); k.crack({ x: s.x, y: s.y, R: 250, n: 9, col: FI, hi: EM, d: t });
      k.spires({ x: s.x, y: s.y, n: 11, R: 200, h: 230, wd: 26, shape: 'flame', col: FI, hi: '#ff9a40', d: t }); k.ring({ x: s.x, y: s.y, R: 280, n: 3, w: 28, col: CR, d: t });
    },
    searing_cyclone(k, s) { // 5-step: two fire tornadoes turning against each other, flame serpents spiralling in, a ring of flame spires
      k.swirl({ x: s.x, y: s.y + 24, R: 240, h: 380, arms: 4, col: CR, hi: EM, spin: 9, w: 14, life: 1.3 });
      k.swirl({ x: s.x, y: s.y + 24, R: 170, h: 330, arms: 3, col: FI, hi: '#fff', spin: 12, dir: -1, w: 10, life: 1.2, d: 0.05 });
      for (let i = 0; i < 3; i++) { const a = s.a0 + i / 3 * TAU; k.serpent({ x: s.x - Math.cos(a) * 300, y: s.y - Math.sin(a) * 160, ang: a, len: 300, amp: 40, w: 15, col: FI, hi: EM, d: 0.1 + i * 0.08 }); }
      k.spires({ x: s.x, y: s.y, n: 12, R: 270, h: 230, wd: 24, shape: 'flame', col: FI, hi: '#ff9a40', d: 0.2 });
      k.ring({ x: s.x, y: s.y, R: 300, n: 3, w: 26, col: CR, d: 0.15 }); k.motes({ x: s.x, y: s.y, n: 34, type: 'ember', spd: 220, g: -170, size: 6, col: FI, col2: EM, spread: TAU, ang: -Math.PI / 2, d: 0.1, life: 1.5 });
    },
    dragonfang_lance(k, s) { // 5-step: two giant lances close on the target like fangs from either side, a dark bite rift and a violet-red sigil
      const L = 720;
      for (let i = 0; i < 2; i++) { const an = i ? Math.PI - 0.78 : 0.78; k.drg_lance({ x: s.x - Math.cos(an) * L, y: s.y - Math.sin(an) * L, ang: an, len: L, fly: 0.38, size: 2.2, col: i ? VI : CR, b: i ? SK : EM, hi: HI, d: 0.02 + i * 0.06, life: 1.3 }); }
      const t = 0.5;
      k.rift({ x: s.x, y: s.y, R: 190, ang: 0.2, tall: 0.5, col: CR, hi: EM, deep: DEEP, d: t - 0.04, life: 1.2 });
      k.sigil({ x: s.x, y: s.y, R: 250, n: 5, col: CR, hi: EM, b: VI, d: t, life: 2.1, hold: 0.8 }); k.pillar({ x: s.x, y: s.y, h: 640, w: 30, col: VI, hi: SK, d: t, life: 0.9 });
      k.burst({ x: s.x, y: s.y - 10, n: 14, len: 280, col: CR, hi: EM, d: t }); k.ring({ x: s.x, y: s.y, R: 260, n: 3, w: 26, col: CR, d: t });
    },
    wyrmstorm(k, s) { // route: a wide ring of fire comets rains down, flame serpents circle, then one huge crash with a pillar and an eight-point sigil
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * TAU + s.a0, rr = 150 + (i % 3) * 90, ox = s.x + Math.cos(a) * rr * 1.3, oy = s.y + Math.sin(a) * rr * 0.65, d = i * 0.08;
        k.comet({ x: ox, y: oy, from: -2.0 + (i % 4) * 0.2, len: 760, size: 16, col: i % 2 ? FI : CR, hi: EM, impact: 120, d, life: 0.6, hit: 0.55 });
        k.spires({ x: ox, y: oy, n: 3, R: 40, h: 110, wd: 14, shape: 'flame', col: FI, hi: '#ff9a40', d: d + 0.33, opt: i % 2 === 1 });
      }
      for (let i = 0; i < 3; i++) { const a = s.a0 + i / 3 * TAU; k.serpent({ x: s.x + Math.cos(a) * 340, y: s.y + Math.sin(a) * 180, ang: a + Math.PI, len: 340, amp: 50, w: 17, col: FI, hi: EM, d: 0.15 + i * 0.1, life: 1.1 }); }
      const t = 1.0;
      k.sigil({ x: s.x, y: s.y, R: 330, n: 8, col: CR, hi: EM, b: VI, d: t, life: 2.2, hold: 0.8 }); k.pillar({ x: s.x, y: s.y, h: 760, w: 44, col: CR, hi: EM, d: t, life: 1.0 });
      k.ring({ x: s.x, y: s.y, R: 340, n: 3, w: 30, col: CR, d: t }); k.crack({ x: s.x, y: s.y, R: 300, n: 10, col: FI, hi: EM, d: t });
      k.spires({ x: s.x, y: s.y, n: 14, R: 290, h: 260, wd: 26, shape: 'flame', col: FI, hi: '#ff9a40', d: t });
    },
    nidhoggs_fall(k, s) { // route (light; the engine adds its own giant dragon): a nine-point crimson sigil, a standing pillar and a ring of ember spires under the impact
      k.sigil({ x: s.x, y: s.y, R: 280, n: 9, col: CR, hi: EM, b: VI, d: 0.4, life: 2.4, hold: 0.8 }); k.pillar({ x: s.x, y: s.y, h: 760, w: 40, col: CR, hi: EM, d: 0.55, life: 0.9 });
      k.ring({ x: s.x, y: s.y, R: 300, n: 3, w: 28, col: CR, d: 0.55 });
      k.spires({ x: s.x, y: s.y, n: 10, R: 250, h: 220, wd: 24, shape: 'flame', col: FI, hi: '#ff9a40', d: 0.55 });
    },
  },

  routes: {
    wyrmstorm: { title: 'WYRMSTORM', sub: 'THE SKY RAINS FIRE  ·  PACK FINISHER', sfx: 'ゴゴゴゴッ', kanji: '嵐', rot: -0.08 },
    nidhoggs_fall: { title: "NIDHOGG'S FALL", sub: 'THE WYRM DESCENDS  ·  BOSS FINISHER', sfx: 'ドォォォン', kanji: '竜', rot: 0.08 },
  },

  notes: {
    piercing_thrust: 'A long red lance of light pierces forward with a thin violet needle inside it, a fan of shock rings runs ahead of it and embers spray from the tip.',
    sweeping_arc: 'A wide crimson blade and a tighter violet one spin round the dragoon in a flat circle, with a ring of embers and a ground ring thrown out.',
    jump: 'Three pale trails shoot skyward at takeoff; the dragoon falls back as a red comet and lands in a cracked crater ringed by flame spires.',
    spear_throw: 'The spear flies on a flame tail, bursts at the target and leaves a small burning rune that marks the next dive.',
    dragons_roar: 'Red sound rings spread out from the dragoon, a fire cone and two flame serpents roar down the aim, and the whole screen shakes.',
    dragon_form: 'Wings of embers unfold behind the dragoon, a seven-point sigil spreads on the floor and a pillar of fire and three rings mark the crash.',
    basic: 'Each swing leaves a short red thrust streak or a violet arc; the third drive adds a small flame burst at the tip.',
    dragon_dive: 'A huge red comet drops from the sky on ember wings and lands in a round shockwave with a ring of flame spires.',
    impale_rush: 'Two lances, one red and one violet, drive into the same spot and leave violet pins standing in the ground.',
    spineshatter: 'A violet spear pins the target, then the dragoon falls onto it and the ground bursts into glowing slabs of rock.',
    high_jump: 'A violet column lifts the dragoon out of sight, then a very long red fall lands in a burning sigil with a pillar of fire.',
    tempest_spin: 'A red cyclone rises while three coloured arcs spin inward, then a ring of force is thrown back out.',
    nosedive_barrage: 'Three red comets hop one after another across the pack, each with its own ring and small flames.',
    geirskogul: 'A thick red dragon beam fires down the aim with two flame serpents wrapped around it and shock rings along its length.',
    whirling_lance: 'A double spin circles the dragoon, then a big flaming spear is hurled straight ahead and bursts at the end.',
    wyrmfire_volley: 'Nine small ember comets rain over the target area, each landing in a short tongue of flame.',
    crimson_comet: 'One giant flaming spear falls from the sky and lands in a white flash, a starburst, a sigil and a ring of flame spires.',
    searing_cyclone: 'Two fire tornadoes turn against each other while flame serpents spiral in and a ring of flame spires rises around them.',
    dragonfang_lance: 'Two giant lances close in from either side like fangs, a dark bite opens at the target and a violet and red sigil spreads.',
    wyrmstorm: 'Pack finisher: ten fire comets rain in a wide ring while flame serpents circle, then one huge crash with a pillar and an eight-point sigil.',
    nidhoggs_fall: 'Boss finisher: a nine-point crimson sigil, a pillar of fire and a ring of flame spires sit under the engine\'s falling dragon.',
  },
};
