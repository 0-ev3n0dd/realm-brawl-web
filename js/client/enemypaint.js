// Painted enemy renderer (gacha dark-fantasy art pass, part 2): every enemy and boss is a hand-painted turnaround
// (front / right / back views + phase / state forms + the Dread Knight's sword and Grimtusk's club) packed into one
// WebP atlas per biome group (public/assets/enemies/, built by tools/enemy-split.py + tools/enemy-atlas.py).
//  - lazy: an atlas is fetched the first time one of its enemies is drawn; until then (and in Options > Art style:
//    Classic) art.js draws the procedural top-down enemy
//  - perf: every frame is cut once into a canvas PRE-SCALED to the current sprite pixel scale (x the elite 1.25), so a
//    draw is one axis-aligned drawImage at ~1:1; the white hit-flash silhouette is made lazily, once; no per-frame filters
//  - view: the facing picks front / side / back (left = the side view mirrored), snapped with hysteresis and an 80 ms
//    fade of the previous view (per enemy id), like the painted heroes
//  - procedural life: walk bob + stride squash from the measured ground speed, idle breathing, hover bob for floaters,
//    a wind-up lean + scale pulse from the existing state timers (the same states that light the red telegraph glow),
//    a stretch for charges / dashes / pounces, knock-down tilt, sinking / emerging for burrowers
//  - forms: Grimtusk enraged (phase 3), world bosses phase 2 (Khepra 3), Vorthax's lance pose during the Rift Lance,
//    Neferakh's Dark form, the mummy unravelled (< 50% HP), the scarab's rolled ball, sprout / shroom wind-up poses,
//    Astrael's cast pose, her Reflection and the Extreme art
import { heroArt } from './heropaint.js';
import { spriteScale, glowSprite } from './sprite.js';
import { smoothstep } from './smooth.js';

const TAU = Math.PI * 2;
const hasDOM = typeof document !== 'undefined' && typeof Image !== 'undefined';
const BASE = new URL('../../assets/enemies/', import.meta.url).href;
// per type: floating (hover instead of walking), hover height (fraction of H), alternate forms
const FLOAT = { wisp: 0.16, imp: 0.2, mirage: 0.07, raidboss: 0.1, astrael: 0.08, astraelx: 0.08, astralstar: 0.18, neferakh: 0.05 };
const QUAD = new Set(['boar', 'wolf', 'jackal', 'scarab', 'scarabling', 'ashfang', 'ankhara']); // long bodies: a stronger stride stretch
const WIND = new Set(['wind', 'slamwind', 'swing', 'shock', 'cast', 'mirror', 'mirrorWind', 'lines', 'fan', 'roar', 'howl', 'summon', 'throw', 'beams', 'quake', 'sandstorm', 'snare', 'glass', 'ray', 'lash']);
const CHARGE = new Set(['charge', 'dash', 'lunge', 'pounce', 'roll']);
const PHASE_COL = { boss: '#ff3b1f', thornmaw: '#9cff3a', ashfang: '#ff7a1f', ankhara: '#ff4fd8', sekhem: '#ff9a2a', khepra: '#ff5a1f', neferakh: '#9a5cff', mummy: '#ff8a3a' };

let manifestP = null, manifest = null;
const ATL = new Map(); // atlas -> { st, img, p }
function loadManifest() {
  if (!manifestP) manifestP = fetch(BASE + 'enemies.json').then((r) => { if (!r.ok) throw new Error('enemies.json ' + r.status); return r.json(); }).then((m) => (manifest = m)).catch((e) => { console.warn('[enemypaint] manifest', e); manifestP = null; throw e; });
  return manifestP;
}
function requestAtlas(an) {
  let s = ATL.get(an); if (s) return s.p;
  s = { st: 'loading', img: null }; ATL.set(an, s);
  s.p = new Promise((res, rej) => { const img = new Image(); img.decoding = 'async'; img.onload = () => res(img); img.onerror = () => rej(new Error('atlas ' + an)); img.src = BASE + manifest.atlases[an].src; })
    .then((img) => { s.img = img; s.st = 'ready'; return true; })
    .catch((e) => { console.warn('[enemypaint]', e.message); s.st = 'failed'; return false; });
  return s.p;
}
let MF_REQ = false;
/** true when `type` can be drawn painted right now (starts the lazy load of its biome atlas otherwise) */
export function paintedEnemyReady(type) {
  if (!heroArt.painted) return false;
  if (!manifest) { if (!MF_REQ) { MF_REQ = true; loadManifest().catch(() => { MF_REQ = false; }); } return false; }
  const T = manifest.types[type]; if (!T) return false;
  const s = ATL.get(T.atlas);
  if (!s) { requestAtlas(T.atlas); return false; }
  return s.st === 'ready';
}
/** preload the atlases for a list of enemy types (biome entry, previews) */
export async function preloadEnemyArt(types) {
  if (!hasDOM) return false;
  await loadManifest();
  const ans = new Set(types.map((t) => manifest.types[t] && manifest.types[t].atlas).filter(Boolean));
  return Promise.all([...ans].map(requestAtlas));
}
export const enemyArtManifest = () => manifest;

