// Screen-space HUD: bars, skill bar with cooldowns, minimap, zone banner, combo counter, chain list, boss bar.
import { dodgePipsRow, dodgeCdK, sprintChip } from './sprintfx.js';
import { playerLabel } from '../sim/acctname.js';
import { heroOf } from '../sim/heroes.js';
import { drawSwarmHud } from './sitesfx.js';
import { drawGearMeter } from './gearfx.js';
import { CLASSES, dodgeOf, GCD } from '../sim/data/classes.js';
import { hudChains } from '../sim/loadout.js';
import { ZONES, WORLD_R, BOSS_POS, BOSS_ARENA_R, zoneAt } from '../sim/constants.js';
import { xpToNext, MAX_LEVEL } from '../sim/progression.js';
import { primedChains, routeGuide } from '../sim/player.js';
import { gloryMeter, trinityPanel, wmIcon, weaponRing } from './wmhud.js';
import { focusMeter, samIcon, cutsOut } from './samhud.js';
import { chiMeter, comboBadge, monkIcon } from './monkhud.js';
import { bloodMeter, diveBadge, drgIcon } from './drghud.js';
import { arcMeter, songBadge, arcIcon } from './archud.js'; // Grimoire Summoner + Bard
import { specIcon } from './fxspec.js';
import { BR, BR_CLS } from '../sim/bossrot.js';
import { specInfo } from '../sim/specials.js';
import { stateDef, statePrimed, stackN, STACKS } from '../sim/kit.js';
import { INK, circle, rrect, star, heroColors } from './art.js';
import { drawHeroPortrait } from './heropaint.js';
import { ZONE_GROUND } from './render.js';
import { drawTownMinimap, townDistrict } from './townfx.js';
import { drawTavernMinimap, tavernOn } from './tavernfx.js';
import { inTownArea } from '../sim/townconst.js';
import { FONT } from './fx.js';
import { drawAstralTag } from './astralbossfx.js'; // (Part C2)
import { momentOn } from './fxmoment.js'; // your own finisher's title band replaces the stacked banners
import { drawRaidBar, drawRaidCallout, drawRaidMinimap } from './raidfx.js';
import { drawAstraelHud, drawAstraelMinimap } from './astraelfx.js';
import { DC, drawDuelHud } from './duelcine.js';
import { ENC, drawEncHud } from './encountercine.js';
import { inAstArea } from '../sim/astraelconst.js';
import { drawTrialHud, drawTrialMinimap } from './trialfx.js';
import { drawUltHud, drawUltMinimap, inUlt } from './ultfx.js';
import { inTrialArea } from '../sim/trialconst.js';
import { inRaidArea } from '../sim/constants.js';
import { drawDunesMinimap } from './dunesfx.js';
import { drawWorldMinimap } from './worldmap.js';
import { BigMap } from './bigmap.js';
import { drawTombHud, drawTombMinimap } from './tombfx.js';
import { drawCryptHud, drawCryptMinimap } from './cryptfx.js';
import { drawGlowHud, drawGlowMinimap } from './glowfx.js';
import { inHollowArea, inTorArea } from '../sim/glowconst.js';
import { inFrostArea, inCryptArea } from '../sim/frostconst.js';
import { drawForgeHud, drawForgeMinimap } from './forgefx.js';
import { drawOpsHud, drawOpsMinimap } from './opsfx.js'; // mission dungeons
import { inOpsArea } from '../sim/opsconst.js';
import { inEmberArea, inForgeArea } from '../sim/emberconst.js';
import { inRiftArea } from '../sim/riftconst.js';
import { inDunesArea, inTombArea } from '../sim/dunesconst.js';
import { uiOn, uiAround, uiSeg, uiIcon, ui9, hasIcon, skillIconKey } from './uipaint.js'; // painted world stage: the ornate U1 frames + K / B icons (Art style = Painted)
/** Zone readout inside Vorthax's arena. */
export const RAID_ZONE = { id: 99, name: 'The Rift Sanctum', danger: 4 };
export const AST_ZONE = { id: 98, name: 'The Star Sanctum', danger: 4 };
export const zoneHere = (p) => (inRaidArea(p.x, p.y) ? RAID_ZONE : inAstArea(p.x, p.y) ? AST_ZONE : zoneAt(p.x, p.y));

const TAU = Math.PI * 2;
const DANGER_COL = ['#8fff8a', '#d4ff5c', '#ffd23f', '#ff9a3c', '#ff4d4d', '#ff3b8a', '#d42bff'];

import { drawText, glowRR } from './textcache.js';
import { altOn, ASC_ALT } from '../sim/ascalt.js'; // (Part D A3: the Astral skill variant's star badge)
function txt(ctx, s, x, y, size, color = '#fff', align = 'left', lw = null) {
  size = Math.round(size * 2) / 2; // (pulsing labels: half-pixel steps keep the bitmap cache small)
  drawText(ctx, s, x, y, `${size}px ${FONT}`, color, align, lw === 0 ? 0 : lw ?? Math.max(3, size * 0.22), INK, size); // cached bitmap (client/textcache.js); lw 0 = no outline
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.font = `${size}px ${FONT}`; // (callers measure / draw after txt with this state)
}
function bar(ctx, x, y, w, h, k, col, label, ghost = null) {
  rrect(ctx, x - 3, y - 3, w + 6, h + 6, (h + 6) / 2); ctx.fillStyle = INK; ctx.fill();
  rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
  if (ghost != null && ghost > k) { rrect(ctx, x, y, Math.max(h, w * ghost), h, h / 2); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill(); }
  if (k > 0) { rrect(ctx, x, y, Math.max(h, w * k), h, h / 2); ctx.fillStyle = col; ctx.fill();
    rrect(ctx, x + 4, y + 2, Math.max(0, w * k - 8), h * 0.32, h * 0.16); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fill(); }
  if (label) txt(ctx, label, x + w / 2, y + h / 2 + 1, Math.round(h * 0.78), '#fff', 'center');
}

/** painted bar: the U1 frame (hpbar / resbar / bossbar) drawn first, the fill inside its dark well, the text over it */
function pbar(ctx, x, y, w, h, k, col, label, ghost = null, frame = 'hpbar') {
  if (!uiOn() || h < 9 || !uiSeg(ctx, frame, x, y, w, h)) return bar(ctx, x, y, w, h, k, col, label, ghost);
  ctx.save(); rrect(ctx, x, y, w, h, Math.min(h / 2, 5)); ctx.clip();
  if (ghost != null && ghost > k) { ctx.fillStyle = 'rgba(255,236,210,.45)'; ctx.fillRect(x, y, w * ghost, h); }
  if (k > 0) {
    ctx.fillStyle = col; ctx.fillRect(x, y, w * k, h);
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,.38)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.38)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w * k, h);
  }
  ctx.restore();
  if (label) txt(ctx, label, x + w / 2, y + h / 2 + 1, Math.round(h * 0.78), '#fff', 'center');
}
/** B1 / B2 icon per live status on the local player (painted buff slots, top right under the minimap) */
function statusList(p) {
  const L = [];
  if (p.uw || p.eclipse) L.push(['ultactive', p.uw ? p.uw.t : p.eclipse.t]);
  if (p.aura > 0) L.push(['aura', p.aura]);
  if (p.shield > 0) L.push(['shield', 0, Math.ceil(p.shield)]);
  if (p.stealth > 0) L.push(['stealth', p.stealth]);
  if (p.songs) for (const k of ['valor', 'haste', 'mending', 'requiem']) if (p.songs[k] && p.songs[k].t > 0) L.push([k, p.songs[k].t]);
  if (p.stun > 0) L.push(['stun', p.stun, 0, 1]);
  if (p.slow > 0) L.push(['slow', p.slow, 0, 1]);
  if (p.chill > 0) L.push(['chill', p.chill, 0, 1]);
  return L;
}

const DEFAULT_KEY_LABELS = { attack: 'LMB', skillQ: 'Q', skillE: 'E', skillR: 'R', skillF: 'V', special: 'F', dodge: 'SHIFT', ult: 'T', combos: 'C', inventory: 'I', takeAll: 'Z', bigMap: ',' };

