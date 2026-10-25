// Exclusive item tiers from Sunscorch content.
//   Set (rarity 4): Regalia of the Sun-Eaten King: 3 pieces (weapon / armor / ring), drops ONLY in the Tomb of the
//     Sun-Eaten King (Neferakh guarantees one, chain-challenge chests can hold one). 2 pieces: crit stats.
//     3 pieces: SOLAR GLYPHS: every chain of 3+ steps you land brands the target with a sun glyph (max 3, 10 s);
//     the NEXT chain you land detonates every glyph (x2.2 ATK in 170 px each, x3.3 if that chain has 4+ steps).
//     Per class the glyph is shaped by your weapon (see GLYPH_TWIST): the burst also feeds the class mechanic.
//   Trial Sigil (rarity 5): the key to Neferakh Unbound (the Trial, Phase 2). Not equippable.
// Pure sim code. Stats come from the normal generator (tier 5, legendary budget), so the server validator accepts them.
import { generateItem } from './loot.js';
import { SLOTS, EQUIP_SLOTS, SET_SLOTS, OFFHAND, SLOT_NOUN } from './data/items.js';

export const SET_ID = 'sunscorch';
export const SETS = {
  sunscorch: {
    id: 'sunscorch', name: 'Regalia of the Sun-Eaten King', short: 'Sunscorch', color: '#2ee6c4',
    weapon: { warrior: "Sun-Eater's Khopesh", ranger: "Sun-Eater's Horizon Bow", mage: "Sun-Eater's Was-Sceptre", cleric: "Sun-Eater's Solar Mace", bladedancer: "Sun-Eater's Twin Fangs", samurai: "Sun-Eater's Dawn Tachi", monk: "Sun-Eater's Scarab Wraps", dragoon: "Sun-Eater's Obelisk Lance", summoner: "Sun-Eater's Book of Gates", bard: "Sun-Eater's Sistrum Lute" },
    armor: "Sun-Eater's Burial Regalia", ring: 'Seal of the Sun-Eaten King',
    helm: "Sun-Eater's Death Mask", gloves: "Sun-Eater's Gilded Grips", boots: "Sun-Eater's Sandals of Passage", amulet: "Sun-Eater's Scarab Heart",
    two: { crit: 0.05, critDmg: 0.15 },
    twoText: '+5% Crit Chance, +15% Crit Damage',
    fourText: 'SOLAR GLYPHS: a chain of 3+ steps brands its target with a sun glyph (max 3). Your next chain detonates them all: ×2.2 ATK each in a 170 px blast (×3.3 when that chain has 4+ steps).',
    tier: 5, source: 'Drops only in the Tomb of the Sun-Eaten King', proc4: 'glyphs',
  },
  // crafted sets (experience pass 2: the Forge, from biome materials; stat bonuses only)
  wildwarden: {
    id: 'wildwarden', name: 'Wildwarden Regalia', short: 'Wildwarden', color: '#7ed957', tier: 3, craft: true,
    weapon: { warrior: 'Wildwarden Cleaver', ranger: 'Wildwarden Longbow', mage: 'Wildwarden Rootstaff', cleric: 'Wildwarden Thornmace', bladedancer: 'Wildwarden Briar Fangs', samurai: 'Wildwarden Oak Tachi', monk: 'Wildwarden Vine Wraps', dragoon: 'Wildwarden Ash Spear', summoner: 'Wildwarden Herbarium', bard: 'Wildwarden Reed Lute' },
    armor: 'Wildwarden Barkmail', ring: 'Wildwarden Acorn Band',
    helm: 'Wildwarden Antler Crown', gloves: 'Wildwarden Briar Gloves', boots: 'Wildwarden Mossy Boots', amulet: 'Wildwarden Heartwood Charm',
    two: { maxHp: 140, hpRegen: 2 }, four: { def: 30, spd: 0.05 }, proc4: 'bramble',
    twoText: '+140 Max HP, +2 HP Regen', fourText: '+30 Defense, +5% Move Speed. BRAMBLEGUARD: every 6th hit you land bursts into thorns: ×1.4 ATK in 120 px and heals you 2% max HP.',
    source: 'Crafted at the Forge from Wilds materials · or won in the Wilds Defense / Capture missions',
  },
  // the Wilds' dungeon set (2026-10-18): drops only in the Glowmire Hollow (Lumivex guarantees one, Hollow elites rarely)
  mothwing: {
    id: 'mothwing', name: 'Mothwing Regalia', short: 'Mothwing', color: '#c9f27a', tier: 4, biome: 'hollow',
    weapon: { warrior: 'Mothwing Moonblade', ranger: 'Mothwing Lanternbow', mage: 'Mothwing Glowcap Staff', cleric: 'Mothwing Lumen Mace', bladedancer: 'Mothwing Dust Fangs', samurai: 'Mothwing Moonlit Tachi', monk: 'Mothwing Silk Wraps', dragoon: 'Mothwing Antenna Lance', summoner: 'Mothwing Codex of Glowmoths', bard: 'Mothwing Moonlute' },
    armor: 'Mothwing Silkweave Mail', ring: 'Mothwing Lantern Band',
    helm: 'Mothwing Antennae Crown', gloves: 'Mothwing Dusted Grips', boots: 'Mothwing Mossfall Boots', amulet: 'Mothwing Moon Locket',
    two: { maxHp: 110, crit: 0.03 }, proc4: 'moonlit',
    twoText: '+110 Max HP, +3% Crit Chance',
    fourText: 'MOONLIT DUST: every 7 s your next hit bursts into moonlit dust: ×1.8 ATK in 150 px and heals you 3% max HP.',
    source: 'Drops only in the Glowmire Hollow (Lumivex guarantees one, Hollow elites rarely)',
  },
  duneborn: {
    id: 'duneborn', name: 'Duneborn Panoply', short: 'Duneborn', color: '#ffb84a', tier: 4, craft: true,
    weapon: { warrior: 'Duneborn Khopesh', ranger: 'Duneborn Sunbow', mage: 'Duneborn Glass Rod', cleric: 'Duneborn Ankh Mace', bladedancer: 'Duneborn Scarab Fangs', samurai: 'Duneborn Mirage Blade', monk: 'Duneborn Sandstep Wraps', dragoon: 'Duneborn Obelisk Pike', summoner: 'Duneborn Papyrus Codex', bard: 'Duneborn Sistrum' },
    armor: 'Duneborn Sunplate', ring: 'Duneborn Scarab Seal',
    helm: 'Duneborn Nemes', gloves: 'Duneborn Sandwrap Gloves', boots: 'Duneborn Dune-Striders', amulet: 'Duneborn Ankh',
    two: { crit: 0.04, critDmg: 0.12 }, four: { atk: 18, spd: 0.04 }, proc4: 'sandstorm',
    twoText: '+4% Crit Chance, +12% Crit Damage', fourText: '+18 Attack, +4% Move Speed. SANDSTORM: your chain finishers whip up a sandstorm on the target: ×1.5 ATK in 150 px (4 s cooldown).',
    source: 'Crafted at the Forge from Dunes materials · or won in the Dunes Defense / Capture missions',
  },
  // biome sets (piece 4): drop only in that biome (elites, world bosses) and its dungeon (the dungeon boss guarantees one),
  // or crafted at the Forge from that biome's materials. The 3-piece bonus is a mechanic (sim/exotic.js), not stats.
  frostveil: {
    id: 'frostveil', name: 'Rimewarden Regalia', short: 'Rimewarden', color: '#8fe3ff', tier: 5, biome: 'frost',
    weapon: { warrior: 'Rimewarden Glacier Blade', ranger: 'Rimewarden Icicle Bow', mage: 'Rimewarden Hoarfrost Staff', cleric: 'Rimewarden Frostbrand Mace', bladedancer: 'Rimewarden Sleet Fangs', samurai: 'Rimewarden Snowfall Tachi', monk: 'Rimewarden Frostbite Wraps', dragoon: 'Rimewarden Glacier Lance', summoner: 'Rimewarden Book of Winter', bard: 'Rimewarden Icebell Lute' },
    armor: 'Rimewarden Yeti-Hide Mail', ring: 'Rimewarden Snowflake Band',
    helm: 'Rimewarden Frost Crown', gloves: 'Rimewarden Hoarfrost Grips', boots: 'Rimewarden Snowtread Boots', amulet: 'Rimewarden Glacier Heart',
    two: { maxHp: 120, def: 25 }, proc4: 'shatter',
    twoText: '+120 Max HP, +25 Defense',
    fourText: 'SHATTER: every hit packs frost onto the enemy (skills 2, basics 1). At 6 frost it freezes solid (bosses: briefly). Hit a frozen enemy and the ice shatters: ×2.5 ATK to it and everything within 140 px.',
    source: 'Drops only in Frostveil (elites, world bosses) and the Glacier Crypt (Osric guarantees one) · Frostveil Defense / Capture missions · or forged from Frostveil materials',
  },
  emberdeep: {
    id: 'emberdeep', name: 'Caldera Warplate', short: 'Caldera', color: '#ff7a3a', tier: 5, dropTier: 6, biome: 'ember',
    weapon: { warrior: 'Caldera Magma Cleaver', ranger: 'Caldera Cinder Bow', mage: 'Caldera Eruption Staff', cleric: 'Caldera Slag Mace', bladedancer: 'Caldera Ember Fangs', samurai: 'Caldera Obsidian Tachi', monk: 'Caldera Basalt Wraps', dragoon: 'Caldera Vent Lance', summoner: 'Caldera Book of Ash', bard: 'Caldera Brimstone Lute' },
    armor: 'Caldera Basalt Warplate', ring: 'Caldera Heartcoal Ring',
    helm: 'Caldera Obsidian Helm', gloves: 'Caldera Slagforged Gauntlets', boots: 'Caldera Magma-Walkers', amulet: 'Caldera Cinder Heart',
    two: { crit: 0.05, atk: 20 }, proc4: 'erupt',
    twoText: '+5% Crit Chance, +20 Attack',
    fourText: 'ERUPTION: crits build Heat (+8 basic, +15 skill). At 100 Heat your next hit erupts: ×2.4 ATK in a 190 px blast that leaves magma ground for 3 s (burns ×0.25 ATK every half second).',
    source: 'Drops only in Emberdeep (elites, world bosses) and the Forge of Cinders (Hephast guarantees one) · Emberdeep Defense / Capture missions · or forged from Emberdeep materials',
  },
  // game loop C3: the Astral Rift's set (tier 7; climbs to 8 by Ascension)
  astral: {
    id: 'astral', name: 'Astral Regalia', short: 'Astral', color: '#b48cff', tier: 7, biome: 'rift',
    weapon: { warrior: 'Astral Starcleaver', ranger: 'Astral Comet Bow', mage: 'Astral Nebula Staff', cleric: 'Astral Meteor Mace', bladedancer: 'Astral Twin Moons', samurai: 'Astral Eclipse Tachi', monk: 'Astral Starfall Wraps', dragoon: 'Astral Meridian Lance', summoner: 'Astral Star Atlas', bard: 'Astral Celestial Lyre' },
    armor: 'Astral Voidweave Mail', ring: 'Astral Orbit Band',
    helm: 'Astral Halo Crown', gloves: 'Astral Starsilk Grips', boots: 'Astral Comet-Treads', amulet: 'Astral Heart of the Sky',
    two: { atk: 26, critDmg: 0.15 }, proc4: 'constellation',
    twoText: '+26 Attack, +15% Crit Damage',
    fourText: 'CONSTELLATION: your hits pin stars on an enemy (skills 2, basics 1). At 7 stars the constellation connects: ×3 ATK to it and ×1.5 ATK to everything within 160 px, chained star to star (2 s cooldown).',
    source: 'Drops only in the Astral Rift (elites, world bosses) and the Rift Sanctum (Vorthax guarantees one) · Astral Rift Defense / Capture missions · or forged from rift materials',
  },
};
/** Per-class twist on a glyph detonation (shown in the tooltip; applied in sim/dunes.js glyphBurst). */
export const GLYPH_TWIST = {
  warrior: 'Warrior: each blast adds 1 Bleed.',
  ranger: 'Ranger: each blast adds 1 Quarry.',
  mage: 'Mage: each blast adds 2 Burn.',
  cleric: 'Paladin: each blast adds 1 Condemn and heals you 2% max HP.',
  bladedancer: 'Ninja: each blast refunds an Initiative pip.',
  samurai: 'Samurai: each blast leaves a Delayed Cut.',
  monk: 'Monk: each blast plants a Pressure Point.',
  dragoon: 'Dragoon: each blast pins (Impaled).',
  summoner: 'Summoner: each blast writes 4 Ink.',
  bard: 'Bard: each blast makes the targets Dissonant.',
};
export const GLYPH = { mul: 2.2, mul4: 3.3, r: 170, max: 3, life: 600, minSteps: 3 };

