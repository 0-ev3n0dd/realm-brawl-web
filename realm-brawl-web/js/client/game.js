// Client game session: owns a local Sim (solo), steps it at a fixed 60 Hz from input commands,
// feeds the event stream to FX/audio/UI, and renders with interpolation.
import { ENC } from './encountercine.js';
import { sprintEnded } from './sprintfx.js';
import { inAstral } from './astralui.js';
import { computeStats } from '../sim/progression.js';
import { modalUp } from './bigmap.js';
import { accountName } from './lasthero.js';
import { seedBag, syncBag } from './bagui.js';
import { bossCamY } from './cambias.js';
import { perfMeter, perfPref, governor, applyQuality, drawHudLayer } from './perf.js';
import { Sim } from '../sim/sim.js';
import { bindHubLayout } from './worldpaint.js';
import { DT } from '../sim/constants.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { serializeCharacter } from '../sim/save.js';
import { Renderer } from './render.js';
import { slowFor } from './slowmo.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { HudTip } from './hudtip.js';
import { Input } from './input.js';
import { holdable } from './skillhold.js';
import { UI } from './ui.js';
import { MenuHub } from './menuhub.js'; // step 2: the central menu hub (TAB)
import { syncRaidButton } from './raidfx.js';
import { syncAstraelButton, astraelSlow } from './astraelfx.js';
import { TownUI, syncTownButton, loadUnlocks } from './townui.js';
import { OpsUI } from './opsui.js'; // mission dungeon entrances: the prompt + mission card
import { packHub, trialBits, trialLocks, hasUnlock } from '../sim/hub.js';
import { AimLock, applyLock, lockTick, makeBlocked, drawLockRing, drawSoftRing, drawCrosshair, lockPref } from './aimlock.js'; // desktop hover lock-on + crosshair
import { controlMode, KbAim, kbTick, kbLockTarget, cycleLock } from './kbmode.js'; // Keyboard-only mode: the phone's auto-target
import { pointBlocked } from '../sim/world.js'; // (the lock's line-of-sight release)
import { smoothFollow, SMOOTH } from './smooth.js';
import { Feel } from './feel.js';
import { musicTick } from './music.js';
import { DeathFlow } from './deathflow.js';
import { Rewards, profile } from './rewards.js';
import { ProgressUI } from './progressui.js';
import { VillageUI } from './village.js';
import { LoadoutFX } from './loadoutfx.js';
import { Story } from './story.js';

