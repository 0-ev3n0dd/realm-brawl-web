// Game loop B3 (2026-10-09): the Weekly Board tab of the Mission Counter (desktop + phone): this week's featured mission
// (twist + boon, grade rewards x1.25), the bonus region (+50% materials, Swarms every ~2 min), the featured Trial (a free
// key), the 3 one-time rewards (claim here; the featured-mission reward lets you pick the set piece's slot) and the
// first-S chests (one per mission type per map, 20 in all). Data: sim/weekly.js; the profile: client/rewards.js.
import { withLootLevel } from '../sim/loot.js';
import { weeklyBoard, weeklyState, claimWeekly, claimFreeKey, ONE_TIME, REGION_NAME, TRIAL_NAME, WK, firstSCount } from '../sim/weekly.js';
import { OPS_TYPES, OPS_BIOMES, OPS_TYPE, OPS_BIOME } from '../sim/opsconst.js';
import { WEEKLY } from '../sim/opsmods.js';
import { KEYS } from '../sim/meta.js';
import { SETS, makeSetItem } from '../sim/sets.js';
import { SET_SLOTS, SLOT_LABEL } from '../sim/data/items.js';
import { opsIconUrl } from './opsicons.js';
import { profile } from './rewards.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const WB_CSS = `
.wb { display: flex; flex-direction: column; gap: 10px; font-family: 'Trebuchet MS', sans-serif; }
.wb-top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 13px; color: #e6ddf5; }
.wb-top b { font-family: 'Lilita One', sans-serif; font-weight: normal; color: #ffd23f; font-size: 16px; }
.wb-top .chip { padding: 1px 9px; border-radius: 9px; background: #2b2433; color: #ffe7a0; }
.wb-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.wb-card { position: relative; border: 4px solid #2b2433; border-radius: 14px; padding: 10px 12px; background: rgba(255,255,255,.07); display: flex; flex-direction: column; gap: 6px; box-shadow: 0 4px 0 rgba(0,0,0,.35); }
.wb-card h3 { margin: 0; font: 20px 'Lilita One', sans-serif; color: var(--wc, #ffd23f); text-shadow: 0 2px 0 #2b2433; display: flex; align-items: center; gap: 8px; }
.wb-card h3 img { width: 34px; height: 34px; }
.wb-card .wb-what { font-size: 13px; line-height: 1.35; }
.wb-card .wb-perk { font-size: 12px; color: #bfe9a8; }
.wb-card .wb-goal { font-size: 12.5px; background: rgba(0,0,0,.28); border-radius: 9px; padding: 5px 8px; line-height: 1.35; }
.wb-card .wb-goal b { color: #ffd23f; font-family: 'Lilita One', sans-serif; font-weight: normal; }
.wb-card .btn { font-size: 16px; padding: 5px 10px; }
.wb-card .wb-ok { color: #7dffb0; font-size: 13px; }
.wb-bar { height: 7px; border-radius: 4px; background: rgba(255,255,255,.12); overflow: hidden; } .wb-bar i { display: block; height: 100%; background: #7dffb0; }
.wb-slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; } .wb-slots .btn { font-size: 13px; padding: 3px 2px; }
.wb-fs { border: 4px solid #2b2433; border-radius: 14px; padding: 8px 12px; background: rgba(255,255,255,.05); }
.wb-fs h4 { margin: 0 0 6px; font: 17px 'Lilita One', sans-serif; color: #ffd23f; font-weight: normal; }
.wb-fs table { border-collapse: collapse; width: 100%; font-size: 12.5px; } .wb-fs td, .wb-fs th { text-align: center; padding: 3px 4px; } .wb-fs th { font-weight: normal; color: #cfc6e6; }
.wb-fs td.y { color: #ffd23f; font-family: 'Lilita One', sans-serif; font-size: 16px; } .wb-fs td.n { color: rgba(255,255,255,.3); }
.wb-msg { min-height: 16px; font-size: 13px; color: #7dffb0; }
@media (max-height: 520px) { .wb-cards { gap: 6px; } .wb-card { padding: 6px 8px; gap: 4px; } .wb-card h3 { font-size: 16px; } .wb-card .wb-what { font-size: 11.5px; } .wb-fs { display: none; } }
@media (max-width: 760px) { .wb-cards { grid-template-columns: 1fr; } }
`;
const left = (ms) => { const s = Math.max(0, Math.round(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d ? `${d}d ${h}h` : `${h}h ${m}m`; };
/** the board's HTML (state = { pick: true while choosing the set piece's slot, msg }) */
export function boardHtml(pr, B, st = {}) {
  const S = weeklyState(pr, B), F = B.featured, T = OPS_TYPE[F.type], FB = OPS_BIOME[F.biome];
  const goal = (id) => {
    const o = ONE_TIME.find((x) => x.id === id), done = S.done[id], cl = S.claimed[id];
    const prog = id === 'fissure' ? `<div class="wb-bar"><i style="width:${Math.round(((S.prog.fissure | 0) / WK.fissureNeed) * 100)}%"></i></div>${S.prog.fissure | 0} / ${WK.fissureNeed}` : id === 'swarm' ? `<div class="wb-bar"><i style="width:${Math.round(((S.prog.swarm | 0) / WK.swarmNeed) * 100)}%"></i></div>${S.prog.swarm | 0} / ${WK.swarmNeed}` : '';
    const btn = cl ? '<div class="wb-ok">✔ Claimed</div>' : done ? (id === 'feat' && st.pick ? `<div class="wb-slots">${SET_SLOTS.map((sl) => `<button class="btn small" data-wbslot="${sl}">${esc(SLOT_LABEL[sl] || sl)}</button>`).join('')}</div>` : `<button class="btn" data-wbclaim="${id}">Claim</button>`) : '';
    return `<div class="wb-goal"><b>One-time:</b> ${esc(o.text(B))}<br><span class="wb-perk">Reward: ${esc(o.reward(B))}</span>${prog ? `<br>${prog}` : ''}</div>${btn}`;
  };
  const mods = B.mods.map((k) => `<span class="chip" title="${esc(WEEKLY[k].desc)}">${esc(WEEKLY[k].name)}${WEEKLY[k].bonus ? ` +${Math.round(WEEKLY[k].bonus * 100)}%` : ''}</span>`).join('');
  const fsRows = OPS_BIOMES.map((b) => `<tr><th>${esc(OPS_BIOME[b].name)}</th>${OPS_TYPES.map((t) => (pr.firstS && pr.firstS[`${t}:${b}`] ? '<td class="y">S ✔</td>' : '<td class="n">·</td>')).join('')}</tr>`).join('');
  return `<div class="wb">
    <div class="wb-top"><b>Weekly Board</b><span>New board in ${left(B.ends - Date.now())} (Monday 00:00 UTC)</span><span>This week:</span>${mods}</div>
    <div class="wb-cards">
      <div class="wb-card" style="--wc:${T.col}"><h3><img src="${opsIconUrl(T.icon, T.col, 68)}" alt="">Featured mission</h3>
        <div class="wb-what"><b>${esc(T.name)}</b> · ${esc(FB.name)}</div><div class="wb-perk">Carries this week's twist + boon · grade rewards ×${WK.featMul}</div>${goal('feat')}</div>
      <div class="wb-card" style="--wc:#9cff5a"><h3>⛰ Bonus region</h3>
        <div class="wb-what"><b>${esc(REGION_NAME[B.region])}</b></div><div class="wb-perk">+${Math.round(WK.regionMat * 100)}% materials picked up there · a Swarm event every ~2 minutes</div>${goal('swarm')}</div>
      <div class="wb-card" style="--wc:#c9a2ff"><h3>⚔ Featured Trial</h3>
        <div class="wb-what"><b>${esc(TRIAL_NAME[B.trial])}</b></div><div class="wb-perk">One free ${esc(KEYS[B.trial] ? KEYS[B.trial].name : 'key')} this week</div>
        ${S.key ? '<div class="wb-ok">✔ Free key claimed</div>' : '<button class="btn" data-wbkey="1">Claim free key</button>'}${goal('trial')}${goal('soul')}</div>
    </div>
    <div class="wb-msg" id="wbMsg">${esc(st.msg || '')}</div>
    <div class="wb-fs"><h4>First-S chests · ${firstSCount(pr)} / ${OPS_TYPES.length * OPS_BIOMES.length} <span style="font:12px 'Trebuchet MS',sans-serif;color:#cfc6e6">(your first S per mission type per map: ${WK.firstS.gold} gold, ${WK.firstS.xp} account XP, 3 trophy materials and a Realm Gate key)</span></h4>
      <table><tr><th></th>${OPS_TYPES.map((t) => `<th>${esc(OPS_TYPE[t].name)}</th>`).join('')}</tr>${fsRows}</table></div>
  </div>`;
}
/** wire the board's buttons. ui = { game, rerender(), st } */
export function wireBoard(root, ui) {
  const pr = profile.load(), B = weeklyBoard(Date.now()), st = ui.st;
  const say = (m) => { st.msg = m; ui.rerender(); };
  root.querySelectorAll('[data-wbclaim]').forEach((b) => (b.onclick = () => {
    const id = b.dataset.wbclaim;
    if (id === 'feat') { st.pick = true; return say('Pick the slot of your set piece'); }
    const r = claimWeekly(pr, B, id, KEYS, ui.game.player && ui.game.player.cls); if (!r.ok) return; profile.save(); if (ui.game.audio) ui.game.audio.play('legendary'); say(`Claimed: ${r.text}`);
  }));
  root.querySelectorAll('[data-wbslot]').forEach((b) => (b.onclick = () => {
    const p = ui.game.player; if (!p) return;
    if (!p.inventory.includes(null)) return say('Your bag is full: make room first');
    const r = claimWeekly(pr, B, 'feat'); if (!r.ok) return;
    const it = withLootLevel(p.level, () => makeSetItem({ next: Math.random }, p.cls, b.dataset.wbslot, r.setPiece.set)); // (player-level loot)
    ui.game.command({ type: 'craft', item: it }); profile.save(); st.pick = false;
    if (ui.game.audio) ui.game.audio.play('legendary'); say(`Claimed: ${it.name} (${SETS[r.setPiece.set].name})`);
  }));
  const k = root.querySelector('[data-wbkey]'); if (k) k.onclick = () => { if (claimFreeKey(pr, B)) { profile.save(); say(`+1 ${KEYS[B.trial] ? KEYS[B.trial].name : 'key'}`); } };
}
