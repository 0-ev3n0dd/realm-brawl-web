// Game loop C1 (2026-10-09): level scaling for the level cap 50. Content that moves to a new level band (the re-band of
// Dunes / Frost / Ember, Map 5) keeps the FEEL it was tuned for: everything is scaled by how much an on-level hero grew
// between the level it was tuned at (`was`) and the level it sits at now (`L`).
//   HP     (bosses, Trials, the raid; normal mobs use the mob HP curve directly)  x power(L) / power(was)
//   damage (every enemy hit)                                                       x ehp(L) / ehp(was)
//   XP     (kill XP)                                                               x xpNeed(L) / xpNeed(was)
// power = on-level hero damage (= the mob HP curve, sim/mobhp.js normalHp); ehp = on-level hero HP x (1 + DEF / 100),
// measured with the balance harness (tools/balance/mobpower.mjs, out/lvpower.json), smoothed. Same level -> x1.
import { normalHp, ZONE_LV } from './mobhp.js';

/** on-level effective HP: measured L1..50 (out/lvpower.json: x13.5 from L1 to 20, x2.83 from 20 to 50), fit as two
 *  exponentials (the raw table jumps where the ladder swaps a set in) */
export const EHP_C = { lo: 0.137, hi: 0.0347 };
export const ehpAt = (L) => { L = Math.max(1, Math.min(60, L)); return Math.exp((L <= 20 ? EHP_C.lo : EHP_C.hi) * (L - 20)); };
/** damage follows EHP a little softer (x^0.85): a hero walking into a new band is rarely in its full on-level kit yet */
export const DMG_EXP = 0.85;
export const powerAt = (L) => normalHp(Math.max(1, L)) / normalHp(20);
/** the hero XP curve (sim/progression.js xpToNext, without the cap) */
export const xpNeed = (L) => Math.round(30 * Math.pow(Math.max(1, L), 1.75) + 20);

export const hpK = (L, was) => (was && L && L !== was ? powerAt(L) / powerAt(was) : 1);
export const dmgK = (L, was) => (was && L && L !== was ? Math.pow(ehpAt(L) / ehpAt(was), DMG_EXP) : 1);
export const xpK = (L, was) => (was && L && L !== was ? xpNeed(L) / xpNeed(was) : 1);

/** loop playtest fix (2026-10-15): XP by level gap. A kill far above you counts like one 3 levels up (no more L2 -> L10 from
 *  one Wilds mission); a kill well below you pays less (12% per level past 2 below, floor 25%), so a hero can't run 8-10
 *  levels ahead of the map bands and reach the cap before the Astral Rift. At the cap (XP -> Mastery) nothing changes. */
export const XP_GAP = { up: 3, down: 2, per: 0.12, floor: 0.25 };
export function xpGapMul(P, L, cap = 50) {
  if (!(L > 0) || !(P > 0) || P >= cap) return 1;
  if (L > P + XP_GAP.up) return xpNeed(P + XP_GAP.up) / xpNeed(L);
  if (L < P - XP_GAP.down) return Math.max(XP_GAP.floor, 1 - XP_GAP.per * (P - XP_GAP.down - L));
  return 1;
}
/** Bosses and boss-like encounters: [level now, level tuned at]. Types not listed are unscaled. Filled per band by the
 *  re-band (C2: Dunes / Frost / Ember) and Map 5 (C3). */
export const BOSS_LV = {
  // game loop C2 re-band: Dunes world bosses (tuned on Dunes gear, L15), Tomb 20; Frost 28-29 + Crypt 30; Emberdeep 38-39 + Forge 40
  khepra: [19, 15], ankhara: [18, 14], sekhem: [19, 15], neferakh: [20, 15],
  skaldra: [29, 19], morwen: [28, 18], vyrnhal: [28, 18], osric: [30, 19],
  pyrrhex: [39, 22], vitrea: [38, 21], solgrim: [38, 21], hephast: [40, 22],
  // game loop C3: the Astral Rift's world bosses (Ember-sized base stats, tuned-at like Emberdeep's) + Vorthax, Map 5's dungeon (L49)
  nyxara: [44, 21], orrery: [46, 21], zerath: [48, 22], raidboss: [49, 20], // (the raid was tuned on the L20 raid scene)
};
/** scale a freshly spawned boss / raid enemy in place (HP, damage, XP) */
export function scaleBoss(e, type) {
  const r = BOSS_LV[type]; if (!r) return e;
  const [L, was] = r, h = hpK(L, was), d = dmgK(L, was), x = xpK(L, was);
  if (h !== 1) { e.maxHp = Math.round(e.maxHp * h); e.hp = Math.round(e.hp * h); if (e.baseMaxHp) e.baseMaxHp = Math.round(e.baseMaxHp * h); }
  if (d !== 1) e.dmg *= d;
  if (x !== 1) e.xp = Math.round(e.xp * x);
  e.blv = L;
  return e;
}
/** encounters that set their own HP (Trials, Astrael, the raid): [level now, level tuned at] */
export const ENC_LV = {
  // dungeon bosses (their HP is set when the fight starts) + the Trials (k = trials.js fight key; damage there is % of max HP)
  tomb: [20, 15], crypt: [30, 19], forge: [40, 22],
  nf: [20, 15], sk: [30, 20], py: [40, 20],
  ast: [50, 16],
  hollow: [12, 12], vht: [12, 12], // (2026-10-18: the Wilds' dungeon (Lumivex) + Trial (Vharok): tuned at their own level) // (game loop C3: Astrael, the endgame Trial / Extreme at the cap)
};
export const encHpK = (k) => (ENC_LV[k] ? hpK(ENC_LV[k][0], ENC_LV[k][1]) : 1);
export const encDmgK = (k) => (ENC_LV[k] ? dmgK(ENC_LV[k][0], ENC_LV[k][1]) : 1);

/** a map's mission-arena damage factor (mission bosses set their damage from a per-map reference: opsrun2/3 setDmg) */
export const OPS_ZONE_OF = { wilds: 81, dunes: 82, frost: 83, ember: 84, rift: 85 };
export function opsDmgK(biome) { const r = ZONE_LV[OPS_ZONE_OF[biome]]; return r ? dmgK(r[1], r[5] ?? r[1]) : 1; }

/** Leveling pace (2026-10-15, "leveling is too fast"): every XP gain is scaled by the hero's level band: x0.5 up to Lv 20
 *  (2x slower early / mid), easing to x0.62 at Lv 50 (~1.6x slower late). Applied once in combat.gainXp, after the
 *  over / under-level gap caps (xpGapMul), so those keep their shape. tools/loop50.mjs measures it. */
export const XP_RATE = { early: 0.5, late: 0.62, from: 20, to: 50 };
export function xpRate(L) {
  const t = Math.max(0, Math.min(1, ((L | 0) - XP_RATE.from) / (XP_RATE.to - XP_RATE.from)));
  return XP_RATE.early + (XP_RATE.late - XP_RATE.early) * t * t * (3 - 2 * t);
}
