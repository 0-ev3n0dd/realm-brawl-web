// The front-facing hero showcase models (2026-10-07): the approved v3 vector models (tools/heromodels/src), each one's 3 s
// idle loop (cloth, hair, glow, aura particles) pre-rendered into a WebP sprite sheet by tools/heromodels-build.mjs, with
// its own padded crop so nothing clips. Drawing the vectors live costs 40-160 ms a frame; a sheet costs two drawImage
// calls, so the loop runs at 60 fps on PC and phone. The few fast layers (Varek's speed lines, Kage's thrown kunai) are
// drawn live on top instead (FAST), so frame blending never ghosts them.
// Loading: sheets are fetched in the background (preloadAll: the hero on screen first, then the rest) and decoded off
// the main thread (createImageBitmap; pages of <= 8.4 MP, the size Chrome still keeps in its GPU image cache); PC keeps the bytes of all ten + the decoded sheets of the last KEEP.pc heroes,
// a phone keeps KEEP.m decoded and leaves the rest to the service worker's cache. Until a hero's sheet is decoded its
// frame-0 still (<id>-s.webp, ~100 KB, all ten loaded up front) fades in, then the loop cross-fades over it: the
// classic top-down body is never shown in a showcase. Also: the card portraits, the signature flourish (a weapon glow
// burst on select / swap) and fitScale, which sizes the models so their body + weapons never cover the UI text.
import { MODELS, MODEL_OF, MODEL_VERSION, MODEL_LOOP, MODEL_W, FAST } from './heromodeldata.js';

export const MODEL_BASE = '/realm-brawl-web/assets/models/';
export const FLOURISH_DUR = 1.15;
export const KEEP = { pc: 6, m: 3 }; // decoded sheets kept (a PC sheet is 40-65 MB of bitmap, a phone sheet ~15 MB)
const FLOOR = 1280 * 0.86, CX = MODEL_W / 2, FADE = 46;
const sheets = new Map(), stills = new Map(), portraits = new Map();
const hasImg = () => typeof Image !== 'undefined';
const canDecode = () => typeof createImageBitmap === 'function' && typeof fetch === 'function';
let clock = 0; // (LRU)

/** the model id of a class (warrior -> brakka...), null for an unknown class */
export const modelOf = (cls) => MODEL_OF[cls] || null;
export const modelUrl = (id, kind, page = 0) => `${MODEL_BASE}${id}-${kind}-${page}.webp?v=${MODEL_VERSION}`;
const pagesOf = (id, kind) => (MODELS[id] && MODELS[id][kind] && MODELS[id][kind].pages) || 1;
/** which sheet: 'm' (phone / low quality) or 'pc' */
export const sheetKind = (mobile, low = false) => (mobile || low ? 'm' : 'pc');

// ------------------------------------------------------------------ loading
function imgEntry(map, key, url, onload) {
  let e = map.get(key);
  if (e) return e;
  e = { img: null, ready: false, failed: false }; map.set(key, e);
  if (hasImg()) { const img = new Image(); img.decoding = 'async'; img.onload = () => { e.ready = true; if (onload) try { onload(); } catch { /* cosmetic */ } }; img.onerror = () => { e.failed = true; }; img.src = url; e.img = img; }
  return e;
}
const stillOf = (id) => imgEntry(stills, id, `${MODEL_BASE}${id}-s.webp?v=${MODEL_VERSION}`);
function sheet(id, kind) { const k = id + '-' + kind; let e = sheets.get(k); if (!e) { e = { id, kind, bmps: [], blobs: [], ready: false, loading: null, failed: false, used: 0 }; sheets.set(k, e); } return e; }
function evict(kind) {
  const live = [...sheets.values()].filter((e) => e.kind === kind && e.ready).sort((a, b) => a.used - b.used);
  while (live.length > (KEEP[kind] || 3)) { const e = live.shift(); for (const b of e.bmps) try { if (b && b.close) b.close(); } catch { /* */ } e.bmps = []; e.ready = false; }
}
async function bytes(e, pg) { if (e.blobs[pg]) return e.blobs[pg]; const r = await fetch(modelUrl(e.id, e.kind, pg)); if (!r.ok) throw new Error('model ' + r.status); const b = await r.blob(); if (e.kind === 'pc') e.blobs[pg] = b; return b; }
const allBytes = (e) => Promise.all(Array.from({ length: pagesOf(e.id, e.kind) }, (_, pg) => bytes(e, pg)));
/** decode a hero's sheet (off the main thread); cheap to call every frame */
function ensure(id, kind) {
  const e = sheet(id, kind); e.used = ++clock;
  if (e.ready || e.loading || e.failed) return e;
  if (canDecode()) {
    e.loading = allBytes(e).then((bs) => Promise.all(bs.map((b) => createImageBitmap(b)))).then((bmps) => { e.bmps = bmps; e.ready = true; evict(kind); })
      .catch(() => { e.failed = true; }).finally(() => { e.loading = null; });
  } else if (hasImg()) { // (no createImageBitmap: a plain image)
    e.loading = Promise.all(Array.from({ length: pagesOf(id, kind) }, (_, pg) => new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = modelUrl(id, kind, pg); })))
      .then((imgs) => { e.bmps = imgs; e.ready = true; evict(kind); }).catch(() => { e.failed = true; }).finally(() => { e.loading = null; });
  }
  return e;
}
/** start decoding a hero's sheet (e.g. on hover); returns its entry */
export function preloadModel(cls, kind = 'pc') { const id = modelOf(cls); return id ? ensure(id, kind) : null; }
export const modelReady = (cls, kind = 'pc') => { const e = sheets.get(modelOf(cls) + '-' + kind); return !!(e && e.ready); };
export const stillReady = (cls) => { const id = modelOf(cls); return !!(id && stills.has(id) && stills.get(id).ready); };

