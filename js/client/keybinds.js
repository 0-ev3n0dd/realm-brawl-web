// Desktop key bindings: every rebindable action, its default keys/mouse buttons (up to 3 slots each), human labels,
// conflict handling (binding a code that another action uses swaps them) and localStorage persistence.
// Two profiles (2026-10-06): 'mouse' (Mouse + Keyboard, the default: `def`) and 'keyboard' (Keyboard only: `kb` where it
// differs - basic attack on J / Space, Dodge on K / Shift, Cycle target on L / B, World Map on Y, Journal on O), each saved
// on its own so switching the Control mode never scrambles the other one.
// Codes are KeyboardEvent.code values ('KeyQ', 'ShiftLeft', 'Space', ...) or 'Mouse0'..'Mouse4' for mouse buttons.
// Pure module (no DOM): the storage is injected so it can be unit-tested; the phone version never uses it.

export const ACTIONS = [
  { id: 'up', label: 'Move up', group: 'Movement', def: ['KeyW', 'ArrowUp'] },
  { id: 'down', label: 'Move down', group: 'Movement', def: ['KeyS', 'ArrowDown'] },
  { id: 'left', label: 'Move left', group: 'Movement', def: ['KeyA', 'ArrowLeft'] },
  { id: 'right', label: 'Move right', group: 'Movement', def: ['KeyD', 'ArrowRight'] },
  { id: 'sprint', label: 'Sprint (toggle; out of combat only, ends when you fight)', group: 'Movement', def: ['CapsLock'] }, // (2026-10-19)
  { id: 'attack', label: 'Basic attack (combo)', group: 'Combat', def: ['Mouse0'], kb: ['KeyJ', 'Space'] },
  { id: 'skillQ', label: 'Skill 1 (Q slot)', group: 'Combat', def: ['KeyQ'], skill: 'Q' },
  { id: 'skillE', label: 'Skill 2 (E slot)', group: 'Combat', def: ['KeyE'], skill: 'E' },
  { id: 'skillR', label: 'Skill 3 (R slot)', group: 'Combat', def: ['KeyR'], skill: 'R' },
  { id: 'skillF', label: 'Skill 4 (4th slot)', group: 'Combat', def: ['KeyV'], skill: 'F' }, // (F -> G when the Special took F; G -> V on 2026-10-09 when G became the World Map key)
  { id: 'special', label: 'Special skill', group: 'Combat', def: ['KeyF'], skill: 'SP' },
  { id: 'dodge', label: 'Dodge', group: 'Combat', def: ['ShiftLeft', 'Space', 'Mouse2'], kb: ['ShiftLeft', 'KeyK'] },
  { id: 'ult', label: 'Ultimate', group: 'Combat', def: ['KeyT'] },
  { id: 'clearLock', label: 'Clear target lock (hover lock-on / auto-target)', group: 'Combat', def: ['Mouse1', 'Backquote'], kb: ['Backquote'] },
  { id: 'cycleTarget', label: 'Cycle target (next enemy)', group: 'Combat', def: ['KeyB'], kb: ['KeyL', 'KeyB'] },
  { id: 'inventory', label: 'Menu hub (opens on Character / inventory)', group: 'Interface', def: ['Tab', 'KeyI'] },
  { id: 'combos', label: 'Chain combo list (HUD; Chains tab in the menu)', group: 'Interface', def: ['KeyC'] },
  { id: 'takeAll', label: 'Loot: take all', group: 'Interface', def: ['KeyZ'] },
  { id: 'mute', label: 'Mute sound', group: 'Interface', def: ['KeyM'] },
  { id: 'bigMap', label: 'Big map (whole zone; or click the minimap)', group: 'Interface', def: ['Comma'] },
  { id: 'chat', label: 'Chat (co-op)', group: 'Interface', def: ['Enter'] },
  { id: 'ping', label: 'Ping map (co-op)', group: 'Interface', def: ['KeyN'] }, // (V -> N on 2026-10-09: V is Skill 4 now)
  { id: 'interact', label: 'Interact (Mission Counter, villagers)', group: 'Interface', def: ['KeyX'] },
  { id: 'progress', label: 'Collection tab (account, bounties, records)', group: 'Interface', def: ['KeyP'] },
  { id: 'forge', label: 'Forge tab (upgrade and craft gear)', group: 'Interface', def: ['KeyU'] },
  { id: 'realmMap', label: 'World Map tab (opens on the Realm Gate map; again: close)', group: 'Interface', def: ['KeyG', 'KeyJ'], kb: ['KeyG', 'KeyY'] },
  { id: 'journal', label: 'Journal (story chain, Collection tab)', group: 'Interface', def: ['KeyL'], kb: ['KeyO'] },
  { id: 'potion', label: 'Drink a Health Potion', group: 'Combat', def: ['KeyH'] },
];
export const ACTION_IDS = ACTIONS.map((a) => a.id);
export const SLOTS = 3;
/** Escape always opens/closes the menu (and cancels a rebind), so it can never be bound. */
export const RESERVED = new Set(['Escape']);
export const STORAGE_KEY = 'realmbrawl.keybinds.v1';
export const KB_STORAGE_KEY = 'realmbrawl.keybinds.kb.v1'; // (the Keyboard-only profile)
export const MODES = ['mouse', 'keyboard'];
const modeOf = (m) => (m === 'keyboard' ? 'keyboard' : 'mouse');
export const storageKey = (mode) => (modeOf(mode) === 'keyboard' ? KB_STORAGE_KEY : STORAGE_KEY);
const byId = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

