import { CLASSES } from '../../js/sim/data/classes.js';
// Touch controls for the mobile client.
// The top half of this file is pure (no DOM) so it can be unit-tested under Node:
//   joystick mapping, auto-aim target selection, skill drag-aim, on-screen button layout.
// TouchControls (bottom half) turns multi-touch events into that state.

const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return Math.abs(d); };

/**
 * Floating joystick: finger offset (dx, dy) from the base -> movement vector in [-1, 1].
 * Inside the dead zone the stick is centred; beyond it the magnitude ramps smoothly to 1 at the rim.
 */
export function joystickVector(dx, dy, radius, dead = 0.14) {
  const len = Math.hypot(dx, dy);
  const d0 = radius * dead;
  if (!(len > d0) || radius <= 0) return { x: 0, y: 0, mag: 0 };
  const mag = clamp((len - d0) / (radius - d0), 0, 1);
  return { x: (dx / len) * mag, y: (dy / len) * mag, mag };
}

/** How far each class may auto-aim (world units): melee gets its lunge + charge distance. */
export const AUTO_AIM_RANGE = { warrior: 260, ranger: 580, mage: 540, cleric: 250, bladedancer: 280, samurai: 270, monk: 250, dragoon: 300, summoner: 520, bard: 440 };
/** Projectile speed of each class's basic attack, for target leading (0 = melee, no lead). */
export const LEAD_SPEED = { warrior: 0, ranger: 780, mage: 580, cleric: 0, bladedancer: 0, samurai: 0, monk: 0, dragoon: 0, summoner: 760, bard: 620 };

/**
 * Pick the enemy to auto-aim at. Score = distance/range, plus penalties for being away from the
 * direction the player is moving/facing, for untargetable states; the current target is sticky
 * (hysteresis) so the aim does not flicker between two similar enemies. Bosses get a small bonus.
 * @param enemies  sim enemies ({id,x,y,r,hp,dead,state,boss,elite})
 * @param p        {x, y}
 * @param opts     {range, dir (radians|null), prevId, obstacleBlocked(x1,y1,x2,y2)?}
 */
export function pickAutoTarget(enemies, p, opts = {}) {
  const range = opts.range ?? 500;
  const dir = opts.dir ?? null;
  let best = null, bestScore = Infinity;
  for (const e of enemies) {
    if (!e || e.dead || !(e.hp > 0)) continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    const d = Math.hypot(dx, dy) - (e.r || 0) * 0.5;
    const sticky = e.id === opts.prevId;
    if (d > range * (sticky ? 1.15 : 1)) continue;
    let s = Math.max(0, d) / range;
    if (dir != null && d > 60) s += 0.35 * (angDiff(Math.atan2(dy, dx), dir) / Math.PI);
    if (e.state === 'fade') s += 0.6;
    if (e.boss) s -= 0.18;
    else if (e.elite) s -= 0.04;
    if (opts.blocked && opts.blocked(p.x, p.y, e.x, e.y)) s += 0.5;
    if (sticky) s *= 0.7;
    if (s < bestScore) { bestScore = s; best = e; }
  }
  return best;
}

/** Aim point with simple linear lead for projectile classes (target velocity from its previous tick). */
export function leadPoint(p, e, projSpeed) {
  if (!projSpeed || e.px == null) return { x: e.x, y: e.y };
  const vx = (e.x - e.px) * 60, vy = (e.y - e.py) * 60;
  const t = Math.min(0.6, Math.hypot(e.x - p.x, e.y - p.y) / projSpeed);
  return { x: e.x + vx * t, y: e.y + vy * t };
}

/**
 * How each skill is aimed on touch:
 *   dir    - a direction (drag = direction, tap = auto-target or facing)
 *   ground - a point on the ground up to `range` (drag distance scales the distance)
 *   move   - blink: a point, tap goes where you are walking / facing (never auto-blinks into enemies)
 *   self   - centred on the hero (tap or drag both just cast)
 * `r` is the radius of the area it hits (for the aim preview).
 */
