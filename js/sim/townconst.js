// Brightwater Village: the hub town (Monster Hunter Rise style). A walkable island village west of the world disc; the
// game starts here and every mission leaves from and returns to it. 2026-10-09 layout: a bigger island in districts:
// the Fountain Plaza in the middle, the Guild Square north (Mission Counter, Co-op Board, Weekly Board), Artisans' Row
// west (Borin's smithy + the Forge), the Market east (Dorrik, stalls, the harbour), Elder's Garden north-east (the great
// oak + the pond), the Training Grounds south-west (the dummy ring), the windmill hill north-west, homes around them and
// the Realm Gate plaza at the south end of the main street.
// Pure geometry + collision (world.js, constants.js, the renderer and the prediction sim all use it).
import { GATES } from './dunesconst.js'; // the Realm Gate plaza (pure geometry too)
export const TOWN_POS = { x: -12500, y: 0 };
export const TOWN_R = 1080;                       // walkable island radius (was 600 before the 2026-10-09 layout)
export const TOWN_NAME = 'Brightwater Village';
const T = TOWN_POS;
/** Where arrivals stand (south of the fountain) and the Mission Counter (the clerk behind her desk). */
export const TOWN_SPAWN = { x: T.x, y: T.y + 190 };
export const COUNTER = { x: T.x, y: T.y - 411, r: 105 }; // interact point (in front of the desk) + reach
export const CLERK = { x: T.x, y: T.y - 465, name: 'Hana', title: 'Mission Clerk' }; // stands just south of the hall's front wall (y -470) and behind the desk, so the y-sort draws her over the building
/** Is (x, y) in the town region (the island plus a margin)? */
export const inTownArea = (x, y, pad = 300) => Math.hypot(x - T.x, y - T.y) < TOWN_R + pad;
export const nearCounter = (x, y, pad = 0, ly) => { const c = hubCounter(ly); return Math.hypot(x - c.x, y - c.y) < c.r + pad; };

