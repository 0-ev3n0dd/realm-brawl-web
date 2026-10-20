// The raid: Vorthax, the Riftbound Tyrant, in The Rift Sanctum (a floating platform outside the world disc). A mechanic-
// driven fight in the style of Rabbit and Steel: a fixed timeline per phase, every attack telegraphed on the ground with
// a colour code before it lands, and group mechanics (stack / spread markers, tethers, a charge to aim away from the
// group, safe-zone patterns, bullet lanes). Solo gets fair, softened versions (a soak ring instead of a party stack, echo
// brands instead of allies, a tether to an anchor). Pure sim code; runs only on the authoritative sim (never predicted).
// The whole raid state lives in `sim.raid` as plain data (it is sent to co-op clients as-is and drawn by the renderer).
import { posTele } from './telegraph.js';
import { RAID_POS, RAID_R, SPAWN_POS, secs } from './constants.js';
import { damagePlayer, spawnProjectile, addArea, healPlayer, evadeShove } from './combat.js';
import { spawnEnemy } from './ai.js';
import { inCone, inLine, angDiff } from './math.js';
import { resolveCircle } from './world.js';

// Grimtusk's rift (fix pass): it opens RIFT_OFF px away from where he fell (never under the party), arms after RIFT_ARM,
// only takes a hero who steps INTO it after it armed (standing on the spot when it arms does nothing), and while any
// living hero still has the hunt's reward screen up (p.rwHold, cleared by the client's `rwDone` or after a timeout)
// it does not pull anyone - so the Wilds reward screen always comes first, solo and co-op.
export const RIFT = { off: 300, arm: secs(3), r: 46, life: secs(240) };
export function openRift(sim, x, y) {
  let pt = null;
  for (let k = 0; k < 16 && !pt; k++) { // the first clear spot on a ring around the death spot (deterministic: no rng)
    const a = -Math.PI / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8), q = { x: x + Math.cos(a) * RIFT.off, y: y + Math.sin(a) * RIFT.off, r: RIFT.r };
    const x0 = q.x, y0 = q.y; resolveCircle(sim.world, q);
    if (Math.hypot(q.x - x0, q.y - y0) < 1) pt = { x: x0, y: y0 };
  }
  if (!pt) pt = { x, y: y - RIFT.off };
  sim.riftPortal = { x: pt.x, y: pt.y, t: RIFT.life, arm: RIFT.arm, inside: [] };
  sim.emit({ type: 'raid', ph: 'portal', x: pt.x, y: pt.y });
  return sim.riftPortal;
}
/** heroes still reading the hunt's reward screen (the rift waits for them) */
export const riftHeld = (sim) => [...sim.players.values()].some((p) => !p.dead && p.rwHold > 0);

/** Tuning (fun + readable first; % values are of the player's max HP and ignore defence). */
export const RAID = {
  name: 'Vorthax, the Riftbound Tyrant', short: 'VORTHAX', arena: 'The Rift Sanctum',
  pull: secs(4), gap: [0, 54, 42, 32], enrage: { solo: secs(435), party: secs(450) }, /* (Oct 15 boss pass: Vorthax 500k -> 380k for the 3-4 min dungeon target; enrage kept) */ /* (DPS-UP pass: 360/375 -> 435/450 s with Vorthax 350k -> 500k) */ enragePct: 0.4, enrageEvery: 60,
  partyHp: 1.0, // +100% boss HP per extra player in the arena at the pull (balance pass: 1.3 -> 1.0, with the solo HP x3)
  ward: { at: [0.66, 0.33], solo: 0.05, party: 0.07, dur: secs(8), stun: secs(4), vuln: 1.5, collapse: { solo: 0.5, party: 0.7 } },
  cleave: { arc: { solo: 1.5, party: 1.85 }, len: 430, delay: 78, pct: 0.3 },
  lanes: { n: 10, preview: 90, speed: 300, pct: 0.12, rows: 2 },
  spread: { r: 120, delay: 150, self: 0.15, selfSolo: 0, ally: 0.35, echo: 0.25, pool: { r: 80, pct: 0.06, pulses: 8, every: 30, delay: 45 } },
  stack: { r: 115, delay: 180, total: 1.0, max: 0.85, soloIn: 0.12, soloOut: 0.35 },
  lance: { track: 84, delay: 108, w: 120, target: 0.25, other: 0.5, ring: 14, ringPct: 0.1, speed: 1500 },
  tether: { min: { solo: 360, party: 380 }, dur: 300, pct: 0.55 },
  eclipse: { delay: 150, pct: 0.6, orbR: 95, inR: 170 },
  spiral: { dur: 190, every: 6, arms: 3, speed: 220, pct: 0.1 },
  bolt: { every: 50, pct: 0.06, speed: 330 },
  mend: { solo: 0.14, party: 0.08, ward: 0.15 }, // Rift Mend: heal for resolving a mechanic cleanly (no damage taken during it) / breaking the ward
  hitstopCap: 12, // player hitstop (Chrono Field, Singularity...) can't freeze Vorthax for long
};
/** Phase timelines (each loops); transitions at 66% / 33% HP (the Rift Ward interrupt check). */
export const PHASES = {
  1: ['cleave', 'lanes', 'spread', 'cleave', 'stack', 'lance'],
  2: ['eclipse', 'tether', 'stackspread', 'lanes', 'lance', 'eclipse', 'spread', 'cleave'],
  3: ['eclipselanes', 'tetherlance', 'spiral', 'stackspread', 'eclipse', 'cleave', 'lanes'],
};
export const MECH_NAMES = {
  cleave: 'Riftcleave', lanes: 'Starfall Lanes', spread: 'Rift Brand', stack: 'Convergence', lance: 'Rift Lance', eclipse: 'Eclipse',
  tether: 'Soul Chain', stackspread: 'Brand + Convergence', eclipselanes: 'Eclipse + Starfall', tetherlance: 'Soul Chain + Rift Lance', spiral: 'Void Spiral',
};
export const RAID_COL = { danger: '#ff3b3b', safe: '#4dff88', stack: '#ffd84a', spread: '#c05cff', tether: '#5ff2ff', charge: '#ff4fd8', ward: '#8ff3ff' };

