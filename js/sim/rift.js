// The Astral Rift systems (Map 5, game loop C3): void tears drain you like Emberdeep's lava (cross on the star bridges),
// starwells erupt on a rhythm (only near heroes), a fallen boss takes its telegraphs with it. Authoritative only.
import { RIFT_WELLS, RIFT_BOUNDS, inTear } from './riftconst.js';
import { damagePlayer, addArea } from './combat.js';

export const TEAR = { every: 15, pct: 0.06 };
export const WELL = { warn: 60, pct: 0.18, near: 1300 };
const r0 = (v) => Math.round(v);
const inBox = (p) => p.x > RIFT_BOUNDS.x0 - 500 && p.x < RIFT_BOUNDS.x1 + 500 && p.y > RIFT_BOUNDS.y0 - 500 && p.y < RIFT_BOUNDS.y1 + 500;

/** an Astral Rift enemy died */
export function riftKill(sim, e) {
  if (e.boss) for (const a of sim.areas) if (a.ownerId === e.id || a.follow === e.id) a.dead = true;
}
/** per tick: void tears + starwells */
export function updateRift(sim) {
  if (sim.predicting) return;
  let anyIn = false;
  for (const p of sim.players.values()) {
    if (p.dead || !inBox(p)) continue;
    anyIn = true;
    if (sim.tick % TEAR.every === 0 && inTear(p.x, p.y, p.r || 16)) {
      if (damagePlayer(sim, p, 0, null, { pct: TEAR.pct, by: 'a void tear', raw: false })) sim.emit({ type: 'rift', ph: 'tear', pid: p.id, x: r0(p.x), y: r0(p.y) });
    }
  }
  if (!anyIn) return;
  for (const v of RIFT_WELLS) {
    if ((sim.tick + v.ph) % v.period !== 0) continue;
    let near = false;
    for (const p of sim.players.values()) if (!p.dead && Math.abs(p.x - v.x) < WELL.near && Math.abs(p.y - v.y) < WELL.near) { near = true; break; }
    if (!near) continue;
    addArea(sim, { team: 'enemy', ownerId: 0, shape: 'circle', x: v.x, y: v.y, r: v.r, delay: WELL.warn, dmg: 0, pct: WELL.pct, kb: 220, stun: 10, kind: 'starwell', by: 'an erupting starwell' });
  }
}
