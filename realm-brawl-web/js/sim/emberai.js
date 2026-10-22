// Emberdeep Caldera + Forge of Cinders enemy behaviours (looked up by sim/ai.js at run time: no load-order cycle).
// Every attack is telegraphed (a wind-up state and/or a ground area), like the other biomes.
//   kindler   : Cinder Imp: skitters at mid range lobbing firebombs that leave BURNING POOLS; under 35% HP it KINDLES:
//               sprints at you with a fuse ring and explodes (kill it first or step away)
//   cooler    : Basalt Golem: MOLTEN (fast, soft: takes +40%, drips lava) <-> HARDENED (a statue shell: takes 30%, then
//               it CRACKS: a slam + a ring of basalt shards). Hitting it while molten makes it harden early
//   moth      : Ember Moth: circles you at range sowing EMBER MINES that hang in the air, then dives along a lane
//   eel       : Magma Eel: swims under the ash (untargetable), surfaces under you leaving a lava pool, spits a magma arc
//               that splits in three where it lands
//   mortar    : Ashen Bombardier: keeps far back; WALKING BARRAGE (shells march from it toward you and past you)
//   thrall    : (Forge) chained smith: a three-blow hammer combo of growing cones; a dying thrall enrages its kin
//   construct : (Forge) Slag Construct: curls into a ball and PINBALLS along a lane (bounces off walls up to 3 times,
//               leaving fire), then unfolds and fires a ring
//   bubble    : Vitrea's glass bubbles: drift at you; a touch ENCASES the hero (break it from inside or let allies
//               break it) before it SHATTERS
// World bosses (each in its own arena, walk home + heal when nobody is near):
//   Vitrea, the Glassblower (Danger 5): GLASS BUBBLES (encase), MIRROR PANES (her bolts reflect off them; then they
//     ANNEAL red-hot and burst), BLOWPIPE (a slow sweeping beam), phase 2: SHATTERSTORM (every pane bursts at once +
//     a bubble per hero)
//   Solgrim, the Ember Sundial (Danger 6): a burning SUN circles the arena; SOLAR FLARE burns everyone who is not
//     standing in the shadow of a gnomon (the shadows swing round as the sun moves), HOUR STRIKE (the dial's hour
//     sectors ignite), NOON (phase 2: the sun stands overhead, no shadows: the only shade is under Solgrim himself)
//   Pyrrhex, the Caldera Heart (Danger 7, the Overlord): HEARTBEAT (shock rings on a rhythm, every 4th beat a double),
//     MAGMA TIDE (lava floods the crater except one rotating safe wedge), ERUPTION (basalt shelters rise: hide under
//     one before the sky rains fire), phase 3: THE FLOOR IS LAVA (only four drifting obsidian rafts are safe)
import { AIH, spawnEnemy } from './ai.js';
import { cancelAreasOf, spawnProjectile, addArea, damagePlayer, evadeShove } from './combat.js';
import { pointBlocked } from './world.js';
import { DT } from './constants.js';
import { gnomons } from './embergen.js';

const TAU = Math.PI * 2;
const H = () => AIH;
const r0 = (v) => Math.round(v);
const r2 = (v) => Math.round(v * 100) / 100;
export function fireFrom(sim, e, x, y, ang, speed, o = {}) {
  return spawnProjectile(sim, {
    team: 'enemy', ownerId: e.id, x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: o.r || 9, life: o.life || 160,
    dmg: e.dmg * (o.mul ?? 1), homing: o.homing || 0, accel: o.accel || 0, style: o.style || 'ember', color: o.color || null, kb: o.kb || 70, by: e.name,
    ...(o.halt ? { halt: { ...o.halt }, sync: 1 } : {}), ...(o.split ? { split: o.split } : {}),
  });
}
function ev(sim, ph, o) { sim.emit({ type: 'ember', ph, ...o }); }
function bounceOff(sim, e) { // reflect e.lock off walls / props (the construct's pinball roll)
  const nx = e.x + Math.cos(e.lock) * (e.r + 14), ny = e.y + Math.sin(e.lock) * (e.r + 14);
  if (!pointBlocked(sim.world, nx, ny, e.r * 0.6)) return false;
  const bx = pointBlocked(sim.world, e.x + Math.cos(e.lock) * (e.r + 14), e.y, e.r * 0.6), by = pointBlocked(sim.world, e.x, e.y + Math.sin(e.lock) * (e.r + 14), e.r * 0.6);
  let vx = Math.cos(e.lock), vy = Math.sin(e.lock);
  if (bx || !by) vx = -vx; if (by || !bx) vy = -vy;
  e.lock = Math.atan2(vy, vx);
  ev(sim, 'bounce', { id: e.id, x: r0(e.x), y: r0(e.y) });
  return true;
}
const firePool = (sim, e, x, y, r = 70, n = 5) => H().area(sim, e, { shape: 'circle', x, y, r, delay: 34, pulses: n, every: 22, mul: 0.3, kb: 0, kind: 'firepool' });

