// Neferakh Unbound: Trial + Extreme (encounter revamp Part 1, docs/ENCOUNTER-REVAMP-PLAN.md). The Sun-Eaten King swallowed the sun three
// thousand years ago; unsealed, he spends its light. Every mechanic is designed from an INTENT (the moment / skill it tests), not copied:
//   SOLAR HAMMER   a fist of sunlight lands on each of you in 3 beats (the slam-beat model): one roll covers one beat, so WALK out. (dodge matters, spam doesn't)
//   SANDGLASS      four hourglasses number the throne's quarters 1-4; they bury in that order. Read the order, then chase the sand: the quarter
//                  that just buried is the safe one. (read a sequence, commit to a plan) - a position check
//   SCARAB TIDE    the tide sweeps the throne in waves; the golden scarab rides the one gap and its arrow shows where the gap goes next. (track a moving safe lane)
//   SUNDIAL        his staff casts a gnomon of shade that sweeps round the throne; outside it the noon light burns. Walk with the shade and keep
//                  hitting. The Extreme reverses the dial halfway (the arrow flips first). (sustained movement + uptime)
//   HEART / FEATHER every hero gets a mark on the scales: HEART = heavy, stand close to him; FEATHER = light, stand far out. Read YOUR mark. The
//                  Extreme tips the scales once (the marks swap with a warning). (own your role; a party splits)
//   DAWN / DUSK    the sun flares round him (get out), then night falls everywhere but his shadow (get in) - or the reverse; the card says which first.
//   DEVOUR         he inhales: everyone is dragged toward him, then his gullet slams in 3 beats. Walk against the current, save a movement skill. (fight the pull)
//   CARTOUCHE      he writes 3 glyphs (4 in the Extreme) in his cartouche, one a second, then they fade; they resolve in the order written
//                  (SUN out, MOON in, SCARAB = the cross lanes through him: stand on a diagonal). Memory gives you a head start; each glyph still
//                  shows its floor 1 s before it lands. (memory under pressure)
// Set piece + cinematic moments (gameplay, the fight never pauses; sim/setpiece.js):
//   THE SKY TURNS  (66%, Trial + Extreme) he leaps to the rim, the sky flips to night and he lands back on the throne: a 4 s respite + heal.
//   SUNBEARER      (33%) he tears the sun out of the sky. One hero catches it and must carry it to the Sun Altar across the throne - slowed, no
//                  dodge, no attacks - while the Sand Wardens sweep sand across the route (a hit knocks the sun from your arms). The rest break
//                  the Wardens or hand the sun on (touch the bearer). Delivered = the sky reignites and he is SUN-STRUCK (+25% damage taken, 8 s);
//                  the sun's fuse runs out = it bursts (wipe). (one shoulders the responsibility while the team clears the way)
//   THE BLACK SUN  (Extreme, 12%) the sun goes out: the last light wanders the throne for 100 s.
//   The pull is a 9.1 s music-synced intro (5 bars of "Sun-Eaten Throne" at 132 BPM): the seal cracks, sand pours up, the sun is eaten, he rises, title.
// Rules (encounter revamp): tells >= 1.0 s, solves >= 3 s, position checks ignore dodge i-frames (pos: 1), big slams land in 3 beats, no pseudo-difficulty.
import { SLAM_BEATS } from './combat.js';

const TAU = Math.PI * 2;
/** tuning (ticks at 60/s; pct = share of max HP) */
export const NEF = {
  bpm: 132, bar: 60 * 60 * 4 / 132, // (109.09 ticks a bar)
  pull: 546, // the intro: 5 bars (545.45 ticks) - the fight starts on the downbeat of the groove
  tellMin: 63, solveMin: 183,
  hammer: { r: 130, tell: 90, pct: 0.36 },
  sand: { first: 196, every: 66, everyS: 100, pct: 0.36 },
  tide: { lanes: 10, step: 110, tell: 84, every: 76, waves: 3, wavesX: 4, pct: 0.3 },
  dial: { warn: 90, pulses: 12, every: 30, arc: 1.05, spin: 0.0062, spinX: 0.0082, inner: 120, pct: 0.06 },
  scales: { d: 210, heartR: 250, featherR: 430, swap: 132, swapLead: 60, pct: 0.42 }, // (playtest: the tip leaves 2.2 s - boss-face -> feather is ~350 px at the slowest 206 px/s + a reaction)
  dawn: { a: 96, b: 66, dayR: 260, nightR0: 230, pct: 0.38 },
  devour: { pull: 210, acc: 17, r: 250, pct: 0.42 },
  cart: { write: 60, gap: 90, every: 84, everyX: 72, lead: 60, sunR: 260, moonR0: 230, laneW: 190, pct: 0.32 },
  skyTurn: 240, blackout: 210, struck: { t: 480, mul: 1.25 },
  // Part 1S (Savage): the new mechanics
  bal: { solve: 300, r: 130, brR: 84, brK: 0.6, pct: 0.34 },
  pinax: { first: 240, every: 225, off: 0.42, half: 128, pct: 0.42, miss: 0.3, soak: 0.1 },
  verdict: { n: 6, lead: 200, every: 140, show: 63, heartR: 250, featherR: 430, pct: 0.34 },
  verdictCine: 330, sunLifeS: 800,
  // Savage v2: ECLIPSE ASCENDANT (the transformed fight) - the door's lessons, inverted, with a layer on top
  ecl: { full: 840, short: 180, beats: [0, 60, 180, 300, 420, 570, 660, 780], beatsShort: [0, 40, 80, 120], hpK: 1.15 },
  balI: { solve: 360, swap: 90 }, // (swap told for 1.5 s from the start; 3.3 s of the solve remain after it)
  pinaxR: { show: 120, soak: 2 }, // (the order is SHOWN for 2 s, then plays reversed; a moon tile needs two of you - or everyone there is, when fewer)
  devourP: { push: 210, acc: 15, rim: 0.6, pct: 0.42, cnt: 70 }, // (the exhale shoves you OUT; the rim beyond 60% burns; then one Verdict count)
  verdictE: { n: 8, every: 140, fast: 118, nFast: 3 },
};

