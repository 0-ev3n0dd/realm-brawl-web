// Experience pass 4: the story chain, client side (solo Game + co-op NetGame).
//   * talk(npc, after): the story dialogue an NPC has pending (chapter intro, turn-in, Borin / Dorrik news), typed out
//     line by line in a bottom panel with portraits; Space / Enter / click = next (or finish the line), Esc / Skip = skip
//     the rest. A turn-in pays the chapter reward and shows the "chapter complete" card (rewards + unlocks), then `after`.
//   * markFor(station): '!' / '★' marks over NPC heads and on the minimap (villagefx.setNpcMarks)
//   * the objective tracker (top centre) and the reward-screen note when a clear completes a chapter's objective
// Rules + data: sim/story.js. Progress: profile.story (rewards.js).
import { NPCS, CHAPTERS, UNLOCKS, IDLE, pendingFor, claim, current, status, allDone } from '../sim/story.js';
import { MATERIALS, accountLevel } from '../sim/meta.js';
import { drawHero, drawHeroThumb } from './art.js';
import { profile } from './rewards.js';
import { loadUnlocks } from './townui.js';
import { setNpcMarks } from './villagefx.js';
import { inOpsArea } from '../sim/opsconst.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NEWS = {
  pat_wild: ['smith', "The Wildwarden pattern's pinned over my bench. Craft tab, whenever you've got the Greenwood."],
  pat_dune: ['smith', 'Sunglass gear and the Duneborn set are on the Craft list now. Mind the edges, they bite.'],
  pat_tomb: ['smith', "Royal Tomb gear: tier five. Linen, an ember, some chitin. It's the best work I've ever done."],
  pat_rift: ['smith', 'Riftforged gear is ready to make. Two rift cores a piece; the anvil hums all night.'],
  pat_star: ['smith', "Starforged. Every piece comes out Legendary or I melt it down myself."],
  shop2: ['qm', 'Elixirs of Fortune are in! More gold, more materials, ten whole minutes. Very reasonable.'],
  shop3: ['qm', "Scholar's Tonics, straight off the caravans. Drink one before a big run and learn faster."],
  shop4: ['qm', 'Greater Health Potions. Seventy percent of a hero, in a bottle. Your H key picks one when you are hurting.'],
};
const STATION_NPC = { hana: 'hana', smith: 'smith', qm: 'qm', elder: 'elder' };

