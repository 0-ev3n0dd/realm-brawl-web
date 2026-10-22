import { glPref, GL_INFO, glSupported } from '../../js/client/gl/glcore.js';
// Phone Options: the menu hub's Options tab (client/menuhub.js mounts root's .options-box), in the same sub-tabs as the
// desktop (client/options.js OPT_TABS): Gameplay · Controls · Graphics · Audio · Interface · Account & Online. The ❚❚
// button opens it (there is no pause menu any more: the solo world holds while the hub is up). The phone's own settings
// (joystick, auto-aim, camera...) are the title screen's Settings panel segments (#pause [data-set]): a tap here clicks
// the matching one, so both stay one source of truth (mobile/js/settings.js storage, main.js applies).
import { showAccountReset } from '../../js/client/acctreset.js';
import { testActive, switchSave, resetAscTest } from '../../js/client/asctest.js';
import { accountName } from '../../js/client/lasthero.js';
import { introPref } from '../../js/client/introflow.js';
import { vfxPref } from '../../js/client/fxns.js';
import { OPT_TABS } from '../../js/client/options.js';
import { inMission } from '../../js/client/towntravel.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SEGS = {
  sound: [['true', 'On'], ['false', 'Off']], autoAim: [['true', 'On'], ['false', 'Off']], joystick: [['S', 'S'], ['M', 'M'], ['L', 'L']],
  chains: [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], camera: [['near', 'Near'], ['normal', 'Normal'], ['far', 'Far']], quality: [['auto', 'Auto'], ['high', 'High'], ['low', 'Low']],
};
export class MobileOptions {
  constructor(game) {
    this.g = game; this.tab = 'gameplay';
    this.root = document.createElement('div'); this.root.className = 'm-opts-home hidden';
    this.root.innerHTML = '<div class="panel options-box m-opts"></div>';
    document.body.appendChild(this.root);
  }
  get box() { return this.root.querySelector('.options-box') || document.querySelector('.options-box.m-opts'); }
  notice() {}
  syncSession() { const b = this.box; if (b && b.querySelector('#mSess')) this.renderSess(b.querySelector('#mSess')); }
  seg(key, label, note) {
    const s = this.g.settings || {}, cur = String(s[key]);
    return `<div class="opt-row m-opt"><span class="opt-label">${label}${note ? ` <small>${note}</small>` : ''}</span><span class="m-seg">${SEGS[key].map(([v, t]) => `<button class="opt-slot${v === cur ? ' sel' : ''}" data-mset="${key}" data-v="${v}">${t}</button>`).join('')}</span></div>`;
  }
  pane() {
    const s = this.g.settings || {}, G = this.g;
    switch (this.tab) {
      case 'gameplay': return `<div class="opt-group">Targeting</div>${this.seg('autoAim', 'Auto-aim', 'attacks and skills face the nearest enemy (bosses and elites first)')}
        <div class="opt-group">HUD</div>${this.seg('chains', 'Chain list', 'the combo chains beside the buttons')}
        <div class="opt-group">Training</div><div class="opt-row m-opt"><span class="opt-label">Training Dummy <small>health, armor, boss flag, count, layout, movement, telegraphs, meter, numbers</small></span><button class="btn small" id="mOptDummy">Dummy settings</button></div>`;
      case 'controls': return `<div class="opt-group">Touch controls</div>${this.seg('joystick', 'Joystick size')}<p class="hint">Key rebinding and Keyboard-only mode are desktop options.</p>`;
      case 'graphics': return `<div class="opt-group">View</div>${this.seg('camera', 'Camera', 'how much of the battlefield fits on screen')}${this.seg('quality', 'Graphics', 'Auto keeps 60 fps')}
        <div class="opt-group">Effects</div><div class="opt-row m-opt"><span class="opt-label">Skill effects <small>strength of skill and chain effects; 0 turns them off</small></span><label class="opt-range"><input type="range" id="mOptSkillFx" min="0" max="100" step="5" value="${Math.round(vfxPref.skill * 100)}"><output id="mOptSkillFxV">${Math.round(vfxPref.skill * 100)}%</output></label></div>
        <div class="opt-group">Renderer</div>${Object.keys(GL_INFO).map((k) => `<label class="opt-row m-opt"><span class="opt-label">${GL_INFO[k].label} <small>${glSupported() ? GL_INFO[k].note : 'WebGL2 not available: Canvas2D'}</small></span><input type="checkbox" id="mOptGL_${k}" data-gl="${k}" ${glPref.on(k) ? 'checked' : ''}></label>`).join('')}
        <div class="opt-group">Performance</div><label class="opt-row m-opt"><span class="opt-label">Performance overlay <small>fps, avg / 1% low / min + where each frame's time goes</small></span><input type="checkbox" id="mOptPerf" ${s.perfOverlay ? 'checked' : ''}></label>`;
      case 'audio': return `<div class="opt-group">Sound</div>${this.seg('sound', 'Sound', 'music and effects')}`;
      case 'interface': return `<div class="opt-group">Intro</div>
        <label class="opt-row m-opt"><span class="opt-label">Play intro on launch <small>the music-synced intro of all ten classes before the title</small></span><input type="checkbox" id="mOptIntro" ${introPref.on ? 'checked' : ''}></label>
        <div class="opt-row m-opt"><span class="opt-label">Watch the intro <small>saves, leaves the game and plays it now</small></span><button class="btn small" id="mOptWatch">▶ Watch Intro</button></div>`;
      case 'account': {
        const p = G.player || {}, mis = inMission(G);
        let h = `<div class="opt-group">This session</div><div class="opt-row m-opt"><span class="opt-label">${esc(p.name || 'Hero')} <small>Lv ${p.level | 0} · solo · saves automatically</small></span></div>`;
        if (mis) h += `<div class="opt-row m-opt"><span class="opt-label">Abandon mission <small>leave the mission, trial or dungeon and go back to town</small></span><button class="btn small" data-msess="town">⚑ Back to Town</button></div>`;
        else if (G.player && !(G.hubInfo && G.hubInfo().m === 'town')) h += '<p class="hint">To go back to Brightwater Village: World Map › Realm Gate, tap the village flag, then Travel.</p>'; // (2026-10-09 town flag: no Travel button here)
        h += testActive() ? `<div class="opt-group">Ascension Test save</div><div class="opt-row m-opt"><span class="opt-label">Test save is ON <small>a separate save; your main save is untouched</small></span><button class="btn small" data-msess="ascmain">Main save</button><button class="btn small danger" data-msess="ascreset">Reset test</button></div>` : `<div class="opt-group">Ascension Test save</div><div class="opt-row m-opt"><span class="opt-label">Play the test save <small>all 10 heroes Lv 50, Altar open, pieces + materials ready; main save not touched</small></span><button class="btn small" data-msess="asctest">Test save</button></div>`;
        h += `<div class="opt-group">Account</div><div class="opt-row m-opt"><span class="opt-label">Reset account <small>deletes every hero, unlock and all progress on this device (phone and PC); keeps graphics, audio and control settings</small></span><button class="btn small danger" data-msess="acctreset" id="mAcctReset">⚠ Reset account</button></div>`;
        return h; // (Save & Quit / Back to game are the always-visible footer buttons)
      }
    }
    return '';
  }
  sess(a) {
    const G = this.g, H = G.menuHub;
    if (a === 'asctest' || a === 'ascmain') { try { if (G.save && G.player) G.save(); } catch { /* */ } switchSave(a === 'asctest'); return; }
    if (a === 'ascreset') { if (confirm('Reset the Ascension Test save? Your main save is not touched.')) resetAscTest(); return; }
    if (a === 'acctreset') { showAccountReset({ name: accountName(localStorage) }); return; }
    if (a === 'town') { G.command({ type: 'town' }); if (H) H.close(); G.onMenuChange && G.onMenuChange(); }
    else if (a === 'quit') { if (H) H.close(); G.quit(); }
    else if (a === 'back') { if (H) H.close(); G.onMenuChange && G.onMenuChange(); if (G.audio && G.audio.ensure) G.audio.ensure(); }
  }
  renderSess(el) {
    const G = this.g, mis = inMission(G);
    const html = (mis ? '<button class="btn small raid" id="townBtn" data-msess="town">⚑ Abandon → Town</button>' : '')
      + '<button class="btn small danger" id="quitBtn" data-msess="quit">Save &amp; Quit</button><button class="btn small" id="resumeBtn" data-msess="back">Back to game</button>';
    if (el.innerHTML !== html) { el.innerHTML = html; el.querySelectorAll('[data-msess]').forEach((b) => { b.onclick = (e) => { e.preventDefault(); this.sess(b.dataset.msess); }; }); }
  }
  render() {
    const b = this.box; if (!b) return;
    const s = this.g.settings || {};
    b.innerHTML = `<h2>Options <span class="sub">${esc((OPT_TABS.find((t) => t.id === this.tab) || OPT_TABS[0]).label)}</span></h2>
      <div class="opt-tabs m-tabs">${OPT_TABS.map((t) => `<button class="opt-tab${t.id === this.tab ? ' on' : ''}" data-otab="${t.id}">${esc(t.id === 'account' ? 'Account' : t.label)}</button>`).join('')}</div>
      <div class="opt-list m-list">${this.pane()}</div>
      <div class="opt-foot m-foot"><span class="opt-sess" id="mSess"></span></div>`;
    b.querySelectorAll('[data-otab]').forEach((x) => { x.onclick = () => { this.tab = x.dataset.otab; this.render(); }; });
    b.querySelectorAll('[data-mset]').forEach((x) => { x.onclick = () => {
      const seg = document.querySelector(`#pause [data-set="${x.dataset.mset}"] [data-v="${x.dataset.v}"]`);
      if (seg) seg.click(); else { const v = x.dataset.v; s[x.dataset.mset] = v === 'true' ? true : v === 'false' ? false : v; if (this.g.applySettings) this.g.applySettings(); }
      this.render();
    }; });
    b.querySelectorAll('.opt-list [data-msess]').forEach((x) => { x.onclick = (e) => { e.preventDefault(); this.sess(x.dataset.msess); }; });
    for (const el of b.querySelectorAll('[data-gl]')) el.onchange = (e) => glPref.set(el.dataset.gl, e.target.checked);
    const pf = b.querySelector('#mOptPerf'); if (pf) pf.onchange = (e) => { s.perfOverlay = e.target.checked; if (this.g.setPerfOverlay) this.g.setPerfOverlay(s.perfOverlay); };
    const sf = b.querySelector('#mOptSkillFx'); if (sf) sf.oninput = () => { vfxPref.setSkill(+sf.value / 100); const o = b.querySelector('#mOptSkillFxV'); if (o) o.textContent = sf.value + '%'; };
    const od = b.querySelector('#mOptDummy'); if (od) od.onclick = (e) => { e.preventDefault(); if (this.g.menuHub) this.g.menuHub.close(); this.g.village.openDummy(); };
    const it = b.querySelector('#mOptIntro'); if (it) it.onchange = (e) => introPref.set(e.target.checked);
    const wt = b.querySelector('#mOptWatch'); if (wt) wt.onclick = () => { if (this.g.menuHub) this.g.menuHub.close(); const R = window.__rbm; this.g.quit(); if (R && R.playIntro) setTimeout(() => R.playIntro(), 50); };
    this.renderSess(b.querySelector('#mSess'));
  }
  destroy() { this.root.remove(); }
}
