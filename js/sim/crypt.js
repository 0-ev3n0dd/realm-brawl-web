// The Glacier Crypt: Frostveil Peaks' Normal dungeon.
//   3 wave vaults (3 waves each; the frozen dead rise along the rim while ICICLES keep falling, more each vault) -> each
//   vault has a challenge (chains / dodge the icicles / long chains); meet it and a frozen reliquary opens when the vault
//   is clear -> the rime-door on the north rim carries the party on -> Osric, the Rimeking, on his chessboard.
// Osric plays chess with the floor. The sanctum is an 8 x 8 board of ice tiles:
//   GAMBIT   : he names a piece and the tiles that piece attacks FROM YOUR TILE shatter: ROOK (your row + column),
//              BISHOP (your diagonals), KNIGHT (the 8 knight jumps + your tile), QUEEN (row + column + diagonals: the only
//              safe squares are a knight's jump away). A clean gambit (nobody hit) puts him IN CHECK: stunned, +50% damage.
//   ABSOLUTE ZERO : every WHITE (or BLACK) square freezes; from phase 2 one colour then the other: step across.
//   CASTLING : he swaps places with the furthest player, who lands on his throne just before it is slammed.
//   FLURRY   : rotating arms of ice shards.
//   PIECES   : (phase 2+) Ice Pawns and Ice Knights stand on tiles and hop toward you in chess moves; the tile they land
//              on shatters. Kill them.
//   PHASE 3  : the outer ring of tiles sinks into black ice water (standing there freezes you) and he plays QUEEN.
//   HP 66% / 33%: phase gates. Enrage at 5.5 min: CHECKMATE (the whole board, again and again).
// A boss wipe resets only Osric (the run is kept). Co-op: the party moves vault to vault together (hub missions).
// State lives in sim.crypt as plain data (packed for co-op clients, drawn by client/frostfx.js). Authoritative only.
import { posTele } from './telegraph.js';
import { withLootLevel } from './loot.js';
import { encHpA } from './astral.js';
import { secs } from './constants.js';
import { CRYPT_ROOMS, SANCTUM, BOARD_N, BOARD_T, boardHalf, tileAt, tileCentre, cryptEntry, cryptDoor, inCryptArea, cryptRoomAt, FROST_SPAWN } from './frostconst.js';
import { spawnEnemy } from './ai.js';
import { registerWaves } from './mobhp.js';
import { damagePlayer, spawnProjectile } from './combat.js';
import { generateItem } from './loot.js';
import { inLine } from './math.js';

const TAU = Math.PI * 2;
const r0 = (v) => Math.round(v);
const N = BOARD_N;
export const CRYPT = {
  mul: 1.9, tier: 5, elite: 0.12, waveGap: secs(1.6), rise: 50, chestR: 52, doorR: 46,
  rooms: [
    { waves: [['penguin', 'penguin', 'penguin', 'sentinel'], ['shardwisp', 'shardwisp', 'penguin', 'penguin', 'acolyte'], ['sentinel', 'sentinel', 'acolyte', 'yeti!']],
      chal: { k: 'chains', need: 6, text: 'Land 6 chains' }, ice: 150 },
    { waves: [['rimewraith', 'rimewraith', 'acolyte', 'acolyte'], ['yeti', 'sentinel', 'shardwisp', 'shardwisp'], ['rimewraith', 'rimewraith', 'rimewraith', 'sentinel!', 'acolyte']],
      chal: { k: 'icicle', need: 2, text: 'Take at most 2 icicle hits' }, ice: 110 },
    { waves: [['sentinel', 'sentinel', 'sentinel', 'acolyte', 'acolyte'], ['yeti', 'yeti', 'penguin', 'penguin', 'penguin', 'penguin'], ['sentinel!', 'rimewraith!', 'shardwisp', 'shardwisp', 'acolyte']],
      chal: { k: 'long3', need: 4, text: 'Land 4 chains of 3+ steps' }, ice: 90 },
  ],
  icicle: { r: 72, d: 66, pct: 0.12 },
  boss: {
    hp: 517000, partyHp: 1, pull: secs(5), enrage: secs(450), // (DPS-UP pass: HP x~1.6, enrage 330 -> 450 s: typical ~3.2 min, a solo Bard keeps >= 70 s of margin)
    enrageEvery: secs(3),
    gambit: { d: [0, 96, 84, 76], pct: 0.34, stun: 24 }, zero: { d: 84, pct: 0.3, gap: 54 }, castle: { mark: 72, slam: 54, r: 170, pct: 0.4 },
    check: { t: secs(4), mul: 1.5 }, water: { every: 30, pct: 0.07 }, piece: { every: [0, 0, 120, 96], land: 40, pct: 0.24 },
    mate: { d: 90, pct: 0.55 },
  },
};
registerWaves('crypt', CRYPT.rooms); // (its wave trash / elites average the mob HP level curve, sim/mobhp.js)
export const CRYPT_BOSS = SANCTUM;
const PIECE_TEXT = { rook: 'ROOK · leave your row and your column', bishop: 'BISHOP · step off your diagonals', knight: 'KNIGHT · the knight jumps (and your own tile) shatter: step next door', queen: 'QUEEN · only a knight\'s jump away is safe' };

