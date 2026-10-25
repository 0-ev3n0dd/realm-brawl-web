import './shadowfx.js'; // (Part B: the Shadow Duel mirror's look)
import { drawAscAura, drawAscAlt, drawAscTrim, drawAscMantle } from './ascfx.js';
import { savageAura, drawSavageAura } from './savagefx.js'; // (Part B: the Ascended astral layer)
import { drawFissureGround } from './fissurefx.js';
import { drawMobA3 } from './mobfx.js';
import { CUE_RGB, areaCue, drawAreaCue, drawTele } from './telefx.js'; // (the game-wide telegraph colour grammar)
import { canvasPref } from './perf.js';
import { heroOf } from '../sim/heroes.js';
import { playerLabel, heroSubtitle } from '../sim/acctname.js';
import { drawSiteArea, drawSpear, wardBubble, drawSwarmUnder } from './sitesfx.js';
import { reportLoad } from './perf.js';
import { drawText } from './textcache.js';
// World renderer (camera space). Reads sim state read-only; never mutates it.
import { uiOn, uiIcon, hasIcon } from './uipaint.js';
const ST_ICON = { chal: 'mark', quarry: 'quarry', burn: 'burn', condemn: 'condemn', bleed: 'bleed', cut: 'cut', pp: 'pp', impaled: 'impaled', scorch: 'scorched' }; // enemy stacks → B1 / B2 icons (painted)
import { ZONES, WORLD_R, BOSS_POS, BOSS_ARENA_R } from '../sim/constants.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { CLASSES } from '../sim/data/classes.js';
import { RAGE } from '../sim/combat.js';
import { KNOCKUPS } from './fx.js';
import { drawSpirit } from './fxmonk.js';
import { drawDragon, drgLift, drawSkyAura } from './fxdragoon.js';
import { drawSongAura, drawArcanaHalo } from './fxarcana.js'; // Bard songs on any hero + the Summoner / Bard ult-window art
import { bloom, mote } from './fxglow.js';
import { drawRaidGround, drawRaidUnder, drawRaidOver } from './raidfx.js';
import { drawAstralSky } from './astralui.js';
import { drawAstralBossTele } from './astralbossfx.js';
import { encCineTick, encCamera, drawEncOver } from './encountercine.js'; import { nefSongTick } from './neferakhsong.js'; // (encounter revamp Part 0: set pieces + cine moments)
import { DC, duelCineTick, duelCamera, drawDuelFloor, drawDuelOver, duelHeroLift, duelCineSnap } from './duelcine.js'; // (Part B3: the Shadow Duel cinematics)
import { drawAstraelGround, drawAstraelUnder, drawAstraelOver, drawAstraelEnemy, astCamera } from './astraelfx.js';
import { enemyTop } from './enemypaint.js';
import { inAstArea } from '../sim/astraelconst.js';
import { OPS_Y } from '../sim/opsconst.js';
import { opsHere, opsView, drawOpsGround, drawOpsUnder, opsProps, drawOpsProp, drawGatesUnder, drawGateArch } from './opsfx.js'; // mission dungeons
import { drawOpsArea, drawMissionOver, drawEgg } from './missionfx.js'; // missions revamp: hazards, telegraphs, storms, eggs
import { drawPylon } from './missionfx2.js';
import { drawRig } from './missionfx3.js';
import { CAP_RIGS, CAP_QUARRY } from '../sim/opsconst.js';
import { trialAt } from '../sim/trialconst.js';
import { drawTrialGround, drawTrialUnder, drawTrialOver, trialLoad } from './trialfx.js';
import { drawUltGround, drawUltUnder } from './ultfx.js'; // Part F: the Ultimate
import { drawGearUnder } from './gearfx.js';
import { drawTownGround, townSprites, drawTownSprite, drawTownOver } from './townfx.js';
import { drawDunesLive, drawDunesObstacle, drawDunesUnder, drawDunesOver, drawDunesProjectile, drawGatePlaza, drawGateOver, setGateUnlocks } from './dunesfx.js';
import { drawTombGround, drawTombDecor, drawTombObstacle, drawTombUnder, drawTombOver } from './tombfx.js';
import { drawFrostLive, drawFrostObstacle, drawFrostUnder, drawFrostOver, drawFrostArea, drawFrostProjectile, FROST_TALL } from './frostfx.js'; // Frostveil Peaks (world expansion 1)
import { drawCryptGround, drawCryptUnder, drawCryptOver } from './cryptfx.js'; // the Glacier Crypt
import { drawGlowGround, drawGlowUnder } from './glowfx.js'; // the Glowmire Hollow + the Stormcrown Tor
import { drawRiftLive, drawRiftObstacle, drawRiftOver, drawRiftArea, RIFT_TALL } from './riftfx.js'; // the Astral Rift (game loop C3)
import { drawEmberLive, drawEmberObstacle, drawEmberUnder, drawEmberOver, drawEmberArea, drawEmberProjectile, EMBER_TALL } from './emberfx.js'; // Emberdeep Caldera (world expansion 2)
import { drawForgeGround, drawForgeUnder, drawForgeOver } from './forgefx.js'; // the Forge of Cinders
import { CanopyCache, BAKED_OBS, GroundCache, paintedObs } from './ground.js';
import { tavernOn, drawTavernGround, tavernSprites, drawTavernSprite, drawTavernOver, tavernCamera, setTavernUnlocks } from './tavernfx.js';
import { inTownArea as inTownA } from '../sim/townconst.js';
import { wpOn, wpPiece, wpSize, drawPaintedProp, drawBagPainted } from './worldpaint.js';
import { setSpriteScale, LitBuffer, glowSprite, spriteFrame } from './sprite.js';
import { HeroSmoother } from './smooth.js';
const HERO_BUF = new LitBuffer();
// cached glow sprite / layered-stroke halo: the replacements for shadowBlur glows (perf pass 2)
const glowAt = (ctx, x, y, col, r) => { if (typeof col !== 'string' || !/^#[0-9a-f]{6}$/i.test(col)) return; const c = glowSprite(col, Math.max(8, Math.round(r / 4) * 4)), a = ctx.globalAlpha; ctx.globalAlpha = a * 0.45; ctx.drawImage(c, x - c.ox, y - c.oy, c.sw, c.sh); ctx.globalAlpha = a; };
function haloStroke(ctx, col, w, blur) { const a = ctx.globalAlpha, ss = ctx.strokeStyle, lw = ctx.lineWidth; ctx.strokeStyle = col; ctx.globalAlpha = a * 0.16; ctx.lineWidth = w + blur * 1.3; ctx.stroke(); ctx.globalAlpha = a * 0.3; ctx.lineWidth = w + blur * 0.55; ctx.stroke(); ctx.globalAlpha = a; ctx.strokeStyle = ss; ctx.lineWidth = lw; }
const bloomGlow = (ctx, col) => { const c = glowSprite(col, 22); ctx.drawImage(c, -c.sw / 2 - 12, -c.sh / 2, c.sw, c.sh); };
const HERO_LIT = { rim: 0.5, ao: 0.3, shade: 0.14 };
import './wildmobs.js';
import { drawWildsLive, wildsVisible } from './wildsfx.js';
import { drawWildsObstacle, drawWildsTall, WILDS_TALL, drawTreeD } from './wildprops.js';
import { heroJump, heroShadow } from './art.js';
import { emblemFor, drawMasteryEmblem } from './masteryfx.js';
import { drawUltAura, drawUltRegalia, drawQuillfire } from './ultlook.js';
import { evadeFlashOn, drawEvadeGlow, drawSprintFx } from './sprintfx.js';
import { hasUltPrestige } from '../sim/ultreward.js';
import { paintedActive, PAINTED_TOP, PAINT_FX } from './heropaint.js';
import { INK, circle, shade, drawHero, drawEnemy, drawTree, drawTreeShadow, drawRock, drawPillar, drawBush, drawBag, rrect } from './art.js';

const TAU = Math.PI * 2;
export const ZONE_GROUND = ['#8fd664', '#72c44e', '#a9b95b', '#cfa862', '#7e6b88'];
const WATER = '#3fa9e0';

function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

import { GLLayer, glPref } from './gl/glcore.js';
import { GLCtx } from './gl/glctx.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', canvas.id === 'game' && canvasPref.cpu() ? { willReadFrequently: true } : undefined); // (Firefox: software Canvas2D, perf.js canvasPref)
    // glow gate (perf pass 2): every shadowBlur in the game goes through here; below the top quality levels the adaptive
    // governor turns blurred glows off entirely (software raster pays per blurred pixel), cached glow sprites stay
    this.glowOK = true;
    try {
      const D = typeof CanvasRenderingContext2D !== 'undefined' && Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur'), self = this;
      if (D && D.set && this.ctx) Object.defineProperty(this.ctx, 'shadowBlur', { configurable: true, get() { return D.get.call(this); }, set(v) { D.set.call(this, self.glowOK ? v : 0); } });
    } catch (e) { /* (stub contexts in node tests) */ }
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.time = 0;
    this.lastDrawCounts = {};
  }

  resize() {
    const dpr0 = Math.min(2, window.devicePixelRatio || 1), dpr = dpr0 * (this.renderScale || 1); // renderScale: the adaptive governor's resolution (client/perf.js)
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    if (this.canvas.style) { this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px'; }
    this.dpr = dpr; this.w = w; this.h = h;
    this.cam.zoom = Math.max(0.75, Math.min(1.5, h / 760)) * 1.12;
    setSpriteScale(this.cam.zoom * Math.max(dpr, dpr0 * 0.75)); // (sprites keep near-full res: a resolution step does not flush the sprite cache much)
  }

  screenToWorld(sx, sy) { const E = this.eff || this.cam, z = E.zoom; return { x: (sx - this.w / 2) / z + E.x, y: (sy - this.h / 2) / z + E.y }; }
  worldToScreen(x, y) { const E = this.eff || this.cam, z = E.zoom; return { x: (x - E.x) * z + this.w / 2, y: (y - E.y) * z + this.h / 2 }; }

  /** Frame: the Astrael cinematic camera (zoom + pan, smoothed) wraps the normal scene draw. */
  draw(sim, local, alpha, fx, hover) {
    // a governor resolution step is applied here, right before the redraw (resizing a canvas clears it: done at the end of a
    // frame it presented one blank / black frame per quality step = a visible flicker)
    if (this.wantScale != null && this.wantScale !== this.renderScale) { this.renderScale = this.wantScale; this.resize(); }
    if (!Number.isFinite(this.cam.x) || !Number.isFinite(this.cam.y)) { this.cam.x = local && Number.isFinite(local.x) ? local.x : 0; this.cam.y = local && Number.isFinite(local.y) ? local.y : 0; this.cam.vx = this.cam.vy = 0; }
    const dt = Math.min(0.1, Math.max(0, this.time - (this.astT ?? this.time))); this.astT = this.time;
    DC.rend = this; duelCineTick(dt, sim, local); const dcm = DC.seq || DC.clash ? duelCamera(sim, local) : null;
    encCineTick(dt, sim); nefSongTick(sim, local); const ecm = dcm ? null : encCamera(sim, local);
    const ac = dcm || ecm || astCamera(this, sim, local, dt), cx = this.cam.x, cy = this.cam.y, cz = this.cam.zoom;
    const zk = Number.isFinite(fx.zoomK) ? Math.max(0, Math.min(0.3, fx.zoomK)) : 0; this.cam.zoom = cz * ac.z * (1 + zk); this.cam.x = cx + (ac.x - cx) * ac.k; this.cam.y = cy + (ac.y - cy) * ac.k;
    if (local && tavernOn(sim) && inTownA(local.x, local.y)) tavernCamera(this.cam, this.w, this.h); // the hall framed (no void past its walls)
    this.eff = { x: this.cam.x, y: this.cam.y, zoom: this.cam.zoom };
    try { this.drawScene(sim, local, alpha, fx, hover); } finally { this.cam.x = cx; this.cam.y = cy; this.cam.zoom = cz; }
    if (this.astral && !DC.seq) drawAstralSky(this.ctx, this.w, this.h, this.time); // (Part C: the Astral World's starlit veil)
    if (DC.snapWant) duelCineSnap(this.ctx.canvas, this.w, this.h); // (B3: the glass shatter takes this frame)
  }
  drawScene(sim, local, alpha, fx, hover) {
    spriteFrame();
    const ctx = this.ctx, z = this.cam.zoom;
    // frame dt for the render-side smoothing (client/smooth.js): eased facing, walk blend
    this.fdt = Math.min(0.1, Math.max(0, this.time - (this._ft ?? this.time))); this._ft = this.time;
    const hsm = this.heroSm || (this.heroSm = new HeroSmoother()); hsm.sweep();
    const shake = fx.shakeOffset(this.time); this._shake = shake; this._glUsed = false; this._glTown = null;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; if (ctx.filter !== undefined && ctx.filter !== 'none') ctx.filter = 'none'; // (no state leak from the last frame's HUD / overlays can hide the ground)
    ctx.save();
    ctx.translate(this.w / 2 + (Number.isFinite(shake.x) ? shake.x : 0), this.h / 2 + (Number.isFinite(shake.y) ? shake.y : 0));
    ctx.scale(z, z);
    ctx.translate(-this.cam.x, -this.cam.y);
    const vw = this.w / z / 2 + 120, vh = this.h / z / 2 + 120;
    const view = { x0: this.cam.x - vw, x1: this.cam.x + vw, y0: this.cam.y - vh, y1: this.cam.y + vh };
    const inView = (x, y, r) => x + r > view.x0 && x - r < view.x1 && y + r > view.y0 && y - r < view.y1;

    const inTrial = !!(local && local.y < -28000 && trialAt(local.x, local.y)); // the Skaldra / Pyrrhex trial arenas cover the view like the Star Sanctum
    const inOps = !!(local && local.y < OPS_Y && opsHere(local)); // a mission dungeon arena covers the view too (client/opsfx.js)
    const inAst = local && (inAstArea(local.x, local.y) || inTrial || inOps);
    if (inOps) drawOpsGround(ctx, view, this.time, sim, local);
    const inUl = inTrial && trialAt(local.x, local.y) === 'ul';
    if (inUl) drawUltGround(ctx, view, this.time, sim); else if (inTrial) drawTrialGround(ctx, view, this.time, sim, local); // (client/trialfx.js: the frozen lake / the heart-chamber)
    if (!inAst) this.drawGround(ctx, view, sim); // cached ground tiles (client/ground.js) + live Wilds overlays (the Star Sanctum's sky covers the whole view)
    drawAstraelGround(ctx, view, this.time, sim, this.quality ?? 2); if (DC.arena) drawDuelFloor(ctx, sim, local, this.time); // The Star Sanctum (Astrael): night sky, disc / platforms / zodiac clock
    drawRaidGround(ctx, view, this.time, sim); // The Rift Sanctum (Vorthax's floating arena) when it's in view
    const tav = tavernOn(sim); // the hub layout: the painted tavern hall (Art style = Painted, co-op: the host's) or the village
    const townOn = !inAst && (tav ? drawTavernGround(ctx, view, this.time) : this._glTown != null ? this._glTown : drawTownGround(ctx, view, this.time)); // (B1: already drawn on the GL layer when _glTown is set) // the hub (client/tavernfx.js | client/townfx.js)
    { const lu = (local && local.unlocks) || {}, hu = sim.hubU || {}; const gu = { dunes: !!(lu.dunes || hu.dunes), frost: !!(lu.frost || lu.tomb || hu.frost), ember: !!(lu.ember || lu.crypt || hu.ember), rift: !!(lu.rift || lu.forge || lu.pyt || hu.rift) }; setGateUnlocks(gu); setTavernUnlocks(gu); }
    if (townOn && !tav && this._glTown == null) drawGatePlaza(ctx, this.time); // the Realm Gate plaza (portals to the Wilds / the Dunes)
    const dunesOn = !inAst && drawDunesLive(ctx, view, this.time); // Sunscorch Dunes live overlays (the static sand is in the tile cache)
    const tombOn = !inAst && drawTombGround(ctx, view, this.time, sim); // the Tomb of the Sun-Eaten King (client/tombfx.js)
    const frostOn = !inAst && drawFrostLive(ctx, view, this.time); // Frostveil live overlays (hearth fire, shrine glow; the snow is baked)
    const glowOn = !inAst && drawGlowGround(ctx, view, this.time, sim); // the Glowmire grottoes, the Moonlit Bower, the Tor
    const cryptOn = !inAst && drawCryptGround(ctx, view, this.time, sim); // the Glacier Crypt vaults + Osric's chessboard
    const emberOn = !inAst && drawEmberLive(ctx, view, this.time); // Emberdeep live overlays (lava glow, vents; the ash is baked)
    const riftOn = !inAst && drawRiftLive(ctx, view, this.time); // the Astral Rift live overlays (tears shimmer, the camp beacon, starwells)
    const forgeOn = !inAst && drawForgeGround(ctx, view, this.time, sim); // the Forge halls + Hephast's foundry belts
    if (tombOn) for (const d of sim.world.decor) { if (d.tomb && inView(d.x, d.y, d.size * 2 + 40)) drawTombDecor(ctx, d, this.time); }

    // telegraph / AoE areas under entities
    for (const a of sim.areas) if (inView(a.x, a.y, (a.r || a.len || 100) + 20)) this.drawArea(ctx, a, sim);
    for (const a of sim.areas) if (a.beats && a.team === 'enemy' && a.t < a.delay && inView(a.x, a.y, (a.r || 100) + 20)) drawBeat(ctx, a);
    drawAstraelUnder(ctx, sim, local, this.time); // Astrael: telegraphs, constellations, suns, comets, planets, crowns
    drawGearUnder(ctx, this.time); // Trial / Extreme procs + set mechanics on the floor (client/gearfx.js)
    if (inUl) drawUltUnder(ctx, sim, local, this.time); else if (inTrial) drawTrialUnder(ctx, sim, local, this.time); // trials: numbered drops, beams, valves, braziers, pillars, rings
    drawRaidUnder(ctx, sim, local, this.time); // raid telegraphs (red danger / green safe / magenta lance), stack + spread markers, rift portals
    if (dunesOn) drawDunesUnder(ctx, sim, local, this.time, view); // Tomb portals + Solar Glyphs
    if (tombOn) drawTombUnder(ctx, sim, local, this.time); // rising dead, the bonus chest, Neferakh's telegraphs
    if (frostOn) drawFrostUnder(ctx, sim, local, this.time, view); // Glacier Crypt portals
    if (glowOn) drawGlowUnder(ctx, sim, local, this.time); // pods, dust lanes, the chest, the boss telegraphs
    if (cryptOn) drawCryptUnder(ctx, sim, local, this.time); // icicle shadows, the reliquary, Osric's tile telegraphs
    if (emberOn) drawEmberUnder(ctx, sim, local, this.time, view); // Forge of Cinders portals
    if (forgeOn) drawForgeUnder(ctx, sim, local, this.time); // slag shadows, the strongbox, the pour mould / drop hammers / tongs
    if (inOps) drawOpsUnder(ctx, sim, local, this.time, !!fx.lite, view); // the relic + sockets + charge ring, terminals, gates, exits, pads, the Swarm ring
    else if (!inAst && !sim.noPortals) drawGatesUnder(ctx, sim, view, this.time); // the fixed mission entrances (platforms)
    drawFissureGround(ctx, sim, this.time, view); // Astral Fissures (client/fissurefx.js)
    drawAstralBossTele(ctx, sim, this.time, view); // Part C2: the Astral boss layer (client/astralbossfx.js)
    drawSwarmUnder(ctx, sim, this.time, view); // Swarm event: the marker, the wave ring, the bonus chest (client/sitesfx.js)
    const LF = fx.loot; if (LF) LF.me = local;
    for (const b of sim.bags) if (b.ownerId === local.id && !(LF && LF.owns(b.id)) && inView(b.x, b.y, 40)) { if (!drawBagPainted(ctx, b.x, b.y, b.rarity, this.time)) drawBag(ctx, b.x, b.y, b.rarity, this.time); }
    if (LF) LF.draw(ctx, view, this.time); // loot showers: coins, orbs, gear gems + rarity beams, the vacuum pull (client/lootfx.js)

    // rocks & bushes (static, drawn under characters)
    const obs = this.visibleObstacles(sim.world, view), tall = [];
    const pw = wpOn() && wildsVisible(view) && !!wpPiece('tree_oak'); this.paintedWilds = pw;
    for (const o of obs) {
      if (o.dunes || o.tomb || o.town || o.frost || o.crypt || o.ember || o.forge || o.rift) continue;
      if (pw) { const a = paintedObs(o); if (a) { if (inView(o.x, o.y - a.h * 0.5, a.h * 0.6 + o.size)) tall.push({ kind: 'wpaint', o, a, y: o.y }); continue; } }
      if (!inView(o.x, o.y, o.size + 20)) continue;
      if (WILDS_TALL.has(o.kind)) { if (inView(o.x, o.y - o.size, o.size * 3)) tall.push({ kind: 'wprop', o, y: o.y }); continue; }
      if (BAKED_OBS.has(o.kind)) continue; // (baked into the ground tiles: client/ground.js)
      if (!drawWildsObstacle(ctx, o)) { if (o.kind === 'rock') drawRock(ctx, o); else if (o.kind === 'pillar') drawPillar(ctx, o); else if (o.kind === 'tree') drawTreeShadow(ctx, o); }
    }
    const dprops = tall;
    if (inOps) { const op = opsProps(local, view, sim); if (op) dprops.push(...op); }
    else if (!inAst && !sim.noPortals && sim.world.opsGates) for (const g of sim.world.opsGates) if (inView(g.x, g.y - 80, 220)) dprops.push({ kind: 'ogate', g, y: g.y });
    if (dunesOn || tombOn) for (const o of obs) if ((o.dunes || o.tomb) && inView(o.x, o.y - o.size, o.size * 3 + 40)) dprops.push({ kind: 'dprop', o, y: o.y + (o.r || 0) * 0.4 });
    if (frostOn || cryptOn) for (const o of obs) if ((o.frost || o.crypt) && FROST_TALL.has(o.kind) && inView(o.x, o.y - o.size, o.size * 3 + 40)) dprops.push({ kind: 'dprop', o, y: o.y + (o.r || 0) * 0.4 });
    if (riftOn) for (const o of obs) if (o.rift && RIFT_TALL.has(o.kind) && inView(o.x, o.y - o.size, o.size * 3 + 40)) dprops.push({ kind: 'dprop', o, y: o.y + (o.r || 0) * 0.4 });
    if (emberOn || forgeOn) for (const o of obs) if ((o.ember || o.forge) && EMBER_TALL.has(o.kind) && inView(o.x, o.y - o.size, o.size * 3 + 40)) dprops.push({ kind: 'dprop', o, y: o.y + (o.r || 0) * 0.4 });

    this.fxLite = !!fx.lite;
    if (fx.drawUnder) fx.drawUnder(ctx, view, this.time); // Eclipse finishers: darkness + the eclipsed moon, under the characters

    // characters sorted by y
    const lerp = (a, b) => a + (b - a) * alpha;
    const ents = [];
    for (const e of sim.enemies) { const top = enemyTop(e); if (top ? inView(e.x, e.y - top * 0.5, Math.max(e.r * 2, top * 0.75)) : inView(e.x, e.y, e.r * 2)) ents.push(e); } // (painted enemies are tall: cull on the whole figure)
    let heroes = 0; for (const p of sim.players.values()) if (!p.dead) { ents.push(p); if (inView(p.x, p.y, 60)) heroes++; }
    this.heroCount = heroes; reportLoad(ents.length - heroes, heroes, fx.parts ? fx.parts.length : 0, sim.areas.length + (inTrial ? trialLoad(sim) / 2 : 0), local && local.x, local && local.y); // (adaptive quality: client/perf.js)
    if (townOn) ents.push(...(tav ? tavernSprites(view, local) : townSprites(view, local)));
    if (dprops.length) ents.push(...dprops); // Dunes / Tomb props are y-sorted with the characters (tall obelisks, pillars, cacti)
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) {
      if (e.kind === 'townprop') { drawTownSprite(ctx, e, this.time, local); continue; }
    if (this._shades && this._shades.length) { for (const h of this._shades) this.drawShade(ctx, h); this._shades.length = 0; } // boss-form shadows on top of the y-sorted characters (a shadow cutting through a boss stays visible)
      if (e.kind === 'tavprop') { drawTavernSprite(ctx, e, this.time, local); continue; }
      if (e.kind === 'oprop') { drawOpsProp(ctx, e); continue; }
      if (e.kind === 'ogate') { drawGateArch(ctx, e.g, this.time, local); continue; }
      if (e.kind === 'wprop') { drawWildsTall(ctx, e.o); continue; }
      if (e.kind === 'wpaint') { drawPaintedProp(ctx, e.a, e.o.x, e.o.y, this.propFade(e.o, e.a, local)); continue; }
      if (e.kind === 'dprop') { if (!drawRiftObstacle(ctx, e.o, this.time) && !drawEmberObstacle(ctx, e.o, this.time) && !drawFrostObstacle(ctx, e.o, this.time) && !drawDunesObstacle(ctx, e.o, this.time)) drawTombObstacle(ctx, e.o, this.time); continue; }
      const x = lerp(e.px ?? e.x, e.x), y = lerp(e.py ?? e.y, e.y);
      if (e.kind === 'player') {
        const a = e.action;
        if (e.aura > 0) this.holyAura(ctx, x, y);
        const big = paintedActive(e.cls), F = (kind, fn) => this.heroFx(ctx, x, y, big, kind, fn);
        if (e.rage > 0) this.rageAura(ctx, x, y, big);
        if (e.eclipse) F('ground', () => this.eclipseAura(ctx, x, y, e)); // Eclipse: a dark crescent halo around the dancer
        const stealthed = e.stealth > 0; // Vanish: faint shimmer for yourself, almost invisible to other players
        if (stealthed) { ctx.save(); ctx.globalAlpha = e.id === local.id ? 0.38 + 0.08 * Math.sin(this.time * 9) : 0.1; }
        const rageHot = !(e.rage > 0) && (e.rageHot || (CLASSES[e.cls] && CLASSES[e.cls].rageRes && e.res >= 50)); // Warrior with 50+ Rage: embers (a hold spends it)
        if (rageHot && !stealthed) F('ground', () => this.rageHotAura(ctx, x, y, e));
        if (e.cls === 'monk') { // Monk: a golden chi aura that brightens with the hit-counter tier; the Awakened Spirit towers behind in the ult window
          const hc = e.monk ? e.monk.hc : (e.mhc || 0), tier = hc >= 20 ? 2 : hc >= 10 ? 1 : 0;
          if (e.uw) drawSpirit(ctx, x, y, a && a.ang != null ? a.ang : e.aim || 0, this.time, 0.8 + 0.1 * Math.sin(this.time * 4), a && (a.kind === 'skill' || a.kind === 'basic') ? Math.min(1, (a.t % 6) / 3) : 0, 1.3);
          if ((hc > 0 || e.uw) && !stealthed) F('ground', () => this.chiAura(ctx, x, y, e.uw ? 2 : tier, hc));
        }
        let lift = null;
        if (e.cls === 'dragoon') { // Dragoon: the dragon spirit coils around him in Dragon Form; airborne moves lift him off the ground (or off the screen)
          lift = drgLift(a);
          if (e.uw) drawDragon(ctx, x, y - (lift ? Math.min(lift.h, 260) : 0), a && a.ang != null ? a.ang : e.aim || 0, this.time, 0.85, 1, e.id);
          if (lift && !stealthed) { ctx.save(); ctx.globalAlpha = 0.35 * Math.max(0.25, 1 - lift.h / 900); ctx.fillStyle = '#0d0820'; ctx.beginPath(); const sr = 20 * Math.max(0.35, 1 - lift.h / 1200); ctx.ellipse(x, y + 14, sr * 1.3, sr * 0.5, 0, 0, TAU); ctx.fill(); ctx.restore(); }
        }
        if (!lift && (DC.lift > 0 || DC.hideHero) && local && e.id === local.id) lift = duelHeroLift(); // (B3: the fall / the rise)
        if (e.songs && !stealthed) F('ground', () => drawSongAura(ctx, { x, y, r: e.r || 18, songs: e.songs }, this.time, fx.lite)); // Bard songs (on allies too)
        if ((e.cls === 'summoner' || e.cls === 'bard') && !stealthed) F('body', () => drawArcanaHalo(ctx, x, y, e, this.time, fx.lite)); // floating grimoire pages / notes; the big book or spotlight in the ult window
        if (e.uw && e.cls !== 'monk' && e.cls !== 'dragoon' && e.cls !== 'summoner' && e.cls !== 'bard' && !(e.rage > 0) && !(e.aura > 0)) F('ground', () => this.windowAura(ctx, x, y, e.cls)); // ult window (Ranger / Mage): route-ready halo
        if (e.cst && !stealthed) { if (e.cls === 'dragoon') drawSkyAura(ctx, x, y - (lift ? Math.min(lift.h, 300) : 0), this.time); else F(e.cls === 'samurai' || e.cls === 'cleric' ? 'ground' : 'body', () => this.stateAura(ctx, x, y, e.cls)); }
        const chg = e.charging || (e.holdKey && CLASSES[e.cls] && CLASSES[e.cls].rageRes && e.holdT >= CLASSES[e.cls].rageRules.tap && (e.rage > 0 || e.res >= CLASSES[e.cls].rageRules.min));
        if (chg && !stealthed) F('body', () => this.chargeAura(ctx, x, y, e)); // Warrior holding a skill: Rage charging up
        if (!stealthed && !(e.rage > 0) && (e.empowered || (a && a.data && a.data.hold))) F('body', () => this.empowerAura(ctx, x, y)); // (not in Berserk: every hit is empowered there and the Berserk aura already shows it)
        if (e.cls === 'warrior' && e.wm && !stealthed) F('ground', () => this.stanceAura(ctx, x, y, e));
        if (e.ascAll && !stealthed) F('ground', () => drawAscMantle(ctx, x, y, this.time)); // (Part D: all ten Ascended)
        if (!stealthed && savageAura(e)) F('ground', () => drawSavageAura(ctx, x, y, this.time, fx.lite)); // (Part 0S: a Savage cleared)
        if (e.asc && !stealthed) F('ground', () => drawAscAura(ctx, x, y, e.cls, this.time, e.asc, fx.lite)); // (Part B: Ascended; Part D: by rank)
        if (e.sprint && !stealthed && !e.dead) F('ground', () => drawSprintFx(ctx, x, y, e.aim ?? 0, this.time, fx.lite)); // (sprint: dust + streaks)
        const ulx = !stealthed && hasUltPrestige(e); if (ulx) F('ground', () => drawUltAura(ctx, x, y, this.time, fx.lite)); // (Part F3: the Ultimate's Unwritten Pages)
        if (!stealthed) { const em = emblemFor(e); if (em) F('ground', () => drawMasteryEmblem(ctx, x, y, em, this.time, fx.lite)); } // game loop B1: the Mastery sigil (rank 5 / 10 / 15 / 20)
        if (lift) { ctx.save(); ctx.translate(0, -lift.h); if (lift.hide) ctx.globalAlpha = 0; }
        // facing = the action's aim (attacks / skills / chains / Special / ult) else the aim, eased along the shortest arc;
        // the action clock + hit flash advance between sim ticks (sub = the tick fraction: solo alpha, online the local hero's)
        const sm = hsm.update(e, this.fdt), sub = sim.subT != null ? (e.id === local.id ? sim.subT : 0) : alpha, live = sub > 0 && !(e.hitstop > 0);
        const at = a ? (live ? Math.min(a.dur ?? 1e9, a.t + sub) : a.t) : 0;
        const heroArg = {
          wst: e.wm ? e.wm.st : null, surge: !!(e.wm && e.wm.surge > 0), sheathed: e.cls === 'samurai' && (!!e.cst || (a && a.id === 'sheathe' && a.t >= 6)), uw: !!e.uw,
          key: e.id, x, y, ang: sm.ang, moveK: sm.walk, cls: e.cls, app: e.appearance, time: this.time,
          anim: a ? { kind: a.kind, id: a.id, chain: a.chain ? a.chain.id : null, idx: a.idx, t: at, dur: a.dur, hit: a.spec ? a.spec.hit : 0 } : null,
          scale: e.rage > 0 ? 1.38 : 1.15, flash: e.flash > 0 ? Math.max(0, e.flash - (live ? sub : 0)) : 0, iframes: (e.iframes > 0 && (e.evade > 0 || !a || a.kind === 'dodge' || a.id === 'blink' || a.id === 'dashshot' || a.id === 'flicker' || a.id === 'thousandcuts' || a.id === 'vanish')), moving: e.moving, // (evade > 0: an evasive dash - the same i-frame look as Dodge)
          glow: e.perfectCrit > 0 || rageHot, rage: e.rage > 0,
        };
        if (e.shd) { // boss form (sim/skillform.js): the shadow plays the skill, the hero holds a ready stance
          (this._shades || (this._shades = [])).push({ ...heroArg, x: e.shd[0], y: e.shd[1], iframes: 0, glow: false, scale: (heroArg.scale || 1.15) * 1.08 });
          heroArg.anim = null;
        }
        this.drawHeroLit(ctx, heroArg);
        { const ek = evadeFlashOn(e.id); if (ek > 0) F('body', () => drawEvadeGlow(ctx, x, y, ek, this.time, fx.lite)); } // (dodge rework: a proper evade's gold flash)
        if (ulx) F('body', () => { const ag = sm.ang; drawUltRegalia(ctx, x, y, ag, this.time, fx.lite); drawQuillfire(ctx, x, y, ag, this.time, fx.lite); }); // (Part F3: the Unwritten Regalia + Quillfire)
        if ((e.asc | 0) >= 5 && !stealthed) F('body', () => drawAscTrim(ctx, x, y, e.cls, this.time, 30)); // (Part D A5: the Starborn trim)
        if (lift) ctx.restore();
        if (stealthed) { if (e.id === local.id) F('body', () => this.stealthRing(ctx, x, y)); ctx.restore(); }
        if (e.shield > 0) F('body', () => this.shieldBubble(ctx, x, y, e));
        if (e.perfectCrit > 0) F('body', () => this.perfectAura(ctx, x, y));
        if (e.id !== local.id && !stealthed && !this.cinematic) this.nameTag(ctx, x, y - (paintedActive(e.cls) ? PAINTED_TOP * (e.rage > 0 ? 1.38 : 1.15) - 8 : 34), e); // (painted heroes are taller: the tag sits over the head)
      } else {
        const ex = { ...e, x, y };
        const ku = KNOCKUPS.get(e.id);
        if (ku) { // knock-up: the enemy hops into the air (its shadow stays on the ground)
          const k = (performance.now() / 1000 - ku.t0) / ku.dur;
          if (k >= 1 || e.dead) KNOCKUPS.delete(e.id);
          else if (k > 0 && !e.boss) { const hop = Math.sin(Math.PI * Math.min(1, k * 1.25)) * Math.min(70, 30 + ku.dur * 40); ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y + e.r * 0.6, e.r * 0.9, e.r * 0.35, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); ex.y = y - hop; }
        }
        if (e.type === 'raidboss' && sim.raid) { ex.raidWard = !!sim.raid.ward; ex.raidLance = (sim.raid.tele || []).some((t) => t.k === 'lance' && !t.done); }
        if (e.type === 'astrael' || e.type === 'astralstar' || e.type === 'astralshard') drawAstraelEnemy(ctx, ex, sim, this.time);
        else if (inOps && e.name === 'Brood Egg') drawEgg(ctx, ex, this.time, (opsHere(local) || {}).biome);
        else if (inOps && e.name && e.name.endsWith(' Pylon')) drawPylon(ctx, ex, this.time, (opsHere(local) || {}).biome); // (Assault shield pylons: client/missionfx2.js)
        else if (inOps && e.name && CAP_RIGS.has(e.name)) drawRig(ctx, ex, this.time, (opsHere(local) || {}).biome); // (Capture escape rigs: client/missionfx3.js)
        else if (inOps && e.r > ENEMIES[e.type].r * (e.elite ? 1.25 : 1) * 1.4) { // a mission boss (the siege / the Queen): its art scaled up to its body
          const K = Math.min(2.6, e.r / (ENEMIES[e.type].r * (e.elite ? 1.25 : 1)));
          ctx.save(); ctx.translate(x, ex.y); ctx.scale(K, K); ctx.translate(-x, -ex.y); ex.r = e.r / K; drawEnemy(ctx, ex, ENEMIES[e.type], this.time); ctx.restore();
        } else if (!this.glOverlay(ctx, 'mobs', (g) => drawEnemy(g, ex, ENEMIES[e.type], this.time), [x, ex.y, e.r * 2.6 + 48])) drawEnemy(ctx, ex, ENEMIES[e.type], this.time); // (Part 5: WebGL monsters when on)
        if (e.esh > 0) wardBubble(ctx, x, ex.y, e.r, this.time); // a site caster's ward (client/sitesfx.js)
        if (e.elite || e.buffT > 0 || e.cmdDebuff > 0 || e.role) drawMobA3(ctx, e, x, ex.y, this.time); // (Part A3: affix crest, mirror shell, buffs: client/mobfx.js)
        const etop = enemyTop(e), barY = etop ? y - etop - 8 : y - e.r - 14; // (painted: the bar / tags sit over the head)
        const opsBig = inOps && (e.r >= 50 || (e.name && (e.name.endsWith(' Pylon') || CAP_RIGS.has(e.name) || CAP_QUARRY.has(e.name)))); // (mission bosses: the HUD carries their bar; pylons / rigs draw their own; the Capture quarry + its decoys look alike: no bar)
        if (!e.boss && !opsBig && (e.hp < e.maxHp || e === hover) && !this.cinematic) this.enemyBar(ctx, x, barY, e);
        if (e.sunder && (e.sunder.t == null || e.sunder.t > 0)) this.sunderIcon(ctx, x, y, e);
        const iy = etop ? y - Math.max(0, etop - e.r - 6) : y; // (painted: debuff icons ride over the taller art)
        if (e.stx) this.stackIcons(ctx, x, iy, e, local);
        if (e.spm && e.spm.t > 0) this.stormMark(ctx, x, iy, e); // Storm of Arrows MARK (+20% damage from the Ranger)
        if (e.mark && e.mark.n > 0) this.markIcons(ctx, x, iy, e, e.mark.pid === local.id);
        if (e.elite && !e.boss && !opsBig && e.name !== 'Brood Egg' && !this.cinematic) drawText(ctx, 'ELITE', x, barY - 13, "13px 'Lilita One', sans-serif", '#ffcf3a', 'center', 4, INK, 13); // (cached bitmap: client/textcache.js)
      }
    }

    // projectiles
    for (const pr of sim.projectiles) {
      const x = lerp(pr.px, pr.x), y = lerp(pr.py, pr.y);
      if (inView(x, y, 30)) this.drawProjectile(ctx, pr, x, y);
    }

    if (sim.sp && sim.sp.length) drawEncOver(ctx, sim, local, this.time); // (set pieces: the blade, the hold circle, the core link)
    drawAstraelOver(ctx, sim, local, this.time); if (DC.seq || DC.clash || DC.stars.length) drawDuelOver(ctx, sim, local, this.time); // Astrael: threads, debuff timers, the mirror clone, the kill dissolve
    drawTrialOver(ctx, sim, local, this.time); // trials: snowballs, tethers, her eye, chill bars, the exit portal
    drawRaidOver(ctx, sim, local, this.time); // Soul Chain tethers
    if (townOn) { if (tav) drawTavernOver(ctx, view, this.time, local); else { drawTownOver(ctx, view, this.time, local); drawGateOver(ctx, this.time, local); } } // town: bunting, tree canopies, the counter's interact ring, the Realm Gates
    if (dunesOn) drawDunesOver(ctx, sim, local, view, this.time); // palm canopies, heat shimmer, drifting grit
    if (frostOn) drawFrostOver(ctx, sim, local, view, this.time, this.fxLite); // snowfall + the Whiteout
    if (cryptOn) drawCryptOver(ctx, sim, local, this.time); // falling icicles
    if (emberOn) drawEmberOver(ctx, sim, local, view, this.time, this.fxLite); // ashfall + heat shimmer
    if (riftOn) drawRiftOver(ctx, sim, local, view, this.time, this.fxLite); // star motes
    if (inOps) { const A = opsHere(local), V = opsView(sim); if (A && V && V.k === A.type) drawMissionOver(ctx, sim, A, V, view, this.time, this.fxLite); } // missions: tracers, pulses, boulders, the biome storm
    if (forgeOn) drawForgeOver(ctx, sim, local, this.time); // falling slag
    if (tombOn) drawTombOver(ctx, sim, local, this.time); // god rays (SUN), darkness with light holes (NIGHT / TWILIGHT), the flip

    // tree canopies on top: one merged canopy layer in 512 tiles (client/ground.js CanopyCache); a player under a tree
    // gets a see-through bubble (the canopy at 45% inside it)
    if (!this.paintedWilds) { // (painted world: trees are upright y-sorted sprites that fade when you walk behind them)
      if (!this.canopy) this.canopy = new CanopyCache(this.groundOpts || {});
      let under = null;
      for (const o of obs) if ((o.kind === 'tree' || o.kind === 'pine') && !o.town && Math.hypot(local.x - o.x, local.y - o.y) < o.size * 1.4 + 10) { under = o; break; }
      const s = this.cam.zoom * (this.dpr || 1);
      if (!under) this.canopy.draw(ctx, view, s, sim.world);
      else {
        const R = Math.max(70, under.size * 1.3);
        ctx.save(); ctx.beginPath(); ctx.rect(view.x0 - 10, view.y0 - 10, view.x1 - view.x0 + 20, view.y1 - view.y0 + 20); ctx.arc(local.x, local.y, R, 0, TAU, true); ctx.clip('evenodd');
        this.canopy.draw(ctx, view, s, sim.world); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.arc(local.x, local.y, R, 0, TAU); ctx.clip(); ctx.globalAlpha = 0.45;
        this.canopy.draw(ctx, { x0: local.x - R, x1: local.x + R, y0: local.y - R, y1: local.y + R }, s, sim.world); ctx.restore();
      }
    }

    fx.view = view;
    if (!this.glOverlay(ctx, 'fx', (g) => fx.draw(g, sim, local))) fx.draw(ctx, sim, local); // (Part 5: WebGL effects when on)
    if (fx.hordeAoe) fx.hordeAoe.draw(ctx, view, this.time); // horde AoE shapes (client/hordeaoefx.js)
    if (LF) LF.drawTop(ctx, view, this.time); // materials stay readable on top of the chain effects (client/lootfx.js)
    ctx.restore();
    fx.rend = this;
    if (fx.postWorld) fx.postWorld(ctx, this); // Heaven-Splitting Palm: the frame splits along the boss
    if (fx.drawScreen) fx.drawScreen(ctx, this, -1); // finisher moments: the glowing pieces go in before the shader so they bloom and swirl
    if (fx.shader) fx.shader.apply(ctx, this, fx); // shader layer: bloom, grade, refraction, aberration, grain
    if (fx.drawScreen) fx.drawScreen(ctx, this, 0); // finisher moments: bars, ink kanji, speed lines (under the HUD)
  }

  /** Heroes through the lit buffer (art pass): rim light / shade wash / occlusion over the whole hero + weapon.
   *  Falls back to a direct draw for big leaps (they leave the buffer), the fast quality level and very busy co-op. */
  /** Boss-form shadow: a dark violet silhouette of the hero performing the skill (the hero stays put). */
  drawShade(ctx, h) { // (drawn into its own buffer and filled solid: ctx.filter is ignored by painted / WebGL hero draws, which left the shadow a faint ghost)
    const W = 440, H = 560, ox = W / 2, oy = 400;
    let c = this._shadeBuf;
    if (!c) { c = this._shadeBuf = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H }); }
    const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, W, H);
    drawHero(g, { ...h, x: ox, y: oy, noShadow: true });
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#1a0f2e'; g.fillRect(0, 0, W, H);
    const t = this.time || 0;
    ctx.save();
    ctx.globalAlpha = 0.45; ctx.fillStyle = '#9b6cff'; ctx.beginPath(); ctx.ellipse(h.x, h.y + 14, 30, 10, 0, 0, Math.PI * 2); ctx.fill(); // violet ground ring
    ctx.globalAlpha = 0.9; ctx.shadowColor = '#b48cff'; ctx.shadowBlur = 14 + 4 * Math.sin(t * 18);
    ctx.drawImage(c, h.x - ox, h.y - oy);
    ctx.restore();
  }

  drawHeroLit(ctx, h) {
    const n = this.heroCount || 1, j = heroJump(h);
    if (!this.litHeroes || paintedActive(h.cls) || (this.quality ?? 2) < 2 || j > 1.1 || n > 4 || h.iframes) return drawHero(ctx, h); // (off by default: the hero draw carries its own shading; the buffer costs ~3 ms/hero in software raster)
    heroShadow(ctx, h);
    const g = HERO_BUF.begin(210);
    drawHero(g, { ...h, x: 0, y: 0, noShadow: true });
    HERO_BUF.end(ctx, h.x, h.y, HERO_LIT);
  }

  /** Painted heroes are ~2.5x taller than the procedural rig the hero-anchored effects were sized for: run `fn` scaled up.
   *  'body' effects (bubbles, halos, bursts) are re-centred on the chest; 'ground' rings grow around the feet. Classic = as is. */
  heroFx(ctx, x, y, big, kind, fn) {
    if (!big) return fn();
    ctx.save();
    if (kind === 'body') { ctx.translate(x, y - 4 - PAINT_FX.lift); ctx.scale(PAINT_FX.body, PAINT_FX.body); ctx.translate(-x, -(y - 4)); }
    else { ctx.translate(x, y + 10); ctx.scale(PAINT_FX.ground, PAINT_FX.ground); ctx.translate(-x, -(y + 10)); }
    try { fn(); } finally { ctx.restore(); }
  }
  /** Other players: name, level + class (class colour) and a small HP bar. */
  nameTag(ctx, x, y, p) {
    const c = CLASSES[p.cls];
    ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK;
    ctx.font = "12px 'Lilita One', sans-serif";
    const sub = `${p.asc ? '✦ Ascended · ' : ''}${heroSubtitle(heroOf(p.cls)) || p.name} · Lv ${p.level || 1}`; // (account names: the player's own name on top, 'Brakka the Warlord · Lv 12' under it)
    ctx.strokeText(sub, x, y - 16); ctx.fillStyle = c ? c.color : '#fff'; ctx.fillText(sub, x, y - 16);
    ctx.font = "15px 'Lilita One', sans-serif";
    const top = playerLabel(p.acct, p.name); ctx.strokeText(top, x, y - 31); ctx.fillStyle = '#fff'; ctx.fillText(top, x, y - 31);
    const max = p.maxHp || (p.stats && p.stats.maxHp) || 1, k = Math.max(0, Math.min(1, p.hp / max));
    rrect(ctx, x - 22, y - 10, 44, 7, 3); ctx.fillStyle = INK; ctx.fill();
    rrect(ctx, x - 21, y - 9, 42 * k, 5, 2); ctx.fillStyle = k > 0.3 ? '#6fe05a' : '#ff5e5b'; ctx.fill();
  }

  /** Cleric Shield Rush absorb bubble. */
  shieldBubble(ctx, x, y, p) {
    const t = this.time, k = p.shieldMax ? Math.max(0.35, Math.min(1, p.shield / p.shieldMax)) : 1;
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.06 * Math.sin(t * 6);
    circle(ctx, x, y - 4, 30, '#9fe0ff', 0);
    ctx.globalAlpha = 0.55 * k + 0.2;
    ctx.beginPath(); ctx.arc(x, y - 4, 30, 0, TAU); ctx.strokeStyle = '#dff6ff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y - 4, 30, -2.4 + t, -1.4 + t); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
  }
  /** Blade Dancer: perfect dodge primed (next hit crits). */
  /** Cleric Divine Ascension: holy aura (radius matches ASCENSION.r). */
  holyAura(ctx, x, y) {
    const t = this.time, r = 230;
    ctx.save();
    ctx.globalAlpha = 0.16 + 0.05 * Math.sin(t * 4); circle(ctx, x, y, r, '#ffe27a', 0);
    ctx.globalAlpha = 0.8; ctx.lineWidth = 4; ctx.strokeStyle = '#ffe27a'; 
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); haloStroke(ctx, '#ffe27a', 4, 18); ctx.stroke();
    ctx.setLineDash([14, 14]); ctx.lineDashOffset = t * 30; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 6; i++) { const an = -t * 0.9 + i * (TAU / 6); ctx.save(); ctx.translate(x + Math.cos(an) * r * 0.92, y + Math.sin(an) * r * 0.92); ctx.fillStyle = '#fff6c8'; ctx.fillRect(-2, -8, 4, 16); ctx.fillRect(-8, -2, 16, 4); ctx.restore(); }
    // light column
    const g = ctx.createLinearGradient(0, y - 140, 0, y + 10); g.addColorStop(0, 'rgba(255,246,200,0)'); g.addColorStop(1, 'rgba(255,246,200,.45)');
    ctx.globalAlpha = 0.8; ctx.fillStyle = g; ctx.fillRect(x - 26, y - 140, 52, 150);
    ctx.restore();
  }
  /** Warrior Titan's Wrath rage: flickering red aura. */
  rageAura(ctx, x, y, big = false) {
    const t = this.time, R = RAGE.pullR;
    // pull field: faint red disc, a dashed rim flowing inward and chevrons sliding toward the Warrior
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 20, x, y, R); g.addColorStop(0, 'rgba(255,60,40,.16)'); g.addColorStop(1, 'rgba(255,60,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.strokeStyle = '#ff5e3b'; ctx.lineWidth = 3; ctx.setLineDash([14, 12]); ctx.lineDashOffset = t * 40; ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffb08a';
    for (let i = 0; i < 10; i++) {
      const an = i * (TAU / 10) + t * 0.6, ph = (t * 0.9 + i * 0.37) % 1, d = R * (1 - ph) + 30;
      ctx.globalAlpha = 0.75 * Math.min(1, ph * 3) * (1 - ph * 0.5);
      const cx = x + Math.cos(an) * d, cy = y + Math.sin(an) * d, w = 9;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(an + 0.9) * w, cy + Math.sin(an + 0.9) * w); ctx.lineTo(cx - Math.cos(an) * 2, cy - Math.sin(an) * 2); ctx.lineTo(cx + Math.cos(an - 0.9) * w, cy + Math.sin(an - 0.9) * w); ctx.stroke();
    }
    ctx.restore();
    ctx.save(); if (big) { ctx.translate(x, y - 4 - PAINT_FX.lift); ctx.scale(PAINT_FX.body, PAINT_FX.body); ctx.translate(-x, -(y - 4)); } // (the pull field above is a gameplay radius: only the body flare scales)
    glowAt(ctx, x, y - 4, '#ff3b2b', 60);
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 14); circle(ctx, x, y - 4, 40 + 4 * Math.sin(t * 9), 'rgba(255,60,40,.45)', 3, '#ff5e3b');
    ctx.shadowBlur = 0; ctx.globalAlpha = 0.8;
    for (let i = 0; i < 5; i++) { const ph = (t * 1.6 + i / 5) % 1, an = i * 1.3; circle(ctx, x + Math.cos(an) * 26, y - ph * 60, 4 * (1 - ph) + 1, '#ff9a5c', 0); }
    ctx.restore();
  }
  /** Eclipse active: a dark violet halo with an orbiting crescent (drawn under the hero, visible even in its stealth). */
  eclipseAura(ctx, x, y, e) {
    const t = this.time;
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.1 * Math.sin(t * 7);
    circle(ctx, x, y + 8, 40 + 3 * Math.sin(t * 5), 'rgba(50,14,80,.45)', 0);
    ctx.beginPath(); ctx.arc(x, y + 8, 46, t * 3, t * 3 + Math.PI * 1.3); ctx.strokeStyle = '#c89cff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y + 8, 52, -t * 2.2, -t * 2.2 + Math.PI * 0.8); ctx.strokeStyle = '#ff9ee0'; ctx.lineWidth = 2; ctx.stroke();
    const a = t * 2.6, mx = x + Math.cos(a) * 44, my = y + 8 + Math.sin(a) * 30;
    circle(ctx, mx, my, 9, '#ffe6a8', 0); circle(ctx, mx + 4, my - 2, 8, '#2a0c3a', 0);
    ctx.restore();
  }
  perfectAura(ctx, x, y) {
    const t = this.time;
    ctx.save(); ctx.globalAlpha = 0.5 + 0.25 * Math.sin(t * 14);
    for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; circle(ctx, x + Math.cos(a) * 26, y - 4 + Math.sin(a) * 26, 3.5, '#ff9ee0', 0); }
    ctx.beginPath(); ctx.arc(x, y - 4, 24, 0, TAU); ctx.strokeStyle = '#ff9ee0'; ctx.lineWidth = 2; ctx.setLineDash([5, 6]); ctx.lineDashOffset = -t * 30; ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  /** Warrior Sunder debuff: a red crack ring at the enemy's feet and a cracked-shield icon above it. */
  sunderIcon(ctx, x, y, e) {
    const t = this.time;
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.15 * Math.sin(t * 7);
    ctx.beginPath(); ctx.ellipse(x, y + e.r * 0.55, e.r + 8, (e.r + 8) * 0.45, 0, 0, TAU); ctx.strokeStyle = '#ff4a2e'; ctx.lineWidth = 3; ctx.setLineDash([7, 5]); ctx.lineDashOffset = -t * 20; ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const ix = x + e.r * 0.8 + 6, iy = y - e.r - (e.boss ? 34 : 18);
    ctx.translate(ix, iy);
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(9, -7); ctx.lineTo(8, 3); ctx.lineTo(0, 11); ctx.lineTo(-8, 3); ctx.lineTo(-9, -7); ctx.closePath();
    ctx.fillStyle = '#ff5e3b'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1, -10); ctx.lineTo(-2, -3); ctx.lineTo(3, 1); ctx.lineTo(-1, 9); ctx.strokeStyle = '#fff1c4'; ctx.lineWidth = 2; ctx.stroke();
    const n = e.sunder.n || 1;
    { // stack count badge (x1..x5), flashing at max
      const mx = n >= 5;
      circle(ctx, 11, 8, 8, mx ? (Math.sin(t * 14) > 0 ? '#fff1c4' : '#ff3b2b') : '#2a1010', 2, INK);
      ctx.font = "12px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = mx ? INK : '#fff'; ctx.fillText(String(n), 11, 8.5); ctx.textBaseline = 'alphabetic';
    }
    if (n >= 5) { ctx.translate(-ix, -iy); ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 10); ctx.beginPath(); ctx.ellipse(x, y + e.r * 0.55, e.r + 16, (e.r + 16) * 0.45, 0, 0, TAU); ctx.strokeStyle = '#ff2a1a'; ctx.lineWidth = 4; ctx.stroke(); }
    ctx.restore();
  }
  /** Quarry / Burn / Condemn stacks: a row of small class icons above the enemy (+ a count when many), ring at max. */
  /** Storm of Arrows MARK: a spinning cyan crosshair around the enemy. */
  stormMark(ctx, x, y, e) {
    const t = this.time, R = e.r + 14 + 2 * Math.sin(t * 8);
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 1.5); ctx.globalAlpha = 0.85;
    ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(0, 0); ctx.arc(0, 0, R, i * Math.PI / 2 + 0.25, i * Math.PI / 2 + 1.3); } ctx.stroke();
    ctx.strokeStyle = '#7af0ff'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(Math.cos(i * Math.PI / 2 + 0.25) * R, Math.sin(i * Math.PI / 2 + 0.25) * R); ctx.arc(0, 0, R, i * Math.PI / 2 + 0.25, i * Math.PI / 2 + 1.3); } ctx.stroke();
    for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + 0.78; ctx.beginPath(); ctx.moveTo(Math.cos(an) * (R + 8), Math.sin(an) * (R + 8)); ctx.lineTo(Math.cos(an) * (R - 6), Math.sin(an) * (R - 6)); ctx.stroke(); }
    ctx.restore();
  }
  stackIcons(ctx, x, y, e, local) {
    const t = this.time;
    let row = 0;
    for (const kind of ['chal', 'quarry', 'burn', 'condemn', 'bleed', 'cut', 'pp', 'impaled', 'scorch']) {
      const s = e.stx[kind];
      if (!s || !(s.t > 0) || !s.n) continue;
      const n = s.n, cap = stackCap(kind, e), mine = s.pid === local.id, shown = Math.min(n, 6), w = 15;
      const y0 = y - e.r - (e.boss ? 84 : 58) - row * 20, x0 = x - ((shown - 1) * w) / 2 - (n > 6 ? 8 : 0);
      ctx.save(); ctx.globalAlpha = mine ? 1 : 0.6;
      const ik = ST_ICON[kind];
      if (uiOn() && ik && uiIcon(ctx, ik, x - 8, y0, 22, 5)) { // painted: one B1 / B2 status icon + the stack count
        ctx.font = "14px 'Lilita One', sans-serif"; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeText(`×${n}`, x + 6, y0 + 1); ctx.fillStyle = STACK_RING[kind]; ctx.fillText(`×${n}`, x + 6, y0 + 1); ctx.textBaseline = 'alphabetic';
      } else for (let i = 0; i < shown; i++) {
        const bob = Math.sin(t * 6 + i * 0.8) * 1.4;
        ctx.save(); ctx.translate(x0 + i * w, y0 + bob);
        STACK_ICON[kind](ctx, t + i * 0.3);
        ctx.restore();
      }
      if (n > 6 && !(uiOn() && ik && hasIcon(ik))) { ctx.font = "13px 'Lilita One', sans-serif"; ctx.textAlign = 'left'; ctx.lineWidth = 3; ctx.strokeStyle = INK; const tx = x0 + shown * w - 4; ctx.strokeText(`×${n}`, tx, y0 + 5); ctx.fillStyle = STACK_RING[kind]; ctx.fillText(`×${n}`, tx, y0 + 5); }
      if (n >= cap) { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 9); ctx.beginPath(); ctx.ellipse(x, y + e.r * 0.55, e.r + 12 + row * 5, (e.r + 12 + row * 5) * 0.45, 0, 0, TAU); ctx.strokeStyle = STACK_RING[kind]; ctx.lineWidth = 3; ctx.stroke(); }
      if (kind === 'cut') this.cutMarks(ctx, x, y, e, n, cap, t);
      if (kind === 'pp') this.ppMarks(ctx, x, y, e, n, cap, t);
      if (kind === 'impaled') this.pinMarks(ctx, x, y, e, n, cap, t);
      if (kind === 'scorch') this.scorchMark(ctx, x, y, e, t, mine);
      if (kind === 'burn') { ctx.globalAlpha = 0.5; for (let i = 0; i < Math.min(n, 6); i++) { const ph = (t * 1.3 + i / 6) % 1; circle(ctx, x + Math.sin(i * 2.3 + t) * e.r * 0.6, y - ph * e.r * 1.4, 4 * (1 - ph) + 1, ph < 0.4 ? '#ffe27a' : '#ff6a1a', 0); } }
      ctx.restore();
      row++;
    }
  }
  /** Samurai Delayed Cuts: glowing slash marks drawn ON the enemy (one per cut, pulsing harder as they pile up). */
  cutMarks(ctx, x, y, e, n, cap, t) {
    const r = e.r, m = Math.min(n, 10), full = n >= cap;
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < m; i++) {
      const a = -0.9 + ((i * 2.39) % 1.8), ox = Math.sin(i * 2.1) * r * 0.45, oy = Math.cos(i * 1.7) * r * 0.35 - r * 0.15, L = r * (0.55 + (i % 3) * 0.12);
      const pulse = 0.65 + 0.35 * Math.sin(t * (8 + m) + i * 1.3);
      ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(x + ox - Math.cos(a) * L, y + oy - Math.sin(a) * L); ctx.lineTo(x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L);
      ctx.strokeStyle = '#170d1f'; ctx.lineWidth = 6; ctx.stroke();
      ctx.globalAlpha = pulse; ctx.strokeStyle = full ? '#fff3fa' : '#ff8cc6'; ctx.lineWidth = 3.5; ctx.stroke();
      ctx.globalAlpha = pulse * 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    ctx.restore();
  }
  /** Monk Pressure Points: glowing golden points ON the enemy (one per point, a pulsing ring when full). */
  ppMarks(ctx, x, y, e, n, cap, t) {
    const r = e.r, m = Math.min(n, 10), full = n >= cap;
    ctx.save();
    for (let i = 0; i < m; i++) {
      const a = i * 2.399 + 0.6, d = r * (0.25 + 0.4 * ((i * 0.618) % 1)), px = x + Math.cos(a) * d, py = y - r * 0.1 + Math.sin(a) * d * 0.8, pulse = 0.6 + 0.4 * Math.sin(t * (7 + m) + i);
      ctx.globalAlpha = 0.45 * pulse; ctx.beginPath(); ctx.arc(px, py, 8, 0, TAU); ctx.fillStyle = '#ffb02e'; ctx.fill();
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(px, py, 3.4, 0, TAU); ctx.fillStyle = full ? '#ffffff' : '#ffd23f'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#3a1a05'; ctx.stroke();
    }
    ctx.restore();
  }
  /** Dragoon Impaled: crimson spear shafts stuck in the enemy (one per pin), glowing harder when full. */
  pinMarks(ctx, x, y, e, n, cap, t) {
    const r = e.r, m = Math.min(n, 10), full = n >= cap;
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < m; i++) {
      const a = -2.4 + ((i * 1.37) % 1.6), ox = Math.sin(i * 2.3) * r * 0.4, oy = Math.cos(i * 1.9) * r * 0.3 - r * 0.1, L = r * 0.75;
      const x0 = x + ox, y0 = y + oy, x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L, pulse = 0.7 + 0.3 * Math.sin(t * (6 + m) + i);
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = '#0d0820'; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = full ? '#ffd0dc' : '#7a5cff'; ctx.lineWidth = 2.6; ctx.stroke();
      ctx.globalAlpha = pulse; ctx.beginPath(); ctx.arc(x0, y0, 4, 0, TAU); ctx.fillStyle = '#ff3b5c'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + Math.cos(a + 2.6) * 6, y1 + Math.sin(a + 2.6) * 6); ctx.moveTo(x1, y1); ctx.lineTo(x1 + Math.cos(a - 2.6) * 6, y1 + Math.sin(a - 2.6) * 6); ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  }
  /** Dragoon Scorched (a Dragon's Roar dive target): licking flames + a pulsing crimson dive reticle. */
  scorchMark(ctx, x, y, e, t, mine) {
    const r = e.r + 16 + 3 * Math.sin(t * 9);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { const ph = (t * 1.6 + i / 6) % 1; ctx.globalAlpha = 0.7 * (1 - ph); ctx.beginPath(); ctx.arc(x + Math.sin(i * 2.1 + t * 2) * e.r * 0.6, y - ph * e.r * 1.6, 6 * (1 - ph) + 2, 0, TAU); ctx.fillStyle = ph < 0.35 ? '#ffd27a' : '#ff4a2a'; ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    if (mine) { ctx.globalAlpha = 0.9; ctx.translate(x, y); ctx.rotate(-t * 2.2); ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, r, i * TAU / 3, i * TAU / 3 + 1.2); ctx.stroke(); }
      ctx.rotate(t * 4.4); ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * TAU / 4; ctx.moveTo(Math.cos(a) * (r + 9), Math.sin(a) * (r + 9)); ctx.lineTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4)); } ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2.5; ctx.stroke(); }
    ctx.restore();
  }
  /** Monk chi aura: gold wisps rising around the monk; brighter, wider and faster at each hit-counter tier (Calm / Surging / Transcendent). */
  chiAura(ctx, x, y, tier, hc) {
    const t = this.time, cols = ['#ffb02e', '#ffd23f', '#fffaf0'], col = cols[tier], R = 30 + tier * 8, n = 5 + tier * 4;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 6, x, y, R + 18); g.addColorStop(0, `rgba(255,200,60,${0.08 + tier * 0.1})`); g.addColorStop(1, 'rgba(255,160,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R + 18, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.35 + tier * 0.2; ctx.beginPath(); ctx.ellipse(x, y + 14, R + 10, (R + 10) * 0.42, 0, 0, TAU); ctx.strokeStyle = col; ctx.lineWidth = 2 + tier; ctx.stroke();
    for (let i = 0; i < n; i++) { const ph = (t * (0.9 + tier * 0.5) + i / n) % 1, a = i * (TAU / n) + t * 0.6, px = x + Math.cos(a) * R * 0.8, py = y + 10 - ph * (40 + tier * 20); ctx.globalAlpha = (1 - ph) * (0.5 + tier * 0.2); ctx.beginPath(); ctx.arc(px, py, 2 + tier + (1 - ph) * 2, 0, TAU); ctx.fillStyle = col; ctx.fill(); }
    ctx.restore();
  }
  /** Class state (Retaliation / Focus / Arcane Surge / Consecration): a short-lived class-coloured halo. */
  stateAura(ctx, x, y, cls) {
    const t = this.time, col = STATE_COL[cls] || '#fff';
    ctx.save();
    glowAt(ctx, x, y - 4, col, 56); ctx.globalAlpha = 0.7 + 0.2 * Math.sin(t * 18);
    if (cls === 'warrior') { // Retaliation: jagged ember crown
      ctx.beginPath(); for (let i = 0; i <= 16; i++) { const a = i * (TAU / 16) + t * 2, r = i % 2 ? 30 : 40; ctx.lineTo(x + Math.cos(a) * r, y - 4 + Math.sin(a) * r * 0.8); } ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
    } else if (cls === 'ranger') { // Focus: crosshair brackets
      ctx.strokeStyle = col; ctx.lineWidth = 3; const r = 34 + 3 * Math.sin(t * 10);
      for (let i = 0; i < 4; i++) { const a = i * (TAU / 4) + t * 1.5; ctx.beginPath(); ctx.arc(x, y - 4, r, a - 0.4, a + 0.4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (r - 8), y - 4 + Math.sin(a) * (r - 8)); ctx.lineTo(x + Math.cos(a) * (r + 6), y - 4 + Math.sin(a) * (r + 6)); ctx.stroke(); }
    } else if (cls === 'mage') { // Arcane Surge: orbiting runes
      ctx.beginPath(); ctx.arc(x, y - 4, 36, 0, TAU); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([3, 7]); ctx.lineDashOffset = -t * 40; ctx.stroke(); ctx.setLineDash([]);
      for (let i = 0; i < 5; i++) { const a = t * 3.2 + i * (TAU / 5); ctx.save(); ctx.translate(x + Math.cos(a) * 36, y - 4 + Math.sin(a) * 36); ctx.rotate(a); ctx.fillStyle = '#eaf6ff'; ctx.fillRect(-4, -1.5, 8, 3); ctx.fillRect(-1.5, -4, 3, 8); ctx.restore(); }
    } else if (cls === 'samurai') { // Stillness: a perfectly still silver ring on the ground, petals frozen around it
      ctx.shadowBlur = 0; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(x, y + 14, 44, 18, 0, 0, TAU); ctx.strokeStyle = '#dfe8ff'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.ellipse(x, y + 14, 52, 22, 0, 0, TAU); ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.stroke();
      for (let i = 0; i < 6; i++) { const a = i * (TAU / 6) + 0.3; ctx.save(); ctx.translate(x + Math.cos(a) * 40, y - 6 + Math.sin(a) * 26 + Math.sin(t * 2 + i) * 2); ctx.rotate(a + t * 0.3); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(0, 0, 4.5, 2.4, 0, 0, TAU); ctx.fillStyle = i % 2 ? '#ffc2e0' : '#fff3fa'; ctx.fill(); ctx.restore(); }
    } else if (cls === 'monk') { // Flow State: gold wind streaks circling the monk
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const a = t * 7 + i * (TAU / 6), r = 36 + (i % 2) * 8; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(x, y - 2, r, r * 0.8, 0, a, a + 0.9); ctx.strokeStyle = i % 2 ? '#fffaf0' : col; ctx.lineWidth = 3; ctx.stroke(); }
    } else { // Consecration: golden ground circle with a cross
      ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.ellipse(x, y + 14, 46, 20, 0, 0, TAU); ctx.fillStyle = col; ctx.fill();
      ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(x, y + 14, 46, 20, 0, 0, TAU); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#fff6c8'; ctx.fillRect(x - 2, y - 50, 4, 18); ctx.fillRect(x - 7, y - 45, 14, 4);
    }
    ctx.restore();
  }
  /** Ult window for classes without a rage/aura visual: a bright rotating double ring. */
  windowAura(ctx, x, y, cls) {
    const t = this.time, col = WIN_COL[cls] || '#ffd23f';
    ctx.save(); glowAt(ctx, x, y + 12, col, 64); ctx.globalAlpha = 0.55 + 0.15 * Math.sin(t * 6);
    ctx.beginPath(); ctx.ellipse(x, y + 12, 52, 22, 0, t * 2, t * 2 + Math.PI * 1.4); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y + 12, 60, 26, 0, -t * 1.6, -t * 1.6 + Math.PI * 0.9); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  /** Blade Dancer Marks (Marked for Death): one small dagger per stack above the enemy (yours pink, an ally's violet). */
  markIcons(ctx, x, y, e, mine) {
    const n = e.mark.n, t = this.time, w = 16;
    const y0 = y - e.r - (e.boss ? 62 : 40), x0 = x - ((n - 1) * w) / 2;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const bob = Math.sin(t * 6 + i * 0.9) * 1.5;
      ctx.save(); ctx.translate(x0 + i * w, y0 + bob); ctx.rotate(Math.PI); ctx.scale(1.5, 1.5); // point down at the enemy
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(3, 2); ctx.lineTo(0, 5); ctx.lineTo(-3, 2); ctx.closePath();
      ctx.fillStyle = mine ? '#ff6fbf' : '#b48cff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = INK; ctx.fillRect(-4, 5, 8, 2.5); ctx.fillRect(-1.2, 7, 2.4, 4);
      ctx.restore();
    }
    if (n >= 5) { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 8); ctx.beginPath(); ctx.ellipse(x, y + e.r * 0.55, e.r + 10, (e.r + 10) * 0.45, 0, 0, TAU); ctx.strokeStyle = mine ? '#ff4f9a' : '#9a6cff'; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.restore();
  }
  /** Warrior at 50+ Rage (Rage chains live): flickering red embers rising around him, brighter at 100. */
  rageHotAura(ctx, x, y, e) {
    const t = this.time, full = e.res >= (e.stats && e.stats.maxRes ? e.stats.maxRes : 100) - 0.5;
    ctx.save(); ctx.globalAlpha = (full ? 0.75 : 0.5) + 0.2 * Math.sin(t * 14);
    ctx.beginPath(); ctx.ellipse(x, y + 12, 30, 12, 0, 0, TAU); ctx.strokeStyle = 'rgba(255,42,26,.35)'; ctx.lineWidth = full ? 12 : 8; ctx.stroke(); // (a soft wide stroke instead of shadowBlur: cheap on slow phones)
    ctx.strokeStyle = full ? '#ff7a3c' : '#ff3b2b'; ctx.lineWidth = full ? 4 : 3; ctx.stroke();
    for (let i = 0; i < (full ? 7 : 4); i++) { const k = (t * 1.3 + i * 0.37) % 1, a = i * 2.1; circle(ctx, x + Math.cos(a) * 22 * (1 - k * 0.4), y + 8 - k * 48, 3.5 * (1 - k) + 1, k < 0.5 ? '#ffcf6a' : '#ff5a3c', 0); }
    ctx.restore();
  }
  /** Weapon Master: a thin stance-coloured ground ring (blue greatsword / red axes / gold hammer), brighter in Trinity Surge. */
  stanceAura(ctx, x, y, e) {
    const col = { G: '#7fd6ff', A: '#ff5a5a', H: '#ffc14d' }[e.wm.st] || '#fff', t = this.time, sg = e.wm.surge > 0;
    ctx.save(); ctx.globalAlpha = sg ? 0.7 + 0.2 * Math.sin(t * 12) : 0.4;
    ctx.beginPath(); ctx.ellipse(x, y + 12, sg ? 30 : 24, sg ? 12 : 9, 0, 0, TAU); ctx.strokeStyle = col; ctx.lineWidth = sg ? 4 : 2.5; ctx.stroke();
    if (sg) for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.094; circle(ctx, x + Math.cos(a) * 30, y + 12 + Math.sin(a) * 12, 3.5, ['#7fd6ff', '#ff5a5a', '#ffc14d'][i], 0); }
    ctx.restore();
  }
  /** Warrior Rage hold: a ring that closes as the charge fills, flames sucked inward, white-hot at full charge. */
  chargeAura(ctx, x, y, e) {
    const t = this.time, R = CLASSES.warrior.hold || { tap: 15, full: 30 };
    const k = e.holdT != null && e.holdKey ? Math.max(0, Math.min(1, (e.holdT - R.tap) / (R.full - R.tap))) : 0.5 + 0.5 * Math.sin(t * 6);
    const full = k >= 0.999, r = 46 - 16 * k;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.4 * k; ctx.beginPath(); ctx.ellipse(x, y + 8, r + 8, (r + 8) * 0.45, 0, 0, TAU); ctx.strokeStyle = 'rgba(255,50,20,.5)'; ctx.lineWidth = 10; ctx.stroke();
    ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(x, y - 6, 34, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.05, k)); ctx.strokeStyle = full ? '#fff0a0' : '#ff3b2b'; ctx.lineWidth = full ? 5 : 4; ctx.lineCap = 'round'; ctx.stroke();
    for (let i = 0; i < 8; i++) { const q = (t * 2.2 + i * 0.125) % 1, an = i * 0.785 + t * 1.5, d = 58 * (1 - q) + 10; circle(ctx, x + Math.cos(an) * d, y - 6 + Math.sin(an) * d * 0.7, 2.5 + 2 * q, full ? '#fff0a0' : q > 0.5 ? '#ffcf6a' : '#ff5a3c', 0); }
    if (full) { ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 24); circle(ctx, x, y - 6, 26, '#fff0a0', 0); }
    ctx.restore();
  }
  /** An empowered (Rage-spending) Warrior hit in progress: a burst of fire around the hero. */
  empowerAura(ctx, x, y) {
    const t = this.time;
    ctx.save(); ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 30);
    ctx.beginPath(); ctx.arc(x, y - 4, 30, 0, TAU); ctx.strokeStyle = '#ff5a1c'; ctx.lineWidth = 6; ctx.stroke();
    for (let i = 0; i < 6; i++) { const q = (t * 3 + i / 6) % 1, an = i * 1.047; circle(ctx, x + Math.cos(an) * 24, y - 4 - q * 40, 5 * (1 - q) + 1, q < 0.4 ? '#fff0a0' : '#ff7a3c', 0); }
    ctx.restore();
  }
  /** Own hero in stealth: a dashed smoky ring so you can still see where you are. */
  stealthRing(ctx, x, y) {
    const t = this.time;
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(x, y - 4, 28, 0, TAU); ctx.strokeStyle = '#c9b8ff'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 6]); ctx.lineDashOffset = t * 25; ctx.stroke(); ctx.setLineDash([]);
  }

  enemyBar(ctx, x, y, e) {
    const w = Math.max(34, e.r * 2.2), h = 7, k = Math.max(0, e.hp / e.maxHp);
    rrect(ctx, x - w / 2 - 2, y - 2, w + 4, h + 4, 5); ctx.fillStyle = INK; ctx.fill();
    rrect(ctx, x - w / 2, y, w * k, h, 3); ctx.fillStyle = k > 0.5 ? '#6fe05a' : k > 0.25 ? '#ffcf3a' : '#ff5e5b'; ctx.fill();
  }

  /** Obstacles near the view (perf: a 512-unit bucket grid built once per world instead of walking all ~4.6k props 3x a frame). */
  visibleObstacles(world, view) {
    const C = 512;
    if (this.obsWorld !== world) {
      this.obsWorld = world; this.obsGrid = new Map();
      world.obstacles.forEach((o) => { const r = (o.size || 20) * 3 + 60, x0 = Math.floor((o.x - r) / C), x1 = Math.floor((o.x + r) / C), y0 = Math.floor((o.y - r) / C), y1 = Math.floor((o.y + r) / C); for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const k = cx + ',' + cy; let a = this.obsGrid.get(k); if (!a) this.obsGrid.set(k, (a = [])); a.push(o); } });
    }
    const out = this.obsOut || (this.obsOut = []), seen = this.obsSeen || (this.obsSeen = new Set());
    out.length = 0; seen.clear();
    for (let cy = Math.floor(view.y0 / C); cy <= Math.floor(view.y1 / C); cy++) for (let cx = Math.floor(view.x0 / C); cx <= Math.floor(view.x1 / C); cx++) {
      const a = this.obsGrid.get(cx + ',' + cy); if (a) for (const o of a) if (!seen.has(o)) { seen.add(o); out.push(o); }
    }
    return out.sort((a, b) => a.y - b.y || a.x - b.x); // (a stable draw order however the buckets come back)
  }

  /** painted prop see-through: the local hero standing behind (above the feet line, inside the silhouette) fades it */
  propFade(o, a, local) {
    if (!local || local.y >= o.y - 4) return 1;
    const sz = wpSize(a.name, a.h); if (!sz) return 1;
    const dx = local.x - o.x, top = o.y - a.h * 0.92;
    if (local.y - 40 < top || Math.abs(dx) > sz.w * 0.36 + 12) return 1;
    return a.h > 90 ? 0.42 : 0.6;
  }
  /** WebGL Part 5 (B2 mobs / B3 fx): run `draw` against the GL recorder and composite the result into ctx right here,
   *  so draw order (and every blend with what is already on the canvas) is unchanged. False = not on GL this time
   *  (toggle off, no WebGL2, or the recording hit something the recorder can't do): the caller draws with Canvas2D.
   *  rect = [x, y, r] in world units: only that box is composited (a mob), else the whole frame (the fx layer). */
  glOverlay(ctx, sys, draw, rect = null) {
    if (!glPref.on(sys) || this.glAllowed === false || !this.canvas || this.canvas.id !== 'game') return false;
    if (this.glOv === undefined) this.glOv = new GLLayer(this.canvas, { alpha: true, id: 'gameGL2' });
    const L = this.glOv; if (!L || !L.ok || L.gl.isContextLost()) return false;
    const G = this.glOvCtx || (this.glOvCtx = new GLCtx(L)); G.reset(); G.setTransform(ctx.getTransform()); G.globalAlpha = ctx.globalAlpha;
    draw(G);
    if (G.unsupported) { G.q = []; this.glWhy = sys + ':' + G.why; return false; }
    L.beginOverlay(); G.exec(); L.useQuads();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = false;
    const W = L.canvas.width, H = L.canvas.height;
    if (rect) {
      const m = ctx.getTransform ? G.m : null, [wx, wy, wr] = rect, k = Math.hypot(m[0], m[1]);
      const x0 = Math.max(0, Math.floor(m[0] * wx + m[2] * wy + m[4] - wr * k)), y0 = Math.max(0, Math.floor(m[1] * wx + m[3] * wy + m[5] - wr * k));
      const x1 = Math.min(W, Math.ceil(m[0] * wx + m[2] * wy + m[4] + wr * k)), y1 = Math.min(H, Math.ceil(m[1] * wx + m[3] * wy + m[5] + wr * k));
      if (x1 > x0 && y1 > y0) ctx.drawImage(L.canvas, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    } else ctx.drawImage(L.canvas, 0, 0);
    ctx.restore(); this._glUsed = true; return true;
  }
  /** Static ground from the tile cache (client/ground.js) + the cheap animated Wilds bits on top. */
  drawGround(ctx, view, sim) {
    if (!this.ground) this.ground = new GroundCache(this.groundOpts || {});
    // WebGL Part A1: the ground tiles go to the GL world layer under this canvas (toggle 'world'; Canvas2D fallback)
    if (glPref.on('world') && this.glAllowed !== false && this.canvas && this.canvas.id === 'game') {
      if (this.glLayer === undefined) this.glLayer = new GLLayer(this.canvas);
      const L = this.glLayer;
      if (L && L.ok && !L.gl.isContextLost()) {
        const z = this.cam.zoom, d = this.dpr || 1, sh = this._shake || { x: 0, y: 0 };
        const sx = Number.isFinite(sh.x) ? sh.x : 0, sy = Number.isFinite(sh.y) ? sh.y : 0;
        L.begin([d * z, d * (this.w / 2 + sx - this.cam.x * z), d * (this.h / 2 + sy - this.cam.y * z)]);
        this.ground.draw(null, view, z * d, sim && sim.world, L);
        // Part B1: the town's vector floor (meadow, roads, squares, flower beds, pier, the gate plaza) through the GL ctx
        if (glPref.on('shapes') && !tavernOn(sim)) {
          const G = this.glCtx || (this.glCtx = new GLCtx(L)); G.reset(); G.setTransform(d * z, 0, 0, d * z, d * (this.w / 2 + sx - this.cam.x * z), d * (this.h / 2 + sy - this.cam.y * z));
          const on = drawTownGround(G, view, this.time); if (on) drawGatePlaza(G, this.time);
          if (!G.unsupported) { L.flush(); G.exec(); L.useQuads(); this._glTown = on; } else this.glWhy = G.why;
        }
        L.end(); this._glUsed = true;
        // (composited INTO this canvas, not stacked under it: overlays drawn with 'lighter' / 'multiply' on the ground
        //  must blend with the real ground pixels, a separate layer below a transparent canvas changed their colours)
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(L.canvas, 0, 0); ctx.restore();
        drawWildsLive(ctx, view, this.time, this.quality ?? 2);
        return;
      }
    }
    this.ground.draw(ctx, view, this.cam.zoom * (this.dpr || 1), sim && sim.world);
    drawWildsLive(ctx, view, this.time, this.quality ?? 2);
  }
  drawDecor() { /* baked into the ground tiles */ }
  tuft(ctx, x, y, col) {
    ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x - 4, y - 8); ctx.moveTo(x, y); ctx.lineTo(x, y - 11); ctx.moveTo(x + 6, y); ctx.lineTo(x + 4, y - 8);
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
  }
  flower(ctx, x, y, col) {
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; circle(ctx, x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3.2, col, 1.5); }
    circle(ctx, x, y, 2.6, '#ffb52e', 1.5);
  }
  bone(ctx, x, y, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#f1eadb'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }
  crack(ctx, x, y, h) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 10, y + 4 - h * 10); ctx.lineTo(x + 18, y + 2); ctx.strokeStyle = 'rgba(40,20,40,.35)'; ctx.lineWidth = 2.5; ctx.stroke();
  }

  drawArea(ctx, a, sim) {
    const t = this.time;
    if (a.kind === 'astecho') { if (a.t < a.delay) drawTele(ctx, { sh: 'ring', x: a.x, y: a.y, r0: a.r0, r: a.r, t: a.t, d: a.delay, tell: 'ECHO' }, t); return; } // (C2: an Astral bruiser's echo ring)
    if (a.kind === 'ascalt') { const o = sim.players && sim.players.get ? sim.players.get(a.ownerId) : null; drawAscAlt(ctx, a, t, o ? o.cls : 'mage'); return; } // (Part D A3: an Astral skill variant)
    if (a.kind === 'duelmech') { if (a.t < a.delay) drawTele(ctx, { sh: a.shape, x: a.x, y: a.y, r0: a.r0, r: a.r, ang: a.ang, arc: a.arc, len: a.len, w: a.w, t: a.t, d: a.delay, tell: a.tell, cue: a.cue }, t); return; } // (Part D: the rank duels' Mirror Arts)
    if (a.kind && a.kind[0] === 'o' && drawOpsArea(ctx, a, t, this.fxLite)) { drawAreaCue(ctx, a, t); return; } // missions: biome hazards + siege / Queen telegraphs (client/missionfx.js)
    if (a.kind && drawRiftArea(ctx, a, t)) { drawAreaCue(ctx, a, t); return; } // the starwell (client/riftfx.js)
    if (a.kind && drawEmberArea(ctx, a, t, sim)) { drawAreaCue(ctx, a, t); return; } // Emberdeep telegraph kinds (client/emberfx.js)
    if (a.kind && drawFrostArea(ctx, a, t, sim)) { drawAreaCue(ctx, a, t); return; } // Frostveil telegraph kinds (client/frostfx.js)
    if (a.kind && drawSiteArea(ctx, a, t)) { drawAreaCue(ctx, a, t); return; } // spawn-site fodder: caster wards, fire pools, aim lines (client/sitesfx.js)
    if (a.trigger === 'proximity') { // snare trap
      ctx.save(); ctx.translate(a.x, a.y);
      circle(ctx, 0, 0, 20, '#7a7f89', 3);
      for (let i = 0; i < 8; i++) { const an = (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(an) * 12, Math.sin(an) * 12); ctx.lineTo(Math.cos(an) * 22, Math.sin(an) * 22); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#d6dae3'; ctx.lineWidth = 2.5; ctx.stroke(); }
      circle(ctx, 0, 0, 7, '#b7f07a', 2.5);
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 5); circle(ctx, 0, 0, a.triggerR + 10, null, 3, '#b7f07a');
      ctx.restore();
      return;
    }
    if (a.kind === 'decoy') { // Blade Dancer Shadow Step decoy: a flickering shadow of the hero that enemies chase
      const life = a.delay, left = Math.max(0, life - a.t), fade = Math.min(1, left / 15, a.t / 5);
      ctx.save(); ctx.translate(a.x, a.y); ctx.globalAlpha = 0.75 * fade * (0.85 + 0.15 * Math.sin(t * 20));
      ctx.beginPath(); ctx.ellipse(0, 14, 18, 6, 0, 0, TAU); ctx.fillStyle = 'rgba(20,10,30,.5)'; ctx.fill();
      circle(ctx, 0, 0, 16, '#3b2d5c', 3); circle(ctx, 0, -18, 11, '#4a3a72', 3);
      circle(ctx, -4, -19, 2.2, '#ff8ad8', 0); circle(ctx, 4, -19, 2.2, '#ff8ad8', 0);
      ctx.beginPath(); ctx.moveTo(-20, 4); ctx.lineTo(-8, -6); ctx.moveTo(20, 4); ctx.lineTo(8, -6); ctx.strokeStyle = '#c9b8ff'; ctx.lineWidth = 3; ctx.stroke();
      ctx.globalAlpha = 0.3 * fade; circle(ctx, 0, 0, a.r + 10 + 4 * Math.sin(t * 8), null, 2, '#b28cff');
      ctx.restore();
      return;
    }
    if (a.kind === 'sanctuary') { // Cleric: glowing holy circle
      const life = a.delay + (a.pulses - 1) * a.every, k = Math.min(1, a.t / 8), fade = Math.min(1, (life - a.t) / 12);
      ctx.save(); ctx.globalAlpha = Math.max(0, fade);
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r * k, 0, TAU); ctx.fillStyle = 'rgba(255,226,122,.22)'; ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = '#ffe27a'; haloStroke(ctx, '#ffe27a', 5, 16); ctx.stroke();
      ctx.setLineDash([10, 12]); ctx.lineDashOffset = -t * 24; ctx.beginPath(); ctx.arc(a.x, a.y, a.r * k * 0.72, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.stroke(); ctx.setLineDash([]);
      for (let i = 0; i < 4; i++) { const an = t * 0.8 + i * (TAU / 4); ctx.save(); ctx.translate(a.x + Math.cos(an) * a.r * 0.86 * k, a.y + Math.sin(an) * a.r * 0.86 * k); ctx.fillStyle = '#fff6c8'; ctx.fillRect(-2, -7, 4, 14); ctx.fillRect(-7, -2, 14, 4); ctx.restore(); }
      for (let i = 0; i < 7; i++) { const ph = (t * 0.7 + i / 7) % 1, an = i * 2.4; ctx.globalAlpha = Math.max(0, fade) * (1 - ph); circle(ctx, a.x + Math.cos(an) * a.r * 0.55, a.y + Math.sin(an) * a.r * 0.55 - ph * 40, 3, '#fffbe0', 0); }
      ctx.restore();
      return;
    }
    if (a.kind === 'hammer') { // Divine Hammer telegraph: a golden circle filling up until the hammer lands (the hammer itself: fxspec.js)
      const k = Math.min(1, a.t / Math.max(1, a.delay));
      ctx.save(); ctx.globalAlpha = 0.25; circle(ctx, a.x, a.y, a.r, '#ffe27a', 0); ctx.globalAlpha = 0.35; circle(ctx, a.x, a.y, a.r * k, '#fff6c8', 0);
      ctx.globalAlpha = 0.9; ctx.lineWidth = 4; ctx.strokeStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke(); ctx.restore();
      return;
    }
    const prog = Math.min(1, a.t / Math.max(1, a.delay));
    const enemy = a.team === 'enemy';
    if (a.kind === 'burn') {
      if (a.t < a.delay) return;
      ctx.save(); ctx.globalAlpha = 0.35 + 0.1 * Math.sin(t * 12);
      circle(ctx, a.x, a.y, a.r, '#ff7a2c', 0); ctx.globalAlpha = 0.5;
      for (let i = 0; i < 6; i++) { const an = t * 2 + i; circle(ctx, a.x + Math.cos(an * 1.3) * a.r * 0.6, a.y + Math.sin(an) * a.r * 0.6, 10 + 4 * Math.sin(t * 9 + i), '#ffd23f', 0); }
      ctx.restore();
      return;
    }
    if (a.kind === 'steam') { // Mage Steam Burst: a slowing cloud of steam where burning ground boiled
      const life = a.delay + (a.pulses - 1) * a.every, fade = Math.max(0, Math.min(1, (life - a.t) / 20, a.t / 6));
      ctx.save();
      for (let i = 0; i < 9; i++) { const an = i * 2.4 + t * 0.4, rr = a.r * (0.25 + 0.6 * ((i * 0.37) % 1)); ctx.globalAlpha = fade * (0.28 + 0.1 * Math.sin(t * 2 + i)); circle(ctx, a.x + Math.cos(an) * rr, a.y + Math.sin(an) * rr * 0.6 - 10, a.r * 0.38 + 6 * Math.sin(t * 3 + i), '#eef6ff', 0); }
      ctx.globalAlpha = fade * 0.6; ctx.strokeStyle = '#bfefff'; ctx.lineWidth = 3; ctx.setLineDash([8, 10]); ctx.lineDashOffset = -t * 20; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    if (a.kind === 'arrowstorm') { // Ranger ultimate: a storm cloud raining arrows
      const life = a.delay + (a.pulses - 1) * a.every, fade = Math.max(0, Math.min(1, (life - a.t) / 12, a.t / 6));
      ctx.save(); ctx.globalAlpha = fade;
      circle(ctx, a.x, a.y, a.r, 'rgba(122,240,255,.14)', 0);
      ctx.lineWidth = 4; ctx.strokeStyle = '#7af0ff'; ctx.setLineDash([16, 10]); ctx.lineDashOffset = -t * 40; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      if (a.t >= a.delay) for (let i = 0; i < 14; i++) {
        const ph = (t * 3.2 + i * 0.37) % 1, an = i * 2.39996, rr = a.r * Math.sqrt(((i * 0.618) % 1));
        const px = a.x + Math.cos(an) * rr, py = a.y + Math.sin(an) * rr;
        ctx.globalAlpha = fade * (1 - ph * 0.3);
        ctx.beginPath(); ctx.moveTo(px - 8, py - 90 * (1 - ph) - 26); ctx.lineTo(px - 8 * ph, py - 90 * (1 - ph)); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff6c8'; ctx.stroke();
      }
      ctx.restore();
      return;
    }
    const fill = enemy ? CUE_RGB[areaCue(a)][0] : a.kind === 'volley' ? 'rgba(160,255,120,' : a.kind === 'meteor' ? 'rgba(255,140,40,' : 'rgba(170,140,255,';
    const edge = enemy ? CUE_RGB[areaCue(a)][1] : a.kind === 'volley' ? '#b7f07a' : a.kind === 'meteor' ? '#ffb347' : '#c9b6ff';
    ctx.save();
    ctx.beginPath();
    this.areaPath(ctx, a, 1);
    ctx.fillStyle = fill + (a.visual ? 0.14 : 0.18) + ')'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = edge; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 18); ctx.stroke();
    ctx.globalAlpha = 1;
    // fill-up progress shows exactly when it lands
    if (a.t < a.delay) {
      ctx.beginPath(); this.areaPath(ctx, a, prog);
      ctx.fillStyle = fill + '0.32)'; ctx.fill();
    }
    ctx.restore();
    if (a.kind === 'meteor' && a.t < a.delay) {
      const k = 1 - prog, big = a.big ? 1.9 : 1, mx = a.x + 160 * k * big, my = a.y - 420 * k * big;
      ctx.save(); glowAt(ctx, mx, my, '#ff7a2c', 46 * big);
      if (a.big) { ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + 120 * big, my - 300 * big); ctx.lineWidth = 34; ctx.strokeStyle = 'rgba(255,140,40,.6)'; ctx.stroke(); ctx.globalAlpha = 1; }
      circle(ctx, mx, my, (26 + 10 * prog) * big, '#ff7a2c', 4); circle(ctx, mx - 6 * big, my - 6 * big, 10 * big, '#ffd23f', 0);
      ctx.restore();
    }
    if (a.kind === 'meteorE' && a.t < a.delay) {
      const k = 1 - prog, mx = a.x - 120 * k, my = a.y - 360 * k;
      circle(ctx, mx, my, 18, '#6b3a8a', 4); circle(ctx, mx - 4, my - 4, 7, '#ff5e3b', 0);
    }
    if (a.kind === 'rock' && a.t < a.delay) {
      const k = 1 - prog, arc = Math.sin(prog * Math.PI) * 140;
      const e = sim.enemyById.get(a.ownerId);
      const sx = e ? e.x : a.x, sy = e ? e.y : a.y;
      const rx = sx + (a.x - sx) * prog, ry = sy + (a.y - sy) * prog - arc;
      circle(ctx, rx, ry, 16, '#9aa3ad', 4);
    }
  }
  areaPath(ctx, a, k) {
    if (a.shape === 'circle' && a.r0) { const r = Math.max(a.r0 + 0.1, a.r0 + (a.r - a.r0) * k); ctx.moveTo(a.x + r, a.y); ctx.arc(a.x, a.y, r, 0, TAU); ctx.moveTo(a.x + a.r0, a.y); ctx.arc(a.x, a.y, a.r0, TAU, 0, true); } // ring (Vyrnhal's quake: safe in the middle)
    else if (a.shape === 'circle') ctx.arc(a.x, a.y, Math.max(0.1, a.r * k), 0, TAU);
    else if (a.shape === 'cone') { ctx.moveTo(a.x, a.y); ctx.arc(a.x, a.y, Math.max(0.1, a.r * k), a.ang - a.arc / 2, a.ang + a.arc / 2); ctx.closePath(); }
    else if (a.shape === 'line') {
      const c = Math.cos(a.ang), s = Math.sin(a.ang), hw = a.w / 2, L = a.len * k;
      ctx.moveTo(a.x - s * hw, a.y + c * hw); ctx.lineTo(a.x - s * hw + c * L, a.y + c * hw + s * L);
      ctx.lineTo(a.x + s * hw + c * L, a.y - c * hw + s * L); ctx.lineTo(a.x + s * hw, a.y - c * hw); ctx.closePath();
    }
  }

  /** Grimoire Summoner pages / runes and Bard notes (overhaul quality: glow, motion streak, crisp outlined shapes). */
  drawArcProj(ctx, pr, x, y, ang) {
    const t = this.time, lite = this.fxLite;
    const col = pr.style === 'note' ? '#ff7ab8' : pr.style === 'rune' ? '#3ff0c8' : '#9ff8e0';
    if (!lite) {
      bloom(ctx, x, y, pr.r * 4.2, col, 0.75);
      const g = ctx.createLinearGradient(x, y, x - pr.vx * 0.08, y - pr.vy * 0.08); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55; ctx.strokeStyle = g; ctx.lineCap = 'round'; ctx.lineWidth = pr.r * 1.5;
      ctx.beginPath(); if (pr.style === 'note') { for (let i = 0; i <= 10; i++) { const k = i / 10, px = x - pr.vx * 0.08 * k, py = y - pr.vy * 0.08 * k + Math.sin(k * 9 - t * 25) * 5 * k; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } } else { ctx.moveTo(x, y); ctx.lineTo(x - pr.vx * 0.08, y - pr.vy * 0.08); }
      ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.translate(x, y);
    if (pr.style === 'page') { // a spinning glowing paper slip with ink lines
      ctx.rotate(ang + t * 14); const w = pr.r * 1.5, h = pr.r * 1.05;
      rrect(ctx, -w, -h, w * 2, h * 2, 2); ctx.fillStyle = '#fff8e6'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.strokeStyle = '#2aa898'; ctx.lineWidth = 1.4; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-w * 0.6, i * h * 0.45); ctx.lineTo(w * 0.6, i * h * 0.45); ctx.stroke(); }
    } else if (pr.style === 'rune') { // a rotating teal rune disc
      ctx.rotate(t * 8); circle(ctx, 0, 0, pr.r, '#0d3b44', 3); ctx.strokeStyle = '#3ff0c8'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 0, pr.r * 0.72, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; ctx.moveTo(Math.cos(a) * pr.r * 0.7, Math.sin(a) * pr.r * 0.7); ctx.lineTo(Math.cos(a + 2.1) * pr.r * 0.7, Math.sin(a + 2.1) * pr.r * 0.7); } ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, pr.r * 0.22, 0, Math.PI * 2); ctx.fillStyle = '#e6fff8'; ctx.fill();
    } else { // a bobbing pink note with an ink outline
      ctx.rotate(Math.sin(t * 12) * 0.25); const s = pr.r * 1.4;
      ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s * 0.12, s * 0.5); ctx.lineTo(s * 0.12, -s * 0.9); ctx.quadraticCurveTo(s * 0.7, -s * 0.6, s * 0.6, -s * 0.1); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-s * 0.22, s * 0.55, s * 0.42, s * 0.3, -0.4, 0, Math.PI * 2); ctx.fillStyle = '#ff7ab8'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = '#ff7ab8'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(s * 0.12, s * 0.5); ctx.lineTo(s * 0.12, -s * 0.9); ctx.quadraticCurveTo(s * 0.7, -s * 0.6, s * 0.6, -s * 0.1); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-s * 0.32, s * 0.47, s * 0.12, s * 0.06, -0.4, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    }
    ctx.restore();
    void mote;
  }
  drawProjectile(ctx, pr, x, y) {
    const ang = Math.atan2(pr.vy, pr.vx);
    if (pr.team === 'player') {
      if (pr.style === 'page' || pr.style === 'rune' || pr.style === 'note') { this.drawArcProj(ctx, pr, x, y, ang); return; }
      if (pr.style === 'arrow' || pr.style === 'bigarrow' || pr.style === 'pierce') {
        const L = pr.style === 'arrow' ? 26 : 38;
        if (!this.fxLite) { // overhaul: a soft motion streak behind every arrow
          const tc = pr.style === 'pierce' ? '#b7f07a' : '#fff6c8';
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
          const g = ctx.createLinearGradient(x, y, x - Math.cos(ang) * 80, y - Math.sin(ang) * 80); g.addColorStop(0, tc); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.45; ctx.strokeStyle = g; ctx.lineWidth = pr.style === 'arrow' ? 6 : 10; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang) * 80, y - Math.sin(ang) * 80); ctx.stroke(); ctx.restore();
        }
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        if (pr.style !== 'arrow' && !this.fxLite) bloomGlow(ctx, pr.style === 'pierce' ? '#b7f07a' : '#fff6c8');
        ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(0, 0); ctx.strokeStyle = INK; ctx.lineWidth = pr.style === 'arrow' ? 5 : 7; ctx.lineCap = 'round'; ctx.stroke();
        ctx.strokeStyle = pr.style === 'pierce' ? '#d7ffc4' : '#f0dca8'; ctx.lineWidth = pr.style === 'arrow' ? 2.5 : 4; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-2, -6); ctx.lineTo(-2, 6); ctx.closePath(); ctx.fillStyle = '#e9eef5'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(-L - 6, -5); ctx.moveTo(-L, 0); ctx.lineTo(-L - 6, 5); ctx.strokeStyle = '#ff5e5b'; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
        if (pr.style === 'pierce') { ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang) * 90, y - Math.sin(ang) * 90); ctx.strokeStyle = '#b7f07a'; ctx.lineWidth = 10; ctx.stroke(); ctx.globalAlpha = 1; }
      } else {
        const col = pr.style === 'orb' ? '#9d7bff' : '#b69cff';
        if (!this.fxLite) { bloom(ctx, x, y, pr.r * 4, col, 0.7); const g = ctx.createLinearGradient(x, y, x - pr.vx * 0.09, y - pr.vy * 0.09); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.strokeStyle = g; ctx.lineCap = 'round'; ctx.lineWidth = pr.r * 1.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - pr.vx * 0.09, y - pr.vy * 0.09); ctx.stroke(); ctx.restore(); }
        ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - pr.vx * 0.05, y - pr.vy * 0.05); ctx.strokeStyle = col; ctx.lineWidth = pr.r * 1.6; ctx.lineCap = 'round'; ctx.stroke(); ctx.globalAlpha = 1;
        circle(ctx, x, y, pr.r, col, 3); // (perf: the bloom above is the glow; no shadowBlur)
        circle(ctx, x - pr.r * 0.3, y - pr.r * 0.3, pr.r * 0.4, '#fff', 0);
      }
      return;
    }
    // enemy bullets: bright, outlined, readable
    if (drawSpear(ctx, pr, x, y)) return; // goblin spears (client/sitesfx.js)
    if (drawFrostProjectile(ctx, pr, x, y, this.fxLite, this.time)) return; // ice shards / snowballs (client/frostfx.js)
    if (drawEmberProjectile(ctx, pr, x, y, this.fxLite, this.time)) return; // embers / basalt / magma / glass (client/emberfx.js)
    if (drawDunesProjectile(ctx, pr, x, y, this.fxLite, this.time)) return; // sand clumps / sun orbs (client/dunesfx.js)
    const cols = { seed: '#c6ff5c', bone: '#fff4d6', spore: '#ff7ab8', hex: '#6fd3ff', dark: '#ff5ce1', fire: '#ff8a3c', orb: '#ff5e5b', leaf: '#9be05a', ember: '#ff8a3c', glass: '#9ff0ff', sun: '#ffd23f' };
    const col = cols[pr.style] || '#ff5e5b';
    if (pr.style === 'bone') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(8, 0); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.stroke();
      ctx.restore();
      return;
    }
    circle(ctx, x, y, pr.r + 1.5, col, 3.5);
    circle(ctx, x - pr.r * 0.3, y - pr.r * 0.3, pr.r * 0.38, 'rgba(255,255,255,.75)', 0);
  }
}

