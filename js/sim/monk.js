// Monk: HIT COUNTER + PRESSURE POINTS, in the shared class structure (Q / E / R skills + 8 chains + a state + two ult finisher
// routes). Q = Tiger Fist (3-punch flurry), E = Crane Kick (dash + spinning launch kick), R = Flow State (a chi push, then 2 s
// of auto-dodging while moving; the next chain hits harder). Every landed hit feeds the hit counter (resets after 2 s without a
// hit); at 10 and 20 hits every chain EVOLVES (more hits, bigger areas, new looks). Every 5 hits on one target plant a
// Pressure Point (kit.js stack 'pp'); Shockwave Palm, Rising Dragon, Seven Seals and the finishers pop them. Chi (the
// resource) grows with every hit (faster at a higher tier); Hundred Hands Rush and Seven Seals spend all of it (up to x2), the
// finishers scale with it (kept). Awakened Spirit (ult): a golden spirit mirrors every hit for 10 s.
// Pure sim code: enemy changes run only in the authoritative sim; a predicting co-op client only times the moves and draws
// them ('monk' events; 'monkx' = server-only looks).
import { CLASSES } from './data/classes.js';
import { DT } from './constants.js';
import { pointBlocked, clearPath } from './world.js';
import { hitEnemy, hitEnemiesInShape } from './combat.js';
import { targetsOf, leapTick, dragIn } from './player.js';
import { addStacks, takeStacks, stackN, endUltWindow } from './kit.js';
import { tickBuffs } from './warrior.js';

/** Monk tuning (per-skill numbers live in the class data: skills[k].stats). Arrays = by hit-counter tier (0 / 10+ / 20+). */
export const MONK = {
  dmg: 2.5, // class-wide skill damage scale (tuned against the other classes' TTKs)
  tierMul: [1, 1.25, 1.55], // every chain's damage by tier
  sweep: { pmul: 1.0, pr: 120, parc: 1.4, mul: 1.4, r: [150, 185, 220], whirls: [1, 1, 2] },
  cyclone: { spins: [2, 3, 4], every: 9, r: [165, 195, 230], mul: 0.95, pull: 520 },
  rush: { hops: [8, 10, 12], every: 4, r: 420, mul: 0.7 },
  palm: { kmul: 0.8, kr: 100, len: [300, 360, 420], arc: 1.15, mul: 1.8, waves: [1, 1, 2] },
  rapid: { jabs: [6, 8, 10], every: 3, r: 125, arc: 1.3, mul: 0.5, range: 260 },
  nerve: { mul: 1.7, range: 280, slow: 180, slowMul: 0.6, pp: [1, 2, 3], back: 120 },
  seals: { n: 7, every: 5, mul: 0.9, r: 70, range: 460, popMul: 2, twice: [false, false, true] },
  dragon: { mul: 2.3, r: 135, arc: 1.9, knockup: 40, stagger: 60, poise: 50, back: 150, scale: [1, 1.25, 1.5] },
  spirit: { mul: 3.5, r: 230, mirror: 0.45, delay: 7, maxQ: 48 },
  fists: { r: 700, from: 6, to: 66, every: 1, mul: 0.35, slamAt: 76, base: 2, end: 98 },
  palmFin: { range: 560, popFrom: 12, popEvery: 3, blowAt: 72, base: 8, per: 0.8, end: 108 },
  release: 1.5, // the window ran out: Spirit Release pops every Pressure Point at x1.5
};
const R0 = (v) => Math.round(v);
const r2 = (v) => Math.round(v * 100) / 100;
export const isMonk = (p) => !!(p && p.monk && CLASSES[p.cls] && CLASSES[p.cls].fist);
const C = () => CLASSES.monk;
const SS = (k) => CLASSES.monk.skills[k].stats;

// ------------------------------------------------------------------ state
export function initMonk(p) { p.monk = { hc: 0, ht: 0, emp: 0, tick: -1, n: 0, pops: 0, mq: [] }; }
/** Hit-counter tier: 0 (under 10), 1 (10+), 2 (20+). */
export function monkTier(p) { if (!p || !p.monk) return 0; const T = C().combo.tiers; const hc = p.monk.hc; return hc >= T[1] ? 2 : hc >= T[0] ? 1 : 0; }

/** Chi gain (gear: Chi Gain; x2 in the ult window). Authoritative sim only. */
export function gainChi(sim, p, n, why = null) {
  if (sim.predicting || !(n > 0) || !CLASSES[p.cls].chiRes) return 0;
  const K = C().chi, before = p.res;
  p.res = Math.min(p.stats.maxRes, p.res + n * (1 + (p.stats.chiGain || 0)) * (p.uw ? K.ultMul : 1));
  const got = p.res - before;
  if (why && got >= 1) sim.emit({ type: 'monkx', ph: 'chi', pid: p.id, n: R0(got), why, x: R0(p.x), y: R0(p.y - 56) });
  return got;
}

