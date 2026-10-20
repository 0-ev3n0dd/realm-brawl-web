// Enemy creation + behaviours. Every attack is telegraphed (wind-up state and/or a visual area)
// so patterns are readable. Pure sim code.
import { tickStacks } from './kit.js';
import { ENEMIES } from './data/enemies.js';
import { dmgK, xpK, hpK, scaleBoss, BOSS_LV } from './levelscale.js';
import { DT, zoneAt, BOSS_POS, BOSS_ARENA_R, secs } from './constants.js';
import { resolveCircle } from './world.js';
import { spawnProjectile, addArea, damagePlayer, cancelAreasOf, decoysOf, evadeShove, slamBeats } from './combat.js';
import { SHADOW } from './player.js';
import { dist2, angDiff } from './math.js';
import { oasisPush } from './dunesconst.js';
import { campPush } from './frostconst.js';
import { FROST_AI } from './frostai.js';
import { outpostPush } from './emberconst.js';
import { campPush as riftCampPush } from './riftconst.js';
import { EMBER_AI } from './emberai.js';
import { DUNES_AI } from './dunesai.js';
import { WBOSS_AI } from './worldboss.js';
import { zoneLv, mobHp } from './mobhp.js';
import { smartInit, smartTarget, smartTick } from './mobsmart.js'; // (Part A3: smarter mobs)
import { affixInit, affixTick } from './affixes.js'; // (Part A3: elite affixes)
/** Spore Cap (shroom) volleys: camps vs horde units (horde pass 3: a horde can field several at once) */
export const SPORE = { n: 10, rings: 2, cd: 100 }, SPORE_HORDE = { n: 6, rings: 1, cd: 170 };
/** open-world + missions + dungeons: normal / elite enemies hit harder and press more (2026-10-06). Bosses keep their own tuning (TTK unchanged). */
export const THREAT = {
  dmg: 1.45,       // trash damage (~+45%; mobhp3: 1.32 -> 1.45, normals live ~2x longer and now threaten while they do)
  eliteDmg: 1.72,  // was 1.3 (~+32% over old elite, ~+72% over trash base)
  spd: 1.14,       // trash move speed
  eliteSpd: 1.1,
  aggro: 1.2,      // engagement / hunt range
  atkRate: 1.2,    // CD ticks this fast (more attacks)
  eliteAtk: 1.28,
  contactCd: 30,   // was 40: contact hits more often
};

