// Ascension Test save (2026-10-18): a second, separate save on this device for trying the Ascension Altar, without
// touching the real one. Options > Account > "Ascension Test save" switches (the page reloads); the inline script at the
// top of index.html / mobile/index.html (SLOT_SCRIPT below, kept identical there by test/asctestsave.test.js) then
// redirects every account key 'realmbrawl.X' to 'rbtest:realmbrawl.X' in localStorage, so nothing the game reads or
// writes in the test save can reach the main keys. Device prefs (keybinds, graphics, audio, phone settings) are shared.
// First entry seeds it: all 10 heroes unlocked at Lv 50 with full legendary-ish gear, every gate / boss clear incl.
// Vorthax, Astrael and Astrael Savage, a Core + Body + Soul set for every hero twice over, materials + gold for every
// hero's ascension, and the cinematics unseen. Seed v2 (Part C): Brakka starts Ascended (A1), which unlocks the Astral
// World (Realm Gate map: Normal / Astral); the other nine still have their duel to test. Seed v3 (Part D): enough for every
// hero to climb to A5, Brakka at A1 (next: the A2 duel), the Mage at A4 (the A3 variant + both boosts; next: the A5 duel). "Reset test save" wipes only the rbtest: keys and seeds it fresh.
import { ensureHeroes, HERO_IDS } from '../sim/heroes.js';
import { SAVE_KEY } from '../sim/save.js';
import { SLOTS } from '../sim/data/items.js';
import { generateItem } from '../sim/loot.js';
import { Rng } from '../sim/rng.js';
import { PROFILE_KEY, migrateProfile } from '../sim/meta.js';
import { xpToNext, MAX_LEVEL } from '../sim/progression.js';
import { UNLOCK_KEYS } from '../sim/hub.js';
import { migrateHeroUnlocks } from '../sim/heroUnlock.js';
import { ASC, PIECES, ascOf, rankCost } from '../sim/ascension.js';
import { RANK_MAX, rankKey } from '../sim/ascended.js';
import { recordPhase } from '../sim/practice.js'; // Part E: practice records

export const SLOT_KEY = 'rb.saveSlot', TEST = 'asctest', PREFIX = 'rbtest:';
export const MOBILE_SAVE = 'realmbrawl.mobile.save', MOBILE_UNLOCKS = 'realmbrawl.mobile.unlocks';
/** the inline <head> script (runs before any module): the key redirect while the test save is on */
export const SLOT_SCRIPT = `<script>/* Ascension Test save (client/asctest.js) */(function(){try{var L=window.localStorage,P=Storage.prototype,g=P.getItem,s=P.setItem,r=P.removeItem;if(g.call(L,'${SLOT_KEY}')!=='${TEST}')return;var K=/^realmbrawl\\.(keybinds|quality|perf|mobile\\.settings)/,m=function(t,k){return t===L&&typeof k==='string'&&k.indexOf('realmbrawl.')===0&&!K.test(k)?'${PREFIX}'+k:k};P.getItem=function(k){return g.call(this,m(this,k))};P.setItem=function(k,v){return s.call(this,m(this,k),v)};P.removeItem=function(k){return r.call(this,m(this,k))};window.__rbSlot='${TEST}'}catch(e){}})();</script>`;
export const testActive = () => typeof window !== 'undefined' && window.__rbSlot === TEST;

