// Part B: the Ascension Altar panel (opened from the Altar station in the village, client/village.js). Shows the
// current hero's pieces + materials, the 3-for-1 exchange, and starts the Shadow Duel (sim/shadowduel.js). The cost is
// only paid when the duel is WON (client/rewards.js 'duel' won -> sim/ascension.js ascend): a loss costs nothing.
import { startAltarCine, preloadSong } from './duelcine.js';
import { ASC, PIECES, PIECE_NAME, ascOf, ascBlockers, ascMissing, ascExchange, ascSurplusCount, rankOf, ascendedCount, rankCost } from '../sim/ascension.js';
import { ASC_RANK, RANK_MAX } from '../sim/ascended.js';
import { ASC_ALT } from '../sim/ascalt.js';
import { normChainSet } from '../sim/loadout.js';
import { MATERIALS, ascAccount, ASC_ACCOUNT, ASC_MILESTONES, ascMilestone, ASC_HIDDEN, ascHiddenOpen } from '../sim/meta.js';
import { CLASSES } from '../sim/data/classes.js';
import { heroOf, HERO_IDS } from '../sim/heroes.js';
import { profile } from './rewards.js';
import { ULT_TITLE, fmtUlt } from '../sim/ultreward.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** the Altar opens at Lv 50 once the Rift Sanctum (Vorthax) has been cleared (unlock flag vtx) */
export const altarOpen = (p) => !!p && (p.level | 0) >= ASC.level && !!(p.unlocks && p.unlocks.vtx);
/** Part D: the account's Ascension card (the Progress > Account tab + under the Altar): every hero's rank, the account
 *  perks they add up to (capped, sim/meta.js ASC_ACCOUNT) and the 3 / 10 milestones */
