// Samurai HUD pieces shared by the desktop HUD (hud.js) and the phone HUD (mobile/js/mhud.js): the Focus meter, the
// Delayed Cuts readout and the skill icons (Iaido Slash, Crescent Parry, Sheathe, Blade of the Void, the draw-cut combo).
import { INK, circle, rrect } from './art.js';

const TAU = Math.PI * 2;
export const FOCUS_COL = '#ffd6ec';
import { drawText, glowRR } from './textcache.js';
function txt(ctx, s, x, y, size, col = '#fff', align = 'left', ol = 3) {
  size = Math.round(size * 2) / 2; const f = `800 ${size}px "Baloo 2", system-ui, sans-serif`;
  drawText(ctx, s, x, y, f, col, align, ol || 0, INK, size); ctx.font = f; ctx.textAlign = align; ctx.textBaseline = 'middle'; // (cached bitmap: client/textcache.js)
}
/** Delayed Cuts you have on living enemies (all of them burst on your next Sheathe). */
export function cutsOut(sim, p) {
  let n = 0;
  if (sim && sim.enemies) for (const e of sim.enemies) { const s = !e.dead && e.stx && e.stx.cut; if (s && s.pid === p.id && (s.t ?? 1) > 0) n += s.n; }
  return n;
}
/** Focus meter: a pink-silver bar (full Focus shimmers); Stillness shows a moonlit fill; the side label counts your Delayed Cuts. */
export function focusMeter(ctx, x, y, w, h, p, cls, time, sc = 1, side = false, cuts = 0) {
  const max = p.stats.maxRes || 100, k = Math.max(0, Math.min(1, p.res / max)), still = !!p.cst, uw = !!p.uw;
  if (uw || k >= 0.999) { ctx.save(); ctx.globalAlpha *= 0.4 + 0.3 * Math.sin(time * 10); glowRR(ctx, x - 3, y - 3, w + 6, h + 6, h / 2 + 3, '#fff3fa', (14 + 8 * Math.sin(time * 10)) * sc, 'rgb(255,190,225)'); ctx.restore(); } // (cached glow plate)
  rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = INK; ctx.fill();
  if (k > 0) {
    ctx.save(); rrect(ctx, x + 2, y + 2, w - 4, h - 4, (h - 4) / 2); ctx.clip();
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#b0467e'); g.addColorStop(0.55, '#ff8cc6'); g.addColorStop(1, '#fff3fa');
    ctx.fillStyle = g; ctx.fillRect(x + 2, y + 2, (w - 4) * k, h - 4);
    if (still) { ctx.globalAlpha = 0.35 + 0.2 * Math.sin(time * 6); ctx.fillStyle = '#dfe8ff'; ctx.fillRect(x + 2, y + 2, (w - 4) * k, (h - 4) * 0.45); }
    ctx.restore();
  }
  txt(ctx, `${uw ? 'VOID ' : still ? 'STILL ' : ''}FOCUS ${Math.floor(p.res)}`, x + w / 2, y + h / 2 + 1, Math.round(12 * sc), '#fff', 'center', 3);
  const lx = side ? x + w + 12 * sc : x + w / 2, ly = side ? y + h / 2 + 1 : y - 12 * sc, la = side ? 'left' : 'center';
  if (cuts > 0) txt(ctx, uw ? `✦ ${cuts} held → One Perfect Cut` : `✦ ${cuts} cut${cuts > 1 ? 's' : ''} → R`, lx, ly, Math.round(12 * sc), cuts >= 8 ? '#ffffff' : '#ff8cc6', la, 3);
  else if (p.res >= 50) txt(ctx, `×${(1 + Math.min(1, p.res / 100) * (cls.focus.spendMax || 1)).toFixed(1)} on Petal Rain / Death`, lx, ly, Math.round(12 * sc), FOCUS_COL, la, 3);
}
/** Samurai skill icons. `stroke(col, lw)` strokes the current path with an ink outline. Returns true when drawn. */
export function samIcon(ctx, id, stroke) {
  const P = '#ff8cc6', S = '#dfe8ff', W = '#ffffff';
  const katana = (x0, y0, x1, y1, col = '#e8eef7') => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + 3, (y0 + y1) / 2 - 3, x1, y1); stroke(col, 3.5); };
  switch (id) {
    case 'basic': katana(-13, 12, 13, -12); ctx.beginPath(); ctx.moveTo(-16, 7); ctx.lineTo(-8, 15); stroke('#e8c35a', 3); ctx.beginPath(); ctx.arc(0, 0, 14, -0.4, 1.2); stroke(P, 2.5); return true;
    case 'iaido': ctx.beginPath(); ctx.moveTo(-16, 6); ctx.lineTo(16, -6); stroke(P, 5); katana(-12, 10, 14, -2, W); for (const yy of [-10, 12]) { ctx.beginPath(); ctx.moveTo(-14, yy); ctx.lineTo(-4, yy - 3); stroke(S, 2); } return true;
    case 'kesa_slash': ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(14, 14); stroke(P, 5); katana(-10, -6, 12, 10, W); circle(ctx, 0, 0, 3, '#e8c35a', 1.5); return true;
    case 'crescent_parry': ctx.beginPath(); ctx.arc(-2, 0, 14, -1.3, 1.3); stroke(S, 4); katana(4, 14, 4, -14, W); circle(ctx, 4, 0, 3, '#e8c35a', 1.5); return true;
    case 'sheathe': ctx.save(); ctx.rotate(-0.6); rrect(ctx, -16, -3.5, 26, 7, 3.5); ctx.fillStyle = '#1d1226'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = S; ctx.stroke(); rrect(ctx, 10, -2.5, 8, 5, 2); ctx.fillStyle = '#2a1a33'; ctx.fill(); ctx.stroke(); ctx.restore(); for (let i = 0; i < 5; i++) { const a = i * (TAU / 5) + 0.4; circle(ctx, Math.cos(a) * 14, Math.sin(a) * 14, 2.6, P, 1.2); } return true;
    case 'void_blade': circle(ctx, 0, 0, 14, '#1a1030', 2.5, S); ctx.beginPath(); ctx.moveTo(-16, 10); ctx.lineTo(16, -10); stroke(W, 3); for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.3; circle(ctx, Math.cos(a) * 9, Math.sin(a) * 9, 2.2, P, 0); } return true;
  }
  return false;
}
