// Dragoon HUD pieces shared by the desktop HUD (hud.js) and the phone HUD (mobile/js/mhud.js): the Dragon Blood meter,
// the dive badge (Skyborne / scorched dive targets / Dragon Form) and the skill icons.
import { INK, circle, rrect } from './art.js';

const TAU = Math.PI * 2;
export const BLOOD_COL = '#ff3048';
import { drawText, glowRR } from './textcache.js';
function txt(ctx, s, x, y, size, col = '#fff', align = 'left', ol = 3) {
  size = Math.round(size * 2) / 2; const f = `800 ${size}px "Baloo 2", system-ui, sans-serif`;
  drawText(ctx, s, x, y, f, col, align, ol || 0, INK, size); ctx.font = f; ctx.textAlign = align; ctx.textBaseline = 'middle'; // (cached bitmap: client/textcache.js)
}
/** Dragon Blood: a crimson bar (full Blood burns); the side label shows the multiplier on the next big chain. */
export function bloodMeter(ctx, x, y, w, h, p, cls, time, sc = 1, side = false) {
  const max = p.stats.maxRes || 100, k = Math.max(0, Math.min(1, p.res / max)), uw = !!p.uw, sky = !!p.cst;
  if (uw || k >= 0.999) glowRR(ctx, x - 3, y - 3, w + 6, h + 6, h / 2 + 3, BLOOD_COL, (14 + 8 * Math.sin(time * 10)) * sc, 'rgba(255,48,72,.25)'); // (cached glow plate)
  rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = INK; ctx.fill();
  if (k > 0) {
    ctx.save(); rrect(ctx, x + 2, y + 2, w - 4, h - 4, (h - 4) / 2); ctx.clip();
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#5a0a2a'); g.addColorStop(0.55, '#d0102a'); g.addColorStop(1, '#ff7a5a');
    ctx.fillStyle = g; ctx.fillRect(x + 2, y + 2, (w - 4) * k, h - 4);
    for (let i = 0; i < 4; i++) { const q = (time * 0.6 + i / 4) % 1; ctx.globalAlpha = 0.35 * (1 - q); ctx.fillStyle = '#ffb347'; ctx.fillRect(x + 2 + (w - 4) * k * q, y + 2, 6, h - 4); }
    ctx.restore();
  }
  txt(ctx, `${uw ? 'DRAGON ' : sky ? 'SKYBORNE ' : ''}BLOOD ${Math.floor(p.res)}`, x + w / 2, y + h / 2 + 1, Math.round(12 * sc), '#fff', 'center', 3);
  if (side && p.res >= 40 && cls.blood) txt(ctx, `×${(1 + Math.min(1, p.res / max) * (cls.blood.spendMax || 0.6)).toFixed(1)} on Geirskogul / Nosedive`, x + w + 12 * sc, y + h / 2 + 1, Math.round(12 * sc), '#ff8a9a', 'left', 3);
}
/** The dive badge: Skyborne (Q/E change), dive targets left after a Roar / Spear Throw, Dragon Form. Null when idle. */
export function diveBadge(ctx, cx, cy, p, time, sc = 1) {
  const D = p.drg || {}, mk = D.mk || 0, dv = D.dv || 0;
  if (!mk && !p.cst && !p.uw) return;
  const W = 150 * sc, H = 40 * sc, x = cx - W / 2, y = cy - H / 2, col = p.uw ? BLOOD_COL : mk ? '#ff7a1e' : '#bcd4ff';
  ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = (8 + 4 * Math.sin(time * 8)) * sc;
  rrect(ctx, x, y, W, H, 10 * sc); ctx.fillStyle = 'rgba(14,6,30,.8)'; ctx.fill(); ctx.shadowBlur = 0; ctx.lineWidth = 2.5 * sc; ctx.strokeStyle = col; ctx.stroke();
  const line1 = p.uw ? 'DRAGON FORM' : mk ? `DIVE TARGET ×${Math.max(1, dv)}` : 'SKYBORNE';
  const line2 = mk ? `R homes in · ${(mk / 60).toFixed(1)} s` : p.cst ? 'Q High Jump · E Dragon Dive' : 'free jumps · fire echoes';
  txt(ctx, line1, cx, y + 13 * sc, Math.round(13 * sc), col, 'center', 3); txt(ctx, line2, cx, y + 29 * sc, Math.round(10 * sc), '#e8dcff', 'center', 2.5);
  ctx.restore();
}
/** Dragoon skill icons. `stroke(col, lw)` strokes the current path with an ink outline. Returns true when drawn. */
export function drgIcon(ctx, id, stroke) {
  const V = '#9a6bff', R = '#ff3048', O = '#ff7a1e', W = '#e8eef7', S = '#bcd4ff';
  const spear = (x0, y0, x1, y1, col = W) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); stroke('#8a5a3a', 3); const a = Math.atan2(y1 - y0, x1 - x0); ctx.beginPath(); ctx.moveTo(x1 + Math.cos(a) * 9, y1 + Math.sin(a) * 9); ctx.lineTo(x1 + Math.cos(a + 2.5) * 6, y1 + Math.sin(a + 2.5) * 6); ctx.lineTo(x1 + Math.cos(a - 2.5) * 6, y1 + Math.sin(a - 2.5) * 6); ctx.closePath(); stroke(col, 2.5); };
  switch (id) {
    case 'basic': spear(-14, 12, 8, -8); ctx.beginPath(); ctx.arc(0, 0, 14, -0.3, 1.3); stroke(V, 2.5); return true;
    case 'piercing_thrust': ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(6, 0); stroke(V, 4); spear(-12, 6, 8, -2); for (const yy of [-9, 10]) { ctx.beginPath(); ctx.moveTo(-15, yy); ctx.lineTo(-5, yy); stroke(S, 2); } return true;
    case 'sweeping_arc': ctx.beginPath(); ctx.arc(0, 0, 14, 0.4, TAU - 0.4); stroke(V, 3.5); spear(-10, 10, 10, -10); return true;
    case 'jump': ctx.beginPath(); ctx.moveTo(-14, 14); ctx.quadraticCurveTo(-4, -22, 10, 8); stroke(S, 2.5); spear(4, -10, 10, 8, R); ctx.beginPath(); ctx.ellipse(10, 13, 9, 3, 0, 0, TAU); stroke(R, 2); return true;
    case 'spear_throw': spear(-14, 10, 10, -6, O); for (const [dx, dy] of [[-16, 2], [-12, 14]]) { ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + 8, dy - 5); stroke(R, 2); } circle(ctx, 12, -9, 4, 'rgba(255,122,30,.6)', 1.5); return true;
    case 'dragon_form': circle(ctx, 0, 0, 12, 'rgba(90,75,255,.55)', 2, V); ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-12, -15); ctx.moveTo(6, -6); ctx.lineTo(12, -15); stroke(W, 2.5); circle(ctx, -4, -1, 2, '#ffd23f', 0); circle(ctx, 4, -1, 2, '#ffd23f', 0); ctx.beginPath(); ctx.moveTo(-5, 6); ctx.lineTo(5, 6); stroke(R, 2.5); return true;
  }
  return false;
}
