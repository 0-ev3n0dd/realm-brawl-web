// Loot showers + vacuum, client side (horde pass 1). Driven only by the owner's private sim events, so solo and co-op
// share one path: 'drops' bursts the pickups out of the kill (pop + arc + bounce), they sit on the ground with a bob /
// spin / rarity beam, and once the hero is inside the vacuum radius they home in (accelerating, with a short trail) and
// burst into a sparkle. 'pick' (the server's authoritative collection) feeds the pickup list on the left of the screen and
// plays the pickup sounds. Gear drops are real soulbound bags: the renderer skips the bags drawn here (owns()).
// Pooled objects, pre-rendered sprites (no per-frame gradients), one drawImage per pickup.
import { VACUUM } from '../sim/drops.js';
import { RARITIES } from '../sim/data/items.js';
import { CLASSES } from '../sim/data/classes.js';
import { MATERIALS, matGrade } from '../sim/meta.js';

const TAU = Math.PI * 2;
const hasDOM = typeof document !== 'undefined';
const mk = (w, h) => { if (!hasDOM) return null; const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export const RAR_COL = RARITIES.map((r) => r.color);
const LAND = VACUUM.land / 60;

// ---- sprites (2x, drawn at half size in world units)
const SPR = new Map();
function spr(key, w, h, fn) { let c = SPR.get(key); if (c !== undefined) return c; c = mk(w, h); if (c) fn(c.getContext('2d'), w, h); SPR.set(key, c); return c; }
function glowDisc(g, cx, cy, r, col, a = 1) { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); g.globalAlpha = 1; }
const coinSpr = (f) => spr('coin' + f, 40, 40, (g) => { // 6 spin frames
  const sx = Math.max(0.18, Math.abs(Math.cos((f / 6) * Math.PI)));
  glowDisc(g, 20, 20, 19, 'rgba(255,214,70,.55)');
  g.save(); g.translate(20, 20); g.scale(sx, 1);
  g.fillStyle = '#2a1a05'; g.beginPath(); g.arc(0, 0, 10.5, 0, TAU); g.fill();
  g.fillStyle = '#e8a514'; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill();
  g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(-0.8, -0.8, 7, 0, TAU); g.fill();
  g.fillStyle = '#fff6b8'; g.beginPath(); g.ellipse(-2.5, -3, 2.6, 1.6, -0.6, 0, TAU); g.fill();
  g.restore();
});
const orbSpr = (col) => spr('orb' + col, 56, 56, (g) => {
  glowDisc(g, 28, 28, 27, col, 0.75);
  g.fillStyle = '#1b1024'; g.beginPath(); g.arc(28, 28, 10.5, 0, TAU); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(28, 28, 9, 0, TAU); g.fill();
  const gr = g.createRadialGradient(25, 24, 1, 28, 28, 9); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(28, 28, 9, 0, TAU); g.fill();
});
const hpCross = () => spr('hpx', 20, 20, (g) => { g.fillStyle = '#fff'; g.fillRect(8, 3, 4, 14); g.fillRect(3, 8, 14, 4); });
const gemSpr = (r) => spr('gem' + r, 60, 60, (g) => { // a faceted loot gem in the rarity colour
  const col = RAR_COL[r] || '#fff';
  glowDisc(g, 30, 30, 29, col, 0.8);
  g.save(); g.translate(30, 30);
  g.fillStyle = '#140c1c'; g.beginPath(); g.moveTo(0, -15); g.lineTo(13, -3); g.lineTo(0, 16); g.lineTo(-13, -3); g.closePath(); g.fill();
  g.fillStyle = col; g.beginPath(); g.moveTo(0, -12); g.lineTo(10, -3); g.lineTo(0, 12); g.lineTo(-10, -3); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(0, -12); g.lineTo(10, -3); g.lineTo(0, -1); g.lineTo(-10, -3); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.moveTo(-3, -8); g.lineTo(0, -10); g.lineTo(2, -6); g.closePath(); g.fill();
  g.restore();
});
const beamSpr = (r) => spr('beam' + r, 48, 320, (g, w, h) => { // a tall rarity beam (soft edges, bright core)
  const col = RAR_COL[r] || '#fff';
  for (const [bw, a] of [[24, 0.28], [12, 0.55], [4, 0.95]]) {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, col); gr.addColorStop(1, col);
    g.globalAlpha = a; g.fillStyle = gr; g.fillRect(w / 2 - bw / 2, 0, bw, h);
  }
  g.globalAlpha = 1; glowDisc(g, w / 2, h - 8, 24, col, 0.9);
});
const matSpr = (col) => spr('mat' + col, 48, 48, (g) => { // a biome material: a little crystal cluster in its colour (classic outline)
  glowDisc(g, 24, 26, 23, col, 0.65);
  g.fillStyle = '#1b1024'; g.beginPath(); g.arc(24, 25, 17, 0, TAU); g.fill(); // (a dark badge with a bright rim: reads on any biome's ground)
  g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); g.arc(24, 25, 15.5, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.2; g.beginPath(); g.arc(24, 25, 17.6, 0, TAU); g.stroke();
  const shard = (cx, cy, w, h) => { g.fillStyle = '#1b1024'; g.beginPath(); g.moveTo(cx, cy - h - 3); g.lineTo(cx + w + 3, cy); g.lineTo(cx, cy + h * 0.45 + 3); g.lineTo(cx - w - 3, cy); g.closePath(); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(cx, cy - h); g.lineTo(cx + w, cy); g.lineTo(cx, cy + h * 0.45); g.lineTo(cx - w, cy); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(cx, cy - h); g.lineTo(cx + w, cy); g.lineTo(cx, cy - h * 0.15); g.closePath(); g.fill(); };
  shard(17, 30, 4, 8); shard(31, 30, 4, 7); shard(24, 28, 6, 13);
});
const MAT_SIZE = { Common: 28, Uncommon: 32, Boss: 38, Token: 38 };

