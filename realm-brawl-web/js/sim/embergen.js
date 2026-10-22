// Seeded layout of Emberdeep Caldera and the Forge of Cinders halls: obstacles (basalt ridges, obsidian spires, charred
// ash trees, magma boulders, sulphur crystals, landmarks), visual decor and the Emberdeep enemy spawners. Called by
// world.js with its own RNG stream, so every other layout is unchanged. Same seed -> identical on every client + server.
import { Rng } from './rng.js';
import { roadDist } from './mapshape.js';
import { Placer, ringPoint, buildWalls, nookWall, roadEntry } from './mapgen.js';
import { EMBER_SHAPE, EMBER_WALLS, EMBER_SITES, EMBER_ELITES, EMBER_ROADS, EMBER_ZONES, EMBER_CAMP, EMBER_CAMP_R, EMBER_SEED, EMBER_RR, EMBER_VENTS, FORGE_ROOMS, emberSite, emberZoneAt, lavaDist, LAVA_W } from './emberconst.js';

/** spawners per danger band (Emberdeep is about Frostveil's size) */
export const EMBER_SPAWNERS = { 4: 52, 5: 80, 6: 66, 7: 36 };
/** Danger -> enemy HP/damage multiplier for the band a spawner sits in (base stats are Danger 4) */
export const EMBER_MUL = { 4: 1, 5: 1.3, 6: 1.65, 7: 2.05 };
/** balance pass: extra enemy HP only (not damage) per Danger ring: the gear you arrive with melted these packs */
export const EMBER_HP = { 4: 1.3, 5: 1.45, 6: 1.6, 7: 1.75 }; // (folded into the mob HP level curve, sim/mobhp.js: only off-curve spawns still use it)
export const EMBER_GROUPS = {
  4: [['kindler', 'kindler', 'kindler'], ['basalt'], ['moth', 'kindler'], ['kindler', 'kindler', 'moth']],
  5: [['basalt', 'kindler', 'kindler'], ['mortar', 'moth'], ['lavaeel', 'kindler', 'kindler'], ['moth', 'moth', 'moth']],
  6: [['lavaeel', 'lavaeel'], ['basalt', 'mortar', 'kindler'], ['basalt', 'basalt'], ['mortar', 'moth', 'moth']],
  7: [['lavaeel', 'mortar', 'moth'], ['basalt', 'basalt', 'lavaeel'], ['mortar', 'mortar', 'kindler', 'kindler'], ['moth', 'moth', 'lavaeel', 'kindler']],
};
/** Emberdeep world bosses: [site, type, danger] (Pyrrhex = the Overlord, the hunt target) */
export const EMBER_BOSSES = [['pyrrhex', 'pyrrhex', 7], ['solgrim', 'solgrim', 6], ['vitrea', 'vitrea', 5]];
const TIER = { 4: 4, 5: 5, 6: 5, 7: 5 };
/** Solgrim's sundial: the obsidian gnomons inside the arena that cast the only shade at a Solar Flare */
export function gnomons(site = EMBER_SITES.solgrim) { return [0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * Math.PI * 2 + 0.6, rr = site.r * (i % 2 ? 0.58 : 0.5); return { x: Math.round(site.x + Math.cos(a) * rr), y: Math.round(site.y + Math.sin(a) * rr), r: 30 }; }); }

