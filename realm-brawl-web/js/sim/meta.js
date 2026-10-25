// Progression and replay rewards (experience pass 2). Pure data + functions, shared by the client UIs, the sim (item
// upgrades in computeStats) and the tests:
//   - biome materials (per zone drops) and gold
//   - gear upgrades +1..+10 (main stats +7 % per level; gold + materials; from +7 a success chance with pity)
//   - Forge recipes (gear and the crafted sets from materials)
//   - the account level (shared by every hero in this browser) and its milestone unlocks
//   - daily / weekly bounties (seeded by the date: the same three for everyone that day)
//   - mission ranks S / A / B and best-time records
//   - the profile save (its own key, versioned + migrated; seeded from existing heroes the first time)
import { generateItem, TIER_LV } from './loot.js';
import { makeSetItem, SETS } from './sets.js';
import { makeExotic, EXOTIC_SLOTS } from './exotic.js';
import { SLOTS, SET_SLOTS, OFFHAND, AFFIXES, AFFIX_SWAP, GEAR, subKOf, TIER_MAX, TIER_WORD } from './data/items.js';
import { mainKeys, mainTierK, subTierK, rollSlot, rollSub, subPool, tsOf } from './loot.js';
import { normAutoSalvage } from './autosalvage.js';
import { normOpsBest } from './opsbest.js';

// ------------------------------------------------------------------ materials + gold
export const MATERIALS = {
  astral_ash: { name: 'Astral Ash', biome: 'rift', tier: 4, color: '#9d8cff', desc: 'Grey-violet ash from Rift missions. Ascension material.' },
  starsteel: { name: 'Starsteel', biome: 'rift', tier: 5, color: '#e4ecff', desc: 'Metal cooled in starlight, from Astrael and Rift missions. Ascension material.' },
  starheart: { name: 'Starheart', biome: 'rift', tier: 6, boss: true, color: '#ffe9a8', desc: 'A beating star from Astrael Savage. The rarest Ascension material.' },
  astral_dust: { name: 'Astral Dust', biome: 'rift', tier: 3, color: '#c9b6ff', desc: 'Starlight left behind when an Astral Fissure is closed.' },
  greenwood: { name: 'Greenwood Sap', biome: 'wilds', tier: 1, color: '#7ed957', desc: 'Sticky amber sap from Haven Meadow and the Wildwood.' },
  ashstone: { name: 'Ashstone Shard', biome: 'wilds', tier: 2, color: '#a99bc9', desc: 'Volcanic glass from the Ashen Wilds and the Dread Frontier.' },
  warlord_tusk: { name: 'Warlord Tusk', biome: 'wilds', tier: 3, color: '#f2e3c6', boss: true, desc: 'A trophy from Grimtusk or another Wilds warlord.' },
  sunglass: { name: 'Sunglass Shard', biome: 'dunes', tier: 2, color: '#ffd36a', desc: 'Sand fused to glass by the Sunscorch heat.' },
  chitin: { name: 'Gilded Chitin', biome: 'dunes', tier: 3, color: '#e0a83a', desc: 'Golden shell plates from scarabs and wurms.' },
  queen_scale: { name: "Queen's Scale", biome: 'dunes', tier: 4, color: '#ff9f43', boss: true, desc: 'A scale from Khepra or another desert colossus.' },
  tomb_linen: { name: 'Sun-Eaten Linen', biome: 'tomb', tier: 3, color: '#eadfc4', desc: 'Burial wraps that still hold a little sunlight.' },
  solar_ember: { name: 'Solar Ember', biome: 'tomb', tier: 5, color: '#ff6b3d', boss: true, desc: "A coal of Neferakh's stolen sun." },
  rimeshard: { name: 'Rimeshard', biome: 'frost', tier: 3, color: '#bfefff', desc: 'A splinter of never-melting ice from Frostveil Peaks.' },
  frostpelt: { name: 'Frostpelt Tuft', biome: 'frost', tier: 3, color: '#eef6ff', desc: 'Thick white fur, shed by yetis and penguins alike.' },
  wyrm_scale: { name: 'Glacier Wyrm Scale', biome: 'frost', tier: 5, color: '#7fd4ff', boss: true, desc: 'A mirror-bright scale from Skaldra or another Frostveil terror.' },
  grave_frost: { name: 'Grave Frost', biome: 'crypt', tier: 4, color: '#9fc4e8', desc: 'Hoarfrost scraped off the Glacier Crypt sarcophagi.' },
  gambit_crown: { name: "Rimeking's Crown Shard", biome: 'crypt', tier: 5, color: '#d8f2ff', boss: true, desc: "A cracked point of Osric's crown. It still wants to win." },
  cinderglass: { name: 'Cinderglass', biome: 'ember', tier: 4, color: '#ff8a4a', desc: 'Black volcanic glass with a coal still glowing inside, from Emberdeep Caldera.' },
  basalt_core: { name: 'Basalt Core', biome: 'ember', tier: 3, color: '#8a6a5a', desc: 'The hot heart of a basalt golem: heavy, and warm for days.' },
  heart_ember: { name: 'Caldera Heartstone', biome: 'ember', tier: 5, boss: true, color: '#ff4b1f', desc: 'A beating coal torn from Pyrrhex or another Emberdeep terror.' },
  slag_iron: { name: 'Slag Iron', biome: 'forge', tier: 4, color: '#c9a07a', desc: 'Raw iron skimmed off the Forge of Cinders\' crucibles.' },
  smith_seal: { name: "Cinder Smith's Seal", biome: 'forge', tier: 5, boss: true, color: '#ffd08a', desc: "Hephast's maker's mark, stamped on his last masterwork." },
  // game loop C3: the Astral Rift (Map 5, Lv 41-49)
  riftglass: { name: 'Riftglass', biome: 'rift', tier: 4, color: '#b48cff', desc: 'A shard of the broken sky, swept up across the Astral Rift.' },
  starsilk: { name: 'Starsilk', biome: 'rift', tier: 4, color: '#e8f0ff', desc: 'Cold, shimmering thread shed by rift elites and tough units.' },
  void_crest: { name: 'Void Crest', biome: 'rift', tier: 5, boss: true, color: '#6ae6ff', desc: 'The crest of Zerath or another Astral Rift terror. Ascension to tier 8 needs it.' },
  rift_core: { name: 'Rift Core', biome: 'raid', tier: 5, color: '#b86bff', boss: true, desc: 'The humming heart of a rift, torn from Vorthax.' },
  star_shard: { name: 'Star Shard', biome: 'trial', tier: 5, color: '#9fe0ff', boss: true, desc: "A splinter of Astrael's crown." },
  astral_heart: { name: 'Astral Heart', biome: 'trial', tier: 5, color: '#ffe27a', boss: true, token: 'extreme', desc: 'The collapsing core of a star. Only Astrael (Extreme) drops it.' },
  // the Frostveil / Emberdeep trials (piece 3): trial-only tokens + Extreme-only cores (piece 4 turns them into item tiers)
  rime_sigil: { name: 'Rimebound Sigil', biome: 'sktrial', tier: 5, color: '#aee8ff', boss: true, token: 'trial', desc: 'A trial token cut from the Hoarfrost Mirror. Only Skaldra (Trial / Extreme) drops it. Two attune the Realm Gate to Emberdeep.' },
  frozen_heart: { name: "Skaldra's Frozen Heart", biome: 'sktrial', tier: 5, color: '#c9b4ff', boss: true, token: 'extreme', desc: 'A heart of absolute-zero ice. Only Skaldra (Extreme) drops it.' },
  cinder_sigil: { name: 'Cinderbound Sigil', biome: 'pytrial', tier: 5, color: '#ffb36a', boss: true, token: 'trial', desc: 'A trial token stamped in the Heart-Chamber. Only Pyrrhex (Trial / Extreme) drops it.' },
  // the Sunscorch trial (game loop A2): Neferakh Unbound in the Sun-Eaten Throne
  sun_sigil: { name: 'Sunbound Sigil', biome: 'nftrial', tier: 5, color: '#ffd86a', boss: true, token: 'trial', desc: 'A trial token pressed in the Sun-Eaten Throne. Only Neferakh Unbound (Trial / Extreme) drops it. Two attune the Realm Gate to Frostveil.' },
  savage_mark: { name: 'Savage Mark', biome: 'nftrial', tier: 7, color: '#ff6a3d', boss: true, token: 'savage', desc: 'Struck for a Savage clear (1 a clear, +4 on your first clear of the week). 16 buy a Savage weapon at the Quartermaster.' },
  eclipse_heart: { name: "Neferakh's Eclipse Heart", biome: 'nftrial', tier: 5, color: '#b07cff', boss: true, token: 'extreme', desc: 'A black sun that still eats the light. Only Neferakh Unbound (Extreme) drops it.' },
  // the Wilds' dungeon + Trial (2026-10-18): the Glowmire Hollow (Lumivex) and the Stormcrown Tor (Vharok)
  glowspore: { name: 'Glowspore', biome: 'hollow', tier: 2, color: '#d8ff9a', desc: 'A softly glowing spore puff from the Glowmire Hollow.' },
  lumen_scale: { name: "Matriarch's Lumen Scale", biome: 'hollow', tier: 3, color: '#f4ffc8', boss: true, desc: "A wing scale that still glows, shed by Lumivex." },
  storm_sigil: { name: 'Stormbound Sigil', biome: 'vhtrial', tier: 4, color: '#9fdcff', boss: true, token: 'trial', desc: 'A trial token struck on the Stormcrown Tor. Only Vharok (Trial / Extreme) drops it.' },
  thunder_heart: { name: "Vharok's Thunder Heart", biome: 'vhtrial', tier: 5, color: '#c9a2ff', boss: true, token: 'extreme', desc: 'A heart that still crackles with the storm. Only Vharok (Extreme) drops it.' },
  molten_core: { name: "Pyrrhex's Molten Core", biome: 'pytrial', tier: 5, color: '#ff5a8a', boss: true, token: 'extreme', desc: 'The still-beating core of the Caldera Heart. Only Pyrrhex (Extreme) drops it.' },
};
/** extra drops for killing a trial boss, by enemy type (on top of the arena's boss material) */
export const TRIAL_DROPS = { trvharok: { storm_sigil: 2 }, trvharokx: { storm_sigil: 4, thunder_heart: 1 }, trskaldra: { rime_sigil: 2 }, trskaldrax: { rime_sigil: 4, frozen_heart: 1 }, trpyrrhex: { cinder_sigil: 2 }, trpyrrhexx: { cinder_sigil: 4, molten_core: 1 }, trneferakh: { sun_sigil: 2 }, trneferakhx: { sun_sigil: 4, eclipse_heart: 1 }, trneferakhs: { sun_sigil: 6, eclipse_heart: 2, savage_mark: 1 }, astraelx: { star_shard: 3, astral_heart: 1 } }; // (encounter pass: the 5-7 min fights pay more tokens per clear)
/** ex = the boss was an Extreme (Astrael shares one enemy type for both tiers) */
export function trialDrops(etype, ex = 0) { const d = TRIAL_DROPS[etype === 'astrael' && ex ? 'astraelx' : etype]; return d ? Object.entries(d).map(([id, n]) => ({ id, n })) : []; }
export const MAT_IDS = Object.keys(MATERIALS);
const BIOME_MATS = { hollow: ['glowspore', 'ashstone'], vhtrial: ['ashstone', 'glowspore'], rift: ['riftglass', 'starsilk'], wilds: ['greenwood', 'ashstone'], dunes: ['sunglass', 'chitin'], tomb: ['tomb_linen'], frost: ['rimeshard', 'frostpelt'], crypt: ['grave_frost', 'rimeshard'], ember: ['cinderglass', 'basalt_core'], forge: ['slag_iron', 'cinderglass'], raid: [], trial: [], sktrial: ['rimeshard', 'grave_frost'], pytrial: ['cinderglass', 'slag_iron'], nftrial: ['sunglass', 'tomb_linen'] };
const BOSS_MAT = { hollow: 'lumen_scale', vhtrial: 'storm_sigil', rift: 'void_crest', wilds: 'warlord_tusk', dunes: 'queen_scale', tomb: 'solar_ember', frost: 'wyrm_scale', crypt: 'gambit_crown', ember: 'heart_ember', forge: 'smith_seal', raid: 'rift_core', trial: 'star_shard', sktrial: 'rime_sigil', pytrial: 'cinder_sigil', nftrial: 'sun_sigil' };
/** Horde pass 2: each biome's materials by how rare they are. common = what fodder drop (the Wilds: Greenwood Sap in
 *  zones 1-2, Ashstone in 3-4), rare = the second material (normals sometimes, elites always), trophy = the boss material
 *  (bosses, and elites 1 time in 4). Used by the loot showers (sim/drops.js 'mat' entries). */
