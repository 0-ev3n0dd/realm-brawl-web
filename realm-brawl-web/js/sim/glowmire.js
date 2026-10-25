// The Wilds' boss content (Lv 12, before the Dunes):
//   THE GLOWMIRE HOLLOW (dungeon): 3 wave grottoes (Wilds mobs + Hollow natives; SPORE PODS rain down, more each grotto; each
//   grotto has a challenge: meet it and a glowcap chest opens) -> the Moonlit Bower -> LUMIVEX, THE MOTH MATRIARCH (~3-4 min):
//     LANTERN BLOOM : three spore rings burst in order, inside-out or outside-in (alternating; the call says which)
//     MOONBEAM      : a cross of light through her (+), then the diagonal cross (x)
//     WING GUST     : a wide cone at the nearest hero, with knockback
//     DUSK          : the Bower goes dark; only the lantern-flowers' light is safe when it falls
//     SPORE RAIN    : spore circles under every hero, three times (keep walking)
//     DUST TRAIL    : she dashes across the Bower along a lane, leaving burning dust behind
//     MOTHLINGS     : (phase 2+) Glowmoth adds
//     Phase 2 at 66% (mothlings), phase 3 at 33% (paired mechanics). Enrage: ECLIPSE (whole Bower, again and again).
//   VHAROK, THE STORMHORN (the Wilds Trial / Extreme, the Stormcrown Tor; ~5-7 min), a giant storm elk:
//     THUNDER CHARGE: he lowers his antlers and charges the furthest hero (a lane), ending where it ends
//     HOOF QUAKE    : three shock rings race out from his hooves (stand between them / step through)
//     LIGHTNING RODS: rods hammer into the Tor; they discharge round themselves and ARC to each other (don't stand between)
//     GALE          : the wind shoves everyone one way for 3 s; the downwind rim is a storm wall
//     HAILSTORM     : hail circles under every hero, three times
//     STAMPEDE      : (phase 2+) Stormcalf adds charge in
//     STORMFRONT    : (phase 3 aura) random lightning keeps striking
//     Extreme: tells x0.8, mechanics paired, and a phase 4 at 15%: EYE OF THE STORM (only the shrinking calm round him is
//     safe; he takes +50% damage). Enrage: SKYFALL.
// No invulnerability anywhere: the boss appears when the pull ends and is hittable the whole fight.
// A boss wipe resets only the boss (the dungeon run is kept / the Trial retries). Authoritative only; state in sim.glow
// (packed for co-op clients, drawn by client/glowfx.js).
import { lockedSeed } from './practice.js';
import { hits, posTele } from './telegraph.js';
import { withLootLevel, generateItem } from './loot.js';
import { encHpA, astralEnr } from './astral.js';
import { secs } from './constants.js';
import { HOLLOW_ROOMS, BOWER, TOR, hollowEntry, hollowDoor, inHollowArea, hollowRoomAt, roomOf } from './glowconst.js';
import { spawnEnemy } from './ai.js';
import { registerWaves } from './mobhp.js';
import { damagePlayer, evadeShove } from './combat.js';
import { inLine } from './math.js';

const TAU = Math.PI * 2;
const r0 = (v) => Math.round(v);
export const GLOW = {
  mul: 1.4, tier: 4, elite: 0.1, waveGap: secs(1.6), rise: 50, chestR: 52, doorR: 46,
  rooms: [
    { waves: [['mirecap', 'mirecap', 'goblin', 'goblin'], ['mothling', 'mothling', 'mirecap', 'thornhound'], ['thornhound', 'thornhound', 'mirecap', 'bogbrute!']],
      chal: { k: 'chains', need: 6, text: 'Land 6 chains' }, pod: 150 },
    { waves: [['mothling', 'mothling', 'mothling', 'wisp'], ['bogbrute', 'mirecap', 'mirecap', 'thornhound'], ['mothling!', 'thornhound', 'thornhound', 'wolf', 'wolf']],
      chal: { k: 'pod', need: 2, text: 'Take at most 2 spore-pod hits' }, pod: 110 },
    { waves: [['bogbrute', 'thornhound', 'thornhound', 'mirecap', 'mirecap'], ['golem', 'mothling', 'mothling', 'mothling'], ['bogbrute!', 'mirecap!', 'thornhound', 'thornhound', 'mothling']],
      chal: { k: 'long3', need: 4, text: 'Land 4 chains of 3+ steps' }, pod: 90 },
  ],
  pod: { r: 70, d: 66, pct: 0.1 },
  party: [1, 1.9, 2.75, 3.6, 4.4, 5.2],
  bonus: { t: secs(4), mul: 1.25 },
};
registerWaves('hollow', GLOW.rooms);

