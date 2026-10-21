// Player controller: input command -> actions (basic combo, skills, dodge), chain detection,
// inventory commands. Pure sim code.
import { brChain, brSpecial, brUlt, brUltEnd, brTick } from './bossrot.js'; // boss rotation cycle (bank / Special hinge / window / ult release)
import { ascendedUlt } from './ascended.js';
import { altSkill, ALT_SKILLS } from './ascalt.js';
import { startDuel, leaveDuel, duelSkip, duelClash } from './shadowduel.js';
import { normPerks, masteryOf, pickPerk, PERKS, respecCost } from './mastery.js';
import { BAG_BASE, BAG_MAX, clampBag, resizeBag } from './bagsize.js';
import { hordeChainBurst } from './hordeaoe.js';
import { ULT_SURGE } from './data/tuning.js';
import { POTION } from './village.js';
import { evadeStep } from './evade.js'; // evasive dashes (2026-10-06)
import { wantsShadow, shadowRun, lockBreakable, toShadow } from './skillform.js';
import { CLASSES, SKILL_KEYS, dodgeOf, chainById, rageOn, DODGE, SPRINT, GCD, GCD_QUEUE } from './data/classes.js';
import { computeStats } from './progression.js';
import { AFFIX_MIGRATE, BASE_NAMES, PREFIX, EQUIP_SLOTS, fitsSlot } from './data/items.js';
import { normEquipment, migrateItem, equipTarget, isGearItem, stampGot } from './gear.js';
import { ascendItem, ascendCost, isCatalyst, rerollOk, applyReroll, REROLL } from './meta.js';
import { GATE_ATTUNE, isHost, setDummyCfg } from './hub.js';
import { normLoadouts, normLoIndex, normChainSet, loadoutCommand } from './loadout.js';
import { DT, SPAWN_POS, PLAYER_SPEED, zoneAt, secs } from './constants.js';
import { resolveCircle, unstick, pointBlocked, clearPath } from './world.js';
import { hitEnemiesInShape, hitEnemy, spawnProjectile, addArea, respawnPlayer, healAllies, grantShield, eclipseBurst, ultMul, ultHitMul, ULT, ECLIPSE, RAGE, SUNDER, HOLD_BREAK } from './combat.js';
import { clamp } from './math.js';
import { WAR_SKILLS, tickWarrior, initWm, wmCast, basicsOf, wmSpeedMul, isSwapKey, tickBuffs } from './warrior.js';
import { SAM_SKILLS, tickSamurai, initSam, samCast } from './samurai.js';
import { defTick, defChain } from './defense.js';
import { MONK_SKILLS, tickMonk, initMonk, monkCast } from './monk.js';
import { DRG_SKILLS, tickDragoon, initDragoon, drgCast } from './dragoon.js';
import { ARC_SKILLS, tickArc, initArc, arcCast, tickSongs, arcNeed, hasteMove, hasteCd } from './arcana.js';
import { SPEC_SKILLS, SPK, tickSpecials, specOnCast, specChain, primeFive } from './specials.js';
import { CHAIN_FX, ULTWIN, stateChain, afterCastState, tickState, statePrimed, chainHist, chainGrace, runSched, endUltWindow, addStacks, takeStacks, stackN, MAG, CLR, schedule, ANGEL, setState } from './kit.js';
const OP_ACTS = new Set(['extract', 'cont', 'ready', 'pulse', 'build', 'reboot', 'net']), OP_BUILDS = new Set(['turret', 'spike', 'ward', 'up']); // mission acts (sim/ops.js opsAct)

/** the starting bag size (inventory pass: 64 slots, more from account level and future sources, sim/bagsize.js) */
export const INV_SIZE = BAG_BASE;
/** a hero's bag size from a save: its bagSize (clamped 64..128), never smaller than the slots its items occupy */
export function heroBagSize(char) {
  const raw = Array.isArray(char && char.inventory) ? char.inventory : [];
  let used = 0; for (let i = Math.min(raw.length, BAG_MAX) - 1; i >= 0; i--) if (raw[i]) { used = i + 1; break; }
  return Math.max(clampBag(char && char.bagSize), used);
}

export function createPlayer(sim, char) {
  const cls = CLASSES[char.cls] ? char.cls : 'warrior';
  const inv = Array(heroBagSize(char)).fill(null), spill = [];
  (char.inventory || []).slice(0, inv.length).forEach((it, i) => (inv[i] = it ? migrateItem(it) : null));
  const equipment = normEquipment(char.equipment, spill); // (gear expansion: 10 slots; old items migrate, sim/gear.js)
  for (const it of spill) { const i = inv.indexOf(null); if (i >= 0) inv[i] = it; }
  const p = {
    id: sim.id(), kind: 'player', charId: char.id, name: char.name || 'Hero', cls,
    appearance: { skin: 0, hairStyle: 0, hairColor: 0, outfit: 0, ...(char.appearance || {}) },
    level: char.level || 1, xp: char.xp || 0,
    equipment,
    inventory: inv,
    x: SPAWN_POS.x, y: SPAWN_POS.y + 40, px: 0, py: 0, vx: 0, vy: 0, r: 16, aim: 0,
    hp: 1, res: 0, stats: null, action: null, cds: { Q: 0, E: 0, R: 0, F: 0, SP: 0 },
    dodgeCd: 0, dodgeN: DODGE.charges, dodgeRe: 0, sprint: 0, iframes: 0, evade: 0, superArmor: false, stun: 0, hitstop: 0, flash: 0, guard: 0,
    dead: false, respawnAt: 0, history: [], lastBasic: { idx: -1, endTick: -999 },
    comboHits: 0, comboTimer: 0, bestCombo: 0,
    input: { mx: 0, my: 0, ax: 1, ay: 0, attack: false },
    pendingSkill: null, bufSkill: null, bufTtl: 0, pendingDodge: false, bufDodge: 0,
    commands: [], kills: char.kills || 0, deaths: char.deaths || 0, mxp: Math.max(0, +char.mxp || 0), mperks: normPerks(char.mperks, masteryOf(char).rank), // (game loop B1: Mastery)
    traps: [], moving: false, dirty: false,
    shield: 0, shieldMax: 0, shieldT: 0, perfectCrit: 0, healDone: 0, healTaken: 0,
    stealth: 0, stealthSrc: null, gcd: 0, edge: 0, edgeT: 0, critRun: 0, momCut: {}, // Blade Dancer stealth (Vanish) + global recovery + Edge (crit stacks); Warrior Momentum cooldown-cut flags
    // ultimate meter (never loaded from a save: every session starts at 0)
    ult: 0, ultLast: null, ultRot: { ids: [], start: 0, dmg0: 0 }, chainPending: null, dmgTaken: 0, lastCombat: -99999,
    pendingUlt: false, bufUlt: 0, rage: 0, aura: 0, eclipse: null, rotations: 0, ultGained: 0, ultUses: 0, ultHitBudget: 0, clones: [], ultHitTick: -1, ultHitTickSum: 0, ultFromHits: 0,
    uw: null, cst: null, sched: [], lastVolley: null, lastSanct: null, // ult window (routes), class state, scheduled hits, last Volley / Sanctuary (Storm Lance / Holy Nova)
    ws: null, holdKey: null, holdT: 0, pendingCharge: 0, bufCharge: 0, wq: [], weave: 0, // (wq: queued Warrior presses; weave: ticks left of the 3rd-basic weave)
    // Warrior: the button string in progress, the skill key being held (Rage charge), a press's hold length
  };
  p.loadouts = normLoadouts(char.loadouts, cls); p.lo = normLoIndex(char.lo); p.chainSet = normChainSet(char.chainSet, cls); p.loCast = null; // (step 4: loadout presets + the chain setup, sim/loadout.js)
  if (AFFIX_MIGRATE[cls]) migrateClassGear(p);
  if (CLASSES[cls].grim || CLASSES[cls].bard) initArc(p); // Summoner / Bard: empowerment, creature queue
  if (CLASSES[cls].lance) initDragoon(p); // Dragoon: Skyborne empowerment, dive marks, dragon echoes
  if (CLASSES[cls].fist) initMonk(p); // Monk: hit counter + spirit echoes
  if (CLASSES[cls].blade) initSam(p); // Samurai: the parry window + Delayed Cut bookkeeping
  if (CLASSES[cls].arms) initWm(p); // Warrior Weapon Master: the drawn weapon + the Trinity tracker
  p.px = p.x; p.py = p.y;
  p.stats = computeStats(p);
  p.hp = p.stats.maxHp;
  p.res = startRes(p); // Holy Charge starts half full, Rage empty; the rest is earned by fighting
  return p;
}

/** Warrior / Blade Dancer gear: Max Resource / Resource Regen did nothing for Rage or pips. Old rolls become the class's stats
 *  (Warrior: Rage Gain / Rage-spend damage; Blade Dancer: Crit Damage / Crit Chance), at the same share of their range. */
export function migrateClassGear(p) {
  const M = AFFIX_MIGRATE[p.cls];
  if (!M) return;
  const fix = (it) => {
    if (!it || !it.stats) return;
    const s = it.stats;
    for (const k of Object.keys(M)) if (s[k] != null && M[k]) { const [to, f] = M[k]; s[to] = +((s[to] || 0) + s[k] * f).toFixed(3); delete s[k]; }
  };
  for (const k in p.equipment) fix(p.equipment[k]);
  for (const it of p.inventory) fix(it);
}

/** Resource on spawn / respawn: full, Holy Charge half, Rage empty. */
export function startRes(p) { const c = CLASSES[p.cls]; return c.rageRes || c.gloryRes || c.focusRes || c.chiRes || c.bloodRes || c.inkRes || c.tempoRes ? 0 : c.resOnBasicHit ? p.stats.maxRes * 0.5 : p.stats.maxRes; }

export function refreshStats(p) {
  p.stats = computeStats(p);
  p.hp = Math.min(p.hp, p.stats.maxHp);
  p.res = Math.min(p.res, p.stats.maxRes);
}

function pushHistory(sim, p, a) {
  p.history.push({ a, tick: sim.tick });
  if (p.history.length > 16) p.history.shift(); // (16: basics in between no longer break chains, so keep enough skill steps)
}

/** Find the longest defined chain that ends with `key` and matches recent history within windows. */
export function findChain(p, key, tick) {
  const rg = rageOn(p); // Warrior: with 50+ Rage (or in Berserk) each input pair plays its Rage version
  const chains = CLASSES[p.cls].chains.filter((c) => !c.stealth && !c.vanish && !c.state && !c.sp && (!c.rage || rg) && (!c.need || arcNeed(p, c.need)) && c.seq[c.seq.length - 1] === key).sort((a, b) => b.seq.length - a.seq.length || (b.rage ? 1 : 0) - (a.rage ? 1 : 0));
  for (const c of chains) {
    let ok = true, t = tick; const H = chainHist(p, c.seq);
    for (let i = c.seq.length - 2, h = H.length - 1; i >= 0; i--, h--) {
      const e = H[h];
      if (!e || e.a !== c.seq[i] || t - e.tick > c.window) { ok = false; break; }
      t = e.tick;
    }
    if (ok) return c;
  }
  return null;
}

/** Vanish chains trigger from the stealth state (Vanish, or Shadow Pierce's re-stealth), not from the key history, so
 *  Shadow Pierce -> Death Blossom works. Eclipse's own brief shade and Shadow Step's kept stealth do not count. */
export function vanishStealth(p) { return p.stealth > 0 && (p.stealthSrc === 'vanish' || p.stealthSrc === 'pierce'); }
/** The Vanish chain for a skill key, if the player is in Vanish stealth. */
export function stealthChain(p, key) {
  const from = hiddenFrom(p);
  if (!from) return null;
  if (from === 'vanish' && eclipseCapped(p)) return null; // Eclipse: only a few free Vanish chains per ult (a 3-step chain counts once)
  return CLASSES[p.cls].chains.find((c) => c.stealth && (c.from || 'vanish') === from && c.seq[c.seq.length - 1] === key) || null;
}
/** Which Vanish-chain stage the stealth allows: 'vanish' (Vanish / Pierce re-stealth), 'shadow' (Shadow Step's kept stealth) or null. */
export function hiddenFrom(p) {
  if (!(p.stealth > 0)) return null;
  if (p.stealthSrc === 'vanish' || p.stealthSrc === 'pierce') return 'vanish';
  if (p.stealthSrc === 'shadow') return 'shadow';
  return null;
}
const eclipseCapped = (p) => !!(p.eclipse && (p.eclipse.vc || 0) >= ECLIPSE.vanishChains);
/** Shadow Execution: Heartseeker while any of your Marks is alive (state-triggered like the Vanish chains, so basic swings
 *  while you wait for pips don't break it). Wins over Shadow Strike (it still costs its pips: 13 in all with Vanish + Thousand Cuts). */
export function markChain(sim, p, key) {
  const c = CLASSES[p.cls].chains.find((ch) => ch.vanish && ch.seq[ch.seq.length - 1] === key);
  return c && marksOf(sim, p).length ? c : null;
}
/** Live Marked for Death stacks this player has on enemies (the view's enemies in a co-op client). */
export function marksOf(sim, p) { return targetsOf(sim).filter((e) => !e.dead && e.mark && e.mark.pid === p.id && e.mark.n > 0 && e.mark.t > 0); }

// ------------------------------------------------------------------ Eclipse finisher routes (Blade Dancer)
/** Route state lives on the Eclipse: rt = { st: {mob, boss} steps done, x: {mob, boss} broken, k: kills on the mob route,
 *  cm: {enemyId: Mark stacks the route's Shadow Execution used on it}, fin: route being finished }. */
export const newRouteState = () => ({ st: { mob: 0, boss: 0 }, x: { mob: 0, boss: 0 }, k: 0, cm: {}, cr: 0, fin: null }); // cr: crits landed (Blade Dancer finishers scale with it)
const routesOf = (p) => CLASSES[p.cls].routes || [];
/** Where the finisher routes live: the Blade Dancer's Eclipse, or the ult window of the other classes. */
export const routeHost = (p) => p.eclipse || p.uw || null;
/** The live route step a skill key would play: { chain } (chain = the forced chain, null for a plain skill) or null. */
export function routeCast(p, key) {
  const h = routeHost(p), rt = h && h.rt;
  if (!rt || rt.fin) return null;
  let out = null;
  for (const r of routesOf(p)) {
    const i = rt.st[r.route];
    if (rt.x[r.route] || r.seq[i] !== key) continue;
    const id = r.chains[i];
    if (!out || (id && !out.chain)) out = { chain: id ? chainById(p.cls, id) : null };
  }
  return out;
}
/** A skill was cast during Eclipse: advance every live route it matches, break the started ones it doesn't (casts before the
 *  opening Vanish leave the routes waiting). */
function advanceRoutes(sim, p, key) {
  const h = routeHost(p), rt = h && h.rt;
  if (!rt || rt.fin) return;
  for (const r of routesOf(p)) {
    const R = r.route, i = rt.st[R];
    if (rt.x[R]) continue;
    if (r.seq[i] === key) {
      rt.st[R] = i + 1;
      sim.emit({ type: 'routeStep', pid: p.id, route: R, id: r.id, name: r.name, step: i + 1, of: r.seq.length, x: p.x, y: p.y });
      if (i + 1 === r.seq.length) rt.fin = R;
    } else if (i > 0) { rt.x[R] = 1; sim.emit({ type: 'routeBreak', pid: p.id, route: R, id: r.id, name: r.name, step: i, x: p.x, y: p.y }); }
  }
  if (p.uw && !rt.fin) for (const r of routesOf(p)) if (!rt.x[r.route] && rt.st[r.route] > 0 && rt.st[r.route] < r.seq.length) p.cds[r.seq[rt.st[r.route]]] = 0; // the ult window readies each live route's next step
}
/** For the HUD: both routes with their progress (null outside Eclipse / for classes without routes). */
export function routeGuide(p) {
  const h = routeHost(p), rt = h && h.rt;
  if (!rt) return null;
  const rs = routesOf(p);
  if (!rs.length) return null;
  return rs.map((r) => ({ id: r.id, name: r.name, route: r.route, seq: r.seq, step: rt.st[r.route], broken: !!rt.x[r.route], done: rt.st[r.route] >= r.seq.length, fin: rt.fin === r.route }));
}
/** Eclipse ends (timer or a finisher): burst on every Backstabbed enemy, pips refill. */
function endEclipse(sim, p, finisher = null) {
  if (!p.eclipse) return;
  const hits = eclipseBurst(sim, p);
  p.eclipse = null;
  p.res = p.stats.maxRes;
  brUltEnd(sim, p);
  sim.emit({ type: 'eclipseEnd', pid: p.id, x: p.x, y: p.y, n: hits.length, total: hits.reduce((t, h) => t + h.dmg, 0), finisher: finisher || undefined });
}

