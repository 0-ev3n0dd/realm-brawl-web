// In-gameplay encounter cinematics (encounter revamp Part 0): the B3 Shadow Duel layer generalised for every boss fight. The fight NEVER
// pauses: the sim drives set pieces and cine moments (sim/setpiece.js) and this module frames them - letterbox bars, camera framing,
// banners + prompts, the set-piece visuals (the descending blade, the hold circle, the core link, the pressure meter) and music cues on the
// encounter's adaptive song (client/adaptivesong.js: a set piece asks for its `break`, a win for its `run`, a respite for a swell).
// Reads sim.sp / sim.cine (offline) or the netgame view's packed copies (co-op) - the same fields. Options > Reduce screen flashes softens flashes.
import { SETPIECE } from '../sim/setpiece.js';
import { vfxPref } from './fxns.js';
import { SONGS } from './chip/songs/index.js';
import { songFor } from './adaptivesong.js';
import { drawCarry, carryHud } from './carryfx.js';

export const ENC = { audio: null, song: null, cues: null, lb: 0, flash: 0, prompt: null, promptT: 0, last: null };
/** the encounter's song + which sections the moments ask for (encounters call this when they start; null = no song) */
export const DEFAULT_CUES = { setpiece: 'break', win: 'run', respite: 'break', transition: 'break' };
export function setEncounterSong(song, cues = DEFAULT_CUES) { ENC.song = song; ENC.cues = cues; }
const cue = (k) => { if (ENC.song && ENC.song.on && ENC.cues && ENC.cues[k]) ENC.song.go(ENC.cues[k]); };
const sfx = (n) => { if (ENC.audio && ENC.audio.play) ENC.audio.play(n); };
const prompt = (text, col = '#ffe27a', life = 2.4) => { ENC.prompt = { text, col, life }; ENC.promptT = 0; };
/** fx.handle routes 'setpiece' / 'cine' events here */
export function encCineEvent(ev, fx) {
  if (ev.type === 'setpiece' && ev.kind === 'carry') { // (Part 1: Neferakh's SUNBEARER)
    const P = { /* (start / win: the trial's own cards say it) */ catch: ['THE SUN IS CAUGHT · TO THE ALTAR', '#ffe27a', 2.4], crash: ['IT FELL · PICK IT UP', '#ffb070', 2.4], pass: ['PASSED', '#ffe27a', 1.2], pick: ['PICKED UP', '#ffe27a', 1.4],
      drop: ['DROPPED! · PICK IT UP', '#ff8a6a', 2], fail: ['THE SUN BURSTS', '#ff7a7a', 2.6] }[ev.ph];
    if (P) prompt(P[0], P[1], P[2]);
    if (ev.ph === 'start') sfx('cineCrack'); else if (ev.ph === 'win') { ENC.flash = 0.7; sfx('cineSting'); fx && fx.shake && fx.shake(0.8); } else if (ev.ph === 'fail' || ev.ph === 'crash') { ENC.flash = ev.ph === 'fail' ? 1 : 0.4; fx && fx.shake && fx.shake(ev.ph === 'fail' ? 1 : 0.5); } else if (ev.ph === 'catch' || ev.ph === 'pick') sfx('cineSting');
    if (ev.ph === 'lane') fx && fx.shake && fx.shake(0.15);
    if (ev.ph === 'win') cue('win'); else if (ev.ph === 'start') cue('setpiece');
    return true;
  }
  if (ev.type === 'setpiece') {
    if (ev.ph === 'start') { prompt('THE BLADE DESCENDS', '#bfe8ff', 2.2); sfx('cineCrack'); cue('setpiece'); }
    else if (ev.ph === 'hold') { prompt('HOLD THE BLADE · BREAK THE CORE', '#ffe27a', 3.2); sfx('cineSting'); fx && fx.shake && fx.shake(0.35); }
    else if (ev.ph === 'win') { prompt('THE BLADE SHATTERS', '#9fffc8', 2.4); ENC.flash = 0.6; sfx('cineSting'); fx && fx.shake && fx.shake(0.7); cue('win'); }
    else if (ev.ph === 'fail') { prompt('THE BLADE FALLS', '#ff7a7a', 2.6); ENC.flash = 1; fx && fx.shake && fx.shake(1); }
    return true;
  }
  if (ev.type === 'trial' && ev.ph === 'eclbeat') { // (Savage v2: THE ECLIPSE ASCENDANT, beat by beat - the trial view draws it, this is the hits)
    const n = ev.short ? [0, 5, 7, 8][ev.n - 1] || 8 : ev.n, F = [0, 0.9, 0.4, 0.5, 0.6, 0.3, 0.8, 0.2, 0.6][n] || 0, S = [0, 1, 0.5, 0.6, 0.8, 0.3, 0.9, 1, 0.3][n] || 0;
    ENC.flash = Math.max(ENC.flash, F); if (S) fx && fx.shake && fx.shake(S); sfx(n === 1 || n === 7 ? 'cineSting' : 'cineCrack');
    return true;
  }
  if (ev.type === 'cine' && ev.stage === 'eclipse') return true; // (its beats carry the sound)
  if (ev.type === 'cine') {
    if (ev.ph === 'start' && ev.stage === 'verdict') { sfx('cineCrack'); ENC.flash = 0.7; fx && fx.shake && fx.shake(0.6); return true; } // (Part 1S: the Savage's final-phase cinematic - the trial's card names it)
    if (ev.ph === 'mid' && ev.stage === 'verdict') { sfx('cineSting'); ENC.flash = 0.5; fx && fx.shake && fx.shake(0.8); return true; }
    if (ev.ph === 'start' && (ev.stage === 'night' || ev.stage === 'blacksun')) { sfx('cineCrack'); return true; } // (Part 1: Neferakh's transitions - the trial's card names them)
    if (ev.ph === 'start') { if (ev.kind === 'respite') { prompt('A MOMENT OF CALM', '#cfe6ff', 2.2); cue('respite'); } else if (ev.kind === 'transition') { prompt('THE STAGE SHIFTS', '#ffd9a0', 2); cue('transition'); sfx('cineCrack'); } }
    if (ev.ph === 'mid' && ev.kind === 'transition') { ENC.flash = 0.5; fx && fx.shake && fx.shake(0.5); }
    return true;
  }
  return false;
}
const active = (sim) => ENC.hold || (sim && sim.sp && sim.sp.length) || (sim && sim.cine && sim.cine.length); // (ENC.hold: an encounter's own intro holds the letterbox, client/neferakhsong.js)
/** once a frame (render.js): letterbox ease, song tick, prompt timer */
export function encCineTick(dt, sim) {
  const want = active(sim) ? 1 : 0; ENC.lb += (want - ENC.lb) * Math.min(1, dt * (want ? 3 : 2)); if (ENC.lb < 0.002) ENC.lb = 0;
  if (ENC.song) ENC.song.tick(); if (ENC.demo && ENC.demo !== ENC.song) ENC.demo.tick(); if (ENC.flash > 0) ENC.flash = Math.max(0, ENC.flash - dt * 1.6);
  if (ENC.prompt) { ENC.promptT += dt; if (ENC.promptT > ENC.prompt.life) ENC.prompt = null; }
}
/** camera override (render.js): frame the set piece (hold circle + core), follow a repositioning boss, pull out on a transition */
export function encCamera(sim, local) {
  if (!active(sim)) return null;
  if (ENC.hold && ENC.holdCam) return ENC.holdCam;
  const sp = sim.sp && sim.sp[0];
  if (sp && sp.kind === 'carry') { const b = sp.bearer && sim.players && sim.players.get(sp.bearer), sx = b ? b.x : sp.sx ?? sp.x, sy = b ? b.y : sp.sy ?? sp.y, lx = local ? local.x : sx, ly = local ? local.y : sy; return { x: (sx + sp.gx + lx) / 3, y: (sy + sp.gy + ly) / 3 - 20, z: 0.8, k: 0.45 }; } // (frames the sun, the altar and you)
  if (sp) { const lx = local ? local.x : sp.x, ly = local ? local.y : sp.y; return { x: (sp.x + sp.cx + lx) / 3, y: (sp.y + sp.cy + ly) / 3 - 30, z: 0.86, k: 0.08 }; }
  const c = sim.cine[0];
  if (c.kind === 'reposition') { const b = sim.enemies && sim.enemies.find((e) => e.id === c.bid); return b ? { x: b.x, y: b.y, z: 0.82, k: 0.1 } : null; }
  if (c.kind === 'transition') { const k = Math.sin(Math.PI * Math.min(1, c.t / c.dur)); return { x: c.x, y: c.y, z: 1 - 0.25 * k, k: 0.06 }; }
  if (c.kind === 'respite' && local) return { x: local.x, y: local.y - 20, z: 1.06, k: 0.05 };
  return null;
}
/** world-space visuals (render.js, over the floor) */
export function drawEncOver(ctx, sim, local, time) {
  if (!sim || !sim.sp) return;
  for (const sp of sim.sp) {
    const S = SETPIECE[sp.kind]; if (!S) continue;
    if (sp.kind === 'carry') { drawCarry(ctx, sp, sim, local, time); continue; }
    const tell = sp.ph === 'tell', k = tell ? Math.min(1, sp.t / S.tell) : 1, press = sp.press || 0;
    ctx.save();
    // the hold circle: gold when braced, a red pulse when nobody holds it
    const held = sp.held && !tell, pulse = 0.5 + 0.5 * Math.sin(time * (held ? 4 : 10));
    ctx.globalAlpha = tell ? 0.25 + 0.35 * k : 0.35 + 0.2 * pulse; ctx.fillStyle = held ? '#ffd23f' : '#ff5a4a';
    ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.holdR, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.95; ctx.lineWidth = 5; ctx.strokeStyle = held ? '#fff2a8' : '#ffb0a0'; ctx.setLineDash(tell ? [14, 10] : []); ctx.lineDashOffset = -time * 40;
    ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.holdR, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (!tell) { ctx.lineWidth = 8; ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.holdR + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * press); ctx.stroke(); }
    // the core link: a dashed beam from the hilt to the core
    ctx.globalAlpha = 0.55 + 0.25 * pulse; ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 3; ctx.setLineDash([10, 12]); ctx.lineDashOffset = time * 60;
    ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(sp.cx, sp.cy); ctx.stroke(); ctx.setLineDash([]);
    if (tell) { ctx.globalAlpha = 0.4 + 0.4 * k; ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(sp.cx, sp.cy, S.coreR + 10, 0, Math.PI * 2); ctx.stroke(); }
    // the blade: falls during the tell, then hangs over the circle and sinks as the pressure builds
    const top = sp.y - 520 + 380 * k * k, tip = tell ? top + 300 : sp.y - 150 + 150 * press, len = 320, w = 46;
    ctx.globalAlpha = 0.28 + 0.3 * k; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(sp.x, sp.y + 6, 26 + 40 * k, 9 + 12 * k, 0, 0, Math.PI * 2); ctx.fill(); // (its shadow)
    ctx.globalAlpha = 1; ctx.translate(sp.x, tip);
    const gr = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, '#9fb6d6'); gr.addColorStop(0.5, '#f4fbff'); gr.addColorStop(1, '#7f95b8');
    ctx.fillStyle = gr; ctx.strokeStyle = '#1a1f33'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-w / 2, -60); ctx.lineTo(-w / 2, -len); ctx.lineTo(w / 2, -len); ctx.lineTo(w / 2, -60); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(-w * 1.6, -len - 18, w * 3.2, 18); ctx.strokeRect(-w * 1.6, -len - 18, w * 3.2, 18); // (crossguard)
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(-10, -len - 90, 20, 72); ctx.strokeRect(-10, -len - 90, 20, 72);
    ctx.fillStyle = '#9fe8ff'; ctx.beginPath(); ctx.arc(0, -len - 100, 14 + 3 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (!tell && press > 0.6) { ctx.globalAlpha = (press - 0.6) * 2 * pulse; ctx.strokeStyle = '#ff6a5a'; ctx.lineWidth = 6; ctx.strokeRect(-w / 2 - 6, -len - 6, w + 12, len); }
    ctx.restore();
  }
}
/** screen-space HUD (hud.js): letterbox, pressure meter, the prompt, flashes */
export function drawEncHud(ctx, w, h, sim, local) {
  const reduceFlash = vfxPref.reduceFlash;
  if (ENC.lb > 0) { const bh = Math.round(h * 0.075 * ENC.lb); ctx.save(); ctx.fillStyle = '#05060c'; ctx.globalAlpha = 0.92; ctx.fillRect(0, 0, w, bh); ctx.fillRect(0, h - bh, w, bh); ctx.restore(); }
  const sp = sim && sim.sp && sim.sp[0];
  if (sp && sp.kind === 'carry') carryHud(ctx, w, Math.round(h * 0.075 * ENC.lb), sp, sim, local, h);
  else if (sp && sp.ph !== 'tell') {
    const bw = Math.min(520, w * 0.42), x = (w - bw) / 2, y = Math.round(h * 0.075 * ENC.lb) + 46;
    ctx.save(); ctx.fillStyle = 'rgba(10,12,24,.82)'; ctx.fillRect(x - 4, y - 4, bw + 8, 26);
    const gr = ctx.createLinearGradient(x, 0, x + bw, 0); gr.addColorStop(0, '#ffd23f'); gr.addColorStop(1, '#ff4a3a'); ctx.fillStyle = gr; ctx.fillRect(x, y, bw * (sp.press || 0), 18);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x, y, bw, 18);
    ctx.font = "16px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText(sp.held ? 'BLADE BRACED' : 'NOBODY HOLDS THE BLADE!', w / 2, y + 40); ctx.restore();
  }
  if (ENC.prompt) {
    const P = ENC.prompt, a = Math.min(1, ENC.promptT * 5, (P.life - ENC.promptT) * 3);
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.font = "34px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.lineWidth = 7; ctx.strokeStyle = '#0b0d18';
    const y = h * 0.28, tw = ctx.measureText(P.text).width; // (a dark plate: legible over skill callouts / damage numbers)
    ctx.fillStyle = 'rgba(8,10,22,0.62)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(w / 2 - tw / 2 - 26, y - 34, tw + 52, 46, 12); else ctx.rect(w / 2 - tw / 2 - 26, y - 34, tw + 52, 46); ctx.fill();
    ctx.strokeText(P.text, w / 2, y); ctx.fillStyle = P.col; ctx.fillText(P.text, w / 2, y); ctx.restore();
  }
  if (ENC.flash > 0) { ctx.save(); ctx.globalAlpha = ENC.flash * (reduceFlash ? 0.25 : 0.6); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.restore(); }
}

/** console helper for composers (docs/CHIP-SONGS.md): rbSong('proving') plays a song, rbSong('proving', 'break') starts at a section,
 *  rbSong('proving', null, 'run') asks a playing song for a section, rbSong() stops. Returns the song's section map. */
export function rbSong(id, section, go) {
  if (!id) { if (ENC.demo) ENC.demo.stop(0.6); ENC.demo = null; return null; }
  const S = SONGS[id]; if (!S || !ENC.audio) return null; const song = songFor(S);
  if (go) { song.go(go); return song.map; }
  if (ENC.demo && ENC.demo !== song) ENC.demo.stop(0.3);
  song.start(ENC.audio, section || undefined); ENC.demo = song; if (!ENC.song || ENC.song === ENC.demoWas) setEncounterSong(song); ENC.demoWas = song; return song.map;
}
if (typeof window !== 'undefined') { window.rbSong = rbSong; window.__rbEnc = ENC; }
