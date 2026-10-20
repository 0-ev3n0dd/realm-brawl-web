// Cinematic set pieces + in-fight cinematic moments (encounter revamp Part 0). These are GAMEPLAY: the fight never pauses, the sim drives
// everything (co-op / prediction safe), and the client frames it (client/encountercine.js: letterbox, camera, music cue, HUD).
//
// SET PIECE 'blade' - "Hold the Blade" (reference: Susano Ex's Stormsplitter sword drop). A giant blade descends on a spot (tell), then
// presses down: one hero must stand in the HOLD circle to brace it while the party breaks the CORE (a DPS check) before the blade lands.
//   tell    SETPIECE.blade.tell ticks: the blade's shadow + the hold circle + the core appear (>= 2 s read time)
//   hold    pressure 0 -> 1 over `hold` ticks while braced; x `unheld` faster with nobody in the circle (it is a position check:
//           standing in it counts, dodge i-frames don't matter). The holder takes a light raw pressure tick.
//   win     the core breaks first: the blade shatters ('setpiece' ph 'win')
//   fail    pressure reaches 1: the blade lands - everyone in the encounter dies (a hard wipe, like an enrage)
// Solo fairness: with one hero the core touches the hold circle (melee hits it while bracing); with a party it sits across the arena (split
// roles). A short grace (SETPIECE.blade.grace) keeps the blade braced through a lunge out of the circle.
// The core's HP = checkSec x kAtk x the ATK of the heroes who are not holding (n - 1 of n in a party); encounters may pass coreHp.
//
// SET PIECE 'carry' - "Sunbearer" in Neferakh (encounter revamp Part 1; reusable: any 'carry the thing home under pressure' moment).
// INTENT: one hero shoulders the responsibility (slow, no dodge, no attacks) while the team clears the way.
//   tell    the object falls to (x, y) (SETPIECE.carry.tell): its shadow grows, the goal (gx, gy) and the Wardens appear. Whoever stands in the
//           catch circle when it lands becomes the BEARER; nobody = it crashes (a raw hit on everyone) and lies there to be picked up.
//   carry   the bearer moves at `slow` speed, can't dodge, attack or cast (p.carry); a light raw tick. Touching the bearer takes it over (a hand-off,
//           passCd apart). The Wardens sweep sand LANES across the route (laneTell read); a lane hit knocks it out of the bearer's arms (stunned,
//           it drops where they stood). Breaking a Warden stops its lanes (a DPS race for the others; solo: weave through or break them first).
//   win     the bearer reaches the goal circle ('setpiece' ph 'win')            fail: the fuse (`life`) runs out - it bursts: everyone dies.
// CINE MOMENTS (no damage, no new tells while they play; encounters ask cineHold(sim) before starting a mechanic):
//   'respite'     a short epic breather (music swell, heal-up window)
//   'reposition'  the boss leaps / flies to a new spot over `dur` ticks (untargetable while moving), camera follows
//   'transition'  the stage changes (the encounter swaps its arena on 'mid'); the camera pulls out
import { spawnEnemy } from './ai.js';
import { damagePlayer, killPlayer } from './combat.js';

export const SETPIECE = {
  // checkSec x kAtk x ATK = the core's HP per (non-holding) hero: ~12 x ATK / s is the Bard's damage on a static target (playtest 2026-10-19,
  // Lv 50 Rift gear: Bard 12, Ranger 31, Samurai 119), so the weakest class needs ~7 s of the 10 s window - fair, never a Bard nerf.
  blade: { tell: 150, hold: 600, unheld: 4, holdR: 78, coreR: 46, coreDist: 430, soloDist: 118, grace: 30, tickPct: 0.02, tickEvery: 60, checkSec: 7, kAtk: 12 },
  // carry: life = the fuse after it lands (a solo Bard walks the 700 px route in ~6 s at 0.6 speed; the lanes cost ~2-4 s more)
  carry: { tell: 150, catchR: 100, goalR: 110, life: 960, slow: 0.6 /* (player.js CARRY_MUL) */, passR: 60, passCd: 45, dropStun: 36, tickPct: 0.02, tickEvery: 60, crashPct: 0.35,
    laneEvery: 150, laneTell: 72, laneW: 130, lanePct: 0.14, wardenSec: 3.5, kAtk: 12, wardenOff: 90 },
};
export const CINE = { respite: 360, reposition: 120, transition: 180 };

