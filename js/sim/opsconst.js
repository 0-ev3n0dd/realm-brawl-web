// Missions (Warframe-style mission dungeons): pure geometry + tables shared by the sim, the server and the client.
// Every open-world map (the Wilds, Sunscorch Dunes, Frostveil Peaks, Emberdeep Caldera) has five FIXED, always-open
// mission entrances spread one per region across the map (placeOpsGates spread pass) (Defense, Mobile Defense, Assault, Capture, Swarm) plus, where it has one, a fixed entrance
// to its boss dungeon (the Tomb / the Glacier Crypt / the Forge of Cinders). Each biome x type mission is played in its
// own instanced arena far south of every map (y < OPS_Y), so a point's position alone says which mission (and which
// biome: materials, palette, roster) it belongs to. Runtime: sim/ops.js. Entrances: placeOpsGates (world.js).
const secs = (s) => Math.round(s * 60); // (no constants.js import: it imports this file)

export const OPS_Y = -55000; // everything south of this line is a mission arena
export const OPS_TYPES = ['defense', 'mobile', 'assault', 'capture', 'swarm'];
export const OPS_BIOMES = ['wilds', 'dunes', 'frost', 'ember', 'rift']; // (game loop C3: + Map 5, appended: every older gate / arena keeps its id)
/** per mission type: card text, colours, the entrance icon, the reward focus */
export const OPS_TYPE = {
  defense: { name: 'Defense', icon: 'shield', col: '#ffcf4a', glow: '#fff1a8', obj: 'Hold the relic through 5 waves and the siege. Charge it to fire pulses, build turrets and traps between waves.', reward: 'Set pieces (one per round)', mode: 'Solo or co-op · 5 waves + a siege boss a round, endless rounds' },
  mobile: { name: 'Mobile Defense', icon: 'shard', col: '#4de8ff', glow: '#c8fbff', obj: 'Escort the carrier down a 3-stage route: defend it at 2 hack points, survive ambushes, a collapsing bridge and a hunter squad, then beat the boss at the final point.', reward: 'Upgrade materials (rare + trophy), gold + boss / hunter showers', mode: 'Solo or co-op · ~5-7 min' },
  assault: { name: 'Assault', icon: 'swords', col: '#ff5a4a', glow: '#ffc0b0', obj: 'Raid the stronghold: break the shield pylons to drop the gate, cross the trap hall, beat the champion, then the Gatekeeper.', reward: 'Realm Gate keys + gear + boss / champion showers', mode: 'Solo or co-op · ~4-6 min' },
  capture: { name: 'Capture', icon: 'target', col: '#c08cff', glow: '#ead8ff', obj: 'Hunt the quarry: follow its clues and footprints across the hunting ground, run it down through its snares, guards and decoys, pin it (nets, broken escape rigs, damage) and capture it in the Hunter\'s Ring.', reward: 'Guaranteed set piece + relic / exotic chance, bounty materials', mode: 'Solo or co-op · ~4-6 min' },
  swarm: { name: 'Swarm', icon: 'skull', col: '#8cff5a', glow: '#dcffc8', obj: 'Survive 8 escalating horde waves while the arena shrinks, then slay the Swarm Queen. Chain kills for a loot combo.', reward: 'Biome materials in bulk + loot showers (combo boosted)', mode: 'Solo or co-op · ~5-7 min · 3 party lives' },
};
/** per biome: which map, its danger / loot tier, the enemy mix (sitegen SITE_ROSTERS key), mob scaling, set, key, target */
export const OPS_BIOME = {
  wilds: { name: 'The Wilds', mission: 'field', danger: 2, tier: 2, roster: 'w2', elites: ['boar', 'golem', 'wolf'], mul: 1, hpMul: 1, set: 'wildwarden', key: 'astrael', boss: null,
    target: { type: 'goblin', name: 'Grove Poacher' }, floor: ['#6dbb4f', '#5aa543', '#7fcb5c'], wall: '#3e6b34', voidc: '#0f1c12', accent: '#b9f08a' },
  dunes: { name: 'Sunscorch Dunes', mission: 'dunes', danger: 4, tier: 4, roster: 'dunes', elites: ['mummy', 'scarab', 'jackal'], mul: 1.4, hpMul: 1, set: 'duneborn', key: 'neferakht', boss: 'tomb', /* (game loop B: Dunes Assault drops the Dunes Trial's key) */
    target: { type: 'jackal', name: 'Sandrunner Thief' }, floor: ['#e8c47a', '#dcb466', '#f0d290'], wall: '#9a6a32', voidc: '#21160a', accent: '#ffe39a' },
  frost: { name: 'Frostveil Peaks', mission: 'frost', danger: 5, tier: 5, roster: 'frost', elites: ['yeti', 'rimewraith', 'yeti'], mul: 1.5, hpMul: 1.3, set: 'frostveil', key: 'skaldrat', boss: 'crypt',
    target: { type: 'acolyte', name: 'Frost Warden' }, floor: ['#d2e5f4', '#bcd6ec', '#e6f1fa'], wall: '#6f93b3', voidc: '#0c1622', accent: '#bfefff' },
  ember: { name: 'Emberdeep Caldera', mission: 'ember', danger: 6, tier: 6, roster: 'ember', elites: ['basalt', 'thrall', 'thrall'], mul: 1.7, hpMul: 1.5, set: 'emberdeep', key: 'pyrrhext', boss: 'forge', /* (game loop C2: tier 6) */
    target: { type: 'thrall', name: 'Ember Smith' }, floor: ['#5a4440', '#4d3a36', '#664d47'], wall: '#2a1c1a', voidc: '#140806', accent: '#ff9a4a' },
  rift: { name: 'The Astral Rift', mission: 'rift', danger: 7, tier: 7, roster: 'rift', elites: ['voidgolem', 'astralknight', 'astralknight'], mul: 1.7, hpMul: 1.5, set: 'astral', key: 'astrael', boss: 'vorthax', /* (game loop C3) */
    target: { type: 'starwisp', name: 'Star Thief' }, floor: ['#3e3666', '#342c5a', '#4a4076'], wall: '#1a1430', voidc: '#06040e', accent: '#b48cff' },
};
/** Mobile Defense per biome: the carrier, the hunter squad, the boss at the final point */
export const OPS_MOBILE = {
  wilds: { cart: 'Seed Ark', hunter: 'wolf', hname: 'Thornpack Hunter', cap: 'Thornpack Alpha', boss: ['boar', 'Gorehorn the Waylayer'], hack: 'Rootlink' },
  dunes: { cart: 'Sun Barge', hunter: 'jackal', hname: 'Anubite Tracker', cap: 'Jackal Warchief', boss: ['sandwurm', 'Duneripper'], hack: 'Sun Dial' },
  frost: { cart: 'Rune Sledge', hunter: 'rimewraith', hname: 'Rime Stalker', cap: 'Stalker Matriarch', boss: ['sentinel', 'The Glacial Ravager'], hack: 'Rune Pylon' },
  ember: { cart: 'Forge Crawler', hunter: 'kindler', hname: 'Cinder Tracker', cap: 'Kindler Huntmaster', boss: ['construct', 'Slag Juggernaut'], hack: 'Heat Valve' },
  rift: { cart: 'Star Skiff', hunter: 'riftstalker', hname: 'Rift Tracker', cap: 'Stalker Prime', boss: ['voidgolem', 'The Void Colossus'], hack: 'Star Lens' },
};
/** Assault per biome: rooms, traps, the champion, the Gatekeeper */
export const OPS_ASSAULT = {
  wilds: { rooms: ['Bramble Court', 'Snapjaw Hall', 'The Thornring', 'Heartwood Gate'], line: 'Thorn Lash', circle: 'Snapjaw', champ: ['knight', 'Sir Bramblehelm'], gk: 'golem', pylon: 'Rootbound Pylon' },
  dunes: { rooms: ['Sunbaked Court', 'Hall of Blades', 'The Sandpit', 'The Sun Gate'], line: 'Blade Sweep', circle: 'Sand Spike', champ: ['mummy', 'Warlord Khet'], gk: 'scarab', pylon: 'Sunstone Pylon' },
  frost: { rooms: ['Rime Court', 'Icefall Hall', 'The Frozen Ring', 'The Glacier Gate'], line: 'Frost Vent', circle: 'Icicle Drop', champ: ['rimewraith', 'Rimeblade Champion'], gk: 'yeti', pylon: 'Runeice Pylon' },
  ember: { rooms: ['Slag Court', 'Flame Hall', 'The Crucible', 'The Forge Gate'], line: 'Flame Jet', circle: 'Magma Grate', champ: ['thrall', 'Forgemaster Brann'], gk: 'basalt', pylon: 'Slagforge Pylon' },
  rift: { rooms: ['Starfall Court', 'Hall of Orbits', 'The Void Well', 'The Astral Gate'], line: 'Star Lance', circle: 'Void Snap', champ: ['astralknight', 'Sir Halcyon the Fallen'], gk: 'voidgolem', pylon: 'Starglass Pylon' },
};
/** Capture per biome: the quarry (enemy type, name), its clues (what it left behind), its snare, its escape rig */
export const OPS_CAPTURE = {
  wilds: { quarry: ['goblin', 'Grove Poacher'], clues: ['Snapped Bowstring', 'Muddy Pawprints', 'Dropped Snare Kit'], snare: 'Snapjaw Snare', rig: 'Vine Rope', lair: 'Poacher\'s Hide' },
  dunes: { quarry: ['jackal', 'Sandrunner Thief'], clues: ['Torn Silk Scarf', 'Sand-filled Boot', 'Stolen Coin Pouch'], snare: 'Sand Sink', rig: 'Sand Glider', lair: 'Thieves\' Den' },
  frost: { quarry: ['acolyte', 'Frost Warden'], clues: ['Frosted Lantern', 'Rune-etched Shard', 'Abandoned Cloak'], snare: 'Rime Mine', rig: 'Ice Sled', lair: 'Warden\'s Cache' },
  ember: { quarry: ['thrall', 'Ember Smith'], clues: ['Cooling Ingot', 'Scorched Glove', 'Spilled Ember Coals'], snare: 'Cinder Mine', rig: 'Smoke Balloon', lair: 'Smith\'s Hideout' },
  rift: { quarry: ['starwisp', 'Star Thief'], clues: ['Dimmed Star Shard', 'Torn Starsilk', 'Scattered Stardust'], snare: 'Void Snare', rig: 'Comet Kite', lair: 'Thief\'s Orbit' },
};
export const CAP_RIGS = new Set(Object.values(OPS_CAPTURE).map((c) => c.rig));
export const CAP_QUARRY = new Set(Object.values(OPS_CAPTURE).map((c) => c.quarry[1]));
/** the boss dungeons' fixed entrances (hub mission ids; the biome they stand in) */
export const BOSS_GATES = { tomb: { biome: 'dunes', name: 'Tomb of the Sun-Eaten King', col: '#2ee6c4' }, crypt: { biome: 'frost', name: 'The Glacier Crypt', col: '#8fe3ff' }, forge: { biome: 'ember', name: 'The Forge of Cinders', col: '#ffb43c' }, vorthax: { biome: 'rift', name: 'The Rift Sanctum', col: '#b48cff' }, hollow: { biome: 'wilds', name: 'The Glowmire Hollow', col: '#c9f27a' } }; // (2026-10-18: the Wilds' dungeon: appended after every other gate, so older gate ids stay)