const alive = (sim) => [...sim.players.values()].filter((p) => !p.dead && inArena(p));
export const inArena = (p, pad = 40) => Math.hypot(p.x - RAID_POS.x, p.y - RAID_POS.y) < RAID_R + pad;
const bossOf = (sim) => sim.raid && sim.enemyById.get(sim.raid.bid);
const r0 = (v) => Math.round(v);

// ------------------------------------------------------------------ entry / exit
/** Teleport a player into the arena (starts the encounter if none is running). Returns true if it happened. */
export function enterRaid(sim, p) {
  if (sim.predicting || !p || p.dead) return false;
  const k = (p.id * 37) % 7;
  p.x = p.px = RAID_POS.x + (k - 3) * 26; p.y = p.py = RAID_POS.y + RAID_R - 70;
  p.vx = p.vy = 0; p.iframes = Math.max(p.iframes, 60); p.action = null;
  if (!sim.raid || sim.raid.st === 'victory') startRaid(sim);
  sim.emit({ type: 'raid', ph: 'enter', pid: p.id, x: r0(p.x), y: r0(p.y) });
  return true;
}
export function leaveRaid(sim, p) {
  if (sim.predicting || !p || p.dead || !inArena(p, 300)) return false;
  p.x = p.px = SPAWN_POS.x; p.y = p.py = SPAWN_POS.y + 40; p.vx = p.vy = 0; p.iframes = Math.max(p.iframes, 60);
  sim.emit({ type: 'raid', ph: 'leave', pid: p.id, x: r0(p.x), y: r0(p.y) });
  return true;
}
function startRaid(sim) {
  for (const e of sim.enemies) if (e.type === 'raidboss' && !e.dead) e.dead = true; // (never Astrael's)
  const b = spawnEnemy(sim, 'raidboss', RAID_POS.x, RAID_POS.y - 110);
  b.cd = 1e6; b.raidHold = 1e6; b.face = Math.PI / 2; b.dropChance = 1;
  sim.raid = { st: 'pull', t: 0, pull: RAID.pull, bid: b.id, phase: 1, seq: 0, next: 60, mech: null, tele: [], marks: [], teth: [], call: null,
    ward: null, stun: 0, enr: 0, enraged: false, party: false, n: 1, won: false, empty: 0, tid: 1, bolt: RAID.bolt.every, wardsBroken: 0, hits: {} };
  callout(sim, 'THE RIFT STIRS', `${RAID.name} awakens`, '#8ff3ff', RAID.pull);
  sim.emit({ type: 'raid', ph: 'pull', x: RAID_POS.x, y: RAID_POS.y, t: RAID.pull });
}
function endRaid(sim, why) {
  const R = sim.raid, b = bossOf(sim);
  if (b && !b.dead) { b.dead = true; b.hp = 0; }
  if (b) { for (const pr of sim.projectiles) if (pr.ownerId === b.id) pr.dead = true; for (const a of sim.areas) if (a.ownerId === b.id) a.dead = true; }
  sim.emit({ type: 'raid', ph: why, x: RAID_POS.x, y: RAID_POS.y, t: R ? r0(R.t / 60) : 0 });
  sim.raid = null;
}
function callout(sim, txt, sub, col, t = 150) { sim.raid.call = { txt, sub: sub || '', col: col || '#fff', t, d: t }; sim.emit({ type: 'raid', ph: 'call', txt, sub: sub || '', col: col || '#fff', x: RAID_POS.x, y: RAID_POS.y }); }

