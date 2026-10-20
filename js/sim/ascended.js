// Ascended (A1), Part B: what rank 1 gives a hero. Pure data + small hooks (sim side, so solo, co-op and the phone agree).
//   flag   p.unlocks['a1_<cls>'] (persisted like every unlock flag: client/townui.js, server/room.js UNLOCK_KEYS)
//   title  "Ascended" (client: the hero card + name tags)
//   stats  a raised ceiling for every Ascended hero (ASC_CEIL) + one unique passive per hero (ASC_PASSIVE), additive only
//   ult    the Ascended ultimate: the class's own ult, then its ASTRAL ECHO (ASC_ULT) - a class-shaped astral strike at
//          the ult's target (player areas through combat.js, so it scales with ATK, crits, gear like any skill)
//   look   the astral layer (client/ascfx.js): an orbit of stars + a soft class-coloured halo
// Nothing here ever lowers a stat (Bard included: its passive only adds).
import { addArea } from './combat.js';
import { ascAccount, ascMilestone } from './meta.js';

// Part D: ranks A2-A5. One flag per rank and hero: p.unlocks['a<k>_<cls>'] (k = 1..5, persisted like every unlock flag;
// the client keeps them in step with the profile's rank, client/townui.js loadUnlocks + sim/ascension.js ascFlags).
export const RANK_MAX = 5;
export const ASC_CLS = ['warrior', 'ranger', 'mage', 'cleric', 'bladedancer', 'samurai', 'monk', 'dragoon', 'summoner', 'bard'];
export const rankKey = (k, cls) => `a${k}_${cls}`;
export const ascKey = (cls) => rankKey(1, cls);
export const ASC_UNLOCK_KEYS = [1, 2, 3, 4, 5].flatMap((k) => ASC_CLS.map((c) => rankKey(k, c)));
/** the hero's Ascension rank from its flags (0 = not Ascended; ranks only count in order) */
export function ascRank(p, cls = p && p.cls) { if (!p || !cls || !p.unlocks) return 0; let r = 0; while (r < RANK_MAX && p.unlocks[rankKey(r + 1, cls)]) r++; return r; }
export const isAscended = (p) => ascRank(p) >= 1;
/** what each rank adds (additive only: nothing here ever lowers a stat, Bard included)
 *  A2 Astral Boost I: the hero's Ascended passive +50% · A3 the Astral skill variant (sim/ascalt.js) · A4 Astral Boost II: the
 *  passive +50% more (x2 in all) and the ceiling +2% · A5 the final look (aura + model trim, client/ascfx.js) */