/** Per tick: hit-counter timer, Chi drain, the spirit's mirror echoes. */
export function tickMonk(sim, p) {
  tickBuffs(p);
  if (!isMonk(p)) return;
  const M = p.monk, K = C().chi, CB = C().combo;
  if (sim.predicting) return;
  if (p.uw && M.hc < CB.ult) M.hc = CB.ult; // Awakened Spirit: the counter stays at the top tier
  if (M.ht > 0 && --M.ht === 0 && !p.uw) { if (M.hc >= CB.tiers[0]) sim.emit({ type: 'monkx', ph: 'drop', pid: p.id, n: M.hc, x: R0(p.x), y: R0(p.y) }); M.hc = 0; }
  if (p.res > 0 && !p.uw && sim.tick - (p.lastCombat || 0) > K.drainAfter) p.res = Math.max(0, p.res - K.drain * DT);
  if (M.mq.length) { // spirit echoes land a moment after your hits
    const due = M.mq.filter((q) => q.at <= sim.tick);
    if (due.length) {
      M.mq = M.mq.filter((q) => q.at > sim.tick);
      let shown = 0;
      for (const q of due) {
        const e = byId(sim, q.id);
        if (!e || e.dead) continue;
        hitEnemy(sim, p, e, { mul: q.mul, dmgMul: q.dm, kb: 0, hitstop: 1, style: 'spirit', ult: true, mirror: true, noPop: true });
        if (shown++ < 3) sim.emit({ type: 'monkx', ph: 'mirror', pid: p.id, id: e.id, x: R0(e.x), y: R0(e.y), r: e.r, ang: r2(Math.atan2(e.y - p.y, e.x - p.x)) });
      }
    }
  }
}

/** After a Monk hit lands (authoritative): hit counter, Chi, Pressure Point progress, spirit mirror. */
export function monkOnHit(sim, p, e, o) {
  if (sim.predicting || o.dot || o.mirror || !isMonk(p)) return;
  const M = p.monk, K = C().chi, CB = C().combo, P = C().pp;
  // hit counter (at most `perTick` a tick: a wide AoE doesn't jump it by 8)
  if (M.tick !== sim.tick) { M.tick = sim.tick; M.tc = 0; }
  if (M.tc < CB.perTick) {
    M.tc++;
    const t0 = monkTier(p);
    M.hc++; M.ht = CB.reset;
    const t1 = monkTier(p);
    if (t1 > t0) sim.emit({ type: 'monkx', ph: 'tier', pid: p.id, tier: t1, name: CB.names[t1], x: R0(p.x), y: R0(p.y) });
    const act = p.action;
    const add = act ? Math.min(K.hit * K.tierMul[t1], K.hitCap - (act.cg || 0)) : K.hit;
    if (add > 0) { if (act) act.cg = (act.cg || 0) + add; gainChi(sim, p, add); }
  }
  // Pressure Points: every 5 hits on the same target plant one
  if (!e.dead && !o.ult) {
    const c = e.mpc && e.mpc.pid === p.id ? e.mpc : (e.mpc = { pid: p.id, n: 0 });
    c.n += o.ppx || 1;
    while (c.n >= P.every) { c.n -= P.every; addStacks(sim, p, e, 'pp', 1); }
  }
  // Awakened Spirit: the spirit mirrors the hit
  if (p.uw && !e.dead && M.mq.length < MONK.spirit.maxQ) M.mq.push({ id: e.id, at: sim.tick + MONK.spirit.delay, mul: (o.mul || 1) * MONK.spirit.mirror, dm: o.dmgMul || 1 });
}

/** Flow State auto-dodge (combat.js damagePlayer): moving in Flow = the hit misses. Returns true when dodged. */
export function monkDodge(sim, p, src, o = {}) {
  if (!isMonk(p) || !p.cst || o.raw || o.pct) return false;
  if (!(p.moving || (p.action && p.action.lockMove))) return false;
  if (sim.tick - (p.monk.dg || -99) > 12) { // (one look per burst of hits)
    p.monk.dg = sim.tick;
    const ang = src && src.x != null ? Math.atan2(p.y - src.y, p.x - src.x) : p.aim;
    sim.emit({ type: 'monkx', ph: 'dodge', pid: p.id, x: R0(p.x), y: R0(p.y), ang: r2(ang) });
    gainChi(sim, p, C().chi.dodge, 'dodge');
  }
  p.iframes = Math.max(p.iframes, 6);
  return true;
}

