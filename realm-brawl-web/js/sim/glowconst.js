// The Glowmire Hollow (the Wilds' dungeon, Lv 12) + Lumivex's Trial / Extreme: pure geometry (no imports), so world.js /
// constants.js / the renderer can use it without cycles. A chain of round, moss-lit grottoes far north of Frostveil
// (nothing else lives up there): three wave grottoes (south -> north), then the Moonlit Bower where Lumivex, the Moth
// Matriarch, holds court. The Trial and the Extreme are fought in the same Bower (sim/glowmire.js runs whichever was picked).
export const HOLLOW_NAME = 'The Glowmire Hollow';
export const HOLLOW_X = 0;
export const HOLLOW_ROOM_R = 430;
export const BOWER_R = 560;
export const HOLLOW_ROOMS = [
  { x: HOLLOW_X, y: 30600, r: HOLLOW_ROOM_R, name: 'Glowcap Grotto' },
  { x: HOLLOW_X, y: 31850, r: HOLLOW_ROOM_R, name: 'The Drowned Lanterns' },
  { x: HOLLOW_X, y: 33100, r: HOLLOW_ROOM_R, name: 'Thornroot Warren' },
  { x: HOLLOW_X, y: 34800, r: BOWER_R, name: 'The Moonlit Bower', bower: 1 },
];
export const BOWER = HOLLOW_ROOMS[3];
// Vharok's Trial / Extreme arena: the Stormcrown Tor, a round storm-lashed hilltop north of the Bower (same area helpers)
export const TOR = { x: HOLLOW_X, y: 37400, r: 600, name: 'The Stormcrown Tor', tor: 1 };
export const HOLLOW_BOUNDS = { x0: HOLLOW_X - 1000, x1: HOLLOW_X + 1000, y0: 29900, y1: 38300 };
const ALL = [...HOLLOW_ROOMS, TOR]; // index 4 = the Tor
export const roomOf = (i) => ALL[i];
export function hollowRoomAt(x, y, pad = 0) {
  for (let i = 0; i < ALL.length; i++) { const R = ALL[i]; if (Math.hypot(x - R.x, y - R.y) < R.r + pad) return i; }
  return -1;
}
export const inTorArea = (x, y, pad = 240) => Math.hypot(x - TOR.x, y - TOR.y) < TOR.r + pad;
export const inHollowArea = (x, y, pad = 240) => y > HOLLOW_BOUNDS.y0 && y < HOLLOW_BOUNDS.y1 && x > HOLLOW_BOUNDS.x0 && x < HOLLOW_BOUNDS.x1 && hollowRoomAt(x, y, pad) >= 0;
/** where a party arrives in grotto i (south rim) / the moss-door that leads on (north rim) */
export const hollowEntry = (i) => { const R = ALL[i]; return { x: R.x, y: R.y + R.r - 70 }; };
export const hollowDoor = (i) => { const R = ALL[i]; return R.bower || R.tor ? { x: R.x, y: R.y + R.r - 60 } : { x: R.x, y: R.y - R.r + 52 }; };
/** keep a circle inside its grotto; true if moved */
export function clampHollow(e) {
  const i = Math.max(0, hollowRoomAt(e.x, e.y, 260)), R = ALL[i], r = e.r || 0;
  const dx = e.x - R.x, dy = e.y - R.y, d = Math.hypot(dx, dy), max = R.r - r - 4;
  if (d <= max) return false;
  const k = max / (d || 1); e.x = R.x + dx * k; e.y = R.y + dy * k;
  return true;
}
export function hollowBlocked(x, y, r = 0) {
  const i = Math.max(0, hollowRoomAt(x, y, 260)), R = ALL[i];
  return Math.hypot(x - R.x, y - R.y) > R.r - r - 4;
}
/** the HUD zone inside the Hollow (id 12 = sim/mobhp.js ZONE_LV: mob level 12) */
/** the HUD zone on the Tor (a Trial) */
export const TOR_ZONE = { id: 12, name: 'The Stormcrown Tor', danger: 8, r0: 0, r1: 0, tier: 4, hollow: true, trial: true };
export const HOLLOW_ZONE = { id: 12, name: HOLLOW_NAME, danger: 4, r0: 0, r1: 0, tier: 4, hollow: true };
