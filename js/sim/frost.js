// Frostveil Peaks systems: Glacier Crypt portals (RotMG-style dungeon drops), Morwen's gifts popping, the Frostveil
// unlock helpers, and the packed state for co-op clients (portals + the running Crypt). Authoritative sim only.
import { secs } from './constants.js';
import { FROST_SPAWN, inFrostArea, inCryptArea } from './frostconst.js';
import { spawnProjectile } from './combat.js';
import { enterCrypt, packCrypt } from './crypt.js';

export const CPORTAL = { life: secs(150), r: 46, max: 4, chance: 0.011, eliteChance: 0.09 };
const r0 = (v) => Math.round(v);

/** A Frostveil / Crypt enemy died. */
export function frostKill(sim, e) {
  if (e.type === 'gift') { // a broken gift spits a ring of shards (break them from range)
    const n = 10, o = sim.rng.next() * Math.PI * 2;
    for (let i = 0; i < n; i++) spawnProjectile(sim, { team: 'enemy', ownerId: e.summonOf || e.id, x: e.x, y: e.y, vx: Math.cos(o + i / n * Math.PI * 2) * 230, vy: Math.sin(o + i / n * Math.PI * 2) * 230, r: 9, life: 120, dmg: e.dmg * 0.7, style: 'snow', kb: 70, by: 'a Wrapped Gift' });
    sim.emit({ type: 'frost', ph: 'giftPop', x: r0(e.x), y: r0(e.y) });
    return;
  }
  // (missions pass: kills no longer drop Crypt portals; the Glacier Crypt has a fixed entrance by the camp: sim/opsconst.js)
  // (the old portal rolls still draw from sim.rng so seeded runs - the intro's compiled beat plan - stay identical)
  if (!inFrostArea(e.x, e.y) || inCryptArea(e.x, e.y) || e.summonOf) return;
  if (!(e.type === 'skaldra' || (e.boss && sim.rng.next() < 0.5))) sim.rng.next();
}
export function dropCryptPortal(sim, x, y, big = false) {
  if (sim.noPortals) return null; // (the launch intro's showcase sims: no dungeon portals)
  const L = sim.cryptPortals || (sim.cryptPortals = []);
  if (L.length >= CPORTAL.max) L.shift();
  const pt = { id: sim.id(), x: r0(x), y: r0(y), t: CPORTAL.life, big: big ? 1 : 0 };
  L.push(pt);
  sim.emit({ type: 'frost', ph: 'portal', x: pt.x, y: pt.y, big: pt.big });
  return pt;
}

/** Per tick: Crypt portal timers + step-ins. */
export function updateFrost(sim) {
  if (sim.predicting) return;
  const L = sim.cryptPortals;
  if (!L || !L.length) return;
  for (const pt of L) pt.t--;
  sim.cryptPortals = L.filter((pt) => pt.t > 0);
  if (sim.tick % 6 !== 0) return;
  for (const pt of sim.cryptPortals) for (const p of sim.players.values()) {
    if (p.dead || Math.hypot(p.x - pt.x, p.y - pt.y) > CPORTAL.r) continue;
    if (sim.hub) { sim.hub.want = 'crypt'; sim.cryptPortals = []; return; }
    enterCrypt(sim, p);
  }
}
/** co-op snapshot: { cp: Crypt portals, c: the Crypt run } (null when there is nothing to send) */
export function packFrost(sim) {
  const cp = (sim.cryptPortals || []).map((p) => [p.x, p.y, p.t, p.big]);
  const c = packCrypt(sim);
  return cp.length || c ? { cp, c: c || 0 } : null;
}
export { FROST_SPAWN };
