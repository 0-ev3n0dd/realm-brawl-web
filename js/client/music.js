// Procedural zone music (experience pass 1): every zone has its own generated theme - tempo, key, mode, chord
// progression, drum kit and instrument set - synthesised live with WebAudio (no audio files, nothing copyrighted).
// Melodies come from a seeded generator (phrase form A A' B A over 8 bars), so a theme is the same every visit but long
// enough not to grate. A lookahead scheduler (driven from the game frame) queues notes ~0.25 s ahead; switching zones
// crossfades (1.6 s). intensity (0..1, combat nearby) brings in the drums / lead on the field themes; death muffles the
// mix (low-pass) until you respawn.
import { inTownArea } from '../sim/townconst.js';
import { inRaidArea } from '../sim/constants.js';
import { inAstArea } from '../sim/astraelconst.js';
import { trialAt } from '../sim/trialconst.js';
import { inTombArea, inDunesArea } from '../sim/dunesconst.js';
import { inFrostArea, inCryptArea } from '../sim/frostconst.js';
import { inHollowArea, inTorArea } from '../sim/glowconst.js';
import { inEmberArea, inForgeArea } from '../sim/emberconst.js';
import { inRiftArea } from '../sim/riftconst.js';
const AREAS = { inTownArea, inRaidArea, inAstArea, inTombArea, inDunesArea, inFrostArea, inCryptArea, inEmberArea, inForgeArea, inRiftArea };
const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11], phrygian: [0, 1, 3, 5, 7, 8, 10], hijaz: [0, 1, 4, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
};
// prog: scale degrees (0 = I), one per `bpc` bars. kit: drum style. lead / pad / bass: instrument styles. calm: drums
// only at intensity (field themes); density: melody notes per bar (roughly).
// 2026-10-15 rework: every theme now shares the intro theme's DNA (public/audio/intro-theme.ogg: E minor, ~178 BPM,
// driving anthem rock - power-chord guitars, 8th-note bass, a big backbeat, a bright synth lead; its signature turn is
// i - VI - VII - I, the minor home chord lifting to major at the end of the line). Shared pieces: the REALM motif (the
// A phrase of every melody, re-cast in each theme's own mode), the 178 / 89 BPM pulse (action at 178, explore themes at
// the half-time 89 so they lock to the same grid), the distorted guitar layer (gtr: 'chug' palm-muted 8ths / 'power'
// held chords), lift: the last chord of the loop turns major like the intro. Per-area colour stays: key, mode, kit, lead.
export const TRACKS = {
  title: { name: 'Realm Brawl (Main Theme)', bpm: 178, root: 52, mode: 'aeolian', prog: [0, 5, 6, 0], lift: 1, bpc: 1, kit: 'rock', lead: 'synth', pad: 'choir', bass: 'drive', gtr: 'chug', density: 0.6, seed: 7 },
  village: { name: 'Brightwater Morning', bpm: 89, root: 55, mode: 'major', prog: [0, 4, 5, 3], bpc: 1, kit: 'soft', lead: 'pluck', pad: 'warm', bass: 'round', density: 0.45, seed: 11 },
  wilds: { name: 'Over the Green Hills', bpm: 89, root: 52, mode: 'dorian', prog: [0, 5, 6, 0], lift: 1, bpc: 1, kit: 'rock', lead: 'synth', pad: 'warm', bass: 'pulse', gtr: 'power', density: 0.5, calm: true, seed: 23 },
  dunes: { name: 'Sunscorch Caravan', bpm: 89, root: 52, mode: 'hijaz', prog: [0, 1, 6, 0], bpc: 1, kit: 'darbuka', lead: 'reed', pad: 'drone', bass: 'round', gtr: 'power', density: 0.55, calm: true, seed: 37 },
  frost: { name: 'Frostveil Wind', bpm: 89, root: 59, mode: 'aeolian', prog: [0, 5, 6, 0], lift: 1, bpc: 1, kit: 'soft', lead: 'bell', pad: 'choir', bass: 'round', gtr: 'power', density: 0.4, calm: true, seed: 89 },
  crypt: { name: 'The Rimeking Moves', bpm: 89, root: 47, mode: 'harmonic', prog: [0, 5, 4, 0], bpc: 2, kit: 'sparse', lead: 'bell', pad: 'dark', bass: 'drone', gtr: 'chug', density: 0.3, seed: 97 },
  hollow: { name: 'Lanterns in the Moss', bpm: 96, root: 50, mode: 'harmonic', prog: [0, 5, 4, 0], bpc: 2, kit: 'sparse', lead: 'bell', pad: 'dark', bass: 'drone', gtr: 'chug', density: 0.3, seed: 131 }, // (2026-10-18: the Glowmire Hollow)
  tor: { name: 'The Stormhorn', bpm: 128, root: 45, mode: 'harmonic', prog: [0, 5, 4, 0], bpc: 2, kit: 'drive', lead: 'bell', pad: 'dark', bass: 'drone', gtr: 'chug', density: 0.3, seed: 137 }, // (2026-10-18: Vharok's Tor)
  ember: { name: 'Emberdeep Smoulder', bpm: 89, root: 50, mode: 'phrygian', prog: [0, 1, 6, 0], bpc: 1, kit: 'darbuka', lead: 'reed', pad: 'dark', bass: 'saw', gtr: 'chug', density: 0.45, calm: true, seed: 101 },
  forge: { name: 'Anvil of Cinders', bpm: 178, root: 45, mode: 'harmonic', prog: [0, 5, 6, 4], bpc: 1, kit: 'rock', lead: 'brass', pad: 'drone', bass: 'drive', gtr: 'chug', density: 0.4, seed: 113 },
  tomb: { name: 'Halls of the Sleeping King', bpm: 89, root: 50, mode: 'harmonic', prog: [0, 5, 3, 4], bpc: 2, kit: 'sparse', lead: 'bell', pad: 'dark', bass: 'drone', gtr: 'power', density: 0.25, seed: 41 },
  boss: { name: 'Tusks and Thunder', bpm: 178, root: 52, mode: 'harmonic', prog: [0, 5, 6, 4], bpc: 1, kit: 'rock', lead: 'synth', pad: 'dark', bass: 'drive', gtr: 'chug', density: 0.6, seed: 53 },
  raid: { name: 'Vorthax Ascendant', bpm: 178, root: 53, mode: 'phrygian', prog: [0, 1, 0, 6], bpc: 1, kit: 'gallop', lead: 'synth', pad: 'choir', bass: 'drive', gtr: 'chug', density: 0.65, seed: 67 },
  frosttrial: { name: 'Skaldra, Glass of Winter', bpm: 178, root: 54, mode: 'harmonic', prog: [0, 5, 6, 4], bpc: 1, kit: 'rock', lead: 'bell', pad: 'choir', bass: 'drive', gtr: 'chug', density: 0.75, seed: 131 },
  rift: { name: 'Astral Drift', bpm: 89, root: 52, mode: 'lydian', prog: [0, 5, 3, 4], bpc: 1, kit: 'sparse', lead: 'arp', pad: 'dark', bass: 'saw', gtr: 'power', density: 0.4, calm: true, seed: 211 },
  embertrial: { name: 'Pyrrhex, the Heart Beneath', bpm: 178, root: 47, mode: 'phrygian', prog: [0, 1, 6, 1], bpc: 1, kit: 'gallop', lead: 'brass', pad: 'dark', bass: 'drive', gtr: 'chug', density: 0.72, seed: 149 },
  shadow: { name: 'The Shadow Duel', bpm: 172, root: 50, mode: 'harmonic', prog: [0, 6, 5, 4], bpc: 1, kit: 'gallop', lead: 'brass', pad: 'choir', bass: 'drive', gtr: 'chug', density: 0.78, seed: 223 }, // (Part B3: your mirror's theme)
  ultimate: { name: 'The Unwritten', bpm: 178, root: 50, mode: 'harmonic', prog: [0, 6, 5, 4], lift: 1, bpc: 1, kit: 'gallop', lead: 'synth', pad: 'choir', bass: 'drive', gtr: 'chug', density: 0.85, seed: 223 }, // (Part F: the Ultimate)
  trial: { name: 'Astrael, Star Sovereign', bpm: 178, root: 58, mode: 'lydian', prog: [0, 1, 4, 0], bpc: 1, kit: 'rock', lead: 'synth', pad: 'choir', bass: 'drive', gtr: 'chug', density: 0.8, seed: 79 },
};
/** the REALM motif (scale degrees, 7 = the tonic an octave up; 0 = rest): 2 bars x 16 steps, the A phrase of every theme */
export const MOTIF = [
  [7, 0, 0, 9, 0, 0, 10, 0, 11, 0, 10, 0, 9, 0, 7, 0],
  [6, 0, 0, 7, 0, 0, 9, 0, 4, 0, 0, 0, 0, 0, 0, 0],
];
export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
/** chord tones (midi) for scale degree d of a track: a triad, root position */
export function chordOf(T, d) { const M = MODES[T.mode]; const n = (i) => T.root + M[(d + i) % 7] + 12 * Math.floor((d + i) / 7); return [n(0), n(2), n(4)]; }
/** the generated melody of a track: 8 bars x 16 steps of midi notes (0 = rest). Deterministic per track. */
export function melodyOf(T) {
  if (T._mel) return T._mel;
  const M = MODES[T.mode], r = rng(T.seed), bars = [];
  const phrase = () => { // a 2-bar phrase: rhythm + a pitch walk that lands on chord tones on the strong beats
    const out = [];
    let deg = 7 + Math.floor(r() * 5);
    for (let b = 0; b < 2; b++) {
      const row = new Array(16).fill(0);
      for (let s = 0; s < 16; s++) {
        const strong = s % 4 === 0, eighth = s % 2 === 0;
        const p = strong ? 0.75 : eighth ? 0.45 * T.density * 1.6 : 0.18 * T.density;
        if (r() < p) { deg += Math.round((r() - 0.5) * 4); deg = Math.max(3, Math.min(13, deg)); if (strong && deg % 2) deg += r() < 0.5 ? 1 : -1; row[s] = deg; }
      }
      out.push(row);
    }
    return out;
  };
  const A = MOTIF.map((r) => r.slice()), B = phrase(), A2 = [A[0], phrase()[1]];
  for (const ph of [A, A2, B, A]) for (const row of ph) bars.push(row);
  T._mel = bars.map((row) => row.map((deg) => (deg ? T.root + 12 + M[deg % 7] + 12 * Math.floor(deg / 7) - 12 : 0)));
  return T._mel;
}
// drum patterns per kit (16 steps): k = kick, s = snare, h = hat, t = tom / darbuka, '.' = rest
const KITS = {
  soft: { k: 'x.......x.......', s: '........', h: '..x...x...x...x.', t: '' },
  march: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', t: '' },
  darbuka: { k: 'x.....x...x.....', s: '', h: '..x.x...x.x.x..x', t: 'x..x..x.x..x..x.' },
  sparse: { k: 'x...............', s: '', h: '', t: '........x.......' },
  drive: { k: 'x...x.x.x...x.x.', s: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx', t: '..............xx' },
  four: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', t: '' },
  rock: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', t: '' }, // (the intro's backbeat)
  gallop: { k: 'x.xx..x.x.xx..x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', t: '..............xx' },
};
const on = (pat, s) => !!pat && pat[s % pat.length] === 'x';