// ------------------------------------------------------------------ the painted tavern hub (Art style = Painted)
// The same hub as the village, laid out as the painted guild-tavern hall (assets/world/hall.webp, 1280x720 px): one
// image pixel = HALL_K world units, the image centre = TOWN_POS. The layout is per world (world.hubLayout = 'tavern' |
// 'village'): solo follows the player's Art style, co-op follows the host's. Collision = the floor polygon traced over
// the painting (walls, the Mission Counter, the hearth and the bar are outside it) + the furniture footprints below.
export const HALL_K = 0.9, HALL_W = 1280, HALL_H = 720;
export const hallPt = (ix, iy) => ({ x: T.x + (ix - HALL_W / 2) * HALL_K, y: T.y + (iy - HALL_H / 2) * HALL_K });
const HP = (ix, iy) => { const p = hallPt(ix, iy); return [p.x, p.y]; };
export const HALL_FLOOR = [HP(108, 528), HP(150, 432), HP(250, 392), HP(430, 382), HP(452, 352), HP(818, 352), HP(842, 414), HP(1110, 420), HP(1172, 468), HP(1186, 520), HP(1248, 598), HP(1250, 708), HP(30, 708), HP(30, 600)];
const HR = (kind, ix, iy, w, h, o = {}) => ({ kind, sh: 'rect', ...hallPt(ix, iy), w, h, ...o });
const HC = (kind, ix, iy, r, o = {}) => ({ kind, sh: 'circle', ...hallPt(ix, iy), r, ...o });
/** furniture + NPCs on the tavern floor: (x, y) = footprint centre; art = painted piece, ht = drawn height (world units) */
export const TAVERN_PROPS = [
  HC('table', 330, 572, 52, { art: 'h_round', ht: 92, foot: 20 }),
  HR('table', 952, 596, 168, 44, { art: 'h_feast', ht: 104, foot: 26 }),
  HC('keg', 846, 440, 24, { art: 'h_keg', ht: 64, foot: 14 }),
  HR('barrels', 78, 650, 96, 40, { art: 'h_barrels', ht: 96, foot: 22 }),
  HR('crates', 1200, 664, 104, 40, { art: 'h_crates', ht: 84, foot: 20 }),
  HR('rack', 1096, 650, 66, 22, { art: 'h_weaponrack', ht: 112, foot: 12 }),
  HC('candles', 262, 612, 12, { art: 'h_candelabra', ht: 84, foot: 6 }),
  HC('fern', 1030, 452, 18, { art: 'h_fern', ht: 70, foot: 10 }),
  HC('npc', 196, 618, 18, { art: 'npc_shrine', ht: 128, foot: 8, name: 'Sister Ilse', title: 'Shrine Keeper' }),
  HC('npc', 486, 424, 18, { art: 'npc_minstrel', ht: 126, foot: 8, name: 'Lio', title: 'Minstrel' }),
  HC('npc', 990, 444, 18, { art: 'npc_barkeep', ht: 132, foot: 8, name: 'Brann', title: 'Barkeep' }),
  HC('npc', 1158, 606, 18, { art: 'npc_quartermaster', ht: 124, foot: 8, name: 'Dorrik', title: 'Quartermaster' }),
];
/** per-layout hub geometry: arrival spot, the Mission Counter interact point, the clerk, the Realm Gate pads */
export const HUB_GEO = {
  village: { spawn: TOWN_SPAWN, counter: COUNTER, clerk: CLERK, gates: Object.fromEntries(GATES.map((g) => [g.id, { dx: g.dx, dy: g.dy }])) },
  tavern: {
    spawn: hallPt(640, 560), counter: { ...hallPt(640, 378), r: 105 }, clerk: { ...hallPt(640, 334), name: CLERK.name, title: CLERK.title },
    gates: { field: { dx: (165 - 640) * HALL_K, dy: (466 - 360) * HALL_K }, dunes: { dx: (1150 - 640) * HALL_K, dy: (470 - 360) * HALL_K }, frost: { dx: (900 - 640) * HALL_K, dy: (640 - 360) * HALL_K }, ember: { dx: (380 - 640) * HALL_K, dy: (640 - 360) * HALL_K }, rift: { dx: 0, dy: (672 - 360) * HALL_K } },
  },
};
export const hubLayoutOf = (w) => (w && w.hubLayout === 'tavern' ? 'tavern' : 'village');
const geo = (ly) => HUB_GEO[ly === 'tavern' ? 'tavern' : 'village'];
export const hubCounter = (ly) => geo(ly).counter;
export const hubClerk = (ly) => geo(ly).clerk;
export const hubSpawn = (ly) => geo(ly).spawn;
/** world position of Realm Gate `g` (a GATES entry) in a layout */
export const hubGatePos = (g, ly) => { const o = geo(ly).gates[g.id] || g; return { x: T.x + o.dx, y: T.y + o.dy }; };
function inPoly(P, x, y) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }
function nearestEdge(P, x, y) {
  let bd = 1e18, bx = x, by = y;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [ax, ay] = P[j], [cx, cy] = P[i], ex = cx - ax, ey = cy - ay, L = ex * ex + ey * ey;
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / L)) : 0, px = ax + ex * t, py = ay + ey * t, d = (x - px) ** 2 + (y - py) ** 2;
    if (d < bd) { bd = d; bx = px; by = py; }
  }
  return { x: bx, y: by, d: Math.sqrt(bd) };
}
const HALL_C = hallPt(640, 560);
function resolveTavern(e) {
  let hit = false;
  for (let pass = 0; pass < 2; pass++) {
    const inside = inPoly(HALL_FLOOR, e.x, e.y), q = nearestEdge(HALL_FLOOR, e.x, e.y);
    if (inside && q.d >= e.r) break;
    let nx = e.x - q.x, ny = e.y - q.y, l = Math.hypot(nx, ny);
    if (!inside) { nx = -nx; ny = -ny; }
    if (l < 0.001) { nx = HALL_C.x - q.x; ny = HALL_C.y - q.y; l = Math.hypot(nx, ny) || 1; }
    e.x = q.x + (nx / l) * e.r; e.y = q.y + (ny / l) * e.r; hit = true;
  }
  if (pushProps(e, TAVERN_PROPS)) hit = true;
  if (!inPoly(HALL_FLOOR, e.x, e.y)) { const q = nearestEdge(HALL_FLOOR, e.x, e.y), nx = HALL_C.x - q.x, ny = HALL_C.y - q.y, l = Math.hypot(nx, ny) || 1; e.x = q.x + (nx / l) * e.r; e.y = q.y + (ny / l) * e.r; hit = true; }
  return hit;
}
function pushProps(e, props) {
  let hit = false;
  for (const o of props) {
    if (o.sh === 'circle') {
      const ox = e.x - o.x, oy = e.y - o.y, dd = Math.hypot(ox, oy), min = o.r + e.r;
      if (dd < min) { if (dd < 0.001) { e.y = o.y + min; } else { e.x = o.x + (ox / dd) * min; e.y = o.y + (oy / dd) * min; } hit = true; }
    } else {
      const hw = o.w / 2, hh = o.h / 2;
      const cx = Math.max(o.x - hw, Math.min(o.x + hw, e.x)), cy = Math.max(o.y - hh, Math.min(o.y + hh, e.y));
      const ox = e.x - cx, oy = e.y - cy, dd = Math.hypot(ox, oy);
      if (dd < e.r) {
        if (dd > 0.001) { e.x = cx + (ox / dd) * e.r; e.y = cy + (oy / dd) * e.r; }
        else { const l = e.x - (o.x - hw), r = o.x + hw - e.x, t = e.y - (o.y - hh), b = o.y + hh - e.y, mn = Math.min(l, r, t, b); if (mn === l) e.x = o.x - hw - e.r; else if (mn === r) e.x = o.x + hw + e.r; else if (mn === t) e.y = o.y - hh - e.r; else e.y = o.y + hh + e.r; }
        hit = true;
      }
    }
  }
  return hit;
}
function tavernBlocked(x, y, r) {
  if (!inPoly(HALL_FLOOR, x, y) && nearestEdge(HALL_FLOOR, x, y).d > 40 - r) return true;
  for (const o of TAVERN_PROPS) {
    if (o.kind === 'candles' || o.kind === 'fern') continue;
    if (o.sh === 'circle') { if (Math.hypot(x - o.x, y - o.y) < o.r + r) return true; }
    else if (Math.abs(x - o.x) < o.w / 2 + r && Math.abs(y - o.y) < o.h / 2 + r) return true;
  }
  return false;
}

