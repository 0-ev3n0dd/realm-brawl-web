// The launch intro's scene runner (pure: no DOM). Shared by the in-game player (client/intro.js), the sync compiler
// (tools/intro/build.mjs) and the tests, so the browser plays exactly what the compiler measured.
//
// Model clock: every scene runs on the theme's timeline (seconds into the track). A sim tick normally costs DT; the game's
// own presentation slow-motion (slowmo.js: chains, finishers, signature moments, boss kills) stretches it to DT / scale,
// and weighty hits add the game's hit-stop (feel.js weights; fixed here, not the player's Feel setting, so the timing is
// the same for everyone). The player steps the Run while run.time <= the music's current time.
import { Sim } from '../sim/sim.js';
import { DT, BOSS_POS, RAID_POS } from '../sim/constants.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { CLASSES } from '../sim/data/classes.js';
import { heroOf } from '../sim/heroes.js';
import { killEnemy } from '../sim/combat.js';
import { heroGear, HERO_LEVEL } from '../rotations/arena.js';
import { slowFor } from './slowmo.js';
import { hitWeight, hitStopMs } from './feel.js';
import { CUES } from './introcues.js';
import { PLAN } from './introplan.js';

// ------------------------------------------------------------------------------------------------ timeline
/** time (s) of beat i (fractional i interpolates; past the map it extrapolates at the tempo) */
export function beatTime(i, cues = CUES) {
  const b = cues.beats, n = b.length;
  if (i <= 0) return b[0] + i * cues.beatSec;
  if (i >= n - 1) return b[n - 1] + (i - (n - 1)) * cues.beatSec;
  const f = Math.floor(i), k = i - f;
  return b[f] + (b[f + 1] - b[f]) * k;
}
export const barBeat = (bar, cues = CUES) => cues.downbeats[bar];
export const barTime = (bar, cues = CUES) => beatTime(barBeat(bar, cues), cues);
/** beat index (fractional) of a time */
export function beatOf(t, cues = CUES) {
  const b = cues.beats;
  if (t <= b[0]) return (t - b[0]) / cues.beatSec;
  let lo = 0, hi = b.length - 1;
  if (t >= b[hi]) return hi + (t - b[hi]) / cues.beatSec;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (b[m] <= t) lo = m; else hi = m; }
  return lo + (t - b[lo]) / (b[lo + 1] - b[lo]);
}

/** the intro as a list of parts: the cold open, one per class, the finale. Times in track seconds. */
export function timeline(plan = PLAN, cues = CUES) {
  const parts = [{ kind: 'open', i: 0, t0: 0, t1: barTime(plan.open.end, cues), bar: 0 }];
  plan.segs.forEach((s, i) => {
    const next = plan.segs[i + 1] ? plan.segs[i + 1].bar : plan.finale.bar;
    parts.push({ kind: 'seg', i: i + 1, seg: s, bar: s.bar, t0: barTime(s.bar, cues), t1: barTime(next, cues) });
  });
  parts.push({ kind: 'finale', i: plan.segs.length + 1, seg: plan.finale, bar: plan.finale.bar, t0: barTime(plan.finale.bar, cues), t1: barTime(plan.finale.end, cues) });
  return parts;
}
export const introEnd = (plan = PLAN, cues = CUES) => barTime(plan.finale.end, cues);
/** time of beat n counted from a part's first downbeat */
export const partBeat = (part, n, cues = CUES) => beatTime(barBeat(part.bar, cues) + n, cues);
/** the finale's named beats (from the cue hits: the build where the ultimates light, the drop where everything lands) */
export function finaleBeats(part = timeline().at(-1), cues = CUES) {
  const b0 = barBeat(part.bar, cues), rel = (t) => Math.round(beatOf(t, cues) - b0);
  return { build: rel(cues.hits.build), drop: rel(cues.hits.drop), stab: rel(cues.hits.stabs[0]) };
}

