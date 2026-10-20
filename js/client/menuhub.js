// The central menu hub (step 2): one full-screen menu, TAB (or I) to open, tabs across the top - Character, World
// Map, Forge, Chains, Collection, Options - Q / E to cycle them (only while open), Esc to close. The old windows are
// folded in rather than copied: the Character tab holds the live inventory slots that client/ui.js already drives
// (.slot.eq / #invGrid / #statList), the World Map tab mounts the Realm Gate map (client/realmmap.js) next to a
// "This Region" view (client/worldmap.js), Forge and Collection mount the Progress panel (client/progressui.js) and
// Options mounts the controls panel (client/options.js). Solo pauses while it is open; co-op keeps running.
// Tab state + key routing live in client/hubtabs.js (unit-tested).
import { HUB_TABS, HUB_KEYS, HubState, GEAR_LAYOUT, LOADOUTS, hubPauses } from './hubtabs.js';
import { CLASSES } from '../sim/data/classes.js';
import { RARITIES } from '../sim/data/items.js';
import { itemPower, mainKeys } from '../sim/loot.js';
import { setPanel, fmtStat, statLabel, setName } from './geartip.js';
import { setOf } from '../sim/sets.js';
import { xpToNext } from '../sim/progression.js';
import { MATERIALS, MAT_IDS, accountLevel, matGrade, itemName, biomeAt } from '../sim/meta.js';
import { chainStepLabel } from './keybinds.js';
import { controlMode } from './kbmode.js';
import { renderFullMap } from './worldmap.js';
import { worldMarkers, townMarkers, pickMarker, drawMarkerTip, MIN_HIT, MIN_HIT_TOUCH } from './mapmarkers.js';
import { siteMarkers } from './bigmap.js';
import { drawTownMinimap } from './townfx.js';
import { tavernOn } from './tavernfx.js';
import { inTownArea, TOWN_POS, TOWN_R } from '../sim/townconst.js';
import { opsIconUrl, iconOf } from './opsicons.js';
import { OPS_TYPE, gateName } from '../sim/opsconst.js';
/** World Map tab legend rows for the mission entrances of a biome */
function opsLegend(world, rg) {
  const L = ((world && world.opsGates) || []).filter((g) => g.biome === rg);
  return L.map((g) => { const I = iconOf(g); return `<div class="hm-leg"><img src="${opsIconUrl(I.icon, I.col, 36)}" style="width:18px;height:18px;vertical-align:middle;margin-right:6px">${g.type === 'boss' ? gateName(g) + ' (boss dungeon)' : OPS_TYPE[g.type].name + ' mission'}</div>`; }).join('');
}
import { drawPlatform, rgba } from './heroshow.js';
import { ShowcaseView, fitScale, elRect, sheetKind, preloadAll } from './heromodel.js';
import { profile, AREAS } from './rewards.js';
import { LoadoutBar } from './hubloadouts.js';
import { StashTab } from './hubstash.js';
import { HeroesTab } from './hubheroes.js';
import { normChainSet, FOCUS, LO } from '../sim/loadout.js';
import { BAG_TABS, BAG_SORTS, SLOT_ORDER, SLOT_NAMES } from './bagview.js';
import { SETS as ALL_SETS } from '../sim/sets.js';
import { bagMatches } from './autosalvage.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const REGION = { wilds: 'The Wilds', dunes: 'Sunscorch Dunes', frost: 'Frostfang Reach', ember: 'Emberfall Caldera' };
const MAP_BIOMES = new Set(Object.keys(REGION));
const SLOT_ICON = { weapon: '⚔', offhand: '🛡', ring1: '◯', ring2: '◯', relic: '✦', helm: '⛑', chest: '▣', gloves: '✋', boots: '👢', amulet: '❖' };

