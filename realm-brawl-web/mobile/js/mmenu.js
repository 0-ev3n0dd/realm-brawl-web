// Mobile hero list (solo only; no server calls). 2026-10-07: no hero creation / naming any more - the ten fixed
// heroes (sim/heroes.js) are listed, last played first; in game the hub's Heroes tab swaps between them.
import { CLASSES } from '../../js/sim/data/classes.js';
import { heroOf, heroList, heroFor } from '../../js/sim/heroes.js';
import { drawHeroThumb } from '../../js/client/art.js';
import { drawPortrait } from '../../js/client/heromodel.js';
import { isUnlocked, LOCKED_TEXT } from '../../js/sim/heroUnlock.js';
import { profile } from '../../js/client/rewards.js';
const heroOk = (cls) => { try { return isUnlocked(profile.load(), cls); } catch { return true; } };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export class MobileMenu {
  constructor({ store, onPlay, onSettings }) {
    this.store = store; this.onPlay = onPlay; this.active = false;
    $('menuSettings').onclick = () => onSettings();
    this.show();
  }
  renderSaves() {
    const list = heroList(this.store).sort((a, b) => (heroOk(b.cls) - heroOk(a.cls)) || ((b.cls === this.pick) - (a.cls === this.pick)) || (b.updatedAt || 0) - (a.updatedAt || 0) || (b.level | 0) - (a.level | 0)); // (unlocked first, the starter pick on top)
    const el = $('saveList'); el.innerHTML = '';
    for (const ch of list) {
      const H = heroOf(ch.cls), C = CLASSES[ch.cls], lk = !heroOk(ch.cls);
      const d = document.createElement('div'); d.className = 'save-card' + (lk ? ' locked' : ''); d.dataset.id = ch.id; d.dataset.cls = ch.cls;
      const cv = document.createElement('canvas'); cv.width = cv.height = 112;
      drawPortrait(cv, ch.cls, (k) => drawHeroThumb(k, ch.cls, ch.appearance));
      d.appendChild(cv);
      const info = document.createElement('div'); info.className = 'info';
      info.innerHTML = `${esc(H.name)} <span class="ttl" style="color:${C.color}">${esc(H.title)}</span><small>${lk ? `🔒 ${LOCKED_TEXT}` : `Lv ${ch.level} ${C.name} · ${esc(H.role)}`}</small>`;
      d.appendChild(info);
      const play = document.createElement('button'); play.className = 'btn small play'; play.textContent = lk ? '🔒' : 'Play'; play.disabled = lk; play.onclick = () => { if (!lk) this.onPlay(heroFor(this.store, ch.cls)); };
      d.appendChild(play);
      el.appendChild(d);
    }
  }
  hide() { this.active = false; $('menu').classList.add('hidden'); }
  show() { this.active = true; $('menu').classList.remove('hidden'); this.renderSaves(); }
}
