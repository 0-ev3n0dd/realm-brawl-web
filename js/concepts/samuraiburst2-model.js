// CONCEPT ONLY (2026-10-20): three alternative Samurai 20 s burst concepts on the REAL game sim (Hayate vs the arena boss,
// Grimtusk). The Sim plays the real Samurai chains; a concept layer listens to its chain events and adds PLACEHOLDER bonus
// damage. Nothing in the game's kits / balance changes. Shared by public/concepts/samurai-burst2.html and the headless compare.
//   A) Blade Edge   B) Flow   C) Chain Weave
import { Sim } from '../sim/sim.js';
import { CLASSES } from '../sim/data/classes.js';
import { RotBot } from '../rotations/rotbot.js';
import { Arena, addHero } from '../rotations/arena.js';

const SAM = CLASSES.samurai;
export const chainOf = (id) => SAM.chains.find((c) => c.id === id);
/** placeholder "value" of one chain for concept bonuses: 1500 per step (CONCEPT number) */
export const BASE = (ch) => 1500 * ch.seq.length;

// ------------------------------------------------------------------ A) Blade Edge
export class BladeEdge {
  static id = 'edge'; static title = 'A · Blade Edge';
  static blurb = 'Every chain finisher hones the blade: +1 Edge (max 5), shown as a glow on the sword. At 5 Edge (or when you press F) the NEXT chain is empowered: every step +45% per Edge, then the Edge is spent. About one empowered chain every 20 s.';
  static K = { max: 5, perStack: 0.45 };
  constructor() { this.edge = 0; this.primed = 0; this.bonus = 0; this.n = 0; }
  chain(ch, d) {
    if (this.primed) { const b = Math.round(BASE(ch) * BladeEdge.K.perStack * this.primed); this.bonus += b; this.n++; const s = this.primed; this.primed = 0; return { bonus: b, fx: 'edge', stacks: s }; }
    this.edge = Math.min(BladeEdge.K.max, this.edge + 1); return null;
  }
  wantBurst() { return this.edge >= BladeEdge.K.max && !this.primed; }
  burst() { if (!this.edge || this.primed) return false; this.primed = this.edge; this.edge = 0; return true; }
  tick() {}
  widget() { return { kind: 'edge', edge: this.edge, primed: this.primed, max: BladeEdge.K.max }; }
}
// ------------------------------------------------------------------ B) Flow
export class Flow {
  static id = 'flow'; static title = 'B · Flow';
  static blurb = 'Chain finishes back to back (≤ 2.5 s apart) raise Flow 1 → 5: each level +8% chain damage and −4% GCD. A gap drops one level per 2.5 s. At Flow 5 a 6 s window opens where every finisher echoes (hits twice, a subtle duplicate slash); then Flow falls back to 3.';
  static K = { gap: 150, per: 0.08, gcd: 0.04, window: 360, echo: 0.6, after: 3 };
  constructor() { this.lvl = 0; this.last = -9999; this.win = 0; this.bonus = 0; this.echoes = 0; }
  chain(ch, d) {
    const t = d.sim.tick, K = Flow.K; let out = { bonus: 0 };
    if (this.lvl > 0) out.bonus += Math.round(BASE(ch) * K.per * this.lvl);
    if (this.win > 0) { out.bonus += Math.round(BASE(ch) * K.echo); out.fx = 'echo'; this.echoes++; }
    if (t - this.last <= K.gap || this.lvl === 0) this.lvl = Math.min(5, this.lvl + 1);
    this.last = t;
    if (this.lvl >= 5 && this.win <= 0 && !this.used) { this.win = K.window; this.used = true; out.open = true; }
    this.bonus += out.bonus; return out.bonus || out.open ? out : null;
  }
  tick(d) {
    const t = d.sim.tick, K = Flow.K;
    if (this.win > 0 && --this.win <= 0) { this.lvl = K.after; this.used = false; this.last = t; }
    if (this.win <= 0 && this.lvl > 0 && t - this.last > K.gap) { this.lvl--; this.last = t; }
    const p = d.player; if (this.lvl && p.gcd > 0 && p._fg !== p.gcd) { p.gcd = Math.max(0, p.gcd - (p.gcd * K.gcd * this.lvl) / 30); p._fg = p.gcd; } // (concept: a faster GCD while flowing)
  }
  wantBurst() { return false; } burst() { return false; }
  widget() { return { kind: 'flow', lvl: this.lvl, win: this.win / Flow.K.window }; }
}
// ------------------------------------------------------------------ C) Chain Weave
// one pair finisher per unordered pair of the Samurai's real short chains (placeholder names / multipliers)
export const PAIRS = {
  'counter_sheathe+petal_rain': { name: 'Storm of Returned Petals', mul: 1.0, fx: 'petals' },
  'counter_sheathe+wind_step': { name: 'Gale Riposte', mul: 0.9, fx: 'gale' },
  'petal_rain+wind_step': { name: 'Blossom Gale', mul: 1.0, fx: 'petals' },
  'counter_sheathe+moonlit_guard': { name: 'Moonlit Return', mul: 0.8, fx: 'moon' },
  'moonlit_guard+wind_step': { name: 'Moonwind', mul: 0.85, fx: 'moon' },
  'moonlit_guard+petal_rain': { name: 'Petals Under the Moon', mul: 0.95, fx: 'moon' },
  'moment_of_death+wind_step': { name: 'Death on the Wind', mul: 1.2, fx: 'gale' },
  'counter_sheathe+moment_of_death': { name: 'Final Riposte', mul: 1.2, fx: 'moon' },
  'moment_of_death+petal_rain': { name: 'Last Blossom', mul: 1.25, fx: 'petals' },
  'moment_of_death+moonlit_guard': { name: 'Eclipse Cut', mul: 1.1, fx: 'moon' },
  'twin_moons+wind_step': { name: 'Twin Gale', mul: 0.9, fx: 'gale' }, 'counter_sheathe+twin_moons': { name: 'Twin Return', mul: 0.9, fx: 'moon' },
  'petal_rain+twin_moons': { name: 'Twin Petal Moons', mul: 1.0, fx: 'petals' }, 'moment_of_death+twin_moons': { name: 'Double Moment', mul: 1.2, fx: 'moon' }, 'moonlit_guard+twin_moons': { name: 'Full Moons', mul: 0.9, fx: 'moon' },
};
export const pairKey = (a, b) => [a, b].sort().join('+');
export class Weave {
  static id = 'weave'; static title = 'C · Chain Weave';
  static blurb = 'Finish two DIFFERENT chains in a row and they weave into a pair finisher (one per pair of real Samurai chains, e.g. Counter Sheathe + Petal Rain = Storm of Returned Petals): a bonus hit with existing FX. Every 20 s the best 3 pairs woven so far fuse into the Grand Weave, a big final cut (×1.5 their sum). Repeating the same chain weaves nothing.';
  static K = { cycle: 1200, grand: 1.5, base: 2400 };
  constructor() { this.prev = null; this.woven = []; this.bonus = 0; this.t0 = 0; this.grands = 0; }
  chain(ch, d) {
    const id = ch.id, prev = this.prev; this.prev = id;
    if (!prev || prev === id) return null;
    const P = PAIRS[pairKey(prev, id)]; if (!P) return null;
    this.prev = null; // (a chain is woven once)
    const b = Math.round(Weave.K.base * P.mul); this.bonus += b; this.woven.push({ ...P, b });
    return { bonus: b, fx: 'pair', pair: P };
  }
  tick(d) {
    if (d.sim.tick - this.t0 >= Weave.K.cycle) { this.t0 = d.sim.tick; const best = this.woven.sort((a, b) => b.b - a.b).slice(0, 3);
      if (best.length) { const g = Math.round(best.reduce((a, x) => a + x.b, 0) * Weave.K.grand); this.bonus += g; this.grands++; this.woven = []; return { bonus: g, fx: 'grand', n: best.length }; } this.woven = []; }
    return null;
  }
  wantBurst() { return false; } burst() { return false; }
  widget() { return { kind: 'weave', woven: this.woven.map((w) => w.name), cycle: ((globalThis.__noop, 0)), prev: this.prev }; }
}
export const CONCEPTS = { edge: BladeEdge, flow: Flow, weave: Weave };

