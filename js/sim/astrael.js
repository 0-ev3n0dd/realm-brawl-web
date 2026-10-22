// Astrael: the trial in The Star Sanctum (a night-sky arena east of the world), plus Astrael (Extreme).
// A scripted timeline in 3 acts (+ a platform transition and the Big Bang), FFXIV Extreme / Savage style, with
// HP-GATED phases: when her HP crosses an act's threshold the mechanics already on the field finish resolving (no
// cancel mid-telegraph), no new ones start, and she moves straight on (Collapse of Heaven -> Act II -> Act III -> the Big
// Bang at 10%). Groups that deal less damage still see the whole act: the timeline is the fallback / enrage pacing.
// Every mechanic opens with a name card and a visual cue that hints at the answer. Outside the hub a wipe is a full
// reset; in the hub (sim/hub.js) a wipe or a clear sends the party back to Brightwater Village.
//   Act 1 Starfall     : Constellations (sword = line cleave, shield = knockback, crown = stack), Twin Suns, Comet Drop
//   Collapse of Heaven : the floor shatters into 4 platforms; kill the 2 orbiting Aegis Stars in 45 s or the platforms fall
//   Act 2 Orrery       : Planets (memorize the order), Astral Mirror (only the real one's attack lands), Fated Threads
//   Act 3 Supernova    : delayed debuffs (Nova / Gravity / Still / Move), Zodiac Wheel, then the Big Bang DPS check
// Mechanics change SHAPE by player count (1 = self-soak circles, pylons, fewer debuffs; 2 = pair mechanics;
// 3-4 = role assignments, split soaks, a baiter). Pure sim code, runs only on the authoritative sim (never predicted);
// the whole encounter lives in `sim.astrael` as plain data (packed for co-op clients, drawn by client/astraelfx.js).
import { posTele } from './telegraph.js';
import { secs, RAID_POS, RAID_R, SPAWN_POS } from './constants.js';
import { AST_POS, AST_R, inAstArea, PLAT, platCenter, platAt, onPlatforms, clampToPlatforms } from './astraelconst.js';
import { damagePlayer, spawnProjectile, healPlayer, respawnPlayer, killPlayer, evadeShove } from './combat.js';
import { spawnEnemy } from './ai.js';
import { ENEMIES } from './data/enemies.js';
import { encHpA } from './astral.js';
import { inCone, inLine } from './math.js';

export { AST_POS, AST_R, inAstArea };
if (!ENEMIES.astrael) Object.assign(ENEMIES, {
  astrael: { name: 'Astrael', zone: 4, hp: 100000, dmg: 40, spd: 0, r: 72, xp: 16000, def: 40, ai: 'raid', mass: 99, boss: true, raid: true, color: '#9fb8ff' },
  astralstar: { name: 'Aegis Star', zone: 4, hp: 9000, dmg: 30, spd: 0, r: 34, xp: 0, def: 30, ai: 'raid', mass: 99, boss: false, raid: true, color: '#ffe9a8' },
});

const C = AST_POS, TAU = Math.PI * 2;
/** Tuning. Damage values are % of the player's max HP and ignore defence (unavoidable = the mechanic's answer matters). */
export const AST = {
  name: 'Astrael', nameX: 'Astrael (Extreme)', short: 'ASTRAEL', arena: 'The Star Sanctum',
  pull: secs(6), repull: secs(8),
  hp: { base: 1810000, /* (Oct 15 boss pass: +15%, typical 5.2 -> ~6 min) */ /* (game loop B: no invulnerability; +2.2% HP keeps the length) */ mult: [1, 2, 2.95, 3.9, 4.7, 5.5] }, // (DPS-UP pass: 950k -> 1.54M, the class-average DPS rose x1.69; typical ~5.4 min) // (encounter pass: 250k -> 850k, ~5-6 min for a typical player; party HP ~= players x solo) // boss HP = base × mult[players at the pull − 1] (5-6 players use the 4-player mechanics); strong groups break the acts early (~5-7 min), the full script is ~10 min
  floors: { a1: 0.7, a2: 0.36, a3: 0.1 },  // the act GATES: reaching one ends the act after the current mechanics resolve (she can't be pushed lower meanwhile); the last 10% is the Big Bang
  add: { hp: 5200, per: 0.9, orbit: PLAT.D, hop: secs(10), glide: secs(1.5), check: secs(45), every: 150, pct: 0.05 },
  bigbang: { dur: secs(30), vuln: 3 }, // (DPS-UP pass: 20 -> 30 s, the 10% at x3 still fits the weakest class)
  cine: { collapse: secs(5), orrery: secs(3), ignite: secs(4), bbcine: secs(3), fall: secs(3), whiteout: secs(2.5), kill: secs(6) },
  enrage: secs(810), /* (DPS-UP pass: 600 -> 810 and the act timeline 626 -> 860 s: a solo Bard (weakest, unbuffed) clears in ~12.4 min with ~65 s margin) */ /* (no-immunity pass: 540 -> 600: the weakest class has ~100 s of margin) */ // (encounter pass: a hard enrage - the heavens reset - on top of the act timeline: tight but beatable for the weakest class)
  wipe: secs(7), mend: { solo: 0.1, party: 0.06 }, revive: 0.5, fall: 0.5,
  sword: { w: 200, pct: 0.5 }, kb: { a1: 300, a2: 200 }, crown: { r: 110, total: 0.9, over: 0.85, soloIn: 0.1, soloOut: 0.55 },
  suns: { r: 235, rPlat: 165, dist: 270, pct: 0.6 }, comet: { r: 80, pct: 0.25, solo: 0.12, min: 0.1, unsoaked: 0.45 },
  spread: { r: 130, pct: 0.5, self: 0.08, echo: 0.4, echoR: 110 }, mirror: { pct: 0.7 },
  thread: { lo: 240, hi: 360, pct: 0.55 }, nova: { r: 170, pct: 0.55, self: 0.08, field: { r: 110, dur: secs(8), pct: 0.1, every: 30 } },
  still: { win: 30, pct: 0.55 }, zodiac: { half: Math.PI / 4, rin: 60, pct: 0.6, lance: { arc: 0.9, len: 640, pct: 0.4 } },
  bolt: { every: 300, pct: 0.12, r: 85, d: 90 },
};
/** Astrael (Extreme): unlocked by clearing Astrael. More HP, faster telegraphs (its own script with shorter reads, faster
 *  Planets / Zodiac / debuff timers), overlapping mechanics and remixed combos, a shorter timeline and a tighter Big Bang. */
// (DPS-UP pass: enrage 525 -> 630, hpMul 1.22 -> 1.075 on the higher base (1.66M), Big Bang 15 -> 22 s, act timeline 570 -> 659 s)
export const AST_X = { enrage: secs(630), hpMul: 1.058, bigbang: secs(22), addCheck: secs(40), addHp: 1.2, bolt: 240, boltD: 75, debuffK: 0.85 };
/** Nominal segment lengths (seconds): the wipe screen / HUD timeline show progress through the fight with these. */
export const ACT_END = { a1: 250, a2: 295, a3: 225 }; // (DPS-UP pass: 180/210/156 -> 250/295/225 s; past the last scripted mechanic only Falling Stars fall until the act ends)
export const SEGS = [['a1', ACT_END.a1, 'Act I · Starfall'], ['collapse', 5, 'Collapse of Heaven'], ['adds', 45, 'Collapse of Heaven'], ['orrery', 3, 'Collapse of Heaven'],
  ['a2', ACT_END.a2, 'Act II · Orrery'], ['ignite', 4, 'Act III · Supernova'], ['a3', ACT_END.a3, 'Act III · Supernova'], ['bbcine', 3, 'The Big Bang'], ['bigbang', AST.bigbang.dur / 60, 'The Big Bang']];
export const ACT_END_X = { a1: 190, a2: 220, a3: 172 };
export const SEGS_X = SEGS.map(([k, d, l]) => [k, k === 'a1' || k === 'a2' || k === 'a3' ? ACT_END_X[k] : k === 'adds' ? 40 : k === 'bigbang' ? AST_X.bigbang / 60 : d, l]);
// Part C2: in the Astral World the acts run 25% longer (Astral HP: the weakest class must still finish each act in time)
export const AST_ASTRAL = 1.25, AST_BB = 2; // (the Big Bang burn window: x2 at Astral HP)
const stretch = (S) => S.map(([k, d, l]) => [k, k === 'a1' || k === 'a2' || k === 'a3' ? Math.round(d * AST_ASTRAL) : k === 'bigbang' ? Math.round(d * AST_BB) : d, l]);
const SEGS_A = stretch(SEGS), SEGS_XA = stretch(SEGS_X), stretchEnd = (E) => Object.fromEntries(Object.entries(E).map(([k, v]) => [k, Math.round(v * AST_ASTRAL)]));
const ACT_END_A = stretchEnd(ACT_END), ACT_END_XA = stretchEnd(ACT_END_X);
export const segsOf = (A) => (A && A.x ? (A.as ? SEGS_XA : SEGS_X) : (A && A.as ? SEGS_A : SEGS));
/** The fixed timeline: [seconds into the act, mechanic, options] ('line' = a boss line). */
export const SCRIPT = {
  a1: [
    [1, 'line', 'Little stars... gather close. Let me teach you the shape of heaven.'],
    [5, 'const', { shape: 'sword', read: 5.5, teach: 1 }],
    [19, 'const', { shape: 'shield', read: 5.5, teach: 1 }],
    [33, 'const', { shape: 'crown', read: 5.5, teach: 1 }],
    [47, 'line', 'Warmth and cold. Seek what you are not.'],
    [49, 'suns', { read: 9, teach: 1 }],
    [66, 'comets', { read: 8, teach: 1 }],
    [82, 'line', 'Now, two lessons at once.'],
    [84, 'const', { shape: 'sword', read: 4.5 }], [86, 'comets', { read: 7.5 }],
    [102, 'suns', { read: 9 }], [104, 'const', { shape: 'sword', read: 4.5 }],
    [120, 'const', { shape: 'shield', read: 4.5 }], [122, 'comets', { read: 7 }],
    [138, 'suns', { read: 8 }], [148, 'const', { shape: 'crown', read: 4.5 }],
    [158, 'const', { shape: 'sword', read: 4 }], [160, 'const', { shape: 'shield', read: 5 }],
    [172, 'line', 'Enough lessons. Watch the heavens fall.'],
  ],
  a2: [
    [1, 'line', 'Worlds turn. Remember their order.'],
    [3, 'planets', { teach: 1 }],
    [23, 'line', 'Which of us is real, little star?'],
    [25, 'mirror', { read: 6, teach: 1 }],
    [37, 'threads', { read: 9, teach: 1 }],
    [51, 'planets', {}],
    [69, 'mirror', { read: 5 }],
    [79, 'line', 'Bound by fate. Not too near... not too far.'],
    [80, 'threads', { read: 11 }], [81, 'comets', { read: 6 }],
    [97, 'suns', { read: 8 }], [99, 'mirror', { read: 5, avoid: 1 }],
    [113, 'planets', {}],
    [133, 'threads', { read: 7 }], [134, 'const', { shape: 'sword', read: 4.5 }],
    [147, 'mirror', { read: 4.5 }], [149, 'comets', { read: 6.5 }],
    [162, 'planets', {}],
    [182, 'mirror', { read: 4.5 }], [184, 'const', { shape: 'shield', read: 4.5 }],
    [196, 'line', 'Then burn with me.'],
  ],
  a3: [
    [1, 'line', 'Every star must end. Choose the order of your ending.'],
    [3, 'debuffs', { round: 0, teach: 1 }],
    [23, 'zodiac', { signs: 3, teach: 1 }],
    [41, 'debuffs', { round: 1 }], [43, 'const', { shape: 'sword', read: 4 }],
    [61, 'zodiac', { signs: 4 }],
    [82, 'debuffs', { round: 2 }], [84, 'suns', { read: 8 }],
    [104, 'line', 'The wheel turns one last time.'],
    [106, 'zodiac', { signs: 4, fast: 1 }],
    [126, 'comets', { read: 6 }], [127, 'const', { shape: 'shield', read: 4 }],
    [139, 'const', { shape: 'crown', read: 4 }],
    [148, 'line', 'Then let it all... begin again.'],
  ],
};
/** The Extreme script: shorter reads, overlapping mechanics (Planets during Fated Stars, Zodiac during Fated Stars, Mirror
 *  during Threads) and remixed combos (Sword into Twin Suns, Shield into Comets, Crown + Comets). */
