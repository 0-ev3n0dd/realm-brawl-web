// Sunscorch Dunes (biome 2) + the Tomb of the Sun-Eaten King (its Normal dungeon): pure geometry, no imports, so
// constants.js / world.js / the renderer / the prediction sim can all use it without import cycles.
// The Dunes is its own disc north of the Wilds (RotMG-style: a safe oasis in the middle, Danger 3 -> 6 toward the rim,
// the Overlord's arena on the north rim). The Tomb is a chain of floating sandstone chambers east of the Dunes: three wave
// rooms (south -> north) and Neferakh's sanctum; a sun-door at each room's north rim carries the party to the next one.
import { DUNES_C, DUNES_RR, DUNES_SHAPE, DUNES_RINGS, dunesSite } from './mapshape.js'; // (pure geometry too)
export const DUNES_POS = { x: DUNES_C.x, y: DUNES_C.y };
export const DUNES_R = DUNES_RR; // nominal radius (the coastline is organic: DUNES_SHAPE)
export const DUNES_NAME = 'Sunscorch Dunes';
export const DUNES_SEED = 20261001;
/** Rings from the oasis outward. id 0 = safe (enemies ignore you there), like Haven Meadow. tier = loot tier. */
export const DUNES_ZONES = [
  { id: 0, name: 'Oasis of Ra', danger: 0, r0: 0, r1: DUNES_RINGS[0], tier: 0, dunes: true },
  { id: 21, name: 'Glassbead Flats', danger: 3, r0: DUNES_RINGS[0], r1: DUNES_RINGS[1], tier: 3, dunes: true },
  { id: 22, name: 'Scarab Wastes', danger: 4, r0: DUNES_RINGS[1], r1: DUNES_RINGS[2], tier: 4, dunes: true },
  { id: 23, name: 'Mirage Expanse', danger: 5, r0: DUNES_RINGS[2], r1: DUNES_RINGS[3], tier: 4, dunes: true },
  { id: 24, name: 'Sunscar Rim', danger: 6, r0: DUNES_RINGS[3], r1: DUNES_R, tier: 5, dunes: true },
];
/** Khepra's arena (the Overlord) on the north rim. */
const KS = dunesSite('khepra');
export const OVERLORD_POS = { x: KS.x, y: KS.y };
export const OVERLORD_R = 300;
/** Keep an ordinary Dunes enemy out of the oasis (the safe ring). */
export function oasisPush(e) {
  const dx = e.x - DUNES_POS.x, dy = e.y - DUNES_POS.y, d = Math.hypot(dx, dy), m = DUNES_ZONES[0].r1 + e.r;
  if (d < m && d < DUNES_R) { const k = m / (d || 1); e.x = DUNES_POS.x + dx * k; e.y = DUNES_POS.y + dy * k; }
}
/** Where arrivals stand (south edge of the oasis pool). */
export const DUNES_SPAWN = { x: DUNES_POS.x, y: DUNES_POS.y + 150 };
export const inDunesArea = (x, y, pad = 260) => DUNES_SHAPE.inside(x, y, pad);
export function dunesZoneAt(x, y) {
  const dd = Math.hypot(x - DUNES_POS.x, y - DUNES_POS.y);
  if (dd < DUNES_ZONES[0].r1) return DUNES_ZONES[0]; // the oasis is a plain circle
  const d = DUNES_SHAPE.re(x, y); // danger rings follow the coastline
  for (const z of DUNES_ZONES) if (d < z.r1) return z;
  return DUNES_ZONES[DUNES_ZONES.length - 1];
}

