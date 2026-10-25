// Keyboard + mouse -> sim input commands, through the rebindable key bindings (keybinds.js).
// Edge-triggered actions are latched until the next tick reads them. The sim command format is unchanged
// ({mx, my, ax, ay, attack, skill, dodge, ult}), so co-op input packing and the server are unaffected.
import { normalize } from './keybinds.js';
import { SkillHold } from './skillhold.js';

const EDGE = { skillQ: { skill: 'Q' }, skillE: { skill: 'E' }, skillR: { skill: 'R' }, skillF: { skill: 'F' }, special: { skill: 'SP' }, dodge: { dodge: true }, ult: { ult: true } };
const UI_ACTIONS = new Set(['inventory', 'combos', 'takeAll', 'mute', 'ping', 'interact', 'progress', 'forge', 'potion', 'journal', 'realmMap', 'bigMap']);

export class Input {
  constructor(canvas, keybinds) {
    this.kb = keybinds;
    this.keys = new Set(); // pressed codes (normalized; mouse buttons as 'Mouse0'..'Mouse4')
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };
    this.edges = [];
    this.ui = []; // UI actions for the game ('menu', 'inventory', 'combos', 'takeAll', 'mute', 'ping')
    this.enabled = true;
    this.hold = new SkillHold(); // Warrior hold-to-spend Rage
    this.canHold = () => false; // set by the game: (key) => a press of this skill may become a Rage hold
    this.capture = null; // the options menu sets this while waiting for a key: it gets the code instead of the game
    const always = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (this.capture) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) this.capture(e.code); return; }
      const code = normalize(e.code);
      if (always.has(e.code) || (code !== 'Escape' && this.kb.actionFor(code))) e.preventDefault();
      if (e.repeat) return;
      this.press(code);
    });
    addEventListener('keyup', (e) => this.release(normalize(e.code)));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; if (this.hold.cur) this.hold.release(this.hold.cur.key); });
    canvas.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.onCanvas = e.target === canvas; }); // (onCanvas: the drawn crosshair hides over menus / panels)
    if (typeof document !== 'undefined') document.addEventListener('mouseleave', () => { this.mouse.onCanvas = false; });
    canvas.addEventListener('mousedown', (e) => { if (this.capture) return; if (e.button === 1) e.preventDefault(); this.press('Mouse' + e.button); }); // (middle click: no autoscroll - it clears the target lock by default)
    addEventListener('mouseup', (e) => this.release('Mouse' + e.button));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('auxclick', (e) => e.preventDefault());
  }
  /** A key/mouse button went down: latch edge actions, queue UI actions. */
  press(code) {
    this.keys.add(code);
    if (code === 'Escape') { this.ui.push('menu'); return; }
    const id = this.kb.actionFor(code);
    if (!id) return;
    if (EDGE[id] && EDGE[id].skill) this.hold.press(EDGE[id].skill, this.enabled && this.canHold(EDGE[id].skill));
    else if (EDGE[id]) this.edges.push({ ...EDGE[id] });
    else if (UI_ACTIONS.has(id)) this.ui.push(id);
    if (id === 'sprint') { this.sprintOn = !this.sprintOn; this._sprK = null; } // sprint toggle (2026-10-19: out of combat only; ends on entering combat)
    if (id === 'attack') { this.mouse.down = true; this.lockPick = true; } // (a click on an enemy picks it as the lock at once)
    if (id === 'clearLock') this.lockClear = true; // (hover lock-on: drop the lock; read by aimlock.lockTick)
    if (id === 'cycleTarget') this.cycleTarget = true; // (next enemy: the Keyboard-only auto-target, or the hover lock; read by kbmode.kbTick / game.step)
  }
  release(code) {
    this.keys.delete(code);
    const id = this.kb.actionFor(code);
    if (id && EDGE[id] && EDGE[id].skill && !this.kb.held(id, this.keys)) this.hold.release(EDGE[id].skill);
    if (!this.kb.held('attack', this.keys)) this.mouse.down = false;
  }
  /** Build the per-tick input command for the sim. */
  command(aimWorld) {
    const k = this.keys, kb = this.kb;
    const mx = (kb.held('right', k) ? 1 : 0) - (kb.held('left', k) ? 1 : 0);
    const my = (kb.held('down', k) ? 1 : 0) - (kb.held('up', k) ? 1 : 0);
    const cmd = { mx, my, ax: aimWorld.x, ay: aimWorld.y, attack: this.enabled && kb.held('attack', k) };
    if (this.sprintOn && this.enabled) cmd.sprint = true;
    const h = this.hold.tick();
    if (this.enabled) {
      const e = this.edges.shift();
      if (e) { Object.assign(cmd, e); if (h.edge) this.hold.out.unshift(h.edge); }
      else if (h.edge) Object.assign(cmd, h.edge);
      if (h.hold) cmd.hold = h.hold;
    } else { this.edges.length = 0; this.hold.cancel(); }
    return cmd;
  }
  takeUi() { const u = this.ui; this.ui = []; return u; }
}