export const MAT_POOLS = {
  wilds: { common: 'greenwood', rare: 'ashstone', trophy: 'warlord_tusk' },
  hollow: { common: 'glowspore', rare: 'ashstone', trophy: 'lumen_scale' },
  vhtrial: { common: 'ashstone', rare: 'glowspore', trophy: null },
  dunes: { common: 'sunglass', rare: 'chitin', trophy: 'queen_scale' },
  tomb: { common: 'tomb_linen', rare: 'chitin', trophy: 'solar_ember' },
  frost: { common: 'rimeshard', rare: 'frostpelt', trophy: 'wyrm_scale' },
  crypt: { common: 'grave_frost', rare: 'rimeshard', trophy: 'gambit_crown' },
  ember: { common: 'cinderglass', rare: 'basalt_core', trophy: 'heart_ember' },
  forge: { common: 'slag_iron', rare: 'cinderglass', trophy: 'smith_seal' },
  rift: { common: 'riftglass', rare: 'starsilk', trophy: 'void_crest' },
  sktrial: { common: 'rimeshard', rare: 'grave_frost', trophy: null },
  pytrial: { common: 'cinderglass', rare: 'slag_iron', trophy: null },
  nftrial: { common: 'sunglass', rare: 'tomb_linen', trophy: null },
  // loop playtest fix (2026-10-15): the loot showers had no pool for the Rift Sanctum / the Star Sanctum, so Vorthax dropped
  // no Rift Cores (the Astral Sanctum's attunement) and Astrael no Star Shards; same 3-5 boss haul as the old roll (BOSS_MAT)
  raid: { common: null, rare: null, trophy: 'rift_core' },
  trial: { common: null, rare: null, trophy: 'star_shard' },
};
/** a material id from a biome pool ('common' | 'rare' | 'trophy' | 'any': common 70% / rare 30%) or null */
export function poolMat(rnd, biome, zone = 1, pool = 'common') {
  const P = MAT_POOLS[biome]; if (!P) return null;
  if (pool === 'any') pool = rnd() < 0.7 ? 'common' : 'rare';
  if (biome === 'wilds' && pool !== 'trophy') return pool === 'rare' ? 'ashstone' : (zone >= 3 ? 'ashstone' : 'greenwood');
  return P[pool] || null;
}
/** how common a material is, for the UI: 'Common' / 'Uncommon' / 'Rare' / 'Boss' / 'Token' */
export function matGrade(id) {
  const M = MATERIALS[id]; if (!M) return '';
  if (M.token) return 'Token';
  if (Object.values(MAT_POOLS).some((P) => P.trophy === id) || M.boss) return 'Boss';
  if (Object.values(MAT_POOLS).some((P) => P.common === id)) return 'Common';
  return 'Uncommon';
}
/** where a material comes from (tooltips) */
export const MAT_WHERE = {
  astral_ash: 'Astral Rift missions, Vorthax (Rift Sanctum), Astral World elites + bosses',
  starsteel: 'Astrael (Astral Trial and Savage), sometimes Rift missions + Astral World elites, Astral World bosses',
  starheart: 'Astrael Savage, Astral World bosses',
  astral_dust: 'Close Astral Fissures on any map, Weekly Board',
  greenwood: 'Wilds hordes (Haven Meadow, Wildwood)', ashstone: 'Wilds hordes (Ashen Wilds, Dread Frontier), Wilds elites', warlord_tusk: 'Wilds bosses (Grimtusk...), Wilds elites',
  sunglass: 'Sunscorch Dunes hordes', chitin: 'Dunes elites + tough units, Tomb', queen_scale: 'Dunes bosses (Khepra...), Dunes elites',
  tomb_linen: 'Tomb wave rooms', solar_ember: 'Neferakh (Tomb)', rimeshard: 'Frostveil hordes', frostpelt: 'Frostveil elites + tough units',
  wyrm_scale: 'Frostveil bosses (Skaldra...), Frostveil elites', grave_frost: 'Glacier Crypt vaults', gambit_crown: 'Osric (Crypt)',
  cinderglass: 'Emberdeep hordes', basalt_core: 'Emberdeep elites + tough units', heart_ember: 'Emberdeep bosses (Pyrrhex...), Emberdeep elites',
  riftglass: 'Astral Rift hordes', starsilk: 'Astral Rift elites + tough units', void_crest: 'Astral Rift bosses (Zerath...), Astral Rift elites',
  slag_iron: 'Forge of Cinders halls', smith_seal: 'Hephast (Forge)', rift_core: 'Vorthax (the Rift Sanctum, Map 5)', star_shard: 'Astrael (Trial)', astral_heart: 'Astrael (Extreme)',
  rime_sigil: 'Skaldra (Trial / Extreme)', frozen_heart: 'Skaldra (Extreme)', cinder_sigil: 'Pyrrhex (Trial / Extreme)', molten_core: 'Pyrrhex (Extreme)',
  sun_sigil: 'Neferakh Unbound (Trial / Extreme / Savage)', eclipse_heart: 'Neferakh Unbound (Extreme / Savage)', savage_mark: 'Savage clears (Astral mode: 1 a clear, +4 on the first clear of the week)',
  glowspore: 'Glowmire Hollow grottoes (Wilds dungeon)', lumen_scale: 'Lumivex (Glowmire Hollow)', storm_sigil: 'Vharok (Trial / Extreme)', thunder_heart: 'Vharok (Extreme)',
};
/** Which biome a kill at (x, y) belongs to. A = the area helpers { inTownArea, inRaidArea, inAstArea, inTombArea, inDunesArea }. */
export function biomeAt(x, y, A) {
  if (A.inRaidArea(x, y)) return 'raid';
  if (A.inAstArea(x, y)) return 'trial';
  if (A.trialBiome) { const t = A.trialBiome(x, y); if (t) return t; } // Skaldra / Pyrrhex trial arenas
  if (A.inHollowArea && A.inHollowArea(x, y)) return A.inTorArea && A.inTorArea(x, y) ? 'vhtrial' : 'hollow'; // (2026-10-18: the Wilds' dungeon / Trial)
  if (A.opsBiome) { const b = A.opsBiome(x, y); if (b) return b; } // mission arenas: their map's biome (sim/opsconst.js)
  if (A.inTombArea(x, y)) return 'tomb';
  if (A.inRiftArea && A.inRiftArea(x, y)) return 'rift'; // (game loop C3: the Astral Rift)
  if (A.inForgeArea && A.inForgeArea(x, y)) return 'forge';
  if (A.inEmberArea && A.inEmberArea(x, y)) return 'ember';
  if (A.inCryptArea && A.inCryptArea(x, y)) return 'crypt';
  if (A.inFrostArea && A.inFrostArea(x, y)) return 'frost';
  if (A.inDunesArea(x, y)) return 'dunes';
  if (A.inTownArea(x, y)) return 'town';
  return 'wilds';
}
/** Materials dropped by one kill: [{ id, n }]. zone 1..4; bonus = extra drop chance (account milestones). rnd() in 0..1. */
export function rollMaterials(rnd, { biome, zone = 1, elite = false, boss = false, bonus = 0 }) {
  const out = [], add = (id, n) => { if (!id || n <= 0) return; const o = out.find((x) => x.id === id); if (o) o.n += n; else out.push({ id, n }); };
  const pool = BIOME_MATS[biome] || [];
  // the Wilds: the low zones give sap, the high zones (3-4) mostly ashstone
  const pick = () => (biome === 'wilds' ? (rnd() < (zone >= 3 ? 0.75 : 0.15) ? 'ashstone' : 'greenwood') : pool[Math.floor(rnd() * pool.length)]);
  if (boss) { add(BOSS_MAT[biome], 3 + Math.floor(rnd() * 3)); if (pool.length) for (let i = 0; i < 6; i++) add(pick(), 1); return out; } // (encounter pass: longer boss fights, bigger boss hauls: 2-4 -> 3-5 boss mats, 4 -> 6 biome mats)
  if (!pool.length) return out;
  const chance = (elite ? 1 : 0.2 + 0.03 * zone) + bonus;
  if (rnd() < chance) add(pick(), elite ? 1 + Math.floor(rnd() * 2) : 1);
  if (elite && rnd() < 0.2 + bonus) add(BOSS_MAT[biome], 1);
  return out;
}
/** Gold from one kill. */
export function rollGold(rnd, { zone = 1, elite = false, boss = false, mul = 1 }) {
  const base = boss ? 360 + rnd() * 440 : (2 + rnd() * 3) * zone * (elite ? 4 : 1);
  return Math.max(1, Math.round(base * mul));
}