// ------------------------------------------------------------------ the two fights
/** per fight: boss type(s), arena, HP (x the level band: levelscale ENC_LV), enrage, tell speed, phases (floor, rotation) */
import { makePool, gapOf, withTell, towers as mkTowers, marks as mkMarks, memory as mkMemory, combo as mkCombo, softEnrageT } from './mechpool.js';
import { soakCount } from './telegraph.js';
export const FIGHTS = {
  lumivex: {
    name: 'Lumivex, the Moth Matriarch', short: 'LUMIVEX', boss: 'lumivex', enc: 'hollow', arena: BOWER, col: '#d8ff9a', hp: 310000, enrage: secs(400), k: 1, lvl: 'none',
    pullText: 'The lanterns gutter. Something vast unfolds its wings.', enr: ['ECLIPSE', 'Her wings swallow the moon'],
    ph: [
      { floor: 0.66, name: 'Lantern Court', rot: ['bloom', 'beam', 'gust', 'dusk', 'spores', 'dash'] },
      { floor: 0.33, name: 'The Swarm Wakes', sub: 'Mothlings pour out of the moss', start: 'adds', rot: ['dash', 'beam', 'bloom', 'marks', 'dusk', 'gust', 'spores', 'adds'] },
      { floor: 0, name: 'Full Moon', sub: 'She burns brighter · everything comes in pairs', rot: ['bloom+beam', 'dusk', 'wings', 'dash+spores', 'gust', 'adds', 'beam+spores'] },
    ],
  },
  vharok: {
    name: 'Vharok, the Stormhorn (Trial)', short: 'VHAROK', boss: 'trvharok', enc: 'vht', arena: TOR, col: '#9fdcff', hp: 480000, enrage: secs(620), k: 1, lvl: 'light',
    pullText: 'Thunder rolls over the Tor. The Stormhorn lowers his crown of antlers.', enr: ['SKYFALL', 'The whole storm comes down'],
    ph: [
      { floor: 0.66, name: 'Gathering Storm', rot: ['charge', 'quake', 'hail', 'rods', 'charge', 'gale'] },
      { floor: 0.33, name: 'Stampede', sub: 'Stormcalves charge out of the rain', start: 'calves', rot: ['rods', 'charge', 'towers', 'quake', 'calves', 'gale', 'hail', 'charge'] },
      { floor: 0, name: 'Stormfront', sub: 'Lightning strikes at random · keep moving', aura: 'storm', rot: ['quake', 'rods', 'charge', 'gale', 'hail', 'calves', 'charge'] },
    ],
  },
  vharokx: {
    name: 'Vharok, the Stormhorn (Extreme)', short: 'VHAROK', boss: 'trvharokx', enc: 'vht', arena: TOR, col: '#c9a2ff', hp: 525000, enrage: secs(660), k: 0.8, ex: 1, lvl: 'full',
    pullText: 'The sky goes black over the Tor. He has been waiting for you.', enr: ['SKYFALL', 'The whole storm comes down'],
    ph: [
      { floor: 0.66, name: 'Gathering Storm', rot: ['charge+hail', 'quake', 'rods+charge', 'gale+hail'] },
      { floor: 0.33, name: 'Stampede', sub: 'Stormcalves charge out of the rain', start: 'calves', rot: ['rods+quake', 'charge', 'towers', 'calves+gale', 'hail+charge'] },
      { floor: 0.15, name: 'Stormfront', sub: 'Lightning strikes at random · keep moving', aura: 'storm', rot: ['quake+rods', 'memory', 'charge+hail', 'gale+calves', 'charge'] },
      { floor: 0, name: 'Eye of the Storm', sub: 'Only the calm round him is safe · he takes +50% damage', aura: 'eye', rot: ['hail', 'charge', 'quake'] },
    ],
  },
};
/** hub mission id -> fight */
export const GLOW_MISSIONS = { hollow: 'lumivex', vharokt: 'vharok', vharokx: 'vharokx' };
/** how long each mechanic occupies the rotation (ticks at k = 1) and the damage (% max HP) */
const DUR = { bloom: 200, beam: 170, gust: 120, dusk: 220, spores: 150, dash: 160, adds: 100, charge: 150, quake: 170, rods: 220, gale: 230, hail: 150, calves: 100, marks: 170, wings: 210, towers: 190, memory: 330 };
const PCT = { bloom: 0.22, beam: 0.26, gust: 0.2, dusk: 0.4, spores: 0.16, dash: 0.25, lane: 0.05, eclipse: 0.5, charge: 0.3, quake: 0.24, rod: 0.28, arc: 0.24, wall: 0.08, hail: 0.18, storm: 0.15, eye: 0.06, skyfall: 0.55, spread: 0.12, spreadx: 0.3, stack: 0.1, stackx: 0.4, tower: 0.08, towerx: 0.18, wings: 0.26, mem: 0.3, burst: 0.12 };
const TXT = {
  bloom: ['LANTERN BLOOM', ''], beam: ['MOONBEAM', 'A cross of light (+), then the diagonals (x)'], gust: ['WING GUST', 'A great cone of wind at the nearest hero'],
  dusk: ['DUSK', 'Get into a lantern-flower\'s light before it falls dark'], spores: ['SPORE RAIN', 'Spores under you, three times · keep walking'],
  dash: ['DUST TRAIL', 'She dashes across the Bower · the lane burns'], adds: ['MOTHLINGS', 'Glowmoths pour out of the moss · kill them'],
  charge: ['THUNDER CHARGE', 'He charges the furthest hero · get out of the lane'], quake: ['HOOF QUAKE', 'Three shock rings race outward · step between them'],
  rods: ['LIGHTNING RODS', 'Rods discharge round themselves and arc to each other · stand clear'], gale: ['GALE', 'The wind shoves you · fight it, the downwind rim is a storm wall'],
  hail: ['HAILSTORM', 'Hail under you, three times · keep walking'], calves: ['STAMPEDE', 'Stormcalves charge in · kill them'],
  marks: ['MOTH MARKS', ''], wings: ['WINGBEAT', 'Front, then behind · read the first wing'], towers: ['STORM TOWERS', 'One hero in each tower · an empty tower blasts everyone'],
  memory: ['STORM MEMORY', 'Watch the order the quarters light · then dodge them in that order'],
};

// ------------------------------------------------------------------ helpers
const isTor = (G) => G && G.f !== 'lumivex';
const arenaOf = (G) => (isTor(G) ? TOR : BOWER);
const roomIdx = (G) => (isTor(G) ? 4 : G.room);
const inRoom = (p, i, pad = 30) => { const R = roomOf(i); return Math.hypot(p.x - R.x, p.y - R.y) < R.r + pad; };
const here = (sim) => [...sim.players.values()].filter((p) => !p.dead && sim.glow && inRoom(p, roomIdx(sim.glow)));
const bossOf = (sim) => sim.glow && sim.glow.b && sim.enemyById.get(sim.glow.b.bid);
function place(p, s, k = 0) { const o = ((k % 5) - 2) * 30; p.x = p.px = s.x + o; p.y = p.py = s.y + Math.floor(k / 5) * 26; p.vx = p.vy = 0; p.iframes = Math.max(p.iframes || 0, 60); p.action = null; }
function call(sim, txt, sub, col, t = 150) { const G = sim.glow, R = roomOf(roomIdx(G)); G.call = { txt, sub: sub || '', col: col || '#fff', t, d: t }; sim.emit({ type: 'glow', ph: 'call', txt, sub: sub || '', col: col || '#fff', x: r0(R.x), y: r0(R.y) }); }
const fightOf = (G) => FIGHTS[G.f];

