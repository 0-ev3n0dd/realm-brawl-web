// Hordes: the shared fodder rules. (Mobbing pass 1 streamed fodder at each hero from off-screen with a per-player wave
// director; the spawns pass replaced that with fixed spawn sites + Swarm events: sim/sites.js, sim/sitegen.js.)
// Fodder are cheap variants of the biome's own enemy types (same art, ~55% HP: one typical chain hit at that content's gear
// level, two for a weak basic) that keep a light version of their type's real attack (sites.js FODDER_KIT).
// Co-op: more fodder per site per extra hero (sites.js SITE.coop) and a little fodder HP (HORDE.fod.party).
import { zoneAt, inRaidArea } from './constants.js';
import { inAstArea } from './astraelconst.js';
import { TOMB_ROOMS, tombRoomAt } from './dunesconst.js';
import { CRYPT_ROOMS, cryptRoomAt } from './frostconst.js';
import { HOLLOW_ROOMS, hollowRoomAt } from './glowconst.js';
import { FORGE_ROOMS, forgeRoomAt } from './emberconst.js';
import { DUNES_MUL } from './dunesgen.js';
import { FROST_MUL, FROST_HP } from './frostgen.js';
import { EMBER_MUL, EMBER_HP } from './embergen.js';
import { spawnFodder } from './sites.js';
import { spawnEnemy } from './ai.js';

export const HORDE = {
  fod: { hp: 0.55, dmg: 0.7, xp: 0.1, def: 0.5, r: 0.85, minR: 11, party: 0.25 },
};

/** per biome / ring: fodder ('f') and tougher units ('t') (tools + tests; the sites use sitegen.js SITE_ROSTERS) */
export const ROSTERS = {
  w1: { f: ['slime', 'goblin', 'slime'], t: ['goblin'] },
  w2: { f: ['goblin', 'slime', 'skeleton'], t: ['boar', 'shroom'] },
  w3: { f: ['wolf', 'wisp', 'wolf'], t: ['golem', 'wolf'] },
  w4: { f: ['imp', 'wolf', 'imp'], t: ['knight', 'imp'] },
  dunes: { f: ['scarabling', 'scarab', 'jackal', 'scarabling'], t: ['jackal', 'scarab'] },
  frost: { f: ['penguin', 'rimewraith', 'penguin'], t: ['yeti', 'shardwisp'] },
  ember: { f: ['cinderling', 'kindler', 'moth', 'cinderling'], t: ['basalt', 'mortar'] },
  rift: { f: ['voidling', 'riftstalker', 'starwisp', 'voidling'], t: ['voidgolem', 'astralknight'] },
  tomb: { f: ['scarabling', 'scarab', 'jackal'], t: ['mummy', 'sunpriest'] },
  crypt: { f: ['penguin', 'rimewraith'], t: ['acolyte', 'sentinel'] },
  hollow: { f: ['mirecap', 'thornhound', 'goblin'], t: ['bogbrute', 'mothling'] },
  forge: { f: ['cinderling', 'kindler'], t: ['construct', 'thrall'] },
};
const DUNGEONS = [
  { key: 'tomb', st: 'tomb', rooms: TOMB_ROOMS, at: tombRoomAt, flag: 'tombWave', mul: 1.7, tier: 4 },
  { key: 'crypt', st: 'crypt', rooms: CRYPT_ROOMS, at: cryptRoomAt, flag: 'cryptWave', mul: 1.9, tier: 5 },
  { key: 'hollow', st: 'glow', rooms: HOLLOW_ROOMS, at: hollowRoomAt, flag: 'glowWave', mul: 1.4, tier: 4 },
  { key: 'forge', st: 'forge', rooms: FORGE_ROOMS, at: forgeRoomAt, flag: 'forgeWave', mul: 1.9, tier: 5 },
];
const nearBoss = (sim, x, y) => !!(sim.horde && sim.horde.zones.some((z) => (x - z.x) ** 2 + (y - z.y) ** 2 < z.r * z.r));

/** where a hero stands, horde-wise: null (no hordes here) or { key, roster, mul, hpMul, tier, gz (gold zone), room, dz } */
export function hordeCtx(sim, p) {
  if (!p || p.dead) return null;
  for (const D of DUNGEONS) {
    const T = sim[D.st]; if (!T) continue;
    const ri = D.at(p.x, p.y, 0);
    if (ri < 0) continue;
    if (T.st !== 'room' || ri !== T.room || ri >= 3) return null;
    return { key: D.key, roster: ROSTERS[D.key], mul: D.mul, hpMul: 1, tier: D.tier, gz: 4, room: D.rooms[ri], ri, dz: D };
  }
  if (inRaidArea(p.x, p.y) || inAstArea(p.x, p.y)) return null;
  const z = zoneAt(p.x, p.y);
  if (!z || !(z.danger > 0) || z.town || z.trial || z.tomb || z.crypt || z.forge || z.hollow) return null;
  if (nearBoss(sim, p.x, p.y)) return null;
  if (z.dunes) return { key: 'dunes', roster: ROSTERS.dunes, mul: DUNES_MUL[z.danger] || 1, hpMul: 1, tier: z.tier, gz: 4, zid: z.id };
  if (z.frost) return { key: 'frost', roster: ROSTERS.frost, mul: FROST_MUL[z.danger] || 1, hpMul: FROST_HP[z.danger] || 1, tier: z.tier, gz: 4, zid: z.id };
  if (z.ember) return { key: 'ember', roster: ROSTERS.ember, mul: EMBER_MUL[z.danger] || 1, hpMul: EMBER_HP[z.danger] || 1, tier: z.tier, gz: 4, zid: z.id };
  if (z.rift) return { key: 'rift', roster: ROSTERS.rift, mul: EMBER_MUL[z.danger] || 1, hpMul: EMBER_HP[z.danger] || 1, tier: z.tier, gz: 4, zid: z.id }; // (game loop C3: same band ladder as Emberdeep)
  const w = Math.max(1, Math.min(4, z.id | 0));
  return { key: 'w' + w, roster: ROSTERS['w' + w], mul: 1, hpMul: 1, tier: w, gz: w, zid: z.id };
}

/** fodder HP multiplier for the party size (much gentler than the regular +55% per hero: more heroes = more fodder instead) */
export const fodderPartyMul = (sim) => 1 + (sim.partySize() - 1) * HORDE.fod.party;

/** Spawn one horde unit of `type` at (x, y) for ctx, already hunting hero p (tools / tests / dungeon helpers).
 *  tough = a regular unit with its full AI (elite optional); otherwise a fodder unit (sites.js fodder AI + attack). */
export function spawnHordeUnit(sim, ctx, type, x, y, p, tough = false, elite = false) {
  let e;
  if (tough) { e = spawnEnemy(sim, type, x, y, { mul: ctx.mul, hpMul: ctx.hpMul, tier: ctx.tier, elite, ramp: ctx.ramp }); e.siteLead = 1; e.hordeLead = 1; e.dropChance = 0.25; }
  else e = spawnFodder(sim, ctx, type, x, y);
  e.aggroId = p.id; e.htgt = p.id; e.huntR = 1100; e.homeX = x; e.homeY = y;
  if (ctx.dz) { e[ctx.dz.flag] = 1; e.hroom = ctx.ri; }
  return e;
}

/** a horde unit died (combat.killEnemy): count it */
export function hordeKill(sim, e) {
  if (sim.horde) sim.horde.stats.kills = (sim.horde.stats.kills || 0) + 1;
}
