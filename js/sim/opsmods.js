// Missions revamp, part 1 (2026-10-08): the SHARED mission framework (pure tables + maths; runtime in sim/ops.js +
// sim/opshaz.js, art in client/missionfx.js).
//  - biome theming: each map's missions get their own hazard + look + build material
//      The Wilds  Thornbloom    bramble patches burst out of the floor: they cut and snare anything standing in them
//      Dunes      Sandstorm     dust devils whirl up and fling whoever stands in them; storms darken the arena
//      Frostveil  Blizzard      icicles fall from the whiteout; storms turn the arena white
//      Emberdeep  Lava Vents    vents erupt and leave lava pools behind; storms rain cinders
//    Hazards hurt ENEMIES too (lure the crowd in). Percent-of-max-HP damage on heroes (level independent), always
//    telegraphed, never on the Defense relic. Live in Defense + Swarm now (step 1); the other three types get them when
//    they are revamped.
//  - mission grades: every mission ends with an S / A / B / C grade from a 100-point score (objective, survival, speed
//    + a per-type mastery line); the grade scales the rewards (S x1.5 .. C x0.8). A failed mission is capped at C.
//  - weekly modifiers: one twist (harder, +reward) and one boon rotate every Monday 00:00 UTC, the same for everyone
//    (pure function of the date; the server stamps them on the run so co-op clients agree).
const secs = (s) => Math.round(s * 60);

// ------------------------------------------------------------------ biome theming + hazards
/** per biome: hazard name / blurb / colours, the strike (telegraph -> hit), the storm cycle, the Defense build material */
export const OPS_HAZ = {
  wilds: { id: 'thorns', name: 'Thornbloom', storm: 'Wild Growth', desc: 'Bramble patches burst from the floor: they cut and snare whatever stands in them, enemies included.',
    col: '#9cff5a', col2: '#ff6fb5', mat: 'Heartwood', matCol: '#c88a4a',
    strike: { r: 115, delay: secs(1.3), pulses: 1, every: 1, pct: 0.07, stun: secs(0.55), kb: 0, n: 2, foe: 0.3 },
    every: secs(6.5), stormEvery: secs(48), stormT: secs(12), stormMul: 2.2, first: secs(14) },
  dunes: { id: 'sandstorm', name: 'Sandstorm', storm: 'Sandstorm', desc: 'Dust devils whirl up and fling whoever stands in them; when the storm rolls in the arena goes dark with sand.',
    col: '#ffcf6a', col2: '#c8823a', mat: 'Sunglass', matCol: '#ffe08a',
    strike: { r: 105, delay: secs(1.2), pulses: 4, every: 22, pct: 0.035, stun: 0, kb: 300, n: 2, foe: 0.12 },
    every: secs(7), stormEvery: secs(50), stormT: secs(12), stormMul: 2.4, first: secs(15) },
  frost: { id: 'blizzard', name: 'Blizzard', storm: 'Whiteout', desc: 'Icicles drop out of the blizzard; when the whiteout hits, the arena turns white and they fall twice as fast.',
    col: '#bfefff', col2: '#6ec8ff', mat: 'Rime Shards', matCol: '#9ee6ff',
    strike: { r: 88, delay: secs(1.1), pulses: 1, every: 1, pct: 0.09, stun: 0, kb: 140, n: 3, foe: 0.35 },
    every: secs(6), stormEvery: secs(46), stormT: secs(11), stormMul: 2.2, first: secs(13) },
  ember: { id: 'lava', name: 'Lava Vents', storm: 'Cinder Rain', desc: 'Vents crack open and erupt, leaving lava pools behind; cinder rain doubles the eruptions.',
    col: '#ff8a3a', col2: '#ffd23f', mat: 'Cinder Cores', matCol: '#ff9a4a',
    strike: { r: 110, delay: secs(1.5), pulses: 7, every: 30, pct: 0.03, stun: 0, kb: 120, n: 2, foe: 0.1, burst: 0.07 },
    every: secs(7), stormEvery: secs(50), stormT: secs(12), stormMul: 2.2, first: secs(15) },
  rift: { id: 'starfall', name: 'Starfall', storm: 'Meteor Shower', desc: 'Stars fall out of the torn sky and burst where they land; the meteor shower doubles them.', // (game loop C3)
    col: '#c9a8ff', col2: '#ffe27a', mat: 'Riftglass', matCol: '#b48cff',
    strike: { r: 96, delay: secs(1.2), pulses: 1, every: 1, pct: 0.085, stun: secs(0.3), kb: 200, n: 3, foe: 0.3 },
    every: secs(6.5), stormEvery: secs(48), stormT: secs(11), stormMul: 2.2, first: secs(14) },
};
/** mission types that run the biome hazards (step 1: the two revamped ones) */
export const HAZ_TYPES = new Set(['defense', 'swarm', 'mobile', 'assault', 'capture']);
/** hazard damage on enemies: share of the mob's max HP per hit, by rank */
export const HAZ_FOE = { fodder: 1, elite: 0.16, boss: 0.025 };