// ------------------------------------------------------------------ per-tick
export function updateRaid(sim) {
  if (sim.predicting) return;
  // Grimtusk's rift portal (in the world, for a few minutes after he falls): step in to enter the raid
  const rp = sim.riftPortal;
  if (rp) {
    if (--rp.t <= 0) sim.riftPortal = null;
    else if (rp.arm > 0) { if (--rp.arm <= 0) rp.inside = [...sim.players.values()].filter((p) => Math.hypot(p.x - rp.x, p.y - rp.y) < RIFT.r).map((p) => p.id); } // (whoever stands there when it arms must step out first)
    else if (sim.tick % 6 === 0) {
      const now = [...sim.players.values()].filter((p) => !p.dead && Math.hypot(p.x - rp.x, p.y - rp.y) < RIFT.r).map((p) => p.id);
      const entered = now.filter((id) => !(rp.inside || []).includes(id));
      rp.inside = now;
      if (entered.length && !riftHeld(sim)) {
        if (sim.hub) { sim.hub.want = 'vorthax'; sim.riftPortal = null; } // (hub: the whole party goes)
        else for (const id of entered) enterRaid(sim, sim.players.get(id));
      }
    }
  }
  for (const p of sim.players.values()) {
    if (p.wantRaid) { const w = p.wantRaid; p.wantRaid = 0; if (w === 'leave') leaveRaid(sim, p); else enterRaid(sim, p); }
  }
  const R = sim.raid;
  if (!R) return;
  const b = bossOf(sim);
  if (R.call && --R.call.t <= 0) R.call = null;
  const here = alive(sim);
  // exit portal (south rim) once the fight is over
  if (R.st === 'victory') {
    for (const p of here) if (Math.hypot(p.x - RAID_POS.x, p.y - (RAID_POS.y + RAID_R - 40)) < 40) { if (sim.hub) R.over = 1; else leaveRaid(sim, p); } // (hub: the exit rift takes the party home)
    if (!here.length && ++R.empty > 120) { if (sim.hub) R.over = 1; else sim.raid = null; }
    return;
  }
  if (R.won || !b || b.dead) { victory(sim); return; }
  // wipe / abandoned: nobody alive in the arena for 1 s -> reset
  if (!here.length) { if (++R.empty > 60) endRaid(sim, 'wipe'); return; }
  R.empty = 0;
  if (b.hitstop > RAID.hitstopCap) b.hitstop = RAID.hitstopCap;
  if (b.raidHold > 0 && b.raidHold < 1e5) b.raidHold--;
  if (R.st === 'pull') {
    if (--R.pull <= 0) {
      R.st = 'fight'; R.n = here.length; R.party = here.length >= 2; b.raidHold = 0; b.cd = 0;
      R.enr = R.party ? RAID.enrage.party : RAID.enrage.solo;
      const hp = Math.round(b.baseMaxHp * (1 + RAID.partyHp * (R.n - 1))); b.maxHp = hp; b.hp = hp;
      callout(sim, 'PHASE 1', MECH_NAMES.cleave + ' · ' + MECH_NAMES.lanes + ' · ' + MECH_NAMES.spread, '#8ff3ff', 120);
      sim.emit({ type: 'raid', ph: 'start', x: RAID_POS.x, y: RAID_POS.y, n: R.n, party: R.party, hp });
    }
    return;
  }
  R.t++;
  R.party = here.length >= 2;
  // enrage timer
  if (R.enr > 0 && --R.enr === 0) { R.enraged = true; callout(sim, 'RIFTFALL', 'Vorthax is ENRAGED', '#ff3b3b', 240); sim.emit({ type: 'raid', ph: 'enrage', x: RAID_POS.x, y: RAID_POS.y }); }
  if (R.enraged && R.t % RAID.enrageEvery === 0) for (const p of here) mechHit(sim, p, RAID.enragePct, 'Riftfall', true);
  // stun after a broken ward
  if (R.stun > 0) {
    b.raidHold = 2; b.vuln = R.stun; b.vulnMul = RAID.ward.vuln;
    if (--R.stun === 0) { b.vuln = 0; b.raidHold = 0; nextPhase(sim, b); }
    tickTele(sim, here);
    return;
  }
  if (R.ward) { tickWard(sim, b, here); tickTele(sim, here); return; }
  // phase transition check (the Rift Ward)
  const pct = b.hp / b.maxHp;
  if (R.phase < 3 && pct <= RAID.ward.at[R.phase - 1]) { startWard(sim, b, here); return; }
  // mechanics timeline
  if (R.mech) runMech(sim, b, R.mech, here);
  else if (--R.next <= 0) {
    const seq = PHASES[R.phase], id = R.forced || seq[R.seq % seq.length];
    if (R.forced) R.forced = null; else R.seq++;
    R.mech = { id, t: 0, dt0: new Map(here.map((p) => [p.id, p.dmgTaken || 0])) };
    sim.emit({ type: 'raid', ph: 'mech', id, name: MECH_NAMES[id], x: r0(b.x), y: r0(b.y) });
    runMech(sim, b, R.mech, here);
  }
  // rift bolts between mechanics (phase 2+): an aimed 3-shot at the aggro target
  if (!R.mech && R.phase >= 2 && --R.bolt <= 0) {
    R.bolt = RAID.bolt.every;
    const t = here.find((p) => p.id === b.aggroId) || here[0];
    const a = Math.atan2(t.y - b.y, t.x - b.x);
    for (const o of [-0.2, 0, 0.2]) bullet(sim, b, b.x, b.y, a + o, RAID.bolt.speed, 150, RAID.bolt.pct, 'rift');
  }
  tickTele(sim, here);
}

function victory(sim) {
  const R = sim.raid;
  R.st = 'victory'; R.wonAt = sim.tick; R.mech = null; R.tele = []; R.marks = []; R.teth = []; R.ward = null; R.empty = 0;
  callout(sim, `${RAID.short} FALLS!`, `Cleared in ${Math.floor(R.t / 3600)}:${String(Math.floor(R.t / 60) % 60).padStart(2, '0')} · ${sim.hub ? 'the exit rift leads home' : 'the exit rift is open'}`, '#ffe27a', 300);
  sim.emit({ type: 'raid', ph: 'victory', x: RAID_POS.x, y: RAID_POS.y, t: r0(R.t / 60) });
  // game loop C3: a clear opens Vorthax at the Mission Counter + finds the Astral Sanctum (attuned with his Rift Cores)
  for (const p of sim.players.values()) { p.unlocks = p.unlocks || {}; const fresh = !p.unlocks.vtx; p.unlocks.vtx = 1; sim.emit({ type: 'unlock', pid: p.id, key: 'vtx', fresh: fresh ? 1 : 0, x: RAID_POS.x, y: RAID_POS.y }); }
}

// ------------------------------------------------------------------ the Rift Ward (phase-transition interrupt check)
function startWard(sim, b, here) {
  const R = sim.raid;
  R.mech = null; R.tele = []; R.marks = []; R.teth = [];
  for (const pr of sim.projectiles) if (pr.ownerId === b.id) pr.dead = true;
  b.x = RAID_POS.x; b.y = RAID_POS.y; b.raidHold = 1e6; b.vx = b.vy = 0;
  const max = Math.round(b.maxHp * (R.party ? RAID.ward.party : RAID.ward.solo));
  R.ward = { hp: max, max, t: 0, d: RAID.ward.dur };
  b.ward = { hp: max, by: {} };
  callout(sim, 'BREAK THE WARD!', 'Vorthax channels Rift Collapse — skills hit the ward ×2', RAID_COL.ward, RAID.ward.dur);
  sim.emit({ type: 'raid', ph: 'ward', x: r0(b.x), y: r0(b.y), hp: max, t: RAID.ward.dur });
  void here;
}
function tickWard(sim, b, here) {
  const R = sim.raid, W = R.ward;
  W.t++; W.hp = b.ward ? b.ward.hp : 0;
  if (W.hp <= 0) {
    b.ward = null; R.ward = null; R.stun = RAID.ward.stun; R.wardsBroken++;
    b.cc.stun = Math.max(b.cc.stun, RAID.ward.stun);
    for (const p of here) if (!p.dead) healPlayer(sim, p, p.stats.maxHp * RAID.mend.ward, p);
    callout(sim, 'WARD SHATTERED!', `Vorthax is stunned — +${Math.round((RAID.ward.vuln - 1) * 100)}% damage`, '#ffe27a', RAID.ward.stun);
    sim.emit({ type: 'raid', ph: 'wardBreak', x: r0(b.x), y: r0(b.y), t: RAID.ward.stun });
    return;
  }
  if (W.t >= W.d) {
    b.ward = null; R.ward = null;
    const pct = R.party ? RAID.ward.collapse.party : RAID.ward.collapse.solo;
    for (const p of here) { mechHit(sim, p, pct, 'Rift Collapse', true); if (evadeShove(sim, p)) continue; const a = Math.atan2(p.y - b.y, p.x - b.x); p.vx += Math.cos(a) * 700; p.vy += Math.sin(a) * 700; }
    callout(sim, 'RIFT COLLAPSE!', 'The ward held', RAID_COL.danger, 90);
    sim.emit({ type: 'raid', ph: 'collapse', x: r0(b.x), y: r0(b.y) });
    nextPhase(sim, b);
  }
}
function nextPhase(sim, b) {
  const R = sim.raid;
  R.phase = Math.min(3, R.phase + 1); R.seq = 0; R.next = 70; R.mech = null; b.raidHold = 0;
  const sub = R.phase === 2 ? 'Eclipse · Soul Chain · Brand + Convergence' : 'Everything, faster';
  callout(sim, `PHASE ${R.phase}`, sub, R.phase === 3 ? '#ff6a5a' : '#c05cff', 120);
  sim.emit({ type: 'bossPhase', phase: R.phase, x: b.x, y: b.y, id: b.id, raid: true });
  sim.emit({ type: 'raid', ph: 'phase', phase: R.phase, x: r0(b.x), y: r0(b.y) });
}