export const SKILL_AIM = {
  // Warrior (Weapon Master): Q Greatsword / E Twin Axes / R Warhammer (the chains they play aim at the same point: auto target)
  gs_cleave: { mode: 'self', r: 155 }, ax_flurry: { mode: 'dir', range: 120, r: 120 }, hm_skull: { mode: 'ground', range: 280, r: 115 },
  arsenal_toss: { mode: 'ground', range: 380, r: 95 }, // G: throw the drawn weapon (tap again = recall)
  warlord: { mode: 'ground', range: 320, r: 220 },
  dashshot: { mode: 'dir', range: 400, r: 9 }, pierce: { mode: 'dir', range: 700, r: 11 },
  volley: { mode: 'ground', range: 430, r: 115 }, trap: { mode: 'ground', range: 170, r: 34 },
  blink: { mode: 'move', range: 240, r: 16 }, blast: { mode: 'ground', range: 390, r: 105 },
  meteor: { mode: 'ground', range: 430, r: 140 }, nova: { mode: 'self', r: 150 },
  // Cleric
  smite: { mode: 'dir', range: 150, r: 95 }, sanctuary: { mode: 'ground', range: 300, r: 125 },
  shieldrush: { mode: 'dir', range: 210, r: 38 }, judgment: { mode: 'self', r: 150 },
  // Blade Dancer (heartseeker = a target point: tap auto-targets, drag picks the enemy nearest the point)
  flicker: { mode: 'dir', range: 190, r: 42 }, vanish: { mode: 'self', r: 60 },
  heartseeker: { mode: 'ground', range: 330, r: 40 }, thousandcuts: { mode: 'self', r: 340 },
  // Samurai: Q Iaido Slash (a line dash) / E Crescent Parry (around you) / R Sheathe (around you)
  iaido: { mode: 'dir', range: 250, r: 35 }, crescent_parry: { mode: 'self', r: 150 }, sheathe: { mode: 'self', r: 110 }, kesa_slash: { mode: 'dir', range: 160, r: 60 },
  // Monk: Q Tiger Fist (a short cone) / E Crane Kick (a short dash + spin) / R Flow State (around you)
  tiger_fist: { mode: 'dir', range: 110, r: 40 }, crane_kick: { mode: 'dir', range: 130, r: 60 }, flow_state: { mode: 'self', r: 140 }, iron_palm: { mode: 'dir', range: 125, r: 45 },
  // Dragoon: Q Piercing Thrust (a lunge) / E Sweeping Arc (around you) / R Jump (a landing point) / G Spear Throw (a long line)
  fire_sprites: { mode: 'ground', range: 460, r: 120 }, frost_wyrm: { mode: 'dir', range: 270, r: 60 }, thunder_roc: { mode: 'dir', range: 540, r: 50 }, turn_the_page: { mode: 'self', r: 150 }, legendary_page: { mode: 'ground', range: 520, r: 140 }, grimoire_unbound: { mode: 'self', r: 300 },
  sonic_riff: { mode: 'dir', range: 430, r: 37 }, echo_chord: { mode: 'ground', range: 480, r: 80 }, healing_hymn: { mode: 'self', r: 380 }, dissonance: { mode: 'dir', range: 240, r: 60 }, crescendo: { mode: 'self', r: 330 }, encore: { mode: 'self', r: 290 },
  piercing_thrust: { mode: 'dir', range: 260, r: 30 }, sweeping_arc: { mode: 'self', r: 170 }, jump: { mode: 'ground', range: 420, r: 120 }, spear_throw: { mode: 'dir', range: 560, r: 25 },
  // Specials (the SPECIAL button; F on desktop)
  warlords_decree: { mode: 'self', r: 320 }, storm_of_arrows: { mode: 'ground', range: 470, r: 210 }, grand_meteor: { mode: 'ground', range: 470, r: 220 },
  divine_hammer: { mode: 'ground', range: 420, r: 190 }, shadow_clone: { mode: 'self', r: 160 }, void_draw: { mode: 'dir', range: 900, r: 60 }, dragons_descent: { mode: 'ground', range: 400, r: 210 }, dragons_roar: { mode: 'dir', range: 640, r: 70 },
  // Ultimates (the big T button)
  arrowstorm: { mode: 'ground', range: 480, r: 190 },
  ultmeteor: { mode: 'ground', range: 480, r: 220 }, ascension: { mode: 'self', r: 230 }, eclipse: { mode: 'self', r: 60 }, void_blade: { mode: 'self', r: 90 }, dragon_form: { mode: 'self', r: 200 }, awakened_spirit: { mode: 'self', r: 170 },
};

/**
 * World point a dragged skill button aims at. (dx, dy) is the finger offset from where the drag
 * started, `dragMax` the finger distance that means "full range".
 */
