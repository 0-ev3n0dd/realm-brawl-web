// World bosses of the open world (besides Grimtusk and Khepra): each sits in its own arena (e.arena, from the
// spawner site in sim/mapshape.js), walks home + heals when nobody is near (ai.js bossReset), has two phases
// (phase 2 at 50% HP: a roar that shoves you back, faster + nastier rotation) and a short list of telegraphed moves:
//   Thornmaw, the Elder Treant (Wilds, Danger 3): root lines, thorn rings, bramble patches, sprout saplings
//   Ashfang, the Pack Alpha (Wilds, Danger 4):    triple pounce, claw fans, howl (summons Ash Wolves), ash ring
//   Ankhara, the Glass Scorpion (Dunes, Danger 5): stinger lines, burrow + erupt under you, glass shard rings, scarabs
//   Sekhem, the Sun Colossus (Dunes, Danger 6):    sunfall circles, a rotating sun-beam cross, fire spiral, slam
// Loot: the boss table (4 items, a guaranteed legendary of the boss's signature slot; see WB.slot / combat.js).
import { AIH, spawnEnemy } from './ai.js';
import { cancelAreasOf, evadeShove, slamBeats } from './combat.js';
import { DT } from './constants.js';

import { WB } from './data/wbosses.js';
export { WB };