// ------------------------------------------------------------------ damage helpers
/** A mechanic hit: % of max HP, no defence. raw = can't be dodged/guarded (stack, spread, tether, collapse, safe-zone fails). */
function mechHit(sim, p, pct, what, raw = false, src = null) {
  const R = sim.raid;
  if (!(pct > 0)) return false;
  const ok = damagePlayer(sim, p, 0, src, { pct, raw, by: `${RAID.short}'s ${what}`, kb: src ? 260 : 0 });
  if (ok) { R.hits[what] = (R.hits[what] || 0) + 1; sim.emit({ type: 'raid', ph: 'hit', pid: p.id, what, x: r0(p.x), y: r0(p.y), pct }); }
  return ok;
}
/** Rift Mend: everyone who took no damage during the mechanic heals (bigger solo). Rewards clean play; readable sustain. */
function mend(sim, m, here) {
  if (!m.dt0) return;
  const k = sim.raid.party ? RAID.mend.party : RAID.mend.solo, dt0 = m.dt0; m.dt0 = null;
  for (const p of here) {
    if (p.dead || !dt0.has(p.id) || (p.dmgTaken || 0) !== dt0.get(p.id)) continue;
    healPlayer(sim, p, p.stats.maxHp * k, p);
    sim.emit({ type: 'raid', ph: 'mend', pid: p.id, x: r0(p.x), y: r0(p.y) });
  }
}
function bullet(sim, b, x, y, ang, speed, life, pct, style = 'rift') {
  return spawnProjectile(sim, { team: 'enemy', ownerId: b.id, x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 11, life, dmg: 1, pct, style, color: null, kb: 80, by: `${RAID.short}'s bullets` });
}
/** Add a ground telegraph: { k: kind, sh: circle|donut|cone|rect|safe, col, d: ticks until it resolves, hit: fn } */
function tele(sim, spec) { const R = sim.raid; const t = { id: R.tid++, t: 0, ...spec }; R.tele.push(t); return t; }
function tickTele(sim, here) {
  const R = sim.raid;
  for (const t of R.tele) {
    t.t++;
    if (t.follow) { const b = bossOf(sim); if (b) { t.x = r0(b.x); t.y = r0(b.y); } }
    if (t.t === t.d && !t.done) {
      t.done = true; sim.posCheck = posTele(t) ? 1 : 0;
      if (t.pct) for (const p of here) if (teleHits(t, p)) mechHit(sim, p, t.pct, t.what || MECH_NAMES[t.k] || t.k, !!t.raw, t.sh === 'circle' || t.sh === 'cone' ? { x: t.x, y: t.y } : null);
      sim.emit({ type: 'raid', ph: 'boom', k: t.k, sh: t.sh, x: r0(t.x ?? RAID_POS.x), y: r0(t.y ?? RAID_POS.y), r: t.r, r2: t.r2, ang: t.ang, arc: t.arc, len: t.len, w: t.w, col: t.col });
    }
  }
  R.tele = R.tele.filter((t) => !t.done || t.t < t.d + 14);
  sim.posCheck = 0;
}
/** Is player p caught by telegraph t? ('safe' = the whole arena except the safe zones) */
export function teleHits(t, p) {
  const pr = p.r * 0.5;
  switch (t.sh) {
    case 'circle': return Math.hypot(p.x - t.x, p.y - t.y) < t.r + pr;
    case 'donut': { const d = Math.hypot(p.x - t.x, p.y - t.y); return d > t.r - pr && d < t.r2 + pr; }
    case 'cone': return inCone(t.x, t.y, t.ang, t.arc, t.len, p.x, p.y, pr);
    case 'rect': return inLine(t.x - Math.cos(t.ang) * t.len / 2, t.y - Math.sin(t.ang) * t.len / 2, t.ang, t.len, t.w, p.x, p.y, pr);
    case 'safe': return !inSafe(t, p.x, p.y);
    default: return false;
  }
}
/** Inside one of a 'safe' telegraph's green zones (circles z:[[x,y,r]], quadrants q:[i] with rotation rot, or ring in/out)? */
export function inSafe(t, x, y) {
  if (t.z) for (const [zx, zy, zr] of t.z) if (Math.hypot(x - zx, y - zy) < zr) return true;
  if (t.q) { const a = Math.atan2(y - RAID_POS.y, x - RAID_POS.x) - (t.rot || 0), i = ((Math.floor(a / (Math.PI / 2)) % 4) + 4) % 4; if (t.q.includes(i)) return true; }
  if (t.inR) return Math.hypot(x - RAID_POS.x, y - RAID_POS.y) < t.inR;
  if (t.outR) return Math.hypot(x - RAID_POS.x, y - RAID_POS.y) > t.outR;
  return false;
}

