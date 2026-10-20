// Grimoire Summoner + Bard ("arcana" classes), in the shared class structure (Q / E / R / G skills + chains + Special + two ult
// finisher routes). Pure sim code: enemy changes run only in the authoritative sim; a predicting co-op client only times the
// action and waits for the server ('arc' events are predicted, 'arcx' = server-only looks).
//
// GRIMOIRE SUMMONER: every skill opens a page and a short-lived creature acts on its own (p.arc.q jobs), so summons keep
// fighting while you cast the next one. INK (the resource, 0-100) is written by summoning; a full book = INSCRIBED: the
// Inscribed chains open (they spend all Ink) and the next summon is empowered (as after Turn the Page). CHILL (kit.js stack
// 'chill', 2 = frozen solid): the Roc's lightning crits chilled enemies for x1.5, frozen-solid enemies take +30% from summons.
// Grimoire Unbound (ult): every page fights by itself for the window (a creature every 0.4 s).
//
// BARD: chains play SONGS - party buffs on every player within range (p.songs, co-op allies too): Valor (damage), Haste (move +
// cooldowns), Mending (heal over time + a shield on apply), Requiem (enemies near the singer take more damage from everyone).
// TEMPO (0-100) is built by playing; full = IN TUNE: songs x1.5 and the In Tune chains open (they spend it). DISSONANT (stack
// 'disso'): +15% damage taken from everyone. Encore (ult): every song replayed x2, notes explode.
import { CLASSES } from './data/classes.js';
import { DT } from './constants.js';
import { hitEnemy, hitEnemiesInShape, addArea, healAllies, healPlayer, grantShield } from './combat.js';
import { targetsOf, pickTarget } from './player.js';
import { addStacks, stackN, stackOf, endUltWindow } from './kit.js';

/** Tuning (per-skill numbers live in the class data: skills[k].stats). */
export const ARC = {
  dmg: { summoner: 0.95, bard: 1.5 }, // class-wide skill damage scale (classScale)
  insc: 1.4,           // an empowered (turned-page / Inscribed) summon
  spend: 1.25,         // an Inscribed / In Tune chain that spends the full resource
  solid: 1.3,          // frozen-solid enemies take +30% from the Summoner's creatures
  shock: 1.5,          // Roc lightning vs chilled
  basicCap: 6,
  songs: { dur: 480, range: 900, maxK: 4, valor: 0.15, haste: 0.12, hasteCd: 0.25, mend: 0.012, mendEvery: 30, mendShield: 0.05, req: 0.12, reqR: 650, reqEvery: 10, tune: 1.5, encore: 2 },
  disso: 0.15,
  unbound: { every: 24, r: 650, muls: [0.7, 0.9, 1.0, 1.2, 1.4], kinds: ['sprite', 'wyrm', 'roc', 'phoenix', 'kraken'], rs: [80, 120, 100, 150, 130] },
  stampede: { n: 12, every: 5, from: 10, r: 110, mul: 1.0, burstAt: 76, burstR: 330, burstMul: 2.2, end: 90, range: 650 },
  chapter: { pullAt: 6, hits: 4, every: 8, hitMul: 1.0, crashAt: 52, base: 7.5, solid: 1.5, splashR: 240, splash: 2.0, end: 66, range: 700 },
  lastPage: { r: 620, mul: 1.3 },
  fort: { n: 20, every: 3, from: 8, r: 95, mul: 0.95, chordAt: 78, chordR: 340, chordMul: 2.2, end: 90, range: 650, per: 0.15 },
  knell: { tolls: 3, every: 14, from: 8, tollR: 160, tollMul: 0.9, crashAt: 58, base: 7.5, per: 1.0, splashR: 250, splash: 2.0, end: 72, range: 700 },
  bow: { r: 330, mul: 1.5 },
};
const R0 = (v) => Math.round(v);
const r2 = (v) => Math.round(v * 100) / 100;
export const SONG_KINDS = ['valor', 'haste', 'mending', 'requiem'];
const SS = (cls, k) => CLASSES[cls].skills[k].stats;
export const isGrim = (p) => !!(p && p.arc && CLASSES[p.cls] && CLASSES[p.cls].grim);
export const isBard = (p) => !!(p && p.arc && CLASSES[p.cls] && CLASSES[p.cls].bard);
export const isArc = (p) => !!(p && CLASSES[p.cls] && (CLASSES[p.cls].grim || CLASSES[p.cls].bard));
const full = (p) => p.res >= p.stats.maxRes - 0.01;

// ------------------------------------------------------------------ state
export function initArc(p) { p.arc = { emp: 0, filled: 0, q: [], bg: 0, sum: 0, ab: 0 }; }

/** Ink / Tempo gain (gear: Ink Gain / Tempo Gain). Authoritative sim only. Filling the book = Inscribed / In Tune. */
export function gainArc(sim, p, n, why = null) {
  if (sim.predicting || !(n > 0) || !isArc(p)) return 0;
  const before = p.res;
  p.res = Math.min(p.stats.maxRes, p.res + n * (1 + (p.stats.inkGain || p.stats.tempoGain || 0)));
  const got = p.res - before;
  if (full(p) && before < p.stats.maxRes - 0.01) {
    if (isGrim(p) && !p.arc.emp) p.arc.emp = 2; // a freshly filled book empowers the next summon
    sim.emit({ type: 'arcx', ph: 'full', pid: p.id, cls: p.cls, x: R0(p.x), y: R0(p.y) });
  } else if (why && got >= 1) sim.emit({ type: 'arcx', ph: 'gain', pid: p.id, cls: p.cls, n: R0(got), why, x: R0(p.x), y: R0(p.y - 56) });
  return got;
}
/** A chain's `need`: Inscribed (Summoner) / In Tune (Bard) = the resource is full (the ult window counts as full). */
export function arcNeed(p, need) { return !!(p.uw || full(p)); }