// ------------------------------------------------------------------ arenas
const AX0 = -24000, ADX = 8000, AY0 = -62000, ADY = 9000;
const P = (x, y, r) => ({ x, y, r });
/** Capture (revamp part 3): the hunting ground's clearings [dx, dy, r] from the arena centre (0 = the camp / start, 6 = the centre) */
const CAP_CLEARINGS = [[0, 1950, 540], [-1750, 1050, 520], [-1800, -950, 520], [0, -1950, 540], [1800, -950, 520], [1750, 1050, 520], [0, 0, 560]];
const CAP_TRAIL = 330;
/** clearing graph (trails): the ring 0-1-2-3-4-5-0 + 0-6-3 through the centre */
export const CAP_ADJ = [[1, 5, 6], [0, 2], [1, 3], [2, 4, 6], [3, 5], [4, 0], [0, 3]];
/** the clearings to walk from a to b (BFS over the trails), a and b included */
export function capRoute(a, b) {
  const prev = new Array(CAP_ADJ.length).fill(-1), q = [a]; prev[a] = a;
  while (q.length) { const i = q.shift(); if (i === b) break; for (const j of CAP_ADJ[i]) if (prev[j] < 0) { prev[j] = i; q.push(j); } }
  if (prev[b] < 0) return [a];
  const out = [b]; let i = b; while (i !== a) { i = prev[i]; out.push(i); }
  return out.reverse();
}
/** the clearing a point is in / nearest to */
export function capClearing(A, x, y) { let bi = 0, bd = Infinity; A.clear.forEach((C, i) => { const d = Math.hypot(x - C.x, y - C.y) - C.r; if (d < bd) { bd = d; bi = i; } }); return bi; }
function makeArena(bi, ti) {
  const biome = OPS_BIOMES[bi], type = OPS_TYPES[ti], cx = AX0 + ti * ADX, cy = AY0 - bi * ADY;
  const A = { biome, type, bi, ti, cx, cy, pillars: [], solid: [], spawns: [], start: null };
  if (type === 'defense') {
    Object.assign(A, { ax: cx, ay: cy, bx: cx, by: cy, R: 900 });
    A.relic = P(cx, cy, 58); A.solid.push(A.relic);
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; A.pillars.push(P(cx + Math.cos(a) * 470, cy + Math.sin(a) * 470, 40)); }
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; A.spawns.push({ x: cx + Math.cos(a) * 820, y: cy + Math.sin(a) * 820 }); }
    A.start = { x: cx, y: cy + 170 };
    A.pads = { extract: { x: cx - 250, y: cy + 420, r: 70 }, cont: { x: cx + 250, y: cy + 420, r: 70 } };
    // revamp: six build sockets ring the relic (turrets / traps / wards, built between waves with mission materials)
    A.socks = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; A.socks.push(P(Math.round(cx + Math.cos(a) * 320), Math.round(cy + Math.sin(a) * 300), 46)); }
  } else if (type === 'swarm') {
    Object.assign(A, { ax: cx, ay: cy, bx: cx, by: cy, R: 1050 });
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; A.pillars.push(P(cx + Math.cos(a) * 560, cy + Math.sin(a) * 560, 44)); }
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; A.spawns.push({ x: cx + Math.cos(a) * 960, y: cy + Math.sin(a) * 960 }); }
    A.start = { x: cx, y: cy + 120 };
    A.pads = {}; // (revamp: no extract beacon: 8 waves, then the Swarm Queen)
    A.queenAt = { x: cx, y: cy - 260 };
  } else if (type === 'capture') { // revamp part 3: a hunting ground. 7 clearings (a ring of 6 + the centre) joined by trails
    const CL = CAP_CLEARINGS.map(([x, y, r]) => P(cx + x, cy + y, r));
    A.clear = CL; A.adj = CAP_ADJ;
    const seq = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 0, 6, 6, 3]; // (a zero-length leg = a round clearing)
    A.path = seq.map((i) => ({ x: CL[i].x, y: CL[i].y }));
    A.pathR = seq.slice(0, -1).map((i, k) => (i === seq[k + 1] ? CL[i].r : CAP_TRAIL));
    Object.assign(A, { ax: cx, ay: cy, bx: cx, by: cy, R: 560 });
    A.sAt = routeTable(A); A.len = A.sAt[A.sAt.length - 1];
    // the quarry's escape rigs (break them: the exit seals), on the outer edge of clearings 1 / 3 / 5
    A.exits = [1, 3, 5].map((ci) => { const C = CL[ci], a = Math.atan2(C.y - cy, C.x - cx); return { x: Math.round(C.x + Math.cos(a) * 330), y: Math.round(C.y + Math.sin(a) * 330), a, ci }; });
    // clue spots (one per clearing, off-centre), net crates (one per clearing), rocks / stumps
    A.clueAt = CL.map((C, i) => ({ x: C.x + (i % 2 ? -150 : 150), y: C.y - 120 }));
    A.netAt = CL.map((C, i) => ({ x: C.x + (i % 2 ? 210 : -210), y: C.y + 150 }));
    CL.forEach((C, i) => { if (i === 0) return; const a = i * 1.7; A.pillars.push(P(Math.round(C.x + Math.cos(a) * 300), Math.round(C.y + Math.sin(a) * 260), 36)); });
    A.start = { x: CL[0].x, y: CL[0].y + 180 }; A.targetAt = { x: CL[3].x, y: CL[3].y };
    } else if (type === 'mobile') { // revamp part 2: a winding escort route (a polyline, per-leg width), 2 hack points, a bridge, the final plaza
    const N = [[-2050, 430], [-1250, 430], [-820, -170], [-40, -170], [330, 430], [960, 430], [1330, -120], [2080, -120], [2080, -120]];
    A.path = N.map(([x, y]) => ({ x: cx + x, y: cy + y }));
    A.pathR = [400, 400, 250, 400, 400, 360, 420, 640]; // leg 2 = the bridge (narrow, over the void); the last "leg" = the final plaza
    Object.assign(A, { ax: A.path[0].x, ay: A.path[0].y, bx: A.path[7].x, by: A.path[7].y, R: 640 });
    const S = routeTable(A); A.sAt = S; A.len = S[S.length - 1];
    A.hackS = [S[2], S[5]]; A.finalS = S[7];
    A.hacks = [P(A.path[2].x, A.path[2].y, 260), P(A.path[5].x, A.path[5].y, 260)]; A.final = P(A.path[7].x, A.path[7].y, 300);
    A.bridge = { s0: S[2], s1: S[3], leg: 2 };
    for (const [px, py] of [[-1650, 250], [-1000, 650], [150, 560], [700, 250], [2420, -520], [1760, 330], [2500, 260]]) A.pillars.push(P(cx + px, cy + py, 38));
    // breaches along the walls (s = distance along the route): packs pour in from the sides
    for (let s = 300; s < A.len; s += 260) { const q = routeAt(A, s); if (q.leg === 2) continue; const nx = -Math.sin(q.ang), ny = Math.cos(q.ang), R = A.pathR[q.leg] - 70; A.spawns.push({ x: Math.round(q.x + nx * R), y: Math.round(q.y + ny * R), s }, { x: Math.round(q.x - nx * R), y: Math.round(q.y - ny * R), s }); }
    A.start = { x: cx - 2000, y: cy + 520 }; A.shardAt = { x: A.path[0].x + 60, y: A.path[0].y }; A.terminals = A.hacks.concat([A.final]);
  } else { // assault (revamp part 2): a stronghold raid pushing north. Courtyard (shield pylons drop gate 1) -> the trap hall -> the champion's ring -> the Gatekeeper's sanctum
    Object.assign(A, { ax: cx, ay: cy + 2500, bx: cx, by: cy - 2500, R: 540 });
    A.gates = [cy + 1200, cy - 100, cy - 1400]; // closed until the room below is done (pylons / the packs / the champion)
    A.segs = [{ y0: cy + 3000, y1: cy + 1200 }, { y0: cy + 1200, y1: cy - 100 }, { y0: cy - 100, y1: cy - 1400 }, { y0: cy - 1400, y1: cy - 3000 }];
    for (const [px, py] of [[-400, 2380], [400, 2380], [-390, 1000], [390, 360], [-380, -420], [380, -1080], [-330, -2050], [330, -2050]]) A.pillars.push(P(cx + px, cy + py, 40));
    A.pylons = [P(cx - 330, cy + 1700, 34), P(cx + 330, cy + 1700, 34), P(cx, cy + 1420, 34)];
    A.start = { x: cx, y: cy + 2900 }; A.bossAt = { x: cx, y: cy - 2350 }; A.champAt = { x: cx, y: cy - 760 };
    // the traps (biome-themed art; heroes AND enemies get hit): line jets wall to wall + floor plates, on a cycle
    const L = (seg, y, off, per = 240) => ({ seg, k: 'line', x: cx - 560, y, ang: 0, len: 1120, w: 64, per, off });
    const C = (seg, x, y, off, per = 200, r = 92) => ({ seg, k: 'circle', x, y, r, per, off });
    A.traps = [L(1, cy + 930, 0), L(1, cy + 560, 80), L(1, cy + 190, 160), C(1, cx - 250, cy + 745, 30), C(1, cx + 250, cy + 745, 130), C(1, cx - 250, cy + 375, 130), C(1, cx + 250, cy + 375, 30),
      C(2, cx - 360, cy - 460, 0, 300, 105), C(2, cx + 360, cy - 460, 150, 300, 105), C(2, cx - 360, cy - 1060, 150, 300, 105), C(2, cx + 360, cy - 1060, 0, 300, 105), L(2, cy - 760, 220, 420)];
  }
  // bounding box (+ pad) for the area check
  const R = A.R + 300, PX = A.path ? A.path.map((q) => q.x) : [A.ax, A.bx], PY = A.path ? A.path.map((q) => q.y) : [A.ay, A.by];
  A.box = { x0: Math.min(...PX) - R, x1: Math.max(...PX) + R, y0: Math.min(...PY) - R, y1: Math.max(...PY) + R };
  A.id = biome + ':' + type;
  return A;
}
export const OPS_ARENAS = [];
for (let bi = 0; bi < OPS_BIOMES.length; bi++) for (let ti = 0; ti < OPS_TYPES.length; ti++) OPS_ARENAS.push(makeArena(bi, ti));
export const arenaOf = (biome, type) => OPS_ARENAS[OPS_BIOMES.indexOf(biome) * OPS_TYPES.length + OPS_TYPES.indexOf(type)] || null;
/** the arena a point is in (or null) */
export function opsArenaAt(x, y) {
  if (!(y < OPS_Y)) return null;
  const bi = Math.round((AY0 - y) / ADY), ti = Math.round((x - AX0) / ADX);
  if (bi < 0 || bi >= OPS_BIOMES.length || ti < 0 || ti >= OPS_TYPES.length) return null;
  const A = OPS_ARENAS[bi * OPS_TYPES.length + ti], b = A.box;
  return x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 ? A : null;
}
export const inOpsArea = (x, y) => !!opsArenaAt(x, y);
/** the biome a mission arena belongs to (materials / palette), null outside */
export const opsBiome = (x, y) => { const A = opsArenaAt(x, y); return A ? A.biome : null; };
/** the hub mission id of a biome x type mission, and back */
export const opsMissionId = (biome, type) => 'op_' + type + '_' + biome;
export function opsOf(id) {
  if (typeof id !== 'string' || !id.startsWith('op_')) return null;
  const [, type, biome] = id.split('_');
  return OPS_TYPE[type] && OPS_BIOME[biome] ? { type, biome } : null;
}
/** the mission zones (zoneAt): one per biome, danger = the biome's mission danger */
export const OPS_ZONES = Object.fromEntries(OPS_BIOMES.map((b, i) => [b, { id: 81 + i, name: OPS_BIOME[b].name + ' · Mission', danger: OPS_BIOME[b].danger, r0: 0, r1: 0, tier: OPS_BIOME[b].tier, ops: true, biome: b }]));
export const opsZoneAt = (x, y) => { const A = opsArenaAt(x, y); return A ? OPS_ZONES[A.biome] : null; };

