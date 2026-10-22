// Per-class sound identity (experience pass 1): every class gets its own synth "voice" - a waveform, a root note, a
// scale and a noise colour - used for a short stinger on each skill cast (Q / E / R / F climb the class scale), a rising
// fanfare on the ult, and a quiet tint on basic attacks (on top of the shared swing / shot sound). Built from the same
// tone + hiss primitives as audio.js, so it costs a couple of oscillators per event. Others' casts play quieter.
const ST = (n) => Math.pow(2, n / 12);
export const CLASS_VOICE = {
  //            wave        root  scale (semitones)   noise Hz  character
  warrior:     { w: 'sawtooth', f: 98,  sc: [0, 3, 5, 7, 10], n: 700,  hit: 'thud' },   // low, gritty: war drums + brass
  ranger:      { w: 'triangle', f: 392, sc: [0, 2, 4, 7, 9],  n: 4200, hit: 'twang' },  // bright pentatonic, bowstring twang
  mage:        { w: 'sine',     f: 523, sc: [0, 4, 7, 11, 14], n: 8000, hit: 'shimmer' }, // glassy maj7 shimmer
  cleric:      { w: 'triangle', f: 440, sc: [0, 4, 7, 12, 16], n: 6000, hit: 'bell' },  // church bells, bright major
  bladedancer: { w: 'square',   f: 659, sc: [0, 3, 7, 10, 12], n: 5200, hit: 'snap' },  // quick, sharp, pinky square
  samurai:     { w: 'triangle', f: 330, sc: [0, 1, 5, 7, 8],  n: 6500, hit: 'ping' },   // in-scale (Japanese) + steel ping
  monk:        { w: 'sine',     f: 220, sc: [0, 2, 5, 7, 9],  n: 1800, hit: 'wood' },   // wood block / gong
  dragoon:     { w: 'sawtooth', f: 147, sc: [0, 3, 7, 8, 12], n: 1200, hit: 'roar' },   // heroic minor, dragon roar air
  summoner:    { w: 'sine',     f: 294, sc: [0, 3, 6, 10, 15], n: 2600, hit: 'echo' },  // eerie diminished, echoing
  bard:        { w: 'triangle', f: 523, sc: [0, 4, 7, 9, 12], n: 3500, hit: 'chord' },  // happy major chords
};
const KEY_IDX = { Q: 0, E: 1, R: 2, F: 3, SP: 4 };

/** the voice for a class (unknown classes fall back to the warrior) */
export const voiceOf = (cls) => CLASS_VOICE[cls] || CLASS_VOICE.warrior;
/** the note a skill key plays for a class, in Hz */
export const skillNote = (cls, key) => { const v = voiceOf(cls); return v.f * ST(v.sc[KEY_IDX[key] ?? 0] || 0); };

function signature(a, v, f, vol, d = 0) { // the class "instrument" playing one note
  switch (v.hit) {
    case 'thud': a.tone('sine', f * 0.5, f * 0.25, 0.22, vol * 1.6, d); a.tone('sawtooth', f, f * 0.98, 0.18, vol * 0.5, d); break;
    case 'twang': a.tone('triangle', f * 2, f * 1.96, 0.16, vol, d); a.tone('square', f * 4, f * 3.9, 0.04, vol * 0.25, d); break;
    case 'shimmer': a.tone('sine', f, f * 1.5, 0.3, vol, d); a.tone('sine', f * 2.01, f * 3, 0.25, vol * 0.4, d + 0.03); a.hiss(9000, 4000, 0.25, vol * 0.5, 2, 'highpass', d); break;
    case 'bell': a.tone('sine', f * 2, f * 2, 0.6, vol, d); a.tone('sine', f * 5.04, f * 5.04, 0.3, vol * 0.25, d); break;
    case 'snap': a.tone('square', f * 2, f * 1.4, 0.06, vol * 0.6, d); a.hiss(7000, 2500, 0.06, vol * 0.8, 1.5, 'bandpass', d); break;
    case 'ping': a.tone('triangle', f * 3, f * 3, 0.35, vol * 0.7, d); a.tone('sine', f * 4.2, f * 4.2, 0.2, vol * 0.3, d); a.hiss(8000, 5000, 0.05, vol * 0.6, 3, 'highpass', d); break;
    case 'wood': a.tone('sine', f * 2, f * 1.6, 0.07, vol * 1.2, d); a.hiss(1800, 900, 0.05, vol * 0.6, 4, 'bandpass', d); break;
    case 'roar': a.tone('sawtooth', f, f * 0.7, 0.3, vol * 0.6, d); a.hiss(1200, 300, 0.35, vol, 0.7, 'lowpass', d); break;
    case 'echo': [0, 0.09, 0.18].forEach((e, i) => a.tone('sine', f * 2, f * 2 * 0.99, 0.18, vol * (1 - i * 0.3), d + e)); break;
    case 'chord': [0, 4, 7].forEach((s) => a.tone('triangle', f * ST(s), f * ST(s), 0.3, vol * 0.5, d)); break;
    default: a.tone(v.w, f, f, 0.2, vol, d);
  }
}

/** called by Audio.handle for every event (before the class-specific modules); never blocks them */
export function classVoice(a, ev, me) {
  if (!ev.cls) return;
  const v = voiceOf(ev.cls), g = me ? 1 : 0.4;
  switch (ev.type) {
    case 'skill': { // cast stinger: the key's scale note, plus a whoosh in the class noise colour; chains (combos) add the fifth
      const f = skillNote(ev.cls, ev.key);
      signature(a, v, f, 0.11 * g);
      a.hiss(v.n * 0.5, v.n * 1.4, 0.14, 0.09 * g, 0.9);
      if (ev.chain) signature(a, v, f * ST(7), 0.08 * g, 0.07);
      return;
    }
    case 'ult': { // the class fanfare: the whole scale up, a low hit and a noise swell
      v.sc.forEach((s, i) => signature(a, v, v.f * ST(s), 0.09 * g, i * 0.06));
      a.tone('sine', v.f * 0.5, v.f * 0.25, 0.6, 0.3 * g);
      a.hiss(v.n * 0.3, v.n * 1.6, 0.5, 0.12 * g, 0.7);
      return;
    }
    case 'swing': case 'shoot': // basic attacks: a short, quiet class tint (the idx walks the scale, so a chain of basics climbs)
      if (!me) return;
      signature(a, v, v.f * ST(v.sc[(ev.idx || 0) % v.sc.length]), ev.heavy ? 0.06 : 0.035);
      return;
  }
}
