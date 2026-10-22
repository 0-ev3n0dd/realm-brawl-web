// Ascension (Part B of docs/ASCENSION-PLAN.md). Pure, like sim/herocraft.js. Every hero ascends on its own:
//   Core  - an Astral Core blueprint for that class, from Vorthax (the Rift Sanctum)
//   Body  - an Astral Body blueprint, from Astrael (Astral Trial); Astrael also pays Starsteel
//   Soul  - an Astral Soul, from Astrael Savage (astraelx; + Starheart), or the weekly guaranteed Soul (Weekly Board)
//   mats  - Astral Ash (Rift missions), Starsteel, Starheart; gold
//   then  - Lv 50 + the Shadow Duel won at the Ascension Altar -> rank 1 (Ascended, "A1")
// Drops are weighted to the hero you played (ASC.weight), the rest split evenly over the other heroes; each player
// rolls their own (client/rewards.js, so co-op loot stays per player). Nothing is ever taken back: pieces of an
// ascended hero stay usable as exchange fodder (3 surplus -> 1 missing piece of your choice, herocraft-style).
// State: profile.heroUnlock.by[cls].asc = { core, body, soul, rank, duel } (next to the unlock record).
// Part D: ranks A2-A5. Each next rank has its own price (ASC.ranks) and its own, harder Shadow Duel; the price is paid only
// when that duel is won. Ranks unlock in order; nothing ever lowers a rank.
import { HERO_IDS } from './heroes.js';
import { RANK_MAX, rankKey } from './ascended.js';
import { migrateHeroUnlocks } from './heroUnlock.js';