/** the fight's phases (floor = the HP gate; rot = the rotation, 'a+b' = together; aura = a phase-long rule; enter = the cinematic that opens it) */
export const NEF_FIGHT = {
  n: [
    { name: 'The Seal Breaks', sub: 'Sun and sand · read the hourglasses · walk out of the hammer', floor: 0.66, aura: null, rot: ['hammer', 'sandglass', 'scarabs', 'hammer', 'sandglass', 'scarabs+hammer'] },
    { name: 'Day and Night', sub: 'The sky has turned · walk with the shade · read your mark', floor: 0.33, aura: null, rot: ['sundial', 'scales', 'dawndusk', 'hammer', 'sundial', 'scales', 'scarabs'] },
    { name: 'Sun-Eaten', sub: 'His hunger · the heat builds · shelter in the obelisk shade', floor: 0, aura: 'heat', rot: ['devour', 'cartouche', 'scarabs', 'hammer', 'devour', 'cartouche', 'scales'] },
  ],
  x: [
    { name: 'The Seal Breaks', sub: 'The hammer falls while the sand runs', floor: 0.66, aura: null, rot: ['sandglass+hammer', 'scarabs', 'hammer', 'sandglass', 'scarabs+hammer'] },
    { name: 'Day and Night', sub: 'The dial turns back · the scales tip', floor: 0.33, aura: null, rot: ['sundial', 'scales', 'dawndusk+hammer', 'sundial+scales', 'scarabs+hammer'] },
    { name: 'Sun-Eaten', sub: 'His hunger grows · the heat bites harder', floor: 0.12, aura: 'heat', rot: ['devour', 'cartouche', 'scarabs+hammer', 'scales+dawndusk', 'devour', 'cartouche'] },
    { name: 'The Black Sun', sub: 'His heart is exposed · stay in the last light · 100 seconds', floor: 0, aura: 'blacksun', rot: ['cartouche', 'hammer', 'scarabs', 'devour'] },
  ],
};
// Part 1S: NEFERAKH SAVAGE - five phases, strict solves (a failed position check = a Vuln stack, the 2nd is a KO), a new final phase.
//   BALANCE OF DAY AND NIGHT  each hero carries a SUN or MOON charge; when it bursts you must stand with the opposite: an opposite-charge
//                  hero or an opposite brazier (four on the throne: two sun, two moon). Two of the same kind together overload. (pair with your
//                  opposite, keep the pairs apart; solo, read the braziers)
//   THE PINAX      four corner tiles judge in order around the throne (always to the NEXT corner, never across): SUN = get off it, MOON = someone
//                  must stand on it (an empty moon tile judges the whole party). (read a rotation, split soaks / run the circuit)
//   BLACK SUN VERDICT (P5, new) the court of the sun reads a six-count sentence - SUN, MOON, SCARAB, SCALES - shown in full on the HUD;
//                  each count lands 2.3 s after the last, its floor shown 1 s before. No memory test: a fast chain of known answers. (execution)
//   SUNBEARER (Savage) the sun's fuse is shorter; THE BLACK SUN runs as a phase of its own (no 100 s check), the Verdict follows.
NEF_FIGHT.s = [
  { name: 'Balance of Day', sub: 'Sun and moon charges · stand with your opposite (a hero or a brazier)', floor: 0.78, aura: null, exit: 'sky', rot: ['balance', 'sandglass+hammer', 'scarabs', 'balance+hammer', 'cartouche'] },
  { name: 'The Pinax', sub: 'The corner tiles judge in turn · SUN: get off · MOON: stand on it', floor: 0.56, aura: null, exit: 'sun', rot: ['pinax', 'sundial', 'scales', 'pinax+hammer', 'dawndusk+balance'] },
  { name: 'Sun-Eaten', sub: 'His hunger · the heat builds · balance in the shade', floor: 0.36, aura: 'heat', exit: 'black', rot: ['devour', 'balance+cartouche', 'pinax', 'scales+dawndusk', 'scarabs+hammer'] },
  { name: 'The Black Sun', sub: 'His heart is exposed · keep to the last light · fight the pull', floor: 0.16, aura: 'blacksun', exit: 'verdict', rot: ['hammer', 'devour', 'hammer', 'devour+hammer'] }, // (the light never sits on him: every answer stays inside it)
  { name: 'Black Sun Verdict', sub: 'The court of the sun reads your sentence · every count, in order', floor: 0, aura: null, rot: ['verdict', 'hammer', 'balance', 'verdict', 'scarabs+hammer', 'pinax'] },
];
// SAVAGE v2 - NEFERAKH, ECLIPSE ASCENDANT: the door fight above is a full encounter; when it falls he transforms (the Eclipse
// cinematic) into a new form with a full HP pool and his own enrage, whose phases subvert what the door taught:
//   B1 BALANCE INVERTED     stand with the SAME charge now; the braziers swap kinds once mid-solve (told 1.5 s ahead). (unlearn the pairing)
//   B2 PINAX OF THE ECLIPSE the order is shown, then the tiles judge in REVERSE; a moon tile needs TWO soakers. (re-read, re-assign)
//   B3 DEVOURING COURT      Devour EXHALES - it shoves you out to a burning rim (walk IN against it), then one Verdict count. (displacement + a read)
//   B4 FINAL VERDICT: ECLIPSE eight counts in inverted colours (SUN = in, MOON = out, SCARAB = the cardinal cross), the last three faster. (the exam)
NEF_FIGHT.e = [
  { name: 'Balance Inverted', sub: 'Stand with the SAME charge · the braziers swap once (watch the warning)', floor: 0.75, aura: null, exit: 'sky', rot: ['balanceI', 'sandglass+hammer', 'scarabs', 'balanceI+hammer', 'cartouche'] },
  { name: 'Pinax of the Eclipse', sub: 'The order is shown, then judged in REVERSE · a moon tile needs two of you', floor: 0.5, aura: null, exit: 'sun', rot: ['pinaxR', 'scales', 'pinaxR+hammer', 'dawndusk+balanceI', 'sundial'] },
  { name: 'Devouring Court', sub: 'He exhales · walk IN against the push · the rim burns · then a count', floor: 0.25, aura: 'heat', exit: 'verdict', rot: ['devourP', 'balanceI+cartouche', 'pinaxR', 'devourP+hammer', 'scales+dawndusk'] },
  { name: 'Final Verdict: Eclipse', sub: 'Eight counts in inverted colours · SUN in · MOON out · SCARAB the cross', floor: 0, aura: null, rot: ['verdictE', 'hammer', 'balanceI', 'verdictE', 'scarabs+hammer', 'pinaxR'] },
];
export const NEF_LINES_E = ['', 'You learned my scales? I have turned them over.', 'Read it again, mortals. Backwards, this time.', 'Out. OUT. The court has no room for you.', 'Eclipse. Every answer you knew is now a lie.'];
export const NEF_NAMES = { balanceI: 'Balance Inverted', pinaxR: 'Pinax of the Eclipse', devourP: 'Devouring Court', verdictE: 'Final Verdict: Eclipse', balance: 'Balance of Day and Night', pinax: 'The Pinax', verdict: 'Black Sun Verdict', hammer: 'Solar Hammer', sandglass: 'Sandglass', scarabs: 'Scarab Tide', sundial: 'Sundial', scales: 'Heart and Feather', dawndusk: 'Dawn and Dusk', devour: 'Devour', cartouche: 'Cartouche' };
/** boss lines (phase n, then the enrage) */
export const NEF_LINES = ['', 'Three thousand years under a lid of stone. Do you know how hungry the sun gets?', 'Day. Night. Day. I decide which, little mortals.', 'I ate the sun once. Now I eat its light out of you.', 'Then let there be no more day at all.'];

