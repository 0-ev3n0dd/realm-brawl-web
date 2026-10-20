// Loadout presets (step 4): each hero has 7 presets. A preset stores the full 10-slot gear set (item uids) and the
// chain setup (pinned chains + HUD focus). Pure sim code: the commands run in sim/player.js (handleCommand), so co-op is
// server-authoritative (the room cleans the commands, server/room.js) and the presets are saved with the hero
// (sim/save.js serializeCharacter / sanitizeChar, server/validate.js validateCharacter).
//   * swap rules: instant in town; elsewhere a short cast (LO.cast) that taking damage or attacking cancels; never in
//     combat (LO.combat s after the last hit taken / dealt), never with a boss alive nearby or during an encounter
//     (raid, trial, Astrael) - so presets can't be used to dodge a fight's gear checks mid-pull.
//   * a preset item that is gone (salvaged, stashed, sold) is skipped: the slot keeps what is equipped now.
import { CLASSES } from './data/classes.js';
import { EQUIP_SLOTS, fitsSlot } from './data/items.js';
import { secs } from './constants.js';
import { inTownArea } from './townconst.js';

export const LO_N = 7;
export const LO = { cast: 1.2, combat: 5, bossR: 1400, nameMax: 16, pinMax: 8 };
export const FOCUS = ['all', 'mob', 'boss'];

const cleanName = (s) => String(s ?? '').replace(/[\u0000-\u001f<>"`]/g, '').trim().slice(0, LO.nameMax);
const cleanUid = (s) => (typeof s === 'string' ? s.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) : '');
export const defaultLoName = (i) => `Loadout ${i + 1}`;

/** the class's chain ids (what a pin may name) */
export const chainIds = (cls) => ((CLASSES[cls] && CLASSES[cls].chains) || []).map((c) => c.id);
/** chain setup: { pins: [chain ids, in pin order], focus: 'all' | 'mob' | 'boss' } */
export function normChainSet(raw, cls) {
  const ids = new Set(chainIds(cls)), pins = [];
  if (raw && Array.isArray(raw.pins)) for (const id of raw.pins) if (typeof id === 'string' && ids.has(id) && !pins.includes(id) && pins.length < LO.pinMax) pins.push(id);
  const out = { pins, focus: raw && FOCUS.includes(raw.focus) ? raw.focus : 'all' };
  if (raw && raw.alt === 1) out.alt = 1; // (Part D A3: the Astral skill variant on)
  return out;
}
/** one preset (or null) */
export function normLoadout(raw, cls, i = 0) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const g = {};
  for (const s of EQUIP_SLOTS) { const u = raw.g && cleanUid(raw.g[s]); g[s] = u || null; }
  return { n: cleanName(raw.n) || defaultLoName(i), g, c: normChainSet(raw.c, cls) };
}
/** the 7 presets of a hero (missing / junk entries -> null) */
export function normLoadouts(raw, cls) {
  const a = Array.isArray(raw) ? raw : [];
  return Array.from({ length: LO_N }, (_, i) => normLoadout(a[i], cls, i));
}
export const normLoIndex = (v) => (Number.isInteger(v) && v >= 0 && v < LO_N ? v : -1);

/** what a preset saved right now would hold */
export function snapshotLoadout(p, name) {
  const g = {}; for (const s of EQUIP_SLOTS) g[s] = (p.equipment[s] && p.equipment[s].uid) || null;
  return { n: cleanName(name) || defaultLoName(0), g, c: normChainSet(p.chainSet, p.cls) };
}

/** why a swap can't start / continue right now (null = it can) */
export function swapBlock(sim, p) {
  if (p.dead) return 'dead';
  const town = inTownArea(p.x, p.y);
  if (!town && sim.tick - (p.lastCombat ?? -1e9) < secs(LO.combat)) return 'combat';
  if (!town && (sim.raid || sim.trial || sim.astrael)) return 'encounter';
  if (!town) for (const e of sim.enemies) if ((e.boss || e.raid) && !e.dead && !e.dummy && Math.hypot(e.x - p.x, e.y - p.y) < LO.bossR) return 'boss';
  return null;
}
export const BLOCK_MSG = { dead: 'You are down', combat: 'In combat: wait a few seconds', encounter: 'Not during a boss encounter', boss: 'A boss is nearby', empty: 'That preset is empty', bag: 'Bag full: free a slot first', busy: 'Already swapping' };

/**
 * Plan a swap: the new equipment + bag. Each preset slot takes its saved item from the equipped gear or the bag (any
 * slot it fits: rings move between ring slots); a missing item keeps what that slot has now (when no other slot claimed
 * it). Displaced gear goes to the bag; returns { err: 'bag' } when it would not fit. miss = saved items not found.
 */
export function planSwap(p, lo) {
  const pool = new Map();
  for (const s of EQUIP_SLOTS) { const it = p.equipment[s]; if (it && it.uid) pool.set(it.uid, it); }
  p.inventory.forEach((it) => { if (it && it.uid && !pool.has(it.uid)) pool.set(it.uid, it); });
  const eq = {}, used = new Set(); let miss = 0;
  for (const s of EQUIP_SLOTS) {
    const u = lo.g[s]; if (!u) continue;
    const it = pool.get(u);
    if (!it || used.has(u) || !fitsSlot(it.slot, s) || (it.cls && it.cls !== p.cls)) { miss++; continue; }
    eq[s] = it; used.add(u);
  }
  for (const s of EQUIP_SLOTS) { if (eq[s]) continue; const cur = p.equipment[s]; eq[s] = cur && !used.has(cur.uid) ? (used.add(cur.uid), cur) : null; }
  const inv = p.inventory.map((it) => (it && used.has(it.uid) ? null : it));
  for (const s of EQUIP_SLOTS) {
    const cur = p.equipment[s]; if (!cur || used.has(cur.uid)) continue;
    const free = inv.indexOf(null); if (free < 0) return { err: 'bag' };
    inv[free] = cur; used.add(cur.uid);
  }
  let changed = 0; for (const s of EQUIP_SLOTS) if ((eq[s] && eq[s].uid) !== (p.equipment[s] && p.equipment[s].uid)) changed++;
  return { eq, inv, miss, changed };
}

