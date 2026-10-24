// Combat resolution: damage rolls, crits, mitigation, crowd control, i-frames, projectiles,
// telegraphed areas, kills, XP and loot drops. Pure sim code: no DOM, no rendering.
import { vulnMul } from './savage.js';
import { practiceKill } from './practice.js';
import { ultKill } from './ultimate.js';
import { withLootLevel } from './loot.js';
import { affixOnHit, affixOnDeath } from './affixes.js'; // (Part A3)
import { priorityBonus } from './mobsmart.js';
import { spawnEnemy as spawnEnemyA3 } from './ai.js';
import { xpRate, xpGapMul } from './levelscale.js';
import { HUNT, biomeAt, poolMat } from './meta.js';
import { inTownArea } from './townconst.js';
import { inDunesArea } from './dunesconst.js';
import { inFrostArea } from './frostconst.js';
import { inEmberArea } from './emberconst.js';
import { trialBiome } from './trialconst.js';
import { opsBiome, inOpsArea, pastAssaultGate } from './opsconst.js';
import { openRift } from './raid.js';
import { wmHitMul, wmOnHit, wmHurtMul, gainGlory } from './warrior.js';
import { samOnHit, samParry } from './samurai.js';
import { monkOnHit, monkDodge } from './monk.js';
import { drgOnHit } from './dragoon.js';
import { defHurt, defPerfect, defCrit, defReset } from './defense.js';
import { arcPre, arcOnHit } from './arcana.js';
import { specOnHit, specHitMul, specCrit } from './specials.js';
import { DT, SPAWN_POS, BOSS_POS, zoneAt, secs, inRaidArea } from './constants.js';
import { inAstArea } from './astraelconst.js';
import { WB } from './data/wbosses.js';
import { CLASSES, FOUR, dodgeOf } from './data/classes.js';
import { tuneHit, classPower } from './data/tuning.js';
import { inCone, inLine, dist2 } from './math.js';
import { pointBlocked } from './world.js';
import { grantXp, computeStats } from './progression.js';
import { rollLoot } from './loot.js';
import { showerFor } from './drops.js';
import { chainHooks, dunesKill, unlockFor } from './dunes.js';
import { inTombArea } from './dunesconst.js';
import { inCryptArea } from './frostconst.js';
import { inHollowArea, inTorArea } from './glowconst.js';
import { frostKill } from './frost.js';
import { emberKill } from './ember.js';
import { riftKill } from './rift.js';
import { inRiftArea } from './riftconst.js';
import { inForgeArea } from './emberconst.js';
import { inTrialArea } from './trialconst.js';
import { gearMul, gearOnHit, exclusiveDrops } from './exotic.js';
import { stackDmgMul, hitStacks, stackN } from './kit.js';
import { SUSTAIN, chainLanded, sustainHit } from './sustain.js';
import { hordeSpill } from './hordeaoe.js';

export function rollDamage(rng, atk, mul, critChance, critDmg, forceCrit = false) {
  let amount = atk * mul * (0.9 + rng.next() * 0.2);
  const crit = forceCrit || rng.next() < critChance;
  if (crit) amount *= critDmg;
  return { amount, crit };
}

export function mitigate(amount, def) {
  return Math.max(1, Math.round((amount * 100) / (100 + Math.max(0, def))));
}

// ------------------------------------------------------------------ player -> enemy
export function cancelAreasOf(sim, e) {
  for (const a of sim.areas) {
    if (a.ownerId === e.id && a.team === 'enemy' && !a.committed && a.fired === 0 && !a.dead) {
      a.dead = true;
      sim.emit({ type: 'areaCancel', x: a.x, y: a.y });
    }
  }
}

function applyCC(sim, e, o) {
  const kbAng = o.kbAng ?? 0;
  if (e.boss) {
    const power = (o.stagger ? 6 : 0) + (o.knockdown || o.knockup ? 16 : 0) + (o.freeze ? 10 : 0) + (o.root ? 6 : 0) + (o.kb > 250 ? 2 : 0) + (o.poise || 0); // poise: extra boss poise damage (Warrior Shoulder Bash & co)
    if (power > 0 && e.cc.down <= 0 && e.state !== 'roar') {
      e.poise -= power;
      if (e.poise <= 0) {
        e.cc.down = secs(2.6);
        e.poise = e.maxPoise;
        cancelAreasOf(sim, e);
        e.state = 'idle'; e.st = 0;
        sim.emit({ type: 'cc', kind: 'broken', x: e.x, y: e.y - e.r, id: e.id });
      }
    }
    return;
  }
  if (o.kb) { const k = o.kb / e.mass; e.vx += Math.cos(kbAng) * k; e.vy += Math.sin(kbAng) * k; }
  if (e.ccImm > 0 || (e.ccRes && (e.cc.stun > 0 || e.cc.down > 0))) { if (o.slow) { e.cc.slow = Math.max(e.cc.slow, o.slow); e.cc.slowMul = o.slowMul ?? 0.55; } return; } // (a mission boss: a stun can't be refreshed while it lasts, then control immune for a moment, sim/opsboss.js)
  let interrupted = false;
  const tough = e.mass >= 3 ? 0.55 : 1;
  if (o.knockdown) { e.cc.down = Math.max(e.cc.down, Math.round(o.knockdown * tough)); interrupted = true; sim.emit({ type: 'cc', kind: 'down', x: e.x, y: e.y - e.r, id: e.id }); }
  if (o.knockup) { const t = Math.round(o.knockup * tough); e.cc.down = Math.max(e.cc.down, t); interrupted = true; sim.emit({ type: 'cc', kind: 'up', x: e.x, y: e.y - e.r, id: e.id, t }); } // knock-up: launched into the air (a knockdown the client draws as a hop)
  if (o.freeze) { e.cc.stun = Math.max(e.cc.stun, Math.round(o.freeze * tough)); e.cc.frozen = true; e.cc.slow = Math.max(e.cc.slow, o.freeze + 90); e.cc.slowMul = 0.5; interrupted = true; sim.emit({ type: 'cc', kind: 'freeze', x: e.x, y: e.y - e.r, id: e.id }); }
  if (o.root) { e.cc.stun = Math.max(e.cc.stun, Math.round(o.root * tough)); e.cc.rooted = true; interrupted = true; sim.emit({ type: 'cc', kind: 'root', x: e.x, y: e.y - e.r, id: e.id }); }
  if (o.stagger) { e.cc.stun = Math.max(e.cc.stun, Math.round(o.stagger * tough)); interrupted = true; }
  if (o.slow) { e.cc.slow = Math.max(e.cc.slow, o.slow); e.cc.slowMul = o.slowMul ?? 0.55; }
  if (e.ccRes) { e.cc.stun = Math.min(e.cc.stun, CC_CAP); e.cc.down = Math.min(e.cc.down, CC_CAP); } // (mission bosses: one stun lasts at most 1.5 s)
  if (interrupted) { cancelAreasOf(sim, e); e.state = 'idle'; e.st = 0; e.cd = Math.max(e.cd, 24); }
}
/** the longest single stun / knockdown on a mission boss (e.ccRes set: sim/opsboss.js) */
export const CC_CAP = 90;

/**
 * Player `p` hits enemy `e`. o: {mul, kb, kbAng, stagger, knockdown, freeze, root, slow, forceCrit,
 * critVsCC, bonusVsFrozen, hitstop, heavy, dmgMul, lifesteal}
 */
/** Warrior Sunder (Charge Strike): +15% damage from that Warrior for 5s; Ground Slam deals +50% to Sundered enemies. */
export const SUNDER = { mul: 1.15, ttl: 300, slamMul: 1.4 };
/** Blade Dancer: Backstab (first attack out of stealth) and Heartseeker's low-HP scaling. */
export const BACKSTAB = { mul: 2.0, refund: 0 }; // (no flat pip refund: Backstab always crits, and crits refund pips)
export const HEARTSEEKER = { hiHp: 0.75, loHp: 0.25, maxBonus: 1.0 };
/** Heartseeker bonus multiplier vs an enemy: +0% above 75% HP, rising linearly to +100% below 25%. */
export function heartseekerBonus(e) {
  const f = e.hp / Math.max(1, e.maxHp);
  return Math.max(0, Math.min(1, (HEARTSEEKER.hiHp - f) / (HEARTSEEKER.hiHp - HEARTSEEKER.loHp))) * HEARTSEEKER.maxBonus;
}

