// Hero unlocks (2026-10-15): a new account starts with three starter heroes (Brakka, Sylva, Orin), picked on the starter
// selection screen; the other seven are locked ("Unlock coming soon") until the planned unlock system (Warframe / TFD-
// style: blueprints, parts, research) lands. Stored with the account (profile.heroUnlock), one entry per hero:
//   { v, picked, by: { <cls>: { state: 'unlocked' | 'locked', via: 'starter' | 'progress' | 'grant' | null, at, prog: {} } } }
//   prog = room for the future system's per-hero progress (parts / research); unused today.
// Only the picked starter unlocks. Existing saves: any hero with progress stays unlocked; a save with none gets the screen.
import { HERO_IDS } from './heroes.js';

export const UNLOCK_V = 2; // v2: only the picked starter unlocks (v1 gave all three)
export const STARTERS = ['warrior', 'ranger', 'mage'];
export const LOCKED_TEXT = 'Locked · craft it in the Heroes tab'; // (hero unlocks: sim/herocraft.js)
/** has this hero been played? (any level, xp, kill or mastery past a fresh level-1 hero) */
export const hasProgress = (ch) => !!ch && ((ch.level | 0) > 1 || (ch.xp | 0) > 0 || (ch.kills | 0) > 0 || (ch.mxp || 0) > 0);
const entry = (state, via = null, at = 0) => ({ state, via, at, prog: {} });

/** make sure the account has an unlock record (pure on pr: mutates + returns pr.heroUnlock). chars = the save's heroes. */
export function migrateHeroUnlocks(pr, chars = [], now = Date.now()) {
  const U = pr.heroUnlock && typeof pr.heroUnlock === 'object' && pr.heroUnlock.by ? pr.heroUnlock : null;
  if (U) {
    for (const c of HERO_IDS) if (!U.by[c]) U.by[c] = entry('locked'); // (a hero added in an update: locked)
    if ((U.v | 0) < 2) { // v1 -> v2: un-grant free starters that weren't picked and have no progress
      const played = new Set((chars || []).filter(hasProgress).map((ch) => ch.cls));
      for (const c of STARTERS) if (U.by[c].via === 'starter' && c !== U.picked && !played.has(c)) U.by[c] = entry('locked');
      U.v = UNLOCK_V;
    }
    return U;
  } // (a hero added in an update: locked)
  const by = {}; for (const c of HERO_IDS) by[c] = entry('locked');
  const played = (chars || []).filter(hasProgress);
  for (const ch of played) if (by[ch.cls]) by[ch.cls] = entry('unlocked', 'progress', now);
  const R = { v: UNLOCK_V, picked: null, by };
  if (played.length) { R.picked = played.slice().sort((a, b) => (b.level | 0) - (a.level | 0))[0].cls; }
  pr.heroUnlock = R;
  return R;
}
export const isUnlocked = (pr, cls) => !pr || !pr.heroUnlock || !pr.heroUnlock.by || (pr.heroUnlock.by[cls] && pr.heroUnlock.by[cls].state === 'unlocked');
/** a new account that still has to pick its starter */
export const needsStarter = (pr) => !!(pr && pr.heroUnlock && !pr.heroUnlock.picked && !HERO_IDS.some((c) => isUnlocked(pr, c)));
/** the starter screen's pick: only `cls` unlocks; the other two starters stay locked like the rest */
export function pickStarter(pr, cls, now = Date.now()) {
  if (!STARTERS.includes(cls)) return false;
  const U = migrateHeroUnlocks(pr, [], now);
  if (U.by[cls].state !== 'unlocked') U.by[cls] = entry('unlocked', 'starter', now);
  U.picked = cls; return true;
}
/** the future unlock system's hook: grant a hero (via = 'grant' or the system's own source) */
export function unlockHero(pr, cls, via = 'grant', now = Date.now()) {
  const U = migrateHeroUnlocks(pr, [], now); if (!U.by[cls]) return false;
  if (U.by[cls].state !== 'unlocked') U.by[cls] = { ...U.by[cls], state: 'unlocked', via, at: now };
  return true;
}
export const unlockedHeroes = (pr) => HERO_IDS.filter((c) => isUnlocked(pr, c));
