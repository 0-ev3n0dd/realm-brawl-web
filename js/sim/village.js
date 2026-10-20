// Experience pass 3: the village services (pure data + rules; the DOM lives in client/village.js).
//   Borin the Blacksmith - the Forge (upgrade / craft from pass 2) + salvage (gear -> materials + gold)
//   Dorrik the Quartermaster - consumables (Health Potions, elixirs) and buying back your spare gear
//   the Stash chest - 4 tabs x 40 shared slots for every hero in this browser (step 4: tabbed, sim/village.js stash)
//   the Training Dummy - a real (sim) target that never dies, with a client-side DPS meter
//   the Co-op Board - see / host / join the server's party, ready-up
// Classic village layout only (the painted tavern keeps the Mission Counter; the services are a village feature).
import { migrateItem } from './gear.js';
import { itemLevel } from './loot.js';
import { TOWN_POS as T } from './townconst.js';

const P = (dx, dy) => ({ x: T.x + dx, y: T.y + dy });
/** NPC / object spots: at = where the character or object stands, use = the interact point, r = reach */
export const STATIONS = [ // (2026-10-09 town layout: one service per district, spaced out; sim/townconst.js DISTRICTS)
  { id: 'smith', name: 'Borin', title: 'Blacksmith', verb: 'Forge', at: P(-650, -190), use: P(-640, -126), r: 80, cls: 'warrior', app: { skin: 3, hairStyle: 2, hairColor: 0, outfit: 1 } },
  { id: 'qm', name: 'Dorrik', title: 'Quartermaster', verb: 'Shop', at: P(690, 75), use: P(684, 140), r: 80, cls: 'ranger', app: { skin: 2, hairStyle: 5, hairColor: 3, outfit: 4 } },
  { id: 'stash', name: 'Stash', title: 'Shared chest', verb: 'Open', at: P(360, -170), use: P(360, -130), r: 66 },
  { id: 'dummy', name: 'Training Dummy', title: 'settings + DPS meter', verb: 'Settings', at: P(-600, 330), use: P(-600, 330), r: 150 },
  // experience pass 4: the story NPC (no panel: talking to her is the story dialogue)
  { id: 'elder', name: 'Elder Maren', title: 'Village Elder', verb: 'Talk', at: P(600, -425), use: P(597, -360), r: 74, cls: 'mage', app: { skin: 0, hairStyle: 7, hairColor: 5, outfit: 3 } },
  { id: 'lobby', name: 'Co-op Board', title: 'Party board', verb: 'Party', at: P(-230, -430), use: P(-230, -392), r: 68 },
  { id: 'weekly', name: 'Weekly Board', title: 'Featured mission + bonuses', verb: 'Read', at: P(230, -430), use: P(230, -390), r: 68 },
  { id: 'altar', name: 'Ascension Altar', title: 'Ascend your hero', verb: 'Ascend', at: P(-260, -680), use: P(-260, -615), r: 74 }, // (Part B: sim/ascension.js)
];
export const STATION = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
/** the station whose interact point (x, y) is inside (nearest first); village layout only */
export function nearStation(x, y, ly = 'village', pad = 0) {
  if (ly === 'tavern') return null;
  let best = null, bd = 1e9;
  for (const s of STATIONS) { const d = Math.hypot(x - s.use.x, y - s.use.y); if (d < s.r + pad && d < bd) { bd = d; best = s; } }
  return best;
}
/** the station drawn at world point (x, y) (the character / object or its interact spot, within `pad`): a tap on the phone */
export const TAP_PAD = 70, TAP_REACH = 220;
export function stationAt(x, y, ly = 'village', pad = TAP_PAD) {
  if (ly === 'tavern') return null;
  let best = null, bd = 1e9;
  for (const s of STATIONS) { const d = Math.min(Math.hypot(x - s.at.x, y - (s.at.y - 30)), Math.hypot(x - s.use.x, y - s.use.y)); if (d < pad && d < bd) { bd = d; best = s; } }
  return best;
}
export const DUMMY_POS = STATION.dummy.at;
export const DUMMY_HP = 60000;