// ------------------------------------------------------------------ ultimate meter
// Chains whose finisher lands (a non-basic hit within `credit` ticks of the chain) give the big gains.
// Every other landed hit gives a trickle: hitBasic / hitSkill / hitDot per hit, at most hitTickCap per tick
// (multi-target AoE) and at most hitPerSec on average (token bucket, 1 s burst), so spam can't flood it.
// Repeating your previous chain gives 40%; 3 distinct chains in a row within 12s without losing 25% max HP
// gives a rotation bonus. Decays slowly after 15s out of combat. Server-authoritative (never in a predicting sim).
export const ULT = { max: 100, gain: 12, repeatMul: 0.4, rotationBonus: 25, rotationLen: 3, rotationWindow: secs(12), heavyDmg: 0.25, credit: 150, decayAfter: secs(15), decayPerSec: 1,
  hitBasic: 1.0, hitSkill: 2.0, hitDot: 0.4, hitTickCap: 2, hitPerSec: 1.25,
  // per-class meter-gain multiplier for chains and the rotation bonus, tuned so every class fills in ~12 s of normal rotation
  // play (tools/balance.mjs). Low since the skill-sustain update: refunds + cooldown cuts make chains 2-6x more frequent
  // (Mage/Ranger chain the most). hitMul scales the hit trickle (and its caps) separately: it keeps its pre-sustain values,
  // so fights where chains get interrupted (raid mechanics) still fill the bar.
  classMul: { warrior: 0.46, ranger: 0.34, mage: 0.26, cleric: 0.44, bladedancer: 0.43, samurai: 0.69, monk: 0.99, dragoon: 0.58, summoner: 0.64, bard: 0.5 }, // (chains v2 retune: 4-steps + Special 5-steps)
  hitMul: { warrior: 1.32, ranger: 1.14, mage: 1.14, cleric: 1.32, bladedancer: 0.73, samurai: 1.1, monk: 1.1, dragoon: 1.1, summoner: 1.1, bard: 1.1 } };
/** Meter-gain multiplier for a player's class. */
export const ultMul = (p) => (ULT.classMul[p.cls] ?? 1) * (1 + ((p.stats && p.stats.ultCharge) || 0)); // (gear: Ult Charge)
/** Hit-trickle multiplier for a player's class. */
export const ultHitMul = (p) => (ULT.hitMul[p.cls] ?? 1) * (1 + ((p.stats && p.stats.ultCharge) || 0));
/** Part E death recap: the enemy that owns a projectile / area (only read when it hits you) */
const enemyName = (sim, id) => { const e = id && sim.enemyById && sim.enemyById.get(id); return e ? e.name : undefined; };
/** tag a projectile / area with the owner's cast: a chain step (gch) / the Special (gsp), for the gear sub-stats */
function gearTag(sim, x) {
  if (globalThis.GEAR_NOTAG) return;
  if (x.team !== 'player' || x.gch != null || sim.predicting) return;
  const p = sim.players && sim.players.get(x.ownerId), act = p && p.action;
  if (!act || act.kind !== 'skill') return;
  if (act.chain) x.gch = 1;
  if (act.key === 'SP') x.gsp = 1;
}
/** classes whose own kit already applies gear Chain Damage to their chain hits (the rest get it generically in hitEnemy) */
const CHAIN_SELF = new Set(['warrior', 'samurai', 'monk', 'dragoon', 'summoner', 'bard']);
/** Chain Damage efficiency for the generic classes (the Paladin's chains are nearly all of its damage: half value, harness-tuned) */
const CHAIN_EFF = { cleric: 0.45 };
/** Blade Dancer Vanish chains (state-triggered, see player.js stealthChain). */
export const ROUTE_IDS = new Set(Object.values(CLASSES).flatMap((c) => (c.routes || []).map((r) => r.id)));
export const STEALTH_CHAINS = new Set(Object.values(CLASSES).flatMap((c) => (c.chains || []).filter((ch) => ch.stealth || ch.vanish).concat(c.routes || []).map((ch) => ch.id))); // + the Eclipse finishers // incl. Shadow Execution (Marked for Death's follow-up)
/** Shadow Step decoys: live 'decoy' areas (server/solo). Enemies target them, enemy projectiles home onto them and are absorbed. */
export function decoysOf(sim) { return sim.areas.filter((a) => a.kind === 'decoy' && !a.dead); }
/** Berserk extras: lifesteal (% of damage dealt), a pull aura (bosses resist). */
export const RAGE = { lifesteal: 0.15, pullR: 250, pullSpeed: 150, bossPull: 0.15, minGap: 12 };
/** Blade Dancer Eclipse: for `dur` (5s) skills cost no pips and each cast grants `stealth` ticks (0.5s, counted from the cast) of
 *  stealth, so the next hit is a Backstab. During Eclipse a Backstab boosts only the first `bsHits` hit(s) of each attack
 *  (multi-hit Thousand Cuts: the first cut), and it refunds no pips (skills are free, pips refill at the end). Enemies Backstabbed in
 *  the window take a burst of `burst` x the damage you dealt them in it when it ends; then pips refill to full.
 *  A perfect dodge extends it by 1s (once; max 6s). Tuning: a 6s window with every hit Backstabbed killed Grimtusk in ~6s,
 *  so the window was shortened (6 -> 4-5s) first and, still too strong, the Backstab limited to the first hit of each attack.
 *  Finisher routes (fun first): 8s so a 5-step route (Ten Thousand Cuts / Crescent Execution) fits; the finisher ends Eclipse. */
export const ECLIPSE = { dur: secs(8), stealth: 30, burst: 0.25, bsHits: 1, extPerDodge: secs(1), extMax: secs(1), vanishChains: 3 }; // vanishChains: Vanish chains per Eclipse (then skills out of Vanish stealth just Backstab)

/** Small meter trickle for any landed (non-ult) hit; capped per tick and per second. */
export function creditHit(sim, p, o) {
  if (sim.predicting || o.ult || o.spill || p.uw || p.cls === 'samurai') return 0; // (Samurai: the meter comes only from the Special's Focus) // (horde AoE spill hits: no meter) no meter during the ult window (free, fast skills would loop it)
  if (p.ultHitTick !== sim.tick) { p.ultHitTick = sim.tick; p.ultHitTickSum = 0; }
  const m = ultHitMul(p);
  const want = (o.dot ? ULT.hitDot : o.basic ? ULT.hitBasic : ULT.hitSkill) * m;
  const add = Math.min(want, ULT.hitTickCap * m - p.ultHitTickSum, p.ultHitBudget || 0, ULT.max - p.ult);
  if (!(add > 0)) return 0;
  p.ultHitTickSum += add; p.ultHitBudget -= add;
  const before = p.ult;
  p.ult = Math.min(ULT.max, p.ult + add);
  p.ultGained = (p.ultGained || 0) + (p.ult - before);
  p.ultFromHits = (p.ultFromHits || 0) + (p.ult - before);
  if (p.ult >= ULT.max && before < ULT.max) sim.emit({ type: 'ultGain', pid: p.id, x: p.x, y: p.y - 44, amount: Math.round(add * 10) / 10, bonus: 0, chain: null, hit: true, rot: p.ultRot.ids.length, full: true });
  return add;
}

/** A chain's finisher landed: add meter (with diminishing repeats and the rotation bonus). */
export function creditChain(sim, p, id) {
  p.chainPending = null;
  if (sim.predicting) return 0;
  if (p.eclipse && STEALTH_CHAINS.has(id)) return 0;
  if (p.cls === 'samurai') return 0; // Samurai: chains give no meter (the Special turns 100 Focus into a full meter)
  if (p.uw || ROUTE_IDS.has(id)) return 0; // ult window: no meter (free skills + 3x cooldowns would loop it); finishers never give meter // Vanish chains give no meter during Eclipse (free pips + stealth would loop it)
  const repeat = p.ultLast === id;
  const m = ultMul(p);
  p.ultRep = repeat ? (p.ultRep || 0) + 1 : 0;
  const gain = ULT.gain * m * (repeat ? ULT.repeatMul * (p.ultRep >= 3 ? 0.5 : 1) : 1); // (3rd+ repeat in a row: halved again - cheap chains made single-chain spam too good a meter source)
  p.ultLast = id;
  const R = p.ultRot;
  if (R.ids.length && (sim.tick - R.start > ULT.rotationWindow || R.ids.includes(id) || p.dmgTaken - R.dmg0 >= p.stats.maxHp * ULT.heavyDmg)) R.ids = [];
  if (!R.ids.length) { R.start = sim.tick; R.dmg0 = p.dmgTaken; }
  R.ids.push(id);
  let bonus = 0;
  if (R.ids.length >= ULT.rotationLen) { bonus = ULT.rotationBonus * m; R.ids = []; p.rotations = (p.rotations || 0) + 1; }
  const before = p.ult;
  p.ult = Math.min(ULT.max, p.ult + gain + bonus);
  p.ultGained = (p.ultGained || 0) + (p.ult - before);
  sim.emit({ type: 'ultGain', pid: p.id, x: p.x, y: p.y - 44, amount: Math.round(gain * 10) / 10, bonus: Math.round(bonus * 10) / 10, chain: id, repeat, rot: R.ids.length, full: p.ult >= ULT.max && before < ULT.max });
  return Math.round((p.ult - before) * 1000) / 1000;
}

