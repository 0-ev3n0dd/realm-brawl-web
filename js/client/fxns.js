// Ninja + Samurai VFX core (shared by fxninja.js and fxsamurai.js). Everything here is purely visual.
//  - Pre-rendered textures (offscreen canvases, built once and cached): brush kanji, hanko seals, manga SFX, banner titles,
//    ink crescents / strokes / ensō, petals, glitter, glow, starbursts, an eclipse disc, speed-line sheets, clone silhouettes,
//    Mark sigils, smoke, vignette and paper wash. No per-frame gradients or shadowBlur: frames only drawImage these.
//  - Perf rule (measured in software rendering): a ROTATED drawImage costs ~6-8x an axis-aligned one, so nothing big is drawn
//    rotated: petals / clones / ghosts use pre-rotated frame sets, kanji / SFX / bursts / ensō are axis-aligned (SFX tilt is
//    baked), and ink crescents / brush strokes are filled paths (cheap at any angle) instead of rotated textures.
//  - A fixed particle pool (no allocation while playing, hard cap) + a small capped list of timed "items" (crescents, strokes,
//    slash lines, kanji pops, clones, marks, bursts).
//  - Screen MOMENTS (ult / finale cinematics, 0.6-1.2 s): a grayscale or violet scene filter done with one blend-mode fill
//    ('saturation' / 'multiply'), giant kanji, seals, manga SFX, speed lines, the banner, a capped flash.
//  - Options: vfxPref.reduceFlash (no full-screen flashes, dimmer bursts, also caps the shared FX flash) and vfxPref.cine
//    (screen filters + giant kanji on / off). Stored in localStorage (rb.vfx.reduceFlash / rb.vfx.cine).
// Hooked from fx.js with three calls (nsHandle / nsUpdate / nsDraw*); other classes are untouched.
const TAU = Math.PI * 2;
export const rnd = (a, b) => a + Math.random() * (b - a);
const HAS_DOC = typeof document !== 'undefined' && typeof document.createElement === 'function';
export const FONT_GAME = "'Lilita One', 'Trebuchet MS', sans-serif";
const SERIF = "'Noto Serif CJK JP', 'Noto Serif JP', 'Yu Mincho', 'YuMincho', 'Hiragino Mincho ProN', 'MS Mincho', 'SimSun', serif";
const SANS = "'Noto Sans CJK JP', 'Noto Sans JP', 'Yu Gothic', 'YuGothic', 'Hiragino Sans', 'Meiryo', 'Microsoft YaHei', sans-serif";

// ------------------------------------------------------------------ options
const PREF = { rf: null, cine: null, skill: null };
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage off */ } };
export const vfxPref = {
  get reduceFlash() { if (PREF.rf === null) PREF.rf = lsGet('rb.vfx.reduceFlash') === '1'; return PREF.rf; },
  setReduceFlash(v) { PREF.rf = !!v; lsSet('rb.vfx.reduceFlash', v ? '1' : '0'); },
  get cine() { if (PREF.cine === null) PREF.cine = lsGet('rb.vfx.cine') !== '0'; return PREF.cine; },
  setCine(v) { PREF.cine = !!v; lsSet('rb.vfx.cine', v ? '1' : '0'); },
  /** Skill effects strength 0..1 (Options > Visual effects): opacity of every skill / chain piece, and how many may be alive at once; 0 = off. */
  get skill() { if (PREF.skill === null) { const n = parseFloat(lsGet('rb.vfx.skill')); PREF.skill = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1; } return PREF.skill; },
  setSkill(v) { PREF.skill = Math.max(0, Math.min(1, +v || 0)); lsSet('rb.vfx.skill', String(PREF.skill)); },
};

// ------------------------------------------------------------------ seeded rng + canvas
function R(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
const TEX = new Map(), TT = [];
let fontsOk = false;
function fontsReady() {
  if (fontsOk || !HAS_DOC) return fontsOk;
  try { fontsOk = !document.fonts || document.fonts.check("40px 'Lilita One'"); } catch { fontsOk = true; }
  return fontsOk;
}
/** Cached texture: built once by `build(canvas, ctx)`. `font`: depends on the web font (not cached until it has loaded). */
function tex(key, w, h, build, font = false) {
  let c = TEX.get(key);
  if (c) return c;
  if (!HAS_DOC) return null;
  c = mk(w, h); const g = c.getContext('2d'); if (!g) return null;
  build(c, g);
  if (!font || fontsReady()) TEX.set(key, c);
  return c;
}
/** n pre-rotated copies of a small sprite (so particles never draw rotated); attached as canvas.fr. */
function rotFrames(src, n) {
  const D = Math.ceil(Math.hypot(src.width, src.height)), out = [];
  for (let i = 0; i < n; i++) { const c = mk(D, D), g = c.getContext('2d'); g.translate(D / 2, D / 2); g.rotate(i * TAU / n); g.drawImage(src, -src.width / 2, -src.height / 2); out.push(c); }
  return out;
}
const withFrames = (c, n) => { if (c && !c.fr) c.fr = rotFrames(c, n); return c; };
const frameOf = (fr, ang) => fr[((Math.round(ang / TAU * fr.length) % fr.length) + fr.length) % fr.length];
/** `src` resampled once to exactly w×h (cached per source, a few sizes): a settled screen layer then costs one unscaled 1:1 blit. */
const FIT = new WeakMap();
function fitTex(src, w, h, A = 1) {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h)); let m = FIT.get(src); if (!m) { m = new Map(); FIT.set(src, m); }
  const key = w + 'x' + h + 'a' + A; let c = m.get(key);
  if (!c) { if (m.size > 3) m.clear(); c = mk(w, h); const g = c.getContext('2d'); if (!g) return src; g.globalAlpha = A; g.drawImage(src, 0, 0, w, h); m.set(key, c); }
  return c;
}
/** Draw `tx` into the box (x,y,w,h); once `settled`, as a cached exact-size copy at whole pixels (no per-frame resampling). */
function blitBox(ctx, tx, x, y, w, h, settled, A = 1) {
  if (settled) { const f = fitTex(tx, w, h, A); const ga = ctx.globalAlpha; if (ga > 0.95) ctx.globalAlpha = 1; ctx.drawImage(f, Math.round(x), Math.round(y)); ctx.globalAlpha = ga; }
  else { ctx.globalAlpha *= A; ctx.drawImage(tx, x, y, w, h); }
}
export function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

