// Desktop HUD tooltips: hovering a skill slot (combo, Q/E/R/F, dodge, ult), the ult bar or its rotation dots shows a
// panel built by tooltips.js (live numbers from the class data, current key bindings, meter/rotation state).
import { slotTooltip, tooltipHTML } from './tooltips.js';
import { uiOn, iconStyle, skillIconKey } from './uipaint.js';
import { controlMode, kbText } from './kbmode.js';

export class HudTip {
  constructor(game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.id = 'hudTip'; this.el.className = 'rb-tip hidden';
    document.body.appendChild(this.el);
    this.cur = null; this.sig = ''; this.t = 0;
    const m0 = game.input && game.input.mouse; this.mx = m0 ? m0.x : 0; this.my = m0 ? m0.y : 0; this.mt = -1e9;
  }
  /** Call once per frame after the HUD is drawn. */
  update(dt) {
    const g = this.game, m = g.input.mouse, hud = g.hud;
    const now = performance.now();
    if (m.x !== this.mx || m.y !== this.my) { this.mx = m.x; this.my = m.y; this.mt = now; }
    const idleMouse = controlMode.keyboard && !(now - (this.mt || -1e9) < 2500); // (Keyboard only: a mouse parked over the skill bar does not pop tooltips; nudge it to read one)
    const blocked = idleMouse || g.paused || (g.menuHub && g.menuHub.isOpen()) || (g.options && g.options.isOpen()) || (g.ui && g.ui.invOpen && m.x > innerWidth - 500) || !g.player || (hud.bigMap && hud.bigMap.open); // (the open big map owns the mouse: no skill-bar cards popping over its icons)
    const hit = blocked ? null : hud.hitTest(m.x, m.y);
    if (!hit) { if (this.cur) { this.el.classList.add('hidden'); this.cur = null; this.sig = ''; } return; }
    this.t += dt;
    const key = hit.slot + ':' + (hit.part || '');
    if (key !== this.sig || this.t > 0.25) { // refresh a few times a second for live meter/rotation/ATK values
      this.t = 0; this.sig = key; this.cur = hit;
      const p = g.player, sim = g.view || g.sim;
      const t = slotTooltip(p.cls, hit.slot, { keyLabel: (id) => hud.keyLabel(id), stepLabel: (k) => hud.stepLabel(k), p, tick: sim ? sim.tick : null });
      this.el.innerHTML = controlMode.keyboard ? kbText(tooltipHTML(t)) : tooltipHTML(t);
      const ik = uiOn() && skillIconKey(p.cls, hit.slot === 'ultbar' ? 'ult' : hit.slot), st = ik ? iconStyle(ik, 40) : ''; // painted: the K icon in the tooltip head
      if (st) { const head = this.el.querySelector('.tt-head'); if (head) head.insertAdjacentHTML('afterbegin', `<span class="tt-icon" style="${st}"></span>`); }
      this.el.dataset.slot = hit.slot;
      this.el.classList.remove('hidden');
    }
    // above the hovered element, clamped to the window
    const r = this.el.getBoundingClientRect();
    let x = hit.x + hit.w / 2 - r.width / 2, y = hit.y - r.height - 12;
    x = Math.max(8, Math.min(innerWidth - r.width - 8, x));
    if (y < 8) y = Math.min(innerHeight - r.height - 8, hit.y + hit.h + 12);
    y = Math.max(8, y); // (a very tall tip on a short window: pin it to the top; CSS caps its height)
    this.el.style.left = Math.round(x) + 'px'; this.el.style.top = Math.round(y) + 'px';
  }
  destroy() { this.el.remove(); }
}
