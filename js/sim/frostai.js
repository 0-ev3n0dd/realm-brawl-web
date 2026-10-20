// Frostveil Peaks + Glacier Crypt enemy behaviours (looked up by sim/ai.js at run time, so there is no load-order cycle).
// Every attack is telegraphed (a wind-up state and/or a ground area), like the Wilds / Dunes enemies.
//   slider     : the Glacier Penguin waddles in, then BELLY-SLIDES along a telegraphed lane; it bounces once off walls,
//                and every penguin nearby joins the toboggan run (they slide as a flock)
//   yeti       : Frostback Yeti: lobs a giant snowball (lands in a circle, bursts into a ring of shards), ground-pounds
//   shardwisp  : fires a ring of ice shards that STOP in mid-air, hang there, then rush BACK to the wisp (boomerang)
//   rimewraith : dashes along a telegraphed lane and leaves a FROZEN ECHO of itself that repeats the dash 1.5 s later;
//                fades out between dashes
//   sentinel   : (Crypt) dormant ice statue until you come close; halberd sweeps, a shield-wall advance (takes 35%)
//   acolyte    : (Crypt) rime glyph lines under you + slow homing rime bolts
//   piece      : (Crypt) the Rimeking's chess pieces: moved by sim/crypt.js (tile hops), no AI of their own
//   gift       : Morwen's wrapped gifts: break them before they burst (they spit shards when they break)
// World bosses (each in its own arena, walk home + heal when nobody is near):
//   Mother Morwen, the Snow Globe (Danger 5): KNITTING NEEDLES (clock-hand lines sweeping round her), SHAKE THE GLOBE
//     (an arrow shows the shake; everyone is flung that way into the snowdrifts that land there), WRAPPED GIFTS, BLIZZARD
//   Vyrnhal, the Echo Stag (Danger 6): every attack it makes is REPLAYED by an ice echo from where it stood 2.5 s
//     earlier (phase 2: two echoes, 2.5 s and 5 s); antler charges, quake rings, antler crowns that hang then fly
//   Skaldra, the Glacier Wyrm (Danger 7, the Overlord): STILLWIND (time freezes: every shard in the arena stops while she
//     weaves a frozen lattice, then everything moves at once, phase 2+ the frozen shards re-aim at you), AVALANCHE lanes
//     with one moving gap, GLACIAL MIRROR (a mirror line: her breath + frostbite are cast twice, reflected), WHITEOUT
//     (phase 3: the blizzard hides everything past your nose while she hunts from under the snow)
import { AIH, spawnEnemy } from './ai.js';
import { cancelAreasOf, spawnProjectile, addArea, evadeShove, slamBeats } from './combat.js';
import { pointBlocked } from './world.js';
import { DT } from './constants.js';

const TAU = Math.PI * 2;
const H = () => AIH;
const r0 = (v) => Math.round(v);
/** a shot from any point (not the enemy's body) */
export function shotFrom(sim, e, x, y, ang, speed, o = {}) {
  return spawnProjectile(sim, {
    team: 'enemy', ownerId: e.id, x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: o.r || 9, life: o.life || 160,
    dmg: e.dmg * (o.mul ?? 1), homing: o.homing || 0, accel: o.accel || 0, style: o.style || 'ice', color: o.color || null, kb: o.kb || 70, by: e.name,
    ...(o.halt ? { halt: { ...o.halt }, sync: 1 } : {}),
  });
}
const toward = (sim, e) => (e.aggroId && sim.players.get(e.aggroId)) || null;
function bounce(sim, e) { // the penguin slide reflects off walls / props once
  const nx = e.x + Math.cos(e.lock) * (e.r + 14), ny = e.y + Math.sin(e.lock) * (e.r + 14);
  if (!pointBlocked(sim.world, nx, ny, e.r * 0.6)) return false;
  const bx = pointBlocked(sim.world, e.x + Math.cos(e.lock) * (e.r + 14), e.y, e.r * 0.6), by = pointBlocked(sim.world, e.x, e.y + Math.sin(e.lock) * (e.r + 14), e.r * 0.6);
  let vx = Math.cos(e.lock), vy = Math.sin(e.lock);
  if (bx || !by) vx = -vx; if (by || !bx) vy = -vy;
  e.lock = Math.atan2(vy, vx);
  sim.emit({ type: 'frost', ph: 'bounce', id: e.id, x: r0(e.x), y: r0(e.y) });
  return true;
}