// ------------------------------------------------------------------ salvage + selling
const EXCL_TOKEN = { rimebound: 'rime_sigil', zeropoint: 'rime_sigil', cinderbound: 'cinder_sigil', worldheart: 'cinder_sigil', starbound: 'star_shard', bigbang: 'star_shard' };
const SET_MATS = { frostveil: 'rimeshard', emberdeep: 'cinderglass' };
const TIER_MAT = (t) => (t <= 3 ? ['greenwood', 'ashstone', 'warlord_tusk'] : t >= 5 ? ['tomb_linen', 'chitin', 'solar_ember'] : ['sunglass', 'chitin', 'queen_scale']);
/** what breaking an item down gives: { gold, mats } (higher rarity / tier / +level = more; part of the upgrade cost comes back) */
export function salvageValue(it) {
  if (!it) return null;
  if (it.slot === 'sigil') return { gold: 200, mats: { tomb_linen: 6, solar_ember: 1 } }; // (game loop A1: old Trial Sigils break down into Tomb materials)
  const t = it.tier | 0 || 1, r = Math.min(4, it.rarity | 0), up = it.up | 0, [a, b, c] = TIER_MAT(t), mats = {};
  mats[a] = 2 + r + t + Math.ceil(up * 1.5) + 2 * (it.asc | 0); // (horde pass 2: a bit more back, so horde gear always feeds the Forge)
  if (r >= 1 || t >= 3) mats[b] = r + (t >= 3 ? 1 : 0) + Math.floor(up / 2);
  if (r >= 3 || up >= 7) mats[c] = 1 + (up >= 9 ? 1 : 0);
  const tok = EXCL_TOKEN[it.ex], biome = it.set && SET_MATS[it.set]; // piece 4: exclusive gear gives part of its own materials back
  if (tok) mats[tok] = (mats[tok] | 0) + ((it.rarity | 0) >= 7 ? 3 : 1);
  if (biome) mats[biome] = (mats[biome] | 0) + 3;
  for (const k in mats) if (!(mats[k] > 0)) delete mats[k];
  return { gold: Math.round((6 + 4 * t) * (1 + r) * ((it.rarity | 0) >= 6 ? 2 : 1) + 30 * up), mats };
}
/** what Dorrik pays for an item */
export function sellPrice(it) {
  if (!it) return 0;
  if (it.slot === 'sigil') return 150;
  const t = it.tier | 0 || 1, r = Math.min(4, it.rarity | 0);
  return Math.round((12 + 10 * t) * [1, 2.2, 4.5, 9, 12][r] * ((it.rarity | 0) >= 7 ? 2.5 : (it.rarity | 0) >= 6 ? 1.6 : 1) + 45 * (it.up | 0));
}

// ------------------------------------------------------------------ consumables
// potion: drunk in the field (key H): heals 45 % max HP, 15 s cooldown (the sim enforces it). The elixirs are drunk at the
// Quartermaster and run on real time (fortune) or until the next reward screen (scholar).
export const CONSUMABLES = [
  { id: 'potion', name: 'Health Potion', desc: 'Heals 45% of max HP. Drink it with H (15 s cooldown).', price: 60, max: 10, color: '#ff5e7a', tier: 1 },
  { id: 'fortune', name: 'Elixir of Fortune', desc: '+25% gold and +10% material drops for 10 minutes.', price: 260, max: 5, color: '#ffd23f', mins: 10, tier: 2 },
  { id: 'scholar', name: "Scholar's Tonic", desc: '+25% account XP on your next reward screen.', price: 220, max: 5, color: '#7ee0ff', tier: 3 },
  { id: 'greater', name: 'Greater Health Potion', desc: 'Heals 70% of max HP. H drinks one when you are below half HP (shares the 15 s cooldown).', price: 150, max: 5, color: '#ff2f6d', tier: 4 },
];
// shop tiers come from the story chain (sim/story.js shopTier): 1 potions, 2 +Fortune (ch.1), 3 +Scholar (ch.2), 4 +Greater (ch.3)
export const CONSUMABLE = Object.fromEntries(CONSUMABLES.map((c) => [c.id, c]));
export const POTION = { heal: 0.45, bigHeal: 0.7, cd: 15 * 60 };
/** buy n of a consumable into the profile (gold, stack cap). Returns '' or why not. */
export function buyConsumable(pr, id, n = 1, tier = Infinity) {
  const c = CONSUMABLE[id]; if (!c) return 'Unknown item';
  if ((c.tier || 1) > tier) return 'Dorrik has not stocked that yet';
  pr.pouch = pr.pouch || {}; const have = pr.pouch[id] | 0;
  if (have + n > c.max) return `You can carry at most ${c.max}`;
  if ((pr.gold | 0) < c.price * n) return 'Not enough gold';
  pr.gold -= c.price * n; pr.pouch[id] = have + n; return '';
}
/** use one: returns '' or why not (the potion's heal itself is the sim's `potion` command) */
export function useConsumable(pr, id, now = Date.now()) {
  const c = CONSUMABLE[id]; pr.pouch = pr.pouch || {}; pr.buffs = pr.buffs || {};
  if (!c || !(pr.pouch[id] > 0)) return 'None left';
  if (id === 'fortune') pr.buffs.fortune = Math.max(now, pr.buffs.fortune || 0) + c.mins * 60000;
  if (id === 'scholar') { if (pr.buffs.scholar) return 'Already active'; pr.buffs.scholar = 1; }
  pr.pouch[id]--; return '';
}
export const fortuneOn = (pr, now = Date.now()) => !!(pr && pr.buffs && pr.buffs.fortune > now);

