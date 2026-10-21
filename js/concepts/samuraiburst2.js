// CONCEPT page 2: public/concepts/samurai-burst2.html - three alternative Samurai 20 s bursts (Blade Edge / Flow / Chain Weave)
// on the live game engine (Sim + Renderer + FX + HUD, the game's own Samurai effects), one small HUD widget per concept, the
// concept's bonus hits drawn with the game's existing Samurai FX (fxns.js). Placeholder numbers. ?c=edge|flow|weave ?mode=play
import { DT } from '../sim/constants.js';
import { Renderer } from '../client/render.js';
import { FX } from '../client/fx.js';
import { HUD } from '../client/hud.js';
import { Feel } from '../client/feel.js';
import { smoothFollow, SMOOTH } from '../client/smooth.js';
import { governor, applyQuality, drawHudLayer } from '../client/perf.js';
import { glow, crescent, stroke, petals, glitter, slashLine, ring, burst as fxBurst } from '../client/fxns.js';
import { Driver, CONCEPTS, ROUTES, compare } from './samuraiburst2-model.js';

const $ = (id) => document.getElementById(id), qs = new URLSearchParams(location.search);
governor.hudLayer = false;
const fmt = (n) => (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : Math.round(n).toLocaleString('en-US'));
const GL = ['#ffffff', '#ff9cc6', '#ffd0e0', '#ff4d6d'];
const state = { c: CONCEPTS[qs.get('c')] ? qs.get('c') : 'edge', route: 'good', play: qs.get('mode') === 'play', speed: 1, paused: false };
let S = null;

