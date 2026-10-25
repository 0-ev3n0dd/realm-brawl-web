// Spawn sites + Swarm events (spawns pass, step 1 of 4): replaces the per-player horde director.
// * Sites (world.sites, sim/sitegen.js): fixed landmarks across every open-world zone, each with a big cluster of fodder
//   (20-60 by Danger ring, +30% per extra hero) plus a few elites. They idle and patrol loosely round their spot, wake as a
//   group when a hero comes close or hits one, hunt within a leash round the site and walk home healing when the heroes
//   run off. A cleared site comes back 3-4 minutes later, and only while every hero is out of view of it.
//   Lazy like the camps: members exist only while a hero is within SITE.wake; untouched sites pack away again.
// * Fodder keep a light version of their type's real attack (FODDER_KIT): goblins throw spears, wisps fire bolts, wolves
//   lunge, imps drop fire pools, skeletons swing... every one with a readable telegraph (sim areas the client draws).
//   Packs mix roles: melee rushers in front, ranged at the back, a caster that wards nearby allies (a damage shield).
//   Cheap: idle members think every 3rd tick, targets refresh every 12 ticks (staggered), fodder projectiles are capped.
// * Swarm events: every few minutes one site area near a hero is marked (minimap / map icon + callout); a hero who goes
//   there starts a 4-wave fight (~60-90 s) that ends in a bonus loot chest (materials + gold + a gear roll).
// * Normal dungeons: each wave room also gets fixed nest clusters when it starts.
// Pure sim code, own RNG stream, authoritative sim only (spawning on; never in the prediction sim / empty test sims).
import { withLootLevel } from './loot.js';
import { weeklyBoard, inRegion, WK } from './weekly.js';
import { makeRelic, RELIC_DROP } from './exotic.js';
import { Rng } from './rng.js';
import { secs, DT, zoneAt } from './constants.js';
import { ENEMIES } from './data/enemies.js';
import { spawnEnemy, updateEnemy } from './ai.js';
import { damagePlayer, addArea, spawnProjectile, showerCtx } from './combat.js';
import { resolveCircle, pointBlocked } from './world.js';
import { tickStacks } from './kit.js';
import { oasisPush, TOMB_ROOMS, tombRoomAt } from './dunesconst.js';
import { campPush, CRYPT_ROOMS, cryptRoomAt } from './frostconst.js';
import { HOLLOW_ROOMS, hollowRoomAt } from './glowconst.js';
import { outpostPush, FORGE_ROOMS, forgeRoomAt } from './emberconst.js';
import { FODDER_GEAR, showerFor } from './drops.js';
import { rollLoot } from './loot.js';
import { SITE_ROSTERS, siteZone, bossZones } from './sitegen.js';
import { HORDE, fodderPartyMul } from './horde.js';

