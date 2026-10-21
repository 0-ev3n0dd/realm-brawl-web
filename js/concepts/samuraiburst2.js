// CONCEPT page: public/concepts/boss-rotations.html (was samurai-burst2.html) - per-class boss rotation concepts (Special cycle + real ultimate; Samurai also A-C)
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
import { Driver, CONCEPTS, ROUTES, compare, SIG, blurbFor } from './samuraiburst2-model.js';
import { SIG_ROUTES } from './sig-routes.js';
import { CLASSES } from '../sim/data/classes.js';

const $ = (id) => document.getElementById(id), qs = new URLSearchParams(location.search);
governor.hudLayer = false;
const fmt = (n) => (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : Math.round(n).toLocaleString('en-US'));
const GL = ['#ffffff', '#ff9cc6', '#ffd0e0', '#ff4d6d'];
const CLS0 = CLASSES[qs.get('cls')] ? qs.get('cls') : 'samurai';
const state = { cls: CLS0, c: CLS0 !== 'samurai' ? 'sig' : CONCEPTS[qs.get('c')] ? qs.get('c') : 'cuts', route: 'good', play: qs.get('mode') === 'play', speed: 1, paused: false };
let S = null;

class Session {
  constructor() {
    this.d = new Driver(state.c, state.route, { auto: !state.play, cls: state.cls }); this.p = this.d.player; this.sim = this.d.sim;
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
    if (state.c === 'sig') { const col = CLASSES[state.cls].color || '#ffd23f';
      if (r.fx === 'bank') { glitter(fx, bx, by, 4 + Math.min(10, r.add), 70, ['#fff', col], { sp: 80 }); fx.text(bx - 70, by - 120, `+${r.add}${r.dbl ? ' ×2' : ''}`, { size: r.dbl ? 18 : 15, color: col, vy: -30, life: 0.9, vx: 0 }); if (r.draw) ring(fx, p.x, p.y - 4, 50, col, { life: 0.7 }); }
      if (r.fx === 'wave') { ring(fx, bx, by, 90, col, { life: 0.4 }); num(r.bonus); }
      if (r.fx === 'cashfin') { fxBurst(fx, bx, by, 140, col, 0.3, 0.5, 2); ring(fx, p.x, p.y - 4, 56, '#ffffff', { life: 0.8 }); num(r.bonus, true); }
      if (r.fx === 'ultcast' && r.inR) ring(fx, p.x, p.y - 4, 64, '#ffffff', { life: 0.7 });
      if (r.fx === 'opc') { fxBurst(fx, bx, by, 180, '#ffffff', 0.35, 0.6, 2); if (r.inR) fx.shake(0.35); num(r.bonus, true); }
      return; }
    if (r.fx === 'bank') { glitter(fx, bx, by, 4 + Math.min(10, r.add), 70, GL, { sp: 80 }); fx.text(bx - 70, by - 120, `+${r.add} cuts${r.dbl ? ' ×2' : ''}`, { size: r.dbl ? 18 : 15, color: r.dbl ? '#dfe8ff' : '#ff9cc6', vy: -30, life: 0.9, vx: 0 }); if (r.draw) ring(fx, p.x, p.y - 4, 50, '#dfe8ff', { enso: true, life: 0.7 }); }
    if (r.fx === 'wave') { crescent(fx, bx, by, 100 + 10 * Math.random(), -0.6 + Math.random(), { dir: 1, life: 0.45, speed: 0.09, w: 1 }); num(r.bonus); }
    if (r.fx === 'cashfin') { slashLine(fx, bx, by, -0.3, 1600, { w: 12, life: 0.55 }); petals(fx, bx, by, 14 + Math.min(20, r.cuts), 60, 320); ring(fx, p.x, p.y - 4, 56, '#dfe8ff', { enso: true, life: 0.8 }); num(r.bonus, true); }
    if (r.fx === 'ultcast') { if (r.inR) ring(fx, p.x, p.y - 4, 64, '#dfe8ff', { enso: true, life: 0.7 }); }
    if (r.fx === 'opc') { slashLine(fx, bx, by, -0.35, 2200, { w: r.inR ? 20 : 10, life: 0.75 }); if (r.inR) { fxBurst(fx, bx, by, 170, '#ffffff', 0.3, 0.6, 2); petals(fx, bx, by, 30, 120, 420); fx.shake(0.4); } num(r.bonus, true); }
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
    const w = this.d.M.widget(this.d);
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
      if (w.kind === 'cuts') { const sp = d.player.cds && d.player.cds.SP > 0 ? Math.ceil(d.player.cds.SP / 60) : 0;
        el.innerHTML = `<span class="cl">${w.unit}</span> <b class="cn">${w.bank}</b><span class="sep">·</span>${w.resh > 0 ? `<span class="rs">${w.win} ${(w.resh * 6).toFixed(1)}s ×2</span>` : sp ? `Special ${sp}s` : '<span class="rs">Special ready</span>'}<span class="sep">·</span>${w.uw ? `<span class="rs">${w.ultName}</span>` : w.ult >= 100 ? (d.R.opc === 'window' && !d.M.inWindow(d) && d.auto ? `ULT READY · cast in ${w.win.toLowerCase()}` : '<span class="rs">ULT READY (T)</span>') : `Ult ${w.ult}%`}`; }
      if (w.kind === 'flow') el.innerHTML = `<div class="lbl">Flow ${w.lvl}/5</div><div class="flowlv">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= w.lvl ? 'on' : ''}" style="height:${8 + i * 3.5}px"></i>`).join('')}</div><div class="wstate">${w.win > 0 ? 'echo window · finishers hit twice' : ''}</div>${w.win > 0 ? `<div class="wbar"><i style="width:${Math.round(w.win * 100)}%"></i></div>` : ''}`;
      if (w.kind === 'weave') { const M = d.M, left = Math.max(0, 20 - (d.sim.tick - M.t0) / 60);
        el.innerHTML = `<div class="lbl">Chain Weave · grand in ${left.toFixed(0)} s</div><div class="wv">${M.woven.length ? M.woven.slice(-3).map((x) => `<b>✦</b> ${x.name}`).join('<br>') : '<span style="color:#a99bc4">finish two different chains…</span>'}</div>`; }
    }
    if ((w.kind === 'weave' || w.kind === 'cuts') && (d.sim.tick % 30 === 0)) this._sig = null;
    $('widget').classList.toggle('near', w.kind === 'cuts');
    const secs = d.ticks / 60; $('mDps').textContent = fmt(d.dps); $('mGame').textContent = fmt(d.arena.dealt / Math.max(1, secs)); $('mBonus').textContent = fmt(d.bonus / Math.max(1, secs)); $('mTime').textContent = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
  }
  input() { const m = this.d.manual, k = keys; m.mx = (k.d ? 1 : 0) - (k.a ? 1 : 0); m.my = (k.s ? 1 : 0) - (k.w ? 1 : 0); m.attack = mouseDown || !!k.j; }
}
const keys = {}; let mouseDown = false;
addEventListener('keydown', (e) => { if (!state.play) return; const k = e.key.toLowerCase(); if (['q', 'e', 'r'].includes(k) && !e.repeat) S.d.manual.skill = k.toUpperCase(); if (k === 'f' && !e.repeat) { if ((state.c === 'cuts' || state.c === 'sig')) S.d.manual.skill = 'SP'; else S.d.manual.burst = true; } if (k === 'g' && !e.repeat && (state.c === 'cuts' || state.c === 'sig')) S.d.manual.skill = 'F'; if (k === 't' && !e.repeat && (state.c === 'cuts' || state.c === 'sig')) S.d.manual.ult = true; keys[k] = true; if (['q', 'e', 'r', 'f', 'g', 't', 'w', 'a', 's', 'd', ' '].includes(k)) e.preventDefault(); });
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
$('game').addEventListener('mousedown', () => { mouseDown = true; }); addEventListener('mouseup', () => { mouseDown = false; });

const KL = { Q: 'Q', E: 'E', R: 'R', F: 'G', SP: 'F', B1: 'LMB', B2: 'LMB', B3: 'LMB' };
const unitTxt = (u) => (u[0] === 'B1' ? 'LMB×3' : u.map((k) => KL[k] || k).join('→'));
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const routesFor = () => (state.c === 'sig' ? SIG_ROUTES[state.cls] : ROUTES[state.c]);
/** key-chip strip, same markup / CSS as the in-game rotations page (rotations.html: .k-seq / .k-unit / .cap) */
function chainName(cls, keys) { const c = CLASSES[cls].chains.find((q) => !q.route && q.seq.join() === keys.join()); return c ? c.name : keys[0] === 'B1' ? 'Basic string' : CLASSES[cls].skills[keys[0]] ? CLASSES[cls].skills[keys[0]].name : 'cast'; }
const capHtml = (k, extra = '') => `<div class="cap${k === 'SP' ? ' sp' : ''}${/^B/.test(k) ? ' lmb' : ''}${extra}">${esc(KL[k] || k)}</div>`;
const unitHtml = (cls, keys) => `<div class="k-unit"><div class="k-caps">${keys.map((k) => capHtml(k)).join('')}</div><div class="k-name">${esc(chainName(cls, keys))}</div></div>`;
function routeKeys(R) {
  const el = $('rKeys'), card = $('rCard'); if (!R || !R.loop || (state.c !== 'cuts' && state.c !== 'sig')) { card.style.display = 'none'; return; } card.style.display = '';
  const cls = state.cls, C = CLASSES[cls], rt = (C.routes || []).find((r) => r.route === 'boss'), win = state.c === 'sig' ? SIG[cls].win : 'Resheathe';
  const row = (lbl, html) => `<div class="k-seq k-row"><span class="k-lbl">${lbl}</span>${html}</div>`;
  $('rVar').textContent = R.bankOnUlt ? '· Special banks on ult cycles' : R.opc === 'window' ? '· Special cashes out every cycle' : '· sloppy';
  el.innerHTML = row('Opener', `${R.prepull ? `<div class="k-unit"><div class="k-caps"><div class="cap">hold</div></div><div class="k-name">pre-pull ${state.c === 'sig' ? 'charge' : 'draw'}</div></div>` : ''}${(R.opener || []).map((u) => unitHtml(cls, u)).join('')}${R.spFirst ? unitHtml(cls, R.loop[0]) : ''}`)
    + row('Loop ↻', R.loop.map((u) => unitHtml(cls, u)).join(''))
    + `<div class="k-seq k-ult"><span class="k-lbl">${R.opc === 'window' ? `Ult in ${esc(win)}${R.ultLate ? ' (late)' : ''}:` : 'Ult when full:'}</span>${capHtml('T', ' ult')}${rt ? rt.seq.map((k, i) => capHtml(k, i === rt.seq.length - 1 ? ' sp' : '')).join('') + `<span class="k-lbl" style="margin-left:8px;color:#ff4fd8">→ ${esc(rt.name)}</span>` : ''}</div>`;
}
const cmpCache = {};
function start() { if (S) S.stop(); S = new Session(); window.__sb2 = S; render(); }
function render() {
  const C = state.c === 'sig' ? { title: `${CLASSES[state.cls].name} · ${SIG[state.cls].win}`, blurb: blurbFor(state.cls) } : CONCEPTS[state.c];
  $('clsTabs').innerHTML = Object.entries(CLASSES).map(([id, K]) => `<button data-cls="${id}" class="${id === state.cls ? 'on' : ''}">${esc(K.name.replace('Grimoire ', ''))}</button>`).join('');
  $('clsTabs').querySelectorAll('button').forEach((b) => (b.onclick = () => { state.cls = b.dataset.cls; state.c = state.cls === 'samurai' ? 'cuts' : 'sig'; state.route = 'good'; state.play = false; history.replaceState(null, '', '?cls=' + state.cls); start(); }));
  $('cCls').textContent = CLASSES[state.cls].name; $('cTabs').style.display = state.cls === 'samurai' ? '' : 'none';
  $('cTabs').innerHTML = Object.entries(CONCEPTS).map(([id, K]) => `<button data-c="${id}" class="${id === state.c ? 'on' : ''}">${K.title}</button>`).join('');
  $('cTabs').querySelectorAll('button').forEach((b) => (b.onclick = () => { state.c = b.dataset.c; state.route = 'good'; state.play = false; start(); }));
  $('cName').textContent = C.title; $('cBlurb').textContent = C.blurb;
  $('routes').innerHTML = ['good', 'sloppy'].map((r) => `<button data-r="${r}" class="${r === state.route && !state.play ? 'on' : ''}">${r === 'good' ? 'Good route' : 'Sloppy route'}</button>`).join('');
  $('routes').querySelectorAll('button').forEach((b) => (b.onclick = () => { state.route = b.dataset.r; state.play = false; start(); }));
  $('bMode').textContent = state.play ? '◀ Back to autoplay' : '▶ Play it yourself'; $('bMode').classList.toggle('on', state.play);
  $('modeNote').innerHTML = state.play ? `<b>You play:</b> Q / E / R (1 s GCD, presses queue), hold LMB or J for basics, WASD to move (otherwise you step in on your own)${state.c === 'edge' ? ', <b>F</b> = empower the next chain with your Edge' : state.c === 'cuts' ? ', <b>G</b> = Kesa Slash, <b>F</b> = Special (Void Draw), <b>T</b> = the real ultimate Blade of the Void; then R→E→Q→E→R = One Perfect Cut (releases the bank, ×2.5 if the ult was cast inside Resheathe). Boss Special chain: R→E→Q→F→R Void Sheath; Stillwater Execution R→E→Q→G, Void Echo Q→G→Q→E, Twin Moons Q→G→Q' : ''}. Chains: E→R Counter Sheathe, R→Q→E Petal Rain, Q→Q Wind Step, R→E Moonlit Guard, R→E→Q Moment of Death.` : `<b>Autoplay (${state.route}):</b> ${routesFor()[state.route].desc}.`; routeKeys(state.play ? routesFor().good : routesFor()[state.route]);
  const c = state.c + ':' + state.cls, cc = state.c, ccls = state.cls; if (!cmpCache[c]) { $('cmp').innerHTML = '<tr><td>measuring…</td></tr>'; setTimeout(() => { cmpCache[c] = ['good', 'sloppy'].map((r) => compare(cc, r, 180, 1, ccls)); if (state.c + ':' + state.cls === c) showCmp(); window.__sb2Cmp = cmpCache; }, 400); } else showCmp();
}
function showCmp() { const [g, s] = cmpCache[state.c + ':' + state.cls];
  $('cmp').innerHTML = `<tr><th>Route</th><th>DPS</th><th>game</th><th>concept</th></tr>` + [g, s].map((x) => `<tr class="${x === g ? 'best' : ''}"><td>${x.route === 'good' ? 'Good' : 'Sloppy'}</td><td>${fmt(x.dps)}</td><td>${fmt(x.game)}</td><td>${fmt(x.bonus)}</td></tr>`).join('') + `<tr><td colspan="4" class="note">Good beats sloppy by ${Math.round((g.dps / s.dps - 1) * 100)}% (concept share: ${Math.round((g.bonus / g.dps) * 100)}% of good DPS). CONCEPT numbers.</td></tr>`; }
$('bPlay').onclick = () => { state.paused = !state.paused; $('bPlay').textContent = state.paused ? '▶ Play' : '⏸ Pause'; };
$('bRestart').onclick = () => start(); $('sSpeed').onchange = (e) => { state.speed = +e.target.value; };
$('bMode').onclick = () => { state.play = !state.play; start(); };
start();
