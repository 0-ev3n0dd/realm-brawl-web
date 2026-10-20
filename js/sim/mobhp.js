// Mob HP: ONE level-based curve for every normal mob and elite (2026-10-08). Built for a level cap of 50 (today: 20).
//
//   normal HP = NORMAL(L) x (type HP / mean fodder HP of the zone's roster) x ROLE x tweak.n x ramp
//   elite  HP = NORMAL(L) x ELITE_X(L) x (type HP / mean elite HP of the zone's elites) x tweak.e x ramp
//
//   L        the zone's mob level (ZONE_LV below: the level a hero there typically is; future zones just set one)
//   NORMAL   HP of the zone's average horde normal (spawn-site / mission fodder) = MOB_CURVE.n1 x exp(growth) x early
//            growth = g x - c x^2 (x = L - 1): +8.3 %/level at L1 tapering to +6.8 % at 20 and +4.4 % at 50 (it tracks
//            on-level hero damage, tools/balance/mobpower.mjs + mobhp.mjs); past 50 the level eases off (never past Lv 60 HP)
//            early  = the starter ramp (Greenwood one-shot-ish, Stonefang ramping in): early0 at L1 -> 1 by L earlyTo
//   ELITE_X  elite / normal HP ratio: e1 at L1, + eg per level (elites gain a little on normals: hero single-target dps
//            outgrows the per-hit size slowly)
//   type     a type keeps its heft relative to its roster (a golem is ~2.5x a wisp) but the zone's AVERAGE is the curve
//            (rosters: the sitegen site rosters, the mission biome rosters, the dungeons' own wave lists: registerWaves)
//   ROLE     fodder 1 (horde streams), wave 1.1 (dungeon room waves: few at a time, full defence), normal 1.8 (camp
//            packs, horde leads, splits: the old 1 / 0.55 fodder share)
//            (+ spawn-site casters: x1.6 on top, sim/sites.js)
//   tweak    per-zone fine tuning (ZONE_LV, default 1): kept small (0.8 - 1.25), a starting point, not a second curve
//   ramp     mission escalation only: Defense +15 % per round, Swarm +8 % per minute (opsconst roundMul / mulPerMin)
//   mission bosses: the Assault Gatekeeper = OPS.assault.bossHp (7) x the mission's average elite (~20 s solo), the Capture
//            target = OPS.capture.hpMul (4) x it (~12 s of focus, it flees + blinks: 60 s to escape) (sim/ops.js)
//   then co-op: x the party HP bump (sim.partyHpMul / fodderPartyMul) as before.
// It replaces every older HP stack: the zone table of v2026.1008, the elite pack 1.15x, the Dunes / Frost / Ember ring
// multipliers (DUNES_MUL / FROST_MUL x FROST_HP / EMBER_MUL x EMBER_HP), the dungeon x1.7 / x1.9, the mission biome
// mul x hpMul, the fodder 0.55 share and the x3 elite bump. Those multipliers still drive enemy DAMAGE (unchanged).
// Exempt (keep their own HP): bosses + the raid, boss summons / mechanic adds (spawnEnemy opts.zoneHp === false), the
// training dummy, and any spot without a ZONE_LV row (the town).
import { ENEMIES } from './data/enemies.js';
import { SITE_ROSTERS } from './sitegen.js';
import { OPS_BIOME } from './opsconst.js';

export const MAX_MOB_LEVEL = 50; // (the planned hero level cap: the curve is tuned to here)
export const MOB_CURVE = {
  n1: 352, g: 0.0828, c: 0.0004, // NORMAL(L) = n1 x exp(g x - c x^2) x early, x = L' - 1: +8.3 %/level at L1, +6.8 % at 20, +4.4 % at 50
  soft: 10, // past MAX_MOB_LEVEL the level eases off: L' = 50 + soft (1 - e^-(L-50)/soft) -> never past "Lv 60" HP (x1.5 of Lv 50)
  early0: 0.3, earlyTo: 8, // starter ramp: x early0 at L1 easing to x1 at L earlyTo (Greenwood ~1.25 hits, Stonefang ~2)
  e1: 18.5, eg: 0.25, // ELITE_X(L) = e1 + eg (L' - 1): x18.75 at L2, x23 at 20, x31 at 50
};
// mobhp3 (2026-10-15, "normal mobs die too fast"): camp / wave normals x2 (~5-8 basic hits, ~2-4 s of single-target focus at
// equal level, tools/balance/mobttk.mjs), horde fodder x1.6 (AoE still clears streams); elites + bosses unchanged (elites stay
// ~5x a camp normal's time-to-kill)
export const ROLE = { fodder: 1.6, wave: 2.2, normal: 3.6 };

