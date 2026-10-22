// Missions revamp, part 3 (2026-10-08): the Capture quarry's AI (sim/ops.js updateOpsAi -> sim/opsrun3.js ops3Ai).
//  CHASE  the quarry runs between the hunting ground's clearings, away from the party (it re-plans when cut off, never
//    down a trail a hero stands on). It rests in a clearing while nobody is close, bolts when a hero comes within ~720 px,
//    blinks away from a hero at its heels (9 s cooldown), throws a telegraphed Parting Shot, lays its biome snare behind it
//    (sim/opsrun3.js arms + triggers them) and leaves glowing footprints (the decoys leave none). A NET roots it (no blink,
//    no running) and pauses the escape clock. When the clock runs out it BOLTS for the nearest intact escape rig.
//  DECOYS  the same look and name, a sliver of HP: chase decoys flee like it (and shoot), fight decoys rush a hero. Any
//    hit (or a net) pops one in a puff of smoke.
//  CORNERED  a real fight inside the Hunter's Ring (it can't leave it; heroes can): Pounce Slash (a telegraphed line
//    dash), Snare Toss (circles on every hero: a short root), Bola Fan (a cone of lines), Caltrop Ring (a donut: hug it or
//    stay out), Smoke Swap (it blinks to another spot of the ring and 2 decoys appear; it keeps taking damage the whole
//    time: no invulnerability). Guards join at 66% / 33%; enrages under 35%. Every attack is telegraphed.
// Stuns from heroes work (part 2's control immunity after each stun: it can't be stun-locked).
import { DT } from './constants.js';
import { OPS, CAP_ADJ, capRoute, capClearing, clampInArena } from './opsconst.js';
import { resolveCircle } from './world.js';
import { pre, touch, area, nearest, moveA, setS } from './opsboss.js';
import { wallLen } from './opsboss2.js';

const r0 = (v) => Math.round(v);
const a2 = (v) => Math.round(v * 100) / 100;
const emit = (sim, ph, o = {}) => { const O = sim.ops; sim.emit({ type: 'ops', ph, k: O ? O.type : '', b: O ? O.biome : '', ...o }); };
const angTo = (e, t) => Math.atan2(t.y - e.y, t.x - e.x);
const heroes = (sim) => { const l = []; for (const p of sim.players.values()) if (!p.dead && p.y < -55000) l.push(p); return l; };
const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0; return Math.hypot(px - ax - dx * t, py - ay - dy * t); };

/** pick the next clearing to run to (away from the party; never down a trail a hero is on) */
function planFlee(O, e, pl, jitter) {
  const A = O.A, here = capClearing(A, e.x, e.y);
  let best = -1, bs = -Infinity;
  for (const j of CAP_ADJ[here]) {
    const T = A.clear[j];
    let dh = Infinity, onTrail = Infinity;
    for (const p of pl) { dh = Math.min(dh, Math.hypot(p.x - T.x, p.y - T.y)); onTrail = Math.min(onTrail, segD(p.x, p.y, e.x, e.y, T.x, T.y)); }
    let s = dh - (j === e.from ? 260 : 0) + (O.rng.next() - 0.5) * jitter;
    if (onTrail < 230) s -= 1600;
    if (O.cap && O.cap.bolt < 0 && e.decoyOf == null && (O.cap.taken || []).includes(j)) s -= 120; // (the real one spreads from its decoys)
    if (s > bs) { bs = s; best = j; }
  }
  if (best < 0) return;
  const T = A.clear[best], a = O.rng.next() * Math.PI * 2, rr = O.rng.next() * 140;
  e.from = here; e.dest = best; e.wp = [{ x: T.x + Math.cos(a) * rr, y: T.y + Math.sin(a) * rr }];
}
/** the route to an escape rig (clearing by clearing, then the rig) */
function planBolt(O, e, i) {
  const A = O.A, X = A.exits[i], here = capClearing(A, e.x, e.y), R = capRoute(here, X.ci);
  e.wp = R.slice(1).map((ci) => ({ x: A.clear[ci].x, y: A.clear[ci].y })); e.wp.push({ x: X.x, y: X.y }); e.boltTo = i; e.dest = X.ci;
}