export class Game {
  setAccount(n) { if (this.player) this.player.acct = n; }
  constructor({ canvas, char, store, audio, input, options = null, onQuit }) {
    this.options = options; if (options) options.game = this; // (Options › Account & Online: the session actions)
    this.canvas = canvas;
    this.store = store;
    this.audio = audio; ENC.audio = audio; // (encounter cinematics: stings + the encounter song)
    this.onQuit = onQuit;
    this.sim = new Sim({ seed: (Date.now() & 0xffffff) >>> 0, hub: true }); // hub: start in Brightwater Village (sim/hub.js)
    this.unbindHub = bindHubLayout(this.sim); // painted tavern hub / classic village (Options > Art style)
    this.player = this.sim.addPlayer(seedBag(char, profile.load())); // (inventory pass: 64+ bag slots from the account)
    try { this.player.acct = accountName(localStorage); } catch { this.player.acct = ''; } // (account names: the player's own name)
    this.player.unlocks = loadUnlocks(); // Astrael (Extreme) unlock, saved in this browser
    { const P = this.player; P.stats = computeStats(P); P.hp = P.stats.maxHp; P.res = Math.min(P.res, P.stats.maxRes); } // (Part B: Ascended stats need the unlock flags)
    this.town = new TownUI(this, { keyLabel: (id) => input.kb.label(id), records: () => profile.load().records });
    this.ops = new OpsUI(this, { keyLabel: (id) => input.kb.label(id) });
    this.renderer = new Renderer(canvas);
    this.renderer.resize();
    this.fx = new FX();
    this.fx.localPid = this.player.id;
    this.fx.loot.audio = audio; // (pickup sounds)
    this.hud = new HUD();
    this.hudTip = new HudTip(this); this.hud.bigMap.attach(this.renderer.canvas, () => !this.paused && (this.hud.bigMap.open || !modalUp(this))); // (a click on the minimap opens the big map)
    this.input = input;
    input.canHold = (key) => holdable(this.player, key); // Warrior: a press may become a Rage hold
    this.hud.keyLabel = (id) => input.kb.label(id); // HUD key labels follow the rebindable controls
    this.fx.ultKeyLabel = () => input.kb.label('ult');
    this.input.enabled = true;
    this.menuHub = new MenuHub(this, { coop: false }); // (its DOM holds the inventory slots: built before the UI binds them)
    this.ui = new UI(this);
    this.feel = new Feel(); // hit-stop / impact punch / enemy kick (feel.js)
    this.rewards = new Rewards(this); this.progress = new ProgressUI(this); this.village = new VillageUI(this); this.story = new Story(this); // experience pass 2 + 3 (village services): loot / materials / reward screen, Progress + Forge panel
    this.death = new DeathFlow(this); // death screen: respawn at the checkpoint or return to the village
    this.loFx = new LoadoutFX(this); // step 4: loadout swap cast bar + feedback
    this.acc = 0;
    this.last = performance.now();
    this.running = true;
    this.paused = false;
    this.timeScale = 1;
    this.slowT = 0;
    this.saveT = 0;
    this.perf = { stepMs: 0, frameMs: 0, fps: 0, frames: 0, fpsT: 0, steps: 0 };
    this.onResize = () => this.renderer.resize();
    addEventListener('resize', this.onResize);
    this.renderer.cam.x = this.player.x; this.renderer.cam.y = this.player.y;
    this.fx.banner('WELCOME TO BRIGHTWATER VILLAGE', '#ffd23f', `Walk up to the Mission Counter and press ${input.kb.label('interact')} to pick a mission`, 3.2, 44);
    this.save();
    requestAnimationFrame((t) => this.frame(t));
  }

  command(c) { this.sim.command(this.player.id, c); }
  /** Hub state for the town UI (solo: you are always the host; your own unlock counts). */
  hubInfo() { const h = packHub(this.sim) || { m: 'town' }; const U = this.player.unlocks || {}; return { m: h.m, as: !!h.as2, host: true, x: !!U.astx, last: h.l, coop: false, u: { dunes: hasUnlock(this.player, 'dunes'), tomb: !!U.tomb, frost: hasUnlock(this.player, 'frost'), crypt: !!U.crypt, hollow: !!U.hollow, ember: hasUnlock(this.player, 'ember'), forge: !!U.forge, rift: hasUnlock(this.player, 'rift'), vtx: hasUnlock(this.player, 'vtx'), astrael: hasUnlock(this.player, 'astrael'), ult: hasUnlock(this.player, 'ult'), ...trialLocks(trialBits(this.player)) } }; } // (game loop A1: a map gate counts once attuned)
  /** (2026-10-09: no pause menu any more) true = Esc's menu: the hub on Options (the solo world holds while the hub is up); false = close it */
  setPaused(v) { this.paused = false; if (v) { this.save(); this.openOptions(); } else if (this.menuHub && this.menuHub.isOpen()) { this.menuHub.close(); if (this.onMenuChange) this.onMenuChange(); } }
  openOptions() { if (this.menuHub) this.menuHub.open('options'); else if (this.options) this.options.open(); }
  save() { try { this.store.upsert(serializeCharacter(this.player)); this.player.dirty = false; } catch (e) { console.warn('save failed', e); } }
  quit() { if (this.options && this.options.game === this) this.options.game = null; this.save(); this.running = false; if (this.audio.music) this.audio.music.update(null); if (this.death) this.death.destroy(); if (this.menuHub) this.menuHub.destroy(); this.rewards.destroy(); this.progress.destroy(); this.village.destroy(); this.story.destroy(); if (this.unbindHub) this.unbindHub(); this.town.destroy(); this.ops.destroy(); this.ui.destroy(); this.hudTip.destroy(); this.hud.bigMap.detach(); removeEventListener('resize', this.onResize); this.onQuit && this.onQuit(); }

