// Shared mechanic kit (encounter revamp Part 0): the building blocks the rebuilt Trials / Extremes / Savage / Ultimate use. Pure helpers:
// they decide WHO / WHERE / WHAT ORDER; each encounter's telegraph engine draws and resolves them. Every check here is a POSITION check
// (feed the result to damagePlayer with { pos: 1 } or resolve it through a posTele telegraph): dodge i-frames never pass them.
//   towers      soak circles that need exactly `need` heroes (FFXIV towers): towerCheck -> per tower { n, ok }
//   tethers     stretch / close tethers (TOP Mid / Remote Glitch, Hello World): tetherOk(a, b, { min, max })
//   inLine      1st..Nth-in-line order debuffs (TOP Program Loop, Ultimate quotes): fair, seeded, spread over the party
//   exaflare    an advancing line of circles (Unlimited Wave Cannon / exaflares): the safe path opens behind the first blast
//   rewind      a history of resolved mechanics; recall(n) = the nth-last one again (Endsinger's Fatalism rewinds)
//   stance      a boss / clone stance -> the shape it will fire (TOP clone reads, Shiva forms)
export const MECHKIT = { towerPad: 0.5, exaGap: 24, exaStep: 110, readMin: 180 }; // (readMin: a solve mechanic shows >= 3 s before it resolves)

/** towers: [{ x, y, r, need }] -> [{ n, ok, ids }] (a hero counts when the centre of their body is inside) */
export function towerCheck(towers, players) {
  return towers.map((t) => { const ids = players.filter((p) => !p.dead && Math.hypot(p.x - t.x, p.y - t.y) <= t.r + p.r * MECHKIT.towerPad).map((p) => p.id); return { n: ids.length, ok: ids.length === (t.need ?? 1), ids }; });
}
/** a tether between two heroes is satisfied when its length is inside [min, max] */
export const tetherOk = (a, b, { min = 0, max = Infinity } = {}) => { const d = Math.hypot(a.x - b.x, a.y - b.y); return d >= min && d <= max; };
/** inLine: give `ids` the orders 1..n (n = groups), as evenly as possible, seeded by rng. Returns { id: order } */
export function inLine(ids, n, rng) {
  const a = ids.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const out = {}; a.forEach((id, i) => { out[id] = (i % n) + 1; }); return out;
}
/** exaflare: n circles from (x, y) along ang, each `step` px further and `gap` ticks later; the first lands at `delay` */
export function exaflare(x, y, ang, { n = 6, r = 90, step = MECHKIT.exaStep, gap = MECHKIT.exaGap, delay = 60 } = {}) {
  return Array.from({ length: n }, (_, i) => ({ shape: 'circle', x: x + Math.cos(ang) * step * i, y: y + Math.sin(ang) * step * i, r, delay: delay + gap * i, beat: i + 1, beats: n }));
}
/** rewind log: remember resolved mechanics, recall the nth-last (1 = the one that just happened) */
export class RewindLog {
  constructor(max = 6) { this.max = max; this.list = []; }
  record(m) { this.list.push(m); if (this.list.length > this.max) this.list.shift(); return m; }
  recall(n) { return n >= 1 && n <= this.list.length ? this.list[this.list.length - n] : null; }
}
/** stance -> shape (relative to the caster): the reads every clone / form mechanic uses */
export const STANCE = {
  sword: { shape: 'circle', r: 200 },               // point-blank: get out
  shield: { shape: 'donut', r0: 140, r: 520 },      // donut: get in
  blades: { shape: 'sides', w: 420 },               // flanks: stand in front / behind
  staff: { shape: 'cross', w: 120 },                // a cross: stand on the diagonals
  bow: { shape: 'cone', arc: 4.7, r: 520 },         // 270 degrees in front: stand behind
};
/** is (px, py) hit by a stance shape cast at (x, y) facing ang? */
export function stanceHits(st, x, y, ang, px, py) {
  const S = STANCE[st], dx = px - x, dy = py - y, d = Math.hypot(dx, dy), c = Math.cos(-ang), s = Math.sin(-ang), lx = dx * c - dy * s, ly = dx * s + dy * c;
  if (S.shape === 'circle') return d <= S.r;
  if (S.shape === 'donut') return d >= S.r0 && d <= S.r;
  if (S.shape === 'sides') return Math.abs(ly) > 60 && Math.abs(ly) <= S.w && Math.abs(lx) < S.w;
  if (S.shape === 'cross') return Math.abs(lx) <= S.w / 2 || Math.abs(ly) <= S.w / 2;
  if (S.shape === 'cone') { let a = Math.atan2(ly, lx); return d <= S.r && Math.abs(a) <= S.arc / 2; }
  return false;
}