/** Per tick: resource drain out of combat, the creatures' queued strikes, Grimoire Unbound's free creatures. */
export function tickArc(sim, p) {
  const A = p.arc;
  if (!A) return;
  const C = CLASSES[p.cls], K = C.ink || C.tempo;
  if (p.uw) p.res = p.stats.maxRes; // the ult window: the book / Tempo stays full
  if (sim.predicting) return;
  if (p.res > 0 && !p.uw && sim.tick - Math.max(p.lastCombat || 0, A.lc || 0) > K.drainAfter) p.res = Math.max(0, p.res - K.drain * DT);
  if (p.uw && C.grim && !(p.action && p.action.data && p.action.data.fin) && sim.tick % ARC.unbound.every === 0) unboundStrike(sim, p);
  if (A.q.length) {
    const due = A.q.filter((q) => q.at <= sim.tick);
    if (due.length) { A.q = A.q.filter((q) => q.at > sim.tick); for (const q of due) JOBS[q.k](sim, p, q); }
  }
}
function queue(sim, p, delay, job) { if (!sim.predicting && p.arc) p.arc.q.push({ at: sim.tick + delay, ...job }); }

// ------------------------------------------------------------------ songs (every player can carry them)
/** Active songs on a player (count). */
export function songCount(p) { const S = p && p.songs; if (!S) return 0; let n = 0; for (const k of SONG_KINDS) if (S[k] && S[k].t > 0) n++; return n; }
export const songK = (p, kind) => { const s = p && p.songs && p.songs[kind]; return s && s.t > 0 ? s.k : 0; };
/** Bitmask of active songs (co-op packing): valor 1, haste 2, mending 4, requiem 8. */
export function songMask(p) { let m = 0; SONG_KINDS.forEach((k, i) => { if (songK(p, k)) m |= 1 << i; }); return m; }
/** Play a song from `src` on every living player within range (the singer included). Authoritative sim only. */
export function playSong(sim, src, kind, k, T = ARC.songs.dur) {
  if (sim.predicting || !(k > 0)) return 0;
  const S = ARC.songs, kk = Math.min(S.maxK, k * (1 + (src.stats.songPower || 0)));
  const ids = [];
  for (const q of sim.players.values()) {
    if (q.dead || q.decoy || Math.hypot(q.x - src.x, q.y - src.y) > S.range + q.r) continue;
    const songs = q.songs || (q.songs = {});
    const old = songs[kind];
    songs[kind] = { k: Math.max(old && old.t > 0 ? old.k : 0, kk), t: Math.max(old && old.t > 0 ? old.t : 0, T), by: src.id, m: 0 };
    if (kind === 'mending') grantShield(sim, q, q.stats.maxHp * S.mendShield * kk, 240, src);
    ids.push(q.id);
  }
  sim.emit({ type: 'arcx', ph: 'song', pid: src.id, kind, k: r2(kk), x: R0(src.x), y: R0(src.y), ids });
  return ids.length;
}
/** Per tick for any player carrying songs: timers, Mending heals, Requiem marks enemies around the singer. */
export function tickSongs(sim, p) {
  const S = p.songs, T = ARC.songs;
  if (!S) return;
  let any = false;
  for (const k of SONG_KINDS) {
    const s = S[k];
    if (!s || !(s.t > 0)) continue;
    s.t--; any = true;
    if (sim.predicting) continue;
    if (k === 'mending' && s.t % T.mendEvery === 0) healPlayer(sim, p, p.stats.maxHp * T.mend * s.k, sim.players.get(s.by) || p);
    if (k === 'requiem' && s.by === p.id && s.t % T.reqEvery === 0) {
      for (const e of sim.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < T.reqR + e.r) e.req = { m: 1 + T.req * s.k, until: sim.tick + T.reqEvery + 2 };
    }
  }
  if (!any) p.songs = null;
}
export const hasteMove = (p) => 1 + ARC.songs.haste * songK(p, 'haste');
export const hasteCd = (p) => 1 + ARC.songs.hasteCd * songK(p, 'haste');

