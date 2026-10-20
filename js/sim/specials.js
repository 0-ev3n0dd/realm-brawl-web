// The SPECIAL skill of every class (4th slot, internal key 'SP', F by default) and the generic executor of the Special chains
// (data/specials-data.js). Stronger and more unique than Q/E/R, weaker than the ultimate, 16-18 s cooldowns.
// Everything that touches enemies runs only in the authoritative sim (`!sim.predicting`); a predicting co-op client only times
// the action (and moves the hero for dashes / leaps) and waits for the server's events.
import { CLASSES, SPK, SPECIAL_KIT } from './data/classes.js';
import { DT } from './constants.js';
import { pointBlocked, clearPath } from './world.js';
import { hitEnemy, hitEnemiesInShape, addArea, grantShield } from './combat.js';
import { targetsOf, pickTarget, dragIn } from './player.js';
import { addStacks, takeStacks, chainHist } from './kit.js';
import { gainGlory, weaponOfKey } from './warrior.js';
import { gainFocus, SAM } from './samurai.js';
import { gainChi, MONK, monkTier } from './monk.js';
import { DRG } from './dragoon.js';
import { ARC, songCount } from './arcana.js';

export { SPK };
const R0 = (v) => Math.round(v);
const r2 = (v) => Math.round(v * 100) / 100;
const ST = (cls) => CLASSES[cls].skills[SPK].stats;
/** Class-wide skill damage scale (the Samurai and the Monk keep readable per-skill numbers and scale them). */
export const classScale = (cls) => (cls === 'samurai' ? SAM.dmg : cls === 'monk' ? MONK.dmg : cls === 'dragoon' ? DRG.dmg : cls === 'summoner' ? ARC.dmg.summoner : cls === 'bard' ? ARC.dmg.bard : 1);
export const SPEC = { markDecay: 1, echoDelay: [8, 14], echoShow: 4 };

function clampPt(sim, p, tx, ty, range) {
  let dx = tx - p.x, dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  if (d > range) { dx *= range / d; dy *= range / d; }
  return { x: p.x + dx, y: p.y + dy };
}
function offWalls(sim, p, lx, ly) {
  ({ x: lx, y: ly } = clearPath(sim.world, p.x, p.y, lx, ly, p.r)); // (swept: never tunnels through walls / props)
  return { x: lx, y: ly };
}
/** Straight move (dash / leap) stored on the action so a predicting client moves the same way (packMe sends fx..T). */
function planMove(sim, p, a, tx, ty, T) {
  const t = offWalls(sim, p, tx, ty);
  a.data.fx = p.x; a.data.fy = p.y; a.data.lx = t.x; a.data.ly = t.y; a.data.T = T;
}
function moveTick(p, a, ease = true) {
  const d = a.data;
  if (d.lx == null || !(d.T > 0) || a.t >= d.T) return;
  const k = (a.t + 1) / d.T, e = ease ? k * k * (3 - 2 * k) : k;
  p.x = d.fx + (d.lx - d.fx) * e; p.y = d.fy + (d.ly - d.fy) * e;
}
const spx = (p, id) => (p.spx && p.spx.id === id && p.spx.t > 0 ? p.spx : null);
function emit(sim, p, o) { if (!sim.predicting) sim.emit({ type: 'spx', pid: p.id, cls: p.cls, ...o }); }
function queue(sim, p, delay, job) { if (!sim.predicting) (p.spq || (p.spq = [])).push({ at: sim.tick + delay, ...job }); }

// ------------------------------------------------------------------ per tick (player.js updatePlayer)
export function tickSpecials(sim, p) {
  const S = p.spx;
  if (S && S.t > 0 && --S.t <= 0) {
    if (S.id === 'shadow_clone') emit(sim, p, { ph: 'clonesEnd', x: R0(p.x), y: R0(p.y) });
    p.spx = null;
  }
  if (sim.predicting) return;
  if (p.spMarks > 0 && sim.tick % 10 === 0) { // Storm of Arrows marks run out
    let n = 0;
    for (const e of sim.enemies) if (e.spm && e.spm.pid === p.id) { e.spm.t -= 10; if (e.spm.t <= 0 || e.dead) e.spm = null; else n++; }
    p.spMarks = n;
  }
  if (p.spq && p.spq.length) {
    const due = p.spq.filter((q) => q.at <= sim.tick);
    if (!due.length) return;
    p.spq = p.spq.filter((q) => q.at > sim.tick);
    let shown = 0;
    for (const q of due) JOBS[q.k](sim, p, q, shown++);
  }
}