/** mission-boss damage by class (measured 2026-10-15: Ranger 1.8x, Bard 1.6x, Blade Dancer 1.3x, Monk 1.1x the pack median kill time) */
export const OPS_BOSS_CLS = { ranger: 2.15, bard: 1.75, bladedancer: 1.36, monk: 1.16 };
export function hitEnemy(sim, p, e, o) {
  if (e.dead || (e.untargetable && !e.boss) || (e.invuln > 0 && !o.pierce)) return null; // (game loop C: a boss under the sand / in the blizzard still takes hits: no invulnerable windows) // (untargetable: a Sandwurm under the sand) // (pierce: the Crescent Execution impact is not wasted on a boss phase-change invulnerability)
  const s = p.stats;
  const cced = e.cc.stun > 0 || e.cc.down > 0;
  const perfect = p.perfectCrit > 0; // Blade Dancer: perfect dodge -> next hit is a guaranteed crit
  const raging = p.rage > 0; // Warrior Berserk (lifesteal)
  const act = p.action;
  const cls = CLASSES[p.cls];
  const vanishHit = !!(act && act.chain && (act.chain.stealth || act.chain.vanish) && !o.ult && !o.clone && !o.basic); // Blade Dancer: every Vanish-chain hit crits
  let backstab = !!(act && act.backstab && !o.ult && !o.clone); // (shadow clones never use up your Backstab) // Blade Dancer: first attack out of stealth
  if (backstab && p.eclipse && (act.bsHits || 0) >= ECLIPSE.bsHits) backstab = false; // Eclipse: only the first hit of each attack
  if (backstab) act.bsHits = (act.bsHits || 0) + 1;
  const ax = arcPre(sim, p, e, o); // Bard songs (Valor) / Requiem / Dissonant, Summoner Chill rules
  const bsAll = !!o.backstabAll; // Death Blossom: every cut is a Backstab (crit, x mul; no refund, no knockdown)
  const forceCrit = !!(o.forceCrit || bsAll || perfect || backstab || vanishHit || (o.critVsCC && cced) || (o.bonusVsFrozen && e.cc.frozen) || (act && act.chain && act.chain.id === 'shadow_strike' && !o.clone) || (o.critMarked && specCrit(p, e, o)) || ax.crit);
  if (perfect) p.perfectCrit = 0;
  const edge = cls.edge ? p.edge || 0 : 0; // Blade Dancer Edge: +crit chance / +crit damage per stack
  const critC = s.crit + edge * (cls.edge ? cls.edge.crit : 0), critD = s.critDmg + edge * (cls.edge ? cls.edge.critDmg : 0);
  const ad = act && act.kind === 'skill' && act.data && !o.ult && !o.clone ? act.data : null; // Warrior: Rage spent (x1-x2) and Momentum (+20%) on this skill
  const actMul = (ad ? (ad.rm || 1) * (ad.mom ? MOMENTUM_MUL : 1) : 1) * (act && act.chain && act.chain.tier4 && !o.ult && !o.clone && !o.basic && !o.dot ? FOUR.mul : 1); // (4-step chains: the tier bonus)
  const wx = wmHitMul(sim, p, e, o); // Warrior: Challenge mark / Rally / Trinity Surge / vs-CC, vs-Bleed / Bleed detonations
  let { amount, crit } = rollDamage(sim.rng, s.atk, (o.mul + wx.add) * wx.m * (o.dmgMul || 1) * actMul * (o.basic && !o.ult ? SUSTAIN.basicDmg : 1), critC, critD, forceCrit);
  const sundered = !!(e.sunder && e.sunder.pid === p.id && e.sunder.t > 0);
  if (sundered) amount *= SUNDER.mul * (o.vsSunder || 1);
  amount *= stackDmgMul(e, p) * ax.m;
  if (e.dummy && e.dr) amount *= 1 - e.dr; // (Training Dummy armor setting, sim/dummy.js)
  if (e.opsBoss && OPS_BOSS_CLS[p.cls]) amount *= OPS_BOSS_CLS[p.cls]; // (Oct 15 mission-boss spread: the classes measured slow on mission bosses, tools/opsboss-fightlen.mjs)
  if (e.spm) amount *= specHitMul(sim, p, e); // Storm of Arrows MARK: +20% from that Ranger // your stacks on it: Sunder (+5%/stack beyond the first), Quarry +3%, Condemn +2%
  if (backstab || bsAll) amount *= BACKSTAB.mul;
  if (o.execute) amount *= 1 + (o.executeFull ? HEARTSEEKER.maxBonus : heartseekerBonus(e)); // shadow clones: as if below 25% HP // Heartseeker: more damage the lower the target's HP
  const downAttack = e.cc.down > 0;
  if (downAttack) amount *= 1.2; // BDO-style "down attack" bonus
  if (o.bonusVsFrozen && e.cc.frozen) amount *= o.bonusVsFrozen;
  if (e.boss && e.cc.down > 0) amount *= 1.25; // broken boss takes extra
  if (e.vuln > 0) amount *= e.vulnMul || 1.5; // raid boss: stunned after its Rift Ward broke
  if (e.takeMul != null) amount *= e.takeMul; // Neferakh: shrouded in the dark (less) / exposed in the light (more)
  if (p.gxRime) amount *= gearMul(p, e); // Rimebound: +20% vs chilled / frozen (sim/exotic.js)
  if (!o.gear && !o.ult && !o.basic && !o.clone) { // gear expansion sub-stats: Special Damage, Chain Damage (classes that don't apply it themselves); projectiles / areas carry the cast's tags
    if (s.spDmg && (o.gsp || (act && act.key === 'SP' && o.gsp == null))) amount *= 1 + s.spDmg;
    if (s.chainDmg && !CHAIN_SELF.has(p.cls) && (o.gch || (act && act.chain && o.gch == null))) amount *= 1 + s.chainDmg * (CHAIN_EFF[p.cls] ?? 1);
  }
  if (!o.gear) amount *= tuneHit(p, e, o, !!(act && act.chain && ROUTE_IDS.has(act.chain.id))); // the balance pass: class tuning, the ult payoff + surge, basics (data/tuning.js)
  const dmg = mitigate(amount, e.defense);
  if (e.ward && e.ward.hp > 0) { // raid boss Rift Ward: everything hits the ward instead (skills count double)
    const wd = dmg * (o.basic ? 1 : 2);
    e.ward.hp = Math.max(0, e.ward.hp - wd);
    e.ward.by[p.id] = (e.ward.by[p.id] || 0) + wd;
  } else if (e.esh > 0) { const ab = Math.min(e.esh, dmg); e.esh -= ab; e.hp -= dmg - ab; if (e.esh <= 0) { e.esh = 0; sim.emit({ type: 'wardBreak', x: e.x, y: e.y, id: e.id }); } } // a site caster's ward soaks it first (sim/sites.js)
  else e.hp -= dmg;
  if (e.af && !sim.predicting) affixOnHit(sim, e, p); // (A3: a Mirror elite's window chips back)
  e.flash = 6;
  e.aggroId = p.id;
  if (e.dmgBy) e.dmgBy[p.id] = (e.dmgBy[p.id] || 0) + dmg; // contribution (co-op XP sharing)
  if (e.chrono && e.chrono.pid === p.id) e.chrono.dmg += dmg; // Mage Chrono Field: the frozen enemy remembers it
  const sharp = crit && !!cls.edge; // Blade Dancer crits: bigger numbers + a slash flash on the client
  sim.emit({ type: 'dmg', x: e.x, y: e.y - e.r, amount: dmg, crit, team: 'enemy', heavy: !!o.heavy, down: downAttack, pid: p.id, id: e.id, big: o.bigNum || undefined, sharp: sharp || undefined, pop: o.pop || undefined, spill: o.spill || undefined }); // big: the finisher draws its own oversized number
  if (!o.spill) sim.emit({ type: 'hit', x: e.x, y: e.y, ang: o.kbAng ?? 0, crit, heavy: !!o.heavy, cls: p.cls, r: e.r, style: o.style || null, pid: p.id, id: e.id, perfect: perfect || undefined, sundered: sundered || undefined, backstab: backstab || bsAll || undefined, clone: o.clone || undefined });
  const susM = SUSTAIN.mech[p.cls], stacked = susM && susM.on ? (susM.on === 'sunder' ? sundered : stackN(e, susM.on, p.id) > 0) : false; // (before this hit adds any)
  hitStacks(sim, p, e, o, sundered); // Sunder / Quarry / Burn / Condemn stacks (authoritative sim only)
  if (backstab && !act.bsDone) { // once per backstab attack, even if it hits several enemies
    act.bsDone = true;
    sim.emit({ type: 'backstab', pid: p.id, id: e.id, x: e.x, y: e.y - e.r - 30, dmg, refund: 0 });
  }
  applyCC(sim, e, o);
  const hs = (o.hitstop ?? 3) + (crit ? (sharp ? 4 : 2) : 0);
  e.hitstop = Math.max(e.hitstop, hs);
  if (sharp && act && !o.clone && !o.ult) p.hitstop = Math.max(p.hitstop, 2); // a crit bites: a tiny hit-stop on you too
  const gain = o.basic ? cls.resOnBasic ?? cls.resOnBasicHit ?? cls.resOnHit ?? 0 : cls.resOnBasicHit != null ? 0 : cls.resOnHit || 0; // basic attacks: the resource builder (Cleric: Holy Charge only from the basic combo)
  p.res = Math.min(s.maxRes, p.res + gain * (o.resGain ?? 1));
  if (cls.arms) wmOnHit(sim, p, e, o); // Warrior: Glory + the Trinity tracker
  else if (cls.blade) samOnHit(sim, p, e, o); // Samurai: a little Focus per skill hit
  else if (cls.fist) monkOnHit(sim, p, e, o); // Monk: hit counter, Chi, Pressure Points, spirit mirror
  else if (cls.lance) drgOnHit(sim, p, e, o); // Dragoon: the 3rd basic pins
  else if (cls.grim || cls.bard) arcOnHit(sim, p, e, o); // Summoner / Bard: basic hits write Ink / Tempo
  if (crit && cls.critPips) critRefund(sim, p, act, o); // Blade Dancer: crits refund pips
  const sdmg = o.gear ? dmg : dmg / classPower(p, e); // sustain (leech / lifesteal) heals from the damage before the DPS-UP factor (data/tuning.js)
  if (crit && !o.gear) defCrit(sim, p, sdmg); // Blade Dancer crit leech (sim/defense.js)
  sustainHit(sim, p, e, o, stacked); // class-mechanic refund (Sundered / Quarried / Condemned enemy)
  if (o.lifesteal) p.hp = Math.min(s.maxHp, p.hp + s.maxHp * o.lifesteal);
  p.comboHits++;
  p.comboTimer = secs(2.2);
  p.lastCombat = sim.tick;
  if (raging && RAGE.lifesteal > 0) healPlayer(sim, p, sdmg * RAGE.lifesteal, p); // Berserk lifesteal (green numbers; server-side only)
  if (!o.gear) gearOnHit(sim, p, e, o, crit); // Trial / Extreme procs + biome set 3-pieces (sim/exotic.js)
  creditHit(sim, p, o);
  if (p.chainPending && (!o.basic || p.chainPending.anyHit) && !o.ult) {
    if (sim.tick - p.chainPending.tick <= ULT.credit) { const pend = p.chainPending; chainLanded(sim, p, pend); creditChain(sim, p, pend.id); chainHooks(sim, p, pend, e); } else p.chainPending = null;
  }
  // Eclipse: remember what you dealt each enemy in the window, and which ones got Backstabbed (they take the end burst)
  if (p.eclipse && !o.ult && !sim.predicting) {
    const E = p.eclipse; E.dmg.set(e.id, (E.dmg.get(e.id) || 0) + dmg);
    if (backstab || bsAll) E.bs.add(e.id);
    if (crit && E.rt) E.rt.cr = (E.rt.cr || 0) + 1; // the Eclipse finishers scale with the crits landed
  }
  if (crit && cls.critPips && !o.ult) p.critRun = (p.critRun || 0) + 1; // crits landed in the current chain (Eviscerate)
  if (crit && cls.markPop && !o.noPop && !o.clone && !o.ult && e.hp > 0 && e.mark && e.mark.pid === p.id && e.mark.t > 0 && e.mark.n > 0 && !sim.predicting) popMark(sim, p, e, cls);
  if (o.spMark || (act && act.data && act.data.cln)) specOnHit(sim, p, e, o); // Specials: Storm MARK, Shadow Clone echoes
  if (o.onHit) o.onHit(dmg, e);
  if (!e.boss) hordeSpill(sim, p, e, o, dmg); // horde AoE: the hit spills into the crowd round it (never onto a boss: sim/hordeaoe.js)
  if (e.hp <= 0 && !e.dead) { // (a Mark detonation may already have finished it)
    killEnemy(sim, e, p);
    const rt = (p.eclipse || p.uw) && (p.eclipse || p.uw).rt; // Ten Thousand Cuts: kills while the mob route is alive = its clones
    if (rt && !rt.fin && rt.st.mob > 0 && !rt.x.mob && !sim.predicting) rt.k++;
  }
  return { dmg, crit };
}

