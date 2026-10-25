// Item/loot tables (data only). Generation logic lives in sim/loot.js.
export const RARITIES = [
  { id: 'common', name: 'Common', color: '#d9dde3', mul: 1.0, affixes: 1 },
  { id: 'rare', name: 'Rare', color: '#4aa8ff', mul: 1.35, affixes: 2 },
  { id: 'epic', name: 'Epic', color: '#b86bff', mul: 1.75, affixes: 3 },
  { id: 'legendary', name: 'Legendary', color: '#ffb52e', mul: 2.3, affixes: 4 },
  // exclusive tiers (never rolled by rollRarity: made by sim/sets.js): Set = Normal-dungeon only, Sigil = a Trial key
  { id: 'set', name: 'Set', color: '#2ee6c4', mul: 2.3, affixes: 4 },
  { id: 'sigil', name: 'Trial Sigil', color: '#ff4f7b', mul: 1, affixes: 0 },
  // piece 4: boss-trial gear (sim/exotic.js): Trial = crafted from / dropped by a Trial boss; Extreme = its Extreme, with a unique proc
  { id: 'trial', name: 'Trial', color: '#ff6ad5', mul: 2.3, affixes: 4 },
  { id: 'extreme', name: 'Extreme', color: '#ff3b3b', mul: 2.3, affixes: 4 },
];
/** the loot ladder, low to high (rarity ids): Common < Rare < Epic < Legendary < Set (biome / dungeon) < Trial < Extreme */
export const TIER_LADDER = [0, 1, 2, 3, 4, 6, 7];
/** Bag / beam / border colours by rarity index (bags: a little darker). */
export const RARITY_COLORS = ['#d9dde3', '#4aa8ff', '#b86bff', '#ffb52e', '#2ee6c4', '#ff4f7b'];
export const BAG_TITLES = ['Loot Bag', 'Rare Bag', 'Epic Bag', 'Legendary Bag', 'Set Bag', 'Sigil Reliquary', 'Trial Reliquary', 'Extreme Reliquary'];
// weights [common, rare, epic, legendary] by loot tier (zone 1..4, 5 = boss)
export const RARITY_WEIGHTS = {
  1: [80, 18, 2, 0],
  2: [62, 30, 7, 1],
  3: [42, 38, 16, 4],
  4: [26, 40, 25, 9],
  5: [0, 15, 55, 30],
};
// Gear expansion (step 3): 10 equipment slots. SLOTS = the item slot TYPES (a ring fits Ring or Ring II); EQUIP_SLOTS = the
// hero's equipment keys. 'armor' is the Chest (the key stays 'armor' so every old save / co-op message keeps working).
export const SLOTS = ['weapon', 'offhand', 'helm', 'armor', 'gloves', 'boots', 'ring', 'amulet', 'relic'];
export const EQUIP_SLOTS = ['weapon', 'offhand', 'helm', 'armor', 'gloves', 'boots', 'ring', 'ring2', 'amulet', 'relic'];
/** equipment key -> the item slot type it takes */
export const SLOT_TYPE = { ring2: 'ring' };
export const slotType = (eq) => SLOT_TYPE[eq] || eq;
/** can an item of slot type `slot` go into equipment key `eq`? */
export const fitsSlot = (slot, eq) => slot === slotType(eq);
export const SLOT_LABEL = { weapon: 'Weapon', offhand: 'Off-hand', helm: 'Helm', armor: 'Chest', gloves: 'Gloves', boots: 'Boots', ring: 'Ring', ring2: 'Ring II', amulet: 'Amulet', relic: 'Relic' };
/** random drops: which slot type (weights; the ring counts twice, it fills two slots). Relics never roll here: they come
 *  from elites / bosses / Swarm chests / Trials (sim/exotic.js relicDrop) */
