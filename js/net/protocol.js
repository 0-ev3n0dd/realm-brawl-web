// Wire protocol shared by server (Node) and browser client. JSON messages over one WebSocket (/ws).
// Snapshots use compact arrays; static entity info is sent once per client ("known sets"), then only
// the changing fields. Projectiles/areas are sent once on appearance and dead-reckoned by the client.
import { songMask, SONG_KINDS as SONGS } from '../sim/arcana.js';
import { CLASSES, chainById } from '../sim/data/classes.js';
const WST = ['G', 'A', 'H']; // Warrior weapons (the drawn one)
import { STACKS, STACK_KINDS } from '../sim/kit.js';

export const PROTOCOL = 2; // v2: join carries the unlocked hero list (hero locks)
export const MAX_PLAYERS = 6;
export const SNAP_EVERY = 3;          // server tick 60 Hz -> snapshots at 20 Hz
export const INTERP_TICKS = 6;        // remote entities rendered ~100 ms in the past
export const VIEW_X = 1250, VIEW_Y = 1050; // interest box half-size around each player
export const STASH_MS = 10 * 60 * 1000;    // a disconnected hero is kept for reconnect this long

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
export { r1, r2 };

const KIND = { basic: 1, dodge: 2, skill: 3 };
const KIND_R = [null, 'basic', 'dodge', 'skill'];