export const EMBER_AI = {
  kindler(sim, e, t) {
    const { setState, angTo, dTo, move, area, kite } = H();
    const d = dTo(e, t);
    if (e.state === 'kindle') { // the fuse: sprint at the target, explode at the end
      move(e, angTo(e, t), 1.6);
      if (e.st >= 66) { area(sim, e, { shape: 'circle', x: e.x, y: e.y, r: 120, delay: 1, mul: 1.6, kb: 380, stun: 12, kind: 'kindleboom' }); ev(sim, 'kindle', { x: r0(e.x), y: r0(e.y) }); e.dead = true; e.hp = 0; e.xp = Math.round(e.xp * 0.5); if (!e.summonOf) for (let i = 0; i < 2; i++) { const a = sim.rng.next() * TAU, c = spawnEnemy(sim, 'cinderling', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40, { tier: e.zone }); c.summonOf = e.id; c.xp = 20; c.dropChance = 0; if (e.forgeWave && sim.forge) { c.forgeWave = 1; sim.forge.alive.push(c.id); } } } // (its embers scatter as two hopping Cinderlings)
      return;
    }
    if (e.hp < e.maxHp * 0.35 && !e.kindled) { e.kindled = 1; setState(e, 'kindle'); area(sim, e, { shape: 'circle', x: e.x, y: e.y, r: 120, delay: 66, visual: true, kind: 'fuse', follow: e.id }); ev(sim, 'fuse', { id: e.id, x: r0(e.x), y: r0(e.y) }); return; }
    if (e.state === 'throw') {
      if (e.st === 1) { e.tx = t.x + t.vx * 0.4; e.ty = t.y + t.vy * 0.4; area(sim, e, { shape: 'circle', x: e.tx, y: e.ty, r: 70, delay: 40, mul: 1.0, kb: 200, stun: 6, kind: 'firebomb' }); }
      if (e.st === 41) firePool(sim, e, e.tx, e.ty, 64, 4);
      if (e.st >= 56) { setState(e, 'idle'); e.cd = 70 + Math.floor(sim.rng.next() * 50); }
      return;
    }
    kite(sim, e, t, 150, 270, 1.05);
    if (e.cd <= 0 && d < 470) setState(e, 'throw');
  },
  cooler(sim, e, t) {
    const { setState, angTo, dTo, move, area, ring, contact } = H();
    const d = dTo(e, t);
    if (e.state === 'idle' && !e.mode) { e.mode = 'molten'; e.mt = 0; e.mhp = e.hp; }
    e.mt = (e.mt || 0) + 1;
    if (e.state === 'harden') { // the shell: barely hurt, then it cracks
      e.takeMul = 0.3;
      if (e.st === 1) ev(sim, 'harden', { id: e.id, x: r0(e.x), y: r0(e.y) });
      if (e.st === 84) area(sim, e, { shape: 'circle', x: e.x, y: e.y, r: 160, delay: 36, mul: 1.45, kb: 420, stun: 14, kind: 'crack', follow: e.id });
      if (e.st === 120) { ring(sim, e, e.elite ? 16 : 12, 230, sim.rng.next(), { r: 10, style: 'basalt', mul: 0.6 }); ev(sim, 'crack', { id: e.id, x: r0(e.x), y: r0(e.y) }); }
      if (e.st >= 140) { e.takeMul = 1.4; e.mode = 'molten'; e.mt = 0; e.mhp = e.hp; setState(e, 'idle'); e.cd = 30; }
      return;
    }
    e.takeMul = 1.4; // molten: soft
    if (e.state === 'smash') {
      if (e.st === 1) { e.lock = angTo(e, t); area(sim, e, { shape: 'cone', x: e.x, y: e.y, ang: e.lock, arc: 1.5, r: 170, delay: 34, mul: 1.3, kb: 360, stun: 10, kind: 'smash' }); }
      if (e.st >= 56) { setState(e, 'idle'); e.cd = 60; }
      return;
    }
    if (d > 150) move(e, angTo(e, t), 1.3); else move(e, angTo(e, t) + Math.PI / 2, 0.4);
    contact(sim, e, t, 0.9, 260);
    if (e.mt % 30 === 0) firePool(sim, e, e.x, e.y, 46, 3); // dripping lava
    if (e.mt > 260 || e.hp < (e.mhp || e.maxHp) - e.maxHp * 0.2) { setState(e, 'harden'); return; } // (hit hard while molten: it hardens early)
    if (e.cd <= 0 && d < 200) setState(e, 'smash');
  },
  moth(sim, e, t) {
    const { setState, angTo, dTo, move, area, contact } = H();
    const d = dTo(e, t);
    switch (e.state) {
      case 'wind':
        if (e.st === 1) { e.lock = angTo(e, t); area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.lock, len: 420, w: e.r * 2 + 14, delay: 30, visual: true, kind: 'dive' }); }
        if (e.st >= 30) { setState(e, 'dash'); e.hitDone = false; }
        return;
      case 'dash':
        e.face = e.lock; e.x += Math.cos(e.lock) * 26; e.y += Math.sin(e.lock) * 26;
        if (!e.hitDone && contact(sim, e, t, 1.15, 260, 8)) e.hitDone = true;
        if (e.st >= 16) { setState(e, 'idle'); e.cd = 110 + Math.floor(sim.rng.next() * 50); }
        return;
      default: { // circle the target, sowing hanging ember mines
        const a = angTo(e, t), dir = e.id % 2 ? 1 : -1, want = 230;
        move(e, a + Math.PI / 2 * dir + (d > want ? -0.5 * dir : 0.5 * dir), 1);
        if (e.st % 14 === 0) fireFrom(sim, e, e.x, e.y, a + Math.PI, 30, { r: 8, mul: 0.5, life: 200, style: 'mine', halt: { at: 6, hold: 150, mode: 'resume' } });
        if (e.cd <= 0 && d < 420) setState(e, 'wind');
      }
    }
  },
  eel(sim, e, t) {
    const { setState, angTo, dTo, move, area } = H();
    switch (e.state) {
      case 'under': // swim under the ash toward the target
        e.untargetable = 1; move(e, angTo(e, t), 1.6);
        if (e.st >= 70 || dTo(e, t) < 24) { setState(e, 'erupt'); e.tx = t.x; e.ty = t.y; area(sim, e, { shape: 'circle', x: e.tx, y: e.ty, r: 90, delay: 40, mul: 1.35, kb: 360, stun: 12, kind: 'eelerupt' }); }
        return;
      case 'erupt':
        if (e.st < 40) { const dx = e.tx - e.x, dy = e.ty - e.y, dd = Math.hypot(dx, dy); if (dd > 4) { e.x += dx / dd * Math.min(dd, 6); e.y += dy / dd * Math.min(dd, 6); } }
        if (e.st === 40) { e.untargetable = 0; e.x = e.tx; e.y = e.ty; firePool(sim, e, e.x, e.y, 80, 6); ev(sim, 'eel', { x: r0(e.x), y: r0(e.y) }); }
        if (e.st === 62) { const a = angTo(e, t); fireFrom(sim, e, e.x, e.y, a, 240, { r: 13, mul: 0.9, life: 70, style: 'magma', split: { n: 3, sp: 220, spread: 0.6 } }); }
        if (e.st >= 100) { setState(e, 'idle'); e.cd = 60 + Math.floor(sim.rng.next() * 40); }
        return;
      default:
        e.untargetable = 0;
        move(e, angTo(e, t) + 0.5 * (e.id % 2 ? 1 : -1), 0.8);
        if (e.cd <= 0) { setState(e, 'under'); ev(sim, 'dive', { id: e.id, x: r0(e.x), y: r0(e.y) }); }
    }
  },
  mortar(sim, e, t) {
    const { setState, angTo, dTo, area, kite } = H();
    if (e.state === 'barrage') { // shells march from the bombardier toward the target and past it
      if (e.st === 1) { const a = angTo(e, t), d = dTo(e, t), n = e.elite ? 6 : 5; for (let i = 0; i < n; i++) { const k = (i + 1) / (n - 1) * d * 1.05; area(sim, e, { shape: 'circle', x: e.x + Math.cos(a) * k, y: e.y + Math.sin(a) * k, r: 78, delay: 46 + i * 12, mul: 1.15, kb: 240, stun: 8, kind: 'shell' }); } ev(sim, 'barrage', { id: e.id, x: r0(e.x), y: r0(e.y) }); }
      if (e.st >= 46 + 6 * 12 + 14) { setState(e, 'idle'); e.cd = 120 + Math.floor(sim.rng.next() * 50); }
      return;
    }
    if (e.state === 'flare') {
      if (e.st === 1) { e.tx = t.x; e.ty = t.y; area(sim, e, { shape: 'circle', x: e.tx, y: e.ty, r: 130, delay: 60, mul: 1.3, kb: 300, stun: 10, kind: 'shell' }); }
      if (e.st === 61) { const o = sim.rng.next(); for (let i = 0; i < 8; i++) fireFrom(sim, e, e.tx, e.ty, o + (i / 8) * TAU, 210, { r: 8, mul: 0.55 }); }
      if (e.st >= 80) { setState(e, 'idle'); e.cd = 90; }
      return;
    }
    kite(sim, e, t, 360, 520, 0.9);
    if (e.cd <= 0 && dTo(e, t) < 700) setState(e, (e.attackIdx++ % 3 === 2) ? 'flare' : 'barrage');
  },
  thrall(sim, e, t) {
    const { setState, angTo, dTo, move, area } = H();
    const d = dTo(e, t), sp = e.rage ? 1.35 : 1;
    if (e.state === 'combo') { // three blows, each a wider cone
      const k = Math.floor((e.st - 1) / 30), s = (e.st - 1) % 30;
      if (k < 3 && s === 0) { e.lock = angTo(e, t); area(sim, e, { shape: 'cone', x: e.x, y: e.y, ang: e.lock, arc: 1.1 + k * 0.4, r: 140 + k * 30, delay: 24, mul: 1 + k * 0.2, kb: 220 + k * 80, stun: 6 + k * 3, kind: 'hammer' }); }
      if (k < 3 && s < 20) e.x += Math.cos(e.lock) * 2.2;
      if (e.st >= 100) { setState(e, 'idle'); e.cd = r0(70 / sp); }
      return;
    }
    if (d > 130) move(e, angTo(e, t), sp); else move(e, angTo(e, t) + Math.PI / 2, 0.4);
    if (e.cd <= 0 && d < 190) setState(e, 'combo');
  },
  construct(sim, e, t) {
    const { setState, angTo, dTo, move, area, ring, contact } = H();
    switch (e.state) {
      case 'wind':
        if (e.st === 1) { e.lock = angTo(e, t); e.bn = 0; area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.lock, len: 520, w: e.r * 2 + 12, delay: 36, visual: true, kind: 'roll' }); }
        if (e.st >= 36) { setState(e, 'roll'); e.hitDone = false; }
        return;
      case 'roll':
        e.face = e.lock; move(e, e.lock, 5.4);
        if (e.bn < 3 && bounceOff(sim, e)) { e.bn++; e.hitDone = false; }
        if (!e.hitDone && contact(sim, e, t, 1.2, 300, 10)) e.hitDone = true;
        if (e.st % 8 === 0) firePool(sim, e, e.x, e.y, 40, 3);
        if (e.st >= 60) setState(e, 'unfold');
        return;
      case 'unfold':
        if (e.st === 20) ring(sim, e, e.elite ? 12 : 8, 220, sim.rng.next(), { r: 9, style: 'ember', mul: 0.6 });
        if (e.st >= 46) { setState(e, 'idle'); e.cd = 80 + Math.floor(sim.rng.next() * 40); }
        return;
      default:
        move(e, angTo(e, t), 0.7);
        if (e.cd <= 0 && dTo(e, t) < 520) setState(e, 'wind');
    }
  },
  bubble(sim, e) { bubbleUpdate(sim, e); },
  vitrea(sim, e, t) { vitreaUpdate(sim, e, t); },
  solgrim(sim, e, t) { solgrimUpdate(sim, e, t); },
  pyrrhex(sim, e, t) { pyrrhexUpdate(sim, e, t); },
};

