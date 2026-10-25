// The Frostveil + Emberdeep TRIALS: Skaldra (Trial) / Skaldra (Extreme) in The Hoarfrost Mirror and Pyrrhex (Trial) /
// Pyrrhex (Extreme) in The Heart-Chamber. Standalone arena fights modelled on Astrael: a pull, HP-GATED phases (when the
// boss reaches a phase's floor nothing new starts, what is on the field resolves, then a short transition), a hard
// ENRAGE timer, a wipe screen and an automatic retry (Pause -> Return to Town leaves). Every mechanic opens with a name
// card and draws its answer on the floor (Rabbit-and-Steel style: big readable shapes, numbers, arrows, gauges).
//
// Skaldra (Trial)                                         Skaldra (Extreme) = the Trial remixed, faster tells (x0.8)
//   P1 Thin Ice      : the lake CRACKS under you (stand    P1 cracks faster; Snowball + Rime Shadow together, two
//                      still = it breaks into freezing        snowballs, Icicle Clock with a counter-turning inner ring
//                      water); AVALANCHE BALL (a growing   P2 the mirrors shift every Prism; She Watches while the
//                      snowball bouncing off the rim);        snowball rolls (pre-position!); Prism + Icicle Clock
//                      RIME SHADOW (an ice copy of you     P3 Coil Lunges leave a second, delayed spike trail;
//                      walks your path 1.5 s behind);         Prism + Rime Shadow, Icicles + Snowball
//                      ICICLE CLOCK (numbered drops)       P4 ABSOLUTE ZERO (new, at 12%): her heart is exposed
//   P2 Hall of Mirrors: ice mirrors rise; PRISM BREATH        (+50% damage taken) while the safe circle shrinks to
//                      bounces off them (trace the line);     nothing in 45 s; icicles + shadows keep coming
//                      SHE WATCHES (red light / green light)
//   P3 Heart of Winter: CHILL builds on everyone, stand by the drifting braziers; COIL LUNGE from the rim
// Pyrrhex (Trial)                                         Pyrrhex (Extreme)
//   P1 Pressure      : VALVES build pressure (stand on the P1 two valves at once; Bombs + Arrhythmia together
//                      glowing one to bleed it or it blows P2 Gaze + Arteries together (stay stretched AND hidden)
//                      out); COUNTDOWN BOMBS (burst in     P3 rafts shrink in the flood; Flood + Arrhythmia
//                      number order, leave lava pools);    P4 HEART OF THE WORLD (new, at 12%): heartbeat rings race
//                      ARRHYTHMIA (dodge-roll exactly on      outward ever faster (walk through the gap or dodge);
//                      each RED beat)                         a valve keeps building; 45 s before the caldera goes
//   P2 Cardiac Arrest: MAGMA GAZE (a 360° beam: hide behind an obsidian pillar); ARTERIES (blood tethers pull you in:
//                      keep them stretched, step aside when they SNAP)
//   P3 Meltdown      : OBSIDIAN RAIN (dodge the meteors, then stand on the craters they leave while the floor floods)
// Unlocks: the Trial opens after that zone's world boss (Skaldra / Pyrrhex) or its dungeon (Glacier Crypt / Forge of
// Cinders); the Extreme after the Trial is cleared (keys skt / skx / skxc, pyt / pyx / pyxc; sim/hub.js missions).
// Pure sim code, authoritative only; the whole encounter lives in `sim.trial` (packed for co-op, drawn by client/trialfx.js).
import { hits, segDist, posTele } from './telegraph.js';
import { encHpA, astralEnr } from './astral.js';
import { secs, SPAWN_POS } from './constants.js';
import { TRIAL_POS, TRIAL_R, TRIAL_NAMES, TRIAL_EXIT_DY, inTrialArea, trialAt } from './trialconst.js';
import { damagePlayer, spawnProjectile, respawnPlayer, killPlayer, killEnemy, healPlayer } from './combat.js';
import { spawnEnemy } from './ai.js';
import { ENEMIES } from './data/enemies.js';
import { SAVAGE, SAVAGE_REWARD, weekKey } from './savage.js';
import { makeExotic, EXOTIC_SLOTS } from './exotic.js';
import { withLootLevel } from './loot.js';
import { NEF, NEF_FIGHT, NEF_NAMES, NEF_LINES, NEF_LINES_S, NEF_LINES_E, nefMechs } from './neferakh.js';
import { vulnHit } from './savage.js';
import { SETPIECE, startSetpiece, startCine, clearSetpieces } from './setpiece.js';

export { TRIAL_POS, TRIAL_R, inTrialArea, trialAt };
if (!ENEMIES.trskaldra) Object.assign(ENEMIES, {
  trskaldra: { name: 'Skaldra (Trial)', zone: 4, hp: 100000, dmg: 40, spd: 0, r: 76, xp: 14000, def: 40, ai: 'raid', mass: 99, boss: true, raid: true, color: '#7fd0ff' },
  trskaldrax: { name: 'Skaldra (Extreme)', zone: 4, hp: 100000, dmg: 44, spd: 0, r: 80, xp: 18000, def: 44, ai: 'raid', mass: 99, boss: true, raid: true, color: '#a98cff' },
  trpyrrhex: { name: 'Pyrrhex (Trial)', zone: 4, hp: 100000, dmg: 40, spd: 0, r: 80, xp: 14000, def: 40, ai: 'raid', mass: 99, boss: true, raid: true, color: '#ff5a24' },
  trpyrrhexx: { name: 'Pyrrhex (Extreme)', zone: 4, hp: 100000, dmg: 44, spd: 0, r: 84, xp: 18000, def: 44, ai: 'raid', mass: 99, boss: true, raid: true, color: '#ff2a6a' },
});
if (!ENEMIES.trneferakh) Object.assign(ENEMIES, { // game loop A2: Neferakh Unbound (the Tomb's king, unsealed)
  trneferakh: { name: 'Neferakh Unbound (Trial)', zone: 4, hp: 100000, dmg: 40, spd: 0, r: 70, xp: 14000, def: 40, ai: 'raid', mass: 99, boss: true, raid: true, color: '#ffcf4a' },
  trneferakhx: { name: 'Neferakh Unbound (Extreme)', zone: 4, hp: 100000, dmg: 44, spd: 0, r: 74, xp: 18000, def: 44, ai: 'raid', mass: 99, boss: true, raid: true, color: '#b07cff' },
  trneferakhs: { name: 'Neferakh Unbound (Savage)', zone: 4, hp: 100000, dmg: 46, spd: 0, r: 76, xp: 24000, def: 46, ai: 'raid', mass: 99, boss: true, raid: true, color: '#ff6a3d' }, // (Part 1S)
});

const TAU = Math.PI * 2, R = TRIAL_R;
const r0 = (v) => Math.round(v), r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
/** Tuning (damage = % of max HP; `raw` mechanics ignore dodge i-frames: the answer is positioning, not a roll). */
export const TR = {
  pull: secs(6), repull: secs(5), wipe: secs(7), trans: secs(3), kill: secs(5), enrageCine: secs(4), gap: 80, gapX: 55,
  hp: { base: 200000, k: { sk: 6.06, py: 8.1, nf: 3.81 }, x: { sk: 1.21, py: 1.0, nf: 1.15 }, s: { nf: 0.75 }, /* (Savage: the Extreme's base; its length fit is ASTRAL_LEN.nfs) */ /* (game loop B: no invulnerability any more; HP raised to keep the lengths: Skaldra x1.10 / Extreme x1.07, Pyrrhex x1.027 / x1.008) */ /* (game loop A2: Neferakh is the first trial, tuned for Dunes / Tomb gear (L15 t4) to 5-7 min) */ /* (DPS-UP pass: 9 classes buffed toward the Bard, class-average DPS x1.65: HP k 3.85/5.39 -> 5.5/7.89, x 1.164/1.018 -> 1.245/1.02, typical ~5.2-6 min) */ /* (no-immunity pass: Trials +10% HP, Extremes unchanged) */ mult: [1, 2, 2.95, 3.9, 4.7, 5.5] }, // (encounter pass: ~5-6 min Trials / 6-7 min Extremes for a typical player; party HP ~= players x solo so a 4-party lands in the same window) // (balance pass: party scaling 2.4/4.4/6.4 -> 2.1/3.7/5.2: a 4-party took 1.6x the solo time vs the enrage)
  enrage: { n: secs(735), x: secs(700) }, check: secs(100), /* (DPS-UP pass: enrage 540/570 -> 735/700 s and the Extreme final-phase check 60 -> 100 s: the Bard was not buffed, so a solo Bard (the weakest class) keeps >= 60 s of margin) */ revive: 0.5, phaseHeal: 0.3,
  ice: { G: 14, cell: 80, crack: 60, crackX: 45, water: secs(10), pct: 0.07 },
  chill: { rate: 4.5, rateX: 6, warm: 24, fire: 95, life: 720, lifeX: 560, warn: 180, pct: 0.55 },
  valve: { fill: 600, fillX: 480, bleed: 0.6, r: 75, pct: 0.35, cd: 150 },
  heat: { rate: 4.2, rateX: 5.6, cool: 26, r: 105, pct: 0.45, spin: 0.0016, spinX: 0.0024 },
  light: { r0: 200, r1: 120, rS: 230, sp: 1.15, pct: 0.07 },
};
export const MISSION_TRIALS = { skaldrat: ['sk', 0], skaldrax: ['sk', 1], pyrrhext: ['py', 0], pyrrhexx: ['py', 1], neferakht: ['nf', 0], neferakhx: ['nf', 1], neferakhs: ['nf', 2] }; // (x: 0 Trial, 1 Extreme, 2 Savage - sim/savage.js)
export const TRIAL_KEYS = { sk: { open: 'skt', clear: 'skx', clearX: 'skxc' }, py: { open: 'pyt', clear: 'pyx', clearX: 'pyxc' }, nf: { open: 'nft', clear: 'nfx', clearX: 'nfxc', clearS: 'nfsc' } };
/** The fights: phases (floor = the HP gate; rot = the mechanic rotation, 'a+b' = both at once; aura = a phase-long rule). */
export const FIGHTS = {
  sk: {
    name: 'Skaldra (Trial)', nameX: 'Skaldra (Extreme)', short: 'SKALDRA', boss: 'trskaldra', bossX: 'trskaldrax', col: '#bfeaff', colX: '#cdb4ff',
    enrage: ['ABSOLUTE ZERO', 'The lake freezes solid · everything stops'],
    n: [
      { name: 'Thin Ice', sub: 'The lake cracks under your feet · keep moving', floor: 0.66, aura: 'ice', rot: ['snowball', 'rimeshadow', 'icicles', 'breath', 'snowball', 'icicles'] },
      { name: 'Hall of Mirrors', sub: 'Ice mirrors rise · her breath bounces off them', floor: 0.33, aura: 'walls', rot: ['prism', 'watch', 'prism', 'snowball', 'watch', 'icicles'] },
      { name: 'Heart of Winter', sub: 'The cold creeps in · stay near the braziers', floor: 0, aura: 'chill', rot: ['coil', 'prism', 'icicles', 'coil', 'rimeshadow', 'watch'] },
    ],
    x: [
      { name: 'Thin Ice', sub: 'The lake cracks faster · keep moving', floor: 0.66, aura: 'ice', rot: ['snowball+rimeshadow', 'icicles', 'breath+rimeshadow', 'snowball', 'icicles+frostbite'] },
      { name: 'Hall of Mirrors', sub: 'The mirrors shift with every breath', floor: 0.33, aura: 'walls', rot: ['prism', 'watch+snowball', 'prism+icicles', 'watch'] },
      { name: 'Heart of Winter', sub: 'The cold bites harder · braziers gutter faster', floor: 0.18, aura: 'chill', rot: ['coil', 'prism+rimeshadow', 'icicles+snowball', 'coil+frostbite', 'watch'] },
      { name: 'Absolute Zero', sub: 'Her heart is exposed · the cold closes in · 100 seconds', floor: 0, aura: 'zero', rot: ['icicles', 'frostbite', 'icicles+rimeshadow'] },
    ],
  },
  py: {
    name: 'Pyrrhex (Trial)', nameX: 'Pyrrhex (Extreme)', short: 'PYRRHEX', boss: 'trpyrrhex', bossX: 'trpyrrhexx', col: '#ffc08a', colX: '#ff8ab0',
    enrage: ['CALDERA COLLAPSE', 'The heart bursts · the chamber drowns in magma'],
    n: [
      { name: 'Pressure', sub: 'Vents build pressure · stand on the glowing valve to bleed it', floor: 0.66, aura: 'valves', rot: ['bombs', 'arrhythmia', 'fists', 'bombs', 'fan', 'arrhythmia'] },
      { name: 'Cardiac Arrest', sub: 'Obsidian rises · his gaze burns all it sees', floor: 0.33, aura: null, rot: ['gaze', 'arteries', 'bombs', 'gaze', 'arteries', 'fists'] },
      { name: 'Meltdown', sub: 'The chamber floods · the meteors cool into rafts', floor: 0, aura: null, rot: ['flood', 'arrhythmia', 'gaze', 'flood', 'bombs', 'arteries'] },
    ],
    x: [
      { name: 'Pressure', sub: 'Two valves build at once', floor: 0.66, aura: 'valves', rot: ['bombs+arrhythmia', 'fists', 'bombs+fan', 'arrhythmia'] },
      { name: 'Cardiac Arrest', sub: 'Stay stretched AND hidden', floor: 0.33, aura: null, rot: ['gaze+arteries', 'bombs', 'gaze+fan', 'arteries+bombs'] },
      { name: 'Meltdown', sub: 'The rafts crumble in the flood', floor: 0.12, aura: null, rot: ['flood', 'arrhythmia+bombs', 'gaze', 'flood+arrhythmia'] },
      { name: 'Heart of the World', sub: 'The heartbeat races · slip through the gaps · 100 seconds', floor: 0, aura: 'heart', rot: ['bombs', 'fists', 'bombs+fan'] },
    ],
  },
  nf: { // game loop A2: Neferakh Unbound (the Tomb of the Sun-Eaten King's boss, unsealed)
    name: 'Neferakh Unbound (Trial)', nameX: 'Neferakh Unbound (Extreme)', short: 'NEFERAKH', boss: 'trneferakh', bossX: 'trneferakhx', col: '#ffe08a', colX: '#c9a2ff', nameS: 'Neferakh Unbound (Savage)', bossS: 'trneferakhs', colS: '#ff8a5a',
    enrage: ['ENDLESS NOON', 'The sun swallows the throne'], enr: { n: secs(870), x: secs(960), s: secs(990) }, // (revamp Part 1: 8-10 / 8-12 min fights, the weakest typical still kills; the Extreme's Black Sun runs late: a Bard at Dunes gear keeps >= 60 s)
    n: NEF_FIGHT.n, x: NEF_FIGHT.x, s: NEF_FIGHT.s, e: NEF_FIGHT.e, nameE: 'Neferakh, Eclipse Ascendant (Savage)', // (Savage v2: e = the transformed fight) // (encounter revamp Part 1: sim/neferakh.js)
  },
};
export const MECH_NAMES = { snowball: 'Avalanche Ball', rimeshadow: 'Rime Shadow', icicles: 'Icicle Clock', breath: 'Frost Breath', frostbite: 'Frostbite', prism: 'Prism Breath', watch: 'She Watches', coil: 'Coil Lunge',
  bombs: 'Countdown Bombs', arrhythmia: 'Arrhythmia', fists: 'Magma Fists', fan: 'Ember Fan', gaze: 'Magma Gaze', arteries: 'Arteries', flood: 'Obsidian Rain',
  ...NEF_NAMES, sunbearer: 'Sunbearer' };
