// CONCEPT page: public/concepts/samurai-burst.html. The real game engine (Sim + Renderer + FX + HUD) plays Hayate the Samurai
// against the arena boss; the concept layer (samuraiburst-model.js) adds afterimages / sheath tension / the 20 s draw burst /
// One Perfect Cut on top, drawn on its own overlay canvas. Placeholder numbers, nothing in the game changes.
//   ?route=cross|focused|sloppy  ?mode=play   window.__sb exposes the session (tools/concepts/samurai-media.mjs)
import { DT } from '../sim/constants.js';
import { Renderer } from '../client/render.js';
import { FX } from '../client/fx.js';
import { HUD } from '../client/hud.js';
import { Feel } from '../client/feel.js';
import { smoothFollow, SMOOTH } from '../client/smooth.js';
import { S as nsState, stroke, petals, glitter, burst as inkBurst, kanjiPop, slashLine, moment, splatter, crescent } from '../client/fxns.js';
import { governor, applyQuality, drawHudLayer } from '../client/perf.js';
import { Driver, ROUTES, CONCEPT, SYMBOL, NAMES, compareRoute } from './samuraiburst-model.js';

const $ = (id) => document.getElementById(id), qs = new URLSearchParams(location.search);
governor.hudLayer = false;
// afterimage silhouettes: Hayate's showcase still (assets/models/hayate-s.webp), alpha-thresholded (no glow / petal haze),
// a dark type-tinted core and a bright 2 px rim in the type colour: crisp at any size
const SIL = {}, SHINES = new Map();
function buildSil(img) {
  const W = 180, H = Math.round(W * img.height / img.width), base = document.createElement('canvas'); base.width = W; base.height = H; const g = base.getContext('2d'); g.drawImage(img, 0, 0, W, H);
  const id = g.getImageData(0, 0, W, H), a = id.data; for (let i = 0; i < a.length; i += 4) { const on = a[i + 3] > 200; a[i] = a[i + 1] = a[i + 2] = 255; a[i + 3] = on ? 255 : 0; } g.putImageData(id, 0, 0);
  for (const [type, col] of Object.entries(COL)) { if (!NAMES[type]) continue;
    const c = document.createElement('canvas'); c.width = W + 8; c.height = H + 8; const x = c.getContext('2d');
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2]]) x.drawImage(base, 4 + dx, 4 + dy);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    const core = document.createElement('canvas'); core.width = W; core.height = H; const cx = core.getContext('2d'); cx.drawImage(base, 0, 0); cx.globalCompositeOperation = 'source-in';
    const gr = cx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(12,7,14,0.92)'); gr.addColorStop(0.75, 'rgba(12,7,14,0.8)'); gr.addColorStop(1, 'rgba(12,7,14,0.25)'); cx.fillStyle = gr; cx.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'source-over'; x.drawImage(core, 4, 4); SIL[type] = c; }
}
function SHINE(S, band) {
  const q = Math.round(band * 20), key = S.width + ':' + S.height + ':' + q; let c = SHINES.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = S.width; c.height = S.height; const x = c.getContext('2d'); x.drawImage(S, 0, 0); x.globalCompositeOperation = 'source-in';
  const y = (1 - q / 20) * S.height, g = x.createLinearGradient(0, y - 18, 0, y + 18); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height); SHINES.set(key, c); return c;
}
const shadeHex = (h, k) => { const n = parseInt(h.slice(1), 16); return `rgb(${(((n >> 16) & 255) * k) | 0},${(((n >> 8) & 255) * k) | 0},${((n & 255) * k) | 0})`; };
/** an ink stroke: a dark stroke under a crisp white one */
function inkLine(x, x0, y0, x1, y1, w, a) {
  if (a <= 0) return; x.save(); x.globalAlpha = a; x.lineCap = 'round';
  x.strokeStyle = '#140a22'; x.lineWidth = w * 1.9; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
  x.strokeStyle = '#ffffff'; x.lineWidth = w * 0.75; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); x.restore();
}
/** the draw's cut shapes: Cross-cut = an X + a level cut, Focused = three parallel diagonals + the draw, else one cut each */
function pattern(id, n) {
  if (id === 'cross') return [{ ang: -0.75, off: 0, len: 115 }, { ang: 0.75, off: 0, len: 115 }, { ang: 0.02, off: 0, len: 150 }, { ang: 0.02, off: 22, len: 170 }];
  if (id === 'focused') return [{ ang: -0.6, off: -34, len: 110 }, { ang: -0.6, off: 0, len: 125 }, { ang: -0.6, off: 34, len: 110 }, { ang: 0.05, off: 0, len: 160 }];
  return Array.from({ length: n + 1 }, (_, i) => ({ ang: -0.5 + i * 0.35, off: 0, len: 120 }));
}
const QUIET = new Set(['chain', 'samMoment', 'ultGain', 'fin', 'routeStep']);
const COL = { thrust: '#ff4d6d', sweep: '#8fb8ff', rise: '#9fe08a', draw: '#ffd23f', opc: '#ffffff' };
const fmt = (n) => (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : Math.round(n).toLocaleString('en-US'));
let state = { route: ROUTES[qs.get('route')] ? qs.get('route') : 'cross', play: qs.get('mode') === 'play', speed: 1, paused: false };
let S = null;