// ------------------------------------------------------------------ shared boss helpers
function phaseCheck(sim, e, gates, roar = 70) {
  const { setState, angTo, dTo } = H();
  const pct = e.hp / e.maxHp; let want = 1; for (const g of gates) if (pct <= g) want++;
  if (want <= e.phase) return false;
  e.phase = want; cancelAreasOf(sim, e); setState(e, 'roar'); e.invuln = 0; e.untargetable = 0; // (game loop C: no invulnerable roar; the phase change is a breather on HP only)
  for (const pr of sim.projectiles) if (pr.ownerId === e.id) pr.dead = true;
  sim.emit({ type: 'bossPhase', phase: e.phase, x: e.x, y: e.y, id: e.id });
  ev(sim, 'roar', { etype: e.type, phase: e.phase, x: r0(e.x), y: r0(e.y) });
  for (const p of sim.players.values()) if (!p.dead && dTo(e, p) < 320 && !evadeShove(sim, p)) { const a = angTo(e, p); p.vx += Math.cos(a) * 820; p.vy += Math.sin(a) * 820; }
  return true;
}
const inArena = (e, p, pad = 140) => Math.hypot(p.x - e.arena.x, p.y - e.arena.y) < e.arena.r + pad;
const arenaPlayers = (sim, e) => [...sim.players.values()].filter((p) => !p.dead && inArena(e, p));
function call(sim, e, txt, sub, col = '#ffcf8a') { ev(sim, 'call', { etype: e.type, txt, sub, col, x: r0(e.x), y: r0(e.y) }); }
function summonAdds(sim, e, list, ring = 180) {
  list.forEach((k, i) => {
    const a = (i / list.length) * TAU + sim.rng.next(), m = spawnEnemy(sim, k, e.x + Math.cos(a) * ring, e.y + Math.sin(a) * ring, { tier: e.zone, mul: 1.6, zoneHp: false });
    m.summonOf = e.id; m.xp = Math.round(m.xp * 0.3); m.dropChance = 0.08; m.homeX = e.homeX; m.homeY = e.homeY;
    sim.emit({ type: 'teleport', x: m.x, y: m.y, id: m.id });
  });
}
/** environment / mechanic damage as a % of max HP (no owner stats) */
function burn(sim, e, p, pct, by, src = null, o = {}) { return damagePlayer(sim, p, 0, src, { pct, by, kb: src ? (o.kb ?? 200) : 0, stun: o.stun || 0 }); }

