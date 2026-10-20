// Compact phone HUD (canvas) + the on-screen touch controls. Reuses the desktop HUD's minimap,
// portrait, icons, skulls and chain list, just laid out for a small landscape screen.
import { dodgePips, dodgeCdK } from '../../js/client/sprintfx.js';
import { HUD, txt, bar, pbar, zoneHere, edgeLine } from '../../js/client/hud.js';
import { uiOn, uiAround } from '../../js/client/uipaint.js'; // painted U1 frames (Art style = Painted)
import { gloryMeter, trinityPanel, STANCE_COL } from '../../js/client/wmhud.js';
import { focusMeter, cutsOut } from '../../js/client/samhud.js';
import { chiMeter, comboBadge } from '../../js/client/monkhud.js';
import { bloodMeter, diveBadge } from '../../js/client/drghud.js';
import { drawRaidBar, drawRaidCallout } from '../../js/client/raidfx.js';
import { drawAstraelHud } from '../../js/client/astraelfx.js';
import { drawAstralTag } from '../../js/client/astralbossfx.js'; // (Part C2)
import { DC, drawDuelHud } from '../../js/client/duelcine.js';
import { drawTrialHud } from '../../js/client/trialfx.js';
import { drawUltHud, inUlt } from '../../js/client/ultfx.js'; // Part F: the Ultimate
import { inTrialArea } from '../../js/sim/trialconst.js';
import { drawTombHud } from '../../js/client/tombfx.js';
import { drawCryptHud } from '../../js/client/cryptfx.js';
import { drawGlowHud } from '../../js/client/glowfx.js';
import { inHollowArea, inTorArea } from '../../js/sim/glowconst.js';
import { inCryptArea } from '../../js/sim/frostconst.js';
import { drawForgeHud } from '../../js/client/forgefx.js';
import { drawOpsHud } from '../../js/client/opsfx.js'; // mission dungeons
import { inOpsArea } from '../../js/sim/opsconst.js';
import { inForgeArea } from '../../js/sim/emberconst.js';
import { inTombArea } from '../../js/sim/dunesconst.js';
import { CLASSES, dodgeOf, GCD } from '../../js/sim/data/classes.js';
import { zoneAt } from '../../js/sim/constants.js';
import { xpToNext, MAX_LEVEL } from '../../js/sim/progression.js';
import { primedChains, routeGuide } from '../../js/sim/player.js';
import { specInfo } from '../../js/sim/specials.js';
import { chainById } from '../../js/sim/data/classes.js';
import { INK, circle, rrect } from '../../js/client/art.js';
import { chainHighlights, SKILL_AIM } from './touch.js';
import { altOn, ASC_ALT } from '../../js/sim/ascalt.js';
import { altBadge } from '../../js/client/hud.js';

const TAU = Math.PI * 2;
const DANGER_COL = ['#8fff8a', '#d4ff5c', '#ffd23f', '#ff9a3c', '#ff4d4d', '#ff3b8a', '#d42bff'];

export class MobileHUD extends HUD {
  constructor() { super(); this.safe = { l: 0, r: 0, t: 0, b: 0 }; this.showChains = false; this.primed = []; }
  keyLabel(id) { return id === 'ult' ? 'ULT' : super.keyLabel(id); } // phone buttons: Q E R F + ULT

