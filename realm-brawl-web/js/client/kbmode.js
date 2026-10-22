// Keyboard-only control mode (desktop, 2026-10-06): plays like the phone build with auto-target, no mouse needed.
// Options > Controls > Control mode: 'Mouse + Keyboard' (default) / 'Keyboard only' (rb.controlMode). In Keyboard only:
//  - the auto-target is the phone's (mobile/js/touch.js pickAutoTarget: nearest enemy in the class's auto-aim range,
//    bosses and elites preferred, ahead of where you walk), and it is STICKY: it stays on that enemy until it dies or
//    leaves KEEP range (1.6x the auto-aim range, at least 480) - a pack walking past never steals it;
//  - Cycle target (L / B) steps to the next enemy around you (nearest first, wrapping), Clear target (`) drops it;
//  - basics and aimed skills face the target (projectile classes lead it), ground skills land on it (clamped to range),
//    dashes / directional skills go at it, or the way you walk when there is no target (touch.js skillTapPoint);
//  - the aim is a world point in the normal input command, so co-op sends it exactly like the phone does.
// Pure module (no DOM) apart from the localStorage-backed pref; tests inject the storage.
import { pickAutoTarget, leadPoint, skillTapPoint, AUTO_AIM_RANGE, LEAD_SPEED } from '../../mobile/js/touch.js';
import { CLASSES } from '../sim/data/classes.js';

export const CONTROL_KEY = 'rb.controlMode';
export const KBT = { keepMul: 1.6, keepMin: 480, cycleMin: 640, overrideTicks: 18, faceLen: 200 };
const alive = (e) => !!e && !e.dead && e.hp > 0 && e.state !== 'fade';
const safeStore = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };

/** 'mouse' | 'keyboard' from a storage (anything else = 'mouse'). */
export function loadControlMode(storage = safeStore()) { try { return storage && storage.getItem(CONTROL_KEY) === 'keyboard' ? 'keyboard' : 'mouse'; } catch { return 'mouse'; } }
export function saveControlMode(storage = safeStore(), mode) { const m = mode === 'keyboard' ? 'keyboard' : 'mouse'; try { storage && storage.setItem(CONTROL_KEY, m); } catch { /* storage off */ } return m; }
/** The live pref (cached: read every input tick). */
export const controlMode = {
  _v: null,
  get value() { if (this._v === null) this._v = loadControlMode(); return this._v; },
  get keyboard() { return this.value === 'keyboard'; },
  set(mode) { this._v = saveControlMode(safeStore(), mode); return this._v; },
};

/** Keyboard only: skill text written for the mouse reads for the auto-target ("at the cursor" -> "on your target"). */
export function kbText(s) {
  return String(s).replace(/\b(at|on|to|toward|towards|under) the (cursor|mouse)\b/g, (m, w) => (/^to/.test(w) ? 'toward your target' : 'on your target')).replace(/\bthe (cursor|mouse)\b/g, 'your target');
}
export const skillIdFor = (cls, key) => (key === 'T' ? CLASSES[cls].ult.id : (CLASSES[cls].skills[key] || { id: 'basic' }).id);
export const autoRange = (cls) => AUTO_AIM_RANGE[cls] || 500;
export const keepRange = (cls) => Math.max(autoRange(cls) * KBT.keepMul, KBT.keepMin);

/**
 * Cycle: the next living enemy after `cur` in nearest-first order within `range` of the hero (wraps; no `cur` = nearest).
 * Returns `cur` when it is the only one, null when there is nothing.
 */
export function cycleNext(enemies, p, cur, range) {
  const list = enemies.filter((e) => alive(e) && Math.hypot(e.x - p.x, e.y - p.y) <= range + (e.r || 0))
    .sort((a, b) => (Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)) || (a.id - b.id));
  if (!list.length) return null;
  const i = cur ? list.findIndex((e) => e.id === cur.id) : -1;
  return list[(i + 1) % list.length];
}