// ------------------------------------------------------------------------------------------------ scenes
const GT_ARENA = { x: BOSS_POS.x, y: BOSS_POS.y + 150 };
/** the stage centre for a part: its boss's own arena */
export function stageOf(seg) {
  const boss = (seg.foes || []).find((f) => f.boss);
  const t = boss ? boss.type : 'boss';
  if (t === 'raidboss') return { x: RAID_POS.x, y: RAID_POS.y };
  const a = ENEMIES[t] && ENEMIES[t].arena;
  return a ? { x: a.x, y: a.y } : { ...GT_ARENA };
}
export const BOSS_HP = 5e7, MOB_HP = 7;
const SEED = 7300;

/** the hero script of a part: [{ cls, at, name, steps }] (the finale expands into ten) */
export function heroesOf(part, plan = PLAN, cues = CUES) {
  const s = part.seg;
  if (part.kind === 'seg') {
    const hs = [{ cls: s.cls, at: s.hero.at, name: s.name, steps: s.steps, ranged: !!s.ranged }];
    for (const a of s.allies || []) hs.push({ cls: a.cls, at: a.at, name: a.name, steps: [], ally: true });
    return hs;
  }
  if (part.kind === 'finale') {
    const fb = finaleBeats(part, cues);
    return s.order.map((cls, i) => {
      const a = -Math.PI / 2 + Math.PI + (i / s.order.length) * Math.PI * 2;
      const at = [Math.cos(a) * s.ring, Math.sin(a) * s.ring * 0.8];
      const ap = s.appear0 + i;
      return { cls, at, name: heroOf(cls).name, ranged: true, appear: ap,
        steps: [{ at: ap, appear: 1 }, { at: ap + 0.25, k: 'T' }, { land: fb.drop, k: 'SP', hit: s.spHit[cls] }] };
    });
  }
  return [];
}

const matches = (m, ev) => { for (const k in m) if (ev[k] !== m[k]) return false; return true; };
const ofHero = (ev, id) => ev.pid === id || ev.src === id || ev.owner === id;
const busy = (p) => !!((p.action && (p.action.kind === 'ult' || (p.action.kind === 'skill' && p.action.t < (p.action.cancel ?? p.action.dur) - 1))) || p.bufSkill || (p.wq && p.wq.length));

