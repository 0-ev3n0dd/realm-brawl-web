// Missions (Warframe-style mission dungeons), the runtime. Five mission types, one instanced arena per open-world map
// (sim/opsconst.js). Revamp part 1 (2026-10-08): Defense and Swarm rebuilt, + the shared framework on every type.
//  DEFENSE  hold the relic through 5 waves a round. Between waves: a BUILD phase (spend the mission material the kills
//           drop on turrets / spike traps / wards at the six sockets round the relic). The relic fights back: heroes near
//           it (and kills round it) CHARGE it; full = a PULSE (stuns + blasts the crowd, refills its shield). Waves 2-4
//           roll a modifier (Swift / Armored / Flanking / Elite Escort / Sappers); wave 5 is the SIEGE (sim/opsboss.js).
//           Round won: Extract or Continue (harder, one more set piece), as before.
//  SWARM    8 escalating horde waves, then the SWARM QUEEN. The arena changes as it goes: the safe ring shrinks at waves
//           3 / 5 / 7 and for the Queen (outside it hurts), hazard surges at waves 4 / 6. A COMBO meter (kills inside a
//           4 s window) lifts the loot: x1.25 / x1.5 / x1.75 / x2 at 10 / 25 / 50 / 100, bonus showers from x25. The
//           party has 3 lives (a full wipe costs one; respawns by the objective).
//  MOBILE DEFENSE / ASSAULT (revamp part 2, sim/opsrun2.js + sim/opsboss2.js): the 3-stage carrier escort (hack points,
//           ambushes, the collapsing bridge, the hunter squad, the boss at the final point) and the stronghold raid
//           (shield pylons, the trap hall, the champion, the Gatekeeper with real patterns).
//  CAPTURE (revamp part 3, sim/opsrun3.js + sim/opsboss3.js): track the quarry by its clues + footprints across a
//           hunting ground, run it down through its snares / guards / decoys, pin it (nets, escape rigs, damage) before
//           the escape clock runs out, then capture it in a real fight in the Hunter's Ring.
//  Shared (sim/opsmods.js): biome hazards (sim/opshaz.js), the S/A/B/C grade + grade-scaled rewards + the results
//  screen, the weekly twist + boon.
// Started from the fixed entrances by each map's camp (hub request 'op', sim/hub.js); the whole party is pulled in; at the
// end the rewards pop out in the arena (results beat) and everyone is sent back to the entrance they came from.
// Server-authoritative (a predicting client sim only applies the Assault gate clamp). Death = the dungeon respawn (3.5 s,
// by the objective); items are never lost. Co-op clients read packOps (snapshot 'op').
import { withLootLevel } from './loot.js';
import { weeklyBoard, isFeatured, WK } from './weekly.js';
import { Rng } from './rng.js';
import { secs, DT, zoneAt } from './constants.js';
import { zoneEliteHp, zoneLv, normalHp } from './mobhp.js';
import { OPS, opsBossHpK, OPS_BIOME, OPS_ZONES, WAVE_MODS, arenaOf, opsArenaAt, opsMissionId, clampGate, inOpsArea } from './opsconst.js';
import { OPS_HAZ, weeklyMods, hasMod, gradeRecord } from './opsmods.js';
import { opsHurt, hurtRelic, hazInit, tickHazard, nearestOf } from './opshaz.js';
import { siegeAi, queenAi, eggAi } from './opsboss.js';
import { bindOps2, beginMobile, tickMobile, rebootCart, beginAssault, tickAssault, pylonDown, ops2Ai, packOps2, gradeStats2, spot2 } from './opsrun2.js';
import { bindOps3, beginCapture, tickCapture, netThrow, capKill, ops3Ai, packOps3, gradeStats3, spot3, capRewards } from './opsrun3.js';
import { spawnEnemy } from './ai.js';
import { populate } from './sites.js';
import { SITE_ROSTERS } from './sitegen.js';
import { showerFor } from './drops.js';
import { showerCtx, addArea, damagePlayer } from './combat.js';
import { rollLoot } from './loot.js';
import { TIER_MAX } from './data/items.js';
import { makeSetItem } from './sets.js';
import { makeRelic, makeExotic } from './exotic.js';
import { resolveCircle } from './world.js';

const TAU = Math.PI * 2;
const r0 = (v) => Math.round(v);
const alive = (sim) => { const l = []; for (const p of sim.players.values()) if (!p.dead && inOpsArea(p.x, p.y)) l.push(p); return l; };
const here = (sim) => { const l = []; for (const p of sim.players.values()) if (inOpsArea(p.x, p.y)) l.push(p); return l; };
const emit = (sim, ph, o = {}) => { const O = sim.ops; sim.emit({ type: 'ops', ph, k: O ? O.type : '', b: O ? O.biome : '', ...o }); };
const near = (pl, x, y) => { let b = null, bd = Infinity; for (const p of pl) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; b = p; } } return { p: b, d: bd }; };

