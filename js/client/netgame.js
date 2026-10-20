// Online co-op session. The server owns the world; this client:
//  * sends one input command per 60 Hz tick (sequence-numbered),
//  * predicts its own hero with the real sim code (movement, dodge, skills, own projectiles/AoEs) and
//    reconciles against the server's acked state (replaying unacked inputs, smoothing the error),
//  * renders everything else ~100 ms in the past, interpolated between 20 Hz snapshots,
//  * plays server events (damage numbers, deaths, loot...) when the interpolated world reaches them.
import { ENC } from './encountercine.js';
import { sprintEnded } from './sprintfx.js';
import { inAstral } from './astralui.js';
import { modalUp } from './bigmap.js';
import { profileName, accountName } from './lasthero.js';
import { seedBag, syncBag } from './bagui.js';
import { unlockedHeroes } from '../sim/heroUnlock.js';
import { bossCamY } from './cambias.js';
import { perfMeter, perfPref, governor, applyQuality, drawHudLayer } from './perf.js';
import { Sim } from '../sim/sim.js';
import { heroArt } from './heropaint.js';
import { DT } from '../sim/constants.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { CLASSES } from '../sim/data/classes.js';
import { updatePlayer } from '../sim/player.js';
import { updateProjectiles, updateAreas } from '../sim/combat.js';
import { syncRaidButton } from './raidfx.js';
import { syncAstraelButton } from './astraelfx.js';
import { trialLocks } from '../sim/hub.js';
import { TownUI, syncTownButton, loadUnlocks } from './townui.js';
import { OpsUI } from './opsui.js'; // mission dungeon entrances: the prompt + mission card
import { computeStats } from '../sim/progression.js';
import { serializeCharacter } from '../sim/save.js';
import { inCone } from '../sim/math.js';
import * as P from '../net/protocol.js';
import { Net } from './net.js';
import { holdable } from './skillhold.js';
import { Renderer } from './render.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { HudTip } from './hudtip.js';
import { UI } from './ui.js';
import { MenuHub } from './menuhub.js'; // step 2: the central menu hub (TAB; co-op keeps running behind it)
import { showPhonePopup } from './phone.js';
import { AimLock, applyLock, lockTick, makeBlocked, drawLockRing, drawSoftRing, drawCrosshair, lockPref } from './aimlock.js';
import { controlMode, KbAim, kbTick, kbLockTarget, cycleLock } from './kbmode.js'; // Keyboard-only mode (the aim rides the normal input packet, like the phone)
import { pointBlocked } from '../sim/world.js';
import { clampGate, inOpsArea } from '../sim/opsconst.js'; // (the lock's line-of-sight release)
import { FORGE_STATE } from '../sim/emberconst.js'; // desktop hover lock-on + crosshair
import { smoothFollow, SMOOTH } from './smooth.js';
import { Feel } from './feel.js';
import { musicTick } from './music.js';
import { DeathFlow } from './deathflow.js';
import { Rewards, profile } from './rewards.js';
import { ProgressUI } from './progressui.js';
import { VillageUI } from './village.js';
import { Story } from './story.js';
import { LoadoutFX } from './loadoutfx.js';
import { slowFor } from './slowmo.js'; // co-op: the finisher slow-mo as a visual-only time scale (fx particles / numbers), never the sim

const TOKENS_KEY = 'realmbrawl.net.tokens';
const LOGGED = new Set(['defx', 'spx', 'arc', 'arcx', 'sam', 'samx', 'monk', 'monkx', 'drg', 'drgx', 'wm', 'wmx', 'gapClose', 'dmg', 'death', 'playerDeath', 'respawn', 'loot', 'levelup', 'hurt', 'heal', 'shield', 'absorb', 'perfectDodge', 'sunder', 'backstab', 'vanish', 'heartseeker', 'crash', 'bash', 'rageSpend', 'berserkFinale', 'markPop', 'critPip', 'edge', 'cut', 'ult', 'ultGain', 'rotationBroken', 'eclipseBurst', 'eclipseEnd', 'shadowStep', 'shadowPierce', 'shadowPierceKill', 'blossom', 'decoyHit', 'chain', 'mark', 'cloneStab', 'shadowExecution', 'routeStep', 'routeBreak', 'ttcStart', 'ttcCut', 'ttcDetonate', 'crescentStart', 'crescentDash', 'crescentImpact', 'fin', 'ultEnd', 'classState', 'earthsplitter', 'maelstrom', 'skullsplitter', 'stormLance', 'deadeye', 'glacialCascade', 'shatterChain', 'supernova', 'holyNova', 'verdict', 'snareWeb', 'ricochet', 'hawkstorm', 'steamBurst', 'cometStep', 'chronoField', 'divineStorm', 'aegisThrow', 'angel', 'absolution', 'raid']); // small event log (debug / automated tests)
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lerpAng = (a, b, t) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
// events about the local hero that are shown as soon as they arrive (not delayed to the interpolated time)
const IMMEDIATE = new Set(['defx', 'hurt', 'xp', 'levelup', 'pickup', 'invFull', 'playerDeath', 'respawn', 'evade', 'counter', 'loot', 'nores', 'hit', 'dmg', 'heal', 'shield', 'absorb', 'perfectDodge', 'ultGain', 'rotationBroken', 'eclipseExtend', 'eclipseBurst', 'backstab', 'sunder', 'blossom', 'shadowPierceKill', 'decoyHit', 'markPop', 'critPip']);

function loadTokens() { try { return JSON.parse(localStorage.getItem(TOKENS_KEY) || '{}') || {}; } catch { return {}; } }
function saveToken(charId, token) { const t = loadTokens(); t[charId] = token; try { localStorage.setItem(TOKENS_KEY, JSON.stringify(t)); } catch {} }

export class NetGame {
  constructor({ canvas, char, store, audio, input, options = null, onQuit, lag = 0, jitter = 0 }) {
    this.options = options; if (options) options.game = this; // (Options › Account & Online: the session actions)
    this.online = true;
    this.canvas = canvas; this.char = char; this.store = store; this.audio = audio; ENC.audio = audio; this.input = input; this.onQuit = onQuit;
    input.canHold = (key) => holdable(this.player, key); // Warrior: a press may become a Rage hold (predicted Rage)
    this.netOpts = { lag, jitter };
    this.predSim = new Sim({ seed: 1, spawnEnemies: false, predicting: true }); // world geometry + the local hero only (heals/shields come from the server)
    this.view = { world: this.predSim.world, tick: 0, enemies: [], enemyById: new Map(), players: new Map(), projectiles: [], areas: [], bags: [] };
    this.predSim.targetables = () => this.view.enemies; // melee gap-closer / Heartseeker aim at the drawn server enemies
    this.player = null; this.running = false; this.paused = false; this.leaving = false;
    this.renderer = new Renderer(canvas); this.renderer.resize();
    this.fx = new FX(); this.hud = new HUD(); this.hudTip = new HudTip(this); this.hud.bigMap.attach(this.renderer.canvas, () => !this.paused && (this.hud.bigMap.open || !modalUp(this))); // (a click on the minimap opens the big map)
    this.fx.loot.audio = audio; // (pickup sounds)
    this.hud.keyLabel = (id) => input.kb.label(id); // HUD key labels follow the rebindable controls
    this.fx.ultKeyLabel = () => input.kb.label('ult');
    this.perf = { stepMs: 0, frameMs: 0, fps: 0, frames: 0, fpsT: 0, steps: 0 };
    this.stats = { corrections: 0, bigCorrections: 0, lastCorr: 0, maxPending: 0, extrap: 0, snaps: 0, reconnects: 0 };
    this.evLog = []; this.ultLog = []; // ultLog: ult/ultGain/rotationBroken only, so a busy fight's dmg spam can't push them out of evLog
    this.chatLog = []; this.bubbles = new Map(); this.pings = [];
    this.rtt = 0; this.interp = P.INTERP_TICKS;
    this.resetWorld();
  }
  get sim() { return this.view; }