// ------------------------------------------------------------------ the mechanics
const rnd = (sim) => sim.rng.next();
function pickPlayer(sim, here, not = []) { const c = here.filter((p) => !not.includes(p.id)); return c.length ? c[Math.floor(rnd(sim) * c.length)] : here[0]; }
function runMech(sim, b, m, here) {
  const R = sim.raid, f = R.phase === 3 ? 0.85 : 1, P = R.party;
  const D = (x) => Math.round(x * f);
  const done = (after = 0) => { if (m.t >= after) { R.mech = null; R.next = RAID.gap[R.phase]; mend(sim, m, here); } };
  switch (m.id) {
    case 'cleave': {
      const C = RAID.cleave;
      if (m.t === 0) {
        const t = here.find((p) => p.id === b.aggroId) || pickPlayer(sim, here);
        m.ang = Math.atan2(t.y - b.y, t.x - b.x); b.face = m.ang; b.raidHold = D(C.delay) + 20;
        tele(sim, { k: 'cleave', sh: 'cone', x: r0(b.x), y: r0(b.y), ang: m.ang, arc: P ? C.arc.party : C.arc.solo, len: C.len, d: D(C.delay), col: 'danger', pct: C.pct, what: 'Riftcleave' });
        if (R.phase === 3) tele(sim, { k: 'cleave', sh: 'cone', x: r0(b.x), y: r0(b.y), ang: m.ang + Math.PI, arc: P ? C.arc.party : C.arc.solo, len: C.len, d: D(C.delay) + 36, col: 'danger', pct: C.pct, what: 'Riftcleave' });
      }
      done(D(C.delay) + (R.phase === 3 ? 50 : 16));
      break;
    }
    case 'lanes': case 'lanes2': {
      lanesAt(sim, b, m, 0, P ? 2 : 1, P || R.phase === 3);
      done(m.second ? m.end2 : m.end1);
      break;
    }
    case 'spread': {
      spreadAt(sim, b, m, 0, here);
      done(D(RAID.spread.delay) + 20);
      break;
    }
    case 'stack': {
      stackAt(sim, b, m, 0, here);
      done(D(RAID.stack.delay) + 20);
      break;
    }
    case 'stackspread': {
      spreadAt(sim, b, m, 0, here);
      stackAt(sim, b, m, D(RAID.spread.delay) - 30, here, D(RAID.spread.delay) + 110);
      if (m.t === 0) callout(sim, 'SPREAD, THEN STACK', 'Brands first — then group up on the yellow ring', RAID_COL.spread, D(RAID.spread.delay));
      done(D(RAID.spread.delay) + 150);
      break;
    }
    case 'lance': {
      lanceAt(sim, b, m, 0, here);
      if (m.fired && m.dashDone) done(m.t0 + 30);
      break;
    }
    case 'tether': {
      tetherAt(sim, b, m, 0, here);
      if (m.t === 70) { m.id2 = 'cleave'; const t = pickPlayer(sim, here); const a = Math.atan2(t.y - b.y, t.x - b.x); b.face = a; tele(sim, { k: 'cleave', sh: 'cone', x: r0(b.x), y: r0(b.y), ang: a, arc: P ? RAID.cleave.arc.party : RAID.cleave.arc.solo, len: RAID.cleave.len, d: D(RAID.cleave.delay), col: 'danger', pct: RAID.cleave.pct, what: 'Riftcleave' }); }
      if (!R.teth.length && m.t > 20) done(0);
      break;
    }
    case 'tetherlance': {
      tetherAt(sim, b, m, 0, here);
      lanceAt(sim, b, m, 40, here);
      if (!R.teth.length && m.fired && m.dashDone) done(0);
      break;
    }
    case 'eclipse': {
      eclipseAt(sim, b, m, 0, R.eclipseN = (m.t === 0 ? (R.eclipseN || 0) + 1 : R.eclipseN));
      done(D(RAID.eclipse.delay) + 20);
      break;
    }
    case 'eclipselanes': {
      if (m.t === 0) {
        b.x = RAID_POS.x; b.y = RAID_POS.y - 20; b.raidHold = 260;
        tele(sim, { k: 'eclipse', sh: 'safe', inR: RAID.eclipse.inR, d: 230, col: 'safe', pct: RAID.eclipse.pct, raw: true, what: 'Eclipse' });
        callout(sim, 'GET IN — THEN DODGE', 'Eclipse: stand in the centre ring · bullets leave the middle lanes open', RAID_COL.safe, 230);
      }
      lanesAt(sim, b, m, 60, 1, false, [4, 5]);
      done(250);
      break;
    }
    case 'spiral': {
      const S = RAID.spiral;
      if (m.t === 0) { b.raidHold = S.dur + 20; m.rot = rnd(sim) * Math.PI * 2; callout(sim, 'VOID SPIRAL', 'Weave through the arms', '#c05cff', 90); tele(sim, { k: 'spiral', sh: 'circle', x: r0(b.x), y: r0(b.y), r: 110, d: 40, col: 'danger', pct: 0.25, what: 'Void Spiral' }); }
      if (m.t > 40 && m.t < S.dur && m.t % S.every === 0) { for (let i = 0; i < S.arms; i++) bullet(sim, b, b.x, b.y, m.rot + (i / S.arms) * Math.PI * 2, S.speed, 170, S.pct, 'riftfire'); m.rot += P ? 0.17 : 0.2; }
      done(S.dur + 20);
      break;
    }
    default: done(0);
  }
  m.t++;
}

/** Starfall Lanes: the arena is cut into 10 lanes; red lanes fill with a bullet wall, green gap lanes stay open.
 *  `gaps` gap groups (solo: one 2-lane gap; party: two 1-lane gaps), a second wave (new gaps) when `second`. */