/** this week's board, cached per sim (re-read every ~10 min of sim time) */
function boardOf(sim) { if (sim.wkBoard) return sim.wkBoard; if (!sim._wkB || sim.tick - (sim._wkT | 0) > 36000) { sim._wkB = weeklyBoard(sim.opsNow ?? Date.now()); sim._wkT = sim.tick; } return sim._wkB; }
export const SITE = {
  every: 6,           // site manager cadence (ticks)
  wake: 2200,         // members exist while a hero is this close to the centre
  noPop: 1050,        // ...but never appear while a hero is this close (just off a 1080p screen at the default zoom)
  sleep: 2900,        // an untouched site packs away (quietly) once every hero is further than this
  aggroR: 430,        // a hero this close to a member (or a hit on one) wakes the whole site
  huntR: 1140,        // aggroed members hunt heroes this far from themselves... (THREAT: was 950)
  leash: 1250,        // ...but never further than this from the centre: past it they give up, walk home, heal
  calm: secs(3),      // no hero within the leash for this long: the site resets (walks home, heals)
  respawn: [secs(180), secs(240)], // a cleared site comes back after this...
  awayR: 1400,        // ...once every hero has been this far away (out of view) for `awayT`
  awayT: secs(8),
  coop: 0.3,          // +30% fodder per extra hero (counted when the site spawns)
  projCap: 40,        // live fodder projectiles (all sites): more attacks just don't fire (the Spore Cap lesson)
  idleEvery: 3,       // idle members think every 3rd tick
  retarget: 12,
  r0: 140, rPer: 3.2, // cluster radius = r0 + rPer * size
};
/** per fodder type: role (melee / ranged; the caster role is assigned per site) + its attack. keep: ranged spacing. */
const L = (o) => ({ k: 'lunge', range: 220, wind: 22, len: 210, w: 30, spd: 4, dur: 12, cd: [90, 140], mul: 1.1, kb: 200, ...o });
const SH = (o) => ({ k: 'shot', range: 400, wind: 26, spd: 300, r: 8, life: 110, cd: [110, 160], mul: 1, n: 1, spread: 0.25, ...o });
const SW = (o) => ({ k: 'swing', range: 70, wind: 24, r: 82, arc: 1.7, cd: [80, 120], mul: 1.1, kb: 220, ...o });
const SL = (o) => ({ k: 'slam', range: 110, wind: 40, r: 110, cd: [140, 190], mul: 1.4, kb: 320, ...o });
const HP = (o) => ({ k: 'hop', range: 160, wind: 24, r: 46, cd: [80, 130], mul: 1, kb: 160, ...o });
const PL = (o) => ({ k: 'pool', range: 380, wind: 40, r: 60, pulses: 3, every: 24, cd: [150, 210], mul: 0.42, ...o });
export const FODDER_KIT = {
  slime: { role: 'melee', a: HP({}) },
  goblin: { role: 'ranged', a: SH({ style: 'spear', spd: 330, r: 7, range: 380, name: 'spear throw' }), keep: [200, 320] },
  sprout: { role: 'ranged', rooted: 1, a: SH({ style: 'seed', spd: 240, range: 380 }), keep: [0, 9999] },
  boar: { role: 'melee', a: L({ range: 280, wind: 34, len: 260, w: 40, spd: 6, dur: 11, cd: [130, 180], mul: 1.3, kb: 320, name: 'charge' }) },
  skeleton: { role: 'melee', a: SW({ name: 'swing' }) },
  shroom: { role: 'ranged', a: { k: 'spray', range: 320, wind: 30, n: 5, spd: 160, r: 8, life: 120, cd: [170, 220], mul: 0.8, style: 'spore', name: 'spore puff' }, keep: [160, 280] },
  golem: { role: 'melee', a: SL({ name: 'slam' }) },
  wisp: { role: 'ranged', a: SH({ style: 'hex', spd: 220, r: 9, homing: 0.6, life: 150, range: 420, name: 'bolt' }), keep: [230, 340] },
  wolf: { role: 'melee', a: L({ name: 'lunge' }) },
  knight: { role: 'melee', a: SW({ r: 120, arc: 1.9, wind: 32, mul: 1.2, range: 100 }) },
  imp: { role: 'ranged', a: PL({ name: 'fire pool' }), keep: [220, 340] },
  scarabling: { role: 'melee', a: HP({ r: 38, wind: 20, cd: [60, 100], mul: 1.3 }) },
  scarab: { role: 'melee', a: L({ range: 240 }) },
  jackal: { role: 'melee', a: L({ range: 240, wind: 20 }) },
  mummy: { role: 'melee', a: SW({ r: 96, wind: 28 }) },
  sunpriest: { role: 'ranged', a: SH({ style: 'sun', spd: 240, r: 9, range: 420 }), keep: [240, 360] },
  mirage: { role: 'ranged', a: SH({ style: 'sand', spd: 260 }), keep: [220, 340] },
  penguin: { role: 'melee', a: L({ range: 300, wind: 26, len: 320, w: 34, spd: 5, dur: 14, name: 'belly slide' }) },
  rimewraith: { role: 'ranged', a: SH({ style: 'ice', spd: 300, range: 420 }), keep: [220, 340] },
  shardwisp: { role: 'ranged', a: SH({ style: 'ice', spd: 260, n: 3, spread: 0.24, mul: 0.7, name: 'shard fan' }), keep: [230, 340] },
  yeti: { role: 'melee', a: SL({ r: 120 }) },
  acolyte: { role: 'ranged', a: SH({ style: 'snow', spd: 240, r: 9 }), keep: [240, 360] },
  sentinel: { role: 'melee', a: SL({}) },
  cinderling: { role: 'melee', a: HP({ r: 40, wind: 20 }) },
  kindler: { role: 'ranged', a: SH({ style: 'ember', spd: 320, range: 380 }), keep: [200, 320] },
  moth: { role: 'ranged', a: PL({ r: 54 }), keep: [220, 340] },
  mortar: { role: 'ranged', a: { k: 'lob', range: 460, wind: 50, r: 70, cd: [160, 220], mul: 1.1, kb: 200, name: 'lobbed rock' }, keep: [260, 420] },
  basalt: { role: 'melee', a: SL({ r: 120 }) },
  thrall: { role: 'melee', a: SW({ r: 110, wind: 30 }) },
  construct: { role: 'melee', a: SW({ r: 100 }) },
  // the Astral Rift (game loop C3)
  voidling: { role: 'melee', a: HP({ r: 40, wind: 20 }) },
  riftstalker: { role: 'melee', a: L({ range: 260, wind: 22, name: 'void pounce' }) },
  starwisp: { role: 'ranged', a: SH({ style: 'hex', spd: 240, r: 9, homing: 0.5, life: 150, range: 420, name: 'star bolt' }), keep: [230, 340] },
  voidarcher: { role: 'ranged', a: SH({ style: 'dark', spd: 340, n: 3, spread: 0.2, mul: 0.7, range: 440, name: 'void volley' }), keep: [240, 360] },
  astralknight: { role: 'melee', a: SW({ r: 120, arc: 1.9, wind: 30, mul: 1.2, range: 100 }) },
  voidgolem: { role: 'melee', a: SL({ r: 120 }) },
};
/** the caster role: a ward (damage shield) on the allies round it, telegraphed by a gold circle while it channels */
export const WARD = { wind: 40, r: 260, cd: [300, 380], shield: 0.5, dur: secs(7), max: 10, every: 6 };
export const SWARM = {
  first: secs(75),    // first event after a hero has been out in the world this long
  every: secs(150),   // then this long after the last one ended (so ~one every 3.5-4 min with the fight itself)
  minD: 1000, maxD: 3200, // marked this far from the hero it picks
  markT: secs(120),   // waits this long for someone to come
  joinR: 420,         // a hero this close to the mark starts the fight
  waves: [0, secs(16), secs(32), secs(48)], // wave start times (4 waves)
  size: [22, 28, 34, 40], elites: [0, 1, 2, 3],
  ring: [520, 660],   // waves arrive from this ring round the mark
  maxT: secs(90),     // the chest appears by now even if some of the swarm is still standing
  failR: 1500, failT: secs(10), // every hero this far away for this long (or all dead): the swarm disperses
  chestLife: secs(90), openR: 70, shareR: 1400,
};
export const CHEST_TABLE = [{ k: 'gold', p: 1, n: [8, 12], g: 4 }, { k: 'mat', pool: 'common', p: 1, n: [5, 8] }, { k: 'mat', pool: 'rare', p: 1, n: [2, 3] }, { k: 'mat', pool: 'trophy', p: 0.35 }, { k: 'hp', p: 1, n: [2, 2] }, { k: 'res', p: 1, n: [2, 2] }];
export const CHEST_GEAR = 0.85; // chance of a gear roll (elite quality) per hero
const DUNGEONS = [
  { key: 'tomb', st: 'tomb', rooms: TOMB_ROOMS, at: tombRoomAt, flag: 'tombWave', mul: 1.7, tier: 4, roster: 'dunes' },
  { key: 'crypt', st: 'crypt', rooms: CRYPT_ROOMS, at: cryptRoomAt, flag: 'cryptWave', mul: 1.9, tier: 5, roster: 'frost' },
  { key: 'hollow', st: 'glow', rooms: HOLLOW_ROOMS, at: hollowRoomAt, flag: 'glowWave', mul: 1.4, tier: 4, roster: 'w3' },
  { key: 'forge', st: 'forge', rooms: FORGE_ROOMS, at: forgeRoomAt, flag: 'forgeWave', mul: 1.9, tier: 5, roster: 'ember' },
];
const ROOM = { size: [14, 18], coop: 4, second: secs(14) }; // dungeon wave rooms: two nest clusters per room
const TAU = Math.PI * 2;
const rr = (rng, [a, b]) => a + Math.floor(rng.next() * (b - a + 1));