class Player { // one track playing on its own bus (two overlap during a crossfade)
  constructor(m, id) {
    const c = m.ctx; this.m = m; this.id = id; this.T = TRACKS[id]; this.step = 0;
    this.bus = c.createGain(); this.bus.gain.value = 0.0001; this.bus.connect(m.in);
    this.next = c.currentTime + 0.08; this.alive = true; this.stopAt = 0;
    this.bus.gain.exponentialRampToValueAtTime(1, c.currentTime + 1.2);
    melodyOf(this.T);
  }
  fadeOut() { const c = this.m.ctx, t = c.currentTime; this.bus.gain.cancelScheduledValues(t); this.bus.gain.setValueAtTime(Math.max(0.0001, this.bus.gain.value), t); this.bus.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); this.stopAt = t + 1.7; }
  schedule(until, intensity) {
    const T = this.T, sd = 60 / T.bpm / 4;
    while (this.next < until) { this.play(this.step, this.next, sd, intensity); this.step++; this.next += sd; }
    if (this.stopAt && this.m.ctx.currentTime > this.stopAt) { this.alive = false; try { this.bus.disconnect(); } catch { /* gone */ } }
  }
  play(step, t, sd, I) {
    const T = this.T, s = step % 16, bar = Math.floor(step / 16), m = this.m;
    const pi = Math.floor(bar / T.bpc) % T.prog.length, d = T.prog[pi], ch = chordOf(T, d);
    if (T.lift && d === 0 && pi === T.prog.length - 1 && ch[1] - ch[0] === 3) ch[1] += 1; // (the intro's minor -> major lift)
    const full = !T.calm || I > 0.35;
    // pad: on each chord change, the triad held for the chord's length
    if (s === 0 && bar % T.bpc === 0) m.pad(this.bus, T.pad, ch, t, sd * 16 * T.bpc);
    // bass
    const bpat = T.bass === 'drive' ? s % 2 === 0 : T.bass === 'drone' ? s === 0 && bar % 2 === 0 : T.bass === 'pulse' ? s % 2 === 0 : T.bass === 'saw' ? s % 2 === 0 || s === 15 : s === 0 || s === 8 || (s === 14 && bar % 2);
    if (bpat) m.bass(this.bus, T.bass, midiHz(ch[(s === 8 && T.bass !== 'pulse') ? 2 : 0] - 24 + (s === 14 ? 12 : 0)), t, T.bass === 'drone' ? sd * 30 : sd * (T.bass === 'round' ? 6 : 1.8));
    // melody (field themes: lead only when there is action, but a soft arp keeps them moving)
    const note = melodyOf(T)[bar % 8][s];
    if (note && (full || bar % 2 === 1)) m.lead(this.bus, T.lead, midiHz(note), t, sd * (T.lead === 'bell' ? 8 : 2.2), full ? 1 : 0.55);
    if (T.lead === 'arp' || (T.calm && !full && s % 4 === 2)) m.lead(this.bus, 'pluck', midiHz(ch[(step >> 1) % 3] + 12), t, sd * 1.5, 0.5);
    // the intro's guitar: palm-muted 8th chugs (action) or a held power chord per change (explore themes, when it heats up)
    if (T.gtr && full) {
      const pw = [ch[0] - 12, ch[0] - 5, ch[0]];
      if (T.gtr === 'chug') { if (s % 2 === 0) m.gtr(this, pw, t, sd * (s === 0 || s === 6 || s === 12 ? 3 : 1.1), s === 0 || s === 6 || s === 12 ? 1 : 0.6); }
      else if (s === 0 && bar % T.bpc === 0) m.gtr(this, pw, t, sd * 16 * T.bpc * 0.9, 0.8);
    }
    // drums
    const K = KITS[T.kit]; if (!K) return;
    if (full && T.gtr && s === 0 && bar % 8 === 0) m.crash(this.bus, t);
    const dr = full ? 1 : T.calm ? 0.5 : 1;
    if (on(K.k, s)) m.kick(this.bus, t, dr);
    if (full && on(K.s, s)) m.snare(this.bus, t);
    if (on(K.h, s) && (full || s % 4 === 2)) m.hat(this.bus, t, dr * (s % 4 === 2 ? 1 : 0.6));
    if (on(K.t, s)) m.tom(this.bus, t, T.kit === 'darbuka' ? (s % 8 === 0 ? 220 : 330) : 110);
  }
}