export const FROST_AI = {
  slider(sim, e, t) {
    const { setState, angTo, dTo, move, area, contact } = H();
    const d = dTo(e, t);
    switch (e.state) {
      case 'wind': if (e.st >= 30) { setState(e, 'slide'); e.hitDone = false; e.bounced = 0; } break;
      case 'slide':
        e.face = e.lock; move(e, e.lock, 5.2);
        if (!e.bounced && bounce(sim, e)) e.bounced = 1;
        if (!e.hitDone && contact(sim, e, t, 1.25, 300, 10)) e.hitDone = true;
        if (e.st >= 24) setState(e, 'recover');
        break;
      case 'recover': if (e.st >= 34) { setState(e, 'idle'); e.cd = 70 + Math.floor(sim.rng.next() * 60); } break;
      default: {
        if (e.cd <= 0 && d < 430) { startSlide(sim, e, angTo(e, t)); flock(sim, e, t); break; }
        move(e, angTo(e, t) + Math.sin(e.st * 0.2 + e.id) * 0.6, 0.75); // (the waddle)
        contact(sim, e, t, 0.7, 160);
      }
    }
  },
  yeti(sim, e, t) {
    const { setState, angTo, dTo, move, area, ring, contact } = H();
    const d = dTo(e, t);
    switch (e.state) {
      case 'throw': {
        if (e.st === 1) { e.tx = t.x + t.vx * 0.5; e.ty = t.y + t.vy * 0.5; area(sim, e, { shape: 'circle', x: e.tx, y: e.ty, r: 92, delay: 54, mul: 1.3, kb: 320, stun: 12, kind: 'snowball' }); }
        if (e.st === 55) { const n = e.elite ? 12 : 8, o = sim.rng.next(); for (let i = 0; i < n; i++) shotFrom(sim, e, e.tx, e.ty, o + (i / n) * TAU, 230, { r: 9, mul: 0.6 }); sim.emit({ type: 'frost', ph: 'snowball', x: r0(e.tx), y: r0(e.ty) }); }
        if (e.st >= 75) { setState(e, 'idle'); e.cd = 70; }
        break;
      }
      case 'slamwind':
        if (e.st === 1) area(sim, e, { shape: 'circle', x: e.x, y: e.y, r: 150, delay: 40, mul: 1.4, kb: 420, stun: 16, kind: 'slam', follow: e.id });
        if (e.st === 41) ring(sim, e, e.elite ? 14 : 10, 200, sim.rng.next(), { r: 9, style: 'ice', mul: 0.6 });
        if (e.st >= 64) { setState(e, 'idle'); e.cd = 60; }
        break;
      default:
        if (d > 170) move(e, angTo(e, t), 1); else move(e, angTo(e, t) + Math.PI / 2, 0.4);
        contact(sim, e, t, 0.9, 260);
        if (e.cd <= 0) setState(e, d < 190 ? 'slamwind' : d < 560 ? 'throw' : 'idle');
    }
  },
  shardwisp(sim, e, t) {
    const { setState, angTo, dTo, kite } = H();
    if (e.state === 'cast') {
      if (e.st === 24) {
        const n = e.elite ? 14 : 10, o = sim.rng.next() * TAU;
        for (let i = 0; i < n; i++) shotFrom(sim, e, e.x, e.y, o + (i / n) * TAU, 270, { r: 8, mul: 0.55, life: 220, halt: { at: 24, hold: 34, mode: 'back', sp: 400 } });
        sim.emit({ type: 'frost', ph: 'shards', id: e.id, x: r0(e.x), y: r0(e.y) });
      }
      if (e.st >= 60) { setState(e, 'idle'); e.cd = 110 + Math.floor(sim.rng.next() * 50); }
      return;
    }
    kite(sim, e, t, 200, 320, 1);
    if (e.cd <= 0 && dTo(e, t) < 520) setState(e, 'cast');
  },
  rimewraith(sim, e, t) {
    const { setState, angTo, dTo, move, area, contact } = H();
    const d = dTo(e, t);
    switch (e.state) {
      case 'wind':
        if (e.st === 1) {
          e.lock = angTo(e, t); e.sx = e.x; e.sy = e.y;
          area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.lock, len: 380, w: e.r * 2 + 12, delay: 26, visual: true, kind: 'charge' });
          // the frozen echo: the same lane strikes again 1.5 s after the dash
          area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.lock, len: 380, w: e.r * 2 + 18, delay: 26 + 14 + 90, mul: 1.1, kb: 260, stun: 10, kind: 'echo' });
          area(sim, e, { shape: 'circle', x: e.x, y: e.y, r: e.r, ang: e.lock, delay: 130, visual: true, kind: 'statue' });
        }
        if (e.st >= 26) { setState(e, 'dash'); e.hitDone = false; }
        break;
      case 'dash':
        e.face = e.lock; e.x += Math.cos(e.lock) * 27; e.y += Math.sin(e.lock) * 27; // (380 px in 14 ticks)
        if (!e.hitDone && contact(sim, e, t, 1.2, 280, 8)) e.hitDone = true;
        if (e.st >= 14) { setState(e, 'fade'); e.untargetable = 1; }
        break;
      case 'fade':
        move(e, angTo(e, t) + Math.PI * 0.6, 1.2);
        if (e.st >= 46) { e.untargetable = 0; setState(e, 'idle'); e.cd = 80 + Math.floor(sim.rng.next() * 40); }
        break;
      default:
        if (d > 260) move(e, angTo(e, t), 1); else move(e, angTo(e, t) + Math.PI / 2 * (e.id % 2 ? 1 : -1), 0.7);
        if (e.cd <= 0 && d < 400) setState(e, 'wind');
    }
  },
  sentinel(sim, e, t) {
    const { setState, angTo, dTo, move, area, ring } = H();
    const d = dTo(e, t);
    if (e.state === 'idle' && !e.woke) { // dormant: frozen solid until you come close / hit it
      e.takeMul = 0.5;
      if (d < 230 || e.hp < e.maxHp) { e.woke = 1; e.takeMul = 1; setState(e, 'wake'); sim.emit({ type: 'frost', ph: 'wake', id: e.id, x: r0(e.x), y: r0(e.y) }); }
      return;
    }
    switch (e.state) {
      case 'wake': if (e.st >= 30) { setState(e, 'walk'); e.cd = 20; } break;
      case 'swing':
        if (e.st === 1) { e.lock = angTo(e, t); area(sim, e, { shape: 'cone', x: e.x, y: e.y, ang: e.lock, arc: 1.7, r: 165, delay: 36, mul: 1.3, kb: 360, stun: 12, kind: 'swing' }); }
        if (e.st >= 60) { setState(e, 'walk'); e.cd = 50; }
        break;
      case 'guard':
        e.takeMul = 0.35; move(e, angTo(e, t), 0.9);
        if (e.st >= 70) { e.takeMul = 1; setState(e, 'slamwind'); }
        break;
      case 'slamwind':
        if (e.st === 1) area(sim, e, { shape: 'circle', x: e.x, y: e.y, r: 140, delay: 34, mul: 1.4, kb: 420, stun: 14, kind: 'slam', follow: e.id });
        if (e.st === 35) ring(sim, e, 10, 210, e.face, { r: 9, style: 'ice', mul: 0.6 });
        if (e.st >= 56) { setState(e, 'walk'); e.cd = 60; }
        break;
      default:
        if (d > 120) move(e, angTo(e, t), 1);
        if (e.cd <= 0) setState(e, d < 180 ? 'swing' : 'guard');
    }
  },
  acolyte(sim, e, t) {
    const { setState, angTo, dTo, kite, area, shoot } = H();
    if (e.state === 'cast') {
      if (e.st === 1) { const a = angTo(e, t); for (let i = 0; i < 3; i++) area(sim, e, { shape: 'circle', x: t.x + Math.cos(a) * (i - 1) * 120, y: t.y + Math.sin(a) * (i - 1) * 120, r: 80, delay: 50 + i * 10, mul: 1.1, kb: 200, stun: 8, kind: 'glyph' }); }
      if (e.st === 30) for (const o of [-0.25, 0.25]) shoot(sim, e, angTo(e, t) + o, 170, { r: 11, style: 'ice', mul: 0.8, homing: 1.4, life: 200 });
      if (e.st >= 60) { setState(e, 'idle'); e.cd = 90 + Math.floor(sim.rng.next() * 40); }
      return;
    }
    kite(sim, e, t, 230, 360, 1);
    if (e.cd <= 0 && dTo(e, t) < 560) setState(e, 'cast');
  },
  piece() {},
  gift(sim, e) {
    if ((e.life = (e.life ?? 420) - 1) === 120) sim.emit({ type: 'frost', ph: 'giftTick', id: e.id, x: r0(e.x), y: r0(e.y) });
    if (e.life === 1) {
      const o = sim.enemyById.get(e.summonOf) || e;
      addArea(sim, { team: 'enemy', ownerId: o.id, shape: 'circle', x: e.x, y: e.y, r: 210, delay: 1, dmg: 0, pct: 0.4, by: 'a Wrapped Gift', kb: 420, kind: 'giftboom' });
      e.dead = true; e.hp = 0;
      sim.emit({ type: 'frost', ph: 'giftBoom', x: r0(e.x), y: r0(e.y) });
    }
  },
  morwen(sim, e, t) { morwenUpdate(sim, e, t); },
  vyrnhal(sim, e, t) { vyrnhalUpdate(sim, e, t); },
  skaldra(sim, e, t) { skaldraUpdate(sim, e, t); },
};
function startSlide(sim, e, ang) {
  const { setState, area } = H();
  e.lock = ang; setState(e, 'wind');
  area(sim, e, { shape: 'line', x: e.x, y: e.y, ang, len: 470, w: e.r * 2 + 10, delay: 30, visual: true, kind: 'slide' });
}
function flock(sim, e, t) { // every idle penguin close by slides too (fanned a little)
  let k = 0;
  for (const o of sim.enemies) {
    if (o === e || o.dead || o.ai !== 'slider' || o.state !== 'idle' || Math.hypot(o.x - e.x, o.y - e.y) > 260) continue;
    k++; startSlide(sim, o, Math.atan2(t.y - o.y, t.x - o.x) + (k % 2 ? 1 : -1) * 0.12 * Math.ceil(k / 2));
  }
}