/** Warrior Momentum bonus on the next rush skill (see player.js RUSH). */
export const MOMENTUM_MUL = 1.2;
/** Blade Dancer: a crit refunds pips (cls.critPips: per crit, max per attack, max per second). None from free casts, clones, the
 *  ult or during Eclipse (pips are free there). Authoritative sim only. */
function critRefund(sim, p, act, o) {
  const C = CLASSES[p.cls].critPips;
  if (sim.predicting || o.clone || o.ult || o.pop || p.eclipse || !act) return;
  if (act.kind === 'skill' && !(act.data && act.data.cost > 0)) return; // free casts (Shadow Strike) give nothing back
  if ((act.cp || 0) >= C.perAction) return;
  if (!p.cpw || sim.tick - p.cpw.t0 >= 60) p.cpw = { t0: sim.tick, n: 0 };
  if (p.cpw.n >= C.perSec) return;
  const before = p.res;
  p.res = Math.min(p.stats.maxRes, p.res + C.per);
  if (p.res > before) { act.cp = (act.cp || 0) + 1; p.cpw.n++; sim.emit({ type: 'critPip', pid: p.id, x: Math.round(p.x), y: Math.round(p.y - 40), n: Math.round(p.res - before) }); }
}
/** Blade Dancer: a crit on one of your Marked enemies detonates the Mark: an extra guaranteed crit of x(base + per x stacks) ATK. */
function popMark(sim, p, e, cls) {
  const n = e.mark.n, P = cls.markPop;
  e.mark = null;
  sim.emit({ type: 'markPop', pid: p.id, id: e.id, x: Math.round(e.x), y: Math.round(e.y), r: e.r, n });
  hitEnemy(sim, p, e, { mul: P.base + P.per * n, forceCrit: true, clone: true, noPop: true, pop: true, heavy: true, stagger: 14, kb: 0, hitstop: 5, style: 'pop' });
  if (cls.edge) { const E = cls.edge, before = p.edge || 0; p.edge = Math.min(E.max, before + E.pop); p.edgeT = sim.tick; if (p.edge !== before) sim.emit({ type: 'edge', pid: p.id, n: p.edge, x: Math.round(p.x), y: Math.round(p.y - 50) }); }
}

/** Eclipse ends: every enemy Backstabbed in the window takes ECLIPSE.burst x what you dealt it (true damage, no crit roll,
 *  no meter). Server/solo only (a predicting sim never deals damage). Returns [{id, dmg}]. */
export function eclipseBurst(sim, p) {
  const E = p.eclipse, out = [];
  if (!E || sim.predicting) return out;
  for (const id of E.bs) {
    const e = sim.enemyById.get(id);
    const dealt = E.dmg.get(id) || 0;
    if (!e || e.dead || e.invuln > 0 || !(dealt > 0)) continue;
    const dmg = Math.max(1, Math.round(dealt * ECLIPSE.burst));
    e.hp -= dmg; e.flash = 8; e.aggroId = p.id;
    e.hitstop = Math.max(e.hitstop, 6);
    if (e.dmgBy) e.dmgBy[p.id] = (e.dmgBy[p.id] || 0) + dmg;
    sim.emit({ type: 'dmg', x: e.x, y: e.y - e.r, amount: dmg, crit: true, team: 'enemy', heavy: true, pid: p.id, id: e.id, eclipse: true });
    sim.emit({ type: 'eclipseBurst', pid: p.id, id: e.id, x: e.x, y: e.y, r: e.r, dmg, amount: dmg, dealt: Math.round(dealt) });
    out.push({ id: e.id, dmg });
    if (e.hp <= 0) killEnemy(sim, e, p);
  }
  return out;
}

export function shapeHits(sh, x, y, r) {
  if (sh.shape === 'cone') return inCone(sh.x, sh.y, sh.ang, sh.arc, sh.r, x, y, r);
  if (sh.shape === 'line') return inLine(sh.x, sh.y, sh.ang, sh.len, sh.w, x, y, r);
  if (sh.shape === 'donut') { const d = Math.sqrt(dist2(sh.x, sh.y, x, y)); return d <= sh.r + r && d >= (sh.r0 || 0) - r; } // (Frostveil quake rings)
  return dist2(sh.x, sh.y, x, y) <= (sh.r + r) * (sh.r + r);
}

/** Hit all enemies inside a shape {shape:'circle'|'cone'|'line', ...}. Returns count. */
export function hitEnemiesInShape(sim, p, sh, o, hitSet = null) {
  let n = 0;
  for (const e of sim.enemies) {
    if (e.dead || (hitSet && hitSet.has(e.id))) continue;
    if (!shapeHits(sh, e.x, e.y, e.r)) continue;
    const kbAng = o.pull ? Math.atan2(sh.y - e.y, sh.x - e.x) : Math.atan2(e.y - sh.y, e.x - sh.x);
    if (hitEnemy(sim, p, e, { ...o, kbAng: o.kbAng ?? kbAng })) n++;
    if (hitSet) hitSet.add(e.id);
  }
  if (n > 0 && o.selfHitstop) p.hitstop = Math.max(p.hitstop, o.selfHitstop);
  return n;
}

export const XP_SHARE_R = 1000;

