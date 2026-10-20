// The bag view (step 4): tabs, sorting and filters over the bag (64..128 slots). Pure (no DOM): it maps the visible cells to
// real bag indices, so clicking a cell still equips / locks / drops the right item (client/ui.js draws it, unit-tested).
import { itemPower, itemLevel } from '../sim/loot.js';
import { AFFIXES, STAT_LABELS, RARITIES } from '../sim/data/items.js';
import { setOf, SETS, FAMILY_SETS } from '../sim/sets.js';

export const BAG_TABS = [
  { id: 'all', label: 'All' },
  { id: 'weapons', label: 'Weapons', slots: ['weapon', 'offhand'] },
  { id: 'armor', label: 'Armor', slots: ['helm', 'armor', 'gloves', 'boots'] },
  { id: 'accessories', label: 'Accessories', slots: ['ring', 'amulet'] },
  { id: 'relics', label: 'Relics', slots: ['relic'] },
  { id: 'materials', label: 'Materials', mats: true },
];
export const BAG_TAB = Object.fromEntries(BAG_TABS.map((t) => [t.id, t]));
export const BAG_SORTS = [
  { id: 'bag', label: 'Bag order' }, { id: 'ilvl', label: 'Item Level' }, { id: 'power', label: 'Power' }, { id: 'rarity', label: 'Rarity' },
  { id: 'tier', label: 'Tier' }, { id: 'slot', label: 'Slot' }, { id: 'newest', label: 'Newest' },
];
export const SLOT_ORDER = ['weapon', 'offhand', 'helm', 'armor', 'gloves', 'boots', 'ring', 'amulet', 'relic', 'sigil'];
export const SLOT_NAMES = { weapon: 'Weapon', offhand: 'Off-hand', helm: 'Helm', armor: 'Chest', gloves: 'Gloves', boots: 'Boots', ring: 'Ring', amulet: 'Amulet', relic: 'Relic', sigil: 'Key item' };
export const defaultBagView = () => ({ tab: 'all', sort: 'bag', slot: '', rarity: '', set: '', text: '' });
export function normBagView(raw) {
  const d = defaultBagView(), r = raw && typeof raw === 'object' ? raw : {};
  return {
    tab: BAG_TAB[r.tab] ? r.tab : d.tab, sort: BAG_SORTS.some((s) => s.id === r.sort) ? r.sort : d.sort,
    slot: SLOT_ORDER.includes(r.slot) ? r.slot : '', rarity: r.rarity !== '' && r.rarity != null && RARITIES[r.rarity | 0] ? String(r.rarity | 0) : '',
    set: r.set === '*' || r.set === '-' || SETS[r.set] || FAMILY_SETS[r.set] ? r.set : '', text: typeof r.text === 'string' ? r.text.slice(0, 24) : '',
  };
}
/** does the item have a stat whose label / key contains the text? (the "sub-stat contains X" filter) */
export function statContains(it, text) {
  const q = String(text || '').trim().toLowerCase(); if (!q) return true;
  return Object.keys(it.stats || {}).some((k) => k.toLowerCase().includes(q) || String((AFFIXES[k] && AFFIXES[k].label) || STAT_LABELS[k] || '').toLowerCase().includes(q));
}
export function passes(it, v) {
  if (!it) return false;
  const T = BAG_TAB[v.tab];
  if (T && T.slots && !T.slots.includes(it.slot)) return false;
  if (v.slot && it.slot !== v.slot) return false;
  if (v.rarity !== '' && (it.rarity | 0) !== (v.rarity | 0)) return false;
  if (v.set) { const s = setOf(it); if (v.set === '*' ? !s : v.set === '-' ? s : s !== v.set) return false; }
  if (v.text && !statContains(it, v.text)) return false;
  return true;
}
const CMP = {
  ilvl: (a, b) => itemLevel(b) - itemLevel(a) || itemPower(b) - itemPower(a),
  power: (a, b) => itemPower(b) - itemPower(a),
  rarity: (a, b) => (b.rarity | 0) - (a.rarity | 0) || itemPower(b) - itemPower(a),
  tier: (a, b) => (b.tier | 0) - (a.tier | 0) || itemPower(b) - itemPower(a),
  slot: (a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || itemPower(b) - itemPower(a),
  newest: (a, b) => (b.got | 0) - (a.got | 0),
};
// Slot pick (2026-10-06): clicking an equipment slot in the hub shows only the bag items that fit it, best first (pieces your
// class can wear first, then item power, rarity, tier). It is a temporary layer over the saved view: it overrides the tab and
// the slot filter while it is on (rarity / set / stat filters still apply); clearing it returns to the view as it was.
export const PICK_SLOT = { weapon: 'weapon', offhand: 'offhand', ring: 'ring', ring2: 'ring', relic: 'relic', helm: 'helm', armor: 'armor', gloves: 'gloves', boots: 'boots', amulet: 'amulet' };
export const pickLabel = (eq) => ({ ring2: 'Ring II', armor: 'Chest' }[eq] || SLOT_NAMES[PICK_SLOT[eq]] || '');
const fitsCls = (it, cls) => (!cls || !it.cls || it.cls === cls ? 1 : 0);
export const pickCmp = (cls) => (a, b) => fitsCls(b, cls) - fitsCls(a, cls) || itemPower(b) - itemPower(a) || itemLevel(b) - itemLevel(a) || (b.rarity | 0) - (a.rarity | 0) || (b.tier | 0) - (a.tier | 0);
/** the bag indices to show, in display order (the materials tab shows none). opts: { cls } (the slot pick's class-first order) */
export function bagView(items, view, opts = {}) {
  const v = normBagView(view), pick = view && PICK_SLOT[view.pick] ? view.pick : '';
  if (pick) {
    const pv = { ...v, tab: 'all', slot: PICK_SLOT[pick] }, idx = [];
    (items || []).forEach((it, i) => { if (passes(it, pv)) idx.push(i); });
    const c = pickCmp(opts.cls);
    return idx.sort((i, j) => c(items[i], items[j]) || i - j);
  }
  if (BAG_TAB[v.tab].mats) return [];
  const idx = []; (items || []).forEach((it, i) => { if (passes(it, v)) idx.push(i); });
  const c = CMP[v.sort];
  if (c) idx.sort((i, j) => c(items[i], items[j]) || i - j);
  return idx;
}
/** is any filter narrowing the view (besides the tab)? */
export const filtered = (v) => !!((v.pick && PICK_SLOT[v.pick]) || v.slot || v.rarity !== '' || v.set || v.text);