// ------------------------------------------------------------------ upgrades (+1..+10)
export const UPGRADE = { max: 10, main: 0.07, pct: 0.035 }; // (pct: a percentage main stat - gloves Crit, amulet Crit Damage, boots Speed, relics - climbs half as fast)
/** the item's stats with its upgrade level applied (main stats +7 % per +1, percentage mains +3.5 %; gear expansion:
 *  whatever the slot's main stats are, sub-stats stay); the stored base stats never change */
export function upStats(it) {
  const up = (it && it.up) | 0, out = {};
  if (!it || !it.stats) return out;
  const mk = up ? mainKeys(it) : [];
  for (const k in it.stats) { const v = it.stats[k]; out[k] = up && mk.includes(k) ? (Number.isInteger(v) ? Math.round(v * (1 + UPGRADE.main * up)) : +(v * (1 + UPGRADE.pct * up)).toFixed(3)) : v; }
  return out;
}
/** "+3 Iron Longsword" */
export const itemName = (it) => (it ? ((it.up | 0) > 0 ? `+${it.up} ` : '') + it.name : '');
/** the materials an item upgrades with: tier 1-3 Wilds, 4 Dunes, 5 Dunes / Tomb. Biome sets and Trial / Extreme pieces
 *  (balance pass) upgrade with the materials of the content that drops them, so farming that content also upgrades it. */
const UP_MATS = {
  wilds: ['greenwood', 'ashstone', 'warlord_tusk'], dunes: ['sunglass', 'chitin', 'queen_scale'], tomb: ['sunglass', 'chitin', 'solar_ember'],
  frost: ['rimeshard', 'grave_frost', 'gambit_crown'], ember: ['cinderglass', 'slag_iron', 'smith_seal'], star: ['rimeshard', 'cinderglass', 'star_shard'],
  rift: ['riftglass', 'starsilk', 'void_crest'], // (game loop C3: tier 7-8 and the Astral set)
};
const EX_UP = { rimebound: 'frost', zeropoint: 'frost', cinderbound: 'ember', worldheart: 'ember', starbound: 'star', bigbang: 'star', sunbound: 'tomb', blacksun: 'tomb' };
export function upMatSet(it) {
  if (it.set === 'frostveil') return UP_MATS.frost;
  if (it.set === 'emberdeep') return UP_MATS.ember;
  if (it.set === 'astral') return UP_MATS.rift;
  if (it.ex && EX_UP[it.ex]) return UP_MATS[EX_UP[it.ex]];
  const t = it.tier | 0 || 1;
  return t <= 3 ? UP_MATS.wilds : t >= 7 ? UP_MATS.rift : t === 6 ? UP_MATS.ember : t >= 5 ? UP_MATS.tomb : UP_MATS.dunes; // (game loop C3: t6 Emberdeep, t7-8 the Astral Rift)
}
function upMats(it, next) {
  const [a, b, c] = upMatSet(it), m = {};
  m[a] = 3 + 2 * next;            // (horde pass 2: hordes rain commons, so the +levels eat them: 140 for +1..+10)
  if (next >= 4) m[b] = 2 * (next - 3);
  if (next >= 7) m[c] = next - 6;
  return m;
}
/** cost of the next upgrade: { gold, mats, chance } (null at the cap) */
export function upgradeCost(it) {
  const cur = (it && it.up) | 0;
  if (!it || cur >= UPGRADE.max) return null;
  const next = cur + 1;
  return { next, gold: Math.round((40 + 25 * (it.tier | 0 || 1)) * next * (1 + next * 0.15)), mats: upMats(it, next), chance: upgradeChance(next, 0) };
}
/** success chance for upgrading TO level `next`; pity = failures in a row on this item (+10 % each) */
export const upgradeChance = (next, pity = 0) => Math.min(1, (next <= 6 ? 1 : [0.85, 0.72, 0.6, 0.5][next - 7]) + 0.1 * pity);
/** the highest + the account level allows */
export const upgradeCap = (accLv) => (accLv >= 10 ? 10 : accLv >= 7 ? 7 : accLv >= 4 ? 5 : 3);