import { ASTRAL, astralZone, astralBoss } from './astral.js';
import { abOk, abInit } from './astralboss.js'; // (Part C2)
export function spawnEnemy(sim, type, x, y, opts = {}) {
  const d = ENEMIES[type];
  const elite = !!opts.elite;
  const boss = !!d.boss || !!d.raid;
  // normals + elites: HP from the level curve of the zone they spawn in (sim/mobhp.js: the one source of truth, mission
  // ramp included); bosses, the dummy, boss summons / mechanic adds (opts.zoneHp === false) and level-less spots keep
  // the old type HP x elite x3 x opts.mul x opts.hpMul
  const zl0 = boss || d.dummy || opts.zoneHp === false ? null : zoneLv(zoneAt(x, y)), zl = sim.astral && zl0 ? astralZone(zl0) : zl0; // (Part C: Astral mode moves the zone to its Astral level)
  const lvHp = zl ? mobHp(type, zl, { elite, role: opts.fodder ? 'fodder' : opts.wave ? 'wave' : 'normal', ramp: opts.ramp || 1 }) : null;
  const hpMul = (elite ? 3 : 1) * (opts.mul || 1) * (opts.hpMul || 1);
  // bosses keep 1× dmg; trash / elites get THREAT (opts.mul: Danger ring / dungeon scaling, still applies)
  const dmgMul = (boss ? 1 : elite ? THREAT.eliteDmg : THREAT.dmg) * (opts.mul ? 1 + (opts.mul - 1) * 0.6 : 1);
  const baseHp = lvHp ?? Math.round(d.hp * hpMul);
  const partyMul = sim.partyHpMul ? sim.partyHpMul(!!d.boss) : 1; // co-op scaling (1 when solo)
  const e = {
    id: sim.id(), kind: 'enemy', type, name: (elite ? 'Elite ' : '') + d.name, boss: !!d.boss, elite,
    x, y, px: x, py: y, vx: 0, vy: 0, r: Math.round(d.r * (elite ? 1.25 : 1)),
    hp: Math.round(baseHp * partyMul), maxHp: Math.round(baseHp * partyMul), baseMaxHp: baseHp, dmgBy: {}, dmg: d.dmg * dmgMul,
    spd: d.spd * (boss ? 1 : elite ? THREAT.eliteSpd : THREAT.spd), mass: d.mass * (elite ? 1.5 : 1),
    atkRate: boss ? 1 : elite ? THREAT.eliteAtk : THREAT.atkRate,
    defense: d.def, xp: Math.round(d.xp * (elite ? 3 : 1)), zone: d.zone, ai: d.ai, contact: !!d.contact,
    spawnerId: opts.spawnerId || 0, homeX: x, homeY: y,
    state: 'idle', st: 0, cd: 30 + Math.floor(sim.rng.next() * 60), cd2: 60, face: sim.rng.next() * Math.PI * 2, rot: 0, count: 0,
    cc: { stun: 0, down: 0, frozen: false, rooted: false, slow: 0, slowMul: 1 },
    hitstop: 0, flash: 0, invuln: 0, contactCd: 0, aggroId: 0, dead: false, lock: 0, wanderT: 0, wanderA: 0,
    phase: 1, poise: 100, maxPoise: 100, attackIdx: 0, dropChance: 0.32, sunder: null,
  };
  if (zl) e.mlv = zl.L; // (on the level curve: its mob level)
  const zd0 = zl || (boss || d.dummy ? null : zoneLv(zoneAt(x, y))), zd = sim.astral && zd0 && !zd0.astral ? astralZone(zd0) : zd0; // (game loop C1: a re-banded zone keeps its tuned feel: damage + XP, boss mechanic adds too)
  if (zd && zd.was !== zd.L) { e.dmg *= dmgK(zd.L, zd.was); e.xp = Math.round(e.xp * xpK(zd.L, zd.was)); }
  if (boss) scaleBoss(e, type); // (game loop C1: bosses of a re-banded map, sim/levelscale.js BOSS_LV)
  if (sim.astral) { // Part C: the Astral layer
    if (boss) { const z0 = zoneLv(zoneAt(x, y)), r = BOSS_LV[type]; astralBoss(e, e.blv || (z0 && z0.L) || 12, r ? r[1] : undefined); if (abOk(e, d) && !opts.noAb) abInit(sim, e); } // (C2: + the Astral mechanic layer, sim/astralboss.js)
    else if (zd && zd.astral) { const z0 = zd0 && !zd0.astral ? zd0 : zl0; e.astral = 1; e.dmg *= ASTRAL.hard.dmg; if (z0) { e.akHp = hpK(zd.L, z0.L); e.akD = dmgK(zd.L, zd.was) / dmgK(z0.L, z0.was) * ASTRAL.hard.dmg; } }
    if (opts.zoneHp === false && !boss && !d.dummy) { const z0 = zoneLv(zoneAt(x, y)); if (z0) { const L = astralZone(z0).L, k = hpK(L, z0.L); e.maxHp = Math.round(e.maxHp * k); e.hp = Math.round(e.hp * k); e.baseMaxHp = Math.round((e.baseMaxHp || e.maxHp) * k); e.astral = 1; } } // (boss mechanic adds keep pace; their damage already follows the Astral zone above)
  }
  if (d.dunes) e.dz = 1;
  if (d.ember) e.ez = 1; // (Emberdeep / the Forge of Cinders: sim/ember.js)
  if (d.rift) e.rz = 1; // (the Astral Rift, game loop C3: sim/rift.js)
  if (d.frost) e.fz = 1; // (Frostveil / the Glacier Crypt: sim/frost.js)
  if (d.dummy) { e.dummy = 1; e.dropChance = 0; e.lastHp = e.hp; e.quiet = 0; }
  if (d.arena) { e.arena = d.arena; e.homeX = d.arena.x; e.homeY = d.arena.y; }
  if (opts.tier) e.zone = opts.tier; // loot tier of the ring it spawned in
  if (e.boss) { e.poise = e.maxPoise = 160; }
  if (d.raid) { e.raid = true; e.poise = e.maxPoise = 400; }
  if (sim.smartMobs !== false) { smartInit(e, d); affixInit(e); }
  sim.enemies.push(e);
  sim.enemyById.set(e.id, e);
  return e;
}

