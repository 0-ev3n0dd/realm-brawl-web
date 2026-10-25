import { FIS_CALL } from './fissurefx.js';
// Visual effects driven by sim events: particles, slashes, shockwaves, damage numbers, screen shake.
import { ascUltFx, ascAltFx } from './ascfx.js';
import { raidEventFx } from './raidfx.js';
import { LootFX } from './lootfx.js';
import { HordeAoeFX } from './hordeaoefx.js';
import { feelPref } from './feel.js';
import { astraelEventFx } from './astraelfx.js';
import { trialEventFx, TRIAL_UNLOCK_TXT } from './trialfx.js';
import { nefSavageEvent } from './neferakhfx.js';
import { gearEventFx } from './gearfx.js';
import { masteryEventFx } from './masteryfx.js';
import { evadedFx, holdBreakFx } from './sprintfx.js';
import { hubEventFx } from './townfx.js';
import { INK, circle, star } from './art.js';
import { CLASS_EVENTS, classFx, CINE, UNDER } from './fxclass.js';
import { wmFx, WM_COL, WM_CHAIN, WM_CINE } from './fxwar.js';
import { samFx, SAM_PARTS, SAM_CINE, SAM_UNDER } from './fxsam.js';
import { monkFx, MONK_PARTS, MONK_CINE, MONK_UNDER } from './fxmonk.js';
import { drgFx, DRG_CINE, DRG_UNDER } from './fxdragoon.js';
import { specFx, specTick, SPEC_PARTS, SPEC_CINE } from './fxspec.js';
import { basicFx } from './fxbasic.js'; // chains v2: per-class basic-attack looks
import { bloom, soft, mote, ease } from './fxglow.js'; // VFX overhaul: cached glow sprites, soft particles, easing
import { polishFx, POL_UNDER } from './fxpolish.js'; // VFX overhaul: the quality layer on top of every class's events
import { arcFx, ARC_CINE, ARC_UNDER } from './fxarcana.js'; // Grimoire Summoner + Bard
import { ShaderFX } from './shaderfx.js'; // WebGL post-process layer (bloom, grade, refraction, aberration, grain)
import { SK_CINE, SK_UNDER, skFx } from './fxskills.js'; // per-skill / chain effects for every class
import { MOM_CINE, MOM_UNDER, drawMomentScreen, momentSplitPost } from './fxmoment.js'; // signature finisher moments (Nidhogg's Fall, Heaven-Splitting Palm, The Final Chapter)
import { dunesEventFx } from './dunesfx.js'; // Sunscorch Dunes: erupting wurms, mirages, glyphs, Tomb portals
import { tombEventFx } from './tombfx.js';
import { frostEventFx, FROST_UNLOCK_TXT } from './frostfx.js'; // Frostveil Peaks
import { cryptEventFx } from './cryptfx.js'; // the Glacier Crypt
import { glowEventFx } from './glowfx.js';
import { ultEventFx } from './ultfx.js'; // Part F: the Ultimate // the Glowmire Hollow + the Stormcrown Tor
import { emberEventFx, EMBER_UNLOCK_TXT } from './emberfx.js'; // Emberdeep Caldera
import { riftEventFx, RIFT_UNLOCK_TXT } from './riftfx.js'; // the Astral Rift (game loop C3)
import { forgeEventFx } from './forgefx.js'; // the Forge of Cinders
import { opsEventFx } from './opsfx.js'; // mission dungeons
import { nsUpdate, nsDrawPre, nsDrawPost } from './fxns.js'; // Ninja + Samurai VFX rebuild (fxns.js core)
import { samHandle, samWarm } from './fxsamurai.js';
import { ninHandle, ninWarm } from './fxninja.js';
import { encCineEvent } from './encountercine.js';
import { heroTextLift } from './heropaint.js'; import { enemyFxLift } from './enemypaint.js'; // painted heroes are ~2.5x taller: hero-anchored numbers sit at chest / head height // the Tomb of the Sun-Eaten King + Neferakh
Object.assign(CINE, SAM_CINE, MONK_CINE, SPEC_CINE, WM_CINE, DRG_CINE, ARC_CINE, MOM_CINE, SK_CINE); Object.assign(UNDER, SAM_UNDER, MONK_UNDER, DRG_UNDER, ARC_UNDER, POL_UNDER, MOM_UNDER, SK_UNDER); // Samurai cinematics (the white line, the split, time-freeze)

const TAU = Math.PI * 2;
const RAR = ['#e8d2b0', '#4aa8ff', '#b86bff', '#ffb52e', '#2ee6c4', '#ff4f7b', '#ff6ad5', '#ff3b3b'];
// pass 2: decorative non-filler particles that the lowest quality levels thin out (never telegraph-like shapes)
const LOWQ_DROP = { ring: 1, flash: 1, star: 1, shard: 1, crack: 1, arrowfall: 1, rays: 1, mstreak: 1, wghost: 1, trail: 1 };
const CLASS_FX = { warrior: '#ffd27a', ranger: '#9dff8a', mage: '#b69cff', cleric: '#ffe27a', bladedancer: '#ff9ee0', samurai: '#ffb3d9', monk: '#ffc24a', dragoon: '#9a6bff', summoner: '#3ff0c8', bard: '#ff7ab8' };
const FONT = "'Lilita One', 'Trebuchet MS', sans-serif";
const rnd = (a, b) => a + Math.random() * (b - a);
/** Enemies currently knocked up (id -> { t0, dur } in fx seconds): the renderer lifts them in a hop. */
export const KNOCKUPS = new Map();

// (a trial / Savage card, cinematic or victory is on screen: the chain-combo banner stays quiet so it never covers it)
const cardUp = (sim) => { const T = sim && sim.trial; return !!(T && ((T.call && T.call.t > 0) || T.st === 'trans' || T.st === 'kill' || T.st === 'victory' || T.st === 'eclipse' || T.cine)); };
export class FX {
  constructor() {
    this.parts = [];
    this.texts = [];
    this.trauma = 0;
    this.punchX = 0; this.punchY = 0;
    this.vignette = 0;
    this.banners = [];
    this.localPid = 0;
    this.shader = new ShaderFX();
    this.cine = [];      // Eclipse finisher cinematics: screen darkening, the eclipsed moon, the clone ring
    this.hang = [];      // Ten Thousand Cuts: crescent slashes hanging in the air until they detonate
    this.slowT = 0; this.slowK = 1; // visual slow-mo (particles/numbers only: never the sim, so co-op stays in sync)
    this.loot = new LootFX(this); // loot showers + vacuum + the pickup feed (client/lootfx.js)
    this.hordeAoe = new HordeAoeFX(this); // horde AoE class shapes (client/hordeaoefx.js; drawn by render.js after the particles)
  }
  /** Low quality (phone 'lite' or a reduced particle budget): no additive extras. */
  get lite() { return !!this.forceLite || (this.partMul !== undefined && this.partMul < 1); }
  /** Visual slow-mo for `sec` real seconds (particles and numbers move at `k` speed). */
  slowmo(sec, k) { this.slowT = Math.max(this.slowT, sec); this.slowK = Math.min(this.slowK, k); }

  shake(amount) { this.trauma = Math.min(1, this.trauma + amount * (this.shakeMul ?? 1)); }
  punch(ang, amt) { this.punchX += Math.cos(ang) * amt; this.punchY += Math.sin(ang) * amt; }

  add(p) { const cheap = p.type === 'dot' || p.type === 'spark' || p.type === 'puff' || p.type === 'chunk' || p.type === 'glow' || p.type === 'mote' || !p.type; if (cheap && (this.parts.length >= (this.maxParts || 1000) || (this.partMul < 1 && Math.random() > this.partMul))) return; if (!cheap && this.partMul <= 0.35 && LOWQ_DROP[p.type] && (this.parts.length >= (this.maxParts || 1000) || Math.random() > this.partMul * 2)) return; this.parts.push({ life: 0.4, t: 0, vx: 0, vy: 0, drag: 0.9, size: 4, color: '#fff', type: 'dot', ...p }); } // (perf: a soft cap on the cheap filler particles)
  text(x, y, str, o = {}) {
    if (this.cinematic) return; // (the launch intro: no damage numbers / combat labels / status popups)
    if (o.id != null) { // damage numbers on the same target within ~0.3 s stack upward instead of piling on one spot
      const now = this._clk || 0, st = this._stk || (this._stk = new Map()), s0 = st.get(o.id), n = s0 && now - s0.t < 0.3 ? s0.n + 1 : 0;
      st.set(o.id, { t: now, n }); if (st.size > 120) st.delete(st.keys().next().value);
      y -= (n % 4) * 16; x += ((n % 4) - 1.5) * 6 * (n ? 1 : 0);
    }
    this.texts.push({ x: x + rnd(-8, 8), y, str, t: 0, life: o.life || 0.9, size: o.size || 22, color: o.color || '#fff', vy: o.vy ?? -70, vx: o.vx ?? rnd(-20, 20), pop: o.pop ?? 1.7, stroke: o.stroke || INK, rot: o.tilt ? rnd(-o.tilt, o.tilt) : 0 });
    while (this.texts.length > (this.maxTexts || 160)) this.texts.shift();
  }
  banner(str, color = '#ffd23f', sub = '', life = 1.6, size = 54, kind = null) { if (this._nsMute) return; if (this.cinematic && !(kind === 'victory' || (sub === 'ULTIMATE' && this.cinematic !== 'finale'))) return; /* (the intro keeps only the ultimate's name and VICTORY) */ if (this.cinematic && kind === 'victory') { this._won = true; if (this.ns && this.ns.moment) this.ns.moment.title = ''; } /* (the drop: VICTORY alone, no class moment band under it) */ this.banners.push({ str, sub, color, t: 0, life, size, kind }); if (this.banners.length > 3) this.banners.shift(); }