export function createSites(sim) {
  const defs = (sim.world && sim.world.sites) || [];
  const H = {
    rng: new Rng(((sim.seed | 0) * 7 + 0x40ed) >>> 0), zones: bossZones(sim.spawners, 450),
    sites: defs.map((d) => ({ d, st: 'empty', m: [], n0: 0, aggro: false, calmT: 0, awayT: 0, respawnAt: 0, ev: false, touched: false })),
    ev: { st: 'idle', next: 0, seen: 0, n: 0 }, rooms: {}, projLive: 0, orphans: [],
    stats: { spawned: 0, despawned: 0, kills: 0, sitesSpawned: 0, cleared: 0, respawned: 0, swarms: 0, chests: 0 },
  };
  return H;
}
const nearBoss = (H, x, y) => H.zones.some((z) => (x - z.x) ** 2 + (y - z.y) ** 2 < z.r * z.r);

/** the nearest living hero's distance to (x, y) (Infinity: none) */
function nearestHero(pl, x, y) { let b = Infinity; for (const p of pl) { const d = Math.hypot(p.x - x, p.y - y); if (d < b) b = d; } return b; }

/** Spawn one fodder unit of `type` at (x, y) for `ctx` ({ mul, hpMul, tier, key }); site: the owning site runtime (or null). */
export function spawnFodder(sim, ctx, type, x, y, site = null, role = null) {
  const F = HORDE.fod, d = ENEMIES[type], K = FODDER_KIT[type] || FODDER_KIT.slime;
  const e = spawnEnemy(sim, type, x, y, { mul: ctx.mul, hpMul: ctx.hpMul, tier: ctx.tier, fodder: true, ramp: ctx.ramp });
  e.horde = 1; e.hctx = ctx.key;
  const base = e.mlv ? e.baseMaxHp : Math.max(1, Math.round(e.baseMaxHp * F.hp)); // (on the level curve: its fodder HP already; else the 0.55 share)
  e.baseMaxHp = base; e.maxHp = e.hp = Math.max(1, Math.round(base * fodderPartyMul(sim)));
  e.dmg *= F.dmg; e.xp = Math.max(1, Math.round(e.xp * F.xp)); e.defense = Math.round(e.defense * F.def);
  e.r = Math.max(F.minR, Math.round(d.r * F.r)); e.mass = Math.max(0.5, e.mass * 0.7); e.contact = false;
  const rng = sim.horde ? sim.horde.rng : sim.rng;
  e.spd = d.spd > 0 ? Math.max(80, Math.min(165, d.spd || 110)) * (0.88 + 0.24 * rng.next()) : 0;
  e.dropChance = FODDER_GEAR; e.state = 'idle'; e.st = 0; e.cd = 20 + Math.floor(rng.next() * 80); e.cd2 = 60 + Math.floor(rng.next() * 200); e.poise = e.maxPoise = 40;
  e.ht = (e.id * 7) % SITE.retarget; e.fk = type; e.role = role || K.role;
  if (site) { e.site = site.d.id + 1; e.siteRef = site; }
  if (sim.horde) sim.horde.stats.spawned++;
  return e;
}

/** cluster spots round a site: a few clumps round the landmark, melee in front, ranged behind, the caster in the middle */
function clusterSpot(sim, H, cx, cy, R, role) {
  for (let k = 0; k < 8; k++) {
    const a = H.rng.next() * TAU, f = role === 'caster' ? 0.15 + 0.2 * H.rng.next() : role === 'ranged' ? 0.55 + 0.45 * H.rng.next() : 0.25 + 0.6 * Math.sqrt(H.rng.next());
    const x = cx + Math.cos(a) * R * f, y = cy + Math.sin(a) * R * f * 0.8;
    if (!pointBlocked(sim.world, x, y, 16)) return { x, y };
  }
  return { x: cx + (H.rng.next() - 0.5) * 60, y: cy + (H.rng.next() - 0.5) * 60 };
}
function rosterPick(H, R) { return R.f[Math.floor(H.rng.next() * R.f.length)]; }

/** fill a site (or a swarm wave / a dungeon nest) with n fodder (+ elites) round (cx, cy); returns the members */
export function populate(sim, H, ctx, R, cx, cy, n, elites, site, rad, opts = {}) {
  const out = [];
  const casters = n >= 14 ? Math.max(1, Math.floor(n / 16)) : 0;
  for (let i = 0; i < n; i++) {
    const caster = i < casters;
    let type = caster ? R.c : rosterPick(H, R);
    if (opts.spot && FODDER_KIT[type] && FODDER_KIT[type].rooted) type = R.f.find((t) => !FODDER_KIT[t].rooted && FODDER_KIT[t].role === 'ranged') || R.f[0]; // (waves walk in: no rooted turrets)
    const role = caster ? 'caster' : (FODDER_KIT[type] || FODDER_KIT.slime).role;
    const at = opts.spot ? opts.spot(role) : clusterSpot(sim, H, cx, cy, rad, role);
    const e = spawnFodder(sim, ctx, type, at.x, at.y, site, role);
    if (caster) { e.cd2 = 40 + Math.floor(H.rng.next() * 60); e.maxHp = e.hp = Math.round(e.maxHp * 1.6); e.baseMaxHp = Math.round(e.baseMaxHp * 1.6); }
    out.push(e);
  }
  for (let i = 0; i < elites; i++) {
    const at = opts.spot ? opts.spot('melee') : clusterSpot(sim, H, cx, cy, rad * 0.6, 'melee');
    const e = spawnEnemy(sim, R.e[Math.floor(H.rng.next() * R.e.length)], at.x, at.y, { elite: true, mul: ctx.mul, hpMul: ctx.hpMul, tier: ctx.tier, ramp: ctx.ramp });
    e.siteLead = 1; if (site) { e.site = site.d.id + 1; e.siteRef = site; }
    out.push(e);
  }
  return out;
}