export const DROP_SLOTS = [['weapon', 1.3], ['offhand', 1], ['helm', 1], ['armor', 1.2], ['gloves', 1], ['boots', 1], ['ring', 1.5], ['amulet', 1]];
/** the slot types a set / Trial / Extreme family can make (every slot but the Relic) */
export const SET_SLOTS = ['weapon', 'offhand', 'helm', 'armor', 'gloves', 'boots', 'ring', 'amulet'];
/** Off-hand: one shared slot type, flavoured per class (5 tier names + the noun used by sets / Trial families) */
export const OFFHAND = {
  warrior: { noun: 'Bulwark', names: ['Plank Shield', 'Iron Buckler', 'Tower Shield', 'Runed Bulwark', 'Warlord Aegis'] },
  ranger: { noun: 'Quiver', names: ['Hide Quiver', 'Fletcher Quiver', 'Hawkfeather Quiver', 'Elvish Quiver', 'Stormquiver'] },
  mage: { noun: 'Focus', names: ['Glass Bauble', 'Apprentice Orb', 'Crystal Focus', 'Arcane Prism', 'Void Lens'] },
  cleric: { noun: 'Sacred Shield', names: ['Wooden Heater', 'Iron Kite Shield', 'Blessed Shield', 'Sunforged Aegis', 'Shield of Dawn'] },
  bladedancer: { noun: 'War Fan', names: ['Paper Fan', 'Iron Fan', 'Serpent Fan', 'Moonsilver Fan', 'Starfall Tessen'] },
  samurai: { noun: 'Wakizashi', names: ['Bamboo Tanto', 'Iron Wakizashi', 'Folded Wakizashi', 'Moonlit Kodachi', 'Sakura Wakizashi'] },
  monk: { noun: 'Prayer Beads', names: ['Wooden Beads', 'Jade Beads', 'Tiger-Eye Mala', 'Crane Rosary', 'Dragon Pearl Mala'] },
  dragoon: { noun: 'Wyvern Buckler', names: ['Ash Buckler', 'Iron Targe', 'Wyrmscale Buckler', 'Skyrender Targe', 'Wyvern Aegis'] },
  summoner: { noun: 'Quill', names: ['Goose Quill', 'Bound Inkwell', 'Ink-Drake Quill', 'Ageless Quill', 'Quill of the First Ink'] },
  bard: { noun: 'Songbook', names: ['Torn Songsheet', 'Maple Songbook', 'Silverleaf Hymnal', 'Songweaver Folio', 'Aurora Songbook'] },
};
export const SLOT_NOUN = { helm: 'Crown', armor: 'Mail', gloves: 'Gauntlets', boots: 'Greaves', ring: 'Band', amulet: 'Pendant' };
/** Relic: a special slot (rarer, stronger). Main stat = one of these boosts (the relic's type names it) */
export const RELIC_TYPES = {
  chainDmg: { names: ['Chainmaster\'s Idol', 'Idol of the Unbroken Chain', 'Reliquary of a Thousand Chains'], text: 'Chain Damage' },
  spDmg: { names: ['Signet Relic', 'Relic of the Signature', 'Heart of the Special'], text: 'Special Damage' },
  ultCharge: { names: ['Ascendant Reliquary', 'Relic of the Rising Sun', 'Crown-Shard of Ascension'], text: 'Ult Charge' },
};
export const BASE_NAMES = {
  weapon: {
    warrior: ['Rusty Sword', 'Iron Longsword', 'Steel Claymore', 'Runed Greatblade', 'Warlord Cleaver'],
    ranger: ['Twig Bow', 'Hunter Bow', 'Recurve Bow', 'Elvish Longbow', 'Stormstring'],
    mage: ['Oak Wand', 'Apprentice Staff', 'Crystal Staff', 'Arcane Scepter', 'Void Rod'],
    cleric: ['Wooden Mace', 'Iron Mace', 'Blessed Flail', 'Sunforged Hammer', 'Mace of Dawn'],
    bladedancer: ['Rusty Shivs', 'Twin Daggers', 'Serpent Fangs', 'Moonsilver Kris', 'Starfall Blades'],
    samurai: ['Bamboo Bokken', 'Iron Katana', 'Folded Katana', 'Moonlit Tachi', 'Sakura Nodachi'],
    monk: ['Linen Wraps', 'Iron Knuckles', 'Tiger Wraps', 'Crane Gauntlets', 'Dragon Fists'],
    dragoon: ['Ash Pike', 'Iron Spear', 'Wyrmtooth Lance', 'Skyrender Glaive', 'Gae Bolg'],
    summoner: ['Torn Primer', 'Bound Grimoire', 'Inkwell Codex', 'Bestiary of Ages', 'Tome of the First Ink'],
    bard: ['Cracked Lute', 'Maple Lute', 'Silverstring Lute', 'Songweaver Harp', 'Aurora Lyre'],
  },
  armor: ['Padded Tunic', 'Leather Vest', 'Chain Hauberk', 'Plate Cuirass', 'Dragonscale Mail'],
  ring: ['Copper Band', 'Silver Ring', 'Gold Signet', 'Opal Loop', 'Starforged Ring'],
  helm: ['Cloth Hood', 'Leather Cap', 'Chain Coif', 'Plate Helm', 'Dragonscale Crown'],
  gloves: ['Cloth Wraps', 'Leather Gloves', 'Chain Gauntlets', 'Plate Gauntlets', 'Dragonscale Grips'],
  boots: ['Sandals', 'Leather Boots', 'Chain Greaves', 'Plate Sabatons', 'Dragonscale Treads'],
  amulet: ['Bone Charm', 'Silver Locket', 'Gold Pendant', 'Opal Talisman', 'Starforged Amulet'],
};
export const LEGENDARY_NAMES = {
  weapon: { warrior: ['Sunderfang', "Grimtusk's Maw"], ranger: ['Galeheart', 'Whisperwind'], mage: ['Emberwake', 'Staff of Nine Stars'], cleric: ['Lightbringer', 'Oath of the Haven'], bladedancer: ['Twin Whispers', 'Crimson Waltz'], samurai: ['Last Petal', 'Moonsplitter'], monk: ['Hundred Hands', 'Palm of Heaven'], dragoon: ['Wyrmsong', 'Nidhogg\'s Fang'], summoner: ['The Endless Bestiary', 'Codex of Living Ink'], bard: ['Heartstring', 'Lyre of the Last Song'] },
  armor: ['Aegis of the Meadow', 'Ashen Warplate'],
  ring: ['Band of Endless Combo', 'Eye of the Storm'],
  helm: ['Crown of the Hollow King', 'Gaze of Grimtusk'],
  gloves: ['Hands of the Tempest', 'Grip of the Colossus'],
  boots: ['Windwalker Treads', 'Stride of the Seventh League'],
  amulet: ['Heart of the Meadow', 'Tear of the Moon'],
};
export const PREFIX = { common: '', rare: 'Fine ', epic: 'Heroic ', legendary: '', set: '', sigil: '' };
// affix: [min, max] at tier 1, scaled with tier inside loot.js
export const AFFIXES = {
  atk: { label: 'Attack', min: 2, max: 5, fmt: 'int' },
  def: { label: 'Defense', min: 2, max: 5, fmt: 'int' },
  maxHp: { label: 'Max HP', min: 10, max: 24, fmt: 'int' },
  maxRes: { label: 'Max Resource', min: 5, max: 12, fmt: 'int' },
  crit: { label: 'Crit Chance', min: 0.01, max: 0.03, fmt: 'pct' },
  critDmg: { label: 'Crit Damage', min: 0.05, max: 0.14, fmt: 'pct' },
  spd: { label: 'Move Speed', min: 0.015, max: 0.04, fmt: 'pct' },
  hpRegen: { label: 'HP Regen', min: 0.4, max: 1.2, fmt: 'dec' },
  resRegen: { label: 'Resource Regen', min: 0.8, max: 2.2, fmt: 'dec' },
  // gear expansion (step 3): the new sub-stats every class can roll
  atkPct: { label: 'Attack %', min: 0.012, max: 0.025, fmt: 'pct' },
  chainAll: { label: 'Chain Damage', stat: 'chainDmg', min: 0.015, max: 0.03, fmt: 'pct' }, // (every class: writes chainDmg; Warrior's own swap keeps its bigger range)
  spDmg: { label: 'Special Damage', min: 0.08, max: 0.18, fmt: 'pct' },
  ultCharge: { label: 'Ult Charge', min: 0.008, max: 0.016, fmt: 'pct' }, // (small on purpose: the harness found ult-bound kits swing hard on it)
  matFind: { label: 'Material Find', min: 0.03, max: 0.07, fmt: 'pct' },
  goldFind: { label: 'Gold Find', min: 0.04, max: 0.09, fmt: 'pct' },
  // Warrior only (Glory has a fixed size and no regen): these replace Max Resource / Resource Regen on Warrior gear
  gloryGain: { label: 'Glory Gain', min: 0.04, max: 0.1, fmt: 'pct', cls: 'warrior' },
  chainDmg: { label: 'Chain Damage', min: 0.08, max: 0.2, fmt: 'pct', cls: 'warrior' },
  // Samurai only (Focus has a fixed size and no regen): these replace Max Resource / Resource Regen on Samurai gear
  focusGain: { label: 'Focus Gain', min: 0.05, max: 0.12, fmt: 'pct', cls: 'samurai' },
  cutDmg: { label: 'Delayed Cut Damage', min: 0.06, max: 0.15, fmt: 'pct', cls: 'samurai' },
  // Monk only (Chi has a fixed size and no regen): these replace Max Resource / Resource Regen on Monk gear
  chiGain: { label: 'Chi Gain', min: 0.05, max: 0.12, fmt: 'pct', cls: 'monk' },
  ppDmg: { label: 'Pressure Point Damage', min: 0.06, max: 0.15, fmt: 'pct', cls: 'monk' },
  // Dragoon only (Dragon Blood has a fixed size and no regen): these replace Max Resource / Resource Regen on Dragoon gear
  bloodGain: { label: 'Dragon Blood Gain', min: 0.05, max: 0.12, fmt: 'pct', cls: 'dragoon' },
  impaleDmg: { label: 'Impaled Damage', min: 0.06, max: 0.15, fmt: 'pct', cls: 'dragoon' },
  // Grimoire Summoner only (Ink has a fixed size and no regen)
  inkGain: { label: 'Ink Gain', min: 0.05, max: 0.12, fmt: 'pct', cls: 'summoner' },
  summonDmg: { label: 'Creature Damage', min: 0.05, max: 0.13, fmt: 'pct', cls: 'summoner' },
  // Bard only (Tempo has a fixed size and no regen)
  tempoGain: { label: 'Tempo Gain', min: 0.05, max: 0.12, fmt: 'pct', cls: 'bard' },
  songPower: { label: 'Song Power', min: 0.04, max: 0.1, fmt: 'pct', cls: 'bard' },
};
/** Affixes a class's gear never rolls (Warrior: no Max Resource / Resource Regen, it rolls the Rage stats instead; Blade Dancer:
 *  its pips have a fixed size and regen too, so those slots roll Crit Damage / Crit Chance instead, stacking onto a crit roll). */