export class Music {
  constructor(ctx) {
    this.ctx = ctx; this.players = []; this.cur = null; this.vol = 0.55;
    this.out = ctx.createGain(); this.out.gain.value = this.vol * 0.5; this.out.connect(ctx.destination);
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 16000; this.lp.connect(this.out);
    this.in = ctx.createGain(); this.in.connect(this.lp);
    // a little room: a filtered feedback delay
    const dl = ctx.createDelay(1), fb = ctx.createGain(), f = ctx.createBiquadFilter(), wet = ctx.createGain();
    dl.delayTime.value = 0.27; fb.gain.value = 0.28; f.type = 'lowpass'; f.frequency.value = 2400; wet.gain.value = 0.22;
    this.in.connect(dl); dl.connect(f); f.connect(fb); fb.connect(dl); f.connect(wet); wet.connect(this.lp);
    const len = ctx.sampleRate * 0.3; this.noise = ctx.createBuffer(1, len, ctx.sampleRate); const nd = this.noise.getChannelData(0); for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
    this.muffled = false;
  }
  setVolume(v) { this.vol = v; this.out.gain.setTargetAtTime(v * 0.5, this.ctx.currentTime, 0.05); }
  /** per frame: which theme should play, how intense, is the player dead */
  update(id, intensity = 0, dead = false) {
    if (this.ctx.state !== 'running') return;
    if (id !== this.cur) {
      for (const p of this.players) if (!p.stopAt) p.fadeOut();
      this.cur = id;
      if (id && TRACKS[id]) this.players.push(new Player(this, id));
    }
    if (dead !== this.muffled) { this.muffled = dead; this.lp.frequency.setTargetAtTime(dead ? 520 : 16000, this.ctx.currentTime, dead ? 0.25 : 0.6); }
    const until = this.ctx.currentTime + 0.25;
    for (const p of this.players) p.schedule(until, intensity);
    this.players = this.players.filter((p) => p.alive);
  }
  get track() { return this.cur ? TRACKS[this.cur] : null; }
  // ---------------------------------------------------------------- instruments (a few oscillators each)
  env(g, t, a, peak, dur, rel = 0.08) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + Math.max(a, dur - rel)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel); }
  osc(bus, type, f, t, dur, peak, a = 0.005, rel = 0.1, filt = 0, det = 0) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det;
    let node = o; if (filt) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filt; o.connect(fl); node = fl; }
    node.connect(g); g.connect(bus); this.env(g, t, a, peak, dur, rel); o.start(t); o.stop(t + dur + rel + 0.05);
  }
  pad(bus, style, ch, t, dur) {
    const type = style === 'choir' ? 'sawtooth' : style === 'dark' ? 'sawtooth' : style === 'drone' ? 'triangle' : 'triangle';
    const filt = style === 'choir' ? 1400 : style === 'dark' ? 700 : style === 'drone' ? 900 : 1800, pk = style === 'warm' ? 0.035 : 0.03;
    const notes = style === 'drone' ? [ch[0], ch[0] + 7] : ch;
    for (const n of notes) { this.osc(bus, type, midiHz(n), t, dur, pk, Math.min(0.6, dur * 0.3), 0.5, filt, -7); this.osc(bus, type, midiHz(n), t, dur, pk * 0.8, Math.min(0.6, dur * 0.3), 0.5, filt, 7); }
  }
  bass(bus, style, f, t, dur) {
    if (style === 'drive') this.osc(bus, 'sawtooth', f, t, dur, 0.1, 0.004, 0.05, 700);
    else if (style === 'saw') this.osc(bus, 'sawtooth', f, t, dur, 0.09, 0.005, 0.06, 500);
    else if (style === 'pulse') this.osc(bus, 'square', f, t, dur, 0.05, 0.005, 0.05, 420);
    else if (style === 'drone') this.osc(bus, 'sawtooth', f, t, dur, 0.06, 0.8, 1, 300);
    else this.osc(bus, 'triangle', f, t, dur, 0.13, 0.01, 0.12);
  }
  lead(bus, style, f, t, dur, k = 1) {
    switch (style) {
      case 'flute': this.osc(bus, 'sine', f, t, dur, 0.07 * k, 0.03, 0.12); this.osc(bus, 'triangle', f * 2, t, dur * 0.6, 0.012 * k, 0.03, 0.1); break;
      case 'reed': this.osc(bus, 'sawtooth', f, t, dur, 0.035 * k, 0.02, 0.1, 1600); this.osc(bus, 'square', f * 1.003, t, dur, 0.02 * k, 0.02, 0.1, 1200); break;
      case 'bell': this.osc(bus, 'sine', f, t, dur, 0.06 * k, 0.003, 1.2); this.osc(bus, 'sine', f * 2.76, t, dur * 0.4, 0.015 * k, 0.003, 0.6); break;
      case 'synth': { // the intro's bright lead: two detuned saws + a square an octave up, a touch of vibrato
        const c = this.ctx, lf = c.createOscillator(), lg = c.createGain(); lf.frequency.value = 5.5; lg.gain.value = 6; lf.connect(lg);
        for (const [ty, pk, mul, det] of [['sawtooth', 0.032, 1, -8], ['sawtooth', 0.032, 1, 8], ['square', 0.012, 2, 0]]) {
          const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter(); o.type = ty; o.frequency.value = f * mul; o.detune.value = det; lg.connect(o.detune);
          fl.type = 'lowpass'; fl.frequency.value = 3600; o.connect(fl); fl.connect(g); g.connect(bus); this.env(g, t, 0.01, pk * k, dur, 0.1); o.start(t); o.stop(t + dur + 0.2);
        }
        lf.start(t); lf.stop(t + dur + 0.2); break;
      }
      case 'brass': this.osc(bus, 'sawtooth', f, t, dur, 0.045 * k, 0.03, 0.08, 1800); this.osc(bus, 'sawtooth', f, t, dur, 0.03 * k, 0.03, 0.08, 1800, 9); break;
      case 'arp': case 'pluck': default: this.osc(bus, 'triangle', f, t, Math.min(dur, 0.2), 0.06 * k, 0.003, 0.18); this.osc(bus, 'square', f * 2, t, 0.04, 0.008 * k, 0.002, 0.05, 3000);
    }
  }
  /** distorted power chord (pl = the Player: its own drive chain so it fades with the theme) */
  gtr(pl, notes, t, dur, k = 1) {
    const c = this.ctx;
    if (!pl.gin) {
      const sh = c.createWaveShaper(), cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; cv[i] = Math.tanh(x * 6); } sh.curve = cv;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
      const g = c.createGain(); g.gain.value = 0.07; pl.gin = c.createGain(); pl.gin.connect(sh); sh.connect(lp); lp.connect(hp); hp.connect(g); g.connect(pl.bus);
    }
    for (const n of notes) for (const det of [-6, 6]) this.osc(pl.gin, 'sawtooth', midiHz(n), t, dur, 0.5 * k, 0.003, 0.05, 0, det);
  }
  crash(bus, t) { this.noiseHit(bus, t, 'highpass', 5200, 0.5, 1.1, 0.05); }
  kick(bus, t, k = 1) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(0.28 * k, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.22); }
  noiseHit(bus, t, type, f, q, dur, peak) { const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.02); }
  snare(bus, t) { this.noiseHit(bus, t, 'bandpass', 1900, 0.8, 0.14, 0.14); this.osc(bus, 'triangle', 190, t, 0.05, 0.06, 0.002, 0.05); }
  hat(bus, t, k = 1) { this.noiseHit(bus, t, 'highpass', 8000, 0.7, 0.035, 0.05 * k); }
  tom(bus, t, f) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.18); }
}