export class Story {
  constructor(game) {
    this.g = game; this.lines = null; this.i = 0; this.shown = 0; this.after = null; this.onEnd = null; this.idle = {}; this._mk = { t: -1, m: {} };
    setNpcMarks((id) => this.markFor(id));
    if (typeof document === 'undefined') return;
    const mk = (id, cls) => { let d = document.getElementById(id); if (!d) { d = document.createElement('div'); d.id = id; d.className = cls; document.body.appendChild(d); } return d; };
    this.box = mk('dialogue', 'dlg hidden');
    this.card = mk('storyCard', 'overlay hidden');
    this.tracker = mk('questTracker', 'qt hidden');
    this.tracker.addEventListener('click', () => { if (this.g.menuHub) this.g.menuHub.open('collection', 'journal'); else if (this.g.progress) this.g.progress.open('journal'); }); // (UI pass: the hub's Collection › Journal, like P / L)
    this.box.addEventListener('click', (e) => { if (e.target.closest('#dlgSkip')) { e.stopPropagation(); this.skip(); } else this.next(); });
    this.onKey = (e) => {
      if (this.cardOpen()) { if (e.code === 'Enter' || e.code === 'Escape' || e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); this.closeCard(); } return; }
      if (!this.dlgOpen()) { if (performance.now() < (this.guard || 0) && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyX')) { e.preventDefault(); e.stopImmediatePropagation(); } return; } // (mashing through the text never leaks into the panel that opens next)
      if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.skip(); return; }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyX' || e.code === 'KeyE') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) this.next(); return; }
      e.stopImmediatePropagation(); // (no attacks / dodges while someone is talking)
    };
    addEventListener('keydown', this.onKey, { capture: true });
  }
  get pr() { return profile.load(); }
  legacy() { try { return loadUnlocks(); } catch { return {}; } }
  dlgOpen() { return !!(this.box && !this.box.classList.contains('hidden')); }
  cardOpen() { return !!(this.card && !this.card.classList.contains('hidden')); }
  isOpen() { return this.dlgOpen() || this.cardOpen(); }
  /** '' | 'new' | 'ready' for a station / NPC id (cached for a few frames: it is asked for every NPC every frame) */
  markFor(id) {
    const npc = STATION_NPC[id]; if (!npc) return '';
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (now - this._mk.t > 400) { const L = this.legacy(), m = {}; for (const n of Object.keys(STATION_NPC)) { const p = pendingFor(this.pr, n, L); m[n] = !p ? '' : p.kind === 'turnin' ? 'ready' : 'new'; } this._mk = { t: now, m }; }
    return this._mk.m[npc] || '';
  }
  /** start what `npc` has to say; false if nothing (unless force: then small talk + a hint). after() runs when it is over. */
  talk(npc, after = null, force = false) {
    if (this.isOpen()) return true;
    const pr = this.pr, L = this.legacy(), p = pendingFor(pr, npc, L);
    if (!p && !force) return false;
    let lines, onEnd;
    if (!p) {
      const pool = IDLE[npc] || ['…']; this.idle[npc] = ((this.idle[npc] | 0) + 1) % pool.length;
      lines = [[npc, pool[this.idle[npc]]]];
      const c = current(pr.story);
      if (npc === 'elder' && c && c.giver !== 'elder') lines.push(['elder', `${NPCS[c.giver].name} is waiting for you${c.giver === 'hana' ? ' at the Mission Counter' : c.giver === 'qm' ? ' by the market stalls' : ' at the forge'}. Chapter ${c.n}: ${c.title}.`]);
      else if (npc === 'elder' && !c) lines.push(['elder', 'The chain is complete, Starbreaker. Replay any mission for better ranks and rarer loot.']);
      else if (c && npc === 'elder') lines.push(['elder', `Your task: ${c.goal}.`]);
    } else if (p.kind === 'intro') { lines = p.ch.intro; onEnd = () => { pr.story.seen[p.ch.id] = 1; profile.save(); }; }
    else if (p.kind === 'news') { lines = p.unlocks.map((u) => NEWS[u]); onEnd = () => { for (const u of p.unlocks) pr.story.news[u] = 1; profile.save(); }; }
    else { const then = after; lines = p.ch.outro; onEnd = () => this.turnIn(p.ch, then); after = null; } // (the card runs `after` when it closes)
    this.play(lines, () => { this._mk.t = -1; if (onEnd) onEnd(); }, after);
    return true;
  }
  play(lines, onEnd, after) {
    this.lines = lines; this.i = 0; this.onEnd = onEnd; this.after = after; this.t0 = performance.now();
    if (this.g.audio) this.g.audio.play('click');
    this.box.classList.remove('hidden'); this.renderLine();
    cancelAnimationFrame(this._raf); const tick = () => { if (!this.dlgOpen()) return; this.type(); this._raf = requestAnimationFrame(tick); }; this._raf = requestAnimationFrame(tick);
  }
  renderLine() {
    const [who, text] = this.lines[this.i], N = NPCS[who] || NPCS.hana, p = this.g.player;
    const name = who === 'you' ? (this.g.heroName ? this.g.heroName() : (p && p.name) || 'You') : N.name;
    this.box.innerHTML = `<div class="dlg-in ${who === 'you' ? 'me' : ''}"><canvas class="dlg-face" width="112" height="112"></canvas>
      <div class="dlg-txt"><div class="dlg-who"><b>${esc(name)}</b><small>${esc(who === 'you' ? 'You' : N.title)}</small><span class="dlg-n">${this.i + 1} / ${this.lines.length}</span></div>
      <p class="dlg-say"></p><div class="dlg-foot"><span><kbd>Space</kbd> next</span><span><kbd>Esc</kbd> skip</span><button class="btn small ghost" id="dlgSkip">Skip ▸▸</button></div></div></div>`;
    this.full = text; this.shown = 0; this.tLine = performance.now();
    const cv = this.box.querySelector('canvas');
    if (who === 'you' && p) drawHeroThumb(cv, p.cls, p.appearance || p.app || {});
    else { const g = cv.getContext('2d'), k = cv.width / 56; g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, 56, 56); try { drawHero(g, { x: 28, y: 30, ang: Math.PI / 2 - 0.4, cls: N.cls, app: N.app, time: 0, classic: true, noWeapon: who !== 'smith', scale: 1 }); } catch { /* art not ready */ } }
    this.type();
  }
  type() {
    const el = this.box.querySelector('.dlg-say'); if (!el) return;
    const n = Math.min(this.full.length, Math.floor((performance.now() - this.tLine) / 1000 * 60)); // 60 chars / s
    if (n !== this.shown) { this.shown = n; el.textContent = this.full.slice(0, n); el.classList.toggle('done', n >= this.full.length); }
  }
  next() {
    if (!this.dlgOpen()) return;
    if (this.shown < this.full.length) { this.tLine = -1e9; this.type(); return; } // finish the line first
    if (++this.i >= this.lines.length) return this.end();
    if (this.g.audio) this.g.audio.play('click');
    this.renderLine();
  }
  skip() { if (this.dlgOpen()) this.end(); }
  end() {
    this.box.classList.add('hidden'); cancelAnimationFrame(this._raf); this.guard = performance.now() + 350;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const f = this.onEnd, a = this.after; this.onEnd = this.after = null; this.lines = null;
    if (f) f(); if (a) a();
  }
  /** pay the chapter and show the card */
  turnIn(ch, after) {
    const pr = this.pr, lv0 = accountLevel(pr.accXp).level, res = claim(pr, ch.id, this.legacy());
    if (!res) { if (after) after(); return; }
    profile.save(); this._mk.t = -1;
    const acc = accountLevel(pr.accXp), g = res.next ? NPCS[res.next.giver] : null;
    const mats = Object.entries(res.reward.mats).map(([k, n]) => `<span class="mat-chip" style="--mc:${MATERIALS[k].color}"><i></i>${esc(MATERIALS[k].name)} <b>×${n}</b></span>`).join('');
    this.card.innerHTML = `<div class="panel rw-box sc-box"><div class="sc-head"><small>Chapter ${ch.n} of ${CHAPTERS.length} complete</small><h1>${esc(ch.title)}</h1></div>
      <div class="sc-rw"><div class="rw-row gold"><span>Village bounty</span><b>+${res.reward.gold} gold</b></div><div class="rw-row"><span>Account XP</span><b>+${res.reward.xp}${acc.level > lv0 ? ` <em class="rw-new">ACCOUNT LEVEL ${acc.level}</em>` : ''}</b></div><div class="rw-mats">${mats}</div></div>
      <div class="rw-unlock sc-ul">${res.unlocks.map((u) => `<div><b>Unlocked: ${esc(u.name)}</b> · ${esc(u.text)}</div>`).join('')}</div>
      <p class="sc-next">${res.next ? `Next: <b>Chapter ${res.next.n}: ${esc(res.next.title)}</b> · talk to ${esc(g.name)} (${esc(g.title)})` : '<b>The chain is complete.</b> Brightwater will remember you.'}</p>
      <div class="rw-foot"><span class="dim">Journal <kbd>${esc(this.key('journal', 'L'))}</kbd> · Gold ${pr.gold}</span><button class="btn" id="scOk">Continue <kbd>Enter</kbd></button></div></div>`;
    this.card.classList.remove('hidden'); this.cardAfter = after;
    this.card.querySelector('#scOk').onclick = () => this.closeCard();
    if (this.g.audio) { this.g.audio.play('levelup'); this.g.audio.play('coin'); }
  }
  closeCard() { this.card.classList.add('hidden'); this.guard = performance.now() + 350; const a = this.cardAfter; this.cardAfter = null; if (a) a(); }
  key(id, d) { try { return (this.g.input && this.g.input.kb.label(id)) || d; } catch { return d; } }
  /** the reward screen: a clear that meets the current chapter's objective says where to turn it in */
  rewardNote(res) {
    if (!res || !res.cleared) return '';
    const pr = this.pr, c = current(pr.story); if (!c || c.mission !== res.R.mission || status(pr, c, this.legacy()) !== 'ready') return '';
    return `Story: chapter ${c.n} "${c.title}" objective complete · report to ${NPCS[c.giver].name} for the reward`;
  }
  /** per frame: the objective tracker */
  update() {
    if (!this.tracker) return;
    const pr = this.pr, c = current(pr.story), p = this.g.player;
    const busy = !p || this.g.paused || this.isOpen() || (this.g.rewards && this.g.rewards.isOpen()) || (this.g.progress && this.g.progress.isOpen()) || (this.g.village && this.g.village.isOpen()) || (this.g.town && this.g.town.open) || (document.getElementById('dpsCard') && !document.getElementById('dpsCard').classList.contains('hidden'))
      || (this.g.isMobile && inOpsArea(p.x, p.y)); // (phone: the mission's own objective tracker takes the top of the screen)
    let html = '';
    if (!busy) {
      if (!c) html = allDone(pr.story) ? '<b>✦ Starbreaker</b><span>The chain is complete</span>' : '';
      else {
        const s = status(pr, c, this.legacy()), g = NPCS[c.giver];
        html = s === 'ready' ? `<b class="ok">★ Chapter ${c.n}</b><span>Report to ${esc(g.name)} (${esc(g.title)})</span>`
          : !pr.story.seen[c.id] ? `<b class="new">! Chapter ${c.n}</b><span>Talk to ${esc(g.name)} (${esc(g.title)})</span>`
            : `<b>▸ Chapter ${c.n}</b><span>${esc(c.goal)}</span>`;
      }
      if (html) html += this.g.isMobile ? '<i class="qt-j" aria-hidden="true">📖</i>' : `<kbd>${esc(this.key('journal', 'L'))}</kbd>`; // (phone: no keyboard key; the book says a tap opens the Journal)
    }
    this.tracker.classList.toggle('hidden', !html);
    // (game loop B fix: a boss bar owns the top centre: the tracker steps aside, under the minimap, while a boss is near)
    if (html) { const sim = this.g.sim, nb = !!(sim && p && sim.enemies && sim.enemies.some((e) => !e.dead && (e.boss || e.opsBoss) && Math.hypot(e.x - p.x, e.y - p.y) < 1500)); if (nb !== this._qb) { this._qb = nb; this.tracker.classList.toggle('qt-boss', nb); } }
    if (html && this._th !== html) { this._th = html; this.tracker.innerHTML = html; }
  }
  destroy() {
    if (this.onKey) removeEventListener('keydown', this.onKey, { capture: true });
    cancelAnimationFrame(this._raf); setNpcMarks(null);
    for (const el of [this.box, this.card, this.tracker]) if (el) el.classList.add('hidden');
  }
}