function wboss(sim, e, t) {
  const { setState, angTo, dTo, move, shoot, area, ring, contact } = AIH; // (read at run time: ai.js <-> worldboss.js import cycle)
  const W = WB[e.type]; if (!W) return;
  const pct = e.hp / e.maxHp, fast = e.phase >= 2 ? 0.78 : 1;
  if (e.phase < 2 && pct <= 0.5) {
    e.phase = 2; cancelAreasOf(sim, e); setState(e, 'roar'); e.invuln = 0; e.untargetable = 0; // (game loop C: no invulnerable roar; the phase change is a breather on HP only)
    sim.emit({ type: 'bossPhase', phase: 2, x: e.x, y: e.y, id: e.id });
    for (const p of sim.players.values()) if (!p.dead && dTo(e, p) < 300 && !evadeShove(sim, p)) { const a = angTo(e, p); p.vx += Math.cos(a) * 760; p.vy += Math.sin(a) * 760; }
    return;
  }
  const d = dTo(e, t), st = e.st;
  switch (e.state) {
    case 'roar': if (st >= 60) setState(e, 'idle'); return;
    case 'idle': {
      if (d > 210) move(e, angTo(e, t), 1); else if (d < 120) move(e, angTo(e, t) + Math.PI, 0.5);
      contact(sim, e, t, 0.8, 300);
      if (st >= Math.round(50 * fast)) { const r = W.rot[e.phase] || W.rot[1]; setState(e, r[e.attackIdx++ % r.length]); }
      return;
    }
    case 'slam': {
      const delay = Math.round(52 * fast);
      if (st === 1) { for (const b of slamBeats({ shape: 'circle', x: e.x, y: e.y, r: 210, delay, mul: 1.25, kb: 480, stun: 20, kind: 'slam', follow: e.id })) area(sim, e, b); }
      if (st === delay + 1) ring(sim, e, e.phase >= 2 ? 18 : 12, 220, sim.rng.next(), { r: 11, style: W.style, mul: 0.7 });
      if (st >= delay + 26) setState(e, 'idle');
      return;
    }
    case 'lines': { // root lines / stinger strikes: 3 (5 in phase 2) lanes fanned at you, then they erupt
      if (st === 1) {
        const a0 = angTo(e, t), n = e.phase >= 2 ? 5 : 3;
        for (let i = 0; i < n; i++) area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: a0 + (i - (n - 1) / 2) * 0.36, len: 640, w: 58, delay: Math.round(48 * fast), mul: 1.1, kb: 260, stun: 14, kind: e.type === 'thornmaw' ? 'roots' : 'stinger' });
      }
      if (st >= 80) setState(e, 'idle');
      return;
    }
    case 'ring': {
      const n = e.phase >= 2 ? 20 : 14;
      if (st === 10 || st === 34 || (e.phase >= 2 && st === 58)) ring(sim, e, n, 205, e.rot + st * 0.05, { r: 10, style: W.style, mul: 0.75 });
      if (st >= 76) { e.rot += 0.5; setState(e, 'idle'); }
      return;
    }
    case 'fan': { // claw / tail fans at you
      if (st === 8 || st === 28 || st === 48) { const a0 = angTo(e, t), n = e.phase >= 2 ? 9 : 7; for (let i = 0; i < n; i++) shoot(sim, e, a0 + (i - (n - 1) / 2) * 0.13, 300, { r: 9, style: W.style, mul: 0.7 }); }
      if (st >= 70) setState(e, 'idle');
      return;
    }
    case 'brambles': case 'sunfall': { // patches that erupt around you
      const n = e.state === 'sunfall' ? 10 : 8;
      if (st % 8 === 1 && st < n * 8) { const a = sim.rng.next() * Math.PI * 2, r = sim.rng.next() * 190; area(sim, e, { shape: 'circle', x: t.x + Math.cos(a) * r, y: t.y + Math.sin(a) * r, r: e.state === 'sunfall' ? 82 : 70, delay: 56, mul: 1.1, kb: 240, stun: 14, kind: e.state === 'sunfall' ? 'meteorE' : 'bramble', committed: true }); }
      if (st >= n * 8 + 50) setState(e, 'idle');
      return;
    }
    case 'pounce': { // three short charges, each re-aimed (Ashfang)
      const wind = Math.max(54, Math.round(34 * fast)), leg = wind + 26, k = Math.floor((st - 1) / leg), s = (st - 1) % leg; // (>= 0.9 s tell: combat audit step 1)
      if (k >= 3) { if (st >= 3 * leg + 40) setState(e, 'idle'); return; }
      if (s === 0) { e.lock = angTo(e, t); area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.lock, len: 430, w: e.r * 2 + 10, delay: wind, visual: true, kind: 'charge' }); }
      if (s > wind) { e.face = e.lock; e.x += Math.cos(e.lock) * 980 * DT; e.y += Math.sin(e.lock) * 980 * DT; contact(sim, e, t, 1.3, 520, 20); }
      return;
    }
    case 'howl': case 'summon': {
      if (st === 20) {
        const alive = sim.enemies.filter((x) => !x.dead && x.summonOf === e.id).length, n = W.n + (e.phase >= 2 ? 1 : 0);
        for (let i = alive; i < n; i++) {
          const a = sim.rng.next() * Math.PI * 2, m = spawnEnemy(sim, W.summon, e.x + Math.cos(a) * 130, e.y + Math.sin(a) * 130, { tier: e.zone, zoneHp: false });
          m.summonOf = e.id; m.xp = Math.round(m.xp * 0.3); m.dropChance = 0.08; m.homeX = e.homeX; m.homeY = e.homeY;
          sim.emit({ type: 'teleport', x: m.x, y: m.y, id: m.id });
        }
        sim.emit({ type: 'bossSummon', x: e.x, y: e.y });
      }
      if (st >= 50) setState(e, 'idle');
      return;
    }
    case 'burrow': { // dives (untargetable), tunnels under you, erupts
      if (st === 1) { e.untargetable = 1; sim.emit({ type: 'dunes', ph: 'burrow', id: e.id, x: Math.round(e.x), y: Math.round(e.y) }); }
      if (st < 60) { move(e, angTo(e, t), 2.2); return; }
      if (st === 60) { for (const b of slamBeats({ shape: 'circle', x: e.x, y: e.y, r: 160, delay: 34, mul: 1.3, kb: 520, stun: 24, kind: 'erupt' })) area(sim, e, b); }
      if (st === 94) { e.untargetable = 0; ring(sim, e, 12, 230, sim.rng.next(), { r: 10, style: W.style, mul: 0.7 }); }
      if (st >= 120) setState(e, 'idle');
      return;
    }
    case 'beams': { // a cross of sun beams that turns a little between bursts (Sekhem)
      const n = e.phase >= 2 ? 6 : 4;
      for (let b = 0; b < 3; b++) if (st === 1 + b * 30) for (let i = 0; i < n; i++) area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: e.rot + b * 0.26 + (i / n) * Math.PI * 2, len: 700, w: 52, delay: 44, mul: 1.0, kb: 200, stun: 10, kind: 'sunbeam', committed: true });
      if (st >= 130) { e.rot += 0.4; setState(e, 'idle'); }
      return;
    }
    case 'spiral': {
      move(e, angTo(e, t), 0.15);
      if (st % 6 === 0) { const arms = e.phase >= 2 ? 4 : 3; for (let i = 0; i < arms; i++) shoot(sim, e, e.rot + (i / arms) * Math.PI * 2, 210, { r: 10, style: 'fire', mul: 0.65 }); e.rot += 0.17; }
      if (st >= 110) setState(e, 'idle');
      return;
    }
    // ---- the Astral Rift's own moves (2026-10-15) ----
    case 'voidweb': { // Nyxara: a star web of void threads laid across you, turning between two waves, then it snaps
      const n = e.phase >= 2 ? 4 : 3;
      for (let w = 0; w < 2; w++) if (st === 1 + w * 34) { const a0 = angTo(e, t) + w * (Math.PI / (2 * n)); for (let i = 0; i < n; i++) area(sim, e, { shape: 'line', x: t.x - Math.cos(a0 + i * Math.PI / n) * 360, y: t.y - Math.sin(a0 + i * Math.PI / n) * 360, ang: a0 + i * Math.PI / n, len: 720, w: 40, delay: Math.round(46 * fast), mul: 0.95, kb: 220, stun: 12, kind: 'voidthread' }); sim.emit({ type: 'rift', ph: 'web', x: Math.round(t.x), y: Math.round(t.y), id: e.id }); }
      if (st >= 110) setState(e, 'idle');
      return;
    }
    case 'eclipse': { // Nyxara: draws everyone in (no stun), then a void nova + a ring of void tears
      if (st === 1) sim.emit({ type: 'rift', ph: 'eclipse', x: Math.round(e.x), y: Math.round(e.y), id: e.id });
      if (st < 54) for (const p of sim.players.values()) { if (p.dead || evadeShove(sim, p)) continue; const d = dTo(e, p); if (d < 520 && d > e.r + 60) { const a = Math.atan2(e.y - p.y, e.x - p.x); p.vx += Math.cos(a) * 30; p.vy += Math.sin(a) * 30; } }
      if (st === 6) area(sim, e, { shape: 'circle', x: e.x, y: e.y, r: 230, delay: Math.round(56 * fast), mul: 1.3, kb: 560, stun: 18, kind: 'voidnova', follow: e.id });
      if (st === 64) ring(sim, e, e.phase >= 2 ? 16 : 12, 240, sim.rng.next(), { r: 11, style: 'dark', mul: 0.7 });
      if (st >= 96) setState(e, 'idle');
      return;
    }
    case 'alignment': { // the Orrery: planets line up from it through you and ignite one after another
      if (st === 1) { e.lock = angTo(e, t); const n = e.phase >= 2 ? 7 : 5; for (let i = 0; i < n; i++) area(sim, e, { shape: 'circle', x: e.x + Math.cos(e.lock) * (110 + i * 105), y: e.y + Math.sin(e.lock) * (110 + i * 105), r: 74, delay: Math.round(40 * fast) + i * 9, mul: 1.0, kb: 260, stun: 10, kind: 'planet' }); sim.emit({ type: 'rift', ph: 'align', x: Math.round(e.x), y: Math.round(e.y), ang: +e.lock.toFixed(3), n, id: e.id }); }
      if (st >= 100) setState(e, 'idle');
      return;
    }
    case 'starfall': { // the Orrery: meteors rain round you in a widening spiral
      const n = e.phase >= 2 ? 14 : 10;
      if (st % 6 === 1 && st < n * 6) { const k = (st - 1) / 6, a = k * 2.4, r = 40 + k * 22; area(sim, e, { shape: 'circle', x: t.x + Math.cos(a) * r, y: t.y + Math.sin(a) * r, r: 58, delay: 40, mul: 0.8, kb: 180, stun: 6, kind: 'meteor' }); }
      if (st >= n * 6 + 46) setState(e, 'idle');
      return;
    }
    case 'riftblink': { // Zerath: steps through a rift to behind you, then cleaves
      if (st === 1) { sim.emit({ type: 'rift', ph: 'heraldOut', x: Math.round(e.x), y: Math.round(e.y), id: e.id }); }
      if (st === 16) { const a = angTo(e, t), nx = t.x + Math.cos(a) * 170, ny = t.y + Math.sin(a) * 170; e.x = e.px = nx; e.y = e.py = ny; e.vx = e.vy = 0; e.face = a + Math.PI; sim.emit({ type: 'rift', ph: 'heraldIn', x: Math.round(nx), y: Math.round(ny), id: e.id });
        area(sim, e, { shape: 'cone', x: nx, y: ny, ang: a + Math.PI, arc: 1.7, r: 300, delay: Math.round(42 * fast), mul: 1.35, kb: 520, stun: 20, kind: 'heraldcleave' }); }
      if (st >= 90) setState(e, 'idle');
      return;
    }
    case 'riftgrid': { // Zerath: rift tears carve a grid over the arena round you
      if (st === 1 || (e.phase >= 2 && st === 40)) { const a0 = angTo(e, t) + (st > 1 ? Math.PI / 4 : 0); for (const s2 of [-1, 0, 1]) for (const q of [0, Math.PI / 2]) { const b = a0 + q, ox = Math.cos(b + Math.PI / 2) * s2 * 150, oy = Math.sin(b + Math.PI / 2) * s2 * 150; area(sim, e, { shape: 'line', x: t.x + ox - Math.cos(b) * 380, y: t.y + oy - Math.sin(b) * 380, ang: b, len: 760, w: 38, delay: Math.round(50 * fast), mul: 0.9, kb: 200, stun: 10, kind: 'rifttear' }); } sim.emit({ type: 'rift', ph: 'grid', x: Math.round(t.x), y: Math.round(t.y), id: e.id }); }
      if (st >= 120) setState(e, 'idle');
      return;
    }
    default: setState(e, 'idle');
  }
}

export const WBOSS_AI = { wboss };
