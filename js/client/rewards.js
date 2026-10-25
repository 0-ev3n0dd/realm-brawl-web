import { SAVAGE_REWARD, SAVAGE_TITLE } from '../sim/savage.js';
// Progression and replay rewards, client side (experience pass 2). Owns the account profile (gold, materials, account
// XP, bounties, records: sim/meta.js), banks what every kill drops (gold + biome materials, floated over the kill),
// ticks the daily / weekly bounties, and when the party comes home shows the end-of-mission reward screen: outcome,
// time, rank S/A/B (records + "new best"), XP, gold, materials, loot, account XP with level-ups and new unlocks.
// Shared by the solo Game and the co-op NetGame (kills are yours when your hit landed last; a hunt clears for everyone).
import { duelCineEvent } from './duelcine.js';
import { rollCaches } from '../sim/herocraft.js';
import { rollAscension, PIECE_NAME, ascend, rankOf, grantPiece, ascendedCount } from '../sim/ascension.js';
import { ASC_RANK } from '../sim/ascended.js';
const DUEL_ART = { starfall: ['STARFALL', (v) => (v ? 'Move off the stars, and stay off: they fall twice' : 'Move off the three stars')], nova: ['MIRROR NOVA', (v) => (v ? 'GET IN: hug your shadow' : 'GET OUT: away from your shadow')], eclipse: ['TWIN ECLIPSE', (v) => (v ? 'Behind it first, then in front' : 'Its front first, then behind')], memory: ['MIRROR MEMORY', 'Four stars land in order: 1, 2, 3, 4'] };
import { heroOf } from '../sim/heroes.js';
import { CLASSES } from '../sim/data/classes.js';
import { MATERIALS, biomeAt, rollMaterials, rollGold, PROFILE_KEY, migrateProfile, refreshBounties, bountyTick, claimBounty,
  accountLevel, MILESTONES, hasMilestone, goldMul, matBonus, rankFor, recordClear, HUNT, PAR, heroTotalXp, itemName, trialDrops, accountXpOf, CLEAR_GOLD, CLEAR_XP } from '../sim/meta.js';
import { trialBiome, inTrialArea } from '../sim/trialconst.js';
import { inTorArea } from '../sim/glowconst.js';
import { opsBiome, opsOf, OPS_TYPE, OPS_BIOME, SWARM_TIERS } from '../sim/opsconst.js';
import { KEYS, grantDungeonKey, ascAccount, ascMilestone } from '../sim/meta.js';
import { practiceOn } from '../sim/practice.js';
import { xpToNext } from '../sim/progression.js';
import { zoneAt } from '../sim/constants.js';
import { MISSION } from '../sim/hub.js';
import { inTownArea } from '../sim/townconst.js';
import { inRaidArea } from '../sim/constants.js';
import { inAstArea } from '../sim/astraelconst.js';
import { inTombArea, inDunesArea } from '../sim/dunesconst.js';
import { inFrostArea, inCryptArea } from '../sim/frostconst.js';
import { inEmberArea, inForgeArea } from '../sim/emberconst.js';
import { inRiftArea } from '../sim/riftconst.js';
import { RARITIES } from '../sim/data/items.js';
import { fortuneOn } from '../sim/village.js';
import { migrateStory, allDone } from '../sim/story.js';
import { recordBest } from '../sim/opsbest.js';
import { setBestSource, BEST } from './bestgrade.js';
import { collect, collectKey } from '../sim/collection.js';
import { weeklyBoard, weeklyTick, firstSChest, WK, REGION_NAME, ONE_TIME, inRegion } from '../sim/weekly.js';
import { siteZone } from '../sim/sitegen.js';
export const AREAS = { inTownArea, inRaidArea, inAstArea, inTombArea, inDunesArea, inFrostArea, inCryptArea, inEmberArea, inForgeArea, inRiftArea, trialBiome, opsBiome };
const hasDOM = typeof document !== 'undefined';
const LS = typeof localStorage !== 'undefined' ? localStorage : null;
const SAVE_KEY = 'realmbrawl.save';
import { syncAstral } from './astralui.js';
import { rollAstral } from '../sim/astral.js';
/** riftweekly: what the bounty board needs to know: the Rift found / attuned (unlock flags), the account's best hero level */
export function bountyCtx(level = 0) {
  let u = {}, lv = level | 0;
  try { u = (LS && JSON.parse(LS.getItem('realmbrawl.unlocks') || '{}')) || {}; } catch { u = {}; }
  try { const sv = LS && JSON.parse(LS.getItem(SAVE_KEY) || 'null'); for (const c of (sv && sv.characters) || []) lv = Math.max(lv, c && c.level | 0); } catch { /* none */ }
  return { rift: !!(u.rift || u.atr), lv };
}