export const ASC_RANK = {
  1: { name: 'Ascended', text: 'Ascended title, astral aura, the Ascended ultimate + passive' },
  2: { name: 'Astral Boost I', text: 'Your Ascended passive is 50% stronger', passive: 0.5 },
  3: { name: 'Astral Variant', text: 'Unlocks your Astral skill variant (swap it in at the Altar)', alt: 1 },
  4: { name: 'Astral Boost II', text: 'Your Ascended passive is doubled in all, +2% Attack and Max HP', passive: 0.5, ceil: { atkMul: 1.02, hpMul: 1.02 } },
  5: { name: 'Starborn', text: 'The final look: the Starborn aura and astral model trim', look: 1 },
};
/** the passive multiplier at rank r (1 at A1, 1.5 at A2-A3, 2 from A4) */
export const passiveK = (r) => 1 + [2, 3, 4, 5].reduce((k, i) => k + (r >= i ? ASC_RANK[i].passive || 0 : 0), 0);
export const ASC_TITLE = 'Ascended';
export const ASC_CEIL = { atkMul: 1.06, hpMul: 1.06 };
export const ASC_PASSIVE = {
  warrior: { name: 'Starforged Will', text: '+8% Max HP, +4% Crit Damage', add: { critDmg: 0.04 }, mul: { maxHp: 1.08 } },
  ranger: { name: 'Comet Sight', text: '+4% Crit Chance, +3% Speed', add: { crit: 0.04, spd: 0.03 } },
  mage: { name: 'Nebula Mind', text: '+10% Crit Damage, +1 Resource Regen', add: { critDmg: 0.1, resRegen: 1 } },
  cleric: { name: 'Halo of Dawn', text: '+2 HP Regen, +8 Defence', add: { hpRegen: 2, def: 8 } },
  bladedancer: { name: 'Moonless Step', text: '+5% Crit Chance, +3% Speed', add: { crit: 0.05, spd: 0.03 } },
  samurai: { name: 'Edge of the Void', text: '+12% Crit Damage', add: { critDmg: 0.12 } },
  monk: { name: 'Stillstar Body', text: '+6% Max HP, +2 HP Regen', add: { hpRegen: 2 }, mul: { maxHp: 1.06 } },
  dragoon: { name: 'Skyfall Heart', text: '+4% Attack, +6 Defence', add: { def: 6 }, mul: { atk: 1.04 } },
  summoner: { name: 'Inkstar Pact', text: '+4% Attack, +1 Resource Regen', add: { resRegen: 1 }, mul: { atk: 1.04 } },
  bard: { name: 'Song of the Spheres', text: '+5% Attack, +2 HP Regen, +3% Speed', add: { hpRegen: 2, spd: 0.03 }, mul: { atk: 1.05 } },
};
/** computeStats hook (sim/progression.js): the raised ceiling + the hero's passive. Mutates s; sets p.asc for the snapshot. */
export function applyAscended(p, s) {
  const R = ascRank(p); p.asc = R; if (!R) return s;
  s.atk *= ASC_CEIL.atkMul; s.maxHp *= ASC_CEIL.hpMul;
  for (let i = 2; i <= R; i++) { const c = ASC_RANK[i].ceil; if (c) { s.atk *= c.atkMul; s.maxHp *= c.hpMul; } }
  const P = ASC_PASSIVE[p.cls]; if (!P) return s;
  const K = passiveK(R);
  for (const [k, v] of Object.entries(P.add || {})) s[k] = (s[k] || 0) + v * K;
  for (const [k, v] of Object.entries(P.mul || {})) s[k] = (s[k] || 0) * (1 + (v - 1) * K);
  return s;
}
/** Part D: how many heroes of this account are Ascended (A1+), from the account-wide unlock flags */
export const ascHeroes = (u) => (u ? ASC_CLS.reduce((n, c) => n + (u[rankKey(1, c)] ? 1 : 0), 0) : 0);
/** Part D account perks (sim/meta.js ASC_ACCOUNT): every Ascended hero lifts EVERY hero a little; capped, additive only */
export function applyAscAccount(p, s) {
  const B = ascAccount(ascHeroes(p && p.unlocks)); p.ascN = B.n; p.ascAll = ascMilestone(B.n, 'starborn') ? 1 : 0;
  if (B.n) { s.atk *= 1 + B.atk; s.maxHp *= 1 + B.hp; }
  return s;
}
// the Astral Echo per class: shape around the ult's target (circle / ring / line along the aim), ATK multiplier per pulse
export const ASC_ULT = {
  warrior: { name: "Ascended Trinity: Starfall Cleave", shape: 'circle', r: 230, mul: 3.2, pulses: 2 },
  ranger: { name: 'Ascended Storm: Comet Rain', shape: 'circle', r: 260, mul: 1.4, pulses: 5 },
  mage: { name: 'Ascended Meteor: Second Sun', shape: 'circle', r: 240, mul: 5.0, pulses: 1 },
  cleric: { name: 'Ascended Dawn: Halo Nova', shape: 'circle', r: 280, mul: 2.4, pulses: 2, heal: 0.12 },
  bladedancer: { name: 'Ascended Eclipse: Moonfall', shape: 'circle', r: 200, mul: 2.2, pulses: 3 },
  samurai: { name: 'Ascended Void: Star-Splitting Draw', shape: 'line', len: 620, w: 120, mul: 4.6, pulses: 1 },
  monk: { name: 'Ascended Spirit: Hundred Stars', shape: 'circle', r: 210, mul: 1.1, pulses: 8 },
  dragoon: { name: 'Ascended Dragon: Skyfall Lance', shape: 'line', len: 560, w: 110, mul: 4.2, pulses: 1 },
  summoner: { name: 'Ascended Grimoire: Starbound Page', shape: 'circle', r: 250, mul: 1.8, pulses: 4 },
  bard: { name: 'Ascended Encore: Music of the Spheres', shape: 'circle', r: 300, mul: 1.6, pulses: 4, heal: 0.1 },
};
/** the ult just fired (sim/player.js): an Ascended hero adds its Astral Echo. Returns the area (or null). */
export function ascendedUlt(sim, p, tx, ty) {
  if (!isAscended(p) || sim.predicting) return null;
  const U = ASC_ULT[p.cls]; if (!U) return null;
  const x = Number.isFinite(tx) ? tx : p.x, y = Number.isFinite(ty) ? ty : p.y, ang = Math.atan2(y - p.y, x - p.x) || 0;
  const geo = U.shape === 'line' ? { shape: 'line', x: p.x, y: p.y, ang, len: U.len, w: U.w } : { shape: 'circle', x, y, r: U.r };
  const a = addArea(sim, { team: 'player', ownerId: p.id, kind: 'ascult', ...geo, delay: 36, pulses: U.pulses, every: 14, o: { mul: U.mul, kb: 120, stagger: 20, heavy: true } });
  if (U.heal) for (const q of sim.players.values()) if (!q.dead) q.hp = Math.min(q.stats.maxHp, q.hp + q.stats.maxHp * U.heal);
  sim.emit({ type: 'ascult', pid: p.id, cls: p.cls, name: U.name, ...geo, x: geo.x, y: geo.y });
  return a;
}
