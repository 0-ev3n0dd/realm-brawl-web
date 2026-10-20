// Missions revamp, part 2 (2026-10-08): the Mobile Defense + Assault runtime (sim/ops.js hands over its helpers, bindOps2).
//  MOBILE DEFENSE  a 3-stage escort. The biome's carrier (Seed Ark / Sun Barge / Rune Sledge / Forge Crawler) rolls down
//    a winding route while a hero is near it (a crowd round it slows it; enemies at it chip it; it mends when quiet; 0 =
//    the run fails). It stops at 2 hack points: hold the ring (progress only with a hero in it), waves pour in, an elite
//    pack at 40%, and once a hack it JAMS (a hero reboots it: interact / TAP). The route shifts as you go: a wall ambush
//    (stage 1), the bridge collapses behind the carrier + the hunter squad (an elite pack + its captain that MARK one hero
//    and chase them; the captain fires telegraphed volleys; stage 2), a hazard surge, a second ambush and a crumbling path
//    (stage 3: ledges fall away into holes). At the final point the boss arrives (sim/opsboss2.js wayAi); clear = it dies.
//  ASSAULT  a stronghold raid north through 4 rooms. The courtyard: shield pylons (they shoot) hold gate 1; break them all.
//    The trap hall: biome traps (line jets + floor plates, telegraphed, on a cycle; enemies get hit too); clear the packs
//    for gate 2. The champion's ring: an elite champion (champAi) + plates; it falls = gate 3. The sanctum: the Gatekeeper
//    (gkAi), wardens at 66% / 33%. Pylon gating is on the doors only: no boss is ever invulnerable.
// Server-authoritative like the rest of sim/ops.js. Collapsed floor = sim.world.opsHoles (world.js resolveCircle).
import { opsDmgK } from './levelscale.js';
import { secs, DT } from './constants.js';
import { OPS, opsBossHpK, OPS_BIOME, OPS_MOBILE, OPS_ASSAULT, routeAt, routeS } from './opsconst.js';
import { hasMod } from './opsmods.js';
import { opsHurt, nearestOf } from './opshaz.js';
import { spawnEnemy, THREAT } from './ai.js';
import { addArea, damagePlayer } from './combat.js';
import { ENEMIES } from './data/enemies.js';
import { wayAi, champAi, gkAi, pylonAi } from './opsboss2.js';

const TAU = Math.PI * 2;
const r0 = (v) => Math.round(v);
let K = null; // sim/ops.js helpers: pack, alive, emit, near, coop, bossHp, bonusShower, finish, CHEST, liveOf
export function bindOps2(k) { K = k; }
/** the damage a mission set piece hits for: the biome's siege-beast elite base x the mission scaling x k */
const REF = { wilds: 34, dunes: 30, frost: 36, ember: 38, rift: 38 };
const setDmg = (O, e, k) => { e.dmg = (REF[O.biome] || 38) * THREAT.eliteDmg * (1 + (O.ctx.mul - 1) * 0.6) * k * opsDmgK(O.biome) * (e.akD || 1); }; // (game loop C2: x the map's re-band)
const modsOn = (O, e, hpK) => { // HP = hpK x the mission's average elite (the level curve) x Iron Hide; Frenzy
  const want = K.bossHp(e, hpK) * (hasMod(O, 'ironhide') ? 1.2 : 1), k = want / e.baseMaxHp;
  e.baseMaxHp = Math.round(want); e.maxHp = e.hp = Math.round(e.maxHp * k);
  if (hasMod(O, 'frenzy')) e.spd *= 1.15;
};
const elite = (sim, O, type, x, y) => spawnEnemy(sim, type, x, y, { elite: true, mul: O.ctx.mul, hpMul: O.ctx.hpMul, tier: O.ctx.tier, ramp: O.mul });
const holes = (sim) => (sim.world.opsHoles || (sim.world.opsHoles = []));
const inHole = (sim, x, y, pad = 0) => holes(sim).some((h) => Math.hypot(x - h.x, y - h.y) < h.r + pad);

/** wake sleeping packs together when a hero comes near (or one of them is hit) */
function wake(sim, O, pl, list, R = 600) {
  if (sim.tick % 8) return;
  let who = null;
  for (const e of list) { if (e.dead || e.opsRaid) continue; if (e.aggroId) { who = sim.players.get(e.aggroId); if (who) break; } const n = K.near(pl, e.x, e.y); if (n.p && n.d < R) { who = n.p; break; } }
  if (who) for (const e of list) if (!e.dead && !e.aggroId && !e.opsRaid && !e.pylon && Math.hypot(e.x - who.x, e.y - who.y) < 1300) { e.aggroId = who.id; e.huntR = 1700; }
}