const heroesNear = (pl, x, y, r) => { let n = 0; for (const p of pl) if (Math.abs(p.x - x) < r && Math.abs(p.y - y) < r) n++; return Math.max(1, n); };
function spawnSite(sim, H, S, pl) {
  const d = S.d, R = SITE_ROSTERS[d.key], heroes = heroesNear(pl, d.x, d.y, SITE.wake + 400);
  const sc = sim.hordeScale ?? 1;
  const n = Math.max(6, Math.round(d.size * (1 + SITE.coop * (heroes - 1)) * sc)), el = d.elites + (heroes >= 3 ? 1 : 0);
  const rad = SITE.r0 + SITE.rPer * Math.min(60, d.size);
  S.m = populate(sim, H, { mul: d.mul, hpMul: d.hpMul, tier: d.tier, key: d.key }, R, d.x, d.y, n, el, S, rad);
  for (const e of S.m) { e.homeX = e.x; e.homeY = e.y; }
  S.n0 = S.m.length; S.st = 'live'; S.aggro = false; S.calmT = 0; S.touched = false; S.awayT = 0;
  H.stats.sitesSpawned++;
}
function packSite(H, S, quiet = true) {
  for (const e of S.m) if (!e.dead) { e.dead = true; e.hp = 0; e.despawned = quiet; H.stats.despawned++; }
  S.m = []; S.st = 'empty'; S.aggro = false;
}
function wake(H, S, p) {
  if (!S.aggro) { S.aggro = true; S.touched = true; }
  S.calmT = 0;
  for (const e of S.m) if (!e.dead) { e.huntR = SITE.huntR; e.leashT = 0; if (!e.aggroId && p) e.aggroId = p.id; if (e.horde && e.cd > 30) e.cd = 4 + ((e.id * 13) % 36); } // (the pack opens up fast: a big pack is a threat, not a pinata)
}
function calm(S) {
  S.aggro = false;
  for (const e of S.m) if (!e.dead) { e.huntR = 0; e.aggroId = 0; e.htgt = 0; e.leashT = secs(4); if (e.state !== 'idle') { e.state = 'idle'; e.st = 0; } }
}

/** The site manager (every SITE.every ticks): spawn / pack away / wake / leash / respawn + the Swarm event + dungeon nests. */
export function updateSites(sim) {
  const H = sim.horde;
  if (!H || sim.predicting) return;
  if (sim.tick % 10 === 3) { let n = 0; for (const q of sim.projectiles) if (q.fod && !q.dead) n++; H.projLive = n; }
  if (sim.tick % SITE.every !== 0) return;
  const pl = []; for (const p of sim.players.values()) if (!p.dead) pl.push(p);
  const E = SITE.every;
  for (const S of H.sites) {
    const d = S.d;
    if (S.ev) continue; // (a Swarm event owns this spot right now)
    const near = nearestHero(pl, d.x, d.y);
    if (S.st === 'empty') {
      if (near < SITE.wake && near > SITE.noPop) spawnSite(sim, H, S, pl);
      continue;
    }
    if (S.st === 'cleared') {
      S.awayT = near > SITE.awayR ? S.awayT + E : 0;
      if (sim.tick >= S.respawnAt && S.awayT >= SITE.awayT && near < SITE.wake) { spawnSite(sim, H, S, pl); H.stats.respawned++; }
      continue;
    }
    // live
    if (S.m.some((e) => e.dead)) { S.m = S.m.filter((e) => !e.dead); S.touched = true; }
    if (!S.m.length) { S.st = 'cleared'; S.respawnAt = sim.tick + rr(H.rng, SITE.respawn); S.awayT = 0; S.aggro = false; H.stats.cleared++; continue; }
    if (near > SITE.sleep) {
      // nobody around: an untouched site packs away; a half-cleared one refills only after the respawn timer
      if (!S.touched) { packSite(H, S); continue; }
      if (!S.leftAt) S.leftAt = sim.tick;
      if (sim.tick - S.leftAt > SITE.respawn[0] && S.m.length < S.n0 * 0.6) { packSite(H, S); S.st = 'cleared'; S.respawnAt = sim.tick; S.leftAt = 0; continue; }
    } else S.leftAt = 0;
    if (S.aggro) {
      for (const e of S.m) if (e.eshT > 0 && (e.eshT -= E) <= 0) e.esh = 0;
      if (near > SITE.leash) { S.calmT += E; if (S.calmT >= SITE.calm) calm(S); }
      else S.calmT = 0;
      // stragglers chasing past the leash give up on their own
      for (const e of S.m) if (!e.leashT && (e.x - d.x) ** 2 + (e.y - d.y) ** 2 > SITE.leash * SITE.leash) { e.leashT = secs(3); e.aggroId = 0; e.htgt = 0; e.state = 'idle'; e.st = 0; }
    } else {
      // detection: a member was hit (hitEnemy sets aggroId, from any range), or a hero close to any member
      let who = null;
      for (const e of S.m) {
        if (e.aggroId && !(e.leashT > 0)) { who = sim.players.get(e.aggroId) || pl[0]; break; }
        if (near >= SITE.leash) continue;
        for (const p of pl) if (Math.abs(p.x - e.x) < SITE.aggroR && Math.abs(p.y - e.y) < SITE.aggroR && (p.x - e.x) ** 2 + (p.y - e.y) ** 2 < SITE.aggroR * SITE.aggroR && !(p.stealth > 0)) { who = p; break; }
        if (who) break;
      }
      if (who) wake(H, S, who);
    }
    for (const e of S.m) if (e.leashT > 0) {
      e.leashT = Math.max(0, e.leashT - E);
      if (!S.aggro && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03);
      if (!S.aggro && near > SITE.awayR) { e.x = e.px = e.homeX; e.y = e.py = e.homeY; e.hp = e.maxHp; e.vx = e.vy = 0; } // (out of everyone's view: back on its spot at once)
    }
  }
  if (H.orphans.length) H.orphans = H.orphans.filter((e) => { if (e.dead) return false; if (nearestHero(pl, e.x, e.y) > 1600) { e.dead = true; e.hp = 0; e.despawned = true; return false; } return true; });
  updateRooms(sim, H, pl);
  updateSwarm(sim, H, pl);
}