class Session {
  constructor() {
    this.d = new Driver(state.route, { auto: !state.play });
    this.p = this.d.player; this.sim = this.d.sim;
    const canvas = $('game'), stage = $('cStage'), r = (this.r = new Renderer(canvas));
    r.resize = function () { const dpr = Math.min(2, window.devicePixelRatio || 1); this.canvas.width = Math.round(stage.clientWidth * dpr); this.canvas.height = Math.round(stage.clientHeight * dpr); this.dpr = dpr; this.w = stage.clientWidth; this.h = stage.clientHeight; this.cam.zoom = Math.max(0.75, Math.min(1.5, innerHeight / 760)) * 1.12; };
    r.resize(); this.oc = $('over'); this.ox = this.oc.getContext('2d');
    this.fx = new FX(); this.fx.localPid = this.p.id; this.hud = new HUD(); this.hud.showChains = false; this.hud.keyLabel = (id) => ({ skillQ: 'Q', skillE: 'E', skillR: 'R', skillF: 'G', special: 'F', ult: 'T', attack: 'LMB' }[id] || id);
    this.feel = new Feel(); this.acc = 0; this.last = performance.now(); this.running = true;
    this.ghosts = []; this.cuts = []; this.streaks = []; this.opcFx = null; this.call = null; this.fx.cinematic = true; r.cinematic = true; // (concept view: the game's own numbers / banners / badges off, so nothing stacks on the boss)
    this.slow = 1; this.slowT = 0; this.queue = [];
    r.cam.x = this.p.x + 80; r.cam.y = this.p.y;
    this.d.listeners.push((e) => this.on(e));
    this.onResize = () => r.resize(); addEventListener('resize', this.onResize);
    requestAnimationFrame((t) => this.frame(t));
  }
  stop() { this.running = false; removeEventListener('resize', this.onResize); }
  on(e) {
    if (e.k === 'sim') { const ev = e.ev; if (QUIET.has(ev.type)) return; this.feel.handle(ev, this); this.fx.handle(ev, this.sim); return; } // (chain flourishes - kanji, seals, titles - stay off: the concept owns the big moments)
    if (e.k === 'img' && !e.im.full) { this.addGhost(e.im); this.log(`${SYMBOL[e.im.type]} ${NAMES[e.im.type]}`, e.opener ? 'held draw · opener' : e.name, COL[e.im.type]); }
    if (e.k === 'img' && e.im.full) this.log('slots full', e.name, '#8f80ad');
    if (e.k === 'upg') { const g = this.ghosts.find((x) => x.im === e.im); if (g) g.pop = 1; this.log(`${SYMBOL[e.im.type]} ${NAMES[e.im.type]}`, e.name, COL[e.im.type]); }
    if (e.k === 'drop') this.log('chain dropped', 'tension build slowed', '#ff6b6b');
    if (e.k === 'burst') this.burst(e.r);
  }
  /** one short HUD line at a time (never in the arena) */
  log(t, s, col) { this.call = { t, s, col, life: 1.4 }; }
  addGhost(im) { this.ghosts.push({ im, a: 0, pop: 1 }); }
  /** the neat arc behind the hero (away from the boss) */
  ghostPos(i, n) {
    const p = this.p, b = this.d.boss, back = Math.atan2(p.y - b.y, p.x - b.x), k = n <= 1 ? 0 : i - (n - 1) / 2;
    const a = back + k * 0.62; return { x: p.x + Math.cos(a) * 128, y: p.y + Math.sin(a) * 96 };
  }
  burst(res) {
    const b = this.d.boss, fx = this.fx, bx = b.x, by = b.y - 34;
    this.slow = 0.06; this.slowT = 0.42; this.pause = { life: 0.42, max: 0.42 }; // the sheathe pause
    const lines = pattern(res.pat.id, Math.max(1, res.imgs.length));
    lines.forEach((ln, i) => this.queue.push({ at: 0.42 + i * 0.09, run: () => {
      // a sumi-e brush slash (the game's Samurai ink stroke), centred on the boss
      const L = ln.len * 2, ox = -Math.sin(ln.ang) * ln.off, oy = Math.cos(ln.ang) * ln.off;
      stroke(fx, bx + ox - Math.cos(ln.ang) * ln.len, by + oy - Math.sin(ln.ang) * ln.len, ln.ang, L, i === lines.length - 1 ? 30 : 22, { life: 0.75, speed: 0.08, red: i === lines.length - 1, v: i % 2 });
      const g = this.ghosts[0];
      if (g && i < res.imgs.length) { this.ghosts.shift(); const p = g.last || { x: this.p.x, y: this.p.y }; petals(fx, p.x, p.y - 40, 16, 26, 170); this.streaks.push({ from: p, life: 0.18, max: 0.18 }); }
      if (i === lines.length - 1) { petals(fx, bx, by, 26, 60, 380); glitter(fx, bx, by - 20, 10, 140, ['#ffffff', '#ff9cc6', '#ffd0e0', '#ff4d6d'], { sp: 120 }); inkBurst(fx, bx, by, 150, '#ffffff', 0.25, 0.5, 2); splatter(fx, bx, by, 8, 70, '#0c070e', { sp: 300 }); fx.shake(0.25); }
    } }));
    const k = kanjiPop(fx, '斬', bx - 175, by + 20, 80, { life: 1.2, seal: res.pat.id === 'cross' ? '十' : res.pat.id === 'focused' ? '三' : '刀', sealCol: '#c8142c', rot: -0.06 }); k.mine = true;
    const draw = res.total - (res.opc ? res.opc.dmg : 0);
    this.queue.push({ at: 0.42 + lines.length * 0.09 + 0.05, run: () => { this.big = { v: draw, sub: `${res.pat.id === 'cross' ? 'Cross-cut' : res.pat.id === 'focused' ? 'Focused triple' : res.pat.name} ×${res.pat.mul}${res.full ? ' · crit' : ''}`, life: 1.5, max: 1.5, col: res.pat.id === 'cross' ? '#ffd23f' : '#fff3fa' }; } });
    this.log(res.pat.id === 'cross' ? 'Cross-cut draw' : res.pat.id === 'focused' ? 'Focused draw' : 'Draw', `sheath ${Math.round(res.tension)}%${res.full ? ' · crit' : ''}`, '#ffd23f');
    if (res.opc) this.queue.push({ at: 1.9, run: () => this.opc(res.opc) });
  }
  opc(o) {
    // One Perfect Cut: the game's grayscale time-stop moment, but ONE ink stroke across the dimmed screen + petals scattering
    const b = this.d.boss, fx = this.fx, bx = b.x, by = b.y - 34;
    this.slow = 0.2; this.slowT = 2.4;
    moment(fx, true, { cls: 'sam', pid: this.p.id, x: bx, y: by, ang: 0, gray: 1, dim: 0.55, wash: 0.2, vig: '#000000', pal: 'gold', title: '', sub: '', kanji: '一', seal: '極', sealCol: '#c8142c', kanjiAt: 'focus', kanjiSize: 0.3, kox: -0.32, koy: -0.2, sox: 0.09, soy: 0.16,
      kanjiStyle: { ink: '#0c070e' }, kanjiA: 0.9, screenPetals: 50, flash: 0.12, life: 2.2, pre: 0, tail: 0.9,
      onClimax: () => {
        stroke(fx, bx - 900, by + 120, -0.13, 1800, 34, { life: 1.6, speed: 0.22, red: true, v: 0 });
        petals(fx, bx, by, 60, 260, 520); glitter(fx, bx, by - 30, 16, 300, ['#ffffff', '#ff9cc6', '#ffd0e0', '#ff4d6d'], { sp: 140 }); fx.shake(0.5);
      } });
    this.opcFx = { life: 2.4, max: 2.4 };
    this.queue.push({ at: 0.9, run: () => { this.big = { v: o.dmg, sub: `One Perfect Cut · ${o.imgs.length} afterimages`, life: 2.2, max: 2.2, col: '#ffffff', huge: true }; } });
    this.log('One Perfect Cut', `${o.imgs.length} afterimages of the minute`, '#ffffff');
  }
  frame(now) {
    if (!this.running) return;
    let dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const rdt = dt;
    if (this.slowT > 0) { this.slowT -= rdt; if (this.slowT <= 0) this.slow = 1; }
    dt *= state.paused ? 0 : state.speed * this.slow;
    for (const q of this.queue) q.at -= rdt * (state.paused ? 0 : state.speed); const due = this.queue.filter((q) => q.at <= 0); this.queue = this.queue.filter((q) => q.at > 0); due.forEach((q) => q.run());
    const held = this.feel.update(dt);
    if (!held) { this.acc += dt; let n = 0; while (this.acc >= DT && n < 12) { if (state.play) this.input(); this.d.step(); this.acc -= DT; n++; } if (n >= 12) this.acc = 0; }
    const r = this.r, p = this.p, b = this.d.boss, alpha = this.acc / DT;
    let tx = p.x + (b.x - p.x) * 0.35, ty = p.y + (b.y - p.y) * 0.35 - 30; smoothFollow(r.cam, tx, ty, rdt, SMOOTH.cam * 0.8);
    r.time += dt; this.fx.update(dt);
    { const st = nsState(this.fx); if (st.items.some((i) => (i.kind === 'kanji' || i.kind === 'sfx') && !i.mine)) st.items = st.items.filter((i) => !((i.kind === 'kanji' || i.kind === 'sfx') && !i.mine)); } // (the game's per-skill kanji pops / SFX words off: the concept keeps one kanji, on the draw)
    if (this.fx.banners.length > 1) this.fx.banners.splice(0, this.fx.banners.length - 1);
    r.draw(this.sim, p, alpha, this.fx, b);
    const ctx = r.ctx; ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    const ch = p.comboHits; p.comboHits = 0; drawHudLayer(r, (c, dd) => this.hud.draw(c, r.w, r.h, this.sim, p, this.fx, r.time, dd), dt); p.comboHits = ch; // (no hit counter: one number at a time)
    if (governor.update(rdt * 1000) || this._gq === undefined) { this._gq = governor.level; applyQuality(r, this.fx); }
    this.overlay(rdt * (state.paused ? 0 : state.speed)); this.ui();
    requestAnimationFrame((t) => this.frame(t));
  }
  overlay(dt) {
    const oc = this.oc, x = this.ox, r = this.r, d = r.dpr, z = r.cam.zoom, T = performance.now() / 1000, b = this.d.boss;
    if (oc.width !== r.canvas.width || oc.height !== r.canvas.height) { oc.width = r.canvas.width; oc.height = r.canvas.height; }
    x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, r.w, r.h);
    const bs = r.worldToScreen(b.x, b.y - 34);
    if (this.pause) { const p = this.pause; p.life -= dt; x.fillStyle = `rgba(8,4,16,${0.3 * Math.sin(Math.PI * Math.max(0, p.life / p.max))})`; x.fillRect(0, 0, r.w, r.h); if (p.life <= 0) this.pause = null; }
    if (this.opcFx) { this.opcFx.life -= dt; if (this.opcFx.life <= 0) this.opcFx = null; }
    const n = this.ghosts.length;
    this.ghosts.forEach((g, i) => { const wp = this.ghostPos(i, n); g.last = wp; const s = r.worldToScreen(wp.x, wp.y); g.pop = Math.max(0, g.pop - dt * 3); g.a = Math.min(1, g.a + dt * 5);
      const S = SIL[g.im.type]; if (!S) return; const h = 104 * z * (1 + 0.12 * g.pop), w = h * S.width / S.height, face = b.x < wp.x ? -1 : 1;
      x.save(); x.translate(s.x, s.y); x.scale(face, 1); x.globalAlpha = g.a * (0.8 + 0.07 * Math.sin(T * 4 + i * 2)); x.drawImage(S, -w / 2, -h * 0.92, w, h);
      const band = ((T * 0.7 + i * 0.33) % 1.4) - 0.2; if (band > 0 && band < 1) { x.globalAlpha = 0.4 * g.a; x.globalCompositeOperation = 'lighter'; x.drawImage(SHINE(S, band), -w / 2, -h * 0.92, w, h); x.globalCompositeOperation = 'source-over'; }
      x.restore(); });
    for (const st of this.streaks) { st.life -= dt; const a = r.worldToScreen(st.from.x, st.from.y - 40), k = Math.max(0, st.life / st.max); inkLine(x, a.x, a.y, a.x + (bs.x - a.x) * (1 - k), a.y + (bs.y - a.y) * (1 - k), 3 * z, k); }
    this.streaks = this.streaks.filter((s) => s.life > 0);
    if (this.flash > 0) { this.flash -= dt; x.fillStyle = `rgba(255,255,255,${Math.max(0, this.flash) * 2})`; x.fillRect(0, 0, r.w, r.h); }
    if (this.big) { const g = this.big; g.life -= dt; const k = 1 - g.life / g.max, pop = k < 0.12 ? 1 + (0.12 - k) * 3 : 1, a = Math.min(1, g.life * 3), sz = (g.huge ? 72 : 46) * z * pop, px = bs.x + (g.huge ? 0 : 140 * z), py = bs.y - (g.huge ? 120 : 64) * z - k * 14;
      x.globalAlpha = a; x.textAlign = 'center'; x.lineJoin = 'round'; x.font = `${Math.round(sz)}px 'Lilita One'`; x.lineWidth = 8; x.strokeStyle = '#140a22'; x.strokeText(fmt(g.v), px, py); x.fillStyle = g.col; x.fillText(fmt(g.v), px, py);
      x.font = `${Math.round(13 * z)}px 'Lilita One'`; x.lineWidth = 4; x.strokeText(g.sub.toUpperCase(), px, py + 20 * z); x.fillStyle = '#ffd0e6'; x.fillText(g.sub.toUpperCase(), px, py + 20 * z); x.globalAlpha = 1; if (g.life <= 0) this.big = null; }
  }
  ui() {
    const m = this.d.model, d = this.d, el = $('slots').querySelectorAll('.slot');
    el.forEach((s, i) => { const im = m.imgs[i]; s.className = 'slot' + (im ? ' f ' + im.type : ''); s.textContent = im ? SYMBOL[im.type] : ''; s.title = im ? im.name : ''; });
    const pat = m.pattern(); $('pat').textContent = m.imgs.length >= 3 ? `${pat.name} ×${pat.mul}` : `${m.imgs.length}/3`;
    $('sheath').querySelector('i').style.width = m.tension + '%'; $('sheath').querySelector('.v').textContent = Math.round(m.tension) + '%'; $('sheath').classList.toggle('full', m.tension >= 100);
    $('cycle').querySelector('.fg').style.strokeDasharray = `${(m.cycleT / CONCEPT.cycle) * 169.6} 169.6`; $('cycle').querySelector('.t').textContent = (CONCEPT.cycle - m.cycleT).toFixed(1);
    $('opc').querySelectorAll('i').forEach((p, i) => p.classList.toggle('on', i < m.bursts % 3 || (m.bursts > 0 && m.bursts % 3 === 0 && this.opcFx)));
    const c = this.call, co = $('callout'); if (c) { c.life -= 1 / 60; if (c._t !== c.t + c.s) { c._t = c.t + c.s; co.innerHTML = `<b style="color:${c.col}">${c.t}</b><span>${c.s}</span>`; } co.classList.toggle('on', c.life > 0); if (c.life <= 0) this.call = null; } else co.classList.remove('on');
    const secs = d.ticks / 60; $('mDps').textContent = fmt(d.dps); $('mGame').textContent = fmt(d.gameDealt / Math.max(1, secs)); $('mBurst').textContent = fmt(m.bonus / Math.max(1, secs)); $('mTime').textContent = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
    const hold = d.events.length && !d.pulled; $('hold').classList.toggle('hidden', !hold); if (hold) $('hold').querySelector('i').style.width = Math.round(100 * (d.auto ? 1 - d.prepull / 70 : Math.min(1, (d.hold || 0) / CONCEPT.opener.hold))) + '%';
    if (hold && !d.auto) $('hold').querySelector('.lbl').textContent = 'Pre-pull: HOLD F (draw) ≥1 s, release to pull with a free afterimage · or just attack';
  }
  input() { const m = this.d.manual, k = keys; m.mx = (k.d ? 1 : 0) - (k.a ? 1 : 0); m.my = (k.s ? 1 : 0) - (k.w ? 1 : 0); m.attack = mouseDown || !!k.j; m.draw = !!k.f; }
}
const keys = {}; let mouseDown = false;
addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (!state.play) return; if (['q', 'e', 'r'].includes(k) && !e.repeat) S.d.manual.skill = k.toUpperCase(); if (k === 'f' && !e.repeat && S.d.pulled) S.d.manual.drawTap = true; keys[k] = true; if (['q', 'e', 'r', 'f', 'w', 'a', 's', 'd', ' '].includes(k)) e.preventDefault(); });
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
$('game').addEventListener('mousedown', () => { mouseDown = true; }); addEventListener('mouseup', () => { mouseDown = false; });