// ================================================================== MOBILE DEFENSE
export function beginMobile(sim, O) {
  const A = O.A, M = OPS.mobile, q = routeAt(A, 0);
  O.cart = { s: 0, x: q.x, y: q.y, ang: q.ang, hp: M.cartHp, hurtT: 0, mv: 0, min: M.cartHp, sum: 0, n: 0, hitT: 0 };
  O.shard = O.cart; O.k = 0; O.mst = 'move'; O.hack = 0; O.hackT = 0; O.jam = 0; O.jams = 0; O.reboots = 0; O.ev = {}; O.spawnT = secs(6); O.pend = [];
  O.crT = secs(2); O.crN = 0; O.hunt = null; O.huntS = null; O.bossId = 0; O.trickT = secs(8); O.surgeT = 0; O.guards = [];
  sim.world.opsHoles = [];
  guard(sim, O, A.hackS[0] * 0.33, 6, 0);
  guard(sim, O, A.hackS[0] - 40, 5, 0);
}
function guard(sim, O, s, n, el) { const q = routeAt(O.A, s); O.guards.push(...K.pack(sim, O, q.x, q.y, Math.round(n * K.coop(sim)), el, { hunt: false, rad: 170 })); }
/** a breach spot between route distances s0..s1 (the walls), off the collapsed floor */
function breach(sim, O, s0, s1) {
  const L = O.A.spawns.filter((q) => q.s >= s0 && q.s <= s1 && !inHole(sim, q.x, q.y, 30));
  if (L.length) return L[Math.floor(O.rng.next() * L.length)];
  return routeAt(O.A, (s0 + s1) / 2);
}
export function hurtCart(sim, O, amt, burst = false) {
  const C = O.cart; if (!C || O.st !== 'run' || !(amt > 0)) return;
  C.hp = Math.max(0, C.hp - amt); C.hurtT = OPS.mobile.regenDelay; C.min = Math.min(C.min, C.hp);
  if (burst || ++C.hitT % 30 === 1) K.emit(sim, 'cartHit', { x: r0(C.x), y: r0(C.y), hp: Math.ceil(C.hp), big: burst ? 1 : 0 });
}
export function tickMobile(sim, O, pl) {
  const M = OPS.mobile, A = O.A, C = O.cart, c = K.coop(sim), N = OPS_MOBILE[O.biome];
  tickPend(sim, O, pl);
  wake(sim, O, pl, O.guards, 560);
  if (O.surgeT > 0 && --O.surgeT === 0) { O.surge = false; K.emit(sim, 'surgeEnd', {}); }
  // the carrier: chipped by enemies at it, slowed by a crowd round it, mends when quiet
  let dps = 0, foes = 0;
  for (const e of O.mobs) {
    if (e.dead || e.opsBoss || e.pylon) continue; const dx = e.x - C.x, dy = e.y - C.y; if (dx > 320 || dx < -320 || dy > 320 || dy < -320) continue;
    const d = Math.hypot(dx, dy); if (d < M.slowR) foes++; if (d < M.cartR + e.r + M.reach) dps += e.elite ? M.dps.elite : M.dps.fod;
  }
  if (dps > 0) hurtCart(sim, O, dps * DT * (1 + 0.12 * O.k));
  else if (C.hurtT > 0) C.hurtT--; else C.hp = Math.min(M.cartHp, C.hp + M.regen * DT);
  if (C.hp <= 0) return void K.finish(sim, O, 'fail', `The ${N.cart} was destroyed`);
  if (sim.tick % 30 === 0) { C.sum += C.hp; C.n++; }
  for (const e of O.mobs) if (e.opsRaid && !e.dead) { e.homeX = C.x; e.homeY = C.y; }
  tickHunt(sim, O, pl);
  if (O.mst === 'move') {
    const tgt = O.k < 2 ? A.hackS[O.k] : A.finalS, esc = pl.some((p) => Math.hypot(p.x - C.x, p.y - C.y) < M.escortR);
    const slow = foes >= Math.round(M.slowN * (c > 1.5 ? 1.5 : 1));
    const sp = esc ? M.speed * (slow ? M.slowK : 1) : 0;
    C.mv = !esc ? 0 : slow ? 2 : 1;
    C.s = Math.min(tgt, C.s + sp * DT); const q = routeAt(A, C.s); C.x = q.x; C.y = q.y; C.ang = q.ang;
    routeEvents(sim, O, pl);
    if (--O.spawnT <= 0) {
      O.spawnT = M.trickle;
      if (O.mobs.length < 18 * c) { const at = breach(sim, O, C.s + 380, C.s + 950); K.pack(sim, O, at.x, at.y, Math.round(M.trickleN(O.k) * c), 0, { raid: 0.5, home: C, rad: 120 }); K.emit(sim, 'breach', { x: r0(at.x), y: r0(at.y) }); }
    }
    if (C.s >= tgt - 0.5) {
      if (O.k < 2) { O.mst = 'hack'; O.hack = 0; O.hackT = 0; O.jam = 0; O.jamDone = 0; O.eliteDone = 0; O.spawnT = secs(2.5); C.mv = 0; K.emit(sim, 'hack', { i: O.k, x: r0(C.x), y: r0(C.y), t: M.hack[O.k] }); }
      else { O.mst = 'boss'; C.mv = 0; spawnWay(sim, O); }
    }
  } else if (O.mst === 'hack') {
    const need = M.hack[O.k], heroes = pl.filter((p) => Math.hypot(p.x - C.x, p.y - C.y) < M.hackR).length;
    O.hackT++;
    if (heroes && !O.jam) O.hack += hasMod(O, 'overcharge') ? 1.25 : 1;
    const f = O.hack / need;
    if (--O.spawnT <= 0) {
      O.spawnT = M.hackEvery;
      if (O.mobs.length < 22 * c) { const at = breach(sim, O, C.s - 900, C.s + 900); K.pack(sim, O, at.x, at.y, Math.round(M.hackPack(O.k) * c), 0, { raid: 0.4, home: C, rad: 130 }); K.emit(sim, 'breach', { x: r0(at.x), y: r0(at.y) }); }
    }
    if (!O.eliteDone && f >= M.hackElite) { O.eliteDone = 1; const at = breach(sim, O, C.s - 700, C.s + 700); K.pack(sim, O, at.x, at.y, 3, 1 + O.k + (c > 1.5 ? 1 : 0), { home: C }); K.emit(sim, 'hackElite', { x: r0(at.x), y: r0(at.y) }); }
    if (!O.jamDone && f >= M.jamAt) { O.jamDone = 1; O.jam = 1; O.jams++; hurtCart(sim, O, M.jamHit, true); K.emit(sim, 'jam', { x: r0(C.x), y: r0(C.y), name: N.cart }); }
    if (O.hack >= need) {
      O.earned = O.k + 1; O.jam = 0; K.emit(sim, 'hacked', { i: O.k, x: r0(C.x), y: r0(C.y) });
      O.k++; O.mst = 'move'; O.spawnT = secs(4);
      if (O.k === 2) { O.surge = true; O.surgeT = M.surgeT; K.emit(sim, 'surge', { x: r0(C.x), y: r0(C.y) }); }
    }
  } else { // the boss at the final point
    const b = sim.enemyById.get(O.bossId);
    if (!b || b.dead) { O.earned = 3; return void K.finish(sim, O, 'clear', `${O.bossName || 'The boss'} is down: the ${N.cart} made it through`); }
    if (--O.trickT <= 0) { O.trickT = secs(11); if (O.mobs.length < 8 * c) { const at = breach(sim, O, A.finalS - 700, A.finalS); K.pack(sim, O, at.x, at.y, Math.round(4 * c), 0, { raid: 0.5, home: C, rad: 110 }); } }
  }
}
/** a hero reboots the jammed carrier (interact / TAP at it) */
export function rebootCart(sim, O, p) {
  if (O.type !== 'mobile' || O.st !== 'run' || !O.jam || p.dead) return false;
  if (Math.hypot(p.x - O.cart.x, p.y - O.cart.y) > OPS.mobile.rebootR) return false;
  O.jam = 0; O.reboots++; K.emit(sim, 'reboot', { pid: p.id, x: r0(O.cart.x), y: r0(O.cart.y) });
  return true;
}
function routeEvents(sim, O, pl) {
  const M = OPS.mobile, A = O.A, s = O.cart.s, E = O.ev, B = A.bridge;
  if (O.k === 0 && !E.amb1 && s >= A.hackS[0] * 0.5) { E.amb1 = 1; ambush(sim, O, s, 0); }
  if (O.k === 1 && !E.bridge && s >= B.s1 + 300) { E.bridge = 1; collapseBridge(sim, O); }
  if (O.k === 1 && !E.hunt && s >= B.s1 + 480) { E.hunt = 1; spawnHunters(sim, O, pl); }
  if (O.k === 2 && !E.amb2 && s >= A.hackS[1] + 420) { E.amb2 = 1; ambush(sim, O, s, 1); }
  if (O.k === 2 && s > A.hackS[1] + 160 && s < A.finalS - 520 && O.crN < M.crumbleMax && --O.crT <= 0) { O.crT = M.crumbleEvery; crumble(sim, O, s); }
}
/** packs burst from the walls round the carrier (telegraphed cracks first) */
function ambush(sim, O, s, el) {
  const M = OPS.mobile, A = O.A, pts = [breach(sim, O, s + 150, s + 650), breach(sim, O, s + 150, s + 650), breach(sim, O, s - 450, s - 100)];
  for (const q of pts) addArea(sim, { team: 'enemy', ownerId: 0, shape: 'circle', x: r0(q.x), y: r0(q.y), r: 130, delay: M.ambushWind, visual: true, kind: 'oamb', committed: true });
  O.pend.push({ k: 'amb', pts: pts.map((q) => ({ x: r0(q.x), y: r0(q.y) })), at: sim.tick + M.ambushWind, el });
  K.emit(sim, 'ambush', { x: r0(pts[0].x), y: r0(pts[0].y), pts: pts.map((q) => [r0(q.x), r0(q.y)]) });
  void A;
}
/** the bridge falls behind the carrier: a telegraph, then the holes (heroes on it are thrown across, enemies fall) */
function collapseBridge(sim, O) {
  const M = OPS.mobile, A = O.A, B = A.bridge, hs = [];
  for (let s = B.s0 + 190; s <= B.s1 - 130; s += 165) { const q = routeAt(A, s); hs.push({ x: r0(q.x), y: r0(q.y), r: M.holeR }); }
  hs.forEach((h, i) => addArea(sim, { team: 'enemy', ownerId: 0, shape: 'circle', x: h.x, y: h.y, r: h.r, delay: M.bridgeWind - (hs.length - 1 - i) * 6, visual: true, kind: 'ocollapse', committed: true }));
  O.pend.push({ k: 'hole', hs, at: sim.tick + M.bridgeWind, bridge: 1 });
  K.emit(sim, 'collapse', { x: hs[0].x, y: hs[0].y, x2: hs[hs.length - 1].x, y2: hs[hs.length - 1].y, t: M.bridgeWind });
}
/** a ledge crumbles ahead (off the centre lane): telegraph, then a hole */
function crumble(sim, O, s) {
  const M = OPS.mobile, A = O.A, s2 = s + 180 + O.rng.next() * 380, q = routeAt(A, s2), side = O.rng.next() < 0.5 ? -1 : 1, R = A.pathR[q.leg];
  const off = side * (R - M.crumbleR * 0.85), x = r0(q.x - Math.sin(q.ang) * off), y = r0(q.y + Math.cos(q.ang) * off);
  addArea(sim, { team: 'enemy', ownerId: 0, shape: 'circle', x, y, r: M.crumbleR, delay: M.crumbleWind, visual: true, kind: 'ocrumble', committed: true });
  O.pend.push({ k: 'hole', hs: [{ x, y, r: M.crumbleR }], at: sim.tick + M.crumbleWind });
  O.crN++;
  K.emit(sim, 'crumble', { x, y, r: M.crumbleR });
}
function tickPend(sim, O, pl) {
  if (!O.pend.length) return;
  const M = OPS.mobile, A = O.A, c = K.coop(sim);
  for (const P of O.pend) {
    if (sim.tick < P.at) continue;
    P.done = 1;
    if (P.k === 'amb') {
      P.pts.forEach((q, i) => {
        for (const p of pl) if (Math.hypot(p.x - q.x, p.y - q.y) < 130 + p.r * 0.6) damagePlayer(sim, p, 0, { x: q.x, y: q.y }, { pct: 0.05, kb: 260, by: 'an ambush' });
        K.pack(sim, O, q.x, q.y, Math.round(M.ambushN / 3 * c + (i === 0 ? 1 : 0)), i === 0 ? 1 + P.el : 0, { rad: 90 });
      });
      K.emit(sim, 'ambushHit', { pts: P.pts.map((q) => [q.x, q.y]) });
    } else { // holes open
      const H = holes(sim); H.push(...P.hs);
      const far = P.bridge ? routeAt(A, A.bridge.s1 + 250) : null;
      for (const p of sim.players.values()) {
        if (!(p.y < -55000)) continue;
        const inH = P.hs.some((h) => Math.hypot(p.x - h.x, p.y - h.y) < h.r + p.r * 0.4), behind = P.bridge && routeS(A, p.x, p.y) < A.bridge.s1 - 20;
        if (inH && !p.dead) damagePlayer(sim, p, 0, null, { pct: P.bridge ? 0.06 : 0.07, by: P.bridge ? 'the collapsing bridge' : 'the crumbling ledge', raw: true });
        if (P.bridge && (inH || behind)) { p.x = p.px = far.x + (O.rng.next() - 0.5) * 120; p.y = p.py = far.y + (O.rng.next() - 0.5) * 120; p.vx = p.vy = 0; K.emit(sim, 'thrown', { pid: p.id, x: r0(p.x), y: r0(p.y) }); }
      }
      let fell = 0;
      for (const e of O.mobs) {
        if (e.dead || e.opsBoss) continue;
        const inH = P.hs.some((h) => Math.hypot(e.x - h.x, e.y - h.y) < h.r + e.r * 0.3);
        if (inH) { const p = nearestOf(pl, e.x, e.y), q = far || routeAt(A, routeS(A, e.x, e.y)); e.x = e.px = q.x; e.y = e.py = q.y; opsHurt(sim, e, e.hp + 1, p, { num: false }); fell++; } // (it falls: the kill + its loot pop out on solid ground)
        else if (P.bridge && routeS(A, e.x, e.y) < A.bridge.s1 - 20) { e.dead = true; e.hp = 0; e.despawned = true; } // (stranded on the far side: gone)
      }
      K.emit(sim, 'holes', { pts: P.hs.map((h) => [h.x, h.y, h.r]), fell, bridge: P.bridge ? 1 : 0 });
    }
  }
  O.pend = O.pend.filter((P) => !P.done);
  void c;
}
/** the elite hunter squad: a captain + hunters; they mark one hero and run them down */
function spawnHunters(sim, O, pl) {
  const H = OPS.mobile.hunters, N = OPS_MOBILE[O.biome], C = O.cart, at = routeAt(O.A, Math.min(O.A.hackS[1] - 60, C.s + 700)), c = K.coop(sim);
  const ids = [], n = H.n + (c > 1.5 ? 1 : 0);
  const cap = elite(sim, O, N.hunter, at.x, at.y);
  modsOn(O, cap, H.capHpK); cap.name = N.cap; cap.r = Math.round(cap.r * 1.3); cap.hcap = 1; cap.poise = cap.maxPoise = 200; cap.xp = Math.round(cap.xp * 2); cap.dropChance = 1;
  ids.push(cap.id);
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU, e = elite(sim, O, N.hunter, at.x + Math.cos(a) * 90, at.y + Math.sin(a) * 90); modsOn(O, e, H.hpK); e.name = N.hname; ids.push(e.id); }
  const m = pl.length ? pl[Math.floor(O.rng.next() * pl.length)] : null;
  for (const id of ids) { const e = sim.enemyById.get(id); e.opsM = 1; e.hunter = 1; e.huntR = 2400; e.aggroId = m ? m.id : 0; e.homeX = e.x; e.homeY = e.y; O.mobs.push(e); O.n0++; }
  O.hunt = { ids, cap: cap.id, mark: m ? m.id : 0, markT: H.mark, volT: secs(2.5), t0: O.t, lx: at.x, ly: at.y, done: 0 };
  K.emit(sim, 'hunters', { x: r0(at.x), y: r0(at.y), name: N.cap, pid: m ? m.id : 0, id: cap.id });
}
function tickHunt(sim, O, pl) {
  const S = O.hunt; if (!S || S.done) return;
  const H = OPS.mobile.hunters, live = []; for (const id of S.ids) { const e = sim.enemyById.get(id); if (e && !e.dead) live.push(e); }
  if (!live.length) { S.done = 1; O.huntS = (O.t - S.t0) / 60; K.emit(sim, 'huntDown', { x: r0(S.lx), y: r0(S.ly), t: Math.round(O.huntS) }); K.bonusShower(sim, O, S.lx, S.ly, K.CHEST(1)); return; }
  S.lx = live[0].x; S.ly = live[0].y;
  let m = sim.players.get(S.mark);
  if (--S.markT <= 0 || !m || m.dead || !pl.includes(m)) { m = pl.length ? pl[Math.floor(O.rng.next() * pl.length)] : null; S.mark = m ? m.id : 0; S.markT = H.mark; if (m) K.emit(sim, 'mark', { pid: m.id }); }
  if (m) for (const e of live) { e.aggroId = m.id; e.huntR = 2400; }
  const cap = live.find((e) => e.id === S.cap);
  if (cap && m && --S.volT <= 0) {
    S.volT = H.volleyEvery;
    if (Math.hypot(m.x - cap.x, m.y - cap.y) < 950 && !cap.cc.stun) {
      const a = Math.atan2(m.y - cap.y, m.x - cap.x);
      for (const k of [-0.2, 0, 0.2]) addArea(sim, { team: 'enemy', ownerId: cap.id, by: cap.name, shape: 'line', x: r0(cap.x), y: r0(cap.y), ang: Math.round((a + k) * 100) / 100, len: H.volleyLen, w: H.volleyW, delay: H.volleyWind + Math.abs(k) * 40, dmg: cap.dmg * 1.05, kb: 220, kind: 'ovolley' });
      K.emit(sim, 'volley', { id: cap.id, x: r0(cap.x), y: r0(cap.y) });
    }
  }
}
function spawnWay(sim, O) {
  const W = OPS.way, N = OPS_MOBILE[O.biome], [type, name] = N.boss, F = O.A.final, x = F.x + 300, y = F.y - 140;
  const e = elite(sim, O, type, x, y);
  modsOn(O, e, opsBossHpK('way', O.biome));
  setDmg(O, e, W.dmg); e.r = W.r; e.mass *= 4; e.spd = W.spd * (hasMod(O, 'frenzy') ? 1.15 : 1); e.name = name; e.opsAi = 'way'; e.opsBoss = 1; e.opsM = 1;
  e.poise = e.maxPoise = 260; e.ccRes = secs(2.5); e.dropChance = 1; e.xp = Math.round(e.xp * 5); e.state = 'walk'; e.st = 0; e.cd = secs(2.5); e.drainCd = secs(9); e.huntR = 0; e.aggroId = 0;
  O.mobs.push(e); O.bossId = e.id; O.bossT0 = O.t; O.bossName = name;
  K.pack(sim, O, x - 80, y + 200, Math.round(5 * K.coop(sim)), 0, { rad: 120 });
  K.emit(sim, 'wayBoss', { x: r0(x), y: r0(y), name, id: e.id, cart: N.cart });
}
const WAY_H = {
  call(sim, O, e) { const c = K.coop(sim), C = O.cart; K.pack(sim, O, e.x, e.y, Math.round(OPS.way.callN * c), 1, { raid: 0.4, home: C, rad: 160 }); K.emit(sim, 'adds', { x: r0(e.x), y: r0(e.y) }); },
  hurtCart,
};