/** A skill / chain / finisher starts (player.js): tier + Flow empowerment + Chi spenders; tell the clients. */
export function monkCast(sim, p, a, key, chain) {
  if (!isMonk(p)) return;
  const K = C().chi, fin = !!(chain && chain.route), id = chain ? chain.id : a.id, tier = monkTier(p);
  a.data.tier = tier;
  if (chain && !fin && p.monk.emp) { a.data.fe = C().flowSt.emp; p.monk.emp = 0; }
  if (key === 'R' && !fin) p.monk.emp = 1; // Flow State (and Nerve Strike / Rising Dragon, which open it): the next chain is empowered
  if (id === 'hundred_hands' || id === 'seven_seals' || fin) {
    a.data.fm = 1 + (fin ? K.finMax : K.spendMax) * Math.min(1, p.res / 100);
    if (!sim.predicting && !fin && !p.uw) p.res = 0; // (Awakened Spirit: the window's Chi is not spent)
  }
  if (fin) sim.emit({ type: 'monk', ph: 'fin', pid: p.id, id, route: chain.route, name: chain.name, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), fm: r2(a.data.fm || 1) });
  else sim.emit({ type: 'monk', ph: 'cast', pid: p.id, id, key, chain: chain ? 1 : undefined, tier, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), fm: a.data.fm > 1.01 ? r2(a.data.fm) : undefined, fe: a.data.fe ? 1 : undefined });
}
/** Flow opened (after the cast: kit.js afterCastState via player.js): the next chain is empowered. */
export function monkFlow(p) { if (isMonk(p)) p.monk.emp = 1; }

/** The HUD's view. */
export function monkInfo(p) { if (!p.monk) return null; const T = C().combo; return { hc: p.monk.hc, ht: p.monk.ht, tier: monkTier(p), next: T.tiers[monkTier(p)] || null, emp: p.monk.emp, reset: T.reset, name: T.names[monkTier(p)] }; }
/** Total Pressure Points this Monk has on live enemies near (x, y). */
export function ppNear(sim, p, r = 900) {
  let n = 0, k = 0;
  for (const e of targetsOf(sim)) { if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > r) continue; const c = stackN(e, 'pp', p.id); if (c) { n += c; k++; } }
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
function lerpDash(p, a, t0, T) { const d = a.data; if (d.t0 == null || a.t <= t0 || a.t > t0 + T) return; const k = (a.t - t0) / T, e = k * (2 - k); p.x = d.fx + (d.lx - d.fx) * e; p.y = d.fy + (d.ly - d.fy) * e; }
const tm = (a) => MONK.tierMul[a.data.tier || 0];
function strikeOpts(p, a, o) {
  let mul = MONK.dmg;
  if (a.chain && !a.chain.route) mul *= (1 + (p.stats.chainDmg || 0)) * tm(a) * (a.data.fe || 1);
  if (a.data.fm && !o.noFm) mul *= a.data.fm;
  return { hitstop: 4, heavy: true, ...o, dmgMul: (o.dmgMul || 1) * mul, style: o.style || 'monk', ult: o.ult || !!a.data.fin || undefined };
}
/** Hit a shape and tell the clients what to draw. fx: the look (client/fxmonk.js). */
function strike(sim, p, a, sh, o, fx, set = null, srv = false) {
  const oo = strikeOpts(p, a, o);
  const n = sim.predicting ? 0 : hitEnemiesInShape(sim, p, sh, oo, set);
  if (n > 0 && !sim.predicting) p.hitstop = Math.max(p.hitstop, o.selfHs ?? Math.min(5, (o.hitstop ?? 4) - 1));
  sim.emit({ type: srv ? 'monkx' : 'monk', ph: 'hit', pid: p.id, fx, tier: a.data.tier || 0, emp: a.chain || a.data.fin ? 1 : undefined, x: R0(sh.x), y: R0(sh.y), ang: r2(sh.ang ?? a.ang), r: sh.r, arc: sh.arc, len: sh.len, lw: sh.w, shape: sh.shape, n });
  return n;
}
const circ = (p, r, x = p.x, y = p.y) => ({ shape: 'circle', x, y, r });
const cone = (p, a, r, arc, ang = a.ang) => ({ shape: 'cone', x: p.x, y: p.y, ang, arc, r });
const byId = (sim, id) => (id == null ? null : (sim.enemyById && sim.enemyById.get(id)) || sim.enemies.find((q) => q.id === id) || null);
function pickTarget(sim, p, a, range) {
  let best = null, bs = Infinity;
  for (const e of targetsOf(sim)) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > range + e.r) continue;
    const s = Math.hypot(e.x - a.data.tx, e.y - a.data.ty) * 0.4 + d * 0.3 - (e.boss ? 900 : e.elite ? 400 : 0) - stackN(e, 'pp', p.id) * 20;
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}
/** Step up to a target (stops in front of it). */
function closeIn(sim, p, a, e, T) { a.ang = Math.atan2(e.y - p.y, e.x - p.x); const stop = e.r + p.r + 8; if (Math.hypot(e.x - p.x, e.y - p.y) > stop + 8) { dashTo(sim, p, a, e.x - Math.cos(a.ang) * stop, e.y - Math.sin(a.ang) * stop, T); a.data.t0 = 0; } }