// ------------------------------------------------------------------ hit hooks (combat.js hitEnemy)
/** Before the damage roll: { m: damage multiplier, crit: forced crit } from songs / Requiem / Dissonant / Chill rules. */
export function arcPre(sim, p, e, o) {
  let m = 1, crit = false;
  const v = songK(p, 'valor');
  if (v) m *= 1 + ARC.songs.valor * v;
  if (e.req && sim.tick < e.req.until) m *= e.req.m;
  if (e.stx && e.stx.disso && e.stx.disso.t > 0) m *= 1 + ARC.disso;
  if (p.cls === 'summoner' && !o.basic) {
    const ch = stackN(e, 'chill', p.id);
    if (ch) {
      if (o.shock) m *= ARC.shock;
      if (o.critChill) crit = true;
      if (ch >= 2) m *= ARC.solid * (o.solidBonus || 1);
    }
  }
  if (o.ccBonus && (e.cc.stun > 0 || e.cc.down > 0)) m *= o.ccBonus;
  return { m, crit };
}
/** After a hit landed (authoritative): basic hits write a little Ink / Tempo. */
export function arcOnHit(sim, p, e, o) {
  if (sim.predicting || !isArc(p) || o.dot) return;
  const a = p.action, K = CLASSES[p.cls].ink || CLASSES[p.cls].tempo;
  if (o.basic && a && a.kind === 'basic') {
    const add = Math.min(K.basic, ARC.basicCap - (a.bg || 0));
    if (add > 0) { a.bg = (a.bg || 0) + add; gainArc(sim, p, add); }
  }
}

// ------------------------------------------------------------------ cast hook (player.js startSkill / startUlt)
/** A skill / chain / finisher / ult starts: resource, empowerment, the Inscribed / In Tune spend, songs; tell the clients. */
export function arcCast(sim, p, a, key, chain) {
  if (!isArc(p)) return;
  const C = CLASSES[p.cls], K = C.ink || C.tempo, fin = !!(chain && chain.route), id = chain ? chain.id : a.id;
  const tuned = full(p);
  p.arc.lc = sim.tick; // (Ink / Tempo only fades after a while without casting or fighting)
  if (key === 'T') { // the ult
    if (!sim.predicting) p.res = p.stats.maxRes;
  } else if (fin) {
    a.data.fin = 1;
  } else {
    if (C.grim && !chain && 'QER'.includes(key) && p.arc.emp) { a.data.emp = 1; if (!sim.predicting) p.arc.emp = 0; }
    if (chain && chain.need && !p.uw) { a.data.fm = (a.data.fm || 1) * ARC.spend; if (!sim.predicting) p.res = 0; }
    else gainArc(sim, p, chain ? K.chain + K.cast * 0.5 : K.cast);
    if (C.grim && key === 'F' && !chain) { if (!sim.predicting) p.arc.emp = 1; }
    if (C.bard && chain) {
      const mul = (tuned || p.uw ? ARC.songs.tune : 1);
      for (const s of [chain.song, chain.song2, chain.song3]) if (s) playSong(sim, p, s[0], s[1] * mul, chain.songT || ARC.songs.dur);
      if (chain.heal && !sim.predicting) healAllies(sim, p, p.x, p.y, ARC.songs.range, (q) => q.stats.maxHp * chain.heal);
    }
  }
  sim.emit({ type: 'arc', ph: fin ? 'fin' : 'cast', pid: p.id, cls: p.cls, id, key, chain: chain && !fin ? 1 : undefined, route: fin ? chain.route : undefined, name: fin ? chain.name : undefined,
    x: R0(p.x), y: R0(p.y), ang: r2(a.ang), tx: R0(a.data.tx), ty: R0(a.data.ty), emp: a.data.emp ? 1 : undefined, spend: a.data.fm > 1.01 ? 1 : undefined, uw: p.uw ? 1 : undefined });
}
/** The HUD's view. */
export function arcInfo(p) { return p.arc ? { emp: p.arc.emp ? 1 : 0, full: full(p) ? 1 : 0 } : null; }

// ------------------------------------------------------------------ helpers
function clampPt(p, tx, ty, range) { let dx = tx - p.x, dy = ty - p.y; const d = Math.hypot(dx, dy); if (d > range) { dx *= range / d; dy *= range / d; } return { x: p.x + dx, y: p.y + dy }; }
const byId = (sim, id) => (id == null ? null : (sim.enemyById && sim.enemyById.get(id)) || sim.enemies.find((q) => q.id === id) || null);
function opts(p, q, o) {
  let mul = ARC.dmg[p.cls] || 1;
  if (q.ch) mul *= 1 + (p.stats.chainDmg || 0);
  if (q.emp) mul *= ARC.insc;
  if (q.fm) mul *= q.fm;
  if (p.cls === 'summoner' && !q.self) mul *= 1 + (p.stats.summonDmg || 0);
  return { hitstop: 3, ...o, dmgMul: (o.dmgMul || 1) * mul, style: o.style || p.cls, ult: q.ult || o.ult || undefined };
}
/** Hit a shape and tell the clients what to draw (client/fxarcana.js). */
function strike(sim, p, q, sh, o, look, extra = null) {
  if (sim.predicting) return 0;
  const n = hitEnemiesInShape(sim, p, sh, opts(p, q, o));
  sim.emit({ type: 'arcx', ph: 'hit', pid: p.id, cls: p.cls, look, x: R0(sh.x), y: R0(sh.y), r: sh.r, ang: r2(sh.ang || 0), arc: sh.arc, len: sh.len, w: sh.w, shape: sh.shape, n, emp: q.emp ? 1 : undefined, ult: q.ult ? 1 : undefined, ...(extra || {}) });
  return n;
}
const circ = (x, y, r) => ({ shape: 'circle', x, y, r });
function nearAim(sim, x, y, range, n) {
  return targetsOf(sim).filter((e) => !e.dead && Math.hypot(e.x - x, e.y - y) < range + e.r).sort((u, v) => Math.hypot(u.x - x, u.y - y) - Math.hypot(v.x - x, v.y - y)).slice(0, n);
}
function aroundPt(sim, x, y, range, i) {
  const list = targetsOf(sim).filter((e) => !e.dead && Math.hypot(e.x - x, e.y - y) < range + e.r);
  if (list.length && i % 3 !== 2) { const e = list[(i * 7) % list.length]; return { x: e.x, y: e.y, id: e.id }; }
  const g = i * 2.39996, d = 90 + ((i * 131) % 420);
  return { x: x + Math.cos(g) * d, y: y + Math.sin(g) * d * 0.7 };
}
function bossNear(sim, p, x, y, range) {
  let best = null, bs = Infinity;
  for (const e of targetsOf(sim)) {
    if (e.dead || !(e.boss || e.elite)) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < range + e.r && d < bs) { bs = d; best = e; }
  }
  return best;
}

