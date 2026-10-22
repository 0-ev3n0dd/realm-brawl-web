// Loadout presets on the hub's Character tab (step 4): the 1-7 buttons. Click = swap to that preset (in town at once;
// in the field a short cast that damage / attacking cancels, never in combat or near a boss - sim/loadout.js decides),
// right-click (or 💾) = save the current gear + chain setup there, ✎ = rename. Digits 1-7 swap, Shift+digit saves.
import { LO_N, BLOCK_MSG, defaultLoName } from '../sim/loadout.js';
import { EQUIP_SLOTS, RARITIES } from '../sim/data/items.js';
import { itemName } from '../sim/meta.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class LoadoutBar {
  constructor(hub) { this.h = hub; this.sel = -1; this.editing = -1; this.msg = ''; this.msgKind = ''; this.sig = ''; this.cast = null; }
  get g() { return this.h.g; }
  player() { return this.h.player(); }
  cur() { const p = this.player(); return this.sel >= 0 ? this.sel : p && p.lo >= 0 ? p.lo : 0; }
  say(msg, kind = '') { this.msg = msg; this.msgKind = kind; this.sig = ''; this.render(); }
  /** the item names a preset holds (tooltip) + how many are still around */
  info(lo) {
    const p = this.player(), have = new Map();
    for (const s of EQUIP_SLOTS) { const it = p.equipment[s]; if (it) have.set(it.uid, it); }
    for (const it of p.inventory) if (it) have.set(it.uid, it);
    let n = 0, miss = 0; const names = [];
    for (const s of EQUIP_SLOTS) { const u = lo.g[s]; if (!u) continue; n++; const it = have.get(u); if (it) names.push(itemName(it)); else { miss++; names.push('(missing)'); } }
    return { n, miss, names };
  }
  render() {
    const p = this.player(), box = $('hcLoadouts'); if (!p || !box) return;
    const L = p.loadouts || [], c = this.cur();
    const sig = JSON.stringify([L, p.lo, c, this.editing, this.msg, this.cast && this.cast.i, p.equipment && EQUIP_SLOTS.map((s) => p.equipment[s] && p.equipment[s].uid), p.inventory.map((i) => i && i.uid)]);
    if (sig === this.sig) return; this.sig = sig;
    const btn = (i) => { const lo = L[i]; const t = lo ? (() => { const f = this.info(lo); return `${lo.n} · ${f.n} items${f.miss ? `, ${f.miss} missing` : ''}${lo.c && lo.c.pins.length ? ` · ${lo.c.pins.length} pinned chains` : ''}\nClick: swap · Right-click: save here`; })() : `Empty preset ${i + 1}\nRight-click (or 💾): save your current gear here`;
      return `<button class="lo-btn${p.lo === i ? ' on' : ''}${lo ? '' : ' empty'}${c === i ? ' sel' : ''}${this.cast && this.cast.i === i ? ' casting' : ''}" data-lo="${i}" title="${esc(t)}">${i + 1}</button>`; };
    const lo = L[c];
    const name = this.editing === c
      ? `<input id="loName" maxlength="16" value="${esc(lo ? lo.n : defaultLoName(c))}" spellcheck="false"><button class="lo-act" id="loNameOk" title="Save the name">✔</button>`
      : `<b class="lo-nm">${esc(lo ? lo.n : `Preset ${c + 1} (empty)`)}</b>${lo ? `<small>${(() => { const f = this.info(lo); return `${f.n} items${f.miss ? ` · <span class="bad">${f.miss} missing</span>` : ''}`; })()}${p.lo === c ? ' · active' : ''}</small>` : ''}`;
    box.innerHTML = `<div class="lo-row"><span class="lo-lbl">Loadouts</span>${Array.from({ length: LO_N }, (_, i) => btn(i)).join('')}</div>
      <div class="lo-row lo-sub">${name}<button class="lo-act" id="loSave" title="Save the current gear + chain setup to preset ${c + 1} (Shift+${c + 1})">💾 Save</button><button class="lo-act" id="loRen" title="Rename preset ${c + 1}"${lo ? '' : ' disabled'}>✎</button></div>
      <div class="lo-msg ${this.msgKind}" id="loMsg">${esc(this.msg || (this.cast ? `Swapping to ${this.cast.name}…` : ''))}${this.cast ? '<i class="lo-bar"><b></b></i>' : ''}</div>`;
    box.querySelectorAll('[data-lo]').forEach((b) => {
      const i = +b.dataset.lo;
      b.onclick = () => this.use(i);
      b.oncontextmenu = (e) => { e.preventDefault(); this.save(i); };
    });
    const sv = $('loSave'); if (sv) sv.onclick = () => this.save(this.cur());
    const rn = $('loRen'); if (rn) rn.onclick = () => { this.editing = this.cur(); this.sig = ''; this.render(); const inp = $('loName'); if (inp) { inp.focus(); inp.select(); } };
    const inp = $('loName');
    if (inp) {
      const ok = () => this.rename(this.editing, inp.value);
      inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') ok(); if (e.key === 'Escape') { this.editing = -1; this.sig = ''; this.render(); } };
      $('loNameOk').onclick = ok;
    }
  }
  tick() { // cast progress bar (co-op: the world keeps running behind the hub)
    const b = this.cast && document.querySelector('#loMsg .lo-bar b');
    if (b) b.style.width = Math.min(100, ((performance.now() - this.cast.t0) / (this.cast.dur * 1000)) * 100).toFixed(1) + '%';
  }
  use(i) {
    const p = this.player(); if (!p) return;
    this.sel = i;
    if (!p.loadouts || !p.loadouts[i]) { this.say(`Preset ${i + 1} is empty: 💾 Save (or right-click it) to store your current gear there.`, ''); return; }
    if (p.lo === i && !this.cast) { this.say(`${p.loadouts[i].n} is already active.`, ''); }
    this.g.command({ type: 'loUse', i }); this.msg = ''; this.sig = ''; this.render();
  }
  save(i) {
    const p = this.player(); if (!p) return;
    this.sel = i;
    const name = p.loadouts && p.loadouts[i] ? p.loadouts[i].n : defaultLoName(i);
    this.g.command({ type: 'loSave', i, name });
    if (this.g.audio) this.g.audio.play('click');
  }
  rename(i, name) { this.editing = -1; this.g.command({ type: 'loName', i, name: String(name || '').slice(0, 16) }); this.sig = ''; this.render(); }
  /** the sim's 'loadout' events (routed by client/loadoutfx.js) */
  onEvent(ev) {
    const p = this.player(); const L = (p && p.loadouts) || [];
    if (ev.ph === 'saved') this.say(`Saved ${ev.name}: your gear + chain setup.`, 'ok');
    else if (ev.ph === 'named') this.say(`Renamed to ${ev.name}.`, 'ok');
    else if (ev.ph === 'cast') { this.cast = { i: ev.i, name: ev.name, dur: ev.dur, t0: performance.now() }; this.say('', ''); }
    else if (ev.ph === 'swap') { this.cast = null; this.say(`${ev.name} equipped${ev.miss ? ` · ${ev.miss} saved item${ev.miss > 1 ? 's' : ''} missing (kept what you wore)` : ''}.`, ev.miss ? 'warn' : 'ok'); }
    else if (ev.ph === 'cancel') { this.cast = null; this.say(`Swap cancelled: ${BLOCK_MSG[ev.why] || ev.why}.`, 'err'); }
    else if (ev.ph === 'fail') { this.cast = null; this.say(`Can't swap${L[ev.i] ? ` to ${L[ev.i].n}` : ''}: ${BLOCK_MSG[ev.why] || ev.why}.`, 'err'); }
    this.sig = ''; if (this.h.isOpen() && this.h.tab === 'character') this.render();
  }
}
