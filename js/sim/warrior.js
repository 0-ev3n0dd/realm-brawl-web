// Warrior: WEAPON MASTER + WARLORD, in the shared class structure (Q / E / R skills + chains + a state + two ult finisher routes).
// Q = Greatsword (Sweeping Cleave, packs), E = Twin Axes (Rending Flurry, Bleed), R = Warhammer (Skullcrusher: stun, posture; it
// opens the WARPATH state). Every skill draws its weapon (the basic combo swings the drawn weapon). Weapon-to-weapon inputs are named
// chains (data/classes.js); War Cry, Challenge and Rally are chain payoffs. Glory (the resource) is built by hits, chains and the
// TRINITY (hits with all three weapons in one rotation); the two Warpath 3-step chains and the finishers spend all of it.
// Pure sim code. Everything that changes enemies (damage, Bleed, taunts, marks) runs only in the authoritative sim.
import { CLASSES } from './data/classes.js';
import { DT, secs } from './constants.js';
import { pointBlocked, clearPath } from './world.js';
import { hitEnemy, hitEnemiesInShape, healPlayer, ULT } from './combat.js';
import { targetsOf, leapTo, leapTick, dragIn } from './player.js';
import { addStacks, takeStacks, stackN, endUltWindow } from './kit.js';

export const WAR_KEYS = ['Q', 'E', 'R'];
/** Kept for kit.js (legacy helpers). */
export const WSTR = { minRush: 40, drift: 0.45, holdR: 1.2, holdUp: 15 };
/** Weapon Master tuning. */
export const WM = {
  bleedEvery: 30,      // Bleed ticks every 0.5 s ...
  bleedMul: 0.12,      // ... for x0.12 ATK per stack
  trinityHeal: 0.04,   // a Trinity heals 4% max HP
  ultGlory: 60,        // the ult slam grants 60 Glory
  finGlory: 1.2,       // the finishers scale with Glory (kept, not spent): up to +120% damage at 100
  allyEvery: 20,       // Challenge: allies' hits give you Glory at most every 20 ticks
  cry: { r: 360, taunt: 180, def: 0.3, dur: 240 },
  chal: { dur: 480, dmg: 0.2 },
  rally: { r: 480, dmg: 0.2, spd: 0.2, def: 0.15, dur: 360, heal: 0.08 },
};
export const STANCES = ['G', 'A', 'H'];
export const BIT = { G: 1, A: 2, H: 4 };
/** Old stance keys (removed). Kept so old inputs / saved binds are ignored cleanly. */
export const isSwapKey = (k) => k === 'S1' || k === 'S2' || k === 'S3' || k === 'SN';
const R0 = (v) => Math.round(v);
const r2 = (v) => Math.round(v * 100) / 100;
const bits = (n) => (n & 1) + ((n >> 1) & 1) + ((n >> 2) & 1);
const isWm = (p) => !!(p && p.wm && CLASSES[p.cls] && CLASSES[p.cls].arms);

// ------------------------------------------------------------------ aim helpers (also used by kit.js)
export const aimDist = (p, a) => Math.hypot(a.data.tx - p.x, a.data.ty - p.y);
/** The first enemy whose body crosses the line from p along `ang` within `maxD`: { e, d } (d = distance to stop in front of it). */
export function firstInLine(sim, p, ang, maxD, pad = 6) {
  const cx = Math.cos(ang), cy = Math.sin(ang);
  let best = null, bd = Infinity;
  for (const e of targetsOf(sim)) {
    if (e.dead) continue;
    const dx = e.x - p.x, dy = e.y - p.y, along = dx * cx + dy * cy, side = Math.abs(dx * cy - dy * cx);
    if (along < -e.r || along > maxD + e.r || side > e.r + p.r) continue;
    const stop = Math.max(0, along - Math.sqrt(Math.max(0, (e.r + p.r) ** 2 - side * side)) - pad);
    if (stop < bd) { bd = stop; best = e; }
  }
  return best ? { e: best, d: bd } : null;
}
export function travelFor(sim, p, a, range) {
  let d = Math.min(range, Math.max(WSTR.minRush, aimDist(p, a)));
  const hit = firstInLine(sim, p, a.ang, d);
  if (hit) d = Math.min(d, hit.d);
  return d;
}
/** Landing point for an aimed leap (stops in front of the first enemy, or at the aim point), stepped off walls. */
export function aimLeapPoint(sim, p, a, range) {
  const d = travelFor(sim, p, a, range);
  return offWalls(sim, p, p.x + Math.cos(a.ang) * d, p.y + Math.sin(a.ang) * d);
}
function offWalls(sim, p, lx, ly) {
  ({ x: lx, y: ly } = clearPath(sim.world, p.x, p.y, lx, ly, p.r)); // (swept: never tunnels through walls / props)
  return { x: lx, y: ly };
}
/** A moving spin with no movement input drifts toward the aim point. */
export function spinDrift(p, a, k) {
  const m = Math.hypot(p.input.mx || 0, p.input.my || 0);
  if (m > 0.1) return;
  const dx = p.input.ax - p.x, dy = p.input.ay - p.y, dd = Math.hypot(dx, dy);
  if (dd < 50) return;
  const sp = 220 * (p.stats.spd || 1) * k * DT;
  p.x += (dx / dd) * sp; p.y += (dy / dd) * sp;
}