  draw(ctx, w, h, sim, p, fx, time, dt) {
    const cls = CLASSES[p.cls], S = this.safe;
    const sc = Math.max(0.85, Math.min(1.35, Math.min(w, h) / 390));
    if (DC.seq) { drawDuelHud(ctx, w, h, sc * 0.8, txt, time); return; } // (B3: a Shadow Duel cinematic owns the screen)
    this.primed = primedChains(p, sim.tick, sim);
    const rg = routeGuide(p); // Eclipse finisher routes: their next steps glow like chain steps (and lead the hint)
    if (rg) for (const r of rg.slice().reverse()) if (!r.broken && !r.done) this.primed.unshift({ id: r.id, next: r.seq[r.step], step: r.step, route: true });
    if ((p.eclipse || p.uw) && (p.eclipse || p.uw).rt && (p.eclipse || p.uw).rt.fin) this.primed = []; // a finisher is playing: no stray chain hints
    if (fx.vignette > 0) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(220,20,20,${0.5 * fx.vignette})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    if (fx.flash > 0) { ctx.save(); ctx.globalAlpha = Math.min(0.45, fx.flash * 0.5); ctx.fillStyle = fx.flashColor || '#fff'; ctx.fillRect(0, 0, w, h); ctx.restore(); } // ultimate flash
    if (p.hp / p.stats.maxHp < 0.3 && !p.dead) {
      const a = 0.16 + 0.1 * Math.sin(time * 6);
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
      g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }

    // ---- top-left: portrait, name, HP / resource / XP
    const x0 = S.l + 10, y0 = S.t + 8;
    ctx.save(); ctx.translate(x0 + 26 * sc, y0 + 26 * sc); ctx.scale(0.72 * sc, 0.72 * sc);
    this.portrait(ctx, 0, 0, p, time); ctx.restore();
    const bx = x0 + 58 * sc, bw = Math.min(200 * sc, w * 0.26);
    txt(ctx, `${p.name}  ·  Lv ${p.level}`, bx, y0 + 9 * sc, Math.round(14 * sc), '#fff', 'left', 3);
    const hpK = Math.max(0, p.hp / p.stats.maxHp);
    this.hpGhost = Math.max(hpK, this.hpGhost - dt * 0.35);
    pbar(ctx, bx, y0 + 20 * sc, bw, Math.round(15 * sc), hpK, hpK > 0.3 ? '#5fdc4a' : '#ff4d4d', `${Math.ceil(p.hp)} / ${p.stats.maxHp}`, this.hpGhost);
    if (cls.pips) this.pips(ctx, bx, y0 + 41 * sc, bw * 0.8, Math.round(10 * sc), p, cls, time);
    else if (cls.gloryRes) gloryMeter(ctx, bx, y0 + 40 * sc, bw * 0.8, Math.round(12 * sc), p, cls, time, 0.8 * sc, true);
    else if (cls.focusRes) focusMeter(ctx, bx, y0 + 40 * sc, bw * 0.8, Math.round(12 * sc), p, cls, time, 0.8 * sc, true, cutsOut(sim, p)); // Samurai: Focus + Delayed Cuts
    else if (cls.bloodRes) bloodMeter(ctx, bx, y0 + 40 * sc, bw * 0.8, Math.round(12 * sc), p, cls, time, 0.8 * sc, false); // Dragoon: Dragon Blood
    else if (cls.chiRes) chiMeter(ctx, bx, y0 + 40 * sc, bw * 0.8, Math.round(12 * sc), p, cls, time, 0.8 * sc, false); // Monk: Chi
    else pbar(ctx, bx, y0 + 42 * sc, bw * 0.8, Math.round(8 * sc), p.res / p.stats.maxRes, cls.resColor, null, null, 'resbar');
    if (cls.edge) edgeLine(ctx, w / 2, h * 0.62 + 38 * sc, p, cls, time, Math.round(11 * sc), 'center');
    if (!cls.pips && !cls.gloryRes && !cls.focusRes && !cls.chiRes && !cls.bloodRes) txt(ctx, cls.resOnBasicHit ? `✦${Math.floor(p.res)}` : String(Math.floor(p.res)), bx + bw * 0.8 + 8, y0 + 46 * sc, Math.round(11 * sc), cls.resColor, 'left', 3);
    if (p.shield > 0) txt(ctx, `🛡${Math.ceil(p.shield)}`, bx + bw + 8, y0 + 27 * sc, Math.round(12 * sc), '#bfefff', 'left', 3);
    if (p.perfectCrit > 0) txt(ctx, 'NEXT HIT CRITS!', w / 2, h * 0.62, Math.round(14 * sc), '#ff9ee0', 'center', 3.5);
    else if (p.eclipse) txt(ctx, `ECLIPSE ${(Math.max(0, p.eclipse.t) / 60).toFixed(1)}s · FREE SKILLS${p.stealth > 0 ? ' · BACKSTAB READY' : ''}`, w / 2, h * 0.62, Math.round(14 * sc), '#d8a8ff', 'center', 3.5);
    else if (p.uw) this.windowLine(ctx, w / 2, h * 0.62, p, cls, time, Math.round(14 * sc));
    if (p.eclipse || p.uw) this.drawRoutes(ctx, w / 2, h * 0.62 - 64 * sc, p, time, 0.78 * sc); // finisher route guides
    if (cls.bloodRes) diveBadge(ctx, w / 2, S.t + 66 * sc, p, time, 0.72 * sc); // Dragoon: Skyborne / dive targets
    if (cls.chiRes) comboBadge(ctx, w / 2, S.t + 70 * sc, p, time, 0.72 * sc); // Monk: hit counter + tier (top centre under the zone name, like the Warrior's Trinity panel)
    if (cls.arms) this.stanceInfo = trinityPanel(ctx, w / 2, S.t + 64 * sc, p, cls, time, 0.72 * sc, !this.quality); // Warrior: the Weapon Trinity tracker (top centre under the zone name, clear of the fight)
    if (p.cst && !(p.uw && p.uw.rt && p.uw.rt.fin)) this.stateLine(ctx, w / 2, p.uw ? h * 0.62 - 82 * sc : h * 0.62 - 22 * sc, p, time, Math.round(13 * sc));
    this.stackLine(ctx, w / 2, h * 0.62 + 20 * sc, p, sim, time, Math.round(12 * sc), 'center');
    if (p.eclipse || p.uw || p.perfectCrit > 0) { /* banner already drawn */ }
    else if (p.stealth > 0) txt(ctx, 'STEALTHED – BACKSTAB READY', w / 2, h * 0.62, Math.round(14 * sc), '#d9c6ff', 'center', 3.5);
    const need = xpToNext(p.level), xpK = p.level >= MAX_LEVEL ? 1 : p.xp / need;
    rrect(ctx, bx, y0 + 56 * sc, bw * 0.8, 5, 2.5); ctx.fillStyle = INK; ctx.fill();
    rrect(ctx, bx + 1, y0 + 57 * sc, (bw * 0.8 - 2) * xpK, 3, 1.5); ctx.fillStyle = '#b86bff'; ctx.fill();
    if (cls.ult) this.ultBar(ctx, bx, y0 + 66 * sc, bw * 0.8, Math.round(11 * sc), p, cls, time); // ultimate meter
    { const qy = Math.round(y0 + 84 * sc), qx = Math.round(x0); if (qy !== this._qtY || qx !== this._qtX) { this._qtY = qy; this._qtX = qx; const st = typeof document !== 'undefined' && document.documentElement.style; if (st) st.setProperty('--qt-top', qy + 'px'); if (st) st.setProperty('--qt-left', qx + 'px'); } } // (UI leftovers: the story tracker sits under the player frame, clear of the Trinity panel and the NPCs around you)

    // ---- top centre: zone
    const z = zoneHere(p);
    if (z.id !== this.zoneShown) { this.zoneShown = z.id; this.zoneToast = 3; }
    this.zoneToast = Math.max(0, this.zoneToast - dt);
    txt(ctx, z.name, w / 2, S.t + 14 * sc, Math.round(17 * sc), '#fff', 'center', 3.5);
    if (this.astral) { ctx.font = `${Math.round(17 * sc)}px 'Lilita One', sans-serif`; drawAstralTag(ctx, Math.round(w / 2 + ctx.measureText(z.name).width / 2 + 8 * sc), S.t + 14 * sc, 0.85 * sc, this.t || 0); } // (Part C2: the Astral World tag)
    if (z.danger === 0) txt(ctx, 'SAFE ZONE', w / 2, S.t + 33 * sc, Math.round(12 * sc), DANGER_COL[0], 'center', 3);
    else { ctx.save(); ctx.translate(w / 2, S.t + 33 * sc); ctx.scale(0.7 * sc, 0.7 * sc); const nS = Math.max(4, z.danger); for (let i = 0; i < nS; i++) this.skull(ctx, -(nS - 1) * 11 + i * 22, 0, i < z.danger ? DANGER_COL[z.danger] : 'rgba(255,255,255,.2)'); ctx.restore(); }

    // ---- top-right: small minimap (the DOM menu/bag buttons sit to its left)
    const mr = 46 * sc, mk = mr / 92;
    ctx.save(); ctx.translate(w - S.r - 10 - mr, S.t + 8 + mr); ctx.scale(mk, mk);
    if (uiOn()) uiAround(ctx, 'minimap', -93, -93, 186, 186);
    this.drawMinimap(ctx, 0, 0, sim, p, time); ctx.restore();
    this.bigMap.setMinimap(w - S.r - 10 - mr, S.t + 8 + mr, mr + 8); // (tap: the big map)

    // ---- optional chain list (under the portrait)
    if (this.showChains) { ctx.save(); ctx.translate(x0, y0 + 70 * sc); ctx.scale(0.66 * sc, 0.66 * sc); this.drawChains(ctx, 0, 0, p, cls, sim); ctx.restore(); }

    // ---- combo counter (right-centre, above the buttons)
    if (p.comboHits !== this.lastCombo) { if (p.comboHits > this.lastCombo) this.comboPop = 1; this.lastCombo = p.comboHits; }
    this.comboPop = Math.max(0, this.comboPop - dt * 5);
    if (p.comboHits >= 3) {
      const s = (1 + this.comboPop * 0.35) * 0.62 * sc, cx = w - S.r - (w >= h ? 175 : 70) * sc, cy = h * 0.3; // landscape: left of the ULT button
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.08); ctx.scale(s, s);
      const col = p.comboHits >= 30 ? '#ff5e5b' : p.comboHits >= 15 ? '#ffb52e' : '#ffe45c';
      txt(ctx, String(p.comboHits), 0, 0, 58, col, 'center', 9);
      txt(ctx, 'HITS', 0, 38, 22, '#fff', 'center');
      ctx.restore();
    }