export const PIECES = ['core', 'body', 'soul'];
export const PIECE_NAME = { core: 'Astral Core', body: 'Astral Body', soul: 'Astral Soul' };
export const ASC = {
  weight: 0.5, // chance a dropped piece is for the hero you played (else an even split over the others)
  exchange: 3,
  level: 50,
  // drop sources: boss = enemy type (ex = Extreme / Savage flag), ops = mission clear on a map
  src: [
    { boss: 'raidboss', piece: 'core', p: 0.5, mats: { astral_ash: 4 } },
    { boss: 'astrael', ex: 0, piece: 'body', p: 0.5, mats: { starsteel: 2 } },
    { boss: 'astrael', ex: 1, piece: 'soul', p: 0.35, mats: { starsteel: 2, starheart: 1 } },
    { ops: 'rift', piece: null, p: 0, mats: { astral_ash: 3 }, extra: { starsteel: 0.3 } },
  ],
  cost: { core: 1, body: 1, soul: 1, mats: { astral_ash: 30, starsteel: 8, starheart: 3 }, gold: 25000 },
  weeklySoul: ['astrael', 'astraelx'], // a clear of either completes the weekly Soul row
  // Part D: the price of each next rank (A2 leans on Souls + Savage mats, A3 / A5 on a full set again)
  ranks: {
    2: { core: 0, body: 0, soul: 2, mats: { astral_ash: 40, starsteel: 12, starheart: 4, astral_heart: 1 }, gold: 40000 },
    3: { core: 1, body: 1, soul: 2, mats: { astral_ash: 50, starsteel: 16, starheart: 5, astral_dust: 30 }, gold: 55000 },
    4: { core: 0, body: 0, soul: 3, mats: { astral_ash: 60, starsteel: 20, starheart: 7, astral_heart: 2 }, gold: 70000 },
    5: { core: 2, body: 2, soul: 3, mats: { astral_ash: 80, starsteel: 25, starheart: 10, astral_dust: 60, astral_heart: 2 }, gold: 100000 },
  },
};
ASC.ranks[1] = ASC.cost;
/** the price of rank r (1..5) */
export const rankCost = (r) => ASC.ranks[r] || null;
export function ascOf(pr, cls) {
  const U = migrateHeroUnlocks(pr, []), e = U.by[cls]; if (!e) return null;
  const a = e.asc && typeof e.asc === 'object' ? e.asc : (e.asc = {});
  for (const k of PIECES) a[k] = a[k] | 0; a.rank = a.rank | 0; a.duel = a.duel | 0;
  return a;
}
export const rankOf = (pr, cls) => { const a = ascOf(pr, cls); return a ? a.rank : 0; };
/** which hero a dropped piece is for: the played hero at ASC.weight, else one of the others (rng 0..1) */
export function pickClass(played, rng = Math.random) {
  if (HERO_IDS.includes(played) && rng() < ASC.weight) return played;
  const others = HERO_IDS.filter((c) => c !== played);
  return others[Math.min(others.length - 1, Math.floor(rng() * others.length))];
}
/** roll one event's ascension drops: src = { boss, ex } | { ops }. Mutates pr; returns { pieces: [{cls,k}], mats: [{id,n}] } */
export function rollAscension(pr, src, played, rng = Math.random) {
  const out = { pieces: [], mats: [] };
  for (const s of ASC.src) {
    if (!((src.boss && s.boss === src.boss && (s.ex == null || s.ex === (src.ex ? 1 : 0))) || (src.ops && s.ops === src.ops))) continue;
    for (const [id, n] of Object.entries(s.mats || {})) out.mats.push({ id, n });
    for (const [id, p] of Object.entries(s.extra || {})) if (rng() < p) out.mats.push({ id, n: 1 });
    if (s.piece && rng() < s.p) { const cls = pickClass(played, rng); ascOf(pr, cls)[s.piece]++; out.pieces.push({ cls, k: s.piece }); }
  }
  pr.mats = pr.mats || {}; for (const m of out.mats) pr.mats[m.id] = (pr.mats[m.id] | 0) + m.n;
  return out;
}
/** grant one piece directly (the weekly Soul) */
export function grantPiece(pr, cls, k) { if (!PIECES.includes(k) || !HERO_IDS.includes(cls)) return false; ascOf(pr, cls)[k]++; return true; }
/** pieces a hero still needs for its next rank */
export function ascMissing(pr, cls) {
  const a = ascOf(pr, cls), out = { core: 0, body: 0, soul: 0 }; if (!a || a.rank >= RANK_MAX) return out;
  const C = rankCost(a.rank + 1); for (const k of PIECES) out[k] = Math.max(0, C[k] - a[k]); return out;
}
/** pieces beyond what each hero's NEXT rank needs (a hero at A5 needs none: all its pieces are surplus) */
export function ascSurplus(pr) {
  const out = [];
  for (const cls of HERO_IDS) { const a = ascOf(pr, cls); if (!a) continue; const C = a.rank >= RANK_MAX ? null : rankCost(a.rank + 1); for (const k of PIECES) { const x = C ? Math.max(0, a[k] - C[k]) : a[k]; if (x) out.push({ cls, k, n: x }); } }
  return out;
}
export const ascSurplusCount = (pr) => ascSurplus(pr).reduce((s, x) => s + x.n, 0);
export function ascExchange(pr, cls, k) {
  if (!PIECES.includes(k) || !(ascMissing(pr, cls)[k] > 0) || ascSurplusCount(pr) < ASC.exchange) return false;
  for (let need = ASC.exchange; need > 0; need--) { const s = ascSurplus(pr).sort((a, b) => b.n - a.n)[0]; if (!s) return false; ascOf(pr, s.cls)[s.k]--; }
  ascOf(pr, cls)[k]++; return true;
}
/** what still blocks the Altar for this hero: [] = ready for the Shadow Duel. level = the hero's level. */
export function ascBlockers(pr, cls, level) {
  const a = ascOf(pr, cls), why = []; if (!a) return ['unknown hero'];
  if (a.rank >= RANK_MAX) return [`already rank A${RANK_MAX}`];
  const C = rankCost(a.rank + 1);
  if ((level | 0) < ASC.level) why.push(`reach Lv ${ASC.level}`);
  for (const k of PIECES) if (a[k] < C[k]) why.push(`${PIECE_NAME[k]} ${a[k]}/${C[k]}`);
  for (const [id, n] of Object.entries(C.mats)) if (((pr.mats && pr.mats[id]) | 0) < n) why.push(`${id.replace(/_/g, ' ')} ${(pr.mats && pr.mats[id]) | 0}/${n}`);
  if ((pr.gold | 0) < C.gold) why.push(`${C.gold} gold`);
  return why;
}
export const canDuel = (pr, cls, level) => ascBlockers(pr, cls, level).length === 0;
/** the duel for rank `to` (default: the next rank) was won: pay that rank's cost, rank up. Nothing is paid on a loss (no
 *  item loss). A rank the profile already has is a no-op success (a replayed event never charges twice). */
export function ascend(pr, cls, level, to) {
  const a0 = ascOf(pr, cls); if (!a0) return false;
  if (to != null && a0.rank >= to) return true;
  if (!canDuel(pr, cls, level)) return false;
  const a = a0, C = rankCost(a.rank + 1);
  for (const k of PIECES) a[k] -= C[k]; for (const [id, n] of Object.entries(C.mats)) pr.mats[id] -= n; pr.gold -= C.gold;
  a.rank = Math.max(a.rank + 1, Math.min(RANK_MAX, to | 0)); a.duel = (a.duel | 0) + 1; return true;
}
export const ascendedCount = (pr) => HERO_IDS.filter((c) => rankOf(pr, c) >= 1).length;
/** the highest rank on the account and the sum of every hero's ranks */
export const bestRank = (pr) => Math.max(0, ...HERO_IDS.map((c) => rankOf(pr, c)));
export const rankSum = (pr) => HERO_IDS.reduce((s, c) => s + rankOf(pr, c), 0);
/** the unlock flags (a1..a5 per hero) the profile's ranks call for: only ever ADDS flags (a flag is never taken back) */
export function ascFlags(pr, u) {
  let ch = false; if (!pr || !u) return ch;
  for (const cls of HERO_IDS) { const r = rankOf(pr, cls); for (let k = 1; k <= r; k++) { const key = rankKey(k, cls); if (!u[key]) { u[key] = 1; ch = true; } } }
  return ch;
}
