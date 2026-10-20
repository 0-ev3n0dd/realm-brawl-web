// Warrior hold-to-spend Glory on the client: turns skill key down/up into sim commands.
//  * canHold(key) false (other classes, too little Glory, stance-swap keys): the press fires at once, as before.
//  * canHold(key) true: nothing is sent on press. Releasing before `tap` ticks sends a normal cast (charge 0); holding past it
//    charges (the command carries hold: key for the charge-up visual) and releasing sends the cast with charge = ticks held.
//    At `full` ticks it fires on its own. Counted in sim ticks (one tick() per command), so it matches the sim's 60 Hz.
// Shared by the desktop input (input.js) and the phone controls (mobile/js/mgame.js).
import { CLASSES } from '../sim/data/classes.js';

export const HOLD = { tap: 15, full: 30 };
const HOLD_KEYS = new Set(['Q', 'E', 'R', 'F']);
/** Should a press of `key` by player `p` wait for a possible hold? (Warrior with 30+ Glory, or in the ult window where it's free.) */
export function holdable(p, key) {
  const c = p && CLASSES[p.cls];
  return !!(c && c.hold && HOLD_KEYS.has(key) && !p.dead); // (no class uses holds now: the Warrior spends Glory through its chains)
}
export class SkillHold {
  constructor() { this.cur = null; this.out = []; }
  /** Key down. `can` = holdable right now. */
  press(key, can) {
    if (this.cur) this.release(this.cur.key);
    if (!can) { this.out.push({ skill: key }); return; }
    this.cur = { key, t: 0, fired: false };
  }
  /** Key up (`force` = fire whatever state, e.g. on blur). */
  release(key) {
    const c = this.cur;
    if (!c || c.key !== key) return;
    this.cur = null;
    if (!c.fired) this.out.push(c.t >= HOLD.tap ? { skill: key, charge: c.t } : { skill: key });
  }
  /** Drop a hold without casting (menus, focus loss). */
  cancel() { this.cur = null; this.out.length = 0; }
  /** One sim tick: advances the charge. Returns { edge (a skill command or null), hold (key being charged or null), t }. */
  tick() {
    const c = this.cur;
    if (c && !c.fired) {
      c.t++;
      if (c.t >= HOLD.full) { c.fired = true; this.out.push({ skill: c.key, charge: HOLD.full }); }
    }
    return { edge: this.out.shift() || null, hold: c && !c.fired ? c.key : null, t: c ? c.t : 0 };
  }
}
