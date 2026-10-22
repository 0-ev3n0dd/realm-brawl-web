// "Sun-Eaten Throne (Savage)" - Neferakh Savage, encounter revamp Part 1S. The Trial / Extreme score (./suneaten.js) re-arranged:
//   + one layer everywhere it was missing: the wave channel answers the motif in loopA (a low counter-line), and a lead line rides the
//     break and the Sunbearer march (p1), so the Savage never sounds thinner than the Extreme;
//   loopV   Phase 5 Black Sun Verdict: a KEY CHANGE - the motif a minor third up (F), a new "court" pattern (V: the gavel, kick on
//           every beat, the motif hammered in octaves) between the lifted E / F;
//   court   the verdict cinematic (a 2-bar build: timpani roll + the scale climbing to the new key);
//   finale  a faster run-up: the run climbs two octaves in straight 16ths (the Extreme's run is half as long) into the big hit.
// Same clock as the sim (132 BPM, NEF.bar), the same sections otherwise, so client/neferakhsong.js drives both the same way.
import base from './suneaten.js';

const P = base.patterns;
export default {
  ...base,
  id: 'suneatens', title: 'Sun-Eaten Throne (Savage)', key: 'D Phrygian dominant -> F (the verdict)',
  patterns: {
    ...P,
    SA: { ...P.A, wave: 'A3 . . . . . . . F#3 . . . A3 . . . | Bb3 . . . . . . . G3 . . . Bb3 . C4 .' },
    SB: { ...P.B, wave: 'G3 . . . . . . . A3 . . . . . . . | F#3 . . . . . . . A3 . . . C4 . D4 .' },
    SK: { ...P.K, p1: 'D5 . . . . . . . Eb5 . . . D5 . . . | C5 . . . . . . . D5 . . . A4 . . .' },
    SS: { ...P.S, p1: 'A5 . . . . . . . Bb5 . . . A5 . . . | G5 . . . F#5 . . . Eb5 . . . D5 . . .' },
    // the verdict cinematic: the build into the new key
    CT: {
      p1:    'D5 . . . Eb5 . . . F#5 . . . G5 . . . | A5 . Bb5 . C6 . D6 . Eb6 . E6 . F6 . . .',
      p2:    'D4 - D4 - D4 - D4 - Eb4 - Eb4 - Eb4 - Eb4 - | E4 - E4 - E4 - E4 - F4 - F4 - F4 F4 F4 F4',
      tri:   'D2 . . . . . . . Eb2 . . . . . . . | E2 . . . . . . . F2 . . . C2 . F1 .',
      wave:  'D4 . . . . . . . Eb4 . . . . . . . | E4 . . . . . . . F4 . . . . . . .',
      noise: 'k - - - k - - - k - - - k - k - | s s s s s s s s s s s s s s s s',
    },
    // V: the court - the gavel on every beat, the motif hammered in octaves (in F, the new key)
    V: {
      p1:    'F5 . F6 . F#5 . . . A5 . . . F#5 . F5 . | F#5 . . . A#5 . C#6 . C6 . A#5 . A5 . F#5 .',
      p2:    'F4 A4 C5 F5 C5 A4 F4 A4 C5 F5 C5 A4 F4 A4 C5 A4 | F#4 A#4 C#5 F#5 C#5 A#4 F#4 A#4 C#5 F#5 C#5 A#4 F#4 A#4 C#5 A#4',
      tri:   'F2 F3 F2 F3 F2 F3 F2 F3 F2 F3 F2 F3 C2 C3 D#2 D#3 | F#2 F#3 F#2 F#3 F#2 F#3 F#2 F#3 F2 F3 F2 F3 C2 C3 D#2 D#3',
      wave:  'F4 . . . . . . . C4 . . . . . . . | F#4 . . . . . . . F4 . . . . . . .',
      noise: 'k+c - h - k - h - k - h - k - s - | k - h - k - h - k - s - k s s s',
    },
    // R2: the faster run-up - two octaves of straight 16ths, then the hit
    R2: {
      p1:    'D5 Eb5 F#5 G5 A5 Bb5 C6 D6 Eb6 F#6 G6 A6 Bb6 C7 D7 . | D7 . . . . . . . . . . . - - - -',
      wave:  'A4 . Bb4 . C5 . D5 . Eb5 . F#5 . G5 . A5 . | D5 . . . . . . . . . . . - - - -',
      p2:    'D4 Eb4 F#4 G4 A4 Bb4 C5 D5 Eb5 F#5 G5 A5 Bb5 C6 D6 . | D5 A4 F#4 D4 A3 F#3 D3 - - - - - - - - -',
      tri:   'D2 D2 D2 D2 Eb2 Eb2 Eb2 Eb2 C2 C2 C2 C2 D2 D2 D2 D2 | D2 . . . . . . . . . . . - - - -',
      noise: 's s s s s s s s s s s s s s s s | k+c - - - - - - - - - - - - - - -',
    },
  },
  sections: [
    { name: 'intro', play: ['I1', 'I2', 'I3'], next: 'loopA' },
    { name: 'loopA', play: ['SA', 'SB', 'SA', 'SB'], loop: true },
    { name: 'break', play: ['SK', 'SK'], loop: true },
    { name: 'loopB', play: ['C', 'D', 'C', 'D'], loop: true },
    { name: 'set', play: ['SS', 'SS'], loop: true },
    { name: 'struck', play: ['R'], next: 'loopC' },
    { name: 'loopC', play: ['E', 'F', 'E', 'F'], loop: true },
    { name: 'loopD', play: ['E+2', 'F+2', 'E+2', 'F+2'], loop: true },
    { name: 'court', play: ['CT'], next: 'loopV' },
    { name: 'loopV', play: ['V', 'E+3', 'V', 'F+3'], loop: true },
    { name: 'finale', play: ['R2'], next: 'tail' },
    { name: 'tail', play: ['T'] },
  ],
};
