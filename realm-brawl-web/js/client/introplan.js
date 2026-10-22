// The launch intro's choreography (hand-authored; client/intro.js plays it, client/introsim.js runs it, tools/intro/build.mjs
// syncs it). Everything is timed on the beat-map of the theme (client/introcues.js):
//   bar  = a downbeat index (CUES.downbeats), beats inside a segment are counted from its first downbeat (24 beats = 6 bars)
//   the stage is the boss's own arena (ENEMIES[boss].arena; Grimtusk: his warcamp; Vorthax: the Rift Sanctum)
//   steps (per hero, in order; a step waits until the hero is free, like a player pressing on the beat):
//     { at: n, k }            press key k ('Q' 'E' 'R' 'F' = G key, 'SP' = the Special, 'T' = ultimate) on beat n
//     { land: n, k, hit }     press k so that the hero's first event matching `hit` lands exactly on beat n
//                             (tools/intro/build.mjs measures the press -> impact time in the real sim, introsync.js keeps it)
//     { at: n, k: 'B', n: 3 } basic attacks until n swings went out
//     { at: n, tgt }          aim at 'boss' (default) or 'pack' (the middle of the living mobs)
//     { at: n, go: [dx, dy] } run to this spot (relative to the scene centre) before anything else
//   climax: the event (any hero) that is the segment's big hit: the frame holds, then hangs in slow motion
//   cam: camera keys { b: beat, z: zoom factor, x / y: offset from the action midpoint (world px), k: lean toward the boss }
// Classic art only: every hero, enemy and effect is the game's own (real sim, real Renderer, real FX).
export const PLAN = {
  // cold open: the realm, one drifting shot per bar (hard cuts on the downbeats: the village, the Wilds, the Dunes,
  // Frostveil, Emberdeep, then the Rift Sanctum under the logo); the logo slams in on bar 3, its line on bar 5, out on bar 6
  open: { bar: 0, end: 7, sub: 'TEN HEROES  ·  ONE REALM',
    shots: [
      { bar: 0, at: [-12720, 120], to: [-12380, -40], z: [0.86, 0.92] },
      { bar: 1, at: [-260, 140], to: [220, 20], z: [0.9, 0.95] },
      { bar: 2, at: [-180, -15980], to: [160, -16060], z: [0.88, 0.94] },
      { bar: 3, at: [-160, 23060], to: [140, 22960], z: [0.86, 0.9] },
      { bar: 4, at: [33150, -560], to: [33420, -700], z: [0.8, 0.86] },
      { bar: 5, at: [-120, 9860], to: [80, 9760], z: [0.72, 0.84] },
    ] },
  segs: [
    { cls: 'warrior', bar: 7, name: 'Brakka', title: "the Warlord", tag: 'Three weapons. One warlord.', sig: "Titanfall Execution",
      foes: [{ type: 'pyrrhex', at: [80, -10], boss: 1 }, { type: 'thrall', at: [-40, -150] }, { type: 'kindler', at: [190, 120] }, { type: 'kindler', at: [-60, 150] }, { type: 'construct', at: [210, -130] }],
      hero: { at: [-170, 30] },
      steps: [{ at: 0, k: 'F' },
        { land: 4, k: 'T', hit: { type: 'wm', fx: 'warlord' } }, { at: 4.5, k: 'R' }, { at: 5.0, k: 'E' }, { at: 5.5, k: 'Q' }, { at: 6.0, k: 'E' },
        { land: 20, k: 'R', hit: { type: 'wmx', ph: 'titan' } }],
      climax: { type: 'wmx', ph: 'titan' },
      cam: [{ b: 0, z: 0.8, x: -260, y: 30 }, { b: 2, z: 1.0 }, { b: 7.5, z: 1.05 }, { b: 8, z: 1.25 }, { b: 9.5, z: 1.0 }, { b: 17, z: 1.05 }, { b: 19.6, z: 1.3 }, { b: 20, z: 1.45 }, { b: 22, z: 1.0 }] },
    { cls: 'ranger', bar: 13, name: 'Sylva', title: "the Hawk's Eye", tag: 'Every arrow finds its mark.', sig: "Heaven's Arrow",
      foes: [{ type: 'thornmaw', at: [170, -20], boss: 1 }, { type: 'wolf', at: [60, -140] }, { type: 'wolf', at: [40, 130] }, { type: 'boar', at: [-10, 10] }, { type: 'wolf', at: [250, 140] }],
      hero: { at: [-300, 40] }, ranged: 1,
      steps: [{ at: 0, tgt: 'pack' }, { at: 1, k: 'Q' }, { at: 2.5, k: 'R' }, { at: 4, k: 'SP' }, { at: 6.5, tgt: 'boss' },
        { land: 8, k: 'T', hit: { type: 'ult' } }, { at: 9, k: 'F' }, { at: 10.5, k: 'E' }, { at: 12, k: 'F' }, { at: 13.5, k: 'E' },
        { land: 20, k: 'Q', hit: { type: 'fin', ph: 'release' } }],
      climax: { type: 'fin', ph: 'release' },
      cam: [{ b: 0, z: 0.85, x: 120, y: -160 }, { b: 3, z: 0.95 }, { b: 8, z: 1.15 }, { b: 10, z: 1.0 }, { b: 18, z: 1.1 }, { b: 20, z: 1.4 }, { b: 22.5, z: 1.0 }] },
    { cls: 'mage', bar: 19, name: 'Orin', title: "the Starbreaker", tag: 'Bend the stars. Break the sky.', sig: 'Singularity',
      foes: [{ type: 'skaldra', at: [180, -10], boss: 1 }, { type: 'yeti', at: [60, -150] }, { type: 'penguin', at: [20, 120] }, { type: 'penguin', at: [-30, -40] }, { type: 'shardwisp', at: [260, 140] }],
      hero: { at: [-280, 20] }, ranged: 1,
      steps: [{ at: 0, tgt: 'pack' }, { at: 1, k: 'Q' }, { at: 2.5, k: 'F' }, { at: 4, k: 'E' }, { at: 6, tgt: 'boss' },
        { land: 8, k: 'T', hit: { type: 'ult' } }, { at: 9, k: 'E' }, { at: 10.5, k: 'R' }, { at: 12, k: 'F' }, { at: 13.5, k: 'E' },
        { land: 20, k: 'R', hit: { type: 'fin', ph: 'collapse' } }],
      climax: { type: 'fin', ph: 'collapse' },
      cam: [{ b: 0, z: 0.8, x: 0, y: 200 }, { b: 3, z: 1.0 }, { b: 8, z: 1.15 }, { b: 10, z: 1.0 }, { b: 18, z: 1.1 }, { b: 20, z: 1.45 }, { b: 22.5, z: 1.0 }] },
    { cls: 'cleric', bar: 25, name: 'Cassius', title: "Hammer of Dawn", tag: 'Shield of the faithful. Hammer of dawn.', sig: "Heaven's Judgment",
      foes: [{ type: 'sekhem', at: [110, -20], boss: 1 }, { type: 'jackal', at: [-20, -140] }, { type: 'mummy', at: [-40, 130] }, { type: 'jackal', at: [210, 140] }],
      hero: { at: [-170, 30] },
      steps: [{ at: 0.5, k: 'Q' }, { at: 2, k: 'E' }, { at: 3.5, k: 'R' },
        { land: 8, k: 'T', hit: { type: 'ult' } }, { at: 9, k: 'Q' }, { at: 10.5, k: 'R' }, { at: 12, k: 'E' }, { at: 13.5, k: 'Q' },
        { land: 20, k: 'F', hit: { type: 'fin', ph: 'impact' } }],
      climax: { type: 'fin', ph: 'impact' },
      cam: [{ b: 0, z: 0.85, x: -200, y: -120 }, { b: 3, z: 1.0 }, { b: 8, z: 1.2 }, { b: 10, z: 1.0 }, { b: 18, z: 1.1 }, { b: 20, z: 1.4 }, { b: 22.5, z: 1.0 }] },
    { cls: 'bard', bar: 31, name: 'Lana', title: "the Last Encore", tag: 'Every song is a war cry.', sig: 'Death Knell',
      foes: [{ type: 'ashfang', at: [190, -10], boss: 1 }, { type: 'wolf', at: [80, -140] }, { type: 'wolf', at: [60, 130] }, { type: 'goblin', at: [20, 0] }],
      hero: { at: [-250, 20] }, ranged: 1,
      allies: [{ cls: 'warrior', at: [-40, -110], name: 'Brakka' }, { cls: 'cleric', at: [-60, 120], name: 'Cassius' }],
      steps: [{ at: 0, tgt: 'pack' }, { at: 1, k: 'E' }, { at: 2, k: 'Q' }, { at: 3, k: 'E' }, { at: 4, k: 'R' }, { at: 6, tgt: 'boss' },
        { land: 8, k: 'T', hit: { type: 'arcx', look: 'encore' } }, { at: 9, k: 'R' }, { at: 10.5, k: 'E' }, { at: 12, k: 'Q' }, { at: 13.5, k: 'E' },
        { land: 20, k: 'R', hit: { type: 'arcx', look: 'knell' } }],
      climax: { type: 'arcx', look: 'knell' },
      cam: [{ b: 0, z: 0.85, x: -150, y: 150 }, { b: 3, z: 1.0 }, { b: 8, z: 1.15 }, { b: 10, z: 1.0 }, { b: 18, z: 1.1 }, { b: 20, z: 1.4 }, { b: 22.5, z: 1.0 }] },
    { cls: 'summoner', bar: 37, name: 'Mirelle', title: "Keeper of the Grimoire", tag: 'Every page is a beast.', sig: 'The Final Chapter',
      foes: [{ type: 'ankhara', at: [200, -20], boss: 1 }, { type: 'scarab', at: [90, -140] }, { type: 'scarab', at: [70, 140] }, { type: 'mummy', at: [20, -10] }],
      hero: { at: [-260, 20] }, ranged: 1,
      steps: [{ at: 0, tgt: 'pack' }, { at: 0, k: 'SP' }, { at: 3, tgt: 'boss' },
        { land: 4, k: 'T', hit: { type: 'arcx', look: 'unbound' } }, { at: 5, k: 'R' }, { at: 7, k: 'E' }, { at: 9.5, k: 'Q' }, { at: 12, k: 'E' },
        { land: 20, k: 'R', hit: { type: 'arcx', look: 'bookslam' } }],
      climax: { type: 'arcx', look: 'bookslam' },
      cam: [{ b: 0, z: 0.8, x: 160, y: 160 }, { b: 3, z: 1.0 }, { b: 8, z: 1.15 }, { b: 10, z: 1.0 }, { b: 14, z: 1.1 }, { b: 16, z: 1.4 }, { b: 19, z: 1.0 }] },
    { cls: 'monk', bar: 43, name: 'Tenzo', title: "the Open Palm", tag: 'A hundred fists. One open palm.', sig: 'Heaven-Splitting Palm',
      foes: [{ type: 'boss', at: [100, -20], boss: 1 }, { type: 'knight', at: [-10, -150] }, { type: 'goblin', at: [-30, 140] }, { type: 'goblin', at: [220, 130] }],
      hero: { at: [-170, 30] },
      steps: [{ at: 0, k: 'E' }, { at: 1, k: 'F' },
        { land: 4, k: 'T', hit: { type: 'monk', fx: 'spiritslam' } }, { at: 4.5, k: 'R' }, { at: 5.0, k: 'E' }, { at: 5.5, k: 'Q' }, { at: 6.0, k: 'E' },
        { land: 20, k: 'R', hit: { type: 'monkx', ph: 'heaven' } }],
      climax: { type: 'monkx', ph: 'heaven' },
      cam: [{ b: 0, z: 0.85, x: -220, y: 120 }, { b: 3, z: 1.0 }, { b: 8, z: 1.25 }, { b: 10, z: 1.0 }, { b: 17, z: 1.1 }, { b: 20, z: 1.45 }, { b: 22.5, z: 1.0 }] },
    { cls: 'bladedancer', bar: 49, name: 'Kage', title: "the Silent Mark", tag: 'Mark them. Vanish. Strike.', sig: 'Crescent Execution',
      foes: [{ type: 'vyrnhal', at: [120, -20], boss: 1 }, { type: 'rimewraith', at: [0, -150], hp: 6 }, { type: 'acolyte', at: [-20, 140], hp: 6 }, { type: 'rimewraith', at: [240, 140], hp: 6 }], // (tough: Backstab crits would clear the pack before the clones / marks show)
      hero: { at: [-80, 40] }, // (close to the pack: Shadow Clone's burst catches it)
      // (each Thousand Cuts in the route is ~4 beats of cuts and the Crescent dash ~3: Vanish -> Shadow Clone -> Clone Barrage opens,
      // Eclipse lands on beat 4 and the boss route R F E F E fills the rest, every step copied by the clones)
      steps: [{ at: 0.25, k: 'R' }, { at: 1, k: 'SP' }, { at: 1.4, k: 'Q' },
        { land: 4, k: 'T', hit: { type: 'ult' } }, { at: 4.5, k: 'R' }, { at: 4.8, k: 'F' }, { at: 8.5, k: 'E' }, { at: 10, k: 'F' },
        { land: 20, k: 'E', hit: { type: 'crescentImpact' } }],
      climax: { type: 'crescentImpact' },
      cam: [{ b: 0, z: 0.85, x: 200, y: -140 }, { b: 2, z: 1.05 }, { b: 4, z: 1.2 }, { b: 6, z: 1.0 }, { b: 17, z: 1.1 }, { b: 20, z: 1.45 }, { b: 22.5, z: 1.0 }] },
    { cls: 'dragoon', bar: 55, name: 'Varek', title: "the Dragon's Fall", tag: 'Leap high. Fall like a dragon.', sig: "Nidhogg's Fall",
      foes: [{ type: 'solgrim', at: [110, -20], boss: 1 }, { type: 'basalt', at: [0, -150] }, { type: 'kindler', at: [-20, 140] }, { type: 'kindler', at: [230, 140] }],
      hero: { at: [-200, 30] },
      steps: [{ at: 0, k: 'SP' },
        { land: 4, k: 'T', hit: { type: 'drg', fx: 'formslam' } }, { at: 4.5, k: 'R' }, { at: 5.0, k: 'E' }, { at: 5.5, k: 'Q' }, { at: 6.0, k: 'E' },
        { land: 20, k: 'R', hit: { type: 'drgx', ph: 'nidhogg' } }],
      climax: { type: 'drgx', ph: 'nidhogg' },
      cam: [{ b: 0, z: 0.85, x: -160, y: -160 }, { b: 3, z: 1.0 }, { b: 8, z: 1.2 }, { b: 10, z: 1.0 }, { b: 17, z: 1.05 }, { b: 20, z: 1.45 }, { b: 22.5, z: 1.0 }] },
    { cls: 'samurai', bar: 61, name: 'Hayate', title: "the Perfect Cut", tag: 'One draw. One perfect cut.', sig: 'One Perfect Cut',
      foes: [{ type: 'morwen', at: [110, -20], boss: 1 }, { type: 'penguin', at: [10, -150] }, { type: 'gift', at: [-20, 140] }, { type: 'iceknight', at: [230, 140] }],
      hero: { at: [-170, 30] },
      steps: [{ at: 0, k: 'Q' },
        { land: 4, k: 'T', hit: { type: 'sam', fx: 'void' } }, { at: 4.5, k: 'R' }, { at: 5.0, k: 'E' }, { at: 5.5, k: 'Q' }, { at: 6.0, k: 'E' },
        { land: 20, k: 'R', hit: { type: 'samx', ph: 'split' } }],
      climax: { type: 'samx', ph: 'split' },
      cam: [{ b: 0, z: 0.85, x: 180, y: 140 }, { b: 3, z: 1.0 }, { b: 8, z: 1.2 }, { b: 10, z: 1.0 }, { b: 17, z: 1.1 }, { b: 20, z: 1.45 }, { b: 22.5, z: 1.0 }] },
  ],
  // the finale: all ten on the Rift Sanctum around Vorthax. They drop in one per beat through the breakdown, light their
  // ultimates on the build and every Special lands on the drop; the frame hangs and the logo slams in on the bass stab.
  finale: { bar: 67, end: 75, name: 'Realm Brawl', line: 'CHOOSE YOUR HERO',
    foes: [{ type: 'raidboss', at: [0, -10], boss: 1 }],
    ring: 290, appear0: 1, // hero i drops in on beat appear0 + i
    ultAt: 'build', dropAt: 'drop',
    order: ['warrior', 'ranger', 'mage', 'cleric', 'bard', 'summoner', 'monk', 'bladedancer', 'dragoon', 'samurai'],
    spHit: { warrior: { type: 'spx', ph: 'impact' }, ranger: { type: 'areaHit', kind: 'arrowstorm', pulse: 0 }, mage: { type: 'areaHit', kind: 'meteor' }, cleric: { type: 'spx', ph: 'impact' }, bladedancer: { type: 'spx', ph: 'impact' },
      samurai: { type: 'spx', ph: 'impact' }, monk: { type: 'spx', ph: 'impact' }, dragoon: { type: 'drg', fx: 'breath0' }, summoner: { type: 'arcx', look: 'krakencrush' }, bard: { type: 'arcx', look: 'crescendo' } },
  },
};
