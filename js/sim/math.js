export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
/** Is circle (x,y,r) inside a cone at (cx,cy) facing ang with full arc `arc` and radius `range`? */
export function inCone(cx, cy, ang, arc, range, x, y, r = 0) {
  const dx = x - cx, dy = y - cy;
  const d = Math.hypot(dx, dy);
  if (d > range + r) return false;
  if (d <= r + 6 || arc >= TAU - 1e-6) return true;
  const slack = Math.asin(Math.min(1, r / d));
  return Math.abs(angDiff(ang, Math.atan2(dy, dx))) <= arc / 2 + slack;
}
/** Is circle (x,y,r) touching a line segment rectangle from (lx,ly) along ang with length len and width w? */
export function inLine(lx, ly, ang, len, w, x, y, r = 0) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const dx = x - lx, dy = y - ly;
  const along = dx * c + dy * s;
  const perp = -dx * s + dy * c;
  return along >= -r && along <= len + r && Math.abs(perp) <= w / 2 + r;
}
export function norm(x, y) { const l = Math.hypot(x, y); return l > 1e-9 ? [x / l, y / l] : [0, 0]; }