/** For UI: chains whose prefix is currently primed, returning the next key to press. */
/** the global cooldown blocks a class-skill press now (every press, chains included) - for bots and the HUD */
export const gcdBlocks = (sim, p, key) => p.gcd > 0 && !routeCast(p, key); // (ult-window route steps are off the GCD)
export function primedChains(p, tick, sim = null) {
  const out = [];
  const from = hiddenFrom(p);
  const sneaky = from === 'vanish' && !eclipseCapped(p);
  out.push(...statePrimed(p)); // class state (Momentum / Focus / Arcane Surge / Consecration)
  const rg = rageOn(p), chs = CLASSES[p.cls].chains;
  for (const c of chs) {
    if (c.state) continue;
    if (c.five && (p.uw || p.eclipse)) continue; // (5-step chains are off in the ult window / Eclipse)
    if (c.rage ? !rg : rg && chs.some((q) => q.rage && q.seq.join() === c.seq.join())) continue; // Warrior: show the Rage version when it is live
    if (c.stealth) {
      if (c.from === 'shadow') { if (sneaky) out.push({ id: c.id, next: c.seq[1], step: 1, free: false, stealth: true }); else if (from === 'shadow') out.push({ id: c.id, next: c.seq[2], step: 2, free: false, stealth: true }); }
      else if (sneaky) out.push({ id: c.id, next: c.seq[c.seq.length - 1], step: 1, free: false, stealth: true });
      continue;
    }
    if (c.vanish) { if (sim && marksOf(sim, p).length) out.push({ id: c.id, next: c.seq[c.seq.length - 1], step: c.seq.length - 1, free: false, stealth: true }); continue; } // Marks up: Heartseeker
    for (let n = c.seq.length - 1; n >= 1; n--) {
      let ok = true, t = tick; const H = chainHist(p, c.seq);
      for (let i = n - 1, h = H.length - 1; i >= 0; i--, h--) {
        const e = H[h];
        if (!e || e.a !== c.seq[i] || t - e.tick > c.window) { ok = false; break; }
        t = e.tick;
      }
      if (ok) { out.push({ id: c.id, next: c.seq[n], step: n, free: n === c.seq.length - 1 && !!(c.free || c.id === 'blink_nova'), rage: c.rage || undefined }); break; }
    }
  }
  return out;
}

// ------------------------------------------------------------------ commands (inventory etc.)
const BAG_IDX = ['idx', 'a', 'b', 'cat'];
export function handleCommand(sim, p, cmd) {
  const inv = p.inventory;
  for (const k of BAG_IDX) { // (inventory pass: bag indices stay inside this hero's 64..128 slots; 'take' idx is a ground-bag index, an 'eq' idx unused)
    if (cmd[k] == null || (k === 'idx' && (cmd.at === 'eq' || cmd.type === 'take'))) continue;
    if (!(Number.isInteger(cmd[k]) && cmd[k] >= 0 && cmd[k] < inv.length)) return;
  }
  switch (cmd.type) {
    case 'upgrade': { // the Forge (client pays gold / materials; the result - success or not - is decided there): set the new +level
      const it = cmd.at === 'eq' ? p.equipment[cmd.slot] : inv[cmd.idx];
      if (!it || !Number.isInteger(cmd.up) || cmd.up !== ((it.up | 0) + 1) || cmd.up > 10) return;
      it.up = cmd.up; p.dirty = true;
      sim.emit({ type: 'forge', ph: 'upgrade', pid: p.id, name: it.name, up: it.up, x: p.x, y: p.y });
      break;
    }
    case 'ascend': { // horde pass 2: the Forge raises an item one tier (client pays gold / materials), eating a catalyst item of that slot
      const it = cmd.at === 'eq' ? p.equipment[cmd.slot] : inv[cmd.idx], cat = inv[cmd.cat];
      const c = ascendCost(it);
      if (!c || !Number.isInteger(cmd.cat) || !isCatalyst(it, cat) || p.level < c.lv || cat.lock) return; // (a locked item is never eaten as a catalyst)
      const nx = ascendItem(it, BASE_NAMES, PREFIX);
      it.tier = nx.tier; it.stats = nx.stats; it.name = nx.name; it.asc = nx.asc; if (nx.mk) it.mk = nx.mk; inv[cmd.cat] = null; p.dirty = true;
      sim.emit({ type: 'forge', ph: 'ascend', pid: p.id, name: it.name, tier: it.tier, uid: it.uid, cat: cat.uid, x: p.x, y: p.y });
      break;
    }
    case 'attune': { // game loop A1: a Realm Gate attuned (the client paid; unlock flags are client-persisted like the rest)
      const f = GATE_ATTUNE[cmd.id]; if (!f) return;
      p.unlocks = p.unlocks || {}; const fresh = !p.unlocks[f]; p.unlocks[f] = 1;
      sim.emit({ type: 'unlock', pid: p.id, key: f, fresh: fresh ? 1 : 0, gate: cmd.id, x: Math.round(p.x), y: Math.round(p.y) });
      break;
    }
    case 'mastery': { // game loop B1: spend a Mastery pick on a perk / reset them (the respec gold is client-paid)
      if (cmd.op === 'pick') { if (!PERKS[cmd.id] || !pickPerk(p, cmd.id)) return; }
      else if (cmd.op === 'respec') { if (!respecCost(p)) return; p.mperks = {}; }
      else return;
      refreshStats(p); p.dirty = true;
      sim.emit({ type: 'mastery', pid: p.id, op: cmd.op, id: cmd.id || '', x: Math.round(p.x), y: Math.round(p.y) });
      break;
    }
    case 'reroll': { // game loop A3: the Forge rerolls one sub-stat (client pays + rolls; the sim checks the roll is legal)
      const it = cmd.at === 'eq' ? p.equipment[cmd.slot] : inv[cmd.idx];
      if (!it || p.level < REROLL.lv || !Number.isInteger(cmd.rr) || cmd.rr !== (it.rr | 0) || !rerollOk(it, cmd.k, cmd.nk, +cmd.v, p.cls)) return;
      applyReroll(it, cmd.k, cmd.nk, +cmd.v); p.dirty = true;
      sim.emit({ type: 'forge', ph: 'reroll', pid: p.id, name: it.name, k: cmd.k, nk: cmd.nk, uid: it.uid, x: p.x, y: p.y });
      break;
    }
    case 'craft': { // the Forge: a crafted item (validated by the server room in co-op) into the first free bag slot
      const it = cmd.item, free = inv.indexOf(null);
      if (!it || typeof it !== 'object' || !it.slot || !it.stats) return;
      if (free < 0) { sim.emit({ type: 'invFull', pid: p.id, why: 'craft', uid: it.uid }); return; } // (bugpass: the client refunds the recipe)
      inv[free] = stampGot(p, it); p.dirty = true;
      sim.emit({ type: 'forge', ph: 'craft', pid: p.id, name: it.name, rarity: it.rarity, uid: it.uid, x: p.x, y: p.y });
      return;
    }
    case 'bagTake': { // the village services take a bag item out: stash (deposit), salvage (Blacksmith), sell (Quartermaster)
      const it = inv[cmd.idx];
      if (!it || !['stash', 'salvage', 'sell'].includes(cmd.why)) return;
      if (it.lock && cmd.why !== 'stash') { sim.emit({ type: 'bag', ph: 'locked', pid: p.id, idx: cmd.idx, uid: it.uid, name: it.name, why: cmd.why }); return; } // (step 4: locked items can't be salvaged or sold)
      inv[cmd.idx] = null; p.dirty = true;
      sim.emit({ type: 'bag', ph: cmd.why, pid: p.id, idx: cmd.idx, uid: it.uid, name: it.name, rarity: it.rarity, x: p.x, y: p.y });
      return;
    }
    case 'unstash': { // a stash item back into the bag (validated by the server room in co-op, like craft)
      const it = cmd.item, free = inv.indexOf(null);
      if (!it || typeof it !== 'object' || !it.slot) return;
      if (free < 0) { sim.emit({ type: 'invFull', pid: p.id, why: 'unstash', uid: it.uid }); return; } // (bugpass: the client puts it back in the stash)
      inv[free] = stampGot(p, it); p.dirty = true;
      sim.emit({ type: 'bag', ph: 'unstash', pid: p.id, idx: free, uid: it.uid, name: it.name, rarity: it.rarity, x: p.x, y: p.y });
      return;
    }
    case 'dummyCfg': { if (isHost(sim, p) || !sim.hub) setDummyCfg(sim, cmd.cfg || {}); return; } // Training Dummy menu (sim/dummy.js)
    case 'potion': { // a Health Potion (the count lives in the client's pouch; the sim owns the heal + cooldown)
      if (p.dead || (p.potCd | 0) > 0) return;
      const amt = Math.round(p.stats.maxHp * (cmd.big ? POTION.bigHeal : POTION.heal)); // (big: a Greater Health Potion, story shop tier 4)
      p.hp = Math.min(p.stats.maxHp, p.hp + amt); p.potCd = POTION.cd;
      sim.emit({ type: 'potion', pid: p.id, amount: amt, big: cmd.big ? 1 : 0, x: p.x, y: p.y });
      return;
    }
    case 'duel': startDuel(sim, p); return; // (Part B: the Ascension Altar's Shadow Duel; the client checked the cost)
    case 'duelLeave': leaveDuel(sim, p); return;
    case 'duelClash': duelClash(sim, p, cmd.ok === true, cmd.fin === true); return; // (B4: a beat-timed clash QTE)
    case 'astral': p.astralOn = cmd.on === true; p.astralOk = cmd.ok === true; return; // (Part C: Realm Gate map Normal / Astral toggle; ok = the account has an Ascended hero)
    case 'eclSkip': { const T = sim.trial; if (T && T.st === 'eclipse' && T.eShort && T.party.includes(p.id)) T.at = Math.max(T.at, T.transD - 1); return; } // (Savage v2: skip the short transformation on a checkpoint retry)
    case 'duelGo': duelSkip(sim, p); return; // (B3: a skipped cinematic fast-forwards the intro / outro)
    case 'rwDone': p.rwHold = 0; return; // the hunt's reward screen was dismissed
    case 'ready': { // the Co-op Board ready-up
      p.ready = cmd.on ? 1 : 0;
      sim.emit({ type: 'ready', pid: p.id, on: p.ready, name: p.name });
      return;
    }
    case 'respawn': { // death screen choice: 'here' = the checkpoint (campfire / zone entrance), 'town' = home to the village
      if (!p.dead || !p.canChoose || sim.tick < (p.respawnMin || 0)) return;
      if (cmd.where === 'town' && sim.hub && sim.hub.home) sim.hub.home(sim, p); else respawnPlayer(sim, p);
      return;
    }
    case 'equip': {
      const it = inv[cmd.idx];
      if (!isGearItem(it) || (it.cls && it.cls !== p.cls)) return; // (a Trial Sigil is not gear)
      const to = EQUIP_SLOTS.includes(cmd.to) && fitsSlot(it.slot, cmd.to) ? cmd.to : equipTarget(p, it); // (a ring: the free ring slot, else the weaker one, or the one you dropped it on)
      if (!to) return;
      inv[cmd.idx] = p.equipment[to] || null;
      p.equipment[to] = it;
      break;
    }
    case 'unequip': {
      if (!EQUIP_SLOTS.includes(cmd.slot)) return;
      const it = p.equipment[cmd.slot];
      const free = inv.indexOf(null);
      if (!it || free < 0) return;
      inv[free] = it;
      p.equipment[cmd.slot] = null;
      break;
    }
    case 'drop': {
      const it = inv[cmd.idx];
      if (!it) return;
      if (it.lock) { sim.emit({ type: 'bag', ph: 'locked', pid: p.id, idx: cmd.idx, uid: it.uid, name: it.name, why: 'drop' }); return; }
      inv[cmd.idx] = null;
      sim.bags.push({ id: sim.id(), x: p.x, y: p.y + 10, items: [it], ownerId: p.id, life: secs(60), rarity: it.rarity, own: 1 }); // (own: your own drop - practice never sweeps it)
      break;
    }
    case 'take': case 'takeAll': {
      const bag = sim.bags.find((b) => b.id === cmd.bagId);
      if (!bag || bag.ownerId !== p.id || Math.hypot(bag.x - p.x, bag.y - p.y) > (bag.vac ? 120 : 70)) return; // (a shower bag popped further out of the kill)
      const idxs = cmd.type === 'take' ? [cmd.idx] : bag.items.map((_, i) => i);
      const taken = [];
      for (const i of idxs) {
        const free = inv.indexOf(null);
        if (free < 0 || !bag.items[i]) continue;
        inv[free] = stampGot(p, bag.items[i]);
        taken.push(bag.items[i]);
        bag.items[i] = null;
      }
      bag.items = bag.items.filter(Boolean);
      if (!bag.items.length) bag.dead = true;
      if (taken.length) sim.emit({ type: 'pickup', pid: p.id, items: taken.map((t) => ({ name: t.name, rarity: t.rarity, uid: t.uid })) });
      else sim.emit({ type: 'invFull', pid: p.id });
      break;
    }
    case 'swap': {
      const a = inv[cmd.a]; inv[cmd.a] = inv[cmd.b]; inv[cmd.b] = a;
      break;
    }
    case 'bagSize': { // inventory pass: the bag grows when the account levels up (or another source adds slots); never shrinks over items
      const n = clampBag(cmd.n); if (n <= inv.length) return;
      resizeBag(inv, n); p.dirty = true; sim.emit({ type: 'bag', pid: p.id, ph: 'size', n: inv.length });
      return;
    }
    case 'lock': { // step 4: lock / unlock an item (locked: never salvaged, sold, dropped or auto-salvaged)
      const it = cmd.at === 'eq' ? (EQUIP_SLOTS.includes(cmd.slot) ? p.equipment[cmd.slot] : null) : inv[cmd.idx];
      if (!it || it.slot === 'sigil') return;
      if (cmd.on ?? !it.lock) it.lock = 1; else delete it.lock;
      p.dirty = true; sim.emit({ type: 'lock', pid: p.id, uid: it.uid, on: it.lock ? 1 : 0, name: it.name });
      return;
    }
    case 'loSave': case 'loName': case 'loUse': case 'loCancel': case 'chainSet': if (!loadoutCommand(sim, p, cmd)) return; break; // step 4: presets (sim/loadout.js)
    case 'enterRaid': p.wantRaid = 'enter'; return; // handled by sim/raid.js on this tick
    case 'leaveRaid': p.wantRaid = 'leave'; return;
    case 'enterAstrael': p.wantAst = 'enter'; p.wantAstX = cmd.x ? 1 : 0; return; // handled by sim/astrael.js on this tick
    case 'mission': if (typeof cmd.id === 'string') p.hubReq = cmd.map ? { type: 'mission', id: cmd.id, map: 1 } : { type: 'mission', id: cmd.id }; return; // (map: picked on the Realm Gate map, anywhere in town) // hub mode (sim/hub.js)
    case 'town': p.hubReq = { type: 'town' }; return;
    case 'practice': if (typeof cmd.enc === 'string') p.hubReq = { type: 'practice', enc: cmd.enc, ph: cmd.ph | 0, v: cmd.v | 0, reach: cmd.reach | 0 }; return; // Part E: practise a reached boss phase (sim/practice.js)
    case 'practiceGo': p.hubReq = { type: 'practiceGo', ph: cmd.ph | 0 }; return; // Part E: restart the running practice from a phase
    case 'townGo': p.hubReq = { type: 'townGo', cancel: cmd.cancel ? 1 : 0 }; return; // World Map › Travel to Town (sim/hub.js: a 2 s channel)
    case 'op': if (Number.isInteger(cmd.g)) p.hubReq = { type: 'op', g: cmd.g }; else if (OP_ACTS.has(cmd.act)) p.hubReq = { type: 'opAct', act: cmd.act, s: Number.isInteger(cmd.s) && cmd.s >= 0 && cmd.s < 6 ? cmd.s : -1, sk: OP_BUILDS.has(cmd.sk) ? cmd.sk : '' }; return; // mission entrances / Defense choices + build / pulse / ready (sim/hub.js, sim/ops.js)
    case 'leaveAstrael': p.wantAst = 'leave'; return;
    case 'hero': if (cmd.char && typeof cmd.char === 'object' && !sim.predicting) sim.swapHero(p, cmd.char); return; // Heroes tab: instant swap (sim.swapHero)
  }
  refreshStats(p);
  p.dirty = true;
}

