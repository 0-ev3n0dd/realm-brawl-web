// Missions revamp, part 3 (2026-10-08): the Capture runtime (sim/ops.js hands over its helpers, bindOps3).
//  A hunting ground: 7 clearings joined by trails (sim/opsconst.js). Three phases:
//  TRACK    3 clues lead to the quarry's lair (a random route each run, e.g. camp -> west -> north-west -> the lair).
//           Footprints run from where you are to the next clue (client); stand by a clue for 1.4 s to read it. Each clue
//           has a sleeping guard pack and pre-laid biome snares round it. The 3rd clue flushes the quarry out.
//  CHASE    the quarry flees from clearing to clearing (sim/opsboss3.js quarryAi), laying snares behind it (Snapjaw Snare /
//           Sand Sink / Rime Mine / Cinder Mine: faint until you look, a short spring telegraph, then a root / pull / freeze
//           / burn), calling guards (every 13 s) and splitting off DECOYS (every 17 s: same look; only the real one leaves
//           glowing footprints). PIN it: a NET (crates in every clearing; interact / TAP within 520 px: roots it 2.6 s and
//           pauses the clock; a decoy just pops) +30, each escape rig broken +20 (and +12 s on the clock), damage +1 per 1%
//           of its HP (max 50). 100 = CORNERED. The escape clock (100 s from the flush): at 0 it bolts for the nearest
//           intact rig (Vine Rope / Sand Glider / Ice Sled / Smoke Balloon); reaching it = it escapes (the run fails). All
//           rigs broken = it has nowhere left to run.
//  CORNERED it leaps to the nearest clearing and the Hunter's Ring closes: a real fight (sim/opsboss3.js). HP 0 = captured.
// Server-authoritative like the rest of sim/ops.js.
import { opsDmgK } from './levelscale.js';
import { secs, PLAYER_SPEED } from './constants.js';
import { OPS, opsBossHpK, OPS_CAPTURE, capClearing, clampInArena } from './opsconst.js';
import { hasMod } from './opsmods.js';
import { opsHurt } from './opshaz.js';
import { spawnEnemy, THREAT } from './ai.js';
import { addArea, damagePlayer, evadeShove } from './combat.js';
import { quarryAi, decoyAi, rigAi } from './opsboss3.js';

const TAU = Math.PI * 2;
const r0 = (v) => Math.round(v);
let K = null; // sim/ops.js helpers: pack, alive, emit, near, coop, bossHp, bonusShower, finish, CHEST, liveOf
export function bindOps3(k) { K = k; }
const REF = { wilds: 34, dunes: 30, frost: 36, ember: 38, rift: 38 };
const setDmg = (O, e, k) => { e.dmg = (REF[O.biome] || 38) * THREAT.eliteDmg * (1 + (O.ctx.mul - 1) * 0.6) * k * opsDmgK(O.biome) * (e.akD || 1); }; // (game loop C2: x the map's re-band)
const modsOn = (O, e, hpK) => {
  const want = K.bossHp(e, hpK) * (hasMod(O, 'ironhide') ? 1.2 : 1), k = want / e.baseMaxHp;
  e.baseMaxHp = Math.round(want); e.maxHp = e.hp = Math.round(e.maxHp * k);
  if (hasMod(O, 'frenzy')) e.spd *= 1.1;
};
const elite = (sim, O, type, x, y) => spawnEnemy(sim, type, x, y, { elite: true, mul: O.ctx.mul, hpMul: O.ctx.hpMul, tier: O.ctx.tier, ramp: O.mul });
/** per biome: what a snare does to a hero (pct of max HP, a root / freeze (stun ticks), a pull, a burn) */
const SNARE_FX = { wilds: { pct: 0.06, stun: secs(0.9), kb: 0 }, dunes: { pct: 0.05, stun: secs(0.45), kb: -260 }, frost: { pct: 0.07, stun: secs(0.75), kb: 0 }, ember: { pct: 0.05, stun: 0, kb: 120, burn: 0.025 }, rift: { pct: 0.06, stun: secs(0.5), kb: -220 } };
export { SNARE_FX };