export const SCRIPT_X = {
  a1: [
    [1, 'line', 'You learned the shape of heaven. Now learn its speed.'],
    [4, 'const', { shape: 'sword', read: 4 }], [5, 'suns', { read: 7 }],
    [17, 'const', { shape: 'shield', read: 4 }], [20, 'comets', { read: 6.5 }],
    [29, 'const', { shape: 'crown', read: 4 }],
    [37, 'suns', { read: 7 }], [39, 'const', { shape: 'sword', read: 3.5 }],
    [51, 'comets', { read: 6 }], [52, 'const', { shape: 'shield', read: 4 }],
    [63, 'line', 'Two lessons at once? No. Three.'],
    [65, 'suns', { read: 8.5 }], [66, 'const', { shape: 'sword', read: 3.5 }], [70, 'comets', { read: 6 }],
    [84, 'const', { shape: 'crown', read: 4 }], [86, 'comets', { read: 6.5 }],
    [96, 'const', { shape: 'shield', read: 3.5 }], [98, 'suns', { read: 7 }],
    [110, 'const', { shape: 'sword', read: 3.5 }], [112, 'const', { shape: 'shield', read: 4.5 }],
    [124, 'suns', { read: 7 }], [125, 'const', { shape: 'crown', read: 4 }], [131, 'comets', { read: 6 }],
    [140, 'line', 'Fall, little stars.'],
  ],
  a2: [
    [1, 'line', 'Worlds turn faster when fate is watching.'],
    [3, 'planets', {}], [4, 'debuffs', { round: 0, noGrav: 1 }],
    [19, 'mirror', { read: 5 }], [20, 'threads', { read: 8 }],
    [34, 'planets', {}], [47, 'comets', { read: 5.5 }],
    [52, 'mirror', { read: 4.5 }], [53, 'const', { shape: 'sword', read: 3.5 }],
    [64, 'threads', { read: 8 }], [65, 'suns', { read: 7 }],
    [79, 'planets', {}], [80, 'debuffs', { round: 1, noGrav: 1 }],
    [96, 'mirror', { read: 4, avoid: 1 }], [99, 'comets', { read: 6 }],
    [110, 'threads', { read: 7 }], [111, 'const', { shape: 'shield', read: 4 }],
    [124, 'planets', {}], [126, 'mirror', { read: 4 }],
    [142, 'debuffs', { round: 2, noGrav: 1 }], [144, 'suns', { read: 7 }],
    [160, 'mirror', { read: 4 }], [161, 'const', { shape: 'sword', read: 3.5 }],
    [170, 'line', 'Then burn with me. Faster.'],
  ],
  a3: [
    [1, 'line', 'Every star must end. Yours ends quickly.'],
    [3, 'debuffs', { round: 0 }], [5, 'zodiac', { signs: 3 }],
    [24, 'const', { shape: 'sword', read: 3.5 }], [28, 'comets', { read: 5.5 }],
    [36, 'zodiac', { signs: 4, fast: 1 }], [38, 'debuffs', { round: 1 }],
    [60, 'suns', { read: 7 }], [61, 'const', { shape: 'shield', read: 3.5 }],
    [74, 'zodiac', { signs: 4, fast: 1 }], [88, 'comets', { read: 5.5 }],
    [96, 'debuffs', { round: 2 }], [98, 'const', { shape: 'crown', read: 4 }], [100, 'suns', { read: 7 }],
    [114, 'zodiac', { signs: 5, fast: 1 }], [116, 'const', { shape: 'sword', read: 3.5 }],
    [136, 'line', 'Then let it all... begin again.'],
  ],
};
/** Per-mode tables (normal / Extreme). */
export const modeOf = (A) => (A && A.x ? { script: SCRIPT_X, actEnd: A.as ? ACT_END_XA : ACT_END_X, pl: PLX, zod: ZODX, bb: Math.round(AST_X.bigbang * (A.as ? AST_BB : 1)), check: AST_X.addCheck, addHp: AST_X.addHp, bolt: AST_X.bolt, boltD: AST_X.boltD, debuffK: AST_X.debuffK, hpMul: AST_X.hpMul }
  : { script: SCRIPT, actEnd: A && A.as ? ACT_END_A : ACT_END, pl: PL, zod: ZOD, bb: Math.round(AST.bigbang.dur * (A && A.as ? AST_BB : 1)), check: AST.add.check, addHp: 1, bolt: AST.bolt.every, boltD: AST.bolt.d, debuffK: 1, hpMul: 1 });
export const nameOf = (A) => (A && A.x ? AST.nameX : AST.name);
export const MECH_NAMES = { const: 'Constellation', suns: 'Twin Suns', comets: 'Comet Drop', planets: 'Planets', mirror: 'Astral Mirror', threads: 'Fated Threads', debuffs: 'Fated Stars', zodiac: 'Zodiac Wheel' };
export const SHAPE_NAMES = { sword: 'The Sword', shield: 'The Shield', crown: 'The Crown' };
export const PLANET_NAMES = { kb: 'Mars · knockback', stack: 'Jupiter · stack', spread: 'Saturn · spread' };
export const DEBUFF_NAMES = { nova: 'Nova Burst', gravity: 'Gravity Well', still: 'Pyretic Star', move: 'Wandering Star' };
export const DEBUFF_HINT = { nova: 'explodes: be away from allies', gravity: 'pulls everyone to you', still: 'STAND STILL when it ends', move: 'KEEP MOVING when it ends' };
/** Delayed debuffs per group size bucket (1, 2, 3-4) and round: one list of [kind, seconds] per role. */
export const DEBUFFS = {
  1: [[[['nova', 8], ['still', 13]]], [[['move', 7], ['nova', 12]]], [[['still', 6], ['nova', 10], ['move', 14]]]],
  2: [
    [[['nova', 8], ['still', 14]], [['gravity', 11], ['move', 14]]],
    [[['gravity', 7], ['move', 13]], [['nova', 10], ['still', 13]]],
    [[['nova', 7], ['gravity', 12]], [['nova', 7], ['still', 15]]],
  ],
  4: [
    [[['nova', 8], ['still', 15]], [['nova', 8], ['move', 15]], [['gravity', 12]], [['move', 11], ['nova', 15]]],
    [[['gravity', 8], ['nova', 14]], [['still', 8], ['move', 14]], [['nova', 11]], [['nova', 11], ['still', 16]]],
    [[['move', 6], ['gravity', 13]], [['nova', 9]], [['nova', 9], ['still', 13]], [['gravity', 6], ['move', 12]]],
  ],
};
export const bucketOf = (n) => (n <= 1 ? 1 : n === 2 ? 2 : 4);
export const AST_COL = { danger: '#ff3b5c', safe: '#6dffb0', warm: '#ffb13b', cold: '#6fd3ff', stack: '#ffd84a', spread: '#c07cff', comet: '#ff8a4a', thread: '#9ff7ff', star: '#e8f0ff', mirror: '#b99cff' };

const r0 = (v) => Math.round(v);
const bossOf = (sim) => sim.astrael && sim.enemyById.get(sim.astrael.bid);
export const inAst = (p, pad = 40) => Math.hypot(p.x - C.x, p.y - C.y) < AST_R + pad;
const partyIn = (sim, A) => [...sim.players.values()].filter((p) => A.party.includes(p.id) && inAstArea(p.x, p.y));
const aliveIn = (sim, A) => partyIn(sim, A).filter((p) => !p.dead);
const rnd = (sim) => sim.rng.next();
const FIGHT = new Set(['a1', 'a2', 'a3']);