  resetWorld() {
    this.snaps = []; this.estatic = new Map(); this.eviews = new Map(); this.pviews = new Map();
    this.projs = new Map(); this.areasRemote = new Map(); this.roster = new Map(); this.evq = [];
    this.inputs = []; this.seq = 0; this.samples = []; this.offset = null; this.lastSnapK = 0;
    this.predHits = new Map(); this.corr = { x: 0, y: 0 }; this.lastStarve = 0; this.view.bags = [];
    this.predSim.projectiles = []; this.predSim.areas = []; this.predSim.events = [];
  }

  // ------------------------------------------------------------------ connection
  /** Connect + join. Resolves once in the world; rejects with a user-facing message. */
  async start() {
    await this.connectAndJoin();
    this.menuHub = new MenuHub(this, { coop: true }); // (built before the UI binds the inventory slots it holds)
    this.ui = new UI(this);
    this.feel = new Feel(); this.death = new DeathFlow(this); this.rewards = new Rewards(this); this.progress = new ProgressUI(this); this.village = new VillageUI(this); this.story = new Story(this); this.loFx = new LoadoutFX(this); // impact punch / enemy kick (visual only online) + the death screen choices
    this.town = new TownUI(this, { keyLabel: (id) => this.input.kb.label(id), records: () => profile.load().records });
    this.ops = new OpsUI(this, { keyLabel: (id) => this.input.kb.label(id) }); // Brightwater Village: the Mission Counter prompt + board
    this.setupDom();
    this.input.enabled = true;
    this.running = true;
    this.acc = 0; this.last = performance.now();
    this.onResize = () => this.renderer.resize();
    addEventListener('resize', this.onResize);
    this.onUnload = () => this.saveNow();
    addEventListener('beforeunload', this.onUnload);
    this.hallPref = () => this.net && this.net.open && this.net.send({ t: 'pref', hall: heroArt.painted ? 1 : 0 }); heroArt.listeners.add(this.hallPref); // (Art style flips the hub for the party if we're the host)
    this.rttTimer = setInterval(() => this.net && this.net.open && this.net.send({ t: 'rtt', c: performance.now(), ms: Math.round(this.rtt) }), 2000);
    this.fx.banner('WELCOME, ' + (this.player.acct || this.player.name).toUpperCase(), '#ffd23f', this.welcomeSub, 2.6, 44);
    requestAnimationFrame((t) => this.frame(t));
  }

  connectAndJoin() {
    return new Promise((resolve, reject) => {
      const net = new Net(this.netOpts);
      this.net = net;
      let joined = false;
      net.onmessage = (m) => {
        if (m.t === 'hello') net.send({ t: 'join', v: P.PROTOCOL, acct: accountName(localStorage), char: seedBag(this.char, profile.load()), token: loadTokens()[this.char.id] || null, unlocks: loadUnlocks(), heroes: unlockedHeroes(profile.load()), hall: heroArt.painted ? 1 : 0 }); // (the host's Extreme unlock opens it for the party)
        else if (m.t === 'welcome') { this.onWelcome(m); joined = true; resolve(); }
        else if (m.t === 'reject') { this.rejected = m; reject(new Error(m.error || 'The server refused to let you join.')); }
        else if (joined) this.onMessage(m);
      };
      net.onclose = (e, byUs) => { if (!joined) { if (!this.rejected) reject(new Error('The game server closed the connection.')); return; } this.onDisconnect(byUs); };
      net.connect().catch((e) => reject(e));
    });
  }

  onWelcome(m) {
    saveToken(this.char.id, m.token);
    this.resetWorld();
    const ps = this.predSim;
    ps.players.clear();
    const p = ps.addPlayer(m.char);
    ps.players.delete(p.id);
    p.id = m.pid; ps.players.set(p.id, p);
    ps.tick = m.tick;
    if (this.player) { // reconnect: keep the same object identity for the UI
      Object.assign(this.player, p); ps.players.set(p.id, this.player);
    } else this.player = p;
    this.fx.localPid = m.pid; this.player.acct = accountName(localStorage);
    this.maxPlayers = m.max;
    this.welcomeSub = m.restored ? 'Welcome back! Your hero was kept for you' : `Brightwater Village · ${m.players}/${m.max} players online · the host picks missions at the counter`;
    this.store.upsert(m.char); this.char = m.char;
    this.firstSnap = true;
    if (m.dropped) setTimeout(() => this.toast(`${m.dropped} invalid item(s) were removed from your hero by the server.`), 500);
  }

  /** Heroes tab (client/hubheroes.js): ask the server to swap to `char` (the reply 'hero' swaps the predicted hero) */
  swapHero(char) {
    if (!char || !this.player || this.heroBusy) return false;
    this.saveNow();
    this.heroBusy = true; setTimeout(() => (this.heroBusy = false), 2500);
    this.net.send({ t: 'hero', heroes: unlockedHeroes(profile.load()), char: { ...char, inventory: this.player.inventory, bagSize: this.player.inventory.length } });
    return true;
  }
  onHero(m) {
    this.heroBusy = false;
    if (!m.char || !this.player) return;
    const tok = loadTokens()[this.char.id]; if (tok) saveToken(m.char.id, tok);
    this.predSim.swapHero(this.player, m.char);
    this.char = m.char; try { this.store.upsert(m.char); } catch { /* full */ }
    if (this.onHeroSwap) this.onHeroSwap(this.player);
  }

  onDisconnect(byUs) {
    if (byUs || this.leaving || this.kicked) return;
    this.saveNow();
    this.reconnecting = true;
    $('netOverlay').classList.remove('hidden');
    $('netOverlayTitle').textContent = 'Connection lost';
    let tries = 0;
    const attempt = async () => {
      if (!this.running || this.leaving) return;
      tries++;
      $('netOverlayMsg').textContent = `Reconnecting to the host... (attempt ${tries})  Your progress is saved.`;
      try {
        await this.connectAndJoin();
        this.reconnecting = false; this.stats.reconnects++;
        $('netOverlay').classList.add('hidden');
        this.fx.banner('RECONNECTED', '#6fe05a', 'Your hero was kept', 1.6, 40);
      } catch (e) {
        if (this.rejected && this.rejected.code !== 'duplicate') return this.quit(this.rejected.error);
        this.rejected = null;
        if (tries >= 40) return this.quit('Lost the connection to the host. Your progress up to the disconnect is saved.');
        setTimeout(attempt, 1500);
      }
    };
    setTimeout(attempt, 600);
  }

  onMessage(m) {
    switch (m.t) {
      case 's': this.onSnapshot(m); break;
      case 'save': if (m.char && m.char.id === this.char.id) { this.char = m.char; try { this.store.upsert(m.char); } catch {} this.lastSaveAt = performance.now(); } break;
      case 'chat': this.onChat(m); break;
      case 'ping': this.pings.push({ x: m.x, y: m.y, name: m.name, t: 0, mine: m.from === this.player.id }); this.audio.play && this.audio.play('pickup'); break;
      case 'rtt': this.rtt = this.rtt ? this.rtt * 0.7 + (performance.now() - m.c) * 0.3 : performance.now() - m.c; break;
      case 'hero': this.onHero(m); break;
      case 'acct': if (this.player) this.player.acct = m.acct || ''; if (!m.ok) this.toast('The server refused that name.'); break; // account name: live rename confirmed (or refused)
      case 'heroFail': this.toast(m.error || 'Could not swap hero.'); this.heroBusy = false; break;
      case 'kicked': this.kicked = true; this.quit(m.reason); break;
    }
  }

