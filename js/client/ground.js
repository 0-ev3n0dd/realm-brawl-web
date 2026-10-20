// Ground tile cache (perf pass): the static ground of the Wilds + the Sunscorch Dunes (sea, coast, danger bands,
// texture strokes, roads, landmarks, arena floors, baked bushes / reeds / tumbleweeds / skulls) is painted once into
// 512x512 world-unit tiles on offscreen canvases and blitted every frame. LRU, one prefetch per frame, and tiles keep
// their pixel scale across small zoom changes (the Astrael camera, the mobile camera presets) so zooming never
// rebuilds the whole screen. Shared by the desktop Renderer and the MobileRenderer.
import { drawLandmark } from './sitesfx.js';
import { paintWater, paintWilds } from './wildsfx.js';
import { paintWildsDecor, drawWildsObstacle, drawTreeD } from './wildprops.js';
// static Wilds obstacles baked into the ground tiles (perf pass 2): rock / cliff bodies and tree shadows + trunks
export const BAKED_OBS = new Set(['rock', 'cliff', 'tree']);
import { paintDunesStatic, drawDunesDecor } from './dunesfx.js';
import { paintFrostStatic, drawFrostDecor, drawFrostBaked, drawPineTop, FROST_BAKE } from './frostfx.js';
import { paintEmberStatic, drawEmberDecor, drawEmberBaked, EMBER_BAKE } from './emberfx.js';
import { paintRiftStatic, drawRiftDecor, drawRiftBaked, RIFT_BAKE } from './riftfx.js'; // the Astral Rift (game loop C3)
const bakeable = (o) => o.rift ? RIFT_BAKE.has(o.kind) : o.frost ? FROST_BAKE.has(o.kind) : o.ember ? EMBER_BAKE.has(o.kind) : !o.dunes && !o.tomb && !o.town && !o.crypt && !o.forge && BAKED_OBS.has(o.kind);
import { WP, wpOn, wpPiece, wpPropDirect, wpContact, wildsPropArt, wildsDecorArt, dunesDecorArt } from './worldpaint.js';
/** painted world: the upright painted version of a Wilds obstacle (null = keep the code-drawn / baked one) */
export function paintedObs(o) { if (!wpOn() || o.dunes || o.tomb || o.town || o.frost || o.crypt || o.ember || o.forge || o.rift) return null; const a = wildsPropArt(o); return a && wpPiece(a.name) ? a : null; }
/** painted world: the tile bake only lays a soft contact shadow under a painted prop (the prop itself is y-sorted) */
function obsShadow(g, o) { const s = o.size || 20, k = o.kind === 'tree' ? 0.75 : o.kind === 'cliff' ? 1.05 : 0.95; wpContact(g, o.x, o.y + s * 0.05, s * k + 6, s * k * 0.42 + 4, o.kind === 'tree' ? 0.34 : 0.26); }

export const TS = 512;
const PAD = 90;