let queue = null;
/**
 * Background preload (idempotent): all ten stills + portraits at once, then the sheet of `first`, then the others one
 * at a time - PC decodes up to KEEP.pc and keeps the bytes of the rest; a phone only fetches the rest into the service
 * worker cache (decoded when shown).
 */
export function preloadAll(kind = 'pc', first = null) {
  for (const id of Object.keys(MODELS)) stillOf(id);
  preloadPortraits();
  if (first) preloadModel(first, kind);
  if (queue || !canDecode()) return queue;
  const ids = Object.keys(MODELS), f = modelOf(first); if (f) ids.sort((a, b) => (b === f) - (a === f));
  queue = (async () => {
    let decoded = 0;
    for (const id of ids) {
      try {
        const e = sheet(id, kind);
        if (decoded < (KEEP[kind] || 3) - (kind === 'm' ? 1 : 0)) { if (!e.ready) { ensure(id, kind); e.used = 0; } await e.loading; decoded++; }
        else if (kind === 'pc') await allBytes(e); else for (let pg = 0; pg < pagesOf(id, kind); pg++) { const r = await fetch(modelUrl(id, kind, pg)); await r.arrayBuffer(); }
      } catch { /* offline: shown later from the network / still */ }
    }
  })();
  return queue;
}

// ------------------------------------------------------------------ geometry
/** frame pair + blend for time t (s): the loop is MODEL_LOOP s long */
export function frameAt(t, frames) {
  const u = ((((t % MODEL_LOOP) + MODEL_LOOP) % MODEL_LOOP) / MODEL_LOOP) * frames, i = Math.floor(u) % frames;
  return { i, j: (i + 1) % frames, f: u - Math.floor(u) };
}
/** a hero's body + weapons box relative to its feet, in model units: [left, top, right, bottom] (feet = 0, 0) */
export function bodyBox(cls) {
  const M = MODELS[modelOf(cls)]; if (!M) return null; const [x, y, w, h] = M.crop;
  return [x + M.bb[0] * w - CX, y + M.bb[1] * h - FLOOR, x + M.bb[2] * w - CX, y + M.bb[3] * h - FLOOR];
}
const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
/**
 * The largest scale (screen px per model unit) at which every listed hero, feet at (x, y), keeps its body + weapons
 * inside `bounds` [l, t, r, b] and off every `avoid` rect [l, t, r, b] (the name / title text, buttons). One scale for
 * the whole list, so heroes keep their relative size. Glows and sparks may still pass behind text.
 */
