// The Forge of Cinders: Emberdeep's Normal dungeon.
//   3 wave halls (3 waves each; the smiths' creations climb out of the slag along the rim while MOLTEN SLAG keeps
//   dripping from the crucibles overhead, more each hall) -> each hall has a challenge; meet it and a strongbox opens
//   when the hall is clear -> the forge-door on the north rim leads on -> Hephast, the Cinder Smith, in his foundry.
// Hephast's foundry floor is an assembly line: 6 conveyor BELTS (lanes) of 10 cells, alternate lanes running opposite
// ways; whatever stands on a belt is carried along, and the belt's far end is a glowing CRUCIBLE MOUTH that burns.
//   CASTING POUR : (the signature) a mould silhouette (HAMMER / CROWN / KEY / ANVIL / SWORD) is pressed into the floor,
//                  then molten metal floods every cell EXCEPT the mould. The mould's cells ride the belts, so the shape
//                  SHEARS apart lane by lane while you wait: pick a safe cell and walk with it (or against your belt).
//                  A flawless cast (nobody burned) cracks his apron: stunned, +50% damage.
//   STAMP        : the drop hammers slam pairs of columns, marching across the floor.
//   BELLOWS      : the bellows roar: every belt reverses and runs at double speed while embers race down the lanes.
//   TONGS        : he grabs the furthest hero and drops them on a crucible mouth: get off it.
//   phase 2      : Slag Constructs and a Forge Thrall join; the belts speed up.
//   phase 3      : the outer columns become crucible (the floor narrows); pours come faster.
//   HP 66% / 33% phase gates. Enrage at 5.5 min: MASTERWORK (pours with no mould, again and again).
// A boss wipe resets only Hephast (the run is kept). Co-op: the party moves hall to hall together (hub missions).
// State lives in sim.forge as plain data (packed for co-op clients, drawn by client/forgefx.js). Authoritative only.
import { posTele } from './telegraph.js';
import { withLootLevel } from './loot.js';
import { encHpA } from './astral.js';
import { secs, DT } from './constants.js';
import { FORGE_STATE, FORGE_ROOMS, FOUNDRY, FOUNDRY_COLS, FOUNDRY_LANES, FT, FHW, FHH, cellAt, cellCentre, forgeEntry, forgeDoor, inForgeArea, forgeRoomAt, EMBER_SPAWN } from './emberconst.js';
import { spawnEnemy } from './ai.js';
import { registerWaves } from './mobhp.js';
import { damagePlayer, spawnProjectile } from './combat.js';
import { generateItem } from './loot.js';

const TAU = Math.PI * 2;
const r0 = (v) => Math.round(v);
const NC = FOUNDRY_COLS, NL = FOUNDRY_LANES;
export const FORGE = {
  mul: 1.9, tier: 6, elite: 0.12, waveGap: secs(1.6), rise: 50, chestR: 52, doorR: 46,
  rooms: [
    { waves: [['kindler', 'kindler', 'kindler', 'thrall'], ['moth', 'moth', 'kindler', 'kindler', 'construct'], ['thrall', 'thrall', 'construct', 'basalt!']],
      chal: { k: 'chains', need: 6, text: 'Land 6 chains' }, slag: 150 },
    { waves: [['lavaeel', 'lavaeel', 'construct', 'construct'], ['basalt', 'thrall', 'moth', 'moth'], ['construct', 'construct', 'mortar', 'thrall!', 'kindler']],
      chal: { k: 'slag', need: 2, text: 'Take at most 2 slag hits' }, slag: 110 },
    { waves: [['thrall', 'thrall', 'thrall', 'mortar', 'mortar'], ['basalt', 'basalt', 'kindler', 'kindler', 'kindler', 'kindler'], ['thrall!', 'construct!', 'moth', 'moth', 'lavaeel']],
      chal: { k: 'long3', need: 4, text: 'Land 4 chains of 3+ steps' }, slag: 90 },
  ],
  slag: { r: 72, d: 66, pct: 0.12 },
  boss: {
    hp: 937000, partyHp: 1, pull: secs(5), enrage: secs(450), // (DPS-UP pass: HP x~1.6, enrage 330 -> 450 s: typical ~3.2 min, a solo Bard keeps >= 70 s of margin)
    enrageEvery: secs(3),
    belt: [0, 1.1, 1.35, 1.6], // px per tick per phase
    pour: { d: [0, 150, 140, 120], pct: 0.36, stun: 20 }, stamp: { d: 50, gap: 22, pct: 0.3 }, tongs: { mark: 72, pct: 0.06 },
    bellows: { warn: 60, dur: 240, k: 2 }, mouth: { every: 20, pct: 0.06 }, flaw: { t: secs(4), mul: 1.5 }, mate: { d: 90, pct: 0.55 },
  },
};
registerWaves('forge', FORGE.rooms); // (its wave trash / elites average the mob HP level curve, sim/mobhp.js)
/** mould silhouettes: 6 lanes x 10 cells, '#' = the safe hollow of the mould */
export const MOLDS = {
  hammer: ['.###......', '.###......', '..#.......', '..#.......', '..#.......', '..........'],
  crown: ['..........', '.#.#.#....', '.#####....', '.#####....', '..........', '..........'],
  key: ['..........', '###.......', '#.#######.', '###...#.#.', '..........', '..........'],
  anvil: ['..........', '..........', '..######..', '....##....', '...####...', '..........'],
  sword: ['..........', '...#......', '#########.', '...#......', '..........', '..........'],
};
export const MOLD_KEYS = Object.keys(MOLDS);
export const FORGE_BOSS = FOUNDRY;

