// Part A1 (Ascension plan): the ONE telegraph language. Shapes + hit tests shared by every boss engine, and the
// game-wide colour grammar (what a colour asks you to do). Pure, no imports beyond math, so the sim, the renderer
// (client/telefx.js), the bots and the tests all agree.
//   shapes: circle · ring (alias donut) · rect (box from x,y along ang) · line (capsule, alias of the trials' 'line')
//           cone (optional core radius) · path (polyline capsule) · safe (everything EXCEPT the c circles)
//           tower (soak circle: c players must stand in it) · spread (circle on a player: stand apart)
//           stack (circle on a player: stand together) · wall (an arc band from r0 to r around ang ± half)
import { inLine } from './math.js';

/** the colour grammar: a telegraph's cue -> its colour + what it means (the legend in the HUD / Options / docs) */
export const CUES = {
  away: { col: '#ff4d5e', fill: 'rgba(255,77,94,.32)', txt: 'RED · get away' },
  close: { col: '#4da6ff', fill: 'rgba(77,166,255,.30)', txt: 'BLUE · come close / stack' },
  soak: { col: '#ffd23f', fill: 'rgba(255,210,63,.30)', txt: 'YELLOW · soak it (towers)' },
  spread: { col: '#c06bff', fill: 'rgba(192,107,255,.28)', txt: 'PURPLE · spread out' },
  safe: { col: '#5cff9d', fill: 'rgba(92,255,157,.22)', txt: 'GREEN · the safe spot' },
};
export const CUE_IDS = Object.keys(CUES);
/** a telegraph's cue: explicit t.cue, else from its shape (safe -> safe, tower -> soak, spread / stack), else away */
export function cueOf(t) {
  if (t.cue && CUES[t.cue]) return t.cue;
  if (t.sh === 'safe') return 'safe';
  if (t.sh === 'tower') return 'soak';
  if (t.sh === 'spread') return 'spread';
  if (t.sh === 'stack') return 'close';
  return 'away';
}
/** Dodge pass 2, step 3 (2026-10-19): position checks are solved by WHERE you stand when the timer ends, never by an evade:
 * safe spots, soaks (towers), spreads / marks / tethers, stacks + "get in" donuts, trial safe-zones, and shapes flagged
 * pos: 1 (Void Web, Starfall, Rift Cleave, Lumivex Moonbeam). sim/combat.js damagePlayer: a position check ignores DODGE
 * i-frames (class movement-skill i-frames, respawn etc. still apply). Each engine sets sim.posCheck while it resolves one. */
const POS_CUES = new Set(['safe', 'soak', 'spread', 'close']);
export const posTele = (t) => !!(t && (t.pos || t.safe || t.sh === 'stack' || POS_CUES.has(cueOf(t))));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, k = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return Math.hypot(px - (ax + dx * k), py - (ay + dy * k));
}
/** is p (x, y, r) inside telegraph t? (pad = half the hero radius, the same forgiveness every engine used) */
export function hits(t, p) {
  const pad = (p.r || 16) * 0.5, d = Math.hypot(p.x - t.x, p.y - t.y);
  switch (t.sh) {
    case 'circle': case 'tower': case 'spread': case 'stack': return d < t.r + pad;
    case 'ring': case 'donut': return d > t.r0 - pad && d < t.r + pad;
    case 'rect': return inLine(t.x, t.y, t.ang, t.len, t.w, p.x, p.y, pad);
    case 'line': return segDist(p.x, p.y, t.x, t.y, t.x + Math.cos(t.ang) * t.len, t.y + Math.sin(t.ang) * t.len) < t.w / 2 + pad;
    case 'cone': return d < t.r + pad && (Math.abs(wrapA(Math.atan2(p.y - t.y, p.x - t.x) - t.ang)) < t.arc / 2 || (t.core > 0 && d < t.core));
    case 'path': { for (let i = 0; i + 3 < t.pts.length; i += 2) if (segDist(p.x, p.y, t.pts[i], t.pts[i + 1], t.pts[i + 2], t.pts[i + 3]) < t.w / 2 + pad) return true; return false; }
    case 'safe': return !t.c.some(([x, y, r]) => Math.hypot(p.x - x, p.y - y) < r - pad);
    case 'wall': return d > t.r0 - pad && d < t.r + pad && Math.abs(wrapA(Math.atan2(p.y - t.y, p.x - t.x) - t.ang)) < (t.half || 0.9);
    default: return false;
  }
}
/** a tower / stack resolves on how many stand in it: ok when >= need (need defaults to t.n or 1) */
export function soakCount(t, ps) { let n = 0; for (const p of ps) if (!p.dead && hits({ ...t, sh: 'circle' }, p)) n++; return n; }
export const soakOk = (t, ps) => soakCount(t, ps) >= (t.n || 1);
/** spread: true when nobody else stands inside the circle around its target */
export const spreadOk = (t, ps) => ps.filter((p) => !p.dead && p.id !== t.pid && hits({ ...t, sh: 'circle' }, p)).length === 0;
