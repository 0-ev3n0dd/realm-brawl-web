// The Shadow Duel (Part B): the last step of an Ascension. A solo arena in the Star Sanctum (Astrael's disc, while no
// Astrael attempt is running there) against a corrupted mirror of your hero. The mirror casts its class's REAL kit
// data - every Q / E / R / F skill and the ultimate in CLASSES[cls] keeps its name, shape (cone arc + radius, line,
// placed circle, self circle), reach and cooldown - as enemy telegraphs in the one telegraph language (sim/telegraph.js
// cues, client/telefx.js): you read the same shapes your own hero draws. Never invulnerable; a hard enrage at DUEL.enrage
// doubles its damage. Win -> the client pays the cost and ascends (sim/ascension.js ascend); lose -> home, nothing lost.
//   state: sim.duel = { pid, cls, bid, st: 'intro' | 'fight' | 'won' | 'lost', t, i (rotation index), ult, enr }
import { CLASSES } from './data/classes.js';
import { ENEMIES } from './data/enemies.js';
import { AST_POS, AST_R, inAstArea } from './astraelconst.js';
import { TOWN_SPAWN } from './townconst.js';
import { addArea, killEnemy } from './combat.js';
import { DT } from './constants.js';
import { rankKey, ascRank, RANK_MAX } from './ascended.js';
import { makePool, TELL_MIN, softEnrageT } from './mechpool.js';
import './astralboss.js'; // (the 'astralshard' enemy type: Part D's Shadow Shards reuse its body)
import { computeStats } from './progression.js';
import { STATIONS } from './village.js';
const ALTAR = (() => { const a = STATIONS.find((x) => x.id === 'altar'); return a ? a.use : TOWN_SPAWN; })(); // (won / lost: you wake at the Altar)

