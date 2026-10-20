// Fixed, seeded world layout: obstacles (trees/rocks), visual decor, and enemy spawners.
// Same seed -> identical map for every client and a future authoritative server.
import { Rng } from './rng.js';
import { WORLD_R, WORLD_SEED, ZONES, BOSS_POS, BOSS_ARENA_R, RAID_POS, RAID_R, inRaidArea, zoneAt } from './constants.js';
import { AST_POS, AST_R, inAstArea } from './astraelconst.js';
import { TRIAL_POS, TRIAL_R, trialAt } from './trialconst.js';
import { inTownArea, resolveTown, townBlocked } from './townconst.js';
import { SPAWN_GROUPS } from './data/enemies.js';
import { generateDunes } from './dunesgen.js';
import { generateFrost } from './frostgen.js';
import { generateEmber } from './embergen.js';
import { generateRift } from './riftgen.js';
import { RIFT_SHAPE, RIFT_CAMP, RIFT_CAMP_R, RIFT_ROADS, inRiftArea } from './riftconst.js';
import { EMBER_SHAPE, inEmberArea, inForgeArea, clampForge, forgeBlocked } from './emberconst.js';
import { FROST_SHAPE, inFrostArea, inCryptArea, clampCrypt, cryptBlocked } from './frostconst.js';
import { DUNES_POS, DUNES_R, inDunesArea, TOMB_ROOMS, inTombArea, tombRoomAt } from './dunesconst.js';
import { WILDS_SHAPE, WILDS_R, WILDS_WALLS, WILDS_SITES, WILDS_ELITES, WILDS_ROADS, WILDS_RIVER, WILDS_BRIDGES, DUNES_SHAPE, DUNES_ROADS, wildsSite, roadDist } from './mapshape.js';
import { Placer, ringPoint, buildWalls, nookWall, roadEntry } from './mapgen.js';
import { generateSites } from './sitegen.js';
import { OPS_Y, opsArenaAt, resolveOps, opsBlocked, placeOpsGates, OPS_CAMPS, resolveHoles } from './opsconst.js';
import { FROST_CAMP, FROST_CAMP_R, FROST_ROADS } from './frostconst.js';
import { inHollowArea, clampHollow, hollowBlocked } from './glowconst.js';
import { EMBER_CAMP, EMBER_CAMP_R, EMBER_ROADS } from './emberconst.js';

const CELL = 160;
/** spawners per danger ring (the Wilds is ~5x the area of the old disc; slightly thinner than 5x so it breathes) */
const SPAWNERS_PER_ZONE = { 1: 56, 2: 76, 3: 66, 4: 54 };
export const WILDS_BOSSES = [ // world bosses: [spawner site, enemy type, danger ring]
  ['grimtusk', 'boss', 4], ['thornmaw', 'thornmaw', 3], ['ashfang', 'ashfang', 4],
];
const WORLD_CACHE = new Map(); // the layout is deterministic and read-only: every Sim with the same seed shares it

