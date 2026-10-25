// Part E (docs/ASCENSION-PLAN.md): Practice mode. A learning aid for the boss fights: start any encounter you have REACHED
// in a real attempt straight at its boss, from any phase you reached (never one you have not), optionally with a locked
// mechanic variation, as many times as you like. Practice is solo and pays nothing (no loot, no XP, no keys, no unlocks,
// no records, no bounties); nothing is taken either (your own bags and gear are untouched, death costs nothing).
//   records  client-side, per account: profile.prac[enc] = { ph: highest phase reached, n: real attempts that reached the boss }
//            (sim/meta.js style, pure helpers below; client/practiceui.js records them from the live fight)
//   sim      sim.practice = { id, enc, ph, v, reach, t0, tries, on } (set by sim/hub.js on a 'practice' request)
//   phases   per engine: the boss phase now (phaseOf), how to start at phase k (jump), the phase names (phasesFor)
//   lock     v > 0 forces the mechanic-pool seed (sim/mechpool.js makePool callers: glowmire poolFor, astralboss abInit)
// Never invulnerable: a phase start only moves the boss's HP to that phase's floor; the fight's own gates do the rest.
import { devGlow, FIGHTS as GLOW_FIGHTS, GLOW_MISSIONS } from './glowmire.js';
import { devTomb } from './tomb.js';
import { devCrypt } from './crypt.js';
import { devForge } from './forge.js';
import { devRaid, RAID } from './raid.js';
import { devTrial, MISSION_TRIALS, FIGHTS as TRIAL_FIGHTS } from './trials.js';
import { devAstrael } from './astrael.js';
import { devUlt, ULT_PH } from './ultimate.js';

