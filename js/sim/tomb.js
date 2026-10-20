// The Tomb of the Sun-Eaten King: the Sunscorch Dunes' Normal dungeon.
//   3 wave rooms (3 waves each, enemies rise from the sarcophagi on the rim) -> each room has a CHAIN CHALLENGE (land N
//   chains / long chains); meet it and a golden sarcophagus chest opens when the room is clear -> the sun-door on the
//   north rim carries the party on -> Neferakh, the Sun-Eaten King.
// Neferakh flips his sanctum between LIGHT and DARK:
//   SUN     : he is vulnerable; Solar Lances (lines), Sunfall (spread circles), and NOON FLARE at the end of every sun
//             phase: the whole floor burns except the SHADOWS the four obelisks cast away from him.
//   DARK    : the room goes black; he is SHROUDED (takes 20% damage) unless he stands in the light of a brazier. Stand
//             on a brazier for ~0.7 s to light it (a pool of light for the rest of the dark); lure him in: EXPOSED (+30%).
//             Grasping Shadows rise under anyone outside the light; from phase 2, Umbral Mirages dash across the room.
//   PHASE 3 : TWILIGHT DIVIDE: a terminator line splits the room; the lit half burns, then the dark half: cross the line.
//   HP 66% / 33%: a roar, adds (mummies + scarabs), the cycle speeds up. Enrage at 5.5 min (Endless Night).
// A boss wipe resets only Neferakh (the run is kept). Co-op: the whole party moves room to room together (hub missions).
// State lives in sim.tomb as plain data (packed for co-op clients, drawn by client/tombfx.js). Authoritative only.
import { posTele } from './telegraph.js';
import { withLootLevel } from './loot.js';
import { encHpA } from './astral.js';
import { secs } from './constants.js';
import { TOMB_ROOMS, roomEntry, roomDoor, OBELISKS, BRAZIERS, inTombArea, tombRoomAt, DUNES_SPAWN } from './dunesconst.js';
import { spawnEnemy } from './ai.js';
import { registerWaves } from './mobhp.js';
import { damagePlayer, healPlayer } from './combat.js';
import { generateItem } from './loot.js';
import { makeSetItem } from './sets.js';
import { EQUIP_SLOTS, SET_SLOTS, slotType } from './data/items.js';
import { inLine } from './math.js';

const TAU = Math.PI * 2;
const r0 = (v) => Math.round(v);
export const TOMB = {
  mul: 1.7, tier: 4, elite: 0.1, waveGap: secs(1.6), rise: 50, chestR: 52, doorR: 46,
  rooms: [
    { waves: [['mummy', 'mummy', 'scarab', 'scarab'], ['scarab', 'scarab', 'sunpriest', 'mummy'], ['mummy', 'mummy', 'sunpriest', 'sunpriest', 'mummy!']],
      chal: { k: 'chains', need: 6, text: 'Land 6 chains' } },
    { waves: [['mirage', 'mirage', 'mummy', 'mummy'], ['sandwurm', 'sandwurm', 'scarab', 'scarab'], ['jackal', 'jackal', 'jackal', 'jackal', 'mirage!']],
      chal: { k: 'long3', need: 4, text: 'Land 4 chains of 3+ steps' } },
    { waves: [['jackal', 'jackal', 'jackal', 'sunpriest', 'sunpriest'], ['sandwurm', 'mirage', 'mirage', 'mummy', 'mummy'], ['mummy!', 'jackal!', 'scarab', 'scarab', 'sunpriest']],
      chal: { k: 'long4', need: 2, text: 'Land 2 chains of 4+ steps' } },
  ],
  boss: {
    hp: 375000, partyHp: 1, pull: secs(5), enrage: secs(450), // (DPS-UP pass: HP x~1.6, enrage 330 -> 450 s: typical ~3.2 min, a solo Bard keeps >= 70 s of margin)
    enragePct: 0.4, enrageEvery: secs(2),
    sun: [0, secs(14), secs(12), secs(10)], dark: [0, secs(11), secs(10), secs(9)], twi: secs(7.5),
    shroud: 0.2, exposed: 1.3, twiLit: 1.15, twiDark: 0.35, flip: secs(1.2),
    lance: { w: 70, len: 1100, d: 62, pct: 0.3 }, sunfall: { r: 110, d: 90, pct: 0.25, ally: 0.2 },
    flare: { d: 150, pct: 0.6, shadeLen: 190, shadeW: 78 }, grasp: { r: 85, d: 72, pct: 0.22, every: 150 },
    umbral: { w: 96, d: 66, pct: 0.35 }, twilight: { d1: 130, d2: 140, pct: 0.45 },
    brazier: { hold: 42, r: 46, light: 200 }, adds: ['mummy', 'mummy', 'scarab', 'scarab'], mend: 0.08,
  },
};
registerWaves('tomb', TOMB.rooms); // (its wave trash / elites average the mob HP level curve, sim/mobhp.js)
export const BOSS_ROOM = TOMB_ROOMS[3];
export const TB_COL = { sun: '#ffcf4a', dark: '#8a5cff', danger: '#ff3b3b', safe: '#4dff88', shade: '#2a1f4a' };

