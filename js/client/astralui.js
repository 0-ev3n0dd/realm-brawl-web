// Part C: the client side of the Astral World. The Normal / Astral choice lives on the account (profile.astralOn) and is
// sent to the sim ({ type: 'astral', on, ok }); ok = an Ascended hero on this account (the unlock). The host's choice
// decides for the party when it leaves town (sim/hub.js startMission -> sim/astral.js setAstral).
import { profile } from './rewards.js';
import { ascendedCount } from '../sim/ascension.js';
import { ASTRAL } from '../sim/astral.js';

export const astralUnlocked = () => { try { return ascendedCount(profile.load()) >= 1; } catch { return false; } };
export const astralWanted = () => { try { return !!profile.load().astralOn && astralUnlocked(); } catch { return false; } };
export function setAstralWanted(g, on) { const pr = profile.load(); pr.astralOn = !!on; profile.save(); syncAstral(g, true); }
let last = null, lastT = 0;
/** keep the sim told (cheap: on change, else every 5 s) */
export function syncAstral(g, force = false) {
  if (!g || !g.command || !g.player) return;
  const ok = astralUnlocked(), on = ok && astralWanted(), sig = `${on}${ok}`, now = typeof performance !== 'undefined' ? performance.now() : 0;
  if (!force && sig === last && now - lastT < 5000) return;
  last = sig; lastT = now; g.command({ type: 'astral', on, ok });
}
/** is the world the local hero stands in Astral right now? (hubInfo().as) */
export const inAstral = (g) => { try { const I = g.hubInfo ? g.hubInfo() : null; return !!(I && I.as && I.m !== 'town'); } catch { return false; } };
/** the Realm Gate map's mode row */
export function astralRow(I) {
  const ok = astralUnlocked(), on = astralWanted(), guest = I && I.host === false;
  if (!ok) return '<div class="rm-astral locked">✦ <b>Astral</b> · locked: Ascend a hero at the Altar to unlock the Astral World (every map from Lv 50)</div>';
  if (guest) return `<div class="rm-astral">✦ Mode: <b>${I.as ? 'Astral' : 'Normal'}</b> <span class="dim">(the host decides)</span></div>`;
  return `<div class="rm-astral"><span>Mode</span><button class="btn small rm-mode${on ? '' : ' on'}" data-astral="0">Normal</button><button class="btn small rm-mode astral${on ? ' on' : ''}" data-astral="1">✦ Astral</button>
    <div class="dim">${on ? `Astral: Lv ${ASTRAL.map.haven}-${ASTRAL.map.rift + ASTRAL.step + ASTRAL.boss}, Astral bosses + mechanics, Astral materials. Applies when you travel.` : 'Normal difficulty.'}</div></div>`;
}
export const ASTRAL_CSS = `.rm-astral{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 8px;border-radius:10px;background:rgba(80,40,140,.35);border:2px solid #6b4ab8}
.rm-astral.locked{opacity:.75;font-size:12px}.rm-astral .dim{flex-basis:100%;font-size:11.5px}
.rm-astral .rm-mode{margin:0;font-size:14px;padding:4px 10px;opacity:.6}.rm-astral .rm-mode.on{opacity:1;box-shadow:0 0 0 2px #ffe27a}
.rm-astral .rm-mode.astral{background:linear-gradient(#8a5cff,#4a2a9a);color:#fff}`;
/** the Astral look over the world (cheap: one vignette + a few twinkles, drawn once a frame in screen space) */
export function drawAstralSky(ctx, w, h, t) {
  ctx.save(); const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(60,20,120,0.04)'); g.addColorStop(1, 'rgba(46,14,110,0.55)'); ctx.fillStyle = 'rgba(52,22,120,0.17)'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(40,10,90,0.08)'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 28; i++) { const x = ((i * 977) % 1000) / 1000 * w, y = ((i * 613 + 211) % 1000) / 1000 * h, k = 0.5 + 0.5 * Math.sin(t * (1.3 + (i % 5) * 0.4) + i); ctx.globalAlpha = 0.25 + 0.55 * k; ctx.fillStyle = i % 3 ? '#cfc0ff' : '#ffe9a8'; const r = 1 + k * 1.6; ctx.fillRect(x - r, y - 0.5, r * 2, 1); ctx.fillRect(x - 0.5, y - r, 1, r * 2); }
  ctx.restore();
}