// ------------------------------------------------------------------ Vitrea, the Glassblower
const GROT = { 1: ['bolts', 'bubbles', 'panes', 'bolts', 'pipe', 'bubbles'], 2: ['panes', 'bubbles', 'bolts', 'storm', 'pipe', 'bolts', 'bubbles'] };
export const PANE = { len: 240, life: 600, anneal: 70 };
/** a pane as a segment */
const paneSeg = (a) => ({ x1: a.x - Math.cos(a.ang) * a.len / 2, y1: a.y - Math.sin(a.ang) * a.len / 2, x2: a.x + Math.cos(a.ang) * a.len / 2, y2: a.y + Math.sin(a.ang) * a.len / 2 });
/** reflect a projectile off any mirror pane it crosses this tick (Vitrea's bolts only) */
export function reflectPanes(sim, e) {
  const panes = sim.areas.filter((a) => a.kind === 'pane' && a.ownerId === e.id && !a.dead);
  if (!panes.length) return;
  for (const pr of sim.projectiles) {
    if (pr.dead || pr.ownerId !== e.id || pr.style !== 'glass') continue;
    for (const a of panes) {
      const s = paneSeg(a), nx = -Math.sin(a.ang), ny = Math.cos(a.ang);
      const d0 = (pr.px - a.x) * nx + (pr.py - a.y) * ny, d1 = (pr.x - a.x) * nx + (pr.y - a.y) * ny;
      if ((d0 > 0) === (d1 > 0) || (pr.refl || 0) >= 3) continue;
      const along = (pr.x - a.x) * Math.cos(a.ang) + (pr.y - a.y) * Math.sin(a.ang);
      if (Math.abs(along) > a.len / 2 + pr.r) continue;
      const vn = pr.vx * nx + pr.vy * ny; pr.vx -= 2 * vn * nx; pr.vy -= 2 * vn * ny; pr.x -= 2 * d1 * nx; pr.y -= 2 * d1 * ny; pr.sync = 1; pr.refl = (pr.refl || 0) + 1;
      ev(sim, 'reflect', { x: r0(pr.x), y: r0(pr.y), s: [r0(s.x1), r0(s.y1)] });
      break;
    }
  }
}
function bubbleUpdate(sim, e) {
  const o = sim.enemyById.get(e.summonOf);
  if (e.trap) { // a hero is encased: pin them; shatter at the end
    const p = sim.players.get(e.trap);
    if (!p || p.dead) { e.dead = true; e.hp = 0; return; }
    if (p.breakOut) { p.breakOut = 0; p.encased = 0; p.held = 0; e.dead = true; e.hp = 0; e.xp = 0; ev(sim, 'freed', { pid: p.id, x: r0(e.x), y: r0(e.y), dodge: 1 }); return; } // (a timed Dodge cracked it: no shatter)
    p.x = e.x; p.y = e.y; p.vx = p.vy = 0; p.encased = 1; // (pinned, but free to swing at the glass from inside)
    if (++e.tt >= 150) {
      burn(sim, o || e, p, 0.32, 'a shattering glass bubble', null, { stun: 10 }); p.encased = 0;
      ev(sim, 'shatter', { pid: p.id, x: r0(e.x), y: r0(e.y) });
      e.dead = true; e.hp = 0; e.xp = 0;
    }
    return;
  }
  if ((e.life = (e.life ?? 600) - 1) <= 0) { e.dead = true; e.hp = 0; e.xp = 0; ev(sim, 'pop', { x: r0(e.x), y: r0(e.y) }); return; }
  let best = null, bd = 1e9; for (const p of sim.players.values()) { if (p.dead || p.encased) continue; const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < bd) { bd = d; best = p; } }
  if (!best) return;
  const a = Math.atan2(best.y - e.y, best.x - e.x); e.x += Math.cos(a) * 58 * DT; e.y += Math.sin(a) * 58 * DT;
  if (bd < e.r + best.r * 0.6 && !(best.iframes > 0)) { e.trap = best.id; e.tt = 0; best.encased = 1; best.held = 1; best.holdAt = sim.tick; e.x = best.x; e.y = best.y; e.hp = e.maxHp = Math.round(e.maxHp * 0.8); ev(sim, 'encase', { pid: best.id, x: r0(e.x), y: r0(e.y) }); }
}
/** a bubble died while holding a hero: free them (combat kill hook) */
export function bubbleFree(sim, e) { if (e.trap) { const p = sim.players.get(e.trap); if (p) p.encased = 0; ev(sim, 'freed', { pid: e.trap, x: r0(e.x), y: r0(e.y) }); } }
function vitreaUpdate(sim, e, t) {
  const { setState, angTo, dTo, move, area } = H();
  reflectPanes(sim, e);
  if (e.bursts && e.bursts.length) { for (const b of e.bursts) if (b.at === sim.tick) { const o = sim.rng.next(); for (let i = 0; i < 10; i++) fireFrom(sim, e, b.x, b.y, o + (i / 10) * TAU, 230, { r: 9, style: 'glass', mul: 0.55, life: 120 }); sim.emit({ type: 'ember', ph: 'burst', x: r0(b.x), y: r0(b.y) }); } e.bursts = e.bursts.filter((b) => b.at > sim.tick); }
  // annealing panes: red-hot, then they burst along their length + a ring of glass
  for (const a of sim.areas) if (a.kind === 'pane' && a.ownerId === e.id && !a.dead && a.t === a.delay - PANE.anneal) annealPane(sim, e, a);
  if (phaseCheck(sim, e, [0.5])) { call(sim, e, 'THE KILN ROARS', 'Phase 2 · Shatterstorm: every pane bursts at once', '#7ff0e0'); return; }
  const A = e.arena, fast = e.phase >= 2 ? 0.8 : 1, st = e.st;
  switch (e.state) {
    case 'roar': if (st >= 70) { setState(e, 'idle'); e.cd = 30; } return;
    case 'bolts': // fans of molten-glass bolts: they ricochet off the mirror panes
      if (st === 10 || st === 34 || (e.phase >= 2 && st === 58)) { const a0 = angTo(e, t), n = e.phase >= 2 ? 7 : 5; for (let i = 0; i < n; i++) fireFrom(sim, e, e.x, e.y, a0 + (i - (n - 1) / 2) * 0.2, 300, { r: 10, style: 'glass', mul: 0.7, life: 200 }); }
      if (st >= 80) { setState(e, 'idle'); e.cd = r0(36 * fast); }
      return;
    case 'bubbles':
      if (st === 20) {
        const n = (e.phase >= 2 ? 3 : 2) + Math.max(0, arenaPlayers(sim, e).length - 1);
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU + sim.rng.next(), b = spawnEnemy(sim, 'glassorb', e.x + Math.cos(a) * 120, e.y + Math.sin(a) * 120, { tier: e.zone, zoneHp: false }); b.summonOf = e.id; b.xp = 10; b.dropChance = 0; b.homeX = b.x; b.homeY = b.y; b.life = 600; }
        call(sim, e, 'GLASS BUBBLES', 'A touch encases you · break out (or break your friends out) before it shatters', '#bff6ff');
      }
      if (st >= 50) { setState(e, 'idle'); e.cd = r0(40 * fast); }
      return;
    case 'panes': { // three mirror panes rise in the arena
      if (st === 1) {
        for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + sim.rng.next() * 0.8, rr = A.r * (0.45 + sim.rng.next() * 0.25); addArea(sim, { team: 'enemy', ownerId: e.id, shape: 'line', x: r0(A.x + Math.cos(a) * rr), y: r0(A.y + Math.sin(a) * rr), ang: r2(a + Math.PI / 2 + (sim.rng.next() - 0.5) * 0.7), len: PANE.len, w: 16, delay: PANE.life, visual: true, kind: 'pane' }); }
        call(sim, e, 'MIRROR PANES', 'Her bolts bounce off the glass · when a pane glows red it bursts', '#d8fffa');
        ev(sim, 'panes', { x: r0(A.x), y: r0(A.y) });
      }
      if (st >= 40) { setState(e, 'idle'); e.cd = r0(30 * fast); }
      return;
    }
    case 'pipe': { // the blowpipe: a slow sweeping beam (committed steps)
      if (st === 1) { e.lock = angTo(e, t) - 0.9 * (e.dir = sim.rng.next() < 0.5 ? 1 : -1); }
      if (st % 8 === 1 && st < 8 * 10) area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.lock + e.dir * 0.18 * Math.floor(st / 8), len: A.r + 200, w: 54, delay: 40, mul: 0.95, kb: 220, stun: 6, kind: 'pipe', committed: true });
      if (st >= 8 * 10 + 44) { setState(e, 'idle'); e.cd = r0(40 * fast); }
      return;
    }
    case 'storm': { // SHATTERSTORM: every pane anneals now; a bubble hunts each hero
      if (st === 1) {
        for (const a of sim.areas) if (a.kind === 'pane' && a.ownerId === e.id && !a.dead && a.t < a.delay - PANE.anneal) { a.delay = a.t + PANE.anneal + 1; a.storm = 1; }
        for (const p of arenaPlayers(sim, e)) { const b = spawnEnemy(sim, 'glassorb', e.x + (p.x - e.x) * 0.3, e.y + (p.y - e.y) * 0.3, { tier: e.zone, zoneHp: false }); b.summonOf = e.id; b.xp = 10; b.dropChance = 0; b.life = 520; }
        call(sim, e, 'SHATTERSTORM', 'Every pane bursts · keep away from the glass', '#7ff0e0');
        ev(sim, 'storm', { x: r0(A.x), y: r0(A.y) });
      }
      if (st >= 100) { setState(e, 'idle'); e.cd = r0(40 * fast); }
      return;
    }
    default: {
      const d = dTo(e, t);
      if (d > 260) move(e, angTo(e, t), 0.9); else if (d < 150) move(e, angTo(e, t) + Math.PI, 0.7);
      if (e.cd > 0) return;
      const rot = GROT[e.phase] || GROT[1]; setState(e, rot[e.attackIdx++ % rot.length]);
    }
  }
}
function annealPane(sim, e, a) {
  const s = paneSeg(a);
  addArea(sim, { team: 'enemy', ownerId: e.id, dmg: e.dmg * 1.2, by: e.name, shape: 'line', x: s.x1, y: s.y1, ang: a.ang, len: a.len, w: 110, delay: PANE.anneal, kb: 300, stun: 10, kind: 'anneal' });
  for (let i = 0; i < 2; i++) { const k = (i + 0.5) / 2; addArea(sim, { team: 'enemy', ownerId: e.id, visual: true, shape: 'circle', x: r0(s.x1 + (s.x2 - s.x1) * k), y: r0(s.y1 + (s.y2 - s.y1) * k), r: 40, delay: PANE.anneal, kind: 'redhot' }); }
  sim.emit({ type: 'ember', ph: 'anneal', x: r0(a.x), y: r0(a.y), d: PANE.anneal });
  a.burstAt = sim.tick + PANE.anneal;
  e.bursts = e.bursts || []; e.bursts.push({ at: sim.tick + PANE.anneal, x: a.x, y: a.y });
}