// autoplay routes per concept: good vs sloppy (drops = the chain's last key held back past its window; pauses = idle gaps)
export const ROUTES = {
  edge: { good: { loop: [['E', 'R'], ['R', 'Q', 'E'], ['Q', 'Q']], drop: 0, pause: 0, desc: 'Counter Sheathe · Petal Rain · Wind Step, empowering at 5 Edge' }, sloppy: { loop: [['E', 'R'], ['R', 'Q', 'E'], ['Q', 'Q']], drop: 0.35, pause: 0.25, desc: 'same chains, ~35% dropped and idle gaps' } },
  flow: { good: { loop: [['E', 'R'], ['Q', 'Q'], ['R', 'Q', 'E']], drop: 0, pause: 0, desc: 'short chains back to back, no gaps' }, sloppy: { loop: [['E', 'R'], ['Q', 'Q'], ['R', 'Q', 'E']], drop: 0.2, pause: 0.45, desc: 'same chains with 3 s gaps between many of them' } },
  weave: { good: { loop: [['E', 'R'], ['R', 'Q', 'E'], ['Q', 'Q'], ['R', 'E', 'Q']], drop: 0, pause: 0, desc: 'four different chains in turn (every pair weaves)' }, sloppy: { loop: [['R', 'E', 'Q']], drop: 0.25, pause: 0.2, desc: 'Moment of Death on repeat (nothing weaves) with drops' } },
};

