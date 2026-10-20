// Part C — the Astral World (docs/ASCENSION-PLAN.md). The first Ascension unlocks an Astral hard mode of every map,
// dungeon, mission and Trial: same geometry and fights, an Astral layer on top.
//   levels   base Lv 50 in the Wilds, stepping up per map to ~60 in the Rift (ASTRAL.map + a small in-map step); the HP
//            follows the mob level curve (sim/mobhp.js: past 50 it eases off, never past "Lv 60" HP), damage / XP the
//            level scale (sim/levelscale.js dmgK / xpK) from the level each zone was tuned at
//   bosses   every boss: HP / damage to its map's Astral level (+2), plus the Astral mechanics (sim/astralboss.js)
//   mobs     every normal mob is a smart mob, every elite carries an affix (Part A3), +1 Astral affix on elites
//   mode     sim.astral (0/1) is the HOST's choice when the party leaves town (Realm Gate map toggle: player.astralOn,
//            only honoured when that hero's account has an Ascended hero: player.astralOk); the open-world sites pack away
//            and refill at the new level when the mode flips. No invulnerability anywhere, no item loss.
import { mapOf } from './mobhp.js';
import { hpK, dmgK, xpK, encHpK, ENC_LV } from './levelscale.js';

export const ASTRAL = {
  map: { haven: 50, dunes: 52, frost: 54, ember: 56, rift: 58 }, // base Astral level per map
  span: { haven: [2, 12], dunes: [13, 20], frost: [21, 30], ember: [31, 40], rift: [41, 49] }, // the normal band, for the in-map step
  step: 2, // up to +2 levels inside a map (its deeper zones)
  boss: 2, // bosses sit 2 levels above their map
  ref: { haven: 17, dunes: 20, frost: 20, ember: 20, rift: 20 }, // damage + XP scale from a tuned-at level of at least this (the endgame feel: early maps' mobs were tuned on starter
  //          gear (the Wilds' types hit softest, so a lower ref brings them up to the rest), so scaling them from Lv 2 -> 50 on the damage curve would one-shot a capped hero; the Rift is tuned at 19-22)
  hard: { dmg: 1.15 }, // the hard-mode step on top of the level (Astral mobs + bosses)
  mats: { astral_ash: [1, 3], starsteel: [0, 1] }, // per Astral elite (client rewards.js), boss: x6 + starheart
};
/** the Astral level of a zone row (sim/mobhp.js zoneLv) */
export function astralLv(z) {
  if (!z) return 0; const m = mapOf(z.roster), base = ASTRAL.map[m] ?? 50, sp = ASTRAL.span[m] || [z.L, z.L];
  const t = sp[1] > sp[0] ? Math.max(0, Math.min(1, (z.L - sp[0]) / (sp[1] - sp[0]))) : 0;
  return base + Math.round(t * ASTRAL.step);
}
/** a zone row moved to its Astral level (same roster / tweaks; tuned-at level kept so damage + XP scale from it) */
export const astralZone = (z) => (z ? { ...z, L: astralLv(z), was: Math.max(z.was ?? z.L, ASTRAL.ref[mapOf(z.roster)] ?? 20), astral: 1 } : z);
/** the band a normal level belongs to -> the boss's Astral level */
const bandOf = (L) => Object.keys(ASTRAL.span).find((k) => L <= ASTRAL.span[k][1]) || 'rift';
export function astralBossLv(L) {
  const m = bandOf(L);
  return ASTRAL.map[m] + ASTRAL.step + ASTRAL.boss;
}
/** scale a freshly spawned boss in place to its Astral level (after levelscale.scaleBoss). L0 = its normal level, was = the
 *  level its damage was tuned at (levelscale BOSS_LV, else L0): damage lands on dmgK(Astral L, max(was, ref)) x hard. */