export function gainXp(sim, p, amount, quiet = false) {
  if (p.dead || p.noXp) return; // (Part E: no XP in practice)
  amount = amount > 0 ? Math.max(1, Math.round(amount * xpRate(p.level))) : amount; // (leveling pace, sim/levelscale.js)
  const levels = grantXp(p, amount);
  sim.emit(quiet ? { type: 'xp', pid: p.id, amount, x: p.x, y: p.y - 30, q: 1 } : { type: 'xp', pid: p.id, amount, x: p.x, y: p.y - 30 }); // (q: a fodder kill - no floating number)
  if (levels > 0) {
    p.stats = computeStats(p);
    p.hp = p.stats.maxHp;
    if (!CLASSES[p.cls].rageRes && !CLASSES[p.cls].gloryRes && !CLASSES[p.cls].focusRes && !CLASSES[p.cls].chiRes && !CLASSES[p.cls].bloodRes && !CLASSES[p.cls].inkRes && !CLASSES[p.cls].tempoRes) p.res = p.stats.maxRes; // (Glory is earned, never refilled)
    p.dirty = true;
    sim.emit({ type: 'levelup', pid: p.id, level: p.level, x: p.x, y: p.y });
  }
}

/** missions pass: kills never open dungeon portals any more (fixed mission / boss-dungeon entrances: sim/opsconst.js) */
export const FODDER_PORTAL = 0;
export function killEnemy(sim, e, killer) {
  if (e.dead) return;
  if (e.noDie) { e.hp = Math.max(1, e.hp); e.downed = 1; return; } // (Savage v2: the door boss is not killed - he transforms; sim/trials.js owns what happens)
  if (e.dummy) { e.hp = e.maxHp; e.lastHp = -1; return; } // the Training Dummy can't die: it just resets
  e.dead = true;
  e.hp = 0;
  cancelAreasOf(sim, e);
  if (e.ult && !sim.predicting) { ultKill(sim, e); sim.emit({ type: 'death', x: e.x, y: e.y, etype: e.type, r: e.r, boss: !!e.boss, name: e.boss ? e.name : undefined, elite: !!e.elite, id: e.id, killer: killer?.id, ul: 1 }); return; } // (Part F: the Ultimate drops nothing: prestige only)
  if (sim.practice && !sim.predicting) { practiceKill(sim, e); sim.emit({ type: 'death', x: e.x, y: e.y, etype: e.type, r: e.r, boss: !!e.boss, name: e.boss ? e.name : undefined, elite: !!e.elite, id: e.id, killer: killer?.id, pr: 1 }); return; } // (Part E practice: no XP, no loot, no unlocks)
  const fod = !!e.horde;
  if (!sim.predicting && (fod || e.hordeLead)) sim.hordeKill && sim.hordeKill(e, killer); // (the killer's horde intensity ramps: sim/horde.js)
  if (fod) { // fodder: no biome kill hooks (scarab splits, moth bursts); no dungeon portals either (fixed entrances now)
    if (!sim.predicting) sim.rng.next(); // (the old portal roll's draw: keeps seeded runs - the intro's beat plan - identical)
  } else
  if (e.dz && !sim.predicting) dunesKill(sim, e); // Sunscorch: Tomb portals, scarab splits, the Overlord's drop
  if (e.fz && !sim.predicting) frostKill(sim, e); // Frostveil: Crypt portals, gifts, the Overlord's drop, the Frostveil gate (sim/frost.js)
  if (e.type === 'khepra' && !sim.predicting) unlockFor(sim, e, 'frost'); // Khepra falls: the Realm Gate to Frostveil opens
  if (e.rz && !sim.predicting) riftKill(sim, e); // the Astral Rift (sim/rift.js)
  if (e.ez && !sim.predicting) emberKill(sim, e); // Emberdeep: Forge portals, moth bursts, boss clean-up (sim/ember.js)
  if (e.type === 'skaldra' && !sim.predicting) { unlockFor(sim, e, 'ember'); unlockFor(sim, e, 'skt'); } // Skaldra falls: the Realm Gate to Emberdeep opens + Skaldra (Trial)
  if (e.type === 'pyrrhex' && !sim.predicting) { unlockFor(sim, e, 'pyt'); unlockFor(sim, e, 'rift'); } // Pyrrhex falls: Pyrrhex (Trial) opens + the Realm Gate to the Astral Rift is found (game loop C3)
  if (e.type === 'boss' && !sim.predicting) unlockFor(sim, e, 'dunes'); // Grimtusk falls: the Realm Gate to the Dunes opens
  if (!sim.predicting && sim.hub && sim.hub.m && HUNT[sim.hub.m] === e.type) for (const p of sim.players.values()) p.rwHold = secs(90); // a hunt cleared: everyone gets the reward screen first (cleared by the client's rwDone)
  if (e.type === 'boss' && !sim.predicting && (!sim.hub || [...sim.players.values()].some((q) => q.unlocks && q.unlocks.vtx))) openRift(sim, e.x, e.y); // Grimtusk falls: a rift opens to the raid (away from his body; see raid.js RIFT) (game loop C3: only once the Rift Sanctum is yours: it is Map 5's dungeon now)
  if (e.raid && e.type === 'raidboss' && sim.raid) sim.raid.won = true;
  const shower = !sim.predicting && sim.showers && !e.summonOf && e.dropChance !== 0 && e.xp > 0 && !NO_SHOWER.has(e.ai);
  sim.emit({ type: 'death', x: e.x, y: e.y, etype: e.type, r: e.r, boss: !!e.boss, name: e.boss ? e.name : undefined, elite: !!e.elite, id: e.id, killer: killer?.id, ex: e.ex ? 1 : undefined, fod: fod ? 1 : undefined, sh: shower ? 1 : undefined, as: e.astral ? 1 : undefined });
  if (e.sm && !sim.predicting) { const pb = priorityBonus(sim, e); if (pb) { e.xp = Math.round(e.xp * (1 + pb)); e.dropChance = Math.min(1, (e.dropChance ?? 0.32) * (1 + pb)); sim.emit({ type: 'mobTell', k: 'priority', id: e.id, x: Math.round(e.x), y: Math.round(e.y) }); } if (e.af) affixOnDeath(sim, e, spawnEnemyA3); } // (A3)
  const sctx = shower ? showerCtx(sim, e) : null;
  // XP is shared (full amount each) by every living player who damaged the enemy or is nearby.
  // Loot is rolled separately per eligible player (soulbound bags only the owner sees, RotMG style).
  for (const p of sim.players.values()) {
    const helped = e.dmgBy && e.dmgBy[p.id] > 0;
    if (p.dead || (!helped && dist2(p.x, p.y, e.x, e.y) > XP_SHARE_R * XP_SHARE_R)) continue;
    gainXp(sim, p, Math.round(e.xp * xpGapMul(p.level, e.mlv || e.blv)), fod); // (loop playtest fix: XP by level gap, sim/levelscale.js)
    if (p === killer) p.kills++;
    const W = WB[e.type]; // (world bosses: their own loot tier + signature legendary slot)
    const items = withLootLevel(p.level, () => { // (player-level loot: each looter's own hero level, sim/loot.js)
      const its = rollLoot(sim.rng, { tier: e.zone, cls: p.cls, elite: e.elite, boss: e.boss, dropChance: e.dropChance ?? 0.32, bossTier: W ? W.tier : 5, bossSlot: W ? W.slot : 'weapon' });
      if (!sim.predicting) its.push(...exclusiveDrops(sim.rng, e, p)); // biome sets / Trial / Extreme pieces (sim/exotic.js)
      return its;
    }); // biome sets / Trial / Extreme pieces (sim/exotic.js)
    let bag = null;
    if (items.length) {
      bag = { id: sim.id(), x: e.x + (sim.rng.next() - 0.5) * 20, y: e.y + (sim.rng.next() - 0.5) * 20, items, ownerId: p.id, life: secs(90), rarity: Math.max(...items.map((i) => i.rarity)) };
      sim.bags.push(bag);
    }
    if (shower) showerFor(sim, e, p, bag, sctx); // loot shower: gold, orbs, the gear bag pop out + the vacuum (sim/drops.js)
    if (bag) sim.emit(bag.vac ? { type: 'loot', x: bag.x, y: bag.y, rarity: bag.rarity, pid: p.id, id: bag.id, vac: 1 } : { type: 'loot', x: bag.x, y: bag.y, rarity: bag.rarity, pid: p.id });
  }
}
const NO_SHOWER = new Set(['piece', 'gift', 'bubble', 'dummy']);
/** shower context: the gold zone (the Wilds ring, 4 elsewhere, like the client's banking) and whether orbs may drop
 *  (not from adds while a boss fight is on: boss fights keep their own sustain budget) */