const ROUTE_FIN = [null, 'mob', 'boss'];
/** Eclipse finisher-route progress: [mob step, boss step, broken bits (1 mob, 2 boss), finishing (0/1 mob/2 boss), kills]. */
function packRoute(rt) { return rt ? [rt.st.mob, rt.st.boss, (rt.x.mob ? 1 : 0) | (rt.x.boss ? 2 : 0), ROUTE_FIN.indexOf(rt.fin), rt.k, rt.bn || 0, rt.bl || 0] : []; } // (bn / bl: Warrior Berserk hits so far + the last key)
function unpackRoute(a, old) {
  if (!a || !a.length) return null;
  const rt = old || { st: {}, x: {}, cm: {} };
  rt.st = { mob: a[0], boss: a[1] }; rt.x = { mob: a[2] & 1, boss: (a[2] >> 1) & 1 }; rt.fin = ROUTE_FIN[a[3]] || null; rt.k = a[4] || 0; rt.bn = a[5] || 0; rt.bl = a[6] || null;
  return rt;
}
/** Serialize the local player's authoritative state (for prediction/reconciliation). */
export function packMe(p) {
  const a = p.action;
  let act = null;
  if (a) {
    const d = a.data ? { tx: a.data.tx, ty: a.data.ty, r: a.data.r, o: a.data.o, ids: a.data.ids, pts: a.data.pts, k: a.data.k, hitT: a.data.hitT, fx: a.data.fx, fy: a.data.fy, lx: a.data.lx, ly: a.data.ly, tid: a.data.tid, ext: a.data.ext, fin: a.data.fin, rm: a.data.rm, mom: a.data.mom, crash: a.data.crash, hitAt: a.data.hitAt, T: a.data.T, cl: a.data.cl, sb: a.data.sb, n: a.data.n, md: a.data.md, tr: a.data.tr, hold: a.data.hold, sbn: a.data.sbn, big: a.data.big, stop: a.data.stop, ws: a.data.ws, pr: a.data.pr, ps: a.data.ps, ev: a.data.ev, cf: a.data.cf, mk: a.data.mk, cost: a.data.cost, hops: a.data.hops, xs: a.data.xs, bl: a.data.bl, bcut: a.data.bcut, land: a.data.land, t0: a.data.t0, step: a.data.step, pierce: a.data.pierce, wm: a.data.wm, gm: a.data.gm, dd: a.data.dd, rc: a.data.rc, ox: a.data.ox, oy: a.data.oy, i: a.data.i } : null; // (ox/oy/i: finisher anchors + counters; without them a reconciled replay put the hero at NaN)
    act = [KIND[a.kind], a.id || 0, a.key || 0, a.idx ?? 0, a.t, a.dur, a.cancel ?? null, r2(a.ang ?? 0), a.lockMove ? 1 : 0, a.moveMul ?? null, a.chain ? a.chain.id : 0, d, a.backstab ? 1 : 0, a.dashN ? [a.dashN, a.dt, r2(a.dfx), r2(a.dfy), r2(a.dlx), r2(a.dly)] : 0, a.wmw || 0];
  }
  return {
    id: p.id, x: r2(p.x), y: r2(p.y), vx: r2(p.vx), vy: r2(p.vy), hp: r1(p.hp), res: r1(p.res),
    cd: [p.cds.Q, p.cds.E, p.cds.R, p.cds.F, p.cds.SP || 0], sx: p.spx && p.spx.t > 0 ? [p.spx.id, p.spx.t, p.spx.n || 0] : 0, dc: p.dodgeCd, dn: p.dodgeN ?? 3, dr: p.dodgeRe | 0, spr: p.sprint ? 1 : 0, cy: p.carry ? 1 : 0, lc: p.lastCombat ?? -99999, lh: p.lastHurt ?? -99999, fr: p.iframes, st: p.stun, hs: p.hitstop, gd: p.guard, // (sx: the live Special state; dc/fr/st/hs/gd were stuck inside this comment before 2026-10-19; dn/dr: dodge charges + recharge, spr: sprinting, lc/lh: combat clocks for the sprint prediction)
    act, bs: p.bufSkill || 0, bt: p.bufTtl, bd: p.bufDodge, h: p.history.map((e) => [e.a, e.tick]), lb: [p.lastBasic.idx, p.lastBasic.endTick],
    ch: p.comboHits, ct: p.comboTimer, bc: p.bestCombo, dead: p.dead ? 1 : 0, ra: p.respawnAt, dch: p.dead && p.canChoose ? 1 : 0, rmn: p.dead ? p.respawnMin || 0 : 0, lv: p.level, xp: Math.floor(p.xp),
    k: p.kills, dd: p.deaths, mx: Math.floor(p.mxp || 0), mp: p.mperks && Object.keys(p.mperks).length ? p.mperks : undefined, // (mx / mp: game loop B1 Mastery XP + perk picks: the emblem, and the online save keeps them)
    fl: p.flash, tr: p.traps.slice(), le: p.lastEvade || 0, ev: p.evade || 0, as: (p.asc | 0) | (p.ascAll ? 8 : 0), // (bit 8: all ten Ascended, Part D) // (as: Ascension rank 0-5, Parts B / D) // (ev: evasive-dash ticks)
    sh: p.shield > 0 ? [Math.round(p.shield), p.shieldT, Math.round(p.shieldMax || p.shield)] : 0, pc: p.perfectCrit || 0,
    // ultimate: meter, rotation progress (chain ids), buffered T, rage/aura ticks, Eclipse window [ticks, extension]
    ul: r1(p.ult || 0), ur: p.ultRot ? p.ultRot.ids.slice() : [], ul2: p.ultLast || 0, bu: p.bufUlt || 0, rg: p.rage || 0, au: p.aura || 0, cl: p.eclipse ? [p.eclipse.t, p.eclipse.ext, p.eclipse.vc || 0, ...packRoute(p.eclipse.rt)] : 0,
    sl: p.stealth || 0, ss: p.stealthSrc || 0, gc: p.gcd || 0, eg: p.edge || 0, et: p.edgeT || 0, cr: p.critRun || 0, // Blade Dancer stealth + global recovery + Edge (crit stacks) + crits this chain
    mc: p.momCut ? (p.momCut.Q ? 1 : 0) | (p.momCut.E ? 2 : 0) | (p.momCut.R ? 4 : 0) : 0, // Warrior Momentum cooldown-cut flags
    uw: p.uw ? [p.uw.t, ...packRoute(p.uw.rt)] : 0, cs: p.cst ? [p.cst.g, p.cst.t] : 0, // ult window [ticks, route...], class state [stage, ticks]
    ws: p.ws ? [p.ws.keys.join(''), p.ws.t, p.ws.rw ?? -1, p.ws.bp || 0, p.ws.emp ? 1 : 0] : 0, wq: p.wq && p.wq.length ? p.wq.map((e) => [e.k, e.c, e.rh, e.ttl]) : 0, wv: p.weave || 0, hk: p.holdKey ? [p.holdKey, p.holdT] : 0, bh: p.bufCharge || 0,
    dg: p.drg ? [p.drg.emp ? 1 : 0, p.drg.mk, p.drg.dv] : 0, // Dragoon [Skyborne-empowered next chain, dive-mark ticks, dives left]
    ar: p.arc ? [p.arc.emp ? 1 : 0] : 0, // Summoner [next summon empowered]
    sg: p.songs ? SONGS.filter((k) => p.songs[k] && p.songs[k].t > 0).map((k) => [SONGS.indexOf(k), Math.round(p.songs[k].k * 100), p.songs[k].t, p.songs[k].by]) : 0, // Bard songs on this player [kind, k x100, ticks, singer]
    mk: p.monk ? [p.monk.hc, p.monk.ht, p.monk.emp ? 1 : 0] : 0, // Monk [hit counter, ticks until it resets, Flow-empowered next chain]
    wm: p.wm ? [WST.indexOf(p.wm.st), p.wm.tri, p.wm.ct, p.wm.tcd, p.wm.surge, p.wm.n, p.wm.pl ? [WST.indexOf(p.wm.pl.w), Math.round(p.wm.pl.x), Math.round(p.wm.pl.y), p.wm.pl.t] : 0] : 0, // Warrior Weapon Master [drawn weapon, trinity bits, rotation ticks, trinity cd, surge, trinities]
    bf: p.buf ? [p.buf.rally ? p.buf.rally.t : 0, p.buf.cry ? p.buf.cry.t : 0, p.buf.rally ? p.buf.rally.dmg : 0, p.buf.rally ? p.buf.rally.spd : 0, p.buf.rally ? p.buf.rally.def : 0, p.buf.cry ? p.buf.cry.def : 0] : 0, // shout buffs // Warrior: string [keys, window ticks], held key [key, ticks], buffered press's hold
  };
}

