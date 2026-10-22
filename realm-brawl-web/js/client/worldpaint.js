// Painted world stage (gacha dark-fantasy art pass, part 3): seamless painted ground textures per biome, painted arena /
// landmark decals, upright painted props (trees, rocks, ruins, Dunes / Tomb props, portals, loot sacks) and the tavern
// hub art. Assets: public/assets/world/ (built by tools/world-split.py + tools/world-atlas.py): 13 tile textures, one
// WebP atlas per biome group (wilds / dunes / tomb / sanct / common / hub) and the tavern backdrop, every one lazy-loaded
// the first time something asks for it (so the Dunes atlas only loads when the Dunes are on screen).
// Everything here is OFF when Options > Art style = Classic (heroArt.mode), and every caller keeps its code-drawn path
// as the fallback while an asset is still loading (the ground cache repaints when it arrives: WP.epoch).
import { heroArt } from './heropaint.js';
import { sprite, blit } from './sprite.js';
import { setHubLayout } from '../sim/hub.js';

const hasDOM = typeof document !== 'undefined' && typeof Image !== 'undefined';
const BASE = hasDOM ? new URL('../../assets/world/', import.meta.url).href : '';
/** epoch: bumped whenever painted world art arrives or the art style flips (ground / canopy caches repaint on change) */
export const WP = { epoch: 0, man: null, failed: false };
let manP = null;
const IMG = new Map();
const bump = () => { WP.epoch++; };
heroArt.listeners.add(bump);
/** painted world on? (the Art style option; Classic keeps every code-drawn biome, prop and the old village) */
export const wpOn = () => heroArt.painted && !WP.failed;
function manifest() {
  if (!hasDOM || (WP.failed && !WP.force)) return null;
  if (WP.man) return WP.man;
  if (!manP) manP = fetch(BASE + 'world.json').then((r) => { if (!r.ok) throw new Error('world.json ' + r.status); return r.json(); }).then((m) => { WP.man = m; bump(); return m; }).catch((e) => { console.warn('[worldpaint]', e.message); WP.failed = true; });
  return null;
}
function img(src) {
  let s = IMG.get(src);
  if (s) return s.st === 'ready' ? s.img : null;
  s = { st: 'loading', img: null }; IMG.set(src, s);
  const im = new Image(); im.decoding = 'async';
  im.onload = () => { s.st = 'ready'; s.img = im; bump(); };
  im.onerror = () => { s.st = 'failed'; console.warn('[worldpaint] failed', src); };
  im.src = BASE + src;
  return null;
}
/** start loading a group atlas / tiles ahead of time (no-op in Classic) */
export function wpPreload(groups = [], tiles = []) {
  if (!wpOn()) return;
  const m = manifest(); if (!m) { if (manP) manP.then(() => wpPreload(groups, tiles)); return; }
  for (const g of groups) if (g === 'hall') img(m.hall.src); else if (m.groups[g]) img(m.groups[g].src);
  for (const t of tiles) if (m.tiles[t]) img(m.tiles[t].src);
}
/** tile texture image (or null while loading / Classic) */
export function wpTile(id) { if (!wpOn()) return null; const m = manifest(); const t = m && m.tiles[id]; return t ? img(t.src) : null; }
/** { im, p } for an atlas piece (or null) */
export function wpPiece(name) {
  if (!wpOn() && !WP.force) return null;
  const m = manifest(); if (!m) return null;
  const p = m.pieces[name]; if (!p) return null;
  const im = img(m.groups[p.g].src);
  return im ? { im, p } : null;
}
export const wpHas = (...names) => names.every((n) => !!wpPiece(n));
export function wpHall() { if (!wpOn() && !WP.force) return null; const m = manifest(); return m ? img(m.hall.src) : null; }