// distance from (x, y) to the arena's capsule spine (a polyline route: the leg it is deepest inside; m = that leg's radius)
function spine(A, x, y) {
  if (A.path) {
    let best = null, bk = Infinity;
    for (let i = 0; i < A.path.length - 1; i++) {
      const a = A.path[i], b = A.path[i + 1], dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L)) : 0, px = a.x + dx * t, py = a.y + dy * t, d = Math.hypot(x - px, y - py), k = d - A.pathR[i];
      if (k < bk) { bk = k; best = { px, py, d, R: A.pathR[i] }; }
    }
    return best;
  }
  const dx = A.bx - A.ax, dy = A.by - A.ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((x - A.ax) * dx + (y - A.ay) * dy) / L)) : 0;
  const px = A.ax + dx * t, py = A.ay + dy * t;
  return { px, py, d: Math.hypot(x - px, y - py), R: A.R };
}
/** cumulative route distance at each path node (polyline arenas) */
function routeTable(A) { const S = [0]; for (let i = 1; i < A.path.length; i++) S.push(S[i - 1] + Math.hypot(A.path[i].x - A.path[i - 1].x, A.path[i].y - A.path[i - 1].y)); return S; }
/** the point s px along a polyline route: { x, y, ang, leg } */
export function routeAt(A, s) {
  const S = A.sAt || routeTable(A), P = A.path, n = P.length;
  s = Math.max(0, Math.min(S[n - 1], s));
  let i = 0; while (i < n - 2 && (S[i + 1] < s || S[i + 1] === S[i])) i++;
  const a = P[i], b = P[i + 1], L = S[i + 1] - S[i], k = L > 0 ? (s - S[i]) / L : 0;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, ang: Math.atan2(b.y - a.y, b.x - a.x), leg: i };
}
/** the route distance of the point on the route nearest (x, y) */
export function routeS(A, x, y) {
  const S = A.sAt, P = A.path; let bs = 0, bd = Infinity;
  for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy; if (!L) continue; const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L)), d = Math.hypot(x - a.x - dx * t, y - a.y - dy * t); if (d < bd) { bd = d; bs = S[i] + Math.sqrt(L) * t; } }
  return bs;
}
/** (x, y) pulled inside the arena's walls with margin m (a capsule or a route) */
export function clampInArena(A, x, y, m = 0) { const q = spine(A, x, y), lim = q.R - m; if (q.d > lim) { const k = Math.max(0, lim) / (q.d || 1); return { x: q.px + (x - q.px) * k, y: q.py + (y - q.py) * k }; } return { x, y }; }
/** true when (x, y) is on the arena's floor (m px inside its walls) */
export function inArenaFloor(A, x, y, m = 0) { const q = spine(A, x, y); return q.d <= q.R - m; }
/** dynamic holes in a mission floor (Mobile Defense: the collapsed bridge, crumbled ledges): world.opsHoles [{x, y, r}] */
export function resolveHoles(world, e) {
  const H = world && world.opsHoles; if (!H || !H.length) return false;
  let hit = false; const r = e.r || 16;
  for (const o of H) { const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy), mm = o.r + r * 0.6; if (d < mm) { const k = mm / (d || 1); e.x = o.x + (d ? dx * k : 0); e.y = o.y + (d ? dy * k : mm); hit = true; } }
  return hit;
}
/** keep a circle (an entity: x, y, r) inside its arena and out of the pillars / the relic. Returns true if it was moved. */
export function resolveOps(A, e) {
  let hit = false;
  const r = e.r || 16, s = spine(A, e.x, e.y), m = s.R - r;
  if (s.d > m) { const k = m / (s.d || 1); e.x = s.px + (e.x - s.px) * k; e.y = s.py + (e.y - s.py) * k; hit = true; }
  for (const L of [A.pillars, A.solid]) for (const o of L) {
    const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy), mm = o.r + r;
    if (d < mm) { const k = mm / (d || 1); e.x = o.x + (d ? dx * k : 0); e.y = o.y + (d ? dy * k : mm); hit = true; }
  }
  return hit;
}
/** is (x, y) (a circle of radius r) blocked in its arena? */
export function opsBlocked(A, x, y, r = 0) {
  { const q = spine(A, x, y); if (q.d > q.R + 40 - r) return true; }
  for (const L of [A.pillars, A.solid]) for (const o of L) if (Math.hypot(x - o.x, y - o.y) < o.r + r) return true;
  return false;
}
/** an assault gate line (y) below which everything is held (null: none closed) -> clamp (players + mobs) */
export function clampGate(e, gy) { if (gy == null) return false; const m = gy + (e.r || 16) + 26; if (e.y < m) { e.y = m; return true; } return false; }
/** true when (x,y) is past a closed Assault gate (into the next hall / the Gatekeeper's end). Heroes behind the gate stay safe from enemy shots / AoE past it. */
export function pastAssaultGate(sim, x, y) {
  const O = sim && sim.ops; if (!O || O.type !== 'assault' || O.gateY == null) return false;
  return y < O.gateY;
}


