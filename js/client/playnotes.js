import { BR, BR_CLS, spChainOf } from '../sim/bossrot.js';
// Rotations page, "how it plays" card (skill rework, 2026-10-20): the shared rules every guide must reflect.
const CLS_NOTE = {
  dragoon: 'Exception: Lance Fall (the Jump) still leaps the hero with its i-frames, even vs bosses; every other skill and chain step runs on the shadow.',
  bladedancer: 'Shadow Clone Jutsu clones now flank your shadow, so the echo slashes land where the chain steps do.',
  bard: 'Songs keep playing while you dodge; the shadow finishes the strum.',
};
export function playNotes(cls, C, rot = null) {
  const li = [
    '<b>1 s global cooldown.</b> Every skill press, chain steps included, waits on the 1 s GCD. Ult-window chains are off the GCD.',
    '<b>Basic attacks never break a chain.</b> Swing between steps freely.',
    '<b>The chain timer pauses while you move or dodge.</b> Reposition without losing the chain.',
    '<b>Boss form (near bosses and in trials).</b> Dashes, leaps and long animations play on your violet shadow, and the hit lands from there. Your hero stays free to walk and dodge, and is never locked more than 0.3 s. Move or dodge to cancel any longer animation; its damage still finishes on the shadow.',
    '<b>No mobility key.</b> Dodge is your only movement skill.',
  ];
  if (CLS_NOTE[cls]) li.push(CLS_NOTE[cls]);
  const B = BR_CLS[cls], spc = spChainOf(cls);
  if (B && spc) li.push(`<b>Boss cycle (~20 s).</b> Near a boss every chain finisher banks <b>${B.unit}</b> (longer chains bank more, and banking fills the ult meter, so the opener fills your first ult). <b>${spc.name}</b> is the hinge: the Special releases the bank in waves, its finisher releases the rest and opens <b>${B.win}</b> (6 s, chains bank ×2). Cast the ultimate inside ${B.win}: when it ends the whole bank releases ×${BR.ultMul}.${B.hold ? ` With the ult ready, ${spc.name} banks instead of releasing, so the ultimate releases it all.` : ''} One ultimate per cycle.`);
  if (rot && rot.loop) { // the measured best route under these rules (tools/rotations/optimize.mjs)
    const u = (x) => x.labels.join(' ') + (x.chainName ? ' (' + x.chainName + ')' : '');
    li.push('<b>Best boss route:</b> ' + (rot.opener && rot.opener.length ? 'open with ' + rot.opener.map(u).join(', ') + ', then ' : '') + 'loop ' + rot.loop.map(u).join(' → ') + ', basics between every press; ' + (B ? `${spc.name} as soon as it is up, the ult inside ${B.win}` : 'ult when full') + ' → ' + rot.ult.labels.join(' ') + ' (' + rot.ult.routeName + ').');
  }
  return '<ul class="sb-play">' + li.map((x) => '<li>' + x + '</li>').join('') + '</ul>';
}