export function generateEmber(spawners, obstacles, decor) {
  const rng = new Rng(EMBER_SEED);
  const S = EMBER_SHAPE, roads = EMBER_ROADS, C = EMBER_CAMP;
  const P = new Placer(220);
  const zoneOf = (x, y) => emberZoneAt(x, y).id;
  const sites = Object.keys(EMBER_SITES).map((k) => ({ k, ...emberSite(k) }));
  const nearSite = (x, y, pad) => sites.some((s) => Math.hypot(x - s.x, y - s.y) < s.r + pad);
  const nearLava = (x, y, pad) => lavaDist(x, y) < LAVA_W / 2 + pad;
  const nearVent = (x, y, pad) => EMBER_VENTS.some((v) => Math.hypot(x - v.x, y - v.y) < v.r + pad);
  const addOb = (o) => { obstacles.push(o); P.add(o.x, o.y, o.r * 1.1, 1); };
  const tag = { ember: 1 };
  const prot = sites.map((s) => ({ x: s.x, y: s.y, r: s.r + 60 }));
  for (const o of buildWalls(rng, S, EMBER_WALLS, roads, prot, 'basaltcliff', zoneOf, { tag, s0: 60, s1: 84 })) if (!nearLava(o.x, o.y, 30)) addOb(o);
  for (const [k, , d] of EMBER_BOSSES) { const s = emberSite(k); for (const o of nookWall(rng, s, roadEntry(roads, s), 'basaltcliff', 60 + d - 3, { pad: 150, tag })) addOb(o); }
  P.add(C.x, C.y, EMBER_CAMP_R + 120, 1);
  for (const v of EMBER_VENTS) P.add(v.x, v.y, v.r + 30, 1);
  for (const z of EMBER_ZONES) {
    const n = EMBER_SPAWNERS[z.danger];
    if (!n) continue;
    let made = 0, tries = 0;
    while (made < n && tries++ < n * 80) {
      const p = ringPoint(rng, S, z.r0 + 90, z.r1 - 100);
      if (emberZoneAt(p.x, p.y).danger !== z.danger) continue;
      if (Math.hypot(p.x - C.x, p.y - C.y) < EMBER_CAMP_R + 300 || nearSite(p.x, p.y, 170) || roadDist(roads, p.x, p.y) < 90 || nearLava(p.x, p.y, 120)) continue;
      if (!P.clear(p.x, p.y, 40, 70) || spawners.some((s) => s.ember && Math.abs(s.x - p.x) < 260 && Math.hypot(s.x - p.x, s.y - p.y) < 260)) continue;
      const g = EMBER_GROUPS[z.danger];
      spawners.push({ id: spawners.length + 1, x: p.x, y: p.y, zone: z.danger, group: g[made % g.length], boss: false, mul: EMBER_MUL[z.danger], hpMul: EMBER_HP[z.danger], tier: z.tier, ember: 1 });
      P.add(p.x, p.y, 70, 2);
      made++;
    }
  }
  for (const el of EMBER_ELITES) { spawners.push({ id: spawners.length + 1, x: el.x, y: el.y, zone: el.danger, group: el.group, boss: false, elitePack: 1, mul: EMBER_MUL[el.danger] * 1.15, hpMul: EMBER_HP[el.danger], tier: TIER[el.danger], ember: 1 }); P.add(el.x, el.y, 110, 2); }
  for (const [k, type, dz] of EMBER_BOSSES) { const s = emberSite(k); spawners.push({ id: spawners.length + 1, x: s.x, y: s.y, zone: dz, group: [type], boss: true, tier: 6, ember: 1, site: k }); }
  // landmarks: the Brimstone Falls, the Dragon's Jaw, the Ember Shrine, the Obsidian Obelisk, the outpost
  const site = (k) => sites.find((s) => s.k === k);
  { const Lm = site('falls'); addOb({ kind: 'lavafall', x: Lm.x, y: Lm.y - 40, size: 120, r: 80, zone: zoneOf(Lm.x, Lm.y), variant: 3, ember: 1, landmark: 'falls' }); }
  { const Lm = site('skull'); for (let i = 0; i < 5; i++) { const t = (i - 2) / 2; for (const sd of [-1, 1]) addOb({ kind: 'fossilrib', x: Math.round(Lm.x - 140 + t * 120), y: Math.round(Lm.y + sd * (64 - Math.abs(t) * 20)), size: 40, r: 16, zone: zoneOf(Lm.x, Lm.y), variant: i * 2 + (sd > 0 ? 1 : 0), side: sd, ember: 1 }); }
    addOb({ kind: 'dragonskull', x: Lm.x + 140, y: Lm.y, size: 80, r: 56, zone: zoneOf(Lm.x, Lm.y), variant: 1, ember: 1, landmark: 'skull' }); }
  { const Lm = site('shrine'); decor.push({ kind: 'embershrine', x: Lm.x, y: Lm.y, size: Lm.r, zone: zoneOf(Lm.x, Lm.y), variant: 0, ember: 1 }); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; addOb({ kind: 'brazier', x: Math.round(Lm.x + Math.cos(a) * Lm.r), y: Math.round(Lm.y + Math.sin(a) * Lm.r * 0.8), size: 28, r: 15, zone: zoneOf(Lm.x, Lm.y), variant: i, ember: 1 }); } }
  { const Lm = site('obelisk'); addOb({ kind: 'obelisk', x: Lm.x, y: Lm.y, size: 90, r: 50, zone: zoneOf(Lm.x, Lm.y), variant: 2, ember: 1, landmark: 'obelisk' }); for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.3; addOb({ kind: 'sulfur', x: Math.round(Lm.x + Math.cos(a) * (Lm.r + 20)), y: Math.round(Lm.y + Math.sin(a) * (Lm.r + 10)), size: 28 + (i * 7) % 14, r: 15, zone: zoneOf(Lm.x, Lm.y), variant: i * 31, ember: 1 }); } }
  // Cinderwatch Outpost: smithy tents + a beacon (the safe zone)
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; obstacles.push({ kind: 'forgetent', x: Math.round(C.x + Math.cos(a) * 230), y: Math.round(C.y + Math.sin(a) * 190), size: 46, r: 30, zone: 0, variant: i, ember: 1 }); }
  decor.push({ kind: 'beacon', x: C.x, y: C.y, size: 60, zone: 0, variant: 0, ember: 1 });
  for (const v of EMBER_VENTS) decor.push({ kind: 'vent', x: v.x, y: v.y, size: v.r, zone: zoneOf(v.x, v.y), variant: v.ph, ember: 1 });
  // boss arenas: Pyrrhex's obsidian teeth, Solgrim's sundial gnomons (inside: they cast the shade), Vitrea's glass panes
  const ring = (k, kind, n, pad, size, r, skip = 0.4) => { const B = site(k), e = roadEntry(roads, B), toC = Math.atan2(e.y - B.y, e.x - B.x); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + 0.2; if (Math.abs(Math.atan2(Math.sin(a - toC), Math.cos(a - toC))) < skip) continue; addOb({ kind, x: Math.round(B.x + Math.cos(a) * (B.r + pad)), y: Math.round(B.y + Math.sin(a) * (B.r + pad)), size, r, zone: zoneOf(B.x, B.y), variant: i, ember: 1 }); } };
  ring('pyrrhex', 'obsidian', 14, 40, 46, 22);
  ring('solgrim', 'sulfur', 10, 36, 34, 18);
  ring('vitrea', 'glasspane', 12, 34, 32, 14);
  for (const g of gnomons()) obstacles.push({ kind: 'gnomon', x: g.x, y: g.y, size: 40, r: g.r, zone: zoneOf(g.x, g.y), variant: 0, ember: 1 });
  const clear = (x, y, r) => {
    if (Math.hypot(x - C.x, y - C.y) < EMBER_CAMP_R + 120 + r || !S.inside(x, y, -50 - r)) return false;
    if (nearSite(x, y, r + 50) || roadDist(roads, x, y) < 44 + r || nearLava(x, y, r + 20) || nearVent(x, y, r + 20)) return false;
    return P.clear(x, y, r, 16);
  };
  const place = (kind, count, s0, s1, rf, re0 = 0, re1 = EMBER_RR) => {
    let made = 0, tries = 0;
    while (made < count && tries++ < count * 40) {
      const p = ringPoint(rng, S, re0, re1), size = s0 + (s1 - s0) * rng.next(), r = size * rf;
      if (!clear(p.x, p.y, r + 8)) continue;
      addOb({ kind, x: p.x, y: p.y, size: Math.round(size), r: Math.round(r), zone: zoneOf(p.x, p.y), variant: Math.floor(rng.next() * 1000), ember: 1 });
      made++;
    }
  };
  place('ashtree', 520, 40, 66, 0.26, 300, 3300); // charred woods on the flats + the coast
  place('magmarock', 560, 18, 44, 0.84, 600, EMBER_RR);
  place('obsidian', 300, 26, 48, 0.5, 2500, EMBER_RR); // obsidian spires up in the wastes + the crater
  place('sulfur', 160, 22, 40, 0.5, 1800, 4200);
  for (let i = 0; i < 1300; i++) {
    const p = ringPoint(rng, S, 200, EMBER_RR - 60);
    if (nearSite(p.x, p.y, 20) || !S.inside(p.x, p.y, -40) || Math.hypot(p.x - C.x, p.y - C.y) < EMBER_CAMP_R || nearLava(p.x, p.y, 10)) continue;
    const re = S.re(p.x, p.y), h = rng.next();
    decor.push({ kind: re > 3600 ? (h < 0.6 ? 'magmacrack' : 'bones') : re > 2600 ? (h < 0.5 ? 'magmacrack' : 'ashpile') : (h < 0.5 ? 'cinders' : 'ashpile'), x: p.x, y: p.y, size: Math.round(16 + rng.next() * 16), zone: zoneOf(p.x, p.y), variant: Math.floor(rng.next() * 1000), ember: 1 });
  }
  // the Forge of Cinders: anvils + quench barrels (cover) in the three wave halls
  FORGE_ROOMS.forEach((R, ri) => {
    if (R.foundry) return;
    const n = ri === 1 ? 6 : 4;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + (ri === 1 ? 0 : Math.PI / 4); obstacles.push({ kind: ri === 1 ? 'slagvat' : 'anvil', x: Math.round(R.x + Math.cos(a) * 225), y: Math.round(R.y + Math.sin(a) * 200), size: 30, r: 26, zone: 60, variant: ri * 10 + i, forge: 1 }); }
  });
}
