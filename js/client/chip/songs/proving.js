// "Proving Grounds" - the Part 0 demo / test theme for the encounter music system (composed in-repo; edit freely, see docs/CHIP-SONGS.md).
// D minor, 150 BPM. Sections: intro -> loopA (loops until the fight asks) -> break -> loopB (loops) -> run (the big moment; flows back into loopB) ... tail (go('tail') on the kill).
// One token = one 16th note. '.' holds the previous note, '-' is a rest. Drums: k kick, s snare, h hat, o open hat, c crash ('+' = together).
export default {
  id: 'proving', title: 'Proving Grounds', bpm: 150, steps: 4, bar: 16, key: 'D minor',
  inst: { p1: { duty: 0.25 }, p2: { duty: 0.125 }, wave: { vol: 0.11 } },
  fx: { echoFb: 0.3, gain: 1 },
  patterns: {
    // intro: the arpeggio and bass alone, a kick on the downbeats
    I: {
      p2:    'D4 F4 A4 D5 A4 F4 D4 F4 A4 D5 A4 F4 D4 F4 A4 F4 | Bb3 D4 F4 Bb4 F4 D4 Bb3 D4 F4 Bb4 F4 D4 Bb3 D4 F4 D4',
      tri:   'D2 . . . . . . . D2 . . . . . . . | Bb1 . . . . . . . Bb1 . . . . . . .',
      noise: 'k - - - - - - - k - - - - - - - | k - - - - - - - k - - - s - s s',
    },
    // A: Dm | Bb, the main theme on pulse 1
    A: {
      p1:    'D5 . . . A4 . D5 . E5 . F5 . . . E5 D5 | F5 . . . . . D5 . Bb4 . . . C5 . D5 .',
      p2:    'D4 F4 A4 D5 A4 F4 D4 F4 A4 D5 A4 F4 D4 F4 A4 F4 | Bb3 D4 F4 Bb4 F4 D4 Bb3 D4 F4 Bb4 F4 D4 Bb3 D4 F4 D4',
      tri:   'D2 . D3 . D2 . D3 . D2 . D3 . A2 . C3 . | Bb1 . Bb2 . Bb1 . Bb2 . Bb1 . Bb2 . F2 . A2 .',
      noise: 'k+c - h - s - h - k k h - s - h h | k - h - s - h - k k h - s - h h',
    },
    // B: C | A (the turnaround; ends on the dominant)
    B: {
      p1:    'E5 . . . G5 . E5 . C5 . . . D5 . E5 . | C#5 . . . . . . . E5 . . . . . . .',
      p2:    'C4 E4 G4 C5 G4 E4 C4 E4 G4 C5 G4 E4 C4 E4 G4 E4 | A3 C#4 E4 A4 E4 C#4 A3 C#4 E4 A4 E4 C#4 A3 C#4 E4 C#4',
      tri:   'C2 . C3 . C2 . C3 . C2 . C3 . G2 . Bb2 . | A1 . A2 . A1 . A2 . A1 . A2 . C#3 . E3 .',
      noise: 'k - h - s - h - k k h - s - h h | k - h - s - h - k - s s s s s s',
    },
    // break: the floor drops out - pedal bass, pad on the wave channel, half-time kick
    K: {
      wave:  'D4 . . . . . . . . . . . . . . . | F4 . . . . . . . E4 . . . . . . .',
      p2:    'D5 - A4 - F4 - A4 - D5 - A4 - F4 - A4 - | D5 - Bb4 - F4 - Bb4 - C5 - A4 - E4 - A4 -',
      tri:   'D2 . . . . . . . . . . . . . . . | D2 . . . . . . . A1 . . . . . . .',
      noise: 'k - - - - - - - - - - - s - - - | k - - - - - - - k - k - s s s s',
    },
    // C / D: the climax - the theme an octave up, the wave lead doubles below
    C: {
      p1:    'A5 . . . G5 . F5 . E5 . F5 . G5 . A5 . | Bb5 . . . A5 . G5 . F5 . . . G5 . A5 .',
      wave:  'D5 . . . A4 . D5 . E5 . F5 . . . E5 D5 | F5 . . . . . D5 . Bb4 . . . C5 . D5 .',
      p2:    'D4 F4 A4 D5 A4 F4 D4 F4 A4 D5 A4 F4 D4 F4 A4 F4 | Bb3 D4 F4 Bb4 F4 D4 Bb3 D4 F4 Bb4 F4 D4 Bb3 D4 F4 D4',
      tri:   'D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 A2 . C3 . | Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 F2 . A2 .',
      noise: 'k+c - h k s - h - k k h - s - h h | k - h k s - h - k k h - s - h o',
    },
    D: {
      p1:    'G5 . . . F5 . E5 . C5 . E5 . G5 . C6 . | A5 . . . . . . . C#6 . . . E6 . . .',
      wave:  'E5 . . . G5 . E5 . C5 . . . D5 . E5 . | C#5 . . . . . . . E5 . . . . . . .',
      p2:    'C4 E4 G4 C5 G4 E4 C4 E4 G4 C5 G4 E4 C4 E4 G4 E4 | A3 C#4 E4 A4 E4 C#4 A3 C#4 E4 A4 E4 C#4 A3 C#4 E4 C#4',
      tri:   'C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 G2 . Bb2 . | A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 C#3 . E3 .',
      noise: 'k - h k s - h - k k h - s - h h | k - s - k - s - s s s s s s s s',
    },
    // run: the climb into the big hit (cinematic cue: the hit lands on bar 2, step 1)
    R: {
      p1:    'D5 E5 F5 G5 A5 Bb5 C6 C#6 D6 . . . . . . . | D6 . . . . . . . . . . . - - - -',
      wave:  'A4 . . . C5 . . . E5 . . . F5 . . . | D5 . . . . . . . . . . . - - - -',
      p2:    'D4 E4 F4 G4 A4 Bb4 C5 C#5 D5 . . . . . . . | D5 A4 F4 D4 A3 F3 D3 - - - - - - - - -',
      tri:   'D2 . D2 . D2 . D2 . A1 . A1 . A1 . C#2 . | D2 . . . . . . . . . . . - - - -',
      noise: 's s s s s s s s s s s s s s s s | k+c - - - - - - - - - - - - - - -',
    },
    // tail: the ring-out after the kill
    T: {
      p2:    'D5 - A4 - F4 - D4 - - - - - - - - - | - - - - - - - - - - - - - - - -',
      tri:   'D2 . . . . . . . . . . . . . . . | - - - - - - - - - - - - - - - -',
      noise: 'c - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - -',
    },
  },
  sections: [
    { name: 'intro', play: ['I', 'I'], next: 'loopA' },
    { name: 'loopA', play: ['A', 'B', 'A', 'B'], loop: true },
    { name: 'break', play: ['K', 'K'], next: 'loopB' },
    { name: 'loopB', play: ['C', 'D', 'C', 'D'], loop: true },
    { name: 'run', play: ['R'], next: 'loopB' },
    { name: 'tail', play: ['T'] },
  ],
};
