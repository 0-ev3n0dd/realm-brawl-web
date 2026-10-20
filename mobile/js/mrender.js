// Phone-tuned renderer and effects, built on the desktop Renderer/FX (no changes to them):
//  - world resolution decoupled from devicePixelRatio (1.5 / 1.25 / 1 by quality level; HUD native: perf.js)
//  - camera zoom chosen so a small landscape screen still shows ~600 world units of height
//  - the static ground (zones, grid, plaza, arena floor, grass tufts, bushes) is painted once into
//    512x512 world-unit tiles on offscreen canvases and blitted each frame (LRU cache)
//  - MobileFX thins out particles when the adaptive quality drops
import { Renderer } from '../../js/client/render.js';
import { FX } from '../../js/client/fx.js';
import { GroundCache } from '../../js/client/ground.js';
import { setSpriteScale } from '../../js/client/sprite.js';
import { clamp } from './touch.js';
import { worldDpr, RES_CAP } from './perf.js';

const CAMERA = { near: 500, normal: 590, far: 700 };

/** Visible world height for a screen height h (CSS px): phones ~590, tablets up to ~820. */
export function worldHeightFor(h, camera = 'normal') {
  const base = CAMERA[camera] || CAMERA.normal;
  return base + clamp((h - 430) / 370, 0, 1) * 230;
}

export class MobileRenderer extends Renderer {
  constructor(canvas, opts = {}) {
    super(canvas);
    this.quality = opts.quality ?? 2;
    this.camera = opts.camera || 'normal';
    this.tileStats = { built: 0, buildMs: 0 };
    this.sim = null;
  }
  dprCap() { return RES_CAP[this.quality] ?? 1.5; }
  resize() {
    const dpr = worldDpr(window.devicePixelRatio || 1, this.quality, this.dyn || 1); // (perf pass: decoupled from the DPR, mobile/js/perf.js)
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr; this.w = w; this.h = h;
    this.cam.zoom = h / worldHeightFor(h, this.camera);
    setSpriteScale(this.cam.zoom * dpr);
  }
  draw(sim, local, alpha, fx, hover) { this.sim = sim; super.draw(sim, local, alpha, fx, hover); }

  // ---- ground: the shared tile cache (client/ground.js), capped to this quality level's pixel ratio
  drawGround(ctx, view, sim) {
    if (!this.ground || this.ground.scaleCap !== this.dprCap()) this.ground = new GroundCache({ scaleCap: this.dprCap(), max: 26 });
    super.drawGround(ctx, view, sim || this.sim);
    this.tileStats = this.ground.stats;
  }
}

/** Effects with a particle budget that shrinks when the phone struggles. */
export class MobileFX extends FX {
  constructor() { super(); this.partMul = 1; this.maxParts = 700; }
  add(p) {
    if (this.parts.length >= this.maxParts) return;
    if (this.partMul < 1 && p.type !== 'slash' && p.type !== 'ring' && p.type !== 'trail' && p.type !== 'crack' && p.type !== 'ghost' && p.type !== 'dashclone' && p.type !== 'arc' && p.type !== 'wslash' && p.type !== 'bolt' && p.type !== 'pillar' && p.type !== 'tri' && p.type !== 'ink' && Math.random() > this.partMul) return;
    super.add(p);
  }
  setQuality(q) { this.partMul = [0.35, 0.65, 1][q] ?? 1; this.maxParts = [220, 420, 700][q] ?? 700; }
}
