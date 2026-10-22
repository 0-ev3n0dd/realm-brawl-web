// Mobile DOM panels: loot bag, inventory/equipment, tap-to-inspect item sheet, death overlay.
// Like the desktop UI it never mutates the sim, it only issues sim commands.
import { RARITIES } from '../../js/sim/data/items.js';
import { itemPower } from '../../js/sim/loot.js';
import { CLASSES } from '../../js/sim/data/classes.js';
import { tipSub, tipExtra, bagTitle, respawnWhere } from '../../js/client/settip.js';
import { drawItemIcon } from '../../js/client/art.js';
import { statLines, compareBlock, itemSubLine, setPanel } from '../../js/client/geartip.js';
import { compareTarget } from '../../js/sim/gear.js';
import { bagHeader } from '../../js/client/bagui.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const iconCache = new Map();
function slotEl(el, item, better) {
  el.querySelectorAll('canvas,.up,.lk').forEach((n) => n.remove());
  el.className = el.className.replace(/\br\d\b/g, '').trim();
  if (!item) return;
  el.classList.add('r' + item.rarity);
  if (item.lock) { const k = document.createElement('span'); k.className = 'lk'; k.textContent = '🔒'; el.appendChild(k); } // step 4: locked
  const c = document.createElement('canvas');
  c.width = c.height = 88;
  const g = c.getContext('2d');
  let src = iconCache.get(item.uid);
  if (!src) { src = document.createElement('canvas'); src.width = src.height = 88; drawItemIcon(src.getContext('2d'), item, 88); iconCache.set(item.uid, src); if (iconCache.size > 200) iconCache.delete(iconCache.keys().next().value); }
  g.drawImage(src, 0, 0);
  el.prepend(c);
  if (better) { const u = document.createElement('span'); u.className = 'up'; u.textContent = '▲'; el.appendChild(u); }
}

export class MobileUI {
  constructor(game) {
    this.game = game;
    this.invOpen = false;
    this.lastSig = ''; this.lootSig = '';
    this.currentBag = null;
    this.sheetFor = null;
    this.seenInv = new Set();
    $('ui').classList.remove('hidden');
    // parity pass (2026-10-07): the inventory is the PC menu hub (client/menuhub.js: Character / Stash / World Map / Forge /
    // Chains / Collection / Options); its bag + gear slots are driven by the PC bag UI in touch mode (client/ui.js), and a
    // tap opens this file's inspect sheet (Equip / Lock / Drop · Unequip on a long-pressed gear slot).
    $('takeAll').onclick = () => this.takeAll();
    $('btnInv').onclick = () => this.toggleInventory();
    $('btnPause').onclick = () => game.setPaused(true); // (the menu hub on Options: there is no pause menu any more)
    // the item sheet lives on <body>, not in #ui: #ui is position:fixed, i.e. its own stacking context at z 0, so the sheet's
    // z-index could never lift it over the menu hub (z 40) - it opened invisible BEHIND the hub and every tap on its Equip /
    // Unequip / Lock / Drop buttons landed on the bag underneath (bug 2026-10-07: "unable to equip items on mobile")
    if ($('sheet').parentElement !== document.body) document.body.appendChild($('sheet'));
    $('sheet').onclick = (e) => { if (e.target === $('sheet') && (this.downAt || 0) > (this.sheetAt || 0)) this.closeSheet(); }; // (not the click that ends the long-press which opened it: that touch began before the sheet)
    document.addEventListener('pointerdown', () => { this.downAt = performance.now(); }, true);
    for (const it of this.player().inventory) if (it) this.seenInv.add(it.uid);
  }
  player() { return this.game.player; }
  cmd(c) { this.game.command(c); this.lastSig = ''; this.lootSig = ''; if (this.bag) this.bag.lastSig = ''; }
  showTip() { /* (the hub's hover tooltips: the phone uses the tap sheet) */ }
  get hub() { return this.game.menuHub; }
  get bag() { return this.game.hubBag; }
  // (the hub talks to game.ui: pass the bag bits through)
  clearPick() { return this.bag ? this.bag.clearPick() : false; }
  hideTip() { if (this.bag) this.bag.hideTip(); }
  flash(m) { if (this.bag) this.bag.flash(m); else this.toast(m, 1800); }
  takeAll() { if (this.currentBag) this.cmd({ type: 'takeAll', bagId: this.currentBag.id }); }
  get invOpen() { return !!(this.hub && this.hub.isOpen()); }
  set invOpen(v) { if (this.bag) { this.bag.invOpen = !!v; this.bag.lastSig = ''; } }
  toggleInventory(v, tab = 'character') {
    const H = this.hub; if (!H) return;
    const want = v ?? !(H.isOpen());
    if (want) { for (const it of this.player().inventory) if (it) this.seenInv.add(it.uid); $('invBadge').classList.add('hidden'); H.open(tab); }
    else { this.closeSheet(); if (H.isOpen()) H.close(); }
    this.game.onMenuChange();
  }
  isBetter(it) {
    const p = this.player();
    if (it.cls && it.cls !== p.cls) return false;
    return itemPower(it) > itemPower(compareTarget(p, it));
  }

