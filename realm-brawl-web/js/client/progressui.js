// The Progress panel (experience pass 2): P opens it, K opens it on the Forge. Tabs:
//   Account   - account level + XP bar, the milestone track (what each level unlocks), gold and every material
//   Bounties  - today's 3 and this week's 2, with progress and the time left
//   Records   - best time, best rank and clears per mission
//   Forge     - Upgrade (+1..+10: cost, chance, before -> after) and Craft (recipes from materials, choose the slot)
// The Forge works in the village (piece 3 moves it to the Blacksmith). Gold / materials are paid from the account
// profile; the item change goes through the sim ('upgrade' / 'craft' commands) so co-op stays in sync.
import { COLL_ROWS, COLL, collStats, rowCount } from '../sim/collection.js';
import { EXOTIC, EXOTIC_SLOTS } from '../sim/exotic.js';
import { CHAPTERS, UNLOCKS, NPCS, status as chStatus, recipeOpen, current as curChapter, allDone } from '../sim/story.js';
import { MATERIALS, MAT_IDS, MILESTONES, accountLevel, hasMilestone, upgradeCost, upgradeChance, upgradeCap, upStats, itemName,
  RECIPES, canPay, pay, craftItem, refreshBounties, dateKeys, PAR, ascendCost, ascendItem, canAscend, isCatalyst, TIER_LV, matGrade, MAT_WHERE,
  REROLL, rerollKeys, canReroll, rerollCost, rerollSub, subChoices, upLuck } from '../sim/meta.js';