// ------------------------------------------------------------------ entry / exit
/** enter the Hollow (f = 'lumivex') or the Tor (f = 'vharok' | 'vharokx') */
export function enterGlow(sim, p, f = 'lumivex') {
  if (sim.predicting || !p) return false;
  if (p.dead) { p.dead = false; p.hp = p.stats.maxHp; p.respawnAt = 0; }
  if (!sim.glow || sim.glow.f !== f || sim.glow.st === 'done') startGlow(sim, f);
  const G = sim.glow;
  if (!G.party.includes(p.id)) G.party.push(p.id);
  place(p, hollowEntry(roomIdx(G)), G.party.indexOf(p.id));
  sim.emit({ type: 'glow', ph: 'enter', pid: p.id, x: r0(p.x), y: r0(p.y), room: roomIdx(G), f });
  return true;
}
export function startGlow(sim, f = 'lumivex') {
  endGlow(sim, null);
  sim.glow = { f, st: 'room', room: 0, wave: 0, nw: GLOW.rooms[0].waves.length, alive: [], gap: secs(2.5), pend: null, ch: null, chest: null, door: false, b: null, party: [], call: null, t: 0, podT: 60, pods: [], pid: 1, chests: 0, over: 0 };
  const G = sim.glow;
  if (f !== 'lumivex') { G.room = 3; startBoss(sim, G); return; }
  setChallenge(sim);
  call(sim, 'THE GLOWMIRE HOLLOW', HOLLOW_ROOMS[0].name + ' · ' + GLOW.rooms[0].chal.text + ' for a glowcap chest', '#d8ff9a', 200);
  sim.emit({ type: 'glow', ph: 'start', x: r0(HOLLOW_ROOMS[0].x), y: r0(HOLLOW_ROOMS[0].y) });
}
export function endGlow(sim, why = 'quit') {
  for (const e of sim.enemies) if (!e.dead && (e.glowWave || FIGHT_BOSSES.has(e.type)) && inHollowArea(e.x, e.y)) { e.dead = true; e.hp = 0; }
  for (const pr of sim.projectiles) if (inHollowArea(pr.x, pr.y)) pr.dead = true;
  for (const a of sim.areas) if (inHollowArea(a.x, a.y)) a.dead = true;
  if (sim.glow && why) sim.emit({ type: 'glow', ph: 'end', why, x: r0(HOLLOW_ROOMS[0].x), y: r0(HOLLOW_ROOMS[0].y) });
  sim.glow = null;
}
const FIGHT_BOSSES = new Set(['lumivex', 'trvharok', 'trvharokx']);
export function glowSpot(sim) { return sim.glow ? hollowEntry(roomIdx(sim.glow)) : hollowEntry(0); }

function setChallenge(sim) {
  const G = sim.glow, c = GLOW.rooms[G.room] && GLOW.rooms[G.room].chal;
  if (!c) { G.ch = null; return; }
  const n = Math.max(1, G.party.length || sim.players.size);
  G.ch = c.k === 'pod' ? { k: c.k, n: 0, need: c.need + (n - 1) * 2, text: c.text, done: 1 } : { k: c.k, n: 0, need: c.need + Math.floor((n - 1) * c.need * 0.5), text: c.text, done: 0 };
}
/** dunes.js chainHooks: a chain landed */
export function glowChain(sim, p, steps) {
  const G = sim.glow;
  if (!G || G.st !== 'room' || !G.ch || G.ch.k === 'pod' || G.ch.done || !inRoom(p, G.room)) return;
  const c = G.ch; if (!(c.k === 'chains' || (c.k === 'long3' && steps >= 3))) return;
  c.n++;
  sim.emit({ type: 'glow', ph: 'chal', pid: p.id, n: c.n, need: c.need, x: r0(p.x), y: r0(p.y) });
  if (c.n >= c.need) { c.done = 1; sim.emit({ type: 'glow', ph: 'chalDone', text: c.text, x: r0(p.x), y: r0(p.y) }); }
}