// ---- class stack / state art (shared with the phone renderer through Renderer)
const STATE_COL = { warrior: '#ff8a2a', ranger: '#b8ff7a', mage: '#8fdcff', cleric: '#ffe27a', samurai: '#ffd6ec', monk: '#ffe58a', dragoon: '#b9a8ff', summoner: '#3ff0c8', bard: '#ff7ab8' };
const WIN_COL = { warrior: '#ff5e3b', ranger: '#9dff6a', mage: '#b28cff', cleric: '#ffe27a', samurai: '#dfe8ff', monk: '#ffd23f', dragoon: '#ff3b5c', summoner: '#3ff0c8', bard: '#ffd86a' };
const STACK_RING = { quarry: '#7dff6a', burn: '#ff8a2a', condemn: '#ffd84a', bleed: '#ff3b3b', chal: '#ffc93b', cut: '#ff8cc6', pp: '#ffd23f', impaled: '#ff3b5c', scorch: '#ff7a2a', chill: '#9fe8ff', disso: '#b48cff' };
function stackCap(kind, e) { if (kind === 'chal') return 1; const cl = { quarry: CLASSES.ranger, burn: CLASSES.mage, condemn: CLASSES.cleric, bleed: CLASSES.warrior, cut: CLASSES.samurai, pp: CLASSES.monk, impaled: CLASSES.dragoon, chill: CLASSES.summoner, disso: CLASSES.bard }[kind]; if (kind === 'scorch') return 1; const c = cl && cl.stack; if (!c) return 99; return e.boss ? c.bossMax || c.max : c.max; }
const STACK_ICON = {
  chill(ctx, t) { // Summoner Chill: a frost snowflake (frozen solid = 2 stacks)
    ctx.rotate(t * 0.8); ctx.lineCap = 'round';
    for (const [c, w] of [[INK, 4.5], ['#9fe8ff', 2.2]]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.lineTo(-Math.cos(a) * 8, -Math.sin(a) * 8); } ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, TAU); ctx.fillStyle = '#f0fcff'; ctx.fill();
  },
  disso(ctx, t) { // Bard Dissonant: a cracked violet note
    ctx.rotate(Math.sin(t * 9) * 0.15);
    ctx.beginPath(); ctx.ellipse(-2.5, 4, 4.5, 3.2, -0.4, 0, TAU); ctx.fillStyle = '#b48cff'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1.5, 3.5); ctx.lineTo(1.5, -8); ctx.lineTo(6, -5); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#b48cff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-2, -2); ctx.lineTo(-5, 0); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
  },
  impaled(ctx, t) { // Dragoon pin: a small crimson-tipped spear
    ctx.rotate(-0.8 + Math.sin(t * 5) * 0.06);
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(6, 0); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#7a5cff'; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(4, -4); ctx.lineTo(4, 4); ctx.closePath(); ctx.fillStyle = '#ff3b5c'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
  },
  scorch(ctx, t) { // Dragoon Scorched: a flame inside a dive chevron
    const f = 1 + 0.15 * Math.sin(t * 14);
    ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(0, 2); ctx.lineTo(8, -6); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.scale(f, f); ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(6, -2, 0, 6); ctx.quadraticCurveTo(-6, -2, 0, -9); ctx.fillStyle = '#ff8a2a'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
  },
  pp(ctx, t) { // Monk Pressure Point: a small golden point with a pulsing ring
    ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, TAU); ctx.fillStyle = 'rgba(60,30,0,.85)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 4.5 + Math.sin(t * 8) * 0.8, 0, TAU); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 2, 0, TAU); ctx.fillStyle = '#fffaf0'; ctx.fill();
  },
  cut(ctx, t) { // Samurai Delayed Cut: a small glowing pink slash
    ctx.rotate(-0.7 + Math.sin(t * 4) * 0.08);
    ctx.beginPath(); ctx.moveTo(-9, 1.5); ctx.quadraticCurveTo(0, -4, 9, -1.5); ctx.quadraticCurveTo(0, 1, -9, 1.5); ctx.fillStyle = '#ff8cc6'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, 0.5); ctx.lineTo(6, -1.2); ctx.strokeStyle = '#fff3fa'; ctx.lineWidth = 1.3; ctx.stroke();
  },
  bleed(ctx, t) { // Weapon Master Bleed: a red drop
    ctx.scale(1, 1 + 0.08 * Math.sin(t * 10));
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.bezierCurveTo(6, -1, 6, 6, 0, 7); ctx.bezierCurveTo(-6, 6, -6, -1, 0, -9); ctx.fillStyle = '#d61f2c'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.arc(-2, 2, 1.8, 0, TAU); ctx.fillStyle = '#ff9a9a'; ctx.fill();
  },
  chal(ctx, t) { // Challenge: a gold crossed-swords crest
    ctx.rotate(Math.sin(t * 3) * 0.15);
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fillStyle = 'rgba(60,40,0,.85)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.moveTo(5, -5); ctx.lineTo(-5, 5); ctx.strokeStyle = '#ffc93b'; ctx.lineWidth = 2.6; ctx.stroke();
  },
  quarry(ctx) { // green crosshair
    ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, TAU); ctx.fillStyle = 'rgba(20,50,10,.8)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.strokeStyle = '#7dff6a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-2, 0); ctx.moveTo(2, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, -2); ctx.moveTo(0, 2); ctx.lineTo(0, 8); ctx.stroke();
  },
  burn(ctx, t) { // flame
    const f = 1 + 0.12 * Math.sin(t * 16);
    ctx.scale(1, f);
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.bezierCurveTo(6, -3, 7, 3, 0, 7); ctx.bezierCurveTo(-7, 3, -6, -3, 0, -9); ctx.fillStyle = '#ff6a1a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.bezierCurveTo(3, 0, 3, 4, 0, 5); ctx.bezierCurveTo(-3, 4, -3, 0, 0, -3); ctx.fillStyle = '#ffe27a'; ctx.fill();
  },
  condemn(ctx, t) { // gold sigil: a diamond with a cross, slowly turning
    ctx.rotate(Math.sin(t * 2) * 0.3);
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(7, 0); ctx.lineTo(0, 8); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fillStyle = '#ffd84a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#fff8d8'; ctx.fillRect(-1, -5, 2, 10); ctx.fillRect(-4, -2, 8, 2);
  },
};

/** dodge pass 2 step 5: slam beats - a "1 2 3" counter inside the footprint, the next beat lit (drawn after every area fill) */
function drawBeat(ctx, a) {
  const left = a.delay - a.t, next = left <= 24; ctx.save(); ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
  ctx.globalAlpha = next ? 1 : 0.35; ctx.lineWidth = 4; ctx.strokeStyle = INK; const bx = a.x + (a.beat - (a.beats + 1) / 2) * 30, by = a.y + (a.r || 0) * 0.8;
  ctx.strokeText(String(a.beat), bx, by); ctx.fillStyle = next ? '#ffe27a' : '#ffffff'; ctx.fillText(String(a.beat), bx, by); ctx.restore();
}
