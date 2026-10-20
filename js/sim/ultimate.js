// Part F (docs/ASCENSION-PLAN.md): THE ULTIMATE · "The Unwritten". The pinnacle Astral raid on the variation engine at
// 'deep' (sim/mechpool.js): 4-player with solo scaling, ~15-20 min for a typical party of four, five phases, NO mid-attempt
// checkpoints (a wipe sends the whole party back to phase 1), a hard enrage per phase, never invulnerable (no boss exists
// during an interlude; while a boss is up it is always hittable).
//   1  ECHO OF NYXARA      (the Void Matriarch)  · void web (turning), eclipse (in / out), spread / stack marks, lash combo, void tears
//   2  ECHO OF THE ORRERY  (the Shattered Orrery) · planetary alignment, a starfall spiral (cw / ccw), towers, memory, the orbit
//   3  ECHO OF ZERATH      (the Rift Herald)      · rift blink + cleave, the rift grid (rows / columns first), ruptures (in / out), charge
//   4  ECHO OF VORTHAX     (the Riftbound Tyrant) · brand -> echo, eclipse lanterns, the lanes (shift left / right), soul chains, knights
//   5  AEON, THE UNWRITTEN (the god-tier finale)  · REWRITE (earlier echoes' mechanics, reversed), the Crunch (the throne
//      shrinks), Genesis (one safe star), paradox pairs; at 15%: THE LAST PAGE (everything faster, never under the 2 s tell)
// Every variation is signalled before it lands: the call says which (TURNING ⟳ / GET IN / ROWS FIRST / SHIFT →), the
// telegraph carries the label, and the boss wears the variation's sigil (packUlt .sig, drawn by client/ultfx.js).
// Rewards are PRESTIGE ONLY (client/rewards.js + sim/ultreward.js): a title, an aura, a weapon glow, cosmetic regalia and
// the clear record on the account card. No items, no XP, no gold, no stats: the bosses and adds drop nothing (e.ult).
// Arena: the 'ul' trial disc (sim/trialconst.js TRIAL_POS.ul) so movement / zones / respawn rules are the trial ones.
import { hits, soakCount, posTele } from './telegraph.js';
import { secs } from './constants.js';
import { TRIAL_POS, TRIAL_R, trialAt } from './trialconst.js';
import { damagePlayer, respawnPlayer, evadeShove } from './combat.js';
import { spawnEnemy } from './ai.js';
import { makePool, gapOf, withTell, towers as mkTowers, marks as mkMarks, memory as mkMemory, combo as mkCombo, softEnrageT, TELL_MIN } from './mechpool.js';
import { lockedSeed } from './practice.js';
import { ENEMIES } from './data/enemies.js';

// the five bosses (HP set at spawn: ultHp). The echoes reuse the Rift bosses' art with an astral wash (client/ultfx.js).
if (!ENEMIES.ultnyx) Object.assign(ENEMIES, {
  ultnyx: { name: 'Echo of Nyxara', zone: 4, hp: 100000, dmg: 46, spd: 0, r: 60, xp: 0, def: 48, ai: 'raid', mass: 99, boss: true, raid: true, color: '#b06cff', ult: 1 },
  ultorr: { name: 'Echo of the Orrery', zone: 4, hp: 100000, dmg: 48, spd: 0, r: 64, xp: 0, def: 50, ai: 'raid', mass: 99, boss: true, raid: true, color: '#ffe27a', ult: 1 },
  ultzer: { name: 'Echo of Zerath', zone: 4, hp: 100000, dmg: 50, spd: 0, r: 70, xp: 0, def: 52, ai: 'raid', mass: 99, boss: true, raid: true, color: '#6ae6ff', ult: 1 },
  ultvor: { name: 'Echo of Vorthax', zone: 4, hp: 100000, dmg: 50, spd: 0, r: 66, xp: 0, def: 52, ai: 'raid', mass: 99, boss: true, raid: true, color: '#8f6bff', ult: 1 },
  ultaeon: { name: 'Aeon, the Unwritten', zone: 4, hp: 100000, dmg: 54, spd: 0, r: 86, xp: 0, def: 55, ai: 'raid', mass: 99, boss: true, raid: true, color: '#fff1b8', ult: 1 },
});

