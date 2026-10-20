// Travel to Town (World Map › Realm Gate: the Brightwater Village flag + Travel): a 2 s channel from any open-world map back to Brightwater
// Village. The sim (sim/hub.js townTravelBlock / townChannel) is the authority: it refuses mid-mission / dungeon / trial /
// boss fight and cancels on movement or a hit; this file only pre-checks for the button state and draws the cast bar.
import { OPEN_MAPS, TOWN_CH } from '../sim/hub.js';
import { inTownArea, TOWN_NAME } from '../sim/townconst.js';
import { inTombArea } from '../sim/dunesconst.js';
import { inCryptArea } from '../sim/frostconst.js';
import { inHollowArea, inTorArea } from '../sim/glowconst.js';
import { inForgeArea } from '../sim/emberconst.js';
import { inTrialArea } from '../sim/trialconst.js';
import { inOpsArea } from '../sim/opsconst.js';
import { inRaidArea } from '../sim/constants.js';
import { inAstArea } from '../sim/astraelconst.js';

/** client pre-check: '' = the button is live (the boss-fight rule is the sim's: it answers with a reason) */
export function clientTownBlock(game) {
  const p = game && game.player, I = game && game.hubInfo ? game.hubInfo() : null;
  if (!p || !I) return 'Not available here';
  if (p.dead) return 'You are down';
  if (I.m === 'town' && inTownArea(p.x, p.y)) return 'You are already in town';
  if (!OPEN_MAPS.has(I.m)) return 'Not during a mission or trial';
  if (inTombArea(p.x, p.y) || inCryptArea(p.x, p.y) || inForgeArea(p.x, p.y) || inRaidArea(p.x, p.y) || inAstArea(p.x, p.y) || inTrialArea(p.x, p.y) || inOpsArea(p.x, p.y) || inHollowArea(p.x, p.y) || inTorArea(p.x, p.y)) return 'Not inside a dungeon or trial';
  return '';
}
/** the label: co-op host brings the party, a guest goes alone */
export function townLabel(game) {
  const I = game && game.hubInfo ? game.hubInfo() : {};
  return I.host === false ? 'Travel to Town (just you)' : I.coop ? 'Travel to Town (whole party)' : 'Travel to Town';
}
/** in a mission / trial / dungeon: the old Return to Town (abandon) is the way out */
export function inMission(game) { const I = game && game.hubInfo ? game.hubInfo() : null; return !!(I && !OPEN_MAPS.has(I.m)); }
export function startTownTravel(game) {
  const why = clientTownBlock(game);
  if (why) { castNote(game, why); return false; }
  if (game.menuHub && game.menuHub.isOpen()) game.menuHub.close();
  if (game.onMenuChange) game.onMenuChange();
  game.command({ type: 'townGo' });
  return true;
}
function castNote(game, msg) { const p = game && game.player; if (game && game.fx && p) game.fx.text(p.x, p.y - 74, msg, { size: 16, color: '#ffe9a0', vy: -30, life: 1.8, pop: 1.2 }); }

const CSS = `#townCast{position:fixed;left:50%;bottom:21%;transform:translateX(-50%);z-index:35;pointer-events:none;min-width:260px;text-align:center;font:15px 'Lilita One',sans-serif;color:#fff;text-shadow:0 2px 0 #2b2433}
#townCast.hidden{display:none}#townCast .tc-bar{margin-top:6px;height:12px;border:3px solid #2b2433;border-radius:8px;background:rgba(43,36,51,.75);overflow:hidden;box-shadow:0 0 18px rgba(159,224,255,.55)}
#townCast .tc-fill{height:100%;width:0;background:linear-gradient(90deg,#9fe0ff,#fff4c0,#ffd23f)}#townCast small{display:block;font-size:11px;color:#cfe;opacity:.85}`;
/** the cast bar (one per page) + the event hook (townui.onEvent forwards { type:'hub', ph:'tch' }) */
export class TownCast {
  constructor(game) {
    this.g = game; this.el = null;
    if (typeof document === 'undefined') return;
    if (!document.getElementById('towncast-css')) { const st = document.createElement('style'); st.id = 'towncast-css'; st.textContent = CSS; document.head.appendChild(st); }
    const el = this.el = document.createElement('div'); el.id = 'townCast'; el.className = 'hidden';
    el.innerHTML = `🏠 Travelling to ${TOWN_NAME}…<div class="tc-bar"><div class="tc-fill"></div></div><small>hold still · moving or a hit cancels</small>`;
    document.body.appendChild(el);
  }
  get on() { return !!(this.el && !this.el.classList.contains('hidden')); }
  onEvent(ev) {
    const g = this.g, p = g.player;
    if (ev.s === 'go') {
      if (!this.el) return;
      const f = this.el.querySelector('.tc-fill'); this.el.classList.remove('hidden');
      f.style.transition = 'none'; f.style.width = '0%'; void f.offsetWidth; f.style.transition = `width ${(ev.t || TOWN_CH) / 60}s linear`; f.style.width = '100%';
      if (g.fx && p) { g.fx.ring(p.x, p.y, 70, '#9fe0ff', 0.6, 6); g.fx.sparks(p.x, p.y - 30, -Math.PI / 2, 14, '#fff4c0', 260, 1.2); }
      if (g.audio && g.audio.play) try { g.audio.play('click'); } catch { /* */ }
    } else {
      if (this.el) this.el.classList.add('hidden');
      if (ev.s === 'cancel' || ev.s === 'no') castNote(g, ev.s === 'no' ? `Can't travel: ${ev.why}` : `Travel cancelled: ${ev.why}`);
      else if (ev.s === 'done' && g.fx && p) { g.fx.ring(ev.x, ev.y, 120, '#9fe0ff', 0.6, 10); g.fx.puffs(ev.x, ev.y, 14, '#e8f8ff', 14, 160, 0.7); }
    }
  }
  destroy() { if (this.el) this.el.remove(); this.el = null; }
}
