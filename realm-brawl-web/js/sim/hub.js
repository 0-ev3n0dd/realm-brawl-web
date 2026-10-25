// The hub loop (Monster Hunter Rise style): every session starts in Brightwater Village; the host walks up to the
// Mission Counter and picks a mission, everyone in the world is pulled into it, and after a clear / wipe / quit the
// whole party comes back to town together. Enabled with `new Sim({ hub: true })` (solo Game, MobileGame and the co-op
// Room); plain unit-test sims keep the old free-roam behaviour. Authoritative only (never predicted).
import { SPAWN_POS, RAID_POS, RAID_R, inRaidArea } from './constants.js';
import { DUMMY_POS } from './village.js';
import { normDummy, dummyKey, dummySpots, applyDummy } from './dummy.js';
import { TOWN_POS, TOWN_SPAWN, COUNTER, inTownArea, nearCounter, townSpot as townSpot0, hubLayoutOf, hubSpawn, hubGatePos } from './townconst.js';
import { inAstArea } from './astraelconst.js';
import { enterRaid } from './raid.js';
import { enterAstrael, endAstraelFor } from './astrael.js';
import { DUNES_SPAWN, inDunesArea, inTombArea, GATES, GATE_R } from './dunesconst.js';
import { enterTomb, endTomb, tombSpot } from './tomb.js';
import { FROST_SPAWN, inFrostArea, inCryptArea } from './frostconst.js';
import { enterCrypt, endCrypt, cryptSpot } from './crypt.js';
import { EMBER_SPAWN, inEmberArea, inForgeArea } from './emberconst.js';
import { RIFT_SPAWN, inRiftArea } from './riftconst.js';
import { enterForge, endForge, forgeSpot } from './forge.js';
import { inHollowArea } from './glowconst.js';
import { enterGlow, endGlow, glowSpot, GLOW_MISSIONS } from './glowmire.js';
import { inTrialArea } from './trialconst.js';
import { enterTrial, endTrialFor, MISSION_TRIALS } from './trials.js';
import { OPS_BIOMES, OPS_TYPES, OPS_TYPE, OPS_BIOME, BOSS_GATES, OPS_GATE_R, opsOf, opsMissionId, inOpsArea, gateName } from './opsconst.js';
import { collectLeftovers } from './drops.js';
import { PRACTICE_ENCS, encBase, encAstral, armPractice, restartPractice, endPractice, updatePractice, practiceHub } from './practice.js';
export { updatePractice };
import { startOps, enterOps, endOps, opsSpot, opsAct } from './ops.js';
import { enterUlt, endUlt, ULT_CLEAR_KEY } from './ultimate.js';

