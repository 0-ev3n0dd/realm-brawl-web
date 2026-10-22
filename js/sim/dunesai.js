// Sunscorch Dunes + Tomb enemy behaviours (looked up by sim/ai.js at run time, so there is no load-order cycle).
// Every attack is telegraphed: a wind-up state and/or a ground area, like the Wilds enemies.
//   scarab    : circles you, then a telegraphed rolling ram; splits into 2 Scarablings when it dies (sim/dunes.js)
//   burrower  : the Sandwurm travels UNDER the sand (untargetable, a moving mound), erupts under you (circle telegraph),
//               then fights surfaced for ~2.5 s (sand-spit fans) before diving again
//   mirage    : kites and lobs homing sun orbs; every ~7 s it splits into look-alike fakes (1 HP, weak shots, fade in 8 s)
//               and swaps places with one of them, so you have to find the real caster
//   mummy     : (Tomb) slow; bandage lash cone, a bandage snare line that roots; unravels (faster) below 50% HP
//   sunpriest : (Tomb) a long sun-ray line + single sun orbs from range
//   overlord  : Khepra, the Sandwurm Queen (Dunes Overlord): burrow-eruptions, sandstorm spiral, sun-glass beams,
//               scarab broods, quake fields; phases at 66% / 33% (roar + knockback), faster in phase 3
import { AIH, spawnEnemy } from './ai.js';
import { cancelAreasOf, evadeShove, slamBeats } from './combat.js';

const TAU = Math.PI * 2;
const H = () => AIH;

