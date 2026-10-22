// Savage mode (encounter revamp Part 0S, docs/ENCOUNTER-REVAMP-PLAN.md "Savage mode"). The Astral trial tier:
//   doors    in Astral mode (sim.astral, the host's Realm Gate toggle; needs an Ascended hero) a boss that HAS a Savage shows ONE door: Savage.
//            Its Trial / Extreme doors are hidden for that run (Normal mode keeps them exactly as they are). A boss whose Savage is not
//            built yet keeps its Trial / Extreme doors in Astral (nobody loses content while the revamp ships one boss at a time).
//   unlock   every Savage opens together with Astral mode (no per-boss gate). Clearing ALL five Savages (account-wide clear keys)
//            unlocks the Ultimate; until all five are built the old gate (Astrael Extreme) still opens it too, and an account that
//            already has the Ultimate keeps it.
//   fails    strict solves give a VULN stack (+25% damage taken, 30 s, refreshed by a new stack); a 2nd live stack = KO. One readable
//            cause per failure (the death recap names the check). Only the named wipe checks (the enrage, the final-phase check) wipe.
//   rewards  every clear: Astral drops + the boss's tokens + 1 Savage Mark (meta.js TRIAL_DROPS). The FIRST clear of a week: the Savage
//            coffer (a tier-7 Legendary of the boss's Extreme family, a slot you don't own yet first) + 4 more Marks (= 5). The first-ever
//            clear: the title "<Boss> Savage" (a collection entry + an aura glow, client). 16 Marks buy a Savage weapon at the
//            Quartermaster (village.js SAVAGE_SHOP).
//   practice the Practice door starts a Savage at any phase (sim/practice.js, no rewards).
import { astralAllowed } from './astral.js';

/** the five bosses. built = its Savage exists (sim/trials.js FIGHTS[k].s); mission = its board / door id; clear = the account clear key */
export const SAVAGE = {
  nf: { k: 'nf', name: 'Neferakh Savage', boss: 'Neferakh', mission: 'neferakhs', len: 'nfs', clear: 'nfsc', title: 'Neferakh Savage', col: '#ff6a3d', built: true, hide: ['neferakht', 'neferakhx'] },
  sk: { k: 'sk', name: 'Skaldra Savage', boss: 'Skaldra', mission: 'skaldras', len: 'sks', clear: 'sksc', title: 'Skaldra Savage', col: '#7fd8ff', built: false, hide: ['skaldrat', 'skaldrax'] },
  py: { k: 'py', name: 'Pyrrhex Savage', boss: 'Pyrrhex', mission: 'pyrrhexs', len: 'pys', clear: 'pysc', title: 'Pyrrhex Savage', col: '#ff5a2a', built: false, hide: ['pyrrhext', 'pyrrhexx'] },
  vh: { k: 'vh', name: 'Vharok Savage', boss: 'Vharok', mission: 'vharoks', len: 'vhs', clear: 'vhsc', title: 'Vharok Savage', col: '#b8a0ff', built: false, hide: ['vharokt', 'vharokx'] },
  as: { k: 'as', name: 'Astrael Savage', boss: 'Astrael', mission: 'astraels', len: 'ass', clear: 'assc', title: 'Astrael Savage', col: '#ffe9a8', built: false, hide: ['astrael', 'astraelx'] },
};
export const SAVAGE_IDS = Object.keys(SAVAGE);
export const SAVAGE_BUILT = SAVAGE_IDS.filter((k) => SAVAGE[k].built);
export const SAVAGE_MISSION = Object.fromEntries(SAVAGE_IDS.map((k) => [SAVAGE[k].mission, k]));
/** the fail model */
export const VULN = { mul: 0.25, t: 30 * 60, ko: 2 };
/** rewards (meta.js TRIAL_DROPS pays the per-clear Mark; these are the extras) */
export const SAVAGE_REWARD = { weekMarks: 4, coffer: { tier: 7, lv: 46 }, weaponMarks: 16, pieceMarks: 8 };

/** can this hero (the host) run Savages? = Astral mode is unlocked for its account */
export const savageOpen = (p) => astralAllowed(p);
/** in a run's mode (astral 0/1): is this mission id hidden (an Astral-mode Trial / Extreme door that Savage replaced)? */
export function doorHidden(id, astral) {
  if (SAVAGE_MISSION[id]) return !astral || !SAVAGE[SAVAGE_MISSION[id]].built; // (a Savage door: Astral only, built only)
  if (!astral) return false;
  return SAVAGE_BUILT.some((k) => SAVAGE[k].hide.includes(id));
}
/** has the account cleared every Savage? (built or not: the Ultimate gate needs all five) */
export const allSavagesClear = (u) => !!u && SAVAGE_IDS.every((k) => u[SAVAGE[k].clear]);
/** the week number (UTC Mondays) a weekly first clear is keyed on */
export const savageWeek = (now = Date.now()) => Math.floor((now / 86400000 + 3) / 7);
export const weekKey = (k, now = Date.now()) => `${SAVAGE[k].len}w${savageWeek(now)}`;

/** a failed strict solve: one Vuln stack (refreshed); the KO stack kills. Returns 'ko' | 'vuln'. */
export function vulnHit(sim, p, by, kill) {
  if (!p || p.dead) return null;
  const live = p.svVuln && p.svVuln.until > sim.tick ? p.svVuln.n : 0, n = live + 1;
  p.svVuln = { n, until: sim.tick + VULN.t, by };
  sim.emit({ type: 'savage', ph: 'vuln', pid: p.id, n, by, x: Math.round(p.x), y: Math.round(p.y) });
  if (n >= VULN.ko) { p.svVuln = null; kill(p, `${by} (a second Vuln stack)`); return 'ko'; }
  return 'vuln';
}
/** the damage-taken multiplier of a hero's live Vuln (combat hook) */
export const vulnMul = (sim, p) => (p && p.svVuln && p.svVuln.until > sim.tick ? 1 + VULN.mul * p.svVuln.n : 1);

/** the title each first-ever Savage clear grants (client profile pr.titles) */
export const SAVAGE_TITLE = { nfsc: 'Black Sun Breaker', sksc: 'Stormcrown Breaker', pysc: 'Pyre Breaker', vhsc: 'Hollow Breaker', assc: 'Astral Breaker' };
