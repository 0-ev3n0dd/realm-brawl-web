// Desktop hover lock-on + the high-contrast crosshair.
// Hovering an enemy (generous radius) LOCKS it. The lock is target-based, not cursor-based: once locked it stays on
// that enemy through dashes, blinks, teleports and gap-closers that carry the hero past or through it, and through the
// cursor drifting off it as the camera follows - so a rotation keeps facing the target. While locked, aimed skills,
// basics, chains and gap-closers aim at it the way the phone's auto-target does (mobile/js/touch.js leadPoint +
// LEAD_SPEED: projectile classes lead a moving target). The lock is released only when:
//   - the target dies / despawns (then, with "Auto-retarget" on, the nearest enemy near the cursor of the same kind is
//     locked: a boss lock never falls onto trash, trash falls back to the boss only when no trash is near),
//   - it is beyond LOCK.rangeScreens x the screen width from the hero, or out of line of sight for LOCK.sightTicks,
//   - another enemy is hovered for a deliberate dwell (LOCK.dwell ticks, ~170 ms: sweeping across a pack mid-combo
//     doesn't steal it; "deliberate" = the mouse moved onto it - an enemy that slides under a still cursor because the
//     camera followed your dash doesn't count), or clicked after moving the mouse onto it (an explicit pick, at once),
//   - the clear-lock key is pressed (rebindable 'clearLock': middle mouse / ` by default).
// A first lock (nothing locked yet) takes a brief hover (LOCK.acquire, ~50 ms) so a cursor flying past an enemy
// doesn't grab it. Client-side only (it just changes the aim point in the input command, sent through the normal
// input packet), so it works the same solo and in co-op. Options: "Hover lock-on" (rb.hoverLock, default ON) and
// "Auto-retarget" (rb.lockRetarget, default ON). The phone is unchanged.
import { leadPoint, LEAD_SPEED } from '../../mobile/js/touch.js';

export const LOCK = { padPx: 30, minPx: 34, acquire: 3, dwell: 10, rangeScreens: 1.5, sightTicks: 120, losEvery: 6, retargetPx: 320 };
const KEY = 'rb.hoverLock', RKEY = 'rb.lockRetarget';
const pref = (k) => ({
  get on() { try { return localStorage.getItem(k) !== '0'; } catch { return true; } },
  set(v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* storage off */ } },
});
export const lockPref = pref(KEY);
export const retargetPref = pref(RKEY);
const alive = (e) => e && !e.dead && e.hp > 0 && e.state !== 'fade';

/** The enemy under the cursor (world point `aim`), or null. The hit radius is the body + LOCK.padPx screen pixels. */
export function hoveredEnemy(enemies, aim, zoom = 1) {
  let best = null, bs = Infinity;
  for (const e of enemies) {
    if (!alive(e)) continue;
    const R = Math.max((e.r || 20) + LOCK.padPx / zoom, LOCK.minPx / zoom), d = Math.hypot(e.x - aim.x, e.y - aim.y);
    if (d <= R && d / R < bs) { bs = d / R; best = e; }
  }
  return best;
}

/**
 * Who to lock when the locked enemy dies: the nearest living enemy to the cursor (within LOCK.retargetPx screen px of
 * the cursor or of where the target fell). Same kind first: after a boss only another boss (never trash); after trash,
 * trash near the cursor, else the boss of the fight (prefer the boss). Null = nothing sensible: free aim.
 */
export function retargetPick(enemies, aim, wasBoss, at = null, zoom = 1, player = null, maxRange = Infinity) {
  const R = LOCK.retargetPx / zoom;
  let trash = null, ts = Infinity, boss = null, bs = Infinity;
  for (const e of enemies) {
    if (!alive(e)) continue;
    if (player && Math.hypot(e.x - player.x, e.y - player.y) > maxRange) continue;
    const d = Math.min(Math.hypot(e.x - aim.x, e.y - aim.y), at ? Math.hypot(e.x - at.x, e.y - at.y) : Infinity);
    if (e.boss) { if (d < bs) { bs = d; boss = e; } } // (bosses: any distance on screen - the fight's focus)
    else if (d <= R + (e.r || 20) && d < ts) { ts = d; trash = e; }
  }
  if (wasBoss) return boss;
  return trash || boss;
}