export class GroundCache {
  constructor(opts = {}) {
    this.tiles = new Map(); this.max = opts.max || 40; this.scaleCap = opts.scaleCap || 2;
    this.stats = { built: 0, buildMs: 0, lastMs: 0 };
    this.decorGrid = null; this.decorSrc = null;
  }
  clear() { this.tiles.clear(); }
  wantObs(o) { return bakeable(o); }
  obsReach(o) { return (o.size || 20) * 1.6 + 40; }
  paintTile(g, view, tx, ty) {
    paintGround(g, view, this.decorGrid ? this.decorGrid.get(tx + ',' + ty) : null);
    const obs = this.obsGrid && this.obsGrid.get(tx + ',' + ty);
    if (obs) for (const o of obs) { if (o.rift) drawRiftBaked(g, o); else if (o.frost) drawFrostBaked(g, o); else if (o.ember) drawEmberBaked(g, o); else if (paintedObs(o)) obsShadow(g, o); else drawWildsObstacle(g, o); }
  }
  /** Bucket the world decor by tile so a tile build only walks its own bushes. */
  indexDecor(world) {
    if (!world || world.decor === this.decorSrc) return;
    this.decorSrc = world.decor; this.decorGrid = new Map(); this.clear();
    this.obsGrid = new Map();
    for (const o of world.obstacles || []) {
      if (!this.wantObs(o)) continue;
      const r = this.obsReach(o), x0 = Math.floor((o.x - r) / TS), x1 = Math.floor((o.x + r) / TS), y0 = Math.floor((o.y - r) / TS), y1 = Math.floor((o.y + r) / TS);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const k = tx + ',' + ty; let a = this.obsGrid.get(k); if (!a) this.obsGrid.set(k, (a = [])); a.push(o); }
    }
    for (const a of this.obsGrid.values()) a.sort((p, q) => p.y - q.y || p.x - q.x);
    if (this.decorOff) return;
    for (const d of world.decor || []) {
      if (d.tomb || d.crypt || d.forge) continue;
      const r = (d.size || 20) * 2 + 10;
      const x0 = Math.floor((d.x - r) / TS), x1 = Math.floor((d.x + r) / TS), y0 = Math.floor((d.y - r) / TS), y1 = Math.floor((d.y + r) / TS);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const k = tx + ',' + ty; let a = this.decorGrid.get(k); if (!a) this.decorGrid.set(k, (a = [])); a.push(d); }
    }
  }
  /** Blit the tiles that cover view (world units) onto ctx (already in world transform). s = wanted pixels per unit. */
  draw(ctx, view, s, world, gl = null) { // gl: the GL world layer (client/gl/glcore.js) takes the tiles instead of ctx
    this.indexDecor(world);
    if (this.epoch !== WP.epoch) { this.epoch = WP.epoch; this.clear(); } // painted world art arrived / the art style flipped
    // tiles are painted at the exact screen scale (whole pixels per tile) and blitted unsmoothed: a 1:1 copy, no resampling
    const want = Math.round(TS * Math.min(this.scaleCap, Math.max(0.5, s))) / TS;
    const tx0 = Math.floor(view.x0 / TS), tx1 = Math.floor(view.x1 / TS), ty0 = Math.floor(view.y0 / TS), ty1 = Math.floor(view.y1 / TS);
    const smooth = ctx && ctx.imageSmoothingEnabled; if (ctx) ctx.imageSmoothingEnabled = false;
    this.max = Math.max(this.max, (tx1 - tx0 + 3) * (ty1 - ty0 + 3) + 4);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (this.skipEmpty && !(this.obsGrid && this.obsGrid.has(tx + ',' + ty))) continue;
      const t = this.tile(tx, ty, want);
      if (gl) gl.quad(t, tx * TS, ty * TS, TS, TS); else ctx.drawImage(t, tx * TS, ty * TS, TS, TS);
    }
    if (ctx) ctx.imageSmoothingEnabled = smooth;
    // pre-build one neighbouring tile per frame so walking never waits for a whole row
    for (let ty = ty0 - 1; ty <= ty1 + 1; ty++) for (let tx = tx0 - 1; tx <= tx1 + 1; tx++) {
      const t = this.tiles.get(tx + ',' + ty);
      if (!t || t.scale < want * 0.7) { this.tile(tx, ty, want); return; }
    }
  }
  tile(tx, ty, want) {
    const k = tx + ',' + ty;
    let t = this.tiles.get(k);
    if (t && t.scale >= want * 0.7 && t.scale <= want * 1.6) { this.tiles.delete(k); this.tiles.set(k, t); return t; }
    t = this.build(tx, ty, want);
    this.tiles.delete(k); this.tiles.set(k, t);
    while (this.tiles.size > this.max) this.tiles.delete(this.tiles.keys().next().value);
    return t;
  }
  build(tx, ty, s) {
    const t0 = performance.now();
    const px = Math.ceil(TS * s);
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(px, px) : Object.assign(document.createElement('canvas'), { width: px, height: px });
    const g = c.getContext('2d');
    const k = px / TS;
    g.setTransform(k, 0, 0, k, -tx * TS * k, -ty * TS * k);
    const view = { x0: tx * TS - PAD, x1: (tx + 1) * TS + PAD, y0: ty * TS - PAD, y1: (ty + 1) * TS + PAD };
    this.paintTile(g, view, tx, ty);
    c.scale = s;
    const ms = performance.now() - t0;
    this.stats.built++; this.stats.buildMs += ms; this.stats.lastMs = ms;
    return c;
  }
}

/** Paint the whole static ground for a world rect (also used by the full-map preview / minimap builders). */
export function paintGround(g, view, decor) {
  paintWater(g, view);
  paintWilds(g, view);
  paintDunesStatic(g, view);
  paintFrostStatic(g, view);
  paintEmberStatic(g, view);
  paintRiftStatic(g, view);
  if (decor) for (const d of decor) {
    if (d.kind === 'landmark') { drawLandmark(g, d); continue; } // spawn-site landmarks (client/sitesfx.js)
    if (d.frost) { drawFrostDecor(g, d); continue; }
    if (d.ember) { drawEmberDecor(g, d); continue; }
    if (d.rift) { drawRiftDecor(g, d); continue; }
    const a = wpOn() ? (d.dunes ? dunesDecorArt(d) : wildsDecorArt(d)) : null;
    if (a && wpPiece(a.name)) { wpContact(g, d.x, d.y, d.size * 0.8, d.size * 0.3, 0.2); wpPropDirect(g, a.name, d.x, d.y + d.size * 0.15, a.h, a.flip); continue; }
    if (d.dunes) drawDunesDecor(g, d, 0); else paintWildsDecor(g, d);
  }
}

/** Merged tree-canopy layer (perf pass 2): every canopy overlapping a 512 tile is painted into that tile once; tiles with
 *  no trees are skipped. Drawn above the characters; render.js cuts a see-through bubble around a player under a tree. */
export class CanopyCache extends GroundCache {
  constructor(opts = {}) { super(opts); this.decorOff = true; this.skipEmpty = true; }
  wantObs(o) { return (o.kind === 'tree' && !o.dunes && !o.tomb && !o.town && !o.frost && !o.ember && !o.rift) || (o.kind === 'pine' && o.frost); }
  obsReach(o) { return (o.size || 40) * 1.45 + 8; }
  paintTile(g, view, tx, ty) { const obs = this.obsGrid && this.obsGrid.get(tx + ',' + ty); if (obs) for (const o of obs) { if (o.frost) drawPineTop(g, o); else if (!paintedObs(o)) drawTreeD(g, o, 1); } }
}
