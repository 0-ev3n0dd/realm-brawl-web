// Missions revamp, part 2: the Mobile Defense + Assault set-piece AI (sim/ops.js updateOpsAi dispatches by e.opsAi).
//  WAYLAYER (Mobile Defense, the final point): the biome's boss comes for the carrier. Gore Charge (a telegraphed line
//    run; through the carrier it rams it), Twin Quake (an inner ring, then the outer donut: stay out, then step in),
//    Pounce (a leap onto a hero's spot), and HIJACK: it runs to the carrier and drains it for 5.5 s. Deal 3.5% of its
//    max HP (or stun it) to break the drain (it staggers); if it finishes, the carrier takes a big hit + an overload blast.
//    Calls a pack at 62% / 30%, enrages under 35%.
//  CHAMPION (Assault, room 3): an elite duelist. Cleave (a wide cone; enraged: a second one), Leap Slam, Whirlwind (a
//    pulsing ring that follows it, from 50%), War Cry at 50% (calls guards). The trap hall's plates hurt it too.
//  GATEKEEPER (Assault, the sanctum): Hammer Combo (three slams that chase a hero), Ripple Quake (rings rolling outward:
//    stand where the last one fired), Sweeping Beams (a fan of lines firing one after another across an arc), Rune Cross
//    (a + of beams, then an x; enraged a third +), Battering Charge. Wardens join at 66% / 33%; enrages under 35%.
//  PYLON (Assault, the courtyard): a shield pylon. Rooted; fires a 3-orb spread at the nearest hero. All down = gate 1 drops.
// No invulnerable phases (lengths come from HP; sim/opsconst.js OPS.way / OPS.assault). Every attack is telegraphed.
import { DT } from './constants.js';
import { OPS, inArenaFloor } from './opsconst.js';
import { spawnProjectile } from './combat.js';
import { resolveCircle } from './world.js';
import { pre, touch, area, nearest, moveA, setS } from './opsboss.js';

const TAU = Math.PI * 2;
/** a beam from (x, y) along `ang` stops at the arena wall (its telegraph and its hit both end there, never past the walls) */
export function wallLen(sim, x, y, ang, len, w = 0) {
  const A = sim.ops && sim.ops.A; if (!A) return len;
  const c = Math.cos(ang), s = Math.sin(ang), hx = -s * w / 2, hy = c * w / 2; // (the band's two long edges stop at the wall too)
  const ok = (d) => inArenaFloor(A, x + c * d, y + s * d, -12) && (!w || (inArenaFloor(A, x + c * d + hx, y + s * d + hy, -4) && inArenaFloor(A, x + c * d - hx, y + s * d - hy, -4)));
  for (let d = 16; d < len; d += 16) if (!ok(d)) return Math.max(60, d - 8);
  return len;
}
const r0 = (v) => Math.round(v);
const a2 = (v) => Math.round(v * 100) / 100;
const emit = (sim, ph, o = {}) => { const O = sim.ops; sim.emit({ type: 'ops', ph, k: O ? O.type : '', b: O ? O.biome : '', ...o }); };
const angTo = (e, t) => Math.atan2(t.y - e.y, t.x - e.x);

/** a telegraphed charge run (shared): wind-up line, then the dash; onStep(e) each dash tick */
function chargeStep(sim, e, A, onStep) {
  const C = e.chg || { ang: e.face, left: 0 }, step = 940 * DT, x0 = e.x, y0 = e.y;
  e.x += Math.cos(C.ang) * step; e.y += Math.sin(C.ang) * step; C.left -= step;
  const hit = resolveCircle(sim.world, e), moved = Math.hypot(e.x - x0, e.y - y0);
  if (onStep) onStep(e, C);
  return C.left <= 0 || (hit && moved < step * 0.4);
}