const TAU = Math.PI * 2, r0 = (v) => Math.round(v);
export const ARENA = { ...TRIAL_POS.ul, r: TRIAL_R };
/** tuning (tools/balance/ultimate-len.mjs): HP = hp x the phase share x the party table */
export const UL = {
  hp: 12.6e6, party: [0.8, 1.7, 2.6, 3.6, 4.4, 5.2], lvl: 'deep', pull: secs(6), inter: secs(8), wipeT: secs(5), revive: 0.5,
  lastPage: 0.15, lastK: 0.85, pairLag: 130, addHp: 0.012, soft: 1, crunch: { min: 0.55, d: secs(10) }, unmake: 120,
};
/** the five phases: boss type, names, colour, HP share, hard enrage, rotation (pairs with '+') */
export const ULT_PH = [
  { id: 'nyx', boss: 'ultnyx', name: 'Echo of Nyxara', sub: 'The Void Matriarch, remembered by the stars', short: 'NYXARA', col: '#b06cff', k: 0.95, hpK: 0.14, enr: secs(420),
    rot: ['web', 'marks', 'eclipse', 'lash', 'tears', 'web', 'eclipse', 'marks'] },
  { id: 'orr', boss: 'ultorr', name: 'Echo of the Orrery', sub: 'The Shattered Orrery turns again', short: 'ORRERY', col: '#ffe27a', k: 0.95, hpK: 0.17, enr: secs(265),
    rot: ['align', 'starfall', 'towers', 'orbit', 'memory', 'align+marks', 'starfall'] },
  { id: 'zer', boss: 'ultzer', name: 'Echo of Zerath', sub: 'The Rift Herald steps between moments', short: 'ZERATH', col: '#6ae6ff', k: 0.9, hpK: 0.18, enr: secs(275),
    rot: ['blink', 'grid', 'rupture', 'charge', 'marks', 'blink+rupture', 'grid'] },
  { id: 'vor', boss: 'ultvor', name: 'Echo of Vorthax', sub: 'The Riftbound Tyrant, unbound', short: 'VORTHAX', col: '#8f6bff', k: 0.9, hpK: 0.14, enr: secs(480),
    rot: ['brand', 'lanes', 'dusk', 'chain', 'knights', 'brand+lanes', 'dusk'] },
  { id: 'aeon', boss: 'ultaeon', name: 'Aeon, the Unwritten', sub: 'The god at the end of the page', short: 'AEON', col: '#fff1b8', k: 0.85, hpK: 0.37, enr: secs(540), final: 1,
    rot: ['rewrite', 'crunch', 'genesis', 'web+marks', 'grid+towers', 'rewrite', 'starfall+lash', 'lanes'] },
];
export const ULT_N = ULT_PH.length;
export const ULT_BOSSES = new Set(ULT_PH.map((P) => P.boss));
/** how long each mechanic holds the rotation (ticks at k = 1) and its damage (% max HP): harder than everything else */
const DUR = { web: 230, eclipse: 230, marks: 180, lash: 200, tears: 120, align: 230, starfall: 240, towers: 200, memory: 330, orbit: 210, blink: 220, grid: 250, rupture: 200, charge: 160, brand: 260, lanes: 250, dusk: 220, chain: 190, knights: 120, rewrite: 240, crunch: 300, genesis: 220 };
const PCT = { web: 0.42, eclipse: 0.55, spread: 0.3, spreadx: 0.6, stack: 0.24, stackx: 0.7, lash: 0.45, burst: 0.3, align: 0.45, star: 0.38, tower: 0.16, towerx: 0.5, mem: 0.5, orbit: 0.6, blink: 0.55, grid: 0.4, rupture: 0.4, charge: 0.5, echo: 0.45, lane: 0.45, dusk: 0.65, chain: 0.4, crunch: 0.14, genesis: 0.75, unmake: 1 };
const TXT = {
  web: 'VOID WEB', eclipse: 'ECLIPSE', marks: 'VOID MARKS', lash: 'VOID LASH', tears: 'VOID TEARS', align: 'ALIGNMENT', starfall: 'STARFALL', towers: 'STAR TOWERS', memory: 'ORRERY MEMORY', orbit: 'THE ORBIT',
  blink: 'RIFT BLINK', grid: 'RIFT GRID', rupture: 'RUPTURE', charge: 'HERALD\'S CHARGE', brand: 'TYRANT\'S BRAND', lanes: 'THE LANES', dusk: 'ECLIPSE OF THE TYRANT', chain: 'SOUL CHAINS', knights: 'ASTRAL KNIGHTS',
  rewrite: 'REWRITE', crunch: 'THE CRUNCH', genesis: 'GENESIS',
};
const REWRITES = ['web', 'starfall', 'grid', 'lanes', 'eclipse', 'rupture'];

// ------------------------------------------------------------------ helpers
const inUlt = (p) => trialAt(p.x, p.y, 120) === 'ul';
export const inUltArea = (x, y, pad = 300) => trialAt(x, y, pad) === 'ul';
const here = (sim) => [...sim.players.values()].filter((p) => !p.dead && sim.ult && sim.ult.party.includes(p.id) && inUlt(p));
const present = (sim) => [...sim.players.values()].filter((p) => sim.ult && sim.ult.party.includes(p.id) && inUlt(p));
const bossOf = (sim) => sim.ult && sim.ult.bid ? sim.enemyById.get(sim.ult.bid) : null;
const phOf = (U) => ULT_PH[U.ph - 1];
function place(p, i = 0) { const A = ARENA, o = ((i % 5) - 2) * 34; p.x = p.px = A.x + o; p.y = p.py = A.y + A.r * 0.62 + Math.floor(i / 5) * 30; p.vx = p.vy = 0; p.iframes = Math.max(p.iframes || 0, 60); p.action = null; }
function call(sim, txt, sub, col, t = 150) { const U = sim.ult; U.call = { txt, sub: sub || '', col: col || '#fff', t, d: t }; sim.emit({ type: 'unw', ph: 'call', txt, sub: sub || '', col: col || '#fff', x: ARENA.x, y: ARENA.y }); }
const nearest = (b, ps) => ps.reduce((m, p) => (!m || Math.hypot(p.x - b.x, p.y - b.y) < Math.hypot(m.x - b.x, m.y - b.y) ? p : m), null);
const furthest = (b, ps) => ps.reduce((m, p) => (!m || Math.hypot(p.x - b.x, p.y - b.y) > Math.hypot(m.x - b.x, m.y - b.y) ? p : m), null);
/** the party size the HP / towers scale by (at least 1, at most 6) */
const partyN = (U) => Math.max(1, Math.min(6, U.n || 1));
export const ultHp = (ph, n) => Math.round(UL.hp * ULT_PH[ph - 1].hpK * (UL.party[Math.max(1, Math.min(6, n)) - 1]));