// ================================================================== ASSAULT
export function beginAssault(sim, O) {
  const A = O.A, P = OPS.assault, N = OPS_ASSAULT[O.biome], c = K.coop(sim);
  O.seg = 0; O.gateY = A.gates[0]; O.trapHits = 0; O.trapPend = []; O.pylS = null; O.pyl = []; O.champId = 0; O.bossId = 0; O.adds = 0; O.segT0 = O.t; O.segMobs = [];
  sim.world.opsHoles = [];
  A.pylons.forEach((q, i) => {
    const e = elite(sim, O, 'glassorb', q.x, q.y);
    modsOn(O, e, P.pylonHp); setDmg(O, e, P.pylonShot);
    Object.assign(e, { name: N.pylon, opsAi: 'pylon', pylon: 1, opsM: 1, r: q.r, mass: 999, spd: 0, cd: 70 + i * 45, huntR: 0, aggroId: 0, poise: 999, maxPoise: 999, dropChance: 1, xp: Math.round(e.xp * 2), homeX: q.x, homeY: q.y, state: 'idle' });
    O.mobs.push(e); O.n0++; O.pyl.push(e.id); O.segMobs.push(e);
  });
  const [g1, g2] = P.guards;
  O.segMobs.push(...K.pack(sim, O, A.cx, A.pylons[2].y + 120, Math.round(g1[0] * c), g1[1] + (c > 1.5 ? 1 : 0), { hunt: false, rad: 220 }));
  O.segMobs.push(...K.pack(sim, O, A.cx, A.cy + 2150, Math.round(g2[0] * c), g2[1], { hunt: false, rad: 200 }));
}
function spawnSeg(sim, O, s) {
  const A = O.A, S = A.segs[s], P = OPS.assault, N = OPS_ASSAULT[O.biome], c = K.coop(sim);
  O.segMobs = []; O.segT0 = O.t;
  if (s === 1) { // the trap hall
    const [n, el] = P.packs[0], k = P.packsPer[0];
    for (let i = 0; i < k; i++) { const y = S.y0 + (S.y1 - S.y0) * (0.3 + 0.45 * i); O.segMobs.push(...K.pack(sim, O, A.cx + (i % 2 ? 1 : -1) * 170, y, Math.round(n * c), el + (c > 1.5 ? 1 : 0), { hunt: false, rad: 220 })); }
  } else if (s === 2) { // the champion's ring
    const [type, name] = N.champ, at = A.champAt, e = elite(sim, O, type, at.x, at.y);
    modsOn(O, e, opsBossHpK('champ', O.biome)); setDmg(O, e, P.champDmg);
    Object.assign(e, { name, opsAi: 'champ', opsChamp: 1, opsM: 1, ccRes: secs(2), r: P.champR, spd: OPS.champ.spd * (hasMod(O, 'frenzy') ? 1.15 : 1), poise: 200, maxPoise: 200, dropChance: 1, xp: Math.round(e.xp * 3), state: 'walk', st: 0, cd: secs(1.5), huntR: 0, aggroId: 0, homeX: at.x, homeY: at.y });
    e.mass *= 2.5; O.mobs.push(e); O.n0++; O.segMobs.push(e); O.champId = e.id;
    const [n] = P.hall[0];
    O.segMobs.push(...K.pack(sim, O, A.cx - 200, at.y + 380, Math.round(n / 2 * c), 0, { hunt: false, rad: 150 }), ...K.pack(sim, O, A.cx + 200, at.y + 380, Math.round(n / 2 * c), 0, { hunt: false, rad: 150 }));
    K.emit(sim, 'champ', { x: r0(at.x), y: r0(at.y), name, id: e.id });
  } else { // the Gatekeeper's sanctum
    const type = N.gk, e = elite(sim, O, type, A.bossAt.x, A.bossAt.y), G = OPS.gk;
    modsOn(O, e, opsBossHpK('gk', O.biome)); setDmg(O, e, P.bossDmg);
    Object.assign(e, { name: 'Gatekeeper ' + ENEMIES[type].name, opsAi: 'gk', opsBoss: 1, opsM: 1, ccRes: secs(2.5), r: G.r, spd: G.spd * (hasMod(O, 'frenzy') ? 1.15 : 1), poise: 260, maxPoise: 260, dropChance: 1, xp: Math.round(e.xp * 5), state: 'walk', st: 0, cd: secs(2.2), huntR: 0, aggroId: 0, homeX: e.x, homeY: e.y });
    e.mass *= 4; O.mobs.push(e); O.segMobs.push(e); O.bossId = e.id; O.adds = 0; O.bossT0 = O.t; O.bossName = e.name;
    O.segMobs.push(...K.pack(sim, O, A.bossAt.x - 260, A.bossAt.y + 200, Math.round(5 * c), 0, { hunt: false }), ...K.pack(sim, O, A.bossAt.x + 260, A.bossAt.y + 200, Math.round(5 * c), 0, { hunt: false }));
    K.emit(sim, 'boss', { x: r0(e.x), y: r0(e.y), name: e.name, id: e.id });
  }
  K.emit(sim, 'room', { i: s, name: N.rooms[s], x: r0(A.cx), y: r0(S.y0 - 200) });
}
function openGate(sim, O) {
  const A = O.A, gy = A.gates[O.seg];
  K.emit(sim, 'gate', { i: O.seg, x: A.cx, y: gy });
  O.seg++; O.gateY = O.seg < 3 ? A.gates[O.seg] : null;
  spawnSeg(sim, O, O.seg);
}
export function tickAssault(sim, O, pl) {
  wake(sim, O, pl, O.segMobs, 620);
  tickTraps(sim, O, pl);
  if (O.seg === 0) {
    if (O.pyl.every((id) => { const e = sim.enemyById.get(id); return !e || e.dead; })) { O.pylS = (O.t - O.segT0) / 60; K.emit(sim, 'shieldDown', { x: O.A.cx, y: O.A.gates[0] }); openGate(sim, O); }
  } else if (O.seg === 1) {
    if (!K.liveOf(O.segMobs).length) openGate(sim, O);
  } else if (O.seg === 2) {
    const ch = sim.enemyById.get(O.champId); if (!ch || ch.dead) openGate(sim, O);
  } else {
    const b = sim.enemyById.get(O.bossId);
    if (!b || b.dead) return void K.finish(sim, O, 'clear', `${O.bossName || 'The Gatekeeper'} is down: the stronghold is yours`);
  }
}
/** a pylon breaks (sim/ops.js onKill) */
export function pylonDown(sim, O, e) { const left = O.pyl.filter((id) => { const m = sim.enemyById.get(id); return m && !m.dead; }).length; K.emit(sim, 'pylon', { x: r0(e.x), y: r0(e.y), left }); }
const segHit = (T, x, y, r) => { if (T.k === 'circle') return Math.hypot(x - T.x, y - T.y) < T.r + r; const dx = Math.cos(T.ang), dy = Math.sin(T.ang), t = Math.max(0, Math.min(T.len, (x - T.x) * dx + (y - T.y) * dy)); return Math.hypot(x - T.x - dx * t, y - T.y - dy * t) < T.w / 2 + r; };
function tickTraps(sim, O, pl) {
  const A = O.A, P = OPS.assault, N = OPS_ASSAULT[O.biome];
  A.traps.forEach((T, i) => {
    if (T.seg > O.seg) return; // (a sealed room's traps sleep)
    if ((O.t + T.off) % T.per !== 0) return;
    if (!pl.some((p) => Math.abs(p.y - T.y) < P.trapNear)) return;
    const kind = 'otrap_' + T.k;
    addArea(sim, T.k === 'line' ? { team: 'enemy', ownerId: 0, shape: 'line', x: T.x, y: T.y, ang: T.ang, len: T.len, w: T.w, delay: P.trapWind, visual: true, kind, committed: true } : { team: 'enemy', ownerId: 0, shape: 'circle', x: T.x, y: T.y, r: T.r, delay: P.trapWind, visual: true, kind, committed: true });
    O.trapPend.push({ i, at: sim.tick + P.trapWind });
  });
  if (!O.trapPend.length) return;
  for (const q of O.trapPend) {
    if (sim.tick < q.at) continue; q.done = 1;
    const T = A.traps[q.i], by = T.k === 'line' ? N.line : N.circle;
    for (const p of sim.players.values()) if (!p.dead && p.y < -55000 && segHit(T, p.x, p.y, p.r * 0.6)) { if (damagePlayer(sim, p, 0, T.k === 'circle' ? { x: T.x, y: T.y } : { x: p.x, y: p.y + 10 }, { pct: P.trapPct, kb: 200, by, stun: O.biome === 'frost' ? 20 : 0 })) O.trapHits++; }
    for (const e of O.mobs) if (!e.dead && !e.pylon && segHit(T, e.x, e.y, e.r * 0.5)) opsHurt(sim, e, e.maxHp * P.trapFoe * (e.opsBoss ? 0.1 : e.opsChamp ? 0.25 : e.elite ? 0.5 : 1), nearestOf(pl, e.x, e.y), { kb: 120, fx: T.x, fy: T.y, num: !!(e.elite || e.opsChamp) });
    K.emit(sim, 'trap', { i: q.i, x: T.x, y: T.y });
  }
  O.trapPend = O.trapPend.filter((q) => !q.done);
}
const CHAMP_H = { cry(sim, O, e) { const ms = K.pack(sim, O, e.x, e.y, Math.round(OPS.champ.cryN * K.coop(sim)), 0, { rad: 140 }); O.segMobs.push(...ms); K.emit(sim, 'adds', { x: r0(e.x), y: r0(e.y) }); } };
const GK_H = { adds(sim, O, e) { const c = K.coop(sim); O.segMobs.push(...K.pack(sim, O, e.x, e.y, Math.round(OPS.assault.adds * c), 1, { rad: 260 })); O.adds++; K.emit(sim, 'adds', { x: r0(e.x), y: r0(e.y) }); } };