/** Auto-target state + the aim it puts in the command (one per game session). */
export class KbAim {
  constructor() { this.reset(); }
  reset() { this.id = 0; this.since = 0; this.manual = false; this.lastAim = { x: 1, y: 0 }; this.override = null; this.why = ''; }
  /**
   * Per input tick. o: { move: {x, y} (the movement keys), cycle, clear (edges), blocked(x1,y1,x2,y2) }.
   * Returns the target (or null).
   */
  update(enemies, p, o = {}) {
    if (!p || p.dead) { this.id = 0; return null; }
    const cls = p.cls, mv = o.move || { x: 0, y: 0 }, moving = Math.hypot(mv.x, mv.y) > 0.15;
    let cur = this.id ? enemies.find((e) => e.id === this.id) : null;
    if (o.clear) { cur = null; this.id = 0; this.manual = false; this.why = 'cleared'; }
    if (cur && !alive(cur)) { cur = null; this.why = 'dead'; }
    if (cur && Math.hypot(cur.x - p.x, cur.y - p.y) - (cur.r || 0) * 0.5 > keepRange(cls)) { cur = null; this.why = 'range'; }
    if (o.cycle) { const nx = cycleNext(enemies, p, cur, Math.max(keepRange(cls), KBT.cycleMin)); if (nx) { if (!cur || nx.id !== cur.id) this.since = 0; cur = nx; this.manual = true; this.why = 'cycle'; } }
    if (!cur) {
      this.manual = false;
      cur = pickAutoTarget(enemies, p, { range: autoRange(cls), dir: moving ? Math.atan2(mv.y, mv.x) : (p.aim ?? null), prevId: 0, blocked: o.blocked });
      if (cur) this.since = 0;
    }
    if (cur && cur.id !== this.id) this.since = 0;
    this.id = cur ? cur.id : 0;
    if (cur) this.since++;
    return cur;
  }
  /**
   * Point the command's aim like the phone does: a skill press that tick aims by its kind (touch.js skillTapPoint) and
   * holds that point for a few ticks so the cast starts facing it; otherwise basics face the (led) target, else the way
   * you walk, else the last facing. Mutates and returns `cmd`.
   */
  aim(cmd, p, target) {
    if (!p) return cmd;
    const cls = p.cls, mv = { x: cmd.mx || 0, y: cmd.my || 0 }, ml = Math.hypot(mv.x, mv.y), moving = ml > 0.15;
    if (moving) { mv.x /= ml; mv.y /= ml; }
    let ax = null, ay = null;
    const o = this.override;
    if (o && o.ttl > 0) { ax = o.x; ay = o.y; o.ttl--; if (p.action && p.action.kind === 'skill' && p.action.key === o.key) this.override = null; }
    else if (target) { const lp = leadPoint(p, target, LEAD_SPEED[cls] || 0); ax = lp.x; ay = lp.y; }
    else if (moving) { ax = p.x + mv.x * KBT.faceLen; ay = p.y + mv.y * KBT.faceLen; }
    else { ax = p.x + this.lastAim.x * KBT.faceLen; ay = p.y + this.lastAim.y * KBT.faceLen; }
    const dl = Math.hypot(ax - p.x, ay - p.y);
    if (dl > 1) this.lastAim = { x: (ax - p.x) / dl, y: (ay - p.y) / dl };
    const key = cmd.ult ? 'T' : cmd.skill;
    if (key) {
      const pt = skillTapPoint(skillIdFor(cls, key), p, target ? leadPoint(p, target, 900) : null, Math.atan2(this.lastAim.y, this.lastAim.x), mv);
      if (pt) { ax = pt.x; ay = pt.y; this.override = { x: pt.x, y: pt.y, key, ttl: KBT.overrideTicks }; }
    }
    cmd.ax = ax; cmd.ay = ay;
    return cmd;
  }
}

/** One tick for a game (game.js / netgame.js): update the target from the input edges, then aim the command. */
export function kbTick(state, { enemies, player, input, cmd, blocked, active = true }) {
  const cycle = !!input.cycleTarget, clear = !!input.lockClear;
  input.cycleTarget = false; input.lockClear = false; input.lockPick = false;
  const t = state.update(enemies, player, { move: { x: cmd.mx || 0, y: cmd.my || 0 }, cycle: cycle && active, clear: clear && active, blocked });
  state.aim(cmd, player, t);
  return t;
}

/** The current auto-target in a (possibly different) enemy list, e.g. the rendered co-op view. */
export function kbLockTarget(state, enemies) { if (!state || !state.id) return null; const e = enemies.find((q) => q.id === state.id); return alive(e) ? e : null; }

/** Mouse + Keyboard: Cycle target (B) steps the hover lock to the next enemy around the hero (nearest first). */
export function cycleLock(lock, enemies, p, renderer, on = true) {
  if (!on || !p) return null;
  const zoom = (renderer.eff || renderer.cam).zoom || 1, viewW = (renderer.w || 1600) / zoom;
  const nx = cycleNext(enemies, p, lock.find(enemies), viewW * 0.75);
  if (nx) lock.take(nx);
  return nx;
}