export const fightOf = (T) => FIGHTS[T.k];
export const phasesOf = (T) => (T.sv ? (T.form && FIGHTS[T.k].e ? FIGHTS[T.k].e : FIGHTS[T.k].s) : T.x ? FIGHTS[T.k].x : FIGHTS[T.k].n);
export const trialName = (T) => (T.sv ? (T.form && FIGHTS[T.k].nameE ? FIGHTS[T.k].nameE : FIGHTS[T.k].nameS) : T.x ? FIGHTS[T.k].nameX : FIGHTS[T.k].name);
/** the mode level: 0 Trial, 1 Extreme, 2 Savage */
export const trialLv = (T) => (T ? (T.sv ? 2 : T.x ? 1 : 0) : -1);
const colOf = (T) => (T.sv ? (T.form ? '#ff5a7a' : fightOf(T).colS) : T.x ? fightOf(T).colX : fightOf(T).col);
const tk = (T, v) => Math.max(1, Math.round(v * (T.x ? 0.8 : 1))); // Extreme: faster telegraphs
const rnd = (sim) => sim.rng.next();
const CEN = (T) => TRIAL_POS[T.k];
const bossOf = (sim) => sim.trial && sim.enemyById.get(sim.trial.bid);
const partyIn = (sim, T) => [...sim.players.values()].filter((p) => T.party.includes(p.id) && trialAt(p.x, p.y) === T.k);
const aliveIn = (sim, T) => partyIn(sim, T).filter((p) => !p.dead);
const pick = (sim, arr) => arr[Math.floor(rnd(sim) * arr.length)];
const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ------------------------------------------------------------------ entry / exit
/** Teleport a player into a trial arena (k = 'sk' | 'py', x = Extreme). Starts the encounter if none fits. */
export function enterTrial(sim, p, k = 'sk', x = 0) {
  if (sim.predicting || !p || p.dead || !FIGHTS[k]) return false;
  x = x === 2 && FIGHTS[k].s ? 2 : x ? 1 : 0;
  const T0 = sim.trial, empty = T0 && !T0.party.some((id) => { const q = sim.players.get(id); return q && q !== p && trialAt(q.x, q.y) === T0.k; });
  if (!T0 || (empty && (T0.st === 'victory' || T0.k !== k || trialLv(T0) !== x))) startTrial(sim, k, x);
  const T = sim.trial;
  if (!T.party.includes(p.id)) T.party.push(p.id);
  placeStart(T, p, T.party.indexOf(p.id));
  sim.emit({ type: 'trial', ph: 'enter', k: T.k, pid: p.id, x: r0(p.x), y: r0(p.y) });
  return true;
}
function placeStart(T, p, i) { const C = CEN(T); p.x = p.px = C.x + ((i % 5) - 2) * 36; p.y = p.py = C.y + R - 90 - Math.floor(i / 5) * 34; p.vx = p.vy = 0; p.iframes = Math.max(p.iframes || 0, 60); p.action = null; p.trHold = 0; }
export function leaveTrial(sim, p) {
  if (!p || !inTrialArea(p.x, p.y)) return false;
  p.x = p.px = SPAWN_POS.x; p.y = p.py = SPAWN_POS.y + 40; p.vx = p.vy = 0; p.trHold = 0;
  const T = sim.trial; if (T) T.party = T.party.filter((id) => id !== p.id);
  return true;
}
function freshState(k, x, prev) {
  const C = TRIAL_POS[k];
  const sv = x === 2 ? 1 : 0; x = x ? 1 : 0;
  return { k, x, sv, hub: 0, st: 'pull', at: 0, t: 0, ph: 0, bid: 0, n: 1, party: prev ? prev.party : [], call: null, line: null, tele: [], tid: 1, mechs: [], ri: 0, cd: 0, gate: 0, shield: 1,
    o: {}, trail: {}, hits: {}, enr: sv && FIGHTS[k].enr && FIGHTS[k].enr.s ? FIGHTS[k].enr.s : x ? (FIGHTS[k].enr ? FIGHTS[k].enr.x : TR.enrage.x) : (FIGHTS[k].enr ? FIGHTS[k].enr.n : TR.enrage.n), chk: null, dive: 0, bx: C.x, by: C.y, dead1: 0, empty: 0, prog: 0, kx: 0, ky: 0,
    wipes: prev ? prev.wipes : 0, best: prev ? prev.best : 0, lastWipe: prev ? prev.lastWipe : null, over: 0, pull: prev ? TR.repull : k === 'nf' ? NEF.pull : TR.pull }; // (Neferakh: the 9.1 s music-synced intro on the first pull)
}
function startTrial(sim, k, x, prev = null) {
  for (const e of sim.enemies) if (/^tr(skaldra|pyrrhex|neferakh)/.test(e.type) && !e.dead) { e.dead = true; e.hp = 0; }
  const T = sim.trial = freshState(k, x, prev), F = FIGHTS[k], C = CEN(T);
  T.hub = sim.hub ? 1 : 0;
  const b = spawnEnemy(sim, T.sv ? F.bossS : x ? F.bossX : F.boss, C.x, C.y - 40, T.sv ? { noAb: 1 } : undefined); // (Savage: the fight IS the Astral content - no Astral boss layer on top, no pseudo-difficulty)
  b.cd = 1e6; b.raidHold = 1e6; b.face = Math.PI / 2; b.dropChance = 1; b.invuln = 1e6; if (x) b.ex = 1; if (T.sv) b.sv = 1; if (T.sv && F.e) b.noDie = 1; // (Savage v2: the door boss transforms instead of dying)
  T.bid = b.id; T.bx = b.x; T.by = b.y;
  if (!(k === 'nf' && !prev)) card(sim, T, trialName(T).toUpperCase(), prev ? `Attempt ${T.wipes + 1} · ${TRIAL_NAMES[k]}` : T.sv ? 'SAVAGE · strict solves (a 2nd Vuln stack is a KO) · a new final phase' : x ? 'Faster tells, combined mechanics, a new final phase' : `${TRIAL_NAMES[k]} · break ${k === 'nf' ? 'his' : 'her'} phases with damage, beat the enrage`, colOf(T), T.pull);
  sim.emit({ type: 'trial', ph: 'pull', k, ex: x, sv: T.sv, x: C.x, y: C.y, t: T.pull });
  return T;
}
export function endTrialFor(sim, why) { if (sim.trial) endTrial(sim, why); }
function endTrial(sim, why) {
  const T = sim.trial; clearField(sim, T, true);
  sim.emit({ type: 'trial', ph: 'end', why, k: T.k, x: CEN(T).x, y: CEN(T).y });
  sim.trial = null;
}
function clearField(sim, T, boss = false) {
  if (boss) for (const e of sim.enemies) if (e.id === T.bid) { e.dead = true; e.hp = 0; }
  for (const pr of sim.projectiles) if (pr.trial) pr.dead = true;
  T.tele = []; T.mechs = []; T.o = {}; T.chk = null; T.dive = 0;
  if (T.k === 'nf') { clearSetpieces(sim, 'nf'); T.spRef = null; T.leap = 0; }
}
function card(sim, T, txt, sub, col, t = 150) { T.call = { txt, sub: sub || '', col: col || '#fff', t, d: t }; sim.emit({ type: 'trial', ph: 'call', k: T.k, txt, sub: sub || '', col: col || '#fff', x: CEN(T).x, y: CEN(T).y }); }
function say(sim, T, txt, t = 220) { T.line = { txt, t, d: t }; }
const ev = (sim, T, ph, o = {}) => sim.emit({ type: 'trial', ph, k: T.k, x: CEN(T).x, y: CEN(T).y, ...o });