  /** Options > Account: the new account name reaches the party (server validates + re-broadcasts the roster) */
  setAccount(n) { if (this.player) this.player.acct = n; if (this.net && this.net.open) this.net.send({ t: 'acct', acct: n }); }
  command(c) { if (this.net && this.net.open) this.net.send({ t: 'cmd', c }); }
  /** server tick estimate (the death screen compares it with the server's respawn ticks) */
  deathTick() { return this.estTick ? this.estTick(performance.now()) : this.view.tick; }
  /** Hub state for the town UI: the host picks missions; the HOST's unlock decides whether Extreme is open. */
  hubInfo() {
    const h = this.hub || { m: 'town', h: 0, x: 0 }, me = this.player;
    const host = !h.h || (me && h.h === me.id), r = h.h && this.roster.get(h.h);
    const rd = [...this.roster.values()], rn = rd.filter((x) => x.ready).length;
    return { ready: { n: rn, of: rd.length }, m: h.m, as: !!h.as2, host, x: !!h.x, last: h.l, coop: true, hostName: r ? r.name : '', u: { dunes: !!h.d, tomb: !!h.tb, frost: !!h.f, crypt: !!h.cr, ember: !!h.e, forge: !!h.fo, rift: !!h.rf, vtx: !!h.vt, astrael: !!h.as, hollow: !!h.ho, ult: !!((h.ul | 0) & 1), ...trialLocks(h.tr | 0) } };
  }

  // ------------------------------------------------------------------ snapshots
  estTick(now = performance.now()) { return now * 0.06 + (this.offset ?? 0); }

  onSnapshot(m) {
    const now = performance.now();
    this.stats.snaps++;
    // clock: best-case (lowest delay) arrival over the last 3 s defines "server now"
    const sample = m.k - now * 0.06;
    this.samples.push([now, sample]);
    while (this.samples.length && now - this.samples[0][0] > 3000) this.samples.shift();
    let target = -Infinity; for (const s of this.samples) if (s[1] > target) target = s[1];
    if (this.offset == null || Math.abs(target - this.offset) > 30) this.offset = target; else this.offset += (target - this.offset) * 0.15;
    this.lastSnapK = m.k;
    if (m.sp !== undefined) { this.spRd = m.sp || null; } // set pieces + cine moments (sim/setpiece.js)
    if (m.as !== undefined) { this.astRd = m.as || null; } // Astrael encounter state (0 = gone)
    if (m.tr !== undefined) { this.trRd = m.tr || null; } // Skaldra / Pyrrhex trial state (0 = gone)
    if (m.op !== undefined) { this.opRd = m.op || null; } // mission dungeon state (sim/ops.js packOps; 0 = none)
    if (m.rd !== undefined) { this.raidRd = m.rd || null; } // Vorthax raid state (0 = cleared)
    if (m.em !== undefined) { this.emRd = m.em || null; FORGE_STATE.shrink = (this.emRd && this.emRd.f && this.emRd.f.b && this.emRd.f.b.shrink) || 0; } // Forge of Cinders portals + the Forge state
    if (m.sw !== undefined) { this.swRd = m.sw || null; } // Swarm event (sim/sites.js packSwarm)
    if (m.gm !== undefined) { this.gmRd = m.gm || null; }
    if (m.ul !== undefined) { this.ulRd = m.ul || null; }
    if (m.ab !== undefined) { this.abRd = m.ab || []; } // (Part C2) the Astral boss layer
    if (m.fs !== undefined) { this.fsRd = m.fs || []; } // (Part A4) Astral Fissures // the Glowmire Hollow / the Tor state
    if (m.fv !== undefined) { this.fvRd = m.fv || null; } // Glacier Crypt portals + the Crypt state
    if (m.tb !== undefined) { this.tbRd = m.tb || null; } // Dunes portals/glyphs + the Tomb state (0 = none)
    if (m.hb) { this.hub = m.hb; this.predSim.world.hubLayout = m.hb.ly ? 'tavern' : 'village'; } // (the hub layout follows the host's Art style) // hub: current mission, the host, the host's Extreme unlock (sent on change)

    if (m.ro) { this.roster = new Map(m.ro.map((r) => [r.id, r])); }
    if (m.ei) for (const s of m.ei) this.estatic.set(s[0], { type: s[1], r: s[2], elite: !!s[3], boss: !!s[4], name: s[5] });
    const snap = { k: m.k, en: new Map(), pl: new Map() };
    for (const e of m.en) snap.en.set(e[0], e);
    for (const q of m.pl) { const u = P.unpackPlayer(q); snap.pl.set(u.id, u); }
    this.snaps.push(snap);
    if (this.snaps.length > 40) this.snaps.shift();
    if (m.eg) for (const id of m.eg) this.goneLater(id, m.k);
    const me = this.player;
    if (m.pr) for (const a of m.pr) {
      const rec = P.unpackProjectile(a, m.k);
      if (rec.team === 'player' && rec.ownerId === me.id) continue; // predicted locally
      this.projs.set(rec.id, rec);
    }
    if (m.pu) for (const [id, x, y, vx, vy, lf] of m.pu) { const r = this.projs.get(id); if (r) Object.assign(r, { x, y, vx, vy, recTick: m.k, life: lf != null ? lf : r.life - (m.k - r.recTick) }); }
    if (m.pg) for (const id of m.pg) { const r = this.projs.get(id); if (r) r.deathTick = m.k; }
    if (m.ar) for (const a of m.ar) {
      if (a.team === 'player' && a.ownerId === me.id && a.trigger !== 'proximity' && a.kind !== 'decoy') continue; // predicted locally (traps and Shadow Step decoys come from the server)
      this.areasRemote.set(a.id, { ...a, recTick: m.k, t: a.t || 0 });
    }
    if (m.ag) for (const id of m.ag) { const r = this.areasRemote.get(id); if (r) r.deathTick = m.k; }
    if (m.bg) this.view.bags = m.bg.map((b) => ({ ...b, ownerId: me.id })); // the server only ever sends our own bags
    if (m.inv) { me.inventory = m.inv; me.equipment = { weapon: null, armor: null, ring: null, ...m.eq }; this.statsDirty = true; if (this.progress && this.progress.isOpen()) this.progress.render(); } // (forgefix: the Forge shows the server's upgraded / ascended / rerolled copy as soon as it lands)
    if (m.lo) { me.loadouts = m.lo.l; me.lo = m.lo.a; me.chainSet = m.lo.c; me.loCasting = m.lo.k; } // step 4: presets + chain setup (server-owned)
    this.reconcile(m);
    if (m.ev) for (const ev of m.ev) this.onServerEvent(ev);
  }
  goneLater(id, k) { const s = this.estatic.get(id); if (s) s.goneAt = k; }