// ------------------------------------------------------------------ shared boss helpers
function phaseCheck(sim, e, gates, roar = 70) {
  const { setState, angTo, dTo } = H();
  const pct = e.hp / e.maxHp; let want = 1; for (const g of gates) if (pct <= g) want++;
  if (want <= e.phase) return false;
  e.phase = want; cancelAreasOf(sim, e); setState(e, 'roar'); e.invuln = 0; e.untargetable = 0; // (game loop C: no invulnerable roar; the phase change is a breather on HP only)
  for (const pr of sim.projectiles) if (pr.ownerId === e.id) pr.dead = true;
  sim.emit({ type: 'bossPhase', phase: e.phase, x: e.x, y: e.y, id: e.id });
  sim.emit({ type: 'frost', ph: 'roar', etype: e.type, phase: e.phase, x: r0(e.x), y: r0(e.y) });
  for (const p of sim.players.values()) if (!p.dead && dTo(e, p) < 320 && !evadeShove(sim, p)) { const a = angTo(e, p); p.vx += Math.cos(a) * 820; p.vy += Math.sin(a) * 820; }
  return true;
}
const inArena = (e, p, pad = 140) => Math.hypot(p.x - e.arena.x, p.y - e.arena.y) < e.arena.r + pad;
const arenaPlayers = (sim, e) => [...sim.players.values()].filter((p) => !p.dead && inArena(e, p));
function call(sim, e, txt, sub, col = '#bfeaff') { sim.emit({ type: 'frost', ph: 'call', etype: e.type, txt, sub, col, x: r0(e.x), y: r0(e.y) }); }
function summonAdds(sim, e, list, ring = 180) {
  list.forEach((k, i) => {
    const a = (i / list.length) * TAU + sim.rng.next(), m = spawnEnemy(sim, k, e.x + Math.cos(a) * ring, e.y + Math.sin(a) * ring, { tier: e.zone, mul: 1.6, zoneHp: false });
    m.summonOf = e.id; m.xp = Math.round(m.xp * 0.3); m.dropChance = 0.08; m.homeX = e.homeX; m.homeY = e.homeY;
    sim.emit({ type: 'teleport', x: m.x, y: m.y, id: m.id });
  });
}