// ------------------------------------------------------------------ entry / exit
/** Teleport a player into The Star Sanctum (starts the encounter if none is running). */
export function enterAstrael(sim, p, mode = null) {
  if (sim.predicting || !p || p.dead) return false;
  const x = mode === 'x', empty = sim.astrael && !sim.astrael.party.some((id) => { const q = sim.players.get(id); return q && q !== p && inAstArea(q.x, q.y); });
  if (!sim.astrael || (empty && (sim.astrael.st === 'victory' || (mode && !!sim.astrael.x !== x)))) startAstrael(sim, null, { x: mode ? x : false });
  const A = sim.astrael;
  if (!A.party.includes(p.id)) A.party.push(p.id);
  placeStart(p, A.party.indexOf(p.id));
  sim.emit({ type: 'astrael', ph: 'enter', pid: p.id, x: r0(p.x), y: r0(p.y) });
  return true;
}
function placeStart(p, k) { p.x = p.px = C.x + ((k % 5) - 2) * 34; p.y = p.py = C.y + AST_R - 80; p.vx = p.vy = 0; p.iframes = Math.max(p.iframes, 60); p.action = null; }
export function leaveAstrael(sim, p) {
  if (sim.predicting || !p || p.dead || !inAstArea(p.x, p.y)) return false;
  p.x = p.px = SPAWN_POS.x; p.y = p.py = SPAWN_POS.y + 40; p.vx = p.vy = 0; p.iframes = Math.max(p.iframes, 60);
  const A = sim.astrael; if (A) A.party = A.party.filter((id) => id !== p.id);
  sim.emit({ type: 'astrael', ph: 'leave', pid: p.id, x: r0(p.x), y: r0(p.y) });
  return true;
}
function freshState(prev, x = false) {
  return { x: prev ? prev.x : (x ? 1 : 0), gate: 0, hpf: 1, st: 'pull', at: 0, t: 0, act: 1, bid: 0, n: 1, party: prev ? prev.party : [], si: 0, jobs: [], tele: [], marks: [], teth: [], pylons: [], ds: [], stars: [], suns: null, planets: null, mirror: null, wheel: null, fields: [], kbs: [],
    call: null, line: null, cine: null, lb: 0, plats: false, clock: false, adds: [], check: null, bb: null, shield: 0, tid: 1, hits: {}, still: {}, cnt: {},
    wipes: prev ? prev.wipes : 0, best: prev ? prev.best : 0, lastWipe: prev ? prev.lastWipe : null, won: false, empty: 0, bx: C.x, by: C.y, prog: 0, jobNames: [] };
}
function startAstrael(sim, prev = null, o = {}) {
  for (const e of sim.enemies) if ((e.type === 'astrael' || e.type === 'astralstar') && !e.dead) e.dead = true;
  const A = sim.astrael = freshState(prev, !!o.x); if (sim.astral) A.as = 1; // (Part C2: the Astral version)
  A.hub = sim.hub ? 1 : 0; // (hub: a wipe / clear goes home instead of resetting)
  const b = spawnEnemy(sim, 'astrael', C.x, C.y);
  if (A.x) { b.name = AST.nameX; b.ex = 1; } // (ex: Extreme drops, sim/exotic.js)
  b.cd = 1e6; b.raidHold = 1e6; b.face = Math.PI / 2; b.dropChance = 1; b.invuln = 1e6;
  A.bid = b.id; A.pull = prev ? AST.repull : AST.pull;
  card(sim, A, nameOf(A).toUpperCase(), prev ? `Attempt ${A.wipes + 1} · the heavens reset` : A.x ? 'Faster, harder, overlapping: break her acts before the heavens do' : 'Break her HP to skip ahead: the script is the fallback', A.x ? '#ffb8d8' : '#dfe8ff', A.pull);
  sim.emit({ type: 'astrael', ph: 'pull', x: C.x, y: C.y, t: A.pull, ex: A.x });
  return A;
}
export function endAstraelFor(sim, why) { if (sim.astrael) endAstrael(sim, why); }
function endAstrael(sim, why) {
  const A = sim.astrael;
  clearEncounter(sim, A);
  sim.emit({ type: 'astrael', ph: why, x: C.x, y: C.y });
  sim.astrael = null;
}
function clearEncounter(sim, A, boss = true) {
  for (const e of sim.enemies) if ((boss && e.type === 'astrael') || e.type === 'astralstar') { e.dead = true; e.hp = 0; }
  for (const pr of sim.projectiles) if (pr.astrael) pr.dead = true;
  if (A) { A.jobs = []; A.tele = []; A.marks = []; A.teth = []; A.pylons = []; A.ds = []; A.stars = []; A.suns = null; A.planets = null; A.mirror = null; A.wheel = null; A.fields = []; A.kbs = []; A.adds = []; A.check = null; A.bb = null; }
}
function card(sim, A, txt, sub, col, t = 150) { A.call = { txt, sub: sub || '', col: col || '#fff', t, d: t }; sim.emit({ type: 'astrael', ph: 'call', txt, sub: sub || '', col: col || '#fff', x: C.x, y: C.y }); }
function say(sim, A, txt, t = 240) { A.line = { txt, t, d: t }; sim.emit({ type: 'astrael', ph: 'line', txt, x: C.x, y: C.y }); }
function cine(sim, A, k, d, extra = {}) { A.st = k; A.at = 0; A.cine = { k, t: 0, d, ...extra }; A.lb = d; sim.emit({ type: 'astrael', ph: 'cine', k, d, x: C.x, y: C.y, slow: extra.slow || 0 }); }

// ------------------------------------------------------------------ per-tick
export function updateAstrael(sim) {
  if (sim.predicting) return;
  // the star portal: opens in The Rift Sanctum (north rim) once Vorthax falls
  if (sim.raid && sim.raid.st === 'victory') { if (!sim.starPortal) { sim.starPortal = { x: RAID_POS.x, y: RAID_POS.y - RAID_R + 70 }; sim.emit({ type: 'astrael', ph: 'portal', x: sim.starPortal.x, y: sim.starPortal.y }); } }
  else if (sim.starPortal && !sim.raid) sim.starPortal = null;
  const sp = sim.starPortal;
  if (sp && sim.tick % 6 === 0) for (const p of sim.players.values()) if (!p.dead && Math.hypot(p.x - sp.x, p.y - sp.y) < 46) enterAstrael(sim, p);
  for (const p of sim.players.values()) if (p.wantAst) { const w = p.wantAst; p.wantAst = 0; if (w === 'leave') leaveAstrael(sim, p); else enterAstrael(sim, p, p.wantAstX ? 'x' : null); p.wantAstX = 0; }
  const A = sim.astrael;
  if (!A) return;
  if (A.call && --A.call.t <= 0) A.call = null;
  if (A.line && --A.line.t <= 0) A.line = null;
  if (A.lb > 0) A.lb--;
  if (A.cine) { A.cine.t++; }
  A.party = A.party.filter((id) => sim.players.has(id));
  const present = partyIn(sim, A), here = present.filter((p) => !p.dead);
  // nobody from the party is in the arena any more (left / disconnected): the encounter ends
  if (!present.length) { if (++A.empty > 120) endAstrael(sim, 'abandon'); return; }
  A.empty = 0;
  // fallen party members wait in the sky (revived at the next act); they are not sent to town mid-fight
  if (A.st !== 'victory') for (const p of present) if (p.dead) { p.respawnAt = sim.tick + 30; p.astHold = 1; }
  const b = bossOf(sim);
  if (A.st === 'victory') {
    for (const p of here) if (Math.hypot(p.x - C.x, p.y - (C.y + AST_R - 40)) < 42) { if (sim.hub) A.over = 'clear'; else leaveAstrael(sim, p); } // (hub: the exit star takes the party home)
    tickFx(sim, A, here); return;
  }
  if (A.st === 'wipe') {
    A.at++;
    if (A.at >= AST.wipe) { if (sim.hub) A.over = 'wipe'; else resetAfterWipe(sim, A, present); } // (hub: back to town after the wipe screen)
    return;
  }
  // wipe: nobody alive for 1 s
  if (!here.length) { if (++A.dead1 > 60) return wipe(sim, A, 'fallen'); } else A.dead1 = 0;
  if (!b && A.st !== 'kill') return wipe(sim, A, 'lost');
  if (b && b.dead && A.st !== 'kill') return startKill(sim, A, b);
  if (b && !b.dead) holdBoss(sim, A, b);
  A.at++;
  if (A.st !== 'pull') A.t++;
  A.prog = progress(A);
  switch (A.st) {
    case 'pull':
      for (const p of here) p.iframes = Math.max(p.iframes, 2);
      if (A.at >= A.pull) {
        A.n = Math.max(1, here.length);
        const hp = Math.round(AST.hp.base * modeOf(A).hpMul * AST.hp.mult[Math.min(6, Math.max(1, A.n)) - 1] * encHpA(sim, 'ast', A.x ? 'astx' : 'astn')); // (game loop C3: the endgame at Lv 50)
        b.maxHp = b.hp = hp; b.baseMaxHp = hp;
        startAct(sim, A, 'a1');
        sim.emit({ type: 'astrael', ph: 'start', x: C.x, y: C.y, n: A.n, hp });
      }
      break;
    case 'a1': case 'a2': case 'a3': {
      const enr = Math.round((A.x ? AST_X.enrage : AST.enrage) * (A.as ? AST_ASTRAL : 1));
      if (A.t === enr - secs(30)) card(sim, A, 'THE STARS GROW COLD', '30 seconds before the heavens reset', '#ffd0a0', 150);
      if (A.t >= enr) { cine(sim, A, 'whiteout', AST.cine.whiteout); say(sim, A, 'Time is up, little stars. And so... it begins again.', 200); break; }
      runScript(sim, A, b, here); break;
    }
    case 'collapse':
      for (const p of here) p.iframes = Math.max(p.iframes, 2);
      if (A.at === Math.round(AST.cine.collapse * 0.5)) { A.plats = true; sim.emit({ type: 'astrael', ph: 'shatter', x: C.x, y: C.y }); for (const p of present) { const c = clampToPlatforms(p.x, p.y, 20); p.x = c.x; p.y = c.y; } }
      if (A.at >= AST.cine.collapse) startAdds(sim, A, here);
      break;
    case 'adds': tickAdds(sim, A, b, here); break;
    case 'orrery': if (A.at >= AST.cine.orrery) startAct(sim, A, 'a2'); break;
    case 'ignite':
      for (const p of here) p.iframes = Math.max(p.iframes, 2);
      if (A.at === Math.round(AST.cine.ignite * 0.5)) { A.plats = false; A.clock = true; sim.emit({ type: 'astrael', ph: 'merge', x: C.x, y: C.y }); }
      if (A.at >= AST.cine.ignite) startAct(sim, A, 'a3');
      break;
    case 'bbcine':
      if (A.at >= AST.cine.bbcine) { const d = modeOf(A).bb; A.st = 'bigbang'; A.at = 0; A.cine = null; A.bb = { t: 0, d }; card(sim, A, 'THE BIG BANG', 'Burn her down before the universe resets!', '#ffffff', 150); sim.emit({ type: 'astrael', ph: 'bigbang', x: C.x, y: C.y, d }); }
      break;
    case 'bigbang':
      A.bb.t = A.at; A.lb = Math.max(A.lb, 2);
      if (A.at % 60 === 0) sim.emit({ type: 'astrael', ph: 'count', n: Math.ceil((A.bb.d - A.at) / 60), x: C.x, y: C.y });
      if (A.at >= A.bb.d) { cine(sim, A, 'whiteout', AST.cine.whiteout); say(sim, A, 'And so... it begins again.', 200); }
      break;
    case 'whiteout': if (A.at >= AST.cine.whiteout) { for (const p of here) killPlayer(sim, p, 'the Big Bang'); return wipe(sim, A, 'bigbang'); } break;
    case 'fall': if (A.at >= AST.cine.fall) { for (const p of here) killPlayer(sim, p, 'the falling heavens'); return wipe(sim, A, 'fall'); } break;
    case 'kill': if (A.at >= AST.cine.kill) victory(sim, A); break;
  }
  tickFx(sim, A, here);
}

