// Emberdeep Caldera systems: lava burns, erupting vents, Forge of Cinders portals (dropped by Emberdeep monsters, Pyrrhex
// always), boss clean-up on death, and the packed state for co-op clients (portals + the running Forge). Authoritative only.
import { secs } from './constants.js';
import { EMBER_SPAWN, EMBER_VENTS, inEmberArea, inForgeArea, inLava } from './emberconst.js';
import { spawnProjectile, damagePlayer, addArea } from './combat.js';
import { enterForge, packForge } from './forge.js';
import { bubbleFree } from './emberai.js';

export const FPORTAL = { life: secs(150), r: 46, max: 4, chance: 0.011, eliteChance: 0.09 };
export const LAVA = { every: 15, pct: 0.06 };
export const VENT = { warn: 60, pct: 0.18, near: 1300 };
const r0 = (v) => Math.round(v);

/** An Emberdeep / Forge enemy died. */
export function emberKill(sim, e) {
  if (e.type === 'glassorb') bubbleFree(sim, e);
  if (e.type === 'moth') { // a Cinder Moth bursts into a ring of embers
    const n = 8, o = sim.rng.next() * Math.PI * 2;
    for (let i = 0; i < n; i++) spawnProjectile(sim, { team: 'enemy', ownerId: e.summonOf || e.id, x: e.x, y: e.y, vx: Math.cos(o + i / n * Math.PI * 2) * 210, vy: Math.sin(o + i / n * Math.PI * 2) * 210, r: 9, life: 100, dmg: e.dmg * 0.6, style: 'ember', kb: 60, by: 'a Cinder Moth' });
    sim.emit({ type: 'ember', ph: 'mothPop', x: r0(e.x), y: r0(e.y) });
  }
  if (e.boss) { // a fallen boss takes its sun / tide / panes / eruptions with it
    for (const a of sim.areas) if (a.ownerId === e.id || a.follow === e.id) a.dead = true;
    for (const q of sim.players.values()) if (q.encased) q.encased = 0;
  }
  // (missions pass: kills no longer drop Forge portals; the Forge of Cinders has a fixed entrance by the outpost: sim/opsconst.js)
  // (the old portal rolls still draw from sim.rng so seeded runs - the intro's compiled beat plan - stay identical)
  if (!inEmberArea(e.x, e.y) || inForgeArea(e.x, e.y) || e.summonOf) return;
  if (!(e.type === 'pyrrhex' || (e.boss && sim.rng.next() < 0.5))) sim.rng.next();
}
export function dropForgePortal(sim, x, y, big = false) {
  if (sim.noPortals) return null; // (the launch intro's showcase sims: no dungeon portals)
  const L = sim.forgePortals || (sim.forgePortals = []);
  if (L.length >= FPORTAL.max) L.shift();
  const pt = { id: sim.id(), x: r0(x), y: r0(y), t: FPORTAL.life, big: big ? 1 : 0 };
  L.push(pt);
  sim.emit({ type: 'ember', ph: 'portal', x: pt.x, y: pt.y, big: pt.big });
  return pt;
}

/** Per tick: lava burns, vents, Forge portal timers + step-ins, encasement safety. */
export function updateEmber(sim) {
  if (sim.predicting) return;
  let anyIn = false;
  for (const p of sim.players.values()) {
    if (p.dead) { if (p.encased) p.encased = 0; continue; }
    if (p.x < 20000 || p.x > 45000) { if (p.encased) p.encased = 0; continue; }
    anyIn = true;
    if (p.encased && !sim.enemies.some((e) => !e.dead && e.trap === p.id)) p.encased = 0;
    if (sim.tick % LAVA.every === 0 && inLava(p.x, p.y, p.r || 16)) {
      if (damagePlayer(sim, p, 0, null, { pct: LAVA.pct, by: 'molten lava', raw: false })) sim.emit({ type: 'ember', ph: 'burn', pid: p.id, x: r0(p.x), y: r0(p.y) });
    }
  }
  if (anyIn) for (const v of EMBER_VENTS) { // vents erupt on their own clock (only near heroes, so idle vents cost nothing)
    if ((sim.tick + v.ph) % v.period !== 0) continue;
    let near = false;
    for (const p of sim.players.values()) if (!p.dead && Math.abs(p.x - v.x) < VENT.near && Math.abs(p.y - v.y) < VENT.near) { near = true; break; }
    if (!near) continue;
    addArea(sim, { team: 'enemy', ownerId: 0, shape: 'circle', x: v.x, y: v.y, r: v.r, delay: VENT.warn, dmg: 0, pct: VENT.pct, kb: 220, stun: 10, kind: 'geyser', by: 'an erupting vent' });
  }
  const L = sim.forgePortals;
  if (!L || !L.length) return;
  for (const pt of L) pt.t--;
  sim.forgePortals = L.filter((pt) => pt.t > 0);
  if (sim.tick % 6 !== 0) return;
  for (const pt of sim.forgePortals) for (const p of sim.players.values()) {
    if (p.dead || Math.hypot(p.x - pt.x, p.y - pt.y) > FPORTAL.r) continue;
    if (sim.hub) { sim.hub.want = 'forge'; sim.forgePortals = []; return; }
    enterForge(sim, p);
  }
}
/** co-op snapshot: { fp: Forge portals, f: the Forge run } (null when there is nothing to send) */
export function packEmber(sim) {
  const fp = (sim.forgePortals || []).map((p) => [p.x, p.y, p.t, p.big]);
  const f = packForge(sim);
  return fp.length || f ? { fp, f: f || 0 } : null;
}
export { EMBER_SPAWN };
