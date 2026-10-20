import { inTownArea, TOWN_NAME } from './townconst.js';
import { inDunesArea, dunesZoneAt, inTombArea, TOMB_NAME } from './dunesconst.js';
import { WILDS_R, WILDS_SHAPE, WILDS_RINGS, wildsSite } from './mapshape.js';
import { inFrostArea, frostZoneAt, inCryptArea, CRYPT_NAME } from './frostconst.js';
import { inEmberArea, emberZoneAt, inForgeArea, FORGE_NAME } from './emberconst.js';
import { inTrialArea, TRIAL_ZONE } from './trialconst.js';
import { OPS_Y, opsZoneAt } from './opsconst.js';
import { inRiftArea, riftZoneAt } from './riftconst.js';
import { inHollowArea, inTorArea, HOLLOW_ZONE, TOR_ZONE } from './glowconst.js';
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const secs = (s) => Math.round(s * TICK_RATE);
export const WORLD_R = WILDS_R;        // nominal radius of the Wilds (an organic island centred on (0,0): sim/mapshape.js)
export const WORLD_MAX = Math.ceil(WILDS_SHAPE.max); // furthest coastline point (minimap / renderer bounds)
export const WORLD_SEED = 20260927;    // fixed layout shared by every client/server
export const SPAWN_POS = { x: 0, y: 0 };
const GT = wildsSite('grimtusk');
export const BOSS_POS = { x: GT.x, y: GT.y }; // Grimtusk's warcamp on the north coast
export const BOSS_ARENA_R = 340;
// The raid arena (The Rift Sanctum): a floating platform far outside the world disc, reached by a portal / the menu.
export const RAID_POS = { x: 0, y: 9800 };
export const RAID_R = 460;
/** Is (x, y) in the raid region (the arena disc plus a margin)? Movement there is clamped to the arena, not the world. */
export const inRaidArea = (x, y, pad = 300) => Math.hypot(x - RAID_POS.x, y - RAID_POS.y) < RAID_R + pad;
export const PLAYER_SPEED = 195;

// Safe centre + 4 danger rings. Danger rises outward (RotMG style).
export const ZONES = [
  { id: 0, name: 'Haven Meadow', danger: 0, r0: 0, r1: 300, tier: 0 },
  { id: 1, name: 'Greenwood Glade', danger: 1, r0: WILDS_RINGS[0], r1: WILDS_RINGS[1], tier: 1 },
  { id: 2, name: 'Stonefang Hills', danger: 2, r0: WILDS_RINGS[1], r1: WILDS_RINGS[2], tier: 2 },
  { id: 3, name: 'Ashen Wilds', danger: 3, r0: WILDS_RINGS[2], r1: WILDS_RINGS[3], tier: 3 },
  { id: 4, name: 'Dread Frontier', danger: 4, r0: WILDS_RINGS[3], r1: WORLD_R, tier: 4 },
];
/** The hub town counts as a safe zone (id 0: no enemies, fast regen, no gear loss). */
export const TOWN_ZONE = { id: 0, name: TOWN_NAME, danger: 0, r0: 0, r1: 0, tier: 0, town: true };
/** The Tomb of the Sun-Eaten King (the Dunes' Normal dungeon). */
export const TOMB_ZONE = { id: 30, name: TOMB_NAME, danger: 6, r0: 0, r1: 0, tier: 4, tomb: true };
/** The Glacier Crypt (Frostveil's Normal dungeon). */
export const CRYPT_ZONE = { id: 50, name: CRYPT_NAME, danger: 7, r0: 0, r1: 0, tier: 5, crypt: true };
/** The Forge of Cinders (Emberdeep's Normal dungeon). */
export const FORGE_ZONE = { id: 60, name: FORGE_NAME, danger: 7, r0: 0, r1: 0, tier: 6, forge: true };
export function zoneAt(x, y) {
  if (y < OPS_Y) { const oz = opsZoneAt(x, y); if (oz) return oz; } // the mission arenas (sim/opsconst.js)
  if (x < -9000 && inTownArea(x, y)) return TOWN_ZONE;
  if (x < -24000 && y > -6000 && y < 6000 && inRiftArea(x, y)) return riftZoneAt(x, y); // the Astral Rift (Map 5, game loop C3)
  if (y < -28000 && inTrialArea(x, y)) return TRIAL_ZONE;
  if (x > 45000 && inForgeArea(x, y)) return FORGE_ZONE;
  if (x > 20000 && inEmberArea(x, y)) return emberZoneAt(x, y);
  if (y > 29000 && inHollowArea(x, y)) return inTorArea(x, y) ? TOR_ZONE : HOLLOW_ZONE; // the Glowmire Hollow + the Stormcrown Tor (the Wilds' dungeon / Trial)
  if (x > 15000 && inCryptArea(x, y)) return CRYPT_ZONE;
  if (y > 14000 && inFrostArea(x, y)) return frostZoneAt(x, y);
  if (y < -8000 && inTombArea(x, y)) return TOMB_ZONE;
  if (y < -10500 && inDunesArea(x, y)) return dunesZoneAt(x, y);
  if (Math.hypot(x, y) < ZONES[0].r1) return ZONES[0]; // the Haven is a plain circle round the campfire
  const d = WILDS_SHAPE.re(x, y); // danger rings follow the coastline
  for (const z of ZONES) if (d < z.r1) return z;
  return ZONES[ZONES.length - 1];
}
