// The town's DOM UI (desktop + phone): the "Mission Counter" interact prompt (key press or tap), the mission board
// (field / Vorthax / Astrael / Astrael (Extreme), locked until unlocked, host-only in co-op), the pause menu's
// "Return to Town" button, and the Extreme unlock persisted in localStorage (the host's unlock opens it in co-op).
import { needsKey, useKey, PROFILE_KEY } from '../sim/meta.js';
import { profile } from './rewards.js';
import { MISSIONS, UNLOCK_KEYS } from '../sim/hub.js';
import { doorHidden } from '../sim/savage.js';
import { mapAstral } from './realmmap.js';
import { astralUnlocked } from './astralui.js';
import { recordUltClear } from '../sim/ultreward.js';
import { ascFlags } from '../sim/ascension.js';
import { inTownArea, nearCounter, CLERK, TOWN_NAME, hubGatePos, hubLayoutOf } from '../sim/townconst.js';
import { STATION } from '../sim/village.js';
import { GATES } from '../sim/dunesconst.js';
import { RealmMap } from './realmmap.js';
import { OPS_TYPES, OPS_TYPE, OPS_BIOME } from '../sim/opsconst.js';
import { opsIconUrl, iconOf } from './opsicons.js';
import { bestFor, gradeCol } from './bestgrade.js'; // part 3: best grade per mission type
import { TownCast } from './towntravel.js'; // World Map › Travel to Town: the cast bar
import { boardHtml, wireBoard, WB_CSS } from './weeklyui.js'; // game loop B3: the Weekly Board tab
import { weeklyBoard, weeklyState, ONE_TIME } from '../sim/weekly.js';
import { PracticeUI, practiceTabHtml, wirePracticeTab } from './practiceui.js'; // Part E: the Practice tab + the in-run timeline
import { practiceList } from '../sim/practice.js';

export const UNLOCK_KEY = 'realmbrawl.unlocks';
/** Persisted keys: Astrael (Extreme), its clear, the Dunes gate (Grimtusk), Tomb replays (first clear), the Trial Sigil. */
export { UNLOCK_KEYS };
/** game loop A1: gates that were open before attunement existed stay open (runs once per browser: the gmig flag) */
export function migrateUnlocks(u) {
  if (u.gmig) return false;
  if (u.dunes) u.atd = 1;
  if (u.frost || u.tomb) u.atf = 1;
  if (u.ember || u.crypt) u.ate = 1;
  u.gmig = 1; return true;
}
/** game loop C3: Vorthax (now Map 5's dungeon, lock vtx) and Astrael (the endgame, behind the Astral Sanctum attune) were
 *  open to everyone before: a browser that already played keeps both open (runs once: the gmig2 flag; new players earn them) */
export function migrateUnlocksC3(u, existed) {
  if (u.gmig2) return false;
  if (existed) { u.vtx = 1; u.ats = 1; }
  u.gmig2 = 1; return true;
}
export function loadUnlocks(key = UNLOCK_KEY) {
  const pick = (u) => Object.fromEntries(UNLOCK_KEYS.map((k) => [k, u[k] ? 1 : 0]));
  let raw = null, existed = false; try { raw = localStorage.getItem(key); existed = raw != null || localStorage.getItem(PROFILE_KEY) != null; } catch { /* storage off */ }
  let u; try { u = pick(JSON.parse(raw || '{}')); } catch { u = pick({}); }
  const m1 = migrateUnlocks(u), m2 = migrateUnlocksC3(u, existed);
  let m3 = false; try { const pr = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); if (pr && typeof pr === 'object') m3 = ascFlags(pr, u); } catch { /* none yet */ } // (Part D: the rank flags follow the profile's Ascension ranks)
  if (m1 || m2 || m3) saveUnlocks(u, key);
  return u;
}
export function saveUnlocks(u, key = UNLOCK_KEY) { try { localStorage.setItem(key, JSON.stringify(Object.fromEntries(UNLOCK_KEYS.map((k) => [k, u[k] ? 1 : 0])))); } catch {} }

