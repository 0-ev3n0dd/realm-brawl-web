// Gear expansion (step 3): the 10-slot equipment helpers + save migration. Pure (no DOM), used by the sim, the save code,
// the server validator and the UI.
//   EQUIP_SLOTS: weapon, offhand, helm, armor (= the Chest), gloves, boots, ring, ring2, amulet, relic.
//   Migration (gear version 1 -> 2): old 3-slot items were budgeted for 3 slots. Their main stats are re-split by the slot's
//   new share and their old affixes become sub-stats at the new per-roll scale; items below the new sub-stat count get the
//   missing sub-stats rolled (deterministically from the item's uid). A hero migrated from the 3-slot era also gets a plain
//   Common piece (at its best tier) in each empty new slot, so its total gear power stays about where it was. Nothing is
//   removed: every item, +level, ascension, set and Trial / Extreme tag stays.
import { SLOTS, EQUIP_SLOTS, GEAR, GEAR_VERSION, AFFIXES, fitsSlot, slotType, subKOf } from './data/items.js';
import { mainKeys, addSubs, generateItem, itemPower } from './loot.js';
import { Rng } from './rng.js';

export { EQUIP_SLOTS, fitsSlot, slotType };
const R3 = (v) => +v.toFixed(3);
/** a stable 32-bit seed from a string (an item's uid) */
export function seedOf(str) { let h = 2166136261; for (const c of String(str || 'x')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export const isGearItem = (it) => !!(it && typeof it === 'object' && SLOTS.includes(it.slot) && it.stats && typeof it.stats === 'object');
/** the old (gear v1) main-stat share each slot keeps */
const OLD_SHARE = { weapon: { atk: GEAR.main.weapon.atk[2] }, armor: { def: GEAR.main.armor.def[2], maxHp: GEAR.main.armor.maxHp[2] }, ring: GEAR.main.ring.share };

const LEGACY_CLS = new Set(['rageGain', 'rageDmg', 'swapDmg']);
/** one item from gear v1 to v2 (a new object; v2 items come back as they are) */
export function migrateItem(it) {
  if (!isGearItem(it) || it.v === GEAR_VERSION) return it;
  const out = { ...it, stats: { ...it.stats } }, mk = mainKeys(it), s = out.stats;
  for (const k of Object.keys(s)) {
    const v = +s[k]; if (!Number.isFinite(v)) { delete s[k]; continue; }
    const isInt = AFFIXES[k] ? AFFIXES[k].fmt === 'int' : Number.isInteger(v);
    let f;
    if (mk.includes(k)) { const sh = OLD_SHARE[it.slot]; f = typeof sh === 'number' ? sh : (sh && sh[k]) || 1; }
    else f = subKOf(LEGACY_CLS.has(k) ? 'chainDmg' : k); // (old Rage / Swap Strike rolls are class stats too)
    s[k] = isInt ? Math.max(1, Math.round(v * f)) : R3(Math.max(0.001, v * f));
  }
  const want = (it.slot === 'relic' ? GEAR.relicSubs : GEAR.subs)[it.rarity | 0] ?? 2, have = Object.keys(s).filter((k) => !mk.includes(k)).length;
  if (have < want) addSubs(new Rng(seedOf(it.uid)), s, mk, want - have, it.tier | 0 || 1, Math.min(3, it.rarity | 0), it.cls || null);
  out.mk = mk.slice(); out.v = GEAR_VERSION;
  return out;
}
/** a full 10-key equipment object (missing keys null, items migrated, misplaced items dropped back to `spill`) */
export function normEquipment(eq, spill = null) {
  const out = {};
  for (const k of EQUIP_SLOTS) out[k] = null;
  for (const [k, it0] of Object.entries(eq || {})) {
    if (!it0) continue;
    const it = migrateItem(it0);
    if (EQUIP_SLOTS.includes(k) && isGearItem(it) && fitsSlot(it.slot, k) && !out[k]) out[k] = it;
    else if (spill && it && typeof it === 'object') spill.push(it); // (never lose an item: it goes to the bag)
  }
  return out;
}
/** a hero from the 3-slot era: a Common piece at its best tier in each empty new slot (deterministic from the hero id) */
export function fillNewSlots(eq, cls, id) {
  const tier = Math.max(1, ...EQUIP_SLOTS.map((k) => (eq[k] ? eq[k].tier | 0 : 1)));
  const rng = new Rng(seedOf('fill:' + id));
  for (const k of ['offhand', 'helm', 'gloves', 'boots', 'ring2', 'amulet']) {
    if (eq[k]) continue;
    const it = generateItem(rng, { tier, cls, slot: slotType(k), rarity: 1 }); // (Rare: keeps a migrated hero at about its old power)
    it.uid = 'mg' + seedOf(id + k).toString(36) + k; it.gift = 1;
    eq[k] = it;
  }
  return eq;
}
/** where equipping `it` goes: its slot, or for a ring the empty ring slot (else the weaker ring) */
export function equipTarget(p, it) {
  if (!it || !SLOTS.includes(it.slot)) return null;
  if (it.slot !== 'ring') return it.slot;
  const q = p.equipment || {};
  if (!q.ring) return 'ring';
  if (!q.ring2) return 'ring2';
  return itemPower(q.ring2) < itemPower(q.ring) ? 'ring2' : 'ring';
}
/** the equipped item an item is compared with (rings: the one equipping would replace) */
export const compareTarget = (p, it) => { const k = equipTarget(p, it); return k ? (p.equipment || {})[k] || null : null; };
/** total gear power of an equipment object */
export const gearPower = (eq) => EQUIP_SLOTS.reduce((a, k) => a + (eq && eq[k] ? itemPower(eq[k]) : 0), 0);

/** step 4: the bag's "newest" order - every item that lands in the bag gets the next pickup number (it.got) */
export function stampGot(p, it) {
  if (!it || typeof it !== 'object') return it;
  let m = 0; for (const k in p.equipment) { const q = p.equipment[k]; if (q && q.got > m) m = q.got; } for (const q of p.inventory) if (q && q.got > m) m = q.got;
  it.got = m + 1; return it;
}
