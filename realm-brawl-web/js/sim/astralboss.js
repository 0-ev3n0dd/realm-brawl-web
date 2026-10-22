// Part C2 — Astral boss mechanics. Every boss in the Astral World (world bosses, dungeon bosses, Trials / Extremes,
// mission bosses, Vorthax) keeps its own fight and gains an ASTRAL layer on top, Savage-style: hard but fair.
//   * a pool of Astral mechanic families drawn through sim/mechpool.js at `light` randomness (the order shuffles each
//     cycle, never the same family twice in a row; variants are fixed per cast parity, every one telegraphed):
//       starfall (circles under every hero; variant: a second wave on the same spots) · nova (OUT: a circle on the
//       boss / IN: everything but a ring around it) · marks (spread on everyone / one shared stack) · towers (one per
//       hero, each needs a soaker, an empty tower hurts everyone) · combo (front, then behind)
//   * every telegraph tells >= mechpool TELL_MIN (2 s) with a caption; damage is % of max HP (fair at any gear)
//   * the ASTRAL SURGE at <= 35% HP: must-kill Astral Shards around the boss (a soft enrage: shards left alive when
//     their timer ends burst for party damage, then a new wave forms). Nothing ever becomes invulnerable: the boss
//     keeps taking full damage the whole time; shards only make its Astral casts hit harder while they live.
// Sim-side only (deterministic: mechpool's seeded rng, no sim.rng draws); the client draws sim.ab (local) or the
// packed copy (net: server/room.js msg.ab -> sim.abV) with client/astralbossfx.js.
import { lockedSeed } from './practice.js';
import { makePool, withTell, towers as mkTowers, marks as mkMarks, combo as mkCombo, softEnrageT, TELL_MIN } from './mechpool.js';
import { hits, posTele } from './telegraph.js';
import { damagePlayer } from './combat.js';
import { ENEMIES } from './data/enemies.js';

export const AB = {
  pool: ['starfall', 'nova', 'marks', 'towers', 'combo'],
  open: 360,            // ticks after the pull before the first Astral cast
  gap: 540,             // between Astral casts (9 s; the boss's own fight runs in between)
  surgeGap: 0.8,        // casts come faster during the surge
  range: 1300,          // heroes this close count as in the fight
  pull: 700,            // a hero this close pulls it
  pct: { starfall: 0.28, nova: 0.45, spread: 0.26, stack: 0.7, tower: 0.4, soak: 0.08, combo: 0.4, burst: 0.32 },
  surge: { at: 0.35, hp: 0.015, n: 2, perHero: 1, orbit: 300, extra: 360, again: 1200, mul: 0.12 }, // shard HP = share of boss max HP; +12% Astral damage per live shard
  cap: 8,               // most live Astral telegraphs per boss (big parties: extras merge)
};
const r0 = Math.round;
const TAU = Math.PI * 2;
/** the shard: the Aegis Star's body (client draws it like Astrael's adds), but its own type so encounters never count it */
if (!ENEMIES.astralshard) ENEMIES.astralshard = { name: 'Astral Shard', zone: 4, hp: 9000, dmg: 0, spd: 0, r: 30, xp: 0, def: 30, ai: 'raid', mass: 99, boss: false, raid: true, color: '#c9b6ff' };

export const abOk = (e, d) => !!(e && (e.boss || (d && d.raid && e.type === 'raidboss')) && e.type !== 'astralshard');
/** called by ai.js spawnEnemy for an Astral boss */
export function abInit(sim, e) {
  if (!sim.ab) sim.ab = { list: [], tele: [], tid: 1 };
  e.ab = { pool: makePool(AB.pool, 'light', lockedSeed(sim, 3) ?? (sim.seed | 0) * 31 + e.id * 7 + 3), /* (Part E: a locked practice variation) */ next: AB.open, on: 0, surge: 0, shards: [], soft: 0, wave: 0, casts: 0, waveAt: 0 };
  sim.ab.list.push(e.id);
}
const fighters = (sim, b) => { const out = []; for (const p of sim.players.values()) if (!p.dead && !p.ghost && Math.hypot(p.x - b.x, p.y - b.y) < AB.range) out.push(p); return out; };
function tele(sim, b, spec) {
  const A = sim.ab, t = withTell({ id: A.tid++, t: 0, bid: b.id, ...spec });
  if (t.d < TELL_MIN) t.d = TELL_MIN;
  A.tele.push(t); return t;
}
const liveShards = (sim, b) => b.ab.shards.map((id) => sim.enemyById.get(id)).filter((s) => s && !s.dead);
const surgeMul = (sim, b) => 1 + AB.surge.mul * (b.ab.surge ? liveShards(sim, b).length : 0);

