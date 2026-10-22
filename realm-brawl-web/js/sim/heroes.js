// The Heroes roster (2026-10-07): every class is ONE fixed, named hero. Names, titles, roles and looks live in this
// one table so they are easy to change later. Pure: the save store / storage are passed in (unit-tested in
// test/heroes.test.js). Per hero: level, xp, mastery (from its kills), loadout presets, equipped gear. Shared by
// every hero: the bag (the save's root `bag`, sim/save.js), the stash (sim/village.js) and the account level.
import { CLASSES } from './data/classes.js';
import { sanitizeChar, newCharacter, SAVE_KEY } from './save.js';
import { normStash, stashPutAny, STASH_KEY } from './village.js';
import { clampBag, BAG_MAX } from './bagsize.js';
import { masteryOf } from './mastery.js';

/** THE roster: class id -> { name, title, role, look (appearance indices, sim/data/classes.js APPEARANCE) } */
export const HEROES = {
  warrior: { name: 'Brakka', title: 'the Warlord', role: 'Bruiser', look: { skin: 2, hairStyle: 3, hairColor: 1, outfit: 0 } },
  ranger: { name: 'Sylva', title: "the Hawk's Eye", role: 'Marksman', look: { skin: 1, hairStyle: 2, hairColor: 3, outfit: 2 } },
  mage: { name: 'Orin', title: 'the Starbreaker', role: 'Caster', look: { skin: 0, hairStyle: 0, hairColor: 4, outfit: 4 } },
  cleric: { name: 'Cassius', title: 'Hammer of Dawn', role: 'Guardian', look: { skin: 1, hairStyle: 0, hairColor: 3, outfit: 3 } },
  bard: { name: 'Lana', title: 'the Last Encore', role: 'Support', look: { skin: 1, hairStyle: 2, hairColor: 5, outfit: 6 } },
  summoner: { name: 'Mirelle', title: 'Keeper of the Grimoire', role: 'Summoner', look: { skin: 0, hairStyle: 4, hairColor: 7, outfit: 5 } },
  monk: { name: 'Tenzo', title: 'the Open Palm', role: 'Brawler', look: { skin: 3, hairStyle: 5, hairColor: 0, outfit: 3 } },
  bladedancer: { name: 'Kage', title: 'the Silent Mark', role: 'Assassin', look: { skin: 2, hairStyle: 1, hairColor: 0, outfit: 7 } },
  dragoon: { name: 'Varek', title: "the Dragon's Fall", role: 'Lancer', look: { skin: 2, hairStyle: 1, hairColor: 6, outfit: 1 } },
  samurai: { name: 'Hayate', title: 'the Perfect Cut', role: 'Duelist', look: { skin: 1, hairStyle: 4, hairColor: 0, outfit: 0 } },
};
/** roster order (the bottom strip's default order) */
export const HERO_IDS = Object.keys(HEROES).filter((c) => CLASSES[c]);
export const HERO_SORTS = [{ id: 'level', label: 'Level' }, { id: 'name', label: 'Name' }, { id: 'role', label: 'Role' }];

export const heroOf = (cls) => HEROES[cls] || { name: (CLASSES[cls] && CLASSES[cls].name) || 'Hero', title: '', role: '', look: {} };
/** "Brakka, the Warlord" */
export const heroFull = (cls) => { const h = heroOf(cls); return h.title ? `${h.name}, ${h.title}` : h.name; };

/** mastery: grows with the hero's own kills + its overflow XP (game loop B1: rank 0..50, perks; sim/mastery.js) */
export function mastery(char) { return masteryOf(char); }

/** a brand-new hero of a class (level 1, the class's starter weapon, the roster name + look) */
export function newHero(cls, seed = Date.now()) {
  const h = heroOf(cls);
  const ch = newCharacter({ name: h.name, cls, appearance: { ...h.look } }, seed);
  ch.updatedAt = 0;
  return ch;
}
/** a save's character as its class's hero: the roster name + look (progress untouched) */
export function asHero(ch) { if (!ch) return ch; const h = heroOf(ch.cls); return { ...ch, name: h.name, appearance: { ...(ch.appearance || {}), ...h.look } }; }

const itemsOf = (arr) => (Array.isArray(arr) ? arr.filter((it) => it && typeof it === 'object') : []);
const rank = (a, b) => (b.level | 0) - (a.level | 0) || (b.xp || 0) - (a.xp || 0) || (b.updatedAt || 0) - (a.updatedAt || 0);

/**
 * Fold an old save (any number of characters, any classes) into the roster. Pure.
 * - each class keeps ONE hero: the highest level (then xp, then most recent) copy;
 * - the other copies' EQUIPPED gear goes into the stash (then the bag, if the stash is full; then `archive`);
 * - the shared bag starts as the most recently played character's bag; every other character's bag items fill its
 *   empty slots, overflowing into the stash (then `archive`) - nothing is dropped;
 * - every class without a hero gets a fresh level-1 one.
 * Returns { save, stash, report } (save = { version, heroes: 1, characters, bag, bagSize, archive }).
 */
