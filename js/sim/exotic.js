// Piece 4: exclusive loot. The boss-trial item tiers + every gear mechanic that is not a flat stat:
//   Trial tier (rarity 6)   : Rimebound (Skaldra), Cinderbound (Pyrrhex), Starbound (Astrael). Weapon or ring. A passive.
//   Extreme tier (rarity 7) : Zero-Point (Skaldra), Worldheart (Pyrrhex), Big Bang (Astrael). Weapon or ring. A unique proc
//                             with its own visual (client/gearfx.js).
//   Biome set 3-pieces      : Rimewarden (Frostveil) SHATTER, Caldera (Emberdeep) ERUPTION (sets.js holds the names / stats).
// Ladder (consistent across all content): Common < Rare < Epic < Legendary (world / dungeon drops) < Set (a biome + its
// dungeon: Wildwarden / Duneborn crafted, Sunscorch = the Tomb, Rimewarden = Frostveil + the Crypt, Caldera = Emberdeep +
// the Forge of Cinders) < Trial (a boss Trial: Astrael, Skaldra, Pyrrhex) < Extreme (that boss's Extreme).
// A family's proc works once however many of its pieces you wear (a Trial weapon + an Extreme ring = both procs).
// Authoritative sim only (never in a predicting sim). Stats come from the legendary generator x a tier multiplier, so the
// server validator can bound them (server/validate.js).
import { generateItem } from './loot.js';
import { makeSetItem, setPieceName, fourProc } from './sets.js';
import { EQUIP_SLOTS, SET_SLOTS } from './data/items.js';
import { mainKeys } from './loot.js';
import { hitEnemy } from './combat.js';

