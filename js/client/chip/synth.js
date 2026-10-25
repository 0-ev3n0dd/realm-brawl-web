// Chip synth (encounter revamp Part 0): renders an editable score (public/js/client/chip/songs/*.js, format: docs/CHIP-SONGS.md)
// into stereo samples. Pure JS (no WebAudio), so it is deterministic and runs headless in node tests; the browser wraps the result in an
// AudioBuffer (client/adaptivesong.js). Channels: p1 / p2 pulse (duty 0.125 / 0.25 / 0.5), tri (triangle bass), wave (soft saw lead with
// vibrato), noise (drums: k kick, s snare, h hat, o open hat, c crash; combine with '+'). Light FX: chorus (detuned L/R copies) + echo.
export const CHANNELS = ['p1', 'p2', 'tri', 'wave', 'noise'];
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** "C#4" / "Eb3" / "A4" -> midi number (null if not a note) */
export function noteMidi(tok) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(tok); if (!m) return null;
  return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const DEF_INST = {
  p1: { duty: 0.25, vol: 0.16, a: 0.004, d: 0.12, s: 0.6, r: 0.06, pan: -0.15, chorus: 0.35, echo: 0.28 },
  p2: { duty: 0.125, vol: 0.09, a: 0.002, d: 0.08, s: 0.35, r: 0.04, pan: 0.25, chorus: 0.2, echo: 0.18 },
  tri: { vol: 0.3, a: 0.003, d: 0.05, s: 0.85, r: 0.03, pan: 0, chorus: 0, echo: 0 },
  wave: { vol: 0.12, a: 0.03, d: 0.2, s: 0.7, r: 0.2, pan: 0.1, vib: 0.18, chorus: 0.5, echo: 0.3 },
  noise: { vol: 0.32, pan: 0, chorus: 0, echo: 0.05 },
};
/** split a channel string into step tokens ('|' and newlines are only for readability) */
export const tokens = (str) => (str || '').replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean);
/** check a score: every pattern's channels have the same step count (a multiple of a bar), every section names known patterns */
export function validateScore(S) {
  const errs = [], bar = S.bar || 16;
  for (const [name, P] of Object.entries(S.patterns)) {
    const lens = CHANNELS.filter((c) => P[c]).map((c) => [c, tokens(P[c]).length]);
    const n = lens.length ? lens[0][1] : 0;
    for (const [c, l] of lens) if (l !== n) errs.push(`${name}.${c}: ${l} steps, expected ${n}`);
    if (n % bar) errs.push(`${name}: ${n} steps is not whole bars of ${bar}`);
    for (const c of CHANNELS) for (const t of tokens(P[c])) if (!['.', '-', '_'].includes(t) && (c === 'noise' ? !/^[ksohc](\+[ksohc])*$/.test(t) : noteMidi(t) == null)) errs.push(`${name}.${c}: bad token "${t}"`);
  }
  for (const sec of S.sections) for (const ref of sec.play) if (!S.patterns[ref.split(/[+-]/)[0]]) errs.push(`section ${sec.name}: unknown pattern ${ref}`);
  return errs;
}
/** the song timeline: sections with start / end seconds, every downbeat, bpm; no audio needed (cinematics / music sync read this) */
export function songMap(S) {
  const step = 60 / S.bpm / (S.steps || 4), bar = S.bar || 16, out = { id: S.id, bpm: S.bpm, stepSec: step, barSec: step * bar, sections: {}, order: [], downbeats: [] };
  let at = 0;
  for (const sec of S.sections) {
    const t0 = at; for (const ref of sec.play) at += tokens(firstChan(S.patterns[ref.split(/[+-]/)[0]])).length * step;
    out.sections[sec.name] = { start: t0, end: at, loop: !!sec.loop, next: sec.next || null }; out.order.push(sec.name);
  }
  out.duration = at; for (let t = 0; t < at - 1e-6; t += step * bar) out.downbeats.push(+t.toFixed(4));
  return out;
}
const firstChan = (P) => P[CHANNELS.find((c) => P[c])];
/** render to { L, R, rate, map } */
export function renderScore(S, { rate = 32000 } = {}) {
  const map = songMap(S), N = Math.ceil((map.duration + 2.5) * rate), L = new Float32Array(N), R = new Float32Array(N);
  const inst = Object.fromEntries(CHANNELS.map((c) => [c, { ...DEF_INST[c], ...((S.inst || {})[c] || {}) }]));
  const fxBus = { L: new Float32Array(N), R: new Float32Array(N) };
  let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1; // (deterministic noise)
  const add = (i, v, I) => { const pl = Math.min(1, 1 - I.pan), pr = Math.min(1, 1 + I.pan); L[i] += v * pl; R[i] += v * pr; if (I.echo) { fxBus.L[i] += v * I.echo * pl; fxBus.R[i] += v * I.echo * pr; } };
  const env = (t, dur, I) => { const rel = t - dur; if (rel > 0) return rel > I.r ? 0 : (1 - rel / I.r) * (I.s ?? 1); if (t < I.a) return t / I.a; const d = t - I.a; return d < I.d ? 1 - (1 - I.s) * (d / I.d) : I.s; };
  const tone = (c, t0, dur, midi) => {
    const I = inst[c], hz = midiHz(midi), i0 = Math.floor(t0 * rate), n = Math.ceil((dur + I.r) * rate);
    let ph = 0, ph2 = 0, ph3 = 0;
    for (let k = 0; k < n && i0 + k < N; k++) {
      const t = k / rate, e = env(t, dur, I); if (e <= 0 && t > dur) break;
      const f = hz * (I.vib ? 1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t / Math.max(0.01, I.vib)) : 1);
      ph = (ph + f / rate) % 1;
      let v;
      if (c === 'tri') v = 4 * Math.abs(ph - 0.5) - 1;
      else if (c === 'wave') v = (2 * ph - 1) * 0.6 + Math.sin(2 * Math.PI * ph) * 0.4;
      else v = (ph < I.duty ? 1 : -1) - (2 * I.duty - 1); // (centred: a narrow pulse has no DC offset)
      let ch = 0;
      if (I.chorus) { ph2 = (ph2 + f * 1.0045 / rate) % 1; ph3 = (ph3 + f * 0.9955 / rate) % 1; const sq = (p) => (c === 'wave' ? 2 * p - 1 : (p < I.duty ? 1 : -1) - (2 * I.duty - 1)); ch = I.chorus; L[i0 + k] += sq(ph2) * ch * I.vol * e * 0.5; R[i0 + k] += sq(ph3) * ch * I.vol * e * 0.5; }
      add(i0 + k, v * I.vol * e * (1 - ch * 0.35), I);
    }
  };
  const drum = (t0, kind) => {
    const I = inst.noise, i0 = Math.floor(t0 * rate);
    const spec = { k: 0.16, s: 0.14, h: 0.035, o: 0.18, c: 0.9 }[kind], n = Math.ceil(spec * rate);
    let ph = 0, lp = 0;
    for (let k = 0; k < n && i0 + k < N; k++) {
      const t = k / rate, e = Math.pow(1 - k / n, kind === 'c' ? 1.6 : 3); let v;
      if (kind === 'k') { ph += (55 + 140 * Math.exp(-t * 38)) / rate; v = Math.sin(2 * Math.PI * ph) * 1.1; }
      else if (kind === 's') { lp += (rnd() - lp) * 0.6; ph += 185 / rate; v = lp * 0.75 + Math.sin(2 * Math.PI * ph) * 0.35 * Math.exp(-t * 30); }
      else { const w = rnd(); lp += (w - lp) * 0.9; v = (w - lp) * (kind === 'c' ? 0.7 : 0.55); }
      add(i0 + k, v * I.vol * e, I);
    }
  };
  let at = 0;
  for (const sec of S.sections) for (const ref of sec.play) {
    const m = /^([^+-]+)([+-]\d+)?$/.exec(ref), P = S.patterns[m[1]], tr = m[2] ? +m[2] : 0, n = tokens(firstChan(P)).length;
    for (const c of CHANNELS) {
      const tk = tokens(P[c]); if (!tk.length) continue;
      for (let i = 0; i < tk.length; i++) {
        const t = tk[i]; if (t === '.' || t === '-' || t === '_') continue;
        const t0 = at + i * map.stepSec;
        if (c === 'noise') { for (const d of t.split('+')) drum(t0, d); continue; }
        let j = i + 1; while (j < tk.length && tk[j] === '.') j++; // ('.' holds the note)
        tone(c, t0, (j - i) * map.stepSec * 0.92, noteMidi(t) + (c === 'tri' ? tr : tr));
      }
    }
    at += n * map.stepSec;
  }
  // echo (dotted eighth, feedback, slight ping-pong) on the FX bus, then a soft limiter
  const dl = Math.round(map.stepSec * 3 * rate), fb = (S.fx && S.fx.echoFb) ?? 0.32;
  for (let i = dl; i < N; i++) { fxBus.L[i] += fxBus.R[i - dl] * fb; fxBus.R[i] += fxBus.L[i - dl] * fb; }
  for (let i = dl; i < N; i++) { L[i] += fxBus.L[i - dl] * 0.55; R[i] += fxBus.R[i - dl] * 0.55; }
  { const a = 1 - (2 * Math.PI * 25) / rate; let xl = 0, yl = 0, xr = 0, yr = 0; for (let i = 0; i < N; i++) { const l = L[i], r = R[i]; yl = l - xl + a * yl; xl = l; yr = r - xr + a * yr; xr = r; L[i] = yl; R[i] = yr; } } // (DC blocker, 25 Hz)
  const g = (S.fx && S.fx.gain) ?? 1;
  for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * g * 1.2) * 0.9; R[i] = Math.tanh(R[i] * g * 1.2) * 0.9; }
  return { L, R, rate, map };
}
