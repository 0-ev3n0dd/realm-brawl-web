// "Sun-Eaten Throne (Eclipse)" - Savage v2, NEFERAKH, ECLIPSE ASCENDANT: the transformed fight's score (client/neferakhsong.js).
// The door fight ends on the Savage arrangement (./suneatens.js); the transformation cuts it to ONE held low F, a choir/brass
// swell climbs out of it, and the eclipse arrives in a new section at 138 BPM (one bar = 1.739 s: the 14 s cinematic is 8 bars):
//   eclipse   HOLD (2 bars: the held F, a heartbeat kick) · SW1 SW2 (4 bars: the swell - wave choir + brass stabs climbing,
//             a timpani roll) · RISE (1 bar: the inverted motif) · HIT (1 bar: the title hit) -> loopE1
//   eclShort  the 3 s retry version: RISE HIT -> loopE1
//   loopE1-E4 B1-B4: the door's patterns in the relative key (+3 = F), with the motif INVERTED as the counter-line (EV);
//             E4 drives (the R2 run on top, full drums)
//   court     the Eclipse Court (B4's cinematic) -> loopE4 · finale the kill -> tail (the tail resolves to F MAJOR: the sun returns)
import base from './suneaten.js';
import sav from './suneatens.js';

const P = { ...base.patterns, ...sav.patterns };
export default {
  ...base,
  id: 'suneatene', title: 'Sun-Eaten Throne (Eclipse)', bpm: 138, key: 'F Phrygian dominant / F minor -> F major (the tail)',
  patterns: {
    ...P,
    HOLD: {
      tri:   'F1 . . . . . . . . . . . . . . . | F1 . . . . . . . . . . . . . . .',
      wave:  'F3 . . . . . . . . . . . . . . . | F3 . . . . . . . . . . . . . . .',
      noise: 'k - - - - - - - - - - - k - - - | k - - - - - - - k - - - k - k -',
    },
    SW1: {
      wave:  'F3 . . . . . . . Ab3 . . . . . . . | C4 . . . . . . . Db4 . . . . . . .',
      p2:    'F4 - - - - - - - Ab4 - - - - - - - | C5 - - - - - - - Db5 - - - - - - -',
      tri:   'F1 . . . . . . . F1 . . . . . . . | F1 . . . . . . . Db1 . . . . . . .',
      noise: 'k - - - s - - - k - - - s - - - | k - - - s - - - k - s - s s s s',
    },
    SW2: {
      wave:  'E4 . . . . . . . F4 . . . . . . . | Ab4 . . . . . . . C5 . . . . . . .',
      p2:    'E5 - E5 - E5 - E5 - F5 - F5 - F5 - F5 - | Ab5 - Ab5 - Ab5 - Ab5 - C6 C6 C6 C6 C6 C6 C6 C6',
      p1:    '- - - - - - - - - - - - - - - - | F5 . Ab5 . C6 . E6 . F6 . . . . . . .',
      tri:   'C2 . . . . . . . Db2 . . . . . . . | E2 . . . . . . . E2 E2 E2 E2 E2 E2 E2 E2',
      noise: 's - s - s - s - s s s s s s s s | s s s s s s s s s s s s s s s s',
    },
    // RISE: the motif INVERTED (the door's hungry half-step climbs D-Eb-F#; the eclipse falls F-E-C#)
    RISE: {
      p1:    'F6 . E6 . C#6 . . . C6 C#6 E6 . F6 . . .',
      p2:    'F5 C#5 A#4 F4 C#5 A#4 F4 C#4 F5 C#5 A#4 F4 E4 F4 A#4 C#5',
      tri:   'F2 . F2 . F2 . F2 . E2 . E2 . C#2 . C2 .',
      wave:  'F4 . . . . . . . E4 . . . C#4 . . .',
      noise: 'k+c - h - k - h - k - h - k s s s',
    },
    HIT: {
      p1:    'F6 . . . . . . . C6 . C#6 . C6 . A#5 A5',
      p2:    'F5 C5 Ab4 F4 - - - - E4 - F4 - E4 - C#4 -',
      tri:   'F2 . . . . . . . C2 . . . C#2 . E2 .',
      wave:  'F4 . . . . . . . . . . . . . . .',
      noise: 'k+c - - - k - - - k+c - - - k - s s',
    },
    // EV: the inverted motif as a counter-line over the door's patterns (in F)
    EV: { ...P.A, p1: 'F5 . . . E5 . . . C#5 . . . . . . . | C5 . . . C#5 . . . E5 . F5 . . . . .', wave: 'C#4 . . . . . . . C4 . . . . . . . | A#3 . . . . . . . C4 . . . . . . .' },
    EW: { ...P.B, p1: 'F5 . E5 . C#5 . E5 . F5 . . . A#5 . . . | A5 . G#5 . F5 . E5 . C#5 . . . C5 . . .' },
    // TF: the tail resolves to F major (the sun returns)
    TF: {
      p1:    'F5 . A5 . C6 . F6 . . . . . . . . . | A5 . . . C6 . . . F6 . . . . . . .',
      p2:    'F4 A4 C5 A4 F4 A4 C5 A4 F4 A4 C5 A4 F4 A4 C5 A4 | F4 . . . . . . . - - - - - - - -',
      tri:   'F2 . . . . . . . C2 . . . . . . . | F2 . . . . . . . . . . . - - - -',
      wave:  'A4 . . . . . . . C5 . . . . . . . | F4 . . . . . . . . . . . . . . .',
      noise: 'c - - - - - - - k - - - - - - - | c - - - - - - - - - - - - - - -',
    },
  },
  sections: [
    { name: 'eclipse', play: ['HOLD', 'SW1', 'SW2', 'RISE', 'HIT'], next: 'loopE1' },
    { name: 'loopE1', play: ['EV+3', 'SB+3', 'EV+3', 'SA+3'], loop: true },
    { name: 'loopE2', play: ['C+3', 'EW', 'C+3', 'D+3'], loop: true },
    { name: 'break', play: ['SK+3', 'SK+3'], loop: true },
    { name: 'set', play: ['SS+3', 'SS+3'], loop: true },
    { name: 'struck', play: ['R+3'], next: 'loopE3' },
    { name: 'loopE3', play: ['E+3', 'EW', 'E+3', 'F+3'], loop: true },
    { name: 'court', play: ['CT+3'], next: 'loopE4' },
    { name: 'loopE4', play: ['V', 'EW', 'V', 'R2+3'], loop: true },
    { name: 'finale', play: ['R2+3'], next: 'tail' },
    { name: 'tail', play: ['TF'] },
    { name: 'eclShort', play: ['RISE', 'HIT'], next: 'loopE1' }, // (laid out last: the full transformation flows straight on into loopE1)
  ],
};