export { TOWN_POS, TOWN_SPAWN, COUNTER };
/** The mission board. `lock` = the unlock key the host needs (persisted client-side, sent on join). */
export const MISSIONS = [
  { id: 'field', name: 'The Wilds', sub: 'Free hunt: Haven Meadow to the Dread Frontier', stars: 1, desc: 'Roam the open world from the campfire: level up, find gear, hunt Grimtusk.' },
  { id: 'hollow', name: 'The Glowmire Hollow', sub: 'Dungeon · Lv 12 · 3 grottoes + Lumivex', stars: 2, lock: 'hollow', lockText: 'Clear it once from its entrance in the Wilds (the glowing hollow in the Ashen Wilds)', desc: 'Moss-lit grottoes of spore pods and glowmoths, then Lumivex, the Moth Matriarch: lantern blooms, moonbeams and a Bower that goes dark. Mothwing set drops; a clear hands you a Stormcrown Key.' },
  { id: 'vharokt', name: 'Vharok, the Stormhorn (Trial)', sub: 'Trial · Lv 12 · The Stormcrown Tor', stars: 2, lock: 'vht', lockText: 'Clear the Glowmire Hollow to unlock', desc: 'A storm elk the size of a hill: thunder charges, hoof quakes, lightning rods that arc to each other, and a gale that shoves you into the storm wall. Enrage at 9:20. Drops Stormbound Sigils.' },
  { id: 'vharokx', name: 'Vharok, the Stormhorn (Extreme)', sub: 'Extreme trial · The Stormcrown Tor', stars: 3, lock: 'vhx', lockText: 'Clear Vharok (Trial) to unlock', desc: 'Faster tells, paired mechanics, and a new final phase: the Eye of the Storm. Enrage at 8:40.' },
  { id: 'dunes', name: 'Sunscorch Dunes', sub: 'Free hunt · Lv 13-19', stars: 3, lock: 'dunes', lockText: 'Defeat Grimtusk, then attune the gate with 3 Warlord Tusks from Grimtusk (Realm Gate map)', desc: 'A desert of burrowing wurms and mirages. Hunt Khepra the Sandwurm Queen; the Tomb entrance stands by the Oasis.' },
  { id: 'tomb', name: 'Tomb of the Sun-Eaten King', sub: 'Dungeon · Lv 20 · 3 chambers + Neferakh', stars: 4, lock: 'tomb', lockText: 'Clear it once from its entrance in the Dunes (by the Oasis)', desc: 'Waves of the sun-eaten dead, chain-challenge chests, then Neferakh, who flips day and night. Sunscorch Set drops.' },
  { id: 'frost', name: 'Frostveil Peaks', sub: 'Free hunt · Lv 21-29', stars: 4, lock: 'frost', lockText: 'Defeat Khepra or clear the Tomb, then attune the gate (Realm Gate map: 2 Sunbound Sigils from Neferakh Unbound)', desc: 'A frozen mountain range: flocking penguins, echoing wraiths, three strange world bosses. Hunt Skaldra the Glacier Wyrm on the summit; Glacier Crypt portals drop out here.' },
  { id: 'crypt', name: 'The Glacier Crypt', sub: 'Dungeon · Lv 30 · 3 vaults + Osric', stars: 5, lock: 'crypt', lockText: 'Clear it once from its entrance in Frostveil (by the camp)', desc: 'Icicle-haunted vaults of the frozen dead, then Osric the Rimeking, who plays chess with the floor.' },
  { id: 'ember', name: 'Emberdeep Caldera', sub: 'Free hunt · Lv 31-39', stars: 5, lock: 'ember', lockText: 'Defeat Skaldra or clear the Glacier Crypt, then attune the gate (Realm Gate map: 2 Rimebound Sigils from Skaldra (Trial))', desc: 'A volcanic caldera of lava rivers, erupting vents and basalt wastes: three strange world bosses. Hunt Pyrrhex, the Caldera Heart, in the crater; Forge of Cinders portals drop out here.' },
  { id: 'forge', name: 'The Forge of Cinders', sub: 'Dungeon · Lv 40 · 3 halls + Hephast', stars: 5, lock: 'forge', lockText: 'Clear it once from its entrance in Emberdeep (by the outpost)', desc: 'Slag-dripping forge halls, then Hephast the Cinder Smith on his conveyor-belt foundry: stand in the mould while the belts shear it apart.' },
  { id: 'rift', name: 'The Astral Rift', sub: 'Free hunt · Lv 41-48', stars: 5, lock: 'rift', lockText: 'Defeat Pyrrhex or clear the Forge of Cinders, then attune the gate (Realm Gate map: 2 Cinderbound Sigils from Pyrrhex (Trial))', desc: 'The sky tore open where Vorthax held his rift: a shattered starfield of void tears, erupting starwells and crystal spires. Three world bosses; hunt Zerath, the Rift Herald, in the Breach. The Rift Sanctum entrance stands by Starfall Camp.' },
  { id: 'vorthax', name: 'Vorthax', sub: 'Dungeon · Lv 49 · The Rift Sanctum', stars: 5, lock: 'vtx', lockText: 'Clear it once from its entrance in the Astral Rift (by Starfall Camp)', desc: 'The rift-lord, Map 5\'s dungeon. Wards, lanes, stacks and a hard enrage. Guarantees an Astral Regalia piece; drops Rift Cores.' },
  { id: 'astrael', name: 'Astrael', sub: 'Trial · Lv 50 · The Star Sanctum', stars: 5, lock: 'astrael', lockText: 'Clear Vorthax, then attune the Astral Sanctum (Realm Gate map: 2 Rift Cores from Vorthax)', desc: 'The endgame trial at the level cap. Push her HP to skip ahead; the script is the fallback.' },
  { id: 'astraelx', name: 'Astrael (Extreme)', sub: 'Extreme trial · The Star Sanctum', stars: 5, lock: 'astx', lockText: 'Clear Astrael to unlock', desc: 'More HP, faster telegraphs, overlapping mechanics, a tighter Big Bang.' },
  { id: 'neferakht', name: 'Neferakh Unbound (Trial)', sub: 'Trial · The Sun-Eaten Throne', stars: 3, lock: 'nft', lockText: 'Clear the Tomb of the Sun-Eaten King to unlock', desc: 'The king breaks his seal: sun spears, a scarab tide, a sky that flips between day and night, and scales that judge one half of the throne. Enrage at 8:00. Drops Sunbound Sigils (they attune the Frostveil gate).' },
  { id: 'neferakhx', name: 'Neferakh Unbound (Extreme)', sub: 'Extreme trial · The Sun-Eaten Throne', stars: 4, lock: 'nfx', lockText: 'Clear Neferakh Unbound (Trial) to unlock', desc: 'Faster tells, combined mechanics, and a new final phase: the Black Sun. Enrage at 7:00.' },
  { id: 'neferakhs', name: 'Neferakh Unbound (Savage)', sub: 'Savage trial · Astral · The Sun-Eaten Throne', stars: 5, savage: 'nf', lockText: 'Astral mode only (Realm Gate map: Astral)', desc: 'The Astral tier. Balance of Day and Night, the Pinax corners, a twin Sunbearer and a new final phase: the Black Sun Verdict. Strict solves: a second Vuln stack is a KO. Enrage at 16:00.' },
  { id: 'skaldrat', name: 'Skaldra (Trial)', sub: 'Trial · The Hoarfrost Mirror', stars: 4, lock: 'skt', lockText: 'Defeat Skaldra or clear the Glacier Crypt to unlock', desc: 'Thin ice that breaks under you, a rime shadow that walks your path, a beam that bounces off mirrors, and an eye that punishes anyone who moves. Enrage at 8:00.' },
  { id: 'skaldrax', name: 'Skaldra (Extreme)', sub: 'Extreme trial · The Hoarfrost Mirror', stars: 5, lock: 'skx', lockText: 'Clear Skaldra (Trial) to unlock', desc: 'Faster tells, combined mechanics, and a new final phase: Absolute Zero. Enrage at 7:00.' },
  { id: 'pyrrhext', name: 'Pyrrhex (Trial)', sub: 'Trial · The Heart-Chamber', stars: 4, lock: 'pyt', lockText: 'Defeat Pyrrhex or clear the Forge of Cinders to unlock', desc: 'Pressure valves to bleed, numbered bombs, red beats to dodge on, a gaze to hide from behind obsidian, and a flood you ride out on fresh craters. Enrage at 8:00.' },
  { id: 'pyrrhexx', name: 'Pyrrhex (Extreme)', sub: 'Extreme trial · The Heart-Chamber', stars: 5, lock: 'pyx', lockText: 'Clear Pyrrhex (Trial) to unlock', desc: 'Two valves, stretched-and-hidden tethers, crumbling rafts, and a new final phase: Heart of the World. Enrage at 7:00.' },
  { id: 'ultimate', name: 'The Ultimate · The Unwritten', sub: 'Ultimate raid · Lv 50 · 4 players (solo scales) · The Unwritten Throne', stars: 5, lock: 'ult', lockText: 'Clear Astrael (Extreme) to unlock', desc: 'The pinnacle: the four Rift bosses return as Astral echoes, then Aeon, the Unwritten. Five phases, ~15-20 min, no checkpoints (a wipe starts over), a hard enrage every phase, deep variations that are always signalled. Prestige only: a title, an aura, a weapon glow and the Unwritten Regalia. No power.' },
];
/** the mission dungeons (sim/ops.js): one per open-world map x type, started from their fixed entrances (not the board) */
export const OPS_MISSIONS = OPS_BIOMES.flatMap((b) => OPS_TYPES.map((t) => ({ id: opsMissionId(b, t), name: `${OPS_TYPE[t].name} · ${OPS_BIOME[b].name}`, sub: `Mission · ${OPS_TYPE[t].name} · Danger ${OPS_BIOME[b].danger}`, stars: Math.max(1, Math.min(5, OPS_BIOME[b].danger - 1)), desc: OPS_TYPE[t].obj, ops: { type: t, biome: b } })));
export const MISSION = Object.fromEntries([...MISSIONS, ...OPS_MISSIONS].map((m) => [m.id, m]));
const r0 = (v) => Math.round(v);
let LY = 'village'; // the current sim's hub layout (set at each hub entry point from sim.world.hubLayout)
const townSpot = (k) => townSpot0(k, TOWN_SPAWN, LY);
const ly = (sim) => (LY = hubLayoutOf(sim && sim.world));
/** switch a world's hub between the village and the painted tavern hall (players in town are re-placed if stranded) */
export function setHubLayout(sim, layout) {
  const want = layout === 'tavern' ? 'tavern' : 'village';
  if (!sim || !sim.world || hubLayoutOf(sim.world) === want) return false;
  sim.world.hubLayout = want; ly(sim);
  if (sim.hub && sim.hub.m === 'town') { let i = 0; for (const p of sim.players.values()) if (inTownArea(p.x, p.y)) place(p, townSpot(i++)); }
  return true;
}
/** the village Training Dummy: spawned once (and again if anything removed it), only in the village layout. The rng
 *  state is kept so the dummy never shifts the world's random sequence. */
