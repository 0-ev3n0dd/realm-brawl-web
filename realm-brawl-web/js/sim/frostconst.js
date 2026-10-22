// Frostveil Peaks (biome 3) + the Glacier Crypt (its Normal dungeon): pure geometry (only mapshape.js, itself pure), so
// constants.js / world.js / the renderer / the prediction sim can all use it without import cycles.
// Frostveil is a long east-west mountain range far south of the Wilds (RotMG-style: the safe Hearthstone Camp on the south
// shore, Danger 4 -> 7 climbing toward Skaldra's summit in the north; a west fjord-taiga and an east glacier spur each
// hold a world boss). The Glacier Crypt is a chain of frozen vaults east of the range: three wave vaults (south -> north)
// and the Rimeking's chessboard sanctum.
import { makeLand, wind } from './mapshape.js';

export const FROST_C = { x: 0, y: 20000 };
export const FROST_RR = 5200;
/** danger thresholds on the effective-radius scale (the camp is a plain circle) */
export const FROST_RINGS = [340, 1700, 2900, 4000, FROST_RR];
export const FROST_NAME = 'Frostveil Peaks';
export const FROST_SEED = 20261004;
const fy = (y) => y + FROST_C.y; // (the layout below is written relative to FROST_C)
const L = (x, y, a, b, r) => [x, fy(y), a, b, r];
export const FROST_SHAPE = makeLand({
  cx: FROST_C.x, cy: FROST_C.y, R: FROST_RR, cell: 60, blend: 950, noise: 180, warp: 360, nseed: 83, shore: 44, // (the ice shelf: client/frostfx.js)
  lobes: [
    L(0, 2500, 2400, 1300, 0),        // Rimeshore: the south shore + Hearthstone Camp
    L(0, -300, 3200, 2150, 0),        // the central massif
    L(500, -3300, 1700, 1400, 8),     // Skaldra's Crown (the summit, north)
    L(-4700, 900, 2450, 1600, 14),    // the Pinegloom taiga (west)
    L(-7900, -200, 1700, 1250, -18),  // the Hollow Fjord (far west): Morwen's snow globe
    L(4800, -900, 2550, 1550, -14),   // the Shardglass glacier (east)
    L(8100, 500, 1650, 1250, 22),     // the Icefall spur (far east): Vyrnhal's echo hall
    L(4300, 2400, 1700, 950, 8),      // the Frostbite coast (south-east)
    L(-3600, -2500, 1300, 900, 30),   // the Titan's Ribs (north-west)
    L(3300, 900, 1300, 900, -20),     // the Frozen Falls saddle
    L(6300, 300, 1200, 800, 0),       // the icefall approach
  ],
  bays: [L(-2300, 3300, 900, 600, 0), L(2200, -3900, 800, 700, 0), L(6600, 2300, 800, 700, 0), L(-6300, -1900, 700, 700, 0)],
  // danger seeds [x, y, D(1..4.6), weight]
  seeds: [
    [0, fy(3000), 1, 3], [0, fy(1900), 1.25, 2], [-1500, fy(2400), 1.3], [1600, fy(2300), 1.3],
    [-3600, fy(1500), 1.9], [-4900, fy(700), 2.2], [-6000, fy(1200), 2.4], [-7600, fy(-100), 2.4], [-8600, fy(400), 2.45],
    [-3300, fy(-2300), 3.0], [-4000, fy(-2900), 3.75], [-2100, fy(-600), 2.4],
    [3500, fy(2400), 1.8], [5000, fy(2300), 2.2], [3600, fy(-300), 2.4], [5200, fy(-1200), 3.0], [6500, fy(-800), 3.3],
    [7700, fy(-300), 3.1], [8700, fy(800), 3.25], [8300, fy(1500), 3.15],
    [0, fy(-700), 2.3], [500, fy(-1900), 3.0], [600, fy(-3000), 3.9], [600, fy(-4100), 4.6, 1.6], [-600, fy(-3400), 3.8], [1800, fy(-3100), 3.8],
  ],
  knots: [[1, 900], [1.5, 1700], [2.5, 2900], [3.5, 4000], [4.5, 5100]],
});
export const FROST_SITES = {
  skaldra: { x: 550, y: fy(-3950), r: 380 },   // the summit (Danger 7)
  vyrnhal: { x: 8350, y: fy(650), r: 360 },    // the Icefall spur (Danger 6)
  morwen: { x: -8050, y: fy(-150), r: 360 },   // the Hollow Fjord (Danger 5)
  falls: { x: 3300, y: fy(1000), r: 170 },     // the Frozen Falls
  ribs: { x: -3500, y: fy(-2350), r: 170 },    // the Titan's Ribs (a giant's frozen skeleton)
  shrine: { x: -1500, y: fy(800), r: 130 },    // the Moonwell shrine
  spire: { x: 4300, y: fy(-1700), r: 140 },    // the Shardglass Spire
};
export const frostSite = (k) => { const s = FROST_SITES[k]; return { x: s.x, y: s.y, r: s.r }; };
export const FROST_CAMP = { x: 0, y: fy(3000) };
export const FROST_CAMP_R = FROST_RINGS[0];
/** where arrivals stand (by the camp's hearth) */
export const FROST_SPAWN = { x: FROST_CAMP.x, y: FROST_CAMP.y + 120 };
const RP = [
  [[0, 2850], [300, 1700], [-300, 600], [350, -700], [100, -1900], [600, -2800], [550, -3480]],   // north up the massif to the summit
  [[-150, 2950], [-1300, 2500], [-2500, 1700], [-3900, 1300], [-5300, 700], [-6500, 300], [-7600, -50]], // west through the taiga to the fjord
  [[150, 2950], [1500, 2500], [2700, 1700], [3800, 900], [5100, 300], [6500, 200], [7900, 550]],   // east past the falls to the icefall
  [[-300, 600], [-1500, 200], [-2400, -900], [-3100, -1800]],                                      // to the Titan's Ribs
  [[350, -700], [1700, -800], [3000, -1200], [4100, -1500]],                                       // across the glacier to the spire
  [[2700, 1700], [3600, 2300], [4700, 2500]],                                                      // the Frostbite coast path
].map((c) => c.map(([x, y]) => [x, fy(y)]));
export const FROST_ROADS = RP.map((c, i) => wind(c, 150, 81 + i * 7));
FROST_SHAPE.carve(FROST_ROADS); // (map fix: land under every road)
/** ice ridges between the regions (roads punch gaps) */
export const FROST_CLIFFS = [
  [[-1700, -1500], [-1200, -2600], [-1700, -3500]],
  [[1900, -1700], [2300, -2600], [1700, -3500]],
  [[-2600, 2100], [-3300, 300], [-2900, -700]],
  [[2200, 2300], [2700, 300], [3500, -300]],
  [[-5900, -700], [-6300, 1300], [-5700, 2200]],
  [[6000, -2000], [6500, -300], [6200, 1500]],
  [[-4300, -1300], [-5100, -1900]],
].map((c, i) => wind(c.map(([x, y]) => [x, fy(y)]), 120, 501 + i * 11, 170));
export const FROST_WALLS = { rings: [], spurs: [], chains: FROST_CLIFFS };
/** elite packs (fixed camps, every member an elite) */
export const FROST_ELITES = [
  { x: -2300, y: fy(2100), danger: 4, group: ['penguin', 'penguin', 'penguin', 'yeti'] },
  { x: 2400, y: fy(2000), danger: 4, group: ['yeti', 'shardwisp', 'shardwisp'] },
  { x: -4800, y: fy(1500), danger: 5, group: ['rimewraith', 'rimewraith', 'penguin', 'penguin'] },
  { x: 4500, y: fy(1700), danger: 5, group: ['yeti', 'yeti', 'penguin'] },
  { x: -1600, y: fy(-1100), danger: 5, group: ['shardwisp', 'shardwisp', 'shardwisp', 'rimewraith'] },
  { x: 5300, y: fy(-700), danger: 6, group: ['rimewraith', 'rimewraith', 'shardwisp', 'yeti'] },
  { x: -7000, y: fy(900), danger: 5, group: ['yeti', 'yeti', 'rimewraith', 'rimewraith'] },
  { x: 7200, y: fy(-400), danger: 6, group: ['penguin', 'penguin', 'penguin', 'penguin', 'penguin', 'shardwisp'] },
  { x: -3800, y: fy(-2900), danger: 7, group: ['yeti', 'rimewraith', 'rimewraith', 'shardwisp', 'shardwisp'] },
  { x: 1500, y: fy(-3000), danger: 7, group: ['rimewraith', 'rimewraith', 'rimewraith', 'yeti', 'yeti'] },
];
/** Rings from the camp outward. id 0 = safe (enemies ignore you there). tier = loot tier. */
export const FROST_ZONES = [
  { id: 0, name: 'Hearthstone Camp', danger: 0, r0: 0, r1: FROST_RINGS[0], tier: 0, frost: true },
  { id: 41, name: 'Rimeshore Tundra', danger: 4, r0: FROST_RINGS[0], r1: FROST_RINGS[1], tier: 5, frost: true },
  { id: 42, name: 'Pinegloom Taiga', danger: 5, r0: FROST_RINGS[1], r1: FROST_RINGS[2], tier: 5, frost: true },
  { id: 43, name: 'Shardglass Glacier', danger: 6, r0: FROST_RINGS[2], r1: FROST_RINGS[3], tier: 5, frost: true },
  { id: 44, name: "Skaldra's Crown", danger: 7, r0: FROST_RINGS[3], r1: FROST_RR, tier: 5, frost: true },
];
export const FROST_BOUNDS = FROST_SHAPE.bounds;
export const inFrostArea = (x, y, pad = 260) => y > FROST_BOUNDS.y0 - 400 && FROST_SHAPE.inside(x, y, pad);
export function frostZoneAt(x, y) {
  if (Math.hypot(x - FROST_CAMP.x, y - FROST_CAMP.y) < FROST_CAMP_R) return FROST_ZONES[0];
  const d = FROST_SHAPE.re(x, y);
  for (let i = 1; i < FROST_ZONES.length; i++) if (d < FROST_ZONES[i].r1) return FROST_ZONES[i];
  return FROST_ZONES[FROST_ZONES.length - 1];
}
/** keep an ordinary Frostveil enemy out of the camp (the safe ring) */
export function campPush(e) {
  const dx = e.x - FROST_CAMP.x, dy = e.y - FROST_CAMP.y, d = Math.hypot(dx, dy), m = FROST_CAMP_R + e.r;
  if (d < m) { const k = m / (d || 1); e.x = FROST_CAMP.x + dx * k; e.y = FROST_CAMP.y + dy * k; }
}

