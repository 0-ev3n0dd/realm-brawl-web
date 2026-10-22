// Samurai: IAIDO + DELAYED CUTS, in the shared class structure (Q / E / R skills + 8 chains + a state + two ult finisher routes).
// Q = Iaido Slash (a quick-draw dash cut), E = Crescent Parry (0.4 s block: a perfect parry counter-slashes and gives Focus; no hit =
// a crescent slash at the end), R = Sheathe (bursts every Delayed Cut, then STILLNESS for 2 s: Focus builds, the next skill
// transforms). Every katana hit leaves Delayed Cuts on what it touched (kit.js stack 'cut'); they only burst when you sheathe.
// Focus (the resource) is built in Stillness, by perfect parries and a little per hit; Petal Rain and Moment of Death spend all of
// it (up to x2 damage), the finishers scale with it (kept). Pure sim code: everything that changes enemies (damage, cuts, parries,
// time freeze) runs only in the authoritative sim; a predicting co-op client only times the moves and draws them ('sam' events).
import { defParry } from './defense.js';
import { CLASSES } from './data/classes.js';
import { DT } from './constants.js';
import { pointBlocked, clearPath } from './world.js';
import { hitEnemy, hitEnemiesInShape } from './combat.js';
import { targetsOf, leapTick } from './player.js';
import { addStacks, takeStacks, stackN, endUltWindow } from './kit.js';
import { tickBuffs } from './warrior.js';

/** Samurai tuning (the per-skill numbers live in the class data: skills[k].stats). */
export const SAM = {
  dmg: 2.8, // class-wide skill damage scale (keeps the per-skill numbers readable; tuned against the other classes' TTKs)
  wind: { len: 230, w: 76, mul: 1.1, cuts: 2, T: 7 },
  blossom: { mul: 1.0, r: 150, arc: 2.2 },
  wave: { len: 420, w: 110, mul: 1.8, big: 1.5, ppWin: 110 },
  petal: { hops: 8, every: 5, r: 400, mul: 0.75 },
  guard: { block: 48, mul: 2.4, cuts: 5, near: 2, nearR: 170, wmul: 1.4, wcuts: 2, wr: 150 },
  death: { freeze: 60, r: 720, base: 3, per: 0.5, range: 460 },
  twin: { mul: 1.7, cuts: 2, r: 160, arc: 1.7, range: 240 },
  counterMul: 2,
  voidCut: { len: 440, w: 130, mul: 3.5, cuts: 3 },
  storm: { r: 650, every: 2, from: 4, to: 64, mul: 0.3, cuts: 2, base: 1.2, per: 0.6, burstAt: 84 },
  perfect: { range: 520, base: 10, per: 0.6, line: 2.0 },
  voidEnd: 1.5,
};
const R0 = (v) => Math.round(v);
const r2 = (v) => Math.round(v * 100) / 100;
export const isSam = (p) => !!(p && p.sam && CLASSES[p.cls] && CLASSES[p.cls].blade);
const C = () => CLASSES.samurai;
const SS = (k) => CLASSES.samurai.skills[k].stats;

// ------------------------------------------------------------------ state
export function initSam(p) { p.sam = { parry: 0, pk: null, pp: -9999, n: 0 }; }

/** Focus gain (gear: Focus Gain; x2 in the ult window). Authoritative sim only. */
export function gainFocus(sim, p, n, why = null) {
  if (sim.predicting || !(n > 0) || !CLASSES[p.cls].focusRes) return 0;
  const F = CLASSES[p.cls].focus, before = p.res;
  p.res = Math.min(p.stats.maxRes, p.res + n * (1 + (p.stats.focusGain || 0)) * (p.uw ? F.ultMul : 1));
  const got = p.res - before;
  if (why && got >= 1) sim.emit({ type: 'samx', ph: 'focus', pid: p.id, n: R0(got), why, x: R0(p.x), y: R0(p.y - 56) });
  return got;
}

/** Per tick: parry window, Stillness Focus, drain, free sheathes in the ult window. */
export function tickSamurai(sim, p) {
  tickBuffs(p);
  const S = p.sam;
  if (!isSam(p)) return;
  const F = C().focus;
  if (S.parry > 0 && !(p.action && p.action.data && p.action.data.guard)) S.parry = 0; // (the guard ended early: cancelled / stunned)
  if (S.parry > 0) S.parry--;
  if (p.uw) p.cds.R = 0; // Blade of the Void: free sheathes
  if (sim.predicting) return;
  if (p.cst && !(p.action && p.action.data && p.action.data.fin)) gainFocus(sim, p, F.still); // Stillness: the sheathed blade gathers Focus
  else if (p.res > 0 && !p.uw && sim.tick - (p.lastCombat || 0) > F.drainAfter) p.res = Math.max(0, p.res - F.drain * DT);
}