// ------------------------------------------------------------------ texture builders
/** Brush kanji: jittered dry-brush passes, a solid body, splatter and a few dry streaks. */
export function kanjiTex(ch, o = {}) {
  const S = o.size || 300, P = Math.round(S * 1.5), key = 'kj|' + ch + '|' + (o.ink || '') + '|' + (o.edge || '') + '|' + (o.glow || '') + '|' + S;
  return tex(key, P, P, (c, g) => {
    const rn = R(ch.charCodeAt(0) % 997 + 3), cx = P / 2, cy = P / 2;
    g.translate(cx, cy); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${S}px ${SERIF}`;
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = S * 0.12; g.fillStyle = o.glow; g.fillText(ch, 0, 0); g.shadowBlur = 0; } // baked once: never per frame
    if (o.edge) { g.lineJoin = 'round'; g.lineWidth = S * 0.06; g.strokeStyle = o.edge; g.strokeText(ch, 0, 0); }
    const ink = o.ink || '#0c070e';
    g.fillStyle = ink;
    for (let i = 0; i < 6; i++) { g.globalAlpha = 0.2; g.fillText(ch, (rn() - 0.5) * S * 0.05, (rn() - 0.5) * S * 0.05); }
    g.globalAlpha = 1; g.fillText(ch, 0, 0);
    for (let i = 0; i < 26; i++) { const an = rn() * TAU, d = S * (0.42 + rn() * 0.36), r = 1 + rn() * S * 0.024; g.beginPath(); g.arc(Math.cos(an) * d, Math.sin(an) * d, r, 0, TAU); g.fill(); }
    g.globalAlpha = 0.5; g.lineCap = 'round'; g.strokeStyle = ink; // dry-brush streaks off the strokes
    for (let i = 0; i < 5; i++) { const an = rn() * TAU, d0 = S * 0.3, d1 = S * (0.5 + rn() * 0.2); g.lineWidth = 1 + rn() * 3; g.beginPath(); g.moveTo(Math.cos(an) * d0, Math.sin(an) * d0); g.lineTo(Math.cos(an + 0.08) * d1, Math.sin(an + 0.08) * d1); g.stroke(); }
  });
}
/** Hanko seal: a red (or violet) square with a white character and a rough edge. */
export function hankoTex(ch, col = '#c8142c') {
  return tex('hk|' + ch + col, 132, 132, (c, g) => {
    const rn = R(ch.charCodeAt(0)); g.fillStyle = col;
    g.beginPath(); g.moveTo(10, 12); g.lineTo(122, 8); g.lineTo(124, 120); g.lineTo(8, 124); g.closePath(); g.fill();
    g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(8 + rn() * 116, rn() < 0.5 ? 8 + rn() * 6 : 118 + rn() * 6, 1 + rn() * 2.5, 0, TAU); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 4; g.strokeRect(20, 20, 92, 92);
    g.font = `900 78px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(ch, 66, 70);
  });
}
/** Manga SFX (katakana): skewed, thick dark stroke + white outline + vertical gradient fill (+ a baked glow). */
const SFX_H = 1.9;
export function sfxTex(txt, fill = ['#ffffff', '#ffb0f0'], stroke = '#140620', glow = 'rgba(255,60,200,.85)', size = 150) {
  const key = 'sfx|' + txt + fill.join() + stroke + glow + size;
  const w = Math.round(size * (txt.length * 1.05 + 0.9)), h = Math.round(size * SFX_H);
  return tex(key, w, h, (c, g) => {
    g.translate(w / 2, h / 2); g.rotate(-0.09); g.transform(1, 0, -0.22, 1, 0, 0); // (the tilt is baked: drawn axis-aligned) g.font = `900 ${size}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    if (glow) { g.shadowColor = glow; g.shadowBlur = size * 0.35; g.lineWidth = size * 0.3; g.strokeStyle = stroke; g.strokeText(txt, 0, 0); g.shadowBlur = 0; }
    g.lineWidth = size * 0.36; g.strokeStyle = '#ffffff'; g.strokeText(txt, 0, 0);
    g.lineWidth = size * 0.22; g.strokeStyle = stroke; g.strokeText(txt, 0, 0);
    const gr = g.createLinearGradient(0, -size / 2, 0, size / 2); fill.forEach((cc, i) => gr.addColorStop(i / Math.max(1, fill.length - 1), cc)); g.fillStyle = gr; g.fillText(txt, 0, 0);
  });
}
/** Banner: "★ TITLE" in a gold gradient with a baked glow + a white subtitle (the mockups' banner). */
export function titleTex(title, sub, pal = 'gold') {
  const P = { gold: [['#fff7c2', '#ffd23f', '#ff9a1f'], '#3a1606', 'rgba(255,170,40,.9)'], violet: [['#ffffff', '#ffb6f2', '#c255ff'], '#24063a', 'rgba(220,80,255,.9)'], blood: [['#ffffff', '#ffc2d2', '#ff3b5c'], '#2a0610', 'rgba(255,60,90,.9)'] }[pal] || [['#fff', '#fff', '#fff'], '#000', null];
  const key = 'tt|' + title + '|' + sub + '|' + pal, W = 1100, H = 150;
  if (!TEX.has(key)) { TT.push(key); if (TT.length > 24) TEX.delete(TT.shift()); } // (dynamic subtitles: keep the last 24)
  return tex(key, W, H, (c, g) => {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    let fs = 66; g.font = `${fs}px ${FONT_GAME}`; while (g.measureText(title).width > W - 60 && fs > 30) { fs -= 2; g.font = `${fs}px ${FONT_GAME}`; }
    if (P[2]) { g.shadowColor = P[2]; g.shadowBlur = fs * 0.5; } g.lineWidth = fs * 0.2; g.strokeStyle = P[1]; g.strokeText(title, W / 2, 52); g.shadowBlur = 0;
    const gr = g.createLinearGradient(0, 52 - fs / 2, 0, 52 + fs / 2); P[0].forEach((cc, i) => gr.addColorStop(i / (P[0].length - 1), cc)); g.fillStyle = gr; g.fillText(title, W / 2, 52);
    if (sub) { let ss = 26; g.font = `${ss}px ${FONT_GAME}`; while (g.measureText(sub).width > W - 40 && ss > 14) { ss -= 1; g.font = `${ss}px ${FONT_GAME}`; } g.lineWidth = 6; g.strokeStyle = P[1]; g.strokeText(sub, W / 2, 112); g.fillStyle = '#ffffff'; g.fillText(sub, W / 2, 112); }
  }, true);
}
export const CRES = { R: 190, span: 2.7 }; // ink crescent path geometry: radius 190 around the origin, arc centred on +x
export function petalTex(col) {
  return withFrames(tex('pt|' + col, 40, 40, (c, g) => {
    g.translate(20, 20); const s = 15;
    g.beginPath(); g.moveTo(0, s); g.bezierCurveTo(s * 0.9, s * 0.4, s * 0.7, -s * 0.7, s * 0.18, -s); g.lineTo(0, -s * 0.72); g.lineTo(-s * 0.18, -s); g.bezierCurveTo(-s * 0.7, -s * 0.7, -s * 0.9, s * 0.4, 0, s); g.closePath();
    const gr = g.createLinearGradient(0, s, 0, -s); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, col); gr.addColorStop(1, '#c8346e'); g.fillStyle = gr; g.fill();
    g.lineWidth = 1; g.strokeStyle = 'rgba(120,20,70,.45)'; g.stroke();
  }), 12);
}
export function glitTex(col) { // a soft glow + a 4-point star with a white core (draw additive)
  return tex('gl|' + col, 64, 64, (c, g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, hexA(col, 0.7)); gr.addColorStop(0.35, hexA(col, 0.22)); gr.addColorStop(1, hexA(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.translate(32, 32); g.fillStyle = col; for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(0, -30); g.lineTo(3.5, 0); g.lineTo(0, 30); g.lineTo(-3.5, 0); g.closePath(); g.fill(); g.rotate(Math.PI / 2); }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();
  });
}
export function glowTex(col) {
  return tex('gw|' + col, 128, 128, (c, g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, hexA(col, 0.85)); gr.addColorStop(0.3, hexA(col, 0.4)); gr.addColorStop(0.65, hexA(col, 0.1)); gr.addColorStop(1, hexA(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
}
/** White-hot starburst, drawn as a compact white→col core sprite plus thin spikes as path fills (the old 512² additive sprite was
 *  ~1 ms per burst in software rendering; this is ~0.35 ms). */
export function burstCoreTex(col) {
  return tex('bc|' + col, 128, 128, (c, g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,.85)'); gr.addColorStop(0.55, hexA(col, 0.35)); gr.addColorStop(1, hexA(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
}
const BGEO = new Map();
function burstGeo(seed) {
  let G = BGEO.get(seed); if (G) return G;
  const rn = R(seed); G = [];
  for (let i = 0; i < 22; i++) { const a = rn() * TAU, L = 130 + rn() * 120, w = (0.016 + rn() * 0.03) * 4; G.push([Math.cos(a - w) * 10, Math.sin(a - w) * 10, Math.cos(a) * L, Math.sin(a) * L, Math.cos(a + w) * 10, Math.sin(a + w) * 10, i % 3 ? 0 : 1]); }
  BGEO.set(seed, G); return G;
}
function burstSpikes(ctx, seed, white) {
  ctx.beginPath(); for (const q of burstGeo(seed)) { if (q[6] !== white) continue; ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); ctx.lineTo(q[4], q[5]); ctx.closePath(); } ctx.fill();
}
/** The eclipse: a violet corona, a black disc with a thin bright rim, an offset crescent glint. */
export function eclipseTex() {
  return tex('eclipse', 512, 512, (c, g) => {
    const co = g.createRadialGradient(256, 256, 168, 256, 256, 256); co.addColorStop(0, 'rgba(140,30,220,.95)'); co.addColorStop(0.3, 'rgba(210,80,255,.5)'); co.addColorStop(1, 'rgba(255,160,255,0)'); g.fillStyle = co; g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#0b0412'; g.beginPath(); g.arc(256, 256, 176, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,220,255,.95)'; g.lineWidth = 5; g.beginPath(); g.arc(256, 256, 177, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 9; g.beginPath(); g.arc(256, 256, 180, Math.PI * 1.05, Math.PI * 1.55); g.stroke();
  });
}
/** The moment's static screen layer baked at the canvas size (vignette + optional speed lines): one 1:1 blit per frame, which is
 *  the cheapest possible full-screen draw (no scaling, no rotation). Cached per size / colour / variant; dropped on resize. */
let SCR_WH = '';
export function screenLayer(W, H, vig, speed, dark, seed, A = 1) {
  const wh = W + 'x' + H;
  if (wh !== SCR_WH) { for (const k of [...TEX.keys()]) if (k.startsWith('scr|')) TEX.delete(k); SCR_WH = wh; }
  return tex(`scr|${vig}|${speed ? (dark ? 'd' : 'l') + seed : 0}|${A}`, W, H, (c, g) => {
    const D = Math.hypot(W, H) / 2, gr = g.createRadialGradient(W / 2, H / 2, D * 0.45, W / 2, H / 2, D * 1.02);
    gr.addColorStop(0, hexA(vig, 0)); gr.addColorStop(1, hexA(vig, 0.8)); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    if (speed) {
      const rn = R(seed + (dark ? 0 : 50)); g.translate(W / 2, H / 2); g.fillStyle = dark ? 'rgba(18,4,28,.9)' : 'rgba(255,255,255,.85)';
      for (let i = 0; i < 230; i++) { const an = rn() * TAU, w = 0.0025 + rn() * 0.006, r0 = D * (0.36 + rn() * 0.36), r1 = D * 1.2; g.beginPath(); g.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); g.lineTo(Math.cos(an - w) * r1, Math.sin(an - w) * r1); g.lineTo(Math.cos(an + w) * r1, Math.sin(an + w) * r1); g.closePath(); g.fill(); }
    }
    if (A < 1) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in'; g.fillStyle = `rgba(0,0,0,${A})`; g.fillRect(0, 0, W, H); } // (layer alpha baked in: drawn at globalAlpha 1, the cheap path)
  });
}
/** Pre-bake the screen layers for the game canvas (call on the class's first event, idle time). */
export function warmScreen(vig, speed, dark = true, A = speed ? 0.85 : 0.9) {
  if (!HAS_DOC) return; let c = null;
  for (const k of document.querySelectorAll('canvas')) if (!c || k.width * k.height > c.width * c.height) c = k;
  if (!c) return; for (const sd of speed ? [1, 2] : [0]) screenLayer(c.width, c.height, vig, speed, dark, sd || 1, A);
}
export function washTex() { // the white paper burst behind the ink
  return tex('wash', 256, 256, (c, g) => { const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128); gr.addColorStop(0, 'rgba(255,250,246,1)'); gr.addColorStop(0.5, 'rgba(240,232,236,.6)'); gr.addColorStop(1, 'rgba(240,232,236,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); });
}
export function smokeTex(col = '#3c1460') {
  return tex('sm|' + col, 128, 128, (c, g) => {
    const rn = R(7);
    for (let i = 0; i < 7; i++) { const x = 64 + (rn() - 0.5) * 40, y = 64 + (rn() - 0.5) * 40, r = 26 + rn() * 22; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, hexA(col, 0.5)); gr.addColorStop(1, hexA(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  });
}
/** Shadow clone silhouette (top-down ninja: hood, scarf tails, twin daggers), facing +x. pale = additive afterimage. */
export function cloneTex(pale = false) {
  return withFrames(tex('cl|' + pale, 128, 128, (c, g) => {
    g.translate(64, 64); g.lineJoin = 'round'; g.lineCap = 'round';
    const body = pale ? '#e6c8ff' : '#1a0c2c', rim = pale ? '#ffffff' : '#ff6ad8';
    const fig = () => {
      g.beginPath(); g.moveTo(-30, -10); g.quadraticCurveTo(-44, -2, -50, 14); g.quadraticCurveTo(-38, 4, -26, 4); g.closePath(); // scarf tail
      g.moveTo(-30, 8); g.quadraticCurveTo(-46, 22, -48, 36); g.quadraticCurveTo(-34, 20, -22, 16); g.closePath();
      g.moveTo(16, -4); g.ellipse(-2, 0, 22, 26, 0, 0, TAU); // shoulders / body
      g.moveTo(26, 0); g.arc(12, 0, 14, 0, TAU); // head
    };
    g.strokeStyle = rim; g.lineWidth = 6; fig(); g.stroke(); g.fillStyle = body; fig(); g.fill();
    g.strokeStyle = pale ? '#ffffff' : '#f0e6ff'; g.lineWidth = 4; g.beginPath(); g.moveTo(10, 20); g.lineTo(44, 30); g.moveTo(10, -20); g.lineTo(44, -30); g.stroke(); // daggers
    if (!pale) { g.fillStyle = '#ff5fb0'; g.fillRect(18, -6, 5, 3); g.fillRect(18, 3, 5, 3); } // eyes
  }), 16);
}
/** Samurai afterimage: a grey hakama silhouette with a drawn katana (normal blend), facing +x. */
export function samGhostTex() {
  return withFrames(tex('sg', 128, 128, (c, g) => {
    g.translate(64, 64); g.fillStyle = '#2a2630'; g.strokeStyle = '#f2eef6'; g.lineWidth = 4;
    g.beginPath(); g.ellipse(-4, 0, 26, 28, 0, 0, TAU); g.moveTo(22, 0); g.arc(10, 0, 13, 0, TAU); g.fill(); g.stroke();
    g.lineCap = 'round'; g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); g.moveTo(14, 18); g.quadraticCurveTo(40, 22, 60, 12); g.stroke();
    g.fillStyle = '#ff3b5c'; g.fillRect(-26, -4, 6, 8); // the sash knot
  }), 16);
}
/** The Ninja's Mark: a diamond brand with 印. */
export function markTex(col = '#ff5ad2') {
  return tex('mk|' + col, 112, 112, (c, g) => {
    g.translate(56, 56); const s = 34; g.lineWidth = 4; g.strokeStyle = col; g.fillStyle = 'rgba(20,0,30,.88)';
    g.beginPath(); g.moveTo(0, -s); g.lineTo(s, 0); g.lineTo(0, s); g.lineTo(-s, 0); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0, -s * 1.5); g.lineTo(0, -s * 1.12); g.moveTo(0, s * 1.5); g.lineTo(0, s * 1.12); g.moveTo(-s * 1.5, 0); g.lineTo(-s * 1.12, 0); g.moveTo(s * 1.5, 0); g.lineTo(s * 1.12, 0); g.stroke();
    g.font = `900 ${s}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText('印', 0, 2);
  });
}
/** Pre-build the textures a class needs so the first ult never hitches (called on idle after the first event of that class). */
/** Build textures in idle time, one per idle slice (no long hitch). */
export function warm(list) {
  if (!HAS_DOC) return; const q = list.slice(), ric = typeof requestIdleCallback === 'function' ? requestIdleCallback : (f) => setTimeout(() => f({ timeRemaining: () => 8 }), 16);
  const go = (dl) => { while (q.length && dl.timeRemaining() > 2) { const f = q.shift(); try { f(); } catch { /* ignore */ } } if (q.length) ric(go); };
  ric(go);
}

// ------------------------------------------------------------------ per-FX state, particle pool, items
const CAP = 720, ITEM_CAP = 140;
export function S(fx) {
  let s = fx.ns;
  if (!s) {
    s = fx.ns = { parts: [], n: 0, items: [], moment: null, crits: [], t: 0 };
    for (let i = 0; i < CAP; i++) s.parts.push({ k: 0, tex: null, col: '', x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 1, rot: 0, vr: 0, s: 1, s1: 1, t: 0, life: 1, a: 1, add: false, sway: 0, seed: 0, screen: false });
  }
  return s;
}
const lite = (fx) => fx.partMul !== undefined && fx.partMul < 1;
/** Adaptive quality: when frames run long while our effects are on screen, particles thin out and the costliest screen layers
 *  (paper wash, screen petals) drop; it recovers after ~2 s of smooth frames. Never affects gameplay. */
export const QUAL = { q: 1, ema: 16.7, good: 0 };
const plain = () => QUAL.q < 0.8; // plain: additive ('lighter') draws switch to plain source-over (additive costs ~2x in software rendering)
export const N = (fx, n) => Math.max(1, Math.round(n * (fx.partMul ?? 1)));
/** Spawn a pooled particle. k: 0 sprite (tex), 1 spark streak (col), 2 ink dot (col). Returns null when the pool is full. */
export function part(fx, o) {
  const s = S(fx);
  if (s.n >= CAP || (QUAL.q < 1 && Math.random() > QUAL.q)) return null;
  const p = s.parts[s.n++];
  p.k = o.k || 0; p.tex = o.tex || null; p.col = o.col || '#fff'; p.x = o.x; p.y = o.y; p.vx = o.vx || 0; p.vy = o.vy || 0; p.g = o.g || 0; p.drag = o.drag ?? 0.92;
  p.rot = o.rot || 0; p.vr = o.vr || 0; p.s = o.s || 10; p.s1 = o.s1 ?? 1; p.t = 0; p.life = o.life || 0.6; p.a = o.a ?? 1; p.add = !!o.add; p.sway = o.sway || 0; p.seed = Math.random() * 9; p.screen = !!o.screen;
  return p;
}
export function item(fx, o) { const s = S(fx); if (s.items.length >= ITEM_CAP) s.items.shift(); o.t = 0; s.items.push(o); return o; }

// ---- spawn helpers (world space)
const PETALS = ['#ff9cc6', '#ffc2e0', '#ff6fa8', '#ffe4f0'];
export function petals(fx, x, y, n, spread = 40, sp = 180, o = {}) {
  for (let i = 0; i < N(fx, n); i++) { const a = rnd(0, TAU), v = rnd(sp * 0.3, sp); part(fx, { tex: petalTex(PETALS[i % 4]), x: x + rnd(-spread, spread), y: y + rnd(-spread, spread) * 0.6, vx: Math.cos(a) * v + (o.vx || 0), vy: Math.sin(a) * v - rnd(10, 70), g: o.g ?? 40, drag: 0.94, rot: rnd(0, TAU), vr: rnd(-8, 8), s: rnd(8, 15) * (o.size || 1), life: rnd(0.8, 1.5) * (o.life || 1), sway: 1 }); }
}
export function glitter(fx, x, y, n, spread, cols, o = {}) {
  if (lite(fx)) n *= 0.5;
  for (let i = 0; i < N(fx, n); i++) { const a = rnd(0, TAU), d = Math.sqrt(Math.random()) * spread; part(fx, { tex: glitTex(cols[i % cols.length]), x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, vx: Math.cos(a) * rnd(10, o.sp || 90), vy: Math.sin(a) * rnd(10, o.sp || 90) - (o.up ?? 30), drag: 0.93, rot: rnd(0, 1), vr: rnd(-3, 3), s: rnd(10, 26) * (o.size || 1), s1: 0.2, life: rnd(0.4, 0.9) * (o.life || 1), add: true }); }
}
export function sparks(fx, x, y, ang, n, col, speed = 520, spread = 1, o = {}) {
  for (let i = 0; i < N(fx, n); i++) { const a = ang + rnd(-spread, spread), v = rnd(speed * 0.4, speed); part(fx, { k: 1, col, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.86, s: rnd(1.5, 3.5) * (o.w || 1), life: rnd(0.16, 0.34), add: true }); }
}
export function splatter(fx, x, y, n, spread, col = '#0c070e', o = {}) {
  for (let i = 0; i < N(fx, n); i++) { const a = rnd(0, TAU), v = rnd(60, o.sp || 380); part(fx, { k: 2, col, x: x + rnd(-spread, spread) * 0.3, y: y + rnd(-spread, spread) * 0.2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.82, s: rnd(1.5, 5) * (o.size || 1), life: rnd(0.4, 0.8) }); }
}
export function smoke(fx, x, y, n, col = '#3c1460', size = 60, sp = 120, life = 0.8) {
  n = Math.ceil(n * 0.6); size = Math.min(size, 70) * 0.8;
  for (let i = 0; i < N(fx, n); i++) { const a = rnd(0, TAU), v = rnd(sp * 0.2, sp); part(fx, { tex: smokeTex(col), x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 10, drag: 0.9, rot: rnd(0, TAU), vr: rnd(-1, 1), s: rnd(size * 0.6, size), s1: 1.4, life: rnd(life * 0.6, life), a: 0.9 }); }
}
export function glow(fx, x, y, size, col, life = 0.3, a = 0.7) { if (!lite(fx)) part(fx, { tex: glowTex(col), x, y, s: size, s1: 1.3, life, a: a * (vfxPref.reduceFlash ? 0.55 : 1), add: true, drag: 1 }); }
export function burst(fx, x, y, size, col, life = 0.32, a = 0.9, seed = 1) { item(fx, { kind: 'burst', x, y, size, col, life, a: Math.min(0.9, a) * (vfxPref.reduceFlash ? 0.5 : 1), seed, rot: rnd(0, TAU) }); }

// ---- items (world space)
/** Ink crescent: center x,y, radius r, centre angle ang, dir ±1; red: a blazing hairline on the edge; w: brush weight. */
export function crescent(fx, x, y, r, ang, o = {}) { return item(fx, { kind: 'cres', x, y, r, ang, dir: o.dir || 1, v: o.v ?? Math.floor(Math.random() * 3), life: o.life || 0.42, speed: o.speed || 0.12, w: o.w || 1, red: o.red, hi: o.hi || '#ff4d6d', ink: o.ink ?? 1, follow: o.follow }); }
export function stroke(fx, x, y, ang, len, w, o = {}) { return item(fx, { kind: 'stroke', x, y, ang, len, w, v: o.v ?? Math.floor(Math.random() * 2), life: o.life || 0.45, speed: o.speed || 0.1, red: o.red, hi: o.hi || '#ff4d6d' }); }
/** Blazing slash line through (x,y): wide coloured glow, pink body, white-hot core; grows out from the centre. */
export function slashLine(fx, x, y, ang, len, o = {}) { return item(fx, { kind: 'line', x, y, ang, len, w: o.w || 14, col: o.col || '#ff2b4e', mid: o.mid || '#ff8fb0', life: o.life || 0.5, grow: o.grow || 0.07, from: o.from || 'mid' }); }
export function kanjiPop(fx, ch, x, y, size, o = {}) { return item(fx, { kind: 'kanji', tex: kanjiTex(ch, o.tex || {}), x, y, size, rot: o.rot ?? rnd(-0.12, 0.12), life: o.life || 0.8, seal: o.seal, sealCol: o.sealCol }); }
export function sfxPop(fx, txt, x, y, size, o = {}) { return item(fx, { kind: 'sfx', tex: sfxTex(txt, o.fill, o.stroke, o.glow), x, y, size, rot: o.rot ?? rnd(-0.2, 0.05), life: o.life || 0.6 }); }
export function clone(fx, x0, y0, x1, y1, o = {}) { return item(fx, { kind: 'clone', x0, y0, x1, y1, life: o.life || 0.4, dash: o.dash ?? 0.35, size: o.size || 54, trail: o.trail ?? 3, pale: !!o.pale, ang: o.ang, delay: o.delay || 0, hold: o.hold || 0 }); }
export function markPop(fx, x, y, o = {}) { return item(fx, { kind: 'mark', x, y, life: o.life || 0.5, size: o.size || 44, det: !!o.det, col: o.col || '#ff5ad2' }); }
export function ring(fx, x, y, r, col, o = {}) { return item(fx, { kind: 'ring', x, y, r, col, life: o.life || 0.35, w: o.w || 6, enso: !!o.enso, rot: rnd(0, TAU) }); }
export function ghost(fx, x, y, ang, o = {}) { return item(fx, { kind: 'ghost', x, y, ang, life: o.life || 0.3, a: o.a ?? 0.5, sam: !!o.sam, size: o.size || 52 }); }
export function eclipseAt(fx, x, y, R, o = {}) { return item(fx, { kind: 'eclipse', x, y, R, life: o.life || 1.0 }); }
export function streaks(fx, x, y, ang, len, n, col, o = {}) { return item(fx, { kind: 'streaks', x, y, ang, len, n, col, life: o.life || 0.25, w: o.w || 40, seed: rnd(0, 99) }); }

// ------------------------------------------------------------------ screen moments
/** Start a screen moment (only for your own casts). def: { cls: 'sam'|'nin', x, y, ang, title, sub, pal, kanji, seal, sealCol, sfx,
 *  gray, tint, speed, eclipse, life, pre (wait for a climax up to `pre` s), flash, petals, lines }. */
export function moment(fx, me, def) {
  if (!me) return null;
  const s = S(fx);
  const m = { t: 0, life: def.life || 1.0, climaxT: def.pre ? -1 : 0, pre: def.pre || 0, ...def };
  if (fx.cinematic && fx._won) m.title = ''; // (the launch intro after VICTORY: keep the burst, drop the title band)
  if (!m.pre) m.climaxT = 0;
  s.moment = m;
  // pre-emptive: a moment is the heaviest thing we draw and a vsync-locked 60 fps says nothing about headroom, so start it in
  // "lite" (q 0.78: plain-blend glows, ~5% fewer particles); the governor restores full quality after 1.5 s of clean frames
  QUAL.q = Math.min(QUAL.q, 0.78); QUAL.good = 0;
  if (m.onClimax && !m.pre) m.onClimax(m);
  return m;
}
/** The awaited climax hit landed (or the moment's own timer ran out): the burst plays now, the moment ends `tail` s later. */
export function climax(fx, pid, x, y, ang) {
  const s = S(fx), m = s.moment;
  if (!m || m.climaxT >= 0 || (m.pid !== undefined && m.pid !== pid)) return null;
  m.climaxT = m.t; if (x !== undefined) { m.x = x; m.y = y; } if (ang !== undefined) m.ang = ang;
  m.life = Math.min(m.t + (m.tail || 0.75), Math.max(m.life, m.t + 0.5));
  if (m.onClimax) m.onClimax(m);
  return m;
}
export function activeMoment(fx) { return fx.ns && fx.ns.moment; }
/** A big crit number in the moments' style (gradient + glow), world space. */
export function critText(fx, x, y, str, size = 40, pal = 'nin') { if (fx.cinematic) return; const s = S(fx); if (s.crits.length > 14) s.crits.shift(); s.crits.push({ x: x + rnd(-14, 14), y, str, size, pal, t: 0, life: 1.1, vy: -60 }); }

// ------------------------------------------------------------------ update
export function nsUpdate(fx, dt) {
  const s = fx.ns; if (!s) return;
  s.t += dt;
  if (dt > 0 && dt < 0.25) { // the governor (only judges frames while we draw something)
    QUAL.ema += (dt * 1000 - QUAL.ema) * 0.15;
    const busy = s.moment || s.n > 30 || s.items.length > 4;
    if (busy && QUAL.ema > 17.4) { QUAL.q = Math.max(0.35, QUAL.q - dt * 2.5); QUAL.good = 0; }
    else if (QUAL.ema < 16.95 && QUAL.q < 1 && (QUAL.good += dt) > 1.5) QUAL.q = Math.min(1, QUAL.q + dt * 0.4);
  }
  const slow = fx.slowT > 0 ? fx.slowK : 1, pdt = dt * slow;
  const P = s.parts;
  for (let i = 0; i < s.n; i++) {
    const p = P[i]; p.t += pdt;
    if (p.t >= p.life) { const last = P[--s.n]; P[s.n] = p; P[i] = last; i--; continue; }
    p.vy += p.g * pdt; const d = Math.pow(p.drag, pdt * 60); p.vx *= d; p.vy *= d; p.x += p.vx * pdt; p.y += p.vy * pdt; p.rot += p.vr * pdt;
  }
  const it = s.items; let w = 0;
  for (let i = 0; i < it.length; i++) { const o = it[i]; o.t += pdt; if (o.t < o.life + (o.delay || 0)) it[w++] = o; }
  it.length = w;
  for (const c of s.crits) { c.t += pdt; c.y += c.vy * pdt; c.vy *= Math.pow(0.08, pdt); }
  if (s.crits.length && s.crits[0].t >= s.crits[0].life) s.crits = s.crits.filter((c) => c.t < c.life);
  const m = s.moment;
  if (m) {
    m.t += dt;
    if (m.climaxT < 0 && m.t >= m.pre) climax(fx, m.pid);
    if (m.t >= m.life) s.moment = null;
  }
  if (vfxPref.reduceFlash && fx.flash > 0.15) fx.flash = 0.15; // the shared FX flash too (every class)
}

// ------------------------------------------------------------------ draw
const easeOut = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const backOut = (k) => { k = Math.min(1, Math.max(0, k)); const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
let M = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
/** setTransform = base camera matrix × translate(x,y) · rotate(rot) · scale(sx, sy). */
function place(ctx, x, y, rot, sx, sy = sx) {
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const A = M.a * cs + M.c * sn, B = M.b * cs + M.d * sn, C = -M.a * sn + M.c * cs, D = -M.b * sn + M.d * cs;
  ctx.setTransform(A * sx, B * sx, C * sy, D * sy, M.a * x + M.c * y + M.e, M.b * x + M.d * y + M.f);
}
const base = (ctx) => ctx.setTransform(M.a, M.b, M.c, M.d, M.e, M.f);

function envOf(m) { // 0..1 strength of the moment's screen filter
  const tin = Math.min(1, m.t / 0.08), tout = Math.min(1, (m.life - m.t) / 0.25);
  return Math.max(0, Math.min(tin, tout));
}
/** Called at the start of FX.draw (world transform active): scene filter, back screen layer, then world items + particles. */
export function nsDrawPre(fx, ctx) {
  const s = fx.ns; if (!s || !HAS_DOC || typeof ctx.getTransform !== 'function') return;
  const t0 = ctx.getTransform(); if (!t0) return;
  M = { a: t0.a, b: t0.b, c: t0.c, d: t0.d, e: t0.e, f: t0.f };
  const m = s.moment, cineOn = vfxPref.cine;
  if (m && cineOn) { screen(ctx, () => drawFilter(fx, ctx, m)); }
  drawItems(fx, ctx, s, false);
  drawParts(fx, ctx, s);
  drawItems(fx, ctx, s, true);
  base(ctx);
}
/** Called at the end of FX.draw: crit numbers, then the top screen layer (banner, seals, SFX, bars, flash). */
export function nsDrawPost(fx, ctx) {
  const s = fx.ns; if (!s || !HAS_DOC || typeof ctx.getTransform !== 'function') return;
  const t0 = ctx.getTransform(); if (!t0) return;
  M = { a: t0.a, b: t0.b, c: t0.c, d: t0.d, e: t0.e, f: t0.f };
  if (s.crits.length) drawCrits(ctx, s);
  const m = s.moment;
  if (m) screen(ctx, () => drawTop(fx, ctx, m));
  base(ctx);
}
function screen(ctx, f) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); try { f(); } finally { ctx.restore(); } }
const toScreen = (x, y) => [M.a * x + M.c * y + M.e, M.b * x + M.d * y + M.f];

function drawFilter(fx, ctx, m) {
  const W = ctx.canvas.width, H = ctx.canvas.height, u = H / 720, env = envOf(m), cl = m.climaxT >= 0 ? m.t - m.climaxT : -1;
  const [fx0, fy0] = toScreen(m.x, m.y);
  // 1) the scene filter: ONE blend-mode fill (measured: 'color' 1.5 ms vs a cached grayscale copy 4.4 ms / a half-res upscale 2.4 ms
  //    in software rendering), never a pixel readback
  // (globalAlpha exactly 1 takes Skia's fast path: 'color' 1.0 ms at alpha 1 vs 1.5 ms at 0.9, so a near-full gray snaps to 1)
  if (m.gray > 0 && !(m.dim > 0.6)) { const ga = m.gray * env; ctx.globalCompositeOperation = 'color'; ctx.globalAlpha = ga > 0.83 ? 1 : ga; /* (under a near-black dim the gray is invisible: skipped) */ ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); }
  if (m.dim > 0) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = m.dim * env; ctx.fillStyle = m.dimCol || '#06040a'; ctx.fillRect(0, 0, W, H); }
  if (m.colorize) { const ca = m.colorize * env; ctx.globalCompositeOperation = 'color'; ctx.globalAlpha = ca > 0.9 ? 1 : ca; ctx.fillStyle = m.colorCol || '#7a4fc0'; ctx.fillRect(0, 0, W, H); } // (one pass: desaturate + tint)
  if (m.tint) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.85 * env; ctx.fillStyle = m.tint; ctx.fillRect(0, 0, W, H); }
  if (m.lift) { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = m.lift * env; ctx.fillStyle = m.liftCol || '#3a1450'; ctx.fillRect(0, 0, W, H); }
  ctx.globalCompositeOperation = 'source-over';
  // (latched per moment: the fx governor's q crossing a threshold mid-moment used to pop the wash / vignette off and on = flicker)
  if (m.wash && !m._washOff && !(QUAL.q > 0.85)) m._washOff = true;
  if (!m._layOff && !m.speed && !(QUAL.q > 0.6)) m._layOff = true;
  if (m.wash && !m._washOff) { const R0 = 320 * u * (0.9 + 0.2 * (cl >= 0 ? Math.max(0, 1 - cl / 0.5) : 0)); ctx.globalAlpha = env; blitBox(ctx, washTex(), fx0 - R0, fy0 - R0, R0 * 2, R0 * 2, cl < 0 || cl > 0.5, m.wash); }
  // 2) back screen layer: vignette + speed lines (one baked 1:1 blit; two seeds flicker), the eclipse, giant kanji (all pre-rendered)
  const flick = vfxPref.reduceFlash ? 0 : Math.floor(m.t * 16) % 2, lay = screenLayer(W, H, m.vig || '#000000', !!m.speed, m.speedDark !== false, 1 + flick, m.speed ? (m.speedA ?? 0.85) : 0.9);
  if (lay && (m.speed || !m._layOff)) { ctx.globalAlpha = env > 0.95 ? 1 : env; ctx.drawImage(lay, 0, 0); }
  if (m.eclipse) {
    const k = easeOut(m.t / 0.22), R0 = (m.eclipseR || 175) * u * (0.7 + 0.3 * k) * (256 / 176);
    const [ex, ey] = toScreen(m.x + (m.eox || 30), m.y + (m.eoy || -50));
    ctx.globalAlpha = env; blitBox(ctx, eclipseTex(), ex - R0, ey - R0, R0 * 2, R0 * 2, m.t > 0.24);
  }
  if (m.kanji) {
    const pop = backOut((m.t - 0.02) / 0.22), sz = (m.kanjiSize || 0.55) * H, tx = m.kanjiTex || kanjiTex(m.kanji, m.kanjiStyle || {});
    let kx, ky;
    if (m.kanjiAt === 'focus') { kx = fx0 + (m.kox || 0.2) * H; ky = fy0 + (m.koy || -0.15) * H; } else { kx = (m.kx ?? 0.17) * W; ky = (m.ky ?? 0.5) * H; }
    const S0 = sz * 1.5 * (0.6 + 0.4 * pop), settled = m.t > 0.26;
    ctx.globalAlpha = Math.min(1, m.t / 0.06) * env; if (tx) blitBox(ctx, tx, kx - S0 / 2, ky - S0 / 2, S0, S0, settled, m.kanjiA ?? 0.92); // (axis-aligned; alpha baked once settled)
    if (m.seal) { const ss = 0.065 * H * pop; ctx.globalAlpha = env; const sx = kx + (m.sox ?? 0.13) * H, sy = ky + (m.soy ?? 0.2) * H; ctx.drawImage(hankoTex(m.seal, m.sealCol), sx - ss / 2, sy - ss / 2, ss, ss); }
  }
  ctx.globalAlpha = 1;
}
/** Build the settled exact-size copies early, one per frame during the light lead-in, so no frame later pays for a resample. */
function prefit(m, W, H, cineOn) {
  const i = m._pf = (m._pf | 0) + 1, u = H / 720;
  if (i === 1 && m.title) { const tx = titleTex(m.title, m.sub || '', m.pal || 'gold'); if (tx) { const sc = Math.min(W * 0.86 / tx.width, 0.92 * u); fitTex(tx, tx.width * sc, tx.height * sc); } }
  if (!cineOn) return;
  if (i === 2 && m.kanji) { const tx = m.kanjiTex || kanjiTex(m.kanji, m.kanjiStyle || {}), S0 = (m.kanjiSize || 0.55) * H * 1.5; if (tx) fitTex(tx, S0, S0, m.kanjiA ?? 0.92); }
  if (i === 3 && m.wash) { const R0 = 320 * u * 0.9; fitTex(washTex(), R0 * 2, R0 * 2, m.wash); }
  if (i === 4 && m.eclipse) { const R0 = (m.eclipseR || 175) * u * (256 / 176); fitTex(eclipseTex(), R0 * 2, R0 * 2); }
  if (i === 5 && m.sfx && m.sfxAt === 'screen') { const tx = sfxTex(m.sfx, m.sfxFill, m.sfxStroke, m.sfxGlow); if (tx) { const sc = (m.sfxSize || 0.2) * H / (tx.height / SFX_H); fitTex(tx, tx.width * sc, tx.height * sc); } }
}
function drawTop(fx, ctx, m) {
  const W = ctx.canvas.width, H = ctx.canvas.height, u = H / 720, env = envOf(m), cineOn = vfxPref.cine, rf = vfxPref.reduceFlash;
  if ((m._pf | 0) < 5) prefit(m, W, H, cineOn);
  const cl = m.climaxT >= 0 ? m.t - m.climaxT : -1;
  if (cineOn && m.bars) { // slanted manga cut-in bars
    const h1 = 46 * u * env, h2 = 92 * u * env;
    ctx.globalAlpha = 0.94; ctx.fillStyle = '#0a0210';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, h1); ctx.lineTo(0, h2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.lineTo(W, H - h2); ctx.lineTo(0, H - h1); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.95 * env; ctx.strokeStyle = m.barCol || '#ff5ad2'; ctx.lineWidth = 2.5 * u; ctx.beginPath(); ctx.moveTo(0, h2); ctx.lineTo(W, h1); ctx.moveTo(0, H - h1); ctx.lineTo(W, H - h2); ctx.stroke();
  }
  if (cineOn && m.sfx && cl >= 0) { // the katakana SFX slams in at the climax
    const tx = sfxTex(m.sfx, m.sfxFill, m.sfxStroke, m.sfxGlow), k = backOut(cl / 0.16), sc = (m.sfxSize || 0.2) * H / (tx.height / SFX_H) * (0.5 + 0.5 * k) * (1 + 0.15 * Math.max(0, 1 - cl / 0.1));
    const [sx0, sy0] = toScreen(m.x, m.y), sx = m.sfxAt === 'screen' ? (m.sfxX ?? 0.5) * W : sx0 + (m.sfxOX ?? -0.2) * H, sy = m.sfxAt === 'screen' ? (m.sfxY ?? 0.7) * H : sy0 + (m.sfxOY ?? 0.24) * H;
    ctx.globalAlpha = Math.min(1, cl / 0.04) * env; blitBox(ctx, tx, sx - tx.width * sc / 2, sy - tx.height * sc / 2, tx.width * sc, tx.height * sc, m.sfxAt === 'screen' && cl > 0.17); // (tilt baked)
  }
  if (m.title) { // the banner (always shown, even with cinematics off: it is the readable part)
    const tx = titleTex(m.title, m.sub || '', m.pal || 'gold'), k = backOut(m.t / 0.2), sc = Math.min(W * 0.86 / tx.width, 0.92 * u) * (0.75 + 0.25 * k);
    ctx.globalAlpha = Math.min(1, m.t / 0.06) * Math.min(1, (m.life - m.t) / 0.2);
    blitBox(ctx, tx, W / 2 - tx.width * sc / 2, (m.titleY ?? 0.13) * H - 40 * sc, tx.width * sc, tx.height * sc, m.t > 0.21);
  }
  if (cineOn && m.screenPetals && QUAL.q > 0.6) { // a few big petals drifting over the whole screen
    const n = Math.round(m.screenPetals * (fx.partMul ?? 1) * QUAL.q);
    for (let i = 0; i < n; i++) { const r = R(i + 7), x0 = r() * W, y0 = r() * H, sp = 40 + r() * 70, sz = (10 + r() * 14) * u, ph = r() * 10;
      const x = ((x0 - (m.t * sp * 1.6 + ph * 40) * u) % W + W) % W, y = (y0 + m.t * sp * u) % H;
      const ro = m.t * (1 + r()) + ph, sy = 0.55 + 0.45 * Math.abs(Math.sin(m.t * 3 + ph)), pt = petalTex(PETALS[i % 4]); if (!pt) continue;
      const f = frameOf(pt.fr, ro), k = sz / 20, fw = f.width * k, fh = f.height * k * sy; ctx.globalAlpha = env > 0.95 ? 1 : env; ctx.drawImage(f, x - fw / 2, y - fh / 2, fw, fh); }
  }
  // the flash: capped, and skipped entirely with "Reduce screen flashes"
  if (!rf && m.flash && cl >= 0 && cl < 0.16) { ctx.globalAlpha = Math.min(0.38, m.flash) * (1 - cl / 0.16); ctx.fillStyle = m.flashCol || '#ffffff'; ctx.fillRect(0, 0, W, H); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawParts(fx, ctx, s) {
  const P = s.parts, n = s.n, rf = vfxPref.reduceFlash, keep = QUAL.q + 0.1; // under load (governor q < 0.9) a stable subset is skipped
  for (let pass = 0; pass < 2; pass++) {
    const add = pass === 1;
    const addOp = plain() ? 'source-over' : 'lighter';
    if (add) ctx.globalCompositeOperation = addOp;
    for (let i = 0; i < n; i++) {
      const p = P[i]; if (p.add !== add || (keep < 1 && (i * 0.618034) % 1 > keep)) continue;
      const k = p.t / p.life, inv = 1 - k;
      if (p.k === 1) { // spark streak
        base(ctx); ctx.globalAlpha = inv * (rf ? 0.6 : 1); ctx.strokeStyle = p.col; ctx.lineWidth = p.s * inv + 0.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke(); continue;
      }
      if (p.k === 2) { base(ctx); ctx.globalAlpha = Math.min(1, inv * 2); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (0.6 + 0.4 * inv), 0, TAU); ctx.fill(); continue; }
      const t0 = p.tex; if (!t0) continue;
      const tx = t0.fr ? frameOf(t0.fr, p.rot) : t0; // pre-rotated frame (petals); soft sprites are rotation-free
      const sz = p.s * (1 + (p.s1 - 1) * k), sc = sz / t0.width * 2, sw = p.sway ? Math.sin(p.t * 5 + p.seed) * 6 : 0;
      place(ctx, p.x + sw, p.y, 0, sc, p.sway ? sc * (0.55 + 0.45 * Math.abs(Math.sin(p.t * 4 + p.seed))) : sc);
      ctx.globalAlpha = Math.min(1, inv * 2) * p.a * (add && rf ? 0.6 : 1);
      ctx.drawImage(tx, -tx.width / 2, -tx.height / 2);
    }
    if (add) ctx.globalCompositeOperation = 'source-over';
  }
  base(ctx); ctx.globalAlpha = 1;
}

/** Ink crescent as a filled path in crescent-texture space (radius CRES.R, arc centred on +x): a tapered body, lighter dry-brush
 *  streaks, split bristle tips and a few ink dots. Paths cost the same at any angle (a rotated texture does not). */
const INK = 'rgba(10,6,12,.94)', DRY = 'rgba(96,84,104,.5)';
function inkArc(ctx, rev, th, v, SP = CRES.span, mid = 0) {
  if (rev <= 0.01) return;
  const a0 = mid - SP / 2, span = SP * rev, n = Math.ceil(SP * 8), R0 = CRES.R, wid = (q) => th * Math.pow(Math.sin(Math.PI * Math.min(1, q)), 0.6) * (q < 0.12 ? 1.2 : 1);
  ctx.fillStyle = INK; ctx.beginPath();
  for (let i = 0; i <= n; i++) { const t = i / n, a = a0 + span * t, w = wid(t * rev) + 3, r = R0 + w * 0.45 + Math.sin(i * 1.7 + v) * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  for (let i = n; i >= 0; i--) { const t = i / n, a = a0 + span * t, w = wid(t * rev) + 3, r = R0 - w * 0.55 + Math.sin(i * 2.3 + v) * 1.5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
  if (plain()) return; // (lite: body only)
  ctx.lineCap = 'round'; ctx.strokeStyle = DRY;
  for (let j = 0; j < 3; j++) { ctx.lineWidth = th * (0.06 + 0.02 * j); ctx.beginPath(); ctx.arc(0, 0, R0 + (j - 1) * th * 0.24, a0 + span * (0.12 + 0.1 * j), a0 + span * (0.7 + 0.08 * j)); ctx.stroke(); }
  if (rev > 0.9) { ctx.strokeStyle = INK; const e = a0 + span; for (let j = 0; j < 3; j++) { ctx.lineWidth = th * 0.07; ctx.beginPath(); ctx.arc(0, 0, R0 + (j - 1) * th * 0.18, e - 0.12, e + 0.05 + j * 0.03); ctx.stroke(); } }
  ctx.fillStyle = INK; for (let j = 0; j < 5; j++) { const a = a0 + span * ((j * 0.23 + v * 0.1) % 1), r = R0 + (j % 2 ? 1 : -1) * th * (0.9 + j * 0.15); ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 2 + (j % 3) * 1.5, 0, TAU); ctx.fill(); }
}
/** Straight brush stroke along +x (length L, width w): blunt start, tapered end, dry streaks, split tail. */
function inkBar(ctx, L, w, v) {
  if (L < 2) return;
  const n = 12, prof = (u) => (u < 0.08 ? 0.85 + u * 2 : u > 0.7 ? Math.pow(Math.max(0, (1 - u) / 0.3), 0.7) : 1);
  ctx.fillStyle = INK; ctx.beginPath();
  for (let i = 0; i <= n; i++) { const u = i / n; ctx.lineTo(L * u, -w / 2 * prof(u) + Math.sin(u * 9 + v) * w * 0.04); }
  for (let i = n; i >= 0; i--) { const u = i / n; ctx.lineTo(L * u, w / 2 * prof(u) * 0.9 + Math.sin(u * 7 + v) * w * 0.04); }
  ctx.closePath(); ctx.fill();
  ctx.lineCap = 'round'; ctx.strokeStyle = DRY;
  for (let j = 0; j < 3; j++) { ctx.lineWidth = w * 0.06; ctx.beginPath(); ctx.moveTo(L * (0.05 + j * 0.06), (j - 1) * w * 0.22); ctx.lineTo(L * (0.68 + j * 0.08), (j - 1) * w * 0.2); ctx.stroke(); }
  ctx.strokeStyle = INK; for (let j = 0; j < 3; j++) { ctx.lineWidth = w * 0.08; ctx.beginPath(); ctx.moveTo(L * 0.78, (j - 1) * w * 0.2); ctx.lineTo(L * (0.98 + j * 0.02), (j - 1) * w * 0.28); ctx.stroke(); }
}
function drawItems(fx, ctx, s, top) {
  const rf = vfxPref.reduceFlash;
  for (const o of s.items) {
    const T = o.t - (o.delay || 0); if (T < 0) continue;
    const k = Math.min(1, T / o.life), inv = 1 - k;
    switch (o.kind) {
      case 'cres': { if (top) break;
        let x = o.x, y = o.y; if (o.follow && fx.sim && fx.sim.players) { const pl = fx.sim.players.get(o.follow); if (pl) { x = pl.x; y = pl.y; } }
        const sc = o.r / CRES.R, rev = easeOut(T / o.speed), a0 = -CRES.span / 2;
        place(ctx, x, y, o.ang, sc, sc * o.dir);
        ctx.globalAlpha = Math.min(1, inv * 1.8) * o.ink; inkArc(ctx, rev, (40 + o.v * 6) * (0.7 + 0.3 * o.w), o.v);
        if (o.red) { // the blazing edge
          ctx.globalCompositeOperation = plain() ? 'source-over' : 'lighter'; ctx.lineCap = 'round'; const e = a0 + CRES.span * rev;
          ctx.globalAlpha = 0.55 * inv * (rf ? 0.6 : 1); ctx.strokeStyle = o.hi; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(0, 0, CRES.R + 18, a0 + 0.1, e); ctx.stroke();
          ctx.globalAlpha = 0.95 * inv; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
        break; }
      case 'stroke': { if (top) break;
        const rev = easeOut(T / o.speed);
        place(ctx, o.x, o.y, o.ang, 1, 1);
        ctx.globalAlpha = Math.min(1, inv * 1.8); inkBar(ctx, o.len * rev, o.w, o.v);
        if (o.red) { ctx.globalCompositeOperation = plain() ? 'source-over' : 'lighter'; ctx.lineCap = 'round'; const L = o.len * rev;
          ctx.globalAlpha = 0.5 * inv * (rf ? 0.6 : 1); ctx.strokeStyle = o.hi; ctx.lineWidth = o.w * 0.5; ctx.beginPath(); ctx.moveTo(0, -o.w * 0.15); ctx.lineTo(L, -o.w * 0.15); ctx.stroke();
          ctx.globalAlpha = 0.95 * inv; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
        break; }
      case 'line': { if (!top) break;
        const g = easeOut(T / o.grow), L = o.len * g, fade = k < 0.6 ? 1 : (1 - k) / 0.4;
        place(ctx, o.x, o.y, o.ang, 1, 1); const x0 = o.from === 'start' ? 0 : -L / 2, x1 = o.from === 'start' ? L : L / 2;
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        const wt = o.w * (0.6 + 0.4 * fade), cap = rf ? 0.5 : 1;
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.34 * fade * cap; ctx.strokeStyle = o.col; ctx.lineWidth = wt * 2; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke(); // (wide glow: plain blend, cheaper)
        ctx.globalCompositeOperation = plain() ? 'source-over' : 'lighter'; ctx.globalAlpha = 0.7 * fade * cap; ctx.strokeStyle = o.mid; ctx.lineWidth = wt * 1.2; ctx.stroke();
        ctx.globalAlpha = 0.95 * fade; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, wt * 0.32); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over'; break; }
      case 'burst': { if (!top) break;
        const sz = o.size * (0.5 + 0.7 * easeOut(k * 1.6)), a = o.a * (1 - k * k); place(ctx, o.x, o.y, 0, sz / 256);
        ctx.globalCompositeOperation = plain() ? 'source-over' : 'lighter'; ctx.globalAlpha = a; const cr = plain() ? 112 : 140; ctx.drawImage(burstCoreTex(o.col), -cr, -cr, cr * 2, cr * 2);
        ctx.globalCompositeOperation = 'source-over'; // (spikes: plain blend + 22 of them; additive path fills cost ~2x in software)
        ctx.fillStyle = hexA(o.col, 0.6); burstSpikes(ctx, o.seed, 0); ctx.fillStyle = 'rgba(255,255,255,.85)'; burstSpikes(ctx, o.seed, 1);
        ctx.globalCompositeOperation = 'source-over'; break; }
      case 'kanji': { if (!top) break;
        const pop = backOut(T / 0.16), sz = o.size * 1.5 * (0.55 + 0.45 * pop) * (1 + 0.06 * k), tx = o.tex; if (!tx) break;
        place(ctx, o.x, o.y, 0, sz / tx.width); ctx.globalAlpha = Math.min(1, T / 0.05) * Math.min(1, inv * 3); ctx.drawImage(tx, -tx.width / 2, -tx.height / 2);
        if (o.seal) { const st = hankoTex(o.seal, o.sealCol), ss = o.size * 0.26 * pop; place(ctx, o.x + o.size * 0.42, o.y + o.size * 0.42, 0, ss / 132); ctx.drawImage(st, -66, -66); }
        break; }
      case 'sfx': { if (!top) break;
        const tx = o.tex; if (!tx) break; const pop = backOut(T / 0.12), sc = o.size / (tx.height / SFX_H) * (0.5 + 0.5 * pop);
        place(ctx, o.x, o.y - 10 * k, 0, sc); ctx.globalAlpha = Math.min(1, inv * 3); ctx.drawImage(tx, -tx.width / 2, -tx.height / 2); break; }
      case 'clone': { if (!top) break;
        const m = o.dash > 0 ? easeOut(Math.max(0, T - o.hold) / o.dash) : 1, x = o.x0 + (o.x1 - o.x0) * m, y = o.y0 + (o.y1 - o.y0) * m;
        const ang = o.ang ?? Math.atan2(o.y1 - o.y0, o.x1 - o.x0), t0 = cloneTex(o.pale); if (!t0) break; const tx = frameOf(t0.fr, ang), h = tx.width / 2, sc = o.size / 128, fa = Math.min(1, T / 0.06) * Math.min(1, inv * 2.5);
        if (o.trail && m > 0.02 && m < 0.99) for (let j = o.trail; j >= 1; j--) { const mm = Math.max(0, m - j * 0.12); place(ctx, o.x0 + (o.x1 - o.x0) * mm, o.y0 + (o.y1 - o.y0) * mm, 0, sc); ctx.globalAlpha = fa * 0.22 * (1 - j / (o.trail + 1)); ctx.drawImage(tx, -h, -h); }
        place(ctx, x, y, 0, sc); ctx.globalAlpha = fa * 0.95; if (o.pale) ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(tx, -h, -h); ctx.globalCompositeOperation = 'source-over'; break; }
      case 'ghost': { if (top) break;
        const t0 = o.sam ? samGhostTex() : cloneTex(true); if (!t0) break; const tx = frameOf(t0.fr, o.ang), h = tx.width / 2, sc = o.size / 128; place(ctx, o.x, o.y, 0, sc);
        ctx.globalAlpha = o.a * inv; if (!o.sam) ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(tx, -h, -h); ctx.globalCompositeOperation = 'source-over'; break; }
      case 'mark': { if (!top) break;
        const tx = markTex(o.det ? '#ffffff' : o.col), pop = o.det ? 1 + 0.7 * easeOut(k) : backOut(T / 0.14), sz = o.size * pop;
        place(ctx, o.x, o.y, 0, sz / 56); ctx.globalAlpha = o.det ? inv : Math.min(1, inv * 2.5); ctx.drawImage(tx, -56, -56); break; }
      case 'ring': { if (top) break;
        const R0 = o.r * (0.35 + 0.65 * easeOut(k * 1.4));
        if (o.enso) { const sc = R0 / CRES.R; place(ctx, o.x, o.y, 0, o.rot > Math.PI ? -sc : sc, sc * 0.75); ctx.globalAlpha = Math.min(1, inv * 1.6); inkArc(ctx, 1, 32, 2, 5.5, 0.55); } // (path brush: cost does not scale with the ring's area)
        else { base(ctx); ctx.globalAlpha = inv; ctx.strokeStyle = o.col; ctx.lineWidth = o.w * inv + 1; ctx.beginPath(); ctx.ellipse(o.x, o.y, R0, R0 * 0.8, 0, 0, TAU); ctx.stroke(); }
        break; }
      case 'eclipse': { if (top) break;
        const R0 = o.R * (0.6 + 0.4 * easeOut(T / 0.2)); base(ctx); ctx.globalAlpha = Math.min(1, inv * 3); const E = R0 * (256 / 176); ctx.drawImage(eclipseTex(), o.x - E, o.y - E, E * 2, E * 2); break; }
      case 'streaks': { if (top) break; // a bundle of parallel speed streaks along a dash
        base(ctx); const r = R(Math.floor(o.seed)), dx = Math.cos(o.ang), dy = Math.sin(o.ang), nx = -dy, ny = dx; ctx.lineCap = 'round'; ctx.strokeStyle = o.col;
        for (let i = 0; i < o.n; i++) { const off = (r() - 0.5) * o.w, s0 = r() * 0.3, L = o.len * (0.5 + r() * 0.5), sh = k * o.len * 0.3; ctx.globalAlpha = inv * (0.4 + r() * 0.5); ctx.lineWidth = 1 + r() * 2.5;
          const x0 = o.x + nx * off + dx * (s0 * o.len + sh), y0 = o.y + ny * off + dy * (s0 * o.len + sh); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + dx * L * inv, y0 + dy * L * inv); ctx.stroke(); }
        break; }
    }
  }
  base(ctx); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
const CRIT_TX = new Map();
function critTex(str, pal, size) { // the number rendered once at 1.6x (it pops from 2.4x down to 1x), then only drawn scaled
  const key = pal + size + str; let c = CRIT_TX.get(key); if (c) return c;
  const S0 = Math.round(size * 1.6); c = mk(10, 10); let g = c.getContext('2d'); g.font = `${S0}px ${FONT_GAME}`;
  const w = Math.ceil(g.measureText(str).width + S0 * 0.6), h = Math.ceil(S0 * 1.5); c.width = w; c.height = h; g = c.getContext('2d');
  g.font = `${S0}px ${FONT_GAME}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = Math.max(4, S0 * 0.2); g.strokeStyle = pal === 'sam' ? '#1a0408' : '#2a0636'; g.strokeText(str, w / 2, h / 2);
  const gr = g.createLinearGradient(0, h / 2 - S0 / 2, 0, h / 2 + S0 / 2); (pal === 'sam' ? ['#ffffff', '#ffd0dc', '#ff2b4e'] : ['#ffffff', '#ff8ae0', '#c02cff']).forEach((cc, i) => gr.addColorStop(i / 2, cc)); g.fillStyle = gr; g.fillText(str, w / 2, h / 2);
  c.s0 = S0; if (fontsReady()) { CRIT_TX.set(key, c); if (CRIT_TX.size > 48) CRIT_TX.delete(CRIT_TX.keys().next().value); }
  return c;
}
function drawCrits(ctx, s) {
  for (const c of s.crits) {
    const k = c.t / c.life, pop = k < 0.12 ? 2.4 - 1.4 * (k / 0.12) : 1, tx = c.tex || (c.tex = critTex(c.str, c.pal, c.size)), sc = c.size * pop / tx.s0;
    place(ctx, c.x, c.y, 0, sc); ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; ctx.drawImage(tx, -tx.width / 2, -tx.height / 2);
  }
  base(ctx); ctx.globalAlpha = 1;
}
