// Bag size on the client (inventory pass): the account-wide profile decides how many bag slots a hero may have
// (sim/bagsize.js: 64 + account level + future sources, cap 128). Every game mode asks for those slots before it adds
// the hero and then every couple of seconds (an account level-up mid-run grows the bag at once; it never shrinks).
import { bagInfo, bagSlots, nextUnlockText } from '../sim/bagsize.js';
import { accountLevel, PROFILE_KEY } from '../sim/meta.js';

export function readProfile() { try { return typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null') : null; } catch { return null; } }
export const bagCtx = (pr = readProfile()) => ({ accLevel: pr ? accountLevel(pr.accXp | 0).level : 1, profile: pr });
/** slots this account allows a hero right now */
export const profileBagSlots = (pr) => bagSlots(bagCtx(pr));
/** "23/64 — +4 at Account Lv 5" (used / size — the next unlock) */
export function bagHeader(inv, pr) { const used = inv.filter(Boolean).length; return `${used}/${inv.length} — ${nextUnlockText(bagInfo(bagCtx(pr)))}`; }
/** the tooltip on the header: where the slots come from */
export function bagBreakdown(pr) { const i = bagInfo(bagCtx(pr)); return [`Base ${i.base}`, ...i.parts.map((p) => `${p.label} +${p.slots}`)].join(' · ') + ` (max ${i.max})`; }
/** a game mode's bag sync: give the char its slots before the hero is added; ask the sim for more when the account grows */
export function seedBag(char, pr) { if (char) char.bagSize = Math.max(char.bagSize | 0, profileBagSlots(pr)); return char; }
export function syncBag(game, p, pr) { if (!p || !p.inventory) return; const want = profileBagSlots(pr); if (want > p.inventory.length && game._bagAsk !== want) { game._bagAsk = want; game.command({ type: 'bagSize', n: want }); } else if (want <= p.inventory.length) game._bagAsk = 0; }