// ------------------------------------------------------------------ state
export function initWm(p) {
  p.wm = { st: 'G', tri: 0, ct: 0, tcd: 0, surge: 0, n: 0, allyT: -99 };
}
/** The drawn weapon ('G' / 'A' / 'H'). */
export const stanceOf = (p) => (p.wm ? p.wm.st : 'G');
/** The weapon a skill key draws. */
export const weaponOfKey = (k) => ({ Q: 'G', E: 'A', R: 'H' }[k] || null);
export function basicsOf(p) { const C = CLASSES[p.cls]; return C.arms && p.wm ? C.weapons[p.wm.st].basic : C.basic; }

/** Glory gain (gear: Glory Gain). Authoritative sim only. */
export function gainGlory(sim, p, n, why = null) {
  if (sim.predicting || !(n > 0) || !CLASSES[p.cls].gloryRes) return 0;
  const before = p.res;
  p.res = Math.min(p.stats.maxRes, p.res + n * (1 + (p.stats.gloryGain || 0)));
  const got = p.res - before;
  if (why && got >= 1) sim.emit({ type: 'wmx', ph: 'glory', pid: p.id, n: R0(got), why, x: R0(p.x), y: R0(p.y - 56) });
  return got;
}

/** Per tick: Trinity timers, Glory drain, Bleed, shout buffs. */
export function tickWarrior(sim, p) {
  tickBuffs(p);
  const W = p.wm;
  if (!isWm(p)) return;
  const C = CLASSES[p.cls];
  if (W.tcd > 0) W.tcd--;
  if (W.surge > 0) W.surge--;
  if (W.ct > 0 && --W.ct <= 0) W.tri = 0; // the rotation broke: the tracker empties
  if (!sim.predicting) {
    if (p.res > 0 && !p.uw && sim.tick - (p.lastCombat || 0) > C.glory.drainAfter) p.res = Math.max(0, p.res - C.glory.drain * DT);
    if (sim.tick % WM.bleedEvery === 0) bleedTick(sim, p);
    if (W.pl) plantPulse(sim, p, W.pl); // the planted weapon works on its own
  }
  if (W.pl && --W.pl.t <= 0) { sim.emit({ type: 'wm', ph: 'unplant', pid: p.id, x: R0(W.pl.x), y: R0(W.pl.y) }); W.pl = null; if (p.cds.F < 90) p.cds.F = 90; }
}
/** Shout buffs (any class: Rally reaches co-op allies). */
export function tickBuffs(p) {
  const B = p.buf;
  if (!B) return;
  if (B.rally && --B.rally.t <= 0) B.rally = null;
  if (B.cry && --B.cry.t <= 0) B.cry = null;
  if (!B.rally && !B.cry) p.buf = null;
}
function bleedTick(sim, p) {
  for (const e of sim.enemies) {
    const b = !e.dead && e.stx && e.stx.bleed;
    if (!b || b.pid !== p.id || !(b.t > 0)) continue;
    hitEnemy(sim, p, e, { mul: WM.bleedMul * b.n, dot: true, clone: true, hitstop: 0, noPop: true, style: 'bleed', resGain: 0 });
  }
}
/** Damage taken multiplier (War Cry / Rally defense). */
export function wmHurtMul(p) {
  const B = p.buf;
  if (!B) return 1;
  let m = 1;
  if (B.cry) m *= 1 - B.cry.def;
  if (B.rally) m *= 1 - B.rally.def;
  return m;
}
export const wmSpeedMul = (p) => (p.buf && p.buf.rally ? 1 + p.buf.rally.spd : 1);

/** Damage modifiers inside hitEnemy (any attacker: Challenge mark + Rally; the Warrior's own: Trinity Surge, vs-CC / vs-Bleed
 *  bonuses and Bleed detonations). Returns { add (extra ATK multiplier), m (damage multiplier) }. */
export function wmHitMul(sim, p, e, o) {
  let add = 0, m = 1;
  const ch = e.stx && e.stx.chal;
  if (ch && ch.t > 0) {
    m *= 1 + (ch.dmg || 0.2);
    if (ch.pid !== p.id && !o.dot && !sim.predicting) { // an ally hit your Challenged enemy: Glory for you
      const w = sim.players.get(ch.pid);
      if (w && isWm(w) && sim.tick - w.wm.allyT >= WM.allyEvery) { w.wm.allyT = sim.tick; gainGlory(sim, w, CLASSES[w.cls].glory.ally); }
    }
  }
  if (p.buf && p.buf.rally && !o.dot) m *= 1 + p.buf.rally.dmg;
  if (!isWm(p)) return { add, m };
  if (p.wm.surge > 0 && !o.dot) m *= CLASSES[p.cls].trinity.surgeMul;
  if (o.vsCC && (e.cc.stun > 0 || e.cc.down > 0 || (ch && ch.t > 0 && o.chalCC))) m *= 1 + o.vsCC;
  if (o.vsBleed && stackN(e, 'bleed', p.id) >= (o.bleedAt || 1)) m *= 1 + o.vsBleed;
  if (o.bleedPop && !sim.predicting) {
    const n = o.bleedPop.keep ? stackN(e, 'bleed', p.id) : takeStacks(sim, p, e, 'bleed');
    if (n) { add += n * o.bleedPop.per; sim.emit({ type: 'wmx', ph: 'pop', pid: p.id, id: e.id, x: R0(e.x), y: R0(e.y), n, r: e.r, keep: o.bleedPop.keep ? 1 : undefined }); }
  }
  return { add, m };
}

