// Boss-arena camera bias (World 2 polish): the boss bar + phase text sit across the top of the screen, and a boss
// standing north of the hero (Skaldra's coils, Osric on his back rank, Hephast at the head of the foundry) would hide
// under it. When a boss is within ~1200 units and its top would land inside the HUD band, the camera target slides
// north just enough to bring it out, never so far that the hero leaves the lower part of the screen.
const NEAR = 1200, FLOOR = 220;
/**
 * @param {object} sim  sim or co-op view (needs .enemies)
 * @param {number} px   hero x / y (the follow target before bias)
 * @param {number} ty   camera target y before bias
 * @param {number} h    viewport height (css px)
 * @param {number} zoom camera zoom
 * @param {number} band HUD band height at the top (css px)
 * @param {number} floorPx how far above the bottom edge the hero must stay (css px)
 * @returns {number} the biased camera target y
 */
export function bossCamY(sim, px, py, ty, h, zoom = 1, band = 190, floorPx = FLOOR) {
  let b = null, bd = NEAR * NEAR;
  const ops = opsBossIds(sim);
  if (ops) band = Math.max(band, Math.min(240, h * 0.36)); // (a mission: its objective panel under the title is taller than a boss bar)
  for (const e of sim.enemies || []) {
    if (e.dead || !(e.boss || (ops && ops.includes(e.id)))) continue;
    const d = (e.x - px) ** 2 + (e.y - py) ** 2;
    if (d < bd) { bd = d; b = e; }
  }
  if (!b || b.y > py + 40) return ty;
  const top = b.y - (b.r || 60) * 2.2;                 // the top of the boss's art (coils, crown, hammer)
  const lim = top - band / zoom + (h / 2) / zoom;      // the largest camera y that keeps that top below the band
  if (ty <= lim) return ty;
  const floor = py - (h / 2 - floorPx) / zoom;           // keep the hero above the skill bar (FLOOR px off the bottom edge)
  return Math.max(Math.min(ty, lim), Math.min(ty, floor));
}
/** Mission bosses (not e.boss: they're elites with a mission HP bar in the HUD) by id, from the live run or the packed
 *  co-op view: siege / queen / Mobile + Assault boss / Assault champion / the cornered Capture quarry. null outside a mission. */
export function opsBossIds(sim) {
  const O = sim && sim.ops; if (!O || O.st !== 'run') return null;
  if (O.A) return [O.siegeId, O.queenId, O.bossId, O.champId, O.cap && O.cap.ph === 'fight' ? O.tgtId : 0].filter(Boolean);
  return [O.sg, O.qid, O.bid, O.cid].filter(Boolean);
}
