// Warrior (Weapon Master): every weapon keeps its colour (Greatsword sky blue, Twin Axes blood red, Warhammer gold); effects are heavy, ringing and metallic:
// big arcs, forge sparks, cracked ground, planted banners. Chains read as the weapons "stacking" their colours.
import { TAU } from './fxsk_core.js';
const G = { a: '#5ec8ff', hi: '#e8f8ff' }, A = { a: '#ff4d5e', hi: '#ffd8dc' }, H = { a: '#ffb52e', hi: '#fff3c0' };
const W = { G, A, H };
export default {
  pal: { a: '#ff6b4a', b: '#ffc93b', hi: '#fff1d6', deep: '#2a1208', ink: '#160a04', edge: '#ffb08a' },
  skills: {
    gs_cleave(k) { // a 300-degree cleave: two nested blue blades, a ground ring and a spray of cold sparks
      k.arc({ x: k.x, y: k.y, a0: k.ang - 2.6, sw: 5.2, r: 150, w: 28, col: G.a, hi: G.hi, d: 0.08, sq: 0.9 });
      k.arc({ x: k.x, y: k.y, a0: k.ang - 2.3, sw: 4.7, r: 112, w: 14, col: G.a, hi: '#fff', d: 0.13, sq: 0.9 });
      k.ring({ x: k.x, y: k.y, R: 175, col: G.a, d: 0.1 });
      k.motes({ x: k.x, y: k.y, n: 26, type: 'spark', spd: 380, size: 7, col: G.a, col2: '#fff', spread: TAU, d: 0.1, g: 200 });
      k.shake(0.25);
    },
    ax_flurry(k) { // five red cuts stepping forward, blood droplets flying off
      for (let i = 0; i < 5; i++) { const p = k.ahead(30 + i * 34, (i % 2 ? 1 : -1) * 14), an = k.ang + (i % 2 ? 0.7 : -0.7) * (1 - i * 0.08); k.streak({ x: p.x - Math.cos(an) * 70, y: p.y - Math.sin(an) * 70, ang: an, len: 150, w: 11, col: A.a, hi: A.hi, d: 0.04 + i * 0.075, life: 0.32, ticks: 4 }); k.motes({ x: p.x + Math.cos(k.ang) * 60, y: p.y, n: 7, type: 'ember', spd: 240, g: 420, size: 5, col: A.a, col2: '#fff', spread: 1.6, ang: k.ang, d: 0.08 + i * 0.075, life: 0.8 }); }
      k.flash({ x: k.ahead(190).x, y: k.ahead(190).y, R: 90, col: A.a, d: 0.45 });
    },
    hm_skull(k) { // an overhead crush: golden shock rings, a cracked floor, flying stone chips
      const p = k.ahead(105); k.comet({ x: p.x, y: p.y, from: -Math.PI / 2, len: 360, size: 22, col: H.a, hi: H.hi, impact: 120, d: 0.05, life: 0.65, hit: 0.5 });
      k.ring({ x: p.x, y: p.y, R: 200, n: 3, w: 30, col: H.a, d: 0.32 }); k.crack({ x: p.x, y: p.y, R: 170, n: 8, col: H.a, hi: H.hi, d: 0.32 });
      k.spires({ x: p.x, y: p.y, n: 7, R: 130, h: 90, wd: 24, shape: 'stone', col: H.a, deep: '#3a2a14', hi: H.hi, d: 0.32 }); k.motes({ x: p.x, y: p.y, n: 24, type: 'pix', spd: 380, g: 520, size: 6, col: '#ffcf60', ang: -Math.PI / 2, spread: 2.4, d: 0.34 }); k.shake(0.55);
    },
    arsenal_toss(k) { // the weapon spins out on a bright streak and plants itself with a standing beacon
      k.streak({ x: k.x, y: k.y - 14, ang: Math.atan2(k.ty - k.y, k.tx - k.x), len: k.dist, w: 12, col: '#e8f0ff', hi: '#fff', d: 0.04, life: 0.35, bend: 18, ticks: 3 });
      k.sigil({ x: k.tx, y: k.ty, R: 130, n: 6, col: '#cfe0ff', hi: '#fff', b: H.a, d: 0.3, life: 2.4, hold: 0.9 }); k.pillar({ x: k.tx, y: k.ty, h: 260, w: 12, col: '#cfe0ff', hi: '#fff', d: 0.3, life: 1.0 });
      k.ring({ x: k.tx, y: k.ty, R: 130, col: '#cfe0ff', d: 0.3 }); k.motes({ x: k.tx, y: k.ty, n: 16, type: 'spark', spd: 300, size: 6, col: '#fff', spread: TAU, g: 300, d: 0.3 });
    },
    warlords_decree(k) { // a crimson war-banner field: pillars of red light, sigil, rising embers
      k.sigil({ x: k.x, y: k.y, R: 230, n: 6, col: '#ff6b4a', hi: '#fff1d6', b: '#ffc93b', life: 1.6 });
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; k.pillar({ x: k.x + Math.cos(a) * 170, y: k.y + Math.sin(a) * 100, h: 380, w: 14, col: '#ff6b4a', hi: '#ffd8b0', d: 0.12 + i * 0.07, life: 0.9 }); }
      k.motes({ x: k.x, y: k.y, n: 30, type: 'ember', spd: 150, g: -140, size: 6, col: '#ff8a4a', col2: '#ffe9a0', ang: -Math.PI / 2, spread: 2.6, R0: 180 }); k.burst({ x: k.x, y: k.y - 20, n: 12, len: 230, col: '#ff6b4a', d: 0.1 }); k.shake(0.3);
    },
  },
  basic(k, ev) { const c = W[ev.w] || G, heavy = ev.idx === 2; k.arc({ x: k.x, y: k.y, a0: k.ang + (ev.idx % 2 ? 1.2 : -1.2), sw: (ev.idx % 2 ? -1 : 1) * (heavy ? 2.8 : 2.2), r: heavy ? 118 : 92, w: heavy ? 22 : 13, col: c.a, hi: c.hi, d: 0.04, life: 0.34, sq: 0.9 }); if (heavy) { const p = k.ahead(110); k.ring({ x: p.x, y: p.y, R: 110, col: c.a, d: 0.12 }); k.motes({ x: p.x, y: p.y, n: 10, type: 'spark', spd: 300, size: 5, col: c.a, spread: TAU, d: 0.12, g: 300 }); } },
  ult(k) { // Warlord's Trinity: the leap lands with three rings of three weapon colours, a trinity sigil and a cratered floor
    const x = k.tx, y = k.ty;
    k.sigil({ x, y, R: 250, n: 3, col: '#ffc93b', hi: '#fff', b: '#ff4d5e', d: 0.25, life: 2.0, hold: 0.8 });
    [G, A, H].forEach((c, i) => { k.ring({ x, y, R: 190 + i * 70, n: 2, w: 28, col: c.a, d: 0.4 + i * 0.12 }); k.burst({ x, y: y - 10, n: 10, len: 200 + i * 40, col: c.a, hi: c.hi, rot: i, d: 0.4 + i * 0.12 }); });
    k.crack({ x, y, R: 240, n: 10, col: H.a, hi: '#fff', d: 0.4 }); k.motes({ x, y, n: 40, type: 'pix', spd: 460, g: 500, size: 7, col: '#ffcf60', col2: '#fff', ang: -Math.PI / 2, spread: 2.8, d: 0.42 }); k.kick(0.07); k.shake(1.0);
  },
  chains: {
    rift_cleave(k, s) { k.rift({ x: s.x, y: s.y, R: 170 * s.sc / 1.25, ang: 0.3, tall: 0.6, col: G.a, hi: G.hi, deep: '#04121e' }); for (let i = 0; i < 2; i++) k.arc({ x: s.x, y: s.y, a0: s.a0 + i * 3.1, sw: 3.2, r: 130 + i * 30, w: 24, col: G.a, hi: '#fff', d: 0.14 + i * 0.08, sq: 0.8 }); k.motes({ x: s.x, y: s.y, n: 20, type: 'spark', spd: 380, size: 6, col: G.a, spread: TAU, d: 0.15 }); },
    cyclone_cleave: { themes: ['cyclone', 'blades'] },
    seismic_arc: { themes: ['earth'], sc: 1.1 },
    thunder_hurl: { themes: ['storm', 'blades'] },
    earthshatter_recall: { themes: ['earth', 'hammer'] },
    warlords_rally: { themes: ['ward', 'star'] },
    executioners_verdict: { themes: ['execution', 'hammer'] },
    reavers_return: { themes: ['stampede', 'blades'] },
    red_banner_tempest(k, s) { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + s.a0; k.pillar({ x: s.x + Math.cos(a) * 190 * s.sc / 1.5, y: s.y + Math.sin(a) * 110 * s.sc / 1.5, h: 420, w: 14, col: '#ff4d5e', hi: '#ffd8dc', d: i * 0.06, life: 1.0 }); } k.swirl({ x: s.x, y: s.y + 20, R: 150, h: 300, arms: 4, col: '#ff4d5e', hi: '#ffd8dc', spin: 8, w: 12, life: 1.2 }); k.motes({ x: s.x, y: s.y, n: 30, type: 'ember', spd: 200, g: -160, size: 6, col: '#ff6b4a', spread: TAU, ang: -Math.PI / 2 }); },
    headsmans_oath: { themes: ['execution', 'judgement'] },
    banner_cleave(k, s) { k.pillar({ x: s.x, y: s.y, h: 520, w: 24, col: '#ff6b4a', hi: '#fff1d6', life: 1.0 }); k.swirl({ x: s.x, y: s.y + 20, R: 190, h: 220, arms: 3, col: '#5ec8ff', hi: '#fff', spin: 10, w: 14 }); for (let i = 0; i < 3; i++) k.arc({ x: s.x, y: s.y, a0: s.a0 + i * 2.1, sw: 4.2, r: 150 + i * 30, w: 24, col: [G, A, H][i].a, hi: '#fff', d: 0.1 + i * 0.08, sq: 0.85 }); },
    decree_of_ruin: { themes: ['hammer', 'judgement', 'comet'] },
  },
  routes: {
    crimson_tempest: { title: 'CRIMSON TEMPEST', sub: 'THE BANNER FALLS  ·  PACK FINISHER', sfx: 'ゴゴゴッ', rot: -0.1 },
    titanfall: { title: 'TITANFALL EXECUTION', sub: 'THE WARLORD LANDS  ·  BOSS FINISHER', sfx: 'ドォォン', rot: 0.08 },
  },
  notes: {
    gs_cleave: 'Two nested sky-blue blades sweep the full 300 degrees, a cold ground ring and a spray of sparks follow the edge.',
    ax_flurry: 'Five blood-red cuts step forward with the flurry, each one throwing droplets; a red flash marks the end of the string.',
    hm_skull: 'A golden meteor of hammer falls on the strike point: triple shock ring, cracked floor, stone chips and a heavy camera shake.',
    arsenal_toss: 'The weapon rides a bright streak and lands in a standing rune circle with a beam, so you can see where it is planted for its 6 seconds.',
    warlords_decree: 'A crimson war-banner field: a six-point sigil, four pillars of red light and rising embers.',
    warlord: 'The leap lands with three coloured rings (blade, axe, hammer), a three-point trinity sigil, cracked floor and pixel debris.',
    basic: 'Each swing leaves a short arc in the drawn weapon\'s colour; the third swing adds a ground ring and sparks.',
    crimson_tempest: 'Pack finisher: five red banner pillars around a crimson cyclone, then the full finisher moment.',
    titanfall: 'Boss finisher: an execution rift and a verdict hammer, then the full finisher moment.',
  },
};