export function generateWorld(seed = WORLD_SEED) {
  if (WORLD_CACHE.has(seed)) return WORLD_CACHE.get(seed);
  const rng = new Rng(seed);
  const S = WILDS_SHAPE;
  const spawners = [];
  const obstacles = [];
  const decor = [];
  const P = new Placer(220); // everything solid / reserved so far
  const zoneOf = (x, y) => zoneAt(x, y).id;
  const sites = Object.keys(WILDS_SITES).map((k) => ({ k, ...wildsSite(k) }));
  const nearSite = (x, y, pad) => sites.some((s) => Math.hypot(x - s.x, y - s.y) < s.r + pad);
  const roads = WILDS_ROADS;
  const addOb = (o) => { obstacles.push(o); P.add(o.x, o.y, o.kind === 'tree' ? o.r * 1.6 : o.r * 1.1, 1); };

  // ridge walls first (cliff chains between the danger rings, with gaps where the roads run)
  for (const o of buildWalls(rng, S, WILDS_WALLS, roads, sites.map((s) => ({ x: s.x, y: s.y, r: s.r + 60 })), 'cliff', zoneOf)) addOb(o);

  // the river Ashwater: a chain of low blockers (projectiles fly over them) with gaps at every bridge / ford
  for (let i = 1; i < WILDS_RIVER.length; i++) {
    const a = WILDS_RIVER[i - 1], b = WILDS_RIVER[i], L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.round(L / 56));
    for (let k = 0; k < n; k++) {
      const x = Math.round(a.x + (b.x - a.x) * k / n), y = Math.round(a.y + (b.y - a.y) * k / n);
      const nb = WILDS_BRIDGES.reduce((m, q) => Math.min(m, Math.hypot(q.x - x, q.y - y)), 1e9);
      if (nb < 112) continue; // (the drawn deck is 102 wide: the gap used to be 150, a strip of open water each side of every bridge was walkable)
      if (!S.inside(x, y, 30) || nb < 150) { // map fix: the river keeps blocking across the walkable beach / the road causeways (no Placer entry: the seeded layout is unchanged)
        if (S.sd(x, y) < S.shore + 40) obstacles.push({ kind: 'river', x, y, size: 70, r: 62, zone: zoneOf(x, y), variant: 0, low: 1, fix: 1 });
        continue;
      }
      obstacles.push({ kind: 'river', x, y, size: 70, r: 62, zone: zoneOf(x, y), variant: 0, low: 1 }); P.add(x, y, 120, 1);
    }
  }
  // boss nooks: a cliff horseshoe round each world boss, open toward the road that leads in
  for (const [k, , zone] of WILDS_BOSSES) { const s = wildsSite(k); for (const o of nookWall(rng, s, roadEntry(roads, s), 'cliff', zone, { pad: k === 'ashfang' ? 170 : 130 })) addOb(o); }
  // enemy camps per danger ring (off the roads, away from walls / landmarks / each other)
  for (const z of ZONES) {
    const want = SPAWNERS_PER_ZONE[z.id]; if (!want) continue;
    const groups = SPAWN_GROUPS[z.id];
    let made = 0, tries = 0;
    while (made < want && tries++ < want * 60) {
      const p = ringPoint(rng, S, z.r0 + 90, z.r1 - 110);
      if (Math.hypot(p.x, p.y) < 420 || nearSite(p.x, p.y, 160) || roadDist(roads, p.x, p.y) < 90) continue;
      if (!P.clear(p.x, p.y, 40, 70) || spawners.some((s) => Math.abs(s.x - p.x) < 260 && Math.hypot(s.x - p.x, s.y - p.y) < 260)) continue;
      spawners.push({ id: spawners.length + 1, x: p.x, y: p.y, zone: z.id, group: groups[made % groups.length], boss: false });
      P.add(p.x, p.y, 70, 2);
      made++;
    }
  }
  // elite packs (fixed camps: every member is an elite, longer respawn)
  for (const el of WILDS_ELITES) { const p = { x: el.x, y: el.y }; spawners.push({ id: spawners.length + 1, x: p.x, y: p.y, zone: el.zone, group: el.group, boss: false, elitePack: 1, mul: 1.15 }); P.add(p.x, p.y, 110, 2); }
  // world bosses
  for (const [k, type, zone] of WILDS_BOSSES) { const s = wildsSite(k); spawners.push({ id: spawners.length + 1, x: s.x, y: s.y, zone, group: [type], boss: true, site: k }); }

  // landmarks
  const site = (k) => sites.find((s) => s.k === k);
  { const L = site('lake'); obstacles.push({ kind: 'pond', x: L.x, y: L.y, size: L.r, r: L.r - 26, zone: zoneOf(L.x, L.y), variant: 7, landmark: 'lake', low: 1 }); P.add(L.x, L.y, L.r + 30, 1);
    for (let i = 0; i < 22; i++) { const a = rng.next() * Math.PI * 2, rr = L.r + 8 + rng.next() * 40; decor.push({ kind: 'reeds', x: Math.round(L.x + Math.cos(a) * rr), y: Math.round(L.y + Math.sin(a) * rr * 0.9), size: 16 + Math.round(rng.next() * 10), zone: 2, variant: Math.floor(rng.next() * 1000) }); } }
  { const L = site('stones'); for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + 0.2; if (i === 4) continue; addOb({ kind: 'menhir', x: Math.round(L.x + Math.cos(a) * L.r), y: Math.round(L.y + Math.sin(a) * L.r), size: 30, r: 20, zone: zoneOf(L.x, L.y), variant: i * 13 }); }
    decor.push({ kind: 'altar', x: L.x, y: L.y, size: 46, zone: 2, variant: 3 }); P.add(L.x, L.y, L.r, 1); }
  { const L = site('tower'); addOb({ kind: 'ruintower', x: L.x, y: L.y, size: 70, r: 56, zone: zoneOf(L.x, L.y), variant: 1, landmark: 'tower' });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.5; addOb({ kind: 'ruinwall', x: Math.round(L.x + Math.cos(a) * 150), y: Math.round(L.y + Math.sin(a) * 135), size: 34, r: 26, zone: zoneOf(L.x, L.y), variant: i * 17 }); } }
  { const L = site('elderoak'); addOb({ kind: 'tree', x: L.x, y: L.y, size: 140, r: 46, zone: 1, variant: 777, giant: 1 }); }
  // boss arenas: Grimtusk's ruin pillars, Thornmaw's ring of old trees, Ashfang's broken crags
  { const B = site('grimtusk'), toC = Math.atan2(roadEntry(roads, B).y - B.y, roadEntry(roads, B).x - B.x); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - toC), Math.cos(a - toC))) < 0.4) continue; addOb({ kind: 'pillar', x: Math.round(B.x + Math.cos(a) * (B.r + 40)), y: Math.round(B.y + Math.sin(a) * (B.r + 40)), size: 30, r: 28, zone: 4, variant: i }); } }
  { const B = site('thornmaw'), toC = Math.atan2(roadEntry(roads, B).y - B.y, roadEntry(roads, B).x - B.x); for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - toC), Math.cos(a - toC))) < 0.35) continue; addOb({ kind: 'tree', x: Math.round(B.x + Math.cos(a) * (B.r + 50)), y: Math.round(B.y + Math.sin(a) * (B.r + 50)), size: 74 + (i * 5) % 16, r: 26, zone: 3, variant: 300 + i * 7, dead: 1 }); } }
  { const B = site('ashfang'), toC = Math.atan2(roadEntry(roads, B).y - B.y, roadEntry(roads, B).x - B.x); for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; const off = Math.abs(Math.atan2(Math.sin(a - toC), Math.cos(a - toC))); if (off < 0.3 || Math.abs(off - Math.PI * 0.62) < 0.18) continue; addOb({ kind: 'cliff', x: Math.round(B.x + Math.cos(a) * (B.r + 46)), y: Math.round(B.y + Math.sin(a) * (B.r + 46)), size: 62 + (i * 7) % 14, r: 44, zone: 4, variant: 500 + i * 11, wall: 1 }); } }

  // trees + rocks (thick woods in Greenwood, crags in Stonefang, dead trees further out)
  const clearOf = (x, y, r) => {
    const d = Math.hypot(x, y);
    if (d < 700 + r) return false; // keep the campfire plaza + Haven Meadow clearing open
    if (x > -1300 - r && x < 1300 + r && y > 250 - r && y < 1700 + r) return false; // Southmeadow: open fields south of the camp (no props)
    if (!S.inside(x, y, -60 - r)) return false;
    if (nearSite(x, y, r + 40) || roadDist(roads, x, y) < 46 + r) return false;
    return P.clear(x, y, r, 18);
  };
  const place = (kind, count, sizeMin, sizeMax, re0 = 0, re1 = WILDS_R) => {
    let made = 0, tries = 0;
    while (made < count && tries++ < count * 30) {
      const p = ringPoint(rng, S, re0, re1);
      const size = sizeMin + (sizeMax - sizeMin) * rng.next();
      const r = kind === 'tree' ? size * 0.34 : size * 0.86;
      if (!clearOf(p.x, p.y, kind === 'tree' ? r * 1.6 : r)) continue;
      addOb({ kind, x: p.x, y: p.y, size: Math.round(size), r: Math.round(r), zone: zoneOf(p.x, p.y), variant: Math.floor(rng.next() * 1000) });
      made++;
    }
  };
  place('tree', 1150, 42, 72, 0, 2900);
  place('tree', 520, 46, 74, 2800, WILDS_R);
  place('rock', 520, 16, 38, 1300, WILDS_R);
  place('rock', 160, 14, 30, 0, 1500);
  // purely visual decor (bushes; flowers / tufts are drawn procedurally by the client)
  for (let i = 0; i < 1250; i++) {
    const p = ringPoint(rng, S, 150, WILDS_R - 60);
    if (nearSite(p.x, p.y, 30) || !S.inside(p.x, p.y, -40)) continue;
    decor.push({ kind: 'bush', x: p.x, y: p.y, size: Math.round(22 + rng.next() * 18), zone: zoneOf(p.x, p.y), variant: Math.floor(rng.next() * 1000) });
  }

  generateDunes(spawners, obstacles, decor); // Sunscorch Dunes + the Tomb chambers (own RNG stream: the Wilds layout is unchanged)
  generateEmber(spawners, obstacles, decor); // Emberdeep Caldera + the Forge of Cinders (own RNG stream)
  generateFrost(spawners, obstacles, decor); // Frostveil Peaks + the Glacier Crypt vaults (own RNG stream too)
  const swarmSites = generateSites(seed, spawners, obstacles, decor); // spawn sites + their landmarks (sim/sitegen.js; own RNG stream)
  generateRift(spawners, obstacles, decor); // the Astral Rift (game loop C3: appended after everything, own RNG stream: no id / layout moved)
  generateSites(seed, spawners, obstacles, decor, { sites: swarmSites, only: (s) => !!s.rift }); // its spawn sites (a second, separate pass)
  openCoastalWallEnds(obstacles);
  const grid = new Map();
  obstacles.forEach((o, i) => {
    const x0 = Math.floor((o.x - o.r) / CELL), x1 = Math.floor((o.x + o.r) / CELL);
    const y0 = Math.floor((o.y - o.r) / CELL), y1 = Math.floor((o.y + o.r) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const k = cx + ',' + cy;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(i);
    }
  });
  const world = { seed, obstacles, decor, spawners, grid, roads: WILDS_ROADS, sites: swarmSites };
  world.opsGates = opsGatesFor(world); // the fixed mission + boss-dungeon entrances (sim/opsconst.js)
  WORLD_CACHE.set(seed, world);
  return world;
}

