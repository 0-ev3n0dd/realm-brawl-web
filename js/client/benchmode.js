// ?bench=firefox (or ?bench=1): an in-game per-category frame profiler for real hardware / real browsers.
// Times each draw category per frame and, when ?bench includes 'flush' (default on), forces the canvas to finish
// rasterising after each category (a 1-px getImageData) so engines that rasterise lazily (Firefox) charge the real
// cost to the category that caused it. Phases (6 s each): base, no-shader, no-hud. Results: console, localStorage
// 'rb.bench', an on-screen summary and a downloaded rb-bench-<browser>.json. Visual output is unchanged in 'base'.
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('bench') : null;
export const benchOn = q != null && q !== '0';
const now = () => performance.now();
function pct(a, p) { const s = Float64Array.from(a).sort(); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; }
export function installBench(game) {
  if (!benchOn || !game || !game.renderer || game.__bench) return; game.__bench = true;
  const R = game.renderer, H = game.hud, flush = !/noflush/.test(q);
  const ctx = () => R.ctx, fl = () => { if (flush) try { ctx().getImageData(0, 0, 1, 1); } catch { /* */ } };
  let cur = null; const T = (k, f) => function (...a) { if (!cur) return f.apply(this, a); fl(); const t = now(); const r = f.apply(this, a); fl(); cur[k] = (cur[k] || 0) + now() - t; return r; };
  const wrap = (o, k, cat) => { const f = o[k]; if (typeof f === 'function') o[k] = T(cat, f); };
  wrap(R, 'drawGround', 'ground'); wrap(R, 'draw', 'world+fx'); wrap(H, 'draw', 'hud'); wrap(H, 'drawMinimap', 'minimap');
  if (game.fx && game.fx.shader) wrap(game.fx.shader, 'apply', 'shader');
  if (game.ui) wrap(game.ui, 'update', 'dom');
  const phases = ['base', 'no-shader', 'no-hud'], P = 6000; let ph = 0, t0 = now() + 2000, rows = [], out = {}, saved = {};
  const ff = game.frame; game.frame = function (t) { cur = {}; const a = now(); const r = ff.call(this, t); fl(); const total = now() - a;
    if (a > t0) { cur.total = total; rows.push(cur); }
    if (a > t0 + P) { finish(); }
    cur = null; return r; };
  // (the rAF in frame() calls this.frame again -> stays wrapped)
  function apply() { const n = phases[ph]; if (n === 'no-shader') { saved.sh = game.fx.shader; game.fx.shader = null; } if (n === 'no-hud') { if (saved.sh) game.fx.shader = saved.sh; saved.hd = H.draw; H.draw = () => {}; } }
  function finish() {
    const s = {}; const keys = new Set(rows.flatMap((r) => Object.keys(r)));
    for (const k of keys) { const a = rows.map((r) => r[k] || 0); s[k] = { avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2), p50: +pct(a, 0.5).toFixed(2), p99: +pct(a, 0.99).toFixed(2) }; }
    if (s['world+fx']) s.worldOnly = { avg: +(s['world+fx'].avg - ((s.ground || {}).avg || 0) - ((s.shader || {}).avg || 0)).toFixed(2) }; s.frames = rows.length; out[phases[ph]] = s; rows = []; ph++;
    if (ph < phases.length) { apply(); t0 = now() + 1000; return; }
    if (saved.hd) H.draw = saved.hd; game.frame = ff;
    const res = { ua: navigator.userAgent, flush, c2d: (() => { try { const o = R.ctx.getContextAttributes && R.ctx.getContextAttributes(); return o && o.willReadFrequently ? 'cpu' : 'gpu'; } catch { return '?'; } })(), w: R.w, h: R.h, dpr: R.dpr, quality: R.quality, gl: (window.__rbGL || {}).v, at: new Date().toISOString(), phases: out };
    try { localStorage.setItem('rb.bench', JSON.stringify(res)); } catch { /* */ }
    console.log('RB_BENCH ' + JSON.stringify(res)); window.__rbBench = res;
    try { const b = new Blob([JSON.stringify(res, null, 1)], { type: 'application/json' }), A = document.createElement('a'); A.href = URL.createObjectURL(b); A.download = `rb-bench-${/Firefox/.test(navigator.userAgent) ? 'firefox' : 'chromium'}.json`; document.body.appendChild(A); A.click(); A.remove(); } catch { /* */ }
    const d = document.createElement('pre'); d.id = 'rbBench'; d.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;background:rgba(0,0,0,.85);color:#7dffa0;font:12px monospace;padding:8px;max-height:90vh;overflow:auto;pointer-events:auto';
    d.textContent = 'Realm Brawl bench (ms per frame, avg / p99)\n' + Object.entries(out).map(([p, s]) => p + ':\n' + Object.entries(s).filter(([k]) => k !== 'frames').map(([k, v]) => `  ${k.padEnd(9)} ${String(v.avg).padStart(6)} / ${v.p99}`).join('\n')).join('\n') + '\n(click to close)';
    d.onclick = () => d.remove(); document.body.appendChild(d);
  }
}
if (benchOn && typeof window !== 'undefined') { const w = setInterval(() => { const g = window.__rb && window.__rb.game; if (g && g.renderer && g.running === true) { clearInterval(w); installBench(g); } }, 250); }