const inRoom = (p, i, pad = 30) => { const R = CRYPT_ROOMS[i]; return R.board ? Math.abs(p.x - R.x) < boardHalf() + pad && Math.abs(p.y - R.y) < boardHalf() + pad : Math.hypot(p.x - R.x, p.y - R.y) < R.r + pad; };
const here = (sim) => [...sim.players.values()].filter((p) => !p.dead && sim.crypt && inRoom(p, sim.crypt.room));
const bossOf = (sim) => sim.crypt && sim.crypt.b && sim.enemyById.get(sim.crypt.b.bid);
function place(p, s, k = 0) { const o = ((k % 5) - 2) * 30; p.x = p.px = s.x + o; p.y = p.py = s.y + Math.floor(k / 5) * 26; p.vx = p.vy = 0; p.iframes = Math.max(p.iframes || 0, 60); p.action = null; }
function call(sim, txt, sub, col, t = 150) { const T = sim.crypt, R = CRYPT_ROOMS[T.room]; T.call = { txt, sub: sub || '', col: col || '#fff', t, d: t }; sim.emit({ type: 'crypt', ph: 'call', txt, sub: sub || '', col: col || '#fff', x: r0(R.x), y: r0(R.y) }); }

// ------------------------------------------------------------------ entry / exit
export function enterCrypt(sim, p) {
  if (sim.predicting || !p) return false;
  if (p.dead) { p.dead = false; p.hp = p.stats.maxHp; p.respawnAt = 0; }
  if (!sim.crypt || sim.crypt.st === 'done') startCrypt(sim);
  const T = sim.crypt;
  if (!T.party.includes(p.id)) T.party.push(p.id);
  place(p, cryptEntry(T.room), T.party.indexOf(p.id));
  sim.emit({ type: 'crypt', ph: 'enter', pid: p.id, x: r0(p.x), y: r0(p.y), room: T.room });
  return true;
}
export function startCrypt(sim) {
  endCrypt(sim, null);
  sim.crypt = { st: 'room', room: 0, wave: 0, nw: CRYPT.rooms[0].waves.length, alive: [], gap: secs(2.5), pend: null, ch: null, chest: null, door: false, b: null, party: [], call: null, t: 0, ice: 60, icicles: [], iid: 1, chests: 0, over: 0 };
  setChallenge(sim);
  call(sim, 'THE GLACIER CRYPT', CRYPT_ROOMS[0].name + ' · ' + CRYPT.rooms[0].chal.text + ' for a frozen reliquary', '#9fe8ff', 200);
  sim.emit({ type: 'crypt', ph: 'start', x: r0(CRYPT_ROOMS[0].x), y: r0(CRYPT_ROOMS[0].y) });
}
export function endCrypt(sim, why = 'quit') {
  for (const e of sim.enemies) if (!e.dead && (e.cryptWave || e.type === 'osric') && inCryptArea(e.x, e.y)) { e.dead = true; e.hp = 0; }
  for (const pr of sim.projectiles) if (inCryptArea(pr.x, pr.y)) pr.dead = true;
  for (const a of sim.areas) if (inCryptArea(a.x, a.y)) a.dead = true;
  if (sim.crypt && why) sim.emit({ type: 'crypt', ph: 'end', why, x: r0(CRYPT_ROOMS[0].x), y: r0(CRYPT_ROOMS[0].y) });
  sim.crypt = null;
}
export function leaveCrypt(sim, p) { place(p, FROST_SPAWN); if (sim.crypt && !here(sim).length && !sim.crypt.b) endCrypt(sim, 'quit'); }
export function cryptSpot(sim) { return sim.crypt ? cryptEntry(sim.crypt.room) : FROST_SPAWN; }

function setChallenge(sim) {
  const T = sim.crypt, c = CRYPT.rooms[T.room] && CRYPT.rooms[T.room].chal;
  if (!c) { T.ch = null; return; }
  const n = Math.max(1, T.party.length || sim.players.size);
  T.ch = c.k === 'icicle' ? { k: c.k, n: 0, need: c.need + (n - 1) * 2, text: c.text, done: 1 } : { k: c.k, n: 0, need: c.need + Math.floor((n - 1) * c.need * 0.5), text: c.text, done: 0 };
}
/** dunes.js chainHooks: a chain landed */
export function cryptChain(sim, p, steps) {
  const T = sim.crypt;
  if (!T || T.st !== 'room' || !T.ch || T.ch.k === 'icicle' || T.ch.done || !inRoom(p, T.room)) return;
  const c = T.ch, ok = c.k === 'chains' || (c.k === 'long3' && steps >= 3);
  if (!ok) return;
  c.n++;
  sim.emit({ type: 'crypt', ph: 'chal', pid: p.id, n: c.n, need: c.need, x: r0(p.x), y: r0(p.y) });
  if (c.n >= c.need) { c.done = 1; sim.emit({ type: 'crypt', ph: 'chalDone', text: c.text, x: r0(p.x), y: r0(p.y) }); }
}