export function ensureDummy(sim) {
  const want = LY !== 'tavern', c = sim.dummyCfg || (sim.dummyCfg = normDummy());
  if (!sim.dummyIds) sim.dummyIds = sim.dummyId ? [sim.dummyId] : [];
  const live = sim.dummyIds.map((id) => sim.enemyById.get(id)).filter((d) => d && !d.dead);
  const key = dummyKey(c);
  if (!want || sim.dummyKey !== key) { for (const d of live) d.dead = true; live.length = 0; if (!want) { sim.dummyIds = []; sim.dummyId = 0; return; } }
  if (live.length === c.count && sim.dummyKey === key) return;
  if ((sim.tick % 30) !== 0 && sim.dummyKey === key) return;
  const st = sim.rng.getState(); const spots = dummySpots(c), ids = [];
  for (let i = 0; i < spots.length; i++) { let d = live[i]; if (!d) { d = sim.spawnEnemy('dummy', spots[i].x, spots[i].y); applyDummy(d, c, spots[i]); } ids.push(d.id); }
  for (const d of live.slice(spots.length)) d.dead = true;
  sim.rng.setState(st);
  sim.dummyIds = ids; sim.dummyId = ids[0]; sim.dummyKey = key;
}
/** Training Dummy menu: the host / solo player sets the config (sim/dummy.js) */
export function setDummyCfg(sim, cfg) { sim.dummyCfg = normDummy(cfg); }
export const RETURN_AFTER_WIN = 60 * 45; // after a clear the party is sent home automatically (or use the exit)

export function createHub(sim) {
  sim.hub = { m: 'town', hostId: 0, last: null, want: null, since: 0, spot: hubSpot, home: hubHome };
  return sim.hub;
}
export const isHost = (sim, p) => !!(sim.hub && p && (sim.hub.hostId ? sim.hub.hostId === p.id : firstPlayer(sim) === p));
const firstPlayer = (sim) => sim.players.values().next().value || null;
export const hostOf = (sim) => (sim.hub.hostId ? sim.players.get(sim.hub.hostId) : firstPlayer(sim)) || firstPlayer(sim);
/** every persisted unlock flag (client localStorage, sent on join; server/room.js copies these). Game loop A1: atd / atf / ate =
 *  the Dunes / Frostveil / Emberdeep gates attuned; gmig = the attunement migration ran (gates open before it stay open);
 *  nfx / nfxc = Neferakh Unbound (Extreme) open / cleared ('sigil' = the first Tomb clear opens the Trial). */
