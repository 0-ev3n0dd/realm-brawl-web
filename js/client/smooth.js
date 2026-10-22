// Render-side motion smoothing (client only: reads sim state, never writes it).
//  - facing: the drawn facing eases toward the target angle along the shortest arc (fast, frame-rate independent, never
//    snaps); during attacks / skills the target is the action's aim angle and the ease is faster still
//  - walk blend: legs, bob, cape sway fade in / out instead of popping when a hero starts / stops
//  - sub-tick animation time: action clocks advance between the 60 Hz sim ticks (smooth swings at any refresh rate)
//  - camera: a critically damped spring (smooth start AND stop, no overshoot)
//  - easing curves for swings, recoil and hit flashes
const TAU = Math.PI * 2;
export const SMOOTH = { face: 22, faceAct: 55, walkIn: 14, walkOut: 9, cam: 0.13 };
export const wrapAng = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
const clamp01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t);
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOutSine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
export const easeOutQuad = (t) => { t = clamp01(t); return t * (2 - t); };
export const smoothstep = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
/** ease-out with a small overshoot (weapon follow-through); s = overshoot amount */
export const easeOutBack = (t, s = 1.15) => { t = clamp01(t) - 1; return 1 + t * t * ((s + 1) * t + s); };

/** Ease angle `cur` toward `target` along the shortest arc; `rate` = 1/s time constant. Returns the new angle (unwrapped-safe). */
export function easeAngle(cur, target, dt, rate) {
  if (cur == null || !Number.isFinite(cur)) return target;
  const d = wrapAng(target - cur);
  if (Math.abs(d) < 1e-3) return target;
  return wrapAng(cur + d * (1 - Math.exp(-rate * Math.max(0, dt))));
}
/** The angle a hero should face: the current action's aim (attacks, skills, chain steps, Specials, ults), else the aim. */
export function facingTarget(e) {
  const a = e.action;
  return a && a.ang != null && a.kind !== 'dodge' && Number.isFinite(a.ang) ? a.ang : (Number.isFinite(e.aim) ? e.aim : 0);
}

/** Per-hero render state (facing, walk blend), keyed by player id. */
export class HeroSmoother {
  constructor() { this.m = new Map(); this.seen = 0; }
  /** call once per frame per drawn hero: returns { ang, walk } */
  update(e, dt) {
    let s = this.m.get(e.id);
    const tgt = facingTarget(e), acting = !!(e.action && e.action.kind !== 'dodge');
    if (!s) { s = { ang: tgt, walk: e.moving ? 1 : 0, act: null, f: 0 }; this.m.set(e.id, s); }
    const actKey = e.action ? e.action : null;
    s.ang = easeAngle(s.ang, tgt, dt, acting ? SMOOTH.faceAct : SMOOTH.face);
    s.act = actKey;
    const w = e.moving ? 1 : 0;
    s.walk += (w - s.walk) * (1 - Math.exp(-(w ? SMOOTH.walkIn : SMOOTH.walkOut) * dt));
    if (Math.abs(s.walk - w) < 0.002) s.walk = w;
    s.f = this.seen;
    return s;
  }
  /** drop heroes not drawn for a while */
  sweep() { this.seen++; if (this.seen % 120 === 0) for (const [id, s] of this.m) if (this.seen - s.f > 120) this.m.delete(id); }
}

/** Critically damped follow (SmoothDamp): moves o.x / o.y toward (tx, ty) with velocity kept in o.vx / o.vy. */
export function smoothFollow(o, tx, ty, dt, smoothTime = SMOOTH.cam) {
  // NaN guard: one bad frame of a target (or dt) used to poison the camera forever (NaN never compares > 600, so the cut
  // below never fired) -> no ground tiles, an empty minimap and every screen-space draw smeared over the stale frame
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) { if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) { o.x = o.x || 0; o.y = o.y || 0; } return; }
  if (!Number.isFinite(o.x) || !Number.isFinite(o.y) || !Number.isFinite(o.vx || 0) || !Number.isFinite(o.vy || 0)) { o.x = tx; o.y = ty; o.vx = o.vy = 0; return; }
  if (!(dt > 0)) return;
  const w = 2 / Math.max(1e-4, smoothTime), x = w * dt, k = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (const [p, v, t] of [['x', 'vx', tx], ['y', 'vy', ty]]) {
    const c = o[p] - t, tmp = ((o[v] || 0) + w * c) * dt;
    o[v] = ((o[v] || 0) - w * tmp) * k;
    o[p] = t + (c + tmp) * k;
  }
  if (Math.hypot(tx - o.x, ty - o.y) > 600) { o.x = tx; o.y = ty; o.vx = o.vy = 0; } // teleports / mission changes: cut
}