// ------------------------------------------------------------------ dungeon wave rooms: fixed nests per room
function updateRooms(sim, H, pl) {
  for (const D of DUNGEONS) {
    const T = sim[D.st];
    const st = H.rooms[D.key] || (H.rooms[D.key] = { room: -1, t: 0, n: 0, m: [] });
    if (!T || T.st !== 'room' || T.room >= 3) { if (st.m.length) { for (const e of st.m) if (!e.dead) { e.dead = true; e.hp = 0; e.despawned = true; } st.m = []; } st.room = -1; continue; }
    if (st.room !== T.room) { for (const e of st.m) if (!e.dead) { e.dead = true; e.hp = 0; e.despawned = true; } st.m = []; st.room = T.room; st.t = sim.tick; st.n = 0; }
    const inside = pl.filter((p) => D.at(p.x, p.y, 0) === T.room);
    if (!inside.length) continue;
    if (st.n >= 2 || (st.n === 1 && sim.tick - st.t < ROOM.second)) continue;
    const Rm = D.rooms[T.room], p0 = inside[0], base = Math.atan2(Rm.y - p0.y, Rm.x - p0.x) + (st.n ? 1.4 : 0) * (H.rng.next() < 0.5 ? -1 : 1);
    const cx = Rm.x + Math.cos(base) * Rm.r * 0.55, cy = Rm.y + Math.sin(base) * Rm.r * 0.55;
    const n = rr(H.rng, ROOM.size) + ROOM.coop * (inside.length - 1);
    const ms = populate(sim, H, { mul: D.mul, hpMul: 1, tier: D.tier, key: D.key }, SITE_ROSTERS[D.roster], cx, cy, n, 0, null, Rm.r * 0.35);
    for (const e of ms) { e[D.flag] = 1; e.hroom = T.room; e.homeX = Rm.x; e.homeY = Rm.y; e.huntR = 1000; e.aggroId = p0.id; }
    st.m.push(...ms); st.n++;
    if (st.m.length > 80) st.m = st.m.filter((e) => !e.dead);
  }
}

