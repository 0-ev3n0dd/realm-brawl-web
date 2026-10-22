import { TIER_MAX, TIER_WORD, RARITIES, RARITY_WEIGHTS, SLOTS, BASE_NAMES, LEGENDARY_NAMES, PREFIX, AFFIXES, AFFIX_SWAP, DROP_SLOTS, GEAR, GEAR_VERSION, OFFHAND, RELIC_TYPES, subKOf } from './data/items.js';

/** hero level each gear tier unlocks at (crafting / ascending need it; drops follow it: player-level loot, 2026-10-15) */
export const TIER_LV = { 1: 1, 2: 3, 3: 4, 4: 8, 5: 12, 6: 28, 7: 38, 8: 46 };
/** the highest tier a level-L hero can use */
export function levelTier(L) { let t = 1; for (const k in TIER_LV) if ((L | 0) >= TIER_LV[k]) t = Math.max(t, +k); return Math.min(TIER_MAX, t); }
// Player-level loot (2026-10-15): drops roll at the LOOTER's hero level (each co-op player's own), not the zone / mob's.
// Drop code runs inside withLootLevel(p.level, fn); generateItem then uses levelTier(level) (+ a requested bump, e.g. the
// elite +1, capped at TIER_MAX), never below a set / Trial family's legal minimum (opts.minTier). Crafting is not wrapped.
let LOOT_LV = 0;
export const LV_CAP = 50;
/** the stat-scaling tier of a level-lv drop of tier t: t + how far lv is through the tier's level band (continuous: a
 *  Lv11 tier-4 piece is ~tier 4.75 strong; at the next tier's level it meets that tier's base). Tier 8 runs to Lv54. */
export function scaleTier(t, lv) {
  const a = TIER_LV[t] || 1, b = TIER_LV[t + 1] || (t >= TIER_MAX ? a + 8 : a + 1);
  return t + Math.max(0, Math.min(0.999, ((lv | 0) - a) / Math.max(1, b - a)));
}
/** item scaling tier (old items: their tier) */
export const tsOf = (it) => (it && Number.isFinite(+it.ts) && +it.ts >= (it.tier | 0 || 1) ? +it.ts : (it && (it.tier | 0)) || 1);
export function withLootLevel(lv, fn) { const was = LOOT_LV; LOOT_LV = Math.max(0, lv | 0); try { return fn(); } finally { LOOT_LV = was; } }
export const lootLevel = () => LOOT_LV;
export function rollRarity(rng, tier) {
  const w = RARITY_WEIGHTS[Math.max(1, Math.min(5, tier))];
  const total = w.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; }
  return 0;
}

function makeUid(rng) {
  return 'it' + Math.floor(rng.next() * 2 ** 32).toString(36) + Math.floor(rng.next() * 2 ** 32).toString(36);
}