// ------------------------------------------------------------------ per tick
export function updateGlow(sim) {
  const G = sim.glow;
  if (!G || sim.predicting) return;
  G.t++;
  if (G.call && --G.call.t <= 0) G.call = null;
  const ps = here(sim);
  if (G.st === 'room') tickRoom(sim, G, ps);
  else if (G.st === 'clear') tickClear(sim, G, ps);
  else if (G.st === 'boss') tickBoss(sim, G, ps);
  tickPods(sim, G, ps);
  const ri = roomIdx(G);
  for (const p of sim.players.values()) if (!p.dead && inHollowArea(p.x, p.y) && hollowRoomAt(p.x, p.y, 40) !== ri) place(p, hollowEntry(ri), G.party.indexOf(p.id) + 1);
}
function tickPods(sim, G, ps) {
  const C = GLOW.pod;
  if (G.st === 'room' && G.wave > 0 && ps.length && --G.podT <= 0) {
    const R = HOLLOW_ROOMS[G.room];
    G.podT = GLOW.rooms[G.room].pod;
    const tgt = ps[Math.floor(sim.rng.next() * ps.length)], pts = [[tgt.x, tgt.y]];
    for (let i = 0; i < 1 + G.room; i++) { const a = sim.rng.next() * TAU, rr = Math.sqrt(sim.rng.next()) * (R.r - 60); pts.push([R.x + Math.cos(a) * rr, R.y + Math.sin(a) * rr]); }
    for (const [x, y] of pts) G.pods.push({ id: G.pid++, x: r0(x), y: r0(y), t: 0, d: C.d });
  }
  for (const c of G.pods) {
    if (++c.t !== c.d) continue;
    for (const p of ps) {
      if (Math.hypot(p.x - c.x, p.y - c.y) > C.r + p.r * 0.5) continue;
      if (damagePlayer(sim, p, 0, { x: c.x, y: c.y }, { pct: C.pct, by: 'a bursting spore pod', kb: 140, stun: 6 }) && G.ch && G.ch.k === 'pod' && G.st === 'room') {
        G.ch.n++;
        if (G.ch.done && G.ch.n > G.ch.need) { G.ch.done = 0; sim.emit({ type: 'glow', ph: 'chalFail', text: G.ch.text, x: r0(p.x), y: r0(p.y) }); }
      }
    }
    sim.emit({ type: 'glow', ph: 'pod', x: c.x, y: c.y });
  }
  G.pods = G.pods.filter((c) => c.t < c.d + 10);
}
function tickRoom(sim, G, ps) {
  const R = HOLLOW_ROOMS[G.room];
  G.alive = G.alive.filter((id) => { const e = sim.enemyById.get(id); return e && !e.dead; });
  if (G.pend) { if (--G.pend.t <= 0) { for (const s of G.pend.list) spawnWaveEnemy(sim, G, s); G.pend = null; } return; }
  if (G.alive.length) return;
  if (G.wave >= G.nw) { roomClear(sim, G); return; }
  if (!ps.length) return;
  if (--G.gap > 0) return;
  const wave = GLOW.rooms[G.room].waves[G.wave].slice();
  const extra = Math.floor((Math.max(1, ps.length) - 1) / 2);
  for (let i = 0; i < extra; i++) wave.push(wave[i % wave.length].replace('!', ''));
  const list = wave.map((k, i) => {
    const a = -Math.PI / 2 + (i / wave.length) * TAU + G.wave * 0.5, rr = R.r * 0.72;
    return { type: k.replace('!', ''), elite: k.endsWith('!') || sim.rng.next() < GLOW.elite, x: r0(R.x + Math.cos(a) * rr), y: r0(R.y + Math.sin(a) * rr) };
  });
  G.wave++;
  G.pend = { t: GLOW.rise, list };
  sim.emit({ type: 'glow', ph: 'wave', room: G.room, wave: G.wave, nw: G.nw, pts: list.map((s) => [s.x, s.y, s.elite ? 1 : 0]), x: r0(R.x), y: r0(R.y) });
  G.gap = GLOW.waveGap;
}
function spawnWaveEnemy(sim, G, s) {
  const R = HOLLOW_ROOMS[G.room];
  const e = spawnEnemy(sim, s.type, s.x, s.y, { elite: s.elite, mul: GLOW.mul, tier: GLOW.tier, wave: true });
  e.glowWave = 1; e.homeX = R.x; e.homeY = R.y; e.cd = 30 + Math.floor(sim.rng.next() * 40);
  const t = here(sim)[0]; if (t) e.aggroId = t.id;
  G.alive.push(e.id);
}
function roomClear(sim, G) {
  const R = HOLLOW_ROOMS[G.room];
  G.st = 'clear'; G.door = true; G.pods = [];
  if (G.ch && G.ch.done) G.chest = { x: r0(R.x), y: r0(R.y - 40), open: 0 };
  call(sim, 'GROTTO CLEARED', G.chest ? 'A glowcap chest blooms open for you · then take the moss-door north' : 'The moss-door opens to the north', '#e8ffc0', 170);
  sim.emit({ type: 'glow', ph: 'roomClear', room: G.room, chest: G.chest ? 1 : 0, x: r0(R.x), y: r0(R.y) });
}
function tickClear(sim, G, ps) {
  if (G.chest && !G.chest.open) for (const p of ps) if (Math.hypot(p.x - G.chest.x, p.y - G.chest.y) < GLOW.chestR) { openChest(sim, G); break; }
  const D = hollowDoor(G.room);
  for (const p of ps) if (Math.hypot(p.x - D.x, p.y - D.y) < GLOW.doorR) { nextRoom(sim, G); return; }
}
function bagFor(sim, p, x, y, items, life) {
  const bag = { id: sim.id(), x: x + (sim.rng.next() - 0.5) * 50, y, items, ownerId: p.id, life, rarity: Math.max(...items.map((i) => i.rarity)) };
  sim.bags.push(bag); sim.emit({ type: 'loot', x: bag.x, y: bag.y, rarity: bag.rarity, pid: p.id });
}
function openChest(sim, G) {
  G.chest.open = 1; G.chests++;
  for (const id of G.party) {
    const p = sim.players.get(id); if (!p) continue;
    bagFor(sim, p, G.chest.x, G.chest.y + 34, withLootLevel(p.level, () => [0, 1].map(() => generateItem(sim.rng, { tier: GLOW.tier, cls: p.cls, rarity: sim.rng.next() < 0.35 ? 3 : 2 }))), secs(120));
  }
  sim.emit({ type: 'glow', ph: 'chest', x: G.chest.x, y: G.chest.y });
}
function nextRoom(sim, G) {
  G.room++; G.chest = null; G.door = false; G.pods = [];
  const ps = [...sim.players.values()];
  if (G.room >= 3) startBoss(sim, G);
  else {
    G.st = 'room'; G.wave = 0; G.nw = GLOW.rooms[G.room].waves.length; G.gap = secs(2.2); G.alive = []; G.podT = 90;
    setChallenge(sim);
    call(sim, HOLLOW_ROOMS[G.room].name.toUpperCase(), `Grotto ${G.room + 1} of 3 · Challenge: ${G.ch.text}`, '#d8ff9a', 180);
  }
  ps.forEach((p, i) => { if (!p.dead && inHollowArea(p.x, p.y, 600)) place(p, hollowEntry(roomIdx(G)), i); });
  sim.emit({ type: 'glow', ph: 'room', room: roomIdx(G), x: r0(roomOf(roomIdx(G)).x), y: r0(roomOf(roomIdx(G)).y) });
}