export const TRIAL_RARITY = 6, EXTREME_RARITY = 7;
export const TIER_MUL = { 6: 1.02, 7: 1.05 }; // main stats vs a Legendary (gear expansion: every slot can be a Trial / Extreme piece now, so a smaller step each)
const NOUN = { warrior: 'Greatblade', ranger: 'Longbow', mage: 'Staff', cleric: 'Mace', bladedancer: 'Fangs', samurai: 'Tachi', monk: 'Wraps', dragoon: 'Lance', summoner: 'Grimoire', bard: 'Lute' };
/** the families: rarity, boss, names, the proc text (tooltips), how to get it */
export const EXOTIC = {
  rimebound: { id: 'rimebound', rarity: 6, boss: 'Skaldra', prefix: 'Rimebound', ring: 'Rimebound Signet', color: '#8fe3ff', proc: 'rime',
    procName: 'RIME EDGE', procText: 'Your hits chill (−30% speed, 2 s). +20% damage to chilled or frozen enemies.', source: 'Skaldra (Trial) drops · or forged from Rimebound Sigils' },
  cinderbound: { id: 'cinderbound', rarity: 6, tier: 6, boss: 'Pyrrhex', prefix: 'Cinderbound', ring: 'Cinderbound Signet', color: '#ff9a4a', proc: 'valve',
    procName: 'PRESSURE VALVE', procText: 'Every 8 s your next hit vents the pressure: ×2.2 ATK in a 130 px burst.', source: 'Pyrrhex (Trial) drops · or forged from Cinderbound Sigils' },
  starbound: { id: 'starbound', rarity: 6, tier: 7, boss: 'Astrael', prefix: 'Starbound', ring: 'Starbound Circlet', color: '#c9b8ff', proc: 'star',
    procName: 'STARFALL', procText: '10% of your hits call down a star a moment later: ×1.6 ATK in 110 px.', source: 'Astrael drops · or forged from Star Shards' },
  zeropoint: { id: 'zeropoint', rarity: 7, boss: 'Skaldra', prefix: 'Zero-Point', ring: "Skaldra's Frozen Heart", color: '#bff6ff', proc: 'zero',
    procName: 'ABSOLUTE ZERO', procText: 'Every 10 s a hit draws a ring of absolute zero around the target that closes in 0.9 s: everything inside freezes (bosses briefly) and takes ×4 ATK.', source: 'Skaldra (Extreme) drops · or forged from her Frozen Heart' },
  worldheart: { id: 'worldheart', rarity: 7, tier: 6, boss: 'Pyrrhex', prefix: 'Worldheart', ring: "Pyrrhex's Molten Core", color: '#ff4a2a', proc: 'heart',
    procName: 'HEARTBEAT OF THE WORLD', procText: 'In combat you beat like the caldera. Every 4th beat is RED: a magma ring races out to 340 px, ×3 ATK to every enemy it passes.', source: 'Pyrrhex (Extreme) drops · or forged from his Molten Core' },
  bigbang: { id: 'bigbang', rarity: 7, tier: 7, boss: 'Astrael', prefix: 'Big Bang', ring: "Astrael's Last Star", color: '#ffe27a', proc: 'nova',
    procName: 'SUPERNOVA', procText: 'Hits gather stardust (crits 2). At 30 your next hit goes supernova: ×5 ATK in 240 px and drags everything in.', source: 'Astrael (Extreme) drops · or forged from the Astral Heart' },
  // game loop A2: Neferakh Unbound
  sunbound: { id: 'sunbound', rarity: 6, boss: 'Neferakh', prefix: 'Sunbound', ring: 'Sunbound Ankh', color: '#ffd86a', proc: 'brand',
    procName: 'SOLAR BRAND', procText: 'Every 6 s a hit brands the target with a sun glyph; 1 s later it flares: ×2 ATK in 140 px.', source: 'Neferakh Unbound (Trial) drops · or forged from Sunbound Sigils' },
  // the Wilds Trial (2026-10-18): Vharok, the Stormhorn
  stormbound: { id: 'stormbound', rarity: 6, boss: 'Vharok', prefix: 'Stormbound', ring: 'Stormbound Antler Ring', color: '#9fdcff', proc: 'thunder',
    procName: 'THUNDERCLAP', procText: 'Every 7 s a hit calls lightning down on the target: ×2 ATK in 120 px.', source: 'Vharok (Trial) drops · or forged from Stormbound Sigils' },
  skyfall: { id: 'skyfall', rarity: 7, boss: 'Vharok', prefix: 'Skyfall', ring: "Vharok's Thunder Heart", color: '#c9a2ff', proc: 'skyfall',
    procName: 'SKYFALL', procText: 'Every 11 s a hit brings the storm down: three bolts strike round the target (×1.4 ATK each in 110 px), then a crash: ×2.6 ATK in 200 px.', source: 'Vharok (Extreme) drops · or forged from his Thunder Heart' },
  blacksun: { id: 'blacksun', rarity: 7, boss: 'Neferakh', prefix: 'Black Sun', ring: "Neferakh's Eclipse Heart", color: '#b07cff', proc: 'bsun',
    procName: 'BLACK SUN', procText: 'Every 12 s a hit hangs a black sun over the target for 3 s: it drags enemies in and burns ×0.4 ATK every 0.5 s, then collapses for ×3 ATK in 200 px.', source: 'Neferakh Unbound (Extreme) drops · or forged from his Eclipse Heart' },
};
export const EXOTIC_SLOTS = SET_SLOTS; // (gear expansion: every slot but the Relic, so a family's 4-piece is reachable)
export const exoticName = (fam, slot, cls) => (slot === 'ring' ? fam.ring : slot === 'weapon' ? `${fam.prefix} ${NOUN[cls] || 'Blade'}` : setPieceName({ short: fam.prefix }, slot, cls));
/** make a Trial / Extreme piece (any slot but the Relic) */
export function makeExotic(rng, id, cls, slot = null) {
  const F = EXOTIC[id]; if (!F) return null;
  slot = EXOTIC_SLOTS.includes(slot) ? slot : EXOTIC_SLOTS[Math.floor(rng.next() * EXOTIC_SLOTS.length)];
  const it = generateItem(rng, { tier: F.tier || 5, cls, slot, rarity: 3, minTier: 5 }), m = TIER_MUL[F.rarity]; // (game loop C2: F.tier = the band it drops in)
  for (const k of mainKeys(it)) if (it.stats[k]) it.stats[k] = Number.isInteger(it.stats[k]) ? Math.round(it.stats[k] * m) : +(it.stats[k] * m).toFixed(3);
  it.rarity = F.rarity; it.ex = id; it.name = exoticName(F, slot, cls);
  return it;
}
/** the procs a hero wears: { rime: 1, ... } (each family's proc from its first piece) + the live 4-piece set mechanic
 *  (shatter / erupt / glyphs / bramble / sandstorm / frostnova, or a family's empowered proc: valve4 / star4 / ...) */
