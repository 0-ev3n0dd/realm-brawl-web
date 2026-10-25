// Auto-salvage filters (step 4, player-requested). Pure rules, unit-tested: the client (client/autosalvage.js) runs
// them on every gear pickup and salvages matching drops into materials through the normal bag -> salvage path (the
// sim's 'bagTake' command, which itself refuses locked items). The settings live in the account profile
// (pr.autoSalvage, sim/meta.js migrateProfile) so every hero shares them; a short log keeps the last few for undo.
//   rules (each with its own toggle):   rarity  - anything below a rarity (e.g. below Epic)
//                                        tier    - below tier N
//                                        classStat - without any of my class's stats
//                                        subStat - without sub-stat X
//                                        notSet  - not part of set Y (or: not a set piece at all)
//                                        setIs   - pieces of set Y (the only way to auto-salvage a set you are collecting)
//                                        otherClass - weapons / off-hands for another class
//   guards (always on):  locked items, Trial Sigils, Trial / Extreme pieces, upgraded / ascended / crafted items
//   guards (toggles):    relics (unless allowed), set pieces you are collecting (a piece of that set is equipped),
//                        anything better than what you have equipped in that slot (safety, on by default)
import { AFFIXES, AFFIX_SWAP, RARITIES } from './data/items.js';
import { SETS, FAMILY_SETS, setOf } from './sets.js';
import { itemPower, mainKeys, itemLevel } from './loot.js';
import { compareTarget } from './gear.js';

export const AS_LOG_MAX = 10;
export const AS_RULES = [
  { id: 'rarity', label: 'Anything below rarity', arg: 'rarity', def: 2 },
  { id: 'tier', label: 'Anything below tier', arg: 'tier', def: 3 },
  { id: 'ilvl', label: 'Item Level below', arg: 'ilvl', def: 20 }, // (item level pass)
  { id: 'classStat', label: "Without any of my class's stats" },
  { id: 'subStat', label: 'Without sub-stat', arg: 'stat', def: 'crit' },
  { id: 'notSet', label: 'Not part of set', arg: 'set', def: '*' },
  { id: 'setIs', label: 'Pieces of set', arg: 'set', def: 'duneborn' },
  { id: 'otherClass', label: 'Weapons / off-hands for other classes' },
];
export const AS_RULE = Object.fromEntries(AS_RULES.map((r) => [r.id, r]));
/** the rarities a "below" rule can name (Common .. Legendary) */
export const AS_RARITIES = RARITIES.slice(0, 4).map((r, i) => ({ i, name: r.name }));
export const AS_SETS = Object.values(SETS).map((s) => ({ id: s.id, name: s.short || s.name }));
export const AS_STATS = Object.keys(AFFIXES).filter((k) => !AFFIXES[k].cls && k !== 'chainDmg').map((k) => ({ k, name: AFFIXES[k].label }));

/** the class's own stats (Glory Gain / Chain Damage for Warrior ..., Max Resource / Resource Regen for the rest) */
export function classStatKeys(cls) {
  const own = Object.keys(AFFIXES).filter((k) => AFFIXES[k].cls === cls);
  const sw = AFFIX_SWAP[cls] ? Object.values(AFFIX_SWAP[cls]) : ['maxRes', 'resRegen'];
  return [...new Set([...own, ...sw])];
}

const normArg = (id, v) => {
  const R = AS_RULE[id]; if (!R || !R.arg) return undefined;
  if (R.arg === 'rarity') { const n = v | 0; return n >= 1 && n <= 3 ? n : R.def; }
  if (R.arg === 'tier') { const n = v | 0; return n >= 2 && n <= 5 ? n : R.def; }
  if (R.arg === 'ilvl') { const n = v | 0; return n >= 1 && n <= 200 ? n : R.def; }
  if (R.arg === 'stat') return typeof v === 'string' && AFFIXES[v] ? v : R.def;
  if (R.arg === 'set') return v === '*' && id === 'notSet' ? '*' : typeof v === 'string' && SETS[v] ? v : R.def;
  return undefined;
};
const cleanItem = (it) => (it && typeof it === 'object' && it.slot ? it : null);
/** settings (unknown / junk -> defaults: master switch off, "below Epic" ready to tick) */
export function normAutoSalvage(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const byId = new Map(Array.isArray(r.rules) ? r.rules.filter((x) => x && AS_RULE[x.id]).map((x) => [x.id, x]) : []);
  const rules = AS_RULES.map((R) => { const x = byId.get(R.id); const o = { id: R.id, on: x ? !!x.on : R.id === 'rarity' }; if (R.arg) o.arg = normArg(R.id, x ? x.arg : R.def); return o; });
  const log = Array.isArray(r.log) ? r.log.filter((e) => e && cleanItem(e.item)).slice(0, AS_LOG_MAX).map((e) => ({ t: +e.t || 0, item: e.item, gold: Math.max(0, e.gold | 0), mats: e.mats && typeof e.mats === 'object' ? Object.fromEntries(Object.entries(e.mats).map(([k, n]) => [k, Math.max(0, n | 0)])) : {} })) : [];
  return { on: !!r.on, mode: r.mode === 'all' ? 'all' : 'any', rules, allowRelics: !!r.allowRelics, protectSets: r.protectSets !== false, safety: r.safety !== false, log, n: Math.max(0, r.n | 0) };
}