// ------------------------------------------------------------------ queued creature strikes
const JOBS = {
  /** a sprite dives onto an enemy (or a fire elemental punch). */
  sprite(sim, p, q) {
    const e = byId(sim, q.id);
    const x = e && !e.dead ? e.x : q.x, y = e && !e.dead ? e.y : q.y;
    strike(sim, p, q, circ(x, y, q.r), { mul: q.mul, kb: q.kb || 40, stagger: q.stagger || 0, hitstop: q.hs || 2, heavy: !!q.heavy }, q.look || 'sprite', { i: q.i, fx: R0(q.fx ?? p.x), fy: R0(q.fy ?? p.y) });
  },
  /** a wyrm breath wave (cone). */
  breath(sim, p, q) {
    strike(sim, p, q, { shape: 'cone', x: q.x, y: q.y, ang: q.ang, arc: q.arc, r: q.r }, { mul: q.mul, slow: q.slow, slowMul: 0.5, kb: 30, stack: ['chill', q.chill], freeze: q.freeze || 0, hitstop: 2 }, 'breath', { i: q.i });
  },
  /** a roc lightning bolt. */
  bolt(sim, p, q) {
    strike(sim, p, q, circ(q.x, q.y, q.r), { mul: q.mul, kb: 50, stagger: 6, critChill: true, shock: true, hitstop: 3 }, 'bolt', { i: q.i });
  },
  /** the phoenix sweeps (Legendary Page vs a pack). */
  phoenix(sim, p, q) {
    strike(sim, p, q, { shape: 'line', x: q.x, y: q.y, ang: q.ang, len: q.len, w: q.w }, { mul: q.mul, kb: 160, stagger: 10, hitstop: 4, heavy: true }, 'phoenix', { i: q.i });
  },
  /** the kraken squeezes / crushes (Legendary Page vs a boss). */
  kraken(sim, p, q) {
    const e = byId(sim, q.id);
    const x = e && !e.dead ? e.x : q.x, y = e && !e.dead ? e.y : q.y;
    if (q.crush) strike(sim, p, q, circ(x, y, q.r + 30), { mul: q.mul, stagger: 40, poise: 20, heavy: true, hitstop: 10, bonusVsFrozen: q.solid, solidBonus: q.solid, bigNum: true }, 'krakencrush');
    else strike(sim, p, q, circ(x, y, q.r), { mul: q.mul, root: 30, freeze: 40, stagger: 10, stack: ['chill', 2], hitstop: 3 }, 'kraken', { i: q.i });
  },
  /** an Echo Chord bounce. */
  echo(sim, p, q) {
    const e = byId(sim, q.id);
    if (!e || e.dead) return;
    hitEnemy(sim, p, e, opts(p, q, { mul: q.mul, kb: 60, stagger: 8, hitstop: 3, kbAng: Math.atan2(e.y - q.fy, e.x - q.fx) }));
    sim.emit({ type: 'arcx', ph: 'echo', pid: p.id, cls: p.cls, fx: R0(q.fx), fy: R0(q.fy), x: R0(e.x), y: R0(e.y), i: q.i, r: e.r });
    if (q.i + 1 >= q.max) return;
    q.hit.push(e.id);
    const nx = targetsOf(sim).filter((t) => !t.dead && !q.hit.includes(t.id) && Math.hypot(t.x - e.x, t.y - e.y) < q.hop + t.r).sort((u, v) => Math.hypot(u.x - e.x, u.y - e.y) - Math.hypot(v.x - e.x, v.y - e.y))[0];
    if (nx) queue(sim, p, 5, { ...q, k: 'echo', id: nx.id, fx: e.x, fy: e.y, i: q.i + 1, mul: q.base * (1 + q.grow * (q.i + 1)) });
  },
};
/** Grimoire Unbound: a creature strikes by itself. */
function unboundStrike(sim, p) {
  const U = ARC.unbound, A = p.arc, i = A.ab++ % U.kinds.length;
  const list = targetsOf(sim).filter((e) => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < U.r + e.r);
  if (!list.length) return;
  const e = list[(A.ab * 5) % list.length], kind = U.kinds[i];
  strike(sim, p, { ult: true }, circ(e.x, e.y, U.rs[i]), { mul: U.muls[i], kb: 80, stagger: 8, hitstop: 2, stack: kind === 'wyrm' || kind === 'kraken' ? ['chill', 1] : undefined, critChill: kind === 'roc', shock: kind === 'roc' }, 'auto', { kind, fx: R0(p.x), fy: R0(p.y) });
}

