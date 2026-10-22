// Shader layer: a WebGL post-process over the rendered world (under the HUD and the screen-space finisher pieces).
//
//   pass 1  distort   shockwave refraction rings, heat shimmer around the big spirits, radial zoom blur, chromatic aberration
//   pass 2  extract   bright pixels -> quarter-resolution target
//   pass 3-6 blur     two separable gaussian rounds (a wide, soft bloom)
//   pass 7  composite scene + bloom, per-finisher colour grade, vignette, film grain, a faint scanline depth
//
// The 2D canvas stays the single source of truth: the finished frame is copied back onto it, so the HUD, screenshots and
// toDataURL keep working. Without WebGL (or on a low-quality setting) apply() does nothing and the game looks exactly as before.
//
// Mode (window.RB_SHADERS, or localStorage 'rb.shaders'): 'moments' (default: eases in only while a signature finisher plays),
// 'always' (a light grade + bloom all the time) or 'off'.
//
// Cost control: the 2D -> GL upload and the GL -> 2D copy back are the expensive part (a GPU sync every frame), so
//   - 'always' runs the copy at half resolution while nothing is happening (full res only during a moment), and only at
//     quality level 0; on a lower level it behaves like 'moments'
//   - 'moments' keeps running up to MOMENT_MAX_Q, at full res on q0, half res on q1-2, quarter res on q3
//   - the auto-quality governor asks the shader to shed its own cost first (shed(): halve the copy, then suspend 'always')
//     before it lowers the whole game's quality (perf.js)
// Options: Ult cinematics off -> no shader at all; Reduce screen flashes -> the impact boost (bloom / aberration / zoom
// blur / god rays) is capped. Co-op: only the local player's own pieces drive it. A lost WebGL context is rebuilt on restore.
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const HAS_DOM = typeof document !== 'undefined' && typeof document.createElement === 'function';
import { vfxPref } from './fxns.js';
const fin = (v, d = 0) => (Number.isFinite(v) ? v : d); // NaN guard for every shader input
/** The highest governor level (perf.js QUALITY index) at which 'moments' still runs, and its copy scale per level. */
export const MOMENT_MAX_Q = 3;
const MOMENT_SCALE = [1, 0.5, 0.5, 0.25];
const ALWAYS_IDLE_SCALE = 0.5;
const LIGHT_SCALE = 0.5;
const IMPACT_CAP_RF = 0.2; // Reduce screen flashes: ceiling on the impact boost
/** Options → Visual effects → "Shaders": 'off' | 'moments' (Finishers only, the default) | 'always'. Stored in localStorage
 *  'rb.shaders' (the same key the dev override always used); window.RB_SHADERS still wins when a tool sets it, and is kept in
 *  sync when the player changes the option, so the change applies on the next frame without a reload. */
export const SHADER_MODES = [
  { id: 'off', label: 'Off', tip: 'No shader layer: the game draws exactly as before (cheapest).' },
  { id: 'moments', label: 'Finishers only', tip: 'Bloom, colour grade, shockwave refraction and grain ease in only during your finishers and big skill moments (default).' },
  { id: 'always', label: 'Always on', tip: 'A light grade + bloom all the time (half-resolution copy while idle; needs a good GPU, adaptive quality turns it down when frames run slow).' },
];
const MODE_IDS = new Set(SHADER_MODES.map((m) => m.id));
const SPREF = { m: null };
export const shaderPref = {
  get mode() {
    if (SPREF.m === null) { let v = null; try { v = typeof localStorage !== 'undefined' ? localStorage.getItem('rb.shaders') : null; } catch { /* storage off */ } SPREF.m = MODE_IDS.has(v) ? v : 'moments'; }
    return SPREF.m;
  },
  set(m) {
    if (!MODE_IDS.has(m)) return false;
    SPREF.m = m;
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('rb.shaders', m); } catch { /* storage off */ }
    try { if (typeof window !== 'undefined' && window.RB_SHADERS) window.RB_SHADERS = m; } catch { /* ignore */ }
    return true;
  },
};