    // ---- boss bar (Vorthax gets the raid bar: phase pips, ward, enrage timer + callouts)
    if (DC.seq || DC.dlg || DC.shards || DC.clash || DC.swellT > 0) drawDuelHud(ctx, w, h, sc * 0.8, txt, time); // (B3: the Shadow Duel cinematics, phone scale)
    const astY = drawAstraelHud(ctx, sim, p, w, h, sc * 0.72, txt, bar, time); // Astrael (same HUD, phone scale)
    let raidY = astY || drawTrialHud(ctx, sim, p, w, h, sc * 0.72, txt, bar, time) || drawRaidBar(ctx, sim, p, w, S.t + 64 * sc, sc * 0.72, txt, bar); // (+ the Skaldra / Pyrrhex trials, phone scale)
    if (!raidY && inUlt(p)) { const k = sc * 0.66, oy = S.t + 14 * sc; ctx.save(); ctx.translate(0, oy); ctx.scale(k, k); const ty = drawUltHud(ctx, sim, p, w / k, h / k, txt, bar, time); ctx.restore(); if (ty) raidY = oy + ty * k; } // the Ultimate (phone scale)
    if (!raidY && inTombArea(p.x, p.y)) { const k = sc * 0.72; ctx.save(); ctx.translate(0, S.t); ctx.scale(k, k); const ty = drawTombHud(ctx, sim, p, w / k, h / k, txt, bar, time); ctx.restore(); if (ty) raidY = S.t + ty * k; } // the Tomb (phone scale)
    if (!raidY && inCryptArea(p.x, p.y)) { const k = sc * 0.72; ctx.save(); ctx.translate(0, S.t); ctx.scale(k, k); const ty = drawCryptHud(ctx, sim, p, w / k, h / k, txt, bar, time); ctx.restore(); if (ty) raidY = S.t + ty * k; } // the Glacier Crypt (phone scale)
    if (!raidY && (inHollowArea(p.x, p.y) || inTorArea(p.x, p.y))) { const k = sc * 0.72; ctx.save(); ctx.translate(0, S.t); ctx.scale(k, k); const ty = drawGlowHud(ctx, sim, p, w / k, h / k, txt, bar); ctx.restore(); if (ty) raidY = S.t + ty * k; } // the Glowmire Hollow / the Stormcrown Tor (phone scale)
    if (!raidY && inForgeArea(p.x, p.y)) { const k = sc * 0.72; ctx.save(); ctx.translate(0, S.t); ctx.scale(k, k); const ty = drawForgeHud(ctx, sim, p, w / k, h / k, txt, bar, time); ctx.restore(); if (ty) raidY = S.t + ty * k; } // the Forge of Cinders (phone scale)
    if (!raidY && inOpsArea(p.x, p.y)) { const k = sc * 0.72; ctx.save(); ctx.translate(0, S.t); ctx.scale(k, k); const ty = drawOpsHud(ctx, sim, p, w / k, h / k, txt, bar, time, () => 'TAP'); ctx.restore(); if (ty) raidY = S.t + ty * k; } // mission dungeons (phone scale)
    if (raidY && !inTombArea(p.x, p.y) && !inCryptArea(p.x, p.y) && !inHollowArea(p.x, p.y) && !inTorArea(p.x, p.y) && !inForgeArea(p.x, p.y) && !inTrialArea(p.x, p.y) && !inOpsArea(p.x, p.y)) drawRaidCallout(ctx, sim, p, w, h, sc * 0.72, txt);
    const boss = !raidY && sim.enemies.find((e) => e.boss && !e.raid && !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 900);
    if (boss) {
      const bbw = Math.min(380 * sc, w * 0.42), bbx = w / 2 - bbw / 2, bby = S.t + 58 * sc;
      txt(ctx, boss.name, w / 2, bby - 6, Math.round(14 * sc), '#ffb0ff', 'center', 3);
      pbar(ctx, bbx, bby + 4, bbw, Math.round(12 * sc), boss.hp / boss.maxHp, boss.phase === 3 ? '#ff4d4d' : '#b05cff', null);
      const pk = boss.cc.down > 0 ? 0 : boss.poise / boss.maxPoise;
      rrect(ctx, bbx + bbw * 0.2, bby + 22 * sc, bbw * 0.6, 5, 2.5); ctx.fillStyle = INK; ctx.fill();
      rrect(ctx, bbx + bbw * 0.2 + 1, bby + 22 * sc + 1, (bbw * 0.6 - 2) * pk, 3, 1.5); ctx.fillStyle = '#ffd23f'; ctx.fill();
      txt(ctx, `P${boss.phase}`, bbx + bbw + 8, bby + 10, Math.round(12 * sc), '#fff', 'left', 3);
    }