//  id: [name, mob level, roster, tweak normal, tweak elite, tuned-at level (game loop C1 re-band: damage / XP scale from it, sim/levelscale.js)]   roster: a sitegen SITE_ROSTERS key, 'ops:<biome>' or 'dg:<dungeon>'
// game loop C2 (2026-10-09): the re-band for the level cap 50: Dunes 13-19 + Tomb 20, Frost 21-29 + Crypt 30, Emberdeep
// 31-39 + Forge 40, missions at the band's middle + 1 (the 6th field: the level each was tuned at, sim/levelscale.js)
export const ZONE_LV = {
  1: ['Greenwood Glade', 2, 'w1', 0.9, 1.3],
  2: ['Stonefang Hills', 5, 'w2'],
  3: ['Ashen Wilds', 8, 'w3'],
  4: ['Dread Frontier', 11, 'w4', 1, 0.85],
  12: ['The Glowmire Hollow', 12, 'dg:hollow', 1, 1], // (2026-10-18: the Wilds' dungeon, before the Dunes)
  21: ['Glassbead Flats', 13, 'dunes', 1, 1, 12],
  22: ['Scarab Wastes', 15, 'dunes', 0.92, 1, 13], // (map step pass: 1.05 -> 0.92, it measured ~1.6x Sunscar Rim's time-to-kill)
  23: ['Mirage Expanse', 17, 'dunes', 1, 1, 14],
  24: ['Sunscar Rim', 19, 'dunes', 1.08, 1, 15],
  41: ['Rimeshore Tundra', 21, 'frost', 1, 1, 16],
  42: ['Pinegloom Taiga', 24, 'frost', 1, 1, 17],
  43: ['Shardglass Glacier', 27, 'frost', 1, 1, 18],
  44: ["Skaldra's Crown", 29, 'frost', 1.12, 1, 19],
  61: ['Ashfall Flats', 31, 'ember', 1.1, 1, 19],
  62: ['Basalt Wastes', 34, 'ember', 1.05, 1, 20],
  63: ['The Magma Rift', 37, 'ember', 1, 1, 21],
  64: ['The Caldera Heart', 39, 'ember', 1, 1.2, 22],
  30: ['Tomb of the Sun-Eaten King', 20, 'dg:tomb', 1, 1, 15],
  50: ['The Glacier Crypt', 30, 'dg:crypt', 1, 1, 19],
  60: ['The Forge of Cinders', 40, 'dg:forge', 1, 1, 22],
  81: ['Missions: The Wilds', 8, 'ops:wilds'],
  82: ['Missions: Sunscorch Dunes', 17, 'ops:dunes', 1, 1, 14],
  83: ['Missions: Frostveil Peaks', 26, 'ops:frost', 1, 1, 18],
  84: ['Missions: Emberdeep Caldera', 36, 'ops:ember', 1, 1, 21],
  // game loop C3: Map 5, the Astral Rift (41-48; Danger 4-7 base stats like Emberdeep's, so the same tuned-at ladder) + its missions
  101: ['The Shattered Steppe', 41, 'rift', 1.3, 1, 19],
  102: ['Voidglass Barrens', 43, 'rift', 1, 1, 20],
  103: ['The Starwell Reaches', 45, 'rift', 1, 1, 21],
  104: ['The Breach', 48, 'rift', 1, 1.1, 22],
  85: ['Missions: The Astral Rift', 46, 'ops:rift', 1, 0.95, 21],
};

// Map durability step (2026-10-15): on top of the level curve, harder maps field tankier normals AND elites (same factor:
// elites stay ~5x a normal's focus time), so seconds-of-focus at equal level climb with the map: Haven 1 : Dunes ~1.25 :
// Frost / Ember ~1.5 : Rift ~1.9 (tools/balance/mobttk.mjs). Bosses and mission bosses (zoneEliteHp) are not stepped.
export const MAP_STEP = { haven: 1, dunes: 1, frost: 1.2, ember: 1.2, rift: 1.7 };
export function mapOf(roster) {
  const r = String(roster || '');
  return /dunes|tomb/.test(r) ? 'dunes' : /frost|crypt/.test(r) ? 'frost' : /ember|forge/.test(r) ? 'ember' : /rift/.test(r) ? 'rift' : 'haven';
}
export const mapStep = (z) => MAP_STEP[mapOf(z && z.roster)] ?? 1;
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
/** the curve level: L up to MAX_MOB_LEVEL, then easing off towards MAX_MOB_LEVEL + soft (smooth: same slope at 50) */
export function curveLevel(L) { const C = MOB_CURVE; return L <= MAX_MOB_LEVEL ? Math.max(1, L) : MAX_MOB_LEVEL + C.soft * (1 - Math.exp(-(L - MAX_MOB_LEVEL) / C.soft)); }
/** game loop C1 (level cap 50): past L22 (the old top of the content) the curve follows the MEASURED on-level hero power of
 *  the new gear ladder (tools/balance/mobpower.mjs --levels 1-50, out/lvpower.json: Rimewarden t5 -> t6 by 30, Caldera
 *  t6 -> t7 by 40, t7 -> t8 at the cap, Trial / Extreme pairs): solo dps x1.86 at 30, x3.2 at 40, x4 at 50 vs L20, fit
 *  as exp(a d - b d^2), d = L - 20. Up to L22 nothing changed. */