// ------------------------------------------------------------------ per tick
export function updateTrial(sim) {
  if (sim.predicting) return;
  const T = sim.trial;
  if (!T) return;
  if (T.call && --T.call.t <= 0) T.call = null;
  if (T.line && --T.line.t <= 0) T.line = null;
  T.party = T.party.filter((id) => sim.players.has(id));
  const present = partyIn(sim, T), here = present.filter((p) => !p.dead), C = CEN(T);
  if (!present.length) { if (++T.empty > 120) endTrial(sim, 'abandon'); return; }
  T.empty = 0;
  if (T.st !== 'victory') for (const p of present) if (p.dead) { p.respawnAt = sim.tick + 30; p.trHold = 1; } // the fallen wait (revived at the next phase / the retry)
  for (const p of here) { const tr = T.trail[p.id] || (T.trail[p.id] = []); tr.push(r0(p.x), r0(p.y)); if (tr.length > 280) tr.splice(0, tr.length - 280); }
  const b = bossOf(sim);
  if (T.st === 'victory') {
    T.at++;
    for (const p of here) if (Math.hypot(p.x - C.x, p.y - (C.y + TRIAL_EXIT_DY)) < 46) { if (sim.hub) T.over = 'clear'; else leaveTrial(sim, p); }
    return;
  }
  if (T.st === 'wipe') { if (++T.at >= TR.wipe) resetAfterWipe(sim, T, present); return; } // (wipe -> automatic retry; Return to Town leaves)
  if (!here.length) { if (++T.dead1 > 60) return wipe(sim, T, 'fallen'); } else T.dead1 = 0;
  if (!b && T.st !== 'kill') return wipe(sim, T, 'lost');
  if (b && b.dead && T.st !== 'kill') return startKill(sim, T, b);
  if (b && !b.dead) holdBoss(sim, T, b);
  T.at++;
  if (T.st !== 'pull' && T.st !== 'kill') T.t++;
  T.prog = progress(T, b);
  if ((T.st === 'fight' || T.st === 'trans' || T.st === 'set') && T.t >= T.enr) startEnrage(sim, T, 'enrage');
  switch (T.st) {
    case 'pull':
      for (const p of here) p.iframes = Math.max(p.iframes, 2);
      if (T.k === 'nf' && T.pull >= NEF.pull) { const a = T.at - 1, n = Math.floor(a / NEF.bar); if (a === Math.ceil(n * NEF.bar) && n < 5) ev(sim, T, 'intro', { n: n + 1 }); } // (the intro's bar beats: seal, sand, the sun eaten, he rises, title)
      if (T.at >= T.pull && b) {
        T.n = Math.max(1, here.length);
        const hp = Math.round(TR.hp.base * (TR.hp.k[T.k] || 1) * (T.sv ? TR.hp.s[T.k] || TR.hp.x[T.k] || 1 : T.x ? TR.hp.x[T.k] || 1 : 1) * encHpA(sim, T.k, T.k + (T.sv ? 's' : T.x ? 'x' : 't')) * TR.hp.mult[Math.min(6, T.n) - 1]); // (game loop C2: encHpK = the band the Trial sits in now)
        b.maxHp = b.hp = hp; b.baseMaxHp = hp;
        ev(sim, T, 'start', { n: T.n, hp, ex: T.x });
        if (T.pendEcl) startEclipse(sim, T, b, 1); // (Savage v2 checkpoint: a wipe in the Eclipse fight retries from the transformation)
        else startPhase(sim, T, 1, here);
      }
      break;
    case 'fight': runPhase(sim, T, b, here); break;
    case 'trans':
      for (const p of here) p.iframes = Math.max(p.iframes, 2);
      if (T.leap && T.at === T.leap) { const C2 = CEN(T); T.bx = C2.x; T.by = C2.y - 40; ev(sim, T, 'land'); } // (the Sky Turns: he lands back on the throne)
      if (T.at >= (T.transD || TR.trans)) startPhase(sim, T, T.ph + 1, here);
      break;
    case 'set': setTick(sim, T, b, here); break;
    case 'eclipse': eclTick(sim, T, b, here); break;
    case 'enrage':
      for (const p of here) p.iframes = 0;
      if (T.at === TR.enrageCine) { for (const p of here) killPlayer(sim, p, `${fightOf(T).short}'s ${T.why === 'enrage' ? fightOf(T).enrage[0].toLowerCase() : 'final heartbeat'}`); ev(sim, T, 'enrageHit', { why: T.why }); }
      if (T.at >= TR.enrageCine + 20) return wipe(sim, T, T.why);
      break;
    case 'kill': if (T.at >= TR.kill) victory(sim, T); break;
  }
  tickTele(sim, T, here);
}
function holdBoss(sim, T, b) {
  b.raidHold = 1e6; b.cd = 1e6; b.vx = b.vy = 0;
  const dx = T.bx - b.x, dy = T.by - b.y, d = Math.hypot(dx, dy), st = T.dive ? 40 : 6;
  if (d > st) { b.x += dx / d * st; b.y += dy / d * st; } else { b.x = T.bx; b.y = T.by; }
  const ph = phasesOf(T)[T.ph - 1], fl = ph ? ph.floor : 1;
  T.shield = 0; b.vuln = 0;
  // (game loop B fix: no invulnerability at all once the fight starts: not at an HP floor, not through the phase change,
  //  not under the ice. Damage past a floor carries on into the next phase; the fight's length comes from HP.)
  if (T.st === 'pull' || T.st === 'kill' || T.st === 'enrage' || T.st === 'wipe' || T.st === 'eclipse') { b.invuln = 3; T.shield = 1; }
  else { b.invuln = 0; if (T.gate || T.st === 'trans') T.shield = 2; }
  void fl;
  if (ph && (ph.aura === 'zero' || ph.aura === 'blacksun') && T.st === 'fight') { b.vuln = 3; b.vulnMul = 1.5; } // Absolute Zero: the exposed heart
  else if (T.o.struck && T.o.struck.t > 0 && T.st === 'fight') { b.vuln = 3; b.vulnMul = NEF.struck.mul; } // (Neferakh: SUN-STRUCK after the Sunbearer)
}
/** 0..1 through the fight by HP (for the HUD and the wipe screen). */
export function progress(T, b) { if (T.st === 'kill' || T.st === 'victory') return 1; if (!b || !b.maxHp || T.st === 'pull') return 0; return Math.max(0, Math.min(1, 1 - b.hp / b.maxHp)); }
function startPhase(sim, T, n, here) {
  const PH = phasesOf(T), ph = PH[n - 1], C = CEN(T);
  if (!ph) return;
  T.st = 'fight'; T.at = 0; T.ph = n; T.gate = 0; T.mechs = []; T.ri = 0; T.cd = 70; T.chk = null; T.dive = 0; T.bx = C.x; T.by = C.y - 40;
  T.o = {}; T.gh = {}; // (phase auras start fresh)
  reviveFallen(sim, T);
  if (n > 1) for (const p of aliveIn(sim, T)) healPlayer(sim, p, p.stats.maxHp * TR.phaseHeal, p); // (encounter pass: a breather between the longer phases)
  if (ph.aura) AURA[ph.aura].start(sim, T, here);
  if ((ph.aura === 'zero' || ph.aura === 'heart' || ph.aura === 'blacksun') && !(T.sv && ph.floor > 0)) T.chk = { t: 0, d: astralEnr(sim, TR.check) }; // (C2: the Astral final-phase check runs 20% longer at Astral HP)
  card(sim, T, T.form ? `ECLIPSE ${n} · ${ph.name.toUpperCase()}` : `PHASE ${n} · ${ph.name.toUpperCase()}`, ph.sub, colOf(T), 170);
  ev(sim, T, 'phase', { n, ex: T.x, aura: ph.aura || '', form: T.form || 0, nA: T.form ? phasesOf({ ...T, form: 0 }).length : 0 });
  const L = { sk: ['', 'Skate on, little sparks. The ice remembers every step.', 'Look into the mirrors. Which of you is real?', 'Winter has a heart. Come close and feel it stop.', 'Then freeze with me.'],
    py: ['', 'Feel the pressure? That is my pulse.', 'Hide, then. Obsidian is only my scar tissue.', 'The chamber floods. Swim, if you can.', 'Hear it? The heart of the world. It beats for no one.'],
    nf: T.sv ? (T.form ? NEF_LINES_E : NEF_LINES_S) : NEF_LINES }[T.k];
  if (L[n]) say(sim, T, L[n]);
}
function runPhase(sim, T, b, here) {
  const ph = phasesOf(T)[T.ph - 1];
  if (ph.aura) AURA[ph.aura].tick(sim, T, here, b);
  if (T.o.struck && T.o.struck.t > 0) T.o.struck.t--;
  common(sim, T, here);
  if (T.chk) { T.chk.t++; if (T.chk.t % 60 === 0) ev(sim, T, 'count', { n: Math.ceil((T.chk.d - T.chk.t) / 60) }); if (T.chk.t >= T.chk.d) return startEnrage(sim, T, ph.aura); }
  for (const m of T.mechs) { m.t++; MECH[m.id].tick(sim, T, m, here, b); }
  for (const m of T.mechs) if (m.t >= m.d && MECH[m.id].end) MECH[m.id].end(sim, T, m, here, b);
  T.mechs = T.mechs.filter((m) => m.t < m.d);
  if (T.sv && !T.form && fightOf(T).e && ph.floor === 0 && b && (b.downed || b.hp <= 1.5)) return startEclipse(sim, T, b, 0); // (the door boss falls: he transforms)
  if (!T.gate && ph.floor > 0 && b && b.hp <= Math.ceil(b.maxHp * ph.floor) + 0.5) { /* (no-immunity pass: burst breaks a phase as soon as its HP floor is reached; HP sets the pace) */ T.gate = 1; ev(sim, T, 'gate', { n: T.ph }); card(sim, T, 'PHASE BROKEN', 'What is on the field resolves, then she moves on', '#fff2b0', 110); }
  const pending = T.tele.some((t) => !t.done);
  if (T.gate) { if (!T.mechs.length && !pending) startTrans(sim, T); return; }
  if (T.mechs.length) return;
  if (--T.cd > 0) return;
  const ids = ph.rot[T.ri++ % ph.rot.length].split('+');
  for (const id of ids) startMech(sim, T, id, here, b);
  T.cd = T.x ? TR.gapX : TR.gap;
}
function startTrans(sim, T) {
  T.st = 'trans'; T.at = 0; T.mechs = []; T.tele = []; T.dive = 0; T.transD = TR.trans; T.leap = 0;
  for (const pr of sim.projectiles) if (pr.trial) pr.dead = true;
  ev(sim, T, 'trans', { n: T.ph });
  if (T.k === 'nf') nefTrans(sim, T);
}
/** Neferakh's phase changes are cinematic moments (gameplay: tells stop, the fight goes on): the Sky Turns, the Sunbearer, the Black Sun */
function nefTrans(sim, T) {
  const C = CEN(T), b = bossOf(sim), ex = T.sv ? (phasesOf(T)[T.ph - 1] || {}).exit : T.ph === 1 ? 'sky' : T.ph === 2 ? 'sun' : T.ph === 3 && T.x ? 'black' : null;
  if (ex === 'verdict') { // (Savage) THE VERDICT: the black sun rises behind him as a court; he names the sentence (the final-phase cinematic)
    T.transD = NEF.verdictCine; T.leap = NEF.verdictCine >> 1; T.bx = C.x; T.by = C.y - R * 0.5; T.dive = 1;
    startCine(sim, { kind: 'transition', stage: 'verdict', x: C.x, y: C.y - 60, dur: NEF.verdictCine, enc: 'nf' });
    if (T.form) { card(sim, T, 'THE ECLIPSE COURT', 'The last sentence · every colour inverted', '#ff5a7a', 200); say(sim, T, 'Eclipse. Every answer you knew is now a lie.', 240); }
    else { card(sim, T, 'THE COURT OF THE BLACK SUN', 'Kneel · the last phase · the music turns', '#ff7a4a', 200); say(sim, T, 'Kneel. The court of the black sun is in session.', 240); }
    ev(sim, T, 'court');
    return;
  }
  if (ex === 'sky') { // THE SKY TURNS: he leaps to the north rim, the sky flips at the midpoint, he lands back on the throne (a respite + the phase heal)
    T.transD = NEF.skyTurn; T.leap = NEF.skyTurn >> 1; T.bx = C.x; T.by = C.y - R * 0.72; T.dive = 1;
    startCine(sim, { kind: 'transition', stage: 'night', x: C.x, y: C.y - 60, dur: NEF.skyTurn, enc: 'nf' });
    card(sim, T, 'THE SKY TURNS', 'Day becomes night · catch your breath', '#c9b4ff', 150); say(sim, T, 'Day. Night. Day. I decide which, little mortals.');
  } else if (ex === 'sun') startSunbearer(sim, T, b);
  else if (ex === 'black') { // THE BLACK SUN: the light goes out
    T.transD = NEF.blackout;
    startCine(sim, { kind: 'transition', stage: 'blacksun', x: C.x, y: C.y - 40, dur: NEF.blackout, enc: 'nf' });
    card(sim, T, 'THE SUN GOES OUT', 'Find the last light', '#c9a2ff', 150);
  }
}
/** Savage v2: THE ECLIPSE ASCENDANT - the door boss falls and transforms (full: 14 s, eight beats; short: 3 s on a checkpoint retry,
 *  skippable). The party is frozen and safe; the field clears. At the end: the new form, a full new HP pool, his own enrage. */
