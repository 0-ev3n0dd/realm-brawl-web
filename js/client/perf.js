// Frame-time meter + the optional FPS overlay (Options → Performance → "FPS / frame-time overlay").
// Keeps the last 240 frames: shows fps, p50 / p95 frame time, avg / 1% low / min fps and the worst frame; window.__rbPerf exposes it to tools.
const KEY = 'realmbrawl.perf';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
export const perfPref = {
  on: !!load().overlay,
  set(v) { this.on = !!v; try { localStorage.setItem(KEY, JSON.stringify({ overlay: this.on })); } catch {} },
};
const N = 240;
export class PerfMeter {
  constructor() { this.dt = new Float32Array(N); this.cpu = new Float32Array(N); this.i = 0; this.n = 0; this.stats = null; this.statT = 0; }
  /** dt: seconds since the last frame; cpu: ms spent in this frame's JS (sim + draw). */
  frame(dt, cpu) {
    this.dt[this.i] = dt * 1000; this.cpu[this.i] = cpu; this.i = (this.i + 1) % N; this.n = Math.min(N, this.n + 1);
    this.statT += dt; if (this.statT > 0.25 || !this.stats) { this.statT = 0; this.stats = this.summary(); }
  }
  summary() {
    const n = this.n; if (!n) return { fps: 0, p50: 0, p95: 0, p99: 0, avg: 0, low1: 0, worst: 0, cpu50: 0, cpu95: 0, minFps: 0 };
    const a = Array.from(this.dt.subarray(0, n)).sort((x, y) => x - y), c = Array.from(this.cpu.subarray(0, n)).sort((x, y) => x - y);
    const q = (arr, k) => arr[Math.min(arr.length - 1, Math.floor(arr.length * k))];
    const mean = a.reduce((s, v) => s + v, 0) / n;
    return { fps: 1000 / mean, avg: mean, p50: q(a, 0.5), p95: q(a, 0.95), p99: q(a, 0.99), low1: 1000 / q(a, 0.99), worst: a[n - 1], minFps: 1000 / a[n - 1], cpu50: q(c, 0.5), cpu95: q(c, 0.95) };
  }
  reset() { this.i = 0; this.n = 0; this.stats = null; }
  draw(ctx, w, h, extra = '') {
    const s = this.stats; if (!s) return;
    const x = 12, y = h - 154, W = 216, H = 94;
    ctx.save(); ctx.globalAlpha = 0.82; ctx.fillStyle = '#16121e'; ctx.fillRect(x, y, W, H); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, W - 1, H - 1);
    // frame-time graph (last 120 frames; the line is 16.7 ms)
    const gx = x + 6, gy = y + H - 6, gh = 26;
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(gx, gy - gh * (16.7 / 33)); ctx.lineTo(gx + 120, gy - gh * (16.7 / 33)); ctx.stroke();
    for (let k = 0; k < Math.min(120, this.n); k++) {
      const v = this.dt[(this.i - 1 - k + N) % N], hh = Math.min(gh, gh * v / 33);
      ctx.fillStyle = v > 17.5 ? (v > 25 ? '#ff4d4d' : '#ffcf3a') : '#5dff7a'; ctx.fillRect(gx + 119 - k, gy - hh, 1, hh);
    }
    ctx.font = "12px 'Lilita One', monospace"; ctx.textAlign = 'left'; ctx.fillStyle = s.fps >= 59 ? '#5dff7a' : s.fps >= 45 ? '#ffcf3a' : '#ff6b6b';
    ctx.fillText(`${s.fps.toFixed(0)} FPS  min ${s.minFps.toFixed(0)}`, x + 6, y + 14);
    ctx.fillStyle = '#d9d2e6'; ctx.fillText(`frame p50 ${s.p50.toFixed(1)} p95 ${s.p95.toFixed(1)} ms`, x + 6, y + 28);
    ctx.fillText(`js p50 ${s.cpu50.toFixed(1)} p95 ${s.cpu95.toFixed(1)} ms${extra ? ' · ' + extra : ''}`, x + 6, y + 42);
    ctx.fillText(`avg ${s.avg.toFixed(1)} ms · 1% low ${s.low1.toFixed(0)} · min ${s.minFps.toFixed(0)} fps`, x + 6, y + 56); // (1% low = the p99 frame time as fps)
    ctx.restore();
  }
}
export const perfMeter = new PerfMeter();
if (typeof window !== 'undefined') window.__rbPerf = perfMeter;

