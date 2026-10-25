// Big map (2026-10-06): a large, see-through map of the WHOLE current zone over the running game (not a pause).
// Open / close: the Big map key (',' by default: M is Mute in both key profiles; rebindable), a click on the HUD minimap;
// the key again, Esc or a click outside the map closes it. Open world (Wilds / Dunes / Frostveil / Emberdeep): the
// walkability-corrected biome map (worldmap.js biomeMap: the same canvas the minimap reads) + spawn sites (alive /
// cleared), elite packs, world bosses (alive / down), the Swarm event, dungeon portals, the camp, your story objective,
// party members, pings and you (with facing). The static layer (map + sites) is baked into an offscreen canvas and only
// re-baked when the size or a site's state changes; markers are drawn per frame. Dungeons / trials / the raid / the
// Star Sanctum / town: their own full-layout minimap drawn big. Drawn as the HUD's last layer (so both the solo and the
// co-op game get it and it sits above the HUD layer canvas).
import { CLASSES } from '../sim/data/classes.js';
import { INK, circle, rrect } from './art.js';
import { biomeMap, BIOME, SEA_COL, skull, crown, bossAlive } from './worldmap.js';
import { swarmState, swarmIcon } from './sitesfx.js';
import { fisState, fissureIcon } from './fissurefx.js';
import { drawOpsMinimap } from './opsfx.js';
import { drawOpsIcon, drawGateMarker } from './opsicons.js';
import { inOpsArea, opsArenaAt, OPS_TYPE, OPS_TYPES, OPS_BIOME, BOSS_GATES } from '../sim/opsconst.js';
import { uiOn, uiIcon } from './uipaint.js';
import { drawTownMinimap } from './townfx.js';
import { drawTavernMinimap, tavernOn } from './tavernfx.js';
import { inTownArea, TOWN_NAME } from '../sim/townconst.js';
import { drawRaidMinimap } from './raidfx.js';
import { drawAstraelMinimap } from './astraelfx.js';
import { inAstArea } from '../sim/astraelconst.js';
import { drawUltMinimap, inUlt } from './ultfx.js';
import { inUltArea } from '../sim/ultimate.js';
import { drawTrialMinimap } from './trialfx.js';
import { inTrialArea } from '../sim/trialconst.js';
import { inRaidArea } from '../sim/constants.js';
import { drawTombMinimap } from './tombfx.js';
import { drawCryptMinimap } from './cryptfx.js';
import { drawGlowMinimap } from './glowfx.js';
import { inHollowArea, inTorArea } from '../sim/glowconst.js';
import { inFrostArea, inCryptArea } from '../sim/frostconst.js';
import { drawForgeMinimap } from './forgefx.js';
import { inEmberArea, inForgeArea } from '../sim/emberconst.js';
import { inRiftArea } from '../sim/riftconst.js';
import { inDunesArea, inTombArea } from '../sim/dunesconst.js';
import { newCanvas } from './sprite.js';
import { PROFILE_KEY } from '../sim/meta.js';
import { worldMarkers, townMarkers, pickMarker, drawMarkerTip, MIN_HIT, MIN_HIT_TOUCH } from './mapmarkers.js';
import { TOWN_POS, TOWN_R } from '../sim/townconst.js';

const TAU = Math.PI * 2;
export const BIGMAP = { margin: 26, top: 56, alpha: 0.8, dim: 'rgba(8,6,16,.42)' };
export const AREA_NAME = { wilds: 'The Wilds', dunes: 'Sunscorch Dunes', frost: 'Frostveil Peaks', ember: 'Emberdeep Caldera', rift: 'The Astral Rift', town: TOWN_NAME, tomb: 'Tomb of the Sun-Eaten King', crypt: 'The Glacier Crypt', hollow: 'The Glowmire Hollow', tor: 'The Stormcrown Tor', forge: 'The Forge of Cinders', trial: 'Trial', raid: 'The Rift Sanctum', astrael: 'The Star Sanctum', ultimate: 'The Unwritten Throne' };
const DUNGEON = { raid: drawRaidMinimap, astrael: drawAstraelMinimap, ultimate: (ctx, x, y, R, sim, p) => drawUltMinimap(ctx, x, y, R, sim, p, CLASSES), trial: drawTrialMinimap, tomb: drawTombMinimap, crypt: drawCryptMinimap, hollow: drawGlowMinimap, tor: drawGlowMinimap, forge: drawForgeMinimap, ops: drawOpsMinimap };
/** the story chapter -> its world boss (the objective marker) */
const OBJ_BOSS = { grimtusk: 'grimtusk', dunes: 'khepra' };