export function showerCtx(sim, e) {
  const z = zoneAt(e.x, e.y), wild = z && z.id >= 1 && z.id <= 4;
  let fight = !e.boss && (inTrialArea(e.x, e.y) || inRaidArea(e.x, e.y) || inAstArea(e.x, e.y));
  if (!fight && !e.boss) for (const b of sim.enemies) if (b.boss && !b.dead && b !== e && (b.x - e.x) ** 2 + (b.y - e.y) ** 2 < 1400 * 1400) { fight = true; break; }
  const biome = biomeAt(e.x, e.y, AREAS), mz = Math.max(1, Math.min(4, (z && z.id) | 0 || 3));
  return { zone: wild ? z.id : 4, elite: !!e.elite, boss: !!e.boss, noOrbs: fight, biome,
    biomeMats: biome === 'town' ? null : (rng, pool) => poolMat(() => rng.next(), biome, mz, pool) }; // (horde pass 2: biome materials rain out too)
}
const AREAS = { inTownArea, inRaidArea, inAstArea, inTombArea, inDunesArea, inFrostArea, inCryptArea, inEmberArea, inForgeArea, inRiftArea, trialBiome, opsBiome, inHollowArea, inTorArea };

// ------------------------------------------------------------------ support: heals + shields (Cleric)
// Server-authoritative: a predicting client sim (sim.predicting) never heals/shields; it waits for the server.
/** Heal `t` by `amount` (clamped to max HP). Emits a 'heal' event (green number). Returns HP restored. */
export function healPlayer(sim, t, amount, src = null) {
  if (sim.predicting || !t || t.dead || !(amount > 0)) return 0;
  const add = Math.min(t.stats.maxHp - t.hp, amount);
  if (add <= 0) return 0;
  t.hp += add;
  if (src) src.healDone = (src.healDone || 0) + add;
  t.healTaken = (t.healTaken || 0) + add;
  if (add >= 1) sim.emit({ type: 'heal', pid: t.id, by: src ? src.id : undefined, x: t.x, y: t.y - t.r, amount: Math.round(add) });
  return add;
}
/** Heal every living player within `r` of (x, y) (the caster included). amountFn(target) -> HP. */
export function healAllies(sim, src, x, y, r, amountFn) {
  let total = 0;
  for (const q of sim.players.values()) {
    if (q.dead || dist2(q.x, q.y, x, y) > (r + q.r) * (r + q.r)) continue;
    total += healPlayer(sim, q, amountFn(q), src);
  }
  return total;
}
/** Damage-absorb shield: the larger of the current and the new shield, refreshed duration. */
export function grantShield(sim, t, amount, ticks, src = null) {
  if (sim.predicting || !t || t.dead || !(amount > 0)) return false;
  t.shield = Math.max(t.shield || 0, Math.round(amount));
  t.shieldMax = t.shield;
  t.shieldT = Math.max(t.shieldT || 0, ticks);
  sim.emit({ type: 'shield', pid: t.id, by: src ? src.id : undefined, x: t.x, y: t.y - t.r, amount: t.shield });
  return true;
}

// ------------------------------------------------------------------ enemy -> player
/** Dodge pass 2, step 2 (2026-10-19): a hero inside a proper-evade window = mid-Dodge dash, or the 0.3 s of i-frames a
 * proper evade opened (p.evdEnd). Only the real Dodge counts (class movement-skill i-frames keep their own rules). */
export const evading = (sim, p) => !!(p.action && p.action.kind === 'dodge') || (p.evdEnd || 0) > sim.tick;
/** Knockbacks / pulls / shoves that are not riding on a hit (roars, flings, pull wells, gusts): a timed evade cancels
 * that displacement. No i-frames are granted for it (the dodge only opens i-frames on a real hit, as before).
 * Returns true when the displacement should be skipped. */
export function evadeShove(sim, p) {
  if (!evading(sim, p)) return false;
  if (!sim.predicting && (!p.lastShoveEv || sim.tick - p.lastShoveEv > 20)) { p.lastShoveEv = sim.tick; sim.emit({ type: 'evaded', pid: p.id, x: p.x, y: p.y, shove: 1 }); }
  return true;
}
/** Holds a timed Dodge breaks early (snares, roots, freezes, the glass bubble): pressed at least HOLD_BREAK.after ticks into
 * the hold, it spends a charge, clears the hold and the dodge runs. */
export const HOLD_BREAK = { after: 15 };
export const HOLD_KINDS = new Set(['snare', 'osnare', 'glyph', 'frostbite', 'bramble', 'root', 'freeze']);
/** Returns true if damage was applied (projectiles are consumed), false if evaded/guarded. */
export function damagePlayer(sim, p, raw, src = null, o = {}) {
  if (p.decoy) { sim.emit({ type: 'decoyHit', x: p.x, y: p.y, pid: p.ownerId }); return true; } // a Shadow Step decoy soaks the hit
  if (p.dead) return false;
  if (p.monk && p.cst && monkDodge(sim, p, src, o)) return false; // Monk Flow State: moving = the hit is dodged
  if (p.sam && p.sam.parry > 0 && samParry(sim, p, src, o)) return true; // Samurai Crescent Parry / Moonlit Guard: parried (no damage, counter)
  const pos = !o.raw && (o.pos || sim.posCheck) && (p.action && p.action.kind === 'dodge' || (p.evdEnd || 0) > sim.tick) && !(p.evade > 0); // (dodge pass 2 step 3: a position check ignores DODGE i-frames; a class movement skill's evade still counts)
  if (!o.raw && !pos && !(p.iframes > 0) && p.action && p.action.kind === 'dodge' && !p.action.evd) { // the dodge rework: a PROPER evade (a hit lands during the dash) -> 0.3 s of i-frames; every hit in that window is evaded
    const a = p.action; a.evd = 1; p.iframes = dodgeOf(p.cls).evade; p.evdEnd = sim.tick + p.iframes; p.lastCombat = sim.tick;
    if (!sim.predicting) sim.emit({ type: 'evaded', pid: p.id, x: p.x, y: p.y, by: o.by || (src && src.name) || undefined });
  }
  if (p.iframes > 0 && !o.raw && !pos) {
    const pd = CLASSES[p.cls].perfectDodge || CLASSES[p.cls].guardDodge, a = p.action; // (guardDodge: Warrior Iron Rebuke, sim/defense.js)
    if (pd && a && a.kind === 'dodge' && a.t <= pd.window && !a.perfect) {
      // Blade Dancer perfect dodge: slipped through an attack right at the start of the dodge
      a.perfect = true;
      p.perfectCrit = pd.ttl;
      if (pd.refund) p.res = Math.min(p.stats.maxRes, p.res + pd.refund); // + Initiative pips
      if (p.eclipse && p.eclipse.ext < ECLIPSE.extMax) { const add = Math.min(ECLIPSE.extPerDodge, ECLIPSE.extMax - p.eclipse.ext); p.eclipse.t += add; p.eclipse.ext += add; sim.emit({ type: 'eclipseExtend', pid: p.id, x: p.x, y: p.y - 60, ext: p.eclipse.ext }); }
      sim.emit({ type: 'perfectDodge', pid: p.id, x: p.x, y: p.y - 30 });
      defPerfect(sim, p); // melee defensive layers (sim/defense.js)
    } else if (!p.lastEvade || sim.tick - p.lastEvade > 12) { sim.emit({ type: 'evade', x: p.x, y: p.y - 30, pid: p.id }); p.lastEvade = sim.tick; }
    return false;
  }
  let dmg = o.pct ? Math.max(1, Math.round(p.stats.maxHp * o.pct)) : mitigate(raw, p.stats.def); // raid mechanics: % of max HP, no defence
  if (p.svVuln && p.svVuln.until > sim.tick) dmg = Math.max(1, Math.round(dmg * vulnMul(sim, p))); // (Savage: a failed strict solve's Vuln stack, sim/savage.js)
  if (p.buf && !o.pct) dmg = Math.max(1, Math.round(dmg * wmHurtMul(p))); // Warrior War Cry / Rally: less damage taken
  dmg = defHurt(sim, p, dmg, o); // Warrior plate / Monk Iron Body soak (sim/defense.js)
  if (p.shield > 0) {
    const ab = Math.min(p.shield, dmg);
    p.shield -= ab; dmg -= ab;
    if (p.shield <= 0) { p.shield = 0; p.shieldT = 0; }
    sim.emit({ type: 'absorb', pid: p.id, x: p.x, y: p.y - p.r, amount: ab, broke: p.shield <= 0 });
    if (dmg <= 0) { p.flash = 4; p.hitstop = Math.max(p.hitstop, 2); return true; } // fully absorbed: no stagger
  }
  p.hp -= dmg;
  p.flash = 8;
  p.lastHurt = sim.tick;
  p.lastCombat = sim.tick;
  p.dmgTaken = (p.dmgTaken || 0) + dmg;
  const rc = CLASSES[p.cls];
  if (rc.gloryRes) gainGlory(sim, p, rc.glory.hurt); // Warrior: taking hits builds a little Glory
  if (p.ultRot && p.ultRot.ids.length && p.dmgTaken - p.ultRot.dmg0 >= p.stats.maxHp * ULT.heavyDmg && !sim.predicting) {
    p.ultRot.ids = []; // heavy damage breaks the rotation in progress
    sim.emit({ type: 'rotationBroken', pid: p.id, x: p.x, y: p.y - 50 });
  }
  sim.emit({ type: 'dmg', x: p.x, y: p.y - p.r, amount: dmg, crit: false, team: 'player', pid: p.id });
  sim.emit({ type: 'hurt', pid: p.id, x: p.x, y: p.y, amount: dmg, heavy: dmg > p.stats.maxHp * 0.15, by: o.by || (src && src.name) || undefined, pct: Math.round(dmg / p.stats.maxHp * 100) }); // (Part E: the death recap reads by + pct)
  if (!p.superArmor) {
    if (o.kb && src && !evadeShove(sim, p)) { const a = Math.atan2(p.y - src.y, p.x - src.x); p.vx += Math.cos(a) * o.kb; p.vy += Math.sin(a) * o.kb; } // (a raw hit during a timed evade still lands, its knockback doesn't)
    if (o.stun) { p.stun = Math.max(p.stun, o.stun); p.action = null; p.held = o.hold ? 1 : 0; p.holdAt = sim.tick; } // (o.hold: a snare / freeze a timed Dodge can break)
  }
  p.hitstop = Math.max(p.hitstop, 3);
  if (p.hp <= 0) killPlayer(sim, p, o.by || 'the wilds');
  return true;
}