/** one run: real Sim + arena boss + one concept layer. events: { k: 'bonus', r } / { k: 'sim', ev } */
export class Driver {
  constructor(concept, route = 'good', { seed = 1, auto = true } = {}) {
    this.cid = concept; this.M = new CONCEPTS[concept](); this.R = ROUTES[concept][route]; this.auto = auto;
    this.sim = new Sim({ seed: 9100 + seed, spawnEnemies: false });
    this.player = addHero(this.sim, 'samurai', seed, { name: 'Hayate' });
    this.arena = new Arena(this.sim, this.player, 'boss').setup();
    this.bot = new RotBot('samurai', this.R.loop.map((keys) => ({ keys, chain: null })), 'boss', { useUlt: false });
    let a = 77 + seed; this.rng = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    this.ticks = 0; this.listeners = []; this.dropping = null; this.idle = 0; this.manual = { queue: [], skill: null, attack: false, mx: 0, my: 0 }; this.lastCh = null;
  }
  get boss() { return this.arena.boss; }
  get bonus() { return this.M.bonus; }
  get dps() { return (this.arena.dealt + this.M.bonus) / Math.max(1, this.ticks / 60); }
  emit(e) { for (const f of this.listeners) f(e); }
  step() {
    const { sim, player: p, arena } = this, t = this.boss; let inp;
    arena.before();
    if (this.auto) {
      if (this.idle > 0) { this.idle--; inp = { mx: 0, my: 0, ax: t.x, ay: t.y, attack: false }; }
      else {
        const wasIdle = this.bot.si < 0;
        inp = this.bot.input(sim, p, t);
        if (wasIdle && this.bot.si >= 0 && this.rng() < this.R.pause) { this.idle = 180; this.bot.si = -1; inp = { mx: 0, my: 0, ax: t.x, ay: t.y, attack: false }; }
        const u = this.bot.si >= 0 ? this.bot.loop[this.bot.ui] : null;
        if (u && this.bot.si === u.keys.length - 1 && this.dropping == null) this.dropping = this.rng() < this.R.drop ? sim.tick : -1;
        if (this.dropping > 0 && inp.skill) { inp.skill = undefined; if (sim.tick - this.dropping > 150) { this.dropping = null; this.bot.si = -1; this.bot.ui = this.bot.nextUi(); } }
        if (this.bot.si < 0 && this.dropping === -1) this.dropping = null;
      }
      if (this.M.wantBurst()) this.burst();
    } else {
      const m = this.manual; if (m.skill) { if (m.queue.length < 3) m.queue.push({ k: m.skill, t: sim.tick }); m.skill = null; }
      const lh = p.history[p.history.length - 1], q0 = m.queue[0];
      if (q0 && lh && lh.a === q0.k && lh.tick >= q0.t && lh !== m.lastH) { m.lastH = lh; m.queue.shift(); }
      while (m.queue[0] && sim.tick - m.queue[0].t > 78) m.queue.shift();
      const cur = m.queue[0] ? m.queue[0].k : undefined;
      inp = { mx: m.mx, my: m.my, ax: t.x, ay: t.y, attack: m.attack && !cur, skill: cur };
      if (!m.mx && !m.my) { const dx = t.x - p.x, dy = t.y - p.y, dd = Math.hypot(dx, dy); if (dd > t.r + 70) { inp.mx = dx / dd; inp.my = dy / dd; } }
      if (m.burst) { m.burst = false; this.burst(); }
    }
    sim.setInput(p.id, inp); sim.step();
    for (const ev of sim.drainEvents()) {
      this.emit({ k: 'sim', ev });
      if (ev.pid !== p.id || ev.type !== 'chain') continue;
      const ch = chainOf(ev.id); if (!ch) continue;
      // a chain is scored once it can no longer grow: R→E (Moonlit Guard) followed by Q becomes R→E→Q (Moment of Death),
      // so each finish waits up to 1.2 s (one GCD) for a longer chain that extends it
      const P = this.pend;
      if (P && ch.seq.length > P.ch.seq.length && P.ch.seq.every((k, i) => ch.seq[i] === k)) this.pend = { ch, tick: sim.tick };
      else { if (P) this.score(P.ch); this.pend = { ch, tick: sim.tick }; }
    }
    if (this.pend && sim.tick - this.pend.tick > 72) { this.score(this.pend.ch); this.pend = null; }
    const tr = this.M.tick(this); if (tr) this.emit({ k: 'bonus', r: tr });
    arena.after(); this.ticks++;
  }
  score(ch) { const r = this.M.chain(ch, this); if (r) this.emit({ k: 'bonus', r, ch }); }
  burst() { if (this.M.burst()) this.emit({ k: 'bonus', r: { fx: 'prime', stacks: this.M.primed } }); }
}

export function compare(concept, route, secs = 180, seed = 1) {
  const d = new Driver(concept, route, { seed }); while (d.ticks < secs * 60) d.step();
  return { concept, route, dps: Math.round(d.dps), game: Math.round(d.arena.dealt / secs), bonus: Math.round(d.bonus / secs) };
}