function lanesAt(sim, b, m, at, gapN, second, force) {
  const R = sim.raid, L = RAID.lanes, t = m.t - at, w = (2 * RAID_R) / L.n;
  const wave = (k) => {
    const dir = m.dir ?? (m.dir = Math.floor(rnd(sim) * 4) * (Math.PI / 2));
    const a = k ? dir + Math.PI / 2 : dir; // 2nd wave comes from the side
    let gaps = force ? force.slice() : [];
    if (!force) {
      if (gapN === 1 && !R.party) { const g = 1 + Math.floor(rnd(sim) * (L.n - 3)); gaps = [g, g + 1]; }
      else { const g1 = 1 + Math.floor(rnd(sim) * 3), g2 = g1 + 3 + Math.floor(rnd(sim) * (L.n - g1 - 4)); gaps = [g1, Math.min(L.n - 2, g2)]; if (!R.party) gaps.push(gaps[0] + 1); }
    }
    const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    for (let i = 0; i < L.n; i++) {
      const o = -RAID_R + w * (i + 0.5), safe = gaps.includes(i);
      tele(sim, { k: 'lane', sh: 'rect', x: r0(RAID_POS.x + vx * o), y: r0(RAID_POS.y + vy * o), ang: a, len: 2 * RAID_R, w: r0(w), d: L.preview, col: safe ? 'safe' : 'danger', arrow: 1 });
    }
    return { a, gaps };
  };
  const fire = (wv) => {
    const ux = Math.cos(wv.a), uy = Math.sin(wv.a), vx = -uy, vy = ux;
    for (let i = 0; i < L.n; i++) {
      if (wv.gaps.includes(i)) continue;
      for (let j = 0; j < 3; j++) {
        const o = -RAID_R + w * i + w * (j + 0.5) / 3, s = Math.sqrt(Math.max(0, (RAID_R + 50) ** 2 - o * o));
        const x = RAID_POS.x + vx * o - ux * s, y = RAID_POS.y + vy * o - uy * s;
        bullet(sim, b, x, y, wv.a, L.speed, Math.ceil((2 * s) / L.speed * 60) + 4, L.pct, 'star');
      }
    }
    sim.emit({ type: 'raid', ph: 'lanes', x: RAID_POS.x, y: RAID_POS.y, ang: wv.a });
  };
  if (t === 0) { m.w1 = wave(0); if (!at) callout(sim, 'STARFALL', 'Stand in a GREEN lane', RAID_COL.safe, L.preview); }
  if (m.w1 && t >= L.preview && t < L.preview + L.rows * 14 && (t - L.preview) % 14 === 0) fire(m.w1);
  m.end1 = at + L.preview + 110;
  if (second) {
    m.second = true;
    if (t === L.preview + 40) { m.w2 = wave(1); callout(sim, 'SECOND WAVE', 'From the side — find the new green lane', RAID_COL.safe, L.preview); }
    if (m.w2 && t >= 2 * L.preview + 40 && t < 2 * L.preview + 40 + L.rows * 14 && (t - 2 * L.preview - 40) % 14 === 0) fire(m.w2);
    m.end2 = at + 2 * L.preview + 150;
  }
}
/** Rift Brand (spread): a purple circle on every player; when it detonates, anyone ELSE inside takes heavy damage.
 *  Solo: your brand plus two echo brands next to you (step out of the echoes). Each brand leaves a rift pool. */
function spreadAt(sim, b, m, at, here) {
  const R = sim.raid, S = RAID.spread, t = m.t - at, f = R.phase === 3 ? 0.85 : 1, d = Math.round(S.delay * f);
  if (t === 0) {
    m.brands = [];
    for (const p of here) { const mk = { k: 'spread', pid: p.id, r: S.r, t: 0, d }; R.marks.push(mk); m.brands.push(mk); }
    if (!R.party && here[0]) {
      const p = here[0], a0 = rnd(sim) * Math.PI * 2;
      for (const da of [0, 2.2]) { const a = a0 + da, x = clampIn(p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90, 60); const mk = { k: 'spread', echo: 1, x: r0(x.x), y: r0(x.y), r: S.r, t: 0, d }; R.marks.push(mk); m.brands.push(mk); }
    }
    if (!m.id.includes('stack')) callout(sim, 'SPREAD OUT!', R.party ? 'Rift Brands on everyone — keep your circle off your allies' : 'Get clear of the echo brands', RAID_COL.spread, d);
  }
  if (t > 0 && t <= d) for (const mk of m.brands) mk.t = t;
  if (t === d) {
    for (const mk of m.brands) {
      const src = mk.pid ? sim.players.get(mk.pid) : mk;
      if (!src || src.dead) continue;
      const x = src.x, y = src.y;
      for (const p of here) {
        const dd = Math.hypot(p.x - x, p.y - y);
        if (p.id === mk.pid) mechHit(sim, p, R.party ? S.self : S.selfSolo, 'Rift Brand', true);
        else if (dd < S.r + p.r * 0.5) mechHit(sim, p, mk.echo ? S.echo : S.ally, mk.echo ? 'Echo Brand' : 'Rift Brand (ally)', true);
      }
      addArea(sim, { team: 'enemy', ownerId: b.id, shape: 'circle', x, y, r: S.pool.r, delay: S.pool.delay, pulses: S.pool.pulses, every: S.pool.every, dmg: 1, pct: S.pool.pct, kind: 'riftpool', by: `${RAID.short}'s rift pool` });
      sim.emit({ type: 'raid', ph: 'boom', k: 'spread', sh: 'circle', x: r0(x), y: r0(y), r: S.r, col: 'spread' });
    }
    R.marks = R.marks.filter((mk) => !m.brands.includes(mk));
  }
}
/** Convergence (stack): a yellow ring with inward arrows on one player; everyone inside shares 100% of max HP
 *  (min 15% each... alone it is 85%). Solo: a fixed soak ring you must stand in (20% in, 45% if you miss it). */