/** the chase (the real quarry and its chase decoys) */
function chase(sim, O, e, decoy) {
  const C = OPS.capture, Q = O.cap, A = O.A, pl = heroes(sim), n = nearest(sim, e);
  e.st++; if (e.cd > 0) e.cd--; if (e.blinkCd > 0) e.blinkCd--;
  if (e.netT > 0) { e.netT--; setS(e, 'netted'); e.st = 1; if (n.p) touch(sim, e, n.p, 0.5); resolveCircle(sim.world, e); return; }
  const bolt = !decoy && Q.bolt >= 0;
  if (bolt && e.boltTo !== Q.bolt) planBolt(O, e, Q.bolt);
  if (!bolt) {
    if (e.wp && e.wp.length && n.p && n.d < C.fleeR) { // cut off from ahead: turn back
      const w = e.wp[e.wp.length - 1];
      if (Math.hypot(n.p.x - w.x, n.p.y - w.y) < Math.hypot(e.x - w.x, e.y - w.y) - 120 && segD(n.p.x, n.p.y, e.x, e.y, w.x, w.y) < 260) planFlee(O, e, pl, decoy ? 900 : 260);
    }
    if ((!e.wp || !e.wp.length) && n.p && n.d < C.fleeR) planFlee(O, e, pl, decoy ? 900 : 260);
  }
  let moving = false;
  if (e.wp && e.wp.length) {
    const w = e.wp[0], d = Math.hypot(w.x - e.x, w.y - e.y);
    if (d < 36) { e.wp.shift(); if (!e.wp.length && !bolt && (!n.p || n.d > C.fleeR)) e.wp = null; }
    else {
      const sp = bolt ? OPS.capture.boltK * e.spd0 / OPS.capture.flee : e.spd;
      e.face = angTo(e, w); moveA(e, e.face, sp); moving = true;
    }
  }
  setS(e, moving ? 'walk' : 'idle'); e.st = 2;
  // blink away from a hero at its heels
  if (!decoy && !bolt && n.p && n.d < C.blinkNear && !(e.blinkCd > 0)) {
    const a = Math.atan2(e.y - n.p.y, e.x - n.p.x), fx = e.x, fy = e.y, q = clampInArena(A, e.x + Math.cos(a) * C.blinkR, e.y + Math.sin(a) * C.blinkR, e.r + 20);
    e.x = e.px = q.x; e.y = e.py = q.y; e.blinkCd = C.blinkEvery; e.wp = null;
    emit(sim, 'blink', { x: r0(fx), y: r0(fy), x2: r0(e.x), y2: r0(e.y) });
  }
  // Parting Shot (decoys too, weaker: they must look the part)
  if (n.p && n.d < 470 && !(e.cd > 0)) {
    const a = angTo(e, n.p);
    area(sim, e, { shape: 'line', x: r0(e.x), y: r0(e.y), ang: a2(a), len: wallLen(sim, e.x, e.y, a, 520, 56), w: 56, delay: 42, dmg: e.dmg * (decoy ? 0.5 : 0.9), kb: 180, kind: 'ovolley' });
    e.cd = decoy ? 260 : 190 + Math.floor(O.rng.next() * 60);
  }
  if (n.p) touch(sim, e, n.p, 0.6);
  resolveCircle(sim.world, e);
  e.moving = moving;
}

/** sim/opsrun3.js: the real quarry. H: { snare(sim, O, e), print(sim, O, e), adds(sim, O, e), decoys(sim, O, e, n, fight) } */
export function quarryAi(sim, e, H) {
  const O = sim.ops; if (pre(sim, e)) return;
  if (!O || O.type !== 'capture' || O.st !== 'run' || !O.cap) { resolveCircle(sim.world, e); return; }
  const Q = O.cap;
  if (Q.ph === 'chase') {
    e.spd0 = e.spd0 || e.spd;
    chase(sim, O, e, false);
    if (e.moving) { if (++e.snT >= OPS.capture.snareEvery) { e.snT = 0; H.snare(sim, O, e); } if (++e.prT >= OPS.capture.printEvery) { e.prT = 0; H.print(sim, O, e); } }
    return;
  }
  if (Q.ph === 'fight') return fight(sim, O, e, H);
  resolveCircle(sim.world, e);
}
/** a decoy (chase: flees like the real one; fight: rushes a hero). Expires in a puff. */
export function decoyAi(sim, e) {
  const O = sim.ops; if (pre(sim, e)) return;
  if (!O || O.type !== 'capture' || O.st !== 'run' || !O.cap) { resolveCircle(sim.world, e); return; }
  if (--e.life <= 0) { e.dead = true; e.hp = 0; e.despawned = true; emit(sim, 'decoyGone', { x: r0(e.x), y: r0(e.y), id: e.id }); return; }
  if (!e.fightDecoy) { e.spd0 = e.spd0 || e.spd; chase(sim, O, e, true); return; }
  const n = nearest(sim, e);
  if (e.netT > 0) { e.netT--; resolveCircle(sim.world, e); return; }
  if (n.p) { e.face = angTo(e, n.p); if (n.d > e.r + n.p.r + 10) moveA(e, e.face, e.spd * 0.8); touch(sim, e, n.p, 0.45); }
  e.state = 'walk'; confine(O, e); resolveCircle(sim.world, e);
}
/** an escape rig: it just stands there (guards round it) */
export function rigAi(sim, e) {
  if (pre(sim, e)) { e.x = e.homeX; e.y = e.homeY; return; }
  e.x = e.homeX; e.y = e.homeY; e.vx = e.vy = 0; e.state = 'idle';
}