  /** Tap-to-inspect: item details + the actions that make sense where it is. */
  inspect(ref) {
    const p = this.player(), item = ref.item;
    const R = RARITIES[item.rarity];
    let html = `<div class="nm" style="color:${R.color}">${esc(item.name)}</div><div class="sub">${tipSub(item, R, item.cls && CLASSES[item.cls].name) || itemSubLine(item, item.cls && CLASSES[item.cls].name)}</div>`;
    if (item.slot !== 'sigil') html += statLines(item); // gear expansion: ◆ main stat, · sub-stats
    html += tipExtra(item, p);
    if ($('sheetBody')) $('sheetBody').dataset.r = item.rarity | 0; // (tier border: Set / Trial / Extreme)
    const wrongCls = item.cls && item.cls !== p.cls;
    if (item.slot === 'sigil') { /* key item: no power line */ } else if (ref.where !== 'eq') {
      if (!wrongCls) html += compareBlock(item, p); // vs the piece it would replace (rings: the free / weaker ring)
      if (wrongCls) html += `<div class="cmp" style="color:#ff7a7a">${CLASSES[item.cls].name} only - you cannot equip it</div>`;
    } else html += `<div class="cmp">Power ${itemPower(item)} · equipped</div>`;
    $('sheetBody').innerHTML = html;
    const btns = $('sheetBtns'); btns.innerHTML = '';
    const add = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn small ' + cls; b.textContent = label; b.onclick = () => { fn(); this.closeSheet(); }; btns.appendChild(b); };
    const lockBtn = () => { if (item.slot !== 'sigil') add(item.lock ? '🔓 Unlock' : '🔒 Lock', 'ghost', () => this.cmd(ref.where === 'eq' ? { type: 'lock', at: 'eq', slot: ref.slot, on: item.lock ? 0 : 1 } : { type: 'lock', at: 'inv', idx: ref.idx, on: item.lock ? 0 : 1 })); }; // step 4
    if (ref.where === 'inv') {
      if (!wrongCls && item.slot !== 'sigil') add('Equip', '', () => this.cmd({ type: 'equip', idx: ref.idx }));
      lockBtn();
      if (!item.lock) add('Drop', 'danger', () => this.cmd({ type: 'drop', idx: ref.idx }));
    } else if (ref.where === 'eq') {
      add('Unequip', 'ghost', () => this.cmd({ type: 'unequip', slot: ref.slot }));
      lockBtn();
    } else if (ref.where === 'bag') {
      add('Take', '', () => this.cmd({ type: 'take', bagId: ref.bagId, idx: ref.idx }));
      if (!wrongCls) add('Take & Equip', '', () => this.takeAndEquip(ref));
    }
    add('Close', 'ghost', () => {});
    this.sheetFor = ref; this.sheetAt = performance.now();
    $('sheet').classList.remove('hidden');
    this.game.onMenuChange();
  }
  closeSheet() { this.sheetFor = null; $('sheet').classList.add('hidden'); this.game.onMenuChange(); }
  /** Take from the bag, then equip that item from wherever it landed (next tick). */
  takeAndEquip(ref) {
    const uid = ref.item.uid;
    this.cmd({ type: 'take', bagId: ref.bagId, idx: ref.idx });
    this.game.afterTick(() => {
      const idx = this.player().inventory.findIndex((i) => i && i.uid === uid);
      if (idx >= 0) this.cmd({ type: 'equip', idx });
    });
  }
  get modal() { return this.invOpen || !!this.sheetFor; }