/** Pop `p`'s Pressure Points on `e`: ×(per × n × mul) ATK. Returns how many popped. Authoritative sim only. */
export function popPoints(sim, p, a, e, { mul = 1, fx = 'pop', ult = false } = {}) {
  if (sim.predicting || !e || e.dead) return 0;
  const n = takeStacks(sim, p, e, 'pp');
  if (!n) return 0;
  const m = C().pp.per * n * mul * (1 + (p.stats.ppDmg || 0));
  sim.emit({ type: 'monkx', ph: 'pop', pid: p.id, id: e.id, x: R0(e.x), y: R0(e.y), r: e.r, n, fx });
  hitEnemy(sim, p, e, strikeOpts(p, a, { mul: m, stagger: 12 + n * 3, kb: 80, hitstop: 7, noPop: true, style: 'monkpop', ult: ult || undefined, noFm: true, bigNum: n >= 4 || undefined, mirror: true }));
  p.monk.pops += n;
  return n;
}
/** Pop the Pressure Points of every enemy in a shape. */
function popIn(sim, p, a, test, o) { let t = 0; if (sim.predicting) return 0; for (const e of sim.enemies) if (!e.dead && stackN(e, 'pp', p.id) && test(e)) t += popPoints(sim, p, a, e, o); return t; }
const inCircle = (x, y, r) => (e) => Math.hypot(e.x - x, e.y - y) < r + e.r;
function inCone(p, ang, r, arc) { return (e) => { const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy); if (d > r + e.r) return false; let da = Math.atan2(dy, dx) - ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; return Math.abs(da) <= arc / 2 + Math.atan2(e.r, Math.max(1, d)); }; }

/** The ult window timed out without a finisher: Spirit Release (kit.js endUltWindow). */
export function spiritRelease(sim, p) {
  if (!isMonk(p)) return;
  sim.emit({ type: 'monk', ph: 'hit', pid: p.id, fx: 'release', tier: 2, x: R0(p.x), y: R0(p.y), r: 700, n: 0 });
  p.monk.mq = [];
  popIn(sim, p, { data: {}, chain: null }, inCircle(p.x, p.y, 760), { mul: MONK.release, fx: 'release', ult: true });
}

