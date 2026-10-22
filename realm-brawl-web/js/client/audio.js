import { raidSound } from './raidfx.js';
import { astraelSound } from './astraelfx.js';
import { trialSound } from './trialfx.js';
import { gearSound } from './gearfx.js';
import { classSound } from './fxclass.js';
import { wmSound } from './fxwar.js';
import { samSound } from './fxsam.js';
import { monkSound } from './fxmonk.js';
import { drgSound } from './fxdragoon.js';
import { arcSound } from './fxarcana.js';
import { specSound } from './fxspec.js';
import { classVoice } from './sfxclass.js';
import { Music } from './music.js';
// Volume prefs (Options > Feel & audio): separate music and SFX sliders, 0..1, saved in this browser.
const hasLS = typeof localStorage !== 'undefined';
const VKEY = 'rb.audio';
const vload = () => { try { return hasLS ? JSON.parse(localStorage.getItem(VKEY) || '{}') : {}; } catch { return {}; } };
const v0 = vload(), c01 = (v, d) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
export const audioPref = { music: c01(v0.music, 0.55), sfx: c01(v0.sfx, 0.8), save() { try { if (hasLS) localStorage.setItem(VKEY, JSON.stringify({ music: this.music, sfx: this.sfx })); } catch { /* private mode */ } } };
const SFX_BASE = 0.35 / 0.8; // (the old fixed master gain was 0.35: the default 80 % slider keeps that loudness)
// Tiny procedural WebAudio SFX (no assets) + the procedural zone music (music.js). Lazily created on first user gesture.
export class Audio {
  constructor() { this.ctx = null; this._muted = false; this.last = {}; this.master = null; this.music = null; }
  get muted() { return this._muted; }
  set muted(v) { this._muted = !!v; this.applyVolumes(); }
  /** push the slider values (and mute) to the buses */
  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, m = this._muted ? 0 : 1;
    this.master.gain.setTargetAtTime(audioPref.sfx * SFX_BASE * m, t, 0.03);
    if (this.music) this.music.setVolume(audioPref.music * m);
  }
  setVolume(kind, v) { audioPref[kind] = Math.max(0, Math.min(1, +v || 0)); audioPref.save(); this.applyVolumes(); }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      // SFX bus -> a gentle limiter (big fights stack dozens of voices) -> out; the music has its own bus (music.js)
      this.limiter = this.ctx.createDynamicsCompressor(); this.limiter.threshold.value = -10; this.limiter.knee.value = 8; this.limiter.ratio.value = 6; this.limiter.attack.value = 0.003; this.limiter.release.value = 0.15;
      this.limiter.connect(this.ctx.destination);
      this.master = this.ctx.createGain(); this.master.gain.value = audioPref.sfx * SFX_BASE * (this._muted ? 0 : 1); this.master.connect(this.limiter);
      this.music = new Music(this.ctx); this.music.setVolume(audioPref.music * (this._muted ? 0 : 1));
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
  }
  tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  hiss(f0, f1, dur, vol = 0.3, q = 1, type = 'bandpass', delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.02);
  }
  play(name) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 35) return;
    this.last[name] = now;
    switch (name) {
      // Part B3: the Shadow Duel cinematics
      case 'cineRumble': this.hiss(320, 50, 2.4, 0.45, 0.7, 'lowpass'); this.tone('sine', 52, 38, 2.4, 0.45); break;
      case 'cineChoir': for (const [f, d] of [[392, 0], [494, 0.12], [587, 0.24], [784, 0.4]]) this.tone('sine', f, f * 1.003, 2.2, 0.09, d); this.hiss(6000, 9000, 1.8, 0.05, 2, 'highpass'); break;
      case 'cineWhoosh': this.hiss(300, 5000, 0.9, 0.32, 1.1); break;
      case 'cineShatter': this.hiss(9000, 2400, 0.7, 0.5, 1.4, 'highpass'); for (let i = 0; i < 6; i++) this.tone('triangle', 2200 + i * 530, 1400 + i * 300, 0.18, 0.06, i * 0.035); this.tone('sine', 140, 40, 0.5, 0.4); break;
      case 'cineLand': this.hiss(800, 40, 0.8, 0.7, 0.7, 'lowpass'); this.tone('sine', 80, 26, 0.8, 0.8); this.tone('triangle', 1600, 3200, 0.5, 0.05, 0.05); break;
      case 'cineSting': this.tone('sawtooth', 110, 52, 1.4, 0.22); this.tone('square', 233, 117, 1.1, 0.1); this.tone('sine', 55, 41, 1.5, 0.5); this.hiss(2400, 200, 0.6, 0.35, 0.9); break;
      case 'cineCrack': this.hiss(5200, 700, 0.35, 0.5, 2); this.tone('square', 90, 40, 0.3, 0.25); break;
      case 'cineFlash': this.hiss(8000, 500, 1.2, 0.5, 0.6); this.tone('sine', 1320, 660, 1.2, 0.12); this.tone('sine', 66, 30, 1.2, 0.6); break;
      case 'cineAscend': for (const [f, d] of [[262, 0], [330, 0.15], [392, 0.3], [523, 0.45], [659, 0.6], [784, 0.75]]) this.tone('sine', f, f, 2.4 - d, 0.1, d); this.tone('triangle', 1046, 2093, 1.6, 0.05, 0.8); break;
      case 'cineDark': this.tone('sine', 98, 49, 2.6, 0.35); this.tone('sawtooth', 147, 73, 2.2, 0.08); this.hiss(600, 80, 2.6, 0.25, 0.7, 'lowpass'); break;
      case 'swing': this.hiss(2400, 500, 0.12, 0.25, 1.2); break;
      case 'heavy': this.hiss(1800, 250, 0.2, 0.35, 1); this.tone('sine', 180, 60, 0.18, 0.2); break;
      case 'hit': this.tone('sine', 190, 55, 0.1, 0.5); this.hiss(3000, 800, 0.05, 0.25, 0.8); break;
      case 'crit': this.tone('sine', 220, 50, 0.14, 0.6); this.tone('square', 1200, 1800, 0.07, 0.07); this.hiss(4000, 1000, 0.07, 0.3); break;
      case 'shoot': this.tone('triangle', 900, 300, 0.08, 0.18); this.hiss(5000, 2000, 0.05, 0.1); break;
      case 'bolt': this.tone('sine', 700, 1300, 0.1, 0.15); this.tone('triangle', 350, 200, 0.12, 0.1); break;
      case 'boom': this.hiss(900, 60, 0.5, 0.6, 0.7, 'lowpass'); this.tone('sine', 110, 30, 0.45, 0.6); break;
      case 'slam': this.hiss(700, 50, 0.4, 0.6, 0.7, 'lowpass'); this.tone('sine', 90, 30, 0.35, 0.7); break;
      case 'ice': this.tone('sine', 1800, 2600, 0.25, 0.12); this.hiss(8000, 3000, 0.3, 0.2, 2, 'highpass'); break;
      case 'blink': this.tone('sine', 400, 1600, 0.15, 0.2); break;
      case 'dodge': this.hiss(1200, 3000, 0.16, 0.2, 0.8); break;
      case 'hurt': this.tone('square', 220, 70, 0.16, 0.14); this.tone('sine', 120, 50, 0.15, 0.3); break;
      case 'evade': this.tone('sine', 900, 1400, 0.08, 0.1); break;
      case 'enemyShot': this.tone('square', 520, 260, 0.06, 0.035); break;
      case 'death': this.hiss(1500, 200, 0.25, 0.25); this.tone('triangle', 400, 90, 0.2, 0.15); break;
      case 'loot': this.tone('triangle', 660, 660, 0.08, 0.15); this.tone('triangle', 990, 990, 0.12, 0.15, 0.08); break;
      case 'legendary': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone('triangle', f, f, 0.2, 0.18, i * 0.07)); break;
      case 'pickup': this.tone('sine', 880, 1320, 0.08, 0.18); this.tone('triangle', 1760, 1760, 0.05, 0.06, 0.05); break;
      case 'coin': [1318, 1760, 2093].forEach((f, i) => this.tone('square', f, f, 0.05, 0.05, i * 0.045)); this.tone('sine', 2637, 2637, 0.12, 0.06, 0.13); break; // (village shops)
      case 'coinpick': { const f = 1900 + Math.random() * 500; this.tone('square', f, f * 1.05, 0.035, 0.035); this.tone('sine', f * 1.5, f * 1.5, 0.07, 0.04, 0.03); break; } // (loot vacuum: coins)
      case 'orbpick': this.tone('sine', 520 + Math.random() * 80, 1040, 0.09, 0.09); this.tone('triangle', 1560, 1760, 0.06, 0.035, 0.04); break; // health / resource orbs
      case 'matpick': { const f = 880 + Math.random() * 120; this.tone('triangle', f, f * 1.5, 0.07, 0.07); this.tone('sine', f * 2, f * 2.2, 0.05, 0.04, 0.035); break; } // (horde pass 2: a material crystal clinks in)
      case 'gearpick': [784, 1175, 1568].forEach((f, i) => this.tone('triangle', f, f, 0.1, 0.12, i * 0.05)); this.hiss(7000, 9000, 0.18, 0.06, 1, 'highpass', 0.05); break; // gear vacuumed into the bag
      case 'gulp': this.tone('sine', 300, 520, 0.09, 0.22); this.tone('sine', 340, 600, 0.09, 0.2, 0.11); this.tone('triangle', 900, 1500, 0.2, 0.08, 0.22); break;
      case 'chestOpen': this.tone('sawtooth', 140, 90, 0.18, 0.06); this.tone('triangle', 660, 990, 0.15, 0.1, 0.12); break;
      case 'click': this.tone('triangle', 1250, 900, 0.035, 0.12); this.hiss(6000, 3000, 0.02, 0.06, 1.2); break;
      case 'hover': this.tone('sine', 1900, 1900, 0.02, 0.025); break;
      case 'back': this.tone('triangle', 900, 600, 0.05, 0.1); break;
      case 'levelup': [523, 659, 784, 1046].forEach((f, i) => this.tone('square', f, f, 0.18, 0.08, i * 0.09)); [1046, 1318, 1568].forEach((f) => this.tone('triangle', f, f * 1.002, 0.7, 0.07, 0.4)); this.hiss(5000, 9000, 0.6, 0.08, 1, 'highpass', 0.38); break;
      case 'chain': this.tone('sawtooth', 440, 880, 0.18, 0.08); this.tone('triangle', 660, 1320, 0.25, 0.15, 0.05); break;
      case 'counter': this.tone('square', 1500, 700, 0.12, 0.1); this.hiss(6000, 2000, 0.15, 0.3); break;
      case 'nores': this.tone('square', 160, 120, 0.08, 0.06); break;
      case 'roar': this.hiss(400, 80, 1.0, 0.6, 0.5, 'lowpass'); this.tone('sawtooth', 90, 45, 0.9, 0.25); break;
      case 'playerDeath': [392, 330, 262, 196].forEach((f, i) => this.tone('triangle', f, f * 0.9, 0.3, 0.18, i * 0.15)); break;
      // Eclipse finishers
      case 'routeBreak': this.tone('triangle', 330, 220, 0.14, 0.08); break;
      case 'split': this.hiss(300, 2600, 0.5, 0.35, 0.7); this.tone('sine', 110, 55, 0.6, 0.35); [659, 880, 1175].forEach((f, i) => this.tone('triangle', f, f, 0.25, 0.08, 0.05 + i * 0.06)); break;
      case 'cutSnap': this.hiss(5200, 1400, 0.07, 0.22, 1.4); this.tone('square', 1500 + Math.random() * 500, 900, 0.04, 0.03); break;
      case 'detonate': this.hiss(1200, 40, 1.1, 0.8, 0.6, 'lowpass'); this.tone('sine', 140, 28, 0.9, 0.7); this.tone('sawtooth', 70, 35, 0.7, 0.15); [1760, 1318, 1046, 784].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.3, 0.06, 0.08 + i * 0.05)); this.hiss(7000, 2500, 0.6, 0.25, 1, 'highpass', 0.05); break;
      case 'moonRise': this.tone('sawtooth', 98, 49, 1.2, 0.12); this.tone('sine', 196, 147, 1.0, 0.18); [523, 622, 784].forEach((f, i) => this.tone('triangle', f, f, 0.5, 0.07, 0.15 + i * 0.12)); this.hiss(400, 1200, 1.0, 0.2, 0.5); break;
      case 'dashIn': this.hiss(800, 6000, 0.14, 0.45, 0.8); this.tone('sine', 300, 1200, 0.12, 0.15); break;
      // horde AoE signatures (2026-10-08): Sylva's spirit hawk + volley, Mirelle's page storm, Brakka's warcry quake
      case 'hawk': this.hiss(500, 3200, 0.34, 0.22, 0.8); this.tone('sawtooth', 2300, 1500, 0.2, 0.035, 0.03); this.tone('sine', 1900, 2700, 0.12, 0.06, 0.04); this.tone('sine', 2700, 1700, 0.16, 0.05, 0.16); break;
      case 'volley': for (let i = 0; i < 4; i++) this.tone('triangle', 1500 + i * 170, 650, 0.09, 0.045, i * 0.025); this.hiss(6500, 2400, 0.13, 0.1, 1.5); break;
      case 'pages': for (let i = 0; i < 5; i++) this.hiss(5200 + i * 300, 3200, 0.05, 0.09, 2, 'highpass', i * 0.035); this.tone('sine', 1046, 1568, 0.24, 0.05, 0.04); this.tone('triangle', 1568, 2093, 0.2, 0.03, 0.12); break;
      case 'warcry': this.hiss(520, 110, 0.42, 0.42, 0.6, 'lowpass'); this.tone('sawtooth', 150, 72, 0.32, 0.1); this.tone('sine', 88, 30, 0.38, 0.55, 0.03); this.hiss(2400, 500, 0.18, 0.15, 1, 'bandpass', 0.02); break;
      case 'crescentHit': this.hiss(1500, 30, 1.3, 0.9, 0.5, 'lowpass'); this.tone('sine', 90, 22, 1.1, 0.9); this.tone('square', 180, 45, 0.35, 0.18); this.hiss(9000, 3000, 0.9, 0.35, 1, 'highpass', 0.12); [1046, 988, 784, 523].forEach((f, i) => this.tone('triangle', f, f * 0.9, 0.35, 0.08, 0.2 + i * 0.07)); break;
    }
  }
  handle(ev, localPid, pos) {
    const me = ev.pid === localPid;
    // co-op: boss / world-mechanic sounds only within earshot of the local hero (like the banners: ~1800 units)
    if (pos && ev.x != null && !me && (WORLD_EV.has(ev.type) || ev.boss || (ev.type === 'areaHit' && ev.team === 'enemy')) && (ev.x - pos.x) ** 2 + (ev.y - pos.y) ** 2 > EARSHOT * EARSHOT) return;
    if (ev.type === 'hub') { if (this.ctx && !this.muted && (ev.ph !== 'deny' || me)) { if (ev.ph === 'deny') this.tone('square', 220, 160, 0.15, 0.12); else [392, 523, 659].forEach((f, i) => this.tone('triangle', f, f, 0.25, 0.16, i * 0.1)); } return; }
    if (ev.type === 'gear') { if (this.ctx && !this.muted) gearSound(this, ev, me); return; }
    if (ev.type === 'savage' && ev.ph === 'vuln') { if (this.ctx && !this.muted && me) { this.tone('square', 220, 150, 0.22, 0.14); this.tone('sawtooth', ev.n >= 2 ? 90 : 330, ev.n >= 2 ? 45 : 220, ev.n >= 2 ? 0.6 : 0.3, 0.12, 0.08); } return; } // (Part 1S: a Vuln stack - a cracked-shield buzz; the KO stack drops low)
    if (ev.type === 'trial') { if (this.ctx && !this.muted) trialSound(this, ev, me); return; }
    if (ev.type === 'astrael') { if (this.ctx && !this.muted) astraelSound(this, ev, me); return; }
    if (ev.type === 'raid') { if (this.ctx && !this.muted) raidSound(this, ev, me); return; }
    if (ev.type === 'ops') { if (this.ctx && !this.muted) opsSound(this, ev); return; } // mission dungeons
    if (ev.type === 'dunes' || ev.type === 'tomb' || ev.type === 'frost' || ev.type === 'crypt' || ev.type === 'glow' || ev.type === 'ember' || ev.type === 'forge' || ev.type === 'rift' || ev.type === 'unlock') { if (this.ctx && !this.muted) worldSound(this, ev, me); return; }
    if (ev.type === 'wm' || ev.type === 'wmx') { wmSound(this, ev, me); return; } // Warrior Weapon Master
    if (ev.type === 'spx') { if (ev.cls === 'summoner' || ev.cls === 'bard') arcSound(this, ev, me); specSound(this, ev, me); return; } // Specials
    if (ev.type === 'drg' || ev.type === 'drgx') { drgSound(this, ev, me); return; } // Dragoon
    if (ev.type === 'arc' || ev.type === 'arcx') { arcSound(this, ev, me); return; } // Grimoire Summoner + Bard
    if (ev.type === 'monk' || ev.type === 'monkx') { monkSound(this, ev, me); return; } // Monk
    if (ev.type === 'sam' || ev.type === 'samx') { samSound(this, ev, me); return; } // Samurai
    if (this.ctx && !this.muted) classVoice(this, ev, me); // per-class cast / ult stingers and basic-attack tints (sfxclass.js)
    if (classSound(this, ev, me)) return; // class states / chains / finishers
    switch (ev.type) {
      case 'swing': this.play(ev.heavy ? 'heavy' : 'swing'); break;
      case 'shoot': this.play(ev.cls === 'mage' ? 'bolt' : 'shoot'); break;
      case 'hit': this.play(ev.crit ? 'crit' : 'hit'); break;
      case 'slam': this.play('slam'); break;
      case 'areaHit': if (ev.kind === 'meteor' || ev.kind === 'blast') this.play('boom'); else if (ev.team === 'enemy' && (ev.kind === 'slam' || ev.kind === 'stomp' || ev.kind === 'meteorE' || ev.kind === 'rock')) this.play('slam'); break;
      case 'explosion': this.play('boom'); break;
      case 'nova': this.play('ice'); break;
      case 'blink': case 'shadowStep': this.play('blink'); break;
      case 'shadowPierce': this.play('heavy'); break;
      case 'blossom': case 'shadowPierceKill': case 'markPop': this.play('counter'); break;
      case 'swarm': if (ev.ph === 'mark' || ev.ph === 'start' || ev.ph === 'win') this.play(ev.ph === 'win' ? 'levelup' : 'heavy'); break; // Swarm event callouts
      case 'hEcho': { // horde AoE: chain bursts (throttled); the 2026-10-08 signature shapes also voice their regular procs, sparsely
        if (!me || ev.src === 'pulse') break;
        const now = performance.now(), SIG = { volley: 'volley', pages: 'pages', warcry: 'warcry' }, sig = SIG[ev.k];
        if (ev.hawk && now - (this._hawkT || 0) > 520) { this._hawkT = now; this.play('hawk'); }
        if (ev.src === 'chain') { if (now - (this._hEchoT || 0) > 160) { this._hEchoT = now; this.play(sig || (ev.k === 'shock' || ev.k === 'fissure' || ev.k === 'starfall' ? 'slam' : ev.k === 'arc' ? 'bolt' : 'heavy')); } }
        else if (sig && now - (this._sigT || 0) > (ev.k === 'volley' ? 230 : 320)) { this._sigT = now; this.play(sig); }
        break;
      }
      case 'crash': case 'bash': this.play('slam'); break;
      case 'cloneStab': this.play('hit'); break;
      case 'mark': break;
      case 'dodge': if (me) this.play('dodge'); break;
      case 'gapClose': if (me) this.play('dodge'); break;
      case 'hurt': if (me) this.play('hurt'); break;
      case 'evade': this.play('evade'); break;
      case 'death': this.play('death'); break;
      case 'loot': this.play(ev.rarity === 3 ? 'legendary' : 'loot'); break;
      case 'pickup': this.play('pickup'); break;
      case 'levelup': this.play('levelup'); break;
      case 'chain': this.play('chain'); break;
      case 'counter': this.play('counter'); break;
      case 'nores': if (me) this.play('nores'); break;
      case 'bossPhase': this.play('roar'); break;
      case 'playerDeath': if (me) this.play('playerDeath'); break;
      case 'spin': this.play('swing'); break;
      case 'eclipseBurst': this.play('boom'); break;
      case 'eclipseShade': if (me) this.play('evade'); break;
      case 'routeStep': if (me && this.ctx && !this.muted) { const f = 440 * Math.pow(2, ev.step * 3 / 12); this.tone('triangle', f, f * 1.5, 0.16, 0.12); if (ev.step >= ev.of) this.tone('sine', f * 2, f * 2, 0.3, 0.1, 0.08); } break;
      case 'routeBreak': if (me && ev.step > 0) this.play('routeBreak'); break;
      case 'ttcStart': this.play('split'); break;
      case 'ttcCut': this.play('cutSnap'); break;
      case 'ttcDetonate': this.play('detonate'); break;
      case 'crescentStart': this.play('moonRise'); break;
      case 'crescentDash': this.play('dashIn'); break;
      case 'crescentImpact': this.play('crescentHit'); break;
    }
  }
}