export class AimLock {
  constructor() { this.reset(); }
  reset() { this.id = 0; this.hover = false; this.since = 0; this.soft = null; this.dwell = 0; this.hoverId = 0; this.unseen = 0; this.suppress = 0; this.boss = false; this.last = null; this.retargeted = 0; this.why = ''; this.delib = false; }
  /**
   * Per input tick (60 Hz). Returns the locked enemy (or null).
   * `on` = the option. `o`: { player, viewW (screen width in world units), pick (the attack button went down this
   * tick), clear (the clear-lock key), retarget (option), blocked(x1,y1,x2,y2) (line-of-sight test) }.
   */
  update(enemies, aim, zoom = 1, on = true, o = {}) {
    if (!on) { this.reset(); return null; }
    if (o.clear) { const h0 = hoveredEnemy(enemies, aim, zoom); this.reset(); this.suppress = h0 ? h0.id : -1; this.why = 'cleared'; return null; }
    const h = hoveredEnemy(enemies, aim, zoom);
    // after a clear, the enemy that was under the cursor needs the cursor to leave it (or a click) before it locks again
    if (this.suppress && !(h && h.id === this.suppress)) this.suppress = 0;
    const held = h && h.id === this.suppress && !o.pick;
    // deliberate hover: the MOUSE moved onto the enemy (or moved while over it). An enemy that slides under a still cursor
    // because the hero dashed and the camera followed is not a deliberate pick, so it can't steal the lock.
    let moved = true;
    if (o.mouse) { moved = !!this.mouse && Math.hypot(o.mouse.x - this.mouse.x, o.mouse.y - this.mouse.y) > 0.5; this.mouse = { x: o.mouse.x, y: o.mouse.y }; }
    if (h && !held) {
      if (h.id !== this.hoverId) { this.hoverId = h.id; this.dwell = 0; this.delib = !o.mouse; }
      if (moved) this.delib = true;
      if (this.delib || !this.id) this.dwell++;
    } else { this.hoverId = 0; this.dwell = 0; this.delib = false; }
    let cur = this.id ? enemies.find((q) => q.id === this.id) : null;
    const p = o.player;
    if (this.id && !alive(cur)) { // died / despawned
      const wasBoss = this.boss, at = this.last;
      this.id = 0; cur = null; this.why = 'dead';
      const nx = o.retarget === false ? null : retargetPick(enemies, aim, wasBoss, at, zoom, p, o.viewW ? o.viewW * LOCK.rangeScreens : Infinity);
      if (nx) { this.take(nx); this.retargeted = 1; cur = nx; }
    }
    if (cur && p) { // too far / out of sight for a while
      const far = o.viewW && Math.hypot(cur.x - p.x, cur.y - p.y) > o.viewW * LOCK.rangeScreens;
      if (o.blocked && this.since % LOCK.losEvery === 0) this.unseen = o.blocked(p.x, p.y, cur.x, cur.y) ? this.unseen + LOCK.losEvery : 0;
      if (far || this.unseen >= LOCK.sightTicks) { this.id = 0; cur = null; this.why = far ? 'range' : 'sight'; }
    }
    if (h && !held && (!cur || h.id !== cur.id)) { // acquire (no lock) / switch (deliberate dwell or a click)
      if ((o.pick && (this.delib || !cur)) || this.dwell >= (cur ? LOCK.dwell : LOCK.acquire)) { this.take(h); cur = h; } // (a click on an enemy that merely slid under a still cursor doesn't switch either)
    }
    this.hover = !!(h && cur && h.id === cur.id);
    this.soft = h && !held && (!cur || h.id !== cur.id) ? h : null;
    if (cur) { this.since++; this.last = { x: cur.x, y: cur.y }; this.boss = !!cur.boss; }
    return cur;
  }
  take(e) { this.id = e.id; this.since = 0; this.unseen = 0; this.boss = !!e.boss; this.last = { x: e.x, y: e.y }; this.retargeted = 0; this.why = ''; this.dwell = 0; }
  /** Soft-hover progress 0..1 toward taking the lock (the small dwell ring). */
  softProgress() { return this.soft ? Math.min(1, this.dwell / (this.id ? LOCK.dwell : LOCK.acquire)) : 0; }
  /** The locked enemy in a (possibly different) enemy list, e.g. the rendered view. */
  find(enemies) { if (!this.id) return null; const e = enemies.find((q) => q.id === this.id); return alive(e) ? e : null; }
}

/** Everything the lock needs from a game for one tick (game.js and netgame.js share this). */
export function lockTick(lock, { enemies, aim, renderer, player, input, blocked, active }) {
  const zoom = (renderer.eff || renderer.cam).zoom || 1;
  const o = { player, viewW: (renderer.w || 1600) / zoom, mouse: input.mouse, pick: !!input.lockPick, clear: !!input.lockClear, retarget: retargetPref.on, blocked };
  input.lockPick = false; input.lockClear = false;
  return lock.update(active ? enemies : [], aim, zoom, lockPref.on, o);
}

/** Point the command's aim at the locked enemy (the phone's auto-target aim). */
export function applyLock(cmd, p, e) {
  if (!e || !p) return cmd;
  const lp = leadPoint(p, e, LEAD_SPEED[p.cls] || 0);
  cmd.ax = lp.x; cmd.ay = lp.y;
  return cmd;
}

/**
 * Screen-space lock marker on the locked enemy: rotating gold/red brackets + a LOCK tag (the clear key shown for the
 * first seconds). Always full strength while locked (it stays put through dashes). Off screen: an edge arrow.
 */