export const DUNES_AI = {
  scarab(sim, e, t) {
    const { setState, angTo, dTo, move, area, contact } = H();
    const d = dTo(e, t);
    switch (e.state) {
      case 'wind': if (e.st >= 26) { setState(e, 'roll'); e.hitDone = false; } break;
      case 'roll':
        e.face = e.lock; move(e, e.lock, 4.4);
        if (!e.hitDone && contact(sim, e, t, 1.2, 260)) e.hitDone = true;
        if (e.st >= 16) setState(e, 'recover');
        break;
      case 'recover': if (e.st >= 26) { setState(e, 'idle'); e.cd = 60 + Math.floor(sim.rng.next() * 50); } break;
      default: {
        if (e.cd <= 0 && d < 280) {
          e.lock = angTo(e, t); setState(e, 'wind');
          area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.lock, len: 280, w: e.r * 2 + 8, delay: 26, visual: true, kind: 'roll' });
          break;
        }
        const side = e.id % 2 ? 1 : -1, a = angTo(e, t) + Math.PI + side * 0.7;
        move(e, Math.atan2(t.y + Math.sin(a) * 150 - e.y, t.x + Math.cos(a) * 150 - e.x), 0.85);
        contact(sim, e, t, 0.7, 160);
      }
    }
  },
  burrower(sim, e, t) {
    const { setState, angTo, dTo, move, area, shoot } = H();
    if (e.state === 'idle' && !e.dug) { e.dug = 1; setState(e, 'under'); }
    switch (e.state) {
      case 'under': {
        e.untargetable = 1;
        const d = dTo(e, t);
        move(e, angTo(e, t), d > 60 ? 1 : 0.2);
        if ((e.st > 40 && d < 70) || e.st > 160) {
          e.x = t.x + t.vx * 0.15; e.y = t.y + t.vy * 0.15; e.px = e.x; e.py = e.y;
          setState(e, 'erupt');
          area(sim, e, { shape: 'circle', x: e.x, y: e.y, r: 95, delay: 42, mul: 1.3, kb: 380, stun: 14, kind: 'erupt' });
        }
        break;
      }
      case 'erupt':
        e.untargetable = 1;
        if (e.st >= 42) { e.untargetable = 0; setState(e, 'surface'); sim.emit({ type: 'dunes', ph: 'erupt', id: e.id, x: Math.round(e.x), y: Math.round(e.y), r: 95 }); }
        break;
      case 'surface': {
        e.face = angTo(e, t);
        if (e.st === 34 || e.st === 84) { const a = angTo(e, t); for (let i = -2; i <= 2; i++) shoot(sim, e, a + i * 0.22, 250, { r: 9, style: 'sand', mul: 0.7 }); }
        if (e.st >= 150) setState(e, 'dive');
        break;
      }
      case 'dive':
        if (e.st >= 24) { setState(e, 'under'); sim.emit({ type: 'dunes', ph: 'dive', id: e.id, x: Math.round(e.x), y: Math.round(e.y) }); }
        break;
      default: setState(e, 'under');
    }
  },
  mirage(sim, e, t) {
    const { setState, angTo, dTo, kite, shoot } = H();
    if (e.fake) {
      if (--e.life <= 0) { e.dead = true; e.hp = 0; sim.emit({ type: 'dunes', ph: 'fade', id: e.id, x: Math.round(e.x), y: Math.round(e.y) }); return; }
    }
    const d = dTo(e, t);
    if (e.state === 'mirror') {
      if (e.st === 30) splitMirage(sim, e);
      if (e.st >= 36) { setState(e, 'idle'); e.cd = Math.min(e.cd, 40); }
      return;
    }
    kite(sim, e, t, 230, 340, e.state === 'wind' ? 0.3 : 0.9);
    if (e.state === 'wind') {
      if (e.st >= 26) {
        const a = angTo(e, t);
        for (let i = -1; i <= 1; i++) shoot(sim, e, a + i * 0.45, 160, { r: 10, homing: 1.4, life: 230, style: 'sun', mul: e.fake ? 0.35 : 1 });
        setState(e, 'idle'); e.cd = e.fake ? 150 : 120;
      }
    } else if (!e.fake && e.cd2 <= 0 && d < 520) { setState(e, 'mirror'); e.cd2 = 420; sim.emit({ type: 'dunes', ph: 'mirrorWind', id: e.id, x: Math.round(e.x), y: Math.round(e.y) }); }
    else if (e.cd <= 0 && d < 480) setState(e, 'wind');
  },
  mummy(sim, e, t) {
    const { setState, angTo, dTo, move, area } = H();
    const d = dTo(e, t);
    if (!e.unravel && e.hp < e.maxHp * 0.5) { e.unravel = 1; e.spd *= 1.6; sim.emit({ type: 'dunes', ph: 'unravel', id: e.id, x: Math.round(e.x), y: Math.round(e.y) }); }
    switch (e.state) {
      case 'lash': if (e.st >= 40) setState(e, 'recover'); break;
      case 'snare': if (e.st >= 44) setState(e, 'recover'); break;
      case 'recover': if (e.st >= (e.unravel ? 18 : 30)) { setState(e, 'idle'); e.cd = e.unravel ? 45 : 70; } break;
      default:
        if (d < 175 && e.cd <= 0) {
          e.lock = angTo(e, t); setState(e, 'lash');
          area(sim, e, { shape: 'cone', x: e.x, y: e.y, ang: e.lock, arc: 1.5, r: 190, delay: 34, mul: 1.1, kb: 300, kind: 'lash' });
        } else if (d > 200 && d < 420 && e.cd2 <= 0) {
          e.lock = angTo(e, t); setState(e, 'snare'); e.cd2 = 260;
          area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.lock, len: 380, w: 40, delay: 40, mul: 0.8, stun: 40, kind: 'snare' });
        } else move(e, angTo(e, t), 1);
    }
  },
  sunpriest(sim, e, t) {
    const { setState, angTo, dTo, kite, area, shoot } = H();
    const d = dTo(e, t);
    if (e.state === 'ray') { if (e.st >= 50) { setState(e, 'recover'); } return; }
    if (e.state === 'recover') { if (e.st >= 30) { setState(e, 'idle'); e.cd = 150; } return; }
    kite(sim, e, t, 260, 380, 0.9);
    if (e.cd <= 0 && d < 520) {
      e.lock = angTo(e, t); setState(e, 'ray');
      area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.lock, len: 560, w: 36, delay: 46, mul: 1.3, kb: 200, kind: 'sunray' });
    } else if (e.cd2 <= 0 && d < 500) { e.cd2 = 70; shoot(sim, e, angTo(e, t), 220, { r: 9, style: 'sun', mul: 0.7 }); }
  },
  overlord(sim, e, t) { overlordUpdate(sim, e, t); },
};