import { MISSIONS } from '../sim/hub.js';
import { STAT_LABELS, AFFIXES, RARITIES, BASE_NAMES, PREFIX, EQUIP_SLOTS, SET_SLOTS, SLOT_LABEL } from '../sim/data/items.js';
import { inTownArea, hubLayoutOf } from '../sim/townconst.js';
import { nearStation, STATION, salvageValue } from '../sim/village.js';
/** salvaging this rarity or higher (Epic, Legendary, sets...) asks first */
export const SALVAGE_CONFIRM_RARITY = 2;
import { SETS } from '../sim/sets.js';
import { profile, fmtTime, bountyCtx } from './rewards.js';
import { ascAccountCard } from './ascendui.js'; // (Part D: the account's Ascension card)
import { OPS_TYPES, OPS_TYPE, OPS_BIOME } from '../sim/opsconst.js';
import { bestOf, GRADE_COL } from '../sim/opsbest.js'; // part 3: best grade per mission type
const OPS_MAPS = ['wilds', 'dunes', 'frost', 'ember', 'rift'];
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (k, v) => { const a = AFFIXES[k]; return a && a.fmt === 'pct' ? `+${(v * 100).toFixed(1)}%` : a && a.fmt === 'dec' ? `+${(+v).toFixed(1)}` : `+${v}`; };
const RANK_COL = { S: '#ffd23f', A: '#7ee0ff', B: '#c8b8ff' };
const patternChapter = (r) => { const pat = { set_wild: 'pat_wild', forge_dunes: 'pat_dune', set_dune: 'pat_dune', forge_tomb: 'pat_tomb', pat_rift: 'pat_rift', pat_star: 'pat_star' }[r.unlock]; return pat ? CHAPTERS.find((c) => c.unlocks.includes(pat)) : null; };
const left = (ms) => { const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000); return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`; };
export const FORGE_REFUND_MS = 6000; // (bugpass: a paid Forge command the sim never applied is refunded after this)

export class ProgressUI {
  constructor(game) {
    this.g = game; this.tab = 'account'; this.forgeTab = 'upgrade'; this.sel = null; this.recipe = RECIPES[0].id; this.slot = 'weapon'; this.msg = '';
    if (!$('progress')) { const d = document.createElement('div'); d.id = 'progress'; d.className = 'overlay hidden'; document.body.appendChild(d); }
    this.root = $('progress');
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.close(); });
    this.onKey = (e) => { if (this.isOpen() && e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); } };
    addEventListener('keydown', this.onKey, { capture: true });
  }
  get pr() { return profile.load(); }
  isOpen() { return !this.mounted && !this.root.classList.contains('hidden'); }
  open(tab = null) { if (this.mounted && this.g.menuHub) this.g.menuHub.close(); if (tab) this.tab = tab; refreshBounties(this.pr, undefined, bountyCtx(this.g.player && this.g.player.level)); this.root.classList.remove('hidden'); this.msg = ''; this.render(); }
  close() { if (this.mounted) { if (this.g.menuHub) this.g.menuHub.close(); return; } this.root.classList.add('hidden'); }
  /** draw inside a tab of the menu hub (client/menuhub.js) instead of the overlay: only `tabs` are offered */
  mount(el, tabs, tab = null) {
    if (!this.mounted && this.isOpen()) this.root.classList.add('hidden');
    if (!this.overlay) this.overlay = this.root;
    this.mounted = { tabs }; this.root = el;
    if (tab && tabs.includes(tab)) this.tab = tab; else if (!tabs.includes(this.tab)) this.tab = tabs[0];
    refreshBounties(this.pr, undefined, bountyCtx(this.g.player && this.g.player.level)); this.msg = ''; this.render();
  }
  unmount() { if (!this.mounted) return; this.root.innerHTML = ''; this.root = this.overlay; this.mounted = null; }
  toggle(tab) { if (this.isOpen() && (!tab || tab === this.tab)) this.close(); else this.open(tab); }
  destroy() { removeEventListener('keydown', this.onKey, { capture: true }); this.unmount(); this.close(); }
  render() {
    const pr = this.pr, acc = accountLevel(pr.accXp);
    const M = this.mounted, tabs = [['journal', 'Journal'], ['account', 'Account'], ['bounties', 'Bounties'], ['records', 'Records'], ['trophies', 'Collection Log'], ['coll', 'Gear Collection'], ['forge', 'Forge']].filter(([id]) => (M ? M.tabs.includes(id) : id !== 'trophies'));
    let body = '';
    if (this.tab === 'journal') body = this.journal(pr);
    else if (this.tab === 'trophies') body = this.trophies(pr);
    else if (this.tab === 'account') body = this.account(pr, acc);
    else if (this.tab === 'bounties') body = this.bounties(pr);
    else if (this.tab === 'records') body = this.records(pr);
    else if (this.tab === 'coll') body = this.gearColl(pr, acc);
    else body = this.forge(pr, acc);
    this.root.innerHTML = `<div class="panel pg-box${M ? ' in-hub' : ''}">
      ${M ? '' : `<div class="pg-top"><h2>Progress</h2><div class="pg-wallet"><span class="gold">${pr.gold} gold</span><span>Account Lv ${acc.level}</span></div><button class="btn small x" id="pgClose">✕</button></div>`}
      ${tabs.length > 1 ? `<div class="pg-tabs">${tabs.map(([id, n]) => `<button class="tab${this.tab === id ? ' on' : ''}" data-tab="${id}">${n}</button>`).join('')}</div>` : ''}
      <div class="pg-body">${body}</div>
      <div class="pg-msg ${this.msgKind || ''}">${this.msg || ''}</div>
    </div>`;
    const pc = this.root.querySelector('#pgClose'); if (pc) pc.onclick = () => this.close();
    this.root.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { this.tab = b.dataset.tab; this.msg = ''; this.render(); }));
    this.root.querySelectorAll('[data-ftab]').forEach((b) => (b.onclick = () => { this.forgeTab = b.dataset.ftab; this.msg = ''; this.render(); }));
    this.root.querySelectorAll('[data-item]').forEach((b) => (b.onclick = () => { this.sel = b.dataset.item; this.msg = ''; this.render(); }));
    this.root.querySelectorAll('[data-recipe]').forEach((b) => (b.onclick = () => { this.recipe = b.dataset.recipe; this.msg = ''; this.render(); }));
    this.root.querySelectorAll('[data-slot]').forEach((b) => (b.onclick = () => { this.slot = b.dataset.slot; this.render(); }));
    const up = this.root.querySelector('#fgUpgrade'); if (up) up.onclick = () => this.doUpgrade();
    const cr = this.root.querySelector('#fgCraft'); if (cr) cr.onclick = () => this.doCraft();
    const as = this.root.querySelector('#fgAscend'); if (as) as.onclick = () => this.doAscend();
    this.root.querySelectorAll('[data-rk]').forEach((b) => (b.onclick = () => { this.rk = b.dataset.rk; this.render(); }));
    const rr = this.root.querySelector('#fgReroll'); if (rr) rr.onclick = () => this.doReroll();
    this.root.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => { this.cat = +b.dataset.cat; this.render(); }));
    const sl = this.root.querySelector('#svLow'); if (sl) sl.onclick = () => this.doSalvage(this.lowIdx());
    this.root.querySelectorAll('[data-salv]').forEach((b) => (b.onclick = () => this.doSalvage([+b.dataset.salv])));
    const sy = this.root.querySelector('#svYes'); if (sy) sy.onclick = () => { const q = this.svAsk; this.svAsk = null; if (q) this.doSalvage(q.idxs, q.uids); };
    const sn = this.root.querySelector('#svNo'); if (sn) sn.onclick = () => { this.svAsk = null; this.say('Kept it.', 'ok'); };
    const sc = this.root.querySelector('#svCommons'); if (sc) sc.onclick = () => this.doSalvage(this.g.player.inventory.map((it, i) => (it && it.slot !== 'sigil' && !it.lock && (it.rarity | 0) === 0 && !(it.up | 0) ? i : -1)).filter((i) => i >= 0));
  }
  account(pr, acc) {
    const pct = acc.level >= 30 ? 100 : Math.round((acc.into / acc.need) * 100);
    return `<div class="pg-acc"><b>Account level ${acc.level}</b> <span class="dim">${acc.level >= 30 ? 'max' : `${acc.into} / ${acc.need} XP`} · shared by every hero in this browser</span>
      <div class="rw-bar"><i style="width:${pct}%"></i></div></div>
      ${ascAccountCard(pr)}
      <div class="pg-split"><div><h3>Milestones</h3><div class="pg-miles">${MILESTONES.map((m) => `<div class="mile${acc.level >= m.lv ? ' got' : ''}"><span class="lv">Lv ${m.lv}</span><b>${esc(m.name)}</b><small>${esc(m.text)}</small></div>`).join('')}</div></div>
      <div><h3>Materials</h3><div class="pg-mats">${MAT_IDS.map((id) => { const M = MATERIALS[id]; return `<div class="mat-row" title="${esc(M.desc)}" style="--mc:${M.color}"><i></i><span>${esc(M.name)}</span><b>${pr.mats[id] | 0}</b></div>`; }).join('')}</div>
      <p class="dim">Materials drop per zone: horde fodder rain each biome's common material (Greenwood Sap / Ashstone, Sunglass, Rimeshard, Cinderglass), elites and tough units the rarer ones, bosses their trophies. Hover a material for where it drops.</p>
      <h3>Lifetime</h3><div class="dim">${pr.stats.kills | 0} kills · ${pr.stats.clears | 0} clears · ${pr.stats.gold | 0} gold earned</div></div></div>`;
  }
  /** game loop B2: the Gear Collection: every set / Trial / Extreme piece by slot and relics by rarity a hero has held */
  gearColl(pr, acc) {
    const S = collStats(pr), legend = acc.level >= 30, gx = Math.round(COLL.xp * (legend ? COLL.xpLegend : 1));
    const rows = COLL_ROWS.map((r) => { const n = rowCount(pr, r), done = pr.collDone && pr.collDone[r.id];
      return `<div class="gc-row${done ? ' done' : ''}" style="--gc:${r.color}"><div class="gc-name"><b>${esc(r.name)}</b><small>${r.kind === 'set' ? 'Set' : r.kind === 'trial' ? 'Trial family' : r.kind === 'extreme' ? 'Extreme family' : 'Relic'} · ${n} / ${r.entries.length}${done ? ' · ✔ reward paid' : ''}</small></div>
        <div class="gc-cells">${r.entries.map((e) => `<span class="gc-cell${pr.coll && pr.coll[e.key] ? ' on' : ''}" title="${esc(e.label)}">${esc(e.label.slice(0, 3))}</span>`).join('')}</div></div>`; }).join('');
    const nb = Object.keys(pr.collDone || {}).length, nextBag = nb < 1 ? '1st' : nb < 3 ? '3rd' : '';
    return `<div class="cl-sum"><div><b>${S.have}</b>/${S.all}<small>pieces collected</small></div><div><b>${S.rows}</b>/${S.of}<small>rows complete</small></div><div><b>${(pr.bagGrants || []).filter((g) => g && g.label === 'Collection').length * COLL.bag}</b><small>bag slots earned</small></div></div>
      <p class="dim">Every set piece, Trial / Extreme piece (each slot, any hero) and relic a hero of this account holds is ticked off here (bag, gear and stash). A full row pays once: ${COLL.gold} gold + ${gx} account XP${legend ? ' (Realm Legend +50%)' : ''}${nextBag ? `; the ${nextBag} full row also adds +${COLL.bag} bag slots for every hero` : ''}.</p>
      <div class="gc-list">${rows}</div>`;
  }
  /** the collection log (menu hub > Collection): every material by grade, what you own, lifetime totals, clears */
  trophies(pr) {
    const groups = {}; for (const id of MAT_IDS) { const g = matGrade(id) || 'Other'; (groups[g] = groups[g] || []).push(id); }
    const ORD = ['Common', 'Uncommon', 'Rare', 'Boss', 'Token', 'Other'], order = ORD.filter((g) => groups[g]).concat(Object.keys(groups).filter((g) => !ORD.includes(g)));
    const owned = MAT_IDS.filter((id) => (pr.mats[id] | 0) > 0).length;
    const cleared = MISSIONS.filter((m) => pr.records[m.id] && pr.records[m.id].clears > 0).length;
    const chapters = CHAPTERS.filter((c) => chStatus(pr, c) === 'done').length;
    return `<div class="cl-sum"><div><b>${owned}</b>/${MAT_IDS.length}<small>materials found</small></div><div><b>${cleared}</b>/${MISSIONS.length}<small>missions cleared</small></div><div><b>${chapters}</b>/${CHAPTERS.length}<small>story chapters</small></div><div><b>${pr.stats.kills | 0}</b><small>lifetime kills</small></div><div><b>${pr.stats.gold | 0}</b><small>gold earned</small></div></div>`
      + order.map((g) => `<h3>${g === 'Boss' ? 'Trophies (boss materials)' : g + ' materials'}</h3><div class="cl-grid">${groups[g].map((id) => { const M = MATERIALS[id], n = pr.mats[id] | 0; return `<div class="cl-card${n ? '' : ' none'}" style="--mc:${M.color}" title="${esc(M.desc)}"><i></i><b>${n ? esc(M.name) : '???'}</b><span>${n ? '×' + n : 'not found yet'}</span><small>${esc(MAT_WHERE[id] || '')}</small></div>`; }).join('')}</div>`).join('');
  }
  bounties(pr) {
    const B = pr.bounties || {}, now = new Date(), tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const wk = dateKeys(now).week.split('-').map(Number), nextMon = new Date(wk[0], wk[1] - 1, wk[2] + 7);
    const card = (b, open, lockText) => `<div class="bounty${b.done ? ' done' : ''}${open ? '' : ' locked'}"><div class="b-top"><b>${esc(b.text)}</b><span>${b.done ? '✔ claimed' : `${b.n} / ${b.need}`}</span></div><div class="rw-bar sm"><i style="width:${Math.round((b.n / b.need) * 100)}%"></i></div><small>Reward: ${b.reward.gold} gold · ${b.reward.xp} account XP · ${Object.entries(b.reward.mats).map(([k, n]) => `${n} ${MATERIALS[k].name}`).join(', ')}${open ? '' : ` · <em>${lockText}</em>`}</small></div>`;
    const d = hasMilestone(pr, 'daily'), w = hasMilestone(pr, 'weekly');
    return `<h3>Daily bounties <span class="dim">· new ones in ${left(tomorrow - now)}</span></h3>${(B.daily || []).map((b) => card(b, d, 'unlocks at account level 3')).join('')}
      <h3>Weekly bounties <span class="dim">· new ones in ${left(nextMon - now)}</span></h3>${(B.weekly || []).map((b) => card(b, w, 'unlocks at account level 6')).join('')}
      <p class="dim">Rewards are paid the moment a bounty completes.</p>`;
  }
  records(pr) {
    return `<table class="pg-rec"><tr><th>Mission</th><th>Best time</th><th>Par (S)</th><th>Best rank</th><th>Clears</th></tr>${MISSIONS.map((m) => { const r = pr.records[m.id]; return `<tr><td>${esc(m.name)}</td><td>${r && r.best ? fmtTime(r.best) : '–'}</td><td>${PAR[m.id] ? fmtTime(PAR[m.id]) : '–'}</td><td>${r && r.rank ? `<b style="color:${RANK_COL[r.rank]}">${r.rank}</b>` : '–'}</td><td>${r ? r.clears : 0}</td></tr>`; }).join('')}</table>
      <h3>Mission grades</h3><table class="pg-rec"><tr><th>Mission type</th><th>Best grade</th>${OPS_MAPS.map((b) => `<th>${esc(OPS_BIOME[b].name)}</th>`).join('')}<th>Graded runs</th></tr>${OPS_TYPES.map((t) => { const r = bestOf(pr, t); const cell = (q) => q ? `<b style="color:${GRADE_COL[q.g]}">${q.g}</b> <span class="dim">${q.s}</span>` : '–'; return `<tr><td>${esc(OPS_TYPE[t].name)}</td><td>${cell(r)}</td>${OPS_MAPS.map((b) => `<td>${cell(bestOf(pr, t, b))}</td>`).join('')}<td>${r ? r.n : 0}</td></tr>`; }).join('')}</table>
      <p class="dim">Rank S: clear within par with no falls · A: within 1.6× par and at most 2 falls · B: any clear. Free hunts (the Wilds, the Dunes) clear when Grimtusk / Khepra falls; their time runs until that kill.</p>`;
  }
  items() { // every gear piece the hero holds: equipped first
    const p = this.g.player, out = [];
    for (const k of EQUIP_SLOTS) if (p.equipment[k]) out.push({ key: 'eq:' + k, it: p.equipment[k], at: 'eq', slot: k });
    p.inventory.forEach((it, i) => { if (it && it.slot !== 'sigil') out.push({ key: 'inv:' + i, it, at: 'inv', idx: i }); });
    return out;
  }
  /** at Borin's forge (the village Blacksmith); the painted tavern hub has no smithy, so anywhere in town works there */
  inTown() {
    const p = this.g.player; if (!p || p.dead || !inTownArea(p.x, p.y)) return false;
    const w = (this.g.sim && this.g.sim.world) || (this.g.view && this.g.view.world);
    return hubLayoutOf(w) === 'tavern' || nearStation(p.x, p.y, 'village', 70) === STATION.smith;
  }
  cost(c) { const pr = this.pr; return `<div class="fg-cost"><span class="${pr.gold >= c.gold ? 'ok' : 'no'}" title="You have ${pr.gold} gold">${c.gold} gold</span>${Object.entries(c.mats).map(([k, n]) => `<span class="${(pr.mats[k] | 0) >= n ? 'ok' : 'no'}" style="--mc:${MATERIALS[k].color}" title="${esc(MATERIALS[k].name)} (${matGrade(k)}): you have ${pr.mats[k] | 0}, need ${n}. Drops from: ${esc(MAT_WHERE[k] || MATERIALS[k].desc)}"><i></i>${n} ${esc(MATERIALS[k].name)} <small>(${pr.mats[k] | 0}/${n})</small></span>`).join('')}</div>`; }
  /** the material wallet strip (what you own, grade + where it drops on hover) */
  wallet(pr) {
    const ids = MAT_IDS.filter((id) => (pr.mats[id] | 0) > 0);
    return `<div class="fg-wallet"><b>Material wallet</b>${ids.length ? ids.map((id) => { const M = MATERIALS[id]; return `<span class="mat-chip" style="--mc:${M.color}" title="${esc(M.name)} (${matGrade(id)}) · ${esc(MAT_WHERE[id] || M.desc)}"><i></i>${esc(M.name)} <b>${pr.mats[id] | 0}</b></span>`; }).join('') : '<i class="dim">empty: farm hordes in the biomes</i>'}</div>`;
  }
  forge(pr, acc) {
    const forgeOn = hasMilestone(pr, 'forge');
    const sub = `<div class="pg-tabs sub">${[['upgrade', 'Upgrade'], ['ascend', 'Ascend'], ['reroll', 'Reroll'], ['craft', 'Craft'], ['salvage', 'Salvage']].map(([id, n]) => `<button class="tab${this.forgeTab === id ? ' on' : ''}" data-ftab="${id}">${n}</button>`).join('')}<span class="fg-smith">⚒ Borin, Blacksmith</span></div>`;
    if (!forgeOn && this.forgeTab === 'salvage') return sub + this.salvageTab(pr);
    if (!forgeOn) return sub + `<p class="fg-lock">Salvage is open now · the rest of the Forge opens at account level 2. Finish an outing to earn account XP.</p>`;
    const where = this.inTown() ? '' : `<p class="fg-lock">Visit Borin the Blacksmith (Artisans' Row, west of the fountain in Brightwater Village) to work the Forge. You can look around from here.</p>`;
    if (this.forgeTab === 'salvage') return sub + where + this.salvageTab(pr) + this.wallet(pr);
    if (this.forgeTab === 'craft') return sub + where + this.craftTab(pr, acc) + this.wallet(pr);
    if (this.forgeTab === 'ascend') return sub + where + this.ascendTab(pr) + this.wallet(pr);
    if (this.forgeTab === 'reroll') return sub + where + this.rerollTab(pr) + this.wallet(pr);
    const list = this.items();
    if (!list.find((x) => x.key === this.sel)) this.sel = list[0] ? list[0].key : null;
    const cur = list.find((x) => x.key === this.sel), cap = upgradeCap(acc.level);
    let detail = '<p class="dim">No gear to upgrade.</p>';
    if (cur) {
      const it = cur.it, c = upgradeCost(it), now = upStats(it), R = RARITIES[it.rarity] || RARITIES[0];
      const nxt = c ? upStats({ ...it, up: c.next }) : null, pity = pr.pity[it.uid] | 0;
      const rows = Object.keys(it.stats).map((k) => `<tr><td>${STAT_LABELS[k] || k}</td><td>${fmt(k, now[k])}</td><td>${nxt ? `→ <b class="${nxt[k] !== now[k] ? 'up' : ''}">${fmt(k, nxt[k])}</b>` : ''}</td></tr>`).join('');
      const capped = c && c.next > cap;
      detail = `<div class="fg-item"><div class="nm" style="color:${R.color}">${esc(itemName(it))}</div><div class="dim">${R.name} ${SLOT_LABEL[it.slot] || it.slot} · tier ${it.tier}${it.set ? ` · ${SETS[it.set].short} set` : ''}${cur.at === 'eq' ? ' · equipped' : ''}</div>
        <div class="fg-pips">${Array.from({ length: 10 }, (_, i) => `<i class="${i < (it.up | 0) ? 'on' : i < cap ? '' : 'cap'}"></i>`).join('')}</div>
        <table class="fg-stats">${rows}</table>
        ${!c ? '<p class="fg-max">Fully upgraded (+10)</p>' : `${this.cost(c)}<div class="fg-chance">Success chance <b>${Math.round(Math.min(1, upgradeChance(c.next, pity) + (c.next > 7 ? upLuck(pr) : 0)) * 100)}%</b>${pity ? ` <i>(+${pity * 10}% from ${pity} failure${pity > 1 ? 's' : ''})</i>` : ''}${c.next >= 7 ? ' · a failure keeps the item and its level' : ''}</div>
        ${capped ? `<p class="fg-lock">+${c.next} needs account level ${c.next <= 5 ? 4 : c.next <= 7 ? 7 : 10}</p>` : ''}
        <button class="btn" id="fgUpgrade"${capped || !canPay(pr, c) || !this.inTown() ? ' disabled' : ''}>Upgrade to +${c.next}</button>`}</div>`;
    }
    return sub + where + `<div class="fg-wrap"><div class="fg-list">${list.map((x) => `<button class="fg-pick${x.key === this.sel ? ' on' : ''}" data-item="${x.key}" style="--rc:${(RARITIES[x.it.rarity] || RARITIES[0]).color}">${esc(itemName(x.it))}<small>${x.at === 'eq' ? 'equipped' : 'bag'}</small></button>`).join('')}</div>${detail}</div>` + this.wallet(pr);
  }
  /** the story chain: chapter by chapter, with status, giver, objective, reward and unlocks */
  journal(pr) {
    const legacy = this.g.story ? this.g.story.legacy() : {};
    const done = CHAPTERS.filter((c) => pr.story && pr.story.done[c.id]).length, cur = pr.story ? curChapter(pr.story) : null;
    const ST = { done: ['✔', 'Complete'], ready: ['★', 'Objective done: report back'], active: ['▸', 'In progress'], cleared: ['✓', 'Already beaten: report after earlier chapters'], locked: ['🔒', 'Locked'] };
    const card = (c) => {
      const s = pr.story ? chStatus(pr, c, legacy) : 'locked', g = NPCS[c.giver], legacyDone = pr.story && pr.story.done[c.id] === 'legacy';
      const rw = `${c.reward.gold}g · ${c.reward.xp} account XP · ${Object.entries(c.reward.mats).map(([k, n]) => `${n} ${MATERIALS[k].name}`).join(', ')}`;
      return `<div class="jr-ch ${s}"><div class="jr-mark">${ST[s][0]}</div><div class="jr-txt">
        <div class="jr-top"><b>Chapter ${c.n}: ${esc(c.title)}</b><span class="jr-st">${ST[s][1]}${legacyDone ? ' (cleared before the journal)' : ''}</span></div>
        ${s === 'locked' ? `<p class="dim">Finish chapter ${c.n - 1} to learn more.</p>` : `<p>${esc(c.goal)}</p>
        ${s === 'active' || s === 'ready' ? `<p class="dim">${s === 'ready' ? `Talk to ${esc(g.name)} (${esc(g.title)}) in Brightwater to turn it in.` : `Given by ${esc(g.name)}. ${esc(c.where)}`}</p>` : ''}
        <div class="jr-rw"><span>Reward:</span> ${esc(rw)}${legacyDone ? ' <i>(unlocks only)</i>' : ''}</div>
        <div class="jr-ul">${c.unlocks.map((u) => `<span class="jr-u${s === 'done' ? ' got' : ''}">${esc(UNLOCKS[u].name)}<small>${esc(UNLOCKS[u].text)}</small></span>`).join('')}</div>`}
      </div></div>`;
    };
    const title = pr.story && allDone(pr.story) ? '<span class="rw-title">Starbreaker</span>' : '';
    return `<div class="jr-head"><div><h3>The Brightwater Chronicle ${title}</h3><span class="dim">${cur ? `Current: chapter ${cur.n}, ${esc(cur.title)}` : 'The chain is complete. Brightwater sings your name.'}</span></div>
      <div class="jr-prog"><b>${done} / ${CHAPTERS.length}</b><div class="rw-bar"><i style="width:${Math.round((done / CHAPTERS.length) * 100)}%"></i></div></div></div>
      <div class="jr-list">${CHAPTERS.map(card).join('')}</div>`;
  }
  craftTab(pr) {
    const r = RECIPES.find((x) => x.id === this.recipe) || RECIPES[0];
    const open = (x) => recipeOpen(pr, x), mile = (x) => MILESTONES.find((m) => m.id === x.unlock);
    const how = (x) => { const m = mile(x), c = patternChapter(x); return [m ? `account level ${m.lv}` : '', c ? `chapter ${c.n}` : ''].filter(Boolean).join(' or '); };
    const howLong = (x) => { const m = mile(x), c = patternChapter(x); return [m ? `${m.name} (account level ${m.lv})` : '', c ? `Borin's pattern from story chapter ${c.n}, "${c.title}"` : ''].filter(Boolean).join(', or '); };
    const full = this.g.player.inventory.indexOf(null) < 0, lvLow = (x) => (this.g.player.level | 0) < (x.lv | 0);
    // piece 4: exclusive recipes are coloured by their tier (Set green / Trial pink / Extreme red) and Trial / Extreme make any slot but Relic
    const rcol = (x) => x.exotic ? RARITIES[EXOTIC[x.exotic].rarity].color : x.set ? SETS[x.set].color : '#b86bff';
    const exclTag = (x) => x.excl === 'set' ? (x.set === 'frostveil' ? 'Frostveil set' : x.set === 'astral' ? 'Astral set' : 'Emberdeep set') : x.excl === 'trial' ? 'Trial tier' : 'Extreme tier';
    const slots = r.relic ? ['relic'] : r.exotic ? EXOTIC_SLOTS : SET_SLOTS; // gear expansion: every slot (Relic only from its recipe)
    if (!slots.includes(this.slot)) this.slot = slots[0];
    return `<div class="fg-wrap"><div class="fg-list">${RECIPES.map((x) => `<button class="fg-pick${x.id === r.id ? ' on' : ''}${open(x) ? '' : ' locked'}" data-recipe="${x.id}" style="--rc:${rcol(x)}">${esc(x.name)}<small>${open(x) ? (x.excl ? exclTag(x) : x.set ? 'set' : `tier ${x.tier}`) + (x.lv ? ` · Lv ${x.lv}` : '') + (canPay(pr, x.cost) ? ' · ✔' : '') : how(x)}</small></button>`).join('')}</div>
      <div class="fg-item"><div class="nm" style="color:${r.exotic || r.set ? rcol(r) : '#d9c2ff'}">${esc(r.name)}</div><p>${esc(r.desc)}</p>
        <div class="fg-slots">${slots.map((s) => `<button class="tab${this.slot === s ? ' on' : ''}" data-slot="${s}">${SLOT_LABEL[s] || s}</button>`).join('')}</div>
        ${this.cost(r.cost)}
        ${open(r) ? '' : `<p class="fg-lock">Unlocks with ${esc(howLong(r))}</p>`}
        ${full ? '<p class="fg-lock">Your bag is full: make room first</p>' : ''}
        ${lvLow(r) ? `<p class="fg-lock">Needs hero level ${r.lv} (you are ${this.g.player.level})</p>` : ''}
        <button class="btn" id="fgCraft"${!open(r) || lvLow(r) || !canPay(pr, r.cost) || full || !this.inTown() ? ' disabled' : ''}>Craft ${SLOT_LABEL[this.slot] || this.slot}</button></div></div>`;
  }
  /** horde pass 2: Ascend - raise any Common..Legendary item one tier (gold + multi-biome materials + a catalyst of that slot) */
  ascendTab(pr) {
    const p = this.g.player, list = this.items().filter((x) => canAscend(x.it));
    if (!list.find((x) => x.key === this.sel)) this.sel = list[0] ? list[0].key : null;
    const cur = list.find((x) => x.key === this.sel);
    let detail = '<p class="dim">Nothing to ascend: any gear below tier 8 (Common to Legendary, set pieces, Trial and Extreme pieces) can climb a tier here.</p>';
    if (cur) {
      const it = cur.it, c = ascendCost(it, pr), nx = ascendItem(it, BASE_NAMES, PREFIX), R = RARITIES[it.rarity] || RARITIES[0];
      const cats = p.inventory.map((q, i) => ({ q, i })).filter((x) => isCatalyst(it, x.q));
      if (!cats.find((x) => x.i === this.cat)) this.cat = cats.length ? cats.sort((a, b) => (a.q.rarity | 0) - (b.q.rarity | 0) || (a.q.tier | 0) - (b.q.tier | 0))[0].i : -1;
      const rows = Object.keys(it.stats).map((k) => `<tr><td>${STAT_LABELS[k] || k}</td><td>${fmt(k, it.stats[k])}</td><td>→ <b class="up">${fmt(k, nx.stats[k])}</b></td></tr>`).join('');
      const lvOk = p.level >= c.lv;
      detail = `<div class="fg-item"><div class="nm" style="color:${R.color}">${esc(itemName(it))}</div><div class="dim">${R.name} ${SLOT_LABEL[it.slot] || it.slot} · tier ${it.tier} → <b style="color:#ffd23f">tier ${c.tier}</b>${nx.name !== it.name ? ` · becomes ${esc(nx.name)}` : ''}${cur.at === 'eq' ? ' · equipped' : ''}</div>
        <table class="fg-stats">${rows}</table>
        <p class="dim">Base stats (before +${it.up | 0}) rise to the tier-${c.tier} values; rarity, affixes and the +level stay.</p>
        ${this.cost(c)}
        <div class="fg-cat"><b>Catalyst</b> <span class="dim">(consumed: another ${SLOT_LABEL[it.slot] || it.slot}, tier ${it.tier}+, not upgraded)</span><div class="fg-catl">${cats.length ? cats.map(({ q, i }) => `<button class="fg-pick sm${i === this.cat ? ' on' : ''}" data-cat="${i}" style="--rc:${(RARITIES[q.rarity] || RARITIES[0]).color}">${esc(itemName(q))}<small>tier ${q.tier}</small></button>`).join('') : '<i class="fg-lock">No catalyst in your bag: any tier ' + it.tier + '+ ' + (SLOT_LABEL[it.slot] || it.slot) + ' from the hordes works</i>'}</div></div>
        ${lvOk ? '' : `<p class="fg-lock">Tier ${c.tier} needs hero level ${c.lv} (you are ${p.level})</p>`}
        <button class="btn" id="fgAscend"${!lvOk || this.cat < 0 || !canPay(pr, c) || !this.inTown() ? ' disabled' : ''}>Ascend to tier ${c.tier}</button></div>`;
    }
    return `<p class="dim">Any gear can stay relevant: ascend a favourite piece tier by tier up to tier 8; set, Trial and Extreme pieces too (tiers 6-8 each need a dungeon or Trial trophy; hero level: ${Object.entries(TIER_LV).filter(([t]) => t > 1).map(([t, l]) => `T${t} Lv ${l}`).join(' · ')}).</p>
      <div class="fg-wrap"><div class="fg-list">${list.map((x) => `<button class="fg-pick${x.key === this.sel ? ' on' : ''}" data-item="${x.key}" style="--rc:${(RARITIES[x.it.rarity] || RARITIES[0]).color}">${esc(itemName(x.it))}<small>${x.at === 'eq' ? 'equipped' : 'bag'} · T${x.it.tier}</small></button>`).join('') || '<p class="dim">—</p>'}</div>${detail}</div>`;
  }
  /** game loop A3: Reroll - pick one sub-stat of a piece and roll it again (main stats never move; each reroll of a piece costs more) */
  rerollTab(pr) {
    const p = this.g.player, list = this.items().filter((x) => canReroll(x.it));
    if (!list.find((x) => x.key === this.sel)) this.sel = list[0] ? list[0].key : null;
    const cur = list.find((x) => x.key === this.sel);
    let detail = '<p class="dim">Nothing to reroll: pieces with sub-stats (Rare and up) can roll them again here.</p>';
    if (cur) {
      const it = cur.it, keys = rerollKeys(it), R = RARITIES[it.rarity] || RARITIES[0], c = rerollCost(it, pr);
      if (!keys.includes(this.rk)) this.rk = keys[0];
      const pool = subChoices(it, p.cls).filter((q) => q.stat === this.rk || !(q.stat in it.stats));
      const lvOk = p.level >= REROLL.lv;
      const rows = Object.keys(it.stats).map((k) => { const sub = keys.includes(k); return `<tr class="${sub ? 'rr-sub' : 'rr-main'}"><td>${sub ? `<button class="fg-pick sm${k === this.rk ? ' on' : ''}" data-rk="${k}" style="--rc:${k === this.rk ? '#ffd23f' : '#8a8fb0'}">${STAT_LABELS[k] || k}</button>` : `${STAT_LABELS[k] || k} <small class="dim">main</small>`}</td><td>${fmt(k, it.stats[k])}</td></tr>`; }).join('');
      detail = `<div class="fg-item"><div class="nm" style="color:${R.color}">${esc(itemName(it))}</div><div class="dim">${R.name} ${SLOT_LABEL[it.slot] || it.slot} · tier ${it.tier}${cur.at === 'eq' ? ' · equipped' : ''}${it.rr ? ` · rerolled ${it.rr}×` : ''}</div>
        <table class="fg-stats">${rows}</table>
        <p class="dim">Pick a sub-stat (the gold ones). It rolls into any of ${pool.length} possible stat${pool.length === 1 ? '' : 's'} at this piece's tier and rarity: ${pool.slice(0, 8).map((q) => STAT_LABELS[q.stat] || q.stat).join(', ')}${pool.length > 8 ? '…' : ''}. Main stats and the other subs never change.</p>
        ${this.cost(c)}
        ${lvOk ? '' : `<p class="fg-lock">Rerolling needs hero level ${REROLL.lv} (you are ${p.level})</p>`}
        <button class="btn" id="fgReroll"${!lvOk || !this.rk || !canPay(pr, c) || !this.inTown() ? ' disabled' : ''}>Reroll ${esc(STAT_LABELS[this.rk] || this.rk || '')}</button></div>`;
    }
    return `<p class="dim">Close to perfect? Reroll the one stat you don't want. Each reroll of the same piece costs more (gold + that biome's rare material).</p>
      <div class="fg-wrap"><div class="fg-list">${list.map((x) => `<button class="fg-pick${x.key === this.sel ? ' on' : ''}" data-item="${x.key}" style="--rc:${(RARITIES[x.it.rarity] || RARITIES[0]).color}">${esc(itemName(x.it))}<small>${x.at === 'eq' ? 'equipped' : 'bag'} · T${x.it.tier}${x.it.rr ? ` · ↻${x.it.rr}` : ''}</small></button>`).join('') || '<p class="dim">—</p>'}</div>${detail}</div>`;
  }
  doReroll() {
    const pr = this.pr, p = this.g.player, cur = this.items().find((x) => x.key === this.sel); if (!cur || !this.inTown() || p.level < REROLL.lv) return;
    if (this.forgeBusy()) return this.say('Borin is still working on it...', 'err');
    const it = cur.it, c = rerollCost(it, pr), k = this.rk; if (!c || !rerollKeys(it).includes(k)) return;
    const roll = rerollSub({ next: Math.random }, it, k, p.cls); if (!roll) return;
    if (!pay(pr, c)) return this.say('Not enough gold or materials.', 'err');
    const rr = it.rr | 0, before = `${STAT_LABELS[k] || k} ${fmt(k, it.stats[k])}`;
    this.g.command(cur.at === 'eq' ? { type: 'reroll', at: 'eq', slot: cur.slot, k, nk: roll.nk, v: roll.v, rr } : { type: 'reroll', at: 'inv', idx: cur.idx, k, nk: roll.nk, v: roll.v, rr });
    this.forgeWait(it, (x) => (x.rr | 0) > rr, c);
    profile.save();
    if (this.g.audio) { this.g.audio.play('slam'); this.g.audio.play('legendary'); }
    this.rk = roll.nk;
    setTimeout(() => this.say(`Rerolled: ${before} → ${STAT_LABELS[roll.nk] || roll.nk} ${fmt(roll.nk, roll.v)}`, 'ok'), 60);
  }
  doAscend() {
    const pr = this.pr, p = this.g.player, cur = this.items().find((x) => x.key === this.sel); if (!cur || !this.inTown()) return;
    if (this.forgeBusy()) return this.say('Borin is still working on it...', 'err');
    const it = cur.it, c = ascendCost(it, pr), cat = p.inventory[this.cat];
    if (!c || p.level < c.lv || !isCatalyst(it, cat)) return;
    if (!pay(pr, c)) return this.say('Not enough gold or materials.', 'err');
    this.g.command(cur.at === 'eq' ? { type: 'ascend', at: 'eq', slot: cur.slot, cat: this.cat } : { type: 'ascend', at: 'inv', idx: cur.idx, cat: this.cat });
    { const t0 = it.tier | 0; this.forgeWait(it, (x) => (x.tier | 0) > t0, c); }
    profile.save();
    if (this.g.audio) { this.g.audio.play('slam'); this.g.audio.play('levelup'); }
    this.cat = -1;
    setTimeout(() => this.say(`Ascended to tier ${c.tier}!`, 'ok'), 60);
  }
  salvageTab() {
    const p = this.g.player, list = p.inventory.map((it, i) => ({ it, i })).filter((x) => x.it); // (game loop A1: old Trial Sigils break down too)
    const chip = (v) => `<span class="gold">+${v.gold}g</span> ${Object.entries(v.mats).map(([k, n]) => `<span class="mat-chip" style="--mc:${MATERIALS[k].color}"><i></i>${n} ${esc(MATERIALS[k].name)}</span>`).join(' ')}`;
    const commons = list.filter((x) => (x.it.rarity | 0) === 0 && !(x.it.up | 0) && !x.it.lock); // (step 4: locked pieces never go in bulk)
    const ok = this.inTown();
    const ask = this.svAsk && this.svAsk.idxs.map((i) => p.inventory[i]).filter(Boolean);
    const askBox = ask && ask.length ? (() => { const top = ask.reduce((a, b) => ((b.rarity | 0) > (a.rarity | 0) ? b : a)), R = RARITIES[top.rarity] || RARITIES[0], t = { gold: 0, n: 0 }; for (const it of ask) { const v = salvageValue(it); t.gold += v.gold; for (const n of Object.values(v.mats)) t.n += n; }
      return `<div class="sv-confirm" role="alertdialog"><b>Salvage ${ask.length > 1 ? `${ask.length} pieces including ` : ''}<span style="color:${R.color}">${esc(itemName(top))}</span> (${R.name})?</b><small>You get +${t.gold}g and ${t.n} materials. This can't be undone.</small><div class="sv-confirm-btns"><button class="btn small danger" id="svYes">Salvage it</button><button class="btn small" id="svNo">Keep</button></div></div>`; })() : '';
    return askBox + `<p class="dim">Break bag gear down into materials and gold: every horde drop is worth something. Upgraded pieces give part of their upgrade cost back. Equipped gear is never touched. (Or keep a piece as an Ascend catalyst.)</p>
      <div class="sv-list">${list.length ? list.map(({ it, i }) => { const R = RARITIES[it.rarity] || RARITIES[0]; return `<div class="sv-row"><b style="color:${R.color}">${esc(itemName(it))}</b><small class="dim">${R.name} ${SLOT_LABEL[it.slot] || it.slot} · tier ${it.tier}</small><span class="sv-val">${chip(salvageValue(it))}</span>${it.lock ? '<span class="dim" title="Locked: Ctrl+click it in the bag to unlock">🔒 locked</span>' : `<button class="btn small" data-salv="${i}"${ok ? '' : ' disabled'}>Salvage</button>`}</div>`; }).join('') : '<p class="dim">Your bag has no gear to salvage.</p>'}</div>
      ${commons.length > 1 ? `<button class="btn ghost" id="svCommons"${ok ? '' : ' disabled'}>Salvage all ${commons.length} Common pieces</button>` : ''}
      ${this.lowIdx().length > 1 ? `<button class="btn ghost" id="svLow"${ok ? '' : ' disabled'}>Salvage all ${this.lowIdx().length} Common + Rare pieces (not upgraded or crafted) · ${(() => { const t = { gold: 0, n: 0 }; for (const i of this.lowIdx()) { const v = salvageValue(p.inventory[i]); t.gold += v.gold; for (const n of Object.values(v.mats)) t.n += n; } return `+${t.gold}g, +${t.n} materials`; })()}</button>` : ''}`;
  }
  /** bag pieces worth breaking down in bulk: Common / Rare, not upgraded, ascended or crafted */
  lowIdx() { const p = this.g.player; return p.inventory.map((it, i) => (it && it.slot !== 'sigil' && !it.lock && (it.rarity | 0) <= 1 && !(it.up | 0) && !it.asc && !it.crafted ? i : -1)).filter((i) => i >= 0); }
  doSalvage(idxs, confirmed = false) {
    if (!this.inTown() || !this.g.village) return;
    const inv = this.g.player.inventory, prec = idxs.filter((i) => inv[i] && (inv[i].rarity | 0) >= SALVAGE_CONFIRM_RARITY);
    if (prec.length && !confirmed) { this.svAsk = { idxs: idxs.slice(), uids: idxs.map((i) => inv[i] && inv[i].uid) }; this.render(); return; } // Epic / Legendary and up: ask first
    if (Array.isArray(confirmed) && idxs.some((i, k) => !inv[i] || (confirmed[k] && inv[i].uid !== confirmed[k]))) return this.say('Your bag changed: nothing salvaged.', 'err'); // (the bag changed under the dialog)
    let n = 0; for (const i of idxs) if (this.g.village.takeOut(i, 'salvage')) n++;
    if (n && this.g.audio) this.g.audio.play('slam');
    if (n) this.say(`Salvaged ${n} piece${n > 1 ? 's' : ''}.`, 'ok');
  }
  say(msg, kind = 'ok') { this.msg = msg; this.msgKind = kind; this.render(); }
  /** forgefix: a paid Forge command waits until the hero's item shows it (co-op / launcher: the server's copy comes back a
   *  few ticks later) so a second click never pays again for a command the sim would reject. 3 s safety timeout. */
  forgeBusy() {
    const q = this.fpend; if (!q) return false;
    const now = Date.now(), cur = this.items().find((x) => x.it && x.it.uid === q.uid);
    if (now - q.t > FORGE_REFUND_MS || !cur || q.done(cur.it)) { this.fpend = null; return false; }
    return true;
  }
  /** bugpass: the sim confirmed a craft / had no bag room for it (co-op: the bag view can be a few ticks old): refund */
  craftOk(uid) { if (this.cpend && this.cpend.uid === uid) this.cpend = null; }
  craftBack(uid) {
    const q = this.cpend; if (!q || q.uid !== uid) return; this.cpend = null;
    const pr = this.pr; pr.gold = (pr.gold | 0) + (q.cost.gold | 0); for (const [k, n] of Object.entries(q.cost.mats || {})) pr.mats[k] = (pr.mats[k] | 0) + n; profile.save();
    this.say('Your bag is full: Borin gave the gold and materials back.', 'err');
  }
  forgeWait(it, done, cost = null) {
    const q = { uid: it.uid, t: Date.now(), done, cost }; this.fpend = q;
    // bugpass: a paid command the sim never applied (refused: the hero's item changed under it, a stale co-op view...) is
    // refunded instead of eating the gold + materials
    if (cost) setTimeout(() => {
      const cur = this.items().find((x) => x.it && x.it.uid === q.uid); if (!cur || done(cur.it)) return;
      const pr = this.pr; pr.gold = (pr.gold | 0) + (cost.gold | 0); for (const [k, n] of Object.entries(cost.mats || {})) pr.mats[k] = (pr.mats[k] | 0) + n; profile.save();
      if (this.fpend === q) this.fpend = null;
      this.say('Borin could not finish that one: your gold and materials are back.', 'err');
    }, FORGE_REFUND_MS);
  }
  doUpgrade() {
    const pr = this.pr, cur = this.items().find((x) => x.key === this.sel); if (!cur || !this.inTown()) return;
    if (this.forgeBusy()) return this.say('Borin is still working on it...', 'err');
    const it = cur.it, c = upgradeCost(it); if (!c || c.next > upgradeCap(accountLevel(pr.accXp).level)) return;
    const chance = Math.min(1, upgradeChance(c.next, pr.pity[it.uid] | 0) + (c.next > 7 ? upLuck(pr) : 0)); // (game loop C3: Starforged Anvil)
    if (!pay(pr, c)) return this.say('Not enough gold or materials.', 'err');
    const au = this.g.audio;
    if (Math.random() < chance) {
      delete pr.pity[it.uid];
      this.g.command(cur.at === 'eq' ? { type: 'upgrade', at: 'eq', slot: cur.slot, up: c.next } : { type: 'upgrade', at: 'inv', idx: cur.idx, up: c.next });
      this.forgeWait(it, (x) => (x.up | 0) >= c.next, c);
      if (au) { au.play('slam'); au.play('levelup'); }
      profile.save();
      setTimeout(() => this.say(`Success! ${itemName({ ...it, up: c.next })}`, 'ok'), 60); // (after the sim applied it)
    } else {
      pr.pity[it.uid] = (pr.pity[it.uid] | 0) + 1; profile.save();
      if (au) { au.play('slam'); au.play('nores'); }
      this.say(`The metal cracked: still +${it.up | 0}. Next try +10% (materials used).`, 'err');
    }
  }
  doCraft() {
    const pr = this.pr, r = RECIPES.find((x) => x.id === this.recipe); const p = this.g.player;
    if (r && r.exotic && !EXOTIC_SLOTS.includes(this.slot)) this.slot = 'weapon';
    if (r && r.relic) this.slot = 'relic';
    if (!r || !recipeOpen(pr, r) || !this.inTown() || p.inventory.indexOf(null) < 0 || (p.level | 0) < (r.lv | 0)) return;
    if (this.cpend && Date.now() - this.cpend.t < 3000) return this.say('Borin is still working on it...', 'err'); // (bugpass: one craft in flight at a time)
    if (!pay(pr, r.cost)) return this.say('Not enough gold or materials.', 'err');
    const it = craftItem({ next: Math.random }, r, p.cls, this.slot);
    this.cpend = { uid: it.uid, cost: r.cost, t: Date.now() };
    this.g.command({ type: 'craft', item: it });
    profile.save();
    if (this.g.audio) { this.g.audio.play('slam'); this.g.audio.play(it.rarity >= 3 ? 'legendary' : 'loot'); if (it.rarity >= 6) this.g.audio.play('levelup'); }
    this.say(`Crafted ${it.name}!`, 'ok');
  }
}