  /** Server state for our hero at tick m.k (after input m.a) -> replay newer inputs -> smooth the error. */
  reconcile(m) {
    const me = this.player, ps = this.predSim;
    const oldX = me.x, oldY = me.y, stepX = me.x - me.px, stepY = me.y - me.py;
    const lvChanged = me.level !== m.me.lv;
    P.unpackMe(me, m.me);
    this.lastServerMe = { k: m.k, x: m.me.x, y: m.me.y, ack: m.a, at: performance.now() };
    me.level = m.me.lv; me.xp = m.me.xp;
    if (lvChanged || this.statsDirty) { const hp = me.hp, res = me.res; me.stats = computeStats(me); me.hp = hp; me.res = res; this.statsDirty = false; }
    while (this.inputs.length && this.inputs[0].seq <= m.a) this.inputs.shift();
    this.stats.maxPending = Math.max(this.stats.maxPending, this.inputs.length);
    // replay (no side effects kept: projectiles/areas/events created during replay are discarded)
    const idMark = ps.nextId;
    ps.tick = m.k;
    for (const it of this.inputs) this.simulate(it.cmd, false);
    ps.projectiles = ps.projectiles.filter((q) => q.id < idMark);
    ps.areas = ps.areas.filter((q) => q.id < idMark);
    ps.events.length = 0;
    const dx = me.x - oldX, dy = me.y - oldY, d = Math.hypot(dx, dy);
    // keep the last step's motion for render interpolation; hide the correction behind a decaying offset
    me.px = me.x - stepX; me.py = me.y - stepY;
    if (this.firstSnap) { this.firstSnap = false; me.px = me.x; me.py = me.y; this.corr.x = this.corr.y = 0; }
    else if (d > 0.5) {
      this.stats.corrections++; this.stats.lastCorr = d; this.stats.sumCorr = (this.stats.sumCorr || 0) + d;
      if (d > 120) { this.stats.bigCorrections++; this.corr.x = 0; this.corr.y = 0; me.px = me.x; me.py = me.y; }
      else { this.corr.x -= dx; this.corr.y -= dy; }
    } else { this.corr.x -= dx; this.corr.y -= dy; }
    this.view.tick = ps.tick;
  }

  simulate(cmd, live) {
    const ps = this.predSim, me = this.player;
    ps.tick++;
    me.px = me.x; me.py = me.y;
    if (me.dead) return;
    ps.setInput(me.id, cmd);
    const sx = me.x, sy = me.y;
    if (this.opRd && this.opRd.k === 'mobile' && ps.world) { const H = this.opRd.ho || []; if (!ps.world.opsHoles || ps.world.opsHoles.length !== H.length) ps.world.opsHoles = H.map((h) => ({ x: h[0], y: h[1], r: h[2] })); } // (Mobile Defense's collapsed floor: predicted like the server's)
    else if (ps.world && ps.world.opsHoles && ps.world.opsHoles.length) ps.world.opsHoles = [];
    updatePlayer(ps, me);
    if (this.opRd && this.opRd.k === 'assault' && this.opRd.gy != null) clampGate(me, this.opRd.gy); // (the Assault gate: predicted like the server's clamp, no rubber-band)
    if (!Number.isFinite(me.x) || !Number.isFinite(me.y)) { me.x = me.px = sx; me.y = me.py = sy; me.vx = me.vy = 0; this.stats.nanFix = (this.stats.nanFix || 0) + 1; } // (prediction safety net: never let a NaN reach the camera)
    if (!live) return;
    // (Warrior Crash Charge / Shoulder Bash: contact is found on the drawn enemies, so the predicted rush stops where the server's does; the crash/bash events flash the hits)
    ps.areas = ps.areas.filter((a) => a.trigger !== 'proximity'); // traps are shown from the server (they need enemies to trigger)
    updateProjectiles(ps);
    updateAreas(ps);
    this.visualProjectileHits();
  }

  // ------------------------------------------------------------------ local step (60 Hz)
  step() {
    const t0 = performance.now();
    const kbm = controlMode.keyboard; // Keyboard only: the phone's auto-target (kbmode.js)
    const aim = this.renderer.screenToWorld(this.input.mouse.x, this.input.mouse.y);
    const overUi = (this.menuHub && this.menuHub.isOpen()) || (!kbm && this.ui.invOpen && this.input.mouse.x > innerWidth - 500) || this.paused || this.chatOpen;
    this.input.enabled = !overUi;
    const cmd = this.input.command(aim);
    if (cmd.sprint && sprintEnded(this.player, this.input)) { this.input.sprintOn = false; cmd.sprint = false; } if (this.hud) this.hud.sprintArmed = !!this.input.sprintOn; // (sprint ends on entering combat)
    this.lock = this.lock || new AimLock(); this.kbAim = this.kbAim || new KbAim();
    if (!this.lockLos || this.lockLosW !== this.view.world) { this.lockLosW = this.view.world; this.lockLos = makeBlocked(this.view.world, pointBlocked); }
    const me = this.local || this.player;
    if (kbm) { this.lock.reset(); kbTick(this.kbAim, { enemies: this.view.enemies, player: me, input: this.input, cmd, blocked: this.lockLos, active: this.input.enabled && !(this.town && this.town.open) && !(this.ops && this.ops.open) }); }
    else {
      if (this.input.cycleTarget) this.input.cycleTarget = false, cycleLock(this.lock, this.view.enemies, me, this.renderer, lockPref.on);
      const lt = lockTick(this.lock, { enemies: this.view.enemies, aim, renderer: this.renderer, player: me, input: this.input, blocked: this.lockLos, active: this.input.enabled && this.input.mouse.onCanvas !== false && !(this.town && this.town.open) });
      if (lt) applyLock(cmd, me, lt); // hover lock-on: target-based, sticky through dashes - aim at the locked enemy (client-side aim only: the same solo and in co-op)
    }
    const panel = (this.menuHub && this.menuHub.isOpen()) || (this.town && this.town.open) || (this.ops && this.ops.open) || this.progress.isOpen() || this.rewards.isOpen() || this.village.isOpen() || this.story.isOpen();
    if (this.chatOpen || this.paused || panel) { cmd.mx = 0; cmd.my = 0; }
    if (panel) { cmd.attack = false; delete cmd.skill; delete cmd.dodge; delete cmd.ult; }
    if ((this.seq & 127) === 0 && this.player) syncBag(this, this.player, profile.load()); // (inventory pass: the server grows the bag)
    const seq = ++this.seq;
    this.net.send(P.packInput(seq, cmd));
    this.inputs.push({ seq, cmd });
    if (this.inputs.length > 240) this.inputs.shift();
    this.simulate(cmd, true);
    for (const ev of this.predSim.drainEvents()) this.onPredictedEvent(ev);
    this.view.tick = this.predSim.tick;
    this.perf.stepMs = this.perf.stepMs * 0.95 + (performance.now() - t0) * 0.05;
    this.perf.steps++;
  }

  /** Co-op slow-mo: the server sim keeps real time, so only your own big moments slow the local presentation (fx particles
   *  and numbers; cinematics stay on real time) through fx.slowmo; capped (>= 0.4x, <= 0.6 s) so effects never trail far behind live enemies. */
  visualSlow(ev) { const sl = slowFor(ev, this.player.id); if (sl && ev.pid === this.player.id) this.fx.slowmo(Math.min(0.6, sl.sec), Math.max(0.4, sl.scale)); }

  onPredictedEvent(ev) {
    this.fx.handle(ev, this.view);
    this.audio.handle(ev, this.player.id, this.player);
    this.visualSlow(ev);
    const cls = CLASSES[this.player.cls];
    if (ev.type === 'swing') this.visualMeleeHit({ shape: 'cone', x: ev.x, y: ev.y, ang: ev.ang, arc: ev.arc, r: ev.range }, ev.counter ? 7 : cls.basic[ev.idx]?.hitstop || 3, ev.heavy);
    else if (ev.type === 'slam' || ev.type === 'crash' || ev.type === 'earthsplitter') this.visualMeleeHit({ shape: 'circle', x: ev.x, y: ev.y, r: ev.r || 130 }, 6, true);
    else if (ev.type === 'aftershock') this.visualMeleeHit({ shape: 'circle', x: ev.x, y: ev.y, r: ev.r || 160 }, 5, true);
    else if (ev.type === 'backhand' || ev.type === 'uppercut') this.visualMeleeHit({ shape: 'cone', x: ev.x, y: ev.y, ang: ev.ang, arc: ev.arc || 2, r: ev.r || 110 }, ev.type === 'uppercut' ? 7 : 4, true);
    else if (ev.type === 'bash') this.visualMeleeHit({ shape: 'circle', x: ev.x, y: ev.y, r: (ev.r || 20) + 30 }, 8, true);
    else if (ev.type === 'nova') this.visualMeleeHit({ shape: 'circle', x: ev.x, y: ev.y, r: ev.r }, 3, true);
    else if (ev.type === 'smite' || ev.type === 'judgment') this.visualMeleeHit({ shape: 'circle', x: ev.x, y: ev.y, r: ev.r }, ev.type === 'judgment' ? 6 : 4, true);
  }

