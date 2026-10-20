// The launch intro: a music-synced, in-engine showcase of all ten classes (2026-10-06).
// Plays on launch before the title screen (Options > 'Play intro on launch'), from the title's Watch Intro, skippable
// any time (Esc / Space / Enter / click / tap / gamepad). Everything on screen is the game itself: the real sim
// (client/introsim.js runs it on the theme's beat-map), the real Renderer, the real FX / class effects / finisher
// moments, the classic sprites. This file is the player: the theme music, the clock, the scripted camera, the class
// name cards, the cuts, the logo, the skip input and the offline capture mode (tools/intro-media.mjs).
import { Renderer } from './render.js';
import { FX } from './fx.js';
import { Feel } from './feel.js';
import { audioPref } from './audio.js';
import { governor, applyQuality } from './perf.js';
import { drawHeroThumb } from './art.js';
import { momentOn } from './fxmoment.js';
import { smoothFollow } from './smooth.js';
import { GroundCache } from './ground.js';
import { vfxPref } from './fxns.js';
import { Sim } from '../sim/sim.js';
import { generateWorld } from '../sim/world.js';
import { WORLD_SEED } from '../sim/constants.js';
import { CLASSES } from '../sim/data/classes.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { CUES } from './introcues.js';
import { PLAN } from './introplan.js';
import { SYNC } from './introsync.js';
import { timeline, Run, partBeat, beatOf, barTime, introEnd, finaleBeats, barBeat } from './introsim.js';
import { skipInput, gamepadEdge, pickTheme, loopPoint } from './introflow.js';

const INK = '#2b2433';
const FONT = "'Lilita One', 'Arial Black', 'Trebuchet MS', sans-serif";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (k) => k * k * (3 - 2 * k);
const easeOut = (k) => 1 - (1 - k) * (1 - k) * (1 - k);
const easeBack = (k) => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
let WORLD = null;
export const introWorld = () => WORLD || (WORLD = generateWorld(WORLD_SEED));

// ------------------------------------------------------------------------------------------------ the theme music
/** The theme (an <audio> element on a fully downloaded blob, so seeking / looping always works). Keeps playing under
 *  the title after the intro; loops back to the bass entrance when it ends; fades out when a game starts. */
export class Theme {
  constructor() {
    this.el = null; this.ready = null; this.gain = 1; this.fadeJob = null; this.muted = false;
    this.t0 = 0; this.n0 = 0; this.anchored = false; this.looping = false;
  }
  get volume() { return this.muted ? 0 : clamp((audioPref.music / 0.55) * 0.85, 0, 1); }
  applyVolume() { if (this.el) try { this.el.volume = clamp(this.volume * this.gain, 0, 1); } catch { /* iOS: read-only */ } }
  load() {
    if (this.ready) return this.ready;
    const el = this.el = document.createElement('audio');
    el.preload = 'auto'; el.crossOrigin = 'anonymous';
    el.addEventListener('ended', () => this.loop());
    const src = pickTheme((m) => el.canPlayType(m));
    const canPlay = () => new Promise((res) => {
      if (el.readyState >= 3) return res(true);
      const ok = () => { done(); res(true); }, bad = () => { done(); res(false); };
      const done = () => { el.removeEventListener('canplaythrough', ok); el.removeEventListener('error', bad); clearTimeout(to); };
      el.addEventListener('canplaythrough', ok); el.addEventListener('error', bad);
      const to = setTimeout(() => { done(); res(el.readyState >= 2); }, 9000);
    });
    this.ready = fetch(src).then((r) => { if (!r.ok) throw new Error('theme ' + r.status); return r.blob(); })
      .then((b) => { el.src = URL.createObjectURL(b); el.load(); return canPlay(); })
      .catch(() => { el.src = src; el.load(); return canPlay(); }) // (a direct stream: plays, seeking needs Range)
      .then((ok) => { this.ok = ok; this.applyVolume(); return ok; });
    return this.ready;
  }
  /** start at `from` s; resolves true when it plays, false when the browser blocks autoplay (no user gesture yet) */
  play(from = 0) {
    const el = this.el; if (!el || !this.ok) return Promise.resolve(false);
    this.cancelFade(); this.gain = 1; this.applyVolume();
    try { el.currentTime = from; } catch { /* not seekable yet */ }
    this.anchored = false;
    let p; try { p = el.play(); } catch (e) { return Promise.resolve(false); }
    return Promise.resolve(p).then(() => true, () => false);
  }
  get playing() { return !!(this.el && !this.el.paused && !this.el.ended); }
  /** the music clock (s): currentTime smoothed against the frame clock (currentTime moves in coarse steps) */
  time() {
    const el = this.el; if (!el) return 0;
    const now = performance.now() / 1000, ct = el.currentTime;
    if (el.paused) { this.anchored = false; return ct; }
    if (!this.anchored) { this.t0 = ct; this.n0 = now; this.anchored = true; this.lastCt = ct; return ct; }
    const pred = this.t0 + (now - this.n0) * (el.playbackRate || 1);
    if (ct !== this.lastCt) { // a fresh reading: snap on a jump, otherwise ease the anchor toward it
      this.lastCt = ct; const err = ct - pred;
      if (Math.abs(err) > 0.12) { this.t0 = ct; this.n0 = now; return ct; }
      this.t0 += err * 0.08;
    }
    return this.t0 + (now - this.n0) * (el.playbackRate || 1);
  }
  cancelFade() { if (this.fadeJob) { clearInterval(this.fadeJob); this.fadeJob = null; } }
  fadeTo(g, sec, then) {
    this.cancelFade(); const g0 = this.gain, t0 = performance.now();
    if (!(sec > 0)) { this.gain = g; this.applyVolume(); if (then) then(); return; }
    this.fadeJob = setInterval(() => { const k = clamp((performance.now() - t0) / (sec * 1000), 0, 1); this.gain = g0 + (g - g0) * k; this.applyVolume(); if (k >= 1) { this.cancelFade(); if (then) then(); } }, 40);
  }
  /** a game starts: fade out and stop */
  stop(sec = 1.5) { if (!this.el || this.el.paused) return; this.looping = false; this.fadeTo(0, sec, () => { try { this.el.pause(); } catch { /* ignore */ } }); }
  /** the track ended under the title: back to the bass entrance, faded in */
  loop() {
    const el = this.el; if (!el) return;
    this.gain = 0; this.applyVolume();
    try { el.currentTime = loopPoint(CUES); } catch { /* ignore */ }
    Promise.resolve(el.play()).then(() => this.fadeTo(1, 2.5)).catch(() => {});
  }
}