/** Apply a packed `me` block onto a (client-side predicted) player object. */
export function unpackMe(p, m) {
  p.x = m.x; p.y = m.y; p.vx = m.vx; p.vy = m.vy; p.hp = m.hp; p.res = m.res;
  if (Array.isArray(m.wm) && p.wm) {
    const w = m.wm, W = p.wm;
    W.st = WST[w[0]] || 'G'; W.tri = w[1]; W.ct = w[2]; W.tcd = w[3]; W.surge = w[4]; W.n = w[5]; W.pl = Array.isArray(w[6]) ? { w: WST[w[6][0]] || 'G', x: w[6][1], y: w[6][2], t: w[6][3] } : null;
  }
  if (Array.isArray(m.dg) && p.drg) { p.drg.emp = m.dg[0] ? 1 : 0; p.drg.mk = m.dg[1]; p.drg.dv = m.dg[2]; }
  if (Array.isArray(m.ar) && p.arc) p.arc.emp = m.ar[0] ? 1 : 0;
  if (Array.isArray(m.sg) && m.sg.length) { p.songs = {}; for (const [i, k, t, by] of m.sg) if (SONGS[i]) p.songs[SONGS[i]] = { k: k / 100, t, by }; } else p.songs = null;
  if (Array.isArray(m.mk) && p.monk) { p.monk.hc = m.mk[0]; p.monk.ht = m.mk[1]; p.monk.emp = m.mk[2] ? 1 : 0; }
  if (Array.isArray(m.bf)) { const b = m.bf; p.buf = { rally: b[0] > 0 ? { t: b[0], dmg: b[2], spd: b[3], def: b[4] } : null, cry: b[1] > 0 ? { t: b[1], def: b[5] } : null }; } else p.buf = null;
  p.cds.Q = m.cd[0]; p.cds.E = m.cd[1]; p.cds.R = m.cd[2]; p.cds.F = m.cd[3]; p.cds.SP = m.cd[4] || 0;
  p.spx = Array.isArray(m.sx) ? { id: m.sx[0], t: m.sx[1], n: m.sx[2] } : null;
  p.dodgeCd = m.dc | 0; p.dodgeN = m.dn ?? 3; p.dodgeRe = m.dr | 0; p.sprint = m.spr | 0; p.carry = m.cy | 0; if (m.lc != null) p.lastCombat = m.lc; if (m.lh != null) p.lastHurt = m.lh; p.iframes = m.fr | 0; p.evade = m.ev || 0; p.stun = m.st | 0; p.hitstop = m.hs | 0; p.guard = m.gd | 0;
  p.bufSkill = m.bs || null; p.bufTtl = m.bt; p.bufDodge = m.bd; p.pendingSkill = null; p.pendingDodge = false;
  p.history = m.h.map(([a, tick]) => ({ a, tick }));
  p.lastBasic = { idx: m.lb[0], endTick: m.lb[1] };
  p.comboHits = m.ch; p.comboTimer = m.ct; p.bestCombo = m.bc; p.dead = !!m.dead; p.respawnAt = m.ra; p.canChoose = m.dch || 0; p.respawnMin = m.rmn || 0;
  p.kills = m.k; p.deaths = m.dd; p.mxp = m.mx || 0; p.mperks = m.mp || {}; p.flash = m.fl; p.traps = m.tr || []; p.lastEvade = m.le;
  if (m.sh) { p.shield = m.sh[0]; p.shieldT = m.sh[1]; p.shieldMax = m.sh[2]; } else { p.shield = 0; p.shieldT = 0; }
  p.perfectCrit = m.pc || 0; p.asc = (m.as | 0) & 7; p.ascAll = (m.as | 0) & 8 ? 1 : 0;
  p.ult = m.ul || 0; if (p.ultRot) p.ultRot.ids = m.ur || []; p.ultLast = m.ul2 || null; p.bufUlt = m.bu || 0; p.pendingUlt = false;
  p.rage = m.rg || 0; p.aura = m.au || 0;
  p.stealth = m.sl || 0; p.stealthSrc = m.ss || null; p.gcd = m.gc || 0; p.edge = m.eg || 0; p.edgeT = m.et || 0; p.critRun = m.cr || 0;
  p.momCut = { Q: m.mc & 1 ? 1 : 0, E: m.mc & 2 ? 1 : 0, R: m.mc & 4 ? 1 : 0 };
  if (m.cl) { if (!p.eclipse) p.eclipse = { t: 0, ext: 0, dmg: new Map(), bs: new Set() }; p.eclipse.t = m.cl[0]; p.eclipse.ext = m.cl[1]; p.eclipse.vc = m.cl[2] || 0; p.eclipse.rt = unpackRoute(m.cl.slice(3), p.eclipse.rt); } else p.eclipse = null;
  if (m.uw) { if (!p.uw) p.uw = { t: 0, rt: null }; p.uw.t = m.uw[0]; p.uw.rt = unpackRoute(m.uw.slice(1), p.uw.rt); } else p.uw = null;
  p.cst = m.cs ? { g: m.cs[0], t: m.cs[1] } : null;
  p.ws = m.ws ? { keys: String(m.ws[0]).split(''), t: m.ws[1], rw: m.ws[2] ?? -1, bp: m.ws[3] || 0, emp: !!m.ws[4] } : null;
  p.wq = Array.isArray(m.wq) ? m.wq.map(([k, c, rh, ttl]) => ({ k, c, rh, ttl })) : []; p.weave = m.wv || 0; // Warrior press queue + weave
  if (m.hk) { p.holdKey = m.hk[0]; p.holdT = m.hk[1]; } else { p.holdKey = null; p.holdT = 0; }
  p.bufCharge = m.bh || 0; p.pendingCharge = 0;
  if (!m.act) p.action = null;
  else {
    const [k, id, key, idx, t, dur, cancel, ang, lockMove, moveMul, chainId, d, bs, gd, wmw] = m.act;
    const cls = CLASSES[p.cls];
    const a = { kind: KIND_R[k], id: id || undefined, key: key || undefined, idx, t, dur, ang };
    if (cancel != null) a.cancel = cancel;
    if (lockMove) a.lockMove = true;
    if (moveMul != null) a.moveMul = moveMul;
    if (wmw) a.wmw = wmw;
    if (a.kind === 'basic') a.spec = cls.arms ? cls.weapons[wmw || (p.wm && p.wm.st) || 'G'].basic[idx] : cls.basic[idx];
    a.chain = chainId ? chainById(p.cls, chainId) : null;
    if (bs) a.backstab = true;
    if (gd) { a.dashN = gd[0]; a.dt = gd[1]; a.dfx = gd[2]; a.dfy = gd[3]; a.dlx = gd[4]; a.dly = gd[5]; } // melee gap-closer
    if (a.kind === 'skill') a.data = { ...(d || {}), hit: new Set() };
    if (a.kind === 'dodge') a.id = 'dodge';
    p.action = a;
  }
}

