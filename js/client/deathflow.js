// Death and respawn flow (experience pass 1). When you fall in the open world (the Wilds, the Dunes) the death screen
// fades in over a desaturated, muffled world with what happened (who got you, how the outing went; death never costs items) and
// two choices: Respawn at the checkpoint (the campfire / zone entrance; Space) or Return to the village (H). The sim
// command 'respawn' carries the choice (sim/player.js); the choice unlocks after 1.2 s and with no pick the checkpoint is
// automatic after 8 s. Raids / trials / the Tomb keep their own revive rules (just the timer, no buttons).
// Shared by the desktop (client/game.js, client/netgame.js) and the phone (mobile/js/mgame.js) games.
// Part E (docs/ASCENSION-PLAN.md): the death recap: who / what hit you last. Every 'hurt' event of the local hero (sim/combat.js
// damagePlayer: by = the enemy or the mechanic, e.g. "Skaldra's Coil Lunge", pct = % of max HP) goes into a short ring
// buffer; on death a panel lists the last 5 hits (newest first, seconds before the fall, % HP). Its own panel (not inside
// #death), so it also shows over the trial / Astrael wipe screens and in practice runs.
export const RECAP = { keep: 12, show: 5, window: 20 };
/** the last n hits before `now` (ms), newest first: { by, pct, amount, ago (s) } */
export function recapOf(buf, now, n = RECAP.show, win = RECAP.window) {
  return buf.filter((h) => now - h.at <= win * 1000 && h.at <= now + 1).slice(-n).reverse().map((h) => ({ by: h.by, pct: h.pct, amount: h.amount, ev: h.ev ? 1 : 0, ago: Math.max(0, (now - h.at) / 1000) }));
}
const escH = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const firstHit = (list) => list.findIndex((h) => !h.ev);
const nEv = (l) => l.filter((h) => h.ev).length; // evaded entries are listed but are not "hits taken"
export function recapHtml(list) {
  if (!list.length) return '';
  return `<div class="dr-t">DEATH RECAP <span>your last ${list.length - nEv(list)} hit${list.length - nEv(list) === 1 ? '' : 's'} taken${nEv(list) ? ` + ${nEv(list)} evaded` : ''} (% of max HP)</span></div>` + list.map((h, i) => h.ev ? `<div class="dr-r evd"><b>Evaded: ${escH(h.by || 'a hit')}</b><i style="--w:0%"></i><span>0%</span><em>${h.ago.toFixed(1)} s before</em></div>` : `<div class="dr-r${i === firstHit(list) ? ' kill' : ''}"><b>${escH(h.by || 'An unseen hit')}</b><i style="--w:${Math.min(100, h.pct | 0)}%"></i><span>${h.pct | 0}%</span><em>${i === firstHit(list) ? 'killing blow' : h.ago.toFixed(1) + ' s before'}</em></div>`).join('');
}
const DR_CSS = `#deathRecap { position: fixed; left: 50%; bottom: 150px; transform: translateX(-50%); width: min(440px, 46vw); z-index: 46; background: rgba(24,14,22,.9); border: 2px solid #ff5e5b; border-radius: 12px; padding: 7px 10px 8px; color: #fff; font-family: inherit; pointer-events: none; box-shadow: 0 0 18px rgba(255,94,91,.25); animation: drIn .35s ease-out; }
#deathRecap.hidden { display: none; } @keyframes drIn { from { opacity: 0; transform: translate(-50%, 12px); } }
#deathRecap .dr-t { font-size: 13px; letter-spacing: .08em; color: #ff8e8b; margin-bottom: 4px; } #deathRecap .dr-t span { color: #cfc6e6; letter-spacing: 0; font-size: 12px; margin-left: 6px; }
#deathRecap .dr-r { display: grid; grid-template-columns: 1fr 70px 38px 92px; gap: 6px; align-items: center; font-size: 13px; padding: 2px 0; }
#deathRecap .dr-r b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: normal; } #deathRecap .dr-r.kill b { color: #ffd23f; } #deathRecap .dr-r.evd b { color: #ffe27a; font-style: italic; } #deathRecap .dr-r.evd span { color: #ffe27a; }
#deathRecap .dr-r i { height: 7px; border-radius: 4px; background: linear-gradient(90deg, #ff5e5b var(--w), rgba(255,255,255,.12) var(--w)); }
#deathRecap .dr-r span { text-align: right; color: #ff8e8b; } #deathRecap .dr-r em { font-style: normal; font-size: 12px; color: #a99fc4; text-align: right; }
.rb-touch #deathRecap, body.mobile #deathRecap { bottom: 12px; width: min(380px, 44vw); padding: 5px 8px 6px; } .rb-touch #deathRecap .dr-r { grid-template-columns: 1fr 44px 34px 74px; font-size: 12px; }`;
const $ = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);
const ZONE = (p) => (p.x > 9000 ? 'the Sunscorch Dunes' : 'the Wilds');
export class DeathFlow {
  constructor(game) {
    this.g = game; this.kills = 0; this.since = performance.now(); this.wasDead = false; this.hits = [];
    if (typeof document !== 'undefined' && document.body) {
      if (!document.getElementById('deathRecap-css')) { const st = document.createElement('style'); st.id = 'deathRecap-css'; st.textContent = DR_CSS; document.head.appendChild(st); }
      this.recap = document.getElementById('deathRecap') || Object.assign(document.createElement('div'), { id: 'deathRecap', className: 'hidden' }); document.body.appendChild(this.recap);
    }
    const box = $('death') && $('death').querySelector('.death-box');
    if (!box) return;
    let s = $('deathStats'); if (!s) { s = document.createElement('p'); s.id = 'deathStats'; s.className = 'death-stats'; box.insertBefore(s, $('deathTimer')); }
    let b = $('deathBtns');
    if (!b) {
      b = document.createElement('div'); b.id = 'deathBtns'; b.className = 'death-btns';
      b.innerHTML = '<button class="btn" id="deathHere">Respawn at checkpoint <kbd>Space</kbd></button><button class="btn ghost" id="deathTown">Return to village <kbd>H</kbd></button>';
      box.appendChild(b);
    }
    this.btns = b; this.stats = s;
    $('deathHere').onclick = () => this.pick('here');
    $('deathTown').onclick = () => this.pick('town');
    this.onKey = (e) => {
      const p = this.g.player; if (!p || !p.dead || !p.canChoose) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); this.pick('here'); }
      else if (e.code === 'KeyH') { e.preventDefault(); e.stopImmediatePropagation(); this.pick('town'); }
    };
    addEventListener('keydown', this.onKey, { capture: true });
  }
  pick(where) {
    const p = this.g.player; if (!p || !p.dead || !this.ready()) return;
    this.g.command({ type: 'respawn', where }); this.picked = where;
  }
  tick() { return this.g.deathTick ? this.g.deathTick() : this.g.sim ? this.g.sim.tick : 0; }
  ready() { const p = this.g.player; return !!(p && p.canChoose && this.tick() >= (p.respawnMin || 0)); }
  /** game events: count the outing's kills, reset on a new mission / back in town */
  onEvent(ev) {
    const p = this.g.player; if (!p) return;
    if (ev.type === 'evaded' && ev.pid === p.id && !ev.shove) { this.hits.push({ by: ev.by || 'a hit', pct: 0, amount: 0, at: performance.now(), ev: 1 }); if (this.hits.length > RECAP.keep) this.hits.shift(); return; } // (dodge rework: an 'Evaded' line)
    if (ev.type === 'savage' && ev.ph === 'vuln' && ev.pid === p.id) { this.hits.push({ by: ev.n >= 2 ? `KO: a 2nd Vuln stack - ${ev.by || 'a failed solve'}` : `Vuln stack (+25% damage taken, 30 s) - ${ev.by || 'a failed solve'}`, pct: 0, amount: 0, at: performance.now(), vuln: ev.n }); if (this.hits.length > RECAP.keep) this.hits.shift(); return; } // (Part 1S: the Savage fail model in the recap)
    if (ev.type === 'hurt' && ev.pid === p.id && ev.amount > 0) { this.hits.push({ by: ev.by || '', pct: ev.pct | 0, amount: ev.amount | 0, at: performance.now() }); if (this.hits.length > RECAP.keep) this.hits.shift(); return; }
    if (ev.type === 'death' && ev.killer === p.id) this.kills++;
    if (ev.type === 'hub' && (ev.ph === 'mission' || ev.ph === 'town') && (!ev.pid || ev.pid === p.id)) { this.kills = 0; this.since = performance.now(); }
  }
  /** the recap panel: built once at the fall, hidden when you're back up */
  syncRecap(dead) {
    if (dead === this.recapDead) return; this.recapDead = dead;
    if (dead) { this.last = recapOf(this.hits, performance.now()); if (this.recap) { this.recap.innerHTML = recapHtml(this.last); this.recap.classList.toggle('hidden', !this.last.length); } }
    else { this.hits = []; if (this.recap) this.recap.classList.add('hidden'); }
  }
  update() {
    const p = this.g.player; if (!p) return;
    this.syncRecap(!!p.dead);
    if (!this.btns) return;
    const dead = !!p.dead;
    if (dead !== this.wasDead) {
      this.wasDead = dead;
      if (typeof document !== 'undefined' && document.body) document.body.classList.toggle('rb-dead', dead); // (CSS: the world desaturates)
      if (dead) {
        this.picked = null;
        const m = Math.floor((performance.now() - this.since) / 60000), sec = Math.floor(((performance.now() - this.since) / 1000) % 60);
        this.stats.textContent = p.canChoose ? `You fell in ${ZONE(p)} after ${m}:${String(sec).padStart(2, '0')} · ${this.kills} ${this.kills === 1 ? 'enemy' : 'enemies'} defeated this outing` : '';
      } else { this.kills = 0; this.since = performance.now(); }
    }
    const show = dead && !!p.canChoose;
    this.btns.classList.toggle('hidden', !show);
    if (show) {
      const ok = this.ready() && !this.picked;
      for (const b of this.btns.querySelectorAll('button')) b.disabled = !ok;
      const t = $('deathTimer'); const secs = Math.max(0, ((p.respawnAt || 0) - this.tick()) / 60);
      if (t) t.textContent = this.picked ? (this.picked === 'town' ? 'Heading home…' : 'Back on your feet…') : `Auto-respawn at the checkpoint in ${secs.toFixed(0)}s`;
    }
  }
  destroy() { if (this.recap) this.recap.remove(); if (this.onKey) removeEventListener('keydown', this.onKey, { capture: true }); if (typeof document !== 'undefined' && document.body) document.body.classList.remove('rb-dead'); }
}