const JOBS = {
  /** Warlord's Decree: a free swing of another weapon. */
  swing(sim, p, q) {
    const s = ST('warrior'), w = q.w, ang = p.aim;
    const sh = { shape: 'cone', x: p.x, y: p.y, ang, arc: s.swingArc, r: s.swingR };
    const o = { mul: s.swing, style: 'wm' + w, wmw: w, heavy: true, hitstop: 4, kb: w === 'G' ? 300 : 80, stagger: 10, dmgMul: 1 + (p.stats.chainDmg || 0) };
    if (w === 'A') o.stack = ['bleed', s.bleed];
    if (w === 'H') { o.poise = s.poise; o.stagger = 24; }
    const n = hitEnemiesInShape(sim, p, sh, o);
    sim.emit({ type: 'wm', ph: 'hit', pid: p.id, w, fx: w === 'G' ? 'cleave' : w === 'A' ? 'axespin' : 'skull', emp: 1, x: R0(p.x), y: R0(p.y), ang: r2(ang), r: sh.r, arc: sh.arc, shape: 'cone', n });
    emit(sim, p, { ph: 'decreeSwing', w, x: R0(p.x), y: R0(p.y), ang: r2(ang), n });
  },
  /** Shadow Clone Jutsu: a clone repeats one of your hits. */
  echo(sim, p, q, shown) {
    const e = sim.enemyById.get(q.id) || targetsOf(sim).find((t) => t.id === q.id);
    if (!e || e.dead) return;
    hitEnemy(sim, p, e, { mul: q.mul, kb: 0, hitstop: 1, clone: true, echo: true, noPop: true, style: 'clone' });
    if (shown < SPEC.echoShow) emit(sim, p, { ph: 'echo', c: q.c, id: e.id, x: R0(e.x), y: R0(e.y), r: e.r });
  },
  /** Divine Hammer lands. */
  hammer(sim, p, q) {
    const s = ST('cleric'), cls = CLASSES.cleric;
    const n = hitEnemiesInShape(sim, p, { shape: 'circle', x: q.x, y: q.y, r: s.r }, { mul: s.mul, stagger: s.stun, knockdown: 0, poise: 30, heavy: true, hitstop: 10, stack: ['condemn', s.condemn], kb: 260 });
    const consec = !!(p.cst && cls.state && p.cst.g);
    const amt = s.shield * (consec ? s.consec : 1);
    let sh = 0;
    for (const t of sim.players.values()) {
      if (t.dead || t.decoy || Math.hypot(t.x - p.x, t.y - p.y) > s.shieldR + t.r) continue;
      grantShield(sim, t, t.stats.maxHp * amt, s.shieldT, p); sh++;
    }
    emit(sim, p, { ph: 'impact', id: 'divine_hammer', x: R0(q.x), y: R0(q.y), r: s.r, n, sh, consec: consec ? 1 : undefined });
  },
};

