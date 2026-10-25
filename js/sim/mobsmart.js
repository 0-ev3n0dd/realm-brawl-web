// Part A3 — smarter normal / elite mobs (docs/ASCENSION-PLAN.md). Runs after each mob's own behaviour (sim/ai.js
// updateEnemy, biome AIs included: they opt in by role), never for bosses, raid bosses, ops bosses, the dummy or horde
// fodder. HP is untouched (sim/mobhp.js stays the one source of truth: tankier mobs on harder maps kept). No sim.rng draws
// (seeded runs - the intro's beat plan - stay identical); the cheap scans run every 6 ticks.
//   roles: bruiser (big telegraphed slam), archer (focus the lowest-HP hero, volley a stunned / rooted one),
//          caster (keeps range, steps out of telegraphs), skirmisher (flanks), support (buffs the nearest bruiser;
//          kill it first while its pack lives -> +PRIORITY bonus XP / loot)
import { addArea } from './combat.js';
import { DT } from './constants.js';

export const ROLE_BY_AI = {
  slammer: 'bruiser', knight: 'bruiser', sentinel: 'bruiser', construct: 'bruiser', brute: 'bruiser', charger: 'bruiser', yeti: 'bruiser', mummy: 'bruiser',
  archer: 'archer', shardwisp: 'archer', turret: 'archer', mortar: 'archer',
  caster: 'caster', rimewraith: 'caster', spinner: 'caster', spiral: 'caster', mirage: 'caster', eel: 'caster', moth: 'caster',
  sunpriest: 'support', shaman: 'support', acolyte: 'support', kindler: 'support',
  pack: 'skirmisher', hopper: 'skirmisher', burrower: 'skirmisher', rusher: 'skirmisher', scarab: 'skirmisher', thrall: 'skirmisher', slider: 'skirmisher',
};
export const SMART = {
  scan: 6,                         // ticks between scans
  slam: { every: 330, tell: 66, r: 120, mul: 1.6 },  // bruiser big hit: red circle, 1.1 s tell
  buff: { every: 360, t: 240, mul: 1.2, r: 320 },     // support -> bruiser
  focusHp: 0.45, focusR: 560,       // archers switch to a hero under 45% HP within range
  flank: 0.65,                      // skirmisher approach offset (rad)
  dodge: { spd: 0.7 },              // step out of a hero's telegraphed (delayed) area
  priority: 0.25,                   // +25% XP (and +loot chance) for killing a support while its pack lives
  // Part C2: Astral World mobs (e.astral) think harder: every role reads hero telegraphs, archers AND casters focus a
  // hero under 60%, bruisers slam more often and follow up with an Astral echo ring (stand still = hit; step in or out),
  // skirmishers flank wider. HP / damage stay where sim/astral.js put them.
  astral: { focusHp: 0.6, slamEvery: 0.7, echo: { r0: 125, r: 250, after: 40, mul: 0.8 }, flank: 0.85 },
};
const hash = (n) => { let x = (n | 0) * 2654435761; x ^= x >>> 13; return ((x >>> 0) % 1000) / 1000; };
export const roleOf = (e, d) => (d && d.role) || ROLE_BY_AI[e.ai] || null;
export const smartOk = (e) => !(e.boss || e.raid || e.opsBoss || e.opsAi || e.dummy || e.horde || e.summonOf);