const VERT = `attribute vec2 p; varying vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;

const FRAG_DISTORT = `precision highp float; varying vec2 uv;
uniform sampler2D tex; uniform vec2 res; uniform float time;
uniform vec4 shock[4];   // centre.xy (uv), age (s), amplitude
uniform vec4 heat[3];    // centre.xy (uv), radius (height units), amplitude
uniform vec3 rb;         // radial blur centre.xy, strength
uniform float ca;        // chromatic aberration
uniform vec4 swirl;      // centre.xy (uv), twist (radians at the centre), radius (height units)
void main(){
  vec2 asp = vec2(res.x / res.y, 1.);
  vec2 d = uv;
  if (swirl.z != 0.) {
    vec2 v = (uv - swirl.xy) * asp; float r = length(v), k = smoothstep(swirl.w, 0., r), an = swirl.z * k * k;
    float cs = cos(an), sn = sin(an); v = vec2(v.x * cs - v.y * sn, v.x * sn + v.y * cs); d = swirl.xy + v / asp;
  }
  for (int i = 0; i < 4; i++) {
    vec4 s = shock[i];
    if (s.w > 0.) {
      vec2 v = (uv - s.xy) * asp; float r = length(v);
      float w = (r - s.z * .85) / (.05 + s.z * .07);
      float ring = s.w * exp(-w * w) * exp(-s.z * 1.6);
      d += normalize(v + 1e-5) * ring * .045 / asp;
    }
  }
  for (int i = 0; i < 3; i++) {
    vec4 h = heat[i];
    if (h.w > 0.) {
      float m = smoothstep(h.z, 0., length((uv - h.xy) * asp));
      d += vec2(sin(uv.y * 70. + time * 9.) + sin(uv.y * 31. - time * 5.), cos(uv.x * 55. + time * 7.)) * .0022 * h.w * m / asp;
    }
  }
  vec3 col;
  if (rb.z < .001 && ca < .0004) { col = texture2D(tex, d).rgb; }
  else {
    vec2 c = rb.xy; vec2 dir = normalize((d - c) * asp + 1e-5) / asp * ca;
    col = vec3(0.);
    for (int i = 0; i < 8; i++) {
      float t = float(i) / 8.;
      vec2 q = d + (c - d) * t * rb.z;
      col += vec3(texture2D(tex, q + dir).r, texture2D(tex, q).g, texture2D(tex, q - dir).b);
    }
    col /= 8.;
  }
  gl_FragColor = vec4(col, 1.);
}`;

const FRAG_EXTRACT = `precision mediump float; varying vec2 uv; uniform sampler2D tex; uniform float thr;
void main(){ vec3 c = texture2D(tex, uv).rgb; float l = max(c.r, max(c.g, c.b)); float k = smoothstep(thr, thr + .3, l); gl_FragColor = vec4(c * k, 1.); }`;

const FRAG_BLUR = `precision mediump float; varying vec2 uv; uniform sampler2D tex; uniform vec2 dir;
void main(){
  vec3 c = texture2D(tex, uv).rgb * .227027;
  c += (texture2D(tex, uv + dir * 1.3846).rgb + texture2D(tex, uv - dir * 1.3846).rgb) * .316216;
  c += (texture2D(tex, uv + dir * 3.2308).rgb + texture2D(tex, uv - dir * 3.2308).rgb) * .070270;
  gl_FragColor = vec4(c, 1.);
}`;

const FRAG_COMP = `precision highp float; varying vec2 uv;
uniform sampler2D tex; uniform sampler2D bloom; uniform sampler2D soft; uniform vec2 res; uniform float time; uniform float dof; uniform vec3 gr;
uniform float bloomAmt; uniform vec3 tint; uniform float tintAmt; uniform float sat; uniform float contrast;
uniform float vig; uniform float grain; uniform float scan; uniform float mixk;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  vec3 base = texture2D(tex, uv).rgb;
  // HD-2D tilt-shift: the focus band sits across the middle, the top and bottom edges melt into soft focus
  float band = smoothstep(.16, .5, abs(uv.y - .52)) * .75 + smoothstep(.55, .85, abs(uv.x - .5)) * .25;
  base = mix(base, texture2D(soft, uv).rgb, clamp(band * dof, 0., 1.));
  vec3 col = base + texture2D(bloom, uv).rgb * bloomAmt;
  if (gr.z > .001) {   // light shafts: march the bloom toward the impact point
    vec2 dir = (gr.xy - uv) / 16.; vec2 p = uv; vec3 acc = vec3(0.); float w = 1.;
    for (int i = 0; i < 16; i++) { p += dir; acc += texture2D(bloom, p).rgb * w; w *= .9; }
    col += acc * gr.z * .16;
  }
  float l = dot(col, vec3(.299, .587, .114));
  col = mix(vec3(l), col, sat);
  vec3 tinted = mix(col, col * tint + tint * .035, tintAmt);   // multiply the lights, lift the shadows a touch
  col = tinted;
  col = (col - .5) * contrast + .5;
  vec2 q = (uv - .5) * vec2(res.x / res.y, 1.);
  col *= 1. - vig * smoothstep(.28, .95, length(q));
  col += (hash(uv * res + fract(time) * 91.) - .5) * grain;
  col *= 1. - scan * (.5 + .5 * sin(uv.y * res.y * 3.14159));
  gl_FragColor = vec4(mix(base, col, mixk), 1.);
}`;

const GRADE = { drg: [1.12, 0.66, 0.7], monk: [1.14, 0.96, 0.66], sum: [0.68, 1.06, 1.06] };

export class ShaderFX {
  constructor() { this.ok = false; this.tried = false; this.lost = false; this.mix = 0; this.mode = null; this.last = 0; this.W = 0; this.H = 0; this.scale = 1; this.shedK = 1; this.alwaysOff = false; this.stats = { frames: 0, restored: 0, lastMs: 0 }; }
  /** The governor sheds the shader's cost before the game's own quality: halve the copy, then suspend 'always'. Returns true when it shed something. */
  shed() { if (!this.ok || this.mix <= 0) return false; if (this.shedK > 0.25) { this.shedK *= 0.5; return true; } if (this.mode === 'always' && !this.alwaysOff) { this.alwaysOff = true; return true; } return false; }
  /** Calm frames again: give back one shed step. Returns true when it restored something. */
  unshed() { if (this.alwaysOff) { this.alwaysOff = false; return true; } if (this.shedK < 1) { this.shedK = Math.min(1, this.shedK * 2); return true; } return false; }

  getMode() {
    if (this.forced) return this.forced;
    try { if (typeof window !== 'undefined' && MODE_IDS.has(window.RB_SHADERS)) return window.RB_SHADERS; } catch { /* ignore */ }
    return shaderPref.mode; // (cached: no localStorage read per frame)
  }
  setMode(m) { this.forced = m; }
  /** true when the player (Options) or a tool picked the shader mode, false on the untouched default */
  explicit() { if (this.forced) return true; const now = Date.now(); if (this._exT && now - this._exT < 1000) return this._ex; this._exT = now; this._ex = false; try { if (typeof window !== 'undefined' && window.RB_SHADERS) this._ex = true; else if (typeof localStorage !== 'undefined' && localStorage.getItem('rb.shaders')) this._ex = true; } catch { /* storage off */ } return this._ex; }

  init() {
    this.tried = true;
    if (!HAS_DOM) return;
    try {
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
      if (!gl) return;
      this.cv = cv; this.gl = gl;
      try { const di = gl.getExtension('WEBGL_debug_renderer_info'), rn = String(di ? gl.getParameter(di.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); this.soft = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(rn); this.rendererName = rn; } catch { this.soft = false; }
      cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.ok = false; this.lost = true; });
      cv.addEventListener('webglcontextrestored', () => { this.lost = false; this.stats.restored++; try { this.build(); } catch (e) { this.ok = false; if (typeof console !== 'undefined') console.warn('shader layer: restore failed:', e && e.message); } });
      this.build();
    } catch (e) { this.ok = false; if (typeof console !== 'undefined') console.warn('shader layer disabled:', e && e.message); }
  }
  /** (Re)create every GL object: programs, the triangle, the textures and targets (sizes reset, so the next frame re-allocates). Runs at init and after a context restore. */
  build() {
    const gl = this.gl; this.ok = false;
    {
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const prog = (frag) => {
        const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i), nm = a.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, a.name); }
        return { p, u };
      };
      this.P = { distort: prog(FRAG_DISTORT), extract: prog(FRAG_EXTRACT), blur: prog(FRAG_BLUR), comp: prog(FRAG_COMP) };
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.src = this.tex(); this.T = { A: this.target(), B: this.target(), C: this.target(), D: this.target(), E: this.target() };
      this.ok = true;
    }
  }
  tex() { const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
  target() { const gl = this.gl; return { t: this.tex(), f: gl.createFramebuffer(), w: 0, h: 0 }; }
  size(T, w, h) { const gl = this.gl; if (T.w === w && T.h === h) return; T.w = w; T.h = h; gl.bindTexture(gl.TEXTURE_2D, T.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.bindFramebuffer(gl.FRAMEBUFFER, T.f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, T.t, 0); }

  /** Read the live finisher state (fx.cine) and turn it into shader parameters. */
  params(fx, rend) {
    const W = rend.w || 1, H = rend.h || 1, uvOf = (x, y) => { const s = rend.worldToScreen(fin(x), fin(y)), u = s.x / W, v = 1 - s.y / H; return Number.isFinite(u) && Number.isFinite(v) ? [u, v] : [0.5, 0.5]; };
    const lp = fx.localPid, rf = vfxPref.reduceFlash;
    const P = { shock: [], heat: [], rb: [0.5, 0.5, 0], ca: 0, bloom: 0.3, thr: 0.62, tint: [1, 1, 1], tintAmt: 0, sat: 1.03, contrast: 1.03, vig: 0.22, grain: 0.03, scan: 0.012, dof: 0.5, gr: [0.5, 0.5, 0], active: false };
    let vort = 0, vc = null, vin = false, skN = 0;
    let scene = null, bars = 0, impact = 0, imp = null, dive = 0, diveAt = null;
    for (const c of fx.cine) {
      if (c.pid !== undefined && lp != null && c.pid !== lp) continue; // co-op: only your own pieces drive the shader
      switch (c.kind) {
        case 'scrBars': P.active = true; scene = c.scene; bars = Math.min(clamp(c.t / 0.3), clamp((c.life - c.t) / 0.35)); break;
        case 'momShock': if (P.shock.length < 4) { const [u, v] = uvOf(c.x, c.y); P.shock.push([u, v, c.t, 1]); } P.active = true; break;
        case 'scrFlash': if (c.a > 0.5) { const k = Math.pow(1 - clamp(c.t / c.life), 1.6); if (k > impact) impact = k; } P.active = true; break;
        case 'scrLines': { P.active = true; const k = clamp(c.t / c.life); if (c.inward) { if (k * 0.8 > dive) { dive = k * 0.8; diveAt = c; } } else imp = c; break; }
        case 'momDragon': case 'momPalm': case 'momBook': { P.active = true; if (P.heat.length < 3) { const [u, v] = uvOf(c.x, c.y - 90); const k = c.kind === 'momDragon' ? clamp(c.t / 1) : clamp(c.t / 0.5); P.heat.push([u, v, c.kind === 'momDragon' ? 0.34 : 0.26, k]); } break; }
        case 'scrVortex': { P.active = true; const k = c.k || 0; if (k > vort) { vort = k; vc = c; vin = !!c.inward; } break; }
        case 'sk': case 'skU': P.active = true; skN++; break; // (ordinary skill pieces: a light activation, see P.light below)
        case 'scrBurst': case 'scrSlash': case 'scrBolt': case 'scrFin': P.active = true; break;
        case 'scrTitle': case 'scrKanji': case 'scrSfx': case 'momTen': case 'momSplit': P.active = true; break;
      }
    }
    P.light = P.active && !scene && !vc && impact <= 0 && dive <= 0 && !imp && !P.shock.length && !P.heat.length; // only skill pieces (no ult / finisher moment): run at a reduced copy resolution
    impact = fin(impact); dive = fin(dive); vort = fin(vort); bars = fin(bars);
    if (rf) { impact = Math.min(impact, IMPACT_CAP_RF); dive = Math.min(dive, IMPACT_CAP_RF); vort = Math.min(vort, IMPACT_CAP_RF * 2); }
    const g = scene && GRADE[scene];
    if (g) { P.tint = g; P.tintAmt = 0.36 * bars; P.sat = 1.03 + 0.1 * bars; P.contrast = 1.03 + 0.07 * bars; P.vig = 0.22 + 0.14 * bars; P.scan = 0.012 + 0.014 * bars; }
    P.bloom = 0.3 + 0.55 * impact + 0.22 * bars + 0.2 * dive;
    P.thr = 0.62 - 0.12 * bars;
    P.ca = 0.0014 + 0.012 * impact + 0.0025 * clamp(fin(fx.trauma)) + 0.003 * dive;
    const cen = imp ? uvOf(imp.x, imp.y) : diveAt ? uvOf(diveAt.x, diveAt.y) : [0.5, 0.5];
    P.rb = [cen[0], cen[1], 0.11 * impact + 0.035 * dive];
    if (vc) { const [u, v] = uvOf(vc.x, vc.y); P.swirl = [u, v, (vin ? -1 : 1) * (vin ? 2.4 : 0.9) * vort, 0.6]; P.bloom += (vin ? 0.15 : 0.05) * vort; P.thr += (vin ? 0 : 0.14) * vort; P.rb = [u, v, P.rb[2] + (vin ? 0.07 : 0.03) * vort]; P.ca += 0.004 * vort;  }
    if (skN) P.bloom += Math.min(0.2, 0.04 * skN);
    P.grain = 0.03 + 0.015 * bars;
    P.dof = 0.45 + 0.4 * bars;
    P.gr = [cen[0], cen[1], 0.7 * impact + 0.12 * bars + 0.1 * vort];
    if (rf) P.bloom = Math.min(P.bloom, 0.3 + 0.22 * bars + IMPACT_CAP_RF); // Reduce screen flashes: the impact boost on top of the grade stays under ~0.2
    // NaN guards: one bad coordinate must never reach a uniform (it would blank the whole frame)
    for (const k of ['ca', 'bloom', 'thr', 'tintAmt', 'sat', 'contrast', 'vig', 'grain', 'scan', 'dof']) P[k] = fin(P[k], 0);
    for (const k of ['rb', 'gr', 'tint', 'swirl']) if (P[k]) P[k] = P[k].map((v) => fin(v, 0));
    P.shock = P.shock.map((a) => a.map((v) => fin(v, 0))); P.heat = P.heat.map((a) => a.map((v) => fin(v, 0)));
    return P;
  }

  /** Run the pass chain on the finished world frame and copy the result back onto the 2D canvas. */
  apply(ctx, rend, fx) {
    const mode = this.mode = this.getMode();
    const q = Number.isFinite(fx.qLevel) ? fx.qLevel : (fx.partMul !== undefined && fx.partMul < 1 ? 1 : 0); // governor level (perf.js applyQuality)
    if (mode === 'off' || vfxPref.cine === false || q > MOMENT_MAX_Q) { this.mix = 0; return; } // (Ult cinematics off: no shader)
    if (!this.tried) this.init();
    if (!this.ok || this.lost || (this.gl && this.gl.isContextLost && this.gl.isContextLost())) return;
    if (this.soft && !this.explicit()) { this.mix = 0; return; } // perf (world 2): software GL (SwiftShader / llvmpipe): the GPU readback alone is ~10-15 ms a frame, so the default 'moments' stays off there (an explicit choice in Options still runs it)
    const P = this.params(fx, rend), now = fin(rend.time, 0), dt = Math.min(0.1, Math.max(0, fin(now - this.last, 0))); this.last = now;
    const always = mode === 'always' && q === 0 && !this.alwaysOff; // 'always' only at full quality; lower levels behave like 'moments'
    const target = always || (P.active && !P.light) ? 1 : 0; // perf (world 2): ordinary skill pieces no longer wake the layer in 'moments' (its fixed GPU readback cost ~10-15 ms in software raster made every big fight miss 60 fps); finishers / ults still do
    this.mix += (target - this.mix) * Math.min(1, dt * (target ? 7 : 4));
    if (!(this.mix >= 0.01)) { this.mix = 0; return; }
    const src = ctx.canvas, SW = src.width, SH = src.height;
    if (!SW || !SH) return;
    // the copy resolution: full on q0 during a moment, less on lower levels, half for the idle 'always' grade; the governor may halve it more (shed)
    // perf (world 2): skill-only activations in big fights copy at LIGHT_SCALE (bloom on skills reads the same at a quarter of the pixels)
    const sc = this.scale = Math.max(0.25, Math.min(P.active && !P.light ? MOMENT_SCALE[q] : P.light ? LIGHT_SCALE : ALWAYS_IDLE_SCALE, MOMENT_SCALE[q]) * this.shedK);
    const W = Math.max(2, Math.round(SW * sc)), H = Math.max(2, Math.round(SH * sc));
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    let up = src;
    if (sc < 1) { // downscale on the 2D side first (a GPU blit in Chrome) so the upload and the copy back move 1/4 or 1/16 of the pixels
      if (!this.small) this.small = document.createElement('canvas');
      if (this.small.width !== W || this.small.height !== H) { this.small.width = W; this.small.height = H; }
      const sx = this.small.getContext('2d'); sx.imageSmoothingEnabled = true; sx.drawImage(src, 0, 0, W, H); up = this.small;
    }
    const gl = this.gl, Pr = this.P, qw = Math.max(2, W >> 2), qh = Math.max(2, H >> 2);
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
    this.size(this.T.A, W, H); this.size(this.T.B, qw, qh); this.size(this.T.C, qw, qh); this.size(this.T.D, qw, qh); this.size(this.T.E, qw, qh);
    gl.disable(gl.BLEND);
    // upload the 2D frame (flipped so uv.y runs bottom-up, matching the final drawImage)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, up); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const draw = (T, w, h) => { gl.bindFramebuffer(gl.FRAMEBUFFER, T ? T.f : null); gl.viewport(0, 0, w, h); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    const bind = (unit, tex) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); };
    const m = this.mix, time = now;
    // 1. distort
    let p = Pr.distort; gl.useProgram(p.p); bind(0, this.src); gl.uniform1i(p.u.tex, 0); gl.uniform2f(p.u.res, W, H); gl.uniform1f(p.u.time, time);
    const sh = new Float32Array(16), ht = new Float32Array(12);
    P.shock.forEach((s, i) => { sh.set([s[0], s[1], s[2], s[3] * m], i * 4); }); P.heat.forEach((h, i) => { ht.set([h[0], h[1], h[2], h[3] * m], i * 4); });
    gl.uniform4fv(p.u.shock, sh); gl.uniform4fv(p.u.heat, ht); gl.uniform3f(p.u.rb, P.rb[0], P.rb[1], P.rb[2] * m); gl.uniform1f(p.u.ca, P.ca * m);
    const sw = P.swirl || [0.5, 0.5, 0, 1]; gl.uniform4f(p.u.swirl, sw[0], sw[1], sw[2] * m, sw[3]);
    draw(this.T.A, W, H);
    // 2a. a soft copy of the whole scene (for the tilt-shift focus falloff)
    p = Pr.extract; gl.useProgram(p.p); bind(0, this.T.A.t); gl.uniform1i(p.u.tex, 0); gl.uniform1f(p.u.thr, -1); draw(this.T.D, qw, qh);
    p = Pr.blur; gl.useProgram(p.p); gl.uniform1i(p.u.tex, 0);
    for (const [from, to, hz] of [[this.T.D, this.T.E, 1], [this.T.E, this.T.D, 0], [this.T.D, this.T.E, 1], [this.T.E, this.T.D, 0]]) { bind(0, from.t); gl.uniform2f(p.u.dir, hz ? 1.6 / qw : 0, hz ? 0 : 1.6 / qh); draw(to, qw, qh); }
    // 2b. bright extract to the quarter target
    p = Pr.extract; gl.useProgram(p.p); bind(0, this.T.A.t); gl.uniform1i(p.u.tex, 0); gl.uniform1f(p.u.thr, P.thr); draw(this.T.B, qw, qh);
    // 3-6. two separable blur rounds, the second one wider
    p = Pr.blur; gl.useProgram(p.p); gl.uniform1i(p.u.tex, 0);
    for (const [s, from, to] of [[1.2, this.T.B, this.T.C], [1.2, this.T.C, this.T.B], [2.4, this.T.B, this.T.C], [2.4, this.T.C, this.T.B]]) {
      const horiz = from === this.T.B ? 1 : 0; bind(0, from.t);
      gl.uniform2f(p.u.dir, horiz ? s / qw : 0, horiz ? 0 : s / qh); draw(to, qw, qh);
    }
    // 7. composite to the shader canvas
    p = Pr.comp; gl.useProgram(p.p); bind(0, this.T.A.t); bind(1, this.T.B.t); bind(2, this.T.D.t); gl.uniform1i(p.u.tex, 0); gl.uniform1i(p.u.bloom, 1); gl.uniform1i(p.u.soft, 2); gl.uniform1f(p.u.dof, P.dof * m); gl.uniform3f(p.u.gr, P.gr[0], P.gr[1], P.gr[2] * m);
    gl.uniform2f(p.u.res, W, H); gl.uniform1f(p.u.time, time); gl.uniform1f(p.u.bloomAmt, P.bloom); gl.uniform3fv(p.u.tint, P.tint); gl.uniform1f(p.u.tintAmt, P.tintAmt);
    gl.uniform1f(p.u.sat, P.sat); gl.uniform1f(p.u.contrast, P.contrast); gl.uniform1f(p.u.vig, P.vig); gl.uniform1f(p.u.grain, P.grain); gl.uniform1f(p.u.scan, P.scan); gl.uniform1f(p.u.mixk, m);
    draw(null, W, H);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'copy'; ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true; ctx.drawImage(this.cv, 0, 0, W, H, 0, 0, SW, SH); ctx.restore();
    this.stats.frames++; this.stats.lastMs = t0 ? performance.now() - t0 : 0;
  }
}