// ------------------------------------------------------------------ hooks from player.js / combat.js
/** A skill / chain was cast (player.js startSkill, after its handler started). */
export function specOnCast(sim, p, a, key, chain) {
  if (!chain || chain.route || !p.spx) return;
  const D = spx(p, 'warlords_decree');
  if (D && !sim.predicting) { // every chain swings the other two weapons for free
    const w = weaponOfKey(key) || (p.wm && p.wm.st) || 'G';
    const others = ['G', 'A', 'H'].filter((x) => x !== w);
    queue(sim, p, 10, { k: 'swing', w: others[0] });
    queue(sim, p, 18, { k: 'swing', w: others[1] });
    D.n = (D.n || 0) + 1;
  }
  const C = spx(p, 'shadow_clone');
  if (C && C.n > 0) {
    a.data.cln = 1; C.n--;
    emit(sim, p, { ph: 'cloneCopy', n: C.n, chain: chain.id, x: R0(p.x), y: R0(p.y), ang: r2(a.ang) });
    if (C.n <= 0) C.t = Math.min(C.t, 75); // the clones fade after the 3rd chain
  }
}
/** Extra damage multiplier from Specials on this hit (Storm of Arrows: MARKED takes +20% from you). */
export function specHitMul(sim, p, e) {
  const m = e.spm;
  return m && m.pid === p.id && m.t > 0 ? m.mul : 1;
}
/** Does this hit force a crit (Marked for Death on a MARKED enemy)? */
export function specCrit(p, e, o) { return !!(o.critMarked && e.spm && e.spm.pid === p.id && e.spm.t > 0); }
/** After a hit landed (combat.js hitEnemy, authoritative). */
export function specOnHit(sim, p, e, o) {
  if (sim.predicting) return;
  if (o.spMark && !e.dead) { // Storm of Arrows: MARK (+2 Quarry the first time)
    const s = ST('ranger');
    if (!(e.spm && e.spm.pid === p.id && e.spm.t > 0)) addStacks(sim, p, e, 'quarry', s.quarry);
    e.spm = { pid: p.id, t: s.markT, mul: s.mark };
    p.spMarks = (p.spMarks || 0) + 1;
  }
  const act = p.action;
  if (act && act.data && act.data.cln && !o.clone && !o.dot && !o.ult && !o.echo && !e.dead) { // Shadow Clone Jutsu: both clones copy the hit
    const s = ST('bladedancer');
    if ((act.data.ce || 0) < s.cap) {
      act.data.ce = (act.data.ce || 0) + 1;
      for (let c = 0; c < s.clones; c++) queue(sim, p, SPEC.echoDelay[c] || 10, { k: 'echo', id: e.id, mul: (o.mul || 1) * s.echo * (o.dmgMul || 1), c });
    }
  }
}
/** For the HUD / tooltips: the live Special state. */
export function specInfo(p) { return p.spx && p.spx.t > 0 ? { id: p.spx.id, t: p.spx.t, n: p.spx.n || 0 } : null; }

// ------------------------------------------------------------------ the Specials
function aimT(p, a, range) { return { x: a.data.tx, y: a.data.ty, r: range }; }

