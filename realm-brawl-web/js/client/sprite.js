// Offscreen sprite cache + the shared "detail light" pass (art & perf pass).
// Every static-looking thing (props, enemy bodies at a facing bucket, boss parts) is painted ONCE into an offscreen
// canvas at the current pixel scale and blitted after that. litPass() adds the house lighting to any sprite canvas:
// a soft light->shade wash from the upper left, a warm rim light on the lit silhouette edge and a cool occlusion
// band on the far edge, so code-drawn art reads as layered and lit without per-frame gradients.
const TAU = Math.PI * 2;
export const LIGHT = -2.3; // world light direction (upper left), same as dunesfx LA
const cache = new Map();
let SCALE = 1.5, MAX = 2600;
export const spriteStats = { builds: 0, hits: 0, size: 0 };
let BUILT = 0;
/** Per-frame build budget: true when the sprite is cached or a few more may still be painted this frame (else draw live). */
export const spriteBudget = (key, n = 6) => cache.has(key) || BUILT < n;
export function spriteFrame() { BUILT = 0; }
const mk = (w, h) => { const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas'); c.width = w; c.height = h; return c; };
export const newCanvas = mk;

/** Pixel scale of the cache (device px per world unit, clamped 1..2, quarter steps). Changing it flushes the cache. */
export function setSpriteScale(s) {
  const q = Math.max(1, Math.min(2, Math.round(s * 4) / 4));
  if (q !== SCALE) { SCALE = q; cache.clear(); }
  return SCALE;
}
export const spriteScale = () => SCALE;

/** Get (or paint) a sprite: a w x h world-unit box whose origin sits at (ox, oy) inside it. draw(g) paints in world units. */
export function sprite(key, w, h, ox, oy, draw, lit = null) {
  let c = cache.get(key);
  if (c) { spriteStats.hits++; return c; }
  const pw = Math.max(1, Math.ceil(w * SCALE)), ph = Math.max(1, Math.ceil(h * SCALE));
  c = mk(pw, ph);
  const g = c.getContext('2d');
  g.setTransform(SCALE, 0, 0, SCALE, ox * SCALE, oy * SCALE);
  g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g);
  if (lit) litPass(c, lit);
  c.sw = w; c.sh = h; c.ox = ox; c.oy = oy;
  c = trim(c);
  cache.set(key, c);
  spriteStats.builds++; BUILT++; spriteStats.size = cache.size;
  if (cache.size > MAX) { let n = 0; for (const k of cache.keys()) { cache.delete(k); if (++n > 200) break; } }
  return c;
}
// Crop a freshly painted sprite to its opaque bounds (+1px): the paint boxes are generous, and in software raster
// drawImage cost scales with the destination area, so empty margins were a real cost for big props / packs.
let RD = null, RDG = null;
function trim(c) {
  const W = c.width, H = c.height;
  if (W * H < 1024) return c;
  // read alpha from a CPU scratch canvas (willReadFrequently) so the sprite itself never gets a GPU readback
  if (!RD || RD.width < W || RD.height < H) { RD = mk(Math.max(W, RD ? RD.width : 0), Math.max(H, RD ? RD.height : 0)); RDG = RD.getContext('2d', { willReadFrequently: true }); }
  let d; try { RDG.clearRect(0, 0, W, H); RDG.drawImage(c, 0, 0); d = RDG.getImageData(0, 0, W, H).data; } catch { return c; }
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) { const row = y * W * 4; for (let x = 0; x < W; x++) if (d[row + x * 4 + 3] > 2) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; } }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(W - 1, x1 + 1); y1 = Math.min(H - 1, y1 + 1);
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1;
  if (nw * nh > W * H * 0.8) return c;
  const n = mk(nw, nh); n.getContext('2d').drawImage(c, x0, y0, nw, nh, 0, 0, nw, nh);
  const kx = c.sw / W, ky = c.sh / H;
  n.sw = nw * kx; n.sh = nh * ky; n.ox = c.ox - x0 * kx; n.oy = c.oy - y0 * ky;
  return n;
}
/** Draw a cached sprite with its origin at (x, y), optionally scaled by k. */
export function blit(ctx, c, x, y, k = 1) { ctx.drawImage(c, x - c.ox * k, y - c.oy * k, c.sw * k, c.sh * k); }
/** Draw a cached sprite rotated by ang around its origin. */
export function blitRot(ctx, c, x, y, ang, k = 1) {
  if (!ang) return blit(ctx, c, x, y, k);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.drawImage(c, -c.ox * k, -c.oy * k, c.sw * k, c.sh * k); ctx.restore();
}

