// WebGL rebuild, Part A1 (2026-10-09): the GL world layer. An offscreen-styled WebGL2 canvas (hidden, next to the game
// canvas) renders the systems that moved to GL; the frame is composited into the 2D canvas at that layer's place, so
// every overlay above still blends with the real pixels (a stacked layer broke 'lighter' / 'multiply' over the ground).
// Part B moves the layers above onto GL too; then the stack flips and the 2D canvas carries only what is left. Canvas2D is the permanent fallback: no WebGL2,
// a lost context, or a system toggle off -> that system draws on the 2D canvas exactly as before.
// Toggles: localStorage 'rb.gl' = {"world":true,...}, URL ?gl=world,sprites (or ?gl=off), window.__rbGL.set(k, v).
const KEY = 'rb.gl';
export const GL_SYSTEMS = ['world', 'shapes', 'mobs', 'fx']; // world: ground tiles (A1) · shapes: vector floors of the town / arenas through the GL ctx recorder (B1)
export const GL_DEFAULTS = { world: false, shapes: false, mobs: false, fx: false }; // (Do-it-all Part 5: mobs + fx measured under the 99.5% bar: see previews/webgl5/)
/** Options > Graphics > Renderer rows */
export const GL_INFO = {
  world: { label: 'WebGL ground', note: 'terrain tiles on the GPU; off = Canvas2D' },
  shapes: { label: 'WebGL town floor', note: 'the town floor vector art on the GPU (needs WebGL ground); off = Canvas2D' },
  mobs: { label: 'WebGL monsters', note: 'enemy bodies through the GL recorder, composited in draw order; off = Canvas2D' },
  fx: { label: 'WebGL effects', note: 'particles / rings / sparks through the GL recorder; off = Canvas2D' },
};
let SUP;
export function glSupported() { if (SUP !== undefined) return SUP; try { SUP = typeof document !== 'undefined' && !!document.createElement('canvas').getContext('webgl2'); } catch { SUP = false; } return SUP; } // (Part A: the ground passes the diff but the composite costs more than it saves until Part B moves the layers above)
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
export const glPref = {
  v: { ...GL_DEFAULTS, ...(typeof localStorage !== 'undefined' ? load() : {}) },
  on(k) { return !!this.v[k]; },
  set(k, on) { this.v[k] = !!on; try { localStorage.setItem(KEY, JSON.stringify(this.v)); } catch {} },
};
if (typeof location !== 'undefined') {
  const q = new URLSearchParams(location.search).get('gl');
  if (q != null) { for (const k of GL_SYSTEMS) glPref.v[k] = false; if (q !== 'off' && q !== '0') for (const k of q.split(',')) glPref.v[k] = true; }
}
if (typeof window !== 'undefined') window.__rbGL = glPref;

const VS = `#version 300 es
in vec2 p; in vec2 uv; uniform vec4 m; uniform vec2 res; out vec2 v;
void main() { vec2 d = p * m.x + m.yz; gl_Position = vec4(d.x / res.x * 2. - 1., 1. - d.y / res.y * 2., 0., 1.); v = uv; }`;
const FS = `#version 300 es
precision mediump float; in vec2 v; uniform sampler2D t; out vec4 o; void main() { o = texture(t, v); }`;

