// Part A4 — Astral Fissures (docs/ASCENSION-PLAN.md): invasions of WEAKER Astral mobs on the normal maps, so heroes meet the
// Astral side during progression. Per map (Wilds / Dunes / Frostveil / Emberdeep / Rift), at most one open fissure, only
// while a hero is on that map; never in town, dungeons, Trials, mission arenas or a world-boss arena.
//   cadence : the first ~90 s after a hero reaches a map, then every ~2.5 min after the last one closed / faded
//   engage  : a hero within FIS.engage px starts wave 1; 3 waves (3 / 4 / 5 mobs + party), then the CORE appears
//   core    : an ordinary enemy (fissurecore: no AI, takes full damage: never invulnerable); breaking it pays every hero
//             in range Astral Dust (2 + map step) and counts for the Weekly Board ("close 3 fissures")
//   weaker  : Astral mobs at the map's level curve x FIS.hp HP, x FIS.dmg damage
//   affixes : introduced gradually: elites (each with an A3 affix) on the last wave: Wilds 0, Dunes 1, Frostveil 1,
//             Emberdeep 2, Rift 2
//   fade    : untouched for FIS.life, or abandoned (no hero within 1400 px) for FIS.abandon: closes with no reward
import { spawnEnemy } from './ai.js';
import { siteZone, bossZones } from './sitegen.js';
import { pointBlocked } from './world.js';
import { inHollowArea } from './glowconst.js';
import { inOpsArea } from './opsconst.js';

const secs = (s) => Math.round(s * 60);
export const FIS = {
  first: secs(90), every: secs(150), life: secs(180), abandon: secs(30), engage: 420, near: 1400, reward: 1100,
  waves: [3, 4, 5], hp: 0.6, dmg: 0.7, gap: secs(2.5),
  pool: ['voidling', 'riftstalker', 'starwisp', 'voidarcher'],
  elites: { wilds: 0, dunes: 1, frost: 1, ember: 2, rift: 2 },
  step: { wilds: 0, dunes: 1, frost: 2, ember: 3, rift: 4 },
  coreHp: 6, // x one weakened mob's HP
};
export const FIS_MAPS = ['wilds', 'dunes', 'frost', 'ember', 'rift'];
export const mapOf = (x, y) => { const z = siteZone(x, y); if (!z || inHollowArea(x, y) || inOpsArea(x, y)) return null; return z.key[0] === 'w' && z.key.length === 2 ? 'wilds' : z.key; };
const H = (n) => { let x = (n | 0) * 2654435761 + 0x632be5; x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; return (x >>> 0) / 4294967296; };

