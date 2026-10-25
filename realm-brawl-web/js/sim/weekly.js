// Game loop B3 (2026-10-09): the Weekly Board at the Mission Counter. Pure function of the date (like the weekly mission
// modifiers in sim/opsmods.js, same Monday 00:00 UTC rollover), so the server, every client and the tests agree:
//   featured  one mission (type x map, rotating through all 20) that carries this week's twist + boon; its grade reward
//             is x1.25 (sim/ops.js)
//   region    a bonus spawn region (one Wilds ring or a map): +50% materials picked up there, Swarm events every ~2 min
//   trial     one Trial / Extreme with a free Realm Gate key (claim once a week)
//   oneTime   3 big rewards: the featured mission at A or better (a set piece of your choice), 3 Swarms cleared in the
//             region (a Trial token), the featured Trial cleared (+4 bag slots, twice per account; then gold + keys)
// Plus the first-S chests: the first S grade per mission type per map pays a one-time chest (20 in all).
// Progress lives in the client profile: pr.weekly = { week, done: {}, prog: {}, key: 0 }, pr.firstS = { 'type:biome': 1 }.
import { ASC, grantPiece } from './ascension.js';
import { weeklyMods, weekIndex, WEEK0 } from './opsmods.js';
import { OPS_TYPES, OPS_BIOMES, OPS_TYPE, OPS_BIOME } from './opsconst.js';

const secs = (s) => Math.round(s * 60);
export const WK = { featMul: 1.25, regionMat: 0.5, swarmFirst: secs(30), swarmEvery: secs(45), swarmNeed: 3, fissureNeed: 3, fissureDust: 10, fissureGold: 1500, featGrade: 'A', bagGrants: ['wk1', 'wk2'], bag: 4,
  trialGold: 2000, firstS: { gold: 2000, xp: 1500, keys: 1, mats: 3 } };
