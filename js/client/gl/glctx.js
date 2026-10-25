// WebGL rebuild, Part B1 (2026-10-09): a Canvas2D-compatible recorder that draws vector art straight on the GL layer.
// The existing art functions run unchanged against it (no pose pre-rendering: paths are rebuilt every frame).
//   fill():   stencil-then-cover, nonzero winding (exact for any path, self-intersections and holes included)
//   stroke(): the stroke outline (segment quads + round joins / caps) into the stencil, one cover -> no double blending
//   paint:    solid colours, linear gradients, concentric radial gradients (in the cover shader, unpremultiplied
//             interpolation like Canvas2D), globalAlpha, 'source-over' / 'lighter'
//   AA:       the GL layer's multisampled framebuffer (MSAA) instead of Canvas2D's analytic coverage -> edge-only diffs
// Anything else (text, images, clip, dashes, patterns, two-centre radial gradients, other blend modes, shadows) marks the
// recording unsupported; the caller then draws that layer with Canvas2D for the frame (so nothing is ever missing).
const TAU = Math.PI * 2;
const VS = `#version 300 es
in vec2 p; uniform vec2 res; void main() { gl_Position = vec4(p.x / res.x * 2. - 1., 1. - p.y / res.y * 2., 0., 1.); }`;
const FS = `#version 300 es
precision highp float; uniform vec4 col; uniform int kind; uniform mat3 inv; uniform vec4 g; uniform vec2 gr; uniform int ns;
uniform vec4 sc[8]; uniform float so[8]; uniform float ga; uniform float ch; uniform sampler2D pt; uniform vec2 ps; uniform float fs; out vec4 o;
void main() {
  vec4 c = col;
  if (kind == 3) { vec2 q = (inv * vec3(floor(gl_FragCoord.x / fs) + .5, ch / fs - floor(gl_FragCoord.y / fs) - .5, 1.)).xy; o = texture(pt, q / ps) * ga; return; }
  if (kind > 0) {
    vec2 q = (inv * vec3(floor(gl_FragCoord.x / fs) + .5, ch / fs - floor(gl_FragCoord.y / fs) - .5, 1.)).xy; float t;
    if (kind == 1) { vec2 d = g.zw - g.xy; t = dot(q - g.xy, d) / max(1e-6, dot(d, d)); }
    else if (kind == 2) { t = (length(q - g.xy) - gr.x) / max(1e-6, gr.y - gr.x); }
    else { vec2 cd = g.zw - g.xy, pd = q - g.xy; float dr = gr.y - gr.x, A = dot(cd, cd) - dr * dr, B = dot(pd, cd) + gr.x * dr, C = dot(pd, pd) - gr.x * gr.x; // two-circle radial (the Canvas2D spec: the largest s with r(s) >= 0)
      if (abs(A) < 1e-6) { t = C / (2. * B); if (gr.x + t * dr < 0.) discard; }
      else { float D = B * B - A * C; if (D < 0.) discard; float sq = sqrt(D), s1 = (B + sq) / A, s0 = (B - sq) / A; t = max(s1, s0); if (gr.x + t * dr < 0.) { t = min(s1, s0); if (gr.x + t * dr < 0.) discard; } } }
    t = clamp(t, 0., 1.); c = sc[0];
    for (int i = 1; i < 8; i++) { if (i >= ns) break; if (t >= so[i - 1]) c = so[i] > so[i - 1] ? mix(sc[i - 1], sc[i], clamp((t - so[i - 1]) / (so[i] - so[i - 1]), 0., 1.)) : sc[i]; }
  }
  float a = c.a * ga; o = vec4(c.rgb * a, a);
}`;
let PARSE = null; const CCACHE = new Map();
// real Canvas2D patterns (some art caches one made on the 2D ctx): remember their source so the GL ctx can repeat it
const PAT = new WeakMap();
for (const C of [typeof CanvasRenderingContext2D !== 'undefined' && CanvasRenderingContext2D, typeof OffscreenCanvasRenderingContext2D !== 'undefined' && OffscreenCanvasRenderingContext2D]) {
  if (!C || C.prototype.__glPat) continue; C.prototype.__glPat = 1; const f = C.prototype.createPattern;
  C.prototype.createPattern = function (src, rep) { const p = f.call(this, src, rep); if (p) PAT.set(p, { pat: src, rep, bad: !(rep == null || rep === '' || rep === 'repeat') }); return p; };
}
if (typeof CanvasPattern !== 'undefined' && CanvasPattern.prototype.setTransform) { const st = CanvasPattern.prototype.setTransform; CanvasPattern.prototype.setTransform = function (m) { const e = PAT.get(this); if (e) e.bad = true; return st.call(this, m); }; }
function parseColor(v) {
  let c = CCACHE.get(v); if (c) return c;
  if (!PARSE) { const k = document.createElement('canvas'); k.width = k.height = 1; PARSE = k.getContext('2d', { willReadFrequently: true }); }
  PARSE.fillStyle = '#000'; PARSE.fillStyle = v; const s = PARSE.fillStyle;
  if (s[0] === '#') c = [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255, 1];
  else { const m = s.match(/[\d.]+/g).map(Number); c = [m[0] / 255, m[1] / 255, m[2] / 255, m.length > 3 ? m[3] : 1]; }
  if (CCACHE.size > 4000) CCACHE.clear(); CCACHE.set(v, c); return c;
}
class Grad { constructor(kind, a) { this.kind = kind; this.a = a; this.stops = []; } addColorStop(o, c) { this.stops.push([+o, parseColor(c)]); this.stops.sort((x, y) => x[0] - y[0]); } }