export const PRACTICE = { vars: 5, restartDelay: 150, tail: 600 };
/** the practisable encounters (mission id -> engine) */
export const PRACTICE_ENCS = {
  hollow: { eng: 'glow', boss: 'Lumivex' }, vharokt: { eng: 'glow', boss: 'Vharok (Trial)' }, vharokx: { eng: 'glow', boss: 'Vharok (Extreme)' },
  tomb: { eng: 'tomb', boss: 'Neferakh, the Sun-Eaten King' }, crypt: { eng: 'crypt', boss: 'Osric, the Frost King' }, forge: { eng: 'forge', boss: 'Hephast, the Cinder Smith' },
  vorthax: { eng: 'raid', boss: 'Vorthax' }, astrael: { eng: 'astrael', boss: 'Astrael' }, astraelx: { eng: 'astrael', boss: 'Astrael (Extreme)', x: 1 },
  neferakht: { eng: 'trial', boss: 'Neferakh Unbound (Trial)' }, neferakhx: { eng: 'trial', boss: 'Neferakh Unbound (Extreme)' }, neferakhs: { eng: 'trial', boss: 'Neferakh Unbound (Savage)', astral: 1 },
  skaldrat: { eng: 'trial', boss: 'Skaldra (Trial)' }, skaldrax: { eng: 'trial', boss: 'Skaldra (Extreme)' },
  pyrrhext: { eng: 'trial', boss: 'Pyrrhex (Trial)' }, pyrrhexx: { eng: 'trial', boss: 'Pyrrhex (Extreme)' },
  ultimate: { eng: 'ult', boss: 'Aeon, the Unwritten' }, // (Part F: the Ultimate; a practice run starts at an echo you reached)
};
const TRIO = { tomb: ['The Sun-Eater', 'The Sun-Eater Rages', 'The Sun Splits'], crypt: ['The Opening', 'The Court Wakes', 'The Board Sinks'], forge: ['The Line', 'The Line Speeds Up', 'The Crucible Rises'], raid: ['Phase 1 · the Brand', 'Phase 2 · Eclipse + Soul Chain', 'Phase 3 · Everything, faster'] };
const AST_PH = ['Act I · Starfall', 'Collapse of Heaven', 'Act II · Orrery', 'Act III · Supernova', 'The Big Bang'];
const AST_SEG = ['a1', 'collapse', 'a2', 'a3', 'bigbang'];
const AST_OF = { pull: 1, a1: 1, collapse: 2, adds: 2, orrery: 2, a2: 3, ignite: 4, a3: 4, bbcine: 5, bigbang: 5, fall: 5, whiteout: 5, kill: 5 };
/** the encounter key a record lives under: the mission, '@a' in the Astral World */
export const encKey = (id, astral) => (PRACTICE_ENCS[id] ? id + (astral ? '@a' : '') : null);
export const encBase = (enc) => String(enc || '').split('@')[0];
export const encAstral = (enc) => /@a$/.test(String(enc || ''));
/** phase names of an encounter (index 0 = phase 1) */
export function phasesFor(enc) {
  const id = encBase(enc), E = PRACTICE_ENCS[id]; if (!E) return [];
  if (E.eng === 'glow') return GLOW_FIGHTS[GLOW_MISSIONS[id]].ph.map((P) => P.name);
  if (E.eng === 'trial') { const [k, x] = MISSION_TRIALS[id], F = TRIAL_FIGHTS[k];
    if (x === 2 && F.e) return [...F.s.map((P) => 'Door · ' + P.name), ...F.e.map((P) => 'Eclipse · ' + P.name)]; // (Savage v2: the door fight, then the Eclipse fight - its phases open once you reach it)
    return (x === 2 ? F.s : x ? F.x : F.n).map((P) => P.name); }
  if (E.eng === 'astrael') return AST_PH.slice();
  if (E.eng === 'ult') return ULT_PH.map((P) => P.name);
  return TRIO[E.eng].slice();
}
/** does the encounter roll mechanic variations (so a variation can be locked)? Normal-mode authored fights don't */
export function varies(enc) {
  const id = encBase(enc), E = PRACTICE_ENCS[id]; if (!E) return false;
  if (E.eng === 'ult') return true; // (the Ultimate's 'deep' pools)
  if (encAstral(enc)) return true; // (the Astral boss layer, sim/astralboss.js: a 'light' pool on every Astral boss)
  return E.eng === 'glow' && GLOW_FIGHTS[GLOW_MISSIONS[id]].lvl !== 'none';
}
// ------------------------------------------------------------------ records (pure; the account profile)
export const pracOf = (pr) => (pr.prac && typeof pr.prac === 'object' ? pr.prac : (pr.prac = {}));
export const reached = (pr, enc) => { const r = pr && pr.prac && pr.prac[enc]; return r ? Math.max(0, r.ph | 0) : 0; };
/** a real attempt reached phase `ph` (only ever raises it; capped to the fight's phase count) */
export function recordPhase(pr, enc, ph) {
  const n = phasesFor(enc).length; if (!n || !(ph >= 1)) return false;
  const R = pracOf(pr), r = R[enc] || (R[enc] = { ph: 0, n: 0 }), k = Math.min(n, ph | 0);
  if (k <= r.ph) return false; r.ph = k; return true;
}
export function recordAttempt(pr, enc) { const R = pracOf(pr), r = R[enc] || (R[enc] = { ph: 0, n: 0 }); r.n = (r.n | 0) + 1; return r.n; }
/** may this account practise `enc` from phase `ph`? (only phases reached in a real attempt) */
export const practiceOk = (pr, enc, ph) => !!PRACTICE_ENCS[encBase(enc)] && (ph | 0) >= 1 && (ph | 0) <= reached(pr, enc);
/** the practice list: every encounter with a record */
export const practiceList = (pr) => Object.keys(pracOf(pr)).filter((k) => PRACTICE_ENCS[encBase(k)] && reached(pr, k) >= 1);