export const HI_CURVE = { from: 22, a: 0.06873, b: 0.000782 }; // (slope 6.56 %/level at 22 = the old curve's, x3.4 from 22 to 50, 2.1 %/level at 50)
const hiFit = (L) => { const d = L - 20; return HI_CURVE.a * d - HI_CURVE.b * d * d; };
function baseHp(L) {
  const C = MOB_CURVE, x = Math.max(1, L) - 1;
  return C.n1 * Math.exp(C.g * x - C.c * x * x) * (C.early0 + (1 - C.early0) * smooth((L - 1) / (C.earlyTo - 1)));
}
/** HP of the average horde normal of a level-L zone (any L >= 1) */
export function normalHp(L) {
  const cl = curveLevel(L), F = HI_CURVE.from;
  return cl <= F ? baseHp(cl) : baseHp(F) * Math.exp(hiFit(cl) - hiFit(F));
}
/** elite / normal HP ratio at level L */
export function eliteX(L) { const C = MOB_CURVE; return C.e1 + C.eg * (curveLevel(L) - 1); }
/** HP of the average elite of a level-L zone */
export function eliteHp(L) { return normalHp(L) * eliteX(L); }

const WAVES = {}; // 'dg:<key>' -> { f: wave normals, e: wave elites } (registered by tomb.js / crypt.js / forge.js)
/** a dungeon's own roster from its room wave lists ('type!' = a guaranteed elite): its wave trash averages the curve */
export function registerWaves(key, rooms) {
  const all = rooms.flatMap((r) => r.waves.flat()), el = all.filter((k) => k.endsWith('!')).map((k) => k.slice(0, -1));
  WAVES['dg:' + key] = { f: all.filter((k) => !k.endsWith('!')), e: el.length ? el : all };
  MEANS = null;
}
let MEANS = null; // roster -> { f: mean normal HP, e: mean elite HP } (lazy: no import-order traps)
function rosterMeans(key) {
  if (!MEANS) {
    MEANS = {};
    const avg = (l) => l.reduce((s, t) => s + ENEMIES[t].hp, 0) / l.length;
    for (const k in WAVES) MEANS[k] = { f: avg(WAVES[k].f), e: avg(WAVES[k].e) };
    for (const k in SITE_ROSTERS) MEANS[k] = { f: avg(SITE_ROSTERS[k].f), e: avg(SITE_ROSTERS[k].e) };
    for (const b in OPS_BIOME) MEANS['ops:' + b] = { f: avg(SITE_ROSTERS[OPS_BIOME[b].roster].f), e: avg(OPS_BIOME[b].elites) };
  }
  return MEANS[key];
}
/** the ZONE_LV row of a zone (object or id), or null (no level: not on the curve) */
export function zoneLv(zone) {
  const id = zone && typeof zone === 'object' ? zone.id : zone, r = ZONE_LV[id];
  return r ? { id, name: r[0], L: r[1], roster: r[2], tn: r[3] ?? 1, te: r[4] ?? 1, was: r[5] ?? r[1] } : null; // (was: game loop C1, the level its damage / XP were tuned at)
}
/** the zone's average elite HP (mission bosses: a share of it, whatever their type), or null (no level) */
export function zoneEliteHp(zone) { const z = zoneLv(zone); return z ? eliteHp(z.L) * z.te : null; }
/** the curve HP of one mob (before co-op): type, its zone (object / id / zoneLv row), elite?, role (ROLE), mission ramp */
export function mobHp(type, zone, { elite = false, role = 'normal', ramp = 1 } = {}) {
  const z = zone && zone.L != null ? zone : zoneLv(zone);
  if (!z) return null;
  const M = rosterMeans(z.roster), hp = ENEMIES[type].hp;
  if (!M) return null; // (a dungeon whose module never registered its waves: off the curve)
  const v = elite ? eliteHp(z.L) * (hp / M.e) * z.te : normalHp(z.L) * (hp / M.f) * (ROLE[role] ?? ROLE.normal) * z.tn;
  return Math.max(1, Math.round(v * mapStep(z) * ramp));
}
