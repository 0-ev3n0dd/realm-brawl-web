// Save/load for characters. Pure functions + a store over any Storage-like object
// ({getItem,setItem,removeItem}) so tests can inject an in-memory store and a future
// server can swap in a database.
import { normPerks, masteryOf } from './mastery.js';
import { CLASSES, classId } from './data/classes.js';
import { MAX_LEVEL } from './progression.js';
import { BASE_NAMES, GEAR_VERSION } from './data/items.js';
import { normEquipment, migrateItem, fillNewSlots } from './gear.js';
import { normLoadouts, normLoIndex, normChainSet } from './loadout.js';
import { BAG_MAX, clampBag } from './bagsize.js';

export const SAVE_VERSION = 3;
export const SAVE_KEY = 'realmbrawl.save';

export function serializeCharacter(p) {
  return {
    id: p.charId || p.id,
    name: p.name,
    cls: p.cls,
    appearance: { ...p.appearance },
    level: p.level,
    xp: Math.floor(p.xp),
    equipment: JSON.parse(JSON.stringify(p.equipment)),
    inventory: JSON.parse(JSON.stringify(p.inventory)),
    bagSize: p.inventory.length, // (inventory pass: 64+ slots, sim/bagsize.js)
    kills: p.kills || 0,
    deaths: p.deaths || 0,
    mxp: Math.round((+p.mxp || 0) * 10) / 10, mperks: { ...(p.mperks || {}) }, // game loop B1: Mastery XP + perk picks
    loadouts: normLoadouts(p.loadouts, p.cls), lo: normLoIndex(p.lo), chainSet: normChainSet(p.chainSet, p.cls), // step 4 (sim/loadout.js)
    gv: GEAR_VERSION,
    updatedAt: Date.now(),
  };
}

export function sanitizeChar(c) {
  if (c && typeof c === 'object' && classId(c.cls) !== c.cls) c = { ...c, cls: classId(c.cls) }; // (renamed classes: 'ninja' / 'paladin' -> their ids)
  if (!c || typeof c !== 'object' || !CLASSES[c.cls]) return null;
  // gear expansion: 10 equipment slots; v1 items migrate (sim/gear.js); a 3-slot-era hero gets the empty new slots filled
  const spill = [], oldEra = c.gv !== GEAR_VERSION && Object.values(c.equipment || {}).some((it) => it && typeof it === 'object' && it.stats && it.v !== GEAR_VERSION);
  const id = String(c.id || 'c' + Math.random().toString(36).slice(2));
  const equipment = normEquipment(Object.fromEntries(Object.entries(c.equipment || {}).map(([k, it]) => [k, normItem(it)])), spill);
  if (oldEra) fillNewSlots(equipment, c.cls, id);
  const inv = (Array.isArray(c.inventory) ? c.inventory.slice(0, BAG_MAX) : []).map((it) => migrateItem(normItem(it)));
  // inventory pass: every hero has at least 64 slots (older saves had 12); a bag never shrinks over items
  const size = Math.max(clampBag(c.bagSize), inv.length); while (inv.length < size) inv.push(null);
  for (const it of spill) { const i = inv.indexOf(null); if (i >= 0) inv[i] = it; else if (inv.length < BAG_MAX) inv.push(it); }
  return {
    id,
    name: String(c.name || 'Hero').slice(0, 16),
    cls: c.cls,
    appearance: { skin: 0, hairStyle: 0, hairColor: 0, outfit: 0, ...(c.appearance || {}) },
    level: Math.max(1, Math.min(MAX_LEVEL, c.level | 0 || 1)),
    xp: Math.max(0, +c.xp || 0),
    equipment,
    inventory: inv,
    bagSize: inv.length,
    kills: c.kills | 0,
    deaths: c.deaths | 0,
    mxp: Math.max(0, Math.min(1e9, +c.mxp || 0)), mperks: normPerks(c.mperks, masteryOf({ kills: c.kills, mxp: c.mxp }).rank),
    loadouts: normLoadouts(c.loadouts, c.cls), lo: normLoIndex(c.lo), chainSet: normChainSet(c.chainSet, c.cls), // step 4: presets (older saves: 7 empty)
    gv: GEAR_VERSION,
    updatedAt: c.updatedAt || 0,
  };
}

