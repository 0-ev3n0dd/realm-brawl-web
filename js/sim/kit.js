// Class depth for Warrior / Ranger / Mage / Cleric (modelled on the Blade Dancer): a timed class STATE that transforms skills
// into alternate chains, enemy STACKS that build toward a payoff, chain variants (mob + boss chains incl. 3-step ones), the
// ult WINDOW (10 s, free skills, faster cooldowns) with two 5-step finisher routes each, and the cinematic FINISHERS.
// Pure sim code. Everything that changes enemies/HP (stacks, scheduled hits, finisher damage) runs only in the authoritative
// sim (`!sim.predicting`); a predicting co-op client only times the actions and waits for the server's events.
import { CLASSES, chainById } from './data/classes.js';
import { sustainConsume } from './sustain.js';
import { DT, secs } from './constants.js';
import { pointBlocked, clearPath } from './world.js';
import { hitEnemy, hitEnemiesInShape, spawnProjectile, addArea, healAllies, grantShield, healPlayer } from './combat.js';
import { pickTarget, targetsOf, shieldAmount, SKILLS, leapTo, leapTick, dragIn, rushImpact } from './player.js';
import { aimLeapPoint, spinDrift, WSTR } from './warrior.js';
import { voidSheathe, SAM } from './samurai.js';
import { spiritRelease } from './monk.js';
import { dragonWrath } from './dragoon.js';
import { arcUltEnd } from './arcana.js';

// ------------------------------------------------------------------ enemy stacks
/** Stack kinds: code (wire), ttl (refreshed per stack), per = damage bonus from the owner per stack (Sunder: on top of its
 *  base +15%, from the 2nd stack). Caps come from the class data (`stack.max` / `stack.bossMax`). */
export const STACKS = {
  sunder: { code: 1, ttl: 300, per: 0.05, cls: 'warrior' },
  quarry: { code: 2, ttl: secs(8), per: 0.03, cls: 'ranger' },
  burn: { code: 3, ttl: secs(6), per: 0, cls: 'mage' },
  condemn: { code: 4, ttl: secs(6), per: 0.02, cls: 'cleric' },
  bleed: { code: 5, ttl: secs(6), per: 0, cls: 'warrior' },            // Warrior Twin Axes (DoT in warrior.js)
  chal: { code: 6, ttl: secs(8), per: 0, cls: 'warrior', cap: 1 },     // Warrior Challenge mark (set directly by warrior.js)
  cut: { code: 7, ttl: secs(8), per: 0, cls: 'samurai' },              // Samurai Delayed Cuts (burst by Sheathe, samurai.js)
  pp: { code: 8, ttl: secs(10), per: 0, cls: 'monk' },                 // Monk Pressure Points (popped by finishers, monk.js)
  impaled: { code: 9, ttl: secs(8), per: 0, cls: 'dragoon' },          // Dragoon Impaled pins (ripped out by dives, dragoon.js)
  scorch: { code: 10, ttl: secs(5), per: 0, cls: 'dragoon', cap: 1 },  // Dragoon Scorched: a Dragon's Roar dive target
  chill: { code: 11, ttl: secs(4), per: 0, cls: 'summoner' },          // Grimoire Summoner Chill (2 = frozen solid, arcana.js)
  disso: { code: 12, ttl: secs(5), per: 0, cls: 'bard', cap: 1 },      // Bard Dissonant: +15% damage taken from everyone (arcana.js)
};
export const STACK_KINDS = ['', 'sunder', 'quarry', 'burn', 'condemn', 'bleed', 'chal', 'cut', 'pp', 'impaled', 'scorch', 'chill', 'disso']; // by code
const capOf = (kind, e) => { const S = STACKS[kind]; if (S.cap) return S.cap; const c = CLASSES[S.cls].stack; return e.boss ? c.bossMax : c.max; };
/** The live stack record of `kind` on `e` owned by player id `pid` (or any owner when pid is omitted), else null. */
export function stackOf(e, kind, pid) {
  const s = kind === 'sunder' ? e.sunder : e.stx && e.stx[kind];
  if (!s || !(s.t > 0) || (pid != null && s.pid !== pid)) return null;
  return s;
}
export function stackN(e, kind, pid) { const s = stackOf(e, kind, pid); return s ? s.n || 1 : 0; }
/** +n stacks of `kind` from `p` on `e` (a fresh owner restarts the count). Authoritative sim only. Returns the new count. */
export function addStacks(sim, p, e, kind, n = 1) {
  if (sim.predicting || e.dead) return 0;
  const S = STACKS[kind], old = stackOf(e, kind, p.id);
  const uwc = kind === 'cut' && p.uw && e.boss && p.sam && !sim.noVMark; // Samurai Void Sheath Mark: in the ult window a boss takes ×1.5 cuts, and they are held
  if (uwc) { const f = n * SAM.mark.ultCuts + (p.sam.cf || 0); n = Math.floor(f); p.sam.cf = f - n; }
  const on = old ? old.n || 1 : 0, cnt = Math.min(capOf(kind, e), on + n);
  const rec = { pid: p.id, t: S.ttl, n: cnt };
  if (uwc) rec.w = Math.min(cnt, (old && old.w || 0) + Math.max(0, cnt - on));
  if (kind === 'sunder') e.sunder = rec; else (e.stx || (e.stx = {}))[kind] = rec;
  if (!old) { if (kind === 'sunder') sim.emit({ type: 'sunder', pid: p.id, id: e.id, x: e.x, y: e.y - e.r - 20 }); }
  sim.emit({ type: 'stack', pid: p.id, id: e.id, kind, n: cnt, x: Math.round(e.x), y: Math.round(e.y - e.r - 24) });
  return cnt;
}
/** Use up `p`'s stacks of `kind` on `e`: returns how many there were. Authoritative sim only (a predicting sim reads 0). */
export function takeStacks(sim, p, e, kind) {
  if (sim.predicting) return 0;
  const n = stackN(e, kind, p.id);
  if (!n) return 0;
  if (kind === 'sunder') e.sunder = null; else delete e.stx[kind];
  sustainConsume(sim, p, kind, n); // Mage: Burn -> mana, Cleric: Condemn -> Holy Charge
  return n;
}
/** Extra damage multiplier `p` gets from its own stacks on `e` (Sunder's base +15% stays in combat.js). */
export function stackDmgMul(e, p) {
  let m = 1;
  if (e.sunder && e.sunder.pid === p.id && e.sunder.t > 0) m *= 1 + STACKS.sunder.per * ((e.sunder.n || 1) - 1);
  if (e.stx) for (const k in e.stx) { const s = e.stx[k]; if (s.pid === p.id && s.t > 0 && STACKS[k].per) m *= 1 + STACKS[k].per * s.n; }
  return m;
}
/** Per-tick expiry (ai.js). */
export function tickStacks(e) {
  if (!e.stx) return;
  for (const k in e.stx) if (--e.stx[k].t <= 0) delete e.stx[k];
}
/** Passive stack sources inside hitEnemy (after the damage): Warrior hits on a Sundered enemy (+1 once per action), Cleric
 *  basic hits (+1 Condemn), Ranger arrows on rooted enemies (+1 Quarry), plus an explicit `o.stack = [kind, n]`. */
export function hitStacks(sim, p, e, o, sundered) {
  if (sim.predicting || e.dead) return;
  const act = p.action;
  if (o.sunder) addStacks(sim, p, e, 'sunder', o.sunder === true ? 1 : o.sunder);
  else if (p.cls === 'warrior' && sundered && !o.ult && !o.dot && act && (act.kind === 'skill' || (o.heavy && o.basic))) {
    const set = act.su || (act.su = new Set());
    if (!set.has(e.id)) { set.add(e.id); addStacks(sim, p, e, 'sunder', 1); }
  }
  if (p.cls === 'cleric' && o.basic) addStacks(sim, p, e, 'condemn', 1);
  if (p.cls === 'ranger' && !o.ult && !o.stack && e.cc.rooted && o.style && /arrow|pierce|lance/.test(o.style)) addStacks(sim, p, e, 'quarry', 1);
  if (o.stack) addStacks(sim, p, e, o.stack[0], o.stack[1]);
}

// ------------------------------------------------------------------ class state
/** The class state (Momentum / Focus / Arcane Surge / Consecration): p.cst = { g: stage, t: ticks left }. */
export const stateDef = (p) => CLASSES[p.cls].state || null;
export function setState(sim, p, stage = 'base') {
  const S = stateDef(p);
  if (!S) return;
  const fresh = !p.cst;
  p.cst = { g: stage, t: S.dur };
  sim.emit({ type: 'classState', pid: p.id, s: S.id, g: stage, x: p.x, y: p.y, fresh: fresh || undefined });
}
/** The key history a chain reads (2026-10-19 skill rework, shared systems): basic attacks between chain steps no longer break a chain
 *  (they are skipped) unless the chain itself has a basic step. */
export const chainHist = (p, seq) => (seq.some((k) => /^B/.test(k)) ? p.history : p.history.filter((e) => !/^B/.test(e.a)));
/** Chains keep state through movement: walking / dodging / a mobility skill pauses the chain timers (history ages, the class
 *  state's clock) for up to CHAIN_GRACE.max ticks per step. */
export const CHAIN_GRACE = { max: 180 };
export function chainGrace(sim, p) { for (const e of p.history) if ((e.pz | 0) < CHAIN_GRACE.max) { e.tick++; e.pz = (e.pz | 0) + 1; } if (p.cst && (p.cst.pz | 0) < CHAIN_GRACE.max) { p.cst.t++; p.cst.pz = (p.cst.pz | 0) + 1; } }
export function tickState(p) { if (p.cst && --p.cst.t <= 0) p.cst = null; }
/** The state step a skill key would play: { chain, to } or null. */
export function stateChain(p, key) {
  if (!p.cst) return null;
  const S = stateDef(p), st = S && S.steps[p.cst.g], step = st && st[key];
  return step ? { chain: chainById(p.cls, step.chain), to: step.to || null } : null;
}
/** After a skill cast: advance the state along its step (or end it), and start it from its trigger skill. */
export function afterCastState(sim, p, skId, sc) {
  const S = stateDef(p);
  if (!S) return;
  if (sc) { if (sc.to) setState(sim, p, sc.to); else p.cst = null; }
  else if (p.cst && !S.keep) p.cst = null; // any other skill ends it (Warrior Momentum is kept: it runs on its own timer)
  if (S.on === skId && !(p.action && p.action.data && p.action.data.fin)) setState(sim, p, 'base'); // (a finisher never reopens the state)
}
/** For the HUD: the state's primed chains [{ id, next, step, state:true }]. */
export function statePrimed(p) {
  if (!p.cst) return [];
  const S = stateDef(p), st = S.steps[p.cst.g] || {};
  return Object.keys(st).map((k) => { let c = chainById(p.cls, st[k].chain);
    if (!c && st[k].to) { const nx = S.steps[st[k].to] || {}, k2 = Object.keys(nx)[0]; c = k2 && chainById(p.cls, nx[k2].chain); if (c) return { id: c.id, next: k, then: k2, step: c.seq.indexOf(k, 1), free: false, state: true }; } // (a step with no chain of its own: hint the chain it leads to, e.g. Samurai Stillness -> Iaido -> Petal Rain)
    if (!c) return null;
    return { id: c.id, next: k, step: c.seq.length - 1, free: !!(c.free || c.id === 'retribution' || c.id === 'blink_nova'), state: true }; }).filter(Boolean);
}

