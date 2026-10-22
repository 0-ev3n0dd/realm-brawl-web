// Skill rework shared systems (docs/SKILL-REWORK-PLAN.md, 2026-10-19):
//  * Boss form: against a boss, a class's moving damage skills run on a SHADOW instead of the hero. The skill code runs
//    unchanged, but with the hero's position swapped for the shadow's around every start / tick, so the shadow dashes,
//    blinks and cuts while the hero stays put (no forced movement into mechanics). The skill's own i-frames are dropped
//    (the hero is not dashing anywhere). Opt-in per class (`CLASSES[c].bossForm`), skills = the evasive list.
//  Dodge is the only player movement tool near a boss (the dedicated mobility key was cut, user 2026-10-20 12:09 AM).
import { CLASSES } from './data/classes.js';

/** a live boss within `r` px of the hero (or an encounter fight on) = boss form */
export const BOSS_FORM = { r: 900, chainKeep: 0, // (0: every step starts from the hero - continuing from the last shadow spot sent dashes past the target and lost ~40% of a chain's damage)
   chainR: 420, lockMax: 18 };
/** Animation lock rule (shared, boss-form classes): near a boss the hero is never held in an animation longer than
 *  lockMax ticks (0.3 s). Past that, a movement input or a dodge hands the rest of the action to the shadow (its damage
 *  still lands) and frees the hero. true = this action can be handed over now. */
export function lockBreakable(sim, p, a) {
  const C = CLASSES[p.cls];
  if (!a || a.bf || !C || !C.bossForm || a.kind === 'dodge' || (a.kind !== 'basic' && a.t < BOSS_FORM.lockMax)) return false; // (basic swings chain back to back: each one hands over at once, or the combo would root the hero)
  if (!(a.lockMove || (a.moveMul ?? 0.35) < 0.9)) return false;
  return bossNear(sim, p);
}
/** hand an action to the shadow (it keeps running from the hero's current spot) */
export function toShadow(p, a) { a.bf = true; if (a.shx == null) { a.shx = p.x; a.shy = p.y; } }
export function bossNear(sim, p) {
  if ((sim.trial && sim.trial.st === 'fight') || (sim.ult && sim.ult.st === 'fight')) return true;
  const list = sim.targetables ? sim.targetables() : sim.enemies; // (online: the prediction sim has no enemies of its own - it reads the drawn server enemies, client/netgame.js)
  for (const e of list) if ((e.boss || e.raid) && !e.dead && Math.abs(e.x - p.x) < BOSS_FORM.r + e.r && Math.abs(e.y - p.y) < BOSS_FORM.r + e.r && Math.hypot(e.x - p.x, e.y - p.y) < BOSS_FORM.r + e.r) return true;
  return false;
}
/** TEMPORARY EXCEPTION (user, 2026-10-19 11:36 PM): Dragoon Lance Fall (the Jump's boss form: straight up, lands where
 *  he stood) keeps its invulnerable leap and stays on the evade whitelist (sim/evade.js); it never runs on a shadow. */
export const KEEP_IFRAMES = { dragoon: new Set(['jump']) };
/** does this cast run on the shadow? Near a boss, EVERY skill / chain step / finisher of a boss-form class runs on the
 *  shadow (2026-10-20 1:00 AM: chain steps that move the hero, and long multi-hit sequences, left the hero stuck in
 *  animation on the boss); the hero stays free to walk / dodge while the shadow performs it. */
export function wantsShadow(sim, p, sk, chain) {
  const C = CLASSES[p.cls];
  if (!C || !C.bossForm) return false;
  if (KEEP_IFRAMES[p.cls] && KEEP_IFRAMES[p.cls].has(chain ? chain.id : sk.id)) return false;
  return bossNear(sim, p);
}
/** run `fn` with the hero standing at the action's shadow; the hero's own position, previous position and i-frames are kept */
export function shadowRun(sim, p, a, fn) {
  if (!a || !a.bf) return fn();
  const rx = p.x, ry = p.y, rpx = p.px, rpy = p.py, ri = p.iframes, rvx = p.vx, rvy = p.vy, rhs = p.hitstop | 0;
  if (a.shx == null) { const L = p.shLast; if (L && sim.tick - L.t < BOSS_FORM.chainKeep && Math.hypot(L.x - p.x, L.y - p.y) < BOSS_FORM.chainR) { a.shx = L.x; a.shy = L.y; } else { a.shx = p.x; a.shy = p.y; } } // (a chain's next step starts where the shadow is)
  p.x = a.shx; p.y = a.shy;
  try { fn(); } finally {
    a.shx = p.x; a.shy = p.y;
    p.x = rx; p.y = ry; p.px = rpx; p.py = rpy; p.vx = rvx; p.vy = rvy;
    if (p.iframes > ri) p.iframes = ri;
    if ((p.hitstop | 0) > rhs) p.hitstop = rhs; // (the shadow's hits never freeze the hero) // (no skill i-frames in boss form: the hero is not moving)
    p.shd = [Math.round(a.shx), Math.round(a.shy)]; p.shLast = { x: a.shx, y: a.shy, t: sim.tick };
  }
}