const KIND_ORDER = { gear: 0, gold: 1, mat: 2, hp: 3, res: 4 };

export class LootFX {
  constructor(fx) {
    this.fx = fx; this.live = []; this.pool = []; this.byId = new Map(); this.bags = new Set();
    this.feed = []; this.me = null; this.audio = null; this.time = 0; this.snd = { gold: 0, orb: 0 };
    this.goldMul = () => 1; // (rewards.js: the account's gold multipliers, so the feed shows what was banked)
    this.stats = { spawned: 0, picked: 0 };
  }
  owns(bagId) { return this.bags.has(bagId); }
  handle(ev) {
    if (ev.pid !== undefined && this.fx.localPid && ev.pid !== this.fx.localPid) return;
    if (ev.type === 'drops') this.burst(ev);
    else if (ev.type === 'pick') this.picked(ev);
  }
  get(id) { return this.byId.get(id); }
  burst(ev) {
    const big = ev.big | 0;
    for (const a of ev.d) {
      const [id, k, v, lx, ly, ex] = a;
      const o = this.pool.pop() || {};
      o.id = id; o.k = k; o.v = v; o.ex = ex; o.x0 = ev.x; o.y0 = ev.y; o.tx = ev.x + lx; o.ty = ev.y + ly; o.x = ev.x; o.y = ev.y; o.z = 0;
      o.t = -Math.random() * 0.08 * (1 + big); o.st = 0; o.vel = 0; o.got = false; o.hop = 34 + Math.random() * 34 + big * 22; o.spin = Math.random() * 6; o.trail = 0; o.ms = 0;
      o.rar = k === 'gear' ? v : 0; o.col = k === 'hp' ? '#ff4d6d' : k === 'res' ? this.resCol() : k === 'mat' ? ((MATERIALS[ex] && MATERIALS[ex].color) || '#9fe') : '#ffd84a';
      this.live.push(o); this.byId.set(id, o); this.stats.spawned++;
      if (k === 'gear') this.bags.add(id);
    }
    if (big && this.fx.ring) this.fx.ring(ev.x, ev.y, big > 1 ? 150 : 90, '#ffd84a', 0.4, 6);
  }
  resCol() { const me = this.me, c = me && CLASSES[me.cls]; return (c && c.resColor) || '#5ab4ff'; }
  picked(ev) {
    let gold = 0, hp = 0, res = 0; const gear = [], mats = {};
    for (const [id, k, v, ex] of ev.d) {
      const o = this.byId.get(id);
      if (o) { o.got = true; if (o.st < 2) { o.st = 2; o.vel = Math.max(o.vel, 700); } }
      if (k === 'gold') gold += v; else if (k === 'hp') hp += v; else if (k === 'res') res += v; else if (k === 'gear') gear.push({ r: v, name: ex }); else if (k === 'mat') mats[ex] = (mats[ex] || 0) + v;
      if (k === 'gear') this.bags.delete(id);
    }
    if (gold) this.add('gold', 'Gold', Math.round(gold * this.goldMul()), '#ffd84a');
    if (hp) this.add('hp', 'Health Orb', hp, '#ff6b81');
    if (res) { const c = this.me && CLASSES[this.me.cls]; this.add('res', (c && c.resource) || 'Resource', res, this.resCol()); }
    for (const id in mats) this.add('mat:' + id, (MATERIALS[id] && MATERIALS[id].name) || id, mats[id], (MATERIALS[id] && MATERIALS[id].color) || '#9fe');
    for (const g of gear) this.add('gear:' + Math.random(), g.name || 'Gear', 1, RAR_COL[g.r] || '#fff', g.r);
    const A = this.audio;
    if (A && A.play) {
      const now = performance.now();
      if (gear.length) A.play(gear.some((g) => g.r >= 3) ? 'legendary' : 'gearpick');
      if (gold && now - this.snd.gold > 70) { this.snd.gold = now; A.play('coinpick'); }
      if (Object.keys(mats).length && now - (this.snd.mat || 0) > 80) { this.snd.mat = now; A.play('matpick'); }
      if ((hp || res) && now - this.snd.orb > 90) { this.snd.orb = now; A.play('orbpick'); }
    }
  }
  /** pickup feed line: same key within its life bumps the count */
  add(key, label, n, col, rar = -1) {
    let f = this.feed.find((q) => q.key === key && q.t < 2.6);
    if (f) { f.n += n; f.t = 0; f.bump = 1; return; }
    this.feed.unshift({ key, label, n, col, rar, t: 0, bump: 1, gear: rar >= 0 });
    if (this.feed.length > 7) this.feed.length = 7;
  }
  update(dt) {
    this.time += dt;
    const me = this.me, R2 = VACUUM.r * VACUUM.r, full = !!(me && me.inventory && me.inventory.indexOf(null) < 0);
    let dead = false;
    for (const o of this.live) {
      o.t += dt; o.spin += dt;
      if (o.st === 0) { // pop + arc out of the kill
        if (o.t < 0) continue;
        const k = Math.min(1, o.t / LAND), e = 1 - (1 - k) * (1 - k);
        o.x = o.x0 + (o.tx - o.x0) * e; o.y = o.y0 + (o.ty - o.y0) * e;
        o.z = Math.sin(Math.PI * k) * o.hop + (k > 0.8 ? Math.sin(Math.PI * (k - 0.8) / 0.2) * 6 : 0);
        if (k >= 1) { o.st = 1; o.z = 0; if (o.k === 'gear') this.landGear(o); }
      } else if (o.st === 1) { // on the ground
        if (me && !me.dead && (me.x - o.x) ** 2 + (me.y - o.y) ** 2 < R2 && !(o.k === 'gear' && full && !o.got)) { o.st = 2; o.vel = VACUUM.v0; }
        else if (o.t > VACUUM.life / 60 + 2 && !o.got) { o.st = 9; dead = true; }
      }
      if (o.st === 2) { // homing in
        if (!me) { o.st = 9; dead = true; continue; }
        if (o.k === 'gear' && full && !o.got) { o.st = 1; continue; }
        o.vel = Math.min(VACUUM.vmax * 1.1, o.vel + VACUUM.accel * dt * (o.got ? 1.6 : 1));
        o.z = Math.max(0, o.z * 0.9) + 0; o.trail = Math.min(1, o.trail + dt * 6);
        const dx = me.x - o.x, dy = (me.y - 10) - o.y, d = Math.hypot(dx, dy), s = o.vel * dt;
        if (d <= s + 14) { o.st = 3; o.t = 0; this.arrive(o); if (o.got) { o.st = 9; dead = true; } }
        else { o.x += (dx / d) * s; o.y += (dy / d) * s; }
      } else if (o.st === 3) { // arrived first (the server's pick is on its way): hidden, wait for it a little
        if (o.got || o.t > 1.5) { o.st = 9; dead = true; if (!o.got && o.k === 'gear') { o.st = 1; dead = false; o.x = me ? me.x + 30 : o.x; o.y = me ? me.y : o.y; } }
      }
    }
    if (dead) {
      const keep = [];
      for (const o of this.live) { if (o.st === 9) { this.byId.delete(o.id); if (o.k === 'gear') this.bags.delete(o.id); this.pool.push(o); } else keep.push(o); }
      this.live = keep;
    }
    for (const f of this.feed) { f.t += dt; f.bump = Math.max(0, f.bump - dt * 5); }
    this.feed = this.feed.filter((f) => f.t < 3.4);
  }
  landGear(o) {
    const fx = this.fx, col = RAR_COL[o.rar] || '#fff';
    if (!fx.sparks) return;
    fx.sparks(o.x, o.y, 0, 8 + o.rar * 4, col, 260, TAU);
    fx.ring(o.x, o.y, 40 + o.rar * 14, col, 0.45, 5);
    if (o.rar >= 2) fx.add({ type: 'glow', x: o.x, y: o.y, life: 0.5, color: col, size: 50 + o.rar * 12 });
  }
  arrive(o) {
    const fx = this.fx; if (!fx.add || !this.me) return;
    const col = o.k === 'gear' ? RAR_COL[o.rar] || '#fff' : o.col;
    fx.add({ type: 'spark', x: this.me.x + (Math.random() - 0.5) * 14, y: this.me.y - 12 + (Math.random() - 0.5) * 14, vx: (Math.random() - 0.5) * 160, vy: -60 - Math.random() * 120, life: 0.3, color: col, size: 3 });
    if (o.k === 'gear') { fx.ring(this.me.x, this.me.y - 6, 46, col, 0.35, 5); fx.sparks(this.me.x, this.me.y - 10, 0, 12, col, 240, TAU); }
  }
  /** a dropped bag still on the ground (inventory full): the renderer leaves it to us while we hold it */
  draw(ctx, view, time) {
    if (!this.live.length) return;
    const pad = 60, lite = !!this.fx.lite;
    for (const o of this.live) {
      if (o.st >= 3 || o.t < 0) continue;
      if (o.x < view.x0 - pad || o.x > view.x1 + pad || o.y < view.y0 - pad - 300 || o.y > view.y1 + pad) continue;
      const y = o.y - o.z - (o.st === 1 ? 3 + Math.sin(time * 4 + o.id) * 2.5 : 0);
      if (o.st === 2 && o.trail > 0 && !lite) { // a short streak back along the pull
        const me = this.me, dx = me.x - o.x, dy = me.y - o.y, d = Math.hypot(dx, dy) || 1, L = Math.min(34, o.vel * 0.03);
        ctx.globalAlpha = 0.55 * o.trail; ctx.strokeStyle = o.k === 'gear' ? RAR_COL[o.rar] : o.col; ctx.lineWidth = o.k === 'gold' ? 3 : 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(o.x, y); ctx.lineTo(o.x - (dx / d) * L, y - (dy / d) * L); ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (o.z > 2 || o.st === 1) { ctx.globalAlpha = 0.25; ctx.fillStyle = '#0d0820'; ctx.beginPath(); ctx.ellipse(o.x, o.y + 4, 7, 3, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      let c;
      if (o.k === 'gold') { c = coinSpr(Math.floor(o.spin * 12) % 6); if (c) ctx.drawImage(c, o.x - 10, y - 10, 20, 20); }
      else if (o.k === 'hp' || o.k === 'res') { c = orbSpr(o.col); const s = 1 + 0.08 * Math.sin(time * 7 + o.id); if (c) ctx.drawImage(c, o.x - 14 * s, y - 14 * s, 28 * s, 28 * s); if (o.k === 'hp') { const x2 = hpCross(); if (x2) ctx.drawImage(x2, o.x - 4, y - 4, 8, 8); } }
      else if (o.k === 'mat') {
        const S = o.ms || (o.ms = MAT_SIZE[matGrade(o.ex)] || 22);
        if (S >= 30 && o.st === 1) { const b = beamSpr(3); if (b) { ctx.globalAlpha = 0.55 + 0.2 * Math.sin(time * 3 + o.id); ctx.drawImage(b, o.x - 9, o.y + 4 - 120, 18, 120); ctx.globalAlpha = 1; } } // (boss materials: a short golden beam)
        c = matSpr(o.col); if (c) ctx.drawImage(c, o.x - S / 2, y - S / 2 - 2, S, S);
      }
      else if (o.k === 'gear') {
        if (o.st === 1) { const b = beamSpr(o.rar); if (b) { const h = 110 + o.rar * 40, a = 0.75 + 0.25 * Math.sin(time * 3 + o.id); ctx.globalAlpha = a; ctx.drawImage(b, o.x - 12, o.y + 6 - h, 24, h); ctx.globalAlpha = 1; } }
        c = gemSpr(o.rar); const s = 1 + 0.1 * Math.sin(time * 5 + o.id); if (c) ctx.drawImage(c, o.x - 15 * s, y - 18 * s, 30 * s, 30 * s);
      }
    }
  }
  /** horde pass 3: a top pass over the VFX layer (render.js, after fx.draw) so materials stay readable under chain
   *  effects: a bright pulsing double rim + a thin beam in the material's colour (taller for rare / boss grades) */
  drawTop(ctx, view, time) {
    if (!this.live.length) return;
    const lite = !!this.fx.lite; let n = 0;
    for (const o of this.live) {
      if (o.k !== 'mat' || o.st >= 2 || o.t < 0) continue;
      if (o.x < view.x0 - 40 || o.x > view.x1 + 40 || o.y < view.y0 - 40 || o.y > view.y1 + 160) continue;
      if (++n > 60) break; // (budget: a boss shower can hold ~40)
      const S = o.ms || (o.ms = MAT_SIZE[matGrade(o.ex)] || 22), y = o.y - o.z - (o.st === 1 ? 3 + Math.sin(time * 4 + o.id) * 2.5 : 0) - 2;
      const pul = 0.5 + 0.5 * Math.sin(time * 6 + o.id), R = S * 0.5 + 3 + pul * 2;
      if (o.st === 1 && !lite) { const h = S >= 32 ? 150 : S >= 30 ? 110 : 70; ctx.globalAlpha = 0.5 + 0.3 * pul; ctx.strokeStyle = o.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(o.x, o.y - 2); ctx.lineTo(o.x, o.y - h); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(o.x, o.y - 4); ctx.lineTo(o.x, o.y - h * 0.8); ctx.stroke(); }
      ctx.globalAlpha = 0.95; ctx.strokeStyle = '#120a1a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(o.x, y, R + 1, 0, TAU); ctx.stroke();
      ctx.strokeStyle = o.col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(o.x, y, R, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.6 + 0.4 * pul; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(o.x, y, R + 3.2, 0, TAU); ctx.stroke();
      const c = matSpr(o.col); if (c) { ctx.globalAlpha = 1; ctx.drawImage(c, o.x - S / 2, y - S / 2, S, S); }
    }
    ctx.globalAlpha = 1;
  }
  /** the pickup feed (screen space, right side under the hit counter, newest on top) */
  drawFeed(ctx, w, h) {
    if (!this.feed.length) return;
    const xr = w - 22; let y = Math.round(h * 0.57);
    ctx.save(); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const f of this.feed) {
      const a = Math.min(1, (3.4 - f.t) / 0.6), s = 1 + f.bump * 0.25;
      const label = f.gear ? f.label : f.key === 'gold' ? `+${f.n} Gold` : `${f.label} ×${f.n}`;
      ctx.font = `${Math.round((f.gear ? 17 : 16) * s)}px 'Lilita One', sans-serif`;
      const tw = ctx.measureText(label).width, x0 = xr - tw - 34;
      ctx.globalAlpha = a * 0.78; ctx.fillStyle = '#140d1e'; ctx.fillRect(x0 - 6, y - 13, tw + 46, 26);
      ctx.globalAlpha = a; ctx.fillStyle = f.col; ctx.fillRect(xr + 37 - 3 - 34 + 3, y - 13, 3, 26);
      const ic = f.key === 'gold' ? coinSpr(Math.floor(this.time * 10) % 6) : f.gear ? gemSpr(f.rar) : f.key.startsWith('mat:') ? matSpr(f.col) : orbSpr(f.col);
      if (ic) ctx.drawImage(ic, x0, y - 10, 20, 20);
      ctx.lineWidth = 4; ctx.strokeStyle = '#140d1e'; ctx.strokeText(label, xr, y + 1); ctx.fillStyle = f.col; ctx.fillText(label, xr, y + 1);
      y += 30;
    }
    ctx.restore();
  }
}