// ------------------------------------------------------------------ ult window (Warrior / Ranger / Mage / Cleric)
/** 10 s after the ult: skills free, cooldowns tick `cdMul`x, the route's next step key is ready at once, no ult meter. */
export const ULTWIN = { dur: secs(10), cdMul: 3 };

// ------------------------------------------------------------------ scheduled hits (server/solo only)
export function schedule(sim, p, delay, job) { if (!sim.predicting) (p.sched || (p.sched = [])).push({ at: sim.tick + delay, ...job }); }
export function runSched(sim, p) {
  if (!p.sched || !p.sched.length) return;
  const due = p.sched.filter((s) => s.at <= sim.tick);
  if (!due.length) return;
  p.sched = p.sched.filter((s) => s.at > sim.tick);
  for (const s of due) JOBS[s.k](sim, p, s);
}

// ------------------------------------------------------------------ tuning
/** Warrior chains. Rage versions (earthsplitter / mael / jugg / skull) also get x1-x2 from the Rage they spend (combat.js). */
export const WAR = {
  split: { leap: 12, range: 330, r: 150, len: 460, w: 48, n: 5, spread: 0.42, mul: 3.2, knockup: 72 },
  mael: { r0: 120, grow: 10, rMax: 280, pullExtra: 200, pullSpeed: 340, bossPull: 0.12, every: 8, mul: 0.8, dur: 108, burstMul: 2.0, burstExtra: 40 },
  skull: { range: 340, leap: 14, base: 3, perStack: 1.6, splashMul: 2.2, splashR: 120 },
  crack: { base: 2.4, perStack: 0.4, splashMul: 1.2, splashR: 90 },
  jugg: { hits: 3, every: 12, lunge: 60, mul: 2.2, r: 90, poise: 14, stagger: 30 },
  finale: { r: 240, mul: 2.5, knockup: 60 },
};
export const RNG = {
  lance: { mul: 2.6, splitMul: 1.9, maxSplit: 12, speed: 1050, splitSpeed: 950, zoneExtra: 70, fallback: 330, zoneR: 115, volleyTtl: secs(3) },
  deadeye: { base: 3, perStack: 1.2, range: 820, speed: 2300 },
};
export const MAG = {
  cascade: { r: 135, delay: 12, link: 170, step: 5, mul: 2.4, splashR: 80, splashMul: 1.0, max: 24, refreeze: 40 },
  supernova: { r: 560, base: 1.2, perStack: 0.9, delay: 18 },
  burn: { meteor: 2, cataclysm: 3, pulse: 1, ult: 3 },
};
export const CLR = { nova: { mul: 3.0, heal: 0.12, healAtk: 0.6, extra: 30, fallbackR: 170, knockdown: 70, healR: 60, ttl: secs(5) }, verdictPer: 0.3, verdictPerBoss: 0.4, smiteStacks: 2 }; // (verdictPerBoss: Final Verdict vs bosses / elites, 0.3 -> 0.4 in the 2026-10-08 Paladin boss pass)
/** Finishers (route step 5). Numbers are fun-first; see the balance report in README. */
export const FIN = {
  worldbreaker: { leap: 24, range: 260, pullR: 650, mul: 4.0, perStack: 0.4, knockdown: 120, bossK: 0.25, rings: [240, 420, 620], ringEvery: 14, ringMul: 1.8, dur: 24 + 3 * 14 + 24 },
  titans_execution: { range: 520, base: 8, perStack: 3, maxStacks: 5, impact: 58, quakeR: 200, quakeMul: 2.5, dur: 80 },
  skyfall: { r: 650, lead: 18, waves: 9, every: 6, perWave: 14, fall: 10, arrowR: 72, mul: 1.1 },
  heavens_arrow: { range: 700, charge: 52, base: 8, perStack: 2.5, maxStacks: 10, len: 760, w: 60, lineMul: 0.5, dur: 76 },
  armageddon: { r: 650, lead: 16, count: 16, every: 4, fall: 24, meteorR: 110, mul: 2.4, knockdown: 60 },
  singularity: { range: 520, hold: 66, pullR: 380, pullSpeed: 280, tickEvery: 10, tickR: 200, tickMul: 0.35, base: 6, perStack: 2, maxStacks: 12, splashR: 250, dur: 84 },
  rapture: { r: 620, lead: 14, pillars: 18, every: 3, fall: 12, pillarR: 80, mul: 1.9, heal: 0.05, finalHeal: 0.25, partyR: 1400 },
  heavens_judgment: { range: 520, impact: 56, base: 30, perStack: 4, maxStacks: 10, quakeR: 180, quakeMul: 2, heal: 0.3, partyR: 1400, dur: 78 },
};
{ const S = FIN.skyfall; S.dur = S.lead + S.waves * S.every + S.fall + 22; }
{ const A = FIN.armageddon; A.dur = A.lead + A.count * A.every + A.fall + 22; }
{ const R = FIN.rapture; R.dur = R.lead + R.pillars * R.every + R.fall + 26; }

// ------------------------------------------------------------------ helpers
const clampTo = (p, x, y, maxR) => { const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy), k = d > maxR ? maxR / d : 1; return { x: p.x + dx * k, y: p.y + dy * k }; };
function nearest(sim, x, y, range) { let b = null, bd = Infinity; for (const e of sim.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - x, e.y - y) - e.r; if (d < range && d < bd) { bd = d; b = e; } } return b; }
const finTarget = (sim, p, a, range) => pickTarget(sim, p, a.data.tx, a.data.ty, range) || nearest(sim, p.x, p.y, range + 200);
function stepOff(sim, p, lx, ly, fx, fy) { return clearPath(sim.world, fx, fy, lx, ly, p.r); } // (swept)
const R0 = (v) => Math.round(v);
const finEmit = (sim, p, fid, ph, o = {}) => sim.emit({ type: 'fin', pid: p.id, cls: p.cls, fid, ph, ...o });
function finBegin(p, a, dur) { a.dur = dur; a.cancel = dur; a.lockMove = true; a.data.fin = 1; p.iframes = Math.max(p.iframes, dur + 6); }
/** Points for a rain finisher: enemies within r (least-hit first), else deterministic scatter around the centre. */
function rainPoints(sim, d, n, r, jitter) {
  const out = [], live = sim.enemies.filter((e) => !e.dead && Math.hypot(e.x - d.cx, e.y - d.cy) < r + e.r);
  live.sort((u, v) => (d.hits.get(u.id) || 0) - (d.hits.get(v.id) || 0) || u.id - v.id);
  for (let i = 0; i < n; i++) {
    const e = live[i % Math.max(1, live.length)];
    if (e && i < live.length * 2) { d.hits.set(e.id, (d.hits.get(e.id) || 0) + 1); out.push([R0(e.x + (sim.rng.next() - 0.5) * jitter), R0(e.y + (sim.rng.next() - 0.5) * jitter)]); }
    else { const an = sim.rng.next() * Math.PI * 2, rr = Math.sqrt(sim.rng.next()) * r; out.push([R0(d.cx + Math.cos(an) * rr), R0(d.cy + Math.sin(an) * rr)]); }
  }
  return out;
}
/** Pull `e` toward (x, y) until `gap` px from it, `k` of the way (bosses use bossK). */
function yank(e, x, y, k, gap) { const d = Math.hypot(x - e.x, y - e.y); if (d < 1) return; const step = Math.max(0, d - e.r - gap) * k; e.x += ((x - e.x) / d) * step; e.y += ((y - e.y) / d) * step; e.vx = e.vy = 0; }

// ------------------------------------------------------------------ chain variants + finishers (dispatched by chain id)
/** Skull Crack / Skullsplitter: pick the target (Skullsplitter: your most-Sundered enemy in range) and leap onto it. */
function skullStart(sim, p, a, rage) {
  const K = WAR.skull;
  a.dur = K.leap + 26; a.cancel = K.leap + 14; a.lockMove = true; p.iframes = Math.max(p.iframes, K.leap + 4);
  let best = null, bn = -Infinity;
  if (rage) for (const e of targetsOf(sim)) { if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > K.range + e.r) continue; const n = stackN(e, 'sunder', p.id) * 1000 - Math.hypot(e.x - a.data.tx, e.y - a.data.ty); if (n > bn) { bn = n; best = e; } }
  if (!best) best = pickTarget(sim, p, a.data.tx, a.data.ty, K.range);
  a.data.fx = p.x; a.data.fy = p.y;
  if (best) { const ang = Math.atan2(best.y - p.y, best.x - p.x), dd = Math.max(0, Math.hypot(best.x - p.x, best.y - p.y) - best.r - p.r - 4); a.ang = ang; a.data.tid = best.id; const l = stepOff(sim, p, p.x + Math.cos(ang) * dd, p.y + Math.sin(ang) * dd, p.x, p.y); a.data.lx = l.x; a.data.ly = l.y; }
  else { a.data.lx = p.x + Math.cos(a.ang) * 120; a.data.ly = p.y + Math.sin(a.ang) * 120; }
}
function skullTick(sim, p, a, rage) {
  p.superArmor = true;
  const d = a.data, K = WAR.skull, C = WAR.crack;
  if (a.t < K.leap && d.lx != null) { const k = (a.t + 1) / K.leap, e = k * k * (3 - 2 * k); p.x = d.fx + (d.lx - d.fx) * e; p.y = d.fy + (d.ly - d.fy) * e; }
  if (a.t !== K.leap) return;
  p.hitstop = Math.max(p.hitstop, rage ? 10 : 7);
  rushImpact(sim, p, 'E');
  if (sim.predicting) return;
  const e = d.tid ? sim.enemyById.get(d.tid) : null;
  let n = 0, dmg = 0;
  const x = e && !e.dead ? e.x : p.x + Math.cos(a.ang) * 30, y = e && !e.dead ? e.y : p.y + Math.sin(a.ang) * 30;
  const base = rage ? K.base : C.base, per = rage ? K.perStack : C.perStack;
  if (e && !e.dead) {
    n = rage ? takeStacks(sim, p, e, 'sunder') : stackN(e, 'sunder', p.id);
    const r = hitEnemy(sim, p, e, { mul: base + per * n, forceCrit: true, bigNum: rage || n >= 3 || undefined, heavy: true, stagger: rage ? 60 : 40, poise: rage ? 20 : 8, knockup: e.boss ? 0 : rage ? 100 : 60, kb: 0, kbAng: a.ang, hitstop: rage ? 14 : 10 });
    dmg = r ? r.dmg : 0;
  }
  const sR = rage ? K.splashR : C.splashR, sM = rage ? K.splashMul : C.splashMul;
  for (const q of sim.enemies) if (!q.dead && q !== e && Math.hypot(q.x - x, q.y - y) < sR + q.r) hitEnemy(sim, p, q, { mul: sM, knockup: 45, kb: 200, kbAng: Math.atan2(q.y - y, q.x - x), hitstop: 6, heavy: true });
  sim.emit({ type: 'skullsplitter', pid: p.id, id: d.tid || 0, x: R0(x), y: R0(y), n, dmg: R0(dmg), mul: +((base + per * n) * (d.rm || 1)).toFixed(1), rage: rage ? 1 : undefined });
}