const roomOf = (sim) => (sim.tomb ? TOMB_ROOMS[sim.tomb.room] : null);
const inRoom = (p, i, pad = 30) => { const R = TOMB_ROOMS[i]; return Math.hypot(p.x - R.x, p.y - R.y) < R.r + pad; };
const here = (sim) => [...sim.players.values()].filter((p) => !p.dead && sim.tomb && inRoom(p, sim.tomb.room));
const bossOf = (sim) => sim.tomb && sim.tomb.b && sim.enemyById.get(sim.tomb.b.bid);
function place(p, s, k = 0) { const o = ((k % 5) - 2) * 30; p.x = p.px = s.x + o; p.y = p.py = s.y + Math.floor(k / 5) * 26; p.vx = p.vy = 0; p.iframes = Math.max(p.iframes || 0, 60); p.action = null; }
function call(sim, txt, sub, col, t = 150) { const T = sim.tomb; T.call = { txt, sub: sub || '', col: col || '#fff', t, d: t }; sim.emit({ type: 'tomb', ph: 'call', txt, sub: sub || '', col: col || '#fff', x: r0(roomOf(sim).x), y: r0(roomOf(sim).y) }); }

// ------------------------------------------------------------------ entry / exit
/** Teleport a player in (starts a run if none is going). */
export function enterTomb(sim, p) {
  if (sim.predicting || !p) return false;
  if (p.dead) { p.dead = false; p.hp = p.stats.maxHp; p.respawnAt = 0; }
  if (!sim.tomb || sim.tomb.st === 'done') startTomb(sim);
  const T = sim.tomb;
  if (!T.party.includes(p.id)) T.party.push(p.id);
  place(p, roomEntry(T.room), T.party.indexOf(p.id));
  sim.emit({ type: 'tomb', ph: 'enter', pid: p.id, x: r0(p.x), y: r0(p.y), room: T.room });
  return true;
}
export function startTomb(sim) {
  endTomb(sim, null);
  sim.tomb = { st: 'room', room: 0, wave: 0, nw: TOMB.rooms[0].waves.length, alive: [], gap: secs(2.5), pend: null, ch: null, chest: null, door: false, b: null, party: [], call: null, t: 0, kills: 0, chests: 0, over: 0 };
  setChallenge(sim);
  call(sim, 'TOMB OF THE SUN-EATEN KING', TOMB_ROOMS[0].name + ' · ' + TOMB.rooms[0].chal.text + ' for a bonus chest', '#ffcf4a', 200);
  sim.emit({ type: 'tomb', ph: 'start', x: r0(TOMB_ROOMS[0].x), y: r0(TOMB_ROOMS[0].y) });
}
/** Tear the run down (enemies, boss). why = null: silent. */
export function endTomb(sim, why = 'quit') {
  for (const e of sim.enemies) if (!e.dead && (e.tombWave || e.type === 'neferakh' || e.tombFake) && inTombArea(e.x, e.y)) { e.dead = true; e.hp = 0; }
  for (const pr of sim.projectiles) if (inTombArea(pr.x, pr.y)) pr.dead = true;
  for (const a of sim.areas) if (inTombArea(a.x, a.y)) a.dead = true;
  if (sim.tomb && why) sim.emit({ type: 'tomb', ph: 'end', why, x: r0(TOMB_ROOMS[0].x), y: r0(TOMB_ROOMS[0].y) });
  sim.tomb = null;
}
/** Leave on your own (no hub): back to the Dunes oasis. */
export function leaveTomb(sim, p) { place(p, DUNES_SPAWN); if (sim.tomb && !here(sim).length && !sim.tomb.b) endTomb(sim, 'quit'); }
/** Where a fallen tomb-runner rises (the current room's entrance). */
export function tombSpot(sim) { return sim.tomb ? roomEntry(sim.tomb.room) : DUNES_SPAWN; }

function setChallenge(sim) {
  const T = sim.tomb, c = TOMB.rooms[T.room] && TOMB.rooms[T.room].chal;
  if (!c) { T.ch = null; return; }
  const n = Math.max(1, T.party.length || sim.players.size);
  T.ch = { k: c.k, n: 0, need: c.need + Math.floor((n - 1) * c.need * 0.5), text: c.text, done: 0 };
}
/** dunes.js chainHooks: a chain landed. */
export function tombChain(sim, p, steps) {
  const T = sim.tomb;
  if (!T || T.st !== 'room' || !T.ch || T.ch.done || !inRoom(p, T.room)) return;
  const c = T.ch, ok = c.k === 'chains' || (c.k === 'long3' && steps >= 3) || (c.k === 'long4' && steps >= 4);
  if (!ok) return;
  c.n++;
  sim.emit({ type: 'tomb', ph: 'chal', pid: p.id, n: c.n, need: c.need, x: r0(p.x), y: r0(p.y) });
  if (c.n >= c.need) { c.done = 1; sim.emit({ type: 'tomb', ph: 'chalDone', text: c.text, x: r0(p.x), y: r0(p.y) }); }
}

