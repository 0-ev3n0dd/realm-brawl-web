// Monk HUD pieces shared by the desktop HUD (hud.js) and the phone HUD (mobile/js/mhud.js): the Chi meter, the hit-counter
// + tier badge (Calm / Surging / Transcendent: chains evolve at 10 and 20) and the skill icons.
import { INK, circle, rrect } from './art.js';
import { CLASSES } from '../sim/data/classes.js';

const TAU = Math.PI * 2;
export const CHI_COL = '#ffc24a';
export const TIER_COLS = ['#ffb02e', '#ffd23f', '#fffaf0'];
import { drawText, glowRR } from './textcache.js';
function txt(ctx, s, x, y, size, col = '#fff', align = 'left', ol = 3) {
  size = Math.round(size * 2) / 2; const f = `800 ${size}px "Baloo 2", system-ui, sans-serif`;
  drawText(ctx, s, x, y, f, col, align, ol || 0, INK, size); ctx.font = f; ctx.textAlign = align; ctx.textBaseline = 'middle'; // (cached bitmap: client/textcache.js)
}
/** The Monk's live counter state (local prediction keeps p.monk; remote players carry p.mhc). */
export function monkState(p) {
  const C = CLASSES.monk.combo, hc = p.monk ? p.monk.hc : (p.mhc || 0), ht = p.monk ? p.monk.ht : 0;
  const tier = p.uw ? 2 : hc >= C.tiers[1] ? 2 : hc >= C.tiers[0] ? 1 : 0;
  return { hc, ht, tier, name: C.names[tier], next: tier < 2 ? C.tiers[tier] : null, prev: tier ? C.tiers[tier - 1] : 0, reset: C.reset, emp: !!(p.monk && p.monk.emp) };
}
/** Chi meter: a saffron-gold bar (full Chi shimmers); the side label shows the Chi multiplier on the next big chain. */
export function chiMeter(ctx, x, y, w, h, p, cls, time, sc = 1, side = false) {
  const max = p.stats.maxRes || 100, k = Math.max(0, Math.min(1, p.res / max)), uw = !!p.uw, flow = !!p.cst;
  if (uw || k >= 0.999) { ctx.save(); ctx.globalAlpha *= 0.4 + 0.3 * Math.sin(time * 10); glowRR(ctx, x - 3, y - 3, w + 6, h + 6, h / 2 + 3, '#ffd23f', (14 + 8 * Math.sin(time * 10)) * sc, 'rgb(255,200,80)'); ctx.restore(); } // (cached glow plate)
  rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = INK; ctx.fill();
  if (k > 0) {
    ctx.save(); rrect(ctx, x + 2, y + 2, w - 4, h - 4, (h - 4) / 2); ctx.clip();
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#c4501a'); g.addColorStop(0.55, '#ff9a2e'); g.addColorStop(1, '#ffe58a');
    ctx.fillStyle = g; ctx.fillRect(x + 2, y + 2, (w - 4) * k, h - 4);
    if (flow) { ctx.globalAlpha = 0.35 + 0.2 * Math.sin(time * 6); ctx.fillStyle = '#fffaf0'; ctx.fillRect(x + 2, y + 2, (w - 4) * k, (h - 4) * 0.45); }
    ctx.restore();
  }
  txt(ctx, `${uw ? 'SPIRIT ' : flow ? 'FLOW ' : ''}CHI ${Math.floor(p.res)}`, x + w / 2, y + h / 2 + 1, Math.round(12 * sc), '#fff', 'center', 3);
  if (side && p.res >= 50) txt(ctx, `×${(1 + Math.min(1, p.res / max) * (cls.chi.spendMax || 1)).toFixed(1)} on Hundred Hands / Seals`, x + w + 12 * sc, y + h / 2 + 1, Math.round(12 * sc), CHI_COL, 'left', 3);
}
/** Hit counter + tier badge: a big combo number, the tier name, progress to the next tier and the 2 s reset timer. */
export function comboBadge(ctx, cx, cy, p, time, sc = 1) {
  const s = monkState(p), col = TIER_COLS[s.tier], W = 150 * sc, H = 56 * sc, x = cx - W / 2, y = cy - H / 2;
  ctx.save();
  if (s.tier) { ctx.shadowColor = col; ctx.shadowBlur = (8 + s.tier * 6 + 4 * Math.sin(time * 8)) * sc; }
  rrect(ctx, x, y, W, H, 12 * sc); ctx.fillStyle = 'rgba(30,14,2,.78)'; ctx.fill(); ctx.shadowBlur = 0; ctx.lineWidth = 2.5 * sc; ctx.strokeStyle = col; ctx.stroke();
  // the tier pips (I / II / III)
  for (let i = 0; i < 3; i++) circle(ctx, x + 14 * sc, y + (13 + i * 15) * sc, 5 * sc, i <= s.tier ? TIER_COLS[i] : '#4a3520', 1.5);
  const pulse = s.hc > 0 && s.ht > 0 ? 1 + 0.06 * Math.sin(time * 14) : 1;
  txt(ctx, String(s.hc), x + 46 * sc, y + 22 * sc, Math.round(28 * sc * pulse), s.hc ? col : '#9c8a70', 'center', 4);
  txt(ctx, 'HITS', x + 46 * sc, y + 44 * sc, Math.round(10 * sc), '#e8d6b8', 'center', 2.5);
  txt(ctx, `T${s.tier + 1} ${s.name.toUpperCase()}`, x + 72 * sc, y + 16 * sc, Math.round(12 * sc), col, 'left', 3);
  // progress to the next tier (or "chains evolved")
  const bx = x + 72 * sc, bw = W - 80 * sc, by = y + 27 * sc, bh = 7 * sc;
  rrect(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = INK; ctx.fill();
  const k = s.next ? Math.max(0, Math.min(1, (s.hc - s.prev) / (s.next - s.prev))) : 1;
  rrect(ctx, bx + 1, by + 1, Math.max(0, (bw - 2) * k), bh - 2, (bh - 2) / 2); ctx.fillStyle = col; ctx.fill();
  txt(ctx, p.uw ? 'SPIRIT: TIER LOCKED' : s.next ? `${s.next - s.hc} to T${s.tier + 2}` : 'MAX · chains evolved', bx, y + 45 * sc, Math.round(10 * sc), '#e8d6b8', 'left', 2.5);
  // the reset timer (counter drops after 2 s without landing a hit)
  if (s.hc > 0 && s.ht > 0 && !p.uw) { const r = s.ht / s.reset; ctx.beginPath(); ctx.moveTo(x + 8 * sc, y + H - 3 * sc); ctx.lineTo(x + 8 * sc + (W - 16 * sc) * r, y + H - 3 * sc); ctx.strokeStyle = r < 0.3 ? '#ff6a4a' : col; ctx.lineWidth = 2.5 * sc; ctx.lineCap = 'round'; ctx.stroke(); }
  if (s.emp) txt(ctx, 'FLOW ×1.3 next chain', cx, y - 10 * sc, Math.round(11 * sc), '#fffaf0', 'center', 3);
  ctx.restore();
}
/** Monk skill icons. `stroke(col, lw)` strokes the current path with an ink outline. Returns true when drawn. */
export function monkIcon(ctx, id, stroke) {
  const G = '#ffd23f', O = '#ff9a2e', W = '#fffaf0', SK = '#f0c9a0';
  const fist = (x, y, r = 6) => { circle(ctx, x, y, r, SK, 2); ctx.beginPath(); ctx.arc(x, y, r, -1.1, 1.1); stroke(W, 2.2); };
  switch (id) {
    case 'basic': fist(4, 0, 7); for (const yy of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(-15, yy); ctx.lineTo(-5, yy); stroke(G, 2); } return true;
    case 'tiger_fist': fist(8, -8); fist(10, 2); fist(6, 11); for (const yy of [-8, 2, 11]) { ctx.beginPath(); ctx.moveTo(-14, yy); ctx.lineTo(0, yy); stroke(O, 2.2); } return true;
    case 'iron_palm': circle(ctx, 3, 0, 9, SK, 2); for (const dx of [-3, 1, 5, 9]) { ctx.beginPath(); ctx.moveTo(dx, -6); ctx.lineTo(dx, -14); stroke(SK, 2.6); } ctx.beginPath(); ctx.arc(3, 0, 15, -0.9, 0.9); stroke(G, 2.5); circle(ctx, 3, 2, 3, O, 0); return true;
    case 'crane_kick': ctx.beginPath(); ctx.arc(0, 0, 13, 0.3, TAU - 0.6); stroke(G, 3.5); ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(10, -8); stroke(O, 5); circle(ctx, 12, -9, 4, '#7a3b12', 1.5); return true;
    case 'flow_state': for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 6 + i * 4.5, i * 2 + 0.2, i * 2 + 2.4); stroke(i === 1 ? W : G, 2.4); } circle(ctx, 0, 0, 3, W, 0); return true;
    case 'awakened_spirit': circle(ctx, 0, 3, 11, 'rgba(255,229,138,.6)', 2, G); circle(ctx, 0, -9, 6, 'rgba(255,229,138,.8)', 2, G); circle(ctx, -2, -10, 1.3, W, 0); circle(ctx, 2, -10, 1.3, W, 0); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17); stroke(W, 2); } return true;
  }
  return false;
}