const setState = (e, s) => { e.state = s; e.st = 0; };
const angTo = (e, t) => Math.atan2(t.y - e.y, t.x - e.x);
const dTo = (e, t) => Math.hypot(t.x - e.x, t.y - e.y);
function move(e, ang, mul = 1) {
  const sp = e.spd * mul * (e.cc.slow > 0 ? e.cc.slowMul : 1);
  e.x += Math.cos(ang) * sp * DT; e.y += Math.sin(ang) * sp * DT;
}
function shoot(sim, e, ang, speed, o = {}) {
  return spawnProjectile(sim, {
    team: 'enemy', ownerId: e.id, x: e.x + Math.cos(ang) * (e.r * 0.8), y: e.y + Math.sin(ang) * (e.r * 0.8),
    vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: o.r || 8, life: o.life || 150,
    dmg: e.dmg * (o.mul ?? 1), homing: o.homing || 0, accel: o.accel || 0, style: o.style || 'orb', color: o.color || null, kb: o.kb || 70, by: e.name,
  });
}
function area(sim, e, spec) {
  return addArea(sim, { team: 'enemy', ownerId: e.id, dmg: e.dmg * (spec.mul ?? 1), by: e.name, ...spec });
}
function ring(sim, e, n, speed, off, o) { for (let i = 0; i < n; i++) shoot(sim, e, off + (i / n) * Math.PI * 2, speed, o); }
function contact(sim, e, t, mul = 1, kb = 180, stun = 0) {
  if (e.contactCd > 0 || !t) return false;
  const rr = e.r + t.r;
  if (dist2(e.x, e.y, t.x, t.y) > rr * rr) return false;
  e.contactCd = (e.boss || e.raid) ? 40 : THREAT.contactCd;
  return damagePlayer(sim, t, e.dmg * mul, e, { kb, stun, by: e.name });
}
/** keep at a preferred distance band, strafing */
function kite(sim, e, t, near, far, mul = 1) {
  const d = dTo(e, t), a = angTo(e, t);
  if (d < near) move(e, a + Math.PI, mul);
  else if (d > far) move(e, a, mul);
  else { if (e.st % 100 === 0) e.wanderA = sim.rng.next() < 0.5 ? 1 : -1; move(e, a + (Math.PI / 2) * (e.wanderA || 1), mul * 0.6); }
}

