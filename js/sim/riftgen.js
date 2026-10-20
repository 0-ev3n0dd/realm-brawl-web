// Seeded layout of the Astral Rift (Map 5, game loop C3): obstacles (shattered void ridges, voidglass boulders, star-crystal
// trees, crystal spires, landmarks), visual decor and the rift enemy spawners. Called by world.js with its OWN RNG stream
// (and appended after every other map), so every existing layout and spawner id is unchanged.
import { Rng } from './rng.js';
import { roadDist } from './mapshape.js';
import { Placer, ringPoint, buildWalls, nookWall, roadEntry } from './mapgen.js';
import { RIFT_SHAPE, RIFT_WALLS, RIFT_SITES, RIFT_ELITES, RIFT_ROADS, RIFT_ZONES, RIFT_CAMP, RIFT_CAMP_R, RIFT_SEED, RIFT_RR, RIFT_WELLS, riftSite, riftZoneAt, tearDist, TEAR_W } from './riftconst.js';

/** spawners per danger band (the Rift is Emberdeep's size) */
export const RIFT_SPAWNERS = { 4: 52, 5: 80, 6: 66, 7: 36 };
/** Danger -> enemy HP/damage multiplier for the band (base stats are Danger 4, like Emberdeep) */
export const RIFT_MUL = { 4: 1, 5: 1.3, 6: 1.65, 7: 2.05 };
export const RIFT_HP = { 4: 1.3, 5: 1.45, 6: 1.6, 7: 1.75 }; // (off-curve spawns only: the level curve, sim/mobhp.js, sets the rest)
export const RIFT_GROUPS = {
  4: [['voidling', 'voidling', 'voidling', 'riftstalker'], ['voidgolem'], ['starwisp', 'riftstalker'], ['riftstalker', 'riftstalker', 'voidarcher']],
  5: [['voidgolem', 'riftstalker', 'riftstalker'], ['voidarcher', 'starwisp'], ['astralknight', 'voidling', 'voidling'], ['starwisp', 'starwisp', 'voidarcher']],
  6: [['astralknight', 'voidarcher'], ['voidgolem', 'starwisp', 'riftstalker'], ['voidgolem', 'voidgolem'], ['voidarcher', 'voidarcher', 'starwisp']],
  7: [['astralknight', 'voidarcher', 'starwisp'], ['voidgolem', 'voidgolem', 'riftstalker'], ['voidarcher', 'voidarcher', 'riftstalker', 'riftstalker'], ['starwisp', 'starwisp', 'astralknight', 'voidling']],
};
/** the Astral Rift's world bosses: [site, type, danger] (Zerath = the hunt target) */
export const RIFT_BOSSES = [['zerath', 'zerath', 7], ['orrery', 'orrery', 6], ['nyxara', 'nyxara', 5]];
const TIER = { 4: 6, 5: 7, 6: 7, 7: 7 };