/** a random drop slot type (weighted; never the Relic) */
export function rollSlot(rng) {
  const tot = DROP_SLOTS.reduce((a, x) => a + x[1], 0);
  let r = rng.next() * tot;
  for (const [s, w] of DROP_SLOTS) { r -= w; if (r < 0) return s; }
  return 'weapon';
}
const R3 = (v) => +v.toFixed(3);
/** the tier factor of a main stat (ascension rescales by the ratio) */
export function mainTierK(slot, k, t) {
  const M = GEAR.main[slot] || {};
  if (slot === 'relic') return 0.6 + 0.4 * t;
  const e = M[k];
  if (e && AFFIXES[k] && AFFIXES[k].fmt === 'int' && (e[0] || e[1])) return e[0] + e[1] * t;
  return 0.7 + 0.5 * t; // pct mains + the ring's primary
}
export const subTierK = (t) => 0.6 + 0.4 * t;
/** the item's main stat keys (old items without `mk`: by slot) */
export function mainKeys(it) {
  if (!it || !it.stats) return [];
  if (Array.isArray(it.mk)) return it.mk;
  if (it.slot === 'weapon') return ['atk'];
  if (it.slot === 'armor') return ['def', 'maxHp'].filter((k) => k in it.stats);
  const k0 = Object.keys(it.stats)[0];
  return k0 ? [k0] : [];
}
/** roll one sub-stat value (key = the AFFIXES entry) */
export function rollSub(rng, k, tier, rarity, kk = null, rec = null) {
  const a = AFFIXES[k];
  const u = rng.next(); if (rec) rec.u = u;
  const val = (a.min + (a.max - a.min) * u) * subTierK(tier) * (0.8 + 0.2 * Math.min(4, rarity)) * (kk ?? subKOf(k));
  return a.fmt === 'int' ? Math.max(1, Math.round(val)) : R3(Math.max(0.001, val));
}
/** the sub-stat pool for an item (pool keys; a class swap may turn one into its class stat) */
export const subPool = (mk, cls = null) => Object.keys(AFFIXES).filter((k) => !AFFIXES[k].cls && !mk.includes(AFFIXES[k].stat || k) && !(k === 'chainAll' && cls === 'warrior')); // (Warrior: its Resource Regen roll already IS Chain Damage)
/** add n random sub-stats to stats (deterministic for a given rng) */
export function addSubs(rng, stats, mk, n, tier, rarity, cls, qs = null) {
  const swap = AFFIX_SWAP[cls] || {}; // Warrior: Glory Gain / Chain Damage, Blade Dancer: Crit Damage / Crit Chance ... instead of Max Resource / Resource Regen
  const pool = subPool(mk, cls);
  for (let i = 0; i < n && pool.length; i++) {
    const k0 = pool.splice(Math.floor(rng.next() * pool.length), 1)[0], k = swap[k0] || k0, stat = AFFIXES[k].stat || k;
    const rec = {}, v2 = rollSub(rng, k, tier, rarity, k !== k0 ? subKOf(k0) * (AFFIXES[k].cls ? GEAR.clsK / GEAR.resK : 1) : null, rec);
    if (qs) qs[stat] = stat in qs ? +((qs[stat] + rec.u) / 2).toFixed(3) : +rec.u.toFixed(3); // (a swapped roll keeps the resource-stat scale: Blade Dancer's extra crit rolls)
    stats[stat] = stat in stats ? R3(stats[stat] + v2) : v2; // (a swapped affix can land on a stat the item already has: it stacks)
  }
}

/**
 * Generate an item. tier 1..5, cls = class id (weapons / off-hands are class-bound), slot optional (a weighted drop slot;
 * never a Relic unless asked), rarity optional. Gear expansion: a fixed main stat by slot (data/items.js GEAR.main) +
 * 2-4 random sub-stats by rarity.
 */
export function generateItem(rng, { tier = 1, cls = 'warrior', slot = null, rarity = null, bump = 0, minTier = 1 } = {}) {
  // player-level loot (item level pass, 2026-10-15): the tier is the looter's level tier - never above it (an elite's +1
  // used to push a Lv5 hero's drop to tier 4, whose floor is Lv8: now the bump only improves the rarity odds). Set /
  // Trial pieces keep their own minimum tier. Stats scale continuously with the exact level inside the tier (ts below).
  const L = LOOT_LV ? Math.max(1, Math.min(LV_CAP, LOOT_LV)) : 0;
  if (L) tier = Math.max(minTier, levelTier(L));
  tier = Math.max(1, Math.min(TIER_MAX, tier | 0 || 1));
  const lv = L || TIER_LV[tier] || 1, ts = scaleTier(tier, lv);
  slot = SLOTS.includes(slot) ? slot : rollSlot(rng);
  rarity = rarity == null ? rollRarity(rng, Math.min(5, tier + (L ? bump : 0))) : rarity;
  if (slot === 'relic' && rarity < 2) rarity = 2; // (relics: Epic at least)
  const R = RARITIES[rarity] || RARITIES[0];
  const qs = {}; let lastU = 0; const nx = () => (lastU = rng.next());
  const v = () => 0.85 + nx() * 0.3;
  const stats = {}, mk = [], M = GEAR.main[slot];
  if (M._pick) {
    const prim = M._pick[Math.floor(rng.next() * M._pick.length)];
    if (slot === 'relic') stats[prim] = R3(GEAR.relic[prim] * mainTierK('relic', prim, ts) / mainTierK('relic', prim, 5) * (R.mul / 2.3) * v());
    else {
      const a = AFFIXES[prim];
      const val = (a.min + (a.max - a.min) * nx()) * mainTierK(slot, prim, ts) * R.mul * M.share;
      stats[prim] = a.fmt === 'int' ? Math.max(1, Math.round(val * 1.5)) : R3(val);
    }
    mk.push(prim); qs[prim] = +lastU.toFixed(3);
  } else {
    for (const k in M) {
      const [a0, b0, sh] = M[k], A = AFFIXES[k];
      if (A.fmt === 'int') stats[k] = Math.max(1, Math.round((a0 + b0 * ts) * R.mul * v() * sh));
      else stats[k] = R3((A.min + (A.max - A.min) * nx()) * mainTierK(slot, k, ts) * R.mul * sh);
      mk.push(k); qs[k] = +lastU.toFixed(3);
    }
  }
  addSubs(rng, stats, mk, ((slot === 'relic' ? GEAR.relicSubs : GEAR.subs)[rarity] ?? 2), ts, rarity, cls, qs);
  let name;
  const nameTier = Math.min(4, tier - 1);
  if (slot === 'relic') {
    const nm = RELIC_TYPES[mk[0]].names;
    name = nm[Math.min(nm.length - 1, Math.floor((tier - 1) / 2) + (rarity >= 3 ? 1 : 0))];
  } else if (slot === 'offhand') {
    const O = OFFHAND[cls] || OFFHAND.warrior;
    name = R.id === 'legendary' ? `${['Heirloom', 'Elder'][Math.floor(rng.next() * 2)]} ${O.noun}` : PREFIX[R.id] + O.names[nameTier];
  } else if (R.id === 'legendary') {
    const pool2 = slot === 'weapon' ? LEGENDARY_NAMES.weapon[cls] : LEGENDARY_NAMES[slot];
    name = pool2[Math.floor(rng.next() * pool2.length)];
  } else {
    const base = slot === 'weapon' ? BASE_NAMES.weapon[cls][nameTier] : BASE_NAMES[slot][nameTier];
    name = (PREFIX[R.id] || '') + base;
  }
  if (TIER_WORD[tier] && slot !== 'relic') name = `${TIER_WORD[tier]} ${name}`; // (game loop C1: tiers 6-8)
  const item = { uid: makeUid(rng), slot, rarity, tier, name, stats, mk, v: GEAR_VERSION, lv, ts: +ts.toFixed(3), qs };
  if (slot === 'weapon' || slot === 'offhand') item.cls = cls;
  return item;
}

