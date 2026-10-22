// Adaptive encounter music (encounter revamp Part 0): the B4 Shadow Duel model generalised. A chip score (client/chip/songs/*.js) is rendered
// once into an AudioBuffer; playback is a chain of AudioBufferSourceNode segments and every jump is scheduled sample-exact on a downbeat
// (20 ms crossfade), so the fight's big moments land on the beat whatever its length.
//   sections   come from the score (songMap): a `loop` section repeats until asked to move on; a section with `next` flows into it
//   go(name)   asks for a section: jumps on the next downbeat (or { atEnd: true } = when the current section ends)
//   pos()      the song second playing now (cinematics / set pieces read it to land on the beat)
// Never touches the sim; volume follows Options > Music; holds the zone music (MUSIC_HOLD) while it plays. The Shadow Duel keeps its own
// recorded song (client/duelsong.js) on the same model.
import { renderScore } from './chip/synth.js';
import { audioPref } from './audio.js';
import { MUSIC_HOLD } from './music.js';

const vol = () => (audioPref.music ?? 0.55) * 0.9;
export class AdaptiveSong {
  constructor(score) { this.score = score; this.buf = null; this.map = null; this.ctx = null; this.segs = []; this.pend = null; this.on = false; this.want = null; this.cur = null; this.log = []; }
  /** render (once) into an AudioBuffer for this audio context */
  load(audio) {
    if (this.buf) return this.buf; if (!audio) return null; audio.ensure && audio.ensure(); const ctx = audio.ctx; if (!ctx) return null;
    const r = renderScore(this.score, { rate: Math.min(48000, ctx.sampleRate || 32000) }); this.map = r.map; this.ctx = ctx;
    const b = ctx.createBuffer(2, r.L.length, r.rate); b.copyToChannel ? (b.copyToChannel(r.L, 0), b.copyToChannel(r.R, 1)) : (b.getChannelData(0).set(r.L), b.getChannelData(1).set(r.R));
    this.buf = b; return b;
  }
  seg(off, when) {
    const ctx = this.ctx, src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = this.buf; src.connect(g); g.connect(this.out);
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(1, when + 0.02); src.start(when, off);
    const s = { src, g, off, t0: when }; this.segs.push(s); if (this.segs.length > 6) this.segs.shift();
    this.log.push({ ms: (typeof performance !== 'undefined' ? performance.now() : 0) + (when - ctx.currentTime) * 1000, off }); return s;
  }
  /** start at a section (default: the first), `off` seconds into it (a fight already under way lands on its beat) */
  start(audio, section, off = 0) {
    if (!this.load(audio)) return false; this.stop(0); const ctx = this.ctx;
    this.out = ctx.createGain(); this.out.gain.value = vol(); this.out.connect(ctx.destination);
    const name = section || this.map.order[0]; this.segs = []; this.pend = null; this.want = null; this.cur = name;
    this.seg(this.map.sections[name].start + Math.max(0, off), ctx.currentTime + 0.03); this.on = true; MUSIC_HOLD.id = null; return true;
  }
  stop(fade = 0.8) {
    if (this.on) MUSIC_HOLD.id = undefined;
    if (!this.on || !this.ctx) { this.on = false; return; } const t = this.ctx.currentTime;
    try { this.out.gain.cancelScheduledValues(t); this.out.gain.setValueAtTime(this.out.gain.value, t); this.out.gain.linearRampToValueAtTime(0, t + Math.max(0.02, fade)); } catch { /* closed */ }
    for (const s of this.segs) try { s.src.stop(t + Math.max(0.05, fade) + 0.05); } catch { /* stopped */ }
    this.on = false; this.pend = null;
  }
  playing() { if (!this.on) return null; const now = this.ctx.currentTime; let c = null; for (const s of this.segs) if (s.t0 <= now) c = s; return c || this.segs[0] || null; }
  pos() { const c = this.playing(); if (!c) return -1; return c.off + Math.max(0, this.ctx.currentTime - c.t0); }
  sectionAt(s) { for (const n of this.map.order) { const x = this.map.sections[n]; if (s >= x.start - 1e-3 && s < x.end) return n; } return null; }
  nextBar(s, lead = 0.08) { for (const d of this.map.downbeats) if (d > s + lead) return d; return this.map.duration; }
  /** at song second `at`, continue from song second `to` */
  jump(to, at) {
    const c = this.playing(); if (!c || this.pend) return false; const ctx = this.ctx;
    let when = c.t0 + (at - c.off); if (when < ctx.currentTime + 0.04) when = ctx.currentTime + 0.04;
    c.g.gain.setValueAtTime(1, when); c.g.gain.linearRampToValueAtTime(0, when + 0.02); try { c.src.stop(when + 0.05); } catch { /* */ }
    this.seg(to, when); this.pend = { when, to }; return true;
  }
  /** ask for a section: on the next downbeat, or when the current section ends ({ atEnd: true }) */
  go(name, o = {}) { if (this.map && this.map.sections[name]) this.want = { name, atEnd: !!o.atEnd }; }
  /** once a frame: loops, `next` flow, pending requests */
  tick() {
    if (!this.on) return; const ctx = this.ctx; if (this.out) this.out.gain.setTargetAtTime(vol(), ctx.currentTime, 0.05);
    if (this.pend && ctx.currentTime >= this.pend.when) this.pend = null;
    const s = this.pos(); if (s < 0 || s >= this.map.duration) { this.stop(0.5); return; }
    const name = this.sectionAt(s); if (name) this.cur = name; const sec = this.map.sections[this.cur]; if (this.pend) return;
    if (this.want && this.want.name !== this.cur) {
      const to = this.map.sections[this.want.name]; const at = this.want.atEnd ? sec.end : Math.min(sec.end, this.nextBar(s));
      if (at - s < 0.6 && this.jump(to.start, at)) { this.cur = this.want.name; this.want = null; } return;
    }
    if (this.want && this.want.name === this.cur) this.want = null;
    if (sec.loop && s > sec.end - 0.6) this.jump(sec.start, sec.end); // (a loop section repeats until asked to move on)
  }
}
const CACHE = {};
/** the shared song for a score id (one render per page) */
export function songFor(score) { return CACHE[score.id] || (CACHE[score.id] = new AdaptiveSong(score)); }