/** one Astral cast (the pool's next family) */
function cast(sim, b, ps) {
  const S = b.ab, c = S.pool.next(), fam = c.key, v = c.v, rnd = S.pool.rnd, near = ps[0];
  S.casts++;
  sim.emit({ type: 'astralb', ph: 'cast', k: fam, v, id: b.id, x: r0(b.x), y: r0(b.y) });
  if (fam === 'starfall') {
    for (const p of ps) tele(sim, b, { k: 'starfall', sh: 'circle', x: r0(p.x), y: r0(p.y), r: 120, d: 130, pct: AB.pct.starfall, tell: 'STARFALL', what: 'Starfall' });
    if (v) for (const p of ps) tele(sim, b, { k: 'starfall', sh: 'circle', x: r0(p.x), y: r0(p.y), r: 120, d: 200, pct: AB.pct.starfall, tell: 'AGAIN', what: 'Starfall' }); // (variant: the same spots twice: move away, stay away)
  } else if (fam === 'nova') {
    if (v) tele(sim, b, { k: 'nova', sh: 'ring', x: r0(b.x), y: r0(b.y), r0: 230, r: 1400, d: 150, pct: AB.pct.nova, tell: 'GET IN', what: 'Astral Nova', cue: 'close' });
    else tele(sim, b, { k: 'nova', sh: 'circle', x: r0(b.x), y: r0(b.y), r: 320, d: 150, pct: AB.pct.nova, tell: 'GET OUT', what: 'Astral Nova' });
  } else if (fam === 'marks') {
    const st = !!v && ps.length > 1;
    for (const t of mkMarks(ps, rnd, st, 160)) tele(sim, b, { ...t, pct: st ? AB.pct.stack : AB.pct.spread, what: st ? 'Constellation Stack' : 'Constellation Mark' });
  } else if (fam === 'towers') {
    for (const t of mkTowers({ x: b.x, y: b.y, r: 520 }, ps.length, rnd, 170)) tele(sim, b, { ...t, pct: AB.pct.tower, what: 'Star Tower' });
  } else if (fam === 'combo') {
    const a = Math.atan2(near.y - b.y, near.x - b.x);
    for (const t of mkCombo({ x: r0(b.x), y: r0(b.y) }, a, !!v, 130, 70)) tele(sim, b, { ...t, pct: AB.pct.combo, what: 'Twin Eclipse' });
  }
}
function hurt(sim, b, p, pct, what) { return damagePlayer(sim, p, 0, b, { pct: pct * surgeMul(sim, b), raw: false, by: `${b.name.split(',')[0]}'s ${what}` }); }
function land(sim, b, t, ps, inFight = ps) {
  const out = (k) => sim.emit({ type: 'astralb', ph: 'boom', k: t.k, sh: t.sh, x: t.x, y: t.y, r: t.r, ok: k ? 1 : 0 });
  if (t.sh === 'tower') {
    const inside = ps.filter((p) => hits({ ...t, sh: 'circle' }, p));
    if (!inside.length) { for (const p of inFight) hurt(sim, b, p, t.pct, t.what); out(false); }
    else { for (const p of inside) hurt(sim, b, p, AB.pct.soak, t.what); out(true); }
    return;
  }
  if (t.sh === 'stack') {
    const inside = ps.filter((p) => hits({ ...t, sh: 'circle' }, p)), k = Math.max(1, inside.length);
    for (const p of inside) hurt(sim, b, p, t.pct / k, t.what); out(k >= Math.min(inFight.length, 2));
    return;
  }
  if (t.sh === 'spread') {
    let n = 0; for (const p of ps) if (hits({ ...t, sh: 'circle' }, p)) { hurt(sim, b, p, t.pct, t.what); n++; }
    out(n <= 1); return;
  }
  let n = 0; for (const p of ps) if (hits(t, p)) { hurt(sim, b, p, t.pct, t.what); n++; }
  out(n === 0);
}
function surgeWave(sim, b, ps, spawn) {
  const S = b.ab, n = AB.surge.n + AB.surge.perHero * Math.max(0, ps.length - 1), a0 = S.pool.rnd() * TAU;
  S.shards = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU, s = spawn(sim, 'astralshard', b.x + Math.cos(a) * AB.surge.orbit, b.y + Math.sin(a) * AB.surge.orbit, { zoneHp: false });
    if (!s) continue;
    s.maxHp = s.hp = s.baseMaxHp = Math.max(1, r0(b.maxHp * AB.surge.hp)); s.name = 'Astral Shard'; s.abOf = b.id; s.astral = 1; s.xp = 0; s.dropChance = 0;
    S.shards.push(s.id);
  }
  S.wave++; S.soft = softEnrageT(ps.length) + AB.surge.extra; // (solo 24 s, +2 s a hero: the weakest class clears a wave well inside it)
  sim.emit({ type: 'astralb', ph: 'surge', id: b.id, wave: S.wave, n: S.shards.length, t: S.soft, x: r0(b.x), y: r0(b.y) });
}
/** per tick (sim.js), Astral World only */
export function updateAstralBosses(sim, spawn) {
  const A = sim.ab; if (!A || !A.list.length) return;
  if (!sim.astral) { A.list.length = 0; A.tele.length = 0; return; }
  const keep = [];
  for (const id of A.list) {
    const b = sim.enemyById.get(id);
    if (!b || b.dead) { // the fight is over: its shards + casts go with it
      for (const t of A.tele) if (t.bid === id) t.done = 1;
      if (b && b.ab) for (const s of liveShards(sim, b)) { s.dead = true; s.hp = 0; }
      continue;
    }
    keep.push(id);
    const S = b.ab, ps = fighters(sim, b);
    if (!ps.length) { if (S.on) { S.on = 0; S.next = AB.open; } continue; } // (everyone left / died: it resets its Astral layer)
    if (!S.on) { if (b.hp >= b.maxHp * 0.999 && !b.aggroId && !ps.some((q) => Math.hypot(q.x - b.x, q.y - b.y) < AB.pull)) continue; // (pulled: hurt, aggroed or a hero walks up)
      S.on = 1; sim.emit({ type: 'astralb', ph: 'pull', id: b.id, x: r0(b.x), y: r0(b.y) }); }
    if (b.invuln > 0 || b.hidden || b.gone) continue; // (the encounter's own transitions: the Astral layer waits, never adds immunity)
    // the surge
    if (!S.surge && b.hp <= b.maxHp * AB.surge.at) { S.surge = 1; surgeWave(sim, b, ps, spawn); }
    if (S.surge) {
      const live = liveShards(sim, b);
      if (live.length) {
        if (--S.soft <= 0) { // soft enrage: the live shards burst (telegraphed: a 2 s party-wide flare), then they're spent
          for (const s of live) { tele(sim, b, { k: 'burst', sh: 'circle', x: r0(s.x), y: r0(s.y), r: 1600, d: TELL_MIN, pct: AB.pct.burst, tell: 'SHARD BURST', what: 'Shard Burst' }); s.dead = true; s.hp = 0; }
          S.shards = []; S.waveAt = AB.surge.again; sim.emit({ type: 'astralb', ph: 'burst', id: b.id, n: live.length, x: r0(b.x), y: r0(b.y) });
        }
      } else if (S.shards.length) { S.shards = []; S.waveAt = AB.surge.again; sim.emit({ type: 'astralb', ph: 'clear', id: b.id, x: r0(b.x), y: r0(b.y) }); }
      else if (S.waveAt > 0 && --S.waveAt <= 0) surgeWave(sim, b, ps, spawn);
    }
    if (--S.next <= 0) {
      S.next = r0(AB.gap * (S.surge ? AB.surgeGap : 1));
      if (A.tele.filter((t) => t.bid === id && !t.done).length < AB.cap) cast(sim, b, ps);
    }
  }
  A.list = keep;
  for (const t of A.tele) {
    if (t.done) { t.t++; continue; }
    if (t.sh === 'spread' || t.sh === 'stack') { const q = sim.players.get(t.pid); if (q && !q.dead) { t.x = r0(q.x); t.y = r0(q.y); } } // (marks ride their hero)
    if (++t.t >= t.d) { t.done = 1; const b = sim.enemyById.get(t.bid); if (b && !b.dead) { sim.posCheck = posTele(t) ? 1 : 0; land(sim, b, t, [...sim.players.values()].filter((q) => !q.dead && !q.ghost), fighters(sim, b)); sim.posCheck = 0; } } // (shapes: anyone standing in them; an empty tower: the heroes in the fight)
  }
  if (A.tele.length) A.tele = A.tele.filter((t) => !t.done || t.t < t.d + 24);
}
/** what clients draw (and the net packet: server/room.js) */
export function packAstralBoss(sim) {
  const A = sim.ab; if (!A || !A.tele.length) return null;
  return A.tele.map((t) => ({ id: t.id, k: t.k, sh: t.sh, x: t.x, y: t.y, r: t.r, r0: t.r0, ang: t.ang, arc: t.arc, d: t.d, t: t.t, done: t.done ? 1 : 0, tell: t.tell, cue: t.cue, n: t.n, pid: t.pid }));
}
/** the boss bar's surge line (client HUD): { surge, shards, t } for the boss id */
export function abState(sim, b) { const S = b && b.ab; if (!S) return null; return { surge: S.surge, shards: S.surge ? liveShards(sim, b).length : 0, soft: S.soft }; }