export const NEF_LINES_S = ['', 'Sun and moon, little mortals. Find your other half, or burn alone.', 'The old tablets still judge. Stand where the moon asks.', 'I ate the sun once. Now I eat its light out of you.', 'Dark, at last. Can you still see me?', 'Kneel. The court of the black sun is in session.'];
/** the mechanics. H = the trial engine's helpers (sim/trials.js): tele, hurt, card, ev, tk, CEN, rnd, pick, angTo, aliveIn, R, r0, r2 */
export function nefMechs(H) {
  const { tele, hurt, card, ev, tk, CEN, rnd, R, r0, r2, fail } = H;
  const tl = (T, v) => Math.max(NEF.tellMin, tk(T, v)), sv = (T, v) => Math.max(NEF.solveMin, tk(T, v));
  const bxy = (T, b) => ({ x: r0(b ? b.x : CEN(T).x), y: r0(b ? b.y : CEN(T).y - 40) });
  /** a 3-beat slam on one footprint (the step-5 beat model: one evade covers one beat, only the last beat hits hard) */
  const slam3 = (T, k, x, y, r, d0, pct, what, o = {}) => SLAM_BEATS.mul.map((f, i) => tele(T, { k, sh: 'circle', x, y, r, d: d0 + i * SLAM_BEATS.gap, pct: r2(pct * f / 1.05), what, beat: i + 1, quiet: i < 2 ? 1 : 0, ...o }));
  const shuffle = (sim, a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(sim) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const M = {
    balance: { // BALANCE OF DAY AND NIGHT: SUN/MOON charges burst together; stand with the opposite (a hero or a brazier), never with the same
      start(sim, T, m, here) {
        const P = NEF.bal, C = CEN(T), first = rnd(sim) < 0.5 ? 'sun' : 'moon', a0 = r2(rnd(sim) * Math.PI / 2);
        m.ch = {}; here.filter((p) => !p.decoy).forEach((p, i) => { m.ch[p.id] = i % 2 === 0 ? first : first === 'sun' ? 'moon' : 'sun'; });
        m.br = [0, 1, 2, 3].map((i) => ({ x: r0(C.x + Math.cos(a0 + i * Math.PI / 2) * R * P.brK), y: r0(C.y + Math.sin(a0 + i * Math.PI / 2) * R * P.brK), k: i % 2 ? 'moon' : 'sun' }));
        m.dd = sv(T, m.inv ? NEF.balI.solve : P.solve); m.d = m.dd + 16; m.sw = m.inv ? NEF.balI.swap : 0;
        T.o.bal = { ch: { ...m.ch }, br: m.br, at: m.dd, t0: 0, r: P.r, brR: P.brR, inv: m.inv || 0, sw: m.sw, swd: 0 };
        if (m.inv) card(sim, T, 'BALANCE INVERTED', 'Stand with the SAME charge: a hero or a brazier · the braziers SWAP in 1.5 s', '#ffcf7a', 160);
        else card(sim, T, 'BALANCE OF DAY AND NIGHT', 'Stand with your OPPOSITE: a hero or a brazier · never two of a kind', '#ffcf7a', 160);
        ev(sim, T, 'balance');
      },
      tick(sim, T, m, here) {
        if (T.o.bal) T.o.bal.t0 = m.t;
        if (m.sw && m.t === m.sw) { for (const q of m.br) q.k = q.k === 'sun' ? 'moon' : 'sun'; if (T.o.bal) { T.o.bal.br = m.br.map((q) => ({ ...q })); T.o.bal.swd = 1; } card(sim, T, 'THE BRAZIERS SWAP', 'Sun is moon · moon is sun', '#ffcf7a', 80); ev(sim, T, 'balswap'); }
        if (m.t !== m.dd) return;
        const P = NEF.bal, ok = {};
        sim.posCheck = 1;
        for (const p of here) {
          const k = m.ch[p.id]; if (!k) continue;
          const near = here.filter((q) => q !== p && m.ch[q.id] && Math.hypot(q.x - p.x, q.y - p.y) < P.r);
          const brOpp = m.br.some((b) => b.k !== k && Math.hypot(b.x - p.x, b.y - p.y) < P.brR + (p.r || 16) * 0.5);
          const brSame = m.br.some((b) => b.k === k && Math.hypot(b.x - p.x, b.y - p.y) < P.brR);
          const same = near.some((q) => m.ch[q.id] === k) || brSame, opp = brOpp || near.some((q) => m.ch[q.id] !== k);
          ok[p.id] = (m.inv ? same && !opp : opp && !same) ? 1 : 0;
          if (!ok[p.id]) { const why = m.inv ? (opp ? 'eclipsed charge' : 'lonely charge') : same ? 'overloaded charge' : 'unbalanced charge'; if (hurt(sim, T, p, P.pct, why, null)) fail(sim, T, p, why); }
        }
        sim.posCheck = 0;
        ev(sim, T, 'balanced', { ok });
      },
      end(sim, T) { T.o.bal = null; },
    },
    pinax: { // THE PINAX: four corner tiles judge in turn (always to the next corner); SUN = off it, MOON = someone on it
      start(sim, T, m, here) {
        const P = NEF.pinax, C = CEN(T), s0 = R * P.off, kinds = shuffle(sim, ['sun', 'sun', 'moon', 'moon']), st = Math.floor(rnd(sim) * 4), dir = rnd(sim) < 0.5 ? 1 : -1;
        const corner = [[1, 1], [-1, 1], [-1, -1], [1, -1]]; // (a ring: consecutive tiles share an edge, never a diagonal)
        m.first = sv(T, P.first) + (m.rev ? NEF.pinaxR.show : 0); m.every = Math.max(150, tk(T, P.every));
        // (Eclipse: the tiles are numbered in ring order 1-4 as before, then judged 4 -> 1: still always to the NEXT corner)
        m.tiles = [0, 1, 2, 3].map((i) => { const c = corner[(st + dir * i + 8) % 4], j = m.rev ? 3 - i : i; return { x: r0(C.x + c[0] * s0), y: r0(C.y + c[1] * s0), h: P.half, k: kinds[i], n: i + 1, at: m.first + j * m.every, done: 0 }; });
        m.need = m.rev ? Math.max(1, Math.min(NEF.pinaxR.soak, here.filter((p) => !p.decoy).length)) : 1;
        for (const q of m.tiles) if (q.k === 'sun') q.t = tele(T, { k: 'psun', sh: 'line', x: q.x - q.h, y: q.y, ang: 0, len: q.h * 2, w: q.h * 2, d: q.at, pct: P.pct, pos: 1, what: 'pinax: sun', n: q.n });
        m.d = m.first + 3 * m.every + 16;
        T.o.pinax = { tiles: m.tiles.map((q) => ({ x: q.x, y: q.y, h: q.h, k: q.k, n: q.n, at: q.at })), t: 0, next: m.rev ? 4 : 1, rev: m.rev ? 1 : 0, show: m.rev ? NEF.pinaxR.show : 0, need: m.need };
        if (m.rev) card(sim, T, 'PINAX OF THE ECLIPSE', `Read the order... then it plays in REVERSE (4 to 1) · MOON needs ${m.need} on it`, '#f5d28a', 170);
        else card(sim, T, 'THE PINAX', 'The tiles judge in number order · SUN: get off · MOON: someone stands on it', '#f5d28a', 160);
        ev(sim, T, 'pinax');
      },
      tick(sim, T, m, here) {
        const P = NEF.pinax, X = T.o.pinax; if (X) X.t = m.t;
        for (const q of m.tiles) {
          if (q.done || m.t !== q.at) continue;
          q.done = 1; if (X) X.next = m.rev ? q.n - 1 : q.n + 1;
          if (q.k !== 'moon') continue;
          const on = here.filter((p) => Math.abs(p.x - q.x) < q.h + 6 && Math.abs(p.y - q.y) < q.h + 6);
          sim.posCheck = 1;
          if (on.length >= (m.need || 1)) { for (const p of on) hurt(sim, T, p, P.soak, 'pinax: moon', null); }
          else { const w = on.length ? 'underweighed moon' : 'unjudged moon'; for (const p of here) { if (hurt(sim, T, p, P.miss, w, null)) fail(sim, T, p, w); } }
          sim.posCheck = 0;
          sim.emit({ type: 'trial', ph: 'boom', k: T.k, tk: 'pmoon', sh: 'line', x: q.x, y: q.y, r: q.h, n: q.n, ok: on.length >= (m.need || 1) ? 1 : 0 });
        }
      },
      end(sim, T) { T.o.pinax = null; },
    },
    verdict: { // BLACK SUN VERDICT: a six-count sentence shown in full; each count lands 2.3 s apart, its floor 1 s before
      start(sim, T, m, here) {
        const P = NEF.verdict, E = NEF.verdictE, pool = ['sun', 'moon', 'scarab', 'scales'], n = m.inv ? E.n : P.n; m.g = [];
        for (let i = 0; i < n; i++) { let g; do g = pool[Math.floor(rnd(sim) * pool.length)]; while (i > 0 && g === m.g[i - 1]); m.g.push(g); }
        m.lead = sv(T, P.lead); m.every = P.every;
        m.at = m.g.map((g, i) => m.lead + (m.inv ? Math.min(i, n - E.nFast) * E.every + Math.max(0, i - (n - E.nFast)) * E.fast : i * P.every)); // (Eclipse: the last three counts come faster - each still told 1.05 s)
        m.d = m.at[n - 1] + 16;
        const first = rnd(sim) < 0.5 ? 'heart' : 'feather'; m.marks = {}; here.forEach((p, i) => { m.marks[p.id] = i % 2 === 0 ? first : first === 'heart' ? 'feather' : 'heart'; });
        T.o.verdict = { g: m.g.slice(), next: 0, at0: m.lead, every: m.every, at: m.at.slice(), t: 0, inv: m.inv ? 1 : 0 }; T.o.marks = { ...m.marks };
        if (m.inv) card(sim, T, 'FINAL VERDICT: ECLIPSE', 'Eight counts, colours INVERTED · SUN in · MOON out · SCARAB the cross · SCALES your mark', '#ff5a7a', 180);
        else card(sim, T, 'BLACK SUN VERDICT', 'Six counts, in order · SUN out · MOON in · SCARAB diagonal · SCALES your mark', '#ff7a4a', 170);
        ev(sim, T, 'verdict', { g: m.g });
      },
      tick(sim, T, m, here, b) {
        const P = NEF.verdict, V = T.o.verdict; if (!V) return; V.t = m.t;
        for (let i = 0; i < m.g.length; i++) {
          const at = m.at[i];
          if (m.t === at - P.show) {
            const o = bxy(T, b), g0 = m.g[i], g = m.inv && g0 === 'sun' ? 'moon' : m.inv && g0 === 'moon' ? 'sun' : g0; V.next = i; V.x = o.x; V.y = o.y; // (Eclipse: the SUN glyph judges as a moon (in), the MOON as a sun (out))
            if (g === 'scarab' && m.inv) { const grp = 'vx' + T.tid; for (const a of [Math.PI / 4, -Math.PI / 4]) tele(T, { k: 'cscarab', sh: 'line', x: r0(o.x - Math.cos(a) * R * 1.2), y: r0(o.y - Math.sin(a) * R * 1.2), ang: r2(a), len: R * 2.4, w: NEF.cart.laneW, d: P.show, pct: P.pct, grp, pos: 1, what: 'eclipse verdict: scarab', n: a > 0 ? i + 1 : 0, quiet: a > 0 ? 0 : 1, inv: 1 }); }
            else if (g === 'sun') tele(T, { k: 'csun', sh: 'circle', x: o.x, y: o.y, r: NEF.cart.sunR, d: P.show, pct: P.pct, pos: 1, what: m.inv ? 'eclipse verdict: moon' : 'verdict: sun', n: i + 1, inv: m.inv ? 1 : 0 });
            else if (g === 'moon') tele(T, { k: 'cmoon', sh: 'donut', x: o.x, y: o.y, r0: NEF.cart.moonR0, r: R * 2, d: P.show, pct: P.pct, cue: 'close', pos: 1, what: m.inv ? 'eclipse verdict: sun' : 'verdict: moon', n: i + 1, inv: m.inv ? 1 : 0 });
            else if (g === 'scarab') { const grp = 'vx' + T.tid; for (const a of [0, Math.PI / 2]) tele(T, { k: 'cscarab', sh: 'line', x: r0(o.x - Math.cos(a) * R * 1.2), y: r0(o.y - Math.sin(a) * R * 1.2), ang: r2(a), len: R * 2.4, w: NEF.cart.laneW, d: P.show, pct: P.pct, grp, pos: 1, what: 'verdict: scarab', n: a ? 0 : i + 1, quiet: a ? 1 : 0 }); }
            else { tele(T, { k: 'heart', sh: 'circle', x: o.x, y: o.y, r: P.heartR, d: P.show, pct: 0, cue: 'close', quiet: 1 }); tele(T, { k: 'feather', sh: 'donut', x: o.x, y: o.y, r0: P.featherR, r: R * 2, d: P.show, pct: 0, cue: 'safe', quiet: 1 }); V.sx = o.x; V.sy = o.y; }
          }
          if (m.t === at) {
            V.next = i + 1; ev(sim, T, 'vcount', { n: i + 1, g: m.g[i] });
            if (m.g[i] === 'scales') {
              sim.posCheck = 1;
              for (const p of here) { const mk = m.marks[p.id] || 'heart', d = Math.hypot(p.x - V.sx, p.y - V.sy), pad = (p.r || 16) * 0.5;
                if (mk === 'heart' ? d > P.heartR + pad : d < P.featherR - pad) { const w = mk === 'heart' ? 'heavy heart' : 'weightless feather'; if (hurt(sim, T, p, P.pct, w, null)) fail(sim, T, p, w); } }
              sim.posCheck = 0;
            }
          }
        }
      },
      end(sim, T) { T.o.verdict = null; T.o.marks = null; },
    },
    hammer: { // SOLAR HAMMER: one fist per hero (party: on each of you), 3 beats on the spot you stood on
      start(sim, T, m, here) {
        const d0 = tl(T, NEF.hammer.tell); const tg = here.length ? here : [CEN(T)];
        for (const p of tg) slam3(T, 'hammer', r0(p.x), r0(p.y), NEF.hammer.r, d0, NEF.hammer.pct, 'solar hammer');
        m.d = d0 + 2 * SLAM_BEATS.gap + 16;
        if (!T.mechs.some((q) => q !== m)) card(sim, T, 'SOLAR HAMMER', 'Three beats on your spot · one roll covers one beat · walk out', '#ffd36a', 120);
        ev(sim, T, 'hammer');
      },
      tick() {},
    },
    sandglass: { // SANDGLASS: the four quarters bury in the hourglasses' order; the one that just buried is safe
      start(sim, T, m) {
        const C = CEN(T), a0 = rnd(sim) < 0.5 ? 0 : Math.PI / 4, ord = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = Math.floor(rnd(sim) * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
        const first = sv(T, NEF.sand.first), every = Math.max(48, tk(T, T.sv ? NEF.sand.everyS : NEF.sand.every)); // (Savage: 1.33 s a quarter - the next safe quarter can be the opposite one, the solve is crossing the hub, not a sprint)
        m.q = ord.map((n, i) => { const a = r2(a0 + i * Math.PI / 2 + Math.PI / 4); return { a, n: n + 1, gx: r0(C.x + Math.cos(a) * (R - 46)), gy: r0(C.y + Math.sin(a) * (R - 46)) }; });
        for (const q of m.q) q.t = tele(T, { k: 'sandq', sh: 'cone', x: C.x, y: C.y, r: R + 30, arc: Math.PI / 2, ang: q.a, d: first + (q.n - 1) * every, pct: NEF.sand.pct, pos: 1, what: 'sandglass', n: 0 });
        T.o.glass = m.q.map((q) => ({ a: q.a, n: q.n, gx: q.gx, gy: q.gy, at: q.t.d }));
        m.d = first + 3 * every + 16;
        card(sim, T, 'SANDGLASS', 'The quarters bury in number order · the one that just buried is safe', '#f0c878', 150);
        ev(sim, T, 'sandglass');
      },
      tick() {},
      end(sim, T) { T.o.glass = null; },
    },
    scarabs: { // SCARAB TIDE: waves of lanes; the golden scarab rides the gap, its arrow shows where the gap moves next wave
      start(sim, T, m, here) {
        const P = NEF.tide, C = CEN(T); m.waves = T.x ? P.wavesX : P.waves; m.every = Math.max(70, tk(T, P.every)); /* (playtest: a 110 px shift every 1.0 s was a sprint at 140 px/s - the floor keeps it a walk) */ m.tell = tl(T, P.tell);
        m.first = sv(T, NEF.solveMin); m.lead = m.first - m.tell; // (playtest: the FIRST gap is a 3 s solve - from anywhere on the throne - then the waves keep the walking rhythm)
        m.dir = r2(rnd(sim) * TAU); m.step = rnd(sim) < 0.5 ? -1 : 1;
        { const c = Math.cos(m.dir), sn = Math.sin(m.dir), off = (q) => -(q.x - C.x) * sn + (q.y - C.y) * c, reach = m.first * 2.2 - 60; // (the first gap starts within a walk of every hero)
          const ok = []; for (let i = 2; i <= P.lanes - 3; i++) { const o = (i - (P.lanes - 1) / 2) * P.step; if (here.every((q) => Math.abs(off(q) - o) < reach)) ok.push(i); }
          m.gi = ok.length ? ok[Math.floor(rnd(sim) * ok.length)] : 2 + Math.floor(rnd(sim) * (P.lanes - 4)); }
        m.d = 1 + m.lead + (m.waves - 1) * m.every + m.tell + 16;
        T.o.tide = { dir: m.dir, gi: m.gi, step: m.step, lanes: P.lanes, w: P.step, wave: 0, waves: m.waves };
        card(sim, T, 'SCARAB TIDE', 'Stand in the golden scarab\'s gap · its arrow shows the next one', '#9fe8c0', 140);
        ev(sim, T, 'scarabs');
      },
      tick(sim, T, m) {
        if (m.gaps && T.o.tide) { m.gaps = m.gaps.filter((g) => g.at >= m.t); const g0 = m.gaps[0], g1 = m.gaps[1]; // (the gold always shows the gap of the wave about to land; waves overlap a few ticks, so never jump early to the next one)
          if (g0 && T.o.tide.gi !== g0.gi) { const Td = T.o.tide; Td.gi = g0.gi; Td.step = g1 ? Math.sign(g1.gi - g0.gi) : Td.step; Td.wave = Math.max(1, Td.wave - 1); } }
        const k = m.t === 1 ? 0 : (m.t - 1 - m.lead) / m.every; if (m.t < 1 || k < 0 || k !== Math.floor(k) || k >= m.waves || (k === 0 && m.t !== 1)) return;
        const w = k, P = NEF.tide, C = CEN(T), c = Math.cos(m.dir), s = Math.sin(m.dir), grp = 'tide' + T.tid, d = w === 0 ? m.first : m.tell;
        if (w > 0) { m.gi += m.step; if (m.gi < 1 || m.gi > P.lanes - 2) { m.step = -m.step; m.gi += 2 * m.step; } }
        const nxt = m.gi + m.step < 1 || m.gi + m.step > P.lanes - 2 ? -m.step : m.step;
        m.gaps = (m.gaps || []).filter((g) => g.at > m.t).concat([{ gi: m.gi, at: m.t + d }]); // (every pending wave's gap, earliest first: the client and the bots read the one about to land)
        { const g0 = m.gaps[0], g1 = m.gaps[1]; T.o.tide = { dir: m.dir, gi: g0.gi, step: g1 ? Math.sign(g1.gi - g0.gi) : nxt, lanes: P.lanes, w: P.step, wave: w + 2 - m.gaps.length, waves: m.waves, at: m.t + d, gaps: m.gaps.map((g) => ({ gi: g.gi, at: g.at })) }; } // (at: mechanic ticks, compare with the mechanic's own t)
        for (let i = 0; i < P.lanes; i++) {
          if (i === m.gi) continue;
          const o = (i - (P.lanes - 1) / 2) * P.step, x = C.x - s * o - c * (R + 20), y = C.y + c * o - s * (R + 20);
          tele(T, { k: 'scarab', sh: 'line', x: r0(x), y: r0(y), ang: m.dir, len: R * 2 + 40, w: P.step - 10, d, pct: P.pct, grp, pos: 1, what: 'scarab tide', quiet: i === 0 ? 0 : 1 });
        }
      },
      end(sim, T) { T.o.tide = null; },
    },
    sundial: { // SUNDIAL: a wedge of shade sweeps from him; outside it (and outside his own shadow) the noon light burns, every half-second
      start(sim, T, m, here, b) {
        const P = NEF.dial, o = bxy(T, b), tg = here.length ? here[Math.floor(rnd(sim) * here.length)] : { x: o.x, y: o.y + 200 };
        m.a = r2(Math.atan2(tg.y - o.y, tg.x - o.x)); m.dir = rnd(sim) < 0.5 ? -1 : 1; m.warn = tl(T, P.warn); m.d = m.warn + P.pulses * P.every + 10;
        m.rev = T.x ? m.warn + Math.floor(P.pulses / 2) * P.every : 0; m.revWarn = T.x ? m.rev - 66 : 0;
        T.o.dial = { x: o.x, y: o.y, a: m.a, arc: P.arc, dir: m.dir, on: 0, inner: P.inner, flip: 0 };
        card(sim, T, 'SUNDIAL', T.x ? 'Walk with the shade · it turns BACK halfway (watch the arrow)' : 'Walk with the shade as it turns · the noon light burns the rest', '#ffe08a', 140);
        ev(sim, T, 'sundial', { dir: m.dir });
      },
      tick(sim, T, m, here, b) {
        const P = NEF.dial, D = T.o.dial; if (!D) return;
        const o = bxy(T, b); D.x = o.x; D.y = o.y;
        if (m.t === m.revWarn && m.rev) { D.flip = 1; ev(sim, T, 'dialflip'); }
        if (m.t === m.rev && m.rev) { m.dir = -m.dir; D.dir = m.dir; D.flip = 0; }
        if (m.t < m.warn) return;
        D.on = 1; m.a += m.dir * (T.x ? P.spinX : P.spin); D.a = r2(m.a);
        if ((m.t - m.warn) % P.every !== P.every - 1) return;
        sim.posCheck = 1;
        for (const p of here) {
          const d = Math.hypot(p.x - D.x, p.y - D.y); if (d < P.inner) continue;
          const da = Math.abs(Math.atan2(Math.sin(Math.atan2(p.y - D.y, p.x - D.x) - m.a), Math.cos(Math.atan2(p.y - D.y, p.x - D.x) - m.a)));
          if (da > P.arc / 2 + (p.r || 16) * 0.5 / Math.max(60, d)) hurt(sim, T, p, P.pct, 'noon light', null);
        }
        sim.posCheck = 0;
      },
      end(sim, T) { T.o.dial = null; },
    },
    scales: { // HEART AND FEATHER: each hero's mark - HEART close to him, FEATHER far out; the Extreme tips the scales once
      start(sim, T, m, here, b) {
        const P = NEF.scales, o = bxy(T, b), first = rnd(sim) < 0.5 ? 'heart' : 'feather';
        m.marks = {}; here.forEach((p, i) => { m.marks[p.id] = i % 2 === 0 ? first : first === 'heart' ? 'feather' : 'heart'; });
        m.dd = sv(T, P.d) + (T.x ? P.swapLead : 0); m.swap = T.x ? m.dd - P.swap : 0; m.d = m.dd + 16;
        T.o.marks = { ...m.marks }; T.o.scales = { x: o.x, y: o.y, hr: P.heartR, fr: P.featherR, at: m.dd, swap: m.swap, sw: 0 };
        m.th = tele(T, { k: 'heart', sh: 'circle', x: o.x, y: o.y, r: P.heartR, d: m.dd, pct: 0, cue: 'close', quiet: 1 });
        m.tf = tele(T, { k: 'feather', sh: 'donut', x: o.x, y: o.y, r0: P.featherR, r: R * 2, d: m.dd, pct: 0, cue: 'safe', quiet: 1 });
        card(sim, T, 'HEART AND FEATHER', 'Read YOUR mark · HEART: close to him · FEATHER: far out', '#ff9ab0', 150);
        ev(sim, T, 'scales');
      },
      tick(sim, T, m, here, b) {
        const P = NEF.scales;
        if (m.swap && m.t === m.swap) { for (const id in m.marks) m.marks[id] = m.marks[id] === 'heart' ? 'feather' : 'heart'; T.o.marks = { ...m.marks }; T.o.scales.sw = 1; card(sim, T, 'THE SCALES TIP', 'Your mark has swapped', '#ff9ab0', 80); ev(sim, T, 'scaletip'); }
        if (m.t !== m.dd) return;
        const o = T.o.scales || bxy(T, b); sim.posCheck = 1; // (judged where the rings are DRAWN - he walks after melee, the judgement must not)
        for (const p of here) {
          const mk = m.marks[p.id] || 'heart', d = Math.hypot(p.x - o.x, p.y - o.y), pad = (p.r || 16) * 0.5;
          if (mk === 'heart' ? d > P.heartR + pad : d < P.featherR - pad) { if (hurt(sim, T, p, P.pct, mk === 'heart' ? 'heavy heart' : 'weightless feather', null)) fail(sim, T, p, mk === 'heart' ? 'heavy heart' : 'weightless feather'); sim.emit({ type: 'trial', ph: 'judged', k: T.k, pid: p.id, mk, x: r0(p.x), y: r0(p.y) }); }
        }
        sim.posCheck = 0; ev(sim, T, 'weighed');
      },
      end(sim, T) { T.o.marks = null; T.o.scales = null; },
    },
    dawndusk: { // DAWN AND DUSK: day flares round him (out), night everywhere but his shadow (in) - the card names the order
      start(sim, T, m, here, b) {
        const P = NEF.dawn; m.seq = rnd(sim) < 0.5 ? ['day', 'night'] : ['night', 'day']; m.a = T.sv ? Math.max(100, tl(T, P.a)) : tl(T, P.a); m.b = T.sv ? Math.max(80, tl(T, P.b)) : tl(T, P.b); // (Savage: a failed flare is a Vuln stack - the reaction gets 1.7 s / 1.3 s) m.d = m.a + m.b + 16;
        T.o.sky = m.seq.slice();
        card(sim, T, m.seq[0] === 'day' ? 'DAWN, THEN DUSK' : 'DUSK, THEN DAWN', m.seq[0] === 'day' ? 'Out of the sun · then into his shadow' : 'Into his shadow · then out of the sun', '#fff2a0', 130);
        ev(sim, T, 'eclipse', { s: m.seq[0] });
      },
      tick(sim, T, m, here, b) {
        const at = m.t === 1 ? 0 : m.t === m.a ? 1 : -1; if (at < 0) return;
        const P = NEF.dawn, o = bxy(T, b), s = m.seq[at];
        if (s === 'day') tele(T, { k: 'day', sh: 'circle', x: o.x, y: o.y, r: P.dayR, d: at ? m.b : m.a, pct: P.pct, pos: 1, what: 'dawn flare' });
        else tele(T, { k: 'night', sh: 'donut', x: o.x, y: o.y, r0: P.nightR0, r: R * 2, d: at ? m.b : m.a, pct: P.pct, cue: 'close', pos: 1, what: 'dusk' });
        if (at) { T.o.sky = [s]; ev(sim, T, 'eclipse', { s }); }
      },
      end(sim, T) { T.o.sky = null; },
    },
    devour: { // DEVOUR: the inhale drags everyone in for 3.5 s, then the gullet slams round him in 3 beats
      start(sim, T, m, here, b) {
        const P = NEF.devour, o = bxy(T, b); m.pull = tl(T, P.pull);
        slam3(T, 'gullet', o.x, o.y, P.r, m.pull, P.pct, 'devour');
        m.d = m.pull + 2 * SLAM_BEATS.gap + 16; T.o.inhale = { x: o.x, y: o.y, t: 0, d: m.pull };
        card(sim, T, 'DEVOUR', 'He inhales · walk against the pull · his gullet slams three times', '#ff9a3a', 150);
        ev(sim, T, 'devour');
      },
      tick(sim, T, m, here, b) {
        const P = NEF.devour, I = T.o.inhale; if (!I || m.t > m.pull) { if (I) T.o.inhale = null; return; }
        I.t = m.t; const ramp = 0.6 + 0.6 * Math.min(1, m.t / m.pull);
        for (const p of here) { if (p.decoy) continue; const dx = I.x - p.x, dy = I.y - p.y, d = Math.hypot(dx, dy); if (d < 70) continue; p.vx = (p.vx || 0) + dx / d * P.acc * ramp; p.vy = (p.vy || 0) + dy / d * P.acc * ramp; }
      },
      end(sim, T) { T.o.inhale = null; },
    },
    devourP: { // DEVOURING COURT (Eclipse): he EXHALES - a 3.5 s shove outward; the rim (beyond 60%) burns when it ends; then one Verdict count
      start(sim, T, m, here, b) {
        const P = NEF.devourP, C = CEN(T), o = bxy(T, b), pool = ['sun', 'moon', 'scarab']; m.push = tl(T, P.push); m.g = pool[Math.floor(rnd(sim) * 3)];
        tele(T, { k: 'rim', sh: 'donut', x: C.x, y: C.y, r0: r0(R * P.rim), r: R * 2, d: m.push, pct: P.pct, cue: 'close', pos: 1, what: 'devouring court' });
        m.cAt = m.push + P.cnt; m.d = m.cAt + 16; T.o.exhale = { x: o.x, y: o.y, t: 0, d: m.push, rim: r0(R * P.rim), g: m.g, at: m.cAt };
        card(sim, T, 'DEVOURING COURT', 'He EXHALES · walk IN against the push · the rim burns · then one count', '#ff6a3a', 150);
        ev(sim, T, 'devourP', { g: m.g });
      },
      tick(sim, T, m, here, b) {
        const P = NEF.devourP, X = T.o.exhale; if (!X) return; X.t = m.t;
        if (m.t <= m.push) { const ramp = 0.6 + 0.6 * Math.min(1, m.t / m.push);
          for (const p of here) { if (p.decoy) continue; const dx = p.x - X.x, dy = p.y - X.y, d = Math.hypot(dx, dy) || 1; p.vx = (p.vx || 0) + dx / d * P.acc * ramp; p.vy = (p.vy || 0) + dy / d * P.acc * ramp; } }
        if (m.t === m.cAt - NEF.verdict.show) { const o = bxy(T, b), sh = NEF.verdict.show;
          if (m.g === 'sun') tele(T, { k: 'csun', sh: 'circle', x: o.x, y: o.y, r: NEF.cart.sunR, d: sh, pct: NEF.verdict.pct, pos: 1, what: 'court count: sun', n: 1 });
          else if (m.g === 'moon') tele(T, { k: 'cmoon', sh: 'donut', x: o.x, y: o.y, r0: NEF.cart.moonR0, r: R * 2, d: sh, pct: NEF.verdict.pct, cue: 'close', pos: 1, what: 'court count: moon', n: 1 });
          else { const grp = 'dx' + T.tid; for (const a of [0, Math.PI / 2]) tele(T, { k: 'cscarab', sh: 'line', x: r0(o.x - Math.cos(a) * R * 1.2), y: r0(o.y - Math.sin(a) * R * 1.2), ang: r2(a), len: R * 2.4, w: NEF.cart.laneW, d: sh, pct: NEF.verdict.pct, grp, pos: 1, what: 'court count: scarab', n: a ? 0 : 1, quiet: a ? 1 : 0 }); } }
      },
      end(sim, T) { T.o.exhale = null; },
    },
    cartouche: { // CARTOUCHE: glyphs written one a second, then hidden; they resolve in the written order (each floor shows 1 s before)
      start(sim, T, m) {
        const P = NEF.cart, n = T.x ? 4 : 3, pool = ['sun', 'moon', 'scarab']; m.g = [];
        for (let i = 0; i < n; i++) { let g; do g = pool[Math.floor(rnd(sim) * 3)]; while (i > 0 && g === m.g[i - 1]); m.g.push(g); }
        m.w = P.write; m.hide = n * m.w + 20; m.r0 = n * m.w + P.gap; m.ev = T.x ? P.everyX : P.every; m.lead = NEF.tellMin;
        m.d = m.r0 + (n - 1) * m.ev + 16; m.sh = 0;
        T.o.cart = { g: m.g.slice(), shown: 0, hidden: 0, next: 0 };
        // (fairness: a Balance laid down with it is judged AFTER the last glyph, with 2 s to walk from the glyph's answer to a brazier -
        //  a moon glyph (in) 0.3 s before a brazier check (out at the rim) was not solvable)
        for (const q of T.mechs) if ((q.id === 'balance' || q.id === 'balanceI') && q.dd) { const dd = Math.max(q.dd, q.t + m.d + 104); q.d += dd - q.dd; q.dd = dd; if (T.o.bal) T.o.bal.at = dd; }
        card(sim, T, 'CARTOUCHE', 'Remember the glyphs · SUN out · MOON in · SCARAB diagonal', '#ffd86a', 150);
        ev(sim, T, 'cartouche');
      },
      tick(sim, T, m, here, b) {
        const P = NEF.cart, K = T.o.cart; if (!K) return;
        if (m.t <= m.g.length * m.w && m.t % m.w === 1) { K.shown = Math.min(m.g.length, K.shown + 1); ev(sim, T, 'glyph', { n: K.shown, g: m.g[K.shown - 1] }); }
        if (m.t === m.hide) K.hidden = 1;
        for (let i = 0; i < m.g.length; i++) {
          if (m.t !== m.r0 + i * m.ev - m.lead) continue;
          const o = bxy(T, b), g = m.g[i]; K.next = i + 1;
          if (g === 'sun') tele(T, { k: 'csun', sh: 'circle', x: o.x, y: o.y, r: P.sunR, d: m.lead, pct: P.pct, pos: 1, what: 'cartouche: sun', n: i + 1 });
          else if (g === 'moon') tele(T, { k: 'cmoon', sh: 'donut', x: o.x, y: o.y, r0: P.moonR0, r: R * 2, d: m.lead, pct: P.pct, cue: 'close', pos: 1, what: 'cartouche: moon', n: i + 1 });
          else { const grp = 'cx' + T.tid; for (const a of [0, Math.PI / 2]) tele(T, { k: 'cscarab', sh: 'line', x: r0(o.x - Math.cos(a) * R * 1.2), y: r0(o.y - Math.sin(a) * R * 1.2), ang: r2(a), len: R * 2.4, w: P.laneW, d: m.lead, pct: P.pct, grp, pos: 1, what: 'cartouche: scarab', n: a ? 0 : i + 1, quiet: a ? 1 : 0 }); }
        }
      },
      end(sim, T) { T.o.cart = null; },
    },
  };
  // (Eclipse variants: the same machinery with the door's rule turned over)
  const vary = (base, f) => ({ ...base, start(sim, T, m, here, b) { f(m); return base.start(sim, T, m, here, b); } });
  M.balanceI = vary(M.balance, (m) => { m.inv = 1; });
  M.pinaxR = vary(M.pinax, (m) => { m.rev = 1; });
  M.verdictE = vary(M.verdict, (m) => { m.inv = 1; });
  return M;
}
