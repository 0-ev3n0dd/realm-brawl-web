// The Astral Rift (Map 5, game loop C3; Lv 41-49): pure geometry (only mapshape.js), so constants.js / world.js / the
// renderer / the prediction sim can use it without import cycles. Built from the Rift Sanctum + the Star Sanctum: a
// shattered starfield far west of Brightwater, where the rift Vorthax held open tore the sky down onto the land.
// Starfall Camp sits on the east shore (facing the village); Danger 4 -> 7 climbs west toward Zerath, the Rift Herald,
// in the Breach. VOID TEARS run out of the Breach (they drain you: cross on the star bridges where the roads meet them)
// and STARWELLS erupt on a rhythm. A north-east observatory and a west plateau each hold a world boss; the Rift Sanctum
// (Vorthax, Map 5's dungeon) opens from a fixed entrance by the camp.
// Layout: Emberdeep's proven layout mirrored east-west (same lobes / roads / ridges), so the reachability fixes carry over.
import { makeLand, wind, crossings } from './mapshape.js';

export const RIFT_C = { x: -34000, y: 0 };
export const RIFT_RR = 5200;
/** danger thresholds on the effective-radius scale (the camp is a plain circle) */
export const RIFT_RINGS = [340, 1700, 2900, 4000, RIFT_RR];
export const RIFT_NAME = 'The Astral Rift';
export const RIFT_SEED = 20261009;
const rx = (x) => RIFT_C.x - x; // (mirrored: the layout below is Emberdeep's, relative to RIFT_C, flipped east-west)
const L = (x, y, a, b, r) => [rx(x), y, a, b, -r];
export const RIFT_SHAPE = makeLand({
  cx: RIFT_C.x, cy: RIFT_C.y, R: RIFT_RR, cell: 60, blend: 900, noise: 200, warp: 380, nseed: 131, shore: 70,
  lobes: [
    L(-6000, 2300, 1900, 1250, 10),   // the Starfall shore (the camp, south-east)
    L(-4100, 100, 2600, 1800, -8),    // the Shattered Steppe (east)
    L(-2300, -2800, 2400, 1500, 20),  // the Voidglass Barrens (north-east)
    L(1200, -400, 3000, 2500, 0),     // the Breach (centre): Zerath
    L(5200, 500, 2400, 1500, -15),    // the Starwell Reaches (west)
    L(-1200, 2800, 2500, 1100, 5),    // the Comet Coast (south)
    L(8300, -600, 1650, 1300, 20),    // the Orrery plateau (far west)
    L(-5300, -3500, 1550, 1250, -25), // the Observatory (far north-east): Nyxara
    L(3700, 2900, 1700, 1000, -10),   // the Nebula Shelf (south-west)
    L(6500, -500, 1200, 850, 0),      // the orrery approach
    L(-4000, -1900, 1100, 800, 30),   // the observatory road
  ],
  bays: [L(-3000, 3500, 900, 600, 0), L(3200, -3300, 900, 700, 0), L(6800, 2100, 800, 700, 0), L(-6900, -1400, 700, 650, 0), L(1600, 3500, 800, 500, 0)],
  seeds: [
    [rx(-6000), 2500, 1, 3], [rx(-5000), 1800, 1.25, 2], [rx(-6400), 800, 1.4], [rx(-4300), 2700, 1.35],
    [rx(-3700), 600, 1.8], [rx(-2600), 1700, 1.9], [rx(-1300), 2800, 2.0], [rx(400), 2900, 2.2], [rx(2200), 2900, 2.4], [rx(3800), 3000, 2.6],
    [rx(-4600), -1300, 2.1], [rx(-5300), -2800, 2.35], [rx(-5500), -3700, 2.45], [rx(-2600), -2400, 2.6], [rx(-1600), -3400, 2.9],
    [rx(-1200), -300, 2.6], [rx(400), 1100, 2.8], [rx(2600), 1200, 3.0], [rx(-200), -1800, 3.2],
    [rx(4000), 200, 3.1], [rx(5600), 800, 3.25], [rx(6600), -500, 3.3], [rx(8300), -600, 3.35], [rx(8800), 300, 3.2],
    [rx(1300), -600, 4.6, 1.8], [rx(800), -1500, 4.0], [rx(2200), -300, 4.0], [rx(1000), 400, 3.9], [rx(2000), -1500, 3.9],
  ],
  knots: [[1, 900], [1.5, 1700], [2.5, 2900], [3.5, 4000], [4.5, 5100]],
});
export const RIFT_SITES = {
  zerath: { x: rx(1300), y: -650, r: 400 },   // the Breach (Danger 7): Zerath, the Rift Herald (the hunt)
  orrery: { x: rx(8400), y: -600, r: 380 },   // the Orrery plateau (Danger 6): the Shattered Orrery
  nyxara: { x: rx(-5400), y: -3600, r: 360 }, // the Observatory (Danger 5): Nyxara, the Void Matriarch
  star: { x: rx(-2400), y: -1200, r: 170 },   // a fallen star (a crater landmark)
  colossus: { x: rx(3600), y: 2500, r: 170 }, // the Sleeping Colossus (a stone head)
  shrine: { x: rx(-3800), y: 1500, r: 130 },  // the Moon Shrine
  monolith: { x: rx(4300), y: -1200, r: 140 }, // the Void Monolith
};
export const riftSite = (k) => { const s = RIFT_SITES[k]; return { x: s.x, y: s.y, r: s.r }; };
export const RIFT_CAMP = { x: rx(-6000), y: 2500 };
export const RIFT_CAMP_R = RIFT_RINGS[0];
/** where arrivals stand (by the camp's star beacon) */
export const RIFT_SPAWN = { x: RIFT_CAMP.x, y: RIFT_CAMP.y + 120 };
const RP = [
  [[-5850, 2400], [-4400, 1800], [-3000, 1150], [-1500, 650], [-200, 100], [850, -400]],
  [[-6100, 2250], [-5700, 800], [-5200, -700], [-5050, -2200], [-5250, -3200]],
  [[1850, -500], [3300, -300], [4800, -100], [6300, -350], [7950, -550]],
  [[-3000, 1150], [-1600, 2450], [400, 2850], [2300, 2850], [3550, 2700]],
  [[-5200, -700], [-3700, -1700], [-2300, -2600], [-900, -2100], [400, -1250]],
  [[3300, -300], [3900, -800], [4200, -1050]],
].map((c) => c.map(([x, y]) => [rx(x), y]));
export const RIFT_ROADS = RP.map((c, i) => wind(c, 150, 91 + i * 7));
RIFT_SHAPE.carve(RIFT_ROADS);
/** void tears out of the Breach (they drain: cross on the star bridges where a road meets them) */
export const TEAR_W = 120;
export const RIFT_TEARS = [
  [[1000, -200], [-300, 800], [-1500, 1800], [-2100, 3300]],
  [[2300, -100], [3700, 400], [5100, 800], [6300, 1700]],
  [[700, -1700], [-500, -2500], [-1900, -3400]],
  [[5000, 900], [4500, 2000], [3900, 3300]],
  [[-2400, -1150], [-3300, -500], [-4300, -200], [-5600, 100]],
  [[-700, -1300], [-1250, 0], [-1100, 1300], [-600, 2000]],
].map((c, i) => wind(c.map(([x, y]) => [rx(x), y]), 200, 701 + i * 13, 200));
export const RIFT_BRIDGES = RIFT_TEARS.flatMap((lv) => RIFT_ROADS.flatMap((r) => crossings(lv, r)));
/** shattered ridges between the regions (roads punch gaps) */
export const RIFT_CLIFFS = [
  [[-1600, -1700], [-900, -2900], [-1300, -3700]],
  [[3000, -1800], [3200, -2700], [2600, -3300]],
  [[-2600, 2200], [-3100, 600], [-2700, -500]],
  [[2900, 2200], [3300, 1300], [3900, 1100]],
  [[-6200, -500], [-6500, 1000]],
  [[6000, -1800], [6400, -1000], [6100, 900]],
  [[-4100, -2900], [-4700, -2300]],
].map((c, i) => wind(c.map(([x, y]) => [rx(x), y]), 120, 801 + i * 11, 170));
export const RIFT_WALLS = { rings: [], spurs: [], chains: RIFT_CLIFFS };
/** starwells: fixed wells of starlight that erupt on a rhythm (sim/rift.js); like Emberdeep's vents */
export const RIFT_WELLS = [
  [-4600, 900], [-3300, -200], [-2000, 2200], [-500, 2500], [1300, 2400], [2700, 1900], [-3000, -3000], [-1500, -2600],
  [-5600, -2400], [-4700, -3000], [3900, -600], [5300, -400], [6000, 1200], [7200, -900], [8900, 200], [2700, -1500],
  [100, -2400], [-200, 600], [2400, 700], [4700, 2400], [-4500, -1300], [5600, 1900],
].map(([x, y], i) => ({ x: rx(x), y, r: 105, period: 280 + (i * 41) % 160, ph: (i * 89) % 280 }));
/** elite packs (fixed camps, every member an elite) */
export const RIFT_ELITES = [
  { x: rx(-4600), y: 1900, danger: 4, group: ['riftstalker', 'riftstalker', 'riftstalker', 'voidgolem'] },
  { x: rx(-3300), y: 2600, danger: 4, group: ['starwisp', 'starwisp', 'voidarcher', 'voidarcher'] },
  { x: rx(-5000), y: -1500, danger: 5, group: ['astralknight', 'voidgolem', 'voidarcher', 'voidarcher'] },
  { x: rx(-3100), y: -900, danger: 5, group: ['riftstalker', 'riftstalker', 'starwisp'] },
  { x: rx(1200), y: 2300, danger: 5, group: ['voidgolem', 'voidgolem', 'astralknight'] },
  { x: rx(-2300), y: -3300, danger: 6, group: ['starwisp', 'starwisp', 'starwisp', 'astralknight', 'astralknight'] },
  { x: rx(4400), y: 1300, danger: 6, group: ['riftstalker', 'voidgolem', 'voidgolem', 'voidarcher'] },
  { x: rx(7000), y: 300, danger: 6, group: ['voidarcher', 'voidarcher', 'voidarcher', 'voidarcher', 'voidarcher', 'astralknight'] },
  { x: rx(2300), y: -1700, danger: 7, group: ['voidgolem', 'riftstalker', 'riftstalker', 'astralknight', 'starwisp'] },
  { x: rx(-100), y: -800, danger: 7, group: ['astralknight', 'astralknight', 'voidgolem', 'voidgolem', 'starwisp'] },
];
/** Danger regions. id 0 = safe (enemies ignore you there). tier = loot tier (t7 here; t8 is Ascension + the endgame). */
export const RIFT_ZONES = [
  { id: 0, name: 'Starfall Camp', danger: 0, r0: 0, r1: RIFT_RINGS[0], tier: 0, rift: true },
  { id: 101, name: 'The Shattered Steppe', danger: 4, r0: RIFT_RINGS[0], r1: RIFT_RINGS[1], tier: 6, rift: true },
  { id: 102, name: 'Voidglass Barrens', danger: 5, r0: RIFT_RINGS[1], r1: RIFT_RINGS[2], tier: 7, rift: true },
  { id: 103, name: 'The Starwell Reaches', danger: 6, r0: RIFT_RINGS[2], r1: RIFT_RINGS[3], tier: 7, rift: true },
  { id: 104, name: 'The Breach', danger: 7, r0: RIFT_RINGS[3], r1: RIFT_RR, tier: 7, rift: true },
];
export const RIFT_BOUNDS = RIFT_SHAPE.bounds;
export const inRiftArea = (x, y, pad = 260) => x < RIFT_BOUNDS.x1 + 400 && x > RIFT_BOUNDS.x0 - 400 && RIFT_SHAPE.inside(x, y, pad);
export function riftZoneAt(x, y) {
  if (Math.hypot(x - RIFT_CAMP.x, y - RIFT_CAMP.y) < RIFT_CAMP_R) return RIFT_ZONES[0];
  const d = RIFT_SHAPE.re(x, y);
  for (let i = 1; i < RIFT_ZONES.length; i++) if (d < RIFT_ZONES[i].r1) return RIFT_ZONES[i];
  return RIFT_ZONES[RIFT_ZONES.length - 1];
}
/** keep an ordinary rift enemy out of Starfall Camp (the safe ring) */
export function campPush(e) {
  const dx = e.x - RIFT_CAMP.x, dy = e.y - RIFT_CAMP.y, d = Math.hypot(dx, dy), m = RIFT_CAMP_R + e.r;
  if (d < m) { const k = m / (d || 1); e.x = RIFT_CAMP.x + dx * k; e.y = RIFT_CAMP.y + dy * k; }
}
// ---- void tears: a coarse bucket grid of the tear segments (players test it every few ticks; the renderer bakes it)
const LG = 400, tearGrid = new Map();
RIFT_TEARS.forEach((lv) => { for (let i = 1; i < lv.length; i++) { const a = lv[i - 1], b = lv[i]; const x0 = Math.floor((Math.min(a.x, b.x) - TEAR_W) / LG), x1 = Math.floor((Math.max(a.x, b.x) + TEAR_W) / LG), y0 = Math.floor((Math.min(a.y, b.y) - TEAR_W) / LG), y1 = Math.floor((Math.max(a.y, b.y) + TEAR_W) / LG); for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const k = gx + ',' + gy; let l = tearGrid.get(k); if (!l) tearGrid.set(k, (l = [])); l.push([a.x, a.y, b.x, b.y]); } } });
function segD(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0; return Math.hypot(px - ax - dx * t, py - ay - dy * t); }
/** distance from (x, y) to the nearest void tear centre line (Infinity when far) */
export function tearDist(x, y) {
  const l = tearGrid.get(Math.floor(x / LG) + ',' + Math.floor(y / LG)); if (!l) return Infinity;
  let d = Infinity; for (const s of l) { const q = segD(x, y, s[0], s[1], s[2], s[3]); if (q < d) d = q; } return d;
}
export const starBridgeAt = (x, y, pad = 0) => RIFT_BRIDGES.some((b) => Math.hypot(x - b.x, y - b.y) < 120 + pad);
/** standing in a void tear (not on a star bridge)? */
export const inTear = (x, y, r = 0) => x < RIFT_BOUNDS.x1 && tearDist(x, y) < TEAR_W / 2 - r * 0.3 && !starBridgeAt(x, y);