// ------------------------------------------------------------------ Forge recipes
// cost = { gold, mats }; makes = { tier, rarity (minimum), set }; unlock = the milestone id that opens it
export const RECIPES = [
  // horde pass 2: costs sized for the horde stream (commons by the dozen) and spread over several biomes; `lv` = the hero
  // level the recipe needs (crafting tiers follow the hero's level, like ascending: TIER_LV)
  { id: 'wild_gear', name: 'Wildwood Gear', desc: 'A Rare or better tier-3 piece in the slot you choose.', tier: 3, rarity: 1, lv: 4, cost: { gold: 250, mats: { greenwood: 20, ashstone: 6 } }, unlock: 'forge' },
  { id: 'ash_gear', name: 'Ashforged Gear', desc: 'An Epic tier-4 piece in the slot you choose.', tier: 4, rarity: 2, lv: 8, cost: { gold: 650, mats: { ashstone: 20, sunglass: 6, warlord_tusk: 1 } }, unlock: 'forge' },
  { id: 'wildwarden', name: 'Wildwarden Regalia (set)', desc: 'A Wildwarden set piece in any slot but Relic (2: +140 HP, +2 regen · 4: +30 DEF, +5% speed, Brambleguard thorns).', set: 'wildwarden', lv: 6, cost: { gold: 600, mats: { greenwood: 25, ashstone: 12, warlord_tusk: 2 } }, unlock: 'set_wild' },
  { id: 'sun_gear', name: 'Sunglass Gear', desc: 'An Epic tier-4 piece in the slot you choose.', tier: 4, rarity: 2, lv: 8, cost: { gold: 800, mats: { sunglass: 20, chitin: 8 } }, unlock: 'forge_dunes' },
  { id: 'duneborn', name: 'Duneborn Panoply (set)', desc: 'A Duneborn set piece in any slot but Relic (2: +4% crit, +12% crit dmg · 4: +18 ATK, +4% speed, Sandstorm finishers).', set: 'duneborn', lv: 10, cost: { gold: 1400, mats: { sunglass: 25, chitin: 12, queen_scale: 2 } }, unlock: 'set_dune' },
  { id: 'royal_gear', name: 'Royal Tomb Gear', desc: 'An Epic-or-Legendary tier-5 piece in the slot you choose.', tier: 5, rarity: 2, legendary: 0.35, lv: 16, cost: { gold: 2400, mats: { tomb_linen: 16, chitin: 10, rimeshard: 10, solar_ember: 1 } }, unlock: 'forge_tomb' },
  { id: 'rime_gear', name: 'Rimeforged Gear', desc: 'An Epic-or-Legendary tier-5 piece (30% Legendary) from Frostveil horde materials.', tier: 5, rarity: 2, legendary: 0.3, lv: 20, cost: { gold: 2200, mats: { rimeshard: 25, frostpelt: 10, sunglass: 12 } }, unlock: 'forge' },
  { id: 'cinder_gear', name: 'Cinderforged Gear', desc: 'An Epic-or-Legendary tier-6 piece (40% Legendary) from Emberdeep horde materials.', tier: 6, rarity: 2, legendary: 0.4, lv: 30, cost: { gold: 2800, mats: { cinderglass: 25, basalt_core: 10, rimeshard: 12, chitin: 8 } }, unlock: 'forge' },
  // story patterns (experience pass 4: only the story chain opens these; see sim/story.js)
  { id: 'rift_gear', name: 'Riftforged Gear', desc: 'An Epic-or-Legendary tier-7 piece (50% Legendary) in the slot you choose.', tier: 7, rarity: 2, legendary: 0.5, lv: 44, cost: { gold: 6000, mats: { rift_core: 1, riftglass: 25, starsilk: 8, cinderglass: 10 } }, unlock: 'pat_rift', story: true },
  { id: 'star_gear', name: 'Starforged Gear', desc: 'A Legendary tier-7 piece in the slot you choose.', tier: 7, rarity: 3, lv: 48, cost: { gold: 8000, mats: { star_shard: 2, rift_core: 1, void_crest: 1, riftglass: 20, starsilk: 10 } }, unlock: 'pat_star', story: true },
  // piece 4: exclusive gear. Biome sets from that biome's materials; Trial / Extreme pieces still need their boss tokens.
  { id: 'rimewarden', name: 'Rimewarden Regalia (set)', desc: 'A Frostveil set piece in any slot but Relic (2: +120 HP, +25 DEF · 4: SHATTER: freeze enemies with frost, then shatter them).', set: 'frostveil', excl: 'set', lv: 22, cost: { gold: 2000, mats: { rimeshard: 25, frostpelt: 14, grave_frost: 6, wyrm_scale: 2 } }, unlock: 'forge' },
  { id: 'calderaset', name: 'Caldera Warplate (set)', desc: 'An Emberdeep set piece in any slot but Relic (2: +5% crit, +20 ATK · 4: ERUPTION: crits build Heat, then erupt).', set: 'emberdeep', excl: 'set', lv: 32, cost: { gold: 2400, mats: { cinderglass: 25, basalt_core: 14, slag_iron: 6, heart_ember: 2 } }, unlock: 'forge' },
  // game loop C3: the Astral Rift (Map 5, Lv 41-49): tier-7 gear + the Astral set from rift materials
  { id: 'astral_gear', name: 'Astral Gear', desc: 'An Epic-or-Legendary tier-7 piece (45% Legendary) from Astral Rift materials.', tier: 7, rarity: 2, legendary: 0.45, lv: 41, cost: { gold: 5000, mats: { riftglass: 25, starsilk: 8, cinderglass: 10 } }, unlock: 'forge' },
  { id: 'astralset', name: 'Astral Regalia (set)', desc: 'An Astral Rift set piece in any slot but Relic (2: +26 ATK, +15% crit dmg · 4: CONSTELLATION: pin stars, then connect them).', set: 'astral', excl: 'set', lv: 43, cost: { gold: 6000, mats: { riftglass: 30, starsilk: 12, void_crest: 2 } }, unlock: 'forge' },
  { id: 'rimebound', name: 'Rimebound (Trial)', desc: 'A Trial-tier piece (any slot but Relic) from Skaldra\'s sigils. RIME EDGE: hits chill; +20% vs chilled / frozen.', exotic: 'rimebound', excl: 'trial', lv: 26, cost: { gold: 3500, mats: { rime_sigil: 4, rimeshard: 20, frostpelt: 10, sunglass: 10 } }, unlock: 'forge' },
  { id: 'cinderbound', name: 'Cinderbound (Trial)', desc: 'A Trial-tier piece (any slot but Relic) from Pyrrhex\'s sigils. PRESSURE VALVE: every 8 s a ×2.2 ATK burst.', exotic: 'cinderbound', excl: 'trial', lv: 36, cost: { gold: 3500, mats: { cinder_sigil: 4, cinderglass: 20, basalt_core: 10, rimeshard: 8 } }, unlock: 'forge' },
  { id: 'starbound', name: 'Starbound (Trial)', desc: 'A Trial-tier piece (any slot but Relic) from Astrael\'s shards. STARFALL: 10% of hits call down a star.', exotic: 'starbound', excl: 'trial', lv: 46, cost: { gold: 5000, mats: { star_shard: 4, rift_core: 1, riftglass: 15, starsilk: 6 } }, unlock: 'forge' },
  { id: 'zeropoint', name: 'Zero-Point (Extreme)', desc: 'An Extreme-tier piece (any slot but Relic) around Skaldra\'s Frozen Heart. ABSOLUTE ZERO: a closing ring that freezes and hits ×4.', exotic: 'zeropoint', excl: 'extreme', lv: 28, cost: { gold: 7000, mats: { frozen_heart: 1, rime_sigil: 6, grave_frost: 8, rimeshard: 25, tomb_linen: 10 } }, unlock: 'forge' },
  { id: 'worldheart', name: 'Worldheart (Extreme)', desc: 'An Extreme-tier piece (any slot but Relic) around Pyrrhex\'s Molten Core. HEARTBEAT: every 4th beat a ×3 magma ring races out.', exotic: 'worldheart', excl: 'extreme', lv: 38, cost: { gold: 7000, mats: { molten_core: 1, cinder_sigil: 6, slag_iron: 8, cinderglass: 25, rimeshard: 15 } }, unlock: 'forge' },
  { id: 'bigbang', name: 'Big Bang (Extreme)', desc: 'An Extreme-tier piece (any slot but Relic) around the Astral Heart. SUPERNOVA: gather stardust, then a ×5 nova that drags enemies in.', exotic: 'bigbang', excl: 'extreme', lv: 48, cost: { gold: 9000, mats: { astral_heart: 1, star_shard: 6, void_crest: 1, riftglass: 25, starsilk: 10 } }, unlock: 'forge' },
  // game loop A2: the Sunscorch trial families (Neferakh Unbound)
  { id: 'sunbound', name: 'Sunbound (Trial)', desc: 'A Trial-tier piece (any slot but Relic) from Neferakh\'s sigils. SOLAR BRAND: every 5 s a hit brands the target; it flares 1 s later for ×2 ATK.', exotic: 'sunbound', excl: 'trial', lv: 18, cost: { gold: 3000, mats: { sun_sigil: 4, sunglass: 20, chitin: 10, tomb_linen: 8 } }, unlock: 'forge_tomb' },
  { id: 'blacksun', name: 'Black Sun (Extreme)', desc: 'An Extreme-tier piece (any slot but Relic) around Neferakh\'s Eclipse Heart. BLACK SUN: a hit opens a black sun that drags enemies in, burns, then collapses for ×3.', exotic: 'blacksun', excl: 'extreme', lv: 20, cost: { gold: 6000, mats: { eclipse_heart: 1, sun_sigil: 6, tomb_linen: 12, chitin: 14, queen_scale: 2 } }, unlock: 'forge_tomb' },
  // gear expansion: the Relic slot - relics also drop from elites, bosses, Swarm chests and Trials (sim/exotic.js RELIC_DROP)
  { id: 'reliquary', name: 'Reliquary Relic', desc: 'An Epic-or-Legendary tier-7 Relic (35% Legendary): boosts chain damage, Special damage or Ult charge.', relic: true, tier: 7, rarity: 2, legendary: 0.35, lv: 46, cost: { gold: 7000, mats: { star_shard: 2, rift_core: 1, void_crest: 1, riftglass: 15, cinderglass: 15 } }, unlock: 'forge' },
];
export const RECIPE = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
/** craft one item from a recipe (rng = { next() }), for class cls in slot */
export function craftItem(rng, recipe, cls, slot) {
  if (recipe.relic) slot = 'relic';
  slot = SLOTS.includes(slot) ? slot : rollSlot(rng);
  if (recipe.exotic) { const it = makeExotic(rng, recipe.exotic, cls, EXOTIC_SLOTS.includes(slot) ? slot : 'weapon'); it.crafted = 1; return it; }
  if (recipe.set) { const it = makeSetItem(rng, cls, SET_SLOTS.includes(slot) ? slot : 'weapon', recipe.set); if (recipe.excl) it.crafted = 1; return it; }
  if (slot === 'relic' && !recipe.relic) slot = 'weapon'; // (relics: only the Relic recipes)
  const rar = recipe.legendary && rng.next() < recipe.legendary ? 3 : Math.max(recipe.rarity, Math.min(3, recipe.rarity + (rng.next() < 0.25 ? 1 : 0)));
  const it = generateItem(rng, { tier: recipe.tier, cls, slot, rarity: rar });
  it.crafted = 1;
  return it;
}
/** can the profile pay this cost? */
export const canPay = (pr, cost) => (pr.gold | 0) >= (cost.gold | 0) && Object.entries(cost.mats || {}).every(([k, n]) => (pr.mats[k] | 0) >= n);
/** take the cost (true if paid) */
export function pay(pr, cost) {
  if (!canPay(pr, cost)) return false;
  pr.gold -= cost.gold | 0;
  for (const [k, n] of Object.entries(cost.mats || {})) pr.mats[k] -= n;
  return true;
}

