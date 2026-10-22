// Rotation notation (2026-10-21): the ONE place the rotations page / playnotes turn route data (sim slots) into key chips.
// Everything shown is derived from the slot keys in rotations.json through the player's live key labels, never from the
// labels baked at optimize time (those were 'G' for skill 4, which is V since 2026-10-09). Pure: no DOM.
//   units are indexed exactly like RotBot.loop: opener units first (played once), then the loop (repeats).
import { spChainOf, mechOf } from './bosscycle.js';
import { KEY_LABEL } from './rotbot.js';

export const SLOT_ACTION = { Q: 'skillQ', E: 'skillE', R: 'skillR', F: 'skillF', SP: 'special', T: 'ult', B1: 'attack', B2: 'attack', B3: 'attack' };
/** default-bind labels (Keybinds defaults: skill 4 = V, Special = F, ult = T) */
export const DEFAULT_LABEL = KEY_LABEL;
export const mkLabel = (kbLabel) => (slot) => { const l = (kbLabel && kbLabel(SLOT_ACTION[slot] || slot)) || DEFAULT_LABEL[slot] || slot; return /^B\d$/.test(slot) ? `${l}${slot === 'B3' ? '×3' : ''}` : l; };

/** @returns {{units:{phase:'opener'|'loop',keys:string[],labels:string[],chain:string|null,chainName:string|null,sp:boolean}[], wrap:number, ult:{key:string,label:string,seq:string[],labels:string[],chainNames:string[],routeName:string,lbl:string}, boss:boolean, win:string|null, spName:string|null, text:{opener:string,loop:string,ult:string}}} */
export function notation(cls, view, rot, label = mkLabel()) {
  const boss = view === 'boss', spc = boss ? spChainOf(cls) : null;
  const unit = (phase) => (u) => ({ phase, keys: [...u.keys], labels: u.keys.map(label), chain: u.chain || null, chainName: u.chainName || null, sp: u.keys.includes('SP') });
  const opener = (rot.opener || []).map(unit('opener')), loop = rot.loop.map(unit('loop'));
  const units = [...opener, ...loop];
  const ult = { key: 'T', label: label('T'), seq: [...rot.ult.seq], labels: rot.ult.seq.map(label), chainNames: rot.ult.chainNames || [], routeName: rot.ult.routeName, lbl: spc ? `Ult after ${spc.name}:` : 'Ult full:' };
  const txt = (us) => us.map((u) => u.labels.join(' ') + (u.chainName ? ` (${u.chainName})` : '')).join(' → ');
  return { units, wrap: opener.length, ult, boss, spName: spc ? spc.name : null, mech: boss ? mechOf(cls) : null,
    text: { opener: txt(opener), loop: txt(loop), ult: ult.labels.join(' ') } };
}
