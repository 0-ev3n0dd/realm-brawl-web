// Options menu (desktop), in sub-tabs: Gameplay · Controls (mode + key bindings) · Graphics · Audio · Interface · Account &
// Online (Travel to Town / Abandon mission, invite, Save & Quit). In game it lives in the menu hub's Options tab, which
// Esc opens directly (there is no separate pause menu any more); the title menu opens it standalone.
// Click a slot, then press a key or mouse button to bind it (Esc cancels). A code another action uses is swapped
// (the notice says so and both rows flash); right-click (or the x) clears a slot; Reset restores the defaults.
import { showAccountReset } from './acctreset.js';
import { testActive, switchSave, resetAscTest } from './asctest.js';
import { accountName } from './lasthero.js';
import { promptAccountName } from './acctprompt.js';
import { heroOf } from '../sim/heroes.js';
import { heroSubtitle } from '../sim/acctname.js';
import { perfPref, governor, canvasPref, isFirefox } from './perf.js';
import { ACTIONS, SLOTS, codeLabel } from './keybinds.js';
import { lockPref, retargetPref } from './aimlock.js';
import { vfxPref } from './fxns.js';
import { shaderPref, SHADER_MODES } from './shaderfx.js';
import { feelPref } from './feel.js';
import { audioPref } from './audio.js';
import { introPref } from './introflow.js';
import { controlMode } from './kbmode.js';
import { inMission } from './towntravel.js';
import { glPref, GL_INFO, glSupported } from './gl/glcore.js';