/** stat weights of the rough power score (UI arrows, Gear Power, the budget check in tools/gear-budget.mjs) */
export const POWER_W = { atk: 3, def: 2, maxHp: 0.25, maxRes: 0.3, crit: 250, critDmg: 90, spd: 300, hpRegen: 6, resRegen: 4, gloryGain: 220, chainDmg: 100, focusGain: 200, cutDmg: 120,
  atkPct: 330, spDmg: 60, ultCharge: 150, matFind: 40, goldFind: 30, chiGain: 200, ppDmg: 120, bloodGain: 200, impaleDmg: 120, inkGain: 200, summonDmg: 120, tempoGain: 200, songPower: 160 };
/** Rough power score used by the UI to show upgrade arrows. */
export function itemPower(item) {
  if (!item) return 0;
  const s = item.up ? upMain(item) : item.stats, w = POWER_W;
  let p = 0;
  for (const k in s) p += (w[k] || 1) * s[k];
  return Math.round(p);
}

/** Roll a loot bag for a kill. Returns an array of items (maybe empty). */
export function rollLoot(rng, { tier, cls, elite = false, boss = false, dropChance = 0.3, bossTier = 5, bossSlot = 'weapon' }) {
  const chance = boss ? 1 : elite ? Math.max(0.8, dropChance) : dropChance; // (game loop C3: a guaranteed-drop elite - dropChance 1, e.g. a mission champion - always drops)
  if (rng.next() >= chance) return [];
  const n = boss ? 4 : elite ? 2 : 1 + (rng.next() < 0.2 ? 1 : 0);
  const items = [];
  for (let i = 0; i < n; i++) {
    const up = !boss && elite && rng.next() < 0.4 ? 1 : 0, it = generateItem(rng, { tier: boss ? bossTier : tier + up, cls, bump: up });
    items.push(it);
  }
  if (boss && !items.some((i) => i.rarity === 3)) items[0] = generateItem(rng, { tier: bossTier, cls, rarity: 3, slot: bossSlot });
  return items;
}

// (+N upgrades: the same +7 % per level on the main stats as sim/meta.js upStats; inlined to keep loot.js import-free)
function upMain(it) { const o = {}, mk = mainKeys(it); for (const k in it.stats) { const v = it.stats[k]; o[k] = mk.includes(k) ? (Number.isInteger(v) ? Math.round(v * (1 + 0.07 * it.up)) : R3(v * (1 + 0.035 * it.up))) : v; } return o; }