/** Which map the hero is on (same order as the HUD minimap's checks). */
export function areaKind(sim, p) {
  if (!p) return null;
  if (sim.raid && inRaidArea(p.x, p.y)) return 'raid';
  if (inOpsArea(p.x, p.y)) return 'ops'; // a mission dungeon
  if (inAstArea(p.x, p.y)) return 'astrael';
  if (inUltArea(p.x, p.y) || inUlt(p)) return 'ultimate';
  if (inTrialArea(p.x, p.y)) return 'trial';
  if (inTombArea(p.x, p.y)) return 'tomb';
  if (inCryptArea(p.x, p.y)) return 'crypt';
  if (inTorArea(p.x, p.y)) return 'tor';
  if (inHollowArea(p.x, p.y)) return 'hollow';
  if (inForgeArea(p.x, p.y)) return 'forge';
  if (inRiftArea(p.x, p.y)) return 'rift'; // (game loop C3)
  if (inEmberArea(p.x, p.y)) return 'ember';
  if (inFrostArea(p.x, p.y)) return 'frost';
  if (inDunesArea(p.x, p.y)) return 'dunes';
  if (inTownArea(p.x, p.y)) return 'town';
  return sim.world && sim.world.spawners ? 'wilds' : null;
}
/** The map square: as big as fits under the header with a margin (screen px). */
export function fitRect(w, h, o = BIGMAP) {
  const S = Math.max(160, Math.floor(Math.min(w - o.margin * 2, h - o.top - o.margin)));
  return { x: Math.round((w - S) / 2), y: Math.max(o.top, Math.round(o.top + (h - o.top - o.margin - S) / 2)), w: S, h: S };
}
/** world.sites entry -> its biome */
export const siteBiome = (d) => (d.key === 'dunes' || d.key === 'frost' || d.key === 'ember' || d.key === 'rift' ? d.key : 'wilds');
/** Spawn-site markers of a biome: { x, y, st: 'alive' | 'active' | 'cleared' | 'unknown', lm } (co-op views carry no site state). */
export function siteMarkers(sim, biome) {
  const defs = (sim.world && sim.world.sites) || [], H = sim.horde && sim.horde.sites, out = [];
  defs.forEach((d, i) => {
    if (siteBiome(d) !== biome) return;
    const S = H && H[i] && H[i].d === d ? H[i] : H ? H.find((q) => q.d === d) : null;
    out.push({ x: d.x, y: d.y, lm: d.lm, st: !S ? 'unknown' : S.st === 'cleared' ? 'cleared' : S.m && S.m.length ? 'active' : 'alive' });
  });
  return out;
}
const SITE_COL = { alive: '#ff7a3c', active: '#ff3b3b', cleared: 'rgba(225,225,225,.75)', unknown: '#ffb070' };
function siteIcon(g, x, y, st, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.beginPath(); g.moveTo(0, -6); g.lineTo(6, 0); g.lineTo(0, 6); g.lineTo(-6, 0); g.closePath(); // a diamond (the minimap's site language: small, inked)
  g.fillStyle = st === 'cleared' ? 'rgba(40,36,48,.55)' : SITE_COL[st]; g.fill(); g.lineWidth = 1.8; g.strokeStyle = st === 'cleared' ? SITE_COL.cleared : INK; g.stroke();
  if (st === 'cleared') { g.beginPath(); g.moveTo(-2.5, 0); g.lineTo(-0.5, 2.2); g.lineTo(3, -2.2); g.strokeStyle = '#e8e8e8'; g.lineWidth = 1.5; g.stroke(); }
  g.restore();
}
function arrow(ctx, x, y, ang, s, col = '#fff') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-3, 0); ctx.lineTo(-6, 6); ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
}
function label(ctx, s, x, y, size, col = '#fff', align = 'left') {
  ctx.font = `bold ${size}px "Lilita One", "Trebuchet MS", sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.24); ctx.strokeStyle = INK; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y);
}

/** a panel / dialog is up (results, story, a village service, Progress, the Mission Counter, the Realm Gate overlay):
 *  the big map must not open underneath it (it is drawn on the game canvas, below every DOM panel) */
export function modalUp(g) {
  const on = (o) => !!(o && (typeof o.isOpen === 'function' ? o.isOpen() : o.open));
  return on(g.rewards) || on(g.story) || on(g.village) || on(g.progress) || !!(g.town && g.town.open) || !!(g.ops && g.ops.open) || !!(g.town && g.town.map && g.town.map.open && !g.town.map.inHub) || on(g.menuHub);
}
export class BigMap {
  constructor() { this._open = false; this.rect = null; this.mm = null; this.cache = null; this.kind = null; this.obj = null; this.marks = []; this.toS = null; this.ms = 1; this.mouse = null; this.pin = null; this.hover = null; this.touch = false; }
  get open() { return this._open; }
  set open(v) { v = !!v; if (v === this._open) return; this._open = v; this.pin = null; this.hover = null; if (!v && this.cv && this.cv.style) this.cv.style.cursor = ''; if (typeof document !== 'undefined' && document.body) document.body.classList.toggle('bigmap-open', v); } // (CSS hides the quest tracker over the map)
  toggle(v) { this.open = v ?? !this.open; if (this.open) this.obj = null; return this.open; }
  close() { const was = this.open; this.open = false; return was; }
  /** the HUD minimap's circle (HUD / CSS px), so a click on it opens the map */
  setMinimap(x, y, r) { this.mm = { x, y, r }; }
  onMinimap(mx, my) { return !!this.mm && Math.hypot(mx - this.mm.x, my - this.mm.y) <= this.mm.r; }
  inside(mx, my) { const r = this.rect; return !!r && mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h; }
  /**
   * Mouse: capture-phase mousedown on the game canvas. Open: a click outside the map closes it, a click on it does
   * nothing (never an attack); closed: a click on the minimap opens it. `active()`: the game is live (no menu, no pause).
   */
  attach(canvas, active = () => true) {
    if (typeof addEventListener === 'undefined' || !canvas) return;
    this.cv = canvas;
    this.onDown = (e) => {
      if (e.target !== canvas || !active()) return;
      const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      if (this.open) { if (e.button === 0 && this.inside(mx, my)) this.tap(mx, my, false); else this.open = false; }
      else if (e.button === 0 && this.onMinimap(mx, my)) this.open = true;
      else return;
      e.preventDefault(); e.stopImmediatePropagation();
    };
    this.onMove = (e) => {
      if (!this.open) { this.mouse = null; return; }
      const r = canvas.getBoundingClientRect(); this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      const over = e.target === canvas && this.pick(this.mouse.x, this.mouse.y);
      canvas.style.cursor = over ? 'pointer' : 'default';
    };
    addEventListener('mousedown', this.onDown, true); addEventListener('mousemove', this.onMove, true);
  }
  detach() { if (this.onDown) removeEventListener('mousedown', this.onDown, true); if (this.onMove) removeEventListener('mousemove', this.onMove, true); this.onDown = this.onMove = null; }
  /** the icon under (mx, my) on the open map (HUD / CSS px) */
  pick(mx, my) { return this.toS && this.marks.length ? pickMarker(this.marks, mx, my, this.toS, this.ms, this.touch ? MIN_HIT_TOUCH : MIN_HIT) : null; }
  /**
   * A click / tap on the open map: an icon (pins its info card; again: unpins), else
   * (phone: anywhere else closes it) unpin. Returns true when handled.
   */
  tap(mx, my, touch) {
    if (!this.open) return false;
    this.touch = !!touch;
    const m = this.pick(mx, my);
    if (m) { this.pin = this.pin && this.pin.kind === m.kind && this.pin.name === m.name && this.pin.x === m.x ? null : m; return true; }
    if (touch && !this.pin) { this.open = false; return true; }
    this.pin = null; return true;
  }
  objective() {
    if (this.obj !== null) return this.obj;
    this.obj = '';
    try { const pr = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); const st = pr && pr.story, done = (st && st.done) || {}; for (const id of ['grimtusk', 'dunes']) if (!done[id]) { this.obj = OBJ_BOSS[id]; break; } } catch { /* no profile */ }
    return this.obj;
  }
  /** Draw (the HUD's last layer). keyLabel: the current key for the Big map action. */
  draw(ctx, w, h, sim, p, time, o = {}) {
    if (!this.open || !p) return;
    if (typeof window !== 'undefined' && window.__rb && window.__rb.intro && !window.__rb.intro.done) return; // (never during the launch intro)
    const kind = areaKind(sim, p); this.kind = kind; this.marks = []; this.toS = null;
    const R = fitRect(w, h, o.fit || BIGMAP); this.rect = R;
    ctx.save();
    ctx.fillStyle = BIGMAP.dim; ctx.fillRect(0, 0, w, h);
    if (BIOME[kind]) this.drawWorld(ctx, R, kind, sim, p, time, o);
    else if (kind === 'town') this.drawTown(ctx, R, sim, p, time);
    else if (DUNGEON[kind]) { const z = 2; ctx.save(); ctx.globalAlpha = BIGMAP.alpha; ctx.translate(R.x + R.w / 2, R.y + R.h / 2); ctx.scale(z, z); DUNGEON[kind](ctx, 0, 0, (R.w / 2 - 8) / z, sim, p, CLASSES); ctx.restore(); // (its own full-layout minimap, drawn big at 2x so the markers read)
      this.legend(ctx, R, [['dot', 'You (white dot)'], ['party', 'Party (class colour)']]); }
    else label(ctx, 'No map here', w / 2, R.y + R.h / 2, 22, '#fff', 'center');
    const OA = kind === 'ops' && opsArenaAt(p.x, p.y), tw = this.chip(ctx, `MAP · ${OA ? `${OPS_TYPE[OA.type].name} · ${OPS_BIOME[OA.biome].name}` : AREA_NAME[kind] || 'Here'}`, R.x + 12, R.y + 12, 18, '#ffd23f', 'left'), hint = o.hint || `Click an icon: info · ${o.key || ','} / Esc / click outside: close`;
    ctx.font = 'bold 12px "Lilita One", "Trebuchet MS", sans-serif'; const fits = tw + ctx.measureText(hint).width + 56 < R.w;
    this.chip(ctx, hint, R.x + R.w - 12, fits ? R.y + 12 : R.y + R.h - 36, 12, '#e9e2ff', 'right'); // (narrow screens: the hint drops to the bottom corner)
    // hover / pinned info cards (every icon: client/mapmarkers.js)
    if (this.pin) { const q = this.marks.find((m) => m.kind === this.pin.kind && m.name === this.pin.name) || this.pin, s = this.toS ? this.toS(q.x, q.y) : { x: this.pin.sx, y: this.pin.sy }; drawMarkerTip(ctx, { ...q, sx: s.x, sy: s.y }, R.x, R.y, R.w, R.h, true); }
    const hv = !this.touch && this.mouse ? this.pick(this.mouse.x, this.mouse.y) : null;
    if (hv && !(this.pin && hv.name === this.pin.name && hv.kind === this.pin.kind)) drawMarkerTip(ctx, hv, R.x, R.y, R.w, R.h, false);
    ctx.restore();
  }
  /** a small dark plate with a label (the map's corners) */
  chip(ctx, s, x, y, size, col, align) {
    ctx.font = `bold ${size}px "Lilita One", "Trebuchet MS", sans-serif`;
    const tw = ctx.measureText(s).width, pw = tw + 20, ph = size + 12, x0 = align === 'right' ? x - pw : x;
    rrect(ctx, x0, y, pw, ph, 8); ctx.fillStyle = 'rgba(18,12,28,.75)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.stroke();
    label(ctx, s, x0 + 10, y + ph / 2 + 1, size, col, 'left');
    return pw;
  }
  /** the baked static layer: the biome map + spawn sites (re-baked when the size or any site's state changes) */
  layer(R, biome, sim, sites) {
    const sig = biome + '|' + R.w + '|' + sites.map((s) => s.st[0]).join('') + '|' + (sim.world && sim.world.obstacles ? sim.world.obstacles.length : 0);
    if (this.cache && this.cache.sig === sig) return this.cache;
    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1, px = Math.round(R.w * dpr);
    const c = this.cache && this.cache.c.width === px ? this.cache.c : newCanvas(px, px), g = c.getContext('2d');
    const M = biomeMap(biome, sim.world), q = px / M.c.width, k = M.k * q;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, px, px);
    g.imageSmoothingEnabled = true; g.drawImage(M.c, 0, 0, px, px);
    const X = (wx) => px / 2 + (wx - M.S.cx) * k, Y = (wy) => px / 2 + (wy - M.S.cy) * k;
    for (const s of sites) siteIcon(g, X(s.x), Y(s.y), s.st, Math.max(0.7, px / 900) * 0.95);
    for (const e of M.elites) crown(g, X(e.x), Y(e.y), '#ffcf3a', Math.max(1, px / 700));
    this.cache = { sig, c, M, k: k / dpr, dpr };
    return this.cache;
  }
  drawWorld(ctx, R, biome, sim, p, time, o) {
    const sites = siteMarkers(sim, biome), L = this.layer(R, biome, sim, sites), M = L.M, k = L.k;
    const X = (wx) => R.x + R.w / 2 + (wx - M.S.cx) * k, Y = (wy) => R.y + R.h / 2 + (wy - M.S.cy) * k;
    this.marks = worldMarkers(sim, biome, p, sites); this.toS = (wx, wy) => ({ x: X(wx), y: Y(wy) }); this.ms = Math.max(1, R.w / 640);
    ctx.save(); rrect(ctx, R.x, R.y, R.w, R.h, 14); ctx.clip();
    ctx.globalAlpha = BIGMAP.alpha; ctx.fillStyle = SEA_COL[biome] || '#3fa9e0'; ctx.fillRect(R.x, R.y, R.w, R.h);
    ctx.drawImage(L.c, R.x, R.y, R.w, R.h); ctx.globalAlpha = 1;
    const s = Math.max(1, R.w / 640), pulse = 0.5 + 0.5 * Math.sin(time * 6);
    // camp (the biome's base / the Wilds' campfire)
    const C = M.B.camp || (biome === 'wilds' ? { x: 0, y: 0 } : null);
    if (C) { circle(ctx, X(C.x), Y(C.y), 7 * s, '#ffe6a0', 2.5); label(ctx, biome === 'wilds' ? 'Campfire' : 'Camp', X(C.x), Y(C.y) + 16 * s, 11 * s, '#ffe6a0', 'center'); }
    // the fixed mission entrances (5 types) + the boss dungeon entrances (Tomb / Crypt / Forge)
    const gates = !sim.noPortals && sim.world && sim.world.opsGates ? sim.world.opsGates.filter((g) => g.biome === biome) : [];
    for (const g of gates) { const gx = X(g.x), gy = Y(g.y); drawGateMarker(ctx, g, gx, gy, 1.15 * s); }
    // world bosses (alive / down) + the story objective
    const obj = this.objective();
    for (const b of M.B.bosses) {
      const st = M.B.sites(b), alive = bossAlive(sim, M.B.types[b]), bx = X(st.x), by = Y(st.y);
      if (b === obj && alive) { ctx.globalAlpha = 0.55 + 0.45 * pulse; circle(ctx, bx, by, 17 * s, null, 3, '#ffd23f'); ctx.globalAlpha = 1; label(ctx, 'OBJECTIVE', bx, by - 24 * s, 11 * s, '#ffd23f', 'center'); }
      if (!(uiOn() && uiIcon(ctx, 'g_boss', bx, by, 22 * s, 5, alive ? 1 : 0.45))) skull(ctx, bx, by, alive ? '#ff5e5b' : 'rgba(255,255,255,.55)', 1.5 * s);
    }
    // Swarm event
    const SW = swarmState(sim);
    if (SW && SW.st !== 'idle') { const sx = SW.ch ? SW.ch[0] : SW.x, sy = SW.ch ? SW.ch[1] : SW.y; swarmIcon(ctx, X(sx), Y(sy), 1.5 * s, time); label(ctx, 'SWARM', X(sx), Y(sy) + 18 * s, 11 * s, '#ffb0a0', 'center'); }
    for (const f of fisState(sim)) { fissureIcon(ctx, X(f.x), Y(f.y), 1.6 * s, time); label(ctx, 'FISSURE', X(f.x), Y(f.y) + 18 * s, 11 * s, '#c06bff', 'center'); } // (Part A4)
    // your loot on the ground, pings, party, you
    for (const b of sim.bags || []) if (b.ownerId === p.id) { ctx.fillStyle = ['#e8d2b0', '#4aa8ff', '#b86bff', '#ffb52e', '#2ee6c4', '#ff4f7b'][b.rarity] || '#fff'; ctx.fillRect(X(b.x) - 2.5, Y(b.y) - 2.5, 5, 5); }
    for (const pg of o.pings || []) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin((pg.t || 0) * 10); circle(ctx, X(pg.x), Y(pg.y), 7 * s, null, 3, '#ffd23f'); ctx.globalAlpha = 1; }
    if (sim.players) for (const q of sim.players.values()) {
      if (q.id === p.id || q.dead) continue;
      const col = CLASSES[q.cls] ? CLASSES[q.cls].color : '#fff';
      arrow(ctx, X(q.x), Y(q.y), q.aim, 0.9 * s, col); label(ctx, String(q.name || '').slice(0, 10), X(q.x), Y(q.y) - 14 * s, 10 * s, col, 'center');
    }
    circle(ctx, X(p.x), Y(p.y), (11 + 3 * pulse) * s, null, 2, 'rgba(255,255,255,.8)');
    arrow(ctx, X(p.x), Y(p.y), p.aim, 1.25 * s);
    ctx.restore();
    rrect(ctx, R.x, R.y, R.w, R.h, 14); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    const alive = sites.filter((q) => q.st !== 'cleared').length;
    this.legend(ctx, R, [['you', 'You'], ['party', 'Party'], ['site', `Spawn site (${alive}/${sites.length} up)`], ['cleared', 'Cleared site'], ['elite', 'Elite pack'], ['boss', 'World boss'], ['swarm', 'Swarm event'], ['obj', 'Objective'], ...OPS_TYPES.map((t) => ['op:' + t, OPS_TYPE[t].name + ' mission']), ...gates.filter((g) => g.type === 'boss').map((g) => ['op:boss:' + g.dungeon, BOSS_GATES[g.dungeon].name.replace(/^The /, '')])]);
  }
  drawTown(ctx, R, sim, p, time) {
    const others = sim.players ? [...sim.players.values()].filter((q) => q.id !== p.id && !q.dead) : [];
    const z = 1.6; ctx.save(); rrect(ctx, R.x, R.y, R.w, R.h, 14); ctx.clip(); ctx.translate(R.x, R.y); ctx.scale(z, z); ctx.globalAlpha = BIGMAP.alpha;
    if (tavernOn(sim)) { this.marks = []; this.toS = null; } else { const S = R.w / z, k = S / (TOWN_R * 2 + 120); this.marks = townMarkers(sim, p); this.toS = (wx, wy) => ({ x: R.x + (S / 2 + (wx - TOWN_POS.x) * k) * z, y: R.y + (S / 2 + (wy - TOWN_POS.y) * k) * z }); this.ms = Math.max(1, R.w / 640); }
    if (tavernOn(sim)) drawTavernMinimap(ctx, R.w / z, p, others); else drawTownMinimap(ctx, R.w / z, p, others, time);
    ctx.restore();
    rrect(ctx, R.x, R.y, R.w, R.h, 14); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    this.legend(ctx, R, [['dot', 'You (white dot)'], ['party', 'Party (class colour)']]);
  }
  legend(ctx, R, rows) {
    const s = Math.max(1, R.w / 760), lh = 19 * s, bw = 190 * s, bh = rows.length * lh + 12 * s, out = R.x >= bw + 24, x = out ? R.x - bw - 14 : R.x + 10 * s, y = R.y + R.h - bh - (out ? 0 : 10 * s); // (beside the map when it fits, else in its corner)
    ctx.save(); rrect(ctx, x, y, bw, bh, 9 * s); ctx.fillStyle = 'rgba(18,12,28,.72)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.stroke();
    rows.forEach(([id, txt], i) => {
      const ix = x + 14 * s, iy = y + 6 * s + lh * (i + 0.5);
      if (id === 'you') arrow(ctx, ix, iy, 0, 0.8 * s); else if (id === 'dot') circle(ctx, ix, iy, 4 * s, '#fff', 2); else if (id === 'party') arrow(ctx, ix, iy, 0, 0.7 * s, '#7ad7ff');
      else if (id === 'site') siteIcon(ctx, ix, iy, 'alive', 0.9 * s); else if (id === 'cleared') siteIcon(ctx, ix, iy, 'cleared', 0.9 * s);
      else if (id === 'elite') crown(ctx, ix, iy, '#ffcf3a', 1.1 * s); else if (id === 'boss') skull(ctx, ix, iy, '#ff5e5b', 1.05 * s);
      else if (id === 'swarm') swarmIcon(ctx, ix, iy, 0.85 * s, 0); else if (id === 'portal') circle(ctx, ix, iy, 6 * s, '#2ee6c4', 2);
      else if (id === 'obj') circle(ctx, ix, iy, 7 * s, null, 2.5, '#ffd23f');
      else if (id.startsWith('op:boss:')) drawOpsIcon(ctx, 'crown', ix, iy, 0.72 * s, BOSS_GATES[id.slice(8)].col);
      else if (id.startsWith('op:')) drawOpsIcon(ctx, OPS_TYPE[id.slice(3)].icon, ix, iy, 0.72 * s, OPS_TYPE[id.slice(3)].col);
      label(ctx, txt, ix + 14 * s, iy, 12 * s, '#fff');
    });
    ctx.restore();
  }
}