// ------------------------------------------------------------------ the moves (skill / chain / finisher id -> { start, tick })
const fire = (fn) => (sim, p, a) => { if (!sim.predicting) fn(sim, p, a); };
export const ARC_SKILLS = {
  // ===================== GRIMOIRE SUMMONER =====================
  fire_sprites: {
    start(sim, p, a) { a.dur = 14; a.cancel = 9; a.moveMul = 0.5; },
    tick(sim, p, a) {
      if (a.t !== 3 || sim.predicting) return;
      const s = SS('summoner', 'Q'), t = clampPt(p, a.data.tx, a.data.ty, s.range), q0 = { emp: a.data.emp };
      if (a.data.emp) { // the turned page: a FIRE ELEMENTAL grows on the target and punches
        const e = pickTarget(sim, p, a.data.tx, a.data.ty, s.range) || null;
        for (let i = 0; i < 4; i++) queue(sim, p, 2 + i * 6, { k: 'sprite', ...q0, id: e && e.id, x: e ? e.x : t.x, y: e ? e.y : t.y, r: 95, mul: 0.7, i, look: 'elemental', kb: 30 });
        queue(sim, p, 28, { k: 'sprite', ...q0, id: e && e.id, x: e ? e.x : t.x, y: e ? e.y : t.y, r: 130, mul: 1.4, i: 4, look: 'elementalslam', kb: 220, stagger: 24, heavy: true, hs: 7 });
        return;
      }
      const tg = nearAim(sim, t.x, t.y, 220, s.n);
      for (let h = 0; h < s.hits; h++) for (let j = 0; j < s.n; j++) {
        const e = tg.length ? tg[j % tg.length] : null, g = j * 2.1 + h;
        queue(sim, p, 2 + h * s.every + j, { k: 'sprite', ...q0, id: e && e.id, x: e ? e.x : t.x + Math.cos(g) * 60, y: e ? e.y : t.y + Math.sin(g) * 40, r: 50, mul: s.mul, i: j, fx: p.x, fy: p.y - 30 });
      }
    },
  },
  frost_wyrm: {
    start(sim, p, a) { a.dur = 18; a.cancel = 12; a.moveMul = 0.3; },
    tick(sim, p, a) {
      if (a.t !== 4 || sim.predicting) return;
      const s = SS('summoner', 'E');
      for (let i = 0; i < s.pulses; i++) queue(sim, p, i * s.every, { k: 'breath', emp: a.data.emp, x: p.x, y: p.y, ang: a.ang, arc: s.arc, r: s.r, mul: s.mul, slow: s.slow, chill: a.data.emp ? 2 : 1, freeze: a.data.emp && i === s.pulses - 1 ? 70 : 0, i });
    },
  },
  thunder_roc: {
    start(sim, p, a) { a.dur = 16; a.cancel = 10; a.moveMul = 0.4; },
    tick(sim, p, a) {
      if (a.t !== 3 || sim.predicting) return;
      const s = SS('summoner', 'R'), emp = a.data.emp, n = emp ? 8 : s.bolts;
      sim.emit({ type: 'arcx', ph: 'roc', pid: p.id, cls: p.cls, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), len: s.len, T: n * s.every, emp: emp ? 1 : undefined });
      for (let i = 0; i < n; i++) {
        const d = s.len * (0.2 + 0.8 * ((emp ? i / 2 : i) % s.bolts) / Math.max(1, s.bolts - 1)), off = emp ? (i % 2 ? 70 : -70) : 0;
        const x = p.x + Math.cos(a.ang) * d - Math.sin(a.ang) * off, y = p.y + Math.sin(a.ang) * d + Math.cos(a.ang) * off;
        queue(sim, p, 4 + i * (emp ? 3 : s.every), { k: 'bolt', emp, x, y, r: emp ? s.r + 20 : s.r, mul: s.mul, i });
      }
    },
  },
  turn_the_page: {
    start(sim, p, a) { a.dur = 16; a.cancel = 10; a.moveMul = 0.5; },
    tick(sim, p, a) { if (a.t === 4) { const s = SS('summoner', 'F'); strike(sim, p, { self: true }, circ(p.x, p.y, s.r), { mul: s.mul, kb: 90, stagger: 6 }, 'page'); } },
  },
  legendary_page: {
    start(sim, p, a) {
      a.dur = 30; a.cancel = 22; a.moveMul = 0.2;
      const s = SS('summoner', 'SP');
      const b = sim.predicting ? null : bossNear(sim, p, a.data.tx, a.data.ty, s.krange);
      a.data.kr = b ? 1 : 0; if (b) { a.data.tid = b.id; a.ang = Math.atan2(b.y - p.y, b.x - p.x); }
      sim.emit({ type: 'spx', ph: 'cast', pid: p.id, cls: p.cls, id: 'legendary_page', x: R0(p.x), y: R0(p.y), ang: r2(a.ang), kr: a.data.kr || undefined });
    },
    tick(sim, p, a) {
      if (a.t !== 6 || sim.predicting) return;
      const s = SS('summoner', 'SP');
      gainArc(sim, p, 25, 'Legendary Page');
      if (a.data.kr) {
        const e = byId(sim, a.data.tid);
        sim.emit({ type: 'arcx', ph: 'krakenrise', pid: p.id, cls: p.cls, x: R0(e ? e.x : a.data.tx), y: R0(e ? e.y : a.data.ty), r: s.kr });
        for (let i = 0; i < s.squeezes; i++) queue(sim, p, 8 + i * 7, { k: 'kraken', id: e && e.id, x: e ? e.x : a.data.tx, y: e ? e.y : a.data.ty, r: s.kr, mul: s.kmul, i });
        queue(sim, p, 8 + s.squeezes * 7 + 6, { k: 'kraken', crush: 1, id: e && e.id, x: e ? e.x : a.data.tx, y: e ? e.y : a.data.ty, r: s.kr, mul: s.crush, solid: s.solid });
      } else {
        sim.emit({ type: 'arcx', ph: 'phoenixrise', pid: p.id, cls: p.cls, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), len: s.len, w: s.w });
        for (let i = 0; i < s.passes; i++) queue(sim, p, 4 + i * s.every, { k: 'phoenix', x: p.x, y: p.y, ang: a.ang + (i ? Math.PI * 0 : 0), len: s.len, w: s.w, mul: s.mul, i });
        const mx = p.x + Math.cos(a.ang) * s.len * 0.55, my = p.y + Math.sin(a.ang) * s.len * 0.55;
        addArea(sim, { team: 'player', ownerId: p.id, shape: 'line', x: p.x, y: p.y, ang: a.ang, len: s.len, w: s.w * 0.8, delay: 18, pulses: 5, every: 15, kind: 'phoenixfire', o: { mul: s.burn, hitstop: 0, dmgMul: ARC.dmg.summoner } });
        void mx; void my;
      }
    },
  },
  grimoire_unbound: {
    start(sim, p, a) { a.dur = 30; a.cancel = 24; a.moveMul = 0; a.lockMove = true; p.iframes = Math.max(p.iframes, 22); },
    tick(sim, p, a) { p.superArmor = true; if (a.t === 18) { strike(sim, p, { ult: true, self: true }, circ(p.x, p.y, 300), { mul: 3.4, kb: 320, knockup: 40, stagger: 30, poise: 20, hitstop: 10, heavy: true }, 'unbound'); p.hitstop = Math.max(p.hitstop, 6); } },
  },
  bestiary_stampede: {
    start(sim, p, a) { const S = ARC.stampede; a.dur = S.end + 4; a.cancel = a.dur; a.lockMove = true; a.moveMul = 0; a.data.fin = 1; a.data.ox = p.x; a.data.oy = p.y; p.iframes = Math.max(p.iframes, a.dur + 6); },
    tick(sim, p, a) {
      const S = ARC.stampede, q = { ult: true, fm: 1 + Math.min(1, p.res / 100) * 0.5 };
      p.superArmor = true; p.iframes = Math.max(p.iframes, 4);
      const t = a.t - S.from;
      if (t >= 0 && t % S.every === 0 && t / S.every < S.n) {
        const i = t / S.every, pt = aroundPt(sim, a.data.ox, a.data.oy, S.range, i), kind = ARC.unbound.kinds[i % 4];
        strike(sim, p, q, circ(pt.x, pt.y, S.r), { mul: S.mul, kb: 140, knockup: 12, stagger: 8, hitstop: 2, stack: kind === 'wyrm' ? ['chill', 1] : undefined }, 'stampede', { kind, i, fx: R0(pt.x - 420 * (i % 2 ? 1 : -1)), fy: R0(pt.y - 60) });
      }
      if (a.t === S.burstAt) { strike(sim, p, { ...q, bigNum: true }, circ(p.x, p.y, S.burstR), { mul: S.burstMul, kb: 380, knockup: 50, stagger: 40, poise: 30, hitstop: 14, heavy: true, bigNum: true }, 'rebirth'); p.hitstop = Math.max(p.hitstop, 8); }
      if (a.t === S.end) endUltWindow(sim, p, 'bestiary_stampede');
    },
  },
  final_chapter: {
    start(sim, p, a) {
      const S = ARC.chapter; a.dur = S.end + 4; a.cancel = a.dur; a.lockMove = true; a.moveMul = 0; a.data.fin = 1; p.iframes = Math.max(p.iframes, a.dur + 6);
      if (!sim.predicting) { const e = bossNear(sim, p, a.data.tx, a.data.ty, S.range) || pickTarget(sim, p, a.data.tx, a.data.ty, S.range); if (e) { a.data.tid = e.id; a.ang = Math.atan2(e.y - p.y, e.x - p.x); } }
    },
    tick(sim, p, a) {
      const S = ARC.chapter, q = { ult: true, fm: 1 + Math.min(1, p.res / 100) * 0.5 };
      p.superArmor = true; p.iframes = Math.max(p.iframes, 4);
      const e = byId(sim, a.data.tid), x = e && !e.dead ? e.x : clampPt(p, a.data.tx, a.data.ty, 300).x, y = e && !e.dead ? e.y : clampPt(p, a.data.tx, a.data.ty, 300).y;
      if (a.t === S.pullAt) strike(sim, p, q, circ(x, y, 130), { mul: 0.8, root: 50, freeze: 50, stack: ['chill', 2], stagger: 20, hitstop: 4 }, 'chapterpull');
      const t = a.t - S.pullAt - 8;
      if (t >= 0 && t % S.every === 0 && t / S.every < S.hits) { const i = t / S.every; strike(sim, p, q, circ(x, y, 110), { mul: S.hitMul, stagger: 8, hitstop: 3, critChill: i === 2, shock: i === 2 }, 'chapterhit', { kind: ARC.unbound.kinds[i % 5], i }); }
      if (a.t === S.crashAt && !sim.predicting) {
        const solid = e && !e.dead && stackN(e, 'chill', p.id) >= 2;
        sim.emit({ type: 'arcx', ph: 'hit', pid: p.id, cls: p.cls, look: 'bookslam', x: R0(x), y: R0(y), r: S.splashR, n: 0, ult: 1 });
        if (e && !e.dead) hitEnemy(sim, p, e, opts(p, q, { mul: S.base + (solid ? S.solid : 0), forceCrit: true, stagger: 60, poise: 40, heavy: true, hitstop: 16, bigNum: true, kb: 0 }));
        for (const o of sim.enemies) if (!o.dead && o !== e && Math.hypot(o.x - x, o.y - y) < S.splashR + o.r) hitEnemy(sim, p, o, opts(p, q, { mul: S.splash, kb: 300, kbAng: Math.atan2(o.y - y, o.x - x), stagger: 30, heavy: true, hitstop: 8 }));
        p.hitstop = Math.max(p.hitstop, 10);
      }
      if (a.t === S.end) endUltWindow(sim, p, 'final_chapter');
    },
  },
  // ===================== BARD =====================
  sonic_riff: {
    start(sim, p, a) { a.dur = 14; a.cancel = 9; a.moveMul = 0.4; },
    tick(sim, p, a) { if (a.t === 4) { const s = SS('bard', 'Q'); strike(sim, p, {}, { shape: 'line', x: p.x, y: p.y, ang: a.ang, len: s.len, w: s.w }, { mul: s.mul, kb: 110, stagger: 6, hitstop: 3 }, 'riff'); } },
  },
  echo_chord: {
    start(sim, p, a) { a.dur = 16; a.cancel = 10; a.moveMul = 0.4; },
    tick(sim, p, a) {
      if (a.t !== 4 || sim.predicting) return;
      const s = SS('bard', 'E'), e = pickTarget(sim, p, a.data.tx, a.data.ty, 480);
      if (!e) { sim.emit({ type: 'arcx', ph: 'echo', pid: p.id, cls: p.cls, fx: R0(p.x), fy: R0(p.y), x: R0(clampPt(p, a.data.tx, a.data.ty, 300).x), y: R0(clampPt(p, a.data.tx, a.data.ty, 300).y), i: 0, miss: 1 }); return; }
      queue(sim, p, 0, { k: 'echo', id: e.id, fx: p.x, fy: p.y, i: 0, max: s.bounces, hop: s.hop, base: s.mul, grow: s.grow, mul: s.mul, hit: [] });
    },
  },
  healing_hymn: {
    start(sim, p, a) { a.dur = 18; a.cancel = 12; a.moveMul = 0.5; },
    tick(sim, p, a) {
      if (a.t !== 6 || sim.predicting) return;
      const s = SS('bard', 'R');
      let healed = 0;
      for (const q of sim.players.values()) {
        if (q.dead || q.decoy || Math.hypot(q.x - p.x, q.y - p.y) > s.r + q.r) continue;
        healed += healPlayer(sim, q, q.stats.maxHp * s.heal + p.stats.atk * s.atk, p);
        q.stun = 0; // cleanse
      }
      strike(sim, p, {}, circ(p.x, p.y, s.pr), { mul: s.mul, kb: 120, stagger: 6 }, 'hymn', { hr: s.r, healed: R0(healed) });
    },
  },
  dissonance: {
    start(sim, p, a) { a.dur = 18; a.cancel = 12; a.moveMul = 0.3; },
    tick(sim, p, a) { if (a.t === 6) { const s = SS('bard', 'F'); strike(sim, p, {}, { shape: 'cone', x: p.x, y: p.y, ang: a.ang, arc: s.arc, r: s.r }, { mul: s.mul, stagger: s.stun, kb: 80, hitstop: 5, heavy: true, stack: ['disso', 1] }, 'disso'); } },
  },
  crescendo: {
    start(sim, p, a) { const s = SS('bard', 'SP'); a.dur = s.charge + 16; a.cancel = s.charge + 10; a.moveMul = 0.15; a.data.k = songCount(p); sim.emit({ type: 'spx', ph: 'cast', pid: p.id, cls: p.cls, id: 'crescendo', x: R0(p.x), y: R0(p.y), r: s.r, k: a.data.k, charge: s.charge }); },
    tick(sim, p, a) {
      const s = SS('bard', 'SP');
      if (a.t < s.charge) { p.superArmor = true; return; }
      if (a.t !== s.charge || sim.predicting) return;
      const k = Math.min(4, songCount(p));
      strike(sim, p, {}, circ(p.x, p.y, s.r), { mul: s.mul * (1 + s.per * k), kb: s.kb, stagger: 30, poise: 20, heavy: true, hitstop: 10, bigNum: k >= 3 || undefined }, 'crescendo', { k });
      gainArc(sim, p, s.tempo, 'Crescendo');
      p.hitstop = Math.max(p.hitstop, 5);
    },
  },
  encore: {
    start(sim, p, a) { a.dur = 28; a.cancel = 22; a.moveMul = 0; a.lockMove = true; p.iframes = Math.max(p.iframes, 20); },
    tick(sim, p, a) {
      p.superArmor = true;
      if (a.t !== 16 || sim.predicting) return;
      strike(sim, p, { ult: true }, circ(p.x, p.y, 290), { mul: 3.0, kb: 320, knockup: 36, stagger: 30, poise: 20, hitstop: 10, heavy: true }, 'encore');
      const S = p.songs, live = S ? SONG_KINDS.filter((k) => S[k] && S[k].t > 0) : [];
      const play = live.length ? live : ['valor', 'haste'];
      for (const k of play) playSong(sim, p, k, Math.max(1, (S && S[k] && S[k].t > 0 ? S[k].k : 1)) * ARC.songs.encore, ARC.songs.dur + 120);
      p.hitstop = Math.max(p.hitstop, 6);
    },
  },
  fortissimo: {
    start(sim, p, a) { const F = ARC.fort; a.dur = F.end + 4; a.cancel = a.dur; a.lockMove = true; a.moveMul = 0; a.data.fin = 1; a.data.ox = p.x; a.data.oy = p.y; p.iframes = Math.max(p.iframes, a.dur + 6); },
    tick(sim, p, a) {
      const F = ARC.fort, q = { ult: true, fm: 1 + F.per * songCount(p) };
      p.superArmor = true; p.iframes = Math.max(p.iframes, 4);
      const t = a.t - F.from;
      if (t >= 0 && t % F.every === 0 && t / F.every < F.n) { const i = t / F.every, pt = aroundPt(sim, a.data.ox, a.data.oy, F.range, i); strike(sim, p, q, circ(pt.x, pt.y, F.r), { mul: F.mul, kb: 90, stagger: 6, hitstop: 2 }, 'bignote', { i }); }
      if (a.t === F.chordAt) { strike(sim, p, q, circ(p.x, p.y, F.chordR), { mul: F.chordMul, kb: 380, knockup: 46, stagger: 40, poise: 30, hitstop: 14, heavy: true, bigNum: true }, 'finalchord'); p.hitstop = Math.max(p.hitstop, 8); }
      if (a.t === F.end) endUltWindow(sim, p, 'fortissimo');
    },
  },
  death_knell: {
    start(sim, p, a) {
      const K = ARC.knell; a.dur = K.end + 4; a.cancel = a.dur; a.lockMove = true; a.moveMul = 0; a.data.fin = 1; p.iframes = Math.max(p.iframes, a.dur + 6);
      if (!sim.predicting) { const e = bossNear(sim, p, a.data.tx, a.data.ty, K.range) || pickTarget(sim, p, a.data.tx, a.data.ty, K.range); if (e) { a.data.tid = e.id; a.ang = Math.atan2(e.y - p.y, e.x - p.x); } }
    },
    tick(sim, p, a) {
      const K = ARC.knell, q = { ult: true };
      p.superArmor = true; p.iframes = Math.max(p.iframes, 4);
      const e = byId(sim, a.data.tid), c = clampPt(p, a.data.tx, a.data.ty, 300), x = e && !e.dead ? e.x : c.x, y = e && !e.dead ? e.y : c.y;
      const t = a.t - K.from;
      if (t >= 0 && t % K.every === 0 && t / K.every < K.tolls) strike(sim, p, q, circ(x, y, K.tollR), { mul: K.tollMul, stagger: 14, hitstop: 4, stack: ['disso', 1] }, 'toll', { i: t / K.every });
      if (a.t === K.crashAt && !sim.predicting) {
        const k = songCount(p);
        sim.emit({ type: 'arcx', ph: 'hit', pid: p.id, cls: p.cls, look: 'knell', x: R0(x), y: R0(y), r: K.splashR, n: 0, ult: 1, k });
        if (e && !e.dead) hitEnemy(sim, p, e, opts(p, q, { mul: K.base + K.per * k, forceCrit: true, stagger: 60, poise: 40, heavy: true, hitstop: 16, bigNum: true, kb: 0 }));
        for (const o of sim.enemies) if (!o.dead && o !== e && Math.hypot(o.x - x, o.y - y) < K.splashR + o.r) hitEnemy(sim, p, o, opts(p, q, { mul: K.splash, kb: 300, kbAng: Math.atan2(o.y - y, o.x - x), stagger: 30, heavy: true, hitstop: 8 }));
        p.hitstop = Math.max(p.hitstop, 10);
      }
      if (a.t === K.end) endUltWindow(sim, p, 'death_knell');
    },
  },
};
void fire; void stackOf; void addStacks;

/** The ult window ran out without a finisher (kit.js endUltWindow): the Last Page / the Final Bow. */
export function arcUltEnd(sim, p) {
  if (!isArc(p) || sim.predicting) return;
  if (isGrim(p)) { const L = ARC.lastPage; strike(sim, p, { ult: true }, circ(p.x, p.y, L.r), { mul: L.mul, kb: 220, stagger: 20, hitstop: 6, stack: ['chill', 1] }, 'lastpage'); }
  else { const B = ARC.bow; strike(sim, p, { ult: true }, circ(p.x, p.y, B.r), { mul: B.mul, kb: 260, stagger: 20, hitstop: 6 }, 'finalbow'); }
}