export class Run {
  /**
   * world: generateWorld(WORLD_SEED) (shared), part: an entry of timeline(), opts.sync: { key: press time } from introsync.js
   * opts.onEvent(ev, run): every sim event as it is emitted (the player feeds FX / audio from here)
   */
  constructor(world, part, opts = {}) {
    this.part = part; this.sync = opts.sync || {}; this.cues = opts.cues || CUES;
    this.time = part.t0; this.slowT = 0; this.scale = 1; this.budget = 0; this.hold = 0;
    this.log = []; this.climaxAt = null; this.lands = {}; this.presses = [];
    this.stage = stageOf(part.seg || {});
    this.sim = new Sim({ seed: SEED + part.i, spawnEnemies: false, world, smartMobs: false });
    // (no dungeon portals in a showcase: a mob killed in Frostveil / the Dunes / the caldera can roll a Crypt / Tomb / Forge
    // portal under the hero's feet; in v2026.1006.1833 the Ninja stepped into a Glacier Crypt portal and was pulled off camera)
    this.sim.noPortals = true;
    this.foes = []; this.boss = null;
    const { x: cx, y: cy } = this.stage;
    for (const f of (part.seg && part.seg.foes) || []) {
      const e = this.sim.spawnEnemy(f.type, cx + f.at[0], cy + f.at[1], f.boss ? {} : { hpMul: MOB_HP * (f.hp || 1), zoneHp: false });
      e.dropChance = 0; e.xp = 0; e.cd = 1e6; e.cd2 = 1e6; e.dmg = 0; e.contact = false; e.face = Math.PI;
      if (f.boss) { e.maxHp = e.baseMaxHp = BOSS_HP; e.hp = BOSS_HP * 0.96; this.boss = e; }
      e._home = { x: e.x, y: e.y }; this.foes.push(e);
    }
    this.heroes = heroesOf(part, PLAN, this.cues).map((h, hi) => ({ ...h, hi, p: null, si: 0, tgt: 'boss', go: null, swings: 0, want: 0, key: null }));
    for (const h of this.heroes) if (!h.appear) this.spawnHero(h);
    this.killAt = part.kind === 'finale' ? partBeat(part, finaleBeats(part, this.cues).drop, this.cues) : null;
    this.climax = part.seg ? part.seg.climax : null;
  }
  spawnHero(h) {
    const { x: cx, y: cy } = this.stage;
    h.p = this.sim.addPlayer({ name: h.name, cls: h.cls, level: HERO_LEVEL, xp: 0, equipment: heroGear(h.cls, 1) }, { x: cx + h.at[0], y: cy + h.at[1] });
    h.p.ult = 100; h.p.aim = 0;
    if (this.onSpawn) this.onSpawn(h);
  }
  get main() { return this.heroes[0] && this.heroes[0].p; }
  get done() { return this.time >= this.part.t1; }
  nextTime() { return this.time; }
  key(hi, si) { return `${this.part.i}:${hi}:${si}`; }
  due(h, si) {
    const s = h.steps[si];
    if (s.land !== undefined) { const k = this.key(h.hi, si); return this.sync[k] ?? partBeat(this.part, s.land, this.cues) - 0.3; }
    return partBeat(this.part, s.at, this.cues);
  }
  target(h) {
    const live = this.foes.filter((e) => !e.dead);
    if (h.tgt === 'pack') { const m = live.filter((e) => e !== this.boss); if (m.length) { let x = 0, y = 0; for (const e of m) { x += e.x; y += e.y; } return { x: x / m.length, y: y / m.length, e: m[0] }; } }
    if (this.boss && !this.boss.dead) return { x: this.boss.x, y: this.boss.y, e: this.boss };
    return live[0] ? { x: live[0].x, y: live[0].y, e: live[0] } : { x: this.stage.x, y: this.stage.y };
  }
  input(h) {
    const p = h.p, inp = { mx: 0, my: 0, ax: p.x + 100, ay: p.y, attack: false };
    const t = this.target(h);
    inp.ax = t.x; inp.ay = t.y;
    if (h.go) {
      const gx = this.stage.x + h.go[0], gy = this.stage.y + h.go[1], d = Math.hypot(gx - p.x, gy - p.y);
      if (d > 18) { inp.mx = (gx - p.x) / d; inp.my = (gy - p.y) / d; } else h.go = null;
    } else if (!h.ally && this.part.kind === 'seg') {
      const d = Math.hypot(t.x - p.x, t.y - p.y), want = h.ranged ? 300 : 130;
      if (d > want + 40) { inp.mx = (t.x - p.x) / d; inp.my = (t.y - p.y) / d; }
    }
    return inp;
  }
  /** one sim tick at this.time; returns the events */
  step() {
    const { sim } = this, now = this.time, steps = [];
    // pins: foes never attack, the boss holds its HP and its spot; heroes never run dry (it's a show)
    for (const e of this.foes) {
      if (e.dead) continue;
      e.cd = Math.max(e.cd, 600); e.cd2 = Math.max(e.cd2 || 0, 600);
      if (e === this.boss && !this.killing) {
        e.hp = BOSS_HP * 0.96; e.x = e.px = e._home.x; e.y = e.py = e._home.y; e.vx = e.vy = 0;
        if (e.state !== 'idle') { e.state = 'idle'; e.st = 0; }
      } else if (Math.hypot(e.x - e._home.x, e.y - e._home.y) > 140) { e.vx = e.vy = 0; e.x += (e._home.x - e.x) * 0.05; e.y += (e._home.y - e.y) * 0.05; }
      if (e.state === 'chase' || e.state === 'wander') { e.state = 'idle'; e.st = 0; }
    }
    if (this.killAt !== null && !this.killing && now >= this.killAt - 1e-9 && this.boss) {
      this.killing = true; const killer = this.heroes.at(-1).p; this.boss.hp = 1;
      killEnemy(sim, this.boss, killer ? killer.id : 0); this.log.push({ t: now, tick: sim.tick, kill: 1 });
    }
    for (const h of this.heroes) {
      if (h.p) { h.p.hp = h.p.stats.maxHp; h.p.dead = false; h.p.res = h.p.stats.maxRes; }
      let inp = null, guard = 0;
      while (h.si < h.steps.length && guard++ < 8) {
        const s = h.steps[h.si];
        if (now < this.due(h, h.si) - 1e-9) break;
        if (s.appear) { if (!h.p) this.spawnHero(h); h.si++; continue; }
        if (!h.p) break;
        if (s.tgt) { h.tgt = s.tgt; h.si++; continue; }
        if (s.go) { h.go = s.go; h.si++; continue; }
        if (h.si && h.lastSi !== h.si) { h.lastSi = h.si; h.blocked = false; }
        if (h.go) break; // (still running to the spot)
        if (s.k === 'B') { inp = inp || this.input(h); inp.attack = true; if (h.swings >= (s.n || 1)) { h.swings = 0; h.si++; continue; } break; }
        if (h.pend > 0 || busy(h.p)) { h.blocked = true; break; } // (the last press hasn't started yet / the hero is mid-skill)
        inp = inp || this.input(h);
        if (s.k === 'T') { h.p.ult = 100; h.p.gcd = 0; inp.ult = true; } else { if (h.p.cds) h.p.cds[s.k] = 0; h.p.gcd = 0; inp.skill = s.k; }
        this.presses.push({ hi: h.hi, si: h.si, k: s.k, t: now, tick: sim.tick, blocked: !!h.blocked }); h.pend = 12; h.blocked = false;
        if (s.land !== undefined) h.want = { si: h.si, hit: s.hit, t: partBeat(this.part, s.land, this.cues), key: this.key(h.hi, h.si) };
        h.si++;
        break;
      }
      if (h.p) sim.setInput(h.p.id, inp || this.input(h));
    }
    for (const h of this.heroes) if (h.pend > 0) h.pend--;
    sim.cryptPortals = []; sim.tombPortals = []; sim.forgePortals = []; // (belt and braces: see noPortals)
    sim.step();
    const evs = sim.drainEvents();
    let stop = 0;
    for (const ev of evs) {
      const h = this.heroes.find((q) => q.p && ofHero(ev, q.p.id));
      if (h && ev.type === 'attack') h.swings++;
      if (h && (ev.type === 'skill' || ev.type === 'ult')) h.pend = 0;
      if (h && h.want && matches(h.want.hit, ev)) { this.lands[h.want.key] = { t: now, target: h.want.t, err: now - h.want.t }; h.want = 0; }
      // (the finale: ten heroes at once, so only the boss kill on the drop slows the frame - every hero's own chain / hit
      // slow-mo would smear the moment they all land together)
      const sl = this.part.kind === 'finale' ? (ev.type === 'death' && ev.boss ? slowFor({ ...ev, pid: undefined }, undefined) : null)
        : h ? slowFor(ev, ev.pid) : (ev.type === 'death' && ev.boss ? slowFor(ev, undefined) : null);
      if (sl && sl.sec > 0) { this.slowT = Math.max(this.slowT, sl.sec); this.scale = sl.scale; }
      if (h && ev.type === 'hit' && !ev.clone && this.part.kind !== 'finale') stop = Math.max(stop, hitStopMs(hitWeight(ev)) / 1000);
      if (this.climax && h && h.hi === 0 && this.climaxAt === null && matches(this.climax, ev)) {
        this.climaxAt = now; this.hold = Math.max(this.hold, 0.09);
        if (!sl) { this.slowT = Math.max(this.slowT, 0.7); this.scale = Math.min(this.scale, 0.25); }
      }
      if (this.onEvent) this.onEvent(ev, this);
    }
    // advance the model clock
    let cost = DT / (this.slowT > 0 ? this.scale : 1);
    if (this.slowT > 0) { this.slowT -= cost; if (this.slowT <= 0) { this.slowT = 0; this.scale = 1; } }
    this.budget = Math.max(0, this.budget - cost * 0.22);
    if (stop > 0) { const s = Math.min(stop, Math.max(0, 0.22 - this.budget)); if (s > 0.01) { this.budget += s; cost += s; } }
    if (this.hold > 0) { cost += this.hold; this.hold = 0; }
    this.time = now + cost;
    return evs;
  }
}