/** After a Samurai hit lands (authoritative): a little Focus per skill hit. */
export function samOnHit(sim, p, e, o) {
  if (sim.predicting || o.dot || o.ult || o.basic || !isSam(p)) return;
  const F = C().focus, act = p.action;
  if (!act || act.kind !== 'skill') return;
  const add = Math.min(F.hit, F.hitCap - (act.fg || 0));
  if (add > 0) { act.fg = (act.fg || 0) + add; gainFocus(sim, p, add); }
}

/** A skill / chain / finisher starts (player.js): the Focus spenders spend it all, the finishers scale with it; tell the clients. */
export function samCast(sim, p, a, key, chain) {
  if (!isSam(p)) return;
  const F = C().focus, fin = !!(chain && chain.route), id = chain ? chain.id : a.id;
  if (id === 'petal_rain' || id === 'moment_of_death' || fin) {
    const k = fin ? F.finMax : F.spendMax;
    a.data.fm = 1 + k * Math.min(1, p.res / 100);
    if (!sim.predicting && !fin && !p.uw) p.res = 0; // (Blade of the Void: the window's extra Focus is not spent)
  }
  if (fin) sim.emit({ type: 'sam', ph: 'fin', pid: p.id, id, route: chain.route, name: chain.name, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), fm: r2(a.data.fm || 1) });
  else sim.emit({ type: 'sam', ph: 'cast', pid: p.id, id, key, chain: chain ? 1 : undefined, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), fm: a.data.fm > 1.01 ? r2(a.data.fm) : undefined });
}

/** The HUD's view. */
export function samInfo(p) { return p.sam ? { parry: p.sam.parry, pk: p.sam.pk, n: p.sam.n } : null; }
/** Total Delayed Cuts this Samurai has on live enemies near (x, y). */
export function cutsNear(sim, p, r = 900) {
  let n = 0, k = 0;
  for (const e of targetsOf(sim)) { if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > r) continue; const c = stackN(e, 'cut', p.id); if (c) { n += c; k++; } }
  return { n, k };
}

// ------------------------------------------------------------------ helpers
function offWalls(sim, p, lx, ly) {
  ({ x: lx, y: ly } = clearPath(sim.world, p.x, p.y, lx, ly, p.r)); // (swept: never tunnels through walls / props)
  return { x: lx, y: ly };
}
function dashTo(sim, p, a, x, y, T) {
  const t = offWalls(sim, p, x, y);
  a.data.fx = p.x; a.data.fy = p.y; a.data.lx = t.x; a.data.ly = t.y; a.data.T = T; a.data.dd = Math.hypot(t.x - p.x, t.y - p.y);
  a.lockMove = true;
  p.iframes = Math.max(p.iframes, T + 2);
}
const dashAim = (sim, p, a, len, T) => dashTo(sim, p, a, p.x + Math.cos(a.ang) * len, p.y + Math.sin(a.ang) * len, T);
function strikeOpts(p, a, o) {
  let mul = SAM.dmg;
  if (a.chain && !a.chain.route) mul *= 1 + (p.stats.chainDmg || 0);
  if (a.data.fm && !o.noFm) mul *= a.data.fm;
  return { hitstop: 4, heavy: true, ...o, dmgMul: (o.dmgMul || 1) * mul, style: o.style || 'sam', ult: o.ult || !!a.data.fin || undefined };
}
/** Hit a shape and tell the clients what to draw. fx: the look (client/fxsam.js). srv: server-only look ('samx': parry counters). */
function strike(sim, p, a, sh, o, fx, set = null, srv = false) {
  const oo = strikeOpts(p, a, o);
  const n = sim.predicting ? 0 : hitEnemiesInShape(sim, p, sh, oo, set);
  if (n > 0 && !sim.predicting) p.hitstop = Math.max(p.hitstop, o.selfHs ?? Math.min(6, (o.hitstop ?? 4) - 1));
  sim.emit({ type: srv ? 'samx' : 'sam', ph: 'hit', pid: p.id, fx, emp: a.chain || a.data.fin ? 1 : undefined, x: R0(sh.x), y: R0(sh.y), ang: r2(sh.ang ?? a.ang), r: sh.r, arc: sh.arc, len: sh.len, lw: sh.w, shape: sh.shape, n });
  return n;
}
const circ = (p, r, x = p.x, y = p.y) => ({ shape: 'circle', x, y, r });
const cone = (p, a, r, arc, ang = a.ang) => ({ shape: 'cone', x: p.x, y: p.y, ang, arc, r });
const line = (x, y, ang, len, w) => ({ shape: 'line', x, y, ang, len, w });
const cutOpt = (n) => ['cut', n];
const byId = (sim, id) => (id == null ? null : (sim.enemyById && sim.enemyById.get(id)) || sim.enemies.find((q) => q.id === id) || null);
function pickTarget(sim, p, a, range, bossFirst = true) {
  let best = null, bs = Infinity;
  for (const e of targetsOf(sim)) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > range + e.r) continue;
    const s = Math.hypot(e.x - a.data.tx, e.y - a.data.ty) * 0.4 + d * 0.3 - (bossFirst ? (e.boss ? 900 : e.elite ? 400 : 0) : 0) - stackN(e, 'cut', p.id) * 20;
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}