/** Map fix pass: a ridge / cliff chain must not run into the sea. Chain pieces sitting on the beach or within 60 of the
 *  coast are dropped, so the walkable beach always leads round a chain's end (two chains used to seal drawn land off:
 *  a strip of the Grimtusk highlands west coast and a slice of Skaldra's Crown in Frostveil). Boss nooks are kept. Runs
 *  after placement, so the seeded layout (and every RNG draw) is unchanged. */
export const COAST_WALL_PAD = -60;
export const shapeOf = (o) => (o.tomb || o.crypt || o.forge || o.town || o.hollow ? null : o.dunes ? DUNES_SHAPE : o.frost ? FROST_SHAPE : o.ember ? EMBER_SHAPE : o.rift ? RIFT_SHAPE : WILDS_SHAPE);
/** two of Ashfang's broken crags closed little land pockets against its nook wall (the default world seed) */
export const SEALING_CRAGS = [[6353, -168], [5947, -168]];
export function openCoastalWallEnds(obstacles) {
  let w = 0, dropped = 0;
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i], S = o.wall && !o.nook ? shapeOf(o) : null;
    if (S && S.sd(o.x, o.y) > COAST_WALL_PAD) { dropped++; continue; }
    if (o.kind === 'cliff' && !o.nook && SEALING_CRAGS.some(([x, y]) => Math.abs(o.x - x) < 3 && Math.abs(o.y - y) < 3)) { dropped++; continue; }
    obstacles[w++] = o;
  }
  obstacles.length = w; return dropped;
}

