// Bag size (inventory pass): every hero starts with 64 bag slots; sources add more, up to BAG_MAX. Pure (no imports), so
// the sim, the save code, the server validator and every UI share it.
//   * account level (the only source today): +4 slots at every odd account level from Lv 3 to Lv 25 (+48 -> 112)
//   * the generic hook: BAG_SOURCES is a list of { id, label, slots(ctx), next?(ctx) }. Future sources (purchases, quests,
//     items, events) plug in with registerBagSource() or, without code, by granting `profile.bagGrants` entries
//     ({ id, slots, label }) which the built-in 'grants' source sums. The cap (BAG_MAX) keeps 16 slots of headroom above
//     the account-level maximum for them.
// ctx = { accLevel, profile } (profile may be null on the server: the server only clamps to [BAG_BASE, BAG_MAX]).
export const BAG_BASE = 64;
export const BAG_MAX = 128;
export const BAG_STEP = 4;
export const BAG_ACC = { first: 3, every: 2, last: 25, extra: [26, 28] }; // +BAG_STEP at Lv 3, 5, 7 ... 25 (+ game loop B2: Lv 26 and 28 -> 120)
export const bagFromAccount = (lv) => (lv < BAG_ACC.first ? 0 : BAG_STEP * (Math.floor((Math.min(lv, BAG_ACC.last) - BAG_ACC.first) / BAG_ACC.every) + 1)) + BAG_STEP * BAG_ACC.extra.filter((l) => lv >= l).length;
/** the next account level that adds slots (null past the last one) */
export const nextAccountUnlock = (lv) => { for (let l = Math.max(BAG_ACC.first, (lv | 0) + 1); l <= Math.max(BAG_ACC.last, ...BAG_ACC.extra); l++) if (bagFromAccount(l) > bagFromAccount(lv)) return { lv: l, add: bagFromAccount(l) - bagFromAccount(lv) }; return null; };

export const BAG_SOURCES = [
  { id: 'account', label: 'Account level', slots: (c) => bagFromAccount(c.accLevel | 0), next: (c) => { const n = nextAccountUnlock(c.accLevel | 0); return n ? { add: n.add, text: `Account Lv ${n.lv}` } : null; } },
  { id: 'grants', label: 'Rewards', slots: (c) => { let s = 0; for (const g of (c.profile && Array.isArray(c.profile.bagGrants) ? c.profile.bagGrants : [])) s += Math.max(0, Math.min(BAG_MAX, g && g.slots | 0)); return s; } },
];
/** plug in another source ({ id, label, slots(ctx), next?(ctx) }); replaces one with the same id */
export function registerBagSource(src) { const i = BAG_SOURCES.findIndex((s) => s.id === src.id); if (i >= 0) BAG_SOURCES[i] = src; else BAG_SOURCES.push(src); return BAG_SOURCES; }
export const clampBag = (n) => Math.max(BAG_BASE, Math.min(BAG_MAX, (n | 0) || BAG_BASE));
/** slots for a hero: 64 + every source, capped */
export function bagSlots(ctx = {}) { let n = BAG_BASE; for (const s of BAG_SOURCES) { try { n += Math.max(0, s.slots(ctx) | 0); } catch { /* a broken source adds nothing */ } } return Math.min(BAG_MAX, n); }
/** a per-source breakdown + the next unlock (for the bag header / tooltip) */
export function bagInfo(ctx = {}) {
  const parts = BAG_SOURCES.map((s) => { let v = 0; try { v = Math.max(0, s.slots(ctx) | 0); } catch { /* none */ } return { id: s.id, label: s.label, slots: v }; }).filter((x) => x.slots > 0);
  const total = bagSlots(ctx); let next = null;
  if (total < BAG_MAX) for (const s of BAG_SOURCES) { if (!s.next) continue; let n = null; try { n = s.next(ctx); } catch { /* none */ } if (n) { next = { add: Math.min(n.add, BAG_MAX - total), text: n.text, source: s.id }; break; } }
  return { total, base: BAG_BASE, max: BAG_MAX, parts, next };
}
/** "+4 at Account Lv 7" / "max size" / "" */
export const nextUnlockText = (info) => (info.next ? `+${info.next.add} at ${info.next.text}` : info.total >= BAG_MAX ? 'max size' : 'account bonus maxed');
/** resize a bag array in place to n slots: grows with nulls; shrinks only over empty trailing slots (never loses items) */
export function resizeBag(inv, n) {
  n = clampBag(n);
  while (inv.length < n) inv.push(null);
  while (inv.length > n && inv[inv.length - 1] == null) inv.pop();
  return inv.length;
}