export function skillDragPoint(skillId, p, dx, dy, dragMax) {
  const a = SKILL_AIM[skillId] || { mode: 'dir', range: 300 };
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const ux = dx / len, uy = dy / len;
  if (a.mode === 'ground' || a.mode === 'move') {
    const dist = clamp(len / dragMax, 0.12, 1) * a.range;
    return { x: p.x + ux * dist, y: p.y + uy * dist };
  }
  const dist = Math.max(a.range || 200, 120);
  return { x: p.x + ux * dist, y: p.y + uy * dist };
}

/**
 * World point for a TAPPED skill (no drag): auto-target where it makes sense.
 * @param facing  radians the hero faces; @param move {x,y} joystick vector
 */
export function skillTapPoint(skillId, p, target, facing, move) {
  const a = SKILL_AIM[skillId] || { mode: 'dir', range: 300 };
  const moving = move && Math.hypot(move.x, move.y) > 0.2;
  const dirAng = moving ? Math.atan2(move.y, move.x) : facing;
  if (a.mode === 'move') return { x: p.x + Math.cos(dirAng) * a.range, y: p.y + Math.sin(dirAng) * a.range };
  if (target && a.mode === 'ground') {
    const dx = target.x - p.x, dy = target.y - p.y, d = Math.hypot(dx, dy);
    const k = d > a.range ? a.range / d : 1;
    return { x: p.x + dx * k, y: p.y + dy * k };
  }
  if (target) return { x: target.x, y: target.y };
  const dist = a.mode === 'ground' ? a.range * 0.6 : Math.max(a.range || 200, 120);
  const ang = a.mode === 'self' ? facing : dirAng;
  return { x: p.x + Math.cos(ang) * dist, y: p.y + Math.sin(ang) * dist };
}

/** Keys that continue a primed chain -> which buttons glow. 'B3' is the attack button. */
export function chainHighlights(primed) {
  const out = new Set();
  for (const c of primed) out.add(/^B(\d|S)$/.test(c.next) ? 'ATK' : c.next === 'F+' ? 'F' : c.next);
  return out;
}

export const JOY_RADIUS = { S: 50, M: 62, L: 76 };

/**
 * On-screen button layout (CSS px). Attack bottom-right, the four skills on an arc around it,
 * dodge to their left. Everything respects the safe-area insets and scales for tablets.
 */
export function layoutControls(w, h, safe = { l: 0, r: 0, t: 0, b: 0 }, joySize = 'M', opts = {}) {
  const s = clamp(Math.min(w, h) / 390, 0.85, 1.45);
  const atkR = 46 * s, skR = 30 * s, dgR = 29 * s;
  const ax = w - safe.r - 30 * s - atkR, ay = h - safe.b - 18 * s - atkR;
  const R = atkR + skR + 26 * s;
  const keys = opts.keys || ['Q', 'E', 'R', 'F']; // (every class now has four: Q / E / R / G; a 3-key list still spreads over the same arc)
  const angs = (keys.length === 3 ? [180, 228, 276] : [178, 216, 254, 292]).map((d) => (d * Math.PI) / 180);
  const buttons = [{ id: 'ATK', x: ax, y: ay, r: atkR }];
  keys.forEach((k, i) => buttons.push({ id: k, x: ax + Math.cos(angs[i]) * R, y: ay + Math.sin(angs[i]) * R, r: skR }));
  const q = buttons[1], rr = buttons[Math.min(3, keys.length)];
  if (w >= h) buttons.push({ id: 'DODGE', x: q.x - skR - 20 * s - dgR, y: h - safe.b - 16 * s - dgR, r: dgR });
  else buttons.push({ id: 'DODGE', x: rr.x - 6 * s, y: rr.y - skR - 18 * s - dgR, r: dgR }); // portrait: above the arc
  // big ULTIMATE button: above the skill arc in landscape, left of dodge in portrait (tap = auto-aim, drag = aim)
  // SPECIAL button (the 4th slot, F on desktop): a bigger, class-coloured button on the outer ring, up-left of the arc
  const spR = 34 * s;
  const ultR = 42 * s, dg = buttons.find((b) => b.id === 'DODGE');
  if (opts.special !== false) {
    if (w >= h) { const sa = (208 * Math.PI) / 180, sd = R + skR + spR + 14 * s; buttons.push({ id: 'SP', x: ax + Math.cos(sa) * sd, y: ay + Math.sin(sa) * sd, r: spR }); }
    else buttons.push({ id: 'SP', x: dg.x + 4 * s, y: dg.y - dgR - 16 * s - spR, r: spR }); // portrait: above dodge (ULT sits left of dodge)
  }
  if (w >= h) { const ua = (264 * Math.PI) / 180, ud = R + skR + ultR + 12 * s; buttons.push({ id: 'T', x: ax + Math.cos(ua) * ud, y: ay + Math.sin(ua) * ud, r: ultR }); }
  else buttons.push({ id: 'T', x: dg.x - dgR - 14 * s - ultR, y: dg.y - 4 * s, r: ultR });
  { const d = buttons.find((b) => b.id === 'DODGE'), sp = buttons.find((b) => b.id === 'SP'); // the Dodge and SPECIAL buttons swap places (same bindings; bottom edges kept)
    if (d && sp) { const dx = d.x, dy = d.y; d.x = sp.x; d.y = sp.y; sp.x = dx; sp.y = dy - (sp.r - d.r); } }
  const joyR = (JOY_RADIUS[joySize] || JOY_RADIUS.M) * s;
  const jx = safe.l + 34 * s + joyR, jy = h - safe.b - 26 * s - joyR, spr = 24 * s; // (2026-10-19: the SPRINT toggle sits right of the move stick's home, left half: not a right-hand button)
  return {
    scale: s, buttons,
    joy: { r: joyR, homeX: jx, homeY: jy, zoneMaxX: w * 0.5 },
    sprint: { x: Math.min(w * 0.5 - spr - 4 * s, jx + joyR + 30 * s + spr), y: Math.min(h - safe.b - spr - 6 * s, jy + joyR * 0.35), r: spr },
    dragMax: 70 * s,
    cancel: { x: w / 2, y: safe.t + 70 * s, r: 34 * s },
  };
}