    // ---- banners (smaller than desktop)
    let by = h * 0.26;
    const opsBan = raidY && inOpsArea(p.x, p.y), bk = opsBan ? 0.8 : 1; // (a mission: banners start under its objective lines, not on the top bars; a touch smaller)
    if (opsBan && fx.banners.length) by = Math.max(by, raidY + Math.round(fx.banners[0].size * 0.6 * sc * bk) * 0.75 + 4);
    for (const b of fx.banners) {
      const k = b.t / b.life, s0 = k < 0.1 ? 1.6 - (k / 0.1) * 0.6 : 1, a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      const size = Math.round(b.size * 0.6 * sc * bk);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(w / 2, by); ctx.scale(s0, s0);
      txt(ctx, b.str, 0, 0, size, b.color, 'center', size * 0.2);
      if (b.sub) txt(ctx, b.sub, 0, size * 0.8, Math.round(13 * sc), '#fff', 'center', 3);
      ctx.restore();
      by += size + (b.sub ? 34 : 16) * sc;
    }
  }

  /** Touch controls: attack/skills/dodge with cooldown rings + costs, joystick, chain hint, aim previews. */
  drawControls(ctx, w, h, L, tc, p, sim, time, view) {
    const cls = CLASSES[p.cls];
    const glow = chainHighlights(this.primed);
    const sc = L.scale;
    // joystick
    const J = L.joy;
    if (tc.joy) {
      circle(ctx, tc.joy.bx, tc.joy.by, J.r, 'rgba(20,14,30,.28)', 3, 'rgba(255,255,255,.55)');
      const dx = tc.joy.x - tc.joy.bx, dy = tc.joy.y - tc.joy.by, d = Math.hypot(dx, dy), k = d > J.r ? J.r / d : 1;
      circle(ctx, tc.joy.bx + dx * k, tc.joy.by + dy * k, J.r * 0.45, 'rgba(255,255,255,.85)', 3, INK);
    } else if (view.hints) {
      ctx.globalAlpha = 0.35;
      circle(ctx, J.homeX, J.homeY, J.r, 'rgba(20,14,30,.25)', 3, 'rgba(255,255,255,.6)');
      circle(ctx, J.homeX, J.homeY, J.r * 0.45, 'rgba(255,255,255,.55)', 2, INK);
      ctx.globalAlpha = 1;
      txt(ctx, 'MOVE', J.homeX, J.homeY + J.r + 12 * sc, Math.round(11 * sc), 'rgba(255,255,255,.7)', 'center', 3);
    }
    // buttons
    for (const b of L.buttons) {
      const down = tc.pressed.has(b.id);
      let icon = 'basic', cdK = 0, cdTxt = '', noRes = false, cost = null, label = '';
      if (b.id === 'ATK') { icon = cls.arms && p.wm ? 'wm_basic_' + p.wm.st : 'basic'; }
      else if (b.id === 'T') { icon = cls.ult.id; cdK = 1 - Math.min(1, (p.ult || 0) / 100); label = 'ULT'; if (cdK > 0) cdTxt = `${Math.floor(p.ult || 0)}%`; }
      else if (b.id === 'DODGE') { const D = dodgeOf(p.cls); icon = 'dodge'; cdK = dodgeCdK(p, D); noRes = p.res < D.cost; label = 'DODGE'; }
      else {
        const sk = cls.skills[b.id];
        icon = sk.id; cost = cls.gloryRes || cls.focusRes || cls.chiRes || cls.bloodRes || !sk.cost ? null : p.eclipse || p.aura > 0 ? 0 : sk.cost; label = b.id === 'SP' ? '' : b.id; // Eclipse / Ascension: free (Warrior skills are always free)
        const max = sk.cd * 60;
        if (max > 0) {
          cdK = (p.cds[b.id] || 0) / max;
          if (p.cds[b.id] > 0) cdTxt = (p.cds[b.id] / 60).toFixed(p.cds[b.id] < 60 ? 1 : 0);
        }
        if (p.gcd > 0) cdK = Math.max(cdK, p.gcd / Math.max(GCD, cls.gcd || 0)); // the global cooldown sweep (every skill button; a primed chain key still glows under it)
        noRes = p.res < sk.cost && !(p.aura > 0) && !p.eclipse && !this.primed.some((c) => c.next === b.id && c.free);
      }
      const ultFull = b.id === 'T' && cdK <= 0;
      const lit = glow.has(b.id) || ultFull;
      const rageLit = lit && cls.rageRes && this.primed.some((c) => c.next === b.id && c.rage); // a Rage chain is primed on this button
      const r = b.r * (down ? 0.94 : 1);
      if (lit) {
        const gc = rageLit ? '#ff3b2b' : '#ffd23f';
        ctx.save(); ctx.shadowColor = gc; ctx.shadowBlur = view.quality > 0 ? 18 + 8 * Math.sin(time * 12) : 0;
        circle(ctx, b.x, b.y, r + (ultFull ? 9 + 4 * Math.sin(time * 9) : 5 + 2 * Math.sin(time * 12)), gc, 0); ctx.restore();
        if (ultFull) { ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 6); circle(ctx, b.x, b.y, r + 16 + 6 * ((time * 1.5) % 1) * 2, null, 3, '#fff1a0'); ctx.restore(); }
      }
      circle(ctx, b.x, b.y, r, down ? 'rgba(90,80,120,.92)' : noRes ? 'rgba(90,50,70,.82)' : 'rgba(58,50,82,.78)', 4, INK);
      circle(ctx, b.x, b.y, r - 5, null, 2, 'rgba(255,255,255,.25)');
      if (b.id === 'SP' || b.id === 'T') { circle(ctx, b.x, b.y, r - 4, null, 3, b.id === 'T' ? '#ffd23f' : cls.color); if (b.id === 'SP' && specInfo(p)) { ctx.save(); ctx.globalAlpha = 0.5 + 0.4 * Math.sin(time * 10); circle(ctx, b.x, b.y, r + 6, null, 4, cls.color); ctx.restore(); } } // the Special / ULTIMATE: their own coloured frames
      ctx.save(); ctx.translate(b.x, b.y); const isc = (r / 27) * (b.id === 'ATK' ? 0.9 : 1); ctx.scale(isc, isc);
      this.icon(ctx, icon, 0, 0, cls, noRes || cdK > 0); ctx.restore();
      if (altOn(p) && ASC_ALT[p.cls].key === b.id) altBadge(ctx, b.x + r * 0.72, b.y - r * 0.72, time, 0.9); // (Part D A3: the Astral variant)
      if (cdK > 0) {
        // cooldown: dark pie + bright ring showing the remaining time
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, r - 3, -Math.PI / 2, -Math.PI / 2 + TAU * cdK); ctx.closePath();
        ctx.fillStyle = 'rgba(15,10,25,.55)'; ctx.fill();
        ctx.beginPath(); ctx.arc(b.x, b.y, r + 1, -Math.PI / 2, -Math.PI / 2 + TAU * cdK);
        ctx.strokeStyle = b.id === 'T' ? '#ffd23f' : '#8ff3ff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
        if (b.id === 'T') { ctx.beginPath(); ctx.arc(b.x, b.y, r + 1, -Math.PI / 2 + TAU * cdK, -Math.PI / 2 + TAU); ctx.strokeStyle = '#ff9a3c'; ctx.lineWidth = 5; ctx.stroke(); } // filled part of the meter
        if (cdTxt) txt(ctx, cdTxt, b.x, b.y, Math.round(r * (b.id === 'T' ? 0.42 : 0.62)), b.id === 'T' ? '#ffd23f' : '#fff', 'center', 4);
      }
      if (rageLit) txt(ctx, p.rage > 0 ? 'FREE' : 'HOLD', b.x, b.y + r * 0.62, Math.round(9 * sc), '#ffd0c0', 'center', 3); // (plain text: an outlined emoji on every lit button cost slow phones ~1 fps)
      if (cls.arms && p.wm) { const wk = { Q: 'G', E: 'A', R: 'H', ATK: p.wm.st }[b.id]; if (wk) circle(ctx, b.x, b.y, r - 1, null, wk === p.wm.st ? 3.5 : 2.5, STANCE_COL[wk]); } // Warrior: weapon colours
      if (cost != null) {
        const cx = b.x + r * 0.72, cy = b.y + r * 0.72;
        circle(ctx, cx, cy, 10 * sc, noRes ? '#ff5e5b' : '#2b2433', 2.5, INK);
        txt(ctx, String(cost), cx, cy + 1, Math.round(10 * sc), noRes ? '#fff' : cls.resColor, 'center', 0);
      }
      if (b.id === 'SP' || b.id === 'T') { const tl = b.id === 'T' ? 'ULTIMATE' : 'SPECIAL', ty = b.y - r - 9 * sc; rrect(ctx, b.x - 30 * sc, ty - 8 * sc, 60 * sc, 15 * sc, 5 * sc); ctx.fillStyle = b.id === 'T' ? '#ffd23f' : cls.color; ctx.fill(); txt(ctx, tl, b.x, ty, Math.round(9.5 * sc), INK, 'center', 0); label = ''; }
      if (b.id === 'DODGE') dodgePips(ctx, b.x, b.y, r, p, sc); // (dodge rework: the 3 charge pips)
      if (label) { txt(ctx, label, b.x - r * 0.7, b.y - r * 0.72, Math.round((label.length > 1 ? 9 : 12) * sc), lit ? '#ffd23f' : '#fff', 'center', 3); }
    }
    if (L.sprint) { const B = L.sprint, on = !!p.sprint, arm = !!tc.sprintOn; // the SPRINT toggle (left of the right-hand cluster): gold while sprinting, ringed while armed
      ctx.save(); ctx.globalAlpha = arm || on ? 1 : 0.6; circle(ctx, B.x, B.y, B.r, on ? '#ffd23f' : arm ? 'rgba(90,80,120,.9)' : 'rgba(58,50,82,.7)', 3, INK);
      if (arm && !on) circle(ctx, B.x, B.y, B.r - 4, null, 2, '#ffd23f');
      ctx.strokeStyle = on ? INK : '#fff'; ctx.lineWidth = 3 * sc; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const o of [-6, 4]) { ctx.beginPath(); ctx.moveTo(B.x + (o - 4) * sc, B.y - 7 * sc); ctx.lineTo(B.x + (o + 3) * sc, B.y); ctx.lineTo(B.x + (o - 4) * sc, B.y + 7 * sc); ctx.stroke(); }
      ctx.restore(); txt(ctx, on ? 'SPRINT' : arm ? 'calm…' : 'SPRINT', B.x, B.y + B.r + 9 * sc, Math.round(9 * sc), on ? '#ffd23f' : '#fff', 'center', 3); }
    // chain hint above the skill arc
    if (this.primed.length) {
      const five = (q) => { const ch = chainById(p.cls, q.id); return ch && ch.five; };
      const c = this.primed.find((q) => q.route) || this.primed.find((q) => five(q) && (q.next !== 'SP' || !(p.cds.SP > 0))) || this.primed.reduce((a, q) => (q.step > a.step ? q : a), this.primed[0]), chain = chainById(p.cls, c.id); // (chains v2: an ult route first, then a live 5-step (Special ready), else the deepest chain)
      const nxt = /^B(\d|S)$/.test(c.next) ? (c.next === 'BS' ? 'ATTACK (backstab)' : 'ATTACK') : c.next === 'F+' ? 'F' : c.next === 'SP' ? 'SPECIAL' : c.next;
      const atk = L.buttons[0];
      txt(ctx, `${c.rage ? '🔥 ' : ''}${chain ? chain.name : 'Chain'}: ${c.rage && c.str ? (p.rage > 0 ? 'tap' : 'tap on the beat / hold') : 'tap'} ${nxt}${c.then ? ` → ${c.then}` : ''}!`, atk.x - (w >= h ? 230 : 100) * sc, atk.y - atk.r - (w >= h ? 104 : 200) * sc, Math.round(13 * sc), '#ffd23f', 'center', 3.5);
    }
    // skill drag: cancel pad
    if (tc.skillDrag && tc.skillDrag.manual) {
      const c = L.cancel;
      circle(ctx, c.x, c.y, c.r, tc.skillDrag.overCancel ? 'rgba(255,80,80,.85)' : 'rgba(30,20,40,.6)', 3, INK);
      txt(ctx, '✕', c.x, c.y + 1, Math.round(c.r * 0.9), '#fff', 'center', 3);
      txt(ctx, 'drag here to cancel', c.x, c.y + c.r + 12 * sc, Math.round(11 * sc), '#fff', 'center', 3);
    }
  }

  /** World-space previews, drawn in screen space: auto-aim marker, skill area / direction, attack aim. */
  drawAim(ctx, r, p, info, time) {
    const z = r.cam.zoom;
    if (info.target && !p.dead) {
      const s = r.worldToScreen(info.target.x, info.target.y), rr = (info.target.r + 10) * z;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(time * 1.5);
      ctx.strokeStyle = info.manual ? 'rgba(255,255,255,.5)' : '#ffd23f'; ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, rr, i * Math.PI / 2 + 0.25, i * Math.PI / 2 + 1.2); ctx.stroke(); }
      ctx.restore();
    }
    const ps = r.worldToScreen(p.x, p.y);
    if (info.attackDir != null) {
      ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.setLineDash([10, 10]);
      ctx.beginPath(); ctx.moveTo(ps.x, ps.y); ctx.lineTo(ps.x + Math.cos(info.attackDir) * 140 * z, ps.y + Math.sin(info.attackDir) * 140 * z); ctx.stroke(); ctx.restore();
    }
    const sk = info.skill;
    if (sk && sk.point) {
      const a = SKILL_AIM[sk.id] || { mode: 'dir' };
      const t = r.worldToScreen(sk.point.x, sk.point.y);
      ctx.save(); ctx.globalAlpha = sk.cancel ? 0.3 : 0.8;
      if (a.mode === 'ground' || a.mode === 'move') {
        ctx.beginPath(); ctx.arc(ps.x, ps.y, a.range * z, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(t.x, t.y, Math.max(12, a.r * z), 0, TAU); ctx.fillStyle = 'rgba(255,210,63,.22)'; ctx.fill(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.stroke();
      } else if (a.mode === 'dir') {
        const ang = Math.atan2(sk.point.y - p.y, sk.point.x - p.x), L = Math.max(a.range || 200, 120) * z, wdt = Math.max(10, (a.r || 20) * 2 * z);
        ctx.translate(ps.x, ps.y); ctx.rotate(ang);
        ctx.fillStyle = 'rgba(255,210,63,.22)'; ctx.fillRect(0, -wdt / 2, L, wdt);
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.strokeRect(0, -wdt / 2, L, wdt);
      } else {
        ctx.beginPath(); ctx.arc(ps.x, ps.y, Math.max(20, (a.r || 40) * z), 0, TAU); ctx.fillStyle = 'rgba(255,210,63,.18)'; ctx.fill(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.stroke();
      }
      ctx.restore();
    }
  }
}