/** Warrior with Rage to spend: remote players see the Rage glow; charging = holding a skill past the hold threshold (charge-up aura). */
const rageHot = (p) => !!(CLASSES[p.cls] && CLASSES[p.cls].gloryRes && p.res >= 100); // (Warrior: full Glory)
const charging = (p) => !!(p.holdKey && CLASSES[p.cls] && CLASSES[p.cls].hold && p.holdT >= CLASSES[p.cls].hold.tap);
/** Remote player (compact). */
export function packPlayer(p) {
  const a = p.action;
  const flags = (p.dead ? 1 : 0) | (p.moving ? 2 : 0) | (p.iframes > 0 ? 4 : 0) | (p.shield > 0 ? 8 : 0) | (p.perfectCrit > 0 ? 16 : 0) | (p.rage > 0 ? 32 : 0) | (p.aura > 0 ? 64 : 0) | (p.eclipse ? 128 : 0) | (p.stealth > 0 ? 256 : 0) | (rageHot(p) ? 512 : 0) | (p.cst ? 1024 : 0) | (p.uw ? 2048 : 0) | (charging(p) ? 4096 : 0) | (p.action && p.action.data && (p.action.data.hold || (p.action.data.gm > 1)) ? 8192 : 0) | (p.wm && p.wm.surge > 0 ? 16384 : 0) | (p.evade > 0 ? 32768 : 0) | (p.asc ? 65536 : 0); // (32768: evasive dash; 65536: Ascended, Part B)
  const act = a ? [KIND[a.kind], a.id || 0, a.idx ?? 0, a.t, a.dur, a.spec ? a.spec.hit : 0, r2(a.ang ?? 0)] : 0;
  return [p.id, r1(p.x), r1(p.y), r2(p.aim), flags, Math.ceil(p.hp), p.stats.maxHp, p.flash, act, p.wm ? WST.indexOf(p.wm.st) : -1, p.monk ? p.monk.hc : -1, songMask(p), (p.asc | 0) | (p.ascAll ? 8 : 0) | (p.unlocks && p.unlocks.ultc ? 16 : 0) | (p.sprint ? 32 : 0) | (p.unlocks && (p.unlocks.nfsc || p.unlocks.sksc || p.unlocks.pysc || p.unlocks.vhsc || p.unlocks.assc) ? 64 : 0), p.shd || 0]; // (64: a Savage cleared - the aura, Part 0S) // (12: Ascension rank | 8 all ten | 16 the Ultimate cleared, Part F3) (9: Warrior drawn weapon, 10: Monk hit counter, 11: Bard songs bitmask)
}
export function unpackPlayer(arr) {
  const [id, x, y, aim, flags, hp, maxHp, flash, act, wst, mhc, sgm, ark, sd] = arr;
  return {
    id, x, y, aim, dead: !!(flags & 1), moving: !!(flags & 2), iframes: flags & 4 ? 1 : 0, shield: flags & 8 ? 1 : 0, perfectCrit: flags & 16 ? 1 : 0, rage: flags & 32 ? 1 : 0, aura: flags & 64 ? 1 : 0, eclipse: flags & 128 ? { t: 1, ext: 0 } : null, stealth: flags & 256 ? 1 : 0, rageHot: flags & 512 ? 1 : 0, cst: flags & 1024 ? { g: 'base', t: 1 } : null, uw: flags & 2048 ? { t: 1 } : null, charging: flags & 4096 ? 1 : 0, empowered: flags & 8192 ? 1 : 0, wm: wst >= 0 && wst != null ? { st: WST[wst], surge: flags & 16384 ? 1 : 0 } : null, evade: flags & 32768 ? 1 : 0, asc: ((ark | 0) & 7) || (flags & 65536 ? 1 : 0), ascAll: (ark | 0) & 8 ? 1 : 0, ultc: (ark | 0) & 16 ? 1 : 0, sprint: (ark | 0) & 32 ? 1 : 0, svA: (ark | 0) & 64 ? 1 : 0, hp, maxHp, flash, mhc: mhc >= 0 ? mhc : null,
    shd: sd || null, // boss-form shadow (sim/skillform.js)
    sgm: sgm || 0, songs: sgm ? songsFromMask(sgm) : null,
    action: act ? { kind: KIND_R[act[0]], id: act[1] || undefined, idx: act[2], t: act[3], dur: act[4], spec: { hit: act[5] }, ang: act[6] } : null,
  };
}

