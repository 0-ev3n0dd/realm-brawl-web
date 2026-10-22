// Seeded layout of Frostveil Peaks and the Glacier Crypt vaults: obstacles (ice ridges, snowy pines, frost boulders,
// ice crystals, landmarks), visual decor and the Frostveil enemy spawners. Called by world.js with its own RNG stream,
// so the Wilds / Dunes layouts are unchanged. Same seed -> identical on every client and the server.
import { Rng } from './rng.js';
import { roadDist } from './mapshape.js';
import { Placer, ringPoint, buildWalls, nookWall, roadEntry } from './mapgen.js';
import { FROST_SHAPE, FROST_WALLS, FROST_SITES, FROST_ELITES, FROST_ROADS, FROST_ZONES, FROST_CAMP, FROST_CAMP_R, FROST_SEED, FROST_RR, CRYPT_ROOMS, frostSite, frostZoneAt } from './frostconst.js';

/** spawners per danger ring (Frostveil is ~1.25x the Wilds' land, so a little denser than the Dunes) */
export const FROST_SPAWNERS = { 4: 52, 5: 80, 6: 66, 7: 36 };
/** Danger -> enemy HP/damage multiplier for the ring a spawner sits in (base stats are Danger 4) */
export const FROST_MUL = { 4: 1, 5: 1.3, 6: 1.65, 7: 2.05 };
/** balance pass: extra enemy HP only (not damage) per Danger ring: the gear you arrive with melted these packs */
export const FROST_HP = { 4: 1.2, 5: 1.3, 6: 1.4, 7: 1.5 }; // (folded into the mob HP level curve, sim/mobhp.js: only off-curve spawns still use it)
export const FROST_GROUPS = {
  4: [['penguin', 'penguin', 'penguin'], ['yeti'], ['shardwisp', 'penguin'], ['penguin', 'penguin', 'shardwisp']],
  5: [['yeti', 'penguin', 'penguin'], ['rimewraith', 'shardwisp'], ['penguin', 'penguin', 'penguin', 'penguin'], ['shardwisp', 'shardwisp']],
  6: [['rimewraith', 'rimewraith'], ['yeti', 'shardwisp', 'shardwisp'], ['yeti', 'yeti'], ['rimewraith', 'penguin', 'penguin', 'penguin']],
  7: [['rimewraith', 'rimewraith', 'shardwisp'], ['yeti', 'yeti', 'rimewraith'], ['shardwisp', 'shardwisp', 'shardwisp'], ['yeti', 'rimewraith', 'penguin', 'penguin']],
};
/** Frostveil world bosses: [site, type, danger] (Skaldra = the Overlord, the hunt target) */
export const FROST_BOSSES = [['skaldra', 'skaldra', 7], ['vyrnhal', 'vyrnhal', 6], ['morwen', 'morwen', 5]];
const TIER = { 4: 4, 5: 5, 6: 5, 7: 5 };