  handleUiKeys() {
    for (const code of this.input.takeUi()) {
      if (code === 'menu' && this.hud.bigMap.open && !(this.menuHub && this.menuHub.isOpen())) { this.hud.bigMap.close(); continue; } // Esc closes the big map first
      if (this.menuHub && this.menuHub.route(code)) continue; // the hub's tabs: I / TAB Character, J map, U forge, P / L collection
      if (code === 'bigMap') { if (this.hud.bigMap.open || !modalUp(this)) this.hud.bigMap.toggle(); continue; } // the whole-zone map overlay (client/bigmap.js)
      if (code === 'menu') { if (this.ops.open) this.ops.hide(); else if (this.town.open) this.town.hide(); else if (this.town && this.town.cast && this.town.cast.on) this.command({ type: 'townGo', cancel: 1 }); else if (this.ui.invOpen) this.ui.toggleInventory(false); else this.setPaused(true); } // Esc: popups first, then the hub on Options (no pause menu)
      if (code === 'interact' && !this.paused && !this.ops.interact() && !this.town.interact()) this.village.interact(); // the Mission Counter, then the village services
      if (code === 'potion' && !this.paused) this.village.drinkPotion();
      if (code === 'inventory') this.ui.toggleInventory();
      if (code === 'combos') this.hud.showChains = !this.hud.showChains;
      if (code === 'takeAll') this.ui.takeAll();
      if (code === 'mute') { this.audio.muted = !this.audio.muted; }
      if (code === 'progress') this.progress.toggle('account');
      if (code === 'forge') this.progress.toggle('forge');
      if (code === 'journal') this.progress.toggle('journal');
      if (code === 'realmMap' && this.town && this.town.map) this.town.map.toggle(); // piece 4: the Realm Gate world map
    }
  }

  step() {
    const t0 = performance.now();
    const kbm = controlMode.keyboard; // Keyboard only: no mouse aim, the phone's auto-target (kbmode.js)
    const aim = this.renderer.screenToWorld(this.input.mouse.x, this.input.mouse.y);
    const overUi = (this.menuHub && this.menuHub.isOpen()) || (!kbm && this.ui.invOpen && this.input.mouse.x > innerWidth - 500);
    this.input.enabled = !overUi;
    const cmd = this.input.command(aim);
    if (cmd.sprint && sprintEnded(this.player, this.input)) { this.input.sprintOn = false; cmd.sprint = false; } if (this.hud) this.hud.sprintArmed = !!this.input.sprintOn; // (sprint ends on entering combat)
    this.lock = this.lock || new AimLock(); this.kbAim = this.kbAim || new KbAim();
    if (!this.lockLos || this.lockLosW !== this.sim.world) { this.lockLosW = this.sim.world; this.lockLos = makeBlocked(this.sim.world, pointBlocked); }
    if (kbm) { this.lock.reset(); kbTick(this.kbAim, { enemies: this.sim.enemies, player: this.player, input: this.input, cmd, blocked: this.lockLos, active: this.input.enabled && !this.town.open && !this.ops.open }); }
    else {
      if (this.input.cycleTarget) this.input.cycleTarget = false, cycleLock(this.lock, this.sim.enemies, this.player, this.renderer, lockPref.on); // (B: the hover lock steps to the next enemy)
      const lt = lockTick(this.lock, { enemies: this.sim.enemies, aim, renderer: this.renderer, player: this.player, input: this.input, blocked: this.lockLos, active: this.input.enabled && this.input.mouse.onCanvas !== false && !this.town.open });
      if (lt) applyLock(cmd, this.player, lt); // hover lock-on: target-based, sticky through dashes - aim at the locked enemy (client-side aim only: the same solo and in co-op)
    }
    if (this.town.open || this.ops.open || this.progress.isOpen() || this.rewards.isOpen() || this.village.isOpen() || this.story.isOpen()) { cmd.mx = cmd.my = 0; cmd.attack = false; delete cmd.skill; delete cmd.dodge; delete cmd.ult; } // (standing at the counter)
    this.sim.setInput(this.player.id, cmd);
    this.sim.step();
    for (const ev of this.sim.drainEvents()) this.onEvent(ev);
    if (this.sim.tick % 120 === 0) syncBag(this, this.player, profile.load()); // (account level-up -> bigger bag)
    this.perf.stepMs = this.perf.stepMs * 0.95 + (performance.now() - t0) * 0.05;
    this.perf.steps++;
  }

