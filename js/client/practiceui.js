// Part E (docs/ASCENSION-PLAN.md): the Practice client. Three pieces, all driven by client/townui.js (desktop, phone, online):
//   records    a real attempt (never a practice run) that reaches a boss phase is written to the account
//              (profile.prac, sim/practice.js recordPhase / recordAttempt): solo from the live sim, online from events
//   the tab    the Mission Counter's Practice tab: every encounter you have reached, its phases (the ones past your best
//              stay locked), a variation lock where the fight rolls one, Start (solo only; practice pays nothing)
//   the HUD    in a practice run: the phase timeline (the phase now, the start phase, the locked ones), the run clock and
//              tries, restart from any reached phase, Leave; the clear card when the boss falls
import { PRACTICE, PRACTICE_ENCS, encKey, encBase, encAstral, phasesFor, varies, reached, recordPhase, recordAttempt, practiceList, phaseOf, practiceOn, pracOf } from '../sim/practice.js';
import { profile, fmtTime } from './rewards.js';
import { MISSIONS } from '../sim/hub.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nameOf = (enc) => { const id = encBase(enc), m = MISSIONS.find((q) => q.id === id); return (PRACTICE_ENCS[id] ? PRACTICE_ENCS[id].boss : id) + (encAstral(enc) ? ' · Astral' : ''); };
const placeOf = (enc) => { const m = MISSIONS.find((q) => q.id === encBase(enc)); return m ? m.name : ''; };
const AST_ACT = { 1: 1, 2: 3, 3: 4 };

export const PR_CSS = `
.pu-wrap { display: flex; flex-direction: column; gap: 8px; max-height: 56vh; overflow-y: auto; padding-right: 4px; }
.pu-intro { font-size: 14px; color: #cfc6e6; margin: 0 0 4px; }
.pu-row { display: grid; grid-template-columns: minmax(150px, 1.1fr) 2fr auto; gap: 10px; align-items: center; background: rgba(255,255,255,.05); border: 2px solid rgba(255,255,255,.08); border-radius: 12px; padding: 8px 10px; cursor: pointer; }
.pu-row.sel { border-color: #7ee0ff; background: rgba(126,224,255,.10); }
.pu-row .pu-n b { display: block; font-size: 16px; color: #fff; } .pu-row .pu-n span { font-size: 12px; color: #a99fc4; }
.pu-ph { display: flex; flex-wrap: wrap; gap: 4px; }
.pu-chip { font: inherit; font-size: 12px; padding: 3px 8px; border-radius: 999px; border: 2px solid #4d4466; background: #2b2433; color: #e8e2f6; cursor: pointer; }
.pu-chip.on { background: #7ee0ff; color: #1d1830; border-color: #7ee0ff; }
.pu-chip.lock { opacity: .45; cursor: not-allowed; border-style: dashed; }
.pu-var { display: flex; gap: 4px; align-items: center; font-size: 12px; color: #cfc6e6; flex-wrap: wrap; }
.pu-go { min-width: 92px; }
.pu-foot { font-size: 13px; color: #a99fc4; margin: 6px 0 0; } .pu-warn { color: #ffb86b; }
#pracHud { position: fixed; left: 12px; top: 96px; width: 262px; z-index: 30; background: linear-gradient(180deg, rgba(24,20,40,.88), rgba(24,20,40,.74)); border: 2px solid #7ee0ff; border-radius: 14px; padding: 8px 10px 9px; color: #fff; font-family: inherit; box-shadow: 0 0 18px rgba(126,224,255,.25); pointer-events: auto; }
#pracHud.hidden { display: none; }
#pracHud .ph-t { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
#pracHud .ph-t b { font-size: 13px; letter-spacing: .08em; color: #7ee0ff; } #pracHud .ph-t span { font-size: 12px; color: #ffd23f; }
#pracHud .ph-b { font-size: 15px; margin: 2px 0 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#pracHud .ph-s { font-size: 12px; color: #cfc6e6; }
#pracHud .ph-line { display: flex; gap: 3px; margin: 7px 0 4px; }
#pracHud .ph-seg { flex: 1; position: relative; height: 26px; border-radius: 7px; background: #2b2433; border: 2px solid #4d4466; color: #e8e2f6; font: inherit; font-size: 12px; cursor: pointer; padding: 0; }
#pracHud .ph-seg.done { background: #3c5a6b; } #pracHud .ph-seg.now { background: #7ee0ff; color: #1d1830; border-color: #fff; box-shadow: 0 0 10px #7ee0ff; }
#pracHud .ph-seg.start::after { content: ''; position: absolute; left: 50%; bottom: -7px; margin-left: -4px; border: 4px solid transparent; border-bottom-color: #ffd23f; transform: rotate(180deg); }
#pracHud .ph-seg.lock { opacity: .4; cursor: not-allowed; border-style: dashed; }
#pracHud .ph-name { font-size: 12px; color: #fff; min-height: 15px; }
#pracHud .ph-btn { display: flex; gap: 6px; margin-top: 6px; } #pracHud .ph-btn .btn { flex: 1; font-size: 13px; padding: 4px 6px; }
#pracHud .ph-card { margin-top: 6px; padding: 6px 8px; border-radius: 9px; background: rgba(126,224,255,.16); font-size: 12px; color: #dff6ff; }
body.mobile #pracHud, #pracHud.mob { top: 172px; left: 10px; width: 226px; padding: 6px 8px 7px; }
#pracHud.mob .ph-seg { height: 30px; font-size: 13px; } #pracHud.mob .ph-btn .btn { font-size: 14px; padding: 6px; }
@media (max-width: 760px) { .pu-row { grid-template-columns: 1fr; } }
`;