// ------------------------------------------------------------------------------------------------ drawing helpers
function strokeText(ctx, s, x, y, size, fill, lw, align = 'left') {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.strokeText(s, x, y);
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
/** the REALM BRAWL logo (the title screen's: yellow / red Lilita One, ink outline, ink drop) */
export function drawLogo(ctx, x, y, size, alpha = 1, shine = -1) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(-0.035);
  ctx.font = `${size}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
  const w1 = ctx.measureText('REALM').width, gap = size * 0.2, w2 = ctx.measureText('BRAWL').width, W = w1 + gap + w2, x1 = -W / 2, x2 = x1 + w1 + gap;
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = size * 0.13;
  for (const [s, xx] of [['REALM', x1], ['BRAWL', x2]]) { ctx.strokeText(s, xx, size * 0.1); ctx.fillText(s, xx, size * 0.1); }
  for (const [s, xx] of [['REALM', x1], ['BRAWL', x2]]) ctx.strokeText(s, xx, 0);
  ctx.fillStyle = '#ffd23f'; ctx.fillText('REALM', x1, 0);
  ctx.fillStyle = '#ff5e5b'; ctx.fillText('BRAWL', x2, 0);
  if (shine >= 0 && shine <= 1) { // a light sweep across the letters
    ctx.globalCompositeOperation = 'source-atop';
    const sx = x1 - size + (W + size * 2) * shine, g = ctx.createLinearGradient(sx - size * 0.5, 0, sx + size * 0.5, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x1 - size, -size, W + size * 2, size * 2);
  }
  ctx.restore();
}
const thumbs = new Map();
function thumbOf(cls) {
  let c = thumbs.get(cls);
  if (!c) { c = document.createElement('canvas'); c.width = c.height = 168; try { drawHeroThumb(c, cls, {}); } catch { /* cosmetic */ } thumbs.set(cls, c); }
  return c;
}
function shade(hex, k) { // k < 0 darker, > 0 lighter
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ------------------------------------------------------------------------------------------------ the player
const PRE = 1.6;
const WORLD_EV = new Set(['frost', 'dunes', 'ember', 'raid', 'astrael', 'tomb', 'crypt', 'forge', 'trial', 'hub', 'village']);
const WORLD_PH = new Set(['portal', 'call', 'unlock', 'victory', 'clear', 'cleared', 'open', 'wipe', 'reward', 'start']);
const QUIET = new Set(['xp', 'loot', 'gold', 'levelUp', 'drop', 'pickup', 'bagDrop', 'quest', 'kill']); // build the next scene this long before its cut (a Sim + heroes: a few ms, off the cut frame)

export class IntroPlayer {
  /** opts: { theme, audio (the game's sfx), onDone({ skipped }), capture (offline frames), mobile, from (s) } */
  constructor(opts = {}) {
    this.o = opts; this.theme = opts.theme || null; this.audio = opts.audio || null;
    this.parts = timeline(); this.END = introEnd(); this.FB = finaleBeats(this.parts.at(-1));
    this.done = false; this.cur = null; this.next = null; this.wall0 = 0; this.vt = opts.from || 0;
    this.pads = {}; this.ignoreUntil = 0; this.last = 0; this.flash = 0; this.kick = 0; this.fadeOut = 0;
    this.stats = { frames: 0, slow: 0, worst: 0, steps: 0 };
  }
  // ---- lifecycle
  start() {
    const cv = this.cv = document.createElement('canvas');
    cv.id = 'introCv'; cv.className = 'intro-cv';
    cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:9000;background:#000;cursor:pointer;touch-action:none';
    document.body.appendChild(cv);
    this.r = new Renderer(cv); this.r.resize(); this.baseZoom = this.r.cam.zoom;
    this.r.cinematic = true; // (no name tags / HP bars / ELITE tags; the game's own Renderer is untouched)
    this.r.ground = null; this.grounds = new Map();
    this.shader = null;
    this.onResize = () => { this.r.resize(); this.baseZoom = this.r.cam.zoom; };
    addEventListener('resize', this.onResize);
    this.onKey = (e) => { if (this.done || performance.now() < this.ignoreUntil) return; if (skipInput(e)) { e.preventDefault(); e.stopImmediatePropagation(); this.skip(); } };
    this.onPtr = (e) => { if (this.done || performance.now() < this.ignoreUntil) return; if (skipInput(e)) { e.preventDefault(); this.skip(); } };
    addEventListener('keydown', this.onKey, { capture: true });
    cv.addEventListener('pointerdown', this.onPtr);
    this.ignoreUntil = performance.now() + 450; // (the key / click that started the intro is not a skip)
    this.pollPads(); // (prime: a button already held at the start is not a press)
    if (this.audio && this.audio.master && this.audio.ctx) { try { this.sfx0 = this.audio.master.gain.value; this.audio.master.gain.setTargetAtTime(this.sfx0 * 0.5, this.audio.ctx.currentTime, 0.05); } catch { /* ignore */ } }
    this.wall0 = performance.now() / 1000 - (this.o.from || 0);
    this.lastT = null;
    if (!this.o.capture) this.raf = requestAnimationFrame((t) => this.frame(t));
    return this;
  }
  /** the intro clock: the music when it plays, else the wall clock (muted / blocked / still loading), else capture time */
  clock() {
    if (this.o.capture) return this.vt;
    if (this.theme && this.theme.playing) { const t = this.theme.time(); this.wall0 = performance.now() / 1000 - t; return t; }
    return performance.now() / 1000 - this.wall0;
  }
  skip() { if (this.done) return; this.finish(true); }
  /** true on the frame any gamepad button goes down */
  pollPads() { try { return typeof navigator !== 'undefined' && navigator.getGamepads ? gamepadEdge(Array.from(navigator.getGamepads()), this.pads) : false; } catch { return false; } }
  finish(skipped = false) {
    if (this.done) return; this.done = true;
    cancelAnimationFrame(this.raf);
    removeEventListener('keydown', this.onKey, { capture: true }); removeEventListener('resize', this.onResize);
    if (this.audio && this.audio.applyVolumes) try { this.audio.applyVolumes(); } catch { /* ignore */ }
    const cv = this.cv;
    if (cv) { cv.style.transition = `opacity ${skipped ? 0.25 : 0.5}s ease`; cv.style.pointerEvents = 'none'; requestAnimationFrame(() => { cv.style.opacity = '0'; }); setTimeout(() => { if (cv.parentNode) cv.parentNode.removeChild(cv); }, skipped ? 300 : 600); }
    this.grounds.clear(); this.cur = this.next = null;
    if (this.o.onDone) this.o.onDone({ skipped });
  }
  // ---- scenes
  partAt(t) { for (let i = this.parts.length - 1; i >= 0; i--) if (t >= this.parts[i].t0) return this.parts[i]; return this.parts[0]; }
  build(part) {
    const world = introWorld();
    const sc = { part, fx: new FX(), feel: new Feel(), cam: { x: 0, y: 0, vx: 0, vy: 0 }, lastT: part.t0, kickAt: -1 };
    if (this.shader) sc.fx.shader = this.shader; else this.shader = sc.fx.shader; // (one WebGL post layer for the whole intro)
    sc.fx.ultKeyLabel = () => 'T';
    sc.fx.cinematic = part.kind === 'finale' ? 'finale' : true; // (no damage numbers / combat labels / popups: only the cards, ult names, finisher bands, VICTORY)
    if (part.kind === 'open') {
      sc.sim = new Sim({ seed: 7300, spawnEnemies: false, world });
    } else {
      const run = sc.run = new Run(world, part, { sync: SYNC });
      sc.sim = run.sim;
      run.onSpawn = (h) => this.onSpawn(sc, h);
      run.onEvent = (ev) => this.onEvent(sc, ev);
      sc.main = run.main; sc.fx.localPid = sc.main ? sc.main.id : 0;
      sc.appears = [];
    }
    sc.ground = this.groundFor(part);
    return sc;
  }
  groundFor(part) { // each scene gets its own tile cache, pre-built a little at a time before its cut
    let g = this.grounds.get(part.i);
    if (!g) { g = { cache: new GroundCache({ max: 60 }), todo: null }; g.cache.indexDecor(introWorld()); this.grounds.set(part.i, g); }
    return g;
  }
  onSpawn(sc, h) { // the finale: a hero drops in (light pillar + ring in their colour)
    if (!sc.appears) return;
    sc.appears.push({ h, t: this.tNow ?? 0, color: CLASSES[h.cls].color });
    sc.fx.shake && sc.fx.shake(0.18);
  }
  onEvent(sc, ev) {
    const run = sc.run;
    if (QUIET.has(ev.type)) return; // (a showcase: no XP / loot / gold popups)
    if (WORLD_EV.has(ev.type) && WORLD_PH.has(ev.ph)) return; // (nor the world's portal / unlock / raid-clear callouts)
    if (ev.type === 'death') ev.color = ENEMIES[ev.etype]?.color;
    if (run.part.kind === 'finale' && ev.pid !== undefined) sc.fx.localPid = ev.pid; // (every hero's effects at full 'me' strength)
    try { sc.feel.handle(ev, { player: sc.fx.localPid ? run.sim.players.get(sc.fx.localPid) : sc.main, sim: run.sim, fx: sc.fx }); } catch { /* visual only */ }
    sc.fx.handle(ev, run.sim);
    if (this.audio && this.audio.ctx && !this.audio.muted && !this.o.capture) { try { const p = run.sim.players.get(sc.fx.localPid) || sc.main; this.audio.handle(ev, sc.fx.localPid, p); } catch { /* sfx are optional */ } }
  }
  /** pre-build a few ground tiles of a scene (the view it will open on) */
  warmGround(sc, n = 1) {
    const g = sc.ground;
    if (!g.todo) {
      const TS = 512, s = this.baseZoom * 1.15 * (this.r.dpr || 1), want = Math.round(TS * Math.min(2, Math.max(0.5, s))) / TS; g.todo = [];
      const centres = sc.part.kind === 'open' ? PLAN.open.shots.map((h) => ({ x: (h.at[0] + h.to[0]) / 2, y: (h.at[1] + h.to[1]) / 2, z: h.z[0] })) : [{ ...this.focusOf(sc, sc.part.t0, true), z: 0.8 }];
      const seen = new Set();
      for (const c of centres) {
        const vw = this.r.w / (this.baseZoom * c.z) / 2 + 260, vh = this.r.h / (this.baseZoom * c.z) / 2 + 200;
        for (let ty = Math.floor((c.y - vh) / TS); ty <= Math.floor((c.y + vh) / TS); ty++) for (let tx = Math.floor((c.x - vw) / TS); tx <= Math.floor((c.x + vw) / TS); tx++) { const k = tx + ',' + ty; if (!seen.has(k)) { seen.add(k); g.todo.push([tx, ty, want]); } }
      }
      g.cache.max = Math.max(g.cache.max, g.todo.length + 30);
    }
    while (n-- > 0 && g.todo.length) { const [tx, ty, want] = g.todo.shift(); g.cache.tile(tx, ty, want); }
  }
  // ---- camera
  /** where the camera looks in a scene at time t (world), before smoothing */
  focusOf(sc, t, initial = false) {
    const part = sc.part, seg = part.seg;
    if (part.kind === 'open') {
      const sh = this.shotAt(t), k = sh.k;
      return { x: sh.s.at[0] + (sh.s.to[0] - sh.s.at[0]) * k, y: sh.s.at[1] + (sh.s.to[1] - sh.s.at[1]) * k };
    }
    const run = sc.run, st = run.stage;
    if (part.kind === 'finale') return { x: st.x, y: st.y - 20 };
    const p = initial || !sc.main ? { x: st.x + seg.hero.at[0], y: st.y + seg.hero.at[1] } : sc.main;
    const b = run.boss && !run.boss.dead ? run.boss : { x: st.x + 100, y: st.y };
    const k = 0.42, off = this.camKey(sc, t, 'x', 0), offy = this.camKey(sc, t, 'y', 0);
    return { x: p.x + (b.x - p.x) * k + off, y: p.y + (b.y - p.y) * k + offy - 18 };
  }
  /** the cold open's shot at time t: { s, i, k (0..1 through the shot) } */
  shotAt(t) {
    const shots = PLAN.open.shots; let i = 0;
    for (let j = 0; j < shots.length; j++) if (t >= (j ? barTime(shots[j].bar) : -1e9)) i = j;
    const t0 = i ? barTime(shots[i].bar) : 0, t1 = shots[i + 1] ? barTime(shots[i + 1].bar) : barTime(PLAN.open.end);
    return { s: shots[i], i, k: clamp((t - t0) / (t1 - t0), 0, 1) };
  }
  /** a camera key value at time t (keys by beat, eased between; missing values hold the last one) */
  camKey(sc, t, key, dflt) {
    const keys = sc.part.seg && sc.part.seg.cam; if (!keys) return dflt;
    const b = beatOf(t) - barBeat(sc.part.bar);
    let prev = null, next = null;
    for (const k of keys) { if (k[key] === undefined) continue; if (k.b <= b) prev = k; else { next = k; break; } }
    if (!prev && !next) return dflt;
    if (!prev) return next[key];
    if (!next) return (key === 'x' || key === 'y') ? prev[key] * (1 - ease(clamp((b - prev.b) / 3.5, 0, 1))) : prev[key]; // (an opening pan offset eases back to the action)
    const kk = ease(clamp((b - prev.b) / (next.b - prev.b), 0, 1));
    return prev[key] + (next[key] - prev[key]) * kk;
  }
  zoomOf(sc, t) {
    const part = sc.part;
    if (part.kind === 'open') { const sh = this.shotAt(t); return sh.s.z[0] + (sh.s.z[1] - sh.s.z[0]) * sh.k; }
    if (part.kind === 'finale') {
      const b = beatOf(t) - barBeat(part.bar), FB = this.FB;
      if (b < FB.build) return 0.82 + 0.06 * clamp(b / FB.build, 0, 1);
      if (b < FB.drop) return 0.88 + 0.22 * ease(clamp((b - FB.build) / (FB.drop - FB.build), 0, 1));
      return 1.1 - 0.18 * ease(clamp((b - FB.drop) / 6, 0, 1));
    }
    return this.camKey(sc, t, 'z', 1);
  }
  // ---- the frame
  frame(now) {
    if (this.done) return;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 1 / 60; this.last = now;
    if (this.pollPads() && performance.now() >= this.ignoreUntil) { this.skip(); return; }
    const t0 = performance.now();
    this.renderAt(this.clock(), dt);
    const ms = performance.now() - t0; this.stats.frames++; if (dt > 1 / 50) this.stats.slow++; this.stats.worst = Math.max(this.stats.worst, ms);
    if (!this.o.capture && governor.update(dt * 1000)) applyQuality(this.r, this.cur && this.cur.fx);
    if (!this.done) this.raf = requestAnimationFrame((t) => this.frame(t));
  }
  /** draw the intro at time t (s into the theme); dt = the frame's real time (particles, camera smoothing) */
  renderAt(t, dt = 1 / 60) {
    this.tNow = t;
    if (t >= this.END + 0.05) { this.finish(false); return; }
    const part = this.partAt(t);
    if (!this.cur || this.cur.part !== part) { // the cut
      const sc = this.next && this.next.part === part ? this.next : this.build(part);
      this.next = null;
      for (const k of [...this.grounds.keys()]) if (k < part.i) this.grounds.delete(k);
      this.cur = sc; sc.cut = true;
      if (this.cur.fx && this._q !== undefined) applyQuality(this.r, this.cur.fx);
    }
    const sc = this.cur, np = this.parts[part.i + 1];
    if (np && !this.next && t > np.t0 - PRE) this.next = this.build(np);
    this.r.ground = sc.ground.cache; // (this scene's tile cache)
    // sim: step every tick that is due
    const run = sc.run;
    if (run) { let n = 0; while (run.time <= t && n < 40) { sc.lastT = run.time; run.step(); n++; } this.stats.steps += n; }
    const alpha = run ? clamp((t - sc.lastT) / Math.max(1e-6, run.time - sc.lastT), 0, 1) : 1;
    // camera
    const r = this.r, f = this.focusOf(sc, t);
    if (part.kind === 'open') { const si = this.shotAt(t).i; if (si !== sc.shot) { sc.shot = si; sc.cut = true; } }
    if (sc.cut) { sc.cam.x = f.x; sc.cam.y = f.y; sc.cam.vx = sc.cam.vy = 0; sc.cut = false; }
    else smoothFollow(sc.cam, f.x, f.y, dt, part.kind === 'open' ? 0.05 : 0.16);
    if (run && run.climaxAt !== null && sc.kickAt < 0) { sc.kickAt = t; this.kick = 1; }
    this.kick = Math.max(0, this.kick - dt * 2.2);
    r.cam.x = sc.cam.x; r.cam.y = sc.cam.y;
    r.cam.zoom = this.baseZoom * this.zoomOf(sc, t) * (1 + 0.1 * easeOut(this.kick));
    r.time += dt;
    sc.fx.update(dt);
    if (sc.fx.banners.length > 2) sc.fx.banners.splice(0, sc.fx.banners.length - 2);
    if (part.kind === 'finale' && t >= CUES.hits.stabs[0] - 0.15) sc.fx.banners.length = 0; // (the logo owns the frame)
    // draw the world
    const local = part.kind === 'open' ? { id: -1, x: 1e9, y: 1e9 } : (sc.fx.localPid && sc.sim.players.get(sc.fx.localPid)) || sc.main || { id: -1, x: 1e9, y: 1e9 };
    r.draw(sc.sim, local, alpha, sc.fx, null);
    // warm the next scene's ground while this one plays (a tile every other frame)
    if (this.next && (this.stats.frames & 1) === 0) this.warmGround(this.next, 1);
    // overlays
    const ctx = r.ctx; ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    const W = r.w, H = r.h;
    if (part.kind === 'finale') this.drawAppears(ctx, sc, t);
    this.drawBanners(ctx, sc, W, H);
    if (sc.fx.drawScreen) sc.fx.drawScreen(ctx, r, 1);
    this.drawLetterbox(ctx, W, H, t);
    if (part.kind === 'open') this.drawOpen(ctx, W, H, t);
    if (part.kind === 'seg') this.drawCard(ctx, W, H, sc, t);
    if (part.kind === 'finale') this.drawFinale(ctx, W, H, sc, t);
    this.drawCuts(ctx, W, H, t);
    this.drawFlash(ctx, W, H, t);
    if (!this.o.capture && this.o.hint !== false) this.drawSkipHint(ctx, W, H, t);
  }
  // ---- overlays
  drawBanners(ctx, sc, W, H) {
    if (momentOn(sc.fx)) return; // (a signature finisher has its own title band)
    let by = H * 0.2;
    for (const b of sc.fx.banners) {
      const k = b.t / b.life, s = k < 0.1 ? 1.6 - (k / 0.1) * 0.6 : 1, a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(W / 2, by); ctx.scale(s, s);
      strokeText(ctx, b.str, 0, 0, b.size, b.color, b.size * 0.2, 'center');
      if (b.sub) strokeText(ctx, b.sub, 0, b.size * 0.72, 18, '#fff', 4, 'center');
      ctx.restore();
      by += b.size + (b.sub ? 52 : 26);
    }
  }
  drawLetterbox(ctx, W, H, t) {
    const k = clamp(t / 2.1, 0, 1) * (1 - clamp((t - (this.END - 0.8)) / 0.8, 0, 1)), bh = Math.round(H * 0.075 * ease(k));
    if (bh <= 0) return;
    ctx.fillStyle = '#0b0810'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
  }
  drawSkipHint(ctx, W, H, t) {
    const a = clamp((t - 1.2) / 0.6, 0, 1) * 0.75; if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.font = "600 14px 'Trebuchet MS', sans-serif"; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const s = this.o.mobile ? 'Tap to skip' : 'Esc / Space / click to skip';
    ctx.fillStyle = 'rgba(0,0,0,.45)'; const w = ctx.measureText(s).width + 22; ctx.fillRect(W - w - 14, H - 36, w, 24);
    ctx.fillStyle = '#e6dcff'; ctx.fillText(s, W - 25, H - 24); ctx.restore();
  }
  drawOpen(ctx, W, H, t) {
    // fade in from black, the logo on bar 3, its subtitle on bar 5, out on bar 6
    const fin = 1 - clamp((t - 0.2) / 1.9, 0, 1);
    if (fin > 0) { ctx.fillStyle = `rgba(0,0,0,${fin.toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
    const tIn = barTime(3), tSub = barTime(5), tOut = barTime(6), tEnd = barTime(7);
    const size = Math.min(W * 0.13, H * 0.2);
    if (t >= tIn - 0.15) {
      const kin = clamp((t - (tIn - 0.15)) / 0.3, 0, 1), kout = clamp((t - tOut) / (tEnd - tOut - 0.1), 0, 1);
      const sc = (2.4 - 1.4 * easeBack(kin)) * (1 + 1.8 * kout * kout), a = clamp(kin * 1.6, 0, 1) * (1 - kout);
      ctx.save(); ctx.translate(W / 2, H * 0.44); ctx.scale(sc, sc);
      drawLogo(ctx, 0, 0, size, a, clamp((t - tIn - 0.25) / 0.9, -1, 2));
      ctx.restore();
      if (kin > 0 && kin < 1) { ctx.fillStyle = `rgba(255,255,255,${(0.5 * (1 - kin)).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
      if (t >= tSub && kout < 1) {
        const ks = clamp((t - tSub) / 0.25, 0, 1);
        ctx.save(); ctx.globalAlpha = ks * (1 - kout); ctx.translate(W / 2, H * 0.44 + size * 0.95); ctx.scale(0.8 + 0.2 * easeBack(ks), 0.8 + 0.2 * easeBack(ks));
        strokeText(ctx, PLAN.open.sub, 0, 0, Math.round(size * 0.3), '#fff', Math.round(size * 0.07), 'center');
        ctx.restore();
      }
    }
  }
  drawCard(ctx, W, H, sc, t) {
    const seg = sc.part.seg, C = CLASSES[seg.cls], col = C.color, b = beatOf(t) - barBeat(sc.part.bar);
    const kin = clamp((b - 0.15) / 0.9, 0, 1), kout = clamp((b - 6.6) / 0.8, 0, 1);
    const idx = PLAN.segs.indexOf(seg) + 1;
    if (kin > 0 && kout < 1) {
      const S = clamp(H / 760, 0.7, 1.5), x0 = W * 0.045 - (1 - easeBack(kin)) * W * 0.5 - easeOut(kout) * W * 0.6, y0 = H * 0.66;
      ctx.save(); ctx.translate(x0, y0); ctx.scale(S, S);
      // the slab: a skewed panel in the class colour, ink outline + drop, a darker band
      const sw = 520, sh = 118, sk = 26;
      const slab = (dx, dy, w, h) => { ctx.beginPath(); ctx.moveTo(dx + sk, dy); ctx.lineTo(dx + w + sk, dy); ctx.lineTo(dx + w - sk, dy + h); ctx.lineTo(dx - sk, dy + h); ctx.closePath(); };
      slab(8, 10, sw, sh); ctx.fillStyle = INK; ctx.fill();
      slab(0, 0, sw, sh); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
      ctx.save(); slab(0, 0, sw, sh); ctx.clip(); ctx.fillStyle = shade(col, -0.35); ctx.fillRect(-40, sh * 0.62, sw + 80, sh); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-40, 0, sw + 80, 10);
      const sh0 = ((t * 0.9) % 1.6) - 0.3; if (sh0 > 0 && sh0 < 1) { const gx = -60 + (sw + 120) * sh0, g = ctx.createLinearGradient(gx - 60, 0, gx + 60, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(-40, 0, sw + 80, sh); }
      ctx.restore();
      // portrait medallion
      const px = 66, py = sh / 2 - 4, pr = 62;
      ctx.beginPath(); ctx.arc(px + 5, py + 7, pr, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fillStyle = shade(col, 0.55); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.arc(px, py, pr - 4, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(thumbOf(seg.cls), px - pr - 8, py - pr - 12, pr * 2 + 16, pr * 2 + 16); ctx.restore();
      // number, name, tagline, signature
      strokeText(ctx, String(idx).padStart(2, '0') + ' / 10' + (seg.title ? '  ·  ' + seg.title.toUpperCase() : ''), 142, 18, 18, shade(col, 0.7), 5);
      ctx.save(); ctx.translate(140, 54); ctx.rotate(-0.025);
      const nameSize = seg.name.length > 12 ? 44 : 58; strokeText(ctx, seg.name.toUpperCase(), 0, 0, nameSize, '#fff', 10); ctx.restore();
      ctx.font = "italic 700 21px 'Trebuchet MS', sans-serif"; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeText(seg.tag, 146, 96); ctx.fillStyle = '#fff'; ctx.fillText(seg.tag, 146, 96);
      // the signature chip under the slab
      const chip = 'SIGNATURE  ·  ' + seg.sig; ctx.font = `20px ${FONT}`; const cw = ctx.measureText(chip).width + 30;
      slab(120, sh + 14, cw, 34); ctx.fillStyle = INK; ctx.fill();
      strokeText(ctx, chip, 135 + 6, sh + 31, 20, col, 4);
      ctx.restore();
    }
    // a small corner tag for the rest of the segment
    const kt = clamp((b - 7.2) / 0.5, 0, 1) * (1 - clamp((b - 23.2) / 0.6, 0, 1));
    if (kt > 0) {
      const S = clamp(H / 760, 0.7, 1.4), x = W - 26 * S, y = H * 0.075 + 34 * S;
      ctx.save(); ctx.globalAlpha = kt; ctx.translate(x + (1 - easeOut(kt)) * 160, y); ctx.scale(S, S);
      ctx.font = `30px ${FONT}`; const w = ctx.measureText(seg.name.toUpperCase()).width;
      ctx.beginPath(); ctx.arc(-w - 44, 0, 24, 0, Math.PI * 2); ctx.fillStyle = shade(col, 0.5); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.arc(-w - 44, 0, 21, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(thumbOf(seg.cls), -w - 72, -30, 56, 56); ctx.restore();
      strokeText(ctx, seg.name.toUpperCase(), 0, 1, 30, col, 7, 'right');
      ctx.restore();
    }
  }
  drawAppears(ctx, sc, t) { // a light pillar where each hero lands, in their colour
    const r = this.r;
    for (const a of sc.appears) {
      const k = (t - a.t) / 0.55; if (k < 0 || k > 1) continue;
      const p = r.worldToScreen(a.h.p.x, a.h.p.y), z = r.cam.zoom;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const w = (34 + 30 * k) * z, al = 1 - k;
      const g = ctx.createLinearGradient(0, p.y - 520 * z, 0, p.y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, a.color); g.addColorStop(1, '#fff');
      ctx.globalAlpha = al * 0.9; ctx.fillStyle = g; ctx.fillRect(p.x - w / 2, p.y - 520 * z, w, 520 * z);
      ctx.globalAlpha = al; ctx.lineWidth = 6 * z * (1 - k) + 1; ctx.strokeStyle = a.color; ctx.beginPath(); ctx.ellipse(p.x, p.y, (30 + 120 * easeOut(k)) * z, (16 + 60 * easeOut(k)) * z, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
  drawFinale(ctx, W, H, sc, t) {
    const part = sc.part, b = beatOf(t) - barBeat(part.bar), FB = this.FB;
    // the build: the edges darken and pulse on the beat as the ultimates light
    if (b >= FB.build && b < FB.drop) {
      const k = (b - FB.build) / (FB.drop - FB.build), pulse = 1 - (b % 1);
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(10,4,20,${(0.25 + 0.4 * k + 0.1 * pulse).toFixed(3)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // the logo slams in on the first bass stab after the drop, its line on the second
    const tSlam = CUES.hits.stabs[0], tLine = CUES.hits.stabs[1] ?? tSlam + 2.3;
    if (t >= tSlam - 0.08) {
      const k = clamp((t - (tSlam - 0.08)) / 0.16, 0, 1), size = Math.min(W * 0.14, H * 0.22);
      const s = 3.2 - 2.2 * easeOut(k), shake = (1 - clamp((t - tSlam) / 0.5, 0, 1)) * 10;
      ctx.save(); ctx.translate(W / 2 + (Math.sin(t * 90) * shake), H * 0.42 + Math.cos(t * 77) * shake); ctx.scale(s, s);
      drawLogo(ctx, 0, 0, size, clamp(k * 1.5, 0, 1), clamp((t - tSlam - 0.2) / 1.1, -1, 2));
      ctx.restore();
      const kr = clamp((t - tSlam) / 0.6, 0, 1); // shock ring
      if (kr > 0 && kr < 1) { ctx.save(); ctx.globalAlpha = 1 - kr; ctx.lineWidth = 14 * (1 - kr) + 2; ctx.strokeStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(W / 2, H * 0.42, W * 0.6 * easeOut(kr), H * 0.35 * easeOut(kr), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      if (t >= tLine - 0.05) {
        const kl = clamp((t - (tLine - 0.05)) / 0.22, 0, 1);
        ctx.save(); ctx.globalAlpha = kl; ctx.translate(W / 2, H * 0.42 + size * 0.95); const ss = 0.7 + 0.3 * easeBack(kl); ctx.scale(ss, ss);
        strokeText(ctx, PLAN.finale.line, 0, 0, Math.round(size * 0.28), '#fff', Math.round(size * 0.065), 'center');
        ctx.restore();
      }
    }
  }
  /** the cuts between scenes: a skewed slab in the next class colour sweeps across, centred on the downbeat */
  drawCuts(ctx, W, H, t) {
    for (let i = 1; i < this.parts.length; i++) {
      const p = this.parts[i], k = (t - (p.t0 - 0.13)) / 0.3; if (k < 0 || k > 1) continue;
      const col = p.kind === 'seg' ? CLASSES[p.seg.cls].color : '#ffd23f', prev = this.parts[i - 1], col2 = prev.kind === 'seg' ? CLASSES[prev.seg.cls].color : '#ff5e5b';
      const x = -W * 0.9 + (W * 2.2) * ease(k), sk = H * 0.35, w = W * 0.75;
      const band = (dx, ww, c) => { ctx.beginPath(); ctx.moveTo(x + dx + sk, 0); ctx.lineTo(x + dx + ww + sk, 0); ctx.lineTo(x + dx + ww - sk, H); ctx.lineTo(x + dx - sk, H); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); };
      band(-60, 60, col2); band(0, w, col); band(w, 26, INK); band(-86, 26, INK);
      ctx.save(); ctx.globalAlpha = 0.18; band(w * 0.15, w * 0.1, '#fff'); ctx.restore();
    }
  }
  /** white flashes on the big moments of the track: the bass entrance, the drop (the class climaxes flash in the FX) */
  drawFlash(ctx, W, H, t) {
    let a = 0;
    for (const [tt, s, len] of [[CUES.hits.bassIn, 0.55, 0.35], [CUES.hits.drop, 0.95, 0.7]]) { const k = (t - tt) / len; if (k >= 0 && k < 1) a = Math.max(a, s * (1 - k) * (1 - k)); }
    if (vfxPref.reduceFlash) a *= 0.25;
    if (a > 0.003) { ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  }
}