const inRoom = (p, i, pad = 30) => { const R = FORGE_ROOMS[i]; return R.foundry ? Math.abs(p.x - R.x) < FHW + pad && Math.abs(p.y - R.y) < FHH + pad : Math.hypot(p.x - R.x, p.y - R.y) < R.r + pad; };
const here = (sim) => [...sim.players.values()].filter((p) => !p.dead && sim.forge && inRoom(p, sim.forge.room));
const bossOf = (sim) => sim.forge && sim.forge.b && sim.enemyById.get(sim.forge.b.bid);
function place(p, s, k = 0) { const o = ((k % 5) - 2) * 30; p.x = p.px = s.x + o; p.y = p.py = s.y - Math.floor(k / 5) * 26; p.vx = p.vy = 0; p.iframes = Math.max(p.iframes || 0, 60); p.action = null; }
function call(sim, txt, sub, col, t = 150) { const T = sim.forge, R = FORGE_ROOMS[T.room]; T.call = { txt, sub: sub || '', col: col || '#fff', t, d: t }; sim.emit({ type: 'forge', ph: 'call', txt, sub: sub || '', col: col || '#fff', x: r0(R.x), y: r0(R.y) }); }

// ------------------------------------------------------------------ entry / exit
export function enterForge(sim, p) {
  if (sim.predicting || !p) return false;
  if (p.dead) { p.dead = false; p.hp = p.stats.maxHp; p.respawnAt = 0; }
  if (!sim.forge || sim.forge.st === 'done') startForge(sim);
  const T = sim.forge;
  if (!T.party.includes(p.id)) T.party.push(p.id);
  place(p, forgeEntry(T.room), T.party.indexOf(p.id));
  sim.emit({ type: 'forge', ph: 'enter', pid: p.id, x: r0(p.x), y: r0(p.y), room: T.room });
  return true;
}
export function startForge(sim) {
  endForge(sim, null);
  sim.forge = { st: 'room', room: 0, wave: 0, nw: FORGE.rooms[0].waves.length, alive: [], gap: secs(2.5), pend: null, ch: null, chest: null, door: false, b: null, party: [], call: null, t: 0, drip: 60, slag: [], sid: 1, chests: 0, over: 0 };
  setChallenge(sim);
  call(sim, 'THE FORGE OF CINDERS', FORGE_ROOMS[0].name + ' · ' + FORGE.rooms[0].chal.text + ' for a smith\'s strongbox', '#ffb36a', 200);
  sim.emit({ type: 'forge', ph: 'start', x: r0(FORGE_ROOMS[0].x), y: r0(FORGE_ROOMS[0].y) });
}
export function endForge(sim, why = 'quit') {
  for (const e of sim.enemies) if (!e.dead && (e.forgeWave || e.type === 'hephast') && inForgeArea(e.x, e.y)) { e.dead = true; e.hp = 0; }
  for (const pr of sim.projectiles) if (inForgeArea(pr.x, pr.y)) pr.dead = true;
  for (const a of sim.areas) if (inForgeArea(a.x, a.y)) a.dead = true;
  if (sim.forge && why) sim.emit({ type: 'forge', ph: 'end', why, x: r0(FORGE_ROOMS[0].x), y: r0(FORGE_ROOMS[0].y) });
  sim.forge = null;
  FORGE_STATE.shrink = 0;
}
export function leaveForge(sim, p) { place(p, EMBER_SPAWN); if (sim.forge && !here(sim).length && !sim.forge.b) endForge(sim, 'quit'); }
export function forgeSpot(sim) { return sim.forge ? forgeEntry(sim.forge.room) : EMBER_SPAWN; }

function setChallenge(sim) {
  const T = sim.forge, c = FORGE.rooms[T.room] && FORGE.rooms[T.room].chal;
  if (!c) { T.ch = null; return; }
  const n = Math.max(1, T.party.length || sim.players.size);
  T.ch = c.k === 'slag' ? { k: c.k, n: 0, need: c.need + (n - 1) * 2, text: c.text, done: 1 } : { k: c.k, n: 0, need: c.need + Math.floor((n - 1) * c.need * 0.5), text: c.text, done: 0 };
}
/** dunes.js chainHooks: a chain landed */
export function forgeChain(sim, p, steps) {
  const T = sim.forge;
  if (!T || T.st !== 'room' || !T.ch || T.ch.k === 'slag' || T.ch.done || !inRoom(p, T.room)) return;
  const c = T.ch, ok = c.k === 'chains' || (c.k === 'long3' && steps >= 3);
  if (!ok) return;
  c.n++;
  sim.emit({ type: 'forge', ph: 'chal', pid: p.id, n: c.n, need: c.need, x: r0(p.x), y: r0(p.y) });
  if (c.n >= c.need) { c.done = 1; sim.emit({ type: 'forge', ph: 'chalDone', text: c.text, x: r0(p.x), y: r0(p.y) }); }
}