// ------------------------------------------------------------------ Solgrim, the Ember Sundial
// The SUN is a visual area (kind 'sun': x, y = arena centre, r = orbit radius, ang = start angle, spin = rad / tick), so
// the client works out where it is from the area clock alone; the flare test uses the same formula.
const SOROT = { 1: ['flare', 'hour', 'spit', 'tail', 'flare', 'hour'], 2: ['noon', 'flare', 'hour', 'spit', 'flare', 'tail', 'hour'] };
export const SUN = { orbit: 1.35, spin: 0.006, shadow: 340, warn: 150 };
export const sunPos = (a, t) => ({ x: a.x + Math.cos(a.ang + a.spin * t) * a.r, y: a.y + Math.sin(a.ang + a.spin * t) * a.r });
/** is (x, y) in the shadow a gnomon casts away from the sun at (sx, sy)? */
export function inShade(x, y, sx, sy, gs = gnomons()) {
  for (const g of gs) {
    const dx = g.x - sx, dy = g.y - sy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, rx = x - g.x, ry = y - g.y;
    const along = rx * ux + ry * uy, perp = Math.abs(rx * uy - ry * ux);
    if (along > -g.r && along < SUN.shadow && perp < g.r + 14 + along * 0.1) return true;
  }
  return false;
}
function solSun(sim, e) { return sim.areas.find((a) => a.kind === 'sun' && a.ownerId === e.id && !a.dead); }
function solgrimUpdate(sim, e, t) {
  const { setState, angTo, dTo, move, area, contact } = H();
  const A = e.arena;
  let sun = solSun(sim, e);
  if (!sun) sun = addArea(sim, { team: 'enemy', ownerId: e.id, shape: 'circle', x: A.x, y: A.y, r: r0(A.r * SUN.orbit), ang: r2(sim.rng.next() * TAU), spin: e.phase >= 2 ? SUN.spin * 1.5 : SUN.spin, delay: 36000, visual: true, kind: 'sun' });
  if (phaseCheck(sim, e, [0.5])) { sun.dead = true; call(sim, e, 'HIGH NOON', 'Phase 2 · the sun races · at NOON the only shade is under Solgrim', '#ffd36a'); return; }
  const fast = e.phase >= 2 ? 0.82 : 1, st = e.st;
  switch (e.state) {
    case 'roar': if (st >= 70) { setState(e, 'idle'); e.cd = 30; } return;
    case 'flare': { // SOLAR FLARE: get into a gnomon's shadow (it swings as the sun moves)
      const W = r0(SUN.warn * fast);
      if (st === 1) { addArea(sim, { team: 'enemy', ownerId: e.id, shape: 'circle', x: A.x, y: A.y, r: A.r + 160, delay: W, visual: true, kind: 'flare' }); call(sim, e, 'SOLAR FLARE', 'Stand in a gnomon\'s shadow · it moves with the sun', '#ffcf4a'); ev(sim, 'flareCast', { x: r0(A.x), y: r0(A.y), d: W }); }
      if (st === W) {
        const sp = sunPos(sun, sun.t);
        for (const p of arenaPlayers(sim, e)) if (!inShade(p.x, p.y, sp.x, sp.y)) burn(sim, e, p, 0.42, 'a Solar Flare', null, { stun: 8 });
        ev(sim, 'flare', { x: r0(A.x), y: r0(A.y), sx: r0(sp.x), sy: r0(sp.y) });
      }
      if (st >= W + 40) { setState(e, 'idle'); e.cd = r0(40 * fast); }
      return;
    }
    case 'noon': { // the sun stands overhead: no shadows; the only shade is the ring under Solgrim
      const W = r0(170 * fast);
      if (st === 1) { e.noonX = e.x; e.noonY = e.y; addArea(sim, { team: 'enemy', ownerId: e.id, shape: 'circle', x: r0(e.x), y: r0(e.y), r: 150, delay: W, visual: true, kind: 'noonshade' }); addArea(sim, { team: 'enemy', ownerId: e.id, shape: 'circle', x: A.x, y: A.y, r: A.r + 160, delay: W, visual: true, kind: 'flare' }); call(sim, e, 'NOON', 'The sun stands overhead · the only shade is under Solgrim himself', '#fff1a8'); ev(sim, 'noonCast', { x: r0(e.x), y: r0(e.y), d: W }); }
      e.x = e.noonX; e.y = e.noonY; // (he holds still so his shade stays put)
      if (st === W) { for (const p of arenaPlayers(sim, e)) if (Math.hypot(p.x - e.noonX, p.y - e.noonY) > 150 + p.r * 0.5) burn(sim, e, p, 0.45, 'the Noon sun', null, { stun: 8 }); ev(sim, 'noon', { x: r0(e.x), y: r0(e.y) }); }
      if (st === W + 10) area(sim, e, { shape: 'circle', x: e.x, y: e.y, r: 170, delay: 40, mul: 1.3, kb: 520, stun: 10, kind: 'tailslam' }); // (then he shoves everyone out of his shade)
      if (st >= W + 70) { setState(e, 'idle'); e.cd = r0(40 * fast); }
      return;
    }
    case 'hour': { // HOUR STRIKE: the dial's hour sectors ignite (3 of 12, then the next three)
      if (st === 1) { e.hour = Math.floor(sim.rng.next() * 12); }
      const waves = e.phase >= 2 ? 3 : 2;
      for (let w = 0; w < waves; w++) if (st === 1 + w * 34) for (let k = 0; k < 3; k++) { const h = (e.hour + w + k * 4) % 12, a = (h / 12) * TAU - Math.PI / 2; area(sim, e, { shape: 'cone', x: A.x, y: A.y, ang: a, arc: TAU / 12 * 1.05, r: A.r + 120, delay: r0(56 * fast), mul: 1.25, kb: 260, stun: 10, kind: 'hour' }); }
      if (st === 1) { call(sim, e, 'HOUR STRIKE', 'The dial\'s hours ignite · step into the next hour', '#ffb02e'); ev(sim, 'hour', { x: r0(A.x), y: r0(A.y), h: e.hour }); }
      if (st >= waves * 34 + r0(56 * fast) + 10) { setState(e, 'idle'); e.cd = r0(36 * fast); }
      return;
    }
    case 'spit': // ember spit: fans of sun-sparks
      if (st === 12 || st === 36) { const a0 = angTo(e, t), n = e.phase >= 2 ? 9 : 7; for (let i = 0; i < n; i++) fireFrom(sim, e, e.x, e.y, a0 + (i - (n - 1) / 2) * 0.16, 290, { r: 10, mul: 0.7, style: 'sun' }); }
      if (st >= 70) { setState(e, 'idle'); e.cd = r0(34 * fast); }
      return;
    case 'tail': // a tail sweep cone behind + a lunge
      if (st === 1) { e.lock = angTo(e, t); area(sim, e, { shape: 'cone', x: e.x, y: e.y, ang: e.lock, arc: 2.2, r: 230, delay: r0(40 * fast), mul: 1.3, kb: 380, stun: 10, kind: 'tail' }); }
      if (st > 44 && st < 60) { e.x += Math.cos(e.lock) * 9; e.y += Math.sin(e.lock) * 9; contact(sim, e, t, 1.2, 360, 10); }
      if (st >= 80) { setState(e, 'idle'); e.cd = r0(36 * fast); }
      return;
    default: {
      const d = dTo(e, t);
      if (d > 240) move(e, angTo(e, t), 0.85); else if (d < 130) move(e, angTo(e, t) + Math.PI, 0.6);
      contact(sim, e, t, 0.8, 300);
      if (e.cd > 0) return;
      const rot = SOROT[e.phase] || SOROT[1]; setState(e, rot[e.attackIdx++ % rot.length]);
    }
  }
}

