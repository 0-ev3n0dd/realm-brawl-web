// Horde AoE (mobbing pass 3): every class's hits on regular (non-boss) enemies spill into the crowd around them, each in
// its own way: the Warrior's quake cleave, the Paladin's holy shockwave, the Ninja's shadow marks jumping between
// enemies, the Samurai's iaido crescent, the Monk's ricocheting chi palm, the Dragoon's piercing lance, the Ranger's
// ricochet arrows, the Summoner's ink splash, the Mage's Starfall (falling stars on the struck enemy, Starbreaker's
// cosmic theme: 2026-10-08 buff, the level HP curve had left the Mage's mobbing behind). Signature pass (2026-10-08):
// the Ranger's Hawk's Eye Volley (arrows split into a fan of spirit arrows; Sylva's spirit hawk strafes the line),
// the Summoner's Grimoire Page Storm (Mirelle's pages whirl out round the struck enemy) and the Warrior's Warcry Quake
// (Brakka's cleave shockwave + a quake round the struck enemy). Bard is the benchmark (untouched).
// The spill never touches a boss and only starts from a hit on a non-boss enemy, so boss-side damage is unchanged (a
// boss's adds die a little faster; see tools/balance/horde-kpm.mjs and test/hordeaoe.test.js for the checks).
// Spill damage = a share of the source hit's multiplier through the normal hit pipeline (so Rage / Chi / Holy Charge
// and stacks still build; no Backstab, Mark pop or lifesteal from it), capped per tick so a 10-hit flurry can't flood the sim. Authoritative sim only.
import { hitEnemy } from './combat.js';

/** per class: k = shape, f = share of the source hit, r / len / w = size, n = max enemies, cd = ticks between procs,
 *  lone = damage scale when a chain burst / pulse catches a single enemy (the pre-2026-10-08 strength: the pack-clearing
 *  buffs leave single-target / elite fights where they were; 0 = that class had no chain burst), resGain = resource per spill hit */
export const HORDE_AOE = {
  warrior:     { k: 'warcry', name: 'Warcry Quake', f: 0.85, len: 900, arc: 3.6, cry: 400, r: 360, self: 0.4, n: 40, lone: 0.75 / 0.85, cd: 0 }, // (2026-10-08 signature; was Earthsplitter: 6 fissures f 0.75)
  cleric:      { k: 'shock',  name: 'Holy Shockwave', f: 1.35, r: 900, n: 48, lone: 0.9 / 1.35, cd: 0 }, // (2026-10-08 tuning; was f 0.9, r 660, 44)
  bladedancer: { k: 'marks',  name: 'Shadow Marks', f: 0.8, r: 660, n: 34, cd: 0 },
  samurai:     { k: 'wave',   name: 'Iaido Crescent', f: 0.75, len: 760, w: 200, n: 36, fan: [0, -0.5, 0.5], cd: 0 },
  monk:        { k: 'ripple', name: 'Chi Ripple', f: 0.9, r: 480, n: 30, decay: 0.97, lone: 0.8 / 0.9, cd: 0 }, // (2026-10-08 tuning; was f 0.8, r 440, 28)
  dragoon:     { k: 'pierce', name: 'Skewer', f: 1.05, len: 1050, w: 260, n: 40, fan: [0, -0.32, 0.32], lone: 0.75 / 1.05, cd: 0 }, // (2026-10-08 tuning; was f 0.75, len 820, w 180, 36)
  ranger:      { k: 'volley', name: "Hawk's Eye Volley", f: 1.6, len: 900, w: 180, split: 9, spread: 0.45, n: 40, hawk: { len: 1400, w: 350, f: 1.3, cd: 40, self: 0.8 }, resGain: 0.05, lone: 0, cd: 8 }, // (2026-10-08 signature; was Ricochet: 1 bounce f 0.55, no chain bursts. cd 8: a volley every 0.13 s at most, so a fast bow's arrows don't each flood the pack with full-size spill hits)
  mage:        { k: 'starfall', name: 'Starfall', f: 1.25, r: 300, n: 14, lone: 1.2 / 1.25, cd: 0 }, // (2026-10-08 buff, retuned on the fixed horde bot; was Arc Lash: f 0.5, 2 jumps)
  summoner:    { k: 'pages',  name: 'Grimoire Page Storm', f: 0.6, r: 240, self: 0.15, n: 14, lone: 0, cd: 0 }, // (2026-10-08 signature; was Ink Splash: f 0.35, r 120, 3 enemies, no chain bursts)
};
export const HORDE_AOE_TICK_CAP = 4;
export const HORDE_AOE_BOSS_R = 1600; // no spill / chain bursts with a live boss this close (boss fights unchanged)
export const HORDE_AOE_CHAIN = { f: 1, size: 1.35, reach: 240, pulses: 2, every: 20 }; // a chain going off bursts the shape out along the aim, then it pulses `pulses` more times (classes with burst: true)
export const SPILL_FLOOR = 1.2; // (a light flurry hit still spills a real hit: fodder die to ~one typical chain hit) // spill procs per hero per tick

