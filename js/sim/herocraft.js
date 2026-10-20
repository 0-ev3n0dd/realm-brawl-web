// Hero unlocks, Warframe / TFD style (2026-10-16): every locked hero is built from a Blueprint + 3 crafted parts.
//   Hero Cache (one per hero) - drops from that hero's missions / bosses (HERO_SOURCES); opening one rolls, with an EQUAL
//                               chance (1/4 each), the Blueprint or one of the 3 part components
//   Part (Helm / Core / Armor)  - crafted from 2 of its component + gold (instant)
//   Assemble                    - Blueprint + all 3 parts + gold -> the hero unlocks (instant, a flashy moment)
//   Exchange (Quartermaster)    - 3 surplus pieces (any hero: components / blueprints you no longer need) -> 1 piece you
//                                 are missing, your choice (duplicate protection)
// State lives in the account's unlock record (sim/heroUnlock.js profile.heroUnlock.by[cls].prog):
//   prog = { cache, bp, c: { helm, core, armor }, p: { helm, core, armor } }   (counts; p = crafted parts 0/1)
// Pure: the client (client/rewards.js) grants caches per player on its own events, so co-op drops are per player.
import { HERO_IDS } from './heroes.js';
import { migrateHeroUnlocks, unlockHero, isUnlocked } from './heroUnlock.js';

export const PARTS = ['helm', 'core', 'armor'];
export const PART_NAME = { helm: 'Helm', core: 'Core', armor: 'Armor' };
export const COMP_NEED = 2; // components per part
export const POOL = ['bp', ...PARTS]; // cache roll: each 1/4
export const EXCHANGE_RATE = 3; // surplus pieces -> 1 missing piece
/** gold per hero band (early heroes cheaper) */
const BAND = { warrior: 1, ranger: 1, mage: 1, cleric: 2, bard: 2, summoner: 3, monk: 3, bladedancer: 4, dragoon: 4, samurai: 5 };
export const partCost = (cls) => 400 * (BAND[cls] || 1);
export const assembleCost = (cls) => 1000 * (BAND[cls] || 1);
/** where hero caches drop (2026-10-18: by MAP). Every source of a map rolls ONE cache at chance p, split evenly among that
 *  map's still-locked heroes (none locked = no roll). ops = a mission clear on that map, boss = a boss kill (enemy type),
 *  world = an open-world elite kill on that map. The Astral Rift has none for now (reserved for Rift-unlocked / Ascended heroes). */
