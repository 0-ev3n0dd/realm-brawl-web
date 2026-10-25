// Chains v2: per-class basic-attack (LMB combo) effects. Driven by the sim's 'swing' (melee) and 'shoot' (ranged) events;
// purely visual (damage / timing unchanged). Each class gets its own swing shapes, trails, impacts and a bigger
// finisher on the combo's last hit (ev.heavy: the 3rd swing; the Ninja's 5th):
//   Warrior   - swings the last-drawn weapon: Greatsword wide blue arcs, Axe twin red chops, Hammer gold overhead + quake
//   Ninja     - dagger flickers: thin pink/violet cuts with shadow afterimages, a crossing X + shadow burst finisher
//   Ranger    - quick-shot arrows: a green wind streak along the shot, a bow-string ring, a triple-streak finisher
//   Mage      - arcane bolts: a violet rune at the hand + a bolt streak, a rune-circle burst finisher
//   Paladin   - holy hammer arcs: heavy gold arcs with a glow, a hammer-down light pillar finisher
//   Samurai   - ink slash draws: black-ink brush arcs with pink wash + petals, a straight iai ink cut finisher
//   Monk      - jab / cross / palm: gold speed streaks, the palm finisher a spirit-palm ring
//   Dragoon   - thrust / sweep / lunge: a crimson spear line, a violet sweep arc, a long lunge line with a wyrm burst
// Uses existing particle types: slash, spline (fxspec), ink / petal (fxsam), mstreak (fxmonk), ghost, flash, glow, rays, pillar, shard.
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const lite = (fx) => fx.partMul !== undefined && fx.partMul < 1;
const N = (fx, n) => Math.max(1, Math.round(n * (fx.partMul ?? 1)));
export const BASIC_COL = {
  warrior: { G: '#5ec8ff', A: '#ff4d5e', H: '#ffb52e', hi: '#fff4d6' },
  bladedancer: { a: '#b28cff', b: '#ff8ad8', hi: '#f5ecff' },
  ranger: { a: '#9dff8a', b: '#7af0ff', hi: '#f4fff0' },
  mage: { a: '#b69cff', b: '#7a5cff', hi: '#f0e8ff' },
  cleric: { a: '#ffd23f', b: '#fff0a0', hi: '#ffffff' },
  samurai: { a: '#ff8cc6', b: '#dfe8ff', hi: '#fff3fa', ink: '#170d1f' },
  monk: { a: '#ffc24a', b: '#ff8a1e', hi: '#fffaf0' },
  dragoon: { a: '#ff3048', b: '#9a6bff', hi: '#fff1e0' },
  summoner: { a: '#3ff0c8', b: '#a98bff', hi: '#e6fff8' },
  bard: { a: '#ff7ab8', b: '#ffd86a', hi: '#fff6e8' },
};
const at = (ev, d, da = 0) => ({ x: ev.x + Math.cos(ev.ang + da) * d, y: ev.y + Math.sin(ev.ang + da) * d });
const glow = (fx, x, y, size, color, life = 0.25, a = 0.7) => { if (!lite(fx)) fx.add({ type: 'glow', x, y, size, color, life, a }); };
const line = (fx, x, y, ang, len, w, color, core = '#ffffff', life = 0.22) => fx.add({ type: 'spline', x, y, ang, len, w, color, core, life, lite: lite(fx) });
const slash = (fx, ev, o) => fx.add({ type: 'slash', x: ev.x, y: ev.y, ang: ev.ang, arc: Math.min(ev.arc || 2, TAU), r: ev.range || 90, life: 0.16, width: 14, dir: 1, ...o });
const rays = (fx, x, y, r, color, n = 10, life = 0.3, w = 5) => fx.add({ type: 'rays', x, y, r, color, n: Math.max(6, N(fx, n)), life, w, seed: rnd(0, TAU) });
const shards = (fx, x, y, n, c1, c2, v = 420) => { for (let i = 0; i < N(fx, n); i++) { const a = rnd(0, TAU), s = rnd(v * 0.6, v); fx.add({ type: 'shard', x, y, ang: a, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: rnd(6, 10), color: i % 2 ? c1 : c2, edge: '#ffffff', drag: 0.88, life: rnd(0.3, 0.5) }); } };
const streak = (fx, x, y, ang, len, w, color, life = 0.2) => { for (const [o, ww, l] of [[0, w, 1], [w * 0.9, w * 0.45, 0.7], [-w * 0.9, w * 0.45, 0.75]]) fx.add({ type: 'mstreak', x: x - Math.sin(ang) * o, y: y + Math.cos(ang) * o, ang, len: len * l, w: ww, color, life, lite: lite(fx), drag: 1 }); };