// ------------------------------------------------------------------ substat reroll (game loop A3)
// Pick one sub-stat of a piece and roll it again: a fresh stat from the piece's pool (main stats never move; the other subs
// stay). The roll uses the item's own tier / rarity budget, so it can't exceed what a drop could have. Each reroll of the
// same piece costs more (it.rr counts them, the cost steps up to 8 times), so it is a gold + rare-material sink.
export const REROLL = { base: 150, perTier: 70, rarK: 0.4, step: 0.5, maxStep: 8, lv: 6 };
/** the sub-stat keys a piece can reroll (its stats minus the main stats) */
export const rerollKeys = (it) => (it && it.stats && it.slot !== 'sigil' ? Object.keys(it.stats).filter((k) => !mainKeys(it).includes(k)) : []);
export const canReroll = (it) => rerollKeys(it).length > 0;
/** the rarity a piece's sub-stats were rolled at (sets / Trial / Extreme pieces are built on a Legendary roll) */
const genRarity = (it) => ((it.rarity | 0) >= 4 ? 3 : it.rarity | 0);
/** the cost of the next reroll: { gold, mats } (null if the piece has no sub-stats) */
export function rerollCost(it, pr = null) { // (pr: the account discount, game loop C3)
  if (!canReroll(it)) return null;
  const n = Math.min(REROLL.maxStep, it.rr | 0), t = it.tier | 0 || 1, r = Math.min(7, it.rarity | 0), [, b, c] = upMatSet(it), mats = {};
  mats[b] = 2 + 2 * n; if (r >= 4) mats[c] = 1 + Math.floor(n / 3);
  return { gold: Math.round((REROLL.base + REROLL.perTier * t) * (1 + REROLL.rarK * r) * (1 + REROLL.step * n) * (pr ? rerollDisc(pr) : 1)), mats };
}
/** every sub-stat a piece could roll: [{ stat, max }] (class swaps included; max = the best possible value) */
export function subChoices(it, cls) {
  const mk = mainKeys(it), swap = AFFIX_SWAP[cls] || {}, t = tsOf(it), r = genRarity(it), out = new Map(); // (t: the scaling tier: drop level inside the tier)
  for (const k0 of subPool(mk, cls)) {
    const k = swap[k0] || k0, A = AFFIXES[k]; if (!A) continue;
    const kk = k !== k0 ? subKOf(k0) * (A.cls ? GEAR.clsK / GEAR.resK : 1) : subKOf(k), stat = A.stat || k;
    const max = A.max * subTierK(t) * (0.8 + 0.2 * r) * kk;
    if (!out.has(stat) || out.get(stat).max < max) out.set(stat, { stat, k0, k, kk, max: A.fmt === 'int' ? Math.max(1, Math.round(max)) : +max.toFixed(3) });
  }
  return [...out.values()];
}
/** roll a replacement for sub-stat `k`: { k, nk, v } (nk = a stat the piece doesn't already have, or k itself) */
export function rerollSub(rng, it, k, cls) {
  if (!rerollKeys(it).includes(k)) return null;
  const pool = subChoices(it, cls).filter((c) => c.stat === k || !(c.stat in it.stats));
  if (!pool.length) return null;
  const c = pool[Math.floor(rng.next() * pool.length)], v = rollSub(rng, c.k, tsOf(it), genRarity(it), c.kk);
  return { k, nk: c.stat, v };
}
/** is { k, nk, v } a legal reroll of `it` (the sim checks what the client rolled) */
export function rerollOk(it, k, nk, v, cls) {
  if (!rerollKeys(it).includes(k) || typeof nk !== 'string' || !(v > 0) || (nk !== k && nk in it.stats)) return false;
  const c = subChoices(it, cls).find((x) => x.stat === nk);
  return !!c && v <= c.max * 1.001 + 1e-9;
}
/** apply a reroll (mutates it): the old sub-stat is replaced in place (same position), rr + 1 */
export function applyReroll(it, k, nk, v) {
  const st = {}; for (const [a, b] of Object.entries(it.stats)) { if (a === k) st[nk] = v; else st[a] = b; }
  it.stats = st; it.rr = (it.rr | 0) + 1; return it;
}

// ------------------------------------------------------------------ ascension (horde pass 2: any Common..Legendary item can climb tiers)
/** the hero level a tier needs: crafting a tier-N recipe, ascending an item to tier N */
export { TIER_LV }; // (game loop C1: t6 Emberdeep band, t7 the Rift, t8 the cap)
/** what ascending TO tier T costs (× (1 + 0.25 × rarity)): gold + materials from several biomes, + one catalyst item */
const ASC = {
  2: { gold: 150, mats: { greenwood: 12 } },
  3: { gold: 350, mats: { greenwood: 15, ashstone: 8 } },
  4: { gold: 800, mats: { ashstone: 15, sunglass: 12, chitin: 4 } },
  5: { gold: 1600, mats: { chitin: 10, rimeshard: 15, cinderglass: 15, queen_scale: 1 } },
  // game loop C1: the tier-up track past 5 (any piece: Common..Legendary, sets, Trial / Extreme), one dungeon trophy each
  6: { gold: 4000, mats: { rimeshard: 30, frostpelt: 10, wyrm_scale: 1, gambit_crown: 1 } },
  7: { gold: 8000, mats: { cinderglass: 40, basalt_core: 12, heart_ember: 1, smith_seal: 1 } },
  8: { gold: 15000, mats: { riftglass: 40, void_crest: 2, star_shard: 2, astral_heart: 1 } }, // (game loop C3: void_crest + astral_heart, the plan's t7 -> t8)
};
/** can this item ascend at all (Common..Legendary below tier 5; sets / sigils / Trial / Extreme pieces have their own tracks) */
export const canAscend = (it) => !!it && it.slot !== 'sigil' && ((it.rarity | 0) <= 3 && !it.set && !it.ex || setTierUp(it) || exTierUp(it)) && (it.tier | 0 || 1) < TIER_MAX;
/** game loop A3: set pieces climb tiers too (C1: every set, up to tier 8), so an early set stays wearable */
export const setTierUp = (it) => !!(it && it.set && (it.rarity | 0) === 4 && SETS[it.set] && (it.tier | 0 || 1) < TIER_MAX);
/** game loop C1: Trial / Extreme pieces tier up from 5 to 8 */
export const exTierUp = (it) => !!(it && it.ex && (it.rarity | 0) >= 6 && (it.tier | 0 || 5) >= 5 && (it.tier | 0 || 5) < TIER_MAX);
/** { tier, gold, mats, lv, catalyst: 'a <slot> of tier >= N' } or null */
export function ascendCost(it, pr = null) { // (pr: the account discount, game loop C3)
  if (!canAscend(it)) return null;
  const T = (it.tier | 0 || 1) + 1, A = ASC[T], k = 1 + 0.25 * (it.rarity | 0), mats = {};
  for (const [m, n] of Object.entries(A.mats)) mats[m] = Math.max(1, Math.round(n * k));
  return { tier: T, gold: Math.round(A.gold * k * (pr ? ascDisc(pr) : 1)), mats, lv: TIER_LV[T], catTier: T - 1 };
}
/** a valid catalyst for ascending `it`: another bag item of the same slot, tier >= the item's tier, not upgraded / exclusive */
export const isCatalyst = (it, c) => !!c && c !== it && c.uid !== it.uid && c.slot === it.slot && (c.tier | 0 || 1) >= (it.tier | 0 || 1) && !(c.up | 0) && (c.rarity | 0) <= 3 && !c.set && !c.ex;
/** the item one tier up (pure, deterministic: the sim applies it for co-op): main stats rescale by the tier formula of
 *  sim/loot.js generateItem, sub-stats by theirs; the +level, rarity and uid stay; a tier-named item takes the new base name */
export function ascendItem(it, baseNames = null, prefix = null) {
  if (!canAscend(it)) return null;
  const t = it.tier | 0 || 1, T = t + 1, s0 = tsOf(it), s1 = s0 + 1, out = { ...it, stats: { ...it.stats }, tier: T, asc: (it.asc | 0) + 1 };
  if (it.ts != null) out.ts = +s1.toFixed(3); // (item level pass: the in-tier level scaling carries over)
  const mk = mainKeys(it), affR = subTierK(s1) / subTierK(s0);
  for (const k of Object.keys(it.stats)) {
    const r = mk.includes(k) ? mainTierK(it.slot, k, s1) / mainTierK(it.slot, k, s0) : affR;
    const v = it.stats[k] * r;
    out.stats[k] = Number.isInteger(it.stats[k]) ? Math.max(it.stats[k] + 1, Math.round(v)) : +v.toFixed(3);
  }
  if (mk.length && !it.mk) out.mk = mk.slice();
  if (T > 5) { const w0 = TIER_WORD[t], w1 = TIER_WORD[T], nm = w0 && out.name.startsWith(w0 + ' ') ? out.name.slice(w0.length + 1) : out.name; out.name = `${w1} ${nm}`.slice(0, 40); return out; } // (game loop C1: tiers 6-8 wear a tier word)
  if (baseNames && prefix && (it.rarity | 0) < 3) {
    const pool = it.slot === 'weapon' ? baseNames.weapon[it.cls] : it.slot === 'offhand' ? (OFFHAND[it.cls] || OFFHAND.warrior).names : baseNames[it.slot];
    const oldN = pool && pool[Math.min(4, t - 1)], newN = pool && pool[Math.min(4, T - 1)];
    if (oldN && newN && it.name.endsWith(oldN)) out.name = it.name.slice(0, it.name.length - oldN.length) + newN;
  }
  return out;
}