// ------------------------------------------------------------------ the Glacier Crypt
export const CRYPT_NAME = 'The Glacier Crypt';
export const CRYPT_X = 16500;
export const CRYPT_ROOM_R = 440;
/** the Rimeking's chessboard: n x n ice tiles of size T centred on the sanctum */
export const BOARD_N = 8, BOARD_T = 110;
export const CRYPT_ROOMS = [
  { x: CRYPT_X, y: 14200, r: CRYPT_ROOM_R, name: 'Hall of Hoarfrost' },
  { x: CRYPT_X, y: 15450, r: CRYPT_ROOM_R, name: 'The Frozen Ossuary' },
  { x: CRYPT_X, y: 16700, r: CRYPT_ROOM_R, name: 'Gallery of Still Knights' },
  { x: CRYPT_X, y: 18300, r: (BOARD_N / 2) * BOARD_T * 1.42 + 8, name: 'The Frozen Gambit', board: 1 },
];
export const CRYPT_BOUNDS = { x0: CRYPT_X - 900, x1: CRYPT_X + 900, y0: 13500, y1: 19200 };
export const inCryptArea = (x, y, pad = 240) => x > CRYPT_BOUNDS.x0 && x < CRYPT_BOUNDS.x1 && y > CRYPT_BOUNDS.y0 && y < CRYPT_BOUNDS.y1 && cryptRoomAt(x, y, pad) >= 0;
export function cryptRoomAt(x, y, pad = 0) {
  for (let i = 0; i < CRYPT_ROOMS.length; i++) { const R = CRYPT_ROOMS[i]; if (Math.hypot(x - R.x, y - R.y) < R.r + pad) return i; }
  return -1;
}
export const SANCTUM = CRYPT_ROOMS[3];
/** half the side of the playable board (shrink = rings of tiles removed in phase 3) */
export const boardHalf = (shrink = 0) => (BOARD_N / 2 - shrink) * BOARD_T;
/** the tile (i, j) under a point, or null off the board */
export function tileAt(x, y) {
  const h = boardHalf(), i = Math.floor((x - SANCTUM.x + h) / BOARD_T), j = Math.floor((y - SANCTUM.y + h) / BOARD_T);
  return i < 0 || j < 0 || i >= BOARD_N || j >= BOARD_N ? null : [i, j];
}
export const tileCentre = (i, j) => ({ x: SANCTUM.x - boardHalf() + (i + 0.5) * BOARD_T, y: SANCTUM.y - boardHalf() + (j + 0.5) * BOARD_T });
export const cryptEntry = (i) => { const R = CRYPT_ROOMS[i]; return R.board ? { x: R.x, y: R.y + boardHalf() - 50 } : { x: R.x, y: R.y + R.r - 70 }; };
export const cryptDoor = (i) => { const R = CRYPT_ROOMS[i]; return R.board ? { x: R.x, y: R.y + boardHalf() - 50 } : { x: R.x, y: R.y - R.r + 52 }; };
/** keep a circle inside its crypt vault (the sanctum is the square board); true if moved */
export function clampCrypt(e, shrink = 0) {
  const i = Math.max(0, cryptRoomAt(e.x, e.y, 260)), R = CRYPT_ROOMS[i], r = e.r || 0;
  if (R.board) {
    const h = boardHalf(shrink) - r; let hit = false;
    if (e.x < R.x - h) { e.x = R.x - h; hit = true; } if (e.x > R.x + h) { e.x = R.x + h; hit = true; }
    if (e.y < R.y - h) { e.y = R.y - h; hit = true; } if (e.y > R.y + h) { e.y = R.y + h; hit = true; }
    return hit;
  }
  const dx = e.x - R.x, dy = e.y - R.y, d = Math.hypot(dx, dy), m = R.r - r;
  if (d > m) { const k = m / d; e.x = R.x + dx * k; e.y = R.y + dy * k; return true; }
  return false;
}
export function cryptBlocked(x, y, r = 0, shrink = 0) {
  const i = Math.max(0, cryptRoomAt(x, y, 260)), R = CRYPT_ROOMS[i];
  if (R.board) { const h = boardHalf(shrink) + 50 - r; return Math.abs(x - R.x) > h || Math.abs(y - R.y) > h; }
  return Math.hypot(x - R.x, y - R.y) > R.r + 60 - r;
}