/** Enemy dynamic fields. */
export function packEnemy(e) {
  const c = e.cc;
  const flags = (e.invuln > 0 ? 1 : 0) | (c.down > 0 ? 2 : 0) | (c.stun > 0 ? 4 : 0) | (c.frozen ? 8 : 0) | (c.rooted ? 16 : 0) | (e.sunder && e.sunder.t > 0 ? 32 : 0) | (e.spm && e.spm.t > 0 ? 64 : 0) | (e.esh > 0 ? 128 : 0) | (e.af && e.af.win > 0 ? 256 : 0) | (e.buffT > 0 || e.cmdAura > 0 ? 512 : 0) | (e.cmdDebuff > 0 ? 1024 : 0); // (A3: 256 mirror window, 512 buffed, 1024 commander fell) // 64: Storm of Arrows MARK, 128: a site caster's ward
  const out = [e.id, r1(e.x), r1(e.y), r2(e.face), Math.ceil(e.hp), e.maxHp, flags, e.flash, e.state, e.st];
  if (e.boss) out.push(e.phase, Math.round(e.poise), e.maxPoise, c.down);
  // Blade Dancer Marks + class stacks (after the boss fields: index 10, or 14 for a boss): [markN, markPid, (code, n, pid)*]
  const mk = e.mark && e.mark.t > 0, sx = [];
  if (e.sunder && e.sunder.t > 0) sx.push(STACKS.sunder.code, e.sunder.n || 1, e.sunder.pid);
  if (e.stx) for (const k in e.stx) { const q = e.stx[k]; if (q.t > 0) sx.push(STACKS[k].code, q.n, q.pid); }
  if (mk || sx.length) out.push(mk ? e.mark.n : 0, mk ? e.mark.pid : 0, ...sx);
  return out;
}
/** Client: the class stacks from a packed enemy's tail (index `i` = first triple): { sunder: {n, pid}, ... }. */
export function unpackStacks(src, i) {
  const out = {};
  for (; i + 2 < src.length; i += 3) { const k = STACK_KINDS[src[i]]; if (k) out[k] = { n: src[i + 1], pid: src[i + 2], t: 1 }; }
  return out;
}
export function enemyStatic(e) { return [e.id, e.type, e.r, e.elite ? 1 : 0, e.boss ? 1 : 0, e.name]; }

