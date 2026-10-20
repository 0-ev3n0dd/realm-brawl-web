// Part B4: the Shadow Duel's song (public/audio/shadow-duel.ogg | .m4a, beat map in client/duelcues.js) as ADAPTIVE music.
// One decoded AudioBuffer; playback = a chain of AudioBufferSourceNode segments, every jump scheduled sample-exact on a
// downbeat (20 ms crossfade), so the big moments always land on the beat whatever the fight's length:
//   intro (0 .. fight)  Altar activation + the cinematic, beat-locked (client/duelcine.js reads songPos())
//   loop A              the groove, 100% -> 66%: at its end it jumps back to its start while the mirror is above 66%
//   66% crossed         -> the next downbeat jumps to break 1 (the breakdown); the arena cracks on swell 1
//   loop B              the climax, 66% -> 33% (holds the peak bar)
//   33% crossed         -> break 2 (the stop); falling stars on swell 2
//   loop C              the finale section until the final clash; the run-up + the final hit (then the tail is silent)
//   the final clash     on the peak bar if the mirror is ready while the climax plays, else on the final hit
// Never touches the sim; volume follows Options > Music. No song (old browser / fetch failed) = the cinematics run on real time.
import { DUEL_SONG as C } from './duelcues.js';
import { audioPref } from './audio.js';