const hittable = (e) => !e.dead && !e.boss && !e.dummy && !e.untargetable && !(e.invuln > 0) && !e.ally;

/** a spill hit: the real hit pipeline (class on-hit rules, resources, stacks, crits) as a secondary hit (`clone`: no
 *  Backstab / Mark pop / crit pips / lifesteal from it), at share `f` of the source hit's multiplier, no knockback */
function hurt(sim, p, t, o, f, rg) {
  hitEnemy(sim, p, t, { mul: Math.max(o.mul || 0, SPILL_FLOOR) * f, spill: 1, clone: true, basic: o.basic, kb: 0, hitstop: 2, stagger: 4, style: 'spill', resGain: rg });
}
function nearest(sim, x, y, r, skip) {
  let best = null, bd = r * r;
  for (const e of sim.enemies) {
    if (skip.has(e.id) || !hittable(e)) continue;
    const dx = e.x - x, dy = e.y - y; if (Math.abs(dx) > r + e.r || Math.abs(dy) > r + e.r) continue;
    const d = dx * dx + dy * dy - e.r * e.r; if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function inRadius(sim, x, y, r, skip, n) {
  const out = [];
  for (const e of sim.enemies) {
    if (skip.has(e.id) || !hittable(e)) continue;
    const dx = e.x - x, dy = e.y - y, rr = r + e.r; if (Math.abs(dx) > rr || Math.abs(dy) > rr || dx * dx + dy * dy > rr * rr) continue;
    out.push([dx * dx + dy * dy, e]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out.slice(0, n).map((a) => a[1]);
}
function inLineSeg(sim, x, y, ang, len, w, skip, n) {
  const c = Math.cos(ang), s = Math.sin(ang), out = [];
  for (const e of sim.enemies) {
    if (skip.has(e.id) || !hittable(e)) continue;
    const dx = e.x - x, dy = e.y - y, along = dx * c + dy * s; if (along < -e.r || along > len + e.r) continue;
    if (Math.abs(-dx * s + dy * c) > w / 2 + e.r) continue;
    out.push([along, e]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out.slice(0, n).map((a) => a[1]);
}
function inCone(sim, x, y, ang, r, arc, skip, n) {
  const out = [];
  for (const e of sim.enemies) {
    if (skip.has(e.id) || !hittable(e)) continue;
    const dx = e.x - x, dy = e.y - y, rr = r + e.r, d2 = dx * dx + dy * dy; if (Math.abs(dx) > rr || Math.abs(dy) > rr || d2 > rr * rr) continue;
    let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > arc / 2 && d2 > (e.r + 40) * (e.r + 40)) continue;
    out.push([d2, e]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out.slice(0, n).map((a) => a[1]);
}
const R = (v) => Math.round(v);
const R2 = (v) => Math.round(v * 100) / 100;

/** a live boss near the hero (boss fights stay exactly as they were: no spill, no chain bursts there) */
function bossNear(sim, p) {
  if (p.spBT === sim.tick) return p.spB;
  let b = false;
  for (const e of sim.enemies) if (e.boss && !e.dead && Math.abs(e.x - p.x) < HORDE_AOE_BOSS_R && Math.abs(e.y - p.y) < HORDE_AOE_BOSS_R) { b = true; break; }
  p.spBT = sim.tick; p.spB = b;
  return b;
}
/** master switch: tests of other mechanics' exact numbers turn it off; tools/balance use NOSPILL=1 for the 'before' runs */
export const HORDE_AOE_SWITCH = { on: true };
const off = () => !HORDE_AOE_SWITCH.on || globalThis.NOSPILL || (typeof process !== 'undefined' && process.env && process.env.NOSPILL);

/** the class shape from anchor (ex, ey) (the struck enemy, or the aim point for a chain burst), aimed along `ang` */
function fire(sim, p, A, ex, ey, ang, skip, o, kind, prim = null) {
  const hit = [], ev = { type: 'hEcho', pid: p.id, cls: p.cls, k: A.k, x: R(ex), y: R(ey), src: kind };
  if (A.k === 'warcry') { // Brakka: a cleave shockwave sweeps out from the hero along the swing, the ground quakes round the struck enemy
    for (const t of inCone(sim, p.x, p.y, ang, A.len, A.arc, skip, A.n)) { skip.add(t.id); hit.push([t, A.f]); }
    if (A.cry) for (const t of inRadius(sim, p.x, p.y, A.cry, skip, A.n - hit.length)) { skip.add(t.id); hit.push([t, A.f]); } // (the warcry itself: a roar ring round the hero, so a surrounded Warrior hits behind him too)
    for (const t of inRadius(sim, ex, ey, A.r, skip, A.n - hit.length)) { skip.add(t.id); hit.push([t, A.f]); }
    if (hit.length && prim && A.self && hittable(prim) && !prim.elite) hit.push([prim, A.self]); // (the quake is under the struck enemy too: only in a pack (the shape caught others), regular enemies only, never a boss, so single-target / elite fight lengths are unchanged)
    ev.hx = R(p.x); ev.hy = R(p.y); ev.ang = R2(ang); ev.len = A.len; ev.arc = A.arc; ev.r = A.r; if (A.cry) ev.cry = A.cry;
  } else if (A.k === 'volley') { // Sylva: the arrow splits into a fan of spirit arrows on through the line; now and then the spirit hawk strafes it
    const angs = [];
    for (let i = 0; i < A.split; i++) { const a = ang + A.spread * (i - (A.split - 1) / 2); angs.push(R2(a)); for (const t of inLineSeg(sim, ex, ey, a, A.len, A.w, skip, A.n - hit.length)) { skip.add(t.id); hit.push([t, A.f]); } }
    ev.ang = R2(ang); ev.angs = angs; ev.len = A.len; ev.w = A.w;
    const H = A.hawk;
    if (H && (kind === 'chain' || sim.tick - (p.hawkT ?? -1e9) >= H.cd)) { // the hawk dives from behind the hero, through the struck enemy and on
      const hx = p.x - Math.cos(ang) * 160, hy = p.y - Math.sin(ang) * 160, hits0 = hit.length;
      for (const t of inLineSeg(sim, hx, hy, ang, H.len, H.w, skip, A.n)) { skip.add(t.id); hit.push([t, H.f]); }
      if (hit.length && prim && H.self && hittable(prim) && !prim.elite) hit.push([prim, H.self]); // (the hawk dives through the struck enemy itself)
      if (hit.length > hits0 || kind === 'chain') { p.hawkT = sim.tick; ev.hawk = [R(hx), R(hy), H.len, H.w]; }
    }
  } else if (A.k === 'pages') { // Mirelle: grimoire pages whirl out round the struck enemy and slice everything in the storm
    for (const t of inRadius(sim, ex, ey, A.r, skip, A.n)) hit.push([t, A.f]);
    if (hit.length && prim && A.self && hittable(prim) && !prim.elite) hit.push([prim, A.self]); // (the storm shreds the struck enemy too)
    ev.r = A.r; ev.ang = R2(ang);
  } else if (A.k === 'quake' || A.k === 'splash' || A.k === 'starfall') { // (starfall: a star falls on the anchor, the impact bursts r)
    for (const t of inRadius(sim, ex, ey, A.r, skip, A.n)) hit.push([t, A.f]);
    ev.r = A.r;
    if (A.k === 'starfall') ev.ang = Math.round(ang * 100) / 100; // (the star streaks in along the cast)
  } else if (A.k === 'shock') {
    ev.x = R(p.x); ev.y = R(p.y); ev.r = A.r;
    for (const t of inRadius(sim, p.x, p.y, A.r, skip, A.n)) hit.push([t, A.f]);
  } else if (A.k === 'fissure') { // cracks radiating from the hero, the first one along the swing
    const angs = [];
    for (let i = 0; i < A.rays; i++) { const a = ang + (i * Math.PI * 2) / A.rays; angs.push(Math.round(a * 100) / 100); for (const t of inLineSeg(sim, p.x, p.y, a, A.len, A.w, skip, A.n - hit.length)) { skip.add(t.id); hit.push([t, A.f]); } }
    ev.x = R(p.x); ev.y = R(p.y); ev.angs = angs; ev.len = A.len; ev.w = A.w;
  } else if (A.k === 'wave' || A.k === 'pierce') {
    const ox = A.k === 'wave' ? p.x : ex, oy = A.k === 'wave' ? p.y : ey, angs = [];
    for (const da of A.fan || [0]) { const a = ang + da; angs.push(Math.round(a * 100) / 100); for (const t of inLineSeg(sim, ox, oy, a, A.len, A.w, skip, A.n - hit.length)) { skip.add(t.id); hit.push([t, A.f]); } }
    ev.x = R(ox); ev.y = R(oy); ev.ang = angs[0]; ev.angs = angs; ev.len = A.len; ev.w = A.w;
  } else { // marks / ripple / bounce / arc: jump from enemy to enemy (marks: all from the first mark)
    let ax = ex, ay = ey, f = A.f; const pts = [[R(ex), R(ey)]];
    for (let i = 0; i < A.n; i++) {
      const t = nearest(sim, ax, ay, A.r, skip);
      if (!t) break;
      skip.add(t.id); hit.push([t, f]); pts.push([R(t.x), R(t.y)]);
      if (A.decay) f *= A.decay;
      if (A.k !== 'marks') { ax = t.x; ay = t.y; }
    }
    ev.pts = pts;
  }
  if (!hit.length) return 0;
  ev.n = hit.length;
  sim.emit(ev);
  const lone = kind !== 'hit' && A.lone != null && hit.every(([t]) => t === hit[0][0]) ? A.lone : 1; // (a burst on a lone enemy: the old strength)
  if (lone > 0) for (const [t, f] of hit) if (!t.dead) hurt(sim, p, t, o, f * lone, A.resGain); // (resGain: a shape with many spill hits per proc builds less resource per hit)
  return hit.length;
}

/** a hero's hit landed on `e` for `dmg` (combat.hitEnemy): spill into the crowd */
export function hordeSpill(sim, p, e, o, dmg) {
  const A = HORDE_AOE[p.cls];
  if (!A || sim.predicting || o.spill || o.dot || e.boss || e.dummy || !(dmg > 0) || off()) return 0;
  if (p.spT !== sim.tick) { p.spT = sim.tick; p.spN = 0; }
  if (p.spN >= HORDE_AOE_TICK_CAP) return 0;
  if (A.cd && sim.tick - (p.spCd ?? -1e9) < A.cd) return 0;
  if (bossNear(sim, p)) return 0;
  p.spN++; p.spCd = sim.tick;
  return fire(sim, p, A, e.x, e.y, Math.atan2(e.y - p.y, e.x - p.x), new Set([e.id]), o, 'hit', e);
}

/** a chain went off (player.startSkill): the class shape bursts out along the aim even before anything is in reach,
 *  so the heroes who fight up close still reach the crowd streaming in (HORDE_AOE_CHAIN scales it) */
export function hordeChainBurst(sim, p, chain) {
  const A0 = HORDE_AOE[p.cls];
  if (!A0 || A0.burst === false || sim.predicting || !chain || off() || bossNear(sim, p)) return 0;
  const C = HORDE_AOE_CHAIN, A = { ...A0, f: A0.f * C.f, r: A0.r && A0.r * C.size, len: A0.len && A0.len * C.size };
  const ang = p.aim ?? 0;
  let ex = p.x + Math.cos(ang) * C.reach, ey = p.y + Math.sin(ang) * C.reach; // anchor: the aim point / the nearest enemy round it
  const t = nearest(sim, ex, ey, C.reach * 1.6, new Set());
  if (t && !t.boss) { ex = t.x; ey = t.y; }
  const any = sim.enemies.some((e) => hittable(e) && Math.abs(e.x - p.x) < 900 && Math.abs(e.y - p.y) < 700);
  if (!any) return 0;
  const n = fire(sim, p, A, ex, ey, ang, new Set(), { mul: SPILL_FLOOR }, 'chain');
  if (C.pulses > 0) { // the burst lingers: it pulses again as the crowd streams into it
    const Z = sim.hordeAoe || (sim.hordeAoe = []);
    if (Z.length < 24) Z.push({ pid: p.id, A, x: ex, y: ey, ang, next: sim.tick + C.every, left: C.pulses });
  }
  return n;
}

/** per tick (sim.step): lingering chain bursts pulse */
export function updateHordeAoe(sim) {
  const Z = sim.hordeAoe;
  if (!Z || !Z.length || sim.predicting) return;
  for (let i = Z.length - 1; i >= 0; i--) {
    const z = Z[i];
    if (sim.tick < z.next) continue;
    const p = sim.players.get(z.pid);
    if (p && !p.dead && !bossNear(sim, p)) {
      fire(sim, p, z.A, z.x, z.y, z.ang, new Set(), { mul: SPILL_FLOOR }, 'pulse');
    }
    z.next = sim.tick + HORDE_AOE_CHAIN.every;
    if (--z.left <= 0 || !p || p.dead) Z.splice(i, 1);
  }
}

const PHRASE = {
  fissure: (A) => `every hit on a regular enemy cracks the ground: ${A.rays} molten fissures race ${A.len} px out from you`,
  shock: (A) => `every hit on a regular enemy sends a holy shockwave ${A.r} px round you`,
  marks: (A) => `every hit on a regular enemy marks it and your shadow dashes to the nearest enemies within ${A.r} px`,
  wave: (A) => `every hit on a regular enemy looses ${(A.fan || [0]).length} iaido crescents ${A.len} px along the cut`,
  pierce: (A) => `every hit on a regular enemy drives ${(A.fan || [0]).length} lances ${A.len} px on through the line`,
  ripple: (A) => `every hit on a regular enemy sends a chi palm bouncing enemy to enemy (${A.r} px hops)`,
  bounce: (A) => `arrows that hit a regular enemy ricochet to ${A.n === 1 ? 'one more enemy' : A.n + ' more enemies'} within ${A.r} px`,
  arc: (A) => `spells that hit a regular enemy lash lightning on to ${A.n} more within ${A.r} px`,
  starfall: (A) => `every spell that hits a regular enemy calls a falling star down on it: the impact bursts ${A.r} px round it`,
  splash: (A) => `hits on a regular enemy splash ink ${A.r} px round it`,
  warcry: (A) => `every hit on a regular enemy looses a warcry: it roars ${A.cry} px round you, a cleave shockwave sweeps ${A.len} px out along your swing and the ground quakes ${A.r} px round the enemy`,
  volley: (A) => `arrows that hit a regular enemy (at most every ${+(A.cd / 60).toFixed(2)} s) split into ${A.split} spirit arrows ${A.len} px on through the line, and your spirit hawk strafes ${A.hawk.len} px down the line (every chain, else every ${(A.hawk.cd / 60).toFixed(2).replace(/0$/, '')} s)`,
  pages: (A) => `hits on a regular enemy tear loose a storm of grimoire pages that slices everything ${A.r} px round it`,
};
/** tooltip line for the class's horde AoE (client/tooltips.js), or null */
export function hordeAoeText(cls) {
  const A = HORDE_AOE[cls]; if (!A) return null;
  const C = HORDE_AOE_CHAIN, pct = Math.round(A.f * 100);
  const many = A.k !== 'bounce' && A.k !== 'arc';
  let s = `${A.name}: ${PHRASE[A.k](A)}${many ? `, up to ${A.n} enemies` : ''}, at ${pct}% of the hit's power (at least ×${+(SPILL_FLOOR * A.f).toFixed(2)} ATK).`;
  if (A.burst !== false) s += ` Each chain bursts it out along your aim (+${Math.round((C.size - 1) * 100)}% size), and it pulses ${C.pulses} more times as the horde streams in.`;
  return s + ' Never on bosses or during boss fights.';
}