// ------------------------------------------------------------------ Swarm events
function emitSw(sim, ph, ev, extra = {}) { sim.emit({ type: 'swarm', ph, x: Math.round(ev.x), y: Math.round(ev.y), key: ev.key, wave: ev.wave, nw: SWARM.waves.length, ...extra }); }
function pickSwarm(sim, H, pl) {
  const out = [];
  for (const p of pl) {
    const z = siteZone(p.x, p.y); if (!z) continue;
    const bio = z.key[0] === 'w' ? 'w' : z.key;
    for (const S of H.sites) {
      const d = S.d, b = d.key[0] === 'w' ? 'w' : d.key;
      if (b !== bio || S.ev || (S.st === 'live' && S.aggro)) continue;
      const dd = Math.hypot(d.x - p.x, d.y - p.y);
      if (dd < SWARM.minD || dd > SWARM.maxD || nearestHero(pl, d.x, d.y) < SWARM.minD * 0.9) continue;
      out.push(S);
    }
    if (out.length) break;
  }
  return out.length ? out[Math.floor(H.rng.next() * out.length)] : null;
}
function swarmCtx(S) { const d = S.d; return { mul: d.mul, hpMul: d.hpMul, tier: d.tier, key: d.key }; }
function updateSwarm(sim, H, pl) {
  const ev = H.ev, E = SITE.every;
  if (ev.st === 'idle') {
    const out = pl.some((p) => siteZone(p.x, p.y));
    if (!out) return;
    if (!ev.next) ev.next = sim.tick + (pl.some((p) => { const z = siteZone(p.x, p.y); return z && inRegion(boardOf(sim), z.key); }) ? WK.swarmFirst : SWARM.first); // (game loop B3: the bonus region)
    if (sim.tick < ev.next) return;
    const S = pickSwarm(sim, H, pl);
    if (!S) { ev.next = sim.tick + secs(10); return; }
    if (S.st === 'live') packSite(H, S);
    S.ev = true; S.st = 'empty';
    Object.assign(ev, { st: 'marked', site: S, x: S.d.x, y: S.d.y, key: S.d.key, t0: sim.tick, wave: 0, mobs: [], chest: null, away: 0, n: ev.n + 1 });
    H.stats.swarms++;
    emitSw(sim, 'mark', ev, { lm: S.d.lm });
    return;
  }
  if (ev.st === 'marked') {
    if (pl.some((p) => Math.hypot(p.x - ev.x, p.y - ev.y) < SWARM.joinR)) { ev.st = 'fight'; ev.t0 = sim.tick; emitSw(sim, 'start', ev); return; }
    if (sim.tick - ev.t0 > SWARM.markT) { endSwarm(sim, H, 'fade'); }
    return;
  }
  if (ev.st === 'fight') {
    const t = sim.tick - ev.t0;
    if (ev.mobs.some((e) => e.dead)) ev.mobs = ev.mobs.filter((e) => !e.dead);
    while (ev.wave < SWARM.waves.length && t >= SWARM.waves[ev.wave]) spawnWave(sim, H, ev, pl);
    for (const e of ev.mobs) if (e.eshT > 0 && (e.eshT -= E) <= 0) e.esh = 0;
    const near = nearestHero(pl, ev.x, ev.y);
    ev.away = near > SWARM.failR ? ev.away + E : 0;
    if (!pl.length || ev.away >= SWARM.failT) { endSwarm(sim, H, 'fail'); return; }
    const done = ev.wave >= SWARM.waves.length && (!ev.mobs.length || t >= SWARM.maxT);
    if (done) {
      ev.st = 'chest'; ev.chest = { x: ev.x, y: ev.y, t: sim.tick }; H.stats.chests++;
      emitSw(sim, 'win', ev, { left: ev.mobs.length });
    }
    return;
  }
  if (ev.st === 'chest') {
    const opener = pl.find((p) => Math.hypot(p.x - ev.chest.x, p.y - ev.chest.y) < SWARM.openR + p.r);
    if (opener || sim.tick - ev.chest.t > SWARM.chestLife) { openChest(sim, H, ev, pl, opener); endSwarm(sim, H, 'done'); }
  }
}
function spawnWave(sim, H, ev, pl) {
  const S = ev.site, R = SITE_ROSTERS[S.d.key], i = ev.wave, heroes = heroesNear(pl, ev.x, ev.y, SWARM.failR);
  const n = Math.round(SWARM.size[i] * (1 + SITE.coop * (heroes - 1)) * (sim.hordeScale ?? 1)), el = SWARM.elites[i] + (heroes >= 3 && i >= 2 ? 1 : 0);
  const side = H.rng.next() * TAU;
  const spot = () => {
    for (let k = 0; k < 8; k++) {
      const a = side + (H.rng.next() - 0.5) * 2.6, r = SWARM.ring[0] + H.rng.next() * (SWARM.ring[1] - SWARM.ring[0]);
      const x = ev.x + Math.cos(a) * r, y = ev.y + Math.sin(a) * r;
      if (pointBlocked(sim.world, x, y, 16) || !siteZone(x, y)) continue;
      if (pl.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < 420 * 420)) continue;
      return { x, y };
    }
    return { x: ev.x + Math.cos(side) * SWARM.ring[1], y: ev.y + Math.sin(side) * SWARM.ring[1] };
  };
  const ms = populate(sim, H, swarmCtx(S), R, ev.x, ev.y, n, el, null, 0, { spot });
  const tgt = pl.reduce((b, p) => (!b || Math.hypot(p.x - ev.x, p.y - ev.y) < Math.hypot(b.x - ev.x, b.y - ev.y) ? p : b), null);
  for (const e of ms) { e.homeX = ev.x; e.homeY = ev.y; e.huntR = 1400; e.swarm = 1; if (tgt) e.aggroId = tgt.id; if (e.siteLead) e.dropChance = 0.4; }
  ev.mobs.push(...ms); ev.wave++;
  emitSw(sim, 'wave', ev, { n: ms.length });
}
function openChest(sim, H, ev, pl, opener) {
  const c = ev.chest, fake = { x: c.x, y: c.y, chest: 1, elite: true, boss: false, horde: 0, zone: ev.site.d.tier, type: 'chest' };
  const sctx = showerCtx(sim, fake), got = [];
  for (const p of pl) {
    if (Math.hypot(p.x - c.x, p.y - c.y) > SWARM.shareR) continue;
    const items = withLootLevel(p.level, () => H.rng.next() < CHEST_GEAR ? rollLoot(sim.rng, { tier: ev.site.d.tier, cls: p.cls, elite: true, boss: false, dropChance: 1 }) : []);
    if (H.rng.next() < RELIC_DROP.chest) items.push(withLootLevel(p.level, () => makeRelic(sim.rng, p.cls, Math.max(3, Math.min(7, (ev.site.d.tier | 0) + 1))))); // (gear expansion: Swarm chests can hold a Relic)
    let bag = null;
    if (items.length) { bag = { id: sim.id(), x: c.x, y: c.y, items, ownerId: p.id, life: secs(90), rarity: Math.max(...items.map((it) => it.rarity)) }; sim.bags.push(bag); }
    showerFor(sim, fake, p, bag, { ...sctx, table: CHEST_TABLE });
    if (bag) sim.emit({ type: 'loot', x: bag.x, y: bag.y, rarity: bag.rarity, pid: p.id, id: bag.id, vac: 1 });
    got.push(p.id);
  }
  emitSw(sim, 'open', ev, { by: opener ? opener.id : 0, pids: got });
}
function endSwarm(sim, H, why) {
  const ev = H.ev, S = ev.site;
  if (why === 'fail' || why === 'fade') for (const e of ev.mobs || []) if (!e.dead) { e.dead = true; e.hp = 0; e.despawned = true; }
  else for (const e of ev.mobs || []) if (!e.dead) H.orphans.push(e); // (stragglers after the chest: they melt away once nobody's near)
  if (why !== 'done') emitSw(sim, why, ev);
  if (S) { S.ev = false; S.st = 'cleared'; S.respawnAt = sim.tick + rr(H.rng, SITE.respawn); S.awayT = 0; }
  const every = S && S.d && inRegion(boardOf(sim), S.d.key) ? WK.swarmEvery : SWARM.every; // (game loop B3: Swarms come every ~2 min in the bonus region)
  Object.assign(ev, { st: 'idle', next: sim.tick + (why === 'fade' ? Math.round(every / 2) : every), site: null, mobs: [], chest: null });
}
/** compact Swarm state for the clients (snapshot 'sw'; solo reads it straight off the sim) */
export function packSwarm(sim) {
  const ev = sim.horde && sim.horde.ev;
  if (!ev || ev.st === 'idle') return null;
  const t = sim.tick - ev.t0;
  return { st: ev.st, x: Math.round(ev.x), y: Math.round(ev.y), key: ev.key, lm: ev.site ? ev.site.d.lm : '', wave: ev.wave, nw: SWARM.waves.length, left: (ev.mobs || []).length, t,
    end: ev.st === 'marked' ? SWARM.markT - t : ev.st === 'fight' ? Math.max(0, SWARM.maxT - t) : ev.chest ? SWARM.chestLife - (sim.tick - ev.chest.t) : 0, ch: ev.chest ? [Math.round(ev.chest.x), Math.round(ev.chest.y)] : 0 };
}

