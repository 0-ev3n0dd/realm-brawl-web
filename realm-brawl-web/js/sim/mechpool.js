// Part A2 — the mechanic-variation engine. A phase is a POOL of mechanic families (each entry a rotation key such as
// 'charge' or 'charge+hail'; the family is the first part). Per attempt a seeded order is drawn:
//   none  (Normal)   : the authored order, every cycle (learnable, unchanged)
//   light (Astral)   : the order is shuffled each cycle, variants fixed
//   full  (Savage)   : shuffled + each cast rolls a variant (mirror / inside-out ...)
//   deep  (Ultimate) : full + the variant roll also flips direction and the gaps tighten (never below the tell)
// Never two casts of the same family back to back (also across cycle seams). Every telegraph a pooled fight spawns
// carries a visible TELL of at least TELL_MIN ticks (2 s) before it lands, rendered by client/telefx.js.
// Also: pure helpers for the new mechanic kinds (towers = party size, spread/stack marks, memory sequences, positional
// combos, must-kill adds with a soft enrage, hard enrage). Sim-agnostic: they return telegraph specs.
export const TELL_MIN = 120;
export const LEVELS = ['none', 'light', 'full', 'deep'];
export const TIER_LEVEL = { normal: 'none', astral: 'light', savage: 'full', ultimate: 'deep' };
export const famOf = (key) => String(key).split('+')[0];

/** tiny seeded rng (mulberry32) so a rotation is reproducible from (fight seed, attempt) */
export function mrng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** one cycle of `keys` in a random order with no adjacent same family, and first != `prev` family */
export function shuffleCycle(keys, rnd, prev = null) {
  for (let tries = 0; tries < 60; tries++) {
    const left = keys.slice(), out = []; let last = prev, ok = true;
    while (left.length) {
      const cand = left.map((k, i) => i).filter((i) => famOf(left[i]) !== last);
      if (!cand.length) { ok = false; break; }
      const i = cand[Math.floor(rnd() * cand.length)]; out.push(left[i]); last = famOf(left[i]); left.splice(i, 1);
    }
    if (ok) return out;
  }
  return keys.slice(); // (infeasible pools fall back to the authored order)
}
/** a rotation iterator for one phase */
export function makePool(keys, level = 'none', seed = 1) {
  const rnd = mrng(seed), L = LEVELS.indexOf(level) < 0 ? 0 : LEVELS.indexOf(level);
  let cyc = [], i = 0, last = null, n = 0;
  return {
    level, L,
    next() {
      if (i >= cyc.length) { cyc = L === 0 ? keys.slice() : shuffleCycle(keys, rnd, last); i = 0; }
      const key = cyc[i++]; last = famOf(key); n++;
      const v = L >= 2 ? Math.floor(rnd() * 2) : (n & 1) ^ 1; // variant 0/1 (none/light alternate like before)
      return { key, v, flip: L >= 3 && rnd() < 0.5, n };
    },
    rnd,
  };
}
/** the gap after a cast: deep tightens by 15% but never under the tell */
export const gapOf = (dur, level) => Math.max(TELL_MIN, Math.round(dur * (level === 'deep' ? 0.85 : 1)));
/** stretch a telegraph so its tell is >= TELL_MIN; tag it with a tell label */
export function withTell(t, label) { if (!t.warn) t.d = Math.max(TELL_MIN, t.d || 0); if (label && !t.tell) t.tell = label; return t; }

// ---------------------------------------------------------------- new mechanic kinds (pure spec builders)
/** towers: exactly one per living hero, spaced round the arena; each needs one soaker */
export function towers(A, nParty, rnd, d = 150) {
  const n = Math.max(1, nParty), a0 = rnd() * Math.PI * 2, R = A.r * 0.55, out = [];
  for (let i = 0; i < n; i++) { const a = a0 + (i / n) * Math.PI * 2; out.push({ k: 'tower', sh: 'tower', x: Math.round(A.x + Math.cos(a) * R), y: Math.round(A.y + Math.sin(a) * R), r: 70, n: 1, d, tell: 'SOAK' }); }
  return out;
}
/** spread/stack marks: spread on every hero, or one stack on a random hero (shared by everyone) */
export function marks(ps, rnd, stack, d = 150) {
  if (!ps.length) return [];
  if (stack) { const p = ps[Math.floor(rnd() * ps.length)]; return [{ k: 'stack', sh: 'stack', pid: p.id, x: Math.round(p.x), y: Math.round(p.y), r: 110, n: ps.length, d, tell: 'STACK' }]; }
  return ps.map((p) => ({ k: 'spread', sh: 'spread', pid: p.id, x: Math.round(p.x), y: Math.round(p.y), r: 120, d, tell: 'SPREAD' }));
}
/** memory: a sequence of `len` quadrant cones SHOWN one by one (warn), then replayed in the same order (hidden) */
export function memory(cx, cy, len, rnd, show = 40, d0 = 160, gap = 45) {
  const seq = []; let last = -1;
  for (let i = 0; i < len; i++) { let q = Math.floor(rnd() * 4) % 4; if (q === last) q = (q + 1 + Math.floor(rnd() * 3)) % 4; if (q === last) q = (q + 1) % 4; seq.push(q); last = q; }
  const out = [];
  seq.forEach((q, i) => {
    const ang = q * Math.PI / 2 + Math.PI / 4;
    out.push({ k: 'memshow', sh: 'cone', x: cx, y: cy, ang, arc: Math.PI / 2, r: 900, d: show, at: i * show, warn: 1, tell: String(i + 1) });
    out.push({ k: 'mem', sh: 'cone', x: cx, y: cy, ang, arc: Math.PI / 2, r: 900, d: Math.max(TELL_MIN, d0 + len * show + i * gap), mem: 1, tell: 'MEMORY ' + (i + 1) });
  });
  return { seq, tele: out };
}
/** positional combo: front then back (or in then out); returns two telegraphs in order */
export function combo(b, ang, flip, d = 130, gap = 60) {
  const a1 = flip ? ang + Math.PI : ang;
  return [{ k: 'combo', sh: 'cone', x: b.x, y: b.y, ang: a1, arc: Math.PI, r: 700, d: Math.max(TELL_MIN, d), tell: 'THEN BEHIND' },
    { k: 'combo', sh: 'cone', x: b.x, y: b.y, ang: a1 + Math.PI, arc: Math.PI, r: 700, d: Math.max(TELL_MIN, d) + gap, tell: 'BEHIND' }];
}
/** must-kill adds: soft enrage time (ticks) by party size; enrage state helpers */
export const softEnrageT = (n) => 60 * (18 + 2 * Math.max(0, n - 1));
export const hardEnrage = (st, t) => !!st && t >= st;