export const AFFIX_SWAP = { warrior: { maxRes: 'gloryGain', resRegen: 'chainDmg' }, bladedancer: { maxRes: 'critDmg', resRegen: 'crit' }, samurai: { maxRes: 'focusGain', resRegen: 'cutDmg' }, monk: { maxRes: 'chiGain', resRegen: 'ppDmg' }, dragoon: { maxRes: 'bloodGain', resRegen: 'impaleDmg' }, summoner: { maxRes: 'inkGain', resRegen: 'summonDmg' }, bard: { maxRes: 'tempoGain', resRegen: 'songPower' } };
/** Old items: how a Max Resource / Resource Regen roll converts into the class's replacement stat (the same share of its range). */
export const AFFIX_MIGRATE = {
  warrior: { maxRes: ['gloryGain', 0.008], resRegen: ['chainDmg', 0.0833], rageGain: ['gloryGain', 1], rageDmg: ['chainDmg', 1.667], swapDmg: ['chainDmg', 1] }, // (old Rage / Swap Strike gear -> Glory Gain / Chain Damage)
  bladedancer: { maxRes: ['critDmg', 0.14 / 12], resRegen: ['crit', 0.03 / 2.2] },
};
export const STAT_LABELS = {
  maxHp: 'Max HP', maxRes: 'Max Resource', atk: 'Attack', def: 'Defense', spd: 'Speed', crit: 'Crit Chance',
  critDmg: 'Crit Damage', hpRegen: 'HP Regen', resRegen: 'Resource Regen', atkPct: 'Attack %', spDmg: 'Special Damage', ultCharge: 'Ult Charge', matFind: 'Material Find', goldFind: 'Gold Find', chiGain: 'Chi Gain', ppDmg: 'Pressure Point Damage', bloodGain: 'Dragon Blood Gain', impaleDmg: 'Impaled Damage', gloryGain: 'Glory Gain', chainDmg: 'Chain Damage', focusGain: 'Focus Gain', cutDmg: 'Delayed Cut Damage', inkGain: 'Ink Gain', summonDmg: 'Creature Damage', tempoGain: 'Tempo Gain', songPower: 'Song Power',
};