const CSS = WB_CSS + `
.tu-prompt { position: fixed; left: 50%; bottom: 150px; transform: translateX(-50%); z-index: 12; font-size: 22px; background: #ffb52e; box-shadow: 0 5px 0 #c77a10, 0 7px 0 #2b2433; animation: tuBob 1.2s ease-in-out infinite; white-space: nowrap; }
.tu-prompt kbd { display: inline-block; min-width: 26px; padding: 0 6px; margin-right: 8px; border-radius: 7px; background: #2b2433; color: #ffd23f; font: inherit; font-size: 18px; text-shadow: none; }
@keyframes tuBob { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.18); } } /* a glow, not a bob: a still target is easier to tap */
.tu-board { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; background: rgba(10,8,20,.55); }
.tu-board .panel { width: min(860px, 94vw); max-height: 90vh; overflow: auto; position: relative; }
.tu-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; padding-right: 44px; } /* (UI pass: the clerk's line no longer runs under the ✕) */
.tu-head h2 { margin: 0; font-size: 30px; color: #ffd23f; text-shadow: 0 3px 0 #2b2433; letter-spacing: .5px; }
.tu-head .tu-clerk { font-family: 'Trebuchet MS', sans-serif; font-size: 13.5px; color: #e6ddf5; line-height: 1.35; flex: 1; }
.tu-x { position: absolute; top: 10px; right: 12px; }
.tu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.tu-card { position: relative; background: rgba(255,255,255,.07); border: 4px solid #2b2433; border-radius: 14px; padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 4px 0 rgba(0,0,0,.35); }
.tu-card.sel { background: rgba(255,210,63,.18); border-color: #ffd23f; }
.tu-card .tu-stars { color: #ffd23f; font-size: 16px; letter-spacing: 2px; text-shadow: 0 2px 0 #2b2433; }
.tu-card .tu-name { font-size: 22px; text-shadow: 0 2px 0 #2b2433; }
.tu-card .tu-sub { font-family: 'Trebuchet MS', sans-serif; font-size: 12px; color: #cfc6e6; }
.tu-card .tu-desc { font-family: 'Trebuchet MS', sans-serif; font-size: 12.5px; line-height: 1.35; flex: 1; }
.tu-card .btn { font-size: 18px; padding: 6px 12px; }
.tu-card.locked { filter: grayscale(.85) brightness(.75); }
.tu-card.locked .tu-lock { position: absolute; top: 8px; right: 10px; font-size: 13px; background: #2b2433; color: #ffb8d8; border-radius: 8px; padding: 2px 8px; }
.tu-card.m-astraelx { background: linear-gradient(160deg, rgba(255,120,190,.18), rgba(80,60,160,.2)); }
.tu-card.m-ultimate { background: linear-gradient(160deg, rgba(255,232,170,.2), rgba(70,40,120,.28) 55%, rgba(20,12,40,.4)); border-color: rgba(255,226,150,.55); box-shadow: 0 0 14px rgba(255,214,120,.25) inset; } /* Part F: the Unwritten Throne */
.tu-card.m-skaldrat { background: linear-gradient(160deg, rgba(150,220,255,.18), rgba(30,70,120,.22)); }
.tu-card.m-skaldrax { background: linear-gradient(160deg, rgba(190,160,255,.2), rgba(40,40,130,.24)); }
.tu-card.m-pyrrhext { background: linear-gradient(160deg, rgba(255,150,80,.18), rgba(110,30,20,.22)); }
.tu-card.m-pyrrhexx { background: linear-gradient(160deg, rgba(255,90,140,.2), rgba(120,20,40,.24)); }
.tu-card.m-neferakht { background: linear-gradient(160deg, rgba(255,214,110,.2), rgba(120,80,20,.22)); }
.tu-card.m-neferakhs { background: linear-gradient(160deg, rgba(255,106,61,.30), rgba(60,10,10,.32)); border-color: #ff6a3d; }
.tu-card.m-neferakhx { background: linear-gradient(160deg, rgba(176,124,255,.22), rgba(70,40,10,.26)); }
.tu-card.m-astrael { background: linear-gradient(160deg, rgba(140,170,255,.16), rgba(40,40,110,.2)); }
.tu-card.m-dunes { background: linear-gradient(160deg, rgba(255,190,90,.2), rgba(200,110,40,.18)); }
.tu-card.m-frost { background: linear-gradient(160deg, rgba(170,230,255,.2), rgba(60,110,170,.22)); }
.tu-card.m-ember { background: linear-gradient(160deg, rgba(255,140,60,.2), rgba(120,30,20,.3)); }
.tu-card.m-forge { background: linear-gradient(160deg, rgba(255,200,120,.16), rgba(60,30,20,.38)); }
.tu-card.m-hollow, .tu-card.m-vharokt, .tu-card.m-vharokx { background: linear-gradient(160deg, rgba(201,242,122,.14), rgba(20,50,30,.36)); }
.tu-card.m-crypt { background: linear-gradient(160deg, rgba(150,220,255,.14), rgba(20,30,70,.36)); }
.tu-card.m-tomb { background: linear-gradient(160deg, rgba(255,215,110,.16), rgba(40,20,70,.32)); }
.tu-card.m-vorthax { background: linear-gradient(160deg, rgba(90,230,255,.12), rgba(120,40,110,.2)); }
.tu-card .tu-clear { font-size: 12px; color: #7dffb0; }
.tu-note { font-family: 'Trebuchet MS', sans-serif; font-size: 13px; margin: 10px 0 0; color: #ffe7a0; }
.tu-home { display: block; width: 100%; margin-top: 8px; }
.tu-best { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 10px; align-items: center; font-family: 'Trebuchet MS', sans-serif; font-size: 12.5px; }
.tu-best > span { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,.07); border: 3px solid #2b2433; border-radius: 10px; padding: 3px 9px 3px 4px; }
.tu-best img { width: 24px; height: 24px; }
.tu-best b { font-family: 'Lilita One', sans-serif; font-weight: normal; font-size: 20px; text-shadow: 0 2px 0 #2b2433; min-width: 14px; text-align: center; }
.tu-best small { color: #cfc6e6; font-size: 11px; }
.tu-tabs { display: flex; gap: 6px; margin: 0 0 10px; } .tu-tabs .tab { font-size: 18px; padding: 4px 14px; } .tu-tabs .tab.on { background: #ffd23f; color: #2b2433; } .tu-tabs .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #7dffb0; margin-left: 6px; box-shadow: 0 0 6px #7dffb0; }
@media (max-height: 520px) { .tu-best { gap: 5px; margin-bottom: 6px; } .tu-best small { display: none; } }
@media (max-height: 520px) { .tu-board .panel { padding: 10px 12px; } .tu-head h2 { font-size: 22px; } .tu-grid { grid-template-columns: repeat(4, 1fr); gap: 8px; } .tu-card .tu-desc { display: none; } .tu-card .tu-name { font-size: 18px; } .tu-prompt { bottom: 12%; font-size: 20px; } }
`;