// ------------------------------------------------------------------ Mobile Defense: the Waylayer
export function wayAi(sim, e, H) {
  const O = sim.ops; if (pre(sim, e)) return;
  if (!O || O.type !== 'mobile' || O.st !== 'run') { resolveCircle(sim.world, e); return; }
  const W = OPS.way, C = O.cart, n = nearest(sim, e), enr = e.hp < e.maxHp * W.enrage, rng = O.rng;
  e.st++; if (e.cd > 0) e.cd--; if (e.drainCd > 0) e.drainCd--;
  const calls = W.callAt.filter((k) => e.hp < e.maxHp * k).length;
  if (calls > (e.calls | 0)) { e.calls = calls; H.call(sim, O, e); }
  const cd = () => { e.cd = enr ? W.cdEnr : W.cd; };
  const dC = Math.hypot(C.x - e.x, C.y - e.y), reachC = OPS.mobile.cartR + e.r + 24;
  switch (e.state) {
    case 'walk': default: {
      if (e.state !== 'walk') setS(e, 'walk');
      if (n.p) { e.face = angTo(e, n.p); if (n.d > e.r + n.p.r + 26) moveA(e, e.face, e.spd * (enr ? 1.2 : 1)); touch(sim, e, n.p, 0.7); }
      if (e.cd <= 0 && n.p) {
        const r = rng.next();
        if (!(e.drainCd > 0) && e.hp < e.maxHp * 0.93) {
          if (dC < 420) setS(e, 'drainrun');
          else { const a = Math.atan2(e.y - C.y, e.x - C.x); e.tgt = { x: C.x + Math.cos(a) * (reachC + 6), y: C.y + Math.sin(a) * (reachC + 6) }; e.leapDrain = 1; setS(e, 'leapwind'); } // (far off: it pounces onto the carrier, then drains)
        }
        else if (n.d < W.quakeR + 60 && r < 0.5) setS(e, 'quake');
        else if (n.d < 760 && r < 0.78) { e.tgt = { x: n.p.x, y: n.p.y }; setS(e, 'chargewind'); }
        else { e.tgt = { x: n.p.x, y: n.p.y }; setS(e, 'leapwind'); }
      }
      break;
    }
    case 'quake':
      if (e.st === 1) {
        area(sim, e, { shape: 'circle', x: r0(e.x), y: r0(e.y), r: W.quakeR, delay: W.quakeWind, dmg: e.dmg * 1.3, kb: 320, kind: 'oslam', committed: true });
        area(sim, e, { shape: 'donut', x: r0(e.x), y: r0(e.y), r0: W.quakeR - 10, r: W.quakeR2 + (enr ? 60 : 0), delay: W.quakeWind2, dmg: e.dmg * 1.1, kb: 260, kind: 'odonut', committed: true });
        emit(sim, 'bossWind', { id: e.id, x: r0(e.x), y: r0(e.y), a: 'quake' });
      }
      if (e.st >= W.quakeWind2) { cd(); setS(e, 'recover'); }
      break;
    case 'chargewind':
      if (e.st === 1) { const a = angTo(e, e.tgt || n.p || C); e.chg = { ang: a, left: W.chargeLen, cart: 0 }; e.face = a; area(sim, e, { shape: 'line', x: r0(e.x), y: r0(e.y), ang: a, len: wallLen(sim, e.x, e.y, a, W.chargeLen, W.chargeW), w: W.chargeW, delay: W.chargeWind, dmg: e.dmg * 1.4, kb: 420 }); emit(sim, 'bossWind', { id: e.id, x: r0(e.x), y: r0(e.y), a: 'charge', ang: a2(a) }); }
      if (e.st >= W.chargeWind) setS(e, 'charge');
      break;
    case 'charge':
      if (chargeStep(sim, e, O.A, (b, Cg) => { if (!Cg.cart && Math.hypot(C.x - b.x, C.y - b.y) < reachC) { Cg.cart = 1; H.hurtCart(sim, O, W.chargeCart, true); emit(sim, 'cartRam', { x: r0(C.x), y: r0(C.y) }); } })) { cd(); setS(e, 'recover'); }
      break;
    case 'leapwind':
      if (e.st === 1) { const t = e.tgt || n.p || C; e.tgt = { x: r0(t.x), y: r0(t.y) }; area(sim, e, { shape: 'circle', x: e.tgt.x, y: e.tgt.y, r: 165, delay: 56, dmg: e.dmg * 1.35, kb: 300, kind: 'oslam', committed: true }); emit(sim, 'bossWind', { id: e.id, x: e.tgt.x, y: e.tgt.y, a: 'leap' }); }
      if (e.st >= 56) {
        const fx = e.x, fy = e.y; e.x = e.tgt.x; e.y = e.tgt.y; resolveCircle(sim.world, e); e.px = e.x; e.py = e.y; emit(sim, 'bossLeap', { id: e.id, x: r0(fx), y: r0(fy), x2: r0(e.x), y2: r0(e.y) });
        if (e.leapDrain) { e.leapDrain = 0; setS(e, 'drain'); e.drain = { hp0: e.hp }; emit(sim, 'drain', { id: e.id, x: r0(C.x), y: r0(C.y), t: W.drainT }); } else { cd(); setS(e, 'recover'); }
      }
      break;
    case 'drainrun':
      e.face = angTo(e, C); moveA(e, e.face, e.spd * 1.7);
      if (dC < reachC + 20) { setS(e, 'drain'); e.drain = { hp0: e.hp }; emit(sim, 'drain', { id: e.id, x: r0(C.x), y: r0(C.y), t: W.drainT }); }
      else if (e.st > 240) { e.drainCd = W.drainEvery; cd(); setS(e, 'walk'); }
      break;
    case 'drain': {
      e.face = angTo(e, C);
      H.hurtCart(sim, O, W.drainDps * DT, false);
      if (n.p) touch(sim, e, n.p, 0.5);
      const dealt = (e.drain ? e.drain.hp0 : e.hp) - e.hp;
      e.drainK = Math.min(1, dealt / (e.maxHp * W.drainBreak));
      if (e.drainK >= 1) { e.cc.stun = Math.max(e.cc.stun, W.drainStun); e.drainCd = W.drainEvery; e.breaks = (e.breaks | 0) + 1; emit(sim, 'drainBreak', { id: e.id, x: r0(e.x), y: r0(e.y) }); cd(); setS(e, 'recover'); e.drainK = 0; break; }
      if (e.st >= W.drainT) {
        H.hurtCart(sim, O, W.drainEnd, true); e.drainCd = W.drainEvery; e.drainK = 0;
        area(sim, e, { shape: 'circle', x: r0(C.x), y: r0(C.y), r: 230, delay: 24, dmg: e.dmg * 1.2, kb: 380, kind: 'oslam', committed: true });
        emit(sim, 'drainDone', { id: e.id, x: r0(C.x), y: r0(C.y) }); cd(); setS(e, 'recover');
      }
      break;
    }
    case 'recover':
      if (e.st >= (enr ? 16 : 28)) setS(e, 'walk');
      break;
  }
  resolveCircle(sim.world, e);
}

