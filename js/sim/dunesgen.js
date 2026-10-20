// Seeded layout of the Sunscorch Dunes disc and the Tomb chambers: obstacles (sandstone, cacti, palms, ruins, tomb
// pillars), visual decor and the Dunes enemy spawners. Called by world.js with its own RNG stream, so the Wilds layout
// is unchanged. Same seed -> identical on every client and the server.
import { Rng } from './rng.js';
import { DUNES_SHAPE, DUNES_WALLS, DUNES_SITES, DUNES_ELITES, DUNES_ROADS, dunesSite, roadDist } from './mapshape.js';
import { Placer, ringPoint, buildWalls, nookWall, roadEntry } from './mapgen.js';
import { DUNES_POS, DUNES_R, DUNES_SEED, DUNES_ZONES, OVERLORD_POS, OVERLORD_R, TOMB_ROOMS, OBELISKS, BRAZIERS, dunesZoneAt } from './dunesconst.js';

export const DUNES_SPAWNERS = { 3: 54, 4: 54, 5: 46, 6: 38 };
/** Danger -> enemy HP/damage multiplier for the ring a spawner sits in. */
export const DUNES_MUL = { 3: 1, 4: 1.25, 5: 1.55, 6: 1.9 }; // (enemy DAMAGE per ring; HP: the level curve, sim/mobhp.js)
export const DUNES_GROUPS = {
  3: [['scarab', 'scarab'], ['jackal', 'jackal'], ['sandwurm'], ['mirage', 'scarab']],
  4: [['scarab', 'scarab', 'scarab'], ['sandwurm', 'scarab'], ['jackal', 'jackal', 'jackal'], ['mirage', 'jackal']],
  5: [['mirage', 'mirage'], ['sandwurm', 'jackal'], ['scarab', 'scarab', 'mirage'], ['jackal', 'jackal', 'jackal']],
  6: [['sandwurm', 'sandwurm'], ['mirage', 'mirage', 'scarab'], ['jackal', 'jackal', 'jackal', 'jackal'], ['sandwurm', 'mirage']],
};
/** Dunes world bosses besides Khepra: [site, type, danger] */
export const DUNES_BOSSES = [['ankhara', 'ankhara', 5], ['sekhem', 'sekhem', 6]];
const TIER = { 3: 3, 4: 4, 5: 4, 6: 5 };