// ------------------------------------------------------------------ weekly modifiers
export const WEEKLY = {
  // twists (harder: +reward)
  fortified: { name: 'Fortified', kind: 'twist', bonus: 0.15, icon: 'shield', desc: 'Elites have +30% HP and one more joins each wave.' },
  frenzy: { name: 'Frenzy', kind: 'twist', bonus: 0.1, icon: 'bolt', desc: 'Enemies move 20% faster.' },
  volatile: { name: 'Volatile', kind: 'twist', bonus: 0.15, icon: 'burst', desc: 'Fallen enemies burst a moment later: step out of the ring.' },
  stormy: { name: 'Storm Season', kind: 'twist', bonus: 0.1, icon: 'storm', desc: 'Biome hazards strike 60% more often.' },
  ironhide: { name: 'Iron Hide', kind: 'twist', bonus: 0.15, icon: 'armor', desc: 'Every enemy has +20% HP.' },
  // boons
  bounty: { name: 'Bounty', kind: 'boon', bonus: 0.1, icon: 'coin', desc: '+30% mission materials, bigger loot showers.' },
  overcharge: { name: 'Overcharge', kind: 'boon', bonus: 0, icon: 'spark', desc: 'The Defense relic charges 50% faster; the Swarm combo lasts 50% longer; Mobile Defense hacks run 25% faster.' },
  trophy: { name: 'Trophy Hunt', kind: 'boon', bonus: 0, icon: 'crown', desc: 'Every elite bursts into a bonus loot shower.' },
  secondwind: { name: 'Second Wind', kind: 'boon', bonus: 0, icon: 'heart', desc: 'Respawn in 2 s; the Swarm gives one extra life.' },
};
const TWISTS = ['fortified', 'frenzy', 'volatile', 'stormy', 'ironhide'], BOONS = ['bounty', 'overcharge', 'trophy', 'secondwind'];
export const WEEK0 = Date.UTC(2026, 0, 5); // a Monday, 00:00 UTC
const WEEK = 7 * 864e5;
export const weekIndex = (ms) => Math.floor((ms - WEEK0) / WEEK);
/** this week's modifiers: { week, ids: [twist, boon], ends (ms) }. Pure: the same everywhere for the same date. */
export function weeklyMods(ms = Date.now()) {
  const w = weekIndex(ms), m = (a, n) => ((a % n) + n) % n;
  return { week: w, ids: [TWISTS[m(w * 2 + 1, TWISTS.length)], BOONS[m(w, BOONS.length)]], ends: WEEK0 + (w + 1) * WEEK };
}
/** the weekly reward bonus of a modifier list (sum of the twists' / boons' bonus) */
export const modBonus = (ids) => (ids || []).reduce((s, k) => s + ((WEEKLY[k] && WEEKLY[k].bonus) || 0), 0);
export const hasMod = (O, k) => !!(O && O.mods && O.mods.includes(k));

// ------------------------------------------------------------------ grades
/** [letter, min score, reward x, colour] best first */
export const GRADES = [['S', 90, 1.5, '#ffd23f'], ['A', 75, 1.25, '#7dffb0'], ['B', 55, 1, '#6ec8ff'], ['C', 0, 0.8, '#d2c2e6']];
export const gradeOf = (score, failed = false) => { const g = GRADES.find((r) => score >= r[1]) || GRADES[3]; return failed && g[0] !== 'C' ? GRADES[3] : g; };
/** par times (seconds) for the speed line of the non-revamped types */
export const PAR = { mobile: [300, 540], assault: [200, 390], capture: [240, 450] }; // (mobile: re-checked against realistic 5-6 min runs, missions part 3)
const lin = (v, good, bad) => Math.max(0, Math.min(1, (bad - v) / (bad - good)));
/**
 * The 100-point score of a finished mission. s: the run's stats (sim/ops.js gradeStats):
 *  defense: { avgRelic (0-100), deaths, waves, avgWaveS, pulsesGood, builds }
 *  swarm:   { queen (bool), waves, wavesMax, deaths, best (combo), secs }
 *  mobile:  { clear, part, deaths, secs, cart (average carrier %), hunt (s to kill the hunter squad | null) }
 *  assault: { clear, part, deaths, secs, traps (trap hits a hero), pylons (s to break the pylons | null) }
 *  capture: { clear, part, deaths, secs, track (s to read the 3 clues | null), clock (escape-clock s left when cornered | null), snares (snare hits a hero) }
 *  others:  { clear (bool), part (0-1 objective done), deaths, secs }
 * Returns { score, lines: [[label, points, max, note]] }.
 */