function start() { if (S) S.stop(); S = new Session(); window.__sb = S; renderControls(); }
function renderControls() {
  $('routes').innerHTML = Object.entries(ROUTES).map(([id, r]) => `<button data-r="${id}" class="${id === state.route && !state.play ? 'on' : ''}" title="${r.desc}">${r.name}</button>`).join('');
  $('routes').querySelectorAll('button').forEach((b) => (b.onclick = () => { state.route = b.dataset.r; state.play = false; start(); }));
  $('bMode').classList.toggle('on', state.play); $('bMode').textContent = state.play ? '◀ Back to autoplay' : '▶ Play it yourself';
  $('modeNote').innerHTML = state.play ? '<b>You play:</b> Q / E / R skills (1 s GCD), hold LMB or J for basics, WASD move, <b>F = draw</b> (once per 20 s cycle; hold F before the pull for the opener). Chains: E→R thrust, R→Q→E or R→E sweep, Q→Q or R→E→Q rising cut.' : `<b>Autoplay:</b> ${ROUTES[state.route].desc}.`;
}
$('bPlay').onclick = () => { state.paused = !state.paused; $('bPlay').textContent = state.paused ? '▶ Play' : '⏸ Pause'; };
$('bRestart').onclick = () => start();
$('sSpeed').onchange = (e) => { state.speed = +e.target.value; };
$('bMode').onclick = () => { state.play = !state.play; start(); };
{ const im = new Image(); im.onload = () => buildSil(im); im.src = '../assets/models/hayate-s.webp'; }
start();
// headless comparison of the three routes (same engine, no rendering), in small slices so the page stays smooth
setTimeout(() => {
  const rows = []; let i = 0; const ids = Object.keys(ROUTES);
  const next = () => {
    if (i >= ids.length) {
      const best = Math.max(...rows.map((r) => r.dps));
      $('cmp').innerHTML = '<tr><th>Route</th><th>DPS</th><th>game</th><th>burst</th><th>drops</th></tr>' + rows.map((r) => `<tr class="${r.dps === best ? 'best' : ''}"><td>${ROUTES[r.route].name}</td><td>${fmt(r.dps)}</td><td>${fmt(r.gameDps)}</td><td>${fmt(r.conceptDps)}</td><td>${r.drops}</td></tr>`).join('') + `<tr><td colspan="5" class="note">${rows.map((r) => `${ROUTES[r.route].name.split(' ')[0]}: ${r.bursts} draws (${r.cross} cross-cut, ${r.focused} focused, ${r.opc} OPC)`).join(' · ')}. CONCEPT numbers.</td></tr>`;
      window.__sbCmp = rows; return;
    }
    rows.push(compareRoute(ids[i++], 180)); setTimeout(next, 30);
  };
  next();
}, 1500);