/** Burst every Delayed Cut of `p` within r: each enemy takes ×(per × cuts × mul) ATK. blossom: 25% splashes onto enemies near it.
 *  Returns the number of cuts burst. Authoritative sim only (a predicting client only draws the sheathe). */
export function burstCuts(sim, p, a, { mul = 1, blossom = false, r = C().cut.r, fx = 'burst', ult = false } = {}) {
  if (sim.predicting) return 0;
  const K = C().cut, gear = 1 + (p.stats.cutDmg || 0);
  let total = 0, hit = 0;
  const list = sim.enemies.filter((e) => !e.dead && stackN(e, 'cut', p.id) > 0 && Math.hypot(e.x - p.x, e.y - p.y) < r + e.r);
  for (const e of list) {
    const n = takeStacks(sim, p, e, 'cut');
    if (!n) continue;
    total += n; hit++;
    const m = K.per * n * mul * gear;
    sim.emit({ type: 'samx', ph: 'burst', pid: p.id, id: e.id, x: R0(e.x), y: R0(e.y), r: e.r, n, fx, dbl: mul > 1.5 ? 1 : undefined });
    hitEnemy(sim, p, e, strikeOpts(p, a, { mul: m, stagger: 10 + n * 2, kb: 60, hitstop: 6, noPop: true, style: 'samburst', ult: ult || undefined, noFm: true, bigNum: n >= 8 || undefined }));
    if (blossom) {
      for (const q of sim.enemies) if (!q.dead && q !== e && Math.hypot(q.x - e.x, q.y - e.y) < K.splashR + q.r) hitEnemy(sim, p, q, strikeOpts(p, a, { mul: m * K.splash, kb: 90, hitstop: 3, style: 'samburst', noFm: true, ult: ult || undefined }));
      sim.emit({ type: 'samx', ph: 'bloom', pid: p.id, x: R0(e.x), y: R0(e.y), r: K.splashR });
    }
  }
  if (total) { const F = C().focus; gainFocus(sim, p, Math.min(F.burstCap, total * F.burst), 'burst'); p.sam.n += total; }
  sim.emit({ type: 'samx', ph: 'sheathed', pid: p.id, x: R0(p.x), y: R0(p.y), n: total, k: hit, dbl: mul > 1.5 ? 1 : undefined, bl: blossom ? 1 : undefined });
  return total;
}
/** The ult window timed out without a finisher: Void Sheathe (kit.js endUltWindow). */
export function voidSheathe(sim, p) {
  if (!isSam(p)) return;
  sim.emit({ type: 'sam', ph: 'hit', pid: p.id, fx: 'voidend', x: R0(p.x), y: R0(p.y), n: 0 });
  burstCuts(sim, p, { data: {}, chain: null }, { mul: SAM.voidEnd, fx: 'void', ult: true });
}

