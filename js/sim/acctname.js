// Account names (2026-10-15): the player's own name, shared by every hero on the account.
// Shared by the client (prompt / Options / title) and the server (co-op join + live rename), so both apply the same rules.
export const ACCT_MIN = 3, ACCT_MAX = 16;
const ALLOWED = /^[A-Za-z0-9 _-]+$/;
// a small, basic filter (whole-name substring match after stripping separators + common digit swaps)
const BLOCK = ['fuck', 'shit', 'cunt', 'bitch', 'nigg', 'fag', 'whore', 'slut', 'rape', 'nazi', 'dick', 'cock', 'pussy', 'asshole', 'retard'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b' };
export function isProfane(s) {
  const k = String(s || '').toLowerCase().replace(/[0-9]/g, (d) => LEET[d] || d).replace(/[^a-z]/g, '');
  return BLOCK.some((w) => k.includes(w));
}
/** trim + collapse inner spaces; returns { ok, name, err } */
export function validateAccountName(raw) {
  const name = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
  if (name.length < ACCT_MIN) return { ok: false, name, err: `At least ${ACCT_MIN} characters.` };
  if (name.length > ACCT_MAX) return { ok: false, name, err: `At most ${ACCT_MAX} characters.` };
  if (!ALLOWED.test(name)) return { ok: false, name, err: 'Letters, numbers, spaces, _ and - only.' };
  if (isProfane(name)) return { ok: false, name, err: 'Please pick a different name.' };
  return { ok: true, name, err: '' };
}
/** the cleaned name, or '' when invalid */
export const cleanAccountName = (raw) => { const v = validateAccountName(raw); return v.ok ? v.name : ''; };
/** player-facing label: the account name, falling back to the hero name when there is none */
export const playerLabel = (acct, heroName) => acct || heroName || 'Hero';
/** 'Casual - Brakka the Warlord' style subtitle line */
export const heroSubtitle = (H) => (H && H.title ? `${H.name} ${/^the\b/i.test(H.title) ? H.title : '· ' + H.title}` : (H && H.name) || '');
