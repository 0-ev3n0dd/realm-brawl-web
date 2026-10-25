// Part A3: smarter-mob + elite-affix visuals (drawn over the mob, world space). Colours = the A1 grammar (client/telefx.js):
// the Mirror window is a white-violet shell + 'MIRROR' (hit it and you take a chip back), Vortex a blue swirl crest,
// Commander a yellow crown + a faint aura ring, Splitter a green split mark; buffed mobs glow yellow, a fallen
// commander's pack shows a grey down-arrow.
const TAU = Math.PI * 2;
const AFX = [['Vortex', '#4da6ff'], ['Mirror', '#e8d6ff'], ['Splitter', '#5cff9d'], ['Commander', '#ffd23f']];
export const affixOfName = (n) => { for (const [k, c] of AFX) if (n && n.startsWith(k + ' ')) return [k, c]; return null; };
function px(ctx, x, y, s, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); }
export function drawMobA3(ctx, e, x, y, time) {
  const A = e.elite ? affixOfName(e.name) : null, r = e.r;
  ctx.save();
  if (A) { // crest: a pixel badge over the head
    const cy = y - r - 26; ctx.globalAlpha = 0.95; px(ctx, x, cy, 14, '#120c18'); px(ctx, x, cy, 10, A[1]);
    if (A[0] === 'Vortex') { ctx.strokeStyle = A[1]; ctx.lineWidth = 2; ctx.globalAlpha = 0.55; ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = time * 3 + i * TAU / 3; ctx.moveTo(x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6)); ctx.arc(x, y, r + 6, a, a + 1.1); } ctx.stroke(); }
    if (A[0] === 'Commander') { ctx.globalAlpha = 0.18 + 0.08 * Math.sin(time * 3); ctx.strokeStyle = A[1]; ctx.lineWidth = 3; ctx.setLineDash([8, 10]); ctx.beginPath(); ctx.arc(x, y, 350, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; for (let i = -1; i <= 1; i++) px(ctx, x + i * 5, cy - 9 - (i ? 0 : 3), 4, A[1]); }
    if (A[0] === 'Splitter') { ctx.globalAlpha = 1; px(ctx, x, cy, 3, '#120c18'); }
  }
  if (e.af && e.af.win > 0) { // the Mirror window: hard to miss
    const k = 0.6 + 0.4 * Math.sin(time * 14);
    ctx.globalAlpha = 0.35 * k; ctx.fillStyle = '#e8d6ff'; ctx.beginPath(); ctx.arc(x, y, r + 12, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + time; ctx.lineTo(x + Math.cos(a) * (r + 14), y + Math.sin(a) * (r + 14)); } ctx.closePath(); ctx.stroke();
    ctx.font = "12px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#120c18'; ctx.strokeText('MIRROR', x, y + r + 28); ctx.fillStyle = '#e8d6ff'; ctx.fillText('MIRROR', x, y + r + 28);
  }
  if (e.buffT > 0 || e.cmdAura > 0) { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 6); for (let i = 0; i < 4; i++) { const a = time * 2 + i * TAU / 4; px(ctx, x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4) - 6, 4, '#ffd23f'); } }
  if (e.cmdDebuff > 0) { ctx.globalAlpha = 0.85; ctx.fillStyle = '#9aa0b4'; const cy = y - r - 14; ctx.beginPath(); ctx.moveTo(x - 6, cy - 4); ctx.lineTo(x + 6, cy - 4); ctx.lineTo(x, cy + 4); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
