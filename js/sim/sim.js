// The simulation root. Fixed-timestep, input-command driven, no DOM/rendering/audio.
// A future authoritative server would own one Sim, feed it per-player input commands each tick,
// and broadcast snapshots + the event stream; clients would run the same code for prediction.
import { resolveCircle } from './world.js';
import { Rng } from './rng.js';
import { WORLD_SEED, secs, zoneAt } from './constants.js';
import { generateWorld } from './world.js';
import { createPlayer, updatePlayer, handleCommand, refreshStats } from './player.js';
import { tickLoadout } from './loadout.js';
import { spawnEnemy, updateEnemy } from './ai.js';
import { updateProjectiles, updateAreas } from './combat.js';
import { updateSetpieces } from './setpiece.js';
import { serializeCharacter } from './save.js';
import { updateRaid } from './raid.js';
import { updateAstrael } from './astrael.js';
import { updateTrial } from './trials.js';
import { updateGear } from './exotic.js';
import { createHub, updateHub, hubJoin, updatePractice, startMission as hubStart, returnToTown as hubHome } from './hub.js';
import { updateDunes } from './dunes.js';
import { updateTomb } from './tomb.js';
import { updateFrost } from './frost.js';
import { updateCrypt } from './crypt.js';
import { updateGlow } from './glowmire.js';
import { updateUlt } from './ultimate.js';
import { updateDuel } from './shadowduel.js'; // (Part B: the Shadow Duel)
import { createFissures, updateFissures } from './fissure.js'; // (Part A4: Astral Fissures)
import { updateEmber } from './ember.js';
import { updateRift } from './rift.js';
import { updateForge } from './forge.js';
import { updateHordeAoe } from './hordeaoe.js';
import { hordeKill, fodderPartyMul } from './horde.js';
import { createSites, updateSites, updateFodder } from './sites.js';
import { updateDrops } from './drops.js';
import { updateOps, updateOpsAi } from './ops.js';
import { updateAstralBosses } from './astralboss.js'; // (Part C2: Astral boss mechanics)

const ACTIVE_R = 1250;
const FAR_IDLE_R = 800; // (perf, world 2: idle enemies beyond this box from every hero tick at half rate; aggro range is 400)
const RESPAWN_R = 2600;
const DESPAWN_R = 3400; // (square distance) camps beyond this from every player are packed away // camps only refill near players (the big maps would otherwise keep ~1000 enemies alive for nobody)
export const PARTY_HP = 0.55;       // +55% enemy HP per extra player
export const PARTY_BOSS_HP = 0.9;   // +90% boss HP per extra player (encounter pass: 0.7 -> 0.9, a 4-party lands in the solo window)
export const MAX_PARTY = 6;

export class Sim {
  constructor(opts = {}) {
    this.seed = opts.seed ?? 12345;
    this.predicting = !!opts.predicting; // client-side prediction sim: never applies heals/shields (server-authoritative)
    this.rng = new Rng(this.seed);
    this.tick = 0;
    this.nextId = 1;
    this.world = opts.world || generateWorld(opts.worldSeed ?? WORLD_SEED);
    this.players = new Map();
    this.enemies = [];
    this.enemyById = new Map();
    this.projectiles = [];
    this.areas = [];
    this.bags = [];
    this.events = [];
    this.eliteChance = opts.eliteChance ?? 0.1;
    if (opts.fissures ?? (this.spawnOn && !this.predicting)) createFissures(this); // (Part A4)
    this.smartMobs = opts.smartMobs ?? true; // (Part A3: roles + affixes; the scripted intro turns them off so its beats stay identical)
    this.spawners = this.world.spawners.map((s) => ({ ...s, alive: [], respawnAt: 0 }));
    this.stats = { enemyUpdates: 0 };
    this.spawnOn = opts.spawnEnemies !== false; // (an empty sim - tests, bots, the client's prediction sim - never respawns camps either)
    // perf pass 2: camps are lazy. World bosses spawn up front; every other camp spawns the first time a player comes within
    // RESPAWN_R and is packed away again (quietly, no loot) once everyone is far and the camp is untouched - so a big map
    // keeps ~100-250 live enemies instead of ~1100. opts.lazyCamps = false restores the old "spawn everything" start.
    this.lazyCamps = opts.lazyCamps !== false;
    // spawns pass: with spawning on, fixed spawn sites (big fodder clusters round landmarks) + Swarm events replace the
    // ordinary small camps (sim/sites.js; elite packs and bosses all stay). opts.horde = false: the old camps-only world.
    this.drops = [];
    this.hordeScale = opts.hordeScale ?? 1;
    this.showers = opts.showers ?? this.spawnOn; // loot showers + vacuum (sim/drops.js): on in a live world; off in an empty test / bot sim (opt in with showers: true)
    this.horde = this.spawnOn && opts.horde !== false ? createSites(this) : null;
    if (this.horde && this.horde.sites.length) for (const sp of this.spawners) if (!sp.boss && !sp.elitePack) sp.off = true;
    if (this.spawnOn) for (const sp of this.spawners) if (!sp.off) { if (!this.lazyCamps || sp.boss) this.spawnGroup(sp); else { sp.respawnAt = 1; sp.fresh = true; } }
    this.hub = null;
    if (opts.hub && !this.predicting) createHub(this); // the Brightwater Village hub loop (sim/hub.js)
  }