export function procsOf(p) {
  const o = {};
  if (!p || !p.equipment) return o;
  for (const k of EQUIP_SLOTS) { const it = p.equipment[k]; if (it && it.ex && EXOTIC[it.ex]) o[EXOTIC[it.ex].proc] = 1; }
  const f = fourProc(p); if (f) o[f] = 1;
  return o;
}

// ------------------------------------------------------------------ drops
/** Exclusive drops for a kill (rolled per eligible player, on top of the normal bag). e.ex = an Extreme boss. */
export function exclusiveDrops(rng, e, p) {
  const out = [], cls = p.cls, t = e.type;
  const set = (id, ch) => { if (rng.next() < ch) out.push(makeSetItem(rng, cls, null, id)); };
  const ex = (id, ch) => { if (rng.next() < ch) out.push(makeExotic(rng, id, cls)); };
  if (t === 'lumivex') set('mothwing', 1);
  else if (e.glowWave && e.elite) set('mothwing', 0.04);
  if (t === 'osric') set('frostveil', 1);
  else if (t === 'hephast') set('emberdeep', 1);
  else if (e.fz && !e.raid) set('frostveil', e.boss ? 0.2 : e.elite ? 0.03 : 0);
  else if (t === 'raidboss') set('astral', 1); // (game loop C3: the Rift Sanctum is Map 5's dungeon)
  else if (e.ez && !e.raid) set('emberdeep', e.boss ? 0.2 : e.elite ? 0.03 : 0);
  else if (e.rz && !e.raid) set('astral', e.boss ? 0.2 : e.elite ? 0.03 : 0);
  if (t === 'trskaldra') ex('rimebound', 0.3);
  if (t === 'trskaldrax') { ex('rimebound', 1); ex('zeropoint', 0.25); }
  if (t === 'trpyrrhex') ex('cinderbound', 0.3);
  if (t === 'trpyrrhexx') { ex('cinderbound', 1); ex('worldheart', 0.25); }
  if (t === 'trvharok') ex('stormbound', 0.3);
  if (t === 'trvharokx') { ex('stormbound', 1); ex('skyfall', 0.25); }
  if (t === 'trneferakh') ex('sunbound', 0.3);
  if (t === 'trneferakhx') { ex('sunbound', 1); ex('blacksun', 0.25); }
  if (t === 'trneferakhs') { ex('sunbound', 1); ex('blacksun', 0.5); } // (Part 1S: the weekly coffer is on top, sim/trials.js savageClear)
  if (t === 'astrael') { if (e.ex) { ex('starbound', 1); ex('bigbang', 0.25); } else ex('starbound', 0.3); }
  const rl = relicChance(e); if (rl && rng.next() < rl) out.push(makeRelic(rng, cls, e.boss ? Math.max(5, e.zone | 0) : Math.max(3, Math.min(7, (e.zone | 0) + 1)), TRIAL_BOSS.has(t) ? 3 : null));
  return out;
}
// ------------------------------------------------------------------ relics (gear expansion: the special 10th slot)
// Relics never drop from the normal bag: elites (4%), bosses (world / dungeon 20%), Trial / Extreme bosses (50%, always
// Legendary) and Swarm chests (sim/sites.js, 25%).
export const RELIC_DROP = { elite: 0.04, boss: 0.2, trial: 0.5, chest: 0.25 };
const TRIAL_BOSS = new Set(['trskaldra', 'trskaldrax', 'trpyrrhex', 'trpyrrhexx', 'trneferakh', 'trneferakhx', 'trneferakhs', 'astrael', 'trvharok', 'trvharokx']);
export const relicChance = (e) => (TRIAL_BOSS.has(e.type) ? RELIC_DROP.trial : e.raid ? 0 : e.boss ? RELIC_DROP.boss : e.elite ? RELIC_DROP.elite : 0);
/** a relic (Epic, 30% Legendary unless asked) */
export function makeRelic(rng, cls, tier = 5, rarity = null) {
  return generateItem(rng, { tier, cls, slot: 'relic', rarity: rarity == null ? (rng.next() < 0.3 ? 3 : 2) : rarity });
}