/** biome name of the swarm brood / queen / siege beasts */
export const OPS_BEASTS = {
  wilds: { siege: ['golem', 'Ironbark Siege Golem'], queen: ['shroom', 'The Sporemother'], brood: 'slime' },
  dunes: { siege: ['mummy', 'Tomb Siegebreaker'], queen: ['scarab', 'Scarab Brood Queen'], brood: 'scarabling' },
  frost: { siege: ['yeti', 'Rimebreaker Yeti'], queen: ['rimewraith', 'Rimewing Queen'], brood: 'penguin' },
  ember: { siege: ['basalt', 'Magma Ram'], queen: ['moth', 'Cinder Moth Queen'], brood: 'cinderling' },
  rift: { siege: ['voidgolem', 'The Star Breaker'], queen: ['starwisp', 'The Nebula Mother'], brood: 'voidling' },
};
export const EGG_NAME = 'Brood Egg';
/** a new mission run (the hub pulls the party in right after) */
export function startOps(sim, biome, type, back = null) {
  if (sim.ops) endOps(sim);
  const A = arenaOf(biome, type), B = OPS_BIOME[biome];
  if (!A) return null;
  const Z = zoneLv(OPS_ZONES[biome].id);
  const O = sim.ops = {
    biome, type, mid: opsMissionId(biome, type), A, st: 'intro', t: 0, sub: 0, back,
    rng: new Rng(((sim.seed | 0) * 31 + sim.tick * 7 + A.bi * 5 + A.ti + 0x0b5) >>> 0),
    mobs: [], kills: 0, elites: 0, n0: 0, earned: 0, result: null, endT: 0, leave: false, msg: '',
    // shared framework: this week's modifiers (stamped on the run), deaths baseline, the grade at the end
    mods: (sim.opsMods || weeklyMods(sim.opsNow ?? Date.now()).ids).slice(), d0: {}, grade: null,
    feat: sim.opsFeat != null ? (sim.opsFeat ? 1 : 0) : isFeatured(weeklyBoard(sim.opsNow ?? Date.now()), type, biome) ? 1 : 0, // game loop B3: this week's featured mission (x1.25 grade reward)
    U0: Z ? normalHp(Z.L) * Z.tn : 600, // the mission's average fodder HP (structures / pulse / eggs scale off it)
    // per type
    wave: 0, round: 1, rounds: 0, relic: OPS.defense.relicHp, shield: OPS.defense.shield, hurtT: 0, waveT: 0, breakT: 0, choiceT: 0, padT: 0, padK: '', hitT: 0, waveMobs: [],
    dph: 'build', buildT: 0, mat: OPS.defense.mat0, matF: 0, matGot: 0, socks: (A.socks || []).map((q, i) => ({ i, x: q.x, y: q.y, k: '', lv: 0, cd: 0, off: 0, by: 0 })),
    charge: 0, fullT: 0, pulses: 0, pulsesGood: 0, builds: 0, wmods: [], wmod: '', siegeId: 0, relicSum: 0, relicN: 0, relicMin: OPS.defense.relicHp, wavesDone: 0, waveTicks: 0,
    k: 0, shard: A.shardAt ? { x: A.shardAt.x, y: A.shardAt.y, c: 0 } : null, hold: 0, integ: OPS.mobile.integrity, spawnT: 0, mst: 'carry', guard: false,
    seg: 0, gateY: A.gates ? A.gates[0] : null, bossId: 0, adds: 0, segMobs: [],
    tgtId: 0, cap: null,
    tier: 0, mul: 1,
    // swarm
    spawned: 0, waveN: 0, brk: 0, burstT: 0, lives: OPS.swarm.lives, wipes: 0, wiping: false, combo: 0, comboT: 0, best: 0, boostSum: 0, boostN: 0, ctier: 0, cshow: 0,
    safeR: OPS.swarm.safe[0], safeFrom: OPS.swarm.safe[0], safeTo: OPS.swarm.safe[0], shrinkT: 0, outT: 0, queenId: 0, queenT0: 0, surge: false, trickT: 0,
  };
  if (type === 'swarm' && hasMod(O, 'secondwind')) O.lives++;
  if (sim.world) sim.world.opsHoles = []; // (Mobile Defense's collapsed floor: per run)
  O.ctx = { mul: B.mul, hpMul: B.hpMul, tier: B.tier, key: B.roster };
  O.R = SITE_ROSTERS[B.roster];
  O.EL = B.elites;
  hazInit(O);
  emit(sim, 'start', { x: r0(A.start.x), y: r0(A.start.y), mods: O.mods });
  return O;
}
/** place an arriving hero at the arena's start (revived) */
export function enterOps(sim, p, i = 0) {
  const O = sim.ops; if (!O) return;
  if (p.dead) { p.dead = false; p.respawnAt = 0; p.hp = p.stats.maxHp; }
  const s = O.A.start, x = s.x + ((i % 5) - 2) * 34, y = s.y + Math.floor(i / 5) * 34;
  p.x = p.px = x; p.y = p.py = y; p.vx = p.vy = 0; p.iframes = Math.max(p.iframes || 0, 60); p.action = null;
}
/** the respawn spot inside the running mission (next to the objective) */
export function opsSpot(sim) {
  const O = sim.ops; if (!O) return null;
  const A = O.A;
  if (O.type === 'defense') return { x: A.relic.x, y: A.relic.y + 150 };
  if (O.type === 'mobile' || O.type === 'assault') return spot2(O) || { x: A.start.x, y: A.start.y };
  if (O.type === 'capture') return spot3(O, sim) || { x: A.start.x, y: A.start.y };
  if (O.type === 'swarm') return { x: A.cx, y: A.cy + 120 }; // (always inside the shrinking safe ring)
  return { x: A.start.x, y: A.start.y };
}
/** tear the mission down (no rewards): the hub's endEncounters / a quit */
export function endOps(sim) {
  const O = sim.ops; if (!O) return;
  for (const e of O.mobs) if (!e.dead) { e.dead = true; e.hp = 0; e.despawned = true; }
  if (sim.world) sim.world.opsHoles = [];
  sim.ops = null;
}

// ------------------------------------------------------------------ spawning
function ctxNow(O) { const m = O.mul; return { mul: O.ctx.mul * m, hpMul: O.ctx.hpMul, tier: O.ctx.tier, key: O.ctx.key, ramp: m }; } // (ramp: the mission HP escalation on the level curve, sim/mobhp.js)
const coop = (sim) => 1 + 0.3 * (Math.max(1, here(sim).length) - 1);
/** n fodder (+ elites) round (x, y): hunters (aggro the nearest hero) or raiders (walk to home: the objective).
 *  Weekly twists (Iron Hide / Fortified / Frenzy) and the Defense wave modifiers (hpK / spdK / sapper) apply here. */
function pack(sim, O, x, y, n, elites, { raid = 0, home = null, hunt = true, rad = 160, hpK = 1, spdK = 1, sapper = false } = {}) {
  const H = { rng: O.rng };
  const spot = () => { const a = O.rng.next() * TAU, r = rad * Math.sqrt(O.rng.next()), t = { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, r: 16 }; if (opsArenaAt(t.x, t.y)) resolveCircle(sim.world, t); return { x: t.x, y: t.y }; };
  const ms = populate(sim, H, ctxNow(O), O.R, x, y, Math.max(0, Math.round(n)), 0, null, rad, { spot });
  const el = elites + (elites > 0 && hasMod(O, 'fortified') && O.type !== 'capture' ? 1 : 0);
  for (let i = 0; i < el; i++) {
    const at = spot(), type = O.EL[Math.floor(O.rng.next() * O.EL.length)];
    const e = spawnEnemy(sim, type, at.x, at.y, { elite: true, mul: ctxNow(O).mul, hpMul: O.ctx.hpMul, tier: O.ctx.tier, ramp: O.mul });
    ms.push(e);
  }
  const pl = alive(sim), raiders = Math.round(ms.length * raid);
  const hpAll = hpK * (hasMod(O, 'ironhide') ? 1.2 : 1), spd = spdK * (hasMod(O, 'frenzy') ? 1.2 : 1);
  ms.forEach((e, i) => {
    const k = hpAll * (e.elite && hasMod(O, 'fortified') ? 1.3 : 1);
    if (k !== 1) { e.baseMaxHp = Math.round(e.baseMaxHp * k); e.maxHp = e.hp = Math.round(e.maxHp * k); }
    if (spd !== 1) e.spd *= spd;
    e.opsM = 1; e.homeX = home ? home.x : e.x; e.homeY = home ? home.y : e.y;
    const isRaider = i < raiders && e.horde;
    if (isRaider) { e.opsRaid = 1; e.aggroId = 0; e.huntR = 0; if (sapper) e.sapper = 1; }
    else if (hunt) { const t = near(pl, e.x, e.y).p; e.huntR = 1700; if (t) e.aggroId = t.id; }
    else { e.huntR = 0; e.aggroId = 0; }
  });
  O.mobs.push(...ms); O.n0 += ms.length;
  return ms;
}
const liveOf = (l) => l.filter((e) => !e.dead);