function stackAt(sim, b, m, at, here, dOverride) {
  const R = sim.raid, S = RAID.stack, t = m.t - at, f = R.phase === 3 ? 0.85 : 1, d = dOverride ? dOverride - at : Math.round(S.delay * f);
  if (t === 0) {
    const tgt = R.party ? pickPlayer(sim, here) : null;
    let x = 0, y = 0;
    if (!tgt) { const p = here[0], a = Math.atan2(p.y - RAID_POS.y, p.x - RAID_POS.x) + Math.PI * (0.55 + rnd(sim) * 0.9); const c = clampIn(RAID_POS.x + Math.cos(a) * 230, RAID_POS.y + Math.sin(a) * 230, 90); x = c.x; y = c.y; }
    m.stack = { k: 'stack', pid: tgt ? tgt.id : 0, x: r0(x), y: r0(y), r: S.r, t: 0, d, need: R.party ? Math.min(4, here.length) : 1 };
    R.marks.push(m.stack);
    if (!m.id.includes('spread') || at > 0) callout(sim, 'STACK!', R.party ? `Group up on ${tgt.name} to share the hit` : 'Stand in the yellow ring to soak it', RAID_COL.stack, d);
  }
  if (m.stack && t > 0 && t <= d) m.stack.t = t;
  if (m.stack && t === d) {
    const mk = m.stack, src = mk.pid ? sim.players.get(mk.pid) : mk;
    const x = src && !src.dead ? src.x : mk.x, y = src && !src.dead ? src.y : mk.y;
    const inside = here.filter((p) => Math.hypot(p.x - x, p.y - y) < S.r + p.r * 0.5);
    if (R.party) { const per = Math.min(S.max, S.total / Math.max(1, inside.length)); for (const p of inside) mechHit(sim, p, per, 'Convergence', true); }
    else { for (const p of here) mechHit(sim, p, inside.includes(p) ? S.soloIn : S.soloOut, inside.includes(p) ? 'Convergence' : 'Convergence (unsoaked)', true); }
    sim.emit({ type: 'raid', ph: 'boom', k: 'stack', sh: 'circle', x: r0(x), y: r0(y), r: S.r, col: 'stack', n: inside.length, need: mk.need });
    R.marks = R.marks.filter((q) => q !== mk); m.stack = null;
  }
}
/** Rift Lance (charge): a magenta line tracks one player, locks, then Vorthax charges along it to the wall and bursts.
 *  The target takes 25%, anyone else on the line 50% (aim it away from the group); dodgeable with i-frames. */
function lanceAt(sim, b, m, at, here) {
  const R = sim.raid, L = RAID.lance, t = m.t - at, f = R.phase === 3 ? 0.85 : 1, lock = Math.round(L.track * f), d = Math.round(L.delay * f);
  if (t === 0) {
    const tgt = pickPlayer(sim, here);
    m.lt = tgt.id; b.raidHold = d + 60; m.t0 = 1e9;
    m.lance = tele(sim, { k: 'lance', sh: 'rect', x: r0(b.x), y: r0(b.y), ang: 0, len: 2 * RAID_R, w: L.w, d, col: 'charge', pid: tgt.id });
    callout(sim, 'RIFT LANCE', R.party ? `On ${tgt.name} — point it AWAY from the group` : 'Charge incoming — sidestep when it locks', RAID_COL.charge, d);
  }
  if (!m.lance) return;
  const tgt = sim.players.get(m.lt);
  if (t > 0 && t < lock && tgt && !tgt.dead) { // track
    const a = Math.atan2(tgt.y - b.y, tgt.x - b.x); b.face = a;
    Object.assign(m.lance, { ang: a, x: r0(b.x + Math.cos(a) * RAID_R), y: r0(b.y + Math.sin(a) * RAID_R) });
  }
  if (t === lock) { m.lance.lock = 1; sim.emit({ type: 'raid', ph: 'lock', x: r0(b.x), y: r0(b.y), ang: m.lance.ang }); }
  if (t === d) {
    m.fired = true; m.dashA = m.lance.ang;
    for (const p of here) if (teleHits(m.lance, p) && Math.cos(Math.atan2(p.y - b.y, p.x - b.x) - m.dashA) > -0.2) mechHit(sim, p, p.id === m.lt ? L.target : L.other, 'Rift Lance', false, b);
    sim.emit({ type: 'raid', ph: 'lance', x: r0(b.x), y: r0(b.y), ang: m.dashA });
  }
  if (m.fired && !m.dashDone) { // the dash (visual travel; the hit resolved on release)
    const st = L.speed / 60;
    b.x += Math.cos(m.dashA) * st; b.y += Math.sin(m.dashA) * st; b.face = m.dashA;
    const dd = Math.hypot(b.x - RAID_POS.x, b.y - RAID_POS.y);
    if (dd > RAID_R - b.r || t > d + 60) {
      const k = (RAID_R - b.r) / dd; if (k < 1) { b.x = RAID_POS.x + (b.x - RAID_POS.x) * k; b.y = RAID_POS.y + (b.y - RAID_POS.y) * k; }
      m.dashDone = true; m.t0 = m.t; b.raidHold = 30;
      if (R.party || R.phase >= 2) { const off = rnd(sim); for (let i = 0; i < L.ring; i++) bullet(sim, b, b.x, b.y, off + (i / L.ring) * Math.PI * 2, 240, 200, L.ringPct, 'rift'); }
      sim.emit({ type: 'raid', ph: 'slam', x: r0(b.x), y: r0(b.y) });
    }
  }
}
/** Soul Chain (tethers): players are chained in pairs (odd one out / solo: to an anchor pylon). Stretch past the break
 *  distance to snap it; still chained when it runs out = 55% to both. Dodge the other attacks first, stretch last. */
function tetherAt(sim, b, m, at, here) {
  const R = sim.raid, T = RAID.tether, t = m.t - at, min = R.party ? T.min.party : T.min.solo, d = Math.round(T.dur * (R.phase === 3 ? 0.87 : 1));
  if (t === 0) {
    const ps = here.slice().sort((a, c) => a.id - c.id);
    R.teth = [];
    for (let i = 0; i + 1 < ps.length; i += 2) R.teth.push({ a: ps[i].id, b: ps[i + 1].id, t: 0, d, min });
    if (ps.length % 2) { const p = ps[ps.length - 1], c = clampIn(p.x + 40, p.y - 30, 80); R.teth.push({ a: p.id, b: 0, ax: r0(c.x), ay: r0(c.y), t: 0, d, min }); }
    callout(sim, 'BREAK THE TETHER!', `Move ${min}+ px apart${R.party ? ' from your partner' : ' from the pylon'} — dodge first, stretch last`, RAID_COL.tether, d);
  }
  for (const th of R.teth) {
    th.t = t;
    const A = sim.players.get(th.a), B = th.b ? sim.players.get(th.b) : { x: th.ax, y: th.ay, dead: false };
    if (!A || A.dead || !B || B.dead) { th.gone = 1; continue; }
    const dd = Math.hypot(A.x - B.x, A.y - B.y);
    th.dist = r0(dd);
    if (dd >= th.min) { th.gone = 1; sim.emit({ type: 'raid', ph: 'snap', x: r0((A.x + B.x) / 2), y: r0((A.y + B.y) / 2), a: th.a, b: th.b }); continue; }
    if (t >= th.d) {
      th.gone = 1;
      mechHit(sim, A, T.pct, 'Soul Chain', true); if (th.b) mechHit(sim, B, T.pct, 'Soul Chain', true);
      sim.emit({ type: 'raid', ph: 'chainFail', x: r0((A.x + B.x) / 2), y: r0((A.y + B.y) / 2), a: th.a, b: th.b });
    }
  }
  R.teth = R.teth.filter((th) => !th.gone);
}
/** Eclipse (safe-zone pattern): the arena goes red except the green zones; anyone outside them takes 60%.
 *  Patterns rotate: quadrants (party 1 safe of 4, solo 2), safe orbs (party 2, solo 3), and in/out rings. */