// ------------------------------------------------------------------ the open-world entrances
/** where each biome's entrances cluster: the camp centre + its safe radius */
export const OPS_CAMPS = {
  wilds: { x: 0, y: 0, r: 300, a0: Math.PI * 0.62 },
  dunes: null, frost: null, ember: null, rift: null, // (filled in by world.js from the biome consts: no import cycles)
};
export const OPS_GATE_R = 110; // interact range of an entrance
/**
 * Place every biome's entrances: 5 mission types (+ its boss dungeon) round its camp, on walkable ground, clear of the
 * spawn sites, the spawners and each other. blocked(x, y, r) / biomeOf(x, y) come from the world (no import cycle).
 * Returns [{ id, biome, type ('defense'.. | 'boss'), dungeon?, x, y }].
 */
export function placeOpsGates(camps, sites, spawners, blocked, biomeOf, roadD = null) {
  const out = placeOpsGatesLegacy(camps, sites, spawners, blocked, biomeOf); // (the boss-dungeon entrances keep their old spots: same ids / order)
  if (roadD) for (const biome of OPS_BIOMES) spreadMissions(out, biome, camps[biome], sites, spawners, blocked, biomeOf, roadD);
  out.push({ id: out.length, biome: 'wilds', type: 'boss', dungeon: 'hollow', ...hollowGateSpot(out, sites, spawners, blocked, biomeOf) });
  return out;
}
/** the Glowmire Hollow's entrance: a clear spot in the Ashen Wilds (danger ring 3, Lv ~8-11), east of the Haven */
export const HOLLOW_GATE_AIM = { x: 3300, y: -900 };
function hollowGateSpot(out, sites, spawners, blocked, biomeOf) {
  const A = HOLLOW_GATE_AIM;
  for (let rr = 0; rr < 2600; rr += 60) for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2, x = Math.round(A.x + Math.cos(a) * rr), y = Math.round(A.y + Math.sin(a) * rr);
    if (blocked(x, y, 80) || blocked(x, y + 60, 50) || biomeOf(x, y) !== 'wilds') continue;
    if (sites.some((s) => (s.x - x) ** 2 + (s.y - y) ** 2 < 600 * 600)) continue;
    if (spawners.some((s) => (s.boss || s.elitePack) && (s.x - x) ** 2 + (s.y - y) ** 2 < 800 * 800)) continue;
    if (out.some((g) => (g.x - x) ** 2 + (g.y - y) ** 2 < 600 * 600)) continue;
    return { x, y };
  }
  return { x: A.x, y: A.y };
}
function placeOpsGatesLegacy(camps, sites, spawners, blocked, biomeOf) {
  const out = [];
  for (const biome of OPS_BIOMES) {
    const C = camps[biome]; if (!C) continue;
    const kinds = OPS_TYPES.map((t) => ({ type: t })); if (OPS_BIOME[biome].boss) kinds.push({ type: 'boss', dungeon: OPS_BIOME[biome].boss });
    const n = kinds.length;
    kinds.forEach((k, i) => {
      // wider fan + larger gate-to-gate gap so the big-map / minimap icons do not stack (polish 2026-10-06)
      const a0 = C.a0 + (i - (n - 1) / 2) * (k.type === 'boss' ? 0.7 : 0.72) + (k.type === 'boss' ? Math.PI : 0);
      let best = null;
      for (let pass = 0; pass < 5 && !best; pass++) {
        const siteGap = [820, 700, 600, 500, 420][pass], rMax = C.r + [900, 1200, 1600, 2000, 2500][pass], gateGap = [700, 620, 540, 460, 400][pass];
        for (let rr = C.r + (k.type === 'boss' ? 600 : 480); rr < rMax && !best; rr += 55) {
          for (const da of [0, 0.1, -0.1, 0.2, -0.2, 0.32, -0.32, 0.44, -0.44, 0.58, -0.58]) {
            const a = a0 + da, x = Math.round(C.x + Math.cos(a) * rr), y = Math.round(C.y + Math.sin(a) * rr);
            if (blocked(x, y, 70) || blocked(x, y + 60, 40) || biomeOf(x, y) !== biome) continue;
            if (sites.some((s) => (s.x - x) ** 2 + (s.y - y) ** 2 < siteGap * siteGap)) continue;
            if (spawners.some((s) => (s.boss || s.elitePack) && (s.x - x) ** 2 + (s.y - y) ** 2 < 900 * 900)) continue;
            if (out.some((g) => (g.x - x) ** 2 + (g.y - y) ** 2 < gateGap * gateGap)) continue;
            best = { x, y }; break;
          }
        }
      }
      if (!best) best = { x: Math.round(C.x + Math.cos(a0) * (C.r + 200)), y: Math.round(C.y + Math.sin(a0) * (C.r + 200)) }; // (never reached on the shipped seed: tests check)
      out.push({ id: out.length, biome, type: k.type, dungeon: k.dungeon || null, x: best.x, y: best.y });
    });
    // push same-biome entrances farther apart so the big-map icons read (keep walkable + in-biome)
    const mine = out.filter((g) => g.biome === biome);
    for (let iter = 0; iter < 8; iter++) {
      for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) {
        const a = mine[i], b = mine[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const want = (a.type === 'boss' || b.type === 'boss') ? 520 : 720;
        if (d >= want) continue;
        const push = (want - d) * 0.55, ux = dx / d, uy = dy / d;
        const tryMove = (g, sx, sy) => {
          const nx = Math.round(g.x + sx), ny = Math.round(g.y + sy);
          if (blocked(nx, ny, 70) || blocked(nx, ny + 60, 40) || biomeOf(nx, ny) !== biome) return false;
          if (sites.some((s) => (s.x - nx) ** 2 + (s.y - ny) ** 2 < 420 * 420)) return false;
          g.x = nx; g.y = ny; return true;
        };
        tryMove(a, -ux * push, -uy * push); tryMove(b, ux * push, uy * push);
      }
    }
  }
  return out;
}
/** the theme of each mission entrance (what the spread placement scores) */
export const OPS_THEME = {
  defense: 'a landmark (ruin / obelisk / cairn / grave) to hold', mobile: 'on a road between regions', assault: 'the edge of an elite-heavy area toward a world boss',
  capture: 'open ground', swarm: 'a dangerous outer area',
};
export const OPS_SPREAD = { campGap: 1800, siteGap: 520, bossGap: 1500, dungeonGap: 900, minGapK: 0.27, cell: 70 };
const siteBiome = (s) => (s.key && s.key[0] === 'w' ? 'wilds' : s.key);
/**
 * Spread pass (2026-10-07): the five mission entrances of a map go one per region across the whole map instead of
 * round the camp. A flood fill from the camp over walkable ground gives the reachable cells + walking distance; the
 * candidates keep clear of the camp, the spawn sites, the world bosses and the boss dungeon; then each type (swarm,
 * assault, defense, capture, mobile) greedily takes the best themed spot >= minGapK x the map's extent from the others.
 * Pure + deterministic (the same spots on every client / the server). Moves the gates in out[] in place.
 */