// ------------------------------------------------------------------ the tick
export function updateOps(sim) {
  if (sim.predicting) return; // (co-op clients: netgame clamps the predicted hero at the Assault gate from the snapshot)
  const O = sim.ops; if (!O) return;
  O.t++;
  // kills (the live list): each one feeds the run (materials + relic charge, the combo, weekly hooks)
  if (O.mobs.length) {
    const keep = [];
    for (const e of O.mobs) { if (!e.dead) { keep.push(e); continue; } if (!e.despawned) { O.kills++; if (e.elite) O.elites++; if (O.st === 'run') onKill(sim, O, e); } }
    O.mobs = keep;
  }
  if (O.type === 'assault' && O.gateY != null) { for (const p of sim.players.values()) if (inOpsArea(p.x, p.y)) clampGate(p, O.gateY); for (const e of O.mobs) clampGate(e, O.gateY); }
  if (O.st === 'results') { if (++O.endT >= OPS.results) O.leave = true; return; }
  const pl = alive(sim);
  if (O.st === 'intro') { if (O.t >= secs(2.5)) { O.st = 'run'; O.sub = 0; begin(sim, O); } return; }
  // Second Wind (weekly boon): respawn in 2 s
  if (hasMod(O, 'secondwind')) for (const p of sim.players.values()) if (p.dead && inOpsArea(p.x, p.y) && p.respawnAt - sim.tick > secs(2)) p.respawnAt = sim.tick + secs(2);
  // deaths: dungeon-style respawns by the objective (no item loss); the clock / the objective keeps running meanwhile.
  // Swarm: a full party wipe costs one of the party's lives (3); the last one ends it with the waves banked
  if (O.type === 'swarm') {
    const wiped = !pl.length && here(sim).length;
    if (wiped && !O.wiping) { O.wiping = true; O.wipes++; O.lives--; emit(sim, 'wipe', { lives: O.lives, x: r0(O.A.cx), y: r0(O.A.cy) }); if (O.lives <= 0) return void finish(sim, O, 'fail', `The swarm overran the party after ${O.wavesDone} wave${O.wavesDone === 1 ? '' : 's'}`); }
    else if (!wiped) O.wiping = false;
  }
  if (O.type === 'defense') tickDefense(sim, O, pl);
  else if (O.type === 'mobile') tickMobile(sim, O, pl);
  else if (O.type === 'assault') tickAssault(sim, O, pl);
  else if (O.type === 'capture') tickCapture(sim, O, pl);
  else tickSwarm(sim, O, pl);
  if (sim.ops === O && O.st === 'run') tickHazard(sim, O, pl);
}
function begin(sim, O) {
  const A = O.A;
  for (const p of here(sim)) O.d0[p.id] = p.deaths | 0;
  if (O.type === 'defense') { O.wave = 0; O.dph = 'build'; O.buildT = OPS.defense.buildT0; planWaves(O); emit(sim, 'build', { w: 1, t: O.buildT, mat: O.mat, x: A.relic.x, y: A.relic.y }); }
  else if (O.type === 'mobile') beginMobile(sim, O);
  else if (O.type === 'assault') beginAssault(sim, O);
  else if (O.type === 'capture') beginCapture(sim, O);
  else { O.wave = 0; O.brk = secs(2); }
  emit(sim, 'go', { x: r0(A.start.x), y: r0(A.start.y) });
}
/** a kill inside a running mission */
function onKill(sim, O, e) {
  const D = OPS.defense, bounty = hasMod(O, 'bounty') ? 1.3 : 1;
  if (O.type === 'defense') {
    if (e.opsAi !== 'siege') { O.matF += (e.elite ? D.matElite : D.matFod) * bounty; const add = Math.floor(O.matF); if (add) { O.mat += add; O.matGot += add; O.matF -= add; } }
    if (e.elite) emit(sim, 'mat', { x: r0(e.x), y: r0(e.y), n: Math.round(D.matElite * bounty), mat: O.mat });
    const R = O.A.relic, C = D.charge;
    if (O.dph === 'wave' && Math.hypot(e.x - R.x, e.y - R.y) < C.killR) addCharge(sim, O, e.elite ? C.killElite : C.killFod);
  } else if (O.type === 'swarm') comboKill(sim, O, e);
  if (e.pylon) pylonDown(sim, O, e);
  if (O.type === 'capture') capKill(sim, O, e);
  if (e.opsChamp) bonusShower(sim, O, e.x, e.y, CHEST(1.2)); // (the Assault champion: a mini-boss shower)
  if (e.opsBoss) bonusShower(sim, O, e.x, e.y, CHEST(1.5)); // (the siege / the Queen: a boss-sized shower on top of the kill's own)
  if (e.elite && !e.qdecoy && hasMod(O, 'trophy')) { emit(sim, 'trophy', { x: r0(e.x), y: r0(e.y) }); bonusShower(sim, O, e.x, e.y, [{ k: 'gold', p: 1, n: [4, 6], g: 2 }, { k: 'mat', pool: 'common', p: 1, n: [2, 3] }, { k: 'mat', pool: 'rare', p: 0.5 }]); }
  if (hasMod(O, 'volatile') && !e.opsBoss && e.opsAi !== 'egg' && !e.qdecoy && !e.qrig && (e.elite || e.id % 2 === 0)) addArea(sim, { team: 'enemy', ownerId: 0, shape: 'circle', x: r0(e.x), y: r0(e.y), r: e.elite ? 120 : 80, delay: 42, pct: e.elite ? 0.08 : 0.05, kb: 160, kind: 'ovol', by: 'a volatile corpse', committed: true });
}
/** a small extra loot shower for every hero in the mission (combo bonus, Trophy Hunt) */
function bonusShower(sim, O, x, y, table) {
  const fake = { x, y, chest: 0, elite: true, boss: false, horde: 0, zone: OPS_BIOME[O.biome].tier, type: 'chest' };
  for (const p of alive(sim)) showerFor(sim, fake, p, null, { ...showerCtx(sim, fake), noOrbs: false, table });
}