function findTarget(sim, e) {
  if (e.leashT > 0) return null; // a spawn-site member walking home (sim/sites.js leash)
  let aggroR = e.huntR || (e.boss || e.tombWave ? (e.tombWave ? 1000 : 780) : e.aggroId ? 620 : 400); // (huntR: an aggroed spawn site hunts as a group) // (Tomb wave enemies hunt the whole chamber)
  if (!(e.boss || e.raid)) aggroR *= THREAT.aggro;
  let best = null, bd = aggroR * aggroR;
  // a Shadow Step decoy nearby takes priority over every player
  if (sim.areas.length) { let dd = SHADOW.decoyAggroR * SHADOW.decoyAggroR, dec = null; for (const d of decoysOf(sim)) { const q = dist2(d.x, d.y, e.x, e.y); if (q < dd) { dd = q; dec = d; } } if (dec) return dec; }
  if (e.taunt && e.taunt.t > 0) { const q = sim.players.get(e.taunt.pid); if (q && !q.dead && dist2(q.x, q.y, e.x, e.y) < 900 * 900) return q; } // Warrior War Cry / Challenge taunt
  for (const p of sim.players.values()) {
    if (p.dead || p.stealth > 0 || zoneAt(p.x, p.y).id === 0) continue; // stealthed (Vanish) players are invisible to enemies
    const d = dist2(p.x, p.y, e.x, e.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

import { riftSkill } from './riftai.js';
import { tickDummy } from './dummy.js';
export function updateEnemy(sim, e) {
  if (e.dead) return;
  if (e.flash > 0) e.flash--;
  if (e.dummy) { // the Training Dummy: no AI, no knockback; back to full HP after 3 s without a hit
    tickDummy(sim, e); // (Training Dummy settings: movement + telegraphs, sim/dummy.js)
    if (e.sunder && --e.sunder.t <= 0) e.sunder = null; if (e.mark && --e.mark.t <= 0) e.mark = null; if (e.stx) tickStacks(e);
    if (e.hitstop > 0) e.hitstop--; e.vx = e.vy = 0; e.x = e.homeX; e.y = e.homeY; e.cc.stun = e.cc.down = 0; e.cc.frozen = e.cc.rooted = false;
    if (e.hp !== e.lastHp) { e.lastHp = e.hp; e.quiet = 0; } else if (++e.quiet > 180 && e.hp < e.maxHp && e.infHp !== false) { e.hp = e.lastHp = e.maxHp; e.quiet = 0; }
    return;
  }
  if (e.sunder && --e.sunder.t <= 0) e.sunder = null; // Warrior Sunder expires
  if (e.taunt && --e.taunt.t <= 0) e.taunt = null; // Warrior taunt expires
  if (e.mark && --e.mark.t <= 0) e.mark = null; // Blade Dancer Marks (Marked for Death) expire
  if (e.stx) tickStacks(e); // Quarry / Burn / Condemn stacks expire
  if (e.hitstop > 0) { e.hitstop--; return; }
  if (e.invuln > 0) e.invuln--;
  if (e.contactCd > 0) e.contactCd--;
  if (e.vx || e.vy) {
    e.x += e.vx * DT; e.y += e.vy * DT;
    e.vx *= 0.85; e.vy *= 0.85;
    if (Math.abs(e.vx) < 2 && Math.abs(e.vy) < 2) e.vx = e.vy = 0;
  }
  if (e.cc.slow > 0) e.cc.slow--;
  if (e.cc.down > 0) { e.cc.down--; collide(sim, e); return; }
  if (e.cc.stun > 0) { if (--e.cc.stun === 0) { e.cc.frozen = false; e.cc.rooted = false; } collide(sim, e); return; }

  let t = findTarget(sim, e);
  if (e.sm) t = smartTarget(sim, e, t);
  e.st++;
  const rate = e.atkRate || 1;
  if (e.cd > 0) e.cd = Math.max(0, e.cd - rate);
  if (e.cd2 > 0) e.cd2 = Math.max(0, e.cd2 - rate);
  if (!t) {
    e.aggroId = 0;
    if (lostToStealth(sim, e)) { // lost a Vanished player: stand confused instead of walking home (a boss must not reset)
      if (['wind', 'lunge', 'charge', 'dash', 'recover', 'cast', 'slamwind'].includes(e.state)) setState(e, 'idle');
      e.cd = Math.max(e.cd, 20);
    } else idle(sim, e);
  } else {
    if (e.state !== 'charge' && e.state !== 'lunge' && e.state !== 'dash') e.face = angTo(e, t);
    (BEHAVIOURS[e.ai] || DUNES_AI[e.ai] || FROST_AI[e.ai] || EMBER_AI[e.ai] || WBOSS_AI[e.ai])(sim, e, t);
    if (e.sm && !e.dead) { smartTick(sim, e, t); if (e.af) affixTick(sim, e, t); }
    if (!e.boss && !e.opsBoss && !e.dead) riftSkill(sim, e, t); /* (the Astral Rift's own mob skills: sim/riftai.js; no-op for other types) */ // (Sunscorch behaviours live in sim/dunesai.js, looked up at run time)
  }
  collide(sim, e);
}

export const AIH = { setState, angTo, dTo, move, shoot, area, ring, contact, kite, findTarget: (sim, e) => findTarget(sim, e) };

function lostToStealth(sim, e) {
  const r = e.boss ? 780 : 620;
  for (const p of sim.players.values()) if (!p.dead && p.stealth > 0 && dist2(p.x, p.y, e.x, e.y) < r * r) return true;
  return false;
}

function idle(sim, e) {
  if (e.raid) return; // the raid boss never walks home (sim/raid.js resets the encounter)
  if (e.boss) { bossReset(sim, e); return; }
  if (['wind', 'lunge', 'charge', 'dash', 'recover', 'cast', 'slamwind', 'fade', 'under', 'erupt', 'roll', 'mirror', 'lash', 'ray', 'slide', 'throw', 'swing', 'guard'].includes(e.state)) { setState(e, 'idle'); e.untargetable = 0; }
  const dh = Math.hypot(e.homeX - e.x, e.homeY - e.y);
  if (dh > 160) { e.face = Math.atan2(e.homeY - e.y, e.homeX - e.x); move(e, e.face, 0.8); if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.004); return; }
  if (e.spd <= 0) return;
  if (--e.wanderT <= 0) { e.wanderT = 60 + Math.floor(sim.rng.next() * 120); e.wanderA = sim.rng.next() < 0.45 ? null : sim.rng.next() * Math.PI * 2; }
  if (e.wanderA != null) { e.face = e.wanderA; move(e, e.wanderA, 0.35); }
}

function collide(sim, e) {
  const hit = resolveCircle(sim.world, e);
  // keep ordinary enemies out of the safe haven
  const d = Math.hypot(e.x, e.y);
  if (!e.boss && d < 300 + e.r) { const k = (300 + e.r) / (d || 1); e.x *= k; e.y *= k; }
  if (e.arena) { // a boss with its own arena (Khepra, the Dunes Overlord)
    const A = e.arena, dx = e.x - A.x, dy = e.y - A.y, dd = Math.hypot(dx, dy);
    if (dd > A.r - e.r) { const k = (A.r - e.r) / dd; e.x = A.x + dx * k; e.y = A.y + dy * k; return true; }
    return hit;
  }
  if (e.dz && !e.boss) oasisPush(e); // keep Dunes enemies out of the oasis
  if (e.ez && !e.boss) outpostPush(e); // keep Emberdeep enemies out of Cinderwatch Outpost
  if (e.fz && !e.boss) campPush(e); // keep Frostveil enemies out of Hearthstone Camp
  if (e.rz && !e.boss) riftCampPush(e); // keep Astral Rift enemies out of Starfall Camp
  if (e.boss && !e.raid) {
    const dx = e.x - BOSS_POS.x, dy = e.y - BOSS_POS.y, dd = Math.hypot(dx, dy);
    if (dd > BOSS_ARENA_R - e.r) { const k = (BOSS_ARENA_R - e.r) / dd; e.x = BOSS_POS.x + dx * k; e.y = BOSS_POS.y + dy * k; return true; }
  }
  return hit;
}

/** Behaviour table (sim/dunes.js and sim/tomb.js add theirs) + the small helpers they share. */
export const BEHAVIOURS = {
  inert() {}, // (no AI at all: set-piece cores, sim/setpiece.js)
  /** (Part A4) an Astral Fissure core: never moves; every 4 s a red ring (1 s tell) pulses round it. Takes full damage. */
  shadow() { /* the Shadow Duel's mirror: driven by sim/shadowduel.js updateDuel */ },
  fcore(sim, e) { e.vx = e.vy = 0; e.x = e.homeX; e.y = e.homeY; if (e.st % 240 === 120) area(sim, e, { kind: 'corepulse', cue: 'away', shape: 'donut', x: e.x, y: e.y, r0: 70, r: 210, delay: 60, mul: 0.6 }); },
  /** Vorthax (raid boss): the fight itself runs in sim/raid.js on a fixed timeline; here it only drifts toward its target
   *  (keeping ~170 px) unless a mechanic pins it (e.raidHold: Rift Lance dash, the Ward channel, the stun). */
  raid(sim, e, t) {
    if (e.raidHold > 0) return;
    const d = dTo(e, t);
    if (d > 190) move(e, angTo(e, t), 1); else if (d < 130) move(e, angTo(e, t) + Math.PI, 0.6);
  },
  hopper(sim, e, t) {
    contact(sim, e, t, 1, 200);
    if (e.state === 'wind') {
      if (e.st >= 16) {
        const a = angTo(e, t) + (sim.rng.next() - 0.5) * 0.4;
        e.vx += Math.cos(a) * 330; e.vy += Math.sin(a) * 330;
        setState(e, 'idle'); e.cd = 40 + Math.floor(sim.rng.next() * 25);
      }
    } else if (e.cd <= 0) setState(e, 'wind');
  },
  rusher(sim, e, t) {
    const d = dTo(e, t);
    switch (e.state) {
      case 'wind':
        if (e.st >= 26) { setState(e, 'lunge'); e.hitDone = false; }
        break;
      case 'lunge':
        move(e, e.lock, 4.2);
        if (!e.hitDone && contact(sim, e, t, 1.2, 260)) e.hitDone = true;
        if (e.st >= 13) { setState(e, 'recover'); }
        break;
      case 'recover':
        if (e.st >= 32) { setState(e, 'idle'); e.cd = 50; }
        break;
      default:
        if (d < 120 && e.cd <= 0) {
          e.lock = angTo(e, t); setState(e, 'wind');
          area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.lock, len: 150, w: 30, delay: 26, visual: true, kind: 'lunge' });
        } else move(e, angTo(e, t), d < 60 ? 0 : 1);
    }
  },
  turret(sim, e, t) {
    if (dTo(e, t) > 500) return;
    if (e.state === 'wind') {
      if (e.st >= 20) {
        const a = angTo(e, t);
        for (let i = -1; i <= 1; i++) shoot(sim, e, a + i * 0.28, 235, { r: 8, style: 'seed' });
        setState(e, 'idle'); e.cd = 85 + Math.floor(sim.rng.next() * 20);
      }
    } else if (e.cd <= 0) setState(e, 'wind');
  },
  charger(sim, e, t) {
    const d = dTo(e, t);
    switch (e.state) {
      case 'wind':
        if (e.st >= 48) { setState(e, 'charge'); e.hitDone = false; }
        break;
      case 'charge': {
        e.face = e.lock;
        move(e, e.lock, 7);
        if (!e.hitDone && contact(sim, e, t, 1.5, 480, 18)) e.hitDone = true;
        const blocked = resolveCircle(sim.world, e);
        if (blocked && e.st > 4) { setState(e, 'dazed'); sim.emit({ type: 'cc', kind: 'dazed', x: e.x, y: e.y - e.r, id: e.id }); e.cc.stun = 70; }
        else if (e.st >= 44) setState(e, 'recover');
        break;
      }
      case 'dazed': case 'recover':
        if (e.st >= 45) { setState(e, 'idle'); e.cd = 110; }
        break;
      default:
        if (d < 440 && d > 90 && e.cd <= 0) {
          e.lock = angTo(e, t); setState(e, 'wind');
          area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.lock, len: 7 * e.spd * 44 / 60 + 30, w: e.r * 2 + 12, delay: 48, visual: true, kind: 'charge' });
        } else move(e, angTo(e, t), 0.8);
        contact(sim, e, t, 0.6, 150);
    }
  },
  archer(sim, e, t) {
    kite(sim, e, t, 220, 340, e.state === 'cast' ? 0.3 : 1);
    if (e.state === 'cast') {
      if (e.st === 1 || e.st === 10 || e.st === 19) shoot(sim, e, angTo(e, t), 310, { r: 7, style: 'bone' });
      if (e.st >= 22) { setState(e, 'idle'); e.cd = 95 + Math.floor(sim.rng.next() * 30); }
    } else if (e.state === 'wind') {
      if (e.st >= 18) setState(e, 'cast');
    } else if (e.cd <= 0 && dTo(e, t) < 460) setState(e, 'wind');
  },
  spinner(sim, e, t) { // Spore Cap
    if (dTo(e, t) > 240) move(e, angTo(e, t), 1);
    const hz = !!(e.horde || e.hordeLead), S = hz ? SPORE_HORDE : SPORE; // (horde Spore Caps: one thin ring, slower - a crowd of them no longer floods the screen pink)
    if (e.state === 'wind') {
      if (e.st === 22) { ring(sim, e, S.n, 170, e.rot, { r: 9, style: 'spore' }); }
      if (e.st === 34 && S.rings > 1) { ring(sim, e, S.n, 170, e.rot + Math.PI / 10, { r: 9, style: 'spore' }); }
      if (e.st >= 36) { e.rot += 0.35; setState(e, 'idle'); e.cd = S.cd; }
    } else if (e.cd <= 0 && dTo(e, t) < 420) setState(e, 'wind');
  },
  slammer(sim, e, t) {
    const d = dTo(e, t);
    switch (e.state) {
      case 'slamwind':
        if (e.st >= 56) { setState(e, 'recover'); }
        break;
      case 'recover':
        if (e.st >= 40) { setState(e, 'idle'); e.cd = 90; }
        break;
      case 'throw':
        if (e.st >= 24) { setState(e, 'idle'); }
        break;
      default:
        if (d < 135 && e.cd <= 0) {
          setState(e, 'slamwind');
          area(sim, e, { shape: 'circle', x: e.x, y: e.y, r: 130, delay: 54, mul: 1.4, kb: 420, stun: 20, kind: 'slam' });
        } else if (d > 170 && d < 460 && e.cd2 <= 0) {
          setState(e, 'throw'); e.cd2 = 200;
          area(sim, e, { shape: 'circle', x: t.x + t.vx * 0.2, y: t.y + t.vy * 0.2, r: 72, delay: 66, mul: 0.9, kb: 200, kind: 'rock', committed: true });
        } else move(e, angTo(e, t), 1);
    }
  },
  caster(sim, e, t) {
    const d = dTo(e, t);
    if (e.state === 'fade') {
      if (e.st >= 20) {
        const a = sim.rng.next() * Math.PI * 2, r = 230 + sim.rng.next() * 80;
        e.x = t.x + Math.cos(a) * r; e.y = t.y + Math.sin(a) * r; e.px = e.x; e.py = e.y;
        setState(e, 'idle'); e.cd = Math.min(e.cd, 30);
        sim.emit({ type: 'teleport', x: e.x, y: e.y, id: e.id });
      }
      return;
    }
    kite(sim, e, t, 250, 360, 0.9);
    if (d < 130 && e.cd2 <= 0) { setState(e, 'fade'); e.cd2 = 240; return; }
    if (e.state === 'wind') {
      if (e.st >= 26) {
        const a = angTo(e, t);
        for (let i = -1; i <= 1; i++) shoot(sim, e, a + i * 0.5, 150, { r: 10, homing: 1.7, life: 240, style: 'hex' });
        setState(e, 'idle'); e.cd = 140;
      }
    } else if (e.cd <= 0 && d < 480) setState(e, 'wind');
  },
  pack(sim, e, t) {
    const d = dTo(e, t);
    switch (e.state) {
      case 'wind':
        if (e.st >= 22) { setState(e, 'dash'); e.hitDone = false; }
        break;
      case 'dash':
        e.face = e.lock; move(e, e.lock, 3.6);
        if (!e.hitDone && contact(sim, e, t, 1.1, 220)) e.hitDone = true;
        if (e.st >= 15) setState(e, 'recover');
        break;
      case 'recover':
        if (e.st >= 26) { setState(e, 'idle'); e.cd = 70 + Math.floor(sim.rng.next() * 70); }
        break;
      default: {
        if (e.cd <= 0 && d < 260) {
          e.lock = angTo(e, t); setState(e, 'wind');
          area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.lock, len: 230, w: 30, delay: 22, visual: true, kind: 'lunge' });
          break;
        }
        // circle the player at ~170px
        const a = angTo(e, t);
        const side = (e.id % 2 ? 1 : -1);
        const want = a + Math.PI + side * 0.6;
        const tx = t.x + Math.cos(want) * 170, ty = t.y + Math.sin(want) * 170;
        move(e, Math.atan2(ty - e.y, tx - e.x), 0.9);
      }
    }
  },
  knight(sim, e, t) {
    const d = dTo(e, t);
    switch (e.state) {
      case 'swing':
        if (e.st >= 38) { setState(e, 'recover'); }
        break;
      case 'shock':
        if (e.st === 40) { for (let i = -2; i <= 2; i++) shoot(sim, e, e.lock + i * 0.2, 250, { r: 13, style: 'dark', mul: 0.9, life: 110 }); }
        if (e.st >= 44) setState(e, 'recover');
        break;
      case 'recover':
        if (e.st >= 30) { setState(e, 'idle'); e.cd = 60; }
        break;
      default:
        if (d < 150 && e.cd <= 0) {
          e.count++;
          e.lock = angTo(e, t);
          if (e.count % 3 === 0) {
            setState(e, 'shock');
            area(sim, e, { shape: 'cone', x: e.x, y: e.y, ang: e.lock, arc: 1.2, r: 420, delay: 40, visual: true, kind: 'shock' });
          } else {
            setState(e, 'swing');
            area(sim, e, { shape: 'cone', x: e.x, y: e.y, ang: e.lock, arc: 1.9, r: 150, delay: 36, mul: 1.0, kb: 320, stun: 12, kind: 'swing' });
          }
        } else move(e, angTo(e, t), 1);
    }
  },
  spiral(sim, e, t) {
    if (e.state === 'cast') {
      kite(sim, e, t, 200, 320, 0.25);
      if (e.st % 6 === 0) { shoot(sim, e, e.rot, 185, { r: 8, style: 'fire' }); shoot(sim, e, e.rot + Math.PI, 185, { r: 8, style: 'fire' }); e.rot += 0.23; }
      if (e.st >= 110) { setState(e, 'idle'); e.cd = 90; }
    } else if (e.state === 'wind') {
      if (e.st >= 24) { e.rot = angTo(e, t); setState(e, 'cast'); }
    } else {
      kite(sim, e, t, 240, 330, 1);
      if (e.cd <= 0 && dTo(e, t) < 440) setState(e, 'wind');
    }
  },
  boss(sim, e, t) { bossUpdate(sim, e, t); },
};