// ------------------------------------------------------------------ the Tomb
export const TOMB_NAME = 'Tomb of the Sun-Eaten King';
export const TOMB_ROOM_R = 430;
export const TOMB_BOSS_R = 540;
export const TOMB_X = 9800;
export const TOMB_BOUNDS = { x0: TOMB_X - 900, x1: TOMB_X + 900, y0: -13700, y1: -8300 }; // (renderer void / visibility)
/** Chambers 0-2 = wave rooms, 3 = Neferakh's sanctum (south -> north). */
export const TOMB_ROOMS = [
  { x: TOMB_X, y: -9000, r: TOMB_ROOM_R, name: 'Hall of Offerings' },
  { x: TOMB_X, y: -10200, r: TOMB_ROOM_R, name: 'Gallery of Mirages' },
  { x: TOMB_X, y: -11400, r: TOMB_ROOM_R, name: 'Sanctum of Scarabs' },
  { x: TOMB_X, y: -12800, r: TOMB_BOSS_R, name: 'The Sun-Eater\'s Sanctum' },
];
export const inTombArea = (x, y, pad = 240) => x > TOMB_X - 800 && x < TOMB_X + 800 && y < -8300 && y > -13700 && tombRoomAt(x, y, pad) >= 0;
/** Which chamber is (x, y) in (with a pad), or -1. */
export function tombRoomAt(x, y, pad = 0) {
  for (let i = 0; i < TOMB_ROOMS.length; i++) { const R = TOMB_ROOMS[i]; if (Math.hypot(x - R.x, y - R.y) < R.r + pad) return i; }
  return -1;
}
/** Entry point of a chamber (south rim) and its sun-door (north rim). */
export const roomEntry = (i) => { const R = TOMB_ROOMS[i]; return { x: R.x, y: R.y + R.r - 70 }; };
export const roomDoor = (i) => { const R = TOMB_ROOMS[i]; return { x: R.x, y: R.y - R.r + 52 }; };
/** Neferakh's sanctum: four obelisks (the shade in a Noon Flare) and four braziers on the rim (light in the dark). */
const B = TOMB_ROOMS[3];
export const OBELISKS = [0, 1, 2, 3].map((i) => { const a = Math.PI / 4 + i * Math.PI / 2; return { x: Math.round(B.x + Math.cos(a) * 250), y: Math.round(B.y + Math.sin(a) * 250), r: 26 }; });
export const BRAZIERS = [0, 1, 2, 3].map((i) => { const a = i * Math.PI / 2; return { x: Math.round(B.x + Math.cos(a) * 430), y: Math.round(B.y + Math.sin(a) * 430) }; });

// ------------------------------------------------------------------ the Realm Gate plaza (Brightwater Village, south)
// (2026-10-09 town layout: the plaza sits at the end of the main street, 620 south of the fountain; the Rift gate below it)
/** Portal pads relative to the town centre (TOWN_POS is passed in to avoid an import). */
export const GATES = [
  { id: 'field', name: 'The Wilds', sub: 'Danger 0-4', dx: -300, dy: 620, col: '#7ee06a', lock: null },
  { id: 'dunes', name: 'Sunscorch Dunes', sub: 'Danger 3-6', dx: -100, dy: 620, col: '#ffb43c', lock: 'dunes', lockText: 'Defeat Grimtusk to open this gate' },
  { id: 'frost', name: 'Frostveil Peaks', sub: 'Danger 4-7', dx: 100, dy: 620, col: '#8fe3ff', lock: 'frost', lockText: 'Defeat Khepra or clear the Tomb to open this gate' },
  { id: 'ember', name: 'Emberdeep Caldera', sub: 'Danger 4-7', dx: 300, dy: 620, col: '#ff7a3a', lock: 'ember', lockText: 'Defeat Skaldra or clear the Glacier Crypt to open this gate' },
  { id: 'rift', name: 'The Astral Rift', sub: 'Danger 4-7 · Lv 41-48', dx: 0, dy: 745, col: '#b48cff', lock: 'rift', lockText: 'Defeat Pyrrhex or clear the Forge of Cinders to open this gate' }, // (game loop C3: Map 5, the south gate)
];
export const GATE_R = 34;
