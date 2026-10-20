// Mission revamp part 3: per-mission-type best grades (the profile's opsBest). Pure functions (tests / client):
//   pr.opsBest[type] = { g, s, b (the map it was set on), n (runs graded), by: { [biome]: { g, s } } }
// A better grade wins; the same grade with a higher score also counts. Shown on the mission entrance (the grade
// medallion on the arch + the mission card), the Mission Counter board in the hub, the Progress > Records tab and the
// results panel ("NEW BEST").
import { OPS_TYPES, OPS_BIOME } from './opsconst.js';
export const GRADE_V = { S: 4, A: 3, B: 2, C: 1 };
export const GRADE_COL = { S: '#ffd23f', A: '#7dffb0', B: '#6ec8ff', C: '#d2c2e6' };
const better = (g, s, r) => !r || !r.g || (GRADE_V[g] || 0) > (GRADE_V[r.g] || 0) || ((GRADE_V[g] || 0) === (GRADE_V[r.g] || 0) && (s | 0) > (r.s | 0));
/** clean a stored opsBest (unknown types / maps / grades dropped) */
export function normOpsBest(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const t of OPS_TYPES) {
    const r = raw[t]; if (!r || typeof r !== 'object' || !GRADE_V[r.g]) continue;
    const by = {};
    for (const b in (r.by || {})) { const q = r.by[b]; if (OPS_BIOME[b] && q && GRADE_V[q.g]) by[b] = { g: q.g, s: Math.max(0, Math.min(100, q.s | 0)) }; }
    out[t] = { g: r.g, s: Math.max(0, Math.min(100, r.s | 0)), b: OPS_BIOME[r.b] ? r.b : '', n: Math.max(0, r.n | 0), by };
  }
  return out;
}
/** bank a graded run; returns { best (new best for the type), here (new best on this map), prev } */
export function recordBest(pr, type, biome, g, s) {
  if (!pr || !OPS_TYPES.includes(type) || !GRADE_V[g]) return { best: false, here: false, prev: null };
  const B = pr.opsBest || (pr.opsBest = {});
  const r = B[type] || (B[type] = { g: '', s: 0, b: '', n: 0, by: {} });
  const prev = r.g ? { g: r.g, s: r.s } : null;
  r.n = (r.n | 0) + 1; r.by = r.by || {};
  const here = better(g, s, r.by[biome]); if (here && OPS_BIOME[biome]) r.by[biome] = { g, s: s | 0 };
  const best = better(g, s, r); if (best) { r.g = g; r.s = s | 0; r.b = biome; }
  return { best, here, prev };
}
/** { g, s, b, n } for a type, or for one map of it (biome given); null before the first graded run */
export function bestOf(pr, type, biome = null) {
  const r = pr && pr.opsBest && pr.opsBest[type]; if (!r || !r.g) return null;
  if (biome) { const q = r.by && r.by[biome]; return q ? { g: q.g, s: q.s, b: biome, n: r.n } : null; }
  return { g: r.g, s: r.s, b: r.b, n: r.n };
}