export function generateRift(spawners, obstacles, decor) {
  const rng = new Rng(RIFT_SEED);
  const S = RIFT_SHAPE, roads = RIFT_ROADS, C = RIFT_CAMP;
  const P = new Placer(220);
  const zoneOf = (x, y) => riftZoneAt(x, y).id;
  const sites = Object.keys(RIFT_SITES).map((k) => ({ k, ...riftSite(k) }));
  const nearSite = (x, y, pad) => sites.some((s) => Math.hypot(x - s.x, y - s.y) < s.r + pad);
  const nearTear = (x, y, pad) => tearDist(x, y) < TEAR_W / 2 + pad;
  const nearWell = (x, y, pad) => RIFT_WELLS.some((v) => Math.hypot(x - v.x, y - v.y) < v.r + pad);
  const addOb = (o) => { obstacles.push(o); P.add(o.x, o.y, o.r * 1.1, 1); };
  const tag = { rift: 1 };
  const prot = sites.map((s) => ({ x: s.x, y: s.y, r: s.r + 60 }));
  for (const o of buildWalls(rng, S, RIFT_WALLS, roads, prot, 'voidcliff', zoneOf, { tag, s0: 60, s1: 84 })) if (!nearTear(o.x, o.y, 30)) addOb(o);
  for (const [k, , d] of RIFT_BOSSES) { const s = riftSite(k); for (const o of nookWall(rng, s, roadEntry(roads, s), 'voidcliff', 60 + d - 3, { pad: 150, tag })) addOb(o); }
  P.add(C.x, C.y, RIFT_CAMP_R + 120, 1);
  for (const v of RIFT_WELLS) P.add(v.x, v.y, v.r + 30, 1);
  const first = spawners.length;
  for (const z of RIFT_ZONES) {
    const n = RIFT_SPAWNERS[z.danger];
    if (!n) continue;
    let made = 0, tries = 0;
    while (made < n && tries++ < n * 80) {
      const p = ringPoint(rng, S, z.r0 + 90, z.r1 - 100);
      if (riftZoneAt(p.x, p.y).danger !== z.danger) continue;
      if (Math.hypot(p.x - C.x, p.y - C.y) < RIFT_CAMP_R + 300 || nearSite(p.x, p.y, 170) || roadDist(roads, p.x, p.y) < 90 || nearTear(p.x, p.y, 120)) continue;
      if (!P.clear(p.x, p.y, 40, 70)) continue;
      let close = false; for (let i = first; i < spawners.length; i++) { const s = spawners[i]; if (Math.abs(s.x - p.x) < 260 && Math.hypot(s.x - p.x, s.y - p.y) < 260) { close = true; break; } }
      if (close) continue;
      const g = RIFT_GROUPS[z.danger];
      spawners.push({ id: spawners.length + 1, x: p.x, y: p.y, zone: z.danger, group: g[made % g.length], boss: false, mul: RIFT_MUL[z.danger], hpMul: RIFT_HP[z.danger], tier: z.tier, rift: 1 });
      P.add(p.x, p.y, 70, 2);
      made++;
    }
  }
  for (const el of RIFT_ELITES) { spawners.push({ id: spawners.length + 1, x: el.x, y: el.y, zone: el.danger, group: el.group, boss: false, elitePack: 1, mul: RIFT_MUL[el.danger] * 1.15, hpMul: RIFT_HP[el.danger], tier: TIER[el.danger], rift: 1 }); P.add(el.x, el.y, 160, 2); }
  for (const [k, type, dz] of RIFT_BOSSES) { const s = riftSite(k); spawners.push({ id: spawners.length + 1, x: s.x, y: s.y, zone: dz, group: [type], boss: true, tier: 7, rift: 1, site: k }); }
  const site = (k) => sites.find((s) => s.k === k);
  // landmarks: the Fallen Star, the Sleeping Colossus, the Moon Shrine, the Void Monolith
  { const Lm = site('star'); addOb({ kind: 'fallenstar', x: Lm.x, y: Lm.y, size: 70, r: 52, zone: zoneOf(Lm.x, Lm.y), variant: 0, rift: 1, landmark: 'star' }); }
  { const Lm = site('colossus'); addOb({ kind: 'colossus', x: Lm.x, y: Lm.y, size: 80, r: 60, zone: zoneOf(Lm.x, Lm.y), variant: 0, rift: 1, landmark: 'colossus' }); }
  { const Lm = site('shrine'); decor.push({ kind: 'moonshrine', x: Lm.x, y: Lm.y, size: Lm.r, zone: zoneOf(Lm.x, Lm.y), variant: 0, rift: 1 }); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; addOb({ kind: 'moonpillar', x: Math.round(Lm.x + Math.cos(a) * (Lm.r + 30)), y: Math.round(Lm.y + Math.sin(a) * (Lm.r + 30)), size: 26, r: 16, zone: zoneOf(Lm.x, Lm.y), variant: i, rift: 1 }); } }
  { const Lm = site('monolith'); addOb({ kind: 'monolith', x: Lm.x, y: Lm.y, size: 90, r: 50, zone: zoneOf(Lm.x, Lm.y), variant: 0, rift: 1, landmark: 'monolith' }); for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.3; addOb({ kind: 'riftspire', x: Math.round(Lm.x + Math.cos(a) * 120), y: Math.round(Lm.y + Math.sin(a) * 100), size: 28, r: 14, zone: zoneOf(Lm.x, Lm.y), variant: i, rift: 1 }); } }
  // Starfall Camp: star-silk tents round a star beacon (the safe zone)
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; obstacles.push({ kind: 'startent', x: Math.round(C.x + Math.cos(a) * 230), y: Math.round(C.y + Math.sin(a) * 190), size: 46, r: 30, zone: 0, variant: i, rift: 1 }); }
  decor.push({ kind: 'starbeacon', x: C.x, y: C.y, size: 60, zone: 0, variant: 0, rift: 1 });
  for (const v of RIFT_WELLS) decor.push({ kind: 'starwell', x: v.x, y: v.y, size: v.r, zone: zoneOf(v.x, v.y), variant: v.ph, rift: 1 });
  // boss arenas ringed with orbit stones (gap toward the road)
  const ring = (k, kind, n, pad, size, r) => { const B = site(k), e = roadEntry(roads, B), toC = Math.atan2(e.y - B.y, e.x - B.x); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + 0.2; if (Math.abs(Math.atan2(Math.sin(a - toC), Math.cos(a - toC))) < 0.4) continue; addOb({ kind, x: Math.round(B.x + Math.cos(a) * (B.r + pad)), y: Math.round(B.y + Math.sin(a) * (B.r + pad)), size, r, zone: zoneOf(B.x, B.y), variant: i, rift: 1 }); } };
  ring('zerath', 'riftspire', 14, 40, 46, 22);
  ring('orrery', 'orbitstone', 10, 36, 34, 18);
  ring('nyxara', 'riftspire', 12, 34, 32, 14);
  const clear = (x, y, r) => {
    if (Math.hypot(x - C.x, y - C.y) < RIFT_CAMP_R + 120 + r || !S.inside(x, y, -50 - r)) return false;
    if (nearSite(x, y, r + 50) || roadDist(roads, x, y) < 44 + r || nearTear(x, y, r + 20) || nearWell(x, y, r + 20)) return false;
    return P.clear(x, y, r, 16);
  };
  const place = (kind, count, s0, s1, rf, re0 = 0, re1 = RIFT_RR) => {
    let made = 0, tries = 0;
    while (made < count && tries++ < count * 40) {
      const p = ringPoint(rng, S, re0, re1), size = s0 + (s1 - s0) * rng.next(), r = size * rf;
      if (!clear(p.x, p.y, r + 8)) continue;
      addOb({ kind, x: p.x, y: p.y, size: Math.round(size), r: Math.round(r), zone: zoneOf(p.x, p.y), variant: Math.floor(rng.next() * 1000), rift: 1 });
      made++;
    }
  };
  place('startree', 480, 40, 66, 0.26, 300, 3300); // star-crystal groves on the steppe + the coast
  place('voidrock', 560, 18, 44, 0.84, 600, RIFT_RR);
  place('riftspire', 300, 26, 48, 0.5, 2500, RIFT_RR); // crystal spires up in the reaches + the Breach
  place('starbloom', 160, 22, 40, 0.5, 1800, 4200);
  for (let i = 0; i < 1300; i++) {
    const p = ringPoint(rng, S, 200, RIFT_RR - 60);
    if (nearSite(p.x, p.y, 20) || !S.inside(p.x, p.y, -40) || Math.hypot(p.x - C.x, p.y - C.y) < RIFT_CAMP_R || nearTear(p.x, p.y, 10)) continue;
    const re = S.re(p.x, p.y), h = rng.next();
    decor.push({ kind: re > 3600 ? (h < 0.6 ? 'voidcrack' : 'shards') : re > 2600 ? (h < 0.5 ? 'voidcrack' : 'stardust') : (h < 0.5 ? 'moonmoss' : 'stardust'), x: p.x, y: p.y, size: Math.round(16 + rng.next() * 16), zone: zoneOf(p.x, p.y), variant: Math.floor(rng.next() * 1000), rift: 1 });
  }
}
