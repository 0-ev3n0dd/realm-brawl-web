// Game feel (experience pass 1): hit-stop scaled by hit weight, impact punch on the camera, a knockback kick on the
// struck enemy's sprite, and the screen-shake strength (Options > Feel & audio). Client only: reads sim events, never
// writes sim state. In solo the hit-stop freezes the local sim for a few frames (Game.frame skips steps); online it is
// visual only (the sim already has per-entity hitstop from the attack data).
const hasLS = typeof localStorage !== 'undefined';
const KEY = 'rb.feel';
function load() { try { return hasLS ? JSON.parse(localStorage.getItem(KEY) || '{}') : {}; } catch { return {}; } }
const saved = load();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const feelPref = {
  shake: Number.isFinite(saved.shake) ? clamp(saved.shake, 0, 1.5) : 1, // 0..150 %
  hitstop: saved.hitstop !== false,
  setShake(v) { this.shake = clamp(+v || 0, 0, 1.5); this.save(); },
  setHitstop(v) { this.hitstop = !!v; this.save(); },
  save() { try { if (hasLS) localStorage.setItem(KEY, JSON.stringify({ shake: this.shake, hitstop: this.hitstop })); } catch { /* private mode */ } },
};

/**
 * Weight of one hit, 0..1: light basics ~0.1, heavies ~0.45, heavy crits ~0.7, finishers / big numbers ~0.9+.
 * dmgFrac (optional) = damage / target max HP: a hit that takes a big bite feels heavier.
 */
export function hitWeight(ev, dmgFrac = 0) {
  if (!ev || ev.style === 'bleed') return 0;
  let w = 0.1;
  if (ev.heavy) w += 0.35;
  if (ev.crit) w += 0.18;
  if (ev.sharp || ev.perfect) w += 0.08;
  if (ev.big || ev.bigNum) w += 0.35;
  if (ev.clone) w *= 0.5; // (shadow clones / echoes: many small taps)
  w += clamp(dmgFrac, 0, 1) * 0.5;
  return clamp(w, 0, 1);
}
/** Hit-stop length in ms for a weight (0 below the light-hit threshold, then 30..110 ms). */
export const hitStopMs = (w) => (w < 0.25 ? 0 : Math.round(30 + 80 * clamp((w - 0.25) / 0.75, 0, 1)));
/** Extra stop on a kill by the local player. */
export const killStopMs = (ev) => (ev.boss ? 0 : ev.elite ? 90 : 45); // (boss kills already get the slow-mo finale)

/** id -> { ang, w, t } : the struck enemy's sprite is pushed along the hit for ~120 ms (art.js drawEnemy). */
export const enemyKick = new Map();
const KICK_S = 0.13;
/** offset + squash for an enemy this frame, or null */
export function kickOf(id, now = perf()) {
  const k = enemyKick.get(id); if (!k) return null;
  const a = (now - k.t) / 1000 / KICK_S;
  if (a >= 1) { enemyKick.delete(id); return null; }
  const e = Math.sin(Math.PI * Math.min(1, a * 1.6)) * (1 - a); // out fast, settle back
  const d = (3 + 9 * k.w) * e;
  return { dx: Math.cos(k.ang) * d, dy: Math.sin(k.ang) * d, sq: 0.1 * k.w * e };
}
const perf = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class Feel {
  constructor() { this.stopT = 0; this.coolT = 0; this.budget = 0; this.lastDmg = new Map(); }
  /** an event from the sim; game = the client Game / NetGame (player, fx, sim). Returns hit-stop seconds requested (0 = none). */
  handle(ev, game) {
    const p = game.player; if (!p) return 0;
    const me = ev.pid === p.id;
    if (ev.type === 'dmg' && ev.team === 'enemy' && me) { this.lastDmg.set(ev.id, ev.amount); if (this.lastDmg.size > 64) this.lastDmg.delete(this.lastDmg.keys().next().value); return 0; }
    if (ev.type === 'hit' && me) {
      const e = game.sim && game.sim.enemyById ? game.sim.enemyById.get(ev.id) : null;
      const dmg = this.lastDmg.get(ev.id) || 0, frac = e && e.maxHp ? dmg / e.maxHp : 0;
      const w = hitWeight(ev, frac);
      const ang = Math.atan2(ev.y - p.y, ev.x - p.x);
      enemyKick.set(ev.id, { ang: Number.isFinite(ang) ? ang : 0, w, t: perf() });
      if (enemyKick.size > 80) enemyKick.delete(enemyKick.keys().next().value);
      if (game.fx && w > 0.2) game.fx.punch(ang, 2 + 10 * w);
      return this.stop(hitStopMs(w));
    }
    if (ev.type === 'death' && ev.killer === p.id) return this.stop(killStopMs(ev));
    if (ev.type === 'hurt' && me) { if (game.fx) game.fx.shake(0.12); return 0; }
    if (ev.type === 'playerDeath' && me) { if (game.fx) game.fx.shake(0.6); return 0; }
    return 0;
  }
  /** request a stop; rapid multi-hits take the max (never the sum), at most ~220 ms of freeze per second, a 40 ms gap between stops */
  stop(ms) {
    if (!feelPref.hitstop || !(ms > 0)) return 0;
    if (this.stopT <= 0 && this.coolT > 0) return 0;
    const s = Math.min(ms / 1000, Math.max(0, 0.22 - this.budget));
    if (s <= 0.01) return 0;
    if (s > this.stopT) { this.budget += s - Math.max(0, this.stopT); this.stopT = s; }
    return this.stopT;
  }
  /** per frame: returns true while the hit-stop holds (the caller skips sim steps) */
  update(dt) {
    this.budget = Math.max(0, this.budget - dt * 0.22);
    if (this.stopT > 0) { this.stopT -= dt; if (this.stopT <= 0) { this.stopT = 0; this.coolT = 0.04; } return true; }
    if (this.coolT > 0) this.coolT -= dt;
    return false;
  }
}