/** item.up clamped to 0..10 (dropped when 0) */
function normItem(it) {
  if (!it || typeof it !== 'object') return it || null;
  if (it.up == null) return it;
  const up = Math.max(0, Math.min(10, it.up | 0)), o = { ...it };
  if (up) o.up = up; else delete o.up;
  return o;
}
/** Upgrade older save formats to SAVE_VERSION. */
export function migrate(data) {
  if (!data || typeof data !== 'object') return { version: SAVE_VERSION, characters: [] };
  let d = { ...data };
  if (!d.version) {
    // v0 (unversioned prototype): a single character object at the root
    d = { version: 1, characters: d.cls ? [d] : Array.isArray(d.characters) ? d.characters : [] };
  }
  if (d.version === 1) {
    // v1 -> v2: 'gear' renamed to 'equipment', stats counters added
    d = { version: 2, characters: (d.characters || []).map((c) => ({ ...c, equipment: c.equipment || c.gear || {}, kills: c.kills || 0, deaths: c.deaths || 0 })) };
  }
  if (d.version === 2) {
    // v2 -> v3 (experience pass 2): items may carry a Forge upgrade level `up` (0..10); older items simply have none.
    // The account (gold, materials, bounties, records) lives in its own key (sim/meta.js PROFILE_KEY).
    d = { ...d, version: 3 };
  }
  if (d.version > SAVE_VERSION) throw new Error(`Save version ${d.version} is newer than supported ${SAVE_VERSION}`);
  d.characters = (d.characters || []).map(sanitizeChar).filter(Boolean);
  if (d.heroes) { // the Heroes roster (sim/heroes.js): one hero per class + ONE shared bag at the root
    const bag = sanitizeChar({ cls: 'warrior', inventory: Array.isArray(d.bag) ? d.bag : [], bagSize: d.bagSize });
    d.bag = bag.inventory; d.bagSize = bag.bagSize;
    if (!Array.isArray(d.archive)) d.archive = [];
  }
  return d;
}
/** roster save: a character read out of the store carries the shared bag */
const withBag = (d, c) => (d.heroes && c ? { ...c, inventory: d.bag.slice(), bagSize: d.bag.length } : c);

export function createSaveStore(storage, key = SAVE_KEY) {
  const read = () => {
    const raw = storage.getItem(key);
    if (!raw) return { version: SAVE_VERSION, characters: [] };
    try { return migrate(JSON.parse(raw)); } catch (e) { return { version: SAVE_VERSION, characters: [], error: String(e) }; }
  };
  const write = (d) => storage.setItem(key, JSON.stringify(d.heroes
    ? { version: SAVE_VERSION, heroes: 1, characters: d.characters.map((c) => ({ ...c, inventory: [] })), bag: d.bag, bagSize: d.bagSize, archive: d.archive || [] }
    : { version: SAVE_VERSION, characters: d.characters }));
  return {
    load: read,
    list: () => { const d = read(); return d.characters.map((c) => withBag(d, c)); },
    get: (id) => { const d = read(); return withBag(d, d.characters.find((c) => c.id === id) || null); },
    upsert(char) {
      const d = read();
      const i = d.characters.findIndex((c) => c.id === char.id);
      if (d.heroes) { // the bag is shared: whatever hero saves, its bag IS the bag
        if (Array.isArray(char.inventory)) { d.bag = char.inventory.slice(0, BAG_MAX); d.bagSize = Math.max(clampBag(char.bagSize), d.bag.length); while (d.bag.length < d.bagSize) d.bag.push(null); }
        // one hero per class: a second save of a class (an old link's hero) replaces nothing - it is stored under its own id
      }
      if (i >= 0) d.characters[i] = char; else d.characters.push(char);
      write(d);
      return char;
    },
    /** roster save? (sim/heroes.js ensureHeroes ran) */
    heroes: () => !!read().heroes,
    remove(id) { const d = read(); d.characters = d.characters.filter((c) => c.id !== id); write(d); },
  };
}

/** Starting gear for a brand-new hero: a common tier-1 weapon of its class (mace + shield, twin daggers...). */
export function starterGear(cls, id) {
  const names = BASE_NAMES.weapon[cls] || BASE_NAMES.weapon.warrior;
  return { weapon: { uid: 'st' + String(id).replace(/[^A-Za-z0-9]/g, '').slice(-20), slot: 'weapon', rarity: 0, tier: 1, name: names[0], stats: { atk: 8 }, cls, mk: ['atk'], v: GEAR_VERSION } };
}

export function newCharacter({ name, cls, appearance }, idSeed = Date.now()) {
  const id = 'c' + idSeed.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  return sanitizeChar({ id, name, cls, appearance, level: 1, xp: 0, gv: GEAR_VERSION, equipment: CLASSES[cls] ? starterGear(cls, id) : undefined });
}

export function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
