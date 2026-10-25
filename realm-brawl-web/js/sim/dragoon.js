// Dragoon: DRAGON BLOOD + IMPALED, in the shared class structure (Q / E / R skills + 8 chains + a state + two ult finisher routes,
// plus the Special Dragon's Roar and its 4 F chains). Q = Piercing Thrust (long piercing lunge, pins), E = Sweeping Arc (wide
// spin, knockback), R = Jump (leap off screen, invulnerable, crash at your aim; opens SKYBORNE for 2 s after landing).
// IMPALED (kit.js stack 'impaled'): spear thrusts pin enemies; every DIVE (a landing / sky strike) rips the pins out for bonus
// damage. DRAGON BLOOD (the resource) is built only by landing dive hits; the Skyborne chains spend all of it (up to x1.6), the
// finishers scale with it (kept). Dragon's Roar (F) scorches a line of enemies: each SCORCHED enemy (stack 'scorch') is a dive
// target - for 5 s your Jump homes onto the scorched enemy nearest your aim and comes back at once, chaining up to 3 dives.
// Dragon Form (ult): 10 s, jumps nearly free, the dragon spirit follows you and adds a fire burst to every dive.
// Pure sim code: enemy changes run only in the authoritative sim; a predicting co-op client only times / moves the hero and
// draws ('drg' events; 'drgx' = server-only looks).
import { defLand } from './defense.js';
import { CLASSES } from './data/classes.js';
import { DT } from './constants.js';
import { pointBlocked, clearPath } from './world.js';
import { hitEnemy, hitEnemiesInShape } from './combat.js';
import { targetsOf, dragIn } from './player.js';
import { addStacks, takeStacks, stackN, endUltWindow } from './kit.js';
import { tickBuffs } from './warrior.js';

/** Dragoon tuning (per-skill numbers live in the class data: skills[k].stats). */
export const DRG = {
  dmg: 2.4, // class-wide skill damage scale
  sky: 1.2, // Skyborne: the next chain hits x1.2
  pin: { per: 0.4 }, // each pin a dive rips out: x0.4 ATK (more with Impaled Damage gear)
  whirl: { r: 160, smul: 0.9, len: 380, w: 70, mul: 1.9, lunge: 90 },
  tempest: { spins: 3, every: 10, r: 190, mul: 0.8, pull: 620 },
  dive: { range: 340, T: 20, r: 240, mul: 2.6, knockup: 45 },
  barrage: { hops: 3, every: 12, T: 9, r: 135, mul: 1.5, range: 560 },
  impale: { range: 300, len: 230, w: 74, mul: 1.4, pins: 2 },
  spine: { range: 340, tmul: 1.2, T: 18, r: 135, mul: 2.2, pinMul: 1.6 },
  high: { min: 30, max: 72, range: 460, r: 155, base: 2.0, grow: 2.8 },
  geir: { rise: 12, at: 20, len: 760, w: 120, mul: 3.6, land: 32 },
  roar: { at: 10, pulses: 4, every: 6 }, // Dragon's Roar timing (numbers: skills.SP.stats)
  form: { mul: 3.5, r: 300, at: 26, echo: 0.4, echoR: 170, echoDelay: 8, rjump: 24 },
  storm: { dives: 8, from: 6, every: 11, T: 7, r: 125, mul: 1.15, rainFrom: 4, rainTo: 96, rainEvery: 3, rainR: 95, rainMul: 0.35, crashAt: 104, crashR: 320, crashMul: 2.5, end: 114, range: 720 },
  nid: { rise: 18, crashAt: 86, base: 6, per: 0.7, ringR: 260, ringMul: 2.0, end: 108, range: 700 },
  wrath: { r: 600, mul: 1.2, pinMul: 1.5 }, // the window ran out without a finisher
};
const R0 = (v) => Math.round(v);
const r2 = (v) => Math.round(v * 100) / 100;
export const isDrg = (p) => !!(p && p.drg && CLASSES[p.cls] && CLASSES[p.cls].lance);
const C = () => CLASSES.dragoon;
const SS = (k) => CLASSES.dragoon.skills[k].stats;
/** Skyborne chains (spend all Dragon Blood). */
export const SKY_CHAINS = new Set(['dragon_dive', 'nosedive_barrage', 'high_jump', 'geirskogul']);
/** Airborne arcs for the renderer: id -> (action) => { h: height px, k: 0..1 } or null (client/art.js lifts the hero). */
export const DRG_AIR = {
  jump: (a) => arc(a, 0, (a.data && a.data.T) || 26, 900),
  dragon_dive: (a) => arc(a, 0, DRG.dive.T, 520),
  spineshatter: (a) => arc(a, 10, DRG.spine.T, 420),
  geirskogul: (a) => (a.t < DRG.geir.land ? { h: 260 * Math.sin(Math.min(1, a.t / DRG.geir.rise) * Math.PI / 2) * (a.t > DRG.geir.at + 4 ? Math.max(0, 1 - (a.t - DRG.geir.at - 4) / 8) : 1), k: a.t / DRG.geir.land } : null),
  high_jump: (a) => { const L = (a.data && a.data.land) || DRG.high.max; return a.t < L ? { h: 1200 * Math.sin(Math.min(1, a.t / 14) * Math.PI / 2) * (a.t > L - 6 ? (L - a.t) / 6 : 1), k: a.t / L } : null; },
  nosedive_barrage: (a) => { const t = a.t - 2; if (t < 0) return null; const i = Math.floor(t / DRG.barrage.every), u = t - i * DRG.barrage.every; return i < DRG.barrage.hops && u < DRG.barrage.T ? { h: 160 * Math.sin((u / DRG.barrage.T) * Math.PI), k: u / DRG.barrage.T } : null; },
  wyrmstorm: (a) => { const S = DRG.storm, t = a.t - S.from; if (t < 0 || a.t > S.crashAt) return null; const u = t % S.every; return u < S.T ? { h: 220 * Math.sin((u / S.T) * Math.PI), k: u / S.T } : null; },
  nidhoggs_fall: (a) => { const N = DRG.nid; return a.t < N.crashAt ? { h: a.t < N.rise ? 1400 * (a.t / N.rise) : a.t > N.crashAt - 10 ? 1400 * ((N.crashAt - a.t) / 10) : 1400, k: a.t / N.crashAt, hide: a.t >= N.rise - 4 && a.t < N.crashAt - 10 } : null; },
  dragon_form: (a) => (a.t < DRG.form.at ? { h: 300 * Math.sin((a.t / DRG.form.at) * Math.PI), k: a.t / DRG.form.at } : null),
  crimson_comet: (a) => (a.t < 22 ? { h: 360 * Math.sin(Math.min(1, a.t / 10) * Math.PI / 2) * (a.t > 16 ? (22 - a.t) / 6 : 1), k: a.t / 22 } : null),
};
function arc(a, t0, T, H) { const t = a.t - t0; if (t < 0 || t > T) return null; const k = t / T; return { h: H * Math.sin(k * Math.PI) * (k < 0.5 ? 1 : 1), k }; }

