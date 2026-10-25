// Game loop B2 (2026-10-09): the Collection. Every set piece, Trial / Extreme piece (by slot, any hero) and relic (by
// rarity) a hero of the account has ever held is ticked off in profile.coll; a finished row pays out once (gold + account
// XP, and the 1st / 3rd finished rows a +4 bag grant: the bagGrants source in sim/bagsize.js). Pure (the client scans the
// bag + gear + stash: client/rewards.js; the Progress panel shows it: client/progressui.js).
import { SETS } from './sets.js';
import { EXOTIC } from './exotic.js';
import { SET_SLOTS, SLOT_LABEL } from './data/items.js';

export const COLL = { gold: 1500, xp: 2500, xpLegend: 1.5, relicR: [1, 2, 3], bagRows: { 1: 'coll1', 3: 'coll3' }, bag: 4 };
const RNAME = { 1: 'Rare', 2: 'Epic', 3: 'Legendary' };
/** every row: { id, name, kind (set / trial / extreme / relic), color, entries: [{ key, label }] } */
export const COLL_ROWS = [
  ...Object.values(SETS).map((S) => ({ id: 'set:' + S.id, name: S.name, kind: 'set', color: S.color, entries: SET_SLOTS.map((sl) => ({ key: `set:${S.id}:${sl}`, label: SLOT_LABEL[sl] || sl })) })),
  ...Object.values(EXOTIC).map((F) => ({ id: 'ex:' + F.id, name: `${F.prefix} (${F.rarity >= 7 ? 'Extreme' : 'Trial'})`, kind: F.rarity >= 7 ? 'extreme' : 'trial', color: F.color, entries: SET_SLOTS.map((sl) => ({ key: `ex:${F.id}:${sl}`, label: SLOT_LABEL[sl] || sl })) })),
  { id: 'savage', name: 'Savage Clears', kind: 'savage', color: '#ff6a3d', entries: [['nf', 'Neferakh'], ['sk', 'Skaldra'], ['py', 'Pyrrhex'], ['vh', 'Vharok'], ['as', 'Astrael']].map(([k, l]) => ({ key: `savage:${k}`, label: l })) }, // (Part 0S: a first-ever clear ticks its boss)
  { id: 'relic', name: 'Relics', kind: 'relic', color: '#ffb86b', entries: COLL.relicR.map((r) => ({ key: `relic:${r}`, label: RNAME[r] })) },
];
export const COLL_KEYS = new Set(COLL_ROWS.flatMap((r) => r.entries.map((e) => e.key)));
/** the collection key of an item (or '') */
export function collKey(it) {
  if (!it || typeof it !== 'object') return '';
  if (it.ex && EXOTIC[it.ex]) return `ex:${it.ex}:${it.slot}`;
  if (it.set && SETS[it.set]) return `set:${it.set}:${it.slot}`;
  if (it.slot === 'relic') return `relic:${Math.max(1, Math.min(3, it.rarity | 0))}`;
  return '';
}
export const normColl = (raw) => { const o = {}; if (raw && typeof raw === 'object') for (const k in raw) if (COLL_KEYS.has(k) && raw[k]) o[k] = 1; return o; };
export const rowDone = (pr, row) => row.entries.every((e) => pr.coll && pr.coll[e.key]);
export const rowCount = (pr, row) => row.entries.filter((e) => pr.coll && pr.coll[e.key]).length;
/** tick off items; returns { fresh: [keys], rows: [rows finished just now (rewards already paid)] } */
export function collect(pr, items, legend = false) {
  pr.coll = pr.coll || {}; pr.collDone = pr.collDone || {};
  const fresh = [], rows = [];
  for (const it of items) { const k = collKey(it); if (k && COLL_KEYS.has(k) && !pr.coll[k]) { pr.coll[k] = 1; fresh.push(k); } }
  if (!fresh.length) return { fresh, rows };
  for (const row of COLL_ROWS) if (!pr.collDone[row.id] && rowDone(pr, row)) rows.push(payRow(pr, row, legend));
  return { fresh, rows };
}
/** tick one key that is not an item (a Savage first clear); same return as collect */
export function collectKey(pr, key, legend = false) {
  pr.coll = pr.coll || {}; pr.collDone = pr.collDone || {}; const fresh = [], rows = [];
  if (!COLL_KEYS.has(key) || pr.coll[key]) return { fresh, rows };
  pr.coll[key] = 1; fresh.push(key);
  for (const row of COLL_ROWS) if (!pr.collDone[row.id] && rowDone(pr, row)) rows.push(payRow(pr, row, legend));
  return { fresh, rows };
}
/** a finished row's one-time reward (in place) */
export function payRow(pr, row, legend = false) {
  pr.collDone[row.id] = 1;
  const n = Object.keys(pr.collDone).length, xp = Math.round(COLL.xp * (legend ? COLL.xpLegend : 1));
  pr.gold = (pr.gold | 0) + COLL.gold; pr.accXp = (pr.accXp | 0) + xp;
  const gid = COLL.bagRows[n]; let bag = 0;
  if (gid) { pr.bagGrants = Array.isArray(pr.bagGrants) ? pr.bagGrants : []; if (!pr.bagGrants.some((g) => g && g.id === gid)) { pr.bagGrants.push({ id: gid, slots: COLL.bag, label: 'Collection' }); bag = COLL.bag; } }
  return { row, gold: COLL.gold, xp, bag };
}
export function collStats(pr) { const have = COLL_ROWS.reduce((s, r) => s + rowCount(pr, r), 0), all = COLL_KEYS.size; return { have, all, rows: COLL_ROWS.filter((r) => rowDone(pr, r)).length, of: COLL_ROWS.length }; }