// ------------------------------------------------------------------ Mother Morwen, the Snow Globe
const MROT = { 1: ['needles', 'fan', 'shake', 'gifts', 'needles', 'shake'], 2: ['shake', 'needles', 'gifts', 'blizzard', 'shake', 'needles', 'fan'] };
function morwenUpdate(sim, e, t) {
  const { setState, angTo, dTo, move, area, shoot } = H();
  if (phaseCheck(sim, e, [0.5])) { call(sim, e, 'THE GLOBE CRACKS', 'Morwen shakes harder · a blizzard swirls inside'); return; }
  const A = e.arena, fast = e.phase >= 2 ? 0.8 : 1, st = e.st;
  switch (e.state) {
    case 'roar': if (st >= 70) { setState(e, 'idle'); e.cd = 30; } return;
    case 'needles': { // clock hands sweeping round her: 2 (4) committed lines, one step every 9 ticks
      const n = e.phase >= 2 ? 4 : 2, steps = 9;
      if (st % 9 === 1 && st < steps * 9) { const k = Math.floor(st / 9); for (let i = 0; i < n; i++) area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.rot + k * 0.3 * e.dir + (i / n) * TAU, len: A.r + 160, w: 46, delay: 44, mul: 0.9, kb: 220, stun: 8, kind: 'needle', committed: true }); }
      if (st >= steps * 9 + 50) { setState(e, 'idle'); e.cd = r0(40 * fast); }
      return;
    }
    case 'shake': { // the globe is shaken: an arrow shows which way; everyone is flung that way into the drifts that land there
      if (st === 1) {
        e.lock = sim.rng.next() * TAU;
        area(sim, e, { shape: 'line', x: A.x - Math.cos(e.lock) * A.r, y: A.y - Math.sin(e.lock) * A.r, ang: e.lock, len: A.r * 2, w: 120, delay: 64, visual: true, kind: 'shake' });
        for (let i = 0; i < 5; i++) { const a = e.lock + (i - 2) * 0.42, rr = A.r - 70; area(sim, e, { shape: 'circle', x: A.x + Math.cos(a) * rr, y: A.y + Math.sin(a) * rr, r: 120, delay: 64 + 48, mul: 1.5, kb: 300, stun: 20, kind: 'drift' }); }
        call(sim, e, 'SHAKE THE GLOBE', 'You will be flung the way the arrow points · then dash out of the drifts');
        sim.emit({ type: 'frost', ph: 'shake', x: r0(A.x), y: r0(A.y), ang: +e.lock.toFixed(2) });
      }
      if (st === 64) { for (const p of arenaPlayers(sim, e)) { if (evadeShove(sim, p)) continue; p.vx += Math.cos(e.lock) * 1250; p.vy += Math.sin(e.lock) * 1250; p.action = null; } sim.emit({ type: 'frost', ph: 'flung', x: r0(A.x), y: r0(A.y), ang: +e.lock.toFixed(2) }); }
      if (st >= 130) { setState(e, 'idle'); e.cd = r0(40 * fast); }
      return;
    }
    case 'gifts': {
      if (st === 20) {
        const n = e.phase >= 2 ? 4 : 3;
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU + sim.rng.next(), g = spawnEnemy(sim, 'gift', e.x + Math.cos(a) * 230, e.y + Math.sin(a) * 230, { tier: e.zone, zoneHp: false }); g.summonOf = e.id; g.xp = 20; g.dropChance = 0.1; g.homeX = g.x; g.homeY = g.y; g.life = 420; }
        call(sim, e, 'WRAPPED GIFTS', 'Break them before they burst · from range: they spit shards');
      }
      if (st >= 50) { setState(e, 'idle'); e.cd = r0(40 * fast); }
      return;
    }
    case 'fan':
      if (st === 10 || st === 30 || st === 50) { const a0 = angTo(e, t), n = e.phase >= 2 ? 9 : 7; for (let i = 0; i < n; i++) shoot(sim, e, a0 + (i - (n - 1) / 2) * 0.14, 290, { r: 10, style: 'snow', mul: 0.7 }); }
      if (st >= 72) { setState(e, 'idle'); e.cd = r0(36 * fast); }
      return;
    case 'blizzard': { // she hides in a whirling vortex at the centre; a spiral that freezes in mid-air every few beats
      if (st === 1) { e.untargetable = 1; call(sim, e, 'BLIZZARD', 'The shards freeze, then fly on'); }
      const dx = A.x - e.x, dy = A.y - e.y, dd = Math.hypot(dx, dy); if (dd > 8) { e.x += dx / dd * 4; e.y += dy / dd * 4; }
      if (st % 6 === 0 && st < 170) { for (let i = 0; i < 3; i++) shotFrom(sim, e, e.x, e.y, e.rot + (i / 3) * TAU, 200, { r: 9, style: 'snow', mul: 0.6, life: 260, halt: { at: 34, hold: 40, mode: 'resume' } }); e.rot += 0.21; }
      if (st >= 200) { e.untargetable = 0; setState(e, 'idle'); e.cd = r0(40 * fast); }
      return;
    }
    default: {
      const d = dTo(e, t);
      if (d > 230) move(e, angTo(e, t), 0.9); else if (d < 130) move(e, angTo(e, t) + Math.PI, 0.6);
      if (e.cd > 0) return;
      const rot = MROT[e.phase] || MROT[1], m = rot[e.attackIdx++ % rot.length];
      e.rot = angTo(e, t) - 0.9; e.dir = sim.rng.next() < 0.5 ? 1 : -1;
      setState(e, m);
    }
  }
}