// ------------------------------------------------------------------ state
export function initDragoon(p) { p.drg = { emp: 0, mk: 0, dv: 0, q: [], n: 0, pins: 0, dives: 0 }; }

/** Dragon Blood gain (gear: Dragon Blood Gain; x2 in Dragon Form). Authoritative sim only. */
export function gainBlood(sim, p, n, why = null) {
  if (sim.predicting || !(n > 0) || !CLASSES[p.cls].bloodRes) return 0;
  const K = C().blood, before = p.res;
  p.res = Math.min(p.stats.maxRes, p.res + n * (1 + (p.stats.bloodGain || 0)) * (p.uw ? K.ultMul : 1));
  const got = p.res - before;
  if (why && got >= 1) sim.emit({ type: 'drgx', ph: 'blood', pid: p.id, n: R0(got), why, x: R0(p.x), y: R0(p.y - 56) });
  return got;
}

/** Per tick: Blood drain, the dive-mark window, Dragon Form's free jumps, the dragon's fire echoes. */
export function tickDragoon(sim, p) {
  tickBuffs(p);
  if (!isDrg(p)) return;
  const D = p.drg, K = C().blood;
  if (D.mk > 0 && --D.mk === 0) D.dv = 0;
  if (p.uw && p.cds.R > DRG.form.rjump) p.cds.R = DRG.form.rjump; // Dragon Form: jumps nearly free
  if (sim.predicting) return;
  if (p.res > 0 && !p.uw && sim.tick - (p.lastCombat || 0) > K.drainAfter) p.res = Math.max(0, p.res - K.drain * DT);
  if (D.q.length) {
    const due = D.q.filter((q) => q.at <= sim.tick);
    if (due.length) {
      D.q = D.q.filter((q) => q.at > sim.tick);
      for (const q of due) {
        if (q.k === 'echo') { // the dragon spirit's fire burst on a dive (Dragon Form)
          const n = hitEnemiesInShape(sim, p, { shape: 'circle', x: q.x, y: q.y, r: DRG.form.echoR }, { mul: q.mul, dmgMul: DRG.dmg, kb: 60, hitstop: 2, style: 'dragon', ult: true, noPop: true, stack: ['scorch', 1] });
          sim.emit({ type: 'drgx', ph: 'echo', pid: p.id, x: R0(q.x), y: R0(q.y), r: DRG.form.echoR, n });
        } else if (q.k === 'fireball') { // Wyrmfire Volley / Wyrmstorm rain: a dragonfire bolt lands
          const n = hitEnemiesInShape(sim, p, { shape: 'circle', x: q.x, y: q.y, r: q.r }, { mul: q.mul, dmgMul: q.dm || 1, kb: q.kb || 40, hitstop: 2, style: 'dragon', ult: q.ult || undefined, stack: ['scorch', 1], heavy: !!q.heavy });
          sim.emit({ type: 'drgx', ph: 'fireball', pid: p.id, x: R0(q.x), y: R0(q.y), r: q.r, n, big: q.heavy ? 1 : undefined });
        }
      }
    }
  }
}

/** After a Dragoon hit lands (authoritative): the 3rd basic pins. */
export function drgOnHit(sim, p, e, o) {
  if (sim.predicting || o.dot || !isDrg(p) || e.dead) return;
  const a = p.action;
  if (a && a.kind === 'basic' && a.idx === 2 && !o.noPin) addStacks(sim, p, e, 'impaled', 1);
}

/** A skill / chain / finisher starts (player.js): Skyborne empowerment, Blood spenders; tell the clients. */
export function drgCast(sim, p, a, key, chain) {
  if (!isDrg(p)) return;
  const K = C().blood, fin = !!(chain && chain.route), id = chain ? chain.id : a.id;
  if (chain && !fin && p.drg.emp && SKY_CHAINS.has(id)) { a.data.fe = DRG.sky; p.drg.emp = 0; }
  if (key === 'R' && !fin) p.drg.emp = 1; // a Jump (and Spineshatter) opens Skyborne: the Skyborne chain after it is empowered
  if (SKY_CHAINS.has(id) || fin) {
    a.data.fm = 1 + (fin ? K.finMax : K.spendMax) * Math.min(1, p.res / 100);
    if (!sim.predicting && !fin && !p.uw) p.res = 0; // (Dragon Form: the window's Blood is not spent)
  }
  if (fin) sim.emit({ type: 'drg', ph: 'fin', pid: p.id, id, route: chain.route, name: chain.name, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), fm: r2(a.data.fm || 1) });
  else sim.emit({ type: 'drg', ph: 'cast', pid: p.id, id, key, chain: chain ? 1 : undefined, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), fm: a.data.fm > 1.01 ? r2(a.data.fm) : undefined, fe: a.data.fe ? 1 : undefined });
}

/** The HUD's view. */
export function drgInfo(p) { return p.drg ? { emp: p.drg.emp, mk: p.drg.mk, dv: p.drg.dv } : null; }
/** Pins this Dragoon has on live enemies near (x, y) + how many scorched dive targets are up. */
export function pinsNear(sim, p, r = 900) {
  let n = 0, k = 0, s = 0;
  for (const e of targetsOf(sim)) { if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > r) continue; const c = stackN(e, 'impaled', p.id); if (c) { n += c; k++; } if (stackN(e, 'scorch', p.id)) s++; }
  return { n, k, s };
}