/** the featured-mission roll's maps (riftweekly: the Astral Rift joins the roll; the weeks reshuffled once, on purpose) */
export const WK_BIOMES = OPS_BIOMES.slice();
export const WK_REGIONS = ['w1', 'w2', 'w3', 'w4', 'dunes', 'frost', 'ember', 'rift'];
export const REGION_NAME = { w1: 'Greenwood Glade (Wilds)', w2: 'Stonefang Hills (Wilds)', w3: 'Ashen Wilds', w4: 'Dread Frontier (Wilds)', dunes: 'Sunscorch Dunes', frost: 'Frostveil Peaks', ember: 'Emberdeep Caldera', rift: 'The Astral Rift' }; // (riftweekly: in the region roll too)
export const WK_TRIALS = ['neferakht', 'skaldrat', 'pyrrhext', 'astrael', 'neferakhx', 'skaldrax', 'pyrrhexx', 'astraelx', 'vharokt', 'vharokx']; // (2026-10-18: + the Wilds Trial, appended; Savages are never featured: Astral-only)
export const TRIAL_NAME = { vharokt: 'Vharok, the Stormhorn (Trial)', vharokx: 'Vharok, the Stormhorn (Extreme)', neferakht: 'Neferakh Unbound (Trial)', neferakhx: 'Neferakh Unbound (Extreme)', neferakhs: 'Neferakh Unbound (Savage)', skaldrat: 'Skaldra (Trial)', skaldrax: 'Skaldra (Extreme)', pyrrhext: 'Pyrrhex (Trial)', pyrrhexx: 'Pyrrhex (Extreme)', astrael: 'Astrael (Trial)', astraelx: 'Astrael (Extreme)' };
/** the token a featured Trial's one-time reward pays */
export const TRIAL_TOKEN = { vharokt: 'storm_sigil', vharokx: 'thunder_heart', neferakht: 'sun_sigil', neferakhx: 'sun_sigil', neferakhs: 'savage_mark', skaldrat: 'rime_sigil', skaldrax: 'frozen_heart', pyrrhext: 'cinder_sigil', pyrrhexx: 'molten_core', astrael: 'star_shard', astraelx: 'astral_heart' };
/** the trophy material of a map (first-S chests) and its Trial key */
export const BIOME_TROPHY = { wilds: 'warlord_tusk', dunes: 'queen_scale', frost: 'wyrm_scale', ember: 'heart_ember', rift: 'void_crest' };
const m = (a, n) => ((a % n) + n) % n;
/** this week's board. Pure. */
export function weeklyBoard(ms = Date.now()) {
  const w = weekIndex(ms), mods = weeklyMods(ms), cell = m(w * 7 + 3, OPS_TYPES.length * WK_BIOMES.length);
  return {
    week: w, ends: WEEK0 + (w + 1) * 7 * 864e5, mods: mods.ids,
    featured: { type: OPS_TYPES[cell % OPS_TYPES.length], biome: WK_BIOMES[Math.floor(cell / OPS_TYPES.length)] },
    region: WK_REGIONS[m(w * 3 + 1, WK_REGIONS.length)],
    trial: WK_TRIALS[m(w * 5 + 2, WK_TRIALS.length)],
  };
}
export const isFeatured = (B, type, biome) => !!B && B.featured.type === type && B.featured.biome === biome;
/** the site key a region covers ('w1'..'w4' or a map key) */
export const inRegion = (B, siteKey) => !!B && !!siteKey && B.region === siteKey;
export const ONE_TIME = [
  { id: 'feat', name: 'Featured mission', text: (B) => `Clear ${OPS_TYPE[B.featured.type].name} · ${OPS_BIOME[B.featured.biome].name} at grade A or better`, reward: (B) => `A set piece of your choice from the ${OPS_BIOME[B.featured.biome].name} set` },
  { id: 'swarm', name: 'Bonus region', text: (B) => `Clear ${WK.swarmNeed} Swarm events in ${REGION_NAME[B.region]}`, reward: (B) => `1 ${TRIAL_TOKEN[B.trial].replace(/_/g, ' ')} (Trial token)` },
  { id: 'fissure', name: 'Astral Fissures', text: () => `Close ${WK.fissureNeed} Astral Fissures on any map`, reward: () => `${WK.fissureDust} Astral Dust + ${WK.fissureGold} gold` },
  { id: 'soul', name: 'Ascension', text: () => 'Clear Astrael (Astral Trial or Savage)', reward: () => '1 Astral Soul for the hero who claims it (guaranteed)' }, // (Part B)
  { id: 'trial', name: 'Featured Trial', text: (B) => `Clear ${TRIAL_NAME[B.trial]}`, reward: () => `+${WK.bag} bag slots (twice per account), then ${WK.trialGold} gold + 2 keys` },
];
/** the profile's weekly state for this board (resets on a new week) */
export function weeklyState(pr, B) {
  const W = pr.weekly;
  if (!W || W.week !== B.week) pr.weekly = { week: B.week, done: {}, claimed: {}, prog: {}, key: 0 };
  const S = pr.weekly; S.done = S.done || {}; S.claimed = S.claimed || {}; S.prog = S.prog || {};
  return S;
}
/** progress the board: t = { kind: 'ops', type, biome, g } | { kind: 'swarm', key } | { kind: 'clear', mission }. The ids done just now. */
export function weeklyTick(pr, B, t) {
  const S = weeklyState(pr, B), out = [];
  const done = (id) => { if (!S.done[id]) { S.done[id] = 1; out.push(id); } };
  if (t.kind === 'ops' && isFeatured(B, t.type, t.biome) && ['S', 'A'].includes(t.g)) done('feat');
  if (t.kind === 'swarm' && inRegion(B, t.key)) { S.prog.swarm = Math.min(WK.swarmNeed, (S.prog.swarm | 0) + 1); if (S.prog.swarm >= WK.swarmNeed) done('swarm'); }
  if (t.kind === 'fissure') { S.prog.fissure = Math.min(WK.fissureNeed, (S.prog.fissure | 0) + 1); if (S.prog.fissure >= WK.fissureNeed) done('fissure'); } // (Part A4)
  if (t.kind === 'clear' && t.mission === B.trial) done('trial');
  if (t.kind === 'clear' && ASC.weeklySoul.includes(t.mission)) done('soul'); // (Part B: the weekly guaranteed Soul)
  return out;
}
/** claim a finished one-time reward (profile side, in place). Returns { ok, text, setPiece? (the client crafts it: { set, biome }) } */
export function claimWeekly(pr, B, id, keysTable = null, cls = null) {
  const S = weeklyState(pr, B);
  if (!S.done[id] || S.claimed[id]) return { ok: false };
  S.claimed[id] = 1;
  if (id === 'feat') return { ok: true, text: 'A set piece of your choice', setPiece: { set: OPS_BIOME[B.featured.biome].set, biome: B.featured.biome } };
  if (id === 'swarm') { const k = TRIAL_TOKEN[B.trial]; pr.mats = pr.mats || {}; pr.mats[k] = (pr.mats[k] | 0) + 1; return { ok: true, text: `+1 ${k.replace(/_/g, ' ')}` }; }
  if (id === 'fissure') { pr.mats = pr.mats || {}; pr.mats.astral_dust = (pr.mats.astral_dust | 0) + WK.fissureDust; pr.gold = (pr.gold | 0) + WK.fissureGold; return { ok: true, text: `+${WK.fissureDust} Astral Dust, +${WK.fissureGold} gold` }; }
  if (id === 'soul') { if (!cls || !grantPiece(pr, cls, 'soul')) { S.claimed[id] = 0; return { ok: false }; } return { ok: true, text: '+1 Astral Soul' }; }
  if (id === 'trial') {
    pr.bagGrants = Array.isArray(pr.bagGrants) ? pr.bagGrants : [];
    const gid = WK.bagGrants.find((g) => !pr.bagGrants.some((x) => x && x.id === g));
    if (gid) { pr.bagGrants.push({ id: gid, slots: WK.bag, label: 'Weekly Board' }); return { ok: true, text: `+${WK.bag} bag slots` }; }
    pr.gold = (pr.gold | 0) + WK.trialGold; pr.keys = pr.keys || {}; if (!keysTable || keysTable[B.trial]) pr.keys[B.trial] = (pr.keys[B.trial] | 0) + 2;
    return { ok: true, text: `+${WK.trialGold} gold, +2 ${TRIAL_NAME[B.trial]} keys` };
  }
  return { ok: false };
}
/** the featured Trial's free key (once a week) */
export function claimFreeKey(pr, B) { const S = weeklyState(pr, B); if (S.key) return false; S.key = 1; pr.keys = pr.keys || {}; pr.keys[B.trial] = (pr.keys[B.trial] | 0) + 1; return true; }
/** first S per mission type per map: a one-time chest (in place). Returns the chest or null. */
export function firstSChest(pr, type, biome, g) {
  if (g !== 'S' || !OPS_TYPE[type] || !OPS_BIOME[biome]) return null;
  pr.firstS = pr.firstS || {}; const k = `${type}:${biome}`;
  if (pr.firstS[k]) return null;
  pr.firstS[k] = 1;
  const F = WK.firstS, key = OPS_BIOME[biome].key, mat = BIOME_TROPHY[biome];
  pr.gold = (pr.gold | 0) + F.gold; pr.accXp = (pr.accXp | 0) + F.xp;
  pr.mats = pr.mats || {}; pr.mats[mat] = (pr.mats[mat] | 0) + F.mats;
  pr.keys = pr.keys || {}; pr.keys[key] = (pr.keys[key] | 0) + F.keys;
  return { type, biome, gold: F.gold, xp: F.xp, mat, n: F.mats, key };
}
export const firstSCount = (pr) => Object.keys(pr.firstS || {}).length;
