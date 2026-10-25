// Mission dungeons, the DOM side (desktop + phone): the "[F] Defense mission" prompt by an entrance, the mission card
// (type, map + zone tier, danger, objective + the numbers, reward focus, solo / co-op, Enter / Close; Enter / Esc keys,
// arrow-key navigation in Keyboard-only mode via kbnav's #opsCard root), and in a mission the Defense Extract / Continue
// choice, the Defense build card at a socket (Turret / Spike Trap / Ward, or the upgrade: keys 1-3 / Enter), the
// "start the wave" (build phase) and "fire the pulse" (relic charged) prompts at the relic. The mission card also shows
// the map's hazard and this week's modifiers. Sends { type: 'op', g } / { type: 'op', act [, s, sk] }.
import { OPS, OPS_TYPE, OPS_BIOME, BOSS_GATES, gateName, opsArenaAt, OPS_Y } from '../sim/opsconst.js';
import { KEYS } from '../sim/meta.js';
import { MISSION } from '../sim/hub.js';
import { opsIconUrl, iconOf } from './opsicons.js';
import { nearGate, opsView } from './opsfx.js';
import { OPS_HAZ, HAZ_TYPES, WEEKLY, weeklyMods, GRADES } from '../sim/opsmods.js';
import { BUILD_INFO, sockKind } from './missionfx.js';
import { bestFor, gradeCol } from './bestgrade.js';
import { weeklyBoard, isFeatured, WK } from '../sim/weekly.js';