// ------------------------------------------------------------------ parry (combat.js damagePlayer)
/** A hit reached the Samurai during a parry window: parried (no damage), counter. Returns true when it was parried. */
export function samParry(sim, p, src, o = {}) {
  const S = p.sam, a = p.action;
  if (!isSam(p) || !(S.parry > 0) || o.raw || !a || !a.data || !a.data.guard || a.data.pp) return false;
  a.data.pp = 1; S.parry = 0; S.pp = sim.tick; defParry(sim, p); // Mirror Parry heal (sim/defense.js)
  const moon = a.data.guard === 'moon';
  const F = C().focus, G = SAM.guard, E = SS('E');
  p.iframes = Math.max(p.iframes, 24);
  const tx = src && src.x != null ? src.x : p.x + Math.cos(a.ang) * 60, ty = src && src.y != null ? src.y : p.y + Math.sin(a.ang) * 60;
  a.ang = Math.atan2(ty - p.y, tx - p.x);
  sim.emit({ type: 'samx', ph: 'parry', pid: p.id, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), moon: moon ? 1 : undefined, tx: R0(tx), ty: R0(ty) });
  gainFocus(sim, p, moon ? F.guard : F.parry, 'parry');
  const foe = src && src.hp != null && !src.dead && src.cc ? src : null;
  const set = new Set();
  if (foe && moon) { addStacks(sim, p, foe, 'cut', G.cuts); for (const q of sim.enemies) if (!q.dead && q !== foe && Math.hypot(q.x - foe.x, q.y - foe.y) < G.nearR + q.r) addStacks(sim, p, q, 'cut', G.near); }
  if (foe) { set.add(foe.id); hitEnemy(sim, p, foe, strikeOpts(p, a, { mul: moon ? G.mul : E.mul, forceCrit: true, stagger: 40, poise: 20, kb: 240, hitstop: 12, stack: moon ? undefined : cutOpt(E.cuts), bigNum: true })); }
  strike(sim, p, a, cone(p, a, E.r, E.arc), { mul: (moon ? G.mul : E.mul) * 0.6, forceCrit: true, stagger: 24, kb: 200, hitstop: 8, stack: cutOpt(moon ? G.near : E.cuts), selfHs: 8 }, moon ? 'mooncounter' : 'counter', set, true);
  a.dur = a.t + 16; a.cancel = a.t + 6; // flow straight into the next move
  return true;
}