/** After a Warrior hit lands (authoritative): Glory and the Trinity tracker. */
export function wmOnHit(sim, p, e, o) {
  if (sim.predicting || o.dot || !isWm(p)) return;
  const C = CLASSES[p.cls], G = C.glory, W = p.wm, act = p.action;
  let g = 0;
  if (!o.ult) {
    if (o.basic) g += G.basic;
    else if (act && act.kind === 'skill') { const add = Math.min(G.skill, G.skillCap - (act.gl || 0)); if (add > 0) { act.gl = (act.gl || 0) + add; g += add; } }
    if (o.wchain && act && !act.chG) { act.chG = 1; g += G.chain; }
    const ch = e.stx && e.stx.chal;
    if (ch && ch.pid === p.id && ch.t > 0 && (!act || (act.chM || 0) < G.markCap)) { if (act) act.chM = (act.chM || 0) + G.mark; g += G.mark; }
  }
  if (g) gainGlory(sim, p, g);
  if (o.ult && !o.wmw) return; // the ult slam doesn't feed the tracker
  if (o.noTri) return; // (a planted weapon's own pulses don't tick the Trinity: only your toss / recall do)
  comboHit(sim, p, o.wmw || W.st, e);
}
function comboHit(sim, p, w, e) {
  const W = p.wm, C = CLASSES[p.cls], T = C.trinity, bit = BIT[w] || 1;
  W.ct = T.gap;
  if (W.tri & bit) return;
  W.tri |= bit;
  const n = bits(W.tri);
  if (n === 2) gainGlory(sim, p, C.glory.second);
  if (n === 3) {
    if (W.tcd <= 0) trinity(sim, p, e);
    W.tri = bit; // start counting the next Trinity from this weapon
  }
  sim.emit({ type: 'wmx', ph: 'tri', pid: p.id, w, tri: W.tri });
}
function trinity(sim, p) {
  const W = p.wm, C = CLASSES[p.cls], T = C.trinity;
  W.tcd = T.trinityCd; W.surge = T.surge; W.n++;
  gainGlory(sim, p, C.glory.trinity, 'trinity');
  for (const k in p.cds) if (k !== 'SP') p.cds[k] = Math.round(p.cds[k] * (1 - T.cdCut));
  if (!p.uw && !p.eclipse && p.ult < ULT.max) { const b = p.ult; p.ult = Math.min(ULT.max, p.ult + T.ult); p.ultGained = (p.ultGained || 0) + (p.ult - b); sim.emit({ type: 'ultGain', pid: p.id, x: p.x, y: p.y - 44, amount: T.ult, bonus: T.ult, trinity: 1, chain: null, full: p.ult >= ULT.max }); } // (a Trinity is the Warrior's rotation bonus)
  healPlayer(sim, p, p.stats.maxHp * WM.trinityHeal, p);
  sim.emit({ type: 'wmx', ph: 'trinity', pid: p.id, x: R0(p.x), y: R0(p.y), n: W.n });
}

// ------------------------------------------------------------------ casts (called from player.js startSkill / startUlt)
/** A Warrior skill / chain / finisher starts: draw its weapon, spend Glory on the Glory chains, tell the clients. */
export function wmCast(sim, p, a, key, chain) {
  if (!isWm(p)) return;
  const w = key === 'T' ? p.wm.st : (chain && chain.w) || weaponOfKey(key) || p.wm.st;
  const fin = !!(chain && chain.route);
  p.wm.st = w;
  a.data.wm = { w };
  if (chain && (chain.id === 'warlords_rally' || chain.id === 'executioners_verdict' || fin)) { // Glory chains spend it all; the finishers scale with it but keep it
    const k = fin ? WM.finGlory : CLASSES[p.cls].glory.spendMax;
    a.data.gm = 1 + k * Math.min(1, p.res / 100);
    if (!sim.predicting && !fin) p.res = 0;
  }
  if (fin) sim.emit({ type: 'wm', ph: 'fin', pid: p.id, id: chain.id, route: chain.route, name: chain.name, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), gm: r2(a.data.gm || 1) });
  else sim.emit({ type: 'wm', ph: 'cast', pid: p.id, id: chain ? chain.id : a.id, w, chain: chain ? 1 : undefined, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), gm: a.data.gm > 1.01 ? r2(a.data.gm) : undefined });
}

// ------------------------------------------------------------------ the HUD's view
export function wmInfo(p) {
  const W = p.wm;
  if (!W) return null;
  const C = CLASSES[p.cls];
  return { st: W.st, tri: W.tri, ct: W.ct, gap: C.trinity.gap, surge: W.surge, n: W.n };
}

