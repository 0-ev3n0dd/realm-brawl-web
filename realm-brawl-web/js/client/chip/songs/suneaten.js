// "Sun-Eaten Throne" - Neferakh Unbound (Trial / Extreme), encounter revamp Part 1 (composed in-repo; edit freely, see docs/CHIP-SONGS.md).
// D Phrygian dominant (D Eb F# G A Bb C: the desert scale), 132 BPM: one bar = 1.818 s = NEF.bar (109.09 ticks), so the sim and the song
// share a clock. One token = one 16th note. '.' holds, '-' rests. Drums: k kick, s snare, h hat, o open hat, c crash ('+' = together).
// The fight drives it (client/neferakhsong.js):
//   intro   5 bars = the 9.1 s pull: bar 1 the seal cracks (crash), 2 the sand runs (hats), 3 the sun is eaten (the falling wave line),
//           4 he rises (the motif), 5 the title hit -> loopA
//   loopA   Phase 1 The Seal Breaks: the motif (D - Eb - F#, the "hungry" half-step) over D | Eb, answered by Cm | D
//   break   transitions / re-pulls: pad + half-time kick
//   loopB   Phase 2 Day and Night: lighter, swung hats, G minor colour
//   set     the Sunbearer: a ticking march (the hats are the fuse)
//   struck  the sun reaches the altar: the scale run into the big hit -> loopC
//   loopC   Phase 3 Sun-Eaten: the motif driving, octave bass, kick on the off-beats
//   loopD   Extreme Phase 4 The Black Sun: loopC lifted a whole step (E)
//   finale  the kill: the run -> tail
export default {
  id: 'suneaten', title: 'Sun-Eaten Throne', bpm: 132, steps: 4, bar: 16, key: 'D Phrygian dominant',
  inst: { p1: { duty: 0.25 }, p2: { duty: 0.125 }, wave: { vol: 0.12 } },
  fx: { echoFb: 0.32, gain: 1 },
  patterns: {
    // intro bars 1-2: the seal cracks; the sand starts to run
    I1: {
      p2:    'D5 - - - - - - - - - - - - - - - | D4 - Eb4 - D4 - - - D4 - Eb4 - F#4 - Eb4 -',
      tri:   'D2 . . . . . . . . . . . . . . . | D2 . . . . . . . . . . . . . . .',
      wave:  'A3 . . . . . . . Bb3 . . . . . . . | A3 . . . . . . . . . . . . . . .',
      noise: 'c - - - - - - - - - - - - - - - | h - h - h - h - h h h h h h h h',
    },
    // intro bars 3-4: the sun is eaten (the line falls); he rises (the motif)
    I2: {
      p1:    '- - - - - - - - - - - - - - - - | D5 . Eb5 . F#5 . . . G5 F#5 Eb5 . D5 . . .',
      wave:  'Eb5 . . . D5 . . . C5 . . . Bb4 . . . | A4 . . . . . . . . . . . . . . .',
      p2:    'Eb4 G4 Bb4 Eb5 Bb4 G4 Eb4 G4 Bb4 Eb5 Bb4 G4 Eb4 G4 Bb4 G4 | D4 F#4 A4 D5 A4 F#4 D4 F#4 A4 D5 A4 F#4 D4 F#4 A4 F#4',
      tri:   'Eb2 . . . . . . . Eb2 . . . . . . . | D2 . . . D2 . . . D2 . . . D2 . . .',
      noise: 'k - - - - - - - k - - - s - - - | k - h - k - h - k - h - k - s s',
    },
    // intro bar 5: the title hit
    I3: {
      p1:    'D6 . . . . . . . A5 . Bb5 . A5 . G5 F#5',
      p2:    'D5 A4 F#4 D4 - - - - Eb4 - D4 - Eb4 - F#4 -',
      tri:   'D2 . . . . . . . A1 . . . Bb1 . C2 .',
      wave:  'D4 . . . . . . . . . . . . . . .',
      noise: 'k+c - - - - - - - s s - s s s s s',
    },
    // A: D | Eb - the motif (the hungry half-step)
    A: {
      p1:    'D5 . Eb5 . F#5 . . . G5 F#5 Eb5 . D5 . . . | Eb5 . . . G5 . Bb5 . A5 . G5 . F#5 . Eb5 .',
      p2:    'D4 F#4 A4 D5 A4 F#4 D4 F#4 A4 D5 A4 F#4 D4 F#4 A4 F#4 | Eb4 G4 Bb4 Eb5 Bb4 G4 Eb4 G4 Bb4 Eb5 Bb4 G4 Eb4 G4 Bb4 G4',
      tri:   'D2 . D3 . D2 . D3 . D2 . D3 . A1 . C2 . | Eb2 . Eb3 . Eb2 . Eb3 . Eb2 . Eb3 . Bb1 . C2 .',
      noise: 'k - h - s - h k k - h - s - h h | k - h - s - h k k - h - s - h o',
    },
    // B: Cm | D - the answer, home on the dominant-coloured tonic
    B: {
      p1:    'C5 . Eb5 . G5 . . . F#5 . G5 . A5 . . . | D5 . . . . . . . - - F#5 Eb5 D5 . C5 .',
      p2:    'C4 Eb4 G4 C5 G4 Eb4 C4 Eb4 G4 C5 G4 Eb4 C4 Eb4 G4 Eb4 | D4 F#4 A4 D5 A4 F#4 D4 F#4 A4 D5 A4 F#4 D4 F#4 A4 F#4',
      tri:   'C2 . C3 . C2 . C3 . G1 . G2 . G1 . Bb1 . | D2 . D3 . D2 . D3 . A1 . A2 . Bb1 . C2 .',
      noise: 'k - h - s - h k k - h - s - h h | k - h - s - h - k k s - s s s s',
    },
    // break: transitions and re-pulls
    K: {
      wave:  'D4 . . . . . . . . . . . . . . . | Eb4 . . . . . . . D4 . . . . . . .',
      p2:    'D5 - A4 - F#4 - A4 - D5 - A4 - F#4 - A4 - | Eb5 - Bb4 - G4 - Bb4 - D5 - A4 - F#4 - A4 -',
      tri:   'D2 . . . . . . . . . . . . . . . | D2 . . . . . . . A1 . . . . . . .',
      noise: 'k - - - - - - - s - - - - - - - | k - - - - - - - s - - - s - s s',
    },
    // C / D: Day and Night (G minor colour, swung hats)
    C: {
      p1:    'G5 . . . Bb5 . A5 . G5 . F#5 . G5 . D5 . | Eb5 . . . D5 . C5 . Bb4 . A4 . Bb4 . C5 .',
      wave:  'G4 . . . . . . . D4 . . . . . . . | Eb4 . . . . . . . F#4 . . . . . . .',
      p2:    'G4 Bb4 D5 G5 D5 Bb4 G4 Bb4 D5 G5 D5 Bb4 G4 Bb4 D5 Bb4 | Eb4 G4 Bb4 Eb5 Bb4 G4 Eb4 G4 Bb4 Eb5 Bb4 G4 Eb4 G4 Bb4 G4',
      tri:   'G1 . G2 . G1 . G2 . D2 . D3 . D2 . F#2 . | Eb2 . Eb3 . Eb2 . Eb3 . Bb1 . Bb2 . C2 . D2 .',
      noise: 'k - h h s - h - k - h h s - h - | k - h h s - h - k k h h s - o -',
    },
    D: {
      p1:    'D5 . . . Eb5 . F#5 . G5 . A5 . Bb5 . A5 . | G5 . F#5 . Eb5 . D5 . . . . . - - - -',
      wave:  'Bb4 . . . . . . . C5 . . . . . . . | A4 . . . . . . . . . . . . . . .',
      p2:    'D4 F#4 A4 D5 A4 F#4 D4 F#4 A4 D5 A4 F#4 D4 F#4 A4 F#4 | D4 F#4 A4 D5 A4 F#4 D4 F#4 A4 D5 A4 F#4 D4 F#4 A4 F#4',
      tri:   'D2 . D3 . D2 . D3 . C2 . C3 . C2 . C3 . | D2 . D3 . D2 . D3 . A1 . A2 . Bb1 . C2 .',
      noise: 'k - h h s - h - k - h h s - h - | k - h - s - k k s - s s s s s s',
    },
    // S: the Sunbearer - a march; the hats tick like a fuse
    S: {
      p2:    'D5 - D5 - Eb5 - D5 - D5 - D5 - Eb5 - F#5 - | D5 - D5 - Eb5 - D5 - C5 - Bb4 - A4 - Bb4 -',
      wave:  'D4 . . . . . . . . . . . . . . . | Eb4 . . . . . . . . . . . . . . .',
      tri:   'D2 D2 D3 D2 D2 D2 D3 D2 D2 D2 D3 D2 D2 D2 D3 D2 | Eb2 Eb2 Eb3 Eb2 Eb2 Eb2 Eb3 Eb2 D2 D2 D3 D2 A1 A1 C2 C2',
      noise: 'k h h h k h h h k h h h k h s h | k h h h k h h h k h s h k s s s',
    },
    // R: the run into the big hit (bar 2, step 1) - the sun strikes him / the kill
    R: {
      p1:    'D5 Eb5 F#5 G5 A5 Bb5 C6 D6 Eb6 . . . D6 . . . | D6 . . . . . . . . . . . - - - -',
      wave:  'A4 . . . Bb4 . . . C5 . . . Eb5 . . . | D5 . . . . . . . . . . . - - - -',
      p2:    'D4 Eb4 F#4 G4 A4 Bb4 C5 D5 Eb5 . . . D5 . . . | D5 A4 F#4 D4 A3 F#3 D3 - - - - - - - - -',
      tri:   'D2 . D2 . D2 . D2 . Eb2 . Eb2 . C2 . C2 . | D2 . . . . . . . . . . . - - - -',
      noise: 's s s s s s s s s s s s s s s s | k+c - - - - - - - - - - - - - - -',
    },
    // E / F: Sun-Eaten - the motif driving, octave bass
    E: {
      p1:    'D5 . Eb5 . F#5 . . . G5 F#5 Eb5 . D5 . A5 . | Bb5 . . . A5 . G5 . F#5 . G5 . A5 . . .',
      wave:  'D4 . . . . . . . A3 . . . . . . . | Eb4 . . . . . . . D4 . . . . . . .',
      p2:    'D5 A4 F#4 A4 D5 A4 F#4 A4 D5 A4 F#4 A4 D5 A4 F#4 A4 | Eb5 Bb4 G4 Bb4 Eb5 Bb4 G4 Bb4 Eb5 Bb4 G4 Bb4 D5 A4 F#4 A4',
      tri:   'D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 C3 D3 | Eb2 Eb3 Eb2 Eb3 Eb2 Eb3 Eb2 Eb3 D2 D3 D2 D3 A1 A2 C2 C3',
      noise: 'k+c - h k s - h k k - h k s - h h | k - h k s - h k k - h k s - o -',
    },
    F: {
      p1:    'C6 . Bb5 . A5 . G5 . F#5 . . . Eb5 . F#5 . | D5 . . . . . . . - - D5 Eb5 F#5 G5 A5 Bb5',
      wave:  'C4 . . . . . . . G3 . . . . . . . | D4 . . . . . . . . . . . . . . .',
      p2:    'C5 G4 Eb4 G4 C5 G4 Eb4 G4 Bb4 G4 D4 G4 Bb4 G4 D4 G4 | D5 A4 F#4 A4 D5 A4 F#4 A4 D5 A4 F#4 A4 D5 A4 F#4 A4',
      tri:   'C2 C3 C2 C3 C2 C3 C2 C3 G1 G2 G1 G2 G1 G2 Bb1 Bb2 | D2 D3 D2 D3 D2 D3 D2 D3 A1 A2 A1 A2 C2 C3 C2 C3',
      noise: 'k - h k s - h k k - h k s - h h | k - h k s - h k k k s k s s s s',
    },
    // T: the ring-out after the kill
    T: {
      p2:    'D5 - A4 - F#4 - D4 - Eb4 - - - D4 - - - | - - - - - - - - - - - - - - - -',
      wave:  'D4 . . . . . . . . . . . . . . . | . . . . . . . . - - - - - - - -',
      tri:   'D2 . . . . . . . . . . . . . . . | - - - - - - - - - - - - - - - -',
      noise: 'c - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -',
    },
  },
  sections: [
    { name: 'intro', play: ['I1', 'I2', 'I3'], next: 'loopA' },
    { name: 'loopA', play: ['A', 'B', 'A', 'B'], loop: true },
    { name: 'break', play: ['K', 'K'], loop: true },
    { name: 'loopB', play: ['C', 'D', 'C', 'D'], loop: true },
    { name: 'set', play: ['S', 'S'], loop: true },
    { name: 'struck', play: ['R'], next: 'loopC' },
    { name: 'loopC', play: ['E', 'F', 'E', 'F'], loop: true },
    { name: 'loopD', play: ['E+2', 'F+2', 'E+2', 'F+2'], loop: true },
    { name: 'finale', play: ['R'], next: 'tail' },
    { name: 'tail', play: ['T'] },
  ],
};