function holdBoss(sim, A, b) {
  b.raidHold = 1e6; b.cd = 1e6; b.vx = b.vy = 0;
  const dx = A.bx - b.x, dy = A.by - b.y, d = Math.hypot(dx, dy), st = 7;
  if (d > st) { b.x += dx / d * st; b.y += dy / d * st; } else { b.x = A.bx; b.y = A.by; }
  const fl = floorOf(A.st);
  A.shield = 0; b.vuln = 0; A.hpf = b.maxHp ? b.hp / b.maxHp : 1;
  // (game loop B fix: never invulnerable once the fight starts: not at an act's HP floor, not through the cinematics or the
  //  add phase. Damage carries on; the fight's length comes from HP.)
  if (A.st === 'pull' || A.st === 'kill' || A.st === 'victory' || A.st === 'whiteout' || A.st === 'fall' || A.st === 'wipe') { b.invuln = 3; A.shield = 1; }
  else { b.invuln = 0; if (A.gate) A.shield = 2; }
  if (A.st === 'bigbang') { b.vuln = 3; b.vulnMul = AST.bigbang.vuln; }
}
/** The HP she can't go under in each segment (1 = fully shielded). */
export function floorOf(st) { if (st === 'a1') return AST.floors.a1; if (st === 'a2') return AST.floors.a2; if (st === 'a3') return AST.floors.a3; if (st === 'bigbang') return 0; return 1; }
/** 0..1 through the nominal timeline (for the HUD timeline and the wipe screen). */
export function progress(A) {
  let s = 0;
  const segs = segsOf(A), total = segs.reduce((a, x) => a + x[1], 0);
  for (const [k, d] of segs) {
    if (k === A.st || (A.st === 'whiteout' && k === 'bigbang') || (A.st === 'fall' && k === 'adds')) {
      let f = Math.min(1, A.at / 60 / d);
      if (FIGHT.has(k)) f = Math.max(f, actHpFrac(A)); // HP-gated: damage moves you through the act too
      return Math.min(1, (s + d * f) / total);
    }
    s += d;
  }
  return A.st === 'kill' || A.st === 'victory' ? 1 : 0;
}
/** 0..1 through the current act by HP (1 = the gate is reached). */
export function actHpFrac(A) {
  const top = A.st === 'a1' ? 1 : A.st === 'a2' ? AST.floors.a1 : AST.floors.a2, fl = floorOf(A.st);
  return Math.max(0, Math.min(1, (top - (A.hpf ?? 1)) / Math.max(0.01, top - fl)));
}
export function segLabel(st) { const s = SEGS.find((x) => x[0] === st); return s ? s[2] : st === 'pull' ? 'The Pull' : st === 'fall' ? 'Collapse of Heaven' : st === 'whiteout' ? 'The Big Bang' : st === 'kill' || st === 'victory' ? 'The Sky Reborn' : st === 'wipe' ? 'The Heavens Reset' : st; }

function startAct(sim, A, k) {
  A.st = k; A.at = 0; A.si = 0; A.cine = null; A.jobs = []; A.gate = 0;
  A.act = k === 'a1' ? 1 : k === 'a2' ? 2 : 3;
  A.plats = k === 'a2'; A.clock = k === 'a3'; A.bx = C.x; A.by = C.y;
  reviveFallen(sim, A);
  const names = { a1: ['ACT I · STARFALL', 'Constellations · Twin Suns · Comet Drop'], a2: ['ACT II · ORRERY', 'Planets · Astral Mirror · Fated Threads'], a3: ['ACT III · SUPERNOVA', 'Fated Stars · Zodiac Wheel · the Big Bang'] }[k];
  card(sim, A, names[0], names[1], k === 'a1' ? '#bcd4ff' : k === 'a2' ? '#d6b8ff' : '#ffb8a0', 180);
  sim.emit({ type: 'astrael', ph: 'act', act: A.act, x: C.x, y: C.y });
}
function reviveFallen(sim, A) {
  for (const p of partyIn(sim, A)) {
    if (!p.dead) continue;
    const x = p.x, y = p.y;
    respawnPlayer(sim, p);
    const s = A.plats ? clampToPlatforms(x, y, 20) : clampDisc(x, y, 60);
    p.x = p.px = s.x; p.y = p.py = s.y; p.hp = Math.round(p.stats.maxHp * AST.revive); p.astHold = 0;
    sim.emit({ type: 'astrael', ph: 'revive', pid: p.id, x: r0(p.x), y: r0(p.y) });
  }
}
function clampDisc(x, y, pad) { const dx = x - C.x, dy = y - C.y, d = Math.hypot(dx, dy), m = AST_R - pad; return d <= m ? { x, y } : { x: C.x + dx / d * m, y: C.y + dy / d * m }; }

function runScript(sim, A, b, here) {
  const M = modeOf(A), sc = M.script[A.st];
  // the HP gate: once she reaches the act's threshold, nothing new starts; what's on the field resolves, then she moves on
  if (!A.gate && b && !b.dead && b.hp <= Math.ceil(b.maxHp * floorOf(A.st)) + 0.5) { // (no-immunity pass: push her HP to skip ahead; HP sets the pace)
    A.gate = 1;
    sim.emit({ type: 'astrael', ph: 'gate', act: A.act, t: r0(A.at / 60), x: C.x, y: C.y });
    card(sim, A, A.st === 'a3' ? 'THE LAST LIGHT' : 'THE ACT BREAKS', A.jobs.length ? 'She falters: the act ends when this mechanic resolves' : 'She falters', '#fff2b0', 120);
  }
  while (!A.hold && !A.gate && A.si < sc.length && sc[A.si][0] * 60 <= A.at) { // (A.hold: tests / dev freeze the script)
    const [, id, o] = sc[A.si++];
    if (id === 'line') say(sim, A, o);
    else startJob(sim, A, id, o || {}, here);
  }
  for (const j of A.jobs.slice()) {
    if (JOB[j.id](sim, A, j, here, b)) { A.jobs = A.jobs.filter((q) => q !== j); mend(sim, A, j, here); }
    else j.t++;
  }
  A.jobNames = A.jobs.map((j) => (j.id === 'const' ? SHAPE_NAMES[j.o.shape] : MECH_NAMES[j.id]));
  // starbolts between mechanics
  if (!A.hold && !A.gate && !A.jobs.length && A.at % M.bolt === 150 && here.length && b) { // Falling Stars between mechanics: a circle on each player, step out
    for (const t of here) tele(A, { k: 'fstar', sh: 'circle', x: r0(t.x), y: r0(t.y), r: AST.bolt.r, d: M.boltD, show: M.boltD, pct: AST.bolt.pct, what: 'Falling Star' });
  }
  const gated = A.gate && !A.hold && !A.jobs.length && !A.tele.some((t) => !t.done); // (let a Falling Star already on the floor land first)
  if (gated || (A.si >= sc.length && !A.jobs.length && A.at >= M.actEnd[A.st] * 60)) {
    if (gated) A.gated = (A.gated || 0) + 1;
    if (A.st === 'a1') { cine(sim, A, 'collapse', AST.cine.collapse, { slow: 0.4 }); reviveFallen(sim, A); say(sim, A, 'Heaven was never meant to hold you.', 260); card(sim, A, 'COLLAPSE OF HEAVEN', 'The sanctum shatters', '#ffe3a0', AST.cine.collapse); }
    else if (A.st === 'a2') { cine(sim, A, 'ignite', AST.cine.ignite, { slow: 0.4 }); say(sim, A, 'Let the last light ignite.', 220); card(sim, A, 'SUPERNOVA', 'The sanctum becomes a clock of stars', '#ffb8a0', AST.cine.ignite); }
    else { A.bx = C.x; A.by = C.y; cine(sim, A, 'bbcine', AST.cine.bbcine, { slow: 0.5 }); say(sim, A, 'Before the first star, there was only this.', 200); }
  }
}
export function startJob(sim, A, id, o, here) {
  const j = { id, o, t: 0, dt0: new Map(here.map((p) => [p.id, p.dmgTaken || 0])), roles: here.slice().sort((a, c) => a.id - c.id).map((p) => p.id) };
  A.jobs.push(j);
  A.cnt[id] = (A.cnt[id] || 0) + 1; j.k = A.cnt[id];
  sim.emit({ type: 'astrael', ph: 'mech', id, shape: o.shape, name: id === 'const' ? `Constellation: ${SHAPE_NAMES[o.shape]}` : MECH_NAMES[id], x: C.x, y: C.y });
  JOB[id](sim, A, j, here, bossOf(sim));
  j.t++;
  return j;
}
/** Starlight Mend: everyone who took no damage during a mechanic heals a little (bigger solo). */
function mend(sim, A, j, here) {
  const k = A.n > 1 ? AST.mend.party : AST.mend.solo;
  for (const p of here) {
    if (!j.dt0.has(p.id) || (p.dmgTaken || 0) !== j.dt0.get(p.id)) continue;
    healPlayer(sim, p, p.stats.maxHp * k, p);
    sim.emit({ type: 'astrael', ph: 'mend', pid: p.id, x: r0(p.x), y: r0(p.y) });
  }
}

// ------------------------------------------------------------------ damage / movement helpers
/** Dodge pass 2, step 4 (2026-10-19): Astrael's FILLER shapes (Falling Star circles, the Starlance cone, the Starblade sweep)
 * are evadable like any telegraph; the signature checks stay raw (Zodiac Judgment, Crowns, Comets, Saturn, the still/move
 * stars, Mirror Smash, Fated Thread, the suns, Starfire ground, Fall from Heaven, the Big Bang). */
