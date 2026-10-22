// The central menu hub (step 2 of the 4-step overhaul): pure tab state + key routing, shared by the solo and co-op
// clients (client/menuhub.js draws it) and unit-tested without a DOM. Tabs across the top: Character, World Map,
// Forge, Chains, Collection, Stash (step 4), Options. TAB / I opens it on Character; the old direct keys open their own tab (J map,
// U forge, P / L collection); Q / E cycle tabs only while the hub is open; Esc (or the key of the open tab) closes it.

export const HUB_TABS = [
  { id: 'character', label: 'Character' },
  { id: 'heroes', label: 'Heroes' }, // 2026-10-07: the roster - ten named heroes, instant swap (client/hubheroes.js)
  { id: 'map', label: 'World Map' },
  { id: 'forge', label: 'Forge' },
  { id: 'chains', label: 'Chains' },
  { id: 'collection', label: 'Collection' },
  { id: 'stash', label: 'Stash' }, // step 4: the shared stash + auto-salvage rules (client/hubstash.js)
  { id: 'options', label: 'Options' },
];
export const HUB_TAB_IDS = HUB_TABS.map((t) => t.id);
/** keybind action -> [tab, sub-tab] (the old separate windows now open their tab of the hub) */
export const HUB_KEYS = { inventory: ['character'], realmMap: ['map', 'gate'], forge: ['forge'], progress: ['collection', 'account'], journal: ['collection', 'journal'], combos: ['chains'] };
/** actions that open the hub from the game (combos stays the in-combat chain list toggle while the hub is closed) */
export const HUB_OPENERS = new Set(['inventory', 'realmMap', 'forge', 'progress', 'journal']);
/** loadout preset buttons on the Character tab (step 4: sim/loadout.js LO_N) */
export const LOADOUTS = 7;

/**
 * The 10-slot gear layout (step 3 adds the missing slots). `live` = the equipment key that exists today (or null:
 * drawn as a locked placeholder). Left column: weapon + trinkets; right column: armor + accessories.
 */
export const GEAR_LAYOUT = {
  left: [
    { id: 'weapon', label: 'Weapon', live: 'weapon' },
    { id: 'offhand', label: 'Off-hand', live: 'offhand' },
    { id: 'ring1', label: 'Ring', live: 'ring' },
    { id: 'ring2', label: 'Ring II', live: 'ring2' },
    { id: 'relic', label: 'Relic', live: 'relic' },
  ],
  right: [
    { id: 'helm', label: 'Helm', live: 'helm' },
    { id: 'chest', label: 'Chest', live: 'armor' },
    { id: 'gloves', label: 'Gloves', live: 'gloves' },
    { id: 'boots', label: 'Boots', live: 'boots' },
    { id: 'amulet', label: 'Amulet', live: 'amulet' },
  ],
};
export const GEAR_SLOTS = [...GEAR_LAYOUT.left, ...GEAR_LAYOUT.right];

export class HubState {
  constructor() { this.open = false; this.tab = 'character'; this.sub = { map: null, collection: 'account', stash: 'stash', heroes: 'level' }; }
  /** open on a tab (or keep the last one); returns the tab */
  show(tab = null, sub = null) {
    if (tab && HUB_TAB_IDS.includes(tab)) this.tab = tab;
    if (sub && this.tab in this.sub) this.sub[this.tab] = sub;
    this.open = true; return this.tab;
  }
  hide() { this.open = false; }
  /** step through the tabs (wraps); only while open */
  cycle(d) {
    if (!this.open) return this.tab;
    const i = HUB_TAB_IDS.indexOf(this.tab), n = HUB_TAB_IDS.length;
    this.tab = HUB_TAB_IDS[(((i + (d < 0 ? -1 : 1)) % n) + n) % n];
    return this.tab;
  }
  /**
   * A keybind action pressed: what the hub does with it. Closed: an opener opens its tab ('open'). Open: the key of
   * the tab already shown closes the hub ('close'), another hub key switches tab ('tab'); anything else is ignored.
   * 'menu' (Esc) closes an open hub.
   */
  key(action) {
    if (action === 'menu') { if (!this.open) return null; this.hide(); return 'close'; }
    const k = HUB_KEYS[action]; if (!k) return null;
    if (!this.open) { if (!HUB_OPENERS.has(action)) return null; this.show(k[0], k[1]); return 'open'; }
    if (this.tab === k[0] && (!k[1] || this.sub[this.tab] === k[1] || action === 'combos')) { this.hide(); return 'close'; }
    this.show(k[0], k[1]); return 'tab';
  }
}

/** Does the game pause while the hub is open? Solo yes; co-op keeps running (the world is shared). */
export const hubPauses = (coop) => !coop;