// ------------------------------------------------------------------ sim side
/** the boss phase of the running encounter (0 = not at the boss yet); works on a solo sim */
export function phaseOf(sim, id = sim && sim.hub && sim.hub.m) {
  const E = PRACTICE_ENCS[id]; if (!E || !sim) return 0;
  if (E.eng === 'glow') { const G = sim.glow; return G && G.b ? G.b.phase | 0 : 0; }
  if (E.eng === 'tomb' || E.eng === 'crypt' || E.eng === 'forge') { const T = sim[E.eng]; return T && T.b ? T.b.phase | 0 : 0; }
  if (E.eng === 'raid') { const R = sim.raid; return R ? R.phase | 0 : 0; }
  if (E.eng === 'trial') { const T = sim.trial; if (!T) return 0; if (T.form) return TRIAL_FIGHTS[T.k].s.length + Math.max(1, T.ph | 0); if (T.st === 'eclipse') return TRIAL_FIGHTS[T.k].s.length + 1; return Math.max(1, T.ph | 0); }
  if (E.eng === 'astrael') { const A = sim.astrael; return A ? AST_OF[A.st] || 0 : 0; }
  if (E.eng === 'ult') { const U = sim.ult; return U && U.st !== 'pull' && U.st !== 'wipe' ? U.ph | 0 : 0; }
  return 0;
}
/** the boss of the running encounter */
export function bossNow(sim, id = sim && sim.hub && sim.hub.m) {
  const E = PRACTICE_ENCS[id]; if (!E || !sim) return null;
  const S = E.eng === 'ult' ? sim.ult : E.eng === 'astrael' ? sim.astrael : E.eng === 'trial' ? sim.trial : sim[E.eng];
  if (!S) return null; const bid = S.b ? S.b.bid : S.bid; return bid ? sim.enemyById.get(bid) || null : null;
}
const floorOf = (enc, ph) => { // the HP fraction a phase starts at
  const id = encBase(enc), E = PRACTICE_ENCS[id];
  if (E.eng === 'glow') { const P = GLOW_FIGHTS[GLOW_MISSIONS[id]].ph; return P[ph - 2] ? P[ph - 2].floor : 1; }
  if (E.eng === 'raid') return RAID.ward.at[ph - 2] ?? 1;
  if (E.eng === 'ult') return 1; // (each echo is its own boss at full HP)
  return ph === 3 ? 0.33 : ph === 2 ? 0.66 : 1;
};
/** move the running encounter to its boss, phase `ph` (dev hooks of each engine; HP to the floor, the gates do the rest) */
export function jump(sim, p, enc, ph) {
  const id = encBase(enc), E = PRACTICE_ENCS[id]; if (!E || !p) return false;
  if (E.eng === 'glow') {
    if (id === 'hollow' && !(sim.glow && sim.glow.b)) devGlow(sim, p, { room: 3 });
    const b = bossNow(sim, id); if (b && ph > 1) b.hp = Math.max(1, Math.floor(b.maxHp * floorOf(enc, ph)) - 1);
  } else if (E.eng === 'tomb' || E.eng === 'crypt' || E.eng === 'forge') {
    const dev = E.eng === 'tomb' ? devTomb : E.eng === 'crypt' ? devCrypt : devForge, T = sim[E.eng];
    if (!(T && T.b)) dev(sim, p, { room: 3 });
    const b = bossNow(sim, id); if (b && ph > 1) b.hp = Math.max(1, Math.floor(b.maxHp * (ph === 3 ? 0.32 : 0.65)));
  } else if (E.eng === 'raid') {
    devRaid(sim, p, { skipPull: 1 });
    if (ph > 1) { const b = bossNow(sim, id); if (b) b.hp = Math.max(1, Math.floor(b.maxHp * floorOf(enc, ph)) - 1); devRaid(sim, p, { phase: ph }); }
  } else if (E.eng === 'trial') { const k = MISSION_TRIALS[id], nA = k[1] === 2 && TRIAL_FIGHTS[k[0]].e ? TRIAL_FIGHTS[k[0]].s.length : 99;
    if (ph > nA) { devTrial(sim, p, { skipPull: 1, form: 1, instant: 1 }); if (ph - nA > 1) devTrial(sim, p, { ph: ph - nA }); } // (Eclipse practice: straight into the transformed fight)
    else devTrial(sim, p, { skipPull: 1, ph }); }
  else if (E.eng === 'ult') devUlt(sim, p, { ph, skipPull: 1 });
  else if (E.eng === 'astrael') devAstrael(sim, p, ph > 1 ? { seg: AST_SEG[ph - 1] } : { skipPull: 1 });
  return true;
}
/** the forced mechanic-pool seed while a variation is locked (null = the fight's own) */
export const lockedSeed = (sim, salt = 0) => (sim && sim.practice && sim.practice.v > 0 ? ((sim.practice.v * 977 + salt * 7919 + 13) >>> 0) : null);
/** arm a practice run (sim/hub.js calls this right after startMission) */
export function armPractice(sim, p, q) {
  const id = encBase(q.enc), n = phasesFor(q.enc).length, reach = Math.max(1, Math.min(n, q.reach | 0)), ph = Math.max(1, Math.min(reach, q.ph | 0 || 1));
  sim.practice = { id, enc: q.enc, ph, v: Math.max(0, Math.min(PRACTICE.vars, q.v | 0)), reach, t0: sim.tick, at: sim.tick, tries: 1, on: 0, pid: p.id, bags: new Set(sim.bags.map((b) => b.id)) };
  sim.pracTail = 0;
  for (const q2 of sim.players.values()) q2.noXp = 1;
  jump(sim, p, q.enc, ph); sim.practice.on = 1;
  sim.emit({ type: 'practice', ph: 'start', pid: p.id, enc: q.enc, phase: ph, v: sim.practice.v, n });
  return true;
}
/** restart the running practice from phase `ph` (<= reach) */
export function restartPractice(sim, p, ph, startMission) {
  const P = sim.practice; if (!P) return false;
  const k = Math.max(1, Math.min(P.reach, ph | 0 || P.ph)), keep = { ...P };
  startMission(sim, P.id, p);
  armPractice(sim, p, { enc: keep.enc, ph: k, v: keep.v, reach: keep.reach });
  sim.practice.tries = keep.tries + 1; sim.practice.t0 = keep.t0;
  return true;
}
/** combat.js killEnemy: a practice kill (no XP, no loot, no unlocks; the boss's kill ends the run) */
export function practiceKill(sim, e) { if (sim.practice) sim.practice.killed = e.id; }
/** practice over (the boss fell, you left, or a new mission): pay nothing, keep a short tail so late events are ignored too */
export function endPractice(sim, why = 'quit') {
  const P = sim.practice; if (!P) return false;
  sim.practice = null; sim.pracTail = sim.tick + PRACTICE.tail;
  for (const q of sim.players.values()) q.noXp = 0;
  sim.emit({ type: 'practice', ph: 'end', why, enc: P.enc, tries: P.tries, t: Math.round((sim.tick - P.at) / 60) });
  return true;
}
export const practiceOn = (sim) => !!(sim && (sim.practice || (sim.pracTail | 0) > (sim.tick | 0)));
const ENGINE_ST = { glow: 'glow', tomb: 'tomb', crypt: 'crypt', forge: 'forge', raid: 'raid', trial: 'trial', astrael: 'astrael', ult: 'ult' };
/** sim/hub.js, in place of "the encounter finished: home together": the encounter tore itself down (a wipe) -> restart */
export function practiceHub(sim, startMission) {
  const P = sim.practice, E = P && PRACTICE_ENCS[P.id]; if (!E) return;
  const S = sim[ENGINE_ST[E.eng]], p = sim.players.get(P.pid);
  if (p && (!S || S.over || S.st === 'done')) restartPractice(sim, p, P.ph, startMission);
}
/** per tick (sim/sim.js, after the hub, before the encounters): the boss fell -> done; a wipe reset -> back to the chosen
 *  phase; nothing ever drops (bags that appeared during practice vanish; your own dropped bags stay) */