let T1 = null, T2 = null;
const tmp = (c, w, h) => { if (!c || c.width < w || c.height < h) c = mk(Math.max(w, c ? c.width : 0), Math.max(h, c ? c.height : 0)); const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, w, h); return c; };
/**
 * In-place house lighting on a canvas (pixel space). o: { rim, shade, ao, d (edge width px), la (light angle), warm, cool, x0, y0, w, h }
 * Only touches pixels the art already covers (source-atop), so it is safe on any sprite / hero buffer.
 */
export function litPass(c, o = {}) {
  const w = o.w || c.width, h = o.h || c.height, x0 = o.x0 || 0, y0 = o.y0 || 0;
  const la = o.la ?? LIGHT, d = Math.max(1, o.d ?? 2.2 * SCALE), lx = Math.cos(la), ly = Math.sin(la);
  const g = c.getContext('2d');
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  // 1) light -> shade wash across the whole silhouette
  const sh = o.shade ?? 0.26;
  if (sh > 0) {
    const cx = x0 + w / 2, cy = y0 + h / 2, R = Math.max(w, h) * 0.5;
    const gr = g.createLinearGradient(cx + lx * R, cy + ly * R, cx - lx * R, cy - ly * R);
    gr.addColorStop(0, `rgba(255,248,226,${sh * 0.55})`); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(24,12,44,${sh})`);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(x0, y0, w, h);
  }
  // 2) rim light (lit edge) and 3) occlusion band (far edge): silhouette minus a shifted silhouette
  const band = (dx, dy, col, a) => {
    T1 = tmp(T1, x0 + w, y0 + h);
    const t = T1.getContext('2d');
    t.drawImage(c, x0, y0, w, h, x0, y0, w, h);
    t.globalCompositeOperation = 'source-in'; t.fillStyle = col; t.fillRect(x0, y0, w, h);
    t.globalCompositeOperation = 'destination-out'; t.drawImage(c, x0, y0, w, h, x0 + dx, y0 + dy, w, h);
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a; g.drawImage(T1, x0, y0, w, h, x0, y0, w, h); g.globalAlpha = 1;
  };
  if ((o.rim ?? 0.55) > 0) band(-lx * d, -ly * d, o.warm || '#fff6dc', o.rim ?? 0.55);
  if ((o.ao ?? 0.32) > 0) band(lx * d * 1.3, ly * d * 1.3, o.cool || '#1a1030', o.ao ?? 0.32);
  g.restore();
}

// ------------------------------------------------------------------ crisp hit flash (experience pass 1)
// A pure-white copy of a sprite's silhouette (cached per sprite canvas), blitted over the body for the first frames of a
// hit: the exact outline of the art lights up, instead of a soft white disc over it.
const WHITE = new WeakMap();
export function whiteOf(c) {
  let w = WHITE.get(c);
  if (w) return w;
  w = mk(c.width, c.height);
  const g = w.getContext('2d'); g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
  w.sw = c.sw; w.sh = c.sh; w.ox = c.ox; w.oy = c.oy;
  WHITE.set(c, w);
  return w;
}
/** flash curve from the sim's flash ticks (6 on a hit): solid white for ~3 ticks, then a fast fade */
export const flashK = (ticks) => (ticks >= 3 ? 1 : ticks > 0 ? ticks / 3 : 0);
// perf pass 3 (2026-10-09): a keyed buffer (live flashing enemy poses) learns the painted bounds of its key (type +
// state) from a few alpha readbacks and then blits / whitens only that box instead of the whole generous square: in
// software raster drawImage / fillRect cost scales with the area, and the box was mostly empty. The bound only grows,
// is re-measured every 32nd draw, and carries a 4-unit margin, so nothing the pose paints falls outside it.
const BOUNDS = new Map(); let BRD = null, BRDG = null;
function measureBounds(buf) {
  const W = buf.px, c = buf.c;
  if (!BRD || BRD.width < W) { BRD = mk(Math.max(W, BRD ? BRD.width : 0), Math.max(W, BRD ? BRD.width : 0)); BRDG = BRD.getContext('2d', { willReadFrequently: true }); }
  let d; try { BRDG.clearRect(0, 0, W, W); BRDG.drawImage(c, 0, 0, W, W, 0, 0, W, W); d = BRDG.getImageData(0, 0, W, W).data; } catch { return null; }
  let x0 = W, y0 = W, x1 = -1, y1 = -1;
  for (let y = 0; y < W; y++) { const row = y * W * 4; for (let x = 0; x < W; x++) if (d[row + x * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; } }
  if (x1 < 0) return null;
  const k = buf.size / W, h = buf.size / 2; // buffer px -> world units around the centre
  return [x0 * k - h, y0 * k - h, (x1 + 1) * k - h, (y1 + 1) * k - h];
}
/** A reusable per-frame buffer (heroes, bosses): paint into it, light it, blit it. */
export class LitBuffer {
  constructor() { this.c = null; this.key = null; this.r = null; }
  begin(size, key = null) { // size in world units (square, origin at the centre); key: learn + use the painted bounds
    const px = Math.ceil(size * SCALE);
    if (!this.c || this.c.width < px) { this.c = mk(px, px); this.c.__dyn = 1; } // (__dyn: repainted every frame: the GL recorder must not cache it as a texture)
    const g = this.c.getContext('2d');
    this.px = px; this.size = size; this.key = key; this.r = null;
    // (projperf pass: once a key's bounds are learned and this is not a re-measure draw, only its box is ever read back or
    //  blitted, so only that box needs clearing - the full-square clear was the bulk of a live flashing pose's raster cost)
    const b = key && !globalThis.__rbNoFlashBox && !globalThis.__rbFullClear ? BOUNDS.get(key) : null; // (__rbFullClear: pixel-diff A/B)
    const r = b && b.n >= 4 && b.n % 32 !== 0 ? this.boxOf(b) : null;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    if (r) g.clearRect(r[0] - 2, r[1] - 2, r[2] + 4, r[3] + 4); else // (+2px: drawImage's filter may sample just past the source rect)
    g.clearRect(0, 0, px, px);
    g.setTransform(SCALE, 0, 0, SCALE, (px / 2), (px / 2));
    return g;
  }
  /** the box (buffer px) to blit: the learned bounds of this key, or the whole square */
  box() {
    const px = this.px;
    if (!this.key || globalThis.__rbNoFlashBox) return [0, 0, px, px]; // (__rbNoFlashBox: pixel-diff checks)
    let b = BOUNDS.get(this.key);
    if (!b || b.n < 4 || b.n % 32 === 0) {
      const m = measureBounds(this);
      if (m) { if (!b) BOUNDS.set(this.key, b = { r: m, n: 0 }); else { const r = b.r; r[0] = Math.min(r[0], m[0]); r[1] = Math.min(r[1], m[1]); r[2] = Math.max(r[2], m[2]); r[3] = Math.max(r[3], m[3]); } }
      if (!b || b.n < 4) { if (b) b.n++; return [0, 0, px, px]; } // (still learning: blit the whole square)
    }
    b.n++;
    return this.boxOf(b);
  }
  boxOf(b) {
    const px = this.px, k = px / this.size, h = this.size / 2, M = 4, r = b.r;
    const x0 = Math.max(0, Math.floor((r[0] - M + h) * k)), y0 = Math.max(0, Math.floor((r[1] - M + h) * k));
    const x1 = Math.min(px, Math.ceil((r[2] + M + h) * k)), y1 = Math.min(px, Math.ceil((r[3] + M + h) * k));
    return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : [0, 0, px, px];
  }
  end(ctx, x, y, lit) {
    if (lit) litPass(this.c, { ...lit, w: this.px, h: this.px });
    const r = this.r = this.box(), k = this.size / this.px;
    ctx.drawImage(this.c, r[0], r[1], r[2], r[3], x - this.size / 2 + r[0] * k, y - this.size / 2 + r[1] * k, r[2] * k, r[3] * k);
  }
  /** after end(): the white silhouette of what was just painted, at alpha a */
  flash(ctx, x, y, a) {
    if (!(a > 0) || !this.c) return;
    // (balance pass perf: whiten the buffer in place - it is repainted from scratch next begin() - instead of copying it
    //  into a second canvas first: one full-buffer copy less per flashing boss per frame)
    const r = this.r || [0, 0, this.px, this.px], k = this.size / this.px;
    const g = this.c.getContext('2d'); g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(r[0], r[1], r[2], r[3]); g.restore();
    const ga = ctx.globalAlpha; ctx.globalAlpha = ga * a;
    ctx.drawImage(this.c, r[0], r[1], r[2], r[3], x - this.size / 2 + r[0] * k, y - this.size / 2 + r[1] * k, r[2] * k, r[3] * k);
    ctx.globalAlpha = ga;
  }
}
/** A soft radial glow (cached; replaces per-frame shadowBlur / radial gradients). col must be #rrggbb. */
export function glowSprite(col, r) {
  r = Math.max(2, Math.round(r));
  return sprite('glow:' + col + ':' + r, r * 2, r * 2, r, r, (g) => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, col); gr.addColorStop(0.35, col + '88'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2); });
}
export { TAU };