/** CHAIN_FX[chainId] = { start(sim, p, a), tick(sim, p, a) }: replaces the skill's own start/tick for that chain. */
export const CHAIN_FX = {
  // ===== Warrior =====
  // Earthsplitter (RAGE: Crash Charge → Leap Slam): a fast leap, then five fissures fan out from the landing (and a ring round it).
  earthsplitter: {
    start(sim, p, a) { const W = WAR.split; a.dur = W.leap + 26; a.cancel = W.leap + 14; a.lockMove = true; leapTo(sim, p, a, W.range, W.leap, aimLeapPoint(sim, p, a, W.range)); p.iframes = Math.max(p.iframes, W.leap + 4); },
    tick(sim, p, a) {
      p.superArmor = true;
      const W = WAR.split;
      leapTick(p, a, W.leap);
      if (a.t !== W.leap) return;
      p.hitstop = Math.max(p.hitstop, 9);
      const x = p.x, y = p.y, hit = new Set(), o = { mul: W.mul, knockup: W.knockup, kb: 120, hitstop: 10, heavy: true, sunder: 1, poise: 10, style: 'earth' };
      let n = hitEnemiesInShape(sim, p, { shape: 'circle', x, y, r: W.r }, o, hit);
      const angs = [];
      for (let i = 0; i < W.n; i++) {
        const ang = a.ang + (i - (W.n - 1) / 2) * W.spread;
        angs.push(Math.round(ang * 100) / 100);
        n += hitEnemiesInShape(sim, p, { shape: 'line', x, y, ang, len: W.len, w: W.w }, { ...o, kbAng: ang }, hit);
      }
      sim.emit({ type: 'earthsplitter', pid: p.id, x: R0(x), y: R0(y), r: W.r, len: W.len, angs, n, rm: a.data.rm || 1 });
      rushImpact(sim, p, 'E');
    },
  },
  // Maelstrom (RAGE: Leap Slam → Whirlwind): a growing tornado that drags everything in, ending in a burst.
  maelstrom: {
    start(sim, p, a) { const M = WAR.mael; a.dur = M.dur + 10; a.cancel = M.dur; a.moveMul = 0.7; a.data.r = M.r0; sim.emit({ type: 'maelstrom', pid: p.id, x: R0(p.x), y: R0(p.y), r: M.r0 }); },
    tick(sim, p, a) {
      p.superArmor = true;
      const M = WAR.mael, d = a.data;
      if (a.t < M.dur) spinDrift(p, a, WSTR.drift); // a tornado you steer (drifts toward the aim with no movement input)
      if (!sim.predicting && a.t < M.dur) dragIn(sim, p, d.r + M.pullExtra, M.pullSpeed, M.bossPull);
      if (a.t === M.dur) { // the burst
        const r = d.r + M.burstExtra;
        const n = hitEnemiesInShape(sim, p, { shape: 'circle', x: p.x, y: p.y, r }, { mul: M.burstMul, knockup: 50, kb: 360, hitstop: 9, heavy: true, sunder: 1, style: 'wind' });
        p.hitstop = Math.max(p.hitstop, 6);
        sim.emit({ type: 'maelstrom', pid: p.id, ph: 'burst', x: R0(p.x), y: R0(p.y), r, n });
        return;
      }
      if (a.t % M.every || a.t >= M.dur) return;
      sim.emit({ type: 'spin', pid: p.id, x: p.x, y: p.y, r: d.r, t: a.t, mael: 1 });
      const n = hitEnemiesInShape(sim, p, { shape: 'circle', x: p.x, y: p.y, r: d.r }, { mul: M.mul, kb: 60, pull: true, hitstop: 2, style: 'wind' });
      if (n > 0) d.r = Math.min(M.rMax, d.r + n * M.grow);
    },
  },
  // Juggernaut (RAGE: Crash Charge → Shoulder Bash): three bashes 0.2 s apart, each lunging into whatever is in front.
  juggernaut: {
    start(sim, p, a) { const J = WAR.jugg; a.dur = J.hits * J.every + 14; a.cancel = a.dur - 4; a.lockMove = true; a.data.i = 0; },
    tick(sim, p, a) {
      p.superArmor = true;
      const J = WAR.jugg, d = a.data, k = a.t % J.every, i = Math.floor(a.t / J.every);
      if (i >= J.hits) return;
      if (k < 5) { const sp = J.lunge / (5 * DT); p.x += Math.cos(a.ang) * sp * DT; p.y += Math.sin(a.ang) * sp * DT; }
      if (k !== 5) return;
      const last = i === J.hits - 1, x = p.x + Math.cos(a.ang) * (p.r + 20), y = p.y + Math.sin(a.ang) * (p.r + 20);
      const n = hitEnemiesInShape(sim, p, { shape: 'circle', x, y, r: J.r }, { mul: J.mul, stagger: J.stagger, kb: last ? 620 : 140, kbAng: a.ang, poise: J.poise, sunder: 1, hitstop: last ? 12 : 7, heavy: true });
      p.hitstop = Math.max(p.hitstop, last ? 8 : 4);
      sim.emit({ type: 'bash', pid: p.id, x: R0(x), y: R0(y), r: 30, ang: Math.round(a.ang * 100) / 100, big: last ? 1 : undefined, jugg: i + 1, n });
      if (i === 0) rushImpact(sim, p, 'R');
    },
  },
  // Skull Crack (Shoulder Bash → Leap Slam) and Skullsplitter (its RAGE version, on your most-Sundered enemy): leap onto the
  // target for ONE guaranteed crit that grows with its Sunder (Skullsplitter uses it up).
  skull_crack: { start(sim, p, a) { skullStart(sim, p, a, false); }, tick(sim, p, a) { skullTick(sim, p, a, false); } },
  skullsplitter: { start(sim, p, a) { skullStart(sim, p, a, true); }, tick(sim, p, a) { skullTick(sim, p, a, true); } },
  worldbreaker: {
    start(sim, p, a) {
      const F = FIN.worldbreaker; finBegin(p, a, F.dur);
      const t = clampTo(p, a.data.tx, a.data.ty, F.range), l = stepOff(sim, p, t.x, t.y, p.x, p.y);
      a.data.fx = p.x; a.data.fy = p.y; a.data.lx = l.x; a.data.ly = l.y;
      finEmit(sim, p, 'worldbreaker', 'start', { x: R0(l.x), y: R0(l.y), fx: R0(p.x), fy: R0(p.y), r: F.pullR, leap: F.leap });
    },
    tick(sim, p, a) {
      p.superArmor = true; p.iframes = Math.max(p.iframes, 8);
      const F = FIN.worldbreaker, d = a.data;
      if (a.t < F.leap) { const k = (a.t + 1) / F.leap, e = k * k * (3 - 2 * k); p.x = d.fx + (d.lx - d.fx) * e; p.y = d.fy + (d.ly - d.fy) * e; }
      if (sim.predicting) return;
      if (a.t === F.leap) {
        let n = 0, total = 0;
        for (const e of sim.enemies) {
          if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > F.pullR + e.r) continue;
          yank(e, p.x, p.y, e.boss ? F.bossK : 1, 20 + (e.id % 7) * 12);
          const st = stackN(e, 'sunder', p.id);
          const r = hitEnemy(sim, p, e, { mul: F.mul + F.perStack * st, forceCrit: true, knockdown: e.boss ? 0 : F.knockdown, kb: 0, hitstop: 12, heavy: true, sunder: 1 });
          if (r) { n++; total += r.dmg; }
        }
        p.hitstop = Math.max(p.hitstop, 8);
        d.total = total;
        finEmit(sim, p, 'worldbreaker', 'impact', { x: R0(p.x), y: R0(p.y), r: F.pullR, n, dmg: R0(total) });
      }
      for (let i = 0; i < F.rings.length; i++) {
        if (a.t !== F.leap + (i + 1) * F.ringEvery) continue;
        const R = F.rings[i];
        let n = 0;
        hitEnemiesInShape(sim, p, { shape: 'circle', x: p.x, y: p.y, r: R }, { mul: F.ringMul, forceCrit: true, knockdown: 50, kb: 160, hitstop: 5, heavy: true, onHit: (dm) => { n++; d.total = (d.total || 0) + dm; } });
        finEmit(sim, p, 'worldbreaker', 'ring', { x: R0(p.x), y: R0(p.y), r: R, i, n });
        if (i === F.rings.length - 1) { finEmit(sim, p, 'worldbreaker', 'end', { x: R0(p.x), y: R0(p.y), dmg: R0(d.total || 0) }); endUltWindow(sim, p, 'worldbreaker'); }
      }
    },
  },
  titans_execution: {
    start(sim, p, a) {
      const F = FIN.titans_execution; finBegin(p, a, F.dur);
      if (sim.predicting) return;
      const e = finTarget(sim, p, a, F.range);
      const n = e ? Math.min(F.maxStacks, stackN(e, 'sunder', p.id)) : 0;
      if (e) { e.hitstop = Math.max(e.hitstop, F.impact + 2); a.ang = Math.atan2(e.y - p.y, e.x - p.x); }
      a.data.te = { id: e ? e.id : 0, n };
      finEmit(sim, p, 'titans_execution', 'start', { id: e ? e.id : 0, x: R0(e ? e.x : p.x), y: R0(e ? e.y : p.y), r: e ? e.r : 30, n, impact: F.impact, mul: F.base + F.perStack * n, boss: !!(e && e.boss) });
    },
    tick(sim, p, a) {
      p.superArmor = true; p.iframes = Math.max(p.iframes, 8);
      const F = FIN.titans_execution, d = a.data.te;
      if (!d) return;
      const e = d.id ? sim.enemyById.get(d.id) : null, live = e && !e.dead;
      if (live && a.t < F.impact) e.hitstop = Math.max(e.hitstop, 2);
      if (a.t !== F.impact) return;
      const x = live ? e.x : p.x, y = live ? e.y : p.y;
      let dmg = 0;
      if (live) { takeStacks(sim, p, e, 'sunder'); const r = hitEnemy(sim, p, e, { mul: F.base + F.perStack * d.n, forceCrit: true, bigNum: true, heavy: true, stagger: 90, knockdown: e.boss ? 0 : 140, kb: 0, hitstop: 18 }); dmg = r ? r.dmg : 0; }
      for (const q of sim.enemies) if (!q.dead && q !== e && Math.hypot(q.x - x, q.y - y) < F.quakeR + q.r) hitEnemy(sim, p, q, { mul: F.quakeMul, forceCrit: true, knockdown: 80, kb: 260, kbAng: Math.atan2(q.y - y, q.x - x), hitstop: 8, heavy: true });
      p.hitstop = Math.max(p.hitstop, 10);
      finEmit(sim, p, 'titans_execution', 'impact', { id: d.id, x: R0(x), y: R0(y), r: live ? e.r : 30, n: d.n, dmg: R0(dmg), killed: !!(e && e.dead), mul: F.base + F.perStack * d.n });
      endUltWindow(sim, p, 'titans_execution');
    },
  },
  // ===== Ranger =====
  storm_lance: {
    start(sim, p, a) { a.dur = 28; a.cancel = 20; a.moveMul = 0.1; },
    tick(sim, p, a) {
      if (a.t !== 10) return;
      const L = RNG.lance, v = p.lastVolley && sim.tick - p.lastVolley.tick < L.volleyTtl ? p.lastVolley : null;
      const zx = v ? v.x : p.x + Math.cos(a.ang) * L.fallback, zy = v ? v.y : p.y + Math.sin(a.ang) * L.fallback, zr = v ? v.r : L.zoneR;
      const ang = Math.atan2(zy - p.y, zx - p.x), dist = Math.hypot(zx - p.x, zy - p.y);
      a.ang = ang;
      spawnProjectile(sim, { team: 'player', ownerId: p.id, x: p.x, y: p.y, vx: Math.cos(ang) * L.speed, vy: Math.sin(ang) * L.speed, r: 12, life: Math.max(8, Math.round(dist / L.speed * 60) + 2), mul: L.mul, kb: 200, stagger: 24, pierce: -1, style: 'lance', heavy: true, hitstop: 5 });
      sim.emit({ type: 'shoot', pid: p.id, x: p.x, y: p.y, ang, cls: p.cls, heavy: true, pierce: true });
      sim.emit({ type: 'stormLance', pid: p.id, ph: 'fire', fx: R0(p.x), fy: R0(p.y), x: R0(zx), y: R0(zy), r: zr, t: Math.round(dist / L.speed * 60) });
      schedule(sim, p, Math.max(1, Math.round(dist / L.speed * 60)), { k: 'split', x: zx, y: zy, r: zr });
    },
  },
  deadeye: {
    start(sim, p, a) { a.dur = 26; a.cancel = 18; a.lockMove = true; p.iframes = Math.max(p.iframes, 16); },
    tick(sim, p, a) {
      if (a.t < 11) { const sp = 1100 * (1 - a.t / 12); p.x -= Math.cos(a.ang) * sp * DT; p.y -= Math.sin(a.ang) * sp * DT; }
      if (a.t !== 7 || sim.predicting) return;
      const D = RNG.deadeye;
      let best = null, bs = -Infinity;
      for (const e of sim.enemies) { if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > D.range + e.r) continue; const sc = stackN(e, 'quarry', p.id) * 1000 - Math.hypot(e.x - a.data.tx, e.y - a.data.ty) * 0.5; if (sc > bs) { bs = sc; best = e; } }
      const ang = best ? Math.atan2(best.y - p.y, best.x - p.x) : a.ang;
      const n = best ? takeStacks(sim, p, best, 'quarry') : 0;
      spawnProjectile(sim, { team: 'player', ownerId: p.id, x: p.x, y: p.y, vx: Math.cos(ang) * D.speed, vy: Math.sin(ang) * D.speed, r: 12, life: Math.round(D.range / D.speed * 60) + 4, mul: D.base + D.perStack * n, forceCrit: true, bigNum: true, kb: 320, stagger: 40, knockdown: 60, pierce: -1, style: 'sniper', heavy: true, hitstop: 10 });
      sim.emit({ type: 'deadeye', pid: p.id, x: R0(p.x), y: R0(p.y), tx: R0(best ? best.x : p.x + Math.cos(ang) * 400), ty: R0(best ? best.y : p.y + Math.sin(ang) * 400), n, id: best ? best.id : 0, mul: +(D.base + D.perStack * n).toFixed(1) });
    },
  },
  skyfall: {
    start(sim, p, a) {
      const F = FIN.skyfall; finBegin(p, a, F.dur); a.lockMove = false; a.moveMul = 0.3;
      if (sim.predicting) return;
      a.data.sf = { cx: p.x, cy: p.y, hits: new Map(), q: [], total: 0, n: 0 };
      finEmit(sim, p, 'skyfall', 'start', { x: R0(p.x), y: R0(p.y), r: F.r, lead: F.lead });
    },
    tick(sim, p, a) {
      const F = FIN.skyfall, d = a.data.sf;
      if (!d) return;
      const w = (a.t - F.lead) / F.every;
      if (a.t >= F.lead && Number.isInteger(w) && w < F.waves) {
        const pts = rainPoints(sim, d, F.perWave, F.r, 50);
        for (const pt of pts) d.q.push([a.t + F.fall, pt[0], pt[1]]);
        finEmit(sim, p, 'skyfall', 'wave', { i: w, pts, fall: F.fall, x: R0(d.cx), y: R0(d.cy) });
      }
      const due = d.q.filter((q) => q[0] <= a.t);
      if (due.length) {
        d.q = d.q.filter((q) => q[0] > a.t);
        for (const [, x, y] of due) hitEnemiesInShape(sim, p, { shape: 'circle', x, y, r: F.arrowR }, { mul: F.mul, kb: 90, stagger: 10, hitstop: 2, heavy: true, style: 'arrow', onHit: (dm) => { d.total += dm; d.n++; } });
      }
      if (a.t === F.lead + F.waves * F.every + F.fall + 2) { finEmit(sim, p, 'skyfall', 'end', { x: R0(d.cx), y: R0(d.cy), dmg: R0(d.total), n: d.n }); endUltWindow(sim, p, 'skyfall'); a.dur = a.t + 18; a.cancel = a.t + 4; }
    },
  },
  heavens_arrow: {
    start(sim, p, a) {
      const F = FIN.heavens_arrow; finBegin(p, a, F.dur);
      if (sim.predicting) return;
      const e = finTarget(sim, p, a, F.range);
      if (e) a.ang = Math.atan2(e.y - p.y, e.x - p.x);
      a.data.ha = { id: e ? e.id : 0 };
      finEmit(sim, p, 'heavens_arrow', 'start', { id: e ? e.id : 0, x: R0(p.x), y: R0(p.y), tx: R0(e ? e.x : p.x + Math.cos(a.ang) * 400), ty: R0(e ? e.y : p.y + Math.sin(a.ang) * 400), n: e ? Math.min(F.maxStacks, stackN(e, 'quarry', p.id)) : 0, charge: F.charge });
    },
    tick(sim, p, a) {
      p.superArmor = true; p.iframes = Math.max(p.iframes, 8);
      const F = FIN.heavens_arrow, d = a.data.ha;
      if (!d) return;
      const e = d.id ? sim.enemyById.get(d.id) : null, live = e && !e.dead;
      if (live && a.t < F.charge) { a.ang = Math.atan2(e.y - p.y, e.x - p.x); p.aim = a.ang; if (a.t > F.charge - 20) e.hitstop = Math.max(e.hitstop, 2); }
      if (a.t !== F.charge) return;
      const n = live ? Math.min(F.maxStacks, takeStacks(sim, p, e, 'quarry')) : 0, mul = F.base + F.perStack * n;
      let dmg = 0, others = 0;
      if (live) { const r = hitEnemy(sim, p, e, { mul, forceCrit: true, bigNum: true, heavy: true, stagger: 90, knockdown: e.boss ? 0 : 120, kb: e.boss ? 0 : 500, kbAng: a.ang, hitstop: 18, style: 'sniper' }); dmg = r ? r.dmg : 0; }
      hitEnemiesInShape(sim, p, { shape: 'line', x: p.x, y: p.y, ang: a.ang, len: F.len, w: F.w }, { mul: mul * F.lineMul, forceCrit: true, heavy: true, knockdown: 80, kb: 340, kbAng: a.ang, hitstop: 8, style: 'sniper', onHit: () => { others++; } }, new Set(live ? [e.id] : []));
      p.vx -= Math.cos(a.ang) * 420; p.vy -= Math.sin(a.ang) * 420;
      finEmit(sim, p, 'heavens_arrow', 'release', { id: d.id, fx: R0(p.x), fy: R0(p.y), x: R0(p.x + Math.cos(a.ang) * F.len), y: R0(p.y + Math.sin(a.ang) * F.len), tx: R0(live ? e.x : p.x), ty: R0(live ? e.y : p.y), ang: +a.ang.toFixed(2), n, dmg: R0(dmg), mul, others, killed: !!(e && e.dead) });
      endUltWindow(sim, p, 'heavens_arrow');
    },
  },
  // ===== Mage =====
  glacial_cascade: {
    start(sim, p, a) {
      a.dur = 22; a.cancel = 14; a.moveMul = 0.25;
      const M = MAG.cascade, t = clampTo(p, a.data.tx, a.data.ty, 390);
      addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: t.x, y: t.y, r: M.r, delay: M.delay, kind: 'blast', o: { mul: 2.3, kb: 0, stagger: 30, bonusVsFrozen: 2, hitstop: 7, heavy: true } }); // no knockback: the frozen stay put for the chain
      schedule(sim, p, M.delay + 1, { k: 'cascade', x: t.x, y: t.y, r: M.r });
    },
  },
  supernova: {
    start(sim, p, a) {
      a.dur = 24; a.cancel = 16; a.moveMul = 0.2;
      const S = MAG.supernova, t = clampTo(p, a.data.tx, a.data.ty, 390);
      addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: t.x, y: t.y, r: 130, delay: S.delay, kind: 'blast', o: { mul: 2.3, kb: 300, stagger: 30, hitstop: 7, heavy: true } });
      sim.emit({ type: 'supernova', pid: p.id, ph: 'charge', x: R0(t.x), y: R0(t.y), t: S.delay });
      schedule(sim, p, S.delay, { k: 'supernova', x: t.x, y: t.y });
    },
  },
  armageddon: {
    start(sim, p, a) {
      const F = FIN.armageddon; finBegin(p, a, F.dur); a.lockMove = false; a.moveMul = 0.25;
      if (sim.predicting) return;
      a.data.ar = { cx: p.x, cy: p.y, hits: new Map(), q: [], total: 0, n: 0 };
      finEmit(sim, p, 'armageddon', 'start', { x: R0(p.x), y: R0(p.y), r: F.r, lead: F.lead });
    },
    tick(sim, p, a) {
      const F = FIN.armageddon, d = a.data.ar;
      if (!d) return;
      const i = (a.t - F.lead) / F.every;
      if (a.t >= F.lead && Number.isInteger(i) && i < F.count) {
        const [pt] = rainPoints(sim, d, 1, F.r, 40);
        d.q.push([a.t + F.fall, pt[0], pt[1]]);
        finEmit(sim, p, 'armageddon', 'meteor', { i, x: pt[0], y: pt[1], fall: F.fall, r: F.meteorR });
      }
      const due = d.q.filter((q) => q[0] <= a.t);
      if (due.length) {
        d.q = d.q.filter((q) => q[0] > a.t);
        for (const [, x, y] of due) { let n = 0; hitEnemiesInShape(sim, p, { shape: 'circle', x, y, r: F.meteorR }, { mul: F.mul, knockdown: F.knockdown, kb: 260, hitstop: 6, heavy: true, stack: ['burn', MAG.burn.meteor], onHit: (dm) => { d.total += dm; d.n++; n++; } }); finEmit(sim, p, 'armageddon', 'land', { x, y, r: F.meteorR, n }); }
      }
      if (a.t === F.lead + F.count * F.every + F.fall + 2) { finEmit(sim, p, 'armageddon', 'end', { x: R0(d.cx), y: R0(d.cy), dmg: R0(d.total), n: d.n }); endUltWindow(sim, p, 'armageddon'); a.dur = a.t + 16; a.cancel = a.t + 4; }
    },
  },
  singularity: {
    start(sim, p, a) {
      const F = FIN.singularity; finBegin(p, a, F.dur);
      if (sim.predicting) return;
      const e = finTarget(sim, p, a, F.range);
      const x = e ? e.x : clampTo(p, a.data.tx, a.data.ty, F.range).x, y = e ? e.y : clampTo(p, a.data.tx, a.data.ty, F.range).y;
      a.data.sg = { id: e ? e.id : 0, x, y, total: 0 };
      finEmit(sim, p, 'singularity', 'start', { id: e ? e.id : 0, x: R0(x), y: R0(y), r: F.pullR, hold: F.hold, n: e ? Math.min(F.maxStacks, stackN(e, 'burn', p.id)) : 0 });
    },
    tick(sim, p, a) {
      p.iframes = Math.max(p.iframes, 8);
      const F = FIN.singularity, d = a.data.sg;
      if (!d) return;
      const e = d.id ? sim.enemyById.get(d.id) : null, live = e && !e.dead;
      if (live) { d.x = e.x; d.y = e.y; }
      if (a.t < F.hold) {
        if (live) e.hitstop = Math.max(e.hitstop, 2); // held in place
        for (const q of sim.enemies) {
          if (q.dead || q === e) continue;
          const dx = d.x - q.x, dy = d.y - q.y, dist = Math.hypot(dx, dy);
          if (dist > F.pullR + q.r || dist < q.r + 14) continue;
          const step = Math.min(dist - q.r - 14, F.pullSpeed * DT * (q.boss ? 0.15 : 1));
          q.x += (dx / dist) * step; q.y += (dy / dist) * step; q.pulled = sim.tick;
        }
        if (a.t % F.tickEvery === 0) hitEnemiesInShape(sim, p, { shape: 'circle', x: d.x, y: d.y, r: F.tickR }, { mul: F.tickMul, kb: 0, hitstop: 1, dot: true, style: 'void', onHit: (dm) => { d.total += dm; } });
        return;
      }
      if (a.t !== F.hold) return;
      const n = live ? Math.min(F.maxStacks, takeStacks(sim, p, e, 'burn')) : 0, mul = F.base + F.perStack * n;
      let dmg = 0;
      if (live) { const r = hitEnemy(sim, p, e, { mul, forceCrit: true, bigNum: true, heavy: true, stagger: 90, knockdown: e.boss ? 0 : 120, kb: 0, hitstop: 18, style: 'void' }); dmg = r ? r.dmg : 0; }
      for (const q of sim.enemies) if (!q.dead && q !== e && Math.hypot(q.x - d.x, q.y - d.y) < F.splashR + q.r) { takeStacks(sim, p, q, 'burn'); hitEnemy(sim, p, q, { mul: mul * 0.5, forceCrit: true, knockdown: 90, kb: 380, kbAng: Math.atan2(q.y - d.y, q.x - d.x), hitstop: 8, heavy: true, style: 'void' }); }
      p.hitstop = Math.max(p.hitstop, 8);
      finEmit(sim, p, 'singularity', 'collapse', { id: d.id, x: R0(d.x), y: R0(d.y), r: F.splashR, n, dmg: R0(dmg), mul: +mul.toFixed(1), killed: !!(e && e.dead) });
      endUltWindow(sim, p, 'singularity');
    },
  },
  // ===== Cleric =====
  holy_nova: {
    start(sim, p, a) { a.dur = 30; a.cancel = 22; a.lockMove = true; },
    tick(sim, p, a) {
      p.superArmor = true;
      if (a.t < 8) { p.x += Math.cos(a.ang) * 120 * DT; p.y += Math.sin(a.ang) * 120 * DT; }
      if (a.t !== 11) return;
      const N = CLR.nova, s = p.lastSanct && sim.tick - p.lastSanct.tick < N.ttl ? p.lastSanct : null;
      const x = s ? s.x : p.x, y = s ? s.y : p.y, r = s ? s.r : N.fallbackR;
      sim.emit({ type: 'holyNova', pid: p.id, x: R0(x), y: R0(y), r });
      if (sim.predicting) return;
      if (s) { const ar = sim.areas.find((q) => q.id === s.id); if (ar) ar.dead = true; p.lastSanct = null; }
      hitEnemiesInShape(sim, p, { shape: 'circle', x, y, r: r + N.extra }, { mul: N.mul, forceCrit: true, knockdown: N.knockdown, kb: 300, hitstop: 8, heavy: true, style: 'holy', stack: ['condemn', 1] });
      healAllies(sim, p, x, y, r + N.healR, (q) => q.stats.maxHp * N.heal + p.stats.atk * N.healAtk);
      p.hitstop = Math.max(p.hitstop, 5);
    },
  },
  rapture: {
    start(sim, p, a) {
      const F = FIN.rapture; finBegin(p, a, F.dur);
      if (sim.predicting) return;
      a.data.rp = { cx: p.x, cy: p.y, hits: new Map(), q: [], total: 0, n: 0, healed: 0 };
      finEmit(sim, p, 'rapture', 'start', { x: R0(p.x), y: R0(p.y), r: F.r, lead: F.lead });
    },
    tick(sim, p, a) {
      p.superArmor = true; p.iframes = Math.max(p.iframes, 8);
      const F = FIN.rapture, d = a.data.rp;
      if (!d) return;
      const i = (a.t - F.lead) / F.every;
      if (a.t >= F.lead && Number.isInteger(i) && i < F.pillars) {
        const [pt] = rainPoints(sim, d, 1, F.r, 30);
        d.q.push([a.t + F.fall, pt[0], pt[1]]);
        finEmit(sim, p, 'rapture', 'pillar', { i, x: pt[0], y: pt[1], fall: F.fall, r: F.pillarR });
      }
      const due = d.q.filter((q) => q[0] <= a.t);
      if (due.length) {
        d.q = d.q.filter((q) => q[0] > a.t);
        for (const [, x, y] of due) {
          hitEnemiesInShape(sim, p, { shape: 'circle', x, y, r: F.pillarR }, { mul: F.mul, forceCrit: true, stagger: 20, kb: 120, hitstop: 4, heavy: true, style: 'holy', onHit: (dm) => { d.total += dm; d.n++; } });
          d.healed += healAllies(sim, p, x, y, F.pillarR, (q) => q.stats.maxHp * F.heal);
        }
      }
      if (a.t === F.lead + F.pillars * F.every + F.fall + 4) {
        for (const q of sim.players.values()) if (!q.dead && Math.hypot(q.x - p.x, q.y - p.y) < F.partyR) d.healed += healPlayer(sim, q, q.stats.maxHp * F.finalHeal, p);
        finEmit(sim, p, 'rapture', 'end', { x: R0(p.x), y: R0(p.y), dmg: R0(d.total), n: d.n, healed: R0(d.healed) });
        endUltWindow(sim, p, 'rapture'); a.dur = a.t + 18; a.cancel = a.t + 4;
      }
    },
  },
  heavens_judgment: {
    start(sim, p, a) {
      const F = FIN.heavens_judgment; finBegin(p, a, F.dur);
      if (sim.predicting) return;
      const e = finTarget(sim, p, a, F.range);
      if (e) { e.hitstop = Math.max(e.hitstop, F.impact + 2); a.ang = Math.atan2(e.y - p.y, e.x - p.x); }
      a.data.hj = { id: e ? e.id : 0 };
      finEmit(sim, p, 'heavens_judgment', 'start', { id: e ? e.id : 0, x: R0(e ? e.x : p.x), y: R0(e ? e.y : p.y), r: e ? e.r : 30, n: e ? Math.min(F.maxStacks, stackN(e, 'condemn', p.id)) : 0, impact: F.impact, boss: !!(e && e.boss) });
    },
    tick(sim, p, a) {
      p.superArmor = true; p.iframes = Math.max(p.iframes, 8);
      const F = FIN.heavens_judgment, d = a.data.hj;
      if (!d) return;
      const e = d.id ? sim.enemyById.get(d.id) : null, live = e && !e.dead;
      if (live && a.t < F.impact) e.hitstop = Math.max(e.hitstop, 2);
      if (a.t !== F.impact) return;
      const x = live ? e.x : p.x, y = live ? e.y : p.y;
      const n = live ? Math.min(F.maxStacks, takeStacks(sim, p, e, 'condemn')) : 0, mul = F.base + F.perStack * n;
      let dmg = 0, healed = 0;
      if (live) { const r = hitEnemy(sim, p, e, { mul, forceCrit: true, bigNum: true, heavy: true, stagger: 90, knockdown: e.boss ? 0 : 140, kb: 0, hitstop: 18, style: 'holy' }); dmg = r ? r.dmg : 0; }
      for (const q of sim.enemies) if (!q.dead && q !== e && Math.hypot(q.x - x, q.y - y) < F.quakeR + q.r) hitEnemy(sim, p, q, { mul: F.quakeMul, forceCrit: true, knockdown: 80, kb: 280, kbAng: Math.atan2(q.y - y, q.x - x), hitstop: 8, heavy: true, style: 'holy' });
      for (const q of sim.players.values()) if (!q.dead && Math.hypot(q.x - p.x, q.y - p.y) < F.partyR) { healed += healPlayer(sim, q, q.stats.maxHp * F.heal, p); grantShield(sim, q, shieldAmount(p), 300, p); }
      p.hitstop = Math.max(p.hitstop, 10);
      finEmit(sim, p, 'heavens_judgment', 'impact', { id: d.id, x: R0(x), y: R0(y), r: live ? e.r : 30, n, dmg: R0(dmg), mul, healed: R0(healed), killed: !!(e && e.dead) });
      endUltWindow(sim, p, 'heavens_judgment');
    },
  },
};

