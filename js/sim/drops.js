// Loot showers + the loot vacuum (horde pass 1). Pure sim code, server-authoritative (a predicting client sim never drops).
// Every kill bursts out a shower of small pickups for each eligible player (per-player, like the soulbound bags):
//   gold   coins: banked into the account profile by the owner's client on pickup (its gold multipliers apply there)
//   hp     health orbs: heal a slice of max HP
//   res    class-resource orbs ("ammo"): refill a slice of the class resource
//   gear   items: real soulbound bags (sim.bags, rarity beams client-side) that the vacuum carries into the inventory
//   mat    materials (phase 2 plugs biome materials in here: the entry type, rolling and pickup are wired already)
// A drop pops out on an arc, lands, and once its owner is within VACUUM.r it homes in (accelerating) and is collected.
// Events (private to the owner): 'drops' {pid, x, y, d: [[id, k, v, lx, ly, extra]]} and 'pick' {pid, d: [[id, k, v, extra]]}.
import { Rng } from './rng.js';
import { secs, DT } from './constants.js';
import { rollGold } from './meta.js';
import { stampGot } from './gear.js';
import { CLASSES } from './data/classes.js';

export const VACUUM = {
  r: 360,            // pull radius (px): everything of yours inside it flies to you
  land: secs(0.5),   // pop + arc time before a drop can be pulled
  v0: 240, accel: 2900, vmax: 1500, // homing speed (px/s), acceleration (px/s^2), cap
  pickR: 22,         // collected when within the hero's radius + this
  life: secs(60),    // an unclaimed drop (owner never came close) fades after a minute
  cap: 500,          // live drops cap (all players): the oldest are auto-collected past it
};
export const ORB = { hp: 0.05, res: 0.08, resEarned: 0.03 }; // health orb: 5% max HP; resource orb: 8% max (3% for the earned gauges)
const EARNED = ['rageRes', 'gloryRes', 'focusRes', 'chiRes', 'bloodRes', 'inkRes', 'tempoRes'];

/** Drop tables per kill class. An entry: { k, p: chance, n: [min, max] count, ...k-specific }.
 *  gold: g = share of a regular kill's gold (meta.rollGold) split over the coins; gear: rolled by loot.rollLoot (the enemy's
 *  dropChance; `p` multiplies it); mat: { id } or { pool: 'biome' } + n (phase 2). */
export const DROP_TABLES = {
  // horde pass 2: biome materials (pool: common / rare / trophy / any, see sim/meta.js MAT_POOLS) and less gold per fodder
  fodder: [{ k: 'gold', p: 0.4, n: [1, 1], g: 0.12 }, { k: 'mat', pool: 'common', p: 0.08 }, { k: 'hp', p: 0.045, n: [1, 1] }, { k: 'res', p: 0.07, n: [1, 1] }, { k: 'gear', p: 1 }],
  normal: [{ k: 'gold', p: 1, n: [2, 3], g: 1 }, { k: 'mat', pool: 'any', p: 0.35 }, { k: 'hp', p: 0.2, n: [1, 1] }, { k: 'res', p: 0.25, n: [1, 1] }, { k: 'gear', p: 1 }],
  elite:  [{ k: 'gold', p: 1, n: [6, 9], g: 1 }, { k: 'mat', pool: 'common', p: 1, n: [2, 3] }, { k: 'mat', pool: 'rare', p: 1, n: [1, 2] }, { k: 'mat', pool: 'trophy', p: 0.12 }, { k: 'hp', p: 1, n: [2, 3] }, { k: 'res', p: 1, n: [2, 3] }, { k: 'gear', p: 1 }],
  boss:   [{ k: 'gold', p: 1, n: [16, 22], g: 1 }, { k: 'mat', pool: 'trophy', p: 1, n: [3, 5] }, { k: 'mat', pool: 'any', p: 1, n: [6, 6] }, { k: 'hp', p: 1, n: [3, 4] }, { k: 'res', p: 1, n: [3, 4] }, { k: 'gear', p: 1 }],
};
/** fodder gear: a fodder kill rolls gear at this drop chance (regular mobs: their own dropChance, 0.32) */
export const FODDER_GEAR = 0.015;

export const tableFor = (e) => (e.boss ? 'boss' : e.elite ? 'elite' : e.horde ? 'fodder' : 'normal');
const rint = (rng, [a, b]) => a + Math.floor(rng.next() * (b - a + 1));

/**
 * Roll the non-gear part of a drop table: [{ k, v, id? }]. ctx = { zone (1..4 gold zone), elite, boss, biomeMats(rng) -> id }.
 * Gold coins split the kill's gold (at least 1 each). Pure (only rng).
 */