export function packProjectile(pr) {
  return [pr.id, pr.team === 'enemy' ? 1 : 0, r1(pr.x), r1(pr.y), r1(pr.vx), r1(pr.vy), pr.r, pr.life, pr.style, pr.homing || 0, pr.accel || 0, pr.ownerId, pr.born ?? 0, pr.color || 0];
}
export function unpackProjectile(a, tick) {
  const [id, enemy, x, y, vx, vy, r, life, style, homing, accel, ownerId, born, color] = a;
  return { id, team: enemy ? 'enemy' : 'player', x, y, vx, vy, r, life, style, homing, accel, ownerId, born, color: color || null, recTick: tick, px: x, py: y };
}

const AREA_KEYS = ['id', 'team', 'ownerId', 'shape', 'x', 'y', 'r', 'ang', 'arc', 'len', 'w', 'delay', 'pulses', 'every', 'fired', 't', 'kind', 'visual', 'trigger', 'triggerR', 'follow', 'born', 'life', 'big', 'r0', 'tell', 'cue', 'beat', 'beats'];
export function packArea(a) {
  const o = {};
  for (const k of AREA_KEYS) if (a[k] !== undefined && a[k] !== null && a[k] !== false) o[k] = typeof a[k] === 'number' && !Number.isInteger(a[k]) ? r2(a[k]) : a[k];
  if (a.spin) o.spin = Math.round(a.spin * 1e5) / 1e5; // (Emberdeep: the sun / tide / rafts turn with the area clock: keep the rate exact)
  return o;
}