// ------------------------------------------------------------------ per tick
export function updateForge(sim) {
  const T = sim.forge;
  if (!T || sim.predicting) return;
  T.t++;
  if (T.call && --T.call.t <= 0) T.call = null;
  const ps = here(sim);
  if (T.st === 'room') tickRoom(sim, T, ps);
  else if (T.st === 'clear') tickClear(sim, T, ps);
  else if (T.st === 'boss') tickBoss(sim, T, ps);
  tickSlag(sim, T, ps);
  for (const p of sim.players.values()) if (!p.dead && inForgeArea(p.x, p.y) && forgeRoomAt(p.x, p.y, 40) !== T.room) place(p, forgeEntry(T.room), T.party.indexOf(p.id) + 1);
}
function tickSlag(sim, T, ps) {
  const C = FORGE.slag;
  if (T.st === 'room' && T.wave > 0 && ps.length && --T.drip <= 0) { // slag drips: one on someone + more anywhere in the hall
    const R = FORGE_ROOMS[T.room];
    T.drip = FORGE.rooms[T.room].slag;
    const tgt = ps[Math.floor(sim.rng.next() * ps.length)], pts = [[tgt.x, tgt.y]];
    for (let i = 0; i < 1 + T.room; i++) { const a = sim.rng.next() * TAU, rr = Math.sqrt(sim.rng.next()) * (R.r - 60); pts.push([R.x + Math.cos(a) * rr, R.y + Math.sin(a) * rr]); }
    for (const [x, y] of pts) T.slag.push({ id: T.sid++, x: r0(x), y: r0(y), t: 0, d: C.d });
  }
  for (const c of T.slag) {
    if (++c.t !== c.d) continue;
    for (const p of ps) {
      if (Math.hypot(p.x - c.x, p.y - c.y) > C.r + p.r * 0.5) continue;
      if (damagePlayer(sim, p, 0, { x: c.x, y: c.y }, { pct: C.pct, by: 'dripping slag', kb: 160, stun: 8 }) && T.ch && T.ch.k === 'slag' && T.st === 'room') {
        T.ch.n++;
        if (T.ch.done && T.ch.n > T.ch.need) { T.ch.done = 0; sim.emit({ type: 'forge', ph: 'chalFail', text: T.ch.text, x: r0(p.x), y: r0(p.y) }); }
      }
    }
    sim.emit({ type: 'forge', ph: 'slag', x: c.x, y: c.y });
  }
  T.slag = T.slag.filter((c) => c.t < c.d + 10);
}
function tickRoom(sim, T, ps) {
  const R = FORGE_ROOMS[T.room];
  T.alive = T.alive.filter((id) => { const e = sim.enemyById.get(id); return e && !e.dead; });
  if (T.pend) { if (--T.pend.t <= 0) { for (const s of T.pend.list) spawnWaveEnemy(sim, T, s); T.pend = null; } return; }
  if (T.alive.length) return;
  if (T.wave >= T.nw) { roomClear(sim, T); return; }
  if (!ps.length) return;
  if (--T.gap > 0) return;
  const wave = FORGE.rooms[T.room].waves[T.wave].slice();
  const n = Math.max(1, ps.length), extra = Math.floor((n - 1) / 2);
  for (let i = 0; i < extra; i++) wave.push(wave[i % wave.length].replace('!', ''));
  const list = wave.map((k, i) => {
    const a = -Math.PI / 2 + (i / wave.length) * TAU + T.wave * 0.5, rr = R.r * 0.72;
    return { type: k.replace('!', ''), elite: k.endsWith('!') || sim.rng.next() < FORGE.elite, x: r0(R.x + Math.cos(a) * rr), y: r0(R.y + Math.sin(a) * rr) };
  });
  T.wave++;
  T.pend = { t: FORGE.rise, list };
  sim.emit({ type: 'forge', ph: 'wave', room: T.room, wave: T.wave, nw: T.nw, pts: list.map((s) => [s.x, s.y, s.elite ? 1 : 0]), x: r0(R.x), y: r0(R.y) });
  T.gap = FORGE.waveGap;
}
function spawnWaveEnemy(sim, T, s) {
  const R = FORGE_ROOMS[T.room];
  const e = spawnEnemy(sim, s.type, s.x, s.y, { elite: s.elite, mul: FORGE.mul, tier: FORGE.tier, wave: true });
  e.forgeWave = 1; e.homeX = R.x; e.homeY = R.y; e.cd = 30 + Math.floor(sim.rng.next() * 40);
  const t = here(sim)[0]; if (t) e.aggroId = t.id;
  T.alive.push(e.id);
}
function roomClear(sim, T) {
  const R = FORGE_ROOMS[T.room];
  T.st = 'clear'; T.door = true; T.slag = [];
  if (T.ch && T.ch.done) T.chest = { x: r0(R.x), y: r0(R.y - 40), open: 0 };
  call(sim, 'HALL CLEARED', T.chest ? 'The smith\'s strongbox unlocks for you · then take the forge-door north' : 'The forge-door opens to the north', '#ffd08a', 170);
  sim.emit({ type: 'forge', ph: 'roomClear', room: T.room, chest: T.chest ? 1 : 0, x: r0(R.x), y: r0(R.y) });
}
function tickClear(sim, T, ps) {
  if (T.chest && !T.chest.open) for (const p of ps) if (Math.hypot(p.x - T.chest.x, p.y - T.chest.y) < FORGE.chestR) { openChest(sim, T); break; }
  const D = forgeDoor(T.room);
  for (const p of ps) if (Math.hypot(p.x - D.x, p.y - D.y) < FORGE.doorR) { nextRoom(sim, T); return; }
}
function openChest(sim, T) {
  T.chest.open = 1; T.chests++;
  for (const id of T.party) {
    const p = sim.players.get(id);
    if (!p) continue;
    const items = withLootLevel(p.level, () => [0, 1].map(() => generateItem(sim.rng, { tier: 6, cls: p.cls, rarity: sim.rng.next() < 0.35 ? 3 : 2 })));
    const bag = { id: sim.id(), x: T.chest.x + (sim.rng.next() - 0.5) * 40, y: T.chest.y + 34, items, ownerId: p.id, life: secs(120), rarity: Math.max(...items.map((i) => i.rarity)) };
    sim.bags.push(bag);
    sim.emit({ type: 'loot', x: bag.x, y: bag.y, rarity: bag.rarity, pid: p.id });
  }
  sim.emit({ type: 'forge', ph: 'chest', x: T.chest.x, y: T.chest.y });
}
function nextRoom(sim, T) {
  T.room++; T.chest = null; T.door = false; T.slag = [];
  const ps = [...sim.players.values()];
  if (T.room >= 3) { startBoss(sim, T); ps.forEach((p, i) => { if (!p.dead) place(p, forgeEntry(3), i); }); }
  else {
    T.st = 'room'; T.wave = 0; T.nw = FORGE.rooms[T.room].waves.length; T.gap = secs(2.2); T.alive = []; T.drip = 90;
    setChallenge(sim);
    ps.forEach((p, i) => { if (!p.dead) place(p, forgeEntry(T.room), i); });
    call(sim, FORGE_ROOMS[T.room].name.toUpperCase(), `Hall ${T.room + 1} of 3 · Challenge: ${T.ch.text}`, '#ffb36a', 180);
  }
  sim.emit({ type: 'forge', ph: 'room', room: T.room, x: r0(FORGE_ROOMS[T.room].x), y: r0(FORGE_ROOMS[T.room].y) });
}