// ------------------------------------------------------------------ per tick
export function updateTomb(sim) {
  const T = sim.tomb;
  if (!T || sim.predicting) return;
  T.t++;
  if (T.call && --T.call.t <= 0) T.call = null;
  const ps = here(sim);
  if (T.st === 'room') tickRoom(sim, T, ps);
  else if (T.st === 'clear') tickClear(sim, T, ps);
  else if (T.st === 'boss') tickBoss(sim, T, ps);
  // stragglers (respawned outside the current room, late joiners) are pulled to the current room
  for (const p of sim.players.values()) if (!p.dead && inTombArea(p.x, p.y) && tombRoomAt(p.x, p.y, 40) !== T.room) place(p, roomEntry(T.room), T.party.indexOf(p.id) + 1);
}

function tickRoom(sim, T, ps) {
  const R = TOMB_ROOMS[T.room];
  T.alive = T.alive.filter((id) => { const e = sim.enemyById.get(id); return e && !e.dead; });
  if (T.pend) { // enemies rising from the sarcophagi
    if (--T.pend.t <= 0) { for (const s of T.pend.list) spawnWaveEnemy(sim, T, s); T.pend = null; }
    return;
  }
  if (T.alive.length) return;
  if (T.wave >= T.nw) { roomClear(sim, T); return; }
  if (!ps.length) return; // (nobody here: wait)
  if (--T.gap > 0) return;
  // next wave
  const wave = TOMB.rooms[T.room].waves[T.wave].slice();
  const n = Math.max(1, ps.length), extra = Math.floor((n - 1) / 2);
  for (let i = 0; i < extra; i++) wave.push(wave[i % wave.length].replace('!', ''));
  const list = wave.map((k, i) => {
    const a = -Math.PI / 2 + (i / wave.length) * TAU + T.wave * 0.4, rr = R.r * 0.72;
    return { type: k.replace('!', ''), elite: k.endsWith('!') || sim.rng.next() < TOMB.elite, x: r0(R.x + Math.cos(a) * rr), y: r0(R.y + Math.sin(a) * rr) };
  });
  T.wave++;
  T.pend = { t: TOMB.rise, list };
  sim.emit({ type: 'tomb', ph: 'wave', room: T.room, wave: T.wave, nw: T.nw, pts: list.map((s) => [s.x, s.y, s.elite ? 1 : 0]), x: r0(R.x), y: r0(R.y) });
  T.gap = TOMB.waveGap;
}
function spawnWaveEnemy(sim, T, s) {
  const R = TOMB_ROOMS[T.room];
  const e = spawnEnemy(sim, s.type, s.x, s.y, { elite: s.elite, mul: TOMB.mul, tier: TOMB.tier, wave: true });
  e.tombWave = 1; e.homeX = R.x; e.homeY = R.y; e.cd = 30 + Math.floor(sim.rng.next() * 40);
  const t = here(sim)[0]; if (t) e.aggroId = t.id;
  T.alive.push(e.id);
}
function roomClear(sim, T) {
  const R = TOMB_ROOMS[T.room];
  T.st = 'clear'; T.door = true;
  if (T.ch && T.ch.done) T.chest = { x: r0(R.x), y: r0(R.y - 40), open: 0 };
  call(sim, 'CHAMBER CLEARED', T.chest ? 'The golden sarcophagus opens for you · then take the sun-door north' : 'The sun-door opens to the north', '#ffe27a', 170);
  sim.emit({ type: 'tomb', ph: 'roomClear', room: T.room, chest: T.chest ? 1 : 0, x: r0(R.x), y: r0(R.y) });
}
function tickClear(sim, T, ps) {
  if (T.chest && !T.chest.open) for (const p of ps) if (Math.hypot(p.x - T.chest.x, p.y - T.chest.y) < TOMB.chestR) { openChest(sim, T); break; }
  const D = roomDoor(T.room);
  for (const p of ps) if (Math.hypot(p.x - D.x, p.y - D.y) < TOMB.doorR) { nextRoom(sim, T); return; }
}
function openChest(sim, T) {
  T.chest.open = 1; T.chests++;
  for (const id of T.party) {
    const p = sim.players.get(id);
    if (!p) continue;
    const items = withLootLevel(p.level, () => [0, 1].map(() => generateItem(sim.rng, { tier: 5, cls: p.cls, rarity: sim.rng.next() < 0.3 ? 3 : 2 })));
    if (sim.rng.next() < 0.15) items.push(withLootLevel(p.level, () => makeSetItem(sim.rng, p.cls)));
    const bag = { id: sim.id(), x: T.chest.x + (sim.rng.next() - 0.5) * 40, y: T.chest.y + 34, items, ownerId: p.id, life: secs(120), rarity: Math.max(...items.map((i) => i.rarity)) };
    sim.bags.push(bag);
    sim.emit({ type: 'loot', x: bag.x, y: bag.y, rarity: bag.rarity, pid: p.id });
  }
  sim.emit({ type: 'tomb', ph: 'chest', x: T.chest.x, y: T.chest.y });
}
function nextRoom(sim, T) {
  T.room++; T.chest = null; T.door = false;
  const ps = [...sim.players.values()];
  if (T.room >= 3) { startBoss(sim, T); ps.forEach((p, i) => { if (p.dead) return; place(p, roomEntry(3), i); }); }
  else {
    T.st = 'room'; T.wave = 0; T.nw = TOMB.rooms[T.room].waves.length; T.gap = secs(2.2); T.alive = [];
    setChallenge(sim);
    ps.forEach((p, i) => { if (!p.dead) place(p, roomEntry(T.room), i); });
    call(sim, TOMB_ROOMS[T.room].name.toUpperCase(), `Chamber ${T.room + 1} of 3 · Challenge: ${T.ch.text}`, '#ffcf4a', 180);
  }
  sim.emit({ type: 'tomb', ph: 'room', room: T.room, x: r0(TOMB_ROOMS[T.room].x), y: r0(TOMB_ROOMS[T.room].y) });
}

