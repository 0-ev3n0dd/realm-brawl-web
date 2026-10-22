// CONCEPT ONLY (2026-10-20): "Samurai burst" boss-rotation brainstorm - afterimages + sheath tension + 20 s draw burst +
// One Perfect Cut every 3rd burst. Pure model + driver (no DOM), shared by public/concepts/samurai-burst.html and its
// headless route comparison. Nothing here touches the game's kits or balance: the real Sim plays the real Samurai chains,
// and this layer only listens to its chain events and adds PLACEHOLDER concept numbers on top.
import { Sim } from '../sim/sim.js';
import { CLASSES } from '../sim/data/classes.js';
import { RotBot } from '../rotations/rotbot.js';
import { Arena, addHero } from '../rotations/arena.js';

export const CONCEPT = { // ---- all placeholder numbers (concept, not tuned)
  slots: 3, cycle: 20, build: 14,
  type: { R: 'thrust', E: 'sweep', Q: 'rise' }, // afterimage type = the chain's LAST key
  val: { thrust: 2600, sweep: 2200, rise: 2400 }, // one afterimage at burst (before pattern / tension)
  cross: 3.0, focused: 2.4, mixed: 1.4, partial: 1.0, // pattern multipliers
  tClean: 34, tFocused: 45, tDrop: 0, // sheath tension per chain (focused = same type as the last one: faster build)
  fullCrit: 1.6, partialTension: 0.3, drawBase: 3000,
  opcEvery: 3, opcMul: 1.8, opener: { hold: 1, tension: 25, type: 'rise' },
};
export const SYMBOL = { thrust: '➤', sweep: '◠', rise: '⤴' };
export const NAMES = { thrust: 'Thrust', sweep: 'Sweep', rise: 'Rising cut' };

/** the concept state machine: feed it chain events / drops / draws, it returns burst results */
export class BurstModel {
  constructor() { this.t = 0; this.cycleT = 0; this.imgs = []; this.tension = 0; this.bursts = 0; this.minute = []; this.bonus = 0; this.log = []; this.lastType = null; }
  tick(dt) { this.t += dt; this.cycleT += dt; if (this.cycleT >= CONCEPT.cycle) { this.cycleT -= CONCEPT.cycle; this.cycleN = (this.cycleN || 0) + 1; this.drawn = false; } }
  chain(lastKey, name, pos) {
    const type = CONCEPT.type[lastKey]; if (!type) return null;
    const focused = this.lastType === type; this.lastType = type;
    this.tension = Math.min(100, this.tension + (focused ? CONCEPT.tFocused : CONCEPT.tClean));
    if (this.imgs.length >= CONCEPT.slots) return { type, name, full: true };
    const im = { type, name, x: pos.x, y: pos.y, born: this.t }; this.imgs.push(im); return im;
  }
  drop() { this.tension = Math.min(100, this.tension + CONCEPT.tDrop); this.lastType = null; this.log.push({ t: this.t, k: 'drop' }); }
  opener(pos) { this.tension = CONCEPT.opener.tension; const im = { type: CONCEPT.opener.type, name: 'Held draw (opener)', x: pos.x, y: pos.y, born: this.t }; this.imgs.push(im); return im; }
  pattern() {
    const n = this.imgs.length; if (n < 3) return { id: 'partial', name: n ? 'Partial' : 'Empty', mul: CONCEPT.partial };
    const s = new Set(this.imgs.map((i) => i.type)).size;
    return s === 3 ? { id: 'cross', name: 'CROSS-CUT', mul: CONCEPT.cross } : s === 1 ? { id: 'focused', name: 'FOCUSED TRIPLE', mul: CONCEPT.focused } : { id: 'mixed', name: 'Mixed', mul: CONCEPT.mixed };
  }
  /** the draw burst: cash afterimages (in creation order) + tension; every 3rd one is One Perfect Cut */
  draw() {
    const pat = this.pattern(), full = this.tension >= 100, tm = full ? CONCEPT.fullCrit : 1 + CONCEPT.partialTension * this.tension / 100;
    const hits = [{ k: 'draw', dmg: Math.round(CONCEPT.drawBase * tm), crit: full }];
    for (const im of this.imgs) hits.push({ k: im.type, im, dmg: Math.round(CONCEPT.val[im.type] * pat.mul * tm), crit: full });
    this.minute.push(...this.imgs.map((i) => ({ ...i })));
    this.bursts++;
    let opc = null;
    if (this.bursts % CONCEPT.opcEvery === 0) {
      const sum = this.minute.reduce((a, i) => a + CONCEPT.val[i.type], 0);
      opc = { dmg: Math.round(sum * CONCEPT.opcMul * tm), imgs: this.minute.slice(), crit: full }; this.minute = [];
    }
    const total = hits.reduce((a, h) => a + h.dmg, 0) + (opc ? opc.dmg : 0);
    this.bonus += total; this.log.push({ t: this.t, k: 'burst', pat: pat.id, tension: Math.round(this.tension), total, opc: !!opc });
    const res = { pat, tension: this.tension, full, hits, opc, total, imgs: this.imgs };
    this.imgs = []; this.tension = 0; this.drawn = true; this.lastType = null; // (the 20 s cycle clock keeps running: one draw per cycle)
    return res;
  }
}