export const AST_EVADABLE = new Set(['fstar', 'lance', 'sword']);
function hit(sim, A, p, pct, what, src = null, evadable = false) {
  if (!(pct > 0) || p.dead) return false;
  const ok = damagePlayer(sim, p, 0, src, { pct, raw: !evadable, by: `${AST.short}'s ${what}` });
  if (ok) { A.hits[what] = (A.hits[what] || 0) + 1; sim.emit({ type: 'astrael', ph: 'hit', pid: p.id, what, x: r0(p.x), y: r0(p.y), pct }); }
  return ok;
}
function bullet(sim, b, x, y, ang, speed, life, pct) {
  const pr = spawnProjectile(sim, { team: 'enemy', ownerId: b.id, x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 11, life, dmg: 1, pct, style: 'star', color: null, kb: 60, by: `${AST.short}'s starbolts` });
  if (pr) pr.astrael = 1;
  return pr;
}
/** Standing on solid ground right now (the disc in acts 1/3, the platforms + bridges in act 2)? */
export function grounded(A, x, y, pad = 8) { return A.plats ? onPlatforms(x, y, pad) : Math.hypot(x - C.x, y - C.y) <= AST_R - 4 + pad; }
/** Where a knockback of `dist` from (fx, fy) would put a player at (x, y). */
export function kbEnd(x, y, fx, fy, dist) { const a = Math.atan2(y - fy, x - fx); return { x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist }; }
function knock(sim, A, p, x1, y1, what) {
  if (evadeShove(sim, p)) return; // (a timed evade cancels the shove)
  A.kbs.push({ pid: p.id, x0: p.x, y0: p.y, x1, y1, t: 0, d: 16, what });
  p.action = null; p.vx = p.vy = 0;
}
function tickKbs(sim, A) {
  for (const k of A.kbs) {
    const p = sim.players.get(k.pid);
    k.t++;
    if (!p || p.dead) { k.gone = 1; continue; }
    const f = Math.min(1, k.t / k.d), e = 1 - (1 - f) * (1 - f);
    p.x = k.x0 + (k.x1 - k.x0) * e; p.y = k.y0 + (k.y1 - k.y0) * e; p.vx = p.vy = 0;
    A.still[p.id] = A.still[p.id] || 0; // forced movement never counts as moving (Pyretic Star)
    p.forcedT = sim.tick;
    if (k.t >= k.d) {
      k.gone = 1;
      if (!grounded(A, p.x, p.y, 10)) {
        hit(sim, A, p, AST.fall, 'Fall from Heaven');
        const s = A.plats ? (() => { const i = nearestPlat(p.x, p.y); return platCenter(i); })() : { x: C.x + (p.x - C.x) * 0.35, y: C.y + (p.y - C.y) * 0.35 };
        p.x = p.px = s.x; p.y = p.py = s.y; p.iframes = Math.max(p.iframes, 45);
        sim.emit({ type: 'astrael', ph: 'fall', pid: p.id, x: r0(p.x), y: r0(p.y) });
      }
    }
  }
  A.kbs = A.kbs.filter((k) => !k.gone);
}
export function nearestPlat(x, y) { let bi = 0, bd = Infinity; for (let i = 0; i < 4; i++) { const c = platCenter(i), d = Math.hypot(x - c.x, y - c.y); if (d < bd) { bd = d; bi = i; } } return bi; }
function tickFx(sim, A, here) {
  tickKbs(sim, A);
  // act 2: you can't walk off a platform (only knockbacks and pulls throw you into the sky)
  if (A.plats) for (const p of here) if (!A.kbs.some((k) => k.pid === p.id) && !onPlatforms(p.x, p.y)) { const c = clampToPlatforms(p.x, p.y); p.x = c.x; p.y = c.y; }
  // movement tracking for Pyretic / Wandering Star (ticks since the player last moved on their own)
  for (const p of here) {
    const lp = A.lastPos || (A.lastPos = {}), l = lp[p.id];
    const forced = p.forcedT === sim.tick;
    if (l && !forced) { if (Math.hypot(p.x - l[0], p.y - l[1]) > 0.6) A.still[p.id] = 0; else A.still[p.id] = (A.still[p.id] || 0) + 1; }
    lp[p.id] = [p.x, p.y];
  }
  // starfire fields
  for (const f of A.fields) {
    f.t++;
    if (f.t >= 60 && f.t % f.every === 0) for (const p of here) if (Math.hypot(p.x - f.x, p.y - f.y) < f.r + p.r * 0.5) hit(sim, A, p, f.pct, 'Starfire');
  }
  A.fields = A.fields.filter((f) => f.t < f.d);
  tickTele(sim, A, here);
}
/** Ground telegraph: { k, sh: circle|rect|cone|notwedge|plat, d (ticks to resolve), show (ticks before resolve it is drawn), pct }. */
function tele(A, spec) { const t = { id: A.tid++, t: 0, show: spec.d, ...spec }; A.tele.push(t); return t; }
function tickTele(sim, A, here) {
  const b = bossOf(sim);
  for (const t of A.tele) {
    t.t++;
    if (t.t === t.d && !t.done) {
      t.done = true; sim.posCheck = posTele(t) ? 1 : 0;
      if (t.pct) for (const p of here) if (teleHits(t, p)) hit(sim, A, p, t.pct, t.what || t.k, AST_EVADABLE.has(t.k) ? { x: t.x, y: t.y } : null, AST_EVADABLE.has(t.k));
      sim.emit({ type: 'astrael', ph: 'boom', k: t.k, sh: t.sh, x: r0(t.x ?? C.x), y: r0(t.y ?? C.y), r: t.r, ang: t.ang, arc: t.arc, len: t.len, w: t.w, half: t.half, plat: t.plat, fake: t.fake ? 1 : 0 });
    }
  }
  A.tele = A.tele.filter((t) => !t.done || t.t < t.d + 16);
  void b;
  sim.posCheck = 0;
}
export function teleHits(t, p) {
  const pr = (p.r || 16) * 0.5;
  switch (t.sh) {
    case 'circle': return Math.hypot(p.x - t.x, p.y - t.y) < t.r + pr;
    case 'rect': return inLine(t.x - Math.cos(t.ang) * t.len / 2, t.y - Math.sin(t.ang) * t.len / 2, t.ang, t.len, t.w, p.x, p.y, pr);
    case 'cone': return inCone(t.x, t.y, t.ang, t.arc, t.len, p.x, p.y, pr);
    case 'notwedge': return !inWedge(t, p.x, p.y);
    case 'plat': return platAt(p.x, p.y, pr) === t.plat;
    default: return false;
  }
}
/** Inside the zodiac sign's safe wedge? */
export function inWedge(t, x, y) {
  const dx = x - C.x, dy = y - C.y, d = Math.hypot(dx, dy);
  if (d < t.rin) return false;
  const da = Math.atan2(dy, dx) - t.ang;
  return Math.abs(Math.atan2(Math.sin(da), Math.cos(da))) <= t.half;
}
export const signAng = (k) => -Math.PI / 2 + k * Math.PI / 6;
const pickPos = (A, i) => (A.plats ? platCenter(i) : null);

// ------------------------------------------------------------------ mechanics
const JOB = {};
/** Constellations: floor stars trace a weapon; its shape is the answer. Sword = a line cleave along the blade, shield =
 *  knockback from Astrael (stand close so you don't fly off), crown = stack (solo: soak the crown sigil yourself). */
JOB.const = (sim, A, j, here, b) => {
  const o = j.o, R = secs(o.read), n = here.length || 1, bx = b ? b.x : C.x, by = b ? b.y : C.y;
  if (j.t === 0) {
    const shape = o.shape;
    let ang = rnd(sim) * TAU;
    if (shape === 'sword') { const t = sim.players.get(baiter(j.roles)) || here[0]; if (t) ang = Math.atan2(t.y - by, t.x - bx); }
    j.star = { id: A.tid++, shape, x: r0(bx), y: r0(by), ang, t: 0, d: R }; A.stars.push(j.star);
    const teach = { sword: 'A blade of stars: step OFF the line it points along', shield: 'A shield: it hurls you away from her. Stand CLOSE to Astrael', crown: n > 1 ? 'A crown: gather on the marked ally and share the hit' : 'A crown: stand inside the crown sigil to soak it' }[shape];
    card(sim, A, `CONSTELLATION: ${SHAPE_NAMES[shape].toUpperCase()}`, o.teach ? teach : 'Read the stars', AST_COL.star, Math.min(R, 200));
    if (shape === 'sword') j.tl = tele(A, { k: 'sword', sh: 'rect', x: r0(bx), y: r0(by), ang, len: 2 * AST_R + 260, w: AST.sword.w, d: R, show: o.teach ? secs(2) : secs(0.8), pct: AST.sword.pct, what: 'Starblade' });
    if (shape === 'shield') j.tl = tele(A, { k: 'shield', sh: 'ring', x: r0(bx), y: r0(by), d: R, show: o.teach ? secs(2) : secs(0.8) });
    if (shape === 'crown') crowns(sim, A, j, here, R, 'crown');
  }
  j.star.t = j.t; markTick(j, j.crowns); markTick(j, j.tags);
  if (j.t === R) {
    if (o.shape === 'shield') for (const p of here) { const e = kbEnd(p.x, p.y, bx, by, A.plats ? AST.kb.a2 : AST.kb.a1); knock(sim, A, p, e.x, e.y, 'Shield'); }
    if (o.shape === 'crown') resolveCrowns(sim, A, j, here);
    sim.emit({ type: 'astrael', ph: 'constBoom', shape: o.shape, x: r0(bx), y: r0(by), ang: j.star.ang, slow: o.shape === 'shield' ? 0.25 : 0 });
  }
  if (j.t >= R + 24) { A.stars = A.stars.filter((s) => s !== j.star); return true; }
  return false;
};
/** Stack markers by group size: solo = a self-soak sigil, 2 = one shared stack, 3-4 = two split stacks (groups A / B). */
function crowns(sim, A, j, here, R, k) {
  const n = here.length;
  j.crowns = [];
  if (n <= 1) {
    const p = here[0];
    let x, y;
    if (A.plats) { const i = p ? (platAt(p.x, p.y, 30) >= 0 ? platAt(p.x, p.y, 30) : nearestPlat(p.x, p.y)) : 0; const c = platCenter(i); x = c.x; y = c.y; }
    else { const a = p ? Math.atan2(p.y - C.y, p.x - C.x) + Math.PI * (0.5 + rnd(sim) * 0.5) * (rnd(sim) < 0.5 ? 1 : -1) : 0; x = C.x + Math.cos(a) * 230; y = C.y + Math.sin(a) * 230; }
    j.crowns.push({ k, x: r0(x), y: r0(y), r: AST.crown.r - 10, t: 0, d: R, need: 1, solo: 1, grp: 0 });
  } else if (n === 2) j.crowns.push({ k, pid: j.roles[0], r: AST.crown.r, t: 0, d: R, need: 2, grp: 0 });
  else {
    j.crowns.push({ k, pid: j.roles[0], r: AST.crown.r, t: 0, d: R, need: 2, grp: 0 }, { k, pid: j.roles[1], r: AST.crown.r, t: 0, d: R, need: 2, grp: 1 });
    j.tags = j.roles.map((pid, i) => ({ k: 'tag', pid, txt: i % 2 ? 'B' : 'A', t: 0, d: R }));
    A.marks.push(...j.tags);
  }
  A.marks.push(...j.crowns);
  j.crownT0 = j.t;
}
function crownPos(sim, m) { if (m.pid) { const p = sim.players.get(m.pid); if (p && !p.dead) return p; } return m.x != null ? m : null; }
function resolveCrowns(sim, A, j, here) {
  for (const m of j.crowns) {
    const c = crownPos(sim, m);
    if (!c) continue;
    const inside = here.filter((p) => Math.hypot(p.x - c.x, p.y - c.y) < m.r + p.r * 0.5);
    if (m.solo) { for (const p of here) hit(sim, A, p, inside.includes(p) ? AST.crown.soloIn : AST.crown.soloOut, inside.includes(p) ? 'Crown' : 'Crown (unsoaked)'); }
    else if (inside.length >= m.need) { const per = Math.min(AST.crown.over, AST.crown.total / inside.length); for (const p of inside) hit(sim, A, p, per, 'Crown'); }
    else for (const p of inside) hit(sim, A, p, AST.crown.over, 'Crown (not enough)');
    sim.emit({ type: 'astrael', ph: 'boom', k: 'crown', sh: 'circle', x: r0(c.x), y: r0(c.y), r: m.r, n: inside.length, need: m.need });
  }
  A.marks = A.marks.filter((m) => !j.crowns.includes(m) && !(j.tags || []).includes(m));
}
function markTick(j, list) { for (const m of list || []) m.t = j.t - (j.crownT0 || 0); }
/** The baiter: the last role (solo = you). */
function baiter(roles) { return roles[Math.min(roles.length - 1, 3)]; }

