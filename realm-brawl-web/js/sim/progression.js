import { CLASSES } from './data/classes.js';
import { applyAscended, applyAscAccount } from './ascended.js';
import { applySetStats } from './sets.js';
import { upStats } from './meta.js';
import { applyMastery, overflowXp } from './mastery.js';

export const MAX_LEVEL = 50; // (game loop C1: was 20)

export function xpToNext(level) {
  if (level >= MAX_LEVEL) return Infinity;
  return Math.round(30 * Math.pow(level, 1.75) + 20);
}

export function computeStats(p) {
  const c = CLASSES[p.cls];
  const s = { ...c.base };
  const lv = p.level - 1;
  for (const k in c.growth) s[k] += c.growth[k] * lv;
  for (const slot in p.equipment) {
    const it = p.equipment[slot];
    if (!it) continue;
    const st = it.up ? upStats(it) : it.stats; // (+1..+10 upgrades: main stats +7 % per level, sim/meta.js)
    for (const k in st) s[k] = (s[k] || 0) + st[k];
  }
  applySetStats(p, s); // set bonuses: the live 2-piece stats (+ crafted 4-piece stats), sim/sets.js
  if (c.pips || c.rageRes || c.gloryRes || c.focusRes || c.chiRes || c.bloodRes || c.inkRes || c.tempoRes) { s.maxRes = c.base.maxRes; s.resRegen = c.base.resRegen; } // Initiative pips (Blade Dancer) / Glory (Warrior): fixed size and regen, gear never changes them
  if (s.atkPct) s.atk *= 1 + s.atkPct; // gear expansion: Attack % (after every flat Attack)
  applyMastery(p, s); // game loop B1: the hero's Mastery perks (+1% per pick)
  applyAscended(p, s); applyAscAccount(p, s); // (Part D: the account perks per Ascended hero) // Part B: Ascended (A1) ceiling + the hero's passive (sim/ascended.js)
  s.crit = Math.min(0.75, s.crit);
  s.maxHp = Math.round(s.maxHp);
  s.maxRes = Math.round(s.maxRes);
  s.atk = Math.round(s.atk);
  s.def = Math.round(s.def);
  return s;
}

/** Adds XP, returns number of levels gained. */
export function grantXp(p, amount) {
  if (p.level >= MAX_LEVEL) { p.xp = 0; overflowXp(p, amount); return 0; } // (game loop B1: XP past the cap feeds Mastery)
  p.xp += amount;
  let gained = 0;
  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    gained++;
  }
  if (p.level >= MAX_LEVEL) { overflowXp(p, p.xp); p.xp = 0; }
  return gained;
}
