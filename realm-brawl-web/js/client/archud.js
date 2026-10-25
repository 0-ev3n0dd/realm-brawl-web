// Grimoire Summoner + Bard HUD pieces (desktop hud.js; the phone HUD can reuse them): the Ink book / Tempo meter,
// the songs badge and the skill icons.
import { INK, rrect } from './art.js';
import { SONG_COL } from './fxarcana.js';
const TAU = Math.PI * 2;
import { drawText, glowRR } from './textcache.js';
function txt(ctx, s, x, y, size, col = '#fff', align = 'left', ol = 3) {
  size = Math.round(size * 2) / 2; const f = `800 ${size}px "Baloo 2", system-ui, sans-serif`;
  drawText(ctx, s, x, y, f, col, align, ol || 0, INK, size); ctx.font = f; ctx.textAlign = align; ctx.textBaseline = 'middle'; // (cached bitmap: client/textcache.js)
}
/** Ink (Summoner: teal ink filling 10 book pages) / Tempo (Bard: a golden bar with beat ticks). Full = INSCRIBED / IN TUNE. */
export function arcMeter(ctx, x, y, w, h, p, cls, time, sc = 1) {
  const bard = !!cls.tempoRes, max = p.stats.maxRes || 100, k = Math.max(0, Math.min(1, p.res / max)), full = k >= 0.999 || p.uw;
  const c0 = bard ? '#7a3a10' : '#0d3b44', c1 = bard ? '#ffb347' : '#21b59e', c2 = bard ? '#fff2a0' : '#9ff8e0', glowC = bard ? '#ffd86a' : '#3ff0c8';
  if (full) glowRR(ctx, x - 3, y - 3, w + 6, h + 6, h / 2 + 3, glowC, (14 + 8 * Math.sin(time * 10)) * sc, bard ? 'rgba(255,216,106,.25)' : 'rgba(63,240,200,.25)'); // (cached glow plate)
  rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = INK; ctx.fill();
  ctx.save(); rrect(ctx, x + 2, y + 2, w - 4, h - 4, (h - 4) / 2); ctx.clip();
  if (k > 0) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c0); g.addColorStop(0.6, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(x + 2, y + 2, (w - 4) * k, h - 4);
    for (let i = 0; i < 3; i++) { const q = (time * (bard ? 1.2 : 0.5) + i / 3) % 1; ctx.globalAlpha = 0.35 * (1 - q); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2 + (w - 4) * k * q, y + 2, 5, h - 4); }
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1.5; // page / beat dividers
  const seg = bard ? 8 : 10;
  for (let i = 1; i < seg; i++) { const sx = x + 2 + (w - 4) * i / seg; ctx.beginPath(); ctx.moveTo(sx, y + 3); ctx.lineTo(sx, y + h - 3); ctx.stroke(); }
  if (bard) { const beat = (time * 2) % 1; ctx.globalAlpha = 0.5 * (1 - beat); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2 + (w - 4) * Math.floor(time * 2 % seg) / seg, y + 2, (w - 4) / seg, h - 4); ctx.globalAlpha = 1; }
  ctx.restore();
  const label = bard ? (full ? (p.uw ? 'ENCORE' : 'IN TUNE') : 'TEMPO') : (full ? (p.uw ? 'UNBOUND' : 'INSCRIBED') : 'INK');
  txt(ctx, `${label} ${Math.floor(p.res)}`, x + w / 2, y + h / 2 + 1, Math.round(12 * sc), full ? (bard ? '#fff6d0' : '#e6fff8') : '#fff', 'center', 3);
  if (!bard && p.arc && p.arc.emp) txt(ctx, 'NEXT SUMMON EMPOWERED', x + w + 12 * sc, y + h / 2 + 1, Math.round(12 * sc), '#ffd86a', 'left', 3);
}
/** Active songs on this hero (any class): coloured pills with the time left. */
export function songBadge(ctx, cx, cy, p, time, sc = 1, rightEdge = false) {
  const S = p.songs; if (!S) return 0;
  const live = ['valor', 'haste', 'mending', 'requiem'].filter((k) => S[k] && S[k].t > 0);
  if (!live.length) return 0;
  const W = 74 * sc, H = 20 * sc, gap = 6 * sc, total = live.length * (W + gap) - gap, x0 = rightEdge ? cx - total : cx - total / 2;
  live.forEach((k, i) => {
    const x = x0 + i * (W + gap), col = SONG_COL[k], s = S[k], left = s.t / 60;
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 6 * sc; rrect(ctx, x, cy - H / 2, W, H, H / 2); ctx.fillStyle = 'rgba(14,8,26,.85)'; ctx.fill(); ctx.shadowBlur = 0; ctx.lineWidth = 2 * sc; ctx.strokeStyle = col; ctx.stroke();
    if (s.t < 480) { ctx.globalAlpha = 0.35; rrect(ctx, x + 2, cy - H / 2 + 2, (W - 4) * Math.min(1, s.t / 480), H - 4, (H - 4) / 2); ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1; }
    txt(ctx, `♪ ${k.toUpperCase()}${s.k > 1.01 ? '+' : ''} ${left.toFixed(0)}s`, x + W / 2, cy + 1, Math.round(10.5 * sc), '#fff', 'center', 2.5);
    ctx.restore();
  });
  return live.length;
}
/** Skill icons. Returns true when it drew one. */
export function arcIcon(ctx, id, stroke) {
  const B = () => ctx.beginPath();
  switch (id) {
    case 'fire_sprites': for (const [dx, dy, s] of [[-8, 4, 0.8], [8, 4, 0.8], [0, -4, 1]]) { B(); ctx.moveTo(dx, dy + 8 * s); ctx.quadraticCurveTo(dx - 7 * s, dy, dx, dy - 10 * s); ctx.quadraticCurveTo(dx + 7 * s, dy, dx, dy + 8 * s); stroke('#ff8a3a', 3); } return true;
    case 'frost_wyrm': B(); ctx.moveTo(-14, 10); ctx.bezierCurveTo(-4, 14, -12, -2, 0, -2); ctx.bezierCurveTo(8, -2, 4, -12, 12, -10); stroke('#9fe8ff', 5); B(); ctx.moveTo(12, -10); ctx.lineTo(16, -14); ctx.moveTo(10, -13); ctx.lineTo(9, -17); stroke('#f0fcff', 2.5); return true;
    case 'thunder_roc': B(); ctx.moveTo(-15, -2); ctx.quadraticCurveTo(-6, -12, 0, -2); ctx.quadraticCurveTo(6, -12, 15, -2); stroke('#a99bff', 4); B(); ctx.moveTo(2, 0); ctx.lineTo(-3, 8); ctx.lineTo(3, 8); ctx.lineTo(-2, 16); stroke('#fff6a0', 3); return true;
    case 'turn_the_page': B(); ctx.moveTo(0, 12); ctx.lineTo(-14, 8); ctx.lineTo(-14, -10); ctx.lineTo(0, -6); ctx.lineTo(14, -10); ctx.lineTo(14, 8); ctx.closePath(); stroke('#fff8e6', 3.5); B(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(6, -16, 12, -14); stroke('#3ff0c8', 3); return true;
    case 'grimoire_unbound': case 'legendary_page': B(); ctx.moveTo(0, 12); ctx.lineTo(-15, 7); ctx.lineTo(-15, -11); ctx.lineTo(0, -7); ctx.lineTo(15, -11); ctx.lineTo(15, 7); ctx.closePath(); stroke(id === 'legendary_page' ? '#ffb347' : '#3ff0c8', 4); B(); ctx.arc(0, -14, 4, 0, TAU); stroke('#ffd86a', 3); return true;
    case 'sonic_riff': for (let i = 0; i < 3; i++) { B(); ctx.arc(-10 + i * 8, 0, 10, -0.8, 0.8); stroke(i === 2 ? '#fff' : '#ff7ab8', 3); } return true;
    case 'echo_chord': B(); ctx.ellipse(-6, 8, 5, 3.5, -0.4, 0, TAU); stroke('#ff7ab8', 3); B(); ctx.moveTo(-2, 7); ctx.lineTo(-2, -12); ctx.lineTo(10, -8); stroke('#ff7ab8', 3); B(); ctx.arc(8, 6, 6, -1, 1); ctx.moveTo(14, 0); ctx.arc(8, 6, 10, -1, 1); stroke('#ffe0f0', 2); return true;
    case 'healing_hymn': B(); ctx.arc(0, 0, 14, 0, TAU); stroke('#ffd86a', 2.5); B(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); stroke('#7dff9a', 4); return true;
    case 'dissonance': B(); ctx.moveTo(-14, 0); ctx.lineTo(14, -12); ctx.moveTo(-14, 0); ctx.lineTo(14, 12); stroke('#b48cff', 3); B(); ctx.moveTo(-4, -4); ctx.lineTo(2, 2); ctx.lineTo(-2, 4); ctx.lineTo(6, 8); stroke('#fff', 2.5); return true;
    case 'encore': case 'crescendo': B(); ctx.arc(0, 2, 12, Math.PI, 0); stroke('#ffd86a', 4); for (const sx of [-1, 1]) { B(); ctx.moveTo(sx * 12, 2); ctx.lineTo(sx * 15, 12); stroke('#ff7ab8', 3); } B(); ctx.arc(0, -8, 3.5, 0, TAU); stroke('#fff', 2.5); return true;
  }
  return false;
}