// ---- adaptive quality governor (perf pass 2) ----
// Watches the real frame time; when the last ~0.75 s runs over the 60 fps budget it steps the quality down one level
// (render resolution, particle budget, additive blooms, decor detail), and after a calm stretch it tries one level up
// again. A level that immediately proved too slow is not retried for a while, so it settles instead of oscillating.
const GKEY = 'realmbrawl.quality';
const gload = () => { try { return JSON.parse(localStorage.getItem(GKEY) || '{}'); } catch { return {}; } };
export const QUALITY = [
  { res: 1, parts: 1, lite: false, detail: 2 },
  { res: 0.85, parts: 0.8, lite: false, detail: 2 },
  { res: 0.75, parts: 0.6, lite: true, detail: 1 },
  { res: 0.66, parts: 0.45, lite: true, detail: 1 },
  { res: 0.58, parts: 0.32, lite: true, detail: 0 },
  { res: 0.5, parts: 0.2, lite: true, detail: 0 }, // emergency floor (crowded co-op ults in software raster)
];
// Hysteresis (flicker fix): every level change resizes the canvas and re-scales the cached tiles / sprites, so a governor
// that flips between two levels every second reads as flicker. Now: after any change it holds for MIN_DWELL s (a step
// down while a frame is truly awful, p50 > 33 ms, may still go early), stepping up needs UP_CALM s of clean frames, and a
// level that proved too slow right after we moved to it is banned for BAN s, doubling each time it fails again (max 4 min).
// world 2 perf pass: the renderer reports a scene load (enemies / heroes / particles / telegraphs on screen) and every
// load-type step down remembers it per level (failLoad, decaying ~2%/s); a level is not re-probed while the scene is at
// least LOAD_K as busy as when it last missed, so a long fight no longer dips every 30-240 s when the ban runs out.
export const GOV = { SOFT_START: 2, FIGHT_LOAD: 5, SETTLE: 3, UP_FAIL: 20, MIN_DWELL: 2.5, UP_CALM: 6, BAN: 30, BAN_MAX: 240, DOWN_P90: 18.5, UP_P90: 17.2, LOAD_K: 0.8, LOAD_DECAY: 0.98 };
export const governor = {
  auto: gload().auto !== false,
  level: 0, load: 0, failLoad: new Float32Array(6), buf: new Float32Array(48), i: 0, n: 0, since: 0, calm: 0, ban: new Float32Array(QUALITY.length), fails: new Uint8Array(QUALITY.length), changes: 0, log: [],
  setAuto(v) { this.auto = !!v; try { localStorage.setItem(GKEY, JSON.stringify({ auto: this.auto })); } catch {} if (!this.auto) this.force(0); },
  get q() { return QUALITY[this.level]; },
  hold: 0, lastPos: null,
  settle(sec) { this.hold = Math.max(this.hold, sec); this.n = 0; },
  force(l) { l = Math.max(0, Math.min(QUALITY.length - 1, l)); const ch = l !== this.level; this.level = l; this.n = 0; this.since = 0; this.calm = 0; if (ch) { this.changes++; this.log.push(l); if (this.log.length > 40) this.log.shift(); } return ch; },
  /** dtMs: this frame's interval. Returns true when the level changed (the caller re-applies quality). */
  update(dtMs) {
    if (!this.auto || !(dtMs > 0) || dtMs > 250) return false; // (tab switches / hitches are not a load signal)
    const s = dtMs / 1000;
    if (this.hold > 0) { this.hold -= s; this.n = 0; return false; }
    const soft = !!(this.shedder && this.shedder.soft);
    if (soft && !this.softInit) { this.softInit = true; if (this.level < GOV.SOFT_START) return this.force(GOV.SOFT_START); } // software raster (SwiftShader / llvmpipe): start where a big fight still holds 60
    this.since += s;
    for (let k = 0; k < this.ban.length; k++) if (this.ban[k] > 0) this.ban[k] -= s;
    this.buf[this.i] = dtMs; this.i = (this.i + 1) % this.buf.length; this.n = Math.min(this.buf.length, this.n + 1);
    if (this.n < this.buf.length || this.since < 0.6) return false;
    const a = Array.from(this.buf).sort((x, y) => x - y), p50 = a[a.length >> 1], p90 = a[Math.floor(a.length * 0.9)];
    if (p90 > GOV.DOWN_P90 && this.level < QUALITY.length - 1 && (this.since >= GOV.MIN_DWELL || p50 > 33)) { // over budget: step down (a big miss steps two)
      const sh = this.shedder; if (sh && sh.shed && sh.shed()) { this.since = 0; this.calm = 0; this.sheds = (this.sheds || 0) + 1; return false; } // (keeps the frame window: at low fps refilling 48 frames would stall the step-down for many seconds) // the shader layer sheds its own cost first (shaderfx.js)
      if (this.since < GOV.UP_FAIL && this.lastUp) { const f = this.fails[this.level] = Math.min(4, this.fails[this.level] + 1); this.ban[this.level] = Math.min(GOV.BAN_MAX, GOV.BAN * 2 ** (f - 1)); } // the level we just climbed to was too slow
      this.lastUp = false;
      const to = this.level + (p50 > 30 && this.level < QUALITY.length - 2 ? 2 : 1);
      if (this.load > 0) for (let l = this.level; l < to; l++) this.failLoad[l] = Math.max(this.failLoad[l], this.load); // (world 2: a miss remembers how busy the scene was: p50 is over 48 frames, so even p50 > 30 is sustained, not one hitch)
      return this.force(to);
    }
    if (p90 <= GOV.UP_P90) this.calm += s; else this.calm = Math.max(0, this.calm - s * 2);
    if (this.calm > GOV.UP_CALM && this.since >= GOV.MIN_DWELL && this.shedder && this.shedder.unshed && this.shedder.unshed()) { this.calm = 0; this.since = 0; return false; } // give the shader back its resolution before the game's quality
    for (let k = 0; k < this.failLoad.length; k++) if (this.failLoad[k] > 0) this.failLoad[k] *= Math.pow(GOV.LOAD_DECAY, s);
    const busy = (this.level > 0 && this.failLoad[this.level - 1] > 0 && this.load >= this.failLoad[this.level - 1] * GOV.LOAD_K) || (soft && this.level <= GOV.SOFT_START && this.load > GOV.FIGHT_LOAD); // the level above already missed 60 fps at this much on screen: stay (no probe dips mid-fight)
    if (this.calm > GOV.UP_CALM && this.since >= GOV.MIN_DWELL && this.level > 0 && !(this.ban[this.level - 1] > 0) && !busy) { this.lastUp = true; return this.force(this.level - 1); }
    return false;
  },
};
if (typeof window !== 'undefined') window.__rbGov = governor;
/** The renderer's scene load for the governor (world 2): drawn enemies + 3 per hero + particles / 8 + 2 per telegraph. */
export function reportLoad(ents, heroes, parts, areas, x, y) {
  governor.load = ents + heroes * 3 + parts / 8 + areas * 2;
  // a teleport (mission start, portal, respawn) builds a screenful of tiles + sprites at once: that burst is not a load
  // signal, so the governor ignores the next SETTLE seconds instead of locking a low level in for the whole fight
  if (x != null) { const L = governor.lastPos; if (L && (x - L.x) ** 2 + (y - L.y) ** 2 > 1500 * 1500) governor.settle(GOV.SETTLE); governor.lastPos = { x, y }; }
}
/** Apply the governor's level to a renderer + fx system. */
export function applyQuality(renderer, fx) {
  const q = governor.q;
  if (renderer) { if (renderer.draw && renderer.resize) renderer.wantScale = q.res; else if (renderer.renderScale !== q.res) { renderer.renderScale = q.res; if (renderer.resize) renderer.resize(); } } // (the Renderer applies wantScale right before its next draw: a resize clears the canvas)
  if (renderer) { renderer.detail = q.detail; renderer.glowOK = q.detail >= 2; }
  if (fx) { fx.qLevel = governor.level; if (fx.shader) governor.shedder = fx.shader; } // (the shader layer reads the level and sheds its own cost first)
  if (fx) { fx.partMul = q.parts < 1 ? q.parts : undefined; fx.maxParts = Math.round(480 * q.parts * (q.detail <= 0 ? 0.5 : 1)); fx.maxTexts = q.detail <= 0 ? 40 : q.detail === 1 ? 90 : 160; fx.forceLite = q.lite; fx.areaFrac = q.detail <= 0 ? (q.res <= 0.5 ? 0.25 : 0.45) : q.detail === 1 ? 1.2 : 0; }
}