class Session {
  constructor() {
    this.d = new Driver(state.c, state.route, { auto: !state.play }); this.p = this.d.player; this.sim = this.d.sim;
    const canvas = $('game'), stage = $('cStage'), r = (this.r = new Renderer(canvas));
    r.resize = function () { const dpr = Math.min(2, window.devicePixelRatio || 1); this.canvas.width = Math.round(stage.clientWidth * dpr); this.canvas.height = Math.round(stage.clientHeight * dpr); this.dpr = dpr; this.w = stage.clientWidth; this.h = stage.clientHeight; this.cam.zoom = Math.max(0.75, Math.min(1.5, innerHeight / 760)) * 1.12; };
    r.resize();
    this.fx = new FX(); this.fx.localPid = this.p.id; this.hud = new HUD(); this.hud.showChains = false; this.hud.keyLabel = (id) => ({ skillQ: 'Q', skillE: 'E', skillR: 'R', skillF: 'G', special: 'F', ult: 'T', attack: 'LMB' }[id] || id);
    this.feel = new Feel(); this.acc = 0; this.last = performance.now(); this.running = true; this.gl = 0;
    r.cam.x = this.p.x + 80; r.cam.y = this.p.y;
    this.d.listeners.push((e) => this.on(e));
    this.onResize = () => r.resize(); addEventListener('resize', this.onResize);
    requestAnimationFrame((t) => this.frame(t));
  }
  stop() { this.running = false; removeEventListener('resize', this.onResize); }
  on(e) {
    if (e.k === 'sim') { this.feel.handle(e.ev, this); this.fx.handle(e.ev, this.sim); return; }
    const r = e.r, fx = this.fx, b = this.d.boss, bx = b.x, by = b.y - 34, p = this.p;
    const num = (v, big) => { if (v > 0) fx.text(bx - 20, by - (big ? 175 : 150), `+${fmt(v)} concept`, { size: big ? 30 : 18, color: '#ff9cc6', vy: -36, life: big ? 1.4 : 1.0, pop: big ? 1.3 : 1.1, vx: 0 }); };
    if (r.fx === 'prime') ring(fx, p.x, p.y - 4, 46, '#ffd0e0', { enso: true, life: 0.5 });
    if (r.fx === 'edge') { crescent(fx, bx, by, 120, -0.6, { dir: 1, life: 0.55, speed: 0.1, w: 1.1 }); glitter(fx, bx, by - 20, 8 + 2 * r.stacks, 120, GL, { sp: 120 }); num(r.bonus, r.stacks >= 5); }
    if (r.fx === 'echo') { this.queue.push({ at: 0.14, run: () => { stroke(fx, bx - 90, by + 24, -0.3, 180, 16, { life: 0.4, speed: 0.08, v: 1 }); num(r.bonus); } }); }
    if (r.fx === 'pair') { const P = r.pair;
      if (P.fx === 'petals') { petals(fx, bx, by, 18, 50, 300); crescent(fx, bx, by, 110, 0.4, { dir: -1, life: 0.5, w: 1 }); }
      else if (P.fx === 'gale') { stroke(fx, bx - 130, by + 10, -0.08, 260, 18, { life: 0.45, speed: 0.08 }); glitter(fx, bx, by, 8, 120, GL); }
      else { crescent(fx, bx, by, 130, -2.2, { dir: 1, life: 0.6, w: 1.2, v: 2 }); glow(fx, bx, by, 120, '#bcd4ff', 0.35, 0.4); }
      num(r.bonus); }
    if (r.fx === 'grand') { slashLine(fx, bx, by, -0.35, 2200, { w: 18, life: 0.7 }); fxBurst(fx, bx, by, 170, '#ffffff', 0.3, 0.6, 2); petals(fx, bx, by, 30, 120, 420); fx.shake(0.4); num(r.bonus, true); }
    if (r.open) ring(fx, p.x, p.y - 4, 60, '#ff8fb0', { enso: true, life: 0.6 });
  }
  frame(now) {
    if (!this.running) return;
    const rdt = Math.min(0.1, (now - this.last) / 1000); this.last = now; const dt = state.paused ? 0 : rdt * state.speed;
    this.queue = (this.queue || []).filter((q) => { q.at -= dt; if (q.at <= 0) { q.run(); return false; } return true; });
    if (!this.feel.update(dt)) { this.acc += dt; let n = 0; while (this.acc >= DT && n < 12) { if (state.play) this.input(); this.d.step(); this.acc -= DT; n++; } if (n >= 12) this.acc = 0; }
    const r = this.r, p = this.p, b = this.d.boss, alpha = this.acc / DT;
    smoothFollow(r.cam, p.x + (b.x - p.x) * 0.35, p.y + (b.y - p.y) * 0.35 - 30, rdt, SMOOTH.cam * 0.8);
    // A) the sword glow: a soft glow at the blade, brighter with every Edge
    const w = this.d.M.widget();
    if (w.kind === 'edge' && (w.edge || w.primed) && dt > 0 && (this.gl = (this.gl + 1) % 3) === 0) { const st = w.primed || w.edge, ang = Math.atan2(b.y - p.y, b.x - p.x);
      glow(this.fx, p.x + Math.cos(ang) * 30, p.y - 22 + Math.sin(ang) * 14, 26 + st * 9, w.primed ? '#fff3fa' : '#ff8fb0', 0.14, 0.25 + st * 0.11); }
    r.time += dt; this.fx.update(dt);
    if (this.fx.banners.length > 1) this.fx.banners.splice(0, this.fx.banners.length - 1);
    r.draw(this.sim, p, alpha, this.fx, b);
    const ctx = r.ctx; ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    drawHudLayer(r, (c, dd) => this.hud.draw(c, r.w, r.h, this.sim, p, this.fx, r.time, dd), dt);
    if (governor.update(rdt * 1000) || this._gq === undefined) { this._gq = governor.level; applyQuality(r, this.fx); }
    this.ui(w); requestAnimationFrame((t) => this.frame(t));
  }
  ui(w) {
    const el = $('widget'), d = this.d, sig = JSON.stringify(w);
    if (sig !== this._sig) { this._sig = sig;
      if (w.kind === 'edge') el.innerHTML = `<div class="lbl">Blade Edge</div><div class="pips">${Array.from({ length: w.max }, (_, i) => `<i class="${i < (w.primed || w.edge) ? 'on' : ''}"></i>`).join('')}</div><div class="wstate">${w.primed ? `next chain empowered · +${w.primed * 45}% / step` : w.edge >= w.max ? 'full edge' : ''}</div>`;
      if (w.kind === 'flow') el.innerHTML = `<div class="lbl">Flow ${w.lvl}/5</div><div class="flowlv">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= w.lvl ? 'on' : ''}" style="height:${8 + i * 3.5}px"></i>`).join('')}</div><div class="wstate">${w.win > 0 ? 'echo window · finishers hit twice' : ''}</div>${w.win > 0 ? `<div class="wbar"><i style="width:${Math.round(w.win * 100)}%"></i></div>` : ''}`;
      if (w.kind === 'weave') { const M = d.M, left = Math.max(0, 20 - (d.sim.tick - M.t0) / 60);
        el.innerHTML = `<div class="lbl">Chain Weave · grand in ${left.toFixed(0)} s</div><div class="wv">${M.woven.length ? M.woven.slice(-3).map((x) => `<b>✦</b> ${x.name}`).join('<br>') : '<span style="color:#a99bc4">finish two different chains…</span>'}</div>`; }
    }
    if (w.kind === 'weave' && (d.sim.tick % 30 === 0)) this._sig = null;
    const secs = d.ticks / 60; $('mDps').textContent = fmt(d.dps); $('mGame').textContent = fmt(d.arena.dealt / Math.max(1, secs)); $('mBonus').textContent = fmt(d.bonus / Math.max(1, secs)); $('mTime').textContent = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
  }
  input() { const m = this.d.manual, k = keys; m.mx = (k.d ? 1 : 0) - (k.a ? 1 : 0); m.my = (k.s ? 1 : 0) - (k.w ? 1 : 0); m.attack = mouseDown || !!k.j; }
}
const keys = {}; let mouseDown = false;
addEventListener('keydown', (e) => { if (!state.play) return; const k = e.key.toLowerCase(); if (['q', 'e', 'r'].includes(k) && !e.repeat) S.d.manual.skill = k.toUpperCase(); if (k === 'f' && !e.repeat) S.d.manual.burst = true; keys[k] = true; if (['q', 'e', 'r', 'f', 'w', 'a', 's', 'd', ' '].includes(k)) e.preventDefault(); });
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
$('game').addEventListener('mousedown', () => { mouseDown = true; }); addEventListener('mouseup', () => { mouseDown = false; });

const cmpCache = {};
function start() { if (S) S.stop(); S = new Session(); window.__sb2 = S; render(); }
function render() {
  const C = CONCEPTS[state.c];
  $('cTabs').innerHTML = Object.entries(CONCEPTS).map(([id, K]) => `<button data-c="${id}" class="${id === state.c ? 'on' : ''}">${K.title}</button>`).join('');
  $('cTabs').querySelectorAll('button').forEach((b) => (b.onclick = () => { state.c = b.dataset.c; state.route = 'good'; state.play = false; start(); }));
  $('cName').textContent = C.title; $('cBlurb').textContent = C.blurb;
  $('routes').innerHTML = ['good', 'sloppy'].map((r) => `<button data-r="${r}" class="${r === state.route && !state.play ? 'on' : ''}">${r === 'good' ? 'Good route' : 'Sloppy route'}</button>`).join('');
  $('routes').querySelectorAll('button').forEach((b) => (b.onclick = () => { state.route = b.dataset.r; state.play = false; start(); }));
  $('bMode').textContent = state.play ? '◀ Back to autoplay' : '▶ Play it yourself'; $('bMode').classList.toggle('on', state.play);
  $('modeNote').innerHTML = state.play ? `<b>You play:</b> Q / E / R (1 s GCD, presses queue), hold LMB or J for basics, WASD to move (otherwise you step in on your own)${state.c === 'edge' ? ', <b>F</b> = empower the next chain with your Edge' : ''}. Chains: E→R Counter Sheathe, R→Q→E Petal Rain, Q→Q Wind Step, R→E Moonlit Guard, R→E→Q Moment of Death.` : `<b>Autoplay (${state.route}):</b> ${ROUTES[state.c][state.route].desc}.`;
  const c = state.c; if (!cmpCache[c]) { $('cmp').innerHTML = '<tr><td>measuring…</td></tr>'; setTimeout(() => { cmpCache[c] = ['good', 'sloppy'].map((r) => compare(c, r, 180)); if (state.c === c) showCmp(); window.__sb2Cmp = cmpCache; }, 400); } else showCmp();
}
function showCmp() { const [g, s] = cmpCache[state.c];
  $('cmp').innerHTML = `<tr><th>Route</th><th>DPS</th><th>game</th><th>concept</th></tr>` + [g, s].map((x) => `<tr class="${x === g ? 'best' : ''}"><td>${x.route === 'good' ? 'Good' : 'Sloppy'}</td><td>${fmt(x.dps)}</td><td>${fmt(x.game)}</td><td>${fmt(x.bonus)}</td></tr>`).join('') + `<tr><td colspan="4" class="note">Good beats sloppy by ${Math.round((g.dps / s.dps - 1) * 100)}% (concept share: ${Math.round((g.bonus / g.dps) * 100)}% of good DPS). CONCEPT numbers.</td></tr>`; }
$('bPlay').onclick = () => { state.paused = !state.paused; $('bPlay').textContent = state.paused ? '▶ Play' : '⏸ Pause'; };
$('bRestart').onclick = () => start(); $('sSpeed').onchange = (e) => { state.speed = +e.target.value; };
$('bMode').onclick = () => { state.play = !state.play; start(); };
start();