// ------------------------------------------------------------------ procs (combat.js hitEnemy calls these)
export const GX = {
  rime: { slow: 120, slowMul: 0.7, mul: 1.2 },
  valve: { cd: 480, mul: 2.2, r: 130 },
  star: { chance: 0.1, cd: 24, delay: 26, mul: 1.6, r: 110 },
  zero: { cd: 600, d: 54, r: 240, mul: 4, freeze: 120 },
  heart: { every: 72, red: 4, d: 42, r: 340, mul: 3, combat: 180 },
  nova: { need: 30, mul: 5, r: 240, pull: 120 },
  brand: { cd: 360, d: 60, mul: 2, r: 140 }, bsun: { cd: 720, d: 180, tick: 30, burn: 0.4, mul: 3, r: 200, pull: 1.6 }, // (game loop A2)
  brand4: { cd: 270 }, bsun4: { cd: 540 },
  valve4: { cd: 360, r: 170 }, star4: { chance: 0.16 }, zero4: { cd: 450 }, heart4: { red: 3 }, nova4: { need: 22 },
  thunder: { cd: 420, mul: 2, r: 120 }, thunder4: { cd: 300 }, skyfall: { cd: 660, mul: 1.4, r: 110, crash: 2.6, cr: 200 }, skyfall4: { cd: 480 }, moonlit: { cd: 420, mul: 1.8, r: 150, heal: 0.03 }, // (2026-10-18: the Wilds' dungeon set + Trial families)
  bramble: { every: 6, mul: 1.4, r: 120, heal: 0.02 },
  sandstorm: { cd: 240, mul: 1.5, r: 150 },
  frostnova: { cd: 180, mul: 1.4, r: 170, slow: 180, slowMul: 0.7 },
  shatter: { need: 6, freeze: 72, mul: 2.5, r: 140, cd: 90, bossIce: 60 },
  constellation: { need: 7, cd: 120, mul: 3, splash: 1.5, r: 160 }, // (game loop C3: the Astral set)
  erupt: { need: 100, basic: 8, skill: 15, mul: 2.4, r: 190, pool: 180, poolR: 120, tick: 30, poolMul: 0.25 }, // (balance pass: ×3 / ×0.3 -> ×2.4 / ×0.25: 20% of a Caldera wearer's boss damage, 38% for crit kits)
};
const gx = (p) => p.gx || (p.gx = { brand: 0, bsun: 0, valve: 0, zero: 0, star: 0, heat: 0, dust: 0, beat: 0, beatN: 0, lastBeat: 0, thorn: 0, fin: 0 });
const novaNeed = (P) => (P.nova4 ? GX.nova4.need : GX.nova.need);
const r0 = (v) => Math.round(v);
/** damage multiplier before mitigation (Rime Edge vs chilled / frozen) */
export function gearMul(p, e) {
  if (!p.gxRime) return 1;
  const q = p.equipment || {}; if (!EQUIP_SLOTS.some((k) => q[k] && q[k].ex === 'rimebound')) { p.gxRime = false; return 1; } // (unequipped since the last hit)
  return e.cc.frozen || e.cc.slow > 0 || (e.gIce | 0) > 0 ? GX.rime.mul : 1;
}
function burst(sim, p, x, y, r, mul, o = {}) {
  let n = 0;
  for (const en of sim.enemies) {
    if (en.dead || en.untargetable || en.dummy && o.noDummy || Math.hypot(en.x - x, en.y - y) > r + en.r) continue;
    if (hitEnemy(sim, p, en, { mul, gear: true, dot: true, noPop: true, hitstop: 2, kbAng: Math.atan2(en.y - y, en.x - x), style: o.style || null, ...o.hit })) n++;
  }
  return n;
}
const ev = (sim, p, ph, o) => sim.emit({ type: 'gear', ph, pid: p.id, ...o });
/** after a landed hit (not one of our own gear hits) */
export function gearOnHit(sim, p, e, o, crit) {
  if (sim.predicting || o.gear) return;
  const P = procsOf(p); p.gxRime = !!P.rime;
  if (!Object.keys(P).length) return;
  const G = gx(p), skill = !o.basic;
  if (P.rime && !e.dead) { e.cc.slow = Math.max(e.cc.slow, GX.rime.slow); e.cc.slowMul = Math.min(e.cc.slowMul || 1, GX.rime.slowMul); }
  if (P.shatter) shatter(sim, p, e, skill);
  if (P.constellation && !e.dead) { // the Astral 4-piece: pin stars, then connect them
    const C = GX.constellation; e.gStar = (e.gStar | 0) + (skill ? 2 : 1);
    if (e.gStar >= C.need && sim.tick >= (G.cons | 0)) {
      e.gStar = 0; G.cons = sim.tick + C.cd;
      ev(sim, p, 'constellation', { x: r0(e.x), y: r0(e.y), r: C.r, eid: e.id });
      hitEnemy(sim, p, e, { mul: C.mul, gear: true, dot: true, noPop: true, hitstop: 3, style: 'star' });
      for (const en of sim.enemies) { if (en === e || en.dead || en.untargetable || Math.hypot(en.x - e.x, en.y - e.y) > C.r + en.r) continue; hitEnemy(sim, p, en, { mul: C.splash, gear: true, dot: true, noPop: true, hitstop: 1, style: 'star' }); }
    }
  }
  if (P.erupt) {
    if (G.heat >= GX.erupt.need) { G.heat = 0; ev(sim, p, 'erupt', { x: r0(e.x), y: r0(e.y), r: GX.erupt.r }); burst(sim, p, e.x, e.y, GX.erupt.r, GX.erupt.mul, { style: 'magma' }); (sim.gearFx || (sim.gearFx = [])).push({ k: 'pool', pid: p.id, x: r0(e.x), y: r0(e.y), t: 0, d: GX.erupt.pool }); }
    else if (crit) { const h0 = G.heat; G.heat = Math.min(100, G.heat + (skill ? GX.erupt.skill : GX.erupt.basic)); if (Math.floor(h0 / 25) !== Math.floor(G.heat / 25)) ev(sim, p, 'charge', { k: 'heat', n: G.heat, x: r0(p.x), y: r0(p.y) }); }
  }
  if (P.valve && sim.tick >= G.valve) { const vr = P.valve4 ? GX.valve4.r : GX.valve.r; G.valve = sim.tick + (P.valve4 ? GX.valve4.cd : GX.valve.cd); ev(sim, p, 'valve', { x: r0(e.x), y: r0(e.y), r: vr }); burst(sim, p, e.x, e.y, vr, GX.valve.mul); }
  if (P.bramble && ++G.thorn >= GX.bramble.every) { G.thorn = 0; ev(sim, p, 'bramble', { x: r0(e.x), y: r0(e.y), r: GX.bramble.r }); burst(sim, p, e.x, e.y, GX.bramble.r, GX.bramble.mul, { style: 'leaf' }); p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * GX.bramble.heal); }
  if (P.moonlit && sim.tick >= (G.moon | 0)) { const M = GX.moonlit; G.moon = sim.tick + M.cd; ev(sim, p, 'moonlit', { x: r0(e.x), y: r0(e.y), r: M.r }); burst(sim, p, e.x, e.y, M.r, M.mul, { style: 'leaf' }); p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * M.heal); }
  if (P.thunder && sim.tick >= (G.thun | 0)) { const M = GX.thunder; G.thun = sim.tick + (P.thunder4 ? GX.thunder4.cd : M.cd); ev(sim, p, 'thunder', { x: r0(e.x), y: r0(e.y), r: M.r }); burst(sim, p, e.x, e.y, M.r, M.mul); }
  if (P.skyfall && sim.tick >= (G.sky | 0)) { const M = GX.skyfall; G.sky = sim.tick + (P.skyfall4 ? GX.skyfall4.cd : M.cd); ev(sim, p, 'skyfall', { x: r0(e.x), y: r0(e.y), r: M.cr }); for (let i = 0; i < 3; i++) { const a = i * 2.094; burst(sim, p, e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, M.r, M.mul); } burst(sim, p, e.x, e.y, M.cr, M.crash); }
  p.gxT = e.id;
  if (P.star && sim.tick >= G.star && sim.rng.next() < (P.star4 ? GX.star4.chance : GX.star.chance)) { G.star = sim.tick + GX.star.cd; (sim.gearFx || (sim.gearFx = [])).push({ k: 'star', pid: p.id, x: r0(e.x), y: r0(e.y), t: 0, d: GX.star.delay }); ev(sim, p, 'star', { x: r0(e.x), y: r0(e.y), r: GX.star.r, d: GX.star.delay }); }
  if (P.zero && sim.tick >= G.zero) { G.zero = sim.tick + (P.zero4 ? GX.zero4.cd : GX.zero.cd); (sim.gearFx || (sim.gearFx = [])).push({ k: 'zero', pid: p.id, x: r0(e.x), y: r0(e.y), t: 0, d: GX.zero.d }); ev(sim, p, 'zero', { x: r0(e.x), y: r0(e.y), r: GX.zero.r, d: GX.zero.d }); }
  if (P.nova) {
    if (G.dust >= novaNeed(P)) { G.dust = 0; novaBurst(sim, p, e.x, e.y); }
    else { const d0 = G.dust; G.dust = Math.min(novaNeed(P), G.dust + (crit ? 2 : 1)); if (Math.floor(d0 / 10) !== Math.floor(G.dust / 10)) ev(sim, p, 'charge', { k: 'dust', n: G.dust, x: r0(p.x), y: r0(p.y) }); }
  }
  if (P.brand && sim.tick >= (G.brand | 0) && !e.dead) { G.brand = sim.tick + (P.brand4 ? GX.brand4.cd : GX.brand.cd); (sim.gearFx || (sim.gearFx = [])).push({ k: 'brand', pid: p.id, eid: e.id, x: r0(e.x), y: r0(e.y), t: 0, d: GX.brand.d }); ev(sim, p, 'brand', { x: r0(e.x), y: r0(e.y), r: GX.brand.r, d: GX.brand.d, eid: e.id }); }
  if (P.bsun && sim.tick >= (G.bsun | 0)) { G.bsun = sim.tick + (P.bsun4 ? GX.bsun4.cd : GX.bsun.cd); (sim.gearFx || (sim.gearFx = [])).push({ k: 'bsun', pid: p.id, x: r0(e.x), y: r0(e.y), t: 0, d: GX.bsun.d }); ev(sim, p, 'bsun', { x: r0(e.x), y: r0(e.y), r: GX.bsun.r, d: GX.bsun.d }); }
  if (P.heart) G.lastBeat = sim.tick;
}
/** a chain finisher landed on e (sim/dunes.js chainHooks): the finisher 4-pieces (Duneborn SANDSTORM, Rimebound FROST NOVA) */
export function gearFinisher(sim, p, e) {
  if (sim.predicting || !e) return;
  const P = procsOf(p);
  if (!P.sandstorm && !P.frostnova) return;
  const G = gx(p);
  if (sim.tick < G.fin) return;
  if (P.frostnova) {
    const F = GX.frostnova; G.fin = sim.tick + F.cd;
    ev(sim, p, 'frostnova', { x: r0(e.x), y: r0(e.y), r: F.r });
    for (const en of sim.enemies) if (!en.dead && !en.untargetable && Math.hypot(en.x - e.x, en.y - e.y) <= F.r + en.r) { en.cc.slow = Math.max(en.cc.slow, F.slow); en.cc.slowMul = Math.min(en.cc.slowMul || 1, F.slowMul); }
    burst(sim, p, e.x, e.y, F.r, F.mul, { style: 'ice' });
  } else {
    const S = GX.sandstorm; G.fin = sim.tick + S.cd;
    ev(sim, p, 'sandstorm', { x: r0(e.x), y: r0(e.y), r: S.r });
    burst(sim, p, e.x, e.y, S.r, S.mul, { style: 'sand' });
  }
}
function shatter(sim, p, e, skill) {
  const S = GX.shatter;
  if (e.dead) return;
  if ((e.cc.frozen || (e.gIce || 0) > sim.tick) && (e.gShat || 0) <= sim.tick) {
    e.gShat = sim.tick + S.cd; e.gFrost = 0; e.gIce = 0; e.cc.frozen = false; e.cc.stun = Math.min(e.cc.stun, 1);
    ev(sim, p, 'shatter', { x: r0(e.x), y: r0(e.y), r: S.r });
    burst(sim, p, e.x, e.y, S.r, S.mul, { style: 'ice' });
    return;
  }
  e.gFrost = (e.gFrost || 0) + (skill ? 2 : 1);
  if (e.gFrost >= S.need && (e.gShat || 0) <= sim.tick) {
    e.gFrost = 0;
    hitEnemy(sim, p, e, { mul: 0.3, gear: true, dot: true, noPop: true, freeze: S.freeze, hitstop: 2 });
    if (e.boss || e.raid) e.gIce = sim.tick + S.bossIce; // (bosses can't be frozen: a brief ice shell the next hit shatters)
    ev(sim, p, 'freeze', { x: r0(e.x), y: r0(e.y), r: r0(e.r || 30) });
  }
}
function novaBurst(sim, p, x, y) {
  ev(sim, p, 'nova', { x: r0(x), y: r0(y), r: GX.nova.r });
  for (const en of sim.enemies) { // drag everything in first, then the blast
    if (en.dead || en.untargetable || en.boss || en.raid || en.mass >= 50) continue;
    const d = Math.hypot(en.x - x, en.y - y); if (d > GX.nova.r + en.r || d < 1) continue;
    const k = Math.min(GX.nova.pull, d - 20) / d; en.x -= (en.x - x) * k; en.y -= (en.y - y) * k;
  }
  burst(sim, p, x, y, GX.nova.r, GX.nova.mul, { style: 'star', hit: { heavy: true } });
}
/** per tick: delayed procs (stars, closing zero rings, magma pools) + the heartbeat */
export function updateGear(sim) {
  if (sim.predicting) return;
  const L = sim.gearFx;
  if (L && L.length) {
    for (const f of L) {
      f.t++;
      const p = sim.players.get(f.pid);
      if (!p) { f.t = f.d; continue; }
      if (f.k === 'star' && f.t === f.d) burst(sim, p, f.x, f.y, GX.star.r, GX.star.mul, { style: 'star' });
      if (f.k === 'zero' && f.t === f.d) burst(sim, p, f.x, f.y, GX.zero.r, GX.zero.mul, { style: 'ice', hit: { freeze: GX.zero.freeze, heavy: true } });
      if (f.k === 'brand' && f.t === f.d) { const en = sim.enemyById && sim.enemyById.get(f.eid); if (en && !en.dead) { f.x = r0(en.x); f.y = r0(en.y); } burst(sim, p, f.x, f.y, GX.brand.r, GX.brand.mul, { style: 'sand' }); ev(sim, p, 'flare', { x: f.x, y: f.y, r: GX.brand.r }); }
      if (f.k === 'bsun') { // drag the small ones in, burn, then collapse
        const B = GX.bsun;
        for (const en of sim.enemies) { if (en.dead || en.untargetable || en.boss || en.raid || en.mass >= 50) continue; const d = Math.hypot(en.x - f.x, en.y - f.y); if (d > B.r + en.r || d < 24) continue; en.x -= (en.x - f.x) / d * B.pull; en.y -= (en.y - f.y) / d * B.pull; }
        if (f.t % B.tick === 0 && f.t < f.d) burst(sim, p, f.x, f.y, B.r, B.burn, { hit: { hitstop: 0 } });
        if (f.t === f.d) { burst(sim, p, f.x, f.y, B.r, B.mul, { style: 'star', hit: { heavy: true } }); ev(sim, p, 'collapse', { x: f.x, y: f.y, r: B.r }); }
      }
      if (f.k === 'pool' && f.t % GX.erupt.tick === 0) burst(sim, p, f.x, f.y, GX.erupt.poolR, GX.erupt.poolMul, { hit: { hitstop: 0 } });
      if (f.k === 'ring') {
        const r = GX.heart.r * Math.min(1, f.t / f.d);
        for (const en of sim.enemies) { if (en.dead || en.untargetable || f.hit[en.id]) continue; const d = Math.hypot(en.x - f.x, en.y - f.y); if (d <= r + en.r) { f.hit[en.id] = 1; hitEnemy(sim, p, en, { mul: GX.heart.mul, gear: true, dot: true, noPop: true, style: 'magma', hitstop: 2, kbAng: Math.atan2(en.y - f.y, en.x - f.x), kb: 80 }); } }
      }
    }
    sim.gearFx = L.filter((f) => f.t < f.d);
  }
  if (sim.tick % 6) return; // (the heartbeat clock: cheap, 10 Hz)
  for (const p of sim.players.values()) {
    const G = p.gx; if (!G || p.dead || !G.lastBeat || sim.tick - G.lastBeat > GX.heart.combat) continue;
    if (!procsOf(p).heart) { G.lastBeat = 0; continue; }
    if (sim.tick - G.beat < GX.heart.every) continue;
    G.beat = sim.tick; G.beatN = (G.beatN + 1) % (procsOf(p).heart4 ? GX.heart4.red : GX.heart.red);
    const red = G.beatN === 0;
    ev(sim, p, 'beat', { x: r0(p.x), y: r0(p.y), red: red ? 1 : 0, r: red ? GX.heart.r : 90, d: GX.heart.d });
    if (red) (sim.gearFx || (sim.gearFx = [])).push({ k: 'ring', pid: p.id, x: r0(p.x), y: r0(p.y), t: 0, d: GX.heart.d, hit: {} });
  }
}
/** the HUD meter for the local hero: { k: 'heat' | 'dust', n, need } or null */
export function gearMeter(p) {
  const P = procsOf(p), G = p && p.gx;
  if (P.erupt) return { k: 'heat', n: G ? G.heat : 0, need: GX.erupt.need };
  if (P.nova) return { k: 'dust', n: G ? G.dust : 0, need: novaNeed(P) };
  return null;
}