const SPECIALS = {
  warlords_decree: {
    start(sim, p, a) { a.dur = 30; a.cancel = 22; a.lockMove = true; p.iframes = Math.max(p.iframes, 16); emit(sim, p, { ph: 'cast', id: 'warlords_decree', x: R0(p.x), y: R0(p.y), r: ST('warrior').r }); },
    tick(sim, p, a) {
      const s = ST('warrior');
      if (a.t < 14 && !sim.predicting) dragIn(sim, p, s.r, 1400, 0.1);
      if (a.t !== 14) return;
      p.spx = { id: 'warlords_decree', t: s.dur, n: 0 };
      if (sim.predicting) return;
      const n = hitEnemiesInShape(sim, p, { shape: 'circle', x: p.x, y: p.y, r: s.r * 0.75 }, { mul: s.mul, stagger: 30, poise: 16, heavy: true, hitstop: 8, kb: 120, style: 'wmH', wmw: 'H' });
      for (const e of sim.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < s.r + e.r) e.taunt = { pid: p.id, t: s.taunt };
      gainGlory(sim, p, s.glory, 'Decree');
      sim.emit({ type: 'wm', ph: 'shout', pid: p.id, id: 'war_cry', w: 'G', x: R0(p.x), y: R0(p.y), r: s.r, n });
      emit(sim, p, { ph: 'impact', id: 'warlords_decree', x: R0(p.x), y: R0(p.y), r: s.r, n, dur: s.dur });
    },
  },
  storm_of_arrows: {
    start(sim, p, a) {
      a.dur = 20; a.cancel = 12; a.moveMul = 0.3;
      const s = ST('ranger'), t = clampPt(sim, p, a.data.tx, a.data.ty, s.range);
      if (!sim.predicting) addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: t.x, y: t.y, r: s.r, delay: s.delay, pulses: s.pulses, every: s.every, kind: 'arrowstorm', o: { mul: s.mul, slow: 90, slowMul: 0.55, kb: 20, spMark: true, style: 'arrow', hitstop: 1 } });
      emit(sim, p, { ph: 'cast', id: 'storm_of_arrows', x: R0(t.x), y: R0(t.y), r: s.r, delay: s.delay, dur: s.delay + s.pulses * s.every });
    },
  },
  grand_meteor: {
    start(sim, p, a) {
      a.dur = 26; a.cancel = 16; a.moveMul = 0.2;
      const s = ST('mage'), t = clampPt(sim, p, a.data.tx, a.data.ty, s.range);
      const surge = !!(p.cst && CLASSES[p.cls].state), D = surge ? s.surgeDelay : s.delay;
      if (!sim.predicting) {
        addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: t.x, y: t.y, r: s.r, delay: D, pulses: 1, kind: 'meteor', big: true, o: { mul: s.mul, knockdown: 80, stack: ['burn', s.burn], bonusVsFrozen: s.frozen, heavy: true, hitstop: 10, kb: 300 } });
        addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: t.x, y: t.y, r: s.burnR, delay: D + 6, pulses: s.burnPulses, every: s.burnEvery, kind: 'burn', o: { mul: s.burnMul, stack: ['burn', 1], hitstop: 0 } });
      }
      emit(sim, p, { ph: 'cast', id: 'grand_meteor', x: R0(t.x), y: R0(t.y), r: s.r, delay: D, dur: D + s.burnPulses * s.burnEvery, surge: surge ? 1 : undefined });
    },
  },
  divine_hammer: {
    start(sim, p, a) {
      a.dur = 26; a.cancel = 18; a.moveMul = 0.2;
      const s = ST('cleric'), t = clampPt(sim, p, a.data.tx, a.data.ty, s.range);
      if (!sim.predicting) {
        addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: t.x, y: t.y, r: s.r, delay: s.delay, pulses: 1, kind: 'hammer', visual: true });
        queue(sim, p, s.delay, { k: 'hammer', x: t.x, y: t.y });
      }
      emit(sim, p, { ph: 'cast', id: 'divine_hammer', x: R0(t.x), y: R0(t.y), r: s.r, delay: s.delay });
    },
  },
  shadow_clone: {
    start(sim, p, a) { a.dur = 20; a.cancel = 12; a.moveMul = 0.3; p.iframes = Math.max(p.iframes, 12); emit(sim, p, { ph: 'cast', id: 'shadow_clone', x: R0(p.x), y: R0(p.y), ang: r2(a.ang), r: ST('bladedancer').r }); },
    tick(sim, p, a) {
      if (a.t !== 6) return;
      const s = ST('bladedancer');
      p.spx = { id: 'shadow_clone', t: s.dur, n: s.chains };
      if (sim.predicting) return;
      const n = hitEnemiesInShape(sim, p, { shape: 'circle', x: p.x, y: p.y, r: s.r }, { mul: s.mul, kb: 200, stagger: 16, hitstop: 4, clone: true });
      emit(sim, p, { ph: 'impact', id: 'shadow_clone', x: R0(p.x), y: R0(p.y), r: s.r, n, dur: s.dur, ang: r2(a.ang) });
    },
  },
  void_draw: {
    start(sim, p, a) { const s = ST('samurai'); a.dur = s.charge + 20; a.cancel = s.charge + 12; a.lockMove = true; emit(sim, p, { ph: 'cast', id: 'void_draw', x: R0(p.x), y: R0(p.y), ang: r2(a.ang), len: s.len, w: s.w, charge: s.charge }); },
    tick(sim, p, a) {
      const s = ST('samurai');
      if (a.t < s.charge) { p.superArmor = true; a.ang = p.aim; return; }
      if (a.t !== s.charge) return;
      const still = !!(p.cst && CLASSES[p.cls].state);
      if (sim.predicting) return;
      const n = hitEnemiesInShape(sim, p, { shape: 'line', x: p.x, y: p.y, ang: a.ang, len: s.len, w: s.w }, { mul: s.mul * classScale('samurai') * (still ? s.stillMul : 1), stack: ['cut', s.cuts + (still ? s.still : 0)], kb: 90, stagger: 30, heavy: true, hitstop: 10, style: 'sam' });
      gainFocus(sim, p, s.focus, 'Void Draw');
      emit(sim, p, { ph: 'impact', id: 'void_draw', x: R0(p.x), y: R0(p.y), ang: r2(a.ang), len: s.len, w: s.w, n, still: still ? 1 : undefined });
    },
  },
  dragons_descent: {
    start(sim, p, a) {
      const s = ST('monk');
      a.dur = s.T + 14; a.cancel = s.T + 8; a.lockMove = true;
      const t = clampPt(sim, p, a.data.tx, a.data.ty, s.range);
      planMove(sim, p, a, t.x, t.y, s.T);
      if (Math.hypot(a.data.lx - p.x, a.data.ly - p.y) > 4) a.ang = Math.atan2(a.data.ly - p.y, a.data.lx - p.x);
      p.iframes = Math.max(p.iframes, s.T + 4);
      a.data.emp = p.monk && p.monk.emp ? 1 : 0;
      if (a.data.emp && !sim.predicting) p.monk.emp = 0;
      emit(sim, p, { ph: 'cast', id: 'dragons_descent', x: R0(p.x), y: R0(p.y), tx: R0(a.data.lx), ty: R0(a.data.ly), T: s.T, r: s.r });
    },
    tick(sim, p, a) {
      const s = ST('monk');
      moveTick(p, a);
      if (a.t !== s.T) return;
      if (sim.predicting) return;
      const n = hitEnemiesInShape(sim, p, { shape: 'circle', x: p.x, y: p.y, r: s.r }, { mul: s.mul * classScale('monk') * (a.data.emp ? s.flowMul : 1), knockup: s.knockup, poise: 24, heavy: true, hitstop: 10, stack: ['pp', s.pp], kb: 200, style: 'spirit' });
      const M = p.monk, T = CLASSES.monk.combo.tiers;
      let tier = monkTier(p);
      if (M && tier < T.length) { M.hc = Math.max(M.hc, T[tier]); M.ht = CLASSES.monk.combo.reset; const t1 = monkTier(p); if (t1 > tier) sim.emit({ type: 'monkx', ph: 'tier', pid: p.id, tier: t1, name: CLASSES.monk.combo.names[t1], x: R0(p.x), y: R0(p.y) }); tier = t1; }
      gainChi(sim, p, s.chi, "Dragon's Descent");
      emit(sim, p, { ph: 'impact', id: 'dragons_descent', x: R0(p.x), y: R0(p.y), r: s.r, n, tier });
    },
  },
};