// ---- HUD layer cache (perf pass 2) ----
// At the lower quality levels the HUD is re-drawn into its own canvas every 2nd frame (every 3rd at the lowest) and that
// layer is blitted on the frames between: it is ~20% of the draw calls in a fight and nothing in it needs 60 Hz.
// pass 2: the layer is its own DOM canvas stacked right above the game canvas (pointer-events: none), so the frames
// between HUD redraws cost nothing on the main thread (no full-screen blit); a watchdog hides it as soon as the game
// stops drawing the HUD (menus, scene changes).
let HUDC = null, hudSkip = 0, hudDt = 0, hudTimer = 0;
const hideHud = () => { if (HUDC) HUDC.style.display = 'none'; hudSkip = 0; };
export function drawHudLayer(renderer, hudDraw, dt) {
  const q = governor.q, every = governor.hudLayer === false ? 1 : (q.detail >= 2 ? 1 : q.detail === 1 ? 2 : 3);
  const ctx = renderer.ctx;
  if (every === 1 || typeof document === 'undefined' || !renderer.canvas.insertAdjacentElement) { if (HUDC && HUDC.style.display !== 'none') hideHud(); hudDraw(ctx, dt); return; }
  hudDt += dt;
  const dpr0 = Math.min(2, window.devicePixelRatio || 1), dpr = Math.max(renderer.dpr, dpr0 * 0.75), cw = Math.round(renderer.w * dpr), ch = Math.round(renderer.h * dpr);
  if (!HUDC) {
    HUDC = document.createElement('canvas'); HUDC.id = 'hudLayer';
    Object.assign(HUDC.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none', display: 'none' });
    renderer.canvas.insertAdjacentElement('afterend', HUDC);
  }
  if (HUDC.width !== cw || HUDC.height !== ch) { HUDC.width = cw; HUDC.height = ch; HUDC.style.width = renderer.w + 'px'; HUDC.style.height = renderer.h + 'px'; hudSkip = 0; }
  if (hudSkip <= 0) {
    const g = HUDC.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cw, ch); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    hudDraw(g, hudDt); hudDt = 0; hudSkip = every;
    if (HUDC.style.display === 'none') HUDC.style.display = 'block';
  }
  hudSkip--;
  clearTimeout(hudTimer); hudTimer = setTimeout(hideHud, 600); // (was 160 ms: a slow frame / GC pause on a busy ult hid the whole HUD for a frame = flicker)
}

// Canvas2D backend for the main game canvas: 'auto' (default) | 'gpu' | 'cpu'. Firefox's GPU Canvas2D (DrawTargetWebgl)
// is slow with the thousands of small path fills / strokes the art draws per frame (37 ms vs ~8.5 ms in Chromium on
// the same PC); willReadFrequently makes Firefox keep that canvas on its software Skia backend instead. Same art, same
// draw calls; the context type is fixed per canvas, so a change applies after a reload. ?c2d=cpu|gpu overrides.
const CKEY = 'rb.c2d';
export const isFirefox = typeof navigator !== 'undefined' && /Firefox\//.test(navigator.userAgent || '');
export const canvasPref = {
  mode: (() => { try { const q = typeof location !== 'undefined' && new URLSearchParams(location.search).get('c2d'); if (q === 'cpu' || q === 'gpu' || q === 'auto') return q; return localStorage.getItem(CKEY) || 'auto'; } catch { return 'auto'; } })(),
  set(m) { this.mode = m; try { localStorage.setItem(CKEY, m); } catch {} },
  /** true when the main canvas should use the software backend */
  cpu() { return this.mode === 'cpu' || (this.mode === 'auto' && isFirefox); },
};