export function obstaclesNear(world, x, y, r, out = []) {
  out.length = 0;
  const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
  const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const l = world.grid.get(cx + ',' + cy);
    if (l) for (const i of l) if (!out.includes(i)) out.push(i);
  }
  return out;
}

const tmp = [];
/** Push a circle entity out of obstacles and keep it inside the world. Returns true if it collided. */
export function resolveCircle(world, e) {
  if (e.y < OPS_Y) { const A = opsArenaAt(e.x, e.y); if (A) { const h = resolveOps(A, e); return resolveHoles(world, e) ? (resolveOps(A, e), true) : h; } } // the mission arenas (sim/opsconst.js; + Mobile Defense's collapsed floor)
  if (e.x < -9000 && inTownArea(e.x, e.y)) return resolveTown(e, world && world.hubLayout); // Brightwater Village (the hub town)
  if (e.y < -28000) { const k = trialAt(e.x, e.y); if (k) { // the trial arenas (sim/trials.js): no obstacles, keep inside the disc
    const C = TRIAL_POS[k], dx = e.x - C.x, dy = e.y - C.y, d = Math.hypot(dx, dy), m = TRIAL_R - e.r;
    if (d > m) { const q = m / d; e.x = C.x + dx * q; e.y = C.y + dy * q; return true; }
    return false;
  } }
  if (inAstArea(e.x, e.y)) { // The Star Sanctum (Astrael): no obstacles, keep inside its disc (act 2 platforms: sim/astrael.js)
    const dx = e.x - AST_POS.x, dy = e.y - AST_POS.y, d = Math.hypot(dx, dy), m = AST_R - e.r;
    if (d > m) { const k = m / d; e.x = AST_POS.x + dx * k; e.y = AST_POS.y + dy * k; return true; }
    return false;
  }
  if (e.x < -24000 && inRiftArea(e.x, e.y)) { const hit = RIFT_SHAPE.clamp(e); return pushOut(world, e) || hit; } // the Astral Rift (Map 5)
  if (e.x > 45000 && inForgeArea(e.x, e.y)) { const hit = clampForge(e); return pushOut(world, e) || hit; } // the Forge of Cinders: halls + the foundry floor
  if (e.x > 20000 && inEmberArea(e.x, e.y)) { const hit = EMBER_SHAPE.clamp(e); return pushOut(world, e) || hit; } // Emberdeep Caldera
  if (e.y > 29000 && inHollowArea(e.x, e.y)) { const hit = clampHollow(e); return pushOut(world, e) || hit; } // the Glowmire Hollow grottoes + the Tor
  if (e.x > 15000 && inCryptArea(e.x, e.y)) { const hit = clampCrypt(e); return pushOut(world, e) || hit; } // the Glacier Crypt: its vaults + the square chessboard
  if (e.y > 14000 && inFrostArea(e.x, e.y)) { const hit = FROST_SHAPE.clamp(e); return pushOut(world, e) || hit; } // Frostveil Peaks
  if (inTombArea(e.x, e.y)) { // the Tomb of the Sun-Eaten King: keep inside the current chamber, then its pillars (below)
    const R = TOMB_ROOMS[Math.max(0, tombRoomAt(e.x, e.y, 240))], dx = e.x - R.x, dy = e.y - R.y, d = Math.hypot(dx, dy), m = R.r - e.r;
    let hit = false;
    if (d > m) { const k = m / d; e.x = R.x + dx * k; e.y = R.y + dy * k; hit = true; }
    return pushOut(world, e) || hit;
  }
  if (inDunesArea(e.x, e.y)) { // Sunscorch Dunes: its own disc + obstacles
    const hit = DUNES_SHAPE.clamp(e);
    return pushOut(world, e) || hit;
  }
  if (inRaidArea(e.x, e.y)) { // the raid arena: no obstacles, keep inside its disc
    const dx = e.x - RAID_POS.x, dy = e.y - RAID_POS.y, d = Math.hypot(dx, dy), m = RAID_R - e.r;
    if (d > m) { const k = m / d; e.x = RAID_POS.x + dx * k; e.y = RAID_POS.y + dy * k; return true; }
    return false;
  }
  const hit = WILDS_SHAPE.clamp(e); // the Wilds' organic coastline
  return pushOut(world, e) || hit;
}
function pushOut(world, e) { // up to 3 passes: overlapping props (rock clusters) can't ping-pong you inside them
  let hit = false;
  for (let pass = 0; pass < 3; pass++) { if (!pushOnce(world, e)) break; hit = true; }
  return hit;
}
function pushOnce(world, e) {
  let hit = false;
  obstaclesNear(world, e.x, e.y, e.r, tmp);
  for (const i of tmp) {
    const o = world.obstacles[i];
    const dx = e.x - o.x, dy = e.y - o.y;
    const min = o.r + e.r;
    const dd = dx * dx + dy * dy;
    if (dd < min * min) {
      const l = Math.sqrt(dd) || 0.01;
      e.x = o.x + (dx / l) * min;
      e.y = o.y + (dy / l) * min;
      hit = true;
    }
  }
  return hit;
}

