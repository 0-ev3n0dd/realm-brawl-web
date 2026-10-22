// Grand balance pass (tools/balance/harness.mjs measures it; previews/balance/BALANCE.md has the before / after tables).
// One place for the class-wide damage tuning: numbers only, every kit / chain stays as designed.
//   CLASS_TUNE[cls] = { boss: [L10, L15, L20], mob: [L10, L15, L20] }: outgoing damage vs bosses / everything else at hero
//   level 10 (and below), 15 and 20, linear between (some kits scale harder with gear and levels than others).
//   Targets: boss DPS within about ±10% of the class average at every gear tier, with identity kept: the Monk / Samurai /
//   Ninja / Warrior lean single-target, the Mage / Summoner / Ranger clear packs fastest, the Paladin / Bard trade a little
//   damage for their support kits.
//   ULT_MUL: every ultimate hit (and Eclipse / ult-window finisher routes) hits harder: the payoff for filling the meter.
// Gear procs (o.gear) are never scaled here: they scale with ATK like every other hit.
export const CLASS_TUNE = {
  warrior:     { boss: [1.06, 0.96, 0.72], mob: [0.75, 0.55, 0.55] },
  ranger:      { boss: [0.83, 0.85, 1.01], mob: [0.82, 1.56, 0.55] },
  mage:        { boss: [1.68, 1.67, 1.88], mob: [0.68, 0.61, 0.6] },
  cleric:      { boss: [1.2, 1.32, 1.49], mob: [1.24, 1.18, 0.98] },
  bladedancer: { boss: [1.37, 1.23, 1.19], mob: [1.18, 1.18, 1.6] },
  samurai:     { boss: [0.75, 0.77, 0.78], mob: [1.25, 1.07, 1.19] },
  monk:        { boss: [0.47, 0.5, 0.51], mob: [0.74, 0.69, 1.19] },
  dragoon:     { boss: [1.22, 1.34, 1.54], mob: [0.72, 0.55, 0.89] },
  summoner:    { boss: [1.05, 1.01, 0.83], mob: [1.09, 0.95, 0.56] },
  bard:        { boss: [1.54, 1.6, 1.45], mob: [1.24, 1.49, 1.27] },
};
/** DPS-UP pass (2026-10-05): with optimal rotations (tools/rotations) the Bard was far ahead. The Bard was NOT nerfed:
 *  every other class's outgoing damage is raised toward it instead, as one flat per-class factor on every hit (all skills,
 *  chains, finishers, basics and ults scale together, so each kit's internal weighting and identity stay exactly as
 *  designed). boss = vs bosses / elites, mob = everything else. Level-independent (on top of CLASS_TUNE).
 *  Lifesteal / leech heal from the damage BEFORE this factor (combat.js), so sustain is unchanged. Bard stays 1. */
export const CLASS_POWER = {
  warrior:     { boss: 2.6, mob: 3 },
  ranger:      { boss: 1.6, mob: 3 },
  mage:        { boss: 1.29, mob: 3 },
  cleric:      { boss: 1.44, mob: 2.5 },
  bladedancer: { boss: 1.37, mob: 2.5 },
  samurai:     { boss: 1.8, mob: 3 },
  monk:        { boss: 1.65, mob: 2 },
  dragoon:     { boss: 1.67, mob: 3 },
  summoner:    { boss: 2.46, mob: 3 },
  bard:        { boss: 1, mob: 1 },
};
/** the DPS-UP factor for hero p hitting enemy e (bosses and elites use the boss factor) */
export function classPower(p, e) {
  const P = CLASS_POWER[p.cls]; if (!P) return 1;
  return e && (e.boss || e.elite) ? P.boss : P.mob;
}
export const ULT_MUL = 1.15;
/** ULT SURGE: for `dur` ticks after you fire your ultimate every hit you land is ×mul (per class: the kits whose ult was a
 *  small part of their damage get the bigger surge, so every meter you fill pays off). */
export const ULT_SURGE = { dur: 360, mul: { warrior: 1.1, ranger: 1.35, mage: 1.15, cleric: 1.15, bladedancer: 1, samurai: 1.5, monk: 1.3, dragoon: 1.5, summoner: 1.35, bard: 1 } };
/** basic attacks (on top of SUSTAIN.basicDmg): the ranged kits' auto-fire was nearly as good as their chains */
export const BASIC_MUL = { ranger: 0.8, mage: 0.8 };
/** Targets that take the BOSS column of CLASS_TUNE: real bosses (world / dungeon / raid / Trial: e.boss) and the mission
 *  bosses, which are elites with a boss role (e.opsBoss: Swarm Queen, Defense siege, Mobile Defense boss, Assault
 *  Gatekeeper, Capture target; e.opsChamp: the Assault champion). Regular elites stay on the mob column (classPower
 *  already gives every elite the boss DPS-UP factor; flipping all elites' tune column would rebalance open-world packs).
 *  Before this, mission bosses got mob tune x boss power: Samurai / Monk killed them 3-4x faster than Ranger / Dragoon. */
export function bossTuned(e) { return !!(e && (e.boss || e.opsBoss || e.opsChamp)); }
/** the class damage multiplier for hero p hitting enemy e */
export function classTune(p, e) {
  const T = CLASS_TUNE[p.cls]; if (!T) return 1;
  const lv = p.level | 0, v = bossTuned(e) ? T.boss : T.mob;
  if (lv <= 10) return v[0];
  if (lv >= 20) return v[2];
  return lv <= 15 ? v[0] + (v[1] - v[0]) * (lv - 10) / 5 : v[1] + (v[2] - v[1]) * (lv - 15) / 5;
}
/** everything above for one hit (not gear procs): class tune × DPS-UP power × ult payoff × surge × basic factor */
export function tuneHit(p, e, o, routeHit) {
  let m = classTune(p, e) * classPower(p, e);
  if (o.ult || routeHit) m *= ULT_MUL;
  if (p.surge > 0) m *= ULT_SURGE.mul[p.cls] || 1;
  if (o.basic && !o.ult) m *= BASIC_MUL[p.cls] || 1;
  return m;
}