export class GLLayer {
  constructor(main, o = {}) {
    this.alpha = !!o.alpha; this.ok = false; this.main = main; this.tex = new Map(); this.frame = 0; this.used = false; this.uploads = 0;
    if (typeof document === 'undefined' || !main || !main.parentNode) return;
    const c = this.canvas = document.createElement('canvas'); c.id = o.id || 'gameGL';
    c.style.cssText = 'position:fixed;inset:0;display:block;pointer-events:none;visibility:hidden';
    main.parentNode.insertBefore(c, main);
    const gl = this.gl = c.getContext('webgl2', { alpha: this.alpha, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true, depth: false, stencil: true });
    if (!gl) return;
    c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.ok = false; this.tex.clear(); });
    c.addEventListener('webglcontextrestored', () => this.init());
    this.init();
  }
  init() {
    const gl = this.gl, sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const pr = this.pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { this.ok = false; return; }
    this.uM = gl.getUniformLocation(pr, 'm'); this.uRes = gl.getUniformLocation(pr, 'res');
    this.buf = gl.createBuffer(); this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    const P = gl.getAttribLocation(pr, 'p'), U = gl.getAttribLocation(pr, 'uv');
    gl.enableVertexAttribArray(P); gl.vertexAttribPointer(P, 2, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(U); gl.vertexAttribPointer(U, 2, gl.FLOAT, false, 16, 8);
    this.verts = new Float32Array(6 * 4 * 64); this.n = 0; this.cur = null;
    this.tex.clear(); this.ok = true;
  }
  /** start a frame: match the 2D canvas size; m = [scale, offX, offY] world -> device px (the 2D camera transform) */
  begin(m, bg = '#000') {
    const gl = this.gl, c = this.canvas, M = this.main;
    if (c.width !== M.width || c.height !== M.height) { c.width = M.width; c.height = M.height; }
    if (c.style.width !== M.style.width || c.style.height !== M.style.height) { c.style.width = M.style.width; c.style.height = M.style.height; }
    gl.viewport(0, 0, c.width, c.height); gl.clearColor(0, 0, 0, 1); gl.clearStencil(0); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.useProgram(this.pr); gl.bindVertexArray(this.vao); gl.uniform4f(this.uM, m[0], m[1], m[2], 0); gl.uniform2f(this.uRes, c.width, c.height);
    gl.disable(gl.BLEND); this.frame++; this.used = true; this.uploads = 0;
  }
  /** Part 5: an overlay frame (alpha layer): match the 2D canvas size, clear to transparent */
  beginOverlay() {
    const gl = this.gl, c = this.canvas, M = this.main;
    if (c.width !== M.width || c.height !== M.height) { c.width = M.width; c.height = M.height; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, c.width, c.height); gl.clearColor(0, 0, 0, 0); gl.clearStencil(0); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    this.frame++; this.used = true;
  }
  /** a texture for a source canvas (uploaded once; tiles are immutable once built) */
  texOf(src) {
    let e = this.tex.get(src);
    if (!e) {
      const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.tex.set(src, e = { t, f: 0 }); this.uploads++;
    }
    e.f = this.frame; return e.t;
  }
  /** a textured quad in world units (nearest sampled, opaque) */
  /** re-arm the quad program (after the GL ctx drew with its own) */
  useQuads() { const gl = this.gl; gl.useProgram(this.pr); gl.bindVertexArray(this.vao); gl.disable(gl.BLEND); gl.disable(gl.STENCIL_TEST); this.cur = null; }
  quad(src, x, y, w, h) {
    const t = this.texOf(src);
    if (t !== this.cur) { this.flush(); this.cur = t; }
    const v = this.verts, i = this.n * 24, x1 = x + w, y1 = y + h;
    v.set([x, y, 0, 0, x1, y, 1, 0, x, y1, 0, 1, x, y1, 0, 1, x1, y, 1, 0, x1, y1, 1, 1], i);
    if (++this.n === 64) this.flush();
  }
  flush() {
    if (!this.n) return; const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.cur); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.verts.subarray(0, this.n * 24), gl.STREAM_DRAW); gl.drawArrays(gl.TRIANGLES, 0, this.n * 6); this.n = 0;
  }
  /** end of frame: show the layer, free textures of tiles not drawn for ~4 s */
  end() {
    this.flush(); this.cur = null;
    if ((this.frame & 63) === 0) for (const [k, e] of this.tex) if (this.frame - e.f > 240) { this.gl.deleteTexture(e.t); this.tex.delete(k); }
  }
  /** a frame without GL content: hide the layer (the 2D canvas is opaque again) */
  idle() { if (this.used && this.canvas.style.visibility !== 'hidden') this.canvas.style.visibility = 'hidden'; this.used = false; }
}