  /** Instant local hit feedback against the enemies as drawn; the server still decides damage. */
  visualMeleeHit(sh, selfHitstop, heavy) {
    const me = this.player; let n = 0;
    for (const e of this.view.enemies) {
      const hit = sh.shape === 'cone' ? inCone(sh.x, sh.y, sh.ang, sh.arc, sh.r, e.x, e.y, e.r) : Math.hypot(e.x - sh.x, e.y - sh.y) <= sh.r + e.r;
      if (!hit) continue;
      n++;
      this.localHitFx(e, Math.atan2(e.y - sh.y, e.x - sh.x), heavy);
    }
    if (n) me.hitstop = Math.max(me.hitstop, selfHitstop);
  }
  localHitFx(e, ang, heavy) {
    const ev = { type: 'hit', x: e.x, y: e.y, ang, crit: false, heavy: !!heavy, cls: this.player.cls, r: e.r, pid: this.player.id };
    this.fx.handle(ev, this.view); this.audio.handle(ev, this.player.id, this.player);
    this.predHits.set(e.id, performance.now());
  }
  visualProjectileHits() {
    const ps = this.predSim;
    for (const pr of ps.projectiles) {
      if (pr.dead || pr.team !== 'player') continue;
      pr.vhit = pr.vhit || new Set();
      for (const e of this.view.enemies) {
        if (pr.vhit.has(e.id)) continue;
        const rr = pr.r + e.r;
        if ((pr.x - e.x) ** 2 + (pr.y - e.y) ** 2 > rr * rr) continue;
        pr.vhit.add(e.id);
        this.localHitFx(e, Math.atan2(pr.vy, pr.vx), pr.heavy);
        if (pr.explode) { pr.dead = true; const ev = { type: 'explosion', x: pr.x, y: pr.y, r: pr.explode, style: pr.style }; this.fx.handle(ev, this.view); this.audio.handle(ev, this.player.id, this.player); break; }
        if (pr.pierce === 0) { pr.dead = true; this.fx.handle({ type: 'projEnd', x: pr.x, y: pr.y, team: 'player', style: pr.style }, this.view); break; }
        if (pr.pierce > 0) pr.pierce--;
      }
    }
    ps.projectiles = ps.projectiles.filter((q) => !q.dead);
  }

  onServerEvent(ev) {
    const me = this.player, mine = ev.pid === me.id;
    if (LOGGED.has(ev.type)) { this.evLog.push({ type: ev.type, tick: ev.tick, id: ev.id, pid: ev.pid, amount: ev.amount, team: ev.team, by: ev.by, bonus: ev.bonus, cls: ev.cls, dmg: ev.dmg, stacks: ev.stacks, fid: ev.fid, ph: ev.ph, n: ev.n, kind: ev.kind, finisher: ev.finisher, look: ev.look }); if (this.evLog.length > 6000) this.evLog.shift(); }
    if (ev.type === 'ult' || ev.type === 'ultGain' || ev.type === 'rotationBroken') { this.ultLog.push({ type: ev.type, tick: ev.tick, pid: ev.pid, amount: ev.amount, bonus: ev.bonus, chain: ev.chain, rot: ev.rot, cls: ev.cls }); if (this.ultLog.length > 400) this.ultLog.shift(); }
    if (mine && P.PREDICTED_EVENTS.has(ev.type)) return;
    if (mine && ev.type === 'areaHit' && ev.team === 'player' && ev.kind !== 'trap') return;
    if (mine && ev.type === 'explosion') return;
    if (mine && IMMEDIATE.has(ev.type)) this.playEvent(ev); else this.evq.push(ev);
  }
  playEvent(ev) {
    const me = this.player, mine = ev.pid === me.id;
    if (ev.type === 'hit' && mine && performance.now() - (this.predHits.get(ev.id) || -1e9) < 500) return; // already shown locally
    if (ev.type === 'death') ev.color = ENEMIES[ev.etype]?.color;
    this.fx.handle(ev, this.view);
    this.audio.handle(ev, me.id, me);
    this.feel.handle(ev, { player: me, fx: this.fx, sim: this.view }); this.death.onEvent(ev); this.rewards.onEvent(ev); this.village.onEvent(ev); this.loFx.onEvent(ev);
    this.visualSlow(ev);
    if (this.town) this.town.onEvent(ev, me.id);
    if (!mine) return;
    if (ev.type === 'playerDeath') this.ui.onDeath(ev);
    if (ev.type === 'invFull') this.fx.banner('INVENTORY FULL', '#ff5e5b', 'Drop something (right-click) first', 1.2, 30);
  }

