// Spawn sites (spawns pass, step 1 of the 4-step overhaul): fixed, seeded swarm sites spread over every open-world zone.
// Each site is a landmark (ruins / a camp / a nest, drawn by the client in the classic style) with a big cluster of fodder
// round it. Picked from the ordinary camp spots (already valid, walkable ground in the right biome), spaced so the next
// swarm is always in sight. Same seed -> same sites for every client and the server (world.sites; sim/sites.js runs them).
import { Rng } from './rng.js';
import { zoneAt, BOSS_POS, BOSS_ARENA_R, inRaidArea } from './constants.js';
import { inAstArea } from './astraelconst.js';
import { ENEMIES } from './data/enemies.js';

export const SITEGEN = {
  gap: 1000,          // min distance between two site centres (px)
  probe: 380,         // the ground this far round a centre must be the same hostile biome ring
  bossPad: 900,       // clear of every world-boss arena (radius + this)
  elitePad: 520,      // clear of the fixed elite packs (they stay where they are)
  size: { 1: [20, 30], 2: [28, 40], 3: [36, 50], 4: [44, 60] }, // fodder per site by ring (solo)
  elites: { 1: [0, 1], 2: [1, 1], 3: [1, 2], 4: [2, 3] },
};

/** per biome / Wilds ring: fodder mix (types repeat = weight), the caster type, elite types, landmark styles */
export const SITE_ROSTERS = {
  w1: { f: ['slime', 'slime', 'slime', 'goblin', 'goblin', 'sprout'], c: 'shroom', e: ['goblin', 'boar'], lm: ['camp', 'ruin', 'nest'] },
  w2: { f: ['goblin', 'goblin', 'skeleton', 'skeleton', 'slime', 'boar', 'shroom'], c: 'shroom', e: ['boar', 'skeleton'], lm: ['camp', 'ruin', 'grave'] },
  w3: { f: ['wolf', 'wolf', 'wolf', 'wisp', 'wisp', 'skeleton'], c: 'wisp', e: ['golem', 'wolf'], lm: ['den', 'ruin', 'grave'] },
  w4: { f: ['wolf', 'wolf', 'imp', 'imp', 'skeleton', 'wisp'], c: 'wisp', e: ['knight', 'golem'], lm: ['ruin', 'den', 'grave'] },
  dunes: { f: ['scarabling', 'scarabling', 'jackal', 'jackal', 'jackal', 'scarab', 'mummy', 'sunpriest', 'mirage'], c: 'sunpriest', e: ['mummy', 'scarab'], lm: ['obelisk', 'nest', 'camp'] },
  frost: { f: ['penguin', 'penguin', 'penguin', 'rimewraith', 'shardwisp', 'shardwisp', 'yeti'], c: 'acolyte', e: ['yeti', 'sentinel'], lm: ['cairn', 'camp', 'den'] },
  ember: { f: ['cinderling', 'cinderling', 'cinderling', 'kindler', 'kindler', 'moth', 'mortar'], c: 'moth', e: ['basalt', 'thrall'], lm: ['vent', 'ruin', 'camp'] },
  rift: { f: ['voidling', 'voidling', 'voidling', 'riftstalker', 'riftstalker', 'starwisp', 'voidarcher'], c: 'starwisp', e: ['voidgolem', 'astralknight'], lm: ['ruin', 'obelisk', 'camp'] }, // (game loop C3)
};

/** where a world point sits, site-wise: null (no sites) or { key, ring } */
export function siteZone(x, y) {
  if (inRaidArea(x, y) || inAstArea(x, y)) return null;
  const z = zoneAt(x, y);
  if (!z || !(z.danger > 0) || z.town || z.trial || z.tomb || z.crypt || z.forge) return null;
  if (z.dunes) return { key: 'dunes', ring: z.id - 20, z };
  if (z.frost) return { key: 'frost', ring: z.id - 40, z };
  if (z.ember) return { key: 'ember', ring: z.id - 60, z };
  if (z.rift) return { key: 'rift', ring: z.id - 100, z };
  if (z.id >= 1 && z.id <= 4) return { key: 'w' + z.id, ring: z.id, z };
  return null;
}

