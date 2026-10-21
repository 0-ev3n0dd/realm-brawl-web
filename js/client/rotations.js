// Rotation preview page (rotations.html): 10 class tabs x Boss / Mobbing views. Each view runs the REAL game engine in the page:
// the authoritative Sim (sim/sim.js) stepped at a fixed 60 Hz, the game's own Renderer + FX + HUD + hit-stop + SFX, with the
// hero piloted by the same rotation bot the headless optimizer measured (rotations/rotbot.js) in the same arena
// (rotations/arena.js). Data: /rotations/rotations.json (tools/rotations/optimize.mjs).
//   rotations.html?cls=monk&view=mob    deep link;  window.__rot exposes the live session to tools (tools/rotations/media.mjs)
import { BR_CLS } from '../sim/bossrot.js';
import { notation, mkLabel } from '../rotations/notation.js';
import { Sim } from '../sim/sim.js';
import { playNotes } from './playnotes.js';
import { DT } from '../sim/constants.js';
import { CLASSES } from '../sim/data/classes.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { Renderer } from './render.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { Feel } from './feel.js';
import { Audio } from './audio.js';
import { Keybinds } from './keybinds.js';
import { smoothFollow, SMOOTH } from './smooth.js';
import { governor, applyQuality, drawHudLayer } from './perf.js';
import { drawHeroThumb } from './art.js';
import { musicTick } from './music.js';
import { momentOn } from './fxmoment.js';
import { RotBot } from '../rotations/rotbot.js';
import { Arena, addHero, ARENA } from '../rotations/arena.js';
// Uniform fit (2026-10-15): below the 1600x900 design size (small windows, the hub's embedded preview, phones) the whole
// page is laid out at 1600x900 and scaled down as one picture, letterboxed - nothing squashes, clips or overlaps. At or
// above the design size (1080p, 1440p, ultrawide) it fills the window as before.
export const ROT_DW = 1600, ROT_DH = 900;
export function rotFit() {
  if (typeof document === 'undefined') return 1;
  const w = innerWidth, h = innerHeight, k = Math.min(w / ROT_DW, h / ROT_DH), on = k < 1, b = document.body;
  document.documentElement.classList.toggle('rot-fit', on);
  if (b) b.style.transform = on ? `translate(${((w - ROT_DW * k) / 2).toFixed(1)}px, ${((h - ROT_DH * k) / 2).toFixed(1)}px) scale(${k.toFixed(4)})` : '';
  window.__rotFitH = on ? ROT_DH : 0;
  return on ? k : 1;
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') { rotFit(); addEventListener('resize', rotFit); }

const $ = (id) => document.getElementById(id);
const ORDER = ['warrior', 'ranger', 'mage', 'cleric', 'bladedancer', 'samurai', 'monk', 'dragoon', 'summoner', 'bard'];
const qs = new URLSearchParams(location.search);
const keybinds = new Keybinds(window.localStorage); // (read only: the keycaps follow the player's own bindings)
const label = mkLabel((id) => keybinds.label(id)); // (every chip / text label comes from the slot keys through the player's binds: rotations/notation.js)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => { const v = Math.round((a / b - 1) * 1000) / 10; return (v >= 0 ? '+' : '') + v + '%'; };
const fmt = (n) => (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : Math.round(n).toLocaleString('en-US'));
governor.hudLayer = false; // (the HUD draws straight onto the stage canvas: no full-window HUD layer over the page chrome)

const audio = new Audio();
let data = null, session = null, cur = { cls: ORDER.includes(qs.get('cls')) ? qs.get('cls') : 'warrior', view: qs.get('view') === 'mob' ? 'mob' : 'boss' };

/** One live run: sim + arena + bot + the game's renderer stack on the stage canvas. */
class Session {
  constructor(canvas, cls, view, rot) {
    this.cls = cls; this.view = view; this.rot = rot; this.C = CLASSES[cls];
    this.sim = new Sim({ seed: 9101, spawnEnemies: false });
    this.player = addHero(this.sim, cls, 1, { name: this.C.name });
    this.arena = new Arena(this.sim, this.player, view).setup();
    this.bot = new RotBot(cls, rot.loop.map((u) => ({ keys: u.keys, chain: u.chain })), view, { gate: rot.gate, opener: (rot.opener || []).map((u) => ({ keys: u.keys, chain: u.chain })) });
    this.renderer = new Renderer(canvas);
    const stage = canvas.parentElement, r = this.renderer; // (#rotView)
    r.resize = function () { // (the stage area, not the whole window: same maths as Renderer.resize)
      const dpr0 = Math.min(2, window.devicePixelRatio || 1), dpr = dpr0 * (this.renderScale || 1), w = stage.clientWidth, h = stage.clientHeight;
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      this.dpr = dpr; this.w = w; this.h = h; this.cam.zoom = Math.max(0.75, Math.min(1.5, (window.__rotFitH || window.innerHeight) / 760)) * 1.12; // (the game's zoom for this window: heroes / fx at the size they are in game)
    };
    r.resize();
    this.fx = new FX(); this.fx.localPid = this.player.id; this.fx.ultKeyLabel = () => keybinds.label('ult');
    this.hud = new HUD(); this.hud.keyLabel = (id) => keybinds.label(id); this.hud.showChains = false;
    this.feel = new Feel();
    this.acc = 0; this.last = performance.now(); this.running = true; this.ticks = 0;
    this.win = []; this.lastPressed = null; this.feedN = 0;
    r.cam.x = this.player.x + 60; r.cam.y = this.player.y;
    this.onResize = () => r.resize(); addEventListener('resize', this.onResize);
    this.perf = { fps: 0, frames: 0, t: 0 };
    requestAnimationFrame((t) => this.frame(t));
  }
  stop() { this.running = false; removeEventListener('resize', this.onResize); }
  step() {
    const { sim, player: p, arena, bot } = this;
    arena.before();
    const t = RotBot.pickTarget(sim, p);
    this.target = t;
    sim.setInput(p.id, bot.input(sim, p, t));
    const d0 = arena.dealt;
    sim.step();
    for (const ev of sim.drainEvents()) this.onEvent(ev);
    arena.after();
    this.ticks++;
    if (p.uw || p.eclipse) this.lastUw = sim.tick;
    this.win.push(arena.dealt - d0); if (this.win.length > 300) this.win.shift(); // 5 s rolling window
    if (bot.pressed && bot.pressed !== this.lastPressed) { this.lastPressed = bot.pressed; ui.onPress(bot.pressed, bot); }
  }
  onEvent(ev) {
    if (ev.type === 'death') ev.color = ENEMIES[ev.etype]?.color;
    this.feel.handle(ev, this);
    this.fx.handle(ev, this.sim);
    if (!audio.muted && audio.ctx) audio.handle(ev, this.player.id, this.player);
    if (ev.pid !== this.player.id) return;
    if (ev.type === 'chain') {
      const ch = this.C.chains.find((c) => c.id === ev.id), keys = ch ? ch.seq.map(label).join(' → ') : '';
      if (ev.fin || (ch && ch.sp)) this.lastFin = this.sim.tick; // (finishers + Special 5-steps: big title moments)
      ui.feed(ev.name || ev.id, ev.fin ? `ult FINISHER · ${this.rot.ult.seq.map(label).join(' → ')}` : `chain · ${keys}`, ev.fin ? 'fin' : '');
    }
    if (ev.type === 'ult') ui.feed(ev.name || 'Ultimate', `${label('T')} · ultimate → ${this.rot.ult.routeName} route`, 'ult');
  }
  frame(now) {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const held = this.feel.update(dt);
    if (!held) { this.acc += dt; let n = 0; while (this.acc >= DT && n < 6) { this.step(); this.acc -= DT; n++; } if (n >= 6) this.acc = 0; }
    const alpha = this.acc / DT, p = this.player, r = this.renderer;
    const px = p.px + (p.x - p.px) * alpha, py = p.py + (p.y - p.py) * alpha;
    // camera: the hero, leaning toward the boss / the pack so both are in frame
    let tx = px, ty = py; const t = this.target;
    if (t && !t.dead) { const k = this.view === 'boss' ? 0.35 : 0.2; tx += (t.x - px) * k; ty += (t.y - py) * k; }
    ty -= 30 / (r.cam.zoom || 1); // (the hero sits a little below centre: under the chain banners, above the skill bar)
    smoothFollow(r.cam, tx, ty, dt, SMOOTH.cam * 0.8);
    r.time += dt;
    if (audio.ctx && !audio.muted) musicTick(audio, this.sim, p, dt, ui); // the game's own zone / fight music
    this.fx.update(dt);
    if (this.fx.banners.length > 1) this.fx.banners.splice(0, this.fx.banners.length - 1); // (preview: only the newest banner; the chain feed lists them all)
    this.moment = momentOn(this.fx);
    r.draw(this.sim, p, alpha, this.fx, this.view === 'boss' ? this.arena.boss : null);
    const ctx = r.ctx; ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    drawHudLayer(r, (c, d) => this.hud.draw(c, r.w, r.h, this.sim, p, this.fx, r.time, d), dt);
    if (governor.update(dt * 1000) || this._gq === undefined) { this._gq = governor.level; applyQuality(r, this.fx); }
    this.perf.frames++; this.perf.t += dt; if (this.perf.t >= 1) { this.perf.fps = this.perf.frames / this.perf.t; this.perf.frames = 0; this.perf.t = 0; }
    ui.tick(this);
    requestAnimationFrame((tt) => this.frame(tt));
  }
  get dps5() { const n = this.win.length; return n ? this.win.reduce((a, b) => a + b, 0) / (n / 60) : 0; }
}

// ------------------------------------------------------------------------------------------------ page UI
const ui = {
  caps: [], ultCaps: [], meterT: 0,
  build() {
    const tabs = $('rotTabs'); tabs.innerHTML = '';
    for (const id of ORDER) {
      const C = CLASSES[id], b = document.createElement('button');
      b.className = 'rot-tab'; b.dataset.cls = id; b.style.setProperty('--c', C.color); b.setAttribute('role', 'tab');
      b.innerHTML = `<canvas width="80" height="80"></canvas><span>${esc(C.name)}</span>`;
      try { drawHeroThumb(b.querySelector('canvas'), id, {}); } catch (e) { /* (thumb art is cosmetic) */ }
      b.onclick = () => select(id, cur.view);
      tabs.appendChild(b);
    }
    document.querySelectorAll('#rotViewToggle button').forEach((b) => { b.onclick = () => select(cur.cls, b.dataset.view); });
    $('soundBtn').onclick = () => { audio.ensure(); audio.muted = !audio.muted; if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume(); this.syncSound(); };
    $('restartBtn').onclick = () => select(cur.cls, cur.view, true);
    addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const i = ORDER.indexOf(cur.cls), j = (i + (e.key === 'ArrowRight' ? 1 : ORDER.length - 1)) % ORDER.length; select(ORDER[j], cur.view); }
      if (e.key === 'b' || e.key === 'm') select(cur.cls, e.key === 'b' ? 'boss' : 'mob');
    });
    audio.muted = true; this.syncSound();
  },
  syncSound() { $('soundBtn').textContent = audio.muted ? '🔇 Sound off' : '🔊 Sound on'; },
  show(cls, view, rot) {
    const C = CLASSES[cls];
    document.documentElement.style.setProperty('--c', C.color);
    document.querySelectorAll('.rot-tab').forEach((b) => { const on = b.dataset.cls === cls; b.classList.toggle('sel', on); b.setAttribute('aria-selected', on); });
    document.querySelectorAll('#rotViewToggle button').forEach((b) => { const on = b.dataset.view === view; b.classList.toggle('sel', on); b.setAttribute('aria-selected', on); });
    $('rotFeed').innerHTML = '';
    $('mKillsRow').style.display = view === 'mob' ? '' : 'none';
    $('mOpt').textContent = fmt(rot.dps);
    // keycap strip: one group per chain unit, indexed like RotBot.loop (opener units once, then the loop)
    const N = this.nota = notation(cls, view, rot, label);
    const seq = $('kSeq'); seq.innerHTML = ''; this.caps = []; this.units = [];
    N.units.forEach((u, ui2) => {
      if (N.wrap && (ui2 === 0 || ui2 === N.wrap)) { const l = document.createElement('span'); l.className = 'k-lbl k-phase'; l.textContent = ui2 === 0 ? 'Open (once):' : 'Loop ↻:'; seq.appendChild(l); }
      const g = document.createElement('div'); g.className = 'k-unit' + (u.phase === 'opener' ? ' opener' : '') + (u.sp ? ' hinge' : ''); g.dataset.phase = u.phase;
      const caps = document.createElement('div'); caps.className = 'k-caps';
      const row = [];
      const li = ui2 - N.wrap, st = li >= 0 ? rot.steps.filter((q) => q.unit === li) : [];
      u.keys.forEach((k, si) => {
        const c = document.createElement('div'); c.className = 'cap' + (k === 'SP' ? ' sp' : '') + (/^B/.test(k) ? ' lmb' : ''); c.dataset.slot = k;
        const chn = st[si] && st[si].chain ? st[si].chainName : (si === u.keys.length - 1 && u.chainName ? u.chainName : null);
        c.innerHTML = esc(u.labels[si]) + (chn ? '<i class="ch"></i>' : '');
        c.title = chn ? `${u.labels[si]} → ${chn}` : u.labels[si];
        caps.appendChild(c); row.push(c);
      });
      const nm = document.createElement('div'); nm.className = 'k-name';
      const fired = st.filter((x) => x.chainName).map((x) => x.chainName);
      nm.textContent = (u.sp && N.win ? '★ ' : '') + (fired.length ? fired.join(' → ') : (u.chainName || 'cast')) + (u.sp && N.win ? ` → ${N.win}` : '');
      g.append(caps, nm); seq.appendChild(g); this.caps.push(row); this.units.push(g);
    });
    const ult = $('kUlt'); ult.innerHTML = `<span class="k-lbl">${esc(N.ult.lbl)}</span>`; this.ultCaps = [];
    const tc = document.createElement('div'); tc.className = 'cap ult'; tc.dataset.slot = 'T'; tc.textContent = N.ult.label; ult.appendChild(tc); this.ultCap = tc;
    N.ult.seq.forEach((k, i) => { const c = document.createElement('div'); c.className = 'cap' + (i === N.ult.seq.length - 1 ? ' sp' : ''); c.dataset.slot = k; c.textContent = N.ult.labels[i]; c.title = N.ult.chainNames[i] || ''; ult.appendChild(c); this.ultCaps.push(c); });
    const rn = document.createElement('span'); rn.className = 'k-lbl'; rn.style.marginLeft = '8px'; rn.style.color = '#ff4fd8'; rn.textContent = '→ ' + N.ult.routeName; ult.appendChild(rn);
    this.side(cls, view, rot);
  },
  side(cls, view, rot) {
    const C = CLASSES[cls], other = data.classes[cls][view === 'boss' ? 'mob' : 'boss'];
    $('sideHead').innerHTML = `<h2>${esc(C.name)}</h2><div class="sub">${view === 'boss' ? 'Boss rotation · single target' : 'Mobbing rotation · 10-mob pack'} · ${esc(C.resource)}</div>`;
    const N = this.nota, steps = rot.steps.map((s, i) => `<li data-i="${i}"><span class="mini">${esc(label(s.slot))}</span><span class="nm">${esc(C.skills[s.slot] ? C.skills[s.slot].name : 'Basic attack')}</span>${s.chainName ? `<span class="ds">→ <b style="color:#ff9ef0">${esc(s.chainName)}</b></span>` : ''}</li>`).join('');
    const ult = N.ult.seq.map((k, i) => `<li><span class="mini">${esc(N.ult.labels[i])}</span><span class="nm">${esc(C.skills[k].name)}</span>${rot.ult.chainNames[i] ? `<span class="ds">→ <b style="color:#ff9ef0">${esc(rot.ult.chainNames[i])}</b></span>` : ''}</li>`).join('');
    const chains = Object.values(rot.chainsUsed).map((c) => `<div class="sb-chain"><span>${esc(c.name)}</span><b>${c.per90s.toFixed(1)}</b></div>`).join('');
    const vs = rot.baselineDps ? Math.round((rot.dps / rot.baselineDps - 1) * 100) : 0;
    $('sideBody').innerHTML = `
      <div class="sb-card"><h3>Measured (3 seeds × 90 s)</h3><div class="sb-stats">
        <div><b>${fmt(rot.dps)}</b><span>DPS with ult</span></div>
        <div><b>${fmt(rot.noUltDps)}</b><span>DPS, no ult</span></div>
        ${view === 'mob' ? `<div><b>${rot.kpm}</b><span>kills / min</span></div>` : `<div><b>${rot.ultsPer90s}</b><span>ults / 90 s</span></div>`}
        <div><b>${vs >= 0 ? '+' : ''}${vs}%</b><span>vs balance bot (${fmt(rot.baselineDps)})</span></div>
      </div></div>
      ${rot.windows ? `<div class="sb-card"><h3>Current rules · boss dummy</h3><div class="sb-stats">
        <div><b>${fmt(rot.windows.d180)}</b><span>DPS, 3 min</span></div>
        <div><b>${fmt(rot.windows.d480)}</b><span>DPS, 8 min</span></div>
        <div><b>${fmt(rot.windows.dMove)}</b><span>DPS, moving every 4 s</span></div>
        ${rot.old ? `<div><b>${pct(rot.windows.score, rot.old.windows.score)}</b><span>vs old order (${esc(rot.old.keys ? rot.old.keys.map((u) => u.map(label).join(' ')).join(' · ') : rot.old.loop.join(' · '))}: ${fmt(rot.old.windows.score)})</span></div>` : ''}
      </div>${rot.opener && rot.opener.length ? `<div class="sb-note">Opener (once): <code>${esc(N.text.opener)}</code></div>` : '<div class="sb-note">No opener: start straight into the loop.</div>'}<div class="sb-note">Weave basic attacks (LMB) between every GCD; they never break a chain. ${N.win ? `Boss cycle: ${esc(N.spName)} (${esc(label('SP'))}) as soon as it is up opens ${esc(N.win)}; cast the ultimate (${esc(label('T'))}) inside it, once per cycle` : `Pop the ultimate (${esc(label('T'))}) the moment it fills`}; its route chains are off the GCD.</div></div>` : ''}
      <div class="sb-card"><h3>How ${esc(C.name)} plays now</h3><div class="sb-note">${playNotes(cls, C, data.classes[cls].boss, label)}</div></div>
      <div class="sb-card"><h3>Loop (repeat) ↻</h3><ol class="sb-steps" id="sbSteps">${steps}</ol></div>
      <div class="sb-card"><h3>Ultimate (${esc(N.ult.label)}) ${N.win ? `in ${esc(N.win)}` : 'when full'} → ${esc(rot.ult.routeName)}</h3><ol class="sb-steps">${ult}</ol></div>
      <div class="sb-card"><h3>Chains fired per 90 s</h3>${chains}</div>
      <div class="sb-card"><h3>Other view</h3><div class="sb-note">${other ? `${view === 'boss' ? 'Mobbing' : 'Boss'}: <code>${esc(other.loop.map((u) => u.keys.map(label).join(' ')).join('  ·  '))}</code> · ${fmt(other.dps)} DPS` : 'not measured yet'}</div></div>
      <div class="sb-card"><h3>How this was found</h3><div class="sb-note">${esc(data.method)}. Level ${data.setup.level}, one gear tier for every class (tier ${data.setup.gear.tier}, rarity ${data.setup.gear.rarity}, +${data.setup.gear.up}, no set / exotic procs). ${view === 'boss' ? 'Target: Grimtusk pinned as a training boss (armour intact, no attacks, HP held at 60%).' : `Target: ${data.setup.mob.pack.length} mobs (wolves, imps, knights, golems, HP ×${data.setup.mob.hpMul}) that chase but never attack; each kill respawns 1 s later.`} ${N.win ? `The ult is cast inside ${esc(N.win)} (one per ~20 s Special cycle) and spent on the` : 'The ult is cast whenever full and spent on the'} ${esc(rot.ult.routeName)} finisher route. Between chains the hero swings basics while skills cool down; a chain that uses the Special (F) is skipped while the Special is on cooldown. ${rot.gate === 'first' ? 'Each chain starts as soon as its first key is ready (later keys are pressed as they come off cooldown, inside the chain window).' : 'Each chain starts once every key in it is ready.'} Keys (your binds): ${esc(label('F'))} = 4th skill, ${esc(label('SP'))} = Special, ${esc(label('T'))} = ultimate, ${esc(label('B1'))} = basic attack.</div></div>`;
    this.sideSteps = [...document.querySelectorAll('#sbSteps li')];
  },
  feed(name, sub, cls) {
    const f = $('rotFeed'), d = document.createElement('div');
    d.className = 'feed-item ' + cls; d.innerHTML = `${esc(name)}<small>${esc(sub)}</small>`;
    f.prepend(d);
    [...f.children].forEach((c, i) => { if (i >= 3) c.classList.add('old'); if (i >= 6) c.remove(); });
  },
  onPress(pr, bot) {
    const flash = (c) => { if (!c) return; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); clearTimeout(c._t); c._t = setTimeout(() => c.classList.remove('on'), 220); };
    if (pr.ult) flash(this.ultCap);
    else if (pr.route) flash(this.ultCaps[pr.step]);
    else if (!pr.fill && this.caps[pr.unit]) flash(this.caps[pr.unit][pr.step]);
  },
  tick(s) {
    const bot = s.bot, inUlt = bot.mode === 'route' || bot.mode === 'ult';
    $('rotKeys').classList.toggle('in-ult', inUlt);
    $('kMode').textContent = inUlt ? `ULTIMATE → ${s.rot.ult.routeName}` : bot.mode === 'unit' ? 'Rotation · chaining' : 'Rotation · basics while skills cool down';
    // next-key highlight
    let flat = 0;
    this.caps.forEach((row, ui2) => row.forEach((c, si) => {
      const isCur = !inUlt && ui2 === bot.ui && (bot.si < 0 ? si === 0 : si === bot.si);
      c.classList.toggle('next', isCur);
      c.classList.toggle('done', !inUlt && ui2 === bot.ui && bot.si > si);
      if (this.sideSteps && this.sideSteps[flat]) this.sideSteps[flat].classList.toggle('cur', isCur);
      flat++;
    }));
    this.units.forEach((g, i) => g.classList.toggle('cur', !inUlt && i === bot.ui));
    const host = s.player.uw || s.player.eclipse, rt = host && host.rt, ri = rt ? rt.st[s.view] : -1;
    this.ultCaps.forEach((c, i) => { c.classList.toggle('next', inUlt && i === ri); c.classList.toggle('done', inUlt && i < ri); });
    this.ultCap.classList.toggle('next', s.player.ult >= 100 && !host);
    // meter (4x / s)
    this.meterT += 1; if (this.meterT % 15) return;
    const secs = s.ticks / 60;
    $('mDps').textContent = fmt(s.dps5);
    $('mAvg').textContent = fmt(s.arena.dps);
    $('mKpm').textContent = secs > 5 ? (s.arena.kills / (secs / 60)).toFixed(0) : '–';
    $('mLoops').textContent = Math.floor(Math.max(0, bot.units - bot.wrap) / s.rot.loop.length);
    $('mTime').textContent = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
  },
};

function select(cls, view, force = false) {
  if (!data) return;
  if (!force && session && session.cls === cls && session.view === view) return;
  cur = { cls, view };
  const rot = data.classes[cls] && data.classes[cls][view];
  if (!rot) return;
  history.replaceState(null, '', `?cls=${cls}&view=${view}`);
  if (session) session.stop();
  ui.show(cls, view, rot);
  session = new Session($('game'), cls, view, rot);
  window.__rot.session = session;
}

window.__rot = { session: null, get nota() { return ui.nota; }, select: (c, v) => select(c, v), get data() { return data; }, audio };
ui.build();
fetch('rotations/rotations.json', { cache: 'no-cache' }).then((r) => r.json()).then((j) => { data = j; select(cur.cls, cur.view, true); })
  .catch((e) => { console.error(e); $('rotView').insertAdjacentHTML('beforeend', `<div id="rotLoading">Could not load rotations.json (${esc(e.message)}). Run <code>node tools/rotations/optimize.mjs</code>.</div>`); });