// ------------------------------------------------------------------ scheduled jobs
const JOBS = {
  /** Storm Lance: the arrow reached the volley zone: a new arrow for every enemy inside. */
  split(sim, p, s) {
    const L = RNG.lance;
    const list = sim.enemies.filter((e) => !e.dead && Math.hypot(e.x - s.x, e.y - s.y) < s.r + L.zoneExtra + e.r)
      .sort((u, v) => Math.hypot(u.x - s.x, u.y - s.y) - Math.hypot(v.x - s.x, v.y - s.y)).slice(0, L.maxSplit);
    const pts = [];
    list.forEach((e, i) => {
      let ang = Math.atan2(e.y - s.y, e.x - s.x);
      if (Math.hypot(e.x - s.x, e.y - s.y) < 8) ang = (i / Math.max(1, list.length)) * Math.PI * 2;
      const dist = Math.hypot(e.x - s.x, e.y - s.y) + 260;
      spawnProjectile(sim, { team: 'player', ownerId: p.id, x: s.x - Math.cos(ang) * 30, y: s.y - Math.sin(ang) * 30, vx: Math.cos(ang) * L.splitSpeed, vy: Math.sin(ang) * L.splitSpeed, r: 9, life: Math.round(dist / L.splitSpeed * 60), mul: L.splitMul, kb: 160, stagger: 18, pierce: 1, style: 'lance', heavy: true, hitstop: 3 });
      pts.push([R0(e.x), R0(e.y)]);
    });
    sim.emit({ type: 'stormLance', pid: p.id, ph: 'split', x: R0(s.x), y: R0(s.y), r: s.r, n: list.length, pts });
  },
  /** Glacial Cascade: frozen enemies in the blast shatter and set off frozen neighbours (BFS, `step` ticks per link). */
  cascade(sim, p, s) {
    const M = MAG.cascade, seen = new Set(), q = [];
    for (const e of sim.enemies) if (!e.dead && e.cc.frozen && Math.hypot(e.x - s.x, e.y - s.y) < s.r + e.r) { seen.add(e.id); q.push({ e, d: 0, fx: s.x, fy: s.y }); }
    const out = [];
    while (q.length && out.length < M.max) {
      const c = q.shift();
      out.push(c);
      for (const e of sim.enemies) if (!e.dead && e.cc.frozen && !seen.has(e.id) && Math.hypot(e.x - c.e.x, e.y - c.e.y) < M.link + e.r) { seen.add(e.id); q.push({ e, d: c.d + 1, fx: c.e.x, fy: c.e.y }); }
    }
    for (const c of out) schedule(sim, p, c.d * M.step, { k: 'shard', id: c.e.id, d: c.d, fx: c.fx, fy: c.fy });
    sim.emit({ type: 'glacialCascade', pid: p.id, x: R0(s.x), y: R0(s.y), n: out.length });
  },
  shard(sim, p, s) {
    const M = MAG.cascade, e = sim.enemyById.get(s.id);
    if (!e || e.dead) return;
    sim.emit({ type: 'shatterChain', pid: p.id, id: e.id, x: R0(e.x), y: R0(e.y), fx: R0(s.fx), fy: R0(s.fy), d: s.d, r: e.r });
    e.cc.frozen = false;
    hitEnemy(sim, p, e, { mul: M.mul, forceCrit: true, heavy: true, stagger: 30, kb: 120, kbAng: Math.atan2(e.y - s.fy, e.x - s.fx), hitstop: 6, style: 'ice' });
    hitEnemiesInShape(sim, p, { shape: 'circle', x: e.x, y: e.y, r: M.splashR }, { mul: M.splashMul, kb: 80, hitstop: 2, style: 'ice' }, new Set([e.id]));
  },
  /** Supernova: every Burn stack on every enemy within range detonates. */
  supernova(sim, p, s) {
    const S = MAG.supernova, hits = [];
    let total = 0;
    for (const e of sim.enemies) {
      if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > S.r + e.r) continue;
      const n = takeStacks(sim, p, e, 'burn');
      if (!n) continue;
      const r = hitEnemy(sim, p, e, { mul: S.base + S.perStack * n, forceCrit: true, heavy: true, stagger: 30, kb: 200, kbAng: Math.atan2(e.y - s.y, e.x - s.x), hitstop: 8, style: 'fire', bigNum: n >= 6 || undefined });
      if (r) total += r.dmg;
      hits.push([R0(e.x), R0(e.y), n]);
    }
    sim.emit({ type: 'supernova', pid: p.id, ph: 'boom', x: R0(s.x), y: R0(s.y), r: S.r, hits, dmg: R0(total) });
  },
};