export function ascAccountCard(pr) {
  const n = ascendedCount(pr), B = ascAccount(n), pc = (v) => `+${(v * 100).toFixed(1).replace(/\.0$/, '')}%`;
  const chips = HERO_IDS.map((c) => { const r = rankOf(pr, c), H = heroOf(c); return `<span class="asc-chip${r ? ' on' : ''}${r >= RANK_MAX ? ' max' : ''}" style="--ac:${(CLASSES[c] || {}).color || '#c9b6ff'}" title="${esc(H.name)} · ${esc((CLASSES[c] || {}).name || c)}"><i>${esc((CLASSES[c] || {}).name || c)}</i><b>${r ? 'A' + r : '–'}</b></span>`; }).join('');
  const miles = ASC_MILESTONES.map((m) => `<div class="mile${n >= m.n ? ' got' : ''}"><span class="lv">${m.n} ✦</span><b>${esc(m.name)}</b><small>${esc(m.text)}</small></div>`).join('');
  const hidden = `<div class="mile${ascHiddenOpen(n) ? ' got' : ''}"><span class="lv">10 ✦</span><b>${ascHiddenOpen(n) ? esc(ASC_HIDDEN.name) : '???'}</b><small>${ascHiddenOpen(n) ? 'A hidden fight waits past the Rim (arrives in a later update)' : 'Ascend every hero.'}</small></div>`;
  return `<div class="asc-acct"><h3>Ascension · ${n} / ${HERO_IDS.length} heroes Ascended</h3><div class="asc-chips">${chips}</div>
    <div class="asc-perks"><span>Every hero: <b>${pc(B.atk)}</b> Attack</span><span><b>${pc(B.hp)}</b> Max HP</span><span><b>${pc(B.gold)}</b> gold</span><small class="dim">${pc(ASC_ACCOUNT.atk)} Attack, ${pc(ASC_ACCOUNT.hp)} Max HP, ${pc(ASC_ACCOUNT.gold)} gold per Ascended hero (max ${ASC_ACCOUNT.max})</small></div>
    <div class="pg-miles asc-miles">${miles}${hidden}</div>${ultRecord(pr)}</div>`;
}
/** Part F3: the Ultimate's clear record (prestige only) */
export function ultRecord(pr) {
  const R = pr && pr.ult;
  if (!R || !(R.n > 0)) return `<div class="asc-ult"><b>The Ultimate · The Unwritten</b> <small class="dim">not cleared yet · clear it for the title “${esc(ULT_TITLE)}”, the Unwritten Pages aura, Quillfire and the Unwritten Regalia (prestige only)</small></div>`;
  return `<div class="asc-ult got"><b>✧ ${esc(ULT_TITLE)}</b> <span>The Ultimate cleared ${R.n}× · best ${fmtUlt(R.t)} · ${R.att} attempt${R.att === 1 ? '' : 's'} · party of ${R.ps || 1}</span></div>`;
}
export function altarPanel(g) { const h = altarPanel0(g); return g.player && altarOpen(g.player) ? h + ascAccountCard(profile.load()) : h; }
function altarPanel0(g) {
  const p = g.player, pr = profile.load(); if (!p) return '';
  const H = heroOf(p.cls), col = (CLASSES[p.cls] || {}).color || '#c9b6ff', a = ascOf(pr, p.cls);
  if (!altarOpen(p)) return `<div class="asc-lock"><b>The Altar is dormant.</b><p>It wakes for a Lv ${ASC.level} hero who has cleared the Rift Sanctum (Vorthax).</p><p class="dim">You: Lv ${p.level | 0} · Rift Sanctum ${p.unlocks && p.unlocks.vtx ? 'cleared ✔' : 'not cleared'}</p></div>`;
  const R = rankOf(pr, p.cls), nx = R + 1;
  const ladder = `<div class="asc-ranks">${[1, 2, 3, 4, 5].map((k) => `<div class="asc-rk${k <= R ? ' got' : k === nx ? ' next' : ''}" title="${esc(ASC_RANK[k].text)}"><b>A${k}</b><small>${esc(ASC_RANK[k].name)}</small></div>`).join('')}</div>`;
  const AL = ASC_ALT[p.cls], base = AL && (CLASSES[p.cls].skills[AL.key] || {}), on = !!(p.chainSet && p.chainSet.alt === 1);
  const alt = AL ? `<div class="asc-alt${R >= 3 ? '' : ' locked'}"><div><b>✦ ${esc(AL.name)}</b> <small>Astral variant of ${esc(base.name || AL.key)} [${AL.key}]${R >= 3 ? '' : ' · unlocks at A3'}</small><p>${esc(AL.desc)}</p></div>${R >= 3 ? `<button class="btn small" id="ascAlt">${on ? 'Variant ON' : 'Variant OFF'}</button>` : ''}</div>` : '';
  if (R >= RANK_MAX) return `<div class="asc-done" style="--ac:${col}"><h3>✦ ${esc(H.name)} is Starborn (A${RANK_MAX})</h3>${ladder}${alt}<p>Every rank is yours: the Ascended ultimate, both Astral Boosts, the Astral skill variant and the Starborn look.</p><p class="dim">Ascended heroes on this account: ${ascendedCount(pr)} / 10</p></div>`;
  const C = rankCost(nx), miss = ascMissing(pr, p.cls), why = ascBlockers(pr, p.cls, p.level), sur = ascSurplusCount(pr);
  const piece = (k) => C[k] ? `<div class="asc-piece${a[k] >= C[k] ? ' ok' : ''}"><b>${esc(PIECE_NAME[k])}</b><span>${a[k]} / ${C[k]}</span>${miss[k] > 0 ? `<button class="btn small" data-ascx="${k}" ${sur >= ASC.exchange ? '' : 'disabled'} title="Trade ${ASC.exchange} surplus pieces (any hero) for this one">Exchange ${ASC.exchange}→1</button>` : ''}</div>` : '';
  const mat = (id, n) => { const M = MATERIALS[id], have = (pr.mats && pr.mats[id]) | 0; return `<span class="mat-chip${have >= n ? '' : ' short'}" style="--mc:${M.color}"><i></i>${esc(M.name)} <b>${have}/${n}</b></span>`; };
  const harder = nx >= 5 ? 'Mirror Arts, the Shadow Split at 50% and the Eclipse of Self at 25%' : nx >= 4 ? 'Mirror Arts (incl. Memory) and the Shadow Split at 50%: break its shards' : nx >= 3 ? 'Mirror Arts incl. Mirror Memory (numbered stars)' : nx >= 2 ? 'Mirror Arts: told mechanic-pool attacks between its kit skills' : '';
  return `<div class="asc-panel" style="--ac:${col}">
    <h3>${nx === 1 ? `Ascend ${esc(H.name)}` : `${esc(H.name)}: A${R} → A${nx}`}</h3>
    ${ladder}
    <p class="asc-next"><b>A${nx} ${esc(ASC_RANK[nx].name)}:</b> ${esc(ASC_RANK[nx].text)}</p>
    ${R >= 1 ? alt : ''}
    <div class="asc-pieces">${PIECES.map(piece).join('')}</div>
    <div class="asc-mats">${Object.entries(C.mats).map(([id, n]) => mat(id, n)).join('')} <span class="gold">${(pr.gold | 0).toLocaleString()} / ${C.gold.toLocaleString()} gold</span></div>
    <p class="dim">Surplus pieces for the exchange: ${sur} · drops favour the hero you play (${Math.round(ASC.weight * 100)}%); Cores from Vorthax, Bodies from Astrael, Souls from Astrael Savage + the Weekly Board, any piece from Astral dungeon bosses.</p>
    ${why.length ? `<div class="asc-why">Still needed: ${why.map(esc).join(' · ')}</div>` : ''}
    <button class="btn big asc-go" id="ascDuel" ${why.length ? 'disabled' : ''}>${nx === 1 ? 'Face your Shadow' : `Face your Shadow (A${nx})`}</button>
    <p class="dim">A solo duel against a corrupted mirror that casts your own kit${harder ? `, now with ${harder}` : ''}. Win to reach A${nx} (the cost is paid then); lose and nothing is taken.</p></div>`;
}
export function wireAltar(root, ui) {
  const g = ui.g, p = g.player, pr = profile.load();
  root.querySelectorAll('[data-ascx]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); if (ascExchange(pr, p.cls, b.dataset.ascx)) { profile.save(); ui.say(`Exchanged for 1 ${PIECE_NAME[b.dataset.ascx]}.`, 'ok'); } }));
  const av = root.querySelector('#ascAlt'); // (Part D A3: swap the Astral variant in / out; saved with the hero + the active loadout)
  if (av) av.onclick = (e) => { e.stopPropagation(); const cur = normChainSet(p.chainSet, p.cls), next = { ...cur }; if (cur.alt === 1) delete next.alt; else next.alt = 1;
    g.command({ type: 'chainSet', pins: next.pins, focus: next.focus, ...(next.alt === 1 ? { alt: 1 } : {}) }); p.chainSet = normChainSet(next, p.cls); ui.say(next.alt === 1 ? `${ASC_ALT[p.cls].name} is on your ${ASC_ALT[p.cls].key} key.` : 'Your base skill is back.', 'ok'); if (ui.render) ui.render(); };
  const go = root.querySelector('#ascDuel');
  if (go && !go.disabled) preloadSong(g.audio); // (B4: fetch + decode the duel song while the panel is open)
  if (go) go.onclick = (e) => { e.stopPropagation(); if (ascBlockers(pr, p.cls, p.level).length) return; ui.close(); if (g.audio) g.audio.play('legendary'); if (!startAltarCine(g, () => g.command({ type: 'duel' }))) g.command({ type: 'duel' }); }; // (B3: the Altar's activation cinematic, then the duel)
}
