// Warrior (Weapon Master) HUD pieces shared by the desktop HUD (hud.js) and the phone HUD (mobile/js/mhud.js):
// the Glory meter, the Weapon Trinity tracker, weapon-coloured skill rings and icons.
import { CLASSES } from '../sim/data/classes.js';
import { BIT, STANCES } from '../sim/warrior.js';
import { INK, circle, rrect } from './art.js';

const TAU = Math.PI * 2;
export const STANCE_COL = { G: '#5ec8ff', A: '#ff4d5e', H: '#ffb52e' };
export const STANCE_SHORT = { G: 'GS', A: 'AX', H: 'HM' };
export const GLORY_COL = '#ffc93b';
import { drawText, glowRR } from './textcache.js';
function txt(ctx, s, x, y, size, col = '#fff', align = 'left', ol = 3) {
  size = Math.round(size * 2) / 2; const f = `800 ${size}px "Baloo 2", system-ui, sans-serif`;
  drawText(ctx, s, x, y, f, col, align, ol || 0, INK, size); ctx.font = f; ctx.textAlign = align; ctx.textBaseline = 'middle'; // (cached bitmap: client/textcache.js)
}

/** Glory meter: gold bar; full Glory glows (the Glory chains spend all of it for up to x2; the finishers scale with it, up to +120%). */
export function gloryMeter(ctx, x, y, w, h, p, cls, time, sc = 1, side = false) {
  const max = p.stats.maxRes || 100, k = Math.max(0, Math.min(1, p.res / max)), hot = p.res >= 50, surge = p.wm && p.wm.surge > 0;
  if (surge || k >= 0.999) { ctx.save(); ctx.globalAlpha *= 0.45 + 0.3 * Math.sin(time * 12); glowRR(ctx, x - 3, y - 3, w + 6, h + 6, h / 2 + 3, '#fff0a0', (16 + 8 * Math.sin(time * 12)) * sc, 'rgb(255,210,80)'); ctx.restore(); } // (cached glow plate)
  rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = INK; ctx.fill();
  if (k > 0) {
    ctx.save(); rrect(ctx, x + 2, y + 2, w - 4, h - 4, (h - 4) / 2); ctx.clip();
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#b86a12'); g.addColorStop(0.6, GLORY_COL); g.addColorStop(1, '#fff3b8');
    ctx.fillStyle = g; ctx.fillRect(x + 2, y + 2, (w - 4) * k, h - 4);
    if (hot) { ctx.globalAlpha = 0.3 + 0.2 * Math.sin(time * 10); ctx.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { const fx = x + 2 + ((time * 70 + i * 61) % Math.max(1, (w - 4) * k)); ctx.fillRect(fx, y + 3, 2, h - 6); } }
    ctx.restore();
  }
  txt(ctx, `GLORY ${Math.floor(p.res)}`, x + w / 2, y + h / 2 + 1, Math.round(12 * sc), '#fff', 'center', 3);
  const lx = side ? x + w + 12 * sc : x + w / 2, ly = side ? y + h / 2 + 1 : y - 12 * sc, la = side ? 'left' : 'center';
  if (hot) txt(ctx, `×${(1 + Math.min(1, p.res / 100) * (cls.glory.spendMax || 1)).toFixed(1)} on a Glory chain`, lx, ly, Math.round(12 * sc), '#ffe7a0', la, 3);
}

/** The Weapon Trinity tracker: 3 weapon gems (lit by the weapons that hit in the current rotation, the drawn one outlined) + the
 *  rotation timer + Trinity Surge. Returns what was drawn (playtests read it). `hot` (optional array) collects hover rects. */
