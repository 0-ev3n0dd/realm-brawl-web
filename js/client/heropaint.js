// Painted hero renderer (gacha dark-fantasy art pass): the 10 classes are hand-painted turnaround sprites
// (front / right / back views + a painted weapon) packed into one small WebP atlas per class
// (public/assets/heroes/, built by tools/hero-split.py + tools/hero-atlas.py). Everything here is a blit of a pre-scaled,
// pre-cut canvas: no per-frame filters; the hit-flash white silhouettes are rendered once when an atlas loads.
//  - view: chosen from the smoothed facing (down / right / up / left = mirrored right), with a ~20 deg crossfade between
//    neighbouring views so turning is smooth
//  - body animation drivers: walk bob + slight squash-and-stretch + lean, attack lunge, dodge tilt, leaps, hit flash, i-frame blink
//  - weapons: the procedural rig (art.js heroGear) runs against a recording context (REC below), so the painted weapon
//    follows exactly the same swing angles / easing / afterimages; each transform is projected from the top-down
//    hero frame onto the upright sprite (3/4 view: y squashed) and the weapon is drawn behind the body when its hand is on
//    the far side (facing up), in front otherwise
//  - atlases are lazy-loaded per class the first time a hero of that class is drawn; until then art.js draws the
//    procedural hero (client/herobody.js), which also stays available as Options > Art style: Classic
import { glowSprite } from './sprite.js';
import { smoothstep, easeOutCubic } from './smooth.js';

const TAU = Math.PI * 2;
const PREF_KEY = 'rb.heroArt';
const hasDOM = typeof document !== 'undefined' && typeof Image !== 'undefined';
const lsGet = (k) => { try { return globalThis.localStorage ? localStorage.getItem(k) : null; } catch { return null; } };
const lsSet = (k, v) => { try { if (globalThis.localStorage) localStorage.setItem(k, v); } catch {} };

/** Art style: the painted art was rolled back (2026-10-04): Classic is the only style. The painted assets are gone from
 *  public/assets; `painted` is hard-wired off so every painted code path (heroes, enemies, world, tavern hub, UI, icons)
 *  stays dormant and never fetches anything, and set() is a no-op kept for old callers / saved prefs. */
export const heroArt = {
  mode: 'classic',
  get painted() { return false; },
  set() { this.mode = 'classic'; lsSet(PREF_KEY, 'classic'); },
  listeners: new Set(),
};
void lsGet; void hasDOM;
globalThis.__rbHeroArt = heroArt;

