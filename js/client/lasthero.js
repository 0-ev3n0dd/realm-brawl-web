// Last-played hero (the title screen shows them on launch) + the profile name shown top-right of the title.
// Pure: the storage (localStorage or a test double) and the save store are passed in.
export const LAST_HERO_KEY = 'realmbrawl.lastHero';
export const PROFILE_NAME_KEY = 'realmbrawl.profileName';
const ACCT_PROFILE_KEY = 'realmbrawl.profile';
import { validateAccountName, cleanAccountName } from '../sim/acctname.js';

/** remember the hero that just went into the game */
export function rememberHero(storage, ch) {
  if (!ch || !ch.id) return null;
  const rec = { id: ch.id, cls: ch.cls, name: ch.name, level: ch.level | 0, at: Date.now() };
  try { storage.setItem(LAST_HERO_KEY, JSON.stringify(rec)); } catch { /* private mode */ }
  return rec;
}
/** the saved record (or null) */
export function lastHeroRecord(storage) {
  try { const r = JSON.parse(storage.getItem(LAST_HERO_KEY) || 'null'); return r && typeof r.id === 'string' ? r : null; } catch { return null; }
}
/**
 * The hero to show on the title screen: the remembered one if it still exists, else the most recently played save,
 * else null (first launch: straight to hero creation).
 */
export function lastHero(store, storage, ok = null) {
  const list = ok ? store.list().filter((c) => ok(c.cls)) : store.list(); // (hero unlocks: never a locked hero on the title)
  if (!list.length) return null;
  const r = lastHeroRecord(storage);
  const hit = r && (list.find((c) => c.id === r.id) || list.filter((c) => c.cls === r.cls).sort((a, b) => (b.level | 0) - (a.level | 0))[0]); // (Heroes: a folded duplicate -> its class's hero)
  if (hit) return hit;
  return list.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
}
/** the account name (stored with the account / shared profile; the old profileName key is read for older saves), '' if none or invalid */
export function accountName(storage) {
  let n = '';
  try { n = storage.getItem(PROFILE_NAME_KEY) || ''; } catch { n = ''; }
  if (!n) { try { const pr = JSON.parse(storage.getItem(ACCT_PROFILE_KEY) || 'null'); n = (pr && pr.acctName) || ''; } catch { n = ''; } }
  return cleanAccountName(n);
}
/** does this account still need to pick a name? (first launch, or an older save that never had a valid one) */
export const needsAccountName = (storage) => !accountName(storage);
export function profileName(storage) { return accountName(storage) || 'Adventurer'; }
/** validate + store; returns { ok, name, err }. `prof` (the client profile object) gets the name too so its next save keeps it. */
export function setAccountName(storage, raw, prof = null) {
  const v = validateAccountName(raw); if (!v.ok) return v;
  try { storage.setItem(PROFILE_NAME_KEY, v.name); } catch { /* private mode */ }
  try { const pr = JSON.parse(storage.getItem(ACCT_PROFILE_KEY) || 'null'); if (pr && typeof pr === 'object') { pr.acctName = v.name; storage.setItem(ACCT_PROFILE_KEY, JSON.stringify(pr)); } } catch { /* none yet */ }
  if (prof && prof.data) prof.data.acctName = v.name;
  return v;
}
export function setProfileName(storage, name, prof = null) { const v = setAccountName(storage, name, prof); return v.ok ? v.name : profileName(storage); }
/** should the title screen show on this launch? (automation that drives the hero list keeps working unless it asks) */
export function wantTitle({ hero, webdriver = false, params = null } = {}) {
  if (!hero) return false;
  const q = params || new URLSearchParams('');
  if (q.has('notitle')) return false;
  if (q.has('title')) return true;
  return !webdriver;
}