// ------------------------------------------------------------------ the 8th-chain set (every class has 8 chains, like the Blade Dancer)
/** Tuning for the new chains (fun first; see the README balance notes). */
export const CH = {
  web: { delay: 14, r: 190, root: 120, mul: 0.8, trapR: 150, trapMul: 1.6, volleyMul: 1.2, range: 430 },
  rico: { range: 560, hop: 420, hops: 8, every: 5, mul: 1.5, perQ: 0.25, maxQ: 6, lone: 3 },
  hawks: { range: 420, r: 300, n: 8, lead: 10, every: 5, burst: 60, mul: 1.0, fall: 8 },
  steam: { r: 200, base: 1.4, perBurn: 0.5, splashR: 110, splashMul: 0.8, freeze: 80, cloudR: 150 },
  comet: { range: 240, iframes: 26, r: 150, mul: 3.6, delay: 6, burn: 3 },
  chrono: { r: 190, dur: 84, echo: 0.4, base: 1.0, perBurn: 0.8, bossHold: 60, blastTtl: 150 },
  storm: { range: 420, hop: 360, jumps: 8, every: 4, base: 1.3, per: 0.15, maxN: 10, heal: 0.015, lone: 3 },
  aegis: { range: 420, hop: 300, bounces: 6, every: 5, mul: 1.4, shieldPer: 0.05, shieldMax: 0.3, lone: 3 },
  absolution: { r: 420, base: 0.8, per: 0.4, healPer: 0.02, healCap: 0.45, partyR: 600, hitT: 14 },
};
/** Cleric Guardian Angel: summoned by Shield Rush → Smite in Consecration; echoes every Smite while it stays. */
export const ANGEL = { dur: 480, echoMul: 0.7, delay: 14 };
const liveNear = (sim, x, y, r, skip) => sim.enemies.filter((e) => !e.dead && !(skip && skip(e)) && Math.hypot(e.x - x, e.y - y) < r + e.r);
/** Next bounce target for ricochet-type chains: best score within `hop` of (x, y), not yet hit (a lone target may be re-hit `lone` times). */
function nextBounce(sim, s, hop, score, lone) {
  let best = null, bs = -Infinity;
  for (const e of liveNear(sim, s.x, s.y, hop)) { if (s.hit.includes(e.id)) continue; const v = score(e) - Math.hypot(e.x - s.x, e.y - s.y) * 0.01; if (v > bs) { bs = v; best = e; } }
  if (!best && s.last) { const e = sim.enemyById.get(s.last); if (e && !e.dead && (s.re || 0) < lone - 1) { s.re = (s.re || 0) + 1; best = e; } }
  return best;
}
Object.assign(CHAIN_FX, {
  // ===== Ranger =====
  snare_web: { // Snare Trap → Arrow Volley
    start(sim, p, a) {
      a.dur = 18; a.cancel = 12; a.moveMul = 0.3;
      const W = CH.web, V = CLASSES.ranger.skills.R.stats, t = clampTo(p, a.data.tx, a.data.ty, W.range);
      p.lastVolley = { x: t.x, y: t.y, r: V.r, tick: sim.tick };
      addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: t.x, y: t.y, r: V.r, delay: 10, pulses: V.pulses, every: V.every, kind: 'volley', o: { mul: V.mul * W.volleyMul, slow: 120, slowMul: V.slowMul, kb: 40, stagger: 6, hitstop: 1 } });
      schedule(sim, p, W.delay, { k: 'web', x: t.x, y: t.y });
    },
  },
  ricochet: { // Arrow Volley → Piercing Arrow
    start(sim, p, a) { a.dur = 26; a.cancel = 18; a.moveMul = 0.1; },
    tick(sim, p, a) {
      if (a.t !== 8) return;
      sim.emit({ type: 'shoot', pid: p.id, x: p.x, y: p.y, ang: a.ang, cls: p.cls, heavy: true, pierce: true });
      if (sim.predicting) return;
      const C = CH.rico, e = pickTarget(sim, p, a.data.tx, a.data.ty, C.range) || nearest(sim, p.x, p.y, C.range);
      const s = { x: p.x, y: p.y, hit: [], i: 0, last: 0 };
      if (e) { s.first = e.id; schedule(sim, p, Math.max(1, Math.round(Math.hypot(e.x - p.x, e.y - p.y) / 1400 * 60)), { k: 'rico', s }); }
      sim.emit({ type: 'ricochet', ph: 'fire', pid: p.id, fx: R0(p.x), fy: R0(p.y), x: R0(e ? e.x : p.x + Math.cos(a.ang) * 400), y: R0(e ? e.y : p.y + Math.sin(a.ang) * 400) });
    },
  },
  hawkstorm: { // Focus: Dash Shot → Piercing Arrow
    start(sim, p, a) { a.dur = 24; a.cancel = 16; a.moveMul = 0.3; },
    tick(sim, p, a) {
      if (a.t !== 6 || sim.predicting) return;
      const H = CH.hawks, c = clampTo(p, a.data.tx, a.data.ty, H.range);
      const d = { cx: c.x, cy: c.y, hits: new Map() };
      for (let i = 0; i < H.n; i++) schedule(sim, p, H.lead + i * H.every, { k: 'hawk', d, i });
      sim.emit({ type: 'hawkstorm', ph: 'call', pid: p.id, x: R0(c.x), y: R0(c.y), r: H.r, n: H.n, px: R0(p.x), py: R0(p.y) });
    },
  },
  // ===== Mage =====
  comet_step: { // Arcane Surge: Blink → Meteor
    start(sim, p, a) {
      a.dur = 14; a.cancel = 8; a.moveMul = 0;
      const C = CH.comet, from = { x: p.x, y: p.y }, t = clampTo(p, a.data.tx, a.data.ty, C.range);
      let tx = t.x, ty = t.y;
      ({ x: tx, y: ty } = clearPath(sim.world, from.x, from.y, tx, ty, p.r));
      p.x = tx; p.y = ty; p.px = tx; p.py = ty;
      p.iframes = Math.max(p.iframes, C.iframes);
      sim.emit({ type: 'blink', pid: p.id, fx: from.x, fy: from.y, x: p.x, y: p.y });
      const M = CLASSES.mage.skills.R.stats;
      addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: from.x, y: from.y, r: C.r, delay: C.delay, kind: 'meteor', o: { mul: C.mul, knockdown: 90, kb: 320, hitstop: 10, heavy: true, stack: ['burn', C.burn] } });
      addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: from.x, y: from.y, r: 110, delay: C.delay + 20, pulses: M.burnPulses, every: M.burnEvery, kind: 'burn', o: { mul: M.burnMul, hitstop: 0, stack: ['burn', MAG.burn.pulse] } });
      if (!sim.predicting) sim.emit({ type: 'cometStep', pid: p.id, fx: R0(from.x), fy: R0(from.y), x: R0(p.x), y: R0(p.y), r: C.r, t: C.delay });
    },
  },
  steam_burst: { // Meteor → Frost Nova
    start(sim, p, a) { a.dur = 20; a.cancel = 12; a.moveMul = 0; a.data.r = CH.steam.r; },
    tick(sim, p, a) {
      if (a.t !== 5) return;
      const S = CH.steam;
      sim.emit({ type: 'nova', pid: p.id, x: p.x, y: p.y, r: S.r });
      p.hitstop = Math.max(p.hitstop, 3);
      if (sim.predicting) return;
      const hits = []; let total = 0;
      for (const e of liveNear(sim, p.x, p.y, S.r)) {
        const n = takeStacks(sim, p, e, 'burn');
        if (n > 0) {
          const r = hitEnemy(sim, p, e, { mul: S.base + S.perBurn * n, forceCrit: true, freeze: S.freeze, kb: 60, hitstop: 7, heavy: true, style: 'steam', bigNum: n >= 6 || undefined });
          if (r) total += r.dmg;
          hitEnemiesInShape(sim, p, { shape: 'circle', x: e.x, y: e.y, r: S.splashR }, { mul: S.splashMul, kb: 120, hitstop: 2, style: 'steam', onHit: (dm) => { total += dm; } }, new Set([e.id]));
          hits.push([R0(e.x), R0(e.y), n]);
        } else hitEnemy(sim, p, e, { mul: CLASSES.mage.skills.F.stats.mul, freeze: S.freeze, kb: 60, hitstop: 5, heavy: true });
      }
      let clouds = 0; // your burning ground within the nova boils into steam (a slowing cloud)
      for (const ar of sim.areas) if (!ar.dead && ar.ownerId === p.id && ar.kind === 'burn' && Math.hypot(ar.x - p.x, ar.y - p.y) < S.r + ar.r) { ar.dead = true; clouds++; addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: ar.x, y: ar.y, r: S.cloudR, delay: 2, pulses: 6, every: 20, kind: 'steam', noDamage: true, slow: { t: 40, mul: 0.4 } }); }
      sim.emit({ type: 'steamBurst', pid: p.id, x: R0(p.x), y: R0(p.y), r: S.r, hits, dmg: R0(total), clouds });
    },
  },
  chrono_field: { // Arcane Blast → Frost Nova
    start(sim, p, a) { a.dur = 22; a.cancel = 14; a.moveMul = 0; },
    tick(sim, p, a) {
      if (a.t !== 5) return;
      const C = CH.chrono, b = p.lastBlast && sim.tick - p.lastBlast.tick < C.blastTtl ? p.lastBlast : null;
      const x = b ? b.x : p.x, y = b ? b.y : p.y;
      sim.emit({ type: 'nova', pid: p.id, x, y, r: C.r, chrono: 1 });
      if (sim.predicting) return;
      let n = 0;
      for (const e of liveNear(sim, x, y, C.r)) {
        e.chrono = { pid: p.id, dmg: 0 };
        if (e.boss || e.ccRes) e.hitstop = Math.max(e.hitstop, C.bossHold); else { e.cc.stun = Math.max(e.cc.stun, C.dur); e.cc.frozen = true; e.vx = e.vy = 0; } // (mission bosses hold like bosses: no stun-lock)
        n++;
      }
      schedule(sim, p, C.dur, { k: 'chrono', x, y });
      sim.emit({ type: 'chronoField', ph: 'start', pid: p.id, x: R0(x), y: R0(y), r: C.r, t: C.dur, n });
    },
  },
  // ===== Cleric =====
  guardian_angel: { // Consecration: Shield Rush → Smite
    start(sim, p, a) {
      SKILLS.smite.start(sim, p, a);
      if (sim.predicting) return;
      p.angel = ANGEL.dur;
      sim.emit({ type: 'angel', ph: 'summon', pid: p.id, x: R0(p.x), y: R0(p.y), t: ANGEL.dur });
    },
    tick(sim, p, a) { SKILLS.smite.tick(sim, p, a); },
  },
  divine_storm: { // Smite → Shield Rush
    start(sim, p, a) { a.dur = 26; a.cancel = 18; a.lockMove = true; },
    tick(sim, p, a) {
      p.superArmor = true;
      if (a.t !== 8 || sim.predicting) return;
      const D = CH.storm, e = pickTarget(sim, p, a.data.tx, a.data.ty, D.range) || nearest(sim, p.x, p.y, D.range);
      sim.emit({ type: 'divineStorm', ph: 'call', pid: p.id, x: R0(p.x), y: R0(p.y) });
      if (e) schedule(sim, p, 2, { k: 'storm', s: { x: p.x, y: p.y - 60, hit: [], i: 0, last: 0, first: e.id } });
    },
  },
  aegis_throw: { // Holy Hammer → Shield Rush
    start(sim, p, a) { a.dur = 24; a.cancel = 16; a.moveMul = 0.3; },
    tick(sim, p, a) {
      if (a.t !== 6 || sim.predicting) return;
      const A = CH.aegis, e = pickTarget(sim, p, a.data.tx, a.data.ty, A.range) || nearest(sim, p.x, p.y, A.range);
      if (!e) { sim.emit({ type: 'aegisThrow', ph: 'return', pid: p.id, fx: R0(p.x + Math.cos(a.ang) * 300), fy: R0(p.y + Math.sin(a.ang) * 300), x: R0(p.x), y: R0(p.y), n: 0 }); return; }
      schedule(sim, p, Math.max(1, Math.round(Math.hypot(e.x - p.x, e.y - p.y) / 1100 * 60)), { k: 'aegis', s: { x: p.x, y: p.y, hit: [], i: 0, last: 0, first: e.id } });
      sim.emit({ type: 'aegisThrow', ph: 'throw', pid: p.id, fx: R0(p.x), fy: R0(p.y), x: R0(e.x), y: R0(e.y) });
    },
  },
  absolution: { // Sanctuary → Judgment (with Condemn up)
    start(sim, p, a) {
      const charge = Math.max(0, Math.min(p.stats.maxRes, a.data.resBefore ?? p.res));
      a.data.k = charge / Math.max(1, p.stats.maxRes); p.res = 0;
      a.data.hitT = CH.absolution.hitT; a.dur = a.data.hitT + 18; a.cancel = a.dur - 6; a.lockMove = true;
    },
    tick(sim, p, a) {
      p.superArmor = true;
      if (a.t !== a.data.hitT) return;
      const A = CH.absolution, k = a.data.k ?? 0;
      sim.emit({ type: 'judgment', pid: p.id, x: p.x, y: p.y, r: 150, k });
      p.hitstop = Math.max(p.hitstop, 6);
      if (sim.predicting) return;
      const hits = []; let N = 0, total = 0;
      for (const e of liveNear(sim, p.x, p.y, A.r)) {
        const n = takeStacks(sim, p, e, 'condemn');
        if (!n) continue;
        N += n;
        const r = hitEnemy(sim, p, e, { mul: (A.base + A.per * n) * (1 + 0.5 * k), forceCrit: true, knockdown: 60, kb: 260, kbAng: Math.atan2(e.y - p.y, e.x - p.x), hitstop: 8, heavy: true, style: 'holy', bigNum: n >= 6 || undefined });
        if (r) total += r.dmg;
        hits.push([R0(e.x), R0(e.y), n]);
      }
      let healed = 0;
      const pct = Math.min(A.healCap, A.healPer * N);
      if (pct > 0) for (const q of sim.players.values()) if (!q.dead && Math.hypot(q.x - p.x, q.y - p.y) < A.partyR) healed += healPlayer(sim, q, q.stats.maxHp * pct, p);
      sim.emit({ type: 'absolution', pid: p.id, x: R0(p.x), y: R0(p.y), r: A.r, hits, n: N, dmg: R0(total), healed: R0(healed) });
    },
  },
});
Object.assign(JOBS, {
  /** Snare Web: the volley's web + every one of your traps detonates. */
  web(sim, p, s) {
    const W = CH.web, traps = [];
    let n = hitEnemiesInShape(sim, p, { shape: 'circle', x: s.x, y: s.y, r: W.r }, { mul: W.mul, root: W.root, hitstop: 4, style: 'web' });
    for (const id of p.traps || []) {
      const ar = sim.areas.find((q) => q.id === id && !q.dead);
      if (!ar) continue;
      ar.dead = true; traps.push([R0(ar.x), R0(ar.y)]);
      n += hitEnemiesInShape(sim, p, { shape: 'circle', x: ar.x, y: ar.y, r: W.trapR }, { mul: W.trapMul, root: W.root, hitstop: 6, heavy: true, style: 'web', stack: ['quarry', 1] });
    }
    p.traps = [];
    sim.emit({ type: 'snareWeb', pid: p.id, x: R0(s.x), y: R0(s.y), r: W.r, tr: W.trapR, traps, n });
  },
  /** Ricochet: one hop (prefers your most-Quarried enemy). */
  rico(sim, p, s0) {
    const C = CH.rico, s = s0.s;
    const e = s.first ? sim.enemyById.get(s.first) : nextBounce(sim, s, C.hop, (q) => stackN(q, 'quarry', p.id) * 100, C.lone);
    s.first = 0;
    if (!e || e.dead) { sim.emit({ type: 'ricochet', ph: 'end', pid: p.id, x: R0(s.x), y: R0(s.y), i: s.i }); return; }
    const q = Math.min(C.maxQ, stackN(e, 'quarry', p.id));
    hitEnemy(sim, p, e, { mul: C.mul + C.perQ * q, forceCrit: q >= 2 || undefined, kb: 90, kbAng: Math.atan2(e.y - s.y, e.x - s.x), stagger: 12, hitstop: 4, heavy: true, style: 'arrow', stack: ['quarry', 1] });
    sim.emit({ type: 'ricochet', ph: 'hop', pid: p.id, fx: R0(s.x), fy: R0(s.y), x: R0(e.x), y: R0(e.y), i: s.i, q });
    if (!s.hit.includes(e.id)) s.hit.push(e.id);
    s.x = e.x; s.y = e.y; s.last = e.id; s.i++;
    if (s.i < C.hops) schedule(sim, p, C.every, { k: 'rico', s });
    else sim.emit({ type: 'ricochet', ph: 'end', pid: p.id, x: R0(s.x), y: R0(s.y), i: s.i });
  },
  /** Hawkstorm: one hawk dives. */
  hawk(sim, p, s) {
    const H = CH.hawks, [pt] = rainPoints(sim, s.d, 1, H.r, 20);
    const a = s.i * 2.39996, fx = pt[0] + Math.cos(a) * 260, fy = pt[1] - 340;
    sim.emit({ type: 'hawkstorm', ph: 'dive', pid: p.id, fx: R0(fx), fy: R0(fy), x: pt[0], y: pt[1], i: s.i, fall: H.fall });
    schedule(sim, p, H.fall, { k: 'hawkHit', x: pt[0], y: pt[1], i: s.i });
  },
  hawkHit(sim, p, s) {
    const H = CH.hawks;
    const n = hitEnemiesInShape(sim, p, { shape: 'circle', x: s.x, y: s.y, r: H.burst }, { mul: H.mul, kb: 80, stagger: 8, hitstop: 3, heavy: true, style: 'hawk', stack: ['quarry', 1] });
    sim.emit({ type: 'hawkstorm', ph: 'hit', pid: p.id, x: s.x, y: s.y, r: H.burst, i: s.i, n });
  },
  /** Chrono Field shatters: 40% of the damage dealt inside again + Burn-scaled crit each. */
  chrono(sim, p, s) {
    const C = CH.chrono, hits = [];
    let total = 0;
    for (const e of sim.enemies) {
      if (e.dead || !e.chrono || e.chrono.pid !== p.id) continue;
      const stored = e.chrono.dmg; e.chrono = null;
      if (!e.boss) { e.cc.frozen = false; e.cc.stun = Math.min(e.cc.stun, 10); }
      const n = takeStacks(sim, p, e, 'burn');
      if (stored > 0 && e.invuln <= 0) { const dmg = Math.max(1, Math.round(stored * C.echo)); e.hp -= dmg; e.flash = 8; if (e.dmgBy) e.dmgBy[p.id] = (e.dmgBy[p.id] || 0) + dmg; total += dmg; sim.emit({ type: 'dmg', x: e.x, y: e.y - e.r, amount: dmg, crit: true, team: 'enemy', heavy: true, pid: p.id, id: e.id }); if (e.hp <= 0) { hitEnemy(sim, p, e, { mul: 0.01, kb: 0, hitstop: 0 }); } }
      if (!e.dead) { const r = hitEnemy(sim, p, e, { mul: C.base + C.perBurn * n, forceCrit: true, kb: 160, kbAng: Math.atan2(e.y - s.y, e.x - s.x), stagger: 24, hitstop: 8, heavy: true, style: 'ice', bigNum: n >= 6 || undefined }); if (r) total += r.dmg; }
      hits.push([R0(e.x), R0(e.y), n, R0(stored)]);
    }
    sim.emit({ type: 'chronoField', ph: 'shatter', pid: p.id, x: R0(s.x), y: R0(s.y), r: C.r, hits, dmg: R0(total) });
  },
  /** Guardian Angel: the echoed Smite (70%, heals too). */
  echo(sim, p, s) {
    let dealt = 0;
    hitEnemiesInShape(sim, p, { shape: 'circle', x: s.x, y: s.y, r: s.r }, { ...s.o, mul: s.o.mul * ANGEL.echoMul, stack: ['condemn', 1], style: 'holy', onHit: (d) => { dealt += d; } });
    const share = dealt * 0.35 * (s.rf ? 2 : 1), cap = p.stats.maxHp * (s.rf ? 0.3 : 0.2);
    let healed = 0;
    if (share > 0) healed = healAllies(sim, p, p.x, p.y, 280, () => Math.min(cap, share));
    sim.emit({ type: 'angel', ph: 'echo', pid: p.id, x: R0(s.x), y: R0(s.y), r: s.r, px: R0(p.x), py: R0(p.y), dmg: R0(dealt), healed: R0(healed || 0) });
  },
  /** Divine Storm: one lightning strike (jumps to your Condemned enemies first). */
  storm(sim, p, s0) {
    const D = CH.storm, s = s0.s;
    const e = s.first ? sim.enemyById.get(s.first) : nextBounce(sim, s, D.hop, (q) => (stackN(q, 'condemn', p.id) ? 1000 : 0), D.lone);
    s.first = 0;
    if (!e || e.dead) return;
    const n = Math.min(D.maxN, stackN(e, 'condemn', p.id));
    hitEnemy(sim, p, e, { mul: D.base + D.per * n, forceCrit: n >= 3 || undefined, stagger: 16, kb: 60, hitstop: 4, heavy: true, style: 'holy', stack: ['condemn', 1] });
    const healed = healAllies(sim, p, p.x, p.y, 420, (q) => q.stats.maxHp * D.heal);
    sim.emit({ type: 'divineStorm', ph: 'strike', pid: p.id, fx: R0(s.x), fy: R0(s.y), x: R0(e.x), y: R0(e.y), i: s.i, n, healed: R0(healed || 0) });
    if (!s.hit.includes(e.id)) s.hit.push(e.id);
    s.x = e.x; s.y = e.y; s.last = e.id; s.i++;
    if (s.i < D.jumps) schedule(sim, p, D.every, { k: 'storm', s });
  },
  /** Aegis Throw: one bounce; after the last it flies home and shields you. */
  aegis(sim, p, s0) {
    const A = CH.aegis, s = s0.s;
    const e = s.first ? sim.enemyById.get(s.first) : s.i < A.bounces ? nextBounce(sim, s, A.hop, () => 0, A.lone) : null;
    s.first = 0;
    if (!e || e.dead) {
      const sh = Math.min(A.shieldMax, A.shieldPer * s.i) * p.stats.maxHp;
      if (sh > 0) grantShield(sim, p, sh, 300, p);
      sim.emit({ type: 'aegisThrow', ph: 'return', pid: p.id, fx: R0(s.x), fy: R0(s.y), x: R0(p.x), y: R0(p.y), n: s.i, shield: R0(sh) });
      return;
    }
    hitEnemy(sim, p, e, { mul: A.mul, stagger: 20, kb: 160, kbAng: Math.atan2(e.y - s.y, e.x - s.x), hitstop: 5, heavy: true, style: 'holy', stack: ['condemn', 1] });
    sim.emit({ type: 'aegisThrow', ph: 'bounce', pid: p.id, fx: R0(s.x), fy: R0(s.y), x: R0(e.x), y: R0(e.y), i: s.i });
    if (!s.hit.includes(e.id)) s.hit.push(e.id);
    s.x = e.x; s.y = e.y; s.last = e.id; s.i++;
    schedule(sim, p, A.every, { k: 'aegis', s });
  },
});