// ------------------------------------------------------------------ fodder AI
function pickTarget(sim, e) {
  if (e.taunt && e.taunt.t > 0) { const q = sim.players.get(e.taunt.pid); if (q && !q.dead) return q; }
  const R = e.huntR || 600;
  let best = null, bd = R * R;
  for (const p of sim.players.values()) {
    if (p.dead || p.stealth > 0) continue;
    const d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2;
    if (d < bd && zoneAt(p.x, p.y).id !== 0) { bd = d; best = p; }
  }
  return best;
}
function push(e) {
  if (e.dz) oasisPush(e); else if (e.ez) outpostPush(e); else if (e.fz) campPush(e);
  else { const d = Math.hypot(e.x, e.y); if (d < 300 + e.r) { const k = (300 + e.r) / (d || 1); e.x *= k; e.y *= k; } } // (the Haven)
}
const setSt = (e, s) => { e.state = s; e.st = 0; };
const cdOf = (sim, a) => a.cd[0] + Math.floor((sim.horde || sim).rng.next() * (a.cd[1] - a.cd[0] + 1));
function fArea(sim, e, spec) { return addArea(sim, { team: 'enemy', ownerId: e.id, dmg: e.dmg * (spec.mul ?? 1), by: e.name, ...spec }); }
function fShot(sim, e, ang, a) {
  const H = sim.horde;
  if (H && H.projLive >= SITE.projCap) return null;
  if (H) H.projLive++;
  const pr = spawnProjectile(sim, { team: 'enemy', ownerId: e.id, x: e.x + Math.cos(ang) * e.r * 0.8, y: e.y + Math.sin(ang) * e.r * 0.8, vx: Math.cos(ang) * a.spd, vy: Math.sin(ang) * a.spd, r: a.r || 8, life: a.life || 110, dmg: e.dmg * (a.mul ?? 1), homing: a.homing || 0, style: a.style || 'orb', kb: a.kb || 80, by: e.name });
  pr.fod = 1;
  return pr;
}

/** start the attack (telegraph now, the hit lands when the wind-up ends) */
function startAttack(sim, e, t, a) {
  const ang = Math.atan2(t.y - e.y, t.x - e.x);
  e.lock = ang; e.hitDone = false;
  switch (a.k) {
    case 'lunge': fArea(sim, e, { shape: 'line', x: e.x, y: e.y, ang, len: Math.round(e.spd * a.spd * a.dur / 60 + e.r + 14), w: a.w, delay: a.wind, visual: true, kind: 'lunge' }); break;
    case 'shot': fArea(sim, e, { shape: 'line', x: e.x, y: e.y, ang, len: Math.min(a.range, 260), w: 10 + (a.n > 1 ? 14 : 0), delay: a.wind, visual: true, kind: 'aim', follow: e.id }); break;
    case 'swing': fArea(sim, e, { shape: 'cone', x: e.x, y: e.y, ang, arc: a.arc, r: a.r, delay: a.wind, mul: a.mul, kb: a.kb, kind: 'swing' }); break;
    case 'slam': fArea(sim, e, { shape: 'circle', x: e.x, y: e.y, r: a.r, delay: a.wind, mul: a.mul, kb: a.kb, stun: 10, kind: 'slam' }); break;
    case 'hop': {
      const d = Math.min(170, Math.hypot(t.x - e.x, t.y - e.y)), tx = e.x + Math.cos(ang) * d, ty = e.y + Math.sin(ang) * d;
      e.tx = tx; e.ty = ty;
      fArea(sim, e, { shape: 'circle', x: tx, y: ty, r: a.r, delay: a.wind, mul: a.mul, kb: a.kb, kind: 'hop' }); break;
    }
    case 'pool': fArea(sim, e, { shape: 'circle', x: t.x + (t.vx || 0) * 0.25, y: t.y + (t.vy || 0) * 0.25, r: a.r, delay: a.wind, pulses: a.pulses, every: a.every, mul: a.mul, kind: 'fpool' }); break;
    case 'lob': fArea(sim, e, { shape: 'circle', x: t.x + (t.vx || 0) * 0.3, y: t.y + (t.vy || 0) * 0.3, r: a.r, delay: a.wind, mul: a.mul, kb: a.kb, kind: 'rock', committed: true }); break;
    case 'spray': fArea(sim, e, { shape: 'circle', x: e.x, y: e.y, r: 70, delay: a.wind, visual: true, kind: 'spore', follow: e.id, ang: ang + (e.rot || 0) }); break; // (ang = where the first spore goes)
  }
  setSt(e, 'wind'); e.atk = a;
}
function resolveAttack(sim, e, t, a) {
  switch (a.k) {
    case 'lunge': setSt(e, 'lunge'); return;
    case 'shot': { const ang = t ? Math.atan2(t.y - e.y, t.x - e.x) : e.lock; const n = a.n || 1; for (let i = 0; i < n; i++) fShot(sim, e, ang + (i - (n - 1) / 2) * (a.spread || 0.25), a); break; }
    case 'spray': { const n = a.n || 5, off = (t ? Math.atan2(t.y - e.y, t.x - e.x) : e.lock) + (e.rot || 0); for (let i = 0; i < n; i++) fShot(sim, e, off + (i / n) * TAU, a); e.rot = e.rot ? 0 : 0.3; break; } // (a ring with one spore aimed at the target)
    default: break;
  }
  setSt(e, 'recover');
}
function wardAllies(sim, e) {
  const S = e.siteRef, list = S ? S.m : e.swarm && sim.horde && sim.horde.ev ? sim.horde.ev.mobs : sim.enemies; // (dungeon nests: anyone near; rare enough to scan)
  let n = 0;
  for (const o of list) {
    if (o.dead || o === e || n >= WARD.max || o.boss) continue;
    if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 > WARD.r * WARD.r) continue;
    o.esh = Math.round(o.maxHp * WARD.shield); o.eshT = WARD.dur; n++;
  }
  e.esh = Math.round(e.maxHp * WARD.shield * 0.5); e.eshT = WARD.dur;
  sim.emit({ type: 'ward', x: Math.round(e.x), y: Math.round(e.y), r: WARD.r, id: e.id, n });
}