export const UNLOCK_KEYS = ['nfsc', 'sksc', 'pysc', 'vhsc', 'assc', 'astx', 'astxClear', 'dunes', 'tomb', 'sigil', 'frost', 'crypt', 'ember', 'forge', 'skt', 'skx', 'skxc', 'pyt', 'pyx', 'pyxc', 'nfx', 'nfxc', 'atd', 'atf', 'ate', 'gmig', 'rift', 'atr', 'vtx', 'ats', 'gmig2', 'hollow', 'vhx', 'vhxc', 'ultc', ...[1, 2, 3, 4, 5].flatMap((k) => ['warrior', 'ranger', 'mage', 'cleric', 'bladedancer', 'samurai', 'monk', 'dragoon', 'summoner', 'bard'].map((c) => `a${k}_${c}`))] /* (Part D: a1..a5 Ascension rank flags) */; // (game loop C3: Map 5 found / attuned, the Rift Sanctum cleared, the Astral Sanctum attuned, the C3 migration)
/** a Realm Gate's attune flag (sim/meta.js ATTUNE pays for it) */
export const GATE_ATTUNE = { dunes: 'atd', frost: 'atf', ember: 'ate', rift: 'atr', astrael: 'ats' };
/** the raw unlock, before attunement: a Tomb clear also finds Frostveil; a Crypt clear finds Emberdeep + opens Skaldra (Trial);
 *  a Forge clear opens Pyrrhex (Trial); a Tomb clear opens Neferakh Unbound (Trial) */
export const gateFound = (p, key) => !key || !!(p && p.unlocks && (p.unlocks[key] || (key === 'frost' && p.unlocks.tomb) || (key === 'ember' && p.unlocks.crypt) || (key === 'skt' && (p.unlocks.ember || p.unlocks.crypt)) || (key === 'pyt' && p.unlocks.forge) || (key === 'nft' && (p.unlocks.sigil || p.unlocks.tomb)) || (key === 'vht' && p.unlocks.hollow) || (key === 'rift' && (p.unlocks.forge || p.unlocks.pyt)) || (key === 'astrael' && p.unlocks.vtx) || (key === 'ult' && (p.unlocks.astxClear || allSavagesClear(p.unlocks)))));
/** can p use content behind `key`? (a map gate also needs its attunement) */
export const hasUnlock = (p, key) => gateFound(p, key) && (!GATE_ATTUNE[key] || !!(p.unlocks && p.unlocks[GATE_ATTUNE[key]]));
/** the trial unlocks as a bitmask for co-op snapshots: skt 1, skx 2, pyt 4, pyx 8, nft 16, nfx 32 */
export const trialBits = (p) => (hasUnlock(p, 'skt') ? 1 : 0) | (hasUnlock(p, 'skx') ? 2 : 0) | (hasUnlock(p, 'pyt') ? 4 : 0) | (hasUnlock(p, 'pyx') ? 8 : 0) | (hasUnlock(p, 'nft') ? 16 : 0) | (hasUnlock(p, 'nfx') ? 32 : 0) | (hasUnlock(p, 'vht') ? 64 : 0) | (hasUnlock(p, 'vhx') ? 128 : 0);
/** the board's lock map from a bitmask */
export const trialLocks = (b) => ({ skt: !!(b & 1), skx: !!(b & 2), pyt: !!(b & 4), pyx: !!(b & 8), nft: !!(b & 16), nfx: !!(b & 32), vht: !!(b & 64), vhx: !!(b & 128) });
/** Can `p` start mission `id` right now? Returns '' or the reason it can't. */
export function missionBlock(sim, p, id, needCounter = true) {
  const H = sim.hub, m = MISSION[id];
  if (!H || !m) return 'unknown mission';
  if (!isHost(sim, p)) return 'Only the host can pick a mission';
  if (needCounter === 'town') { if (H.m !== 'town' || !inTownArea(p.x, p.y)) return 'Travel from the Realm Gate map in town'; } // (piece 4: the Realm Gate map works anywhere in town)
  else if (needCounter && !(inTownArea(p.x, p.y) && nearCounter(p.x, p.y, 70, ly(sim)))) return 'Talk to the Mission Counter';
  { const h = hostOf(sim), astral = !!(astralAllowed(h) && h.astralOn); // (Part 0S: in Astral mode a boss with a Savage shows only its Savage door)
    if (doorHidden(id, astral)) return SAVAGE_MISSION[id] ? 'Savage opens with Astral mode (Realm Gate map: switch to Astral)' : 'In Astral mode this boss offers its Savage instead'; }
  if (!hasUnlock(hostOf(sim), m.lock)) return m.lockText || 'Locked';
  return '';
}