/** the Options sub-tabs (the hub's Options tab and the title menu's Options window) */
export const OPT_TABS = [
  { id: 'gameplay', label: 'Gameplay' },
  { id: 'controls', label: 'Controls' },
  { id: 'graphics', label: 'Graphics' },
  { id: 'audio', label: 'Audio' },
  { id: 'interface', label: 'Interface' },
  { id: 'account', label: 'Account & Online' },
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Options {
  constructor(keybinds, input) {
    this.kb = keybinds; this.input = input;
    this.root = $('options');
    this.capturing = null; // { action, slot }
    this.flash = new Set();
    this.onClose = null;
    this.tab = 'gameplay'; this.game = null; // (game: the running Game / NetGame: the Account tab + the session buttons)
    this.root.innerHTML = `
      <div class="panel options-box">
        <h2>Options <span class="sub" id="optSub">Gameplay</span></h2>
        <div class="opt-tabs" id="optTabs" role="tablist"></div>
        <p class="hint" id="optHint">Click a slot, then press a key or mouse button. <b>Esc</b> cancels, right-click clears a slot. Keys used elsewhere are swapped.</p>
        <div id="optNotice" class="opt-notice"></div>
        <div id="optList" class="opt-list"></div>
        <div class="opt-foot">
          <button class="btn ghost" id="optReset">Reset controls</button>
          <span class="opt-sess" id="optSess"></span>
          <button class="btn" id="optDone">Done</button>
        </div>
      </div>`;
    $('optReset').onclick = () => { this.cancel(); this.kb.reset(); this.notice('All controls reset to the defaults.', 'ok'); this.render(); };
    $('optDone').onclick = () => this.close();
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.close(); });
    // Escape while open (and not capturing) closes the options before the game sees it (no pause toggle)
    addEventListener('keydown', (e) => {
      if (!this.isOpen() || this.capturing || e.code !== 'Escape') return;
      e.preventDefault(); e.stopImmediatePropagation(); this.close();
    }, { capture: true });
    // mouse buttons can be bound too: while capturing, the next mouse press anywhere is the new binding
    this.onMouse = (e) => {
      if (!this.capturing) return;
      if (e.target && e.target.closest && e.target.closest('[data-cancel]')) return;
      e.preventDefault(); e.stopImmediatePropagation();
      this.boundAt = performance.now(); // the click that follows this press must not start a new capture
      this.bind('Mouse' + e.button);
    };
    addEventListener('mousedown', this.onMouse, { capture: true });
    addEventListener('contextmenu', (e) => { if (this.capturing || (this.isOpen() && e.target.closest && e.target.closest('.opt-slot'))) e.preventDefault(); }, { capture: true });
    this.render();
  }
  isOpen() { return !this.root.classList.contains('hidden'); }
  setTab(id) { if (!OPT_TABS.some((t) => t.id === id) || this.capturing) return; this.tab = id; this.notice(''); this.render(); }
  open(onClose = null) { this.onClose = onClose; this.root.classList.remove('hidden'); this.notice(''); this.render(); }
  close() {
    this.cancel();
    this.root.classList.add('hidden');
    const f = this.onClose; this.onClose = null; if (f) f();
  }
  notice(text, kind = '') { const n = $('optNotice'); n.textContent = text; n.className = 'opt-notice ' + kind; }
  start(action, slot) {
    this.capturing = { action, slot };
    this.input.capture = (code) => { if (code === 'Escape') { this.cancel(); this.notice('Cancelled.'); } else this.bind(code); };
    this.notice(`Press a key or mouse button for "${ACTIONS.find((a) => a.id === action).label}"… (Esc to cancel)`, 'wait');
    this.render();
  }
  cancel() { this.capturing = null; this.input.capture = null; this.render(); }
  bind(code) {
    const c = this.capturing; if (!c) return;
    // defer releasing the capture so the same mousedown/keydown does not also reach the game
    this.capturing = null; setTimeout(() => { if (!this.capturing) this.input.capture = null; }, 0);
    this.input.keys.clear(); this.input.mouse.down = false;
    const r = this.kb.set(c.action, c.slot, code);
    const unbound = this.kb.unbound();
    let msg = this.kb.describe(c.action, code, r);
    if (r.ok && unbound.length) msg += ` Unbound: ${unbound.map((id) => ACTIONS.find((a) => a.id === id).label).join(', ')}.`;
    this.notice(msg, !r.ok ? 'err' : r.conflict && r.conflict.action !== c.action ? 'warn' : 'ok');
    this.flash = new Set([c.action, ...(r.conflict ? [r.conflict.action] : [])]);
    this.render();
    setTimeout(() => { this.flash.clear(); this.render(); }, 1400);
  }
  /** a session action (Account tab rows + the footer buttons) */
  sess(act) {
    if (act === 'asctest' || act === 'ascmain' || act === 'ascreset') { // the Ascension Test save (client/asctest.js)
      const G = this.game && this.game.running !== false ? this.game : null;
      if (G && (G.net || (G.hubInfo && G.hubInfo().coop))) return this.notice('Leave the co-op session first.', 'warn');
      if (G && G.save && G.player) try { G.save(); } catch { /* */ }
      if (act === 'ascreset') { if (confirm('Reset the Ascension Test save? Only the test save is wiped; your main save is not touched.')) resetAscTest(); return; }
      switchSave(act === 'asctest'); return;
    }
    if (act === 'acctreset') { // two-step confirm, wipe, reload into the name prompt + starter screen (client/acctreset.js)
      const G = this.game && this.game.running !== false ? this.game : null;
      if (G && (G.net || (G.hubInfo && G.hubInfo().coop))) return this.notice('Leave the co-op session first.', 'warn');
      showAccountReset({ name: accountName(localStorage) }); return;
    }
    if (act === 'acctname') { // account names: rename (any time; in co-op the server re-broadcasts it to the party)
      const G = this.game, cls = G && G.player ? G.player.cls : null;
      promptAccountName({ rename: true, heroTitle: cls ? heroSubtitle(heroOf(cls)) : '', onSaved: (n) => { if (G && G.setAccount) G.setAccount(n); this.notice(`Account name: ${n}`, 'ok'); this.render(); } });
      return;
    }
    const G = this.game; if (!G) return;
    const hub = G.menuHub;
    if (act === 'town') { G.command({ type: 'town' }); if (hub && hub.isOpen()) hub.close(); }
    else if (act === 'invite') { if (G.invite) G.invite(); }
    else if (act === 'quit') { if (hub && hub.isOpen()) hub.close(); G.quit(); }
  }
  /** the footer's session buttons (in game): Abandon mission (missions only), Save & Quit (co-op: Save & Leave) */
  syncSession() {
    const el = $('optSess'); if (!el) return;
    const G = this.game && this.game.running !== false ? this.game : null;
    if (!G) { if (el.innerHTML) el.innerHTML = ''; return; }
    const I = G.hubInfo ? G.hubInfo() : {}, coop = !!(G.net || I.coop), mis = inMission(G);
    // (2026-10-09 town flag: Travel to Town left the menus; Brightwater Village is a flag on the World Map's Realm Gate map. The mission exit stays here.)
    const tb = mis ? `<button class="btn raid" id="townBtn" data-s="town" title="Leave the mission and go back to Brightwater Village">${I.host === false ? 'Return to Town (just you)' : 'Abandon mission → Town'}</button>` : '';
    const html = tb + `<button class="btn danger" id="quitBtn" data-s="quit">${coop ? 'Save &amp; Leave' : 'Save &amp; Quit'}</button>`;
    if (el.innerHTML !== html) { el.innerHTML = html; el.querySelectorAll('[data-s]').forEach((b) => { b.onclick = (e) => { e.preventDefault(); this.sess(b.dataset.s); }; }); }
  }
  render() {
    const list = $('optList'); if (!list) return;
    const unbound = new Set(this.kb.unbound());
    const kbm = controlMode.keyboard, CM = [['mouse', 'Mouse + Keyboard', 'aim with the mouse; hover lock-on'], ['keyboard', 'Keyboard only', 'no mouse: the phone auto-target - nearest enemy, bosses and elites first, sticky until it dies or leaves range']];
    let ctl = `<div class="opt-group">Control mode</div><div class="opt-row" id="optModeRow"><span class="opt-label">Control mode <span class="opt-fixed">(${kbm ? `Keyboard only: attacks and skills face your auto-target; ${esc(this.kb.labels('cycleTarget'))} cycles it, ${esc(this.kb.labels('clearLock'))} clears it; each mode keeps its own key bindings below` : 'Mouse + Keyboard: aim with the mouse. Keyboard only plays like the phone, with auto-target'})</span></span>`
      + CM.map(([id, label, tip]) => { const on = controlMode.value === id; return `<button class="opt-slot${on ? ' sel' : ''}" data-cmode="${id}" title="${esc(tip)}" aria-pressed="${on}"${on ? ' style="background:#ffb03a;color:#2b2433"' : ''}>${esc(label)}</button>`; }).join('') + `</div>`;
    let gp = `<div class="opt-group">Gameplay</div><div class="opt-row"><span class="opt-label">Hover lock-on <span class="opt-fixed">(hover an enemy to lock it; skills, basics, chains and gap-closers aim at it, and the lock stays on it through dashes. Hover another enemy briefly or click it to switch; ${this.kb.labels('clearLock')} clears the lock)</span></span><label class="opt-slot" style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" id="optLock"${lockPref.on ? ' checked' : ''}> ${lockPref.on ? 'ON' : 'OFF'}</label></div>`
      + `<div class="opt-row"><span class="opt-label">Auto-retarget <span class="opt-fixed">(when your locked enemy dies, lock the nearest one near the cursor; a boss lock never drops onto trash)</span></span><label class="opt-slot" style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" id="optRetarget"${retargetPref.on ? ' checked' : ''}> ${retargetPref.on ? 'ON' : 'OFF'}</label></div>`; let group = '';
    const vrow = (id, label, note, on) => `<div class="opt-row"><span class="opt-label">${label} <span class="opt-fixed">(${note})</span></span><label class="opt-slot" style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" id="${id}"${on ? ' checked' : ''}> ${on ? 'ON' : 'OFF'}</label></div>`;
    const rng = (id, label, note, v, max = 100) => `<div class="opt-row"><span class="opt-label">${label} <span class="opt-fixed">(${note})</span></span><label class="opt-range"><input type="range" id="${id}" min="0" max="${max}" step="5" value="${Math.round(v * 100)}"><output id="${id}V">${Math.round(v * 100)}%</output></label></div>`;
    if (this.game && this.game.village) gp += `<div class="opt-group">Training</div><div class="opt-row"><span class="opt-label">Training Dummy <span class="opt-fixed">(health, armor, boss flag, count, layout, movement, telegraph attacks, parse length, damage numbers; also at the dummy with Interact)</span></span><button class="btn small" id="optDummy">Dummy settings…</button></div>`;
    gp += `<div class="opt-group">Feel</div>` + rng('optShake', 'Screen shake', 'camera shake and impact punch; 0 turns it off', feelPref.shake, 150)
      + `<div class="opt-row"><span class="opt-label">Hit-stop <span class="opt-fixed">(the action freezes for a few frames on weighty hits, heavier hits hold longer)</span></span><label class="opt-slot" style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" id="optHitstop"${feelPref.hitstop ? ' checked' : ''}> ${feelPref.hitstop ? 'ON' : 'OFF'}</label></div>`;
    let aud = (this.game && this.game.audio ? vrow('optMute', 'Mute all sound', `also the ${esc(this.kb.labels('mute'))} key in game`, !!this.game.audio.muted) : '') + `<div class="opt-group">Volume</div>` + rng('optMusic', 'Music volume', 'the zone themes: village, Wilds, Dunes, Tomb, boss, raid and trial', audioPref.music)
      + rng('optSfx', 'Sound effects volume', 'attacks, skills, hits, pickups, UI clicks', audioPref.sfx);
    let ui = `<div class="opt-group">Intro</div>` + vrow('optIntro', 'Play intro on launch', 'the music-synced intro of all ten classes before the title screen; any key, click or pad button skips it', introPref.on)
      + (this.onWatchIntro && (!this.canWatchIntro || this.canWatchIntro()) ? `<div class="opt-row"><span class="opt-label">Watch the intro <span class="opt-fixed">(plays it now, then back to the title)</span></span><button class="opt-slot" id="optWatchIntro">▶ Watch Intro</button></div>` : '');
    let gfx = `<div class="opt-group">Visual effects</div>` + vrow('optFlash', 'Reduce screen flashes', 'no full-screen white flashes; softer bursts and glows', vfxPref.reduceFlash) + vrow('optCine', 'Ult cinematics', 'grayscale / violet screen filters, giant kanji, speed lines on ults and finales', vfxPref.cine) + rng('optSkillFx', 'Skill effects', 'strength of skill and chain effects: lower = fainter and fewer at once (other players are always softer than yours); 0 turns them off', vfxPref.skill);
    { const cur = shaderPref.mode, tip = 'WebGL post-process: bloom, colour grade, refraction, aberration and film grain. ' + SHADER_MODES.map((m) => `${m.label}: ${m.tip}`).join(' ');
      gfx += `<div class="opt-row" title="${esc(tip)}"><span class="opt-label">Shaders <span class="opt-fixed">(bloom, colour grade and refraction; Finishers only = just during finishers)</span></span>` + SHADER_MODES.map((m) => `<button class="opt-slot${m.id === cur ? ' sel' : ''}" data-shader="${m.id}" title="${esc(m.tip)}" aria-pressed="${m.id === cur}"${m.id === cur ? ' style="background:#ffb03a;color:#2b2433"' : ''}>${esc(m.label)}</button>`).join('') + `</div>`; }
    { const ok = glSupported(); gfx += `<div class="opt-group">Renderer</div><div class="opt-row"><span class="opt-label">WebGL2 <span class="opt-fixed">(${ok ? 'available: the systems below can draw on the GPU; each falls back to Canvas2D on its own' : 'not available on this device: everything draws with Canvas2D'})</span></span></div>`;
      for (const k of Object.keys(GL_INFO)) gfx += vrow('optGL_' + k, GL_INFO[k].label, GL_INFO[k].note, glPref.on(k)); 
      gfx += `<div class="opt-row" title="Auto = software on Firefox (its GPU Canvas2D is slow with this art), GPU elsewhere. Applies after a reload."><span class="opt-label">Canvas2D backend <span class="opt-fixed">(${isFirefox ? 'Firefox: Auto = software, faster here' : 'Auto = GPU'}; applies after reload)</span></span>` + ['auto', 'gpu', 'cpu'].map((m) => `<button class="opt-slot${canvasPref.mode === m ? ' sel' : ''}" data-c2d="${m}">${m === 'cpu' ? 'Software' : m === 'gpu' ? 'GPU' : 'Auto'}</button>`).join('') + `</div>`; }
    gfx += `<div class="opt-group">Performance</div>` + vrow('optFps', 'FPS / frame-time overlay', 'fps, avg / 1% low / min, p50 / p95 frame time and a frame graph, bottom-left', perfPref.on) + vrow('optAutoQ', 'Adaptive quality', 'keeps 60 fps: lowers resolution / particles / glow when a frame runs over budget', governor.auto);
    for (const a of ACTIONS) {
      if (a.group !== group) { group = a.group; ctl += `<div class="opt-group">${esc(group)}</div>`; }
      const codes = this.kb.codes(a.id);
      let slots = '';
      for (let i = 0; i < SLOTS; i++) {
        const cap = this.capturing && this.capturing.action === a.id && this.capturing.slot === i;
        const code = codes[i];
        const txt = cap ? 'press…' : code ? codeLabel(code) : (i === 0 ? 'unbound' : '+');
        slots += `<button class="opt-slot${cap ? ' cap' : ''}${code ? '' : ' empty'}" data-action="${a.id}" data-slot="${i}" title="${code ? 'Click to rebind, right-click to clear' : 'Click to add a binding'}">${esc(txt)}</button>`;
      }
      ctl += `<div class="opt-row${this.flash.has(a.id) ? ' flash' : ''}${unbound.has(a.id) ? ' unbound' : ''}" data-row="${a.id}"><span class="opt-label">${esc(a.label)}${unbound.has(a.id) ? ' <b class="warn">⚠ unbound</b>' : ''}</span>${slots}</div>`;
    }
    ctl += `<div class="opt-group">Menu</div><div class="opt-row"><span class="opt-label">Menu / cancel <span class="opt-fixed">(Esc closes a popup or cancels targeting first; otherwise it opens this menu on Options, and Esc again closes it)</span></span><button class="opt-slot fixed" disabled>ESC</button><span class="opt-fixed">fixed</span></div>`;
    // ---- Interface + Account & Online (in game only: the session actions that used to live in the Esc pause menu)
    const G = this.game && this.game.running !== false ? this.game : null;
    if (G && G.hud && 'showChains' in G.hud) ui += `<div class="opt-group">HUD</div>` + vrow('optChains', 'Chain list on the HUD', `the combo chains beside the skill bar; also the ${esc(this.kb.labels('combos'))} key`, !!G.hud.showChains);
    ui += `<div class="opt-group">Menus</div><div class="opt-row"><span class="opt-label">Esc <span class="opt-fixed">(closes a popup or cancels targeting first; otherwise opens this menu on Options. ${esc(this.kb.labels('inventory'))} opens it on Character)</span></span><button class="opt-slot fixed" disabled>ESC</button></div>`;
    const an = accountName(localStorage);
    const nameRow = `<div class="opt-group">Account name</div><div class="opt-row"><span class="opt-label">${an ? esc(an) : '<i>not set</i>'} <span class="opt-fixed">(your name on nameplates, the party list and chat; your hero's name shows under it)</span></span><button class="opt-slot" data-sess="acctname" id="optAcctName">✎ Change</button></div>`;
    let acct = '';
    if (G) {
      const p = G.player || {}, I = G.hubInfo ? G.hubInfo() : {}, coop = !!(G.net || I.coop);
      acct = `<div class="opt-group">This session</div><div class="opt-row"><span class="opt-label">${esc(heroSubtitle(heroOf(p.cls)) || p.name || 'Hero')} <span class="opt-fixed">(Lv ${p.level | 0} · ${coop ? (I.host === false ? 'co-op guest' : 'co-op host') : 'solo'} · saves automatically)</span></span></div>`;
      const mis = inMission(G);
      if (mis) acct += `<div class="opt-row"><span class="opt-label">${I.host === false ? 'Return to Town (just you)' : coop ? 'Abandon mission (whole party)' : 'Abandon mission'} <span class="opt-fixed">(leave the running mission, trial or dungeon and go back to Brightwater Village)</span></span><button class="opt-slot" data-sess="town">⚑ Back to Town</button></div>`;
      else if (G.player && !(G.hubInfo && G.hubInfo().m === 'town')) acct += `<p class="hint">To go back to Brightwater Village: World Map › Realm Gate, pick the village flag, then Travel.</p>`;
      if (coop && G.invite) acct += `<div class="opt-group">Online</div><div class="opt-row"><span class="opt-label">Invite friends <span class="opt-fixed">(copies the party link)</span></span><button class="opt-slot" data-sess="invite">✉ Invite</button></div>`;
      try { if (coop && G.view && G.view.players) acct += `<div class="opt-row"><span class="opt-label">Party <span class="opt-fixed">(${esc([...(G.view.players.values ? G.view.players.values() : G.view.players)].map((q) => q.acct || q.name || 'Hero').join(', '))})</span></span></div>`; } catch { /* (no party list yet) */ }
      acct += `<p class="hint">${coop ? 'Save &amp; Leave' : 'Save &amp; Quit'} (below) saves your hero${coop ? ', leaves the party' : ''} and goes back to the title screen.</p>`; // (UI pass: the row duplicated the footer button with a different label)
    } else acct = `<div class="opt-group">Account</div><div class="opt-row"><span class="opt-label">Heroes, saves and party options <span class="opt-fixed">(start a game: this tab then has invite and Save &amp; Quit)</span></span></div>`;
    const inCoop = !!(G && (G.net || (G.hubInfo && G.hubInfo().coop)));
    const resetRow = `<div class="opt-row danger-row"><span class="opt-label">Reset account <span class="opt-fixed">(${inCoop ? 'leave the co-op session first (Save &amp; Leave), then reset' : 'deletes every hero, unlock and all progress on this device - PC and phone; keeps graphics, audio and control settings'})</span></span><button class="opt-slot danger" data-sess="acctreset" id="optAcctReset"${inCoop ? ' disabled' : ''}>⚠ Reset account</button></div>`;
    const testRow = testActive()
      ? `<div class="opt-row"><span class="opt-label">Ascension Test save <span class="opt-fixed">(ON: you are playing the separate test save; your main save is untouched)</span></span><button class="opt-slot" data-sess="ascmain" id="optAscMain">Back to main save</button><button class="opt-slot danger" data-sess="ascreset" id="optAscReset">Reset test save</button></div>`
      : `<div class="opt-row"><span class="opt-label">Ascension Test save <span class="opt-fixed">(a separate save: all 10 heroes Lv 50, Altar open, pieces + materials ready; your main save is not touched)</span></span><button class="opt-slot" data-sess="asctest" id="optAscTest">Play test save</button></div>`;
    acct = nameRow + testRow + resetRow + acct;
    const PANES = { gameplay: gp, controls: ctl, graphics: gfx, audio: aud, interface: ui, account: acct };
    const html = PANES[this.tab] || gp;
    const tabs = $('optTabs');
    if (tabs) {
      tabs.innerHTML = OPT_TABS.map((t) => `<button class="opt-tab${t.id === this.tab ? ' on' : ''}" data-otab="${t.id}" role="tab" aria-selected="${t.id === this.tab}">${esc(t.label)}</button>`).join('');
      tabs.querySelectorAll('[data-otab]').forEach((b) => { b.onclick = (e) => { e.preventDefault(); this.setTab(b.dataset.otab); }; });
    }
    const sub = $('optSub'); if (sub) sub.textContent = (OPT_TABS.find((t) => t.id === this.tab) || OPT_TABS[0]).label;
    const hint = $('optHint'); if (hint) hint.classList.toggle('hidden', this.tab !== 'controls');
    const rs = $('optReset'); if (rs) rs.classList.toggle('hidden', this.tab !== 'controls');
    list.innerHTML = html;
    list.querySelectorAll('[data-sess]').forEach((b) => { b.onclick = (e) => { e.preventDefault(); this.sess(b.dataset.sess); }; });
    const mu = list.querySelector('#optMute'); if (mu) mu.onchange = () => { if (this.game && this.game.audio) this.game.audio.muted = mu.checked; this.notice(`Sound ${mu.checked ? 'muted' : 'on'}.`, 'ok'); this.render(); };
    const ch = list.querySelector('#optChains'); if (ch) ch.onchange = () => { if (this.game && this.game.hud) this.game.hud.showChains = ch.checked; this.render(); };
    this.syncSession();
    const slider = (id, set) => { const el = list.querySelector('#' + id); if (!el) return; el.oninput = () => { const v = +el.value / 100; set(v); const o = list.querySelector('#' + id + 'V'); if (o) o.textContent = el.value + '%'; }; };
    slider('optShake', (v) => feelPref.setShake(v));
    slider('optSkillFx', (v) => vfxPref.setSkill(v));
    slider('optMusic', (v) => { if (this.audio) this.audio.setVolume('music', v); else { audioPref.music = v; audioPref.save(); } });
    slider('optSfx', (v) => { if (this.audio) { this.audio.setVolume('sfx', v); this.audio.play('click'); } else { audioPref.sfx = v; audioPref.save(); } });
    const od = list.querySelector('#optDummy'); if (od) od.onclick = (e) => { e.preventDefault(); const g = this.game; this.close(); if (g.menuHub && g.menuHub.close) g.menuHub.close(); g.village.openDummy(); };
    const hs = list.querySelector('#optHitstop'); if (hs) hs.onchange = () => { feelPref.setHitstop(hs.checked); this.notice(`Hit-stop ${hs.checked ? 'ON' : 'OFF'}.`, 'ok'); this.render(); };
    const vi = list.querySelector('#optIntro'); if (vi) vi.onchange = () => { introPref.set(vi.checked); this.notice(`Play intro on launch ${vi.checked ? 'ON' : 'OFF'}.`, 'ok'); this.render(); };
    const wi = list.querySelector('#optWatchIntro'); if (wi) wi.onclick = (e) => { e.preventDefault(); if (this.onWatchIntro) this.onWatchIntro(); };
    const vf = list.querySelector('#optFlash'); if (vf) vf.onchange = () => { vfxPref.setReduceFlash(vf.checked); this.notice(`Reduce screen flashes ${vf.checked ? 'ON' : 'OFF'}.`, 'ok'); this.render(); };
    list.querySelectorAll('.opt-slot[data-cmode]').forEach((b) => { b.onclick = (e) => { e.preventDefault(); if (this.capturing) return; const m = controlMode.set(b.dataset.cmode); this.kb.setMode(m); this.notice(m === 'keyboard' ? `Keyboard only: ${this.kb.labels('attack')} attacks, ${this.kb.labels('dodge')} dodges, ${this.kb.labels('cycleTarget')} cycles the auto-target. No mouse needed.` : 'Mouse + Keyboard: aim with the mouse.', 'ok'); this.render(); }; });
    list.querySelectorAll('.opt-slot[data-shader]').forEach((b) => { b.onclick = (e) => { e.preventDefault(); if (shaderPref.set(b.dataset.shader)) { const m = SHADER_MODES.find((x) => x.id === b.dataset.shader); this.notice(`Shaders: ${m.label}.`, 'ok'); this.render(); } }; });
    const vc = list.querySelector('#optCine'); if (vc) vc.onchange = () => { vfxPref.setCine(vc.checked); this.notice(`Ult cinematics ${vc.checked ? 'ON' : 'OFF'}.`, 'ok'); this.render(); };
    for (const b of list.querySelectorAll('[data-c2d]')) b.onclick = () => { canvasPref.set(b.dataset.c2d); this.notice('Canvas2D backend saved: reload the game to apply.', 'ok'); this.render(); };
    for (const k of Object.keys(GL_INFO)) { const el = list.querySelector('#optGL_' + k); if (el) el.onchange = () => { glPref.set(k, el.checked); this.notice(`${GL_INFO[k].label}: ${el.checked ? 'WebGL' : 'Canvas2D'}.`, 'ok'); this.render(); }; }
    const aq = list.querySelector('#optAutoQ'); if (aq) aq.onchange = () => { governor.setAuto(aq.checked); this.notice(`Adaptive quality ${aq.checked ? 'ON' : 'OFF'}.`, 'ok'); this.render(); };
    const vp = list.querySelector('#optFps'); if (vp) vp.onchange = () => { perfPref.set(vp.checked); this.notice(`FPS overlay ${vp.checked ? 'ON' : 'OFF'}.`, 'ok'); this.render(); };
    const lk = list.querySelector('#optLock'); if (lk) lk.onchange = () => { lockPref.set(lk.checked); this.notice(`Hover lock-on ${lk.checked ? 'ON' : 'OFF'}.`, 'ok'); this.render(); };
    const rt = list.querySelector('#optRetarget'); if (rt) rt.onchange = () => { retargetPref.set(rt.checked); this.notice(`Auto-retarget ${rt.checked ? 'ON' : 'OFF'}.`, 'ok'); this.render(); };
    list.querySelectorAll('.opt-slot[data-action]').forEach((b) => {
      const action = b.dataset.action, slot = +b.dataset.slot;
      b.onclick = (e) => { e.preventDefault(); if (this.capturing || performance.now() - (this.boundAt || 0) < 350) return; /* ignore the click that follows a captured mouse press */ this.start(action, Math.min(slot, this.kb.codes(action).length)); };
      b.oncontextmenu = (e) => {
        e.preventDefault(); if (this.capturing) return;
        if (this.kb.clear(action, slot)) { const u = this.kb.unbound(); this.notice(u.includes(action) ? `"${ACTIONS.find((x) => x.id === action).label}" is now UNBOUND.` : 'Binding cleared.', u.includes(action) ? 'warn' : 'ok'); this.render(); }
      };
    });
  }
}