// ------------------------------------------------------------------ per-tick update
export function updatePlayer(sim, p) {
  if (p.dead) { if (sim.tick >= p.respawnAt) respawnPlayer(sim, p); return; }
  const st = p.stats, cls = CLASSES[p.cls];
  if (p.potCd > 0) p.potCd--;
  if (p.br) brTick(sim, p);
  if (!(p.action && p.action.bf) && !p.shAct) p.shd = null; // (boss-form shadow shown only while its skill runs)
  if (p.rwHold > 0) { p.rwHold--; if (p.iframes < 2) p.iframes = 2; } // reading the hunt's reward screen: untouchable (fix pass)
  const inSafe = zoneAt(p.x, p.y).id === 0;
  p.hp = Math.min(st.maxHp, p.hp + st.hpRegen * (inSafe ? 8 : 1) * DT);
  p.res = Math.min(st.maxRes, p.res + st.resRegen * DT);
  if (p.edge > 0 && !sim.predicting && cls.edge) { const E = cls.edge, idle = sim.tick - p.edgeT; if (idle > E.decayAfter && (idle - E.decayAfter) % E.decayEvery === 0) p.edge--; } // Blade Dancer Edge decays when idle
  const cdk = p.uw ? ULTWIN.cdMul : 1; // ult window: cooldowns tick 3x
  const hst = p.songs ? hasteCd(p) : 1; // Bard Haste: cooldowns tick faster
  for (const k of SKILL_KEYS) if (p.cds[k] > 0) p.cds[k] = Math.max(0, p.cds[k] - (k === 'SP' ? 1 : cdk * hst)); // (the Special's cooldown never speeds up)
  { const ak = p.action && p.action.kind, mv = p.input && Math.hypot(p.input.mx || 0, p.input.my || 0) > 0.1; if (ak === 'dodge' || (mv && (!p.action || ak === 'basic'))) chainGrace(sim, p); } // chains keep state through movement (the timers pause)
  tickState(p);
  defTick(sim, p); // Monk Iron Body drain (sim/defense.js)
  if (cls.arms) tickWarrior(sim, p); else if (cls.blade) tickSamurai(sim, p); else if (cls.fist) tickMonk(sim, p); else if (cls.lance) tickDragoon(sim, p); else if (cls.grim || cls.bard) tickArc(sim, p); else if (p.buf) tickBuffs(p); // Warrior: Trinity timers, Glory drain, Bleed; shout buffs (Rally reaches allies)
  if (p.angel > 0 && --p.angel === 0 && !sim.predicting) sim.emit({ type: 'angel', ph: 'end', pid: p.id, x: p.x, y: p.y }); // Cleric Guardian Angel leaves
  if (p.songs) tickSongs(sim, p); // Bard songs on anyone (co-op allies too)
  if (p.sched && p.sched.length) runSched(sim, p);
  if (p.spx || p.spq || p.spMarks) tickSpecials(sim, p); // Specials: Decree / clone timers, clone echoes, the Divine Hammer impact, Storm marks
  if (p.dodgeCd > 0) p.dodgeCd--;
  if ((p.dodgeN ?? DODGE.charges) < DODGE.charges) { if (++p.dodgeRe >= DODGE.recharge) { p.dodgeN = (p.dodgeN | 0) + 1; p.dodgeRe = 0; } } else { p.dodgeN = DODGE.charges; p.dodgeRe = 0; } // dodge charges refill one at a time
  if (p.iframes > 0) p.iframes--;
  if (p.flash > 0) p.flash--;
  if (p.guard > 0) p.guard--;
  if (p.shieldT > 0 && --p.shieldT === 0) p.shield = 0;
  if (p.perfectCrit > 0) p.perfectCrit--;
  if (p.stealth > 0 && --p.stealth === 0) { p.stealthSrc = null; sim.emit({ type: 'unstealth', pid: p.id, x: p.x, y: p.y }); }
  if (p.gcd > 0) p.gcd--;
  if (p.clones && p.clones.length) runClones(sim, p);
  updateUltState(sim, p);
  if (p.comboTimer > 0 && --p.comboTimer === 0) p.comboHits = 0;
  if (p.comboHits > p.bestCombo) p.bestCombo = p.comboHits;
  const inp = p.input;
  p.sprint = 0; // (set again by the movement step below; a stun / hitstop / dash tick never sprints)
  { const adx = inp.ax - p.x, ady = inp.ay - p.y; if (adx * adx + ady * ady > 9) p.aim = Math.atan2(ady, adx); } // (aim point on the hero, e.g. right after a blink / dash onto the cursor: keep the facing instead of atan2(0, 0) = 0 = RIGHT)

  // input buffering (so presses during recovery/hitstop are not lost)
  if (p.pendingSkill && (isSwapKey(p.pendingSkill) || !cls.skills[p.pendingSkill])) p.pendingSkill = null; // (old stance keys / a slot the class doesn't have)
  if (p.pendingSkill) { p.bufSkill = p.pendingSkill; p.bufCharge = 0; p.bufTtl = 24; p.pendingSkill = null; p.pendingCharge = 0; } // long enough to outlast any basic swing's recovery
  if (p.pendingDodge) { p.bufDodge = 14; p.pendingDodge = false; p.dodgeAt = sim.tick; }
  if (p.pendingUlt) { p.bufUlt = 24; p.pendingUlt = false; }
  if (p.hitstop > 0) { p.hitstop--; return; }
  if (p.bufTtl > 0) { if (--p.bufTtl === 0) p.bufSkill = null; }
  if (p.bufDodge > 0) p.bufDodge--;
  if (p.bufUlt > 0) p.bufUlt--;

  // knockback velocity
  if (p.vx || p.vy) {
    p.x += p.vx * DT; p.y += p.vy * DT;
    p.vx *= 0.84; p.vy *= 0.84;
    if (Math.abs(p.vx) < 2 && Math.abs(p.vy) < 2) p.vx = p.vy = 0;
  }
  // Dodge pass 2 (step 2): a timed Dodge (>= HOLD_BREAK.after ticks into the hold, a charge + its energy) breaks a snare /
  // freeze / root / the glass bubble early; then the dodge runs as usual. A plain stun (slams, knockdowns) is not a hold.
  if (p.held && !(p.stun > 0) && !p.encased) p.held = 0;
  if (p.held && p.bufDodge > 0 && canDodge(p) && (p.dodgeAt ?? -1e9) - (p.holdAt || 0) >= HOLD_BREAK.after && p.res >= dodgeOf(p.cls).cost) {
    p.stun = 0; p.held = 0; if (p.encased) p.breakOut = 1; p.action = null;
    sim.emit({ type: 'holdBreak', pid: p.id, x: p.x, y: p.y });
  }
  if (p.stun > 0) { p.stun--; resolveCircle(sim.world, p); p.superArmor = false; return; }

  const ex0 = p.x, ey0 = p.y; // (evasive dashes: the movement of starting + running the action this tick, incl. a blink on cast)
  const a = p.action;
  const canCancel = !a || (a.cancel != null && a.t >= a.cancel);
  if (p.carry) { p.bufDodge = 0; p.bufSkill = null; p.bufUlt = 0; } // (Part 1 set piece: carrying the sun / an object - no dodge, attacks or casts; sim/setpiece.js carry)
  else if (p.bufDodge > 0 && (canCancel || (a && (a.bf || lockBreakable(sim, p, a))) || (a && a.kind === 'basic' && (a.t >= a.spec.hit || (a.dashN && a.dt < a.dashN)))) && canDodge(p)) { // a gap-closer dash can be dodged out of
    p.bufDodge = 0;
    if (a && (a.bf || lockBreakable(sim, p, a)) && !canCancel && p.res >= dodgeOf(p.cls).cost) { toShadow(p, a); p.shAct = a; } // (boss form: the shadow finishes the action, the hero dodges)
    if (p.res >= dodgeOf(p.cls).cost) startDodge(sim, p);
    else sim.emit({ type: 'nores', pid: p.id });
  } else if (p.bufUlt > 0 && canCancel) {
    p.bufUlt = 0;
    if (p.ult >= ULT.max) startUlt(sim, p);
    else sim.emit({ type: 'nores', pid: p.id, key: 'T' });
  } else if (p.bufSkill && canCancel) {
    const key = p.bufSkill;
    const sk = cls.skills[key];
    if (sk && p.cds[key] <= 0) {
      const rc = routeCast(p, key); // Eclipse finisher route: this step's chain is forced (no Vanish-chain cap, no condition)
      const spc = rc ? null : specChain(p, key, sim.tick); // Special chains (the Special earlier in the history) beat class states
      const sc = rc || spc ? null : stateChain(p, key); // class state: this key's transformed chain
      let chain = rc ? rc.chain : spc ? spc : sc ? sc.chain : stealthChain(p, key) || findChain(p, key, sim.tick) || markChain(sim, p, key); // Vanish chains first, then key-history chains (Shadow Strike right after Flicker), then Shadow Execution
      if (chain && chain.cond && !rc && !sc && !spc && !CHAIN_COND[chain.cond](sim, p)) chain = null; // conditional chains (e.g. Deadeye needs your Quarry on something)
      const follow = !!rc; // (chains abide by the GCD; Oct 19 11:40 PM hotfix: ultimate-window finisher-route steps are OFF it - they fire at once and neither trigger nor wait for it)
      if (!follow && p.gcd > 0) { if (p.gcd <= GCD_QUEUE) p.bufTtl = Math.max(p.bufTtl | 0, p.gcd + 2); else if (p.gcd > (p.bufTtl | 0)) p.bufSkill = null; // (a press in the last 0.5 s of the GCD queues: it fires the tick the GCD ends)
        /* the global cooldown blocks every class-skill press, chains included (the buffer waits out its ttl) */ }
      else {
      const free = chain && (chain.free || chain.id === 'blink_nova');
      const cost = free || p.aura > 0 || p.eclipse || p.uw ? 0 : sk.cost; // Divine Ascension / Eclipse / ult window: skills cost nothing
      p.bufSkill = null;
      if (p.res < cost) sim.emit({ type: 'nores', pid: p.id, key });
      else startSkill(sim, p, key, (!chain && altSkill(p, key, sk)) || sk, chain, cost, !!rc, sc, null, follow); // (Part D A3: the Astral skill variant replaces the plain cast)
      }
    }
  } else if (inp.attack && !p.carry && (!a || (a.kind === 'basic' && a.t >= a.cancel) || (a.kind !== 'basic' && canCancel && a.t >= a.dur - 2))) {
    startBasic(sim, p);
  }

  p.superArmor = false;
  if (p.action && Math.hypot(inp.mx || 0, inp.my || 0) > 0.1 && lockBreakable(sim, p, p.action)) toShadow(p, p.action); // the animation lock rule (sim/skillform.js)
  const a0 = p.action;
  if (p.action) runAction(sim, p);
  runDetached(sim, p);
  evadeStep(sim, p, a0, ex0, ey0); // evasive dashes: i-frames while the ability carries you (sim/evade.js)

  // movement
  const act = p.action;
  let [mx, my] = [inp.mx, inp.my];
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  p.moving = ml > 0.1;
  if (!(act && act.lockMove) || (act && act.bf)) {
    const mul = act && !act.bf ? (act.moveMul ?? 0.35) : 1; // (boss form: the shadow performs it, the hero walks freely)
    p.sprint = !act && p.moving && inp.sprint && outOfCombat(sim, p) ? 1 : 0; // sprint: out of combat only, ends the moment you fight
    const sp = PLAYER_SPEED * st.spd * mul * (p.buf ? wmSpeedMul(p) : 1) * (p.songs ? hasteMove(p) : 1) * (p.sprint ? SPRINT.mul : 1) * (p.carry ? CARRY_MUL : 1); // (Rally: +move speed; carrying: SETPIECE.carry.slow)
    p.x += mx * sp * DT; p.y += my * sp * DT;
  }
  resolveCircle(sim.world, p);
  if (sim.tick % 4 === p.id % 4) unstick(sim.world, p); // safety net: never left inside a wall / prop
}

/** carrying a set-piece object (sim/setpiece.js carry): the walk speed multiplier */
export const CARRY_MUL = 0.6;
/** a dodge is ready: past the short gap after the last dash, with a charge left */
export const canDodge = (p) => !p.carry && p.dodgeCd <= 0 && (p.dodgeN ?? DODGE.charges) > 0;
/** out of combat (sprint): no damage dealt or taken for SPRINT.calm ticks, no live boss close by, no encounter fight on */
export function outOfCombat(sim, p) {
  if (sim.tick - (p.lastCombat ?? -1e9) < SPRINT.calm || sim.tick - (p.lastHurt ?? -1e9) < SPRINT.calm) return false;
  if (sim.practice || (sim.ult && sim.ult.st === 'fight') || (sim.trial && sim.trial.st === 'fight') || sim.duel) return false;
  for (const e of sim.enemies) if ((e.boss || e.raid) && !e.dead && !e.dummy && Math.abs(e.x - p.x) < SPRINT.bossR && Math.abs(e.y - p.y) < SPRINT.bossR && Math.hypot(e.x - p.x, e.y - p.y) < SPRINT.bossR) return false;
  return true;
}
function startDodge(sim, p) {
  const inp = p.input;
  const ml = Math.hypot(inp.mx, inp.my);
  const ang = ml > 0.1 ? Math.atan2(inp.my, inp.mx) : p.aim;
  if (p.action && p.action.kind === 'basic') p.lastBasic = { idx: p.action.idx, endTick: sim.tick };
  const D = dodgeOf(p.cls);
  p.res -= D.cost;
  if (D.iframes > 0) p.iframes = Math.max(p.iframes || 0, D.iframes); // (0 by default: the dodge only grants i-frames on a proper evade, sim/combat.js)
  p.dodgeN = Math.max(0, (p.dodgeN ?? DODGE.charges) - 1);
  p.dodgeCd = D.dur + D.cd; p.sprint = 0;
  p.action = { kind: 'dodge', id: 'dodge', t: 0, dur: D.dur, cancel: D.dur - 5, ang, lockMove: true };
  sim.emit({ type: 'dodge', pid: p.id, x: p.x, y: p.y, ang });
}