export function drawLockRing(ctx, renderer, e, lock, time, clearLabel = '', o = {}) { // (o: { tag, hint } - the Keyboard-only auto-target says TARGET · L next)
  if (!e) return;
  const s = renderer.worldToScreen(e.x, e.y), z = (renderer.eff || renderer.cam).zoom, R = ((e.r || 20) + 14) * z;
  const W = renderer.w, H = renderer.h, m = 26;
  if (W && H && (s.x < -R || s.y < -R || s.x > W + R || s.y > H + R)) { // off screen: an arrow at the edge pointing at it
    const cx = W / 2, cy = H / 2, a = Math.atan2(s.y - cy, s.x - cx), k = Math.min((W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - m) / Math.abs(Math.sin(a) || 1e-6));
    ctx.save(); ctx.translate(cx + Math.cos(a) * k, cy + Math.sin(a) * k); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath();
    ctx.lineWidth = 5; ctx.strokeStyle = '#140c1c'; ctx.stroke(); ctx.fillStyle = e.boss ? '#ff4a4a' : '#ffd23f'; ctx.fill();
    ctx.restore(); return;
  }
  const pop = Math.max(0, 1 - lock.since / 10) * 10;
  ctx.save(); ctx.translate(s.x, s.y); ctx.lineCap = 'round';
  ctx.rotate(time * 1.6);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    const r = R + pop;
    ctx.beginPath(); ctx.arc(0, 0, r, -0.42, 0.42);
    ctx.strokeStyle = '#140c1c'; ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = i % 2 ? '#ffd23f' : '#ff4a4a'; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r + 3, 0); ctx.lineTo(r + 11, 0); ctx.strokeStyle = '#140c1c'; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#fff4c2'; ctx.lineWidth = 2.5; ctx.stroke();
  }
  ctx.restore();
  ctx.save(); ctx.font = "bold 12px 'Lilita One', 'Trebuchet MS', sans-serif"; ctx.textAlign = 'center';
  const hint = o.hint !== undefined ? o.hint : clearLabel ? `${clearLabel} clears` : '';
  const tag = (o.tag || 'LOCK') + (hint && lock.since < 150 ? `  ·  ${hint}` : '');
  ctx.lineWidth = 4; ctx.strokeStyle = '#140c1c'; ctx.strokeText(tag, s.x, s.y - R - 16); ctx.fillStyle = '#ffd23f'; ctx.fillText(tag, s.x, s.y - R - 16);
  ctx.restore();
}

/** Soft hover (an enemy under the cursor that is not the lock yet): a thin white ring filling up over the dwell. */
export function drawSoftRing(ctx, renderer, e, prog) {
  if (!e) return;
  const s = renderer.worldToScreen(e.x, e.y), z = (renderer.eff || renderer.cam).zoom, R = ((e.r || 20) + 9) * z;
  ctx.save(); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(s.x, s.y, R, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(20,12,28,.8)'; ctx.lineWidth = 4; ctx.stroke();
  ctx.beginPath(); ctx.arc(s.x, s.y, R, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.6; ctx.setLineDash([5, 6]); ctx.stroke(); ctx.setLineDash([]);
  if (prog > 0) { ctx.beginPath(); ctx.arc(s.x, s.y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.stroke(); }
  ctx.restore();
}

/** High-contrast crosshair at the mouse: a dark outline + a bright core; red/gold over an enemy. Drawn last (above everything). */
export function drawCrosshair(ctx, x, y, over, time) {
  const R = 12, gap = 5, L = 9, core = over ? '#ffd23f' : '#ffffff', ring = over ? '#ff3b3b' : '#ffffff';
  ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round';
  const path = () => {
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(dx * (R - L + gap + 4), dy * (R - L + gap + 4)); ctx.lineTo(dx * (R + L), dy * (R + L)); }
  };
  path(); ctx.strokeStyle = 'rgba(14,8,20,.95)'; ctx.lineWidth = 6; ctx.stroke();
  path(); ctx.strokeStyle = ring; ctx.lineWidth = 2.6; ctx.stroke();
  if (over) { ctx.beginPath(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(dx * (R + 2), dy * (R + 2)); ctx.lineTo(dx * (R + L), dy * (R + L)); } ctx.strokeStyle = core; ctx.lineWidth = 2.6; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(14,8,20,.95)'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, Math.PI * 2); ctx.fillStyle = core; ctx.fill();
  ctx.restore();
}

/** Line-of-sight test against rocks / pillars / trees (sampled every 40 units), for the lock's out-of-sight release. */
export function makeBlocked(world, pointBlocked) {
  return (x1, y1, x2, y2) => {
    if (!world) return false;
    const d = Math.hypot(x2 - x1, y2 - y1), n = Math.floor(d / 40);
    for (let i = 1; i < n; i++) { const k = i / n; if (pointBlocked(world, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 2)) return true; }
    return false;
  };
}