export function astralBoss(e, L0, was = L0) {
  const L = astralBossLv(L0), ref = Math.max(was, ASTRAL.ref[bandOf(L0)] ?? 20), h = hpK(L, L0), d = dmgK(L, ref) / dmgK(L0, was) * ASTRAL.hard.dmg, x = xpK(L, ref) / xpK(L0, was);
  const hk = h * (e.type === 'raidboss' ? ASTRAL_LEN.raidboss : 1); // (C2: Vorthax's HP is the spawn's own: its length fit rides here)
  e.maxHp = Math.round(e.maxHp * hk); e.hp = Math.round(e.hp * hk); if (e.baseMaxHp) e.baseMaxHp = Math.round(e.baseMaxHp * hk);
  e.dmg *= d; e.xp = Math.round(e.xp * x); e.blv = L; e.astral = 1; e.akHp = h; e.akD = d;
  return e;
}
/** an encounter's extra HP factor in Astral (encounters that set their own HP at fight start: levelscale ENC_LV rows) */
export const astralEncK = (sim, L0) => (sim && sim.astral && L0 ? hpK(astralBossLv(L0), L0) : 1);
/** the host flips the mode on departure: open-world sites pack away so they refill at the new level */
export function setAstral(sim, on) {
  on = on ? 1 : 0; if ((sim.astral | 0) === on) return false;
  sim.astral = on;
  const H = sim.horde; // (sim/sites.js: spawn sites refill at the new level)
  if (H && H.sites) for (const S of H.sites) { for (const e of S.m || []) if (!e.dead) { e.dead = true; e.hp = 0; e.despawned = true; } S.m = []; S.st = 'cleared'; S.respawnAt = sim.tick; S.awayT = 1e9; S.aggro = false; }
  for (const sp of sim.spawners || []) { if (sp.off) continue; for (const id of sp.alive || []) { const e = sim.enemyById.get(id); if (e && !e.dead) { e.dead = true; e.hp = 0; e.despawned = true; } } sp.alive = []; sp.respawnAt = 1; sp.fresh = true; }
  for (const e of sim.enemies) if (!e.dead && !e.dummy && (e.mlv || e.boss) && !e.raid && !e.arena) { e.dead = true; e.hp = 0; e.despawned = true; }
  sim.emit({ type: 'astral', on });
  return true;
}
/** may this hero turn Astral on? (the client sends it from the account: an Ascended hero) */
export const astralAllowed = (p) => !!(p && p.astralOk);
/** encounter HP factor incl. Astral (levelscale encHpK x the Astral step from the encounter's level) */
/** C2 fight-length fit (tools/balance/astral-len.mjs): Astral HP x this per encounter, so Astral dungeon bosses run 4-5 min
 *  typical and Trials / Extremes 6-8 min, with the weakest class (Lv 50 Rift gear) killing before the encounter's enrage */
/** the Astral enrage stretch (encounters whose own timer would beat the weakest class at Astral HP: the Glowmire fights) */
export const astralEnr = (sim, t) => (sim && sim.astral ? Math.round(t * 1.2) : t);
export const ASTRAL_LEN = { lumivex: 1.29, tomb: 1.3, crypt: 1.23, forge: 0.785, raidboss: 1.81, trvharok: 1.24, trvharokx: 1.1, nft: 1.17, nfx: 1.09, nfs: 1.3, /* (Part 1S: Savage, fitted by tools/balance/astral-len.mjs) */ skt: 0.77, skx: 0.66, pyt: 0.56, pyx: 0.55, astn: 0.42, astx: 0.38 };
export const encHpA = (sim, k, id = k) => encHpK(k) * (sim && sim.astral ? astralEncK(sim, ENC_LV[k] && ENC_LV[k][0]) * (ASTRAL_LEN[id] ?? 1) : 1);
/** Astral dungeon bosses: an any-class Core / Body / Soul chance (on top of the Astral materials) */
export const ASTRAL_DUNGEON = ['lumivex', 'neferakh', 'osric', 'hephast', 'raidboss'];
export const ASTRAL_DROP = { piece: 0.35, heroes: ['warrior', 'ranger', 'mage', 'cleric', 'bladedancer', 'samurai', 'monk', 'dragoon', 'summoner', 'bard'], pieces: ['core', 'body', 'soul'] };
/** what an Astral kill gives (client rewards.js, per player): { mats: [{id, n}], pieces: [{cls, k}] } */
export function rollAstral(rnd, { elite = false, boss = false, etype = '' } = {}) {
  const out = { mats: [], pieces: [] }; if (!elite && !boss) return out;
  const k = boss ? 6 : 1, add = (id, n) => { if (n > 0) out.mats.push({ id, n }); };
  for (const [id, [a, b]] of Object.entries(ASTRAL.mats)) add(id, Math.round((a + Math.floor(rnd() * (b - a + 1))) * k));
  if (boss) add('starheart', 1 + (rnd() < 0.5 ? 1 : 0));
  if (boss && ASTRAL_DUNGEON.includes(etype) && rnd() < ASTRAL_DROP.piece) out.pieces.push({ cls: ASTRAL_DROP.heroes[Math.floor(rnd() * 10)], k: ASTRAL_DROP.pieces[Math.floor(rnd() * 3)] });
  return out;
}
