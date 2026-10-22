// Training Dummy settings (2026-10-20): the village Training Grounds dummies, configured from the Training Dummy menu
// (client/dummyui.js; at the dummy with the Interact key, or Options). Host / solo owns the config (`dummyCfg` command).
//   hp: 'inf' (never dies, resets after 3 s idle) or a number (dies -> back at full, a new parse)
//   level: the level shown on the tag (enemy damage taken has no level gap in this game: display only)
//   dr: damage reduction 0-0.75 (armor)        boss: the dummies count as bosses (boss form, vs-boss bonuses, boss bar)
//   count 1-6, layout line / ring / pack       move: still / strafe (side to side) / circle (orbits its spot)
//   attack: telegraphed circles on the player (tellEvery s, tell >= 1 s, dmgPct % max HP; dodgeable) to test rotations under mechanics
//   meter: DPS meter parse window (0 = auto: a 4 s gap starts a new parse; else a fixed 10 / 30 / 60 / 120 s parse)
//   numbers: damage numbers on / off (client only)
import { DUMMY_POS } from './village.js';
import { addArea } from './combat.js';

export const DUMMY_DEF = { hp: 'inf', level: 30, dr: 0, boss: false, count: 1, layout: 'line', move: 'still', attack: false, tellEvery: 3, dmgPct: 5, meter: 0, numbers: true };
export const DUMMY_OPTS = {
  hp: ['inf', 100000, 1000000, 10000000, 50000000], level: [1, 10, 20, 30, 40, 50], dr: [0, 0.1, 0.25, 0.5, 0.75],
  count: [1, 2, 3, 4, 5, 6], layout: ['line', 'ring', 'pack'], move: ['still', 'strafe', 'circle'], tellEvery: [1.5, 2, 3, 5], dmgPct: [0, 2, 5, 10, 20], meter: [0, 10, 30, 60, 120],
};
const pickOf = (k, v) => (DUMMY_OPTS[k].includes(v) ? v : DUMMY_DEF[k]);
export function normDummy(c = {}) {
  const o = {}; for (const k of Object.keys(DUMMY_OPTS)) o[k] = pickOf(k, c[k]);
  o.boss = !!c.boss; o.attack = !!c.attack; o.numbers = c.numbers !== false;
  return o;
}
export const dummyKey = (c) => [c.hp, c.level, c.dr, c.boss, c.count, c.layout].join('|'); // (a change here respawns the dummies)
/** home spots of `n` dummies around the Training Grounds spot */
export function dummySpots(c) {
  const n = c.count, out = [];
  for (let i = 0; i < n; i++) {
    if (n === 1) out.push({ x: DUMMY_POS.x, y: DUMMY_POS.y });
    else if (c.layout === 'ring') { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; out.push({ x: DUMMY_POS.x + Math.cos(a) * 150, y: DUMMY_POS.y + Math.sin(a) * 110 }); }
    else if (c.layout === 'pack') { const a = i * 2.4, r = 26 + 22 * Math.sqrt(i); out.push({ x: DUMMY_POS.x + Math.cos(a) * r * (i ? 1 : 0), y: DUMMY_POS.y + Math.sin(a) * r * (i ? 1 : 0) }); }
    else out.push({ x: DUMMY_POS.x + (i - (n - 1) / 2) * 110, y: DUMMY_POS.y });
  }
  return out;
}
/** stamp a spawned dummy with the config */
export function applyDummy(e, c, home) {
  e.dummy = 1; e.cd = 1e9; e.dropChance = 0; e.xp = 0;
  const hp = c.hp === 'inf' ? 1e9 : c.hp; e.hp = e.maxHp = e.lastHp = hp; e.infHp = c.hp === 'inf';
  e.mlv = c.level; e.dr = c.dr; e.boss = !!c.boss; if (c.boss) e.name = 'Training Dummy (boss)';
  e.homeX = e.baseX = home.x; e.homeY = e.baseY = home.y; e.x = home.x; e.y = home.y;
}
/** per tick (updateEnemy): movement and the telegraphed attacks */
export function tickDummy(sim, e) {
  const c = sim.dummyCfg || DUMMY_DEF, t = sim.tick + (e.id % 7) * 40;
  if (c.move === 'strafe') { e.homeX = e.baseX + Math.sin(t / 60) * 140; e.homeY = e.baseY; }
  else if (c.move === 'circle') { e.homeX = e.baseX + Math.cos(t / 70) * 120; e.homeY = e.baseY + Math.sin(t / 70) * 80; }
  else { e.homeX = e.baseX ?? e.homeX; e.homeY = e.baseY ?? e.homeY; }
  if (!c.attack || sim.predicting) return;
  const every = Math.round(c.tellEvery * 60);
  if ((sim.tick + e.id * 13) % every !== 0) return;
  let best = null, bd = 900; // the nearest player within 900 px
  for (const p of sim.players.values()) { if (p.dead) continue; const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < bd) { bd = d; best = p; } }
  if (!best) return;
  const pct = c.dmgPct / 100;
  addArea(sim, { team: 'enemy', ownerId: e.id, by: e.name, shape: 'circle', x: best.x, y: best.y, r: 110, delay: 66, dmg: Math.round(best.stats.maxHp * pct), kb: 0, color: '#ff5e5b' }); // (tell 1.1 s >= the 1 s encounter rule)
}
