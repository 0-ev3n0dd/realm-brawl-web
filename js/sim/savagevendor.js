// Part 0S: Dorrik's Savage counter (the Quartermaster's Savage tab, client/village.js). Savage Marks (meta.js material
// 'savage_mark': 1 a clear, +4 on the first clear of the week) buy Savage gear of the boss's family at the Savage coffer's level:
//   a Savage weapon (16 Marks), or a Savage piece of a slot you pick (8 Marks). Pure: profile + rng in, the item (or why not) out.
import { SAVAGE_REWARD } from './savage.js';
import { makeExotic, EXOTIC_SLOTS } from './exotic.js';
import { withLootLevel } from './loot.js';

/** what the counter sells: one family per built Savage (Neferakh: Black Sun) */
export const SAVAGE_STOCK = [
  { id: 'nf:weapon', fam: 'blacksun', boss: 'Neferakh', slot: 'weapon', marks: SAVAGE_REWARD.weaponMarks, name: 'Savage Black Sun weapon' },
  { id: 'nf:piece', fam: 'blacksun', boss: 'Neferakh', slot: null, marks: SAVAGE_REWARD.pieceMarks, name: 'Savage Black Sun piece (pick the slot)' },
];
export const SAVAGE_PIECE_SLOTS = EXOTIC_SLOTS.filter((s) => s !== 'weapon');
export const marksOf = (pr) => ((pr && pr.mats && pr.mats.savage_mark) | 0);
/** buy: returns { item } or { why }. slot is required for a piece. Takes the Marks only when an item was made. */
export function buySavage(pr, id, cls, rng, slot = null, lv = SAVAGE_REWARD.coffer.lv) {
  const S = SAVAGE_STOCK.find((s) => s.id === id); if (!S) return { why: 'Dorrik has no such thing' };
  const sl = S.slot || slot; if (!S.slot && !SAVAGE_PIECE_SLOTS.includes(sl)) return { why: 'Pick a slot' };
  if (marksOf(pr) < S.marks) return { why: `Not enough Savage Marks (${marksOf(pr)} / ${S.marks})` };
  const it = withLootLevel(Math.max(lv | 0, SAVAGE_REWARD.coffer.lv), () => makeExotic(rng, S.fam, cls, sl));
  if (!it) return { why: 'Nothing to sell' };
  it.sv = 1; it.name = `Savage ${it.name}`;
  pr.mats.savage_mark = marksOf(pr) - S.marks;
  return { item: it };
}