function startBasic(sim, p) {
  const cls = CLASSES[p.cls];
  const prev = p.action;
  const combo = basicsOf(p), n = combo.length; // 3 for most classes, 5 for the Blade Dancer; Warrior: the stance's combo
  let idx = 0;
  if (prev && prev.kind === 'basic') idx = (prev.idx + 1) % n;
  else if (p.lastBasic.idx >= 0 && p.lastBasic.idx < n - 1 && sim.tick - p.lastBasic.endTick <= 22) idx = p.lastBasic.idx + 1;
  if (prev && prev.kind === 'basic' && cls.arms && prev.wmw !== p.wm.st) idx = 0; // (drawing another weapon restarts the combo)
  const b = combo[idx];
  p.action = { kind: 'basic', key: 'B' + (idx + 1), idx, t: 0, dur: b.dur, cancel: b.cancel, ang: p.aim, spec: b, moveMul: b.melee ? 0.25 : 0.55 };
  if (cls.arms) p.action.wmw = p.wm.st;
  if (b.melee && idx === 0) planGapClose(sim, p, p.action, b); // melee combo opener dashes to the target first
  if (p.stealth > 0) { // first attack out of stealth = Backstab ('BS' in the chain history: Vanish -> Backstab = Ambush)
    p.stealth = 0; p.stealthSrc = null;
    const chain = findChain(p, 'BS', sim.tick);
    p.action.backstab = true; p.action.key = 'BS'; p.action.chain = chain;
    pushHistory(sim, p, 'BS');
    if (chain) { p.chainPending = { id: chain.id, tick: sim.tick }; sim.emit({ type: 'chain', pid: p.id, id: chain.id, name: chain.name, x: p.x, y: p.y, ...(chain.route ? { fin: 1 } : {}) }); brChain(sim, p, chain); }
    sim.emit({ type: 'unstealth', pid: p.id, x: p.x, y: p.y, attack: true });
  } else pushHistory(sim, p, 'B' + (idx + 1));
  sim.emit({ type: 'attack', pid: p.id, cls: p.cls, idx, ang: p.aim, x: p.x, y: p.y, w: p.action.wmw });
}

function startSkill(sim, p, key, sk, chain, cost, onRoute = false, sc = null, wopt = null, follow = false) {
  if (p.action && p.action.kind === 'basic') p.lastBasic = { idx: p.action.idx, endTick: sim.tick };
  const resBefore = p.res;
  p.res -= cost;
  const cls = CLASSES[p.cls];
  p.cds[key] = secs(sk.cd); // Warrior string skills: the cooldown starts when the string ends (warrior.js)
  if (!follow) { p.gcd = Math.max(GCD, cls.gcd || 0); p.gcdMax = p.gcd; } // the 1.0 s global cooldown: every class-skill press (incl. the Special and every chain step)
  if (chain) p.chainPending = { id: chain.id, tick: sim.tick, anyHit: chain.id === 'shadow_step' || undefined, cost, key }; // credited to the ult meter when the finisher lands (Shadow Step: its follow-up hit, even a basic Backstab)
  const inp = p.input;
  p.action = { kind: 'skill', id: sk.id, key, t: 0, dur: 20, cancel: 20, ang: p.aim, moveMul: 0.2, chain, data: { tx: inp.ax, ty: inp.ay, hit: new Set(), resBefore, cost } };
  if (cls.critPips && !(chain && !chain.stealth && !chain.vanish && !chain.route)) p.critRun = 0; // Blade Dancer: a fresh opener starts a new crit count (Eviscerate reads it)
  if (p.stealth > 0 && sk.id !== 'vanish') {
    if (chain && chain.stealth) { // Vanish chain: uses up the stealth instead of Backstabbing (Shadow Step keeps it: its next hit Backstabs)
      if (p.eclipse && chain.from !== 'shadow' && !onRoute) p.eclipse.vc = (p.eclipse.vc || 0) + 1; // Vanish -> Shadow Step -> Death Blossom counts once; route steps are free
      if (chain.id !== 'shadow_step') { p.stealth = 0; p.stealthSrc = null; sim.emit({ type: 'unstealth', pid: p.id, x: p.x, y: p.y, chain: chain.id }); }
    } else { p.stealth = 0; p.stealthSrc = null; p.action.backstab = true; sim.emit({ type: 'unstealth', pid: p.id, x: p.x, y: p.y, attack: true }); } // a skill out of stealth backstabs too
  }
  if (routeHost(p) && key !== SPK) advanceRoutes(sim, p, key); // (the Special neither advances nor breaks a finisher route) // finisher routes (Eclipse / ult window): this cast advances or breaks each
  const fx = chain && (CHAIN_FX[chain.id] || WAR_SKILLS[chain.id] || SAM_SKILLS[chain.id] || MONK_SKILLS[chain.id] || DRG_SKILLS[chain.id] || ARC_SKILLS[chain.id] || SPEC_SKILLS[chain.id]);
  if (cls.arms) wmCast(sim, p, p.action, key, chain); // Warrior: draw the weapon, Glory chains spend Glory
  if (cls.blade) samCast(sim, p, p.action, key, chain); // Samurai: Focus spenders / finisher scaling
  if (cls.grim || cls.bard) arcCast(sim, p, p.action, key, chain); // Summoner / Bard: Ink / Tempo, empowerment, songs
  if (cls.lance) drgCast(sim, p, p.action, key, chain); // Dragoon: Skyborne empowerment, Blood spenders
  if (cls.fist) monkCast(sim, p, p.action, key, chain); // Monk: hit-counter tier, Flow empowerment, Chi spenders
  p.action.bf = wantsShadow(sim, p, sk, chain) || undefined; // boss form: a moving damage skill runs on the shadow (sim/skillform.js)
  shadowRun(sim, p, p.action, () => { if (fx) fx.start(sim, p, p.action); else (SKILLS[sk.id] || WAR_SKILLS[sk.id] || SAM_SKILLS[sk.id] || MONK_SKILLS[sk.id] || DRG_SKILLS[sk.id] || ARC_SKILLS[sk.id] || SPEC_SKILLS[sk.id]).start(sim, p, p.action); });
  specOnCast(sim, p, p.action, key, chain); // Warlord's Decree free swings / Shadow Clone copies
  afterCastState(sim, p, sk.id, sc);
  if (p.eclipse && !p.action.data.fin) eclipseShade(sim, p, p.action); // Eclipse: every cast slips you into a moment of stealth -> the next hit is a Backstab
  pushHistory(sim, p, key);
  primeFive(sim, p); // a 5-step chain live through its Special: its next key is ready
  sim.emit({ type: 'skill', pid: p.id, cls: p.cls, skill: sk.id, key, x: p.x, y: p.y, ang: p.aim, chain: chain ? chain.id : null });
  if (chain) hordeChainBurst(sim, p, chain); // horde AoE: a chain bursts the class shape into the crowd (sim/hordeaoe.js)
  if (chain) defChain(sim, p, chain); // Warrior chain shield / Monk Iron Body purge (sim/defense.js)
  if (chain) sim.emit({ type: 'chain', pid: p.id, id: chain.id, name: chain.name, x: p.x, y: p.y, ...(chain.route ? { fin: 1 } : {}) });
  if (key === SPK) brSpecial(sim, p); // near a boss: the Special starts the bank's waves and sets the cycle cooldown
  if (chain) brChain(sim, p, chain);
}

// ------------------------------------------------------------------ Warrior: Rage spend + Momentum
/** Rush skills (Momentum): landing one cuts the other two's cooldowns; the next one cast in Momentum hits +20%. */
export const RUSH = { keys: ['Q', 'E', 'R'], cut: 60, bonus: 1.2 };

/** A rush skill connected (Crash Charge crash, Leap Slam landing on something, Shoulder Bash contact): Momentum. */
export function rushImpact(sim, p, key) {
  if (!CLASSES[p.cls].rageRes) return;
  if (!p.momCut) p.momCut = {};
  for (const k of RUSH.keys) if (k !== key && !p.momCut[k] && p.cds[k] > 0) { p.cds[k] = Math.max(0, p.cds[k] - RUSH.cut); p.momCut[k] = 1; }
  setState(sim, p, 'base');
}

function runAction(sim, p) {
  const a = p.action;
  if (a.kind === 'basic' && a.dashN && a.dt < a.dashN) { // gap-closer: dash in front of the target, then the swing starts
    a.dt++;
    const k = a.dt / a.dashN, e = k * (2 - k); // ease-out
    p.x = a.dfx + (a.dlx - a.dfx) * e; p.y = a.dfy + (a.dly - a.dfy) * e;
    if (a.dt >= a.dashN) a.lockMove = false;
    return; // a.t does not advance while dashing
  }
  if (a.kind === 'basic') shadowRun(sim, p, a, () => runBasic(sim, p, a));
  else if (a.kind === 'dodge') {
    const k = 1 - a.t / a.dur;
    const sp = dodgeOf(p.cls).speed * (0.25 + 0.75 * k * k), step = sp * DT, n = Math.max(1, Math.ceil(step / 10)); // (sub-steps: a 25 px/tick dash never tunnels through a wall)
    for (let i = 0; i < n; i++) { p.x += Math.cos(a.ang) * step / n; p.y += Math.sin(a.ang) * step / n; if (n > 1) resolveCircle(sim.world, p); }
  } else {
    const h = skillHandler(a);
    if (h && h.tick) shadowRun(sim, p, a, () => h.tick(sim, p, a));
  }
  a.t++;
  if (p.action === a && a.t >= a.dur) {
    if (a.kind === 'basic') p.lastBasic = { idx: a.idx, endTick: sim.tick };
    p.action = null;
  }
}

const skillHandler = (a) => (a.chain && (CHAIN_FX[a.chain.id] || WAR_SKILLS[a.chain.id] || SAM_SKILLS[a.chain.id] || MONK_SKILLS[a.chain.id] || DRG_SKILLS[a.chain.id] || ARC_SKILLS[a.chain.id] || SPEC_SKILLS[a.chain.id])) || SKILLS[a.id] || WAR_SKILLS[a.id] || SAM_SKILLS[a.id] || MONK_SKILLS[a.id] || DRG_SKILLS[a.id] || ARC_SKILLS[a.id] || SPEC_SKILLS[a.id];
/** boss form: an action handed to the shadow while the hero dodged keeps running (its own clock) until it ends */
function runDetached(sim, p) {
  const d = p.shAct; if (!d) return;
  const save = p.action; p.action = d;
  try {
    if (d.kind === 'basic') shadowRun(sim, p, d, () => runBasic(sim, p, d));
    else { const h = skillHandler(d); if (h && h.tick) shadowRun(sim, p, d, () => h.tick(sim, p, d)); }
    d.t++;
  } finally { p.action = save; }
  if (d.t >= d.dur || p.dead) p.shAct = null;
}

function runBasic(sim, p, a) {
  const b = a.spec;
  if (b.melee) {
    // (Oct 19: no forward step on any basic attack - the swing roots its momentum; `lunge` on the data is unused)
    if (a.t === b.hit) {
      sim.emit({ type: 'swing', pid: p.id, x: p.x, y: p.y, ang: a.ang, arc: b.arc, range: b.range, idx: a.idx, heavy: !!b.heavy, cls: p.cls, w: a.wmw });
      const wo = a.wmw ? { poise: b.poise, wmw: a.wmw, style: 'wm' + a.wmw, stack: a.wmw === 'A' ? ['bleed', 1] : undefined } : b.cut ? { style: 'sam', stack: ['cut', b.cut] } : null; // Warrior: stance style, hammer posture, axe Bleed
      const n = hitEnemiesInShape(sim, p, { shape: 'cone', x: p.x, y: p.y, ang: a.ang, arc: b.arc, r: b.range }, { mul: b.mul, kb: b.kb, stagger: b.stagger, hitstop: b.hitstop, heavy: b.heavy || a.backstab, kbAng: undefined, selfHitstop: b.hitstop, basic: !a.backstab, ...wo });
      const cls = CLASSES[p.cls];
      if (n > 0 && cls.resOnFinisher && a.idx === cls.basic.length - 1) p.res = Math.min(p.stats.maxRes, p.res + cls.resOnFinisher); // combo finisher: +1 Initiative pip
    }
  } else if (a.t === b.hit) {
    const n = b.count || 1;
    for (let i = 0; i < n; i++) {
      const ang = a.ang + (n > 1 ? (i - (n - 1) / 2) * b.spread : 0);
      const pr = b.proj;
      spawnProjectile(sim, {
        team: 'player', ownerId: p.id, x: p.x + Math.cos(ang) * 20, y: p.y + Math.sin(ang) * 20,
        vx: Math.cos(ang) * pr.speed, vy: Math.sin(ang) * pr.speed, r: pr.r, life: Math.round((pr.range / pr.speed) * 60),
        mul: b.mul, kb: b.kb, stagger: b.stagger || 0, explode: CLASSES[p.cls].bard && p.uw ? Math.max(70, pr.explode || 0) : pr.explode || 0, style: pr.style, heavy: b.heavy, hitstop: b.hitstop, basic: true,
      });
    }
    sim.emit({ type: 'shoot', pid: p.id, x: p.x, y: p.y, ang: a.ang, cls: p.cls, heavy: !!b.heavy, basic: 1, idx: a.idx });
  }
}

const clampTarget = (p, a, maxR) => {
  const dx = a.data.tx - p.x, dy = a.data.ty - p.y;
  const d = Math.hypot(dx, dy);
  const k = d > maxR ? maxR / d : 1;
  return { x: p.x + dx * k, y: p.y + dy * k };
};

// ------------------------------------------------------------------ melee gap-closer (first hit of the basic combo)
// Pick the enemy nearest the cursor inside a +-40 deg cone within 260 px (fallback: nearest in range) and dash in
// front of it in 10 ticks (~0.17 s) before the swing. No dash when already in reach. No i-frames.
export const GAP = { range: 260, cone: 0.7, ticks: 10, pad: 12, reach: 0.6 };
/** Enemies usable for targeting: the sim's own, or (client prediction) the drawn server view via sim.targetables(). */
export const targetsOf = (sim) => (sim.targetables ? sim.targetables() : sim.enemies);
export function pickGapTarget(sim, p, tx, ty) {
  const aim = Math.atan2(ty - p.y, tx - p.x);
  let cone = null, cs = Infinity, near = null, nd = Infinity;
  for (const e of targetsOf(sim)) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > GAP.range + e.r) continue;
    let da = Math.abs(Math.atan2(e.y - p.y, e.x - p.x) - aim); if (da > Math.PI) da = Math.PI * 2 - da;
    if (da <= GAP.cone || d < e.r + p.r + 4) { const sc = Math.hypot(e.x - tx, e.y - ty); if (sc < cs) { cs = sc; cone = e; } }
    if (d < nd) { nd = d; near = e; }
  }
  return cone || near;
}
function planGapClose(sim, p, a, b) {
  const e = pickGapTarget(sim, p, p.input.ax, p.input.ay);
  if (!e) return;
  const d = Math.hypot(e.x - p.x, e.y - p.y), ang = Math.atan2(e.y - p.y, e.x - p.x);
  a.ang = ang; // swing at the target
  if (d - e.r <= (b.range || 80) * GAP.reach + p.r) return; // already in reach: no dash
  if (e.boss || e.raid) return; // (Oct 19: no gap-closer onto a boss - walk in yourself; mobs / elites keep it)
  const stop = e.r + p.r + GAP.pad;
  let lx = e.x - Math.cos(ang) * stop, ly = e.y - Math.sin(ang) * stop;
  ({ x: lx, y: ly } = clearPath(sim.world, p.x, p.y, lx, ly, p.r)); // (swept: never tunnels through walls / props) // walls: stop short
  a.dashN = GAP.ticks; a.dt = 0; a.dfx = p.x; a.dfy = p.y; a.dlx = lx; a.dly = ly; a.lockMove = true;
  sim.emit({ type: 'gapClose', pid: p.id, fx: p.x, fy: p.y, x: lx, y: ly, cls: p.cls });
}

