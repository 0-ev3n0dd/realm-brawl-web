// Part F3: THE ULTIMATE's rewards — PRESTIGE ONLY (docs/ASCENSION-PLAN.md Part F). A clear (unlock flag 'ultc', set by
// sim/ultimate.js victory for every party member, never in practice) grants looks and a record, never power:
//   title    "the Unwritten" (shown on the account card and every hero card)
//   aura     Unwritten Pages: blank pages orbit a gold ink ring under the hero
//   glow     Quillfire: a gold quill flame on the weapon hand
//   regalia  the Unwritten Regalia: an ink-and-gold mantle with a floating quill crown (a cosmetic overlay, not an item:
//            nothing to equip, roll, sell or lose, so it can never carry a stat)
//   record   profile.ult = { t: best clear (s), n: clears, att: attempts on the best clear, ps: party size, at: date }
// Co-op: the flag rides the remote-player packet (net/protocol.js ark bit 16), so the party sees each other's looks.
export const ULT_TITLE = 'the Unwritten';
export const ULT_PRESTIGE = Object.freeze([
  Object.freeze({ id: 'title', kind: 'title', name: 'Title: the Unwritten', text: 'Shown on your account card and every hero card' }),
  Object.freeze({ id: 'pages', kind: 'aura', name: 'Unwritten Pages', text: 'Blank pages orbit a gold ink ring under your hero' }),
  Object.freeze({ id: 'quill', kind: 'glow', name: 'Quillfire', text: 'A gold quill flame burns on your weapon hand' }),
  Object.freeze({ id: 'regalia', kind: 'cosmetic', name: 'Unwritten Regalia', text: 'An ink-and-gold mantle and a floating quill crown' }),
  Object.freeze({ id: 'record', kind: 'record', name: 'The Clear Record', text: 'Your best clear time, attempts and party size on the account card' }),
]);
/** every key a reward may carry: anything else (a stat, an item, gold, XP) is a bug — test/ascF3.test.js */
export const ULT_REWARD_KEYS = Object.freeze(['id', 'kind', 'name', 'text']);
export const hasUltPrestige = (p) => !!(p && (p.ultc || (p.unlocks && p.unlocks.ultc)));
/** a clear's record into the profile (client side, from the victory event); returns true when it changed */
export function recordUltClear(pr, ev, now = Date.now()) {
  if (!pr || !ev || !(ev.t > 0)) return false;
  const R = pr.ult || (pr.ult = { t: 0, n: 0, att: 0, ps: 0, at: 0 });
  R.n = (R.n | 0) + 1;
  if (!R.t || ev.t < R.t) { R.t = ev.t | 0; R.att = (ev.attempts | 0) + 1; R.ps = ev.n | 0; R.at = now; }
  return true;
}
export const fmtUlt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