// ------------------------------------------------------------------ per tick
export function updateCrypt(sim) {
  const T = sim.crypt;
  if (!T || sim.predicting) return;
  T.t++;
  if (T.call && --T.call.t <= 0) T.call = null;
  const ps = here(sim);
  if (T.st === 'room') tickRoom(sim, T, ps);
  else if (T.st === 'clear') tickClear(sim, T, ps);
  else if (T.st === 'boss') tickBoss(sim, T, ps);
  tickIcicles(sim, T, ps);
  for (const p of sim.players.values()) if (!p.dead && inCryptArea(p.x, p.y) && cryptRoomAt(p.x, p.y, 40) !== T.room) place(p, cryptEntry(T.room), T.party.indexOf(p.id) + 1);
}
function tickIcicles(sim, T, ps) {
  const C = CRYPT.icicle;
  if (T.st === 'room' && T.wave > 0 && ps.length && --T.ice <= 0) { // icicles: one under someone + two anywhere in the vault
    const R = CRYPT_ROOMS[T.room];
    T.ice = CRYPT.rooms[T.room].ice;
    const tgt = ps[Math.floor(sim.rng.next() * ps.length)], pts = [[tgt.x, tgt.y]];
    for (let i = 0; i < 1 + T.room; i++) { const a = sim.rng.next() * TAU, rr = Math.sqrt(sim.rng.next()) * (R.r - 60); pts.push([R.x + Math.cos(a) * rr, R.y + Math.sin(a) * rr]); }
    for (const [x, y] of pts) T.icicles.push({ id: T.iid++, x: r0(x), y: r0(y), t: 0, d: C.d });
  }
  for (const c of T.icicles) {
    if (++c.t !== c.d) continue;
    for (const p of ps) {
      if (Math.hypot(p.x - c.x, p.y - c.y) > C.r + p.r * 0.5) continue;
      if (damagePlayer(sim, p, 0, { x: c.x, y: c.y }, { pct: C.pct, by: 'a falling icicle', kb: 160, stun: 8 }) && T.ch && T.ch.k === 'icicle' && T.st === 'room') {
        T.ch.n++;
        if (T.ch.done && T.ch.n > T.ch.need) { T.ch.done = 0; sim.emit({ type: 'crypt', ph: 'chalFail', text: T.ch.text, x: r0(p.x), y: r0(p.y) }); }
      }
    }
    sim.emit({ type: 'crypt', ph: 'icicle', x: c.x, y: c.y });
  }
  T.icicles = T.icicles.filter((c) => c.t < c.d + 10);
}
function tickRoom(sim, T, ps) {
  const R = CRYPT_ROOMS[T.room];
  T.alive = T.alive.filter((id) => { const e = sim.enemyById.get(id); return e && !e.dead; });
  if (T.pend) { if (--T.pend.t <= 0) { for (const s of T.pend.list) spawnWaveEnemy(sim, T, s); T.pend = null; } return; }
  if (T.alive.length) return;
  if (T.wave >= T.nw) { roomClear(sim, T); return; }
  if (!ps.length) return;
  if (--T.gap > 0) return;
  const wave = CRYPT.rooms[T.room].waves[T.wave].slice();
  const n = Math.max(1, ps.length), extra = Math.floor((n - 1) / 2);
  for (let i = 0; i < extra; i++) wave.push(wave[i % wave.length].replace('!', ''));
  const list = wave.map((k, i) => {
    const a = -Math.PI / 2 + (i / wave.length) * TAU + T.wave * 0.5, rr = R.r * 0.72;
    return { type: k.replace('!', ''), elite: k.endsWith('!') || sim.rng.next() < CRYPT.elite, x: r0(R.x + Math.cos(a) * rr), y: r0(R.y + Math.sin(a) * rr) };
  });
  T.wave++;
  T.pend = { t: CRYPT.rise, list };
  sim.emit({ type: 'crypt', ph: 'wave', room: T.room, wave: T.wave, nw: T.nw, pts: list.map((s) => [s.x, s.y, s.elite ? 1 : 0]), x: r0(R.x), y: r0(R.y) });
  T.gap = CRYPT.waveGap;
}
function spawnWaveEnemy(sim, T, s) {
  const R = CRYPT_ROOMS[T.room];
  const e = spawnEnemy(sim, s.type, s.x, s.y, { elite: s.elite, mul: CRYPT.mul, tier: CRYPT.tier, wave: true });
  e.cryptWave = 1; e.homeX = R.x; e.homeY = R.y; e.cd = 30 + Math.floor(sim.rng.next() * 40);
  if (e.ai === 'sentinel') e.woke = 1; // (risen in the fight: awake)
  const t = here(sim)[0]; if (t) e.aggroId = t.id;
  T.alive.push(e.id);
}
function roomClear(sim, T) {
  const R = CRYPT_ROOMS[T.room];
  T.st = 'clear'; T.door = true; T.icicles = [];
  if (T.ch && T.ch.done) T.chest = { x: r0(R.x), y: r0(R.y - 40), open: 0 };
  call(sim, 'VAULT CLEARED', T.chest ? 'The frozen reliquary cracks open for you · then take the rime-door north' : 'The rime-door opens to the north', '#bff6ff', 170);
  sim.emit({ type: 'crypt', ph: 'roomClear', room: T.room, chest: T.chest ? 1 : 0, x: r0(R.x), y: r0(R.y) });
}
function tickClear(sim, T, ps) {
  if (T.chest && !T.chest.open) for (const p of ps) if (Math.hypot(p.x - T.chest.x, p.y - T.chest.y) < CRYPT.chestR) { openChest(sim, T); break; }
  const D = cryptDoor(T.room);
  for (const p of ps) if (Math.hypot(p.x - D.x, p.y - D.y) < CRYPT.doorR) { nextRoom(sim, T); return; }
}
function openChest(sim, T) {
  T.chest.open = 1; T.chests++;
  for (const id of T.party) {
    const p = sim.players.get(id);
    if (!p) continue;
    const items = withLootLevel(p.level, () => [0, 1].map(() => generateItem(sim.rng, { tier: 5, cls: p.cls, rarity: sim.rng.next() < 0.35 ? 3 : 2 })));
    const bag = { id: sim.id(), x: T.chest.x + (sim.rng.next() - 0.5) * 40, y: T.chest.y + 34, items, ownerId: p.id, life: secs(120), rarity: Math.max(...items.map((i) => i.rarity)) };
    sim.bags.push(bag);
    sim.emit({ type: 'loot', x: bag.x, y: bag.y, rarity: bag.rarity, pid: p.id });
  }
  sim.emit({ type: 'crypt', ph: 'chest', x: T.chest.x, y: T.chest.y });
}
function nextRoom(sim, T) {
  T.room++; T.chest = null; T.door = false; T.icicles = [];
  const ps = [...sim.players.values()];
  if (T.room >= 3) { startBoss(sim, T); ps.forEach((p, i) => { if (!p.dead) place(p, cryptEntry(3), i); }); }
  else {
    T.st = 'room'; T.wave = 0; T.nw = CRYPT.rooms[T.room].waves.length; T.gap = secs(2.2); T.alive = []; T.ice = 90;
    setChallenge(sim);
    ps.forEach((p, i) => { if (!p.dead) place(p, cryptEntry(T.room), i); });
    call(sim, CRYPT_ROOMS[T.room].name.toUpperCase(), `Vault ${T.room + 1} of 3 · Challenge: ${T.ch.text}`, '#9fe8ff', 180);
  }
  sim.emit({ type: 'crypt', ph: 'room', room: T.room, x: r0(CRYPT_ROOMS[T.room].x), y: r0(CRYPT_ROOMS[T.room].y) });
}