// ------------------------------------------------------------------ the Special chains (generic executor)
function chainMul(p, a) {
  let m = 1 + (p.stats.chainDmg || 0);
  if (p.cls === 'monk') m *= (MONK.tierMul[a.data.tier || 0] || 1) * (a.data.fe || 1);
  if (a.data.fm) m *= a.data.fm;
  return m * classScale(p.cls);
}
function origin(sim, p, a, st) {
  if (st.at === 'aim') return { x: a.data.ax, y: a.data.ay };
  if (st.at === 'tgt') {
    const e = a.data.tid != null ? sim.enemyById.get(a.data.tid) || targetsOf(sim).find((t) => t.id === a.data.tid) : null;
    if (e && !e.dead) return { x: e.x, y: e.y };
    const t = clampPt(sim, p, a.data.tx, a.data.ty, Math.min(st.range || 200, 200));
    return t;
  }
  return { x: p.x, y: p.y };
}
const WM_FX = { spin: (w) => (w === 'G' ? 'cleave' : 'axespin'), slam: () => 'skull', slash: () => 'axespin' };
/** `spread`: a multi-hit 'aim' step lands on the enemies around the aim point in turn (else scattered around it). */
function spreadPt(sim, at, st, i) {
  const list = targetsOf(sim).filter((e) => !e.dead && Math.hypot(e.x - at.x, e.y - at.y) < st.spread + 60 + e.r)
    .sort((u, v) => Math.hypot(u.x - at.x, u.y - at.y) - Math.hypot(v.x - at.x, v.y - at.y));
  if (list.length && (i < list.length || i % 2 === 0)) { const e = list[i % list.length]; return { x: e.x, y: e.y }; }
  const g = i * 2.39996, d = st.spread * (0.35 + ((i * 37) % 60) / 100);
  return { x: at.x + Math.cos(g) * d, y: at.y + Math.sin(g) * d * 0.8 };
}
function fireStep(sim, p, a, st, i) {
  let at = origin(sim, p, a, st), ang = st.at === 'self' ? a.ang : Math.atan2(at.y - p.y, at.x - p.x);
  if (st.spread) at = spreadPt(sim, at, st, i);
  if (st.fan) ang += (i - ((st.n || 1) - 1) / 2) * st.fan;
  const sh = st.shape === 'line' ? { shape: 'line', x: at.x, y: at.y, ang, len: st.len, w: st.w }
    : st.shape === 'cone' ? { shape: 'cone', x: at.x, y: at.y, ang, arc: st.arc, r: st.r } : { shape: 'circle', x: at.x, y: at.y, r: st.r };
  if (st.at === 'self' && st.shape === 'line' && a.data.fx != null && st.t <= 2) { sh.x = a.data.fx; sh.y = a.data.fy; } // dash lines start where you left
  const o = { mul: st.mul, hitstop: 3, ...(st.o || {}), dmgMul: chainMul(p, a), wchain: 1 };
  if (st.wm) { o.wmw = st.wm; o.style = 'wm' + st.wm; }
  if (st.stack) o.stack = st.stack;
  if (o.perSong) { const k = songCount(p); o.mul = st.mul * (1 + (o.perSong * k) / st.mul); if (k >= 3) o.forceCrit = true; delete o.perSong; }
  if (st.pool) addArea(sim, { team: 'player', ownerId: p.id, shape: 'circle', x: at.x, y: at.y, r: st.r, delay: st.pool.every, pulses: st.pool.pulses, every: st.pool.every, kind: 'songpool', o: { mul: st.pool.mul, slow: 40, slowMul: 0.6, hitstop: 0, dmgMul: chainMul(p, a) } });
  if (st.pop) {
    const P = st.pop;
    o.onHit = (dmg, e) => {
      if (e.dead) return;
      const n = takeStacks(sim, p, e, P.kind);
      if (n > 0) { hitEnemy(sim, p, e, { mul: P.per * n, dmgMul: chainMul(p, a), forceCrit: true, kb: 0, hitstop: 4, noPop: true, style: o.style, wmw: o.wmw }); emit(sim, p, { ph: 'pop', kind: P.kind, n, id: e.id, x: R0(e.x), y: R0(e.y), r: e.r }); }
    };
  }
  const n = hitEnemiesInShape(sim, p, sh, o);
  if (st.wm) sim.emit({ type: 'wm', ph: 'hit', pid: p.id, w: st.wm, fx: (WM_FX[st.look] || WM_FX.slash)(st.wm), emp: 1, x: R0(sh.x), y: R0(sh.y), ang: r2(ang), r: sh.r || 120, arc: sh.arc || 6.28, len: sh.len, lw: sh.w, shape: sh.shape, n });
  emit(sim, p, { ph: 'hit', id: a.chain.id, look: st.look || 'burst', shape: sh.shape, x: R0(sh.x), y: R0(sh.y), r: sh.r, ang: r2(ang), arc: sh.arc, len: sh.len, w: sh.w, i, n, last: i === (st.n || 1) - 1 ? 1 : undefined });
}
function makeChain(chain) {
  const f = chain.fx;
  return {
    start(sim, p, a) {
      a.dur = f.dur; a.cancel = f.cancel; a.moveMul = 0.2;
      const range = Math.max(...f.steps.map((s) => s.range || 0), 200);
      const t = clampPt(sim, p, a.data.tx, a.data.ty, range);
      a.data.ax = t.x; a.data.ay = t.y;
      if (f.steps.some((s) => s.at === 'tgt') && !sim.predicting) { const e = pickTarget(sim, p, a.data.tx, a.data.ty, range + 80); if (e) { a.data.tid = e.id; a.ang = Math.atan2(e.y - p.y, e.x - p.x); } }
      if (f.dash) {
        const D = f.dash;
        if (D.toAim) { const d = Math.hypot(a.data.ax - p.x, a.data.ay - p.y), k = Math.max(0, d - 20) / Math.max(1, d); planMove(sim, p, a, p.x + (a.data.ax - p.x) * k, p.y + (a.data.ay - p.y) * k, D.T); }
        else if (D.dist) planMove(sim, p, a, p.x + Math.cos(a.ang) * D.dist, p.y + Math.sin(a.ang) * D.dist, D.T);
        a.lockMove = true;
        p.iframes = Math.max(p.iframes, D.iframes || 0);
      }
      emit(sim, p, { ph: 'chain', id: chain.id, x: R0(p.x), y: R0(p.y), ang: r2(a.ang), tx: R0(a.data.ax), ty: R0(a.data.ay) });
    },
    tick(sim, p, a) {
      if (f.dash && (f.dash.dist || f.dash.toAim)) moveTick(p, a, false);
      if (sim.predicting) return;
      for (const st of f.steps) {
        const n = st.n || 1, ev = st.every || 1;
        if (a.t < st.t || a.t > st.t + (n - 1) * ev || (a.t - st.t) % ev !== 0) continue;
        fireStep(sim, p, a, st, (a.t - st.t) / ev);
      }
      if (f.area && a.t === f.area.t) { const A = f.area; addArea(sim, { team: 'player', ownerId: p.id, x: A.aim ? a.data.ax : p.x, y: A.aim ? a.data.ay : p.y, ...A, t: 0, dot: A.dot ? { ...A.dot, dmgMul: chainMul(p, a) } : undefined, o: A.o ? { ...A.o, dmgMul: chainMul(p, a) } : undefined }); }
      if (f.shield && a.t === f.steps[0].t) {
        for (const q of sim.players.values()) if (!q.dead && !q.decoy && (q === p || (f.shield.r && Math.hypot(q.x - p.x, q.y - p.y) < f.shield.r))) grantShield(sim, q, q.stats.maxHp * f.shield.pct, f.shield.t, p);
      }
    },
  };
}

