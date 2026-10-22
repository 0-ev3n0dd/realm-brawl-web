// Rotation bot: plays a fixed, repeating list of chain "units" (each a key sequence) in the real sim, and spends the
// ultimate on the matching ult-window finisher route. Pure (no DOM): the headless optimizer (tools/rotations/optimize.mjs)
// and the in-browser preview page (rotations.html) both drive the hero with this, so the page plays exactly what was measured.
//   unit = { keys: ['R','E','Q'], chain: 'executioners_verdict' | null }   keys are sim slots: Q E R F(=V key) SP(=F key) B1..B3 (basic swings)
import { BossCycle } from './bosscycle.js';
import { CLASSES } from '../sim/data/classes.js';
import { gcdBlocks } from '../sim/player.js';

export const MELEE = new Set(['warrior', 'cleric', 'bladedancer', 'samurai', 'monk', 'dragoon']);
const SELF_AIM = new Set(['sanctuary', 'ascension']);
/** keyboard label of a sim slot (default binds: V = skill slot F, F = the Special, T = ult, LMB = basic) */
export const KEY_LABEL = { Q: 'Q', E: 'E', R: 'R', F: 'V', SP: 'F', T: 'T', B1: 'LMB', B2: 'LMB', B3: 'LMB' };
export const VALID_SLOTS = Object.keys(KEY_LABEL);