// ------------------------------------------------------------------ the board
const idx = (i, j) => i + j * N;
const onB = (i, j) => i >= 0 && j >= 0 && i < N && j < N;
export const isWhite = (i, j) => (i + j) % 2 === 0;
/** tiles attacked by `piece` from tile (i, j) (the tile itself included for knight / queen? see PIECE rules) */
export function pieceCells(piece, i, j) {
  const out = new Set();
  const ray = (di, dj) => { for (let k = 1; k < N; k++) { const a = i + di * k, b = j + dj * k; if (!onB(a, b)) break; out.add(idx(a, b)); } };
  if (piece === 'rook' || piece === 'queen') { out.add(idx(i, j)); ray(1, 0); ray(-1, 0); ray(0, 1); ray(0, -1); }
  if (piece === 'bishop' || piece === 'queen') { out.add(idx(i, j)); ray(1, 1); ray(-1, -1); ray(1, -1); ray(-1, 1); }
  if (piece === 'knight') { out.add(idx(i, j)); for (const [a, b] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) if (onB(i + a, j + b)) out.add(idx(i + a, j + b)); }
  return out;
}
/** the ring of tiles that sinks in phase 3 */
export const ringCell = (i, j, shrink) => i < shrink || j < shrink || i >= N - shrink || j >= N - shrink;