/** Twin Suns: a warm and a cold sun; you carry one sun's brand and must stand in the OPPOSITE sun's light at the burst. */
JOB.suns = (sim, A, j, here) => {
  const R = secs(j.o.read), n = here.length;
  if (j.t === 0) {
    const it = j.k;
    let w, c, r;
    if (A.plats) { w = platCenter(it % 2 ? 3 : 1); c = platCenter(it % 2 ? 1 : 3); r = AST.suns.rPlat; }
    else { const a = it % 2 ? 0 : Math.PI / 2; w = { x: C.x + Math.cos(a) * AST.suns.dist, y: C.y + Math.sin(a) * AST.suns.dist }; c = { x: C.x - Math.cos(a) * AST.suns.dist, y: C.y - Math.sin(a) * AST.suns.dist }; r = AST.suns.r; }
    A.suns = { id: A.tid++, wx: r0(w.x), wy: r0(w.y), cx: r0(c.x), cy: r0(c.y), r, t: 0, d: R };
    j.brands = j.roles.map((pid, i) => ({ k: 'sun', pid, c: (n <= 1 ? it : i + it) % 2 ? 'warm' : 'cold', t: 0, d: R }));
    A.marks.push(...j.brands);
    card(sim, A, 'TWIN SUNS', j.o.teach ? 'You carry one sun\'s brand: stand in the OTHER sun\'s light when they burst' : 'Seek what you are not', AST_COL.warm, Math.min(R, 200));
  }
  A.suns.t = j.t; for (const m of j.brands) m.t = j.t;
  if (j.t === R) {
    const S = A.suns;
    for (const m of j.brands) {
      const p = sim.players.get(m.pid);
      if (!p || p.dead || !here.includes(p)) continue;
      const need = m.c === 'warm' ? [S.cx, S.cy] : [S.wx, S.wy];
      if (Math.hypot(p.x - need[0], p.y - need[1]) > S.r + p.r * 0.5) hit(sim, A, p, AST.suns.pct, m.c === 'warm' ? 'Sunburn' : 'Frostbite');
    }
    sim.emit({ type: 'astrael', ph: 'sunBurst', wx: S.wx, wy: S.wy, cx: S.cx, cy: S.cy, r: S.r, x: C.x, y: C.y });
  }
  if (j.t >= R + 30) { A.suns = null; A.marks = A.marks.filter((m) => !j.brands.includes(m)); return true; }
  return false;
};
/** Comet Drop: one marker per player (numbered = your assignment); unsoaked markers explode across the whole arena. */
JOB.comets = (sim, A, j, here) => {
  const R = secs(j.o.read), m = Math.max(1, Math.min(4, here.length));
  if (j.t === 0) {
    j.cs = [];
    for (let i = 0; i < m; i++) {
      let x, y;
      if (A.plats) { const c = platCenter(i + j.k); const a = (i + j.k) * 1.9; x = c.x + Math.cos(a) * 40; y = c.y + Math.sin(a) * 40; }
      else { const a = j.k * 0.9 + (m === 1 ? 0 : (i / m) * TAU); const rr = m === 1 ? 250 : 290; x = C.x + Math.cos(a) * rr; y = C.y + Math.sin(a) * rr; }
      j.cs.push({ k: 'comet', x: r0(x), y: r0(y), r: AST.comet.r, n: i + 1, pid: j.roles[i], t: 0, d: R });
    }
    A.marks.push(...j.cs);
    card(sim, A, 'COMET DROP', j.o.teach ? (m > 1 ? 'Stand in YOUR numbered marker before it lands, or it hits the whole arena' : 'Stand in the marker before it lands, or it hits the whole arena') : (m > 1 ? 'Soak your number' : 'Soak it'), AST_COL.comet, Math.min(R, 200));
  }
  for (const c of j.cs) c.t = j.t;
  if (j.t === R) {
    for (const c of j.cs) {
      const inside = here.filter((p) => Math.hypot(p.x - c.x, p.y - c.y) < c.r + p.r * 0.5);
      if (!inside.length) { for (const p of here) hit(sim, A, p, AST.comet.unsoaked, 'Unsoaked Comet'); sim.emit({ type: 'astrael', ph: 'cometFail', x: c.x, y: c.y, slow: 0.25 }); }
      else for (const p of inside) hit(sim, A, p, here.length <= 1 ? AST.comet.solo : Math.max(AST.comet.min, AST.comet.pct / inside.length), 'Comet');
      sim.emit({ type: 'astrael', ph: 'boom', k: 'comet', sh: 'circle', x: c.x, y: c.y, r: c.r, n: inside.length });
    }
    A.marks = A.marks.filter((q) => !j.cs.includes(q));
  }
  return j.t >= R + 20;
};
/** Planets: 3 worlds light up one by one (memorize: knockback / stack / spread), then resolve in that order. */
const PL = { rev: [60, 170, 280], lit: 95, res: [520, 700, 880] };
const PLX = { rev: [45, 125, 205], lit: 75, res: [400, 545, 690] }; // Extreme: faster reveals, shorter memory window
JOB.planets = (sim, A, j, here, b) => {
  if (j.t === 0) {
    const ks = ['kb', 'stack', 'spread'];
    for (let i = ks.length - 1; i > 0; i--) { const k = Math.floor(rnd(sim) * (i + 1)); [ks[i], ks[k]] = [ks[k], ks[i]]; }
    j.ks = ks;
    A.planets = { id: A.tid++, list: ks.map((k) => ({ k, lit: 0, done: 0 })), t: 0, ang: rnd(sim) * TAU, cur: -1, rev: modeOf(A).pl.rev, lit: modeOf(A).pl.lit, res: modeOf(A).pl.res };
    card(sim, A, 'PLANETS', j.o.teach ? 'Memorize the order they light up. Mars = knockback, Jupiter = stack, Saturn = spread' : 'Remember the order', '#ffcf8a', 200);
  }
  const P = A.planets, PL = modeOf(A).pl;
  P.t = j.t;
  for (let i = 0; i < 3; i++) { P.list[i].lit = j.t >= PL.rev[i] && j.t < PL.rev[i] + PL.lit ? 1 : 0; if (j.t === PL.rev[i]) sim.emit({ type: 'astrael', ph: 'planet', i, k: P.list[i].k, x: C.x, y: C.y }); }
  for (let i = 0; i < 3; i++) {
    const res = PL.res[i], k = P.list[i].k, lead = k === 'kb' ? 70 : 110;
    if (j.t === res - lead) { // the pre-resolve markers (short: the order itself has to be remembered)
      P.cur = i;
      if (k === 'kb') j.tl = tele(A, { k: 'shield', sh: 'ring', x: r0(b ? b.x : C.x), y: r0(b ? b.y : C.y), d: lead, show: lead });
      if (k === 'stack') { crowns(sim, A, j, here, lead, 'crown'); }
      if (k === 'spread') spreads(sim, A, j, here, lead);
    }
    if (j.t > res - lead && j.t < res) { markTick(j, j.crowns); markTick(j, j.tags); for (const m of j.sp || []) m.t = j.t - (res - lead); }
    if (j.t === res) {
      if (k === 'kb') for (const p of here) { const e = kbEnd(p.x, p.y, b ? b.x : C.x, b ? b.y : C.y, AST.kb.a2); knock(sim, A, p, e.x, e.y, 'Mars'); }
      if (k === 'stack') { resolveCrowns(sim, A, j, here); j.crowns = []; }
      if (k === 'spread') resolveSpreads(sim, A, j, here);
      P.list[i].done = 1; P.cur = -1;
      sim.emit({ type: 'astrael', ph: 'planetRes', i, k, x: C.x, y: C.y });
    }
  }
  if (j.t >= PL.res[2] + 30) { A.planets = null; return true; }
  void PL;
  return false;
};
function spreads(sim, A, j, here, d) {
  j.sp = [];
  if (here.length > 1) for (const p of here) j.sp.push({ k: 'spread', pid: p.id, r: AST.spread.r, t: 0, d });
  else if (here[0]) { const p = here[0], a0 = rnd(sim) * TAU; for (const da of [0, 2.3]) { const a = a0 + da, x = p.x + Math.cos(a) * 55, y = p.y + Math.sin(a) * 55; j.sp.push({ k: 'spread', echo: 1, x: r0(x), y: r0(y), r: AST.spread.echoR, t: 0, d }); } }
  A.marks.push(...j.sp);
}
function resolveSpreads(sim, A, j, here) {
  for (const m of j.sp || []) {
    const src = m.pid ? sim.players.get(m.pid) : m;
    if (!src || src.dead) continue;
    for (const p of here) {
      if (p.id === m.pid) { hit(sim, A, p, AST.spread.self, 'Saturn'); continue; }
      if (Math.hypot(p.x - src.x, p.y - src.y) < m.r + p.r * 0.5) hit(sim, A, p, m.echo ? AST.spread.echo : AST.spread.pct, m.echo ? 'Saturn Echo' : 'Saturn (ally)');
    }
    sim.emit({ type: 'astrael', ph: 'boom', k: 'spread', sh: 'circle', x: r0(src.x), y: r0(src.y), r: m.r });
  }
  A.marks = A.marks.filter((m) => !(j.sp || []).includes(m)); j.sp = [];
}
/** Astral Mirror: she and her reflection each aim a platform smash; only the REAL one's lands. The real Astrael casts a
 *  shadow and wears a gold halo; the reflection is shadowless with a silver halo and a mirrored crescent. */