function startEclipse(sim, T, b, short) {
  clearField(sim, T); const C = CEN(T), E = NEF.ecl;
  T.st = 'eclipse'; T.at = 0; T.eShort = short ? 1 : 0; T.transD = short ? E.short : E.full; T.ph = 0; T.gate = 0; T.bx = C.x; T.by = C.y - 40; T.dive = 0;
  T.frz = {}; for (const p of aliveIn(sim, T)) { T.frz[p.id] = { x: p.x, y: p.y }; p.action = null; }
  if (b) { b.downed = 0; b.hp = Math.max(1, b.hp); }
  startCine(sim, { kind: 'transition', stage: 'eclipse', x: C.x, y: C.y - 60, dur: T.transD, enc: 'nf' });
  ev(sim, T, 'eclipse0', { short: T.eShort, d: T.transD });
}
function eclTick(sim, T, b, here) {
  const E = NEF.ecl, beats = T.eShort ? E.beatsShort : E.beats, n = beats.indexOf(T.at - 1);
  for (const p of here) { p.iframes = Math.max(p.iframes, 2); const f = T.frz && T.frz[p.id]; if (f) { p.x = p.px = f.x; p.y = p.py = f.y; p.vx = p.vy = 0; } }
  if (n >= 0) ev(sim, T, 'eclbeat', { n: n + 1, of: beats.length, short: T.eShort });
  if (T.at - 1 === (T.eShort ? 80 : 570)) { card(sim, T, 'NEFERAKH, ECLIPSE ASCENDANT', 'SAVAGE · everything you learned is inverted', '#ff5a7a', T.eShort ? 100 : 200); say(sim, T, 'You judged a shadow. Now face the eclipse.', 240); }
  if (T.at < T.transD) return;
  T.form = 1; T.frz = null; T.tA = (T.tA || 0) + T.t; T.t = 0; T.enr = fightOf(T).enr.s; // (his own enrage clock)
  if (b) { const hp = Math.round(b.maxHp * E.hpK); b.maxHp = b.hp = hp; b.baseMaxHp = hp; b.noDie = 0; b.ecl = 1; b.name = 'Neferakh, Eclipse Ascendant (Savage)'; ev(sim, T, 'start', { n: T.n, hp, ex: T.x, form: 1 }); }
  for (const p of aliveIn(sim, T)) { p.hp = p.stats.maxHp; }
  startPhase(sim, T, 1, aliveIn(sim, T));
}
/** the short transformation is skippable (any hero in the fight) */
export function eclipseSkip(sim, p) { const T = sim.trial; if (!T || T.st !== 'eclipse' || !T.eShort || !T.party.includes(p.id)) return; T.at = Math.max(T.at, T.transD - 1); }
/** SUNBEARER (33%): the sun falls on one side of the throne, the Sun Altar waits on the other, two Sand Wardens flank the route */
function startSunbearer(sim, T, b) {
  const C = CEN(T), heroes = aliveIn(sim, T).filter((p) => !p.decoy);
  for (const p of heroes) p.action = null; // (the sun falls: the cinematic beat interrupts what you were doing, so a skill that is still carrying you can't make the catch unreachable)
  const at = (ang, k) => ({ x: r0(C.x + Math.cos(ang) * R * k), y: r0(C.y + Math.sin(ang) * R * k) });
  // (the catch must be reachable: some hero walks into the catch circle within ~70% of the tell at a slow melee pace - never a random far-side drop)
  const reach = 140 * (SETPIECE.carry.tell / 60) * 0.7 + SETPIECE.carry.catchR, near = (ang) => { const l = at(ang, 0.5); return heroes.reduce((m, p) => Math.min(m, Math.hypot(p.x - l.x, p.y - l.y)), 1e9); };
  let a = rnd(sim) * TAU; for (let i = 0; i < 16 && near(a) > reach; i++) a = rnd(sim) * TAU;
  if (near(a) > reach && heroes.length) { const p = heroes[0]; a = Math.atan2(p.y - C.y, p.x - C.x); }
  const land = at(a, 0.5), goal = at(a + Math.PI, 0.72);
  T.st = 'set'; T.at = 0; T.setEnd = null;
  { const off = at(a + Math.PI / 2 + 0.55, 0.84); T.bx = off.x; T.by = off.y; T.dive = 1; } // (he steps off the road to watch: the route stays readable; he walks back to the throne when it ends)
  const sp = startSetpiece(sim, { kind: 'carry', skin: 'sun', enc: 'nf', players: heroes, x: land.x, y: land.y, gx: goal.x, gy: goal.y, wardens: [at(a + Math.PI / 2, 0.62), at(a - Math.PI / 2, 0.62)], life: T.sv ? NEF.sunLifeS : T.x ? 870 : 960, by: 'the Fallen Sun' });
  T.spId = sp ? sp.id : 0; T.spRef = sp;
  card(sim, T, 'THE SUN FALLS', 'Catch it · carry it to the altar · break the Sand Wardens', '#ffe08a', 170); say(sim, T, 'Take it, then. Carry the sun, little mortal. It weighs what I weigh.');
  ev(sim, T, 'sunfall', { x: land.x, y: land.y, gx: goal.x, gy: goal.y });
}
/** the 'set' state: the set piece runs (sim/setpiece.js); its result decides the next step */
function setTick(sim, T, b, here) {
  const sp = T.spRef;
  if (!sp) { startPhase(sim, T, T.ph + 1, here); return; }
  if (!sp.done) { if (!here.some((p) => !p.decoy)) { clearSetpieces(sim, 'nf'); T.spRef = null; } return; } // (decoy-only runs - the length tools: no bearer, it just passes)
  if (sp.ph === 'win') {
    T.spRef = null; startPhase(sim, T, T.ph + 1, here);
    T.o.struck = { t: NEF.struck.t, d: NEF.struck.t }; T.cd = 150;
    card(sim, T, 'SUN-STRUCK', 'The sky burns again · he takes +25% damage for 8 s', '#fff2a0', 170); say(sim, T, 'No... NO! My light!');
    ev(sim, T, 'struck');
    return;
  }
  if (sp.ph === 'fail') { if (T.setEnd == null) T.setEnd = T.at; if (T.at - T.setEnd >= 40) wipe(sim, T, 'sunburst'); return; }
  // 'gone': everyone fell - the fallen wipe takes it
}
export function startMech(sim, T, id, here, b) {
  const m = { id, t: 0, d: 120 };
  T.mechs.push(m);
  MECH[id].start(sim, T, m, here, b || bossOf(sim));
  return m;
}
function reviveFallen(sim, T) {
  const C = CEN(T);
  for (const p of partyIn(sim, T)) if (p.dead) {
    respawnPlayer(sim, p);
    p.x = p.px = C.x + (rnd(sim) - 0.5) * 120; p.y = p.py = C.y + R * 0.6; p.hp = Math.round(p.stats.maxHp * TR.revive); p.trHold = 0;
    sim.emit({ type: 'trial', ph: 'revive', k: T.k, pid: p.id, x: r0(p.x), y: r0(p.y) });
  }
}
function startEnrage(sim, T, why) {
  const F = fightOf(T);
  T.mechs = []; T.tele = []; T.dive = 0; T.why = why; T.st = 'enrage'; T.at = 0;
  for (const pr of sim.projectiles) if (pr.trial) pr.dead = true;
  const txt = why === 'zero' ? ['ABSOLUTE ZERO', 'Her heart froze the world before you broke it'] : why === 'blacksun' ? ['THE BLACK SUN', 'The last light went out before he fell'] : why === 'heart' ? ['THE LAST HEARTBEAT', 'The heart of the world bursts'] : F.enrage;
  card(sim, T, txt[0], txt[1], '#ffffff', TR.enrageCine + 20);
  ev(sim, T, 'enrage', { why });
}

// ------------------------------------------------------------------ telegraphs + damage
/** A floor telegraph: sh = circle | donut | line | cone | path; it lands at t = d (pct > 0 = damage; safe = hits whoever
 *  is OUTSIDE it); then = what it leaves behind ('pool' | 'raft'); n = a number painted on it (the order). */
function tele(T, spec) { const t = { id: T.tid++, t: 0, ...spec }; T.tele.push(t); return t; }
function tickTele(sim, T, here) {
  for (const t of T.tele) {
    t.t++;
    if (t.done || t.t < t.d) continue;
    t.done = 1; sim.posCheck = posTele(t) ? 1 : 0;
    if (t.pct > 0) for (const p of here) if (teleHits(t, p) !== !!t.safe && !(t.grp && grpHit(T, t.grp, p))) { if (hurt(sim, T, p, t.pct, t.what || MECH_NAMES[t.k] || t.k, { x: t.x, y: t.y }, t.raw) && t.pos && !t.raw) svFail(sim, T, p, t.what || MECH_NAMES[t.k] || t.k); }
    if (t.then === 'pool') (T.o.pools || (T.o.pools = [])).push({ x: r0(t.x), y: r0(t.y), r: 85, life: tk(T, 240) });
    if (t.then === 'raft') (T.o.rafts || (T.o.rafts = [])).push({ x: r0(t.x), y: r0(t.y), r: 100, r1: 100 });
    if (!t.quiet) sim.emit({ type: 'trial', ph: 'boom', k: T.k, tk: t.k, sh: t.sh, x: r0(t.x), y: r0(t.y), r: r0(t.r || t.w || 60), n: t.n || 0 });
  }
  T.tele = T.tele.filter((t) => !t.done || t.t < t.d + 14);
  sim.posCheck = 0;
}
/** one hit per group per player (the scarab tide's lanes overlap at their edges) */
function grpHit(T, g, p) { const G = T.gh || (T.gh = {}), key = g + ':' + p.id; if (G[key]) return true; G[key] = 1; return false; }
export function teleHits(t, p) { return hits(t, p); } // (Part A1: the shared telegraph language, sim/telegraph.js)
export { segDist };
/** Savage: a failed strict solve = a Vuln stack (the 2nd is a KO). No-op outside Savage. */
function svFail(sim, T, p, what) { if (!T.sv || !p || p.dead || p.decoy) return; vulnHit(sim, p, `${fightOf(T).short}'s ${what}`, (q, by) => killPlayer(sim, q, by)); }
function hurt(sim, T, p, pct, what, src = null, raw = false) {
  if (!(pct > 0) || p.dead) return false;
  const ok = damagePlayer(sim, p, 0, src, { pct, raw: !!raw, by: `${fightOf(T).short}'s ${what}` });
  if (ok) { T.hits[what] = (T.hits[what] || 0) + 1; sim.emit({ type: 'trial', ph: 'hit', k: T.k, pid: p.id, what, x: r0(p.x), y: r0(p.y) }); }
  return ok;
}
function bullet(sim, T, b, x, y, ang, speed, life, pct, style) {
  const pr = spawnProjectile(sim, { team: 'enemy', ownerId: b.id, x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 11, life, dmg: 1, pct, style, color: null, kb: 60, by: `${fightOf(T).short}'s shards` });
  if (pr) pr.trial = 1;
  return pr;
}
const inDisc = (T, x, y, m = 0) => Math.hypot(x - CEN(T).x, y - CEN(T).y) <= R - m;
function clampIn(T, x, y, m) { const C = CEN(T), dx = x - C.x, dy = y - C.y, d = Math.hypot(dx, dy), k = R - m; return d <= k ? { x, y } : { x: C.x + dx / d * k, y: C.y + dy / d * k }; }
function randSpot(sim, T, frac = 0.8) { const C = CEN(T), a = rnd(sim) * TAU, rr = Math.sqrt(rnd(sim)) * R * frac; return { x: C.x + Math.cos(a) * rr, y: C.y + Math.sin(a) * rr }; }
/** the beam's path from (x, y) along ang, reflected off mirror walls, ending on the rim: flat [x0, y0, x1, y1, ...] */
export function beamPath(C, x, y, ang, walls, maxB = 5) {
  const pts = [r0(x), r0(y)]; let dx = Math.cos(ang), dy = Math.sin(ang), skip = -1;
  for (let k = 0; k <= maxB; k++) {
    let best = Infinity, bi = -1;
    (walls || []).forEach((w, i) => { if (i === skip) return; const t = raySeg(x, y, dx, dy, w); if (t > 1 && t < best) { best = t; bi = i; } });
    const fx = x - C.x, fy = y - C.y, bq = fx * dx + fy * dy, cq = fx * fx + fy * fy - R * R, tc = -bq + Math.sqrt(Math.max(0, bq * bq - cq));
    if (bi < 0 || best > tc || k === maxB) { pts.push(r0(x + dx * tc), r0(y + dy * tc)); break; }
    x += dx * best; y += dy * best; pts.push(r0(x), r0(y));
    const w = walls[bi]; let nx = -(w.y2 - w.y1), ny = w.x2 - w.x1; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const dt = dx * nx + dy * ny; dx -= 2 * dt * nx; dy -= 2 * dt * ny; skip = bi;
  }
  return pts;
}
function raySeg(x, y, dx, dy, w) {
  const ex = w.x2 - w.x1, ey = w.y2 - w.y1, den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-9) return Infinity;
  const t = ((w.x1 - x) * ey - (w.y1 - y) * ex) / den, s = ((w.x1 - x) * dy - (w.y1 - y) * dx) / den;
  return s >= 0 && s <= 1 && t > 0 ? t : Infinity;
}