// ------------------------------------------------------------------ the moves (skill / chain / finisher id -> { start, tick })
export const SAM_SKILLS = {
  // ===== G: Kesa Slash (a diagonal shoulder-to-hip cut, +1 Delayed Cut each) =====
  kesa_slash: {
    start(sim, p, a) { const s = SS('F'); a.dur = s.dur; a.cancel = s.cancel; a.moveMul = 0.2; },
    tick(sim, p, a) {
      const s = SS('F');
      if (a.t < 6) { p.x += Math.cos(a.ang) * 4; p.y += Math.sin(a.ang) * 4; }
      if (a.t === 6) strike(sim, p, a, cone(p, a, s.r, s.arc), { mul: s.mul, kb: 120, stagger: 12, hitstop: 5, stack: ['cut', s.cuts] }, 'kesa');
    },
  },
  // ===== Q: Iaido Slash =====
  iaido: {
    start(sim, p, a) { const s = SS('Q'); a.dur = s.dur; a.cancel = s.cancel; dashAim(sim, p, a, s.len, 6); a.data.ox = p.x; a.data.oy = p.y; },
    tick(sim, p, a) {
      const s = SS('Q');
      leapTick(p, a, 6);
      if (a.t === 5) strike(sim, p, a, line(a.data.ox ?? p.x, a.data.oy ?? p.y, a.ang, (a.data.dd ?? 200) + 36, s.w), { mul: s.mul, kb: 90, stagger: 12, hitstop: 5, stack: cutOpt(s.cuts) }, 'iaido');
    },
  },
  // ===== E: Crescent Parry =====
  crescent_parry: {
    start(sim, p, a) { const s = SS('E'); a.dur = s.block + 12; a.cancel = s.block + 6; a.moveMul = 0.15; a.data.guard = 'parry'; p.sam.parry = s.block; p.sam.pk = 'parry'; },
    tick(sim, p, a) {
      const s = SS('E');
      if (a.t === s.block && !a.data.pp) strike(sim, p, a, cone(p, a, s.wr, s.warc), { mul: s.wmul, kb: 150, stagger: 14, hitstop: 5, stack: cutOpt(s.wcuts) }, 'crescent');
    },
  },
  // ===== R: Sheathe (opens Stillness) =====
  sheathe: {
    start(sim, p, a) { const s = SS('R'); a.dur = s.dur; a.cancel = s.cancel; a.moveMul = 0.3; },
    tick(sim, p, a) {
      const s = SS('R');
      if (a.t === 7) { sim.emit({ type: 'sam', ph: 'hit', pid: p.id, fx: 'click', x: R0(p.x), y: R0(p.y), ang: r2(a.ang), n: 0 }); burstCuts(sim, p, a); strike(sim, p, a, circ(p, s.ring), { mul: s.rmul, kb: 120, stagger: 10, hitstop: 4 }, 'ring'); }
    },
  },
  // ===== chains =====
  wind_step: { // Q -> Q: through the pack and back
    start(sim, p, a) { const W = SAM.wind; a.dur = 30; a.cancel = 24; a.data.ox = p.x; a.data.oy = p.y; dashAim(sim, p, a, W.len, W.T); },
    tick(sim, p, a) {
      const W = SAM.wind, d = a.data;
      if (a.t < W.T) leapTick(p, a, W.T);
      if (a.t === W.T - 1) strike(sim, p, a, line(d.ox ?? p.x, d.oy ?? p.y, a.ang, (d.dd ?? 200) + 36, W.w), { mul: W.mul, kb: 60, stagger: 10, hitstop: 3, stack: cutOpt(W.cuts) }, 'wind');
      if (a.t === W.T + 3) { d.ox = p.x; d.oy = p.y; d.back = 1; dashTo(sim, p, a, d.fx, d.fy, W.T); d.t0 = a.t; }
      if (d.back && a.t > d.t0 && a.t <= d.t0 + W.T) { const k = (a.t - d.t0) / W.T, e = k * k * (3 - 2 * k); p.x = d.fx + (d.lx - d.fx) * e; p.y = d.fy + (d.ly - d.fy) * e; }
      if (d.back && a.t === d.t0 + W.T) strike(sim, p, a, line(d.ox ?? p.x, d.oy ?? p.y, a.ang + Math.PI, (d.dd ?? 200) + 36, W.w), { mul: W.mul, kb: 60, stagger: 10, hitstop: 3, stack: cutOpt(W.cuts) }, 'wind2');
    },
  },
  blossom_burst: { // Q -> R: a last draw, then the sheathe blooms
    start(sim, p, a) { a.dur = 26; a.cancel = 18; a.moveMul = 0.25; },
    tick(sim, p, a) {
      const B = SAM.blossom;
      if (a.t === 4) strike(sim, p, a, cone(p, a, B.r, B.arc), { mul: B.mul, kb: 80, stagger: 10, hitstop: 4, stack: cutOpt(1) }, 'drawcut');
      if (a.t === 12) { sim.emit({ type: 'sam', ph: 'hit', pid: p.id, fx: 'click', emp: 1, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), n: 0 }); burstCuts(sim, p, a, { blossom: true, fx: 'blossom' }); strike(sim, p, a, circ(p, 130), { mul: 0.8, kb: 140, stagger: 12, hitstop: 4 }, 'petalring'); }
    },
  },
  riposte_wave: { // E -> Q: a crescent wave (bigger after a perfect parry)
    start(sim, p, a) { a.dur = 22; a.cancel = 15; a.moveMul = 0.2; a.data.big = sim.tick - p.sam.pp <= SAM.wave.ppWin ? 1 : 0; },
    tick(sim, p, a) {
      const W = SAM.wave, big = a.data.big;
      if (a.t === 6) strike(sim, p, a, line(p.x, p.y, a.ang, W.len * (big ? 1.2 : 1), W.w * (big ? 1.4 : 1)), { mul: W.mul * (big ? W.big : 1), kb: 220, stagger: 18, hitstop: 5, stack: cutOpt(big ? 2 : 1) }, big ? 'wavebig' : 'wave');
    },
  },
  petal_rain: { // Stillness: R -> Q -> E: 8 dash-cuts across the pack (Focus spent)
    start(sim, p, a) {
      const P = SAM.petal;
      a.dur = P.hops * P.every + 16; a.cancel = a.dur - 4; a.lockMove = true; p.iframes = Math.max(p.iframes, a.dur);
      const near = targetsOf(sim).filter((e) => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < P.r + e.r).sort((x, y) => Math.hypot(x.x - p.x, x.y - p.y) - Math.hypot(y.x - p.x, y.y - p.y));
      a.data.ids = near.slice(0, P.hops).map((e) => e.id); a.data.i = 0;
    },
    tick(sim, p, a) {
      const P = SAM.petal;
      p.iframes = Math.max(p.iframes, 3);
      if (a.t < 2 || (a.t - 2) % P.every || a.data.i >= P.hops) return;
      const i = a.data.i++, ids = a.data.ids;
      const e = ids.length ? byId(sim, ids[i % ids.length]) : null;
      const fx = p.x, fy = p.y;
      if (e && !e.dead) {
        const ang = Math.atan2(e.y - p.y, e.x - p.x) + (i % 2 ? 0.5 : -0.5), t = offWalls(sim, p, e.x + Math.cos(ang) * (e.r + p.r + 14), e.y + Math.sin(ang) * (e.r + p.r + 14));
        p.x = t.x; p.y = t.y; a.ang = Math.atan2(e.y - p.y, e.x - p.x);
        if (!sim.predicting) hitEnemy(sim, p, e, strikeOpts(p, a, { mul: P.mul, kb: 30, stagger: 8, hitstop: 2, stack: cutOpt(1), heavy: false }));
      } else { a.ang += 2.4; }
      sim.emit({ type: 'sam', ph: 'hit', pid: p.id, fx: 'petal', emp: 1, x: R0(p.x), y: R0(p.y), fx0: R0(fx), fy0: R0(fy), ang: r2(a.ang), i, n: e ? 1 : 0 });
    },
  },
  counter_sheathe: { // E -> R: the cuts burst at double damage
    start(sim, p, a) { a.dur = 24; a.cancel = 16; a.moveMul = 0.2; },
    tick(sim, p, a) {
      if (a.t === 8) { sim.emit({ type: 'sam', ph: 'hit', pid: p.id, fx: 'click', emp: 1, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), n: 0 }); burstCuts(sim, p, a, { mul: SAM.counterMul, fx: 'counterburst' }); strike(sim, p, a, circ(p, 120), { mul: 1.0, kb: 150, stagger: 16, hitstop: 5 }, 'ring'); }
    },
  },
  moonlit_guard: { // Stillness: R -> E: a 0.8 s guard; a parried hit stacks 5 cuts on the attacker
    start(sim, p, a) { const G = SAM.guard; a.dur = G.block + 12; a.cancel = G.block + 6; a.moveMul = 0.1; a.data.guard = 'moon'; p.sam.parry = G.block; p.sam.pk = 'moon'; },
    tick(sim, p, a) {
      const G = SAM.guard;
      if (a.t === G.block && !a.data.pp) strike(sim, p, a, cone(p, a, G.wr, 2.8), { mul: G.wmul, kb: 170, stagger: 18, hitstop: 6, stack: cutOpt(G.wcuts) }, 'mooncrescent');
    },
  },
  moment_of_death: { // Stillness: R -> E -> Q: time freeze, one guaranteed crit that feeds on the cuts (Focus spent)
    start(sim, p, a) {
      const D = SAM.death;
      a.dur = 52; a.cancel = 44; a.lockMove = true; p.iframes = Math.max(p.iframes, 50);
      const e = pickTarget(sim, p, a, D.range);
      if (e) a.data.tid = e.id;
      if (!sim.predicting) for (const q of sim.enemies) if (!q.dead && Math.hypot(q.x - p.x, q.y - p.y) < D.r) q.hitstop = Math.max(q.hitstop, D.freeze); // time stops
      sim.emit({ type: 'sam', ph: 'hit', pid: p.id, fx: 'freeze', emp: 1, x: R0(p.x), y: R0(p.y), r: D.r, n: 0 });
    },
    tick(sim, p, a) {
      const D = SAM.death, e = byId(sim, a.data.tid);
      if (a.t === 18 && e && !e.dead) { a.ang = Math.atan2(e.y - p.y, e.x - p.x); const far = Math.hypot(e.x - p.x, e.y - p.y) + e.r + p.r + 20; dashAim(sim, p, a, far, 5); a.data.ox = p.x; a.data.oy = p.y; a.data.t0 = 18; }
      if (a.data.t0 != null && a.t > 18 && a.t <= 23) { const k = (a.t - 18) / 5, d = a.data; p.x = d.fx + (d.lx - d.fx) * k; p.y = d.fy + (d.ly - d.fy) * k; }
      if (a.t !== 26) return;
      let n = 0, mul = D.base;
      if (e && !e.dead && !sim.predicting) {
        n = p.uw ? stackN(e, 'cut', p.id) : takeStacks(sim, p, e, 'cut'); mul = D.base + D.per * n; // (in the ult window it reads the cuts and leaves them for One Perfect Cut)
        hitEnemy(sim, p, e, strikeOpts(p, a, { mul, forceCrit: true, pierce: true, poise: 50, stagger: 50, kb: 160, hitstop: 16, bigNum: true }));
      }
      sim.emit({ type: 'samx', ph: 'death', pid: p.id, id: e ? e.id : null, x: R0(e ? e.x : p.x), y: R0(e ? e.y : p.y), ang: r2(a.ang), ox: R0(a.data.ox ?? p.x), oy: R0(a.data.oy ?? p.y), n, mul: r2(mul * (a.data.fm || 1)) });
      sim.emit({ type: 'sam', ph: 'hit', pid: p.id, fx: 'deathline', emp: 1, x: R0(a.data.ox ?? p.x), y: R0(a.data.oy ?? p.y), ang: r2(a.ang), len: R0(a.data.dd || 120), n: 1 });
    },
  },
  twin_moons: { // Q -> E -> Q: two crossing moon-cuts on one target (the second crits)
    start(sim, p, a) {
      const T = SAM.twin; a.dur = 26; a.cancel = 19; a.moveMul = 0.2;
      const e = pickTarget(sim, p, a, T.range);
      if (e) { a.data.tid = e.id; a.ang = Math.atan2(e.y - p.y, e.x - p.x); const stop = e.r + p.r + 10; if (Math.hypot(e.x - p.x, e.y - p.y) > stop + 8) dashTo(sim, p, a, e.x - Math.cos(a.ang) * stop, e.y - Math.sin(a.ang) * stop, 5); }
    },
    tick(sim, p, a) {
      const T = SAM.twin;
      if (a.data.lx != null && a.t < 5) leapTick(p, a, 5);
      const e = byId(sim, a.data.tid);
      if (e && !e.dead) a.ang = Math.atan2(e.y - p.y, e.x - p.x);
      if (a.t === 7) strike(sim, p, a, cone(p, a, T.r, T.arc), { mul: T.mul, kb: 40, stagger: 14, hitstop: 5, stack: cutOpt(T.cuts) }, 'moonA');
      if (a.t === 15) strike(sim, p, a, cone(p, a, T.r, T.arc), { mul: T.mul, forceCrit: true, kb: 200, stagger: 20, hitstop: 8, stack: cutOpt(T.cuts), selfHs: 5 }, 'moonB');
    },
  },
  // ===== Ult: Blade of the Void (the opening draw; the window is p.uw) =====
  void_blade: {
    start(sim, p, a) { a.dur = 32; a.cancel = 24; a.moveMul = 0; a.lockMove = true; p.iframes = Math.max(p.iframes, 26); a.data.ox = p.x; a.data.oy = p.y; },
    tick(sim, p, a) {
      const V = SAM.voidCut;
      p.superArmor = true;
      if (a.t === 12) { dashAim(sim, p, a, 150, 5); a.data.t0 = 12; }
      if (a.data.t0 != null && a.t > 12 && a.t <= 17) { const k = (a.t - 12) / 5, d = a.data; p.x = d.fx + (d.lx - d.fx) * k; p.y = d.fy + (d.ly - d.fy) * k; }
      if (a.t === 16) { strike(sim, p, a, line(a.data.ox ?? p.x, a.data.oy ?? p.y, a.ang, V.len, V.w), { mul: V.mul, kb: 300, stagger: 30, poise: 20, hitstop: 12, selfHs: 8, stack: cutOpt(V.cuts), ult: true }, 'void'); gainFocus(sim, p, C().focus.ult / C().focus.ultMul, 'void'); }
    },
  },
  // Thousand Petal Storm (mob finisher): hundreds of cuts across the screen, then one sheathe click bursts them all
  thousand_petal_storm: {
    start(sim, p, a) { a.dur = 108; a.cancel = 108; a.lockMove = true; a.moveMul = 0; a.data.fin = 1; a.data.i = 0; p.iframes = Math.max(p.iframes, 114); a.data.ox = p.x; a.data.oy = p.y; },
    tick(sim, p, a) {
      const S = SAM.storm;
      p.superArmor = true; p.iframes = Math.max(p.iframes, 4);
      if (a.t >= S.from && a.t <= S.to && (a.t - S.from) % S.every === 0) {
        if (!Number.isFinite(a.data.ox)) { a.data.ox = p.x; a.data.oy = p.y; } a.data.i = a.data.i || 0;
        const list = targetsOf(sim).filter((e) => !e.dead && Math.hypot(e.x - a.data.ox, e.y - a.data.oy) < S.r + e.r);
        const i = a.data.i++, e = list.length ? list[i % list.length] : null, ang = i * 2.39996;
        const x = e ? e.x : a.data.ox + Math.cos(ang) * (120 + (i * 53) % 460), y = e ? e.y : a.data.oy + Math.sin(ang) * (90 + (i * 37) % 320);
        if (e && !sim.predicting) hitEnemy(sim, p, e, strikeOpts(p, a, { mul: S.mul, kb: 20, stagger: 6, hitstop: 1, stack: cutOpt(S.cuts), heavy: false, noFm: true }));
        sim.emit({ type: 'sam', ph: 'hit', pid: p.id, fx: 'storm', emp: 1, x: R0(x), y: R0(y), ang: r2(ang), i, n: e ? 1 : 0 });
      }
      if (a.t === 72) { if (Number.isFinite(a.data.ox) && Number.isFinite(a.data.oy)) { p.x = a.data.ox; p.y = a.data.oy; } sim.emit({ type: 'sam', ph: 'hit', pid: p.id, fx: 'stormpose', x: R0(p.x), y: R0(p.y), ang: r2(a.ang), n: 0 }); }
      if (a.t === S.burstAt) {
        sim.emit({ type: 'sam', ph: 'hit', pid: p.id, fx: 'stormclick', emp: 1, x: R0(p.x), y: R0(p.y), r: S.r, n: 0 });
        if (!sim.predicting) {
          let tot = 0, k = 0;
          for (const e of sim.enemies.filter((q) => !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < S.r + 80 + q.r)) {
            const n = takeStacks(sim, p, e, 'cut'); tot += n; k++;
            sim.emit({ type: 'samx', ph: 'burst', pid: p.id, id: e.id, x: R0(e.x), y: R0(e.y), r: e.r, n, fx: 'storm' });
            hitEnemy(sim, p, e, strikeOpts(p, a, { mul: (S.base + S.per * n) * (1 + (p.stats.cutDmg || 0)), kb: 260, knockup: 50, stagger: 40, poise: 30, hitstop: 14, bigNum: true }));
          }
          sim.emit({ type: 'samx', ph: 'stormburst', pid: p.id, x: R0(p.x), y: R0(p.y), n: tot, k });
        }
      }
      if (a.t === 102) endUltWindow(sim, p, 'thousand_petal_storm');
    },
  },
  // One Perfect Cut (boss finisher): the screen goes black, a single white line, the boss splits open
  one_perfect_cut: {
    start(sim, p, a) {
      a.dur = 120; a.cancel = 120; a.lockMove = true; a.moveMul = 0; a.data.fin = 1; p.iframes = Math.max(p.iframes, 126);
      const e = pickTarget(sim, p, a, SAM.perfect.range);
      if (e) { a.data.tid = e.id; a.ang = Math.atan2(e.y - p.y, e.x - p.x); }
      a.data.ox = p.x; a.data.oy = p.y;
    },
    tick(sim, p, a) {
      const P = SAM.perfect;
      p.superArmor = true; p.iframes = Math.max(p.iframes, 4);
      const e = byId(sim, a.data.tid);
      if (a.t < 40 && e && !e.dead) a.ang = Math.atan2(e.y - p.y, e.x - p.x);
      if (a.t < 44 && !sim.predicting) for (const q of sim.enemies) if (!q.dead && Math.hypot(q.x - p.x, q.y - p.y) < 800) q.hitstop = Math.max(q.hitstop, 3); // the world holds its breath
      if (a.t === 40) { const far = e && !e.dead ? Math.hypot(e.x - p.x, e.y - p.y) + e.r + p.r + 40 : 220; a.data.ox = p.x; a.data.oy = p.y; dashAim(sim, p, a, far, 3); a.data.t0 = 40; sim.emit({ type: 'sam', ph: 'hit', pid: p.id, fx: 'whiteline', emp: 1, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), len: R0((a.data.dd ?? 200) + 60), n: 0 }); }
      if (a.data.t0 != null && a.t > 40 && a.t <= 43) { const k = (a.t - 40) / 3, d = a.data; p.x = d.fx + (d.lx - d.fx) * k; p.y = d.fy + (d.ly - d.fy) * k; }
      if (a.t === 76) {
        let n = 0, mul = P.base;
        const set = new Set();
        if (e && !e.dead && !sim.predicting) {
          set.add(e.id); n = takeStacks(sim, p, e, 'cut'); mul = P.base + P.per * n;
          hitEnemy(sim, p, e, strikeOpts(p, a, { mul, forceCrit: true, pierce: true, poise: 90, stagger: 70, kb: 120, hitstop: 22, bigNum: true }));
        }
        sim.emit({ type: 'samx', ph: 'split', pid: p.id, id: e ? e.id : null, x: R0(e ? e.x : p.x), y: R0(e ? e.y : p.y), r: e ? e.r : 30, ang: r2(a.ang), n, mul: r2(mul * (a.data.fm || 1)) });
        strike(sim, p, a, line(a.data.ox ?? p.x, a.data.oy ?? p.y, a.ang, (a.data.dd || 200) + 60, 90), { mul: P.line, forceCrit: true, stagger: 40, kb: 160, hitstop: 10, selfHs: 10 }, 'splitline', set);
      }
      if (a.t === 108) endUltWindow(sim, p, 'one_perfect_cut');
    },
  },
};

