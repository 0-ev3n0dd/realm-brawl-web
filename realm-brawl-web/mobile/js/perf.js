// Phone performance tooling (2026-10-07): a cheap per-frame profiler (5 buckets: sim, fx, render, hud, dom) in a
// fixed ring buffer (no allocation per frame), percentile summaries for the bench (tools/mobileperf-bench.mjs) and an
// optional on-screen overlay (Options › Perf overlay).
export const BUCKETS = ['sim', 'fx', 'render', 'hud', 'dom'];
export const RING = 900;
export class FrameProfiler {
  constructor(n = RING) { this.n = n; this.buf = new Float32Array(n * (BUCKETS.length + 2)); this.i = 0; this.count = 0; this.t = 0; this.k = 0; this.cur = new Float32Array(BUCKETS.length); }
  begin(t) { this.t = t; this.k = 0; this.cur.fill(0); }
  /** close bucket b (time since the previous mark) */
  mark(b) { const now = performance.now(); this.cur[b] += now - this.t; this.t = now; }
  end(dt) {
    const W = BUCKETS.length + 2, o = this.i * W; let tot = 0;
    for (let b = 0; b < BUCKETS.length; b++) { this.buf[o + b] = this.cur[b]; tot += this.cur[b]; }
    this.buf[o + BUCKETS.length] = tot; this.buf[o + BUCKETS.length + 1] = dt * 1000;
    this.i = (this.i + 1) % this.n; this.count = Math.min(this.n, this.count + 1);
  }
  reset() { this.i = 0; this.count = 0; }
  /** rows of the last `last` frames: { sim, fx, render, hud, dom, work, dt } */
  rows(last = this.count) {
    const W = BUCKETS.length + 2, out = [], m = Math.min(last, this.count);
    for (let k = m; k > 0; k--) { const o = ((this.i - k + this.n) % this.n) * W, r = {}; BUCKETS.forEach((b, j) => (r[b] = this.buf[o + j])); r.work = this.buf[o + BUCKETS.length]; r.dt = this.buf[o + BUCKETS.length + 1]; out.push(r); }
    return out;
  }
  summary(last) { return summarize(this.rows(last)); }
}
export function pct(a, p) { if (!a.length) return 0; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; }
export function summarize(rows) {
  const out = { n: rows.length };
  for (const k of [...BUCKETS, 'work', 'dt']) { const a = rows.map((r) => r[k]); out[k] = { p50: +pct(a, 0.5).toFixed(2), p95: +pct(a, 0.95).toFixed(2), p99: +pct(a, 0.99).toFixed(2) }; }
  const dts = rows.map((r) => r.dt), mean = dts.reduce((a, b) => a + b, 0) / Math.max(1, dts.length);
  out.fps = +(1000 / Math.max(1, mean)).toFixed(1); out.avg = +mean.toFixed(1);
  out.low1 = Math.round(1000 / Math.max(1, pct(dts, 0.99))); out.minFps = Math.round(1000 / Math.max(1, ...dts, 1)); // (1% low = the p99 frame time as fps)
  return out;
}
/** tiny canvas overlay: fps + the 5 buckets as stacked bars (drawn last, on the game canvas: no DOM churn) */
export class PerfOverlay {
  constructor() { this.t = 0; this.txt = ''; }
  draw(ctx, prof, game) {
    const r = game.renderer; if (!ctx) return;
    const now = performance.now();
    if (now - this.t > 500) { this.t = now; const s = prof.summary(60); this.txt = `${s.fps} fps (avg ${s.avg} ms · 1% low ${s.low1} · min ${s.minFps}) · p95 ${s.work.p95} ms · sim ${s.sim.p50} fx ${s.fx.p50} rnd ${s.render.p50} hud ${s.hud.p50} dom ${s.dom.p50} · q${game.quality} ${Math.round(r.dpr * 100) / 100}x`; }
    ctx.save();
    ctx.font = '11px monospace'; const w = ctx.measureText(this.txt).width + 10;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(r.w / 2 - w / 2, r.h - 52, w, 16); ctx.fillStyle = '#7dffa0'; ctx.textAlign = 'center'; ctx.fillText(this.txt, r.w / 2, r.h - 40);
    const rows = prof.rows(90), cols = ['#5dd6ff', '#ff9a4a', '#ffd23f', '#c77dff', '#ff5e5b'], x0 = r.w / 2 - 90;
    rows.forEach((q, i) => { let y = r.h - 56; BUCKETS.forEach((b, j) => { const hh = q[b] * 1.2; ctx.fillStyle = cols[j]; ctx.fillRect(x0 + i * 2, y - hh, 2, hh); y -= hh; }); });
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x0, r.h - 56 - 16.7 * 1.2, 180, 1);
    ctx.restore();
  }
}