  sparks(x, y, ang, n, color, speed = 380, spread = 1.2) {
    for (let i = 0; i < n; i++) {
      const a = ang + rnd(-spread, spread), s = rnd(speed * 0.4, speed);
      this.add({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.15, 0.32), size: rnd(2, 4), color, drag: 0.86 });
    }
  }
  puffs(x, y, n, color = '#fff', size = 10, speed = 90, life = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), s = rnd(speed * 0.3, speed);
      this.add({ type: 'puff', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(life * 0.6, life), size: rnd(size * 0.6, size), color, drag: 0.9 });
    }
  }
  ring(x, y, r, color = '#fff', life = 0.35, width = 6) { this.add({ type: 'ring', x, y, r0: r * 0.2, r1: r, life, color, width }); }
  chunks(x, y, n, color, speed = 260) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), s = rnd(speed * 0.4, speed);
      this.add({ type: 'chunk', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.35, 0.6), size: rnd(3, 6), color, drag: 0.9, rot: rnd(0, TAU), vr: rnd(-10, 10) });
    }
  }

  handle(ev, sim) {
    if ((ev.type === 'setpiece' || ev.type === 'cine' || (ev.type === 'trial' && ev.ph === 'eclbeat')) && encCineEvent(ev, this)) return; // (encounter revamp Part 0: client/encountercine.js) // Ninja / Samurai events go to fxninja.js / fxsamurai.js first (true: handled; 2: also run the core, banners muted)
    if (sim) this.sim = sim;
    if (ev.type === 'drops' || ev.type === 'pick') { this.loot.handle(ev); return; }
    if (ev.type === 'hEcho') { this.hordeAoe.handle(ev); return; }
    if (ev.type === 'ward') { this.ring(ev.x, ev.y, ev.r || 260, '#ffd23f', 0.5, 5); this.chunks(ev.x, ev.y - 10, 8, '#fff6c8', 160); return; } // a site caster warded its pack
    if (ev.type === 'wardBreak') { this.chunks(ev.x, ev.y, 6, '#ffd23f', 200); return; }
    if (ev.type === 'astralb') { // Part C2: the Astral boss layer (sim/astralboss.js)
      if (ev.ph === 'surge' && this.banner) { this.banner(ev.wave > 1 ? 'SHARDS REFORM' : 'ASTRAL SURGE', '#c9b6ff', `Destroy the ${ev.n} Astral Shards before they burst (${Math.round(ev.t / 60)} s)`, 2.6, ev.wave > 1 ? 40 : 54); this.ring(ev.x, ev.y, 420, '#b48cff', 0.9, 10); if (this.chunks) this.chunks(ev.x, ev.y - 40, 26, '#e4d6ff', 360); }
      else if (ev.ph === 'burst' && this.banner) { this.banner('SHARD BURST', '#ff6bd8', `${ev.n} shard${ev.n > 1 ? 's' : ''} survived`, 1.8, 40); this.ring(ev.x, ev.y, 900, '#ff6bd8', 0.8, 12); }
      else if (ev.ph === 'clear' && this.banner) { this.banner('SHARDS SHATTERED', '#9dffcf', 'The surge falters', 1.6, 36, 'victory'); this.ring(ev.x, ev.y, 360, '#9dffcf', 0.6, 8); }
      else if (ev.ph === 'pull' && this.banner) this.banner('ASTRAL', '#c9b6ff', 'Starlight answers the boss: new Astral mechanics', 1.8, 34);
      else if (ev.ph === 'boom') { this.ring(ev.x, ev.y, Math.min(ev.r || 120, 700), ev.ok ? '#c9b6ff' : '#ff6bd8', 0.45, ev.r > 300 ? 9 : 6); if (this.chunks && (ev.r || 0) < 400) this.chunks(ev.x, ev.y - 10, 8, '#e9e0ff', 220); }
      return;
    }
    if (ev.type === 'fissure') { const C = FIS_CALL[ev.ph]; if (C && this.banner) { const b = C(ev); this.banner(b[0], b[1], b[2], b[3], b[4], ev.ph === 'closed' ? 'victory' : null); } if (ev.ph === 'closed' || ev.ph === 'core') { this.ring(ev.x, ev.y, 240, '#c06bff', 0.7, 8); if (this.chunks) this.chunks(ev.x, ev.y - 20, 16, '#e8dcff', 300); } return; } // (Part A4)
    if (ev.type === 'swarm') { // Swarm events (sim/sites.js): the callouts (the HUD panel + map icons read the live state)
      const SB = { mark: ['SWARM GATHERING', '#ff9a4c', 'A marked swarm gathers nearby: go there to fight it for a bonus chest', 3.2, 42], start: ['SWARM!', '#ff5e5b', `WAVE 1/${ev.nw} · hold the spot for a bonus chest`, 2, 58], wave: ev.wave > 1 ? [`WAVE ${ev.wave}/${ev.nw}`, '#ff7a5b', ev.wave === ev.nw ? 'The last wave!' : '', 1.4, 44] : null, win: ['SWARM CLEARED!', '#ffd23f', 'Bonus chest unlocked', 2.6, 56], fail: ['THE SWARM DISPERSED', '#c9c2d6', '', 2, 38], fade: ['THE SWARM MOVED ON', '#c9c2d6', '', 1.8, 34], open: null }[ev.ph];
      if (SB) this.banner(SB[0], SB[1], SB[2], SB[3], SB[4], ev.ph === 'win' ? 'victory' : null);
      if (ev.ph === 'open') { this.ring(ev.x, ev.y, 160, '#ffd23f', 0.7, 8); this.chunks(ev.x, ev.y - 20, 18, '#ffd23f', 320); }
      if (ev.ph === 'win') this.ring(ev.x, ev.y, 260, '#ffd23f', 0.8, 10);
      return;
    }
    if (ev.type === 'dmg' && ev.spill) { // horde AoE spill numbers: small, budgeted (a screen-wide wipe would bury the view in digits)
      const now = this.time || 0; if (now - (this._spT || 0) > 0.1) { this._spT = now; this._spN = 0; }
      if (this._spN++ < 6 && this.text) this.text(ev.x, ev.y - 6, String(ev.amount), { size: ev.crit ? 22 : 17, color: ev.crit ? '#ffcf3a' : '#e8ecff', id: ev.id, pop: 1.3, life: 0.6 });
      return;
    }
    if ((ev.type === 'hit' || (ev.type === 'dmg' && ev.team === 'enemy')) && ev.id != null) { const L = enemyFxLift(this.sim, ev.id); if (L > 0) ev = { ...ev, y: ev.y - L }; } // painted enemies: numbers + hit sparks at body height
    const S0 = this.sim;
    this._sk = null; // what the new skill / chain layer drew for this event: the older generic look below is skipped for it (no doubles)
    try { const r = skFx(this, ev, ev.pid === this.localPid, S0); if (r) { this._sk = r; if (r === 'route') { this._route = { id: ev.id, pid: ev.pid, t: this.time || 0 }; if (ev.pid === this.localPid) this.banners = this.banners.filter((b) => !(b.t < 1 && String(b.str).startsWith('★ 5-STEP'))); } } } catch (e) { if (typeof console !== 'undefined' && !this._skWarn) { this._skWarn = 1; console.warn('skill fx:', e); } } // new skill / chain effects (additive; never blocks the engine's own)
    if (!this._nsW && S0 && S0.players && this.localPid != null) { const lp = S0.players.get(this.localPid); if (lp) { this._nsW = 1; if (lp.cls === 'samurai') samWarm(); else if (lp.cls === 'bladedancer') ninWarm(); } } // pre-build the kit's textures
    const cls = ev.cls || (ev.pid !== undefined && S0 && S0.players && S0.players.get && (S0.players.get(ev.pid) || {}).cls);
    const r = cls === 'samurai' ? samHandle(this, ev, ev.pid === this.localPid) : cls === 'bladedancer' ? ninHandle(this, ev, ev.pid === this.localPid) : false;
    if (r === true) return;
    if (r === 2) { const f0 = this.flash || 0; this._nsMute = true; try { this._coreHandle(ev, sim); } finally { this._nsMute = false; } if ((this.flash || 0) > f0) this.flash = Math.min(this.flash, Math.max(f0, 0.35)); return; }
    this._coreHandle(ev, sim);
  }
  _coreHandle(ev, sim) {
    const me = ev.pid === this.localPid;
    this.shakeMul = ev.pid !== undefined && !me && ev.type !== 'death' ? 0.2 : 1; // co-op: others' hits barely shake
    if (sim) this.sim = sim;
    const skd = this._sk; if (!(skd && (ev.type === 'skill' || ev.type === 'chain' || ev.type === 'ult'))) polishFx(this, ev, me); // VFX overhaul: blooms, rune circles, motes and impact polish layered on every class's events
    if (ev.type === 'arc' || ev.type === 'arcx') { arcFx(this, ev, me, sim); return; } // Grimoire Summoner + Bard (fxarcana.js)
    if (ev.type === 'spx' && (ev.cls === 'summoner' || ev.cls === 'bard')) arcFx(this, ev, me, sim); // their Specials / chains get creature + music art, then the shared banners below
    if (ev.type === 'wm' || ev.type === 'wmx') { wmFx(this, ev, me, sim); return; } // Warrior Weapon Master (fxwar.js)
    if (ev.type === 'sam' || ev.type === 'samx') { samFx(this, ev, me, sim); return; } // Samurai (fxsam.js)
    if (ev.type === 'drg' || ev.type === 'drgx') { drgFx(this, ev, me, sim); return; } // Dragoon (fxdragoon.js)
    if (ev.type === 'monk' || ev.type === 'monkx') { monkFx(this, ev, me, sim); return; } // Monk (fxmonk.js)
    if (ev.type === 'spx') { specFx(this, ev, me, sim); return; } // Specials + Special chains (fxspec.js)
    if ((CLASS_EVENTS.has(ev.type) || (ev.type === 'spin' && ev.mael)) && classFx(this, ev, me, sim)) return; // class states / stacks / chains / finishers
    if (ev.type === 'hub') { hubEventFx(this, ev, me); return; } // the hub: mission departures, back to town, a refused pick
    if (ev.type === 'mastery') { masteryEventFx(this, ev, me, null); return; } // game loop B1
    if (ev.type === 'gear') { gearEventFx(this, ev, me); return; } // Trial / Extreme procs, set mechanics (client/gearfx.js)
    if (ev.type === 'savage') { nefSavageEvent(ev); if (ev.ph === 'vuln') { this.text(ev.x, ev.y - 70, ev.n >= 2 ? 'KO · 2ND VULN' : 'VULN ×1', { size: me ? 26 : 18, color: '#ff5a5a', vy: -40, pop: 1.6, life: 1.6 }); this.ring(ev.x, ev.y, 60, '#ff5a5a', 0.4, 6); if (me) this.shake(ev.n >= 2 ? 0.6 : 0.25); } return; } // (Part 1S: Savage Vuln stacks)
    if (ev.type === 'trial') { nefSavageEvent(ev); trialEventFx(this, ev, me); return; } // Skaldra / Pyrrhex trials (client/trialfx.js)
    if (ev.type === 'astrael') { astraelEventFx(this, ev, me); return; } // Astrael: cards, bursts, shatter, Big Bang, kill
    if (ev.type === 'raid') { raidEventFx(this, ev, me); return; } // Vorthax raid: detonations, ward, phases, portals
    if (ev.type === 'dunes') { dunesEventFx(this, ev, me); return; }
    if (ev.type === 'tomb') { tombEventFx(this, ev, me); return; }
    if (ev.type === 'frost') { frostEventFx(this, ev, me); return; }
    if (ev.type === 'crypt') { cryptEventFx(this, ev, me); return; }
    if (ev.type === 'glow') { glowEventFx(this, ev, me); return; }
    if (ev.type === 'unw') { ultEventFx(this, ev, me); return; }
    if (ev.type === 'ember') { emberEventFx(this, ev, me); return; }
    if (ev.type === 'rift') { riftEventFx(this, ev, me); return; }
    if (ev.type === 'forge') { forgeEventFx(this, ev, me); return; }
    if (ev.type === 'ops') { opsEventFx(this, ev, me); return; }
    if (ev.type === 'unlock') { if (me && ev.fresh) { const U = { hollow: ['GLOWMIRE REPLAYS UNLOCKED', '#d8ff9a', 'Pick the Glowmire Hollow at the Mission Counter · the Stormcrown Trial is open'], vhx: ['VHAROK (EXTREME) UNLOCKED', '#ffb8d8', 'Pick it at the Mission Counter in Brightwater Village'], vhxc: ['STORMCROWN EXTREME CLEARED', '#ffe27a', 'Skyfall gear drops from the Extreme'], ultc: ['THE UNWRITTEN · CLEARED', '#ffe2a0', 'Prestige only: the title the Unwritten, the page aura, the quill weapon glow and the Unwritten Regalia. No power.'], dunes: ['SUNSCORCH GATE FOUND', '#ffcf4a', 'Attune it on the Realm Gate map with 3 Warlord Tusks (Grimtusk drops them)'], tomb: ['TOMB REPLAYS UNLOCKED', '#ffe9a0', 'Pick the Tomb at the Mission Counter any time'], sigil: ['NEFERAKH UNBOUND UNLOCKED', '#ffd86a', 'A new trial waits at the Mission Counter: the Sun-Eaten Throne'], atd: ['SUNSCORCH GATE ATTUNED', '#ffcf4a', 'The gold Realm Gate burns open: travel to the Sunscorch Dunes'], atf: ['FROSTVEIL GATE ATTUNED', '#8fe3ff', 'The frost Realm Gate opens: travel to Frostveil Peaks'], ate: ['EMBERDEEP GATE ATTUNED', '#ff8a3a', 'The ember Realm Gate opens: travel to Emberdeep Caldera'], ...FROST_UNLOCK_TXT, ...EMBER_UNLOCK_TXT, ...TRIAL_UNLOCK_TXT, ...RIFT_UNLOCK_TXT }[ev.key]; if (U) this.banner(U[0], U[1], U[2], 3, 40); } return; }
    switch (ev.type) {
      case 'dmg': {
        if (ev.team === 'enemy') {
          if (this.dummyNums === false && ev.id != null && this.sim && this.sim.enemyById) { const de = this.sim.enemyById.get(ev.id); if (de && de.dummy) break; } // (Training Dummy menu: damage numbers off)
          if (ev.eclipse || ev.big) break; // the Eclipse burst / Crescent Execution draw their own big numbers
          if (ev.sharp) { // Blade Dancer crit: a bigger, sharper number with a slash flash across the target
            this.text(ev.x, ev.y - 14, ev.amount + '!', { size: ev.heavy ? 50 : 42, color: ev.pop ? '#ffffff' : '#ff6fc4', pop: 2.8, life: 1.1, stroke: '#3a0a2a', id: ev.id, tilt: 0.14 });
            if (!this._sharpT || (this.time || 0) - this._sharpT > 0.05) { this._sharpT = this.time || 0; const a = rnd(-0.9, -0.5); this.add({ type: 'slash', x: ev.x, y: ev.y + 20, ang: a, arc: 0.5, r: 46, life: 0.16, color: '#fff0fa', width: 16, dir: 1 }); this.add({ type: 'flash', x: ev.x, y: ev.y + 20, life: 0.07, size: 70, color: '#ffd0ee' }); this.shake(0.06); }
          } else if (ev.crit) this.text(ev.x, ev.y - 10, ev.amount + '!', { size: ev.heavy ? 40 : 34, color: '#ffcf3a', pop: 2.3, life: 1.05, stroke: '#4a1a00', id: ev.id, tilt: 0.12, vy: -95 });
          else this.text(ev.x, ev.y - 6, String(ev.amount), { size: ev.heavy ? 28 : 22, color: ev.down ? '#ffa65c' : ev.pid === this.localPid ? '#ffffff' : '#d8e4ff', id: ev.id, pop: ev.heavy ? 1.9 : 1.6 });
        } else this.text(ev.x, ev.y - 6 - heroTextLift(), '-' + ev.amount, { size: 24, color: '#ff4d4d', vy: -50, stroke: '#3a0008', pop: 1.5 });
        break;
      }
      case 'hit': {
        if (ev.style === 'bleed') { this.puffs(ev.x, ev.y, 2, '#b0001a', 5, 60, 0.3); break; } // Warrior Bleed tick: a small drip, no shake
        const col = ev.crit ? '#ffe45c' : (ev.style && ev.style.startsWith('wm') && WM_COL[ev.style[2]]) || CLASS_FX[ev.cls] || '#fff';
        this.sparks(ev.x, ev.y, ev.ang, ev.heavy ? 12 : 7, col, ev.heavy ? 480 : 360);
        this.sparks(ev.x, ev.y, ev.ang, 3, '#ffffff', 300, 0.5);
        if (ev.crit) { this.add({ type: 'star', x: ev.x, y: ev.y, life: 0.22, size: 26, color: '#fff6a8' }); this.shake(0.12); }
        if (ev.perfect) { this.text(ev.x, ev.y - 52, 'PERFECT CRIT!', { size: 24, color: '#ff9ee0', life: 1.0, pop: 2 }); this.ring(ev.x, ev.y, 60, '#ff9ee0', 0.3, 8); }
        if (ev.heavy) { this.ring(ev.x, ev.y, 34 + ev.r, '#ffffff', 0.22, 5); this.shake(0.1); this.punch(ev.ang, 4); }
        else this.shake(0.035);
        this.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.08, size: ev.r * 1.6, color: '#fff' });
        if (!this.lite && (ev.heavy || ev.crit) && this.parts.length < 900) { this.add({ type: 'glow', x: ev.x, y: ev.y, size: ev.r * 1.8 + (ev.crit ? 16 : 0), color: ev.crit ? '#fff0d0' : col, life: 0.18, a: 0.3 }); if (ev.heavy || ev.crit) this.add({ type: 'shock', x: ev.x, y: ev.y, r0: ev.r * 0.6, r1: ev.r + (ev.crit ? 90 : 60), life: 0.28, color: col, width: ev.crit ? 18 : 12 }); }
        if (me && ev.crit && ev.heavy) this.slowmo(0.05, 0.35); // a crit on a heavy hit: a micro hit-stop
        break;
      }
      case 'swing': {
        if (basicFx(this, ev, me)) break; // per-class LMB look (fxbasic.js)
        const col = ev.w ? WM_COL[ev.w] : ev.counter ? '#9fe0ff' : ev.heavy ? '#fff3a0' : '#ffffff';
        this.add({ type: 'slash', x: ev.x, y: ev.y, ang: ev.ang, arc: Math.min(ev.arc, TAU), r: ev.range, life: ev.heavy ? 0.22 : 0.16, color: col, width: (ev.heavy ? 22 : 14) * (ev.w === 'H' ? 1.4 : ev.w === 'A' ? 0.8 : 1), dir: ev.idx === 1 ? -1 : 1 });
        if (ev.w === 'H' && ev.heavy) { this.add({ type: 'crack', x: ev.x + Math.cos(ev.ang) * 70, y: ev.y + Math.sin(ev.ang) * 70, r: 60, life: 0.9, seed: Math.random() * TAU, glow: true }); this.shake(0.2); }
        if (ev.counter) { this.ring(ev.x, ev.y, 130, '#9fe0ff', 0.3, 8); this.shake(0.3); }
        break;
      }
      case 'attack': break;
      case 'shoot': {
        if (basicFx(this, ev, me)) break; // per-class LMB look (fxbasic.js)
        const col = ev.cls === 'mage' ? '#b69cff' : '#fff6c8';
        this.puffs(ev.x + Math.cos(ev.ang) * 22, ev.y + Math.sin(ev.ang) * 22, ev.heavy ? 5 : 2, col, 6, 60, 0.25);
        if (ev.pierce) { this.ring(ev.x + Math.cos(ev.ang) * 24, ev.y + Math.sin(ev.ang) * 24, 40, '#c9ffb8', 0.2, 5); this.shake(0.12); }
        break;
      }
      case 'dodge': this.puffs(ev.x, ev.y + 8, 6, 'rgba(255,255,255,.9)', 9, 80, 0.35); break;
      case 'evadeDash': this.puffs(ev.fx, ev.fy + 8, 5, 'rgba(255,255,255,.9)', 8, 70, 0.3); break; // an evasive dash starts: the Dodge puff where you left
      case 'slam': {
        this.ring(ev.x, ev.y, ev.r, '#fff3c4', 0.35, ev.big ? 14 : 10);
        this.ring(ev.x, ev.y, ev.r * 0.7, '#ffcf6b', 0.28, 6);
        this.chunks(ev.x, ev.y, ev.big ? 20 : 12, '#8a6a4a', 320);
        this.puffs(ev.x, ev.y, 14, 'rgba(230,210,170,.9)', 18, 180, 0.6);
        this.add({ type: 'crack', x: ev.x, y: ev.y, r: ev.r * 0.9, life: 1.0, seed: Math.random() * 100 });
        this.shake(ev.big ? 0.7 : 0.5);
        if (ev.leap) { this.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.12, size: ev.r * 2, color: '#fff1c4' }); this.ring(ev.x, ev.y, ev.r * 1.35, '#ffffff', 0.3, 6); this.sparks(ev.x, ev.y, -Math.PI / 2, 14, '#ffd27a', 520, Math.PI); if (me && ev.big) this.text(ev.x, ev.y - 90, 'CRASH LANDING!', { size: 28, color: '#ffae3b', vy: -40, pop: 2, life: 0.9, vx: 0 }); }
        break;
      }
      case 'spin': this.add({ type: 'slash', x: ev.x, y: ev.y, ang: ev.t * 0.55, arc: TAU * 0.8, r: ev.r, life: 0.15, color: ev.cls === 'bladedancer' ? '#ffb8e8' : '#ffffff', width: 12, dir: 1, follow: ev.pid }); break;
      // ---- Cleric
      case 'heal': {
        this.text(ev.x, ev.y - 14 - heroTextLift(), '+' + ev.amount, { size: ev.amount >= 60 ? 28 : 22, color: '#6dff7a', vy: -55, pop: 1.5, life: 1.0 });
        for (let i = 0; i < 5; i++) this.add({ type: 'plus', x: ev.x + rnd(-18, 18), y: ev.y + rnd(0, 26), vx: 0, vy: rnd(-70, -40), life: rnd(0.5, 0.8), size: rnd(4, 6.5), color: '#7dff8a', drag: 0.97 });
        break;
      }
      case 'shield': this.ring(ev.x, ev.y + 16, 40, '#bfefff', 0.35, 7); this.text(ev.x, ev.y - 20 - heroTextLift(), 'SHIELD ' + ev.amount, { size: 17, color: '#bfefff', vy: -45, pop: 1.3, life: 0.9 }); break;
      case 'defx': { // melee defensive layers (sim/defense.js)
        const L = heroTextLift();
        if (ev.k === 'rebuke') { this.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.12, size: 120, color: '#ffe9a8' }); this.ring(ev.x, ev.y + 10, 70, '#ffc93b', 0.4, 10); this.ring(ev.x, ev.y + 10, 46, '#fff4d0', 0.3, 5); this.sparks(ev.x, ev.y, -Math.PI / 2, 16, '#ffd27a', 460, Math.PI); this.text(ev.x, ev.y - 40 - L, 'IRON REBUKE!', { size: 26, color: '#ffc93b', vy: -55, pop: 2, life: 1.0 }); }
        else if (ev.k === 'shadowtime') { this.ring(ev.x, ev.y + 20, ev.r || 240, '#b48cff', 0.6, 4); this.ring(ev.x, ev.y + 20, (ev.r || 240) * 0.55, '#ff9ee0', 0.45, 6); this.puffs(ev.x, ev.y + 20, 12, '#3b2457', 14, 160, 0.6); this.text(ev.x, ev.y - 40 - L, 'SHADOW TIME', { size: 24, color: '#d6b8ff', vy: -45, pop: 2, life: 1.1 }); }
        else if (ev.k === 'ironbody') { this.ring(ev.x, ev.y + 14, 64, '#ffb347', 0.45, 9); this.puffs(ev.x, ev.y + 10, 10, '#ffe0a0', 12, 140, 0.5); this.sparks(ev.x, ev.y, -Math.PI / 2, 10, '#fff1c4', 300, 0.9); this.text(ev.x, ev.y - 40 - L, 'IRON BODY +' + (ev.n || 0), { size: 22, color: '#ffcf6b', vy: -50, pop: 1.8, life: 1.0 }); }
        else if (ev.k === 'scale') { this.ring(ev.x, ev.y + 12, 58, '#7fd6ff', 0.4, 8); this.ring(ev.x, ev.y + 12, 36, '#d8f4ff', 0.3, 5); this.sparks(ev.x, ev.y + 12, 0, 14, '#9fe6ff', 340, Math.PI); this.text(ev.x, ev.y - 40 - L, 'DRAGON SCALE', { size: 20, color: '#9fe6ff', vy: -45, pop: 1.6, life: 0.9 }); }
        break;
      }
      case 'absorb': this.text(ev.x, ev.y - 6 - heroTextLift(), ev.broke ? 'SHIELD BROKEN' : 'ABSORB ' + ev.amount, { size: ev.broke ? 18 : 16, color: '#9fe0ff', vy: -45, pop: 1.2, life: 0.8 }); if (ev.broke) this.sparks(ev.x, ev.y + 16 - heroTextLift() * 0.8, 0, 12, '#dff6ff', 320, Math.PI); break;
      case 'smite': {
        this.ring(ev.x, ev.y, ev.r, '#fff6c8', 0.35, 12);
        this.ring(ev.x, ev.y, ev.r * 0.6, '#ffe27a', 0.3, 7);
        this.add({ type: 'beam', x: ev.x, y: ev.y, life: 0.5, color: '#ffe27a', size: 34 });
        this.chunks(ev.x, ev.y, 10, '#8a6a4a', 280);
        this.sparks(ev.x, ev.y, 0, 16, '#fff3a0', 420, Math.PI);
        this.add({ type: 'crack', x: ev.x, y: ev.y, r: ev.r * 0.8, life: 0.9, seed: Math.random() * 100 });
        this.shake(0.4);
        break;
      }
      case 'judgment': {
        const big = 0.5 + (ev.k || 0);
        this.add({ type: 'beam', x: ev.x, y: ev.y, life: 0.9, color: '#fff3a0', size: 70 + 60 * (ev.k || 0) });
        this.ring(ev.x, ev.y, ev.r * 1.1, '#ffffff', 0.45, 18);
        this.ring(ev.x, ev.y, ev.r * 0.75, '#ffe27a', 0.4, 12);
        this.ring(ev.x, ev.y, ev.r * 1.6, '#ffe27a', 0.6, 6);
        for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; this.add({ type: 'shard', x: ev.x, y: ev.y, vx: Math.cos(a) * 460, vy: Math.sin(a) * 460, life: 0.4, size: 10, color: '#fff6c8', ang: a, drag: 0.88, edge: '#e0a21f' }); }
        this.puffs(ev.x, ev.y, 16, 'rgba(255,240,190,.9)', 20, 220, 0.6);
        this.shake(0.5 + 0.4 * big);
        if (ev.pid === this.localPid) this.banner('JUDGMENT!', '#ffe27a', `Holy Charge ${Math.round((ev.k || 0) * 100)}%`, 1.1, 46);
        break;
      }
      // ---- Ultimate meter & ultimates
      case 'ultGain': {
        if (!me) break;
        const col = ev.repeat ? '#b9a98a' : '#ffd23f';
        this.text(ev.x, ev.y - 20 - heroTextLift(), `+${ev.amount >= 1 ? Math.round(ev.amount) : ev.amount} ULT${ev.repeat ? ' (repeat)' : ''}`, { size: ev.repeat ? 18 : 22, color: col, vy: -55, pop: 1.6, life: 1.1 });
        if (ev.bonus && !ev.trinity) { this.text(ev.x, ev.y - 52, `ROTATION! +${Math.round(ev.bonus)}`, { size: 30, color: '#7af0ff', vy: -45, pop: 2.2, life: 1.4 }); this.ring(ev.x, ev.y + 44, 90, '#7af0ff', 0.45, 8); }
        if (ev.full) { this.banner('ULTIMATE READY!', '#ffd23f', 'Press ' + (this.ultKeyLabel ? this.ultKeyLabel() : 'T'), 1.4, 48); this.ring(ev.x, ev.y + 44, 120, '#ffd23f', 0.5, 10); }
        break;
      }
      case 'rotationBroken': if (me) this.text(ev.x, ev.y - 30, 'ROTATION BROKEN', { size: 18, color: '#ff8a7a', vy: -40, pop: 1.4, life: 0.9 }); break;
      case 'ascult': ascUltFx(this, ev, me); break; // (Part B: the Ascended Astral Echo)
      case 'ascalt': ascAltFx(this, ev); break; // (Part D A3: an Astral skill variant)
      case 'ult': {
        const col = CLASS_FX[ev.cls] || '#ffd23f';
        if (me) this.banner(ev.name.toUpperCase() + '!', col, 'ULTIMATE', 1.6, 64);
        if (skd === 'ult') break; // the class's new ult recipe (fxskills.js) carries the look: no generic ring / flash on top
        if (me) { this.flash = Math.max(this.flash || 0, 0.6); this.flashColor = col; }
        this.ring(ev.x, ev.y + 20, 160, col, 0.5, 12); this.puffs(ev.x, ev.y + 20, 14, col, 16, 200, 0.6);
        this.shake(0.35);
        break;
      }
      case 'titanSlam':
        this.ring(ev.x, ev.y, ev.r * 1.15, '#fff1c4', 0.5, 22); this.ring(ev.x, ev.y, ev.r * 0.75, '#ff5e3b', 0.45, 14); this.ring(ev.x, ev.y, ev.r * 0.4, '#ffd27a', 0.35, 10);
        this.chunks(ev.x, ev.y, 34, '#6d5a44', 520); this.puffs(ev.x, ev.y, 26, 'rgba(210,190,160,.9)', 26, 320, 0.8);
        this.add({ type: 'crack', x: ev.x, y: ev.y, r: ev.r, life: 1.6, seed: Math.random() * 100, glow: true });
        this.shake(1); if (me) this.flash = Math.max(this.flash || 0, 0.35), this.flashColor = '#ffd27a';
        break;
      case 'rage': this.ring(ev.x, ev.y, 110, '#ff3b2b', 0.5, 10); this.sparks(ev.x, ev.y, -Math.PI / 2, 22, '#ff7a5c', 420, Math.PI); if (me) this.text(ev.x, ev.y - 70, 'RAGE!', { size: 30, color: '#ff5e3b', vy: -40, pop: 2, life: 1.2 }); break;
      case 'ascend':
        this.ring(ev.x, ev.y, ev.r, '#fff3a0', 0.6, 14); this.ring(ev.x, ev.y, ev.r * 0.6, '#ffffff', 0.5, 8);
        for (let i = 0; i < 16; i++) this.add({ type: 'plus', x: ev.x + rnd(-40, 40), y: ev.y + rnd(-20, 30), vx: 0, vy: rnd(-220, -120), life: 0.9, size: 7, color: '#fff3a0', drag: 0.97 });
        this.shake(0.4);
        break;
      case 'auraPulse':
        this.ring(ev.x, ev.y, ev.r, '#ffe27a', 0.4, 6);
        for (let i = 0; i < 4; i++) { const a = rnd(0, TAU), r = rnd(0, ev.r * 0.8); this.add({ type: 'plus', x: ev.x + Math.cos(a) * r, y: ev.y + Math.sin(a) * r, vx: 0, vy: rnd(-70, -40), life: 0.7, size: 5, color: '#fff3a0', drag: 0.97 }); }
        break;
      case 'eclipse':
        this.ring(ev.x, ev.y, 140, '#6a2c8a', 0.5, 14); this.ring(ev.x, ev.y, 90, '#ff9ee0', 0.4, 8);
        this.puffs(ev.x, ev.y, 24, 'rgba(40,10,60,.85)', 22, 220, 0.8);
        this.shake(0.45); if (me) this.flash = Math.max(this.flash || 0, 0.5), this.flashColor = '#2a0c3a';
        break;
      case 'eclipseShade': if (me) this.puffs(ev.x, ev.y + 20, 5, 'rgba(60,20,90,.7)', 10, 90, 0.35); break;
      case 'eclipseBurst': { // Eclipse ends: a dark implosion on each Backstabbed enemy + a big violet number
        this.ring(ev.x, ev.y, (ev.r || 30) + 70, '#c89cff', 0.45, 12); this.ring(ev.x, ev.y, (ev.r || 30) + 30, '#2a0c3a', 0.3, 16);
        this.puffs(ev.x, ev.y, 16, 'rgba(40,10,60,.9)', 16, 240, 0.6);
        for (let i = 0; i < 4; i++) { const a = rnd(0, TAU); this.add({ type: 'slash', x: ev.x, y: ev.y, ang: a, arc: 1.4, r: 30 + (ev.r || 30), life: 0.25, color: '#ff9ee0', width: 10, dir: i % 2 ? -1 : 1 }); }
        if (this.finAt && this.finAt.pid === ev.pid && this.time - this.finAt.t < 0.3) this.text(ev.x, ev.y + (ev.r || 30) + 16, 'ECLIPSE ' + ev.dmg, { size: 22, color: '#d8a8ff', pop: 1.6, life: 1.1, vy: 30 }); // under the finisher's own number
        else this.text(ev.x, ev.y - (ev.r || 30) - 26, 'ECLIPSE ' + ev.dmg + '!', { size: 42, color: '#d8a8ff', pop: 2.6, life: 1.4, vy: -40 });
        this.shake(0.35);
        break;
      }
      case 'eclipseEnd':
        this.ring(ev.x, ev.y, 110, '#6a2c8a', 0.4, 10);
        if (me) this.text(ev.x, ev.y - 70, 'PIPS FULL', { size: 20, color: '#ff9ee0', vy: -40, pop: 1.5, life: 1.0 });
        break;
      case 'eclipseExtend': if (me) this.text(ev.x, ev.y - 20, `ECLIPSE +1s`, { size: 20, color: '#c89cff', vy: -50, pop: 1.6, life: 1.0 }); break;
      // ---- Blade Dancer
      case 'perfectDodge': this.text(ev.x, ev.y - 10, 'PERFECT DODGE!', { size: 24, color: '#ff9ee0', vy: -60, pop: 2, life: 1.0 }); this.ring(ev.x, ev.y + 30, 55, '#ff9ee0', 0.35, 8); this.puffs(ev.x, ev.y + 30, 8, '#ffd6f0', 10, 120, 0.4); break;
      case 'flicker': this.add({ type: 'trail', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.25, color: '#ff9ee0' }); this.puffs(ev.fx, ev.fy, 6, '#ffd6f0', 10, 90, 0.35); this.shake(0.12); break;
      case 'cut': {
        this.add({ type: 'trail', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.2, color: '#ff9ee0' });
        const a = Math.atan2(ev.ty - ev.y, ev.tx - ev.x);
        this.add({ type: 'slash', x: ev.tx, y: ev.ty, ang: a + Math.PI / 2, arc: 1.6, r: 40, life: 0.18, color: '#ffd6f0', width: 12, dir: ev.n % 2 ? -1 : 1 });
        this.puffs(ev.x, ev.y, 4, '#ff9ee0', 8, 80, 0.3);
        this.shake(0.12);
        break;
      }
      case 'gapClose': {
        const col = ev.cls === 'cleric' ? '#ffe08a' : ev.cls === 'bladedancer' ? '#ff9ee0' : '#ffb070';
        this.add({ type: 'trail', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.18, color: col });
        this.puffs(ev.fx, ev.fy, 5, 'rgba(220,210,190,.7)', 10, 90, 0.35);
        break;
      }
      case 'heartseeker': {
        this.add({ type: 'trail', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.22, color: '#ff5fb0' });
        this.add({ type: 'slash', x: ev.x + Math.cos(ev.ang) * 40, y: ev.y + Math.sin(ev.ang) * 40, ang: ev.ang, arc: 0.5, r: 46, life: 0.2, color: '#ffd6f0', width: 14, dir: 1 });
        this.puffs(ev.x, ev.y, 6, '#ff9ee0', 10, 110, 0.35); this.shake(0.2);
        break;
      }
      case 'vanish': {
        this.puffs(ev.x, ev.y, 22, 'rgba(90,80,110,.85)', 26, 160, 0.9); this.puffs(ev.x, ev.y, 10, 'rgba(200,190,230,.8)', 18, 90, 0.7);
        this.ring(ev.x, ev.y + 10, 70, '#8f86a8', 0.4, 10);
        if (me) this.text(ev.x, ev.y - 50, 'VANISH', { size: 20, color: '#c9b8ff', vy: -45, pop: 1.5, life: 0.8 });
        break;
      }
      case 'unstealth': this.puffs(ev.x, ev.y, 6, 'rgba(120,110,140,.7)', 14, 80, 0.4); break;
      // Vanish chains
      case 'shadowStep': {
        this.add({ type: 'trail', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.3, color: '#8f7ad8' });
        this.puffs(ev.fx, ev.fy, 12, 'rgba(70,55,100,.85)', 18, 110, 0.6); this.puffs(ev.x, ev.y, 8, 'rgba(120,100,170,.8)', 14, 90, 0.5);
        if (me) this.text(ev.x, ev.y - 50, 'SHADOW STEP', { size: 18, color: '#c9b8ff', vy: -40, pop: 1.4, life: 0.8 });
        break;
      }
      case 'shadowPierce': {
        this.add({ type: 'trail', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.35, color: '#b28cff' });
        this.add({ type: 'slash', x: (ev.fx + ev.x) / 2, y: (ev.fy + ev.y) / 2, ang: ev.ang, arc: 0.25, r: Math.hypot(ev.x - ev.fx, ev.y - ev.fy) / 2, life: 0.25, color: '#e8dcff', width: 16, dir: 1 });
        this.puffs(ev.x, ev.y, 8, '#b28cff', 12, 120, 0.4); this.shake(0.25);
        break;
      }
      case 'shadowPierceKill': if (me) this.text(ev.x, ev.y - 60, `+${ev.refund} PIPS · HIDDEN`, { size: 16, color: '#ff8ad8', vy: -40, pop: 1.3, life: 0.9 }); this.puffs(ev.x, ev.y, 10, 'rgba(90,80,110,.85)', 18, 100, 0.6); break;
      case 'blossom': this.text(ev.x, ev.y - 60, `+1 CUT (${ev.n})`, { size: 16 + Math.min(6, ev.n), color: '#ff5fb0', vy: -40, pop: 1.3, life: 0.7 }); this.ring(ev.x, ev.y, 50 + ev.n * 8, '#ff9ee0', 0.3, 6); break;
      case 'mark': this.puffs(ev.x, ev.y, 4, 'rgba(150,60,120,.8)', 8, 60, 0.3); if (ev.n >= 5) this.ring(ev.x, ev.y + 20, 34, '#ff4f9a', 0.3, 4); break;
      case 'shadowExecution': if (ev.n > 0) { this.text(ev.x, ev.y - 70, `×${ev.n} CLONES`, { size: 18 + Math.min(8, ev.n), color: '#d7b6ff', vy: -40, pop: 1.5, life: 0.9 }); this.puffs(ev.x, ev.y, 10, 'rgba(60,40,90,.85)', 16, 110, 0.5); } break;
      case 'cloneStab': {
        this.add({ type: 'clone', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.42, color: '#2a1c3f', seed: ev.i });
        this.add({ type: 'trail', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.22, color: '#7a4fc9' });
        this.puffs(ev.fx, ev.fy, 5, 'rgba(60,40,90,.8)', 12, 70, 0.4); this.shake(0.06);
        break;
      }
      case 'decoyHit': this.puffs(ev.x, ev.y, 6, 'rgba(90,80,120,.8)', 12, 90, 0.4); break;
      // ---- Eclipse finisher routes
      case 'routeStep':
        if (!me) break;
        if (ev.step < ev.of) this.text(ev.x, ev.y - 64, `${ev.name} ${ev.step}/${ev.of}`, { size: 17, color: ev.route === 'mob' ? '#ff9ee0' : '#ffe6a8', vy: -36, pop: 1.5, life: 0.9 });
        this.ring(ev.x, ev.y + 12, 46 + ev.step * 10, ev.route === 'mob' ? '#ff9ee0' : '#ffe6a8', 0.3, 5);
        break;
      case 'routeBreak': if (me && ev.step > 0) this.text(ev.x, ev.y - 44, `${ev.name}: broken`, { size: 14, color: '#b9a9c9', vy: -30, pop: 1.1, life: 0.8 }); break;
      case 'ttcStart': { // time slows, the dancer splits into shadows
        this.cine.push({ kind: 'dark', t: 0, life: 4, a: 0.62, pid: ev.pid, col: 'rgba(12,4,26,' });
        this.slowmo(0.4, 0.3);
        this.ring(ev.x, ev.y, ev.r, 'rgba(255,158,224,.55)', 0.6, 4);
        this.ring(ev.x, ev.y, 120, '#ff9ee0', 0.4, 12);
        this.puffs(ev.x, ev.y, 18, 'rgba(40,14,70,.9)', 20, 220, 0.6);
        for (const [cx, cy] of ev.clones || []) {
          this.add({ type: 'trail', x: ev.x, y: ev.y, x2: cx, y2: cy, life: 0.3, color: '#7a4fc9' });
          this.add({ type: 'ghost', x: cx, y: cy, life: 0.7, ang: Math.atan2(cy - ev.y, cx - ev.x) });
          this.puffs(cx, cy, 4, 'rgba(60,40,90,.85)', 12, 80, 0.4);
        }
        this.shake(0.45);
        if (me) { this.banner('TEN THOUSAND CUTS!', '#ff9ee0', `×${ev.n} SHADOWS`, 1.8, 58); this.flash = Math.max(this.flash || 0, 0.4); this.flashColor = '#2a0c3a'; }
        break;
      }
      case 'ttcCut': {
        if (ev.k > 0) this.add({ type: 'dashclone', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.34, seed: ev.k });
        this.add({ type: 'trail', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.16, color: ev.k ? '#9a6ae0' : '#ff9ee0' });
        this.add({ type: 'slash', x: ev.tx, y: ev.ty, ang: ev.ang + Math.PI / 2, arc: 1.7, r: 42, life: 0.16, color: '#fff0fa', width: 12, dir: ev.k % 2 ? -1 : 1 });
        this.sparks(ev.tx, ev.ty, ev.ang, 4, '#ffd6f0', 340, 0.8);
        if (this.hang.length < 110) this.hang.push({ x: ev.tx, y: ev.ty, ang: ev.ang, t: 0, life: 6, pid: ev.pid, dir: ev.k % 2 ? -1 : 1, r: 30 + ((ev.k * 7) % 12) });
        this.shake(0.04);
        break;
      }
      case 'ttcDetonate': { // every hanging crescent bursts at once
        this.finAt = { pid: ev.pid, t: this.time };
        let list = this.hang.filter((h) => h.pid === ev.pid);
        if (!list.length && ev.slashes) list = ev.slashes.map(([x, y, ang]) => ({ x, y, ang, r: 34 }));
        this.hang = this.hang.filter((h) => h.pid !== ev.pid);
        const few = list.length > 40;
        for (let i = 0; i < list.length; i++) {
          const h = list[i];
          this.add({ type: 'slash', x: h.x, y: h.y, ang: h.ang + Math.PI / 2, arc: 2.4, r: h.r + 22, life: 0.3, color: '#ffffff', width: 16, dir: 1 });
          if (!few || i % 2 === 0) this.ring(h.x, h.y, 70, i % 2 ? '#ff9ee0' : '#e8dcff', 0.35, 8);
          if (!few || i % 3 === 0) this.sparks(h.x, h.y, h.ang, 5, '#ffe0f4', 460, Math.PI);
        }
        this.ring(ev.x, ev.y, 520, '#ffd6f0', 0.55, 20); this.ring(ev.x, ev.y, 300, '#ff5fb0', 0.45, 14);
        this.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.2, size: 600, color: '#fff0fa' });
        for (const c of this.cine) if (c.kind === 'dark' && c.pid === ev.pid) c.life = Math.min(c.life, c.t + 0.45);
        this.shake(1); this.slowT = 0; this.slowK = 1;
        if (me) { this.flash = Math.max(this.flash || 0, 0.8); this.flashColor = '#ffe0f4'; }
        this.text(ev.x, ev.y - 90, `${(ev.total || 0) + (ev.cutDmg || 0)}!`, { size: 64, color: '#ffb8e8', pop: 2.8, life: 1.8, vy: -30, vx: 0 });
        this.text(ev.x, ev.y - 40, `${ev.cuts} CUTS · ${ev.hits} DETONATED`, { size: 20, color: '#fff', vy: -30, pop: 1.4, life: 1.6, vx: 0 });
        break;
      }
      case 'crescentStart': { // an eclipsed moon rises behind the target, clones gather in a ring
        const R = Math.max(110, (ev.r || 30) * 2.4);
        this.cine.push({ kind: 'dark', t: 0, life: 4, a: 0.7, pid: ev.pid, col: 'rgba(8,2,20,' });
        const ring = [];
        const base = Math.atan2(ev.py - ev.y, ev.px - ev.x);
        for (let i = 0; i < ev.n; i++) { const a = base + (i / ev.n) * Math.PI * 2, d = (ev.r || 30) + 118; ring.push({ x: ev.x + Math.cos(a) * d, y: ev.y + Math.sin(a) * d, a }); }
        this.cine.push({ kind: 'moon', t: 0, life: 5, x: ev.x, y: ev.y, R, pid: ev.pid, id: ev.id, ring, dashT: -1, crackT: -1, n: ev.n });
        this.puffs(ev.x, ev.y, 14, 'rgba(30,8,50,.9)', 24, 200, 0.7);
        this.shake(0.4);
        if (me) { this.banner('CRESCENT EXECUTION', '#ffe6a8', `${ev.stacks} MARKS · ×${ev.mul} ATK · GUARANTEED CRIT`, 1.1, 56); this.flash = Math.max(this.flash || 0, 0.5); this.flashColor = '#1a0826'; }
        break;
      }
      case 'crescentDash': {
        const m = this.cine.find((c) => c.kind === 'moon' && c.pid === ev.pid && c.dashT < 0);
        if (m) {
          m.dashT = m.t; m.x = ev.x; m.y = ev.y;
          for (const c of m.ring) this.add({ type: 'arc', x: c.x, y: c.y, x2: ev.x, y2: ev.y, bend: 0.35 * (c.a % 2 > 1 ? 1 : -1), life: 0.4, color: '#ffe6a8' });
        }
        this.add({ type: 'arc', x: ev.px, y: ev.py, x2: ev.x, y2: ev.y, bend: 0.2, life: 0.4, color: '#ff9ee0' });
        break;
      }
      case 'crescentImpact': {
        this.finAt = { pid: ev.pid, t: this.time };
        const m = this.cine.find((c) => c.kind === 'moon' && c.pid === ev.pid && c.crackT < 0);
        if (m) { m.crackT = m.t; m.life = m.t + 0.55; }
        for (const c of this.cine) if (c.kind === 'dark' && c.pid === ev.pid) c.life = Math.min(c.life, c.t + 0.6);
        const r = ev.r || 30;
        this.ring(ev.x, ev.y, r + 260, '#fff6d8', 0.55, 24); this.ring(ev.x, ev.y, r + 150, '#ffe6a8', 0.45, 16); this.ring(ev.x, ev.y, r + 60, '#ff5fb0', 0.35, 12);
        for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; this.add({ type: 'slash', x: ev.x, y: ev.y, ang: a, arc: 1.2, r: r + 50, life: 0.3, color: i % 2 ? '#ffe6a8' : '#ff9ee0', width: 14, dir: i % 2 ? -1 : 1 }); }
        this.sparks(ev.x, ev.y, 0, 26, '#fff6d8', 620, Math.PI); this.chunks(ev.x, ev.y, 16, '#3a1850', 460);
        this.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.22, size: r * 6 + 200, color: '#fff6d8' });
        this.shake(1); this.punch(0, 0);
        this.slowmo(0.35, 0.2);
        if (me) { this.flash = Math.max(this.flash || 0, 0.7); this.flashColor = '#fff6d8'; }
        if (ev.dmg > 0) this.text(ev.x, ev.y - r - 24, `${ev.dmg}!!`, { size: 104, color: '#fff1a0', pop: 3.2, life: 2.2, vy: -24, vx: 0, stroke: '#2a0c3a' });
        this.text(ev.x, ev.y - r - 8, ev.killed ? 'EXECUTED!' : `${ev.stacks} MARKS`, { size: 24, color: '#ff9ee0', vy: -30, pop: 1.6, life: 1.6, vx: 0 });
        break;
      }
      case 'backstab': {
        this.text(ev.x, ev.y - 10, 'BACKSTAB!', { size: 30, color: '#ff4fa3', vy: -55, pop: 2.4, life: 1.2 });
        this.ring(ev.x, ev.y + 30, 70, '#ff4fa3', 0.35, 10); this.shake(0.35);
        if (me) { this.flash = Math.max(this.flash || 0, 0.25); this.flashColor = '#ff4fa3'; if (ev.refund) this.text(ev.x, ev.y - 50, `+${ev.refund} INITIATIVE`, { size: 16, color: '#ffd6f0', vy: -40, pop: 1.3, life: 0.9 }); }
        break;
      }
      // ---- Warrior rework
      case 'sunder': this.text(ev.x, ev.y, 'SUNDERED', { size: 15, color: '#ff7a5c', vy: -35, pop: 1.3, life: 0.8 }); break;
      case 'crash': { // Crash Charge impact: a hard stop, big ring, dust and a shove of the camera
        this.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.12, size: ev.r * 2.2, color: '#fff1c4' });
        this.ring(ev.x, ev.y, ev.r + 30, '#fff3c4', 0.35, 14); this.ring(ev.x, ev.y, ev.r * 0.6, '#ff8a2a', 0.3, 8);
        this.sparks(ev.x, ev.y, ev.ang, 18, '#ffd27a', 560, 1.1); this.chunks(ev.x, ev.y, 10, '#8a6a4a', 340);
        this.puffs(ev.x, ev.y, 10, 'rgba(230,210,170,.9)', 16, 170, 0.5);
        this.shake(0.55); this.punch(ev.ang, 14);
        if (me) this.text(ev.x, ev.y - 60, 'CRASH!', { size: 30, color: '#ffae3b', vy: -50, pop: 2.2, life: 0.8 });
        break;
      }
      case 'bash': { // Shoulder Bash / Juggernaut: a heavy, directional thud
        const big = ev.big || ev.jugg;
        this.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.1, size: 120 + (big ? 60 : 0), color: '#fff' });
        this.ring(ev.x, ev.y, (ev.r || 20) + (big ? 90 : 60), big ? '#ff5a3c' : '#fff3c4', 0.3, big ? 14 : 10);
        this.sparks(ev.x, ev.y, ev.ang, big ? 22 : 14, '#fff3a0', 600, 0.6);
        this.shake(big ? 0.6 : 0.4); this.punch(ev.ang, big ? 16 : 10);
        if (ev.jugg) this.text(ev.x, ev.y - 60, `JUGGERNAUT ${ev.jugg}!`, { size: 22 + ev.jugg * 4, color: '#ff5a3c', vy: -45, pop: 2, life: 0.8 });
        else if (me && ev.big) this.text(ev.x, ev.y - 60, 'SHOULDER BREAKER!', { size: 24, color: '#ffae3b', vy: -45, pop: 2, life: 0.8 });
        break;
      }
      // ---- Blade Dancer crit loop
      case 'markPop': { // a crit on a Marked enemy detonates the Mark
        this.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.12, size: 150, color: '#ffd0ee' });
        this.ring(ev.x, ev.y, (ev.r || 20) + 40 + ev.n * 8, '#ff4fa3', 0.35, 10); this.ring(ev.x, ev.y, (ev.r || 20) + 14, '#ffffff', 0.25, 6);
        for (let i = 0; i < 4; i++) { const a = i * (TAU / 4) + rnd(0, 0.4); this.add({ type: 'slash', x: ev.x, y: ev.y, ang: a, arc: 0.4, r: 40 + ev.n * 4, life: 0.18, color: '#ff9ee0', width: 12, dir: 1 }); }
        this.shake(0.25);
        this.text(ev.x, ev.y - 50, ev.n > 1 ? `DETONATE ×${ev.n}!` : 'DETONATE!', { size: 22 + Math.min(10, ev.n * 2), color: '#ff4fa3', vy: -45, pop: 2, life: 0.9 });
        break;
      }
      case 'critPip': if (me) this.text(ev.x + 26, ev.y, `+${ev.n}`, { size: 15, color: '#ffd6f0', vy: -40, pop: 1.3, life: 0.6 }); break;
      case 'edge': if (me && ev.max) { this.text(ev.x, ev.y - 20, 'MAX EDGE!', { size: 24, color: '#fff0fa', vy: -40, pop: 2, life: 1.0 }); this.ring(ev.x, ev.y + 50, 70, '#ff9ee0', 0.4, 8); } break;
      case 'nova': {
        this.ring(ev.x, ev.y, ev.r, '#dff7ff', 0.4, 12);
        this.ring(ev.x, ev.y, ev.r * 0.6, '#8fe1ff', 0.3, 6);
        for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; this.add({ type: 'shard', x: ev.x, y: ev.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 0.35, size: 9, color: '#e8fbff', ang: a, drag: 0.88 }); }
        this.shake(0.3);
        break;
      }
      case 'blink': {
        this.puffs(ev.fx, ev.fy, 10, '#b69cff', 12, 120, 0.4);
        this.puffs(ev.x, ev.y, 10, '#d9ccff', 12, 120, 0.4);
        this.add({ type: 'trail', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.25, color: '#b69cff' });
        break;
      }
      case 'explosion': {
        this.ring(ev.x, ev.y, ev.r, '#e0d4ff', 0.3, 8);
        this.puffs(ev.x, ev.y, 10, '#b69cff', 14, 150, 0.45);
        this.sparks(ev.x, ev.y, 0, 12, '#f0e8ff', 320, Math.PI);
        this.shake(0.15);
        break;
      }
      case 'areaHit': this.areaHit(ev); break;
      case 'projEnd': this.puffs(ev.x, ev.y, 2, ev.team === 'enemy' ? 'rgba(255,255,255,.7)' : 'rgba(255,255,220,.8)', 5, 50, 0.2); break;
      case 'death': {
        if (ev.fod) { // horde fodder: a quick, cheap pop (dozens of these die per second)
          this.puffs(ev.x, ev.y, 4, 'rgba(255,255,255,.9)', ev.r * 0.6, ev.r * 4, 0.4);
          this.chunks(ev.x, ev.y, 6, ev.color || '#ffffff', 260);
          this.ring(ev.x, ev.y, ev.r * 1.8, '#ffffff', 0.22, 4);
          this.shake(0.025);
          break;
        }
        const n = ev.boss ? 60 : 16;
        this.puffs(ev.x, ev.y, ev.boss ? 30 : 10, 'rgba(255,255,255,.95)', ev.r * 0.7, ev.r * 5, 0.55);
        this.chunks(ev.x, ev.y, n, ev.color || '#ffffff', ev.boss ? 500 : 300);
        this.ring(ev.x, ev.y, ev.r * 2.2, '#ffffff', 0.3, 6);
        if (ev.boss && ev.ul) this.shake(0.6); // (Part F: an echo breaks; the shatter / victory events carry the banners)
        else if (ev.boss && ev.pr) { this.shake(1); this.banner('PRACTICE CLEAR', '#7ee0ff', `${(ev.name || 'Boss').split(',')[0]} down · practice pays nothing`, 3.2, 72, 'victory'); }
        else if (ev.boss) { this.shake(1); this.banner('VICTORY!', '#ffd23f', `${(ev.name || 'Grimtusk').split(',')[0]} has fallen`, 3.2, 72, 'victory'); }
        else this.shake(ev.elite ? 0.25 : 0.08);
        break;
      }
      case 'loot': {
        if (ev.vac) { if (ev.rarity === 3) this.text(ev.x, ev.y - 40, 'LEGENDARY!', { size: 26, color: '#ffb52e', life: 1.6, vy: -30 }); else if (ev.rarity >= 4) this.text(ev.x, ev.y - 48, ev.rarity === 5 ? 'TRIAL SIGIL!' : 'SET ITEM!', { size: 30, color: RAR[ev.rarity] || '#fff', life: 2, vy: -26, pop: 2 }); break; } // (shower gear: the beam + pop are client/lootfx.js)
        const col = ['#e8d2b0', '#4aa8ff', '#b86bff', '#ffb52e', '#2ee6c4', '#ff4f7b'][ev.rarity] || '#fff';
        this.add({ type: 'beam', x: ev.x, y: ev.y, life: ev.rarity >= 2 ? 1.6 : 0.8, color: col, size: ev.rarity >= 2 ? 22 : 12 });
        if (ev.rarity === 3) this.text(ev.x, ev.y - 40, 'LEGENDARY!', { size: 26, color: '#ffb52e', life: 1.6, vy: -30 });
        if (ev.rarity >= 4) { this.add({ type: 'beam', x: ev.x, y: ev.y, life: 2.4, color: '#ffffff', size: 10 }); this.ring(ev.x, ev.y, 90, col, 0.7, 7); this.sparks(ev.x, ev.y, 0, 18, col, 300, Math.PI * 2); this.text(ev.x, ev.y - 48, ev.rarity === 5 ? 'TRIAL SIGIL!' : 'SET ITEM!', { size: 30, color: col, life: 2, vy: -26, pop: 2 }); }
        break;
      }
      case 'xp': if (me && !ev.q) this.text(ev.x + 20, ev.y - 10, `+${ev.amount} XP`, { size: 15, color: '#c9a7ff', vy: -40, pop: 1.1, life: 0.8 }); break;
      case 'levelup': {
        this.add({ type: 'beam', x: ev.x, y: ev.y, life: 1.4, color: '#ffe45c', size: 40 });
        this.ring(ev.x, ev.y, 120, '#ffe45c', 0.5, 10);
        if (!me) this.text(ev.x, ev.y - 50, 'LEVEL UP!', { size: 34, color: '#ffe45c', life: 1.6, vy: -40, pop: 2 });
        if (me) this.banner('LEVEL ' + ev.level, '#ffe45c', 'Stats increased · fully healed', 2);
        break;
      }
      case 'chain': {
        const wc = WM_CHAIN[ev.id] && WM_COL[WM_CHAIN[ev.id]]; // Warrior chains: banner + burst in the weapon's colour
        if (skd === 'route') break; // the 5-step moment has its own title band
        if (skd === 'chain') { if (me && !ev.fin && !cardUp(sim)) this.banner(ev.name.toUpperCase() + '!', wc || '#ffd23f', 'CHAIN COMBO', wc ? 1.5 : 1.3, wc ? 58 : 50); break; } // the new chain look replaces the generic ring + sparks
        this.ring(ev.x, ev.y, 90, wc || '#ffd23f', 0.45, 10);
        this.sparks(ev.x, ev.y, 0, 20, wc || '#ffe45c', 420, Math.PI);
        if (wc) { this.ring(ev.x, ev.y, 130, '#ffffff', 0.35, 5); this.sparks(ev.x, ev.y, 0, 12, '#ffffff', 520, Math.PI); }
        if (me && !ev.fin && !cardUp(sim)) this.banner(ev.name.toUpperCase() + '!', wc || '#ffd23f', 'CHAIN COMBO', wc ? 1.5 : 1.3, wc ? 58 : 50); // (a route finisher has its own banner)
        break;
      }
      case 'evaded': if (!ev.shove) this.lastEvadedAt = performance.now(); evadedFx(this, ev, me); break;
      case 'holdBreak': holdBreakFx(this, ev, me); break; // dodge pass 2: a timed Dodge broke a hold // the dodge rework: a proper evade (gold flash)
      case 'evade': if (this.lastEvadedAt && performance.now() - this.lastEvadedAt < 120) break; this.text(ev.x, ev.y - 6, 'EVADE', { size: 20, color: '#8ff3ff', vy: -60, pop: 1.4, life: 0.6 }); break;
      case 'counter': this.text(ev.x, ev.y - 40, 'COUNTER!', { size: 30, color: '#9fe0ff', life: 1.0, pop: 2 }); this.ring(ev.x, ev.y, 60, '#9fe0ff', 0.25, 8); if (me) this.text(ev.x, ev.y - 74, 'Charge reset · Retaliation', { size: 15, color: '#ffae3b', vy: -30, pop: 1.2, life: 1.1 }); break;
      case 'cc': {
        if (ev.kind === 'up' && ev.id != null) { KNOCKUPS.set(ev.id, { t0: performance.now() / 1000, dur: Math.max(0.3, (ev.t || 40) / 60) }); if (KNOCKUPS.size > 300) KNOCKUPS.clear(); }
        const map = { up: ['LAUNCHED!', '#ffcf6a'], down: ['KNOCKDOWN', '#ffa65c'], freeze: ['FROZEN', '#bff4ff'], root: ['ROOTED', '#b7f07a'], broken: ['BROKEN!', '#ff5e5b'], dazed: ['DAZED', '#ffe45c'] };
        const [s, c] = map[ev.kind] || ['', '#fff'];
        const last = this._lastCC || {};
        if (last[ev.kind] && performance.now() - last[ev.kind] < 160) break;
        last[ev.kind] = performance.now(); this._lastCC = last;
        this.text(ev.x, ev.y - 26, s, { size: ev.kind === 'broken' ? 36 : 17, color: c, vy: -35, pop: 1.3, life: 0.9 });
        if (ev.kind === 'broken') { this.shake(0.5); this.banner('POISE BROKEN!', '#ff5e5b', 'Boss is vulnerable', 1.5, 46); }
        break;
      }
      case 'hurt': if (me) { this.vignette = Math.min(1, this.vignette + (ev.heavy ? 0.8 : 0.45)); this.shake(ev.heavy ? 0.35 : 0.18); } break;
      case 'bossPhase': this.shake(0.8); this.ring(ev.x, ev.y, 320, '#ff5e5b', 0.6, 16); this.banner(ev.phase === 3 ? 'GRIMTUSK IS ENRAGED!' : 'PHASE ' + ev.phase, '#ff5e5b', ev.phase === 2 ? 'Charges & summons' : 'Meteor rain', 2); break;
      case 'bossSummon': this.ring(ev.x, ev.y, 160, '#b86bff', 0.4, 8); break;
      case 'teleport': this.puffs(ev.x, ev.y, 8, '#b86bff', 10, 90, 0.4); break;
      case 'slamWall': this.shake(0.5); this.chunks(ev.x, ev.y, 16, '#6d6a78', 380); break;
      case 'areaCancel': this.puffs(ev.x, ev.y, 4, 'rgba(255,255,255,.6)', 10, 40, 0.3); break;
      case 'respawn': this.ring(ev.x, ev.y, 80, '#ffffff', 0.5, 8); this.puffs(ev.x, ev.y, 12, '#fff', 12, 110, 0.5); break;
      case 'playerDeath': this.chunks(ev.x, ev.y, 20, '#ff5e5b', 300); this.shake(0.7); break;
      case 'pickup': if (me) for (const it of ev.items) this.text(ev.x ?? 0, ev.y ?? 0, '', {}); break;
    }
  }

  areaHit(ev) {
    switch (ev.kind) {
      case 'volley':
        for (let i = 0; i < 6; i++) { const a = rnd(0, TAU), r = rnd(0, ev.r); this.add({ type: 'arrowfall', x: ev.x + Math.cos(a) * r, y: ev.y + Math.sin(a) * r, life: 0.18, color: '#fff6c8' }); }
        this.puffs(ev.x, ev.y, 3, 'rgba(230,210,170,.8)', 10, 90, 0.35);
        if (ev.n) this.shake(0.05);
        break;
      case 'blast':
        this.ring(ev.x, ev.y, ev.r, '#e0d4ff', 0.35, 12);
        this.ring(ev.x, ev.y, ev.r * 0.6, '#9d7bff', 0.3, 8);
        this.puffs(ev.x, ev.y, 14, '#b69cff', 16, 200, 0.5);
        this.sparks(ev.x, ev.y, 0, 16, '#ffffff', 420, Math.PI);
        this.shake(0.35);
        break;
      case 'meteor':
        this.ring(ev.x, ev.y, ev.r * 1.1, '#fff1c4', 0.45, 18);
        this.ring(ev.x, ev.y, ev.r * 0.7, '#ff9a3c', 0.4, 10);
        this.puffs(ev.x, ev.y, 24, '#ff8a3c', 22, 260, 0.7);
        this.puffs(ev.x, ev.y, 14, 'rgba(80,60,60,.8)', 24, 160, 0.9);
        this.chunks(ev.x, ev.y, 22, '#5a3d24', 420);
        this.add({ type: 'crack', x: ev.x, y: ev.y, r: ev.r, life: 1.4, seed: Math.random() * 100, glow: true });
        this.shake(0.8);
        if (ev.r > 200) { this.ring(ev.x, ev.y, ev.r * 1.5, '#ff5e3b', 0.6, 24); this.chunks(ev.x, ev.y, 20, '#3a2418', 560); this.shake(0.5); this.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.14, size: ev.r * 2, color: '#fff1c4' }); }
        break;
      case 'burn': break;
      case 'arrowstorm':
        for (let i = 0; i < 12; i++) { const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * ev.r; this.add({ type: 'arrowfall', x: ev.x + Math.cos(a) * r, y: ev.y + Math.sin(a) * r, life: 0.2, color: '#fff6c8' }); }
        this.puffs(ev.x, ev.y, 5, 'rgba(230,210,170,.8)', 12, 140, 0.4);
        this.shake(ev.n ? 0.06 : 0.02);
        break;
      case 'sanctuary':
        this.ring(ev.x, ev.y, ev.r, '#fff3a0', 0.4, 6);
        for (let i = 0; i < 5; i++) { const a = rnd(0, TAU), r = rnd(0, ev.r * 0.8); this.add({ type: 'plus', x: ev.x + Math.cos(a) * r, y: ev.y + Math.sin(a) * r, vx: 0, vy: rnd(-60, -30), life: 0.7, size: 5, color: '#fff3a0', drag: 0.97 }); }
        break;
      case 'trap':
        this.ring(ev.x, ev.y, ev.r, '#b7f07a', 0.3, 8);
        this.chunks(ev.x, ev.y, 10, '#8a6a4a', 220);
        this.shake(0.15);
        break;
      default: // enemy attacks
        if (ev.team === 'enemy') {
          if (ev.shape === 'circle') { this.ring(ev.x, ev.y, ev.r, '#ffd0c4', 0.3, 10); this.puffs(ev.x, ev.y, 10, 'rgba(210,190,160,.85)', 16, ev.r * 1.6, 0.5); this.chunks(ev.x, ev.y, 8, '#7a6450', 260); }
          if (ev.shape === 'cone') this.add({ type: 'slash', x: ev.x, y: ev.y, ang: ev.ang, arc: ev.arc, r: ev.r, life: 0.2, color: '#ffb0a0', width: 18, dir: 1 });
          this.shake(ev.kind === 'slam' || ev.kind === 'meteorE' ? 0.25 : 0.1);
        }
    }
  }

  update(dt) {
    nsUpdate(this, dt);
    this.loot.update(dt);
    this.hordeAoe.update(dt);
    this.time = (this.time || 0) + dt;
    specTick(this);
    for (const c of this.cine) c.t += dt; // cinematics and hanging crescents follow real time (synced to sim events)
    this.cine = this.cine.filter((c) => c.t < c.life);
    for (const h of this.hang) h.t += dt;
    this.hang = this.hang.filter((h) => h.t < h.life);
    if (this.slowT > 0) { this.slowT -= dt; dt *= this.slowK; if (this.slowT <= 0) this.slowK = 1; }
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.punchX *= Math.pow(0.001, dt); this.punchY *= Math.pow(0.001, dt);
    this.vignette = Math.max(0, this.vignette - dt * 1.8);
    this.zoomK = Number.isFinite(this.zoomK) ? Math.min(0.3, this.zoomK) * Math.pow(0.004, dt) : 0; if (!(this.zoomK >= 0.001)) this.zoomK = 0; // (NaN-safe, clamped 0..0.3) // impact camera punch (fxmoment.js)
    this.flash = Math.max(0, (this.flash || 0) - dt * 2.2);
    for (const p of this.parts) {
      p.t += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const d = Math.pow(p.drag, dt * 60); p.vx *= d; p.vy *= d;
      if (p.vr) p.rot += p.vr * dt;
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
    if (this.parts.length > 1400) this.parts.splice(0, this.parts.length - 1400);
    this._clk = (this._clk || 0) + dt;
    for (const t of this.texts) { t.t += dt; t.x += t.vx * dt; t.y += t.vy * dt; t.vy *= Math.pow(0.1, dt); }
    this.texts = this.texts.filter((t) => t.t < t.life);
    for (const b of this.banners) b.t += dt;
    this.banners = this.banners.filter((b) => b.t < b.life);
  }

  shakeOffset(time) {
    const m = feelPref.shake, s = this.trauma * this.trauma * 18 * m; // (Options > Feel & audio: screen shake 0..150 %)
    return { x: (Math.sin(time * 57.3) + Math.sin(time * 31.7) * 0.5) * s + this.punchX * m, y: (Math.cos(time * 49.1) + Math.sin(time * 23.3) * 0.5) * s + this.punchY * m };
  }

  /** World-space layer under the characters: the finisher darkness and the eclipsed moon (so heroes/enemies stay lit). */
  drawUnder(ctx, view, time) {
    this.view = view;
    if (!this.cine.length) return;
    for (const c of this.cine) if (UNDER[c.kind]) UNDER[c.kind](this, ctx, c, time);
    let dk = null, dA = 0; // pass 2: overlapping ult darkenings are merged into one full-view fill (the darkest wins)
    for (const c of this.cine) {
      if (c.kind !== 'dark') continue;
      const k = Math.min(1, c.t / 0.18) * Math.min(1, (c.life - c.t) / 0.4);
      if (c.a * k > dA) { dA = c.a * k; dk = c; }
    }
    if (dk) { ctx.fillStyle = dk.col + dA.toFixed(3) + ')'; ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0); }
    for (const c of this.cine) if (c.kind === 'moon') this.drawMoon(ctx, c, time);
  }
  drawMoon(ctx, c, time) {
    const rise = Math.min(1, c.t / 0.45), e = 1 - Math.pow(1 - rise, 3), R = c.R * (0.6 + 0.4 * e);
    const x = c.x, y = c.y - c.R * 0.45 - 30 * (1 - e);
    const cracked = c.crackT >= 0, ck = cracked ? (c.t - c.crackT) / 0.55 : 0;
    ctx.save();
    ctx.globalAlpha = e * (cracked ? Math.max(0, 1 - ck * 1.4) : 1);
    const g = ctx.createRadialGradient(x, y, R * 0.8, x, y, R * 2.1); // corona
    g.addColorStop(0, 'rgba(255,230,168,.55)'); g.addColorStop(0.4, 'rgba(255,120,200,.18)'); g.addColorStop(1, 'rgba(255,120,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 2.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,168,.35)'; ctx.lineWidth = 3; // slow corona rays
    for (let i = 0; i < 12; i++) { const a = i * (TAU / 12) + time * 0.25, l = R * (1.25 + 0.2 * Math.sin(time * 3 + i)); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * 1.05, y + Math.sin(a) * R * 1.05); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
    circle(ctx, x, y, R, '#ffe6a8', 0);
    const off = R * (0.22 + 0.08 * Math.sin(time * 2)); // the shadow disc leaves a bright crescent rim
    circle(ctx, x + off, y - off * 0.5, R * 0.97, '#1a0826', 0);
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 3; ctx.stroke();
    if (cracked) { // cracks spread before it shatters
      ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, L = R * Math.min(1, ck * 3); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * L * 0.5, y + Math.sin(a + 0.2) * L * 0.5); ctx.lineTo(x + Math.cos(a - 0.15) * L, y + Math.sin(a - 0.1) * L); ctx.stroke(); }
      if (!c.shattered && ck > 0.18) { // pieces fly
        c.shattered = true;
        for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; this.add({ type: 'shard', x: x + Math.cos(a) * R * 0.5, y: y + Math.sin(a) * R * 0.5, vx: Math.cos(a) * rnd(260, 520), vy: Math.sin(a) * rnd(260, 520), life: rnd(0.5, 0.8), size: rnd(10, 18), color: i % 3 ? '#ffe6a8' : '#1a0826', ang: a, drag: 0.9, edge: '#fff6d8' }); }
      }
    }
    ctx.restore();
  }
  /** Shadow clone figure (Shadow Execution / finishers). */
  shadowFigure(ctx, x, y, ang, alpha, glow = 0) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
    ctx.fillStyle = 'rgba(20,10,35,.35)'; ctx.beginPath(); ctx.ellipse(0, 14, 13, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = glow > 0 ? '#4a2c6f' : '#2a1c3f'; ctx.strokeStyle = glow > 0 ? '#fff6d8' : '#b48cff'; ctx.lineWidth = 2 + glow * 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 14, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -17, 8, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff5fb0'; ctx.fillRect(-4, -19, 3, 2); ctx.fillRect(2, -19, 3, 2);
    ctx.rotate(ang); ctx.strokeStyle = '#e8dcff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(8, 2); ctx.lineTo(24, 2); ctx.stroke();
    ctx.restore();
  }
  /** Finisher overlays on top of the world: hanging crescents, the clone ring. */
  drawCine(ctx, time) {
    for (const h of this.hang) { // glowing crescents hanging in the air (layered strokes, no shadowBlur: cheap on phones)
      const k = Math.min(1, h.t / 0.12), pulse = 0.75 + 0.25 * Math.sin(time * 14 + h.x * 0.05);
      const a0 = h.ang + Math.PI / 2 - 0.9, a1 = h.ang + Math.PI / 2 + 0.9;
      ctx.globalAlpha = 0.35 * k * pulse; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, a0, a1); ctx.strokeStyle = '#ff5fb0'; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.stroke();
      ctx.globalAlpha = 0.95 * k; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, a0, a1); ctx.strokeStyle = '#ffe0f4'; ctx.lineWidth = 4; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const c of this.cine) if (CINE[c.kind]) { CINE[c.kind](this, ctx, c, time); ctx.globalAlpha = 1; }
    for (const c of this.cine) {
      if (c.kind !== 'moon' || c.crackT >= 0) continue;
      const beat = c.t > 0.5 && c.dashT < 0; // freeze-frame: the ring is complete, everyone holds
      for (let i = 0; i < c.ring.length; i++) {
        const q = c.ring[i], appear = Math.min(1, Math.max(0, (c.t - i * 0.035) / 0.2));
        if (appear <= 0) continue;
        let x = q.x, y = q.y;
        if (c.dashT >= 0) { const m = Math.min(1, (c.t - c.dashT) / 0.13); x += (c.x - x) * m * 0.85; y += (c.y - y) * m * 0.85; }
        const ang = Math.atan2(c.y - q.y, c.x - q.x);
        if (appear < 1) { ctx.globalAlpha = 1 - appear; circle(ctx, x, y, 26 * (1.4 - appear), 'rgba(90,50,140,.8)', 0); ctx.globalAlpha = 1; }
        this.shadowFigure(ctx, x, y, ang, 0.9 * appear, beat ? 0.6 + 0.4 * Math.sin(time * 30) : 0);
      }
      if (beat) { ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(c.x, c.y, 40 + (1 - Math.min(1, (c.t - 0.5) / 0.3)) * 120, 0, TAU); ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1; }
    }
  }

  /** Screen-space finisher moments (bars, kanji, title band): layer 0 sits under the HUD, layer 1 over it. */
  drawScreen(ctx, rend, layer) { drawMomentScreen(this, ctx, rend, layer); }
  /** Post-process on the rendered world (the Heaven-Splitting Palm cuts the frame in two). */
  postWorld(ctx, rend) { momentSplitPost(this, ctx, rend); }

  /** world-space particles (call inside camera transform) */
  draw(ctx, sim, localPlayer) {
    nsDrawPre(this, ctx);
    if (this.hang.length || this.cine.length) this.drawCine(ctx, this.time || 0);
    const lite = this.lite;
    const V = this.view; // (perf: the renderer passes its view rect; far off-screen particles are skipped)
    // pass 2: fill-area budget at the low quality levels (set by perf.js applyQuality as a fraction of the view area).
    // Big rings / blooms / smoke puffs are what software raster pays for, so once the budget is spent only small
    // particles are drawn this frame.
    const AB = V && this.areaFrac ? (V.x1 - V.x0) * (V.y1 - V.y0) * this.areaFrac : Infinity; let used = 0;
    for (const p of this.parts) {
      if (V && (p.x < V.x0 - 420 || p.x > V.x1 + 420 || p.y < V.y0 - 420 || p.y > V.y1 + 420)) continue;
      const k = p.t / p.life, inv = 1 - k;
      if (AB !== Infinity) {
        const ty = p.type; let a = 0;
        if (ty === 'ring' || ty === 'shock') a = TAU * (p.r0 + (p.r1 - p.r0) * k) * (p.width * (lite ? 1 : 3) + 2);
        else if (ty === 'puff' || ty === 'flash') { const r = p.size * (1.1 + k * 1.5); a = 3.2 * r * r; }
        else if (ty === 'ember' && !lite) { const r = p.size * 3.2; a = 3.2 * r * r; }
        if (a > 300) { if (used + a > AB) continue; used += a; }
      }
      switch (p.type) {
        case 'spark': { // glowing streak: additive halo + colour body + white-hot head (overhaul)
          const tx = p.x - p.vx * 0.035, ty = p.y - p.vy * 0.035;
          ctx.lineCap = 'round';
          if (!lite) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * inv; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tx, ty); ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 3 * inv + 1; ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tx, ty); ctx.strokeStyle = p.color; ctx.lineWidth = p.size * inv + 0.5; ctx.stroke();
          if (k < 0.5) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.012, p.y - p.vy * 0.012); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = p.size * 0.45 * inv + 0.4; ctx.stroke(); }
          break;
        }
        case 'dot': circle(ctx, p.x, p.y, p.size * inv, p.color, 0); break;
        case 'puff': // soft particle (overhaul): a gradient blob that swells and fades instead of a flat disc
          if (lite) { ctx.globalAlpha = inv * 0.85; circle(ctx, p.x, p.y, p.size * (0.6 + k * 0.9), p.color, 0); ctx.globalAlpha = 1; }
          else soft(ctx, p.x, p.y, p.size * (1.1 + k * 1.5), p.color, inv * 0.95);
          break;
        case 'chunk':
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, inv * 2);
          ctx.fillStyle = p.color; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2); ctx.strokeRect(-p.size, -p.size, p.size * 2, p.size * 2);
          ctx.restore(); break;
        case 'ring': { // eased shockwave ring: soft additive halo + colour band + thin white leading edge (overhaul)
          const R = Math.max(0.5, p.r0 + (p.r1 - p.r0) * ease.out(k));
          if (!lite) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = inv * 0.35; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.strokeStyle = p.color; ctx.lineWidth = p.width * 2.6 * inv + 2; ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
          ctx.globalAlpha = inv; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU);
          ctx.strokeStyle = p.color; ctx.lineWidth = p.width * inv + 1; ctx.stroke();
          if (!lite && p.width >= 5) { ctx.globalAlpha = inv * 0.8; ctx.beginPath(); ctx.arc(p.x, p.y, R + p.width * 0.35 * inv, 0, TAU); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, p.width * 0.18 * inv); ctx.stroke(); }
          ctx.globalAlpha = 1; break;
        }
        case 'flash': // impact flash: a soft hot bloom (overhaul) instead of a flat disc
          if (lite) { ctx.globalAlpha = inv * 0.9; circle(ctx, p.x, p.y, p.size * (0.5 + k), p.color, 0); ctx.globalAlpha = 1; }
          else { bloom(ctx, p.x, p.y, p.size * (0.8 + k * 1.0), p.color, inv * 0.55, 1); ctx.globalAlpha = inv * 0.4; circle(ctx, p.x, p.y, p.size * 0.22 * (1 - k), '#ffffff', 0); ctx.globalAlpha = 1; }
          break;
        case 'shock': { // a soft expanding shock band (overhaul): wide faint band + bright inner edge
          if (lite) break;
          const R = p.r0 + (p.r1 - p.r0) * ease.out(k);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = inv * 0.22; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.strokeStyle = p.color; ctx.lineWidth = p.width * 3 * inv + 2; ctx.stroke();
          ctx.globalAlpha = inv * 0.55; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, R - p.width * 0.6 * inv), 0, TAU); ctx.lineWidth = p.width * 0.8 * inv + 1; ctx.stroke();
          ctx.globalAlpha = inv * 0.9; ctx.beginPath(); ctx.arc(p.x, p.y, R + p.width * 0.5 * inv, 0, TAU); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; break;
        }
        case 'mote': { // a soft shaped particle (diamond / star / petal / feather / note / page / rune / snow)
          const s0 = p.size * (p.grow ? 0.4 + 0.6 * ease.back(Math.min(1, k * 3)) : 1) * (p.shrink ? inv : 1);
          if (p.vy0 !== undefined) p.vy += (p.g || 0) * 0.016;
          mote(ctx, p.x, p.y, p.shape, s0, (p.rot || 0) + (p.spin || 0) * p.t, p.color, Math.min(1, inv * 1.6) * (p.a ?? 1), !lite);
          break;
        }
        case 'ember': { // a flickering hot ember drifting up
          const fl = 0.7 + 0.3 * Math.sin(p.t * 40 + p.seed);
          if (!lite) bloom(ctx, p.x, p.y, p.size * 3.2, p.color, inv * fl * 0.8);
          ctx.globalAlpha = Math.min(1, inv * 1.5); circle(ctx, p.x, p.y, p.size * (0.6 + 0.4 * inv), p.hi || '#fff6d8', 0); ctx.globalAlpha = 1;
          break;
        }
        case 'star': ctx.globalAlpha = inv; star(ctx, p.x, p.y, p.size * (0.6 + k * 0.8), p.color, 0); ctx.globalAlpha = 1; break;
        case 'slash': {
          let x = p.x, y = p.y;
          if (p.follow && sim) { const pl = sim.players.get(p.follow); if (pl) { x = pl.x; y = pl.y; } }
          const sweep = p.arc * Math.min(1, k * 3);
          const a0 = p.dir > 0 ? p.ang - p.arc / 2 : p.ang + p.arc / 2;
          const a1 = p.dir > 0 ? a0 + sweep : a0 - sweep;
          ctx.globalAlpha = inv;
          ctx.beginPath(); ctx.arc(x, y, p.r * 0.95, a0, a1, p.dir < 0);
          ctx.strokeStyle = p.color; ctx.lineWidth = p.width * inv + 2; ctx.lineCap = 'round'; ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, p.r * 0.72, a0, a1, p.dir < 0);
          ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = p.width * 0.5 * inv + 1; ctx.stroke();
          ctx.globalAlpha = 1; break;
        }
        case 'shard':
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang); ctx.globalAlpha = inv;
          ctx.beginPath(); ctx.moveTo(p.size, 0); ctx.lineTo(-p.size * 0.6, -p.size * 0.4); ctx.lineTo(-p.size * 0.6, p.size * 0.4); ctx.closePath();
          ctx.fillStyle = p.color; ctx.fill(); ctx.strokeStyle = p.edge || '#6cc8ff'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); break;
        case 'plus': { // healing sparkle: a small green/gold cross
          const sz = p.size * (0.6 + inv * 0.4);
          ctx.globalAlpha = Math.min(1, inv * 1.6);
          ctx.fillStyle = INK; ctx.fillRect(p.x - sz - 1.5, p.y - sz * 0.35 - 1.5, sz * 2 + 3, sz * 0.7 + 3); ctx.fillRect(p.x - sz * 0.35 - 1.5, p.y - sz - 1.5, sz * 0.7 + 3, sz * 2 + 3);
          ctx.fillStyle = p.color; ctx.fillRect(p.x - sz, p.y - sz * 0.35, sz * 2, sz * 0.7); ctx.fillRect(p.x - sz * 0.35, p.y - sz, sz * 0.7, sz * 2);
          ctx.globalAlpha = 1; break;
        }
        case 'clone': { // Shadow Execution: a shadow double dashes in and stabs, then fades
          const m = Math.min(1, k / 0.35), x = p.x + (p.x2 - p.x) * m * 0.8, y = p.y + (p.y2 - p.y) * m * 0.8, a = Math.atan2(p.y2 - p.y, p.x2 - p.x);
          ctx.save(); ctx.globalAlpha = Math.min(1, inv * 1.8) * 0.85; ctx.translate(x, y);
          ctx.fillStyle = 'rgba(20,10,35,.35)'; ctx.beginPath(); ctx.ellipse(0, 14, 13, 5, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = p.color; ctx.strokeStyle = '#b48cff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(0, 0, 10, 14, 0, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, -17, 8, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ff5fb0'; ctx.fillRect(-4, -19, 3, 2); ctx.fillRect(2, -19, 3, 2); // eyes
          ctx.rotate(a); ctx.strokeStyle = '#e8dcff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(8, 2); ctx.lineTo(8 + 18 * (m >= 1 ? 1 : 0.5), 2); ctx.stroke();
          ctx.restore(); break;
        }
        case 'ghost': { // a shadow clone splitting off (Ten Thousand Cuts)
          this.shadowFigure(ctx, p.x, p.y, p.ang, Math.min(1, k * 4) * inv * 0.9, inv > 0.6 ? 1 : 0);
          break;
        }
        case 'dashclone': { // a clone dashing between cuts, then fading
          const m = Math.min(1, k / 0.4), x = p.x + (p.x2 - p.x) * m, y = p.y + (p.y2 - p.y) * m;
          this.shadowFigure(ctx, x, y, Math.atan2(p.y2 - p.y, p.x2 - p.x), Math.min(1, inv * 1.8) * 0.85);
          break;
        }
        case 'arc': { // a curved crescent trail converging on the target
          const mx = (p.x + p.x2) / 2 - (p.y2 - p.y) * p.bend, my = (p.y + p.y2) / 2 + (p.x2 - p.x) * p.bend;
          const m = Math.min(1, k * 2.2);
          ctx.globalAlpha = inv; ctx.beginPath(); ctx.moveTo(p.x, p.y);
          ctx.quadraticCurveTo(p.x + (mx - p.x) * m, p.y + (my - p.y) * m, p.x + (p.x2 - p.x) * m, p.y + (p.y2 - p.y) * m);
          ctx.strokeStyle = p.color; ctx.lineWidth = 12 * inv + 2; ctx.lineCap = 'round'; ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4 * inv + 1; ctx.stroke(); ctx.globalAlpha = 1;
          break;
        }
        case 'trail':
          ctx.globalAlpha = inv; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2, p.y2); ctx.strokeStyle = p.color; ctx.lineWidth = 14 * inv; ctx.lineCap = 'round'; ctx.stroke(); ctx.globalAlpha = 1; break;
        case 'beam': {
          ctx.globalAlpha = Math.min(1, inv * 1.5) * 0.55;
          const g = ctx.createLinearGradient(p.x, p.y - 160, p.x, p.y);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, p.color);
          ctx.fillStyle = g; ctx.fillRect(p.x - p.size / 2, p.y - 160, p.size, 160);
          ctx.globalAlpha = 1; break;
        }
        case 'arrowfall':
          ctx.globalAlpha = inv; ctx.beginPath(); ctx.moveTo(p.x - 10 * inv, p.y - 60 * inv); ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
          circle(ctx, p.x, p.y, 3, 'rgba(90,70,50,.6)', 0); break;
        case 'wslash': { // Warrior weapon trail: additive glow + colour body + white-hot core + a bright leading head
          let x = p.x, y = p.y;
          if (p.follow && sim) { const pl = sim.players.get(p.follow); if (pl) { x = pl.x; y = pl.y; } }
          const sweep = p.arc * Math.min(1, k * (p.speed || 4)), tail = p.arc * Math.max(0, k * 1.6 - 0.55);
          const a0 = p.dir > 0 ? p.ang - p.arc / 2 : p.ang + p.arc / 2, ccw = p.dir < 0;
          const s0 = p.dir > 0 ? a0 + Math.min(tail, sweep) : a0 - Math.min(tail, sweep), s1 = p.dir > 0 ? a0 + sweep : a0 - sweep;
          ctx.lineCap = 'round';
          if (!p.lite) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 * inv; ctx.beginPath(); ctx.arc(x, y, p.r * 0.93, s0, s1, ccw); ctx.strokeStyle = p.color; ctx.lineWidth = p.width * 2.4; ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
          ctx.globalAlpha = Math.min(1, inv * 1.4);
          ctx.beginPath(); ctx.arc(x, y, p.r * 0.95, s0, s1, ccw); ctx.strokeStyle = p.color; ctx.lineWidth = p.width * inv + 2; ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, p.r * 0.97, s0, s1, ccw); ctx.strokeStyle = p.hi || '#fff'; ctx.lineWidth = p.width * 0.32 * inv + 1; ctx.stroke();
          ctx.globalAlpha = 0.55 * inv; ctx.beginPath(); ctx.arc(x, y, p.r * 0.74, s0, s1, ccw); ctx.strokeStyle = p.hi || '#fff'; ctx.lineWidth = p.width * 0.4 * inv + 1; ctx.stroke();
          if (k < 0.35) { ctx.globalAlpha = 1; circle(ctx, x + Math.cos(s1) * p.r * 0.95, y + Math.sin(s1) * p.r * 0.95, p.width * 0.45 + 2, '#ffffff', 0); }
          ctx.globalAlpha = 1; break;
        }
        case 'glow': { // additive light bloom (overhaul: a cached sprite, eased swell, smooth fade)
          if (p.lite || lite) break;
          const r = p.size * (0.6 + 0.6 * ease.out(Math.min(1, k * 3)));
          bloom(ctx, p.x, p.y, r, p.color, (1 - ease.in(k)) * (p.a ?? 0.8));
          break;
        }
        case 'rays': { // radial light rays bursting out of an impact
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = inv; ctx.strokeStyle = p.color; ctx.lineCap = 'round';
          const e = 1 - Math.pow(1 - k, 3);
          for (let i = 0; i < p.n; i++) { const a = p.seed + i * (TAU / p.n) + ((i * 7) % 3) * 0.13, L = p.r * (0.55 + ((i * 5) % 4) * 0.15); ctx.lineWidth = (p.w || 6) * inv + 1; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * L * 0.25 * (0.4 + e), p.y + Math.sin(a) * L * 0.25 * (0.4 + e)); ctx.lineTo(p.x + Math.cos(a) * L * (0.35 + e * 0.65), p.y + Math.sin(a) * L * (0.35 + e * 0.65)); ctx.stroke(); }
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; break;
        }
        case 'bolt': { // lightning (Thunder Hurl, Challenge): jittered zigzag, redrawn a few times so it crackles
          const pts = p.pts; if (!pts) break;
          const jit = (i) => (i === 0 || i === pts.length - 1 ? 0 : Math.sin(p.t * 60 + i * 1.7) * (p.jit || 6));
          const path = () => { ctx.beginPath(); for (let i = 0; i < pts.length; i++) { const q = pts[i]; if (i) ctx.lineTo(q[0] + jit(i), q[1] - jit(i)); else ctx.moveTo(q[0], q[1]); } };
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          if (!p.lite) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * inv; path(); ctx.strokeStyle = p.color; ctx.lineWidth = (p.width || 8) * 2.2; ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
          ctx.globalAlpha = inv; path(); ctx.strokeStyle = p.color; ctx.lineWidth = (p.width || 8) * inv + 1.5; ctx.stroke();
          path(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = (p.width || 8) * 0.35 * inv + 1; ctx.stroke();
          ctx.globalAlpha = 1; break;
        }
        case 'pillar': { // a column of light from the sky (slams, finishers)
          const grow = Math.min(1, k * 5), w = p.size * (1 - k * 0.6) * grow, H = p.h || 420;
          const g = ctx.createLinearGradient(p.x, p.y - H, p.x, p.y);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, p.color); g.addColorStop(1, '#ffffff');
          ctx.globalCompositeOperation = p.lite ? 'source-over' : 'lighter'; ctx.globalAlpha = inv * (p.lite ? 0.5 : 0.85); ctx.fillStyle = g;
          ctx.fillRect(p.x - w / 2, p.y - H, w, H); ctx.globalAlpha = inv; ctx.fillRect(p.x - w * 0.15, p.y - H, w * 0.3, H);
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; break;
        }
        case 'wghost': { // Warrior afterimage: a tinted silhouette with its weapon, fading
          ctx.save(); ctx.translate(p.x, p.y); ctx.globalCompositeOperation = p.lite ? 'source-over' : 'lighter'; ctx.globalAlpha = inv * (p.a ?? 0.55);
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, 17, 17, 0, 0, TAU); ctx.fill();
          ctx.rotate(p.ang); ctx.strokeStyle = p.hi || '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(10 + (p.len || 40), 10 + (p.len || 40) * 0.2); ctx.stroke();
          if (p.twin) { ctx.beginPath(); ctx.moveTo(10, -10); ctx.lineTo(10 + (p.len || 40), -10 - (p.len || 40) * 0.2); ctx.stroke(); }
          ctx.restore(); break;
        }
        case 'tri': { // Trinity glyph: a spinning triangle with the three weapon colours at its corners
          const R = p.r * (0.5 + 0.5 * (1 - Math.pow(1 - Math.min(1, k * 2.5), 3))), rot = p.seed + k * 3;
          ctx.globalAlpha = inv; ctx.lineWidth = 5 * inv + 2; ctx.strokeStyle = '#fff2b0'; ctx.beginPath();
          for (let i = 0; i <= 3; i++) { const a = rot + i * TAU / 3; if (i) ctx.lineTo(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); else ctx.moveTo(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
          ctx.stroke(); for (let i = 0; i < 3; i++) { const a = rot + i * TAU / 3; circle(ctx, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, 9 * inv + 3, p.cols[i], 2.5); }
          ctx.globalAlpha = 1; break;
        }
        case 'spline': case 'spcross': SPEC_PARTS[p.type](ctx, p, k, inv); break; // Special cuts / beams / X slashes
        case 'mstreak': case 'mfist': case 'mseal': MONK_PARTS[p.type](ctx, p, k, inv); break; // Monk speed lines / spirit fists / seals
        case 'ink': case 'petal': SAM_PARTS[p.type](ctx, p, k, inv); break; // Samurai brush strokes / cherry petals
        case 'crack': {
          ctx.globalAlpha = Math.min(1, inv * 2) * 0.6;
          ctx.fillStyle = 'rgba(50,35,30,.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.35, 0, TAU); ctx.fill();
          ctx.strokeStyle = p.col || (p.glow ? '#b8501f' : 'rgba(60,40,30,.7)'); ctx.lineWidth = p.col ? 4 : 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          if (p.col && !p.lite) { ctx.globalAlpha = Math.min(1, inv * 2) * 0.9; ctx.globalCompositeOperation = 'lighter'; }
          for (let i = 0; i < (p.n || 6); i++) {
            const a = p.seed + i * (TAU / (p.n || 6)), L = p.r * (0.45 + ((i * 7) % 5) * 0.08);
            ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * p.r * 0.3, p.y + Math.sin(a) * p.r * 0.3);
            ctx.lineTo(p.x + Math.cos(a + 0.18) * L * 0.75, p.y + Math.sin(a + 0.18) * L * 0.75);
            ctx.lineTo(p.x + Math.cos(a - 0.05) * L, p.y + Math.sin(a - 0.05) * L); ctx.stroke();
          }
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; break;
        }
      }
    }
    // damage numbers (perf: each distinct number/label is rasterised once into a small cached canvas and blitted;
    // strokeText + fillText per number per frame was most of the fx cost in big fights)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const useCache = TXT_OK(ctx), ps = useCache ? Math.min(3, Math.max(0.5, Math.abs(ctx.getTransform().a) || 1)) : 1;
    for (const t of this.texts) {
      if (!t.str) continue;
      const k = t.t / t.life, tt = t.t;
      // pop-in: a fast grow to the pop size, then a damped spring settle (a hair under 1, then 1); shrink while fading out
      let pop = tt < 0.045 ? 0.6 + (t.pop - 0.6) * (tt / 0.045) : 1 + (t.pop - 1) * Math.exp(-(tt - 0.045) * 26) * Math.cos((tt - 0.045) * 34);
      if (k > 0.72) pop *= 1 - (k - 0.72) * 0.6;
      const a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.globalAlpha = a;
      const c = useCache && textSprite(t.str, t.size, t.color, t.stroke, ps);
      if (c && t.rot) { const w = c.lw * pop, h = c.lh * pop, r = t.rot * Math.max(0, 1 - tt * 3); ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(r); ctx.drawImage(c, -w / 2, -h / 2, w, h); ctx.restore(); continue; }
      if (c) { const w = c.lw * pop, h = c.lh * pop; ctx.drawImage(c, t.x - w / 2, t.y - h / 2, w, h); continue; }
      ctx.font = `${Math.round(t.size * pop)}px ${FONT}`;
      ctx.lineWidth = Math.max(4, t.size * 0.22);
      ctx.strokeStyle = t.stroke; ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    nsDrawPost(this, ctx);
  }
}
export { FONT };