// ------------------------------------------------------------------ tuning for the Cleric / Blade Dancer skills
export const SMITE_HEAL = 0.35;                         // share of Smite damage healed to each ally in range
// Judgment (the Paladin finisher). verdict = Final Verdict's damage x. Boss pass 2026-10-08 (Cassius, Hammer of Dawn: the
// hammer's judgment falls hardest on the mighty): vs bosses and elites Judgment is x2.8 -> x7.4 (was 2.4 -> 6.4) and Final Verdict
// +60% (was +25%; Condemn kit.js CLR.verdictPerBoss 0.4 per stack, was 0.3). Regular enemies keep the old numbers (mobbing
// unchanged); the heal is unchanged.
export const JUDGMENT = { base: 2.4, perCharge: 4.0, verdict: 1.25, vsBoss: { base: 2.8, perCharge: 4.6, verdict: 1.6 }, healBase: 0.12, healPerCharge: 0.28 };
/** Judgment's damage multiplier on enemy e at charge k (0..1), Final Verdict or not */
export function judgmentMul(e, k, fv) { const J = e && (e.boss || e.elite) ? JUDGMENT.vsBoss : JUDGMENT; return (J.base + J.perCharge * k) * (fv ? J.verdict : 1); }
export const SHIELD = { maxHp: 0.12, atk: 1.0 };        // Shield Rush absorb = 12% caster max HP + 1x attack
export const CUTS = { maxTargets: 5, hops: 5, every: 9, mul: 1.25, evPer: 0.15, evMax: 0.9 }; // evPer/evMax: Eviscerate's bonus per crit in the chain
export const shieldAmount = (p) => p.stats.maxHp * SHIELD.maxHp + p.stats.atk * SHIELD.atk;
// Warrior rework
/** Whirlwind: +4 ticks of spin per enemy hit (max +0.4 s); a light drag within pullR (Iron Cyclone: a strong one within icPullR). */
export const WHIRL = { extPerHit: 4, extMax: 24, pullR: 170, pullSpeed: 90, icPullR: 240, icPullSpeed: 260, bossPull: 0.1 };
/** Crash Charge: rushT ticks at `speed` px/s (the last 4 slower, ~330 px); contact within `reach` px past your edge crashes. */
export const WCH = { rushT: 16, speed: 1350, reach: 10, stop: 18 };
/** Leap Slam: `leap` ticks in the air (Crash Landing: clLeap, a clR slam at clMul with a clUp knock-up). */
export const WSL = { leap: 18, clLeap: 13, clR: 170, clMul: 3.0, clUp: 70 };
/** Shoulder Bash: a lungeT-tick lunge; splash `splashR` around the victim at splashMul. Shoulder Breaker: sbMul. */
export const WBA = { lungeT: 9, reach: 12, splashR: 70, splashMul: 0.8, sbMul: 3.0 };
// Blade Dancer rework
export const HEART = { range: 330, mul: 2.2 };
export const VANISH = { stealth: 120, dist: 190 };
/** Vanish chains (Blade Dancer). Death Blossom: +1 cut per cut that kills an enemy outright (first cut on it this cast, not a
 *  boss), max +6. Shadow Step: blink behind a target within `stepRange`, stealth kept (at least `stepStealth`), a decoy for `decoy`
 *  ticks at the start point that enemies within `decoyAggroR` target and enemy projectiles home onto / are absorbed by.
 *  Shadow Pierce: a `pierceLen` x `pierceW` line lunge, every hit a guaranteed crit with Heartseeker's low-HP bonus; a kill refunds
 *  `pierceRefund` pips (once per cast) and re-stealths for `pierceStealth` ticks (chainable into another Vanish chain). */
/** Vanish chains. Death Blossom (Vanish -> Shadow Step -> Thousand Cuts): every cut Backstabs, +1 cut per outright kill (max +6 = 11),
 *  all 11 kill -> pips refilled. Marked for Death (Vanish -> Thousand Cuts): Marks (max markMax stacks, markDur). Shadow Execution
 *  (-> Heartseeker): one clone stab per Mark (cloneMul x Heartseeker, full low-HP bonus, cloneEvery apart, within cloneR). */
export const SHADOW = { blossomMax: 6, markMax: 5, markDur: secs(5), cloneMul: 0.5, cloneEvery: 5, cloneR: 640, stepRange: 330, stepBehind: 14, stepStealth: 150, decoy: secs(1.5), decoyAggroR: 520, pierceLen: 340, pierceW: 34, pierceStealth: 100 }; // (Oct 19 10:24 PM: Shadow Step stealth 75 -> 150, Shadow Pierce kill stealth 36 -> 100 ticks so the next Vanish chain still fits after the 1.0 s GCD)

/** Skill target: the enemy nearest the aim point (within 150), else the one closest to the aim line, within `range`. */
export function pickTarget(sim, p, tx, ty, range = 480) {
  let best = null, bs = Infinity;
  const aim = Math.atan2(ty - p.y, tx - p.x);
  for (const e of targetsOf(sim)) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > range + e.r) continue;
    const dc = Math.hypot(e.x - tx, e.y - ty);
    let da = Math.abs(Math.atan2(e.y - p.y, e.x - p.x) - aim); if (da > Math.PI) da = Math.PI * 2 - da;
    const score = dc < 150 + e.r ? dc : da < 0.6 ? 200 + da * 300 + d * 0.2 : Infinity;
    if (score < bs) { bs = score; best = e; }
  }
  return best;
}

/** Enemies Thousand Cuts would hit (nearest first, within 340). */
export function cutsTargets(sim, p, markedFirst = false) {
  const mk = (e) => (markedFirst && e.mark && e.mark.pid === p.id && e.mark.t > 0 ? 0 : 1); // Crimson Flurry: your Marked enemies first
  return sim.enemies.filter((e) => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 340 + e.r)
    .sort((u, v) => mk(u) - mk(v) || Math.hypot(u.x - p.x, u.y - p.y) - Math.hypot(v.x - p.x, v.y - p.y)).slice(0, CUTS.maxTargets);
}

/** Conditional chains: checked when the chain's last key is pressed (otherwise it is a plain cast). */
export const CHAIN_COND = {
  marked: (sim, p) => marksOf(sim, p).length > 0, // Shadow Execution: your Marks are still on something
  quarry: (sim, p) => targetsOf(sim).some((e) => !e.dead && stackN(e, 'quarry', p.id) > 0), // Deadeye: your Quarry is on something
  burn: (sim, p) => targetsOf(sim).some((e) => !e.dead && stackN(e, 'burn', p.id) > 0),     // Supernova: your Burn is on something
  condemn: (sim, p) => targetsOf(sim).some((e) => !e.dead && stackN(e, 'condemn', p.id) > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 420 + e.r), // Absolution: your Condemn nearby
};

// ------------------------------------------------------------------ ultimates
export const BULWARK_DOT = 0.35;                         // Bulwark: x ATK per 0.5s pulse to enemies inside (8 pulses)
export const TITAN = { range: 340, r: 210, mul: 5.0, knockdown: 120, rage: secs(10) };
export const STORM = { range: 480, r: 190, pulses: 16, every: 15, mul: 0.55, slowMul: 0.45 };
export const ULT_METEOR = { range: 480, r: 220, delay: 48, mul: 7.0, knockdown: 130, burnR: 190, burnPulses: 8, burnEvery: 30, burnMul: 0.45 };
export const ASCENSION = { dur: secs(10), every: 30, r: 230, healPct: 0.04, healAtk: 0.4, mul: 0.8 };

function startUlt(sim, p) {
  const U = CLASSES[p.cls].ult;
  if (p.action && p.action.kind === 'basic') p.lastBasic = { idx: p.action.idx, endTick: sim.tick };
  p.ult = 0;
  p.ultUses++;
  p.surge = ULT_SURGE.dur; // the balance pass: ULT SURGE (data/tuning.js)
  const inp = p.input;
  p.action = { kind: 'skill', id: U.id, key: 'T', t: 0, dur: 20, cancel: 20, ang: p.aim, moveMul: 0.2, chain: null, data: { tx: inp.ax, ty: inp.ay, hit: new Set() } };
  (SKILLS[U.id] || WAR_SKILLS[U.id] || SAM_SKILLS[U.id] || MONK_SKILLS[U.id] || DRG_SKILLS[U.id] || ARC_SKILLS[U.id]).start(sim, p, p.action);
  if (CLASSES[p.cls].blade) samCast(sim, p, p.action, 'T', null);
  if (CLASSES[p.cls].fist) monkCast(sim, p, p.action, 'T', null);
  if (CLASSES[p.cls].lance) drgCast(sim, p, p.action, 'T', null);
  if (CLASSES[p.cls].grim || CLASSES[p.cls].bard) arcCast(sim, p, p.action, 'T', null);
  if (U.id !== 'eclipse' && CLASSES[p.cls].routes) p.uw = { t: ULTWIN.dur, rt: newRouteState() }; // the ult window: routes, free skills, fast cooldowns
  sim.emit({ type: 'ult', pid: p.id, cls: p.cls, id: U.id, name: U.name, x: p.x, y: p.y, tx: p.action.data.tx, ty: p.action.data.ty });
  brUlt(sim, p);
  ascendedUlt(sim, p, p.action.data.tx, p.action.data.ty); // (Part B: an Ascended hero's Astral Echo)
}

/** Per-tick ult bookkeeping: meter decay, rage/aura timers, the Eclipse window. */
function updateUltState(sim, p) {
  // partial meters decay slowly out of combat; a full (ready) meter is kept until used
  if (!sim.predicting && p.ult > 0 && p.ult < ULT.max && sim.tick - p.lastCombat > ULT.decayAfter) p.ult = Math.max(0, p.ult - ULT.decayPerSec * DT);
  if (!sim.predicting) { const m = ultHitMul(p); p.ultHitBudget = Math.min(ULT.hitPerSec * m, (p.ultHitBudget || 0) + ULT.hitPerSec * m * DT); } // hit-trickle token bucket
  if (p.surge > 0) p.surge--;
  if (p.rage > 0 && !sim.predicting) ragePull(sim, p);
  if (p.rage > 0 && --p.rage === 0) { if (CLASSES[p.cls].rageRes) p.res = Math.min(p.res, CLASSES[p.cls].rageRules.afterBerserk); sim.emit({ type: 'rageEnd', pid: p.id, x: p.x, y: p.y }); }
  if (p.aura > 0) {
    p.aura--;
    if (p.aura % ASCENSION.every === 0) ascensionPulse(sim, p);
  }
  const E = p.eclipse;
  if (E && E.rt && E.rt.fin) { // a finisher is playing: the window holds until it lands (safety: no finisher action = end now)
    if (!(p.action && p.action.data && p.action.data.fin) && !sim.predicting) endEclipse(sim, p, null);
  } else if (E && --E.t <= 0) endEclipse(sim, p); // Eclipse ends: burst on every Backstabbed enemy, pips refill
  const W = p.uw;
  if (W && W.rt.fin) { if (!(p.action && p.action.data && p.action.data.fin) && !sim.predicting) endUltWindow(sim, p, null); }
  else if (W && --W.t <= 0) endUltWindow(sim, p);
}
export { endUltWindow };

/** Eclipse stealth after a cast: ECLIPSE.stealth ticks (0.5s) from the cast, so quick casts (Flicker, Heartseeker) set up a
 *  Backstab for the next hit, while a long Thousand Cuts flurry outlasts it. */
function eclipseShade(sim, p, a) {
  const t = ECLIPSE.stealth;
  if (!(p.stealth > 0)) sim.emit({ type: 'eclipseShade', pid: p.id, x: p.x, y: p.y });
  if (!((p.stealth || 0) >= t)) { p.stealth = t; p.stealthSrc = 'eclipse'; } // a longer Vanish stealth keeps its source
}

/** Shadow Step (Vanish -> Flicker): blink behind the target (or 200 px toward the aim) keeping stealth; decoy at the start point. */
/** Marked for Death: one more Mark on `e` (a fresh owner resets the count). Server/solo only; synced in enemy snapshots. */
export function addMark(sim, p, e) {
  if (sim.predicting || e.dead) return;
  const n = e.mark && e.mark.pid === p.id && e.mark.t > 0 ? Math.min(SHADOW.markMax, e.mark.n + 1) : 1; // bosses too: 5 cuts on a lone boss = 5 Marks = 5 clones
  e.mark = { pid: p.id, n, t: SHADOW.markDur };
  sim.emit({ type: 'mark', pid: p.id, id: e.id, x: e.x, y: e.y - e.r - 20, n });
  const E = CLASSES[p.cls].edge, act = p.action; // Edge: +1 per Mark applied (max 2 per attack)
  if (E && act && (act.em || 0) < E.markCap) { act.em = (act.em || 0) + 1; addEdge(sim, p, E.mark); }
}
/** Blade Dancer Edge (crit stacks): +n (max 10), refreshes the decay timer. Authoritative sim only. */
export function addEdge(sim, p, n) {
  const E = CLASSES[p.cls].edge;
  if (!E || sim.predicting || !(n > 0)) return;
  const before = p.edge || 0;
  p.edge = Math.min(E.max, before + n); p.edgeT = sim.tick;
  if (p.edge !== before) sim.emit({ type: 'edge', pid: p.id, n: p.edge, x: Math.round(p.x), y: Math.round(p.y - 50), max: p.edge >= E.max && before < E.max ? 1 : undefined });
}
/** Shadow Execution: queue one clone stab per Mark on every marked enemy in range (0.08s apart), consuming the Marks. Server/solo only. */
function scheduleClones(sim, p, delay) {
  if (sim.predicting) return;
  const list = marksOf(sim, p).filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < SHADOW.cloneR + e.r)
    .sort((u, v) => Math.hypot(u.x - p.x, u.y - p.y) - Math.hypot(v.x - p.x, v.y - p.y));
  let k = 0, total = 0;
  const rt = p.eclipse && p.eclipse.rt; // Crescent Execution counts the stacks used on its target during the route
  for (const e of list) { total += e.mark.n; if (rt) rt.cm[e.id] = (rt.cm[e.id] || 0) + e.mark.n; for (let i = 0; i < e.mark.n; i++) { p.clones.push({ id: e.id, at: sim.tick + delay + k * SHADOW.cloneEvery, i: k }); k++; } e.mark = null; }
  sim.emit({ type: 'shadowExecution', pid: p.id, x: p.x, y: p.y, n: total, targets: list.length });
}
function runClones(sim, p) {
  const due = p.clones.filter((c) => c.at <= sim.tick);
  if (!due.length) return;
  p.clones = p.clones.filter((c) => c.at > sim.tick);
  for (const c of due) {
    const e = sim.enemyById.get(c.id);
    if (!e || e.dead) continue;
    const ang = c.i * 2.39996 + e.id; // golden-angle spread so each clone comes from a new side
    const fx = e.x + Math.cos(ang) * (e.r + 70), fy = e.y + Math.sin(ang) * (e.r + 70);
    sim.emit({ type: 'cloneStab', pid: p.id, id: e.id, fx, fy, x: e.x, y: e.y, i: c.i });
    hitEnemy(sim, p, e, { mul: HEART.mul * SHADOW.cloneMul, execute: true, executeFull: true, clone: true, stagger: 8, kb: 60, kbAng: Math.atan2(e.y - fy, e.x - fx), hitstop: 2, heavy: true });
  }
}
function shadowStep(sim, p, a) {
  a.dur = 12; a.cancel = 6; a.lockMove = true; a.data.step = 1;
  p.iframes = Math.max(p.iframes, 12);
  const fx = p.x, fy = p.y;
  const e = pickTarget(sim, p, a.data.tx, a.data.ty, SHADOW.stepRange);
  let lx, ly;
  if (e) { const ang = Math.atan2(e.y - p.y, e.x - p.x), d = e.r + p.r + SHADOW.stepBehind; lx = e.x + Math.cos(ang) * d; ly = e.y + Math.sin(ang) * d; a.data.tid = e.id; }
  else { lx = p.x + Math.cos(a.ang) * 200; ly = p.y + Math.sin(a.ang) * 200; }
  ({ x: lx, y: ly } = clearPath(sim.world, p.x, p.y, lx, ly, p.r)); // (swept: never tunnels through walls / props)
  p.x = p.px = lx; p.y = p.py = ly;
  if (e) a.ang = Math.atan2(e.y - ly, e.x - lx); // facing the target's back
  p.aim = a.ang;
  p.stealth = Math.max(p.stealth, SHADOW.stepStealth); p.stealthSrc = 'shadow'; // still hidden: the next hit Backstabs
  a.data.fx = fx; a.data.fy = fy;
  if (!sim.predicting) addArea(sim, { team: 'player', ownerId: p.id, kind: 'decoy', decoy: true, visual: true, x: fx, y: fy, r: 18, delay: SHADOW.decoy, pulses: 1, every: 1 });
  sim.emit({ type: 'shadowStep', pid: p.id, fx, fy, x: lx, y: ly, ang: a.ang });
}
/** Shadow Pierce (Vanish -> Heartseeker): a line lunge through every enemy (guaranteed crits + low-HP bonus). */
function shadowPierceStart(sim, p, a) {
  a.dur = 22; a.cancel = 15; a.lockMove = true;
  p.iframes = Math.max(p.iframes, 10);
  const e = pickTarget(sim, p, a.data.tx, a.data.ty, HEART.range);
  let len = SHADOW.pierceLen;
  if (e) { a.ang = Math.atan2(e.y - p.y, e.x - p.x); len = Math.max(len, Math.hypot(e.x - p.x, e.y - p.y) + e.r + p.r + 20); }
  let lx = p.x + Math.cos(a.ang) * len, ly = p.y + Math.sin(a.ang) * len;
  ({ x: lx, y: ly } = clearPath(sim.world, p.x, p.y, lx, ly, p.r)); // (swept: never tunnels through walls / props)
  a.data.pierce = 1; a.data.fx = p.x; a.data.fy = p.y; a.data.lx = lx; a.data.ly = ly;
}
function shadowPierceTick(sim, p, a) {
  const d = a.data, T = 8;
  if (a.t < T) { const k = (a.t + 1) / T; p.x = d.fx + (d.lx - d.fx) * k; p.y = d.fy + (d.ly - d.fy) * k; }
  if (a.t !== T - 1) return;
  const len = Math.hypot(d.lx - d.fx, d.ly - d.fy), ang = Math.atan2(d.ly - d.fy, d.lx - d.fx);
  sim.emit({ type: 'shadowPierce', pid: p.id, fx: d.fx, fy: d.fy, x: d.lx, y: d.ly, ang });
  let kills = 0;
  hitEnemiesInShape(sim, p, { shape: 'line', x: d.fx, y: d.fy, ang, len, w: SHADOW.pierceW }, { mul: HEART.mul, execute: true, forceCrit: true, stagger: 18, kb: 150, hitstop: 5, heavy: true, selfHitstop: 3, onHit: (dmg, e) => { if (e.hp <= 0) kills++; } });
  if (kills > 0 && !sim.predicting) { // a kill: a moment of stealth (another Vanish chain can follow)
    p.stealth = Math.max(p.stealth, SHADOW.pierceStealth); p.stealthSrc = 'pierce';
    sim.emit({ type: 'shadowPierceKill', pid: p.id, x: p.x, y: p.y, kills });
  }
}