JOB.mirror = (sim, A, j, here) => {
  const R = secs(j.o.read);
  if (j.t === 0) {
    let pl;
    if (j.o.avoid) pl = rnd(sim) < 0.5 ? [0, 2] : [2, 0];
    else { const a = Math.floor(rnd(sim) * 4); pl = [a, (a + 1 + Math.floor(rnd(sim) * 3)) % 4]; }
    const realFirst = rnd(sim) < 0.5, rp = realFirst ? pl[0] : pl[1], fp = realFirst ? pl[1] : pl[0];
    const pos = (i) => { const c = platCenter(i); return { x: r0(C.x + (c.x - C.x) * 0.3), y: r0(C.y + (c.y - C.y) * 0.3) }; };
    const rpos = pos(rp), fpos = pos(fp);
    A.mirror = { id: A.tid++, rx: rpos.x, ry: rpos.y, fx: fpos.x, fy: fpos.y, rp, fp, t: 0, d: R };
    A.bx = rpos.x; A.by = rpos.y;
    tele(A, { k: 'mirror', sh: 'plat', plat: rp, d: R, show: R, pct: AST.mirror.pct, what: 'Mirror Smash' });
    tele(A, { k: 'mirror', sh: 'plat', plat: fp, d: R, show: R, fake: 1 });
    card(sim, A, 'ASTRAL MIRROR', j.o.teach ? 'Only the REAL Astrael\'s smash lands: she casts a shadow and wears a GOLD halo' : 'Which of us is real?', AST_COL.mirror, Math.min(R, 200));
  }
  A.mirror.t = j.t;
  if (j.t === R) sim.emit({ type: 'astrael', ph: 'mirrorRes', rp: A.mirror.rp, fp: A.mirror.fp, fx: A.mirror.fx, fy: A.mirror.fy, x: C.x, y: C.y });
  if (j.t >= R + 30) { A.mirror = null; A.bx = C.x; A.by = C.y; return true; }
  return false;
};
/** Fated Threads: tethers that must END between 240 and 360 apart (pairs; solo / the odd one out: to a pylon). */
JOB.threads = (sim, A, j, here) => {
  const R = secs(j.o.read), T = AST.thread;
  if (j.t === 0) {
    const ps = j.roles.map((id) => sim.players.get(id)).filter(Boolean);
    A.teth = []; A.pylons = [];
    for (let i = 0; i + 1 < ps.length; i += 2) A.teth.push({ a: ps[i].id, b: ps[i + 1].id, t: 0, d: R, lo: T.lo, hi: T.hi, dist: 0 });
    if (ps.length % 2) {
      const p = ps[ps.length - 1], i = (platAt(p.x, p.y, 30) >= 0 ? platAt(p.x, p.y, 30) : nearestPlat(p.x, p.y));
      const c = A.plats ? platCenter(i) : { x: C.x, y: C.y + 150 };
      A.pylons.push({ x: r0(c.x), y: r0(c.y) });
      A.teth.push({ a: p.id, b: 0, ax: r0(c.x), ay: r0(c.y), t: 0, d: R, lo: T.lo, hi: T.hi, dist: 0 });
    }
    card(sim, A, 'FATED THREADS', `End ${T.lo}-${T.hi} apart${ps.length > 1 ? ' from your partner' : ' from the pylon'}: too near or too far snaps it`, AST_COL.thread, Math.min(R, 220));
  }
  for (const th of A.teth) {
    th.t = j.t;
    const a = sim.players.get(th.a), bb = th.b ? sim.players.get(th.b) : { x: th.ax, y: th.ay };
    if (!a || !bb) continue;
    th.dist = r0(Math.hypot(a.x - bb.x, a.y - bb.y));
  }
  if (j.t === R) {
    for (const th of A.teth) {
      const a = sim.players.get(th.a), bb = th.b ? sim.players.get(th.b) : null;
      if (!a || a.dead || (th.b && (!bb || bb.dead))) continue;
      const ok = th.dist >= th.lo && th.dist <= th.hi;
      if (!ok) { hit(sim, A, a, T.pct, th.dist < th.lo ? 'Fated Thread (too near)' : 'Fated Thread (too far)'); if (bb) hit(sim, A, bb, T.pct, th.dist < th.lo ? 'Fated Thread (too near)' : 'Fated Thread (too far)'); }
      const mx = bb ? (a.x + bb.x) / 2 : (a.x + th.ax) / 2, my = bb ? (a.y + bb.y) / 2 : (a.y + th.ay) / 2;
      sim.emit({ type: 'astrael', ph: ok ? 'threadOk' : 'threadFail', x: r0(mx), y: r0(my), a: th.a, b: th.b });
    }
    A.teth = []; A.pylons = [];
  }
  return j.t >= R + 20;
};
/** Fated Stars (act 3): delayed debuffs per role. Nova Burst explodes on you (hurts allies nearby, leaves starfire),
 *  Gravity Well pulls every ally to you, Pyretic Star punishes moving and Wandering Star punishes standing still. */
JOB.debuffs = (sim, A, j, here) => {
  if (j.t === 0) {
    const tab = DEBUFFS[bucketOf(here.length)][j.o.round % 3];
    j.list = [];
    const K = modeOf(A).debuffK;
    j.roles.forEach((pid, i) => { const rl = tab[i]; if (rl) for (const [k0, s] of rl) { const k = j.o.noGrav && k0 === 'gravity' ? 'move' : k0; j.list.push({ id: A.tid++, pid, k, t: 0, d: secs(s * K) }); } });
    A.ds.push(...j.list);
    card(sim, A, 'FATED STARS', j.o.teach ? 'Delayed debuffs: read the timers and resolve them in order' : 'Plan your ending', '#ffb8a0', 220);
  }
  for (const d of j.list) {
    if (d.done) continue;
    d.t = j.t;
    if (d.t < d.d) continue;
    d.done = 1;
    const p = sim.players.get(d.pid);
    if (!p || p.dead || !here.includes(p)) continue;
    if (d.k === 'nova') {
      for (const q of here) if (q !== p && Math.hypot(q.x - p.x, q.y - p.y) < AST.nova.r + q.r * 0.5) hit(sim, A, q, AST.nova.pct, 'Nova Burst (ally)');
      hit(sim, A, p, AST.nova.self, 'Nova Burst');
      A.fields.push({ id: A.tid++, x: r0(p.x), y: r0(p.y), r: AST.nova.field.r, t: 0, d: AST.nova.field.dur, pct: AST.nova.field.pct, every: AST.nova.field.every });
      sim.emit({ type: 'astrael', ph: 'nova', pid: p.id, x: r0(p.x), y: r0(p.y), r: AST.nova.r });
    } else if (d.k === 'gravity') {
      for (const q of here) if (q !== p) { const a = Math.atan2(q.y - p.y, q.x - p.x), x1 = p.x + Math.cos(a) * 46, y1 = p.y + Math.sin(a) * 46; knock(sim, A, q, x1, y1, 'Gravity'); }
      sim.emit({ type: 'astrael', ph: 'gravity', pid: p.id, x: r0(p.x), y: r0(p.y) });
    } else if (d.k === 'still') {
      const s = A.still[p.id] || 0;
      if (s < AST.still.win) hit(sim, A, p, AST.still.pct, 'Pyretic Star (moved)');
      sim.emit({ type: 'astrael', ph: 'debuffRes', k: d.k, ok: s >= AST.still.win ? 1 : 0, pid: p.id, x: r0(p.x), y: r0(p.y) });
    } else if (d.k === 'move') {
      const s = A.still[p.id] || 0;
      if (s >= AST.still.win) hit(sim, A, p, AST.still.pct, 'Wandering Star (stood still)');
      sim.emit({ type: 'astrael', ph: 'debuffRes', k: d.k, ok: s < AST.still.win ? 1 : 0, pid: p.id, x: r0(p.x), y: r0(p.y) });
    }
  }
  A.ds = A.ds.filter((d) => !d.done);
  const last = Math.max(...j.list.map((d) => d.d), 0);
  return j.t >= last + 20;
};
/** Zodiac Wheel: the arena is a clock face; she points at signs (remember them), then each sign's wedge is the only
 *  safe place in that order, while she throws a Starlance cleave at the baiter between the judgments. */
export const ZOD = { rev0: 30, rev: 90, gap: 90, res: 150, fast: 130, lead: 110, show: 45 };
export const ZODX = { rev0: 25, rev: 70, gap: 70, res: 120, fast: 105, lead: 95, show: 38 };
JOB.zodiac = (sim, A, j, here, b) => {
  const ZOD = modeOf(A).zod, s = j.o.signs, step = j.o.fast ? ZOD.fast : ZOD.res, T0 = ZOD.rev0 + s * ZOD.rev + ZOD.gap;
  if (j.t === 0) {
    const seq = [Math.floor(rnd(sim) * 12)];
    for (let i = 1; i < s; i++) { const st = (3 + Math.floor(rnd(sim) * 3)) * (rnd(sim) < 0.5 ? 1 : -1); seq.push((seq[i - 1] + st + 12) % 12); }
    j.seq = seq;
    A.wheel = { id: A.tid++, seq, t: 0, ptr: -1, done: 0, n: s, res: seq.map((_, i) => T0 + i * step), rev0: ZOD.rev0, rev: ZOD.rev, lead: ZOD.lead };
    card(sim, A, 'ZODIAC WHEEL', j.o.teach ? 'Remember the signs she points at: each one\'s wedge is the ONLY safe place, in order' : 'Remember the signs', '#ffe7a0', 200);
  }
  const W = A.wheel;
  W.t = j.t;
  const ri = Math.floor((j.t - ZOD.rev0) / ZOD.rev);
  W.ptr = j.t >= ZOD.rev0 && ri < s ? ri : -1;
  if (j.t >= ZOD.rev0 && (j.t - ZOD.rev0) % ZOD.rev === 0 && ri < s) sim.emit({ type: 'astrael', ph: 'sign', i: ri, sign: j.seq[ri], x: C.x, y: C.y });
  for (let i = 0; i < s; i++) {
    const res = T0 + i * step;
    if (j.t === res - ZOD.lead) tele(A, { k: 'zodiac', sh: 'notwedge', ang: signAng(j.seq[i]), half: AST.zodiac.half, rin: AST.zodiac.rin, d: ZOD.lead, show: ZOD.show, pct: AST.zodiac.pct, what: 'Zodiac Judgment', sign: j.seq[i] });
    if (j.t === res) W.done = i + 1;
    if (i < s - 1 && j.t === res + 10) { // the baited Starlance
      const t = sim.players.get(baiter(j.roles)) || here[0];
      if (t && b) { const a = Math.atan2(t.y - b.y, t.x - b.x); b.face = a; tele(A, { k: 'lance', sh: 'cone', x: r0(b.x), y: r0(b.y), ang: a, arc: AST.zodiac.lance.arc, len: AST.zodiac.lance.len, d: 70, show: 70, pct: AST.zodiac.lance.pct, what: 'Starlance', pid: t.id }); }
    }
  }
  if (j.t >= T0 + (s - 1) * step + 30) { A.wheel = null; return true; }
  return false;
};