/** Button under a point (with a finger-friendly margin), or null. */
export function hitButton(layout, x, y, pad = 1.18) {
  let best = null, bd = Infinity;
  for (const b of layout.buttons) {
    const d = Math.hypot(x - b.x, y - b.y);
    if (d <= b.r * pad && d < bd) { bd = d; best = b; }
  }
  return best;
}


// ------------------------------------------------------------------ DOM: multi-touch tracking
/** Holding a skill button this long without dragging shows its tooltip instead of casting (a short tap still casts). */
export const LONG_PRESS_MS = 450;
/** Warrior hold-to-spend Rage on the phone: a skill button held past `tapMs` charges an empowered (🔥) cast, `fullMs` fires it
 *  on its own (same thresholds as the desktop, from the class data's rage rules). While a press can be a hold, a long-press
 *  charges instead of opening the tooltip (the tooltip still opens when there is no Rage to spend). */
export const HOLD_MS = { tapMs: 250, fullMs: 500 }; // (no class holds skills now; kept for the hold plumbing)
const msToTicks = (ms) => Math.round(ms * 60 / 1000);
export class TouchControls {
  constructor(el, getLayout) {
    this.el = el;
    this.getLayout = getLayout;
    this.touches = new Map(); // identifier -> {role, id, sx, sy, x, y, maxD}
    this.move = { x: 0, y: 0 };
    this.joy = null;          // {bx, by, x, y} while a movement finger is down
    this.attack = { held: false, manual: false, dx: 0, dy: 0 };
    this.skillDrag = null;    // {key, dx, dy, manual, overCancel}
    this.pressed = new Set(); // button ids currently held (for visuals)
    this.edges = [];          // {skill, manual, dx, dy} | {dodge}
    this.enabled = true;
    this.onAnyTouch = null;
    this.tip = null;          // {key, x, y} while a long-pressed skill button shows its tooltip
    this.canHold = () => false; // (key) => this press may become a Rage hold (set by the game for the Warrior)
    this.canRhythm = () => false; // (key) => the Warrior's rhythm window is open for this key: the touch fires at once (no hold / tooltip wait)
    this.now = () => performance.now();
    const opt = { passive: false };
    this.h = {
      start: (e) => this.onStart(e), move: (e) => this.onMove(e),
      end: (e) => this.onEnd(e, false), cancel: (e) => this.onEnd(e, true),
    };
    el.addEventListener('touchstart', this.h.start, opt);
    el.addEventListener('touchmove', this.h.move, opt);
    el.addEventListener('touchend', this.h.end, opt);
    el.addEventListener('touchcancel', this.h.cancel, opt);
    // mouse fallback so the mobile page can be tried on a PC (one "finger")
    this.m = {
      down: (e) => { if (e.pointerType !== 'mouse') return; this.begin('mouse', e.clientX, e.clientY); },
      move: (e) => { if (e.pointerType !== 'mouse' || !this.touches.has('mouse')) return; this.drag('mouse', e.clientX, e.clientY); },
      up: (e) => { if (e.pointerType !== 'mouse' || !this.touches.has('mouse')) return; this.finish('mouse', e.clientX, e.clientY, false); },
    };
    el.addEventListener('pointerdown', this.m.down);
    addEventListener('pointermove', this.m.move);
    addEventListener('pointerup', this.m.up);
  }
  destroy() {
    const el = this.el;
    el.removeEventListener('touchstart', this.h.start); el.removeEventListener('touchmove', this.h.move);
    el.removeEventListener('touchend', this.h.end); el.removeEventListener('touchcancel', this.h.cancel);
    el.removeEventListener('pointerdown', this.m.down); removeEventListener('pointermove', this.m.move); removeEventListener('pointerup', this.m.up);
  }
  /** Drop every finger (e.g. when a menu opens or the app goes to the background). */
  reset() {
    this.touches.clear(); this.move = { x: 0, y: 0 }; this.joy = null; this.skillDrag = null; this.tip = null;
    this.attack = { held: false, manual: false, dx: 0, dy: 0 }; this.pressed.clear(); this.edges.length = 0;
  }

