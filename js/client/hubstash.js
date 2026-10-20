// The hub's Stash tab (step 4): the shared stash (4 tabs x 40, every hero of the profile, client/village.js `stash`)
// next to the hero's bag - click or drag to move items; moving works in town (the chest), browsing works anywhere.
// Second view: the Auto-Salvage rules (sim/autosalvage.js) + the "recently auto-salvaged" log with undo.
import { stash } from './village.js';
import { STASH_SIZE, stashTake, stashMove, stashCount, stashCap, renameStashTab, sortStashTab } from '../sim/village.js';
import { inTownArea } from '../sim/townconst.js';
import { slotEl } from './ui.js';
import { compareTarget } from '../sim/gear.js';
import { itemPower } from '../sim/loot.js';
import { itemName, MATERIALS } from '../sim/meta.js';
import { RARITIES } from '../sim/data/items.js';
import { AS_LOG_MAX, AS_RULES, AS_RULE, AS_RARITIES, AS_SETS, AS_STATS, autoSalvageCheck, normAutoSalvage, GUARD_TEXT, classStatKeys } from '../sim/autosalvage.js';
import { AFFIXES } from '../sim/data/items.js';
import { CLASSES } from '../sim/data/classes.js';
import { statContains } from './bagview.js';
import { profile } from './rewards.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? `${s | 0}s ago` : s < 3600 ? `${(s / 60) | 0}m ago` : `${(s / 3600) | 0}h ago`; };

export class StashTab {
  constructor(hub) { this.h = hub; this.sub = 'stash'; this.tab = 0; this.sig = ''; this.msg = ''; this.q = ''; this.renaming = -1; }
  get g() { return this.h.g; }
  player() { return this.h.player(); }
  /** moving items needs the chest: in Brightwater (the hub's town), not on a mission */
  canMove() { const p = this.player(); if (!p || p.dead || !inTownArea(p.x, p.y)) return false; const I = this.g.hubInfo ? this.g.hubInfo() : { m: 'town' }; return !I.m || I.m === 'town'; }
  dirty() { this.sig = ''; }
  say(m) { this.msg = m; this.sig = ''; }
  render(sub) {
    if (sub) this.sub = sub;
    const root = $('hubStash'); if (!root) return;
    const p = this.player(); if (!p) return;
    const S = stash.load(), pr = profile.load();
    const sig = JSON.stringify([this.sub, this.tab, this.msg, this.q, this.renaming, this.canMove(), this.confirmNow, p.inventory.map((i) => i && i.uid + (i.lock ? '!' : '')), this.sub === 'stash' ? S.tabs.map((T) => T.name + T.items.map((i) => (i ? i.uid : '')).join()) : JSON.stringify(pr.autoSalvage) + p.cls]);
    if (sig === this.sig) return; this.sig = sig;
    const subs = `<div class="hs-sub"><button class="tab${this.sub === 'stash' ? ' on' : ''}" data-ssub="stash">Stash</button><button class="tab${this.sub === 'salvage' ? ' on' : ''}" data-ssub="salvage">Auto-Salvage${pr.autoSalvage && pr.autoSalvage.on ? ' <em class="as-on">ON</em>' : ''}</button><span class="hint">${this.sub === 'stash' ? `Shared by every hero on this profile · ${stashCount(S)} / ${stashCap(S)}` : 'Rules for drops you pick up: matches turn into materials at once'}</span></div>`;
    root.innerHTML = subs + (this.sub === 'stash' ? this.stashHtml(p, S) : this.salvageHtml(p, pr));
    root.querySelectorAll('[data-ssub]').forEach((b) => (b.onclick = () => { this.sub = b.dataset.ssub; this.h.state.sub.stash = this.sub; this.sig = ''; this.render(); }));
    if (this.sub === 'stash') this.bindStash(p, S); else this.bindSalvage(p, pr);
  }