  update() {
    const p = this.player(), sim = this.game.sim;
    if (this.invOpen) { if (this.bag) this.bag.update(); } else if (this.bag && this.bag.invOpen) this.bag.invOpen = false;
    if (!this.invOpen) {
      // red dot on the bag button when there is something new (and better) in the inventory
      let fresh = false;
      for (const it of p.inventory) if (it && !this.seenInv.has(it.uid)) { fresh = true; break; }
      $('invBadge').classList.toggle('hidden', !fresh);
    }
    // loot panel while standing on one of your bags
    let bag = null, bd = 60;
    for (const b of sim.bags) { if (b.ownerId !== p.id) continue; const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < bd) { bd = d; bag = b; } }
    this.currentBag = p.dead ? null : bag;
    const lp = $('lootPanel');
    if (!this.currentBag) {
      if (!lp.classList.contains('hidden')) { lp.classList.add('hidden'); if (this.sheetFor && this.sheetFor.where === 'bag') this.closeSheet(); }
      this.lootSig = '';
    } else {
      const sig = bag.id + ':' + bag.items.map((i) => i.uid).join(',');
      if (sig !== this.lootSig) {
        this.lootSig = sig;
        lp.classList.remove('hidden');
        $('lootTitle').textContent = bagTitle(bag.rarity);
        $('lootTitle').style.color = (RARITIES[bag.rarity] || RARITIES[0]).color;
        const g = $('lootGrid'); g.innerHTML = '';
        bag.items.forEach((it, i) => {
          const d = document.createElement('button'); d.className = 'slot';
          slotEl(d, it, this.isBetter(it));
          d.onclick = () => this.inspect({ where: 'bag', bagId: bag.id, idx: i, item: it });
          g.appendChild(d);
        });
      }
    }
    const dz = $('death');
    if (p.dead && !(sim.astrael && sim.astrael.st === 'wipe')) { // the Astrael wipe screen replaces the death overlay
      dz.classList.remove('hidden');
      $('deathTimer').textContent = sim.practice ? `Practice: phase ${sim.practice.ph} restarts in a moment (nothing lost)` : (p.astHold || (sim.astrael && Math.abs(p.x - 4800) < 900 && Math.abs(p.y) < 900)) ? 'Fallen among the stars: you rise at the next act' : `Respawning ${respawnWhere(p)} in ${Math.max(0, (p.respawnAt - sim.tick) / 60).toFixed(1)}s`;
    } else dz.classList.add('hidden');
  }
  onDeath(ev) {
    if (this.invOpen) this.toggleInventory(false);
    this.closeSheet();
    $('deathBy').textContent = `Slain by ${ev.by}`;
    $('deathLost').textContent = 'You keep all your gear: nothing is dropped on death.';
  }
  loMsg(t) { this.toast(t, 1600); }
  /** step 4: the sim's loadout events (a field swap needs its cast: close the inventory so the world runs) */
  onLoadout(ev) {
    const L = { combat: 'in combat', boss: 'a boss is near', encounter: 'not during an encounter', bag: 'bag full', empty: 'empty preset', busy: 'already swapping', dead: 'you are down' };
    if (ev.ph === 'saved') this.loMsg(`Saved ${ev.name}`);
    else if (ev.ph === 'swap') { this.loMsg(`${ev.name} equipped`); this.toast(`⇄ ${ev.name}`, 1200); }
    else if (ev.ph === 'cast') { this.toggleInventory(false); this.toast(`Swapping to ${ev.name}…`, 1300); }
    else if (ev.ph === 'fail' || ev.ph === 'cancel') { const t = `Swap ${ev.ph === 'fail' ? 'blocked' : 'cancelled'}: ${L[ev.why] || ev.why}`; this.loMsg(t); if (!this.invOpen) this.toast(t, 1400); }
    this.lastSig = '';
  }
  toast(text, ms = 2500) { const t = $('toast'); t.textContent = text; t.classList.remove('hidden'); clearTimeout(this.toastT); this.toastT = setTimeout(() => t.classList.add('hidden'), ms); }
  destroy() {
    for (const id of ['ui', 'lootPanel', 'death', 'sheet', 'toast']) if ($(id)) $(id).classList.add('hidden');
    if (this.hub && this.hub.isOpen()) this.hub.close(); this.sheetFor = null;
  }
}