  onEvent(ev) {
    if (ev.type === 'death') ev.color = ENEMIES[ev.etype]?.color;
    this.feel.handle(ev, this); this.death.onEvent(ev); this.rewards.onEvent(ev); this.village.onEvent(ev); this.loFx.onEvent(ev);
    this.fx.handle(ev, this.sim);
    this.town.onEvent(ev, this.player.id);
    this.audio.handle(ev, this.player.id, this.player);
    const asl = astraelSlow(ev); if (asl) this.slow(asl.sec, asl.scale); // Astrael: slow motion on the big moments (solo)
    if (ev.pid !== this.player.id && ev.pid !== undefined && ev.type !== 'loot') return;
    const sl = slowFor(ev, this.player.id); if (sl) this.slow(sl.sec, sl.scale); // chains, Eclipse finishers (real slow-mo in solo: the sim just steps slower), boss kills, signature finishers
    switch (ev.type) {
      case 'levelup': case 'pickup': this.save(); break;
      case 'playerDeath': this.ui.onDeath(ev); this.save(); break;
      case 'invFull': this.fx.banner('INVENTORY FULL', '#ff5e5b', 'Drop something (right-click) first', 1.2, 30); break;
    }
  }
  /** Local presentation slow-mo (solo only; an online client would only slow its visuals). */
  slow(sec, scale) { this.slowT = Math.max(this.slowT, sec); this.timeScale = scale; }

