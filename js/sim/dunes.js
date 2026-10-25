// Sunscorch Dunes systems: Tomb portals (RotMG-style dungeon drops), Scarab splits, the Realm Gate unlock, chain hooks
// (the Sunscorch set's Solar Glyphs + the Tomb's chain challenges). Authoritative sim only (never predicted).
import { secs } from './constants.js';
import { DUNES_POS, DUNES_SPAWN, inDunesArea, inTombArea } from './dunesconst.js';
import { hitEnemy } from './combat.js';
import { spawnEnemy } from './ai.js';
import { addStacks } from './kit.js';
import { chainById, CLASSES } from './data/classes.js';
import { fourProc, GLYPH } from './sets.js';
import { gearFinisher } from './exotic.js';
import { enterTomb, tombChain } from './tomb.js';
import { cryptChain } from './crypt.js';
import { glowChain } from './glowmire.js';
import { forgeChain } from './forge.js';

export const PORTAL = { life: secs(150), r: 46, max: 4, chance: 0.012, eliteChance: 0.1 };
const r0 = (v) => Math.round(v);

/** Give every player in the world an unlock key (persisted by their client). */
export function unlockFor(sim, e, key) {
  for (const p of sim.players.values()) {
    p.unlocks = p.unlocks || {};
    const fresh = !p.unlocks[key];
    p.unlocks[key] = 1;
    sim.emit({ type: 'unlock', pid: p.id, key, fresh: fresh ? 1 : 0, x: r0(e ? e.x : p.x), y: r0(e ? e.y : p.y) });
  }
}

/** A Dunes / Tomb enemy died. */
export function dunesKill(sim, e) {
  if (e.fake) { sim.emit({ type: 'dunes', ph: 'shatter', id: e.id, x: r0(e.x), y: r0(e.y) }); return; }
  if (e.type === 'scarab') { // splits into two Scarablings
    for (let i = 0; i < 2; i++) {
      const a = sim.rng.next() * Math.PI * 2, m = spawnEnemy(sim, 'scarabling', e.x + Math.cos(a) * 18, e.y + Math.sin(a) * 18, { tier: e.zone });
      m.vx = Math.cos(a) * 260; m.vy = Math.sin(a) * 260; m.dropChance = 0.05; m.homeX = e.homeX; m.homeY = e.homeY;
      if (e.tombWave) { m.tombWave = 1; if (sim.tomb && sim.tomb.wave) sim.tomb.alive.push(m.id); }
    }
    sim.emit({ type: 'dunes', ph: 'split', id: e.id, x: r0(e.x), y: r0(e.y) });
  }
  // (missions pass: kills no longer drop Tomb portals; the Tomb has a fixed, always-open entrance by the Oasis:
  //  sim/opsconst.js placeOpsGates. dropPortal stays for dev tools / tests.)
  // (the old portal rolls still draw from sim.rng so seeded runs - the intro's compiled beat plan - stay identical)
  if (!inDunesArea(e.x, e.y) || inTombArea(e.x, e.y) || e.summonOf) return;
  if (!(e.type === 'khepra' || (e.boss && sim.rng.next() < 0.5))) sim.rng.next();
}
export function dropPortal(sim, x, y, big = false) {
  if (sim.noPortals) return null; // (the launch intro's showcase sims: no dungeon portals)
  const L = sim.tombPortals || (sim.tombPortals = []);
  if (L.length >= PORTAL.max) L.shift();
  const pt = { id: sim.id(), x: r0(x), y: r0(y), t: PORTAL.life, big: big ? 1 : 0 };
  L.push(pt);
  sim.emit({ type: 'dunes', ph: 'portal', x: pt.x, y: pt.y, big: pt.big });
  return pt;
}