/** A free spot near where the player should be placed after respawning (hub mode). */
function hubSpot(sim, p) {
  const H = sim.hub; ly(sim);
  if (inTownArea(p.x, p.y) || H.m === 'town') return townSpot(0);
  if (inRaidArea(p.x, p.y)) return sim.raid ? { x: RAID_POS.x, y: RAID_POS.y + RAID_R - 70 } : townSpot(0);
  if (inAstArea(p.x, p.y) || inTrialArea(p.x, p.y)) return townSpot(0);
  if (inOpsArea(p.x, p.y)) return (sim.ops && opsSpot(sim)) || townSpot(0); // a mission: back by the objective
  if (inTombArea(p.x, p.y)) return sim.tomb ? tombSpot(sim) : townSpot(0);
  if (inCryptArea(p.x, p.y)) return sim.crypt ? cryptSpot(sim) : townSpot(0);
  if (inHollowArea(p.x, p.y)) return sim.glow ? glowSpot(sim) : townSpot(0);
  if (inForgeArea(p.x, p.y)) return sim.forge ? forgeSpot(sim) : townSpot(0);
  if (inRiftArea(p.x, p.y) || H.m === 'rift') return RIFT_SPAWN;
  if (inEmberArea(p.x, p.y) || H.m === 'ember') return EMBER_SPAWN;
  if (inFrostArea(p.x, p.y) || H.m === 'frost') return FROST_SPAWN;
  if (inDunesArea(p.x, p.y) || H.m === 'dunes') return DUNES_SPAWN;
  return { x: SPAWN_POS.x, y: SPAWN_POS.y + 40 };
}
function place(p, s) { p.x = p.px = s.x; p.y = p.py = s.y; p.vx = p.vy = 0; p.iframes = Math.max(p.iframes || 0, 60); p.action = null; }
/** Death screen 'Return to village': solo ends the mission (everyone home); in co-op only the fallen player goes home. */
function hubHome(sim, p) { if (sim.players.size <= 1) returnToTown(sim, 'death'); else returnToTown(sim, 'death', p); if (p) p.canChoose = 0; }
/** Put a new arrival (joined / respawned into an empty world) wherever the party is. */
export function hubJoin(sim, p, restored = false) {
  const H = sim.hub; ly(sim);
  if (!H) return;
  const inField = !inTownArea(p.x, p.y) && !inRaidArea(p.x, p.y) && !inAstArea(p.x, p.y) && !inDunesArea(p.x, p.y) && !inTombArea(p.x, p.y) && !inFrostArea(p.x, p.y) && !inCryptArea(p.x, p.y) && !inHollowArea(p.x, p.y) && !inEmberArea(p.x, p.y) && !inForgeArea(p.x, p.y) && !inRiftArea(p.x, p.y) && !inTrialArea(p.x, p.y) && !inOpsArea(p.x, p.y);
  if (H.m === 'dunes') { if (!(restored && inDunesArea(p.x, p.y) && !inTombArea(p.x, p.y))) place(p, { x: DUNES_SPAWN.x + ((p.id * 37) % 5 - 2) * 30, y: DUNES_SPAWN.y }); return; }
  if (H.m === 'frost') { if (!(restored && inFrostArea(p.x, p.y))) place(p, { x: FROST_SPAWN.x + ((p.id * 37) % 5 - 2) * 30, y: FROST_SPAWN.y }); return; }
  if (H.m === 'ember') { if (!(restored && inEmberArea(p.x, p.y) && !inForgeArea(p.x, p.y))) place(p, { x: EMBER_SPAWN.x + ((p.id * 37) % 5 - 2) * 30, y: EMBER_SPAWN.y }); return; }
  if (H.m === 'rift') { if (!(restored && inRiftArea(p.x, p.y))) place(p, { x: RIFT_SPAWN.x + ((p.id * 37) % 5 - 2) * 30, y: RIFT_SPAWN.y }); return; }
  if (H.m === 'field') { if (!(restored && inField)) place(p, { x: SPAWN_POS.x + ((p.id * 37) % 5 - 2) * 30, y: SPAWN_POS.y + 40 }); return; }
  if (H.m === 'town' && restored && inTownArea(p.x, p.y)) return; // (a reconnect keeps its spot in the village)
  place(p, townSpot(Math.max(0, sim.players.size - 1)));
  if (H.m !== 'town') p.hubPull = 1; // a raid / trial is running: pulled into it on the next tick
}
/** Start a mission for everyone in the world (host decision). */
export function startMission(sim, id, by = null, back = null) {
  const H = sim.hub, m = MISSION[id];
  if (!H || !m) return false;
  if (by && isHost(sim, by)) setAstral(sim, astralAllowed(by) && by.astralOn); // (Part C: the host's Normal / Astral choice travels with the party)
  endEncounters(sim);
  H.m = id; H.since = sim.tick; H.want = null; H.last = null; H.back = back;
  const op = opsOf(id); if (op) startOps(sim, op.biome, op.type, back);
  const ps = [...sim.players.values()];
  ps.forEach((p, i) => pull(sim, p, i));
  H.back = null;
  for (const q of sim.players.values()) q.ready = 0; // (the Co-op Board's ready-up is per departure)
  sim.emit({ type: 'hub', ph: 'mission', id, name: m.name, by: by ? by.id : 0, x: r0(ps[0] ? ps[0].x : 0), y: r0(ps[0] ? ps[0].y : 0) });
  return true;
}
function revive(sim, p) {
  if (p.dead) { p.dead = false; p.respawnAt = 0; }
  p.hp = p.stats.maxHp; p.res = p.stats.maxRes; p.astHold = 0; p.stun = 0;
}
function pull(sim, p, i) {
  const H = sim.hub;
  revive(sim, p); p.hubPull = 0;
  if (H.back && (H.m === 'field' || H.m === 'dunes' || H.m === 'frost' || H.m === 'ember' || H.m === 'rift')) return void place(p, { x: H.back.x + ((i % 5) - 2) * 34, y: H.back.y + Math.floor(i / 5) * 34 }); // (home from a mission: at its entrance)
  if (opsOf(H.m)) return void enterOps(sim, p, i);
  if (H.m === 'field') place(p, { x: SPAWN_POS.x + ((i % 5) - 2) * 30, y: SPAWN_POS.y + 40 + Math.floor(i / 5) * 30 });
  else if (H.m === 'dunes') place(p, { x: DUNES_SPAWN.x + ((i % 5) - 2) * 30, y: DUNES_SPAWN.y + Math.floor(i / 5) * 30 });
  else if (H.m === 'frost') place(p, { x: FROST_SPAWN.x + ((i % 5) - 2) * 30, y: FROST_SPAWN.y + Math.floor(i / 5) * 30 });
  else if (H.m === 'ember') place(p, { x: EMBER_SPAWN.x + ((i % 5) - 2) * 30, y: EMBER_SPAWN.y + Math.floor(i / 5) * 30 });
  else if (H.m === 'rift') place(p, { x: RIFT_SPAWN.x + ((i % 5) - 2) * 30, y: RIFT_SPAWN.y + Math.floor(i / 5) * 30 });
  else if (H.m === 'forge') enterForge(sim, p);
  else if (H.m === 'tomb') enterTomb(sim, p);
  else if (H.m === 'crypt') enterCrypt(sim, p);
  else if (GLOW_MISSIONS[H.m]) enterGlow(sim, p, GLOW_MISSIONS[H.m]);
  else if (H.m === 'vorthax') enterRaid(sim, p);
  else if (H.m === 'astrael' || H.m === 'astraelx') enterAstrael(sim, p, H.m === 'astraelx' ? 'x' : 'n');
  else if (H.m === 'ultimate') enterUlt(sim, p);
  else if (MISSION_TRIALS[H.m]) enterTrial(sim, p, MISSION_TRIALS[H.m][0], MISSION_TRIALS[H.m][1]);
}
/** Tear down any running encounter (Vorthax / Astrael) without the usual exits. */
function endEncounters(sim) {
  collectLeftovers(sim); // (loop playtest fix: nothing you earned is left on the floor when the area changes)
  if (sim.raid) { const b = sim.enemyById.get(sim.raid.bid); if (b) { b.dead = true; b.hp = 0; for (const pr of sim.projectiles) if (pr.ownerId === b.id) pr.dead = true; for (const a of sim.areas) if (a.ownerId === b.id) a.dead = true; } sim.raid = null; }
  if (sim.astrael) endAstraelFor(sim, 'town');
  if (sim.trial) endTrialFor(sim, 'town');
  if (sim.tomb) endTomb(sim, null);
  if (sim.crypt) endCrypt(sim, null);
  if (sim.glow) endGlow(sim, null);
  if (sim.forge) endForge(sim, null);
  if (sim.ops) endOps(sim);
  if (sim.ult) endUlt(sim, null);
  if (sim.practice) endPractice(sim, 'left');
  sim.starPortal = null; sim.tombPortals = []; sim.glyphs = []; sim.cryptPortals = []; sim.forgePortals = [];
}
/** Everyone (or just `only`) back to the village: revived, healed, placed around the fountain. */
export function returnToTown(sim, why = 'quit', only = null) {
  const H = sim.hub; ly(sim); const SP = hubSpawn(LY);
  if (!H) return false;
  const ps = only ? [only] : [...sim.players.values()];
  if (!only) { H.last = { m: H.m, why, t: r0((sim.tick - H.since) / 60) }; endEncounters(sim); H.m = 'town'; H.since = sim.tick; H.want = null; }
  ps.forEach((p, i) => { revive(sim, p); place(p, townSpot(i)); });
  sim.emit({ type: 'hub', ph: 'town', why, pid: only ? only.id : 0, m: H.last ? H.last.m : '', x: SP.x, y: SP.y });
  return true;
}

