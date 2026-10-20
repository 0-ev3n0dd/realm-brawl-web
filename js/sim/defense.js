// Melee defensive layers (v2026.1005 melee-defense pass). Every melee class gets a survival tool tied to its identity:
//  Warrior   IRON REBUKE   a perfect-timed dodge (inside the first 0.15 s) braces: a 16% max-HP shield + Glory; every chain
//                          finisher adds a 6% shield (stacks up to 25%). Plate: -12% damage taken from normal hits.
//  Blade Dancer SHADOW TIME a perfect dodge stretches into 0.4 s more invulnerability and slows everything nearby;
//                          crits leech 4% of their damage (capped at 3% max HP per second).
//  Samurai   MIRROR PARRY  Crescent Parry / Moonlit Guard now parry boss mechanics (% hits) too; a parry heals 6% max HP.
//  Monk      IRON BODY     30% of every hit is soaked into a pool that drains slowly (never lethal); finishing a chain
//                          purges the pool and heals back half of it.
//  Dragoon   DRAGON SCALE  every dive landing grants a 12% max-HP shield for 3 s (1.5 s cooldown); jumps keep their i-frames.
// Server-authoritative: a predicting client sim never heals / shields / drains.
import { secs } from './constants.js';
import { CLASSES } from './data/classes.js';

export const DEF = {
  warrior: { pdShield: 0.16, pdT: secs(4), pdGlory: 12, chainShield: 0.06, cap: 0.25, chainT: secs(4), plate: 0.88 },
  bladedancer: { leech: 0.08, leechCap: 0.05, pdIframes: 24, slowR: 240, slow: secs(1.2), slowMul: 0.45 },
  samurai: { parryHeal: 0.1 },
  monk: { soak: 0.4, drain: secs(4), purge: 0.7 },
  dragoon: { landShield: 0.18, landT: secs(3), cd: secs(1.5) },
};
const MELEE = new Set(Object.keys(DEF));
export const isMeleeDef = (p) => MELEE.has(p.cls);
const D = (p) => p.dfs || (p.dfs = { pool: 0, lw: 0, lsum: 0, land: -9999 });

function shieldUp(sim, p, add, cap, ticks) { // stacking shield (grantShield keeps the larger one; this one adds)
  if (sim.predicting || p.dead) return;
  const mx = p.stats.maxHp;
  p.shield = Math.round(Math.min(mx * cap, (p.shield || 0) + mx * add));
  p.shieldMax = Math.max(p.shieldMax || 0, p.shield);
  p.shieldT = Math.max(p.shieldT || 0, ticks);
  sim.emit({ type: 'shield', pid: p.id, by: p.id, x: p.x, y: p.y - p.r, amount: p.shield });
}
function heal(sim, p, amt) {
  if (sim.predicting || p.dead || !(amt > 0)) return 0;
  const add = Math.min(p.stats.maxHp - p.hp, amt);
  if (add <= 0) return 0;
  p.hp += add; p.healTaken = (p.healTaken || 0) + add;
  if (add >= 1) sim.emit({ type: 'heal', pid: p.id, by: p.id, x: p.x, y: p.y - p.r, amount: Math.round(add) });
  return add;
}

/** damagePlayer: scale an incoming (already mitigated) hit. Returns the damage to take now. */
export function defHurt(sim, p, dmg, o = {}) {
  if (p.cls === 'warrior' && !o.pct && !o.raw) dmg = Math.max(1, Math.round(dmg * DEF.warrior.plate));
  if (p.cls === 'monk' && !o.raw && dmg > 1) {
    const s = Math.floor(dmg * DEF.monk.soak);
    if (s > 0) { const d = D(p); d.pool += s; d.rate = d.pool / DEF.monk.drain; dmg -= s; } // drains linearly over 4 s from the last hit
  }
  return dmg;
}