/** Solid props. Rects are footprints (x, y = centre); circles are trunks / the fountain basin / lamp posts. */
const R = (kind, dx, dy, w, h, o = {}) => ({ kind, sh: 'rect', x: T.x + dx, y: T.y + dy, w, h, ...o });
const Ci = (kind, dx, dy, r, o = {}) => ({ kind, sh: 'circle', x: T.x + dx, y: T.y + dy, r, ...o });
/** the district centres (drawing, the minimap labels, tests) */
export const DISTRICTS = [
  { id: 'plaza', name: 'Fountain Plaza', dx: 0, dy: 0 },
  { id: 'guild', name: 'Guild Square', dx: 0, dy: -400 },
  { id: 'artisans', name: "Artisans' Row", dx: -640, dy: -170 },
  { id: 'market', name: 'Market & Harbour', dx: 650, dy: 60 },
  { id: 'garden', name: "Elder's Garden", dx: 620, dy: -440 },
  { id: 'training', name: 'Training Grounds', dx: -600, dy: 330 },
  { id: 'mill', name: 'Windmill Hill', dx: -760, dy: -560 },
  { id: 'gates', name: 'Realm Gate Plaza', dx: 0, dy: 660 },
];
/** roads (drawn under everything; the whole island is walkable): pts relative to the centre, w = width, k = 'cobble' | 'dirt' */
export const TOWN_ROADS = [
  { k: 'cobble', w: 124, pts: [[0, -420], [0, 640]] },                                  // the main street: Guild Square - plaza - Realm Gates
  { k: 'dirt', w: 84, pts: [[-230, -110], [-430, -160], [-640, -120]] },               // to Artisans' Row
  { k: 'dirt', w: 90, pts: [[240, -20], [430, 30], [650, 60]] },                       // to the Market
  { k: 'dirt', w: 70, pts: [[160, -330], [400, -400], [600, -370]] },                  // to Elder's Garden
  { k: 'dirt', w: 80, pts: [[-200, 180], [-420, 270], [-600, 330]] },                  // to the Training Grounds
  { k: 'dirt', w: 58, pts: [[-470, -160], [-520, -420], [-640, -510], [-740, -545]] }, // up Windmill Hill (east of the smithy)
  { k: 'dirt', w: 70, pts: [[650, 60], [880, 110], [1090, 120]] },                     // the harbour pier
  { k: 'dirt', w: 58, pts: [[170, 250], [420, 360], [760, 330]] },                     // the south-east homes
  { k: 'dirt', w: 56, pts: [[-290, -400], [-430, -560]] },                             // Guild Square - the blue house
  { k: 'dirt', w: 50, pts: [[-640, -120], [-860, 56]] },                               // Artisans' Row - the orange house
  { k: 'dirt', w: 50, pts: [[-300, 300], [-500, 520], [-640, 600]] },                               // Training Grounds - the cottage
];
/** paved areas besides the fountain plaza: the guild square + the market square (ellipses) */
export const TOWN_PAVES = [
  { dx: 0, dy: -400, rx: 300, ry: 120 },
  { dx: 650, dy: 60, rx: 230, ry: 150 },
];
const ring = (cx, cy, r, n, gapA, gapW) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; let d = Math.abs(((a - gapA + Math.PI * 3) % (Math.PI * 2)) - Math.PI); return d < gapW ? null : [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.72]; }).filter(Boolean);
/** the training ring's fence posts (solid: the gap faces the plaza) */
export const FENCE = ring(-600, 330, 190, 40, -0.6, 0.42);
const TOWN_PROPS0 = [
  // Guild Square (north): the Mission Counter hall, the clerk's desk, the Co-op Board and the Weekly Board
  R('counter', 0, -520, 320, 100, { roof: '#d9483b' }),
  R('desk', 0, -458, 170, 26),
  R('board', -230, -430, 70, 16),                                 // the Co-op Board (sim/village.js lobby)
  R('wboard', 230, -430, 92, 18),
  R('altar', -260, -680, 96, 44),                                // the Ascension Altar (Part B: sim/ascension.js)                                 // the Weekly Board (opens the counter's Weekly tab)
  // Artisans' Row (west): Borin's smithy, the forge hearth + anvil, crates of ore
  R('house', -700, -320, 210, 112, { roof: '#5d5a6b', sign: 'forge' }),
  R('hearth', -760, -215, 64, 30),
  R('anvil', -585, -195, 40, 20),
  Ci('npc', -650, -190, 40, { st: 'smith' }),
  R('crates', -540, -255, 38, 34),
  Ci('barrel', -845, -205, 15), Ci('barrel', -818, -182, 15),
  // the Market (east): Dorrik, the stalls, the harbour crates; the Stash chest on the plaza's north-east corner
  R('stall', 530, -45, 120, 46, { roof: '#ff6f91' }),
  R('stall', 770, -45, 120, 46, { roof: '#ffd23f' }),
  R('stall', 540, 180, 120, 46, { roof: '#3a8ee8' }),
  Ci('npc', 690, 75, 40, { st: 'qm' }),
  R('crates', 750, 100, 38, 34),
  Ci('barrel', 820, 175, 15), Ci('barrel', 844, 190, 15), Ci('barrel', 826, 205, 15),
  R('chest', 360, -170, 50, 26),
  // Elder's Garden (north-east): her house, the great oak, the lily pond
  R('house', 720, -580, 180, 110, { roof: '#9b5fc9' }),
  Ci('npc', 600, -425, 40, { st: 'elder' }),
  Ci('oak', 455, -505, 34, { size: 120 }),
  Ci('pond', 810, -360, 72),
  R('bench', 650, -300, 64, 16),
  // Training Grounds (south-west): the dummy ring + a weapon rack
  ...FENCE.map(([dx, dy]) => Ci('fpost', dx, dy, 8)),
  R('rack', -690, 282, 62, 16),
  // Windmill Hill (north-west) + homes
  Ci('windmill', -790, -600, 58),
  R('house', -430, -620, 170, 110, { roof: '#3f7fd6' }),
  R('house', -860, 110, 160, 110, { roof: '#e08a2a' }),
  R('house', 430, 430, 160, 110, { roof: '#5aa84a' }),
  R('house', 780, 400, 170, 110, { roof: '#d9483b' }),
  R('house', -640, 650, 160, 104, { roof: '#ec6fb0' }),
  // landmarks + street furniture
  Ci('fountain', 0, 0, 58),
  Ci('statue', -330, 40, 26),
  Ci('well', 300, 230, 26),
  R('bench', -150, 300, 60, 16), R('bench', -175, -296, 60, 16),
  ...[[-150, -200], [150, -200], [-150, 200], [150, 200], [-110, -330], [110, -330], [-110, 430], [110, 430], [470, -110], [830, 250], [-470, -60], [-300, 420]].map(([dx, dy]) => Ci('lamp', dx, dy, 9)),
  // trees: the rim ring (gaps for the harbour pier east and the gates south), orchard groves, the garden
  ...Array.from({ length: 34 }, (_, i) => { const a = (i / 34) * Math.PI * 2 + 0.05; if (Math.abs(a) < 0.16 || Math.abs(a - Math.PI * 2) < 0.16) return null; return Ci('tree', Math.cos(a) * 1015, Math.sin(a) * 1005, 22, { size: 48 + (i * 7) % 18, variant: i * 37 }); }).filter(Boolean),
  ...[[-560, -820], [-430, -830], [-930, -380], [-960, 380], [-860, 520], [250, -800], [380, -760], [960, -280], [560, 700], [700, 620], [300, 880], [-300, 880]].map(([dx, dy], i) => Ci('tree', dx, dy, 20, { size: 44 + (i * 5) % 14, variant: 11 + i * 13 })),
  ...GATES.flatMap((g) => [-1, 1].map((side) => Ci('gatepost', g.dx + side * 52, g.dy, 12, { gate: g.id, side }))), // the Realm Gates' stone posts
];
// (a rim / grove tree never grows into a building, a stall or the gate plaza)
const FOOT = TOWN_PROPS0.filter((o) => o.sh === 'rect');
export const TOWN_PROPS = TOWN_PROPS0.filter((o) => o.kind !== 'tree' || !(FOOT.some((b) => Math.abs(o.x - b.x) < b.w / 2 + 50 && Math.abs(o.y - b.y) < b.h / 2 + 40) || Math.abs(o.x - T.x) < 440 && o.y - T.y > 470 && o.y - T.y < 860));
/** bunting strings between lamp posts (indices into the lamps, in TOWN_PROPS order) */
export const TOWN_BUNTING = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