/** Left/right variants of modifiers count as the same key. */
export function normalize(code) {
  if (typeof code !== 'string') return '';
  if (code === 'ShiftRight') return 'ShiftLeft';
  if (code === 'ControlRight') return 'ControlLeft';
  if (code === 'AltRight') return 'AltLeft';
  if (code === 'MetaRight') return 'MetaLeft';
  return code;
}

const NAMED = {
  Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'M4', Mouse4: 'M5',
  ShiftLeft: 'SHIFT', ControlLeft: 'CTRL', AltLeft: 'ALT', MetaLeft: 'META', Space: 'SPACE', Enter: 'ENTER', Tab: 'TAB',
  CapsLock: 'CAPS', Backspace: 'BKSP', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
  Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Delete: 'DEL', Insert: 'INS',
  Home: 'HOME', End: 'END', PageUp: 'PGUP', PageDown: 'PGDN', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};
/** Short human label for a code: 'KeyQ' -> 'Q', 'Digit1' -> '1', 'Mouse2' -> 'RMB', 'Numpad4' -> 'NUM4'. */
export function codeLabel(code) {
  code = normalize(code);
  if (!code) return '—';
  if (NAMED[code]) return NAMED[code];
  let m;
  if ((m = /^Key([A-Z])$/.exec(code))) return m[1];
  if ((m = /^Digit(\d)$/.exec(code))) return m[1];
  if ((m = /^Numpad(.+)$/.exec(code))) return 'NUM' + (m[1].length > 3 ? m[1].slice(0, 3).toUpperCase() : m[1]);
  if (/^F\d{1,2}$/.test(code)) return code;
  return code.replace(/(Left|Right)$/, '').slice(0, 6).toUpperCase();
}

/** A code that can be bound (keyboard code or Mouse0-4; never Escape). */
export function validCode(code) {
  if (typeof code !== 'string' || !code || code.length > 24) return false;
  if (RESERVED.has(code)) return false;
  if (/^Mouse\d+$/.test(code)) return /^Mouse[0-4]$/.test(code);
  return /^[A-Za-z][A-Za-z0-9]*$/.test(code);
}

/** Defaults of a profile: 'mouse' (Mouse + Keyboard) or 'keyboard' (Keyboard only). */
export const defaultBinds = (mode = 'mouse') => Object.fromEntries(ACTIONS.map((a) => [a.id, (modeOf(mode) === 'keyboard' && a.kb ? a.kb : a.def).slice()]));
const defOf = (id, mode) => { const a = byId[id]; return modeOf(mode) === 'keyboard' && a.kb ? a.kb : a.def; };

