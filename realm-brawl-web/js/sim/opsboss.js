// Missions revamp, part 1: the mission bosses' AI (sim/ops.js updateOpsAi dispatches here by e.opsAi).
//  SIEGE (Defense, final wave of every round): a biome siege beast that marches on the relic. Siege Slam (a big ring:
//    knocks heroes back and shuts down the turrets / traps / wards round it for 6 s), Bombard (boulders on the relic and
//    on a hero: a boulder landing on the relic chips it), Battering Charge (a telegraphed line run; through the relic it
//    hits it hard), and at the relic it pounds it. The relic pulse stuns it (interrupts a wind-up). Enrages under 40%.
//  QUEEN (Swarm, after wave 8): the Swarm Queen keeps her distance and runs the fight: Brood Eggs (hatch into broodlings
//    in 6 s unless broken), Acid Barrage (circles on every hero, leaving acid pools), Pounce (a line dash at a hero),
//    Screech under 60% (a donut: safe hugging her or far out). Enrages under 35% (faster, one more egg).
//  No invulnerable phases (length comes from HP: OPS.siege / OPS.queen hpK x the mission's average elite). Every attack
//  is telegraphed (default red enemy areas + the donut kind 'odonut'). CC from heroes works on both.
import { DT } from './constants.js';
import { tickStacks } from './kit.js';
import { addArea, damagePlayer, cancelAreasOf } from './combat.js';
import { resolveOps } from './opsconst.js';
import { OPS } from './opsconst.js';
import { hurtRelic } from './opshaz.js';

const TAU = Math.PI * 2;
const r0 = (v) => Math.round(v);
const WINDS = new Set(['slamwind', 'throw', 'wind', 'cast', 'summon', 'roar', 'chargewind', 'leapwind', 'quake', 'cleave', 'smash', 'fan', 'lines', 'drain', 'drainrun', 'whirl', 'dashwind', 'dash', 'toss', 'ringtrap', 'smoke']); // (part 2's bosses too: a stun cuts the wind-up / the Waylayer's drain)
const emit = (sim, ph, o = {}) => { const O = sim.ops; sim.emit({ type: 'ops', ph, k: O ? O.type : '', b: O ? O.biome : '', ...o }); };
const setS = (e, s) => { e.state = s; e.st = 0; };
function nearest(sim, e) { let b = null, bd = Infinity; for (const p of sim.players.values()) { if (p.dead || !(p.y < -55000)) continue; const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < bd) { bd = d; b = p; } } return { p: b, d: bd }; }
function moveA(e, ang, sp) { const k = (e.cc.slow > 0 ? e.cc.slowMul : 1) * sp * DT; e.x += Math.cos(ang) * k; e.y += Math.sin(ang) * k; }
/** the shared prelude (timers, knockback, cc). true = busy this tick (stunned / downed / hit-stopped). */
function pre(sim, e) {
  if (e.flash > 0) e.flash--;
  if (e.sunder && --e.sunder.t <= 0) e.sunder = null; if (e.taunt && --e.taunt.t <= 0) e.taunt = null; if (e.mark && --e.mark.t <= 0) e.mark = null; if (e.stx) tickStacks(e);
  if (e.hitstop > 0) { e.hitstop--; return true; }
  if (e.contactCd > 0) e.contactCd--;
  if (e.vx || e.vy) { e.x += e.vx * DT; e.y += e.vy * DT; e.vx *= 0.85; e.vy *= 0.85; if (Math.abs(e.vx) < 2 && Math.abs(e.vy) < 2) e.vx = e.vy = 0; }
  if (e.cc.slow > 0) e.cc.slow--;
  const A = sim.ops && sim.ops.A;
  if (e.ccImm > 0) e.ccImm--; // (part 2's bosses: a short control immunity after each stun, so they can't be stun-locked)
  if (e.cc.down > 0 || e.cc.stun > 0) {
    if (e.cc.down > 0) e.cc.down--; else if (--e.cc.stun === 0) { e.cc.frozen = false; e.cc.rooted = false; }
    if (e.ccRes && e.cc.down <= 0 && e.cc.stun <= 0) e.ccImm = e.ccRes;
    if (WINDS.has(e.state) || e.state === 'charge' || e.state === 'pounce') { cancelAreasOf(sim, e); e.leapDrain = 0; setS(e, 'recover'); }
    if (A) resolveOps(A, e);
    return true;
  }
  return false;
}
function touch(sim, e, t, mul = 0.6, kb = 200) {
  if (!t || e.contactCd > 0) return;
  if (Math.hypot(t.x - e.x, t.y - e.y) > e.r + t.r + 4) return;
  e.contactCd = 40; damagePlayer(sim, t, e.dmg * mul, e, { kb, by: e.name });
}
const area = (sim, e, spec) => addArea(sim, { team: 'enemy', ownerId: e.id, by: e.name, ...spec });
export { pre, touch, area, nearest, moveA, setS }; // (sim/opsboss2.js: the part-2 bosses share the prelude)

