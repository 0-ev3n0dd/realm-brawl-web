// Evasive dashes (2026-10-06). Every ability that carries the hero as a dash / blink / charge / leap / dive / teleport
// puts them in the same evade state as Dodge for the dash movement window: i-frames (damagePlayer skips the hit, so boss
// %-of-max-HP hits, mechanics that respect i-frames and the CC riding on hits are avoided too). Perfect-dodge procs
// (Blade Dancer Shadow Time, Warrior Iron Rebuke via guardDodge) stay tied to the real Dodge: combat.js only fires
// them for a.kind === 'dodge'.
// The flag lives on the ability definitions (`evade: true` on skills / ults / chains in CLASSES, set below from one
// list); the melee basic opener's gap-closer dash is always evasive. runAction() measures the action's movement each
// tick and, while an evasive ability moves the hero >= EVADE.minStep px, keeps p.iframes up (+ p.evade for the visual).
// tools/evade-audit.mjs + test/evade.test.js keep the list equal to what actually moves the hero.
import { CLASSES } from './data/classes.js';

export const EVADE = { minStep: 7, tail: 3 }; // 7 px/tick = 420 px/s (walking is 195 px/s); i-frames last 3 ticks past each dash tick
/** class -> ids: 'skill:<id>' (skills + Specials), 'ult:<id>', 'chain:<id>' (chains, Special chains, ult-window finisher
 * routes). = node tools/evade-audit.mjs --json (+ Shadow Execution: a Marks chain the audit can't set up; it runs Heartseeker's lunge). */
export const EVASIVE = {
  warrior: ['chain:executioners_verdict', 'chain:rift_cleave', 'skill:ax_flurry', 'ult:warlord'],
  ranger: ['chain:deadeye', 'chain:skyline_scatter', 'skill:dashshot'],
  mage: ['chain:comet_step', 'chain:ember_blink', 'skill:blink'],
  cleric: ['chain:crusaders_verdict', 'skill:shieldrush'],
  bladedancer: ['chain:clone_barrage', 'chain:crimson_flurry', 'chain:death_blossom', 'chain:eviscerate', 'chain:shadow_execution', 'chain:shadow_pierce', 'chain:shadow_step', 'chain:shadow_strike', 'chain:smoke_lotus', 'chain:ten_thousand_cuts', 'skill:flicker', 'skill:heartseeker', 'skill:thousandcuts', 'skill:vanish'],
  samurai: ['chain:moment_of_death', 'chain:one_perfect_cut', 'chain:petal_rain', 'chain:twin_moons', 'chain:void_echo', 'chain:wind_step', 'skill:iaido', 'ult:void_blade'],
  monk: ['chain:dragon_sweep', 'chain:heaven_splitting_palm', 'chain:hundred_hands', 'chain:nerve_strike', 'chain:rising_dragon', 'skill:crane_kick', 'skill:dragons_descent'],
  // dragoon 'skill:jump' = Lance Fall in boss form: a TEMPORARY exception that keeps its invulnerable leap (CLAUDE.md, sim/skillform.js KEEP_IFRAMES)
  dragoon: ['chain:dragon_dive', 'chain:high_jump', 'chain:impale_rush', 'chain:spineshatter', 'chain:whirling_lance', 'skill:jump', 'skill:piercing_thrust'],
  summoner: [],
  bard: ['chain:quickstep'],
};

const sets = {};
for (const [cls, ids] of Object.entries(EVASIVE)) {
  const C = CLASSES[cls]; if (!C) continue;
  sets[cls] = new Set(ids);
  for (const k of Object.keys(C.skills)) if (sets[cls].has('skill:' + C.skills[k].id)) C.skills[k].evade = true;
  if (C.ult && sets[cls].has('ult:' + C.ult.id)) C.ult.evade = true;
  for (const ch of [...(C.chains || []), ...(C.routes || [])]) if (sets[cls].has('chain:' + ch.id)) ch.evade = true;
}
/** Is this (non-dodge) action an evasive dash right now? */
export function evasive(p, a) {
  if (!a || a.kind === 'dodge') return false;
  if (a.kind === 'basic') return !!(a.dashN && a.dt <= a.dashN);
  if (a.chain) return !!a.chain.evade;
  const C = CLASSES[p.cls];
  if (a.key === 'T') return !!(C.ult && C.ult.id === a.id && C.ult.evade);
  return !!(sets[p.cls] && sets[p.cls].has('skill:' + a.id));
}
/** After runAction: while an evasive ability moved the hero a dash step this tick, the hero is evading. */
export function evadeStep(sim, p, a, x0, y0) {
  if (p.evade > 0) p.evade--;
  const d = a ? Math.hypot(p.x - x0, p.y - y0) : 0;
  p.actStep = d; // (how far the action carried you this tick: read by tools/evade-audit.mjs)
  if (!a || d < EVADE.minStep || !evasive(p, a)) return;
  if (!(p.evade > 0) && !sim.predicting) sim.emit({ type: 'evadeDash', pid: p.id, x: p.x, y: p.y, fx: x0, fy: y0 });
  p.iframes = Math.max(p.iframes || 0, EVADE.tail);
  p.evade = EVADE.tail;
}