// Sunscorch Dunes / the Tomb: sand, sun and a few big stings, built from the same tone + hiss voices
export const EARSHOT = 1800;
const WORLD_EV = new Set(['dunes', 'tomb', 'frost', 'crypt', 'ember', 'forge', 'rift', 'raid', 'astrael', 'trial', 'gear', 'unw']);
function worldSound(a, ev, me) {
  if (ev.type === 'unlock') { if (me && ev.fresh) { a.tone('triangle', 520, 780, 0.25, 0.22); a.tone('triangle', 780, 1170, 0.4, 0.2, 0.18); a.tone('sine', 1170, 1560, 0.6, 0.12, 0.36); } return; }
  switch (ev.ph) {
    case 'erupt': a.hiss(900, 120, 0.45, ev.big ? 0.4 : 0.22, 0.7, 'lowpass'); a.tone('sine', 90, 40, 0.35, ev.big ? 0.4 : 0.2); break;
    case 'dive': a.hiss(1200, 200, 0.3, 0.14, 0.8); break;
    case 'split': case 'mirror': a.tone('sine', 880, 1320, 0.25, 0.12); a.tone('sine', 1100, 660, 0.3, 0.08, 0.08); break;
    case 'glyph': a.tone('triangle', 660, 990, 0.15, 0.12); break;
    case 'glyphBurst': a.tone('triangle', 520, 1560, 0.4, 0.2); a.hiss(4000, 1500, 0.3, 0.15, 1); break;
    case 'portal': a.tone('sine', 220, 880, 0.8, 0.22); a.tone('triangle', 330, 1320, 0.8, 0.12, 0.1); break;
    case 'start': case 'enter': case 'room': a.tone('sawtooth', 110, 82, 0.9, 0.12); a.tone('sine', 220, 165, 1.1, 0.12); break;
    case 'wave': a.tone('square', 196, 196, 0.12, 0.08); a.tone('square', 262, 262, 0.18, 0.08, 0.12); break;
    case 'roomClear': case 'chalDone': a.tone('triangle', 523, 784, 0.25, 0.18); a.tone('triangle', 659, 1046, 0.4, 0.15, 0.15); break;
    case 'chest': a.tone('triangle', 784, 1568, 0.5, 0.2); a.hiss(6000, 3000, 0.4, 0.1, 1); break;
    case 'bossPull': case 'bossStart': if (ev.type === 'forge' && ev.ph === 'bossStart') { a.tone('square', 98, 98, 0.15, 0.15); a.tone('square', 98, 98, 0.15, 0.15, 0.3); a.tone('sawtooth', 65, 49, 1.2, 0.2, 0.6); break; }
      a.tone('sawtooth', 65, 49, 1.6, 0.2); a.hiss(400, 80, 1.4, 0.2, 0.6, 'lowpass'); break;
    case 'flip': a.tone('sine', ev.light === 'dark' ? 440 : 220, ev.light === 'dark' ? 110 : 880, 0.7, 0.25); a.hiss(3000, 300, 0.6, 0.15, 0.8); break;
    case 'boom': if (ev.type === 'forge') { if (ev.sh === 'mold') { a.hiss(2000, 200, 1.0, 0.35, 0.6, 'lowpass'); a.tone('sine', 70, 35, 0.9, 0.3); } else { a.tone('square', 180, 60, 0.2, 0.25); a.tone('sine', 90, 40, 0.4, 0.3); a.tone('triangle', 2093, 2000, 0.6, 0.06, 0.02); } break; }
      a.tone('sine', 120, 40, 0.4, 0.35); a.hiss(1500, 150, 0.35, 0.25, 0.7, 'lowpass'); break;
    case 'brazier': a.hiss(2500, 900, 0.3, 0.12, 1); break;
    case 'phase': case 'enrage': a.tone('sawtooth', 98, 196, 0.8, 0.18); break;
    case 'victory': a.tone('triangle', 392, 784, 0.4, 0.22); a.tone('triangle', 523, 1046, 0.5, 0.2, 0.25); a.tone('triangle', 659, 1318, 0.9, 0.2, 0.5); break;
    case 'wipe': a.tone('sine', 220, 55, 1.2, 0.25); break;
    case 'pull': if (ev.type === 'unw') { a.tone('sawtooth', 55, 41, 2.2, 0.2); a.tone('sine', 880, 220, 1.6, 0.08, 0.3); a.hiss(600, 90, 1.8, 0.16, 0.6, 'lowpass'); } break; // the Unwritten Throne: a page turns
    case 'last': case 'retry': if (ev.type === 'unw') { a.tone('sawtooth', 147, 73, 1.0, 0.2); a.tone('triangle', 1175, 587, 0.8, 0.12, 0.15); } break;
    case 'revive': if (ev.type === 'unw' && me) a.tone('triangle', 523, 1046, 0.5, 0.16); break;
    // Frostveil Peaks + the Glacier Crypt
    case 'stillCast': a.tone('sine', 1760, 220, 0.9, 0.16); a.hiss(8000, 2000, 0.8, 0.08, 1); break;
    case 'still': a.tone('triangle', 220, 1320, 0.35, 0.2); a.hiss(5000, 1200, 0.4, 0.14, 1); break;
    case 'shake': a.tone('square', 80, 60, 0.5, 0.1); a.hiss(2500, 600, 0.6, 0.18, 0.8); break;
    case 'flung': a.hiss(3000, 800, 0.25, 0.1, 1); break;
    case 'echo': a.tone('sine', 660, 330, 0.5, 0.1); a.tone('sine', 660, 330, 0.5, 0.05, 0.18); break;
    case 'giftBoom': a.tone('triangle', 1046, 523, 0.25, 0.15); a.hiss(2500, 300, 0.3, 0.2, 0.7, 'lowpass'); break;
    case 'giftPop': a.tone('triangle', 1318, 1760, 0.12, 0.08); break;
    case 'avalanche': a.hiss(1200, 80, 1.4, 0.35, 0.6, 'lowpass'); a.tone('sine', 70, 35, 1.2, 0.3); break;
    case 'whiteout': a.hiss(4000, 600, 2.2, 0.22, 0.6); break;
    case 'roar': a.tone('sawtooth', 110, 55, 0.9, 0.18); a.hiss(900, 200, 0.8, 0.16, 0.6, 'lowpass'); break;
    case 'snowball': a.hiss(1800, 400, 0.2, 0.1, 0.8, 'lowpass'); break;
    case 'wake': a.tone('sine', 300, 600, 0.3, 0.1); a.hiss(6000, 3000, 0.25, 0.08, 1); break;
    case 'icicle': a.tone('sine', 2400, 1800, 0.12, 0.06); a.hiss(7000, 3000, 0.18, 0.08, 1); break;
    case 'check': a.tone('triangle', 784, 1568, 0.3, 0.2); a.tone('triangle', 1046, 2093, 0.4, 0.16, 0.12); break;
    case 'castle': a.tone('square', 392, 196, 0.25, 0.1); a.tone('square', 196, 392, 0.25, 0.1, 0.15); break;
    case 'hop': a.tone('sine', 520, 260, 0.12, 0.08); break;
    case 'sunk': a.tone('sine', 110, 30, 1.6, 0.3); a.hiss(600, 80, 1.4, 0.2, 0.6, 'lowpass'); break;
    // the Astral Rift (game loop C3)
    case 'tear': if (me) { a.tone('sine', 220, 110, 0.25, 0.08); a.hiss(1200, 300, 0.3, 0.08, 0.7, 'lowpass'); } break;
    // Emberdeep Caldera + the Forge of Cinders
    case 'burn': if (me) { a.hiss(2400, 700, 0.18, 0.1, 0.9); a.tone('sawtooth', 160, 120, 0.12, 0.05); } break;
    case 'mothPop': a.tone('triangle', 880, 1320, 0.1, 0.06); a.hiss(3500, 1200, 0.2, 0.08, 1); break;
    case 'kindle': a.hiss(800, 2400, 0.4, 0.12, 0.8); a.tone('sine', 180, 260, 0.4, 0.1); break;
    case 'fuse': a.hiss(5000, 4000, 0.6, 0.06, 2); break;
    case 'harden': case 'encase': a.tone('square', 140, 90, 0.3, 0.12); a.hiss(1500, 300, 0.4, 0.15, 0.7, 'lowpass'); break;
    case 'crack': case 'freed': a.tone('square', 600, 300, 0.08, 0.08); a.hiss(4000, 900, 0.25, 0.16, 1); break;
    case 'eel': a.hiss(700, 200, 0.5, 0.18, 0.6, 'lowpass'); a.tone('sine', 120, 60, 0.4, 0.12); break;
    case 'barrage': a.tone('sine', 220, 90, 0.25, 0.12); a.tone('sine', 220, 90, 0.25, 0.1, 0.12); break;
    case 'bounce': a.tone('sine', 300, 180, 0.1, 0.08); break;
    case 'panes': case 'reflect': a.tone('sine', 1568, 2093, 0.3, 0.1); a.tone('sine', 2093, 1568, 0.3, 0.06, 0.1); break;
    case 'anneal': a.tone('sawtooth', 220, 440, 0.6, 0.06); a.hiss(3000, 6000, 0.6, 0.06, 1); break;
    case 'burst': case 'shatter': case 'pop': a.tone('triangle', 2093, 1046, 0.15, 0.1); a.hiss(9000, 4000, 0.3, 0.15, 1, 'highpass'); break;
    case 'storm': a.hiss(3000, 1200, 1.2, 0.14, 0.7); break;
    case 'flareCast': case 'noonCast': a.tone('sine', 440, 1760, 0.8, 0.12); a.tone('triangle', 660, 1320, 0.8, 0.08, 0.1); break;
    case 'flare': case 'noon': a.tone('sawtooth', 880, 220, 0.6, 0.14); a.hiss(6000, 1200, 0.5, 0.2, 0.8); break;
    case 'hour': case 'beat': a.tone('square', 196, 196, 0.1, 0.12); a.tone('sine', 98, 60, 0.3, 0.15); break;
    case 'tide': a.hiss(500, 120, 1.4, 0.3, 0.6, 'lowpass'); a.tone('sine', 55, 40, 1.4, 0.25); break;
    case 'eruptCast': a.tone('sawtooth', 70, 110, 1.0, 0.14); a.hiss(400, 900, 1.0, 0.18, 0.6, 'lowpass'); break;
    case 'floor': a.hiss(1200, 300, 0.8, 0.2, 0.6, 'lowpass'); a.tone('sine', 80, 50, 0.8, 0.2); break;
    case 'geyser': a.hiss(600, 2400, 0.6, 0.2, 0.7); break;
    case 'slag': a.hiss(1500, 200, 0.3, 0.16, 0.7, 'lowpass'); a.tone('sine', 160, 70, 0.25, 0.1); break;
    case 'tongs': a.tone('square', 330, 165, 0.15, 0.12); a.tone('square', 330, 165, 0.15, 0.12, 0.12); break;
    case 'bellows': a.hiss(300, 1600, 1.0, 0.28, 0.5, 'lowpass'); a.tone('sine', 60, 90, 1.0, 0.18); break;
    case 'bellowsEnd': a.hiss(1600, 300, 0.6, 0.12, 0.5, 'lowpass'); break;
    case 'flawless': a.tone('triangle', 1046, 2093, 0.35, 0.2); a.tone('triangle', 1318, 2637, 0.45, 0.14, 0.12); a.tone('sine', 523, 523, 0.6, 0.1); break;
    case 'shrink': a.tone('sawtooth', 110, 55, 1.4, 0.2); a.hiss(900, 150, 1.4, 0.25, 0.6, 'lowpass'); break;
    case 'cast': if (ev.type === 'forge') { a.tone('triangle', ev.k === 'pour' ? 330 : 520, ev.k === 'pour' ? 660 : 390, 0.35, 0.14); break; }
      if (ev.type === 'crypt') a.tone('triangle', ev.k === 'zero' ? 1320 : 660, ev.k === 'zero' ? 440 : 990, 0.35, 0.14); break;
  }
}