// ------------------------------------------------------------------ Neferakh
function startBoss(sim, T, attempts = 0) {
  const B = TOMB.boss, R = BOSS_ROOM;
  for (const e of sim.enemies) if (!e.dead && e.type === 'neferakh') e.dead = true;
  const b = spawnEnemy(sim, 'neferakh', R.x, R.y - 130);
  b.cd = 1e6; b.raidHold = 1e6; b.face = Math.PI / 2; b.dropChance = 1; b.invuln = B.pull; b.homeX = R.x; b.homeY = R.y;
  T.st = 'boss';
  T.b = { st: 'pull', at: 0, pull: B.pull, bid: b.id, phase: 1, light: 'sun', lt: B.sun[1], ld: B.sun[1], flip: 0, tele: [], tid: 1, braz: BRAZIERS.map(() => ({ lit: 0, hold: 0 })), n: 1, enr: B.enrage, enraged: false, attempts, empty: 0, cyc: 0, script: [], t: 0, won: false, hits: {} };
  call(sim, 'NEFERAKH, THE SUN-EATEN KING', attempts ? `Attempt ${attempts + 1} · the sun rises again` : 'He swallowed the sun. Light and dark are his to command.', '#ffcf4a', B.pull);
  sim.emit({ type: 'tomb', ph: 'bossPull', x: r0(R.x), y: r0(R.y - 130), t: B.pull });
}
function tickBoss(sim, T, ps) {
  const Bd = T.b, B = TOMB.boss, b = bossOf(sim), R = BOSS_ROOM;
  if (Bd.st === 'victory') {
    const ex = { x: R.x, y: R.y + R.r - 60 };
    for (const p of ps) if (Math.hypot(p.x - ex.x, p.y - ex.y) < 44) { if (sim.hub) T.over = 1; else { for (const q of sim.players.values()) if (inTombArea(q.x, q.y)) place(q, DUNES_SPAWN); endTomb(sim, null); } return; }
    Bd.at++;
    return;
  }
  if (Bd.st === 'wipe') { if (++Bd.at >= secs(4)) { const a = Bd.attempts + 1; startBoss(sim, T, a); [...sim.players.values()].forEach((p, i) => { if (p.dead) { p.dead = false; p.hp = p.stats.maxHp; p.respawnAt = 0; } place(p, roomEntry(3), i); }); } return; }
  if (Bd.won || !b || b.dead) { bossVictory(sim, T); return; }
  if (!ps.length) { if (++Bd.empty > 60) { wipeBoss(sim, T, b); } return; }
  Bd.empty = 0;
  if (b.hitstop > 10) b.hitstop = 10;
  if (Bd.st === 'pull') {
    if (--Bd.pull <= 0) {
      Bd.st = 'fight'; Bd.n = ps.length;
      const hp = Math.round(B.hp * encHpA(sim, 'tomb') * (1 + B.partyHp * (Bd.n - 1))); b.maxHp = b.hp = b.baseMaxHp = hp; // (game loop C2: the band it sits in now, sim/levelscale.js)
      b.invuln = 0; b.raidHold = 0;
      startLight(sim, Bd, 'sun');
      sim.emit({ type: 'tomb', ph: 'bossStart', x: r0(b.x), y: r0(b.y), n: Bd.n, hp });
    }
    return;
  }
  Bd.t++;
  if (Bd.enr > 0 && --Bd.enr === 0) { Bd.enraged = true; call(sim, 'ENDLESS NIGHT', 'Neferakh devours the last light', '#ff3b3b', 240); sim.emit({ type: 'tomb', ph: 'enrage', x: r0(b.x), y: r0(b.y) }); }
  if (Bd.enraged && Bd.t % B.enrageEvery === 0) for (const p of ps) hit(sim, Bd, p, B.enragePct, 'Endless Night', b);
  // phase gates
  const pct = b.hp / b.maxHp, want = pct > 0.66 ? 1 : pct > 0.33 ? 2 : 3;
  if (want > Bd.phase) {
    Bd.phase = want; b.phase = want; b.invuln = 0;
    for (const t of Bd.tele) t.cancel = 1;
    Bd.tele = Bd.tele.filter((t) => t.done);
    Bd.script = [];
    for (const [i, k] of B.adds.entries()) { const a = (i / B.adds.length) * TAU + 0.4, e = spawnEnemy(sim, k, R.x + Math.cos(a) * 300, R.y + Math.sin(a) * 300, { mul: 1.4, tier: 4, zoneHp: false }); e.tombWave = 1; e.homeX = R.x; e.homeY = R.y; e.aggroId = ps[0].id; e.dropChance = 0.15; }
    call(sim, want === 3 ? 'THE SUN SPLITS' : 'THE SUN-EATER RAGES', want === 3 ? 'Phase 3 · Twilight Divide: cross the terminator line' : 'Phase 2 · his servants rise · Umbral Mirages in the dark', want === 3 ? '#ff8a5a' : '#ffcf4a', 160);
    sim.emit({ type: 'tomb', ph: 'phase', phase: want, x: r0(b.x), y: r0(b.y) });
    sim.emit({ type: 'bossPhase', phase: want, x: b.x, y: b.y, id: b.id, raid: true });
    startLight(sim, Bd, 'sun');
  }
  // the light cycle
  if (Bd.flip > 0) Bd.flip--;
  if (--Bd.lt <= 0) startLight(sim, Bd, nextLight(Bd));
  Bd.at++;
  for (const s of Bd.script) if (!s.done && Bd.at >= s.at) { s.done = true; runMech(sim, Bd, b, s.k, ps); }
  // boss movement: holds still while it casts in the sun, stalks you in the dark (lure it into the light)
  b.raidHold = Bd.light === 'dark' ? 0 : 1e6;
  if (Bd.light === 'sun' || Bd.light === 'twilight') { const dx = R.x - b.x, dy = R.y - 100 - b.y, d = Math.hypot(dx, dy); if (d > 6) { b.x += dx / d * 1.6; b.y += dy / d * 1.6; } }
  // damage taken: shrouded in the dark unless lit; exposed in a brazier's light
  b.lit = 0;
  if (Bd.light === 'dark') { const L = litPools(Bd).some((q) => Math.hypot(b.x - q.x, b.y - q.y) < B.brazier.light + b.r * 0.4); b.lit = L ? 1 : 0; b.takeMul = L ? B.exposed : B.shroud; }
  else if (Bd.light === 'twilight' && Bd.tw) { b.takeMul = halfLit(Bd.tw, b.x, b.y) ? B.twiLit : B.twiDark; b.lit = b.takeMul > 1 ? 1 : 0; }
  else b.takeMul = 1;
  // braziers (dark phase): stand on one to light it
  if (Bd.light === 'dark') BRAZIERS.forEach((z, i) => {
    const s = Bd.braz[i];
    if (s.lit) return;
    const on = ps.some((p) => Math.hypot(p.x - z.x, p.y - z.y) < B.brazier.r);
    s.hold = on ? s.hold + 1 : Math.max(0, s.hold - 2);
    if (s.hold >= B.brazier.hold) { s.lit = 1; s.hold = 0; sim.emit({ type: 'tomb', ph: 'brazier', i, x: z.x, y: z.y }); }
  });
  tickTele(sim, Bd, ps, b);
}
function nextLight(Bd) {
  if (Bd.phase < 3) return Bd.light === 'sun' ? 'dark' : 'sun';
  return Bd.light === 'sun' ? 'twilight' : Bd.light === 'twilight' ? (Bd.cyc % 2 ? 'dark' : 'sun') : 'twilight';
}
const litPools = (Bd) => BRAZIERS.filter((z, i) => Bd.braz[i].lit);
/** Twilight: the lit half of the room is the side the 'sun' normal points at. */
export function halfLit(tw, x, y) { return (x - BOSS_ROOM.x) * Math.cos(tw.ang) + (y - BOSS_ROOM.y) * Math.sin(tw.ang) > 0; }
function startLight(sim, Bd, light) {
  const B = TOMB.boss, ph = Bd.phase;
  const prev = Bd.light;
  Bd.light = light; Bd.at = 0; Bd.cyc++;
  Bd.ld = Bd.lt = light === 'sun' ? B.sun[ph] : light === 'dark' ? B.dark[ph] : B.twi;
  Bd.flip = B.flip;
  Bd.tw = null;
  const L = Bd.ld;
  if (light === 'sun') {
    Bd.script = [{ at: 50, k: 'lances' }, { at: 170, k: 'sunfall' }, ...(ph >= 2 ? [{ at: 300, k: 'lances' }] : []), { at: Math.max(200, L - B.flare.d - 30), k: 'flare' }];
  } else if (light === 'dark') {
    Bd.braz.forEach((s) => { s.lit = 0; s.hold = 0; });
    Bd.script = [];
    for (let at = 70; at < L - 60; at += B.grasp.every) Bd.script.push({ at, k: 'grasp' });
    if (ph >= 2) Bd.script.push({ at: 140, k: 'umbral' }, { at: Math.max(260, L - 200), k: 'umbral' });
  } else {
    Bd.tw = { ang: sim.rng.next() * TAU };
    Bd.script = [{ at: 20, k: 'twilight' }];
  }
  if (prev !== light) sim.emit({ type: 'tomb', ph: 'flip', light, phase: ph, x: r0(BOSS_ROOM.x), y: r0(BOSS_ROOM.y), d: Bd.ld });
}