export function pointBlocked(world, x, y, r = 0, proj = false) {
  if (y < OPS_Y) { const A = opsArenaAt(x, y); if (A) return opsBlocked(A, x, y, r) || (!proj && !!world && !!world.opsHoles && world.opsHoles.some((o) => Math.hypot(x - o.x, y - o.y) < o.r + r)); }
  if (x < -9000 && inTownArea(x, y)) return townBlocked(x, y, r, world && world.hubLayout);
  if (inAstArea(x, y)) return Math.hypot(x - AST_POS.x, y - AST_POS.y) > AST_R + 70 - r;
  if (y < -28000) { const k = trialAt(x, y); if (k) return Math.hypot(x - TRIAL_POS[k].x, y - TRIAL_POS[k].y) > TRIAL_R + 70 - r; }
  if (x < -24000 && inRiftArea(x, y)) { if (!RIFT_SHAPE.walkable(x, y, r)) return true; return obstacleAt(world, x, y, r); }
  if (x > 45000 && inForgeArea(x, y)) return forgeBlocked(x, y, r) || obstacleAt(world, x, y, r);
  if (x > 20000 && inEmberArea(x, y)) { if (!EMBER_SHAPE.walkable(x, y, r)) return true; return obstacleAt(world, x, y, r); }
  if (y > 29000 && inHollowArea(x, y)) return hollowBlocked(x, y, r) || obstacleAt(world, x, y, r);
  if (x > 15000 && inCryptArea(x, y)) return cryptBlocked(x, y, r) || obstacleAt(world, x, y, r);
  if (y > 14000 && inFrostArea(x, y)) { if (!FROST_SHAPE.walkable(x, y, r)) return true; return obstacleAt(world, x, y, r); }
  if (inTombArea(x, y)) { const R = TOMB_ROOMS[Math.max(0, tombRoomAt(x, y, 240))]; if (Math.hypot(x - R.x, y - R.y) > R.r + 60 - r) return true; return obstacleAt(world, x, y, r); }
  if (inDunesArea(x, y)) { if (!DUNES_SHAPE.walkable(x, y, r)) return true; return obstacleAt(world, x, y, r); }
  if (inRaidArea(x, y)) return Math.hypot(x - RAID_POS.x, y - RAID_POS.y) > RAID_R + 70 - r; // (raid bullets fly in from just outside the rim)
  if (!WILDS_SHAPE.walkable(x, y, r)) return true;
  return obstacleAt(world, x, y, r, proj);
}
function obstacleAt(world, x, y, r, proj = false) {
  obstaclesNear(world, x, y, r, tmp);
  for (const i of tmp) {
    const o = world.obstacles[i];
    if (proj && o.low) continue; // (bullets fly over water)
    const rr = (o.kind === 'tree' ? o.r * 0.8 : o.r) + r;
    if ((x - o.x) ** 2 + (y - o.y) ** 2 < rr * rr) return true;
  }
  return false;
}