  // ------------------------------------------------------------------ interpolated view of the world
  buildView(R, alpha) {
    const v = this.view, snaps = this.snaps;
    let a = null, b = null;
    for (let i = snaps.length - 1; i >= 0; i--) if (snaps[i].k <= R) { a = snaps[i]; b = snaps[i + 1] || null; break; }
    if (!a) { a = snaps[0]; b = null; }
    if (!b && a && R > a.k + 0.5) { this.stats.extrap++; this.lastStarve = performance.now(); }
    const f = a && b ? Math.min(1, Math.max(0, (R - a.k) / (b.k - a.k))) : 0;
    // enemies
    const enemies = [];
    v.enemyById.clear();
    if (a) for (const [id, ea] of a.en) {
      const st = this.estatic.get(id);
      if (!st) continue;
      const eb = b && b.en.get(id);
      let e = this.eviews.get(id);
      if (!e) { e = { kind: 'enemy', id, type: st.type, r: st.r, elite: st.elite, boss: st.boss, name: st.name, cc: { down: 0, stun: 0, frozen: false, rooted: false, slow: 0 }, dead: false }; this.eviews.set(id, e); }
      const x = eb ? ea[1] + (eb[1] - ea[1]) * f : ea[1], y = eb ? ea[2] + (eb[2] - ea[2]) * f : ea[2];
      e.x = e.px = x; e.y = e.py = y;
      e.face = eb ? lerpAng(ea[3], eb[3], f) : ea[3];
      const src = f > 0.5 && eb ? eb : ea;
      e.hp = src[4]; e.maxHp = src[5];
      const fl = src[6];
      e.invuln = fl & 1 ? 1 : 0; e.cc.down = fl & 2 ? 1 : 0; e.cc.stun = fl & 4 ? 1 : 0; e.cc.frozen = !!(fl & 8); e.cc.rooted = !!(fl & 16); e.spm = fl & 64 ? { pid: -1, t: 1, mul: 1 } : null; e.esh = fl & 128 ? 1 : 0; e.af = fl & 256 ? { win: 1 } : null; e.buffT = fl & 512 ? 1 : 0; e.cmdDebuff = fl & 1024 ? 1 : 0; // (Storm MARK, site ward: drawn only)
      e.sunder = fl & 32 ? { t: 1 } : null;
      e.flash = src[7]; e.state = src[8]; e.st = eb && ea[8] === eb[8] ? ea[9] + (eb[9] - ea[9]) * f : src[9];
      if (st.boss) { e.phase = src[10]; e.poise = src[11]; e.maxPoise = src[12]; e.cc.down = src[13]; }
      const mi = st.boss ? 14 : 10; e.mark = src[mi] ? { n: src[mi], pid: src[mi + 1], t: 1 } : null; // Marked for Death stacks
      const sx = src.length > mi + 2 ? P.unpackStacks(src, mi + 2) : null; // class stacks: Sunder / Quarry / Burn / Condemn
      if (sx && sx.sunder) e.sunder = sx.sunder;
      if (sx) delete sx.sunder;
      e.stx = sx;
      enemies.push(e); v.enemyById.set(id, e);
    }
    v.enemies = enemies;
    if (this.eviews.size > enemies.length + 200) for (const id of this.eviews.keys()) if (!v.enemyById.has(id)) this.eviews.delete(id);
    for (const [id, s] of this.estatic) if (s.goneAt != null && R > s.goneAt + 30) { this.estatic.delete(id); this.eviews.delete(id); }
    // players
    const me = this.player;
    v.players.clear();
    if (a) for (const [id, pa] of a.pl) {
      const pb = b && b.pl.get(id);
      const info = this.roster.get(id);
      if (!info) continue;
      let q = this.pviews.get(id);
      if (!q) { q = { kind: 'player', id }; this.pviews.set(id, q); }
      const src = f > 0.5 && pb ? pb : pa;
      q.name = info.name; q.acct = info.acct || ''; q.cls = info.cls; q.appearance = info.app; q.level = info.level;
      q.x = q.px = pb ? pa.x + (pb.x - pa.x) * f : pa.x; q.y = q.py = pb ? pa.y + (pb.y - pa.y) * f : pa.y;
      q.aim = pb ? lerpAng(pa.aim, pb.aim, f) : pa.aim;
      q.dead = src.dead; q.moving = src.moving; q.iframes = src.iframes; q.evade = src.evade; q.flash = src.flash; q.hp = src.hp; q.maxHp = src.maxHp; q.stats = { maxHp: src.maxHp };
      q.shield = src.shield; q.perfectCrit = src.perfectCrit; q.rage = src.rage; q.aura = src.aura; q.eclipse = src.eclipse; q.stealth = src.stealth; q.rageHot = src.rageHot; q.cst = src.cst; q.mhc = src.mhc; q.uw = src.uw; q.charging = src.charging; q.songs = src.songs; q.asc = src.asc; q.svA = src.svA; q.ascAll = src.ascAll; q.ultc = src.ultc; q.sprint = src.sprint; // (Bard songs: auras; Ascension looks + the Ultimate's prestige ride along, Part F3) q.empowered = src.empowered;
      let act = src.action;
      if (pa.action && pb && pb.action && pa.action.kind === pb.action.kind && pa.action.id === pb.action.id && pa.action.idx === pb.action.idx && pb.action.t >= pa.action.t) act = { ...pa.action, t: pa.action.t + (pb.action.t - pa.action.t) * f };
      q.action = act;
      v.players.set(id, q);
    }
    // local hero (predicted, drawn in the present) with smoothed corrections
    const k = Math.pow(0.001, this.frameDt || 0.016);
    this.corr.x *= k; this.corr.y *= k;
    if (!Number.isFinite(this.corr.x) || !Number.isFinite(this.corr.y)) { this.corr.x = 0; this.corr.y = 0; }
    const lx = me.px + (me.x - me.px) * alpha + this.corr.x, ly = me.py + (me.y - me.py) * alpha + this.corr.y;
    const local = Object.create(me);
    local.x = local.px = lx; local.y = local.py = ly;
    v.players.set(me.id, local);
    this.local = local;
    // projectiles: remote (dead-reckoned, past time) + own (predicted, present)
    const projs = [];
    for (const [id, r] of this.projs) {
      if (r.deathTick != null && R >= r.deathTick) { this.projs.delete(id); continue; }
      const n = R - r.recTick;
      if (n > r.life + 60) { this.projs.delete(id); continue; }
      if (R < r.born || n > r.life) continue;
      let x, y;
      if (n > 0 && r.accel) { const kk = 1 + r.accel * DT, s = kk * (Math.pow(kk, n) - 1) / (kk - 1); x = r.x + r.vx * DT * s; y = r.y + r.vy * DT * s; }
      else { x = r.x + r.vx * DT * n; y = r.y + r.vy * DT * n; }
      projs.push({ team: r.team, style: r.style, r: r.r, vx: r.vx, vy: r.vy, x, y, px: x, py: y, color: r.color });
    }
    for (const pr of this.predSim.projectiles) { const o = Object.create(pr); o.x = o.px = pr.px + (pr.x - pr.px) * alpha; o.y = o.py = pr.py + (pr.y - pr.py) * alpha; projs.push(o); }
    v.projectiles = projs;
    // areas
    const areas = [];
    for (const [id, r] of this.areasRemote) {
      if (r.deathTick != null && R >= r.deathTick) { this.areasRemote.delete(id); continue; }
      if (R < (r.born ?? r.recTick - r.t)) continue;
      const o = Object.create(r);
      o.t = Math.max(0, r.t + (R - r.recTick));
      if (r.follow) { const fe = v.enemyById.get(r.follow); if (fe) { o.x = fe.x; o.y = fe.y; } }
      areas.push(o);
    }
    for (const ar of this.predSim.areas) areas.push(ar);
    v.areas = areas;
    v.subT = alpha; // (tick fraction of the predicted local hero: its action clock advances between ticks in the renderer)
    v.trial = this.trRd || null; // (sim/trials.js packTrial)
    v.ops = this.opRd || null; // (sim/ops.js packOps: client/opsfx.js opsView reads it)
    v.sp = this.spRd ? this.spRd.sp : null; v.cine = this.spRd ? this.spRd.cine : null;
    v.astrael = this.astRd && this.astRd.a ? this.astRd.a : null; v.starPortal = this.astRd && this.astRd.sp ? this.astRd.sp : null;
    v.raid = this.raidRd && this.raidRd.rd ? this.raidRd.rd : null; v.riftPortal = this.raidRd && this.raidRd.rp ? this.raidRd.rp : null;
    v.swarmV = this.swRd || null; v.tombV = (this.tbRd && this.tbRd.t) || null; v.frostV = this.fvRd || null; v.glowV = this.gmRd || null; v.ultV = this.ulRd || null; v.fisV = this.fsRd || []; v.abV = this.abRd || []; v.emberV = this.emRd || null; v.dunesV = (this.tbRd && this.tbRd.d) || null;
    { const hb = this.hub || {}; v.hubU = { dunes: !!hb.d, tomb: !!hb.tb, frost: !!hb.f, crypt: !!hb.cr, ember: !!hb.e, forge: !!hb.fo, rift: !!hb.rf, hollow: !!hb.ho }; }
    // events whose time has come
    while (this.evq.length && this.evq[0].tick <= R) this.playEvent(this.evq.shift());
    if (this.evq.length > 800) this.evq.splice(0, this.evq.length - 800);
  }