function spreadMissions(out, biome, C, sites, spawners, blocked, biomeOf, roadD) {
  if (!C) return;
  const P = OPS_SPREAD, cs = P.cell, mine = sites.filter((q) => siteBiome(q) === biome);
  if (!mine.length) return;
  let x0 = Math.min(...mine.map((q) => q.x)) - 2600, x1 = Math.max(...mine.map((q) => q.x)) + 2600, y0 = Math.min(...mine.map((q) => q.y)) - 2600, y1 = Math.max(...mine.map((q) => q.y)) + 2600;
  const W = Math.ceil((x1 - x0) / cs), H = Math.ceil((y1 - y0) / cs), dist = new Int32Array(W * H).fill(-1);
  const cx = (i) => x0 + (i + 0.5) * cs, cy = (j) => y0 + (j + 0.5) * cs;
  const free = (i, j) => { const x = cx(i), y = cy(j); return !blocked(x, y, 22) && (biomeOf(x, y) === biome || Math.hypot(x - C.x, y - C.y) < C.r + 700); }; // (the camp's safe zone itself is no biome)
  // flood from the free cell nearest the camp
  let si = Math.floor((C.x - x0) / cs), sj = Math.floor((C.y - y0) / cs), q = [];
  for (let r = 0; r < 12 && !q.length; r++) for (let dj = -r; dj <= r && !q.length; dj++) for (let di = -r; di <= r; di++) { const i = si + di, j = sj + dj; if (i >= 0 && j >= 0 && i < W && j < H && free(i, j)) { q.push(j * W + i); dist[j * W + i] = 0; break; } }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], i = k % W, j = (k / W) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue; const n = b * W + a; if (dist[n] >= 0 || !free(a, b)) continue; dist[n] = dist[k] + 1; q.push(n); }
  }
  let ex0 = 1e9, ex1 = -1e9, ey0 = 1e9, ey1 = -1e9, dmax = 1;
  for (const k of q) { const x = cx(k % W), y = cy((k / W) | 0); ex0 = Math.min(ex0, x); ex1 = Math.max(ex1, x); ey0 = Math.min(ey0, y); ey1 = Math.max(ey1, y); dmax = Math.max(dmax, dist[k]); }
  const ext = Math.max(ex1 - ex0, ey1 - ey0);
  const bosses = spawners.filter((s) => s.boss && biomeOf(s.x, s.y) === biome), dun = out.filter((g) => g.biome === biome && g.type === 'boss');
  const lms = mine.filter((s) => /ruin|obelisk|cairn|grave/.test(s.lm || ''));
  const near2 = (L, x, y, d) => L.some((s) => (s.x - x) ** 2 + (s.y - y) ** 2 < d * d);
  const cand = [];
  for (let h = 0, st = Math.max(1, Math.floor(q.length / 2500)); h < q.length; h += st) { // (a thinned pool: every 3rd reachable cell)
    const k = q[h], x = Math.round(cx(k % W)), y = Math.round(cy((k / W) | 0));
    if (biomeOf(x, y) !== biome || Math.hypot(x - C.x, y - C.y) < C.r + P.campGap || dist[k] > dmax * 0.92) continue;
    if (blocked(x, y, 90) || blocked(x, y + 60, 50)) continue;
    if (near2(mine, x, y, P.siteGap) || near2(bosses, x, y, P.bossGap) || near2(dun, x, y, P.dungeonGap)) continue;
    let open = 0; for (let a = 0; a < 12; a++) if (!blocked(x + Math.cos(a * 0.5236) * 340, y + Math.sin(a * 0.5236) * 340, 30)) open++;
    if (open < 7) continue; // room to fight round the entrance
    const lmD = Math.min(1e9, ...lms.map((s) => Math.hypot(s.x - x, s.y - y)));
    const elite = mine.reduce((t, s) => t + (Math.hypot(s.x - x, s.y - y) < 1700 ? (s.elites || 0) + (s.ring || 0) * 0.25 : 0), 0);
    const bossD = Math.min(1e9, ...bosses.map((s) => Math.hypot(s.x - x, s.y - y)));
    cand.push({ x, y, walk: dist[k] / dmax, far: Math.hypot(x - C.x, y - C.y), open: open / 12, road: roadD(biome, x, y), lmD, elite, bossD });
  }
  if (cand.length < 5) return; // (keeps the legacy spots: tests check this never happens on the shipped seed)
  const farMax = Math.max(...cand.map((c) => c.far)), eMax = Math.max(1, ...cand.map((c) => c.elite));
  const theme = {
    swarm: (c) => c.far / farMax + 0.3 * (1 - c.open),
    assault: (c) => c.elite / eMax + (c.bossD > 1800 && c.bossD < 3600 ? 0.6 : 0),
    defense: (c) => (c.lmD < 1100 ? 1 - Math.max(0, c.lmD - 600) / 500 : 0) + 0.2 * c.far / farMax,
    capture: (c) => c.open * 1.2 + 0.2 * (c.road > 400 ? 1 : 0),
    mobile: (c) => (c.road < 260 ? 1 : c.road < 600 ? 0.4 : 0) + 0.3 * (1 - Math.abs(c.far / farMax - 0.55)),
  };
  const order = ['swarm', 'assault', 'defense', 'capture', 'mobile'];
  for (let k = 1; k >= 0.6; k -= 0.1) {
    const gap = ext * P.minGapK * k, picked = {};
    for (const t of order) {
      let best = null, bs = -1e9;
      for (const c of cand) {
        const others = Object.values(picked); if (others.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < gap)) continue;
        const spread = others.length ? Math.min(...others.map((o) => Math.hypot(o.x - c.x, o.y - c.y))) / ext : 0.5;
        const sc = theme[t](c) + 0.8 * Math.min(spread, 0.5) - 0.25 * c.walk;
        if (sc > bs) { bs = sc; best = c; }
      }
      if (!best) break; picked[t] = best;
    }
    if (Object.keys(picked).length === 5) { for (const g of out) if (g.biome === biome && picked[g.type]) { g.x = picked[g.type].x; g.y = picked[g.type].y; } return; }
  }
}
export const gateName = (g) => (g.type === 'boss' ? BOSS_GATES[g.dungeon].name : OPS_TYPE[g.type].name);
export const gateCol = (g) => (g.type === 'boss' ? BOSS_GATES[g.dungeon].col : OPS_TYPE[g.type].col);

