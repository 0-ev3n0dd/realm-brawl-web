// Experience pass 3: the village services, client side (solo Game + co-op NetGame).
//   * walk up to a station -> an interact prompt ([X] Borin, Blacksmith); X opens it
//   * Blacksmith -> the Forge (progressui.js: upgrade / craft / salvage), Quartermaster -> buy consumables / sell gear,
//     Stash -> the 40-slot chest every hero in this browser shares, Co-op Board -> see / host / join, ready-up
//   * the Training Dummy is a sim enemy that never dies; its DPS meter card shows while you are close
//   * the pouch chip (bottom left): Health Potions (H) + active elixirs
// Gold, the pouch and the stash live in this browser (rewards.js profile + localStorage); co-op trusts the client for them.
import { DUMMY_DEF, DUMMY_OPTS, normDummy } from '../sim/dummy.js';
const DUMMY_KEY = 'rb.dummy.v1';
import { STATIONS, STATION, nearStation, stationAt, TAP_REACH, salvageValue, sellPrice, CONSUMABLES, CONSUMABLE, POTION, buyConsumable, useConsumable,
  fortuneOn, STASH_KEY, STASH_SIZE, normStash, growStash, stashTabsFor, stashPut, stashPutAny, stashTake, stashFree, stashCount, stashCap, DpsMeter, readyCount, DUMMY_POS } from '../sim/village.js';
import { AutoSalvager } from './autosalvage.js';
import { altarPanel, wireAltar } from './ascendui.js'; // (Part B: the Ascension Altar)
import { inTownArea, hubLayoutOf } from '../sim/townconst.js';
import { MATERIALS, itemName, upStats, accountLevel } from '../sim/meta.js';
import { RARITIES, STAT_LABELS, AFFIXES } from '../sim/data/items.js';
import { CLASSES } from '../sim/data/classes.js';
import { profile } from './rewards.js';
import { shopTier, CHAPTERS } from '../sim/story.js';
import { SAVAGE_STOCK, SAVAGE_PIECE_SLOTS, buySavage, marksOf } from '../sim/savagevendor.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtN = (n) => Math.round(n).toLocaleString('en-US');
const fmtS = (k, v) => { const a = AFFIXES[k]; return a && a.fmt === 'pct' ? `+${(v * 100).toFixed(1)}%` : a && a.fmt === 'dec' ? `+${(+v).toFixed(1)}` : `+${v}`; };
const LS = typeof localStorage !== 'undefined' ? localStorage : null;

export const stash = {
  data: null,
  load() {
    const want = stashTabsFor(accountLevel(profile.load().accXp).level); // (game loop B2: tab 5 at account Lv 27, tab 6 at Lv 30)
    if (this.data) { if (growStash(this.data, want)) this.save(); return this.data; }
    let raw = null; try { raw = LS && JSON.parse(LS.getItem(STASH_KEY) || 'null'); } catch { raw = null; } this.data = normStash(raw, undefined, want); return this.data;
  },
  save() { try { if (LS && this.data) LS.setItem(STASH_KEY, JSON.stringify(this.data)); } catch { /* full / private */ } },
};

const itemTip = (it) => { const us = upStats(it); return Object.keys(it.stats || {}).map((k) => `${fmtS(k, us[k])} ${STAT_LABELS[k] || k}`).join(' · '); };
const itemCard = (it, attrs = '', extra = '') => { const R = RARITIES[it.rarity] || RARITIES[0]; return `<button class="vi-item" style="--rc:${R.color}" title="${esc(itemTip(it))}" ${attrs}><b>${esc(itemName(it))}</b><small>${R.name} ${it.slot}${it.tier ? ` · T${it.tier}` : ''}</small>${extra}</button>`; };