// ------------------------------------------------------------------ strikes
function strikeOpts(p, a, o) {
  const d = a.data.wm || {}, w = o.wmw || d.w || stanceOf(p);
  let mul = 1;
  if (a.chain) mul *= 1 + (p.stats.chainDmg || 0); // gear: Chain Damage
  if (a.data.gm) mul *= a.data.gm;
  return { hitstop: 5, heavy: true, ...o, dmgMul: (o.dmgMul || 1) * mul, style: o.style || 'wm' + w, wmw: w, wchain: a.chain && !a.chain.route ? 1 : undefined, ult: o.ult || !!a.data.fin || undefined };
}
/** Hit a shape and tell the clients what to draw. fx: the look (see client/fxwar.js). Returns the number of enemies hit. */
function strike(sim, p, a, sh, o, fx, set = null) {
  const oo = strikeOpts(p, a, o);
  const n = sim.predicting ? 0 : hitEnemiesInShape(sim, p, sh, oo, set);
  if (n > 0 && !sim.predicting) p.hitstop = Math.max(p.hitstop, o.selfHs ?? Math.min(8, (o.hitstop ?? 5) - 1));
  sim.emit({ type: 'wm', ph: 'hit', pid: p.id, w: oo.wmw, fx, emp: a.chain || a.data.fin ? 1 : undefined, x: R0(sh.x), y: R0(sh.y), ang: r2(sh.ang ?? a.ang), r: sh.r, arc: sh.arc, len: sh.len, lw: sh.w, shape: sh.shape, n });
  return n;
}
const circ = (p, r, x = p.x, y = p.y) => ({ shape: 'circle', x, y, r });
const cone = (p, a, r, arc, ang = a.ang) => ({ shape: 'cone', x: p.x, y: p.y, ang, arc, r });
const line = (p, a, len, w, ang = a.ang, x = p.x, y = p.y) => ({ shape: 'line', x, y, ang, len, w });
const S = (k) => CLASSES.warrior.skills[k].stats;
function dash(sim, p, a, dist, T) { // straight dash (through enemies), stepped off walls
  const t = offWalls(sim, p, p.x + Math.cos(a.ang) * dist, p.y + Math.sin(a.ang) * dist);
  a.data.fx = p.x; a.data.fy = p.y; a.data.lx = t.x; a.data.ly = t.y; a.data.T = T; a.data.dd = Math.hypot(t.x - p.x, t.y - p.y);
  a.lockMove = true;
}
function leap(sim, p, a, range, T) { leapTo(sim, p, a, range, T, aimLeapPoint(sim, p, a, range)); a.lockMove = true; }
function clampAim(p, a, range) { let dx = a.data.tx - p.x, dy = a.data.ty - p.y; const d = Math.hypot(dx, dy); if (d < 1) { dx = Math.cos(a.ang); dy = Math.sin(a.ang); } else if (d > range) { dx *= range / d; dy *= range / d; } return [p.x + dx, p.y + dy]; }
/** Arsenal Toss: plant weapon `w` at (x, y) for `t` ticks (p.wm.pl). */
function plant(sim, p, w, x, y, t) {
  p.wm.pl = { w, x, y, t, k: 0 };
  const s = S('F');
  sim.emit({ type: 'wm', ph: 'plant', pid: p.id, w, x: R0(x), y: R0(y), t, r: w === 'G' ? s.cleaveR : w === 'A' ? s.bleedR : s.quakeR });
}
/** Arsenal Toss: the planted weapon acts AUTOMATICALLY (server only). Greatsword: a spectral cleave around it every
 *  cleaveEvery ticks; Twin Axes: +1 Bleed on everything near it every bleedEvery; Warhammer: a quake every quakeEvery. */
function plantPulse(sim, p, pl) {
  const s = S('F'), k = (pl.k = (pl.k || 0) + 1);
  if (pl.w === 'A') { if (k % s.bleedEvery === 0) { let n = 0; for (const e of sim.enemies) if (!e.dead && Math.hypot(e.x - pl.x, e.y - pl.y) < s.bleedR + e.r) { addStacks(sim, p, e, 'bleed', 1); n++; } sim.emit({ type: 'wmx', ph: 'pulse', pid: p.id, w: 'A', fx: 'plantbleed', x: R0(pl.x), y: R0(pl.y), r: s.bleedR, n }); } return; }
  const G = pl.w === 'G', every = G ? s.cleaveEvery : s.quakeEvery;
  if (k % every !== 0) return;
  const sh = { shape: 'circle', x: pl.x, y: pl.y, r: G ? s.cleaveR : s.quakeR };
  const o = G ? { mul: s.cleave, kb: 160, stagger: 12, hitstop: 3 } : { mul: s.quake, stagger: 40, poise: 18, knockup: 24, kb: 160, hitstop: 4 };
  const n = hitEnemiesInShape(sim, p, sh, strikeOpts(p, { data: { wm: { w: pl.w } }, chain: null }, { ...o, noTri: true, wmw: pl.w }));
  sim.emit({ type: 'wmx', ph: 'pulse', pid: p.id, w: pl.w, fx: G ? 'plantcleave' : 'quake', x: R0(pl.x), y: R0(pl.y), r: sh.r, n, auto: 1 });
}
/** Taunt: enemies target `p` for `t` ticks (ai.js). */
function taunt(e, p, t) { e.taunt = { pid: p.id, t }; }
function finTarget(sim, p, a, range) {
  let best = null, bs = Infinity;
  for (const e of targetsOf(sim)) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > range + e.r) continue;
    const ch = e.stx && e.stx.chal && e.stx.chal.pid === p.id;
    const s = Math.hypot(e.x - a.data.tx, e.y - a.data.ty) * 0.4 + d * 0.3 - (e.boss ? 900 : e.elite ? 400 : 0) - (ch ? 300 : 0);
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}
/** War Cry (Cyclone Cleave's payoff): taunt everything within r, less damage taken. */
function warCry(sim, p, R) {
  p.buf = p.buf || {}; p.buf.cry = { t: WM.cry.dur, def: WM.cry.def };
  let n = 0;
  if (!sim.predicting) for (const e of sim.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < R + e.r) { taunt(e, p, WM.cry.taunt); n++; }
  sim.emit({ type: 'wm', ph: 'shout', pid: p.id, id: 'war_cry', w: 'G', x: R0(p.x), y: R0(p.y), r: R, n });
}
/** Challenge (Thunder Hurl's payoff): mark one enemy (+20% damage from everyone, its hits feed your Glory). */
function challenge(sim, p, e) {
  if (!e || sim.predicting) return;
  for (const q of sim.enemies) if (q.stx && q.stx.chal && q.stx.chal.pid === p.id) delete q.stx.chal; // one Challenge at a time
  (e.stx || (e.stx = {})).chal = { pid: p.id, t: WM.chal.dur, n: 1, dmg: WM.chal.dmg };
  taunt(e, p, 120);
  sim.emit({ type: 'wm', ph: 'shout', pid: p.id, id: 'challenge', w: 'H', x: R0(p.x), y: R0(p.y), tx: R0(e.x), ty: R0(e.y), tid: e.id });
}
/** Rally (Warlord's Rally's payoff): buff you and every ally in range, and heal. */
function rally(sim, p) {
  const s = WM.rally;
  let n = 0;
  for (const q of sim.players.values()) {
    if (q.dead || q.decoy || Math.hypot(q.x - p.x, q.y - p.y) > s.r + q.r) continue;
    q.buf = q.buf || {}; q.buf.rally = { dmg: s.dmg, spd: s.spd, def: s.def, t: s.dur }; n++;
    healPlayer(sim, q, q.stats.maxHp * s.heal, p);
  }
  sim.emit({ type: 'wm', ph: 'shout', pid: p.id, id: 'rally', w: 'A', x: R0(p.x), y: R0(p.y), r: s.r, n });
}