const MELEE = {
  warrior(fx, ev, me) { // the last-drawn weapon
    const w = ev.w || 'G', C = BASIC_COL.warrior, col = C[w] || C.G, fin = ev.heavy, R = ev.range || 100;
    if (w === 'A') { // Axe: two fast crossing chops
      for (const s of [1, -1]) slash(fx, ev, { ang: ev.ang + s * 0.25, arc: Math.min(ev.arc || 1.8, 2) * 0.8, color: s > 0 ? col : C.hi, width: 11, life: 0.14, dir: s * (ev.idx === 1 ? -1 : 1) });
      const p = at(ev, R * 0.7); fx.sparks(p.x, p.y, ev.ang, N(fx, fin ? 12 : 6), col, 420, 1.2);
    } else if (w === 'H') { // Hammer: a heavy overhead arc + dust
      slash(fx, ev, { color: col, width: fin ? 30 : 22, life: 0.24, dir: ev.idx === 1 ? -1 : 1 });
      const p = at(ev, R * 0.75); fx.puffs(p.x, p.y, N(fx, fin ? 10 : 4), 'rgba(230,200,150,.85)', 12, 120, 0.4);
    } else { // Greatsword: a wide, clean arc with a white core
      slash(fx, ev, { color: col, width: fin ? 24 : 18, life: 0.2, arc: Math.min((ev.arc || 2) * 1.1, TAU), dir: ev.idx === 1 ? -1 : 1 });
      slash(fx, ev, { color: C.hi, width: 6, life: 0.15, r: R * 0.85, dir: ev.idx === 1 ? -1 : 1 });
    }
    if (fin) { const p = at(ev, R * 0.7); fx.add({ type: 'flash', x: p.x, y: p.y, life: 0.12, size: 90, color: C.hi }); fx.ring(p.x, p.y, w === 'H' ? 110 : 80, col, 0.3, 8); rays(fx, p.x, p.y, 110, col, 10, 0.3, 5); if (w === 'H') fx.add({ type: 'crack', x: p.x, y: p.y, r: 60, life: 0.8, seed: rnd(0, TAU), glow: true }); if (me) fx.shake(w === 'H' ? 0.22 : 0.14); }
  },
  bladedancer(fx, ev, me) { // dagger flickers with afterimages
    const C = BASIC_COL.bladedancer, fin = ev.heavy, R = ev.range || 80, side = ev.idx % 2 ? -1 : 1;
    slash(fx, ev, { ang: ev.ang + side * 0.2, arc: Math.min(ev.arc || 1.6, 1.8), color: side > 0 ? C.b : C.a, width: 8, life: 0.12, dir: side });
    const back = at(ev, -18, side * 0.9); fx.add({ type: 'ghost', x: back.x, y: back.y, ang: ev.ang, life: 0.22 }); // the afterimage left behind
    const p = at(ev, R * 0.7); fx.sparks(p.x, p.y, ev.ang, N(fx, 4), C.hi, 380, 0.6);
    if (fin) { fx.add({ type: 'spcross', x: p.x, y: p.y, r: 46, color: C.b, life: 0.26, ang: ev.ang, lite: lite(fx) }); fx.puffs(p.x, p.y, N(fx, 8), 'rgba(60,30,100,.8)', 18, 160, 0.5); for (const s of [1, -1]) { const g = at(ev, 34, s * 1.6); fx.add({ type: 'ghost', x: g.x, y: g.y, ang: ev.ang, life: 0.3 }); } if (me) fx.shake(0.12); }
  },
  cleric(fx, ev, me) { // holy hammer arcs
    const C = BASIC_COL.cleric, fin = ev.heavy, R = ev.range || 95, dir = ev.idx === 1 ? -1 : 1;
    slash(fx, ev, { color: C.a, width: fin ? 26 : 20, life: 0.22, dir });
    slash(fx, ev, { color: C.hi, width: 6, life: 0.16, r: R * 0.8, dir });
    const p = at(ev, R * 0.7); glow(fx, p.x, p.y, 70, C.a, 0.22, 0.6);
    if (fin) { fx.add({ type: 'pillar', x: p.x, y: p.y, size: 50, color: C.a, life: 0.4, h: 420, lite: lite(fx) }); fx.ring(p.x, p.y, 90, C.b, 0.3, 7); rays(fx, p.x, p.y, 110, C.hi, 12, 0.3, 5); if (me) fx.shake(0.16); }
  },
  samurai(fx, ev, me) { // ink slash draws
    const C = BASIC_COL.samurai, fin = ev.heavy, R = ev.range || 95, dir = ev.idx === 1 ? -1 : 1;
    if (!fin) fx.add({ type: 'ink', mode: 'arc', x: ev.x, y: ev.y, ang: ev.ang, arc: Math.min(ev.arc || 2, 2.6), r: R * 0.85, w: 16, color: C.a, hi: C.hi, life: 0.36, dir, seed: rnd(0, 99), lite: lite(fx), drag: 1 });
    else { const s = at(ev, -20); fx.add({ type: 'ink', mode: 'line', x: s.x, y: s.y, ang: ev.ang, len: R * 1.4, w: 20, color: C.a, hi: C.hi, life: 0.45, seed: rnd(0, 99), lite: lite(fx), drag: 1 }); line(fx, s.x, s.y, ev.ang, R * 1.4, 10, C.b, '#ffffff', 0.25); if (me) fx.shake(0.14); }
    const p = at(ev, R * 0.7);
    for (let i = 0; i < N(fx, fin ? 8 : 3); i++) { const a = rnd(0, TAU), v = rnd(40, 140); fx.add({ type: 'petal', x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: rnd(0.7, 1.2), size: rnd(4, 7), color: Math.random() < 0.5 ? '#ffc2e0' : C.a, rot: rnd(0, TAU), vr: rnd(-7, 7), drag: 0.96, seed: rnd(0, 99) }); }
  },
  monk(fx, ev, me) { // jab - cross - palm
    const C = BASIC_COL.monk, R = ev.range || 85, fin = ev.heavy, off = ev.idx === 0 ? 10 : ev.idx === 1 ? -10 : 0;
    const s = { x: ev.x - Math.sin(ev.ang) * off, y: ev.y + Math.cos(ev.ang) * off }, p = at(ev, R * 0.8);
    streak(fx, s.x, s.y, ev.ang, R * (fin ? 1.1 : 0.9), fin ? 12 : 8, ev.idx === 1 ? C.b : C.a, 0.18);
    fx.add({ type: 'flash', x: p.x, y: p.y, life: 0.08, size: fin ? 70 : 40, color: C.hi });
    if (fin) { fx.ring(p.x, p.y, 70, C.a, 0.26, 7); fx.ring(p.x, p.y, 46, C.hi, 0.2, 4); fx.sparks(p.x, p.y, ev.ang, N(fx, 9), C.b, 460, 0.9); if (me) fx.shake(0.14); }
    else fx.sparks(p.x, p.y, ev.ang, N(fx, 3), C.b, 380, 0.6);
  },
  dragoon(fx, ev, me) { // thrust - sweep - lunge
    const C = BASIC_COL.dragoon, R = ev.range || 110, fin = ev.heavy;
    if (ev.idx === 1 && !fin) { slash(fx, ev, { color: C.b, width: 16, life: 0.18, arc: Math.min((ev.arc || 2) * 1.05, TAU), dir: -1 }); slash(fx, ev, { color: C.hi, width: 5, life: 0.14, r: R * 0.85, dir: -1 }); }
    else { line(fx, ev.x, ev.y, ev.ang, R * (fin ? 1.35 : 1.05), fin ? 22 : 14, C.a, C.hi, fin ? 0.3 : 0.2); }
    const p = at(ev, R * (fin ? 1.1 : 0.85));
    fx.sparks(p.x, p.y, ev.ang, N(fx, fin ? 10 : 4), fin ? C.a : C.b, 440, 0.7);
    if (fin) { fx.add({ type: 'flash', x: p.x, y: p.y, life: 0.12, size: 80, color: C.hi }); fx.ring(p.x, p.y, 80, C.b, 0.3, 7); rays(fx, p.x, p.y, 100, C.a, 10, 0.3, 5); if (me) fx.shake(0.15); }
  },
};
const RANGED = {
  summoner(fx, ev, me) { // ink-bolt pages: a rune flare at the grimoire, a teal streak, a page mote; the finisher fans 3
    const C = BASIC_COL.summoner, fin = ev.heavy, s = at(ev, 24);
    glow(fx, s.x, s.y, fin ? 84 : 52, C.a, 0.2, 0.75);
    fx.ring(s.x, s.y, fin ? 30 : 18, C.a, 0.18, 3);
    for (const da of fin ? [-0.12, 0, 0.12] : [0]) line(fx, s.x, s.y, ev.ang + da, fin ? 240 : 170, fin ? 11 : 8, da ? C.b : C.a, C.hi, 0.18);
    if (!lite(fx)) for (let i = 0; i < (fin ? 4 : 2); i++) { const a = ev.ang + (Math.random() - 0.5) * 1.4, sp = 90 + Math.random() * 90; fx.add({ type: 'mote', shape: i % 2 ? 'rune' : 'page', x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, drag: 0.9, life: 0.5, size: 5, color: i % 2 ? C.a : '#fff8e6', rot: Math.random() * TAU, spin: 4, grow: true }); }
    if (fin && me) fx.shake(0.06);
  },
  bard(fx, ev, me) { // lute notes: a sound ring at the lute, a pink note streak, a floating note; the finisher strums a chord
    const C = BASIC_COL.bard, fin = ev.heavy, s = at(ev, 22);
    glow(fx, s.x, s.y, fin ? 80 : 48, C.a, 0.2, 0.7);
    fx.ring(s.x, s.y, fin ? 34 : 20, C.a, 0.2, 3); if (fin) fx.ring(s.x, s.y, 48, C.b, 0.26, 2);
    line(fx, s.x, s.y, ev.ang, fin ? 230 : 160, fin ? 12 : 8, fin ? C.b : C.a, C.hi, 0.18);
    if (!lite(fx)) for (let i = 0; i < (fin ? 3 : 1); i++) fx.add({ type: 'mote', shape: 'note', x: s.x, y: s.y - 6, vx: Math.cos(ev.ang) * 60 + (Math.random() - 0.5) * 60, vy: -70 - Math.random() * 50, drag: 0.93, life: 0.7, size: 6, color: i % 2 ? C.b : C.a, rot: 0, spin: 0, grow: true });
    if (fin && me) fx.shake(0.06);
  },
  ranger(fx, ev, me) { // quick-shot arrows with trails
    const C = BASIC_COL.ranger, fin = ev.heavy, s = at(ev, 22);
    fx.ring(s.x, s.y, fin ? 26 : 16, C.a, 0.16, 3);
    for (const da of fin ? [-0.06, 0, 0.06] : [0]) line(fx, s.x, s.y, ev.ang + da, fin ? 300 : 220, fin ? 9 : 6, da ? C.b : C.a, C.hi, 0.18);
    if (fin) { fx.sparks(s.x, s.y, ev.ang, N(fx, 6), C.hi, 380, 0.5); if (me) fx.shake(0.06); }
  },
  mage(fx, ev, me) { // arcane bolts
    const C = BASIC_COL.mage, fin = ev.heavy, s = at(ev, 24);
    glow(fx, s.x, s.y, fin ? 80 : 50, C.a, 0.2, 0.7);
    fx.ring(s.x, s.y, fin ? 34 : 20, C.a, 0.2, 3); if (fin) fx.ring(s.x, s.y, 50, C.b, 0.28, 2);
    line(fx, s.x, s.y, ev.ang, fin ? 260 : 180, fin ? 14 : 9, C.b, C.hi, 0.18);
    fx.puffs(s.x, s.y, N(fx, fin ? 6 : 2), C.a, 6, 70, 0.3);
    if (fin) { rays(fx, s.x, s.y, 60, C.hi, 8, 0.24, 3); if (me) fx.shake(0.06); }
  },
};
/** Per-class basic-attack look. Returns true when it drew the swing / shot (the core then skips its generic one). */
export function basicFx(fx, ev, me) {
  if (ev.counter) return false; // (the Warrior's counter keeps its own look)
  const f = ev.type === 'swing' ? MELEE[ev.cls] : ev.type === 'shoot' && ev.basic ? RANGED[ev.cls] : null;
  if (!f) return false;
  f(fx, ev, me);
  return true;
}