// ------------------------------------------------------------------ the Defense siege boss
export function siegeAi(sim, e) {
  const O = sim.ops; if (pre(sim, e)) return;
  if (!O || O.type !== 'defense' || O.st !== 'run') { if (O) resolveOps(O.A, e); return; }
  const S = OPS.siege, A = O.A, R = A.relic, n = nearest(sim, e), enr = e.hp < e.maxHp * S.enrage, rng = O.rng;
  e.st++; if (e.cd > 0) e.cd--;
  // boulders in flight land (the relic takes a chip from any that comes down on it)
  if (e.bombs && e.bombs.length) { for (const b of e.bombs) if (sim.tick >= b.at && !b.done) { b.done = 1; if (Math.hypot(b.x - R.x, b.y - R.y) < R.r + S.bombR) { hurtRelic(sim, O, S.bombRelic); emit(sim, 'relicHit', { x: R.x, y: R.y, hp: Math.ceil(O.relic) }); } } e.bombs = e.bombs.filter((b) => !b.done); }
  const dR = Math.hypot(R.x - e.x, R.y - e.y), reach = R.r + e.r + 26;
  const cd = () => { e.cd = enr ? S.cdEnr : S.cd; };
  switch (e.state) {
    case 'walk': default: {
      if (e.state !== 'walk') setS(e, 'walk');
      if (dR > reach) { e.face = Math.atan2(R.y - e.y, R.x - e.x); moveA(e, e.face, e.spd * (enr ? 1.2 : 1)); } else { setS(e, 'pound'); break; }
      touch(sim, e, n.p);
      if (e.cd <= 0) {
        if (n.p && n.d < S.slamR + 30) setS(e, 'slamwind');
        else if (n.p && n.d < 640 && rng.next() < 0.45) { e.tgt = { x: n.p.x, y: n.p.y }; setS(e, 'chargewind'); }
        else if (rng.next() < 0.65 || dR < 420) setS(e, 'throw');
        else { e.tgt = { x: R.x, y: R.y }; setS(e, 'chargewind'); }
      }
      break;
    }
    case 'slamwind':
      if (e.st === 1) { area(sim, e, { shape: 'circle', x: e.x, y: e.y, r: S.slamR, delay: S.slamWind, dmg: e.dmg * 1.5, kb: 360, kind: 'oslam' }); emit(sim, 'siegeWind', { x: r0(e.x), y: r0(e.y), id: e.id, a: 'slam' }); }
      if (e.st >= S.slamWind) {
        let off = 0; for (const s of O.socks || []) if (s.k && Math.hypot(s.x - e.x, s.y - e.y) < S.offR) { s.off = OPS.defense.siegeOff; off++; }
        emit(sim, 'siegeSlam', { x: r0(e.x), y: r0(e.y), r: S.slamR, off });
        cd(); setS(e, 'recover');
      }
      break;
    case 'throw':
      if (e.st === 1) {
        const pts = [];
        for (let i = 0; i < S.bombN - 1; i++) { const a = rng.next() * TAU, r = 50 + rng.next() * 130; pts.push({ x: r0(R.x + Math.cos(a) * r), y: r0(R.y + Math.sin(a) * r) }); }
        if (n.p) pts.push({ x: r0(n.p.x), y: r0(n.p.y) }); else { const a = rng.next() * TAU; pts.push({ x: r0(R.x + Math.cos(a) * 200), y: r0(R.y + Math.sin(a) * 200) }); }
        if (enr) { const a = rng.next() * TAU; pts.push({ x: r0(R.x + Math.cos(a) * 240), y: r0(R.y + Math.sin(a) * 240) }); }
        e.bombs = (e.bombs || []).concat(pts.map((q) => ({ ...q, at: sim.tick + S.bombWind })));
        for (const q of pts) area(sim, e, { shape: 'circle', x: q.x, y: q.y, r: S.bombR, delay: S.bombWind, dmg: e.dmg * 1.1, kb: 220, kind: 'obomb', committed: true });
        emit(sim, 'siegeBomb', { x: r0(e.x), y: r0(e.y), pts, t: S.bombWind, id: e.id });
      }
      if (e.st >= 34) { cd(); setS(e, 'recover'); }
      break;
    case 'chargewind':
      if (e.st === 1) { const t = e.tgt || R, a = Math.atan2(t.y - e.y, t.x - e.x); e.chg = { ang: a, left: S.chargeLen, hitR: 0 }; e.face = a; area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: a, len: S.chargeLen, w: S.chargeW, delay: S.chargeWind, dmg: e.dmg * 1.4, kb: 420 }); emit(sim, 'siegeWind', { x: r0(e.x), y: r0(e.y), id: e.id, a: 'charge', ang: Math.round(a * 100) / 100 }); }
      if (e.st >= S.chargeWind) setS(e, 'charge');
      break;
    case 'charge': {
      const C = e.chg || { ang: e.face, left: 0 }, step = 920 * DT;
      const x0 = e.x, y0 = e.y; e.x += Math.cos(C.ang) * step; e.y += Math.sin(C.ang) * step; C.left -= step;
      const hit = resolveOps(A, e), moved = Math.hypot(e.x - x0, e.y - y0);
      if (!C.hitR && Math.hypot(R.x - e.x, R.y - e.y) < reach + 6) { C.hitR = 1; hurtRelic(sim, O, S.chargeRelic); emit(sim, 'siegeRam', { x: R.x, y: R.y }); C.left = 0; }
      if (C.left <= 0 || (hit && moved < step * 0.4)) { cd(); setS(e, 'recover'); }
      break;
    }
    case 'pound':
      e.face = Math.atan2(R.y - e.y, R.x - e.x);
      if (dR > reach + 60) { setS(e, 'walk'); break; }
      if (e.st % S.pound === S.pound - 1) { hurtRelic(sim, O, S.poundRelic); emit(sim, 'siegePound', { x: R.x, y: R.y, ex: r0(e.x), ey: r0(e.y) }); }
      if (e.cd <= 0 && n.p && n.d < S.slamR + 30) setS(e, 'slamwind');
      else if (e.cd <= 0 && rng.next() < 0.02) setS(e, 'throw');
      touch(sim, e, n.p);
      break;
    case 'recover':
      if (e.st >= (enr ? 24 : 36)) setS(e, dR > reach ? 'walk' : 'pound');
      break;
  }
  resolveOps(A, e);
}