export function generateDunes(spawners, obstacles, decor) {
  const rng = new Rng(DUNES_SEED);
  const C = DUNES_POS, S = DUNES_SHAPE, roads = DUNES_ROADS;
  const P = new Placer(220);
  const zoneOf = (x, y) => dunesZoneAt(x, y).id;
  const sites = Object.keys(DUNES_SITES).map((k) => ({ k, ...dunesSite(k) }));
  const nearSite = (x, y, pad) => sites.some((s) => Math.hypot(x - s.x, y - s.y) < s.r + pad);
  const nearOverlord = (x, y, pad) => Math.hypot(x - OVERLORD_POS.x, y - OVERLORD_POS.y) < OVERLORD_R + pad;
  const addOb = (o) => { obstacles.push(o); P.add(o.x, o.y, o.r * 1.1, 1); };
  for (const o of buildWalls(rng, S, DUNES_WALLS, roads, sites.map((s) => ({ x: s.x, y: s.y, r: s.r + 60 })), 'mesa', zoneOf, { tag: { dunes: 1 }, s0: 60, s1: 82 })) addOb(o);
  // boss nooks: mesa horseshoes open toward the road in (Khepra's gorge head, Ankhara's crater, Sekhem's terrace)
  for (const [k, z, pad] of [['khepra', 24, 160], ['ankhara', 23, 130], ['sekhem', 24, 140]]) { const s = k === 'khepra' ? { x: OVERLORD_POS.x, y: OVERLORD_POS.y, r: OVERLORD_R } : dunesSite(k); for (const o of nookWall(rng, s, roadEntry(roads, s), 'mesa', z, { pad, tag: { dunes: 1 } })) addOb(o); }
  for (const z of DUNES_ZONES) {
    const n = DUNES_SPAWNERS[z.danger];
    if (!n) continue;
    let made = 0, tries = 0;
    while (made < n && tries++ < n * 60) {
      const p = ringPoint(rng, S, z.r0 + 90, z.r1 - 100);
      if (Math.hypot(p.x - C.x, p.y - C.y) < 380 || nearSite(p.x, p.y, 160) || roadDist(roads, p.x, p.y) < 90) continue;
      if (!P.clear(p.x, p.y, 40, 70) || spawners.some((s) => s.dunes && Math.abs(s.x - p.x) < 250 && Math.hypot(s.x - p.x, s.y - p.y) < 250)) continue;
      const g = DUNES_GROUPS[z.danger];
      spawners.push({ id: spawners.length + 1, x: p.x, y: p.y, zone: z.danger, group: g[made % g.length], boss: false, mul: DUNES_MUL[z.danger], tier: z.tier, dunes: 1 });
      P.add(p.x, p.y, 70, 2);
      made++;
    }
  }
  for (const el of DUNES_ELITES) { const p = { x: el.x, y: el.y }; spawners.push({ id: spawners.length + 1, x: p.x, y: p.y, zone: el.danger, group: el.group, boss: false, elitePack: 1, mul: DUNES_MUL[el.danger] * 1.15, tier: TIER[el.danger], dunes: 1 }); P.add(p.x, p.y, 110, 2); }
  spawners.push({ id: spawners.length + 1, x: OVERLORD_POS.x, y: OVERLORD_POS.y, zone: 6, group: ['khepra'], boss: true, tier: 5, dunes: 1, site: 'khepra' });
  for (const [k, type, dz] of DUNES_BOSSES) { const s = dunesSite(k); spawners.push({ id: spawners.length + 1, x: s.x, y: s.y, zone: dz, group: [type], boss: true, tier: 5, dunes: 1, site: k }); }
  // landmarks: the Sunken Sphinx, the Glass Crater, the Broken Colossus
  const site = (k) => sites.find((s) => s.k === k);
  { const L = site('sphinx'); addOb({ kind: 'sphinx', x: L.x, y: L.y, size: 120, r: 70, zone: zoneOf(L.x, L.y), variant: 1, dunes: 1, landmark: 'sphinx' }); }
  { const L = site('crater'); for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.4; addOb({ kind: 'glass', x: Math.round(L.x + Math.cos(a) * (L.r - 30)), y: Math.round(L.y + Math.sin(a) * (L.r - 40)), size: 30 + (i * 5) % 12, r: 18, zone: zoneOf(L.x, L.y), variant: i * 19, dunes: 1 }); } decor.push({ kind: 'crater', x: L.x, y: L.y, size: L.r, zone: 22, variant: 0, dunes: 1 }); }
  { const L = site('colossus'); addOb({ kind: 'colossus', x: L.x, y: L.y, size: 100, r: 62, zone: zoneOf(L.x, L.y), variant: 2, dunes: 1, landmark: 'colossus' }); for (let i = 0; i < 4; i++) { const a = i * 1.7 + 0.6; addOb({ kind: 'ruin', x: Math.round(L.x + Math.cos(a) * 140), y: Math.round(L.y + Math.sin(a) * 120), size: 32, r: 22, zone: zoneOf(L.x, L.y), variant: i * 41, dunes: 1 }); } }
  // boss arenas: Ankhara's glass spires, Sekhem's sun-dial pylons
  { const B = site('ankhara'), toC = Math.atan2(roadEntry(roads, B).y - B.y, roadEntry(roads, B).x - B.x); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + 0.3; if (Math.abs(Math.atan2(Math.sin(a - toC), Math.cos(a - toC))) < 0.4) continue; addOb({ kind: 'glass', x: Math.round(B.x + Math.cos(a) * (B.r + 40)), y: Math.round(B.y + Math.sin(a) * (B.r + 40)), size: 40, r: 22, zone: 23, variant: 600 + i, dunes: 1 }); } }
  { const B = site('sekhem'); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; addOb({ kind: 'sunobelisk', x: Math.round(B.x + Math.cos(a) * (B.r + 36)), y: Math.round(B.y + Math.sin(a) * (B.r + 36)), size: 30, r: 24, zone: 24, variant: i, dunes: 1 }); } }
  const clear = (x, y, r) => {
    const d = Math.hypot(x - C.x, y - C.y);
    if (d < 300 + r || !S.inside(x, y, -50 - r)) return false;
    if (nearOverlord(x, y, r + 40) || nearSite(x, y, r + 40) || roadDist(roads, x, y) < 40 + r) return false;
    return P.clear(x, y, r, 16);
  };
  const place = (kind, count, s0, s1, rf, r0 = 0, r1 = DUNES_R) => {
    let made = 0, tries = 0;
    while (made < count && tries++ < count * 40) {
      const p = ringPoint(rng, S, r0, r1), size = s0 + (s1 - s0) * rng.next();
      if (!clear(p.x, p.y, size * rf + 8)) continue;
      addOb({ kind, x: p.x, y: p.y, size: Math.round(size), r: Math.round(size * rf), zone: zoneOf(p.x, p.y), variant: Math.floor(rng.next() * 1000), dunes: 1 });
      made++;
    }
  };
  place('sandrock', 520, 22, 48, 0.82);
  place('cactus', 420, 26, 42, 0.32, 300, 2500);
  place('ruin', 150, 26, 40, 0.7, 1400, DUNES_R);
  // oasis palms (a ring around the pool, outside the walkable plaza) and the Overlord arena's sun obelisks
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + 0.3; obstacles.push({ kind: 'palm', x: Math.round(C.x + Math.cos(a) * 240), y: Math.round(C.y + Math.sin(a) * 215), size: 52 + (i * 7) % 14, r: 12, zone: 0, variant: i * 41, dunes: 1 }); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; obstacles.push({ kind: 'sunobelisk', x: Math.round(OVERLORD_POS.x + Math.cos(a) * (OVERLORD_R + 36)), y: Math.round(OVERLORD_POS.y + Math.sin(a) * (OVERLORD_R + 36)), size: 30, r: 24, zone: 24, variant: i, dunes: 1 }); }
  for (let i = 0; i < 1000; i++) { const p = ringPoint(rng, S, 300, DUNES_R - 50); if (nearOverlord(p.x, p.y, 20) || nearSite(p.x, p.y, 10) || !S.inside(p.x, p.y, -40)) continue; decor.push({ kind: rng.next() < 0.5 ? 'drybush' : 'skull', x: p.x, y: p.y, size: Math.round(16 + rng.next() * 14), zone: zoneOf(p.x, p.y), variant: Math.floor(rng.next() * 1000), dunes: 1 }); }
  // Tomb chambers: sandstone pillars (cover) inside the three wave rooms; the sanctum's obelisks are solid too
  TOMB_ROOMS.forEach((R, ri) => {
    if (ri < 3) {
      const n = ri === 1 ? 6 : 4;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + (ri === 1 ? 0 : Math.PI / 4); obstacles.push({ kind: 'tombpillar', x: Math.round(R.x + Math.cos(a) * 225), y: Math.round(R.y + Math.sin(a) * 200), size: 30, r: 26, zone: 30, variant: ri * 10 + i, tomb: 1 }); }
    }
  });
  for (const o of OBELISKS) obstacles.push({ kind: 'tombobelisk', x: o.x, y: o.y, size: 34, r: o.r, zone: 30, variant: 0, tomb: 1 });
  for (const b of BRAZIERS) decor.push({ kind: 'brazier', x: b.x, y: b.y, size: 24, zone: 30, variant: 0, tomb: 1 });
}