function eclipseAt(sim, b, m, at, n) {
  const R = sim.raid, E = RAID.eclipse, t = m.t - at, d = Math.round(E.delay * (R.phase === 3 ? 0.84 : 1));
  if (t !== 0) return;
  const kind = n % 3;
  if (kind === 1) {
    const rot = Math.floor(rnd(sim) * 2) * (Math.PI / 4), q0 = Math.floor(rnd(sim) * 4), q = R.party ? [q0] : [q0, (q0 + 1) % 4];
    tele(sim, { k: 'eclipse', sh: 'safe', q, rot, d, col: 'safe', pct: E.pct, raw: true, what: 'Eclipse' });
    callout(sim, 'ECLIPSE', `Get into the GREEN ${R.party ? 'quadrant' : 'quadrants'}`, RAID_COL.safe, d);
  } else if (kind === 2) {
    const z = [], nz = R.party ? 2 : 3;
    for (let i = 0, tries = 0; i < nz && tries < 60; tries++) {
      const a = rnd(sim) * Math.PI * 2, r = 90 + rnd(sim) * (RAID_R - 200), x = RAID_POS.x + Math.cos(a) * r, y = RAID_POS.y + Math.sin(a) * r;
      if (z.some(([zx, zy]) => Math.hypot(zx - x, zy - y) < 230)) continue;
      z.push([r0(x), r0(y), E.orbR]); i++;
    }
    tele(sim, { k: 'eclipse', sh: 'safe', z, d, col: 'safe', pct: E.pct, raw: true, what: 'Eclipse' });
    callout(sim, 'ECLIPSE', 'Get into a GREEN circle', RAID_COL.safe, d);
  } else {
    const inside = Math.floor(rnd(sim) * 2) === 0;
    b.x = RAID_POS.x; b.y = RAID_POS.y; b.raidHold = d + 10;
    tele(sim, inside ? { k: 'eclipse', sh: 'safe', inR: E.inR, d, col: 'safe', pct: E.pct, raw: true, what: 'Eclipse' } : { k: 'eclipse', sh: 'safe', outR: E.inR + 60, d, col: 'safe', pct: E.pct, raw: true, what: 'Eclipse' });
    callout(sim, inside ? 'ECLIPSE — GET IN!' : 'ECLIPSE — GET OUT!', inside ? 'Only the centre ring is safe' : 'Only the outer ring is safe', RAID_COL.safe, d);
  }
}
function clampIn(x, y, pad) { const dx = x - RAID_POS.x, dy = y - RAID_POS.y, d = Math.hypot(dx, dy), m = RAID_R - pad; if (d <= m) return { x, y }; return { x: RAID_POS.x + dx / d * m, y: RAID_POS.y + dy / d * m }; }

// ------------------------------------------------------------------ helpers for bots / clients
/** The next thing a player should worry about (used by the balance bots and the co-op bots). */
export function raidThreats(sim) { return sim.raid ? sim.raid : null; }
/** Compact copy for the co-op snapshot (the renderer reads the same shape from a local sim). */
export function packRaid(sim) {
  const R = sim.raid;
  const out = {};
  if (sim.riftPortal) out.rp = { x: sim.riftPortal.x, y: sim.riftPortal.y, t: sim.riftPortal.t, arm: sim.riftPortal.arm > 0 || riftHeld(sim) ? 1 : 0 };
  if (!R) return out.rp ? out : null;
  const tl = R.tele.map((t) => { const o = { id: t.id, k: t.k, sh: t.sh, t: t.t, d: t.d, col: t.col }; for (const k of ['x', 'y', 'r', 'r2', 'ang', 'arc', 'len', 'w', 'z', 'q', 'rot', 'inR', 'outR', 'pid', 'lock', 'arrow', 'done']) if (t[k] !== undefined) o[k] = typeof t[k] === 'number' ? Math.round(t[k] * 100) / 100 : t[k]; return o; });
  out.rd = { st: R.st, t: R.t, pull: R.pull, bid: R.bid, phase: R.phase, party: R.party, enr: R.enr, enraged: R.enraged, stun: R.stun, call: R.call, ward: R.ward, marks: R.marks, teth: R.teth, tele: tl, mech: R.mech ? R.mech.id : null };
  return out;
}

/** Test hook (server dev op 'raid' / playtests): enter, skip the pull, set the boss HP %, force a phase or a mechanic, enrage. */
export function devRaid(sim, p, m) {
  if (m.enter) enterRaid(sim, p);
  if (m.leave) { leaveRaid(sim, p); return; }
  const R = sim.raid;
  if (!R) return;
  const b = bossOf(sim);
  if (m.skipPull && R.st === 'pull') R.pull = 1;
  if (b && m.hpPct > 0 && m.hpPct <= 1) b.hp = Math.max(1, Math.round(b.maxHp * m.hpPct));
  if (m.phase >= 1 && m.phase <= 3) { R.phase = m.phase; R.seq = 0; R.mech = null; R.next = 30; R.ward = null; R.stun = 0; if (b) { b.ward = null; b.raidHold = 0; } }
  if (typeof m.mech === 'string' && MECH_NAMES[m.mech]) { R.mech = null; R.tele = []; R.marks = []; R.teth = []; R.forced = m.mech; R.next = 1; }
  if (m.enrage) R.enr = 2;
}