// ------------------------------------------------------------------ the Swarm Queen
/** H: { eggs(sim, O, e, n), brood(sim, O, x, y, n) } (spawning lives in sim/ops.js) */
export function queenAi(sim, e, H) {
  const O = sim.ops; if (pre(sim, e)) return;
  if (!O || O.type !== 'swarm' || O.st !== 'run') { if (O) resolveOps(O.A, e); return; }
  const Q = OPS.queen, A = O.A, n = nearest(sim, e), enr = e.hp < e.maxHp * Q.enrage, rng = O.rng;
  e.st++; if (e.cd > 0) e.cd--; e.since = (e.since || 0) + 1; e.sinceS = (e.sinceS || 0) + 1;
  if (enr && !e.enr) { e.enr = 1; emit(sim, 'queenEnrage', { x: r0(e.x), y: r0(e.y), name: e.name }); }
  const cd = () => { e.cd = enr ? Q.cdEnr : Q.cd; };
  const heroes = Math.max(1, [...sim.players.values()].filter((p) => !p.dead && p.y < -55000).length);
  switch (e.state) {
    case 'idle': case 'walk': default: {
      if (e.state !== 'walk') setS(e, 'walk');
      if (n.p) { // keep a 180-380 band from the nearest hero, strafing (she runs the fight from the middle distance)
        const a = Math.atan2(n.p.y - e.y, n.p.x - e.x); e.face = a;
        if (n.d < 170) moveA(e, a + Math.PI, e.spd); else if (n.d > 400) moveA(e, a, e.spd); else { if (e.st % 110 === 1) e.wA = rng.next() < 0.5 ? 1 : -1; moveA(e, a + (Math.PI / 2) * (e.wA || 1), e.spd * 0.5); }
        // stay inside the safe ring
        const dc = Math.hypot(e.x - A.cx, e.y - A.cy), lim = (O.safeR || A.R) - e.r - 30; if (dc > lim) { e.x = A.cx + (e.x - A.cx) / dc * lim; e.y = A.cy + (e.y - A.cy) / dc * lim; }
        touch(sim, e, n.p, 0.7, 240);
      }
      if (e.cd <= 0 && n.p) {
        const eggsLive = O.mobs.filter((m) => !m.dead && m.opsAi === 'egg').length;
        if (e.since > 60 * 9 && eggsLive < 2 + heroes) setS(e, 'summon');
        else if (e.hp < e.maxHp * Q.screechAt && e.sinceS > 60 * 13) setS(e, 'roar');
        else if (n.d > 150 && n.d < Q.pounceLen && rng.next() < 0.45) { e.tgt = { x: n.p.x, y: n.p.y }; setS(e, 'wind'); }
        else setS(e, 'cast');
      }
      break;
    }
    case 'summon':
      if (e.st === 1) emit(sim, 'queenEggs', { x: r0(e.x), y: r0(e.y) });
      if (e.st >= 56) { H.eggs(sim, O, e, Q.eggs + (enr ? 1 : 0) + (heroes - 1)); e.since = 0; cd(); setS(e, 'recover'); }
      break;
    case 'cast':
      if (e.st === 1) {
        const pl = [...sim.players.values()].filter((p) => !p.dead && p.y < -55000), pts = [];
        for (const p of pl) pts.push({ x: p.x, y: p.y });
        while (pts.length < Q.acidN + (enr ? 2 : 0)) { const p = pl[Math.floor(rng.next() * pl.length)] || e, a = rng.next() * TAU, r = 120 + rng.next() * 240; pts.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r }); }
        for (const q of pts) {
          const x = r0(q.x), y = r0(q.y);
          area(sim, e, { shape: 'circle', x, y, r: Q.acidR, delay: Q.acidWind, dmg: e.dmg * 1.1, kb: 140, kind: 'oacidhit', committed: true });
          area(sim, e, { shape: 'circle', x, y, r: Q.acidR * 0.9, delay: Q.acidWind + 8, pulses: 5, every: 26, dmg: e.dmg * 0.3, kb: 0, kind: 'oacid', committed: true });
        }
        emit(sim, 'queenAcid', { x: r0(e.x), y: r0(e.y), pts: pts.map((q) => [r0(q.x), r0(q.y)]), t: Q.acidWind });
      }
      if (e.st >= 40) { cd(); setS(e, 'recover'); }
      break;
    case 'wind': // pounce wind-up
      if (e.st === 1) { const t = e.tgt || n.p || A, a = Math.atan2(t.y - e.y, t.x - e.x); e.face = a; e.chg = { ang: a, left: Q.pounceLen }; area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: a, len: Q.pounceLen, w: Q.pounceW, delay: Q.pounceWind, dmg: e.dmg * 1.35, kb: 380 }); }
      if (e.st >= Q.pounceWind) setS(e, 'pounce');
      break;
    case 'pounce': {
      const C = e.chg || { ang: e.face, left: 0 }, step = 1050 * DT, x0 = e.x, y0 = e.y;
      e.x += Math.cos(C.ang) * step; e.y += Math.sin(C.ang) * step; C.left -= step;
      const hit = resolveOps(A, e);
      if (C.left <= 0 || (hit && Math.hypot(e.x - x0, e.y - y0) < step * 0.4)) { emit(sim, 'queenLand', { x: r0(e.x), y: r0(e.y) }); cd(); setS(e, 'recover'); }
      break;
    }
    case 'roar': // Screech: a donut (safe hugging her or far out)
      if (e.st === 1) { area(sim, e, { shape: 'circle', x: r0(e.x), y: r0(e.y), r: Q.screechR, r0: Q.screechR0, delay: Q.screechWind, visual: true, kind: 'odonut', committed: true, follow: e.id }); emit(sim, 'queenScreechWind', { x: r0(e.x), y: r0(e.y) }); }
      if (e.st >= Q.screechWind) {
        for (const p of sim.players.values()) { if (p.dead) continue; const d = Math.hypot(p.x - e.x, p.y - e.y); if (d > Q.screechR0 && d < Q.screechR + p.r * 0.5) damagePlayer(sim, p, e.dmg * 1.6, e, { kb: 300, by: e.name }); }
        emit(sim, 'queenScreech', { x: r0(e.x), y: r0(e.y), r: Q.screechR, r0: Q.screechR0 });
        H.brood(sim, O, e.x, e.y, 4 + heroes);
        e.sinceS = 0; cd(); setS(e, 'recover');
      }
      break;
    case 'recover':
      if (e.st >= (enr ? 20 : 30)) setS(e, 'walk');
      break;
  }
  resolveOps(A, e);
}
/** a brood egg: sits, pulses, hatches into broodlings when its timer runs out (sim/ops.js does the hatch) */
export function eggAi(sim, e, hatch) {
  if (e.flash > 0) e.flash--; if (e.hitstop > 0) { e.hitstop--; return; }
  e.vx = e.vy = 0; e.cc.stun = 0; e.cc.down = 0;
  if (--e.hatch <= 0 && !e.dead) hatch(e);
}