// ------------------------------------------------------------------ the foundry floor
const W = NC * FT;
const mod = (a, m) => ((a % m) + m) % m;
export const laneDir = (j) => (j % 2 ? -1 : 1);
/** the mould cell under (x, y) for a pour tele t given the current belt offsets: true = safe hollow */
export function moldSafe(t, off, x, y) {
  const c = cellAt(x, y); if (!c) return false;
  const rows = MOLDS[t.mold]; if (!rows) return false; // (MASTERWORK: no mould at all)
  const j = c[1], shift = (off[j] || 0) - (t.o0[j] || 0), u = x - (FOUNDRY.x - FHW) - shift - t.s0 * FT, col = Math.floor(mod(u, W) / FT);
  return rows[j][col] === '#';
}
/** the column a lane's crucible mouth is at (the belt's far end), given its signed speed */
export const mouthCol = (v, shrink = 0) => (v >= 0 ? NC - 1 - shrink : shrink);

// ------------------------------------------------------------------ Hephast, the Cinder Smith
function startBoss(sim, T, attempts = 0) {
  const B = FORGE.boss, R = FOUNDRY;
  for (const e of sim.enemies) if (!e.dead && (e.type === 'hephast' || (e.forgeWave && inForgeArea(e.x, e.y)))) e.dead = true;
  const b = spawnEnemy(sim, 'hephast', R.x, R.y - FHH + 70);
  b.cd = 1e6; b.raidHold = 1e6; b.face = Math.PI / 2; b.dropChance = 1; b.invuln = B.pull; b.homeX = b.x; b.homeY = b.y;
  T.st = 'boss'; FORGE_STATE.shrink = 0;
  T.b = { st: 'pull', at: 0, pull: B.pull, bid: b.id, phase: 1, tele: [], tid: 1, script: [], cyc: 0, shrink: 0, enr: B.enrage, enraged: false, attempts, empty: 0, t: 0, won: false, hits: {}, flaw: 0, pours: 0, clean: 0,
    v: Array.from({ length: NL }, (_, j) => laneDir(j) * B.belt[1]), off: Array(NL).fill(0), rev: 1, bk: 1, bellT: 0, emb: 0 };
  call(sim, 'HEPHAST, THE CINDER SMITH', attempts ? `Attempt ${attempts + 1} · the line is restarted` : 'His foundry never stops. Neither will you.', '#ffc07a', B.pull);
  sim.emit({ type: 'forge', ph: 'bossPull', x: r0(b.x), y: r0(b.y), t: B.pull });
}
const CYCLE = {
  1: [[50, 'pour'], [240, 'sparks'], [300, 'stamp'], [440, 'tongs'], [560, 'pour'], [760, 'bellows'], [1000, 'sparks'], [1060, null]],
  2: [[40, 'pour'], [220, 'stamp'], [330, 'bellows'], [470, 'sparks'], [520, 'pour'], [700, 'tongs'], [800, 'stamp'], [940, null]],
  3: [[40, 'pour'], [200, 'stamp'], [300, 'tongs'], [400, 'pour'], [560, 'bellows'], [640, 'sparks'], [700, 'pour'], [880, null]],
};
function startCycle(Bd) { Bd.at = 0; Bd.cyc++; Bd.script = CYCLE[Bd.phase].map(([at, k]) => ({ at, k })); }
function setBelts(Bd) { const B = FORGE.boss; for (let j = 0; j < NL; j++) Bd.v[j] = laneDir(j) * Bd.rev * B.belt[Bd.phase] * Bd.bk; }
function tickBoss(sim, T, ps) {
  const Bd = T.b, B = FORGE.boss, b = bossOf(sim), R = FOUNDRY;
  if (Bd.st === 'victory') {
    const ex = forgeDoor(3);
    if (Bd.at > 180) for (const p of ps) if (Math.hypot(p.x - ex.x, p.y - ex.y) < 46) { if (sim.hub) T.over = 1; else { for (const q of sim.players.values()) if (inForgeArea(q.x, q.y)) place(q, EMBER_SPAWN); endForge(sim, null); } return; }
    Bd.at++;
    return;
  }
  if (Bd.st === 'wipe') { if (++Bd.at >= secs(4)) { startBoss(sim, T, Bd.attempts + 1); [...sim.players.values()].forEach((p, i) => { if (p.dead) { p.dead = false; p.hp = p.stats.maxHp; p.respawnAt = 0; } place(p, forgeEntry(3), i); }); } return; }
  if (Bd.won || !b || b.dead) { bossVictory(sim, T); return; }
  if (!ps.length) { if (++Bd.empty > 60) wipeBoss(sim, T, b); return; }
  Bd.empty = 0;
  if (b.hitstop > 10) b.hitstop = 10;
  if (Bd.st === 'pull') {
    if (--Bd.pull <= 0) {
      Bd.st = 'fight'; Bd.n = ps.length;
      const hp = Math.round(B.hp * encHpA(sim, 'forge') * (1 + B.partyHp * (Bd.n - 1))); b.maxHp = b.hp = b.baseMaxHp = hp; // (game loop C2: the band it sits in now, sim/levelscale.js)
      b.invuln = 0; startCycle(Bd);
      sim.emit({ type: 'forge', ph: 'bossStart', x: r0(b.x), y: r0(b.y), n: Bd.n, hp });
    }
    return;
  }
  Bd.t++;
  FORGE_STATE.shrink = Bd.shrink;
  b.x = b.homeX; b.y = b.homeY; // (the smith stands at his anvil)
  // the belts run: offsets advance, everyone on a belt is carried along
  for (let j = 0; j < NL; j++) Bd.off[j] = mod(Bd.off[j] + Bd.v[j], W * 64);
  for (const p of ps) { const c = cellAt(p.x, p.y); if (c) p.x += Bd.v[c[1]]; }
  for (const e of sim.enemies) if (!e.dead && !e.boss && e.forgeWave) { const c = cellAt(e.x, e.y); if (c) e.x += Bd.v[c[1]]; }
  // the crucible mouths at the belts' far ends burn
  if (Bd.t % B.mouth.every === 0) for (const p of ps) { const c = cellAt(p.x, p.y); if (c && (c[0] === mouthCol(Bd.v[c[1]], Bd.shrink) || c[0] < Bd.shrink || c[0] >= NC - Bd.shrink)) hit(sim, Bd, p, B.mouth.pct, 'crucible', null); }
  if (Bd.enr > 0 && --Bd.enr === 0) { Bd.enraged = true; call(sim, 'MASTERWORK', 'He pours with no mould now, again and again', '#ff3b3b', 240); sim.emit({ type: 'forge', ph: 'enrage', x: r0(b.x), y: r0(b.y) }); }
  if (Bd.enraged && Bd.t % B.enrageEvery === 0) tele(Bd, { k: 'pour', sh: 'mold', mold: 'none', s0: 0, o0: Bd.off.slice(), d: B.mate.d, pct: B.mate.pct, what: 'Masterwork' });
  // phase gates
  const pct = b.hp / b.maxHp, want = pct > 0.66 ? 1 : pct > 0.33 ? 2 : 3;
  if (want > Bd.phase) {
    Bd.phase = want; b.phase = want; b.invuln = 0; b.takeMul = 1; Bd.flaw = 0; Bd.bk = 1; Bd.bellT = 0;
    for (const t of Bd.tele) t.cancel = 1;
    Bd.tele = Bd.tele.filter((t) => t.done);
    if (want === 2) { spawnAdd(sim, 'construct'); spawnAdd(sim, 'construct'); spawnAdd(sim, 'thrall'); call(sim, 'THE LINE SPEEDS UP', 'Phase 2 · Slag Constructs ride the belts · the belts run faster', '#ffc07a', 170); }
    else { Bd.shrink = 1; spawnAdd(sim, 'construct'); spawnAdd(sim, 'thrall'); call(sim, 'THE CRUCIBLE RISES', 'Phase 3 · the outer columns melt · the pours come faster', '#ff8a4a', 170); sim.emit({ type: 'forge', ph: 'shrink', x: r0(R.x), y: r0(R.y) }); }
    setBelts(Bd);
    sim.emit({ type: 'forge', ph: 'phase', phase: want, x: r0(b.x), y: r0(b.y) });
    sim.emit({ type: 'bossPhase', phase: want, x: b.x, y: b.y, id: b.id, raid: true });
    startCycle(Bd);
  }
  if (Bd.bellT > 0 && --Bd.bellT === 0) { Bd.bk = 1; Bd.rev *= -1; setBelts(Bd); sim.emit({ type: 'forge', ph: 'bellowsEnd', x: r0(R.x), y: r0(R.y) }); } // (the bellows die down: the belts settle back)
  if (Bd.bellT > 0 && Bd.bellT % 30 === 0) for (let j = 0; j < NL; j++) { if ((j + Bd.cyc) % 2) continue; const v = Bd.v[j], c = cellCentre(v > 0 ? 0 : NC - 1, j); spawnProjectile(sim, { team: 'enemy', ownerId: b.id, x: c.x - Math.sign(v) * 40, y: c.y, vx: Math.sign(v) * 280, vy: 0, r: 11, life: Math.round(W / 280 * 60) + 10, dmg: b.dmg * 0.7, style: 'ember', kb: 90, by: 'a bellows ember' }); }
  if (Bd.flaw > 0) { Bd.flaw--; b.takeMul = B.flaw.mul; if (Bd.flaw === 0) b.takeMul = 1; }
  Bd.at++;
  for (const s of Bd.script) if (!s.done && Bd.at >= s.at) { s.done = true; if (s.k) runMech(sim, Bd, b, s, ps); else startCycle(Bd); }
  tickTele(sim, Bd, ps, b);
}
function tele(Bd, spec) { const t = { id: Bd.tid++, t: 0, ...spec }; Bd.tele.push(t); return t; }
function runMech(sim, Bd, b, s, ps) {
  const B = FORGE.boss, R = FOUNDRY;
  if (s.k === 'pour') {
    const mold = MOLD_KEYS[Math.floor(sim.rng.next() * MOLD_KEYS.length)], s0 = Math.floor(sim.rng.next() * NC);
    tele(Bd, { k: 'pour', sh: 'mold', mold, s0, o0: Bd.off.slice(), d: B.pour.d[Bd.phase], pct: B.pour.pct, stun: B.pour.stun, what: 'Casting Pour', pour: 1 });
    call(sim, 'CASTING POUR · ' + mold.toUpperCase(), 'Stand in the mould · it rides the belts and shears apart', '#ffd08a', 120);
    sim.emit({ type: 'forge', ph: 'cast', k: 'pour', mold, x: r0(b.x), y: r0(b.y) });
  } else if (s.k === 'stamp') {
    const ltr = sim.rng.next() < 0.5, pairs = NC / 2;
    for (let k = 0; k < pairs; k++) { const i0 = (ltr ? k : pairs - 1 - k) * 2; tele(Bd, { k: 'stamp', sh: 'cols', c: [i0, i0 + 1], d: B.stamp.d + k * B.stamp.gap, pct: B.stamp.pct, stun: 12, what: 'Drop Hammer' }); }
    call(sim, 'DROP HAMMERS', 'The presses march across the floor · time your lane', '#ffc07a', 110);
    sim.emit({ type: 'forge', ph: 'cast', k: 'stamp', x: r0(b.x), y: r0(b.y) });
  } else if (s.k === 'tongs') {
    let far = null, fd = -1; for (const p of ps) { const d = Math.hypot(p.x - b.x, p.y - b.y); if (d > fd) { fd = d; far = p; } }
    if (!far) return;
    tele(Bd, { k: 'tongs', sh: 'circle', pid: far.id, x: r0(far.x), y: r0(far.y), r: 40, d: B.tongs.mark, pct: 0, follow: 1, what: 'the Tongs', mark: 1 });
    call(sim, 'THE TONGS', 'He grabs the furthest hero and drops them in a crucible mouth · get off it', '#ffc07a', 110);
  } else if (s.k === 'bellows') {
    tele(Bd, { k: 'bellows', sh: 'none', d: B.bellows.warn, pct: 0, what: 'the Bellows' });
    call(sim, 'THE BELLOWS', 'Every belt reverses and runs double · embers race down the lanes', '#ffb36a', 110);
    sim.emit({ type: 'forge', ph: 'cast', k: 'bellows', x: r0(b.x), y: r0(b.y) });
  } else if (s.k === 'sparks') {
    let tgt = ps[0]; for (const p of ps) if (Math.hypot(p.x - b.x, p.y - b.y) < Math.hypot(tgt.x - b.x, tgt.y - b.y)) tgt = p;
    for (let w = 0; w < 3; w++) { const a0 = Math.atan2(tgt.y - b.y, tgt.x - b.x) + (w - 1) * 0.12; for (let i = 0; i < 5; i++) { const a = a0 + (i - 2) * 0.2; spawnProjectile(sim, { team: 'enemy', ownerId: b.id, x: b.x, y: b.y, vx: Math.cos(a) * (240 + w * 30), vy: Math.sin(a) * (240 + w * 30), r: 10, life: 160, dmg: b.dmg * 0.65, style: 'ember', kb: 80, by: b.name }); } }
  }
}
function spawnAdd(sim, type) {
  const j = Math.floor(sim.rng.next() * NL), i = 2 + Math.floor(sim.rng.next() * (NC - 4)), c = cellCentre(i, j);
  const e = spawnEnemy(sim, type, c.x, c.y, { mul: 1.6, tier: 6, zoneHp: false }); // (boss mechanic adds)
  e.forgeWave = 1; e.dropChance = 0.1; e.homeX = FOUNDRY.x; e.homeY = FOUNDRY.y;
  sim.emit({ type: 'teleport', x: c.x, y: c.y, id: e.id });
}
/** Is p caught by telegraph t? */
export function forgeTeleHits(t, p, off) {
  switch (t.sh) {
    case 'circle': return Math.hypot(p.x - t.x, p.y - t.y) < t.r + (p.r || 16) * 0.5;
    case 'cols': { const c = cellAt(p.x, p.y); return !!c && t.c.includes(c[0]); }
    case 'mold': return !moldSafe(t, off, p.x, p.y);
    default: return false;
  }
}
function tickTele(sim, Bd, ps, b) {
  const B = FORGE.boss;
  for (const t of Bd.tele) {
    t.t++;
    if (t.follow && t.t < t.d - 16) { const p = sim.players.get(t.pid); if (p && !p.dead) { t.x = r0(p.x); t.y = r0(p.y); } }
    if (t.t === t.d && !t.done && !t.cancel) {
      t.done = true; sim.posCheck = posTele(t) ? 1 : 0;
      if (t.k === 'tongs') { const p = sim.players.get(t.pid); if (p && !p.dead) { const j = Math.floor(sim.rng.next() * NL), c = cellCentre(mouthCol(Bd.v[j], Bd.shrink), j); place(p, c); p.iframes = 0; sim.emit({ type: 'forge', ph: 'tongs', pid: p.id, x: r0(c.x), y: r0(c.y), bx: r0(b.x), by: r0(b.y) }); } continue; }
      if (t.k === 'bellows') { Bd.rev *= -1; Bd.bk = B.bellows.k; Bd.bellT = B.bellows.dur; setBelts(Bd); sim.emit({ type: 'forge', ph: 'bellows', x: r0(FOUNDRY.x), y: r0(FOUNDRY.y) }); continue; }
      let clean = true;
      for (const p of ps) { if (!forgeTeleHits(t, p, Bd.off)) continue; if (hit(sim, Bd, p, t.pct, t.what, t.sh === 'circle' ? { x: t.x, y: t.y } : null, t.stun)) clean = false; }
      if (t.pour) {
        Bd.pours++;
        if (clean) { Bd.clean++; Bd.flaw = B.flaw.t; b.takeMul = B.flaw.mul; b.cc.stun = Math.max(b.cc.stun, B.flaw.t); call(sim, 'FLAWLESS CAST!', 'Not a drop wasted · Hephast\'s apron cracks (+50% damage)', '#7dffb0', 120); sim.emit({ type: 'forge', ph: 'flawless', x: r0(b.x), y: r0(b.y) }); }
      }
      sim.emit({ type: 'forge', ph: 'boom', k: t.k, sh: t.sh, c: t.sh === 'cols' ? t.c : undefined, x: r0(t.x ?? FOUNDRY.x), y: r0(t.y ?? FOUNDRY.y), r: t.r, mold: t.mold });
    }
  }
  Bd.tele = Bd.tele.filter((t) => !t.cancel && (!t.done || t.t < t.d + 40));
  sim.posCheck = 0;
}
function hit(sim, Bd, p, pct, what, src, stun = 0) {
  const ok = damagePlayer(sim, p, 0, src, { pct, raw: what === 'Masterwork', by: `Hephast's ${what}`, kb: src ? 240 : 0, stun });
  if (ok) { Bd.hits[what] = (Bd.hits[what] || 0) + 1; sim.emit({ type: 'forge', ph: 'hit', pid: p.id, what, x: r0(p.x), y: r0(p.y) }); }
  return ok;
}
function wipeBoss(sim, T, b) {
  const Bd = T.b;
  Bd.st = 'wipe'; Bd.at = 0; Bd.tele = [];
  if (b) { b.dead = true; b.hp = 0; }
  for (const e of sim.enemies) if (!e.dead && e.forgeWave && inForgeArea(e.x, e.y)) { e.dead = true; e.hp = 0; }
  for (const pr of sim.projectiles) if (inForgeArea(pr.x, pr.y)) pr.dead = true;
  call(sim, 'THE LINE STOPS', 'Hephast restarts the foundry · your run is kept', '#ff8a7a', secs(4));
  sim.emit({ type: 'forge', ph: 'wipe', x: r0(FOUNDRY.x), y: r0(FOUNDRY.y), attempts: Bd.attempts + 1 });
}
function bossVictory(sim, T) {
  const Bd = T.b, R = FOUNDRY;
  Bd.st = 'victory'; Bd.at = 0; Bd.tele = []; Bd.shrink = 0; FORGE_STATE.shrink = 0; Bd.v = Bd.v.map(() => 0);
  for (const e of sim.enemies) if (!e.dead && e.forgeWave && inForgeArea(e.x, e.y)) { e.dead = true; e.hp = 0; }
  const secsT = Math.round(T.t / 60);
  call(sim, 'THE FORGE GOES COLD', `Forge cleared in ${Math.floor(secsT / 60)}:${String(secsT % 60).padStart(2, '0')} · ${sim.hub ? 'the forge-door leads home' : 'the forge-door leads back to the outpost'}`, '#ffd08a', 360);
  for (const id of T.party) {
    const p = sim.players.get(id);
    if (!p) continue;
    p.unlocks = p.unlocks || {};
    const items = withLootLevel(p.level, () => [generateItem(sim.rng, { tier: 6, cls: p.cls, rarity: 3 }), generateItem(sim.rng, { tier: 6, cls: p.cls, rarity: sim.rng.next() < 0.5 ? 3 : 2 })]);
    const bag = { id: sim.id(), x: R.x + (sim.rng.next() - 0.5) * 60, y: R.y + 30, items, ownerId: p.id, life: secs(180), rarity: Math.max(...items.map((i) => i.rarity)) };
    sim.bags.push(bag);
    sim.emit({ type: 'loot', x: bag.x, y: bag.y, rarity: bag.rarity, pid: p.id });
    const fresh = !p.unlocks.forge; p.unlocks.forge = 1; sim.emit({ type: 'unlock', pid: p.id, key: 'forge', fresh: fresh ? 1 : 0, x: r0(R.x), y: r0(R.y) });
  }
  sim.emit({ type: 'forge', ph: 'victory', x: r0(R.x), y: r0(R.y), t: secsT, attempts: Bd.attempts, pours: Bd.pours, clean: Bd.clean });
}