// ------------------------------------------------------------------ phase auras
const cellOf = (T, x, y) => { const C = CEN(T), G = TR.ice.G, c = TR.ice.cell, gx = Math.floor((x - (C.x - G * c / 2)) / c), gy = Math.floor((y - (C.y - G * c / 2)) / c); return gx < 0 || gy < 0 || gx >= G || gy >= G ? -1 : gy * G + gx; };
export const cellCenter = (T, i) => { const C = CEN(T), G = TR.ice.G, c = TR.ice.cell; return { x: C.x - G * c / 2 + (i % G + 0.5) * c, y: C.y - G * c / 2 + (Math.floor(i / G) + 0.5) * c }; };
function crack(sim, T, i, n = 1) {
  const I = T.o.ice; if (!I || i < 0 || I.lv[i] >= 3) return;
  I.lv[i] = Math.min(3, I.lv[i] + n); I.acc[i] = 0;
  if (I.lv[i] >= 3) { I.wt[i] = TR.ice.water; const c = cellCenter(T, i); sim.emit({ type: 'trial', ph: 'break', k: T.k, x: r0(c.x), y: r0(c.y) }); }
  I.s = null;
}
const FIRE_SPOTS = 8;
function fireSpot(sim, T, avoid) { const C = CEN(T); let best = null; for (let k = 0; k < 6; k++) { const a = Math.floor(rnd(sim) * FIRE_SPOTS) / FIRE_SPOTS * TAU + 0.2, q = { x: r0(C.x + Math.cos(a) * R * 0.62), y: r0(C.y + Math.sin(a) * R * 0.62) }; if (!avoid.some((f) => Math.hypot(f.x - q.x, f.y - q.y) < 300)) return q; best = q; } return best; }
export const AURA = {
  ice: { // THIN ICE: every tile you stand on cracks (3 stages), then breaks into freezing water for 10 s
    start(sim, T) { const N = TR.ice.G * TR.ice.G; T.o.ice = { lv: new Array(N).fill(0), acc: new Array(N).fill(0), wt: new Array(N).fill(0), s: null }; ev(sim, T, 'ice'); },
    tick(sim, T, here) {
      const I = T.o.ice, lim = T.x ? TR.ice.crackX : TR.ice.crack;
      for (const p of here) {
        const i = cellOf(T, p.x, p.y); if (i < 0) continue;
        if (I.lv[i] >= 3) { if (sim.tick % 20 === 0) { hurt(sim, T, p, TR.ice.pct, 'freezing water', null, true); sim.emit({ type: 'trial', ph: 'splash', k: T.k, pid: p.id, x: r0(p.x), y: r0(p.y) }); } continue; }
        if (++I.acc[i] >= lim) crack(sim, T, i);
      }
      for (let i = 0; i < I.wt.length; i++) if (I.wt[i] > 0 && --I.wt[i] === 0) { I.lv[i] = 0; I.acc[i] = 0; I.s = null; }
    },
  },
  walls: { // HALL OF MIRRORS: four ice mirrors (the Prism Breath bounces off them)
    start(sim, T) { T.o.walls = mirrorWalls(T, rnd(sim) * 0.5); ev(sim, T, 'walls'); },
    tick() {},
  },
  chill: { // HEART OF WINTER: chill builds on everyone; braziers warm you; at 100 you freeze solid
    start(sim, T, here) {
      T.o.chill = {}; for (const p of here) T.o.chill[p.id] = 0;
      const a = fireSpot(sim, T, []), b2 = fireSpot(sim, T, [a]), L = T.x ? TR.chill.lifeX : TR.chill.life;
      T.o.fires = [{ ...a, life: L, d: L }, { ...b2, life: Math.round(L * 0.6), d: L }]; ev(sim, T, 'chill');
    },
    tick(sim, T, here) {
      const Cf = TR.chill, rate = (T.x ? Cf.rateX : Cf.rate) / 60;
      for (const f of T.o.fires) {
        f.life--;
        if (f.life === Cf.warn) { const q = fireSpot(sim, T, T.o.fires); f.nx = q.x; f.ny = q.y; }
        if (f.life <= 0) { f.x = f.nx ?? f.x; f.y = f.ny ?? f.y; f.nx = f.ny = undefined; f.life = f.d; sim.emit({ type: 'trial', ph: 'fire', k: T.k, x: f.x, y: f.y }); }
      }
      for (const p of here) {
        const warm = T.o.fires.some((f) => Math.hypot(p.x - f.x, p.y - f.y) < Cf.fire);
        let c = (T.o.chill[p.id] || 0) + (warm ? -Cf.warm / 60 : rate);
        if (c >= 100) { hurt(sim, T, p, Cf.pct, 'deep freeze', null, true); p.stun = Math.max(p.stun || 0, 30); p.held = 1; p.holdAt = sim.tick; c = 35; sim.emit({ type: 'trial', ph: 'frozen', k: T.k, pid: p.id, x: r0(p.x), y: r0(p.y) }); }
        T.o.chill[p.id] = Math.max(0, c);
      }
    },
  },
  zero: { // ABSOLUTE ZERO (Extreme): the safe circle shrinks to nothing in 45 s; outside it, the cold bites hard
    start(sim, T) { T.o.zero = { r: R, r1: 150 }; ev(sim, T, 'zero'); },
    tick(sim, T, here) {
      const Z = T.o.zero, C = CEN(T), k = T.chk ? Math.min(1, T.chk.t / T.chk.d) : 0;
      Z.r = r0(R - (R - Z.r1) * Math.min(1, k * 1.15));
      if (sim.tick % 20 === 0) for (const p of here) if (Math.hypot(p.x - C.x, p.y - C.y) > Z.r) hurt(sim, T, p, 0.08, 'absolute zero', null, true);
    },
  },
  valves: { // PRESSURE: a valve builds pressure; standing on it bleeds it; full = BLOWOUT (everyone hit, flung)
    start(sim, T) { const C = CEN(T); T.o.valves = [0, 1, 2, 3].map((i) => { const a = Math.PI / 4 + i * Math.PI / 2; return { x: r0(C.x + Math.cos(a) * R * 0.7), y: r0(C.y + Math.sin(a) * R * 0.7), p: 0, on: 0 }; }); T.o.vcd = 60; ev(sim, T, 'valves'); },
    tick(sim, T, here) { tickValves(sim, T, here, T.x ? 2 : 1); },
  },
  heart: { // HEART OF THE WORLD (Extreme): heartbeat rings race outward ever faster (walk through the gap or dodge), one valve
    start(sim, T) { AURA.valves.start(sim, T); T.o.rings = []; T.o.beatIn = 60; },
    tick(sim, T, here, b) {
      tickValves(sim, T, here, 1);
      const k = T.chk ? Math.min(1, T.chk.t / T.chk.d) : 0, C = CEN(T);
      if (--T.o.beatIn <= 0) {
        T.o.beatIn = r0(110 - 60 * k);
        T.o.rings.push({ r: 70, sp: 4.2 + 2.2 * k, gap: r2(rnd(sim) * TAU), arc: r2(0.9 - 0.3 * k), hit: {} });
        sim.emit({ type: 'trial', ph: 'heartbeat', k: T.k, x: C.x, y: C.y - 40 });
      }
      for (const g of T.o.rings) {
        g.r += g.sp;
        for (const p of here) {
          if (g.hit[p.id]) continue;
          const d = Math.hypot(p.x - C.x, p.y - (C.y - 40));
          if (Math.abs(d - g.r) > 16 + (p.r || 16) * 0.4) continue;
          if (Math.abs(wrapA(Math.atan2(p.y - (C.y - 40), p.x - C.x) - g.gap)) < g.arc / 2) continue;
          g.hit[p.id] = 1; hurt(sim, T, p, 0.2, 'heartbeat ring', { x: C.x, y: C.y }, false);
        }
      }
      T.o.rings = T.o.rings.filter((g) => g.r < R + 60);
    },
  },
  heat: { // SUN-EATEN: heat builds on everyone; three obelisk shades turn round the throne; at 100 you are scorched
    start(sim, T, here) { T.o.heat = {}; for (const p of here) T.o.heat[p.id] = 0; T.o.shadeA = r2(rnd(sim) * TAU); T.o.shades = shadesAt(T, T.o.shadeA); ev(sim, T, 'heat'); },
    tick(sim, T, here) {
      const H = TR.heat; T.o.shadeA = T.o.shadeA + (T.x ? H.spinX : H.spin); if (sim.tick % 3 === 0) T.o.shades = shadesAt(T, T.o.shadeA);
      const rate = (T.x ? H.rateX : H.rate) / 60;
      for (const p of here) {
        const cool = T.o.shades.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < q.r);
        let c = (T.o.heat[p.id] || 0) + (cool ? -H.cool / 60 : rate);
        if (c >= 100) { hurt(sim, T, p, H.pct, 'sunstroke', null, true); p.stun = Math.max(p.stun || 0, 24); c = 35; sim.emit({ type: 'trial', ph: 'scorched', k: T.k, pid: p.id, x: r0(p.x), y: r0(p.y) }); }
        T.o.heat[p.id] = Math.max(0, c);
      }
    },
  },
  blacksun: { // THE BLACK SUN (Extreme): the sun goes out; one patch of light wanders the throne and shrinks; outside it, the dark burns
    start(sim, T) { const C = CEN(T), q = lightSpot(sim, T); T.o.light = { x: r0(C.x), y: r0(C.y + 200), r: T.sv ? TR.light.rS : TR.light.r0, tx: r0(q.x), ty: r0(q.y) }; ev(sim, T, 'blacksun'); },
    tick(sim, T, here) {
      const L = T.o.light, k = T.chk ? Math.min(1, T.chk.t / T.chk.d) : 0, dx = L.tx - L.x, dy = L.ty - L.y, d = Math.hypot(dx, dy), sp = TR.light.sp * (1 + 0.5 * k);
      if (d < sp + 1) { const q = lightSpot(sim, T); L.tx = r0(q.x); L.ty = r0(q.y); } else { L.x = r1(L.x + dx / d * sp); L.y = r1(L.y + dy / d * sp); }
      L.r = T.sv ? TR.light.rS : r0(TR.light.r0 - (TR.light.r0 - TR.light.r1) * k);
      if (sim.tick % 20 === 0) for (const p of here) if (Math.hypot(p.x - L.x, p.y - L.y) > L.r) hurt(sim, T, p, TR.light.pct, 'black sun', null, true);
    },
  },
};
/** where the last light wanders next. Savage: never over him (a devour / hammer answer always fits inside it) */
function lightSpot(sim, T) { if (!T.sv) return randSpot(sim, T, 0.55); const C = CEN(T), b = bossOf(sim), bx = b ? b.x : C.x, by = b ? b.y : C.y - 40; let q = null;
  for (let i = 0; i < 16; i++) { q = randSpot(sim, T, 0.6); if (Math.hypot(q.x - bx, q.y - by) >= 300) return q; } return { x: C.x, y: C.y + R * 0.55 }; }