// ---- Defense
const fodU = (O) => O.U0 * O.mul; // the mission's average fodder HP right now (round ramp included)
function planWaves(O) { // waves 2-4 each roll a different modifier; wave 5 is the siege
  const L = OPS.defense.wmods.slice(), out = ['', '', '', '', 'siege'];
  for (let w = 1; w <= 3; w++) { const i = Math.floor(O.rng.next() * L.length); out[w] = L.splice(i, 1)[0]; }
  O.wmods = out;
}
function addCharge(sim, O, v) {
  if (O.charge >= 100) return;
  O.charge = Math.min(100, O.charge + v * (hasMod(O, 'overcharge') ? 1.5 : 1));
  if (O.charge >= 100) { O.fullT = 0; emit(sim, 'charged', { x: O.A.relic.x, y: O.A.relic.y }); }
}
function tickDefense(sim, O, pl) {
  const D = OPS.defense, A = O.A, R = A.relic;
  if (O.st === 'choice') { // round won: Extract or Continue (stand on a pad, or pick on the HUD); nobody picks -> Extract
    O.choiceT--;
    const k = padUnder(O, pl);
    if (k) { if (O.padK !== k) { O.padK = k; O.padT = 0; } if (++O.padT >= D.padT) return void choose(sim, O, k); } else { O.padK = ''; O.padT = 0; }
    if (O.choiceT <= 0) choose(sim, O, 'extract');
    return;
  }
  // the relic: raiders (and anything else) beside it chip it (sappers x2.5); the shield soaks first and comes back after a quiet spell
  let dps = 0;
  for (const e of O.mobs) if (!e.dead && !e.opsBoss && Math.abs(e.x - R.x) < 260 && Math.abs(e.y - R.y) < 260 && Math.hypot(e.x - R.x, e.y - R.y) < R.r + e.r + D.reach) dps += (e.elite ? D.dps.elite : D.dps.fod) * (e.sapper ? 2.5 : 1);
  if (dps > 0) {
    hurtRelic(sim, O, dps * (1 + D.roundMul * (O.round - 1)) * DT);
    if (++O.hitT % 30 === 1) emit(sim, 'relicHit', { x: R.x, y: R.y, hp: Math.ceil(O.relic) });
  } else if (O.hurtT > 0) O.hurtT--;
  else if (O.shield < D.shield) O.shield = Math.min(D.shield, O.shield + D.shieldRegen * DT);
  if (O.relic <= 0) return void finish(sim, O, 'fail', 'The relic was destroyed');
  tickStructures(sim, O);
  // the relic's charge: heroes standing by it (up to 2 count), kills round it (onKill); full -> a hero fires it (or it fires itself)
  if (O.dph === 'wave') {
    const C = D.charge; let nb = 0; for (const p of pl) if (Math.hypot(p.x - R.x, p.y - R.y) < C.near) nb++;
    if (nb) addCharge(sim, O, C.perHero * Math.min(C.maxHeroes, nb));
    if (O.charge >= 100 && ++O.fullT >= C.autoT && O.mobs.some((e) => !e.dead && Math.hypot(e.x - R.x, e.y - R.y) < D.pulse.r)) pulse(sim, O, null);
  }
  if (O.dph === 'build') { // build phase: spend materials at the sockets; ready (a hero at the relic) or the timer starts the next wave
    if (--O.buildT <= 0) spawnWave(sim, O);
    return;
  }
  O.waveT++;
  const left = liveOf(O.waveMobs).length, sg = O.wmod === 'siege' && O.siegeId && O.mobs.some((e) => e.id === O.siegeId && !e.dead);
  if (left === 0 || (O.waveT >= D.waveT && !sg)) waveDone(sim, O); // (the siege wave lasts until the siege falls)
}
function waveDone(sim, O) {
  const D = OPS.defense, R = O.A.relic, clean = O.waveHp0 != null && O.relic >= O.waveHp0 - 0.01;
  O.wavesDone++; O.waveTicks += O.wmod === 'siege' ? O.waveT * D.siegeSpeedK : O.waveT; O.relicSum += O.relic; O.relicN++; // (the siege wave counts at siegeSpeedK for wave speed: its boss is a ~2 min fight by design)
  if (clean) { O.mat += D.matClean; O.matGot += D.matClean; }
  if (O.wave < D.waves) {
    O.dph = 'build'; O.buildT = D.buildT; O.wmod = '';
    emit(sim, 'build', { w: O.wave + 1, t: O.buildT, mat: O.mat, clean: clean ? D.matClean : 0, x: R.x, y: R.y, next: O.wmods[O.wave] || '' });
  } else { // round cleared (wave 5 + the siege down); stragglers crumble
    for (const e of O.mobs) if (!e.dead) { e.dead = true; e.hp = 0; e.despawned = true; }
    for (const q of O.socks) { q.off = 0; q.cd = 20; }
    O.rounds = O.round; O.relic = Math.min(D.relicHp, O.relic + D.regenRound); O.shield = D.shield; O.dph = 'build'; O.wmod = '';
    O.st = 'choice'; O.choiceT = D.choiceT; O.padK = ''; O.padT = 0;
    emit(sim, 'round', { r: O.round, x: R.x, y: R.y });
  }
}
function spawnWave(sim, O) {
  const D = OPS.defense, A = O.A, w = ++O.wave, r = O.round, c = coop(sim), mod = O.wmods[w - 1] || '';
  O.dph = 'wave'; O.waveT = 0; O.wmod = mod; O.waveHp0 = O.relic;
  O.mul = 1 + D.roundMul * (r - 1);
  let n = Math.round(D.fod(w, r) * c * (mod === 'siege' ? 0.6 : 1)), el = D.elites(w, r) + (c > 1.5 && w >= 3 ? 1 : 0) + (mod === 'escort' ? 2 : 0);
  const groups = mod === 'flank' ? 3 : 2, i0 = Math.floor(O.rng.next() * A.spawns.length), pts = [];
  for (let g = 0; g < groups; g++) pts.push(A.spawns[(i0 + Math.round(g * A.spawns.length / groups)) % A.spawns.length]);
  const o = { raid: mod === 'sappers' ? 0.8 : D.raiders, home: A.relic, rad: 150, hpK: mod === 'armored' ? 1.35 : 1, spdK: mod === 'swift' ? 1.25 : 1, sapper: mod === 'sappers' };
  O.waveMobs = [];
  pts.forEach((q, g) => { O.waveMobs.push(...pack(sim, O, q.x, q.y, Math.round(n / groups), Math.floor(el / groups) + (g < el % groups ? 1 : 0), o)); });
  if (mod === 'siege') { const q = A.spawns[(i0 + 4) % A.spawns.length], b = spawnSiege(sim, O, q.x, q.y); O.waveMobs.push(b); }
  O.waveN = O.waveMobs.length;
  emit(sim, 'wave', { w, r, n: O.waveN, mod, x: r0(pts[0].x), y: r0(pts[0].y), x2: r0(pts[1].x), y2: r0(pts[1].y), x3: pts[2] ? r0(pts[2].x) : undefined, y3: pts[2] ? r0(pts[2].y) : undefined });
}
/** the siege boss (sim/opsboss.js runs it): HP = OPS.siege.hpK x the mission's average elite x the round ramp */
function spawnSiege(sim, O, x, y) {
  const S = OPS.siege, [type, name] = OPS_BEASTS[O.biome].siege;
  const e = spawnEnemy(sim, type, x, y, { elite: true, mul: O.ctx.mul, hpMul: O.ctx.hpMul, tier: O.ctx.tier, ramp: O.mul });
  const want = bossHp(e, opsBossHpK('siege', O.biome)) * O.mul * (hasMod(O, 'ironhide') ? 1.2 : 1), k = want / e.baseMaxHp;
  e.baseMaxHp = Math.round(want); e.maxHp = e.hp = Math.round(e.maxHp * k);
  e.dmg *= S.dmg; e.r = S.r; e.mass *= 4; e.spd = S.spd * (hasMod(O, 'frenzy') ? 1.15 : 1); e.name = name; e.opsAi = 'siege'; e.opsBoss = 1; e.opsM = 1;
  e.poise = e.maxPoise = 260; e.dropChance = 1; e.xp = Math.round(e.xp * 4); e.state = 'walk'; e.st = 0; e.cd = secs(3); e.huntR = 0; e.aggroId = 0;
  O.mobs.push(e); O.siegeId = e.id;
  emit(sim, 'siege', { x: r0(x), y: r0(y), name, id: e.id });
  return e;
}
/** relic pulse: blasts + stuns everything round the relic (fodder mostly dies), refills a chunk of its shield */
function pulse(sim, O, p) {
  const P = OPS.defense.pulse, R = O.A.relic, U = fodU(O), pl = alive(sim);
  let n = 0;
  for (const e of O.mobs) {
    if (e.dead) continue; const d = Math.hypot(e.x - R.x, e.y - R.y); if (d > P.r + e.r) continue;
    const dmg = e.opsBoss ? e.maxHp * P.boss : e.elite ? e.maxHp * P.elite + U * P.fod : U * P.fod;
    opsHurt(sim, e, dmg, p || nearestOf(pl, e.x, e.y), { stun: e.opsBoss ? P.bossStun : P.stun, kb: e.opsBoss ? 0 : P.kb, fx: R.x, fy: R.y }); n++;
  }
  O.charge = 0; O.fullT = 0; O.pulses++; if (n >= P.good) O.pulsesGood++;
  O.shield = Math.min(OPS.defense.shield, O.shield + P.shield);
  emit(sim, 'pulse', { x: R.x, y: R.y, r: P.r, n, pid: p ? p.id : 0 });
  return n;
}
/** turrets / spike traps / wards at the sockets (built between waves) */
function tickStructures(sim, O) {
  const B = OPS.defense.build, U = fodU(O), pl = alive(sim);
  for (const s of O.socks) {
    if (!s.k) continue;
    if (s.off > 0) { s.off--; continue; }
    if (s.cd > 0) { s.cd--; continue; }
    const L = s.lv - 1, owner = sim.players.get(s.by) || nearestOf(pl, s.x, s.y);
    if (s.k === 'turret') {
      const T = B.turret, rr = T.range[L]; let best = null, bd = rr * rr;
      for (const e of O.mobs) { if (e.dead || e.opsAi === 'egg') continue; const d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2; if (d < bd) { bd = d; best = e; } }
      if (!best) { s.cd = 6; continue; }
      s.cd = T.cd[L]; s.shots = (s.shots | 0) + 1;
      sim.emit({ type: 'ops', ph: 'tshot', k: 'defense', b: O.biome, x: s.x, y: s.y - 62, x2: r0(best.x), y2: r0(best.y - best.r * 0.6), lv: s.lv, i: s.i });
      opsHurt(sim, best, U * T.dmg[L], owner, { kb: 40, fx: s.x, fy: s.y });
    } else if (s.k === 'spike') {
      const T = B.spike, rr = T.r[L]; let n = 0;
      for (const e of O.mobs) if (!e.dead && e.opsAi !== 'egg' && (e.x - s.x) ** 2 + (e.y - s.y) ** 2 < (rr + e.r * 0.5) ** 2) { opsHurt(sim, e, U * T.dmg[L] * (e.opsBoss ? 0.3 : 1), owner, { slow: T.slow, slowMul: T.slowMul, num: false }); n++; }
      s.cd = T.every; if (n) sim.emit({ type: 'ops', ph: 'spike', k: 'defense', b: O.biome, x: s.x, y: s.y, r: rr, n, i: s.i });
    } else {
      const T = B.ward, rr = T.r[L]; let n = 0;
      for (const e of O.mobs) if (!e.dead && e.opsAi !== 'egg' && (e.x - s.x) ** 2 + (e.y - s.y) ** 2 < (rr + e.r * 0.5) ** 2) { opsHurt(sim, e, U * T.dmg[L] * (e.opsBoss ? 0.3 : 1), owner, { slow: e.opsBoss ? T.slow / 3 : T.slow, slowMul: T.slowMul, num: false }); n++; }
      s.cd = T.every[L]; sim.emit({ type: 'ops', ph: 'ward', k: 'defense', b: O.biome, x: s.x, y: s.y, r: rr, n, i: s.i });
    }
  }
}
/** build / upgrade at socket i (any hero standing at it, between waves; the party's materials) */
function build(sim, O, p, i, kind) {
  const D = OPS.defense, s = O.socks[i | 0]; if (!s || O.st !== 'run' || O.dph !== 'build') return false;
  if (Math.hypot(p.x - s.x, p.y - s.y) > 150) return false;
  if (!s.k) { const T = D.build[kind]; if (!T || O.mat < T.cost) return false; O.mat -= T.cost; s.k = kind; s.lv = 1; }
  else if (s.lv < 2 && (kind === 'up' || kind === s.k)) { const T = D.build[s.k]; if (O.mat < T.up) return false; O.mat -= T.up; s.lv = 2; }
  else return false;
  s.by = p.id; s.cd = 20; s.off = 0; O.builds++;
  emit(sim, 'built', { i: s.i, x: s.x, y: s.y, sk: s.k, lv: s.lv, mat: O.mat, pid: p.id });
  return true;
}
function padUnder(O, pl) {
  const P = O.A.pads; if (!P) return '';
  for (const k in P) { const q = P[k]; for (const p of pl) if (Math.hypot(p.x - q.x, p.y - q.y) < q.r + 6) return k; }
  return '';
}
function choose(sim, O, k) {
  if (O.type === 'defense') {
    if (k === 'cont') { O.round++; O.wave = 0; O.st = 'run'; O.dph = 'build'; O.buildT = OPS.defense.buildT; planWaves(O); emit(sim, 'continue', { r: O.round }); emit(sim, 'build', { w: 1, t: O.buildT, mat: O.mat, x: O.A.relic.x, y: O.A.relic.y, next: '' }); }
    else finish(sim, O, 'extract', `Extracted after ${O.rounds} round${O.rounds === 1 ? '' : 's'}`);
  }
}
/** a hero's mission decision (HUD buttons / keys): 'extract' | 'cont' | 'ready' | 'pulse' | 'build' (+ s: socket, sk: kind) */
export function opsAct(sim, p, act, q = {}) {
  const O = sim.ops; if (!O || !p || !inOpsArea(p.x, p.y)) return false;
  if (O.type === 'defense' && O.st === 'choice' && (act === 'extract' || act === 'cont')) { choose(sim, O, act); return true; }
  if (act === 'reboot') return O.type === 'mobile' && rebootCart(sim, O, p);
  if (act === 'net') return O.type === 'capture' && netThrow(sim, O, p);
  if (O.type !== 'defense' || O.st !== 'run' || p.dead) return false;
  const R = O.A.relic, nearRelic = Math.hypot(p.x - R.x, p.y - R.y) < OPS.defense.charge.actR;
  if (act === 'ready' && O.dph === 'build' && nearRelic) { O.buildT = Math.min(O.buildT, secs(1)); emit(sim, 'ready', { pid: p.id }); return true; }
  if (act === 'pulse' && O.dph === 'wave' && O.charge >= 100 && nearRelic) { pulse(sim, O, p); return true; }
  if (act === 'build') return build(sim, O, p, q.s, q.sk);
  return false;
}