/** Skill / chain id -> { start, tick } for player.js. */
export const SPEC_SKILLS = { ...SPECIALS };
for (const c of Object.values(CLASSES)) for (const ch of c.chains) if (ch.fx) SPEC_SKILLS[ch.id] = makeChain(ch); // (the class's merged chains: 5-steps are already scaled)

/** The Special chain for `key` from the key history (checked before class states, so a Special chain always wins). */
export function specChain(p, key, tick) {
  if (p.uw || p.eclipse) return null; // the ult window / Eclipse: the finisher routes own every key (5-step chains are off)
  const chains = CLASSES[p.cls].chains.filter((c) => c.sp && c.seq[c.seq.length - 1] === key).sort((a, b) => b.seq.length - a.seq.length);
  for (const c of chains) {
    let ok = true, t = tick; const H = chainHist(p, c.seq);
    for (let i = c.seq.length - 2, h = H.length - 1; i >= 0; i--, h--) {
      const e = H[h];
      if (!e || e.a !== c.seq[i] || t - e.tick > c.window) { ok = false; break; }
      t = e.tick;
    }
    if (ok) return c;
  }
  return null;
}

/** Chains v2: after a cast, if a 5-step chain is live through its Special step, its next key is readied at once (cooldown 0), so a
 *  5-step is always reachable whenever the Special is ready. Only keys AFTER the Special are readied (the Special's own cooldown
 *  gates it), so this can never loop. Off in the ult window / Eclipse (the finisher routes take priority). */
export function primeFive(sim, p) {
  if (p.uw || p.eclipse) return;
  for (const c of CLASSES[p.cls].chains) {
    if (!c.five) continue;
    const spAt = c.seq.indexOf(SPK);
    for (let n = c.seq.length - 1; n > spAt; n--) { // n = steps already done
      let ok = true, t = sim.tick; const H = chainHist(p, c.seq);
      for (let i = n - 1, h = H.length - 1; i >= 0; i--, h--) { const e = H[h]; if (!e || e.a !== c.seq[i] || t - e.tick > c.window) { ok = false; break; } t = e.tick; }
      if (ok) { const k = c.seq[n]; if (p.cds[k] > 0) p.cds[k] = 0; break; }
    }
  }
}