// ------------------------------------------------------------------ Item Level (iLvl, 2026-10-15)
// iLvl = round(2 × Le + RB[rarity] + 20 × Q + up)
//   Le = the item's level: the hero level it dropped at (it.lv), or its tier's level when an ascension lifted it past that
//   RB = rarity bonus (Common 0, Rare 5, Epic 10, Legendary 15, Set 16, Trial 18, Extreme 22)
//   Q  = roll quality 0..1: each stat's place between the lowest and highest roll possible for this level / tier / rarity
//        (main stats count double); new drops record it per stat (it.qs), older items are estimated from their values
//   up = Forge upgrade levels
// So a Lv5 Rare with average rolls is iLvl 25, a Lv50 Legendary with perfect rolls 135.
export const ILVL_RB = [0, 5, 10, 15, 16, 0, 18, 22]; // (Common, Rare, Epic, Legendary, Set, Sigil, Trial, Extreme)
const genR = (it) => ((it.rarity | 0) >= 4 ? 3 : it.rarity | 0);
const clamp01 = (x) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.5);
/** [lo, hi] a stat could roll on this item (null if unknown) */
export function statRange(it, k) {
  const ts = tsOf(it), R = RARITIES[genR(it)] || RARITIES[0], M = GEAR.main[it.slot] || {}, mk = mainKeys(it);
  if (mk.includes(k)) {
    if (M._pick) {
      if (it.slot === 'relic') { const b = (GEAR.relic[k] || 0) * mainTierK('relic', k, ts) / mainTierK('relic', k, 5) * (R.mul / 2.3); return [b * 0.85, b * 1.15]; }
      const a = AFFIXES[k]; if (!a) return null; const m = mainTierK(it.slot, k, ts) * R.mul * M.share * (a.fmt === 'int' ? 1.5 : 1); return [a.min * m, a.max * m];
    }
    const e = M[k], A = AFFIXES[k]; if (!e || !A) return null; const [a0, b0, sh] = e;
    if (A.fmt === 'int') { const b = (a0 + b0 * ts) * R.mul * sh; return [b * 0.85, b * 1.15]; }
    const m = mainTierK(it.slot, k, ts) * R.mul * sh; return [A.min * m, A.max * m];
  }
  const key = AFFIXES[k] && !AFFIXES[k].stat ? k : Object.keys(AFFIXES).find((x) => AFFIXES[x].stat === k) || k, A = AFFIXES[key]; if (!A) return null;
  const m = subTierK(ts) * (0.8 + 0.2 * Math.min(4, genR(it))) * subKOf(key); return [A.min * m, A.max * m];
}
/** per-stat roll quality { stat: 0..1 } (recorded on new drops; estimated for older items) */
export function statQuality(it) {
  const out = {}; if (!it || !it.stats) return out;
  const up = 1 + 0.1 * (it.up | 0); // (Forge upgrades add on top of the roll: divide them out of the estimate)
  for (const k of Object.keys(it.stats)) {
    if (it.qs && Number.isFinite(+it.qs[k])) { out[k] = clamp01(+it.qs[k]); continue; }
    if ((it.rarity | 0) >= 4) { out[k] = 0.5; continue; } // (old set / Trial pieces: their family multiplier hides the roll)
    const r = statRange(it, k); if (!r || !(r[1] > r[0])) { out[k] = 0.5; continue; }
    out[k] = clamp01((it.stats[k] / up - r[0]) / (r[1] - r[0]));
  }
  return out;
}
/** overall roll quality 0..1 (main stats weigh double) */
export function itemQuality(it) {
  const q = statQuality(it), mk = mainKeys(it); let s = 0, w = 0;
  for (const [k, v] of Object.entries(q)) { const ww = mk.includes(k) ? 2 : 1; s += v * ww; w += ww; }
  return w ? s / w : 0.5;
}
/** the level an item counts at (drop level, or its tier's level after ascending) */
export const itemLv = (it) => Math.max((it && it.lv) | 0, TIER_LV[(it && it.tier) | 0 || 1] || 1);
/** Item Level */
export function itemLevel(it) {
  if (!it || !it.stats || it.slot === 'sigil') return 0;
  return Math.round(2 * itemLv(it) + (ILVL_RB[it.rarity | 0] || 0) + 20 * itemQuality(it) + (it.up | 0));
}