// ------------------------------------------------------------------ loading
const BASE = new URL('../../assets/heroes/', import.meta.url).href;
let manifestP = null, manifest = null;
const ART = new Map(); // cls -> { st: 'loading' | 'ready' | 'failed', v: {front, side, back, weapon}, p: Promise }
function loadManifest() {
  if (!manifestP) manifestP = fetch(BASE + 'heroes.json').then((r) => { if (!r.ok) throw new Error('heroes.json ' + r.status); return r.json(); }).then((m) => (manifest = m)).catch((e) => { console.warn('[heropaint] manifest', e); manifestP = null; throw e; });
  return manifestP;
}
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function cut(img, f, PX) {
  const c = mkCanvas(f.w, f.h), g = c.getContext('2d'); g.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  const fl = mkCanvas(f.w, f.h), q = fl.getContext('2d'); q.drawImage(c, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = '#fff'; q.fillRect(0, 0, f.w, f.h);
  // world-unit size / anchor (the atlas is stored at PX px per world unit)
  return { c, fl, w: f.w / PX, h: f.h / PX, ax: f.ax / PX, ay: f.ay / PX, f };
}
/** Start loading a class's atlas (idempotent). Resolves true when ready. */
export function requestHeroArt(cls) {
  if (!hasDOM || !cls) return Promise.resolve(false);
  let s = ART.get(cls);
  if (s) return s.p;
  s = { st: 'loading', v: null }; ART.set(cls, s);
  s.p = loadManifest().then((m) => {
    const e = m.classes[cls]; if (!e) throw new Error('no painted art for ' + cls);
    return new Promise((res, rej) => { const img = new Image(); img.decoding = 'async'; img.onload = () => res({ img, e, PX: m.px }); img.onerror = () => rej(new Error('atlas ' + e.src)); img.src = BASE + e.src; });
  }).then(({ img, e, PX }) => {
    const v = {}; for (const k of Object.keys(e.f)) { v[k] = cut(img, e.f[k], PX); v[k].kind = e.f[k].kind; v[k].upright = e.f[k].upright; }
    v.weapon.str = e.f.weapon.str ? e.f.weapon.str.map((n) => n / PX) : null;
    s.v = v; s.st = 'ready'; return true;
  }).catch((err) => { console.warn('[heropaint]', err.message); s.st = 'failed'; return false; }); // (a failed class stays on the procedural rig; no retry storm)
  return s.p;
}
export const paintedReady = (cls) => { const s = ART.get(cls); return !!(s && s.st === 'ready'); };
export function preloadHeroArt(list) { return Promise.all(list.map((c) => requestHeroArt(c))); }
/** true when a hero of `cls` is currently drawn painted (name tags / UI use the taller sprite) */
export const paintedActive = (cls) => heroArt.painted && paintedReady(cls);
export const PAINTED_TOP = 104; // world units from the hero's position to the top of the head (x the render scale)
/** hero-anchored effects in Painted mode (render.js heroFx): body effects x2 re-centred on the chest, ground rings x1.6; texts lift */
export const PAINT_FX = { body: 2, ground: 1.6, lift: 43, text: 62 };
/** extra height for numbers / texts anchored on a hero (fx.js): chest height when the painted art is on */
export const heroTextLift = () => (heroArt.painted ? PAINT_FX.text : 0);

// ------------------------------------------------------------------ recording context (weapon transforms from art.js heroGear)
const NOOP = () => {};
const GRAD = { addColorStop: NOOP };
class RecCtx {
  constructor() { this.m = [1, 0, 0, 1, 0, 0]; this.st = []; this.globalAlpha = 1; }
  reset(ang) { const c = Math.cos(ang), s = Math.sin(ang); this.m = [c, s, -s, c, 0, 0]; this.st.length = 0; this.globalAlpha = 1; }
  save() { this.st.push([...this.m, this.globalAlpha]); }
  restore() { const s = this.st.pop(); if (s) { this.m = s.slice(0, 6); this.globalAlpha = s[6]; } }
  translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  rotate(r) { const m = this.m, c = Math.cos(r), s = Math.sin(r), a = m[0], b = m[1], cc = m[2], d = m[3]; m[0] = a * c + cc * s; m[1] = b * c + d * s; m[2] = -a * s + cc * c; m[3] = -b * s + d * c; }
  scale(x, y) { const m = this.m; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; }
  getTransform() { const [a, b, c, d, e, f] = this.m; return { a, b, c, d, e, f }; }
  setTransform() {} createLinearGradient() { return GRAD; } createRadialGradient() { return GRAD; } measureText() { return { width: 0 }; }
}
for (const k of ['beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'closePath', 'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'drawImage', 'fillText', 'strokeText', 'setLineDash']) RecCtx.prototype[k] = NOOP;
const RC = new RecCtx();
const LIST = [];
/** art.js weapon functions call REC.w(...) instead of drawing while REC.on; the monk's fists call REC.fist */
export const REC = {
  on: false, proc: null,
  w(ctx, kind, len, glow, x) { LIST.push({ kind, m: ctx.m.slice(), alpha: ctx.globalAlpha, len, glow, x }); },
  fist(ctx, x, y, big, glow) { const m = ctx.m; LIST.push({ kind: 'fist', m: [m[0], m[1], m[2], m[3], m[4] + m[0] * x + m[2] * y, m[5] + m[1] * x + m[3] * y], alpha: ctx.globalAlpha, len: 0, glow, x: big, hx: x }); },
};

/** run `gear(rec)` against the recording context (hero frame rotated by ang) and return the recorded weapon draws */
export function recordGear(ang, gear) { LIST.length = 0; RC.reset(ang); REC.on = true; try { gear(RC); } finally { REC.on = false; } return LIST.map((r) => ({ ...r, m: r.m.slice() })); }

// ------------------------------------------------------------------ drawing
const KX = 1.55, KY = 0.78, HAND_H = 44; // top-down hero frame -> upright sprite: horizontal spread, 3/4 squash, hand height above the feet
const LEN0 = { sword: 50, katana: 48, dagger: 21, mace: 32, spear: 52 };
const OWN = { warrior: 'sword', samurai: 'katana', bladedancer: 'dagger', cleric: 'mace', dragoon: 'spear', mage: 'staff', ranger: 'bow', bard: 'lute', summoner: 'book', monk: 'fist' };
// painted frame for a recorded weapon kind (class weapon = 'weapon'; extra sheets: Warrior axes / hammer, Paladin shield)
function frameFor(V, cls, r) {
  if (r.kind === OWN[cls]) return V.weapon;
  if (r.kind === 'hatchet') return (r.x < 0 ? V.axe2 : V.axe) || null;
  if (r.kind === 'hammer') return V.hammer || null;
  return null;
}
const LOCAL = { bow: [9, 0], book: [8, 0], lute: [-2, 0] }; // where the painted pivot sits in the procedural weapon's own frame
const VIEWS = ['side', 'front', 'side', 'back']; // 0 right, 1 down, 2 left (mirrored), 3 up
const BAND = 5 * Math.PI / 180, HYST = 4 * Math.PI / 180, FADE_MS = 80; // (polish pass: was a 20 deg crossfade band)
const VSTATE = new Map(); // per-hero shown view (h.key) // half-width of the crossfade band around each 45 deg view boundary

function drawView(ctx, v, mirror, alpha, flashA) {
  if (alpha <= 0.003) return;
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * alpha;
  if (mirror) { ctx.save(); ctx.scale(-1, 1); }
  ctx.drawImage(v.c, -v.ax, -v.ay, v.w, v.h);
  if (flashA > 0.01) { // hit flash: the sprite added onto itself (highlights blow out to white, the painted detail stays) + a thin white lift; no milky alpha veil
    const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a0 * alpha * flashA; ctx.drawImage(v.c, -v.ax, -v.ay, v.w, v.h); ctx.drawImage(v.c, -v.ax, -v.ay, v.w, v.h);
    ctx.globalAlpha = a0 * alpha * flashA * 0.5; ctx.drawImage(v.fl, -v.ax, -v.ay, v.w, v.h);
    ctx.globalCompositeOperation = op;
  }
  if (mirror) ctx.restore();
  ctx.globalAlpha = a0;
}
function glowAlong(ctx, col, x0, x1, w) {
  if (typeof col !== 'string' || !/^#[0-9a-f]{6}$/i.test(col)) return;
  const c = glowSprite(col, 32), a = ctx.globalAlpha; ctx.globalAlpha = a * 0.55; ctx.drawImage(c, x0 - 10, -w, x1 - x0 + 20, w * 2); ctx.globalAlpha = a;
}
/** project a recorded hero-frame transform onto the sprite: returns [x, y, angle, foreshortening, mirrored] */
function project(m, lx = 0, ly = 0) {
  const ox = m[4] + m[0] * lx + m[2] * ly, oy = m[5] + m[1] * lx + m[3] * ly;
  const dx = m[0] * KX, dy = m[1] * KY, n = Math.hypot(dx, dy) || 1;
  return [ox * KX, -HAND_H + oy * KY, Math.atan2(dy, dx), Math.max(0.5, n / (KX * Math.hypot(m[0], m[1]) || 1)), m[0] * m[3] - m[1] * m[2] < 0, oy];
}
const fore = (fs) => 0.72 + 0.28 * fs; // softened foreshortening: a weapon pointing straight down / up keeps ~85% of its length
let CUR_ANG = 0;
function drawShield(ctx, r, V, view, a0) {
  if (view === 3 || !V.shield) return; // facing up: the shield is on the far arm, hidden by the body / cape
  const [x, y] = project(r.m); const edge = view !== 1, S = edge ? V.shieldEdge || V.shield : V.shield;
  const fwd = Math.cos(CUR_ANG) * r.m[4] + Math.sin(CUR_ANG) * r.m[5]; // the recorded shield position along the facing (7 at rest, 22 in Shield Rush)
  const push = Math.max(0, Math.min(1, (fwd - 7) / 15)); // Shield Rush / shield bash: pushed forward, a touch bigger
  // side views: the edge-on shield is held just in front of the chest (the recorded far-arm spot hides it behind the body), further out when pushed
  const sx = edge ? (view === 2 ? -1 : 1) * (15 + push * 12) : x, sy = edge ? -HAND_H - 4 + push * 6 : y + 6;
  ctx.save(); ctx.translate(sx, sy); if (view === 2) ctx.scale(-1, 1);
  const k = 1 + push * 0.12; ctx.scale(k, k);
  if (r.glow) { const g = glowSprite(r.glow, 30); ctx.globalAlpha = a0 * 0.7; ctx.drawImage(g, -S.w, -S.h * 0.8, S.w * 2, S.h * 1.6); ctx.globalAlpha = a0 * (r.alpha < 1 ? r.alpha : 1); }
  ctx.drawImage(S.c, -S.ax, -S.ay, S.w, S.h);
  ctx.restore();
}
function drawWeapon(ctx, r, V, cls, idx, t, view) {
  const W = V.weapon;
  if (r.kind === 'saya') return; // the painted body already wears it
  if (r.kind === 'shield') { const a0 = ctx.globalAlpha; if (r.alpha < 1) ctx.globalAlpha = a0 * r.alpha; drawShield(ctx, r, V, view, a0); ctx.globalAlpha = a0; return; }
  const a0 = ctx.globalAlpha; if (r.alpha < 1) ctx.globalAlpha = a0 * r.alpha;
  if (r.kind === 'fist') { // monk: the painted body already shows the fists; a punch shoots the painted gauntlet out along it with a chi flash
    const ext = Math.max(0, Math.min(1, (r.hx - 16) / 14));
    if (ext < 0.15 && !r.glow) { ctx.globalAlpha = a0; return; }
    const [x, y, ang] = project(r.m);
    if (ext > 0.45 || r.glow) { const g = glowSprite(r.glow || '#ffd76a', 20), k = 0.45 + ext * 0.55; ctx.globalAlpha = a0 * (r.alpha < 1 ? r.alpha : 1) * Math.min(0.9, 0.25 + ext * 0.6); ctx.drawImage(g, x - 20 * k, y - 20 * k, 40 * k, 40 * k); }
    if (ext >= 0.15) { ctx.globalAlpha = a0 * (r.alpha < 1 ? r.alpha : 1) * Math.min(1, (ext - 0.15) * 4); ctx.save(); ctx.translate(x, y); ctx.rotate(ang); if (Math.cos(ang) < 0) ctx.scale(1, -1); const s = r.x || 1; ctx.scale(s, s); ctx.drawImage(W.c, -W.ax, -W.ay, W.w, W.h); ctx.restore(); }
    ctx.globalAlpha = a0; return;
  }
  const F = frameFor(V, cls, r);
  if (F && F !== W) { // extra painted weapons (Warrior twin axes: blade toward the body's centre line like the procedural ones; warhammer)
    const [x, y, ang, fs] = project(r.m);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const sy = r.kind === 'hatchet' ? (r.x < 0 ? -1 : 1) : Math.cos(ang) < 0 ? -1 : 1, L0 = r.kind === 'hatchet' ? 22 : 40;
    const k = r.len ? Math.max(0.9, Math.min(1.2, r.len / L0)) : 1;
    ctx.scale(k * fore(fs), sy);
    if (r.glow) glowAlong(ctx, r.glow, F.w * 0.35 - F.ax, F.w - F.ax, Math.max(8, F.h * 0.5));
    ctx.drawImage(F.c, -F.ax, -F.ay, F.w, F.h);
    ctx.restore(); ctx.globalAlpha = a0; return;
  }
  if (!F) { // no painted twin (warrior twin axes / warhammer): the procedural one, projected and scaled up to the painted size
    const P = REC.proc && REC.proc[r.kind];
    if (P) { const [x, y, ang, fs, mir] = project(r.m); ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(1.45 * fs, 1.45 * (mir ? -1 : 1)); if (r.kind === 'hatchet') P(ctx, r.len, r.glow, r.x); else P(ctx, r.len, r.glow); ctx.restore(); }
    ctx.globalAlpha = a0; return;
  }
  const L = LOCAL[r.kind] || [0, 0];
  const [x, y, ang, fs] = project(r.m, L[0], L[1]);
  ctx.save(); ctx.translate(x, y);
  if (W.upright && r.kind === 'book') { // the grimoire floats beside the hand, upright, with its own bob
    const bob = Math.sin(t * 2.6 + 0.6) * 2.2; ctx.translate(6, -8 + bob); ctx.rotate(Math.sin(t * 1.7) * 0.06);
    const open = r.x || 0; const k = 1 + open * 0.12;
    if (r.glow) { const g = glowSprite(r.glow, 30); ctx.globalAlpha *= 0.6; ctx.drawImage(g, -W.w * 0.9, -W.h * 0.9, W.w * 1.8, W.h * 1.8); ctx.globalAlpha = a0 * (r.alpha < 1 ? r.alpha : 1); }
    ctx.scale(k, k); ctx.drawImage(W.c, -W.ax, -W.ay, W.w, W.h);
  } else if (r.kind === 'bow') { // the bow turns with the aim (its belly faces +x); the cleaned-up string is redrawn with the pull
    ctx.rotate(ang);
    const pull = r.x || 0; ctx.drawImage(W.c, -W.ax, -W.ay, W.w, W.h);
    if (W.str) {
      const [x0, y0, x1, y1] = W.str, sx0 = x0 - W.ax + 1, sy0 = y0 - W.ay, sx1 = x1 - W.ax + 1, sy1 = y1 - W.ay;
      ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(Math.min(sx0, sx1) - pull * 1.3, (sy0 + sy1) / 2); ctx.lineTo(sx1, sy1);
      ctx.strokeStyle = 'rgba(240,232,214,.85)'; ctx.lineWidth = 0.8; ctx.stroke();
      if (pull > 1) { ctx.beginPath(); ctx.moveTo(Math.min(sx0, sx1) - pull * 1.3, 0); ctx.lineTo(W.w * 0.75, 0); ctx.strokeStyle = '#2b1d14'; ctx.lineWidth = 2.2; ctx.stroke(); ctx.strokeStyle = '#e6d3a3'; ctx.lineWidth = 1.1; ctx.stroke(); }
    }
  } else {
    ctx.rotate(ang);
    const k = LEN0[r.kind] && r.len ? Math.max(0.85, Math.min(1.25, r.len / LEN0[r.kind])) : 1;
    let sy = Math.cos(ang) < 0 && r.kind !== 'lute' ? -1 : 1; // keep the blade's edge / curve upright when it swings past vertical
    if (cls === 'bladedancer' && idx % 2 === 1) sy = -sy; // the off-hand dagger is mirrored
    ctx.scale(k * fore(fs), sy);
    if (r.glow && r.kind !== 'staff') glowAlong(ctx, r.glow, -W.ax * 0.3, W.w - W.ax, Math.max(8, W.h * 0.55));
    ctx.drawImage(W.c, -W.ax, -W.ay, W.w, W.h);
    if (r.kind === 'staff' && r.glow) { const g = glowSprite(r.glow, 20); ctx.globalAlpha *= 0.75; const tx = W.w - W.ax - 5; ctx.drawImage(g, tx - 14, -14, 28, 28); }
  }
  ctx.restore();
  ctx.globalAlpha = a0;
}

/**
 * Draw a painted hero. h: the same object art.js drawHero gets; ang: the drawn facing (art.js heroAngle);
 * gear(rec, ang, mk, bob, jump): runs the procedural weapon rig against the recording context.
 */
export function drawPaintedHero(ctx, h, ang, gear) {
  CUR_ANG = ang;
  const V = ART.get(h.cls).v, t = h.time || 0, s = h.scale || 1, a = h.anim;
  const mk = h.moveK != null ? h.moveK : h.moving ? 1 : 0;
  const jump = h.jumpH || 0;
  // ---- weapon transforms (exact swing angles / easing from the procedural rig)
  LIST.length = 0;
  RC.reset(ang); REC.on = true;
  try { gear(RC, ang, mk, Math.sin(t * 14) * 1.6 * mk, jump); } finally { REC.on = false; }
  // ---- body motion
  const ca = Math.cos(ang), sa = Math.sin(ang);
  let lunge = 0, lean = 0.045 * mk * ca, sqx = 1, sqy = 1;
  const step = Math.cos(t * 28) * mk; sqy += 0.022 * step; sqx -= 0.016 * step; // stride squash-and-stretch
  if (a && a.kind !== 'dodge' && (a.kind === 'basic' || a.kind === 'skill' || a.kind === 'ult' || a.kind === 'special' || a.chain)) {
    const hit = Math.max(2, a.hit || 6), k = a.t < hit ? easeOutCubic(a.t / hit) : Math.max(0, 1 - (a.t - hit) / 9);
    const wind = a.t < hit ? Math.sin((a.t / hit) * Math.PI) : 0;
    lunge = k * (a.kind === 'basic' ? 5 : 7); lean += 0.07 * k * ca; sqy *= 1 - 0.035 * wind + 0.03 * k; sqx *= 1 + 0.03 * wind;
  } else if (a && a.kind === 'dodge') {
    const p = Math.min(1, a.t / Math.max(1, a.dur || 14)), w = Math.sin(p * Math.PI);
    lean += 0.32 * w * (ca >= 0 ? 1 : -1); sqy *= 1 - 0.12 * w; sqx *= 1 + 0.08 * w;
  }
  ctx.save();
  ctx.translate(h.x, h.y);
  if (!h.noShadow && REC.proc) REC.proc.shadow(ctx, 0, 10, 22 * s * (1 - jump * 0.3), 10 * s * (1 - jump * 0.3));
  ctx.translate(ca * lunge, sa * lunge * 0.6 + 10);                     // feet frame (the shadow centre)
  ctx.translate(0, -jump * 22 - (1 - Math.cos(t * 28)) * 0.9 * mk);    // leap + walk bob
  ctx.scale(s * (1 + jump * 0.18), s * (1 + jump * 0.18));
  if (h.iframes) ctx.globalAlpha *= 0.55 + 0.25 * Math.sin(t * 40);
  ctx.rotate(lean);
  // ---- view + crossfade
  //  in-game heroes (h.key = entity id): snap to the nearest view with a little hysteresis and a quick 80 ms fade-out of
  //  the previous view, so a hero standing / walking at 45 deg shows one clean view instead of a half-and-half double image;
  //  keyless draws (menus, sheets): a narrow 10 deg angular crossfade
  let q = ((ang % TAU) + TAU) % TAU; let k0 = Math.round(q / (Math.PI / 2)) % 4;
  let k1 = k0, w1 = 0;
  if (h.key != null) {
    let st = VSTATE.get(h.key); const now = performance.now();
    if (!st) { if (VSTATE.size > 256) VSTATE.clear(); st = { k: k0, prev: k0, t0: -1e9 }; VSTATE.set(h.key, st); }
    if (k0 !== st.k) {
      let d = Math.abs(q - st.k * (Math.PI / 2)) % TAU; if (d > Math.PI) d = TAU - d;
      if (d > Math.PI / 4 + HYST) { st.prev = st.k; st.k = k0; st.t0 = now; }
    }
    k0 = st.k; const p = (now - st.t0) / FADE_MS;
    if (p < 1 && st.prev !== k0) { k1 = st.prev; w1 = 1 - smoothstep(p); }
  } else {
    const off = q - k0 * (Math.PI / 2), o = off > Math.PI ? off - TAU : off, edge = Math.PI / 4 - Math.abs(o);
    k1 = (k0 + (o >= 0 ? 1 : 3)) % 4; w1 = edge < BAND ? 0.5 * smoothstep((BAND - edge) / BAND) : 0;
  }
  const fk = h.flash ? Math.min(1, h.flash / 6) : 0, flashA = fk * fk; // (short, punchy decay; drawn additively in drawView)
  // ---- layering: weapons whose hand is on the far side go behind the body
  const back = [], front = [];
  for (let i = 0; i < LIST.length; i++) { const r = LIST[i]; ((r.kind === 'shield' ? k0 === 3 : r.m[5] < -2) ? back : front).push(i); }
  const drawW = (ids) => { ctx.save(); ctx.scale(1 / sqx, 1 / sqy); for (const i of ids) drawWeapon(ctx, LIST[i], V, h.cls, i, t, k0); ctx.restore(); };
  ctx.scale(sqx, sqy);
  drawW(back);
  drawView(ctx, V[VIEWS[k0]], k0 === 2, 1, flashA);
  if (w1 > 0) drawView(ctx, V[VIEWS[k1]], k1 === 2, w1, flashA);
  drawW(front);
  ctx.restore();
}

/** HUD / lobby portrait: the painted front view's head + shoulders in a circle of radius r (returns false if not loaded) */
export function drawHeroPortrait(ctx, cls, x, y, r) {
  if (!heroArt.painted) return false;
  if (!paintedReady(cls)) { requestHeroArt(cls); return false; }
  const v = ART.get(cls).v.front, f = v.f, top = f.h * 0.03, side = f.h * 0.36, cx = f.ax;
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.drawImage(v.c, cx - side / 2, top, side, side, x - r, y - r * 0.92, r * 2, r * 2);
  ctx.restore(); return true;
}