// ------------------------------------------------------------------------------------------------ sync compiler
/** run a part to its end (or until `until`) with the given sync; returns the Run */
export function playOut(world, part, sync, until = part.t1) {
  const r = new Run(world, part, { sync });
  let n = 0;
  while (r.time < until && n++ < 20000) r.step();
  return r;
}
/** the land steps of a part, in order: [{ key, hi, si, t }] */
export function landSteps(part, cues = CUES) {
  const out = [];
  heroesOf(part, PLAN, cues).forEach((h, hi) => h.steps.forEach((s, si) => { if (s.land !== undefined) out.push({ key: `${part.i}:${hi}:${si}`, hi, si, t: partBeat(part, s.land, cues), k: s.k }); }));
  return out;
}
/**
 * Solve the press times so every land step's event hits its beat (each press is found by re-running the scene: the sim
 * is deterministic). Returns { sync, report: [{ key, k, t, err, late }] }.
 */
export function compilePart(world, part, sync0 = {}, cues = CUES) {
  const sync = { ...sync0 };
  const lands = landSteps(part, cues).sort((a, b) => a.t - b.t);
  let report = [];
  for (let pass = 0; pass < 5; pass++) {
    report = [];
    for (const L of lands) report.push(solveLand(world, part, sync, L));
    // co-dependent presses (the finale: every hero lands on the same beat, the boss dies on it) settle over a few passes
    const r = playOut(world, part, sync, part.t1);
    const ok = lands.every((L) => { const g = r.lands[L.key], pr = r.presses.find((q) => `${part.i}:${q.hi}:${q.si}` === L.key); return g && (Math.abs(g.err) <= DT * 0.75 || (pr && pr.blocked)); });
    report = lands.map((L) => { const g = r.lands[L.key], pr = r.presses.find((q) => `${part.i}:${q.hi}:${q.si}` === L.key); return { key: L.key, k: L.k, t: L.t, err: g ? g.err : null, blocked: !!(pr && pr.blocked) }; });
    if (ok) break;
  }
  return { sync, report };
}
function solveLand(world, part, sync, L) {
  {
    let P = sync[L.key] ?? L.t - 0.4, best = null;
    if (L.k === 'T' || L.k === 'SP') P = sync[L.key] ?? L.t - 0.5;
    for (let it = 0; it < 14; it++) {
      sync[L.key] = P;
      const r = playOut(world, part, sync, L.t + 3);
      const pr = r.presses.find((q) => `${part.i}:${q.hi}:${q.si}` === L.key);
      const got = r.lands[L.key];
      if (!pr || !got) { best = { key: L.key, k: L.k, t: L.t, err: null, late: pr ? +(pr.t - P).toFixed(3) : null, miss: true }; if (pr && pr.t - P < DT * 1.5) { P -= 0.6; continue; } break; }
      best = { key: L.key, k: L.k, t: L.t, err: got.err, blocked: pr.blocked };
      if (Math.abs(got.err) <= DT * 0.5) break;
      if (pr.blocked && got.err > 0) break; // the hero was still busy: can't press earlier
      P = Math.max(part.t0, P - got.err * (it < 6 ? 1 : 0.5));
    }
    sync[L.key] = +P.toFixed(4);
    return best;
  }
}