/** does one rule match the item? */
export function ruleMatches(rule, it, cls) {
  const st = it.stats || {};
  switch (rule.id) {
    case 'rarity': return (it.rarity | 0) <= 3 && (it.rarity | 0) < rule.arg;
    case 'tier': return (it.tier | 0) < rule.arg;
    case 'ilvl': return itemLevel(it) < rule.arg;
    case 'classStat': { const ks = classStatKeys(cls); return !ks.some((k) => k in st); }
    case 'subStat': { const mk = mainKeys(it); return !Object.keys(st).some((k) => !mk.includes(k) && (k === rule.arg || (AFFIXES[k] && AFFIXES[k].stat === rule.arg) || (AFFIXES[rule.arg] && AFFIXES[rule.arg].stat === k))); }
    case 'notSet': { const s = setOf(it); return rule.arg === '*' ? !s : s !== rule.arg; }
    case 'setIs': return setOf(it) === rule.arg;
    case 'otherClass': return !!(it.cls && it.cls !== cls);
  }
  return false;
}

/** sets the hero is collecting: any set with a piece equipped */
export function collectingSets(p) { const out = new Set(); for (const k in (p && p.equipment) || {}) { const s = setOf(p.equipment[k]); if (s) out.add(s); } return out; }

/**
 * Should this freshly picked-up item be auto-salvaged? p = the hero (class, equipment). Returns
 * { ok: true, rule } or { ok: false, why } (why = the guard that kept it, or 'no rule').
 */
export function autoSalvageCheck(it, cfg, p) {
  const c = cfg && cfg.rules ? cfg : normAutoSalvage(cfg);
  if (!c.on) return { ok: false, why: 'off' };
  if (!it || !it.slot || it.slot === 'sigil') return { ok: false, why: 'sigil' };
  if (it.lock) return { ok: false, why: 'locked' };
  if ((it.rarity | 0) >= 5) return { ok: false, why: 'exotic' }; // (Trial / Extreme: hand-salvage only)
  if ((it.up | 0) || it.asc || it.crafted) return { ok: false, why: 'worked' };
  if (it.slot === 'relic' && !c.allowRelics) return { ok: false, why: 'relic' };
  const on = c.rules.filter((r) => r.on);
  if (!on.length) return { ok: false, why: 'no rule' };
  const hits = on.filter((r) => ruleMatches(r, it, p.cls));
  const match = c.mode === 'all' ? hits.length === on.length : hits.length > 0;
  if (!match) return { ok: false, why: 'no rule' };
  const set = setOf(it);
  if (set && c.protectSets && collectingSets(p).has(set) && !hits.some((r) => r.id === 'setIs' && r.arg === set)) return { ok: false, why: 'collecting' };
  if (c.safety && !(it.cls && it.cls !== p.cls)) { const cur = compareTarget(p, it); if (!cur || itemPower(it) > itemPower(cur)) return { ok: false, why: 'better' }; } // (an empty slot counts: anything beats nothing)
  return { ok: true, rule: hits[0].id };
}
export const GUARD_TEXT = { locked: 'locked', exotic: 'Trial / Extreme piece', worked: 'upgraded or crafted', relic: 'relics are protected', collecting: 'a set you are collecting', better: 'better than what you wear', sigil: 'key item' };

/** a log entry for undo (newest first, AS_LOG_MAX kept) */
export function logSalvage(cfg, item, value, t = Date.now()) {
  cfg.log.unshift({ t, item: JSON.parse(JSON.stringify(item)), gold: value.gold | 0, mats: { ...(value.mats || {}) } });
  if (cfg.log.length > AS_LOG_MAX) cfg.log.length = AS_LOG_MAX;
  cfg.n = (cfg.n | 0) + 1;
}
/**
 * Undo entry k: pays back the gold + materials it gave (refused when they are already spent) and returns the item to
 * restore (the caller sends it back to the bag), or { err }.
 */
export function undoSalvage(cfg, pr, k, bagFree = 1) {
  const e = cfg.log[k]; if (!e) return { err: 'gone' };
  if (bagFree < 1) return { err: 'bag' };
  if ((pr.gold | 0) < e.gold) return { err: 'spent' };
  for (const [m, n] of Object.entries(e.mats)) if (((pr.mats && pr.mats[m]) | 0) < n) return { err: 'spent' };
  pr.gold -= e.gold; for (const [m, n] of Object.entries(e.mats)) pr.mats[m] -= n;
  cfg.log.splice(k, 1);
  return { item: e.item };
}
export { FAMILY_SETS };