// ------------------------------------------------------------------ movement-skill safety (dashes, blinks, teleports)
/** Sweep a circle of radius r from (fx, fy) toward (tx, ty) and return the furthest walkable point on the way
 *  (stops in front of walls / props instead of tunnelling through them). */
export function clearPath(world, fx, fy, tx, ty, r) {
  const dx = tx - fx, dy = ty - fy, L = Math.hypot(dx, dy);
  if (L < 0.5) return pointBlocked(world, tx, ty, r) ? freeSpot(world, tx, ty, r) : { x: tx, y: ty };
  const step = Math.max(4, r * 0.5), n = Math.ceil(L / step);
  let lx = fx, ly = fy;
  if (pointBlocked(world, fx, fy, r)) { const f = freeSpot(world, fx, fy, r); lx = f.x; ly = f.y; return { x: lx, y: ly }; }
  for (let i = 1; i <= n; i++) {
    const k = i / n, x = fx + dx * k, y = fy + dy * k;
    if (pointBlocked(world, x, y, r)) break;
    lx = x; ly = y;
  }
  return { x: lx, y: ly };
}
/** The nearest walkable point to (x, y) for a circle of radius r (rings outward; falls back to the point). */
export function freeSpot(world, x, y, r) {
  if (!pointBlocked(world, x, y, r)) return { x, y };
  for (let ring = 1; ring <= 14; ring++) {
    const rr = ring * Math.max(8, r * 0.6), n = 8 + ring * 4;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (!pointBlocked(world, px, py, r)) return { x: px, y: py }; }
  }
  return { x, y };
}
/** Last line of defence for players: if a skill / a shove left you inside a solid, pop out to the nearest free spot. */
export function unstick(world, e) {
  if (!pointBlocked(world, e.x, e.y, e.r * 0.5)) return false;
  const f = freeSpot(world, e.x, e.y, e.r);
  e.x = f.x; e.y = f.y;
  return true;
}