export function updatePractice(sim, startMission, returnToTown) {
  const P = sim.practice; if (!P || sim.predicting) return;
  const p = sim.players.get(P.pid); if (!p || !sim.hub || sim.hub.m !== P.id) { endPractice(sim, 'left'); return; }
  const b = bossNow(sim, P.id), ph = phaseOf(sim, P.id), ast = P.id === 'astrael' || P.id === 'astraelx';
  const won = P.id === 'ultimate' ? !!(sim.ult && sim.ult.st === 'victory') : ast ? !!(sim.astrael && (sim.astrael.st === 'victory' || sim.astrael.st === 'kill')) : !!(P.killed && P.boss && P.killed === P.boss);
  if (won) { // (a real kill: combat.js killEnemy notes it; an encounter's own reset never counts)
    sim.emit({ type: 'practice', ph: 'clear', pid: p.id, enc: P.enc, t: Math.round((sim.tick - P.at) / 60), tries: P.tries });
    endPractice(sim, 'clear'); returnToTown(sim, 'practice'); return;
  }
  if (b && !b.dead) P.boss = b.id;
  P.top = Math.max(P.top | 0, ph);
  // the phase start, held until the boss is in its fight (some encounters set the boss's HP at the pull): HP to the floor
  if (P.on && b && !b.dead && P.ph > 1 && sim.tick - P.at < 60 * 40) { const f = floorOf(P.enc, P.ph); if (b.hp > b.maxHp * f) b.hp = Math.max(1, Math.floor(b.maxHp * f) - 1); } // (only ever lowers it to the floor; the first 40 s of a run)
  // a wipe: every hero down (or the encounter reset itself below the chosen phase) -> restart from the chosen phase
  const allDown = [...sim.players.values()].every((q) => q.dead);
  if (allDown) { P.down = (P.down | 0) + 1; if (P.down >= PRACTICE.restartDelay) { P.down = 0; restartPractice(sim, p, P.ph, startMission); } }
  else P.down = 0;
  if (P.on && P.top >= P.ph && ph > 0 && ph < P.ph) { P.top = 0; P.at = sim.tick; P.tries++; jump(sim, p, P.enc, P.ph); sim.emit({ type: 'practice', ph: 'reset', pid: p.id, enc: P.enc, phase: P.ph, tries: P.tries }); }
  if (sim.bags.length) sim.bags = sim.bags.filter((g) => g.own || P.bags.has(g.id));
  if (sim.drops && sim.drops.length) sim.drops.length = 0;
}