// ---- Assault
/** HP factor for a mission boss: `share` x the mission's average elite on the mob HP level curve (sim/mobhp.js), whatever
 *  its type; off the curve: `share` x its own elite HP */
function bossHp(e, k) { return (e.mlv ? zoneEliteHp(zoneAt(e.x, e.y)) * (e.akHp || 1) : e.baseMaxHp) * k; } // k x the mission's average elite HP (the level curve)
/** mission set-piece AI (sim.js calls it instead of the usual enemy AI) */
export function updateOpsAi(sim, e) {
  if (ops2Ai(sim, e)) return; // (Mobile Defense's boss, the Assault pylons / champion / Gatekeeper: sim/opsboss2.js)
  if (ops3Ai(sim, e)) return; // (the Capture quarry, its decoys, its escape rigs: sim/opsboss3.js)
  if (e.opsAi === 'siege') return siegeAi(sim, e);
  if (e.opsAi === 'queen') return queenAi(sim, e, QH);
  if (e.opsAi === 'egg') return eggAi(sim, e, (egg) => hatch(sim, egg));
  resolveCircle(sim.world, e);
}

// ---- Swarm
/** a spawn point for the swarm: one of the arena's gates, pulled inside the current safe ring */
function swarmSpot(O) {
  const A = O.A, q = A.spawns[Math.floor(O.rng.next() * A.spawns.length)], d = Math.hypot(q.x - A.cx, q.y - A.cy), lim = O.safeR - 110;
  return d <= lim ? q : { x: A.cx + (q.x - A.cx) / d * lim, y: A.cy + (q.y - A.cy) / d * lim };
}
const comboTier = (n) => { const T = OPS.swarm.combo.tiers; let t = 0; while (t < T.length && n >= T[t]) t++; return t; };
export const comboMul = (n) => { const t = comboTier(n); return t ? OPS.swarm.combo.mul[t - 1] : 1; };
function comboKill(sim, O, e) {
  const K = OPS.swarm.combo;
  O.combo++; O.comboT = Math.round(K.window * (hasMod(O, 'overcharge') ? 1.5 : 1));
  if (O.combo > O.best) O.best = O.combo;
  O.boostSum += comboMul(O.combo); O.boostN++;
  const t = comboTier(O.combo);
  if (t > O.ctier) { O.ctier = t; emit(sim, 'combo', { n: O.combo, t, mul: K.mul[t - 1], x: r0(e.x), y: r0(e.y) }); }
  if (t >= K.showerFrom && ++O.cshow >= K.showerEvery) { // from the first tier (x10): every 6th kill a bonus shower bursts out of the kill
    O.cshow = 0;
    bonusShower(sim, O, e.x, e.y, [{ k: 'gold', p: 1, n: [2, 3], g: 0.6 * t }, { k: 'mat', pool: 'common', p: 1, n: [1, t] }, { k: 'mat', pool: 'rare', p: 0.1 * t }]);
  }
}
function setSafe(sim, O, r) {
  if (r === O.safeTo) return;
  O.safeFrom = O.safeR; O.safeTo = r; O.shrinkT = OPS.swarm.shrinkT;
  emit(sim, 'shrink', { r, x: r0(O.A.cx), y: r0(O.A.cy) });
}
function tickSwarm(sim, O, pl) {
  const W = OPS.swarm, A = O.A, c = coop(sim);
  O.sub++;
  // the arena: the safe ring shrinks; outside it the corruption burns (3% max HP / 0.5 s, no defence)
  if (O.shrinkT > 0) { O.shrinkT--; const k = 1 - O.shrinkT / W.shrinkT, ease = k * k * (3 - 2 * k); O.safeR = O.safeFrom + (O.safeTo - O.safeFrom) * ease; }
  if (++O.outT >= W.outEvery) { O.outT = 0; for (const p of pl) if (Math.hypot(p.x - A.cx, p.y - A.cy) > O.safeR + 4) damagePlayer(sim, p, 0, null, { pct: W.outPct, raw: true, by: 'the corruption' }); }
  for (const e of O.mobs) { if (e.dead || e.opsAi) continue; const d = Math.hypot(e.x - A.cx, e.y - A.cy), lim = O.safeR + 60; if (d > lim) { e.x = A.cx + (e.x - A.cx) / d * lim; e.y = A.cy + (e.y - A.cy) / d * lim; } } // (no camping the rim: the horde stays in the ring)
  // the combo window
  if (O.comboT > 0 && --O.comboT === 0) { if (O.combo >= 10) emit(sim, 'comboEnd', { n: O.combo }); O.combo = 0; O.ctier = 0; O.cshow = 0; }
  // the Queen
  if (O.wave > W.waves) {
    const q = O.queenId ? sim.enemyById.get(O.queenId) : null;
    if (!q || q.dead) return void finish(sim, O, 'clear', `${q ? q.name : 'The Swarm Queen'} is slain`);
    if (--O.trickT <= 0) { O.trickT = W.trickle; if (O.mobs.filter((e) => e.horde).length < 10 * c) { const at = swarmSpot(O); pack(sim, O, at.x, at.y, W.trickleN * c, 0, { rad: 110 }); } }
    return;
  }
  if (O.brk > 0) { if (--O.brk === 0) startSwarmWave(sim, O); return; }
  if (O.wave === 0) return;
  const w = O.wave, live = liveOf(O.waveMobs).length;
  if (O.spawned < O.waveN) {
    if (--O.burstT <= 0) {
      O.burstT = W.burstEvery;
      if (live < W.cap(w) * c) {
        const n = Math.min(O.waveN - O.spawned, Math.round(W.burst(w) * c)), first = O.spawned === 0, at = swarmSpot(O);
        const el = first ? W.elites(w) + (c > 1.5 && w >= 4 ? 1 : 0) : 0;
        const ms = pack(sim, O, at.x, at.y, n, el, { rad: 120 }); O.waveMobs.push(...ms); O.spawned += n;
      }
    }
  } else if (live === 0) {
    O.wavesDone = w; O.surge = false;
    emit(sim, 'waveClear', { w, x: r0(A.cx), y: r0(A.cy) });
    O.brk = W.brk;
    if (w === W.waves) { O.wave = W.waves; O.brk = W.brk; O.queenNext = true; }
  }
}
function startSwarmWave(sim, O) {
  const W = OPS.swarm, A = O.A, c = coop(sim);
  if (O.queenNext) { O.queenNext = false; O.wave = W.waves + 1; setSafe(sim, O, W.safe[W.waves + 1]); spawnQueen(sim, O); return; }
  const w = ++O.wave;
  O.mul = 1 + W.mulPerWave * (w - 1);
  O.waveN = Math.round(W.n(w) * c); O.spawned = 0; O.burstT = 0; O.waveMobs = [];
  O.surge = W.surge.includes(w);
  setSafe(sim, O, W.safe[w]);
  emit(sim, 'wave', { w, n: O.waveN, surge: O.surge ? 1 : 0, x: r0(A.cx), y: r0(A.cy) });
}
/** the Swarm Queen (sim/opsboss.js runs her): HP = OPS.queen.hpK x the mission's average elite */
function spawnQueen(sim, O) {
  const Q = OPS.queen, A = O.A, [type, name] = OPS_BEASTS[O.biome].queen, at = A.queenAt || { x: A.cx, y: A.cy - 260 };
  const e = spawnEnemy(sim, type, at.x, at.y, { elite: true, mul: O.ctx.mul, hpMul: O.ctx.hpMul, tier: O.ctx.tier, ramp: O.mul });
  const want = bossHp(e, opsBossHpK('queen', O.biome)) * (hasMod(O, 'ironhide') ? 1.2 : 1), k = want / e.baseMaxHp; // (no wave ramp: her length is set by hpK alone)
  e.baseMaxHp = Math.round(want); e.maxHp = e.hp = Math.round(e.maxHp * k);
  e.dmg *= Q.dmg; e.r = Q.r; e.mass *= 4; e.spd = Q.spd * (hasMod(O, 'frenzy') ? 1.15 : 1); e.name = name; e.opsAi = 'queen'; e.opsBoss = 1; e.opsM = 1;
  e.poise = e.maxPoise = 240; e.dropChance = 1; e.xp = Math.round(e.xp * 5); e.state = 'walk'; e.st = 0; e.cd = secs(2.5); e.since = secs(5); e.sinceS = 0; e.huntR = 0; e.aggroId = 0;
  O.mobs.push(e); O.queenId = e.id; O.queenT0 = O.t; O.trickT = W_TRICK0;
  emit(sim, 'queen', { x: r0(at.x), y: r0(at.y), name, id: e.id });
  return e;
}
const W_TRICK0 = secs(4);
/** the Queen's brood: eggs (break them or they hatch) and broodlings */
const QH = {
  eggs(sim, O, q, n) {
    const Q = OPS.queen, U = fodU(O), [bt] = [OPS_BEASTS[O.biome].brood];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + O.rng.next() * 0.8, r = 150 + O.rng.next() * 160;
      let x = q.x + Math.cos(a) * r, y = q.y + Math.sin(a) * r; const d = Math.hypot(x - O.A.cx, y - O.A.cy), lim = O.safeR - 70; if (d > lim) { x = O.A.cx + (x - O.A.cx) / d * lim; y = O.A.cy + (y - O.A.cy) / d * lim; }
      const e = spawnEnemy(sim, bt, x, y, { mul: O.ctx.mul, hpMul: O.ctx.hpMul, tier: O.ctx.tier, ramp: O.mul, zoneHp: false });
      const hp = Math.round(U * Q.eggHp * (sim.partyHpMul ? sim.partyHpMul(false) : 1));
      e.baseMaxHp = Math.round(U * Q.eggHp); e.maxHp = e.hp = hp; e.dmg = 0; e.spd = 0; e.r = 30; e.mass = 99; e.name = EGG_NAME; e.opsAi = 'egg'; e.opsM = 1; e.hatch = Q.hatch; e.xp = Math.round(e.xp * 0.5); e.huntR = 0; e.aggroId = 0;
      O.mobs.push(e); O.n0++;
    }
  },
  brood(sim, O, x, y, n) { const ms = pack(sim, O, x, y, n, 0, { rad: 90 }); for (const e of ms) e.horde = e.horde || 1; },
};
function hatch(sim, egg) {
  const O = sim.ops; if (!O) return;
  egg.dead = true; egg.hp = 0; egg.despawned = true; // (a hatched egg is no kill)
  const ms = pack(sim, O, egg.x, egg.y, OPS.queen.brood, 0, { rad: 50 });
  for (const e of ms) e.horde = e.horde || 1;
  emit(sim, 'hatch', { x: r0(egg.x), y: r0(egg.y), n: ms.length });
}