export class VillageUI {
  constructor(game) {
    this.g = game; this.panel = null; this.tab = 'buy'; this.msg = ''; this.pend = new Map(); this.upend = new Map(); this.meter = new DpsMeter(4); this.lastPot = -1e9; this.coop = null;
    this.auto = new AutoSalvager(game, this); game.autoSalvage = this.auto; // step 4: auto-salvage on pickup (client/autosalvage.js)
    if (typeof document === 'undefined') return;
    const mk = (id, cls) => { let d = document.getElementById(id); if (!d) { d = document.createElement('div'); d.id = id; d.className = cls; document.body.appendChild(d); } return d; };
    this.prompt = mk('villagePrompt', 'btn tu-prompt vg-prompt hidden');
    this.prompt.addEventListener('click', (e) => { e.preventDefault(); this.interact(); });
    this.root = mk('village', 'overlay hidden');
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.close(); });
    this.dps = mk('dpsCard', 'vg-dps hidden');
    this.pouch = mk('pouchChip', 'vg-pouch hidden');
    this.onKey = (e) => { if (this.isOpen() && e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); } };
    addEventListener('keydown', this.onKey, { capture: true });
  }
  get pr() { return profile.load(); }
  get layout() { const w = (this.g.sim && this.g.sim.world) || (this.g.view && this.g.view.world); return hubLayoutOf(w); }
  station() { const p = this.g.player; if (!p || p.dead || !inTownArea(p.x, p.y)) return null; const I = this.g.hubInfo ? this.g.hubInfo() : { m: 'town' }; if (I.m && I.m !== 'town') return null; return nearStation(p.x, p.y, this.layout); }
  isOpen() { return !!(this.root && !this.root.classList.contains('hidden')); }
  close() { if (!this.root) return; this.root.classList.add('hidden'); this.panel = null; this.dmAnywhere = false; }
  keyLabel(id, d) { try { return (this.g.input && this.g.input.kb.label(id)) || d; } catch { return d; } }
  /** the interact key: true if a station took it */
  interact() {
    if (this.isOpen()) { this.close(); return true; }
    const s = this.station(); if (!s) return false;
    if (this.g.audio) this.g.audio.play('click');
    const go = () => this.openStation(s);
    if (this.g.story && this.g.story.talk(s.id, go)) return true; // story dialogue first (skippable), then the station
    go(); return true;
  }
  /** phone: a tap on an NPC / object in the world (world point x, y). In reach (or a short walk away: TAP_REACH) it opens
   *  like the Interact key; farther it says to walk closer. true = the tap was on a station. */
  tapAt(x, y) {
    const p = this.g.player; if (!p || p.dead || !inTownArea(p.x, p.y)) return false;
    const I = this.g.hubInfo ? this.g.hubInfo() : { m: 'town' }; if (I.m && I.m !== 'town') return false;
    const s = stationAt(x, y, this.layout); if (!s) return false;
    if (Math.hypot(p.x - s.use.x, p.y - s.use.y) > s.r + TAP_REACH) { this.flash(`Walk up to ${s.name} first`); return true; }
    if (this.g.audio) this.g.audio.play('click');
    const go = () => this.openStation(s);
    if (!(this.g.story && this.g.story.talk(s.id, go))) go();
    return true;
  }
  openStation(s) {
    if (s.id === 'stash' && this.g.menuHub) { if (this.g.audio) this.g.audio.play('chestOpen'); this.g.menuHub.open('stash', 'stash'); return true; } // step 4: the chest opens the hub's Stash tab
    if (s.id === 'smith') { if (this.g.menuHub) this.g.menuHub.open('forge'); else this.g.progress.open('forge'); return true; } // (UI pass: the hub's Forge tab, the same one U opens - not the old Progress window)
    if (s.id === 'weekly') { if (this.g.town && this.g.town.showWeekly) this.g.town.showWeekly(); return true; } // (2026-10-09: its own board on the Guild Square)
    if (s.id === 'elder') { if (this.g.story) this.g.story.talk('elder', null, true); return true; }
    if (s.id === 'dummy') { this.open('dummy'); return true; } // (2026-10-20: the Training Dummy settings menu)
    this.open(s.id); return true;
  }
  open(id) { this.panel = id; this.msg = ''; if (id === 'stash' && this.g.audio) this.g.audio.play('chestOpen'); if (id === 'lobby') this.refreshLobby(); this.root.classList.remove('hidden'); this.render(); }
  flash(msg) { if (this.g.fx && this.g.player) this.g.fx.text(this.g.player.x, this.g.player.y - 70, msg, { size: 16, color: '#ffe9a0', vy: -30, life: 1.6, pop: 1.2 }); }
  say(msg, kind = 'ok') { this.msg = msg; this.msgKind = kind; this.render(); }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    this.auto.update();
    if (!this.prompt) return;
    const s = this.station(), p = this.g.player;
    const busy = this.g.paused || (this.g.story && this.g.story.isOpen()) || this.isOpen() || (this.g.progress && this.g.progress.isOpen()) || (this.g.town && this.g.town.open) || (this.g.rewards && this.g.rewards.isOpen());
    const show = !!s && !busy && !(this.g.town && this.g.town.canInteract && this.g.town.canInteract());
    this.prompt.classList.toggle('hidden', !show);
    if (show) { const mk = this.g.story ? this.g.story.markFor(s.id) : ''; const html = `${this.g.isMobile ? '👆 ' : `<kbd>${esc(this.keyLabel('interact', 'X'))}</kbd>`}${esc(s.name)} <small>${esc(s.id === 'dummy' ? 'settings · DPS meter' : mk === 'ready' ? 'turn in' : mk ? 'talk' : s.title)}</small>`; if (this.prompt.innerHTML !== html) this.prompt.innerHTML = html; }
    if (!this._dmSent && p && this.g.command) { this._dmSent = 1; this.setDummy(this.dcfg, true); } // (the saved Training Dummy settings, once per session)
    if (this.isOpen() && this.panel !== 'lobby' && !(this.panel === 'dummy' && this.dmAnywhere) && !s) this.close(); // walked away
    if (this.isOpen() && this.panel === 'lobby' && (this._lt = (this._lt || 0) + dt) > 2) { this._lt = 0; if (!this.g.net) this.refreshLobby(); else this.render(); }
    // the DPS card near the dummy
    const now = performance.now() / 1000, near = p && Math.hypot(p.x - DUMMY_POS.x, p.y - DUMMY_POS.y) < 520 && this.layout !== 'tavern';
    const showD = near && this.meter.hits > 0;
    this.dps.classList.toggle('hidden', !showD);
    if (showD) {
      const M = this.meter, live = M.active(now);
      const html = `<div class="vd-top"><b>Training Dummy</b><span class="${live ? 'live' : 'dim'}">${live ? '● parsing' : 'idle · hit to restart'}</span></div>
        <div class="vd-big">${fmtN(M.dps())}<small> DPS</small></div>
        <div class="vd-rows"><span>Damage <b>${fmtN(M.total)}</b></span><span>Time <b>${M.secs().toFixed(1)}s</b></span><span>Hits <b>${M.hits}</b></span><span>Crits <b>${M.hits ? Math.round((M.crits / M.hits) * 100) : 0}%</b></span><span>Biggest <b>${fmtN(M.big)}</b></span><span>Best <b>${fmtN(M.best)}</b></span></div>
        <div class="vd-foot"><kbd>${esc(this.keyLabel('interact', 'X'))}</kbd> at the dummy: settings + meter reset · ${M.win ? `${M.win} s parse${M.done ? ' · DONE' : ''}` : '4 s without a hit starts a new parse'}</div>`;
      if (this._dh !== html) { this._dh = html; this.dps.innerHTML = html; }
    }
    // the pouch chip
    const pr = this.pr, pot = (pr.pouch && pr.pouch.potion) | 0, big = (pr.pouch && pr.pouch.greater) | 0, fort = fortuneOn(pr), sch = !!(pr.buffs && pr.buffs.scholar);
    const showP = !!p && (pot > 0 || big > 0 || fort || sch) && !this.g.paused;
    this.pouch.classList.toggle('hidden', !showP);
    if (showP) {
      const cd = Math.max(0, POTION.cd / 60 - (now - this.lastPot));
      const fm = fort ? Math.ceil((pr.buffs.fortune - Date.now()) / 60000) : 0;
      const html = `<span class="vp-pot${cd > 0 ? ' cd' : ''}"><kbd>${esc(this.keyLabel('potion', 'H'))}</kbd><i></i>×${pot}${big ? ` <b class="vp-big">+${big}</b>` : ''}${cd > 0 ? ` <small>${Math.ceil(cd)}s</small>` : ''}</span>${fort ? `<span class="vp-buff" style="--bc:#ffd23f">Fortune ${fm}m</span>` : ''}${sch ? `<span class="vp-buff" style="--bc:#7ee0ff">Scholar</span>` : ''}`;
      if (this._ph !== html) { this._ph = html; this.pouch.innerHTML = html; }
    }
  }
  /** the potion key */
  drinkPotion() {
    const pr = this.pr, p = this.g.player, now = performance.now() / 1000;
    if (!p || p.dead) return;
    const pot = (pr.pouch && pr.pouch.potion) | 0, big = (pr.pouch && pr.pouch.greater) | 0;
    if (!(pot > 0 || big > 0)) { this.flash('No Health Potions: Dorrik the Quartermaster sells them'); if (this.g.audio) this.g.audio.play('nores'); return; }
    if (now - this.lastPot < POTION.cd / 60) { if (this.g.audio) this.g.audio.play('nores'); return; }
    this.lastPot = now; this.g.command(big > 0 && (pot <= 0 || p.hp < p.stats.maxHp * 0.5) ? { type: 'potion', big: 1 } : { type: 'potion' }); // (the count drops when the sim confirms with a 'potion' event)
  }

  // ---------------------------------------------------------------- bag -> stash / salvage / sell (resolved on the sim's 'bag' event)
  takeOut(idx, why, o = {}) {
    const p = this.g.player, it = p && p.inventory[idx];
    if (!it) return false; // (game loop A1: old Trial Sigils can be salvaged / sold now)
    if (it.lock && why !== 'stash') { if (!o.auto) this.say(`${itemName(it)} is locked: unlock it first (Ctrl+click in the bag).`, 'err'); return false; } // step 4: locked items are never salvaged / sold
    if (why === 'stash' && stashFree(stash.load()) <= 0) { this.say('The stash is full.', 'err'); return false; }
    if (this.pend.has(it.uid)) return false;
    this.pend.set(it.uid, { why, item: JSON.parse(JSON.stringify(it)), tab: o.tab | 0, slot: o.slot ?? -1, auto: o.auto || null });
    this.g.command({ type: 'bagTake', idx, why });
    return true;
  }
  /** bugpass: a stash item sent to the bag ('unstash') stays on record until the sim confirms it; a full bag (co-op: the
   *  client's bag view is a few ticks old) or a rejected item puts it back in the stash instead of losing it */
  sendUnstash(it, tab = 0) {
    if (!it) return;
    const q = { item: JSON.parse(JSON.stringify(it)), tab: tab | 0 }; this.upend.set(it.uid, q);
    this.g.command({ type: 'unstash', item: it });
    setTimeout(() => { if (this.upend.get(it.uid) === q && !this.holds(it.uid)) this.unstashBack(it.uid); else if (this.upend.get(it.uid) === q) this.upend.delete(it.uid); }, 9000);
  }
  holds(uid) { const p = this.g.player; if (!p) return false; return p.inventory.some((x) => x && x.uid === uid) || Object.values(p.equipment || {}).some((x) => x && x.uid === uid); }
  unstashBack(uid) {
    const q = this.upend.get(uid); if (!q) return; this.upend.delete(uid);
    const S = stash.load(); const at = stashPutAny(S, q.item, q.tab); stash.save();
    if (this.g.menuHub && this.g.menuHub.stashDirty) this.g.menuHub.stashDirty();
    this.say(at ? `${itemName(q.item)} went back to the stash (no room in the bag).` : 'The stash and the bag are both full.', 'err');
  }
  onEvent(ev) {
    const p = this.g.player; if (!p) return;
    const me = ev.pid === p.id;
    if (me && ev.type === 'bag' && ev.ph === 'unstash') this.upend.delete(ev.uid);
    if (me && ev.type === 'invFull' && ev.why === 'unstash') { this.unstashBack(ev.uid); return; }
    if (me && ev.type === 'invFull' && ev.why === 'craft') { if (this.g.progress && this.g.progress.craftBack) this.g.progress.craftBack(ev.uid); return; }
    if (me && ev.type === 'forge' && ev.ph === 'craft' && this.g.progress && this.g.progress.craftOk) this.g.progress.craftOk(ev.uid);
    if (ev.type === 'dmg' && me && ev.team === 'enemy' && this.isDummy(ev.id)) this.meter.add(performance.now() / 1000, ev.amount, !!ev.crit);
    if (!me && ev.type !== 'ready') return;
    if (ev.type === 'pickup') this.auto.onPickup(ev);
    if (ev.type === 'bag' && ev.ph === 'locked') { const q = this.pend.get(ev.uid); if (q) this.pend.delete(ev.uid); if (!q || !q.auto) this.say('That item is locked.', 'err'); return; }
    if (ev.type === 'bag') {
      const q = this.pend.get(ev.uid); if (!q) return; this.pend.delete(ev.uid);
      const pr = this.pr, au = this.g.audio;
      if (q.why === 'stash') { const S = stash.load(); if (stashPut(S, q.item, q.tab, q.slot) < 0) stashPutAny(S, q.item, q.tab); stash.save(); if (au) au.play('pickup'); if (this.g.menuHub && this.g.menuHub.stashDirty) this.g.menuHub.stashDirty(); }
      else if (q.why === 'salvage') { const v = salvageValue(q.item); pr.gold += v.gold; for (const [k, n] of Object.entries(v.mats)) pr.mats[k] = (pr.mats[k] | 0) + n; profile.save();
        if (q.auto) this.auto.done(q.item, v);
        else if (this.g.fx) this.g.fx.text(p.x, p.y - 60, `+${v.gold}g ${Object.entries(v.mats).map(([k, n]) => `+${n} ${MATERIALS[k].name}`).join(' ')}`, { size: 15, color: '#ffd23f', vy: -40, life: 1.6, pop: 1.3 }); }
      else if (q.why === 'sell') { const g = sellPrice(q.item); pr.gold += g; pr.stats.gold = (pr.stats.gold | 0); profile.save(); if (au) au.play('coin'); }
      if (this.g.progress && this.g.progress.isOpen()) this.g.progress.render();
      if (this.isOpen()) this.render();
    } else if (ev.type === 'potion') {
      const pr = this.pr, k = ev.big ? 'greater' : 'potion'; pr.pouch[k] = Math.max(0, (pr.pouch[k] | 0) - 1); profile.save();
      if (this.g.audio) this.g.audio.play('gulp');
      if (this.g.fx) { this.g.fx.text(p.x, p.y - 50, `+${ev.amount} HP`, { size: 20, color: '#7dff9a', vy: -50, life: 1.1 }); if (this.g.fx.ring) this.g.fx.ring(p.x, p.y, 60, '#7dff9a', 0.5, 6); }
    } else if (ev.type === 'invFull' && this.isOpen()) this.say('Your bag is full.', 'err');
    else if (ev.type === 'ready') {
      if (this.g.fx && ev.on) { const r = this.rows(); const c = readyCount(r); this.g.fx.banner(`${String(ev.name || 'A hero').toUpperCase()} IS READY`, '#7dff9a', `${c.n} / ${c.of} ready${c.all ? ' · the host can depart at the Mission Counter' : ''}`, 1.8, 30); }
      if (this.isOpen() && this.panel === 'lobby') this.render();
    }
  }
  isDummy(id) { const S = this.g.sim || this.g.view; if (!S) return false; const e = S.enemyById && S.enemyById.get(id); return !!(e && (e.type === 'dummy' || e.dummy)); }

  // ---------------------------------------------------------------- Training Dummy settings (sim/dummy.js)
  get dcfg() { if (!this._dc) { let c = {}; try { c = JSON.parse(localStorage.getItem(DUMMY_KEY) || '{}'); } catch {} this._dc = normDummy(c); } return this._dc; }
  setDummy(c, quiet = false) {
    this._dc = normDummy(c); try { localStorage.setItem(DUMMY_KEY, JSON.stringify(this._dc)); } catch {}
    if (this.g.command) this.g.command({ type: 'dummyCfg', cfg: this._dc });
    this.meter.setWindow(this._dc.meter); if (this.g.fx) this.g.fx.dummyNums = this._dc.numbers;
    if (!quiet && this.panel === 'dummy') this.render();
  }
  /** open the menu from anywhere (Options): it stays open away from the dummy */
  openDummy() { this.dmAnywhere = true; this.open('dummy'); }
  dummyPanel() {
    const c = this.dcfg, coop = !!this.g.net && !(this.g.isHost && this.g.isHost());
    const row = (k, label, vals, fmt = (v) => v, help = '') => `<div class="dm-row"><span class="dm-l">${esc(label)}${help ? `<small>${esc(help)}</small>` : ''}</span><span class="dm-opts">${vals.map((v) => `<button class="dm-o${c[k] === v ? ' on' : ''}" data-dset="${k}" data-v="${v}">${esc(String(fmt(v)))}</button>`).join('')}</span></div>`;
    const yn = (k, label, help) => row(k, label, [false, true], (v) => (v ? 'On' : 'Off'), help);
    const big = (v) => (v === 'inf' ? '∞' : v >= 1e6 ? v / 1e6 + 'M' : v / 1e3 + 'k');
    const M = this.meter;
    return `<style>.dm-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.07);flex-wrap:wrap}
      .dm-l{font-weight:700;min-width:150px}.dm-l small{display:block;font-weight:400;opacity:.65;font-size:11px}.dm-opts{display:flex;gap:4px;flex-wrap:wrap}
      .dm-o{min-width:44px;min-height:34px;padding:4px 9px;border-radius:8px;border:2px solid #2b2433;background:#3b3358;color:#fff;font:inherit;font-weight:700;cursor:pointer}
      .dm-o.on{background:#ffd23f;color:#2b2433}.dm-h{margin:10px 0 2px;font-size:12px;letter-spacing:.08em;opacity:.7;text-transform:uppercase}
      .dm-meter{display:flex;gap:14px;align-items:center;margin-top:10px;flex-wrap:wrap}</style>
      ${coop ? '<p class="dim">Co-op: only the host can change the dummies. Damage numbers and the meter are yours.</p>' : ''}
      <div class="dm-h">Dummy</div>
      ${row('hp', 'Health', DUMMY_OPTS.hp, big, 'infinite resets after 3 s idle; a number dies and respawns')}
      ${row('level', 'Level', DUMMY_OPTS.level, (v) => 'Lv ' + v, 'its mob level (the game has no level-gap damage, so this does not change your damage)')}
      ${row('dr', 'Armor', DUMMY_OPTS.dr, (v) => (v ? '-' + Math.round(v * 100) + '%' : 'none'), 'damage reduction')}
      ${yn('boss', 'Counts as a boss', 'boss forms (shadow skills), vs-boss bonuses, boss bar')}
      <div class="dm-h">Spawn</div>
      ${row('count', 'Count', DUMMY_OPTS.count)}
      ${row('layout', 'Layout', DUMMY_OPTS.layout, (v) => ({ line: 'Line', ring: 'Ring', pack: 'Pack' })[v])}
      ${row('move', 'Movement', DUMMY_OPTS.move, (v) => ({ still: 'Stationary', strafe: 'Strafe', circle: 'Circle' })[v])}
      <div class="dm-h">Mechanics</div>
      ${yn('attack', 'Attack you with telegraphs', 'red circles on your spot, 1.1 s tell, dodgeable')}
      ${row('tellEvery', 'Telegraph every', DUMMY_OPTS.tellEvery, (v) => v + ' s')}
      ${row('dmgPct', 'Telegraph damage', DUMMY_OPTS.dmgPct, (v) => v + '% HP')}
      <div class="dm-h">Meter + display</div>
      ${row('meter', 'Parse length', DUMMY_OPTS.meter, (v) => (v ? v + ' s' : 'Auto'), 'auto = a 4 s pause starts a new parse')}
      ${yn('numbers', 'Damage numbers on the dummies')}
      <div class="dm-meter"><span>Current parse: <b>${fmtN(M.dps())}</b> DPS · ${M.secs().toFixed(1)} s · ${M.hits} hits</span><button class="btn small" id="dmReset">Reset meter</button><button class="btn small ghost" id="dmDefaults">Defaults</button></div>`;
  }

  // ---------------------------------------------------------------- panels
  render() {
    if (!this.root || !this.panel) return;
    const pr = this.pr, S = STATION[this.panel];
    let body = '';
    if (this.panel === 'qm') body = this.shop(pr);
    else if (this.panel === 'stash') body = this.stashPanel();
    else if (this.panel === 'lobby') body = this.lobby();
    else if (this.panel === 'altar') body = altarPanel(this.g);
    else if (this.panel === 'dummy') body = this.dummyPanel();
    const said = { dummy: 'Straw, oak and stubbornness. Set it up how you like: it will take whatever you throw at it.', altar: 'Starlight pools in the old stone. Something in it looks back at you with your own face.', qm: '“Potions, tonics, and I’ll take that spare gear off your hands. Fair prices, mostly.”', stash: 'Every hero in this browser shares this chest.', lobby: 'Find a party, share the invite, and ready up before you depart.' }[this.panel];
    this.root.innerHTML = `<div class="panel pg-box vg-box vg-${this.panel}"><div class="pg-top"><h2>${esc(S.name)} <small>${esc(S.title)}</small></h2><div class="pg-wallet"><span class="gold">${fmtN(pr.gold)} gold</span></div><button class="btn small x" id="vgClose">✕</button></div>
      <p class="vg-said">${said}</p><div class="pg-body">${body}</div><div class="pg-msg ${this.msgKind || ''}">${this.msg || ''}</div></div>`;
    const R = this.root, on = (sel, f) => R.querySelectorAll(sel).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); f(b); }));
    R.querySelector('#vgClose').onclick = () => this.close();
    on('[data-qtab]', (b) => { this.tab = b.dataset.qtab; this.msg = ''; this.render(); });
    on('[data-buy]', (b) => this.buy(b.dataset.buy, +(b.dataset.n || 1)));
    on('[data-svbuy]', (b) => this.buySv(b.dataset.svbuy));
    { const sel = R.querySelector && R.querySelector('#svSlot'); if (sel) sel.onchange = () => { this.svSlot = sel.value; }; }
    on('[data-use]', (b) => this.use(b.dataset.use));
    on('[data-sell]', (b) => { if (this.takeOut(+b.dataset.sell, 'sell')) this.say('Sold.', 'ok'); });
    on('#sellCommons', () => { let n = 0; this.g.player.inventory.forEach((it, i) => { if (it && it.slot !== 'sigil' && !it.lock && (it.rarity | 0) === 0 && !(it.up | 0) && this.takeOut(i, 'sell')) n++; }); if (n) this.say(`Sold ${n} Common piece${n > 1 ? 's' : ''}.`, 'ok'); });
    on('[data-put]', (b) => { if (this.takeOut(+b.dataset.put, 'stash')) this.say('Stored in the stash.', 'ok'); });
    on('[data-take]', (b) => this.unstash(+b.dataset.take));
    if (this.panel === 'altar') wireAltar(R, this);
    on('[data-dset]', (b) => { const k = b.dataset.dset, v = b.dataset.v; const c = { ...this.dcfg }; c[k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v; this.setDummy(c); });
    on('#dmReset', () => { this.meter.reset(); this.say('Meter reset: hit a dummy to start a new parse.', 'ok'); });
    on('#dmDefaults', () => { this.setDummy({ ...DUMMY_DEF }); this.say('Defaults restored.', 'ok'); });
    on('#lbReady', () => { const me = this.rows().find((r) => r.me); this.g.command({ type: 'ready', on: me && me.ready ? 0 : 1 }); });
    on('#lbHost', () => this.goCoop());
    on('#lbJoin', () => this.joinUrl());
    on('#lbSolo', () => { if (window.__rb && window.__rb.switchMode) window.__rb.switchMode('solo'); });
    on('#lbCopy', () => { const u = this.inviteUrl(); if (u && navigator.clipboard) navigator.clipboard.writeText(u).then(() => this.say('Invite link copied.', 'ok'), () => this.say(u, 'ok')); });
  }
  shop(pr) {
    const tabs = `<div class="pg-tabs sub"><button class="tab${this.tab === 'buy' ? ' on' : ''}" data-qtab="buy">Buy</button><button class="tab${this.tab === 'sell' ? ' on' : ''}" data-qtab="sell">Sell gear</button><button class="tab${this.tab === 'savage' ? ' on' : ''}" data-qtab="savage" style="--tc:#ff6a3d">Savage</button></div>`;
    if (this.tab === 'savage') { // (Part 0S: Savage Marks buy Savage gear)
      const mk = marksOf(pr), sl = this.svSlot || SAVAGE_PIECE_SLOTS[0];
      return tabs + `<p class="dim">Savage Marks: <b style="color:#ff6a3d">${mk}</b> · earn 1 a Savage clear, +4 on your first clear of the week (Astral mode: the trial doors offer the Savage). Bought gear goes to your stash.</p>
        <div class="qm-grid">${SAVAGE_STOCK.map((S) => `<div class="qm-card" style="--cc:#ff6a3d"><div class="qm-ico"><i></i></div><div class="qm-txt"><b>${esc(S.name)}</b><small>${esc(S.boss)} Savage · tier 7 Legendary · Black Sun family (its procs + 4-piece)</small><span class="dim">${S.marks} Savage Marks</span></div>
          <div class="qm-btns">${S.slot ? '' : `<select id="svSlot">${SAVAGE_PIECE_SLOTS.map((x) => `<option value="${x}"${x === sl ? ' selected' : ''}>${x}</option>`).join('')}</select>`}<button class="btn small" data-svbuy="${S.id}"${mk < S.marks ? ' disabled' : ''}>Buy · ${S.marks} Marks</button></div></div>`).join('')}</div>`;
    }
    if (this.tab === 'sell') {
      const list = this.g.player.inventory.map((it, i) => ({ it, i })).filter((x) => x.it);
      const commons = list.filter((x) => (x.it.rarity | 0) === 0 && !(x.it.up | 0) && !x.it.lock).length;
      return tabs + `<p class="dim">Dorrik buys bag gear for gold (equipped gear is never sold). Salvage at Borin's forge gives materials instead.</p>
        <div class="sv-list">${list.length ? list.map(({ it, i }) => `<div class="sv-row">${itemCard(it)}<span class="sv-val gold">${fmtN(sellPrice(it))}g</span>${it.lock ? '<span class="dim">🔒 locked</span>' : `<button class="btn small" data-sell="${i}">Sell</button>`}</div>`).join('') : '<p class="dim">Nothing in your bag to sell.</p>'}</div>
        ${commons > 1 ? `<button class="btn ghost" id="sellCommons">Sell all ${commons} Common pieces</button>` : ''}`;
    }
    const pouch = pr.pouch || {}, tier = shopTier(pr);
    const lockedCard = (c) => { const ch = CHAPTERS.find((x) => x.unlocks.includes('shop' + c.tier)); return `<div class="qm-card locked" style="--cc:${c.color}"><div class="qm-ico"><i></i></div><div class="qm-txt"><b>${esc(c.name)}</b><small>${esc(c.desc)}</small><span class="dim">🔒 Dorrik stocks it after story chapter ${ch ? ch.n : '?'}${ch ? `, "${esc(ch.title)}"` : ''}</span></div><div class="qm-btns"><span class="qm-tier">Tier ${c.tier}</span></div></div>`; };
    return tabs + `<div class="qm-tierbar">Shop tier <b>${tier}</b> / 4 <span class="dim">· the story chain unlocks new stock (journal: <kbd>${esc(this.keyLabel('journal', 'L'))}</kbd>)</span></div><div class="qm-grid">${CONSUMABLES.map((c) => { if ((c.tier || 1) > tier) return lockedCard(c); const have = pouch[c.id] | 0, full = have >= c.max;
      return `<div class="qm-card" style="--cc:${c.color}"><div class="qm-ico"><i></i></div><div class="qm-txt"><b>${esc(c.name)}</b><small>${esc(c.desc)}</small><span class="dim">You have ${have} / ${c.max}</span></div>
        <div class="qm-btns"><button class="btn small" data-buy="${c.id}"${full || pr.gold < c.price ? ' disabled' : ''}>Buy · ${c.price}g</button>${c.id === 'potion' ? `<button class="btn small ghost" data-buy="potion" data-n="5"${have + 5 > c.max || pr.gold < c.price * 5 ? ' disabled' : ''}>×5 · ${c.price * 5}g</button>` : c.id === 'greater' ? `<span class="qm-tier">key ${esc(this.keyLabel('potion', 'H'))}</span>` : `<button class="btn small ghost" data-use="${c.id}"${have ? '' : ' disabled'}>Drink</button>`}</div></div>`; }).join('')}</div>
      <p class="dim">Health Potions are drunk in the field with <kbd>${esc(this.keyLabel('potion', 'H'))}</kbd>. ${fortuneOn(pr) ? `<b style="color:#ffd23f">Fortune active: ${Math.ceil((pr.buffs.fortune - Date.now()) / 60000)} min left.</b>` : ''} ${pr.buffs && pr.buffs.scholar ? `<b style="color:#7ee0ff">Scholar's Tonic active.</b>` : ''}</p>`;
  }
  buySv(id) { // (Part 0S) a Savage piece into the stash
    const pr = this.pr, p = this.g.player, S = stash.load(); if (stashFree(S) <= 0) return this.say('Your stash is full.', 'err');
    const r = buySavage(pr, id, p.cls, { next: Math.random }, this.svSlot || SAVAGE_PIECE_SLOTS[0], p.level);
    if (r.why) return this.say(r.why, 'err');
    stashPutAny(S, r.item); stash.save(); profile.save(); if (this.g.audio) this.g.audio.play('legendary'); this.say(`${r.item.name} is in your stash.`, 'ok'); this.render();
  }
  buy(id, n) { const pr = this.pr, why = buyConsumable(pr, id, n, shopTier(pr)); if (why) return this.say(why, 'err'); profile.save(); if (this.g.audio) this.g.audio.play('coin'); this.say(`Bought ${n > 1 ? n + '× ' : ''}${CONSUMABLE[id].name}.`, 'ok'); }
  use(id) { const pr = this.pr, why = useConsumable(pr, id); if (why) return this.say(why, 'err'); profile.save(); if (this.g.audio) this.g.audio.play('gulp'); this.say(id === 'fortune' ? 'Fortune favours you: +25% gold, +10% materials for 10 minutes.' : 'Your next reward screen gives +25% account XP.', 'ok'); }
  stashPanel() {
    const p = this.g.player, S = stash.load(), used = S.items.filter(Boolean).length; // (fallback panel: the hub's Stash tab is the full tabbed view)
    const bag = p.inventory.map((it, i) => (it ? itemCard(it, `data-put="${i}"`, '<em>→ stash</em>') : '<div class="vi-empty"></div>')).join('');
    const box = S.items.map((it, i) => (it ? itemCard(it, `data-take="${i}"`, '<em>← bag</em>') : '<div class="vi-empty"></div>')).join('');
    return `<div class="st-wrap"><div><h3>${esc(p.name)}'s bag <span class="dim">${p.inventory.filter(Boolean).length} / ${p.inventory.length}</span></h3><div class="st-grid bag">${bag}</div></div>
      <div><h3>Stash <span class="dim">${used} / ${STASH_SIZE}</span></h3><div class="st-grid box">${box}</div></div></div><p class="dim">Click an item to move it. Hover for its stats.</p>`;
  }
  unstash(i) {
    const p = this.g.player; if (p.inventory.indexOf(null) < 0) return this.say('Your bag is full.', 'err');
    const it = stashTake(stash.load(), i); if (!it) return; stash.save();
    this.sendUnstash(it); if (this.g.audio) this.g.audio.play('pickup');
    setTimeout(() => this.render(), 60);
  }
  // ---- the co-op board
  rows() {
    const me = this.g.player;
    if (this.g.roster && this.g.roster.size) return [...this.g.roster.values()].map((r) => ({ ...r, me: me && r.id === me.id }));
    return me ? [{ id: me.id, name: me.name, cls: me.cls, level: me.level, ready: me.ready ? 1 : 0, me: true }] : [];
  }
  inviteUrl() { return (this.coop && this.coop.invite && (this.coop.invite.url || this.coop.invite.local)) || (typeof location !== 'undefined' ? location.origin + '/' : ''); }
  refreshLobby() {
    if (typeof fetch === 'undefined') return;
    Promise.all([fetch('/api/info').then((r) => r.json()), fetch('/api/invite').then((r) => r.json())])
      .then(([info, invite]) => { this.coop = { info, invite, ok: true }; if (this.isOpen() && this.panel === 'lobby') this.render(); })
      .catch(() => { this.coop = { ok: false }; if (this.isOpen() && this.panel === 'lobby') this.render(); });
  }
  goCoop() { if (window.__rb && window.__rb.switchMode) window.__rb.switchMode('coop'); }
  joinUrl() {
    const v = (this.root.querySelector('#lbUrl') || {}).value || '';
    let u; try { u = new URL(v.trim()); } catch { return this.say('Paste the invite link your friend shared (it starts with http).', 'err'); }
    if (!/^https?:$/.test(u.protocol)) return this.say('That is not an http(s) link.', 'err');
    location.href = u.origin + '/?mode=coop';
  }
  lobby() {
    const coop = !!this.g.net, I = this.g.hubInfo ? this.g.hubInfo() : {};
    if (coop) {
      const rows = this.rows(), c = readyCount(rows), me = rows.find((r) => r.me), hostId = this.g.hub && this.g.hub.h;
      return `<div class="lb-party"><h3>Party <span class="dim">${rows.length} / ${this.g.maxPlayers || 4} · ${c.n} ready</span></h3>
        ${rows.map((r) => `<div class="lb-row${r.ready ? ' rdy' : ''}"><b>${esc(r.name)}</b>${r.id === hostId || (!hostId && r === rows[0]) ? '<em class="lb-host">host</em>' : ''}${r.me ? '<em>you</em>' : ''}<span class="dim">Lv ${r.level} ${esc((CLASSES[r.cls] || {}).name || r.cls)}</span><span class="lb-rd">${r.ready ? '✔ ready' : '… not ready'}</span></div>`).join('')}
        <div class="rw-bar"><i style="width:${rows.length ? Math.round((c.n / rows.length) * 100) : 0}%"></i></div></div>
        <div class="lb-act"><button class="btn${me && me.ready ? ' ghost' : ''}" id="lbReady">${me && me.ready ? 'Not ready' : 'Ready up'}</button>
        <span class="dim">${I.host ? (c.all ? 'Everyone is ready: pick a mission at the Mission Counter.' : 'You are the host: depart from the Mission Counter when the party is ready.') : 'The host departs from the Mission Counter. Ready-ups reset each departure.'}</span></div>
        <h3>Invite</h3><div class="lb-inv"><code>${esc(this.inviteUrl())}</code><button class="btn small ghost" id="lbCopy">Copy</button></div>
        <button class="btn small ghost" id="lbSolo">Leave the party (play solo)</button>`;
    }
    const C = this.coop, info = C && C.info;
    const status = !C ? '<p class="dim">Checking the co-op server…</p>' : !C.ok ? '<p class="fg-lock">No co-op server answered. Co-op runs from the game\'s own server (the desktop app starts it).</p>'
      : `<div class="lb-srv"><b>${info.players} / ${info.max}</b> in this server's co-op world${info.names && info.names.length ? `: ${info.names.map(esc).join(', ')}` : ''}</div>`;
    return `<p>You are playing <b>solo</b>. Co-op shares one world: your hero and gear come with you, and you can leave any time.</p>${status}
      <div class="lb-act"><button class="btn" id="lbHost"${C && C.ok ? '' : ' disabled'}>${info && info.players ? `Join the party here (${info.players} online)` : 'Host co-op on this PC'}</button><span class="dim">Friends join with your invite link.</span></div>
      ${C && C.ok ? `<h3>Your invite link</h3><div class="lb-inv"><code>${esc(this.inviteUrl())}</code><button class="btn small ghost" id="lbCopy">Copy</button></div>` : ''}
      <h3>Join a friend</h3><div class="lb-inv"><input id="lbUrl" placeholder="https://… (the link your friend shared)" spellcheck="false"><button class="btn small" id="lbJoin">Join</button></div>`;
  }
  destroy() { removeEventListener('keydown', this.onKey, { capture: true }); for (const el of [this.prompt, this.root, this.dps, this.pouch]) if (el) el.remove(); this.prompt = this.root = null; }
}