/** a set piece's name for any slot (sets / Trial families with no slot name: "<Short> <noun>") */
export function setPieceName(S, slot, cls) {
  if (slot === 'weapon') return (S.weapon && (S.weapon[cls] || S.weapon.warrior)) || `${S.short} Blade`;
  if (slot === 'offhand') return `${S.short} ${(OFFHAND[cls] || OFFHAND.warrior).noun}`;
  return S[slot] || `${S.short} ${SLOT_NOUN[slot] || 'Charm'}`;
}
/** Make a set piece (slot defaults to a random set slot: every slot but the Relic). */
export function makeSetItem(rng, cls, slot = null, setId = SET_ID) {
  slot = SET_SLOTS.includes(slot) ? slot : SET_SLOTS[Math.floor(rng.next() * SET_SLOTS.length)];
  const S = SETS[setId];
  const it = generateItem(rng, { tier: S.dropTier || S.tier || 5, cls, slot, rarity: 3, minTier: S.tier || 5 }); // (game loop C2: dropTier = the band it drops in now; S.tier stays the legal minimum)
  it.rarity = 4; it.set = setId;
  it.name = setPieceName(S, slot, cls);
  return it;
}
export const SIGIL_NAME = 'Trial Sigil: Neferakh Unbound';
export function makeSigil(rng) {
  return { uid: 'sg' + Math.floor(rng.next() * 2 ** 32).toString(36) + Math.floor(rng.next() * 2 ** 32).toString(36), slot: 'sigil', rarity: 5, tier: 5, name: SIGIL_NAME, stats: {}, sigil: 'neferakh' };
}
export const isGear = (it) => !!(it && SLOTS.includes(it.slot));