  onStart(e) {
    e.preventDefault();
    if (this.onAnyTouch) this.onAnyTouch();
    for (const t of e.changedTouches) this.begin(t.identifier, t.clientX, t.clientY);
  }
  onMove(e) { e.preventDefault(); for (const t of e.changedTouches) this.drag(t.identifier, t.clientX, t.clientY); }
  onEnd(e, cancelled) { e.preventDefault(); for (const t of e.changedTouches) this.finish(t.identifier, t.clientX, t.clientY, cancelled); }

  begin(id, x, y) {
    if (!this.enabled) return;
    const L = this.getLayout();
    if (this.mapAt && this.mapAt(x, y) && this.onMapTap && this.onMapTap(x, y)) return; // the open big map owns taps on it (icons, Travel to Town) even over a HUD button
    if (L.sprint && Math.hypot(x - L.sprint.x, y - L.sprint.y) <= L.sprint.r * 1.15) { this.sprintOn = !this.sprintOn; this._sprK = null; this.sprintAt = this.now(); this.touches.set(id, { role: 'sprint', id: 'SPRINT', sx: x, sy: y, x, y, maxD: 0, t0: this.now() }); return; } // sprint toggle (works out of combat only)
    const b = hitButton(L, x, y);
    const rec = { role: null, id: null, sx: x, sy: y, x, y, maxD: 0, t0: this.now(), tip: false, hold: false, fired: false };
    if (b) {
      rec.id = b.id;
      if (b.id === 'ATK') { rec.role = 'attack'; this.attack = { held: true, manual: false, dx: 0, dy: 0 }; }
      else if (b.id === 'DODGE') { rec.role = 'dodge'; this.edges.push({ dodge: true }); }
      else if (b.id !== 'T' && this.canRhythm(b.id)) { rec.role = 'skill'; rec.fired = true; rec.rhythm = true; this.edges.push({ skill: b.id, manual: false, dx: 0, dy: 0 }); } // rhythm press: fire on touch-down (auto-aim)
      else { if (this.skillDrag) return; rec.role = 'skill'; rec.hold = b.id !== 'T' && !!this.canHold(b.id); this.skillDrag = { key: b.id, dx: 0, dy: 0, manual: false, overCancel: false }; }
      this.pressed.add(b.id);
    } else if (this.onMapTap && this.onMapTap(x, y)) { return; // the big map: tap the minimap to open, tap anywhere (but a button) to close
    } else if (x < L.joy.zoneMaxX && !this.joy) {
      rec.role = 'move';
      this.joy = { bx: x, by: y, x, y };
    } else return;
    this.touches.set(id, rec);
  }
  drag(id, x, y) {
    const rec = this.touches.get(id);
    if (!rec) return;
    rec.x = x; rec.y = y;
    const dx = x - rec.sx, dy = y - rec.sy, d = Math.hypot(dx, dy);
    rec.maxD = Math.max(rec.maxD, d);
    const L = this.getLayout();
    const dead = 16 * L.scale;
    if (rec.role === 'move') {
      const R = L.joy.r;
      // the base follows the finger if it goes past the rim (no "stuck at the edge" feeling)
      if (d > R) { const k = (d - R) / d; this.joy.bx += dx * k; this.joy.by += dy * k; rec.sx = this.joy.bx; rec.sy = this.joy.by; }
      this.joy.x = x; this.joy.y = y;
      const v = joystickVector(x - this.joy.bx, y - this.joy.by, R);
      this.move = { x: v.x, y: v.y };
    } else if (rec.role === 'attack') {
      if (d > dead) this.attack = { held: true, manual: true, dx, dy };
      else if (this.attack.manual) this.attack = { ...this.attack, dx, dy };
    } else if (rec.role === 'skill' && this.skillDrag) {
      const c = L.cancel;
      this.skillDrag = { key: rec.id, dx, dy, manual: rec.maxD > dead, overCancel: rec.maxD > dead && Math.hypot(x - c.x, y - c.y) < c.r * 1.3 };
    }
  }
  finish(id, x, y, cancelled) {
    const rec = this.touches.get(id);
    if (!rec) return;
    this.touches.delete(id);
    if (rec.id) this.pressed.delete(rec.id);
    if (rec.role === 'move') { this.joy = null; this.move = { x: 0, y: 0 }; }
    else if (rec.role === 'attack') this.attack = { held: false, manual: false, dx: 0, dy: 0 };
    else if (rec.role === 'skill') {
      if (rec.tip) { if (this.tip && this.tip.key === rec.id) this.tip = null; return; } // long-press: tooltip only
      if (rec.fired) return; // (a full charge already fired on its own)
      const sd = this.skillDrag; this.skillDrag = null;
      if (cancelled || !sd || sd.overCancel) return;
      const L = this.getLayout();
      const dx = x - rec.sx, dy = y - rec.sy;
      const manual = rec.maxD > 16 * L.scale && Math.hypot(dx, dy) > 8 * L.scale;
      const held = rec.hold ? this.now() - rec.t0 : 0;
      this.edges.push(held >= HOLD_MS.tapMs ? { skill: rec.id, manual, dx, dy, charge: msToTicks(Math.min(held, HOLD_MS.fullMs)) } : { skill: rec.id, manual, dx, dy });
    }
  }
  /** Per frame: a skill button held still for LONG_PRESS_MS becomes a tooltip press (it will not cast on release). */
  poll() {
    if (!this.enabled) return this.tip;
    const L = this.getLayout(), dead = 16 * L.scale, now = this.now();
    for (const rec of this.touches.values()) {
      if (rec.role === 'skill' && rec.hold && !rec.fired && now - rec.t0 >= HOLD_MS.fullMs) { // full charge: fire on its own (aimed by the drag so far)
        const sd = this.skillDrag; rec.fired = true; this.skillDrag = null;
        if (sd && sd.key === rec.id && !sd.overCancel) this.edges.push({ skill: rec.id, manual: sd.manual, dx: sd.dx, dy: sd.dy, charge: msToTicks(HOLD_MS.fullMs) });
        continue;
      }
      if (rec.role !== 'skill' || rec.hold || rec.tip || rec.maxD > dead || now - rec.t0 < LONG_PRESS_MS) continue;
      if (!this.skillDrag || this.skillDrag.key !== rec.id) continue;
      rec.tip = true; this.skillDrag = null; // no aim preview, no cast
      this.tip = { key: rec.id, x: rec.sx, y: rec.sy };
    }
    return this.tip;
  }
  /** The skill button being held for a Rage hold right now: { key, t (ticks held), charging (past the tap threshold) } or null. */
  holdState() {
    if (!this.enabled) return null;
    for (const rec of this.touches.values()) {
      if (rec.role !== 'skill' || !rec.hold || rec.fired) continue;
      const ms = this.now() - rec.t0;
      return { key: rec.id, t: msToTicks(ms), charging: ms >= HOLD_MS.tapMs, k: Math.max(0, Math.min(1, (ms - HOLD_MS.tapMs) / (HOLD_MS.fullMs - HOLD_MS.tapMs))) };
    }
    return null;
  }
  /** Next edge action (one per sim tick, like the desktop input). */
  takeEdge() { return this.enabled ? this.edges.shift() || null : (this.edges.length = 0, null); }
}