// ------------------------------------------------------------------ tuning (sim/ops.js)
/** Mission-boss HP: ONE table. HP = k x the mission's average elite (the data/mobhp.js level curve) x Iron Hide (+20%),
 *  per boss and per map. Tuned (tools/opsboss-fightlen.mjs, after the class-tune fix in data/tuning.js) so the typical solo
 *  fight at that map's on-level gear is ~2 min for every boss (the Assault champion, a mid-mission mini-boss: ~50 s).
 *  "typical" = the perfect bot's class-average time / 0.5. The Defense siege ramps on top by round (O.mul). */
export const OPS_BOSS_HP = {
  queen:  { wilds: 20.5, dunes: 21.5, frost: 19.5, ember: 27.5, rift: 29 }, // the Swarm Queen (after wave 8)
  siege:  { wilds: 16, dunes: 17, frost: 17, ember: 22.5, rift: 23.5 }, // the Defense siege boss (the final wave of each round)
  way:    { wilds: 18.5, dunes: 18.5, frost: 15, ember: 24.5, rift: 25.5 }, // the Mobile Defense boss (the final point)
  gk:     { wilds: 16, dunes: 20.5, frost: 16.5, ember: 23, rift: 24 }, // the Assault Gatekeeper
  quarry: { wilds: 19.5, dunes: 19, frost: 18, ember: 22, rift: 23 }, // the Capture target (cornered: the Hunter's Ring)
  champ:  { wilds: 5.5, dunes: 7.5, frost: 7, ember: 9, rift: 9.5 }, // the Assault champion (mini-boss, ~40-60 s)
};
/** the HP multiplier (x the mission's average elite) of mission boss `kind` on map `biome` */
export const opsBossHpK = (kind, biome) => (OPS_BOSS_HP[kind] && OPS_BOSS_HP[kind][biome]) || 1;
export const OPS = {
  // results beat (the grade screen; reward chests pop, the vacuum collects) before the trip home: OPS.results below
  defense: { waves: 5, relicHp: 100, shield: 30, shieldRegen: 6, shieldDelay: secs(4), regenRound: 25, choiceT: secs(25), padT: secs(1.5),
    fod: (w, r) => 12 + 4 * w + 6 * (r - 1), elites: (w, r) => (w === 3 ? 1 : w === 5 ? 1 : 0) + (w >= 3 ? r - 1 : 0), raiders: 0.5,
    dps: { fod: 1.0, elite: 3.0 }, roundMul: 0.15, waveT: secs(70), siegeSpeedK: 0.5, reach: 120,
    // revamp (2026-10-08): build phases, the relic's charge + pulse, wave modifiers, the final-wave siege
    buildT0: secs(16), buildT: secs(11), mat0: 30, matFod: 1, matElite: 6, matClean: 8,
    charge: { near: 260, perHero: 100 / secs(9), maxHeroes: 2, killFod: 2, killElite: 9, killR: 520, autoT: secs(8), actR: 330 },
    pulse: { r: 560, fod: 1.8, elite: 0.08, boss: 0.035, stun: secs(1.2), bossStun: secs(0.8), kb: 320, shield: 15, good: 5 },
    // structures: cost / upgrade cost; U = the mission's average fodder HP (on the level curve, x the round ramp)
    build: {
      turret: { name: 'Turret', cost: 25, up: 35, range: [500, 570], cd: [36, 22], dmg: [0.3, 0.42], desc: 'Shoots the nearest enemy (2 / s; Lv 2: 3 / s, longer reach).' },
      spike: { name: 'Spike Trap', cost: 15, up: 25, r: [90, 125], every: 30, dmg: [0.35, 0.55], slow: 45, slowMul: 0.5, desc: 'Spikes stab and slow everything on it.' },
      ward: { name: 'Ward', cost: 20, up: 30, r: [190, 240], every: [100, 80], dmg: [0.25, 0.4], slow: 90, slowMul: 0.4, desc: 'Pulses a wide slow (+ a little damage).' },
    },
    wmods: ['swift', 'armored', 'flank', 'escort', 'sappers'],
    siegeOff: secs(6) },
  // the Defense siege boss (final wave of every round): HP from OPS_BOSS_HP.siege (x the round ramp)
  siege: { dmg: 1.25, r: 56, spd: 48, cd: secs(2.4), cdEnr: secs(1.7), slamR: 230, slamWind: 66, offR: 290, bombN: 3, bombR: 100, bombWind: 80, bombRelic: 4,
    chargeLen: 520, chargeW: 110, chargeWind: 54, chargeRelic: 6, pound: secs(1.7), poundRelic: 5, enrage: 0.4 },
  // Mobile Defense (revamp part 2): the carrier escort. cart: speed (escorted), slowed by enemies round it, chipped by them;
  // 2 hack points (hold the ring: progress only with a hero in it; one JAM each = a hero reboots it), then the boss at the final point
  mobile: { cartHp: 100, cartR: 44, speed: 70, escortR: 360, slowR: 210, slowN: 3, slowK: 0.4, reach: 60, dps: { fod: 0.8, elite: 2.4, boss: 0 }, regen: 2.5, regenDelay: secs(4),
    hack: [secs(26), secs(32)], hackR: 270, hackEvery: secs(6.5), hackPack: (k) => 7 + 2 * k, hackElite: 0.4, jamAt: 0.6, rebootR: 170, jamHit: 4,
    trickle: secs(9), trickleN: (k) => 5 + k, ambushN: 9, ambushWind: secs(1.6), surgeT: secs(14),
    hunters: { n: 3, hpK: 1.35, capHpK: 3, volleyEvery: secs(4.6), volleyWind: 52, volleyLen: 640, volleyW: 74, mark: secs(9) },
    holeR: 250, bridgeWind: secs(2.2), crumbleEvery: secs(3.2), crumbleR: 110, crumbleWind: 72, crumbleMax: 8,
    integrity: 100, hold: secs(26), pickR: 60, ringR: 270 },
  // the Mobile Defense boss (the final point): HP from OPS_BOSS_HP.way
  way: { dmg: 1.2, r: 58, spd: 66, cd: secs(2.0), cdEnr: secs(1.45), enrage: 0.35, chargeLen: 620, chargeW: 120, chargeWind: 52, chargeCart: 8,
    quakeR: 220, quakeR2: 450, quakeWind: 58, quakeWind2: 98, drainT: secs(5.5), drainBreak: 0.035, drainDps: 3, drainEnd: 14, drainStun: secs(2.5), drainEvery: secs(14), callAt: [0.62, 0.3], callN: 6 },
  // Assault (revamp part 2): pylons (shield the first gate; they shoot) -> the trap hall -> the champion -> the Gatekeeper
  assault: { pylonHp: 1.3, pylonEvery: secs(2.6), pylonR: 700, pylonShot: 0.75, guards: [[8, 1], [7, 0]], packs: [[14, 1], [12, 1], [14, 2]], packsPer: [2, 2, 3],
    trapWind: 66, trapPct: 0.09, trapFoe: 0.14, trapNear: 900,
    champDmg: 1.15, champR: 44, hall: [[10, 0]],
    bossDmg: 1.2, adds: 7 },
  champ: { cd: secs(1.7), cdEnr: secs(1.25), enrage: 0.5, cleaveR: 210, cleaveArc: 2.1, cleaveWind: 40, leapR: 150, leapWind: 58, whirlR: 175, whirlN: 3, whirlEvery: 22, cryAt: 0.5, cryN: 4, spd: 84 },
  gk: { r: 62, spd: 56, cd: secs(1.9), cdEnr: secs(1.4), enrage: 0.35, smashR: 150, smashWind: 46, smashGap: 26, quakeStep: 190, quakeN: 3, quakeWind: 50, quakeGap: 24,
    sweepN: 6, sweepArc: 2.4, sweepLen: 640, sweepW: 80, sweepWind: 50, sweepGap: 12, runeLen: 760, runeW: 84, runeWind: 62, runeGap: 46, chargeLen: 600, chargeW: 120, chargeWind: 50, addsAt: [0.66, 0.33] },
  // Capture (revamp part 3): TRACK (3 clues, footprints) -> CHASE (the quarry flees between clearings: snares, guards,
  // decoys; nets + broken rigs + damage fill the PIN meter; the escape clock) -> CORNERED (a real fight in the Hunter's Ring)
  capture: { clueR: 150, examT: secs(1.4), clueGuards: [[5, 0], [5, 1], [6, 1]], clueSnares: 3,
    dmg: 1.15, r: 40, flee: 0.86, fleeR: 720, restR: 1050, blinkR: 300, blinkEvery: secs(9), blinkNear: 150,
    escapeT: secs(100), rigBonus: secs(12), rigHp: 1.6, boltK: 0.95, exitR: 80,
    snareEvery: secs(2.4), snareMax: 14, snareLife: secs(40), snareArm: secs(0.8), snareR: 95, snareTrig: 52, snareWind: 20,
    guardsEvery: secs(13), guardsN: 4, decoyEvery: secs(17), decoyN: 2, decoyHp: 0.035, decoyLife: secs(20),
    nets0: 1, netsMax: 2, netR: 520, netT: secs(2.6), netFightT: secs(1.6), crateR: 64, crateT: secs(25),
    pin: { net: 30, rig: 20, dmg: 1, dmgMax: 50 }, prints: 18, printEvery: 9,
    ringR: 470, enrage: 0.35, cd: secs(1.8), cdEnr: secs(1.3), spd: 92, addsAt: [0.66, 0.33], adds: 5,
    dashLen: 560, dashW: 96, dashWind: 46, tossN: 4, tossR: 105, tossWind: 58, fanN: 5, fanArc: 0.9, fanLen: 600, fanW: 54, fanWind: 46,
    ringTrapR0: 150, ringTrapR: 420, ringTrapWind: 70, smokeEvery: secs(16), smokeDecoys: 2 },
    swarm: { waves: 8, n: (w) => 14 + 6 * w, elites: (w) => (w >= 3 ? Math.floor((w - 1) / 2) : 0), burst: (w) => 8 + w, cap: (w) => 26 + 3 * w, burstEvery: secs(2.2),
    brk: secs(5), mulPerWave: 0.06, lives: 3,
    safe: [1000, 1000, 1000, 870, 870, 750, 750, 640, 640, 560], shrinkT: secs(7), outEvery: 30, outPct: 0.03,
    combo: { window: secs(4), tiers: [10, 25, 50, 100], mul: [1.25, 1.5, 1.75, 2], showerEvery: 6, showerFrom: 1 },
    surge: [4, 6], trickle: secs(7), trickleN: 5 },
  // the Swarm Queen (after wave 8): HP from OPS_BOSS_HP.queen
  queen: { dmg: 1.2, r: 60, spd: 70, cd: secs(1.9), cdEnr: secs(1.35), enrage: 0.35, screechAt: 0.6,
    eggs: 3, eggHp: 2.5, hatch: secs(6), brood: 4, acidN: 5, acidR: 95, acidWind: 66, pounceLen: 560, pounceW: 120, pounceWind: 48,
    screechR0: 150, screechR: 430, screechWind: 84 },
  results: secs(11),
};
export const SWARM_TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond']; // (pre-revamp tiers: kept for old saves / tools)
/** the Defense wave modifiers (waves 2-4 roll one each; wave 5 is the siege) */
export const WAVE_MODS = {
  swift: { name: 'Swift', desc: 'enemies +25% speed', col: '#6ee7ff' },
  armored: { name: 'Armored', desc: 'enemies +35% HP', col: '#c8d0e0' },
  flank: { name: 'Flanking', desc: 'three breaches at once', col: '#ff9a4c' },
  escort: { name: 'Elite Escort', desc: '+2 elites', col: '#ffcf3a' },
  sappers: { name: 'Sappers', desc: 'raiders hit the relic x2.5', col: '#ff5e5b' },
  siege: { name: 'Siege', desc: 'the siege boss attacks', col: '#ff3b6b' },
};
