// DOM panels: inventory/equipment, loot bag, tooltips, death & pause overlays.
// UI never mutates the sim directly; it issues commands (sim.command) like a network client would.
import { RARITIES, AFFIXES, STAT_LABELS } from '../sim/data/items.js';
import { itemPower, itemLevel } from '../sim/loot.js';
import { CLASSES } from '../sim/data/classes.js';
import { tipSub, tipExtra, bagTitle, respawnWhere } from './settip.js';
import { drawItemIcon } from './art.js';
import { uiOn, uiIcon, itemIconKey, iconStyle, UIP } from './uipaint.js'; // painted I1-I3 item icons (Art style = Painted)
import { AST_POS } from '../sim/astraelconst.js';
import { inTrialArea } from '../sim/trialconst.js';
import { itemName, upStats, ascendCost, MATERIALS } from '../sim/meta.js';
import { salvageValue } from '../sim/village.js';
import { profile } from './rewards.js';
import { statLines, compareBlock, itemSubLine } from './geartip.js';
import { compareTarget } from '../sim/gear.js';
import { bagView, normBagView, BAG_TAB, filtered, pickLabel } from './bagview.js';
import { MAT_IDS } from '../sim/meta.js';
import { bagHeader, bagBreakdown } from './bagui.js';

const BV_KEY = 'realmbrawl.bagview';
const LS = typeof localStorage !== 'undefined' ? localStorage : null;

const $ = (id) => document.getElementById(id);
const fmt = (k, v) => {
  const a = AFFIXES[k];
  if (a && a.fmt === 'pct') return `+${(v * 100).toFixed(1)}%`;
  if (a && a.fmt === 'dec') return `+${v.toFixed(1)}/s`;
  return `+${Math.round(v)}`;
};

export function slotEl(el, item, compare) {
  el.querySelectorAll('canvas,.up,.lk,.il').forEach((n) => n.remove());
  el.className = el.className.replace(/\br\d\b/g, '').trim();
  if (!item) return;
  if (item.lock) { const k = document.createElement('span'); k.className = 'lk'; k.textContent = '🔒'; el.appendChild(k); } // step 4: locked
  el.classList.add('r' + item.rarity);
  const c = document.createElement('canvas');
  c.width = c.height = 92;
  if (!(uiOn() && uiIcon(c.getContext('2d'), itemIconKey(item), 46, 46, 92, 10))) drawItemIcon(c.getContext('2d'), item, 92);
  el.prepend(c);
  if (item.slot !== 'sigil') { const L = document.createElement('span'); L.className = 'il'; L.textContent = itemLevel(item); L.title = 'Item Level'; L.style.cssText = 'position:absolute;left:2px;bottom:1px;font:700 10px/1 system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000,0 0 2px #000;pointer-events:none'; el.appendChild(L); } // (item level pass)
  if (compare && itemPower(item) > itemPower(compare(item))) { const u = document.createElement('span'); u.className = 'up'; u.textContent = '▲'; el.appendChild(u); }
}

/** phone gear slot: tap = `tap`, long-press (~0.5 s) = `hold` (there is no right-click to unequip) */
export function bindTouchSlot(el, tap, hold, ms = 500) {
  let t = 0, held = false;
  el.onpointerdown = () => { held = false; clearTimeout(t); t = setTimeout(() => { held = true; hold(); }, ms); };
  el.onpointerup = el.onpointerleave = el.onpointercancel = () => clearTimeout(t);
  el.onclick = () => { if (held) { held = false; return; } tap(); };
  el.oncontextmenu = (e) => { e.preventDefault(); };
  return el;
}