/** sim/ops.js updateOpsAi: part 2's set pieces */
export function ops2Ai(sim, e) {
  if (e.opsAi === 'way') { wayAi(sim, e, WAY_H); return true; }
  if (e.opsAi === 'champ') { champAi(sim, e, CHAMP_H); return true; }
  if (e.opsAi === 'gk') { gkAi(sim, e, GK_H); return true; }
  if (e.opsAi === 'pylon') { pylonAi(sim, e); return true; }
  return false;
}

// ================================================================== co-op view / grades / respawn
export function packOps2(sim, O, v) {
  if (O.type === 'mobile') {
    const C = O.cart || { s: 0, x: 0, y: 0, hp: 100, mv: 0 }, b = O.bossId ? sim.enemyById.get(O.bossId) : null, H = O.hunt;
    const hl = H && !H.done ? H.ids.filter((id) => { const e = sim.enemyById.get(id); return e && !e.dead; }).length : 0;
    Object.assign(v, {
      i: O.k, ms: O.mst, cs: r0(C.s), cx: r0(C.x), cy: r0(C.y), hp: Math.ceil(C.hp), mv: C.mv, hk: O.hack, hn: O.mst === 'hack' ? OPS.mobile.hack[O.k] : 0, jam: O.jam ? 1 : 0, done: O.earned | 0,
      ho: (sim.world.opsHoles || []).map((h) => [h.x, h.y, h.r]), hu: hl, hm: H && !H.done ? H.mark : 0, hd: H && H.done ? 1 : 0,
      bhp: b && !b.dead ? b.hp / b.maxHp : 0, bn: b ? b.name : '', bid: O.bossId, dk: b && !b.dead && b.state === 'drain' ? (b.drainK || 0) : -1,
      sx: r0(C.x), sy: r0(C.y), sc: 0, hold: O.hack, need: O.mst === 'hack' ? OPS.mobile.hack[O.k] : 0, su: O.surge ? 1 : 0,
    });
  } else {
    const b = O.bossId ? sim.enemyById.get(O.bossId) : null, ch = O.champId ? sim.enemyById.get(O.champId) : null;
    const pyl = (O.pyl || []).map((id) => { const e = sim.enemyById.get(id); return e && !e.dead ? Math.round(e.hp / e.maxHp * 100) : 0; });
    Object.assign(v, { s: O.seg, gy: O.gateY, left: K.liveOf(O.segMobs).length, bhp: b && !b.dead ? b.hp / b.maxHp : 0, bn: b ? b.name : '', bid: O.bossId, py: pyl, chp: ch && !ch.dead ? ch.hp / ch.maxHp : 0, chn: ch ? ch.name : '', cid: O.champId, th: O.trapHits | 0 });
  }
}
export function gradeStats2(O, why, base) {
  const clear = why === 'clear';
  if (O.type === 'mobile') {
    const C = O.cart, prog = O.k + (O.mst === 'hack' ? Math.min(1, O.hack / OPS.mobile.hack[Math.min(1, O.k)]) * 0.5 : 0);
    return { ...base, clear, part: clear ? 1 : Math.min(0.95, prog / 3), cart: C && C.n ? C.sum / C.n : C ? C.hp : 100, hunt: O.huntS };
  }
  return { ...base, clear, part: clear ? 1 : O.seg / 4, traps: Math.round((O.trapHits | 0) / Math.max(1, base.n || 1)), pylons: O.pylS };
}
export function spot2(O) {
  if (O.type === 'mobile') { const C = O.cart; if (!C) return null; const q = routeAt(O.A, Math.max(0, C.s - 120)); return { x: q.x, y: q.y }; }
  const A = O.A, S = A.segs[Math.min(3, O.seg)]; return { x: A.cx, y: S.y0 - 140 };
}
export { OPS_BIOME };