/** the Mission Counter's Practice tab (st: { enc, ph, v, msg }) */
export function practiceTabHtml(pr, st, I = {}) {
  const list = practiceList(pr).sort((a, b) => Object.keys(PRACTICE_ENCS).indexOf(encBase(a)) - Object.keys(PRACTICE_ENCS).indexOf(encBase(b)) || (encAstral(a) ? 1 : 0) - (encAstral(b) ? 1 : 0));
  const solo = !I.coop;
  if (!list.length) return `<p class="pu-intro">Practice a boss fight from any phase you have already reached, as often as you like. Nothing to practise yet: reach a boss in a real attempt (Trials, Extremes, raids, dungeon bosses, Astrael) and it appears here.</p>`;
  if (!st.enc || !list.includes(st.enc)) { st.enc = list[0]; st.ph = 0; st.v = 0; }
  const rows = list.map((enc) => {
    const names = phasesFor(enc), r = reached(pr, enc), sel = enc === st.enc, ph = sel ? Math.max(1, Math.min(r, st.ph || r)) : r;
    const chips = names.map((n, i) => { const k = i + 1, lock = k > r; return `<button class="pu-chip${lock ? ' lock' : ''}${sel && k === ph ? ' on' : ''}" data-enc="${enc}" data-ph="${lock ? 0 : k}" title="${esc(n)}${lock ? ' · locked: reach it in a real attempt first' : ''}">${lock ? '🔒 ' : ''}${k}${!this_mobile() ? ' · ' + esc(n) : ''}</button>`; }).join('');
    const vr = varies(enc) ? `<div class="pu-var">Variation ${[0, 1, 2, 3, 4, 5].slice(0, PRACTICE.vars + 1).map((v) => `<button class="pu-chip${sel && (st.v | 0) === v ? ' on' : ''}" data-enc="${enc}" data-v="${v}">${v ? v : 'Random'}</button>`).join('')}</div>` : `<div class="pu-var">Fixed rotation (nothing to lock)</div>`;
    const n = (pracOf(pr)[enc] || {}).n | 0;
    return `<div class="pu-row${sel ? ' sel' : ''}" data-enc="${enc}"><div class="pu-n"><b>${esc(nameOf(enc))}</b><span>${esc(placeOf(enc))} · best: phase ${r} / ${names.length}${n ? ` · ${n} real attempt${n === 1 ? '' : 's'}` : ''}</span></div>
      <div><div class="pu-ph">${chips}</div>${vr}</div>
      <button class="btn pu-go" data-go="${enc}" ${solo && I.host !== false ? '' : 'disabled style="opacity:.5"'}>Practise</button></div>`;
  }).join('');
  return `<p class="pu-intro">Start any boss you have reached, from any phase you reached (never one you haven’t). Practice pays nothing (no loot, XP, keys or records) and costs nothing: a wipe just restarts the phase.</p>
    <div class="pu-wrap">${rows}</div><p class="pu-foot${solo ? '' : ' pu-warn'}">${solo ? esc(st.msg || 'Solo only. Leave from the pause menu or the Practice panel.') : 'Practice is solo: play offline (or alone) to practise. Your records still grow from real co-op attempts.'}</p>`;
}
let MOB = false; function this_mobile() { return MOB; }
export function wirePracticeTab(board, ctx) {
  const st = ctx.st, pr = profile.load();
  for (const b of board.querySelectorAll('.pu-row')) b.onclick = () => { if (st.enc !== b.dataset.enc) { st.enc = b.dataset.enc; st.ph = 0; st.v = 0; ctx.rerender(); } };
  for (const b of board.querySelectorAll('.pu-chip[data-ph]')) b.onclick = (e) => { e.stopPropagation(); const k = +b.dataset.ph; if (!k) { st.msg = 'Locked: reach that phase in a real attempt first.'; } else { st.enc = b.dataset.enc; st.ph = k; st.msg = ''; } ctx.rerender(); };
  for (const b of board.querySelectorAll('.pu-chip[data-v]')) b.onclick = (e) => { e.stopPropagation(); st.enc = b.dataset.enc; st.v = +b.dataset.v; ctx.rerender(); };
  for (const b of board.querySelectorAll('[data-go]')) b.onclick = (e) => {
    e.stopPropagation(); if (b.disabled) return;
    const enc = b.dataset.go, r = reached(pr, enc); if (!r) return;
    const ph = enc === st.enc ? Math.max(1, Math.min(r, st.ph || r)) : r, v = enc === st.enc && varies(enc) ? st.v | 0 : 0;
    ctx.game.command({ type: 'practice', enc, ph, v, reach: r }); ctx.done();
  };
}