// ---- mechanics
function tele(Bd, spec) { const t = { id: Bd.tid++, t: 0, ...spec }; Bd.tele.push(t); return t; }
function runMech(sim, Bd, b, k, ps) {
  const B = TOMB.boss, R = BOSS_ROOM;
  if (k === 'lances') {
    const n = Bd.phase >= 2 ? 5 : 3;
    const angs = ps.map((p) => Math.atan2(p.y - b.y, p.x - b.x));
    while (angs.length < n) angs.push(sim.rng.next() * TAU);
    for (const a of angs.slice(0, n)) tele(Bd, { k: 'lance', sh: 'rect', x: r0(b.x + Math.cos(a) * B.lance.len / 2), y: r0(b.y + Math.sin(a) * B.lance.len / 2), ang: a, len: B.lance.len, w: B.lance.w, d: B.lance.d, pct: B.lance.pct, col: 'sun', what: 'Solar Lance' });
    sim.emit({ type: 'tomb', ph: 'cast', k, x: r0(b.x), y: r0(b.y) });
  } else if (k === 'sunfall') {
    for (const p of ps) tele(Bd, { k: 'sunfall', sh: 'circle', pid: p.id, x: r0(p.x), y: r0(p.y), r: B.sunfall.r, d: B.sunfall.d, pct: B.sunfall.pct, col: 'sun', what: 'Sunfall', follow: 1 });
    sim.emit({ type: 'tomb', ph: 'cast', k, x: r0(b.x), y: r0(b.y) });
  } else if (k === 'flare') {
    const sh = OBELISKS.map((o) => { const a = Math.atan2(o.y - b.y, o.x - b.x); return [o.x + Math.cos(a) * (o.r + B.flare.shadeLen / 2), o.y + Math.sin(a) * (o.r + B.flare.shadeLen / 2), a]; });
    tele(Bd, { k: 'flare', sh: 'shade', z: sh.map(([x, y, a]) => [r0(x), r0(y), +a.toFixed(3)]), len: B.flare.shadeLen, w: B.flare.shadeW, d: B.flare.d, pct: B.flare.pct, col: 'sun', what: 'Noon Flare' });
    call(sim, 'NOON FLARE', 'Hide in the obelisks\' shadows', '#ffcf4a', 120);
    sim.emit({ type: 'tomb', ph: 'cast', k, x: r0(b.x), y: r0(b.y) });
  } else if (k === 'grasp') {
    for (const p of ps) { if (litPools(Bd).some((q) => Math.hypot(p.x - q.x, p.y - q.y) < B.brazier.light)) continue; tele(Bd, { k: 'grasp', sh: 'circle', x: r0(p.x), y: r0(p.y), r: B.grasp.r, d: B.grasp.d, pct: B.grasp.pct, col: 'dark', what: 'Grasping Shadows' }); }
  } else if (k === 'umbral') {
    const a0 = sim.rng.next() * TAU;
    for (let i = 0; i < 2; i++) {
      const a = a0 + i * Math.PI / 2, off = (sim.rng.next() - 0.5) * 260;
      const cx = R.x + Math.cos(a + Math.PI / 2) * off, cy = R.y + Math.sin(a + Math.PI / 2) * off;
      tele(Bd, { k: 'umbral', sh: 'rect', x: r0(cx), y: r0(cy), ang: a, len: 1150, w: B.umbral.w, d: B.umbral.d + i * 20, pct: B.umbral.pct, col: 'dark', what: 'Umbral Mirage' });
    }
    sim.emit({ type: 'tomb', ph: 'cast', k, x: r0(b.x), y: r0(b.y) });
  } else if (k === 'twilight') {
    tele(Bd, { k: 'twiA', sh: 'half', ang: Bd.tw.ang, d: B.twilight.d1, pct: B.twilight.pct, col: 'sun', what: 'Twilight Divide' });
    tele(Bd, { k: 'twiB', sh: 'half', ang: Bd.tw.ang + Math.PI, d: B.twilight.d1 + B.twilight.d2, pct: B.twilight.pct, col: 'dark', what: 'Twilight Divide' });
    call(sim, 'TWILIGHT DIVIDE', 'The lit half burns first · then cross into the light', '#ff9a5a', 130);
  }
}
/** Is p caught by telegraph t? */
export function tombTeleHits(t, p) {
  const pr = (p.r || 16) * 0.5;
  switch (t.sh) {
    case 'circle': return Math.hypot(p.x - t.x, p.y - t.y) < t.r + pr;
    case 'rect': return inLine(t.x - Math.cos(t.ang) * t.len / 2, t.y - Math.sin(t.ang) * t.len / 2, t.ang, t.len, t.w, p.x, p.y, pr);
    case 'shade': return !t.z.some(([x, y, a]) => inLine(x - Math.cos(a) * t.len / 2, y - Math.sin(a) * t.len / 2, a, t.len, t.w, p.x, p.y, -pr * 0.5));
    case 'half': return (p.x - BOSS_ROOM.x) * Math.cos(t.ang) + (p.y - BOSS_ROOM.y) * Math.sin(t.ang) > -pr;
    default: return false;
  }
}
function tickTele(sim, Bd, ps, b) {
  for (const t of Bd.tele) {
    t.t++;
    if (t.follow && t.t < t.d - 24) { const p = sim.players.get(t.pid); if (p && !p.dead) { t.x = r0(p.x); t.y = r0(p.y); } }
    if (t.t === t.d && !t.done && !t.cancel) {
      t.done = true; sim.posCheck = posTele(t) ? 1 : 0;
      let clean = true;
      for (const p of ps) {
        if (!tombTeleHits(t, p)) continue;
        let pct = t.pct;
        if (t.k === 'sunfall' && t.pid !== p.id) pct = TOMB.boss.sunfall.ally; // (someone else's Sunfall: spread out)
        hit(sim, Bd, p, pct, t.what, t.sh === 'circle' ? { x: t.x, y: t.y } : null); clean = false;
      }
      if (t.k === 'flare' && clean) for (const p of ps) { healPlayer(sim, p, p.stats.maxHp * TOMB.boss.mend, p); sim.emit({ type: 'tomb', ph: 'mend', pid: p.id, x: r0(p.x), y: r0(p.y) }); }
      sim.emit({ type: 'tomb', ph: 'boom', k: t.k, sh: t.sh, x: r0(t.x ?? BOSS_ROOM.x), y: r0(t.y ?? BOSS_ROOM.y), r: t.r, ang: t.ang, len: t.len, w: t.w, col: t.col });
    }
  }
  Bd.tele = Bd.tele.filter((t) => !t.cancel && (!t.done || t.t < t.d + 16));
  sim.posCheck = 0;
}
function hit(sim, Bd, p, pct, what, src) {
  const ok = damagePlayer(sim, p, 0, src, { pct, raw: what === 'Endless Night', by: `Neferakh's ${what}`, kb: src ? 240 : 0 });
  if (ok) { Bd.hits[what] = (Bd.hits[what] || 0) + 1; sim.emit({ type: 'tomb', ph: 'hit', pid: p.id, what, x: r0(p.x), y: r0(p.y) }); }
  return ok;
}
function wipeBoss(sim, T, b) {
  const Bd = T.b;
  Bd.st = 'wipe'; Bd.at = 0; Bd.tele = [];
  if (b) { b.dead = true; b.hp = 0; }
  for (const e of sim.enemies) if (!e.dead && e.tombWave && inTombArea(e.x, e.y)) { e.dead = true; e.hp = 0; }
  for (const pr of sim.projectiles) if (inTombArea(pr.x, pr.y)) pr.dead = true;
  call(sim, 'THE SUN SETS', 'Neferakh resets · your run is kept', '#ff8a7a', secs(4));
  sim.emit({ type: 'tomb', ph: 'wipe', x: r0(BOSS_ROOM.x), y: r0(BOSS_ROOM.y), attempts: Bd.attempts + 1 });
}
function bossVictory(sim, T) {
  const Bd = T.b, R = BOSS_ROOM;
  Bd.st = 'victory'; Bd.at = 0; Bd.tele = []; Bd.light = 'sun';
  for (const e of sim.enemies) if (!e.dead && e.tombWave && inTombArea(e.x, e.y)) { e.dead = true; e.hp = 0; }
  const secsT = Math.round(T.t / 60);
  call(sim, 'THE SUN IS FREED', `Tomb cleared in ${Math.floor(secsT / 60)}:${String(secsT % 60).padStart(2, '0')} · ${sim.hub ? 'the sun-door leads home' : 'the sun-door leads back to the oasis'}`, '#ffe27a', 360);
  for (const id of T.party) {
    const p = sim.players.get(id);
    if (!p) continue;
    p.unlocks = p.unlocks || {};
    // the exclusive Set piece (a slot you don't have yet first) + the Trial Sigil (guaranteed on your first clear)
    const have = new Set([...EQUIP_SLOTS.filter((s) => p.equipment[s] && p.equipment[s].set === 'sunscorch').map(slotType), ...p.inventory.filter((i) => i && i.set === 'sunscorch').map((i) => i.slot)]);
    const want = SET_SLOTS.filter((s) => !have.has(s));
    const items = withLootLevel(p.level, () => [makeSetItem(sim.rng, p.cls, want.length ? want[Math.floor(sim.rng.next() * want.length)] : null)]);
    // (game loop A1: no more Trial Sigil item - every clear opens Neferakh Unbound ('sigil') and banks a Sunseal Key on the client)
    const bag = { id: sim.id(), x: R.x + (sim.rng.next() - 0.5) * 60, y: R.y + 30, items, ownerId: p.id, life: secs(180), rarity: Math.max(...items.map((i) => i.rarity)) };
    sim.bags.push(bag);
    sim.emit({ type: 'loot', x: bag.x, y: bag.y, rarity: bag.rarity, pid: p.id });
    for (const key of ['tomb', 'sigil']) { const fresh = !p.unlocks[key]; p.unlocks[key] = 1; sim.emit({ type: 'unlock', pid: p.id, key, fresh: fresh ? 1 : 0, x: r0(R.x), y: r0(R.y) }); }
  }
  sim.emit({ type: 'tomb', ph: 'victory', x: r0(R.x), y: r0(R.y - 130), t: secsT, attempts: Bd.attempts });
}