/** Gear expansion budget (step 3). 10 slots instead of 3, so every number is re-split so a hero's TOTAL gear power at a tier
 *  stays ~1.0-1.15x what three pieces gave (tools/gear-budget.mjs + the balance harness check it).
 *  main: per slot type, each main stat = [a, b, share]: (a + b*tier) * rarity mul * roll * share (weapon / armor keep the
 *  old a + b*tier curves); pct mains (crit / critDmg / spd) use the affix range * (0.7 + 0.5*tier) * rarity mul * share.
 *  sub: how many sub-stats by rarity, and the per-roll value scale (old affix formula * k). */
export const GEAR = {
  main: {
    weapon: { atk: [4, 7, 0.84] },
    offhand: { atk: [4, 7, 0.18] },
    helm: { maxHp: [10, 22, 0.36] },
    armor: { def: [3, 5, 0.75], maxHp: [10, 22, 0.55] },
    gloves: { crit: [0, 0, 0.22] },
    boots: { spd: [0, 0, 0.3], def: [3, 5, 0.3] },
    amulet: { critDmg: [0, 0, 0.22] },
    ring: { _pick: ['crit', 'critDmg', 'atk', 'maxHp'], share: 0.5 },
    relic: { _pick: ['chainDmg', 'spDmg', 'ultCharge'] },
  },
  /** relic main at tier 5 Legendary (scales with tier and rarity) */
  relic: { chainDmg: 0.05, spDmg: 0.35, ultCharge: 0.04 },
  subs: [2, 2, 3, 4, 4, 0, 4, 4], // by rarity (sigil 0)
  relicSubs: [2, 2, 2, 3, 3, 0, 3, 3],
  subK: 0.3,
  clsK: 0.36,
  resK: 0.55, // a class's own swap stats (Glory Gain, Song Power, Creature Damage ...): 2 of 15 pool keys now (2 of 9 before), so each roll keeps most of its old size and the total stays ~where it was
};
/** the per-roll scale of a sub-stat key */
export const subKOf = (k) => (AFFIXES[k] && AFFIXES[k].cls ? GEAR.clsK : k === 'maxRes' || k === 'resRegen' ? GEAR.resK : GEAR.subK); // (Max Resource / Resource Regen ARE the resource stats of the classes that don't swap them)
export const GEAR_VERSION = 2;
/** game loop C1: gear tiers run 1..8 (t5 = Dunes / Frost, t6 = Emberdeep, t7 = the Rift, t8 = the level cap). Tiers 6-8 keep
 *  the tier-5 base names under a tier word (no extra rng draw: tier 1-5 rolls are unchanged). */
export const TIER_MAX = 8;
export const TIER_WORD = { 6: 'Exalted', 7: 'Riftborn', 8: 'Celestial' };
