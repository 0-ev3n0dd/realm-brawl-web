// Game loop B1 (2026-10-09): Hero Mastery effects. Pure (sim, save, server validator and UI share it).
//  - points: the hero's kills + its overflow XP (kill XP past the level cap: 90% of it now feeds Mastery instead of being
//    thrown away; MASTERY.xpPer XP = 1 point). rank r needs 25·r² points (the old kill curve, so no hero ever drops a rank),
//    now up to rank 50.
//  - every rank = one perk pick, +1% to one of four stats (Might: Attack, Vigor: Max HP, Precision: Crit Damage, Fortune:
//    Gold + Material Find). Picks are per hero (char.mperks); a respec costs gold (MASTERY.respec per pick spent).
//  - a cosmetic emblem at ranks 5 / 10 / 15 / 20 (bronze / silver / gold / prismatic, drawn under the hero) and a title
//    every 10 ranks.
export const MASTERY = { cap: 50, k: 25, xpPer: 60, overflow: 0.9, respec: 120 };
export const PERKS = {
  might: { name: 'Might', stat: 'atk', pct: 0.01, text: '+1% Attack', ico: '⚔' },
  vigor: { name: 'Vigor', stat: 'maxHp', pct: 0.01, text: '+1% Max HP', ico: '♥' },
  precision: { name: 'Precision', stat: 'critDmg', add: 0.01, text: '+1% Crit Damage', ico: '◎' },
  fortune: { name: 'Fortune', stat: 'find', add: 0.01, text: '+1% Gold + Material Find', ico: '✦' },
};
export const PERK_IDS = Object.keys(PERKS);
/** cosmetic emblems (the highest reached shows): [rank, id, name, colour] */
export const EMBLEMS = [[5, 'bronze', 'Bronze Sigil', '#d08a4a'], [10, 'silver', 'Silver Sigil', '#d6e2f0'], [15, 'gold', 'Gold Sigil', '#ffd23f'], [20, 'prism', 'Prismatic Sigil', '#c99bff']];
export const TITLES = [[10, 'Veteran'], [20, 'Master'], [30, 'Grandmaster'], [40, 'Mythic'], [50, 'Legend']];
const need = (r) => MASTERY.k * r * r;
/** mastery points of a hero / player ({ kills, mxp }) */
export const masteryPoints = (c) => Math.max(0, (c && c.kills) | 0) + Math.floor(Math.max(0, +(c && c.mxp) || 0) / MASTERY.xpPer);
/** { rank, pts, kills, next (points for the next rank), frac } */
export function masteryOf(c) {
  const pts = masteryPoints(c); let rank = 0;
  while (rank < MASTERY.cap && pts >= need(rank + 1)) rank++;
  const lo = need(rank), hi = rank >= MASTERY.cap ? lo : need(rank + 1);
  return { rank, pts, kills: Math.max(0, (c && c.kills) | 0), next: hi, frac: rank >= MASTERY.cap ? 1 : (pts - lo) / Math.max(1, hi - lo) };
}
/** clean a perk table: known ids, integers >= 0, total <= the rank (extra picks trimmed from the end of PERK_IDS) */
export function normPerks(raw, rank = MASTERY.cap) {
  const o = {}; let left = Math.max(0, rank | 0);
  for (const k of PERK_IDS) { const n = Math.max(0, Math.min(left, (raw && raw[k]) | 0)); if (n) { o[k] = n; left -= n; } }
  return o;
}
export const perksSpent = (m) => PERK_IDS.reduce((s, k) => s + ((m && m[k]) | 0), 0);
export const perksFree = (c) => Math.max(0, masteryOf(c).rank - perksSpent(c && c.mperks));
/** spend one pick on a perk (in place on the char / player). True if it was spent. */
export function pickPerk(c, id) { if (!PERKS[id] || perksFree(c) <= 0) return false; c.mperks = { ...(c.mperks || {}) }; c.mperks[id] = (c.mperks[id] | 0) + 1; return true; }
export const respecCost = (c) => perksSpent(c && c.mperks) * MASTERY.respec;
/** apply a hero's perks to computed stats (sim/progression.js computeStats) */
export function applyMastery(p, s) {
  const m = p && p.mperks; if (!m) return;
  if (m.might) s.atk *= 1 + PERKS.might.pct * m.might;
  if (m.vigor) s.maxHp *= 1 + PERKS.vigor.pct * m.vigor;
  if (m.precision) s.critDmg = (s.critDmg || 0) + PERKS.precision.add * m.precision;
  if (m.fortune) { s.goldFind = (s.goldFind || 0) + PERKS.fortune.add * m.fortune; s.matFind = (s.matFind || 0) + PERKS.fortune.add * m.fortune; }
}
/** XP the hero could not take at the level cap: 90% of it becomes mastery XP (in place). */
export function overflowXp(p, amount) { if (amount > 0) p.mxp = Math.round(((+p.mxp || 0) + amount * MASTERY.overflow) * 10) / 10; }
export const emblemOf = (rank) => { let e = null; for (const x of EMBLEMS) if (rank >= x[0]) e = x; return e; };
export const titleOf = (rank) => { let t = ''; for (const x of TITLES) if (rank >= x[0]) t = x[1]; return t; };
/** the next reward on the track: { rank, text } or null */
export function nextMasteryReward(rank) {
  for (let r = rank + 1; r <= MASTERY.cap; r++) {
    const e = EMBLEMS.find((x) => x[0] === r), t = TITLES.find((x) => x[0] === r);
    if (e || t) return { rank: r, text: [e && e[2], t && `the "${t[1]}" title`].filter(Boolean).join(' + ') };
  }
  return null;
}