/** Compact copy for co-op snapshots (the renderer reads the same shape from a local sim). */
export function packForge(sim) {
  const T = sim.forge;
  if (!T) return null;
  const Bd = T.b;
  return {
    st: T.st, room: T.room, wave: T.wave, nw: T.nw, ch: T.ch, chest: T.chest, door: T.door, call: T.call, t: T.t,
    pend: T.pend ? { t: T.pend.t, pts: T.pend.list.map((s) => [s.x, s.y, s.elite ? 1 : 0]) } : null,
    sl: T.slag.map((c) => [c.x, c.y, c.t, c.d]),
    b: Bd ? { st: Bd.st, phase: Bd.phase, at: Bd.at, pull: Bd.pull, enr: Bd.enr, enraged: Bd.enraged, attempts: Bd.attempts, bid: Bd.bid, shrink: Bd.shrink, flaw: Bd.flaw, bellT: Bd.bellT,
      v: Bd.v.map((x) => Math.round(x * 100) / 100), off: Bd.off.map((x) => Math.round(x * 10) / 10),
      tele: Bd.tele.map((t) => ({ id: t.id, k: t.k, sh: t.sh, x: t.x, y: t.y, r: t.r, c: t.c, d: t.d, t: t.t, mold: t.mold, s0: t.s0, o0: t.o0, done: t.done ? 1 : 0, pid: t.pid })) } : null,
  };
}
/** Test / dev hook: jump to a hall or the boss, set a phase, force a mechanic, kill the boss, clear a hall. */
export function devForge(sim, p, m) {
  if (!sim.forge) enterForge(sim, p);
  const T = sim.forge;
  if (m.room != null) { for (const id of T.alive) { const e = sim.enemyById.get(id); if (e) e.dead = true; } T.alive = []; T.pend = null; T.room = Math.max(0, Math.min(3, m.room)) - 1; nextRoom(sim, T); }
  if (m.phase && T.b) { const b = bossOf(sim); if (b) b.hp = b.maxHp * (m.phase === 3 ? 0.3 : 0.6); }
  if (m.mech && T.b && T.b.st === 'fight') { const b = bossOf(sim); if (b) runMech(sim, T.b, b, { k: m.mech }, here(sim)); }
  if (m.kill && T.b) { const b = bossOf(sim); if (b) { b.hp = 0; b.dead = true; T.b.won = true; } }
  if (m.clear && T.st === 'room') { for (const id of T.alive) { const e = sim.enemyById.get(id); if (e) e.dead = true; } T.alive = []; T.pend = null; T.wave = T.nw; }
}