export function killPlayer(sim, p, by) {
  p.hp = 0;
  p.dead = true;
  p.action = null;
  defReset(p);
  p.rage = 0; p.aura = 0; p.eclipse = null; p.uw = null; p.cst = null; p.sched = []; p.ws = null;
  p.deaths++;
  // death flow: in the open world (the Wilds / the Dunes, hub mode) the player picks: back at the checkpoint or home to
  // the village (sim command 'respawn'); nobody picks within 8 s -> the checkpoint. Raids / trials / the Tomb keep their
  // own short timer (their encounters revive the party themselves).
  const open = !inRaidArea(p.x, p.y) && !inAstArea(p.x, p.y) && !inTombArea(p.x, p.y) && !inCryptArea(p.x, p.y) && !inHollowArea(p.x, p.y) && !inForgeArea(p.x, p.y) && !inTrialArea(p.x, p.y) && !inOpsArea(p.x, p.y); // (a mission: the dungeon respawn by the objective)
  p.canChoose = open && !!sim.hub ? 1 : 0;
  p.respawnMin = sim.tick + secs(1.2);
  p.respawnAt = sim.tick + secs(p.canChoose ? 8 : 3.5);
  // Death never costs items (bag, equipped, locked: all kept, everywhere). The penalty is the respawn timer / the walk back.
  // (`lost` stays an empty list so older clients that read ev.lost keep working.)
  p.dirty = true;
  sim.emit({ type: 'playerDeath', pid: p.id, x: p.x, y: p.y, by, lost: [] });
}

export function respawnPlayer(sim, p) {
  p.dead = false; p.canChoose = 0;
  const home = sim.hub && sim.hub.spot ? sim.hub.spot(sim, p) : { x: SPAWN_POS.x, y: SPAWN_POS.y + 40 }; // hub mode: town / campfire / raid entrance by where you fell
  p.x = home.x + (sim.rng.next() - 0.5) * 60;
  p.y = home.y + (sim.rng.next() - 0.5) * 30;
  p.px = p.x; p.py = p.y;
  p.vx = p.vy = 0;
  p.hp = p.stats.maxHp;
  p.res = CLASSES[p.cls].rageRes || CLASSES[p.cls].gloryRes || CLASSES[p.cls].focusRes || CLASSES[p.cls].chiRes || CLASSES[p.cls].bloodRes || CLASSES[p.cls].inkRes || CLASSES[p.cls].tempoRes ? 0 : CLASSES[p.cls].resOnBasicHit ? p.stats.maxRes * 0.5 : p.stats.maxRes;
  p.iframes = secs(2);
  p.stun = 0;
  p.action = null;
  p.shield = 0; p.shieldT = 0; p.perfectCrit = 0; defReset(p);
  p.rage = 0; p.aura = 0; p.eclipse = null; p.uw = null; p.cst = null; p.sched = []; // (the ult meter itself is kept)
  for (const k in p.cds) p.cds[k] = 0;
  sim.emit({ type: 'respawn', pid: p.id, x: p.x, y: p.y });
}

// ------------------------------------------------------------------ projectiles
export function spawnProjectile(sim, pr) {
  const proj = {
    id: sim.id(), team: 'player', ownerId: 0, x: 0, y: 0, vx: 0, vy: 0, r: 6, life: 60, dmg: 0, mul: 1,
    pierce: 0, hit: null, kb: 0, stagger: 0, knockdown: 0, explode: 0, homing: 0, style: 'arrow', color: null, ...pr,
  };
  proj.px = proj.x; proj.py = proj.y;
  proj.born = sim.tick;
  gearTag(sim, proj); // (gear Chain / Special Damage follow the projectile)
  if (proj.team === 'player') proj.hit = new Set();
  sim.projectiles.push(proj);
  return proj;
}

function explode(sim, pr) {
  const owner = sim.players.get(pr.ownerId);
  sim.emit({ type: 'explosion', x: pr.x, y: pr.y, r: pr.explode, style: pr.style, pid: pr.ownerId });
  if (owner) hitEnemiesInShape(sim, owner, { shape: 'circle', x: pr.x, y: pr.y, r: pr.explode }, { mul: pr.mul * 0.6, kb: pr.kb, stagger: pr.stagger, hitstop: 4, heavy: true, basic: !!pr.basic }, pr.hit);
}

/** Frostveil halts: { at, hold, mode: 'resume' | 'back' (to the owner) | 'aim' (at the nearest player), sp } */
function haltTick(sim, pr) {
  const h = pr.halt; h.t = (h.t || 0) + 1;
  if (h.t === h.at) { h.vx = pr.vx; h.vy = pr.vy; h.s0 = Math.hypot(pr.vx, pr.vy); pr.vx = 0; pr.vy = 0; pr.life += h.hold; return; }
  if (h.t !== h.at + h.hold) return;
  let tx = null, ty = null;
  if (h.mode === 'back') { const o = sim.enemyById.get(pr.ownerId); if (o && !o.dead) { tx = o.x; ty = o.y; } }
  else if (h.mode === 'aim') { let bd = 1e12; for (const p of sim.players.values()) { if (p.dead) continue; const d = dist2(p.x, p.y, pr.x, pr.y); if (d < bd) { bd = d; tx = p.x; ty = p.y; } } }
  if (tx != null) { const a = Math.atan2(ty - pr.y, tx - pr.x), sp = h.sp || h.s0 || 220; pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp; if (h.mode === 'back') pr.life = Math.min(pr.life, Math.ceil(Math.sqrt(dist2(tx, ty, pr.x, pr.y)) / sp * 60) + 4); }
  else { pr.vx = h.vx; pr.vy = h.vy; }
  pr.halt = null;
}
export function updateProjectiles(sim) {
  const players = [...sim.players.values()];
  for (const pr of sim.projectiles) {
    if (pr.dead) continue;
    pr.px = pr.x; pr.py = pr.y;
    if (pr.homing && pr.team === 'enemy') {
      let best = null, bd = 520 * 520;
      for (const p of players) { if (p.dead || p.stealth > 0) continue; const d = dist2(p.x, p.y, pr.x, pr.y); if (d < bd) { bd = d; best = p; } }
      for (const dc of decoysOf(sim)) { const d = dist2(dc.x, dc.y, pr.x, pr.y) * 0.5; if (d < bd) { bd = d; best = dc; } } // decoys pull homing shots
      if (best) {
        const cur = Math.atan2(pr.vy, pr.vx), want = Math.atan2(best.y - pr.y, best.x - pr.x);
        let d = want - cur; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        const turn = Math.max(-pr.homing * DT, Math.min(pr.homing * DT, d));
        const sp = Math.hypot(pr.vx, pr.vy), na = cur + turn;
        pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
      }
    }
    if (pr.halt) haltTick(sim, pr); // (Frostveil: shards that stop in mid-air, then resume / fly back / re-aim)
    if (pr.accel) { const k = 1 + pr.accel * DT; pr.vx *= k; pr.vy *= k; }
    pr.x += pr.vx * DT; pr.y += pr.vy * DT;
    pr.life--;
    // Assault hall gates: enemy shots cannot cross into the next hall (heroes' own projectiles still can)
    if (pr.team === 'enemy' && pastAssaultGate(sim, pr.x, pr.y)) {
      pr.dead = true; sim.emit({ type: 'projEnd', x: pr.x, y: pr.y, team: pr.team, style: pr.style }); continue;
    }
    if (pr.life <= 0 || pointBlocked(sim.world, pr.x, pr.y, pr.r * 0.4, true)) {
      pr.dead = true;
      if (pr.explode) explode(sim, pr); else sim.emit({ type: 'projEnd', x: pr.x, y: pr.y, team: pr.team, style: pr.style });
      if (pr.split && pr.life <= 0) { const S = pr.split, a0 = Math.atan2(pr.vy, pr.vx); for (let i = 0; i < S.n; i++) { const a = a0 + (i - (S.n - 1) / 2) * S.spread; spawnProjectile(sim, { team: pr.team, ownerId: pr.ownerId, x: pr.x, y: pr.y, vx: Math.cos(a) * S.sp, vy: Math.sin(a) * S.sp, r: 9, life: 110, dmg: pr.dmg * 0.6, style: 'ember', kb: 70, by: pr.by }); } } // (Emberdeep: a Magma Eel's arc splits where it lands)
      continue;
    }
    if (pr.team === 'player') {
      const owner = sim.players.get(pr.ownerId);
      if (!owner) { pr.dead = true; continue; }
      for (const e of sim.enemies) {
        if (e.dead || pr.hit.has(e.id)) continue;
        const rr = pr.r + e.r;
        if (dist2(pr.x, pr.y, e.x, e.y) > rr * rr) continue;
        pr.hit.add(e.id);
        hitEnemy(sim, owner, e, { mul: pr.mul, kb: pr.kb, kbAng: Math.atan2(pr.vy, pr.vx), stagger: pr.stagger, knockdown: pr.knockdown, forceCrit: pr.forceCrit, critVsCC: pr.critVsCC, hitstop: pr.hitstop ?? 2, heavy: pr.heavy, style: pr.style, basic: !!pr.basic, stack: pr.stack, bigNum: pr.bigNum, gch: pr.gch, gsp: pr.gsp });
        if (pr.explode) { pr.dead = true; explode(sim, pr); break; }
        if (pr.pierce === 0) { pr.dead = true; break; }
        if (pr.pierce > 0) pr.pierce--;
      }
    } else {
      if (zoneAt(pr.x, pr.y).id === 0) { pr.dead = true; sim.emit({ type: 'projEnd', x: pr.x, y: pr.y, team: pr.team, style: pr.style }); continue; }
      const dcs = decoysOf(sim);
      let soaked = false;
      for (const dc of dcs) if (dist2(pr.x, pr.y, dc.x, dc.y) < (pr.r + dc.r) ** 2) { soaked = true; pr.dead = true; sim.emit({ type: 'decoyHit', x: dc.x, y: dc.y, pid: dc.ownerId }); sim.emit({ type: 'projEnd', x: pr.x, y: pr.y, team: pr.team, style: pr.style }); break; }
      if (soaked) continue;
      for (const p of players) {
        if (p.dead) continue;
        const rr = pr.r + p.r * 0.8;
        if (dist2(pr.x, pr.y, p.x, p.y) > rr * rr) continue;
        if (damagePlayer(sim, p, pr.dmg, { x: pr.x - pr.vx * 0.05, y: pr.y - pr.vy * 0.05 }, { kb: pr.kb || 60, by: pr.by || enemyName(sim, pr.ownerId), pct: pr.pct })) {
          pr.dead = true;
          sim.emit({ type: 'projEnd', x: pr.x, y: pr.y, team: pr.team, style: pr.style });
          break;
        }
      }
    }
  }
  sim.projectiles = sim.projectiles.filter((p) => !p.dead);
}