/** make the swap (returns false when the bag can't take the displaced gear) */
export function applyLoadout(sim, p, i) {
  const lo = p.loadouts && p.loadouts[i]; if (!lo) return false;
  const plan = planSwap(p, lo);
  if (plan.err) { sim.emit({ type: 'loadout', ph: 'fail', pid: p.id, i, why: plan.err }); return false; }
  for (const s of EQUIP_SLOTS) p.equipment[s] = plan.eq[s];
  for (let k = 0; k < p.inventory.length; k++) p.inventory[k] = plan.inv[k];
  p.chainSet = normChainSet(lo.c, p.cls); p.lo = i; p.loCast = null; p.dirty = true;
  sim.emit({ type: 'loadout', ph: 'swap', pid: p.id, i, name: lo.n, miss: plan.miss, changed: plan.changed, x: p.x, y: p.y });
  return true;
}

/** a loadout command (loSave / loName / loUse / loCancel / chainSet). Returns true when the gear changed. */
export function loadoutCommand(sim, p, cmd) {
  if (!p.loadouts) p.loadouts = normLoadouts(null, p.cls);
  const i = normLoIndex(cmd.i);
  switch (cmd.type) {
    case 'loSave': {
      if (i < 0) return false;
      const old = p.loadouts[i];
      p.loadouts[i] = snapshotLoadout(p, cmd.name || (old && old.n) || defaultLoName(i)); p.lo = i; p.dirty = true;
      sim.emit({ type: 'loadout', ph: 'saved', pid: p.id, i, name: p.loadouts[i].n });
      return false;
    }
    case 'loName': {
      if (i < 0 || !p.loadouts[i]) return false;
      p.loadouts[i].n = cleanName(cmd.name) || defaultLoName(i); p.dirty = true;
      sim.emit({ type: 'loadout', ph: 'named', pid: p.id, i, name: p.loadouts[i].n });
      return false;
    }
    case 'loUse': {
      if (i < 0) return false;
      if (!p.loadouts[i]) { sim.emit({ type: 'loadout', ph: 'fail', pid: p.id, i, why: 'empty' }); return false; }
      if (p.loCast) { sim.emit({ type: 'loadout', ph: 'fail', pid: p.id, i, why: 'busy' }); return false; }
      const why = swapBlock(sim, p);
      if (why) { sim.emit({ type: 'loadout', ph: 'fail', pid: p.id, i, why }); return false; }
      if (inTownArea(p.x, p.y)) return applyLoadout(sim, p, i);
      const plan = planSwap(p, p.loadouts[i]); if (plan.err) { sim.emit({ type: 'loadout', ph: 'fail', pid: p.id, i, why: plan.err }); return false; }
      p.loCast = { i, t0: sim.tick, until: sim.tick + secs(LO.cast) };
      sim.emit({ type: 'loadout', ph: 'cast', pid: p.id, i, name: p.loadouts[i].n, dur: LO.cast, x: p.x, y: p.y });
      return false;
    }
    case 'loCancel': if (p.loCast) { p.loCast = null; sim.emit({ type: 'loadout', ph: 'cancel', pid: p.id, why: 'you' }); } return false;
    case 'chainSet': {
      p.chainSet = normChainSet(cmd, p.cls); p.dirty = true;
      const a = normLoIndex(p.lo); if (a >= 0 && p.loadouts[a]) p.loadouts[a].c = normChainSet(p.chainSet, p.cls); // (the active preset keeps the chain setup in step)
      sim.emit({ type: 'loadout', ph: 'chains', pid: p.id });
      return false;
    }
  }
  return false;
}

/** per tick while casting: finish, or cancel on damage / attacking / a boss walking in. Returns true when the gear changed. */
export function tickLoadout(sim, p) {
  const c = p.loCast; if (!c) return false;
  const hit = (p.lastHurt ?? -1e9) > c.t0 || (p.lastCombat ?? -1e9) > c.t0;
  const why = hit ? 'combat' : (p.dead ? 'dead' : swapBlock(sim, p));
  if (why) { p.loCast = null; sim.emit({ type: 'loadout', ph: 'cancel', pid: p.id, i: c.i, why }); return false; }
  if (sim.tick < c.until) return false;
  return applyLoadout(sim, p, c.i);
}

/** the HUD chain list after the chain setup: pinned chains (in pin order) if any, else the focus filter */
export function hudChains(cls, set) {
  const all = (CLASSES[cls] && CLASSES[cls].chains) || [];
  if (!set) return all;
  if (set.pins && set.pins.length) { const by = new Map(all.map((c) => [c.id, c])); const out = set.pins.map((id) => by.get(id)).filter(Boolean); if (out.length) return out; }
  if (set.focus === 'mob' || set.focus === 'boss') { const f = all.filter((c) => (c.kind || 'mob') === set.focus || c.kind === 'both'); if (f.length) return f; }
  return all;
}
