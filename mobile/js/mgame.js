// Mobile solo game session: local Sim at a fixed 60 Hz, touch controls -> sim input commands,
// auto-aim, adaptive quality, pause when the app goes to the background.
import { sprintEnded } from '../../js/client/sprintfx.js';
import { inAstral } from '../../js/client/astralui.js';
import { DC } from '../../js/client/duelcine.js';
import { computeStats } from '../../js/sim/progression.js';
import { modalUp } from '../../js/client/bigmap.js';
import { saveSettings } from './settings.js';
import { FrameProfiler, PerfOverlay, HudLayer, autoStep } from './perf.js';
import { bossCamY } from '../../js/client/cambias.js';
import { Sim } from '../../js/sim/sim.js';
import { bindHubLayout } from '../../js/client/worldpaint.js';
import { DT } from '../../js/sim/constants.js';
import { ENEMIES } from '../../js/sim/data/enemies.js';
import { CLASSES } from '../../js/sim/data/classes.js';
import { serializeCharacter } from '../../js/sim/save.js';
import { pointBlocked } from '../../js/sim/world.js';
import { inTownArea, hubClerk, hubCounter } from '../../js/sim/townconst.js';
import { handleCommand } from '../../js/sim/player.js';
import { MobileRenderer, MobileFX } from './mrender.js';
import { MobileHUD } from './mhud.js';
import { syncRaidButton } from '../../js/client/raidfx.js';
import { syncAstraelButton, astraelSlow } from '../../js/client/astraelfx.js';
import { TownUI, syncTownButton, loadUnlocks } from '../../js/client/townui.js';
import { OpsUI } from '../../js/client/opsui.js'; // mission dungeon entrances: tap the prompt for the mission card
import { packHub, trialBits, trialLocks } from '../../js/sim/hub.js';
export const MOBILE_UNLOCK_KEY = 'realmbrawl.mobile.unlocks';
import { slotTooltip, tooltipHTML } from '../../js/client/tooltips.js';
import { holdable } from '../../js/client/skillhold.js';
import { MobileUI } from './mui.js';
import { MenuHub } from '../../js/client/menuhub.js'; // parity pass: the PC menu hub (Character / Stash / World Map / Forge / Chains / Collection / Options)
import { UI as BagUI } from '../../js/client/ui.js';
import { Rewards, profile } from '../../js/client/rewards.js';
import { ProgressUI } from '../../js/client/progressui.js';
import { VillageUI } from '../../js/client/village.js';
import { Story } from '../../js/client/story.js';
import { MobileOptions } from './mopts.js';
import { seedBag, syncBag } from '../../js/client/bagui.js';
import { LoadoutFX } from '../../js/client/loadoutfx.js';
import { smoothFollow, SMOOTH } from '../../js/client/smooth.js';
import { musicTick } from '../../js/client/music.js';
import { DeathFlow } from '../../js/client/deathflow.js';
import { TouchControls, layoutControls, pickAutoTarget, leadPoint, skillDragPoint, skillTapPoint, AUTO_AIM_RANGE, LEAD_SPEED } from './touch.js';

const $ = (id) => document.getElementById(id);

/** Cheap line-of-sight test against rocks/pillars/trees (sampled every 40 units). */
function makeBlocked(world) {
  return (x1, y1, x2, y2) => {
    const d = Math.hypot(x2 - x1, y2 - y1), n = Math.floor(d / 40);
    for (let i = 1; i < n; i++) { const k = i / n; if (pointBlocked(world, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 2)) return true; }
    return false;
  };
}

/** Skill id behind a button: Q/E/R/F skills, 'SP' = the Special, 'T' = the class ultimate. */
const skillIdFor = (cls, key) => (key === 'T' ? CLASSES[cls].ult.id : (CLASSES[cls].skills[key] || { id: 'basic' }).id);