const busy = (p) => !!(p.bufSkill || (p.wq && p.wq.length) || (p.action && p.action.kind === 'skill' && p.action.t < (p.action.cancel ?? p.action.dur) - 1));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class RotBot {
  /** @param {string} cls  @param {{keys:string[],chain?:string}[]} loop  @param {'boss'|'mob'} route  @param {{useUlt?:boolean}} opts */
  constructor(cls, loop, route, opts = {}) {
    this.cls = cls; this.C = CLASSES[cls]; this.route = route;
    this.opener = opts.opener || []; this.loop = [...this.opener, ...loop]; this.wrap = this.opener.length; // (opener units play once, then the loop repeats)
    this.useUlt = opts.useUlt !== false;
    this.gate = opts.gate || 'all'; // 'all': start a chain once every key in it is off cooldown; 'first': start as soon as its first key is (wait mid-chain)
    this.ui = 0; this.si = -1; this.stepT = 0; this.mode = 'fill';
    this.rStepT = 0; this.rLast = -1; this.inRoute = false;
    this.pressed = null; // { key, unit, step, route, tick } of the last key sent (for the overlay)
    this.aborts = 0; this.units = 0; this.ults = 0;
    this.melee = MELEE.has(cls);
    this.cyc = route === 'boss' && opts.cycle !== false ? new BossCycle() : null;
    this.openUlt = !!(this.cyc && opts.openUlt); // (route flag, Samurai only: opener = Special chain -> chains -> ULT, then the cycle) // (boss: bot policy only - rotations/bosscycle.js)
  }
  nextUi() { const n = this.ui + 1; return n >= this.loop.length ? this.wrap : n; }
  /** pick the target: the boss / the densest spot of the pack */
  static pickTarget(sim, p) {
    let best = null, bs = -1;
    for (const e of sim.enemies) {
      if (e.dead) continue;
      if (e.boss) return e;
      let n = 0; for (const o of sim.enemies) if (!o.dead && dist(o, e) < 200) n++;
      const s = n * 1000 - dist(e, p);
      if (s > bs) { bs = s; best = e; }
    }
    return best;
  }
  press(sim, p, inp, key, t, dir, info) {
    inp.skill = key;
    const sk = this.C.skills[key];
    if (sk && SELF_AIM.has(sk.id)) { inp.ax = p.x + Math.cos(dir); inp.ay = p.y + Math.sin(dir); }
    this.pressed = { key, tick: sim.tick, ...info };
  }
  input(sim, p, t) {
    if (!t || t.dead) return { mx: 0, my: 0, ax: p.x + 1, ay: p.y, attack: false };
    const C = this.C, bd = dist(t, p), dir = Math.atan2(t.y - p.y, t.x - p.x);
    const pref = this.melee ? 45 + t.r : 290;
    const s = bd > pref + 25 ? 1 : bd < pref - 70 ? -1 : 0;
    const inp = { mx: Math.cos(dir) * s, my: Math.sin(dir) * s, ax: t.x, ay: t.y, attack: false };
    const inRange = bd < (this.melee ? t.r + 110 : 520);
    const host = p.eclipse || p.uw;
    if (this.cyc) this.cyc.tick(sim, p);
    // ---- ult-window finisher route
    if (host && host.rt && this.inRoute) {
      const r = C.routes.find((q) => q.route === this.route), rt = host.rt, R = this.route;
      if (rt.x[R] || rt.fin || rt.st[R] >= r.seq.length || sim.tick - this.rStepT > 300) { this.inRoute = false; }
      else {
        const i = rt.st[R];
        if (i !== this.rLast) { this.rLast = i; this.rStepT = sim.tick; }
        this.mode = 'route';
        inp.attack = inRange;
        const key = r.seq[i];
        if (!busy(p) && !gcdBlocks(sim, p, key) && p.cds[key] <= 0 && (!this.melee || bd < t.r + 220 || C.skills[key].id === 'slam')) this.press(sim, p, inp, key, t, dir, { route: true, step: i });
        return inp;
      }
    }
    if (!host) this.inRoute = false;
    if (this.si < 0) {
      if (this.openUlt && this.useUlt && this.firstUlt == null && this.units >= this.wrap && !host) { // opener ends with the first ult: basics (real hit trickle) top the meter up if needed, max 15 s
        if (this.openWait == null) this.openWait = sim.tick;
        if (p.ult < 100 && sim.tick - this.openWait < 900) { inp.attack = inRange; this.mode = 'fill'; this.openFill = sim.tick - this.openWait; if (inp.attack) this.pressed = { key: 'B1', tick: sim.tick, fill: true }; return inp; }
      }
      // between units: the ultimate first when the meter is full
      if (this.useUlt && C.routes && p.ult >= 100 && !host && inRange && !busy(p) && (!this.cyc || this.cyc.ultOk(sim))) { // (boss: one ult per Special cycle, right after the Special chain)
        if (this.cyc) this.cyc.cast(sim);
        if (this.firstUlt == null) { this.firstUlt = sim.tick; this.firstUltInOpener = this.units <= this.wrap; }
        inp.ult = true; this.ults++; this.inRoute = true; this.rLast = -1; this.rStepT = sim.tick + 30; this.mode = 'ult';
        this.pressed = { key: 'T', tick: sim.tick, ult: true };
        return inp;
      }
      if (this.cyc && this.ui >= this.wrap && !(p.cds.SP > 0) && !(this.openUlt && host)) { const i = this.loop.findIndex((q, j) => j >= this.wrap && q.keys.includes('SP')); if (i >= 0) this.ui = i; } // (boss: the Special chain as soon as it is up - it is the cycle's hinge)
      let u = this.loop[this.ui], guard = 0;
      while (u.keys.includes('SP') && (p.cds.SP > 0 || (this.openUlt && host)) && guard++ < this.loop.length) { this.ui = this.nextUi(); u = this.loop[this.ui]; } // (Special on cooldown: skip its unit)
      const pre = this.gate === 'first' ? u.keys.slice(0, 1) : u.keys.includes('SP') ? u.keys.slice(0, u.keys.indexOf('SP') + 1) : u.keys;
      const keys = [...new Set(pre.filter((k) => !/^B/.test(k)))];
      const cost = keys.reduce((a, k) => a + (C.skills[k].cost || 0), 0);
      const free = p.aura > 0 || p.eclipse || p.uw;
      const ready = keys.every((k) => p.cds[k] <= 0) && (free || p.res >= Math.min(cost, p.stats.maxRes * 0.95));
      const lb = p.history[p.history.length - 1];
      const stray = lb && /^B/.test(lb.a) && !/^B/.test(u.keys[0]) && sim.tick - lb.tick < 70 && C.chains.some((c) => c.seq.length === 2 && c.seq[0] === lb.a && c.seq[1] === u.keys[0]);
      if (ready && stray) { this.mode = 'wait'; return inp; }
      if (ready && inRange && (!this.melee || bd < t.r + 90) && !busy(p)) { this.si = 0; this.stepT = sim.tick; this.mode = 'unit'; }
      else { inp.attack = inRange; this.mode = 'fill'; if (inp.attack) this.pressed = this.pressed && this.pressed.fill ? this.pressed : { key: 'B1', tick: sim.tick, fill: true }; return inp; }
    }
    const u = this.loop[this.ui], k = u.keys[this.si];
    const last = p.history[p.history.length - 1];
    if (last && last.a === k && last.tick >= this.stepT) {
      this.si++; this.stepT = Math.max(sim.tick, last.tick + 1);
      if (this.si >= u.keys.length) { this.si = -1; this.ui = this.nextUi(); this.units++; return inp; }
      return this.input(sim, p, t);
    }
    if (sim.tick - this.stepT > 200) { this.si = -1; this.ui = this.nextUi(); this.aborts++; return inp; } // stuck: next unit
    if (/^B/.test(k)) { inp.attack = true; this.pressed = { key: k, tick: sim.tick, unit: this.ui, step: this.si }; }
    else if (!busy(p) && !gcdBlocks(sim, p, k) && p.cds[k] <= 0) this.press(sim, p, inp, k, t, dir, { unit: this.ui, step: this.si });
    return inp;
  }
}