// ------------------------------------------------------------------ the capture fight (the Hunter's Ring)
function confine(O, e) {
  const R = O.cap && O.cap.ring; if (!R) return;
  const dx = e.x - R.x, dy = e.y - R.y, d = Math.hypot(dx, dy), lim = R.r - e.r - 8;
  if (d > lim) { e.x = R.x + dx / d * lim; e.y = R.y + dy / d * lim; }
}
const ringSpot = (O, a, k = 0.62) => { const R = O.cap.ring; return { x: r0(R.x + Math.cos(a) * R.r * k), y: r0(R.y + Math.sin(a) * R.r * k) }; };
function fight(sim, O, e, H) {
  const C = OPS.capture, n = nearest(sim, e), enr = e.hp < e.maxHp * C.enrage, rng = O.rng;
  e.st++; if (e.cd > 0) e.cd--; if (e.smokeCd > 0) e.smokeCd--;
  if (e.netT > 0) { e.netT--; if (e.state === 'walk' || e.state === 'dash') { setS(e, 'netted'); } }
  const adds = C.addsAt.filter((k) => e.hp < e.maxHp * k).length;
  if (adds > (e.adds | 0)) { e.adds = adds; H.adds(sim, O, e); }
  const cd = () => { e.cd = enr ? C.cdEnr : C.cd; };
  const pick = (list) => { const L = list.filter((k) => k !== e.last); const k = L[Math.floor(rng.next() * L.length)] || list[0]; e.last = k; return k; };
  switch (e.state) {
    case 'walk': default: {
      if (e.state !== 'walk') setS(e, 'walk');
      if (!n.p) break;
      e.face = angTo(e, n.p);
      const want = 260;
      if (n.d > want + 90) moveA(e, e.face, e.spd * (enr ? 1.15 : 1));
      else if (n.d < want - 120) moveA(e, e.face + Math.PI * 0.75 * (e.id % 2 ? 1 : -1), e.spd * 0.8); // (it keeps its distance, circling)
      touch(sim, e, n.p, 0.7);
      if (e.cd <= 0) {
        let k;
        if (!(e.smokeCd > 0) && e.hp < e.maxHp * 0.85) k = 'smoke';
        else k = pick(n.d < C.ringTrapR - 60 ? ['dashwind', 'toss', 'fan', 'ringtrap'] : ['dashwind', 'toss', 'fan']);
        if (k === 'dashwind') e.tgt = { x: n.p.x, y: n.p.y };
        setS(e, k);
      }
      break;
    }
    case 'netted':
      if (e.netT <= 0) setS(e, 'walk');
      if (n.p) touch(sim, e, n.p, 0.5);
      break;
    case 'dashwind':
      if (e.st === 1) { const a = angTo(e, e.tgt || n.p || e); e.chg = { ang: a, left: C.dashLen }; e.face = a; area(sim, e, { shape: 'line', x: r0(e.x), y: r0(e.y), ang: a2(a), len: wallLen(sim, e.x, e.y, a, C.dashLen, C.dashW), w: C.dashW, delay: C.dashWind, dmg: e.dmg * 1.35, kb: 360 }); emit(sim, 'bossWind', { id: e.id, x: r0(e.x), y: r0(e.y), a: 'dash', ang: a2(a) }); }
      if (e.st >= C.dashWind) setS(e, 'dash');
      break;
    case 'dash': {
      const Cg = e.chg || { ang: e.face, left: 0 }, step = 980 * DT, x0 = e.x, y0 = e.y;
      e.x += Math.cos(Cg.ang) * step; e.y += Math.sin(Cg.ang) * step; Cg.left -= step;
      confine(O, e); resolveCircle(sim.world, e);
      if (Cg.left <= 0 || Math.hypot(e.x - x0, e.y - y0) < step * 0.4) { cd(); setS(e, 'recover'); }
      break;
    }
    case 'toss': { // Snare Toss: a circle on every hero (+ spares round them): a short root
      if (e.st === 1) {
        const pl = heroes(sim), N = C.tossN + (enr ? 2 : 0), pts = pl.map((p) => ({ x: p.x, y: p.y }));
        while (pts.length < N && pl.length) { const p = pl[Math.floor(rng.next() * pl.length)], a = rng.next() * Math.PI * 2, r = 120 + rng.next() * 160; pts.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r }); }
        pts.forEach((q, i) => area(sim, e, { shape: 'circle', x: r0(q.x), y: r0(q.y), r: C.tossR, delay: C.tossWind + i * 6, dmg: e.dmg * 1.0, kb: 0, stun: 36, kind: 'osnare', committed: true }));
        emit(sim, 'bossWind', { id: e.id, x: r0(e.x), y: r0(e.y), a: 'toss' });
      }
      if (e.st >= C.tossWind + 10) { cd(); setS(e, 'recover'); }
      break;
    }
    case 'fan': { // Bola Fan: a cone of lines (enraged: a second, offset volley)
      const fire = (off) => { if (!n.p) return; const a0 = angTo(e, n.p), N = C.fanN; for (let i = 0; i < N; i++) { const a = a0 - C.fanArc / 2 + C.fanArc * (i / (N - 1)) + off; area(sim, e, { shape: 'line', x: r0(e.x), y: r0(e.y), ang: a2(a), len: wallLen(sim, e.x, e.y, a, C.fanLen, C.fanW), w: C.fanW, delay: C.fanWind, dmg: e.dmg * 1.05, kb: 220, kind: 'ovolley', committed: true }); } };
      if (e.st === 1) { fire(0); emit(sim, 'bossWind', { id: e.id, x: r0(e.x), y: r0(e.y), a: 'fan' }); }
      if (enr && e.st === 26) fire(C.fanArc / (C.fanN - 1) / 2);
      if (e.st >= C.fanWind + (enr ? 30 : 6)) { cd(); setS(e, 'recover'); }
      break;
    }
    case 'ringtrap': // Caltrop Ring: a donut round it (hug it or get out)
      if (e.st === 1) { area(sim, e, { shape: 'donut', x: r0(e.x), y: r0(e.y), r0: C.ringTrapR0, r: C.ringTrapR, delay: C.ringTrapWind, dmg: e.dmg * 1.2, kb: 240, kind: 'odonut', committed: true }); emit(sim, 'bossWind', { id: e.id, x: r0(e.x), y: r0(e.y), a: 'caltrops' }); }
      if (e.st >= C.ringTrapWind) { cd(); setS(e, 'recover'); }
      break;
    case 'smoke': { // Smoke Swap: it blinks to another spot of the ring, 2 decoys appear (it can still be hit throughout)
      if (e.st === 1) emit(sim, 'smoke', { id: e.id, x: r0(e.x), y: r0(e.y) });
      if (e.st === 20) {
        const a0 = rng.next() * Math.PI * 2, spots = [0, 1, 2].map((i) => ringSpot(O, a0 + i * Math.PI * 2 / 3)), me = Math.floor(rng.next() * 3), fx = e.x, fy = e.y;
        e.x = e.px = spots[me].x; e.y = e.py = spots[me].y;
        const others = spots.filter((_, i) => i !== me);
        H.decoys(sim, O, e, others, true);
        emit(sim, 'smokeSwap', { id: e.id, x: r0(fx), y: r0(fy), pts: spots.map((q) => [q.x, q.y]) });
        e.smokeCd = C.smokeEvery; cd(); setS(e, 'recover');
      }
      break;
    }
    case 'recover':
      if (e.st >= (enr ? 14 : 24)) setS(e, 'walk');
      break;
  }
  if (e.state === 'walk' || e.state === 'recover') { if (++e.prT >= OPS.capture.printEvery * 2) { e.prT = 0; H.print(sim, O, e); } }
  confine(O, e); resolveCircle(sim.world, e);
}