  id() { return this.nextId++; }
  emit(ev) { ev.tick = this.tick; this.events.push(ev); if (this.events.length > 4000) this.events.splice(0, 1000); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  /**
   * Add a player. `opts` ({x, y, hp, res}) restores a reconnecting player's position/vitals.
   * Joining/leaving rescales living enemies' HP to the party size (no effect with one player).
   */
  addPlayer(charData, opts = null) {
    const p = createPlayer(this, charData);
    if (opts) {
      if (Number.isFinite(opts.x) && Number.isFinite(opts.y)) { p.x = p.px = opts.x; p.y = p.py = opts.y; }
      if (Number.isFinite(opts.hp) && opts.hp > 0) p.hp = Math.min(p.stats.maxHp, opts.hp);
      if (Number.isFinite(opts.res)) p.res = Math.max(0, Math.min(p.stats.maxRes, opts.res));
    }
    this.players.set(p.id, p);
    if (this.hub && !opts?.keepPos) hubJoin(this, p, !!opts && Number.isFinite(opts.x));
    this.rescaleEnemies();
    return p;
  }
  /**
   * Heroes tab: swap a player to another hero IN PLACE (same id, spot, vitals share, shared bag) - no reload, works the
   * same in solo, on the phone and on the co-op server. The new hero's level, xp, gear, loadouts and chain setup come
   * from `charData`; its class state starts fresh; the old hero's live projectiles / zones vanish.
   */
  swapHero(p, charData) {
    if (!p || !charData || typeof charData !== 'object') return false;
    const hpFrac = p.stats && p.stats.maxHp > 0 ? Math.max(0.05, p.hp / p.stats.maxHp) : 1;
    const np = createPlayer(this, { ...charData, inventory: p.inventory, bagSize: p.inventory.length });
    const keep = { id: p.id, x: p.x, y: p.y, px: p.x, py: p.y, commands: p.commands, dead: p.dead, respawnAt: p.respawnAt };
    for (const k of ['arc', 'drg', 'monk', 'sam', 'wm', 'eclipse', 'clones', 'uw', 'cst', 'sched', 'wq']) delete p[k];
    Object.assign(p, np, keep);
    p.hp = p.dead ? 0 : Math.max(1, Math.round(p.stats.maxHp * hpFrac));
    this.projectiles = this.projectiles.filter((o) => o.ownerId !== p.id);
    this.areas = this.areas.filter((o) => o.ownerId !== p.id);
    p.dirty = true;
    this.events.push({ type: 'heroSwap', pid: p.id, cls: p.cls, name: p.name, x: p.x, y: p.y });
    return true;
  }
  removePlayer(id) { if (this.players.delete(id)) this.rescaleEnemies(); }
  /** Reassign a (reconnected) player's soulbound bags from their old id to the new one. */
  transferBags(fromId, toId) { for (const b of this.bags) if (b.ownerId === fromId) b.ownerId = toId; }

  // ---- co-op scaling: more players -> tougher enemies and bigger groups (identity for 1 player)
  partySize() { return Math.max(1, Math.min(6, this.players.size)); }
  partyHpMul(boss = false) { const n = this.partySize() - 1; return 1 + n * (boss ? PARTY_BOSS_HP : PARTY_HP); }
  partyExtraSpawns() { return Math.floor((this.partySize() - 1) / 2); }
  rescaleEnemies() {
    for (const e of this.enemies) {
      if (e.dead || !e.baseMaxHp || e.raid) continue; // (the raid boss scales with the players in its arena at the pull)
      const maxHp = Math.round(e.baseMaxHp * (e.horde ? fodderPartyMul(this) : this.partyHpMul(e.boss))); // (fodder: a gentler per-hero bump)
      if (maxHp === e.maxHp) continue;
      const k = e.hp / e.maxHp;
      e.maxHp = maxHp;
      e.hp = Math.max(1, Math.round(maxHp * k));
    }
  }
  spawnEnemy(type, x, y, opts) { return spawnEnemy(this, type, x, y, opts); }
  hordeKill(e, killer) { if (this.horde) hordeKill(this, e, killer); }

  /**
   * Continuous input for a player. {mx,my} movement in [-1,1], {ax,ay} aim point in world coords,
   * attack (held), skill: 'Q'|'E'|'R'|'F' (edge), dodge (edge). Edges are latched until consumed.
   */
  setInput(pid, input) {
    const p = this.players.get(pid);
    if (!p) return;
    const i = p.input;
    i.mx = input.mx || 0; i.my = input.my || 0;
    if (input.ax != null) { i.ax = input.ax; i.ay = input.ay; }
    i.attack = !!input.attack; i.sprint = !!input.sprint; // (sprint: held / toggled; only works out of combat)
    if (input.skill) { p.pendingSkill = input.skill; p.pendingCharge = Math.max(0, Math.min(120, input.charge | 0)); } // charge: ticks the key was held (Warrior hold-to-spend)
    i.hold = input.hold || null; // the skill key being held right now (Warrior Rage charge-up)
    if (input.dodge) p.pendingDodge = true;
    if (input.ult) p.pendingUlt = true;
  }
  /** Discrete commands: equip/unequip/drop/take/takeAll/swap. Applied at the start of next tick. */
  command(pid, cmd) { const p = this.players.get(pid); if (p) p.commands.push(cmd); }
  /** run queued UI commands without stepping the world (solo: the menu hub / pause hold the sim, but equipping, locking,
   *  stashing and loadout swaps in town still apply at once). Returns true if anything ran. */
  flushCommands() { let n = 0; for (const p of this.players.values()) while (p.commands.length) { handleCommand(this, p, p.commands.shift()); n++; } return n > 0; }

  spawnGroup(sp) {
    sp.alive = [];
    let group = sp.group;
    const extra = sp.boss ? 0 : this.partyExtraSpawns();
    if (extra > 0) { group = group.slice(); for (let i = 0; i < extra; i++) group.push(sp.group[i % sp.group.length]); }
    group.forEach((type, i) => {
      const a = (i / group.length) * Math.PI * 2 + this.rng.next();
      const r = group.length > 1 ? 40 + this.rng.next() * 30 : 0;
      const elite = sp.elitePack ? true : !sp.boss && sp.zone >= 2 && this.rng.next() < this.eliteChance; // (elite packs: every member)
      const e = spawnEnemy(this, type, sp.x + Math.cos(a) * r, sp.y + Math.sin(a) * r, { spawnerId: sp.id, elite, mul: sp.mul, hpMul: sp.hpMul, tier: sp.tier });
      sp.alive.push(e.id);
    });
    sp.respawnAt = 0;
  }

  updateSpawners() {
    const pl = []; for (const p of this.players.values()) if (!p.dead) pl.push(p);
    for (const sp of this.spawners) {
      if (sp.off) continue;
      if (sp.respawnAt === 0) {
        sp.alive = sp.alive.filter((id) => { const e = this.enemyById.get(id); return e && !e.dead; });
        if (sp.alive.length === 0) { sp.respawnAt = this.tick + secs(sp.boss ? 90 : sp.elitePack ? 75 : 16 + sp.zone * 5); continue; }
        if (this.lazyCamps && !sp.boss) { // pack away a far, untouched camp (it comes back fresh when someone returns)
          let far = true; for (const p of pl) if (Math.abs(p.x - sp.x) < DESPAWN_R && Math.abs(p.y - sp.y) < DESPAWN_R) { far = false; break; }
          if (far && pl.length && sp.alive.every((id) => { const e = this.enemyById.get(id); return e.hp >= e.maxHp && !e.target; })) {
            for (const id of sp.alive) { const e = this.enemyById.get(id); e.dead = true; e.despawned = true; }
            sp.alive = []; sp.respawnAt = 1; sp.fresh = true;
          }
        }
      } else if (this.tick >= sp.respawnAt) {
        let near = false, any = false;
        for (const p of pl) { const d = Math.hypot(p.x - sp.x, p.y - sp.y); if (d < (sp.boss ? 700 : 480)) near = true; if (d < RESPAWN_R) any = true; }
        if (!any) continue; // nobody anywhere near: the camp waits (respawns once someone comes within RESPAWN_R, still out of sight)
        if (!near || sp.fresh) { sp.fresh = false; this.spawnGroup(sp); } else sp.respawnAt = this.tick + secs(3);
      }
    }
  }

  step() {
    this.posCheck = 0; // (dodge pass 2 step 3: set by an engine while it resolves a position check)
    this.tick++;
    const players = [...this.players.values()];
    for (const p of players) {
      p.px = p.x; p.py = p.y;
      while (p.commands.length) handleCommand(this, p, p.commands.shift());
      if (p.loCast && tickLoadout(this, p)) refreshStats(p); // step 4: a loadout swap's short cast (sim/loadout.js)
      updatePlayer(this, p);
    }
    let n = 0;
    const act = this._act || (this._act = []); act.length = 0;
    for (const e of this.enemies) {
      e.px = e.x; e.py = e.y;
      if (e.dead) continue;
      let active = false, near = false;
      for (const p of players) if (Math.abs(p.x - e.x) < ACTIVE_R && Math.abs(p.y - e.y) < ACTIVE_R) { active = true; if (Math.abs(p.x - e.x) < FAR_IDLE_R && Math.abs(p.y - e.y) < FAR_IDLE_R) { near = true; break; } }
      if (!active && !e.opsM) continue; // (mission mobs always think: they walk to the objective from across the arena)
      // perf (world 2): an awake but idle, unhurt, non-boss enemy far from every hero only thinks every 2nd tick (staggered by id)
      if (!near && !e.boss && e.state === 'idle' && !e.aggroId && e.hp >= e.maxHp && !e.vx && !e.vy && ((this.tick + e.id) & 1)) { act.push(e); continue; }
      if (e.opsAi) updateOpsAi(this, e); else if (e.horde) updateFodder(this, e); else updateEnemy(this, e); // (fodder: the light site AI with its type's attack, sim/sites.js)
      act.push(e);
      n++;
    }
    this.stats.enemyUpdates = n;
    this.separateEnemies(players, act); // (only the awake ones: sleeping camps far from everyone never move)
    updateProjectiles(this);
    updateAreas(this);
    if (this.sp || this.cine) updateSetpieces(this); // (encounter revamp Part 0: set pieces + cine moments, sim/setpiece.js)
    updateHub(this);   // hub missions / return to town (sim/hub.js; no-op without a hub)
    if (this.practice) updatePractice(this, hubStart, hubHome); // Part E: practice runs (sim/practice.js)
    updateRaid(this);
    updateDuel(this);
    updateAstrael(this); // Astrael, the Last Constellation (sim/astrael.js)
    updateGear(this);    // Trial / Extreme procs + set mechanics on a timer (sim/exotic.js)
    updateTrial(this);   // the Frostveil / Emberdeep trials: Skaldra + Pyrrhex (Trial / Extreme) (sim/trials.js)
    updateDunes(this);   // Sunscorch Dunes: Tomb portals, Solar Glyphs (sim/dunes.js)
    updateTomb(this);    // the Tomb of the Sun-Eaten King + Neferakh (sim/tomb.js)
    updateFrost(this);   // Frostveil Peaks: Glacier Crypt portals (sim/frost.js)
    updateCrypt(this);   // the Glacier Crypt + Osric (sim/crypt.js)
    updateFissures(this); // Astral Fissures on the normal maps (sim/fissure.js)
    updateUlt(this);     // the Ultimate: the Unwritten (sim/ultimate.js, Part F)
    updateGlow(this);    // the Glowmire Hollow (Lumivex) + the Stormcrown Tor (Vharok) (sim/glowmire.js)
    updateEmber(this);   // Emberdeep Caldera: lava, vents, Forge portals (sim/ember.js)
    updateRift(this);    // the Astral Rift: void tears, starwells (sim/rift.js, game loop C3)
    updateForge(this);   // the Forge of Cinders + Hephast (sim/forge.js)
    if (this.ab) updateAstralBosses(this, spawnEnemy); // the Astral World's boss layer (sim/astralboss.js)
    updateOps(this);     // mission dungeons: Defense / Mobile Defense / Assault / Capture / Swarm (sim/ops.js)
    updateDrops(this);   // loot showers: gold / orbs / gear pop out, the vacuum pulls them in (sim/drops.js)
    for (const b of this.bags) if (--b.life <= 0) b.dead = true;
    this.bags = this.bags.filter((b) => !b.dead);
    if (this.enemies.some((e) => e.dead)) {
      for (const e of this.enemies) if (e.dead) this.enemyById.delete(e.id);
      this.enemies = this.enemies.filter((e) => !e.dead);
    }
    if (this.spawnOn && (this.tick % 30 === 0 || this.tick === 2)) this.updateSpawners();
    if (this.horde) updateSites(this); // spawn sites, Swarm events, dungeon nests (sim/sites.js)
    if (this.hordeAoe) updateHordeAoe(this); // lingering horde chain bursts (sim/hordeaoe.js)
  }

  separateEnemies(players, list = this.enemies) {
    // cheap spatial hash separation so crowds don't stack; players push enemies aside
    const cell = 64, grid = new Map();
    for (const e of list) {
      if (e.dead || e.boss) continue;
      const k = (Math.floor(e.x / cell) + 4096) * 8192 + (Math.floor(e.y / cell) + 4096); // (numeric cell key: no string building per enemy per tick)
      let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(e);
    }
    for (const e of list) {
      if (e.dead) continue;
      const cx = Math.floor(e.x / cell) + 4096, cy = Math.floor(e.y / cell) + 4096;
      if (!e.boss) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const l = grid.get((cx + dx) * 8192 + (cy + dy));
        if (!l) continue;
        for (const o of l) {
          if (o === e || o.id < e.id) continue;
          const ddx = o.x - e.x, ddy = o.y - e.y, min = o.r + e.r, d2 = ddx * ddx + ddy * ddy;
          if (d2 < min * min && d2 > 0.01) {
            const d = Math.sqrt(d2), push = (min - d) * 0.5, nx = ddx / d, ny = ddy / d;
            const we = o.mass / (e.mass + o.mass), wo = 1 - we;
            e.x -= nx * push * we * 2; e.y -= ny * push * we * 2; o.x += nx * push * wo * 2; o.y += ny * push * wo * 2;
          }
        }
      }
      for (const p of players) {
        if (p.dead || e.untargetable) continue; // (a burrowed Sandwurm passes under you)
        const ddx = e.x - p.x, ddy = e.y - p.y, min = e.r + p.r - 4, d2 = ddx * ddx + ddy * ddy;
        if (d2 < min * min && d2 > 0.01) {
          const d = Math.sqrt(d2);
          if (e.boss || e.mass >= 3) { p.x -= (ddx / d) * (min - d); p.y -= (ddy / d) * (min - d); p.shoved = 1; }
          else { e.x += (ddx / d) * (min - d); e.y += (ddy / d) * (min - d); }
        }
      }
    }
    // a heavy body shoved a player: the walls win (otherwise a golem / mummy could pin you inside a rock: the "stuck" bug)
    for (const p of players) if (p.shoved) { p.shoved = 0; resolveCircle(this.world, p); }
  }

  /** Snapshot a player's persistent character data (for saving / sending to a DB). */
  exportCharacter(pid) { const p = this.players.get(pid); return p ? serializeCharacter(p) : null; }
  zoneOf(pid) { const p = this.players.get(pid); return p ? zoneAt(p.x, p.y) : null; }
}