// ------------------------------------------------------------------ Eclipse finishers
/** Ten Thousand Cuts (mob route finisher). You + `clones` (one per kill on the route, min..max) each run a Thousand Cuts at once
 *  on everything within `r` of the cast point: a cut every `every` ticks after a `lead`-tick split; you cut `cuts` times, each
 *  clone `cloneCuts` times at `cloneMul`; every cut is a Backstab crit; a cut that kills its target outright (first cut on it,
 *  not a boss) gives that cutter +1 cut (max `actorMax` per cutter, `totalMax` in all). Each cut hangs a crescent in the air
 *  (max `slashMax`); `detDelay` ticks after the last cut they all detonate: every enemy within `detR` of any crescent takes
 *  min(detMax, detBase + detPer x crescents on it) x ATK as a guaranteed crit. Server/solo only (a predicting sim just waits). */
export const TTC = { r: 600, minClones: 3, maxClones: 8, cuts: 5, cloneCuts: 4, cloneMul: 0.6, actorMax: 11, totalMax: 80, every: 7, lead: 24, detDelay: 22, slashMax: 96, detR: 56, detBase: 1.5, detPer: 0.25, detMax: 6, perCrit: 0.04, critMax: 2 };
/** Crescent Execution (boss route finisher): a target within `range` (else the nearest within `range` + 200), held for the
 *  cinematic; stacks = its Marks now + the Marks the route's Shadow Execution used on it (max `maxStacks`); clones shown =
 *  max(minClones, stacks) (up to `showMax`); at tick `impact` ONE hit of HEART.mul x (base + perStack x stacks), a guaranteed
 *  crit (no extra Backstab multiplier: with it, a 10-stack hit took ~60% of Grimtusk's HP). */
export const CRESCENT = { range: 520, minClones: 3, showMax: 12, maxStacks: 12, base: 4, perStack: 1, perCrit: 0.5, critMax: 8, impact: 54, dash: 8, dur: 72 };
/** Crescent Execution's multiplier: HEART.mul x (base + perStack x stacks + perCrit x crits landed in Eclipse, max +critMax). */
export const crescentMul = (stacks, crits) => HEART.mul * (CRESCENT.base + CRESCENT.perStack * stacks + Math.min(CRESCENT.critMax, CRESCENT.perCrit * (crits || 0)));

function ttcStart(sim, p, a) {
  a.lockMove = true; a.data.fin = 1;
  a.dur = TTC.lead + TTC.actorMax * TTC.every + TTC.detDelay + 30; a.cancel = a.dur; // upper bound; trimmed when the cuts run out
  p.iframes = Math.max(p.iframes, a.dur);
  if (sim.predicting) return;
  const rt = p.eclipse && p.eclipse.rt;
  const n = clamp(rt ? rt.k : 0, TTC.minClones, TTC.maxClones);
  const cx = p.x, cy = p.y, actors = [{ x: p.x, y: p.y, left: TTC.cuts, done: 0 }];
  for (let i = 0; i < n; i++) { const an = p.aim + Math.PI + (i + 0.5) / n * Math.PI * 2; actors.push({ x: cx + Math.cos(an) * 64, y: cy + Math.sin(an) * 64, left: TTC.cloneCuts, done: 0 }); }
  const crits = rt ? rt.cr || 0 : 0; // crits landed during Eclipse: the detonation grows +4% each (max x2)
  a.data.ttc = { cx, cy, actors, cut: new Map(), sl: [], total: 0, dmg: 0, kills: 0, detAt: 0, crits, cm: Math.min(TTC.critMax, 1 + TTC.perCrit * crits) };
  sim.emit({ type: 'ttcStart', pid: p.id, x: cx, y: cy, n, r: TTC.r, kills: rt ? rt.k : 0, clones: actors.slice(1).map((c) => [Math.round(c.x), Math.round(c.y)]) });
}
function ttcTick(sim, p, a) {
  p.iframes = Math.max(p.iframes, 8);
  const d = a.data.ttc;
  if (!d) return; // predicting: the server moves you
  if (d.detAt) { if (a.t === d.detAt) ttcDetonate(sim, p, a, d); return; }
  if (a.t < TTC.lead || (a.t - TTC.lead) % TTC.every) return;
  const inR = (e) => !e.dead && Math.hypot(e.x - d.cx, e.y - d.cy) < TTC.r + e.r;
  if (!d.actors.some((c) => c.left > 0) || d.total >= TTC.totalMax || !sim.enemies.some(inR)) { d.detAt = a.t + TTC.detDelay; a.dur = d.detAt + 18; a.cancel = a.dur; return; }
  for (let k = 0; k < d.actors.length; k++) {
    const c = d.actors[k];
    if (c.left <= 0 || d.total >= TTC.totalMax) continue;
    let e = null, best = Infinity;
    for (const q of sim.enemies) { // the least-cut enemy, nearest this cutter first: spreads over a pack, piles onto a lone boss
      if (!inR(q)) continue;
      const sc = (d.cut.get(q.id) || 0) * 10000 + Math.hypot(q.x - c.x, q.y - c.y);
      if (sc < best) { best = sc; e = q; }
    }
    if (!e) break;
    const first = !d.cut.get(e.id);
    d.cut.set(e.id, (d.cut.get(e.id) || 0) + 1);
    c.left--; c.done++; d.total++;
    const side = (d.total + k) % 2 ? 0.8 : -0.8, ang = Math.atan2(e.y - c.y, e.x - c.x) + side;
    let nx = e.x + Math.cos(ang) * (e.r + 24), ny = e.y + Math.sin(ang) * (e.r + 24);
    if (pointBlocked(sim.world, nx, ny, p.r)) { nx = e.x - Math.cos(ang) * (e.r + 24); ny = e.y - Math.sin(ang) * (e.r + 24); }
    if (k === 0) ({ x: nx, y: ny } = clearPath(sim.world, p.x, p.y, nx, ny, p.r)); // (the real you never lands inside / behind a wall)
    const fx = c.x, fy = c.y, sa = Math.atan2(ny - fy, nx - fx);
    c.x = nx; c.y = ny;
    if (k === 0) { p.x = p.px = nx; p.y = p.py = ny; a.ang = Math.atan2(e.y - ny, e.x - nx); }
    const jx = ((d.total * 37) % 23) - 11, jy = ((d.total * 53) % 19) - 9; // crescents scatter a little around the target
    if (d.sl.length < TTC.slashMax) d.sl.push([Math.round(e.x + jx), Math.round(e.y + jy), Math.round(sa * 100) / 100]);
    sim.emit({ type: 'ttcCut', pid: p.id, k, fx: Math.round(fx), fy: Math.round(fy), x: Math.round(nx), y: Math.round(ny), tx: Math.round(e.x + jx), ty: Math.round(e.y + jy), ang: Math.round(sa * 100) / 100, id: e.id });
    const r = hitEnemy(sim, p, e, { mul: CUTS.mul * (k ? TTC.cloneMul : 1), backstabAll: true, clone: true, kbAng: sa, kb: e.boss ? 0 : 60, stagger: 12, hitstop: 2, heavy: true });
    if (r) d.dmg += r.dmg;
    if (e.dead) {
      d.kills++;
      if (first && !e.boss && c.done + c.left < TTC.actorMax) c.left++; // killed outright: this cutter gets one more cut
    }
  }
}
function ttcDetonate(sim, p, a, d) {
  let hits = 0, total = 0;
  const R = TTC.detR;
  for (const e of sim.enemies) {
    if (e.dead) continue;
    let n = 0;
    for (const s of d.sl) { const dx = s[0] - e.x, dy = s[1] - e.y, rr = R + e.r; if (dx * dx + dy * dy <= rr * rr) n++; }
    if (!n) continue;
    const r = hitEnemy(sim, p, e, { mul: Math.min(TTC.detMax, TTC.detBase + TTC.detPer * n), dmgMul: d.cm || 1, forceCrit: true, clone: true, heavy: true, stagger: 40, knockdown: e.boss ? 0 : 70, kb: e.boss ? 0 : 240, kbAng: Math.atan2(e.y - d.cy, e.x - d.cx), hitstop: 10 });
    if (r) { hits++; total += r.dmg; }
  }
  p.hitstop = Math.max(p.hitstop, 6);
  sim.emit({ type: 'ttcDetonate', pid: p.id, x: Math.round(d.cx), y: Math.round(d.cy), slashes: d.sl, hits, total: Math.round(total), cuts: d.total, cutDmg: Math.round(d.dmg), kills: d.kills, n: d.actors.length - 1, crits: d.crits || 0 });
  endEclipse(sim, p, 'ten_thousand_cuts');
}

function crescentStart(sim, p, a) {
  a.dur = CRESCENT.dur; a.cancel = a.dur; a.lockMove = true; a.data.fin = 1;
  p.iframes = Math.max(p.iframes, a.dur + 6);
  if (sim.predicting) return;
  const e = pickTarget(sim, p, a.data.tx, a.data.ty, CRESCENT.range) || nearestEnemy(sim, p, CRESCENT.range + 200);
  const rt = p.eclipse && p.eclipse.rt;
  let stacks = 0;
  if (e) {
    if (e.mark && e.mark.pid === p.id && e.mark.t > 0) stacks += e.mark.n;
    stacks = Math.min(CRESCENT.maxStacks, stacks + ((rt && rt.cm[e.id]) || 0));
    e.mark = null;
    e.hitstop = Math.max(e.hitstop, CRESCENT.impact + 2); // held still for the cinematic
    a.ang = Math.atan2(e.y - p.y, e.x - p.x);
  }
  const n = Math.max(CRESCENT.minClones, stacks), crits = rt ? rt.cr || 0 : 0;
  a.data.cr = { id: e ? e.id : 0, stacks, n, fx: p.x, fy: p.y, crits };
  sim.emit({ type: 'crescentStart', pid: p.id, id: e ? e.id : 0, x: Math.round(e ? e.x : p.x), y: Math.round(e ? e.y : p.y), r: e ? e.r : 30, n: Math.min(n, CRESCENT.showMax), stacks, crits, px: Math.round(p.x), py: Math.round(p.y), boss: !!(e && e.boss), mul: Math.round(crescentMul(stacks, crits) * 10) / 10, impact: CRESCENT.impact });
}
function nearestEnemy(sim, p, range) {
  let best = null, bd = Infinity;
  for (const e of sim.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r; if (d < range && d < bd) { bd = d; best = e; } }
  return best;
}
function crescentTick(sim, p, a) {
  p.iframes = Math.max(p.iframes, 8);
  const d = a.data.cr;
  if (!d) return; // predicting
  const e = d.id ? sim.enemyById.get(d.id) : null, live = e && !e.dead;
  if (live && a.t < CRESCENT.impact) e.hitstop = Math.max(e.hitstop, 2);
  const t0 = CRESCENT.impact - CRESCENT.dash;
  if (a.t === t0) sim.emit({ type: 'crescentDash', pid: p.id, id: d.id, x: Math.round(e ? e.x : p.x), y: Math.round(e ? e.y : p.y), r: e ? e.r : 30, px: Math.round(p.x), py: Math.round(p.y) });
  if (live && a.t >= t0 && a.t < CRESCENT.impact) { // the dash in, with the clones
    const ang = Math.atan2(e.y - d.fy, e.x - d.fx), dist = Math.max(0, Math.hypot(e.x - d.fx, e.y - d.fy) - e.r - p.r - 4);
    const k = (a.t - t0 + 1) / CRESCENT.dash;
    let lx = d.fx + Math.cos(ang) * dist * k, ly = d.fy + Math.sin(ang) * dist * k;
    if (!pointBlocked(sim.world, lx, ly, p.r)) { p.x = lx; p.y = ly; }
    a.ang = ang;
  }
  if (a.t !== CRESCENT.impact) return;
  const mul = crescentMul(d.stacks, d.crits);
  let dmg = 0;
  if (live) {
    const r = hitEnemy(sim, p, e, { mul, forceCrit: true, clone: true, heavy: true, bigNum: true, pierce: true, stagger: 80, knockdown: e.boss ? 0 : 120, kb: e.boss ? 0 : 420, kbAng: a.ang, hitstop: 16 });
    dmg = r ? r.dmg : 0;
  }
  p.hitstop = Math.max(p.hitstop, 8);
  sim.emit({ type: 'crescentImpact', pid: p.id, id: d.id, x: Math.round(e ? e.x : p.x), y: Math.round(e ? e.y : p.y), r: e ? e.r : 30, dmg, stacks: d.stacks, crits: d.crits || 0, n: Math.min(d.n, CRESCENT.showMax), killed: !!(e && e.dead), boss: !!(e && e.boss), mul: Math.round(mul * 10) / 10 });
  endEclipse(sim, p, 'crescent_execution');
}