function wake(sim, O, pl, list, R = 600) {
  if (sim.tick % 8) return;
  let who = null;
  for (const e of list) { if (e.dead) continue; if (e.aggroId) { who = sim.players.get(e.aggroId); if (who) break; } const n = K.near(pl, e.x, e.y); if (n.p && n.d < R) { who = n.p; break; } }
  if (who) for (const e of list) if (!e.dead && !e.aggroId && !e.qrig && Math.hypot(e.x - who.x, e.y - who.y) < 1100) { e.aggroId = who.id; e.huntR = 1700; }
}

// ================================================================== begin: the track
export function beginCapture(sim, O) {
  const A = O.A, C = OPS.capture, N = OPS_CAPTURE[O.biome], c = K.coop(sim), rng = O.rng;
  // the clue route: 3 clearings ending at the lair (random each run)
  const c1 = [1, 5, 6][Math.floor(rng.next() * 3)];
  const n2 = A.adj[c1].filter((j) => j !== 0); const c2 = n2[Math.floor(rng.next() * n2.length)];
  const n3 = A.adj[c2].filter((j) => j !== 0 && j !== c1); const c3 = n3.length ? n3[Math.floor(rng.next() * n3.length)] : 3;
  O.cap = {
    ph: 'track', cl: [c1, c2, c3], ci: 0, ex: 0, t0: O.t, trackS: null, esc: -1, bolt: -1, pin: 0, pinDmg: 0, lastHp: 0,
    nets: {}, crates: A.netAt.map(() => 0), rigs: [], rigsDown: 0, snares: [], hits: 0, set: 0, prints: [], decoys: [], popped: 0, nets0: 0, netsHit: 0,
    guardT: secs(6), decoyT: secs(8), ring: null, clockLeft: null, clueMobs: [], pend: [], taken: [], netted: 0, cornerT0: 0, bolts: 0,
  };
  sim.world.opsHoles = [];
  for (const p of sim.players.values()) if (p.y < -55000) O.cap.nets[p.id] = C.nets0;
  // guards + pre-laid snares at each clue; rigs + a few guards at each exit
  O.cap.cl.forEach((ci, k) => {
    const S = A.clueAt[ci], [n, el] = C.clueGuards[k];
    O.cap.clueMobs.push(K.pack(sim, O, S.x + (k % 2 ? 170 : -170), S.y + 140, Math.round(n * c), el + (k === 2 && c > 1.5 ? 1 : 0), { hunt: false, rad: 150 }));
    for (let i = 0; i < C.clueSnares; i++) { const a = rng.next() * TAU, r = 190 + rng.next() * 150, q = clampInArena(A, S.x + Math.cos(a) * r, S.y + Math.sin(a) * r, 60); layAt(sim, O, q.x, q.y, true); }
  });
  A.exits.forEach((X, i) => {
    const e = elite(sim, O, 'glassorb', X.x, X.y);
    modsOn(O, e, C.rigHp);
    Object.assign(e, { name: N.rig, opsAi: 'rig', qrig: 1, rigI: i, opsM: 1, r: 40, mass: 999, spd: 0, dmg: 0, huntR: 0, aggroId: 0, poise: 999, maxPoise: 999, dropChance: 1, xp: Math.round(e.xp * 2), homeX: X.x, homeY: X.y, state: 'idle' });
    O.mobs.push(e); O.n0++; O.cap.rigs.push(e.id);
    O.cap.clueMobs.push(K.pack(sim, O, X.x - Math.cos(X.a) * 200, X.y - Math.sin(X.a) * 200, Math.round(3 * c), 0, { hunt: false, rad: 110 }));
  });
  K.emit(sim, 'track', { x: r0(A.clueAt[c1].x), y: r0(A.clueAt[c1].y), name: N.quarry[1], clue: N.clues[0] });
}
/** a snare on the floor (armed after a beat) */
function layAt(sim, O, x, y, armed = false) {
  const S = O.cap.snares, C = OPS.capture;
  S.push({ x: r0(x), y: r0(y), born: O.t, arm: armed ? O.t : O.t + C.snareArm });
  if (S.length > C.snareMax + 9) S.shift();
  O.cap.set++;
}