/** Which theme fits where the player stands (pure: tested). sim = the client's sim view, p = the local player. */
export function trackFor(sim, p, A = AREAS) {
  if (!p) return 'village';
  const { inTownArea, inRaidArea, inAstArea, inTombArea, inDunesArea, inFrostArea, inCryptArea, inEmberArea, inForgeArea, inRiftArea } = A;
  if (inRaidArea(p.x, p.y)) return 'raid';
  if (inAstArea(p.x, p.y)) return sim.duel || MUSIC_HOLD.duel ? 'shadow' : 'trial';
  { const tk = p.y < -28000 && trialAt(p.x, p.y); if (tk) return tk === 'ul' ? 'ultimate' : tk === 'sk' ? 'frosttrial' : tk === 'nf' ? 'trial' : 'embertrial'; } // Skaldra / Pyrrhex trials
  if (p.y > 29000 && inTorArea(p.x, p.y)) return 'tor'; // Vharok's Trial / Extreme
  if (inTownArea(p.x, p.y)) return 'village';
  // a boss fight nearby (world bosses, Khepra, Neferakh): the boss theme
  for (const e of sim.enemies || []) if (e.boss && !e.dead && e.hp < e.maxHp && Math.hypot(e.x - p.x, e.y - p.y) < 1100) return 'boss';
  if (p.y > 29000 && inHollowArea(p.x, p.y)) return 'hollow';
  if (inTombArea(p.x, p.y)) return 'tomb';
  if (inRiftArea && inRiftArea(p.x, p.y)) return 'rift'; // (game loop C3)
  if (inForgeArea && inForgeArea(p.x, p.y)) return 'forge';
  if (inEmberArea && inEmberArea(p.x, p.y)) return 'ember';
  if (inCryptArea && inCryptArea(p.x, p.y)) return 'crypt';
  if (inFrostArea && inFrostArea(p.x, p.y)) return 'frost';
  if (inDunesArea(p.x, p.y)) return 'dunes';
  return 'wilds';
}
/** 0..1: how much fighting is going on around the player (enemies chasing within ~700 px) */
export function intensityFor(sim, p) {
  if (!p) return 0; let n = 0;
  for (const e of sim.enemies || []) if (!e.dead && Math.abs(e.x - p.x) < 700 && Math.abs(e.y - p.y) < 700 && (e.aggroId || e.state !== 'idle')) n++;
  return Math.min(1, n / 4);
}

