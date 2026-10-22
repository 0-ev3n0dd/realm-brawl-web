// CONCEPT ONLY (2026-10-22): "Void Sheath Mark" (Samurai). Preview layer on the REAL sim: the real Delayed Cuts, the real Void Sheath
// (boss Special chain, real 18 s cooldown), the real ultimate (Blade of the Void -> One Perfect Cut). The concept adds ONE rule:
// Void Sheath marks the boss for K.dur ticks; a One Perfect Cut that lands on a marked boss cashes its Delayed Cuts out TWICE
// (the second cash-out = the cuts share of the real split hit, per x n / (base + per x n), added as placeholder concept damage).
// The bot plays the live v2026.1022.2120 policy (Special the moment it is back, ult the moment the meter is full); HoldBot only
// delays them for the "hold 1/2/4 s" comparisons. Nothing in the game changes.
import { RotBot } from '../rotations/rotbot.js';
import { stackN } from '../sim/kit.js';

export const PERFECT = { base: 10, per: 0.6 }; // (read-only copy of SAM.perfect in sim/samurai.js, for the share)
export class VoidMark {
  static id = 'mark'; static title = 'E · Void Sheath Mark';
  static blurb = 'Real Delayed Cuts, real Void Sheath (R→E→Q→F→R, its real 18 s cooldown), real ultimate. One concept rule: Void Sheath leaves a Void Mark on the boss (an ink ensō with a blossom). While the boss is marked, One Perfect Cut cashes out its Delayed Cuts TWICE. Using the Special and the ultimate on cooldown is what lands the split inside the mark; chains between them build cuts going into it.';
  static K = { dur: 600 }; // (10 s: Void Sheath -> One Perfect Cut split is 8.4-9.5 s on cooldown play - ult ~4 s after Void Sheath + the ult window + the finisher)
  // ult-window buffs (variants, stacked on the mark; placeholder CONCEPT damage, the sim is untouched). Set by route.buff.
  //  cuts:   hits during the ult window build x K.cutsMul Delayed Cuts (the extra cuts burst / split with the real ones)
  //  hold:   sheathes inside the ult window do not burst the cuts built inside the window (that burst damage is removed); they land on One Perfect Cut, each worth K.holdW cuts
  //  chains: damage dealt during the ult window (except the One Perfect Cut split itself) +K.chainPct
  static BUFF = { unified: { cutsMul: 1.5 }, cuts: { cutsMul: 2 }, hold: { holdW: 1.5 }, chains: { chainPct: 0.6 } };
  static BUFFS = { unified: 'Void Sheath Mark (unified)', none: 'plain mark', cuts: 'Doubled cuts', hold: 'No burst on sheathe', chains: 'Stronger chains' };
  static tuneText(id) { const B = VoidMark.BUFF[id]; return id === 'unified' ? `×${B.cutsMul} cuts in the ult, held, cashed ×2` : id === 'cuts' ? `×${B.cutsMul} cuts` : id === 'hold' ? `held cuts ×${B.holdW}` : id === 'chains' ? `+${Math.round(B.chainPct * 100)}% damage` : ''; }
  static get BUFF_BLURB() { return { unified: `One loop around Delayed Cuts: Void Sheath (the Special, on cooldown) marks the boss for 10 s → cast the ultimate inside it: while it is active, hits build ×${VoidMark.BUFF.unified.cutsMul} Delayed Cuts and sheathes HOLD the cuts built in the window instead of bursting them → One Perfect Cut inside the mark cashes every held cut out twice. Cuts from before the ult still burst as usual. No separate damage buff: everything feeds the one cash-out.`, cuts: `Variant: while the ultimate is active, every hit builds ×${VoidMark.BUFF.cuts.cutsMul} Delayed Cuts on the boss, so the marked One Perfect Cut splits on twice the cuts.`,
    hold: `Variant: while the ultimate is active, sheathes do not burst the cuts built inside the window (those bursts deal nothing); they all ride into One Perfect Cut, each worth ×${VoidMark.BUFF.hold.holdW} cuts. Cuts from before the ult still burst as usual.`,
    chains: `Variant: while the ultimate is active, chain hits on the boss deal +${Math.round(VoidMark.BUFF.chains.chainPct * 100)}% damage (not the One Perfect Cut split itself).` }; }
  constructor(buff = null) { this.buff = buff && buff !== 'none' ? buff : null; this.bk = this.buff ? { ...VoidMark.BUFF[this.buff] } : {}; this.extra = 0; this.held = 0; this.prevN = 0; this.pend = 0; this.lastUwDmg = 0; this.buffBonus = 0; this.extraAtOpc = [];
    this.bonus = 0; this.markEnd = -1; this.markT = -1; this.opcs = 0; this.marked = 0; this.specials = 0; this.casts = 0; this.cutsAtOpc = []; this.doubles = []; this.gap = []; this.wasted = 0; }
  marked_(d) { return d.sim.tick <= this.markEnd; }
  chain() { return null; }
  add_(b) { this.bonus += b; this.buffBonus += b; return b; }
  tick(d) { const p = d.player, B = d.boss; if (!this.buff || !B) return null; const cur = B.dead ? 0 : stackN(B, 'cut', p.id);
    if ((this.buff === 'cuts' || this.buff === 'unified') && p.uw && cur > this.prevN) this.extra += (cur - this.prevN) * (this.bk.cutsMul - 1);
    if (!cur && !p.uw) { this.extra = 0; this.held = 0; } this.prevN = cur; this.pend = 0; return null; }
  sim(ev, d) {
    const p = d.player;
    if (this.buff && ev.type === 'dmg' && ev.pid === p.id && d.boss && ev.id === d.boss.id) { // (placeholder buff damage riding on real hits)
      if (this.pend) { this.add_(Math.round(ev.amount * this.pend)); this.pend = 0; }
      if (this.buff === 'chains' && p.uw) { const b = Math.round(ev.amount * this.bk.chainPct); this.add_(b); this.lastUwDmg = b; }
      return null; }
    if (ev.pid !== p.id) return null;
    if (this.buff && ev.type === 'samx' && ev.ph === 'burst' && d.boss && ev.id === d.boss.id && ev.n) {
      if (this.buff === 'cuts' && this.extra) { const x = Math.min(this.extra, ev.n * (this.bk.cutsMul - 1)); this.extra -= x; this.pend = x / ev.n; }
      if ((this.buff === 'hold' || this.buff === 'unified') && p.uw && !this.splitDone) { const k = Math.max(0, ev.n - this.pre); this.pre = 0; if (k) { this.held += k; this.pend = -k / ev.n; } } // (only cuts built inside the window are held; older cuts still burst)
      return null; }
    if (ev.type === 'ult') { this.splitDone = false; this.pre = d.boss && !d.boss.dead ? stackN(d.boss, 'cut', p.id) : 0; }
    if (ev.type === 'chain' && ev.id === 'void_sheath') { if (this.marked_(d)) this.wasted++; this.specials++; this.markT = d.sim.tick; this.markEnd = d.sim.tick + this.constructor.K.dur; return { fx: 'mark', dur: this.constructor.K.dur }; }
    if (ev.type === 'ult') { this.casts++; return null; }
    if (ev.type === 'samx' && ev.ph === 'split' && d.boss && ev.id === d.boss.id) {
      this.opcs++; this.splitDone = true; let n = ev.n || 0; const h0x = d.arena.hp.get(d.boss), hitx = h0x != null ? Math.max(0, h0x - Math.max(0, d.boss.hp)) : 0;
      if (this.buff === 'chains') { this.add_(-this.lastUwDmg); } // (the split hit itself is not a chain)
      const xn = this.buff === 'cuts' ? this.extra : this.buff === 'hold' ? this.held * this.bk.holdW : this.buff === 'unified' ? this.held + this.extra : 0; this.extra = 0; this.held = 0; this.extraAtOpc.push(xn);
      if (xn && hitx) this.add_(Math.round(hitx * PERFECT.per * xn / (PERFECT.base + PERFECT.per * n)));
      const n0 = n; n = n0 + xn; const sh = (k) => hitx * PERFECT.per * k / (PERFECT.base + PERFECT.per * n0); this.cutsAtOpc.push(n); if (this.markT >= 0) this.gap.push((d.sim.tick - this.markT) / 60);
      if (!this.marked_(d) || !n) return { fx: 'opc', cuts: n, marked: false };
      const b = Math.round(sh(n)); this.bonus += b; this.marked++; this.doubles.push(b); this.markEnd = -1; // (consumed)
      return { bonus: b, fx: 'markcash', cuts: n, marked: true, buff: this.buff, xn };
    }
    return null;
  }
  wantBurst() { return false; } burst() { return false; }
  widget(d) { const p = d && d.player, left = d ? Math.max(0, this.markEnd - d.sim.tick) : 0; return { kind: 'mark', held: this.buff === 'unified' && p && p.uw ? Math.round(this.held + this.extra + (d.boss && !d.boss.dead ? stackN(d.boss, 'cut', p.id) : 0)) : 0, mark: left / this.constructor.K.dur, left: left / 60, ult: p ? Math.floor(p.ult) : 0, uw: !!(p && p.uw) }; }
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