/** A chain's finisher landed (combat.js hitEnemy, after the meter): Tomb challenges + Sunscorch Solar Glyphs. */
export function chainHooks(sim, p, pend, e) {
  if (sim.predicting || !pend) return;
  const ch = chainById(p.cls, pend.id);
  const steps = ch && ch.seq ? ch.seq.length : 2;
  if (sim.tomb) tombChain(sim, p, steps);
  if (sim.crypt) cryptChain(sim, p, steps);
  if (sim.glow) glowChain(sim, p, steps);
  if (sim.forge) forgeChain(sim, p, steps);
  gearFinisher(sim, p, e); // (gear expansion: the finisher 4-pieces, sim/exotic.js)
  if (fourProc(p) !== 'glyphs') return; // Sunscorch 4-piece
  const G = sim.glyphs || (sim.glyphs = []);
  const mine = G.filter((g) => g.pid === p.id);
  if (mine.length) { // the chain detonates every glyph you planted before it
    sim.glyphs = G.filter((g) => g.pid !== p.id);
    for (const g of mine) glyphBurst(sim, p, g, steps >= 4);
  }
  if (steps >= GLYPH.minSteps && !e.dead) {
    const left = (sim.glyphs || []).filter((g) => g.pid === p.id);
    if (left.length >= GLYPH.max) sim.glyphs.splice(sim.glyphs.indexOf(left[0]), 1);
    const g = { id: sim.id(), pid: p.id, eid: e.id, x: r0(e.x), y: r0(e.y), t: GLYPH.life, cls: p.cls };
    sim.glyphs.push(g);
    sim.emit({ type: 'dunes', ph: 'glyph', pid: p.id, cls: p.cls, x: g.x, y: g.y, id: g.id });
  }
}
function glyphBurst(sim, p, g, big) {
  const mul = big ? GLYPH.mul4 : GLYPH.mul;
  sim.emit({ type: 'dunes', ph: 'glyphBurst', pid: p.id, cls: p.cls, x: g.x, y: g.y, r: GLYPH.r, big: big ? 1 : 0 });
  const twist = TWIST[p.cls];
  for (const en of sim.enemies) {
    if (en.dead || en.untargetable || Math.hypot(en.x - g.x, en.y - g.y) > GLYPH.r + en.r) continue;
    const r = hitEnemy(sim, p, en, { mul, dot: true, style: 'solar', heavy: big, hitstop: 2, noPop: true, kbAng: Math.atan2(en.y - g.y, en.x - g.x) });
    if (r && twist && !en.dead) twist(sim, p, en);
  }
  if (p.cls === 'cleric') p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * 0.02);
  if (p.cls === 'bladedancer') p.res = Math.min(p.stats.maxRes, p.res + 1);
  if (p.cls === 'summoner') p.res = Math.min(p.stats.maxRes, p.res + 4);
}
const st = (kind, n = 1) => (sim, p, e) => { if (CLASSES[p.cls]) addStacks(sim, p, e, kind, n); };
const TWIST = { warrior: st('bleed'), ranger: st('quarry'), mage: st('burn', 2), cleric: st('condemn'), samurai: st('cut'), monk: st('pp'), dragoon: st('impaled'), bard: st('disso') };

/** Per tick: portal timers + step-ins, glyph timers (they follow their enemy). */
export function updateDunes(sim) {
  if (sim.predicting) return;
  const L = sim.tombPortals;
  if (L && L.length) {
    for (const pt of L) pt.t--;
    sim.tombPortals = L.filter((pt) => pt.t > 0);
    if (sim.tick % 6 === 0) for (const pt of sim.tombPortals) {
      for (const p of sim.players.values()) {
        if (p.dead || Math.hypot(p.x - pt.x, p.y - pt.y) > PORTAL.r) continue;
        if (sim.hub) { sim.hub.want = 'tomb'; sim.tombPortals = []; return; }
        enterTomb(sim, p);
      }
    }
  }
  if (sim.glyphs && sim.glyphs.length) {
    for (const g of sim.glyphs) { g.t--; const e = sim.enemyById.get(g.eid); if (e && !e.dead) { g.x = r0(e.x); g.y = r0(e.y); } }
    sim.glyphs = sim.glyphs.filter((g) => g.t > 0);
  }
}
export function packDunes(sim) {
  const tp = (sim.tombPortals || []).map((p) => [p.x, p.y, p.t, p.big]);
  const gl = (sim.glyphs || []).map((g) => [g.x, g.y, g.t, g.pid, g.cls]);
  return tp.length || gl.length ? { tp, gl } : null;
}
export { DUNES_POS, DUNES_SPAWN };