// ------------------------------------------------------------------ areas (telegraphs, AoE, traps)
/**
 * Area spec: { team, ownerId, shape:'circle'|'cone'|'line', x,y,r | ang,arc | len,w,
 *   delay (ticks until first pulse), pulses, every, kind (visual), visual:true (no damage),
 *   enemy: dmg, kb, stun | player: mul + cc opts (o), trigger:'proximity', life, committed }
 */
/** Minimum tells (2026-10-19, combat audit step 1): a world boss's damaging ground area never lands in under 0.9 s, so a
 * proper evade (0.3 s window) is a read, not a coin flip. Rift mobs (sim/riftai.js) and duel kit skills (sim/shadowduel.js)
 * carry their own floors. */
export const TELL_FLOOR = { wboss: 54 };
const WB_TYPES = new Set([...Object.keys(WB), 'boss', 'khepra', 'overlord']) // (Grimtusk is type 'boss');
/** Dodge pass 2 step 5: a big single slam lands as 3 beats on the same footprint, `gap` ticks apart. One proper evade (18 ticks)
 * covers one beat and the dodge re-arms after 28, so dodging every beat is impossible; damage is split (sum ~1.05x), only the last beat knocks back/stuns. */
export const SLAM_BEATS = { gap: 24, mul: [0.3, 0.3, 0.45], kb: 90 };
export function slamBeats(spec) {
  return SLAM_BEATS.mul.map((f, i) => {
    const last = i === SLAM_BEATS.mul.length - 1;
    return { ...spec, delay: Math.max(spec.delay, TELL_FLOOR.wboss) + i * SLAM_BEATS.gap, mul: (spec.mul ?? 1) * f, kb: last ? spec.kb : Math.min(spec.kb || 0, SLAM_BEATS.kb), stun: last ? spec.stun : 0, beat: i + 1, beats: SLAM_BEATS.mul.length };
  });
}
export function addArea(sim, spec) {
  const a = { id: sim.id(), born: sim.tick, t: 0, delay: 30, pulses: 1, every: 1, fired: 0, dead: false, ...spec };
  if (a.team === 'enemy' && !a.visual && a.delay < TELL_FLOOR.wboss && a.ownerId != null) { const o = sim.enemyById && sim.enemyById.get(a.ownerId); if (o && WB_TYPES.has(o.type)) a.delay = TELL_FLOOR.wboss; }
  gearTag(sim, a); if (a.o && (a.gch || a.gsp)) a.o = { ...a.o, gch: a.gch, gsp: a.gsp }; // (gear Chain / Special Damage follow the area)
  sim.areas.push(a);
  return a;
}

function fireArea(sim, a) {
  if (a.visual) return;
  if (a.team === 'player') {
    const owner = sim.players.get(a.ownerId);
    if (!owner) return;
    if (a.heal || a.noDamage) { // Sanctuary: heal allies inside, slow enemies inside (no damage)
      let healed = 0, slowed = 0;
      if (a.heal) for (const q of sim.players.values()) if (!q.dead && shapeHits(a, q.x, q.y, q.r * 0.5)) healed += healPlayer(sim, q, q.stats.maxHp * a.heal.pct + owner.stats.atk * a.heal.atk, owner);
      if (a.slow) for (const e of sim.enemies) if (!e.dead && shapeHits(a, e.x, e.y, e.r * 0.5)) { e.cc.slow = Math.max(e.cc.slow, a.slow.t); e.cc.slowMul = a.slow.mul; slowed++; }
      if (a.dot) hitEnemiesInShape(sim, owner, a, { ...a.dot, dot: true }); // Bulwark: holy damage over time inside the circle
      sim.emit({ type: 'areaHit', kind: a.kind, x: a.x, y: a.y, r: a.r, team: 'player', n: slowed, healed: Math.round(healed), pulse: a.fired, pid: a.ownerId });
      return;
    }
    const n = hitEnemiesInShape(sim, owner, a, a.pulses > 1 ? { ...(a.o || { mul: 1 }), dot: true } : a.o || { mul: 1 });
    if (a.kind !== 'burn') sim.emit({ type: 'areaHit', kind: a.kind, x: a.x, y: a.y, r: a.r || a.len, team: 'player', n, pulse: a.fired, pid: a.ownerId });
  } else {
    const gateBeyond = pastAssaultGate(sim, a.x, a.y); // AoE past a closed Assault gate
    for (const p of sim.players.values()) {
      if (p.dead) continue;
      if (gateBeyond && !pastAssaultGate(sim, p.x, p.y)) continue; // hero is still in the closed hall: safe
      if (shapeHits(a, p.x, p.y, p.r * 0.7)) damagePlayer(sim, p, a.dmg, { x: a.shape === 'circle' ? a.x : p.x - Math.cos(a.ang || 0) * 10, y: a.shape === 'circle' ? a.y : p.y - Math.sin(a.ang || 0) * 10 }, { kb: a.kb, stun: a.stun, hold: a.hold || HOLD_KINDS.has(a.kind), by: a.by || enemyName(sim, a.ownerId), pct: a.pct });
    }
    sim.emit({ type: 'areaHit', kind: a.kind, x: a.x, y: a.y, r: a.r || a.len, team: 'enemy', shape: a.shape, ang: a.ang, arc: a.arc, len: a.len, w: a.w });
  }
}

export function updateAreas(sim) {
  for (const a of sim.areas) {
    if (a.dead) continue;
    a.t++;
    if (a.follow) { const e = sim.enemyById.get(a.follow); if (e && !e.dead) { a.x = e.x; a.y = e.y; } }
    if (a.trigger === 'proximity') {
      a.life--;
      if (a.life <= 0) { a.dead = true; continue; }
      if (a.t < 20) continue;
      const hitE = sim.enemies.some((e) => !e.dead && dist2(e.x, e.y, a.x, a.y) < (a.triggerR + e.r) ** 2);
      if (hitE) { a.dead = true; fireArea(sim, a); }
      continue;
    }
    if (a.t >= a.delay && a.fired < a.pulses && (a.t - a.delay) % a.every === 0) {
      fireArea(sim, a);
      a.fired++;
    }
    if (a.fired >= a.pulses && a.t >= a.delay + (a.pulses - 1) * a.every) a.dead = true;
  }
  sim.areas = sim.areas.filter((a) => !a.dead);
}