export function missionScore(type, s, failed = false) {
  const L = [];
  const add = (label, pts, max, note = '') => L.push([label, Math.round(Math.max(0, Math.min(max, pts))), max, note]);
  if (type === 'defense') {
    add('Relic integrity', 40 * (s.avgRelic / 100), 40, `${Math.round(s.avgRelic)}% average`);
    add('Survival', 20 - 7 * s.deaths, 20, s.deaths ? `${s.deaths} fall${s.deaths === 1 ? '' : 's'}` : 'no falls');
    add('Wave speed', 20 * lin(s.avgWaveS, 30, 70), 20, `${Math.round(s.avgWaveS)} s a wave`);
    add('Relic pulses', 5 * s.pulsesGood, 10, `${s.pulsesGood} big pulse${s.pulsesGood === 1 ? '' : 's'}`);
    add('Defenses', 2.5 * s.builds, 10, `${s.builds} built / upgraded`);
  } else if (type === 'swarm') {
    add(s.queen ? 'Swarm Queen slain' : 'Waves cleared', s.queen ? 40 : 30 * (s.waves / Math.max(1, s.wavesMax)), 40, s.queen ? 'the brood is broken' : `${s.waves}/${s.wavesMax} waves`);
    add('Survival', 20 - 7 * s.deaths, 20, s.deaths ? `${s.deaths} fall${s.deaths === 1 ? '' : 's'}` : 'no falls');
    add('Best combo', 25 * Math.min(1, s.best / 75), 25, `x${s.best}`);
    add('Speed', s.queen ? 15 * lin(s.secs, 270, 450) : 0, 15, `${Math.floor(s.secs / 60)}:${String(Math.round(s.secs % 60)).padStart(2, '0')}`);
  } else if (type === 'mobile' || type === 'assault') {
    const P = PAR[type], mm = `${Math.floor(s.secs / 60)}:${String(Math.round(s.secs % 60)).padStart(2, '0')}`;
    add('Objective', s.clear ? 40 : 30 * (s.part || 0), 40, s.clear ? 'complete' : `${Math.round((s.part || 0) * 100)}%`);
    if (type === 'mobile') add('Carrier integrity', 20 * ((s.cart ?? 100) / 100), 20, `${Math.round(s.cart ?? 100)}% average`);
    add('Survival', 15 - 5 * s.deaths, 15, s.deaths ? `${s.deaths} fall${s.deaths === 1 ? '' : 's'}` : 'no falls');
    add('Speed', s.clear ? 15 * lin(s.secs, P[0], P[1]) : 0, 15, mm);
    if (type === 'mobile') add('Hunter squad', s.hunt != null ? 10 * lin(s.hunt, 25, 75) : 0, 10, s.hunt != null ? `down in ${Math.round(s.hunt)} s` : 'not stopped');
    else {
      add('Traps', 15 - 2 * (s.traps || 0), 15, s.traps ? `${s.traps} trap hit${s.traps === 1 ? '' : 's'}` : 'untouched');
      add('Pylons', s.pylons != null ? 15 * lin(s.pylons, 35, 95) : 0, 15, s.pylons != null ? `down in ${Math.round(s.pylons)} s` : 'still up');
    }
  } else if (type === 'capture') {
    const P = PAR.capture, mm = `${Math.floor(s.secs / 60)}:${String(Math.round(s.secs % 60)).padStart(2, '0')}`;
    add('Objective', s.clear ? 35 : 28 * (s.part || 0), 35, s.clear ? 'captured' : `${Math.round((s.part || 0) * 100)}%`);
    add('Survival', 15 - 5 * s.deaths, 15, s.deaths ? `${s.deaths} fall${s.deaths === 1 ? '' : 's'}` : 'no falls');
    add('Speed', s.clear ? 15 * lin(s.secs, P[0], P[1]) : 0, 15, mm);
    add('Tracking', s.track != null ? 10 * lin(s.track, 45, 110) : 0, 10, s.track != null ? `clues read in ${Math.round(s.track)} s` : 'trail lost');
    add('Escape clock', s.clock != null ? 10 * Math.min(1, s.clock / 50) : 0, 10, s.clock != null ? `${Math.round(s.clock)} s to spare` : 'not cornered');
    add('Snares', 15 - 3 * (s.snares || 0), 15, s.snares ? `${s.snares} snare${s.snares === 1 ? '' : 's'} sprung` : 'untouched');
  } else {
    const P = PAR[type] || [120, 300];
    add('Objective', s.clear ? 50 : 35 * (s.part || 0), 50, s.clear ? 'complete' : `${Math.round((s.part || 0) * 100)}%`);
    add('Survival', 25 - 8 * s.deaths, 25, s.deaths ? `${s.deaths} fall${s.deaths === 1 ? '' : 's'}` : 'no falls');
    add('Speed', s.clear ? 25 * lin(s.secs, P[0], P[1]) : 0, 25, `${Math.floor(s.secs / 60)}:${String(Math.round(s.secs % 60)).padStart(2, '0')}`);
  }
  const score = L.reduce((a, l) => a + l[1], 0);
  return { score, lines: L, failed: !!failed };
}
/** the grade record a mission ends with: { g, score, mul (grade x weekly bonus), gmul, bonus, col, lines } */
export function gradeRecord(type, stats, failed, mods) {
  const S = missionScore(type, stats, failed), G = gradeOf(S.score, failed), bonus = modBonus(mods);
  return { g: G[0], score: S.score, gmul: G[2], bonus, mul: Math.round(G[2] * (1 + bonus) * 100) / 100, col: G[3], lines: S.lines };
}