export function trinityPanel(ctx, cx, y, p, cls, time, sc = 1, lite = false, hot = null) {
  const W = p.wm;
  if (!W) return null;
  const OL = lite ? 0 : 3, T = cls.trinity;
  const out = { st: W.st, tri: W.tri, surge: W.surge > 0 };
  ctx.save(); ctx.translate(cx, y); ctx.scale(sc, sc);
  const gx = [-40, 0, 40], bits = W.tri;
  txt(ctx, 'TRINITY', -64, 0, 11, '#ffe0a0', 'right', OL);
  STANCES.forEach((s, i) => {
    const lit = !!(bits & BIT[s]);
    if (i < 2) { ctx.strokeStyle = lit && bits & BIT[STANCES[i + 1]] ? '#fff2b0' : 'rgba(255,255,255,.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(gx[i] + 12, 0); ctx.lineTo(gx[i + 1] - 12, 0); ctx.stroke(); }
    if (lit) { ctx.save(); ctx.shadowColor = STANCE_COL[s]; ctx.shadowBlur = 12; circle(ctx, gx[i], 0, 11, STANCE_COL[s], 2.5); ctx.restore(); }
    else circle(ctx, gx[i], 0, 10, 'rgba(40,30,60,.9)', 2.5);
    if (s === W.st) { ctx.beginPath(); ctx.arc(gx[i], 0, 15, 0, TAU); ctx.strokeStyle = STANCE_COL[s]; ctx.lineWidth = 2; ctx.stroke(); }
    txt(ctx, STANCE_SHORT[s], gx[i], 1, 9, lit ? INK : 'rgba(255,255,255,.55)', 'center', 0);
  });
  if (hot) hot.push({ slot: 'trinity', x: cx - 110 * sc, y: y - 16 * sc, w: 200 * sc, h: 32 * sc });
  if (W.ct > 0 && W.tri) { const k = W.ct / T.gap; rrect(ctx, 60, -3, 70, 6, 3); ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fill(); rrect(ctx, 60, -3, 70 * k, 6, 3); ctx.fillStyle = k < 0.3 ? '#ff5e5b' : '#ffe0a0'; ctx.fill(); }
  if (W.surge > 0) txt(ctx, `TRINITY SURGE ${(W.surge / 60).toFixed(1)}s · +${Math.round((T.surgeMul - 1) * 100)}% DMG`, 0, -22, 13 + Math.sin(time * 12), '#fff2b0', 'center', OL);
  ctx.restore();
  return out;
}

/** The weapon colour ring around a Warrior skill slot (Q greatsword blue, E axes red, R hammer gold); brighter on the drawn one. */
export function weaponRing(ctx, x, y, S, key, drawn) {
  const w = { Q: 'G', E: 'A', R: 'H', LMB: drawn, G: drawn, F: drawn }[key]; // (G: Arsenal Toss throws the drawn weapon)
  if (!w) return;
  rrect(ctx, x + 1, y + 1, S - 2, S - 2, 11); ctx.strokeStyle = STANCE_COL[w]; ctx.lineWidth = w === drawn ? 3.5 : 2; ctx.stroke();
}

// ------------------------------------------------------------------ icons (ctx already translated to the slot centre)
const blade = (ctx, stroke, x1, y1, x2, y2, col = '#e9f6ff', lw = 5) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); stroke(col, lw); };
function axe(ctx, stroke, x, y, a, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -10); stroke('#8a5a35', 3);
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(9, -12, 9, -3); ctx.lineTo(0, -4); ctx.closePath(); stroke(col, 2.5); ctx.fillStyle = col; ctx.fill();
  ctx.restore();
}
function hammer(ctx, stroke, x, y, a, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(0, 13); ctx.lineTo(0, -6); stroke('#8a5a35', 3.5);
  rrect(ctx, -9, -13, 18, 9, 2); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
}
/** Draws the icon for a Warrior Weapon Master id; returns false for unknown ids. */
export function wmIcon(ctx, id, stroke) {
  const G = STANCE_COL.G, A = STANCE_COL.A, H = STANCE_COL.H, W = '#ffffff', Y = '#ffd23f';
  switch (id) {
    case 'wm_basic_G': blade(ctx, stroke, -12, 12, 12, -12); ctx.beginPath(); ctx.moveTo(-15, 5); ctx.lineTo(-5, 15); stroke(G, 4); return true;
    case 'wm_basic_A': axe(ctx, stroke, -5, 2, -0.5, A); axe(ctx, stroke, 6, 2, 0.5, A); return true;
    case 'wm_basic_H': hammer(ctx, stroke, 0, 2, 0.5, H); return true;
    case 'gs_cleave': ctx.beginPath(); ctx.arc(0, 2, 15, Math.PI * 0.9, Math.PI * 2.1); stroke(G, 4); blade(ctx, stroke, -3, 8, 10, -10); return true;
    case 'gs_lunge': ctx.beginPath(); ctx.moveTo(-15, 8); ctx.lineTo(6, -6); stroke(G, 3); blade(ctx, stroke, -2, 2, 14, -10); ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(-7, 0); ctx.moveTo(-12, 12); ctx.lineTo(-4, 12); stroke(W, 2); return true;
    case 'gs_earthcleaver': blade(ctx, stroke, 0, -14, 0, 6); ctx.beginPath(); ctx.moveTo(-14, 12); ctx.lineTo(-5, 7); ctx.lineTo(0, 12); ctx.lineTo(6, 7); ctx.lineTo(14, 12); stroke(G, 3); return true;
    case 'war_cry': circle(ctx, -6, 0, 8, G, 2.5); for (const r of [8, 13, 18]) { ctx.beginPath(); ctx.arc(-2, 0, r, -0.7, 0.7); stroke(W, 2.2); } return true;
    case 'ax_flurry': axe(ctx, stroke, -4, 0, -0.7, A); axe(ctx, stroke, 5, 0, 0.7, A); for (const yy of [-12, 12]) { ctx.beginPath(); ctx.moveTo(-10, yy); ctx.lineTo(10, yy); stroke(W, 2); } return true;
    case 'ax_leap': ctx.beginPath(); ctx.moveTo(-14, 12); ctx.quadraticCurveTo(-4, -18, 10, 6); stroke(W, 2.5); axe(ctx, stroke, 8, 2, 0.8, A); return true;
    case 'ax_hemorrhage': ctx.beginPath(); ctx.moveTo(-12, -12); ctx.lineTo(12, 12); ctx.moveTo(12, -12); ctx.lineTo(-12, 12); stroke(A, 4); for (const [dx, dy] of [[-8, 4], [8, 6], [0, 13]]) circle(ctx, dx, dy, 3, '#b0001a', 1.5); return true;
    case 'rally': circle(ctx, 0, 2, 13, 'rgba(255,77,94,.35)', 2); for (const dx of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(dx, 10); ctx.lineTo(dx, -8); ctx.moveTo(dx - 4, -4); ctx.lineTo(dx, -9); ctx.lineTo(dx + 4, -4); stroke(Y, 2.5); } return true;
    case 'hm_skull': hammer(ctx, stroke, -2, 2, -0.6, H); ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; ctx.moveTo(9, -8); ctx.lineTo(9 + Math.cos(a) * 7, -8 + Math.sin(a) * 7); } stroke(W, 2); return true;
    case 'hm_quake': hammer(ctx, stroke, 0, -2, 0, H); ctx.beginPath(); ctx.ellipse(0, 11, 15, 4, 0, 0, TAU); stroke(W, 2); return true;
    case 'hm_anvil': hammer(ctx, stroke, 0, 0, Math.PI, H); ctx.beginPath(); ctx.moveTo(-12, -14); ctx.lineTo(-12, -2); ctx.moveTo(12, -14); ctx.lineTo(12, -2); stroke(W, 2.5); return true;
    case 'challenge': circle(ctx, 0, 0, 13, 'rgba(0,0,0,0)', 3, H); circle(ctx, 0, 0, 6, H, 2.5); ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, -9); ctx.moveTo(0, 18); ctx.lineTo(0, 9); ctx.moveTo(-18, 0); ctx.lineTo(-9, 0); ctx.moveTo(18, 0); ctx.lineTo(9, 0); stroke(W, 2.5); return true;
    case 'warlord': blade(ctx, stroke, -10, 12, 6, -14, '#e9f6ff', 4); axe(ctx, stroke, 2, 2, 0.4, A); hammer(ctx, stroke, 8, 4, 0.9, H); circle(ctx, -9, -9, 4, Y, 1.5); return true;
    case 'arsenal_toss': ctx.beginPath(); ctx.moveTo(-15, 12); ctx.quadraticCurveTo(-6, -16, 10, 2); stroke(W, 2.2); ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(10, 6); ctx.quadraticCurveTo(0, 18, -12, 14); stroke(Y, 2); ctx.setLineDash([]); blade(ctx, stroke, 6, -10, 12, 12, '#e9f6ff', 4); ctx.beginPath(); ctx.ellipse(12, 13, 9, 3, 0, 0, TAU); stroke(G, 2); return true;
    case 'stance': return false;
  }
  return false;
}
export { CLASSES };