/** Per tick for a fodder unit (sim.step). Idle members patrol loosely (every 3rd tick); aggroed ones fight. */
export function updateFodder(sim, e) {
  if (e.flash > 0) e.flash--;
  if (e.hitstop > 0) { e.hitstop--; return; }
  if (e.contactCd > 0) e.contactCd--;
  let moved = false;
  if (e.vx || e.vy) {
    e.x += e.vx * DT; e.y += e.vy * DT; e.vx *= 0.85; e.vy *= 0.85; moved = true;
    if (Math.abs(e.vx) < 2 && Math.abs(e.vy) < 2) e.vx = e.vy = 0;
  }
  if (e.cc.slow > 0) e.cc.slow--;
  if (e.sunder && --e.sunder.t <= 0) e.sunder = null;
  if (e.taunt && --e.taunt.t <= 0) e.taunt = null;
  if (e.mark && --e.mark.t <= 0) e.mark = null;
  if (e.stx) tickStacks(e);
  if (e.cc.down > 0) { e.cc.down--; if (moved) resolveCircle(sim.world, e); return; }
  if (e.cc.stun > 0) { if (--e.cc.stun === 0) { e.cc.frozen = false; e.cc.rooted = false; } if (moved) resolveCircle(sim.world, e); return; }
  const hunting = !!e.aggroId && !(e.leashT > 0);
  if (!hunting) { // idle / walking home: patrol loosely round home (cheap: every 3rd tick, 3 steps at once)
    if (e.state !== 'idle') setSt(e, 'idle');
    if ((sim.tick + e.id) % SITE.idleEvery !== 0) return;
    const dh = Math.hypot(e.homeX - e.x, e.homeY - e.y), k = SITE.idleEvery;
    if (dh > 120) { const a = Math.atan2(e.homeY - e.y, e.homeX - e.x); e.face = a; const sp = e.spd * (e.leashT > 0 ? 1.1 : 0.7) * DT * k; e.x += Math.cos(a) * sp; e.y += Math.sin(a) * sp; moved = true; }
    else if (e.spd > 0) {
      if ((e.wanderT -= k) <= 0) { const r = (sim.horde || sim).rng; e.wanderT = 70 + Math.floor(r.next() * 140); e.wanderA = r.next() < 0.4 ? null : r.next() * TAU; }
      if (e.wanderA != null) { e.face = e.wanderA; const sp = e.spd * 0.3 * DT * k; e.x += Math.cos(e.wanderA) * sp; e.y += Math.sin(e.wanderA) * sp; moved = true; }
    }
    if (moved) { resolveCircle(sim.world, e); push(e); }
    return;
  }
  if (--e.ht <= 0) { e.ht = SITE.retarget; const t = pickTarget(sim, e); e.htgt = t ? t.id : 0; if (!t) e.aggroId = 0; }
  const t = e.htgt ? sim.players.get(e.htgt) : sim.players.get(e.aggroId);
  if (!t || t.dead || t.stealth > 0) { e.htgt = 0; if (e.state !== 'idle' && e.state !== 'recover') setSt(e, 'idle'); return; }
  const K = FODDER_KIT[e.fk] || FODDER_KIT.slime, a = K.a;
  const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
  e.st++;
  const rate = e.atkRate || 1;
  if (e.cd > 0) e.cd = Math.max(0, e.cd - rate);
  if (e.cd2 > 0) e.cd2 = Math.max(0, e.cd2 - rate);
  switch (e.state) {
    case 'wind':
      if (e.atk && e.atk.k !== 'lunge') e.face = ang;
      if (e.atk && e.atk.k === 'hop' && e.st === e.atk.wind - 9) { e.vx = (e.tx - e.x) * 9; e.vy = (e.ty - e.y) * 9; } // (the hop lands as the slam fires)
      if (e.atk && e.st >= e.atk.wind) resolveAttack(sim, e, t, e.atk);
      break;
    case 'ward':
      if (e.st >= WARD.wind) { wardAllies(sim, e); setSt(e, 'recover'); e.cd2 = cdOf(sim, WARD); }
      break;
    case 'lunge': {
      const A = e.atk || a; e.face = e.lock;
      const sp = e.spd * A.spd * DT; e.x += Math.cos(e.lock) * sp; e.y += Math.sin(e.lock) * sp; moved = true;
      if (!e.hitDone && (t.x - e.x) ** 2 + (t.y - e.y) ** 2 < (e.r + t.r + 6) ** 2) { e.hitDone = true; damagePlayer(sim, t, e.dmg * A.mul, e, { kb: A.kb, by: e.name }); }
      if (e.st >= A.dur) { setSt(e, 'recover'); }
      break;
    }
    case 'recover':
      if (e.st >= 18) { setSt(e, 'idle'); e.cd = cdOf(sim, e.atk || a); }
      break;
    default: {
      e.face = ang;
      if (e.role === 'caster' && e.cd2 <= 0 && d < 520) { setSt(e, 'ward'); fArea(sim, e, { shape: 'circle', x: e.x, y: e.y, r: WARD.r, delay: WARD.wind, visual: true, kind: 'ward', follow: e.id }); break; }
      if (e.cd <= 0 && d < a.range + t.r) { startAttack(sim, e, t, a); break; }
      // movement by role: melee close in; ranged / casters keep their spacing behind the front line
      let want = 0;
      if (e.role === 'melee') want = d > e.r + t.r - 2 ? 1 : 0;
      else { const kp = e.role === 'caster' ? [300, 420] : (K.keep || [220, 340]); want = d > kp[1] ? 1 : d < kp[0] ? -0.7 : 0; if (!want && e.spd > 0) { want = 0.45; } }
      if (want && e.spd > 0) {
        let mv = ang;
        if (e.slide > 0) { e.slide--; mv += e.slideDir * 1.35; }
        if (want === 0.45) mv += (e.id % 2 ? 1 : -1) * Math.PI / 2; // strafe while in the band
        else if (want < 0) mv += Math.PI;
        const sp = e.spd * Math.abs(want) * (e.cc.slow > 0 ? e.cc.slowMul : 1) * (d < 140 ? 0.85 : want > 0 && d > 380 ? 1.3 : 1) * DT; // (rush in from afar, ease off up close)
        e.x += Math.cos(mv) * sp; e.y += Math.sin(mv) * sp; moved = true;
      }
    }
  }
  if (moved && ((sim.tick + e.id) & 1) === 0) {
    const ox = e.x, oy = e.y;
    if (resolveCircle(sim.world, e)) { // blocked: follow the obstacle's edge; still stuck after a while -> try the other way round
      if (!(e.slide > 0)) { e.slide = 30; e.slideN = 0; e.slideDir = ((e.x - ox) * dy - (e.y - oy) * dx) > 0 ? 1 : -1; }
      else if (++e.slideN > 14) { e.slideDir = -e.slideDir; e.slideN = 0; e.slide = 40; }
      else e.slide = Math.max(e.slide, 20);
    }
    push(e);
  }
}
/** an elite / tough site member uses its full AI (ai.js); the site manager handles its wake / leash */
export function updateSiteLead(sim, e) { updateEnemy(sim, e); }
export { nearBoss as siteNearBoss };