// ------------------------------------------------------------------ Realm Gate keys (horde pass 2: every Trial / Extreme attempt costs a key)
/** a key opens one attempt (consumed when the host travels); forged at the Realm Gate from horde materials */
export const KEYS = {
  astrael: { name: 'Star Sanctum Key', cost: { gold: 500, mats: { ashstone: 15, chitin: 6, rimeshard: 6 } } },
  skaldrat: { name: 'Hoarfrost Key', cost: { gold: 600, mats: { rimeshard: 18, frostpelt: 6, sunglass: 6 } } },
  pyrrhext: { name: 'Heart-Chamber Key', cost: { gold: 600, mats: { cinderglass: 18, basalt_core: 6, rimeshard: 6 } } },
  astraelx: { name: 'Star Sanctum Key (Extreme)', cost: { gold: 1200, mats: { star_shard: 1, chitin: 12, rimeshard: 12, cinderglass: 12 } } },
  skaldrax: { name: 'Hoarfrost Key (Extreme)', cost: { gold: 1400, mats: { wyrm_scale: 1, rimeshard: 25, grave_frost: 6, cinderglass: 10 } } },
  vharokt: { name: 'Stormcrown Key', cost: { gold: 250, mats: { ashstone: 12, glowspore: 6 } } }, // (2026-10-18: the Wilds Trial)
  vharokx: { name: 'Stormcrown Key (Extreme)', cost: { gold: 700, mats: { lumen_scale: 1, ashstone: 18, glowspore: 10 } } },
  neferakht: { name: 'Sunseal Key', cost: { gold: 450, mats: { sunglass: 16, chitin: 6, tomb_linen: 4 } } },
  neferakhx: { name: 'Sunseal Key (Extreme)', cost: { gold: 1100, mats: { queen_scale: 1, sunglass: 22, chitin: 10, tomb_linen: 8 } } },
  pyrrhexx: { name: 'Heart-Chamber Key (Extreme)', cost: { gold: 1400, mats: { heart_ember: 1, cinderglass: 25, slag_iron: 6, rimeshard: 10 } } },
};
export const needsKey = (id) => !!KEYS[id];
export const keysOf = (pr, id) => ((pr.keys && pr.keys[id]) | 0);
/** forge one key (pays the cost) -> true */
export function forgeKey(pr, id) { const K = KEYS[id]; if (!K || !pay(pr, K.cost)) return false; pr.keys = pr.keys || {}; pr.keys[id] = (pr.keys[id] | 0) + 1; return true; }
/** use one key (true if there was one) */
export function useKey(pr, id) { if (!needsKey(id)) return true; if (keysOf(pr, id) <= 0) return false; pr.keys[id]--; return true; }
/** game loop A1: a dungeon boss clear also hands over one key to its map's Trial (Tomb -> Neferakh Unbound, Crypt -> Skaldra, Forge -> Pyrrhex) */
export const DUNGEON_KEY = { hollow: 'vharokt', tomb: 'neferakht', crypt: 'skaldrat', forge: 'pyrrhext' };
/** bank a dungeon clear's Trial key; returns the key id or '' */
export function grantDungeonKey(pr, mission) { const id = DUNGEON_KEY[mission]; if (!id) return ''; pr.keys = pr.keys || {}; pr.keys[id] = (pr.keys[id] | 0) + 1; return id; }

// ------------------------------------------------------------------ Realm Gate attunement (game loop A1)
// A map's Realm Gate is FOUND by its old trigger (the previous map's world boss / dungeon), then ATTUNED once per account
// with the previous rung's trophy (in story order, game loop C2): the Dunes with Grimtusk's tusks, Frostveil with Neferakh Unbound's Sunbound Sigils,
// Emberdeep with Skaldra's Rimebound Sigils. The attune flags live with the unlock flags (client localStorage, sent on join);
// gates that were already open before this pass stay open (client/townui.js loadUnlocks migration).
export const ATTUNE = {
  dunes: { flag: 'atd', name: 'Sunscorch Gate', from: 'Grimtusk (Wilds)', cost: { gold: 300, mats: { warlord_tusk: 3 } } }, // (game loop C2: in story order, Grimtusk's tusks; he drops 3-5 a kill. The Rift Core now gates the Astral Sanctum, a later map)
  frost: { flag: 'atf', name: 'Frostveil Gate', from: 'Neferakh Unbound (Trial)', cost: { gold: 600, mats: { sun_sigil: 2 } } },
  ember: { flag: 'ate', name: 'Emberdeep Gate', from: 'Skaldra (Trial)', cost: { gold: 900, mats: { rime_sigil: 2 } } },
  // game loop C3: Map 5 (the Astral Rift) with Pyrrhex's Cinderbound Sigils; the Astral Sanctum (Astrael) with Vorthax's Rift Cores
  rift: { flag: 'atr', name: 'Astral Rift Gate', from: 'Pyrrhex (Trial)', cost: { gold: 1200, mats: { cinder_sigil: 2 } } },
  astrael: { flag: 'ats', name: 'Astral Sanctum', from: 'Vorthax (the Rift Sanctum)', cost: { gold: 1500, mats: { rift_core: 2 } } },
};
/** pay a gate's attunement (true if paid); the caller sets the unlock flag ATTUNE[id].flag */
export function attuneGate(pr, id) { const A = ATTUNE[id]; return !!A && pay(pr, A.cost); }

// ------------------------------------------------------------------ account level + milestones
export const ACCOUNT_MAX = 50; // (game loop C3: 30 -> 50 with the level cap)
export const accountXpToNext = (lv) => (lv >= ACCOUNT_MAX ? Infinity : Math.round(lv <= 12 ? 400 * Math.pow(lv, 1.45) : 400 * Math.pow(12, 1.45) + 1400 * (lv - 12))); // (balance pass: the old 400·lv^1.45 kept climbing to 52k a level; past 12 it now grows linearly)
/** account XP for a run: 60% of the hero XP gained + 10% of kill XP the capped hero could not take + 4 per kill (the clear bonus is added by the reward screen) */
export const accountXpOf = (heroGain, killXp, kills) => heroGain * 0.6 + Math.max(0, killXp - heroGain) * 0.1 + kills * 4;
/** { level, into, need } from total account XP */
export function accountLevel(xp) {
  let lv = 1, left = Math.max(0, xp | 0);
  while (lv < ACCOUNT_MAX && left >= accountXpToNext(lv)) { left -= accountXpToNext(lv); lv++; }
  return { level: lv, into: lv >= ACCOUNT_MAX ? 0 : left, need: accountXpToNext(lv) };
}
export const MILESTONES = [
  { lv: 2, id: 'forge', name: 'The Forge', text: 'Craft gear from materials (Wildwood and Ashforged recipes) and upgrade gear up to +3' },
  { lv: 3, id: 'daily', name: 'Daily Bounties', text: 'Three new bounties every day for gold, materials and account XP' },
  { lv: 4, id: 'up5', name: 'Journeyman Smith', text: 'Upgrade gear up to +5' },
  { lv: 5, id: 'set_wild', name: 'Wildwarden Pattern', text: 'Craft the Wildwarden set (2- and 3-piece bonuses)' },
  { lv: 6, id: 'weekly', name: 'Weekly Bounties', text: 'Two big bounties every week' },
  { lv: 7, id: 'up7', name: 'Master Smith', text: 'Upgrade gear up to +7 (from +7 an upgrade can fail; failures raise the next chance)' },
  { lv: 8, id: 'forge_dunes', name: 'Sunglass Recipes', text: 'Craft Sunglass gear from Dunes materials' },
  { lv: 9, id: 'set_dune', name: 'Duneborn Pattern', text: 'Craft the Duneborn set' },
  { lv: 10, id: 'up10', name: 'Grandmaster Smith', text: 'Upgrade gear all the way to +10' },
  { lv: 12, id: 'gold10', name: "Prospector's Luck", text: '+10% gold from every kill' },
  { lv: 14, id: 'forge_tomb', name: 'Royal Tomb Recipes', text: 'Craft tier-5 gear from Tomb materials' },
  { lv: 16, id: 'mat15', name: "Gatherer's Eye", text: '+15% chance for an extra material drop' },
  { lv: 20, id: 'gold25', name: 'Golden Touch', text: '+25% gold from every kill (replaces +10%)' },
  { lv: 25, id: 'champion', name: 'Realm Champion', text: 'The Realm Champion title on the reward screen and the Progress panel' },
  // game loop B2: account levels 26-30
  { lv: 26, id: 'bag26', name: 'Deep Pockets', text: '+4 bag slots for every hero' },
  { lv: 27, id: 'stash5', name: 'Vault Annex', text: 'A 5th stash tab (40 more shared slots)' },
  { lv: 28, id: 'bag28', name: 'Bottomless Pack', text: '+4 more bag slots for every hero' },
  { lv: 29, id: 'weekly3', name: 'Bounty Hunter', text: 'A 3rd weekly bounty every week' },
  { lv: 30, id: 'legend', name: 'Realm Legend', text: 'A 6th stash tab, the Realm Legend title and +50% account XP from finished Collection rows' },
  // game loop C3: account levels 31-50 (the Astral Rift era)
  { lv: 32, id: 'gold35', name: 'Gilded Hands', text: '+35% gold from every kill (replaces +25%)' },
  { lv: 34, id: 'mat20', name: "Forager's Instinct", text: '+20% chance for an extra material drop (replaces +15%)' },
  { lv: 36, id: 'reroll', name: 'Steady Hand', text: 'Substat rerolls cost 20% less gold' },
  { lv: 38, id: 'up_luck', name: 'Starforged Anvil', text: 'Upgrades past +7 succeed 5% more often' },
  { lv: 40, id: 'riftwalker', name: 'Riftwalker', text: 'The Riftwalker title on the reward screen and the Progress panel' },
  { lv: 42, id: 'gold45', name: 'Midas Touch', text: '+45% gold from every kill (replaces +35%)' },
  { lv: 44, id: 'mat25', name: "Starseeker's Eye", text: '+25% chance for an extra material drop (replaces +20%)' },
  { lv: 46, id: 'asc_disc', name: 'Celestial Smith', text: 'Ascension costs 15% less gold' },
  { lv: 48, id: 'reroll2', name: 'Master Artificer', text: 'Substat rerolls cost 35% less gold (replaces 20%)' },
  { lv: 50, id: 'ascended', name: 'Ascended', text: 'The Ascended title, +60% gold from every kill and +30% extra material chance' },
];
export const hasMilestone = (pr, id) => { const m = MILESTONES.find((x) => x.id === id); return !!m && accountLevel(pr.accXp).level >= m.lv; };
export const goldMul = (pr) => (hasMilestone(pr, 'ascended') ? 1.6 : hasMilestone(pr, 'gold45') ? 1.45 : hasMilestone(pr, 'gold35') ? 1.35 : hasMilestone(pr, 'gold25') ? 1.25 : hasMilestone(pr, 'gold10') ? 1.1 : 1);
export const matBonus = (pr) => (hasMilestone(pr, 'ascended') ? 0.3 : hasMilestone(pr, 'mat25') ? 0.25 : hasMilestone(pr, 'mat20') ? 0.2 : hasMilestone(pr, 'mat15') ? 0.15 : 0);
/** game loop C3: account discounts (rerolls / ascension gold) and the upgrade luck past +7 */
export const rerollDisc = (pr) => (hasMilestone(pr, 'reroll2') ? 0.65 : hasMilestone(pr, 'reroll') ? 0.8 : 1);
export const ascDisc = (pr) => (hasMilestone(pr, 'asc_disc') ? 0.85 : 1);
export const upLuck = (pr) => (hasMilestone(pr, 'up_luck') ? 0.05 : 0);