// ------------------------------------------------------------------ entry / exit
export function enterUlt(sim, p) {
  if (sim.predicting || !p) return false;
  if (p.dead) respawnPlayer(sim, p);
  if (!sim.ult || sim.ult.st === 'done') startUlt(sim);
  const U = sim.ult;
  if (!U.party.includes(p.id)) U.party.push(p.id);
  place(p, U.party.indexOf(p.id)); p.hp = p.stats.maxHp;
  sim.emit({ type: 'unw', ph: 'enter', pid: p.id, x: r0(p.x), y: r0(p.y) });
  return true;
}
export function startUlt(sim, start = 1) {
  endUlt(sim, null);
  sim.ult = { st: 'pull', ph: Math.max(1, Math.min(ULT_N, start | 0 || 1)), start: Math.max(1, Math.min(ULT_N, start | 0 || 1)), at: 0, t: 0, tt: 0, party: [], attempts: 0, bid: 0, tele: [], lanes: [], tid: 1, call: null, enr: 0, enraged: false, next: 0, rot: 0, pool: null, sig: null, hits: {}, n: 1, times: [], over: null, killed: 0, crunch: null, last: false, empty: 0 };
  call(sim, 'THE ULTIMATE · THE UNWRITTEN', 'Five echoes, one god · no checkpoints · every variation is signalled', '#fff1b8', UL.pull);
  sim.emit({ type: 'unw', ph: 'pull', x: ARENA.x, y: ARENA.y, t: UL.pull });
  return sim.ult;
}
function clearField(sim) {
  for (const e of sim.enemies) if (!e.dead && e.ult) { e.dead = true; e.hp = 0; }
  for (const pr of sim.projectiles) if (inUltArea(pr.x, pr.y)) pr.dead = true;
  for (const a of sim.areas) if (inUltArea(a.x, a.y)) a.dead = true;
}
export function endUlt(sim, why = 'quit') {
  if (!sim.ult) return;
  clearField(sim);
  if (why) sim.emit({ type: 'unw', ph: 'end', why, x: ARENA.x, y: ARENA.y });
  sim.ult = null;
}
/** combat.js killEnemy: an Ultimate enemy fell (no XP, no loot: prestige only) */
export function ultKill(sim, e) { if (sim.ult && e.id === sim.ult.bid) sim.ult.killed = e.id; }

// ------------------------------------------------------------------ per tick
export function updateUlt(sim) {
  const U = sim.ult; if (!U || sim.predicting) return;
  U.t++;
  if (U.call && --U.call.t <= 0) U.call = null;
  const ps = here(sim);
  for (const p of present(sim)) if (p.dead && U.st !== 'victory') { p.respawnAt = sim.tick + 30; p.trHold = 1; } // (the fallen wait: revived at the next phase / the retry)
  if (U.st === 'victory') { U.at++; return; }
  if (U.st === 'wipe') { if (++U.at >= UL.wipeT) retry(sim, U); return; }
  if (U.st === 'pull' || U.st === 'inter') { if (--U.at <= 0 || U.st === 'pull' && U.t >= UL.pull) spawnPhase(sim, U, ps); return; }
  // the fight
  const b = bossOf(sim);
  if (!present(sim).some((p) => !p.dead)) { if (++U.empty > 90) return void wipe(sim, U, b); } else U.empty = 0;
  if (!b || b.dead || U.killed === U.bid) { phaseDone(sim, U); return; }
  U.tt++; U.pt++;
  if (b.hitstop > 10) b.hitstop = 10;
  if (!U.moving) { b.x = b.homeX; b.y = b.homeY; } b.vx = b.vy = 0;
  const P = phOf(U);
  if (P.final && !U.last && b.hp <= b.maxHp * UL.lastPage) { U.last = true; call(sim, 'THE LAST PAGE', 'Aeon writes faster · everything speeds up (the tells never drop under 2 s)', '#ff5e7a', 200); sim.emit({ type: 'unw', ph: 'last', x: r0(b.x), y: r0(b.y) }); }
  // the hard enrage (per phase): THE UNMAKING, again and again
  if (U.enr > 0 && --U.enr === 0) { U.enraged = true; call(sim, 'THE UNMAKING', `${P.short} ran out the clock · the page tears`, '#ff3b3b', 240); sim.emit({ type: 'unw', ph: 'enrage', x: r0(b.x), y: r0(b.y) }); }
  if (U.enraged && U.pt % UL.unmake === 0) tele(U, { k: 'unmake', sh: 'circle', x: ARENA.x, y: ARENA.y, r: ARENA.r + 120, d: 60, pct: PCT.unmake, what: 'Unmaking', warn: 0 }, true);
  if (--U.next <= 0) {
    if (!U.pool) U.pool = poolFor(sim, U);
    const pick = U.pool.next(), parts = pick.key.split('+');
    U.v = pick.v; U.flip = pick.flip; U.rot++;
    U.sig = null;
    // a paradox pair: the second mechanic starts one beat later (shown at once, but it never resolves on top of the first)
    // (the second is shown while the first is still pending and resolves >= 1 s after the first's last hit: never both at once)
    let lag = 0;
    parts.forEach((k, i) => { const n0 = U.tele.length; U.atAdd = i ? lag : 0; runMech(sim, U, b, k, ps); if (!i && parts.length > 1) lag = Math.max(D(U, UL.pairLag) - 60, ...U.tele.slice(n0).map((t) => t.d - t.t), ...U.lanes.filter((L) => L.at).map((L) => L.at - U.pt + TELL_MIN)) - 60; }); U.atAdd = 0;
    const Kk = (U.last ? UL.lastK : 1) * P.k;
    const end = Math.max(0, ...U.tele.filter((t) => !t.done).map((t) => t.d - t.t), ...U.lanes.filter((L) => L.at).map((L) => L.at - U.pt + TELL_MIN), U.crunch ? U.crunch.d + 90 - U.crunch.t : 0);
    U.next = Math.max(gapOf(Math.round(Math.max(...parts.map((k) => DUR[k] || 180)) * Kk) + 30 + lag, UL.lvl), end + 45); // (never on top of the last one's tail)
  }
  tickSoft(sim, U, ps);
  tickLanes(sim, U, b, ps);
  tickCrunch(sim, U, ps);
  tickTele(sim, U, b, ps);
}
function poolFor(sim, U) { const L = lockedSeed(sim, U.ph); return makePool(phOf(U).rot, UL.lvl, L != null ? L : ((sim.seed | 0) * 131 + (U.attempts + 1) * 977 + U.ph * 7919) >>> 0); }
function spawnPhase(sim, U, ps) {
  const P = phOf(U), A = ARENA;
  U.st = 'fight'; U.pt = 0; U.tele = []; U.lanes = []; U.crunch = null; U.moving = 0; U.sig = null; U.killed = 0; U.enraged = false; U.last = false; U.rot = 0;
  U.n = Math.max(1, ps.length || present(sim).length || 1);
  const b = spawnEnemy(sim, P.boss, A.x, A.y - A.r * 0.3, { zoneHp: false });
  const hp = ultHp(U.ph, U.n);
  b.maxHp = b.hp = b.baseMaxHp = hp; b.cd = 1e6; b.raidHold = 1e6; b.face = Math.PI / 2; b.dropChance = 0; b.xp = 0; b.homeX = b.x; b.homeY = b.y; b.ult = 1; b.ultPh = U.ph;
  U.bid = b.id; U.enr = P.enr; U.next = 150; U.pool = poolFor(sim, U); U.phT0 = U.tt;
  call(sim, P.name.toUpperCase(), `Phase ${U.ph} / ${ULT_N} · ${P.sub}`, P.col, 200);
  sim.emit({ type: 'unw', ph: 'phase', phase: U.ph, id: P.id, x: r0(b.x), y: r0(b.y), hp, n: U.n });
  sim.emit({ type: 'bossPhase', phase: U.ph, x: b.x, y: b.y, id: b.id, raid: true });
}
function reviveFallen(sim, U) {
  present(sim).forEach((p, i) => { if (!p.dead) return; respawnPlayer(sim, p); place(p, i); p.hp = Math.round(p.stats.maxHp * UL.revive); p.trHold = 0; sim.emit({ type: 'unw', ph: 'revive', pid: p.id, x: r0(p.x), y: r0(p.y) }); });
}
function phaseDone(sim, U) {
  const P = phOf(U), secsT = Math.round((U.tt - (U.phT0 | 0)) / 60);
  U.times[U.ph - 1] = secsT;
  clearField(sim); U.tele = []; U.lanes = []; U.crunch = null; U.sig = null; U.bid = 0;
  if (U.ph >= ULT_N) return void victory(sim, U);
  call(sim, `${P.short} IS UNWRITTEN`, `Phase ${U.ph} cleared in ${Math.floor(secsT / 60)}:${String(secsT % 60).padStart(2, '0')} · next: ${ULT_PH[U.ph].name} · the fallen rise`, '#fff1b8', UL.inter);
  sim.emit({ type: 'unw', ph: 'shatter', phase: U.ph, t: secsT, x: ARENA.x, y: ARENA.y - ARENA.r * 0.3 });
  U.ph++; U.st = 'inter'; U.at = UL.inter;
  reviveFallen(sim, U);
}
function wipe(sim, U, b) {
  U.st = 'wipe'; U.at = 0; U.tele = []; U.lanes = []; U.crunch = null; U.sig = null;
  if (b) { b.dead = true; b.hp = 0; }
  clearField(sim); U.bid = 0;
  call(sim, 'THE PAGE IS BLANK', `The party fell in phase ${U.ph} · no checkpoints: back to ${ULT_PH[U.start - 1].name}`, '#ff8a7a', UL.wipeT);
  sim.emit({ type: 'unw', ph: 'wipe', phase: U.ph, attempts: U.attempts + 1, x: ARENA.x, y: ARENA.y });
}
function retry(sim, U) {
  U.attempts++; U.ph = U.start; U.st = 'inter'; U.at = secs(3); U.tt = 0; U.times = [];
  present(sim).forEach((p, i) => { if (p.dead) respawnPlayer(sim, p); place(p, i); p.hp = p.stats.maxHp; p.res = p.stats.maxRes; p.trHold = 0; });
  call(sim, `ATTEMPT ${U.attempts + 1}`, `${ULT_PH[U.ph - 1].name} again · the rotation is reshuffled`, '#fff1b8', secs(3));
  sim.emit({ type: 'unw', ph: 'retry', attempts: U.attempts, x: ARENA.x, y: ARENA.y });
}
/** the unlock a clear grants (client/rewards.js keeps the record; sim/ultreward.js the prestige looks) */
export const ULT_CLEAR_KEY = 'ultc';
function victory(sim, U) {
  U.st = 'victory'; U.at = 0;
  const t = Math.round(U.tt / 60), n = U.n;
  call(sim, 'THE UNWRITTEN FALLS', `The Ultimate cleared in ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} · ${U.attempts + 1} attempt${U.attempts ? 's' : ''} · prestige only: the title, the aura and the regalia are yours`, '#fff1b8', 420);
  for (const id of U.party) {
    const p = sim.players.get(id); if (!p || sim.practice) continue; // (practice pays nothing: no unlock)
    p.unlocks = p.unlocks || {}; const fresh = !p.unlocks[ULT_CLEAR_KEY]; p.unlocks[ULT_CLEAR_KEY] = 1;
    sim.emit({ type: 'unlock', pid: p.id, key: ULT_CLEAR_KEY, fresh: fresh ? 1 : 0, x: ARENA.x, y: ARENA.y });
  }
  sim.emit({ type: 'unw', ph: 'victory', t, n, attempts: U.attempts, times: U.times.slice(), start: U.start, x: ARENA.x, y: ARENA.y });
}