/** records + the in-run HUD */
export class PracticeUI {
  constructor(game, opts = {}) {
    this.g = game; this.mobile = !!opts.mobile; MOB = this.mobile; this.last = {}; this.at = 0; this.card = null;
    if (typeof document === 'undefined') return;
    if (!document.getElementById('practice-css')) { const s = document.createElement('style'); s.id = 'practice-css'; s.textContent = PR_CSS; document.head.appendChild(s); }
    const h = this.hud = document.createElement('div'); h.id = 'pracHud'; h.className = 'hidden' + (this.mobile ? ' mob' : '');
    h.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true }); h.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.appendChild(h);
  }
  get solo() { const I = this.g.hubInfo ? this.g.hubInfo() : {}; return !I.coop; }
  /** a real attempt reached phase ph of enc (never while practising) */
  note(enc, ph) {
    if (!enc || !(ph >= 1) || practiceOn(this.g.sim)) return;
    const pr = profile.load(); let dirty = false;
    if ((this.last[enc] | 0) === 0) { recordAttempt(pr, enc); dirty = true; }
    if (ph > (this.last[enc] | 0)) this.last[enc] = ph;
    if (recordPhase(pr, enc, ph)) dirty = true;
    if (dirty) profile.save();
  }
  update() {
    const g = this.g, sim = g.sim; if (!sim) return;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (this.solo && sim.hub && now - this.at > 250) { // solo: read the live fight (4x a second)
      this.at = now;
      const enc = !practiceOn(sim) ? encKey(sim.hub.m, sim.astral) : null;
      if (enc) { const ph = phaseOf(sim); if (ph >= 1) this.note(enc, ph); else this.last[enc] = 0; } // (the boss gone: the next pull is a new attempt)
    }
    this.render(now);
  }
  onEvent(ev, me) {
    if (ev.type === 'practice') {
      if (ev.pid !== undefined && ev.pid !== me) return;
      const fx = this.g.fx;
      if (ev.ph === 'start' && ev.tries === undefined) { this.card = null; if (fx && fx.banner) fx.banner('PRACTICE', '#7ee0ff', `${nameOf(ev.enc)} · phase ${ev.phase} · ${varies(ev.enc) ? (ev.v ? 'variation ' + ev.v : 'random variation') : 'fixed rotation'} · pays nothing`, 2.4, 50); }
      else if (ev.ph === 'reset') { if (fx && fx.banner) fx.banner('PHASE RESET', '#7ee0ff', `Back to phase ${ev.phase} · try ${ev.tries}`, 1.6, 40); }
      else if (ev.ph === 'clear') this.card = { enc: ev.enc, t: ev.t | 0, tries: ev.tries | 0, until: (typeof performance !== 'undefined' ? performance.now() : 0) + 9000 };
      return;
    }
    if (this.solo || practiceOn(this.g.sim)) return; // (online: records from the fight's own events)
    const I = this.g.hubInfo ? this.g.hubInfo() : {}, enc = encKey(I.m, I.as); if (!enc) return;
    const E = PRACTICE_ENCS[encBase(enc)];
    let ph = 0;
    if (ev.type === 'bossPhase' && ev.raid) ph = ev.phase | 0;
    else if (E.eng === 'trial' && ev.type === 'trial') ph = ev.ph === 'pull' ? 1 : ev.ph === 'phase' ? (ev.n | 0) + (ev.nA | 0) : ev.ph === 'call' && /phase\s*(\d)/i.test(ev.sub || '') ? +RegExp.$1 : 0;
    else if (E.eng === 'astrael' && ev.type === 'astrael') ph = ev.ph === 'pull' ? 1 : ev.ph === 'act' ? AST_ACT[ev.act] | 0 : ev.ph === 'shatter' ? 2 : ev.ph === 'bigbang' ? 5 : 0;
    else if ((E.eng === 'glow' && ev.type === 'glow' && ev.ph === 'start') || (ev.type === 'bossIntro')) ph = 1;
    else if ((ev.type === 'trial' || ev.type === 'astrael' || ev.type === 'glow' || ev.type === 'unw') && (ev.ph === 'wipe' || ev.ph === 'end')) { this.last[enc] = 0; return; }
    if (ph >= 1) this.note(enc, ph);
  }
  render(now) {
    const h = this.hud; if (!h) return;
    const P = this.g.sim && this.g.sim.practice, C = this.card && now < this.card.until ? this.card : null;
    if (!P && !C) { if (!h.classList.contains('hidden')) { h.classList.add('hidden'); h.innerHTML = ''; this.key = ''; } return; }
    if (!P) { const k = 'c' + C.enc + C.t; if (this.key !== k) { this.key = k; h.innerHTML = `<div class="ph-t"><b>PRACTICE CLEAR</b><span>no rewards</span></div><div class="ph-b">${esc(nameOf(C.enc))}</div><div class="ph-card">Boss down ${fmtTime(C.t)} into this try · ${C.tries} tr${C.tries === 1 ? 'y' : 'ies'}. Practice again from the Mission Counter.</div>`; h.classList.remove('hidden'); } return; }
    const names = phasesFor(P.enc), cur = phaseOf(this.g.sim, P.id), t = Math.max(0, ((this.g.sim.tick | 0) - (P.at | 0)) / 60);
    const k = [P.enc, P.ph, P.v, P.reach, P.tries, cur].join('|'), clock = `Try ${P.tries} · ${fmtTime(t)} · ${varies(P.enc) ? (P.v ? 'Variation ' + P.v : 'Random variation') : 'Fixed rotation'}`;
    if (this.key === k) { const c = h.querySelector('.ph-s'); if (c && c.textContent !== clock) c.textContent = clock; return; } this.key = k; // (the DOM is rebuilt only when the timeline changes: a tap is never lost to a re-render)
    const segs = names.map((n, i) => { const q = i + 1, lock = q > P.reach; return `<button class="ph-seg${lock ? ' lock' : ''}${q === cur ? ' now' : q < cur ? ' done' : ''}${q === P.ph ? ' start' : ''}" data-ph="${lock ? 0 : q}" title="${esc(n)}${lock ? ' (locked)' : ' · restart here'}">${lock ? '🔒' : q}</button>`; }).join('');
    h.innerHTML = `<div class="ph-t"><b>PRACTICE</b><span>no rewards</span></div><div class="ph-b">${esc(nameOf(P.enc))}</div>
      <div class="ph-s">${clock}</div>
      <div class="ph-line">${segs}</div><div class="ph-name">${cur ? `Phase ${cur}: ${esc(names[cur - 1] || '')}` : 'The pull…'}</div>
      <div class="ph-btn"><button class="btn small" data-act="re">↺ Phase ${P.ph}</button><button class="btn small ghost" data-act="leave">Leave</button></div>`;
    h.classList.remove('hidden');
    for (const b of h.querySelectorAll('.ph-seg')) b.onclick = () => { const q = +b.dataset.ph; if (q) this.g.command({ type: 'practiceGo', ph: q }); };
    h.querySelector('[data-act="re"]').onclick = () => this.g.command({ type: 'practiceGo', ph: P.ph });
    h.querySelector('[data-act="leave"]').onclick = () => this.g.command({ type: 'town' });
  }
  destroy() { if (this.hud) this.hud.remove(); this.hud = null; }
}