export function rollDropTable(rng, table, ctx = {}) {
  const T = typeof table === 'string' ? DROP_TABLES[table] : table, out = [];
  for (const en of T || []) {
    if (en.k === 'gear') continue; // (gear goes through loot.rollLoot: bags)
    if (ctx.noOrbs && (en.k === 'hp' || en.k === 'res')) continue; // (adds in a boss fight: no extra sustain)
    if (rng.next() >= (en.p ?? 1)) continue;
    const n = rint(rng, en.n || [1, 1]);
    if (en.k === 'gold') {
      const total = Math.max(1, Math.round(rollGold(() => rng.next(), { zone: ctx.zone || 1, elite: !!ctx.elite, boss: !!ctx.boss }) * (en.g ?? 1)));
      const c = Math.max(1, Math.min(n, total)), each = Math.floor(total / c);
      for (let i = 0; i < c; i++) out.push({ k: 'gold', v: i === c - 1 ? total - each * (c - 1) : each });
    } else if (en.k === 'mat') { // a fixed id, or one rolled from the kill's biome pool (each piece its own drop, like the coins)
      if (en.id) { out.push({ k: 'mat', v: n, id: en.id }); continue; }
      if (!ctx.biomeMats) continue;
      const got = {};
      for (let i = 0; i < n; i++) { const id = ctx.biomeMats(rng, en.pool || 'common'); if (id) got[id] = (got[id] | 0) + 1; }
      for (const [id, c] of Object.entries(got)) { if (c <= 4) for (let i = 0; i < c; i++) out.push({ k: 'mat', v: 1, id }); else out.push({ k: 'mat', v: c, id }); }
    } else for (let i = 0; i < n; i++) out.push({ k: en.k, v: 1 });
  }
  return out;
}

const dropRng = (sim) => sim._dropRng || (sim._dropRng = new Rng(((sim.seed | 0) ^ 0x5eed1) >>> 0)); // own stream: the gear rolls on sim.rng stay as they were

/**
 * A kill's shower for one player: the rolled pickups + the gear bag (already built by combat.killEnemy) burst out of (x, y).
 * Returns the created drops. bag: a sim bag (its items) or null.
 */
export function showerFor(sim, e, p, bag, ctx) {
  if (sim.predicting) return [];
  const rng = dropRng(sim), list = rollDropTable(rng, (ctx && ctx.table) || tableFor(e), ctx), made = [], d = [];
  const big = e.boss ? 150 : e.chest ? 120 : e.elite ? 95 : e.horde ? 46 : 64;
  const spot = (o) => { const a = rng.next() * Math.PI * 2, r = big * (0.35 + 0.65 * Math.sqrt(rng.next())); o.lx = Math.round(Math.cos(a) * r); o.ly = Math.round(Math.sin(a) * r * 0.75); };
  if (!sim.drops) sim.drops = [];
  for (const it of list) {
    const o = { id: sim.id(), k: it.k, v: it.v, mid: it.id, owner: p.id, x: e.x, y: e.y, t: 0, vel: 0, pull: false, lx: 0, ly: 0 };
    spot(o); o.x = e.x + o.lx; o.y = e.y + o.ly;
    sim.drops.push(o); made.push(o);
    d.push(o.mid ? [o.id, o.k, o.v, o.lx, o.ly, o.mid] : [o.id, o.k, o.v, o.lx, o.ly]);
  }
  if (bag) { // gear: the bag is the drop (it keeps working as a normal bag if the vacuum can't take it)
    const o = { lx: 0, ly: 0 }; spot(o);
    bag.ox = e.x; bag.oy = e.y; bag.x = e.x + o.lx; bag.y = e.y + o.ly; bag.vac = 1; bag.t = 0; bag.vel = 0;
    d.push([bag.id, 'gear', bag.rarity, o.lx, o.ly, bag.items.length]);
  }
  if (sim.drops.length > VACUUM.cap) { const over = sim.drops.splice(0, sim.drops.length - VACUUM.cap); for (const o of over) collect(sim, o, sim.players.get(o.owner)); }
  if (d.length) sim.emit({ type: 'drops', pid: p.id, x: Math.round(e.x), y: Math.round(e.y), d, big: e.boss ? 2 : e.elite ? 1 : 0 });
  return made;
}

/** class-resource gain of one resource orb */
export function resOrbAmount(p) {
  const c = CLASSES[p.cls] || {}, earned = EARNED.some((k) => c[k]);
  return (p.stats ? p.stats.maxRes : 100) * (earned ? ORB.resEarned : ORB.res);
}