  // ------------------------------------------------------------------ frame
  frame(now) {
    if (!this.running) return;
    const f0 = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now; this.frameDt = dt;
    this.handleUiKeys();
    if (!this.reconnecting) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= DT && n < 8) { this.step(); this.acc -= DT; n++; }
      if (n >= 8) this.acc = 0;
    }
    // adaptive interpolation delay: grow when snapshots arrive late, shrink back slowly
    const sinceStarve = performance.now() - this.lastStarve;
    if (sinceStarve < 50) this.interp = Math.min(14, this.interp + 0.25);
    else if (sinceStarve > 4000) this.interp = Math.max(P.INTERP_TICKS, this.interp - dt * 0.5);
    const R = this.estTick(now) - this.interp;
    this.renderTick = R;
    this.buildView(R, this.acc / DT);
    const p = this.local;
    const aim = this.renderer.screenToWorld(this.input.mouse.x, this.input.mouse.y);
    const kbm = controlMode.keyboard;
    const cam = this.renderer.cam, zl = cam.zoom || 1, mo = !kbm && this.input.mouse.onCanvas !== false; // (aim lead from the cursor's screen offset; critically damped follow; Keyboard only: none)
    const tx = p.x + (mo ? (this.input.mouse.x - this.renderer.w / 2) / zl * 0.12 : 0), ty = p.y + (mo ? (this.input.mouse.y - this.renderer.h / 2) / zl * 0.12 : 0);
    smoothFollow(cam, tx, bossCamY(this.view, p.x, p.y, ty, this.renderer.h, zl), dt, SMOOTH.cam * 0.58); // (experience pass: snappier follow; boss arenas keep the boss out from under the bar)
    musicTick(this.audio, this.view, p, dt, this); // zone music
    this.renderer.time += dt;
    this.fx.update(dt);
    let hover = null;
    if (!kbm) for (const e of this.view.enemies) if (Math.hypot(e.x - aim.x, e.y - aim.y) < e.r + 6) hover = e;
    const locked = kbm ? kbLockTarget(this.kbAim, this.view.enemies) : this.lock ? this.lock.find(this.view.enemies) : null;
    const ctx = this.renderer.ctx;
    if (!(this.menuHub && this.menuHub.isOpen())) { // (the menu hub covers the whole screen: skip the world + HUD draw behind it)
      this.renderer.astral = this.hud.astral = inAstral(this);
      this.renderer.draw(this.view, p, 1, this.fx, locked || hover);
      ctx.setTransform(this.renderer.dpr, 0, 0, this.renderer.dpr, 0, 0);
      if (!kbm && this.lock && this.lock.soft) drawSoftRing(ctx, this.renderer, this.lock.soft, this.lock.softProgress());
      if (locked && kbm) drawLockRing(ctx, this.renderer, locked, this.kbAim, this.renderer.time, '', { tag: 'TARGET', hint: this.input.kb ? `${this.input.kb.label('cycleTarget')} next` : '' });
      else if (locked) drawLockRing(ctx, this.renderer, locked, this.lock, this.renderer.time, this.input.kb ? this.input.kb.label('clearLock') : '');
      this.drawOverlay(ctx, dt);
      drawHudLayer(this.renderer, (c, d) => this.hud.draw(c, this.renderer.w, this.renderer.h, this.view, p, this.fx, this.renderer.time, d), dt);
      this.fx.loot.drawFeed(ctx, this.renderer.w, this.renderer.h); // the pickup feed (client/lootfx.js)
      this.loFx.draw(ctx, this.renderer.w, this.renderer.h, dt); // step 4: the loadout swap cast bar
      if (!kbm && this.input.mouse.onCanvas !== false) drawCrosshair(ctx, this.input.mouse.x, this.input.mouse.y, !!(this.lock && this.lock.hover) || !!hover, this.renderer.time);
    }
    this.hudTip.update(dt);
    this.ui.update();
    if (this.death) this.death.update(); this.rewards.update(dt, false);
    if (this.town) this.town.update(); if (this.ops) this.ops.update(); this.village.update(dt); this.story.update();
    this.domT = (this.domT || 0) + dt;
    if (this.domT > 0.4) { this.domT = 0; this.updateDom(); }
    perfMeter.frame(dt, performance.now() - f0); if (perfPref.on) perfMeter.draw(ctx, this.renderer.w, this.renderer.h, governor.auto ? `Q${governor.level}` : ''); // FPS overlay (Options)
    if (governor.update(dt * 1000) || this._gq === undefined) { this._gq = governor.level; applyQuality(this.renderer, this.fx); } // adaptive quality (client/perf.js)
    this.perf.frameMs = this.perf.frameMs * 0.95 + (performance.now() - f0) * 0.05;
    this.perf.frames++; this.perf.fpsT += dt;
    if (this.perf.fpsT >= 1) { this.perf.fps = this.perf.frames / this.perf.fpsT; this.perf.frames = 0; this.perf.fpsT = 0; }
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Chat bubbles + map pings (screen space, on top of the world, under the HUD). */
  drawOverlay(ctx, dt) {
    const r = this.renderer, now = performance.now();
    ctx.textAlign = 'center';
    for (const [pid, b] of this.bubbles) {
      if (now > b.until) { this.bubbles.delete(pid); continue; }
      const q = this.view.players.get(pid);
      if (!q || q.dead) continue;
      const s = r.worldToScreen(q.x, q.y - 78);
      ctx.font = "15px 'Trebuchet MS', sans-serif";
      const w = Math.min(260, ctx.measureText(b.text).width + 20);
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.strokeStyle = '#2b2433'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(s.x - w / 2, s.y - 16, w, 28, 10) : ctx.rect(s.x - w / 2, s.y - 16, w, 28); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2b2433'; ctx.fillText(b.text.length > 34 ? b.text.slice(0, 33) + '…' : b.text, s.x, s.y + 3);
    }
    for (const pg of this.pings) pg.t += dt;
    this.pings = this.pings.filter((pg) => pg.t < 4);
    for (const pg of this.pings) {
      const s = r.worldToScreen(pg.x, pg.y), k = (pg.t * 1.4) % 1;
      ctx.strokeStyle = pg.mine ? '#8ff3ff' : '#ffd23f'; ctx.lineWidth = 4; ctx.globalAlpha = 1 - k;
      ctx.beginPath(); ctx.arc(s.x, s.y, 12 + k * 40, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - 9, s.y - 22); ctx.lineTo(s.x + 9, s.y - 22); ctx.closePath();
      ctx.fillStyle = pg.mine ? '#8ff3ff' : '#ffd23f'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#2b2433'; ctx.stroke();
      ctx.font = "14px 'Lilita One', sans-serif"; ctx.lineWidth = 4; ctx.strokeText(pg.name, s.x, s.y - 28); ctx.fillStyle = '#fff'; ctx.fillText(pg.name, s.x, s.y - 28);
      // off-screen: arrow at the screen edge
      if (s.x < 0 || s.y < 0 || s.x > r.w || s.y > r.h) {
        const cx = Math.max(24, Math.min(r.w - 24, s.x)), cy = Math.max(24, Math.min(r.h - 24, s.y));
        ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.stroke();
      }
    }
    this.hud.pings = this.pings;
  }

  // ------------------------------------------------------------------ DOM: invite, player list, chat, menu
  setupDom() {
    $('coopBar').classList.remove('hidden'); $('playerList').classList.remove('hidden'); $('chat').classList.remove('hidden');
    $('inviteBtn').onclick = () => this.invite();
    const ci = $('chatInput');
    ci.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { const t = ci.value.trim(); if (t) this.net.send({ t: 'chat', text: t }); ci.value = ''; this.closeChat(); e.preventDefault(); }
      else if (e.key === 'Escape') { ci.value = ''; this.closeChat(); e.preventDefault(); }
    };
    ci.onblur = () => { this.chatOpen = false; };
    // open chat right on the keydown (not on the next frame) so the first typed letters are not lost
    this.onChatKey = (e) => {
      if (!this.input.kb.matches('chat', e.code) || e.repeat || this.chatOpen || this.paused || !this.running || (this.menuHub && this.menuHub.isOpen())) return;
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      e.preventDefault(); this.openChat();
    };
    addEventListener('keydown', this.onChatKey);
    this.renderChat();
  }
  openChat() { this.chatOpen = true; this.input.keys.clear(); const ci = $('chatInput'); ci.classList.add('open'); ci.focus(); }
  closeChat() { this.chatOpen = false; const ci = $('chatInput'); ci.classList.remove('open'); ci.blur(); }

  handleUiKeys() {
    for (const code of this.input.takeUi()) {
      if (code === 'menu' && this.hud.bigMap.open && !(this.menuHub && this.menuHub.isOpen())) { this.hud.bigMap.close(); continue; } // Esc closes the big map first
      if (this.menuHub && this.menuHub.route(code)) continue; // the hub's tabs: I / TAB Character, J map, U forge, P / L collection
      if (code === 'bigMap') { if (this.hud.bigMap.open || !modalUp(this)) this.hud.bigMap.toggle(); continue; } // the whole-zone map overlay (client/bigmap.js)
      if (code === 'menu') { if (this.ops && this.ops.open) this.ops.hide(); else if (this.town && this.town.open) this.town.hide(); else if (this.town && this.town.cast && this.town.cast.on) this.command({ type: 'townGo', cancel: 1 }); else if (this.ui.invOpen) this.ui.toggleInventory(false); else this.setPaused(true); } // Esc: popups first, then the hub on Options (no pause menu)
      if (code === 'interact' && !this.paused && !this.chatOpen && !(this.ops && this.ops.interact()) && this.town && !this.town.interact()) this.village.interact(); // the Mission Counter, then the village services
      if (code === 'potion' && !this.paused && !this.chatOpen) this.village.drinkPotion();
      if (code === 'inventory') this.ui.toggleInventory();
      if (code === 'combos') this.hud.showChains = !this.hud.showChains;
      if (code === 'takeAll') this.ui.takeAll();
      if (code === 'mute') this.audio.muted = !this.audio.muted;
      if (code === 'progress') this.progress.toggle('account');
      if (code === 'forge') this.progress.toggle('forge');
      if (code === 'journal') this.progress.toggle('journal');
      if (code === 'realmMap' && this.town && this.town.map) this.town.map.toggle(); // piece 4: the Realm Gate world map
      if (code === 'ping') { const me = this.local || this.player, tg = controlMode.keyboard ? kbLockTarget(this.kbAim, this.view.enemies) || me : null; const a = tg ? { x: tg.x, y: tg.y } : this.renderer.screenToWorld(this.input.mouse.x, this.input.mouse.y); this.net.send({ t: 'ping', x: a.x, y: a.y }); } // (Keyboard only: ping your target, or where you stand)
    }
  }
  /** (2026-10-09: no pause menu any more) true = Esc's menu: the hub on Options (the solo world holds while the hub is up); false = close it */
  setPaused(v) { this.paused = false; if (v) { this.saveNow(); this.openOptions(); } else if (this.menuHub && this.menuHub.isOpen()) { this.menuHub.close(); if (this.onMenuChange) this.onMenuChange(); } }
  openOptions() { if (this.menuHub) this.menuHub.open('options'); else if (this.options) this.options.open(); }

  onChat(m) {
    this.chatLog.push({ name: m.name, text: m.text, sys: !!m.sys, me: m.from === this.player.id, at: performance.now() });
    if (this.chatLog.length > 40) this.chatLog.shift();
    if (!m.sys && m.from) this.bubbles.set(m.from, { text: m.text, until: performance.now() + 5000 });
    this.renderChat();
  }
  renderChat() {
    const el = $('chatLog');
    el.innerHTML = this.chatLog.slice(-7).map((l) => l.sys ? `<div class="sys">${esc(l.text)}</div>` : `<div><b class="${l.me ? 'me' : ''}">${esc(l.name)}:</b> ${esc(l.text)}</div>`).join('');
  }

  updateDom() {
    const me = this.player;
    const rows = [...this.roster.values()].sort((a, b) => (a.id === me.id ? -1 : b.id === me.id ? 1 : a.id - b.id)).map((r) => {
      const isMe = r.id === me.id;
      const q = isMe ? me : this.view.players.get(r.id);
      const hpK = q ? Math.max(0, (isMe ? me.hp / me.stats.maxHp : q.hp / q.maxHp)) : 1;
      const dead = q ? q.dead : false;
      const c = CLASSES[r.cls];
      return `<div class="pl-row${isMe ? ' me' : ''}"><span class="dot" style="background:${c.color}"></span><span class="nm" title="${esc(r.name)} · ${esc(c.name)}">${esc(r.acct || r.name)}</span>` +
        `<span class="lv">Lv ${r.level} ${r.acct ? esc(r.name) : c.name}</span><span class="hp"><i style="width:${Math.round(hpK * 100)}%;background:${dead ? '#777' : hpK > 0.3 ? '#5fdc4a' : '#ff4d4d'}"></i></span>` +
        `<span class="ms">${dead ? 'dead' : r.ping ? r.ping + 'ms' : ''}</span></div>`;
    });
    $('playerList').innerHTML = `<div class="pl-head">Players ${this.roster.size}/${this.maxPlayers}</div>` + rows.join('');
    $('playerList').classList.toggle('hidden', !!this.ui.invOpen);
    $('netStatus').textContent = `Online · ${this.roster.size}/${this.maxPlayers} · ${Math.round(this.rtt)} ms`;
  }

  async invite() {
    let url = null;
    try { url = (await (await fetch('/api/invite', { cache: 'no-store' })).json()).url; } catch {}
    if (!url && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') url = location.origin + '/';
    if (!url) { this.toast('No public invite link right now. Start the game with "Play Realm Brawl.bat" - it creates the link and shows it in the black window.', 7000); return; }
    const ok = await copyText(url);
    this.toast((ok ? 'Invite link copied! ' : 'Invite link: ') + url + ' - send it to your friends. It works while the host keeps the game window open.', 7000);
    showPhonePopup({ phone: url.replace(/\/?$/, '/') + 'mobile/', friends: url });
  }
  toast(text, ms = 4000) { const t = $('toast'); t.textContent = text; t.classList.remove('hidden'); clearTimeout(this.toastT); this.toastT = setTimeout(() => t.classList.add('hidden'), ms); }

  // ------------------------------------------------------------------ save / quit
  saveNow() { if (!this.player) return; try { this.store.upsert(serializeCharacter(this.player)); } catch (e) { console.warn('save failed', e); } }
  quit(message) {
    if (!this.running && this.leaving) return;
    this.leaving = true;
    this.saveNow();
    this.running = false;
    clearInterval(this.rttTimer);
    if (this.hallPref) heroArt.listeners.delete(this.hallPref);
    if (this.net) { try { this.net.send({ t: 'leave' }); } catch {} setTimeout(() => this.net.close(), 100); }
    if (this.audio.music) this.audio.music.update(null); if (this.death) this.death.destroy(); if (this.rewards) this.rewards.destroy(); if (this.progress) this.progress.destroy(); if (this.story) this.story.destroy(); if (this.village) this.village.destroy();
    if (this.menuHub) this.menuHub.destroy(); if (this.ui) this.ui.destroy(); this.hudTip.destroy(); this.hud.bigMap.detach(); if (this.town) this.town.destroy(); if (this.ops) this.ops.destroy();
    for (const id of ['coopBar', 'playerList', 'chat', 'netOverlay', 'toast']) $(id).classList.add('hidden');
    if (this.options && this.options.game === this) this.options.game = null;
    removeEventListener('resize', this.onResize); removeEventListener('beforeunload', this.onUnload); removeEventListener('keydown', this.onChatKey);
    this.onQuit && this.onQuit(typeof message === 'string' ? message : null);
  }
}

export async function copyText(text) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch {}
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}