/** The hub's DOM (idempotent; built before client/ui.js binds the inventory slots). */
export function buildHubDom() {
  if ($('hub')) return $('hub');
  const gear = (list, side) => list.map((s) => s.live
    ? `<div class="hg-row" data-side="${side}"><div class="slot eq" data-eq="${s.live}"><span class="lbl">${s.label}</span></div><div class="hg-meta"><b data-gname="${s.live}">${s.label}</b><span data-gsub="${s.live}">Empty</span></div></div>`
    : `<div class="hg-row ph" data-side="${side}" title="New gear slot: coming in the next update"><div class="slot ph"><span class="ph-ico">${SLOT_ICON[s.id] || '✦'}</span><span class="lbl">${s.label}</span></div><div class="hg-meta"><b>${s.label}</b><span>🔒 Coming soon</span></div></div>`).join('');
  const d = document.createElement('div');
  d.id = 'hub'; d.className = 'hub hidden';
  d.innerHTML = `
  <div class="hub-top">
    <div class="hub-brand">MENU</div>
    <span class="hub-kh" data-hubkey="prev">Q</span>
    <div class="hub-tabs">${HUB_TABS.map((t) => `<button class="hub-tab" data-hubtab="${t.id}">${t.label}</button>`).join('')}</div>
    <span class="hub-kh" data-hubkey="next">E</span>
    <div class="hub-wallet" id="hubWallet"></div>
    <button class="btn small x hub-x" id="hubClose" title="Close (Esc)">✕</button>
  </div>
  <div class="hub-body">
    <section class="hub-pane" data-pane="character">
      <div class="hc">
        <div class="hc-left">
          <div class="hc-id" id="hcId"></div>
          <div class="hc-gear">${gear(GEAR_LAYOUT.left, 'l')}</div>
          <div class="hc-sets panel-in"><h3>Set Bonuses</h3><div id="hcSets"></div></div>
        </div>
        <div class="hc-mid">
          <canvas id="hcHero"></canvas>
          <div class="hc-power" id="hcPower"></div>
          <div class="hc-loadouts" id="hcLoadouts"><span class="lo-lbl">Loadouts</span>${Array.from({ length: LOADOUTS }, (_, i) => `<button class="lo-btn" data-lo="${i}">${i + 1}</button>`).join('')}</div>
        </div>
        <div class="hc-right">
          <div class="hc-gear">${gear(GEAR_LAYOUT.right, 'r')}</div>
          <div class="hc-stats panel-in"><h3>Stats</h3><div id="statList" class="stats"></div></div>
        </div>
      </div>
      <div class="hc-bag panel-in">
        <div class="bag-head"><h3>Bag <span class="dim" id="bagCount"></span></h3>
          <div class="bag-tabs">${BAG_TABS.map((t) => `<button class="tab" data-btab="${t.id}">${t.label}</button>`).join('')}</div>
          <div class="bag-ctl"><label>Sort <select id="bagSort">${BAG_SORTS.map((o) => `<option value="${o.id}">${o.label}</option>`).join('')}</select></label>
            <select id="bagSlot" title="Filter: slot"><option value="">Any slot</option>${SLOT_ORDER.map((k) => `<option value="${k}">${SLOT_NAMES[k]}</option>`).join('')}</select>
            <select id="bagRar" title="Filter: rarity"><option value="">Any rarity</option>${RARITIES.map((r, i) => (i === 5 ? '' : `<option value="${i}">${r.name}</option>`)).join('')}</select>
            <select id="bagSet" title="Filter: set"><option value="">Any set</option><option value="*">Set pieces</option><option value="-">Not a set piece</option>${Object.values(ALL_SETS).map((x) => `<option value="${x.id}">${x.short || x.name}</option>`).join('')}</select>
            <input id="bagText" placeholder="sub-stat contains…" spellcheck="false" title="Filter: a stat name (crit, attack %, gold…)"><button class="btn small ghost" id="bagClear" title="Clear the filters">✕</button><button class="btn small as-btn" id="bagAS" title="Auto-Salvage rules: salvage matching drops on pickup (opens Stash › Auto-Salvage)">♻ Auto-Salvage <em class="as-badge" id="bagASOn">OFF</em></button><button class="btn small as-now-btn hidden" id="bagASNow" title="Salvage every bag item your Auto-Salvage rules match right now (same guards: locked, Trial / Extreme, upgraded / crafted, key items and better-than-worn pieces are kept; undo in Stash › Auto-Salvage)">♻ Salvage matching (<b id="bagASNowN">0</b>)</button><span class="as-now-ask hidden" id="bagASAsk">Salvage <b id="bagASAskN">0</b> into gold + materials? <button class="btn small danger" id="bagASYes">Salvage</button><button class="btn small ghost" id="bagASNo">Cancel</button></span></div>
          <span class="hint">Click: equip · <b>Ctrl+click: 🔒 lock</b> · Right-click: drop · Click a gear slot: its items first · ♻ Auto-Salvage: the button above (Stash tab)</span><span class="bag-pick hidden" id="bagPick" title="Clicked an equipment slot: only the items that fit it, best first. Click the slot again, × or Esc to go back">Showing: <b></b> · <i id="bagPickN"></i> <button class="bp-x" id="bagPickX" aria-label="Clear the slot filter">×</button></span><span class="bag-note" id="bagNote"></span></div>
        <div class="bag-row" id="bagRow"><button class="br-arr l" id="bagL" title="Scroll left" aria-label="Scroll the bag left">‹</button><div id="invGrid" class="grid"></div><button class="br-arr r" id="bagR" title="Scroll right" aria-label="Scroll the bag right">›</button></div><div id="bagMats" class="bag-mats hidden"></div></div>
    </section>
    <section class="hub-pane" data-pane="heroes"><div class="hh" id="hubHeroes"></div></section>
    <section class="hub-pane" data-pane="stash"><div class="hs" id="hubStash"></div></section>
    <section class="hub-pane" data-pane="map">
      <div class="hm-sub"><button class="tab" data-msub="region">This Region</button><button class="tab" data-msub="gate">Realm Gate</button><span class="hint" id="hmHint"></span></div>
      <div class="hm-region" id="hmRegion"><canvas id="hmCanvas"></canvas><div class="hm-side panel-in" id="hmSide"></div></div>
      <div class="hm-gate" id="hmGate"></div>
    </section>
    <section class="hub-pane" data-pane="forge"><div class="hub-mount" id="hubForge"></div></section>
    <section class="hub-pane" data-pane="chains"><div class="hch" id="hubChains"></div></section>
    <section class="hub-pane" data-pane="collection"><div class="hub-mount" id="hubCollection"></div></section>
    <section class="hub-pane" data-pane="options"><div class="hub-mount hub-opts" id="hubOptions"></div></section>
  </div>
  <div class="hub-foot" id="hubFoot"></div>`;
  document.body.appendChild(d);
  return d;
}

export class MenuHub {
  constructor(game, { coop = false } = {}) {
    this.g = game; this.coop = coop; this.state = new HubState(); this.t = 0; this.chainCls = null; this.rot = null;
    this.root = buildHubDom();
    this.loBar = new LoadoutBar(this); this.stash = new StashTab(this); this.heroes = new HeroesTab(this); // step 4: presets + the Stash tab
    if (typeof window !== 'undefined' && typeof document !== 'undefined') setTimeout(() => { try { preloadAll(sheetKind(!!this.g.isMobile), this.g.player && this.g.player.cls); } catch { /* cosmetic */ } }, 2500); // (the showcase models load in the background after start)
    this.root.querySelectorAll('[data-hubtab]').forEach((b) => (b.onclick = () => this.open(b.dataset.hubtab)));
    { const ts = this.root.querySelector('.hub-tabs'); this.tabFade = () => { if (ts) ts.classList.toggle('more-r', ts.scrollLeft + ts.clientWidth < ts.scrollWidth - 2); }; if (ts) ts.addEventListener('scroll', this.tabFade, { passive: true }); }
    this.root.querySelector('[data-hubkey="prev"]').onclick = () => this.cycle(-1);
    this.root.querySelector('[data-hubkey="next"]').onclick = () => this.cycle(1);
    $('hubClose').onclick = () => this.close();
    this.root.querySelectorAll('[data-msub]').forEach((b) => (b.onclick = () => { this.state.sub.map = b.dataset.msub; this.renderMap(); }));
    this.onKey = (e) => this.key(e);
    addEventListener('keydown', this.onKey, { capture: true });
    this.onResize = () => { if (this.isOpen()) this.size(); };
    addEventListener('resize', this.onResize);
  }
  get kb() { return this.g.input && this.g.input.kb; }
  get tab() { return this.state.tab; }
  isOpen() { return this.state.open; }
  /** solo: the sim holds while the hub is up */
  pausing() { return this.state.open && hubPauses(this.coop); }
  player() { return this.g.player; }