export class Keybinds {
  constructor(storage = null, mode = 'mouse') {
    this.storage = storage;
    this.mode = modeOf(mode);
    this.binds = defaultBinds(this.mode);
    this.listeners = new Set();
    this.load();
  }
  /** Load saved bindings (invalid/unknown entries fall back to defaults; e.g. the removed Warrior stance keys are just ignored). */
  load() {
    this.binds = defaultBinds(this.mode);
    let raw = null;
    try { raw = this.storage && this.storage.getItem(storageKey(this.mode)); } catch { raw = null; }
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch { return; }
    if (!data || data.v !== 1 || typeof data.binds !== 'object') return;
    if (this.mode === 'mouse' && !Array.isArray(data.binds.special)) migrateSpecial(data.binds);
    if (!data.gmap) migrateGMap(data.binds, this.mode);
    const seen = new Set();
    for (const id of ACTION_IDS) {
      const list = data.binds[id];
      if (!Array.isArray(list)) continue;
      const clean = [];
      for (const c of list.slice(0, SLOTS)) { const n = normalize(c); if (validCode(n) && !seen.has(n)) { clean.push(n); seen.add(n); } }
      this.binds[id] = clean;
    }
    // a code saved for two actions is kept only once (first wins); defaults for actions missing from the save
    for (const id of ACTION_IDS) if (!Array.isArray(data.binds[id])) this.binds[id] = defOf(id, this.mode).filter((c) => { if (seen.has(c)) return false; seen.add(c); return true; });
  }
  save() {
    try { this.storage && this.storage.setItem(storageKey(this.mode), JSON.stringify({ v: 1, gmap: 1, binds: this.binds })); } catch { /* private mode / quota: keep in memory */ }
    for (const f of this.listeners) f(this);
  }
  onChange(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
  /** Switch the profile (Options > Controls > Control mode): loads that profile's saved keys (or its defaults). */
  setMode(mode) { const m = modeOf(mode); if (m === this.mode) return false; this.mode = m; this.load(); for (const f of this.listeners) f(this); return true; }
  /** Codes bound to an action. */
  codes(id) { return this.binds[id] || []; }
  /** The action bound to a code (or null). */
  actionFor(code) {
    const n = normalize(code);
    for (const id of ACTION_IDS) if (this.binds[id].includes(n)) return id;
    return null;
  }
  matches(id, code) { return this.codes(id).includes(normalize(code)); }
  /** Is any of the action's codes in the pressed set (a Set of normalized codes)? */
  held(id, pressed) { return this.codes(id).some((c) => pressed.has(c)); }
  /** HUD label: the first bound code (or '—' when unbound). */
  label(id) { return codeLabel(this.codes(id)[0]); }
  /** All labels joined, e.g. 'SHIFT / SPACE / RMB'. */
  labels(id) { const c = this.codes(id); return c.length ? c.map(codeLabel).join(' / ') : '—'; }
  /**
   * Bind `code` to slot `slot` of action `id`. If another action (or another slot) already uses it, the two swap:
   * the other one gets this slot's previous code (or loses that binding if there was none).
   * Returns { ok, conflict: {action, slot} | null, swapped: code | null, unbound: actionId | null, error }.
   */
  set(id, slot, code) {
    if (!byId[id]) return { ok: false, error: 'unknown action' };
    const n = normalize(code);
    if (!validCode(n)) return { ok: false, error: RESERVED.has(n) ? `${codeLabel(n)} is reserved for the menu` : 'invalid key' };
    slot = Math.max(0, Math.min(SLOTS - 1, slot | 0));
    const list = this.binds[id].slice();
    const prev = list[slot] || null;
    if (prev === n) return { ok: true, conflict: null, swapped: null, unbound: null };
    let conflict = null, swapped = null, unbound = null;
    for (const other of ACTION_IDS) {
      const ol = this.binds[other];
      const j = ol.indexOf(n);
      if (j < 0) continue;
      if (other === id) { // same action, other slot: just move it
        list.splice(j, 1, ...(prev ? [prev] : []));
        conflict = { action: id, slot: j };
        break;
      }
      conflict = { action: other, slot: j };
      const nl = ol.slice();
      if (prev) { nl[j] = prev; swapped = prev; } else nl.splice(j, 1);
      this.binds[other] = nl;
      if (!nl.length) unbound = other;
      break;
    }
    const idx = list.indexOf(n);
    if (idx >= 0 && idx !== slot) list.splice(idx, 1);
    if (slot < list.length) list[slot] = n; else list.push(n);
    this.binds[id] = dedupe(list).slice(0, SLOTS);
    this.save();
    return { ok: true, conflict, swapped, unbound };
  }
  /** Clear one slot (the last binding of an action can be cleared too; the UI warns). */
  clear(id, slot) {
    if (!byId[id]) return false;
    const list = this.binds[id].slice();
    if (slot < 0 || slot >= list.length) return false;
    list.splice(slot, 1);
    this.binds[id] = list;
    this.save();
    return true;
  }
  reset() { this.binds = defaultBinds(this.mode); this.save(); }
  /** Actions with no binding at all (the options menu shows a warning). */
  unbound() { return ACTION_IDS.filter((id) => !this.binds[id].length); }
  isDefault() { const d = defaultBinds(this.mode); return ACTION_IDS.every((id) => JSON.stringify(d[id]) === JSON.stringify(this.binds[id])); }
  /** Human description of a set() result for the options menu. */
  describe(id, code, r) {
    if (!r.ok) return r.error;
    const L = (a) => byId[a].label, K = codeLabel(code);
    if (!r.conflict || r.conflict.action === id) return `${L(id)}: ${K}`;
    if (r.swapped) return `${K} was used by "${L(r.conflict.action)}" — swapped: it is now ${codeLabel(r.swapped)}.`;
    return `${K} was used by "${L(r.conflict.action)}" — moved here.` + (r.unbound ? ` "${L(r.unbound)}" is now UNBOUND.` : '');
  }
}
/** Saves from before the Special: F becomes the Special (the old 4th skill moves to G, loot take-all from G to Z) unless the
 *  player bound F to something else on purpose; custom keys are kept. */
function migrateSpecial(b) {
  const holder = Object.keys(b).find((id) => Array.isArray(b[id]) && b[id].includes('KeyF'));
  if (holder && holder !== 'skillF') { b.special = []; return; } // F was bound to another action on purpose: the Special starts unbound (Options warns)
  if (Array.isArray(b.skillF)) {
    b.skillF = b.skillF.filter((c) => c !== 'KeyF');
    if (!b.skillF.length) {
      if (Array.isArray(b.takeAll) && b.takeAll.includes('KeyG')) b.takeAll = b.takeAll.filter((c) => c !== 'KeyG').concat(Object.values(b).some((l) => Array.isArray(l) && l.includes('KeyZ')) ? [] : ['KeyZ']);
      if (!Object.values(b).some((l) => Array.isArray(l) && l.includes('KeyG'))) b.skillF = ['KeyG'];
    }
  }
  b.special = ['KeyF'];
}
/** Saves from before 2026-10-09: G becomes the World Map key. Skill 4 moves from G to V (and the co-op ping from V to N,
 *  N leaving Mute's second slot) unless the player put those keys on something else on purpose; custom keys are kept. */
export function migrateGMap(b, mode = 'mouse') {
  const has = (id, c) => Array.isArray(b[id]) && b[id].includes(c);
  const owner = (c) => Object.keys(b).find((id) => has(id, c));
  if (owner('KeyG') && owner('KeyG') !== 'skillF') return; // G was put on another action on purpose: leave it (the World Map keeps J / Y)
  if (has('skillF', 'KeyG')) {
    const vOwner = owner('KeyV');
    if (vOwner === 'ping') { // the old default: ping moves to N
      const nOwner = owner('KeyN');
      if (!nOwner || nOwner === 'mute') { if (nOwner === 'mute') { b.mute = b.mute.filter((c) => c !== 'KeyN'); if (!b.mute.length) b.mute = ['KeyM']; } b.ping = b.ping.map((c) => (c === 'KeyV' ? 'KeyN' : c)); }
      else b.ping = b.ping.filter((c) => c !== 'KeyV');
    }
    b.skillF = owner('KeyV') ? b.skillF.filter((c) => c !== 'KeyG') : b.skillF.map((c) => (c === 'KeyG' ? 'KeyV' : c));
  }
  const rm = Array.isArray(b.realmMap) ? b.realmMap : (mode === 'keyboard' ? ['KeyY'] : ['KeyJ']);
  b.realmMap = ['KeyG', ...rm.filter((c) => c !== 'KeyG')].slice(0, SLOTS);
}
function dedupe(list) { const out = []; for (const c of list) if (c && !out.includes(c)) out.push(c); return out; }
/** Label for a chain step ('Q', 'B2', 'BS', 'F+') using the current bindings. */
export function chainStepLabel(kb, key) {
  if (/^B\d$/.test(key)) return kb.label('attack') + key.slice(1);
  if (key === 'BS') return kb.label('attack') + '★';
  if (key === 'F+') return kb.label('skillF') + '✓';
  if (key === 'SP') return kb.label('special');
  if (/^[QERF]$/.test(key)) return kb.label('skill' + key);
  return key;
}
