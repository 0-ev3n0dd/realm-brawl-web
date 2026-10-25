// Gear expansion (step 3) tooltip pieces, shared by the desktop (client/ui.js) and mobile (client/mui.js) UIs and the
// hub's Character tab: main stat + sub-stat lines, the set block (pieces worn / 4, the 2- and 4-piece bonuses, lit when
// live) and the compare-to-equipped block (stat by stat, against the piece equipping would replace).
import { AFFIXES, STAT_LABELS, SLOT_LABEL, EQUIP_SLOTS, RARITIES } from '../sim/data/items.js';
import { itemPower, mainKeys, itemLevel, itemQuality, statQuality, itemLv } from '../sim/loot.js';
import { upStats } from '../sim/meta.js';
import { SETS, setOf, setDef, setBonuses, SET_RULE } from '../sim/sets.js';
import { EXOTIC } from '../sim/exotic.js';
import { compareTarget, equipTarget } from '../sim/gear.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const statLabel = (k) => STAT_LABELS[k] || (AFFIXES[k] && AFFIXES[k].label) || k;
/** "+12", "+3.4%", "+1.2/s" */
export function fmtStat(k, v, sign = true) {
  const a = AFFIXES[k], s = sign ? (v >= 0 ? '+' : '−') : '', x = Math.abs(v);
  if (a && a.fmt === 'pct') return `${s}${(x * 100).toFixed(x < 0.1 ? 1 : 1)}%`;
  if (a && a.fmt === 'dec') return `${s}${x.toFixed(1)}/s`;
  return `${s}${Math.round(x)}`;
}
export const slotLabel = (it) => (it.slot === 'armor' ? 'Chest' : SLOT_LABEL[it.slot] || it.slot);
/** the Item Level header: iLvl, drop level, overall roll quality bar (item level pass, sim/loot.js itemLevel) */
export function ilvlBlock(item) {
  if (!item || item.slot === 'sigil') return '';
  const il = itemLevel(item), q = itemQuality(item), pc = Math.round(q * 100), col = q >= 0.9 ? '#ffb52e' : q >= 0.7 ? '#5dff7a' : q >= 0.4 ? '#9fb4d8' : '#ff8a7a';
  return `<div class="tt-ilvl" style="display:flex;align-items:center;gap:8px;margin:3px 0 5px"><b style="font-family:'Lilita One',sans-serif;font-size:17px;color:#ffd23f;letter-spacing:.3px">iLvl ${il}</b>`
    + `<span style="font-size:11px;opacity:.8">Lv ${itemLv(item)}${item.lv ? ' drop' : ''}</span>`
    + `<span style="flex:1;min-width:50px;height:6px;border-radius:3px;background:#2a2f3d;overflow:hidden" title="roll quality: ${pc}% of the best possible rolls"><i style="display:block;height:100%;width:${pc}%;background:${col}"></i></span>`
    + `<span style="font-size:11px;color:${col}">${pc}% rolls</span></div>`;
}
/** the main stat line(s) + the sub-stat lines (HTML) */
export function statLines(item) {
  const us = upStats(item), mk = mainKeys(item), sq = statQuality(item);
  const qc = (q) => (q >= 0.9 ? '#ffb52e' : q >= 0.7 ? '#5dff7a' : q >= 0.4 ? '#cfd6e4' : '#ff8a7a');
  const line = (k, main) => `<div class="tt-st${main ? ' main' : ''}">${main ? '<i class="tt-mk">◆</i>' : '<i class="tt-sk">·</i>'}${fmtStat(k, us[k])} ${statLabel(k)}${us[k] !== item.stats[k] ? ` <span style="color:#ffd23f">(+${item.up})</span>` : ''}${k in sq ? ` <span class="tt-q" title="roll: ${Math.round(sq[k] * 100)}% of the best possible for this level and rarity" style="float:right;margin-left:8px;font-size:11px;color:${qc(sq[k])}">${Math.round(sq[k] * 100)}%</span>` : ''}</div>`;
  const subs = Object.keys(item.stats).filter((k) => !mk.includes(k));
  return ilvlBlock(item) + mk.filter((k) => k in item.stats).map((k) => line(k, true)).join('') + (subs.length ? `<div class="tt-subs">${subs.map((k) => line(k, false)).join('')}</div>` : '');
}
/** the set block: name (n/4), (2) and (4) bonus lines lit when live; a Trial / Extreme family adds its own proc (gearfx.js) */
export function setBlock(item, p) {
  const id = setOf(item); if (!id) return '';
  const S = setDef(id), F = EXOTIC[id], name = SETS[id] ? SETS[id].name : `${F.prefix} (${F.rarity === 7 ? 'Extreme' : 'Trial'} set)`, color = SETS[id] ? SETS[id].color : F.color;
  const B = p ? setBonuses(p) : { counts: {}, two: [], four: null }, n = B.counts[id] || 0;
  const live2 = B.two.includes(id), live4 = B.four === id;
  const st = (on) => (on ? `color:${color}` : 'color:rgba(255,255,255,.45)');
  const why2 = n >= 2 && !live2 ? ` <i style="opacity:.75">(only ${SET_RULE.twoMax} two-piece bonuses at once)</i>` : '';
  const why4 = n >= 4 && !live4 ? ` <i style="opacity:.75">(one four-piece bonus at a time)</i>` : '';
  const pips = Array.from({ length: 4 }, (_, i) => `<i class="tt-pip${i < n ? ' on' : ''}" style="--sc:${color}"></i>`).join('');
  return `<div class="tt-set" style="color:${color}"><b>${esc(name)}</b> <span class="tt-pips">${pips}</span> <span style="opacity:.8">${Math.min(n, 9)}/4</span></div>`
    + `<div style="${st(live2)}">(2) ${S.twoText}${why2}</div>`
    + `<div style="${st(live4)}">(4) ${S.fourText}${why4}</div>`;
}
/** compare against the equipped piece this would replace: power delta + stat-by-stat deltas */
export function compareBlock(item, p) {
  if (!p || !item || item.slot === 'sigil') return '';
  if (item.cls && item.cls !== p.cls) return `<div class="cmp" style="color:#ff7a7a">Wrong class</div>`;
  const cur = compareTarget(p, item), key = equipTarget(p, item), lbl = SLOT_LABEL[key] || key;
  const d = itemPower(item) - itemPower(cur);
  const di = itemLevel(item) - (cur ? itemLevel(cur) : 0);
  let h = `<div class="cmp" style="color:${d >= 0 ? '#5dff7a' : '#ff7a7a'}">Power ${itemPower(item)} <b>(${d >= 0 ? '+' : ''}${d})</b> · iLvl ${itemLevel(item)}${cur ? ` <b>(${di >= 0 ? '+' : ''}${di})</b>` : ''} vs ${cur ? 'equipped ' + esc(lbl) : 'empty ' + esc(lbl)}</div>`;
  if (!cur) return h;
  const a = upStats(item), b = upStats(cur), ks = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  const rows = ks.map((k) => [k, (a[k] || 0) - (b[k] || 0)]).filter(([, v]) => Math.abs(v) > 1e-6);
  if (rows.length) h += `<div class="tt-cmp">${rows.map(([k, v]) => `<span style="color:${v > 0 ? '#5dff7a' : '#ff7a7a'}">${fmtStat(k, v)} ${statLabel(k)}</span>`).join('')}</div>`;
  const sNew = setOf(item), sOld = setOf(cur);
  if (sNew !== sOld) h += `<div class="tt-cmp" style="opacity:.8">${sOld ? `−1 ${esc(setName(sOld))} piece` : ''}${sOld && sNew ? ' · ' : ''}${sNew ? `+1 ${esc(setName(sNew))} piece` : ''}</div>`;
  return h;
}
export const setName = (id) => (SETS[id] ? SETS[id].short : EXOTIC[id] ? EXOTIC[id].prefix : id);
/** the hub's Set Bonuses panel: every set you wear 2+ pieces of, live bonuses lit (HTML) */
export function setPanel(p) {
  const B = setBonuses(p), ids = Object.keys(B.counts).sort((a, b) => B.counts[b] - B.counts[a]);
  if (!ids.length) return `<div class="hs-none">No set pieces worn. Wear 2 pieces of a set for its bonus, 4 for its mechanic.</div>`;
  return ids.map((id) => {
    const S = setDef(id), n = B.counts[id], col = SETS[id] ? SETS[id].color : EXOTIC[id].color;
    const l2 = B.two.includes(id), l4 = B.four === id;
    return `<div class="hs-set${l2 || l4 ? ' on' : ''}" style="--sc:${col}"><div class="hs-hd"><b>${esc(setName(id))}</b><span class="tt-pips">${Array.from({ length: 4 }, (_, i) => `<i class="tt-pip${i < n ? ' on' : ''}" style="--sc:${col}"></i>`).join('')}</span><span>${n}/4</span></div>`
      + `<div class="hs-b${l2 ? ' on' : ''}">(2) ${S.twoText}</div><div class="hs-b${l4 ? ' on' : ''}">(4) ${S.fourText}</div></div>`;
  }).join('') + `<div class="hs-rule">Up to ${SET_RULE.twoMax} two-piece bonuses and one four-piece bonus are live at once (most pieces first).</div>`;
}
/** a short slot + rarity line ("Epic Gloves · Tier 4") */
export const itemSubLine = (it, clsName) => `${(RARITIES[it.rarity] || RARITIES[0]).name} ${slotLabel(it)}${it.cls && clsName ? ' · ' + clsName : ''} · Tier ${it.tier}${it.slot !== 'sigil' ? ' · iLvl ' + itemLevel(it) : ''}`;
export { EQUIP_SLOTS };