export function createFissures(sim) { sim.fis = { maps: {}, list: [], n: 0 }; }
/** is (x, y) a legal fissure spot on map m? */
export function fissureSpotOk(sim, m, x, y) {
  if (mapOf(x, y) !== m) return false;
  if (sim.world && pointBlocked(sim.world, x, y, 60)) return false;
  for (const b of bossZones(sim.spawners || [])) if (Math.hypot(x - b.x, y - b.y) < b.r) return false;
  return true;
}
export function updateFissures(sim) {
  if (!sim.fis || sim.predicting) return;
  const F = sim.fis, ps = [...sim.players.values()].filter((p) => !p.dead);
  const here = {}; for (const p of ps) { const m = mapOf(p.x, p.y); if (m) (here[m] = here[m] || []).push(p); }
  for (const m of FIS_MAPS) {
    const S = F.maps[m] || (F.maps[m] = { next: FIS.first });
    if (F.list.some((f) => f.map === m)) continue;
    if (!here[m]) continue; // (the clock only runs while a hero is on the map)
    if (--S.next > 0) continue;
    const p = here[m][Math.floor(H(sim.tick + m.length) * here[m].length)];
    let spot = null;
    for (let i = 0; i < 12 && !spot; i++) { const a = H(sim.tick * 7 + i) * Math.PI * 2, d = 700 + H(sim.tick * 13 + i) * 400, x = Math.round(p.x + Math.cos(a) * d), y = Math.round(p.y + Math.sin(a) * d); if (fissureSpotOk(sim, m, x, y)) spot = { x, y }; }
    if (!spot) { S.next = secs(10); continue; }
    const f = { id: ++F.n, map: m, x: spot.x, y: spot.y, st: 'open', t: 0, wave: 0, nw: FIS.waves.length, mobs: [], core: 0, gap: 0, lone: 0 };
    F.list.push(f); S.next = FIS.every;
    sim.emit({ type: 'fissure', ph: 'spawn', id: f.id, map: m, x: f.x, y: f.y });
  }
  for (const f of F.list) tickFissure(sim, f, ps);
  F.list = F.list.filter((f) => f.st !== 'gone');
}
function spawnWave(sim, f, ps) {
  const nearN = ps.filter((p) => Math.hypot(p.x - f.x, p.y - f.y) < FIS.near).length;
  const n = FIS.waves[f.wave - 1] + Math.max(0, nearN - 1), last = f.wave === f.nw, el = last ? FIS.elites[f.map] || 0 : 0;
  f.mobs = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + f.wave, x = f.x + Math.cos(a) * 110, y = f.y + Math.sin(a) * 110;
    const e = spawnEnemy(sim, FIS.pool[(i + f.wave) % FIS.pool.length], x, y, { elite: i < el });
    weaken(e); e.fis = f.id; e.homeX = f.x; e.homeY = f.y; e.huntR = 900; e.dropChance = Math.min(e.dropChance, 0.2);
    if (f.map !== 'rift') e.rz = 0; // (no Rift-map hooks off the Rift)
    const t = ps[i % Math.max(1, ps.length)]; if (t) e.aggroId = t.id;
    f.mobs.push(e.id);
  }
  sim.emit({ type: 'fissure', ph: 'wave', id: f.id, map: f.map, wave: f.wave, nw: f.nw, n, el, x: f.x, y: f.y });
}
function weaken(e) {
  e.maxHp = e.hp = Math.max(1, Math.round(e.maxHp * FIS.hp)); e.baseMaxHp = Math.round((e.baseMaxHp || e.maxHp) * FIS.hp);
  e.dmg *= FIS.dmg; if (e.baseDmg) e.baseDmg *= FIS.dmg; e.name = 'Astral ' + e.name.replace(/^Astral /, '');
}
function closeF(sim, f, ph) {
  for (const id of f.mobs.concat(f.core ? [f.core] : [])) { const e = sim.enemyById.get(id); if (e && !e.dead) { e.dead = true; e.hp = 0; } }
  f.st = 'gone'; sim.emit({ type: 'fissure', ph, id: f.id, map: f.map, x: f.x, y: f.y });
}
function tickFissure(sim, f, ps) {
  f.t++;
  const near = ps.filter((p) => Math.hypot(p.x - f.x, p.y - f.y) < FIS.near);
  if (f.st === 'open') {
    if (ps.some((p) => Math.hypot(p.x - f.x, p.y - f.y) < FIS.engage)) { f.st = 'waves'; f.wave = 1; spawnWave(sim, f, ps); }
    else if (f.t > FIS.life) closeF(sim, f, 'fade');
    return;
  }
  if (!near.length) { if (++f.lone > FIS.abandon) closeF(sim, f, 'fade'); return; } else f.lone = 0;
  if (f.st === 'waves') {
    if (f.gap > 0) { if (--f.gap === 0) { f.wave++; spawnWave(sim, f, ps); } return; }
    const alive = f.mobs.some((id) => { const e = sim.enemyById.get(id); return e && !e.dead; });
    if (alive) return;
    if (f.wave < f.nw) { f.gap = FIS.gap; return; }
    f.st = 'core';
    const c = spawnEnemy(sim, 'fissurecore', f.x, f.y, { zoneHp: false });
    const one = spawnProbeHp(sim, f); c.maxHp = c.hp = c.baseMaxHp = Math.round(one * FIS.coreHp * Math.max(1, near.length) ** 0.8);
    c.fis = f.id; c.dropChance = 0; c.xp = Math.round(c.xp * (1 + FIS.step[f.map] * 0.5)); f.core = c.id;
    sim.emit({ type: 'fissure', ph: 'core', id: f.id, map: f.map, x: f.x, y: f.y });
    return;
  }
  if (f.st === 'core') {
    const c = sim.enemyById.get(f.core);
    if (c && !c.dead) return;
    const n = 2 + (FIS.step[f.map] || 0), pids = ps.filter((p) => Math.hypot(p.x - f.x, p.y - f.y) < FIS.reward).map((p) => p.id);
    f.st = 'gone';
    sim.emit({ type: 'fissure', ph: 'closed', id: f.id, map: f.map, x: f.x, y: f.y, pids, mat: 'astral_dust', n });
  }
}
/** one weakened Astral mob's HP at this spot (sizes the core) */
function spawnProbeHp(sim, f) {
  const e = spawnEnemy(sim, FIS.pool[0], f.x, f.y, {}); const hp = Math.round(e.maxHp * FIS.hp);
  e.dead = true; e.hp = 0; sim.enemies.splice(sim.enemies.indexOf(e), 1); sim.enemyById.delete(e.id); return hp;
}
/** compact copy for co-op snapshots / the renderer */
export function packFissures(sim) { return sim.fis ? sim.fis.list.map((f) => ({ id: f.id, map: f.map, x: f.x, y: f.y, st: f.st, wave: f.wave, nw: f.nw, t: f.t })) : []; }
/** dev / test hook: open a fissure right here */
export function devFissure(sim, p, m = {}) {
  if (!sim.fis) createFissures(sim);
  const map = mapOf(p.x, p.y) || 'wilds', x = Math.round(m.x ?? p.x + 500), y = Math.round(m.y ?? p.y);
  const f = { id: ++sim.fis.n, map, x, y, st: 'open', t: 0, wave: 0, nw: FIS.waves.length, mobs: [], core: 0, gap: 0, lone: 0 };
  sim.fis.list.push(f); sim.emit({ type: 'fissure', ph: 'spawn', id: f.id, map, x, y }); return f;
}