// ------------------------------------------------------------------ Assault: the champion
export function champAi(sim, e, H) {
  const O = sim.ops; if (pre(sim, e)) return;
  if (!O || O.type !== 'assault' || O.st !== 'run') { resolveCircle(sim.world, e); return; }
  const S = OPS.champ, n = nearest(sim, e), enr = e.hp < e.maxHp * S.enrage, rng = O.rng;
  e.st++; if (e.cd > 0) e.cd--;
  const cd = () => { e.cd = enr ? S.cdEnr : S.cd; };
  if (enr && !e.cried && e.state !== 'roar') { e.cried = 1; setS(e, 'roar'); }
  switch (e.state) {
    case 'walk': default: {
      if (e.state !== 'walk') setS(e, 'walk');
      if (!n.p || !e.aggroId) { e.state = 'walk'; break; } // (waits in its ring until the party comes)
      e.face = angTo(e, n.p); if (n.d > e.r + n.p.r + 20) moveA(e, e.face, e.spd * (enr ? 1.15 : 1)); touch(sim, e, n.p, 0.75);
      if (e.cd <= 0) {
        const r = rng.next();
        if (enr && (r < 0.3 || !e.whN)) { e.whN = (e.whN | 0) + 1; setS(e, 'whirl'); } // (the first attack after the War Cry is always the Whirlwind)
        else if (n.d < S.cleaveR + 30 && r < 0.75) setS(e, 'cleave');
        else if (n.d < 700) { e.tgt = { x: r0(n.p.x), y: r0(n.p.y) }; setS(e, 'leapwind'); }
      }
      break;
    }
    case 'cleave':
      if (e.st === 1 && n.p) { e.face = angTo(e, n.p); area(sim, e, { shape: 'cone', x: r0(e.x), y: r0(e.y), ang: a2(e.face), arc: S.cleaveArc, r: S.cleaveR, delay: S.cleaveWind, dmg: e.dmg * 1.25, kb: 280 }); emit(sim, 'bossWind', { id: e.id, x: r0(e.x), y: r0(e.y), a: 'cleave', ang: a2(e.face) }); }
      if (enr && e.st === S.cleaveWind + 8 && n.p) { const a = angTo(e, n.p); e.face = a; area(sim, e, { shape: 'cone', x: r0(e.x), y: r0(e.y), ang: a2(a), arc: S.cleaveArc, r: S.cleaveR + 20, delay: 30, dmg: e.dmg * 1.15, kb: 280, committed: true }); }
      if (e.st >= S.cleaveWind + (enr ? 40 : 6)) { cd(); setS(e, 'recover'); }
      break;
    case 'leapwind':
      if (e.st === 1) { area(sim, e, { shape: 'circle', x: e.tgt.x, y: e.tgt.y, r: S.leapR, delay: S.leapWind, dmg: e.dmg * 1.35, kb: 320, kind: 'oslam', committed: true }); emit(sim, 'bossWind', { id: e.id, x: e.tgt.x, y: e.tgt.y, a: 'leap' }); }
      if (e.st >= S.leapWind) { const fx = e.x, fy = e.y; e.x = e.tgt.x; e.y = e.tgt.y; resolveCircle(sim.world, e); e.px = e.x; e.py = e.y; emit(sim, 'bossLeap', { id: e.id, x: r0(fx), y: r0(fy), x2: r0(e.x), y2: r0(e.y) }); cd(); setS(e, 'recover'); }
      break;
    case 'whirl':
      if (e.st === 1) { area(sim, e, { shape: 'circle', x: r0(e.x), y: r0(e.y), r: S.whirlR, delay: 40, pulses: S.whirlN, every: S.whirlEvery, dmg: e.dmg * 0.6, kb: 200, kind: 'owhirl', follow: e.id, committed: true }); emit(sim, 'bossWind', { id: e.id, x: r0(e.x), y: r0(e.y), a: 'whirl' }); }
      if (n.p && e.st > 30) { e.face = angTo(e, n.p); moveA(e, e.face, e.spd * 0.55); }
      if (e.st >= 40 + S.whirlN * S.whirlEvery) { cd(); setS(e, 'recover'); }
      break;
    case 'roar':
      if (e.st === 1) emit(sim, 'champCry', { id: e.id, x: r0(e.x), y: r0(e.y) });
      if (e.st === 30) H.cry(sim, O, e);
      if (e.st >= 44) { cd(); setS(e, 'walk'); }
      break;
    case 'recover':
      if (e.st >= (enr ? 14 : 22)) setS(e, 'walk');
      break;
  }
  resolveCircle(sim.world, e);
}