// ------------------------------------------------------------------ boss
const ROTATION = {
  1: ['slam', 'ring', 'stomps', 'ring'],
  2: ['charge', 'spiral', 'slam', 'summon', 'stomps', 'ring'],
  3: ['meteors', 'spiral', 'charge', 'ring', 'slam', 'summon', 'meteors', 'stomps'],
};

function bossReset(sim, e) {
  const hx = e.arena ? e.homeX : BOSS_POS.x, hy = e.arena ? e.homeY : BOSS_POS.y; // (Khepra walks home to her own arena)
  const dh = Math.hypot(hx - e.x, hy - e.y);
  if (e.state !== 'idle') { setState(e, 'idle'); cancelAreasOf(sim, e); e.untargetable = 0; }
  if (dh > 20) { e.face = Math.atan2(hy - e.y, hx - e.x); move(e, e.face, 1); }
  if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.003);
  if (e.hp >= e.maxHp) { e.phase = 1; e.attackIdx = 0; }
}

function bossUpdate(sim, e, t) {
  const pct = e.hp / e.maxHp;
  const want = pct > 0.66 ? 1 : pct > 0.33 ? 2 : 3;
  const fast = e.phase === 3 ? 0.75 : 1;
  if (want > e.phase) {
    e.phase = want;
    cancelAreasOf(sim, e);
    setState(e, 'roar');
    e.invuln = 0; // (game loop C: no invulnerable roar; the phase change is a breather on HP only)
    sim.emit({ type: 'bossPhase', phase: e.phase, x: e.x, y: e.y, id: e.id });
    for (const p of sim.players.values()) if (!p.dead && dTo(e, p) < 320 && !evadeShove(sim, p)) { const a = angTo(e, p); p.vx += Math.cos(a) * 900; p.vy += Math.sin(a) * 900; }
    return;
  }
  const d = dTo(e, t);
  switch (e.state) {
    case 'roar':
      if (e.st >= 70) setState(e, 'idle');
      return;
    case 'idle': {
      if (d > 200) move(e, angTo(e, t), 1);
      else if (d < 120) move(e, angTo(e, t) + Math.PI, 0.5);
      if (e.st >= Math.round(46 * fast)) {
        const rot = ROTATION[e.phase];
        setState(e, rot[e.attackIdx % rot.length]);
        e.attackIdx++;
      }
      return;
    }
    case 'slam': {
      const delay = Math.round(56 * fast);
      if (e.st === 1) { for (const b of slamBeats({ shape: 'circle', x: e.x, y: e.y, r: 200, delay, mul: 1.3, kb: 520, stun: 26, kind: 'slam', follow: e.id })) area(sim, e, b); }
      if (e.st === delay + 1 && e.phase >= 2) ring(sim, e, 14, 210, sim.rng.next(), { r: 11, style: 'dark' });
      if (e.st >= delay + 24) setState(e, 'idle');
      return;
    }
    case 'ring': {
      const n = e.phase === 1 ? 16 : 20;
      if (e.st === 12 || e.st === 34 || e.st === 56) ring(sim, e, n, 200 + e.phase * 15, e.rot + (e.st / 22) * (Math.PI / n), { r: 11, style: 'dark', mul: 0.8 });
      if (e.st >= 80) { e.rot += 0.4; setState(e, 'idle'); }
      return;
    }
    case 'stomps': {
      if (e.st === 1) e.lock = angTo(e, t);
      for (let k = 0; k < 5; k++) {
        if (e.st === 1 + k * 10) {
          const r = 110 + k * 105;
          for (const off of e.phase >= 2 ? [-0.45, 0, 0.45] : [0]) {
            area(sim, e, { shape: 'circle', x: e.x + Math.cos(e.lock + off) * r, y: e.y + Math.sin(e.lock + off) * r, r: 78, delay: Math.round(44 * fast), mul: 1.0, kb: 300, stun: 10, kind: 'stomp', committed: true });
          }
        }
      }
      if (e.st >= 100) setState(e, 'idle');
      return;
    }
    case 'charge': {
      const wind = Math.max(54, Math.round(52 * fast)); // (>= 0.9 s tell: combat audit step 1)
      if (e.st === 1) {
        e.lock = angTo(e, t);
        area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.lock, len: 760, w: e.r * 2 + 16, delay: wind, visual: true, kind: 'charge' });
      }
      if (e.st > wind && e.st < wind + 60) {
        e.face = e.lock;
        const sp = 760;
        e.x += Math.cos(e.lock) * sp * DT; e.y += Math.sin(e.lock) * sp * DT;
        if (contact(sim, e, t, 1.5, 700, 30)) { /* hit */ }
        if (collide(sim, e)) { e.st = wind + 60; sim.emit({ type: 'slamWall', x: e.x, y: e.y }); ring(sim, e, 12, 220, 0, { r: 10, style: 'dark', mul: 0.7 }); }
      }
      if (e.st >= wind + 100) setState(e, 'idle'); // long recovery = punish window
      return;
    }
    case 'summon': {
      if (e.st === 20) {
        const alive = sim.enemies.filter((x) => !x.dead && x.summonOf === e.id).length;
        const type = e.phase === 3 ? 'imp' : 'wolf';
        for (let i = alive; i < 3; i++) {
          const a = sim.rng.next() * Math.PI * 2;
          const m = spawnEnemy(sim, type, e.x + Math.cos(a) * 140, e.y + Math.sin(a) * 140, { zoneHp: false });
          m.summonOf = e.id; m.xp = Math.round(m.xp * 0.3); m.dropChance = 0.1; m.homeX = BOSS_POS.x; m.homeY = BOSS_POS.y;
          sim.emit({ type: 'teleport', x: m.x, y: m.y, id: m.id });
        }
        sim.emit({ type: 'bossSummon', x: e.x, y: e.y });
      }
      if (e.st >= 50) setState(e, 'idle');
      return;
    }
    case 'spiral': {
      move(e, angTo(e, t), 0.2);
      const arms = e.phase === 3 ? 4 : 3;
      if (e.st % 5 === 0) { for (let i = 0; i < arms; i++) shoot(sim, e, e.rot + (i / arms) * Math.PI * 2, 215, { r: 10, style: 'fire', mul: 0.7 }); e.rot += 0.16; }
      if (e.st >= 110) setState(e, 'idle');
      return;
    }
    case 'meteors': {
      if (e.st % 9 === 1 && e.st < 72) {
        const a = sim.rng.next() * Math.PI * 2, r = sim.rng.next() * 200;
        area(sim, e, { shape: 'circle', x: t.x + Math.cos(a) * r, y: t.y + Math.sin(a) * r, r: 80, delay: 60, mul: 1.2, kb: 300, stun: 20, kind: 'meteorE', committed: true });
      }
      if (e.st >= 110) setState(e, 'idle');
      return;
    }
    default:
      setState(e, 'idle');
  }
}
