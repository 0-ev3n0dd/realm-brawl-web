// The big hero showcase shared by the menu hub's Character tab and the title screen (step 2): the classic hero
// scaled up, idling (breathing bob + slow turn toward the viewer) with an occasional basic-combo flourish, standing
// on a classic-art platform under a soft spotlight. Pure canvas, no DOM.
import { drawHero } from './art.js';
import { CLASSES } from '../sim/data/classes.js';

const INK = '#2b2433';
/** hex -> rgba() helper (class colours are #rrggbb) */
export function rgba(hex, a) {
  const h = String(hex || '#ffffff').replace('#', ''), n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** The basic-combo flourish every `period` seconds (null = plain idle). t in seconds. */
export function showcaseAnim(cls, t, period = 7) {
  const C = CLASSES[cls]; if (!C || !C.basic) return null;
  const f = ((t % period) - (period - 2.2)) * 60; // the last 2.2 s of each period
  if (f < 0) return null;
  let acc = 0;
  for (let i = 0; i < Math.min(3, C.basic.length); i++) { const b = C.basic[i]; if (f >= acc && f < acc + b.dur) return { kind: 'basic', idx: i, t: f - acc, dur: b.dur, hit: b.hit }; acc += b.dur + 6; }
  return null;
}

/** spotlight cone + glow pool + the round platform (centre x, floor y, radius r) */
export function drawPlatform(g, x, y, r, col, t, opts = {}) {
  g.save();
  if (opts.spot !== false) { // soft spotlight from above
    const top = y - r * 3.4;
    const gr = g.createLinearGradient(0, top, 0, y);
    gr.addColorStop(0, rgba('#fff6d8', 0)); gr.addColorStop(0.55, rgba('#fff6d8', 0.07)); gr.addColorStop(1, rgba('#fff6d8', 0.16));
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - r * 0.28, top); g.lineTo(x + r * 0.28, top); g.lineTo(x + r * 1.05, y); g.lineTo(x - r * 1.05, y); g.closePath(); g.fill();
  }
  const pool = g.createRadialGradient(x, y, r * 0.2, x, y, r * 1.6);
  pool.addColorStop(0, rgba(col, 0.42)); pool.addColorStop(1, rgba(col, 0));
  g.fillStyle = pool; g.beginPath(); g.ellipse(x, y, r * 1.6, r * 0.62, 0, 0, Math.PI * 2); g.fill();
  // stone drum: side band then top
  const k = 0.36, side = r * 0.16;
  g.lineWidth = Math.max(3, r * 0.03); g.strokeStyle = INK;
  g.fillStyle = opts.side || '#3b3150'; g.beginPath(); g.ellipse(x, y + side, r, r * k, 0, 0, Math.PI); g.lineTo(x - r, y); g.ellipse(x, y, r, r * k, 0, Math.PI, 0, true); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = opts.top || '#5a4c78'; g.beginPath(); g.ellipse(x, y, r, r * k, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.ellipse(x, y - r * 0.05, r * 0.86, r * k * 0.72, 0, Math.PI, 0); g.fill();
  // glowing rune ring (turns slowly)
  g.strokeStyle = rgba(col, 0.85); g.lineWidth = Math.max(2, r * 0.022); g.setLineDash([r * 0.12, r * 0.07]); g.lineDashOffset = -t * r * 0.12;
  g.beginPath(); g.ellipse(x, y, r * 0.74, r * k * 0.74, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  g.strokeStyle = rgba(col, 0.35); g.beginPath(); g.ellipse(x, y, r * 0.9, r * k * 0.9, 0, 0, Math.PI * 2); g.stroke();
  g.restore();
}

/** The hero itself, big: (x, y) = feet on the platform; scale ~ 5..9 */
export function drawShowcaseHero(g, { x, y, scale, cls, app, t, period = 7, turn = true }) {
  const anim = showcaseAnim(cls, t, period);
  const bob = Math.sin(t * 2.2) * scale * 0.5;
  const ang = Math.PI / 2 + (turn ? Math.sin(t * 0.45) * 0.38 : 0) - (anim ? 0.25 : 0);
  // contact shadow
  g.save(); g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x, y + scale * 2, scale * 15, scale * 5, 0, 0, Math.PI * 2); g.fill(); g.restore();
  g.save(); g.translate(x, y - scale * 10 + bob); g.scale(scale, scale);
  try { drawHero(g, { x: 0, y: 0, ang, cls, app: app || {}, time: t, anim, moving: false, classic: true, noShadow: true }); } catch { /* art not ready */ }
  g.restore();
}