// ------------------------------------------------------------------ helpers
function offWalls(sim, p, lx, ly) {
  ({ x: lx, y: ly } = clearPath(sim.world, p.x, p.y, lx, ly, p.r)); // (swept: never tunnels through walls / props)
  return { x: lx, y: ly };
}
/** Plan a straight move / leap from here to (x, y) over T ticks starting at tick t0 (packed for prediction: fx fy lx ly T). */
function plan(sim, p, a, x, y, T, t0 = 0) {
  const t = offWalls(sim, p, x, y);
  a.data.fx = p.x; a.data.fy = p.y; a.data.lx = t.x; a.data.ly = t.y; a.data.T = T; a.data.t0 = t0;
  a.lockMove = true;
}
function moveTick(p, a, ease = true) {
  const d = a.data, t0 = d.t0 || 0;
  if (d.lx == null || !(d.T > 0) || a.t < t0 || a.t >= t0 + d.T) return;
  const k = (a.t - t0 + 1) / d.T, e = ease ? k * k * (3 - 2 * k) : k;
  p.x = d.fx + (d.lx - d.fx) * e; p.y = d.fy + (d.ly - d.fy) * e;
}
function clampPt(p, tx, ty, range) { let dx = tx - p.x, dy = ty - p.y; const d = Math.hypot(dx, dy); if (d > range) { dx *= range / d; dy *= range / d; } return { x: p.x + dx, y: p.y + dy }; }
function strikeOpts(p, a, o) {
  let mul = DRG.dmg;
  if (a.chain && !a.chain.route) mul *= (1 + (p.stats.chainDmg || 0)) * (a.data.fe || 1);
  if (a.data.fm && !o.noFm) mul *= a.data.fm;
  return { hitstop: 4, heavy: true, ...o, dmgMul: (o.dmgMul || 1) * mul, style: o.style || 'drg', ult: o.ult || !!a.data.fin || undefined };
}
/** A dive hit: rip out the pins (bonus damage), +Dragon Blood, the dragon spirit's echo in Dragon Form. */
function diveHook(sim, p, a, pinMul = 1, prev = null) {
  return (dmg, e) => {
    if (prev) prev(dmg, e);
    if (sim.predicting) return;
    const K = C().blood;
    const add = Math.min(K.dive, K.diveCap - (a.bg || 0));
    if (add > 0) { a.bg = (a.bg || 0) + add; gainBlood(sim, p, add); }
    p.drg.dives++;
    if (e.dead) return;
    popPins(sim, p, a, e, pinMul);
  };
}
/** Rip `p`'s pins out of `e`: x(per x n x mul) ATK. Returns how many. Authoritative sim only. */
export function popPins(sim, p, a, e, mul = 1, ult = false) {
  if (sim.predicting || !e || e.dead) return 0;
  const n = takeStacks(sim, p, e, 'impaled');
  if (!n) return 0;
  const m = DRG.pin.per * n * mul * (1 + (p.stats.impaleDmg || 0));
  sim.emit({ type: 'drgx', ph: 'pins', pid: p.id, id: e.id, x: R0(e.x), y: R0(e.y), r: e.r, n });
  hitEnemy(sim, p, e, strikeOpts(p, a, { mul: m, stagger: 10 + n * 3, kb: 60, hitstop: 6, noPop: true, style: 'drgpin', ult: ult || undefined, noFm: true, bigNum: n >= 4 || undefined, noPin: true }));
  p.drg.pins += n;
  return n;
}
/** Hit a shape and tell the clients what to draw. fx: the look (client/fxdragoon.js). */
function strike(sim, p, a, sh, o, fx, set = null, srv = false) {
  const oo = strikeOpts(p, a, o);
  if (o.dive) { oo.onHit = diveHook(sim, p, a, o.pinMul || 1, oo.onHit); delete oo.dive; }
  if (o.dive) defLand(sim, p); // Dragon Scale landing shield (sim/defense.js)
  const n = sim.predicting ? 0 : hitEnemiesInShape(sim, p, sh, oo, set);
  if (n > 0 && !sim.predicting) p.hitstop = Math.max(p.hitstop, o.selfHs ?? Math.min(5, (o.hitstop ?? 4) - 1));
  if (o.dive && p.uw && !sim.predicting && !a.data.fin) p.drg.q.push({ k: 'echo', at: sim.tick + DRG.form.echoDelay, x: sh.x, y: sh.y, mul: DRG.form.echo });
  sim.emit({ type: srv ? 'drgx' : 'drg', ph: 'hit', pid: p.id, fx, emp: a.chain || a.data.fin ? 1 : undefined, x: R0(sh.x), y: R0(sh.y), ang: r2(sh.ang ?? a.ang), r: sh.r, arc: sh.arc, len: sh.len, lw: sh.w, shape: sh.shape, n, uw: p.uw ? 1 : undefined });
  return n;
}
const circ = (p, r, x = p.x, y = p.y) => ({ shape: 'circle', x, y, r });
const line = (p, a, len, w, ang = a.ang, x = p.x, y = p.y) => ({ shape: 'line', x, y, ang, len, w });
const byId = (sim, id) => (id == null ? null : (sim.enemyById && sim.enemyById.get(id)) || sim.enemies.find((q) => q.id === id) || null);
function pickTarget(sim, p, a, range, scorch = false) {
  let best = null, bs = Infinity;
  for (const e of targetsOf(sim)) {
    if (e.dead) continue;
    if (scorch && !stackN(e, 'scorch', p.id)) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > range + e.r) continue;
    const s = Math.hypot(e.x - a.data.tx, e.y - a.data.ty) * 0.4 + d * 0.3 - (e.boss ? 900 : e.elite ? 400 : 0) - stackN(e, 'impaled', p.id) * 20;
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}
/** Land next to e (on the near side). */
function landBy(p, e, from = p) { const ang = Math.atan2(e.y - from.y, e.x - from.x), stop = e.r + p.r + 4; return { x: e.x - Math.cos(ang) * stop, y: e.y - Math.sin(ang) * stop, ang }; }