export const CACHE_MAPS = [
  { id: 'wilds', name: 'The Wilds', heroes: ['warrior', 'ranger', 'mage'], src: [
    { world: 'wilds', name: 'Haven Meadow open world (elites)', p: 0.03 }, { ops: 'wilds', name: 'Wilds missions', p: 0.3 },
    { boss: 'boss', name: 'Grimtusk, the Ashen Warlord', p: 0.5 }, { boss: 'thornmaw', name: 'Thornmaw, the Elder Treant', p: 0.5 }, { boss: 'ashfang', name: 'Ashfang, the Pack Alpha', p: 0.5 },
    { boss: 'lumivex', name: 'Lumivex (Glowmire Hollow)', p: 0.6 }, { boss: 'trvharok', name: 'Vharok, the Stormhorn (Trial)', p: 0.6 }, { boss: 'trvharokx', name: 'Vharok, the Stormhorn (Extreme)', p: 0.8 }] },
  { id: 'dunes', name: 'Sunscorch Dunes', heroes: ['cleric', 'bard', 'summoner'], src: [
    { ops: 'dunes', name: 'Sunscorch Dunes missions', p: 0.25 }, { boss: 'neferakh', name: 'Neferakh (Tomb of the Sun-Eaten King)', p: 0.6 },
    { boss: 'ankhara', name: 'Ankhara, the Glass Scorpion', p: 0.4 }, { boss: 'sekhem', name: 'Sekhem, the Sun Colossus', p: 0.4 }, { boss: 'khepra', name: 'Khepra, the Sandwurm Queen', p: 0.5 },
    { boss: 'trneferakh', name: 'Neferakh Unbound (Trial)', p: 0.6 }, { boss: 'trneferakhx', name: 'Neferakh Unbound (Extreme)', p: 0.8 }, { boss: 'trneferakhs', name: 'Neferakh Unbound (Savage)', p: 1 }] },
  { id: 'frost', name: 'Frostveil Peaks', heroes: ['monk', 'bladedancer'], src: [
    { ops: 'frost', name: 'Frostveil Peaks missions', p: 0.25 }, { boss: 'osric', name: 'Osric (Glacier Crypt)', p: 0.6 },
    { boss: 'morwen', name: 'Mother Morwen', p: 0.4 }, { boss: 'vyrnhal', name: 'Vyrnhal, the Echo Stag', p: 0.4 },
    { boss: 'trskaldra', name: 'Skaldra, the Glacier Wyrm (Trial)', p: 0.6 }, { boss: 'trskaldrax', name: 'Skaldra (Extreme)', p: 0.8 }] },
  { id: 'ember', name: 'Emberdeep Caldera', heroes: ['dragoon', 'samurai'], src: [
    { ops: 'ember', name: 'Emberdeep Caldera missions', p: 0.25 }, { boss: 'hephast', name: 'Hephast (Forge of Cinders)', p: 0.6 },
    { boss: 'vitrea', name: 'Vitrea, the Glassblower', p: 0.4 }, { boss: 'solgrim', name: 'Solgrim, the Ember Sundial', p: 0.4 },
    { boss: 'trpyrrhex', name: 'Pyrrhex, the Caldera Heart (Trial)', p: 0.6 }, { boss: 'trpyrrhexx', name: 'Pyrrhex (Extreme)', p: 0.8 }] },
];
/** per hero: its map's sources (UI + tests) */
export const HERO_SOURCES = Object.fromEntries(CACHE_MAPS.flatMap((M) => M.heroes.map((c) => [c, M.src])));
export const mapOfHero = (cls) => CACHE_MAPS.find((M) => M.heroes.includes(cls)) || null;
export function progOf(pr, cls) {
  const U = migrateHeroUnlocks(pr, []), e = U.by[cls]; if (!e) return null;
  const g = e.prog && typeof e.prog === 'object' ? e.prog : (e.prog = {});
  g.cache = g.cache | 0; g.bp = g.bp | 0; g.c = { helm: 0, core: 0, armor: 0, ...(g.c || {}) }; g.p = { helm: 0, core: 0, armor: 0, ...(g.p || {}) };
  return g;
}
/** which hero caches a mission / boss / elite kill can drop: [{ cls: [locked heroes of that map], p }] */
export function cacheDrops(pr, src) {
  const out = [];
  for (const M of CACHE_MAPS) for (const s of M.src) {
    if (!((src.ops && s.ops === src.ops) || (src.boss && s.boss === src.boss) || (src.world && s.world === src.world))) continue;
    const L = M.heroes.filter((c) => !isUnlocked(pr, c)); if (L.length) out.push({ cls: L, p: s.p, map: M.id });
  }
  return out;
}
/** roll the drops of one event (rng() 0..1); returns the hero ids that got a cache (mutates pr) */
export function rollCaches(pr, src, rng = Math.random) {
  const got = [];
  for (const d of cacheDrops(pr, src)) if (rng() < d.p) { const cls = Array.isArray(d.cls) ? d.cls[Math.floor(rng() * d.cls.length)] : d.cls; progOf(pr, cls).cache++; got.push(cls); }
  return got;
}
/** open one cache: 'bp' | 'helm' | 'core' | 'armor', each exactly 1/4 */
export function openCache(pr, cls, rng = Math.random) {
  const g = progOf(pr, cls); if (!g || g.cache <= 0) return null;
  g.cache--; const k = POOL[Math.min(POOL.length - 1, Math.floor(rng() * POOL.length))];
  if (k === 'bp') g.bp++; else g.c[k]++; return k;
}
export const canCraftPart = (pr, cls, part, gold = pr.gold | 0) => { const g = progOf(pr, cls); return !!g && !g.p[part] && g.c[part] >= COMP_NEED && gold >= partCost(cls); };
export function craftPart(pr, cls, part) {
  if (!PARTS.includes(part) || !canCraftPart(pr, cls, part)) return false;
  const g = progOf(pr, cls); g.c[part] -= COMP_NEED; g.p[part] = 1; pr.gold = (pr.gold | 0) - partCost(cls); return true;
}
export const canAssemble = (pr, cls) => { const g = progOf(pr, cls); return !!g && !isUnlocked(pr, cls) && g.bp >= 1 && PARTS.every((k) => g.p[k]) && (pr.gold | 0) >= assembleCost(cls); };
export function assemble(pr, cls, now = Date.now()) {
  if (!canAssemble(pr, cls)) return false;
  const g = progOf(pr, cls); g.bp--; for (const k of PARTS) g.p[k] = 0; pr.gold = (pr.gold | 0) - assembleCost(cls);
  return unlockHero(pr, cls, 'craft', now);
}
/** pieces a hero still needs: { bp, helm, core, armor } (0 once unlocked) */
export function missing(pr, cls) {
  const g = progOf(pr, cls), out = { bp: 0, helm: 0, core: 0, armor: 0 }; if (!g || isUnlocked(pr, cls)) return out;
  out.bp = Math.max(0, 1 - g.bp); for (const k of PARTS) out[k] = g.p[k] ? 0 : Math.max(0, COMP_NEED - g.c[k]); return out;
}
/** surplus pieces (any hero): [{ cls, k, n }] - owned beyond what is still needed (unlocked heroes: everything) */
export function surplus(pr) {
  const out = [];
  for (const cls of HERO_IDS) {
    const g = progOf(pr, cls); if (!g) continue; const un = isUnlocked(pr, cls);
    const xb = un ? g.bp : Math.max(0, g.bp - 1); if (xb) out.push({ cls, k: 'bp', n: xb });
    for (const k of PARTS) { const x = un || g.p[k] ? g.c[k] : Math.max(0, g.c[k] - COMP_NEED); if (x) out.push({ cls, k, n: x }); }
  }
  return out;
}
export const surplusCount = (pr) => surplus(pr).reduce((a, s) => a + s.n, 0);
/** trade EXCHANGE_RATE surplus pieces (taken from the largest piles first) for 1 missing piece of cls */
export function exchange(pr, cls, k) {
  if (!POOL.includes(k) || !(missing(pr, cls)[k] > 0) || surplusCount(pr) < EXCHANGE_RATE) return false;
  let need = EXCHANGE_RATE;
  while (need > 0) { const s = surplus(pr).sort((a, b) => b.n - a.n)[0]; if (!s) return false; const g = progOf(pr, s.cls); if (s.k === 'bp') g.bp--; else g.c[s.k]--; need--; }
  const g = progOf(pr, cls); if (k === 'bp') g.bp++; else g.c[k]++; return true;
}
/** the drop-source lines for the UI */
export const sourcesOf = (cls) => (HERO_SOURCES[cls] || []).filter((s) => s.name);