// ------------------------------------------------------------------ telegraphs
const POS_K = new Set(['web', 'star', 'blink']); // (position checks evade can't solve: Void Web, Starfall, Rift Cleave)
function tele(U, spec, raw = false) { if (POS_K.has(spec.k)) spec = { ...spec, pos: 1 }; const t = raw ? { id: U.tid++, t: 0, ...spec } : withTell({ id: U.tid++, t: 0, ...spec }); const at = (spec.at || 0) + (U.atAdd || 0); if (at) t.t = -at; U.tele.push(t); return t; }
const K = (U) => (U.last ? UL.lastK : 1) * phOf(U).k;
const D = (U, d) => Math.max(TELL_MIN, r0(d * K(U))); // (every hit tells for at least 2 s)
/** the variation sigil the boss wears until the mechanic resolves (the tell: the HUD / boss art read it) */
const sig = (U, s) => { U.sig = s; };
/** a safe spot / tower never sits under the boss's body (it blocks heroes): fair placements only */
const clear = (b, x, y, r) => !b || Math.hypot(x - b.x, y - b.y) > b.r + r + 20;
function runMech(sim, U, b, k, ps) {
  const A = ARENA, P = phOf(U), rnd = U.pool ? U.pool.rnd : () => sim.rng.next(), flip = !!U.flip, v = U.v | 0;
  let name = TXT[k] || k.toUpperCase(), sub = '';
  if (k === 'rewrite') { k = REWRITES[Math.floor(rnd() * REWRITES.length)]; name = 'REWRITE · ' + TXT[k]; U.flip = !U.flip; } // (Aeon rewrites an echo's mechanic, reversed)
  const fl = k === 'rewrite' ? flip : !!U.flip;
  if (k === 'web') { // three lines through the throne, then the same web turned 20° one way (the sigil says which)
    const a0 = rnd() * Math.PI, dir = fl ? -1 : 1, L = A.r * 2 + 160, w = 96;
    for (let i = 0; i < 3; i++) { const a = a0 + i * Math.PI / 3; tele(U, { k: 'web', sh: 'rect', x: r0(A.x - Math.cos(a) * L / 2), y: r0(A.y - Math.sin(a) * L / 2), ang: a, len: L, w, d: D(U, 150), pct: PCT.web, what: 'Void Web', tell: i ? '' : dir > 0 ? 'TURNS ⟳' : 'TURNS ⟲' }); }
    for (let i = 0; i < 3; i++) { const a = a0 + i * Math.PI / 3 + dir * 0.35; tele(U, { k: 'web', sh: 'rect', x: r0(A.x - Math.cos(a) * L / 2), y: r0(A.y - Math.sin(a) * L / 2), ang: a, len: L, w, d: D(U, 150), pct: PCT.web, what: 'Void Web', at: D(U, 70) }); }
    sig(U, dir > 0 ? 'cw' : 'ccw'); sub = dir > 0 ? 'The web turns CLOCKWISE · stand where the first lines were, then step clockwise' : 'The web turns ANTI-CLOCKWISE · stand where the first lines were, then step anti-clockwise';
  } else if (k === 'eclipse') { // everyone is drawn in, then GET OUT (nova) or GET IN (the rim burns)
    const out = v === 0;
    U.lanes.push({ k: 'pull', until: U.pt + 70, s: 1.4 });
    if (out) tele(U, { k: 'eclipse', sh: 'circle', x: A.x, y: A.y, r: 300, d: D(U, 170), pct: PCT.eclipse, what: 'Eclipse', tell: 'GET OUT' });
    else tele(U, { k: 'eclipse', sh: 'ring', x: A.x, y: A.y, r0: 230, r: A.r + 120, d: D(U, 170), pct: PCT.eclipse, what: 'Eclipse', tell: 'GET IN' });
    sig(U, out ? 'out' : 'in'); sub = out ? 'A void nova at the centre · GET OUT' : 'The rim burns · GET IN to the centre';
  } else if (k === 'marks' || k === 'chain') {
    const stack = k === 'marks' && v === 1 && ps.length > 1, big = k === 'chain';
    for (const t of mkMarks(ps, rnd, stack, D(U, 160))) tele(U, { ...t, r: big ? 200 : t.r, pct: stack ? PCT.stack : big ? PCT.chain : PCT.spread, what: stack ? 'Void Stack' : big ? 'Soul Chain' : 'Void Mark' });
    sig(U, stack ? 'stack' : 'spread'); sub = stack ? 'STACK on the marked hero · share it' : big ? 'Wide chains on everyone · keep far apart' : 'SPREAD · keep your mark off everyone';
  } else if (k === 'lash') {
    const p = nearest(b, ps); if (!p) return;
    for (const t of mkCombo({ x: r0(b.x), y: r0(b.y) }, Math.atan2(p.y - b.y, p.x - b.x), fl, D(U, 175), r0(100 * K(U)))) tele(U, { ...t, pct: PCT.lash, what: 'Void Lash' });
    sig(U, fl ? 'back' : 'front'); sub = fl ? 'BEHIND first, then the front' : 'FRONT first, then behind';
  } else if (k === 'tears' || k === 'knights') {
    const n = Math.min(6, 1 + partyN(U)), tp = k === 'tears' ? 'voidling' : 'astralknight';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd(), x = A.x + Math.cos(a) * (A.r - 90), y = A.y + Math.sin(a) * (A.r - 90);
      const e = spawnEnemy(sim, tp, x, y, { zoneHp: false, mul: 1 }); const hp = Math.round(UL.hp * UL.addHp * (k === 'knights' ? 1.1 : 1) * UL.party[partyN(U) - 1] / n); // (the party table: solo adds die as fast as a party's)
      e.maxHp = e.hp = e.baseMaxHp = hp; e.ult = 1; e.xp = 0; e.dropChance = 0; e.homeX = A.x; e.homeY = A.y; const t = ps[i % Math.max(1, ps.length)]; if (t) e.aggroId = t.id;
    }
    U.soft = U.pt + Math.round(softEnrageT(ps.length) * UL.soft); sub = 'Kill them before they burst on the party';
  } else if (k === 'align') { // the planets line up through every hero, igniting in order
    const order = ps.slice().sort(() => rnd() - 0.5);
    order.forEach((p, i) => { const a = Math.atan2(p.y - A.y, p.x - A.x); tele(U, { k: 'align', sh: 'rect', x: A.x, y: A.y, ang: a, len: A.r + 80, w: 130, d: D(U, 130) + i * r0(40 * K(U)), pct: PCT.align, what: 'Alignment', tell: String(i + 1) }); });
    if (ps.length === 1) tele(U, { k: 'align', sh: 'rect', x: A.x, y: A.y, ang: Math.atan2(ps[0].y - A.y, ps[0].x - A.x) + Math.PI, len: A.r + 80, w: 130, d: D(U, 170), pct: PCT.align, what: 'Alignment', tell: '2' });
    sub = 'Lines from the throne through each of you, in order · step aside';
  } else if (k === 'starfall') { // a spiral of falling stars, clockwise or anti-clockwise from the north
    const dir = fl ? -1 : 1; let a = -Math.PI / 2;
    for (let i = 0; i < 12; i++) { const rr = 80 + i * (A.r - 120) / 12; tele(U, { k: 'star', sh: 'circle', x: r0(A.x + Math.cos(a) * rr), y: r0(A.y + Math.sin(a) * rr), r: 115, d: D(U, 120) + i * 12, pct: PCT.star, what: 'Starfall', tell: i ? '' : dir > 0 ? 'SPIRAL ⟳' : 'SPIRAL ⟲' }); a += dir * 0.62; }
    sig(U, dir > 0 ? 'cw' : 'ccw'); sub = dir > 0 ? 'The spiral turns CLOCKWISE from the north · chase it' : 'The spiral turns ANTI-CLOCKWISE from the north · chase it';
  } else if (k === 'towers') {
    let T = mkTowers(A, partyN(U), rnd, D(U, 240));
    if (T.some((t) => !clear(b, t.x, t.y, t.r))) { const da = Math.PI / T.length; T = T.map((t) => { const a = Math.atan2(t.y - A.y, t.x - A.x) + da, d = Math.hypot(t.x - A.x, t.y - A.y); return { ...t, x: r0(A.x + Math.cos(a) * d), y: r0(A.y + Math.sin(a) * d) }; }); }
    for (const t of T) tele(U, { ...t, pct: PCT.tower, what: 'Star Tower' });
    sub = 'One hero in each tower · an empty tower hits everyone';
  } else if (k === 'memory') {
    const M = mkMemory(A.x, A.y, 4, rnd); for (const t of M.tele) tele(U, { ...t, pct: PCT.mem, what: 'Orrery Memory' });
    sub = 'Watch the four quarters light up · then dodge them in that order';
  } else if (k === 'orbit') { // two safe planets on the orbit; everything else burns
    let a = rnd() * TAU; const R = A.r * 0.55; for (let k = 0; k < 8 && !(clear(b, A.x + Math.cos(a) * R, A.y + Math.sin(a) * R, 125) && clear(b, A.x - Math.cos(a) * R, A.y - Math.sin(a) * R, 125)); k++) a += 0.5;
    const c = [[r0(A.x + Math.cos(a) * R), r0(A.y + Math.sin(a) * R), 125], [r0(A.x + Math.cos(a + Math.PI) * R), r0(A.y + Math.sin(a + Math.PI) * R), 125]];
    tele(U, { k: 'orbit', sh: 'safe', x: A.x, y: A.y, c, d: D(U, 190), pct: PCT.orbit, what: 'The Orbit' }); sub = 'Only the two planets are safe · get onto one';
  } else if (k === 'blink') { // a rift mark on one hero; Zerath steps out behind them and cleaves toward the throne
    const p = ps.length ? ps[Math.floor(rnd() * ps.length)] : null; if (!p) return;
    tele(U, { k: 'blinkmark', sh: 'circle', pid: p.id, x: r0(p.x), y: r0(p.y), r: 60, d: D(U, 130), pct: 0, what: 'Rift Mark', warn: 1, tell: 'MARKED' });
    U.lanes.push({ k: 'blink', at: U.pt + D(U, 130) + (U.atAdd || 0), pid: p.id }); sub = 'The marked hero: face the rim · Zerath appears behind you and cleaves inward';
  } else if (k === 'grid') { // rift tears: rows then columns, or columns then rows (the sigil says which)
    const rows = v === 0, L = A.r * 2 + 160, xs = [-1.5, -0.5, 0.5, 1.5].map((q) => q * 250);
    const lines = (horiz, d0, at) => xs.forEach((o, i) => { if (i % 2) return; const ang = horiz ? 0 : Math.PI / 2; tele(U, { k: 'grid', sh: 'rect', x: r0(horiz ? A.x - L / 2 : A.x + o), y: r0(horiz ? A.y + o : A.y - L / 2), ang, len: L, w: 200, d: d0, pct: PCT.grid, what: 'Rift Grid', at }); });
    const lines2 = (horiz, d0, at) => xs.forEach((o, i) => { if (!(i % 2)) return; const ang = horiz ? 0 : Math.PI / 2; tele(U, { k: 'grid', sh: 'rect', x: r0(horiz ? A.x - L / 2 : A.x + o), y: r0(horiz ? A.y + o : A.y - L / 2), ang, len: L, w: 200, d: d0, pct: PCT.grid, what: 'Rift Grid', at }); });
    lines(rows, D(U, 150), 0); lines2(!rows, D(U, 150), D(U, 60));
    U.tele[U.tele.length - 1].tell = rows ? 'ROWS FIRST' : 'COLUMNS FIRST';
    sig(U, rows ? 'rows' : 'cols'); sub = rows ? 'ROWS first, then columns · read the first tears' : 'COLUMNS first, then rows · read the first tears';
  } else if (k === 'rupture') { // three rings race outward from the throne, or inward from the rim
    const out = v === 0, rings = [[0, 180], [180, 360], [360, A.r + 80]];
    (out ? rings : rings.slice().reverse()).forEach(([a, c], i) => tele(U, { k: 'rupture', sh: a ? 'ring' : 'circle', x: A.x, y: A.y, r0: a, r: c, d: D(U, 120) + i * r0(50 * K(U)), pct: PCT.rupture, what: 'Rupture', tell: i ? '' : out ? 'OUTWARD' : 'INWARD' }));
    sig(U, out ? 'out' : 'in'); sub = out ? 'OUTWARD · start at the rim, step in behind the wave' : 'INWARD · start at the centre, step out behind the wave';
  } else if (k === 'charge') {
    const p = furthest(b, ps); if (!p) return;
    const ang = Math.atan2(p.y - b.y, p.x - b.x);
    tele(U, { k: 'charge', sh: 'rect', x: r0(b.x), y: r0(b.y), ang, len: A.r * 1.6, w: 180, d: D(U, 130), pct: PCT.charge, kb: 300, what: 'Herald\'s Charge', tell: 'CHARGE' }); sub = 'He charges the furthest hero · get out of the lane';
  } else if (k === 'brand') { // spread brands, then an echo blast where each brand went off
    for (const t of mkMarks(ps, rnd, false, D(U, 160))) { tele(U, { ...t, pct: PCT.spread, what: 'Tyrant\'s Brand' }); U.lanes.push({ k: 'echo', at: U.pt + D(U, 160) + (U.atAdd || 0), pid: t.pid }); }
    sub = 'Spread the brands · then MOVE: an echo hits where each one burst';
  } else if (k === 'lanes') { // five lanes, one safe, then the safe lane shifts one step (left / right: the sigil)
    const w = (A.r * 2) / 5, safe = Math.floor(rnd() * 3) + 1, dir = fl ? -1 : 1, s2 = safe + dir, L = A.r * 2 + 160;
    for (let i = 0; i < 5; i++) { if (i !== safe) tele(U, { k: 'lane', sh: 'rect', x: r0(A.x - A.r + w * (i + 0.5)), y: r0(A.y - L / 2), ang: Math.PI / 2, len: L, w: w - 6, d: D(U, 150), pct: PCT.lane, what: 'The Lanes', tell: i === 0 ? (dir > 0 ? 'SHIFT →' : 'SHIFT ←') : '' }); }
    for (let i = 0; i < 5; i++) { if (i !== s2) tele(U, { k: 'lane', sh: 'rect', x: r0(A.x - A.r + w * (i + 0.5)), y: r0(A.y - L / 2), ang: Math.PI / 2, len: L, w: w - 6, d: D(U, 150), pct: PCT.lane, what: 'The Lanes', at: D(U, 60) }); }
    sig(U, dir > 0 ? 'right' : 'left'); sub = dir > 0 ? 'Stand in the safe lane · then SHIFT one lane RIGHT' : 'Stand in the safe lane · then SHIFT one lane LEFT';
  } else if (k === 'dusk' || k === 'genesis') { // lanterns (two safe lights) / Genesis (one safe star, far from the furthest hero)
    const n = k === 'genesis' ? 1 : 2, c = [];
    if (k === 'genesis') { const f = furthest({ x: A.x, y: A.y }, ps) || { x: A.x, y: A.y + 1 }, a = Math.atan2(f.y - A.y, f.x - A.x) + Math.PI * (0.5 + rnd()); let x = 0, y = 0; for (let k = 0; k < 8; k++) { const aa = a + k * 0.7; x = r0(A.x + Math.cos(aa) * A.r * 0.5); y = r0(A.y + Math.sin(aa) * A.r * 0.5); if (clear(b, x, y, 150)) break; } c.push([x, y, 150]); }
    else for (let i = 0; i < n; i++) { let x = A.x, y = A.y; for (let k = 0; k < 12; k++) { const a = rnd() * TAU, d = 140 + rnd() * (A.r - 300); x = r0(A.x + Math.cos(a) * d); y = r0(A.y + Math.sin(a) * d); if (clear(b, x, y, 120) && c.every(([u, w]) => Math.hypot(u - x, w - y) > 300)) break; } c.push([x, y, 120]); }
    tele(U, { k, sh: 'safe', x: A.x, y: A.y, c, d: D(U, k === 'genesis' ? 200 : 180), pct: k === 'genesis' ? PCT.genesis : PCT.dusk, what: k === 'genesis' ? 'Genesis' : 'Eclipse of the Tyrant' });
    sub = k === 'genesis' ? 'Everything is unwritten but one star · reach it' : 'Only the lanterns\' light is safe';
  } else if (k === 'crunch') { // the throne shrinks to 55% and opens again; outside the wall hurts
    U.crunch = { t: -TELL_MIN, d: UL.crunch.d, cur: A.r };
    tele(U, { k: 'crunchwarn', sh: 'ring', x: A.x, y: A.y, r0: r0(A.r * UL.crunch.min), r: A.r + 60, d: TELL_MIN, pct: 0, what: 'The Crunch', warn: 1, tell: 'THE PAGE FOLDS' });
    sub = 'The throne folds in · stay inside the shrinking circle';
  }
  call(sim, name, sub, P.col, 120);
  sim.emit({ type: 'unw', ph: 'cast', k, sig: U.sig, x: r0(b.x), y: r0(b.y), phase: U.ph });
}
function tickSoft(sim, U, ps) {
  if (!U.soft) return;
  const live = sim.enemies.filter((e) => !e.dead && e.ult && e.id !== U.bid);
  if (!live.length) { U.soft = 0; return; }
  if (U.pt < U.soft) return;
  U.soft = 0; call(sim, 'THEY BURST', `${live.length} left alive · kill the adds before the bar runs out`, '#ff4d5e', 120);
  for (const e of live) { e.dead = true; e.hp = 0; } for (const p of ps) hit(sim, U, p, Math.min(0.9, PCT.burst * live.length), 'add burst', null);
  sim.emit({ type: 'unw', ph: 'burst', n: live.length, x: ARENA.x, y: ARENA.y });
}
function tickLanes(sim, U, b, ps) {
  const A = ARENA;
  for (const L of U.lanes) {
    if (L.k === 'pull' && U.pt < L.until) for (const p of ps) { const dx = A.x - p.x, dy = A.y - p.y, d = Math.hypot(dx, dy); if (d > 60 && !evadeShove(sim, p)) { p.x += dx / d * L.s; p.y += dy / d * L.s; } }
    if (L.k === 'blink' && !L.done && U.pt >= L.at) {
      L.done = 1; const p = sim.players.get(L.pid); if (!p || !b) continue;
      const a = Math.atan2(p.y - A.y, p.x - A.x), d = Math.min(A.r - 60, Math.hypot(p.x - A.x, p.y - A.y) + 150);
      b.x = b.px = b.homeX = r0(A.x + Math.cos(a) * d); b.y = b.py = b.homeY = r0(A.y + Math.sin(a) * d);
      tele(U, { k: 'blink', sh: 'cone', x: b.x, y: b.y, ang: a + Math.PI, arc: 1.3, r: 520, d: TELL_MIN, pct: PCT.blink, what: 'Rift Cleave', tell: 'CLEAVE' });
      sim.emit({ type: 'unw', ph: 'blink', x: b.x, y: b.y });
    }
    if (L.k === 'echo' && !L.done && U.pt >= L.at) { L.done = 1; const p = sim.players.get(L.pid); if (p) tele(U, { k: 'echo', sh: 'circle', x: r0(p.x), y: r0(p.y), r: 140, d: TELL_MIN, pct: PCT.echo, what: 'Brand Echo', tell: 'ECHO' }); }
  }
  U.lanes = U.lanes.filter((L) => (L.k === 'pull' ? U.pt < L.until : !L.done));
}
function tickCrunch(sim, U, ps) {
  const C = U.crunch; if (!C) return;
  const A = ARENA; C.t++;
  if (C.t < 0) return;
  if (C.t > C.d + 90) { U.crunch = null; return; }
  const half = C.d / 2, k = C.t < half ? C.t / half : C.t < C.d ? 1 : 1 - (C.t - C.d) / 90;
  C.cur = r0(A.r - (A.r - A.r * UL.crunch.min) * Math.min(1, k));
  if (C.t % 30 === 0) for (const p of ps) if (Math.hypot(p.x - A.x, p.y - A.y) > C.cur + 4) hit(sim, U, p, PCT.crunch, 'the Crunch', null);
}
export const ultTeleHits = (t, p) => hits(t.sh === 'cone' ? { ...t, core: 40 } : t, p);
function tickTele(sim, U, b, ps) {
  for (const t of U.tele) {
    t.t++;
    if (t.pid != null && !t.done) { const q = sim.players.get(t.pid); if (q && !q.dead) { t.x = r0(q.x); t.y = r0(q.y); } }
    if (t.sh === 'tower' && !t.done) t.have = soakCount(t, ps);
    if (t.t !== t.d || t.done) continue;
    t.done = true;
    if (t.warn) continue;
    sim.posCheck = posTele(t) ? 1 : 0;
    if (t.sh === 'tower' || t.sh === 'stack' || t.sh === 'spread') { resolveShare(sim, U, t, ps); sim.emit({ type: 'unw', ph: 'boom', k: t.k, sh: t.sh, x: r0(t.x), y: r0(t.y), r: t.r }); continue; }
    for (const p of ps) if (ultTeleHits(t, p)) hit(sim, U, p, t.pct, t.what, t.sh === 'circle' || t.sh === 'cone' ? { x: t.x, y: t.y } : null, t.kb);
    sim.emit({ type: 'unw', ph: 'boom', k: t.k, sh: t.sh, x: r0(t.x), y: r0(t.y), r: t.r, ang: t.ang, len: t.len });
  }
  sim.posCheck = 0;
  U.tele = U.tele.filter((t) => !t.done || t.t < t.d + 30);
  if (!U.tele.some((t) => !t.done && !t.warn) && !U.lanes.length && !U.crunch) U.sig = U.sig && U.next > 30 ? U.sig : null;
}
function resolveShare(sim, U, t, ps) {
  const inside = ps.filter((p) => ultTeleHits({ ...t, sh: 'circle' }, p));
  if (t.sh === 'tower') { if (inside.length >= (t.n || 1)) for (const p of inside) hit(sim, U, p, PCT.tower, t.what, null); else for (const p of ps) hit(sim, U, p, PCT.towerx, 'an empty ' + t.what, null); return; }
  if (t.sh === 'stack') { const ok = inside.length >= Math.min(t.n || 1, ps.length); for (const p of inside) hit(sim, U, p, ok ? PCT.stack : PCT.stackx, t.what, null); if (!ok) for (const p of ps) if (!inside.includes(p)) hit(sim, U, p, PCT.stack, 'a missed ' + t.what, null); return; }
  const others = inside.filter((p) => p.id !== t.pid), ok = !others.length;
  for (const p of inside) hit(sim, U, p, ok ? t.pct : PCT.spreadx, t.what, null);
}
function hit(sim, U, p, pct, what, src, kb = 0) {
  const P = phOf(U), name = P.short[0] + P.short.slice(1).toLowerCase();
  const ok = damagePlayer(sim, p, 0, src, { pct, raw: what === 'Unmaking', by: `${name}'s ${what}`, kb: src ? (kb || 160) : 0 });
  if (ok) { U.hits[what] = (U.hits[what] || 0) + 1; sim.emit({ type: 'unw', ph: 'hit', pid: p.id, what, x: r0(p.x), y: r0(p.y) }); }
  return ok;
}