// ------------------------------------------------------------------ Warrior rush helpers
/** The nearest drawn enemy touching the front of the Warrior (within `reach` px of contact), else null. */
export function rushContact(sim, p, ang, reach) {
  let best = null, bd = Infinity;
  const fx = p.x + Math.cos(ang) * 6, fy = p.y + Math.sin(ang) * 6;
  for (const e of targetsOf(sim)) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - fx, e.y - fy) - e.r - p.r;
    if (d <= reach && d < bd) { bd = d; best = e; }
  }
  return best;
}
/** Set up a leap to the aim point (clamped to `range`, stepped off walls): T ticks in the air with i-frames. */
export function leapTo(sim, p, a, range, T, to = null) {
  const t = to || clampTarget(p, a, range);
  let lx = t.x, ly = t.y;
  ({ x: lx, y: ly } = clearPath(sim.world, p.x, p.y, lx, ly, p.r)); // (swept: never tunnels through walls / props)
  a.data.fx = p.x; a.data.fy = p.y; a.data.lx = lx; a.data.ly = ly; a.data.T = T;
  if (Math.hypot(lx - p.x, ly - p.y) > 4) a.ang = Math.atan2(ly - p.y, lx - p.x);
  p.iframes = Math.max(p.iframes, T);
}
export function leapTick(p, a, T) {
  const d = a.data;
  if (a.t < T && d.lx != null) { const k = (a.t + 1) / T, e = k * k * (3 - 2 * k); p.x = d.fx + (d.lx - d.fx) * e; p.y = d.fy + (d.ly - d.fy) * e; }
}
/** Drag enemies within R toward the Warrior at `speed` px/s (bosses x bossK). Authoritative sim only. */
export function dragIn(sim, p, R, speed, bossK) {
  for (const e of sim.enemies) {
    if (e.dead) continue;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    if (d > R + e.r) continue;
    const gap = d - p.r - e.r - 10;
    if (gap <= 0) continue;
    const step = Math.min(gap, speed * DT * (e.boss ? bossK : 1 / Math.max(1, (e.mass || 1) * 0.5)));
    e.x += (dx / d) * step; e.y += (dy / d) * step; e.pulled = sim.tick;
  }
}

/** Berserk aura: drag nearby enemies toward the Warrior (bosses barely move). Server-side only. */
function ragePull(sim, p) {
  const R2 = RAGE.pullR * RAGE.pullR;
  for (const e of sim.enemies) {
    if (e.dead) continue;
    const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy;
    if (d2 > R2) continue;
    const d = Math.sqrt(d2), gap = d - p.r - e.r - RAGE.minGap;
    if (gap <= 0) continue;
    const step = Math.min(gap, RAGE.pullSpeed * DT * (e.boss ? RAGE.bossPull : 1 / Math.max(1, (e.mass || 1) * 0.5)));
    e.x += (dx / d) * step; e.y += (dy / d) * step;
    e.pulled = sim.tick;
  }
}

function ascensionPulse(sim, p) {
  const A = ASCENSION;
  sim.emit({ type: 'auraPulse', pid: p.id, x: p.x, y: p.y, r: A.r });
  healAllies(sim, p, p.x, p.y, A.r, (q) => q.stats.maxHp * A.healPct + p.stats.atk * A.healAtk);
  hitEnemiesInShape(sim, p, { shape: 'circle', x: p.x, y: p.y, r: A.r }, { mul: A.mul, kb: 50, hitstop: 1, ult: true, style: 'holy' });
}