/** the no-site circles: every world-boss arena (+ pad) */
export function bossZones(spawners, pad = SITEGEN.bossPad) {
  const out = [];
  for (const sp of spawners) if (sp.boss) { const A = ENEMIES[sp.group[0]] && ENEMIES[sp.group[0]].arena; out.push({ x: sp.x, y: sp.y, r: (A ? A.r : BOSS_ARENA_R) + pad }); }
  out.push({ x: BOSS_POS.x, y: BOSS_POS.y, r: BOSS_ARENA_R + pad });
  return out;
}

const bio = (k) => (k[0] === 'w' ? 'w' : k);
/** Build the site list (+ landmark decor). Own RNG stream: the rest of the layout is unchanged. */
export function generateSites(seed, spawners, obstacles, decor, more = null) {
  // (game loop C3: `more` = { sites, only }: a second pass over just the Astral Rift's spawners with its own stream, appended
  //  to the first pass's list, so every existing site keeps its id, place and roll)
  const rng = new Rng(((seed | 0) * 13 + (more ? 0x2a17f : 0x517e5)) >>> 0), G = SITEGEN;
  const bz = bossZones(spawners), elites = spawners.filter((s) => s.elitePack);
  const cands = spawners.filter((s) => !s.boss && !s.elitePack && (!more || more.only(s))).map((s) => ({ s, k: rng.next() })).sort((a, b) => a.k - b.k).map((c) => c.s);
  const sites = more ? more.sites : [], grid = new Map(), cell = G.gap;
  const near = (x, y) => { const cx = Math.floor(x / cell), cy = Math.floor(y / cell); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const o of grid.get((cx + i) + ',' + (cy + j)) || []) if ((o.x - x) ** 2 + (o.y - y) ** 2 < G.gap * G.gap) return true; return false; };
  for (const sp of cands) {
    const sz = siteZone(sp.x, sp.y); if (!sz) continue;
    if (near(sp.x, sp.y)) continue;
    if (bz.some((b) => (sp.x - b.x) ** 2 + (sp.y - b.y) ** 2 < b.r * b.r)) continue;
    if (elites.some((e) => (sp.x - e.x) ** 2 + (sp.y - e.y) ** 2 < G.elitePad * G.elitePad)) continue;
    let ok = true;
    for (let i = 0; i < 8 && ok; i++) { const a = (i / 8) * Math.PI * 2, q = siteZone(sp.x + Math.cos(a) * G.probe, sp.y + Math.sin(a) * G.probe); if (!q || bio(q.key) !== bio(sz.key)) ok = false; }
    if (!ok) continue;
    const R = SITE_ROSTERS[sz.key], ring = Math.max(1, Math.min(4, sz.ring)), [s0, s1] = G.size[ring], [e0, e1] = G.elites[ring];
    const site = {
      id: sites.length, x: sp.x, y: sp.y, key: sz.key, ring, zone: sz.z.id, tier: sp.tier || sz.z.tier || ring,
      mul: sp.mul || 1, hpMul: sp.hpMul || 1, size: s0 + Math.floor(rng.next() * (s1 - s0 + 1)), elites: e0 + Math.floor(rng.next() * (e1 - e0 + 1)),
      lm: R.lm[Math.floor(rng.next() * R.lm.length)], seed: Math.floor(rng.next() * 1e6),
    };
    sites.push(site);
    const k = Math.floor(sp.x / cell) + ',' + Math.floor(sp.y / cell); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(site);
    decor.push({ kind: 'landmark', lm: site.lm, key: site.key, x: site.x, y: site.y, size: 70, zone: site.zone, variant: site.seed % 1000, site: site.id });
  }
  void obstacles;
  return sites;
}