/** Phone render resolution (device px per CSS px) for the WORLD canvas: decoupled from the device pixel ratio. The world
 *  is painterly art drawn at ~1.5x and upscaled by the compositor (bilinear) - on a 2.5-3x phone the difference from 2x is
 *  invisible at arm's length while the raster cost drops ~44%. The HUD stays native (HudLayer). quality: 2 full, 1, 0;
 *  dyn: the auto-quality safety net's extra factor (1 = off). Never below 1x CSS (except quality 0 on a 1x screen). */
export const RES_CAP = [1, 1.25, 1.5];
export function worldDpr(devDpr, quality = 2, dyn = 1) {
  const d = Math.max(1, devDpr || 1), cap = RES_CAP[quality] ?? 1.5;
  return Math.max(Math.min(1, d), +(Math.min(d, cap) * dyn).toFixed(3));
}
/** HUD canvas resolution: native up to 2x (text, icons and the touch controls stay sharp) */
export const hudDpr = (devDpr) => Math.min(2, Math.max(1, devDpr || 1));
/** the screen-space HUD on its own canvas (pointer-events: none) above the world canvas */
export class HudLayer {
  constructor(canvas) { this.c = canvas; this.ctx = canvas ? canvas.getContext('2d') : null; this.w = 0; this.h = 0; this.dpr = 0; }
  /** a cleared HUD context, or null when the world canvas already renders at the HUD's resolution (then the HUD draws
   *  on the world canvas as before: no second full-screen layer to raster / composite) */
  begin(w, h, worldD = 0) {
    if (!this.c) return null;
    const d = hudDpr(typeof window !== 'undefined' ? window.devicePixelRatio : 1);
    if (worldD >= d - 0.01) { if (this.on) { this.on = false; this.c.style.display = 'none'; } return null; }
    if (!this.on) { this.on = true; this.c.style.display = 'block'; }
    if (w !== this.w || h !== this.h || d !== this.dpr) { this.w = w; this.h = h; this.dpr = d; this.c.width = Math.round(w * d); this.c.height = Math.round(h * d); }
    const g = this.ctx; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, this.c.width, this.c.height);
    g.setTransform(d, 0, 0, d, 0, 0);
    return g;
  }
}

/** the auto-quality safety net, one step per second of measurement (pure: tested) */
export function autoStep(o) {
  let { lowT, highT, dyn, quality } = o, why = '';
  if (o.fps < 45) { lowT++; highT = 0; } else if (o.fps > 58 && o.frameMs < 8) { highT++; lowT = 0; } else { lowT = 0; highT = Math.max(0, highT - 1); }
  if (lowT >= 4) { lowT = 0; highT = -10; if (dyn > 0.71) { dyn = +(dyn - 0.15).toFixed(2); why = 'sustained low fps: resolution'; } else if (quality > 0) { quality--; why = 'sustained low fps: effects'; } }
  else if (highT >= 20) { highT = 0; if (quality < 2) { quality++; why = 'fps headroom'; } else if (dyn < 1) { dyn = Math.min(1, +(dyn + 0.15).toFixed(2)); why = 'fps headroom: resolution'; } }
  return { lowT, highT, dyn, quality, why };
}