// ------------------------------------------------------------------ Vyrnhal, the Echo Stag
const VROT = { 1: ['charge', 'quake', 'crown', 'antlers', 'charge'], 2: ['charge', 'crown', 'quake', 'charge', 'antlers', 'stampede'] };
export const ECHO_DELAY = 150;
/** record an attack piece so the echo can replay it from the same spot later */
function echoAdd(sim, e, piece) {
  const B = e.echo || (e.echo = []);
  const n = e.phase >= 2 ? 2 : 1;
  for (let k = 1; k <= n; k++) B.push({ at: sim.tick + ECHO_DELAY * k, ...piece });
}
function vArea(sim, e, spec) { H().area(sim, e, spec); echoAdd(sim, e, { k: 'area', spec: { ...spec, follow: 0 }, x: e.x, y: e.y, face: e.face }); }
function vShot(sim, e, ang, sp, o) { shotFrom(sim, e, e.x, e.y, ang, sp, o); echoAdd(sim, e, { k: 'shot', ang, sp, o, x: e.x, y: e.y, face: e.face }); }
function echoTick(sim, e) {
  if (!e.echo || !e.echo.length) return;
  const due = e.echo.filter((q) => q.at <= sim.tick);
  if (!due.length) return;
  e.echo = e.echo.filter((q) => q.at > sim.tick);
  const ghosts = new Set();
  for (const q of due) {
    const key = r0(q.x / 20) + ',' + r0(q.y / 20);
    if (!ghosts.has(key)) { ghosts.add(key); addArea(sim, { team: 'enemy', ownerId: e.id, shape: 'circle', x: q.x, y: q.y, r: e.r, ang: q.face, delay: 46, visual: true, kind: 'echoghost' }); sim.emit({ type: 'frost', ph: 'echo', x: r0(q.x), y: r0(q.y) }); }
    if (q.k === 'area') addArea(sim, { team: 'enemy', ownerId: e.id, dmg: e.dmg * (q.spec.mul ?? 1), by: 'Vyrnhal\'s echo', ...q.spec, echo: 1 });
    else shotFrom(sim, e, q.x, q.y, q.ang, q.sp, q.o);
  }
}
function vyrnhalUpdate(sim, e, t) {
  const { setState, angTo, dTo, move, contact } = H();
  echoTick(sim, e);
  if (phaseCheck(sim, e, [0.5])) { call(sim, e, 'THE ECHOES MULTIPLY', 'Every move now repeats twice: 2.5 s and 5 s later'); return; }
  const A = e.arena, fast = e.phase >= 2 ? 0.82 : 1, st = e.st;
  switch (e.state) {
    case 'roar': if (st >= 70) { setState(e, 'idle'); e.cd = 30; } return;
    case 'charge': case 'stampede': {
      const legs = e.state === 'stampede' ? 3 : 1, wind = Math.max(54, r0(36 * fast)), leg = wind + 22, // (>= 0.9 s tell: combat audit step 1)
        k = Math.floor((st - 1) / leg), s = (st - 1) % leg;
      if (k >= legs) { if (st >= legs * leg + 30) { setState(e, 'idle'); e.cd = r0(40 * fast); } return; }
      if (s === 0) {
        e.lock = angTo(e, t);
        H().area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.lock, len: 520, w: e.r * 2 + 14, delay: wind, visual: true, kind: 'charge' });
        echoAdd(sim, e, { k: 'area', spec: { shape: 'line', x: e.x, y: e.y, ang: e.lock, len: 520, w: e.r * 2 + 14, delay: wind + 10, mul: 1.3, kb: 380, stun: 14, kind: 'echo' }, x: e.x, y: e.y, face: e.lock });
      }
      if (s > wind) { e.face = e.lock; e.x += Math.cos(e.lock) * 1150 * DT; e.y += Math.sin(e.lock) * 1150 * DT; contact(sim, e, t, 1.4, 520, 18); }
      return;
    }
    case 'quake': // three rings ripple out from the stag (donuts)
      if (st === 1) for (let i = 0; i < 3; i++) vArea(sim, e, { shape: 'donut', x: e.x, y: e.y, r0: i * 130, r: i * 130 + 130, delay: r0(40 * fast) + i * 14, mul: 1.15, kb: 280, stun: 10, kind: 'quake' });
      if (st >= 90) { setState(e, 'idle'); e.cd = r0(40 * fast); }
      return;
    case 'crown': // a crown of antler shards that hang in the air, then fly on
      if (st === 12) { const n = e.phase >= 2 ? 20 : 16, o = sim.rng.next(); for (let i = 0; i < n; i++) vShot(sim, e, o + (i / n) * TAU, 250, { r: 10, mul: 0.65, life: 200, halt: { at: 18, hold: 26, mode: 'resume' } }); }
      if (st >= 64) { setState(e, 'idle'); e.cd = r0(40 * fast); }
      return;
    case 'antlers':
      if (st === 10 || st === 34) { const a0 = angTo(e, t), n = e.phase >= 2 ? 9 : 7; for (let i = 0; i < n; i++) vShot(sim, e, a0 + (i - (n - 1) / 2) * 0.15, 300, { r: 10, mul: 0.7 }); }
      if (st >= 70) { setState(e, 'idle'); e.cd = r0(36 * fast); }
      return;
    default: {
      const d = dTo(e, t);
      if (d > 220) move(e, angTo(e, t), 0.85); else if (d < 120) move(e, angTo(e, t) + Math.PI, 0.6);
      contact(sim, e, t, 0.8, 300);
      if (e.cd > 0) return;
      const rot = VROT[e.phase] || VROT[1]; setState(e, rot[e.attackIdx++ % rot.length]);
    }
  }
}

