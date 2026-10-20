// Mission dungeon icons (classic art: flat colour + ink outline): one glyph per mission type + the boss-dungeon crown.
// Used by the entrances, the minimap / big map / World Map markers + legends, the mission card and the HUD.
import { INK } from './art.js';
import { OPS_TYPE, BOSS_GATES } from '../sim/opsconst.js';

const TAU = Math.PI * 2;
/** icon key + colour of an entrance (or a mission type) */
export const iconOf = (g) => (g.type === 'boss' ? { icon: 'crown', col: BOSS_GATES[g.dungeon].col } : { icon: OPS_TYPE[g.type].icon, col: OPS_TYPE[g.type].col });
/** Draw a mission glyph centred at (x, y); s = scale (1 = ~16 px tall). */
export function drawOpsIcon(ctx, icon, x, y, s = 1, col = '#fff', badge = true) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (badge) { ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fillStyle = INK; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = col; ctx.stroke(); }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
  ctx.beginPath();
  if (icon === 'shield') { ctx.moveTo(0, -7); ctx.lineTo(6, -4.5); ctx.lineTo(5, 2.5); ctx.quadraticCurveTo(3, 6, 0, 7.5); ctx.quadraticCurveTo(-3, 6, -5, 2.5); ctx.lineTo(-6, -4.5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 4.5); ctx.moveTo(-3, -0.5); ctx.lineTo(3, -0.5); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke(); }
  else if (icon === 'shard') { ctx.moveTo(0, -8); ctx.lineTo(4.8, -1); ctx.lineTo(0, 8); ctx.lineTo(-4.8, -1); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-4.8, -1); ctx.lineTo(4.8, -1); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.strokeStyle = 'rgba(43,36,51,.6)'; ctx.lineWidth = 1; ctx.stroke(); }
  else if (icon === 'swords') { for (const sg of [1, -1]) { ctx.save(); ctx.rotate(sg * Math.PI / 4); ctx.beginPath(); ctx.rect(-1.4, -8, 2.8, 11); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.rect(-3.6, 3, 7.2, 1.8); ctx.fillStyle = INK; ctx.fill(); ctx.beginPath(); ctx.rect(-1, 4.8, 2, 3); ctx.fill(); ctx.fillStyle = col; ctx.restore(); } }
  else if (icon === 'target') { ctx.arc(0, 0, 6.5, 0, TAU); ctx.lineWidth = 2.2; ctx.strokeStyle = col; ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill(); ctx.beginPath(); for (const a of [0, 1, 2, 3]) { const c = Math.cos(a * Math.PI / 2), d = Math.sin(a * Math.PI / 2); ctx.moveTo(c * 4.5, d * 4.5); ctx.lineTo(c * 9, d * 9); } ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.stroke(); }
  else if (icon === 'skull') { ctx.arc(0, -1.5, 6, Math.PI * 0.85, Math.PI * 2.15); ctx.lineTo(3.5, 6); ctx.lineTo(-3.5, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-2.3, -1, 1.7, 0, TAU); ctx.arc(2.3, -1, 1.7, 0, TAU); ctx.fill(); ctx.fillRect(-0.6, 2.4, 1.2, 2); }
  else { ctx.moveTo(-6.5, 4); ctx.lineTo(-7.5, -4.5); ctx.lineTo(-3, -0.5); ctx.lineTo(0, -6.5); ctx.lineTo(3, -0.5); ctx.lineTo(7.5, -4.5); ctx.lineTo(6.5, 4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
/** draw an entrance's marker (map / minimap): the type glyph in its colour */
export function drawGateMarker(ctx, g, x, y, s = 1, alpha = 1) {
  const I = iconOf(g); if (alpha < 1) { ctx.save(); ctx.globalAlpha *= alpha; }
  drawOpsIcon(ctx, I.icon, x, y, s * (g.type === 'boss' ? 1.15 : 1), I.col, true);
  if (alpha < 1) ctx.restore();
}
/** a small canvas with one glyph (DOM: the mission card, legends) -> data URL */
const URLS = {};
export function opsIconUrl(icon, col, px = 44) {
  const k = icon + col + px; if (URLS[k]) return URLS[k];
  if (typeof document === 'undefined') return '';
  const c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d');
  drawOpsIcon(g, icon, px / 2, px / 2, px / 24, col, true);
  return (URLS[k] = c.toDataURL());
}
