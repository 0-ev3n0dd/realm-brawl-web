// CONCEPT ONLY (2026-10-20): three alternative Samurai 20 s burst concepts on the REAL game sim (Hayate vs the arena boss,
// Grimtusk). The Sim plays the real Samurai chains; a concept layer listens to its chain events and adds PLACEHOLDER bonus
// damage. Nothing in the game's kits / balance changes. Shared by public/concepts/samurai-burst2.html and the headless compare.
//   A) Blade Edge   B) Flow   C) Chain Weave
import { Sim } from '../sim/sim.js';
import { CLASSES } from '../sim/data/classes.js';
import { RotBot } from '../rotations/rotbot.js';
import { Arena, addHero } from '../rotations/arena.js';
import { SIG_ROUTES } from './sig-routes.js';

const SAM = CLASSES.samurai;
export const chainOf = (id, cls = 'samurai') => CLASSES[cls].chains.find((c) => c.id === id);
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
// ------------------------------------------------------------------ D) Delayed Cuts (bank → Special cash-out → Resheathe → One Perfect Cut)
/** placeholder cuts banked per boss chain finisher (heavier chains bank more) */
export const BANK = { void_sheath: 4, counter_sheathe: 2, moonlit_guard: 2, twin_moons: 3, moment_of_death: 4, void_echo: 5, stillwater_execution: 6, wind_step: 1, petal_rain: 2, blossom_burst: 1, riposte_wave: 2 };
export class DelayedCuts {
  static id = 'cuts'; static title = 'D · Delayed Cuts';
  static blurb = 'Chain finishers bank Delayed Cuts (heavier chains bank more: Stillwater Execution 6, Void Echo 5, Moment of Death 4, Twin Moons 3, Moonlit Guard / Counter Sheathe 2). The boss Special chain (R→E→Q→F→R Void Sheath) is the cash-out: Void Draw releases the bank in 3 waves (20% each), the finisher releases the rest. Its finisher opens Resheathe: 6 s where chains bank double. The Special cycle is 20 s on this page (Special to Special, incl. the R→E→Q lead-in; game cooldown is 18 s), so about 14 s banking per cycle. Opener: a held pre-pull draw banks 3, the pull opens with the Special, then the heaviest chains. One Perfect Cut is the REAL ultimate: Blade of the Void (T) → its boss finisher route (Sheathe · Moonlit Guard · Moment of Death · Parry · Sheathe). Banked cuts also build ult meter (+3 per cut, pre-pull draw +30), so the opener fills the gauge for the first ultimate and every 20 s cycle refills it: the ultimate is cast in every Resheathe, and when the real split lands the whole bank releases on top (×2.5 inside Resheathe). Between bursts, chains do the DPS and bank cuts. Optimized good route: on ult cycles Void Sheath banks (+4) instead of cashing out, so the ultimate releases the whole bank. CONCEPT numbers.';
  static K = { per: 600, waves: 3, wave: 0.2, waveGap: 18, resh: 360, opcMul: 2.5, opcCd: 3600, prepull: 3, ultPrepull: 30, ultPerCut: 3, specCd: 20, lead: 280 };
  constructor() { this.bank = 0; this.bonus = 0; this.resh = 0; this.opc = 0; this.waves = []; this.hi = 0; this.n = 0; this.specials = 0; this.opcs = 0; this.base = 0; this.casts = 0; this.reshEnd = -1; this.reshChain = false; }
  gauge(d, n) { const p = d.player; if (!p.uw && !this.inUlt && p.ult < 100) p.ult = Math.min(100, p.ult + n); }
  prepull(d) { this.bank += DelayedCuts.K.prepull; this.gauge(d, DelayedCuts.K.ultPrepull); return { fx: 'bank', add: DelayedCuts.K.prepull, draw: true }; }
  bankOf(ch) { return BANK[ch.id] || 1; }
  spBank() { return BANK.void_sheath; }
  isRelease(ev) { return ev.type === 'samx' && ev.ph === 'split'; }
  rel(n, mul = 1) { n = Math.min(this.bank, n); this.bank -= n; const b = Math.round(n * DelayedCuts.K.per * mul); this.bonus += b; return b; }
  chain(ch, d) {
    if (ch.seq.includes('SP') && ch.kind === 'boss' && this.holdCycle) { this.holdCycle = false; const add = this.spBank(ch); this.bank += add; this.resh = DelayedCuts.K.resh; this.reshEnd = d.sim.tick + DelayedCuts.K.resh; this.n++; return { fx: 'bank', add, hold: true }; }
    if (ch.seq.includes('SP')) { if (ch.kind !== 'boss') return null; this.waves = []; const n = this.bank, b = this.rel(n); this.resh = DelayedCuts.K.resh; this.reshEnd = d.sim.tick + DelayedCuts.K.resh; this.n++; return { bonus: b, fx: 'cashfin', cuts: n }; }
    // a chain whose first press landed inside Resheathe banks double (start ≈ finish − 1 s GCD per extra step − the 1.2 s scoring wait)
    const start = d.sim.tick - 72 - (ch.seq.length - 1) * 60, dbl = start <= this.reshEnd; this.reshChain = dbl;
    const add = this.bankOf(ch) * (dbl ? 2 : 1); this.bank += add; this.gauge(d, add * DelayedCuts.K.ultPerCut); return { fx: 'bank', add, dbl };
  }
  tick(d) {
    const K = this.constructor.K, p = d.player; let out = null;
    const cd = (p.cds && p.cds.SP) || 0, used = cd > this.hi + 30;
    if (this.spT != null && !used) p.cds.SP = Math.max(0, this.spT + K.specCd * 60 - (d.R.lead ?? K.lead) - d.sim.tick); // (concept: fixed cycle, Void Blade does not speed it up)
    this.hi = p.cds.SP || 0;
    if (used) { this.holdCycle = !!(d.R.bankOnUlt && p.ult >= 100); this.spT = d.sim.tick; p.cds.SP = K.specCd * 60 - (d.R.lead ?? K.lead); this.hi = p.cds.SP; // (concept: Special → Special every 20 s; the Void Sheath lead-in R→E→Q takes ~3.5 s of it)
 this.specials++; this.base = this.bank; if (!this.holdCycle) this.waves = Array.from({ length: K.waves }, (_, i) => d.sim.tick + i * K.waveGap); }
    if (this.waves.length && d.sim.tick >= this.waves[0]) { this.waves.shift(); const n = Math.max(this.bank ? 1 : 0, Math.round(this.base * K.wave)), b = this.rel(n); if (b) out = { bonus: b, fx: 'wave', cuts: n }; }
    if (this.resh > 0) this.resh--;
    return out;
  }
  inWindow(d) { return this.resh > 0 || (this.reshChain && (!d || d.sim.tick < this.reshEnd + 240)); }
  /** the REAL ultimate: Blade of the Void (T) → its boss finisher route One Perfect Cut. When the real split lands, the concept
   *  releases the whole bank on top (×2.5 if the ultimate was cast inside Resheathe). */
  sim(ev, d) {
    if (ev.pid !== d.player.id) return null;
    if (ev.type === 'ult') { this.inUlt = true; this.ultInR = this.inWindow(d); this.ultCycle = this.specials; this.casts++; return { fx: 'ultcast', inR: this.ultInR }; }
    if (ev.type === 'ultEnd') this.inUlt = false;
    if (this.isRelease(ev)) { const K = this.constructor.K, n = this.bank, inR = !!this.ultInR; this.opcs++; this.reshChain = false; return { bonus: this.rel(n, inR ? K.opcMul : 1), fx: 'opc', cuts: n, inR }; }
    return null;
  }
  wantUlt(d) { if (d.R.opc === 'asap') return true; if (!this.inWindow(d) || this.ultCycle === this.specials) return false; return d.R.ultLate ? (this.resh > 0 && this.resh < 90) || (!this.resh && this.reshChain) : true; }
  wantBurst() { return false; } burst() { return false; }
  widget(d) { const p = d && d.player; return { kind: 'cuts', bank: this.bank, resh: this.resh / DelayedCuts.K.resh, ult: p ? Math.floor(p.ult) : 0, uw: !!this.inUlt, unit: this.unit || 'BANKED CUTS', win: this.win || 'RESHEATHE', ultName: this.ultName || 'VOID BLADE → One Perfect Cut' }; }
}
// ------------------------------------------------------------------ the same ideology for every other class (CONCEPT)
/** per class: the real signature mechanic the bank is named after, the concept window name, and why */
export const SIG = {
  warrior: { unit: 'Bleed', win: 'Warpath Fury', mech: 'Bleed (Twin Axes hits stack it; Rupture Smash / Executioner\'s Verdict use it up)' },
  ranger: { unit: 'Quarry', win: 'Deadeye Focus', mech: 'Quarry (arrows on rooted / marked targets; Deadeye and Heaven\'s Arrow use it up)' },
  mage: { unit: 'Burn', win: 'Kindled Surge', mech: 'Burn (Meteor / burning ground stack it; Supernova and Singularity detonate it)' },
  cleric: { unit: 'Condemn', win: 'Dawnlight', mech: 'Condemn (basics +1, Smite +2; Final Verdict and Heaven\'s Judgment use it up)' },
  bladedancer: { unit: 'Shadow Marks', win: 'Nightfall', mech: 'Initiative / Marked for Death (the Ninja has no enemy stack; the bank is named after its marks)' },
  monk: { unit: 'Pressure Points', win: 'Open Meridians', mech: 'Pressure Points (every 5 hits plant one; Seven Seals / Rising Dragon pop them)' },
  dragoon: { unit: 'Impaled', win: 'Wyrm\'s Ascent', mech: 'Impaled pins (thrusts and every 3rd basic pin; dives rip them out)' },
  summoner: { unit: 'Inked Pages', win: 'Open Grimoire', mech: 'Ink + Chill / Freeze (wyrm breath chills, Glacier Coil freezes; Thunder Roc cashes it)' },
  bard: { unit: 'Crescendo', win: 'Fermata', mech: 'Tempo + Dissonant (Sour Note / Discord Ballad make the boss Dissonant, +15% damage taken)' },
};
export class Signature extends DelayedCuts {
  static id = 'sig'; static K = { ...DelayedCuts.K };
  constructor(cls) {
    super(); this.cls = cls; const C = CLASSES[cls], S = SIG[cls]; this.C = C; this.S = S;
    this.spCh = C.chains.find((c) => c.kind === 'boss' && c.seq.includes('SP')); this.route = (C.routes || []).find((r) => r.route === 'boss');
    this.unit = S.unit.toUpperCase(); this.win = S.win.toUpperCase(); this.ultName = `${C.ult.name.toUpperCase()} → ${this.route ? this.route.name : 'finisher'}`;
  }
  bankOf(ch) { return Math.max(1, ch.seq.length - 1 + (ch.kind === 'boss' ? 1 : 0)); } // heavier chains bank more
  spBank() { return 4; }
  isRelease(ev) { return ev.type === 'ultEnd'; } // the real ultimate's window ends (its boss finisher route or the plain end)
  sim(ev, d) { const r = super.sim(ev, d); if (r && r.fx === 'opc') r.fin = ev.finisher || null; return r; }
}
export function blurbFor(cls) { const C = CLASSES[cls], S = SIG[cls], sp = C.chains.find((c) => c.kind === 'boss' && c.seq.includes('SP')), rt = (C.routes || []).find((r) => r.route === 'boss');
  return `${C.name}: chain finishers bank ${S.unit} (concept bank named after the real mechanic: ${S.mech}); heavier chains bank more. The boss Special chain ${sp.name} is the hinge on a 20 s cycle: it cashes out the bank (3 waves + finisher) and opens ${S.win}: 6 s where chains bank double. Banked ${S.unit} also build ult meter (+3 each, pre-pull +30) so the opener fills the gauge; the REAL ultimate ${C.ult.name} is cast inside ${S.win} every cycle and when it ends (${rt ? rt.name : 'its finisher'}) the whole bank releases on top, ×2.5 inside the window. If the optimizer prefers it, the Special banks instead of cashing out on ult cycles. CONCEPT numbers.`; }