/** the default DPS check: the non-holding share of the party's ATK x kAtk x checkSec */
export function coreHpFor(heroes, S = SETPIECE.blade) { const n = heroes.length, atk = heroes.reduce((a, p) => a + ((p.stats && p.stats.atk) || 0), 0); return Math.max(1000, Math.round(atk * (n > 1 ? (n - 1) / n : 1) * S.kAtk * S.checkSec)); }
/** start a set piece. o: { kind: 'blade', x, y, ang (where the core goes), coreHp, players (the heroes in the fight; default all alive), by } */
export function startSetpiece(sim, o) {
  const S = SETPIECE[o.kind]; if (!S) return null;
  const heroes = (o.players || [...sim.players.values()]).filter((p) => !p.dead && !p.decoy), n = Math.max(1, heroes.length);
  const ang = o.ang ?? Math.PI / 2, d = n > 1 ? S.coreDist : S.soloDist;
  if (o.kind === 'carry') return startCarry(sim, o, S, heroes);
  const sp = { id: sim.id(), kind: o.kind, x: o.x, y: o.y, ang, t: 0, ph: 'tell', press: 0, holdR: S.holdR, held: 0, holder: null, by: o.by || 'the Blade',
    cx: o.x + Math.cos(ang) * d, cy: o.y + Math.sin(ang) * d, core: null, coreHp: o.coreHp || coreHpFor(heroes, S), pids: heroes.map((p) => p.id), lastHeld: -1e9 };
  (sim.sp || (sim.sp = [])).push(sp);
  if (!sim.predicting) sim.emit({ type: 'setpiece', ph: 'start', id: sp.id, kind: sp.kind, x: sp.x, y: sp.y, cx: sp.cx, cy: sp.cy, tell: S.tell, hold: S.hold });
  return sp;
}
/** carry: o = { x, y (where it lands), gx, gy (the goal), wardens: [{x, y}], life, skin ('sun'), by, enc } */
function startCarry(sim, o, S, heroes) {
  const n = Math.max(1, heroes.length), atk = heroes.reduce((a, p) => a + ((p.stats && p.stats.atk) || 0), 0);
  const wHp = o.wardenHp || Math.max(800, Math.round(atk * (n > 1 ? (n - 1) / n : 1) * S.kAtk * S.wardenSec));
  const sp = { id: sim.id(), kind: 'carry', skin: o.skin || 'sun', enc: o.enc || null, x: o.x, y: o.y, sx: o.x, sy: o.y, gx: o.gx, gy: o.gy, t: 0, ph: 'tell', life: o.life || S.life,
    bearer: 0, passT: -1e9, lanes: [], lid: 0, order: (() => { const o = [0, 1, 2], r = sim.rng ? () => sim.rng.next() : Math.random; for (let i = 2; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; })(), nextBand: 0, lt: 0, wards: o.wardens || [], wardIds: [], wHp, pids: heroes.map((p) => p.id), by: o.by || 'the Fallen Sun', drops: 0, passes: 0, crashed: 0,
    cx: o.gx, cy: o.gy };
  sp.nextBand = sp.order[0];
  (sim.sp || (sim.sp = [])).push(sp);
  if (!sim.predicting) sim.emit({ type: 'setpiece', ph: 'start', id: sp.id, kind: 'carry', skin: sp.skin, x: sp.x, y: sp.y, gx: sp.gx, gy: sp.gy, tell: S.tell, life: sp.life });
  return sp;
}
/** start a cine moment. o: { kind: 'respite' | 'reposition' | 'transition', dur, boss (enemy), to: {x, y}, x, y, stage } */
export function startCine(sim, o) {
  const dur = o.dur || CINE[o.kind] || 120, c = { id: sim.id(), kind: o.kind, t: 0, dur, x: o.x, y: o.y, stage: o.stage || null, enc: o.enc || null };
  if (o.kind === 'reposition' && o.boss) { const b = o.boss; Object.assign(c, { bid: b.id, fx: b.x, fy: b.y, tx: o.to.x, ty: o.to.y, x: o.to.x, y: o.to.y }); b.untargetable = 1; }
  (sim.cine || (sim.cine = [])).push(c);
  if (!sim.predicting) sim.emit({ type: 'cine', ph: 'start', id: c.id, kind: c.kind, dur, x: c.x, y: c.y, stage: c.stage });
  return c;
}
/** true while a set piece or cine moment owns the fight (encounters lay down no new mechanics) */
export const cineHold = (sim) => !!((sim.sp && sim.sp.length) || (sim.cine && sim.cine.length));

const inHold = (sp, p) => !p.dead && !p.decoy && Math.hypot(p.x - sp.x, p.y - sp.y) <= sp.holdR + p.r * 0.5;
function endSp(sim, sp, ph) {
  sp.ph = ph; sp.done = true;
  if (sp.kind === 'carry') { for (const id of sp.pids) { const p = sim.players.get(id); if (p) p.carry = 0; } for (const wid of sp.wardIds) { const e = sim.enemyById.get(wid); if (e && !e.dead) { e.dead = true; e.hp = 0; } } }
  if (ph === 'fail' && sp.kind === 'carry') { sim.posCheck = 1; for (const id of sp.pids) { const p = sim.players.get(id); if (p && !p.dead) { sim.emit({ type: 'hurt', pid: p.id, x: p.x, y: p.y, amount: Math.ceil(p.hp), heavy: true, by: `${sp.by} bursts (it never reached the altar)`, pct: 100 }); killPlayer(sim, p, sp.by); } } sim.posCheck = 0; if (!sim.predicting) sim.emit({ type: 'setpiece', ph, id: sp.id, kind: sp.kind, skin: sp.skin, x: sp.sx, y: sp.sy, gx: sp.gx, gy: sp.gy }); return; }
  if (sp.kind === 'carry') { if (!sim.predicting) sim.emit({ type: 'setpiece', ph, id: sp.id, kind: sp.kind, skin: sp.skin, x: sp.sx, y: sp.sy, gx: sp.gx, gy: sp.gy, drops: sp.drops, passes: sp.passes }); return; }
  if (sp.core && !sp.core.dead) { sp.core.dead = true; sp.core.hp = 0; }
  if (ph === 'fail') for (const id of sp.pids) { const p = sim.players.get(id); if (p && !p.dead) { sim.emit({ type: 'hurt', pid: p.id, x: p.x, y: p.y, amount: Math.ceil(p.hp), heavy: true, by: 'the Blade lands (nobody held it)', pct: 100 }); killPlayer(sim, p, sp.by); } }
  if (!sim.predicting) sim.emit({ type: 'setpiece', ph, id: sp.id, kind: sp.kind, x: sp.x, y: sp.y, cx: sp.cx, cy: sp.cy });
}
export function updateSetpieces(sim) {
  if (sim.sp && sim.sp.length) {
    for (const sp of sim.sp) {
      const S = SETPIECE[sp.kind]; sp.t++;
      if (sp.kind === 'carry') { if (!sp.done) tickCarry(sim, sp, S); continue; }
      if (sp.ph === 'tell') {
        if (sp.t >= S.tell) {
          sp.ph = 'hold'; sp.t = 0;
          const c = spawnEnemy(sim, 'spcore', sp.cx, sp.cy); c.hp = c.maxHp = sp.coreHp; c.spId = sp.id; c.xp = 0; c.dropChance = 0; c.summonOf = sp.id; c.homeX = sp.cx; c.homeY = sp.cy; sp.core = c; // (no loot / XP: it is a mechanic)
          if (!sim.predicting) sim.emit({ type: 'setpiece', ph: 'hold', id: sp.id, kind: sp.kind, x: sp.x, y: sp.y, cx: sp.cx, cy: sp.cy, core: c.id });
        }
        continue;
      }
      if (sp.done) continue;
      if (sp.core && !sp.core.dead) { const c = sp.core; c.x = c.px = c.homeX; c.y = c.py = c.homeY; c.vx = c.vy = 0; } // (pinned: knockback never drags it, it never 'walks home' and heals)
      if (!sp.pids.some((id) => { const p = sim.players.get(id); return p && !p.dead; })) { endSp(sim, sp, 'gone'); continue; } // (everyone fell / left: it just ends)
      let holder = null; for (const id of sp.pids) { const p = sim.players.get(id); if (p && inHold(sp, p)) { holder = p; break; } }
      if (holder) sp.lastHeld = sp.t; const braced = holder || sp.t - sp.lastHeld <= S.grace; // (grace: a lunge out of the circle doesn't drop the blade)
      sp.held = braced ? 1 : 0; sp.holder = holder ? holder.id : sp.holder;
      sp.press = Math.min(1, sp.press + (braced ? 1 : S.unheld) / S.hold);
      if (holder && sp.t % S.tickEvery === 0) damagePlayer(sim, holder, 0, null, { raw: true, pct: S.tickPct, by: 'the Blade\'s weight' });
      if (sp.core && sp.core.dead) endSp(sim, sp, 'win');
      else if (sp.press >= 1) endSp(sim, sp, 'fail');
    }
    sim.sp = sim.sp.filter((sp) => !sp.done);
  }
  if (sim.cine && sim.cine.length) {
    for (const c of sim.cine) {
      c.t++;
      if (c.kind === 'reposition') { const b = sim.enemyById.get(c.bid); if (b && !b.dead) { const k = Math.min(1, c.t / c.dur), e = k * k * (3 - 2 * k); b.x = b.px = c.fx + (c.tx - c.fx) * e; b.y = b.py = c.fy + (c.ty - c.fy) * e; b.vx = b.vy = 0; if (c.t >= c.dur) b.untargetable = 0; } }
      if (c.t === (c.dur >> 1) && !sim.predicting) sim.emit({ type: 'cine', ph: 'mid', id: c.id, kind: c.kind, stage: c.stage, x: c.x, y: c.y });
      if (c.t >= c.dur) { c.done = true; if (!sim.predicting) sim.emit({ type: 'cine', ph: 'end', id: c.id, kind: c.kind, x: c.x, y: c.y }); }
    }
    sim.cine = sim.cine.filter((c) => !c.done);
  }
}
const alive = (sim, sp) => sp.pids.map((id) => sim.players.get(id)).filter((p) => p && !p.dead);
function setBearer(sim, sp, p, why) {
  const old = sp.bearer && sim.players.get(sp.bearer); if (old) old.carry = 0;
  sp.bearer = p ? p.id : 0; if (p) { p.carry = 1; p.action = null; sp.passT = sp.t; }
  if (!sim.predicting) sim.emit({ type: 'setpiece', ph: why, id: sp.id, kind: 'carry', skin: sp.skin, pid: p ? p.id : 0, x: Math.round(sp.sx), y: Math.round(sp.sy) });
}
function hurtSp(sim, p, pct, by, pos) { if (pos) sim.posCheck = 1; damagePlayer(sim, p, 0, null, { pos: !!pos, pct, by }); sim.posCheck = 0; } // (a position check: dodge i-frames don't save you, a class movement skill's evade still does)
function tickCarry(sim, sp, S) {
  const heroes = alive(sim, sp);
  if (sp.ph === 'tell' && sp.t === 1) for (const w of sp.wards) { const e = spawnEnemy(sim, 'spwarden', w.x, w.y); e.hp = e.maxHp = sp.wHp; e.xp = 0; e.dropChance = 0; e.summonOf = sp.id; e.homeX = w.x; e.homeY = w.y; e.spId = sp.id; sp.wardIds.push(e.id); } // (the Wardens rise as it falls)
  if (sp.ph === 'tell') {
    sandLanes(sim, sp, S, heroes);
    if (sp.t < S.tell) return;
    sp.ph = 'carry'; sp.t = 0;
    let best = null, bd = 1e9; for (const p of heroes) { const d = Math.hypot(p.x - sp.x, p.y - sp.y); if (d <= S.catchR + p.r * 0.5 && d < bd) { bd = d; best = p; } }
    if (best) setBearer(sim, sp, best, 'catch');
    else { sp.crashed = 1; for (const p of heroes) hurtSp(sim, p, S.crashPct, `${sp.by} (nobody caught it)`, true); if (!sim.predicting) sim.emit({ type: 'setpiece', ph: 'crash', id: sp.id, kind: 'carry', skin: sp.skin, x: sp.x, y: sp.y }); }
    return;
  }
  if (!heroes.length) { endSp(sim, sp, 'gone'); return; }
  let B = sp.bearer ? sim.players.get(sp.bearer) : null;
  if (B && B.dead) { setBearer(sim, sp, null, 'drop'); B = null; sp.drops++; }
  if (B) {
    sp.sx = B.x; sp.sy = B.y; B.carry = 1;
    if (sp.t % S.tickEvery === 0) hurtSp(sim, B, S.tickPct, `${sp.by}'s heat`, true);
    if (Math.hypot(B.x - sp.gx, B.y - sp.gy) <= S.goalR) { endSp(sim, sp, 'win'); return; }
    if (sp.t - sp.passT >= S.passCd) for (const p of heroes) if (p !== B && !(p.stun > 0) && Math.hypot(p.x - B.x, p.y - B.y) <= S.passR + p.r * 0.5) { setBearer(sim, sp, p, 'pass'); sp.passes++; B = p; break; }
  } else {
    for (const p of heroes) if (!(p.stun > 0) && Math.hypot(p.x - sp.sx, p.y - sp.sy) <= S.catchR * 0.7 + p.r * 0.5) { setBearer(sim, sp, p, 'pick'); B = p; break; }
  }
  sandLanes(sim, sp, S, heroes);
  if (sp.t >= sp.life) endSp(sim, sp, 'fail');
}
function sandLanes(sim, sp, S, heroes) {
  const wards = sp.wardIds.map((id) => sim.enemyById.get(id)).filter((e) => e && !e.dead);
  for (const e of wards) { e.x = e.px = e.homeX; e.y = e.py = e.homeY; e.vx = e.vy = 0; }
  // the Wardens' sand lanes: across the fixed route (landing spot -> goal) on three BANDS (1/4, 1/2, 3/4 of the way), in a shuffled cycle
  // (sp.order, drawn on the floor): cross a band right after it sweeps. One lane every laneEvery / (live Wardens): breaking one halves the pressure.
  const every = Math.round(S.laneEvery / Math.max(1, wards.length));
  if (wards.length && (sp.lt = (sp.lt || 0) + 1) >= every) {
    sp.lt = 0;
    const ux = sp.gx - sp.x, uy = sp.gy - sp.y, ul = Math.hypot(ux, uy) || 1, band = sp.order[sp.lid % 3], along = ul * (0.25 + 0.25 * band);
    const cx = sp.x + ux / ul * along, cy = sp.y + uy / ul * along, ang = Math.atan2(uy, ux) + Math.PI / 2, L = 1400;
    sp.lanes.push({ id: sp.lid++, band, x: cx - Math.cos(ang) * L / 2, y: cy - Math.sin(ang) * L / 2, ang, len: L, w: S.laneW, t: 0, d: S.laneTell, by: wards[sp.lid % wards.length].id });
    sp.nextBand = sp.order[sp.lid % 3];
  }
  for (const ln of sp.lanes) {
    ln.t++; if (ln.t !== ln.d) continue;
    const c = Math.cos(ln.ang), s = Math.sin(ln.ang);
    for (const p of heroes) {
      const px = p.x - ln.x, py = p.y - ln.y, f = Math.max(0, Math.min(ln.len, px * c + py * s)), dd = Math.hypot(px - c * f, py - s * f);
      if (dd > ln.w / 2 + p.r * 0.5) continue;
      if (p.id === sp.bearer) { hurtSp(sim, p, S.lanePct, 'the Sand Wardens\' sweep', true); p.stun = Math.max(p.stun || 0, S.dropStun); sp.drops++; setBearer(sim, sp, null, 'drop'); }
      else hurtSp(sim, p, S.lanePct, 'the Sand Wardens\' sweep', false);
    }
    if (!sim.predicting) sim.emit({ type: 'setpiece', ph: 'lane', id: sp.id, kind: 'carry', x: Math.round(ln.x + c * ln.len / 2), y: Math.round(ln.y + s * ln.len / 2), ang: Math.round(ln.ang * 100) / 100 });
  }
  sp.lanes = sp.lanes.filter((ln) => ln.t < ln.d + 12);
}
/** cancel every live set piece (an encounter reset / wipe): flags cleared, adds removed, no events */
export function clearSetpieces(sim, enc) {
  if (!sim.sp) return;
  for (const sp of sim.sp) { if (enc && sp.enc !== enc) continue; sp.done = true;
    if (sp.kind === 'carry') { for (const id of sp.pids) { const p = sim.players.get(id); if (p) p.carry = 0; } for (const wid of sp.wardIds) { const e = sim.enemyById.get(wid); if (e && !e.dead) { e.dead = true; e.hp = 0; } } }
    if (sp.core && !sp.core.dead) { sp.core.dead = true; sp.core.hp = 0; } }
  sim.sp = sim.sp.filter((sp) => !sp.done);
  if (sim.cine && enc) sim.cine = sim.cine.filter((c) => c.enc !== enc);
}
/** network view (server room.js -> client; the client reads the same fields offline) */
export function packSetpieces(sim) {
  const sp = (sim.sp || []).map((s) => s.kind === 'carry'
    ? { id: s.id, kind: s.kind, skin: s.skin, ph: s.ph, t: s.t, x: Math.round(s.x), y: Math.round(s.y), sx: Math.round(s.sx), sy: Math.round(s.sy), gx: Math.round(s.gx), gy: Math.round(s.gy), cx: Math.round(s.gx), cy: Math.round(s.gy), life: s.life, bearer: s.bearer, crashed: s.crashed, order: s.order, nextBand: s.nextBand, wardIds: s.wardIds.slice(), lanes: s.lanes.map((l) => ({ id: l.id, band: l.band, x: Math.round(l.x), y: Math.round(l.y), ang: Math.round(l.ang * 100) / 100, len: l.len, w: l.w, t: l.t, d: l.d })) }
    : { id: s.id, kind: s.kind, ph: s.ph, t: s.t, x: Math.round(s.x), y: Math.round(s.y), cx: Math.round(s.cx), cy: Math.round(s.cy), press: Math.round(s.press * 1000) / 1000, held: s.held, holder: s.holder, holdR: s.holdR, core: s.core ? s.core.id : null });
  const cine = (sim.cine || []).map((c) => ({ id: c.id, kind: c.kind, t: c.t, dur: c.dur, x: Math.round(c.x ?? 0), y: Math.round(c.y ?? 0), stage: c.stage, enc: c.enc || null }));
  return sp.length || cine.length ? { sp, cine } : null;
}
/** dev / media: a Hold the Blade demo next to the hero (+ an optional practice boss) */
export function devSetpiece(sim, p, m = {}) {
  if (m.kind === 'blade' || !m.kind) return startSetpiece(sim, { kind: 'blade', x: p.x, y: p.y - 40, ang: m.ang ?? 0, coreHp: m.coreHp });
  if (m.kind === 'carry') { const a = m.ang ?? 0; return startSetpiece(sim, { kind: 'carry', x: p.x, y: p.y + 20, gx: p.x + Math.cos(a) * 640, gy: p.y + Math.sin(a) * 640, wardens: [{ x: p.x + 320 * Math.cos(a) - 300 * Math.sin(a), y: p.y + 320 * Math.sin(a) + 300 * Math.cos(a) }, { x: p.x + 320 * Math.cos(a) + 300 * Math.sin(a), y: p.y + 320 * Math.sin(a) - 300 * Math.cos(a) }] }); }
  if (m.kind === 'respite') return startCine(sim, { kind: 'respite', x: p.x, y: p.y });
  if (m.kind === 'reposition') { const b = sim.enemyById.get(m.boss); if (b) return startCine(sim, { kind: 'reposition', boss: b, to: m.to }); }
  if (m.kind === 'transition') return startCine(sim, { kind: 'transition', x: p.x, y: p.y, stage: m.stage || 'demo' });
  return null;
}