export function generateFrost(spawners, obstacles, decor) {
  const rng = new Rng(FROST_SEED);
  const S = FROST_SHAPE, roads = FROST_ROADS, C = FROST_CAMP;
  const P = new Placer(220);
  const zoneOf = (x, y) => frostZoneAt(x, y).id;
  const sites = Object.keys(FROST_SITES).map((k) => ({ k, ...frostSite(k) }));
  const nearSite = (x, y, pad) => sites.some((s) => Math.hypot(x - s.x, y - s.y) < s.r + pad);
  const addOb = (o) => { obstacles.push(o); P.add(o.x, o.y, o.kind === 'pine' ? o.r * 1.6 : o.r * 1.1, 1); };
  const tag = { frost: 1 };
  for (const o of buildWalls(rng, S, FROST_WALLS, roads, sites.map((s) => ({ x: s.x, y: s.y, r: s.r + 60 })), 'icecliff', zoneOf, { tag, s0: 60, s1: 84 })) addOb(o);
  for (const [k, , d] of FROST_BOSSES) { const s = frostSite(k); for (const o of nookWall(rng, s, roadEntry(roads, s), 'icecliff', 40 + d - 3, { pad: 150, tag })) addOb(o); }
  P.add(C.x, C.y, FROST_CAMP_R + 120, 1);
  for (const z of FROST_ZONES) {
    const n = FROST_SPAWNERS[z.danger];
    if (!n) continue;
    let made = 0, tries = 0;
    while (made < n && tries++ < n * 80) {
      const p = ringPoint(rng, S, z.r0 + 90, z.r1 - 100);
      if (frostZoneAt(p.x, p.y).danger !== z.danger) continue;
      if (Math.hypot(p.x - C.x, p.y - C.y) < FROST_CAMP_R + 300 || nearSite(p.x, p.y, 170) || roadDist(roads, p.x, p.y) < 90) continue;
      if (!P.clear(p.x, p.y, 40, 70) || spawners.some((s) => s.frost && Math.abs(s.x - p.x) < 260 && Math.hypot(s.x - p.x, s.y - p.y) < 260)) continue;
      const g = FROST_GROUPS[z.danger];
      spawners.push({ id: spawners.length + 1, x: p.x, y: p.y, zone: z.danger, group: g[made % g.length], boss: false, mul: FROST_MUL[z.danger], hpMul: FROST_HP[z.danger], tier: z.tier, frost: 1 });
      P.add(p.x, p.y, 70, 2);
      made++;
    }
  }
  for (const el of FROST_ELITES) { spawners.push({ id: spawners.length + 1, x: el.x, y: el.y, zone: el.danger, group: el.group, boss: false, elitePack: 1, mul: FROST_MUL[el.danger] * 1.15, hpMul: FROST_HP[el.danger], tier: TIER[el.danger], frost: 1 }); P.add(el.x, el.y, 110, 2); }
  for (const [k, type, dz] of FROST_BOSSES) { const s = frostSite(k); spawners.push({ id: spawners.length + 1, x: s.x, y: s.y, zone: dz, group: [type], boss: true, tier: 5, frost: 1, site: k }); }
  // landmarks: the Frozen Falls, the Titan's Ribs, the Moonwell shrine, the Shardglass Spire, the camp
  const site = (k) => sites.find((s) => s.k === k);
  { const L = site('falls'); addOb({ kind: 'frozenfalls', x: L.x, y: L.y - 40, size: 120, r: 80, zone: zoneOf(L.x, L.y), variant: 3, frost: 1, landmark: 'falls' }); }
  { const L = site('ribs'); for (let i = 0; i < 6; i++) { const t = (i - 2.5) / 2.5; for (const sd of [-1, 1]) addOb({ kind: 'rib', x: Math.round(L.x + t * 150), y: Math.round(L.y + sd * (70 - Math.abs(t) * 25)), size: 40, r: 16, zone: zoneOf(L.x, L.y), variant: i * 2 + (sd > 0 ? 1 : 0), side: sd, frost: 1 }); }
    addOb({ kind: 'titanskull', x: L.x + 230, y: L.y, size: 70, r: 50, zone: zoneOf(L.x, L.y), variant: 1, frost: 1, landmark: 'ribs' }); }
  { const L = site('shrine'); decor.push({ kind: 'moonwell', x: L.x, y: L.y, size: L.r, zone: zoneOf(L.x, L.y), variant: 0, frost: 1 }); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; addOb({ kind: 'runestone', x: Math.round(L.x + Math.cos(a) * L.r), y: Math.round(L.y + Math.sin(a) * L.r * 0.8), size: 30, r: 16, zone: zoneOf(L.x, L.y), variant: i, frost: 1 }); } }
  { const L = site('spire'); addOb({ kind: 'spire', x: L.x, y: L.y, size: 90, r: 52, zone: zoneOf(L.x, L.y), variant: 2, frost: 1, landmark: 'spire' }); for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.3; addOb({ kind: 'crystal', x: Math.round(L.x + Math.cos(a) * (L.r + 20)), y: Math.round(L.y + Math.sin(a) * (L.r + 10)), size: 30 + (i * 7) % 14, r: 16, zone: zoneOf(L.x, L.y), variant: i * 31, frost: 1 }); } }
  // Hearthstone Camp: tents + a ring of lanterns round the hearth (the safe zone)
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; obstacles.push({ kind: 'tent', x: Math.round(C.x + Math.cos(a) * 230), y: Math.round(C.y + Math.sin(a) * 190), size: 46, r: 30, zone: 0, variant: i, frost: 1 }); }
  decor.push({ kind: 'hearth', x: C.x, y: C.y, size: 60, zone: 0, variant: 0, frost: 1 });
  // boss arenas: Skaldra's ice teeth, Vyrnhal's echo pillars, Morwen's candy-cane posts
  const ring = (k, kind, n, pad, size, r, skip = 0.4) => { const B = site(k), e = roadEntry(roads, B), toC = Math.atan2(e.y - B.y, e.x - B.x); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + 0.2; if (Math.abs(Math.atan2(Math.sin(a - toC), Math.cos(a - toC))) < skip) continue; addOb({ kind, x: Math.round(B.x + Math.cos(a) * (B.r + pad)), y: Math.round(B.y + Math.sin(a) * (B.r + pad)), size, r, zone: zoneOf(B.x, B.y), variant: i, frost: 1 }); } };
  ring('skaldra', 'crystal', 14, 40, 44, 22);
  ring('vyrnhal', 'echopillar', 10, 36, 34, 22);
  ring('morwen', 'candycane', 12, 34, 30, 14);
  const clear = (x, y, r) => {
    if (Math.hypot(x - C.x, y - C.y) < FROST_CAMP_R + 120 + r || !S.inside(x, y, -50 - r)) return false;
    if (nearSite(x, y, r + 50) || roadDist(roads, x, y) < 44 + r) return false;
    return P.clear(x, y, r, 16);
  };
  const place = (kind, count, s0, s1, rf, re0 = 0, re1 = FROST_RR) => {
    let made = 0, tries = 0;
    while (made < count && tries++ < count * 40) {
      const p = ringPoint(rng, S, re0, re1), size = s0 + (s1 - s0) * rng.next(), r = size * rf;
      if (!clear(p.x, p.y, kind === 'pine' ? r * 1.6 : r + 8)) continue;
      addOb({ kind, x: p.x, y: p.y, size: Math.round(size), r: Math.round(r), zone: zoneOf(p.x, p.y), variant: Math.floor(rng.next() * 1000), frost: 1 });
      made++;
    }
  };
  place('pine', 1100, 44, 76, 0.32, 300, 3300); // the taiga belt (thick woods low down)
  place('pine', 260, 40, 64, 0.32, 3300, 4300);
  place('snowrock', 560, 18, 44, 0.84, 600, FROST_RR);
  place('crystal', 260, 24, 46, 0.5, 2700, FROST_RR); // ice crystals up on the glacier + the crown
  for (let i = 0; i < 1300; i++) {
    const p = ringPoint(rng, S, 200, FROST_RR - 60);
    if (nearSite(p.x, p.y, 20) || !S.inside(p.x, p.y, -40) || Math.hypot(p.x - C.x, p.y - C.y) < FROST_CAMP_R) continue;
    const re = S.re(p.x, p.y), h = rng.next();
    decor.push({ kind: re > 3600 ? (h < 0.6 ? 'icecrack' : 'bones') : re > 2600 ? (h < 0.5 ? 'icecrack' : 'drift') : (h < 0.55 ? 'frostbush' : 'drift'), x: p.x, y: p.y, size: Math.round(16 + rng.next() * 16), zone: zoneOf(p.x, p.y), variant: Math.floor(rng.next() * 1000), frost: 1 });
  }
  // the Glacier Crypt: frozen pillars (cover) in the three wave vaults
  CRYPT_ROOMS.forEach((R, ri) => {
    if (R.board) return;
    const n = ri === 1 ? 6 : 4;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + (ri === 1 ? 0 : Math.PI / 4); obstacles.push({ kind: 'cryptpillar', x: Math.round(R.x + Math.cos(a) * 225), y: Math.round(R.y + Math.sin(a) * 200), size: 30, r: 26, zone: 50, variant: ri * 10 + i, crypt: 1 }); }
  });
}
