// Part A1: the one telegraph renderer (sim/telegraph.js shapes + the colour grammar). Engines hand it their telegraph
// specs ({ sh, x, y, r, r0, ang, len, w, arc, c, pts, t, d, done, cue, n }) and it draws: a tinted fill in the cue's
// colour, a bright outline, the WHITE fill-in sweep that shows time to impact, a pop on landing, and cue glyphs
// (soak counters, spread / stack markers, safe-spot sparkles). Pixel-crisp: integer-ish line widths, no blur on the
// shape itself, a soft bloom only around it.
import { CUES, cueOf } from '../sim/telegraph.js';

const TAU = Math.PI * 2;
/** outline path of t (kk = 0..1: the fill-in sweep's share of the full shape) */
export function telePath(ctx, t, kk = 1) {
  ctx.beginPath();
  switch (t.sh) {
    case 'circle': case 'tower': case 'spread': case 'stack': ctx.arc(t.x, t.y, Math.max(1, t.r * kk), 0, TAU); break;
    case 'ring': case 'donut': { const r0 = t.r0 || 0, r1 = r0 + (t.r - r0) * kk; ctx.arc(t.x, t.y, Math.max(r0 + 1, r1), 0, TAU); ctx.moveTo(t.x + r0, t.y); ctx.arc(t.x, t.y, r0, 0, TAU, true); break; }
    case 'wall': { const r0 = t.r0 || 0, r1 = r0 + (t.r - r0) * kk, a = t.ang, s = t.half || 0.9; ctx.arc(t.x, t.y, r1, a - s, a + s); ctx.arc(t.x, t.y, r0, a + s, a - s, true); ctx.closePath(); break; }
    case 'rect': { const c = Math.cos(t.ang), s = Math.sin(t.ang), L = t.len * kk, w = t.w / 2; ctx.moveTo(t.x - s * w, t.y + c * w); ctx.lineTo(t.x + c * L - s * w, t.y + s * L + c * w); ctx.lineTo(t.x + c * L + s * w, t.y + s * L - c * w); ctx.lineTo(t.x + s * w, t.y - c * w); ctx.closePath(); break; }
    case 'line': { const c = Math.cos(t.ang), s = Math.sin(t.ang), L = t.len * kk, w = t.w / 2; ctx.moveTo(t.x - s * w, t.y + c * w); ctx.lineTo(t.x + c * L - s * w, t.y + s * L + c * w); ctx.arc(t.x + c * L, t.y + s * L, w, t.ang + Math.PI / 2, t.ang - Math.PI / 2, true); ctx.lineTo(t.x + s * w, t.y - c * w); ctx.arc(t.x, t.y, w, t.ang - Math.PI / 2, t.ang + Math.PI / 2, true); ctx.closePath(); break; }
    case 'cone': ctx.moveTo(t.x, t.y); ctx.arc(t.x, t.y, t.r * kk, t.ang - t.arc / 2, t.ang + t.arc / 2); ctx.closePath(); break;
    case 'path': { const P = t.pts || []; if (P.length >= 2) { ctx.moveTo(P[0], P[1]); for (let i = 2; i + 1 < P.length; i += 2) ctx.lineTo(P[i], P[i + 1]); } break; }
  }
}
/** the arena-sized "everything but the safe circles" mask for sh:'safe' (A = the arena { x, y, r }) */
function safeMask(ctx, t, A) { ctx.beginPath(); ctx.arc(A.x, A.y, A.r + 60, 0, TAU); for (const [x, y, r] of t.c || []) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU, true); } }
/** draw one telegraph. time = seconds (for the pulses); A = arena (only sh:'safe' needs it); o.label = optional caption */
export function drawTele(ctx, t, time, A = null, o = {}) {
  if ((t.t || 0) < 0) return; // (A2: a memory step not shown yet)
  const cue = CUES[cueOf(t)], k = Math.min(1, (t.t || 0) / Math.max(1, t.d || 1));
  if (t.mem && !t.done && (t.d - t.t) > 36) { // (A2 memory: only a faint numbered ghost until the last 0.6 s)
    ctx.save(); ctx.globalAlpha = 0.18; telePath(ctx, t); ctx.lineWidth = 2; ctx.strokeStyle = cue.col; ctx.setLineDash([6, 8]); ctx.stroke(); ctx.restore(); return;
  }
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (t.done) { // the landing pop: a white flash of the shape, fading
    const a = Math.max(0, 1 - ((t.t || 0) - (t.d || 0)) / 24); if (a <= 0) { ctx.restore(); return; }
    ctx.globalAlpha = a * 0.85; ctx.fillStyle = '#ffffff';
    if (t.sh === 'safe' && A) { safeMask(ctx, t, A); ctx.fill('evenodd'); } else if (t.sh === 'path') { telePath(ctx, t); ctx.lineWidth = t.w; ctx.strokeStyle = '#fff'; ctx.stroke(); } else { telePath(ctx, t); ctx.fill('evenodd'); }
    ctx.restore(); return;
  }
  const pulse = 0.5 + 0.5 * Math.sin(time * (5 + 12 * k));
  if (t.sh === 'safe') {
    if (A) { // (2026-10-18: stronger: solid red + moving hatch, so 'everything else' reads RED at a glance)
      ctx.globalAlpha = 0.34 + 0.3 * k; safeMask(ctx, t, A); ctx.fillStyle = 'rgba(214,28,52,.85)'; ctx.fill('evenodd');
      ctx.save(); safeMask(ctx, t, A); ctx.clip('evenodd'); ctx.globalAlpha = 0.35 + 0.25 * pulse; ctx.strokeStyle = '#ff8a96'; ctx.lineWidth = 6;
      const off = (time * 60) % 60; ctx.beginPath(); for (let d = -A.r * 2; d < A.r * 2; d += 60) { ctx.moveTo(A.x + d + off - A.r, A.y - A.r - 60); ctx.lineTo(A.x + d + off + A.r, A.y + A.r + 60); } ctx.stroke(); ctx.restore();
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(A.x, A.y, A.r - 4, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.lineWidth = 8; ctx.strokeStyle = CUES.away.col; ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (const [x, y, r] of t.c || []) {
      const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.5); g.addColorStop(0, 'rgba(92,255,157,.35)'); g.addColorStop(1, 'rgba(92,255,157,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = '#0d1a12'; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = cue.col; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r * (1 - k), 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      for (let i = 0; i < 4; i++) { const a = time * 2 + i * Math.PI / 2; ctx.fillStyle = '#eafff2'; ctx.fillRect(Math.round(x + Math.cos(a) * r * 0.6) - 2, Math.round(y + Math.sin(a) * r * 0.6) - 2, 4, 4); }
    }
    ctx.restore(); return;
  }
  if (t.sh === 'path') {
    telePath(ctx, t); ctx.globalAlpha = 0.25 + 0.3 * k; ctx.lineWidth = t.w; ctx.strokeStyle = cue.col; ctx.stroke();
    ctx.globalAlpha = 0.9; ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.restore(); return;
  }
  // tinted fill, ink + colour outline, white time-to-impact sweep
  ctx.globalAlpha = t.k === 'memshow' ? 0.7 : 0.3 + 0.3 * k; ctx.fillStyle = cue.fill; // (A2: brighter from the first frame; memory steps flash bright) telePath(ctx, t); ctx.fill('evenodd');
  ctx.globalAlpha = 0.95; telePath(ctx, t); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(10,8,18,.75)'; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = cue.col; ctx.stroke();
  ctx.globalAlpha = 0.6 + 0.4 * pulse; telePath(ctx, t, k); ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  // cue glyphs
  ctx.globalAlpha = 1;
  if (t.sh === 'tower') { const need = t.n || 1, have = t.have | 0; for (let i = 0; i < need; i++) { const a = -Math.PI / 2 + (i - (need - 1) / 2) * 0.45; const x = t.x + Math.cos(a) * (t.r + 16), y = t.y + Math.sin(a) * (t.r + 16); ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fillStyle = i < have ? cue.col : 'rgba(20,16,30,.8)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); } }
  if (t.sh === 'spread' || t.sh === 'stack') { // arrows: out for spread, in for stack
    const inw = t.sh === 'stack'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, r1 = t.r * (inw ? 0.95 : 0.55), r2 = t.r * (inw ? 0.6 : 0.9), f = inw ? -1 : 1, x2 = t.x + Math.cos(a) * r2, y2 = t.y + Math.sin(a) * r2; ctx.beginPath(); ctx.moveTo(t.x + Math.cos(a) * r1, t.y + Math.sin(a) * r1); ctx.lineTo(x2, y2); ctx.moveTo(x2, y2); ctx.lineTo(x2 - Math.cos(a + 0.5) * 10 * f, y2 - Math.sin(a + 0.5) * 10 * f); ctx.moveTo(x2, y2); ctx.lineTo(x2 - Math.cos(a - 0.5) * 10 * f, y2 - Math.sin(a - 0.5) * 10 * f); ctx.stroke(); }
  }
  if (t.tell && !o.label) o = { ...o, label: t.tell + (t.warn ? '' : ' ' + Math.max(0, ((t.d - t.t) / 60)).toFixed(1)) };
  if (o.label) { ctx.font = "13px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#120c18'; const ly = /cone|rect|line|wall|ring/.test(t.sh) ? t.y - 60 : t.y - (t.r || 40) - 10; ctx.strokeText(o.label, t.x, ly); ctx.fillStyle = cue.col; ctx.fillText(o.label, t.x, ly); }
  ctx.restore();
}
/** the colour legend (Options + the first boss pull): rows of [colour, text] */
export const LEGEND = Object.values(CUES).map((c) => [c.col, c.txt]);
/** a compact screen-space legend card */
export function drawLegend(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(18,14,28,.82)'; ctx.fillRect(0, 0, 230, 18 + LEGEND.length * 20); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(0.5, 0.5, 229, 17 + LEGEND.length * 20);
  ctx.font = "12px 'Lilita One', sans-serif"; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText('TELEGRAPHS', 10, 14);
  LEGEND.forEach(([c, t], i) => { ctx.fillStyle = c; ctx.fillRect(10, 22 + i * 20, 14, 14); ctx.strokeStyle = '#fff'; ctx.strokeRect(10.5, 22.5 + i * 20, 13, 13); ctx.fillStyle = '#fff'; ctx.fillText(t, 32, 34 + i * 20); });
  ctx.restore();
}

/** the cue colours as [rgba prefix, edge] for engines with bespoke shapes (their art stays, the colour follows the grammar) */
export const CUE_RGB = { away: ['rgba(255,77,94,', '#ff4d5e'], close: ['rgba(77,166,255,', '#4da6ff'], soak: ['rgba(255,210,63,', '#ffd23f'], spread: ['rgba(192,107,255,', '#c06bff'], safe: ['rgba(92,255,157,', '#5cff9d'] };
/** a sim area's cue: explicit a.cue, else from its kind name (stack / spread / soak / safe words), else away */
export function areaCue(a) {
  if (a.cue && CUE_RGB[a.cue]) return a.cue;
  const k = String(a.kind || '');
  if (/stack|share|gather/i.test(k)) return 'close';
  if (/spread/i.test(k)) return 'spread';
  if (/tower|soak/i.test(k)) return 'soak';
  if (/safe/i.test(k)) return 'safe';
  return 'away';
}
/** the grammar outline over a bespoke ENEMY telegraph area (frost / ember / rift / missions / sites / world bosses):
 *  crisp ink + cue outline and the white time-to-impact sweep, so every boss reads the same way. No gameplay effect. */
export function drawAreaCue(ctx, a, time) {
  if (a.team !== 'enemy' || a.visual || !(a.t < a.delay) || !a.shape) return;
  const sh = a.shape === 'circle' ? (a.r0 ? 'ring' : 'circle') : a.shape === 'cone' ? 'cone' : a.shape === 'line' ? 'rect' : null; if (!sh) return;
  const t = { sh, x: a.x, y: a.y, r: a.r, r0: a.r0, ang: a.ang, arc: a.arc != null ? a.arc : a.angle, len: a.len, w: a.w }, k = Math.min(1, a.t / Math.max(1, a.delay)), col = CUE_RGB[areaCue(a)][1];
  if (sh === 'cone' && !(t.arc > 0)) return;
  ctx.save(); ctx.lineJoin = 'round';
  telePath(ctx, t); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(10,8,18,.6)'; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.stroke();
  ctx.globalAlpha = 0.85; telePath(ctx, t, k); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  ctx.restore();
}