/** Berserk Finale: the Warrior's window timed out without a route finisher - a big knock-up shockwave ends it. */
export function berserkFinale(sim, p) {
  const F = WAR.finale;
  const n = hitEnemiesInShape(sim, p, { shape: 'circle', x: p.x, y: p.y, r: F.r }, { mul: F.mul, knockup: F.knockup, kb: 380, hitstop: 12, heavy: true, ult: true, poise: 10 });
  p.hitstop = Math.max(p.hitstop, 8);
  sim.emit({ type: 'berserkFinale', pid: p.id, x: R0(p.x), y: R0(p.y), r: F.r, n });
}
/** The ult window ends (timer, or a finisher: that also ends the Warrior's Berserk / the Cleric's aura). */
export function endUltWindow(sim, p, finisher = null) {
  if (!p.uw) return;
  p.uw = null;
  const C = CLASSES[p.cls];
  if (!finisher && C.rageRes && p.rage > 0 && !sim.predicting) berserkFinale(sim, p); // no route finisher: Berserk ends with its own shockwave
  if (!finisher && C.lance) dragonWrath(sim, p); // Dragoon: no route finisher - Dragon's Wrath rips out every pin
  if (!finisher && C.fist) spiritRelease(sim, p); // Monk: no route finisher - Spirit Release pops every Pressure Point
  if (!finisher && (C.grim || C.bard)) arcUltEnd(sim, p); // Summoner / Bard: no route finisher - the Last Page / the Final Bow
  if (!finisher && C.blade) voidSheathe(sim, p); // Samurai: no route finisher - the window ends in a Void Sheathe (bursts every cut)
  if (finisher || C.rageRes) {
    if (p.rage > 0) { p.rage = 0; if (C.rageRes) p.res = Math.min(p.res, C.rageRules.afterBerserk); sim.emit({ type: 'rageEnd', pid: p.id, x: p.x, y: p.y }); }
    if (finisher) p.aura = 0;
  }
  sim.emit({ type: 'ultEnd', pid: p.id, cls: p.cls, x: p.x, y: p.y, finisher: finisher || undefined });
}