// ------------------------------------------------------------------ Osric, the Rimeking
function startBoss(sim, T, attempts = 0) {
  const B = CRYPT.boss, R = SANCTUM;
  for (const e of sim.enemies) if (!e.dead && (e.type === 'osric' || e.ai === 'piece')) e.dead = true;
  const b = spawnEnemy(sim, 'osric', R.x, R.y - BOARD_T * 2.5);
  b.cd = 1e6; b.raidHold = 1e6; b.face = Math.PI / 2; b.dropChance = 1; b.invuln = B.pull; b.homeX = b.x; b.homeY = b.y;
  T.st = 'boss';
  T.b = { st: 'pull', at: 0, pull: B.pull, bid: b.id, phase: 1, tele: [], tid: 1, script: [], cyc: 0, shrink: 0, enr: B.enrage, enraged: false, attempts, empty: 0, t: 0, won: false, hits: {}, check: 0, pieces: [], pt: 0, gambits: 0 };
  call(sim, 'OSRIC, THE RIMEKING', attempts ? `Attempt ${attempts + 1} · the board is reset` : 'He froze his court mid-game. Now you are his pieces.', '#cfeaff', B.pull);
  sim.emit({ type: 'crypt', ph: 'bossPull', x: r0(b.x), y: r0(b.y), t: B.pull });
}
const CYCLE = {
  1: [[50, 'gambit', 'rook'], [230, 'flurry'], [330, 'gambit', 'bishop'], [500, 'castle'], [640, 'zero'], [800, 'gambit', 'knight'], [960, null]],
  2: [[40, 'gambit', 'knight'], [200, 'zero'], [330, 'castle'], [450, 'gambit', 'rook'], [560, 'flurry'], [680, 'gambit', 'bishop'], [840, 'zero'], [960, null]],
  3: [[40, 'gambit', 'queen'], [190, 'zero'], [310, 'castle'], [420, 'gambit', 'queen'], [560, 'flurry'], [650, 'gambit', 'knight'], [780, 'zero'], [880, null]],
};
function startCycle(Bd) { Bd.at = 0; Bd.cyc++; Bd.script = CYCLE[Bd.phase].map(([at, k, pc]) => ({ at, k, pc })); }
function tickBoss(sim, T, ps) {
  const Bd = T.b, B = CRYPT.boss, b = bossOf(sim), R = SANCTUM;
  if (Bd.st === 'victory') {
    const ex = cryptDoor(3);
    for (const p of ps) if (Math.hypot(p.x - ex.x, p.y - ex.y) < 46) { if (sim.hub) T.over = 1; else { for (const q of sim.players.values()) if (inCryptArea(q.x, q.y)) place(q, FROST_SPAWN); endCrypt(sim, null); } return; }
    Bd.at++;
    return;
  }
  if (Bd.st === 'wipe') { if (++Bd.at >= secs(4)) { startBoss(sim, T, Bd.attempts + 1); [...sim.players.values()].forEach((p, i) => { if (p.dead) { p.dead = false; p.hp = p.stats.maxHp; p.respawnAt = 0; } place(p, cryptEntry(3), i); }); } return; }
  if (Bd.won || !b || b.dead) { bossVictory(sim, T); return; }
  if (!ps.length) { if (++Bd.empty > 60) wipeBoss(sim, T, b); return; }
  Bd.empty = 0;
  if (b.hitstop > 10) b.hitstop = 10;
  if (Bd.st === 'pull') {
    if (--Bd.pull <= 0) {
      Bd.st = 'fight'; Bd.n = ps.length;
      const hp = Math.round(B.hp * encHpA(sim, 'crypt') * (1 + B.partyHp * (Bd.n - 1))); b.maxHp = b.hp = b.baseMaxHp = hp; // (game loop C2: the band it sits in now, sim/levelscale.js)
      b.invuln = 0; startCycle(Bd);
      sim.emit({ type: 'crypt', ph: 'bossStart', x: r0(b.x), y: r0(b.y), n: Bd.n, hp });
    }
    return;
  }
  Bd.t++;
  b.x = b.homeX; b.y = b.homeY; // (the king never walks; he castles)
  if (Bd.enr > 0 && --Bd.enr === 0) { Bd.enraged = true; call(sim, 'CHECKMATE', 'The whole board shatters, again and again', '#ff3b3b', 240); sim.emit({ type: 'crypt', ph: 'enrage', x: r0(b.x), y: r0(b.y) }); }
  if (Bd.enraged && Bd.t % B.enrageEvery === 0) tele(Bd, { k: 'mate', sh: 'tiles', c: allCells(), d: B.mate.d, pct: B.mate.pct, what: 'Checkmate' });
  // phase gates
  const pct = b.hp / b.maxHp, want = pct > 0.66 ? 1 : pct > 0.33 ? 2 : 3;
  if (want > Bd.phase) {
    Bd.phase = want; b.phase = want; b.invuln = 0; b.takeMul = 1; Bd.check = 0;
    for (const t of Bd.tele) t.cancel = 1;
    Bd.tele = Bd.tele.filter((t) => t.done);
    if (want === 2) { spawnPiece(sim, Bd, 'iceknight'); spawnPiece(sim, Bd, 'icepawn'); spawnPiece(sim, Bd, 'icepawn'); call(sim, 'THE COURT WAKES', 'Phase 2 · Ice Pawns and Knights hop toward you · kill them', '#bfe3ff', 170); }
    else { Bd.sinkAt = Bd.t + 150; tele(Bd, { k: 'sink', sh: 'tiles', c: ringCells(1), d: 150, pct: 0.2, what: 'the sinking ring' }); spawnPiece(sim, Bd, 'iceknight'); spawnPiece(sim, Bd, 'iceknight'); call(sim, 'THE BOARD SINKS', 'Phase 3 · the outer ring drowns in black ice · he plays QUEEN now', '#9fd8ff', 170); }
    sim.emit({ type: 'crypt', ph: 'phase', phase: want, x: r0(b.x), y: r0(b.y) });
    sim.emit({ type: 'bossPhase', phase: want, x: b.x, y: b.y, id: b.id, raid: true });
    startCycle(Bd);
  }
  if (Bd.sinkAt && Bd.t >= Bd.sinkAt) { Bd.shrink = 1; Bd.sinkAt = 0; sim.emit({ type: 'crypt', ph: 'sunk', x: r0(R.x), y: r0(R.y) }); }
  // the drowned ring freezes whoever stands on it
  if (Bd.shrink && Bd.t % B.water.every === 0) for (const p of ps) { const c = tileAt(p.x, p.y); if (!c || ringCell(c[0], c[1], Bd.shrink)) hit(sim, Bd, p, B.water.pct, 'black ice water', null); }
  // in check: stunned + exposed
  if (Bd.check > 0) { Bd.check--; b.takeMul = B.check.mul; if (Bd.check === 0) b.takeMul = 1; }
  // the script
  Bd.at++;
  for (const s of Bd.script) if (!s.done && Bd.at >= s.at) { s.done = true; if (s.k) runMech(sim, Bd, b, s, ps); else startCycle(Bd); }
  tickPieces(sim, Bd, ps);
  tickTele(sim, Bd, ps, b);
}
const allCells = () => Array.from({ length: N * N }, (_, k) => k);
const ringCells = (shrink) => allCells().filter((k) => ringCell(k % N, Math.floor(k / N), shrink));
function tele(Bd, spec) { const t = { id: Bd.tid++, t: 0, ...spec }; Bd.tele.push(t); return t; }
function runMech(sim, Bd, b, s, ps) {
  const B = CRYPT.boss, R = SANCTUM;
  if (s.k === 'gambit') {
    const set = new Set(), marks = [];
    for (const p of ps) { const c = tileAt(p.x, p.y); if (!c) continue; marks.push([p.id, c[0], c[1]]); for (const k of pieceCells(s.pc, c[0], c[1])) set.add(k); }
    if (!set.size) return;
    tele(Bd, { k: 'gambit', sh: 'tiles', c: [...set], d: B.gambit.d[Bd.phase], pct: B.gambit.pct, stun: B.gambit.stun, piece: s.pc, marks, what: s.pc[0].toUpperCase() + s.pc.slice(1) + ' Gambit', gambit: 1 });
    call(sim, s.pc.toUpperCase() + ' GAMBIT', PIECE_TEXT[s.pc], '#cfeaff', 110);
    sim.emit({ type: 'crypt', ph: 'cast', k: 'gambit', piece: s.pc, x: r0(b.x), y: r0(b.y) });
  } else if (s.k === 'zero') {
    const first = sim.rng.next() < 0.5, cells = (w) => allCells().filter((k) => isWhite(k % N, Math.floor(k / N)) === w);
    tele(Bd, { k: 'zero', sh: 'tiles', c: cells(first), d: B.zero.d, pct: B.zero.pct, white: first ? 1 : 0, what: 'Absolute Zero' });
    if (Bd.phase >= 2) tele(Bd, { k: 'zero', sh: 'tiles', c: cells(!first), d: B.zero.d + B.zero.gap, pct: B.zero.pct, white: first ? 0 : 1, what: 'Absolute Zero' });
    call(sim, 'ABSOLUTE ZERO', (first ? 'WHITE' : 'BLACK') + ' squares freeze' + (Bd.phase >= 2 ? ' · then the other colour: step across' : ''), '#e8f8ff', 110);
    sim.emit({ type: 'crypt', ph: 'cast', k: 'zero', x: r0(b.x), y: r0(b.y) });
  } else if (s.k === 'castle') {
    let far = null, fd = -1; for (const p of ps) { const d = Math.hypot(p.x - b.x, p.y - b.y); if (d > fd) { fd = d; far = p; } }
    if (!far) return;
    tele(Bd, { k: 'castle', sh: 'circle', pid: far.id, x: r0(far.x), y: r0(far.y), r: 40, d: B.castle.mark, pct: 0, follow: 1, what: 'Castling', mark: 1 });
    call(sim, 'CASTLING', 'He swaps places with the furthest player · get off his throne', '#cfeaff', 110);
  } else if (s.k === 'flurry') {
    Bd.flurry = { t: 0, rot: sim.rng.next() * TAU };
  }
}
function castleSwap(sim, Bd, b, t) {
  const p = sim.players.get(t.pid), B = CRYPT.boss;
  if (!p || p.dead) return;
  const bx = b.homeX, by = b.homeY;
  b.homeX = b.x = b.px = p.x; b.homeY = b.y = b.py = p.y;
  place(p, { x: bx, y: by });
  tele(Bd, { k: 'throne', sh: 'circle', x: r0(bx), y: r0(by), r: B.castle.r, d: B.castle.slam, pct: B.castle.pct, what: 'Throne Slam' });
  sim.emit({ type: 'crypt', ph: 'castle', pid: p.id, x: r0(bx), y: r0(by), bx: r0(b.x), by: r0(b.y) });
}
function spawnPiece(sim, Bd, type) {
  const free = [];
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) { const c = tileCentre(i, j); if (!Bd.pieces.some((q) => q.i === i && q.j === j)) free.push([i, j, c]); }
  const [i, j, c] = free[Math.floor(sim.rng.next() * free.length)];
  const e = spawnEnemy(sim, type, c.x, c.y, { mul: 1.6, tier: 5, zoneHp: false }); // (Osric's board pieces: boss mechanic)
  e.cryptWave = 1; e.dropChance = 0.1; e.homeX = c.x; e.homeY = c.y; e.cd = 1e6;
  Bd.pieces.push({ id: e.id, i, j, type, t: 60 + Math.floor(sim.rng.next() * 60), to: null });
}
function tickPieces(sim, Bd, ps) {
  const B = CRYPT.boss;
  Bd.pieces = Bd.pieces.filter((q) => { const e = sim.enemyById.get(q.id); return e && !e.dead; });
  if (Bd.flurry) { const F = Bd.flurry, b = bossOf(sim); F.t++; if (b && F.t % 6 === 0) { const arms = Bd.phase >= 3 ? 5 : 4; for (let i = 0; i < arms; i++) { const a = F.rot + (i / arms) * TAU; spawnProjectile(sim, { team: 'enemy', ownerId: b.id, x: b.x, y: b.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, r: 9, life: 200, dmg: b.dmg * 0.6, style: 'ice', kb: 70, by: b.name }); } F.rot += 0.19 * (Bd.cyc % 2 ? 1 : -1); } if (F.t >= 110) Bd.flurry = null; }
  for (const q of Bd.pieces) {
    const e = sim.enemyById.get(q.id);
    e.x = e.homeX; e.y = e.homeY; e.vx = e.vy = 0;
    if (q.to) { if (--q.to.t <= 0) { q.i = q.to.i; q.j = q.to.j; const c = tileCentre(q.i, q.j); e.x = e.px = e.homeX = c.x; e.y = e.py = e.homeY = c.y; q.to = null; sim.emit({ type: 'crypt', ph: 'hop', id: e.id, x: r0(c.x), y: r0(c.y) }); } continue; }
    if (--q.t > 0 || !ps.length) continue;
    q.t = B.piece.every[Bd.phase] || 110;
    let tgt = ps[0], bd = 1e9; for (const p of ps) { const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < bd) { bd = d; tgt = p; } }
    const pc = tileAt(tgt.x, tgt.y) || [q.i, q.j];
    const moves = q.type === 'iceknight' ? [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let best = null, bv = 1e9;
    for (const [a, c] of moves) { const i = q.i + a, j = q.j + c; if (!onB(i, j) || ringCell(i, j, Bd.shrink) || Bd.pieces.some((o) => o !== q && o.i === i && o.j === j)) continue; const v = Math.abs(i - pc[0]) + Math.abs(j - pc[1]); if (v < bv) { bv = v; best = [i, j]; } }
    if (!best) continue;
    q.to = { i: best[0], j: best[1], t: B.piece.land };
    tele(Bd, { k: 'hop', sh: 'tiles', c: [idx(best[0], best[1])], d: B.piece.land, pct: B.piece.pct, what: q.type === 'iceknight' ? 'an Ice Knight' : 'an Ice Pawn' });
  }
}
/** Is p caught by telegraph t? */
export function cryptTeleHits(t, p) {
  const pr = (p.r || 16) * 0.5;
  switch (t.sh) {
    case 'circle': return Math.hypot(p.x - t.x, p.y - t.y) < t.r + pr;
    case 'rect': return inLine(t.x - Math.cos(t.ang) * t.len / 2, t.y - Math.sin(t.ang) * t.len / 2, t.ang, t.len, t.w, p.x, p.y, pr);
    case 'tiles': { const c = tileAt(p.x, p.y); return !!c && t.c.includes(idx(c[0], c[1])); }
    default: return false;
  }
}
function tickTele(sim, Bd, ps, b) {
  for (const t of Bd.tele) {
    t.t++;
    if (t.follow && t.t < t.d - 16) { const p = sim.players.get(t.pid); if (p && !p.dead) { t.x = r0(p.x); t.y = r0(p.y); } }
    if (t.t === t.d && !t.done && !t.cancel) {
      t.done = true; sim.posCheck = posTele(t) ? 1 : 0;
      if (t.k === 'castle') { castleSwap(sim, Bd, b, t); continue; }
      let clean = true;
      for (const p of ps) { if (!cryptTeleHits(t, p)) continue; if (hit(sim, Bd, p, t.pct, t.what, t.sh === 'circle' ? { x: t.x, y: t.y } : null, t.stun)) clean = false; }
      if (t.gambit) {
        Bd.gambits++;
        if (clean) { Bd.check = CRYPT.boss.check.t; b.takeMul = CRYPT.boss.check.mul; b.cc.stun = Math.max(b.cc.stun, CRYPT.boss.check.t); call(sim, 'CHECK!', 'A clean gambit · Osric is exposed (+50% damage)', '#7dffb0', 120); sim.emit({ type: 'crypt', ph: 'check', x: r0(b.x), y: r0(b.y) }); }
      }
      sim.emit({ type: 'crypt', ph: 'boom', k: t.k, sh: t.sh, c: t.sh === 'tiles' ? t.c : undefined, x: r0(t.x ?? SANCTUM.x), y: r0(t.y ?? SANCTUM.y), r: t.r });
    }
  }
  Bd.tele = Bd.tele.filter((t) => !t.cancel && (!t.done || t.t < t.d + 40));
  sim.posCheck = 0;
}
function hit(sim, Bd, p, pct, what, src, stun = 0) {
  const ok = damagePlayer(sim, p, 0, src, { pct, raw: what === 'Checkmate', by: `Osric's ${what}`, kb: src ? 240 : 0, stun });
  if (ok) { Bd.hits[what] = (Bd.hits[what] || 0) + 1; sim.emit({ type: 'crypt', ph: 'hit', pid: p.id, what, x: r0(p.x), y: r0(p.y) }); }
  return ok;
}
function wipeBoss(sim, T, b) {
  const Bd = T.b;
  Bd.st = 'wipe'; Bd.at = 0; Bd.tele = []; Bd.flurry = null;
  if (b) { b.dead = true; b.hp = 0; }
  for (const e of sim.enemies) if (!e.dead && e.cryptWave && inCryptArea(e.x, e.y)) { e.dead = true; e.hp = 0; }
  for (const pr of sim.projectiles) if (inCryptArea(pr.x, pr.y)) pr.dead = true;
  call(sim, 'STALEMATE', 'Osric resets the board · your run is kept', '#ff8a7a', secs(4));
  sim.emit({ type: 'crypt', ph: 'wipe', x: r0(SANCTUM.x), y: r0(SANCTUM.y), attempts: Bd.attempts + 1 });
}
function bossVictory(sim, T) {
  const Bd = T.b, R = SANCTUM;
  Bd.st = 'victory'; Bd.at = 0; Bd.tele = []; Bd.flurry = null; Bd.shrink = 0;
  for (const e of sim.enemies) if (!e.dead && e.cryptWave && inCryptArea(e.x, e.y)) { e.dead = true; e.hp = 0; }
  const secsT = Math.round(T.t / 60);
  call(sim, 'THE KING IS TOPPLED', `Crypt cleared in ${Math.floor(secsT / 60)}:${String(secsT % 60).padStart(2, '0')} · ${sim.hub ? 'the rime-door leads home' : 'the rime-door leads back to camp'}`, '#bff6ff', 360);
  for (const id of T.party) {
    const p = sim.players.get(id);
    if (!p) continue;
    p.unlocks = p.unlocks || {};
    const items = withLootLevel(p.level, () => [generateItem(sim.rng, { tier: 5, cls: p.cls, rarity: 3 }), generateItem(sim.rng, { tier: 5, cls: p.cls, rarity: sim.rng.next() < 0.5 ? 3 : 2 })]);
    const bag = { id: sim.id(), x: R.x + (sim.rng.next() - 0.5) * 60, y: R.y + 30, items, ownerId: p.id, life: secs(180), rarity: Math.max(...items.map((i) => i.rarity)) };
    sim.bags.push(bag);
    sim.emit({ type: 'loot', x: bag.x, y: bag.y, rarity: bag.rarity, pid: p.id });
    const fresh = !p.unlocks.crypt; p.unlocks.crypt = 1; sim.emit({ type: 'unlock', pid: p.id, key: 'crypt', fresh: fresh ? 1 : 0, x: r0(R.x), y: r0(R.y) });
  }
  sim.emit({ type: 'crypt', ph: 'victory', x: r0(R.x), y: r0(R.y), t: secsT, attempts: Bd.attempts, gambits: Bd.gambits });
}

