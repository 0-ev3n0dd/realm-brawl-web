// Boss rotation cycle (2026-10-21, rebuilt): NO new game mechanics. This is only the rotation BOT's boss policy plus the
// names the rotations page shows. Each class's cycle runs on its EXISTING signature mechanic exactly as the sim implements it
// (sim/data/classes.js `stack` and friends); nothing here touches damage, stacks, cooldowns or the ult meter.
//   * the class's boss Special chain (the boss chain containing the Special) is pressed as soon as the Special is off its
//     real cooldown: it is the cycle's hinge, so the cycle = the Special's own cooldown (16-18 s) + GCD slack;
//   * the ultimate is held until that Special chain has fired since the last ult, then cast in the gap right after it
//     (one ult per Special cycle). If the meter is not full yet, it is cast as soon as it fills.
import { CLASSES, SPK } from '../sim/data/classes.js';

const SP_CHAIN = Object.fromEntries(Object.entries(CLASSES).map(([id, C]) => [id, (C.chains || []).find((c) => c.kind === 'boss' && c.seq.includes(SPK)) || null]));
export const spChainOf = (cls) => SP_CHAIN[cls];
/** each class's real signature mechanic (names / descriptions straight from the class data) */
export const MECH = {
  warrior: 'Bleed', ranger: 'Quarry', mage: 'Burn', cleric: 'Condemn', bladedancer: 'Edge + Shadow Marks', samurai: 'Delayed Cuts',
  monk: 'Pressure Points', dragoon: 'Impaled', summoner: 'Ink + Chill', bard: 'Tempo + Dissonant',
};
export const mechOf = (cls) => MECH[cls] || (CLASSES[cls].stack && CLASSES[cls].stack.name) || null;
export const spCdOf = (cls) => (CLASSES[cls].skills[SPK] || {}).cd || 0;

/** bot policy: track the Special presses (from the real cooldown) and allow one ult per Special cycle */
export class BossCycle {
  constructor() { this.spTick = -1; this.ultTick = -1; this.prevCd = 0; this.fullSince = -1; }
  tick(sim, p) {
    const cd = p.cds[SPK] || 0;
    if (cd > this.prevCd + 1) this.spTick = sim.tick; // the Special just went on cooldown: it was pressed
    this.prevCd = cd;
    if (p.ult >= 100) { if (this.fullSince < 0) this.fullSince = sim.tick; } else this.fullSince = -1;
  }
  /** cast now? after the cycle's Special (once per cycle); a meter that sat full for a whole cycle is spent anyway */
  ultOk(sim) { return this.spTick > this.ultTick || (this.fullSince >= 0 && sim.tick - this.fullSince > 22 * 60); }
  cast(sim) { this.ultTick = sim.tick; }
}