// ------------------------------------------------------------------ the end: rewards + results
const CHEST = (k = 1) => [{ k: 'gold', p: 1, n: [6, 9], g: 3 * k }, { k: 'mat', pool: 'common', p: 1, n: [4, 6] }, { k: 'mat', pool: 'rare', p: 1, n: [1, 2] }, { k: 'mat', pool: 'trophy', p: 0.25 }, { k: 'hp', p: 1, n: [2, 2] }, { k: 'res', p: 1, n: [2, 2] }];
/** scale a drop table's counts (grade x weekly bonus x the swarm combo boost) */
export function scaleTable(table, k) {
  if (k === 1) return table;
  return table.map((en) => { const o = { ...en }; if (o.n) o.n = [Math.max(1, Math.round(o.n[0] * k)), Math.max(1, Math.round(o.n[1] * k))]; if (o.k === 'gold') o.g = (o.g ?? 1) * k; else if (!o.n && o.p < 1) o.p = Math.min(1, o.p * k); return o; });
}
/** the grade stats of a run (sim/opsmods.js missionScore) */
export function gradeStats(sim, O, why) {
  const hs = here(sim), n = Math.max(1, hs.length);
  let d = 0; for (const p of hs) d += Math.max(0, (p.deaths | 0) - (O.d0[p.id] ?? (p.deaths | 0)));
  const deaths = Math.round(d / n), secsT = O.t / 60;
  if (O.type === 'defense') return { avgRelic: O.relicN ? O.relicSum / O.relicN : O.relic, deaths, waves: O.wavesDone, avgWaveS: O.wavesDone ? O.waveTicks / O.wavesDone / 60 : 70, pulsesGood: O.pulsesGood, builds: O.builds };
  if (O.type === 'swarm') return { queen: why === 'clear', waves: O.wavesDone, wavesMax: OPS.swarm.waves, deaths, best: O.best, secs: secsT };
  if (O.type === 'mobile' || O.type === 'assault') return gradeStats2(O, why, { deaths, secs: secsT, n });
  if (O.type === 'capture') return gradeStats3(O, why, { deaths, secs: secsT, n });
  const part = why === 'clear' ? 1 : 0.3;
  return { clear: why === 'clear', part, deaths, secs: secsT };
}
/** what one hero gets for a mission (pure given the rng): { items, table, keys, sum }. The table and the extra gear scale
 *  with the grade (S x1.5 +2 gear, A x1.25 +1, B x1, C x0.8) and this week's bonus; Swarm also with its combo boost. */