// ------------------------------------------------------------------ set bonuses (gear expansion: 2-piece + 4-piece)
// Every biome / crafted set AND every Trial / Extreme family is a set: 2 pieces = stats, 4 pieces = a mechanic (+ stats for
// the crafted ones). A Trial / Extreme piece also keeps its own family proc from the first piece (sim/exotic.js).
// Stacking rule (so 10 slots can't stack everything): at most TWO 2-piece bonuses and ONE 4-piece bonus are active, the sets
// you wear the most pieces of first (ties: the higher tier).
export const SET_RULE = { twoMax: 2, fourMax: 1 };
/** the Trial / Extreme families as sets (names / procs live in sim/exotic.js EXOTIC; ids match) */
export const FAMILY_SETS = {
  rimebound: { two: { maxHp: 100, crit: 0.02 }, twoText: '+100 Max HP, +2% Crit Chance', proc4: 'frostnova',
    fourText: 'FROST NOVA: your chain finishers release a frost nova around the target: ×1.4 ATK in 170 px and chills everything it touches (3 s cooldown).' },
  cinderbound: { two: { atk: 8, critDmg: 0.06 }, twoText: '+8 Attack, +6% Crit Damage', proc4: 'valve4',
    fourText: 'OVERPRESSURE: Pressure Valve vents every 6 s instead of 8, in a 170 px burst.' },
  starbound: { two: { crit: 0.02, ultCharge: 0.02 }, twoText: '+2% Crit Chance, +2% Ult Charge', proc4: 'star4',
    fourText: 'METEOR SHOWER: Starfall triggers on 16% of hits instead of 10%.' },
  zeropoint: { two: { critDmg: 0.08, def: 20 }, twoText: '+8% Crit Damage, +20 Defense', proc4: 'zero4',
    fourText: 'DEEP FREEZE: Absolute Zero recharges in 7.5 s instead of 10.' },
  worldheart: { two: { atk: 10, maxHp: 120 }, twoText: '+10 Attack, +120 Max HP', proc4: 'heart4',
    fourText: 'RACING HEART: every 3rd beat is RED instead of every 4th.' },
  bigbang: { two: { crit: 0.03, critDmg: 0.06 }, twoText: '+3% Crit Chance, +6% Crit Damage', proc4: 'nova4',
    fourText: 'COLLAPSE: Supernova needs 22 stardust instead of 30.' },
  sunbound: { two: { atk: 7, crit: 0.02 }, twoText: '+7 Attack, +2% Crit Chance', proc4: 'brand4',
    fourText: 'SUNFLARE: Solar Brand recharges in 4.5 s instead of 6.' },
  stormbound: { two: { atk: 6, maxHp: 80 }, twoText: '+6 Attack, +80 Max HP', proc4: 'thunder4',
    fourText: 'LIVE WIRE: Thunderclap recharges in 5 s instead of 7.' },
  skyfall: { two: { crit: 0.02, critDmg: 0.06 }, twoText: '+2% Crit Chance, +6% Crit Damage', proc4: 'skyfall4',
    fourText: 'SUPERCELL: Skyfall recharges in 8 s instead of 11.' },
  blacksun: { two: { atk: 10, critDmg: 0.06 }, twoText: '+10 Attack, +6% Crit Damage', proc4: 'bsun4',
    fourText: 'EVENT HORIZON: Black Sun recharges in 9 s instead of 12.' },
};
const RANK = { mothwing: 2, stormbound: 4, skyfall: 5, wildwarden: 1, duneborn: 2, sunscorch: 3, frostveil: 3, emberdeep: 3, rimebound: 4, cinderbound: 4, starbound: 4, sunbound: 4, zeropoint: 5, worldheart: 5, bigbang: 5, blacksun: 5 };
/** the set an item belongs to (a set id or a Trial / Extreme family id), or null */
export const setOf = (it) => (it ? (it.set && SETS[it.set] ? it.set : it.ex && FAMILY_SETS[it.ex] ? it.ex : null) : null);
/** the bonus table of a set id: { two, twoText, four?, fourText, proc4 } */
export const setDef = (id) => SETS[id] || FAMILY_SETS[id] || null;
/** Equipped pieces of a set (a biome / crafted set or a Trial / Extreme family). */
export function setCount(p, id = SET_ID) { let n = 0; for (const k of EQUIP_SLOTS) { const it = p.equipment && p.equipment[k]; if (it && setOf(it) === id) n++; } return n; }
/** which set bonuses are live: { counts: { id: n }, two: [ids], four: id | null } (SET_RULE) */
export function setBonuses(p) {
  const counts = {};
  if (p && p.equipment) for (const k of EQUIP_SLOTS) { const id = setOf(p.equipment[k]); if (id) counts[id] = (counts[id] || 0) + 1; }
  const order = Object.keys(counts).filter((id) => counts[id] >= 2).sort((a, b) => counts[b] - counts[a] || (RANK[b] || 0) - (RANK[a] || 0) || (a < b ? -1 : 1));
  const two = order.slice(0, SET_RULE.twoMax);
  const four = order.find((id) => counts[id] >= 4 && two.includes(id)) || null;
  return { counts, two, four };
}
/** the 4-piece mechanic a hero has live (or null) */
export const fourProc = (p) => { const f = setBonuses(p).four; return f ? setDef(f).proc4 || null : null; };
/** computeStats hook: the live 2-piece stats (+ the live 4-piece stats of the crafted sets). */
export function applySetStats(p, s) {
  const B = setBonuses(p);
  for (const id of B.two) { const S = setDef(id); for (const k in S.two) s[k] = (s[k] || 0) + S.two[k]; }
  if (B.four) { const S = setDef(B.four); if (S.four) for (const k in S.four) s[k] = (s[k] || 0) + S.four[k]; }
  return B;
}