// ------------------------------------------------------------------ Pyrrhex, the Caldera Heart (Emberdeep Overlord)
// Moving safe zones (the tide wedge, the rafts) are visual areas whose motion is a pure function of the area clock
// (ang + spin * t), so co-op clients draw them where the sim tests them.
const PROT = {
  1: ['heartbeat', 'fist', 'tide', 'fan', 'heartbeat', 'eruption'],
  2: ['eruption', 'heartbeat', 'tide', 'fist', 'heartbeat', 'fan', 'tide'],
  3: ['floor', 'heartbeat', 'eruption', 'tide', 'fist', 'heartbeat', 'fan'],
};
export const TIDE = { arc: 0.62, spin: 0.011, warn: 70, dur: 260, every: 20, pct: 0.09 };
export const RAFT = { n: 4, r: 88, spin: 0.0065, dur: 480, every: 20, pct: 0.075 };
/** the wedge centre angle of a tide area at clock t (it only turns once the lava is up) */
export const tideAng = (a, t) => a.ang + a.spin * Math.max(0, t - TIDE.warn);
export const inWedge = (a, t, x, y) => { const d = Math.atan2(y - a.y, x - a.x) - tideAng(a, t); return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < TIDE.arc / 2; };
/** raft k of a floor area at clock t */
export const raftPos = (a, k, t) => { const ang = a.ang + (k / RAFT.n) * TAU + a.spin * t, rr = a.r * (k % 2 ? 0.62 : 0.4); return { x: a.x + Math.cos(ang) * rr, y: a.y + Math.sin(ang) * rr }; };
function pyrrhexUpdate(sim, e, t) {
  const { setState, angTo, dTo, move, area, contact, shoot } = H();
  if (phaseCheck(sim, e, [0.66, 0.33], 80)) {
    if (e.phase === 2) { call(sim, e, 'THE CALDERA BOILS', 'Phase 2 · the heartbeat quickens · the tide comes twice', '#ff8a3a'); summonAdds(sim, e, ['basalt', 'kindler', 'kindler']); }
    else { call(sim, e, 'THE FLOOR IS LAVA', 'Phase 3 · the crater floods · only the drifting obsidian rafts are safe', '#ff4b1f'); summonAdds(sim, e, ['lavaeel', 'lavaeel', 'mortar']); }
    return;
  }
  const A = e.arena, fast = e.phase >= 3 ? 0.78 : e.phase === 2 ? 0.88 : 1, st = e.st;
  // the running lava fields (tide / floor): burn whoever is outside the safe shape
  for (const a of sim.areas) {
    if (a.dead || a.ownerId !== e.id || (a.kind !== 'tide' && a.kind !== 'lavafloor')) continue;
    if (a.kind === 'tide' && a.t >= TIDE.warn && a.t % TIDE.every === 0) for (const p of arenaPlayers(sim, e)) { if (!inWedge(a, a.t, p.x, p.y)) burn(sim, e, p, TIDE.pct, 'the Magma Tide'); }
    if (a.kind === 'lavafloor' && a.t >= 60 && a.t % RAFT.every === 0) for (const p of arenaPlayers(sim, e)) { let safe = false; for (let k = 0; k < RAFT.n; k++) { const q = raftPos(a, k, a.t); if (Math.hypot(p.x - q.x, p.y - q.y) < RAFT.r + p.r * 0.4) { safe = true; break; } } if (!safe) burn(sim, e, p, RAFT.pct, 'the molten floor'); }
  }
  switch (e.state) {
    case 'roar': if (st >= 80) { setState(e, 'idle'); e.cd = 30; } return;
    case 'heartbeat': { // shock rings on a rhythm; every 4th beat a double ring
      const beat = r0((e.phase >= 3 ? 30 : e.phase === 2 ? 36 : 44)), beats = 6;
      if (st % beat === 1 && st < beat * beats) {
        const k = Math.floor(st / beat), dbl = k % 4 === 3;
        for (let i = 0; i < 4; i++) area(sim, e, { shape: 'donut', x: e.x, y: e.y, r0: i * 120, r: i * 120 + 90, delay: 56 + i * 10, mul: 0.9, kb: 220, stun: 6, kind: 'beat' });
        if (dbl) for (let i = 0; i < 4; i++) area(sim, e, { shape: 'donut', x: e.x, y: e.y, r0: i * 120 + 60, r: i * 120 + 150, delay: 78 + i * 10, mul: 0.9, kb: 220, stun: 6, kind: 'beat' });
        ev(sim, 'beat', { x: r0(e.x), y: r0(e.y), dbl: dbl ? 1 : 0 });
      }
      if (st === 1) call(sim, e, 'HEARTBEAT', 'Rings pulse out on the beat · every 4th beat is a double', '#ff7a4a');
      if (st >= beat * beats + 60) { setState(e, 'idle'); e.cd = r0(36 * fast); }
      return;
    }
    case 'tide': { // MAGMA TIDE: lava floods the crater except one rotating safe wedge
      if (st === 1) {
        const dur = TIDE.dur + (e.phase >= 2 ? 60 : 0), sp = (e.phase >= 2 ? 1.3 : 1) * TIDE.spin * (sim.rng.next() < 0.5 ? 1 : -1);
        addArea(sim, { team: 'enemy', ownerId: e.id, shape: 'circle', x: A.x, y: A.y, r: A.r + 120, ang: r2(angTo({ x: A.x, y: A.y }, t)), spin: +sp.toFixed(4), delay: TIDE.warn + dur, visual: true, kind: 'tide' });
        call(sim, e, 'MAGMA TIDE', 'The crater floods · stay in the turning safe wedge', '#ff9a4a'); ev(sim, 'tide', { x: r0(A.x), y: r0(A.y) });
      }
      if (st > TIDE.warn && st % 50 === 0) { const a0 = angTo(e, t); for (let i = 0; i < 5; i++) fireFrom(sim, e, e.x, e.y, a0 + (i - 2) * 0.22, 260, { r: 11, style: 'magma', mul: 0.6 }); }
      if (st >= TIDE.warn + TIDE.dur) { setState(e, 'idle'); e.cd = r0(30 * fast); }
      return;
    }
    case 'eruption': { // ERUPTION: basalt shelters rise; hide under one before the sky rains fire
      const W = r0(170 * fast);
      if (st === 1) {
        const n = 3, o = sim.rng.next() * TAU; e.shel = [];
        for (let i = 0; i < n; i++) { const a = o + (i / n) * TAU, rr = A.r * (0.55 + sim.rng.next() * 0.2), x = r0(A.x + Math.cos(a) * rr), y = r0(A.y + Math.sin(a) * rr); e.shel.push([x, y]); addArea(sim, { team: 'enemy', ownerId: e.id, shape: 'circle', x, y, r: 92, delay: W + 30, visual: true, kind: 'shelter' }); }
        addArea(sim, { team: 'enemy', ownerId: e.id, shape: 'circle', x: A.x, y: A.y, r: A.r + 160, delay: W, visual: true, kind: 'eruptwarn' });
        call(sim, e, 'ERUPTION', 'Basalt shelters rise · get under one before the sky rains fire', '#ffcf4a'); ev(sim, 'eruptCast', { x: r0(A.x), y: r0(A.y), d: W });
      }
      if (st > 30 && st < W - 54 && st % 9 === 0) { /* (no meteor marker shows for < 0.9 s) */ const a = sim.rng.next() * TAU, rr = Math.sqrt(sim.rng.next()) * A.r; addArea(sim, { team: 'enemy', ownerId: e.id, visual: true, shape: 'circle', x: r0(A.x + Math.cos(a) * rr), y: r0(A.y + Math.sin(a) * rr), r: 60, delay: W - st, kind: 'meteor' }); }
      if (st === W) {
        for (const p of arenaPlayers(sim, e)) if (!(e.shel || []).some(([x, y]) => Math.hypot(p.x - x, p.y - y) < 92 + p.r * 0.5)) burn(sim, e, p, 0.48, 'the Eruption', null, { stun: 10 });
        ev(sim, 'erupt', { x: r0(A.x), y: r0(A.y) });
      }
      if (st >= W + 40) { setState(e, 'idle'); e.cd = r0(40 * fast); }
      return;
    }
    case 'floor': { // phase 3: THE FLOOR IS LAVA: four drifting obsidian rafts are the only safe ground
      if (st === 1) { addArea(sim, { team: 'enemy', ownerId: e.id, shape: 'circle', x: A.x, y: A.y, r: A.r + 40, ang: r2(sim.rng.next() * TAU), spin: RAFT.spin * (sim.rng.next() < 0.5 ? 1 : -1), delay: RAFT.dur, visual: true, kind: 'lavafloor' }); call(sim, e, 'THE FLOOR IS LAVA', 'Ride the obsidian rafts · they drift round the crater', '#ff4b1f'); ev(sim, 'floor', { x: r0(A.x), y: r0(A.y) }); }
      if (st > 60 && st % 40 === 0) { const a0 = sim.rng.next() * TAU; for (let i = 0; i < 8; i++) fireFrom(sim, e, e.x, e.y, a0 + (i / 8) * TAU, 220, { r: 10, style: 'magma', mul: 0.55 }); }
      if (st >= 200) { setState(e, 'idle'); e.cd = r0(30 * fast); } // (the floor keeps burning while he fights on)
      return;
    }
    case 'fist': // magma fists under everyone (2 waves)
      if (st === 1 || st === 40) for (const p of arenaPlayers(sim, e)) area(sim, e, { shape: 'circle', x: p.x, y: p.y, r: 100, delay: r0(46 * fast), mul: 1.25, kb: 300, stun: 10, kind: 'fist' });
      if (st >= 110) { setState(e, 'idle'); e.cd = r0(34 * fast); }
      return;
    case 'fan':
      if (st === 10 || st === 30 || st === 50) { const a0 = angTo(e, t), n = e.phase >= 2 ? 9 : 7; for (let i = 0; i < n; i++) shoot(sim, e, a0 + (i - (n - 1) / 2) * 0.15, 280, { r: 12, style: 'magma', mul: 0.7 }); }
      if (st >= 72) { setState(e, 'idle'); e.cd = r0(34 * fast); }
      return;
    default: {
      const d = dTo(e, t);
      if (d > 220) move(e, angTo(e, t), 0.8); else if (d < 120) move(e, angTo(e, t) + Math.PI, 0.5);
      contact(sim, e, t, 0.9, 320);
      if (e.cd > 0) return;
      const rot = PROT[e.phase] || PROT[1]; setState(e, rot[e.attackIdx++ % rot.length]);
    }
  }
}