/** compact copy for co-op snapshots (the renderer reads the same shape from a local sim) */
export function packUlt(sim) {
  const U = sim.ult; if (!U) return null;
  return { st: U.st, ph: U.ph, start: U.start, at: U.at, t: U.t, tt: U.tt, enr: U.enr, enraged: U.enraged ? 1 : 0, attempts: U.attempts, bid: U.bid, sig: U.sig, last: U.last ? 1 : 0, call: U.call, n: U.n, times: U.times,
    crunch: U.crunch && U.crunch.t >= 0 ? U.crunch.cur : 0,
    tele: U.tele.map((t) => ({ id: t.id, k: t.k, sh: t.sh, x: t.x, y: t.y, r: t.r, r0: t.r0, ang: t.ang, len: t.len, w: t.w, arc: t.arc, c: t.c, d: t.d, t: t.t, done: t.done ? 1 : 0, tell: t.tell, n: t.n, have: t.have, pid: t.pid, warn: t.warn, mem: t.mem })) };
}
/** test / practice / dev hook: start at phase m.ph (the boss straight away), set HP, kill the boss, run a mechanic */
export function devUlt(sim, p, m = {}) {
  if (m.ph) { const party = sim.ult ? sim.ult.party.slice() : []; startUlt(sim, m.ph); for (const id of party) if (!sim.ult.party.includes(id)) sim.ult.party.push(id); }
  if (!sim.ult) startUlt(sim);
  const U = sim.ult; if (p && !U.party.includes(p.id)) { U.party.push(p.id); place(p, U.party.length - 1); }
  if (m.skipPull && (U.st === 'pull' || U.st === 'inter')) spawnPhase(sim, U, here(sim));
  const b = bossOf(sim);
  if (m.hp != null && b) b.hp = Math.max(1, b.maxHp * m.hp);
  if (m.mech && U.st === 'fight' && b) runMech(sim, U, b, m.mech, here(sim));
  if (m.kill && b) { b.hp = 0; b.dead = true; U.killed = b.id; }
  return U;
}