// ------------------------------------------------------------------ the moves (skill / chain / finisher id -> { start, tick })
export const MONK_SKILLS = {
  // ===== G: Iron Palm (plants a Pressure Point) =====
  iron_palm: {
    start(sim, p, a) { a.dur = 22; a.cancel = 14; a.moveMul = 0.15; },
    tick(sim, p, a) {
      const s = SS('F');
      if (a.t < 6) { p.x += Math.cos(a.ang) * s.step / 6; p.y += Math.sin(a.ang) * s.step / 6; }
      if (a.t === 7) strike(sim, p, a, cone(p, a, s.r, s.arc), { mul: s.mul, kb: 260, stagger: 16, hitstop: 7, stack: ['pp', s.pp], poise: 10 }, 'ironpalm');
    },
  },
  // ===== Q: Tiger Fist =====
  tiger_fist: {
    start(sim, p, a) { const s = SS('Q'); a.dur = s.hits * s.every + 8; a.cancel = s.hits * s.every + 2; a.moveMul = 0.35; },
    tick(sim, p, a) {
      const s = SS('Q');
      if (a.t < s.hits * s.every) { p.x += Math.cos(a.ang) * s.step / (s.hits * s.every); p.y += Math.sin(a.ang) * s.step / (s.hits * s.every); }
      if (a.t >= 2 && (a.t - 2) % s.every === 0 && (a.t - 2) / s.every < s.hits) { const i = (a.t - 2) / s.every; strike(sim, p, a, cone(p, a, s.r, s.arc), { mul: s.mul, kb: i === s.hits - 1 ? s.kb * 2 : s.kb, stagger: 8, hitstop: 3, heavy: i === s.hits - 1 }, 'tiger' + i); }
    },
  },
  // ===== E: Crane Kick =====
  crane_kick: {
    start(sim, p, a) { const s = SS('E'); a.dur = 22; a.cancel = 15; dashAim(sim, p, a, s.dash, 6); },
    tick(sim, p, a) {
      const s = SS('E');
      leapTick(p, a, 6);
      if (a.t === 7) strike(sim, p, a, circ(p, s.r), { mul: s.mul, kb: 140, knockup: s.knockup, stagger: 14, hitstop: 5 }, 'crane');
    },
  },
  // ===== R: Flow State (opens Flow) =====
  flow_state: {
    start(sim, p, a) { const s = SS('R'); a.dur = s.dur; a.cancel = s.cancel; a.moveMul = 0.6; p.iframes = Math.max(p.iframes, 10); },
    tick(sim, p, a) { const s = SS('R'); if (a.t === 4) strike(sim, p, a, circ(p, s.r), { mul: s.mul, kb: 220, stagger: 10, hitstop: 3 }, 'flow'); },
  },
  // ===== mob chains =====
  dragon_sweep: { // Q -> E: a driving punch into a whirlwind kick
    start(sim, p, a) { a.dur = 30; a.cancel = 22; a.moveMul = 0.25; if (MONK.sweep.whirls[a.data.tier || 0] > 1) { a.dur = 38; a.cancel = 30; } },
    tick(sim, p, a) {
      const S = MONK.sweep, T = a.data.tier || 0;
      if (a.t < 6) { p.x += Math.cos(a.ang) * 8; p.y += Math.sin(a.ang) * 8; }
      if (a.t === 5) strike(sim, p, a, cone(p, a, S.pr, S.parc), { mul: S.pmul, kb: 90, stagger: 10, hitstop: 4 }, 'sweeppunch');
      if (a.t === 13) strike(sim, p, a, circ(p, S.r[T]), { mul: S.mul, kb: 200, stagger: 16, hitstop: 5, knockup: 18 }, 'sweep');
      if (a.t === 22 && S.whirls[T] > 1) strike(sim, p, a, circ(p, S.r[T] * 1.1), { mul: S.mul * 0.8, kb: 240, stagger: 16, hitstop: 5, knockup: 24 }, 'sweep2');
    },
  },
  cyclone_kick: { // E -> E: spin kicks that pull the pack in
    start(sim, p, a) { const Y = MONK.cyclone, n = Y.spins[a.data.tier || 0]; a.dur = 6 + n * Y.every + 6; a.cancel = a.dur - 5; a.moveMul = 0.45; },
    tick(sim, p, a) {
      const Y = MONK.cyclone, T = a.data.tier || 0, n = Y.spins[T];
      if (!sim.predicting && a.t < 4 + n * Y.every) dragIn(sim, p, Y.r[T] + 90, Y.pull, 0.1);
      if (a.t >= 4 && (a.t - 4) % Y.every === 0 && (a.t - 4) / Y.every < n) { const i = (a.t - 4) / Y.every; strike(sim, p, a, circ(p, Y.r[T]), { mul: Y.mul, kb: i === n - 1 ? 230 : 20, stagger: 12, hitstop: 3, knockup: i === n - 1 ? 22 : 0 }, 'cyclone'); }
    },
  },
  hundred_hands: { // Flow: R -> Q -> E: dash between enemies punching each (Chi spent)
    start(sim, p, a) {
      const H = MONK.rush, hops = H.hops[a.data.tier || 0];
      a.data.hops = hops; a.dur = hops * H.every + 14; a.cancel = a.dur - 4; a.lockMove = true; p.iframes = Math.max(p.iframes, a.dur);
      const near = targetsOf(sim).filter((e) => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < H.r + e.r).sort((x, y) => Math.hypot(x.x - p.x, x.y - p.y) - Math.hypot(y.x - p.x, y.y - p.y));
      a.data.ids = near.slice(0, hops).map((e) => e.id); a.data.i = 0;
    },
    tick(sim, p, a) {
      const H = MONK.rush;
      p.iframes = Math.max(p.iframes, 3);
      if (a.t < 2 || (a.t - 2) % H.every || a.data.i >= (a.data.hops || 8)) return;
      const i = a.data.i++, ids = a.data.ids || [];
      const e = ids.length ? byId(sim, ids[i % ids.length]) : null;
      const fx = p.x, fy = p.y;
      if (e && !e.dead) {
        const ang = Math.atan2(e.y - p.y, e.x - p.x) + (i % 2 ? 0.6 : -0.6), t = offWalls(sim, p, e.x - Math.cos(ang) * (e.r + p.r + 10), e.y - Math.sin(ang) * (e.r + p.r + 10));
        p.x = t.x; p.y = t.y; a.ang = Math.atan2(e.y - p.y, e.x - p.x);
        if (!sim.predicting) hitEnemy(sim, p, e, strikeOpts(p, a, { mul: H.mul, kb: 40, stagger: 8, hitstop: 2, heavy: false }));
      } else a.ang += 2.1;
      sim.emit({ type: 'monk', ph: 'hit', pid: p.id, fx: 'rush', tier: a.data.tier || 0, emp: 1, x: R0(p.x), y: R0(p.y), fx0: R0(fx), fy0: R0(fy), ang: r2(a.ang), i, n: e ? 1 : 0 });
    },
  },
  shockwave_palm: { // E -> Q: kick, then a palm cone shockwave that pops Pressure Points
    start(sim, p, a) { const W = MONK.palm.waves[a.data.tier || 0]; a.dur = W > 1 ? 34 : 26; a.cancel = a.dur - 8; a.moveMul = 0.15; },
    tick(sim, p, a) {
      const W = MONK.palm, T = a.data.tier || 0;
      if (a.t === 4) strike(sim, p, a, circ(p, W.kr), { mul: W.kmul, kb: 60, stagger: 8, hitstop: 3 }, 'palmkick');
      if (a.t === 12 || (a.t === 21 && W.waves[T] > 1)) {
        const second = a.t === 21;
        strike(sim, p, a, cone(p, a, W.len[T], W.arc), { mul: W.mul * (second ? 0.6 : 1), kb: 320, stagger: 20, hitstop: 6 }, second ? 'palm2' : 'palm');
        if (!second) popIn(sim, p, a, inCone(p, a.ang, W.len[T], W.arc), { fx: 'palm' });
      }
    },
  },
  // ===== boss chains =====
  rapid_strikes: { // Q -> Q: lightning jabs on one target; each counts double toward Pressure Points
    start(sim, p, a) {
      const J = MONK.rapid, n = J.jabs[a.data.tier || 0];
      a.data.n = n; a.dur = 4 + n * J.every + 8; a.cancel = a.dur - 5; a.moveMul = 0.1;
      const e = pickTarget(sim, p, a, J.range);
      if (e) { a.data.tid = e.id; closeIn(sim, p, a, e, 4); }
    },
    tick(sim, p, a) {
      const J = MONK.rapid, n = a.data.n || 6;
      if (a.data.t0 != null) lerpDash(p, a, 0, 4);
      const e = byId(sim, a.data.tid);
      if (e && !e.dead) a.ang = Math.atan2(e.y - p.y, e.x - p.x);
      if (a.t >= 4 && (a.t - 4) % J.every === 0 && (a.t - 4) / J.every < n) { const i = (a.t - 4) / J.every; strike(sim, p, a, cone(p, a, J.r, J.arc), { mul: J.mul, kb: i === n - 1 ? 160 : 8, stagger: 6, hitstop: 2, heavy: i === n - 1, ppx: 2, selfHs: 1 }, 'jab'); }
    },
  },
  nerve_strike: { // Q -> R: dash in, a nerve punch (slow + Pressure Points), flip out (opens Flow)
    start(sim, p, a) {
      const N = MONK.nerve; a.dur = 30; a.cancel = 22; a.moveMul = 0;
      const e = pickTarget(sim, p, a, N.range);
      if (e) { a.data.tid = e.id; closeIn(sim, p, a, e, 5); }
      p.iframes = Math.max(p.iframes, 10);
    },
    tick(sim, p, a) {
      const N = MONK.nerve, T = a.data.tier || 0;
      if (a.data.t0 === 0) lerpDash(p, a, 0, 5);
      const e = byId(sim, a.data.tid);
      if (a.t === 7) {
        if (e && !e.dead) a.ang = Math.atan2(e.y - p.y, e.x - p.x);
        strike(sim, p, a, cone(p, a, 130, 1.2), { mul: N.mul, kb: 60, stagger: 20, hitstop: 7, slow: N.slow, slowMul: N.slowMul, poise: 15 }, 'nerve');
        if (e && !e.dead && !sim.predicting && Math.hypot(e.x - p.x, e.y - p.y) < 170 + e.r) addStacks(sim, p, e, 'pp', N.pp[T]);
      }
      if (a.t === 12) { dashTo(sim, p, a, p.x - Math.cos(a.ang) * N.back, p.y - Math.sin(a.ang) * N.back, 8); a.data.t0 = 12; sim.emit({ type: 'monk', ph: 'hit', pid: p.id, fx: 'flip', tier: T, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), n: 0 }); }
      if (a.data.t0 === 12) lerpDash(p, a, 12, 8);
    },
  },
  seven_seals: { // Flow: R -> E -> Q: 7 seals on the target explode in sequence; the 7th pops the Pressure Points (Chi spent)
    start(sim, p, a) {
      const S = MONK.seals; a.dur = 14 + S.n * S.every + 12; a.cancel = a.dur - 6; a.moveMul = 0.1; p.iframes = Math.max(p.iframes, 14);
      const e = pickTarget(sim, p, a, S.range);
      if (e) { a.data.tid = e.id; a.ang = Math.atan2(e.y - p.y, e.x - p.x); }
      const tx = e ? e.x : p.x + Math.cos(a.ang) * 160, ty = e ? e.y : p.y + Math.sin(a.ang) * 160, r = e ? e.r * 0.8 + 10 : 50;
      a.data.pts = Array.from({ length: S.n }, (_, i) => { const g = -Math.PI / 2 + (i / S.n) * Math.PI * 2; return [R0(tx + Math.cos(g) * r), R0(ty + Math.sin(g) * r)]; });
      sim.emit({ type: 'monk', ph: 'hit', pid: p.id, fx: 'sealmark', tier: a.data.tier || 0, emp: 1, x: R0(tx), y: R0(ty), r: R0(r), n: 0 });
    },
    tick(sim, p, a) {
      const S = MONK.seals, T = a.data.tier || 0;
      if (a.t < 14 || (a.t - 14) % S.every) return;
      const i = (a.t - 14) / S.every;
      if (i >= S.n) return;
      const e = byId(sim, a.data.tid);
      const pt = a.data.pts && a.data.pts[i], live = e && !e.dead;
      const px = pt ? pt[0] : live ? e.x : p.x, py = pt ? pt[1] : live ? e.y : p.y; // (the seal's mark; the burst lands on the target)
      strike(sim, p, a, circ(p, S.r, live ? e.x : px, live ? e.y : py), { mul: S.mul * (S.twice[T] ? 1.3 : 1), kb: i === S.n - 1 ? 260 : 10, stagger: 12, hitstop: i === S.n - 1 ? 10 : 3, poise: 6 }, 'seal');
      sim.emit({ type: 'monk', ph: 'hit', pid: p.id, fx: 'sealpop', tier: T, emp: 1, x: R0(px), y: R0(py), i, n: 0 });
      if (p.uw && e && !e.dead && !sim.predicting) addStacks(sim, p, e, 'pp', 1); // in the ult window each seal PLANTS a Pressure Point instead (Heaven-Splitting Palm pops them)
      else if (i === S.n - 1 && e && !e.dead) popPoints(sim, p, a, e, { mul: S.popMul, fx: 'seal' });
    },
  },
  rising_dragon: { // E -> R: a dragon uppercut that interrupts and pops, then a dodge back (opens Flow)
    start(sim, p, a) { a.dur = 32; a.cancel = 24; a.moveMul = 0; p.iframes = Math.max(p.iframes, 12); const e = pickTarget(sim, p, a, 220); if (e) { a.data.tid = e.id; closeIn(sim, p, a, e, 4); } },
    tick(sim, p, a) {
      const D = MONK.dragon, T = a.data.tier || 0, sc = D.scale[T];
      if (a.data.t0 === 0) lerpDash(p, a, 0, 4);
      if (a.t === 7) {
        const e = byId(sim, a.data.tid); if (e && !e.dead) a.ang = Math.atan2(e.y - p.y, e.x - p.x);
        const set = new Set();
        strike(sim, p, a, cone(p, a, D.r * sc, D.arc), { mul: D.mul, knockup: D.knockup, stagger: D.stagger, poise: D.poise, kb: 120, hitstop: 10, selfHs: 6 }, 'dragon', set);
        popIn(sim, p, a, inCone(p, a.ang, D.r * sc, D.arc), { fx: 'dragon' });
      }
      if (a.t === 13) { dashTo(sim, p, a, p.x - Math.cos(a.ang) * D.back, p.y - Math.sin(a.ang) * D.back, 8); a.data.t0 = 13; }
      if (a.data.t0 === 13) lerpDash(p, a, 13, 8);
    },
  },
  // ===== Ult: Awakened Spirit (the opening slam; the window is p.uw) =====
  awakened_spirit: {
    start(sim, p, a) { a.dur = 34; a.cancel = 26; a.moveMul = 0; a.lockMove = true; p.iframes = Math.max(p.iframes, 30); },
    tick(sim, p, a) {
      const S = MONK.spirit;
      p.superArmor = true;
      if (a.t === 18) {
        strike(sim, p, a, circ(p, S.r), { mul: S.mul, kb: 320, knockup: 40, stagger: 30, poise: 20, hitstop: 12, selfHs: 8, ult: true }, 'spiritslam');
        if (!sim.predicting) { p.monk.hc = Math.max(p.monk.hc, C().combo.ult); p.monk.ht = C().combo.reset; sim.emit({ type: 'monkx', ph: 'tier', pid: p.id, tier: 2, name: C().combo.names[2], x: R0(p.x), y: R0(p.y) }); }
        gainChi(sim, p, C().chi.ult / C().chi.ultMul, 'spirit');
      }
    },
  },
  // Hundred Fists (mob finisher): the spirit pummels everything on screen, then slams both palms down
  hundred_fists: {
    start(sim, p, a) { const F = MONK.fists; a.dur = F.end + 8; a.cancel = a.dur; a.lockMove = true; a.moveMul = 0; a.data.fin = 1; a.data.i = 0; p.iframes = Math.max(p.iframes, a.dur + 6); a.data.ox = p.x; a.data.oy = p.y; },
    tick(sim, p, a) {
      const F = MONK.fists;
      p.superArmor = true; p.iframes = Math.max(p.iframes, 4);
      const ox = a.data.ox ?? p.x, oy = a.data.oy ?? p.y;
      if (a.t >= F.from && a.t <= F.to && (a.t - F.from) % F.every === 0) {
        const list = targetsOf(sim).filter((e) => !e.dead && Math.hypot(e.x - ox, e.y - oy) < F.r + e.r);
        const i = a.data.i++, e = list.length ? list[i % list.length] : null, ang = i * 2.39996;
        const x = e ? e.x + Math.cos(ang) * e.r * 0.5 : ox + Math.cos(ang) * (120 + (i * 53) % 480), y = e ? e.y + Math.sin(ang) * e.r * 0.5 : oy + Math.sin(ang) * (90 + (i * 37) % 320);
        if (e && !sim.predicting) hitEnemy(sim, p, e, strikeOpts(p, a, { mul: F.mul, kb: 16, stagger: 5, hitstop: 1, heavy: false, noFm: true }));
        sim.emit({ type: 'monk', ph: 'hit', pid: p.id, fx: 'fist', tier: 2, emp: 1, x: R0(x), y: R0(y), ang: r2(Math.atan2(y - oy, x - ox)), i, n: e ? 1 : 0 });
      }
      if (a.t === F.slamAt) {
        sim.emit({ type: 'monk', ph: 'hit', pid: p.id, fx: 'fistslam', tier: 2, emp: 1, x: R0(ox), y: R0(oy), r: F.r, n: 0 });
        if (!sim.predicting) {
          let tot = 0, k = 0;
          for (const e of sim.enemies.filter((q) => !q.dead && Math.hypot(q.x - ox, q.y - oy) < F.r + 60 + q.r)) {
            const n = takeStacks(sim, p, e, 'pp'); tot += n; k++;
            if (n) sim.emit({ type: 'monkx', ph: 'pop', pid: p.id, id: e.id, x: R0(e.x), y: R0(e.y), r: e.r, n, fx: 'fists' });
            hitEnemy(sim, p, e, strikeOpts(p, a, { mul: (F.base + C().pp.per * n) * (1 + (n ? p.stats.ppDmg || 0 : 0)), kb: 280, knockup: 55, stagger: 40, poise: 30, hitstop: 14, bigNum: true }));
          }
          sim.emit({ type: 'monkx', ph: 'fistsburst', pid: p.id, x: R0(ox), y: R0(oy), n: tot, k });
        }
      }
      if (a.t === F.end) endUltWindow(sim, p, 'hundred_fists');
    },
  },
  // Heaven-Splitting Palm (boss finisher): every Pressure Point pops in sequence, then one palm detonates the target
  heaven_splitting_palm: {
    start(sim, p, a) {
      const H = MONK.palmFin; a.dur = H.end + 10; a.cancel = a.dur; a.lockMove = true; a.moveMul = 0; a.data.fin = 1; p.iframes = Math.max(p.iframes, a.dur + 6);
      const e = pickTarget(sim, p, a, H.range);
      if (e) { a.data.tid = e.id; a.ang = Math.atan2(e.y - p.y, e.x - p.x); }
      a.data.ox = p.x; a.data.oy = p.y;
      if (!sim.predicting) { a.data.q = sim.enemies.filter((q) => !q.dead && q !== e && stackN(q, 'pp', p.id) && Math.hypot(q.x - p.x, q.y - p.y) < 800).map((q) => q.id); a.data.tpp = e ? stackN(e, 'pp', p.id) : 0; }
    },
    tick(sim, p, a) {
      const H = MONK.palmFin;
      p.superArmor = true; p.iframes = Math.max(p.iframes, 4);
      const e = byId(sim, a.data.tid);
      if (e && !e.dead && a.t < H.blowAt) a.ang = Math.atan2(e.y - p.y, e.x - p.x);
      if (a.t < H.blowAt - 20 && !sim.predicting) for (const q of sim.enemies) if (!q.dead && Math.hypot(q.x - p.x, q.y - p.y) < 800) q.hitstop = Math.max(q.hitstop, 3); // the world holds still
      if (a.t >= H.popFrom && a.t < H.blowAt - 16 && (a.t - H.popFrom) % H.popEvery === 0 && !sim.predicting) { // the other Pressure Points pop in sequence
        const id = a.data.q && a.data.q.shift();
        const q = byId(sim, id);
        if (q && !q.dead) popPoints(sim, p, a, q, { fx: 'heaven', ult: true });
      }
      if (a.t === H.blowAt - 22 && e && !e.dead) { const stop = e.r + p.r + 6; dashTo(sim, p, a, e.x - Math.cos(a.ang) * stop, e.y - Math.sin(a.ang) * stop, 6); a.data.t0 = H.blowAt - 22; sim.emit({ type: 'monk', ph: 'hit', pid: p.id, fx: 'palmcharge', tier: 2, emp: 1, x: R0(e.x), y: R0(e.y), r: e.r, ang: r2(a.ang), n: 0 }); }
      if (a.data.t0 === H.blowAt - 22) lerpDash(p, a, H.blowAt - 22, 6);
      if (a.t === H.blowAt) {
        let n = 0, mul = H.base;
        if (e && !e.dead && !sim.predicting) {
          n = takeStacks(sim, p, e, 'pp'); mul = H.base + H.per * n * (1 + (p.stats.ppDmg || 0));
          hitEnemy(sim, p, e, strikeOpts(p, a, { mul, forceCrit: true, pierce: true, poise: 90, stagger: 70, kb: 200, hitstop: 22, bigNum: true }));
        }
        const set = new Set(e ? [e.id] : []);
        sim.emit({ type: 'monkx', ph: 'heaven', pid: p.id, id: e ? e.id : null, x: R0(e ? e.x : p.x), y: R0(e ? e.y : p.y), r: e ? e.r : 30, ang: r2(a.ang), n, mul: r2(mul * (a.data.fm || 1)) });
        strike(sim, p, a, circ(p, 200, e ? e.x : p.x, e ? e.y : p.y), { mul: 2.0, forceCrit: true, stagger: 40, kb: 260, hitstop: 10, selfHs: 10 }, 'heavenring', set);
      }
      if (a.t === H.end) endUltWindow(sim, p, 'heaven_splitting_palm');
    },
  },
};