export function foldHeroes(save, stashRaw, seed = Date.now()) {
  const S = normStash(stashRaw);
  const chars = (save && Array.isArray(save.characters) ? save.characters : []).map(sanitizeChar).filter(Boolean);
  const report = { kept: [], merged: [], toStash: 0, toBag: 0, archived: 0, created: [] };
  const archive = itemsOf(save && save.archive);
  const recent = chars.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;
  const bagSize = Math.min(BAG_MAX, Math.max(clampBag(0), ...chars.map((c) => clampBag(c.bagSize))));
  const bag = Array(bagSize).fill(null);
  if (recent) recent.inventory.forEach((it, i) => { if (it && i < bagSize) bag[i] = it; });
  const seen = new Set(bag.filter(Boolean).map((it) => it.uid).filter(Boolean));
  const stashFirst = (it) => { if (stashPutAny(S, it, 1)) { report.toStash++; return; } const i = bag.indexOf(null); if (i >= 0) { bag[i] = it; report.toBag++; return; } archive.push(it); report.archived++; };
  const bagFirst = (it) => { const i = bag.indexOf(null); if (i >= 0) { bag[i] = it; report.toBag++; return; } if (stashPutAny(S, it, 1)) { report.toStash++; return; } archive.push(it); report.archived++; };
  const add = (it, how) => { if (it.uid) { if (seen.has(it.uid)) return; seen.add(it.uid); } how(it); };
  // other characters' bags -> the shared bag
  for (const c of chars) if (c !== recent) for (const it of itemsOf(c.inventory)) add(it, bagFirst);
  // one hero per class
  const byCls = new Map();
  for (const c of chars) { if (!byCls.has(c.cls)) byCls.set(c.cls, []); byCls.get(c.cls).push(c); }
  const characters = [];
  for (const [cls, list] of byCls) {
    list.sort(rank);
    const keep = list[0];
    characters.push({ ...asHero(keep), inventory: [], bagSize });
    report.kept.push({ cls, id: keep.id, was: keep.name, level: keep.level });
    for (const d of list.slice(1)) {
      let n = 0;
      for (const it of Object.values(d.equipment || {})) if (it && typeof it === 'object') { add(it, stashFirst); n++; }
      report.merged.push({ cls, id: d.id, was: d.name, level: d.level, gear: n });
    }
  }
  for (const cls of HERO_IDS) if (!byCls.has(cls)) { const h = newHero(cls, seed + HERO_IDS.indexOf(cls)); characters.push({ ...h, inventory: [], bagSize }); report.created.push(cls); }
  characters.sort((a, b) => HERO_IDS.indexOf(a.cls) - HERO_IDS.indexOf(b.cls));
  return { save: { version: 3, heroes: 1, characters, bag, bagSize, archive }, stash: S, report };
}

/**
 * Make sure a browser's save is in roster form (run once at start-up, before anything reads the stash). Returns the
 * fold report, or null when it already was. `key` = the save key (the phone uses its own).
 */
export function ensureHeroes(storage, key = SAVE_KEY, seed = Date.now()) {
  let raw = null; try { raw = JSON.parse(storage.getItem(key) || 'null'); } catch { raw = null; }
  if (raw && raw.heroes) {
    // already folded: add any class still missing (a new class in an update)
    const have = new Set((raw.characters || []).map((c) => c && c.cls));
    const miss = HERO_IDS.filter((c) => !have.has(c));
    if (!miss.length) return null;
    raw.characters = [...(raw.characters || []), ...miss.map((c, i) => ({ ...newHero(c, seed + i), inventory: [] }))];
    storage.setItem(key, JSON.stringify(raw));
    return { kept: [], merged: [], toStash: 0, toBag: 0, archived: 0, created: miss };
  }
  let st = null; try { st = JSON.parse(storage.getItem(STASH_KEY) || 'null'); } catch { st = null; }
  const r = foldHeroes(raw || { characters: [] }, st, seed);
  if (raw && raw.characters && raw.characters.length) { try { storage.setItem(key + '.preHeroes', JSON.stringify(raw)); } catch { /* full: the fold keeps every item anyway */ } }
  storage.setItem(STASH_KEY, JSON.stringify(r.stash));
  storage.setItem(key, JSON.stringify(r.save));
  return r.report;
}

/** the 10 heroes of a store, roster order (one per class; the highest level if a class somehow has two) */
export function heroList(store) {
  const best = new Map();
  for (const c of store.list()) { const b = best.get(c.cls); if (!b || rank(c, b) < 0) best.set(c.cls, c); }
  return HERO_IDS.map((cls) => best.get(cls)).filter(Boolean).map(asHero);
}
/** a class's hero from the store (made + saved on the spot if missing) */
export function heroFor(store, cls) {
  const h = heroList(store).find((c) => c.cls === cls);
  if (h) return h;
  if (!CLASSES[cls]) return null; // (heroList already gives the roster name + look)
  return store.upsert(newHero(cls));
}
/** sort a hero list for the roster strip */
export function sortHeroes(list, by = 'level') {
  const L = list.slice(), ord = (c) => HERO_IDS.indexOf(c.cls);
  if (by === 'name') L.sort((a, b) => heroOf(a.cls).name.localeCompare(heroOf(b.cls).name));
  else if (by === 'role') L.sort((a, b) => heroOf(a.cls).role.localeCompare(heroOf(b.cls).role) || ord(a) - ord(b));
  else L.sort((a, b) => (b.level | 0) - (a.level | 0) || (b.xp || 0) - (a.xp || 0) || ord(a) - ord(b));
  return L;
}