/** part 3: the Mission Records strip on the counter board: your best grade per mission type (any map) */
function bestStrip() {
  const chips = OPS_TYPES.map((t) => { const r = bestFor(t), T = OPS_TYPE[t], ic = iconOf({ type: t }); return `<span title="${T.name}: ${r ? `best ${r.g} (${r.s} pts) on ${OPS_BIOME[r.b] ? OPS_BIOME[r.b].name : ''}, ${r.n} graded run${r.n === 1 ? '' : 's'}` : 'no grade yet'}"><img src="${opsIconUrl(ic.icon, ic.col, 48)}" alt=""><b style="color:${r ? gradeCol(r.g) : 'rgba(255,255,255,.45)'}">${r ? r.g : '–'}</b><span>${T.name}<br><small>${r ? `${r.s} pts · ${OPS_BIOME[r.b] ? OPS_BIOME[r.b].name : ''}` : 'no grade yet'}</small></span></span>`; }).join('');
  return `<div class="tu-best"><b style="font-size:15px;color:#ffd23f">Best grades</b>${chips}</div>`;
}
export class TownUI {
  /** game: { player, command(c), hubInfo() -> { m, host, x, last, hostName }, setPaused? }; opts: { mobile, keyLabel, unlockKey } */
  constructor(game, opts = {}) {
    this.game = game; this.mobile = !!opts.mobile; this.keyLabel = opts.keyLabel || (() => 'X'); this.unlockKey = opts.unlockKey || UNLOCK_KEY;
    this.open = false; this.sel = 'field'; this.tab = 'missions'; this.wbSt = { pick: false, msg: '' }; this.puSt = { enc: null, ph: 0, v: 0, msg: '' };
    this.practice = new PracticeUI(game, { mobile: this.mobile });
    if (typeof document === 'undefined') return;
    if (!document.getElementById('townui-css')) { const st = document.createElement('style'); st.id = 'townui-css'; st.textContent = CSS; document.head.appendChild(st); }
    const pr = this.prompt = document.createElement('button');
    pr.id = 'townPrompt'; pr.className = 'btn tu-prompt hidden';
    pr.addEventListener('click', (e) => { e.preventDefault(); this.interact(); });
    pr.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
    document.body.appendChild(pr);
    const bd = this.board = document.createElement('div');
    bd.id = 'missionBoard'; bd.className = 'tu-board hidden';
    bd.addEventListener('pointerdown', (e) => { if (e.target === bd) this.hide(); });
    bd.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    document.body.appendChild(bd);
    // piece 4: the Realm Gate world map (board button, the plaza prompt, its key)
    this.cast = new TownCast(game);
    this.map = new RealmMap(game, { records: opts.records, flags: () => loadUnlocks(this.unlockKey), inTown: () => { const p = this.game.player; return !!(p && !p.dead && inTownArea(p.x, p.y) && this.info.m === 'town'); } });
  }
  /** near the Realm Gate plaza (south of the fountain): the prompt opens the world map */
  nearGates() {
    const p = this.game.player, w = this.game.sim && this.game.sim.world;
    if (!p || p.dead || !inTownArea(p.x, p.y) || this.info.m !== 'town') return false;
    const L = w && w.hubLayout, ps = GATES.map((g) => hubGatePos(g, L)), y0 = Math.min(...ps.map((q) => q.y));
    return p.x > Math.min(...ps.map((q) => q.x)) - 90 && p.x < Math.max(...ps.map((q) => q.x)) + 90 && Math.abs(p.y - (y0 - 80)) < 70; // (the strip just north of the portals)
  }
  get info() { return this.game.hubInfo ? this.game.hubInfo() : { m: 'town', host: true, x: false }; }
  /** Can the local player use the counter right now? */
  canInteract() {
    const p = this.game.player;
    const w = this.game.sim && this.game.sim.world;
    return !!(p && !p.dead && inTownArea(p.x, p.y) && nearCounter(p.x, p.y, 0, w && w.hubLayout) && this.info.m === 'town');
  }
  /** Per frame: show / hide the prompt. */
  update() {
    if (this.practice) this.practice.update();
    if (!this.prompt) return;
    const free = !this.open && !(this.map && this.map.open) && !this.game.paused && !(this.game.story && this.game.story.isOpen());
    const ctr = this.canInteract(), gates = !ctr && this.nearGates(), show = free && (ctr || gates);
    this.prompt.classList.toggle('hidden', !show);
    if (show) { const k = this.mobile ? '' : `<kbd>${this.keyLabel('interact')}</kbd>`; const html = `${k}${ctr ? 'Mission Counter' : 'Realm Gate Map'}`; if (this.prompt.innerHTML !== html) this.prompt.innerHTML = html; }
    if (this.open && !this.canInteract() && !this.nearWeekly()) this.hide();
  }
  /** The interact key (desktop). */
  interact() { if (this.map && this.map.open) { this.map.hide(); return true; } if (this.open) { this.hide(); return true; } if (!this.canInteract() && this.nearGates() && this.map) { this.map.show(); return true; } if (this.canInteract()) { const st = this.game.story; if (!(st && st.talk('hana', () => this.show()))) this.show(); return true; } return false; } // (pass 4: Hana's story dialogue first)
  /** standing at the Weekly Board on the Guild Square (village layout) */
  nearWeekly() {
    const p = this.game.player, w = this.game.sim && this.game.sim.world;
    if (!p || p.dead || !inTownArea(p.x, p.y) || this.info.m !== 'town' || hubLayoutOf(w) === 'tavern') return false;
    const s = STATION.weekly; return !!s && Math.hypot(p.x - s.use.x, p.y - s.use.y) < s.r + 30;
  }
  /** the Weekly Board: the counter panel on its Weekly tab */
  showWeekly() {
    if (!this.board || !this.nearWeekly()) return;
    if (!this.viaWeekly) this.ctabPrev = this.tab; this.viaWeekly = true; // (UI pass: the counter later reopens on its own tab, not Weekly)
    this.tab = 'weekly'; this.wbSt.msg = ''; this.wbSt.pick = false;
    this.open = true; this.render(); this.board.classList.remove('hidden'); this.prompt.classList.add('hidden');
    if (this.game.onBoard) this.game.onBoard(true);
  }
  show() {
    if (!this.board || !this.canInteract()) return;
    if (this.viaWeekly) { this.tab = this.ctabPrev && this.ctabPrev !== 'weekly' ? this.ctabPrev : 'missions'; this.viaWeekly = false; }
    this.open = true; this.render(); this.board.classList.remove('hidden'); this.prompt.classList.add('hidden');
    if (this.game.onBoard) this.game.onBoard(true);
  }
  hide() { if (!this.board) return; this.open = false; this.board.classList.add('hidden'); if (this.game.onBoard) this.game.onBoard(false); }
  render() {
    const I = this.info, host = I.host !== false;
    const cleared = loadUnlocks(this.unlockKey);
    const astral = mapAstral(I); // (Part 0S: the board shows the doors of the mode you travel in)
    const cards = MISSIONS.filter((m) => !doorHidden(m.id, astral)).map((m) => {
      const locked = m.savage ? !astralUnlocked() : !!m.lock && !(m.lock === 'astx' ? I.x : I.u && I.u[m.lock]);
      const stars = '★'.repeat(m.stars) + '<span style="opacity:.3">' + '★'.repeat(5 - m.stars) + '</span>';
      const clr = m.id === 'crypt' && cleared.crypt ? '<div class="tu-clear">✔ Cleared</div>' : m.id === 'tomb' && cleared.tomb ? '<div class="tu-clear">✔ Cleared</div>' : m.id === 'astrael' && cleared.astx ? '<div class="tu-clear">✔ Cleared</div>' : m.id === 'astraelx' && cleared.astxClear ? '<div class="tu-clear">✔ Cleared</div>' : ({ skaldrat: 'skx', skaldrax: 'skxc', pyrrhext: 'pyx', pyrrhexx: 'pyxc', hollow: 'hollow', vharokt: 'vhx', vharokx: 'vhxc', ultimate: 'ultc' }[m.id] && cleared[{ skaldrat: 'skx', skaldrax: 'skxc', pyrrhext: 'pyx', pyrrhexx: 'pyxc', hollow: 'hollow', vharokt: 'vhx', vharokx: 'vhxc', ultimate: 'ultc' }[m.id]]) ? '<div class="tu-clear">✔ Cleared</div>' : '';
      return `<div class="tu-card m-${m.id}${locked ? ' locked' : ''}${this.sel === m.id ? ' sel' : ''}" data-id="${m.id}">
        ${locked ? `<div class="tu-lock">🔒 LOCKED</div>` : ''}
        <div class="tu-stars">${stars}</div><div class="tu-name">${m.name}</div><div class="tu-sub">${m.sub}</div>
        <div class="tu-desc">${locked ? (m.lockText || 'Locked') + (I.host === false ? ' (the host must unlock it)' : '') + '.' : m.desc}</div>${clr}
        <button class="btn depart" data-id="${m.id}" ${locked || !host ? 'disabled style="opacity:.5"' : ''}>${locked ? 'Locked' : host ? 'Depart' : 'Host picks'}</button>
      </div>`;
    }).join('');
    const rd = I.ready && I.ready.of > 1 ? ` Party ready: ${I.ready.n} / ${I.ready.of} (Co-op Board).` : '';
    const note = (host ? (I.coop ? 'You are the host: your pick takes the whole party.' : '') : `Only the host${I.hostName ? ` (${I.hostName})` : ''} can pick a mission. Everyone is pulled in when they depart.`) + rd;
    const pr = profile.load(), WB = weeklyBoard(Date.now()), WS = weeklyState(pr, WB), ready = ONE_TIME.some((o) => WS.done[o.id] && !WS.claimed[o.id]) || !WS.key; // (game loop B3: a dot when something waits on the board)
    const tabs = `<div class="tu-tabs"><button class="btn small tab${this.tab === 'missions' ? ' on' : ''}" data-tutab="missions">Missions</button><button class="btn small tab${this.tab === 'weekly' ? ' on' : ''}" data-tutab="weekly">Weekly Board${ready ? '<span class="dot"></span>' : ''}</button>${!this.viaWeekly ? `<button class="btn small tab${this.tab === 'practice' ? ' on' : ''}" data-tutab="practice">Practice${practiceList(pr).length ? ` <small>(${practiceList(pr).length})</small>` : ''}</button>` : ''}</div>`;
    this.board.innerHTML = `<div class="panel"><button class="btn small ghost tu-x" id="missionClose">✕</button>
      <div class="tu-head"><h2>${this.viaWeekly ? 'Weekly Board' : 'Mission Counter'}</h2><button class="btn small" id="missionMap">🗺 Realm Map</button><div class="tu-clerk"><b style="color:#ffd23f">${CLERK.name}, ${CLERK.title}:</b> “Welcome to ${TOWN_NAME}! ${this.tab === 'weekly' ? 'Here is this week’s board.' : this.tab === 'practice' ? 'Want a dry run? The Guild sets the fight up, no stakes.' : 'Where are we headed today?'}”</div></div>
      ${tabs}
      ${this.tab === 'weekly' ? boardHtml(pr, WB, this.wbSt) : this.tab === 'practice' ? practiceTabHtml(pr, this.puSt, I) : `${bestStrip()}
      <div class="tu-grid">${cards}</div>${note ? `<p class="tu-note">${note}</p>` : ''}`}</div>`;
    for (const b of this.board.querySelectorAll('[data-tutab]')) b.onclick = () => { this.tab = b.dataset.tutab; this.wbSt.msg = ''; this.wbSt.pick = false; this.puSt.msg = ''; this.render(); };
    if (this.tab === 'weekly') wireBoard(this.board, { game: this.game, st: this.wbSt, rerender: () => this.render() });
    if (this.tab === 'practice') wirePracticeTab(this.board, { game: this.game, st: this.puSt, rerender: () => this.render(), done: () => this.hide() });
    this.board.querySelector('#missionClose').onclick = () => this.hide();
    this.board.querySelector('#missionMap').onclick = () => { const s = this.sel; this.hide(); if (this.map) this.map.show(s); };
    for (const c of this.board.querySelectorAll('.tu-card')) c.onclick = () => { this.sel = c.dataset.id; for (const d of this.board.querySelectorAll('.tu-card')) d.classList.toggle('sel', d === c); };
    for (const b of this.board.querySelectorAll('.depart')) b.onclick = (e) => { e.stopPropagation(); if (b.disabled) return; this.depart(b.dataset.id); };
  }
  depart(id) {
    const I = this.game.hubInfo ? this.game.hubInfo() : {};
    if (needsKey(id) && I.host !== false) { // (horde pass 2: Trial / Extreme attempts spend a Realm Gate key; none: the map shows how to forge one)
      const pr = profile.load();
      if (!useKey(pr, id)) { this.hide(); if (this.map) this.map.show(id); return; }
      profile.keyPend = id; profile.save();
    }
    this.game.command({ type: 'mission', id }); this.hide();
  }
  /** Game event hook: persist clears / the Extreme unlock for this browser. */
  onEvent(ev, me) {
    if (this.practice) this.practice.onEvent(ev, me);
    if (ev.type === 'hub' && ev.ph === 'tch') { if (ev.pid === me && this.cast) this.cast.onEvent(ev); return; }
    if (ev.type === 'unlock' && ev.pid === me && UNLOCK_KEYS.includes(ev.key)) { // Dunes gate / Tomb replays / the Trial Sigil
      const u = loadUnlocks(this.unlockKey); u[ev.key] = 1; saveUnlocks(u, this.unlockKey);
      const p = this.game.player; if (p) { p.unlocks = p.unlocks || {}; p.unlocks[ev.key] = 1; }
      if (this.board && !this.board.classList.contains('hidden') && this.render) this.render();
      if (this.map && this.map.open) this.map.renderSide(); // (game loop A1: an attuned gate opens on the map at once)
      return;
    }
    if (ev.type === 'unw' && ev.ph === 'victory') { const s = this.game.sim; if (!(s && s.practice) && !this.ultSeen) { this.ultSeen = 1; const pr = profile.load(); if (recordUltClear(pr, ev)) profile.save(); } return; } // (Part F3: the clear record; once per victory)
    if (ev.type === 'unw' && ev.ph === 'pull') { this.ultSeen = 0; return; }
    if (ev.type !== 'astrael' || ev.ph !== 'clear' || ev.pid !== me) return;
    const u = loadUnlocks(this.unlockKey);
    if (ev.ex) u.astxClear = 1; else u.astx = 1;
    saveUnlocks(u, this.unlockKey);
    const p = this.game.player; if (p) { p.unlocks = p.unlocks || {}; Object.assign(p.unlocks, u); }
  }
  destroy() { if (this.practice) this.practice.destroy(); if (this.cast) this.cast.destroy(); if (this.map) this.map.destroy(); if (this.prompt) this.prompt.remove(); if (this.board) this.board.remove(); this.prompt = this.board = null; }
}

/** Pause menu: "Return to Town" (hidden while you're in town). */
export function syncTownButton(game) {
  const btn = typeof document !== 'undefined' && document.getElementById('townBtn');
  if (!btn) return;
  const p = game && game.player, I = game && game.hubInfo ? game.hubInfo() : null;
  if (!p || !I || (I.m === 'town' && inTownArea(p.x, p.y))) { btn.classList.add('hidden'); return; }
  btn.classList.remove('hidden');
  btn.textContent = I.host === false ? 'Return to Town (just you)' : I.coop ? 'Return to Town (whole party)' : 'Return to Town';
  btn.onclick = () => { game.command({ type: 'town' }); game.setPaused(false); };
}