// routes the autoplay bot can play (real Samurai chains; the type comes from the chain's last key)
export const ROUTES = {
  cross: { name: 'Cross-cut route', desc: 'Counter Sheathe (E→R: thrust) · Petal Rain (R→Q→E: sweep) · Wind Step (Q→Q: rising cut) → draw', loop: [['E', 'R'], ['R', 'Q', 'E'], ['Q', 'Q']], drop: 0 },
  focused: { name: 'Focused route', desc: 'Moment of Death ×3 (R→E→Q: rising cut each) → draw', loop: [['R', 'E', 'Q']], drop: 0 },
  sloppy: { name: 'Sloppy route (drops)', desc: 'the Cross-cut route, but ~35% of chains are dropped (the last key comes too late)', loop: [['E', 'R'], ['R', 'Q', 'E'], ['Q', 'Q']], drop: 0.35 },
};

/** a full run: the real Sim + arena boss + concept layer. Headless when no renderer listens. */
export class Driver {
  constructor(route = 'cross', { seed = 1, auto = true } = {}) {
    this.route = route; this.R = ROUTES[route]; this.auto = auto; this.C = CLASSES.samurai;
    this.sim = new Sim({ seed: 9100 + seed, spawnEnemies: false });
    this.player = addHero(this.sim, 'samurai', seed, { name: 'Hayate' });
    this.arena = new Arena(this.sim, this.player, 'boss').setup();
    this.bot = new RotBot('samurai', this.R.loop.map((keys) => ({ keys, chain: null })), 'boss', { cycle: false, useUlt: false });
    this.model = new BurstModel(); this.rng = mulberry(77 + seed); this.events = []; this.ticks = 0;
    this.dropping = null; this.pending = 0; this.prepull = auto ? 70 : 0; this.pulled = false; this.listeners = [];
    this.manual = { skill: null, attack: false, mx: 0, my: 0, draw: false };
  }
  get boss() { return this.arena.boss; }
  get gameDealt() { return this.arena.dealt; }
  get dps() { return (this.arena.dealt + this.model.bonus) / Math.max(1, this.ticks / 60); }
  emit(e) { this.events.push(e); for (const f of this.listeners) f(e); }
  step() {
    const { sim, player: p, arena, model } = this, dt = 1 / 60;
    arena.before();
    const t = this.boss;
    let inp;
    if (!this.pulled) { // pre-pull: hold the draw (bot: 70 ticks; player: hold F), release on pull = the first afterimage
      inp = { mx: 0, my: 0, ax: t.x, ay: t.y, attack: false };
      if (this.auto) { if (--this.prepull <= 0) this.pull(); }
      else { if (this.manual.draw) this.hold = (this.hold || 0) + dt; else if (this.hold) { if (this.hold >= CONCEPT.opener.hold) this.pull(); else this.hold = 0; } if (this.manual.skill || this.manual.attack) this.pull(true); }
      this.emit({ k: 'hold', v: this.auto ? 1 - this.prepull / 70 : Math.min(1, (this.hold || 0) / CONCEPT.opener.hold) });
    } else if (this.auto) {
      inp = this.bot.input(sim, p, t);
      // sloppy: a dropped chain = its last key held back past the chain window
      const u = this.bot.si >= 0 ? this.bot.loop[this.bot.ui] : null;
      if (u && this.bot.si === u.keys.length - 1 && this.dropping == null) this.dropping = this.rng() < this.R.drop ? sim.tick : -1;
      if (this.dropping > 0 && inp.skill) { inp.skill = undefined; if (sim.tick - this.dropping > 150) { this.dropping = null; this.bot.si = -1; this.bot.ui = this.bot.nextUi(); model.drop(); this.emit({ k: 'drop' }); } }
      if (this.bot.si < 0 && this.dropping === -1) this.dropping = null;
      // the draw: once the 3 slots are full and the build phase is over, or at the end of the 20 s cycle
      if (!model.drawn && model.cycleT >= CONCEPT.build && (model.imgs.length >= CONCEPT.slots || model.cycleT >= CONCEPT.cycle - 1)) this.burst();
    } else {
      // typed keys queue up (max 3) and each is held as a buffered press until the sim takes it (1 s GCD / a swing), up to 1.3 s
      const m = this.manual; m.queue = m.queue || []; if (m.skill) { if (m.queue.length < 3) m.queue.push({ k: m.skill, t: sim.tick }); m.skill = null; }
      const lh = p.history[p.history.length - 1], q0 = m.queue[0];
      if (q0 && lh && lh.a === q0.k && lh.tick >= q0.t && lh.tick >= (m.lastTaken || -1) + 1 && lh !== m.lastH) { m.lastH = lh; m.lastTaken = lh.tick; m.queue.shift(); }
      while (m.queue[0] && sim.tick - m.queue[0].t > 78) m.queue.shift();
      m.cur = m.queue[0] ? m.queue[0].k : null;
      inp = { mx: m.mx, my: m.my, ax: t.x, ay: t.y, attack: m.attack && !m.cur, skill: m.cur || undefined };
      if (!m.mx && !m.my) { const dx = t.x - p.x, dy = t.y - p.y, dd = Math.hypot(dx, dy); if (dd > t.r + 70) { inp.mx = dx / dd; inp.my = dy / dd; } } // (no WASD: step into melee range on your own)
      if (m.drawTap) { m.drawTap = false; if (!model.drawn) this.burst(); }
      if (!m.cur && this.pending && sim.tick - this.pending > 150) { this.pending = 0; model.drop(); this.emit({ k: 'drop' }); }
    }
    if (inp.skill && this.pulled) { if (!this.pending) this.pending = sim.tick; }
    sim.setInput(p.id, inp);
    sim.step();
    for (const ev of sim.drainEvents()) {
      this.emit({ k: 'sim', ev });
      if (ev.pid === p.id && ev.type === 'chain') {
        const ch = this.C.chains.find((c) => c.id === ev.id); if (!ch) continue;
        this.pending = 0;
        // a longer chain that grows out of the one just finished (R→E Moonlit Guard → R→E→Q Moment of Death) upgrades that afterimage
        const L = this.lastCh;
        if (L && sim.tick - L.tick < 130 && ch.seq.length > L.seq.length && L.seq.every((k, i) => ch.seq[i] === k) && L.im && model.imgs.includes(L.im)) {
          const type = CONCEPT.type[ch.seq[ch.seq.length - 1]];
          if (type) { L.im.type = type; L.im.name = ch.name; model.lastType = type; this.emit({ k: 'upg', im: L.im, name: ch.name }); }
          this.lastCh = { seq: ch.seq, tick: sim.tick, im: L.im }; continue;
        }
        const im = model.chain(ch.seq[ch.seq.length - 1], ch.name, { x: p.x, y: p.y });
        this.lastCh = { seq: ch.seq, tick: sim.tick, im: im && !im.full ? im : null };
        if (im) this.emit({ k: 'img', im, name: ch.name });
        if (this.auto && this.dropping === -1) this.dropping = null;
      }
    }
    arena.after();
    if (this.pulled) model.tick(dt);
    this.ticks += this.pulled ? 1 : 0;
    if (!this.pulled) { this.arena.dealt = 0; }
  }
  pull(dry = false) { this.pulled = true; if (!dry || (this.hold || 0) >= CONCEPT.opener.hold) { const im = this.model.opener({ x: this.player.x - 30, y: this.player.y }); this.emit({ k: 'img', im, name: im.name, opener: true }); } this.emit({ k: 'pull' }); this.hold = 0; }
  burst() { const r = this.model.draw(); this.emit({ k: 'burst', r }); if (this.player.cds.SP <= 0) this.drawSp = true; return r; }
}
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** headless comparison: secs of autoplay per route (no rendering) */
export function compareRoute(route, secs = 120, seed = 1) {
  const d = new Driver(route, { seed });
  while (d.ticks < secs * 60) d.step();
  const b = d.model.log.filter((l) => l.k === 'burst');
  return { route, dps: Math.round(d.dps), gameDps: Math.round(d.gameDealt / (d.ticks / 60)), conceptDps: Math.round(d.model.bonus / (d.ticks / 60)), bursts: b.length, cross: b.filter((x) => x.pat === 'cross').length, focused: b.filter((x) => x.pat === 'focused').length, opc: b.filter((x) => x.opc).length, drops: d.model.log.filter((l) => l.k === 'drop').length, full: b.filter((x) => x.tension >= 100).length };
}