// ------------------------------------------------------------------ bounties
const DAY_POOL = [
  { kind: 'kill', biome: 'wilds', need: 60, text: 'Defeat 60 enemies in the Wilds' },
  { kind: 'kill', biome: 'dunes', need: 50, text: 'Defeat 50 enemies in the Sunscorch Dunes' },
  { kind: 'kill', biome: 'frost', need: 50, text: 'Defeat 50 enemies in Frostveil Peaks' },
  { kind: 'kill', biome: 'ember', need: 50, text: 'Defeat 50 enemies in Emberdeep Caldera' },
  { kind: 'elite', need: 6, text: 'Defeat 6 elite enemies' },
  { kind: 'chain', need: 40, text: 'Land 40 chains' },
  { kind: 'mat', need: 25, text: 'Gather 25 materials' },
  { kind: 'boss', need: 1, text: 'Defeat a world boss (Grimtusk, Thornmaw, Ashfang, Khepra...)' },
  { kind: 'clear', need: 1, text: 'Clear a mission with rank A or better', rank: 'A' },
  { kind: 'gold', need: 600, text: 'Earn 600 gold from kills' },
];
const WEEK_POOL = [
  { kind: 'clear', mission: 'hollow', need: 2, text: 'Clear the Glowmire Hollow twice' },
  { kind: 'clear', mission: 'vharokt', need: 1, text: 'Clear Vharok, the Stormhorn (Trial)' },
  { kind: 'clear', mission: 'tomb', need: 2, text: 'Clear the Tomb of the Sun-Eaten King twice' },
  { kind: 'clear', mission: 'crypt', need: 2, text: 'Clear the Glacier Crypt twice' },
  { kind: 'clear', mission: 'forge', need: 2, text: 'Clear the Forge of Cinders twice' },
  { kind: 'clear', mission: 'vorthax', need: 1, text: 'Defeat Vorthax in the Rift Sanctum' },
  { kind: 'clear', mission: 'skaldrat', need: 1, text: 'Clear Skaldra (Trial)' },
  { kind: 'clear', mission: 'pyrrhext', need: 1, text: 'Clear Pyrrhex (Trial)' },
  { kind: 'clear', mission: 'skaldrax', need: 1, text: 'Clear Skaldra (Extreme)' },
  { kind: 'clear', mission: 'pyrrhexx', need: 1, text: 'Clear Pyrrhex (Extreme)' },
  { kind: 'clear', mission: 'neferakht', need: 1, text: 'Clear Neferakh Unbound (Trial)' },
  { kind: 'clear', mission: 'neferakhx', need: 1, text: 'Clear Neferakh Unbound (Extreme)' },
  { kind: 'clear', mission: 'neferakhs', need: 1, text: 'Clear Neferakh Unbound (Savage)' },
  { kind: 'boss', need: 6, text: 'Defeat 6 world bosses' },
  { kind: 'kill', need: 600, text: 'Defeat 600 enemies anywhere' },
  { kind: 'clear', need: 3, text: 'Clear 3 missions with rank S', rank: 'S' },
  { kind: 'chain', need: 300, text: 'Land 300 chains' },
];
// riftweekly (2026-10-09): Astral Rift bounties for accounts that have found the Rift (one daily + one weekly slot)
export const RIFT_BOSSES = ['nyxara', 'orrery', 'zerath'];
const RIFT_DAY_POOL = [
  { kind: 'kill', biome: 'rift', need: 60, text: 'Defeat 60 enemies in the Astral Rift' },
  { kind: 'elite', biome: 'rift', need: 6, text: 'Defeat 6 elite enemies in the Astral Rift' },
  { kind: 'swarm', biome: 'rift', need: 1, text: 'Win a Swarm event at an Astral Rift spawn site' },
  { kind: 'boss', biome: 'rift', etype: RIFT_BOSSES, need: 1, text: 'Defeat a Rift world boss (Nyxara, the Shattered Orrery or Zerath)' },
  { kind: 'ops', biome: 'rift', need: 1, text: 'Clear a Rift mission (any type)' },
];
const RIFT_WEEK_POOL = [
  { kind: 'boss', biome: 'rift', etype: RIFT_BOSSES, need: 4, text: 'Defeat Rift world bosses 4 times (Nyxara, the Shattered Orrery, Zerath)' },
  { kind: 'clear', mission: 'vorthax', need: 2, text: 'Clear the Rift Sanctum (Vorthax) twice' },
  { kind: 'ops', biome: 'rift', need: 3, text: 'Clear 3 Rift missions' },
  { kind: 'ops', biome: 'rift', need: 2, rank: 'A', text: 'Clear 2 Rift missions at grade A or better' },
  { kind: 'swarm', biome: 'rift', need: 3, text: 'Win 3 Swarm events at Astral Rift spawn sites' },
  { kind: 'kill', biome: 'rift', need: 500, text: 'Defeat 500 enemies in the Astral Rift' },
];
export const RIFT_BOUNTIES = { day: RIFT_DAY_POOL, week: RIFT_WEEK_POOL };
/** the material band weekly bounties pay in: the hero's level (the account's best hero) / the furthest map reached */
export const BOUNTY_BANDS = ['wilds', 'dunes', 'frost', 'ember', 'rift'];
export function bountyBand(ctx = null) {
  const lv = (ctx && ctx.lv) | 0;
  if ((ctx && ctx.rift) || lv >= 38) return 'rift';
  return lv >= 28 ? 'ember' : lv >= 18 ? 'frost' : lv >= 9 ? 'dunes' : 'wilds';
}
/** a weekly bounty's materials in a band: 12 of its common + 4 of its rare (the Rift: + 1 Void Crest) */
export function weeklyMats(band) {
  const P = MAT_POOLS[band] || MAT_POOLS.wilds, m = { [P.common]: 12, [P.rare]: 4 };
  if (band === 'rift') m.void_crest = 1;
  return m;
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(seed) { let s = seed || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
/** local date keys: day 'YYYY-MM-DD', week = the Monday's date */
export function dateKeys(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0'), k = (x) => `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate()); m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return { day: k(d), week: k(m) };
}
const pickN = (pool, n, r) => { const a = pool.slice(), out = []; while (out.length < n && a.length) out.push(a.splice(Math.floor(r() * a.length), 1)[0]); return out; };
/** the day's 3 bounties and the week's 2 (deterministic per date) */
export function makeBounties(keys, ctx = null) {
  const rd = seeded(hash('d' + keys.day)), rw = seeded(hash('w' + keys.week)), rift = !!(ctx && ctx.rift), band = bountyBand(ctx);
  const mk = (b, i, scope, r) => ({ id: `${scope}${i}`, scope, ...b, n: 0, done: false, claimed: false,
    reward: scope === 'w' ? { gold: 1500 + Math.round(r() * 5) * 100, xp: 2500, mats: weeklyMats(band) } : { gold: 250 + Math.round(r() * 4) * 50, xp: 600, mats: { [['greenwood', 'ashstone', 'sunglass'][Math.floor(r() * 3)]]: 4 } } });
  const daily = rift ? [...pickN(DAY_POOL, 2, rd), ...pickN(RIFT_DAY_POOL, 1, rd)] : pickN(DAY_POOL, 3, rd); // (riftweekly: one Rift daily once the Rift is found)
  const weekly = rift ? [...pickN(WEEK_POOL, 1, rw), ...pickN(RIFT_WEEK_POOL, 1, rw)] : pickN(WEEK_POOL, 2, rw);
  return { day: keys.day, week: keys.week, rift: rift ? 1 : 0, band, daily: daily.map((b, i) => mk(b, i, 'd', rd)), weekly: weekly.map((b, i) => mk(b, i, 'w', rw)) };
}
/** game loop B2: the week's 3rd bounty (account Lv 29), deterministic per week, never one of the other two */
export function thirdWeekly(keys, have = [], ctx = null) {
  const src = ctx && ctx.rift ? [...WEEK_POOL, ...RIFT_WEEK_POOL] : WEEK_POOL;
  const r = seeded(hash('w3' + keys.week)), pool = src.filter((b) => !have.some((h) => h.text === b.text)), b = pool[Math.floor(r() * pool.length)] || WEEK_POOL[0];
  return { id: 'w2', scope: 'w', ...b, n: 0, done: false, claimed: false, reward: { gold: 1500 + Math.round(r() * 5) * 100, xp: 2500, mats: weeklyMats(bountyBand(ctx)) } };
}
/** riftweekly: rebuild a period's list (the Rift just found) keeping the progress of every bounty that stays */
const carry = (fresh, old) => fresh.map((b) => { const o = (old || []).find((x) => x && x.text === b.text); return o ? { ...b, n: o.n, done: o.done, claimed: o.claimed } : b; });
/** refresh the profile's bounties when the day / week rolled over (keeps progress inside the same period) */
// ctx = { rift: the Rift found / attuned, lv: the account's best hero level } (client/rewards.js bountyCtx); null = keep
// what the profile has (rift flag, band)
export function refreshBounties(pr, keys = dateKeys(), ctx = null) {
  const B = pr.bounties || {};
  const C = ctx ? { rift: !!ctx.rift || !!B.rift && B.week === keys.week, lv: Math.max(ctx.lv | 0, B.lv | 0) } : { rift: !!B.rift, lv: B.lv | 0 }; // (the Rift never un-finds itself mid-week)
  const fresh = makeBounties(keys, C), riftNew = C.rift && !B.rift;
  const keepD = B.day === keys.day && Array.isArray(B.daily), keepW = B.week === keys.week && Array.isArray(B.weekly);
  pr.bounties = { day: keys.day, week: keys.week, rift: C.rift ? 1 : 0, lv: C.lv,
    daily: keepD ? (riftNew ? carry(fresh.daily, B.daily) : B.daily) : fresh.daily,
    weekly: keepW ? (riftNew ? carry(fresh.weekly, B.weekly) : B.weekly) : fresh.weekly };
  if (hasMilestone(pr, 'weekly3') && pr.bounties.weekly.length < 3) pr.bounties.weekly = [...pr.bounties.weekly, thirdWeekly(keys, pr.bounties.weekly, C)]; // (game loop B2: Lv 29)
  const wm = weeklyMats(bountyBand(C)); for (const b of pr.bounties.weekly) if (b && !b.claimed && b.reward) b.reward.mats = { ...wm }; // (riftweekly: unclaimed weeklies pay in the hero's band)
  return pr.bounties;
}
const RANK_V = { S: 3, A: 2, B: 1 };
/** progress the active bounties with one tally { kind, n, biome, mission, rank }. Returns the bounties that just completed. */
export function bountyTick(pr, t) {
  const done = [], lists = [];
  if (hasMilestone(pr, 'daily')) lists.push(...(pr.bounties.daily || []));
  if (hasMilestone(pr, 'weekly')) lists.push(...(pr.bounties.weekly || []));
  for (const b of lists) {
    if (b.done || b.kind !== t.kind) continue;
    if (b.biome && b.biome !== t.biome) continue;
    if (b.mission && b.mission !== t.mission) continue;
    if (b.rank && !(RANK_V[t.rank] >= RANK_V[b.rank])) continue;
    if (b.etype && !(Array.isArray(b.etype) && b.etype.includes(t.etype))) continue; // (riftweekly: named world bosses)
    b.n = Math.min(b.need, b.n + (t.n || 1));
    if (b.n >= b.need) { b.done = true; done.push(b); }
  }
  return done;
}
/** claim a finished bounty's reward into the profile */
export function claimBounty(pr, b) {
  if (!b || !b.done || b.claimed) return false;
  b.claimed = true; pr.gold += b.reward.gold; pr.accXp += b.reward.xp;
  for (const [k, n] of Object.entries(b.reward.mats || {})) pr.mats[k] = (pr.mats[k] | 0) + n;
  return true;
}

// ------------------------------------------------------------------ ranks + records
// par seconds for a clear (free hunts: the hunt target's kill); S = par with no deaths, A = 1.6x par and at most 2 deaths
/** mission clear bonus per difficulty star (× rank S 2 / A 1.5 / B 1): gold and account XP (encounter pass: 120 / 250 -> 150 / 320) */
export const CLEAR_GOLD = 150, CLEAR_XP = 320;
export const PAR = { hollow: 600, vharokt: 360, vharokx: 390, field: 480, dunes: 540, tomb: 660, frost: 660, crypt: 720, ember: 720, forge: 720, rift: 720, vorthax: 330, astrael: 420, astraelx: 480, skaldrat: 330, skaldrax: 390, pyrrhext: 330, pyrrhexx: 390, neferakht: 330, neferakhx: 390, neferakhs: 780 };
export const HUNT = { field: 'boss', dunes: 'khepra', frost: 'skaldra', ember: 'pyrrhex', rift: 'zerath' }; // free hunts: killing this boss clears the hunt
export function rankFor(mission, secs, deaths) {
  const par = PAR[mission] || 420;
  if (secs <= par && deaths === 0) return 'S';
  if (secs <= par * 1.6 && deaths <= 2) return 'A';
  return 'B';
}
/** record a clear; returns { newBest, newRank } */
export function recordClear(pr, mission, secs, rank) {
  const r = pr.records[mission] || (pr.records[mission] = { best: 0, rank: '', clears: 0 });
  const newBest = !r.best || secs < r.best, newRank = !r.rank || RANK_V[rank] > RANK_V[r.rank];
  r.clears++; if (newBest) r.best = Math.round(secs); if (newRank) r.rank = rank;
  return { newBest, newRank };
}

// ------------------------------------------------------------------ the profile save
export const PROFILE_VERSION = 1;
export const PROFILE_KEY = 'realmbrawl.profile';
export const newProfile = () => ({ v: PROFILE_VERSION, accXp: 0, gold: 0, mats: Object.fromEntries(MAT_IDS.map((k) => [k, 0])), records: {}, bounties: null, pity: {}, keys: {}, stats: { kills: 0, clears: 0, gold: 0 }, seen: [], autoSalvage: normAutoSalvage(null) });
/** total XP a hero has earned (levels below + into the current one) */
export function heroTotalXp(c, xpToNext) { let t = Math.max(0, +c.xp || 0); for (let l = 1; l < (c.level | 0); l++) t += +xpToNext(l) || 0; return t; }
/**
 * Load / upgrade a profile. raw = the stored object (or null); chars = the saved heroes (a brand-new profile is seeded
 * with a quarter of all their earned XP, so veterans start a few account levels in instead of at 1).
 */
export function migrateProfile(raw, chars = [], xpToNext = null) {
  const base = newProfile();
  if (!raw || typeof raw !== 'object') {
    if (xpToNext) base.accXp = Math.round(chars.reduce((a, c) => a + heroTotalXp(c, xpToNext), 0) * 0.25);
    base.seen = MILESTONES.filter((m) => accountLevel(base.accXp).level >= m.lv).map((m) => m.id); // (no "new unlock" fanfare for what veterans already have)
    return base;
  }
  const p = { ...base, ...raw, v: PROFILE_VERSION };
  p.accXp = Math.max(0, Math.floor(+p.accXp || 0)); p.gold = Math.max(0, Math.floor(+p.gold || 0));
  p.mats = { ...base.mats }; for (const k of MAT_IDS) p.mats[k] = Math.max(0, Math.floor(+(raw.mats && raw.mats[k]) || 0));
  p.records = raw.records && typeof raw.records === 'object' ? raw.records : {};
  p.pity = raw.pity && typeof raw.pity === 'object' ? raw.pity : {};
  p.keys = {}; if (raw.keys && typeof raw.keys === 'object') for (const k in KEYS) p.keys[k] = Math.max(0, Math.floor(+raw.keys[k] || 0));
  p.stats = { ...base.stats, ...(raw.stats || {}) };
  p.seen = Array.isArray(raw.seen) ? raw.seen.filter((x) => typeof x === 'string') : [];
  p.opsBest = normOpsBest(raw.opsBest); // mission revamp part 3: best grade per mission type (sim/opsbest.js)
  p.prac = {}; if (raw.prac && typeof raw.prac === 'object') for (const [k, r] of Object.entries(raw.prac)) if (/^[a-z]+(@a)?$/.test(k) && r && typeof r === 'object') p.prac[k] = { ph: Math.max(0, Math.min(9, Math.floor(+r.ph || 0))), n: Math.max(0, Math.floor(+r.n || 0)) }; // Part E: practice records (sim/practice.js)
  p.autoSalvage = normAutoSalvage(raw.autoSalvage); // step 4: auto-salvage filters + the undo log (sim/autosalvage.js)
  return p;
}
export { SETS };

// Part D (docs/ASCENSION-PLAN.md): Ascension account perks. Every Ascended hero (A1+) on the account adds a small, flat
// bonus for EVERY hero of the account (sim side: client/progression via sim/ascended.js applyAscAccount; gold via
// client/rewards.js). Capped at 10 heroes = +4% Attack, +4% Max HP, +10% gold. Multiplicative after everything else,
// additive-only: nothing here lowers a stat (the Bard's passives stay exactly as they are, the bonus rides on top).
export const ASC_ACCOUNT = { atk: 0.004, hp: 0.004, gold: 0.01, max: 10 };
export function ascAccount(n) {
  const k = Math.max(0, Math.min(ASC_ACCOUNT.max, Math.floor(Number(n) || 0)));
  return { n: k, atk: +(k * ASC_ACCOUNT.atk).toFixed(4), hp: +(k * ASC_ACCOUNT.hp).toFixed(4), gold: +(k * ASC_ACCOUNT.gold).toFixed(4) };
}
/** account milestones by Ascended-hero count. riftHero: the Rift-exclusive hero's unlock (Part G reads this hook);
 *  starborn: the Starborn Paragon title + the Constellation Mantle cosmetic + the hidden fight's gate (a later hook). */
export const ASC_MILESTONES = [
  { n: 3, id: 'riftHero', name: 'Call of the Rift', text: 'Three Ascended heroes: the Rift-exclusive hero answers (arrives with Part G)' },
  { n: 10, id: 'starborn', name: 'Starborn Paragon', text: 'All ten Ascended: the Starborn Paragon title, the Constellation Mantle on every hero, and something stirs past the Rim' },
];
export const ascMilestone = (n, id) => { const m = ASC_MILESTONES.find((x) => x.id === id); return !!m && (n | 0) >= m.n; };
/** the hidden fight (a later hook): open once every hero is Ascended; no content yet */
export const ASC_HIDDEN = { id: 'rimfall', name: 'Beyond the Rim', need: 10 };
export const ascHiddenOpen = (n) => (n | 0) >= ASC_HIDDEN.need;