// ------------------------------------------------------------------ the boss fight (shared engine)
function startBoss(sim, G, attempts = 0) {
  const F = fightOf(G);
  for (const e of sim.enemies) if (!e.dead && (FIGHT_BOSSES.has(e.type) || e.glowAdd) && inHollowArea(e.x, e.y)) { e.dead = true; e.hp = 0; }
  G.st = 'boss';
  G.b = { st: 'pull', at: 0, pull: secs(5), bid: 0, phase: 1, tele: [], tid: 1, rot: 0, next: 0, cyc: 0, enr: astralEnr(sim, F.enrage), enraged: false, attempts, empty: 0, t: 0, won: false, hits: {}, bonus: 0, gale: null, lanes: [], eye: null, stormT: 0 };
  call(sim, F.name.toUpperCase(), attempts ? `Attempt ${attempts + 1} · the fight resets` : F.pullText, F.col, secs(5));
  sim.emit({ type: 'glow', ph: 'bossPull', f: G.f, x: r0(arenaOf(G).x), y: r0(arenaOf(G).y), t: secs(5) });
}
const perch = (G) => { const A = arenaOf(G); return { x: A.x, y: A.y - A.r * 0.35 }; };
function tickBoss(sim, G, ps) {
  const Bd = G.b, F = fightOf(G), A = arenaOf(G);
  if (Bd.st === 'victory') {
    const ex = hollowDoor(roomIdx(G));
    for (const p of ps) if (Math.hypot(p.x - ex.x, p.y - ex.y) < 46 && Bd.at > 90) { if (sim.hub) G.over = 1; else { for (const q of sim.players.values()) if (inHollowArea(q.x, q.y)) place(q, { x: 0, y: 40 }); endGlow(sim, null); } return; }
    Bd.at++; return;
  }
  if (Bd.st === 'wipe') { if (++Bd.at >= secs(4)) { startBoss(sim, G, Bd.attempts + 1); [...sim.players.values()].forEach((p, i) => { if (p.dead) { p.dead = false; p.hp = p.stats.maxHp; p.respawnAt = 0; } if (G.party.includes(p.id)) place(p, hollowEntry(roomIdx(G)), i); }); } return; }
  if (Bd.st === 'pull') {
    if (--Bd.pull <= 0) {
      const P = perch(G), b = spawnEnemy(sim, F.boss, P.x, P.y);
      const n = Math.max(1, ps.length), hp = Math.round(F.hp * encHpA(sim, F.enc, F.boss) * (GLOW.party[n - 1] || n));
      b.maxHp = b.hp = b.baseMaxHp = hp; b.cd = 1e6; b.raidHold = 1e6; b.face = Math.PI / 2; b.dropChance = 1; b.homeX = P.x; b.homeY = P.y; b.glowBoss = 1;
      if (F.ex) b.ex = 1;
      Bd.st = 'fight'; Bd.bid = b.id; Bd.n = n; Bd.next = 40; Bd.pool = poolFor(sim, G, Bd, 1);
      sim.emit({ type: 'glow', ph: 'bossStart', f: G.f, x: r0(b.x), y: r0(b.y), n, hp });
    }
    return;
  }
  const b = bossOf(sim);
  if (Bd.won || !b || b.dead) { bossVictory(sim, G); return; }
  if (!ps.length) { if (++Bd.empty > 60) wipeBoss(sim, G, b); return; }
  Bd.empty = 0; Bd.t++;
  if (b.hitstop > 10) b.hitstop = 10;
  if (!Bd.dashing) { b.x = b.homeX; b.y = b.homeY; }
  b.vx = b.vy = 0;
  // enrage
  if (Bd.enr > 0 && --Bd.enr === 0) { Bd.enraged = true; call(sim, F.enr[0], F.enr[1], '#ff3b3b', 240); sim.emit({ type: 'glow', ph: 'enrage', f: G.f, x: r0(b.x), y: r0(b.y) }); }
  if (Bd.enraged && Bd.t % 180 === 0) tele(Bd, { k: 'eclipse', sh: 'circle', x: A.x, y: A.y, r: A.r + 80, d: 60, pct: isTor(G) ? PCT.skyfall : PCT.eclipse, what: F.enr[0] });
  // phase gates (HP floors)
  const pct = b.hp / b.maxHp; let want = 1; F.ph.forEach((P, i) => { if (i > 0 && pct <= F.ph[i - 1].floor) want = i + 1; });
  if (want > Bd.phase) {
    Bd.phase = want; b.phase = want; Bd.rot = 0; Bd.next = 90; Bd.pool = poolFor(sim, G, Bd, want);
    const P = F.ph[want - 1];
    call(sim, P.name.toUpperCase(), `Phase ${want}${P.sub ? ' · ' + P.sub : ''}`, F.col, 170);
    if (P.start) runMech(sim, G, Bd, b, P.start, ps);
    if (P.aura === 'eye') Bd.eye = { r: A.r * 0.55, t: 0, d: secs(100) };
    sim.emit({ type: 'glow', ph: 'phase', f: G.f, phase: want, x: r0(b.x), y: r0(b.y) });
    sim.emit({ type: 'bossPhase', phase: want, x: b.x, y: b.y, id: b.id, raid: true });
  }
  const P = F.ph[Bd.phase - 1];
  // the bonus window (a clean answer exposes the boss)
  if (Bd.bonus > 0) { Bd.bonus--; b.takeMul = GLOW.bonus.mul; if (!Bd.bonus) b.takeMul = 1; }
  if (P.aura === 'eye' && Bd.eye) { const E = Bd.eye; E.t++; E.cur = Math.max(60, E.r * (1 - E.t / E.d)); b.takeMul = 1.5; if (Bd.t % 30 === 0) for (const p of ps) if (Math.hypot(p.x - b.x, p.y - b.y) > E.cur + p.r * 0.5) hit(sim, G, p, PCT.eye, 'the storm wall', null); }
  if (P.aura === 'storm' && ++Bd.stormT >= 90) { Bd.stormT = 0; for (let i = 0; i < 2 + Math.min(2, ps.length); i++) { const tgt = i === 0 ? ps[Math.floor(sim.rng.next() * ps.length)] : null, a = sim.rng.next() * TAU, rr = Math.sqrt(sim.rng.next()) * (A.r - 60); tele(Bd, { k: 'storm', sh: 'circle', x: r0(tgt ? tgt.x : A.x + Math.cos(a) * rr), y: r0(tgt ? tgt.y : A.y + Math.sin(a) * rr), r: 90, d: 66, pct: PCT.storm, what: 'Stormfront' }); } }
  // the rotation
  if (--Bd.next <= 0) {
    if (!Bd.pool) Bd.pool = poolFor(sim, G, Bd, Bd.phase);
    const pick = Bd.pool.next(), key = pick.key; Bd.var = pick.v; Bd.flip = pick.flip; Bd.rot++; if (Bd.rot % P.rot.length === 0) Bd.cyc++;
    const parts = key.split('+');
    for (const k of parts) runMech(sim, G, Bd, b, k, ps);
    Bd.next = gapOf(Math.round(Math.max(...parts.map((k) => DUR[k] || 150)) * F.k) + 30, F.lvl);
  }
  tickSoft(sim, G, Bd, ps);
  tickGale(sim, G, Bd, ps);
  tickLanes(sim, G, Bd, ps);
  tickTele(sim, G, Bd, ps, b);
}
function tele(Bd, spec) { if (spec.k === 'beam') spec = { ...spec, pos: 1 }; /* (Moonbeam: a position check) */ const t = withTell({ id: Bd.tid++, t: 0, ...spec }); if (spec.at) t.t = -spec.at; Bd.tele.push(t); return t; } // (A2: every hit tells >= 2 s)
/** (A2) the phase's seeded pool: same seed per attempt, a new order each attempt (sim/mechpool.js) */
function poolFor(sim, G, Bd, ph) { const F = fightOf(G), L = lockedSeed(sim, ph); return makePool(F.ph[ph - 1].rot, F.lvl || 'none', L != null ? L : ((sim.seed | 0) * 31 + (Bd.attempts + 1) * 977 + ph * 7919) >>> 0); } // (Part E: a locked practice variation forces the seed)
/** (A2) must-kill adds: if they live past the soft enrage they burst on the party */
function tickSoft(sim, G, Bd, ps) {
  if (!Bd.soft) return;
  const A = arenaOf(G), live = sim.enemies.filter((e) => !e.dead && e.glowAdd && inHollowArea(e.x, e.y));
  if (!live.length) { Bd.soft = 0; return; }
  if (Bd.t < Bd.soft) return;
  Bd.soft = 0; call(sim, 'THEY BURST', `${live.length} left alive · kill the adds before the bar runs out`, '#ff4d5e', 120);
  for (const e of live) { e.dead = true; e.hp = 0; for (const p of ps) hit(sim, G, p, PCT.burst, 'add burst', null); }
  sim.emit({ type: 'glow', ph: 'burst', n: live.length, x: r0(A.x), y: r0(A.y) });
}
const nearest = (b, ps) => ps.reduce((m, p) => (!m || Math.hypot(p.x - b.x, p.y - b.y) < Math.hypot(m.x - b.x, m.y - b.y) ? p : m), null);
const furthest = (b, ps) => ps.reduce((m, p) => (!m || Math.hypot(p.x - b.x, p.y - b.y) > Math.hypot(m.x - b.x, m.y - b.y) ? p : m), null);
function runMech(sim, G, Bd, b, k, ps) {
  const F = fightOf(G), A = arenaOf(G), K = F.k, ex = !!F.ex;
  const T = TXT[k] || [k.toUpperCase(), ''];
  let sub = T[1];
  if (k === 'bloom') { // three rings of spores, inside-out or outside-in
    const out = Bd.var == null ? Bd.cyc % 2 === 0 : !Bd.var, rings = [[0, 170], [170, 340], [340, A.r + 40]], D = r0(80 * K), gap = r0(45 * K);
    (out ? rings : rings.slice().reverse()).forEach(([a, c], i) => tele(Bd, { k: 'bloom', sh: a ? 'ring' : 'circle', x: A.x, y: A.y, r0: a, r: c, d: D + i * gap, pct: PCT.bloom, what: 'Lantern Bloom' }));
    sub = out ? 'Inside OUT · start at the rim, then step in behind the wave' : 'Outside IN · start in the middle, then step out behind the wave';
  } else if (k === 'beam') {
    const a0 = (Bd.var == null ? Bd.cyc % 2 : Bd.var) * 0.3 + (Bd.flip ? Math.PI / 8 : 0), L = A.r * 2 + 200, D = r0(80 * K);
    for (const [da, dd] of [[0, 0], [Math.PI / 2, 0], [Math.PI / 4, 50], [3 * Math.PI / 4, 50]]) tele(Bd, { k: 'beam', sh: 'rect', x: r0(b.x), y: r0(b.y), ang: a0 + da, len: L, w: 110, d: D + r0(dd * K), pct: PCT.beam, what: 'Moonbeam' });
  } else if (k === 'gust') {
    const p = nearest(b, ps); if (!p) return;
    tele(Bd, { k: 'gust', sh: 'cone', x: r0(b.x), y: r0(b.y), ang: Math.atan2(p.y - b.y, p.x - b.x), arc: 1.3, r: 640, d: r0(70 * K), pct: PCT.gust, kb: 360, what: 'Wing Gust' });
  } else if (k === 'dusk') {
    const n = Bd.phase >= 2 ? 2 : 3, rr = Bd.phase >= 3 ? 105 : 120, c = [];
    for (let i = 0; i < n; i++) { const a = sim.rng.next() * TAU, d = 120 + sim.rng.next() * (A.r - 260); c.push([r0(A.x + Math.cos(a) * d), r0(A.y + Math.sin(a) * d), rr]); }
    tele(Bd, { k: 'dusk', sh: 'safe', x: A.x, y: A.y, c, d: r0(170 * K), pct: PCT.dusk, what: 'Dusk', clean: 1 });
  } else if (k === 'spores' || k === 'hail') {
    for (let i = 0; i < 3; i++) Bd.lanes.push({ k: 'follow', kind: k, at: Bd.t + r0(i * 32 * K), r: 95, d: r0(60 * K) });
  } else if (k === 'dash' || k === 'charge') {
    const p = furthest(b, ps); if (!p) return;
    const ang = Math.atan2(p.y - b.y, p.x - b.x), far = A.r - 80;
    const ex2 = { x: A.x + Math.cos(ang) * far, y: A.y + Math.sin(ang) * far }; // the rim point past the hero
    // walk the ray from the boss through the hero to the rim
    let len = 0; for (let s = 0; s < A.r * 2.2; s += 20) { const x = b.x + Math.cos(ang) * s, y = b.y + Math.sin(ang) * s; if (Math.hypot(x - A.x, y - A.y) > far) break; len = s; }
    void ex2;
    tele(Bd, { k, sh: 'rect', x: r0(b.x), y: r0(b.y), ang, len: Math.max(200, len), w: k === 'dash' ? 150 : 170, d: r0((k === 'dash' ? 80 : 75) * K), pct: k === 'dash' ? PCT.dash : PCT.charge, kb: 300, what: T[0], move: 1 });
  } else if (k === 'adds' || k === 'calves') {
    const n = (Bd.phase >= 3 ? 4 : 3) + (ex ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + sim.rng.next(), x = A.x + Math.cos(a) * (A.r - 90), y = A.y + Math.sin(a) * (A.r - 90);
      const e = spawnEnemy(sim, k === 'adds' ? 'mothling' : 'stormhound', x, y, { wave: true, mul: 1.2 });
      Bd.soft = Bd.t + softEnrageT(ps.length); e.glowAdd = 1; e.glowWave = 1; e.dropChance = 0.05; e.homeX = A.x; e.homeY = A.y; const t = ps[i % ps.length]; if (t) e.aggroId = t.id;
    }
  } else if (k === 'quake') {
    const D = r0(70 * K), gap = r0(40 * K);
    for (let i = 0; i < 3; i++) { const a = 60 + i * 180; tele(Bd, { k: 'quake', sh: 'ring', x: r0(b.x), y: r0(b.y), r0: a, r: a + 110, d: D + i * gap, pct: PCT.quake, kb: 200, what: 'Hoof Quake' }); }
    sub = 'Three shock rings race out from his hooves · step between them';
  } else if (k === 'rods') {
    const n = ex ? 4 : 3, rods = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + sim.rng.next() * 0.8, d = 200 + sim.rng.next() * (A.r - 300); rods.push([r0(A.x + Math.cos(a) * d), r0(A.y + Math.sin(a) * d)]); }
    const D = r0(150 * K);
    for (const [x, y] of rods) tele(Bd, { k: 'rod', sh: 'circle', x, y, r: 130, d: D, pct: PCT.rod, what: 'Lightning Rod', rod: 1 });
    for (let i = 0; i < n; i++) { const [x1, y1] = rods[i], [x2, y2] = rods[(i + 1) % n]; if (n === 2 && i === 1) break; tele(Bd, { k: 'arc', sh: 'rect', x: x1, y: y1, ang: Math.atan2(y2 - y1, x2 - x1), len: r0(Math.hypot(x2 - x1, y2 - y1)), w: 60, d: D + 20, pct: PCT.arc, what: 'Rod Arc' }); }
  } else if (k === 'marks') { // (A2) spread or stack, by the variant
    const st = !!Bd.var && ps.length > 1; for (const t of mkMarks(ps, Bd.pool ? Bd.pool.rnd : () => sim.rng.next(), st)) tele(Bd, { ...t, pct: st ? PCT.stack : PCT.spread, what: st ? 'Moth Stack' : 'Moth Mark' });
    sub = st ? 'STACK on the blue mark · share the hit' : 'SPREAD · keep your purple circle off everyone else';
  } else if (k === 'wings') { // (A2) positional combo
    const p = nearest(b, ps); if (!p) return;
    for (const t of mkCombo({ x: r0(b.x), y: r0(b.y) }, Math.atan2(p.y - b.y, p.x - b.x), !!(Bd.flip || Bd.var))) tele(Bd, { ...t, pct: PCT.wings, kb: 200, what: 'Wingbeat' });
  } else if (k === 'towers') { // (A2) one tower per hero
    for (const t of mkTowers(A, ps.length, Bd.pool ? Bd.pool.rnd : () => sim.rng.next(), r0(150 * K / F.k))) tele(Bd, { ...t, pct: PCT.tower, what: 'Storm Tower' });
  } else if (k === 'memory') { // (A2) shown, then replayed
    const M = mkMemory(r0(b.x), r0(b.y), ex ? 4 : 3, Bd.pool ? Bd.pool.rnd : () => sim.rng.next());
    for (const t of M.tele) tele(Bd, { ...t, pct: PCT.mem, what: 'Storm Memory' });
  } else if (k === 'gale') {
    const ang = sim.rng.next() * TAU;
    Bd.gale = { ang, t: -Math.max(120, r0(60 * K)), d: secs(3), push: ex ? 2.1 : 1.7 };
    tele(Bd, { k: 'galewarn', sh: 'wall', x: A.x, y: A.y, ang, r0: A.r - 110, r: A.r + 40, d: Math.max(120, r0(60 * K)), pct: 0, what: 'Gale', warn: 1, tell: 'BRACE' });
    sub = 'The wind will shove you · walk INTO it · the downwind rim is a storm wall';
  }
  call(sim, T[0], sub, F.col, 110);
  sim.emit({ type: 'glow', ph: 'cast', k, f: G.f, x: r0(b.x), y: r0(b.y) });
}
function tickGale(sim, G, Bd, ps) {
  const W = Bd.gale; if (!W) return;
  const A = arenaOf(G);
  if (++W.t < 0) return;
  if (W.t > W.d) { Bd.gale = null; return; }
  const cx = Math.cos(W.ang), cy = Math.sin(W.ang);
  for (const p of ps) {
    if (!evadeShove(sim, p)) { p.x += cx * W.push; p.y += cy * W.push; }
    const dx = p.x - A.x, dy = p.y - A.y, d = Math.hypot(dx, dy);
    if (W.t % 30 === 0 && d > A.r - 110 && (dx * cx + dy * cy) / (d || 1) > 0.35) hit(sim, G, p, PCT.wall, 'the storm wall', null);
  }
}
function tickLanes(sim, G, Bd, ps) {
  for (const L of Bd.lanes) {
    if (L.k === 'follow' && !L.done && Bd.t >= L.at) { L.done = 1; for (const p of ps) tele(Bd, { k: L.kind, sh: 'circle', x: r0(p.x), y: r0(p.y), r: L.r, d: L.d, pct: L.kind === 'hail' ? PCT.hail : PCT.spores, what: L.kind === 'hail' ? 'Hailstorm' : 'Spore Rain' }); }
    if (L.k === 'dust' && Bd.t % 30 === 0) for (const p of ps) if (inLine(L.x, L.y, L.ang, L.len, L.w, p.x, p.y, (p.r || 16) * 0.5)) hit(sim, G, p, PCT.lane, 'burning dust', null);
  }
  Bd.lanes = Bd.lanes.filter((L) => (L.k === 'follow' ? !L.done : Bd.t < L.until));
}
/** is p caught by telegraph t? */
export function glowTeleHits(t, p) { return hits(t.sh === 'cone' ? { ...t, core: 40 } : t, p); } // (Part A1: sim/telegraph.js)
function tickTele(sim, G, Bd, ps, b) {
  for (const t of Bd.tele) {
    t.t++;
    if (t.pid != null && !t.done) { const q = sim.players.get(t.pid); if (q && !q.dead) { t.x = r0(q.x); t.y = r0(q.y); } }
    if (t.sh === 'tower' && !t.done) t.have = soakCount(t, ps);
    if (t.t !== t.d || t.done) continue;
    t.done = true; sim.posCheck = posTele(t) ? 1 : 0;
    if (t.warn) continue;
    let clean = true;
    if (t.sh === 'tower' || t.sh === 'stack' || t.sh === 'spread') { resolveShare(sim, G, t, ps); sim.emit({ type: 'glow', ph: 'boom', k: t.k, sh: t.sh, x: r0(t.x), y: r0(t.y), r: t.r, f: G.f }); continue; }
    for (const p of ps) if (glowTeleHits(t, p) && hit(sim, G, p, t.pct, t.what, t.sh === 'circle' || t.sh === 'cone' || t.move ? { x: t.x, y: t.y } : null, t.kb)) clean = false;
    if (t.move && b) { // the dash / charge carries the boss along the lane
      const nx = t.x + Math.cos(t.ang) * t.len, ny = t.y + Math.sin(t.ang) * t.len;
      b.x = b.px = b.homeX = r0(nx); b.y = b.py = b.homeY = r0(ny);
      if (t.k === 'dash') Bd.lanes.push({ k: 'dust', x: t.x, y: t.y, ang: t.ang, len: t.len, w: 120, until: Bd.t + 240 });
    }
    if (t.clean && clean && b) { Bd.bonus = GLOW.bonus.t; b.takeMul = GLOW.bonus.mul; call(sim, 'DAWN BREAKS', 'Everyone found the light · she is dazzled (+25% damage)', '#7dffb0', 110); sim.emit({ type: 'glow', ph: 'bonus', x: r0(b.x), y: r0(b.y) }); }
    sim.emit({ type: 'glow', ph: 'boom', k: t.k, sh: t.sh, x: r0(t.x), y: r0(t.y), r: t.r, ang: t.ang, len: t.len, f: G.f });
  }
  Bd.tele = Bd.tele.filter((t) => !t.done || t.t < t.d + 30);
  sim.posCheck = 0;
}
/** (A2) towers / stacks / spreads resolve by who is inside */
function resolveShare(sim, G, t, ps) {
  const inside = ps.filter((p) => glowTeleHits({ ...t, sh: 'circle' }, p));
  if (t.sh === 'tower') { if (inside.length >= (t.n || 1)) for (const p of inside) hit(sim, G, p, PCT.tower, t.what, null); else for (const p of ps) hit(sim, G, p, PCT.towerx, 'an empty ' + t.what, null); return; }
  if (t.sh === 'stack') { const ok = inside.length >= Math.min(t.n || 1, ps.length); for (const p of inside) hit(sim, G, p, ok ? PCT.stack : PCT.stackx, t.what, null); return; }
  const others = inside.filter((p) => p.id !== t.pid), ok = !others.length;
  for (const p of inside) hit(sim, G, p, ok ? PCT.spread : PCT.spreadx, t.what, null);
}
function hit(sim, G, p, pct, what, src, kb = 0) {
  const F = fightOf(G), name = F.short[0] + F.short.slice(1).toLowerCase();
  const ok = damagePlayer(sim, p, 0, src, { pct, raw: what === 'ECLIPSE' || what === 'SKYFALL', by: `${name}'s ${what}`, kb: src ? (kb || 200) : 0 });
  if (ok) { G.b.hits[what] = (G.b.hits[what] || 0) + 1; sim.emit({ type: 'glow', ph: 'hit', pid: p.id, what, x: r0(p.x), y: r0(p.y) }); }
  return ok;
}
function wipeBoss(sim, G, b) {
  const Bd = G.b, A = arenaOf(G);
  Bd.st = 'wipe'; Bd.at = 0; Bd.tele = []; Bd.lanes = []; Bd.gale = null; Bd.eye = null;
  if (b) { b.dead = true; b.hp = 0; }
  for (const e of sim.enemies) if (!e.dead && e.glowWave && inHollowArea(e.x, e.y)) { e.dead = true; e.hp = 0; }
  for (const pr of sim.projectiles) if (inHollowArea(pr.x, pr.y)) pr.dead = true;
  call(sim, 'THE PARTY FALLS', isTor(G) ? 'The storm resets · try again' : 'Lumivex folds her wings · your run is kept', '#ff8a7a', secs(4));
  sim.emit({ type: 'glow', ph: 'wipe', f: G.f, x: r0(A.x), y: r0(A.y), attempts: Bd.attempts + 1 });
}
/** the unlocks a clear grants: the Hollow, then Vharok (Extreme) open / cleared */
export const GLOW_CLEAR_KEY = { lumivex: 'hollow', vharok: 'vhx', vharokx: 'vhxc' };
function bossVictory(sim, G) {
  const Bd = G.b, A = arenaOf(G), F = fightOf(G);
  Bd.st = 'victory'; Bd.at = 0; Bd.tele = []; Bd.lanes = []; Bd.gale = null; Bd.eye = null;
  for (const e of sim.enemies) if (!e.dead && e.glowWave && inHollowArea(e.x, e.y)) { e.dead = true; e.hp = 0; }
  const secsT = Math.round((isTor(G) ? Bd.t : G.t) / 60);
  call(sim, isTor(G) ? (F.ex ? 'EXTREME CLEARED' : 'TRIAL CLEARED') : 'THE MATRIARCH FALLS', `${F.name} · ${Math.floor(secsT / 60)}:${String(secsT % 60).padStart(2, '0')} · ${sim.hub ? 'the exit glows at the south rim' : 'step onto the south rim to leave'}`, '#e8ffc0', 360);
  for (const id of G.party) {
    const p = sim.players.get(id);
    if (!p) continue;
    p.unlocks = p.unlocks || {};
    if (!isTor(G)) bagFor(sim, p, A.x, A.y + 30, withLootLevel(p.level, () => [generateItem(sim.rng, { tier: GLOW.tier, cls: p.cls, rarity: 3 }), generateItem(sim.rng, { tier: GLOW.tier, cls: p.cls, rarity: sim.rng.next() < 0.5 ? 3 : 2 })]), secs(180));
    const key = GLOW_CLEAR_KEY[G.f], fresh = !p.unlocks[key]; p.unlocks[key] = 1;
    sim.emit({ type: 'unlock', pid: p.id, key, fresh: fresh ? 1 : 0, x: r0(A.x), y: r0(A.y) });
  }
  sim.emit({ type: 'glow', ph: 'victory', f: G.f, x: r0(A.x), y: r0(A.y), t: secsT, attempts: Bd.attempts });
}