// ------------------------------------------------------------------ the shared stash
// Step 4: tabbed - STASH_TABS tabs of STASH_SIZE slots (160 in all), every hero of the profile shares it. v1 (one
// 40-slot list) migrates into tab 1. `s.items` stays an alias of tab 1 (non-enumerable: not saved twice).
export const STASH_SIZE = 40;
export const STASH_TABS = 4;
export const STASH_TABS_MAX = 6; // (game loop B2: tab 5 at account Lv 27, tab 6 at Lv 30)
/** stash tabs an account has at an account level */
export const stashTabsFor = (accLv) => STASH_TABS + (accLv >= 27 ? 1 : 0) + (accLv >= 30 ? 1 : 0);
export const STASH_KEY = 'realmbrawl.stash';
export const STASH_TAB_NAMES = ['Main', 'Gear', 'Sets', 'Spare', 'Annex', 'Legend'];
const withAlias = (s) => Object.defineProperty(s, 'items', { get() { return this.tabs[0].items; }, enumerable: false, configurable: true });
export const newStash = (n = STASH_TABS) => withAlias({ v: 2, tabs: Array.from({ length: Math.max(STASH_TABS, Math.min(STASH_TABS_MAX, n | 0)) }, (_, t) => ({ name: STASH_TAB_NAMES[t] || `Tab ${t + 1}`, items: Array(STASH_SIZE).fill(null) })) });
const cleanTab = (n, t) => String(n ?? '').replace(/[\u0000-\u001f<>"`]/g, '').trim().slice(0, 14) || STASH_TAB_NAMES[t] || `Tab ${t + 1}`;
export function normStash(raw, norm = migrateItem, want = 0) { // (gear expansion: old stash items migrate like the bag, sim/gear.js)
  const tabs = raw && Array.isArray(raw.tabs) ? raw.tabs : [{ items: raw && Array.isArray(raw.items) ? raw.items : [] }]; // (v1: one list -> tab 1)
  const s = newStash(Math.max(want | 0, tabs.length)); // (game loop B2: 4-6 tabs; a stash never loses a tab it has)
  const seen = new Set();
  for (let t = 0; t < s.tabs.length; t++) {
    const src = tabs[t] && typeof tabs[t] === 'object' ? tabs[t] : {}, arr = Array.isArray(src.items) ? src.items : [];
    if (src.name != null) s.tabs[t].name = cleanTab(src.name, t);
    for (let i = 0; i < STASH_SIZE; i++) {
      const it = arr[i], v = it && typeof it === 'object' && it.slot ? norm(it) : null;
      if (v && v.uid && seen.has(v.uid)) continue; // (a duplicated uid keeps its first copy)
      if (v && v.uid) seen.add(v.uid);
      s.tabs[t].items[i] = v || null;
    }
  }
  return s;
}
const tabOf = (s, t) => s.tabs[Number.isInteger(t) && t >= 0 && t < s.tabs.length ? t : 0];
/** put an item into tab t (default 1): slot i if given and free, else its first free slot. The index or -1. */
export function stashPut(s, it, t = 0, i = -1) {
  const T = tabOf(s, t); if (!it) return -1;
  if (!(Number.isInteger(i) && i >= 0 && i < STASH_SIZE && !T.items[i])) i = T.items.indexOf(null);
  if (i < 0) return -1; T.items[i] = it; return i;
}
/** put an item anywhere: tab t first, then the others. { t, i } or null when the whole stash is full */
export function stashPutAny(s, it, t = 0) {
  const order = [t, ...s.tabs.map((_, k) => k).filter((k) => k !== t)];
  for (const k of order) { const i = stashPut(s, it, k); if (i >= 0) return { t: k, i }; }
  return null;
}
/** take slot i of tab t out: the item or null */
export function stashTake(s, i, t = 0) { const T = tabOf(s, t); const it = T.items[i] || null; if (it) T.items[i] = null; return it; }
/** move a stash item (to another tab / slot); swaps when the target slot is taken. True on success. */
export function stashMove(s, t, i, t2, i2 = -1) {
  const A = tabOf(s, t), B = tabOf(s, t2), it = A.items[i]; if (!it) return false;
  if (Number.isInteger(i2) && i2 >= 0 && i2 < STASH_SIZE) { const o = B.items[i2]; B.items[i2] = it; A.items[i] = o || null; return true; }
  const j = B.items.indexOf(null); if (j < 0) return false; B.items[j] = it; A.items[i] = null; return true;
}
/** items used / capacity */
export const stashCount = (s) => s.tabs.reduce((a, T) => a + T.items.filter(Boolean).length, 0);
export const stashCap = (s) => s.tabs.length * STASH_SIZE;
export const stashFree = (s) => stashCap(s) - stashCount(s);
/** grow a stash to n tabs (game loop B2: account Lv 27 / 30). True if it grew. */
export function growStash(s, n) { n = Math.min(STASH_TABS_MAX, n | 0); if (s.tabs.length >= n) return false; while (s.tabs.length < n) { const t = s.tabs.length; s.tabs.push({ name: STASH_TAB_NAMES[t] || `Tab ${t + 1}`, items: Array(STASH_SIZE).fill(null) }); } return true; }
export function renameStashTab(s, t, name) { const T = tabOf(s, t); T.name = cleanTab(name, s.tabs.indexOf(T)); return T.name; }
/** compact a tab: items packed to the front, best first (rarity, then power-ish: tier, then name) */
export function sortStashTab(s, t, key = (a, b) => (b.rarity | 0) - (a.rarity | 0) || itemLevel(b) - itemLevel(a) || (b.tier | 0) - (a.tier | 0) || String(a.slot).localeCompare(String(b.slot))) {
  const T = tabOf(s, t), list = T.items.filter(Boolean).sort(key);
  for (let i = 0; i < STASH_SIZE; i++) T.items[i] = list[i] || null;
}

// ------------------------------------------------------------------ the DPS meter (pure: feed it hits with a time in seconds)
export class DpsMeter {
  constructor(idle = 4) { this.idle = idle; this.reset(); this.best = 0; }
  reset() { this.done = false; this.t0 = 0; this.t1 = 0; this.total = 0; this.hits = 0; this.big = 0; this.crits = 0; }
  add(t, amount, crit = false) {
    if (this.hits && t - this.t1 > this.idle) this.reset(); // a pause starts a new parse
    if (this.win && this.hits && t - this.t0 >= this.win) { this.done = true; return; } // fixed parse window (Training Dummy menu): the parse is over, it freezes until a pause
    if (!this.hits) this.t0 = t;
    this.t1 = t; this.total += amount; this.hits++; if (crit) this.crits++; if (amount > this.big) this.big = amount;
    const d = this.dps(); if (this.secs() >= 3 && d > this.best) this.best = d;
  }
  /** fight length: first hit to last hit, at least 1 s (so one hit is not "infinite" dps) */
  secs() { return this.hits ? Math.max(1, this.t1 - this.t0) : 0; }
  /** fixed parse window in s (0 = auto: only a pause ends it) */
  setWindow(s) { this.win = s > 0 ? s : 0; }
  dps() { return this.hits ? this.total / this.secs() : 0; }
  active(t) { return this.hits > 0 && t - this.t1 <= this.idle; }
}

// ------------------------------------------------------------------ co-op ready-up
/** { n, of, all } over the party (roster rows with .ready) */
export function readyCount(rows) { const n = rows.filter((r) => r.ready).length; return { n, of: rows.length, all: rows.length > 0 && n === rows.length }; }