// ------------------------------------------------------------------ Travel to Town (World Map button / Options › Account)
// A short channel from any open-world map: stand still for TOWN_CH ticks; moving, taking a hit, a boss pulling you in or
// dying cancels it. Not during a mission / dungeon / trial (those leave by Abandon mission). Host = the whole party goes
// home (the old Return to Town); a guest goes alone.
export const TOWN_CH = 120;          // 2 s at 60 Hz
export const TOWN_CH_MOVE = 24;      // px of drift that cancels the channel
export const OPEN_MAPS = new Set(['town', 'field', 'dunes', 'frost', 'ember', 'rift']);
const BOSS_NEAR = 1100;
/** why `p` can't start / keep channelling Travel to Town ('' = allowed) */
export function townTravelBlock(sim, p) {
  const H = sim.hub; if (!H || !p) return 'Not available here';
  if (p.dead) return 'You are down';
  if (H.m === 'town' && inTownArea(p.x, p.y)) return 'You are already in town';
  if (!OPEN_MAPS.has(H.m)) return 'Not during a mission or trial (Options › Account › Abandon mission)';
  if (inTombArea(p.x, p.y) || inCryptArea(p.x, p.y) || inHollowArea(p.x, p.y) || inForgeArea(p.x, p.y) || inRaidArea(p.x, p.y) || inAstArea(p.x, p.y) || inTrialArea(p.x, p.y) || inOpsArea(p.x, p.y)) return 'Not inside a dungeon or trial';
  for (const e of sim.enemies) if (e.boss && !e.dead && !e.dummy && Math.hypot(e.x - p.x, e.y - p.y) < BOSS_NEAR) return 'Not in the middle of a boss fight';
  return '';
}
function townChannel(sim, p) {
  const c = p.townCh; if (!c) return;
  const why = Math.hypot(p.x - c.x, p.y - c.y) > TOWN_CH_MOVE ? 'You moved' : (p.lastHurt ?? -1) > c.hurt ? 'You were hit' : townTravelBlock(sim, p);
  if (why) { p.townCh = null; sim.emit({ type: 'hub', ph: 'tch', s: 'cancel', pid: p.id, why, x: r0(p.x), y: r0(p.y) }); return; }
  if (--c.t > 0) return;
  p.townCh = null;
  sim.emit({ type: 'hub', ph: 'tch', s: 'done', pid: p.id, x: r0(p.x), y: r0(p.y) });
  if (isHost(sim, p) && !(sim.hub.m === 'town')) returnToTown(sim, 'travel'); else returnToTown(sim, 'travel', p);
}