  /** capture-phase keys while open (and the openers while closed come through game.handleUiKeys -> route) */
  key(e) {
    if (!this.state.open) return;
    const input = this.g.input;
    if (input && input.capture) return; // Options is rebinding a key
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const code = e.code;
    const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (code === 'Escape') { stop(); if (!e.repeat && !(this.state.tab === 'character' && this.g.ui && this.g.ui.clearPick && this.g.ui.clearPick())) this.close(); return; } // (Esc first clears a gear-slot pick)
    if (code === 'KeyQ' || code === 'KeyE' || code === 'PageUp' || code === 'PageDown') { stop(); if (!e.repeat) this.cycle(code === 'KeyQ' || code === 'PageUp' ? -1 : 1); return; }
    const act = this.kb ? this.kb.actionFor(code) : null;
    if (act && HUB_KEYS[act]) { stop(); if (!e.repeat) this.route(act); return; }
    if (act === 'mute') return; // harmless passthrough
    if (/^Digit[1-7]$/.test(code) && this.state.tab === 'character') { stop(); if (!e.repeat) { const i = +code.slice(5) - 1; if (e.shiftKey) this.loBar.save(i); else this.loBar.use(i); } return; } // step 4: loadout presets (Shift: save)
    if (act) stop(); // combat keys do nothing behind the hub
  }
  /** a keybind action: true when the hub handled it */
  route(action) {
    const was = this.state.tab, r = this.state.key(action);
    if (!r) return false;
    if (r === 'close') this.close();
    else this.open(this.state.tab, action === 'realmMap' ? 'gate' : null, was); // (G: always the Realm Gate map, even out in a region)
    return true;
  }
  cycle(d) { if (!this.state.open) return; const was = this.state.tab; this.state.cycle(d); this.open(this.state.tab, null, was); this.sfx(); }
  sfx() { const a = this.g.audio; if (a && a.play) try { a.play('ui'); } catch { /* */ } }