export class UI {
  /** opts.touch (the phone, mobile/js/mgame.js): only the hub's bag + gear slots; a tap inspects (opts.inspect) instead of
   *  equipping at once, a tap on a gear slot still filters the bag (slot sort) and a long-press opens it (Unequip / Lock). */
  constructor(game, opts = {}) {
    this.game = game; this.touch = !!opts.touch; this.onInspect = opts.inspect || null;
    this.invOpen = false;
    this.lastSig = '';
    this.lootSig = '';
    this.currentBag = null;
    this.tooltip = $('tooltip');
    if (!this.tooltip && typeof document !== 'undefined') { this.tooltip = document.createElement('div'); this.tooltip.id = 'tooltip'; this.tooltip.className = 'tooltip hidden'; document.body.appendChild(this.tooltip); }
    if (this.tooltip && this.tooltip.parentElement !== document.body) document.body.appendChild(this.tooltip); // (fixed #ui is its own stacking context: out here the tip sits above the menu hub)
    $('ui').classList.remove('hidden');
    document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => this.toggleInventory(false)));
    const grid = $('invGrid');
    grid.innerHTML = '';
    // step 4: the bag view (tabs / sort / filters, client/bagview.js) maps cell k -> bag index this.view[k]
    try { this.bv = normBagView(LS && JSON.parse(LS.getItem(BV_KEY) || 'null')); } catch { this.bv = normBagView(null); }
    this.view = []; this.cells = 0;
    this.ensureCells(this.player() ? this.player().inventory.length : 64); // (inventory pass: 64..128 cells, grown with the bag)
    this.bindBagControls();
    this.bindBagRow();
    document.querySelectorAll('.slot.eq').forEach((d) => {
      if (this.touch) { bindTouchSlot(d, () => this.pickSlot(d.dataset.eq), () => { const it = this.player().equipment[d.dataset.eq]; if (it && this.onInspect) this.onInspect({ where: 'eq', slot: d.dataset.eq, item: it }); }); return; }
      // click: show only the bag items for this slot, best first (again / chip x / Esc: back); right-click (Del in Keyboard only): unequip
      d.onclick = (e) => { if (e.ctrlKey || e.metaKey || e.altKey) { this.toggleLock('eq', d.dataset.eq); return; } this.pickSlot(d.dataset.eq); };
      d.oncontextmenu = (e) => { e.preventDefault(); if (this.player().equipment[d.dataset.eq]) { this.cmd({ type: 'unequip', slot: d.dataset.eq }); this.hideTip(); } };
      d.onmouseenter = (e) => this.showTip(this.player().equipment[d.dataset.eq], e, false);
      d.onmouseleave = () => this.hideTip();
    });
    if (this.touch) return; // (the phone keeps its own loot panel, pause menu and death screen: mobile/js/mui.js)
    $('takeAll').onclick = () => this.takeAll();
    addEventListener('mousemove', (e) => { if (!this.tooltip.classList.contains('hidden')) this.placeTip(e); });
    // (2026-10-09: the Esc pause menu is gone: Esc opens the hub on Options; its session buttons live in Options › Account & Online)
  }
  player() { return this.game.player; }
  /** one cell per bag slot (64..128: the grid scrolls); cells are only ever added (a bag never shrinks) */
  ensureCells(n) {
    const grid = $('invGrid'); if (!grid) return;
    const at = (k) => (k < this.view.length ? this.view[k] : -1);
    for (let k = this.cells; k < n; k++) {
      const d = document.createElement('div');
      d.className = 'slot'; d.dataset.cell = k; d.dataset.idx = k; // (data-idx: the cell; with the default view it is the bag index too)
      if (this.touch) { d.onclick = () => { const i = at(k), it = i >= 0 ? this.player().inventory[i] : null; if (it && this.onInspect) this.onInspect({ where: 'inv', idx: i, item: it }); }; grid.appendChild(d); continue; } // (phone: tap = inspect sheet: Equip / Lock / Drop)
      d.onclick = (e) => { const i = at(k); if (i < 0) return; if (e.ctrlKey || e.metaKey || e.altKey) { this.toggleLock('inv', i); return; } this.cmd({ type: 'equip', idx: i }); };
      d.oncontextmenu = (e) => { e.preventDefault(); const i = at(k); if (i < 0) return; const it = this.player().inventory[i]; if (it && it.lock) { this.flash(`${itemName(it)} is locked`); return; } this.cmd({ type: 'drop', idx: i }); this.hideTip(); };
      d.onmouseenter = (e) => { const i = at(k); if (i >= 0) this.showTip(this.player().inventory[i], e, true); };
      d.onmouseleave = () => this.hideTip();
      d.draggable = true; // (drag a bag item onto the stash in the hub's Stash tab)
      d.ondragstart = (e) => { const i = at(k); if (i < 0 || !this.player().inventory[i]) { e.preventDefault(); return; } e.dataTransfer.setData('text/rb-bag', String(i)); e.dataTransfer.effectAllowed = 'move'; this.hideTip(); };
      grid.appendChild(d);
    }
    this.cells = Math.max(this.cells, n);
  }
  cmd(c) { this.game.command(c); this.lastSig = ''; this.lootSig = ''; }
  flash(msg) { const p = this.player(), fx = this.game.fx; if (fx && p) fx.text(p.x, p.y - 70, msg, { size: 16, color: '#ffe9a0', vy: -30, life: 1.4, pop: 1.2 }); const n = $('bagNote'); if (n) { n.textContent = msg; clearTimeout(this._nt); this._nt = setTimeout(() => { n.textContent = ''; }, 2200); } }
  /** step 4: lock / unlock (the sim owns the flag; co-op: server-checked) */
  toggleLock(at, ref) {
    const p = this.player(), it = at === 'eq' ? p.equipment[ref] : p.inventory[ref]; if (!it || it.slot === 'sigil') return;
    this.cmd(at === 'eq' ? { type: 'lock', at, slot: ref, on: it.lock ? 0 : 1 } : { type: 'lock', at, idx: ref, on: it.lock ? 0 : 1 });
    this.flash(`${it.lock ? 'Unlocked' : '🔒 Locked'}: ${itemName(it)}`); this.hideTip();
    if (this.game.audio) this.game.audio.play('click');
  }
  /** the bag is one sideways-scrolling row (hub Character tab): the wheel scrolls it, drag an empty spot / the scrollbar,
   *  ‹ › step a page; the arrows + fade edges show when there is more either way */
  bindBagRow() {
    const g = $('invGrid'), row = $('bagRow'); if (!g || !row) return;
    const sync = () => { const max = g.scrollWidth - g.clientWidth - 1; row.classList.toggle('more-l', g.scrollLeft > 1); row.classList.toggle('more-r', g.scrollLeft < max); };
    this.syncBagRow = sync;
    g.addEventListener('wheel', (e) => { if (g.scrollWidth <= g.clientWidth) return; const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX; g.scrollLeft += d * (e.deltaMode === 1 ? 40 : 1); e.preventDefault(); this.hideTip(); }, { passive: false });
    g.addEventListener('scroll', sync, { passive: true });
    const step = (dir) => { g.scrollBy({ left: dir * Math.max(120, g.clientWidth * 0.8), behavior: 'smooth' }); };
    const l = $('bagL'), r = $('bagR'); if (l) l.onclick = () => step(-1); if (r) r.onclick = () => step(1);
    let drag = null; // drag-to-scroll from an empty slot or a gap (items keep their own drag + click)
    g.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; const c = e.target.closest('.slot'); if (c && c.querySelector('canvas')) return; drag = { x: e.clientX, s: g.scrollLeft, moved: false }; g.setPointerCapture && g.setPointerCapture(e.pointerId); });
    g.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 3) drag.moved = true; g.scrollLeft = drag.s - dx; });
    const end = () => { drag = null; }; g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
    addEventListener('resize', sync); sync();
  }
  /** the bag tabs / sort / filter controls (built by client/menuhub.js; absent elsewhere) */
  bindBagControls() {
    const save = () => { try { LS && LS.setItem(BV_KEY, JSON.stringify({ ...this.bv, pick: undefined })); } catch { /* */ } this.lastSig = ''; this.syncBagControls(); }; // (the slot pick is not saved)
    document.querySelectorAll('[data-btab]').forEach((b) => (b.onclick = () => { this.bv.tab = b.dataset.btab; this.bv.pick = ''; save(); }));
    const sel = (id, k) => { const e = $(id); if (e) e.onchange = () => { this.bv[k] = e.value; if (k === 'slot') this.bv.pick = ''; save(); }; };
    const px = $('bagPickX'); if (px) px.onclick = () => this.clearPick();
    sel('bagSort', 'sort'); sel('bagSlot', 'slot'); sel('bagRar', 'rarity'); sel('bagSet', 'set');
    const t = $('bagText'); if (t) t.oninput = () => { this.bv.text = t.value.slice(0, 24); save(); };
    const c = $('bagClear'); if (c) c.onclick = () => { Object.assign(this.bv, { slot: '', rarity: '', set: '', text: '', pick: '' }); save(); };
    this.syncBagControls();
  }
  /** click on an equipment slot: toggle the slot pick (only that slot's items, best first) and scroll the bag back to the start */
  pickSlot(eq) {
    this.bv.pick = this.bv.pick === eq ? '' : eq;
    this.lastSig = ''; this.syncBagControls();
    const g = $('invGrid'); if (g) g.scrollLeft = 0;
    if (this.game.audio) this.game.audio.play('click');
  }
  /** true when there was a pick to clear (Esc in the hub clears it before closing) */
  clearPick() { if (!this.bv || !this.bv.pick) return false; this.bv.pick = ''; this.lastSig = ''; this.syncBagControls(); return true; }
  syncBagControls() {
    const v = this.bv;
    document.querySelectorAll('[data-btab]').forEach((b) => b.classList.toggle('on', b.dataset.btab === v.tab));
    for (const [id, k] of [['bagSort', 'sort'], ['bagSlot', 'slot'], ['bagRar', 'rarity'], ['bagSet', 'set'], ['bagText', 'text']]) { const e = $(id); if (e && e.value !== v[k]) e.value = v[k]; }
    const c = $('bagClear'); if (c) c.classList.toggle('on', filtered(v));
    document.querySelectorAll('.slot.eq').forEach((el) => el.classList.toggle('pick', !!v.pick && el.dataset.eq === v.pick));
    const bp = $('bagPick'); if (bp) { bp.classList.toggle('hidden', !v.pick); const n = bp.querySelector('b'); if (n) n.textContent = v.pick ? pickLabel(v.pick) : ''; }
    if (v.pick) document.querySelectorAll('[data-btab]').forEach((b) => b.classList.remove('on'));
    const mats = !v.pick && BAG_TAB[v.tab] && BAG_TAB[v.tab].mats, g = $('invGrid'), m = $('bagMats');
    const gr = $('bagRow') || g; if (gr) gr.classList.toggle('hidden', !!mats); if (m) m.classList.toggle('hidden', !mats);
  }
  renderMats() {
    const m = $('bagMats'); if (!m) return;
    const pr = profile.load();
    const html = MAT_IDS.map((k) => `<div class="bm-row" style="--mc:${MATERIALS[k].color}"><i></i><b>${MATERIALS[k].name}</b><span>${(pr.mats[k] | 0).toLocaleString('en-US')}</span></div>`).join('') + `<div class="bm-row gold"><i></i><b>Gold</b><span>${(pr.gold | 0).toLocaleString('en-US')}</span></div>`;
    if (m.innerHTML !== html) m.innerHTML = html;
  }
  takeAll() { if (this.currentBag) this.cmd({ type: 'takeAll', bagId: this.currentBag.id }); }
  /** the inventory is the hub's Character tab now (step 2) */
  toggleInventory(v) {
    const H = this.game.menuHub, on = H && H.isOpen() && H.tab === 'character';
    const want = v ?? !on;
    if (H) { if (want) H.open('character'); else if (on) H.close(); return; }
    this.invOpen = want; const inv = $('inventory'); if (inv) inv.classList.toggle('hidden', !want); this.lastSig = ''; if (!want) this.hideTip();
  }

  showTip(item, e, compare) {
    if (!item) return;
    const R = RARITIES[item.rarity];
    const p = this.player();
    const ico = uiOn() ? iconStyle(itemIconKey(item), 40) : '';
    let html = `${ico ? `<span class="tt-icon" style="float:left;margin:2px 8px 2px 0;${ico}"></span>` : ''}<div class="nm" style="color:${R.color}">${item.lock ? '🔒 ' : ''}${itemName(item)}</div><div class="sub">${tipSub(item, R, item.cls && CLASSES[item.cls].name) || itemSubLine(item, item.cls && CLASSES[item.cls].name)}</div>`;
    if (item.slot !== 'sigil') html += statLines(item); // gear expansion: ◆ main stat, · sub-stats
    html += tipExtra(item, p);
    if (item.slot !== 'sigil') { // horde pass 2: what the Forge makes of it (salvage value, the next ascension) and what you own
      const pr = profile.load(), sv = salvageValue(item), ac = ascendCost(item), mat = (k, n) => `<span style="color:${MATERIALS[k].color}">${n} ${MATERIALS[k].name}</span> <i style="opacity:.6">(${pr.mats[k] | 0})</i>`;
      if (sv) html += `<div class="cmp" style="opacity:.85">Salvage: ${sv.gold}g · ${Object.entries(sv.mats).map(([k, n]) => mat(k, n)).join(', ')}</div>`;
      if (ac) html += `<div class="cmp" style="opacity:.85">Ascend → tier ${ac.tier} (hero Lv ${ac.lv}): ${ac.gold}g · ${Object.entries(ac.mats).map(([k, n]) => mat(k, n)).join(', ')} + a ${item.slot} catalyst</div>`;
    }
    this.tooltip.dataset.r = item.rarity | 0; // (tier border: Set / Trial / Extreme)
    if (item.slot === 'sigil') { /* key item */ } else if (compare) html += compareBlock(item, p); // vs the piece it would replace (rings: the free / weaker ring)
    else html += `<div class="cmp">Power ${itemPower(item)} · click to unequip</div>`;
    if (item.slot !== 'sigil') html += `<div class="cmp tt-lock">${item.lock ? '🔒 Locked: never salvaged, sold, dropped or auto-salvaged · Ctrl+click to unlock' : 'Ctrl+click to lock'}</div>`; // step 4
    this.tooltip.innerHTML = html;
    this.tooltip.classList.remove('hidden');
    this.placeTip(e);
  }
  placeTip(e) { // (gear expansion: taller tips - sub-stats, set progress, compare - so clamp by the real size, flip left near the edge)
    const t = this.tooltip, w = t.offsetWidth || 250, h = t.offsetHeight || 200;
    const x = e.clientX + 16 + w > innerWidth - 4 ? e.clientX - 16 - w : e.clientX + 16;
    t.style.left = Math.max(4, x) + 'px'; t.style.top = Math.max(4, Math.min(innerHeight - h - 4, e.clientY + 10)) + 'px';
  }
  hideTip() { this.tooltip.classList.add('hidden'); }

  update() {
    const p = this.player(), sim = this.game.sim;
    // inventory panel
    if (this.invOpen) {
      const sig = JSON.stringify([p.inventory.map((i) => i && i.uid + (i.lock ? '!' : '')), Object.values(p.equipment).map((i) => i && i.uid + (i.lock ? '!' : '')), p.level, uiOn() ? UIP.epoch : -1, this.bv]); // (painted icons: redraw once the sheet lands / on a style flip; step 4: locks + the bag view)
      if (BAG_TAB[this.bv.tab].mats && !this.bv.pick) this.renderMats();
      if (sig !== this.lastSig) {
        this.lastSig = sig;
        const cmp = (it) => compareTarget(p, it);
        this.view = bagView(p.inventory, this.bv, { cls: p.cls }); const pc0 = $('bagPickN'); if (pc0) pc0.textContent = this.bv.pick ? `${this.view.length} item${this.view.length === 1 ? '' : 's'}` : ''; this.ensureCells(p.inventory.length);
        const bagCells = document.querySelectorAll('#invGrid .slot');
        bagCells.forEach((el, k) => { const i = k < this.view.length ? this.view[k] : -1; el.classList.toggle('vh', i < 0 && (this.bv.tab !== 'all' || filtered(this.bv))); el.classList.toggle('vx', i < 0 && (this.bv.tab !== 'all' || filtered(this.bv)) && k >= Math.max(this.view.length, 16)); slotEl(el, i >= 0 ? p.inventory[i] : null, (it) => (it.cls && it.cls !== p.cls ? { stats: { atk: 1e9 } } : cmp(it))); });
        if (this.syncBagRow) requestAnimationFrame(this.syncBagRow);
        const cnt = $('bagCount'); if (cnt) { const pr = profile.load(); cnt.textContent = `${bagHeader(p.inventory, pr)}${this.bv.tab !== 'all' || filtered(this.bv) ? ` · showing ${this.view.length}` : ''}`; cnt.title = bagBreakdown(pr); } // (inventory pass: "23/64 — +4 at Account Lv 5")
        document.querySelectorAll('.slot.eq').forEach((el) => slotEl(el, p.equipment[el.dataset.eq]));
        const s = p.stats;
        const pc = (v) => ((v || 0) * 100).toFixed(1) + '%';
        const rows = [['Max HP', s.maxHp], [CLASSES[p.cls].resource, s.maxRes], ['Attack', s.atk], ['Defense', s.def], ['Crit Chance', (s.crit * 100).toFixed(1) + '%'], ['Crit Damage', (s.critDmg * 100).toFixed(0) + '%'], ['Move Speed', (s.spd * 100).toFixed(0) + '%'], ['HP Regen', s.hpRegen.toFixed(1) + '/s']];
        for (const [k, l] of [['atkPct', 'Attack %'], ['chainDmg', 'Chain Damage'], ['spDmg', 'Special Damage'], ['ultCharge', 'Ult Charge'], ['matFind', 'Material Find'], ['goldFind', 'Gold Find']]) if (s[k]) rows.push([l, '+' + pc(s[k])]); // (gear expansion sub-stats, when you have any)
        rows.push(['Kills', p.kills], ['Best Combo', p.bestCombo], ['Gold', profile.load().gold]);
        $('statList').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
      }
    }
    if (this.touch) return; // (phone: mobile/js/mui.js draws the loot panel + death screen)
    // loot panel when standing on an owned bag
    let bag = null, bd = 60;
    for (const b of sim.bags) { if (b.ownerId !== p.id) continue; const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < bd) { bd = d; bag = b; } }
    this.currentBag = p.dead ? null : bag;
    const lp = $('lootPanel');
    if (!this.currentBag) { if (!lp.classList.contains('hidden')) { lp.classList.add('hidden'); this.hideTip(); } this.lootSig = ''; }
    else {
      const sig = bag.id + ':' + bag.items.map((i) => i.uid).join(',') + (uiOn() ? ':' + UIP.epoch : '');
      if (sig !== this.lootSig) {
        this.lootSig = sig;
        lp.classList.remove('hidden');
        $('lootTitle').textContent = bagTitle(bag.rarity);
        $('lootTitle').style.color = (RARITIES[bag.rarity] || RARITIES[0]).color;
        const g = $('lootGrid'); g.innerHTML = '';
        bag.items.forEach((it, i) => {
          const d = document.createElement('div'); d.className = 'slot';
          slotEl(d, it, (x) => compareTarget(p, x));
          d.onclick = () => { this.cmd({ type: 'take', bagId: bag.id, idx: i }); this.hideTip(); };
          d.onmouseenter = (e) => this.showTip(it, e, true);
          d.onmouseleave = () => this.hideTip();
          g.appendChild(d);
        });
      }
    }
    // death overlay
    const dz = $('death');
    if (p.dead && !(sim.astrael && sim.astrael.st === 'wipe') && !(sim.trial && sim.trial.st === 'wipe')) { // the Astrael wipe screen replaces the death overlay
      dz.classList.remove('hidden');
      const secs = Math.max(0, (p.respawnAt - sim.tick) / 60);
      $('deathTimer').textContent = sim.practice ? `Practice: phase ${sim.practice.ph} restarts in a moment (nothing lost)` : inTrialArea(p.x, p.y) ? 'Fallen in the trial: you rise again when the next phase begins (or on the retry after a wipe)' : (p.astHold || (sim.astrael && Math.abs(p.x - AST_POS.x) < 900 && Math.abs(p.y) < 900)) ? 'Fallen among the stars: you rise again when the next act begins (or after a wipe)' : `Respawning ${respawnWhere(p)} in ${secs.toFixed(1)}s`;
    } else dz.classList.add('hidden');
  }
  onDeath(ev) {
    $('deathBy').textContent = `Slain by ${ev.by}`;
    $('deathLost').textContent = 'You keep all your gear: nothing is dropped on death.';
  }
  destroy() { if (this.touch) { this.hideTip(); return; } $('ui').classList.add('hidden'); if ($('inventory')) $('inventory').classList.add('hidden'); $('lootPanel').classList.add('hidden'); $('death').classList.add('hidden'); if ($('pause')) $('pause').classList.add('hidden'); this.hideTip(); }
}