// ------------------------------------------------------------------ drawing helpers
const PAT = new WeakMap();
/** a repeating pattern of tile `id` covering `units` world units per tile repeat (null while loading) */
export function wpPattern(g, id, units = 420) {
  const im = wpTile(id); if (!im) return null;
  let m = PAT.get(g); if (!m) { m = new Map(); PAT.set(g, m); }
  const k = id + ':' + units; let p = m.get(k);
  if (!p) { p = g.createPattern(im, 'repeat'); if (p && p.setTransform && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix().scale(units / im.width)); m.set(k, p); }
  return p;
}
/** a round decal centred on (x, y) with diameter d (its longer side) */
export function wpDecal(g, name, x, y, d, alpha = 1) {
  const P = wpPiece(name); if (!P) return false;
  const { im, p } = P, k = d / Math.max(p.w, p.h), w = p.w * k, h = p.h * k;
  const a0 = g.globalAlpha; if (alpha < 1) g.globalAlpha = a0 * alpha;
  g.drawImage(im, p.x, p.y, p.w, p.h, x - w / 2, y - h / 2, w, h);
  g.globalAlpha = a0;
  return true;
}
/** draw a piece straight from the atlas (for the one-off ground-tile bakes): feet at (x, y), height h world units */
export function wpPropDirect(g, name, x, y, h, flip = false) {
  const P = wpPiece(name); if (!P) return false;
  const { im, p } = P, k = h / p.h;
  if (flip) { g.save(); g.translate(x, y); g.scale(-1, 1); g.drawImage(im, p.x, p.y, p.w, p.h, -p.ax * k, -p.ay * k, p.w * k, p.h * k); g.restore(); }
  else g.drawImage(im, p.x, p.y, p.w, p.h, x - p.ax * k, y - p.ay * k, p.w * k, p.h * k);
  return true;
}
/** per-frame prop draw through the sprite cache (pre-scaled once per 8-unit height bucket): feet at (x, y) */
export function wpProp(ctx, name, x, y, h, alpha = 1, flip = false) {
  const P = wpPiece(name); if (!P) return false;
  const { im, p } = P, hb = Math.max(8, Math.round(h / 8) * 8), k = hb / p.h, w = p.w * k;
  const c = sprite(`wp:${name}:${hb}:${flip ? 1 : 0}`, w, hb, (flip ? p.w - p.ax : p.ax) * k, p.ay * k, (g) => {
    if (flip) { g.save(); g.scale(-1, 1); g.drawImage(im, p.x, p.y, p.w, p.h, -p.ax * k, -p.ay * k, p.w * k, p.h * k); g.restore(); }
    else g.drawImage(im, p.x, p.y, p.w, p.h, -p.ax * k, -p.ay * k, p.w * k, p.h * k);
  });
  const a0 = ctx.globalAlpha; if (alpha < 1) ctx.globalAlpha = a0 * alpha;
  blit(ctx, c, x, y, h / hb);
  ctx.globalAlpha = a0;
  return true;
}
/** world-unit size of a piece drawn at height h */
export function wpSize(name, h) { const P = wpPiece(name); if (!P) return null; const k = h / P.p.h; return { w: P.p.w * k, h, ax: P.p.ax * k, ay: P.p.ay * k }; }
/** soft contact shadow under an upright prop (baked into the ground tiles) */
export function wpContact(g, x, y, rx, ry, a = 0.28) {
  const gr = g.createRadialGradient(x, y, 0, x, y, rx); gr.addColorStop(0, `rgba(20,16,24,${a})`); gr.addColorStop(1, 'rgba(20,16,24,0)');
  g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rx, 0, Math.PI * 2); g.fill(); g.restore();
}