/** Mirage: split into fakes and swap places with one of them. */
function splitMirage(sim, e) {
  const n = e.elite ? 3 : 2, pts = [];
  for (let i = 0; i <= n; i++) { const a = (i / (n + 1)) * TAU + sim.rng.next(); pts.push({ x: e.x + Math.cos(a) * 120, y: e.y + Math.sin(a) * 120 }); }
  const real = Math.floor(sim.rng.next() * pts.length);
  const ids = [];
  pts.forEach((p, i) => {
    if (i === real) { e.x = e.px = p.x; e.y = e.py = p.y; return; }
    const f = spawnEnemy(sim, 'mirage', p.x, p.y, { elite: e.elite, zoneHp: false });
    f.fake = 1; f.hp = f.maxHp = f.baseMaxHp = 1; f.xp = 0; f.dropChance = 0; f.life = 480; f.cd2 = 1e9; f.cd = 40 + Math.floor(sim.rng.next() * 40); f.dmg = e.dmg; f.name = e.name; f.homeX = p.x; f.homeY = p.y;
    if (sim.tomb && e.tombWave) f.tombFake = 1;
    ids.push(f.id);
  });
  sim.emit({ type: 'dunes', ph: 'mirror', id: e.id, x: Math.round(e.x), y: Math.round(e.y), pts: pts.map((p) => [Math.round(p.x), Math.round(p.y)]) });
}

