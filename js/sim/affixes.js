// Part A3 — elite affixes (docs/ASCENSION-PLAN.md). Every smart elite rolls one affix from its id (no sim.rng draw):
//   vortex    every 6 s: a 1 s BLUE pull ring, then heroes inside are dragged toward it (no damage; it sets up its hit)
//   mirror    every 8 s a 1.5 s mirror window, clearly shown (a white-violet shell + 'MIRROR'): hits taken reflect a small
//             chip back (1.5% max HP, at most once per 0.4 s). It still takes full damage: no invulnerability.
//   splitter  dies into 2 small copies (25% HP, normals, fodder XP)
//   commander aura: pack mates within 350 deal +15%; killing it debuffs the pack (-20% damage, 8 s)
import { damagePlayer, addArea, evadeShove } from './combat.js';
import { DT } from './constants.js';

export const AFFIX_IDS = ['vortex', 'mirror', 'splitter', 'commander'];
export const AFFIX = {
  vortex: { every: 360, tell: 60, r: 300, pull: 260, dur: 40, name: 'Vortex', col: '#4da6ff' },
  mirror: { every: 480, dur: 90, pct: 0.015, cd: 24, name: 'Mirror', col: '#e8d6ff' },
  splitter: { n: 2, hp: 0.25, name: 'Splitter', col: '#5cff9d' },
  commander: { r: 350, aura: 1.15, debuff: 480, name: 'Commander', col: '#ffd23f' },
};
const hash = (n) => { let x = ((n | 0) + 0x9e37) * 2246822519; x ^= x >>> 15; return (x >>> 0) % 997; };
export const affixFor = (id) => AFFIX_IDS[hash(id) % AFFIX_IDS.length];

export function affixInit(e) {
  if (!e.elite || !e.sm || e.split) return;
  e.afx = affixFor(e.id); e.af = { t: 60 + (hash(e.id) % 120), win: 0, cd: 0 };
  e.name = `${AFFIX[e.afx].name} ${e.name}`;
}
export function affixTick(sim, e, t) {
  const F = e.af; if (!F || e.dead) return;
  if (F.win > 0) F.win--; if (F.cd > 0) F.cd--;
  if (e.afx === 'vortex') {
    if (--F.t === 0 && t) { F.at = { x: Math.round(e.x), y: Math.round(e.y) }; addArea(sim, { team: 'enemy', ownerId: e.id, kind: 'vortex', cue: 'close', shape: 'circle', x: F.at.x, y: F.at.y, r: AFFIX.vortex.r, delay: AFFIX.vortex.tell, visual: true, dmg: 0, by: e.name }); sim.emit({ type: 'mobTell', k: 'vortex', id: e.id, x: F.at.x, y: F.at.y, r: AFFIX.vortex.r, t: AFFIX.vortex.tell }); }
    if (F.t <= -AFFIX.vortex.tell && F.t > -AFFIX.vortex.tell - AFFIX.vortex.dur && F.at) for (const p of sim.players.values()) {
      if (p.dead) continue; const dx = F.at.x - p.x, dy = F.at.y - p.y, d = Math.hypot(dx, dy);
      if (d < AFFIX.vortex.r && d > 30 && !evadeShove(sim, p)) { p.x += (dx / d) * AFFIX.vortex.pull * DT; p.y += (dy / d) * AFFIX.vortex.pull * DT; }
    }
    if (F.t <= -AFFIX.vortex.tell - AFFIX.vortex.dur) { F.t = AFFIX.vortex.every; F.at = null; }
  } else if (e.afx === 'mirror') {
    if (--F.t <= 0) { F.t = AFFIX.mirror.every; F.win = AFFIX.mirror.dur; sim.emit({ type: 'mobTell', k: 'mirror', id: e.id, x: Math.round(e.x), y: Math.round(e.y), t: AFFIX.mirror.dur }); }
  } else if (e.afx === 'commander' && (sim.tick % 6 === 0)) {
    for (const o of sim.enemies) if (!o.dead && o !== e && o.sm && Math.hypot(o.x - e.x, o.y - e.y) < AFFIX.commander.r) o.cmdAura = 8;
  }
}
/** a hero hit it (combat.js hitEnemy): the mirror chips back */
export function affixOnHit(sim, e, p) {
  const F = e.af; if (!F || e.afx !== 'mirror' || F.win <= 0 || F.cd > 0 || !p || p.kind !== 'player' || p.dead) return false;
  F.cd = AFFIX.mirror.cd;
  return damagePlayer(sim, p, 0, e, { pct: AFFIX.mirror.pct, raw: false, by: `${e.name}'s mirror`, kb: 0 });
}
/** it died (combat.js killEnemy) */
export function affixOnDeath(sim, e, spawn) {
  if (e.afx === 'splitter' && spawn) {
    for (let i = 0; i < AFFIX.splitter.n; i++) {
      const a = (e.id * 1.7 + i * Math.PI), c = spawn(sim, e.type, e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, { tier: e.zone, mul: 1 });
      c.split = 1; c.maxHp = c.hp = Math.max(1, Math.round(e.maxHp * AFFIX.splitter.hp / 3)); c.xp = Math.round(c.xp * 0.25); c.r = Math.max(8, Math.round(c.r * 0.75)); c.dropChance = 0.05;
    }
    sim.emit({ type: 'mobTell', k: 'split', id: e.id, x: Math.round(e.x), y: Math.round(e.y) });
  }
  if (e.afx === 'commander') {
    for (const o of sim.enemies) if (!o.dead && o !== e && o.sm && Math.hypot(o.x - e.x, o.y - e.y) < AFFIX.commander.r * 1.4) { o.cmdDebuff = AFFIX.commander.debuff; o.cmdAura = 0; }
    sim.emit({ type: 'mobTell', k: 'cmdfall', id: e.id, x: Math.round(e.x), y: Math.round(e.y) });
  }
}
