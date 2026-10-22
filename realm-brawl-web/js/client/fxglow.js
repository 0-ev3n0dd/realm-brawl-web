// Shared high-quality rendering helpers for the FX overhaul: cached soft-glow sprites (one radial gradient per colour, drawn
// with drawImage instead of building a gradient for every particle every frame), additive bloom, soft particles in several
// shapes (diamond, 4-point star, petal, feather, music note, page, rune), easing curves and a cheap motion-ribbon.
// Every helper falls back to plain canvas paths when there is no DOM (node tests draw the HUD with a stub context).
const TAU = Math.PI * 2;
const CACHE = new Map();
const HAS_DOM = typeof document !== 'undefined' && typeof document.createElement === 'function';
/** A 96x96 soft radial sprite: hot centre (white-ish) -> colour -> transparent. Cached by colour + hardness. */
export function glowSprite(color, hard = 0) {
  if (!HAS_DOM) return null;
  const key = color + '|' + hard;
  let c = CACHE.get(key);
  if (c) return c;
  if (CACHE.size > 240) CACHE.clear();
  c = document.createElement('canvas'); c.width = c.height = 96;
  const g = c.getContext('2d');
  if (!g || !g.createRadialGradient) return null;
  const gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
  // a smooth falloff (roughly gaussian) so big blooms tint the scene instead of blowing it out to white
  // (fix: rgb()/rgba() colours used to be painted at full strength on every stop -> a solid blurry square, e.g. the purple
  //  Shadow Clone smoke puffs; now their channels are parsed and the falloff alpha is multiplied in)
  const m = color[0] === '#' ? null : /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(color);
  const cc = (a) => (color[0] === '#' ? rgba(color, a) : m ? `rgba(${m[1]},${m[2]},${m[3]},${(m[4] === undefined ? 1 : +m[4]) * a})` : a <= 0 ? 'rgba(0,0,0,0)' : color);
  if (hard) { gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.18, cc(0.85)); gr.addColorStop(0.45, cc(0.35)); gr.addColorStop(0.75, cc(0.08)); gr.addColorStop(1, cc(0)); }
  else { gr.addColorStop(0, cc(0.8)); gr.addColorStop(0.25, cc(0.5)); gr.addColorStop(0.55, cc(0.16)); gr.addColorStop(0.8, cc(0.04)); gr.addColorStop(1, cc(0)); }
  g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
  if (!hard) { // a soft brighter core
    const c2 = g.createRadialGradient(48, 48, 0, 48, 48, 14); c2.addColorStop(0, 'rgba(255,255,255,.35)'); c2.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = c2; g.fillRect(0, 0, 96, 96);
  }
  CACHE.set(key, c);
  return c;
}
/** Additive soft light of radius r. */
export function bloom(ctx, x, y, r, color, a = 1, hard = 0) {
  if (!(r > 0) || !(a > 0)) return;
  const s = glowSprite(color, hard);
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga * Math.min(1, a) * (r > 120 ? Math.pow(120 / r, 0.6) : 1); // big blooms are dimmer per pixel (no white-outs)
  if (s && ctx.drawImage) ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  else { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, TAU); ctx.fill(); }
  ctx.globalCompositeOperation = op; ctx.globalAlpha = ga;
}
/** Normal-blend soft blob (smoke, ink, mist). */
export function soft(ctx, x, y, r, color, a = 1) {
  if (!(r > 0) || !(a > 0)) return;
  const s = glowSprite(color, 0), ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * Math.min(1, a);
  if (s && ctx.drawImage) ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  else { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = ga;
}
// ---- easing
export const ease = {
  out: (k) => 1 - Math.pow(1 - k, 3),
  in: (k) => k * k * k,
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  back: (k) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
  elastic: (k) => (k <= 0 ? 0 : k >= 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (TAU / 3)) + 1),
};
// ---- shapes (centred at 0,0, size s)
export const SHAPES = {
  diamond(ctx, s) { ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.55, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.55, 0); ctx.closePath(); },
  star4(ctx, s) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? s * 0.28 : s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); },
  petal(ctx, s) { ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * 0.8, -s * 0.2, 0, s); ctx.quadraticCurveTo(-s * 0.8, -s * 0.2, 0, -s); ctx.closePath(); },
  feather(ctx, s) { ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * 0.5, -s * 0.1, s * 0.1, s); ctx.lineTo(-s * 0.1, s); ctx.quadraticCurveTo(-s * 0.5, -s * 0.1, 0, -s); ctx.closePath(); },
  page(ctx, s) { ctx.beginPath(); ctx.rect(-s * 0.6, -s * 0.8, s * 1.2, s * 1.6); },
  rune(ctx, s) { ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.8); ctx.lineTo(s * 0.5, -s * 0.8); ctx.lineTo(-s * 0.3, s * 0.1); ctx.lineTo(s * 0.4, s * 0.8); ctx.moveTo(-s * 0.6, 0); ctx.lineTo(s * 0.6, 0); },
  note(ctx, s) { ctx.beginPath(); ctx.ellipse(-s * 0.25, s * 0.55, s * 0.42, s * 0.3, -0.4, 0, TAU); ctx.moveTo(s * 0.12, s * 0.5); ctx.lineTo(s * 0.12, -s * 0.9); ctx.quadraticCurveTo(s * 0.7, -s * 0.6, s * 0.6, -s * 0.1); },
  snow(ctx, s) { ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s); ctx.lineTo(-Math.cos(a) * s, -Math.sin(a) * s); } },
};
const STROKED = new Set(['rune', 'snow']);
/** A soft particle: glow halo + crisp shape with a white core edge. */
export function mote(ctx, x, y, shape, s, rot, color, a = 1, glow = true) {
  if (!(a > 0)) return;
  if (glow) bloom(ctx, x, y, s * 2.4, color, a * 0.55);
  const ga = ctx.globalAlpha;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.globalAlpha = ga * a;
  const f = SHAPES[shape] || SHAPES.diamond;
  f(ctx, s);
  if (STROKED.has(shape)) { ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, s * 0.28); ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(0.8, s * 0.1); ctx.stroke(); }
  else if (shape === 'note') { ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, s * 0.2); ctx.stroke(); }
  else { ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = Math.max(0.8, s * 0.12); ctx.stroke(); }
  ctx.restore(); ctx.globalAlpha = ga;
}
/** A tapered glowing ribbon through points [[x,y],...] (oldest first). */
export function ribbon(ctx, pts, w, color, a = 1, core = '#ffffff') {
  if (!pts || pts.length < 2) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const n = pts.length;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 1; i < n; i++) {
    const k = i / (n - 1);
    ctx.globalAlpha = a * k * 0.45; ctx.strokeStyle = color; ctx.lineWidth = w * 2.2 * k + 1;
    ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 1; i < n; i++) {
    const k = i / (n - 1);
    ctx.globalAlpha = a * k; ctx.strokeStyle = color; ctx.lineWidth = w * k + 0.5;
    ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    if (core && k > 0.5) { ctx.strokeStyle = core; ctx.lineWidth = w * 0.3 * k; ctx.stroke(); }
  }
  ctx.restore();
}
/** Hex colour -> rgba() string. */
export function rgba(hex, a) {
  const h = hex.replace('#', ''), n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