/** called once at spawn */
export function smartInit(e, d) {
  if (!smartOk(e)) return;
  const r = roleOf(e, d); if (!r) return;
  e.role = r; e.baseDmg = e.dmg; e.sm = { t: Math.floor(hash(e.id) * 120), slam: 120 + Math.floor(hash(e.id + 7) * 200), buff: 90 };
}
/** pick the target (archers focus the weakest hero in range) */
export function smartTarget(sim, e, t) {
  if (!t || !e.role || !(e.role === 'archer' || (e.astral && e.role === 'caster')) || (e.taunt && e.taunt.t > 0) || t.kind !== 'player') return t;
  let best = t, bh = t.hp / (t.stats ? t.stats.maxHp : 1); const fh = e.astral ? SMART.astral.focusHp : SMART.focusHp;
  for (const p of sim.players.values()) {
    if (p.dead || p.stealth > 0 || p === t) continue;
    const h = p.hp / p.stats.maxHp;
    if (h < fh && h < bh && Math.hypot(p.x - e.x, p.y - e.y) < SMART.focusR) { best = p; bh = h; }
  }
  return best;
}
/** after the mob's own behaviour */
export function smartTick(sim, e, t) {
  const S = e.sm; if (!S || e.dead) return;
  S.t++;
  // damage multiplier from buffs / commander aura / commander-death debuff (recomputed, never stacks)
  let mul = 1;
  if (e.buffT > 0) { e.buffT--; mul *= SMART.buff.mul; }
  if (e.cmdAura > 0) { e.cmdAura--; mul *= 1.15; }
  if (e.cmdDebuff > 0) { e.cmdDebuff--; mul *= 0.8; }
  e.dmg = e.baseDmg * mul;
  if (!t) return;
  const d = Math.hypot(t.x - e.x, t.y - e.y), a = Math.atan2(t.y - e.y, t.x - e.x);
  // flanking: skirmishers curve in from the side
  if (e.role === 'skirmisher' && d > 110 && d < 700 && e.state !== 'lunge' && e.state !== 'dash' && e.state !== 'charge' && e.spd > 0 && !e.cc.rooted) {
    const side = hash(e.id + 3) < 0.5 ? -1 : 1, fl = e.astral ? SMART.astral.flank : SMART.flank; e.x += Math.cos(a + side * fl) * e.spd * 0.25 * DT; e.y += Math.sin(a + side * fl) * e.spd * 0.25 * DT;
  }
  // bruiser: a big telegraphed slam (red, the A1 'away' cue)
  if (e.role === 'bruiser' && --S.slam <= 0 && d < 260) {
    S.slam = Math.round(SMART.slam.every * (e.astral ? SMART.astral.slamEvery : 1));
    addArea(sim, { team: 'enemy', ownerId: e.id, kind: 'mobslam', cue: 'away', shape: 'circle', x: Math.round(t.x), y: Math.round(t.y), r: SMART.slam.r, delay: SMART.slam.tell, dmg: e.dmg * SMART.slam.mul, by: e.name, kb: 260 });
    if (e.astral) { const E = SMART.astral.echo; addArea(sim, { team: 'enemy', ownerId: e.id, kind: 'astecho', cue: 'away', shape: 'donut', x: Math.round(t.x), y: Math.round(t.y), r0: E.r0, r: E.r, delay: SMART.slam.tell + E.after, dmg: e.dmg * SMART.slam.mul * E.mul, by: e.name + ' (Astral echo)', kb: 200 }); } // (C2: the echo ring right after: the slam's centre is safe again)
    sim.emit({ type: 'mobTell', k: 'slam', id: e.id, x: Math.round(t.x), y: Math.round(t.y), r: SMART.slam.r, t: SMART.slam.tell });
  }
  // archer: volley a stunned / rooted hero
  if (e.role === 'archer' && t.kind === 'player' && ((t.cc && (t.cc.stun > 0 || t.cc.rooted)) || t.stun > 0) && e.cd > 12) e.cd = 12;
  if (S.t % SMART.scan) return;
  // support: buff the nearest bruiser
  if (e.role === 'support' && (S.buff -= SMART.scan) <= 0) {
    let best = null, bd = SMART.buff.r;
    for (const o of sim.enemies) if (!o.dead && o !== e && o.role === 'bruiser') { const q = Math.hypot(o.x - e.x, o.y - e.y); if (q < bd) { bd = q; best = o; } }
    if (best) { best.buffT = SMART.buff.t; S.buff = SMART.buff.every; sim.emit({ type: 'mobTell', k: 'buff', id: best.id, from: e.id, x: Math.round(best.x), y: Math.round(best.y) }); }
  }
  // telegraph awareness: step out of a hero's area that has not landed yet (casters + elites)
  if ((e.role === 'caster' || e.elite || e.astral) && e.spd > 0 && !e.cc.rooted && sim.areas.length) {
    for (const ar of sim.areas) {
      if (ar.team !== 'player' || ar.dead || ar.heal || ar.noDamage || (ar.t || 0) >= (ar.delay || 0) || !ar.r || ar.r > 400) continue;
      const q = Math.hypot(e.x - ar.x, e.y - ar.y);
      if (q < ar.r + e.r) { const aa = Math.atan2(e.y - ar.y, e.x - ar.x); e.x += Math.cos(aa) * e.spd * SMART.dodge.spd * DT * SMART.scan; e.y += Math.sin(aa) * e.spd * SMART.dodge.spd * DT * SMART.scan; e.dodged = (e.dodged | 0) + 1; break; }
    }
  }
}
/** target-priority bonus: a support killed while a bruiser / pack mate lives nearby */
export function priorityBonus(sim, e) {
  if (e.role !== 'support') return 0;
  for (const o of sim.enemies) if (!o.dead && o !== e && o.role && !o.boss && Math.hypot(o.x - e.x, o.y - e.y) < 500) return SMART.priority;
  return 0;
}