/** Compact copy for co-op snapshots (the renderer reads the same shape from a local sim). */
export function packTomb(sim) {
  const T = sim.tomb;
  if (!T) return null;
  const Bd = T.b;
  return {
    st: T.st, room: T.room, wave: T.wave, nw: T.nw, ch: T.ch, chest: T.chest, door: T.door, call: T.call, t: T.t, kills: T.kills,
    pend: T.pend ? { t: T.pend.t, pts: T.pend.list.map((s) => [s.x, s.y, s.elite ? 1 : 0]) } : null,
    b: Bd ? { st: Bd.st, light: Bd.light, lt: Bd.lt, ld: Bd.ld, flip: Bd.flip, phase: Bd.phase, at: Bd.at, pull: Bd.pull, enr: Bd.enr, enraged: Bd.enraged, attempts: Bd.attempts, bid: Bd.bid, braz: Bd.braz.map((s) => [s.lit, s.hold]), tw: Bd.tw,
      tele: Bd.tele.map((t) => ({ id: t.id, k: t.k, sh: t.sh, x: t.x, y: t.y, r: t.r, ang: t.ang, len: t.len, w: t.w, d: t.d, t: t.t, col: t.col, z: t.z, done: t.done ? 1 : 0, pid: t.pid })) } : null,
  };
}
/** Test / dev hook: jump to a room or the boss, force the light, kill the boss. */
export function devTomb(sim, p, m) {
  if (!sim.tomb) enterTomb(sim, p);
  const T = sim.tomb;
  if (m.room != null) { for (const id of T.alive) { const e = sim.enemyById.get(id); if (e) e.dead = true; } T.alive = []; T.pend = null; T.room = Math.max(0, Math.min(3, m.room)) - 1; nextRoom(sim, T); }
  if (m.light && T.b) startLight(sim, T.b, m.light);
  if (m.phase && T.b) { const b = bossOf(sim); if (b) b.hp = b.maxHp * (m.phase === 3 ? 0.3 : 0.6); }
  if (m.kill && T.b) { const b = bossOf(sim); if (b) { b.hp = 0; b.dead = true; T.b.won = true; } }
  if (m.clear && T.st === 'room') { for (const id of T.alive) { const e = sim.enemyById.get(id); if (e) e.dead = true; } T.alive = []; T.pend = null; T.wave = T.nw; }
}