// ------------------------------------------------------------------ which painted piece stands for which world prop
const H = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** Wilds props: { name, h (world units tall), flip } or null (no painted version) */
export function wildsPropArt(o) {
  const v = o.variant || 0, flip = (v % 2) === 1;
  switch (o.kind) {
    case 'tree': {
      let n;
      if (o.giant) return { name: 'tree_elderoak', h: o.size * 2.9, flip: false };
      if (o.dead) n = o.zone >= 4 ? 'tree_deadviolet' : 'tree_deadember';
      else if (o.zone === 2 && v % 3 === 0) n = 'tree_pine';
      else if (o.zone === 4) n = v % 2 === 0 ? 'tree_deadviolet' : 'tree_violet';
      else if (o.zone === 3) n = v % 3 === 0 ? 'tree_deadember' : 'tree_autumn';
      else n = v % 2 ? 'tree_oak2' : 'tree_oak';
      return { name: n, h: o.size * (n === 'tree_pine' ? 3.6 : 3.1), flip };
    }
    case 'rock': return { name: 'rock' + (1 + (v % 3)), h: o.size * 1.75, flip };
    case 'cliff': return { name: v % 2 ? 'cliff2' : 'cliff1', h: o.size * 1.5, flip: (v >> 1) % 2 === 1 };
    case 'pillar': return { name: 'ruinpillar', h: o.size * 2.8, flip };
    case 'menhir': return { name: 'menhir', h: o.size * 3.3, flip };
    case 'ruinwall': return { name: 'ruinwall', h: o.size * 2.7, flip };
    case 'ruintower': return { name: 'watchtower', h: o.size * 3.8, flip: false };
    default: return null;
  }
}
export function wildsDecorArt(d) {
  if (d.kind === 'bush') return { name: d.variant % 3 === 0 ? 'bush2' : 'bush1', h: d.size * 1.55, flip: d.variant % 2 === 1 };
  if (d.kind === 'reeds') return { name: 'reeds', h: d.size * 2.3, flip: d.variant % 2 === 1 };
  return null;
}
/** Dunes + Tomb props */
export function dunesPropArt(o) {
  const v = o.variant || 0, flip = (v % 2) === 1;
  switch (o.kind) {
    case 'sandrock': return { name: 'sandrock' + (1 + (v % 3)), h: o.size * 1.7, flip };
    case 'cactus': return { name: 'cactus' + (1 + (v % 3)), h: o.size * (v % 3 === 2 ? 1.5 : 2.6), flip };
    case 'ruin': return { name: ['block1', 'block2', 'column'][v % 3], h: o.size * 1.6, flip };
    case 'mesa': return { name: 'mesa', h: o.size * 1.6, flip };
    case 'palm': return { name: v % 2 ? 'palm2' : 'palm1', h: o.size * 3.6, flip: (v >> 1) % 2 === 1 };
    case 'sphinx': return { name: 'sphinx', h: o.size * 2.1, flip: false };
    case 'colossus': return { name: 'colossus', h: o.size * 3.4, flip: false };
    case 'glass': return { name: v % 3 === 0 ? 'glasscluster' : 'glassspire', h: o.size * (v % 3 === 0 ? 2.2 : 3.4), flip };
    case 'sunobelisk': return { name: 'sunobelisk', h: o.size * 5.2, flip: false };
    case 'tombpillar': return { name: 'tombpillar', h: o.size * 4.4, flip: false };
    case 'tombobelisk': return { name: 'tombobelisk', h: o.size * 5.0, flip: false };
    default: return null;
  }
}
export function dunesDecorArt(d) {
  if (d.kind === 'drybush') return { name: d.variant % 3 === 0 ? 'tumbleweed' : 'drybush', h: d.size * 1.6, flip: d.variant % 2 === 1 };
  if (d.kind === 'skull') return { name: 'skull', h: d.size * 1.0, flip: d.variant % 2 === 1 };
  return null;
}
/** a painted prop (y-sorted pass): returns true when drawn */
export function drawPaintedProp(ctx, art, x, y, alpha = 1) { return !!art && wpProp(ctx, art.name, x, y, art.h, alpha, art.flip); }
/** loot sack by rarity index (0 common .. 5 sigil reliquary): bob + a soft rarity glow are drawn by the caller */
export const bagArt = (rarity) => 'bag' + Math.max(0, Math.min(5, rarity | 0));
export { H as wpHash };
const BAG_GLOW = ['#e8d2b0', '#4aa8ff', '#b86bff', '#ffb52e', '#2ee6c4', '#ff4f7b'];
/** painted loot sack (rarity 0..5): shadow, a soft rarity glow from rare up, a gentle bob */
export function drawBagPainted(ctx, x, y, rarity, t) {
  const name = bagArt(rarity); if (!wpPiece(name)) return false;
  const bob = Math.sin(t * 4 + x) * 2, col = BAG_GLOW[rarity] || BAG_GLOW[0];
  ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#140c18'; ctx.beginPath(); ctx.ellipse(x, y + 12, 15, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  if (rarity >= 2) { ctx.save(); ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 5); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 28, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  wpProp(ctx, name, x, y + 13 + bob, rarity >= 5 ? 36 : 38);
  return true;
}

/** solo / mobile: the hub layout follows the Art style (Painted = the tavern hall, Classic = Brightwater Village).
 *  Returns an unbind function. */
export function bindHubLayout(sim) {
  const apply = () => setHubLayout(sim, heroArt.painted ? 'tavern' : 'village');
  apply(); heroArt.listeners.add(apply);
  return () => heroArt.listeners.delete(apply);
}