// ------------------------------------------------------------------ Assault: the Gatekeeper
export function gkAi(sim, e, H) {
  const O = sim.ops; if (pre(sim, e)) return;
  if (!O || O.type !== 'assault' || O.st !== 'run') { resolveCircle(sim.world, e); return; }
  const G = OPS.gk, n = nearest(sim, e), enr = e.hp < e.maxHp * G.enrage, rng = O.rng;
  e.st++; if (e.cd > 0) e.cd--;
  const adds = G.addsAt.filter((k) => e.hp < e.maxHp * k).length;
  if (adds > (e.adds | 0)) { e.adds = adds; H.adds(sim, O, e); }
  const cd = () => { e.cd = enr ? G.cdEnr : G.cd; };
  const pick = (list) => { const L = list.filter((k) => k !== e.last); const k = L[Math.floor(rng.next() * L.length)] || list[0]; e.last = k; return k; };
  switch (e.state) {
    case 'walk': default: {
      if (e.state !== 'walk') setS(e, 'walk');
      if (!n.p) break;
      e.face = angTo(e, n.p); if (n.d > e.r + n.p.r + 20) moveA(e, e.face, e.spd * (enr ? 1.2 : 1)); touch(sim, e, n.p, 0.75);
      if (e.cd <= 0) {
        const k = n.d < 300 ? pick(['smash', 'quake', 'fan', 'lines']) : pick(['fan', 'lines', 'chargewind', 'smash']);
        if (k === 'chargewind') e.tgt = { x: n.p.x, y: n.p.y };
        setS(e, k);
      }
      break;
    }
    case 'smash': { // Hammer Combo: 3 slams chasing a hero
      const i = Math.floor((e.st - 1) / G.smashGap);
      if ((e.st - 1) % G.smashGap === 0 && i < 3 + (enr ? 1 : 0) && n.p) { area(sim, e, { shape: 'circle', x: r0(n.p.x), y: r0(n.p.y), r: G.smashR, delay: G.smashWind, dmg: e.dmg * 1.2, kb: 240, kind: 'oslam', committed: true }); if (i === 0) emit(sim, 'bossWind', { id: e.id, x: r0(e.x), y: r0(e.y), a: 'smash' }); }
      if (e.st >= G.smashGap * (3 + (enr ? 1 : 0)) + G.smashWind - G.smashGap) { cd(); setS(e, 'recover'); }
      break;
    }
    case 'quake': { // Ripple Quake: rings rolling outward
      const N = G.quakeN + (enr ? 1 : 0);
      if (e.st === 1) { for (let i = 0; i < N; i++) area(sim, e, i === 0 ? { shape: 'circle', x: r0(e.x), y: r0(e.y), r: G.quakeStep, delay: G.quakeWind, dmg: e.dmg * 1.15, kb: 260, kind: 'oslam', committed: true } : { shape: 'donut', x: r0(e.x), y: r0(e.y), r0: i * G.quakeStep, r: (i + 1) * G.quakeStep, delay: G.quakeWind + i * G.quakeGap, dmg: e.dmg * 1.05, kb: 240, kind: 'odonut', committed: true }); emit(sim, 'bossWind', { id: e.id, x: r0(e.x), y: r0(e.y), a: 'quake' }); }
      if (e.st >= G.quakeWind + (N - 1) * G.quakeGap) { cd(); setS(e, 'recover'); }
      break;
    }
    case 'fan': { // Sweeping Beams: lines firing one after another across an arc (outrun the sweep or get behind it)
      const N = G.sweepN + (enr ? 2 : 0);
      if (e.st === 1 && n.p) {
        const a0 = angTo(e, n.p), dir = rng.next() < 0.5 ? -1 : 1, arc = G.sweepArc + (enr ? 0.5 : 0);
        for (let i = 0; i < N; i++) { const a = a0 - dir * arc / 2 + dir * arc * (i / (N - 1)); area(sim, e, { shape: 'line', x: r0(e.x), y: r0(e.y), ang: a2(a), len: wallLen(sim, e.x, e.y, a, G.sweepLen, G.sweepW), w: G.sweepW, delay: G.sweepWind + i * G.sweepGap, dmg: e.dmg * 1.05, kb: 220, kind: 'obeam', committed: true }); }
        emit(sim, 'bossWind', { id: e.id, x: r0(e.x), y: r0(e.y), a: 'fan', ang: a2(a0) });
      }
      if (e.st >= G.sweepWind + (N - 1) * G.sweepGap + 4) { cd(); setS(e, 'recover'); }
      break;
    }
    case 'lines': { // Rune Cross: a + of beams, then an x (enraged: + again)
      const W = enr ? 3 : 2;
      if (e.st === 1) {
        const a0 = rng.next() * Math.PI;
        for (let w = 0; w < W; w++) for (let i = 0; i < 4; i++) { const a = a0 + (w % 2) * Math.PI / 4 + i * Math.PI / 2; area(sim, e, { shape: 'line', x: r0(e.x), y: r0(e.y), ang: a2(a), len: wallLen(sim, e.x, e.y, a, G.runeLen, G.runeW), w: G.runeW, delay: G.runeWind + w * G.runeGap, dmg: e.dmg * 1.1, kb: 240, kind: 'orune', committed: true }); }
        emit(sim, 'bossWind', { id: e.id, x: r0(e.x), y: r0(e.y), a: 'rune' });
      }
      if (e.st >= G.runeWind + (W - 1) * G.runeGap + 4) { cd(); setS(e, 'recover'); }
      break;
    }
    case 'chargewind':
      if (e.st === 1) { const a = angTo(e, e.tgt || n.p || e); e.chg = { ang: a, left: G.chargeLen }; e.face = a; area(sim, e, { shape: 'line', x: r0(e.x), y: r0(e.y), ang: a, len: wallLen(sim, e.x, e.y, a, G.chargeLen, G.chargeW), w: G.chargeW, delay: G.chargeWind, dmg: e.dmg * 1.35, kb: 420 }); emit(sim, 'bossWind', { id: e.id, x: r0(e.x), y: r0(e.y), a: 'charge', ang: a2(a) }); }
      if (e.st >= G.chargeWind) setS(e, 'charge');
      break;
    case 'charge':
      if (chargeStep(sim, e, O.A)) { cd(); setS(e, 'recover'); }
      break;
    case 'recover':
      if (e.st >= (enr ? 14 : 24)) setS(e, 'walk');
      break;
  }
  resolveCircle(sim.world, e);
}