function shadesAt(T, a) { const C = CEN(T); return [0, 1, 2].map((i) => ({ x: r0(C.x + Math.cos(a + i * TAU / 3) * R * 0.56), y: r0(C.y + Math.sin(a + i * TAU / 3) * R * 0.56), r: TR.heat.r })); }
function tickValves(sim, T, here, want) {
  const V = TR.valve, fill = 100 / (T.x ? V.fillX : V.fill), vs = T.o.valves;
  const on = vs.filter((v) => v.on).length;
  if (on < want && --T.o.vcd <= 0) { const off = vs.filter((v) => !v.on); const v = pick(sim, off); v.on = 1; v.p = 20; v.tc = 0; T.o.vcd = V.cd; sim.emit({ type: 'trial', ph: 'valve', k: T.k, x: v.x, y: v.y }); }
  for (const v of vs) {
    if (!v.on) continue;
    let n = 0; for (const p of here) if (Math.hypot(p.x - v.x, p.y - v.y) < V.r) n++;
    v.p += fill - n * V.bleed; if (n) v.tc = 1;
    if (v.p <= 0 && v.tc) { v.on = 0; v.p = 0; sim.emit({ type: 'trial', ph: 'vent', k: T.k, x: v.x, y: v.y }); continue; }
    v.p = Math.max(0, v.p);
    if (v.p >= 100) {
      v.on = 0; v.p = 0;
      for (const p of here) { hurt(sim, T, p, V.pct, 'blowout', { x: v.x, y: v.y }, true); const a = angTo(v, p), q = clampIn(T, p.x + Math.cos(a) * 160, p.y + Math.sin(a) * 160, 24); p.x = q.x; p.y = q.y; }
      sim.emit({ type: 'trial', ph: 'blowout', k: T.k, x: v.x, y: v.y });
    }
  }
}
function mirrorWalls(T, rot) {
  const C = CEN(T);
  return [0, 1, 2, 3].map((i) => { const a = rot + Math.PI / 4 + i * Math.PI / 2, cx = C.x + Math.cos(a) * R * 0.55, cy = C.y + Math.sin(a) * R * 0.55, o = a + Math.PI / 2 + (i % 2 ? 0.55 : -0.55), L = 130;
    return { x1: r0(cx - Math.cos(o) * L), y1: r0(cy - Math.sin(o) * L), x2: r0(cx + Math.cos(o) * L), y2: r0(cy + Math.sin(o) * L) }; });
}
/** shared per-tick field rules: lava pools, rafts in the flood */
function common(sim, T, here) {
  if (T.o.pools) { for (const q of T.o.pools) { q.life--; if (q.life % 20 === 0) for (const p of here) if (Math.hypot(p.x - q.x, p.y - q.y) < q.r) hurt(sim, T, p, 0.06, 'lava pool', null, true); } T.o.pools = T.o.pools.filter((q) => q.life > 0); }
}

