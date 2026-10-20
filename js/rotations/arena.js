// Rotation preview arenas (pure sim, no DOM): shared by the headless optimizer and the in-browser preview page.
//   boss : Grimtusk as a pinned training boss (real model, armour 55, never attacks, never moves, HP held at 60%: no execute range)
//   mob  : a 10-mob pack (wolves / imps / knights / golems) that chases the hero but never attacks; each mob that dies is
//          replaced 1 s later on a ring around the hero, so there is always a pack to clear.
import { Rng } from '../sim/rng.js';
import { generateItem } from '../sim/loot.js';
import { BOSS_POS } from '../sim/constants.js';

export const HERO_LEVEL = 30;
export const GEAR_TIER = { tier: 5, rarity: 2, up: 4 }; // one consistent tier for every class (Frostveil-tier rare gear, +4, no set / exotic procs)
export const BOSS_HP = 5e7, BOSS_HOLD = 0.6;
export const PACK = ['wolf', 'wolf', 'wolf', 'imp', 'imp', 'knight', 'knight', 'golem', 'wolf', 'imp'];
export const PACK_HP = 6; // pack HP multiplier (a level-30 hero one-shots plain mobs otherwise)
export const RESPAWN = 60;
export const ARENA = { x: BOSS_POS.x, y: BOSS_POS.y + 150 }; // the open Grimtusk arena (the balance harness tunes everything here)

export function heroGear(cls, seed = 1) {
  const eq = {};
  // gear expansion: the full 10-slot kit (relic aside), so the arena hero keeps about the old 3-slot power
  for (const key of ['weapon', 'offhand', 'helm', 'armor', 'gloves', 'boots', 'ring', 'ring2', 'amulet']) {
    const slot = key === 'ring2' ? 'ring' : key;
    const it = generateItem(new Rng(seed * 31 + key.length * 7 + 3 + (key === 'ring2' ? 101 : 0)), { tier: GEAR_TIER.tier, cls, slot, rarity: GEAR_TIER.rarity });
    it.up = GEAR_TIER.up; delete it.ex; delete it.set;
    eq[key] = it;
  }
  return eq;
}
export function addHero(sim, cls, seed = 1, char = {}) {
  const p = sim.addPlayer({ name: 'Trainee', cls, level: HERO_LEVEL, xp: 0, equipment: heroGear(cls, seed), ...char });
  p.x = p.px = ARENA.x - 200; p.y = p.py = ARENA.y;
  return p;
}

/** Arena controller: call setup() once, then before() / after() around every sim.step(). Tracks damage + kills. */
export class Arena {
  constructor(sim, p, view) { this.sim = sim; this.p = p; this.view = view; this.dealt = 0; this.kills = 0; this.ticks = 0; this.queue = []; this.hp = new Map(); }
  setup() {
    const { sim } = this;
    if (this.view === 'boss') {
      const b = sim.spawnEnemy('boss', ARENA.x + 60, ARENA.y);
      b.maxHp = b.baseMaxHp = BOSS_HP; b.hp = BOSS_HP * BOSS_HOLD; b.dropChance = 0; b.xp = 0;
      this.boss = b; this.home = { x: b.x, y: b.y };
    } else {
      for (let i = 0; i < PACK.length; i++) this.spawnMob(PACK[i], i);
    }
    return this;
  }
  spawnMob(type, i) {
    const a = (i * 2.399) % (Math.PI * 2), r = 230 + (i % 3) * 45;
    const cx = this.p ? this.p.x : ARENA.x, cy = this.p ? this.p.y : ARENA.y;
    // keep the pack inside the arena: pull the spawn ring toward the arena centre when the hero has wandered
    const ox = (cx + ARENA.x) / 2, oy = (cy + ARENA.y) / 2;
    const e = this.sim.spawnEnemy(type, ox + Math.cos(a) * r, oy + Math.sin(a) * r, { hpMul: PACK_HP, zoneHp: false });
    e.dropChance = 0; e.xp = 0; e.cd = 1e6; e.cd2 = 1e6;
    return e;
  }
  before() {
    const { sim, p } = this;
    p.hp = p.stats.maxHp; p.dead = false;
    if (this.boss) {
      const b = this.boss;
      b.dead = false; b.hp = BOSS_HP * BOSS_HOLD;
      b.x = b.px = this.home.x; b.y = b.py = this.home.y; b.vx = b.vy = 0;
      b.cd = Math.max(b.cd, 60); b.cd2 = Math.max(b.cd2 || 0, 60);
      if (b.state !== 'idle' && b.state !== 'chase') { b.state = 'idle'; b.st = 0; }
    } else {
      for (const e of sim.enemies) { if (!e.dead) { e.cd = Math.max(e.cd, 600); e.cd2 = Math.max(e.cd2 || 0, 600); } }
    }
    this.hp.clear();
    for (const e of sim.enemies) if (!e.dead) this.hp.set(e, e.hp);
  }
  after() {
    const { sim } = this;
    this.ticks++;
    for (const [e, h0] of this.hp) {
      const d = h0 - Math.max(0, e.hp);
      if (d > 0) this.dealt += d;
      if (!this.boss && (e.dead || e.hp <= 0) && !e._counted) { e._counted = true; this.kills++; this.queue.push({ type: e.type, t: sim.tick + RESPAWN }); }
    }
    if (!this.boss) {
      // drop corpses from the list so it doesn't grow (the sim keeps dead enemies around briefly for death fx)
      for (let i = this.queue.length - 1; i >= 0; i--) if (this.queue[i].t <= sim.tick) { const q = this.queue.splice(i, 1)[0]; this.spawnMob(q.type, this.kills + i); }
    }
  }
  get dps() { return this.dealt / Math.max(1, this.ticks / 60); }
}