const CSS = `
.op-card { position: fixed; inset: 0; z-index: 41; display: flex; align-items: center; justify-content: center; background: rgba(10,8,20,.5); }
.op-card .panel { width: min(520px, 94vw); max-height: 90vh; overflow: auto; position: relative; border-top: 6px solid var(--opc, #ffd23f); }
.op-head { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.op-head img { width: 56px; height: 56px; flex: none; filter: drop-shadow(0 3px 0 #2b2433); }
.op-head h2 { margin: 0; font-size: 30px; color: var(--opc, #ffd23f); text-shadow: 0 3px 0 #2b2433; line-height: 1; }
.op-head .op-map { font-family: 'Trebuchet MS', sans-serif; font-size: 13.5px; color: #e6ddf5; margin-top: 4px; }
.op-stars { color: #ffd23f; letter-spacing: 2px; text-shadow: 0 2px 0 #2b2433; }
.op-rows { display: grid; grid-template-columns: 112px 1fr; gap: 6px 10px; font-family: 'Trebuchet MS', sans-serif; font-size: 13.5px; line-height: 1.35; margin: 10px 0 12px; }
.op-rows b { color: #ffd23f; font-family: 'Lilita One', sans-serif; font-weight: normal; font-size: 15px; }
.op-btns { display: flex; gap: 10px; }
.op-btns .btn { flex: 1; font-size: 22px; padding: 8px 12px; }
.op-btns .op-go { background: var(--opc, #ffb52e); }
.op-btns kbd, .op-prompt kbd { display: inline-block; min-width: 22px; padding: 0 6px; margin-left: 8px; border-radius: 6px; background: #2b2433; color: #ffd23f; font: inherit; font-size: 14px; }
.op-note { font-family: 'Trebuchet MS', sans-serif; font-size: 12.5px; color: #ffe7a0; margin: 8px 0 0; }
.op-prompt { bottom: 184px; } /* (part 3: clear of the ult bar over the skill bar) */
.op-builds { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0 12px; }
.op-builds .btn { font-size: 17px; padding: 8px 6px; line-height: 1.15; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.op-builds .btn small { font-family: 'Trebuchet MS', sans-serif; font-size: 11.5px; opacity: .9; }
.op-builds .btn[disabled] { opacity: .45; }
.op-mods { display: flex; flex-wrap: wrap; gap: 6px; }
.op-mods span { padding: 1px 8px; border-radius: 8px; background: #2b2433; color: #ffe7a0; font-size: 12.5px; }
.op-prompt kbd { margin: 0 8px 0 0; font-size: 18px; }
@media (max-height: 520px) { .op-rows { font-size: 12px; margin: 6px 0 8px; } .op-head img { width: 40px; height: 40px; } .op-head h2 { font-size: 22px; } .op-prompt { bottom: 150px; } }
`;
const NUMS = {
  defense: () => `${OPS.defense.waves} waves a round, wave 5 is a siege boss. Between waves, build turrets, spike traps and wards with the materials kills drop. Stand by the relic to charge it, then fire a pulse that stuns the crowd. After each round: Extract or Continue (harder, one more set piece).`,
  mobile: () => `Stay near the carrier to move it (a crowd round it slows it; enemies at it chip it). 2 hack points: hold the ring ${OPS.mobile.hack.map((t) => Math.round(t / 60)).join(' / ')} s, and when it JAMS, reboot it (interact). Ambushes, a collapsing bridge, a hunter squad that marks one of you, then the boss at the final point: break its drain by hitting it hard or stunning it.`,
  assault: () => 'Break the 3 shield pylons to drop the first gate (they shoot back). Cross the trap hall (watch the telegraphs: the traps hit enemies too), beat the champion, then the Gatekeeper: hammer combos, rippling quakes, sweeping beams, rune crosses. No invulnerable phases.',
  capture: () => `Read 3 clues (follow the footprints; stand by a clue) to find its lair. Then the chase: it flees between clearings, lays snares, calls guards and splits off decoys (only the real one leaves glowing footprints). Fill the PIN meter: nets from the crates (interact / TAP in reach: +30), wreck its escape rigs (+20, +${Math.round(OPS.capture.rigBonus / 60)} s), hit it. ${Math.round(OPS.capture.escapeT / 60)} s on the clock, paused while it's netted; at 0 it bolts for a rig. Cornered: capture it in a real fight. No invulnerable phases.`,
  swarm: () => `${OPS.swarm.waves} escalating horde waves, then the Swarm Queen. The safe ring shrinks at waves 3, 5 and 7 (outside it burns). Chain kills for a combo: x${OPS.swarm.combo.mul.join(' / x')} loot at ${OPS.swarm.combo.tiers.join(' / ')}. The party has ${OPS.swarm.lives} lives.`,
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class OpsUI {
  /** game: { player, sim, command(c), hubInfo(), paused, onBoard? }; opts: { mobile, keyLabel } */
  constructor(game, opts = {}) {
    this.game = game; this.mobile = !!opts.mobile; this.keyLabel = opts.keyLabel || (() => 'F');
    this.open = false; this.gate = null; this.mode = null; this.sock = -1; this._bkey = '';
    if (typeof document === 'undefined') return;
    if (!document.getElementById('opsui-css')) { const st = document.createElement('style'); st.id = 'opsui-css'; st.textContent = CSS; document.head.appendChild(st); }
    const pr = this.prompt = document.createElement('button');
    pr.id = 'opsPrompt'; pr.className = 'btn tu-prompt op-prompt hidden';
    pr.addEventListener('click', (e) => { e.preventDefault(); this.interact(); });
    pr.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    document.body.appendChild(pr);
    const bd = this.card = document.createElement('div');
    bd.id = 'opsCard'; bd.className = 'op-card hidden';
    bd.addEventListener('pointerdown', (e) => { if (e.target === bd) this.hide(); });
    bd.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    document.body.appendChild(bd);
    this.onKey = (e) => {
      if (!this.open || e.repeat) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.hide(); return; }
      if (e.defaultPrevented) return; // (kbnav already clicked its focused button)
      if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); this.confirm(); }
      else if (this.mode === 'choice' && (e.key === '1' || e.key === '2')) { e.preventDefault(); e.stopImmediatePropagation(); this.act(e.key === '1' ? 'extract' : 'cont'); }
      else if (this.mode === 'build' && (e.key === '1' || e.key === '2' || e.key === '3')) { e.preventDefault(); e.stopImmediatePropagation(); this.buildPick(+e.key - 1); }
    };
    addEventListener('keydown', this.onKey, true);
  }
  get info() { return this.game.hubInfo ? this.game.hubInfo() : { host: true }; }
  /** what the interact key would do right now: { kind: 'gate', g } | { kind: 'choice' } | { kind: 'build', s } | { kind: 'ready' } | { kind: 'pulse' } | null */
  target() {
    const g = this.game, p = g.player, sim = g.sim;
    if (!p || p.dead || !sim) return null;
    if (p.y < OPS_Y) {
      const V = opsView(sim), A = opsArenaAt(p.x, p.y);
      if (!V || !A || V.k !== A.type) return null;
      if (V.k === 'defense' && V.st === 'choice') return { kind: 'choice' };
      if (V.k === 'defense' && V.st === 'run') {
        if (V.ph === 'build') {
          let best = -1, bd = 150; A.socks.forEach((q, i) => { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < bd) { bd = d; best = i; } });
          if (best >= 0) return { kind: 'build', s: best };
        }
        const R = A.relic, nearR = Math.hypot(p.x - R.x, p.y - R.y) < OPS.defense.charge.actR - 30;
        if (nearR && V.ph === 'build') return { kind: 'ready' };
        if (nearR && V.ph === 'wave' && V.chg >= 100) return { kind: 'pulse' };
      }
      if (V.k === 'mobile' && V.st === 'run' && V.jam && Math.hypot(p.x - V.cx, p.y - V.cy) < OPS.mobile.rebootR - 20) return { kind: 'reboot' };
      if (V.k === 'capture' && V.st === 'run' && (V.ph === 'chase' || V.ph === 'fight')) {
        const r = (V.nets || []).find((q) => q[0] === p.id), n = r ? r[1] : 0, ids = new Set(V.qd || []);
        if (n > 0 && ids.size && (sim.enemies || []).some((e) => !e.dead && ids.has(e.id) && Math.hypot(e.x - p.x, e.y - p.y) < OPS.capture.netR - 20)) return { kind: 'net', n };
      }
      return null;
    }
    if (sim.noPortals) return null;
    const gt = nearGate(sim, p); return gt ? { kind: 'gate', g: gt } : null;
  }
  update() {
    if (!this.prompt) return;
    const sim = this.game.sim, p = this.game.player;
    const T = this.target();
    const free = !this.open && !this.game.paused && !(this.game.story && this.game.story.isOpen && this.game.story.isOpen()) && !(this.game.town && this.game.town.open) && !(this.game.townOpen && this.game.townOpen()) && !(this.game.hud && this.game.hud.bigMap && this.game.hud.bigMap.open) && !(this.game.rewards && this.game.rewards.isOpen && this.game.rewards.isOpen());
    const show = free && !!T;
    this.prompt.classList.toggle('hidden', !show);
    if (show) {
      const k = this.mobile ? '' : `<kbd>${this.keyLabel('interact')}</kbd>`;
      const V = T.kind === 'build' ? opsView(sim) : null, sk = V ? sockKind(V, T.s) : '';
      const txt = T.kind === 'gate' ? (T.g.type === 'boss' ? gateName(T.g) : `${OPS_TYPE[T.g.type].name} mission`) : T.kind === 'choice' ? 'Extract or Continue?' : T.kind === 'build' ? (sk ? (V.so[T.s][1] >= 2 ? `${BUILD_INFO[sk].name} (max)` : `Upgrade ${BUILD_INFO[sk].name}`) : 'Build here') : T.kind === 'ready' ? 'Start the wave' : T.kind === 'pulse' ? 'FIRE RELIC PULSE' : T.kind === 'reboot' ? 'REBOOT THE CARRIER' : T.kind === 'net' ? `THROW NET (${T.n})` : 'Extract now';
      const html = `${k}${txt}`; if (this.prompt.innerHTML !== html) this.prompt.innerHTML = html;
      const col = T.kind === 'gate' ? iconOf(T.g).col : T.kind === 'build' ? '#ffcf4a' : T.kind === 'pulse' || T.kind === 'reboot' ? '#ffffff' : T.kind === 'net' ? '#f2ead8' : T.kind === 'ready' ? '#ff9a4c' : '#7dffb0'; if (this.prompt.style.background !== col) this.prompt.style.background = col;
    }
    if (this.open) { const T2 = T; if (!T2 || (this.mode === 'gate' && T2.g !== this.gate) || (this.mode !== 'gate' && T2.kind !== this.mode) || (this.mode === 'build' && T2.s !== this.sock)) this.hide(); else if (this.mode === 'build') { const V = opsView(sim), key = V && V.so ? `${V.mat}|${V.so[this.sock]}` : ''; if (key !== this._bkey) this.render(); } }
  }
  /** interact key: open the card / close it. true when handled. */
  interact() {
    if (this.open) { this.hide(); return true; }
    const T = this.target();
    if (T && (T.kind === 'ready' || T.kind === 'pulse' || T.kind === 'reboot' || T.kind === 'net')) { this.game.command({ type: 'op', act: T.kind }); return true; } // (one press: no card)
    if (T) { this.show(T); return true; }
    return false;
  }
  show(T) {
    this.mode = T.kind; this.gate = T.g || null; this.sock = T.s ?? -1; this.open = true;
    if (!this.card) return; // (headless / tests: the command path still opens)
    this.render(); this.card.classList.remove('hidden'); this.prompt.classList.add('hidden');
    if (this.game.onBoard) this.game.onBoard(true);
  }
  hide() { if (!this.open) return; this.open = false; if (!this.card) return; this.card.classList.add('hidden'); if (this.game.onBoard) this.game.onBoard(false); }
  confirm() { if (this.mode === 'gate') this.enter(); else if (this.mode === 'choice') this.act('extract'); else if (this.mode === 'build') this.buildPick(0); else if (this.mode === 'extract') this.act('extract'); }
  /** build card: i = 0..2 (turret / spike / ward on an empty socket; 0 = upgrade on a built one) */
  buildPick(i) {
    const V = opsView(this.game.sim); if (!V || this.sock < 0) return;
    const sk = sockKind(V, this.sock), kinds = ['turret', 'spike', 'ward'];
    const k = sk ? (i === 0 ? 'up' : null) : kinds[i]; if (!k) return;
    this.game.command({ type: 'op', act: 'build', s: this.sock, sk: k }); this.hide();
  }
  enter() {
    const g = this.gate; if (!g) return;
    if (this.info.host === false) return;
    this.game.command({ type: 'op', g: g.id }); this.hide();
  }
  act(a) { this.game.command({ type: 'op', act: a }); this.hide(); }
  render() {
    const I = this.info, host = I.host !== false, kE = this.mobile ? '' : '<kbd>Enter</kbd>', kX = this.mobile ? '' : '<kbd>Esc</kbd>';
    let html;
    if (this.mode === 'gate') {
      const g = this.gate, B = OPS_BIOME[g.biome], ic = iconOf(g);
      const stars = (n) => '★'.repeat(n) + `<span style="opacity:.3">${'★'.repeat(Math.max(0, 6 - n))}</span>`;
      if (g.type === 'boss') {
        const M = MISSION[g.dungeon] || {};
        html = `<div class="op-head"><img src="${opsIconUrl(ic.icon, ic.col, 112)}"><div><h2>${esc(BOSS_GATES[g.dungeon].name)}</h2><div class="op-map">${esc(B.name)} · boss dungeon · <span class="op-stars">${stars(M.stars || B.danger)}</span></div></div></div>
          <div class="op-rows"><b>Objective</b><span>${esc(M.desc || 'Fight down to the boss and clear the dungeon.')}</span>
          <b>Entrance</b><span>Fixed and always open: no portal drop needed.</span>
          <b>Mode</b><span>Solo or co-op (the host takes the whole party in).</span></div>`;
      } else {
        const T = OPS_TYPE[g.type], rw = g.type === 'assault' ? `${T.reward}: a ${KEYS[B.key] ? KEYS[B.key].name : 'Realm Gate key'} (15% chance of a second)` : g.type === 'defense' ? `${T.reward} (${B.set ? 'this map’s set' : 'set pieces'})` : T.reward;
        html = `<div class="op-head"><img src="${opsIconUrl(ic.icon, ic.col, 112)}"><div><h2>${esc(T.name)}</h2><div class="op-map">${esc(B.name)} · zone tier ${B.tier} · danger <span class="op-stars">${stars(B.danger)}</span></div></div></div>
          <div class="op-rows"><b>Objective</b><span>${esc(T.obj)}</span>
          <b>How it plays</b><span>${esc(NUMS[g.type]())}</span>
          <b>Reward focus</b><span>${esc(rw)}, plus normal drops scaled to tier ${B.tier}.</span>
          <b>Mode</b><span>${esc(T.mode || 'Solo or co-op')}</span>
          ${HAZ_TYPES.has(g.type) ? `<b>Hazard</b><span>${esc(OPS_HAZ[g.biome].name)}: ${esc(OPS_HAZ[g.biome].desc)}</span>` : ''}
          <b>This week</b><span class="op-mods">${weeklyMods(Date.now()).ids.map((k) => `<span title="${esc(WEEKLY[k].desc)}">${esc(WEEKLY[k].name)}${WEEKLY[k].bonus ? ` +${Math.round(WEEKLY[k].bonus * 100)}%` : ''}</span>`).join('')}</span><span></span><span style="font-size:12px;opacity:.85">${weeklyMods(Date.now()).ids.map((k) => esc(WEEKLY[k].desc)).join(' ')}</span>
          ${isFeatured(weeklyBoard(Date.now()), g.type, g.biome) ? `<b style="color:#7dffb0">★ Featured</b><span>This week's featured mission on the Weekly Board: grade rewards ×${WK.featMul}; an A or better pays a set piece of your choice.</span>` : ''}
          <b>Grade</b><span>${GRADES.map((r) => `${r[0]} ×${r[2]}`).join(' · ')} rewards (score: objective, survival, speed, mastery)</span>
          <b>Your best</b><span>${(() => { const h = bestFor(g.type, g.biome), all = bestFor(g.type); const chip = (r) => `<b style="color:${gradeCol(r.g)};font-size:17px">${r.g}</b> ${r.s} pts`; return `Here: ${h ? chip(h) : 'no grade yet'} · any map: ${all ? chip(all) + (all.b && all.b !== g.biome ? ` (${esc(OPS_BIOME[all.b].name)})` : '') : 'no grade yet'}${all ? ` · ${all.n} run${all.n === 1 ? '' : 's'} graded` : ''}`; })()}</span>
          <b>If you fall</b><span>Respawn by the objective, no item loss.</span></div>`;
      }
      html += `<div class="op-btns"><button class="btn op-go" data-op="go" ${host ? '' : 'disabled style="opacity:.5"'}>${host ? 'Enter' : 'Host enters'}${kE}</button><button class="btn ghost" data-op="close">Close${kX}</button></div>`;
      if (!host) html += `<p class="op-note">Only the host${I.hostName ? ` (${esc(I.hostName)})` : ''} can start a mission; the whole party goes in.</p>`;
      else if (I.coop) html += '<p class="op-note">You are the host: entering takes the whole party.</p>';
      this.card.style.setProperty('--opc', ic.col);
    } else if (this.mode === 'choice') {
      const V = opsView(this.game.sim) || {};
      html = `<div class="op-head"><img src="${opsIconUrl('shield', OPS_TYPE.defense.col, 112)}"><div><h2>Round ${V.r || 1} cleared</h2><div class="op-map">${V.rd || 0} set piece${V.rd === 1 ? '' : 's'} banked · ${Math.ceil((V.ch || 0) / 60)} s to choose (then: Extract)</div></div></div>
        <div class="op-rows"><b>Extract</b><span>Leave now with everything banked.</span><b>Continue</b><span>Round ${(V.r || 1) + 1}: tougher waves, one more set piece. If the relic falls you still keep the finished rounds.</span></div>
        <div class="op-btns"><button class="btn" data-op="extract" style="background:#7dffb0">Extract${this.mobile ? '' : '<kbd>1</kbd>'}</button><button class="btn op-go" data-op="cont">Continue${this.mobile ? '' : '<kbd>2</kbd>'}</button></div>
        <p class="op-note">Or stand on a pad. ${host ? '' : 'The host decides for the party.'}</p>`;
      this.card.style.setProperty('--opc', OPS_TYPE.defense.col);
    } else if (this.mode === 'build') {
      const V = opsView(this.game.sim) || {}, H = OPS_HAZ[V.b] || OPS_HAZ.wilds, D = OPS.defense.build, sk = sockKind(V, this.sock), lv = V.so && V.so[this.sock] ? V.so[this.sock][1] : 0, mat = V.mat | 0;
      this._bkey = V.so ? `${V.mat}|${V.so[this.sock]}` : '';
      const kb = (n) => (this.mobile ? '' : `<kbd>${n}</kbd>`);
      let body;
      if (!sk) body = `<div class="op-builds">${['turret', 'spike', 'ward'].map((k, i) => { const I = BUILD_INFO[k], c = D[k].cost; return `<button class="btn" data-op="b${i}" ${mat < c ? 'disabled' : ''} style="background:${I.col}">${esc(I.name)}${kb(i + 1)}<small>${c} ${esc(H.mat)}</small><small>${esc(I.desc)}</small></button>`; }).join('')}</div>`;
      else if (lv < 2) body = `<div class="op-rows"><b>${esc(BUILD_INFO[sk].name)}</b><span>Level ${lv}. Upgrade: more damage and reach.</span></div><div class="op-btns"><button class="btn op-go" data-op="b0" ${mat < D[sk].up ? 'disabled style="opacity:.5"' : ''}>Upgrade · ${D[sk].up} ${esc(H.mat)}${kb(1)}</button><button class="btn ghost" data-op="close">Close${kX}</button></div>`;
      else body = `<div class="op-rows"><b>${esc(BUILD_INFO[sk].name)}</b><span>Fully upgraded.</span></div><div class="op-btns"><button class="btn ghost" data-op="close">Close${kX}</button></div>`;
      html = `<div class="op-head"><img src="${opsIconUrl('shield', H.matCol, 112)}"><div><h2>Socket ${this.sock + 1}</h2><div class="op-map">${mat} ${esc(H.mat)} to spend · build phase</div></div></div>${body}
        <p class="op-note">Kills drop ${esc(H.mat)} (elites more, +${OPS.defense.matClean} for a wave the relic took no damage in). Shared by the party.</p>`;
      this.card.style.setProperty('--opc', H.matCol);
    }
    this.card.innerHTML = `<div class="panel">${html}</div>`;
    for (const b of this.card.querySelectorAll('[data-op]')) b.onclick = (e) => { e.stopPropagation(); if (b.disabled) return; const k = b.dataset.op; if (k === 'go') this.enter(); else if (k === 'close') this.hide(); else if (k[0] === 'b' && k.length === 2) this.buildPick(+k[1]); else this.act(k); };
  }
  destroy() { if (this.onKey) removeEventListener('keydown', this.onKey, true); if (this.prompt) this.prompt.remove(); if (this.card) this.card.remove(); this.prompt = this.card = null; }
}