export class MobileGame {
  constructor({ canvas, char, store, audio, settings, safe, onQuit }) {
    this.isMobile = true; // (shared panels: no key hints)
    this.canvas = canvas; this.store = store; this.audio = audio; this.settings = settings; this.onQuit = onQuit;
    this.safeFn = safe;
    this.sim = new Sim({ seed: (Date.now() & 0xffffff) >>> 0, hub: true, hordeScale: 0.55 }); // (phone: a lighter horde) // hub: start in Brightwater Village (sim/hub.js)
    this.unbindHub = bindHubLayout(this.sim); // painted tavern hub / classic village (Options > Art style)
    this.player = this.sim.addPlayer(seedBag(char)); // (inventory pass: 64+ bag slots from the shared account profile)
    this.player.unlocks = loadUnlocks(MOBILE_UNLOCK_KEY); // Astrael (Extreme) unlock, saved on this phone
    { const P = this.player; P.stats = computeStats(P); P.hp = P.stats.maxHp; P.res = Math.min(P.res, P.stats.maxRes); } // (Part B: Ascended stats need the unlock flags)
    this.town = new TownUI(this, { mobile: true, unlockKey: MOBILE_UNLOCK_KEY }); // tap the "Mission Counter" button at the counter
    this.ops = new OpsUI(this, { mobile: true });
    this.quality = settings.quality === 'low' ? 0 : 2;
    this.renderer = new MobileRenderer(canvas, { quality: this.quality, camera: settings.camera });
    this.hudLayer = new HudLayer(document.getElementById('hud'));
    if (settings.perfOverlay) this.perfOverlay = new PerfOverlay();
    this.renderer.resize();
    this.fx = new MobileFX(); this.fx.localPid = this.player.id; this.fx.setQuality(this.quality); this.fx.loot.audio = audio; // (pickup sounds)
    this.hud = new MobileHUD();
    this.layout = null;
    this.relayout();
    this.touch = new TouchControls(canvas, () => this.layout);
    this.hud.bigMap.touch = true; this.touch.mapAt = (x, y) => this.hud.bigMap.open && this.hud.bigMap.inside(x, y); this.touch.onMapTap = (x, y) => { const B = this.hud.bigMap; if (B.open) { if (!B.inside(x, y)) B.close(); else B.tap(x, y, true); return true; } if (B.onMinimap(x, y) && !modalUp(this)) { B.toggle(true); return true; } return this.worldTap(x, y); }; // (+ a tap on a town NPC / the Mission Counter / a mission entrance opens it: worldTap) // (a tap on the minimap opens the big map, any tap closes it)
    this.touch.canHold = (key) => holdable(this.player, key); // Warrior: long-press = charge a 🔥 Rage hold (tooltip when there is no Rage to spend)
    // long-press a skill button: its tooltip (same text as the desktop hover tooltip)
    this.tipEl = document.createElement('div'); this.tipEl.id = 'mTip'; this.tipEl.className = 'rb-tip mtip hidden'; document.body.appendChild(this.tipEl); this.tipKey = null;
    // parity pass (2026-10-07): the same village services + menu hub as the PC (they only issue sim commands)
    this.options = new MobileOptions(this);
    this.menuHub = new MenuHub(this, { coop: false, touch: true }); // (its DOM holds the bag + gear slots: built before the bag UI binds them)
    document.body.classList.add('rb-touch');
    this.ui = new MobileUI(this);
    this.hubBag = new BagUI(this, { touch: true, inspect: (ref) => this.ui.inspect(ref) });
    this.rewards = new Rewards(this); this.progress = new ProgressUI(this); this.village = new VillageUI(this); this.story = new Story(this);
    this.death = new DeathFlow(this); // death screen: checkpoint / village buttons (shared with desktop)
    this.blocked = makeBlocked(this.sim.world);
    this.acc = 0; this.last = performance.now();
    this.running = true; this.paused = false; this.menuPaused = false;
    this.timeScale = 1; this.slowT = 0; this.saveT = 0;
    this.targetId = 0; this.target = null;
    this.lastAim = { x: 1, y: 0 };
    this.aimOverride = null;     // {x, y, key, ttl}: keeps a cast skill aimed until the sim starts it
    this.pendingAfterTick = [];
    this.hintsT = 12;            // show control hints for the first seconds
    this.stats = { attacks: 0, skills: 0, chains: 0, dodges: 0, kills: 0, hits: 0, backstabs: 0, gapCloses: 0, heals: 0, ults: 0 };
    this.prof = new FrameProfiler(); // per-frame breakdown: sim / fx / render / hud / dom (mobile/js/perf.js; the bench + the overlay read it)
    this.perf = { fps: 60, frameMs: 0, stepMs: 0, frames: 0, fpsT: 0, qT: 0, lowT: 0, highT: 0, qualityChanges: [], longFrames: 0, hist: [] };
    this.applySettings();
    this.onResize = () => { this.renderer.resize(); this.relayout(); };
    addEventListener('resize', this.onResize);
    addEventListener('orientationchange', this.onResize);
    this.onVis = () => { if (document.hidden) this.background(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.onPageHide = () => this.save();
    addEventListener('pagehide', this.onPageHide);
    this.renderer.cam.x = this.player.x; this.renderer.cam.y = this.player.y;
    this.fx.banner('BRIGHTWATER VILLAGE', '#ffd23f', 'Walk to the Mission Counter and tap it to pick a mission', 3, 44);
    this.save();
    requestAnimationFrame((t) => this.frame(t));
  }

  applySettings() {
    const s = this.settings;
    this.audio.muted = !s.sound;
    const tablet = Math.min(innerWidth, innerHeight) >= 600;
    this.hud.showChains = s.chains === 'on' || (s.chains === 'auto' && tablet);
    if (this.renderer.camera !== s.camera) { this.renderer.camera = s.camera; this.renderer.resize(); }
    if (s.quality === 'low' && this.quality !== 0) this.setQuality(0, 'setting');
    if (s.quality === 'high' && this.quality !== 2) this.setQuality(2, 'setting');
    this.relayout();
  }
  relayout() {
    const s = this.safeFn();
    this.hud.safe = s;
    this.layout = layoutControls(this.renderer.w, this.renderer.h, s, this.settings.joystick, { keys: Object.keys(CLASSES[this.player.cls].skills).filter((k) => k !== 'SP'), special: !!CLASSES[this.player.cls].skills.SP }); // (the Special gets its own button)
  }
  setQuality(q, why) {
    if (q === this.quality) return;
    this.quality = q;
    this.renderer.quality = q; this.renderer.resize();
    this.fx.setQuality(q);
    this.perf.qualityChanges.push({ q, why, t: +(performance.now() / 1000).toFixed(1), fps: +this.perf.fps.toFixed(1) });
  }

  command(c) { this.sim.command(this.player.id, c); }
  hubInfo() { const h = packHub(this.sim) || { m: 'town' }; const U = this.player.unlocks || {}; return { m: h.m, as: !!h.as2, host: true, x: !!U.astx, last: h.l, coop: false, u: { dunes: !!U.dunes, tomb: !!U.tomb, frost: !!(U.frost || U.tomb), crypt: !!U.crypt, ember: !!(U.ember || U.crypt), forge: !!U.forge, ...trialLocks(trialBits(this.player)) } }; }
  onBoard(v) { this.boardOpen = v; this.onMenuChange(); }
  afterTick(fn) { this.pendingAfterTick.push(fn); }
  save() { try { this.store.upsert(serializeCharacter(this.player)); this.player.dirty = false; } catch (e) { console.warn('save failed', e); } }
  /** (2026-10-09: no pause menu) true = the ❚❚ button / going to the background: the hub on Options (the solo world holds
   *  while it is up); false = close it */
  setPaused(v) {
    this.paused = false; if (this.touch) this.touch.reset();
    if (v) { this.save(); if (this.menuHub) this.menuHub.open('options'); }
    else if (this.menuHub && this.menuHub.isOpen()) this.menuHub.close();
    this.onMenuChange();
  }
  /** Show/hide the long-press tooltip for a skill button (tc.tip = {key}); the button name stands in for the key. */
  updateTip(tip, p) {
    const key = tip ? tip.key : null;
    if (key === this.tipKey) return;
    this.tipKey = key;
    if (!key) { this.tipEl.classList.add('hidden'); return; }
    const slot = key === 'T' ? 'ult' : key;
    const label = (id) => ({ attack: 'ATK', dodge: 'DODGE', ult: 'ULT' }[id] || id.replace('skill', '')) + ' button';
    this.tipEl.innerHTML = tooltipHTML(slotTooltip(p.cls, slot, { keyLabel: label, p, tick: this.sim.tick })) + '<div class="tt-foot">Release to close · a short tap casts</div>';
    this.tipEl.dataset.slot = slot;
    this.tipEl.classList.remove('hidden');
  }
  /** phone: a tap on the world (not a button): a town NPC / object, the Mission Counter clerk, a mission / boss entrance.
   *  In reach it opens like the desktop Interact key; a bit too far it says to walk closer. true = handled (no joystick). */
  worldTap(sx, sy) {
    if (this.paused || this.menuPaused || this.player.dead) return false;
    const w = this.renderer.screenToWorld(sx, sy), p = this.player;
    if (this.village && this.village.tapAt(w.x, w.y)) return true;
    const ly = this.sim.world && this.sim.world.hubLayout, ck = hubClerk(ly), ct = hubCounter(ly);
    if (inTownArea(p.x, p.y) && (Math.hypot(w.x - ck.x, w.y - (ck.y - 30)) < 80 || Math.hypot(w.x - ct.x, w.y - ct.y) < 70)) {
      if (this.town.canInteract()) this.town.interact(); else this.fx.text(p.x, p.y - 70, 'Walk up to the Mission Counter', { size: 16, color: '#ffe9a0', vy: -30, life: 1.4, pop: 1.2 });
      return true;
    }
    const g = (this.sim.world.opsGates || []).find((q) => Math.hypot(w.x - q.x, w.y - (q.y - 40)) < 110);
    if (g && !this.sim.noPortals) {
      if (Math.hypot(p.x - g.x, p.y - g.y) < 170 && this.ops.interact()) return true;
      this.fx.text(p.x, p.y - 70, 'Walk up to the entrance', { size: 16, color: '#ffe9a0', vy: -30, life: 1.4, pop: 1.2 }); return true;
    }
    return false;
  }
  /** a full-screen panel is up (the world holds, the sticks are released) */
  panelOpen() { return !!((this.menuHub && this.menuHub.isOpen()) || (this.progress && this.progress.isOpen()) || (this.rewards && this.rewards.isOpen()) || (this.village && this.village.isOpen()) || (this.story && this.story.isOpen()) || (this.town && this.town.open) || (this.ops && this.ops.open)); }
  onMenuChange() { this.menuPaused = (this.ui ? this.ui.modal : false) || !!this.boardOpen || this.panelOpen(); if (this.menuPaused && this.touch) this.touch.reset(); }
  background() {
    if (!this.running) return;
    this.save();
    if (!(this.menuHub && this.menuHub.isOpen())) this.setPaused(true);
    if (this.audio.ctx && this.audio.ctx.state === 'running') this.audio.ctx.suspend().catch(() => {});
  }
  quit() { if (this.hudLayer && this.hudLayer.ctx) { const c = this.hudLayer.c; this.hudLayer.ctx.setTransform(1, 0, 0, 1, 0, 0); this.hudLayer.ctx.clearRect(0, 0, c.width, c.height); }
    if (this.audio.music) this.audio.music.update(null); if (this.death) this.death.destroy();
    if (this.unbindHub) this.unbindHub();
    this.save(); this.running = false;
    if (this.menuHub) this.menuHub.destroy(); if (this.hubBag) this.hubBag.destroy(); this.rewards.destroy(); this.progress.destroy(); this.village.destroy(); this.story.destroy(); if (this.options) this.options.destroy();
    document.body.classList.remove('rb-touch');
    this.ui.destroy(); this.touch.destroy(); this.tipEl.remove(); this.town.destroy(); this.ops.destroy();
    removeEventListener('resize', this.onResize); removeEventListener('orientationchange', this.onResize);
    document.removeEventListener('visibilitychange', this.onVis); removeEventListener('pagehide', this.onPageHide);
    $('pause').classList.add('hidden');
    this.onQuit && this.onQuit();
  }

  // ------------------------------------------------------------------ input -> sim command
  aimDir() { const p = this.player; return Math.atan2(this.lastAim.y, this.lastAim.x) || p.aim; }
  buildCommand() {
    const p = this.player, t = this.touch, cls = p.cls;
    const mv = t.move;
    const moving = Math.hypot(mv.x, mv.y) > 0.15;
    // auto-aim target (only enemies reasonably in front of the move direction are preferred)
    const range = AUTO_AIM_RANGE[cls] || 500;
    this.target = null;
    if (this.settings.autoAim && !p.dead) {
      this.target = pickAutoTarget(this.sim.enemies, p, { range, dir: moving ? Math.atan2(mv.y, mv.x) : p.aim, prevId: this.targetId, blocked: this.blocked });
    }
    this.targetId = this.target ? this.target.id : 0;
    let ax, ay;
    const o = this.aimOverride;
    if (o && o.ttl > 0) { ax = o.x; ay = o.y; o.ttl--; if (p.action && p.action.kind === 'skill' && p.action.key === o.key) this.aimOverride = null; }
    else if (t.attack.held && t.attack.manual) { const d = Math.hypot(t.attack.dx, t.attack.dy) || 1; ax = p.x + (t.attack.dx / d) * 300; ay = p.y + (t.attack.dy / d) * 300; }
    else if (t.skillDrag && t.skillDrag.manual) {
      const pt = skillDragPoint(skillIdFor(cls, t.skillDrag.key, p), p, t.skillDrag.dx, t.skillDrag.dy, this.layout.dragMax);
      if (pt) { ax = pt.x; ay = pt.y; }
    }
    if (ax == null && this.target) { const lp = leadPoint(p, this.target, LEAD_SPEED[cls]); ax = lp.x; ay = lp.y; }
    if (ax == null && moving) { ax = p.x + mv.x * 200; ay = p.y + mv.y * 200; }
    if (ax == null) { ax = p.x + this.lastAim.x * 200; ay = p.y + this.lastAim.y * 200; }
    const dl = Math.hypot(ax - p.x, ay - p.y);
    if (dl > 1) this.lastAim = { x: (ax - p.x) / dl, y: (ay - p.y) / dl };
    const cmd = { mx: mv.x, my: mv.y, ax, ay, attack: t.attack.held && !this.menuPaused };
    if (t.sprintOn) { if (sprintEnded(p, t)) t.sprintOn = false; else cmd.sprint = true; } // sprint toggle: ends on entering combat (client/sprintfx.js)
    this.lastCmd = cmd;
    const e = t.takeEdge();
    if (e && e.dodge) cmd.dodge = true;
    else if (e && e.skill === 'T' && (p.ult || 0) < 100) this.ui.toast(`Ultimate not ready (${Math.floor(p.ult || 0)}%) - land chain combos!`, 1100); // button is disabled until full
    else if (e && e.skill) {
      const sk = { id: skillIdFor(cls, e.skill) };
      const pt = e.manual ? skillDragPoint(sk.id, p, e.dx, e.dy, this.layout.dragMax)
        : skillTapPoint(sk.id, p, this.target ? leadPoint(p, this.target, 900) : null, Math.atan2(this.lastAim.y, this.lastAim.x), mv);
      if (pt) { cmd.ax = pt.x; cmd.ay = pt.y; this.aimOverride = { x: pt.x, y: pt.y, key: e.skill, ttl: 18 }; }
      if (e.skill === 'T') cmd.ult = true; else { cmd.skill = e.skill; if (e.charge) cmd.charge = e.charge; } // (Warrior: a held press carries its charge = 🔥 empowered)
    }
    const hs = t.holdState();
    if (hs) cmd.hold = hs.key; // (charge-up visual + the string window waits while you charge)
    return cmd;
  }

  step() {
    const t0 = performance.now();
    this.sim.setInput(this.player.id, this.buildCommand());
    this.sim.step();
    for (const ev of this.sim.drainEvents()) this.onEvent(ev);
    if (this.sim.tick % 120 === 0) syncBag(this, this.player);
    if (this.pendingAfterTick.length) { const l = this.pendingAfterTick; this.pendingAfterTick = []; for (const f of l) f(); }
    this.perf.stepMs = this.perf.stepMs * 0.95 + (performance.now() - t0) * 0.05;
  }
  onEvent(ev) {
    if (ev.type === 'death') ev.color = ENEMIES[ev.etype]?.color;
    this.fx.handle(ev, this.sim);
    this.audio.handle(ev, this.player.id, this.player);
    this.death.onEvent(ev);
    this.town.onEvent(ev, this.player.id);
    this.rewards.onEvent(ev); this.village.onEvent(ev);
    if (ev.type === 'loadout' && ev.pid === this.player.id) { (this.loFx || (this.loFx = new LoadoutFX(this))).onEvent(ev); this.ui.onLoadout(ev); } // step 4: presets (basic phone support)
    const asl = astraelSlow(ev); if (asl) this.slow(asl.sec, asl.scale); // Astrael: slow motion on the big moments (solo)
    if (ev.pid !== this.player.id && ev.pid !== undefined && ev.type !== 'loot') return;
    switch (ev.type) {
      case 'attack': this.stats.attacks++; break;
      case 'skill': this.stats.skills++; break;
      case 'ult': this.stats.ults++; this.slow(0.2, 0.4); break;
      case 'dodge': this.stats.dodges++; break;
      case 'hit': this.stats.hits++; break;
      case 'backstab': this.stats.backstabs++; break;
      case 'gapClose': this.stats.gapCloses++; break;
      case 'heal': this.stats.heals++; break;
      case 'chain': this.stats.chains++; this.slow(0.12, 0.35); break;
      case 'ttcStart': this.slow(0.4, 0.3); break; // Eclipse finishers: real slow-mo in solo (deterministic: the sim just steps slower)
      case 'crescentImpact': this.slow(0.35, 0.25); break;
      case 'death': if (ev.killer === this.player.id) this.stats.kills++; if (ev.boss) this.slow(0.8, 0.25); break;
      case 'levelup': case 'pickup': this.save(); break;
      case 'playerDeath': this.ui.onDeath(ev); this.touch.reset(); this.save(); break;
      case 'invFull': this.fx.banner('INVENTORY FULL', '#ff5e5b', 'Open the bag and drop something first', 1.4, 30); break;
      case 'nores': this.ui.toast(ev.key === 'T' ? 'Ultimate not ready' : `Not enough ${CLASSES[this.player.cls].resource}`, 900); break;
    }
    if (navigator.vibrate && this.settings.sound && (!navigator.userActivation || navigator.userActivation.hasBeenActive) && ((ev.type === 'hurt' && ev.heavy) || ev.type === 'playerDeath')) { try { navigator.vibrate(ev.type === 'playerDeath' ? 120 : 30); } catch {} }
  }
  setPerfOverlay(on) { this.settings.perfOverlay = !!on; this.perfOverlay = on ? (this.perfOverlay || new PerfOverlay()) : null; try { saveSettings(localStorage, this.settings); } catch { /* */ } }
  slow(sec, scale) { this.slowT = Math.max(this.slowT, sec); this.timeScale = scale; }

  // ------------------------------------------------------------------ frame
  frame(now) {
    if (!this.running) return;
    const f0 = performance.now(); this.prof.begin(f0);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.timeScale = 1; }
    if (this.panelOpen() !== !!this._panel) { this._panel = this.panelOpen(); this.onMenuChange(); }
    const frozen = this.paused || this.menuPaused;
    this.touch.enabled = !frozen;
    if (!frozen) {
      this.acc += dt * this.timeScale;
      let n = 0;
      while (this.acc >= DT && n < 5) { this.step(); this.acc -= DT; n++; }
      this.prof.mark(0);
      if (n >= 5) this.acc = 0;
    }
    // menus pause the solo world, but inventory actions (equip/drop/take) still apply right away
    if (frozen && this.player.commands.length) {
      while (this.player.commands.length) handleCommand(this.sim, this.player, this.player.commands.shift());
      for (const ev of this.sim.drainEvents()) this.onEvent(ev);
    }
    const alpha = frozen ? 1 : this.acc / DT;
    const p = this.player, r = this.renderer;
    const px = p.px + (p.x - p.px) * alpha, py = p.py + (p.y - p.py) * alpha;
    // camera: small lead toward where you walk / aim so you see what is coming
    const lead = 55 / r.cam.zoom * 0.6;
    const tx = px + (this.touch.move.x * 0.7 + this.lastAim.x * 0.3) * lead, ty = py + (this.touch.move.y * 0.7 + this.lastAim.y * 0.3) * lead;
    smoothFollow(r.cam, tx, bossCamY(this.sim, px, py, ty, r.h, r.cam.zoom || 1, Math.min(150, r.h * 0.24), Math.min(220, r.h * 0.3)), dt, SMOOTH.cam); // critically damped follow (client/smooth.js)
    musicTick(this.audio, this.sim, p, dt, this); // zone music (client/music.js)
    r.time += dt;
    this.prof.mark(0); this.fx.update(frozen ? 0 : dt); this.prof.mark(1);
    // the menu hub covers the whole screen (opaque): once it has drawn over the last world frame, skip the world + HUD
    // redraw entirely (perf pass: the world kept rastering behind the hub at full resolution every frame)
    const covered = !!(this.menuHub && this.menuHub.isOpen && this.menuHub.isOpen()), skip = covered && this._coverDrawn;
    this._coverDrawn = covered;
    if (!skip) {
    r.astral = this.hud.astral = inAstral(this);
    r.draw(this.sim, p, alpha, this.fx, this.target); this.prof.mark(2);
    const wctx = r.ctx;
    wctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    const ctx = this.hudLayer.begin(r.w, r.h, r.dpr) || wctx; // screen-space HUD: its own native-res canvas only when the world renders below native (mobile/js/perf.js HudLayer)
    // aim previews
    const tc = this.touch, info = { target: this.target, manual: false, attackDir: null, skill: null };
    if (tc.attack.held && tc.attack.manual) { info.attackDir = Math.atan2(tc.attack.dy, tc.attack.dx); info.manual = true; }
    if (tc.skillDrag && tc.skillDrag.manual) {
      const id = skillIdFor(p.cls, tc.skillDrag.key, p);
      info.skill = { id, point: skillDragPoint(id, p, tc.skillDrag.dx, tc.skillDrag.dy, this.layout.dragMax), cancel: tc.skillDrag.overCancel };
    }
    this.hud.drawAim(wctx, r, p, info, r.time);
    this.hud.quality = this.quality;
    this.hud.draw(ctx, r.w, r.h, this.sim, p, this.fx, r.time, dt);
    this.fx.loot.drawFeed(ctx, r.w, r.h); // the pickup feed (client/lootfx.js)
    if (this.loFx) this.loFx.draw(ctx, r.w, r.h, dt); // step 4: the loadout swap cast bar
    this.hintsT = Math.max(0, this.hintsT - dt);
    if (!p.dead && !DC.seq) this.hud.drawControls(ctx, r.w, r.h, this.layout, tc, p, this.sim, r.time, { hints: this.hintsT > 0, quality: this.quality });
    if (this.hud.bigMap.open) this.hud.bigMap.draw(ctx, r.w, r.h, this.sim, p, r.time, { pings: this.hud.pings, hint: 'Tap an icon: info · tap outside: close', fit: { margin: 12, top: 50 } }); // tap the minimap: the whole-zone map (client/bigmap.js)
    if (this.perfOverlay) this.perfOverlay.draw(ctx, this.prof, this);
    } else this.prof.mark(2);
    this.prof.mark(3);
    this.updateTip(this.touch.poll(), p);
    this.ui.update();
    this.death.update();
    this.rewards.update(dt, this.paused);
    if (this.rewards.dirty && this.progress.isOpen()) { this.rewards.dirty = false; this.progress.render(); }
    this.town.update(); this.ops.update(); this.village.update(dt); this.story.update();
    this.saveT += dt;
    if (this.saveT > 10) { this.saveT = 0; this.save(); }
    this.prof.mark(4); this.prof.end(dt);
    this.measure(dt, performance.now() - f0, frozen);
    requestAnimationFrame((t) => this.frame(t));
  }

  /** FPS bookkeeping + adaptive quality (auto mode): drop a level when the phone can't hold ~50 fps. */
  measure(dt, work, frozen) {
    const P = this.perf;
    P.frameMs = P.frameMs * 0.95 + work * 0.05;
    P.frames++; P.fpsT += dt;
    if (dt > 1 / 30) P.longFrames++;
    if (P.fpsT >= 1) {
      P.fps = P.frames / P.fpsT; P.frames = 0; P.fpsT = 0;
      P.hist.push(+P.fps.toFixed(1)); if (P.hist.length > 120) P.hist.shift();
      if (this.settings.quality === 'auto' && !frozen && !document.hidden) {
        // safety net only (perf pass 2026-10-07): full quality by default; after 4 s straight under 45 fps first trim the
        // world resolution a step (0.85 / 0.7 of 1.5x), only then thin the particles; climbs back after 20 s of headroom
        const st = autoStep({ fps: P.fps, frameMs: P.frameMs, lowT: P.lowT, highT: P.highT, dyn: this.renderer.dyn || 1, quality: this.quality });
        P.lowT = st.lowT; P.highT = st.highT;
        if (st.dyn !== (this.renderer.dyn || 1)) { this.renderer.dyn = st.dyn; this.renderer.resize(); this.perf.qualityChanges.push({ dyn: st.dyn, why: st.why, t: +(performance.now() / 1000).toFixed(1), fps: +P.fps.toFixed(1) }); }
        if (st.quality !== this.quality) this.setQuality(st.quality, st.why);
      }
    }
  }
}