export class GLCtx {
  constructor(layer) {
    this.L = layer; const gl = this.gl = layer.gl;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const pr = this.pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    this.ok = !!gl.getProgramParameter(pr, gl.LINK_STATUS);
    const U = (n) => gl.getUniformLocation(pr, n); this.u = { res: U('res'), col: U('col'), kind: U('kind'), inv: U('inv'), g: U('g'), gr: U('gr'), ns: U('ns'), sc: U('sc'), so: U('so'), ga: U('ga'), ch: U('ch'), pt: U('pt'), ps: U('ps'), fs: U('fs') };
    this.buf = gl.createBuffer(); this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    const P = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(P); gl.vertexAttribPointer(P, 2, gl.FLOAT, false, 8, 0);
    this.v = new Float32Array(1 << 16); this.n = 0; this.fsc = 1; this.canvas = layer.canvas;
    this.reset();
  }
  reset() {
    this.m = [1, 0, 0, 1, 0, 0]; this.stack = []; this.path = []; this.q = []; this.clips = []; this.dash = null; this.cur = null; this.unsupported = 0; this.why = '';
    this.fillStyle = '#000'; this.strokeStyle = '#000'; this.lineWidth = 1; this.globalAlpha = 1; this.globalCompositeOperation = 'source-over';
    this.lineCap = 'butt'; this.lineJoin = 'miter'; this.font = '10px sans-serif'; this.textAlign = 'start'; this.textBaseline = 'alphabetic'; this.miterLimit = 10;
    this.imageSmoothingEnabled = true; this.shadowBlur = 0; this.shadowColor = 'rgba(0,0,0,0)'; this.filter = 'none'; this.lineDashOffset = 0;
  }
  no(why) { this.unsupported++; if (!this.why) { this.why = why; if (globalThis.__rbGLDebug) this.whyAt = new Error().stack.split('\n').slice(3, 7).map((x) => x.trim().replace(/\(?http:\/\/[^/]+/, '')).join(' < '); } }
  // ---- state
  save() { this.stack.push([this.dash, this.clips, this.m.slice(), this.fillStyle, this.strokeStyle, this.lineWidth, this.globalAlpha, this.globalCompositeOperation, this.lineCap, this.lineJoin, this.font, this.textAlign, this.textBaseline]); }
  restore() { const s = this.stack.pop(); if (!s) return; const c0 = this.clips; [this.dash, this.clips, this.m, this.fillStyle, this.strokeStyle, this.lineWidth, this.globalAlpha, this.globalCompositeOperation, this.lineCap, this.lineJoin, this.font, this.textAlign, this.textBaseline] = s; if (this.clips !== c0) this.q.push({ clipSet: this.clips }); }
  setTransform(a, b, c, d, e, f) { if (typeof a === 'object') ({ a, b, c, d, e, f } = a); this.m = [a, b, c, d, e, f]; }
  resetTransform() { this.m = [1, 0, 0, 1, 0, 0]; }
  getTransform() { const [a, b, c, d, e, f] = this.m; return new DOMMatrix([a, b, c, d, e, f]); }
  transform(a, b, c, d, e, f) { const m = this.m; this.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; }
  translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
  scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
  rotate(a) { const c = Math.cos(a), s = Math.sin(a); this.transform(c, s, -s, c, 0, 0); }
  // ---- paths (stored in LOCAL space with the matrix at each point -> device space at add time, like Canvas2D)
  P(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  sc() { const m = this.m; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1; }
  beginPath() { this.path = []; this.cur = null; this.lx = this.ly = undefined; }
  moveTo(x, y) { this.cur = [this.P(x, y)]; this.cur.closed = false; this.path.push(this.cur); this.lx = x; this.ly = y; this.sx = x; this.sy = y; this.cur.lw = []; }
  lineTo(x, y) { if (!this.cur) return this.moveTo(x, y); this.cur.push(this.P(x, y)); this.lx = x; this.ly = y; }
  closePath() { if (this.cur && this.cur.length) { this.cur.closed = true; const s = this.cur; this.moveTo(this.sx, this.sy); this.path.pop(); this.cur = s; this.cur.closed = true; this.cur = null; this.lx = this.sx; this.ly = this.sy; this._reopen = true; } }
  _ens(x, y) { if (!this.cur) { if (this._reopen && this.lx !== undefined) { this.moveTo(this.lx, this.ly); this._reopen = false; } else this.moveTo(x, y); } }
  steps(len) { return Math.max(2, Math.min(512, Math.ceil(Math.sqrt(len * this.sc()) * 4))); }
  quadraticCurveTo(cx, cy, x, y) { this._ens(cx, cy); const x0 = this.lx, y0 = this.ly, n = this.steps(Math.hypot(cx - x0, cy - y0) + Math.hypot(x - cx, y - cy)); for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; this.cur.push(this.P(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y)); } this.lx = x; this.ly = y; }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) { this._ens(c1x, c1y); const x0 = this.lx, y0 = this.ly, n = this.steps(Math.hypot(c1x - x0, c1y - y0) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(x - c2x, y - c2y)); for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; this.cur.push(this.P(u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x, u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y)); } this.lx = x; this.ly = y; }
  ellipse(x, y, rx, ry, rot, a0, a1, ccw = false) {
    if (rx < 0 || ry < 0) return; let d = a1 - a0;
    if (!ccw) { if (d >= TAU) d = TAU; else { d %= TAU; if (d < 0) d += TAU; } } else { if (-d >= TAU) d = -TAU; else { d %= TAU; if (d > 0) d -= TAU; } }
    const rp = Math.max(rx, ry) * this.sc(), n = Math.max(2, Math.min(1024, Math.ceil(Math.abs(d) / (2 * Math.acos(Math.max(-1, 1 - 0.04 / Math.max(rp, 0.05))))))); /* (chord sagitta <= 0.04 px) */ const cr = Math.cos(rot), sr = Math.sin(rot);
    for (let i = 0; i <= n; i++) { const a = a0 + d * i / n, px = Math.cos(a) * rx, py = Math.sin(a) * ry, X = x + px * cr - py * sr, Y = y + px * sr + py * cr; if (i === 0) { if (!this.cur) this.moveTo(X, Y); else this.lineTo(X, Y); } else this.lineTo(X, Y); }
  }
  arc(x, y, r, a0, a1, ccw = false) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); }
  arcTo(x1, y1, x2, y2, r) {
    this._ens(x1, y1); const x0 = this.lx, y0 = this.ly;
    const ax = x0 - x1, ay = y0 - y1, bx = x2 - x1, by = y2 - y1, la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (!r || la < 1e-9 || lb < 1e-9) return this.lineTo(x1, y1);
    const cos = (ax * bx + ay * by) / (la * lb), ang = Math.acos(Math.max(-1, Math.min(1, cos)));
    if (Math.abs(Math.sin(ang)) < 1e-9) return this.lineTo(x1, y1);
    const t = r / Math.tan(ang / 2), px = x1 + ax / la * t, py = y1 + ay / la * t, qx = x1 + bx / lb * t, qy = y1 + by / lb * t;
    const cr = ax / la * by / lb - ay / la * bx / lb; // which side
    const nx = (ax / la + bx / lb), ny = (ay / la + by / lb), nl = Math.hypot(nx, ny), dc = r / Math.sin(ang / 2), cx = x1 + nx / nl * dc, cy = y1 + ny / nl * dc;
    this.lineTo(px, py); this.arc(cx, cy, r, Math.atan2(py - cy, px - cx), Math.atan2(qy - cy, qx - cx), cr > 0);
  }
  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  roundRect(x, y, w, h, r = 0) { r = Math.min(typeof r === 'number' ? r : (r[0] || 0), Math.abs(w) / 2, Math.abs(h) / 2); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); }
  // ---- paint objects
  createLinearGradient(x0, y0, x1, y1) { return new Grad(1, [x0, y0, x1, y1, this.m.slice()]); }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { const g = new Grad(x0 !== x1 || y0 !== y1 ? 4 : 2, [x0, y0, r0, x1, y1, r1]); if (r0 < 0 || r1 < 0) g.bad = 1; return g; }
  createConicGradient() { const g = new Grad(3, []); g.bad = 1; return g; }
  createPattern(src, rep) { if (!src || (rep && rep !== 'repeat') || !src.width) return { bad: 1 }; return { pat: src }; }
  // ---- unsupported -> the caller falls back to Canvas2D for this layer this frame
  clip(a) {
    if (a && typeof a === 'object') { this.no('path2d'); return; } if ((a) === 'evenodd') { this.no('evenodd'); return; }
    const t = this.fan(); if (!t) { this.no('big'); return; }
    this.clips = [...this.clips, t]; this.q.push({ clipSet: this.clips });
  }
  /** the current path as a triangle fan per subpath (for nonzero stencil fills) */
  fan() { const out = []; for (const sp of this.path) { if (sp.length < 3) continue; const o = sp[0]; for (let i = 1; i + 1 < sp.length; i++) { const p = sp[i], q = sp[i + 1]; out.push(o[0], o[1], p[0], p[1], q[0], q[1]); } } return out.length > 4e6 ? null : new Float32Array(out); } setLineDash(d) { this.dash = d && d.length ? (d.length % 2 ? [...d, ...d] : d.slice()) : null; } getLineDash() { return this.dash ? this.dash.slice() : []; }
  drawImage(src, ...a) {
    if (!src || !(src.width > 0) || typeof src.getContext !== 'function' && !(typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement) && !(typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap)) { this.no('drawImage:src'); return; }
    if (src === this.L.main) { this.no('drawImage:self'); return; }
    if (src.__dyn) { this.no('drawImage:dynamic'); return; } // (a per-frame buffer: textures are cached as immutable)
    this.checkState(); if (this.unsupported) return;
    let sx = 0, sy = 0, sw = src.width, sh = src.height, dx, dy, dw, dh;
    if (a.length === 2) { [dx, dy] = a; dw = sw; dh = sh; } else if (a.length === 4) [dx, dy, dw, dh] = a; else [sx, sy, sw, sh, dx, dy, dw, dh] = a;
    const P = (x, y) => this.P(x, y), p0 = P(dx, dy), p1 = P(dx + dw, dy), p2 = P(dx, dy + dh), p3 = P(dx + dw, dy + dh);
    const W = src.width, H = src.height, u0 = sx / W, v0 = sy / H, u1 = (sx + sw) / W, v1 = (sy + sh) / H;
    this.q.push({ img: { src, d: new Float32Array([p0[0], p0[1], u0, v0, p1[0], p1[1], u1, v0, p2[0], p2[1], u0, v1, p2[0], p2[1], u0, v1, p1[0], p1[1], u1, v0, p3[0], p3[1], u1, v1]) }, ga: this.globalAlpha, op: this.globalCompositeOperation, sm: this.imageSmoothingEnabled });
  }
  /** textures: sources are treated as immutable once seen (cached sprites / baked tiles); repeat textures for patterns */
  texRep(src, sm) { const T = this.rep || (this.rep = new Map()); let t = T.get(src); const gl = this.gl;
    if (!t) { t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); T.set(src, t); if (T.size > 64) { const k = T.keys().next().value; gl.deleteTexture(T.get(k)); T.delete(k); } }
    gl.bindTexture(gl.TEXTURE_2D, t); const f = sm ? gl.LINEAR : gl.NEAREST; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f); return t; }
  runImg(img, ga, op, sm) {
    const gl = this.gl, L = this.L;
    if (!this.ip) { const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
      const pr = this.ip = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, `#version 300 es
in vec2 p; in vec2 uv; uniform vec2 res; out vec2 v; void main() { gl_Position = vec4(p.x / res.x * 2. - 1., 1. - p.y / res.y * 2., 0., 1.); v = uv; }`)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, `#version 300 es
precision mediump float; in vec2 v; uniform sampler2D t; uniform float ga; out vec4 o; void main() { o = texture(t, v) * ga; }`)); gl.linkProgram(pr);
      this.iu = { res: gl.getUniformLocation(pr, 'res'), ga: gl.getUniformLocation(pr, 'ga'), t: gl.getUniformLocation(pr, 't') };
      this.ivao = gl.createVertexArray(); gl.bindVertexArray(this.ivao); this.ibuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.ibuf);
      const P = gl.getAttribLocation(pr, 'p'), U = gl.getAttribLocation(pr, 'uv'); gl.enableVertexAttribArray(P); gl.vertexAttribPointer(P, 2, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(U); gl.vertexAttribPointer(U, 2, gl.FLOAT, false, 16, 8); }
    gl.useProgram(this.ip); gl.bindVertexArray(this.ivao); gl.bindBuffer(gl.ARRAY_BUFFER, this.ibuf); gl.uniform2f(this.iu.res, L.canvas.width, L.canvas.height); gl.uniform1f(this.iu.ga, Math.max(0, Math.min(1, ga)));
    gl.activeTexture(gl.TEXTURE0); const t = img.tex || L.texOf(img.src); gl.bindTexture(gl.TEXTURE_2D, t); const f = sm ? gl.LINEAR : gl.NEAREST; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f); gl.uniform1i(this.iu.t, 0);
    if (this.clipOn) { gl.enable(gl.STENCIL_TEST); gl.stencilMask(0); gl.stencilFunc(gl.EQUAL, 0x80, 0x80); } else gl.disable(gl.STENCIL_TEST); gl.enable(gl.BLEND); if (op === 'lighter') gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bufferData(gl.ARRAY_BUFFER, img.d, gl.STREAM_DRAW); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.stencilMask(0xff); gl.disable(gl.STENCIL_TEST);
  } fillText() { this.no('text'); } strokeText() { this.no('text'); } measureText(s) { return { width: String(s).length * 6 }; }
  getImageData() { this.no('readback'); return { data: new Uint8ClampedArray(4) }; } putImageData() { this.no('putImageData'); }
  isPointInPath() { return false; } clearRect() { this.no('clearRect'); }
  // ---- drawing
  fillRect(x, y, w, h) { const p = this.path, c = this.cur; this.beginPath(); this.rect(x, y, w, h); this.fill(); this.path = p; this.cur = c; }
  strokeRect(x, y, w, h) { const p = this.path, c = this.cur; this.beginPath(); this.rect(x, y, w, h); this.stroke(); this.path = p; this.cur = c; }
  checkState() {
    if (this.shadowBlur > 0 && this.shadowColor && !/,\s*0\)$|transparent/.test(this.shadowColor)) this.no('shadow');
    if (this.filter && this.filter !== 'none') this.no('filter');
    const op = this.globalCompositeOperation; if (op !== 'source-over' && op !== 'lighter') this.no('blend:' + op);
  }
  fill(a, b) {
    if (a && typeof a === 'object') { this.no('path2d'); return; } if ((b || a) === 'evenodd') { this.no('evenodd'); return; }
    this.checkState(); if (this.unsupported) return;
    const v = this.v; let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const sp of this.path) { if (sp.length < 3) continue; const o = sp[0];
      for (let i = 1; i + 1 < sp.length; i++) { const p = sp[i], q = sp[i + 1]; if (n + 6 > v.length) { this.no('big'); return; } v[n++] = o[0]; v[n++] = o[1]; v[n++] = p[0]; v[n++] = p[1]; v[n++] = q[0]; v[n++] = q[1]; }
      for (const p of sp) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } }
    if (n) this.draw(n, [x0, y0, x1, y1], this.fillStyle);
  }
  stroke(a) {
    if (a && typeof a === 'object') { this.no('path2d'); return; }
    this.checkState(); if (this.unsupported) return;
    const v = this.v; let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const m = this.m, sc = this.sc(), hw = Math.max(0.5, this.lineWidth * sc / 2); // (device px; uniform-ish transforms in the art)
    const disc = (cx, cy) => { const k = Math.max(8, Math.min(48, Math.ceil(hw * 1.6))); for (let i = 0; i < k; i++) { const a0 = i / k * TAU, a1 = (i + 1) / k * TAU; v[n++] = cx; v[n++] = cy; v[n++] = cx + Math.cos(a0) * hw; v[n++] = cy + Math.sin(a0) * hw; v[n++] = cx + Math.cos(a1) * hw; v[n++] = cy + Math.sin(a1) * hw; } };
    const round = this.lineJoin === 'round', capR = this.lineCap === 'round', capS = this.lineCap === 'square';
    let paths = this.path;
    if (this.dash && this.dash.some((x) => x > 0)) { // split each subpath into dash pieces (lengths in user units -> device px)
      const D = this.dash.map((x) => Math.max(0, x * sc)), tot = D.reduce((a, b) => a + b, 0); paths = [];
      for (const sp of this.path) {
        const pts = sp.closed ? [...sp, sp[0]] : sp; let k = 0, left = 0, on = true, ofs = ((this.lineDashOffset * sc) % tot + tot) % tot;
        while (ofs > 0) { if (ofs >= D[k]) { ofs -= D[k]; k = (k + 1) % D.length; on = !on; } else { left = D[k] - ofs; ofs = 0; } } if (!left) left = D[k];
        let cur = on ? [pts[0]] : null;
        for (let i = 0; i + 1 < pts.length; i++) {
          let [ax, ay] = pts[i]; const [bx, by] = pts[i + 1]; let l = Math.hypot(bx - ax, by - ay);
          while (l > 0) {
            if (l < left) { left -= l; if (cur) cur.push([bx, by]); l = 0; }
            else { const f = left / l, x = ax + (bx - ax) * f, y = ay + (by - ay) * f; if (cur) { cur.push([x, y]); paths.push(cur); cur = null; } else cur = [[x, y]];
              ax = x; ay = y; l -= left; k = (k + 1) % D.length; left = D[k] || 1e-3; on = !on; if (!on) cur = null; }
          }
        }
        if (cur && cur.length > 1) paths.push(cur);
      }
    }
    for (const sp0 of paths) {
      const sp = sp0.length > 1 || capR ? sp0 : null; if (!sp || !sp.length) continue;
      const L = sp.length, closed = sp.closed;
      const segs = closed ? L : L - 1;
      for (let i = 0; i < segs; i++) {
        if (n + 2000 > v.length) { this.no('big'); return; }
        let [ax, ay] = sp[i], [bx, by] = sp[(i + 1) % L]; let dx = bx - ax, dy = by - ay; const l = Math.hypot(dx, dy); if (l < 1e-6) continue; dx /= l; dy /= l;
        if (!closed && capS) { if (i === 0) { ax -= dx * hw; ay -= dy * hw; } if (i === segs - 1) { bx += dx * hw; by += dy * hw; } }
        const nx = -dy * hw, ny = dx * hw;
        v[n++] = ax + nx; v[n++] = ay + ny; v[n++] = bx + nx; v[n++] = by + ny; v[n++] = bx - nx; v[n++] = by - ny;
        v[n++] = ax + nx; v[n++] = ay + ny; v[n++] = bx - nx; v[n++] = by - ny; v[n++] = ax - nx; v[n++] = ay - ny;
      }
      for (let i = 0; i < L; i++) {
        const end = !closed && (i === 0 || i === L - 1), P = sp[i];
        if (end) { if (capR) disc(P[0], P[1]); continue; }
        if (round) { disc(P[0], P[1]); continue; }
        // miter / bevel: the wedge on the outer side of the turn
        const A = sp[(i - 1 + L) % L], B = sp[(i + 1) % L];
        let ux = P[0] - A[0], uy = P[1] - A[1], wx = B[0] - P[0], wy = B[1] - P[1]; const lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy); if (lu < 1e-6 || lw < 1e-6) continue;
        ux /= lu; uy /= lu; wx /= lw; wy /= lw; const cr = ux * wy - uy * wx; if (Math.abs(cr) < 1e-9) continue;
        const sgn = cr > 0 ? -1 : 1, ax = P[0] + -uy * hw * sgn, ay = P[1] + ux * hw * sgn, bx = P[0] + -wy * hw * sgn, by = P[1] + wx * hw * sgn;
        v[n++] = P[0]; v[n++] = P[1]; v[n++] = ax; v[n++] = ay; v[n++] = bx; v[n++] = by;
        if (this.lineJoin === 'miter') { const cosT = ux * wx + uy * wy, ml = 1 / Math.sqrt(Math.max(1e-9, (1 + cosT) / 2)); // miter length / half width
          if (ml <= this.miterLimit) { const mx = (-uy - wy) * sgn, my = (ux + wx) * sgn, mlen = Math.hypot(mx, my) || 1, px = P[0] + mx / mlen * hw * ml, py = P[1] + my / mlen * hw * ml;
            v[n++] = ax; v[n++] = ay; v[n++] = px; v[n++] = py; v[n++] = bx; v[n++] = by; } }
      }
      for (const p of sp) { if (p[0] - hw < x0) x0 = p[0] - hw; if (p[0] + hw > x1) x1 = p[0] + hw; if (p[1] - hw < y0) y0 = p[1] - hw; if (p[1] + hw > y1) y1 = p[1] + hw; }
    }
    if (n) { this.draw(n, [x0, y0, x1, y1], this.strokeStyle); const c = this.q[this.q.length - 1]; if (c) c.any = 1; } // (stroke: union coverage, not winding)
  }
  /** queue a shape (nothing touches GL until exec(): an unsupported call later in the layer must leave no trace) */
  draw(n, bb, style) {
    let col = null, gr = null;
    if (style && typeof CanvasPattern !== 'undefined' && style instanceof CanvasPattern) { const e = PAT.get(style); if (!e || e.bad) { this.no('pattern'); return; } style = e; }
    if (typeof style === 'string') col = parseColor(style); else if (style && style.pat) gr = style; else if (style && style.bad) { this.no('pattern'); return; } else if (style instanceof Grad) { if (style.bad || !style.stops.length) { this.no('gradient'); return; } gr = style; } else { this.no('paint'); return; }
    this.q.push({ v: this.v.slice(0, n), bb, col, gr, ga: this.globalAlpha, op: this.globalCompositeOperation, M: this.m.slice(), sm: this.imageSmoothingEnabled });
  }
  /** run the queue. ss = 2: into a 2x, 4x-MSAA transparent buffer (16 coverage samples, closer to Canvas2D's analytic AA),
   *  then box-filtered down over the layer (source-over only: a queue with 'lighter' draws direct) */
  exec(ss = globalThis.__rbGLSS || 2) {
    const gl = this.gl, L = this.L, W = L.canvas.width, H = L.canvas.height;
    const can = ss > 1 && this.ensureSS(W * ss, H * ss); let mode = null, chain = []; this.ssUsed = false;
    const close = () => {
      if (this.clipOn) this.setClip([]);
      if (mode === 'ss') {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.ms); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.rs); gl.blitFramebuffer(0, 0, W * ss, H * ss, 0, 0, W * ss, H * ss, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); this.fsc = 1;
        this.runImg({ tex: this.rsTex, d: new Float32Array([0, 0, 0, 1, W, 0, 1, 1, 0, H, 0, 0, 0, H, 0, 0, W, 0, 1, 1, W, H, 1, 0]) }, 1, 'source-over', true);
      }
      mode = null;
    };
    const open = (m) => {
      if (m === 'ss') { gl.bindFramebuffer(gl.FRAMEBUFFER, this.ms); gl.viewport(0, 0, W * ss, H * ss); gl.clearColor(0, 0, 0, 0); gl.clearStencil(0); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT); this.fsc = ss; this.ssUsed = true; }
      else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); this.fsc = 1; }
      mode = m; this.clipOn = false; if (chain.length) this.setClip(chain);
    };
    // (2x + 4x MSAA = 16 coverage samples, closer to Canvas2D's analytic AA; 'lighter' runs draw straight onto the layer)
    for (const c of this.q) {
      if (c.clipSet) { chain = c.clipSet; if (mode) this.setClip(chain); continue; }
      const want = can && c.op !== 'lighter' && !c.img ? 'ss' : 'direct'; // (images: 1x, sampled exactly like drawImage)
      if (mode !== want) { close(); open(want); }
      this.run(c);
    }
    close(); this.fsc = 1; const k = this.q.length; this.q = []; return k;
  }
  ensureSS(w, h) {
    const gl = this.gl; if (this.ssW === w && this.ssH === h) return true;
    try {
      if (this.ms) { gl.deleteFramebuffer(this.ms); gl.deleteFramebuffer(this.rs); gl.deleteRenderbuffer(this.msC); gl.deleteRenderbuffer(this.msS); gl.deleteTexture(this.rsTex); }
      const S = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
      this.ms = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.ms);
      this.msC = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.msC); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, S, gl.RGBA8, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.msC);
      this.msS = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.msS); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, S, gl.DEPTH24_STENCIL8, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.msS);
      const ok1 = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      this.rs = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.rs); this.rsTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.rsTex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.rsTex, 0);
      const ok2 = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!ok1 || !ok2) { this.ssW = -1; return false; }
      this.ssW = w; this.ssH = h; return true;
    } catch { gl.bindFramebuffer(gl.FRAMEBUFFER, null); return false; }
  }
  /** stencil bit 0x80 = inside the clip; bits 0x7f = the winding count of the shape being drawn */
  full(gl) { const W = this.L.canvas.width, H = this.L.canvas.height; gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, W, 0, 0, H, 0, H, W, 0, W, H]), gl.STREAM_DRAW); gl.drawArrays(gl.TRIANGLES, 0, 6); }
  setClip(chain) {
    const gl = this.gl, u = this.u; gl.useProgram(this.pr); gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.uniform2f(u.res, this.L.canvas.width, this.L.canvas.height);
    gl.enable(gl.STENCIL_TEST); gl.colorMask(false, false, false, false); gl.disable(gl.BLEND);
    gl.stencilMask(0x80); gl.stencilFunc(gl.ALWAYS, chain.length ? 0x80 : 0, 0xff); gl.stencilOp(gl.REPLACE, gl.REPLACE, gl.REPLACE); this.full(gl);
    for (const t of chain) {
      gl.stencilMask(0x7f); gl.stencilFunc(gl.EQUAL, 0x80, 0x80); gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP); gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP);
      gl.bufferData(gl.ARRAY_BUFFER, t, gl.STREAM_DRAW); gl.drawArrays(gl.TRIANGLES, 0, t.length / 2);
      gl.stencilMask(0x80); gl.stencilFunc(gl.EQUAL, 0x80, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO); this.full(gl); // in the old clip but outside this path -> out
      gl.stencilMask(0x7f); gl.stencilFunc(gl.ALWAYS, 0, 0xff); gl.stencilOp(gl.ZERO, gl.ZERO, gl.ZERO); this.full(gl);
    }
    gl.stencilMask(0xff); gl.colorMask(true, true, true, true); gl.disable(gl.STENCIL_TEST); this.clipOn = chain.length > 0;
  }
  run({ v, bb, col, gr, ga, op, M, sm, img, any }) {
    if (img) return this.runImg(img, ga, op, sm);
    const n = v.length;
    const gl = this.gl, u = this.u, L = this.L;
    gl.useProgram(this.pr); gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.uniform2f(u.res, L.canvas.width, L.canvas.height); gl.uniform1f(u.ch, L.canvas.height * this.fsc); gl.uniform1f(u.fs, this.fsc);
    // 1) stencil: nonzero winding
    gl.enable(gl.STENCIL_TEST); gl.colorMask(false, false, false, false); gl.disable(gl.BLEND);
    gl.stencilMask(0x7f); if (this.clipOn) gl.stencilFunc(gl.EQUAL, 0x80, 0x80); else gl.stencilFunc(gl.ALWAYS, 0, 0xff); gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP); gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, any ? gl.INCR_WRAP : gl.DECR_WRAP);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STREAM_DRAW); gl.uniform1i(u.kind, 0); gl.uniform4f(u.col, 0, 0, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, n / 2);
    // 2) cover the bounding box where stencil != 0, and clear it again
    gl.colorMask(true, true, true, true); if (this.clipOn) gl.stencilFunc(gl.LESS, 0x80, 0xff); else gl.stencilFunc(gl.NOTEQUAL, 0, 0x7f); gl.stencilOp(gl.ZERO, gl.ZERO, gl.ZERO); // (writemask 0x7f: the clip bit stays)
    gl.enable(gl.BLEND); if (op === 'lighter') gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1f(u.ga, Math.max(0, Math.min(1, ga)));
    if (col) { gl.uniform1i(u.kind, 0); gl.uniform4f(u.col, col[0], col[1], col[2], col[3]); }
    else {
      const det = M[0] * M[3] - M[1] * M[2]; // gradient / pattern space = the transform at fill time (as in Canvas2D)
      const ia = M[3] / det, ib = -M[1] / det, ic = -M[2] / det, id = M[0] / det, ie = -(ia * M[4] + ic * M[5]), iff = -(ib * M[4] + id * M[5]);
      gl.uniformMatrix3fv(u.inv, false, [ia, ib, 0, ic, id, 0, ie, iff, 1]);
      const a = gr.a || [];
      if (gr.pat) { gl.uniform1i(u.kind, 3); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texRep(gr.pat, sm)); gl.uniform1i(u.pt, 0); gl.uniform2f(u.ps, gr.pat.width, gr.pat.height); }
      else if (gr.kind === 1) { gl.uniform1i(u.kind, 1); gl.uniform4f(u.g, a[0], a[1], a[2], a[3]); } else { gl.uniform1i(u.kind, gr.kind); gl.uniform4f(u.g, a[0], a[1], a[3], a[4]); gl.uniform2f(u.gr, a[2], a[5]); }
      if (!gr.pat) { const a = gr.a; void a; }
      if (!gr.pat) { const S = gr.stops.slice(0, 8), sc = new Float32Array(32), so = new Float32Array(8); S.forEach(([o, c], i) => { sc.set(c, i * 4); so[i] = o; });
      gl.uniform1i(u.ns, S.length); gl.uniform4fv(u.sc, sc); gl.uniform1fv(u.so, so); }
    }
    const [x0, y0, x1, y1] = bb, q = new Float32Array([x0, y0, x1, y0, x0, y1, x0, y1, x1, y0, x1, y1]);
    gl.bufferData(gl.ARRAY_BUFFER, q, gl.STREAM_DRAW); gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.stencilMask(0xff); gl.disable(gl.STENCIL_TEST);
  }
}