  open(tab = null, sub = null, was = undefined) {
    const prev = was !== undefined ? was : (this.state.open ? this.state.tab : null);
    const wasOpen = this.root && !this.root.classList.contains('hidden');
    if (this.g.paused) this.g.paused = false; // (the phone's background pause steps aside)
    if (this.g.town && this.g.town.open && this.g.town.hide) this.g.town.hide();
    if (this.g.progress && this.g.progress.isOpen && this.g.progress.isOpen()) this.g.progress.close();
    if (this.g.options && this.g.options.isOpen && this.g.options.isOpen()) this.g.options.close();
    this.state.show(tab, sub);
    if (wasOpen && prev && prev !== this.state.tab) this.leave(prev);
    this.root.classList.remove('hidden'); document.body.classList.add('hub-open');
    if (!wasOpen) { this.t = 0; this.lastT = 0; }
    this.root.querySelectorAll('[data-hubtab]').forEach((b) => { b.classList.toggle('on', b.dataset.hubtab === this.state.tab); if (b.dataset.hubtab === this.state.tab && b.scrollIntoView && b.parentElement && b.parentElement.scrollWidth > b.parentElement.clientWidth) b.scrollIntoView({ inline: 'nearest', block: 'nearest' }); }); if (this.tabFade) this.tabFade(); // (UI pass: on a phone the tab strip scrolls; the open tab - e.g. Options from ❚❚ - is always in view)
    this.root.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('on', p.dataset.pane === this.state.tab));
    if (this.g.ui) { this.g.ui.invOpen = this.state.tab === 'character'; this.g.ui.lastSig = ''; this.g.ui.hideTip && this.g.ui.hideTip(); }
    this.enter(this.state.tab, sub, prev !== this.state.tab || !wasOpen);
    this.foot(); this.wallet(); this.size();
    if (this.g.input) this.g.input.enabled = false;
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.loop(t));
    preloadAll(sheetKind(!!this.g.isMobile), this.g.player && this.g.player.cls); // (showcase models: hero on screen first)
  }
  close() {
    if (!this.root || this.root.classList.contains('hidden')) { this.state.hide(); return; }
    this.leave(this.state.tab);
    if (this.g.ui && this.g.ui.clearPick) this.g.ui.clearPick(); // (a gear-slot pick is for this visit only)
    this.state.hide();
    this.root.classList.add('hidden'); document.body.classList.remove('hub-open');
    if (this.g.ui) { this.g.ui.invOpen = false; this.g.ui.hideTip && this.g.ui.hideTip(); }
    if (this.g.input) { this.g.input.enabled = true; if (this.g.input.keys) this.g.input.keys.clear(); }
    cancelAnimationFrame(this.raf); this.raf = 0;
  }
  toggle(tab) { if (this.state.open && (!tab || tab === this.state.tab)) this.close(); else this.open(tab); }

  // ---- mounting the folded-in windows --------------------------------------------------------------------------------
  enter(tab, sub, fresh) {
    const P = this.g.progress;
    if (tab === 'forge' && P && P.mount) { if (fresh || !P.mounted) P.mount($('hubForge'), ['forge'], 'forge'); }
    else if (tab === 'collection' && P && P.mount) { const s = sub || this.state.sub.collection; if (fresh || !P.mounted || sub) P.mount($('hubCollection'), ['account', 'bounties', 'records', 'journal', 'trophies', 'coll'], s); }
    else if (tab === 'options') this.mountOptions();
    else if (tab === 'map') { if (sub) this.state.sub.map = sub; else if (fresh) this.state.sub.map = this.region() ? 'region' : 'gate'; this.renderMap(); }
    else if (tab === 'chains') this.renderChains();
    else if (tab === 'character') { this.lastGear = ''; this.loBar.sig = ''; }
    else if (tab === 'heroes') { if (sub) this.heroes.sel = sub; else if (fresh) this.heroes.sel = null; this.heroes.enter(); }
    else if (tab === 'stash') { this.stash.dirty(); this.stash.render(sub || this.state.sub.stash || 'stash'); }
  }
  leave(tab) {
    const P = this.g.progress;
    if ((tab === 'forge' || tab === 'collection') && P && P.mounted) { if (tab === 'collection') this.state.sub.collection = P.tab; P.unmount(); }
    if (tab === 'options') this.unmountOptions();
    if (tab === 'map') this.unmountGate();
    if (tab === 'chains' && this.rot) { this.rot.remove(); this.rot = null; }
  }
  mountOptions() {
    const O = this.g.options; if (!O || !O.root) { $('hubOptions').innerHTML = '<p class="dim">Options are not available here.</p>'; return; }
    const box = O.root.querySelector('.options-box') || (this.optBox && this.optBox.isConnected ? this.optBox : null); if (!box) return;
    this.optBox = box; box.classList.add('in-hub'); $('hubOptions').appendChild(box);
    const done = $('optDone'); if (done) { this.optDoneWas = done.onclick; done.textContent = 'Back to game'; done.onclick = () => this.close(); }
    if (O.notice) O.notice(''); if (O.render) O.render();
  }
  unmountOptions() {
    const O = this.g.options, box = this.optBox; if (!O || !box) return;
    if (O.capturing && O.cancel) O.cancel();
    box.classList.remove('in-hub'); O.root.appendChild(box);
    const done = $('optDone'); if (done) { done.textContent = 'Done'; done.onclick = this.optDoneWas || (() => O.close()); }
    this.optBox = null;
  }
  gateMap() { return this.g.town && this.g.town.map && this.g.town.map.root ? this.g.town.map : null; }
  unmountGate() { const rm = this.gateMap(); if (rm && rm.inHub) { rm.hide(); rm.inHub = false; rm.root.classList.remove('in-hub'); document.body.appendChild(rm.root); } }

  // ---- World Map ----------------------------------------------------------------------------------------------------
  region() { const p = this.player(); if (!p) return null; let b = null; try { b = biomeAt(p.x, p.y, AREAS); } catch { b = null; } return MAP_BIOMES.has(b) && this.g.sim && this.g.sim.world && this.g.sim.world.spawners ? b : null; }
  renderMap() {
    const sub = this.state.sub.map || 'gate', rg = this.region();
    this.root.querySelectorAll('[data-msub]').forEach((b) => b.classList.toggle('on', b.dataset.msub === sub));
    $('hmRegion').classList.toggle('hidden', sub !== 'region'); $('hmGate').classList.toggle('hidden', sub !== 'gate');
    { const pp = this.player(), inT = !rg && pp && inTownArea(pp.x, pp.y); $('hmHint').textContent = sub === 'gate' ? (this.g.isMobile ? 'Tap a node, then Travel. The village flag takes you home.' : 'Click a node for its details, then Travel (Realm Gates: host, from town · the village flag: from any open world).') : rg ? `You are in ${REGION[rg]} · ${this.g.isMobile ? 'tap' : 'hover or click'} an icon.` : inT ? `Brightwater Village · ${this.g.isMobile ? 'tap' : 'hover or click'} a spot.` : 'You are not in an open world right now.'; }
    const rm = this.gateMap();
    if (sub === 'gate') {
      if (rm) { if (!rm.inHub) { rm.inHub = true; rm.root.classList.add('in-hub'); $('hmGate').appendChild(rm.root); } rm.show(); }
      else $('hmGate').innerHTML = '<p class="dim">The Realm Gate map opens once you reach Brightwater Village.</p>';
    } else { this.unmountGate(); this.sideSig = ''; this.drawRegion(); }
  }
  /** World Map › This Region: hover an icon = its card, click / tap = pin it (client/mapmarkers.js; 2026-10-09 map-click fix) */
  bindRegion(cv) {
    if (cv._rb) return; cv._rb = 1;
    const pos = (e) => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    cv.addEventListener('pointermove', (e) => { this.rmouse = e.pointerType === 'touch' ? null : pos(e); const m = this.rpick(pos(e), e.pointerType === 'touch'); cv.style.cursor = m ? 'pointer' : 'default'; });
    cv.addEventListener('pointerleave', () => { this.rmouse = null; });
    cv.addEventListener('pointerdown', (e) => { const m = this.rpick(pos(e), e.pointerType === 'touch'); this.rpin = m && !(this.rpin && this.rpin.name === m.name && this.rpin.kind === m.kind && this.rpin.x === m.x) ? m : null; this.drawRegion(); });
  }
  rpick(q, touch) { return this.rtoS && this.rmarks && this.rmarks.length ? pickMarker(this.rmarks, q.x, q.y, this.rtoS, this.rms || 1, touch ? MIN_HIT_TOUCH : MIN_HIT) : null; }
  drawRegion() {
    const cv = $('hmCanvas'); if (!cv || !cv.isConnected || $('hmRegion').classList.contains('hidden')) return;
    this.bindRegion(cv);
    const rg = this.region(), side = $('hmSide'), p = this.player(), sim = this.g.sim;
    const town = !rg && p && sim && inTownArea(p.x, p.y) && !tavernOn(sim);
    const box = cv.parentElement.getBoundingClientRect(), S = Math.max(200, Math.floor(Math.min(box.height - 8, box.width - 300)));
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(S * dpr)) { cv.width = cv.height = Math.round(S * dpr); cv.style.width = cv.style.height = S + 'px'; }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, S);
    this.rmarks = null; this.rtoS = null;
    if (rg) {
      try {
        const M = renderFullMap(g, S, rg, sim.world, sim, p), q = S / M.c.width;
        this.rmarks = worldMarkers(sim, rg, p, siteMarkers(sim, rg)).filter((m) => m.kind !== 'site'); // (this map draws no site diamonds)
        this.rtoS = (wx, wy) => ({ x: (M.c.width / 2 + (wx - M.S.cx) * M.k) * q, y: (M.c.width / 2 + (wy - M.S.cy) * M.k) * q }); this.rms = Math.max(1.3, S / 420);
      } catch { /* map not ready */ }
      g.strokeStyle = '#2b2433'; g.lineWidth = 6; g.strokeRect(3, 3, S - 6, S - 6);
    } else if (town) {
      const others = sim.players ? [...sim.players.values()].filter((q) => q.id !== p.id && !q.dead) : [];
      try { drawTownMinimap(g, S, p, others, this.t || 0); } catch { /* */ }
      const k = S / (TOWN_R * 2 + 120);
      this.rmarks = townMarkers(sim, p); this.rtoS = (wx, wy) => ({ x: S / 2 + (wx - TOWN_POS.x) * k, y: S / 2 + (wy - TOWN_POS.y) * k }); this.rms = Math.max(1, S / 420);
      g.strokeStyle = '#2b2433'; g.lineWidth = 6; g.strokeRect(3, 3, S - 6, S - 6);
    } else {
      g.fillStyle = '#2a2236'; g.fillRect(0, 0, S, S); g.fillStyle = '#cbbfe0'; g.font = '20px "Lilita One", sans-serif'; g.textAlign = 'center';
      g.fillText('No open-world map here', S / 2, S / 2 - 8); g.font = '14px "Trebuchet MS", sans-serif'; g.fillText('Open the Realm Gate tab to see every world.', S / 2, S / 2 + 18);
    }
    if (this.rpin && this.rtoS) { const q = this.rtoS(this.rpin.x, this.rpin.y); drawMarkerTip(g, { ...this.rpin, sx: q.x, sy: q.y }, 0, 0, S, S, true); }
    const hv = this.rmouse ? this.rpick(this.rmouse, false) : null;
    if (hv && !(this.rpin && hv.name === this.rpin.name && hv.kind === this.rpin.kind)) drawMarkerTip(g, hv, 0, 0, S, S, false);
    const sig = (rg || (town ? 'town' : '')) + '|' + (p ? p.level : 0);
    if (side && sig !== this.sideSig) {
      this.sideSig = sig;
      side.innerHTML = rg ? `<h3>${REGION[rg]}</h3>
        <div class="hm-leg"><i class="lg-you"></i>You</div><div class="hm-leg"><i class="lg-boss">☠</i>World boss (grey = down)</div><div class="hm-leg"><i class="lg-elite">♛</i>Elite pack</div><div class="hm-leg"><i class="lg-swarm">✹</i>Swarm event (when active)</div>
        ${opsLegend(sim.world, rg)}
        <p class="dim">${this.g.isMobile ? 'Tap' : 'Hover or click'} an icon on the map for its name. Spawn sites keep sending fodder out; clear the elites and bosses for the rare materials. The mission entrances are always open: walk up and press Interact. The Realm Gate tab travels between worlds.</p>`
        : town ? `<h3>Brightwater Village</h3><p class="dim">${this.g.isMobile ? 'Tap' : 'Hover or click'} a spot on the map to see who is there: Borin (Forge), Dorrik (Quartermaster), the Stash, the Mission Counter, the Co-op and Weekly Boards, Elder Maren, the Training Dummy and the five Realm Gates.</p><p class="dim">The Realm Gate tab picks a mission or world to travel to.</p>`
        : `<h3>Realm Gate</h3><p class="dim">Dungeons, trials and missions have no open-world map. Use the Realm Gate tab to travel.</p>`;
    }
  }

  // ---- Chains ---------------------------------------------------------------------------------------------------------
  renderChains() {
    const p = this.player(), cls = this.chainCls || (p && p.cls) || 'warrior', C = CLASSES[cls], kb = this.kb;
    const lab = (k) => (kb ? chainStepLabel(kb, k) : k);
    const pill = (k) => `<span class="cs">${esc(lab(k))}</span>`;
    const mine = p && p.cls === cls, set = mine ? normChainSet(p.chainSet, cls) : null; // step 4: the chain setup (pins + HUD focus) of your own class, saved in the active loadout
    const pin = (c) => (mine ? `<button class="hch-pin${set.pins.includes(c.id) ? ' on' : ''}" data-pin="${esc(c.id)}" title="${set.pins.includes(c.id) ? 'Unpin from the HUD chain list' : 'Pin to the HUD chain list'}">${set.pins.includes(c.id) ? '★' : '☆'}</button>` : '');
    const chains = (C.chains || []).map((c) => `<div class="hch-card k-${esc(c.kind || 'mob')}${mine && set.pins.includes(c.id) ? ' pinned' : ''}"><div class="hch-top">${pin(c)}<b>${esc(c.name)}</b><span class="hch-kind">${esc(c.kind === 'boss' ? 'Boss' : c.kind === 'mob' ? 'Mob' : (c.kind || 'Chain'))}</span></div><div class="hch-seq">${(c.seq || []).map(pill).join('<i>›</i>')}</div><p>${esc(c.desc || '')}</p></div>`).join('');
    const routes = (C.routes || []).map((r) => `<div class="hch-card route"><div class="hch-top"><b>${esc(r.name)}</b><span class="hch-kind">${esc(r.route === 'boss' ? 'Boss route' : 'Mob route')}</span></div><div class="hch-seq">${(r.seq || []).map(pill).join('<i>›</i>')}</div><p>${esc(r.desc || '')}</p></div>`).join('');
    $('hubChains').innerHTML = `
      <div class="hch-head"><h2 style="color:${C.color}">${esc(C.name)} chains</h2>
        <div class="hch-cls">${Object.keys(CLASSES).map((id) => `<button class="tab${id === cls ? ' on' : ''}" data-ccls="${id}" style="--cc:${CLASSES[id].color}">${esc(CLASSES[id].name)}</button>`).join('')}</div></div>
      <div class="hch-acts"><button class="btn small" id="hchRotMob">▶ Watch the optimized mob rotation</button><button class="btn small" id="hchRotBoss">▶ Boss rotation</button><a class="btn small ghost" href="/realm-brawl-web/rotations.html?cls=${cls}" target="_blank" rel="noopener">Open the Rotations page ↗</a><span class="hint">In combat: ${esc(kb ? kb.label('combos') : 'C')} shows this list on the HUD.</span></div>
      ${mine ? `<div class="hch-setup"><b>Chain setup</b><span>HUD list shows</span>${FOCUS.map((f) => `<button class="tab${set.focus === f ? ' on' : ''}" data-focus="${f}">${f === 'all' ? 'All chains' : f === 'mob' ? 'Mob chains' : 'Boss chains'}</button>`).join('')}<span class="hint">${set.pins.length ? `★ ${set.pins.length} pinned (pins win over the filter, max ${LO.pinMax})` : '☆ pin chains to list only those'} · saved with your active loadout${p.lo >= 0 && p.loadouts && p.loadouts[p.lo] ? ` (${esc(p.loadouts[p.lo].n)})` : ''}</span>${set.pins.length ? '<button class="btn small ghost" id="hchUnpin">Clear pins</button>' : ''}</div>` : ''}
      <div class="hch-rot hidden" id="hchRot"></div>
      ${routes ? `<h3>Finisher routes</h3><div class="hch-grid">${routes}</div>` : ''}
      <h3>Chains</h3><div class="hch-grid">${chains || '<p class="dim">No chains for this class yet.</p>'}</div>`;
    $('hubChains').querySelectorAll('[data-ccls]').forEach((b) => (b.onclick = () => { this.chainCls = b.dataset.ccls; if (this.rot) { this.rot.remove(); this.rot = null; } this.renderChains(); }));
    const embed = (view) => { const box = $('hchRot'); box.classList.remove('hidden'); box.innerHTML = ''; const f = document.createElement('iframe'); f.src = `/realm-brawl-web/rotations.html?cls=${cls}&view=${view}&embed=1`; f.title = 'Optimized rotation'; box.appendChild(f); this.rot = f; };
    $('hchRotMob').onclick = () => embed('mob'); $('hchRotBoss').onclick = () => embed('boss');
    if (mine) {
      const send = (next) => { if (set && set.alt === 1) next = { ...next, alt: 1 }; this.g.command({ type: 'chainSet', pins: next.pins, focus: next.focus, ...(next.alt === 1 ? { alt: 1 } : {}) }); p.chainSet = normChainSet(next, cls); this.renderChains(); }; // (optimistic: the sim / server echo it back)
      $('hubChains').querySelectorAll('[data-pin]').forEach((b) => (b.onclick = () => { const id = b.dataset.pin, pins = set.pins.includes(id) ? set.pins.filter((x) => x !== id) : [...set.pins, id].slice(0, LO.pinMax); send({ pins, focus: set.focus }); }));
      $('hubChains').querySelectorAll('[data-focus]').forEach((b) => (b.onclick = () => send({ pins: set.pins, focus: b.dataset.focus })));
      const un = $('hchUnpin'); if (un) un.onclick = () => send({ pins: [], focus: set.focus });
    }
  }

  // ---- Character ------------------------------------------------------------------------------------------------------
  renderCharacter() {
    const p = this.player(); if (!p) return;
    const C = CLASSES[p.cls] || {}, eq = p.equipment || {};
    const sig = JSON.stringify([p.level, p.xp | 0, p.name, GEAR_LAYOUT.left.concat(GEAR_LAYOUT.right).map((s) => s.live && eq[s.live] ? eq[s.live].uid + ':' + (eq[s.live].up | 0) : 0)]);
    if (sig === this.lastGear) return;
    this.lastGear = sig;
    const need = xpToNext(p.level), xp = p.xp | 0, acc = accountLevel(profile.load().accXp);
    $('hcId').innerHTML = `<div class="hc-lv"><span>Lv</span><b>${p.level}</b></div><div class="hc-nm"><b>${esc(p.name || C.name)}</b><span style="color:${C.color}">${esc(C.name || p.cls)}</span>
      <div class="hc-xp"><i style="width:${isFinite(need) ? Math.min(100, (xp / Math.max(1, need)) * 100).toFixed(1) : 100}%"></i></div><small>${isFinite(need) ? `${xp} / ${need} XP` : 'Max level'} · Account Lv ${acc.level}</small></div>`;
    let power = 0;
    for (const s of GEAR_LAYOUT.left.concat(GEAR_LAYOUT.right)) {
      if (!s.live) continue;
      const it = eq[s.live], nm = this.root.querySelector(`[data-gname="${s.live}"]`), sb = this.root.querySelector(`[data-gsub="${s.live}"]`);
      if (it) power += itemPower(it);
      if (nm) { nm.textContent = it ? itemName(it) : s.label; nm.style.color = it ? RARITIES[it.rarity].color : ''; }
      if (sb) { const mk = it ? mainKeys(it)[0] : null, sid = it ? setOf(it) : null; sb.textContent = it ? `${mk ? fmtStat(mk, it.stats[mk]) + ' ' + statLabel(mk) : RARITIES[it.rarity].name} · ${itemPower(it)}${it.up ? ` · +${it.up}` : ''}${sid ? ' · ' + setName(sid) : ''}` : 'Empty'; }
    }
    $('hcPower').innerHTML = `<span>Gear Power</span><b>${power}</b>`;
    if ($('hcSets')) $('hcSets').innerHTML = setPanel(p); // gear expansion: live 2- / 4-piece bonuses
  }
  wallet() {
    const pr = profile.load(), mats = pr.mats || {};
    const top = MAT_IDS.filter((k) => (mats[k] | 0) > 0 && !MATERIALS[k].token).sort((a, b) => (matGrade(b) === 'Boss') - (matGrade(a) === 'Boss') || (mats[b] | 0) - (mats[a] | 0)).slice(0, 3);
    $('hubWallet').innerHTML = `<span class="hw gold" title="Gold"><i class="coin"></i>${(pr.gold | 0).toLocaleString()}</span>` + top.map((k) => `<span class="hw" title="${esc(MATERIALS[k].name)}"><i class="gem" style="background:${MATERIALS[k].color}"></i>${mats[k] | 0}</span>`).join('');
  }
  foot() {
    const L = (id, d) => (this.kb ? this.kb.label(id) : d);
    const hint = [...this.root.querySelectorAll('.hint')].find((h) => /: equip/.test(h.textContent)); if (hint) hint.innerHTML = this.g.isMobile ? 'Tap an item: equip / 🔒 lock / drop · Tap a gear slot: its items first · Hold a gear slot: unequip' : controlMode.keyboard ? 'Arrows: pick · <b>Enter: equip</b> · Del: drop · Enter on a gear slot: its items first (Del: unequip) · ♻ Auto-Salvage: the button above' : 'Click: equip · <b>Ctrl+click: 🔒 lock</b> · Right-click: drop · Click a gear slot: its items first (right-click: unequip) · ♻ Auto-Salvage: the button above';
    this.asBadge();
    if (this.kb && !this._kbSub) this._kbSub = this.kb.onChange(() => { if (this.isOpen()) this.foot(); }); // (a rebind / Control mode switch from the Options tab)
    const tabKey = { character: L('inventory', 'I'), map: L('realmMap', 'G'), forge: L('forge', 'U'), collection: L('progress', 'P'), chains: L('combos', 'C') };
    const extra = controlMode.keyboard ? `<span><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> move</span><span><kbd>Enter</kbd> ${this.state.tab === 'character' ? 'equip · gear slot: its items first' : this.state.tab === 'stash' ? 'bag ⇄ stash' : this.state.tab === 'heroes' ? 'pick a hero · again: Use' : 'select'}</span>${this.state.tab === 'character' ? '<span><kbd>Del</kbd> drop / unequip</span>' : ''}` : this.state.tab === 'character' ? '<span><kbd>Click</kbd> equip / gear slot: sort</span><span><kbd>Right-click</kbd> unequip</span><span><kbd>Ctrl</kbd>+<kbd>Click</kbd> lock</span><span><kbd>1</kbd>–<kbd>7</kbd> loadout · <kbd>Shift</kbd> save</span>' : this.state.tab === 'stash' ? '<span><kbd>Click</kbd> / drag: bag ⇄ stash</span>' : this.state.tab === 'heroes' ? '<span><kbd>Click</kbd> pick a hero</span><span><kbd>Double-click</kbd> / Use: swap now</span>' : '';
    $('hubFoot').innerHTML = `<span><kbd>Q</kbd><kbd>E</kbd> switch tab</span>${Object.entries(tabKey).map(([t, k]) => `<span><kbd>${esc(k)}</kbd> ${HUB_TABS.find((x) => x.id === t).label}</span>`).join('')}${extra}<span><kbd>Esc</kbd> back to game</span>${this.coop ? '<span class="live">● Co-op: the world keeps running</span>' : '<span class="paused">❚❚ Game paused</span>'}`;
  }
  /** fit a canvas's backing store to its on-screen size × DPR (no-op when unchanged or hidden) */
  sizeCv(cv) {
    if (!cv) return; const w = cv.clientWidth, h = cv.clientHeight; if (!(w > 0 && h > 0)) return;
    const dpr = Math.min(this.g.isMobile ? 1.5 : 2, devicePixelRatio || 1), bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; this._cfitKey = ''; }
  }
  size() {
    if (this.heroes) this.heroes.size();
    const cv = $('hcHero'); if (!cv) return;
    const r = cv.getBoundingClientRect(), dpr = Math.min(this.g.isMobile ? 1.5 : 2, devicePixelRatio || 1);
    if (r.width > 0 && (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr))) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  }
  drawHeroCanvas() {
    // (charpreview fix: size the backing store to the element every frame. It used to be sized only when the hub opened;
    //  opened on another tab the canvas was hidden then, kept its default 300x150 and CSS stretched it into a smeared strip)
    this.sizeCv($('hcHero'));
    const cv = $('hcHero'), p = this.player(); if (!cv || !p || !cv.width || !cv.clientWidth) return;
    const dpr = cv.width / cv.clientWidth, W = cv.clientWidth, H = cv.clientHeight, g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const col = (CLASSES[p.cls] || {}).color || '#ffd23f', t = this.t;
    // back glow + faint class sigil ring
    const bg = g.createRadialGradient(W / 2, H * 0.48, 10, W / 2, H * 0.48, Math.max(W, H) * 0.6);
    bg.addColorStop(0, rgba(col, 0.28)); bg.addColorStop(1, rgba(col, 0)); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H * 0.44); g.rotate(t * 0.08); g.strokeStyle = rgba(col, 0.18); g.lineWidth = 3;
    const R = Math.min(W, H) * 0.36; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke(); g.setLineDash([10, 14]); g.beginPath(); g.arc(0, 0, R * 1.12, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.fillStyle = rgba(col, 0.3); g.fillRect(R - 4, -4, 8, 8); }
    g.restore();
    const fy = H * 0.8, pr = Math.min(W * 0.36, H * 0.3);
    drawPlatform(g, W / 2, fy, pr, col, t);
    // motes rising off the platform
    g.save(); for (let i = 0; i < 18; i++) { const u = (t * 0.25 + i * 0.137) % 1, x = W / 2 + Math.sin(i * 12.9 + t * 0.6) * pr * 0.85, y = fy - u * H * 0.6; g.globalAlpha = (1 - u) * 0.7; g.fillStyle = i % 3 ? col : '#fff6d8'; g.beginPath(); g.arc(x, y, 2 + (i % 3), 0, Math.PI * 2); g.fill(); } g.restore();
    // the hero's showcase model (client/heromodel.js idle loop), clear of the gear-power badge; a flourish on a swap
    const kind = sheetKind(!!this.g.isMobile), y = fy - pr * 0.05;
    if (!this.cview) this.cview = new ShowcaseView();
    if (this.cview.cls && this.cview.cls !== p.cls) this.cview.flourish(p.cls, t);
    if (this._cfitKey !== W + 'x' + H) { this._cfitKey = W + 'x' + H; this._cavoid = [elRect($('hcPower'), cv, 6)].filter(Boolean); }
    const k = fitScale([p.cls], { x: W / 2, y, bounds: [4, 4, W - 4, H - 2], avoid: this._cavoid, max: H / 900 });
    this.cview.draw(g, p.cls, { x: W / 2, y, k, t, kind });
  }
  loop(now) {
    this.raf = 0; if (!this.state.open) return;
    const dt = Math.min(0.05, ((now - (this.lastT || now)) / 1000)); this.lastT = now; this.t += dt;
    const tab = this.state.tab;
    if (tab === 'character') { this.renderCharacter(); this.drawHeroCanvas(); this.loBar.render(); this.loBar.tick(); this.asNow(); }
    else if (tab === 'stash') this.stash.render();
    else if (tab === 'heroes') { this.heroes.render(); this.heroes.draw(dt); }
    else if (tab === 'map' && this.state.sub.map === 'region') this.drawRegion();
    if ((this.wt = (this.wt || 0) + dt) > 1) { this.wt = 0; this.wallet(); if (tab === 'options' && this.g.options && this.g.options.syncSession) this.g.options.syncSession(); }
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }
  /** a lock flip / stash change: redraw what shows it */
  onLock() { this.stash.dirty(); if (this.g.ui) this.g.ui.lastSig = ''; }
  stashDirty() { this.stash.dirty(); }
  /** the bag's ♻ Auto-Salvage button (Character tab): ON / OFF badge; it opens Stash › Auto-Salvage */
  asBadge() {
    const b = $('bagAS'), e = $('bagASOn'); if (!b || !e) return;
    const on = !!(profile.load().autoSalvage || {}).on;
    e.textContent = on ? 'ON' : 'OFF'; b.classList.toggle('on', on);
    if (!b.onclick) b.onclick = () => { this.state.sub.stash = 'salvage'; this.open('stash', 'salvage'); };
  }
  /** the bag's '♻ Salvage matching (N)' button (next to ♻ Auto-Salvage): N = bag items the rules match now (the same
   *  guards and path as Stash › Auto-Salvage › 'Salvage matching now': a confirm first, then the undo log); hidden at 0 */
  matchCount() { const p = this.player(), A = this.g.autoSalvage; if (!p || !A) return 0; try { return bagMatches(p.inventory, A.cfg, p).length; } catch { return 0; } }
  asNow(force = false) {
    const b = $('bagASNow'); if (!b) return;
    const sig = JSON.stringify([(this.player() || {}).inventory ? this.player().inventory.map((i) => i && i.uid + (i.lock ? '!' : '')) : 0, JSON.stringify(profile.load().autoSalvage || null)]);
    if (!force && sig === this._asSig) return; this._asSig = sig;
    const n = this.matchCount(), ask = $('bagASAsk');
    // always shown (2026-10-07): greyed at 0 (a tap opens the rules), live with the count otherwise; hidden only while its confirm is up
    b.classList.toggle('hidden', !ask.classList.contains('hidden')); b.classList.toggle('none', n === 0); b.setAttribute('aria-disabled', n === 0 ? 'true' : 'false'); $('bagASNowN').textContent = n;
    b.title = n === 0 ? 'Nothing in your bag matches your Auto-Salvage rules (click to edit the rules)' : `Salvage the ${n} bag item${n > 1 ? 's' : ''} your Auto-Salvage rules match (asks first; undo in Stash › Auto-Salvage)`;
    if (n === 0) ask.classList.add('hidden'); else $('bagASAskN').textContent = `${n} piece${n > 1 ? 's' : ''}`;
    if (!b.onclick) {
      b.onclick = () => { if (!this.matchCount()) { this.state.sub.stash = 'salvage'; this.open('stash', 'salvage'); return; } ask.classList.remove('hidden'); b.classList.add('hidden'); this.asNow(true); };
      $('bagASNo').onclick = () => { ask.classList.add('hidden'); this.asNow(true); };
      $('bagASYes').onclick = () => {
        ask.classList.add('hidden');
        const A = this.g.autoSalvage, n2 = A && A.salvageNow ? A.salvageNow() : 0;
        if (this.g.ui && this.g.ui.flash) this.g.ui.flash(n2 ? `♻ Salvaged ${n2} piece${n2 > 1 ? 's' : ''}: undo in Stash › Auto-Salvage` : 'Nothing to salvage');
        this.stash.dirty(); this._asSig = ''; setTimeout(() => this.asNow(true), 60);
      };
    }
  }
  destroy() {
    this.close(); removeEventListener('keydown', this.onKey, { capture: true }); removeEventListener('resize', this.onResize);
    this.unmountOptions(); this.unmountGate();
  }
}