/** Compact copy for co-op snapshots (the renderer reads the same shape from a local sim). */
export function packCrypt(sim) {
  const T = sim.crypt;
  if (!T) return null;
  const Bd = T.b;
  return {
    st: T.st, room: T.room, wave: T.wave, nw: T.nw, ch: T.ch, chest: T.chest, door: T.door, call: T.call, t: T.t,
    pend: T.pend ? { t: T.pend.t, pts: T.pend.list.map((s) => [s.x, s.y, s.elite ? 1 : 0]) } : null,
    ic: T.icicles.map((c) => [c.x, c.y, c.t, c.d]),
    b: Bd ? { st: Bd.st, phase: Bd.phase, at: Bd.at, pull: Bd.pull, enr: Bd.enr, enraged: Bd.enraged, attempts: Bd.attempts, bid: Bd.bid, shrink: Bd.shrink, check: Bd.check, sinkAt: Bd.sinkAt ? Bd.sinkAt - Bd.t : 0,
      pieces: Bd.pieces.map((q) => [q.id, q.i, q.j, q.to ? q.to.i : -1, q.to ? q.to.j : -1]),
      tele: Bd.tele.map((t) => ({ id: t.id, k: t.k, sh: t.sh, x: t.x, y: t.y, r: t.r, c: t.c, d: t.d, t: t.t, piece: t.piece, marks: t.marks, white: t.white, done: t.done ? 1 : 0, pid: t.pid })) } : null,
  };
}
/** Test / dev hook: jump to a vault or the boss, set a phase, kill the boss, clear a vault. */
export function devCrypt(sim, p, m) {
  if (!sim.crypt) enterCrypt(sim, p);
  const T = sim.crypt;
  if (m.room != null) { for (const id of T.alive) { const e = sim.enemyById.get(id); if (e) e.dead = true; } T.alive = []; T.pend = null; T.room = Math.max(0, Math.min(3, m.room)) - 1; nextRoom(sim, T); }
  if (m.phase && T.b) { const b = bossOf(sim); if (b) b.hp = b.maxHp * (m.phase === 3 ? 0.3 : 0.6); }
  if (m.mech && T.b && T.b.st === 'fight') { const b = bossOf(sim); if (b) runMech(sim, T.b, b, { k: m.mech, pc: m.piece || 'rook' }, here(sim)); }
  if (m.kill && T.b) { const b = bossOf(sim); if (b) { b.hp = 0; b.dead = true; T.b.won = true; } }
  if (m.clear && T.st === 'room') { for (const id of T.alive) { const e = sim.enemyById.get(id); if (e) e.dead = true; } T.alive = []; T.pend = null; T.wave = T.nw; }
}
