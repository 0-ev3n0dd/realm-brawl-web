// CONCEPT ONLY (2026-10-22): "Void Sheath Mark" (Samurai). Preview layer on the REAL sim: the real Delayed Cuts, the real Void Sheath
// (boss Special chain, real 18 s cooldown), the real ultimate (Blade of the Void -> One Perfect Cut). The concept adds ONE rule:
// Void Sheath marks the boss for K.dur ticks; a One Perfect Cut that lands on a marked boss cashes its Delayed Cuts out TWICE
// (the second cash-out = the cuts share of the real split hit, per x n / (base + per x n), added as placeholder concept damage).
// The bot plays the live v2026.1022.2120 policy (Special the moment it is back, ult the moment the meter is full); HoldBot only
// delays them for the "hold 1/2/4 s" comparisons. Nothing in the game changes.
import { RotBot } from '../rotations/rotbot.js';

export const PERFECT = { base: 10, per: 0.6 }; // (read-only copy of SAM.perfect in sim/samurai.js, for the share)
export class VoidMark {
  static id = 'mark'; static title = 'E · Void Sheath Mark';
  static blurb = 'Real Delayed Cuts, real Void Sheath (R→E→Q→F→R, its real 18 s cooldown), real ultimate. One concept rule: Void Sheath leaves a Void Mark on the boss (an ink ensō with a blossom). While the boss is marked, One Perfect Cut cashes out its Delayed Cuts TWICE. Using the Special and the ultimate on cooldown is what lands the split inside the mark; chains between them build cuts going into it.';
  static K = { dur: 600 }; // (10 s: Void Sheath -> One Perfect Cut split is 8.4-9.5 s on cooldown play - ult ~4 s after Void Sheath + the ult window + the finisher)
  constructor() { this.bonus = 0; this.markEnd = -1; this.markT = -1; this.opcs = 0; this.marked = 0; this.specials = 0; this.casts = 0; this.cutsAtOpc = []; this.doubles = []; this.gap = []; this.wasted = 0; }
  marked_(d) { return d.sim.tick <= this.markEnd; }
  chain() { return null; }
  tick() { return null; }
  sim(ev, d) {
    const p = d.player; if (ev.pid !== p.id) return null;
    if (ev.type === 'chain' && ev.id === 'void_sheath') { if (this.marked_(d)) this.wasted++; this.specials++; this.markT = d.sim.tick; this.markEnd = d.sim.tick + this.constructor.K.dur; return { fx: 'mark', dur: this.constructor.K.dur }; }
    if (ev.type === 'ult') { this.casts++; return null; }
    if (ev.type === 'samx' && ev.ph === 'split' && d.boss && ev.id === d.boss.id) {
      this.opcs++; const n = ev.n || 0; this.cutsAtOpc.push(n); if (this.markT >= 0) this.gap.push((d.sim.tick - this.markT) / 60);
      if (!this.marked_(d) || !n) return { fx: 'opc', cuts: n, marked: false };
      const h0 = d.arena.hp.get(d.boss), hit = h0 != null ? Math.max(0, h0 - Math.max(0, d.boss.hp)) : 0;
      const b = Math.round(hit * (PERFECT.per * n) / (PERFECT.base + PERFECT.per * n)); this.bonus += b; this.marked++; this.doubles.push(b); this.markEnd = -1; // (consumed)
      return { bonus: b, fx: 'markcash', cuts: n, marked: true };
    }
    return null;
  }
  wantBurst() { return false; } burst() { return false; }
  widget(d) { const p = d && d.player, left = d ? Math.max(0, this.markEnd - d.sim.tick) : 0; return { kind: 'mark', mark: left / this.constructor.K.dur, left: left / 60, ult: p ? Math.floor(p.ult) : 0, uw: !!(p && p.uw) }; }
}

/** the live rotations bot, optionally holding the Special / the ultimate for spHold / ultHold ticks after they are ready (comparisons). */
export class HoldBot extends RotBot {
  constructor(cls, loop, route, o = {}) { super(cls, loop, route, o); this.spHold = o.spHold || 0; this.ultHold = o.ultHold || 0; this.spRdy = null; this.ultRdy = null; }
  input(sim, p, t) {
    if (this._in || (!this.spHold && !this.ultHold)) return super.input(sim, p, t); // (RotBot.input recurses with the proxied hero)
    const sp = p.cds.SP || 0; if (sp > 0) { this.spRdy = null; this.spUsed = true; } else if (this.spRdy == null) this.spRdy = this.spUsed ? sim.tick : -1e9; // (the pull's first Special is not held)
    if (p.ult < 100 || p.uw) this.ultRdy = null; else if (this.ultRdy == null) this.ultRdy = sim.tick;
    const spEff = sp > 0 ? sp : Math.max(0, this.spRdy + this.spHold - sim.tick), ultEff = p.ult >= 100 && this.ultRdy != null && sim.tick - this.ultRdy < this.ultHold ? 99 : p.ult;
    const cds = new Proxy(p.cds, { get: (o, k) => (k === 'SP' ? spEff : o[k]) });
    const pp = new Proxy(p, { get: (o, k) => (k === 'cds' ? cds : k === 'ult' ? ultEff : o[k]) });
    this._in = true; try { return super.input(sim, pp, t); } finally { this._in = false; }
  }
}