// ------------------------------------------------------------------ the profile (one per browser, every hero shares it)
export const profile = {
  data: null,
  load() {
    if (this.data) return this.data;
    let raw = null, chars = [];
    try { raw = LS && JSON.parse(LS.getItem(PROFILE_KEY) || 'null'); } catch { raw = null; }
    if (!raw) { try { const s = LS && JSON.parse(LS.getItem(SAVE_KEY) || 'null'); chars = (s && s.characters) || []; } catch { chars = []; } }
    this.data = migrateProfile(raw, chars, xpToNext);
    let legacy = {}; try { legacy = (LS && JSON.parse(LS.getItem('realmbrawl.unlocks') || '{}')) || {}; } catch { legacy = {}; }
    migrateStory(this.data, legacy); // (pass 4: already-cleared content counts toward the story chain)
    refreshBounties(this.data, undefined, bountyCtx());
    this.save();
    return this.data;
  },
  save() { try { if (LS && this.data) LS.setItem(PROFILE_KEY, JSON.stringify(this.data)); } catch { /* full / private */ } },
};
setBestSource(() => profile.load());
export const fmtTime = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const RANK_COL = { S: '#ffd23f', A: '#7ee0ff', B: '#c8b8ff' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const matChip = (id, n) => { const M = MATERIALS[id]; return `<span class="mat-chip" style="--mc:${M.color}"><i></i>${esc(M.name)} <b>×${n}</b></span>`; };

export class Rewards {
  constructor(game) {
    this.g = game; this.pr = profile.load(); this.run = null; this.queue = [];
    if (game && game.fx && game.fx.loot) game.fx.loot.goldMul = () => this.goldMul(); // (the pickup feed shows the banked gold)
    if (hasDOM && !document.getElementById('rewards')) {
      const d = document.createElement('div'); d.id = 'rewards'; d.className = 'overlay hidden'; document.body.appendChild(d);
    }
    this.root = hasDOM ? document.getElementById('rewards') : null;
    this.onKey = (e) => { if (this.isOpen() && (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape')) { e.preventDefault(); e.stopImmediatePropagation(); this.close(); } };
    if (hasDOM) addEventListener('keydown', this.onKey, { capture: true });
  }
  key(id, d) { try { return esc(this.g.input.kb.label(id) || d); } catch { return d; } }
  isOpen() { return !!(this.root && !this.root.classList.contains('hidden')); }
  close() {
    if (!this.root || !this.isOpen()) return;
    this.root.classList.add('hidden');
    if (this.g.player && this.g.command) this.g.command({ type: 'rwDone' }); // (fix pass: the sim holds Grimtusk's rift until every hero dismissed this)
  }
  destroy() { if (hasDOM) removeEventListener('keydown', this.onKey, { capture: true }); this.close(); }
  heroXp() { const p = this.g.player; return p ? heroTotalXp(p, xpToNext) : 0; }
  start(mission) {
    const p = this.g.player;
    this.run = { mission, t: 0, xpAll: 0, kills: 0, elites: 0, bosses: 0, deaths: 0, gold: 0, mats: {}, chains: 0, cleared: false, clearT: 0, xp0: this.heroXp(), lv0: p ? p.level : 1,
      inv0: new Set(p ? [...p.inventory, ...Object.values(p.equipment)].filter(Boolean).map((i) => i.uid) : []), done: [] };
  }
  update(dt, paused) {
    syncAstral(this.g); // (Part C: the Normal / Astral choice)
    if (this.run && !paused && dt) this.run.t += dt;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (now - (this.collAt || -1e9) > 1500) { this.collAt = now; this.scanColl(); } // game loop B2: the Collection
    // fix pass: a free hunt is settled (reward screen, records, bounties, story) right after its boss falls, in the field,
    // so nothing that follows (Grimtusk's rift to Vorthax, a mission change) can skip it; the rest of the outing keeps counting
    if (this.settleAt && typeof performance !== 'undefined' && performance.now() >= this.settleAt) { this.settleAt = 0; if (this.run && this.run.cleared && !this.run.cont) this.settle(); }
  }
  /** game loop B2: tick every set / Trial / Extreme piece and relic the hero holds (bag + gear; the stash once) into the Collection */
  scanColl() {
    const p = this.g.player; if (!p || !p.inventory) return;
    const items = [...p.inventory, ...Object.values(p.equipment || {})].filter(Boolean);
    if (!this.collStash) { this.collStash = 1; try { const s = LS && JSON.parse(LS.getItem('realmbrawl.stash') || 'null'); for (const T of (s && s.tabs) || []) for (const it of T.items || []) if (it) items.push(it); } catch { /* none */ } }
    const r = collect(this.pr, items, hasMilestone(this.pr, 'legend'));
    if (!r.fresh.length) return;
    profile.save(); this.dirty = true;
    const fx = this.g.fx;
    for (const x of r.rows) {
      if (fx) fx.banner('COLLECTION ROW COMPLETE', x.row.color || '#ffd23f', `${x.row.name} · +${x.gold} gold, +${x.xp} account XP${x.bag ? `, +${x.bag} bag slots` : ''}`, 3.2, 40);
      if (this.g.audio) this.g.audio.play('legendary');
    }
    if (!r.rows.length && fx && this.collSeen) fx.text(p.x, p.y - 80, `COLLECTION +${r.fresh.length}`, { size: 16, color: '#ffe39a', vy: -40, pop: 1.3, life: 1.2 });
    this.collSeen = 1;
  }
  /** game loop B3: Weekly Board progress (banner when a one-time reward is ready to claim at the Mission Counter) */
  weekly(t) {
    const B = weeklyBoard(Date.now()), done = weeklyTick(this.pr, B, t);
    for (const id of done) { const o = ONE_TIME.find((x) => x.id === id); if (this.g.fx && o) this.g.fx.banner('WEEKLY BOARD: REWARD READY', '#7dffb0', `${o.name} done · claim ${o.reward(B)} at the Mission Counter`, 3, 38); }
    if (done.length) { profile.save(); if (this.g.audio) this.g.audio.play('legendary'); }
  }
  settle() { const m = this.run.mission; this.finish('clear'); this.start(m); this.run.cont = true; }
  /** the account's gold multiplier (milestones x Elixir of Fortune): coin pickups bank face value x this */
  goldMul() { return goldMul(this.pr) * (fortuneOn(this.pr) ? 1.25 : 1) * (1 + this.heroFind('goldFind')) * (1 + ascAccount(ascendedCount(this.pr)).gold); } // (Part D: +1% gold per Ascended hero, max +10%)
  /** gear expansion: the local hero's Gold Find / Material Find sub-stats */
  heroFind(k) { const p = this.g && this.g.player, v = p && p.stats ? +p.stats[k] || 0 : 0; return Math.max(0, Math.min(0.5, v)); } // (capped at +50%)
  /** extra-material chance per material pickup (Gatherer's Eye milestone + Elixir of Fortune) */
  matBonus() { return matBonus(this.pr) + (fortuneOn(this.pr) ? 0.1 : 0) + this.heroFind('matFind'); }
  /** bank gold / materials into the profile (+ bounty ticks) */
  bank(gold, mats, x, y) {
    const pr = this.pr, R = this.run, fx = this.g.fx;
    if (gold) { pr.gold += gold; pr.stats.gold = (pr.stats.gold | 0) + gold; if (R) R.gold += gold; this.tick({ kind: 'gold', n: gold }); }
    let n = 0;
    for (const m of mats) { pr.mats[m.id] = (pr.mats[m.id] | 0) + m.n; if (R) R.mats[m.id] = (R.mats[m.id] | 0) + m.n; n += m.n; }
    if (n) this.tick({ kind: 'mat', n });
    if (fx && x != null) {
      if (gold) fx.text(x + 14, y - 30, `+${gold}g`, { size: 17, color: '#ffd23f', vy: -55, pop: 1.4, life: 0.9 });
      mats.forEach((m, i) => fx.text(x - 10, y - 50 - i * 18, `+${m.n} ${MATERIALS[m.id].name}`, { size: 16, color: MATERIALS[m.id].color, vy: -45, pop: 1.5, life: 1.3 }));
      if (mats.length && this.g.audio) this.g.audio.play('pickup');
    }
  }
  /** hero unlocks (sim/herocraft.js): roll this player's hero caches for a mission clear / boss kill */
  heroCache(src) {
    let got = []; try { got = rollCaches(this.pr, src); } catch (e) { console.warn('hero cache', e); }
    if (!got.length) return;
    profile.save();
    for (const cls of got) { const H = heroOf(cls); if (this.g.fx) this.g.fx.banner('HERO CACHE!', (CLASSES[cls] || {}).color || '#ffd23f', `${H.name} Cache · open it in the Heroes tab`, 2.6, 40); }
    if (this.g.audio) this.g.audio.play('legendary');
  }
  /** Part B: this player's Ascension drops (pieces weighted to the hero played; mats) */
  astralDrop(ev) {
    const r = rollAstral(Math.random, { elite: ev.elite, boss: ev.boss, etype: ev.etype });
    if (r.mats.length) this.bank(0, r.mats, ev.x, ev.y - 30);
    for (const q of r.pieces) { grantPiece(this.pr, q.cls, q.k); const H = heroOf(q.cls); if (this.g.fx) this.g.fx.banner('ASTRAL PIECE!', '#c9b6ff', `${PIECE_NAME[q.k]} · ${H.name} · from the Astral World`, 2.8, 40); if (this.g.audio) this.g.audio.play('legendary'); }
    if (r.pieces.length) profile.save(); this.dirty = true;
  }
  ascDrop(src) {
    const p = this.g.player; let r = null; try { r = rollAscension(this.pr, src, p && p.cls); } catch (e) { console.warn('ascension drop', e); }
    if (!r || (!r.pieces.length && !r.mats.length)) return;
    if (this.run) for (const m of r.mats) this.run.mats[m.id] = (this.run.mats[m.id] | 0) + m.n;
    profile.save(); this.dirty = true;
    for (const q of r.pieces) { const H = heroOf(q.cls); if (this.g.fx) this.g.fx.banner('ASCENSION PIECE!', '#c9b6ff', `${PIECE_NAME[q.k]} · ${H.name} · bring it to the Ascension Altar`, 2.8, 40); }
    if (r.pieces.length && this.g.audio) this.g.audio.play('legendary');
  }
  tick(t) {
    const done = bountyTick(this.pr, t);
    for (const b of done) {
      claimBounty(this.pr, b);
      if (this.run) this.run.done.push(b);
      if (this.g.fx) this.g.fx.banner('BOUNTY COMPLETE', '#ffd23f', `${b.text} · +${b.reward.gold} gold, +${b.reward.xp} account XP`, 2.6, 36);
      if (this.g.audio) this.g.audio.play('legendary');
    }
  }
  onEvent(ev) {
    if (practiceOn(this.g && this.g.sim)) return; // (Part E: practice pays nothing: no gold, mats, XP, keys, records, bounties, pieces)
    const p = this.g.player; if (!p) return;
    const me = ev.pid === p.id;
    if (ev.type === 'unlock' && me && /^[a-z]{2}sw\d+$/.test(ev.key || '')) { // (Part 0S: the weekly Savage first clear: +4 Savage Marks, once per boss per week, kept in the profile)
      const W = this.pr.svWeeks = this.pr.svWeeks || {};
      if (!W[ev.key]) { W[ev.key] = 1; for (const k of Object.keys(W)) if (+k.slice(4) < +ev.key.slice(4) - 8) delete W[k]; this.bank(0, [{ id: 'savage_mark', n: SAVAGE_REWARD.weekMarks }], p.x, p.y); if (this.g.fx) this.g.fx.banner('WEEKLY SAVAGE CLEAR', '#ff6a3d', `+${SAVAGE_REWARD.weekMarks} Savage Marks · the Savage coffer is yours`, 3, 38); profile.save(); }
      return;
    }
    if (ev.type === 'unlock' && me && /^[a-z]{2}sc$/.test(ev.key || '')) { // (Part 0S: the first-ever Savage clear: a title, an aura, a collection entry)
      const F = this.pr.savageFirst = this.pr.savageFirst || {};
      if (!F[ev.key]) { F[ev.key] = Date.now(); this.pr.titles = this.pr.titles || {}; const T = SAVAGE_TITLE[ev.key]; if (T) this.pr.titles[T] = 1; collectKey(this.pr, `savage:${ev.key.slice(0, 2)}`); profile.save(); if (this.g.fx) this.g.fx.banner('FIRST SAVAGE CLEAR', '#ff6a3d', `Title earned: ${T || 'Savage'} · Savage aura unlocked · logged in the Collection`, 4, 46); }
      return;
    }
    if (ev.type === 'ops' && ev.ph === 'end') { // a mission dungeon ended: bank this hero's Realm Gate keys, keep the summary for the results screen
      const k = ev.keys && ev.keys[p.id];
      if (k) { this.pr.keys = this.pr.keys || {}; for (const [id, n] of Object.entries(k)) this.pr.keys[id] = (this.pr.keys[id] | 0) + (n | 0); profile.save(); }
      if (ev.gr && ev.k && ev.sums && ev.sums[p.id]) { const r = recordBest(this.pr, ev.k, ev.b, ev.gr.g, ev.gr.s); BEST.last = { k: ev.k, b: ev.b, g: ev.gr.g, s: ev.gr.s, ...r }; profile.save(); } // (part 3: best grade per mission type, only for heroes who ran it)
      if (ev.gr && ev.k && ev.sums && ev.sums[p.id] && ev.why !== 'fail') { // game loop B3: the Weekly Board + the first-S chest per mission type per map
        this.weekly({ kind: 'ops', type: ev.k, biome: ev.b, g: ev.gr.g });
        this.heroCache({ ops: ev.b }); // (hero unlocks: a mission's hero cache)
        this.ascDrop({ ops: ev.b }); // (Part B: Astral Ash / Starsteel from Rift missions)
        this.tick({ kind: 'ops', biome: ev.b, rank: ev.gr.g }); // (riftweekly: Rift mission bounties)
        const ch = firstSChest(this.pr, ev.k, ev.b, ev.gr.g);
        if (ch) { profile.save(); BEST.firstS = ch; if (this.g.fx) this.g.fx.banner('FIRST S: CHEST', '#ffd23f', `${OPS_TYPE[ch.type].name} · ${OPS_BIOME[ch.biome].name}: +${ch.gold} gold, +${ch.xp} account XP, ${ch.n} ${MATERIALS[ch.mat].name}, a ${KEYS[ch.key] ? KEYS[ch.key].name : 'Realm Gate key'}`, 3.4, 40); if (this.g.audio) this.g.audio.play('legendary'); }
      }
      if (this.run && opsOf(this.run.mission)) this.run.ops = { why: ev.why, msg: ev.msg, rounds: ev.rounds | 0, term: ev.term | 0, tier: ev.tier | 0, t: ev.t | 0, keys: k || {}, sum: (ev.sums && ev.sums[p.id]) || {} };
      return;
    }
    if (ev.type === 'hub') {
      if (ev.ph === 'ops') { if (this.run && opsOf(this.run.mission)) this.finish(ev.why === 'fail' ? 'opsfail' : ev.why === 'extract' ? 'opsext' : 'clear'); return; } // (the mission's results; the walk back out restores the outing)
      if (profile.keyPend && ev.id === profile.keyPend && (ev.ph === 'deny' || ev.ph === 'mission')) { // (a Realm Gate key: refunded when the sim refused the trip)
        if (ev.ph === 'deny' && me) { this.pr.keys = this.pr.keys || {}; this.pr.keys[ev.id] = (this.pr.keys[ev.id] | 0) + 1; profile.save(); }
        profile.keyPend = null;
      }
      if (ev.ph === 'mission' && opsOf(ev.id)) { // into a mission dungeon from an entrance: the outing pauses (no results screen), the mission gets its own run
        if (this.run && this.run.cleared && !this.run.cont) this.settle();
        if (this.run && !opsOf(this.run.mission)) { this.outer = this.run; this.outer.xpAt = this.heroXp(); } else if (this.run) this.finish('onward');
        this.settleAt = 0; this.start(ev.id); return;
      }
      if (ev.ph === 'mission' && this.outer && this.outer.mission === ev.id && !this.run) { // back out of the mission: the outing carries on
        const O = this.outer, p2 = this.g.player; this.outer = null; this.run = O;
        if (p2) for (const it of [...p2.inventory, ...Object.values(p2.equipment)]) if (it) O.inv0.add(it.uid); // (the mission's loot was on its own screen)
        if (O.xpAt != null) O.xp0 += this.heroXp() - O.xpAt; return;
      }
      if (ev.ph === 'mission') { this.outer = null; if (this.run) { if (this.run.cleared && !this.run.cont) this.settle(); this.finish('onward'); } this.settleAt = 0; this.start(ev.id); } // (never lose an outing to a direct mission change)
      else if (ev.ph === 'town' && (!ev.pid || me)) this.finish(ev.why);
      return;
    }
    if (ev.type === 'death') {
      const R = this.run;
      if (R && HUNT[R.mission] && ev.etype === HUNT[R.mission] && !R.cleared && !R.cont) { R.cleared = true; R.clearT = R.t; this.settleAt = (typeof performance !== 'undefined' ? performance.now() : 0) + 2200; } // the hunt's target fell (anyone's kill)
      if (ev.boss && (ev.killer === p.id || Math.hypot(p.x - ev.x, p.y - ev.y) < 2000)) { this.heroCache({ boss: ev.etype }); this.ascDrop({ boss: ev.etype, ex: ev.ex }); } // (hero unlocks: a boss's hero cache, each player rolls their own)
      else if (ev.elite && ev.killer === p.id) { const bm = biomeAt(ev.x, ev.y, AREAS); if (bm === 'wilds') this.heroCache({ world: bm }); } // (an open-world elite: its map's hero cache)
      const tok = trialDrops(ev.etype, ev.ex); // a trial boss: its trial tokens (Extreme: + its core) for everyone in the arena
      if (tok.length && (inTrialArea(p.x, p.y) || (p.y > 29000 && inTorArea(p.x, p.y)) || (ev.etype === 'astrael' && Math.hypot(p.x - ev.x, p.y - ev.y) < 2000))) this.bank(0, tok, p.x, p.y - 40);
      if (ev.boss && ev.killer !== p.id && Math.hypot(p.x - ev.x, p.y - ev.y) < 1400) this.tick({ kind: 'boss', biome: biomeAt(ev.x, ev.y, AREAS), etype: ev.etype }); // (riftweekly: a world boss the party felled counts for everyone there)
      if (ev.as && (ev.boss ? Math.hypot(p.x - ev.x, p.y - ev.y) < 2000 : ev.elite && ev.killer === p.id)) this.astralDrop(ev); // (Part C: Astral materials, any-class pieces from Astral dungeon bosses)
      if (ev.killer !== p.id) return;
      const biome = biomeAt(ev.x, ev.y, AREAS); if (biome === 'town') return;
      const zone = Math.max(1, Math.min(4, (zoneAt(ev.x, ev.y) | 0) || (biome === 'wilds' ? 1 : 3)));
      // (horde pass 1: kill gold now rains out as coins - banked on 'pick' below; fodder roll materials 1 kill in 5 and
      //  tick kill bounties 1 kill in 4, so the hordes don't flood the economy before phase 2 rebalances it)
      const fod = !!ev.fod; this.fodN = (this.fodN | 0) + (fod ? 1 : 0);
      // (horde pass 2: a showering kill drops its biome materials as vacuumed pickups - banked on 'pick'; only a kill
      //  without a shower (an old server) still rolls them here)
      const mats = ev.sh || (fod && Math.random() >= 0.2) ? [] : rollMaterials(Math.random, { biome, zone, elite: ev.elite, boss: ev.boss, bonus: this.matBonus() });
      this.pr.stats.kills = (this.pr.stats.kills | 0) + 1;
      if (R) { R.kills++; if (ev.elite) R.elites++; if (ev.boss) R.bosses++; }
      if (!fod || this.fodN % 4 === 0) this.tick({ kind: 'kill', biome });
      if (ev.elite) this.tick({ kind: 'elite', biome });
      if (ev.boss) this.tick({ kind: 'boss', biome, etype: ev.etype });
      if (mats.length) this.bank(0, mats, ev.x, ev.y);
      this.dirty = true;
      return;
    }
    if (ev.type === 'pick' && me) { // the loot vacuum collected coins / materials (sim/drops.js): bank them
      let g = 0; const mats = [];
      const z = siteZone(p.x, p.y), rb = z && inRegion(weeklyBoard(Date.now()), z.key) ? WK.regionMat : 0; // (game loop B3: the Weekly Board's bonus region: +50% materials)
      for (const d of ev.d) { if (d[1] === 'gold') g += d[2]; else if (d[1] === 'mat' && MATERIALS[d[3]]) { let n = d[2] + (Math.random() < this.matBonus() ? 1 : 0); if (rb) n += Math.floor(n * rb + Math.random()); mats.push({ id: d[3], n }); } }
      if (g || mats.length) { this.bank(Math.round(g * this.goldMul()), mats); this.dirty = true; }
      return;
    }
    if (ev.type === 'fissure' && ev.ph === 'closed' && Array.isArray(ev.pids) && ev.pids.includes(p.id)) { this.bank(0, [{ id: ev.mat, n: ev.n }], ev.x, ev.y); this.weekly({ kind: 'fissure' }); this.dirty = true; return; } // (Part A4)
    if (ev.type === 'swarm' && ev.ph === 'open' && Array.isArray(ev.pids) && ev.pids.includes(p.id)) { this.weekly({ kind: 'swarm', key: ev.key }); this.tick({ kind: 'swarm', biome: biomeAt(ev.x, ev.y, AREAS) }); return; } // game loop B3
    if (ev.type === 'duel' && me) { // Part B: the Shadow Duel
      const fx = this.g.fx, H = heroOf(ev.cls), col = (CLASSES[ev.cls] || {}).color || '#c9b6ff';
      let ok = null; if (ev.ph === 'won') { ok = ascend(this.pr, ev.cls, p.level, ev.rk || 1); profile.save(); this.dirty = true; if (ok && this.g.onAscend) this.g.onAscend(ev.cls, ev.rk || 1); }
      if (duelCineEvent({ ...ev, ok: ok !== false, rank: rankOf(this.pr, ev.cls) || 1 }, this.g)) return; // (B3: the cinematic shows it)
      if (ev.ph === 'start' && fx) fx.banner('THE SHADOW DUEL', '#c9b6ff', `${ev.name} · it knows every move you know`, 3, 44);
      if (ev.ph === 'enrage' && fx) fx.banner('YOUR SHADOW RAGES', '#ff4d5e', 'Its strikes hit twice as hard now', 2.4, 36);
      if (ev.ph === 'ult' && fx) fx.banner(String(ev.name || 'ULTIMATE').toUpperCase(), '#ff4d5e', 'Your shadow calls your ultimate: get out of the ring', 1.8, 32);
      if (ev.ph === 'art' && fx) { const A = DUEL_ART[ev.k] || DUEL_ART.starfall; fx.banner(A[0], '#c9b6ff', typeof A[1] === 'function' ? A[1](ev.v) : A[1], 1.6, 28); fx.ring(ev.x, ev.y, 200, '#c9b6ff', 0.6, 5); } // (Part D: the rank duels)
      if (ev.ph === 'split' && fx) { fx.banner('SHADOW SPLIT', '#ff7ad8', `Break the ${ev.n} Shadow Shards before they burst (${Math.round((ev.t || 0) / 60)} s)`, 2.6, 38); fx.ring(ev.x, ev.y, 330, '#ff7ad8', 0.9, 7); fx.shake(0.5); }
      if (ev.ph === 'shatter' && fx) fx.banner('SHARDS SHATTERED', '#9dff8a', 'The split is broken', 1.6, 30);
      if (ev.ph === 'burst' && fx) { fx.banner('SHARD BURST', '#ff4d5e', 'Brace: the shards you left burst across the arena', 2, 34); fx.shake(0.7); }
      if (ev.ph === 'eclipse' && fx) { fx.banner('ECLIPSE OF SELF', '#ffd23f', 'Its arts come faster and the rim of the arena falls: stay central', 2.8, 40); fx.shake(0.8); }
      if (ev.ph === 'won') {
        if (fx) fx.banner(ok ? ((ev.rk || 1) > 1 ? `RANK A${ev.rk}` : 'ASCENDED') : 'SHADOW BANISHED', col, ok ? `${H.name} reached Ascension rank A${ev.rk || 1} · ${(ASC_RANK[ev.rk || 1] || {}).name || 'the stars remember'}` : 'The Altar could not take its price: nothing was spent', 4.5, 54);
        if (this.g.audio) this.g.audio.play('legendary');
      }
      if (ev.ph === 'lost' && fx) fx.banner('THE SHADOW HOLDS', '#c9b6ff', 'Nothing was lost: gather yourself and try again at the Altar', 3.2, 40);
      return;
    }
    if (!me) return;
    if (ev.type === 'chain') { if (this.run) this.run.chains++; this.tick({ kind: 'chain' }); }
    else if (ev.type === 'xp' && this.run) this.run.xpAll += ev.amount | 0; // (every kill's XP, even at the hero level cap)
    else if (ev.type === 'playerDeath' && this.run) this.run.deaths++;
  }
  /** the party is home: settle the outing and show the reward screen */
  finish(why) {
    const R = this.run; this.run = null;
    if (!R) return;
    const pr = this.pr, p = this.g.player, M = MISSION[R.mission] || { name: R.mission, stars: 1 };
    const OP = opsOf(R.mission), OR = R.ops || null;
    const cleared = !R.cont && (why === 'clear' || why === 'opsext' || (HUNT[R.mission] && R.cleared));
    const secs = HUNT[R.mission] ? (R.cleared ? R.clearT : R.t) : R.t;
    let rank = cleared ? rankFor(R.mission, secs, R.deaths) : null;
    if (cleared && OP && OR && OP.type === 'defense') rank = OR.rounds >= 3 ? 'S' : OR.rounds >= 2 ? 'A' : 'B'; // (Defense / Swarm: ranked by how far you pushed, not the clock)
    if (cleared && OP && OR && OP.type === 'swarm') rank = OR.tier >= 4 ? 'S' : OR.tier >= 2 ? 'A' : 'B';
    const rec = cleared ? recordClear(pr, R.mission, secs, rank) : null;
    const xp = Math.max(0, this.heroXp() - R.xp0);
    const lvAcc0 = accountLevel(pr.accXp).level;
    let bonusGold = 0, accXp = Math.round(accountXpOf(xp, R.xpAll || 0, R.kills));
    if (cleared) { bonusGold = Math.round(CLEAR_GOLD * (M.stars || 1) * { S: 2, A: 1.5, B: 1 }[rank]); accXp += Math.round(CLEAR_XP * (M.stars || 1) * { S: 2, A: 1.5, B: 1 }[rank]); pr.stats.clears = (pr.stats.clears | 0) + 1; }
    if (bonusGold) { pr.gold += bonusGold; R.gold += bonusGold; }
    const dkey = cleared ? grantDungeonKey(pr, R.mission) : ''; // (game loop A1: a dungeon clear hands you its boss's Trial key)
    let scholar = false; if (pr.buffs && pr.buffs.scholar) { accXp = Math.round(accXp * 1.25); pr.buffs.scholar = 0; scholar = true; } // Scholar's Tonic (Quartermaster)
    pr.accXp += accXp;
    if (cleared) { this.tick({ kind: 'clear', mission: R.mission, rank }); this.weekly({ kind: 'clear', mission: R.mission }); }
    const acc = accountLevel(pr.accXp), unlocked = MILESTONES.filter((m) => acc.level >= m.lv && !pr.seen.includes(m.id));
    for (const m of unlocked) pr.seen.push(m.id);
    profile.save();
    const loot = p ? [...p.inventory, ...Object.values(p.equipment)].filter((i) => i && !R.inv0.has(i.uid)) : [];
    const res = { R, M, why, cleared, secs, rank, rec, xp, levels: p ? p.level - R.lv0 : 0, accXp, acc, lvAcc0, unlocked, loot, bonusGold, scholar, dkey };
    this.last = res;
    res.storyNote = this.g.story ? this.g.story.rewardNote(res) : '';
    const empty = R.cont && !R.kills && !R.gold && !loot.length && !R.done.length && !res.levels && !unlocked.length;
    if (!empty) this.show(res); // (the after-the-hunt leg with nothing in it settles silently)
    return res;
  }
  show(r) {
    if (!this.root) return;
    const { R, M } = r, OP = opsOf(R.mission), title = OP ? (r.why === 'opsext' ? 'EXTRACTED' : r.cleared ? 'MISSION COMPLETE' : r.why === 'opsfail' ? 'MISSION FAILED' : 'MISSION ABANDONED') : r.cleared ? (HUNT[R.mission] ? 'HUNT COMPLETE' : 'MISSION CLEARED') : r.why === 'onward' ? 'OUTING COMPLETE' : r.why === 'wipe' ? 'PARTY WIPED' : r.why === 'death' ? 'CARRIED HOME' : 'BACK IN TOWN';
    const rankHtml = r.rank ? `<div class="rw-rank" style="--rc:${RANK_COL[r.rank]}">${r.rank}<small>rank</small></div>` : `<div class="rw-rank none"><span>–</span><small>${R.cont ? 'hunt already settled' : HUNT[R.mission] ? 'hunt not cleared' : 'no rank'}</small></div>`;
    const par = PAR[R.mission], best = this.pr.records[R.mission];
    const row = (k, v, cls = '') => `<div class="rw-row ${cls}"><span>${k}</span><b>${v}</b></div>`;
    const mats = Object.entries(R.mats).filter(([, n]) => n > 0);
    const accPct = r.acc.level >= 30 ? 100 : Math.round((r.acc.into / r.acc.need) * 100);
    const champ = (hasMilestone(this.pr, 'champion') ? '<span class="rw-title">Realm Champion</span>' : '') + (this.pr.story && allDone(this.pr.story) ? '<span class="rw-title">Starbreaker</span>' : '') + (ascMilestone(ascendedCount(this.pr), 'starborn') ? '<span class="rw-title asc-title">✦ Starborn Paragon</span>' : ''); // (Part D: all ten heroes Ascended)
    this.root.innerHTML = `<div class="panel rw-box">
      <div class="rw-head"><div><h1>${title}</h1><div class="rw-sub">${esc(M.name)}${R.cont ? ' · after the hunt' : ''}${HUNT[R.mission] && !r.cleared && !R.cont ? ` · defeat ${R.mission === 'field' ? 'Grimtusk' : R.mission === 'frost' ? 'Skaldra' : R.mission === 'ember' ? 'Pyrrhex' : 'Khepra'} for a rank` : ''}</div></div>${rankHtml}</div>
      <div class="rw-cols"><div class="rw-col">
        ${row('Time', fmtTime(r.secs) + (par ? ` <i>par ${fmtTime(par)}</i>` : '') + (r.rec && r.rec.newBest ? ' <em class="rw-new">NEW BEST</em>' : ''))}
        ${best && best.best ? row('Best', `${fmtTime(best.best)} · rank ${best.rank} · ${best.clears} clear${best.clears === 1 ? '' : 's'}`) : ''}
        ${OP ? opsRows(OP, R.ops, row) : ''}
        ${row('Enemies defeated', `${R.kills}${R.elites ? ` <i>(${R.elites} elite${R.elites === 1 ? '' : 's'})</i>` : ''}`)}
        ${r.dkey ? row('Trial key', `<span style="color:#ffd86a">🗝 ${esc(KEYS[r.dkey].name)} +1</span>`, 'good') : ''}
        ${row('Falls', R.deaths)}
        ${row('Chains landed', R.chains)}
        ${row('Hero XP', `<span data-count="${r.xp}">+${r.xp}</span>${r.levels > 0 ? ` <em class="rw-new">LEVEL UP ×${r.levels}</em>` : ''}`)}
        ${row('Gold', `<span data-count="${R.gold}">+${R.gold}</span>${r.bonusGold ? ` <i>(incl. ${r.bonusGold} clear bonus)</i>` : ''}`, 'gold')}
      </div><div class="rw-col">
        <h3>Materials</h3><div class="rw-mats">${mats.length ? mats.map(([id, n]) => matChip(id, n)).join('') : '<i class="dim">none this time</i>'}</div>
        <h3>Loot</h3><div class="rw-loot">${r.loot.length ? r.loot.slice(0, 8).map((it) => `<span style="color:${(RARITIES[it.rarity] || RARITIES[0]).color}">${esc(itemName(it))}</span>`).join('') + (r.loot.length > 8 ? `<i>+${r.loot.length - 8} more</i>` : '') : '<i class="dim">nothing new</i>'}</div>
        ${R.done.length ? `<h3>Bounties</h3><div class="rw-bounty">${R.done.map((b) => `<div>✔ ${esc(b.text)} <i>+${b.reward.gold}g</i></div>`).join('')}</div>` : ''}
      </div></div>
      <div class="rw-acc"><div class="rw-acc-top"><b>Account level ${r.acc.level}</b>${champ}<span>+${r.accXp} account XP${r.scholar ? ' <i>(Scholar\'s Tonic +25%)</i>' : ''}${r.acc.level > r.lvAcc0 ? ' · <em class="rw-new">ACCOUNT LEVEL UP</em>' : ''}</span></div><div class="rw-bar"><i style="width:${accPct}%"></i></div></div>
      ${r.unlocked.length || r.storyNote ? `<div class="rw-unlock">${r.unlocked.map((m) => `<div><b>Unlocked: ${esc(m.name)}</b> · ${esc(m.text)}</div>`).join('')}${r.storyNote ? `<div class="rw-story"><b>★ ${esc(r.storyNote)}</b></div>` : ''}</div>` : ''}
      <div class="rw-foot"><span class="dim">Gold ${this.pr.gold} · Progress <kbd>${this.key('progress', 'P')}</kbd> · Forge <kbd>${this.key('forge', 'U')}</kbd></span><button class="btn" id="rwOk">Continue <kbd>Enter</kbd></button></div>
    </div>`;
    this.root.classList.remove('hidden');
    const ok = this.root.querySelector('#rwOk'); if (ok) ok.onclick = () => this.close();
    // count-up on the numbers
    const els = [...this.root.querySelectorAll('[data-count]')], t0 = performance.now();
    const step = () => { const k = Math.min(1, (performance.now() - t0) / 900), e = 1 - Math.pow(1 - k, 3); for (const el of els) el.textContent = '+' + Math.round(+el.dataset.count * e); if (k < 1 && this.isOpen()) requestAnimationFrame(step); };
    requestAnimationFrame(step);
    if (this.g.audio) this.g.audio.play(r.cleared ? 'levelup' : 'loot');
  }
}

/** results screen rows for a mission dungeon: the objective's outcome + the reward focus */
function opsRows(OP, O, row) {
  if (!O) return '';
  const T = OPS_TYPE[OP.type], S = O.sum || {}, out = [];
  out.push(row(T.name, `${esc(O.msg || '')}`));
  if (OP.type === 'defense') out.push(row('Rounds', `${O.rounds} cleared`));
  else if (OP.type === 'mobile') out.push(row('Terminals', `${O.term} / 3 secured`));
  else if (OP.type === 'swarm') out.push(row('Survived', `${fmtTime(O.t)}${O.tier ? ` · <em class="rw-new">${SWARM_TIERS[O.tier - 1].toUpperCase()}</em>` : ''}`));
  const bits = [];
  if (S.sets) bits.push(`${S.sets} set piece${S.sets === 1 ? '' : 's'}`);
  if (S.relics) bits.push(`${S.relics} relic${S.relics === 1 ? '' : 's'}`);
  if (S.exotics) bits.push(`<em class="rw-new">${S.exotics} EXOTIC</em>`);
  for (const [id, n] of Object.entries(O.keys || {})) bits.push(`${n}× ${esc(KEYS[id] ? KEYS[id].name : id)}`);
  if (S.mats) bits.push(esc(S.mats));
  out.push(row('Mission rewards', bits.length ? bits.join(' · ') : '<i>none (objective failed)</i>', 'gold'));
  return out.join('');
}