/** Push a circle entity (x, y, r) out of the town props and keep it on the island. Returns true on contact. */
export function resolveTown(e, ly) {
  if (ly === 'tavern') return resolveTavern(e);
  let hit = false;
  const dx = e.x - T.x, dy = e.y - T.y, d = Math.hypot(dx, dy), m = TOWN_R - e.r;
  if (d > m) { const k = m / d; e.x = T.x + dx * k; e.y = T.y + dy * k; hit = true; }
  for (const o of TOWN_PROPS) {
    if (o.sh === 'circle') {
      const ox = e.x - o.x, oy = e.y - o.y, dd = Math.hypot(ox, oy), min = o.r + e.r;
      if (dd < min) { if (dd < 0.001) { e.y = o.y + min; } else { e.x = o.x + (ox / dd) * min; e.y = o.y + (oy / dd) * min; } hit = true; }
    } else {
      const hw = o.w / 2, hh = o.h / 2;
      const cx = Math.max(o.x - hw, Math.min(o.x + hw, e.x)), cy = Math.max(o.y - hh, Math.min(o.y + hh, e.y));
      const ox = e.x - cx, oy = e.y - cy, dd = Math.hypot(ox, oy);
      if (dd < e.r) {
        if (dd > 0.001) { e.x = cx + (ox / dd) * e.r; e.y = cy + (oy / dd) * e.r; }
        else { // centre inside the rect: push out along the shallowest side
          const l = e.x - (o.x - hw), r = o.x + hw - e.x, t = e.y - (o.y - hh), b = o.y + hh - e.y, mn = Math.min(l, r, t, b);
          if (mn === l) e.x = o.x - hw - e.r; else if (mn === r) e.x = o.x + hw + e.r; else if (mn === t) e.y = o.y - hh - e.r; else e.y = o.y + hh + e.r;
        }
        hit = true;
      }
    }
  }
  const dx2 = e.x - T.x, dy2 = e.y - T.y, d2 = Math.hypot(dx2, dy2); // (a rim tree can't push you off the island)
  if (d2 > m) { const k = m / d2; e.x = T.x + dx2 * k; e.y = T.y + dy2 * k; hit = true; }
  return hit;
}
/** Solid point test for the town (line of sight, projectiles). */
export function townBlocked(x, y, r = 0, ly) {
  if (ly === 'tavern') return tavernBlocked(x, y, r);
  if (Math.hypot(x - T.x, y - T.y) > TOWN_R + 40 - r) return true;
  for (const o of TOWN_PROPS) {
    if (o.kind === 'lamp' || o.kind === 'fpost' || o.kind === 'bench' || o.kind === 'pond') continue; // (low: shots fly over)
    if (o.sh === 'circle') { if (Math.hypot(x - o.x, y - o.y) < o.r + r) return true; }
    else if (Math.abs(x - o.x) < o.w / 2 + r && Math.abs(y - o.y) < o.h / 2 + r) return true;
  }
  return false;
}
/** A free spot for the k-th arrival around a point (a small ring, then outward). */
export function townSpot(k, base = TOWN_SPAWN, ly) {
  if (ly === 'tavern' && base === TOWN_SPAWN) base = HUB_GEO.tavern.spawn;
  const ring = k === 0 ? 0 : 42 + Math.floor((k - 1) / 6) * 38, a = k * 1.047 + 0.5;
  return { x: base.x + Math.cos(a) * ring, y: base.y + Math.sin(a) * ring * 0.6 };
}