const fitCache = new Map();
export function fitScale(list, { x, y, bounds, avoid = [], max = 4 }) {
  const key = JSON.stringify([list, x, y, bounds, avoid, max]); if (fitCache.has(key)) return fitCache.get(key);
  let k = max;
  for (const cls of list) {
    const b = bodyBox(cls); if (!b) continue;
    const rect = (s) => [x + b[0] * s, y + b[1] * s, x + b[2] * s, y + b[3] * s];
    const rs = avoid.filter((r) => r && !hit(rect(0.02), r)); // (a rect the feet already stand in can't be avoided)
    const ok = (s) => { const r = rect(s); return r[0] >= bounds[0] && r[1] >= bounds[1] && r[2] <= bounds[2] && r[3] <= bounds[3] && !rs.some((q) => hit(r, q)); };
    let lo = 0, hi = k; if (ok(hi)) continue;
    for (let n = 0; n < 24; n++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
    k = lo;
  }
  if (fitCache.size > 64) fitCache.clear();
  fitCache.set(key, k); return k;
}
/** text rects of an element's children (Range boxes, relative to `ref`), for fitScale's avoid list */
export function textRects(el, ref, pad = 4) {
  if (!el || !ref || typeof document === 'undefined') return [];
  const o = ref.getBoundingClientRect(), out = [];
  for (const c of el.children.length ? el.children : [el]) {
    const r = document.createRange(); r.selectNodeContents(c); const q = r.getBoundingClientRect();
    if (q.width > 0 && q.height > 0) out.push([q.left - o.left - pad, q.top - o.top - pad, q.right - o.left + pad, q.bottom - o.top + pad].map((v) => Math.round(v)));
  }
  return out;
}
export const elRect = (el, ref, pad = 4) => { if (!el || !ref || !el.offsetParent) return null; const a = el.getBoundingClientRect(), o = ref.getBoundingClientRect(); return [a.left - o.left - pad, a.top - o.top - pad, a.right - o.left + pad, a.bottom - o.top + pad].map((v) => Math.round(v)); };

// ------------------------------------------------------------------ drawing
const hex = (c) => { const n = parseInt(String(c).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (c, a) => { const [r, gg, b] = hex(c); return `rgba(${r},${gg},${b},${Math.max(0, Math.min(1, a))})`; };
const rnd = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const ease = (v) => Math.max(0, Math.min(1, v));
/** cell rect on screen for scale k, feet at (x, y) */
function cellRect(M, x, y, k) { const [cx, cy, cw, ch] = M.crop; return [x + (cx - CX) * k, y + (cy - FLOOR) * k, cw * k, ch * k]; }

/** the live fast layers (model coords; g already transformed into model space). front: drawn over the sheet */
function fastLayer(g, id, M, t, front) {
  const ph = t / 3, [c0, c1, cw, ch] = M.crop, top = c1 + M.bb[1] * ch;
  const edge = (x, y) => ease((x - c0) / FADE) * ease((c0 + cw - x) / FADE) * ease((y - top + 40) / 80) * ease((c1 + ch - y) / FADE);
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  const line = (a, b, col, w, al) => { if (al <= 0.003) return; g.strokeStyle = rgba(col, al * 0.3); g.lineWidth = w * 4; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.strokeStyle = rgba(col, al); g.lineWidth = w; g.stroke(); };
  if (id === 'varek' && !front) for (let i = 0; i < 16; i++) { const q = (ph * 2 + rnd(i + 3)) % 1, x = 80 + rnd(i + 4) * 800, y = -100 + q * 1480; line([x, y - 160], [x, y], i % 2 ? '#7fd4ff' : '#3a8ee8', 2.5, 0.45 * Math.sin(Math.PI * q) * edge(x, y - 80)); }
  if (id === 'varek' && front) { const B = [870, 120], T = [110, 1066], L = Math.hypot(T[0] - B[0], T[1] - B[1]), d = [(T[0] - B[0]) / L, (T[1] - B[1]) / L], n = [-d[1], d[0]], at = (s, k) => [B[0] + d[0] * s + n[0] * k, B[1] + d[1] * s + n[1] * k];
    for (let i = 0; i < 6; i++) { const q = (ph * 3 + i / 6) % 1; line(at(200 + q * 700, 20 + i * 10), at(40 + q * 700, 20 + i * 10), '#7fd4ff', 2, 0.5 * Math.sin(Math.PI * q)); } }
  if (id === 'kage' && !front) for (let i = 0; i < 4; i++) {
    const q = (ph * 2 + i / 4) % 1, y = 180 + i * 150, x = -150 + q * 1260, a = Math.sin(Math.PI * q) * edge(x, y); if (a <= 0.01) continue;
    line([x - 160, y + 20], [x, y], '#ff3b6b', 3, a * 0.6);
    g.save(); g.globalCompositeOperation = 'source-over'; g.globalAlpha *= a; g.translate(x, y); g.rotate(-0.12);
    g.fillStyle = '#1a1a22'; g.fillRect(-40, -6, 44, 12); g.strokeStyle = '#cfd6e2'; g.lineWidth = 3; g.beginPath(); g.arc(-48, 0, 9, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#cfd6e2'; g.strokeStyle = '#2b2433'; g.beginPath(); g.moveTo(4, -10); g.lineTo(38, -12); g.lineTo(70, 0); g.lineTo(38, 12); g.lineTo(4, 10); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#ff3b6b'; g.lineWidth = 2; g.beginPath(); g.moveTo(8, 8); g.lineTo(66, 1); g.stroke(); g.restore();
  }
  g.restore();
}

/**
 * Draw a hero's model with its feet at (x, y), k = screen px per model unit. o: { t, kind, flourish (s since it started,
 * or -1), alpha }. Returns false while the sheet is not decoded yet.
 */
export function drawModel(g, cls, o) {
  const id = modelOf(cls), kind = o.kind || 'pc'; if (!id) return false;
  const e = ensure(id, kind); if (!e.ready) return false;
  const M = MODELS[id], m = M[kind], { i, j, f } = frameAt(o.t || 0, m.frames);
  const fa = o.flourish >= 0 && o.flourish < FLOURISH_DUR ? o.flourish / FLOURISH_DUR : -1;
  const k = o.k * (fa >= 0 ? 1 + 0.045 * Math.sin(Math.PI * Math.min(1, fa * 2.2)) : 1);
  const per = m.per || m.frames, [x0, y0, w, h] = cellRect(M, o.x, o.y, k), im = (n) => e.bmps[Math.floor(n / per)] || e.bmps[0], sx = (n) => ((n % per) % m.cols) * m.cw, sy = (n) => Math.floor((n % per) / m.cols) * m.ch;
  const live = FAST.includes(id), toModel = () => { g.translate(o.x - CX * k, o.y - FLOOR * k); g.scale(k, k); };
  g.save();
  if (o.alpha != null) g.globalAlpha = o.alpha;
  const a0 = g.globalAlpha;
  if (live) { g.save(); toModel(); fastLayer(g, id, M, o.t || 0, false); g.restore(); }
  g.drawImage(im(i), sx(i), sy(i), m.cw, m.ch, x0, y0, w, h);
  if (f > 0.02) { g.globalAlpha = a0 * f; g.drawImage(im(j), sx(j), sy(j), m.cw, m.ch, x0, y0, w, h); g.globalAlpha = a0; }
  if (live) { g.save(); toModel(); fastLayer(g, id, M, o.t || 0, true); g.restore(); }
  if (fa >= 0) { // the flourish: the whole model flares (additive redraw) + a burst at the weapon
    const q = 1 - fa; g.globalCompositeOperation = 'lighter';
    g.globalAlpha = a0 * 0.55 * q * q; g.drawImage(im(i), sx(i), sy(i), m.cw, m.ch, x0, y0, w, h);
    drawBurst(g, x0 + M.fx[0] * w, y0 + M.fx[1] * h, k * 1100, M.glow, fa, a0);
  }
  g.restore();
  return true;
}
/** the frame-0 still (shown while the sheet decodes) */
export function drawStill(g, cls, o) {
  const id = modelOf(cls); if (!id) return false;
  const s = stillOf(id); if (!s.ready || !s.img) return false;
  const [x0, y0, w, h] = cellRect(MODELS[id], o.x, o.y, o.k);
  g.save(); if (o.alpha != null) g.globalAlpha = o.alpha; g.drawImage(s.img, x0, y0, w, h); g.restore();
  return true;
}
/** weapon glow burst at (x, y); fa = 0..1 through the flourish; H = the model's size in px */
export function drawBurst(g, x, y, H, col, fa, a0 = 1) {
  const s = H / 600, k = 1 - fa, e = 1 - Math.pow(1 - fa, 3);
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a0;
  const r = (40 + 220 * e) * s, gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba('#ffffff', 0.9 * k)); gr.addColorStop(0.25, rgba(col, 0.75 * k)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  for (let n = 0; n < 2; n++) { const q = Math.min(1, e * (1.25 - n * 0.3)); g.strokeStyle = rgba(n ? '#ffffff' : col, (1 - q) * 0.9); g.lineWidth = (7 - n * 3) * s * (1 - q) + 1; g.beginPath(); g.arc(x, y, (20 + (170 + n * 90) * q) * s, 0, Math.PI * 2); g.stroke(); }
  g.lineCap = 'round';
  for (let n = 0; n < 14; n++) { const a = n * 2.399 + 0.6, d0 = (18 + 150 * e * (0.7 + (n % 3) * 0.2)) * s, d1 = d0 + 26 * s * k; g.strokeStyle = rgba(n % 3 ? col : '#ffffff', k); g.lineWidth = 3 * s + 1; g.beginPath(); g.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0); g.lineTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1); g.stroke(); }
  if (fa < 0.35) { const q = fa / 0.35, L = 160 * s * (1 - q * 0.4); g.strokeStyle = rgba('#ffffff', 1 - q); g.lineWidth = 4 * s; g.beginPath(); g.moveTo(x - L, y); g.lineTo(x + L, y); g.moveTo(x, y - L); g.lineTo(x, y + L); g.stroke(); }
  g.restore();
}

/** a flourish clock per view: start() on select / swap, age() each frame (-1 = none) */
export class Flourish {
  constructor() { this.t0 = -1; this.cls = null; }
  start(cls, now) { this.cls = cls; this.t0 = now; }
  age(cls, now) { if (this.t0 < 0 || cls !== this.cls) return -1; const a = now - this.t0; if (a > FLOURISH_DUR) { this.t0 = -1; return -1; } return a; }
}

/**
 * One showcase spot (Heroes tab centre, Character tab, title screen): fades the hero in (still first if its sheet is
 * still decoding, then the loop cross-fades over it), holds the flourish until the loop is up. Never the classic body.
 */
export class ShowcaseView {
  constructor() { this.cls = null; this.fade = 0; this.anim = 0; this.lt = null; this.fl = new Flourish(); }
  flourish(cls, t) { this.fl.start(cls, t); }
  draw(g, cls, o) {
    const id = modelOf(cls), kind = o.kind || 'pc'; if (!id) return false;
    const dt = this.lt == null ? 0 : Math.max(0, Math.min(0.1, o.t - this.lt)); this.lt = o.t;
    const e = ensure(id, kind), st = stillOf(id);
    if (cls !== this.cls) { this.cls = cls; this.fade = e.ready ? 0.35 : 0; this.anim = e.ready ? 1 : 0; }
    if (e.ready || st.ready) this.fade = Math.min(1, this.fade + dt / 0.22);
    if (e.ready) this.anim = Math.min(1, this.anim + dt / 0.3);
    if (!e.ready && this.fl.cls === cls && this.fl.t0 >= 0) this.fl.t0 = o.t; // (the flourish waits for the loop)
    const a = o.alpha == null ? 1 : o.alpha;
    let drew = false;
    if (this.anim < 1 && st.ready) drew = drawStill(g, cls, { ...o, alpha: a * this.fade * Math.min(1, 2 * (1 - this.anim)) });
    if (e.ready) drew = drawModel(g, cls, { ...o, kind, alpha: a * this.fade * Math.min(1, 2 * this.anim), flourish: this.fl.age(cls, o.t) }) || drew;
    return drew;
  }
}

// ------------------------------------------------------------------ portraits
/** a hero portrait (square) into a card canvas; draws `fallback(cv)` first while the WebP loads, then redraws */
export function drawPortrait(cv, cls, fallback) {
  const id = modelOf(cls);
  const paint = () => {
    const e = portraits.get(id); if (!e || !e.ready) return false;
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    const r = Math.min(cv.width, cv.height) * 0.16; g.save(); g.beginPath();
    if (g.roundRect) g.roundRect(0, 0, cv.width, cv.height, r); else g.rect(0, 0, cv.width, cv.height);
    g.clip(); g.drawImage(e.img, 0, 0, cv.width, cv.height); g.restore(); return true;
  };
  if (!id || !cv) { if (fallback) fallback(cv); return false; }
  const e = imgEntry(portraits, id, `${MODEL_BASE}${id}-p.webp?v=${MODEL_VERSION}`, () => { cv.dataset.portrait = '1'; paint(); });
  if (e.ready) { cv.dataset.portrait = '1'; return paint(); }
  if (fallback) try { fallback(cv); } catch { /* cosmetic */ }
  return false;
}
/** warm the portrait cache (all ten are ~10 KB each) */
export function preloadPortraits() { for (const id of Object.keys(MODELS)) imgEntry(portraits, id, `${MODEL_BASE}${id}-p.webp?v=${MODEL_VERSION}`); }