export function opsRewards(rng, O, p, why) { return withLootLevel(p && p.level, () => opsRewards0(rng, O, p, why)); } // (player-level loot)
function opsRewards0(rng, O, p, why) {
  const B = OPS_BIOME[O.biome], tier = B.tier, items = [], table = [], keys = {}, sum = { sets: 0, relics: 0, exotics: 0, keys: 0, mats: '' };
  const G = O.grade || { g: 'B', mul: 1, gmul: 1 };
  const gear = (n, t = tier) => { for (let i = 0; i < n; i++) items.push(...rollLoot(rng, { tier: Math.min(TIER_MAX, t), cls: p.cls, elite: true, boss: false, dropChance: 1 }).slice(0, 1)); };
  const set = () => { items.push(makeSetItem(rng, p.cls, null, B.set)); sum.sets++; };
  const relic = (ch) => { if (rng.next() < Math.min(1, ch * G.gmul)) { items.push(makeRelic(rng, p.cls, Math.max(3, Math.min(7, tier + 1)))); sum.relics++; } };
  const clear = why === 'clear';
  let k = G.mul;
  if (O.type === 'defense') {
    for (let r = 0; r < O.rounds; r++) { set(); gear(1); table.push(...CHEST(1)); if (r >= 2) relic(0.3); }
    if (!O.rounds && O.wavesDone) { table.push({ k: 'mat', pool: 'common', p: 1, n: [O.wavesDone, O.wavesDone * 2] }, { k: 'gold', p: 1, n: [2, 3], g: O.wavesDone * 0.5 }); }
    sum.mats = O.rounds ? 'chest materials per round' : O.wavesDone ? `${O.wavesDone} wave${O.wavesDone === 1 ? '' : 's'} of materials` : '';
  } else if (O.type === 'mobile') { // upgrade materials per stage (hack points + the final point), the carrier's haul on a clear
    const n = O.earned | 0;
    for (let i = 0; i < n; i++) table.push({ k: 'mat', pool: 'rare', p: 1, n: [4, 5] }, { k: 'mat', pool: 'common', p: 1, n: [4, 5] }, { k: 'gold', p: 1, n: [5, 7], g: 3 });
    if (clear) { table.push({ k: 'mat', pool: 'trophy', p: 1, n: [2, 2] }, { k: 'mat', pool: 'rare', p: 1, n: [6, 6] }, { k: 'gold', p: 1, n: [8, 10], g: 6 }); gear(2); relic(0.2); }
    sum.mats = `upgrade materials ×${n} stage${n === 1 ? '' : 's'}`;
  } else if (O.type === 'assault') { // keys (+ the rooms you got through), gear a tier up on a clear
    const rooms = Math.min(3, O.seg | 0);
    for (let i = 0; i < rooms; i++) table.push({ k: 'mat', pool: 'common', p: 1, n: [3, 4] }, { k: 'gold', p: 1, n: [3, 4], g: 2 });
    if (clear) { keys[B.key] = 1 + (rng.next() < 0.15 * G.gmul ? 1 : 0); sum.keys = keys[B.key]; gear(2, tier + 1); relic(0.2); table.push(...CHEST(2)); }
    sum.mats = rooms ? `${rooms} room${rooms === 1 ? '' : 's'} of spoils` : '';
  } else if (O.type === 'capture') { // clues + rigs on any run; the bounty, a set piece, a relic chance, gear a tier up on a capture
    sum.mats = capRewards(O, table, clear);
    if (clear) {
      set(); relic(0.5); gear(1, tier + 1); table.push(...CHEST(2));
      const ex = { frost: 'rimebound', ember: 'cinderbound' }[O.biome] || 'starbound', ch = O.biome === 'frost' || O.biome === 'ember' || O.biome === 'rift' ? 0.06 : 0.03;
      if (rng.next() < ch) { const it = makeExotic(rng, ex, p.cls); if (it) { items.push(it); sum.exotics++; } }
    }
  } else { // swarm: biome materials per wave cleared (gear every 2nd), the Queen's hoard on a clear; x the combo boost
    const w = O.wavesDone | 0;
    for (let i = 1; i <= w; i++) { table.push({ k: 'mat', pool: 'common', p: 1, n: [4, 5] }, { k: 'gold', p: 1, n: [2, 3], g: 1.5 }); if (i % 2 === 0) { table.push({ k: 'mat', pool: 'rare', p: 1, n: [2, 2] }); gear(1); } }
    if (clear) { set(); gear(1, tier + 1); relic(0.35); table.push(...CHEST(2), { k: 'mat', pool: 'trophy', p: 1, n: [2, 2] }); }
    const boost = O.boostN ? O.boostSum / O.boostN : 1; k *= boost; sum.boost = Math.round(boost * 100) / 100;
    sum.mats = w ? `${w} wave${w === 1 ? '' : 's'} of biome materials${boost > 1.01 ? ` ×${sum.boost} combo` : ''}` : '';
  }
  if (items.length || table.length) gear(G.g === 'S' ? 2 : G.g === 'A' ? 1 : 0);
  sum.grade = G.g; sum.mul = Math.round(k * 100) / 100;
  return { items, table: scaleTable(table, k), keys, sum };
}
function finish(sim, O, why, msg) {
  if (O.st === 'results') return;
  O.st = 'results'; O.endT = 0; O.result = why; O.msg = msg || '';
  for (const e of O.mobs) if (e.dead && !e.despawned) { O.kills++; if (e.elite) O.elites++; }
  O.mobs = O.mobs.filter((e) => !e.dead);
  for (const e of O.mobs) if (!e.dead) { if (!e.despawned) e.fled = 1; e.dead = true; e.hp = 0; e.despawned = true; }
  O.mobs = [];
  for (const pr of sim.projectiles) if (pr.team === 'enemy' && inOpsArea(pr.x, pr.y)) pr.dead = true;
  for (const a of sim.areas) if (a.team === 'enemy' && inOpsArea(a.x, a.y)) a.dead = true;
  O.combo = 0; O.comboT = 0; O.surge = false; for (const q of O.socks) q.off = 0;
  const failed = why === 'fail' || why === 'escape';
  O.grade = gradeRecord(O.type, gradeStats(sim, O, why), failed, O.mods);
  if (O.feat) { O.grade.feat = 1; O.grade.mul = Math.round(O.grade.mul * WK.featMul * 100) / 100; } // (game loop B3: the Weekly Board's featured mission)
  const keys = {}, sums = {};
  for (const p of here(sim)) {
    if (p.dead) { p.dead = false; p.respawnAt = 0; p.hp = p.stats.maxHp; p.canChoose = 0; }
    const R = opsRewards(O.rng, O, p, why);
    const fake = { x: p.x, y: p.y - 30, chest: 1, elite: true, boss: false, horde: 0, zone: OPS_BIOME[O.biome].tier, type: 'chest' };
    let bag = null;
    if (R.items.length) { bag = { id: sim.id(), x: fake.x, y: fake.y, items: R.items, ownerId: p.id, life: secs(120), rarity: Math.max(...R.items.map((i) => i.rarity | 0)) }; sim.bags.push(bag); }
    if (R.table.length || bag) showerFor(sim, fake, p, bag, { ...showerCtx(sim, fake), noOrbs: false, table: R.table.length ? R.table : [] });
    if (bag) sim.emit({ type: 'loot', x: bag.x, y: bag.y, rarity: bag.rarity, pid: p.id, id: bag.id, vac: 1 });
    if (Object.keys(R.keys).length) keys[p.id] = R.keys;
    sums[p.id] = { ...R.sum, items: R.items.length };
  }
  emit(sim, 'end', { why, msg: O.msg, id: O.mid, k: O.type, b: O.biome, kills: O.kills, elites: O.elites, t: r0(O.t / 60), rounds: O.rounds, term: O.earned | 0, waves: O.wavesDone, best: O.best, keys, sums, gr: packGrade(O), x: r0(O.A.start.x), y: r0(O.A.start.y) });
}
const packGrade = (O) => (O.grade ? { g: O.grade.g, s: O.grade.score, m: O.grade.mul, gm: O.grade.gmul, bn: O.grade.bonus, c: O.grade.col, l: O.grade.lines } : null);

