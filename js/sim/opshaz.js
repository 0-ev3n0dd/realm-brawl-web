// Missions revamp, part 1: the biome hazards runtime (tables: sim/opsmods.js OPS_HAZ) + the small helpers the mission
// runtime shares (mission-source damage on enemies: turrets, traps, the relic pulse, hazards; relic damage).
// Server-authoritative (sim/ops.js runs it; a predicting client never ticks missions). Telegraphs are visual enemy areas
// (packed to co-op clients like any area; client/missionfx.js draws each biome's kind), the hits are resolved here.
import { DT } from './constants.js';
import { damagePlayer, killEnemy, cancelAreasOf, addArea } from './combat.js';
import { OPS, clampInArena } from './opsconst.js';
import { OPS_HAZ, HAZ_TYPES, HAZ_FOE, hasMod } from './opsmods.js';

const TAU = Math.PI * 2;
const r0 = (v) => Math.round(v);
const emit = (sim, ph, o = {}) => { const O = sim.ops; sim.emit({ type: 'ops', ph, k: O ? O.type : '', b: O ? O.biome : '', ...o }); };

/** the hero closest to (x, y) among `pl` (or null) */
export function nearestOf(pl, x, y) { let b = null, bd = Infinity; for (const p of pl) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; b = p; } } return b; }

/**
 * Damage an enemy from a mission source (turret, trap, ward, the relic pulse, a hazard). Credits `p` (loot shower + XP
 * on the kill, like a hero's hit) when given. o: { slow, slowMul, stun, kb, fx (x, y: knockback from), num (emit a number) }.
 */
export function opsHurt(sim, e, dmg, p, o = {}) {
  if (!e || e.dead || e.untargetable || e.dummy || !(dmg > 0)) return 0;
  const d = Math.max(1, Math.round(dmg));
  if (e.esh > 0) { const ab = Math.min(e.esh, d); e.esh -= ab; e.hp -= d - ab; } else e.hp -= d;
  e.flash = Math.max(e.flash || 0, 5);
  if (p) { if (e.dmgBy) e.dmgBy[p.id] = (e.dmgBy[p.id] || 0) + d; if (!e.aggroId && !e.opsRaid) e.aggroId = p.id; }
  if (o.slow) { e.cc.slow = Math.max(e.cc.slow, o.slow); e.cc.slowMul = o.slowMul ?? 0.5; }
  if (o.stun) { e.cc.stun = Math.max(e.cc.stun, o.stun); cancelAreasOf(sim, e); if (e.opsAi === 'siege' || e.opsAi === 'queen') { e.state = 'recover'; e.st = 0; } }
  if (o.kb && o.fx != null) { const a = Math.atan2(e.y - o.fy, e.x - o.fx), m = Math.max(1, (e.mass || 1) ** 0.5); e.vx += Math.cos(a) * o.kb / m; e.vy += Math.sin(a) * o.kb / m; }
  if (o.num !== false) sim.emit({ type: 'dmg', x: e.x, y: e.y - e.r, amount: d, crit: false, team: 'enemy', pid: p ? p.id : undefined, id: e.id, ops: 1 });
  if (e.hp <= 0 && !e.dead) killEnemy(sim, e, p || null);
  return d;
}

/** damage the Defense relic (its shield soaks first). Returns the HP damage dealt. */
export function hurtRelic(sim, O, amt) {
  if (!O || O.type !== 'defense' || O.st !== 'run' || !(amt > 0)) return 0;
  const D = OPS.defense, R = O.A.relic;
  let dmg = amt;
  if (O.shield > 0) { const s = Math.min(O.shield, dmg); O.shield -= s; dmg -= s; if (O.shield <= 0) emit(sim, 'shieldBreak', { x: R.x, y: R.y }); }
  O.relic = Math.max(0, O.relic - dmg); O.hurtT = D.shieldDelay; O.relicMin = Math.min(O.relicMin ?? 100, O.relic);
  return dmg;
}

