// Emberdeep Caldera (biome 4) + the Forge of Cinders (its Normal dungeon): pure geometry (only mapshape.js), so
// constants.js / world.js / the renderer / the prediction sim can use it without import cycles.
// Emberdeep is a broken volcanic caldera far east of the Astral Sanctum: the safe Cinderwatch Outpost sits on the
// south-west shore, Danger 4 -> 7 climbs east toward Pyrrhex, the Caldera Heart, in the crater. Glowing LAVA RIVERS run
// out of the crater (they burn: cross on the basalt bridges where the roads meet them) and STEAM VENTS erupt on a
// rhythm. A north-west glassworks and an east sundial plateau each hold a world boss.
// The Forge of Cinders is a chain of foundry halls east of the caldera: three wave halls and Hephast's conveyor foundry.
import { makeLand, wind, crossings } from './mapshape.js';

export const EMBER_C = { x: 32000, y: 0 };
export const EMBER_RR = 5200;
/** danger thresholds on the effective-radius scale (the outpost is a plain circle) */
export const EMBER_RINGS = [340, 1700, 2900, 4000, EMBER_RR];
export const EMBER_NAME = 'Emberdeep Caldera';
export const EMBER_SEED = 20261005;
const ex = (x) => x + EMBER_C.x; // (the layout below is written relative to EMBER_C)
const L = (x, y, a, b, r) => [ex(x), y, a, b, r];
export const EMBER_SHAPE = makeLand({
  cx: EMBER_C.x, cy: EMBER_C.y, R: EMBER_RR, cell: 60, blend: 900, noise: 200, warp: 380, nseed: 97, shore: 70, // (the cooled basalt shelf: client/emberfx.js)
  lobes: [
    L(-6000, 2300, 1900, 1250, 10),   // Cinderwatch shore (the outpost, south-west)
    L(-4100, 100, 2600, 1800, -8),    // the Ashfall Flats (west)
    L(-2300, -2800, 2400, 1500, 20),  // the Basalt Wastes (north-west)
    L(1200, -400, 3000, 2500, 0),     // the Caldera (centre): Pyrrhex in the crater
    L(5200, 500, 2400, 1500, -15),    // the Magma Rift (east)
    L(-1200, 2800, 2500, 1100, 5),    // the Obsidian Coast (south)
    L(8300, -600, 1650, 1300, 20),    // the Sundial plateau (far east): Solgrim
    L(-5300, -3500, 1550, 1250, -25), // the Glassworks (far north-west): Vitrea
    L(3700, 2900, 1700, 1000, -10),   // the Sulphur Shelf (south-east)
    L(6500, -500, 1200, 850, 0),      // the sundial approach
    L(-4000, -1900, 1100, 800, 30),   // the glassworks road
  ],
  bays: [L(-3000, 3500, 900, 600, 0), L(3200, -3300, 900, 700, 0), L(6800, 2100, 800, 700, 0), L(-6900, -1400, 700, 650, 0), L(1600, 3500, 800, 500, 0)],
  // danger seeds [x, y, D(1..4.6), weight]
  seeds: [
    [ex(-6000), 2500, 1, 3], [ex(-5000), 1800, 1.25, 2], [ex(-6400), 800, 1.4], [ex(-4300), 2700, 1.35],
    [ex(-3700), 600, 1.8], [ex(-2600), 1700, 1.9], [ex(-1300), 2800, 2.0], [ex(400), 2900, 2.2], [ex(2200), 2900, 2.4], [ex(3800), 3000, 2.6],
    [ex(-4600), -1300, 2.1], [ex(-5300), -2800, 2.35], [ex(-5500), -3700, 2.45], [ex(-2600), -2400, 2.6], [ex(-1600), -3400, 2.9],
    [ex(-1200), -300, 2.6], [ex(400), 1100, 2.8], [ex(2600), 1200, 3.0], [ex(-200), -1800, 3.2],
    [ex(4000), 200, 3.1], [ex(5600), 800, 3.25], [ex(6600), -500, 3.3], [ex(8300), -600, 3.35], [ex(8800), 300, 3.2],
    [ex(1300), -600, 4.6, 1.8], [ex(800), -1500, 4.0], [ex(2200), -300, 4.0], [ex(1000), 400, 3.9], [ex(2000), -1500, 3.9],
  ],
  knots: [[1, 900], [1.5, 1700], [2.5, 2900], [3.5, 4000], [4.5, 5100]],
});
export const EMBER_SITES = {
  pyrrhex: { x: ex(1300), y: -650, r: 400 },   // the Caldera Heart (Danger 7)
  solgrim: { x: ex(8400), y: -600, r: 380 },   // the Sundial plateau (Danger 6)
  vitrea: { x: ex(-5400), y: -3600, r: 360 },  // the Glassworks (Danger 5)
  falls: { x: ex(-2400), y: -1200, r: 170 },   // the Brimstone Falls (a lavafall)
  skull: { x: ex(3600), y: 2500, r: 170 },     // the Dragon's Jaw (a fossil skull)
  shrine: { x: ex(-3800), y: 1500, r: 130 },   // the Ember Shrine
  obelisk: { x: ex(4300), y: -1200, r: 140 },  // the Obsidian Obelisk
};
export const emberSite = (k) => { const s = EMBER_SITES[k]; return { x: s.x, y: s.y, r: s.r }; };
export const EMBER_CAMP = { x: ex(-6000), y: 2500 };
export const EMBER_CAMP_R = EMBER_RINGS[0];
/** where arrivals stand (by the outpost's beacon) */
export const EMBER_SPAWN = { x: EMBER_CAMP.x, y: EMBER_CAMP.y + 120 };
const RP = [
  [[-5850, 2400], [-4400, 1800], [-3000, 1150], [-1500, 650], [-200, 100], [850, -400]],          // east along the flats into the crater
  [[-6100, 2250], [-5700, 800], [-5200, -700], [-5050, -2200], [-5250, -3200]],                   // north to the glassworks
  [[1850, -500], [3300, -300], [4800, -100], [6300, -350], [7950, -550]],                         // out of the crater east to the sundial
  [[-3000, 1150], [-1600, 2450], [400, 2850], [2300, 2850], [3550, 2700]],                        // the obsidian coast path
  [[-5200, -700], [-3700, -1700], [-2300, -2600], [-900, -2100], [400, -1250]],                   // across the basalt wastes to the crater rim
  [[3300, -300], [3900, -800], [4200, -1050]],                                                   // to the obelisk
].map((c) => c.map(([x, y]) => [ex(x), y]));
export const EMBER_ROADS = RP.map((c, i) => wind(c, 150, 91 + i * 7));
EMBER_SHAPE.carve(EMBER_ROADS); // (map fix: land under every road)
/** lava rivers out of the crater (they burn: cross on the basalt bridges where a road meets them) */
export const LAVA_W = 120;
export const EMBER_LAVA = [
  [[1000, -200], [-300, 800], [-1500, 1800], [-2100, 3300]],
  [[2300, -100], [3700, 400], [5100, 800], [6300, 1700]],
  [[700, -1700], [-500, -2500], [-1900, -3400]],
  [[5000, 900], [4500, 2000], [3900, 3300]],
  [[-2400, -1150], [-3300, -500], [-4300, -200], [-5600, 100]],
  [[-700, -1300], [-1250, 0], [-1100, 1300], [-600, 2000]],
].map((c, i) => wind(c.map(([x, y]) => [ex(x), y]), 200, 701 + i * 13, 200));
export const EMBER_BRIDGES = EMBER_LAVA.flatMap((lv) => EMBER_ROADS.flatMap((r) => crossings(lv, r)));
/** basalt ridges between the regions (roads punch gaps) */
export const EMBER_CLIFFS = [
  [[-1600, -1700], [-900, -2900], [-1300, -3700]],
  [[3000, -1800], [3200, -2700], [2600, -3300]],
  [[-2600, 2200], [-3100, 600], [-2700, -500]],
  [[2900, 2200], [3300, 1300], [3900, 1100]],
  [[-6200, -500], [-6500, 1000]],
  [[6000, -1800], [6400, -1000], [6100, 900]],
  [[-4100, -2900], [-4700, -2300]],
].map((c, i) => wind(c.map(([x, y]) => [ex(x), y]), 120, 801 + i * 11, 170));
export const EMBER_WALLS = { rings: [], spurs: [], chains: EMBER_CLIFFS };
/** steam vents: fixed geysers that erupt on a rhythm (sim/ember.js); [x, y, period (ticks), phase] */
export const EMBER_VENTS = [
  [-4600, 900], [-3300, -200], [-2000, 2200], [-500, 2500], [1300, 2400], [2700, 1900], [-3000, -3000], [-1500, -2600],
  [-5600, -2400], [-4700, -3000], [3900, -600], [5300, -400], [6000, 1200], [7200, -900], [8900, 200], [2700, -1500],
  [100, -2400], [-200, 600], [2400, 700], [4700, 2400], [-4500, -1300], [5600, 1900],
].map(([x, y], i) => ({ x: ex(x), y, r: 105, period: 300 + (i * 37) % 160, ph: (i * 97) % 300 }));
/** elite packs (fixed camps, every member an elite) */
export const EMBER_ELITES = [
  { x: ex(-4600), y: 1900, danger: 4, group: ['kindler', 'kindler', 'kindler', 'basalt'] },
  { x: ex(-3300), y: 2600, danger: 4, group: ['moth', 'moth', 'kindler', 'kindler'] },
  { x: ex(-5000), y: -1500, danger: 5, group: ['mortar', 'basalt', 'kindler', 'kindler'] },
  { x: ex(-3100), y: -900, danger: 5, group: ['lavaeel', 'lavaeel', 'moth'] },
  { x: ex(1200), y: 2300, danger: 5, group: ['basalt', 'basalt', 'mortar'] },
  { x: ex(-2300), y: -3300, danger: 6, group: ['moth', 'moth', 'moth', 'mortar', 'mortar'] },
  { x: ex(4400), y: 1300, danger: 6, group: ['lavaeel', 'basalt', 'basalt', 'kindler'] },
  { x: ex(7000), y: 300, danger: 6, group: ['kindler', 'kindler', 'kindler', 'kindler', 'kindler', 'mortar'] },
  { x: ex(2300), y: -1700, danger: 7, group: ['basalt', 'lavaeel', 'lavaeel', 'mortar', 'moth'] },
  { x: ex(-100), y: -800, danger: 7, group: ['mortar', 'mortar', 'basalt', 'basalt', 'moth'] },
];
/** Danger regions. id 0 = safe (enemies ignore you there). tier = loot tier. */
export const EMBER_ZONES = [
  { id: 0, name: 'Cinderwatch Outpost', danger: 0, r0: 0, r1: EMBER_RINGS[0], tier: 0, ember: true },
  { id: 61, name: 'Ashfall Flats', danger: 4, r0: EMBER_RINGS[0], r1: EMBER_RINGS[1], tier: 5, ember: true },
  { id: 62, name: 'Basalt Wastes', danger: 5, r0: EMBER_RINGS[1], r1: EMBER_RINGS[2], tier: 6, ember: true },
  { id: 63, name: 'The Magma Rift', danger: 6, r0: EMBER_RINGS[2], r1: EMBER_RINGS[3], tier: 6, ember: true },
  { id: 64, name: 'The Caldera Heart', danger: 7, r0: EMBER_RINGS[3], r1: EMBER_RR, tier: 6, ember: true },
];
export const EMBER_BOUNDS = EMBER_SHAPE.bounds;
export const inEmberArea = (x, y, pad = 260) => x > EMBER_BOUNDS.x0 - 400 && x < EMBER_BOUNDS.x1 + 400 && EMBER_SHAPE.inside(x, y, pad);
export function emberZoneAt(x, y) {
  if (Math.hypot(x - EMBER_CAMP.x, y - EMBER_CAMP.y) < EMBER_CAMP_R) return EMBER_ZONES[0];
  const d = EMBER_SHAPE.re(x, y);
  for (let i = 1; i < EMBER_ZONES.length; i++) if (d < EMBER_ZONES[i].r1) return EMBER_ZONES[i];
  return EMBER_ZONES[EMBER_ZONES.length - 1];
}
/** keep an ordinary Emberdeep enemy out of the outpost (the safe ring) */
export function outpostPush(e) {
  const dx = e.x - EMBER_CAMP.x, dy = e.y - EMBER_CAMP.y, d = Math.hypot(dx, dy), m = EMBER_CAMP_R + e.r;
  if (d < m) { const k = m / (d || 1); e.x = EMBER_CAMP.x + dx * k; e.y = EMBER_CAMP.y + dy * k; }
}
// ---- lava: a coarse bucket grid of the river segments (players test it every few ticks; the renderer bakes it)
const LG = 400, lavaGrid = new Map();
EMBER_LAVA.forEach((lv) => { for (let i = 1; i < lv.length; i++) { const a = lv[i - 1], b = lv[i]; const x0 = Math.floor((Math.min(a.x, b.x) - LAVA_W) / LG), x1 = Math.floor((Math.max(a.x, b.x) + LAVA_W) / LG), y0 = Math.floor((Math.min(a.y, b.y) - LAVA_W) / LG), y1 = Math.floor((Math.max(a.y, b.y) + LAVA_W) / LG); for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const k = gx + ',' + gy; let l = lavaGrid.get(k); if (!l) lavaGrid.set(k, (l = [])); l.push([a.x, a.y, b.x, b.y]); } } });
function segD(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0; return Math.hypot(px - ax - dx * t, py - ay - dy * t); }
/** distance from (x, y) to the nearest lava river centre line (Infinity when far) */
export function lavaDist(x, y) {
  const l = lavaGrid.get(Math.floor(x / LG) + ',' + Math.floor(y / LG)); if (!l) return Infinity;
  let d = Infinity; for (const s of l) { const q = segD(x, y, s[0], s[1], s[2], s[3]); if (q < d) d = q; } return d;
}
export const bridgeAt = (x, y, pad = 0) => EMBER_BRIDGES.some((b) => Math.hypot(x - b.x, y - b.y) < 120 + pad);
/** standing in molten lava (not on a basalt bridge)? */
export const inLava = (x, y, r = 0) => x > EMBER_BOUNDS.x0 && lavaDist(x, y) < LAVA_W / 2 - r * 0.3 && !bridgeAt(x, y);

