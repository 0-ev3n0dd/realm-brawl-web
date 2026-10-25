// Outlined-text bitmap cache (perf pass, world 2). strokeText + fillText re-rasterise every glyph outline on every frame,
// which in software canvas raster was ~25% of the HUD's cost in a big fight. A label is now drawn once into a small
// offscreen canvas at the current device scale and blitted (drawImage keeps globalAlpha). LRU; cleared when web fonts
// finish loading (a label baked with the fallback face must not stick). Rotated / skewed transforms draw directly.
const MAX = 500;
const cache = new Map();
let gen = 0;
if (typeof document !== 'undefined' && document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { gen++; cache.clear(); });
export const textCacheStats = { hits: 0, miss: 0, direct: 0, size: () => cache.size };
// piece 4 perf: a per-frame bake budget. A trial phase jump / bomb volley brings a burst of brand-new labels (the phase
// card, mechanic names, countdown numbers, damage numbers); baking 30 of them in one frame cost ~16 ms in software
// raster. Past the budget a label draws directly this frame and is baked on a later, quieter frame.
export const BAKE_BUDGET = 6;
let bakeT = -1e9, bakes = 0;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const FRAC_PX = /(\d+\.\d+)px/, roundPx = (_, v) => Math.round(+v) + 'px';
let G0 = null; // (one shared measuring context instead of a new 1x1 canvas per miss)
const mk = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));

/** Draw s at (x, y) with textBaseline 'middle' like the HUD helpers: font = full CSS font, lw = outline width (0 = none). */
export function drawText(ctx, s, x, y, font, color, align, lw, ink, size) {
  const m = ctx.getTransform ? ctx.getTransform() : null;
  if (!m || m.b || m.c || typeof document === 'undefined' || s == null || s === '') { direct(ctx, s, x, y, font, color, align, lw, ink); return; }
  if (font.indexOf('.') >= 0) font = font.replace(FRAC_PX, roundPx); // (pulsing labels animate a fractional font size: one bake per whole px, not per frame)
  const sc = Math.round(Math.abs(m.a) * 20) / 20 || 1;
  const key = font + '|' + color + '|' + lw + '|' + ink + '|' + sc + '|' + s;
  let e = cache.get(key);
  if (e) { cache.delete(key); cache.set(key, e); textCacheStats.hits++; }
  else {
    const t = now(); if (t - bakeT > 16) { bakeT = t; bakes = 0; }
    if (++bakes > BAKE_BUDGET) { textCacheStats.direct++; direct(ctx, s, x, y, font, color, align, lw, ink); return; }
    textCacheStats.miss++;
    const g0 = G0 || (G0 = mk(1, 1).getContext('2d')); g0.font = font;
    const tw = g0.measureText(String(s)).width, pad = (lw || 0) + 3;
    const wu = tw + pad * 2, hu = size * 1.5 + pad * 2;
    const c = mk(Math.max(1, Math.ceil(wu * sc)), Math.max(1, Math.ceil(hu * sc))), g = c.getContext('2d');
    g.scale(sc, sc); g.font = font; g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    if (lw) { g.lineWidth = lw; g.strokeStyle = ink; g.strokeText(String(s), pad, hu / 2); }
    g.fillStyle = color; g.fillText(String(s), pad, hu / 2);
    e = { c, wu, hu, tw, pad };
    cache.set(key, e);
    if (cache.size > MAX) cache.delete(cache.keys().next().value);
  }
  const ox = align === 'center' ? -e.tw / 2 : align === 'right' || align === 'end' ? -e.tw : 0;
  ctx.drawImage(e.c, x + ox - e.pad, y - e.hu / 2, e.wu, e.hu);
}
function direct(ctx, s, x, y, font, color, align, lw, ink) {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = ink; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}

// Cached glow plates (perf pass, world 2): ctx.shadowBlur re-runs a gaussian blur over the shape every frame (the
// pulsing ready-glow on skill slots / full resource meters was ~1 ms per slot in software raster). The blurred plate is
// rendered once per (size, radius, colour, fill, blur step, scale) and blitted; the pulse is kept by stepping the blur
// in 2 px steps.
const glowCache = new Map();
/** A filled rounded rect with a coloured shadow glow, like { shadowColor: col, shadowBlur: blur; rrect; fill(fill) }. */
export function glowRR(ctx, x, y, w, h, r, col, blur, fill) {
  const m = ctx.getTransform ? ctx.getTransform() : null;
  if (!m || m.b || m.c || typeof document === 'undefined') { ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = blur; rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.restore(); return; }
  const sc = Math.round(Math.abs(m.a) * 10) / 10 || 1, b = Math.max(0, Math.round(blur / 2) * 2), W = Math.round(w), H = Math.round(h);
  const key = W + ',' + H + ',' + Math.round(r) + ',' + col + ',' + fill + ',' + b + ',' + sc;
  let e = glowCache.get(key);
  if (!e) {
    const pad = b * 1.6 + 4, wu = W + pad * 2, hu = H + pad * 2;
    const c = mk(Math.ceil(wu * sc), Math.ceil(hu * sc)), g = c.getContext('2d');
    g.scale(sc, sc); g.shadowColor = col; g.shadowBlur = b * sc; rr(g, pad, pad, W, H, r); g.fillStyle = fill; g.fill();
    e = { c, pad, wu, hu }; glowCache.set(key, e);
    if (glowCache.size > 300) glowCache.delete(glowCache.keys().next().value);
  }
  ctx.drawImage(e.c, x - e.pad, y - e.pad, e.wu, e.hu);
}
function rr(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