// ------------------------------------------------------------------ biome hazards
export function hazInit(O) {
  const H = OPS_HAZ[O.biome];
  O.hz = { on: !!H && HAZ_TYPES.has(O.type), t: H ? H.first : 0, storm: 0, next: H ? H.stormEvery : 0, list: [], n: 0 };
}
/** hazard pace per mission type (Assault has its own traps; Mobile Defense's surge stage x1.5 on top) */
const HAZ_RATE = { mobile: 0.75, assault: 0.55, capture: 0.6 };
/** rank factor of hazard damage on an enemy (share of its max HP x the strike's foe share) */
const foeK = (e) => (e.opsBoss ? HAZ_FOE.boss : e.elite ? HAZ_FOE.elite : HAZ_FOE.fodder);
function spot(sim, O, pl, i) {
  const A = O.A, rng = O.rng, H = OPS_HAZ[O.biome], S = H.strike, path = !!A.path || O.type === 'assault';
  let x, y;
  if (pl.length && (path || i === 0 || rng.next() < 0.6)) { const p = pl[Math.floor(rng.next() * pl.length)], a = rng.next() * TAU, r = (i === 0 ? 40 : 90) + rng.next() * 220; x = p.x + Math.cos(a) * r; y = p.y + Math.sin(a) * r; }
  else { const a = rng.next() * TAU, r = Math.sqrt(rng.next()) * (A.R - 120); x = A.cx + Math.cos(a) * r; y = A.cy + Math.sin(a) * r; }
  if (path) { // a route / the stronghold: inside its walls, on this side of a closed gate, off the collapsed floor, clear of the carrier
    const q = clampInArena(A, x, y, S.r * 0.6); x = q.x; y = q.y;
    if (O.gateY != null && y < O.gateY + S.r) y = O.gateY + S.r;
    for (const h of (sim.world && sim.world.opsHoles) || []) { const hx = x - h.x, hy = y - h.y, hd = Math.hypot(hx, hy), m = h.r + S.r * 0.5; if (hd < m) { x = h.x + (hd ? hx / hd : 1) * m; y = h.y + (hd ? hy / hd : 0) * m; } }
    if (O.cart) { const cx = x - O.cart.x, cy = y - O.cart.y, cd = Math.hypot(cx, cy), m = S.r + 60; if (cd < m) { x = O.cart.x + (cd ? cx / cd : 1) * m; y = O.cart.y + (cd ? cy / cd : 0) * m; } }
    return { x: r0(x), y: r0(y) };
  }
  // inside the arena (and the Swarm's safe ring), clear of the Defense relic
  const lim = Math.min(A.R - S.r * 0.6, O.type === 'swarm' && O.safeR ? O.safeR - 40 : 1e9), dx = x - A.cx, dy = y - A.cy, d = Math.hypot(dx, dy);
  if (d > lim) { x = A.cx + dx / d * lim; y = A.cy + dy / d * lim; }
  if (A.relic) { const rx = x - A.relic.x, ry = y - A.relic.y, rd = Math.hypot(rx, ry), m = A.relic.r + S.r + 90; if (rd < m) { x = A.relic.x + (rd ? rx / rd : 1) * m; y = A.relic.y + (rd ? ry / rd : 0) * m; } }
  return { x: r0(x), y: r0(y) };
}
/** one hazard tick: the storm cycle, new strikes (telegraphed), strikes landing */
export function tickHazard(sim, O, pl) {
  const Z = O.hz; if (!Z || !Z.on || O.st !== 'run') return;
  if ((O.type === 'defense' && O.dph === 'build') || (O.type === 'mobile' && O.mst === 'boss' && !O.surge)) { resolve(sim, O); return; } // (a breather while you build: pending strikes still land)
  const H = OPS_HAZ[O.biome], S = H.strike;
  if (Z.storm > 0) { if (--Z.storm === 0) emit(sim, 'stormEnd', { name: H.storm }); }
  else if (--Z.next <= 0) { Z.storm = H.stormT; Z.next = H.stormEvery; emit(sim, 'storm', { name: H.storm, hz: H.id }); }
  const rate = (Z.storm > 0 ? H.stormMul : 1) * (hasMod(O, 'stormy') ? 1.6 : 1) * (O.surge ? 1.5 : 1) * (HAZ_RATE[O.type] ?? 1);
  Z.t -= rate;
  if (Z.t <= 0 && pl.length) {
    Z.t = H.every;
    const n = S.n + (Z.storm > 0 ? 1 : 0) + (pl.length > 2 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const q = spot(sim, O, pl, i), delay = S.delay + i * 9;
      addArea(sim, { team: 'enemy', ownerId: 0, shape: 'circle', x: q.x, y: q.y, r: S.r, delay, pulses: S.pulses, every: S.every, visual: true, kind: 'ohz_' + H.id, committed: true });
      Z.list.push({ x: q.x, y: q.y, at: sim.tick + delay, k: 0 }); Z.n++;
    }
  }
  resolve(sim, O);
}
function resolve(sim, O) {
  const Z = O.hz; if (!Z || !Z.list.length) return;
  const H = OPS_HAZ[O.biome], S = H.strike;
  const pl = []; for (const p of sim.players.values()) if (!p.dead) pl.push(p);
  for (const s of Z.list) {
    if (sim.tick < s.at) continue;
    const pct = s.k === 0 && S.burst ? S.burst : S.pct;
    for (const p of pl) if ((p.x - s.x) ** 2 + (p.y - s.y) ** 2 < (S.r + p.r * 0.6) ** 2) damagePlayer(sim, p, 0, { x: s.x, y: s.y }, { pct, kb: S.kb, stun: s.k === 0 ? S.stun : 0, by: H.name });
    const foe = s.k === 0 && S.burst ? S.foe * 2 : S.foe;
    for (const e of O.mobs) if (!e.dead && (e.x - s.x) ** 2 + (e.y - s.y) ** 2 < (S.r + e.r * 0.6) ** 2) opsHurt(sim, e, e.maxHp * foe * foeK(e), nearestOf(pl, e.x, e.y), { slow: S.stun ? S.stun * 2 : 0, slowMul: 0.4, kb: S.kb * 0.5, fx: s.x, fy: s.y, num: !!e.elite || !!e.opsBoss });
    if (s.k === 0 || H.id === 'sandstorm') emit(sim, 'hz', { x: s.x, y: s.y, r: S.r, hz: H.id, n: s.k });
    s.k++; s.at += S.every;
  }
  Z.list = Z.list.filter((s) => s.k < S.pulses);
}
export { DT };
