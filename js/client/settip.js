// Tooltip extras for the exclusive tiers (shared by the desktop and mobile UIs):
//   Set items (rarity 4): the set name in its colour, the 2- and 3-piece bonuses (lit when active), your class's glyph twist.
//   Trial Sigil (rarity 5): a key item. Not gear; the Trial itself arrives in Phase 2.
import { SETS, GLYPH_TWIST, setBonuses } from '../sim/sets.js';
import { setBlock, slotLabel } from './geartip.js';
import { BAG_TITLES } from '../sim/data/items.js';
import { exoticSub, exoticExtra } from './gearfx.js';

export const bagTitle = (r) => BAG_TITLES[r] || BAG_TITLES[0];
/** Header sub-line ("Set ring · Tier 5", "Key item"). */
export function tipSub(item, R, clsName) {
  if (item.slot === 'sigil') return `${R.name} · Key item`;
  if (item.ex) return exoticSub(item, clsName);
  if (item.set) return `${(SETS[item.set] || {}).short || 'Set'} Set ${slotLabel(item)}${clsName && item.cls ? ' · ' + clsName : ''} · Tier ${item.tier}`;
  return null;
}
/** Extra HTML lines below the stats. */
export function tipExtra(item, p) {
  if (item.slot === 'sigil') {
    return `<div style="color:#ffb3c6;margin-top:4px">An old seal of <b>Neferakh Unbound</b>, the King's Trial (now open at the Mission Counter: Tomb clears give Sunseal Keys).</div>`
      + `<div style="color:#ffd86a;font-weight:bold;margin-top:4px">Salvage it at the Forge: 6 Sun-Eaten Linen + 1 Solar Ember + 200 gold</div>`
      + `<div style="opacity:.7">Not equippable</div>`;
  }
  if (item.ex) return exoticExtra(item, p);
  const S = item.set && SETS[item.set];
  if (!S) return '';
  const live4 = p && setBonuses(p).four === item.set;
  const twist = p && item.set === 'sunscorch' && GLYPH_TWIST[p.cls];
  const tierLine = `<div style="opacity:.6;font-size:11px">Set tier · above Legendary, below Trial</div>`;
  return setBlock(item, p)
    + (twist ? `<div style="${live4 ? `color:${S.color}` : 'color:rgba(255,255,255,.45)'};font-style:italic">${twist}</div>` : '')
    + `<div style="opacity:.65;margin-top:2px">${S.source || ''}</div>` + tierLine;
}

// Death screen: where you'll get back up (the Dunes oasis, the Tomb chamber entrance, or the Wilds' campfire)
import { inDunesArea, inTombArea } from '../sim/dunesconst.js';
import { inFrostArea, inCryptArea } from '../sim/frostconst.js';
import { inHollowArea, inTorArea } from '../sim/glowconst.js';
import { inEmberArea, inForgeArea } from '../sim/emberconst.js';
import { inRiftArea } from '../sim/riftconst.js';
export const respawnWhere = (p) => (inTombArea(p.x, p.y) ? 'at the chamber entrance' : p.y > 29000 && (inHollowArea(p.x, p.y) || inTorArea(p.x, p.y)) ? 'at the grotto entrance' : inCryptArea(p.x, p.y) ? 'at the vault entrance' : inForgeArea(p.x, p.y) ? 'at the hall entrance' : inRiftArea(p.x, p.y) ? 'at Starfall Camp' : inEmberArea(p.x, p.y) ? 'at Cinderwatch Outpost' : inFrostArea(p.x, p.y) ? 'at Hearthstone Camp' : inDunesArea(p.x, p.y) ? 'at the Oasis of Ra' : 'at Haven Meadow');