// ------------------------------------------------------------------ Khepra, the Sandwurm Queen (Dunes Overlord)
const KROT = {
  1: ['burrow', 'sandstorm', 'glass', 'burrow', 'summon'],
  2: ['burrow', 'glass', 'sandstorm', 'summon', 'burrow', 'quake'],
  3: ['burrow2', 'sandstorm', 'glass', 'burrow2', 'quake', 'summon'],
};
function overlordUpdate(sim, e, t) {
  const { setState, angTo, dTo, move, area, shoot, ring } = H();
  const pct = e.hp / e.maxHp, want = pct > 0.66 ? 1 : pct > 0.33 ? 2 : 3;
  if (want > e.phase && e.state !== 'under' && e.state !== 'erupt') {
    e.phase = want; cancelAreasOf(sim, e); setState(e, 'roar'); e.invuln = 0; e.untargetable = 0; // (game loop C: no invulnerable roar; the phase change is a breather on HP only)
    sim.emit({ type: 'bossPhase', phase: e.phase, x: e.x, y: e.y, id: e.id });
    sim.emit({ type: 'dunes', ph: 'queenRoar', phase: e.phase, x: Math.round(e.x), y: Math.round(e.y) });
    for (const p of sim.players.values()) if (!p.dead && dTo(e, p) < 330 && !evadeShove(sim, p)) { const a = angTo(e, p); p.vx += Math.cos(a) * 900; p.vy += Math.sin(a) * 900; }
    return;
  }
  const fast = e.phase === 3 ? 0.75 : 1;
  switch (e.state) {
    case 'roar': if (e.st >= 70) { setState(e, 'idle'); e.cd = 30; } return;
    case 'under': {
      e.untargetable = 1;
      move(e, angTo(e, t), 2.2);
      if (e.st >= 60 * fast) {
        e.x = e.px = t.x; e.y = e.py = t.y;
        const A = e.arena, dx = e.x - A.x, dy = e.y - A.y, dd = Math.hypot(dx, dy); if (dd > A.r - e.r) { const k = (A.r - e.r) / dd; e.x = e.px = A.x + dx * k; e.y = e.py = A.y + dy * k; }
        setState(e, 'erupt');
        { for (const b of slamBeats({ shape: 'circle', x: e.x, y: e.y, r: 150, delay: Math.round(52 * fast), mul: 1.6, kb: 520, stun: 18, kind: 'erupt' })) area(sim, e, b); }
      }
      return;
    }
    case 'erupt':
      if (e.st >= Math.round(52 * fast)) {
        e.untargetable = 0;
        ring(sim, e, 18, 210, sim.rng.next(), { r: 11, style: 'sand', mul: 0.8 });
        sim.emit({ type: 'dunes', ph: 'erupt', id: e.id, x: Math.round(e.x), y: Math.round(e.y), r: 150, big: 1 });
        if (e.again > 0) { e.again--; setState(e, 'under'); } else { setState(e, 'idle'); e.cd = Math.round(55 * fast); }
      }
      return;
    case 'sandstorm':
      if (e.st % 7 === 0) { const arms = e.phase === 3 ? 4 : 3; for (let i = 0; i < arms; i++) shoot(sim, e, e.rot + (i / arms) * TAU, 190, { r: 10, style: 'sand', mul: 0.75, life: 170 }); e.rot += 0.19; }
      if (e.st >= 150) { setState(e, 'idle'); e.cd = Math.round(55 * fast); }
      return;
    case 'glass':
      if (e.st >= 56) { setState(e, 'idle'); e.cd = Math.round(50 * fast); }
      return;
    case 'quake':
      if (e.st >= 70) { setState(e, 'idle'); e.cd = Math.round(50 * fast); }
      return;
    case 'summon':
      if (e.st >= 50) { setState(e, 'idle'); e.cd = Math.round(45 * fast); }
      return;
    default: {
      const d = dTo(e, t);
      if (d > 150) move(e, angTo(e, t), 0.9);
      if (e.cd > 0) return;
      const rot = KROT[e.phase], m = rot[e.attackIdx % rot.length]; e.attackIdx++;
      e.lock = angTo(e, t);
      if (m === 'burrow' || m === 'burrow2') { e.again = m === 'burrow2' ? 1 : 0; setState(e, 'under'); sim.emit({ type: 'dunes', ph: 'dive', id: e.id, x: Math.round(e.x), y: Math.round(e.y), big: 1 }); }
      else if (m === 'sandstorm') { e.rot = e.lock; setState(e, 'sandstorm'); }
      else if (m === 'glass') {
        setState(e, 'glass');
        for (const o of e.phase >= 2 ? [-0.5, -0.17, 0.17, 0.5] : [-0.35, 0, 0.35]) area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.lock + o, len: 640, w: 46, delay: 56, mul: 1.4, kb: 260, kind: 'sunray' });
      } else if (m === 'quake') {
        setState(e, 'quake');
        const A = e.arena;
        for (let i = 0; i < 7; i++) { const a = sim.rng.next() * TAU, r = Math.sqrt(sim.rng.next()) * (A.r - 40); area(sim, e, { shape: 'circle', x: A.x + Math.cos(a) * r, y: A.y + Math.sin(a) * r, r: 85, delay: 60 + i * 4, mul: 1.2, kb: 260, kind: 'erupt' }); }
        area(sim, e, { shape: 'circle', x: t.x, y: t.y, r: 85, delay: 64, mul: 1.2, kb: 260, kind: 'erupt' });
      } else {
        setState(e, 'summon');
        const alive = sim.enemies.filter((x) => !x.dead && x.summonOf === e.id).length;
        const kinds = e.phase === 3 ? ['scarab', 'scarab', 'sandwurm'] : ['scarab', 'scarab', 'scarab'];
        if (alive < 5) kinds.forEach((k, i) => { const a = e.face + (i - 1) * 0.9; const m2 = spawnEnemy(sim, k, e.x + Math.cos(a) * 110, e.y + Math.sin(a) * 110, { mul: 1.4, tier: 4, zoneHp: false }); m2.summonOf = e.id; m2.xp = Math.round(m2.xp * 0.3); m2.dropChance = 0.1; m2.homeX = e.arena.x; m2.homeY = e.arena.y; });
        sim.emit({ type: 'dunes', ph: 'brood', x: Math.round(e.x), y: Math.round(e.y) });
      }
    }
  }
}