// ------------------------------------------------------------------ the moves (skill / chain / finisher id -> { start, tick })
export const WAR_SKILLS = {
  // ===== G: Arsenal Toss (throw the drawn weapon: it stays PLANTED 6 s; G again recalls it in an arc) =====
  arsenal_toss: {
    start(sim, p, a) {
      const s = S('F'), W = p.wm; a.moveMul = 0.3;
      if (W.pl) { // recall: the planted weapon flies back to your hand
        const pl = W.pl; W.pl = null;
        a.data.rc = 1; a.data.fx = pl.x; a.data.fy = pl.y; a.data.wm = { w: pl.w }; W.st = pl.w; a.dur = 20; a.cancel = 12;
        sim.emit({ type: 'wm', ph: 'recall', pid: p.id, w: pl.w, x: R0(pl.x), y: R0(pl.y), tx: R0(p.x), ty: R0(p.y), T: 8 });
        return;
      }
      const t = offWalls(sim, p, ...clampAim(p, a, s.range));
      a.data.lx = t.x; a.data.ly = t.y; a.data.wm = { w: W.st }; a.dur = s.fly + 8; a.cancel = s.fly + 1; a.ang = Math.atan2(t.y - p.y, t.x - p.x); // (cancellable only after the landing tick, so a quick follow-up never eats the plant)
      sim.emit({ type: 'wm', ph: 'toss', pid: p.id, w: W.st, x: R0(p.x), y: R0(p.y), tx: R0(t.x), ty: R0(t.y), T: s.fly });
    },
    tick(sim, p, a) {
      const s = S('F'), d = a.data;
      if (d.rc) {
        if (a.t === 8) { const L = Math.hypot(p.x - d.fx, p.y - d.fy); strike(sim, p, a, line(p, a, Math.max(40, L), s.rw, Math.atan2(p.y - d.fy, p.x - d.fx), d.fx, d.fy), { mul: s.recall, kb: 160, stagger: 14, hitstop: 5 }, 'recall'); }
        return;
      }
      if (a.t !== s.fly) return;
      const w = d.wm.w;
      strike(sim, p, a, circ(p, s.r, d.lx, d.ly), { mul: s.mul, kb: 140, stagger: 16, hitstop: 6, ...(w === 'A' ? { stack: ['bleed', 1] } : w === 'H' ? { poise: 14 } : {}) }, 'toss');
      plant(sim, p, w, d.lx, d.ly, s.life);
      p.cds.F = Math.min(p.cds.F, 18); // the recall is ready almost at once
    },
  },
  // ===== Arsenal Toss chains =====
  rift_cleave: { // G -> Q: dash through to the planted weapon, cleave a rift around it
    start(sim, p, a) {
      const pl = p.wm && p.wm.pl, near = pl && Math.hypot(pl.x - p.x, pl.y - p.y) < 420;
      if (near) a.ang = Math.atan2(pl.y - p.y, pl.x - p.x);
      const D = near ? Math.max(0, Math.hypot(pl.x - p.x, pl.y - p.y) - 30) : 200;
      dash(sim, p, a, D, 8); a.dur = 30; a.cancel = 22; p.iframes = Math.max(p.iframes, 10);
    },
    tick(sim, p, a) {
      leapTick(p, a, 8);
      if (a.t === 7) strike(sim, p, a, line(p, a, a.data.dd + 30, 70, a.ang + Math.PI), { mul: 1.0, kb: 80, stagger: 10, hitstop: 3, wmw: 'G' }, 'thrust');
      if (a.t === 11) strike(sim, p, a, circ(p, 200), { mul: 1.8, kb: 340, stagger: 18, hitstop: 8, selfHs: 6, wmw: 'G' }, 'riftcleave');
    },
  },
  reavers_return: { // E -> G: the axes reave the target, then boomerang back rupturing Bleed
    start(sim, p, a) {
      a.dur = 34; a.cancel = 26; a.moveMul = 0.3;
      const e = finTarget(sim, p, a, 440), t = e ? { x: e.x, y: e.y } : { x: p.x + Math.cos(a.ang) * 300, y: p.y + Math.sin(a.ang) * 300 };
      a.data.lx = t.x; a.data.ly = t.y; a.data.tid = e ? e.id : null; a.ang = Math.atan2(t.y - p.y, t.x - p.x);
      sim.emit({ type: 'wm', ph: 'toss', pid: p.id, w: 'A', x: R0(p.x), y: R0(p.y), tx: R0(t.x), ty: R0(t.y), T: 8, reaver: 1 });
    },
    tick(sim, p, a) {
      const d = a.data, e = d.tid != null ? sim.enemies.find((q) => q.id === d.tid) : null;
      if (e && !e.dead) { d.lx = e.x; d.ly = e.y; }
      if (a.t === 8 || a.t === 13 || a.t === 18) strike(sim, p, a, circ(p, 110, d.lx, d.ly), { mul: 0.7, kb: 20, stagger: 8, hitstop: 3, stack: ['bleed', 1], wmw: 'A' }, 'reaver');
      if (a.t === 22) sim.emit({ type: 'wm', ph: 'recall', pid: p.id, w: 'A', x: R0(d.lx), y: R0(d.ly), tx: R0(p.x), ty: R0(p.y), T: 6, reaver: 1 });
      if (a.t === 27) { const L = Math.hypot(p.x - d.lx, p.y - d.ly); strike(sim, p, a, line(p, a, Math.max(40, L + 20), 90, Math.atan2(p.y - d.ly, p.x - d.lx), d.lx, d.ly), { mul: 1.0, bleedPop: { per: 0.35, keep: true }, stagger: 30, poise: 16, kb: 100, hitstop: 9, selfHs: 5, wmw: 'A' }, 'rupture'); }
    },
  },
  earthshatter_recall: { // G -> R -> G: the planted weapon erupts in a quake, then rips back in a recall arc
    start(sim, p, a) {
      const W = p.wm, pl = W.pl || { w: 'H', x: p.x + Math.cos(a.ang) * 90, y: p.y + Math.sin(a.ang) * 90 };
      W.pl = null; a.data.fx = pl.x; a.data.fy = pl.y; a.data.wm = { w: pl.w }; W.st = pl.w;
      a.dur = 40; a.cancel = 32; a.moveMul = 0; p.superArmor = true;
      sim.emit({ type: 'wm', ph: 'unplant', pid: p.id, x: R0(pl.x), y: R0(pl.y) });
    },
    tick(sim, p, a) {
      const d = a.data;
      p.superArmor = true;
      if (a.t === 8) strike(sim, p, a, circ(p, 220, d.fx, d.fy), { mul: 2.4, stagger: 60, poise: 40, knockup: 40, kb: 280, hitstop: 12, selfHs: 8, wmw: 'H' }, 'quake');
      if (a.t === 18) sim.emit({ type: 'wm', ph: 'recall', pid: p.id, w: d.wm.w, x: R0(d.fx), y: R0(d.fy), tx: R0(p.x), ty: R0(p.y), T: 8, big: 1 });
      if (a.t === 26) { const L = Math.hypot(p.x - d.fx, p.y - d.fy); strike(sim, p, a, line(p, a, Math.max(60, L + 40), 110, Math.atan2(p.y - d.fy, p.x - d.fx), d.fx, d.fy), { mul: 2.0, kb: 200, stagger: 24, hitstop: 8, selfHs: 6 }, 'recall'); }
    },
  },
  // ===== Q: Greatsword =====
  gs_cleave: {
    start(sim, p, a) { const s = S('Q'); a.dur = s.dur; a.cancel = s.cancel; a.moveMul = 0.3; },
    tick(sim, p, a) {
      const s = S('Q');
      if (a.t === s.hitT) strike(sim, p, a, cone(p, a, s.r, s.arc), { mul: s.mul, kb: 320, stagger: 14, hitstop: 6 }, 'cleave');
    },
  },
  // ===== E: Twin Axes =====
  ax_flurry: {
    start(sim, p, a) { const s = S('E'); a.data.n = s.hits; a.dur = 4 + s.hits * s.every + 8; a.cancel = a.dur - 6; a.moveMul = 0.45; },
    tick(sim, p, a) {
      const s = S('E'), i = (a.t - 4) / s.every;
      if (a.t >= 4 && Number.isInteger(i) && i < a.data.n) {
        const st = s.step / a.data.n; p.x += Math.cos(a.ang) * st; p.y += Math.sin(a.ang) * st;
        strike(sim, p, a, cone(p, a, s.r, s.arc), { mul: s.mul, kb: 40, stagger: 6, hitstop: 2, heavy: false, stack: ['bleed', s.bleed], selfHs: 1 }, i % 2 ? 'flurryL' : 'flurryR');
      }
    },
  },
  // ===== R: Warhammer (opens Warpath) =====
  hm_skull: {
    start(sim, p, a) { const s = S('R'); a.dur = s.dur; a.cancel = s.cancel; a.moveMul = 0.15; },
    tick(sim, p, a) {
      const s = S('R');
      if (a.t < s.hitT) { p.x += Math.cos(a.ang) * 1.5; p.y += Math.sin(a.ang) * 1.5; }
      if (a.t === s.hitT) strike(sim, p, a, cone(p, a, s.r, s.arc), { mul: s.mul, stagger: s.stun, poise: s.poise, kb: 280, hitstop: 12, selfHs: 8 }, 'skull');
    },
  },
  // ===== chains =====
  cyclone_cleave: { // E -> Q: War Cry + spinning cleave that drags in
    start(sim, p, a) { a.dur = 26; a.cancel = 17; a.moveMul = 0.5; },
    tick(sim, p, a) {
      p.superArmor = true;
      if (a.t === 2) warCry(sim, p, WM.cry.r);
      if (a.t >= 2 && a.t < 14 && !sim.predicting) dragIn(sim, p, WM.cry.r, 900, 0.1);
      if (a.t === 8 || a.t === 15) strike(sim, p, a, circ(p, 185), { mul: 0.9, kb: 90, pull: true, stagger: 14, hitstop: 5 }, a.t === 8 ? 'cyclone' : 'cyclone2');
    },
  },
  seismic_arc: { // Warpath: R -> Q
    start(sim, p, a) { a.dur = 26; a.cancel = 18; a.moveMul = 0.2; },
    tick(sim, p, a) {
      if (a.t === 10) strike(sim, p, a, cone(p, a, 230, 2.7), { mul: 2.2, knockup: 45, kb: 300, poise: 10, hitstop: 8 }, 'seismic');
    },
  },
  thunder_hurl: { // Warpath: R -> E: hammer throw + Challenge
    start(sim, p, a) { a.dur = 24; a.cancel = 15; a.moveMul = 0.4; },
    tick(sim, p, a) {
      if (a.t !== 8) return;
      const set = new Set(), sh = line(p, a, 380, 64);
      strike(sim, p, a, sh, { mul: 1.8, stagger: 40, poise: 14, kb: 200, hitstop: 8, stack: ['bleed', 2] }, 'hurl', set);
      if (sim.predicting) return;
      let best = null, bs = -1;
      for (const id of set) { const e = sim.enemyById ? sim.enemyById.get(id) : sim.enemies.find((q) => q.id === id); if (!e || e.dead) continue; const sc = (e.boss ? 1e9 : e.elite ? 1e8 : 0) + e.hp; if (sc > bs) { bs = sc; best = e; } }
      challenge(sim, p, best);
    },
  },
  warlords_rally: { // Warpath: R -> Q -> E: axe whirlwind, then Rally (Glory spent)
    start(sim, p, a) { a.dur = 64; a.cancel = 56; a.moveMul = 0.55; },
    tick(sim, p, a) {
      p.superArmor = true;
      if (a.t < 48 && !sim.predicting) dragIn(sim, p, 320, 420, 0.08);
      if (a.t >= 4 && a.t <= 46 && a.t % 6 === 4) strike(sim, p, a, circ(p, 170), { mul: 0.6, kb: 40, pull: true, stagger: 8, hitstop: 2, stack: ['bleed', 1], selfHs: 1 }, 'fin_cyclone');
      if (a.t === 52) { strike(sim, p, a, circ(p, 200), { mul: 1.2, kb: 280, stagger: 20, hitstop: 7, wmw: 'A' }, 'axespin'); rally(sim, p); }
    },
  },
  executioners_verdict: { // Warpath: R -> E -> Q: leap + impale crit (Glory spent)
    start(sim, p, a) {
      a.dur = 40; a.cancel = 32; a.lockMove = true;
      const e = finTarget(sim, p, a, 360);
      if (e) {
        a.data.tid = e.id; a.ang = Math.atan2(e.y - p.y, e.x - p.x);
        const stop = e.r + p.r + 8, t = offWalls(sim, p, e.x - Math.cos(a.ang) * stop, e.y - Math.sin(a.ang) * stop);
        a.data.fx = p.x; a.data.fy = p.y; a.data.lx = t.x; a.data.ly = t.y;
      }
      p.iframes = Math.max(p.iframes, 14);
    },
    tick(sim, p, a) {
      p.superArmor = true;
      if (a.data.lx != null) leapTick(p, a, 12);
      if (a.t !== 18) return;
      const e = a.data.tid != null ? sim.enemies.find((q) => q.id === a.data.tid && !q.dead) : null;
      if (e && !sim.predicting) {
        const b = takeStacks(sim, p, e, 'bleed'), ch = e.stx && e.stx.chal && e.stx.chal.t > 0, cc = e.cc.stun > 0 || e.cc.down > 0;
        const mul = 3 + 0.4 * b + (ch || cc ? 2 : 0);
        hitEnemy(sim, p, e, strikeOpts(p, a, { mul, forceCrit: true, poise: 40, stagger: 40, kb: 200, hitstop: 14, bigNum: true }));
        sim.emit({ type: 'wmx', ph: 'verdict', pid: p.id, id: e.id, x: R0(e.x), y: R0(e.y), b, mul: r2(mul * (a.data.gm || 1)) });
      }
      strike(sim, p, a, line(p, a, 220, 70), { mul: 0.8, stagger: 30, kb: 160, hitstop: 8 }, 'fin_impale', new Set(e ? [e.id] : []));
    },
  },
  // ===== Ult: Warlord's Trinity (the opening slam; the window is p.uw) =====
  warlord: {
    start(sim, p, a) {
      leapTo(sim, p, a, 320, 20);
      a.dur = 34; a.cancel = 26; a.lockMove = true; a.data.wm = { w: stanceOf(p) };
      p.iframes = Math.max(p.iframes, 24);
    },
    tick(sim, p, a) {
      p.superArmor = true;
      leapTick(p, a, 20);
      if (a.t === 20) {
        strike(sim, p, a, circ(p, 220), { mul: 4, knockup: 60, kb: 420, hitstop: 12, selfHs: 8, ult: true }, 'warlord');
        gainGlory(sim, p, WM.ultGlory, 'warlord');
      }
    },
  },
  // Crimson Tempest (mob finisher): axe cyclone pull -> three greatsword crescents -> the hammer quake that detonates every Bleed
  crimson_tempest: {
    start(sim, p, a) { a.dur = 104; a.cancel = 104; a.lockMove = true; a.moveMul = 0; a.data.fin = 1; p.iframes = Math.max(p.iframes, 110); },
    tick(sim, p, a) {
      p.superArmor = true; p.iframes = Math.max(p.iframes, 4);
      if (a.t < 30 && !sim.predicting) dragIn(sim, p, 480, 700, 0.12);
      if (a.t >= 4 && a.t <= 28 && a.t % 6 === 4) strike(sim, p, a, circ(p, 200), { mul: 0.55, kb: 40, pull: true, stagger: 10, hitstop: 3, stack: ['bleed', 1], wmw: 'A', ult: true }, 'fin_cyclone');
      const waves = { 38: 0, 46: Math.PI, 54: Math.PI / 2 };
      if (waves[a.t] != null) strike(sim, p, a, cone(p, a, 380, 3.3, a.ang + waves[a.t]), { mul: 1.6, kb: 260, stagger: 16, hitstop: 6, wmw: 'G', ult: true }, 'fin_crescent');
      if (a.t === 66) sim.emit({ type: 'wm', ph: 'hit', pid: p.id, w: 'H', fx: 'fin_rise', x: R0(p.x), y: R0(p.y), n: 0 });
      if (a.t === 86) strike(sim, p, a, circ(p, 600), { mul: 3.0, knockup: 70, kb: 380, stagger: 40, poise: 40, hitstop: 16, selfHs: 10, bleedPop: { per: 0.6 }, wmw: 'H', ult: true, bigNum: true }, 'fin_quake');
      if (a.t === 100) endUltWindow(sim, p, 'crimson_tempest');
    },
  },
  // Titanfall Execution (boss finisher): axe flurry on the target -> greatsword impale -> a sky-high hammer meteor (one huge crit)
  titanfall: {
    start(sim, p, a) {
      a.dur = 104; a.cancel = 104; a.lockMove = true; a.moveMul = 0; a.data.fin = 1; p.iframes = Math.max(p.iframes, 110);
      const e = finTarget(sim, p, a, 460);
      if (e) {
        a.data.tid = e.id; a.ang = Math.atan2(e.y - p.y, e.x - p.x);
        const stop = e.r + p.r + 10, t = offWalls(sim, p, e.x - Math.cos(a.ang) * stop, e.y - Math.sin(a.ang) * stop);
        a.data.fx = p.x; a.data.fy = p.y; a.data.lx = t.x; a.data.ly = t.y;
      }
    },
    tick(sim, p, a) {
      p.superArmor = true; p.iframes = Math.max(p.iframes, 4);
      if (a.data.lx != null) leapTick(p, a, 8);
      const e = a.data.tid != null ? sim.enemies.find((q) => q.id === a.data.tid && !q.dead) : null;
      if (e) a.ang = Math.atan2(e.y - p.y, e.x - p.x);
      if (a.t >= 10 && a.t <= 34 && a.t % 4 === 2) strike(sim, p, a, cone(p, a, 140, 1.6), { mul: 0.45, kb: 20, stagger: 8, hitstop: 2, stack: ['bleed', 1], wmw: 'A', ult: true, selfHs: 1 }, 'fin_flurry');
      if (a.t === 44) strike(sim, p, a, line(p, a, 220, 70), { mul: 2.5, stagger: 60, poise: 60, kb: 120, hitstop: 12, wmw: 'G', ult: true }, 'fin_impale');
      if (a.t === 56) sim.emit({ type: 'wm', ph: 'hit', pid: p.id, w: 'H', fx: 'fin_rise', x: R0(p.x), y: R0(p.y), n: 0 });
      if (a.t === 84) {
        let tx = p.x + Math.cos(a.ang) * 60, ty = p.y + Math.sin(a.ang) * 60;
        if (e && !sim.predicting) {
          tx = e.x; ty = e.y;
          const b = takeStacks(sim, p, e, 'bleed'), ch = e.stx && e.stx.chal && e.stx.chal.t > 0, cc = e.cc.stun > 0 || e.cc.down > 0;
          const mul = 8 + 0.5 * b + (ch || cc ? 3 : 0);
          hitEnemy(sim, p, e, strikeOpts(p, a, { mul, forceCrit: true, pierce: true, poise: 80, stagger: 60, kb: 300, hitstop: 20, wmw: 'H', ult: true, bigNum: true }));
          sim.emit({ type: 'wmx', ph: 'titan', pid: p.id, id: e.id, x: R0(e.x), y: R0(e.y), b, bonus: ch || cc ? 1 : undefined });
        }
        const set = new Set(e ? [e.id] : []);
        strike(sim, p, a, circ(p, 220, tx, ty), { mul: 1.5, knockup: 50, kb: 300, hitstop: 12, selfHs: 12, wmw: 'H', ult: true }, 'fin_meteor', set);
      }
      if (a.t === 100) endUltWindow(sim, p, 'titanfall');
    },
  },
};