// Full-screen red vignettes (hurt / low HP): the radial gradient is baked once per screen size into a half-resolution
// plate and blitted with globalAlpha. A per-frame full-screen gradient was a large part of the trial bomb-burst fps
// dips in software raster (every bomb that lands on you re-lights it).
const VIG = new Map();
function vignette(ctx, w, h, inner, rgb, alpha) {
  if (alpha <= 0.005) return;
  const key = Math.round(w) + 'x' + Math.round(h) + '|' + inner + '|' + rgb;
  let c = VIG.get(key);
  if (c === undefined) {
    c = null;
    const W = Math.max(1, Math.round(w / 2)), H = Math.max(1, Math.round(h / 2));
    if (typeof OffscreenCanvas !== 'undefined') c = new OffscreenCanvas(W, H); else if (typeof document !== 'undefined') c = Object.assign(document.createElement('canvas'), { width: W, height: H });
    if (c) { const g = c.getContext('2d'), gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * inner, W / 2, H / 2, Math.max(W, H) * 0.7); gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(1, `rgba(${rgb},1)`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    if (VIG.size > 12) VIG.clear();
    VIG.set(key, c);
  }
  if (!c) { const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * inner, w / 2, h / 2, Math.max(w, h) * 0.7); g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},${alpha})`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); return; }
  ctx.save(); ctx.globalAlpha *= Math.min(1, alpha); ctx.drawImage(c, 0, 0, w, h); ctx.restore();
}

export class HUD {
  constructor() {
    this.bigMap = new BigMap(); // the whole-zone map overlay (client/bigmap.js)
    this.minimap = null;
    this.hpGhost = 1;
    this.zoneShown = -1;
    this.zoneToast = 0;
    this.showChains = true;
    this.comboPop = 0;
    this.lastCombo = 0;
    this.noResFlash = {};
  }

  buildMinimap(world) {
    const S = 180, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d'), k = S / 2 / WORLD_R;
    g.translate(S / 2, S / 2);
    circle(g, 0, 0, S / 2, '#3fa9e0', 0);
    for (let i = ZONES.length - 1; i >= 0; i--) circle(g, 0, 0, ZONES[i].r1 * k, ZONE_GROUND[i], 0);
    g.fillStyle = 'rgba(30,80,30,.55)';
    for (const o of world.obstacles) { g.beginPath(); g.arc(o.x * k, o.y * k, Math.max(1, o.size * k * 0.8), 0, TAU); g.fillStyle = o.kind === 'tree' ? 'rgba(30,90,30,.5)' : 'rgba(80,80,90,.6)'; g.fill(); }
    for (let i = 1; i < ZONES.length; i++) { g.beginPath(); g.arc(0, 0, ZONES[i].r0 * k, 0, TAU); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1; g.stroke(); }
    circle(g, BOSS_POS.x * k, BOSS_POS.y * k, BOSS_ARENA_R * k, '#5e4d68', 0);
    circle(g, 0, 0, 4, '#e6dcc3', 1.5);
    this.minimap = c;
  }

  draw(ctx, w, h, sim, p, fx, time, dt) {
    if (DC.seq) { this.hot = []; drawDuelHud(ctx, w, h, 1, txt, time); return; } // (B3: a Shadow Duel cinematic owns the screen)
    const cls = CLASSES[p.cls];
    this.hot = []; // hover rects for tooltips (skill slots, ult bar, rotation dots), rebuilt every frame
    // hurt vignette
    if (fx.vignette > 0) vignette(ctx, w, h, 0.3, '220,20,20', 0.55 * fx.vignette); // (piece 4 perf: a cached gradient plate, not a full-screen gradient per frame)
    if (fx.flash > 0) { ctx.save(); ctx.globalAlpha = Math.min(0.45, fx.flash * 0.5); ctx.fillStyle = fx.flashColor || '#fff'; ctx.fillRect(0, 0, w, h); ctx.restore(); } // ultimate flash
    if (p.hp / p.stats.maxHp < 0.3 && !p.dead) {
      const a = 0.18 + 0.12 * Math.sin(time * 6);
      vignette(ctx, w, h, 0.35, '200,0,0', a);
    }

    // ---- bottom centre: bars
    const bw = Math.min(460, w * 0.4), bx = w / 2 - bw / 2;
    const hpK = Math.max(0, p.hp / p.stats.maxHp);
    this.hpGhost = Math.max(hpK, this.hpGhost - dt * 0.35);
    const PUI = uiOn();
    const skY = PUI ? h - 128 : h - 118;
    this.drawSkills(ctx, w / 2, skY, p, cls, sim, time);
    pbar(ctx, bx, h - 50, bw, 22, hpK, hpK > 0.3 ? '#5fdc4a' : '#ff4d4d', `${Math.ceil(p.hp)} / ${p.stats.maxHp}`, this.hpGhost);
    if (cls.pips) this.pips(ctx, bx + bw * 0.1, h - 23, bw * 0.8, 14, p, cls, time);
    else if (cls.gloryRes) { gloryMeter(ctx, bx + bw * 0.1, h - 25, bw * 0.8, 18, p, cls, time, 1, true); if (this.hot) this.hot.push({ slot: 'glory', x: bx + bw * 0.1, y: h - 27, w: bw * 0.8, h: 22 }); }
    else if (cls.focusRes) { focusMeter(ctx, bx + bw * 0.1, h - 25, bw * 0.8, 18, p, cls, time, 1, true, cutsOut(sim, p)); if (this.hot) this.hot.push({ slot: 'focus', x: bx + bw * 0.1, y: h - 27, w: bw * 0.8, h: 22 }, { slot: 'cuts', x: bx + bw * 0.9 + 6, y: h - 27, w: 130, h: 22 }); } // Samurai: Focus + Delayed Cuts
    else if (cls.bloodRes) { bloodMeter(ctx, bx + bw * 0.1, h - 25, bw * 0.8, 18, p, cls, time, 1, true); if (this.hot) this.hot.push({ slot: 'blood', x: bx + bw * 0.1, y: h - 27, w: bw * 0.8, h: 22 }); } // Dragoon: Dragon Blood
    else if (cls.inkRes || cls.tempoRes) { arcMeter(ctx, bx + bw * 0.1, h - 25, bw * 0.8, 18, p, cls, time, 1); if (this.hot) this.hot.push({ slot: cls.inkRes ? 'ink' : 'tempo', x: bx + bw * 0.1, y: h - 27, w: bw * 0.8, h: 22 }); } // Summoner Ink / Bard Tempo
    else if (cls.chiRes) { chiMeter(ctx, bx + bw * 0.1, h - 25, bw * 0.8, 18, p, cls, time, 1, true); if (this.hot) this.hot.push({ slot: 'chi', x: bx + bw * 0.1, y: h - 27, w: bw * 0.8, h: 22 }); } // Monk: Chi
    else pbar(ctx, bx + bw * 0.1, h - 22, bw * 0.8, 12, p.res / p.stats.maxRes, cls.resColor, null, null, 'resbar');
    if (p.br && (p.br.bank > 0 || p.br.win > 0) && BR_CLS[p.cls]) this.brGauge(ctx, bx, h - 72, p, cls, time); // boss rotation bank + window (sim/bossrot.js)
    if (p.songs) songBadge(ctx, bx - 14, h - 39, p, time, 1, true); // Bard songs on you (any class in co-op)
    if (!cls.gloryRes && !cls.focusRes && !cls.chiRes && !cls.bloodRes && !cls.inkRes && !cls.tempoRes) txt(ctx, cls.resource, bx + bw * 0.1 - 8, h - 16, 12, cls.resColor, 'right', 3);
    if (cls.edge) edgeLine(ctx, bx + bw * 0.9 + 12, h - 16, p, cls, time, 13, 'left'); // (right of the pips, clear of the HP bar)
    if (cls.resOnBasicHit) this.holyCharge(ctx, bx + bw * 0.9 + 12, h - 16, p, cls, time); // Cleric: Holy Charge readout
    if (p.shield > 0) txt(ctx, `🛡 ${Math.ceil(p.shield)}`, bx + bw + 12, h - 39, 15, '#bfefff', 'left', 3);
    if (cls.ult) this.ultBar(ctx, w / 2 - bw * 0.45, skY - (PUI ? 46 : 36), bw * 0.9, 14, p, cls, time);
    drawGearMeter(ctx, p, w / 2 - bw * 0.25, skY - (PUI ? 66 : 56), bw * 0.5, 1, txt); // Caldera Heat / Big Bang Stardust (client/gearfx.js)
    if (cls.chiRes) { const bx2 = Math.min(w / 2 - bw * 0.45 - 90, (this.skillRow ? this.skillRow.x0 : w) - 84), by2 = skY - 2; // (clear of the wider skill row: LMB Q E R | SHIFT | SPECIAL || ULTIMATE)
      comboBadge(ctx, bx2, by2, p, time, 1); if (this.hot) this.hot.push({ slot: 'combo', x: bx2 - 75, y: by2 - 28, w: 150, h: 56 }); } // Monk: hit counter + tier (chains evolve at 10 / 20)
    if (cls.bloodRes) diveBadge(ctx, Math.min(w / 2 - bw * 0.45 - 90, (this.skillRow ? this.skillRow.x0 : w) - 84), skY - 2, p, time, 1); // Dragoon: Skyborne / dive targets / Dragon Form
    if (cls.arms) this.stanceInfo = trinityPanel(ctx, w / 2 - bw * 0.45 - 150, skY - 29, p, cls, time, 0.9, false, this.hot); // Warrior: the Weapon Trinity tracker (left of the ult bar)
    if (p.perfectCrit > 0) txt(ctx, 'NEXT HIT CRITS!', w / 2, skY - 56, 16 + Math.sin(time * 12) * 1.5, '#ff9ee0', 'center', 3.5);
    else if (p.eclipse) txt(ctx, `ECLIPSE ${(Math.max(0, p.eclipse.t) / 60).toFixed(1)}s · FREE SKILLS${p.stealth > 0 ? ' · BACKSTAB READY' : ''}`, w / 2, skY - 56, 16 + Math.sin(time * 10) * 1.5, '#d8a8ff', 'center', 3.5);
    else if (p.uw) this.windowLine(ctx, w / 2, skY - 56, p, cls, time, 16);
    if (p.eclipse || p.uw) this.drawRoutes(ctx, w / 2, skY - 118, p, time, 1); // finisher routes: step-by-step guides
    if (p.cst && !(p.uw && p.uw.rt && p.uw.rt.fin)) this.stateLine(ctx, w / 2, p.uw ? skY - 140 : skY - 78, p, time, 15);
    this.stackLine(ctx, w / 2 + bw * 0.45 + 10, skY - 29, p, sim, time, 13);
    if (p.eclipse || p.uw || p.perfectCrit > 0) { /* banner already drawn */ }
    else if (p.stealth > 0) txt(ctx, 'STEALTHED – BACKSTAB READY', w / 2, skY - 56, 16 + Math.sin(time * 10) * 1.5, '#d9c6ff', 'center', 3.5);
    // XP bar along bottom
    const need = xpToNext(p.level);
    const xpK = p.level >= MAX_LEVEL ? 1 : p.xp / need;
    ctx.fillStyle = INK; ctx.fillRect(0, h - 6, w, 6);
    ctx.fillStyle = '#b86bff'; ctx.fillRect(0, h - 5, w * xpK, 4);

    // ---- top-left: portrait + name/level
    if (!(PUI && this.portraitPainted(ctx, p, cls, need, time))) {
      this.portrait(ctx, 44, 44, p, time);
      txt(ctx, playerLabel(p.acct, p.name), 84, 28, 22);
      txt(ctx, `Lv ${p.level} ${p.acct ? heroOf(p.cls).name : cls.name}`, 84, 52, 16, '#ffd23f');
      txt(ctx, p.level >= MAX_LEVEL ? 'MAX LEVEL' : `XP ${Math.floor(p.xp)} / ${need}`, 84, 72, 13, '#d9c6ff', 'left', 3);
    }

    // ---- top centre: zone
    const z0 = zoneHere(p), TQ = sim && sim.trial, z = z0.trial && TQ ? { ...z0, name: TQ.sv ? 'Savage' : TQ.x ? 'Extreme' : 'Trial' } : z0; // (the trial arena names its mode)
    if (z.id !== this.zoneShown) { this.zoneShown = z.id; this.zoneToast = 3; }
    this.zoneToast = Math.max(0, this.zoneToast - dt);
    let zy = 50;
    if (PUI) { ctx.font = `24px ${FONT}`; const iw = Math.max(190, ctx.measureText(z.name).width + 40); if (uiSeg(ctx, 'zoneplaque', w / 2 - iw / 2, 9, iw, 31)) zy = 68; } // U3 zone banner behind the zone name
    txt(ctx, z.name, w / 2, 25, 24, '#fff', 'center');
    if (this.astral) { ctx.font = `24px ${FONT}`; drawAstralTag(ctx, Math.round(w / 2 + ctx.measureText(z.name).width / 2 + 12), 25, 1, this.t || 0); } // (Part C2: the Astral World tag)
    if (z.danger === 0) { if (!(PUI && inTownArea(p.x, p.y) && tavernOn(sim))) { const dn = z.town && inTownArea(p.x, p.y) && !tavernOn(sim) ? townDistrict(p.x, p.y) : ''; txt(ctx, dn && dn !== z.name ? `SAFE ZONE · ${dn.toUpperCase()}` : 'SAFE ZONE', w / 2, zy, 15, DANGER_COL[0], 'center', 3); } } // (the tavern's own sign sits there)
    else { const nS = Math.max(4, z.danger); for (let i = 0; i < nS; i++) this.skull(ctx, w / 2 - (nS - 1) * 11 + i * 22, zy, i < z.danger ? DANGER_COL[z.danger] : 'rgba(255,255,255,.2)'); }
    if (this.zoneToast > 0 && z.id > 0 && z.id !== RAID_ZONE.id) {
      const a = Math.min(1, this.zoneToast);
      ctx.globalAlpha = a;
      txt(ctx, `Danger Level ${z.danger}`, w / 2, zy + 26, 17, DANGER_COL[z.danger], 'center', 3);
      ctx.globalAlpha = 1;
    }

    // ---- minimap
    if (PUI) uiAround(ctx, 'minimap', w - 108 - 93, 108 - 93, 186, 186); // U1 minimap ring (its well holds the map)
    this.drawMinimap(ctx, w - 108, 108, sim, p, time);
    this.bigMap.setMinimap(w - 108, 108, 97); // (a click on the minimap opens the big map)
    if (PUI) this.drawBuffs(ctx, w - 24, 226, p, time); // U1 buff slots with B1 / B2 icons


    // ---- chain list (left)
    this.chainsBottom = 110;
    if (this.showChains && !this.bigMap.open) this.drawChains(ctx, 16, PUI ? 118 : 110, p, cls, sim); // (hidden under the big map: its legend sits there)
    if (sim.players && sim.players.size > 1) this.drawParty(ctx, 16, this.chainsBottom + 14, sim, p, PUI);

    // ---- combo counter
    if (p.comboHits !== this.lastCombo) { if (p.comboHits > this.lastCombo) this.comboPop = 1; this.lastCombo = p.comboHits; }
    this.comboPop = Math.max(0, this.comboPop - dt * 5);
    if (p.comboHits >= 3) {
      const s = 1 + this.comboPop * 0.35;
      ctx.save(); ctx.translate(w - 150, h * 0.45); ctx.rotate(-0.08); ctx.scale(s, s);
      const col = p.comboHits >= 30 ? '#ff5e5b' : p.comboHits >= 15 ? '#ffb52e' : '#ffe45c';
      txt(ctx, String(p.comboHits), 0, 0, 58, col, 'center', 9);
      txt(ctx, 'HITS', 0, 38, 22, '#fff', 'center');
      ctx.restore();
      const k = p.comboTimer / 132;
      rrect(ctx, w - 200, h * 0.45 + 62, 100, 6, 3); ctx.fillStyle = INK; ctx.fill();
      rrect(ctx, w - 200, h * 0.45 + 62, 100 * k, 6, 3); ctx.fillStyle = col; ctx.fill();
    }

    // ---- boss bar (Vorthax: raid bar with phase pips, ward bar + enrage timer, and the big mechanic callouts)
    const BAR = PUI ? pbar : bar;
    if (DC.seq || DC.dlg || DC.shards || DC.clash || DC.swellT > 0) drawDuelHud(ctx, w, h, 1, txt, time); // (B3: the Shadow Duel cinematics)
    if (ENC.lb > 0 || ENC.prompt || ENC.flash > 0 || (sim.sp && sim.sp.length)) drawEncHud(ctx, w, h, sim, p); // (encounter revamp Part 0: letterbox, blade meter, prompts)
    const astY = drawAstraelHud(ctx, sim, p, w, h, 1, txt, BAR, time); // Astrael: HP bar + phase timeline, name cards, lines, letterbox, Big Bang, wipe screen
    const raidY = astY || drawUltHud(ctx, sim, p, w, h, txt, BAR, time) || drawTrialHud(ctx, sim, p, w, h, 1, txt, BAR, time) || drawRaidBar(ctx, sim, p, w, 96, 1, txt, BAR) || drawTombHud(ctx, sim, p, w, h, txt, BAR, time) || drawCryptHud(ctx, sim, p, w, h, txt, BAR, time) || drawGlowHud(ctx, sim, p, w, h, txt, BAR) || drawForgeHud(ctx, sim, p, w, h, txt, BAR, time) || drawOpsHud(ctx, sim, p, w, h, txt, BAR, time, (k) => this.keyLabel(k)); // (+ the Tomb: chamber / waves / chest challenge, Neferakh's bar + light dial)
    if (raidY && !inTombArea(p.x, p.y) && !inCryptArea(p.x, p.y) && !inHollowArea(p.x, p.y) && !inTorArea(p.x, p.y) && !inForgeArea(p.x, p.y) && !inTrialArea(p.x, p.y) && !inOpsArea(p.x, p.y)) drawRaidCallout(ctx, sim, p, w, h, 1, txt);
    const boss = !raidY && sim.enemies.find((e) => e.boss && !e.raid && !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 900);
    if (boss) {
      const bbw = Math.min(620, w * 0.5), bbx = w / 2 - bbw / 2, bby = PUI ? 146 : 92;
      if (PUI) { ctx.font = `22px ${FONT}`; const nw = Math.max(170, ctx.measureText(boss.name).width + 44); uiAround(ctx, 'bossplate', w / 2 - nw / 2, bby - 16, nw, 24); } // U3 boss nameplate
      txt(ctx, boss.name, w / 2, bby - 4, 22, '#ffb0ff', 'center');
      pbar(ctx, bbx, bby + 10, bbw, 20, boss.hp / boss.maxHp, boss.phase === 3 ? '#ff4d4d' : '#b05cff', `${Math.ceil(boss.hp)} / ${boss.maxHp}`, null, 'bossbar');
      // phase ticks
      for (const k of [0.66, 0.33]) { ctx.fillStyle = INK; ctx.fillRect(bbx + bbw * k - 2, bby + 8, 4, 24); }
      // poise meter
      const pk = boss.cc.down > 0 ? 0 : boss.poise / boss.maxPoise;
      rrect(ctx, bbx + bbw * 0.2, bby + 36, bbw * 0.6, 7, 3.5); ctx.fillStyle = INK; ctx.fill();
      rrect(ctx, bbx + bbw * 0.2 + 1, bby + 37, (bbw * 0.6 - 2) * pk, 5, 2.5); ctx.fillStyle = '#ffd23f'; ctx.fill();
      txt(ctx, boss.cc.down > 0 ? 'BROKEN!' : 'POISE', bbx + bbw * 0.2 - 8, bby + 40, 12, boss.cc.down > 0 ? '#ff5e5b' : '#ffd23f', 'right', 3);
      txt(ctx, `Phase ${boss.phase}`, bbx + bbw + 8, bby + 20, 14, '#fff', 'left', 3);
    }

    const swHud = drawSwarmHud(ctx, w, h, sim, p, time); // Swarm event callout + the arrow to it (client/sitesfx.js)
    // ---- banners (start under the Swarm panel while it shows, so 'SWARM GATHERING' never sits on it)
    let by = swHud ? Math.max(h * 0.2, 214) : h * 0.2;
    const opsBan = raidY && inOpsArea(p.x, p.y), bk = opsBan && h < 600 ? 0.72 : 1; // in a mission: banners start under its objective panel (the phone JAMMED banner sat on the top bars), smaller on a short screen
    if (opsBan) by = Math.max(by, raidY + 30 * bk);
    const momOn = momentOn(fx); // (a signature finisher has its own title band: no stacked banners over it)
    if (!momOn) for (const b of fx.banners) {
      const k = b.t / b.life;
      const s = k < 0.1 ? 1.6 - (k / 0.1) * 0.6 : 1;
      const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(w / 2, by); ctx.scale(s * bk, s * bk);
      const extra = PUI ? this.bannerArt(ctx, b) || 0 : 0;
      txt(ctx, b.str, 0, 0, b.size, b.color, 'center', b.size * 0.2);
      if (b.sub) txt(ctx, b.sub, 0, b.size * 0.72, 18, '#fff', 'center');
      ctx.restore();
      by += (b.size + (b.sub ? 52 : 26) + extra) * bk;
    }
    if (fx.drawScreen && fx.rend) fx.drawScreen(ctx, fx.rend, 1); // finisher moments: the title band and sound stamp (over the HUD)
    if (this.bigMap.open) this.bigMap.draw(ctx, w, h, sim, p, time, { pings: this.pings, key: this.keyLabel('bigMap') }); // the big map (client/bigmap.js): the HUD's top layer
  }

  /** Blade Dancer Initiative: one pip per point (no bar). */
  /** boss rotation gauge: the banked units (named after the class mechanic) and the Special's window, left above the HP bar */
  brGauge(ctx, x, y, p, cls, time) {
    const S = p.br, D = BR_CLS[p.cls], w = 150, h = 10, k = Math.min(1, S.bank / BR.max), on = S.win > 0;
    rrect(ctx, x, y, w, h, 5); ctx.fillStyle = INK; ctx.fill();
    if (k > 0) { rrect(ctx, x + 1.5, y + 1.5, (w - 3) * k, h - 3, 3.5); ctx.fillStyle = on ? '#fff3c4' : cls.color || '#ffd23f'; ctx.fill(); }
    if (on) { ctx.save(); ctx.globalAlpha = 0.45 + 0.3 * Math.sin(time * 9); rrect(ctx, x - 2, y - 2, w + 4, h + 4, 7); ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
    txt(ctx, `${D.unit.toUpperCase()} ${S.bank}`, x, y - 8, 11, cls.color || '#ffd23f', 'left', 3);
    if (on) txt(ctx, `${D.win.toUpperCase()} ${(S.win / 60).toFixed(1)}s ×2`, x + w, y - 8, 11, '#fff3c4', 'right', 3);
  }
  pips(ctx, x, y, w, h, p, cls, time) {
    const n = Math.round(p.stats.maxRes), have = Math.floor(p.res + 1e-6), gap = 3, pw = (w - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const px = x + i * (pw + gap);
      rrect(ctx, px, y, pw, h, 4); ctx.fillStyle = INK; ctx.fill();
      if (i < have) { rrect(ctx, px + 2, y + 2, pw - 4, h - 4, 3); ctx.fillStyle = have >= n ? '#ffe0f4' : cls.resColor; ctx.fill(); }
      else if (i === have) { const k = p.res - have; if (k > 0) { rrect(ctx, px + 2, y + h - 2 - (h - 4) * k, pw - 4, (h - 4) * k, 2); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fill(); } }
    }
    txt(ctx, `${have}/${n}`, x + w + 10, y + h / 2 + 1, 13, cls.resColor, 'left', 3);
  }

  /** Holy Charge (Cleric): percentage next to the resource bar, glowing when full (Judgment at max power). */
  holyCharge(ctx, x, y, p, cls, time) {
    const k = p.res / p.stats.maxRes, full = k >= 0.99;
    if (full) { ctx.save(); ctx.shadowColor = cls.resColor; ctx.shadowBlur = 14 + 6 * Math.sin(time * 10); }
    txt(ctx, `✦ ${Math.floor(k * 100)}%`, x, y, full ? 15 : 13, full ? '#fff6c8' : cls.resColor, 'left', 3);
    if (full) ctx.restore();
  }

  skull(ctx, x, y, col) {
    circle(ctx, x, y - 1, 8, col, 2.5);
    rrect(ctx, x - 5, y + 3, 10, 6, 2); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    circle(ctx, x - 3, y - 1, 2.2, INK, 0); circle(ctx, x + 3, y - 1, 2.2, INK, 0);
  }

  portrait(ctx, x, y, p, time) {
    circle(ctx, x, y, 32, '#4a4262', 4);
    if (drawHeroPortrait(ctx, p.cls, x, y, 30)) { // painted head-and-shoulders (client/heropaint.js)
      circle(ctx, x, y, 30.5, null, 3);
      circle(ctx, x + 24, y + 22, 12, '#ffd23f', 3);
      txt(ctx, String(p.level), x + 24, y + 23, 14, INK, 'center', 0);
      return;
    }
    const c = heroColors(p.appearance);
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.clip();
    circle(ctx, x, y + 26, 24, c.outfit, 3);
    circle(ctx, x, y, 16, c.skin, 3);
    ctx.restore();
    circle(ctx, x - 5, y + 1, 2, INK, 0); circle(ctx, x + 5, y + 1, 2, INK, 0);
    ctx.fillStyle = c.hair;
    if (c.style !== 'bald') { ctx.beginPath(); ctx.arc(x, y - 2, 16.5, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
    circle(ctx, x + 24, y + 22, 12, '#ffd23f', 3);
    txt(ctx, String(p.level), x + 24, y + 23, 14, INK, 'center', 0);
  }

  /** Ultimate meter bar with rotation pips; glows and pulses when full. */
  /** HUD element under a screen point (CSS px): { slot, x, y, w, h } or null. Used for the hover tooltips. */
  hitTest(mx, my) {
    for (const r of this.hot || []) if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return r;
    return null;
  }
  /** Key label for an action. Desktop games point this at the rebindable keybinds; the phone HUD keeps the defaults. */
  keyLabel(id) { return DEFAULT_KEY_LABELS[id] || id; }
  /** Label for a chain step ('Q', 'B2', 'BS', 'F+') with the current key labels. */
  stepLabel(key) {
    if (/^B\d$/.test(key)) return this.keyLabel('attack') + key.slice(1);
    if (key === 'BS') return this.keyLabel('attack') + '★';
    if (key === 'F+') return this.keyLabel('skillF') + '✓';
    if (key === 'SP') return this.keyLabel('special');
    if (/^[QERF]$/.test(key)) return this.keyLabel('skill' + key);
    return key;
  }

  ultBar(ctx, x, y, w, h, p, cls, time, label = true) {
    const k = Math.min(1, (p.ult || 0) / 100), full = k >= 1;
    if (uiOn()) uiSeg(ctx, 'resbar', x, y, w, h); // (painted: the U1 resource frame)
    if (full) { ctx.save(); ctx.globalAlpha *= 0.55 + 0.35 * Math.sin(time * 9); glowRR(ctx, x - 3, y - 3, w + 6, h + 6, h / 2 + 3, '#ffd23f', 16 + 8 * Math.sin(time * 9), 'rgb(255,210,63)'); ctx.restore(); } // (cached glow plate: client/textcache.js)
    rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = INK; ctx.fill();
    if (k > 0) { rrect(ctx, x + 2, y + 2, Math.max(h - 4, (w - 4) * k), h - 4, (h - 4) / 2); const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#ff9a3c'); g.addColorStop(1, full ? '#fff1a0' : '#ffd23f'); ctx.fillStyle = g; ctx.fill(); }
    for (let i = 1; i < 4; i++) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + (w * i) / 4 - 1, y + 2, 2, h - 4); }
    if (label) {
      txt(ctx, full ? (w < 240 ? 'ULT READY!' : `ULTIMATE READY  [${this.keyLabel('ult')}]`) : `ULT ${Math.floor(p.ult || 0)}%`, x + w / 2, y + h / 2 + 1, Math.max(10, h - 1), full ? '#fff6c8' : '#fff', 'center', 3);
    }
    // rotation progress: one pip per distinct chain landed in the current sequence
    const n = p.ultRot ? p.ultRot.ids.length : 0;
    if (this.hot) this.hot.push({ slot: 'ultbar', x: x - 3, y: y - 5, w: w + 6, h: h + 10 }, { slot: 'ultbar', part: 'dots', x: x + w + 3, y: y - 5, w: 38, h: h + 10 });
    for (let i = 0; i < 3; i++) circle(ctx, x + w + 10 + i * 12, y + h / 2, 4.5, i < n ? '#7af0ff' : 'rgba(255,255,255,.18)', 2);
  }

  drawSkills(ctx, cx, y, p, cls, sim, time) {
    // [LMB] [Q] [E] [R] ([4th]) | [SHIFT] [SPECIAL] || [ ULTIMATE ]  (the Special and the ultimate have their own, bigger frames)
    const slots = [
      { key: 'LMB', slot: 'basic', lbl: this.keyLabel('attack'), name: 'Combo', ready: 1, icon: cls.arms && p.wm ? 'wm_basic_' + p.wm.st : 'basic' },
      ...['Q', 'E', 'R', 'F'].filter((k) => cls.skills[k]).map((k) => { const sk = cls.skills[k]; return { key: k, slot: k, lbl: this.keyLabel('skill' + k), sk, icon: sk.id }; }),
      { key: 'SHIFT', slot: 'dodge', lbl: this.keyLabel('dodge'), name: 'Dodge', icon: 'dodge', pad: 14 }, // (Dodge and the Special swapped places; bindings unchanged)
      ...(cls.skills.SP ? [{ key: 'SP', slot: 'SP', lbl: this.keyLabel('special'), sk: cls.skills.SP, icon: cls.skills.SP.id, special: true, pad: 14 }] : []),
      ...(cls.ult ? [{ key: 'T', slot: 'ult', lbl: this.keyLabel('ult'), name: cls.ult.name, icon: cls.ult.id, ult: true, pad: 22 }] : []),
    ];
    const S0 = 54, gap = 10, sizeOf = (s) => (s.ult ? 72 : s.special ? 60 : S0);
    const total = slots.reduce((a, s, i) => a + sizeOf(s) + (i ? gap + (s.pad || 0) : 0), 0);
    let x = cx - total / 2;
    this.skillRow = { x0: x, x1: x + total };
    const primed = primedChains(p, sim.tick, sim);
    const spi = specInfo(p), accent = cls.color || '#ffd23f';
    const P = uiOn() && hasIcon(cls.id + '_Q'); // painted: K-sheet icons in U1 slot frames on the skill-bar tray
    if (P) uiSeg(ctx, 'skilltray', x - 14, y - 22, total + 28, S0 + 30);
    slots.forEach((s, i) => {
      if (i) x += s.pad || 0;
      const S = sizeOf(s), yy = y + S0 - S; // bottoms line up
      if (this.hot) this.hot.push({ slot: s.slot, x, y: yy - 10, w: S, h: S + 10 });
      let cdK = 0, cdTxt = '', noRes = false, glow = false;
      if (s.sk) {
        const max = s.sk.cd * 60;
        if (max > 0) {
          cdK = (p.cds[s.key] || 0) / max;
          if (p.cds[s.key] > 0) cdTxt = (p.cds[s.key] / 60).toFixed(p.cds[s.key] < 60 ? 1 : 0);
        }
        if (p.gcd > 0) cdK = Math.max(cdK, p.gcd / Math.max(GCD, cls.gcd || 0)); // the global cooldown sweep (every skill button; a primed chain key still glows under it)
        noRes = p.res < s.sk.cost && !(p.aura > 0) && !p.eclipse && !primed.some((c) => c.next === s.key && c.free);
        glow = !(p.eclipse && p.eclipse.rt && p.eclipse.rt.fin) && (primed.some((c) => c.next === s.key) || routeNext(p).has(s.key));
      } else if (s.icon === 'dodge') { const D = dodgeOf(p.cls); cdK = dodgeCdK(p, D); noRes = p.res < D.cost; }
      else if (s.icon === 'basic') { glow = primed.some((c) => /^B\d$/.test(c.next)); }
      else if (s.ult) { cdK = 1 - Math.min(1, (p.ult || 0) / 100); glow = cdK <= 0; }
      if (glow) { const gc = glow === 'rage' ? '#ff3b2b' : '#ffd23f'; glowRR(ctx, x - 3, yy - 3, S + 6, S + 6, 14, gc, 20 + 8 * Math.sin(time * 12), gc); }
      if (s.special && spi) glowRR(ctx, x - 4, yy - 4, S + 8, S + 8, 15, accent, 18 + 6 * Math.sin(time * 10), accent);
      const painted = P && this.paintSlot(ctx, s, x, yy, S, cls, noRes, accent);
      if (!painted) {
      rrect(ctx, x, yy, S, S, s.ult ? 16 : 12); ctx.fillStyle = INK; ctx.fill();
      const inner = s.ult ? (cdK <= 0 ? '#6a4a1e' : '#3e2f4e') : s.special ? (noRes ? '#5a3a4a' : '#3b3358') : noRes ? '#5a3a4a' : '#4a4262';
      rrect(ctx, x + 3, yy + 3, S - 6, S - 6, s.ult ? 13 : 9); ctx.fillStyle = inner; ctx.fill();
      if (s.special || s.ult) { // the Special: a class-coloured double frame; the ultimate: a gold one
        ctx.save(); rrect(ctx, x + 5, yy + 5, S - 10, S - 10, s.ult ? 11 : 8); ctx.lineWidth = 2.5; ctx.strokeStyle = s.ult ? '#ffd23f' : accent; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.restore();
      }
      ctx.save(); if (s.ult || s.special) { ctx.translate(x + S / 2, yy + S / 2 - (s.ult ? 5 : 4)); ctx.scale(s.ult ? 1.2 : 1.05, s.ult ? 1.2 : 1.05); ctx.translate(-(x + S / 2), -(yy + S / 2)); }
      this.icon(ctx, s.icon, x + S / 2, yy + S / 2, cls, noRes);
      ctx.restore();
      }
      if (cdK > 0) {
        ctx.save(); if (painted && s.ult) { ctx.beginPath(); ctx.arc(x + S / 2, yy + S / 2, S / 2, 0, TAU); } else rrect(ctx, x + 3, yy + 3, S - 6, S - 6, 9); ctx.clip();
        ctx.beginPath(); ctx.moveTo(x + S / 2, yy + S / 2); ctx.arc(x + S / 2, yy + S / 2, S, -Math.PI / 2, -Math.PI / 2 + TAU * cdK); ctx.closePath();
        ctx.fillStyle = 'rgba(20,14,30,.7)'; ctx.fill(); ctx.restore();
        if (cdTxt) txt(ctx, cdTxt, x + S / 2, yy + S / 2 - (s.special ? 3 : 0), 20, '#fff', 'center');
        if (s.ult) txt(ctx, `${Math.floor(p.ult || 0)}%`, x + S / 2, yy + S / 2 - 3, 17, '#ffd23f', 'center', 3);
      }
      if (s.special || s.ult) { // title band inside the frame
        const bh = s.ult ? 15 : 13;
        rrect(ctx, x + 4, yy + S - bh - 3, S - 8, bh, 5); ctx.fillStyle = s.ult ? (cdK <= 0 ? '#ffd23f' : 'rgba(255,210,63,.85)') : accent; ctx.fill();
        txt(ctx, s.ult ? 'ULTIMATE' : 'SPECIAL', x + S / 2, yy + S - bh / 2 - 2.5, s.ult ? 10.5 : 9.5, INK, 'center', 0);
      }
      if (s.special && spi) { // live Special: Decree timer / clone copies left
        const k = spi.id === 'shadow_clone' ? null : Math.max(0, spi.t / Math.max(1, (cls.skills.SP.stats.dur || 300)));
        if (k != null) { ctx.save(); ctx.beginPath(); ctx.arc(x + S / 2, yy + S / 2, S / 2 + 6, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.lineWidth = 4; ctx.strokeStyle = '#fff6c8'; ctx.stroke(); ctx.restore(); txt(ctx, (spi.t / 60).toFixed(1) + 's', x + S / 2, yy - 20, 12, '#fff6c8', 'center', 3); }
        else for (let j = 0; j < (cls.skills.SP.stats.chains || 3); j++) circle(ctx, x + S / 2 - 12 + j * 12, yy - 20, 4.5, j < spi.n ? '#c9b8ff' : 'rgba(255,255,255,.2)', 2);
      }
      if (s.icon === 'dodge') { dodgePipsRow(ctx, x + S / 2, yy + S - 7, p); sprintChip(ctx, x + S / 2, yy - 30, p, this.sprintArmed, txt); } // (dodge rework: 3 charges; sprint)
      const kl = s.lbl || s.key, ky = s.ult ? yy - 8 : yy - 10;
      rrect(ctx, x + S / 2 - 16, ky, 32, 16, 6); ctx.fillStyle = INK; ctx.fill();
      if (kl.length > 3) { rrect(ctx, x + S / 2 - 24, ky, 48, 16, 6); ctx.fillStyle = INK; ctx.fill(); }
      txt(ctx, kl, x + S / 2, ky + 8, kl.length > 2 ? 10 : 12, glow ? '#ffd23f' : s.special ? accent : '#fff', 'center', 0);
      if (cls.arms && p.wm && (s.sk || s.key === 'LMB') && !s.special) weaponRing(ctx, x, yy, S, s.key, p.wm.st); // Warrior: weapon colours (skills are free)
      if (s.sk && altOn(p) && ASC_ALT[p.cls].key === s.key) altBadge(ctx, x + S - 6, yy + 6, time); // (Part D A3: the Astral variant is on this key)
      else if (s.sk && !cls.chiRes && !cls.bloodRes && s.sk.cost > 0) txt(ctx, String(p.eclipse || p.aura > 0 ? 0 : s.sk.cost), x + S - 8, yy + S - 8, 11, cls.resColor, 'center', 3); // Eclipse / Ascension: free
      x += S + gap;
    });
  }

  /** painted skill slot: U1 frame (ultorb for the ultimate), the K icon inside; the dodge keeps its drawn icon. */
  paintSlot(ctx, s, x, yy, S, cls, noRes, accent) {
    if (!(s.ult ? uiAround(ctx, 'ultorb', x - 2, yy - 2, S + 4, S + 4) : uiAround(ctx, 'skillslot', x, yy, S, S))) return false;
    const ik = s.icon === 'dodge' ? null : skillIconKey(cls.id, s.slot);
    ctx.save();
    if (s.ult) { ctx.beginPath(); ctx.arc(x + S / 2, yy + S / 2, S / 2 - 1, 0, TAU); ctx.clip(); }
    const drew = ik && uiIcon(ctx, ik, x + S / 2, yy + S / 2, S - (s.ult ? 0 : 2), s.ult ? 0 : 7, noRes ? 0.5 : 1);
    ctx.restore();
    if (!drew) this.icon(ctx, s.icon, x + S / 2, yy + S / 2, cls, noRes);
    if (s.special) { ctx.save(); rrect(ctx, x + 1, yy + 1, S - 2, S - 2, 7); ctx.lineWidth = 2; ctx.strokeStyle = accent; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.restore(); }
    return true;
  }

  /** painted portrait plate (U1): the hero portrait in the ring, name in the plate, class + level over it, XP under it */
  portraitPainted(ctx, p, cls, need, time) {
    const H = 112, W = H * 471 / 206, X = 6, Y = 2;
    if (!uiAround(ctx, 'portrait', X + 0.093 * W, Y + 0.252 * H, 0.245 * W, 0.53 * H, 'portraitC')) return false;
    const cx = X + 0.2155 * W, cy = Y + 0.517 * H, r = 0.1225 * W - 1;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    ctx.fillStyle = '#1a1424'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    if (!drawHeroPortrait(ctx, p.cls, cx, cy, r)) { const c = heroColors(p.appearance); circle(ctx, cx, cy + r * 0.8, r * 0.75, c.outfit, 0); circle(ctx, cx, cy, r * 0.5, c.skin, 0); }
    ctx.restore();
    const nx0 = X + 0.397 * W, nx1 = X + 0.892 * W, ny = Y + 0.525 * H;
    const nm = playerLabel(p.acct, p.name); let fs = 20; ctx.font = `${fs}px ${FONT}`; while (fs > 12 && ctx.measureText(nm).width > nx1 - nx0 - 14) { fs--; ctx.font = `${fs}px ${FONT}`; }
    txt(ctx, nm, (nx0 + nx1) / 2, ny + 1, fs, '#fff4dc', 'center', 3);
    txt(ctx, `Lv ${p.level} ${p.acct ? heroOf(p.cls).name : cls.name}`, nx0 + 6, Y + 0.25 * H, 15, '#ffd23f', 'left', 3);
    txt(ctx, p.level >= MAX_LEVEL ? 'MAX LEVEL' : `XP ${Math.floor(p.xp)} / ${need}`, nx0 + 6, Y + 0.8 * H, 12, '#d9c6ff', 'left', 3);
    circle(ctx, cx + r * 0.78, cy + r * 0.78, 11, '#ffd23f', 2.5);
    txt(ctx, String(p.level), cx + r * 0.78, cy + r * 0.78 + 1, 13, INK, 'center', 0);
    return true;
  }

  /** painted buff / debuff slots (B1 / B2 icons in U1 buff frames), right-aligned at (x, y) */
  drawBuffs(ctx, x, y, p, time) {
    const L = statusList(p); if (!L.length) return;
    const S = 30, gap = 8;
    L.slice(0, 6).forEach(([key, t, n, bad], i) => {
      const bx = x - (i + 1) * S - i * gap;
      if (!uiAround(ctx, 'buffslot', bx, y, S, S)) return;
      uiIcon(ctx, key, bx + S / 2, y + S / 2, S, 5);
      if (bad) { ctx.save(); rrect(ctx, bx, y, S, S, 5); ctx.lineWidth = 2; ctx.strokeStyle = '#ff5e5b'; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(time * 8); ctx.stroke(); ctx.restore(); }
      if (t > 0) txt(ctx, (t / 60).toFixed(t < 600 ? 1 : 0), bx + S / 2, y + S + 10, 11, '#fff', 'center', 3);
      else if (n) txt(ctx, String(n), bx + S / 2, y + S + 10, 11, '#bfefff', 'center', 3);
    });
  }

  /** co-op party frames (U1 party frame when painted): portrait, name over the HP fill */
  drawParty(ctx, x, y, sim, p, painted) {
    const others = [...sim.players.values()].filter((q) => q.id !== p.id).slice(0, 4);
    others.forEach((q, i) => {
      const H = 58, W = H * 319 / 121, yy = y + i * (H + 2), k = Math.max(0, q.hp / ((q.stats && q.stats.maxHp) || 1)), col = CLASSES[q.cls] ? CLASSES[q.cls].color : '#fff';
      const cx = x + 0.2 * W, cy = yy + 0.504 * H, r = 0.107 * W - 1, nx0 = x + 0.392 * W, nx1 = x + 0.865 * W, ny0 = yy + 0.347 * H, ny1 = yy + 0.661 * H;
      if (painted && uiAround(ctx, 'partyframe', x + 0.094 * W, yy + 0.306 * H, 0.213 * W, 0.396 * H, 'partyC')) {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip(); ctx.fillStyle = '#1a1424'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r); drawHeroPortrait(ctx, q.cls, cx, cy, r); if (q.dead) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r); } ctx.restore();
        ctx.save(); rrect(ctx, nx0, ny0, nx1 - nx0, ny1 - ny0, 4); ctx.clip(); ctx.fillStyle = k > 0.3 ? '#3fae3a' : '#c23a3a'; ctx.fillRect(nx0, ny0, (nx1 - nx0) * k, ny1 - ny0); ctx.restore();
      } else {
        rrect(ctx, x, yy + 8, 170, 40, 10); ctx.fillStyle = 'rgba(38,32,52,.72)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        circle(ctx, x + 22, yy + 28, 15, col, 2.5);
        bar(ctx, x + 44, yy + 31, 116, 9, k, k > 0.3 ? '#5fdc4a' : '#ff4d4d', null);
        txt(ctx, `${playerLabel(q.acct, q.name || 'Ally')}  Lv ${q.level || 1}`, x + 44, yy + 20, 12, '#fff', 'left', 3);
        return;
      }
      txt(ctx, `${playerLabel(q.acct, q.name || 'Ally')} · ${q.level || 1}`, (nx0 + nx1) / 2, (ny0 + ny1) / 2 + 1, 11, q.dead ? '#aaa' : '#fff', 'center', 3);
    });
  }

  /** painted banner plates (U3): victory / defeat crests for clears and wipes, a ribbon behind the longer story banners */
  bannerArt(ctx, b) {
    ctx.font = `${b.size}px ${FONT}`;
    const tw = ctx.measureText(b.str).width;
    if (b.kind === 'victory' || b.kind === 'defeat') { const iw = tw * 0.9 + b.size * 0.3, top = -b.size * 0.5, bot = b.sub ? b.size * 0.5 + 12 : b.size * 0.45; uiAround(ctx, b.kind, -iw / 2, top, iw, bot - top); return b.size * 0.9; }
    if (b.kind === 'plain' || b.life < 2.2 || b.size > 50) return 0;
    const red = /^#ff[3-6]/i.test(b.color);
    uiSeg(ctx, red ? 'ribbon_red' : 'ribbon_blue', -tw / 2 - 24, -b.size * 0.55, tw + 48, b.size * 1.1, 0.92);
    return b.size * 0.2;
  }

  /** Skill icons are static vector drawings: cached as bitmaps per (icon, class, dim, scale) (perf pass, world 2). */
  icon(ctx, id, x, y, cls, dim) {
    const m = ctx.getTransform ? ctx.getTransform() : null; if (!m || m.b || m.c || typeof document === 'undefined') { this.iconDraw(ctx, id, x, y, cls, dim); return; }
    const sc = Math.round(Math.abs(m.a) * 10) / 10 || 1, key = id + '|' + cls.id + '|' + (dim ? 1 : 0) + '|' + sc, C = this.iconCache || (this.iconCache = new Map());
    let c = C.get(key);
    if (!c) {
      const U = 64; c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.ceil(U * sc), Math.ceil(U * sc)) : Object.assign(document.createElement('canvas'), { width: Math.ceil(U * sc), height: Math.ceil(U * sc) });
      const g = c.getContext('2d'); g.scale(sc, sc); this.iconDraw(g, id, U / 2, U / 2, cls, dim); C.set(key, c);
      if (C.size > 240) C.delete(C.keys().next().value);
    }
    ctx.drawImage(c, x - 32, y - 32, 64, 64);
  }
  iconDraw(ctx, id, x, y, cls, dim) {
    ctx.save(); ctx.translate(x, y);
    if (dim) ctx.globalAlpha = 0.55;
    const Y = '#ffd23f', W = '#ffffff';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const stroke = (col, lw = 5) => { ctx.strokeStyle = INK; ctx.lineWidth = lw + 4; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); };
    if ((cls.grim || cls.bard) && arcIcon(ctx, id, stroke)) { ctx.restore(); return; } // Summoner / Bard icons (archud.js)
    if (specIcon(ctx, id, stroke)) { ctx.restore(); return; } // Special icons (fxspec.js)
    if (cls.arms && wmIcon(ctx, id, stroke)) { ctx.restore(); return; } // Warrior Weapon Master icons (wmhud.js)
    if (cls.blade && samIcon(ctx, id, stroke)) { ctx.restore(); return; }
    if (cls.lance && drgIcon(ctx, id, stroke)) { ctx.restore(); return; } // Dragoon icons (drghud.js)
    if (cls.fist && monkIcon(ctx, id, stroke)) { ctx.restore(); return; } // Monk icons (monkhud.js) // Samurai icons (samhud.js)
    switch (id) {
      case 'basic':
        if (cls.id === 'warrior') { ctx.beginPath(); ctx.moveTo(-12, 12); ctx.lineTo(12, -12); stroke('#e9eef5', 5); ctx.beginPath(); ctx.moveTo(-14, 6); ctx.lineTo(-6, 14); stroke(Y, 4); }
        else if (cls.id === 'ranger') { ctx.beginPath(); ctx.arc(-4, 0, 14, -1.2, 1.2); stroke('#a0632f', 4); ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(14, 0); stroke('#e6d3a3', 3); }
        else if (cls.id === 'cleric') { ctx.beginPath(); ctx.moveTo(-12, 12); ctx.lineTo(6, -6); stroke('#8a5a35', 4); circle(ctx, 8, -8, 7, '#c9d2dd', 3); circle(ctx, -8, -4, 7, '#f2b632', 3); }
        else if (cls.id === 'bladedancer') { ctx.beginPath(); ctx.moveTo(-12, 10); ctx.lineTo(10, -12); stroke('#e9eef5', 4); ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(10, 12); stroke('#ffd6f0', 4); }
        else { circle(ctx, 0, 0, 9, '#9d7bff', 3); circle(ctx, -3, -3, 3, W, 0); }
        break;
      // ---- Ultimates
      case 'berserk': ctx.save(); ctx.globalAlpha *= 0.6; circle(ctx, 0, 2, 17, '#ff3b2b', 0); ctx.restore(); ctx.beginPath(); ctx.moveTo(-6, -14); ctx.lineTo(8, 2); stroke('#e9eef5', 5); ctx.beginPath(); ctx.arc(0, 8, 15, Math.PI * 1.05, Math.PI * 1.95, true); stroke('#ff5e3b', 4); for (const a of [0.5, 1.57, 2.64]) { ctx.beginPath(); ctx.moveTo(Math.cos(a) * 9, 8 + Math.sin(a) * 4); ctx.lineTo(Math.cos(a) * 16, 8 + Math.sin(a) * 7); stroke(Y, 2.5); } break;
      case 'arrowstorm': for (const [dx, dy] of [[-10, -4], [0, -10], [10, -4], [-5, 4], [6, 5]]) { ctx.beginPath(); ctx.moveTo(dx - 3, dy - 8); ctx.lineTo(dx + 1, dy + 5); stroke('#e6d3a3', 2.2); } ctx.beginPath(); ctx.ellipse(0, 12, 16, 4.5, 0, 0, TAU); stroke('#7af0ff', 2.5); break;
      case 'ultmeteor': ctx.beginPath(); ctx.moveTo(15, -15); ctx.lineTo(-1, 1); stroke('#ffd23f', 8); circle(ctx, -4, 4, 12, '#ff5e3b', 3); circle(ctx, -7, 1, 4, '#ffd23f', 0); break;
      case 'ascension': ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); stroke('#ffe27a', 3); ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 12); ctx.moveTo(-8, -4); ctx.lineTo(8, -4); stroke(W, 4); ctx.beginPath(); ctx.moveTo(-14, -12); ctx.lineTo(-10, -16); ctx.moveTo(14, -12); ctx.lineTo(10, -16); stroke(Y, 2.5); break;
      case 'eclipse': circle(ctx, 0, 0, 14, '#ffe6a8', 3); circle(ctx, 5, -3, 12, '#2a0c3a', 0); ctx.beginPath(); ctx.moveTo(-12, 12); ctx.lineTo(12, -12); stroke('#ff9ee0', 3); break;
      // ---- Cleric
      case 'smite': ctx.beginPath(); ctx.moveTo(-10, -12); ctx.lineTo(2, 2); stroke('#8a5a35', 4); circle(ctx, 4, 4, 7, '#c9d2dd', 3); ctx.beginPath(); ctx.arc(4, 8, 13, Math.PI * 0.15, Math.PI * 0.85); stroke(Y, 3); break;
      case 'sanctuary': ctx.beginPath(); ctx.ellipse(0, 6, 15, 7, 0, 0, TAU); stroke('#ffe27a', 3); ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 6); ctx.moveTo(-6, -5); ctx.lineTo(6, -5); stroke(W, 3.5); break;
      case 'shieldrush': circle(ctx, 4, 0, 10, '#f2b632', 3); circle(ctx, 4, 0, 6, '#f7f3e8', 0); ctx.beginPath(); ctx.moveTo(-15, -7); ctx.lineTo(-7, -7); ctx.moveTo(-15, 7); ctx.lineTo(-7, 7); stroke('#9fe0ff', 2.5); break;
      case 'judgment': star(ctx, 0, 0, 15, '#ffe27a', 3); ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.moveTo(-6, -3); ctx.lineTo(6, -3); stroke(W, 3); break;
      // ---- Blade Dancer
      case 'flicker': ctx.beginPath(); ctx.moveTo(-14, 8); ctx.lineTo(12, -6); ctx.setLineDash([4, 4]); stroke('#ff9ee0', 3); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(4, -12); ctx.lineTo(13, -6); ctx.lineTo(5, 0); stroke(W, 3); break;
      case 'heartseeker': ctx.beginPath(); ctx.moveTo(-14, 10); ctx.lineTo(8, -6); stroke(W, 4); ctx.beginPath(); ctx.moveTo(2, -11); ctx.lineTo(14, -12); ctx.lineTo(10, 0); ctx.closePath(); ctx.fillStyle = '#ff5fb0'; ctx.fill(); stroke('#ffd6f0', 2); break;
      case 'vanish': circle(ctx, 0, 2, 12, 'rgba(90,80,110,.9)', 3); circle(ctx, -4, -1, 2.5, '#ffd6f0', 0); circle(ctx, 4, -1, 2.5, '#ffd6f0', 0); ctx.beginPath(); ctx.arc(-9, -10, 5, 0, TAU); ctx.arc(8, -12, 4, 0, TAU); ctx.fillStyle = 'rgba(200,190,230,.8)'; ctx.fill(); break;
      case 'thousandcuts': for (const [x1, y1, x2, y2] of [[-13, -9, 11, 9], [-13, 9, 11, -9], [-2, -14, 2, 14]]) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); stroke(x1 === -2 ? '#ff9ee0' : W, 3); } break;
      case 'charge': ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(10, 0); ctx.moveTo(2, -9); ctx.lineTo(12, 0); ctx.lineTo(2, 9); stroke('#ff9a3c', 5); ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(-4, -8); ctx.moveTo(-14, 8); ctx.lineTo(-4, 8); stroke(W, 2.5); break;
      case 'slam': ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 4); stroke('#e9eef5', 5); ctx.beginPath(); ctx.arc(0, 10, 12, Math.PI * 1.1, Math.PI * 1.9, true); stroke(Y, 3); for (const a of [-2.4, -1.57, -0.7]) { ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, 10 - Math.sin(a) * 8 - 10); } break;
      case 'whirlwind': ctx.beginPath(); ctx.arc(0, 0, 12, 0, 4.8); stroke(W, 4); ctx.beginPath(); ctx.arc(0, 0, 6, 1, 5.5); stroke(Y, 3); break;
      case 'bash': ctx.beginPath(); ctx.ellipse(-3, 0, 10, 12, 0, 0, TAU); ctx.fillStyle = '#c9864f'; ctx.fill(); stroke('#6a3a1f', 2.5); ctx.beginPath(); ctx.arc(-3, 0, 12, -0.9, 0.9); stroke('#e9eef5', 4); for (const a of [-0.6, 0, 0.6]) { ctx.beginPath(); ctx.moveTo(10 + Math.cos(a) * 2, Math.sin(a) * 8); ctx.lineTo(16 + Math.cos(a) * 2, Math.sin(a) * 13); stroke(Y, 2.5); } break;
      case 'dashshot': ctx.beginPath(); ctx.moveTo(-14, 6); ctx.lineTo(14, -6); stroke('#e6d3a3', 3); ctx.beginPath(); ctx.moveTo(8, -12); ctx.lineTo(15, -6); ctx.lineTo(7, -1); stroke(W, 3); ctx.beginPath(); ctx.arc(-6, 8, 6, 0, TAU); stroke('#8ff3ff', 2); break;
      case 'pierce': ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0); stroke('#b7f07a', 5); ctx.beginPath(); ctx.moveTo(8, -7); ctx.lineTo(16, 0); ctx.lineTo(8, 7); stroke(W, 3); break;
      case 'volley': for (const dx of [-9, 0, 9]) { ctx.beginPath(); ctx.moveTo(dx - 4, -14); ctx.lineTo(dx + 2, 8); stroke('#e6d3a3', 2.5); } ctx.beginPath(); ctx.ellipse(0, 12, 14, 4, 0, 0, TAU); stroke('#b7f07a', 2); break;
      case 'trap': circle(ctx, 0, 0, 9, '#7a7f89', 3); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); stroke(W, 2); } break;
      case 'blink': ctx.beginPath(); ctx.moveTo(-12, 8); ctx.lineTo(12, -8); ctx.setLineDash([4, 5]); stroke('#b69cff', 3); ctx.setLineDash([]); circle(ctx, 10, -8, 5, '#d9ccff', 3); circle(ctx, -10, 8, 4, 'rgba(182,156,255,.5)', 2); break;
      case 'blast': star(ctx, 0, 0, 15, '#b69cff', 3); circle(ctx, 0, 0, 5, W, 0); break;
      case 'meteor': ctx.beginPath(); ctx.moveTo(12, -12); ctx.lineTo(-2, 2); stroke('#ffd23f', 6); circle(ctx, -5, 5, 9, '#ff7a2c', 3); break;
      case 'nova': for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); stroke('#bff4ff', 3); } circle(ctx, 0, 0, 5, W, 2); break;
      case 'dodge': ctx.beginPath(); ctx.arc(0, 0, 11, 0.4, 5.2); stroke('#8ff3ff', 4); ctx.beginPath(); ctx.moveTo(8, -12); ctx.lineTo(12, -4); ctx.lineTo(4, -3); stroke('#8ff3ff', 3); break;
    }
    ctx.restore();
  }

  drawMinimap(ctx, x, y, sim, p, time) {
    if (sim.raid && inRaidArea(p.x, p.y)) return drawRaidMinimap(ctx, x, y, 92, sim, p, CLASSES);
    if (inAstArea(p.x, p.y)) return drawAstraelMinimap(ctx, x, y, 92, sim, p, CLASSES);
    if (inUlt(p)) return drawUltMinimap(ctx, x, y, 92, sim, p, CLASSES);
    if (inTrialArea(p.x, p.y) && drawTrialMinimap(ctx, x, y, 92, sim, p, CLASSES)) return;
    if (inTombArea(p.x, p.y)) return drawTombMinimap(ctx, x, y, 92, sim, p, CLASSES);
    if (inCryptArea(p.x, p.y)) return drawCryptMinimap(ctx, x, y, 92, sim, p, CLASSES);
    if (inHollowArea(p.x, p.y) || inTorArea(p.x, p.y)) return drawGlowMinimap(ctx, x, y, 92, sim, p, CLASSES);
    if (inForgeArea(p.x, p.y)) return drawForgeMinimap(ctx, x, y, 92, sim, p, CLASSES);
    if (inOpsArea(p.x, p.y) && drawOpsMinimap(ctx, x, y, 92, sim, p, CLASSES)) return;
    if (inRiftArea(p.x, p.y)) return drawWorldMinimap(ctx, x, y, 92, sim, p, CLASSES, this.pings, 'rift');
    if (inEmberArea(p.x, p.y)) return drawWorldMinimap(ctx, x, y, 92, sim, p, CLASSES, this.pings, 'ember');
    if (inFrostArea(p.x, p.y)) return drawWorldMinimap(ctx, x, y, 92, sim, p, CLASSES, this.pings, 'frost');
    if (inDunesArea(p.x, p.y)) return drawWorldMinimap(ctx, x, y, 92, sim, p, CLASSES, this.pings, 'dunes');
    if (inTownArea(p.x, p.y)) { // Brightwater Village: the whole town + the Mission Counter marker
      circle(ctx, x, y, 97, INK, 0);
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, 92, 0, TAU); ctx.clip(); ctx.translate(x - 92, y - 92);
      const others = sim.players ? [...sim.players.values()].filter((q) => q.id !== p.id && !q.dead) : [];
      if (tavernOn(sim)) drawTavernMinimap(ctx, 184, p, others); else drawTownMinimap(ctx, 184, p, others, time);
      ctx.restore(); return;
    }
    if (typeof document !== 'undefined' && sim.world && sim.world.spawners) return drawWorldMinimap(ctx, x, y, 92, sim, p, CLASSES, this.pings, 'wilds'); // the big organic Wilds (client/worldmap.js)
    if (!this.minimap) this.buildMinimap(sim.world);
    const R = 92, S = 180, k = (S / 2 / WORLD_R);
    circle(ctx, x, y, R + 5, INK, 0);
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
    ctx.drawImage(this.minimap, x - S / 2, y - S / 2);
    for (const b of sim.bags) if (b.ownerId === p.id) { ctx.fillStyle = ['#e8d2b0', '#4aa8ff', '#b86bff', '#ffb52e', '#2ee6c4', '#ff4f7b'][b.rarity] || '#fff'; ctx.fillRect(x + b.x * k - 2, y + b.y * k - 2, 4, 4); }
    for (const e of sim.enemies) {
      if (e.boss) continue;
      if (Math.abs(e.x - p.x) > 700 || Math.abs(e.y - p.y) > 700) continue;
      ctx.fillStyle = e.elite ? '#ffcf3a' : '#ff4d4d'; ctx.fillRect(x + e.x * k - 1.5, y + e.y * k - 1.5, 3, 3);
    }
    // co-op: teammates (class colour) and pings
    if (sim.players) for (const q of sim.players.values()) {
      if (q.id === p.id || q.dead) continue;
      circle(ctx, x + q.x * k, y + q.y * k, 3.5, CLASSES[q.cls] ? CLASSES[q.cls].color : '#fff', 1.5);
    }
    if (this.pings) for (const pg of this.pings) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(pg.t * 10); circle(ctx, x + pg.x * k, y + pg.y * k, 5, '#ffd23f', 2); ctx.globalAlpha = 1; }
    ctx.restore();
    // boss skull marker
    const boss = sim.enemies.find((e) => e.boss);
    this.skull(ctx, x + BOSS_POS.x * k, y + BOSS_POS.y * k + 1, boss ? '#ff5e5b' : 'rgba(255,255,255,.4)');
    // player arrow
    ctx.save(); ctx.translate(x + p.x * k, y + p.y * k); ctx.rotate(p.aim);
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-3, 0); ctx.lineTo(-5, 5); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
    circle(ctx, x, y, R + 3, null, 5, INK);
    circle(ctx, x, y, R, null, 2, 'rgba(255,255,255,.35)');
  }

  /** Eclipse finisher routes: two rows of key chips (current key labels), done steps lit, the next one pulsing, a broken
   *  route faded and struck through. Centered on cx; `sc` scales it (the phone HUD passes its own scale). */
  drawRoutes(ctx, cx, y, p, time, sc = 1) {
    const g = routeGuide(p);
    if (!g) return;
    this.routeRows = { time, rows: g.map((r) => ({ id: r.id, step: r.step, broken: r.broken, fin: r.fin })) }; // (playtests read what was drawn)
    ctx.save(); ctx.translate(cx, y); ctx.scale(sc, sc);
    const cw = 26, ch = 20, gap = 5, nameW = 150, rowH = 26;
    g.forEach((r, row) => {
      const yy = row * rowH, col = r.route === 'mob' ? '#ff9ee0' : '#ffe6a8';
      const keys = ['T', ...r.seq], labels = keys.map((k) => (k === 'T' ? this.keyLabel('ult') : this.stepLabel(k)));
      const widths = labels.map((l) => Math.max(cw, l.length * 8 + 10));
      const total = nameW + widths.reduce((a, b) => a + b + gap, 0) + 12;
      let x = -total / 2;
      ctx.globalAlpha = r.broken ? 0.3 : 1;
      rrect(ctx, x - 8, yy - 3, total + 12, ch + 6, 9); ctx.fillStyle = r.fin ? 'rgba(90,30,90,.85)' : 'rgba(26,16,40,.72)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = r.fin ? col : INK; ctx.stroke();
      txt(ctx, (r.route === 'mob' ? '✦ ' : '☾ ') + r.name, x + nameW - 8, yy + ch / 2 + 1, 13, r.broken ? '#aaa' : col, 'right', 3);
      x += nameW;
      keys.forEach((k, j) => {
        const done = j <= r.step, next = !r.broken && !r.done && j === r.step + 1, kw = widths[j];
        if (next) { ctx.save(); ctx.globalAlpha = 0.45 + 0.35 * Math.sin(time * 12); rrect(ctx, x - 3, yy - 3, kw + 6, ch + 6, 7); ctx.fillStyle = col; ctx.fill(); ctx.restore(); }
        rrect(ctx, x, yy, kw, ch, 5); ctx.fillStyle = done ? col : next ? '#fff6d8' : '#2b2433'; ctx.fill();
        txt(ctx, labels[j], x + kw / 2, yy + ch / 2 + 1, 12, done || next ? INK : 'rgba(255,255,255,.75)', 'center', 0);
        x += kw + gap;
        if (j === keys.length - 1) { if (r.done || r.fin) txt(ctx, '★', x + 4, yy + ch / 2, 14, col, 'left', 3); }
      });
      if (r.broken) { ctx.globalAlpha = 0.8; ctx.fillStyle = '#d0c4dc'; ctx.fillRect(-total / 2 - 4, yy + ch / 2 - 1, total + 4, 2); txt(ctx, 'BROKEN', total / 2 + 14, yy + ch / 2 + 1, 11, '#d0c4dc', 'left', 3); }
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  /** Ult window banner (Warrior / Ranger / Mage / Cleric): time left, then FINISHER while one plays. */
  windowLine(ctx, cx, y, p, cls, time, fs) {
    const W = p.uw, fin = W.rt && W.rt.fin;
    const t = cls.rageRes ? `BERSERK ${(Math.max(0, W.t) / 60).toFixed(1)}s · NO COOLDOWNS · HIT ${W.rt ? Math.min(W.rt.bn || 0, cls.flow.berserkHits) : 0}/${cls.flow.berserkHits}+ · END ${this.stepLabel('Q')} ${this.stepLabel('E')} / ${this.stepLabel('Q')} ${this.stepLabel('R')}` : `${cls.ult.name.toUpperCase()} ${(Math.max(0, W.t) / 60).toFixed(1)}s · FREE SKILLS · FINISH A ROUTE`;
    txt(ctx, fin ? '★ FINISHER ★' : t, cx, y, fs + Math.sin(time * 10) * 1.5, fin ? '#fff2b0' : ULT_COL[p.cls] || '#ffd23f', 'center', 3.5);
  }

  /** Class state (Retaliation / Focus / Arcane Surge / Consecration): name, time bar and which keys transform. */
  stateLine(ctx, cx, y, p, time, fs) {
    const S = stateDef(p);
    if (!S) return;
    const k = Math.max(0, p.cst.t / S.dur), nx = statePrimed(p).map((c) => `${this.stepLabel(c.next)}${c.then ? '→' + this.stepLabel(c.then) : ''} ${chainName(p, c.id)}`).join('  ·  ');
    txt(ctx, `${S.name.toUpperCase()} ${(p.cst.t / 60).toFixed(1)}s${nx ? ' → ' + nx : ''}`, cx, y, fs + Math.sin(time * 14) * 1.2, S.color, 'center', 3.5);
    const bw = 140; rrect(ctx, cx - bw / 2, y + fs * 0.7, bw, 5, 2.5); ctx.fillStyle = INK; ctx.fill();
    rrect(ctx, cx - bw / 2 + 1, y + fs * 0.7 + 1, (bw - 2) * k, 3, 1.5); ctx.fillStyle = S.color; ctx.fill();
  }

  /** Your stack kind on the most-stacked enemy near you (e.g. "SUNDER ●●●○○"). */
  stackLine(ctx, x, y, p, sim, time, fs, align = 'left') {
    const C = CLASSES[p.cls], st = C && C.stack;
    if (!st || !sim || !sim.enemies) return;
    let best = 0, bm = st.max;
    for (const e of sim.enemies.values()) {
      if (e.dead || Math.abs(e.x - p.x) > 900 || Math.abs(e.y - p.y) > 600) continue;
      const n = stackN(e, st.id, p.id);
      if (n > best) { best = n; bm = e.boss ? st.bossMax || st.max : st.max; }
    }
    if (!best) return;
    const col = STACK_COL[st.id] || '#fff', dots = '●'.repeat(Math.min(best, 12)) + '○'.repeat(Math.max(0, Math.min(bm, 12) - best));
    txt(ctx, `${st.name.toUpperCase()} ${dots}`, x, y, fs + (best >= bm ? Math.sin(time * 12) * 1.5 : 0), col, align, 3);
  }

  drawChains(ctx, x, y, p, cls, sim) {
    const primed = primedChains(p, sim.tick, sim);
    const w = 250, lh = 36;
    const list = hudChains(p.cls, p.chainSet), n = list.length; // step 4: the chain setup (pins / focus) of the active loadout
    this.chainsBottom = y + 30 + n * lh;
    if (!(uiOn() && ui9(ctx, 'window', x - 6, y - 6, w + 12, 42 + n * lh, 44, 18, 0.9))) { rrect(ctx, x, y, w, 30 + n * lh, 12); ctx.fillStyle = 'rgba(38,32,52,.72)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); } // (painted: the U2 window plate)
    const tag = p.chainSet && p.chainSet.pins && p.chainSet.pins.length ? '  ☆ PINNED' : p.chainSet && p.chainSet.focus !== 'all' ? `  · ${p.chainSet.focus.toUpperCase()}` : '';
    txt(ctx, `CHAIN COMBOS${tag}  (${this.keyLabel('combos')})`, x + 12, y + 16, 14, '#ffd23f', 'left', 3);
    list.forEach((c, i) => {
      const yy = y + 34 + i * lh;
      const pr = primed.find((q) => q.id === c.id);
      let kx = x + 12;
      c.seq.forEach((key, j) => {
        const lbl = this.stepLabel(key);
        const kw = lbl.length > 2 ? Math.max(36, lbl.length * 7 + 8) : 22;
        const done = pr && j < pr.step, next = pr && j === pr.step;
        rrect(ctx, kx, yy, kw, 18, 5); ctx.fillStyle = done ? '#3cc15b' : next ? '#ffd23f' : '#2b2433'; ctx.fill();
        txt(ctx, lbl, kx + kw / 2, yy + 9.5, 12, next ? INK : '#fff', 'center', 0);
        kx += kw + 4;
        if (j < c.seq.length - 1) { txt(ctx, '›', kx + 1, yy + 9, 14, '#fff', 'left', 2); kx += 10; }
      });
      const stCol = c.state && cls.state ? cls.state.color : null;
      txt(ctx, (c.sp ? '★ ' : '') + (c.stealth || c.vanish ? '☾ ' : c.state ? '⚡ ' : c.rage ? '🔥 ' : '') + c.name, kx + 6, yy + 9, 14, pr ? '#ffd23f' : c.sp ? '#ffb86b' : c.rage ? '#ff7a5c' : stCol || '#fff', 'left', 3); // ☾ = cast while hidden by Vanish; ⚡ = during the class state; 🔥 = Rage version (50+ Rage)
      ctx.font = "11px 'Trebuchet MS', sans-serif"; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fillText(c.desc.slice(c.desc.indexOf(':', c.desc.lastIndexOf('→') + 1) + 1).trim().slice(0, 44), x + 12, yy + 27); // (the text after the step list: Specials like 'Iaijutsu: Void Draw' carry their own colon)
    });
  }
}
/** Skill keys that are the next step of a live Eclipse finisher route (lit on the skill bar / touch buttons). */
const ULT_COL = { warrior: '#ffae3b', ranger: '#b8ff7a', mage: '#9ad8ff', cleric: '#fff0a0', samurai: '#ffc2e0', monk: '#ffd23f', dragoon: '#ff5a6e', summoner: '#3ff0c8', bard: '#ffd86a' };
export const STACK_COL = { sunder: '#ff5a3c', quarry: '#7dff6a', burn: '#ff9a2a', condemn: '#ffd84a', cut: '#ff8cc6' };
function chainName(p, id) { const c = CLASSES[p.cls].chains.find((q) => q.id === id); return c ? c.name : id; }
export function routeNext(p) {
  const out = new Set(), g = routeGuide(p);
  if (g) for (const r of g) if (!r.broken && !r.done) out.add(r.seq[r.step]);
  return out;
}
export { txt, bar, pbar };

/** Blade Dancer Edge (crit stacks) readout: "EDGE ◆◆◆◇◇ +12% crit". */
export function edgeLine(ctx, x, y, p, cls, time, fs, align = 'left') {
  const E = cls.edge, n = p.edge || 0;
  const s = `EDGE ${'◆'.repeat(n)}${'◇'.repeat(Math.max(0, E.max - n))}` + (n ? `  +${Math.round(n * E.crit * 100)}% crit` : '');
  txt(ctx, s, x, y, fs + (n >= E.max ? Math.sin(time * 12) * 1.5 : 0), n >= E.max ? '#fff0fa' : '#ff9ee0', align, 3);
}
/** Part D A3: a small violet star on a skill slot whose Astral variant is on (PC HUD + phone buttons) */
export function altBadge(ctx, x, y, time, sc = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.rotate(Math.sin(time * 2) * 0.15);
  ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 4 : 9, a = -Math.PI / 2 + (i / 10) * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath();
  ctx.fillStyle = '#c9b6ff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#2b2433'; ctx.stroke();
  ctx.globalAlpha = 0.5 + 0.4 * Math.sin(time * 5); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