/** A perfect dodge just happened (combat.js). */
export function defPerfect(sim, p) {
  if (p.cls === 'warrior') {
    const W = DEF.warrior; shieldUp(sim, p, W.pdShield, W.cap, W.pdT);
    if (p.res != null && CLASSES.warrior.gloryRes) p.res = Math.min(p.stats.maxRes, p.res + W.pdGlory);
    sim.emit({ type: 'defx', k: 'rebuke', pid: p.id, x: Math.round(p.x), y: Math.round(p.y) });
  } else if (p.cls === 'bladedancer') {
    const B = DEF.bladedancer; p.iframes = Math.max(p.iframes, B.pdIframes);
    if (!sim.predicting) for (const e of sim.enemies.values()) {
      if (e.dead || !e.cc) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy > (B.slowR + (e.r || 0)) ** 2) continue;
      e.cc.slow = Math.max(e.cc.slow || 0, B.slow); e.cc.slowMul = Math.min(e.cc.slowMul ?? 1, B.slowMul);
    }
    sim.emit({ type: 'defx', k: 'shadowtime', pid: p.id, x: Math.round(p.x), y: Math.round(p.y), r: B.slowR });
  }
}

/** A chain was cast (player.js startSkill). */
export function defChain(sim, p, chain) {
  if (!chain) return;
  if (p.cls === 'warrior') { const W = DEF.warrior; shieldUp(sim, p, W.chainShield, W.cap, W.chainT); }
  else if (p.cls === 'monk') {
    const d = D(p); if (!(d.pool > 0)) return;
    const back = heal(sim, p, d.pool * DEF.monk.purge);
    if (!sim.predicting) { sim.emit({ type: 'defx', k: 'ironbody', pid: p.id, x: Math.round(p.x), y: Math.round(p.y), n: Math.round(back) }); d.pool = 0; }
  }
}

/** A Samurai parry landed. */
export function defParry(sim, p) { heal(sim, p, p.stats.maxHp * DEF.samurai.parryHeal); }

/** A Dragoon dive landed (dragoon.js strike, dive). */
export function defLand(sim, p) {
  if (sim.predicting) return;
  const d = D(p), G = DEF.dragoon;
  if (sim.tick - d.land < G.cd) return;
  d.land = sim.tick;
  shieldUp(sim, p, G.landShield, G.landShield, G.landT);
  sim.emit({ type: 'defx', k: 'scale', pid: p.id, x: Math.round(p.x), y: Math.round(p.y) });
}

/** Blade Dancer crit leech (combat.js hit). */
export function defCrit(sim, p, dmg) {
  if (p.cls !== 'bladedancer' || sim.predicting) return;
  const d = D(p), B = DEF.bladedancer;
  if (sim.tick - d.lw >= 60) { d.lw = sim.tick; d.lsum = 0; }
  const room = p.stats.maxHp * B.leechCap - d.lsum;
  if (room <= 0) return;
  const amt = Math.min(room, dmg * B.leech);
  d.lsum += amt;
  const add = Math.min(p.stats.maxHp - p.hp, amt);
  if (add > 0) { p.hp += add; p.healTaken = (p.healTaken || 0) + add; }
}

/** Per tick (player.js). Monk Iron Body drain: never lethal. */
export function defTick(sim, p) {
  if (p.cls !== 'monk' || !p.dfs || !(p.dfs.pool > 0) || sim.predicting || p.dead) return;
  const d = p.dfs, step = Math.max(0.5, d.rate || d.pool / DEF.monk.drain);
  const take = Math.min(d.pool, step);
  d.pool -= take;
  p.hp = Math.max(1, p.hp - take);
  p.dmgTaken = (p.dmgTaken || 0) + take;
  if (d.pool < 0.5) d.pool = 0;
}
export function defReset(p) { if (p.dfs) { p.dfs.pool = 0; p.dfs.lsum = 0; } }
export function defInfo(p) { return p.dfs && p.dfs.pool > 0 ? { pool: Math.round(p.dfs.pool) } : null; }
