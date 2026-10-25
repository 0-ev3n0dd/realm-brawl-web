// World-boss tuning (no imports: combat.js reads the loot fields, sim/worldboss.js the move rotations).
export const WB = {
  thornmaw: { slot: 'armor', tier: 4, style: 'leaf', col: '#9be05a', summon: 'sprout', n: 3,
    rot: { 1: ['lines', 'ring', 'slam', 'brambles', 'summon'], 2: ['lines', 'brambles', 'ring', 'lines', 'slam', 'summon'] } },
  ashfang: { slot: 'weapon', tier: 5, style: 'dark', col: '#d6d8e2', summon: 'wolf', n: 3,
    rot: { 1: ['pounce', 'fan', 'pounce', 'howl', 'ring'], 2: ['pounce', 'fan', 'ring', 'pounce', 'howl', 'fan'] } },
  ankhara: { slot: 'ring', tier: 5, style: 'sand', col: '#9ff3ff', summon: 'scarab', n: 2,
    rot: { 1: ['lines', 'burrow', 'ring', 'fan'], 2: ['burrow', 'lines', 'ring', 'burrow', 'fan', 'summon'] } },
  sekhem: { slot: 'weapon', tier: 5, style: 'sun', col: '#ffcf4a', summon: 'mirage', n: 2,
    rot: { 1: ['sunfall', 'beams', 'slam', 'spiral'], 2: ['beams', 'sunfall', 'spiral', 'beams', 'slam', 'summon'] } },
  // Frostveil (their moves live in sim/frostai.js; only the loot fields are read here)
  morwen: { slot: 'armor', tier: 5, style: 'ice', col: '#e9d7ff' },
  vyrnhal: { slot: 'ring', tier: 5, style: 'ice', col: '#9fe8ff' },
  skaldra: { slot: 'weapon', tier: 5, style: 'ice', col: '#6fc8ff' },
  // Emberdeep (their moves live in sim/emberai.js)
  vitrea: { slot: 'armor', tier: 6, style: 'fire', col: '#7ff0e0' },
  solgrim: { slot: 'ring', tier: 6, style: 'fire', col: '#ffb02e' },
  pyrrhex: { slot: 'weapon', tier: 6, style: 'fire', col: '#ff4b1f' },
  // the Astral Rift (2026-10-15: each has its own moves, sim/worldboss.js voidweb / eclipse, alignment / starfall, riftblink / riftgrid; no invulnerable phases)
  nyxara: { slot: 'armor', tier: 7, style: 'dark', col: '#b06cff', summon: 'voidling', n: 3,
    rot: { 1: ['voidweb', 'fan', 'summon', 'eclipse'], 2: ['voidweb', 'eclipse', 'fan', 'summon', 'voidweb', 'ring'] } },
  orrery: { slot: 'ring', tier: 7, style: 'sun', col: '#ffe27a', summon: 'starwisp', n: 2,
    rot: { 1: ['alignment', 'spiral', 'starfall', 'beams'], 2: ['alignment', 'starfall', 'spiral', 'beams', 'alignment', 'summon'] } },
  zerath: { slot: 'weapon', tier: 7, style: 'dark', col: '#6ae6ff', summon: 'riftstalker', n: 3,
    rot: { 1: ['riftblink', 'fan', 'riftgrid', 'pounce', 'slam'], 2: ['riftblink', 'riftgrid', 'fan', 'riftblink', 'summon', 'pounce'] } },
};
