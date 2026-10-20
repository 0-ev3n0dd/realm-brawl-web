// Loadout swap feedback in the world (step 4): the short swap cast bar over the hero, the swap / cancel text, and the
// routing of the sim's 'loadout' events to the hub's preset bar (client/hubloadouts.js). Solo: the hub pauses the
// world, so a swap that needs its cast closes the hub and plays the cast in the field.
import { BLOCK_MSG } from '../sim/loadout.js';

export class LoadoutFX {
  constructor(game) { this.g = game; this.cast = null; }
  onEvent(ev) {
    if (ev.type !== 'loadout' && ev.type !== 'lock') return;
    const me = this.g.player; if (!me || ev.pid !== me.id) return;
    const H = this.g.menuHub, fx = this.g.fx;
    if (ev.type === 'lock') { if (H && H.onLock) H.onLock(ev); return; }
    if (H && H.loBar) H.loBar.onEvent(ev);
    const say = (t, col) => { if (fx && fx.text) fx.text(me.x, me.y - 74, t, { size: 17, color: col, vy: -34, life: 1.5, pop: 1.25 }); };
    if (ev.ph === 'cast') {
      this.cast = { name: ev.name, dur: ev.dur, t: 0 };
      if (H && H.isOpen() && H.pausing && H.pausing()) H.close(); // (solo: let the world run the cast)
    } else if (ev.ph === 'swap') { this.cast = null; say(`⇄ ${ev.name}`, '#9ff0ff'); if (fx && fx.ring) fx.ring(me.x, me.y, 70, '#9ff0ff', 0.45, 6); if (this.g.audio) this.g.audio.play('gearpick'); }
    else if (ev.ph === 'cancel' || ev.ph === 'fail') { this.cast = null; if (!(H && H.isOpen())) say(`Swap ${ev.ph === 'fail' ? 'blocked' : 'cancelled'}: ${BLOCK_MSG[ev.why] || ev.why}`, '#ff9a8a'); if (this.g.audio) this.g.audio.play('nores'); }
  }
  /** screen-space cast bar under the hero (call after the HUD) */
  draw(ctx, w, h, dt) {
    const c = this.cast; if (!c) return;
    c.t += dt; const k = Math.min(1, c.t / c.dur);
    if (c.t > c.dur + 1.5) { this.cast = null; return; } // (lost event safety)
    const bw = 220, x = w / 2 - bw / 2, y = h * 0.62;
    ctx.save();
    ctx.globalAlpha = 0.9; ctx.fillStyle = '#140d1e'; ctx.fillRect(x - 4, y - 4, bw + 8, 26);
    ctx.fillStyle = '#2b2433'; ctx.fillRect(x, y, bw, 18); ctx.fillStyle = '#7fe3ff'; ctx.fillRect(x, y, bw * k, 18);
    ctx.globalAlpha = 1; ctx.font = "14px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = '#140d1e'; const t = `Swapping to ${c.name}…`; ctx.strokeText(t, w / 2, y + 9.5); ctx.fillStyle = '#fff'; ctx.fillText(t, w / 2, y + 9.5);
    ctx.restore();
  }
}
