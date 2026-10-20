// Mission revamp part 3: the client's view of the per-mission-type best grades (sim/opsbest.js on the browser profile).
// rewards.js plugs the profile in and banks each graded run; the mission entrance (arch medallion + card), the Mission
// Counter board, Progress > Records and the results panel read it here.
import { bestOf, GRADE_COL } from '../sim/opsbest.js';
import { OPS_BIOME } from '../sim/opsconst.js';
let SRC = () => null;
export const BEST = { last: null }; // the latest banked run: { k, b, g, s, best, here, prev } (the results panel's NEW BEST)
export function setBestSource(fn) { SRC = fn || (() => null); }
export function bestFor(type, biome = null) { try { return bestOf(SRC(), type, biome); } catch { return null; } }
export const gradeCol = (g) => GRADE_COL[g] || '#d2c2e6';
/** "A · 82 pts on Frostvell Peaks" (or "no grade yet") */
export function bestText(type, biome = null) {
  const r = bestFor(type, biome); if (!r) return 'no grade yet';
  return `${r.g} · ${r.s} pts${!biome && r.b && OPS_BIOME[r.b] ? ` on ${OPS_BIOME[r.b].name}` : ''}`;
}
/** a grade medallion (canvas): a dark disc with the letter in its colour; g '' = an empty dashed slot */
export function drawGradeMedal(ctx, x, y, r, g, label = null) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(20,12,24,.88)'; ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.18); ctx.strokeStyle = g ? gradeCol(g) : 'rgba(255,255,255,.35)'; if (!g) ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = `${Math.round(r * 1.25)}px 'Lilita One', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, r * 0.2); ctx.strokeStyle = '#2b2433'; ctx.strokeText(g || '–', x, y + r * 0.06); ctx.fillStyle = g ? gradeCol(g) : 'rgba(255,255,255,.55)'; ctx.fillText(g || '–', x, y + r * 0.06);
  if (label) { ctx.font = `${Math.max(9, Math.round(r * 0.5))}px 'Lilita One', sans-serif`; ctx.lineWidth = 3; ctx.strokeText(label, x, y + r + 9); ctx.fillStyle = '#ffffff'; ctx.fillText(label, x, y + r + 9); }
  ctx.restore();
}