// ------------------------------------------------------------------ Assault: a shield pylon
export function pylonAi(sim, e) {
  const O = sim.ops; if (pre(sim, e)) { e.x = e.homeX; e.y = e.homeY; return; }
  e.x = e.homeX; e.y = e.homeY; e.vx = e.vy = 0;
  if (!O || O.type !== 'assault' || O.st !== 'run') return;
  const P = OPS.assault, n = nearest(sim, e);
  e.st++; if (e.cd > 0) e.cd--;
  if (e.state === 'cast' && e.st > 24) setS(e, 'idle');
  if (e.cd <= 0 && n.p && n.d < P.pylonR) {
    const a = angTo(e, n.p);
    for (const k of [-1, 0, 1]) { const b = a + k * 0.2; spawnProjectile(sim, { team: 'enemy', ownerId: e.id, x: e.x + Math.cos(b) * e.r, y: e.y - 30 + Math.sin(b) * e.r, vx: Math.cos(b) * 330, vy: Math.sin(b) * 330, r: 10, life: 140, dmg: e.dmg, style: 'orb', color: '#ff6a5a', kb: 90, by: e.name }); }
    e.cd = P.pylonEvery; setS(e, 'cast');
    emit(sim, 'pylonShot', { id: e.id, x: r0(e.x), y: r0(e.y), ang: a2(a) });
  }
}