export const CONCEPTS = { cuts: DelayedCuts, edge: BladeEdge, flow: Flow, weave: Weave };

// autoplay routes per concept: good vs sloppy (drops = the chain's last key held back past its window; pauses = idle gaps)
export const ROUTES = {
  // good = beam-searched (tools/rotations/optimize.mjs --concept cuts, 3 min + 8 min): the Special banks on ult cycles so the ultimate releases the big bank
  cuts: { good: { loop: [['R', 'E', 'Q', 'SP', 'R'], ['R', 'E', 'Q', 'F'], ['R', 'Q', 'E']], opener: [], drop: 0, pause: 0, prepull: true, opc: 'window', spFirst: true, ultLate: false, bankOnUlt: true, desc: 'optimized (beam search): pre-pull draw, open on Void Sheath, then Stillwater Execution · Petal Rain until the Special is back; on ult cycles Void Sheath banks instead of cashing out and the real ultimate (cast early in Resheathe) releases the big bank' },
    sloppy: { loop: [['E', 'R'], ['Q', 'Q'], ['R', 'E'], ['R', 'E', 'Q', 'SP', 'R'], ['Q', 'F', 'Q']], drop: 0.2, pause: 0.35, prepull: false, opc: 'asap', desc: 'no pre-pull, light chains, Special whenever, real ultimate cast whenever the gauge is full' } },
  edge: { good: { loop: [['E', 'R'], ['R', 'Q', 'E'], ['Q', 'Q']], drop: 0, pause: 0, desc: 'Counter Sheathe · Petal Rain · Wind Step, empowering at 5 Edge' }, sloppy: { loop: [['E', 'R'], ['R', 'Q', 'E'], ['Q', 'Q']], drop: 0.35, pause: 0.25, desc: 'same chains, ~35% dropped and idle gaps' } },
  flow: { good: { loop: [['E', 'R'], ['Q', 'Q'], ['R', 'Q', 'E']], drop: 0, pause: 0, desc: 'short chains back to back, no gaps' }, sloppy: { loop: [['E', 'R'], ['Q', 'Q'], ['R', 'Q', 'E']], drop: 0.2, pause: 0.45, desc: 'same chains with 3 s gaps between many of them' } },
  weave: { good: { loop: [['E', 'R'], ['R', 'Q', 'E'], ['Q', 'Q'], ['R', 'E', 'Q']], drop: 0, pause: 0, desc: 'four different chains in turn (every pair weaves)' }, sloppy: { loop: [['R', 'E', 'Q']], drop: 0.25, pause: 0.2, desc: 'Moment of Death on repeat (nothing weaves) with drops' } },
};