const picked = new Map(); // pid -> [[id, k, v, extra]] for this tick
function collect(sim, o, p) {
  o.dead = true;
  if (!p) return;
  if (o.k === 'hp' && !p.dead) p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * ORB.hp * o.v);
  else if (o.k === 'res' && !p.dead) p.res = Math.min(p.stats.maxRes, p.res + resOrbAmount(p) * o.v);
  let l = picked.get(p.id); if (!l) picked.set(p.id, (l = []));
  l.push(o.mid ? [o.id, o.k, o.v, o.mid] : [o.id, o.k, o.v]);
}
/** gear: the vacuum carries the bag into the inventory. Returns false (bag stays put) when the inventory is full. */
function collectBag(sim, b, p) {
  const inv = p.inventory, taken = [];
  for (let i = 0; i < b.items.length; i++) { const free = inv.indexOf(null); if (free < 0) break; inv[free] = stampGot(p, b.items[i]); taken.push(b.items[i]); b.items[i] = null; }
  b.items = b.items.filter(Boolean);
  if (!taken.length) return false;
  if (!b.items.length) b.dead = true;
  p.dirty = true;
  sim.emit({ type: 'pickup', pid: p.id, items: taken.map((t) => ({ name: t.name, rarity: t.rarity, uid: t.uid })), auto: 1 });
  let l = picked.get(p.id); if (!l) picked.set(p.id, (l = []));
  for (const t of taken) l.push([b.id, 'gear', t.rarity, t.name]);
  return true;
}

/** home `o` toward p: true when it arrived */
function home(o, p, dt) {
  o.vel = Math.min(VACUUM.vmax, (o.vel || VACUUM.v0) + VACUUM.accel * dt);
  const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy), step = o.vel * dt;
  if (d <= step + p.r + VACUUM.pickR) return true;
  o.x += (dx / d) * step; o.y += (dy / d) * step;
  return false;
}

/** loop playtest fix (2026-10-15): leaving an area (a mission / dungeon / trial ends, a map change, Return to Town) banks
 *  the coins, materials and vacuum gear bags you had not walked over yet: a boss's Rift Core / trophy can no longer be lost
 *  by taking the exit straight after the kill. (Health / resource orbs just fade: they are for the fight.) */
export function collectLeftovers(sim) {
  if (sim.predicting) return;
  if (sim.drops && sim.drops.length) {
    for (const o of sim.drops) { if (o.dead || o.k === 'hp' || o.k === 'res') continue; const p = sim.players.get(o.owner); if (p) collect(sim, o, p); }
    sim.drops = sim.drops.filter((o) => !o.dead && o.k !== 'hp' && o.k !== 'res');
  }
  for (const b of sim.bags) { if (!b.vac || b.dead) continue; const p = sim.players.get(b.ownerId); if (p && p.inventory.indexOf(null) >= 0) collectBag(sim, b, p); }
  if (picked.size) {
    for (const [pid, d] of picked) { const p = sim.players.get(pid); sim.emit({ type: 'pick', pid, d, x: p ? Math.round(p.x) : 0, y: p ? Math.round(p.y) : 0 }); }
    picked.clear();
  }
}

/** per tick: age, pull and collect drops + vacuum bags. */
export function updateDrops(sim) {
  if (sim.predicting) return;
  const R2 = VACUUM.r * VACUUM.r;
  const D = sim.drops;
  if (D && D.length) {
    let any = false;
    for (const o of D) {
      if (o.dead) { any = true; continue; }
      o.t++;
      const p = sim.players.get(o.owner);
      if (!p) { if (o.t > VACUUM.life) { o.dead = true; any = true; } continue; }
      if (!o.pull) {
        if (o.t < VACUUM.land) continue;
        if (!p.dead && (p.x - o.x) ** 2 + (p.y - o.y) ** 2 < R2) o.pull = true;
        else { if (o.t > VACUUM.life) { o.dead = true; any = true; } continue; }
      }
      if (p.dead) { o.pull = false; o.vel = 0; continue; }
      if (home(o, p, DT)) { collect(sim, o, p); any = true; }
    }
    if (any) sim.drops = D.filter((o) => !o.dead);
  }
  for (const b of sim.bags) {
    if (!b.vac || b.dead) continue;
    b.t = (b.t || 0) + 1;
    if (b.t < VACUUM.land) continue;
    const p = sim.players.get(b.ownerId);
    if (!p || p.dead || p.inventory.indexOf(null) < 0) { b.vel = 0; continue; } // (full bag: it waits on the ground as a normal loot bag)
    if (!b.pulling && (p.x - b.x) ** 2 + (p.y - b.y) ** 2 >= R2) continue;
    b.pulling = true;
    if (home(b, p, DT)) collectBag(sim, b, p);
  }
  if (picked.size) {
    for (const [pid, d] of picked) { const p = sim.players.get(pid); sim.emit({ type: 'pick', pid, d, x: p ? Math.round(p.x) : 0, y: p ? Math.round(p.y) : 0 }); }
    picked.clear();
  }
}