// ---- cached damage-number text sprites (perf pass) ----
const TXT = new Map();
let TXT_PS = 0, TXT_M = null;
const TXT_OK = (ctx) => typeof document !== 'undefined' && !!ctx.getTransform && !!ctx.drawImage && (!document.fonts || document.fonts.status === 'loaded');
function textSprite(str, size, color, stroke, ps) {
  const q = Math.round(ps * 4) / 4;
  if (q !== TXT_PS) { TXT.clear(); TXT_PS = q; }
  const key = str + '|' + size + '|' + color + '|' + stroke;
  let c = TXT.get(key);
  if (c) { TXT.delete(key); TXT.set(key, c); return c; } // (LRU touch)
  const lw = Math.max(4, size * 0.22), sc = q * 1.25; // a little supersampled so the brief pop-in scale stays crisp
  const m = TXT_M || (TXT_M = document.createElement('canvas').getContext('2d')); m.font = `${size}px ${FONT}`; // (perf pass 3: one shared measuring context, not a new canvas per new number)
  const w = Math.ceil(m.measureText(String(str)).width + lw * 2 + 4), h = Math.ceil(size * 1.3 + lw * 2);
  c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * sc)); c.height = Math.max(1, Math.ceil(h * sc));
  const g = c.getContext('2d'); g.scale(sc, sc);
  g.font = `${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = lw; g.strokeStyle = stroke; g.strokeText(str, w / 2, h / 2);
  g.fillStyle = color; g.fillText(str, w / 2, h / 2);
  c.lw = w; c.lh = h;
  TXT.set(key, c);
  if (TXT.size > 400) TXT.delete(TXT.keys().next().value);
  return c;
}
