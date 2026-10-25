// The Frostveil / Emberdeep trials: arena geometry (no imports, so world.js / constants.js / the renderer can use it
// without cycles). Two far-off arenas north-west of the world: Skaldra's Hoarfrost Mirror and Pyrrhex's Heart-Chamber.
// The Trial and the Extreme of each boss share one arena (sim/trials.js runs whichever was picked).
export const TRIAL_POS = { sk: { x: -30000, y: -30000 }, py: { x: -27000, y: -30000 }, nf: { x: -24000, y: -30000 }, ul: { x: -21000, y: -30000 } }; // (Part F: 'ul' = the Ultimate's Unwritten Throne, sim/ultimate.js) // (game loop A2: Neferakh Unbound's Sun-Eaten Throne)
export const TRIAL_R = 560;
export const TRIAL_NAMES = { sk: 'The Hoarfrost Mirror', py: 'The Heart-Chamber', nf: 'The Sun-Eaten Throne', ul: 'The Unwritten Throne' };
/** Which trial arena (x, y) is in ('sk' | 'py' | null), with a margin. */
export function trialAt(x, y, pad = 300) {
  if (y > -28000 || x > -19000) return null;
  for (const k of ['sk', 'py', 'nf', 'ul']) { const C = TRIAL_POS[k]; if (Math.hypot(x - C.x, y - C.y) < TRIAL_R + pad) return k; }
  return null;
}
/** Is (x, y) in a trial arena (disc plus a margin)? Movement there is clamped to the disc, not the world. */
export const inTrialArea = (x, y, pad = 300) => !!trialAt(x, y, pad);
/** kills in a trial arena drop that trial's materials (sim/meta.js biomeAt) */
export const trialBiome = (x, y) => { const k = trialAt(x, y); return k === 'sk' ? 'sktrial' : k === 'py' ? 'pytrial' : k === 'nf' ? 'nftrial' : null; };
/** the danger zone shown in the HUD inside a trial */
export const TRIAL_ZONE = { id: 70, name: 'Trial', danger: 8, r0: 0, r1: 0, tier: 5, trial: true };
/** the victory exit portal: below the boss, clear of the bottom HUD */
export const TRIAL_EXIT_DY = 260;