export function packBag(b) { return { id: b.id, x: r1(b.x), y: r1(b.y), rarity: b.rarity, items: b.items }; }

/** Client -> server input packet: ['i', seq, mx*100, my*100, ax, ay, flags(1 attack, 2 dodge, 4 ult), skill|0, charge ticks, held key|0]
 *  (charge = how long the skill key was held when released, 0 = a tap; held key = the Warrior skill being charged right now). */
export function packInput(seq, c) {
  return ['i', seq, Math.round((c.mx || 0) * 100), Math.round((c.my || 0) * 100), Math.round(c.ax || 0), Math.round(c.ay || 0), (c.attack ? 1 : 0) | (c.dodge ? 2 : 0) | (c.ult ? 4 : 0) | (c.sprint ? 8 : 0), c.skill || 0, c.charge | 0, c.hold || 0];
}
const SKILL_OK = new Set(['Q', 'E', 'R', 'F', 'SP', 'S1', 'S2', 'S3', 'SN']); // (SP: the Special; S*: Warrior stance swaps)
const HOLD_OK = new Set(['Q', 'E', 'R', 'F']);
// aim points are world coordinates: town ~x -12500, Star Sanctum ~+12500, Tomb ~y -12800, Crypt ~x 16500,
// Forge ~x 50000, mission arenas y -62000..-89000 (OPS_Y). Clamp must cover them all (was +-9000: town aimed RIGHT;
// then +-32000: missions always aimed DOWN and the Forge aimed west).
export const AIM_LIM = 100000;
const clampN = (v, a, b) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : 0);
/** Server side: validate + decode an input packet. Returns null for garbage. */
export function unpackInput(m) {
  if (!Array.isArray(m) || m.length < 8 || !Number.isInteger(m[1])) return null;
  const input = { mx: clampN(m[2], -100, 100) / 100, my: clampN(m[3], -100, 100) / 100, ax: clampN(m[4], -AIM_LIM, AIM_LIM), ay: clampN(m[5], -AIM_LIM, AIM_LIM), attack: !!(m[6] & 1) };
  if (m[6] & 2) input.dodge = true;
  if (m[6] & 8) input.sprint = true; // sprint (the sim only lets it work out of combat)
  if (m[6] & 4) input.ult = true; // only a request: the server fires it only with a full meter
  if (SKILL_OK.has(m[7])) { input.skill = m[7]; const ch = Math.round(clampN(m[8], 0, 120)); if (ch > 0) input.charge = ch; }
  if (HOLD_OK.has(m[9])) input.hold = m[9];
  return { seq: m[1], input };
}

// Events that the local client predicts itself; the server's copies for that player are skipped.
export const PREDICTED_EVENTS = new Set(['wm', 'sam', 'monk', 'drg', 'arc', 'attack', 'swing', 'shoot', 'dodge', 'skill', 'chain', 'blink', 'slam', 'spin', 'nova', 'nores', 'smite', 'judgment', 'flicker', 'heartseeker', 'vanish', 'gapClose', 'shadowStep', 'shadowPierce', 'crash', 'bash', 'rageSpend', 'earthsplitter', 'maelstrom', 'aftershock', 'backhand', 'uppercut', 'strEnd', 'rhythm', 'weave', 'weaveReady',
  // ultimates: the client predicts the start from the server-synced meter (the server still decides: it only fires with a full meter)
  'ult', 'titanSlam', 'rage', 'ascend', 'auraPulse', 'eclipse', 'eclipseShade', 'eclipseEnd',
  // Eclipse finisher routes: step/break follow from the keys (the finishers themselves are server-only: ttc*/crescent* events)
  'routeStep', 'routeBreak',
  // ult window end (predicted from its timer; a finisher's end comes from the server's snapshot)
  'ultEnd']);
// Events only the player they concern should receive.
export const PRIVATE_EVENTS = new Set(['xp', 'nores', 'invFull', 'pickup', 'loot', 'ultGain', 'rotationBroken', 'unlock', 'drops', 'pick']); // (drops / pick: the loot shower + vacuum, sim/drops.js)

/** Remote players: songs from the bitmask (strength unknown: 1). */
function songsFromMask(m) { const o = {}; SONGS.forEach((k, i) => { if (m & (1 << i)) o[k] = { k: 1, t: 60 }; }); return o; }