// ================================================================== the tick
export function tickCapture(sim, O, pl) {
  const Q = O.cap, C = OPS.capture, A = O.A, N = OPS_CAPTURE[O.biome], c = K.coop(sim);
  for (const L of Q.clueMobs) wake(sim, O, pl, L, 560);
  tickSnares(sim, O, pl);
  tickCrates(sim, O, pl);
  if (Q.ph === 'track') {
    const ci = Q.cl[Q.ci], S = A.clueAt[ci];
    const on = pl.some((p) => Math.hypot(p.x - S.x, p.y - S.y) < C.clueR);
    if (on) Q.ex += hasMod(O, 'overcharge') ? 1.25 : 1; else Q.ex = Math.max(0, Q.ex - 0.5);
    if (Q.ex >= C.examT) {
      Q.ex = 0; Q.ci++;
      const last = Q.ci >= 3, nx = last ? null : A.clueAt[Q.cl[Q.ci]];
      K.emit(sim, 'clue', { i: Q.ci, name: N.clues[Q.ci - 1], x: r0(S.x), y: r0(S.y), nx: nx ? r0(nx.x) : 0, ny: nx ? r0(nx.y) : 0, last: last ? 1 : 0 });
      if (last) flush(sim, O, S);
    }
    return;
  }
  const e = sim.enemyById.get(O.tgtId);
  if (!e || e.dead) { Q.capturedT = (O.t - Q.cornerT0) / 60; return void K.finish(sim, O, 'clear', `${N.quarry[1]} captured`); }
  // the pin meter: damage dealt (+ nets / rigs: netThrow / rigDown)
  if (Q.lastHp > e.hp) { const add = (Q.lastHp - e.hp) / e.maxHp * 100 * C.pin.dmg; const room = C.pin.dmgMax - Q.pinDmg; if (room > 0 && Q.ph === 'chase') { const a = Math.min(room, add); Q.pinDmg += a; Q.pin += a; } }
  Q.lastHp = e.hp; Q.hpLeft = e.hp / e.maxHp;
  if (sim.tick % 15 === 0) Q.decoys = Q.decoys.filter((id) => { const d = sim.enemyById.get(id); return d && !d.dead; });
  if (Q.ph === 'chase') {
    if (e.netT > 0) Q.netted++;
    else if (Q.bolt < 0) {
      if (--Q.esc <= 0) startBolt(sim, O, e, pl);
    }
    if (Q.bolt >= 0) {
      const X = A.exits[Q.bolt];
      if (Math.hypot(e.x - X.x, e.y - X.y) < C.exitR + e.r) return void K.finish(sim, O, 'escape', `${N.quarry[1]} escaped on the ${N.rig}`);
    }
    if (Q.pin >= 100) return void corner(sim, O, e);
    if (--Q.guardT <= 0) { // calls guards
      Q.guardT = C.guardsEvery; Q.calls = (Q.calls | 0) + 1;
      if (O.mobs.length < 16 * c) { const ms = K.pack(sim, O, e.x, e.y, Math.round(C.guardsN * c), Q.calls % 2 === 0 ? 1 : 0, { rad: 150 }); void ms; K.emit(sim, 'guards', { x: r0(e.x), y: r0(e.y), id: e.id }); }
    }
    if (--Q.decoyT <= 0 && Q.bolt < 0) { Q.decoyT = C.decoyEvery; if (Q.decoys.length <= 2) spawnDecoys(sim, O, e, null, false); }
  }
}
function flush(sim, O, S) {
  const Q = O.cap, C = OPS.capture, N = OPS_CAPTURE[O.biome], [type, name] = N.quarry, c = K.coop(sim);
  Q.trackS = (O.t - Q.t0) / 60; Q.ph = 'chase'; Q.esc = C.escapeT; Q.flushT = O.t;
  const e = elite(sim, O, type, S.x, S.y - 40);
  modsOn(O, e, opsBossHpK('quarry', O.biome)); setDmg(O, e, C.dmg);
  Object.assign(e, { name, opsAi: 'quarry', opsTgt: 1, opsBoss: 1, opsM: 1, r: C.r, ccRes: secs(2.5), poise: 220, maxPoise: 220, dropChance: 1, xp: Math.round(e.xp * 5), state: 'idle', st: 0, cd: secs(2), huntR: 0, aggroId: 0, snT: 0, prT: 0, blinkCd: secs(3), netT: 0, smokeCd: secs(6) });
  e.spd = PLAYER_SPEED * C.flee * (hasMod(O, 'frenzy') ? 1.06 : 1); e.spd0 = e.spd; e.mass *= 2;
  O.mobs.push(e); O.tgtId = e.id; Q.lastHp = e.hp;
  K.pack(sim, O, S.x, S.y + 60, Math.round(4 * c), 0, { rad: 160 });
  K.emit(sim, 'flush', { x: r0(e.x), y: r0(e.y), name, id: e.id, lair: N.lair, t: C.escapeT });
}
function startBolt(sim, O, e, pl) {
  const Q = O.cap, A = O.A, N = OPS_CAPTURE[O.biome];
  let bi = -1, bd = Infinity;
  Q.rigs.forEach((id, i) => { const r = sim.enemyById.get(id); if (!r || r.dead) return; const X = A.exits[i], d = Math.hypot(X.x - e.x, X.y - e.y); if (d < bd) { bd = d; bi = i; } });
  if (bi < 0) { K.emit(sim, 'noEscape', { x: r0(e.x), y: r0(e.y) }); return void corner(sim, O, e); } // (no rig left: nowhere to run)
  Q.bolt = bi; Q.bolts++; e.wp = null; e.boltTo = -1;
  K.emit(sim, 'bolt', { x: r0(e.x), y: r0(e.y), i: bi, name: N.rig, x2: A.exits[bi].x, y2: A.exits[bi].y });
  void pl;
}
/** the quarry is pinned: it leaps to the nearest clearing and the Hunter's Ring closes */
function corner(sim, O, e) {
  const Q = O.cap, C = OPS.capture, A = O.A, ci = capClearing(A, e.x, e.y), T = A.clear[ci];
  Q.ph = 'fight'; Q.clockLeft = Q.bolt >= 0 ? 0 : Math.max(0, Q.esc) / 60; Q.bolt = -1; Q.pin = 100; Q.cornerT0 = O.t;
  Q.ring = { x: r0(T.x), y: r0(T.y), r: Math.min(C.ringR, T.r - 30), ci };
  const fx = e.x, fy = e.y; e.x = e.px = T.x; e.y = e.py = T.y; e.wp = null; e.netT = 0; e.state = 'recover'; e.st = 0; e.cd = secs(1.6); e.spd = C.spd * (hasMod(O, 'frenzy') ? 1.15 : 1);
  for (const id of Q.decoys) { const d = sim.enemyById.get(id); if (d && !d.dead) { d.dead = true; d.hp = 0; d.despawned = true; } }
  Q.decoys = [];
  // the ring closing shoves heroes inside it back to its edge (no damage)
  for (const p of sim.players.values()) { if (p.dead || !(p.y < -55000)) continue; const d = Math.hypot(p.x - T.x, p.y - T.y); if (d < 160 && !evadeShove(sim, p)) { const a = d ? Math.atan2(p.y - T.y, p.x - T.x) : Math.PI / 2; p.vx += Math.cos(a) * 420; p.vy += Math.sin(a) * 420; } }
  K.emit(sim, 'cornered', { x: r0(fx), y: r0(fy), x2: Q.ring.x, y2: Q.ring.y, r: Q.ring.r, id: e.id, name: e.name, left: Math.round(Q.clockLeft) });
}
/** decoys: same look and name, a sliver of HP. at: fight spots (or null: at the quarry, fleeing different ways) */
function spawnDecoys(sim, O, e, at, fight) {
  const Q = O.cap, C = OPS.capture, n = at ? at.length : C.decoyN;
  const ids = [];
  for (let i = 0; i < n; i++) {
    const q = at ? at[i] : { x: e.x + Math.cos(i * 2.4) * 30, y: e.y + Math.sin(i * 2.4) * 30 };
    const d = spawnEnemy(sim, e.type, q.x, q.y, { elite: true, mul: O.ctx.mul, hpMul: O.ctx.hpMul, tier: O.ctx.tier });
    const hp = Math.max(1, Math.round(e.maxHp * C.decoyHp));
    Object.assign(d, { name: e.name, opsAi: 'qdecoy', qdecoy: 1, decoyOf: e.id, opsTgt: 1, opsM: 1, r: e.r, maxHp: hp, hp, baseMaxHp: hp, dropChance: 0, xp: 0, poise: 1, maxPoise: 1, huntR: 0, aggroId: 0, state: 'walk', st: 0, cd: secs(1.5 + i), life: fight ? Math.round(C.decoyLife * 0.6) : C.decoyLife, fightDecoy: fight ? 1 : 0, spd: e.spd0 || e.spd, netT: 0, from: capClearing(O.A, e.x, e.y) });
    setDmg(O, d, 0.6);
    O.mobs.push(d); Q.decoys.push(d.id); ids.push(d.id);
  }
  if (!fight) { Q.taken = []; e.wp = null; } // (everyone re-plans: they scatter)
  K.emit(sim, 'decoys', { x: r0(e.x), y: r0(e.y), n, ids, fight: fight ? 1 : 0 });
}
function tickSnares(sim, O, pl) {
  const Q = O.cap, C = OPS.capture, N = OPS_CAPTURE[O.biome], F = SNARE_FX[O.biome];
  if (Q.snares.length) {
    const keep = [];
    for (const s of Q.snares) {
      if (O.t - s.born > C.snareLife + (s.arm === s.born ? secs(200) : 0)) continue; // (expired; the clue snares stay)
      let hit = null;
      if (O.t >= s.arm) for (const p of pl) if (Math.abs(p.x - s.x) < 90 && Math.abs(p.y - s.y) < 90 && Math.hypot(p.x - s.x, p.y - s.y) < C.snareTrig + p.r * 0.5) { hit = p; break; }
      if (!hit) { keep.push(s); continue; }
      addArea(sim, { team: 'enemy', ownerId: 0, shape: 'circle', x: s.x, y: s.y, r: C.snareR, delay: C.snareWind, visual: true, kind: 'osnare', committed: true });
      Q.pend.push({ x: s.x, y: s.y, at: sim.tick + C.snareWind });
      K.emit(sim, 'snare', { x: s.x, y: s.y, name: N.snare, pid: hit.id });
    }
    Q.snares = keep;
  }
  if (Q.pend.length) {
    for (const P of Q.pend) {
      if (sim.tick < P.at) continue; P.done = 1;
      for (const p of sim.players.values()) {
        if (p.dead || !(p.y < -55000) || Math.hypot(p.x - P.x, p.y - P.y) > C.snareR + p.r * 0.6) continue;
        if (damagePlayer(sim, p, 0, { x: P.x, y: P.y }, { pct: F.pct, stun: F.stun, kb: F.kb, hold: 1, by: N.snare })) Q.hits++;
      }
      if (F.burn) addArea(sim, { team: 'enemy', ownerId: 0, shape: 'circle', x: P.x, y: P.y, r: C.snareR, delay: 30, pulses: 3, every: 30, pct: F.burn, by: N.snare, kind: 'oburn', committed: true });
      K.emit(sim, 'snareHit', { x: P.x, y: P.y });
    }
    Q.pend = Q.pend.filter((P) => !P.done);
  }
}
function tickCrates(sim, O, pl) {
  if (sim.tick % 6) return;
  const Q = O.cap, C = OPS.capture, A = O.A;
  A.netAt.forEach((q, i) => {
    if (Q.crates[i] > O.t) return;
    for (const p of pl) {
      if ((Q.nets[p.id] | 0) >= C.netsMax || Math.hypot(p.x - q.x, p.y - q.y) > C.crateR + p.r) continue;
      Q.nets[p.id] = (Q.nets[p.id] | 0) + 1; Q.crates[i] = O.t + C.crateT;
      K.emit(sim, 'netGet', { pid: p.id, x: r0(q.x), y: r0(q.y), n: Q.nets[p.id] });
      break;
    }
  });
}
/** a hero throws a net (interact / TAP): the nearest quarry-looking target in reach */
export function netThrow(sim, O, p) {
  const Q = O.cap, C = OPS.capture;
  if (!Q || O.st !== 'run' || p.dead || (Q.ph !== 'chase' && Q.ph !== 'fight') || !((Q.nets[p.id] | 0) > 0)) return false;
  let t = null, bd = C.netR;
  for (const id of [O.tgtId, ...Q.decoys]) { const e = sim.enemyById.get(id); if (!e || e.dead) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; t = e; } }
  if (!t) return false;
  Q.nets[p.id]--; Q.nets0++;
  const real = t.id === O.tgtId;
  K.emit(sim, 'net', { pid: p.id, x: r0(p.x), y: r0(p.y), x2: r0(t.x), y2: r0(t.y), real: real ? 1 : 0, id: t.id });
  if (!real) { opsHurt(sim, t, t.hp + 1, p, { num: false }); return true; }
  Q.netsHit++;
  t.netT = Q.ph === 'chase' ? C.netT : C.netFightT; t.wp = null;
  if (Q.ph === 'chase') Q.pin += C.pin.net;
  return true;
}
/** sim/ops.js onKill: rigs, decoys */
export function capKill(sim, O, e) {
  const Q = O.cap; if (!Q) return;
  if (e.qdecoy) { Q.popped++; K.emit(sim, 'decoyPop', { x: r0(e.x), y: r0(e.y), id: e.id }); return; }
  if (e.qrig) {
    const C = OPS.capture, N = OPS_CAPTURE[O.biome];
    Q.rigsDown++; Q.pin += C.pin.rig; if (Q.ph === 'chase' && Q.bolt < 0) Q.esc += C.rigBonus;
    const left = Q.rigs.filter((id) => { const m = sim.enemyById.get(id); return m && !m.dead; }).length;
    K.emit(sim, 'rigDown', { x: r0(e.x), y: r0(e.y), i: e.rigI, name: N.rig, left, bonus: Q.ph === 'chase' ? Math.round(C.rigBonus / 60) : 0 });
    if (Q.ph === 'chase' && Q.bolt === e.rigI) { Q.bolt = -1; const q = sim.enemyById.get(O.tgtId); if (q && !q.dead) startBolt(sim, O, q, K.alive(sim)); }
  }
}
const QH = {
  snare(sim, O, e) { layAt(sim, O, e.x - Math.cos(e.face) * (e.r + 30), e.y - Math.sin(e.face) * (e.r + 30)); },
  print(sim, O, e) { const P = O.cap.prints; P.push([r0(e.x), r0(e.y), Math.round(e.face * 100) / 100, O.t]); if (P.length > OPS.capture.prints) P.shift(); },
  adds(sim, O, e) { const c = K.coop(sim), R = O.cap.ring; K.pack(sim, O, R.x, R.y + R.r * 0.6, Math.round(OPS.capture.adds * c), 1, { rad: 160 }); K.emit(sim, 'adds', { x: r0(e.x), y: r0(e.y) }); },
  decoys(sim, O, e, at, fight) { spawnDecoys(sim, O, e, at, fight); },
};
/** sim/ops.js updateOpsAi */
export function ops3Ai(sim, e) {
  if (e.opsAi === 'quarry') { quarryAi(sim, e, QH); return true; }
  if (e.opsAi === 'qdecoy') { decoyAi(sim, e); return true; }
  if (e.opsAi === 'rig') { rigAi(sim, e); return true; }
  return false;
}