export const SONG = { buf: null, loading: null, fail: false, ctx: null, out: null, segs: [], pend: null, on: false, log: [], fadeAt: 0, audio: null };
const pickUrl = () => {
  try { const a = document.createElement('audio'), c = (t) => a.canPlayType(t);
    if (c('audio/ogg; codecs="opus"') === 'probably') return '/realm-brawl-web/audio/shadow-duel.ogg'; if (c('audio/mp4; codecs="mp4a.40.2"')) return '/realm-brawl-web/audio/shadow-duel.m4a'; if (c('audio/ogg; codecs="opus"')) return '/realm-brawl-web/audio/shadow-duel.ogg'; } catch { /* no DOM */ }
  return '/realm-brawl-web/audio/shadow-duel.m4a';
};
/** fetch + decode once (called when the Altar panel opens, so the song is ready by activation) */
export function preloadSong(audio) {
  if (!audio || SONG.buf || SONG.loading || SONG.fail || typeof fetch === 'undefined') return SONG.loading;
  audio.ensure(); const ctx = audio.ctx; if (!ctx) return null;
  SONG.ctx = ctx; SONG.audio = audio;
  SONG.loading = fetch(pickUrl()).then((r) => { if (!r.ok) throw new Error('song ' + r.status); return r.arrayBuffer(); })
    .then((b) => new Promise((res, rej) => { const p = ctx.decodeAudioData(b, res, rej); if (p && p.then) p.then(res, rej); }))
    .then((buf) => { SONG.buf = buf; return buf; }).catch(() => { SONG.fail = true; return null; });
  return SONG.loading;
}
const vol = () => { const a = SONG.audio; return a && a.muted ? 0 : audioPref.music * 0.95; };
function seg(off, when) {
  const ctx = SONG.ctx, src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = SONG.buf; src.connect(g); g.connect(SONG.out);
  g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(1, when + 0.02); src.start(when, Math.max(0, off));
  const s = { src, g, t0: when, off }; SONG.segs.push(s); if (SONG.segs.length > 6) SONG.segs.shift();
  SONG.log.push({ ms: (typeof performance !== 'undefined' ? performance.now() : 0) + (when - ctx.currentTime) * 1000, off }); // (media tooling: rebuilds the clip's audio track)
  return s;
}
/** start at song second `off` (Altar activation = 0) */
export function songStart(off = 0) {
  if (!SONG.buf || !SONG.ctx) return false; songStop(0);
  const ctx = SONG.ctx; SONG.out = ctx.createGain(); SONG.out.gain.value = vol(); SONG.out.connect(ctx.destination);
  SONG.segs = []; SONG.pend = null; SONG.fadeAt = 0; seg(off, ctx.currentTime + 0.03); SONG.on = true; return true;
}
export function songStop(fade = 0.8) {
  if (!SONG.on || !SONG.ctx) { SONG.on = false; return; } const ctx = SONG.ctx, t = ctx.currentTime;
  try { SONG.out.gain.cancelScheduledValues(t); SONG.out.gain.setValueAtTime(SONG.out.gain.value, t); SONG.out.gain.linearRampToValueAtTime(0, t + Math.max(0.02, fade)); } catch { /* closed */ }
  for (const s of SONG.segs) try { s.src.stop(t + Math.max(0.05, fade) + 0.05); } catch { /* stopped */ }
  SONG.on = false; SONG.pend = null; SONG.log.push({ ms: (typeof performance !== 'undefined' ? performance.now() : 0) + fade * 1000, off: -1 });
}
const cur = () => { if (!SONG.on) return null; const now = SONG.ctx.currentTime; let c = null; for (const s of SONG.segs) if (s.t0 <= now) c = s; return c || SONG.segs[0] || null; }; // (a segment scheduled a few ms ahead counts as playing from its start)
/** the song second playing now (-1 = no song) */
export function songPos() { const c = cur(); if (!c) return -1; const p = c.off + Math.max(0, SONG.ctx.currentTime - c.t0); return p > C.duration ? -1 : p; }
export const nextBar = (s, lead = 0.08) => { for (const d of C.downbeats) if (d > s + lead) return d; return C.duration; };
/** at song second `at` (in the current segment), continue from song second `to` */
export function songJump(to, at) {
  const c = cur(); if (!c || SONG.pend) return false; const ctx = SONG.ctx;
  let when = c.t0 + (at - c.off); if (when < ctx.currentTime + 0.04) { when = ctx.currentTime + 0.04; }
  c.g.gain.setValueAtTime(1, when); c.g.gain.linearRampToValueAtTime(0, when + 0.02); try { c.src.stop(when + 0.05); } catch { /* */ }
  seg(to, when); SONG.pend = { when, to }; return true;
}
/** the adaptive rules, once a frame during a duel. st = { hp (mirror HP 0..1, null = none), won, fin } -> 'peak' | 'hit' = where the final clash will land */
export function songTick(st) {
  if (!SONG.on) return null; const ctx = SONG.ctx;
  if (SONG.out) SONG.out.gain.setTargetAtTime(SONG.fadeAt ? 0 : vol(), ctx.currentTime, SONG.fadeAt ? 0.6 : 0.05);
  if (SONG.pend && ctx.currentTime >= SONG.pend.when) SONG.pend = null;
  const s = songPos(); if (s < 0) { SONG.on = false; return null; }
  if (SONG.fadeAt && s >= SONG.fadeAt) { songStop(1.5); return null; }
  if (SONG.pend || s < C.fight) return null;
  const hp = st.hp, p66 = hp != null && hp <= 0.66, p33 = hp != null && hp <= 0.33, near = (end) => s > end - 0.6 && s < end;
  if (st.won) { // the kill: a peak-bar finish rides the climax out; else the run-up into the final hit, then the tail
    if (s >= C.loopB[0] && s < C.break2) { if (!SONG.fadeAt) SONG.fadeAt = C.break2 + 1.5; }
    else if (s < C.run - 0.1) songJump(C.run, nextBar(s));
    return null;
  }
  if (s < C.break1) { if (p66) { if (s < C.break1 - 0.3) songJump(C.break1, nextBar(s)); } else if (near(C.loopA[1])) songJump(C.loopA[0], C.loopA[1]); return null; }
  if (s < C.swell1) return null; // (the breakdown always plays through to the swell)
  if (s < C.break2) {
    if (st.fin && s < C.peak - 0.6 && s >= C.loopB[0]) return 'peak';
    if (st.fin && s >= C.peak + 0.6) { songJump(C.run, nextBar(s)); return 'hit'; }
    if (p33 && !st.fin) { if (s < C.break2 - 0.3) songJump(C.break2, nextBar(s)); }
    else if (near(C.loopB[1])) songJump(C.loopB[0], C.loopB[1]);
    return st.fin ? 'peak' : null;
  }
  if (s < C.swell2) return null;
  if (s < C.run) { if (st.fin) { if (s < C.run - 0.3) songJump(C.run, nextBar(s)); return 'hit'; } if (near(C.loopC[1])) songJump(C.loopC[0], C.loopC[1]); return null; }
  if (s > C.hit + 0.7) songJump(C.loopC[0], nextBar(s)); // (the final clash missed: back into the finale section, another run-up comes)
  return st.fin ? 'hit' : null;
}
export { C as SONG_MAP };