// ------------------------------------------------------------------ the transition (Aegis Stars damage check)
function startAdds(sim, A, here) {
  A.st = 'adds'; A.at = 0; A.cine = null;
  const M = modeOf(A), hp = Math.round(AST.add.hp * M.addHp * (1 + AST.add.per * (A.n - 1)));
  A.adds = [Math.PI / 4, Math.PI * 1.25].map((a0) => {
    const e = spawnEnemy(sim, 'astralstar', C.x + Math.cos(a0) * AST.add.orbit, C.y + Math.sin(a0) * AST.add.orbit, { zoneHp: false });
    e.raidHold = 1e6; e.cd = 1e6; e.maxHp = e.hp = e.baseMaxHp = hp; e.orbA = a0; e.dropChance = 0;
    return e.id;
  });
  A.check = { t: 0, d: M.check, hp };
  card(sim, A, 'COLLAPSE OF HEAVEN', 'Destroy both Aegis Stars before the platforms fall!', '#ffe3a0', 200);
  say(sim, A, 'My guardians will hold the sky. Can you break them?', 240);
  void here;
}
function tickAdds(sim, A, b, here) {
  A.check.t = A.at;
  const adds = A.adds.map((id) => sim.enemyById.get(id)).filter((e) => e && !e.dead);
  for (const e of adds) {
    const ph = A.at % AST.add.hop, glide = ph >= AST.add.hop - AST.add.glide; // rest on a platform, then glide to the next one
    if (glide) e.orbA += (Math.PI / 2) / AST.add.glide;
    e.raidHold = 1e6; e.vx = e.vy = 0;
    e.x = C.x + Math.cos(e.orbA) * AST.add.orbit; e.y = C.y + Math.sin(e.orbA) * AST.add.orbit;
    if (A.at % AST.add.every === 75) for (let i = 0; i < 6; i++) bullet(sim, e, e.x, e.y, e.orbA + i * TAU / 6, 170, 200, AST.add.pct);
  }
  if (!adds.length) { cine(sim, A, 'orrery', AST.cine.orrery, { slow: 0.4 }); card(sim, A, 'THE AEGIS STARS FALL', 'The platforms hold', '#ffe3a0', AST.cine.orrery); say(sim, A, 'Then turn with my worlds instead.', 200); return; }
  if (A.at >= A.check.d) { cine(sim, A, 'fall', AST.cine.fall, { slow: 0.3 }); card(sim, A, 'THE HEAVENS FALL', 'The Aegis Stars survived', AST_COL.danger, AST.cine.fall); }
  void b; void here;
}

// ------------------------------------------------------------------ kill / wipe
function startKill(sim, A, b) {
  clearEncounter(sim, A);
  A.st = 'kill'; A.at = 0; A.kx = r0(b.x); A.ky = r0(b.y);
  A.cine = { k: 'kill', t: 0, d: AST.cine.kill }; A.lb = AST.cine.kill; A.won = true;
  say(sim, A, 'So this is how stars are born... thank you, little lights.', 300);
  sim.emit({ type: 'astrael', ph: 'kill', x: A.kx, y: A.ky, slow: 0.35 });
}
function victory(sim, A) {
  A.st = 'victory'; A.cine = null; A.best = 1;
  const t = A.t;
  card(sim, A, 'THE SKY IS REBORN', `${nameOf(A)} cleared in ${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}${A.wipes ? ` · after ${A.wipes} wipe${A.wipes > 1 ? 's' : ''}` : ''} · ${sim.hub ? 'the exit star leads home' : 'the exit star is open'}`, '#ffe27a', 360);
  reviveFallen(sim, A);
  sim.emit({ type: 'astrael', ph: 'victory', x: C.x, y: C.y, t: r0(t / 60), wipes: A.wipes, ex: A.x });
  // clears are remembered per hero (the client persists them); clearing Astrael unlocks Astrael (Extreme)
  for (const id of A.party) {
    const p = sim.players.get(id);
    if (!p) continue;
    p.unlocks = p.unlocks || {};
    const fresh = !A.x && !p.unlocks.astx;
    if (!A.x) p.unlocks.astx = 1; else p.unlocks.astxClear = 1;
    sim.emit({ type: 'astrael', ph: 'clear', pid: p.id, ex: A.x, fresh: fresh ? 1 : 0, x: C.x, y: C.y });
    if (fresh) sim.emit({ type: 'astrael', ph: 'unlock', pid: p.id, key: 'astx', x: C.x, y: C.y });
  }
}
/** Wipe: everything resets (the boss back to full, the script from the top) after the wipe screen. */
function wipe(sim, A, reason) {
  const b = bossOf(sim);
  A.lastWipe = { st: A.st, seg: segLabel(A.st), mech: A.jobNames.slice(), hp: b && b.maxHp ? Math.round(b.hp / b.maxHp * 100) : 100, prog: Math.round(A.prog * 100), t: r0(A.t / 60), reason };
  A.best = Math.max(A.best, A.prog);
  A.wipes++;
  clearEncounter(sim, A);
  A.st = 'wipe'; A.at = 0; A.cine = null; A.lb = AST.wipe; A.call = null;
  sim.emit({ type: 'astrael', ph: 'wipe', reason, x: C.x, y: C.y, prog: A.lastWipe.prog, t: A.lastWipe.t });
}
function resetAfterWipe(sim, A, present) {
  const prev = A;
  startAstrael(sim, prev);
  present.forEach((p, i) => {
    if (p.dead) respawnPlayer(sim, p);
    placeStart(p, i); p.hp = p.stats.maxHp; p.res = p.stats.maxRes; p.astHold = 0;
    sim.emit({ type: 'astrael', ph: 'revive', pid: p.id, x: r0(p.x), y: r0(p.y) });
  });
}

// ------------------------------------------------------------------ co-op / test helpers
const PACK_T = ['x', 'y', 'r', 'ang', 'arc', 'len', 'w', 'half', 'rin', 'plat', 'fake', 'pid', 'sign', 'show', 'done'];
/** Compact copy for the co-op snapshot (the renderer reads the same shape from a local sim). */
export function packAstrael(sim) {
  const A = sim.astrael, out = {};
  if (sim.starPortal) out.sp = sim.starPortal;
  if (!A) return out.sp ? out : null;
  const tele = A.tele.map((t) => { const o = { id: t.id, k: t.k, sh: t.sh, t: t.t, d: t.d }; for (const k of PACK_T) if (t[k] !== undefined) o[k] = typeof t[k] === 'number' ? Math.round(t[k] * 100) / 100 : t[k]; return o; });
  out.a = { x: A.x, as: A.as || 0, hub: A.hub, gate: A.gate, hpf: Math.round((A.hpf ?? 1) * 1000) / 1000, over: A.over || 0, st: A.st, at: A.at, t: A.t, act: A.act, n: A.n, bid: A.bid, party: A.party, call: A.call, line: A.line, cine: A.cine, lb: A.lb, plats: A.plats, clock: A.clock,
    stars: A.stars, suns: A.suns, marks: A.marks, teth: A.teth, pylons: A.pylons, ds: A.ds, planets: A.planets, mirror: A.mirror, wheel: A.wheel, fields: A.fields,
    tele, check: A.check, bb: A.bb, shield: A.shield, prog: Math.round(A.prog * 1000) / 1000, best: A.best, wipes: A.wipes, lastWipe: A.lastWipe, adds: A.adds, jobNames: A.jobNames, kx: A.kx, ky: A.ky, pull: A.pull };
  return out;
}
/** Test hook (server dev op 'astrael' / playtests): enter, skip the pull, jump to a segment (optionally seconds in),
 *  force a mechanic, set boss HP %, kill the adds, force a wipe or the kill. */
export function devAstrael(sim, p, m) {
  if (m.enter) enterAstrael(sim, p);
  if (m.leave) { leaveAstrael(sim, p); return; }
  const A = sim.astrael;
  if (!A) return;
  const b = bossOf(sim);
  if (m.skipPull && A.st === 'pull') A.at = A.pull - 1;
  if (typeof m.seg === 'string') {
    if (A.st === 'pull') { A.at = A.pull - 1; updateAstrael(sim); }
    clearEncounter(sim, A, false); A.cine = null;
    const here = aliveIn(sim, A);
    if (m.seg === 'a1' || m.seg === 'a2' || m.seg === 'a3') {
      startAct(sim, A, m.seg);
      if (m.at > 0) { A.at = secs(m.at); const sc = modeOf(A).script[m.seg]; while (A.si < sc.length && sc[A.si][0] * 60 < A.at) A.si++; }
      if (b) b.hp = Math.round(b.maxHp * ({ a1: 1, a2: AST.floors.a1, a3: AST.floors.a2 }[m.seg]));
    } else if (m.seg === 'collapse') { A.plats = false; cine(sim, A, 'collapse', AST.cine.collapse); }
    else if (m.seg === 'adds') { A.plats = true; startAdds(sim, A, here); }
    else if (m.seg === 'bigbang') { A.plats = false; A.clock = true; A.bx = C.x; A.by = C.y; cine(sim, A, 'bbcine', AST.cine.bbcine); if (b) b.hp = Math.round(b.maxHp * AST.floors.a3); }
    if (A.plats) for (const q of here) { const c = clampToPlatforms(q.x, q.y, 20); q.x = c.x; q.y = c.y; }
  }
  if (m.job && JOB[m.job]) { if (!m.add) { A.jobs = []; A.tele = []; A.marks = []; A.teth = []; A.ds = []; A.stars = []; } startJob(sim, A, m.job, m.o || {}, aliveIn(sim, A)); }
  if (b && m.hpPct > 0 && m.hpPct <= 1) b.hp = Math.max(1, Math.round(b.maxHp * m.hpPct));
  if (m.killAdds) for (const id of A.adds) { const e = sim.enemyById.get(id); if (e) { e.hp = 1; e.dead = true; } }
  if (m.wipe) wipe(sim, A, 'dev');
  if (m.win && b) { b.hp = 0; b.dead = true; }
  if (m.hold != null) A.hold = m.hold;
}
export const __test = { JOB, wipe, startAdds, startAct, PL, PLX };