// ------------------------------------------------------------------ skills
/** Base skill numbers by skill id, from the class data (skills[k].stats): one source for the sim and the tooltips. */
const SK = {};
for (const c of Object.values(CLASSES)) for (const k in c.skills) SK[c.skills[k].id] = c.skills[k].stats || {};
export const SKILLS = {
  // ===== Ranger =====
  dashshot: {
    start(sim, p, a) { a.dur = 22; a.cancel = 14; a.lockMove = true; p.iframes = Math.max(p.iframes, 14); },
    tick(sim, p, a) {
      if (a.t < 11) { const sp = 1100 * (1 - a.t / 12); p.x -= Math.cos(a.ang) * sp * DT; p.y -= Math.sin(a.ang) * sp * DT; }
      if (a.t === 4) {
        spawnProjectile(sim, { team: 'player', ownerId: p.id, x: p.x, y: p.y, vx: Math.cos(a.ang) * 950, vy: Math.sin(a.ang) * 950, r: 9, life: 40, mul: SK.dashshot.mul, kb: 240, stagger: 22, pierce: 1, style: 'bigarrow', heavy: true, hitstop: 5 });
        sim.emit({ type: 'shoot', pid: p.id, x: p.x, y: p.y, ang: a.ang, cls: p.cls, heavy: true });
      }
    },
  },
  pierce: {
    start(sim, p, a) { a.dur = 28; a.cancel = 20; a.moveMul = 0.1; },
    tick(sim, p, a) {
      if (a.t !== 10) return;
      const hm = a.chain && a.chain.id === 'hunters_mark';
      const rf = a.chain && a.chain.id === 'rapid_finale';
      const angs = hm ? [-0.16, 0, 0.16] : [0];
      for (const off of angs) {
        const ang = a.ang + off;
        spawnProjectile(sim, { team: 'player', ownerId: p.id, x: p.x, y: p.y, vx: Math.cos(ang) * 1050, vy: Math.sin(ang) * 1050, r: 11, life: 42, mul: rf ? 3.9 : SK.pierce.mul, kb: 280, stagger: 26, knockdown: rf ? 70 : 0, pierce: -1, style: 'pierce', heavy: true, critVsCC: hm, hitstop: 5, stack: hm ? ['quarry', 1] : undefined }); // Hunter's Mark arrows: +1 Quarry each
      }
      p.vx -= Math.cos(a.ang) * 220; p.vy -= Math.sin(a.ang) * 220;
      sim.emit({ type: 'shoot', pid: p.id, x: p.x, y: p.y, ang: a.ang, cls: p.cls, heavy: true, pierce: true });
    },
  },
  volley: {
    start(sim, p, a) {
      a.dur = 18; a.cancel = 12; a.moveMul = 0.3;
      const eb = a.chain && a.chain.id === 'evasive_barrage';
      const V = SK.volley, t = clampTarget(p, a, V.range);
      p.lastVolley = { x: t.x, y: t.y, r: V.r, tick: sim.tick }; // Storm Lance flies into it
      addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: t.x, y: t.y, r: V.r, delay: eb ? 2 : 32, pulses: V.pulses, every: V.every, kind: 'volley', o: { mul: eb ? 0.95 : V.mul, slow: 120, slowMul: V.slowMul, kb: 40, stagger: 6, hitstop: 1 } });
    },
  },
  trap: {
    start(sim, p, a) {
      a.dur = 14; a.cancel = 10; a.moveMul = 0.3;
      const T = SK.trap, t = clampTarget(p, a, T.range);
      p.traps = p.traps.filter((id) => sim.areas.some((ar) => ar.id === id));
      if (p.traps.length >= 2) { const old = sim.areas.find((ar) => ar.id === p.traps[0]); if (old) old.dead = true; p.traps.shift(); }
      const ar = addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: t.x, y: t.y, r: T.r, trigger: 'proximity', triggerR: 34, life: T.life, kind: 'trap', o: { mul: T.mul, root: T.root, hitstop: 6, heavy: true, stack: ['quarry', 1] } });
      p.traps.push(ar.id);
    },
  },
  // ===== Mage =====
  blink: {
    start(sim, p, a) {
      a.dur = 12; a.cancel = 6; a.moveMul = 0;
      const from = { x: p.x, y: p.y };
      const t = clampTarget(p, a, SK.blink.range);
      // step back along the path until the destination is free
      let tx = t.x, ty = t.y;
      ({ x: tx, y: ty } = clearPath(sim.world, from.x, from.y, tx, ty, p.r));
      p.x = tx; p.y = ty; p.px = tx; p.py = ty;
      p.iframes = Math.max(p.iframes, SK.blink.iframes);
      sim.emit({ type: 'blink', pid: p.id, fx: from.x, fy: from.y, x: p.x, y: p.y });
    },
  },
  blast: {
    start(sim, p, a) {
      a.dur = 22; a.cancel = 14; a.moveMul = 0.25;
      const sh = a.chain && a.chain.id === 'shatter';
      const t = clampTarget(p, a, SK.blast.range);
      p.lastBlast = { x: t.x, y: t.y, tick: sim.tick }; // Chrono Field freezes time where it landed
      addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: t.x, y: t.y, r: sh ? 135 : SK.blast.r, delay: 20, kind: 'blast', o: { mul: SK.blast.mul, kb: 300, stagger: 30, bonusVsFrozen: sh ? 2 : 0, hitstop: 7, heavy: true } });
    },
  },
  meteor: {
    start(sim, p, a) {
      a.dur = 24; a.cancel = 16; a.moveMul = 0.2;
      const cat = a.chain && a.chain.id === 'cataclysm';
      const M = SK.meteor, t = clampTarget(p, a, M.range);
      addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: t.x, y: t.y, r: M.r, delay: cat ? 24 : M.delay, kind: 'meteor', o: { mul: cat ? 5.2 : M.mul, knockdown: 90, kb: 320, hitstop: 10, heavy: true, stack: ['burn', cat ? MAG.burn.cataclysm : MAG.burn.meteor] } });
      addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: t.x, y: t.y, r: 110, delay: (cat ? 24 : M.delay) + 20, pulses: M.burnPulses, every: M.burnEvery, kind: 'burn', o: { mul: M.burnMul, hitstop: 0, stack: ['burn', MAG.burn.pulse] } });
    },
  },
  nova: {
    start(sim, p, a) {
      a.dur = 20; a.cancel = 12; a.moveMul = 0;
      a.data.r = a.chain && a.chain.id === 'blink_nova' ? 210 : SK.nova.r;
    },
    tick(sim, p, a) {
      if (a.t === 5) {
        sim.emit({ type: 'nova', pid: p.id, x: p.x, y: p.y, r: a.data.r });
        hitEnemiesInShape(sim, p, { shape: 'circle', x: p.x, y: p.y, r: a.data.r }, { mul: SK.nova.mul, freeze: SK.nova.freeze, kb: 60, hitstop: 5, heavy: true, selfHitstop: 3 });
      }
    },
  },
  // ===== Cleric =====
  smite: {
    start(sim, p, a) {
      a.dur = 30; a.cancel = 22; a.lockMove = true;
      const rf = a.chain && a.chain.id === 'righteous_fury';
      a.data.r = rf ? 110 : SK.smite.r;
      a.data.o = { mul: rf ? 3.6 : SK.smite.mul, stagger: 24, kb: 260, hitstop: 6, heavy: true, selfHitstop: 4, stack: ['condemn', CLR.smiteStacks] };
    },
    tick(sim, p, a) {
      p.superArmor = true;
      if (a.t < 8) { p.x += Math.cos(a.ang) * 160 * DT; p.y += Math.sin(a.ang) * 160 * DT; }
      if (a.t !== 11) return;
      const rf = a.chain && a.chain.id === 'righteous_fury';
      const r = a.data.r || SK.smite.r, x = p.x + Math.cos(a.ang) * 50, y = p.y + Math.sin(a.ang) * 50;
      sim.emit({ type: 'smite', pid: p.id, x, y, r });
      let dealt = 0;
      hitEnemiesInShape(sim, p, { shape: 'circle', x, y, r }, { ...(a.data.o || { mul: 2 }), onHit: (d) => { dealt += d; } });
      // heal self + nearby allies for a share of the damage dealt (capped per target)
      const share = dealt * SMITE_HEAL * (rf ? 2 : 1), cap = p.stats.maxHp * (rf ? 0.3 : 0.2);
      if (share > 0) healAllies(sim, p, p.x, p.y, 280, () => Math.min(cap, share));
      if (p.angel > 0 && !sim.predicting) schedule(sim, p, ANGEL.delay, { k: 'echo', x, y, r, o: a.data.o || { mul: 2 }, rf }); // Guardian Angel echoes it
    },
  },
  sanctuary: {
    start(sim, p, a) {
      a.dur = 16; a.cancel = 10; a.moveMul = 0.3;
      const bw = a.chain && a.chain.id === 'bulwark';
      const t = bw ? { x: p.x, y: p.y } : clampTarget(p, a, SK.sanctuary.range);
      const ar = addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: t.x, y: t.y, r: bw ? 160 : SK.sanctuary.r, delay: 6, pulses: SK.sanctuary.pulses, every: SK.sanctuary.every, kind: 'sanctuary', noDamage: true,
        heal: { pct: bw ? 0.045 : SK.sanctuary.healPct, atk: bw ? 0.45 : SK.sanctuary.healAtk }, slow: { t: 40, mul: SK.sanctuary.slowMul },
        dot: bw ? { mul: BULWARK_DOT, hitstop: 0, kb: 0, style: 'holy' } : null }); // Bulwark also burns enemies every 0.5s
      p.lastSanct = { id: ar.id, x: t.x, y: t.y, r: ar.r, tick: sim.tick }; // Holy Nova explodes it
    },
  },
  shieldrush: {
    start(sim, p, a) {
      a.dur = 22; a.cancel = 16; a.lockMove = true;
      a.data.o = { mul: SK.shieldrush.mul, knockdown: SK.shieldrush.knockdown, kb: 320, hitstop: 5, heavy: true, selfHitstop: 2 };
      grantShield(sim, p, shieldAmount(p), SK.shieldrush.shield, p);
    },
    tick(sim, p, a) {
      p.superArmor = true;
      if (a.t >= 14) return;
      const sp = 1000 * (a.t < 11 ? 1 : 0.5);
      p.x += Math.cos(a.ang) * sp * DT; p.y += Math.sin(a.ang) * sp * DT;
      hitEnemiesInShape(sim, p, { shape: 'circle', x: p.x + Math.cos(a.ang) * 16, y: p.y + Math.sin(a.ang) * 16, r: 38 }, { ...(a.data.o || { mul: SK.shieldrush.mul }), kbAng: a.ang + (sim.rng.next() < 0.5 ? 1.1 : -1.1) }, a.data.hit);
      if (!a.data.shielded) a.data.shielded = new Set();
      for (const q of sim.players.values()) { // allies the cleric rushes past get a shield too
        if (q === p || q.dead || a.data.shielded.has(q.id) || Math.hypot(q.x - p.x, q.y - p.y) > 70 + q.r) continue;
        a.data.shielded.add(q.id);
        grantShield(sim, q, shieldAmount(p), SK.shieldrush.shield, p);
      }
    },
  },
  judgment: {
    start(sim, p, a) {
      const fv = a.chain && a.chain.id === 'final_verdict';
      const charge = Math.max(0, Math.min(p.stats.maxRes, a.data.resBefore ?? p.res));
      a.data.k = charge / Math.max(1, p.stats.maxRes); // 0..1: how much Holy Charge was stored
      p.res = 0; // consumes all of it
      a.data.hitT = fv ? 12 : 24;
      a.dur = a.data.hitT + 18; a.cancel = a.dur - 6; a.lockMove = true;
    },
    tick(sim, p, a) {
      p.superArmor = true;
      if (a.t !== (a.data.hitT || 24)) return;
      const fv = a.chain && a.chain.id === 'final_verdict';
      const k = a.data.k ?? 0, r = SK.judgment.r;
      sim.emit({ type: 'judgment', pid: p.id, x: p.x, y: p.y, r, k });
      const o = { mul: judgmentMul(null, k, fv), knockdown: 80, kb: 360, hitstop: 10, heavy: true, selfHitstop: 6 };
      if (fv && !sim.predicting) { // Final Verdict: uses up every Condemn stack on each enemy hit, x(1 + CLR.verdictPer(Boss) per stack)
        for (const e of sim.enemies) {
          if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > r + e.r) continue;
          const n = takeStacks(sim, p, e, 'condemn'), big = e.boss || e.elite;
          hitEnemy(sim, p, e, { ...o, mul: judgmentMul(e, k, fv), dmgMul: 1 + (big ? CLR.verdictPerBoss : CLR.verdictPer) * n, kbAng: Math.atan2(e.y - p.y, e.x - p.x), bigNum: n >= 5 || undefined });
          if (n) sim.emit({ type: 'verdict', pid: p.id, id: e.id, n, x: Math.round(e.x), y: Math.round(e.y - e.r - 30) });
        }
        p.hitstop = Math.max(p.hitstop, 6);
      } else { // (per enemy: bosses / elites take the heavier judgment)
        for (const e of sim.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) <= r + e.r) hitEnemy(sim, p, e, { ...o, mul: judgmentMul(e, k, false), kbAng: Math.atan2(e.y - p.y, e.x - p.x) });
      }
      // no downed state in this game: Judgment is a big heal on you and nearby allies instead of a revive
      healAllies(sim, p, p.x, p.y, 320, (q) => q.stats.maxHp * (JUDGMENT.healBase + JUDGMENT.healPerCharge * k));
    },
  },
  // ===== Blade Dancer =====
  flicker: {
    start(sim, p, a) {
      if (a.chain && a.chain.id === 'shadow_step') { shadowStep(sim, p, a); return; }
      a.dur = 13; a.cancel = 8; a.lockMove = true; // cancellable into the next Flicker right after the dash (chainable)
      p.iframes = Math.max(p.iframes, 12);
      a.data.fx = p.x; a.data.fy = p.y;
      a.data.o = { mul: SK.flicker.mul, stagger: 20, kb: 160, hitstop: 3, heavy: true, noPop: true }; // it Marks what it cuts (so it never pops Marks itself)
    },
    tick(sim, p, a) {
      if (a.data.step) return; // Shadow Step: already there
      if (a.t < 7) {
        p.x += Math.cos(a.ang) * 1750 * DT; p.y += Math.sin(a.ang) * 1750 * DT;
        hitEnemiesInShape(sim, p, { shape: 'circle', x: p.x, y: p.y, r: 42 }, { ...(a.data.o || { mul: SK.flicker.mul }), kbAng: a.ang + Math.PI / 2 * (sim.rng.next() < 0.5 ? 1 : -1), onHit: (dm, e) => addMark(sim, p, e) }, a.data.hit);
      }
      if (a.t === 7) sim.emit({ type: 'flicker', pid: p.id, fx: a.data.fx ?? p.x, fy: a.data.fy ?? p.y, x: p.x, y: p.y });
    },
  },
  heartseeker: {
    start(sim, p, a) {
      if (a.chain && a.chain.id === 'shadow_pierce') { shadowPierceStart(sim, p, a); return; }
      if (a.chain && a.chain.id === 'crescent_execution') { crescentStart(sim, p, a); return; }
      if (a.chain && a.chain.id === 'shadow_execution') scheduleClones(sim, p, 10); // clones strike as your own stab lands
      a.dur = 24; a.cancel = 17; a.lockMove = true;
      const e = pickTarget(sim, p, a.data.tx, a.data.ty, HEART.range);
      a.data.fx = p.x; a.data.fy = p.y;
      let lx, ly;
      if (e) { const ang = Math.atan2(e.y - p.y, e.x - p.x), d = Math.max(0, Math.hypot(e.x - p.x, e.y - p.y) - e.r - p.r - 6); lx = p.x + Math.cos(ang) * d; ly = p.y + Math.sin(ang) * d; a.ang = ang; a.data.tid = e.id; p.lastHeart = { id: e.id, tick: sim.tick }; }
      else { lx = p.x + Math.cos(a.ang) * 180; ly = p.y + Math.sin(a.ang) * 180; }
      ({ x: lx, y: ly } = clearPath(sim.world, p.x, p.y, lx, ly, p.r)); // (swept: never tunnels through walls / props)
      a.data.lx = lx; a.data.ly = ly;
    },
    tick(sim, p, a) {
      const d = a.data;
      if (d.pierce) { shadowPierceTick(sim, p, a); return; }
      if (a.chain && a.chain.id === 'crescent_execution') { crescentTick(sim, p, a); return; }
      if (a.t < 10 && d.lx != null) { const k = (a.t + 1) / 10; p.x = d.fx + (d.lx - d.fx) * k; p.y = d.fy + (d.ly - d.fy) * k; }
      if (a.t === 10) {
        const t = d.tid ? sim.enemyById.get(d.tid) : null;
        const tt = t || (d.tid ? targetsOf(sim).find((q) => q.id === d.tid) : null);
        if (tt && !tt.dead) a.ang = Math.atan2(tt.y - p.y, tt.x - p.x);
        sim.emit({ type: 'heartseeker', pid: p.id, fx: d.fx ?? p.x, fy: d.fy ?? p.y, x: p.x, y: p.y, ang: a.ang });
        hitEnemiesInShape(sim, p, { shape: 'cone', x: p.x, y: p.y, ang: a.ang, arc: 1.3, r: 78 }, { mul: HEART.mul, execute: true, stagger: 18, kb: 150, hitstop: 7, heavy: true, selfHitstop: 4, kbAng: a.ang });
      }
    },
  },
  vanish: {
    start(sim, p, a) {
      a.dur = 18; a.cancel = 12; a.lockMove = true;
      p.iframes = Math.max(p.iframes, 14);
      p.stealth = VANISH.stealth; p.stealthSrc = 'vanish';
      for (const e of sim.enemies) if (e.aggroId === p.id) e.aggroId = 0; // enemies lose you
      sim.emit({ type: 'vanish', pid: p.id, x: p.x, y: p.y, ang: a.ang });
    },
    tick(sim, p, a) {
      if (a.t < 11) { const sp = (VANISH.dist * 5.5) * (1 - a.t / 12); p.x -= Math.cos(a.ang) * sp * DT; p.y -= Math.sin(a.ang) * sp * DT; } // backflip away from the aim
    },
  },
  thousandcuts: {
    start(sim, p, a) {
      if (a.chain && a.chain.id === 'ten_thousand_cuts') { ttcStart(sim, p, a); return; }
      const cid = a.chain && a.chain.id;
      let list = cutsTargets(sim, p, cid === 'crimson_flurry');
      if (cid === 'eviscerate') { const h = p.lastHeart && sim.enemyById && sim.enemyById.get(p.lastHeart.id); if (h && !h.dead && Math.hypot(h.x - p.x, h.y - p.y) < 400 + h.r) list = [h]; else list = list.slice(0, 1); a.data.ev = 1; } // Eviscerate: every cut on the Heartseeker target
      if (cid === 'crimson_flurry') a.data.cf = 1;
      a.data.ids = list.map((e) => e.id);
      a.data.pts = list.map((e) => [Math.round(e.x), Math.round(e.y), e.r]);
      const hops = list.length ? CUTS.hops : 0;
      a.data.hops = hops; a.data.xs = 0;
      if (a.chain && a.chain.id === 'death_blossom') { a.data.bl = 1; a.data.bcut = []; a.data.bk = 0; } // ids already cut this cast, kills
      if (a.chain && a.chain.id === 'marked_for_death') a.data.mk = 1;
      a.dur = hops ? hops * CUTS.every + 12 : 24; a.cancel = a.dur - 4; a.lockMove = true;
      p.iframes = Math.max(p.iframes, a.dur); // brief invulnerability for the whole flurry
    },
    tick(sim, p, a) {
      if (a.chain && a.chain.id === 'ten_thousand_cuts') { ttcTick(sim, p, a); return; }
      const ids = a.data.ids || [], pts = a.data.pts || [];
      if (!ids.length) { // nobody around: a quick flurry in front
        if (a.t === 6) { sim.emit({ type: 'swing', pid: p.id, x: p.x, y: p.y, ang: a.ang, arc: 2.6, range: 95, idx: 4, heavy: true, cls: p.cls }); hitEnemiesInShape(sim, p, { shape: 'cone', x: p.x, y: p.y, ang: a.ang, arc: 2.6, r: 95 }, { mul: 1.2, stagger: 14, hitstop: 4, heavy: true }); }
        return;
      }
      const hops = a.data.hops ?? CUTS.hops;
      if (a.t % CUTS.every !== 0 || a.t >= hops * CUTS.every) return;
      let i = (a.t / CUTS.every) % ids.length; // cycle through the targets (a lone boss takes every cut)
      if (a.data.bl) { for (let j = 0; j < ids.length; j++) { const q = sim.enemyById.get(ids[(i + j) % ids.length]); if (q && !q.dead) { i = (i + j) % ids.length; break; } } } // Death Blossom: skip the dead
      const e = sim.enemyById.get(ids[i]);
      const live = e && !e.dead;
      if (!live && sim.enemyById.size) return; // that target died: skip this cut
      const tx = live ? e.x : pts[i][0], ty = live ? e.y : pts[i][1], tr = live ? e.r : pts[i][2] || 16;
      const fx = p.x, fy = p.y;
      const ang = Math.atan2(ty - p.y, tx - p.x) + (i % 2 ? 0.7 : -0.7);
      let nx = tx + Math.cos(ang) * (tr + 22), ny = ty + Math.sin(ang) * (tr + 22); // land just past the target
      if (pointBlocked(sim.world, nx, ny, p.r)) { nx = tx - Math.cos(ang) * (tr + 22); ny = ty - Math.sin(ang) * (tr + 22); }
      ({ x: nx, y: ny } = clearPath(sim.world, fx, fy, nx, ny, p.r));
      p.x = nx; p.y = ny; p.px = nx; p.py = ny;
      a.ang = Math.atan2(ty - ny, tx - nx);
      if (!live) return;
      const ev = !!a.data.ev, cf = !!a.data.cf && !!(e.mark && e.mark.pid === p.id && e.mark.t > 0);
      sim.emit({ type: 'cut', pid: p.id, fx, fy, x: nx, y: ny, tx, ty, id: e.id, n: a.t / CUTS.every, exec: ev || undefined, cf: cf || undefined });
      const first = a.data.bl && !a.data.bcut.includes(e.id);
      const evMul = ev ? 1 + Math.min(CUTS.evMax, CUTS.evPer * (p.critRun || 0)) : 1; // Eviscerate: +15% per crit already landed in the chain
      hitEnemy(sim, p, e, { mul: CUTS.mul, dmgMul: evMul, kbAng: a.ang, kb: ev && e.boss ? 0 : 90, stagger: 20, hitstop: 4, heavy: true, backstabAll: !!a.data.bl, forceCrit: cf || undefined, noPop: !!a.data.mk || undefined });
      if (a.data.mk && !e.dead && !sim.predicting) addMark(sim, p, e);
      if (a.data.bl) {
        if (e.dead && !sim.predicting) a.data.bk = (a.data.bk || 0) + 1;
        if (first) a.data.bcut.push(e.id);
        if (first && e.dead && !e.boss && !sim.predicting && (a.data.xs || 0) < SHADOW.blossomMax) { // killed outright: one more cut
          a.data.xs = (a.data.xs || 0) + 1; a.data.hops++; a.dur += CUTS.every; a.cancel += CUTS.every;
          p.iframes = Math.max(p.iframes, a.dur - a.t);
          for (const q of cutsTargets(sim, p)) if (!ids.includes(q.id)) { ids.push(q.id); pts.push([Math.round(q.x), Math.round(q.y), q.r]); } // fresh victims
          sim.emit({ type: 'blossom', pid: p.id, x: p.x, y: p.y, n: a.data.xs });
        }
      }
    },
  },
  // ===== Ultimates (key T) =====
  berserk: {
    start(sim, p, a) {
      a.dur = 40; a.cancel = 34; a.lockMove = true;
      const t = clampTarget(p, a, TITAN.range);
      let lx = t.x, ly = t.y;
      ({ x: lx, y: ly } = clearPath(sim.world, p.x, p.y, lx, ly, p.r)); // (swept: never tunnels through walls / props)
      a.data.fx = p.x; a.data.fy = p.y; a.data.lx = lx; a.data.ly = ly;
      p.iframes = Math.max(p.iframes, 24);
    },
    tick(sim, p, a) {
      p.superArmor = true;
      const d = a.data;
      if (a.t < 22 && d.lx != null) { const k = (a.t + 1) / 22, e = k * k * (3 - 2 * k); p.x = d.fx + (d.lx - d.fx) * e; p.y = d.fy + (d.ly - d.fy) * e; }
      if (a.t === 22) {
        sim.emit({ type: 'titanSlam', pid: p.id, x: p.x, y: p.y, r: TITAN.r });
        hitEnemiesInShape(sim, p, { shape: 'circle', x: p.x, y: p.y, r: TITAN.r }, { mul: TITAN.mul, knockup: TITAN.knockdown, kb: 420, hitstop: 12, heavy: true, selfHitstop: 8, ult: true });
        p.rage = TITAN.rage;
        p.res = p.stats.maxRes; // Berserk: Rage locked full
        sim.emit({ type: 'rage', pid: p.id, x: p.x, y: p.y });
      }
    },
  },
  arrowstorm: {
    start(sim, p, a) {
      a.dur = 16; a.cancel = 8; a.moveMul = 0.5; // the ranger keeps acting while the storm rains
      const t = clampTarget(p, a, STORM.range);
      a.data.tx = t.x; a.data.ty = t.y;
      addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: t.x, y: t.y, r: STORM.r, delay: 18, pulses: STORM.pulses, every: STORM.every, kind: 'arrowstorm',
        o: { mul: STORM.mul, slow: 40, slowMul: STORM.slowMul, kb: 20, stagger: 4, hitstop: 1, ult: true } });
    },
  },
  ultmeteor: {
    start(sim, p, a) {
      a.dur = 26; a.cancel = 16; a.moveMul = 0.2;
      const M = ULT_METEOR, t = clampTarget(p, a, M.range);
      a.data.tx = t.x; a.data.ty = t.y;
      addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: t.x, y: t.y, r: M.r, delay: M.delay, kind: 'meteor', big: true, o: { mul: M.mul, knockdown: M.knockdown, kb: 380, hitstop: 12, heavy: true, ult: true, stack: ['burn', MAG.burn.ult] } });
      addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: t.x, y: t.y, r: M.burnR, delay: M.delay + 12, pulses: M.burnPulses, every: M.burnEvery, kind: 'burn', big: true, o: { mul: M.burnMul, hitstop: 0, ult: true, stack: ['burn', MAG.burn.pulse] } });
    },
  },
  ascension: {
    start(sim, p, a) { a.dur = 26; a.cancel = 18; a.moveMul = 0; p.iframes = Math.max(p.iframes, 20); },
    tick(sim, p, a) {
      p.superArmor = true;
      if (a.t === 10) { p.aura = ASCENSION.dur + 1; sim.emit({ type: 'ascend', pid: p.id, x: p.x, y: p.y, r: ASCENSION.r }); ascensionPulse(sim, p); }
    },
  },
  eclipse: {
    start(sim, p, a) {
      a.dur = 20; a.cancel = 12; a.moveMul = 0.5;
      p.iframes = Math.max(p.iframes, 16);
      p.eclipse = { t: ECLIPSE.dur, ext: 0, dmg: new Map(), bs: new Set(), rt: CLASSES[p.cls].routes ? newRouteState() : null };
      sim.emit({ type: 'eclipse', pid: p.id, x: p.x, y: p.y });
      eclipseShade(sim, p, a); // the ult cast counts as a cast: open with a Backstab
    },
  },
};
Object.assign(SKILLS, ALT_SKILLS); // (Part D A3: the Astral skill variants, sim/ascalt.js)