// ------------------------------------------------------------------ mechanics
const target = (sim, here) => (here.length ? pick(sim, here) : null);
export const MECH = {
  // ---------------- Skaldra
  snowball: { // AVALANCHE BALL: a snowball that rolls, GROWS and bounces off the rim (its arrow shows where it goes next)
    start(sim, T, m, here) {
      const C = CEN(T), n = T.x ? 2 : 1, tg = target(sim, here) || C, a0 = angTo(C, tg) + Math.PI;
      m.d = T.x ? 560 : 620; m.w = tk(T, 60); m.ids = [];
      T.o.balls = T.o.balls || [];
      for (let i = 0; i < n; i++) {
        const a = a0 + i * Math.PI + (rnd(sim) - 0.5) * 0.5, x = C.x + Math.cos(a) * R * 0.78, y = C.y + Math.sin(a) * R * 0.78, aim = angTo({ x, y }, i ? C : tg) + (i ? (rnd(sim) - 0.5) * 0.8 : 0), sp = T.x ? 4.3 : 3.7;
        const ball = { id: T.tid++, x: r1(x), y: r1(y), vx: r2(Math.cos(aim) * sp), vy: r2(Math.sin(aim) * sp), r: 46, hit: {} };
        T.o.balls.push(ball); m.ids.push(ball.id);
      }
      card(sim, T, 'AVALANCHE BALL', 'It rolls, grows and bounces off the rim · read its arrow', '#e8f6ff');
      ev(sim, T, 'snowball');
    },
    tick(sim, T, m, here) {
      if (m.t < m.w) return;
      const C = CEN(T), k = (m.t - m.w) / (m.d - m.w);
      for (const ball of T.o.balls || []) {
        if (!m.ids.includes(ball.id)) continue;
        ball.r = r0(46 + 84 * k); ball.x = r1(ball.x + ball.vx); ball.y = r1(ball.y + ball.vy);
        const dx = ball.x - C.x, dy = ball.y - C.y, d = Math.hypot(dx, dy);
        if (d > R - ball.r) {
          const nx = dx / d, ny = dy / d, dt = ball.vx * nx + ball.vy * ny;
          if (dt > 0) { ball.vx = r2((ball.vx - 2 * dt * nx) * 1.03); ball.vy = r2((ball.vy - 2 * dt * ny) * 1.03); sim.emit({ type: 'trial', ph: 'bounce', k: T.k, x: r0(ball.x), y: r0(ball.y) }); }
          ball.x = r1(C.x + nx * (R - ball.r)); ball.y = r1(C.y + ny * (R - ball.r));
        }
        if (T.o.ice && m.t % 20 === 0) crack(sim, T, cellOf(T, ball.x, ball.y));
        for (const p of here) {
          if ((ball.hit[p.id] || 0) > sim.tick) continue;
          const pd = Math.hypot(p.x - ball.x, p.y - ball.y);
          if (pd > ball.r + (p.r || 16) * 0.6) continue;
          ball.hit[p.id] = sim.tick + 45;
          hurt(sim, T, p, 0.28, 'avalanche ball', { x: ball.x, y: ball.y });
          const a = Math.atan2(p.y - ball.y, p.x - ball.x), q = clampIn(T, ball.x + Math.cos(a) * (ball.r + 40), ball.y + Math.sin(a) * (ball.r + 40), 20);
          p.x = q.x; p.y = q.y; T.pushed = T.pushed || {}; T.pushed[p.id] = sim.tick;
        }
      }
    },
    end(sim, T, m) {
      const b = bossOf(sim);
      for (const ball of T.o.balls || []) if (m.ids.includes(ball.id)) { sim.emit({ type: 'trial', ph: 'burst', k: T.k, x: r0(ball.x), y: r0(ball.y), r: ball.r }); if (b) for (let i = 0; i < 10; i++) bullet(sim, T, b, ball.x, ball.y, i / 10 * TAU, 200, 150, 0.1, 'ice'); }
      T.o.balls = (T.o.balls || []).filter((x) => !m.ids.includes(x.id));
    },
  },
  rimeshadow: { // RIME SHADOW: an ice copy of each of you walks your exact path 1.5 s behind; stand still and it catches you
    start(sim, T, m, here) {
      m.d = T.x ? 560 : 600; m.lag = T.x ? 80 : 90;
      T.o.shadows = here.map((p) => ({ pid: p.id, x: r0(p.x), y: r0(p.y), cd: 0, lag: m.lag }));
      card(sim, T, 'RIME SHADOW', 'An ice copy of you walks your path 1.5 s behind · stop and it catches you', '#cfeeff');
      ev(sim, T, 'shadow');
    },
    tick(sim, T, m, here) {
      for (const s of T.o.shadows || []) {
        const p = sim.players.get(s.pid), tr = T.trail[s.pid];
        if (!p || p.dead || !tr) continue;
        const i = tr.length - 2 * (m.lag + 1);
        if (i >= 0) { s.x = tr[i]; s.y = tr[i + 1]; }
        if (m.t > m.lag && sim.tick > s.cd && Math.hypot(p.x - s.x, p.y - s.y) < 28 + (p.r || 16) * 0.6) { s.cd = sim.tick + 50; hurt(sim, T, p, 0.24, 'rime shadow', { x: s.x, y: s.y }); p.stun = Math.max(p.stun || 0, 20); sim.emit({ type: 'trial', ph: 'caught', k: T.k, pid: p.id, x: r0(p.x), y: r0(p.y) }); }
      }
    },
    end(sim, T) { T.o.shadows = []; },
  },
  icicles: { // ICICLE CLOCK: numbered icicles fall round the clock in order (Extreme: a counter-turning inner ring)
    start(sim, T, m) {
      const C = CEN(T), dir = rnd(sim) < 0.5 ? 1 : -1, h0 = Math.floor(rnd(sim) * 12), first = tk(T, 80), every = tk(T, 13);
      let last = 0;
      for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + (h0 + dir * i) * TAU / 12, d = first + i * every; last = Math.max(last, d); tele(T, { k: 'icicle', sh: 'circle', x: r0(C.x + Math.cos(a) * R * 0.66), y: r0(C.y + Math.sin(a) * R * 0.66), r: 128, d, pct: 0.3, n: i + 1, what: 'icicle' }); }
      if (T.x) for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (h0 * 0.5 - dir * i) * TAU / 6, d = first + 20 + i * every * 2; last = Math.max(last, d); tele(T, { k: 'icicle', sh: 'circle', x: r0(C.x + Math.cos(a) * R * 0.24), y: r0(C.y + Math.sin(a) * R * 0.24), r: 112, d, pct: 0.3, n: i + 1, what: 'icicle' }); }
      m.d = last + 16;
      card(sim, T, 'ICICLE CLOCK', T.x ? 'Two rings turn against each other · follow behind the numbers' : 'They fall in number order · follow behind them', '#dff4ff');
      ev(sim, T, 'icicles');
    },
    tick() {},
  },
  breath: { // FROST BREATH: a sweeping cone, step by step
    start(sim, T, m, here, b) {
      const tg = target(sim, here) || CEN(T), a0 = angTo(b, tg), dir = rnd(sim) < 0.5 ? 1 : -1;
      for (let i = 0; i < 5; i++) tele(T, { k: 'breath', sh: 'cone', x: r0(b.x), y: r0(b.y), r: 680, arc: 0.62, ang: r2(a0 - dir * 0.7 + dir * 0.35 * i), d: tk(T, 50) + i * 13, pct: 0.3, what: 'frost breath' });
      m.d = tk(T, 50) + 4 * 13 + 16;
      card(sim, T, 'FROST BREATH', 'The cone sweeps across · get behind it', '#bff6ff');
      ev(sim, T, 'breath');
    },
    tick() {},
  },
  frostbite: { // FROSTBITE: circles under everyone, twice
    start(sim, T, m) { m.d = 40 + tk(T, 50) + 10; card(sim, T, 'FROSTBITE', 'Circles under you · move out, twice', '#bff6ff'); },
    tick(sim, T, m, here) { if (m.t === 1 || m.t === 40) for (const p of here) tele(T, { k: 'frostbite', sh: 'circle', x: r0(p.x), y: r0(p.y), r: 100, d: tk(T, 50), pct: 0.22, what: 'frostbite' }); },
  },
  prism: { // PRISM BREATH: a beam that bounces off the ice mirrors (trace its path before it fires)
    start(sim, T, m) {
      if (!T.o.walls || !T.o.walls.length) { T.o.walls = mirrorWalls(T, rnd(sim) * 1.5); m.tmp = 1; ev(sim, T, 'walls'); }
      else if (T.x) { T.o.walls = mirrorWalls(T, rnd(sim) * 1.5); ev(sim, T, 'walls'); } // Extreme: the mirrors shift every time
      m.n = T.x ? 3 : 2; m.every = tk(T, 70); m.read = tk(T, 100); m.d = 2 + (m.n - 1) * m.every + m.read + 18;
      card(sim, T, 'PRISM BREATH', 'Her beam bounces off every mirror · trace the line', '#bff6ff');
    },
    tick(sim, T, m, here, b) {
      if (!b || (m.t - 2) % m.every !== 0 || m.t < 2 || (m.t - 2) / m.every >= m.n) return;
      const tg = target(sim, here) || CEN(T), a = angTo(b, tg) + (rnd(sim) - 0.5) * 0.7;
      tele(T, { k: 'beam', sh: 'path', x: r0(b.x), y: r0(b.y), pts: beamPath(CEN(T), b.x, b.y, a, T.o.walls), w: 66, d: m.read, pct: 0.4, what: 'prism breath' });
      ev(sim, T, 'prism');
    },
    end(sim, T, m) { if (m.tmp) T.o.walls = []; },
  },
  watch: { // SHE WATCHES: red light / green light: when her eye opens, anyone who moves is frozen solid
    start(sim, T, m) {
      m.cyc = 2; m.closed = tk(T, 120); m.warn = tk(T, 45); m.open = 80; m.len = m.closed + m.warn + m.open; m.d = m.cyc * m.len + 10; m.last = {}; m.mv = {};
      T.o.eye = { s: 'closed', t: 0, d: m.closed };
      card(sim, T, 'SHE WATCHES', 'When her eye OPENS, FREEZE · move only while it is shut', '#ffffff');
    },
    tick(sim, T, m, here) {
      const c = Math.min(m.cyc - 1, Math.floor((m.t - 1) / m.len)), s = (m.t - 1) - c * m.len, E = T.o.eye;
      if (!E) return;
      const st = s < m.closed ? 'closed' : s < m.closed + m.warn ? 'warn' : 'open';
      if (st !== E.s) { E.s = st; E.t = 0; E.d = st === 'warn' ? m.warn : st === 'open' ? m.open : m.closed; m.mv = {}; sim.emit({ type: 'trial', ph: 'eye', k: T.k, s: st, x: CEN(T).x, y: CEN(T).y }); }
      E.t++;
      if (st === 'closed' && s === 1) for (const p of here) tele(T, { k: 'frostbite', sh: 'circle', x: r0(p.x), y: r0(p.y), r: 96, d: tk(T, 55), pct: 0.2, what: 'frostbite' });
      for (const p of here) {
        const L = m.last[p.id]; m.last[p.id] = [p.x, p.y];
        if (st !== 'open' || !L || (T.pushed && sim.tick - (T.pushed[p.id] || -99) < 12)) continue;
        if (Math.hypot(p.x - L[0], p.y - L[1]) > 1.2) m.mv[p.id] = (m.mv[p.id] || 0) + 1;
        if (m.mv[p.id] === 4) { hurt(sim, T, p, 0.35, 'her gaze', null, true); p.stun = Math.max(p.stun || 0, 40); p.held = 1; p.holdAt = sim.tick; sim.emit({ type: 'trial', ph: 'seen', k: T.k, pid: p.id, x: r0(p.x), y: r0(p.y) }); }
      }
    },
    end(sim, T) { T.o.eye = null; },
  },
  coil: { // COIL LUNGE: she dives under the ice and lunges across the lake from the rim (Extreme: a second spike trail follows)
    start(sim, T, m) { m.n = T.x ? 5 : 3; m.every = tk(T, 78); m.read = tk(T, 62); m.d = 10 + (m.n - 1) * m.every + m.read + (T.x ? 50 : 0) + 30; T.dive = 1; card(sim, T, 'COIL LUNGE', 'She dives under the ice · her head bursts from the rim', '#9fe8ff'); ev(sim, T, 'dive'); },
    tick(sim, T, m, here, b) {
      const C = CEN(T), s = m.t - 10;
      if (s >= 0 && s % m.every === 0 && s / m.every < m.n) {
        const tg = target(sim, here) || C, a = angTo(C, tg) + Math.PI + (rnd(sim) - 0.5) * 0.7, sx = C.x + Math.cos(a) * R * 0.94, sy = C.y + Math.sin(a) * R * 0.94, ang = Math.atan2(tg.y - sy, tg.x - sx);
        tele(T, { k: 'lunge', sh: 'line', x: r0(sx), y: r0(sy), ang: r2(ang), len: R * 1.9, w: 150, d: m.read, pct: 0.38, what: 'coil lunge' });
        if (T.x) tele(T, { k: 'spikes', sh: 'line', x: r0(sx), y: r0(sy), ang: r2(ang), len: R * 1.9, w: 90, d: m.read + 50, pct: 0.3, what: 'ice spikes' });
        T.bx = sx; T.by = sy; m.lx = sx + Math.cos(ang) * R * 1.9; m.ly = sy + Math.sin(ang) * R * 1.9; m.at = s;
        sim.emit({ type: 'trial', ph: 'lungeWarn', k: T.k, x: r0(sx), y: r0(sy) });
      }
      if (m.at != null && s === m.at + m.read) { const q = clampIn(T, m.lx, m.ly, 40); T.bx = q.x; T.by = q.y; if (b) { b.x = q.x; b.y = q.y; } sim.emit({ type: 'trial', ph: 'lunge', k: T.k, x: r0(q.x), y: r0(q.y) }); }
    },
    end(sim, T) { T.dive = 0; T.bx = CEN(T).x; T.by = CEN(T).y - 40; ev(sim, T, 'surface'); },
  },
  // ---------------- Pyrrhex
  bombs: { // COUNTDOWN BOMBS: numbered magma bombs burst in order; each leaves a lava pool
    start(sim, T, m, here) {
      const n = T.x ? 8 : 6, first = tk(T, 90), every = tk(T, 24);
      for (let i = 0; i < n; i++) {
        const tg = i % 2 === 0 && here.length ? here[(i / 2) % here.length] : null;
        const q = tg ? clampIn(T, tg.x + (rnd(sim) - 0.5) * 90, tg.y + (rnd(sim) - 0.5) * 90, 40) : randSpot(sim, T, 0.82);
        tele(T, { k: 'bomb', sh: 'circle', x: r0(q.x), y: r0(q.y), r: 120, d: first + i * every, pct: 0.3, n: i + 1, then: 'pool', what: 'countdown bomb' });
      }
      m.d = first + (n - 1) * every + 14;
      card(sim, T, 'COUNTDOWN BOMBS', 'They burst in number order · each leaves a lava pool', '#ffcf4a');
      ev(sim, T, 'bombs');
    },
    tick() {},
  },
  arrhythmia: { // ARRHYTHMIA: a heartbeat on a rhythm; dodge-roll exactly on every RED beat (normal beats punish melee range)
    start(sim, T, m) {
      m.first = 100; m.every = tk(T, 42); m.n = 8;
      m.red = T.x ? [1, 3, 4, 6, 7] : [2, 5, 7];
      m.d = m.first + m.every * (m.n - 1) + 30;
      T.o.beat = { t: 0, first: m.first, every: m.every, n: m.n, red: m.red };
      card(sim, T, 'ARRHYTHMIA', 'Dodge-roll exactly on every RED beat', '#ff5a6a');
      ev(sim, T, 'arrhythmia');
    },
    tick(sim, T, m, here, b) {
      if (T.o.beat) T.o.beat.t = m.t;
      const s = m.t - m.first, s2 = s + 20;
      if (b && s2 >= 0 && s2 % m.every === 0 && s2 / m.every < m.n && !m.red.includes(s2 / m.every)) tele(T, { k: 'beatring', sh: 'circle', x: r0(b.x), y: r0(b.y), r: 150, d: 20, pct: 0.15, what: 'heartbeat', quiet: 1 }); // (normal beats: a pulse at his feet)
      if (s < 0 || s % m.every !== 0) return;
      const i = s / m.every; if (i >= m.n) return;
      const red = m.red.includes(i);
      if (red) for (const p of here) hurt(sim, T, p, 0.3, 'missed beat', null, false); // (a dodge's i-frames slip it)
      sim.emit({ type: 'trial', ph: red ? 'redbeat' : 'beat', k: T.k, i, x: r0(b ? b.x : CEN(T).x), y: r0(b ? b.y : CEN(T).y) });
    },
    end(sim, T) { T.o.beat = null; },
  },
  fists: { // MAGMA FISTS: three waves of fists under everyone
    start(sim, T, m) { m.every = tk(T, 40); m.d = 2 * m.every + tk(T, 46) + 12; card(sim, T, 'MAGMA FISTS', 'Three waves under your feet · keep stepping', '#ff8a4a'); },
    tick(sim, T, m, here) { if ((m.t - 1) % m.every === 0 && m.t <= 2 * m.every + 1) for (const p of here) tele(T, { k: 'fist', sh: 'circle', x: r0(p.x), y: r0(p.y), r: 104, d: tk(T, 46), pct: 0.25, what: 'magma fist' }); },
  },
  fan: { // EMBER FAN: bullet fans aimed at the party
    start(sim, T, m) { m.d = 80; ev(sim, T, 'fan'); },
    tick(sim, T, m, here, b) {
      if (!b || !(m.t === 10 || m.t === 32 || m.t === 54)) return;
      for (const p of here) { const a0 = angTo(b, p), n = T.x ? 9 : 7; for (let i = 0; i < n; i++) bullet(sim, T, b, b.x, b.y, a0 + (i - (n - 1) / 2) * 0.16, 270, 170, 0.1, 'magma'); }
    },
  },
  gaze: { // MAGMA GAZE: a beam sweeps the whole chamber; hide behind an obsidian pillar (keep it between you and his eye)
    start(sim, T, m) {
      const C = CEN(T), o = rnd(sim) * TAU, pr = T.x ? 42 : 48;
      T.o.pillars = [0, 1, 2].map((i) => ({ x: r0(C.x + Math.cos(o + i * TAU / 3) * R * 0.5), y: r0(C.y + Math.sin(o + i * TAU / 3) * R * 0.5), r: pr }));
      m.warn = tk(T, 110); m.sweep = T.x ? 250 : 260; m.turn = T.x ? 1.25 : 1;
      T.o.gaze = { a: r2(rnd(sim) * TAU), dir: rnd(sim) < 0.5 ? 1 : -1, w: 0.2, on: 0 };
      m.d = m.warn + m.sweep + 30;
      card(sim, T, 'MAGMA GAZE', 'Hide behind an obsidian pillar · keep it between you and his eye', '#ff6a2a');
      ev(sim, T, 'pillars');
    },
    tick(sim, T, m, here, b) {
      const G = T.o.gaze; if (!G || !b) return;
      if (m.t === m.warn) { G.on = 1; ev(sim, T, 'gaze'); }
      if (m.t > m.warn + m.sweep) { G.on = 0; return; }
      if (!G.on) return;
      G.a = r2(G.a + G.dir * TAU * m.turn / m.sweep);
      if (m.t % 6 !== 0) return;
      for (const p of here) {
        const d = Math.hypot(p.x - b.x, p.y - b.y), pa = Math.atan2(p.y - b.y, p.x - b.x);
        if (d < b.r || Math.abs(wrapA(pa - G.a)) > G.w / 2 + Math.atan2(p.r || 16, d)) continue;
        if (hiddenBehind(T, b, p)) continue;
        hurt(sim, T, p, 0.08, 'magma gaze', { x: b.x, y: b.y }, true);
      }
    },
    end(sim, T) { T.o.pillars = []; T.o.gaze = null; ev(sim, T, 'crumble'); },
  },
  arteries: { // ARTERIES: blood tethers pull you in; keep them stretched (green); when they SNAP a lance runs down each one
    start(sim, T, m, here) {
      m.d = 430; m.snap = m.d - tk(T, 70); m.min = T.x ? 360 : 320;
      T.o.teth = here.map((p) => ({ pid: p.id, ok: 0 })); T.o.tmin = m.min;
      card(sim, T, 'ARTERIES', 'Blood tethers pull you in · keep them stretched · step aside when they SNAP', '#ff4a6a');
      ev(sim, T, 'arteries');
    },
    tick(sim, T, m, here, b) {
      if (!b || !T.o.teth) return;
      if (m.t === m.snap) {
        for (const t of T.o.teth) { const p = sim.players.get(t.pid); if (!p || p.dead) continue; const a = angTo(b, p); tele(T, { k: 'snap', sh: 'line', x: r0(b.x), y: r0(b.y), ang: r2(a), len: R * 1.15, w: 110, d: tk(T, 55), pct: 0.35, what: 'artery snap' }); }
        T.o.teth = null; ev(sim, T, 'snap'); return;
      }
      for (const t of T.o.teth) {
        const p = sim.players.get(t.pid); if (!p || p.dead) continue;
        const d = Math.hypot(p.x - b.x, p.y - b.y), a = angTo(b, p);
        if (d > b.r + 30) { p.x -= Math.cos(a) * 0.9; p.y -= Math.sin(a) * 0.9; }
        t.ok = d >= m.min ? 1 : 0;
        if (!t.ok && m.t % 15 === 0 && m.t > 40) hurt(sim, T, p, 0.05, 'short artery', null, true);
      }
    },
    end(sim, T) { T.o.teth = null; },
  },
  flood: { // OBSIDIAN RAIN: dodge the meteors, then stand on the craters they leave: the chamber floods
    start(sim, T, m, here) {
      const n = 5, first = tk(T, 85), every = tk(T, 16);
      for (let i = 0; i < n; i++) {
        const tg = T.x && i < here.length ? here[i] : null, q = tg ? clampIn(T, tg.x, tg.y, 110) : randSpot(sim, T, 0.72);
        tele(T, { k: 'meteor', sh: 'circle', x: r0(q.x), y: r0(q.y), r: 105, d: first + i * every, pct: 0.35, then: 'raft', what: 'meteor' });
      }
      m.fs = first + (n - 1) * every + 45; m.fd = T.x ? 230 : 200; m.d = m.fs + m.fd + 10;
      card(sim, T, 'OBSIDIAN RAIN', 'Dodge the meteors · then stand where they landed: the chamber floods', '#ffb04a');
      ev(sim, T, 'meteors');
    },
    tick(sim, T, m, here) {
      if (m.t === m.fs) { T.o.flood = { t: 0, d: m.fd }; ev(sim, T, 'flood'); }
      const F = T.o.flood; if (!F || m.t < m.fs) return;
      F.t++;
      if (T.x) for (const q of T.o.rafts || []) q.r = r0(q.r1 - 40 * Math.min(1, F.t / F.d));
      if (F.t > 30 && F.t % 20 === 0) for (const p of here) if (!(T.o.rafts || []).some((q) => Math.hypot(p.x - q.x, p.y - q.y) < q.r)) hurt(sim, T, p, 0.1, 'lava flood', null, true);
    },
    end(sim, T) { T.o.flood = null; T.o.rafts = []; ev(sim, T, 'drain'); },
  },
};
/** is the player hidden from the gaze by an obsidian pillar (a pillar closer to the boss, on the line between)? */
// Neferakh Unbound's mechanics live in sim/neferakh.js (encounter revamp Part 1); the engine lends them its helpers
Object.assign(MECH, nefMechs({ tele, hurt, card, ev, tk, CEN, rnd, pick, angTo, aliveIn, R, r0, r2, fail: svFail }));
export function hiddenBehind(T, b, p) {
  const dp = Math.hypot(p.x - b.x, p.y - b.y);
  for (const q of T.o.pillars || []) {
    const dq = Math.hypot(q.x - b.x, q.y - b.y);
    if (dq >= dp) continue;
    if (segDist(q.x, q.y, b.x, b.y, p.x, p.y) < q.r + 6) return true;
  }
  return false;
}