const secs = (s) => Math.round(s * 60);
export const DUEL_CLASSES = Object.keys(CLASSES);
const MELEE = new Set(['warrior', 'bladedancer', 'samurai', 'monk', 'dragoon']);
export const DUEL = {
  intro: secs(12), clashDmg: 0.05, clashHit: 0.14, clashGap: secs(3), fin: 0.08, // (B4: the client starts the fight on the song's pickup bar ('duelGo', ~8.7 s in); 12 s = the cap)
  enrage: secs(240), enrMul: 2, outro: secs(7.5), lostOut: secs(3.4), beats: [0.66, 0.33], // (B3 cinematics: the intro = shatter, fall, the mirror's birth + title card; outro = slow-mo kill, dissolve, the rise; lostOut = it stands over you)
  gap: secs(1.15), tell: 72, ultEvery: secs(22), ultTell: 96,
  hit: 0.13, ultHit: 0.32, // a skill / the ult: share of YOUR max HP before your defence (scales with the hero, fair at any gear)
  // mirror HP per class (tools/balance/duel-len.mjs: 2-3 min for every class at Lv 50 Rift gear, typical play)
  hp: { warrior: 3218000, ranger: 2609000, mage: 1879000, cleric: 1749000, bladedancer: 1462000, samurai: 1541000, monk: 2253000, dragoon: 1782000, summoner: 2706000, bard: 1583000 },
};
// Part D: the rank duels. The duel for rank rk (2..5) is the A1 duel plus:
//   A2+  MIRROR ARTS: every RK.every the mirror casts a mechanic-pool attack instead of a kit skill (sim/mechpool.js at
//        `light`: shuffled, never the same family twice running), each told >= 2 s with a caption (starfall / nova in or
//        out / eclipse front-then-behind; A3+ adds memory: four numbered stars land in order)
//   A4+  SHADOW SPLIT at 50%: Shadow Shards spin out round the arena; kill them before their timer or they burst (a told
//        arena-wide hit: the soft enrage). The mirror keeps taking full damage the whole time (never invulnerable).
//   A5   ECLIPSE OF SELF at 25%: the arts come faster and the arena's rim collapses in told waves.
// Mirror HP per class for A2..A5 (tools/balance/duel-rank.mjs: 2-3 min for every class, fought from the rank below;
// the model targets 145 / 150 / 170 / 175 s, the shards' HP and the mechanic downtime included).
export const RK = {
  hp: { warrior: [2904000, 3019000, 3034000, 3203000], ranger: [1917000, 1999000, 2009000, 2134000], mage: [1379000, 1444000, 1451000, 1540000], cleric: [2084000, 2156000, 2167000, 2277000], bladedancer: [1505000, 1604000, 1612000, 1691000], samurai: [2004000, 2105000, 2115000, 2255000], monk: [2133000, 2207000, 2218000, 2330000], dragoon: [2027000, 2138000, 2149000, 2298000], summoner: [2321000, 2449000, 2462000, 2590000], bard: [1244000, 1319000, 1326000, 1424000] },
  every: secs(8.5), first: secs(4), fast: 0.72,
  pool: { 2: ['starfall', 'nova', 'eclipse'], 3: ['starfall', 'nova', 'eclipse', 'memory'] },
  pct: { starfall: 0.2, nova: 0.32, eclipse: 0.28, memory: 0.18, burst: 0.38, rim: 0.24 },
  split: { at: 0.5, n: 2, hp: 0.03, extra: secs(4) },
  ecl: { at: 0.25, rim: secs(7.5), r0: 430 },
};
/** the mirror's max HP for the duel to rank rk */
export const duelHp = (cls, rk) => (rk >= 2 && RK.hp[cls] ? RK.hp[cls][rk - 2] : DUEL.hp[cls] || 500000);
export const shadowType = (cls) => 'shadow_' + cls;
// one enemy type per class (the type carries the class to every co-op client's snapshot)
for (const c of DUEL_CLASSES) if (!ENEMIES[shadowType(c)]) ENEMIES[shadowType(c)] = { name: `Shadow of the ${CLASSES[c].name}`, zone: 4, hp: DUEL.hp[c] || 500000, dmg: 30, spd: 150, r: 22, xp: 0, def: 30, ai: 'shadow', mass: 6, boss: true, color: '#2a1838', shadowOf: c };
/** the mirror's cast list: real kit entries -> telegraph specs (pure) */
export function kitOf(cls) {
  const C = CLASSES[cls], out = [];
  for (const k of ['Q', 'E', 'R', 'F']) { const s = C.skills && C.skills[k]; if (s) out.push({ key: k, id: s.id, name: s.name, cd: s.cd || 4, st: s.stats || {} }); }
  return out;
}
export function shapeOf(sk, e, t) {
  const s = sk.st, a = Math.atan2(t.y - e.y, t.x - e.x);
  if (s.arc && s.r) return { shape: 'cone', x: e.x, y: e.y, ang: a, arc: Math.min(5.6, s.arc), r: Math.min(260, s.r * 1.15) };
  if (s.len || s.w) return { shape: 'line', x: e.x, y: e.y, ang: a, len: Math.min(560, s.len || 420), w: Math.min(110, Math.max(44, s.w || 60)) };
  if (s.range && s.r) return { shape: 'circle', x: t.x, y: t.y, r: Math.min(200, Math.max(70, s.r)) };
  if (s.r) return { shape: 'circle', x: e.x, y: e.y, r: Math.min(240, Math.max(90, s.r * 1.1)) };
  return { shape: 'line', x: e.x, y: e.y, ang: a, len: 480, w: 56 }; // (a shot / dash skill: its lane)
}
export const duelBusy = (sim) => !!(sim.astrael && sim.astrael.party && sim.astrael.party.some((id) => { const q = sim.players.get(id); return q && !q.dead && inAstArea(q.x, q.y); }));
/** start a duel for p (the client checked the Altar's cost; the sim checks the arena is free and p is alone there) */
export function startDuel(sim, p) {
  if (sim.predicting || !p || p.dead || sim.duel || duelBusy(sim) || !CLASSES[p.cls] || ascRank(p) >= RANK_MAX) return false;
  const C = AST_POS, b = sim.spawnEnemy(shadowType(p.cls), C.x, C.y - 160);
  b.arena = { x: C.x, y: C.y, r: AST_R - 30 }; b.x = b.px = b.homeX = C.x; b.y = b.py = b.homeY = C.y - 160; b.hp = b.maxHp = b.baseMaxHp = DUEL.hp[p.cls] || 500000; b.face = Math.PI / 2; b.dropChance = 0; b.cls = p.cls;
  const rk = Math.min(RANK_MAX, ascRank(p) + 1); // (Part D: the duel for the hero's next rank)
  b.hp = b.maxHp = b.baseMaxHp = duelHp(p.cls, rk); b.rk = rk;
  if (rk > 1) b.name = `${b.name} · A${rk}`;
  sim.duel = { pid: p.id, cls: p.cls, bid: b.id, st: 'intro', t: 0, i: 0, ult: DUEL.ultEvery, enr: 0, cd: 45, rk, pt: RK.first, ph: 1, shards: [], soft: 0, rim: 0,
    pool: rk >= 2 ? makePool(RK.pool[rk >= 3 ? 3 : 2], 'light', (sim.seed | 0) * 13 + rk * 101 + 7) : null };
  p.x = p.px = C.x; p.y = p.py = C.y + 150; p.vx = p.vy = 0; p.hp = p.stats.maxHp; p.iframes = Math.max(p.iframes | 0, 60); p.action = null;
  sim.emit({ type: 'duel', ph: 'start', pid: p.id, cls: p.cls, x: C.x, y: C.y, name: b.name, rk });
  return true;
}
function home(sim, p) {
  if (!p) return;
  if (p.dead) { p.dead = false; p.respawnAt = 0; }
  p.hp = p.stats.maxHp; p.x = p.px = ALTAR.x; p.y = p.py = ALTAR.y; p.vx = p.vy = 0; p.iframes = Math.max(p.iframes | 0, 60); p.action = null; p.canChoose = 0;
}
function clearShards(sim, D) { for (const id of (D && D.shards) || []) { const s = sim.enemyById.get(id); if (s && !s.dead) { s.dead = true; s.hp = 0; } } if (D) D.shards = []; }
function clear(sim) { const D = sim.duel; const b = D && sim.enemyById.get(D.bid); if (b && !b.dead) { b.dead = true; b.hp = 0; } clearShards(sim, D); for (const a of sim.areas) if (b && a.ownerId === b.id) a.dead = true; sim.duel = null; }
export function leaveDuel(sim, p) { const D = sim.duel; if (!D || !p || D.pid !== p.id || D.st === 'won') return false; sim.emit({ type: 'duel', ph: 'lost', pid: p.id, cls: D.cls, why: 'leave', t: Math.round(D.t / 60) }); clear(sim); home(sim, p); return true; }
export function updateDuel(sim) {
  const D = sim.duel; if (!D) return;
  const p = sim.players.get(D.pid), b = sim.enemyById.get(D.bid);
  if (!p) { clear(sim); return; }
  if (D.st === 'lost') { if (--D.out <= 0) { clear(sim); home(sim, p); } return; } // (the shadow stands over you; the client cracks the screen to black)
  if (D.st === 'won') { if (--D.out <= 0) { clear(sim); home(sim, p); } return; }
  if (b && b.dead || !b) { D.st = 'won'; clearShards(sim, D);
    const key = rankKey(D.rk || 1, D.cls); p.unlocks = p.unlocks || {}; for (let k = 1; k <= (D.rk || 1); k++) p.unlocks[rankKey(k, D.cls)] = 1; const hp = p.hp; p.stats = computeStats(p); p.hp = Math.min(p.stats.maxHp, hp); // (rank rk: the client persists the flag + pays the cost)
    sim.emit({ type: 'unlock', pid: p.id, key }); D.out = DUEL.outro; sim.emit({ type: 'duel', ph: 'won', pid: p.id, cls: D.cls, rk: D.rk || 1, t: Math.round(D.t / 60), x: b ? b.x : AST_POS.x, y: b ? b.y : AST_POS.y }); return; }
  if (p.dead) { sim.emit({ type: 'duel', ph: 'lost', pid: p.id, cls: D.cls, rk: D.rk || 1, why: 'death', t: Math.round(D.t / 60), x: b.x, y: b.y }); D.st = 'lost'; D.out = DUEL.lostOut; clearShards(sim, D); for (const a of sim.areas) if (a.ownerId === b.id) a.dead = true; b.x = b.px = p.x; b.y = b.py = p.y - 46; b.face = Math.PI / 2; return; }
  if (!inAstArea(p.x, p.y)) { sim.emit({ type: 'duel', ph: 'lost', pid: p.id, cls: D.cls, why: 'left', t: Math.round(D.t / 60) }); clear(sim); home(sim, p); return; }
  D.t++;
  shadowAI(sim, b, p); // (driven from here: enemy targeting skips zone-0 ground such as the Star Sanctum)
  if (D.st === 'intro' && D.t >= DUEL.intro) { D.st = 'fight'; sim.emit({ type: 'duel', ph: 'fight', pid: p.id }); }
  if (D.st === 'fight' && (D.bt | 0) < DUEL.beats.length && b.hp <= b.maxHp * DUEL.beats[D.bt | 0]) { D.bt = (D.bt | 0) + 1; sim.emit({ type: 'duel', ph: 'beat', n: D.bt, pid: p.id, cls: D.cls, x: b.x, y: b.y }); } // (66% / 33%: a line + the arena cracks; no pause)
  if (D.st === 'fight' && !D.fin && b.hp <= b.maxHp * DUEL.fin) { D.fin = 1; sim.emit({ type: 'duel', ph: 'fin', pid: p.id, cls: D.cls }); } // (B4: the final clash is ready; the mirror stays killable the normal way)
  if (!D.enr && D.t >= DUEL.enrage) { D.enr = 1; sim.emit({ type: 'duel', ph: 'enrage', pid: p.id, x: b.x, y: b.y }); }
  if (D.st === 'fight' && (D.rk | 0) >= 2) rankPhases(sim, D, b, p);
}
// ------------------------------------------------------------------ Part D: the rank duels
const r0 = Math.round;
/** a told mechanic area (>= TELL_MIN): % of YOUR max HP like every duel hit */
function mech(sim, e, t, spec, pct) {
  const mul = (sim.duel && sim.duel.enr ? DUEL.enrMul : 1);
  return addArea(sim, { team: 'enemy', ownerId: e.id, kind: 'duelmech', by: e.name, cue: 'away', ...spec, delay: Math.max(TELL_MIN, spec.delay | 0), dmg: t.stats.maxHp * pct * mul });
}
/** one Mirror Art from the pool */
export function castArt(sim, D, e, t) {
  const c = D.pool.next(), k = c.key, v = c.v, P = RK.pct, a = Math.atan2(t.y - e.y, t.x - e.x);
  if (k === 'starfall') { // circles on you + both sides of you; variant: the same spots again a beat later
    const sp = [[0, 0], [Math.cos(a + 1.57) * 190, Math.sin(a + 1.57) * 190], [Math.cos(a - 1.57) * 190, Math.sin(a - 1.57) * 190]];
    for (const [dx, dy] of sp) mech(sim, e, t, { shape: 'circle', x: r0(t.x + dx), y: r0(t.y + dy), r: 115, delay: 130, tell: 'STARFALL' }, P.starfall);
    if (v) for (const [dx, dy] of sp) mech(sim, e, t, { shape: 'circle', x: r0(t.x + dx), y: r0(t.y + dy), r: 115, t: -130, delay: TELL_MIN, tell: 'AGAIN' }, P.starfall); // (the second wave shows as the first lands: t < 0 = not drawn yet)
  } else if (k === 'nova') {
    if (v) mech(sim, e, t, { shape: 'donut', x: r0(e.x), y: r0(e.y), r0: 190, r: AST_R + 200, delay: 140, tell: 'GET IN', cue: 'close' }, P.nova);
    else mech(sim, e, t, { shape: 'circle', x: r0(e.x), y: r0(e.y), r: 300, delay: 140, tell: 'GET OUT' }, P.nova);
  } else if (k === 'eclipse') { // a half-moon in front, then behind (variant: behind first)
    const f = v ? a + Math.PI : a;
    mech(sim, e, t, { shape: 'cone', x: r0(e.x), y: r0(e.y), ang: f, arc: Math.PI, r: 560, delay: 130, tell: v ? 'BEHIND FIRST' : 'FRONT' }, P.eclipse);
    mech(sim, e, t, { shape: 'cone', x: r0(e.x), y: r0(e.y), ang: f + Math.PI, arc: Math.PI, r: 560, delay: 195, tell: 'THEN' }, P.eclipse);
  } else if (k === 'memory') { // four numbered stars round you, landing in order
    const a0 = D.pool.rnd() * Math.PI * 2;
    for (let i = 0; i < 4; i++) { const q = a0 + i * (Math.PI / 2) * (v ? -1 : 1); mech(sim, e, t, { shape: 'circle', x: r0(t.x + Math.cos(q) * 170), y: r0(t.y + Math.sin(q) * 170), r: 125, t: -i * 24, delay: TELL_MIN + 10 + i * 20, tell: String(i + 1) }, P.memory); } // (shown one by one, then they land in that order)
  }
  sim.emit({ type: 'duel', ph: 'art', pid: D.pid, k, v, rk: D.rk, x: r0(e.x), y: r0(e.y) });
  return k;
}
const liveShards = (sim, D) => D.shards.map((id) => sim.enemyById.get(id)).filter((s) => s && !s.dead);
function rankPhases(sim, D, b, p) {
  // A4+: SHADOW SPLIT (once, at 50%)
  if (D.rk >= 4 && D.ph < 2 && b.hp <= b.maxHp * RK.split.at) {
    D.ph = 2; D.shards = [];
    for (let i = 0; i < RK.split.n; i++) {
      const a = (i / RK.split.n) * Math.PI * 2 + Math.PI / 4, s = sim.spawnEnemy('astralshard', AST_POS.x + Math.cos(a) * 330, AST_POS.y + Math.sin(a) * 330);
      if (!s) continue; s.maxHp = s.hp = s.baseMaxHp = Math.max(1, r0(b.maxHp * RK.split.hp)); s.name = 'Shadow Shard'; s.duelOf = b.id; s.xp = 0; s.dropChance = 0; s.shadow = 1; D.shards.push(s.id);
    }
    D.soft = softEnrageT(1) + RK.split.extra;
    sim.emit({ type: 'duel', ph: 'split', pid: D.pid, n: D.shards.length, t: D.soft, x: r0(b.x), y: r0(b.y) });
  }
  if (D.shards.length) {
    const live = liveShards(sim, D);
    if (!live.length) { D.shards = []; sim.emit({ type: 'duel', ph: 'shatter', pid: D.pid, x: r0(b.x), y: r0(b.y) }); }
    else if (--D.soft <= 0) { // soft enrage: the live shards burst (told 2 s, the whole arena)
      for (const s of live) { mech(sim, b, p, { shape: 'circle', x: r0(AST_POS.x), y: r0(AST_POS.y), r: AST_R + 300, delay: TELL_MIN, tell: 'SHARD BURST' }, RK.pct.burst); s.dead = true; s.hp = 0; }
      D.shards = []; sim.emit({ type: 'duel', ph: 'burst', pid: D.pid, n: live.length, x: r0(b.x), y: r0(b.y) });
    }
  }
  // A5: ECLIPSE OF SELF (at 25%): faster arts + the rim collapses
  if (D.rk >= 5 && D.ph < 3 && b.hp <= b.maxHp * RK.ecl.at) { D.ph = 3; D.rim = secs(2); sim.emit({ type: 'duel', ph: 'eclipse', pid: D.pid, x: r0(b.x), y: r0(b.y) }); }
  if (D.ph >= 3 && --D.rim <= 0) { D.rim = RK.ecl.rim; mech(sim, b, p, { shape: 'donut', x: r0(AST_POS.x), y: r0(AST_POS.y), r0: RK.ecl.r0, r: AST_R + 300, delay: 150, tell: 'THE RIM FALLS', cue: 'close' }, RK.pct.rim); }
}
/** the mirror's brain (ai.js calls it as the 'shadow' behaviour) */
export function shadowAI(sim, e, t) {
  const D = sim.duel; if (!D || D.bid !== e.id || !t) return;
  e.homeX = e.x; e.homeY = e.y; e.aggroId = t.id; // (never 'walks home' / regenerates)
  if (D.st !== 'fight' || t.dead) return;
  const d = Math.hypot(t.x - e.x, t.y - e.y), a = Math.atan2(t.y - e.y, t.x - e.x), want = MELEE.has(D.cls) ? 130 : 300;
  e.face = a;
  if (e.state !== 'cast') { // keep its class's range, strafing
    const m = d > want + 40 ? 1 : d < want - 60 ? -0.8 : 0, sp = e.spd * DT * (e.cc.slow > 0 ? e.cc.slowMul : 1);
    e.x += (Math.cos(a) * m + Math.cos(a + Math.PI / 2) * 0.35 * Math.sin(D.t / 70)) * sp; e.y += (Math.sin(a) * m + Math.sin(a + Math.PI / 2) * 0.35 * Math.sin(D.t / 70)) * sp;
  }
  const mul = (D.enr ? DUEL.enrMul : 1);
  if (--D.ult <= 0) { // the ultimate: the class's own ult, as a wide ring around the mirror + a mark on you
    D.ult = DUEL.ultEvery; const U = CLASSES[D.cls].ult || {}; e.state = 'cast'; e.st = 0;
    addArea(sim, { team: 'enemy', ownerId: e.id, kind: 'shadowult', by: e.name, cue: 'away', shape: 'donut', x: e.x, y: e.y, r0: 110, r: 420, delay: DUEL.ultTell, dmg: t.stats.maxHp * DUEL.ultHit * mul, tell: U.name || 'ULTIMATE' });
    addArea(sim, { team: 'enemy', ownerId: e.id, kind: 'shadowult', by: e.name, cue: 'away', shape: 'circle', x: t.x, y: t.y, r: 120, delay: DUEL.ultTell + 30, dmg: t.stats.maxHp * DUEL.ultHit * 0.6 * mul });
    sim.emit({ type: 'duel', ph: 'ult', pid: D.pid, name: U.name || 'Ultimate', x: e.x, y: e.y });
    D.cd = DUEL.ultTell + 40; return;
  }
  if (e.state === 'cast' && ++e.st > 40) { e.state = 'idle'; e.st = 0; }
  if (D.pool) D.pt--;
  if (--D.cd > 0) return;
  if (D.pool && D.pt <= 0) { D.pt = r0(RK.every * (D.ph >= 3 ? RK.fast : 1)); castArt(sim, D, e, t); e.state = 'cast'; e.st = 0; D.cd = DUEL.gap + 60; return; } // (Part D: a Mirror Art instead of a kit skill)
  const K = kitOf(D.cls); if (!K.length) return;
  const sk = K[D.i++ % K.length], sh = shapeOf(sk, e, t);
  addArea(sim, { team: 'enemy', ownerId: e.id, kind: 'shadowskill', by: e.name, cue: 'away', ...sh, delay: DUEL.tell, dmg: t.stats.maxHp * DUEL.hit * mul, tell: sk.name });
  e.state = 'cast'; e.st = 0;
  D.cd = DUEL.gap + Math.round(Math.min(3, sk.cd) * 12);
}
/** B3: the player skipped a cinematic they have seen: the intro jumps to the fight, an outro (won / lost) ends now. Never touches HP. */
export function duelSkip(sim, p) {
  const D = sim.duel; if (!D || !p || D.pid !== p.id) return false;
  if (D.st === 'intro') { D.t = Math.max(D.t, DUEL.intro - 1); D.cd = Math.min(D.cd, 45); return true; }
  if (D.st === 'won' || D.st === 'lost') { D.out = Math.min(D.out, 1); return true; }
  return false;
}
/** B4: a beat-timed clash QTE resolved by the client. ok: the mirror takes DUEL.clashDmg of its max HP and staggers (the final
 *  clash, once the mirror is under DUEL.fin, is the killing blow); a miss: you take DUEL.clashHit of your max HP, never below 1.
 *  Neither side is ever invulnerable; rate-limited (DUEL.clashGap) so a client cannot spam it. */
export function duelClash(sim, p, ok, fin) {
  const D = sim.duel; if (!D || !p || D.pid !== p.id || D.st !== 'fight' || p.dead) return false;
  if (D.clT != null && D.t - D.clT < DUEL.clashGap) return false;
  const b = sim.enemyById.get(D.bid); if (!b || b.dead) return false;
  D.clT = D.t; D.clN = (D.clN | 0) + 1;
  if (ok === true) {
    if (fin && D.fin) killEnemy(sim, b, p);
    else { b.hp -= b.maxHp * DUEL.clashDmg; if (b.hp <= 0) { b.hp = 0; killEnemy(sim, b, p); } }
    D.cd = Math.max(D.cd, secs(1.6)); // (staggered: its next cast comes late)
  } else p.hp = Math.max(1, p.hp - p.stats.maxHp * DUEL.clashHit);
  sim.emit({ type: 'duel', ph: 'clash', pid: p.id, ok: ok === true, fin: !!fin, x: b.x, y: b.y });
  return true;
}