/** One call per frame from a game loop (solo, co-op, phone): picks the theme, smooths the intensity, muffles on death. */
/** the title / menu screens: the main theme while no game is running (pass on = false to stop) */
export function menuMusic(audio, on = true) {
  clearInterval(menuMusic._iv); menuMusic._iv = 0;
  if (!audio) return;
  if (!on) { if (audio.music) audio.music.update(null); return; }
  menuMusic._iv = setInterval(() => { if (audio.music) audio.music.update('title', 1, false); }, 100);
}
/** Part B3: a cinematic can hold the music: id null = silence (the music drops), a track id = that theme; undefined = zone music */
export const MUSIC_HOLD = { id: undefined, duel: false };
export function musicTick(audio, sim, p, dt, holder) {
  if (!audio || !audio.music || !sim || !p) return;
  const tgt = intensityFor(sim, p), cur = holder._mi || 0;
  holder._mi = cur + (tgt - cur) * Math.min(1, dt * (tgt > cur ? 2.5 : 0.35)); // (fights kick in fast, calm returns slowly)
  if (MUSIC_HOLD.id !== undefined) { audio.music.update(MUSIC_HOLD.id, MUSIC_HOLD.id ? 1 : 0, false); return; }
  audio.music.update(trackFor(sim, p), holder._mi, !!p.dead);
}