// ------------------------------------------------------------------ Skaldra, the Glacier Wyrm (Frostveil Overlord)
const SROT = {
  1: ['avalanche', 'breath', 'stillwind', 'frostbite', 'avalanche', 'mirror'],
  2: ['stillwind', 'mirror', 'avalanche', 'breath', 'stillwind', 'frostbite'],
  3: ['whiteout', 'stillwind', 'mirror', 'avalanche', 'whiteout', 'breath'],
};
/** reflect (x, y) across the mirror line through (mx, my) at angle a */
export function reflect(x, y, mx, my, a) {
  const c = Math.cos(a), s = Math.sin(a), dx = x - mx, dy = y - my, k = dx * c + dy * s;
  return { x: mx + 2 * k * c - dx, y: my + 2 * k * s - dy };
}
function sArea(sim, e, spec) { // + its mirror image while the Glacial Mirror stands
  H().area(sim, e, spec);
  const M = e.mirror;
  if (!M || sim.tick > M.until) return;
  const q = reflect(spec.x, spec.y, M.x, M.y, M.a), ang = spec.ang != null ? 2 * M.a - spec.ang : spec.ang;
  H().area(sim, e, { ...spec, x: q.x, y: q.y, ang, follow: 0, mirrored: 1 });
}
function skaldraUpdate(sim, e, t) {
  const { setState, angTo, dTo, move, ring, contact } = H();
  if (phaseCheck(sim, e, [0.66, 0.33], 80)) {
    e.mirror = null;
    if (e.phase === 2) { call(sim, e, 'THE GLACIER WAKES', 'Phase 2 · frozen shards now re-aim at you when time resumes', '#9fe8ff'); summonAdds(sim, e, ['yeti', 'shardwisp', 'shardwisp']); }
    else { call(sim, e, 'WHITEOUT', 'Phase 3 · the blizzard swallows the summit · she hunts from under the snow', '#ffffff'); summonAdds(sim, e, ['rimewraith', 'rimewraith', 'yeti']); }
    return;
  }
  const A = e.arena, fast = e.phase >= 3 ? 0.78 : e.phase === 2 ? 0.9 : 1, st = e.st;
  switch (e.state) {
    case 'roar': if (st >= 80) { setState(e, 'idle'); e.cd = 30; } return;
    case 'stillwind': { // TIME FREEZES: every shard in the arena stops; she weaves a frozen lattice; then everything moves at once
      const HOLD = r0(110 * fast), T0 = 30;
      if (st === 1) { call(sim, e, 'STILLWIND', e.phase >= 2 ? 'Time freezes · when it thaws, every shard turns toward you' : 'Time freezes · when it thaws, everything moves at once', '#9fe8ff'); sim.emit({ type: 'frost', ph: 'stillCast', x: r0(e.x), y: r0(e.y) }); }
      if (st === T0) {
        e.thaw = sim.tick + HOLD;
        addArea(sim, { team: 'enemy', ownerId: e.id, shape: 'circle', x: A.x, y: A.y, r: A.r + 180, delay: HOLD, visual: true, kind: 'still' });
        for (const pr of sim.projectiles) if (pr.team === 'enemy' && !pr.dead && Math.hypot(pr.x - A.x, pr.y - A.y) < A.r + 400) { pr.halt = { at: 1, hold: HOLD - 1, mode: e.phase >= 2 ? 'aim' : 'resume', sp: 260, t: 0 }; pr.sync = 1; }
        sim.emit({ type: 'frost', ph: 'still', x: r0(A.x), y: r0(A.y), r: A.r + 180, d: HOLD });
      }
      if (st > T0 && st < T0 + HOLD - 20 && st % 5 === 0) { // the lattice: arms that freeze further and further out, all thaw at e.thaw
        const arms = e.phase >= 3 ? 5 : 4;
        const fz = 6 + Math.floor((st - T0) / 5) * 3; // (later arms freeze further out: a spiral lattice filling the summit)
        for (let i = 0; i < arms; i++) shotFrom(sim, e, e.x, e.y, e.rot + (i / arms) * TAU, 240, { r: 9, mul: 0.6, life: 300 + fz, halt: { at: fz, hold: Math.max(2, e.thaw - sim.tick - fz), mode: e.phase >= 2 ? 'aim' : 'resume', sp: 250 } });
        e.rot += 0.23;
      }
      if (st >= T0 + HOLD + 30) { setState(e, 'idle'); e.cd = r0(40 * fast); }
      return;
    }
    case 'avalanche': { // 3 waves of lanes rolling down from the summit side; one lane is open each wave (it moves)
      if (st === 1) {
        const lanes = 7, w = (A.r * 2) / lanes;
        let gap = Math.floor(sim.rng.next() * lanes);
        for (let wv = 0; wv < 3; wv++) {
          for (let i = 0; i < lanes; i++) { if (i === gap) continue; const x = A.x - A.r + (i + 0.5) * w; sArea(sim, e, { shape: 'line', x, y: A.y - A.r - 60, ang: Math.PI / 2, len: A.r * 2 + 120, w: w - 6, delay: r0(56 * fast) + wv * 38, mul: 1.1, pct: 0.12, kb: 200, stun: 8, kind: 'avalanche' }); }
          gap = Math.max(0, Math.min(lanes - 1, gap + (sim.rng.next() < 0.5 ? -2 : 2)));
        }
        call(sim, e, 'AVALANCHE', 'Find the open lane · it moves with every wave', '#dff4ff');
        sim.emit({ type: 'frost', ph: 'avalanche', x: r0(A.x), y: r0(A.y - A.r) });
      }
      if (st >= r0(56 * fast) + 3 * 38 + 20) { setState(e, 'idle'); e.cd = r0(40 * fast); }
      return;
    }
    case 'mirror': { // GLACIAL MIRROR: a mirror line through the arena; her circles + breath come twice, reflected
      if (st === 1) {
        const a = angTo(e, t) + Math.PI / 2 + (sim.rng.next() - 0.5) * 0.6;
        e.mirror = { x: A.x, y: A.y, a, until: sim.tick + 420 };
        addArea(sim, { team: 'enemy', ownerId: e.id, shape: 'line', x: A.x - Math.cos(a) * (A.r + 40), y: A.y - Math.sin(a) * (A.r + 40), ang: a, len: A.r * 2 + 80, w: 26, delay: 420, visual: true, kind: 'mirror' });
        call(sim, e, 'GLACIAL MIRROR', 'Everything she casts now strikes twice: once here, once reflected', '#bff6ff');
        sim.emit({ type: 'frost', ph: 'mirror', x: r0(A.x), y: r0(A.y), ang: +a.toFixed(2) });
      }
      if (st === 40) { setState(e, 'frostbite'); }
      return;
    }
    case 'frostbite': // circles under everyone (mirrored while the mirror stands)
      if (st === 1 || st === 40 || (e.phase >= 2 && st === 80)) for (const p of arenaPlayers(sim, e)) sArea(sim, e, { shape: 'circle', x: p.x, y: p.y, r: 96, delay: r0(48 * fast), mul: 1.2, kb: 260, stun: 10, kind: 'frostbite' });
      if (st >= 130) { setState(e, 'idle'); e.cd = r0(36 * fast); }
      return;
    case 'breath': { // a sweeping cone of frost breath (5 steps)
      if (st === 1) { e.lock = angTo(e, t) - 0.7 * (e.dir = sim.rng.next() < 0.5 ? 1 : -1); }
      if (st % 12 === 1 && st < 60) sArea(sim, e, { shape: 'cone', x: e.x, y: e.y, ang: e.lock + e.dir * 0.35 * Math.floor(st / 12), arc: 0.62, r: 520, delay: r0(40 * fast), mul: 1.2, kb: 240, stun: 8, kind: 'breath' });
      if (st >= 110) { setState(e, 'idle'); e.cd = r0(36 * fast); }
      return;
    }
    case 'whiteout': { // phase 3: the blizzard hides everything; she dives under the snow and erupts under someone, twice
      const D = r0(360 * fast);
      if (st === 1) { addArea(sim, { team: 'enemy', ownerId: e.id, shape: 'circle', x: A.x, y: A.y, r: A.r + 260, delay: D, visual: true, kind: 'whiteout' }); e.untargetable = 1; sim.emit({ type: 'frost', ph: 'whiteout', x: r0(A.x), y: r0(A.y), d: D }); }
      const k = Math.floor(st / 120), s = st % 120;
      if (st < D - 40) {
        if (s < 60) move(e, angTo(e, t), 2.4);
        if (s === 60) { e.x = e.px = t.x; e.y = e.py = t.y; { for (const b of slamBeats({ shape: 'circle', x: e.x, y: e.y, r: 150, delay: 46, mul: 1.6, kb: 520, stun: 18, kind: 'erupt' })) H().area(sim, e, b); } }
        if (s === 106) { ring(sim, e, 18, 220, sim.rng.next(), { r: 10, style: 'ice', mul: 0.7 }); sim.emit({ type: 'frost', ph: 'erupt', x: r0(e.x), y: r0(e.y) }); }
        if (s === 30 && k % 2 === 1) { const a = sim.rng.next() * TAU; for (let i = -2; i <= 2; i++) H().area(sim, e, { shape: 'line', x: A.x + Math.cos(a) * A.r + Math.cos(a + Math.PI / 2) * i * 150, y: A.y + Math.sin(a) * A.r + Math.sin(a + Math.PI / 2) * i * 150, ang: a + Math.PI, len: A.r * 2, w: 70, delay: 60, mul: 1.1, kb: 200, kind: 'avalanche' }); }
      }
      if (st >= D) { e.untargetable = 0; setState(e, 'idle'); e.cd = r0(40 * fast); }
      return;
    }
    default: {
      const d = dTo(e, t);
      if (d > 200) move(e, angTo(e, t), 0.9); else if (d < 110) move(e, angTo(e, t) + Math.PI, 0.6);
      contact(sim, e, t, 0.9, 320);
      if (e.mirror && sim.tick > e.mirror.until) e.mirror = null;
      if (e.cd > 0) return;
      const rot = SROT[e.phase] || SROT[1]; e.rot = angTo(e, t); setState(e, rot[e.attackIdx++ % rot.length]);
    }
  }
}