  frame(now) {
    if (!this.running) return;
    const f0 = performance.now();
    let dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000)); // (the first rAF stamp can predate this.last: never a negative clock step)
    this.last = now;
    this.handleUiKeys();
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.timeScale = 1; }
    const held = this.feel.update(dt); // hit-stop: the sim holds for a few frames on a weighty hit
    const hubHold = this.menuHub && this.menuHub.pausing(); // solo: the menu hub pauses the world
    if ((this.paused || hubHold) && this.sim.flushCommands()) for (const ev of this.sim.drainEvents()) this.onEvent(ev); // (step 4: equip / lock / stash / town loadout swaps apply while held)
    if (!this.paused && !held && !hubHold) {
      this.acc += dt * this.timeScale;
      let n = 0;
      while (this.acc >= DT && n < 6) { this.step(); this.acc -= DT; n++; }
      if (n >= 6) this.acc = 0;
    }
    const alpha = this.acc / DT;
    const p = this.player;
    // camera: follow with slight aim lead
    const aim = this.renderer.screenToWorld(this.input.mouse.x, this.input.mouse.y);
    const px = p.px + (p.x - p.px) * alpha, py = p.py + (p.y - p.py) * alpha;
    // aim lead from the cursor's screen offset (no feedback loop through the moving camera), critically damped follow
    const kbm = controlMode.keyboard;
    const cam = this.renderer.cam, zl = cam.zoom || 1, mo = !kbm && this.input.mouse.onCanvas !== false; // (Keyboard only: no cursor look-ahead)
    const tx = px + (mo ? (this.input.mouse.x - this.renderer.w / 2) / zl * 0.12 : 0), ty = py + (mo ? (this.input.mouse.y - this.renderer.h / 2) / zl * 0.12 : 0);
    smoothFollow(cam, tx, bossCamY(this.sim, px, py, ty, this.renderer.h, zl), dt, SMOOTH.cam * 0.58); // (experience pass: a snappier follow, 75 ms smooth time; boss arenas: bias north so the boss clears the boss bar)
    musicTick(this.audio, this.sim, p, dt, this); // zone music (music.js)
    this.renderer.time += dt;
    this.fx.update(dt * (this.paused || hubHold ? 0 : 1));
    // hover enemy for HP bar
    let hover = null;
    if (!kbm) for (const e of this.sim.enemies) if (Math.hypot(e.x - aim.x, e.y - aim.y) < e.r + 6) hover = e;
    const locked = kbm ? kbLockTarget(this.kbAim, this.sim.enemies) : this.lock ? this.lock.find(this.sim.enemies) : null;
    const ctx = this.renderer.ctx;
    if (!(this.menuHub && this.menuHub.isOpen())) { // (the menu hub covers the whole screen: skip the world + HUD draw behind it)
      this.renderer.astral = this.hud.astral = inAstral(this);
      this.renderer.draw(this.sim, p, alpha, this.fx, locked || hover);
      ctx.setTransform(this.renderer.dpr, 0, 0, this.renderer.dpr, 0, 0);
      if (!kbm && this.lock && this.lock.soft) drawSoftRing(ctx, this.renderer, this.lock.soft, this.lock.softProgress());
      if (locked && kbm) drawLockRing(ctx, this.renderer, locked, this.kbAim, this.renderer.time, '', { tag: 'TARGET', hint: this.input.kb ? `${this.input.kb.label('cycleTarget')} next` : '' }); // (Keyboard only: the auto-target)
      else if (locked) drawLockRing(ctx, this.renderer, locked, this.lock, this.renderer.time, this.input.kb ? this.input.kb.label('clearLock') : '');
      drawHudLayer(this.renderer, (c, d) => this.hud.draw(c, this.renderer.w, this.renderer.h, this.sim, p, this.fx, this.renderer.time, d), dt); // (cached HUD layer at low quality: client/perf.js)
      this.fx.loot.drawFeed(ctx, this.renderer.w, this.renderer.h); // the pickup feed (client/lootfx.js)
      this.loFx.draw(ctx, this.renderer.w, this.renderer.h, this.paused ? 0 : dt); // step 4: the loadout swap cast bar
      if (!kbm && this.input.mouse.onCanvas !== false) drawCrosshair(ctx, this.input.mouse.x, this.input.mouse.y, !!(this.lock && this.lock.hover) || !!hover, this.renderer.time); // (above the effects and the HUD)
    }
    this.hudTip.update(dt);
    this.ui.update();
    this.death.update(); this.rewards.update(dt, this.paused);
    if (this.rewards.dirty && this.progress.isOpen()) { this.rewards.dirty = false; this.progress.render(); }
    this.town.update(); this.ops.update(); this.village.update(dt); this.story.update();
    this.saveT += dt;
    if (this.saveT > 10) { this.saveT = 0; this.save(); }
    // perf counters
    perfMeter.frame(dt, performance.now() - f0); if (perfPref.on) perfMeter.draw(ctx, this.renderer.w, this.renderer.h, governor.auto ? `Q${governor.level}` : ''); // FPS overlay (Options)
    if (governor.update(dt * 1000) || this._gq === undefined) { this._gq = governor.level; applyQuality(this.renderer, this.fx); } // adaptive quality (client/perf.js)
    this.perf.frameMs = this.perf.frameMs * 0.95 + (performance.now() - f0) * 0.05;
    this.perf.frames++; this.perf.fpsT += dt;
    if (this.perf.fpsT >= 1) { this.perf.fps = this.perf.frames / this.perf.fpsT; this.perf.frames = 0; this.perf.fpsT = 0; }
    requestAnimationFrame((t) => this.frame(t));
  }
}