// ------------------------------------------------------------------ co-op view
/** compact mission state (snapshot 'op'; solo clients pack the live sim once per tick) */
export function packOps(sim) {
  const O = sim.ops; if (!O) return null;
  const v = { b: O.biome, k: O.type, st: O.st, t: O.t, kl: O.kills, msg: O.msg, res: O.result || '', endT: O.endT, mods: O.mods };
  if (O.hz) Object.assign(v, { hs: O.hz.storm > 0 ? 1 : 0, hst: O.hz.storm });
  if (O.grade && O.st === 'results') v.gr = packGrade(O);
  if (O.type === 'defense') Object.assign(v, {
    w: O.wave, nw: OPS.defense.waves, r: O.round, rd: O.rounds, hp: Math.ceil(O.relic), sh: Math.ceil(O.shield), ch: O.st === 'choice' ? O.choiceT : 0, pad: O.padK, pt: O.padT,
    left: liveOf(O.waveMobs).length, wn: O.waveN || 0, ph: O.dph, bt: O.dph === 'build' ? O.buildT : 0, mat: O.mat, chg: Math.floor(O.charge), wm: O.wmod, wms: O.wmods, wt: O.waveT,
    so: O.socks.map((q) => [q.k ? q.k[0] : '', q.lv, q.off > 0 ? 1 : 0]), sg: O.siegeId, pu: O.pulses,
  });
  else if (O.type === 'mobile' || O.type === 'assault') packOps2(sim, O, v);
  else if (O.type === 'capture') packOps3(sim, O, v);
  else {
    const q = O.queenId ? sim.enemyById.get(O.queenId) : null;
    Object.assign(v, {
      sub: O.sub, w: O.wave, nw: OPS.swarm.waves, live: O.mobs.length, left: Math.max(0, (O.waveN - O.spawned)) + liveOf(O.waveMobs).length, wn: O.waveN, brk: O.brk,
      cb: O.combo, cbt: O.comboT, best: O.best, sr: Math.round(O.safeR), srt: O.safeTo, shk: O.shrinkT, lv: O.lives, su: O.surge ? 1 : 0,
      qhp: q && !q.dead ? q.hp / q.maxHp : 0, qn: q ? q.name : '', qid: O.queenId,
    });
  }
  return v;
}

// part 2's runtime (sim/opsrun2.js) borrows the shared helpers
bindOps2({ pack, alive, emit, near, coop, bossHp, bonusShower, finish, CHEST, liveOf });
bindOps3({ pack, alive, emit, near, coop, bossHp, bonusShower, finish, CHEST, liveOf });