/** Compact copy for co-op snapshots (the renderer reads the same shape from a local sim). */
export function packGlow(sim) {
  const G = sim.glow;
  if (!G) return null;
  const Bd = G.b;
  return {
    f: G.f, st: G.st, room: G.room, wave: G.wave, nw: G.nw, ch: G.ch, chest: G.chest, door: G.door, call: G.call, t: G.t,
    pend: G.pend ? { t: G.pend.t, pts: G.pend.list.map((s) => [s.x, s.y, s.elite ? 1 : 0]) } : null,
    pods: G.pods.map((c) => [c.x, c.y, c.t, c.d]),
    b: Bd ? { st: Bd.st, phase: Bd.phase, at: Bd.at, pull: Bd.pull, enr: Bd.enr, enraged: Bd.enraged, attempts: Bd.attempts, bid: Bd.bid, bonus: Bd.bonus,
      gale: Bd.gale ? { ang: Bd.gale.ang, t: Bd.gale.t, d: Bd.gale.d } : null, eye: Bd.eye ? r0(Bd.eye.cur || Bd.eye.r) : 0,
      lanes: Bd.lanes.filter((L) => L.k === 'dust').map((L) => [L.x, L.y, L.ang, L.len, L.w]),
      tele: Bd.tele.map((t) => ({ id: t.id, k: t.k, sh: t.sh, x: t.x, y: t.y, r: t.r, r0: t.r0, ang: t.ang, len: t.len, w: t.w, arc: t.arc, c: t.c, d: t.d, t: t.t, done: t.done ? 1 : 0, tell: t.tell, n: t.n, have: t.have, pid: t.pid, warn: t.warn, mem: t.mem })) } : null,
  };
}
/** Test / dev hook: jump to a grotto or the boss, set HP, kill the boss, clear a grotto, run a mechanic. */
export function devGlow(sim, p, m) {
  if (!sim.glow) enterGlow(sim, p, m.f || 'lumivex');
  const G = sim.glow;
  if (m.room != null && G.f === 'lumivex') { for (const id of G.alive) { const e = sim.enemyById.get(id); if (e) e.dead = true; } G.alive = []; G.pend = null; G.room = Math.max(0, Math.min(3, m.room)) - 1; nextRoom(sim, G); }
  if (m.hp != null && G.b) { const b = bossOf(sim); if (b) b.hp = b.maxHp * m.hp; }
  if (m.mech && G.b && G.b.st === 'fight') { const b = bossOf(sim); if (b) runMech(sim, G, G.b, b, m.mech, here(sim)); }
  if (m.kill && G.b) { const b = bossOf(sim); if (b) { b.hp = 0; b.dead = true; G.b.won = true; } }
  if (m.clear && G.st === 'room') { for (const id of G.alive) { const e = sim.enemyById.get(id); if (e) e.dead = true; } G.alive = []; G.pend = null; G.wave = G.nw; }
}
