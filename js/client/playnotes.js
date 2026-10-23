import { spChainOf, mechOf, spCdOf } from '../rotations/bosscycle.js';
import { notation, mkLabel } from '../rotations/notation.js';
// Rotations page, "how it plays" card (skill rework, 2026-10-20): the shared rules every guide must reflect.
const CLS_NOTE = {
  dragoon: 'Exception: Lance Fall (the Jump) still leaps the hero with its i-frames, even vs bosses; every other skill and chain step runs on the shadow.',
  bladedancer: 'Shadow Clone Jutsu clones now flank your shadow, so the echo slashes land where the chain steps do.',
  bard: 'Songs keep playing while you dodge; the shadow finishes the strum.',
  samurai: '<b>Void Sheath Mark (bosses).</b> Void Sheath marks the boss for 10 s. During Blade of the Void your hits leave 2× the Delayed Cuts and Sheathes HOLD the cuts built in the window instead of bursting them. One Perfect Cut inside the mark counts every cut twice. Cast the Special and the ult on cooldown: holding either loses damage.',
};
export function playNotes(cls, C, rot = null, label = mkLabel()) {
  const li = [
    '<b>1 s global cooldown.</b> Every skill press, chain steps included, waits on the 1 s GCD. Ult-window chains are off the GCD.',
    '<b>Basic attacks never break a chain.</b> Swing between steps freely.',
    '<b>The chain timer pauses while you move or dodge.</b> Reposition without losing the chain.',
    '<b>Boss form (near bosses and in trials).</b> Dashes, leaps and long animations play on your violet shadow, and the hit lands from there. Your hero stays free to walk and dodge, and is never locked more than 0.3 s. Move or dodge to cancel any longer animation; its damage still finishes on the shadow.',
    '<b>No mobility key.</b> Dodge is your only movement skill.',
  ];
  if (CLS_NOTE[cls]) li.push(CLS_NOTE[cls]);
  const spc = spChainOf(cls), mech = mechOf(cls);
  if (spc) li.push(`<b>Boss cycle.</b> ${spc.name} is the hinge: press it as soon as the Special is off cooldown (${spCdOf(cls)} s), ${rot && rot.ultWhenFull ? 'and cast the ultimate the moment the meter is full' : 'and cast the ultimate right after it, one per cycle'}. Your chains build ${mech} as usual between Specials.`);
  if (rot && rot.loop) { // the measured best route under these rules (tools/rotations/optimize.mjs)
    const N = notation(cls, 'boss', rot, label);
    li.push('<b>Best boss route:</b> ' + (N.wrap ? 'open with ' + N.text.opener + ', then ' : '') + 'loop ' + N.text.loop + ', basics between every press; ' + (spc ? `${spc.name} (${label('SP')}) as soon as it is up, the ult (${N.ult.label}) ${rot.ultWhenFull ? 'the moment the meter is full' : 'right after it'}` : `ult (${N.ult.label}) when full`) + ' → ' + N.text.ult + ' (' + rot.ult.routeName + ').');
  }
  return '<ul class="sb-play">' + li.map((x) => '<li>' + x + '</li>').join('') + '</ul>';
}