  // ---- stash ---------------------------------------------------------------------------------------------------------
  stashHtml(p, S) {
    const T = S.tabs[this.tab], move = this.canMove();
    const tabs = S.tabs.map((t, k) => this.renaming === k
      ? `<span class="hs-tab on"><input id="hsTabName" maxlength="14" value="${esc(t.name)}" spellcheck="false"></span>`
      : `<button class="hs-tab${k === this.tab ? ' on' : ''}" data-stab="${k}" title="Drop an item here to move it to ${esc(t.name)} · double-click to rename">${esc(t.name)} <small>${t.items.filter(Boolean).length}</small></button>`).join('');
    const bag = p.inventory.map((it, i) => `<div class="slot hs-cell" data-bag="${i}"${it ? ' draggable="true"' : ''}></div>`).join('');
    const box = T.items.map((it, i) => `<div class="slot hs-cell${it && this.q && !statContains(it, this.q) && !itemName(it).toLowerCase().includes(this.q.toLowerCase()) ? ' dim' : ''}" data-st="${i}"${it ? ' draggable="true"' : ''}></div>`).join('');
    return `${move ? '' : '<div class="hs-note">🔒 The stash chest is in Brightwater Village: you can browse it here, moving items works in town.</div>'}
      <div class="hs-wrap${move ? '' : ' ro'}">
        <div class="hs-bag panel-in"><h3>${esc(p.name)}'s bag <span class="dim">${p.inventory.filter(Boolean).length} / ${p.inventory.length}</span></h3><div class="hs-grid bag" data-zone="bag">${bag}</div>
          <p class="hint">Click an item: bag ⇄ stash · drag onto a slot or a tab · 🔒 locked items stay locked in the stash</p></div>
        <div class="hs-box panel-in"><div class="hs-tabs">${tabs}<span class="hs-tools"><button class="btn small ghost" id="hsRen" title="Rename this tab">✎</button><button class="btn small ghost" id="hsSort" title="Sort this tab: rarity, tier, slot"${move ? '' : ' disabled'}>⇅ Sort</button><input id="hsFind" placeholder="find: name / stat" value="${esc(this.q)}" spellcheck="false"></span></div>
          <div class="hs-grid box" data-zone="stash">${box}</div>
          <div class="hs-foot"><span>${esc(T.name)}: ${T.items.filter(Boolean).length} / ${STASH_SIZE}</span><span>All tabs: ${stashCount(S)} / ${stashCap(S)}</span><span class="hs-msg">${esc(this.msg)}</span></div></div>
      </div>`;
  }
  bindStash(p, S) {
    const root = $('hubStash'), T = S.tabs[this.tab], ui = this.g.ui;
    const cmp = (it) => (it.cls && it.cls !== p.cls ? { stats: { atk: 1e9 } } : compareTarget(p, it));
    root.querySelectorAll('[data-bag]').forEach((el) => {
      const i = +el.dataset.bag, it = p.inventory[i]; slotEl(el, it, cmp);
      el.onclick = () => this.toStash(i, -1);
      el.onmouseenter = (e) => { if (it && ui) ui.showTip(it, e, true); }; el.onmouseleave = () => ui && ui.hideTip();
      el.ondragstart = (e) => { if (!it) return; e.dataTransfer.setData('text/rb-bag', String(i)); e.dataTransfer.effectAllowed = 'move'; ui && ui.hideTip(); };
    });
    root.querySelectorAll('[data-st]').forEach((el) => {
      const i = +el.dataset.st, it = T.items[i]; slotEl(el, it, cmp);
      el.onclick = () => this.toBag(i);
      el.onmouseenter = (e) => { if (it && ui) ui.showTip(it, e, true); }; el.onmouseleave = () => ui && ui.hideTip();
      el.ondragstart = (e) => { if (!it) return; e.dataTransfer.setData('text/rb-stash', `${this.tab}:${i}`); e.dataTransfer.effectAllowed = 'move'; ui && ui.hideTip(); };
    });
    const allow = (el) => { el.ondragover = (e) => { e.preventDefault(); el.classList.add('over'); }; el.ondragleave = () => el.classList.remove('over'); };
    // drop targets: a stash slot, a stash tab, the bag
    root.querySelectorAll('[data-st]').forEach((el) => { allow(el); el.ondrop = (e) => { e.preventDefault(); el.classList.remove('over'); const j = +el.dataset.st, b = e.dataTransfer.getData('text/rb-bag'), s = e.dataTransfer.getData('text/rb-stash'); if (b !== '') this.toStash(+b, j); else if (s) { const [t, i] = s.split(':').map(Number); this.move(t, i, this.tab, j); } }; });
    root.querySelectorAll('[data-stab]').forEach((el) => {
      el.onclick = () => { this.tab = +el.dataset.stab; this.sig = ''; this.render(); };
      el.ondblclick = () => { this.renaming = +el.dataset.stab; this.sig = ''; this.render(); };
      allow(el); el.ondrop = (e) => { e.preventDefault(); el.classList.remove('over'); const t2 = +el.dataset.stab, b = e.dataTransfer.getData('text/rb-bag'), s = e.dataTransfer.getData('text/rb-stash'); if (b !== '') { const was = this.tab; this.tab = t2; this.toStash(+b, -1); this.tab = was; } else if (s) { const [t, i] = s.split(':').map(Number); this.move(t, i, t2, -1); } };
    });
    const bz = root.querySelector('[data-zone="bag"]'); if (bz) { allow(bz); bz.ondrop = (e) => { e.preventDefault(); bz.classList.remove('over'); const s = e.dataTransfer.getData('text/rb-stash'); if (s) { const [t, i] = s.split(':').map(Number); this.toBag(i, t); } }; }
    const inp = $('hsTabName'); if (inp) { inp.focus(); inp.select(); const done = () => { renameStashTab(S, this.renaming, inp.value); stash.save(); this.renaming = -1; this.sig = ''; this.render(); }; inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') done(); if (e.key === 'Escape') { this.renaming = -1; this.sig = ''; this.render(); } }; inp.onblur = done; }
    const rn = $('hsRen'); if (rn) rn.onclick = () => { this.renaming = this.tab; this.sig = ''; this.render(); };
    const so = $('hsSort'); if (so) so.onclick = () => { if (!this.canMove()) return; sortStashTab(S, this.tab); stash.save(); this.say(`Sorted ${T.name}.`); this.render(); };
    const fd = $('hsFind'); if (fd) { fd.oninput = () => { this.q = fd.value.slice(0, 24); this.sig = ''; const pos = fd.selectionStart; this.render(); const f2 = $('hsFind'); if (f2) { f2.focus(); f2.setSelectionRange(pos, pos); } }; fd.onkeydown = (e) => e.stopPropagation(); }
  }
  toStash(i, slot) {
    if (!this.canMove()) return this.say('Move items at the stash chest in town.'), this.render();
    const V = this.g.village, p = this.player(), it = p.inventory[i]; if (!V || !it) return;
    if (V.takeOut(i, 'stash', { tab: this.tab, slot })) { this.say(`Stored ${itemName(it)}.`); if (this.g.audio) this.g.audio.play('pickup'); }
    this.render();
  }
  toBag(i, t = this.tab) {
    if (!this.canMove()) return this.say('Move items at the stash chest in town.'), this.render();
    const p = this.player(), S = stash.load();
    if (p.inventory.indexOf(null) < 0) return this.say('Your bag is full.'), this.render();
    const it = stashTake(S, i, t); if (!it) return; stash.save();
    if (this.g.village) this.g.village.sendUnstash(it, t); else this.g.command({ type: 'unstash', item: it }); if (this.g.audio) this.g.audio.play('pickup'); // (bugpass: put back if the bag was full)
    this.say(`Took ${itemName(it)}.`); this.render();
  }
  move(t, i, t2, j) {
    if (!this.canMove()) return this.say('Move items at the stash chest in town.'), this.render();
    const S = stash.load(); if (t === t2 && i === j) return;
    if (stashMove(S, t, i, t2, j)) { stash.save(); this.say(t === t2 ? 'Moved.' : `Moved to ${S.tabs[t2].name}.`); } else this.say(`${S.tabs[t2].name} is full.`);
    this.render();
  }

  // ---- auto-salvage ----------------------------------------------------------------------------------------------------
  salvageHtml(p, pr) {
    const c = pr.autoSalvage = normAutoSalvage(pr.autoSalvage);
    const arg = (r) => {
      const R = AS_RULE[r.id]; if (!R.arg) return '';
      const opts = R.arg === 'rarity' ? AS_RARITIES.filter((x) => x.i >= 1).map((x) => [x.i, x.name])
        : R.arg === 'tier' ? [2, 3, 4, 5].map((n) => [n, `Tier ${n}`])
        : R.arg === 'ilvl' ? [10, 20, 30, 40, 50, 60, 80, 100].map((n) => [n, `iLvl ${n}`])
        : R.arg === 'stat' ? AS_STATS.map((s) => [s.k, s.name])
        : [...(r.id === 'notSet' ? [['*', 'any set (not a set piece)']] : []), ...AS_SETS.map((s) => [s.id, s.name])];
      return `<select data-rarg="${r.id}">${opts.map(([v, n]) => `<option value="${v}"${String(v) === String(r.arg) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    };
    const ks = classStatKeys(p.cls).map((k) => (AFFIXES[k] ? AFFIXES[k].label : k)).join(' / ');
    const rows = c.rules.map((r) => `<label class="as-rule${r.on ? ' on' : ''}"><input type="checkbox" data-rule="${r.id}"${r.on ? ' checked' : ''}><span>${esc(AS_RULE[r.id].label)}${r.id === 'classStat' ? ` <small class="dim">(${esc(CLASSES[p.cls].name)}: ${esc(ks)})</small>` : ''}</span>${arg(r)}</label>`).join('');
    const preview = p.inventory.filter(Boolean).map((it) => ({ it, r: autoSalvageCheck(it, { ...c, on: true }, p) }));
    const hit = preview.filter((x) => x.r.ok), kept = preview.filter((x) => !x.r.ok && x.r.why !== 'no rule');
    const log = c.log.map((e, k) => { const R = RARITIES[e.item.rarity] || RARITIES[0]; return `<div class="as-row"><b style="color:${R.color}">${esc(itemName(e.item))}</b><small class="dim">${R.name} ${esc(e.item.slot)} · T${e.item.tier} · ${ago(e.t)}</small><span class="as-val"><span class="gold">+${e.gold}g</span> ${Object.entries(e.mats).map(([m, n]) => `<span style="color:${(MATERIALS[m] || {}).color || '#9fe'}">+${n} ${esc((MATERIALS[m] || {}).name || m)}</span>`).join(' ')}</span><button class="btn small ghost" data-undo="${k}" title="Give the gold + materials back and return the item to your bag">↶ Undo</button></div>`; }).join('');
    return `<div class="as-wrap">
      <div class="as-rules panel-in">
        <label class="as-master${c.on ? ' on' : ''}"><input type="checkbox" id="asOn"${c.on ? ' checked' : ''}><span><b>Auto-salvage drops on pickup</b><small>Matching gear becomes gold + materials the moment it reaches your bag</small></span></label>
        <div class="as-mode">Salvage a drop when it matches <button class="tab${c.mode === 'any' ? ' on' : ''}" data-mode="any">any ticked rule</button><button class="tab${c.mode === 'all' ? ' on' : ''}" data-mode="all">all ticked rules</button></div>
        <h3>Rules</h3><div class="as-list">${rows}</div>
        <h3>Safety</h3>
        <div class="as-list">
          <label class="as-rule${c.safety ? ' on' : ''}"><input type="checkbox" id="asSafety"${c.safety ? ' checked' : ''}><span>Never salvage anything better than what I wear in that slot <small class="dim">(recommended)</small></span></label>
          <label class="as-rule${c.protectSets ? ' on' : ''}"><input type="checkbox" id="asSets"${c.protectSets ? ' checked' : ''}><span>Keep pieces of sets I'm collecting <small class="dim">(a piece equipped; a "Pieces of set" rule overrides)</small></span></label>
          <label class="as-rule${c.allowRelics ? ' on' : ''}"><input type="checkbox" id="asRelics"${c.allowRelics ? ' checked' : ''}><span>Allow relics to be auto-salvaged</span></label>
        </div>
        <p class="hint">Always kept: 🔒 locked items, Trial / Extreme pieces, upgraded or crafted gear, key items.</p>
      </div>
      <div class="as-side">
        <div class="as-prev panel-in"><h3>Your bag right now</h3>${hit.length ? `<p>${hit.length} piece${hit.length > 1 ? 's' : ''} would be salvaged: ${hit.map((x) => `<b style="color:${RARITIES[x.it.rarity].color}">${esc(itemName(x.it))}</b>`).join(', ')}</p>` : '<p class="dim">Nothing in your bag matches.</p>'}${kept.length ? `<p class="dim">Kept by a guard: ${kept.map((x) => `${esc(itemName(x.it))} <i>(${esc(GUARD_TEXT[x.r.why] || x.r.why)})</i>`).join(', ')}</p>` : ''}${hit.length ? (this.confirmNow ? `<div class="as-now"><b>Salvage ${hit.length} piece${hit.length > 1 ? 's' : ''} into gold + materials?</b> <button class="btn small" id="asNowYes">Yes, salvage</button><button class="btn small ghost" id="asNowNo">Cancel</button>${hit.length > AS_LOG_MAX ? `<small class="dim">Undo keeps the last ${AS_LOG_MAX}.</small>` : ''}</div>` : `<button class="btn small" id="asNow" title="Salvage the bag items listed above (same rules + guards as pickups; undo below)">♻ Salvage matching now (${hit.length})</button>`) : ''}<p class="hint">Rules act on new pickups${hit.length ? '; the button salvages what is already in your bag' : ''}. Locked items${c.allowRelics ? '' : ' and relics'} are never touched.</p></div>
        <div class="as-log panel-in"><h3>Recently auto-salvaged <span class="dim">${c.n | 0} total</span></h3>${log || '<p class="dim">Nothing yet.</p>'}<p class="hint">Undo returns the item and takes its gold + materials back (if you haven't spent them). The last ${c.log.length ? c.log.length : 10} are kept.</p><div class="hs-msg">${esc(this.msg)}</div></div>
      </div></div>`;
  }
  bindSalvage(p, pr) {
    const root = $('hubStash'), c = pr.autoSalvage;
    const save = () => { pr.autoSalvage = normAutoSalvage(c); profile.save(); this.sig = ''; this.render(); };
    const on = $('asOn'); if (on) on.onchange = () => { c.on = on.checked; save(); };
    root.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { c.mode = b.dataset.mode; save(); }));
    root.querySelectorAll('[data-rule]').forEach((b) => (b.onchange = () => { const r = c.rules.find((x) => x.id === b.dataset.rule); if (r) r.on = b.checked; save(); }));
    root.querySelectorAll('[data-rarg]').forEach((b) => (b.onchange = () => { const r = c.rules.find((x) => x.id === b.dataset.rarg); if (r) { r.arg = /^\d+$/.test(b.value) ? +b.value : b.value; r.on = true; } save(); }));
    for (const [id, k] of [['asSafety', 'safety'], ['asSets', 'protectSets'], ['asRelics', 'allowRelics']]) { const e = $(id); if (e) e.onchange = () => { c[k] = e.checked; save(); }; }
    const now = $('asNow'); if (now) now.onclick = () => { this.confirmNow = true; this.sig = ''; this.render(); const y = $('asNowYes'); if (y) y.focus(); };
    const no = $('asNowNo'); if (no) no.onclick = () => { this.confirmNow = false; this.sig = ''; this.render(); };
    const yes = $('asNowYes'); if (yes) yes.onclick = () => { this.confirmNow = false; const A = this.g.autoSalvage, n = A && A.salvageNow ? A.salvageNow() : 0; this.say(n ? `Salvaged ${n} piece${n > 1 ? 's' : ''}: undo in the list below.` : 'Nothing to salvage.'); this.render(); };
    root.querySelectorAll('[data-undo]').forEach((b) => (b.onclick = () => { const A = this.g.autoSalvage; if (!A) return; const err = A.undo(+b.dataset.undo); this.say(err ? `Can't undo: ${err}.` : 'Restored to your bag.'); this.render(); }));
  }
}
