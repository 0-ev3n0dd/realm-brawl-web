import { OVERLORD_POS, OVERLORD_R } from '../dunesconst.js';
import { wildsSite, dunesSite } from '../mapshape.js';
import { frostSite } from '../frostconst.js';
import { emberSite } from '../emberconst.js';
import { riftSite } from '../riftconst.js';
// Enemy archetypes. `ai` selects a behaviour in sim/ai.js; numbers are base values for the zone.
// dmg is raw damage before the player's defence. Bullet patterns are readable & telegraphed.
// (DPS-UP pass 2026-10-05: world-boss HP x1.64-1.75 (the class-average boss DPS rose that much; typical solo ~1.5 min): Grimtusk 67k -> 113k,
//  Khepra 104k -> 181k, Skaldra 140k -> 233k, Morwen 160k -> 264k, Vyrnhal 165k -> 276k, Pyrrhex 260k -> 432k, Vitrea 300k -> 493k,
//  Solgrim 280k -> 461k, Thornmaw 38k -> 64k, Ashfang 48k -> 81k, Ankhara 72k -> 126k, Sekhem 88k -> 154k, Vorthax 350k -> 500k)
export const ENEMIES = {
  // ---- Brightwater Village: the Training Dummy (never moves, attacks or dies; sim/village.js) ----
  spcore:   { name: 'Blade Core', zone: 4, hp: 20000, dmg: 0, spd: 0, r: 46, xp: 0, def: 0, ai: 'inert', mass: 99, color: '#9fe8ff', dropChance: 0 }, // (encounter revamp Part 0: the Hold the Blade DPS check, sim/setpiece.js)
  spwarden: { name: 'Sand Warden', zone: 4, hp: 8000, dmg: 0, spd: 0, r: 40, xp: 0, def: 0, ai: 'inert', mass: 99, color: '#e8c27a', dropChance: 0 }, // (Part 1: Neferakh's Sunbearer set piece, sim/setpiece.js carry)
  dummy:    { name: 'Training Dummy', zone: 1, hp: 60000, dmg: 0, spd: 0, r: 20, xp: 0, def: 0, ai: 'dummy', mass: 99, color: '#c99a5b', dummy: true },
  // ---- Zone 1: Greenwood Glade ----
  slime:    { name: 'Slime', zone: 1, hp: 44, dmg: 9, spd: 70, r: 16, xp: 12, def: 0, ai: 'hopper', mass: 0.8, contact: true, color: '#6fdc5a' },
  goblin:   { name: 'Goblin Rusher', zone: 1, hp: 58, dmg: 12, spd: 115, r: 15, xp: 16, def: 0, ai: 'rusher', mass: 1, color: '#8bc34a' },
  sprout:   { name: 'Sprout Shooter', zone: 1, hp: 50, dmg: 8, spd: 0, r: 17, xp: 16, def: 0, ai: 'turret', mass: 99, color: '#4caf50' },
  // ---- Zone 2: Stonefang Hills ----
  boar:     { name: 'Tusk Boar', zone: 2, hp: 190, dmg: 24, spd: 80, r: 22, xp: 45, def: 12, ai: 'charger', mass: 2.2, color: '#a0674b' },
  skeleton: { name: 'Bone Archer', zone: 2, hp: 105, dmg: 16, spd: 88, r: 15, xp: 40, def: 6, ai: 'archer', mass: 1, color: '#f1eee4' },
  shroom:   { name: 'Spore Cap', zone: 2, hp: 130, dmg: 15, spd: 38, r: 18, xp: 42, def: 8, ai: 'spinner', mass: 1.5, color: '#e5534b' },
  // ---- Zone 3: Ashen Wilds ----
  golem:    { name: 'Stone Golem', zone: 3, hp: 520, dmg: 34, spd: 52, r: 30, xp: 120, def: 30, ai: 'slammer', mass: 5, color: '#9aa3ad' },
  wisp:     { name: 'Hex Wisp', zone: 3, hp: 190, dmg: 20, spd: 95, r: 14, xp: 95, def: 10, ai: 'caster', mass: 0.8, color: '#6fd3ff' },
  wolf:     { name: 'Ash Wolf', zone: 3, hp: 210, dmg: 18, spd: 155, r: 17, xp: 80, def: 14, ai: 'pack', mass: 1.3, contact: true, color: '#8d8f99' },
  // ---- Zone 4: Dread Frontier ----
  knight:   { name: 'Dread Knight', zone: 4, hp: 900, dmg: 44, spd: 78, r: 23, xp: 260, def: 45, ai: 'knight', mass: 3.5, color: '#3b3f58' },
  imp:      { name: 'Cinder Imp', zone: 4, hp: 380, dmg: 26, spd: 100, r: 15, xp: 220, def: 22, ai: 'spiral', mass: 1, color: '#ff5a3c' },
  // ---- the Glowmire Hollow (the Wilds' dungeon, Lv 12; sim/glowmire.js) ----
  mirecap:  { name: 'Mirecap Sporeling', zone: 3, hp: 220, dmg: 18, spd: 42, r: 18, xp: 90, def: 12, ai: 'spinner', mass: 1.5, color: '#c9f27a' },
  mothling: { name: 'Glowmoth Mothling', zone: 3, hp: 170, dmg: 18, spd: 105, r: 14, xp: 85, def: 8, ai: 'caster', mass: 0.7, color: '#d8ff9a' },
  thornhound: { name: 'Thornback Hound', zone: 3, hp: 230, dmg: 19, spd: 150, r: 17, xp: 85, def: 14, ai: 'pack', mass: 1.3, contact: true, color: '#5f7d3a' },
  bogbrute: { name: 'Bog Brute', zone: 4, hp: 640, dmg: 34, spd: 56, r: 29, xp: 160, def: 30, ai: 'slammer', mass: 5, color: '#4f6b4a' },
  lumivex:  { name: 'Lumivex, the Moth Matriarch', zone: 4, hp: 100000, dmg: 30, spd: 0, r: 64, xp: 6000, def: 24, ai: 'raid', mass: 99, boss: true, raid: true, color: '#d8ff9a' },
  // ---- the Wilds Trial: Vharok, the Stormhorn (a giant storm elk; the Stormcrown Tor) ----
  trvharok: { name: 'Vharok, the Stormhorn (Trial)', zone: 4, hp: 100000, dmg: 32, spd: 0, r: 70, xp: 9000, def: 26, ai: 'raid', mass: 99, boss: true, raid: true, color: '#7fc8ff' },
  trvharokx: { name: 'Vharok, the Stormhorn (Extreme)', zone: 4, hp: 100000, dmg: 34, spd: 0, r: 74, xp: 12000, def: 28, ai: 'raid', mass: 99, boss: true, raid: true, color: '#c9a2ff' },
  stormhound: { name: 'Stormcalf', zone: 3, hp: 230, dmg: 18, spd: 150, r: 17, xp: 60, def: 12, ai: 'pack', mass: 1.3, contact: true, color: '#8fd0ff' },
  // ---- Sunscorch Dunes (biome 2; stats are Danger 3 values, scaled up per ring by the spawner) ----
  scarab:   { name: 'Gilded Scarab', zone: 3, hp: 240, dmg: 20, spd: 120, r: 18, xp: 90, def: 14, ai: 'scarab', mass: 1.4, contact: true, color: '#2fb7a8', dunes: true },
  scarabling: { name: 'Scarabling', zone: 3, hp: 60, dmg: 10, spd: 150, r: 10, xp: 12, def: 4, ai: 'hopper', mass: 0.6, contact: true, color: '#44d6c4', dunes: true },
  sandwurm: { name: 'Burrowing Sandwurm', zone: 3, hp: 560, dmg: 30, spd: 230, r: 28, xp: 150, def: 20, ai: 'burrower', mass: 4, color: '#d9a35b', dunes: true },
  mirage:   { name: 'Mirage Caster', zone: 3, hp: 300, dmg: 22, spd: 95, r: 17, xp: 130, def: 12, ai: 'mirage', mass: 1, color: '#7f6bff', dunes: true },
  jackal:   { name: 'Anubite Jackal', zone: 3, hp: 260, dmg: 22, spd: 160, r: 18, xp: 100, def: 16, ai: 'pack', mass: 1.3, contact: true, color: '#3a3346', dunes: true },
  // ---- Tomb of the Sun-Eaten King (the Normal dungeon) ----
  mummy:    { name: 'Bound Mummy', zone: 4, hp: 480, dmg: 30, spd: 64, r: 22, xp: 140, def: 22, ai: 'mummy', mass: 2.5, color: '#e9dcb8', dunes: true },
  sunpriest: { name: 'Sun-Eaten Priest', zone: 4, hp: 320, dmg: 26, spd: 82, r: 17, xp: 130, def: 14, ai: 'sunpriest', mass: 1, color: '#ffb43c', dunes: true },
  // ---- Dunes Overlord + the Tomb boss ----
  khepra:   { name: 'Khepra, the Sandwurm Queen', zone: 4, hp: 228000, dmg: 46, spd: 95, r: 66, xp: 5200, def: 50, ai: 'overlord', mass: 50, boss: true, color: '#c98a3a', dunes: true, arena: { x: OVERLORD_POS.x, y: OVERLORD_POS.y, r: OVERLORD_R } },
  neferakh: { name: 'Neferakh, the Sun-Eaten King', zone: 4, hp: 225000, dmg: 40, spd: 70, r: 58, xp: 9000, def: 40, ai: 'raid', mass: 99, boss: true, raid: true, color: '#ffcf4a', dunes: true },
  // ---- Frostveil Peaks (biome 3; stats are Danger 4 values, scaled up per ring by the spawner; sim/frostai.js) ----
  penguin:  { name: 'Glacier Penguin', zone: 4, hp: 300, dmg: 24, spd: 105, r: 17, xp: 120, def: 18, ai: 'slider', mass: 1.4, contact: true, color: '#26324d', frost: true },
  yeti:     { name: 'Frostback Yeti', zone: 4, hp: 820, dmg: 36, spd: 78, r: 28, xp: 240, def: 30, ai: 'yeti', mass: 4, color: '#eaf4ff', frost: true },
  shardwisp: { name: 'Shard Wisp', zone: 4, hp: 340, dmg: 24, spd: 100, r: 15, xp: 170, def: 14, ai: 'shardwisp', mass: 0.8, color: '#8fe3ff', frost: true },
  rimewraith: { name: 'Rime Wraith', zone: 4, hp: 420, dmg: 30, spd: 118, r: 18, xp: 200, def: 18, ai: 'rimewraith', mass: 1, color: '#aebcff', frost: true },
  // ---- the Glacier Crypt (the Normal dungeon) ----
  sentinel: { name: 'Frozen Sentinel', zone: 4, hp: 760, dmg: 34, spd: 60, r: 24, xp: 220, def: 36, ai: 'sentinel', mass: 3.5, color: '#7fa6c9', frost: true },
  acolyte:  { name: 'Rime Acolyte', zone: 4, hp: 380, dmg: 28, spd: 84, r: 17, xp: 180, def: 16, ai: 'acolyte', mass: 1, color: '#5d7fd6', frost: true },
  icepawn:  { name: 'Ice Pawn', zone: 4, hp: 1100, dmg: 30, spd: 0, r: 22, xp: 60, def: 40, ai: 'piece', mass: 99, color: '#dff4ff', frost: true },
  iceknight: { name: 'Ice Knight', zone: 4, hp: 2000, dmg: 36, spd: 0, r: 26, xp: 100, def: 40, ai: 'piece', mass: 99, color: '#bfe3ff', frost: true },
  gift:     { name: 'Wrapped Gift', zone: 4, hp: 700, dmg: 22, spd: 0, r: 20, xp: 20, def: 10, ai: 'gift', mass: 99, color: '#ff5e7a', frost: true },
  // ---- Frostveil world bosses (each holds its own arena) + the Overlord + the Crypt boss ----
  morwen:   { name: 'Mother Morwen, the Snow Globe', zone: 4, hp: 284000, dmg: 44, spd: 70, r: 56, xp: 4200, def: 48, ai: 'morwen', mass: 50, boss: true, wboss: true, color: '#e9d7ff', frost: true, arena: frostSite('morwen') },
  vyrnhal:  { name: 'Vyrnhal, the Echo Stag', zone: 4, hp: 279000, dmg: 48, spd: 110, r: 60, xp: 5000, def: 52, ai: 'vyrnhal', mass: 50, boss: true, wboss: true, color: '#9fe8ff', frost: true, arena: frostSite('vyrnhal') },
  skaldra:  { name: 'Skaldra, the Glacier Wyrm', zone: 4, hp: 236000, dmg: 50, spd: 90, r: 72, xp: 6500, def: 55, ai: 'skaldra', mass: 50, boss: true, color: '#6fc8ff', frost: true, arena: frostSite('skaldra') },
  osric:    { name: 'Osric, the Rimeking', zone: 4, hp: 100000, dmg: 42, spd: 0, r: 60, xp: 10000, def: 42, ai: 'raid', mass: 99, boss: true, raid: true, color: '#cfeaff', frost: true },
  // ---- Emberdeep Caldera (biome 4; Danger 4 base stats, scaled per band by the spawner; sim/emberai.js) ----
  kindler:  { name: 'Kindler Imp', zone: 4, hp: 280, dmg: 24, spd: 128, r: 15, xp: 120, def: 14, ai: 'kindler', mass: 0.9, color: '#ff7a2e', ember: true },
  basalt:   { name: 'Basalt Golem', zone: 4, hp: 900, dmg: 38, spd: 70, r: 28, xp: 250, def: 34, ai: 'cooler', mass: 4.5, color: '#3c3038', ember: true },
  moth:     { name: 'Ember Moth', zone: 4, hp: 300, dmg: 22, spd: 135, r: 16, xp: 160, def: 12, ai: 'moth', mass: 0.6, color: '#ffb347', ember: true },
  lavaeel:  { name: 'Magma Eel', zone: 4, hp: 460, dmg: 30, spd: 120, r: 20, xp: 210, def: 18, ai: 'eel', mass: 1.2, color: '#ff4b1f', ember: true },
  mortar:   { name: 'Ashen Bombardier', zone: 4, hp: 380, dmg: 30, spd: 66, r: 19, xp: 190, def: 20, ai: 'mortar', mass: 1.6, color: '#8a7f78', ember: true },
  // the Forge of Cinders
  thrall:   { name: 'Forge Thrall', zone: 4, hp: 720, dmg: 34, spd: 74, r: 24, xp: 210, def: 32, ai: 'thrall', mass: 3, color: '#6b4a3a', ember: true },
  construct: { name: 'Slag Construct', zone: 4, hp: 520, dmg: 30, spd: 90, r: 22, xp: 200, def: 26, ai: 'construct', mass: 2.4, color: '#c2562a', ember: true },
  cinderling: { name: 'Cinderling', zone: 4, hp: 160, dmg: 18, spd: 150, r: 12, xp: 30, def: 6, ai: 'hopper', mass: 0.5, contact: true, color: '#ffcf3a', ember: true },
  glassorb: { name: 'Glass Bubble', zone: 4, hp: 260, dmg: 0, spd: 0, r: 26, xp: 10, def: 0, ai: 'bubble', mass: 99, color: '#bff6ff', ember: true },
  vitrea:   { name: 'Vitrea, the Glassblower', zone: 4, hp: 499000, dmg: 44, spd: 80, r: 54, xp: 4200, def: 46, ai: 'vitrea', mass: 50, boss: true, wboss: true, color: '#7ff0e0', ember: true, arena: emberSite('vitrea') },
  solgrim:  { name: 'Solgrim, the Ember Sundial', zone: 4, hp: 466000, dmg: 48, spd: 95, r: 62, xp: 5000, def: 52, ai: 'solgrim', mass: 50, boss: true, wboss: true, color: '#ffb02e', ember: true, arena: emberSite('solgrim') },
  pyrrhex:  { name: 'Pyrrhex, the Caldera Heart', zone: 4, hp: 438000, dmg: 50, spd: 70, r: 78, xp: 6500, def: 55, ai: 'pyrrhex', mass: 50, boss: true, color: '#ff4b1f', ember: true, arena: emberSite('pyrrhex') },
  hephast:  { name: 'Hephast, the Cinder Smith', zone: 4, hp: 100000, dmg: 42, spd: 0, r: 62, xp: 10000, def: 42, ai: 'raid', mass: 99, boss: true, raid: true, color: '#ff8a3a', ember: true },
  // ---- The Astral Rift (Map 5, game loop C3; Danger 4 base stats like Emberdeep, scaled per band + by the level curve) ----
  voidling: { name: 'Voidling', zone: 4, hp: 160, dmg: 18, spd: 150, r: 12, xp: 30, def: 6, ai: 'hopper', mass: 0.5, contact: true, color: '#b48cff', rift: true },
  riftstalker: { name: 'Rift Stalker', zone: 4, hp: 300, dmg: 24, spd: 160, r: 17, xp: 130, def: 16, ai: 'pack', mass: 1.3, contact: true, color: '#5a3d9e', rift: true },
  starwisp: { name: 'Star Wisp', zone: 4, hp: 300, dmg: 24, spd: 100, r: 15, xp: 160, def: 12, ai: 'caster', mass: 0.8, color: '#e8f0ff', rift: true },
  voidarcher: { name: 'Void Archer', zone: 4, hp: 340, dmg: 26, spd: 90, r: 16, xp: 170, def: 14, ai: 'archer', mass: 1, color: '#6ae6ff', rift: true },
  astralknight: { name: 'Astral Knight', zone: 4, hp: 900, dmg: 40, spd: 80, r: 24, xp: 260, def: 36, ai: 'knight', mass: 3.5, color: '#2b2f6e', rift: true },
  voidgolem: { name: 'Voidglass Golem', zone: 4, hp: 950, dmg: 40, spd: 56, r: 30, xp: 260, def: 36, ai: 'slammer', mass: 5, color: '#4a3a7a', rift: true },
  nyxara:   { name: 'Nyxara, the Void Matriarch', zone: 4, hp: 792000, dmg: 44, spd: 105, r: 56, xp: 5200, def: 48, ai: 'wboss', mass: 50, boss: true, wboss: true, color: '#b06cff', rift: true, arena: riftSite('nyxara') },
  orrery:   { name: 'The Shattered Orrery', zone: 4, hp: 705000, dmg: 48, spd: 70, r: 62, xp: 6000, def: 52, ai: 'wboss', mass: 50, boss: true, wboss: true, color: '#ffe27a', rift: true, arena: riftSite('orrery') },
  zerath:   { name: 'Zerath, the Rift Herald', zone: 4, hp: 726000, dmg: 50, spd: 95, r: 70, xp: 7500, def: 55, ai: 'wboss', mass: 50, boss: true, color: '#6ae6ff', rift: true, arena: riftSite('zerath') },
  // ---- World bosses (sim/worldboss.js): each holds its own arena on the map ----
  thornmaw: { name: 'Thornmaw, the Elder Treant', zone: 3, hp: 65000, dmg: 34, spd: 50, r: 60, xp: 2200, def: 40, ai: 'wboss', mass: 50, boss: true, wboss: true, color: '#5d8a3a', arena: wildsSite('thornmaw') },
  ashfang:  { name: 'Ashfang, the Pack Alpha', zone: 4, hp: 82000, dmg: 44, spd: 125, r: 48, xp: 2600, def: 45, ai: 'wboss', mass: 50, boss: true, wboss: true, color: '#7d808c', arena: wildsSite('ashfang') },
  ankhara:  { name: 'Ankhara, the Glass Scorpion', zone: 4, hp: 145000, dmg: 44, spd: 100, r: 58, xp: 4000, def: 48, ai: 'wboss', mass: 50, boss: true, wboss: true, color: '#3fc6d6', dunes: true, arena: dunesSite('ankhara') },
  sekhem:   { name: 'Sekhem, the Sun Colossus', zone: 4, hp: 155000, dmg: 48, spd: 60, r: 64, xp: 4600, def: 55, ai: 'wboss', mass: 50, boss: true, wboss: true, color: '#e0a640', dunes: true, arena: dunesSite('sekhem') },
  // ---- Boss ----
  // ---- Raid boss (The Rift Sanctum; mechanics in sim/raid.js) ----
  fissurecore: { name: 'Fissure Core', zone: 3, hp: 3000, dmg: 20, spd: 0, r: 34, xp: 220, def: 10, ai: 'fcore', mass: 99, color: '#c9b6ff' }, // (Part A4: sim/fissure.js; sized at spawn)
  raidboss: { name: 'Vorthax, the Riftbound Tyrant', zone: 4, hp: 380000, dmg: 40, spd: 46, r: 62, xp: 9000, def: 40, ai: 'raid', mass: 99, boss: true, raid: true, color: '#3b2a86' },
  boss:     { name: 'Grimtusk, the Ashen Warlord', zone: 4, hp: 116000, dmg: 50, spd: 85, r: 58, xp: 3000, def: 55, ai: 'boss', mass: 50, boss: true, color: '#7a4a9e' },
};

export const SPAWN_GROUPS = {
  1: [['slime', 'slime', 'slime'], ['goblin', 'goblin'], ['sprout', 'slime', 'slime'], ['goblin', 'sprout'], ['slime', 'goblin']],
  2: [['boar'], ['skeleton', 'skeleton'], ['shroom', 'skeleton'], ['boar', 'skeleton'], ['shroom', 'shroom']],
  3: [['golem'], ['wolf', 'wolf', 'wolf'], ['wisp', 'wisp'], ['golem', 'wisp'], ['wolf', 'wolf', 'wisp']],
  4: [['knight'], ['imp', 'imp'], ['knight', 'imp'], ['imp', 'imp', 'imp']],
};