// ------------------------------------------------------------------ the Forge of Cinders
export const FORGE_NAME = 'The Forge of Cinders';
export const FORGE_X = 50000;
export const FORGE_ROOM_R = 440;
/** Hephast's foundry floor: COLS x LANES conveyor cells of size FT; each lane is a belt */
export const FOUNDRY_COLS = 10, FOUNDRY_LANES = 6, FT = 110;
export const FORGE_ROOMS = [
  { x: FORGE_X, y: -2600, r: FORGE_ROOM_R, name: 'The Bellows Hall' },
  { x: FORGE_X, y: -1350, r: FORGE_ROOM_R, name: 'The Slag Pits' },
  { x: FORGE_X, y: -100, r: FORGE_ROOM_R, name: 'The Anvil Gallery' },
  { x: FORGE_X, y: 1500, r: 700, name: 'The Cinder Foundry', foundry: 1 },
];
export const FOUNDRY = FORGE_ROOMS[3];
export const FHW = (FOUNDRY_COLS / 2) * FT, FHH = (FOUNDRY_LANES / 2) * FT; // half width / height of the floor
export const FORGE_BOUNDS = { x0: FORGE_X - 1000, x1: FORGE_X + 1000, y0: -3300, y1: 2400 };
export const inForgeArea = (x, y, pad = 240) => x > FORGE_BOUNDS.x0 && x < FORGE_BOUNDS.x1 && y > FORGE_BOUNDS.y0 && y < FORGE_BOUNDS.y1 && forgeRoomAt(x, y, pad) >= 0;
export function forgeRoomAt(x, y, pad = 0) {
  for (let i = 0; i < FORGE_ROOMS.length; i++) {
    const R = FORGE_ROOMS[i];
    if (R.foundry ? Math.abs(x - R.x) < FHW + 60 + pad && Math.abs(y - R.y) < FHH + 60 + pad : Math.hypot(x - R.x, y - R.y) < R.r + pad) return i;
  }
  return -1;
}
/** the conveyor cell (col, lane) under a point, or null off the floor */
export function cellAt(x, y) {
  const i = Math.floor((x - FOUNDRY.x + FHW) / FT), j = Math.floor((y - FOUNDRY.y + FHH) / FT);
  return i < 0 || j < 0 || i >= FOUNDRY_COLS || j >= FOUNDRY_LANES ? null : [i, j];
}
export const cellCentre = (i, j) => ({ x: FOUNDRY.x - FHW + (i + 0.5) * FT, y: FOUNDRY.y - FHH + (j + 0.5) * FT });
export const forgeEntry = (i) => { const R = FORGE_ROOMS[i]; return R.foundry ? { x: R.x, y: R.y + FHH - 40 } : { x: R.x, y: R.y + R.r - 70 }; };
export const forgeDoor = (i) => { const R = FORGE_ROOMS[i]; return R.foundry ? { x: R.x, y: R.y + FHH - 40 } : { x: R.x, y: R.y - R.r + 52 }; };
/** keep a circle inside its forge hall (the foundry is the rectangular conveyor floor); true if moved */
/** the foundry's live floor state (phase 3 narrows it): set by sim/forge.js, or from the snapshot on co-op clients */
export const FORGE_STATE = { shrink: 0 };
export function clampForge(e, shrink = FORGE_STATE.shrink) {
  const i = Math.max(0, forgeRoomAt(e.x, e.y, 260)), R = FORGE_ROOMS[i], r = e.r || 0;
  if (R.foundry) {
    const hw = FHW - shrink * FT - r, hh = FHH - r; let hit = false;
    if (e.x < R.x - hw) { e.x = R.x - hw; hit = true; } if (e.x > R.x + hw) { e.x = R.x + hw; hit = true; }
    if (e.y < R.y - hh) { e.y = R.y - hh; hit = true; } if (e.y > R.y + hh) { e.y = R.y + hh; hit = true; }
    return hit;
  }
  const dx = e.x - R.x, dy = e.y - R.y, d = Math.hypot(dx, dy), m = R.r - r;
  if (d > m) { const k = m / d; e.x = R.x + dx * k; e.y = R.y + dy * k; return true; }
  return false;
}
export function forgeBlocked(x, y, r = 0) {
  const i = Math.max(0, forgeRoomAt(x, y, 260)), R = FORGE_ROOMS[i];
  if (R.foundry) return Math.abs(x - R.x) > FHW + 40 - r || Math.abs(y - R.y) > FHH + 40 - r;
  return Math.hypot(x - R.x, y - R.y) > R.r + 60 - r;
}