// ------------------------------------------------------------------ pre-scaled frame cache
const FR = new Map(); let FR_S = 0;
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
/** a frame of `type` at display multiplier k: { c, w, h, ax, ay } in world units, the canvas at the sprite pixel scale */
function frame(type, name, k) {
  const S = spriteScale(); if (S !== FR_S) { FR.clear(); FR_S = S; }
  const key = type + ':' + name + ':' + k; let v = FR.get(key); if (v) return v;
  const T = manifest.types[type], f = T && T.f[name]; if (!f) return null;
  const img = ATL.get(T.atlas).img, u = k / T.px; // world units per atlas px
  const W = f.w * u, H = f.h * u, pw = Math.max(1, Math.round(W * S)), ph = Math.max(1, Math.round(H * S));
  const c = mkCanvas(pw, ph), g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  if (pw < f.w * 0.55) { // big down-scale: two steps (cleaner than one bilinear jump)
    const m = mkCanvas(Math.round(pw * 2), Math.round(ph * 2)), q = m.getContext('2d'); q.imageSmoothingQuality = 'high';
    q.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, m.width, m.height); g.drawImage(m, 0, 0, pw, ph);
  } else g.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, pw, ph);
  v = { c, fl: null, w: W, h: H, ax: f.ax * u, ay: f.ay * u, weapon: !!f.weapon };
  if (FR.size > 400) FR.clear();
  FR.set(key, v); return v;
}
function flashOf(v) {
  if (!v.fl) { const c = mkCanvas(v.c.width, v.c.height), q = c.getContext('2d'); q.drawImage(v.c, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = '#fff'; q.fillRect(0, 0, c.width, c.height); v.fl = c; }
  return v.fl;
}
const has = (type, name) => !!(manifest && manifest.types[type] && manifest.types[type].f[name]);
/** in-game height (world units, elite x1.25) of a painted type, 0 when it is not drawn painted */
export function enemyArtH(type, elite) { const T = manifest && manifest.types[type]; return T ? T.h * (elite ? 1.25 : 1) : 0; }
/** world units from the entity position up to the top of the painted art (name tags, bars, stun stars); 0 = classic */
export function enemyTop(e) {
  if (!paintedEnemyReady(artType(e))) return 0;
  const H = enemyArtH(artType(e), e.elite); return H - e.r * 0.5 + (FLOAT[e.type] || 0) * H;
}
/** fx anchor: how far above the entity position the painted body's centre is (damage numbers, hit sparks) */
export function enemyFxLift(sim, id) {
  if (!sim || id == null || !heroArt.painted) return 0;
  const e = (sim.enemyById && sim.enemyById.get(id)) || null; if (!e || e.kind === 'player') return 0;
  if (!paintedEnemyReady(artType(e))) return 0;
  const H = enemyArtH(artType(e), e.elite); return Math.max(0, H * (0.5 + (FLOAT[e.type] || 0)) - e.r * 0.5);
}
let XMODE = false; // Astrael (Extreme): set by the Astrael draw
const artType = (e) => (e.type === 'astrael' && (e.ax || XMODE) ? 'astraelx' : e.type);

// ------------------------------------------------------------------ motion state (per enemy id)
const MS = new Map();
function motion(e, now) {
  let m = MS.get(e.id);
  if (!m) { if (MS.size > 600) MS.clear(); m = { x: e.x, y: e.y, t: now, spd: 0, ph: (e.id * 1.7) % TAU, k: -1, prev: -1, t0: -1e9 }; MS.set(e.id, m); }
  const dt = Math.min(0.1, Math.max(0, (now - m.t) / 1000));
  if (dt > 0) {
    const d = Math.hypot(e.x - m.x, e.y - m.y); const v = d > 60 ? 0 : d / dt; // (teleports / respawns don't count)
    m.spd += (v - m.spd) * Math.min(1, dt * 10); m.dist = d > 60 ? 0 : d; m.x = e.x; m.y = e.y; m.t = now;
  } else m.dist = 0;
  return m;
}
const BAND = 5 * Math.PI / 180, HYST = 6 * Math.PI / 180, FADE_MS = 80;
const VIEWS = ['side', 'front', 'side', 'back']; // 0 right, 1 down, 2 left (mirrored), 3 up
function pickView(m, ang, keyed, now) {
  const q = ((ang % TAU) + TAU) % TAU; let k0 = Math.round(q / (Math.PI / 2)) % 4, k1 = k0, w1 = 0;
  if (keyed) {
    if (m.k < 0) { m.k = m.prev = k0; }
    if (k0 !== m.k) { let d = Math.abs(q - m.k * (Math.PI / 2)) % TAU; if (d > Math.PI) d = TAU - d; if (d > Math.PI / 4 + HYST) { m.prev = m.k; m.k = k0; m.t0 = now; } }
    k0 = m.k; const p = (now - m.t0) / FADE_MS; if (p < 1 && m.prev !== k0) { k1 = m.prev; w1 = 1 - smoothstep(p); }
  } else {
    const off = q - k0 * (Math.PI / 2), o = off > Math.PI ? off - TAU : off, edge = Math.PI / 4 - Math.abs(o);
    k1 = (k0 + (o >= 0 ? 1 : 3)) % 4; w1 = edge < BAND ? 0.5 * smoothstep((BAND - edge) / BAND) : 0;
  }
  return [k0, k1, w1];
}

// ------------------------------------------------------------------ forms
/** the frame to show for view slot `view` (0..3) given the enemy's state / phase */
function formFrame(e, T, view, o) {
  const t = T, alt = (n) => (has(t, n) ? n : null);
  const base = VIEWS[view] === 'back' ? (has(t, 'back') ? 'back' : 'front') : VIEWS[view] === 'side' ? (has(t, 'side') ? 'side' : 'front') : 'front';
  let form = null, all = false;
  switch (e.type) {
    case 'boss': if (e.phase === 3) form = 'rage'; break;
    case 'thornmaw': case 'ashfang': case 'ankhara': case 'sekhem': if (e.phase >= 2) form = 'p2'; break;
    case 'khepra': if (e.phase === 3) form = 'p3'; break;
    case 'raidboss': if (e.raidLance) { form = 'lance'; all = true; } break;
    case 'neferakh': if (o.dark) form = 'dark'; break;
    case 'mummy': if (e.unravel || e.hp < e.maxHp * 0.5) form = 'unravel'; break;
    case 'scarab': if (e.state === 'roll') { form = 'ball'; all = true; } break;
    case 'sprout': case 'shroom': if (e.state === 'wind') { form = 'wind'; all = true; } break;
    case 'astrael': if (o.cast) { form = 'cast'; all = true; } if (o.clone) { form = 'mirror'; all = true; } break;
  }
  if (form && alt(form) && (all || base !== 'back')) return { name: form, base, alt: true };
  return { name: base, base, alt: false };
}

// ------------------------------------------------------------------ drawing
function blitV(ctx, v, mirror, alpha, flashA) {
  if (alpha <= 0.003 || !v) return;
  const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * alpha;
  if (mirror) { ctx.save(); ctx.scale(-1, 1); }
  ctx.drawImage(v.c, -v.ax, -v.ay, v.w, v.h);
  if (flashA > 0.01) { // additive, crisp hit flash (same as the painted heroes)
    const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a0 * alpha * flashA; ctx.drawImage(v.c, -v.ax, -v.ay, v.w, v.h); ctx.drawImage(v.c, -v.ax, -v.ay, v.w, v.h);
    ctx.globalAlpha = a0 * alpha * flashA * 0.5; ctx.drawImage(flashOf(v), -v.ax, -v.ay, v.w, v.h);
    ctx.globalCompositeOperation = op;
  }
  if (mirror) ctx.restore();
  ctx.globalAlpha = a0;
}
const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
/** weapon angle (screen, radians; 0 = tip forward, +pi/2 = tip down) for the knight's sword / Grimtusk's club */
function weaponAng(e) {
  if (e.type === 'knight') {
    if (e.state !== 'swing') return 1.3 + Math.sin(performance.now() / 800 + (e.id || 0)) * 0.04; // at rest: tip down at his side
    return e.st < 34 ? lerp(1.3, -2.0, smoothstep(Math.min(1, e.st / 30))) : lerp(-2.0, 1.75, smoothstep(Math.min(1, (e.st - 34) / 6)));
  }
  if (e.state === 'slam') return e.st < 50 ? lerp(1.15, -2.1, smoothstep(Math.min(1, e.st / 40))) : lerp(-2.1, 1.6, smoothstep(Math.min(1, (e.st - 50) / 6)));
  if (e.state === 'charge') return -0.15;
  if (e.state === 'stomps' || e.state === 'ring') return 1.15 + Math.sin(e.st * 0.4) * 0.35;
  return 1.15 + Math.sin(performance.now() / 700 + e.id) * 0.05;
}
function drawWeapon(ctx, W, H, view, ang, flashA, glowCol, rightHand = false) {
  // hand: forward of the body in the side view, at the figure's right hand (screen left) in front, behind in the back view.
  // rightHand: the weapon hand is on screen RIGHT in the front view (the Dread Knight: shield on screen left, and his
  // painted front body has the sword erased so this frame is the only sword); his back view then puts it screen left.
  const side = view === 0 || view === 2, dir = view === 2 ? -1 : 1, fl = rightHand ? -1 : 1;
  const hx = side ? dir * H * 0.1 : (view === 1 ? -H * 0.24 : H * 0.24) * fl * (rightHand ? 0.92 : 1), hy = -H * (side ? 0.47 : rightHand && view === 1 ? 0.43 : 0.45);
  const a = side ? (dir > 0 ? ang : Math.PI - ang) : ((view === 1) !== rightHand ? Math.PI - ang * 0.8 : ang * 0.8);
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(a);
  if (Math.cos(a) < 0) ctx.scale(1, -1); // keep the edge / spikes upright past vertical
  if (glowCol) { const g = glowSprite(glowCol, 24), a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * 0.6; ctx.drawImage(g, W.w * 0.3 - W.ax, -W.h * 1.2, W.w * 0.8, W.h * 2.4); ctx.globalAlpha = a0; }
  blitV(ctx, W, false, 1, flashA);
  ctx.restore();
}

/**
 * Draw a painted enemy body at the current origin (art.js has translated to the entity and drawn shadow / ring / glow).
 * Returns false when the enemy should use the procedural drawing (not loaded, classic, mound states).
 * o: { t (seconds), dark (Neferakh Dark form), cast / clone (Astrael), keyless (sheets) }
 */
export function drawPaintedEnemy(ctx, e, o = {}) {
  const type = artType(e);
  if (!paintedEnemyReady(type)) return false;
  if ((e.type === 'sandwurm' && (e.state === 'under' || e.state === 'erupt' || e.state === 'idle')) || (e.type === 'khepra' && (e.state === 'under' || e.state === 'erupt'))) return false; // the mounds stay procedural
  const now = o.now != null ? o.now : performance.now(), t = o.t != null ? o.t : now / 1000;
  const m = motion(e, now), k = e.elite ? 1.25 : 1, H = enemyArtH(type, e.elite);
  const frozen = e.cc && e.cc.frozen, down = e.cc && e.cc.down > 0;
  const mk = frozen ? 0 : clamp01(m.spd / 70) * (FLOAT[e.type] ? 0 : 1);
  if (!frozen) m.ph += (m.dist || 0) / Math.max(18, H * (QUAD.has(e.type) ? 0.3 : 0.42)) * Math.PI;
  const [k0, k1, w1] = o.view != null ? [o.view, o.view, 0] : pickView(m, e.face || 0, !o.keyless, now);
  const F0 = formFrame(e, type, k0, o), v0 = frame(type, F0.name, k), mir0 = k0 === 2 || (o.clone && k0 !== 2);
  if (!v0) return false;
  // ---- body motion
  let lift = (FLOAT[e.type] || 0) * H, rot = 0, sx = 1, sy = 1;
  const id = e.id || 0, faceX = Math.cos(e.face || 0) >= 0 ? 1 : -1, sideView = k0 === 0 || k0 === 2;
  if (FLOAT[e.type]) { lift += Math.sin(t * 2.2 + id) * H * 0.03; rot += Math.sin(t * 1.3 + id) * 0.025; }
  else if (!frozen) {
    const st = Math.sin(m.ph); lift += Math.abs(st) * H * 0.022 * mk; // walk bob (two steps per stride)
    sy += 0.028 * Math.cos(m.ph * 2) * mk; sx -= 0.018 * Math.cos(m.ph * 2) * mk;
    rot += (sideView ? 0.035 * faceX : 0) * mk + 0.02 * st * mk * (sideView ? 0 : 1);
    if (e.type === 'slime') { const h = Math.sin(t * 5 + id); sy += 0.06 * h; sx -= 0.05 * h; } // jelly wobble
    sy += 0.012 * Math.sin(t * 2.4 + id * 0.7); // breathing
  }
  const st = e.st || 0;
  const winding = WIND.has(e.state) || (e.boss && ['slam', 'charge', 'stomps', 'burrow', 'pounce'].includes(e.state) && st < 50);
  if (winding && !frozen && !CHARGE.has(e.state)) { // wind-up: lean back + a pulse, growing with the state timer
    const w = smoothstep(Math.min(1, st / 30)), pulse = Math.sin(t * 16) * 0.5 + 0.5;
    if (sideView) rot -= 0.09 * w * faceX; sy *= 1 + 0.035 * w * pulse; sx *= 1 + 0.025 * w * (1 - pulse); lift += H * 0.01 * w;
  }
  if (CHARGE.has(e.state) && !(e.boss && st < 50 && e.state === 'charge') && !frozen) { // charge / dash: stretch along the run
    if (sideView) { sx *= 1.12; sy *= 0.94; rot += 0.1 * faceX; } else { sy *= 1.07; sx *= 0.95; }
  }
  if (e.state === 'dazed' || e.state === 'recover') sy *= 0.97;
  if (down) { rot += 0.55 * faceX; sy *= 0.85; }
  if (e.state === 'fade' && e.type === 'wisp') ctx.globalAlpha *= Math.max(0, 1 - st / 20);
  const fk = e.flash > 0 ? Math.min(1, e.flash / 6) : 0, flashA = fk * fk;
  // ---- burrow / emerge (Ankhara's burrow, the sandwurm surfacing / diving): sink below the ground line, clipped
  let sink = 0;
  if (e.state === 'burrow') sink = st < 14 ? st / 14 : st < 80 ? 1 : Math.max(0, 1 - (st - 80) / 14);
  else if (e.type === 'sandwurm') sink = e.state === 'dive' ? Math.min(0.85, st / 24) : e.state === 'surface' ? Math.max(0, 1 - st / 12) : 0;
  ctx.save();
  ctx.translate(0, e.r * 0.5); // feet on the shadow
  if (e.invuln > 0 && e.invuln < 1e5) ctx.globalAlpha *= 0.55 + 0.25 * Math.sin(t * 30);
  if (sink > 0) {
    ctx.save(); ctx.globalAlpha *= 0.5 * Math.min(1, sink * 3); ctx.fillStyle = 'rgba(120,96,60,.55)'; ctx.beginPath(); ctx.ellipse(0, 0, v0.w * 0.4, v0.w * 0.12, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.rect(-v0.w * 2, -H * 3, v0.w * 4, H * 3 + 2); ctx.clip(); ctx.translate(0, sink * H * 1.02);
  }
  ctx.translate(0, -lift); ctx.rotate(rot); ctx.scale(sx, sy);
  if (sink >= 0.999) { ctx.restore(); return true; }
  // phase / state auras behind the body (the painted art carries the form; a soft coloured glow marks it from any view)
  const pc = PHASE_COL[e.type], formOn = F0.alt || (F0.base === 'back' && formFrame(e, type, 1, o).alt);
  if (pc && formOn) { const g = glowSprite(pc, 40), a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * (0.35 + 0.12 * Math.sin(t * 5)); ctx.drawImage(g, -v0.w * 0.7, -H * 1.05, v0.w * 1.4, H * 1.1); ctx.globalAlpha = a0; }
  if (e.type === 'raidboss' && (e.ward || e.raidWard)) { const g = glowSprite('#5ff2ff', 40), a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * 0.45; ctx.drawImage(g, -H * 0.5, -H * 0.95, H, H); ctx.globalAlpha = a0; }
  // weapons: Grimtusk's club and the Dread Knight's sword (always; the knight's body art has its painted sword erased,
  // so a swing never shows two). The red glow marks the knight's swing / Grimtusk's slam wind-up.
  const knight = e.type === 'knight', wpn = e.type === 'boss' ? 'club' : knight ? 'sword' : null;
  let W = null, wa = 0, wglow = null;
  if (wpn) { W = frame(type, wpn, k); wa = weaponAng(e); wglow = (knight && e.state === 'swing') || (e.state === 'slam' && st < 56) ? '#ff5e5b' : null; }
  const behind = W && k0 === 3; // facing away: the weapon hand is on the far side
  if (behind) drawWeapon(ctx, W, H, k0, wa, flashA, wglow, knight);
  if (F0.name === 'ball') { // the rolled scarab: a spinning ball (rotates about its own centre)
    const cx = v0.w / 2 - v0.ax, cy = v0.h / 2 - v0.ay;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 14 * faceX); ctx.translate(-cx, -cy);
    blitV(ctx, v0, false, 1, flashA); ctx.restore();
  } else blitV(ctx, v0, mir0, 1, flashA);
  if (w1 > 0 && k1 !== k0) { const F1 = formFrame(e, type, k1, o), v1 = frame(type, F1.name, k); blitV(ctx, v1, k1 === 2 || (o.clone && k1 !== 2), w1, flashA); }
  if (W && !behind) drawWeapon(ctx, W, H, k0, wa, flashA, wglow, knight);
  ctx.restore();
  return true;
}

/** Astrael (and her Reflection / the Extreme art). Returns false if not loaded. o: { t, extreme, cast, clone, fade, hurt, shield, bigbang, shadow } */
export function drawPaintedAstrael(ctx, x, y, o) {
  XMODE = !!o.extreme;
  const type = o.extreme ? 'astraelx' : 'astrael';
  if (!paintedEnemyReady(type)) return false;
  const k = 1, H = enemyArtH(type, false), t = o.t || 0;
  const name = o.clone ? 'mirror' : o.cast && has(type, 'cast') ? 'cast' : 'front';
  const v = frame(o.clone ? 'astrael' : type, name, k); if (!v) return false;
  const bob = Math.sin(t * 1.8) * 6;
  ctx.save(); ctx.translate(x, y);
  if (o.shadow !== false && !o.clone) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 50, 64, 22, 0, 0, TAU); ctx.fill(); }
  const g = glowSprite(o.bigbang ? '#ffffff' : o.clone ? '#c8d2ff' : o.extreme ? '#ff5a9a' : '#9fbaff', 48);
  const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * (o.bigbang ? 0.8 : 0.42); ctx.drawImage(g, -H * 0.5, -H * 0.95 + bob, H, H); ctx.globalAlpha = a0;
  ctx.translate(0, 40 - H * 0.06 + bob);
  ctx.rotate(Math.sin(t * 0.9) * 0.012);
  const s = 1 + Math.sin(t * 2.1) * 0.008; ctx.scale(s, 1 / s);
  const fk = o.hurt ? Math.min(1, o.hurt / 6) : 0;
  blitV(ctx, v, !!o.clone, o.clone ? 0.92 : 1, fk * fk);
  ctx.restore();
  return true;
}
/** the Aegis Star painted (rotating gently, the orbiting shards / ring / HP bar stay procedural in astraelfx) */
export function drawPaintedAegis(ctx, e, t) {
  if (!paintedEnemyReady('astralstar')) return false;
  const v = frame('astralstar', 'front', 1); if (!v) return false;
  const fk = e.flash > 0 ? Math.min(1, e.flash / 6) : 0;
  if (!v.cen) v.cen = { c: v.c, fl: null, w: v.w, h: v.h, ax: v.w / 2, ay: v.h / 2 };
  ctx.save(); ctx.rotate(Math.sin(t * 1.4 + e.id) * 0.18);
  blitV(ctx, v.cen, false, 1, fk * fk); ctx.restore();
  return true;
}
export const ENEMY_FLOAT = FLOAT;
/** per-frame world context set by the biome renderers (tombfx: Neferakh's Dark form follows the Tomb's light) */
export const ENEMY_ENV = { dark: false };
