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
import { governor, applyQuality, drawHudLayer } from '../client/perf.js';
import { Driver, ROUTES, CONCEPT, SYMBOL, NAMES, compareRoute } from './samuraiburst-model.js';

const $ = (id) => document.getElementById(id), qs = new URLSearchParams(location.search);
governor.hudLayer = false;
const COL = { thrust: '#ff8a5c', sweep: '#7fd4ff', rise: '#b6ff7a', draw: '#ffd23f', opc: '#ffffff' };
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
    this.ghosts = []; this.nums = []; this.slashes = []; this.opcFx = null; this.call = null; this.slow = 1; this.slowT = 0; this.queue = [];
    r.cam.x = this.p.x + 80; r.cam.y = this.p.y;
    this.d.listeners.push((e) => this.on(e));
    this.onResize = () => r.resize(); addEventListener('resize', this.onResize);
    requestAnimationFrame((t) => this.frame(t));
  }
  stop() { this.running = false; removeEventListener('resize', this.onResize); }
  on(e) {
    if (e.k === 'sim') { const ev = e.ev; this.feel.handle(ev, this); this.fx.handle(ev, this.sim); return; }
    if (e.k === 'img') this.snap(e.im, e.opener);
    if (e.k === 'upg') { const g = this.ghosts.find((x) => x.im === e.im); if (g) g.flash = 1; }
    if (e.k === 'img' && !e.im.full) this.say(e.opener ? 'Held draw released' : SYMBOL[e.im.type] + ' ' + NAMES[e.im.type], e.name, 0.8, COL[e.im.type], 28);
    if (e.k === 'img' && e.im.full) this.say('Slots full', e.name + ' (no afterimage)', 0.7, '#c9bce0', 24);
    if (e.k === 'drop') this.say('Chain dropped', 'tension build slowed, nothing lost', 0.9, '#ff6b6b', 28);
    if (e.k === 'burst') this.burst(e.r);
  }
  say(t, s, dur, col = '#ffd23f', size = 44) { this.call = { t, s, dur, life: dur, col, size }; }
  /** a frozen afterimage: a radial cut-out of the live game canvas around the hero at the moment the chain lands */
  snap(im, opener) {
    const r = this.r, sc = r.worldToScreen(this.p.x, this.p.y - 30), R = 90 * r.cam.zoom, d = r.dpr;
    const c = document.createElement('canvas'); c.width = c.height = Math.round(R * 2 * d); const g = c.getContext('2d');
    g.drawImage(r.canvas, (sc.x - R) * d, (sc.y - R) * d, R * 2 * d, R * 2 * d, 0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = COL[im.type]; g.globalAlpha = 0.35; g.fillRect(0, 0, c.width, c.height);
    g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; const gr = g.createRadialGradient(c.width / 2, c.height / 2, c.width * 0.12, c.width / 2, c.height / 2, c.width / 2); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    const k = this.ghosts.length; const ang = -0.9 + k * 0.9; // (laid out in an arc behind the hero so all three read)
    this.ghosts.push({ im, c, wx: this.p.x - 70 + Math.cos(ang) * -30, wy: this.p.y - 30 + Math.sin(ang) * 70, R: 90, born: performance.now(), flash: 1, opener });
  }
  burst(res) {
    const b = this.d.boss; this.slow = 0.35; this.slowT = 0.9;
    this.say(res.pat.id === 'cross' ? 'CROSS-CUT DRAW' : res.pat.id === 'focused' ? 'FOCUSED TRIPLE DRAW' : 'DRAW', `${res.pat.name} ×${res.pat.mul} · sheath ${Math.round(res.tension)}%${res.full ? ' · CRIT' : ''} · CONCEPT ${fmt(res.total - (res.opc ? res.opc.dmg : 0))}`, 1.6);
    let delay = 0;
    for (const h of res.hits) {
      const g = h.im ? this.ghosts.find((x) => x.im === h.im) : null;
      this.queue.push({ at: delay, run: () => {
        const from = g ? { x: g.wx, y: g.wy } : { x: this.p.x, y: this.p.y - 30 };
        this.slashes.push({ from, to: { x: b.x, y: b.y - 30 }, col: COL[h.k] || COL.draw, life: 0.45, max: 0.45, w: h.k === 'draw' ? 14 : 9 });
        this.nums.push({ x: b.x + (Math.random() - 0.5) * 80, y: b.y - 90, v: h.dmg, crit: h.crit, life: 1.3, col: COL[h.k] || COL.draw });
        if (g) g.dead = true;
      } });
      delay += 0.16;
    }
    if (res.opc) this.queue.push({ at: delay + 0.35, run: () => this.opc(res.opc) });
  }
  opc(o) {
    const b = this.d.boss; this.slow = 0.2; this.slowT = 2.2;
    const pts = o.imgs.map((i, k) => ({ x: b.x - 420 + k * (840 / Math.max(1, o.imgs.length - 1)), y: b.y - 40 + Math.sin(k * 1.7) * 60, type: i.type }));
    this.opcFx = { pts, life: 2.4, max: 2.4 };
    this.say('ONE PERFECT CUT', `${o.imgs.length} afterimages of the minute linked · CONCEPT ${fmt(o.dmg)}`, 2.4, '#ffffff', 60);
    this.queue.push({ at: 1.1, run: () => this.nums.push({ x: b.x, y: b.y - 140, v: o.dmg, crit: true, life: 2, col: '#ffffff', big: true }) });
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
    if (this.fx.banners.length > 1) this.fx.banners.splice(0, this.fx.banners.length - 1);
    r.draw(this.sim, p, alpha, this.fx, b);
    const ctx = r.ctx; ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    drawHudLayer(r, (c, dd) => this.hud.draw(c, r.w, r.h, this.sim, p, this.fx, r.time, dd), dt);
    if (governor.update(rdt * 1000) || this._gq === undefined) { this._gq = governor.level; applyQuality(r, this.fx); }
    this.overlay(rdt * (state.paused ? 0 : state.speed)); this.ui();
    requestAnimationFrame((t) => this.frame(t));
  }
  overlay(dt) {
    const oc = this.oc, x = this.ox, r = this.r, d = r.dpr;
    if (oc.width !== r.canvas.width || oc.height !== r.canvas.height) { oc.width = r.canvas.width; oc.height = r.canvas.height; }
    x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, r.w, r.h); const z = r.cam.zoom, T = performance.now() / 1000;
    this.ghosts = this.ghosts.filter((g) => !g.dead || (g.fade = (g.fade ?? 1) - dt * 4) > 0);
    for (const g of this.ghosts) {
      const s = r.worldToScreen(g.wx, g.wy), R = g.R * z; g.flash = Math.max(0, g.flash - dt * 2);
      x.globalAlpha = (g.dead ? g.fade : 1) * (0.55 + 0.1 * Math.sin(T * 3 + g.born)); x.drawImage(g.c, s.x - R, s.y - R, R * 2, R * 2);
      x.globalAlpha = 0.8; x.strokeStyle = COL[g.im.type]; x.lineWidth = 2 + g.flash * 4; x.beginPath(); x.ellipse(s.x, s.y + R * 0.55, R * 0.45, R * 0.14, 0, 0, Math.PI * 2); x.stroke();
      x.globalAlpha = 1; x.fillStyle = COL[g.im.type]; x.font = `${Math.round(18 * z)}px 'Lilita One'`; x.textAlign = 'center'; x.fillText(SYMBOL[g.im.type], s.x, s.y - R * 0.75);
    }
    for (const sl of this.slashes) { sl.life -= dt; const a = r.worldToScreen(sl.from.x, sl.from.y), b = r.worldToScreen(sl.to.x, sl.to.y), k = sl.life / sl.max;
      x.globalAlpha = Math.max(0, k); x.strokeStyle = sl.col; x.lineCap = 'round'; x.lineWidth = sl.w * z * (0.5 + k); x.shadowColor = sl.col; x.shadowBlur = 18; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); x.shadowBlur = 0; }
    this.slashes = this.slashes.filter((s) => s.life > 0);
    if (this.opcFx) { const o = this.opcFx; o.life -= dt; const k = 1 - o.life / o.max;
      x.globalAlpha = Math.min(0.75, k * 3) * Math.min(1, o.life * 2); x.fillStyle = '#05020a'; x.fillRect(0, 0, r.w, r.h);
      const sp = o.pts.map((p) => r.worldToScreen(p.x, p.y)), n = Math.min(sp.length, Math.floor(k * 2.2 * sp.length) + 1);
      for (let i = 0; i < n; i++) { x.globalAlpha = Math.min(1, o.life); x.fillStyle = COL[o.pts[i].type]; x.beginPath(); x.arc(sp[i].x, sp[i].y, 10 * z, 0, Math.PI * 2); x.fill(); }
      if (k > 0.42 && sp.length) { x.globalAlpha = Math.min(1, o.life * 1.5); x.strokeStyle = '#fff'; x.shadowColor = '#ff5fa2'; x.shadowBlur = 30; x.lineWidth = 6 * z + (k < 0.5 ? 14 : 0);
        const a = sp[0], e = sp[sp.length - 1], kk = Math.min(1, (k - 0.42) * 6); x.beginPath(); x.moveTo(a.x - 200, a.y + 40); x.lineTo(a.x - 200 + (e.x - a.x + 400) * kk, a.y + 40 + (e.y - a.y - 80) * kk); x.stroke(); x.shadowBlur = 0; }
      if (o.life <= 0) this.opcFx = null; }
    for (const nm of this.nums) { nm.life -= dt; nm.y -= dt * 40; const s = r.worldToScreen(nm.x, nm.y), sz = (nm.big ? 54 : nm.crit ? 30 : 24) * z;
      x.globalAlpha = Math.min(1, nm.life * 2); x.font = `${Math.round(sz)}px 'Lilita One'`; x.textAlign = 'center'; x.lineWidth = 5; x.strokeStyle = '#1a0f2e'; const t = fmt(nm.v) + (nm.crit ? '!' : '');
      x.strokeText(t, s.x, s.y); x.fillStyle = nm.col; x.fillText(t, s.x, s.y); x.font = `${Math.round(11 * z)}px system-ui`; x.fillStyle = '#ffd0e6'; x.fillText('CONCEPT', s.x, s.y + 14 * z); }
    this.nums = this.nums.filter((n) => n.life > 0); x.globalAlpha = 1;
  }
  ui() {
    const m = this.d.model, d = this.d, el = $('slots').querySelectorAll('.slot');
    el.forEach((s, i) => { const im = m.imgs[i]; s.className = 'slot' + (im ? ' f ' + im.type : ''); s.textContent = im ? SYMBOL[im.type] : ''; s.title = im ? im.name : ''; });
    const pat = m.pattern(); $('pat').textContent = m.imgs.length >= 3 ? `${pat.name} ×${pat.mul}` : `${m.imgs.length}/3`;
    $('sheath').querySelector('i').style.width = m.tension + '%'; $('sheath').querySelector('.v').textContent = Math.round(m.tension) + '%'; $('sheath').classList.toggle('full', m.tension >= 100);
    $('cycle').querySelector('.fg').style.strokeDasharray = `${(m.cycleT / CONCEPT.cycle) * 169.6} 169.6`; $('cycle').querySelector('.t').textContent = (CONCEPT.cycle - m.cycleT).toFixed(1);
    $('opc').querySelectorAll('i').forEach((p, i) => p.classList.toggle('on', i < m.bursts % 3 || (m.bursts > 0 && m.bursts % 3 === 0 && this.opcFx)));
    const c = this.call, co = $('callout'); if (c) { c.life -= 1 / 60; co.innerHTML = `<span style="color:${c.col};font-size:${c.size}px">${c.t}</span><small>${c.s}</small>`; co.classList.toggle('on', c.life > 0); if (c.life <= 0) this.call = null; } else co.classList.remove('on');
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
  $('bMode').classList.toggle('on', state.play); $('bMode').textContent = state.play ? '🤖 Back to autoplay' : '🎮 Play it yourself';
  $('modeNote').innerHTML = state.play ? '<b>You play:</b> Q / E / R skills (1 s GCD), hold LMB or J for basics, WASD move, <b>F = draw</b> (once per 20 s cycle; hold F before the pull for the opener). Chains: E→R thrust, R→Q→E or R→E sweep, Q→Q or R→E→Q rising cut.' : `<b>Autoplay:</b> ${ROUTES[state.route].desc}.`;
}
$('bPlay').onclick = () => { state.paused = !state.paused; $('bPlay').textContent = state.paused ? '▶ Play' : '⏸ Pause'; };
$('bRestart').onclick = () => start();
$('sSpeed').onchange = (e) => { state.speed = +e.target.value; };
$('bMode').onclick = () => { state.play = !state.play; start(); };
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