/** seed a (test) storage: pure on `storage` (a Storage-like {getItem,setItem}); idempotent via the seeded flag */
export const SEED_V = 6; // v6 (Part F): the Ultimate open but NOT cleared (no 'ultc', so the first clear + its prestige rewards can be tested) and a practice record to phase 3 · v5 (Part E): practice records (some encounters part-way, so locked phases show) · v2 (Part C): Brakka starts Ascended, so the Astral World is unlocked to test · v3 (Part D): ranks A2-A5 · v4 (Part D3): a 3rd Ascended hero (the account perks + the 3-hero milestone)
export const SEED_RANKS = { warrior: 1, mage: 4, ranger: 1 }; // (v3: Brakka at A1 -> the A2 duel; the Mage at A4 -> the A3 variant, both boosts and the A5 duel)
/** v3: pieces, materials + gold for every hero to climb A1 -> A5 (twice over), and the rank flags set from the profile */
export function seedRanks(pr) {
  for (const c of HERO_IDS) { const a = ascOf(pr, c); if (!a) continue; if (SEED_RANKS[c] && a.rank < SEED_RANKS[c]) { a.rank = SEED_RANKS[c]; a.duel = Math.max(a.duel | 0, a.rank); }
    for (const k of PIECES) { let need = 0; for (let r = 1; r <= RANK_MAX; r++) need += rankCost(r)[k] | 0; a[k] = Math.max(a[k] | 0, need * 2); } }
  pr.mats = pr.mats || {}; const mats = {}; let gold = 0;
  for (let r = 1; r <= RANK_MAX; r++) { const C = rankCost(r); gold += C.gold; for (const [id, n] of Object.entries(C.mats)) mats[id] = (mats[id] | 0) + n; }
  for (const [id, n] of Object.entries(mats)) pr.mats[id] = Math.max(pr.mats[id] | 0, n * HERO_IDS.length * 2);
  pr.gold = Math.max(pr.gold | 0, gold * HERO_IDS.length * 2);
}
/** v5 (Part E): practice records as if from real attempts: a few bosses fully seen, a few only part-way (their later phases stay locked) */
export const SEED_PRAC = { hollow: 9, vharokt: 9, vharokx: 3, tomb: 9, crypt: 2, forge: 9, vorthax: 2, skaldrat: 3, skaldrax: 2, pyrrhext: 9, neferakht: 9, astrael: 3, 'astrael@a': 2, ultimate: 3 };
export function seedPractice(pr) { for (const [k, ph] of Object.entries(SEED_PRAC)) { recordPhase(pr, k, ph); const r = pr.prac[k]; if (r) r.n = Math.max(r.n | 0, 3); } return pr; }
/** the a1..a5 flags of an unlock record set exactly to the profile's ranks (the test save only: the v1 seed set every a1) */
export function rankFlags(u, pr) { for (const c of HERO_IDS) { const r = (ascOf(pr, c) || {}).rank | 0; for (let k = 1; k <= RANK_MAX; k++) u[rankKey(k, c)] = k <= r ? 1 : 0; } return u; }
function upgradeSeed(storage) {
  const v = +storage.getItem('realmbrawl.asctest.v') | 0; if (v >= SEED_V) return false;
  try { const pr = JSON.parse(storage.getItem(PROFILE_KEY) || 'null'); if (pr) {
    if (v < 2) { const a = ascOf(pr, 'warrior'); if (a && !(a.rank >= 1)) { a.rank = 1; a.duel = 1; } }
    if (v < 4) seedRanks(pr); // (idempotent: only raises ranks / tops up)
    if (v < 5) seedPractice(pr); // (only ever raises a record)
    if (v < 6) { recordPhase(pr, 'ultimate', 3); const r = pr.prac && pr.prac.ultimate; if (r) r.n = Math.max(r.n | 0, 3); }
    storage.setItem(PROFILE_KEY, JSON.stringify(pr));
    for (const key of ['realmbrawl.unlocks', MOBILE_UNLOCKS]) { let u = {}; try { u = JSON.parse(storage.getItem(key) || '{}') || {}; } catch { u = {}; } if (v < 6 && !(pr.ult && pr.ult.n > 0)) { u.ultc = 0; u.astxClear = 1; } storage.setItem(key, JSON.stringify(rankFlags(u, pr))); } // (v6: the seed's blanket 'ultc' is taken back unless a real clear was recorded)
  } } catch { /* */ }
  storage.setItem('realmbrawl.asctest.v', String(SEED_V)); return true;
}
export function seedAscTest(storage, now = Date.now()) {
  if (storage.getItem('realmbrawl.asctest.seeded')) { upgradeSeed(storage); return false; }
  for (const key of [SAVE_KEY, MOBILE_SAVE]) {
    ensureHeroes(storage, key, 4242);
    const d = JSON.parse(storage.getItem(key) || '{}');
    for (const c of d.characters || []) {
      const rng = new Rng(7000 + HERO_IDS.indexOf(c.cls));
      c.level = Math.min(50, MAX_LEVEL); c.xp = 0; c.equipment = {};
      for (const slot of SLOTS) c.equipment[slot] = generateItem(rng, { tier: 4, cls: c.cls, slot, rarity: 3 });
    }
    storage.setItem(key, JSON.stringify(d));
  }
  const all = Object.fromEntries(UNLOCK_KEYS.map((k) => [k, k === 'ultc' || /^[a-z]{2}sc$/.test(k) ? 0 : 1])); // (Part 0S: no Savage cleared either) // (Part F: the Ultimate open, not cleared)
  storage.setItem('realmbrawl.unlocks', JSON.stringify(all)); storage.setItem(MOBILE_UNLOCKS, JSON.stringify(all));
  const chars = JSON.parse(storage.getItem(SAVE_KEY)).characters;
  const pr = migrateProfile(null, chars, xpToNext);
  const U = migrateHeroUnlocks(pr, chars, now); U.picked = 'warrior'; for (const c of HERO_IDS) U.by[c] = { state: 'unlocked', via: 'grant', at: now, prog: {} };
  for (const c of HERO_IDS) { const a = ascOf(pr, c); for (const k of PIECES) a[k] = ASC.cost[k] * 2; a.rank = 0; }
  pr.mats = pr.mats || {}; for (const [id, n] of Object.entries(ASC.cost.mats)) pr.mats[id] = n * HERO_IDS.length * 2;
  pr.gold = ASC.cost.gold * HERO_IDS.length * 2;
  storage.setItem(PROFILE_KEY, JSON.stringify(pr));
  storage.setItem('realmbrawl.profileName', 'Ascension Test');
  storage.setItem('realmbrawl.asctest.seeded', String(now)); upgradeSeed(storage);
  return true;
}
/** boot (main.js, before the save is read): seed the test save on first entry + show the TEST SAVE tag */
export function bootAscTest() {
  if (!testActive()) return false;
  try { seedAscTest(window.localStorage); } catch (e) { console.warn('asctest seed', e); }
  if (typeof document !== 'undefined') {
    const put = () => { if (document.getElementById('ascTestTag')) return; const t = document.createElement('div'); t.id = 'ascTestTag'; t.textContent = 'ASCENSION TEST SAVE';
      t.style.cssText = 'position:fixed;top:4px;left:50%;transform:translateX(-50%);z-index:9050;pointer-events:none;font:13px "Lilita One",sans-serif;letter-spacing:1px;color:#1a0f24;background:#ffd23f;border:2px solid #2b2433;border-radius:8px;padding:2px 10px;opacity:.9';
      document.body.appendChild(t); };
    if (document.body) put(); else addEventListener('DOMContentLoaded', put);
  }
  return true;
}
/** switch save (reloads). on = the test save */
export function switchSave(on) { try { Storage.prototype.setItem.call(window.localStorage, SLOT_KEY, on ? TEST : 'main'); } catch { /* storage off */ } location.reload(); }
/** wipe only the test save (every rbtest: key), then reload into a fresh seed */
export function resetAscTest(storage = typeof localStorage !== 'undefined' ? localStorage : null, reload = true) {
  if (!storage) return 0; const ks = []; for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && k.startsWith(PREFIX)) ks.push(k); }
  for (const k of ks) storage.removeItem(k); // (rbtest: keys are never redirected: removeItem hits them as-is)
  if (reload && typeof location !== 'undefined') location.reload(); return ks.length;
}
