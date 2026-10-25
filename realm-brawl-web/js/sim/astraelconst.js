// Astrael, the Last Constellation: arena geometry (no imports, so world.js / the renderer can use it without cycles).
// The Star Sanctum floats in a night sky far east of the world disc. Act 2 shatters it into 4 platforms joined by
// thin light bridges (a ring); walking is clamped to the platforms, only knockbacks / pulls can throw you into the sky.
export const AST_POS = { x: 12500, y: 0 };
export const AST_R = 520;
/** Is (x, y) in the Astrael region (arena disc plus a margin)? Movement there is clamped to the arena, not the world. */
export const inAstArea = (x, y, pad = 300) => Math.hypot(x - AST_POS.x, y - AST_POS.y) < AST_R + pad;
/** Act 2 platforms: centres D from the middle on the diagonals (index 0 = SE, 1 = SW, 2 = NW, 3 = NE), radius r. */
export const PLAT = { D: 235, r: 150, bw: 34 };
export const PLAT_NAMES = ['SE', 'SW', 'NW', 'NE'];
export function platCenter(i) { const a = Math.PI / 4 + (((i % 4) + 4) % 4) * Math.PI / 2; return { x: AST_POS.x + Math.cos(a) * PLAT.D, y: AST_POS.y + Math.sin(a) * PLAT.D }; }
const segDist = (x, y, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy, k = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L)); return { d: Math.hypot(x - ax - vx * k, y - ay - vy * k), k, px: ax + vx * k, py: ay + vy * k }; };
/** Which platform (0-3) is (x, y) on, or -1 (a bridge or the sky). pad widens the test. */
export function platAt(x, y, pad = 0) { for (let i = 0; i < 4; i++) { const c = platCenter(i); if (Math.hypot(x - c.x, y - c.y) <= PLAT.r + pad) return i; } return -1; }
/** Standing on something in act 2 (a platform or a bridge)? */
export function onPlatforms(x, y, pad = 0) {
  if (platAt(x, y, pad) >= 0) return true;
  for (let i = 0; i < 4; i++) { const a = platCenter(i), b = platCenter(i + 1); if (segDist(x, y, a.x, a.y, b.x, b.y).d <= PLAT.bw + pad) return true; }
  return false;
}
/** Nearest walkable point in act 2 (the point itself when it is already walkable). */
export function clampToPlatforms(x, y, pad = 0) {
  if (onPlatforms(x, y)) return { x, y };
  let best = null, bd = Infinity;
  for (let i = 0; i < 4; i++) {
    const c = platCenter(i), dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy) || 1, r = PLAT.r - pad;
    const px = c.x + dx / d * r, py = c.y + dy / d * r, dd = Math.hypot(x - px, y - py);
    if (dd < bd) { bd = dd; best = { x: px, y: py }; }
    const n = platCenter(i + 1), s = segDist(x, y, c.x, c.y, n.x, n.y);
    if (s.d > 0) { const w = PLAT.bw - pad, qx = s.px + (x - s.px) / s.d * w, qy = s.py + (y - s.py) / s.d * w, dq = Math.hypot(x - qx, y - qy); if (dq < bd) { bd = dq; best = { x: qx, y: qy }; } }
  }
  return best;
}