// ------------------------------------------------------------------ kill / victory / wipe
function startKill(sim, T, b) {
  clearField(sim, T);
  T.st = 'kill'; T.at = 0; T.kx = r0(b.x); T.ky = r0(b.y);
  say(sim, T, T.k === 'sk' ? 'The thaw... so this is what spring feels like.' : T.k === 'nf' ? 'The light... it was always so... warm...' : 'Thud... thud... th—', 280);
  sim.emit({ type: 'trial', ph: 'kill', k: T.k, x: T.kx, y: T.ky, ex: T.x });
}
function victory(sim, T) {
  T.st = 'victory'; T.at = 0; T.best = 1;
  const t = T.t, F = fightOf(T), K = TRIAL_KEYS[T.k];
  card(sim, T, T.sv ? 'SAVAGE CLEARED' : T.x ? 'EXTREME CLEARED' : 'TRIAL CLEARED', `${trialName(T)} in ${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}${T.wipes ? ` · after ${T.wipes} wipe${T.wipes > 1 ? 's' : ''}` : ''} · ${sim.hub ? 'step into the exit portal to go home' : 'the exit portal is open'}`, colOf(T), 360);
  reviveFallen(sim, T);
  ev(sim, T, 'victory', { t: r0(t / 60), wipes: T.wipes, ex: T.x });
  for (const id of T.party) {
    const p = sim.players.get(id); if (!p) continue;
    p.unlocks = p.unlocks || {};
    if (T.sv) savageClear(sim, T, p);
    for (const key of T.sv ? [K.clearS] : T.x ? [K.clearX] : [K.clear]) { const fresh = !p.unlocks[key]; p.unlocks[key] = 1; sim.emit({ type: 'unlock', pid: p.id, key, fresh: fresh ? 1 : 0, x: CEN(T).x, y: CEN(T).y }); }
    sim.emit({ type: 'trial', ph: 'clear', k: T.k, pid: p.id, ex: T.x, sv: T.sv, x: CEN(T).x, y: CEN(T).y });
  }
}
/** Savage: the weekly first clear drops the Savage coffer (a tier-7 Legendary of the boss's Extreme family: a slot you don't own yet first)
 *  and banks the week key (the client pays the +4 Marks on that key's fresh unlock). Every clear's Mark rides TRIAL_DROPS. */
function savageClear(sim, T, p) {
  const S = SAVAGE[T.k]; if (!S) return;
  const wk = weekKey(T.k, sim.now ? sim.now() : Date.now()), first = !p.unlocks[wk];
  if (first) {
    const fam = T.k === 'nf' ? 'blacksun' : null; if (!fam) return;
    const have = new Set([...Object.values(p.equipment || {}), ...(p.inventory || [])].filter((i) => i && i.ex === fam).map((i) => i.slot));
    const want = EXOTIC_SLOTS.filter((sl) => !have.has(sl)), slot = want.length ? want[Math.floor(rnd(sim) * want.length)] : null;
    const it = withLootLevel(Math.max(p.level | 0, SAVAGE_REWARD.coffer.lv), () => makeExotic(sim.rng, fam, p.cls, slot));
    if (it) { it.sv = 1; it.name = `Savage ${it.name}`;
      const C = CEN(T), bag = { id: sim.id(), x: C.x + (rnd(sim) - 0.5) * 80, y: C.y + 40, items: [it], ownerId: p.id, life: secs(240), rarity: it.rarity, coffer: 1 };
      sim.bags.push(bag); sim.emit({ type: 'loot', x: bag.x, y: bag.y, rarity: bag.rarity, pid: p.id, coffer: 1 }); }
  }
  p.unlocks[wk] = 1; sim.emit({ type: 'unlock', pid: p.id, key: wk, fresh: first ? 1 : 0, x: CEN(T).x, y: CEN(T).y });
  sim.emit({ type: 'savage', ph: 'clear', k: T.k, pid: p.id, week: first ? 1 : 0, first: p.unlocks[S.clear] ? 0 : 1 });
}
function wipe(sim, T, reason) {
  const b = bossOf(sim), ph = phasesOf(T)[T.ph - 1];
  T.lastWipe = { ph: T.ph, name: ph ? ph.name : 'The Pull', mech: T.st === 'set' ? ['Sunbearer'] : T.mechs.map((m) => MECH_NAMES[m.id] || m.id), hp: b && b.maxHp ? Math.round(b.hp / b.maxHp * 100) : 100, prog: Math.round(T.prog * 100), t: r0(T.t / 60), reason };
  T.best = Math.max(T.best, T.prog); T.wipes++;
  clearField(sim, T);
  T.st = 'wipe'; T.at = 0; T.call = null;
  sim.emit({ type: 'trial', ph: 'wipe', k: T.k, reason, x: CEN(T).x, y: CEN(T).y, prog: T.lastWipe.prog, t: T.lastWipe.t });
}
function resetAfterWipe(sim, T, present) {
  startTrial(sim, T.k, trialLv(T), T);
  if (T.form) sim.trial.pendEcl = 1; // (Savage v2: you restart at the version you were fighting)
  present.forEach((p, i) => { if (p.dead) respawnPlayer(sim, p); placeStart(sim.trial, p, i); p.hp = p.stats.maxHp; p.res = p.stats.maxRes; sim.emit({ type: 'trial', ph: 'revive', k: T.k, pid: p.id, x: r0(p.x), y: r0(p.y) }); });
}

// ------------------------------------------------------------------ co-op / test helpers
const PACK_T = ['x', 'y', 'r', 'r0', 'ang', 'arc', 'len', 'w', 'n', 'safe', 'done', 'beat', 'cue', 'inv'];
/** Compact copy for the co-op snapshot (the renderer reads the same shape from a local sim's `sim.trial`). */
export function packTrial(sim) {
  const T = sim.trial; if (!T) return null;
  const o = {}, O = T.o;
  for (const k of Object.keys(O)) {
    if (k === 'ice') { if (!O.ice.s) O.ice.s = O.ice.lv.join(''); o.ice = O.ice.s; continue; }
    if (k === 'chill' || k === 'heat') { o[k] = {}; for (const id in O[k]) o[k][id] = r0(O[k][id]); continue; }
    if (k === 'shadeA') continue;
    if (k === 'balls') { o.balls = O.balls.map((q) => ({ id: q.id, x: r0(q.x), y: r0(q.y), vx: q.vx, vy: q.vy, r: q.r })); continue; }
    if (k === 'rings') { o.rings = O.rings.map((g) => ({ r: r0(g.r), gap: g.gap, arc: g.arc })); continue; }
    if (k === 'valves') { o.valves = O.valves.map((v) => ({ x: v.x, y: v.y, p: r0(v.p), on: v.on })); continue; }
    if (k === 'fires') { o.fires = O.fires.map((f) => ({ x: f.x, y: f.y, life: f.life, d: f.d, nx: f.nx, ny: f.ny })); continue; }
    o[k] = O[k];
  }
  const tele = T.tele.map((t) => { const q = { id: t.id, k: t.k, sh: t.sh, t: t.t, d: t.d }; for (const k of PACK_T) if (t[k] !== undefined) q[k] = t[k]; if (t.pts) q.pts = t.pts; return q; });
  return { k: T.k, x: T.x, sv: T.sv || 0, hub: T.hub, st: T.st, at: T.at, t: T.t, ph: T.ph, nph: phasesOf(T).length, bid: T.bid, n: T.n, party: T.party, call: T.call, line: T.line, tele, o,
    mechs: T.mechs.map((m) => m.id), gate: T.gate, shield: T.shield, wipes: T.wipes, lastWipe: T.lastWipe, best: r2(T.best), prog: r2(T.prog), enr: T.enr, chk: T.chk, dive: T.dive, kx: T.kx, ky: T.ky, over: T.over || 0, pull: T.pull, why: T.why || '', form: T.form || 0, eShort: T.eShort || 0, transD: T.transD || 0 };
}
/** Test hook (server dev op 'trial' / playtests): enter, skip the pull, jump to a phase, force a mechanic, set boss HP %,
 *  force a wipe / the kill, freeze the rotation (hold), move the enrage clock. */
export function devTrial(sim, p, m) {
  if (m.enter) enterTrial(sim, p, m.enter, m.x === 2 ? 2 : m.x ? 1 : 0);
  const T = sim.trial; if (!T) return;
  const b = bossOf(sim), here = aliveIn(sim, T);
  if ((m.skipPull || m.ph) && T.st === 'pull') { T.at = T.pull - 1; updateTrial(sim); }
  if (m.form && T.sv && fightOf(T).e && !T.form && b) { if (T.st === 'pull') { T.at = T.pull - 1; updateTrial(sim); } startEclipse(sim, T, b, m.form === 2 ? 1 : 0); if (m.instant) { T.at = T.transD; eclTick(sim, T, b, aliveIn(sim, T)); } } // (dev: 1 = the full transformation, 2 = the short one; instant = straight into the Eclipse fight)
  if (m.ph > 0 && m.ph <= phasesOf(T).length) { clearField(sim, T); startPhase(sim, T, m.ph, here); if (b && m.ph > 1) b.hp = Math.round(b.maxHp * phasesOf(T)[m.ph - 2].floor); }
  if (m.mech && MECH[m.mech]) { if (!m.add) { for (const q of T.mechs) { const D = MECH[q.id]; if (D && D.end) D.end(sim, T, q, here, b); } T.mechs = []; T.tele = []; } startMech(sim, T, m.mech, here, b); } // (replaced mechanics end properly: no stale floor state)
  if (b && m.hpPct > 0 && m.hpPct <= 1) b.hp = Math.max(1, Math.round(b.maxHp * m.hpPct));
  if (m.hold) T.cd = 1e9;
  if (m.hold === 0) T.cd = 1;
  if (m.enr != null) T.t = Math.max(0, T.enr - m.enr);
  if (m.wipe) wipe(sim, T, 'dev');
  if (m.set && T.k === 'nf' && b) { clearField(sim, T); T.ph = 2; startSunbearer(sim, T, b); } // (dev: jump straight into the Sunbearer)
  if (m.win && b && !b.dead) { b.invuln = 0; b.hp = 0; killEnemy(sim, b, p); } // (a real kill: drops, tokens, bounties)
}
export const __test = { AURA, MECH, wipe, startPhase, tickValves, startTrans, startEclipse };