/** The ult window timed out without a finisher: Dragon's Wrath (kit.js endUltWindow). */
export function dragonWrath(sim, p) {
  if (!isDrg(p)) return;
  const W = DRG.wrath, a = { data: {}, chain: null };
  sim.emit({ type: 'drg', ph: 'hit', pid: p.id, fx: 'wrath', x: R0(p.x), y: R0(p.y), r: W.r, n: 0 });
  if (sim.predicting) return;
  hitEnemiesInShape(sim, p, circ(p, W.r), strikeOpts(p, a, { mul: W.mul, kb: 200, stagger: 20, hitstop: 6, ult: true, stack: ['scorch', 1] }));
  for (const e of sim.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < W.r + e.r) popPins(sim, p, a, e, W.pinMul, true);
}

// ------------------------------------------------------------------ the moves (skill / chain / finisher id -> { start, tick })
export const DRG_SKILLS = {
  // ===== Q: Piercing Thrust =====
  piercing_thrust: {
    start(sim, p, a) { a.dur = 20; a.cancel = 13; a.moveMul = 0.1; },
    tick(sim, p, a) {
      const s = SS('Q');
      if (a.t < 6) { p.x += Math.cos(a.ang) * s.lunge / 6; p.y += Math.sin(a.ang) * s.lunge / 6; }
      if (a.t === 6) strike(sim, p, a, line(p, a, s.len, s.w), { mul: s.mul, kb: 90, stagger: 10, hitstop: 4, pierce: true, stack: ['impaled', s.pin] }, 'thrust');
    },
  },
  // ===== E: Sweeping Arc =====
  sweeping_arc: {
    start(sim, p, a) { a.dur = 22; a.cancel = 15; a.moveMul = 0.3; },
    tick(sim, p, a) { const s = SS('E'); if (a.t === 7) strike(sim, p, a, circ(p, s.r), { mul: s.mul, kb: s.kb, stagger: 14, hitstop: 5 }, 'arc'); },
  },
  // ===== R: Jump (opens Skyborne); homes onto a scorched enemy while Dragon's Roar marks are up =====
  jump: {
    start(sim, p, a) {
      const s = SS('R'), D = p.drg;
      let T = s.air, tgt = null, e = null;
      if (D && D.mk > 0 && D.dv > 0) e = pickTarget(sim, p, a, SS('SP').diveRange, true);
      if (e) { const L = landBy(p, e); tgt = L; T = SS('SP').diveT; a.data.tid = e.id; a.data.mk = 1; a.ang = L.ang; }
      else tgt = clampPt(p, a.data.tx, a.data.ty, s.range);
      plan(sim, p, a, tgt.x, tgt.y, T);
      if (Math.hypot(a.data.lx - p.x, a.data.ly - p.y) > 4 && !e) a.ang = Math.atan2(a.data.ly - p.y, a.data.lx - p.x);
      a.dur = T + 12; a.cancel = T + 6; a.moveMul = 0;
      p.iframes = Math.max(p.iframes, T + 3);
      sim.emit({ type: 'drg', ph: 'leap', pid: p.id, id: 'jump', x: R0(p.x), y: R0(p.y), tx: R0(a.data.lx), ty: R0(a.data.ly), T, mk: a.data.mk ? 1 : undefined, r: s.r });
    },
    tick(sim, p, a) {
      const s = SS('R'), T = a.data.T || s.air;
      moveTick(p, a);
      if (a.t < T) { p.iframes = Math.max(p.iframes, 2); return; }
      if (a.t !== T) return;
      strike(sim, p, a, circ(p, s.r), { mul: s.mul, kb: 160, knockup: 22, stagger: 18, hitstop: 6, dive: true }, a.data.mk ? 'markdive' : 'land');
      if (a.data.mk) { // Dragon's Roar dive: tear the scorch mark open, then the next dive is ready at once
        const SP = SS('SP'), e = byId(sim, a.data.tid), D = p.drg;
        if (e && !e.dead && !sim.predicting) { takeStacks(sim, p, e, 'scorch'); hitEnemy(sim, p, e, strikeOpts(p, a, { mul: SP.diveMul, kb: 120, stagger: 30, poise: 20, hitstop: 8, style: 'dragon', onHit: diveHook(sim, p, a) })); }
        if (D) { D.dv = Math.max(0, D.dv - 1); if (D.dv > 0 && D.mk > 0) p.cds.R = 0; }
        if (!sim.predicting && D) sim.emit({ type: 'drgx', ph: 'chain', pid: p.id, x: R0(p.x), y: R0(p.y), left: D.dv });
      }
    },
  },
  // ===== G: Spear Throw (pins a distant enemy and makes it a dive target) =====
  spear_throw: {
    start(sim, p, a) {
      const s = SS('F'); a.dur = 22; a.cancel = 14; a.moveMul = 0.2;
      // the first enemy along the aim line
      let best = null, bd = Infinity;
      for (const e of targetsOf(sim)) {
        if (e.dead) continue;
        const dx = e.x - p.x, dy = e.y - p.y, along = dx * Math.cos(a.ang) + dy * Math.sin(a.ang), off = Math.abs(-dx * Math.sin(a.ang) + dy * Math.cos(a.ang));
        if (along < 0 || along > s.range + e.r || off > s.w + e.r) continue;
        if (along < bd) { bd = along; best = e; }
      }
      a.data.tid = best ? best.id : null; a.data.ext = [R0(best ? best.x : p.x + Math.cos(a.ang) * s.range), R0(best ? best.y : p.y + Math.sin(a.ang) * s.range)];
    },
    tick(sim, p, a) {
      const s = SS('F');
      if (a.t === 5) sim.emit({ type: 'drg', ph: 'hit', pid: p.id, fx: 'throw', x: R0(p.x), y: R0(p.y), tx: a.data.ext[0], ty: a.data.ext[1], ang: r2(a.ang), n: 0 });
      if (a.t !== 9) return;
      const e = byId(sim, a.data.tid);
      if (e && !e.dead && !sim.predicting) {
        hitEnemy(sim, p, e, strikeOpts(p, a, { mul: s.mul, kb: 60, stagger: 20, hitstop: 6, pierce: true }));
        addStacks(sim, p, e, 'impaled', s.pins); addStacks(sim, p, e, 'scorch', 1);
        sim.emit({ type: 'drgx', ph: 'pinned', pid: p.id, id: e.id, x: R0(e.x), y: R0(e.y), r: e.r });
      }
      if (e && p.drg) { p.drg.mk = Math.max(p.drg.mk, s.mark); p.drg.dv = Math.max(p.drg.dv, 1); } // the next Jump homes onto it
    },
  },
  // ===== mob chains =====
  whirling_lance: { // E -> Q: a spin into a long thrust
    start(sim, p, a) { a.dur = 34; a.cancel = 26; a.moveMul = 0.2; },
    tick(sim, p, a) {
      const W = DRG.whirl;
      if (a.t === 6) strike(sim, p, a, circ(p, W.r), { mul: W.smul, kb: 80, stagger: 10, hitstop: 3 }, 'whirl');
      if (a.t >= 12 && a.t < 18) { p.x += Math.cos(a.ang) * W.lunge / 6; p.y += Math.sin(a.ang) * W.lunge / 6; }
      if (a.t === 17) strike(sim, p, a, line(p, a, W.len, W.w), { mul: W.mul, kb: 220, stagger: 18, hitstop: 6, pierce: true, stack: ['impaled', 1] }, 'lance');
    },
  },
  tempest_spin: { // E -> E: a double (triple) spin that drags the pack in
    start(sim, p, a) { const Y = DRG.tempest; a.dur = 6 + Y.spins * Y.every + 6; a.cancel = a.dur - 5; a.moveMul = 0.45; },
    tick(sim, p, a) {
      const Y = DRG.tempest;
      if (!sim.predicting && a.t < 4 + Y.spins * Y.every) dragIn(sim, p, Y.r + 110, Y.pull, 0.1);
      if (a.t >= 4 && (a.t - 4) % Y.every === 0 && (a.t - 4) / Y.every < Y.spins) { const i = (a.t - 4) / Y.every, last = i === Y.spins - 1; strike(sim, p, a, circ(p, Y.r), { mul: Y.mul * (last ? 1.4 : 1), kb: last ? 340 : -40, stagger: 12, hitstop: 3, knockup: last ? 20 : 0 }, 'tempest'); }
    },
  },
  dragon_dive: { // Skyborne: R -> E: a second, higher leap that crashes in a huge shockwave
    start(sim, p, a) {
      const V = DRG.dive, t = clampPt(p, a.data.tx, a.data.ty, V.range);
      plan(sim, p, a, t.x, t.y, V.T); a.dur = V.T + 14; a.cancel = V.T + 8; a.moveMul = 0; p.iframes = Math.max(p.iframes, V.T + 3);
      sim.emit({ type: 'drg', ph: 'leap', pid: p.id, id: 'dragon_dive', x: R0(p.x), y: R0(p.y), tx: R0(a.data.lx), ty: R0(a.data.ly), T: V.T, r: V.r });
    },
    tick(sim, p, a) {
      const V = DRG.dive;
      moveTick(p, a);
      if (a.t === V.T) strike(sim, p, a, circ(p, V.r), { mul: V.mul, kb: 300, knockup: V.knockup, stagger: 30, poise: 18, hitstop: 9, selfHs: 6, dive: true }, 'dragondive');
    },
  },
  nosedive_barrage: { // Skyborne: R -> Q -> E: three quick hops across the pack
    start(sim, p, a) {
      const B = DRG.barrage; a.dur = 2 + B.hops * B.every + 8; a.cancel = a.dur - 4; a.lockMove = true; a.moveMul = 0; p.iframes = Math.max(p.iframes, a.dur);
      const t = clampPt(p, a.data.tx, a.data.ty, B.range);
      const near = targetsOf(sim).filter((e) => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < B.range + e.r).sort((x, y) => Math.hypot(x.x - t.x, x.y - t.y) - Math.hypot(y.x - t.x, y.y - t.y));
      a.data.ids = near.slice(0, B.hops).map((e) => e.id); a.data.i = 0;
    },
    tick(sim, p, a) {
      const B = DRG.barrage, t = a.t - 2;
      p.iframes = Math.max(p.iframes, 3);
      if (t < 0) return;
      const i = Math.floor(t / B.every), u = t - i * B.every;
      if (i >= B.hops) return;
      if (u === 0) {
        const ids = a.data.ids || [], e = ids.length ? byId(sim, ids[i % ids.length]) : null;
        let to;
        if (e && !e.dead) to = landBy(p, e); else { const g = a.ang + (i - 1) * 0.5; to = { x: p.x + Math.cos(g) * 160, y: p.y + Math.sin(g) * 160 }; }
        plan(sim, p, a, to.x, to.y, B.T, a.t); a.data.tid = e ? e.id : null;
        if (e) a.ang = Math.atan2(e.y - p.y, e.x - p.x);
      }
      moveTick(p, a);
      if (u === B.T) strike(sim, p, a, circ(p, B.r), { mul: B.mul, kb: 140, knockup: 18, stagger: 14, hitstop: 4, dive: true }, i === B.hops - 1 ? 'hop3' : 'hop');
    },
  },
  // ===== boss chains =====
  impale_rush: { // Q -> Q: two driving thrusts that pin
    start(sim, p, a) {
      const I = DRG.impale; a.dur = 30; a.cancel = 22; a.moveMul = 0;
      const e = pickTarget(sim, p, a, I.range);
      if (e) { a.data.tid = e.id; a.ang = Math.atan2(e.y - p.y, e.x - p.x); const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r - p.r - 40; if (d > 10) plan(sim, p, a, p.x + Math.cos(a.ang) * d, p.y + Math.sin(a.ang) * d, 5); }
    },
    tick(sim, p, a) {
      const I = DRG.impale;
      moveTick(p, a);
      const e = byId(sim, a.data.tid); if (e && !e.dead) a.ang = Math.atan2(e.y - p.y, e.x - p.x);
      if (a.t === 7 || a.t === 17) strike(sim, p, a, line(p, a, I.len, I.w), { mul: I.mul, kb: a.t === 17 ? 160 : 20, stagger: 14, hitstop: 5, pierce: true, stack: ['impaled', I.pins], poise: 8 }, a.t === 7 ? 'impale' : 'impale2');
    },
  },
  spineshatter: { // Q -> R: a thrust, then up and down onto the target - pins burst at x1.6 (opens Skyborne)
    start(sim, p, a) {
      const S = DRG.spine; a.dur = 10 + S.T + 12; a.cancel = 10 + S.T + 6; a.moveMul = 0;
      const D = p.drg, mk = D && D.mk > 0 ? pickTarget(sim, p, a, SS('SP').diveRange, true) : null; // (after a Spear Throw / Roar: dive onto the scorched target)
      const e = mk || pickTarget(sim, p, a, S.range);
      if (e) { a.data.tid = e.id; a.data.mk = mk ? 1 : 0; a.ang = Math.atan2(e.y - p.y, e.x - p.x); }
    },
    tick(sim, p, a) {
      const S = DRG.spine, e = byId(sim, a.data.tid);
      if (a.t === 4) strike(sim, p, a, line(p, a, 230, 70), { mul: S.tmul, kb: 10, stagger: 10, hitstop: 4, pierce: true, stack: ['impaled', 1] }, 'thrust');
      if (a.t === 10) {
        const to = e && !e.dead ? landBy(p, e) : clampPt(p, a.data.tx, a.data.ty, 200);
        plan(sim, p, a, to.x, to.y, S.T, 10); p.iframes = Math.max(p.iframes, S.T + 3);
        sim.emit({ type: 'drg', ph: 'leap', pid: p.id, id: 'spineshatter', x: R0(p.x), y: R0(p.y), tx: R0(a.data.lx), ty: R0(a.data.ly), T: S.T, r: S.r, mk: a.data.mk ? 1 : undefined });
      }
      moveTick(p, a);
      if (a.t === 10 + S.T) { if (e && !e.dead) a.ang = Math.atan2(e.y - p.y, e.x - p.x); strike(sim, p, a, circ(p, S.r, p.x + Math.cos(a.ang) * 30, p.y + Math.sin(a.ang) * 30), { mul: S.mul, kb: 120, stagger: 30, poise: 26, hitstop: 9, selfHs: 6, dive: true, pinMul: S.pinMul }, 'spine'); }
    },
  },
  high_jump: { // Skyborne: R -> Q: soar for up to 1.2 s (steer with your aim, attack to crash early); longer air = more damage
    start(sim, p, a) {
      const H = DRG.high; a.dur = H.max + 12; a.cancel = H.max + 8; a.lockMove = true; a.moveMul = 0;
      a.data.fx = p.x; a.data.fy = p.y; a.data.land = 0;
      p.iframes = Math.max(p.iframes, H.max + 3);
      sim.emit({ type: 'drg', ph: 'leap', pid: p.id, id: 'high_jump', x: R0(p.x), y: R0(p.y), tx: R0(a.data.tx), ty: R0(a.data.ty), T: H.max, r: H.r });
    },
    tick(sim, p, a) {
      const H = DRG.high, d = a.data;
      if (d.land) return;
      p.iframes = Math.max(p.iframes, 3);
      const inp = p.input || {}, aim = clampPt({ x: d.fx, y: d.fy }, inp.ax ?? d.tx, inp.ay ?? d.ty, H.range);
      if (a.t >= 6) { const k = 0.08; p.x += (aim.x - p.x) * k; p.y += (aim.y - p.y) * k; } // drift toward your aim
      const t = offWalls(sim, p, p.x, p.y); p.x = t.x; p.y = t.y;
      if (a.t >= H.max || (a.t >= H.min && inp.attack)) {
        d.land = a.t; a.dur = a.t + 12; a.cancel = a.t + 8;
        const k = Math.min(1, a.t / H.max), mul = H.base + H.grow * k;
        d.k = r2(k);
        strike(sim, p, a, circ(p, H.r), { mul, kb: 200, knockup: 30, stagger: 40, poise: 30, hitstop: 10, selfHs: 7, dive: true }, 'highjump');
      }
    },
  },
  geirskogul: { // Skyborne: R -> E -> Q: rise and fire a piercing dragon beam down your aim from the sky
    start(sim, p, a) { const G = DRG.geir; a.dur = G.land + 8; a.cancel = G.land + 4; a.lockMove = true; a.moveMul = 0; p.iframes = Math.max(p.iframes, G.land); },
    tick(sim, p, a) {
      const G = DRG.geir;
      if (a.t < G.at) { a.ang = p.aim; if (a.t === 2) sim.emit({ type: 'drg', ph: 'hit', pid: p.id, fx: 'geircharge', x: R0(p.x), y: R0(p.y), ang: r2(a.ang), len: G.len, n: 0 }); }
      if (a.t === G.at) strike(sim, p, a, line(p, a, G.len, G.w), { mul: G.mul, kb: 260, stagger: 34, poise: 30, hitstop: 9, selfHs: 6, pierce: true, dive: true }, 'geir');
    },
  },
  // ===== Special (F): Dragon's Roar =====
  dragons_roar: {
    start(sim, p, a) {
      const s = SS('SP'), R = DRG.roar; a.dur = R.at + R.pulses * R.every + 10; a.cancel = a.dur - 6; a.moveMul = 0; a.lockMove = true; p.iframes = Math.max(p.iframes, 12);
      sim.emit({ type: 'spx', ph: 'cast', pid: p.id, id: 'dragons_roar', x: R0(p.x), y: R0(p.y), r: s.w }); // (the shared Special cast event: name pop, HUD)
      sim.emit({ type: 'drg', ph: 'roar', pid: p.id, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), len: s.len, w: s.w, at: R.at, pulses: R.pulses, every: R.every });
    },
    tick(sim, p, a) {
      const s = SS('SP'), R = DRG.roar;
      if (a.t < R.at) { a.ang = p.aim; return; }
      if (a.t === R.at && p.drg) { p.drg.mk = s.mark; p.drg.dv = s.dives; }
      if ((a.t - R.at) % R.every || (a.t - R.at) / R.every >= R.pulses) return;
      const i = (a.t - R.at) / R.every;
      strike(sim, p, a, line(p, a, s.len, s.w), { mul: s.mul, kb: 30, stagger: 8, hitstop: 2, pierce: true, stack: ['scorch', 1], style: 'dragon' }, i === 0 ? 'breath0' : 'breath', null, i > 0);
      if (i === R.pulses - 1) gainBlood(sim, p, s.blood, "Dragon's Roar");
    },
  },
  // ===== Special chains =====
  searing_cyclone: { // F -> E: a dragonfire spear cyclone that drags and scorches
    start(sim, p, a) { a.dur = 40; a.cancel = 32; a.moveMul = 0.35; },
    tick(sim, p, a) {
      if (!sim.predicting && a.t < 30) dragIn(sim, p, 330, 700, 0.1);
      if (a.t >= 4 && (a.t - 4) % 5 === 0 && (a.t - 4) / 5 < 6) { const i = (a.t - 4) / 5, last = i === 5; strike(sim, p, a, circ(p, 230), { mul: last ? 1.4 : 0.6, kb: last ? 360 : -30, stagger: 12, hitstop: last ? 7 : 2, knockup: last ? 30 : 0, stack: ['scorch', 1] }, last ? 'cyclone2' : 'cyclone'); }
    },
  },
  wyrmfire_volley: { // E -> F -> Q: the dragon spits 5 fireballs across a wide cone
    start(sim, p, a) {
      a.dur = 30; a.cancel = 22; a.moveMul = 0.2;
      sim.emit({ type: 'drg', ph: 'hit', pid: p.id, fx: 'volley', emp: 1, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), n: 0 });
      if (sim.predicting) return;
      const D0 = Math.max(170, Math.min(420, Math.hypot(a.data.tx - p.x, a.data.ty - p.y)));
      for (let i = 0; i < 5; i++) { const g = a.ang + (i - 2) * 0.3, d = D0 + ((i % 2) ? 70 : -20); p.drg.q.push({ k: 'fireball', at: sim.tick + 10 + i * 3, x: p.x + Math.cos(g) * d, y: p.y + Math.sin(g) * d, r: 125, mul: 1.35, dm: strikeOpts(p, a, {}).dmgMul, kb: 160, heavy: true }); }
    },
    tick() {},
  },
  dragonfang_lance: { // F -> Q: a burning lance; the dragon's jaws snap shut on the target (+3 pins)
    start(sim, p, a) {
      a.dur = 30; a.cancel = 22; a.moveMul = 0;
      const e = pickTarget(sim, p, a, 340);
      if (e) { a.data.tid = e.id; a.ang = Math.atan2(e.y - p.y, e.x - p.x); const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r - p.r - 50; if (d > 10) plan(sim, p, a, p.x + Math.cos(a.ang) * d, p.y + Math.sin(a.ang) * d, 6); }
    },
    tick(sim, p, a) {
      moveTick(p, a);
      if (a.t === 12) strike(sim, p, a, line(p, a, 320, 96), { mul: 4.6, kb: 200, stagger: 40, poise: 30, hitstop: 10, selfHs: 6, pierce: true, stack: ['impaled', 3] }, 'fang');
    },
  },
  crimson_comet: { // R -> F -> E: from the sky, hurl the spear wrapped in dragonfire - a comet that rips the pins out
    start(sim, p, a) {
      a.dur = 30; a.cancel = 24; a.moveMul = 0; a.lockMove = true; p.iframes = Math.max(p.iframes, 22);
      const e = pickTarget(sim, p, a, 700);
      const t = e ? { x: e.x, y: e.y } : clampPt(p, a.data.tx, a.data.ty, 500);
      a.data.ext = [R0(t.x), R0(t.y)]; if (e) a.data.tid = e.id;
      a.ang = Math.atan2(t.y - p.y, t.x - p.x);
    },
    tick(sim, p, a) {
      const e = byId(sim, a.data.tid), t = e && !e.dead ? { x: e.x, y: e.y } : { x: a.data.ext[0], y: a.data.ext[1] };
      if (a.t === 8) sim.emit({ type: 'drg', ph: 'hit', pid: p.id, fx: 'cometthrow', emp: 1, x: R0(p.x), y: R0(p.y), tx: R0(t.x), ty: R0(t.y), n: 0 });
      if (a.t === 16) strike(sim, p, a, circ(p, 150, t.x, t.y), { mul: 4.2, forceCrit: true, kb: 240, stagger: 40, poise: 30, hitstop: 10, selfHs: 5, stack: ['scorch', 1], dive: true, pinMul: 1.25 }, 'comet');
    },
  },
  // ===== Ult: Dragon Form (the opening; the window is p.uw) =====
  dragon_form: {
    start(sim, p, a) { const F = DRG.form; a.dur = F.at + 14; a.cancel = F.at + 8; a.moveMul = 0; a.lockMove = true; p.iframes = Math.max(p.iframes, F.at + 6); },
    tick(sim, p, a) {
      const F = DRG.form;
      p.superArmor = true;
      if (a.t === F.at) {
        strike(sim, p, a, circ(p, F.r), { mul: F.mul, kb: 340, knockup: 50, stagger: 34, poise: 24, hitstop: 12, selfHs: 8, ult: true, stack: ['scorch', 1] }, 'formslam');
        gainBlood(sim, p, C().blood.ult / C().blood.ultMul, 'Dragon Form');
      }
    },
  },
  // Wyrmstorm (mob finisher): dive after dive across the pack while the dragon rains fire over the whole screen
  wyrmstorm: {
    start(sim, p, a) {
      const S = DRG.storm; a.dur = S.end + 6; a.cancel = a.dur; a.lockMove = true; a.moveMul = 0; a.data.fin = 1; a.data.i = 0; p.iframes = Math.max(p.iframes, a.dur + 6);
      a.data.ox = p.x; a.data.oy = p.y;
    },
    tick(sim, p, a) {
      const S = DRG.storm;
      p.superArmor = true; p.iframes = Math.max(p.iframes, 4);
      const ox = a.data.ox ?? p.x, oy = a.data.oy ?? p.y;
      // the dives
      const t = a.t - S.from;
      if (t >= 0 && a.t < S.crashAt - 6) {
        const i = Math.floor(t / S.every), u = t - i * S.every;
        if (i < S.dives && u === 0) {
          const list = targetsOf(sim).filter((e) => !e.dead && Math.hypot(e.x - ox, e.y - oy) < S.range + e.r);
          const e = list.length ? list[i % list.length] : null, g = i * 2.39996;
          const to = e ? landBy(p, e) : { x: ox + Math.cos(g) * 180, y: oy + Math.sin(g) * 120 };
          plan(sim, p, a, to.x, to.y, S.T, a.t); a.data.tid = e ? e.id : null;
        }
        moveTick(p, a);
        if (i < S.dives && u === S.T) strike(sim, p, a, circ(p, S.r), { mul: S.mul, kb: 120, knockup: 16, stagger: 10, hitstop: 3, dive: true, noFm: false }, 'stormdive');
      }
      // the rain of dragonfire
      if (a.t >= S.rainFrom && a.t <= S.rainTo && (a.t - S.rainFrom) % S.rainEvery === 0) {
        const k = (a.t - S.rainFrom) / S.rainEvery, list = targetsOf(sim).filter((e) => !e.dead && Math.hypot(e.x - ox, e.y - oy) < S.range + e.r);
        const e = list.length && k % 2 === 0 ? list[(k / 2) % list.length] : null, g = k * 2.39996, d = 120 + (k * 97) % 560;
        const x = e ? e.x : ox + Math.cos(g) * d, y = e ? e.y : oy + Math.sin(g) * d * 0.65;
        if (!sim.predicting) {
          const n = hitEnemiesInShape(sim, p, circ(p, S.rainR, x, y), strikeOpts(p, a, { mul: S.rainMul, kb: 30, stagger: 5, hitstop: 1, heavy: false, stack: ['scorch', 1] }));
          sim.emit({ type: 'drgx', ph: 'rain', pid: p.id, x: R0(x), y: R0(y), r: S.rainR, n, k });
        }
      }
      if (a.t === S.crashAt) {
        sim.emit({ type: 'drg', ph: 'hit', pid: p.id, fx: 'stormcrash', emp: 1, x: R0(p.x), y: R0(p.y), r: S.crashR, n: 0 });
        if (!sim.predicting) {
          let tot = 0, k = 0;
          for (const e of sim.enemies.filter((q) => !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < S.crashR + q.r)) {
            const n = takeStacks(sim, p, e, 'impaled'); tot += n; k++;
            if (n) sim.emit({ type: 'drgx', ph: 'pins', pid: p.id, id: e.id, x: R0(e.x), y: R0(e.y), r: e.r, n });
            hitEnemy(sim, p, e, strikeOpts(p, a, { mul: (S.crashMul + DRG.pin.per * n) * (1 + (n ? p.stats.impaleDmg || 0 : 0)), kb: 320, knockup: 60, stagger: 40, poise: 30, hitstop: 14, bigNum: true }));
          }
          sim.emit({ type: 'drgx', ph: 'stormburst', pid: p.id, x: R0(p.x), y: R0(p.y), n: tot, k });
        }
      }
      if (a.t === S.end) endUltWindow(sim, p, 'wyrmstorm');
    },
  },
  // Nidhogg's Fall (boss finisher): vanish into the sky; dragon and lancer crash down together in one strike
  nidhoggs_fall: {
    start(sim, p, a) {
      const N = DRG.nid; a.dur = N.end + 8; a.cancel = a.dur; a.lockMove = true; a.moveMul = 0; a.data.fin = 1; p.iframes = Math.max(p.iframes, a.dur + 6);
      const e = pickTarget(sim, p, a, N.range);
      if (e) { a.data.tid = e.id; a.ang = Math.atan2(e.y - p.y, e.x - p.x); }
    },
    tick(sim, p, a) {
      const N = DRG.nid;
      p.superArmor = true; p.iframes = Math.max(p.iframes, 4);
      const e = byId(sim, a.data.tid);
      if (a.t === N.rise) sim.emit({ type: 'drg', ph: 'hit', pid: p.id, fx: 'nidrise', emp: 1, x: R0(p.x), y: R0(p.y), n: 0 });
      if (a.t > N.rise && a.t < N.crashAt - 10 && e && !e.dead) { const L = landBy(p, e); p.x += (L.x - p.x) * 0.2; p.y += (L.y - p.y) * 0.2; a.ang = L.ang; } // (hidden in the sky, drifting over the target)
      if (a.t === N.crashAt - 30) sim.emit({ type: 'drg', ph: 'hit', pid: p.id, fx: 'nidmark', emp: 1, x: R0(e && !e.dead ? e.x : p.x), y: R0(e && !e.dead ? e.y : p.y), r: e ? e.r : 40, n: 0 });
      if (a.t < N.crashAt - 20 && !sim.predicting) for (const q of sim.enemies) if (!q.dead && Math.hypot(q.x - p.x, q.y - p.y) < 800) q.hitstop = Math.max(q.hitstop, 2);
      if (a.t === N.crashAt) {
        let n = 0, mul = N.base;
        const tx = e && !e.dead ? e.x : p.x, ty = e && !e.dead ? e.y : p.y;
        if (e && !e.dead && !sim.predicting) {
          n = takeStacks(sim, p, e, 'impaled'); mul = N.base + N.per * n * (1 + (p.stats.impaleDmg || 0));
          hitEnemy(sim, p, e, strikeOpts(p, a, { mul, forceCrit: true, pierce: true, poise: 90, stagger: 70, kb: 200, hitstop: 22, bigNum: true }));
        }
        sim.emit({ type: 'drgx', ph: 'nidhogg', pid: p.id, id: e ? e.id : null, x: R0(tx), y: R0(ty), r: e ? e.r : 30, ang: r2(a.ang), n, mul: r2(mul * (a.data.fm || 1)) });
        strike(sim, p, a, circ(p, N.ringR, tx, ty), { mul: N.ringMul, forceCrit: true, stagger: 40, kb: 300, knockup: 40, hitstop: 10, selfHs: 10 }, 'nidring', new Set(e ? [e.id] : []));
      }
      if (a.t === N.end) endUltWindow(sim, p, 'nidhoggs_fall');
    },
  },
};