/** the fixed mission entrances round each biome's camp (pure: same seed -> same spots for every client and the server) */
function opsGatesFor(world) {
  const camps = { ...OPS_CAMPS, dunes: { x: DUNES_POS.x, y: DUNES_POS.y, r: 330, a0: Math.PI * 0.5 }, frost: { x: FROST_CAMP.x, y: FROST_CAMP.y, r: FROST_CAMP_R + 40, a0: -Math.PI * 0.5 }, ember: { x: EMBER_CAMP.x, y: EMBER_CAMP.y, r: EMBER_CAMP_R + 40, a0: -Math.PI * 0.25 }, rift: { x: RIFT_CAMP.x, y: RIFT_CAMP.y, r: RIFT_CAMP_R + 40, a0: -Math.PI * 0.75 } };
  const biomeOf = (x, y) => { const z = zoneAt(x, y); if (!z || z.town || z.tomb || z.crypt || z.forge || z.trial || z.ops || z.hollow) return null; return inDunesArea(x, y) ? 'dunes' : inFrostArea(x, y) ? 'frost' : inEmberArea(x, y) ? 'ember' : inRiftArea(x, y) ? 'rift' : inRaidArea(x, y) || inAstArea(x, y) ? null : 'wilds'; };
  const RD = { wilds: WILDS_ROADS, dunes: DUNES_ROADS, frost: FROST_ROADS, ember: EMBER_ROADS, rift: RIFT_ROADS };
  return placeOpsGates(camps, world.sites || [], world.spawners || [], (x, y, r) => pointBlocked(world, x, y, r), biomeOf, (b, x, y) => (RD[b] ? roadDist(RD[b], x, y) : 1e9));
}