/** Per tick, before the raid / trial update: legacy commands become hub requests; finished encounters send the party home. */
export function updateHub(sim) {
  const H = sim.hub;
  if (!H || sim.predicting) return;
  ly(sim);
  ensureDummy(sim);
  for (const p of sim.players.values()) {
    // legacy entry points (old clients / dev tools): enterRaid / enterAstrael = a mission request, leave* = go home
    const w = p.wantRaid || p.wantAst;
    if (w) {
      const id = p.wantRaid ? 'vorthax' : (p.wantAstX ? 'astraelx' : 'astrael');
      p.wantRaid = 0; p.wantAst = 0; p.wantAstX = 0;
      if (w === 'leave') p.hubReq = { type: 'town' }; else p.hubReq = { type: 'mission', id, any: 1 };
    }
    const q = p.hubReq;
    if (!q) continue;
    p.hubReq = null;
    if (q.type === 'mission') {
      const why = missionBlock(sim, p, q.id, q.any ? false : q.map ? 'town' : true);
      if (why) { sim.emit({ type: 'hub', ph: 'deny', pid: p.id, id: q.id, why, x: r0(p.x), y: r0(p.y) }); continue; }
      startMission(sim, q.id, p);
    } else if (q.type === 'practice') { // Part E: practice (solo; the client only offers phases its account reached)
      const id = encBase(q.enc), was = p.astralOn; p.astralOn = encAstral(q.enc) || !!(PRACTICE_ENCS[id] && PRACTICE_ENCS[id].astral); // (a Savage is only ever Astral) (the mode first: an '@a' record is the Astral door set, where a Savage door lives)
      const why = !PRACTICE_ENCS[id] ? 'Nothing to practise' : sim.players.size > 1 ? 'Practice is solo' : missionBlock(sim, p, id, 'town');
      if (why) { p.astralOn = was; sim.emit({ type: 'hub', ph: 'deny', pid: p.id, id, why, x: r0(p.x), y: r0(p.y) }); continue; }
      startMission(sim, id, p); p.astralOn = was; armPractice(sim, p, q); // (an '@a' record practises the Astral version)
    } else if (q.type === 'practiceGo') { if (sim.practice) restartPractice(sim, p, q.ph, startMission); continue;
    } else if (q.type === 'op') { opRequest(sim, p, q); continue;
    } else if (q.type === 'opAct') { opsAct(sim, p, q.act, q); continue;
    } else if (q.type === 'townGo') {
      if (q.cancel) { if (p.townCh) { p.townCh = null; sim.emit({ type: 'hub', ph: 'tch', s: 'cancel', pid: p.id, why: 'Cancelled', x: r0(p.x), y: r0(p.y) }); } continue; }
      const why = townTravelBlock(sim, p);
      if (why) { sim.emit({ type: 'hub', ph: 'tch', s: 'no', pid: p.id, why, x: r0(p.x), y: r0(p.y) }); continue; }
      p.townCh = { t: TOWN_CH, x: p.x, y: p.y, hurt: p.lastHurt ?? -1 };
      sim.emit({ type: 'hub', ph: 'tch', s: 'go', pid: p.id, t: TOWN_CH, x: r0(p.x), y: r0(p.y) });
    } else if (q.type === 'town') {
      if (H.m === 'town' && inTownArea(p.x, p.y)) continue;
      if (isHost(sim, p)) returnToTown(sim, 'quit'); else returnToTown(sim, 'quit', p);
    }
  }
  for (const p of sim.players.values()) if (p.townCh) townChannel(sim, p);
  // the Realm Gate plaza (south of the fountain): walk into a portal to travel (host only; locked gates refuse)
  if (H.m === 'town') for (const p of sim.players.values()) {
    if (p.dead || !inTownArea(p.x, p.y)) continue;
    if (p.gateCd > 0) { p.gateCd--; continue; }
    const g = GATES.find((g) => { const o = hubGatePos(g, LY); return Math.hypot(p.x - o.x, p.y - o.y) < GATE_R; });
    if (!g) continue;
    p.gateCd = 90;
    const why = missionBlock(sim, p, g.id, false);
    if (why) { sim.emit({ type: 'hub', ph: 'deny', pid: p.id, id: g.id, why: g.lock && why === (MISSION[g.id].lockText || 'Locked') ? g.lockText : why, x: r0(p.x), y: r0(p.y) }); continue; }
    { const o = hubGatePos(g, LY); sim.emit({ type: 'hub', ph: 'gate', pid: p.id, id: g.id, x: r0(o.x), y: r0(o.y) }); }
    startMission(sim, g.id, p);
    return;
  }
  if (H.want) { const id = H.want; H.want = null; startMission(sim, id); } // portals (Grimtusk's rift, the post-Vorthax star)
  // late joiners / respawns that belong in the running encounter
  for (const p of sim.players.values()) if (p.hubPull && !p.dead) { p.hubPull = 0; pull(sim, p, sim.players.size); }
  if (sim.practice) { practiceHub(sim, startMission); return; } // (Part E: a practice run never goes home on its own: a wipe restarts it, the kill ends it)
  // the encounter finished: home together
  if (H.m === 'vorthax') {
    if (!sim.raid) return void returnToTown(sim, 'wipe');
    if (sim.raid.over) return void returnToTown(sim, 'clear');
    if (sim.raid.st === 'victory' && sim.tick - (sim.raid.wonAt || sim.tick) > RETURN_AFTER_WIN && !sim.starPortal) return void returnToTown(sim, 'clear');
  } else if (H.m === 'tomb') {
    const T = sim.tomb;
    if (!T) return void returnToTown(sim, 'wipe');
    if (T.over) return void returnToTown(sim, 'clear');
    if (T.b && T.b.st === 'victory' && T.b.at > RETURN_AFTER_WIN) return void returnToTown(sim, 'clear');
  } else if (H.m === 'crypt') {
    const T = sim.crypt;
    if (!T) return void returnToTown(sim, 'wipe');
    if (T.over) return void returnToTown(sim, 'clear');
    if (T.b && T.b.st === 'victory' && T.b.at > RETURN_AFTER_WIN) return void returnToTown(sim, 'clear');
  } else if (GLOW_MISSIONS[H.m]) { // the Glowmire Hollow / Vharok's Tor
    const T = sim.glow;
    if (!T) return void returnToTown(sim, 'wipe');
    if (T.over) return void returnToTown(sim, 'clear');
    if (T.b && T.b.st === 'victory' && T.b.at > RETURN_AFTER_WIN) return void returnToTown(sim, 'clear');
  } else if (H.m === 'forge') {
    const T = sim.forge;
    if (!T) return void returnToTown(sim, 'wipe');
    if (T.over) return void returnToTown(sim, 'clear');
    if (T.b && T.b.st === 'victory' && T.b.at > RETURN_AFTER_WIN) return void returnToTown(sim, 'clear');
  } else if (H.m === 'astrael' || H.m === 'astraelx') {
    const A = sim.astrael;
    if (!A) return void returnToTown(sim, 'wipe');
    if (A.over) return void returnToTown(sim, A.over);
    if (A.st === 'victory' && A.at > RETURN_AFTER_WIN) return void returnToTown(sim, 'clear');
  } else if (opsOf(H.m)) { // a mission dungeon: after the results beat, home to the entrance it was started from
    const O = sim.ops;
    if (!O) return void returnToTown(sim, 'wipe');
    if (O.leave) return void opsHome(sim, O);
  } else if (H.m === 'ultimate') { // Part F: a wipe retries in place (from phase 1); the clear goes home after the victory beat
    const U = sim.ult;
    if (!U) return void returnToTown(sim, 'wipe');
    if (U.st === 'victory' && U.at > RETURN_AFTER_WIN) return void returnToTown(sim, 'clear');
  } else if (MISSION_TRIALS[H.m]) { // Skaldra / Pyrrhex (Trial / Extreme): a wipe retries in place; a clear (exit portal) goes home
    const T = sim.trial;
    if (!T) return void returnToTown(sim, 'wipe');
    if (T.over) return void returnToTown(sim, T.over);
    if (T.st === 'victory' && T.at > RETURN_AFTER_WIN) return void returnToTown(sim, 'clear');
  }
}
/** Compact hub state for co-op snapshots: mission, host id, host's Extreme unlock, the last result. */
import { setAstral, astralAllowed } from './astral.js';
import { doorHidden, SAVAGE_MISSION, allSavagesClear } from './savage.js';
export function packHub(sim) {
  const H = sim.hub;
  if (!H) return null;
  const h = hostOf(sim);
  const out = { m: H.m, h: h ? h.id : 0, x: hasUnlock(h, 'astx') ? 1 : 0, d: hasUnlock(h, 'dunes') ? 1 : 0, tb: hasUnlock(h, 'tomb') ? 1 : 0, f: hasUnlock(h, 'frost') ? 1 : 0, cr: hasUnlock(h, 'crypt') ? 1 : 0, ho: hasUnlock(h, 'hollow') ? 1 : 0, e: hasUnlock(h, 'ember') ? 1 : 0, fo: hasUnlock(h, 'forge') ? 1 : 0, rf: hasUnlock(h, 'rift') ? 1 : 0, vt: hasUnlock(h, 'vtx') ? 1 : 0, as: hasUnlock(h, 'astrael') ? 1 : 0, tr: trialBits(h), l: H.last, ...(hubLayoutOf(sim.world) === 'tavern' ? { ly: 1 } : {}) };
  const ul = (hasUnlock(h, 'ult') ? 1 : 0) | (h && h.unlocks && h.unlocks[ULT_CLEAR_KEY] ? 2 : 0); if (ul) out.ul = ul; // (Part F: the Ultimate open / cleared by the host)
  if (sim.astral) out.as2 = 1; // (Part C: the party is in the Astral World)
  return out;
}