// ================================================================== co-op view / grades / respawn / rewards
export function packOps3(sim, O, v) {
  const Q = O.cap; if (!Q) return;
  const e = O.tgtId ? sim.enemyById.get(O.tgtId) : null, live = e && !e.dead;
  Object.assign(v, {
    ph: Q.ph, cl: Q.cl, ci: Q.ci, ex: Math.round(Q.ex / OPS.capture.examT * 100) / 100, esc: Q.ph === 'chase' ? Math.max(0, Q.esc) : -1, bolt: Q.bolt, pin: Math.min(100, Math.round(Q.pin)),
    nets: Object.entries(Q.nets).map(([k, n]) => [+k, n]), cr: Q.crates.map((t) => (t > O.t ? 0 : 1)),
    rg: Q.rigs.map((id) => { const m = sim.enemyById.get(id); return m && !m.dead ? Math.max(1, Math.round(m.hp / m.maxHp * 100)) : 0; }), rd: Q.rigsDown,
    sn: Q.snares.map((s) => [s.x, s.y, O.t >= s.arm ? 1 : 0]), pr: Q.prints.map((q) => [q[0], q[1], q[2], O.t - q[3]]),
    qd: [O.tgtId, ...Q.decoys].filter((id) => id), tid: O.tgtId, thp: live ? e.hp / e.maxHp : 0, tn: e ? e.name : OPS_CAPTURE[O.biome].quarry[1], tx: live ? r0(e.x) : 0, ty: live ? r0(e.y) : 0,
    nt: live ? e.netT | 0 : 0, ring: Q.ring ? [Q.ring.x, Q.ring.y, Q.ring.r] : 0, sh: Q.hits, dp: Q.popped,
    bhp: Q.ph === 'fight' && live ? e.hp / e.maxHp : 0, bn: e ? e.name : '', bid: Q.ph === 'fight' ? O.tgtId : 0,
  });
}
export function gradeStats3(O, why, base) {
  const Q = O.cap || { ci: 0, ph: 'track', pin: 0 }, clear = why === 'clear';
  const part = clear ? 1 : Q.ph === 'track' ? 0.1 * Q.ci : Q.ph === 'chase' ? 0.3 + 0.3 * Math.min(1, Q.pin / 100) : 0.6 + 0.3 * (1 - (Q.hpLeft ?? 1));
  return { ...base, clear, part, track: Q.trackS, clock: Q.clockLeft, snares: Math.round((Q.hits | 0) / Math.max(1, base.n || 1)) };
}
export function spot3(O, sim) {
  const Q = O.cap, A = O.A; if (!Q) return null;
  if (Q.ring) return { x: Q.ring.x, y: Q.ring.y + Q.ring.r - 60 };
  const e = Q.ph === 'chase' ? sim.enemyById.get(O.tgtId) : null;
  const at = e && !e.dead ? e : Q.ci > 0 ? A.clueAt[Q.cl[Q.ci - 1]] : A.start, ci = capClearing(A, at.x, at.y), T = A.clear[ci];
  return { x: T.x, y: T.y + 120 };
}
/** the Capture's share of opsRewards: clues read + rigs broken on any run; the bounty on a capture */
export function capRewards(O, table, clear) {
  const Q = O.cap || { ci: 0, rigsDown: 0 }, b = hasMod(O, 'bounty') ? 1.3 : 1;
  for (let i = 0; i < Q.ci; i++) table.push({ k: 'mat', pool: 'common', p: 1, n: [Math.round(2 * b), Math.round(3 * b)] }, { k: 'gold', p: 1, n: [2, 3], g: 1.5 });
  for (let i = 0; i < Q.rigsDown; i++) table.push({ k: 'mat', pool: 'rare', p: 1, n: [1, Math.round(2 * b)] });
  if (clear) table.push({ k: 'mat', pool: 'trophy', p: 1, n: [2, 2] }, { k: 'mat', pool: 'rare', p: 1, n: [Math.round(3 * b), Math.round(4 * b)] }, { k: 'gold', p: 1, n: [6, 8], g: 4 });
  return `${Q.ci} clue${Q.ci === 1 ? '' : 's'} · ${Q.rigsDown} rig${Q.rigsDown === 1 ? '' : 's'} broken${clear ? ' · the bounty' : ''}`;
}