/** one run: real Sim + arena boss + one concept layer. events: { k: 'bonus', r } / { k: 'sim', ev } */
export class Driver {
  constructor(concept, route = 'good', { seed = 1, auto = true, cls = 'samurai' } = {}) {
    this.cls = cls; this.cid = concept; this.M = concept === 'sig' ? new Signature(cls) : new CONCEPTS[concept](); this.R = typeof route === 'object' ? route : concept === 'sig' ? SIG_ROUTES[cls][route] : ROUTES[concept][route]; this.auto = auto;
    this.sim = new Sim({ seed: 9100 + seed, spawnEnemies: false }); this.sim.noBossRot = true; // (the concept layer replaces the game's boss cycle here)
    this.player = addHero(this.sim, cls, seed, cls === 'samurai' ? { name: 'Hayate' } : {});
    this.arena = new Arena(this.sim, this.player, 'boss').setup();
    this.bot = new RotBot(cls, this.R.loop.map((keys) => ({ keys, chain: null })), 'boss', { useUlt: !!this.M.wantUlt, opener: (this.R.opener || []).map((keys) => ({ keys, chain: null })) });
    let a = 77 + seed; this.rng = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    this.ticks = 0; this.listeners = []; this.pre = this.R.prepull && this.M.prepull ? this.M.prepull(this) : null; this.dropping = null; this.idle = 0; this.manual = { queue: [], skill: null, attack: false, mx: 0, my: 0 }; this.lastCh = null;
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
      if (this.M.wantUlt) this.bot.useUlt = this.M.wantUlt(this);
      if (this.R.spFirst && this.bot.si < 0 && !p.uw && !(p.cds.SP > 200)) { const i = this.bot.loop.findIndex((u) => u.keys.includes('SP')); if (i >= 0) this.bot.ui = i; } // (good route: the Special as soon as it is up)
      if (this.M.wantBurst(this)) this.burst();
    } else {
      const m = this.manual; if (m.skill) { if (m.queue.length < 3) m.queue.push({ k: m.skill, t: sim.tick }); m.skill = null; }
      const lh = p.history[p.history.length - 1], q0 = m.queue[0];
      if (q0 && lh && lh.a === q0.k && lh.tick >= q0.t && lh !== m.lastH) { m.lastH = lh; m.queue.shift(); }
      while (m.queue[0] && sim.tick - m.queue[0].t > 78) m.queue.shift();
      const cur = m.queue[0] ? m.queue[0].k : undefined;
      inp = { mx: m.mx, my: m.my, ax: t.x, ay: t.y, attack: m.attack && !cur, skill: cur }; if (m.ult) { m.ult = false; inp.ult = true; inp.skill = undefined; }
      if (!m.mx && !m.my) { const dx = t.x - p.x, dy = t.y - p.y, dd = Math.hypot(dx, dy); if (dd > t.r + 70) { inp.mx = dx / dd; inp.my = dy / dd; } }
      if (m.burst) { m.burst = false; this.burst(); }
    }
    sim.setInput(p.id, inp); sim.step();
    for (const ev of sim.drainEvents()) {
      this.emit({ k: 'sim', ev });
      const sr = this.M.sim && this.M.sim(ev, this); if (sr) this.emit({ k: 'bonus', r: sr });
      if (ev.pid !== p.id || ev.type !== 'chain') continue;
      const ch = chainOf(ev.id, this.cls); if (!ch) continue;
      // a chain is scored once it can no longer grow: R→E (Moonlit Guard) followed by Q becomes R→E→Q (Moment of Death),
      // so each finish waits up to 1.2 s (one GCD) for a longer chain that extends it
      const P = this.pend;
      if (P && ch.seq.length > P.ch.seq.length && P.ch.seq.every((k, i) => ch.seq[i] === k)) this.pend = { ch, tick: sim.tick };
      else { if (P) this.score(P.ch); this.pend = { ch, tick: sim.tick }; }
    }
    if (this.pend && sim.tick - this.pend.tick > 72) { this.score(this.pend.ch); this.pend = null; }
    if (this.pre && this.listeners.length) { this.emit({ k: 'bonus', r: this.pre }); this.pre = null; }
    const tr = this.M.tick(this); if (tr) this.emit({ k: 'bonus', r: tr });
    arena.after(); this.ticks++;
  }
  score(ch) { const r = this.M.chain(ch, this); if (r) this.emit({ k: 'bonus', r, ch }); }
  burst() { if (this.M.burst()) this.emit({ k: 'bonus', r: this.M.last || { fx: 'prime', stacks: this.M.primed } }); }
}

export function compare(concept, route, secs = 180, seed = 1, cls = 'samurai') {
  const d = new Driver(concept, route, { seed, cls }); while (d.ticks < secs * 60) d.step();
  return { concept, route, dps: Math.round(d.dps), game: Math.round(d.arena.dealt / secs), bonus: Math.round(d.bonus / secs) };
}