// ------------------------------------------------------------------ mission dungeons (sim/ops.js): the fixed entrances
/** the biome mission a map's entrances belong to ('field' for the Wilds) */
const MAP_OF = Object.fromEntries(OPS_BIOMES.map((b) => [b, OPS_BIOME[b].mission]));
/** Can `p` use entrance `g` right now? '' or the reason. */
export function gateBlock(sim, p, g) {
  const H = sim.hub;
  if (!H || !g) return 'unknown entrance';
  if (!p || p.dead) return 'You are down';
  if (H.m !== MAP_OF[g.biome] || Math.hypot(p.x - g.x, p.y - g.y) > OPS_GATE_R + 70) return 'Walk up to the entrance';
  if (!isHost(sim, p)) return 'Only the host can start a mission';
  return '';
}
/** a hero asked to enter a mission / boss dungeon from its open-world entrance */
function opRequest(sim, p, q) {
  const gates = (sim.world && sim.world.opsGates) || [], g = gates[q.g | 0];
  const why = gateBlock(sim, p, g);
  if (why) { sim.emit({ type: 'hub', ph: 'deny', pid: p.id, id: g ? gateName(g) : 'mission', why, x: r0(p.x), y: r0(p.y) }); return; }
  sim.emit({ type: 'hub', ph: 'gate', pid: p.id, id: g.type === 'boss' ? g.dungeon : opsMissionId(g.biome, g.type), x: g.x, y: g.y, ops: 1 });
  if (g.type === 'boss') startMission(sim, g.dungeon, p); // (the boss dungeons: always open from their entrance, like the old portals)
  else startMission(sim, opsMissionId(g.biome, g.type), p, { x: g.x, y: g.y + 120, biome: g.biome });
}
/** the mission is over: settle (client 'hub' ph 'ops') and walk out of the entrance the party came in by */
function opsHome(sim, O) {
  const back = O.back, why = O.result || 'quit', id = O.mid, biome = O.biome;
  sim.emit({ type: 'hub', ph: 'ops', id, why, x: back ? back.x : 0, y: back ? back.y : 0 });
  if (back) startMission(sim, MAP_OF[biome], null, back);
  else returnToTown(sim, why === 'fail' ? 'wipe' : 'clear');
}
export { BOSS_GATES };