/** UI sounds: a click on every button / card / slot, a faint tick when hovering a button (desktop). */
export function bindUiSounds(audio) {
  if (typeof document === 'undefined') return;
  const SEL = 'button, .btn, .opt-slot, .class-card, .slot, .tab, [data-mission], .mission-card';
  document.addEventListener('click', (e) => { const b = e.target && e.target.closest && e.target.closest(SEL); if (b && !b.disabled) audio.play(/close|cancel|back/i.test(b.id || '') ? 'back' : 'click'); }, { capture: true });
  let lastHover = null;
  document.addEventListener('mouseover', (e) => { const b = e.target && e.target.closest && e.target.closest('button, .btn, .class-card'); if (b && b !== lastHover && !b.disabled) audio.play('hover'); lastHover = b; }, { capture: true });
}

/** mission dungeon cues: short, readable stings (waves, captures, gates, tiers, the end) */
function opsSound(a, ev) {
  switch (ev.ph) {
    case 'start': case 'go': [330, 440, 554].forEach((f, i) => a.tone('triangle', f, f, 0.18, 0.12, i * 0.08)); break;
    case 'wave': a.tone('sawtooth', 110, 82, 0.5, 0.14); a.tone('square', 220, 220, 0.12, 0.08, 0.2); break;
    case 'shieldBreak': a.tone('square', 660, 220, 0.4, 0.14); break;
    case 'relicHit': case 'termHit': a.tone('square', 200, 170, 0.08, 0.06); break;
    case 'round': case 'term': case 'tier': [523, 659, 784].forEach((f, i) => a.tone('triangle', f, f, 0.25, 0.16, i * 0.1)); break;
    case 'plug': case 'pick': a.tone('sine', 440, 880, 0.2, 0.12); break;
    case 'drop': a.tone('sine', 660, 330, 0.25, 0.12); break;
    case 'gate': a.tone('sawtooth', 80, 160, 0.6, 0.16); break;
    case 'boss': case 'target': a.tone('sawtooth', 98, 73, 0.9, 0.18); break;
    case 'bolt': a.tone('square', 880, 440, 0.15, 0.1); a.tone('square', 880, 440, 0.15, 0.1, 0.2); break;
    case 'end': if (ev.why === 'fail') a.tone('triangle', 330, 165, 0.8, 0.18); else [523, 659, 784, 1046].forEach((f, i) => a.tone('triangle', f, f, 0.3, 0.18, i * 0.12)); break;
  }
}
