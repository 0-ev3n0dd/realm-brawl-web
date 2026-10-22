// Skill sustain: skills are the main way to fight, basic attacks are the fallback when a rotation breaks.
//  * Chain refunds: when a chain's finisher LANDS, part of the whole chain's cost comes back (2-step 40%, 3-step+ 50%). A free
//    finisher refunds the share of the steps you paid for. Warrior skills are free (Rage is built, not spent): a landed chain
//    gives +12 Rage instead. Blade Dancer: no chain refund - its crits refund pips (combat.js) and landed chains build Edge.
//  * Class mechanic refunds (capped per 40-tick burst): Warrior +Rage per Sundered enemy hit, Ranger +Energy per
//    Quarried enemy hit, Mage +Mana per Burn stack consumed, Cleric +Holy Charge per Condemned enemy hit and per Condemn
//    stack consumed.
//  * Cooldown flow: a landed chain cuts the remaining cooldown of every skill that opens one of your chains (except the
//    finisher itself): 2-step 40%, 3-step+ 65%, at least 0.5 s.
//  * Basic attacks: x0.9 damage but more resource per hit (see `resOnBasic` in classes.js).
// No true infinite loop: a chain never refunds more than half of what it cost, mechanic refunds are capped per 40-tick burst, and
// cooldown cuts only shorten what is left (every skill still pays its cost). Nothing is refunded during the ult window /
// Eclipse / Divine Ascension (skills are free there; cooldown cuts still apply) or in a predicting client sim (the server's res is synced).
import { CLASSES } from './data/classes.js';

export const SUSTAIN = {
  refund: [0, 0, 0.4, 0.5],           // share of the whole chain's cost, by chain length (4+ = the 3-step share)
  cdCut: [0, 0, 0.4, 0.65],           // share of the remaining cooldown removed from your next chains' openers
  pipMul: 1,                          // Blade Dancer: chains refund their plain share (it used to be x2: crits now refund pips too, see combat.js critRefund)
  cdCutMin: 30,                       // ticks (0.5 s)
  basicDmg: 0.82,                     // basic attacks deal a little less
  window: 40,                         // mechanic-refund caps count per 40-tick burst
  mech: {
    ranger: { on: 'quarry', per: 6, cap: 36, label: 'Energy per Quarried enemy hit' },
    mage: { consume: 'burn', per: 5, cap: 25, label: 'Mana per Burn stack consumed' },
    cleric: { on: 'condemn', per: 4, cap: 16, consume: 'condemn', perC: 4, capC: 24, label: 'Holy Charge per Condemned enemy hit, +4 per Condemn stack consumed' },
  },
};
const lenOf = (a, n) => a[Math.min(n, a.length - 1)];
const noSustain = (sim, p) => sim.predicting || p.uw || p.eclipse || p.aura > 0;
/** Mechanic refunds are capped per burst: a 40-tick window that starts with the first refund (one skill's worth). */
const win = (sim, p) => { if (!p.sus || sim.tick - p.sus.t0 > SUSTAIN.window) p.sus = { t0: sim.tick, susHit: 0, susCon: 0 }; return p.sus; };
const give = (p, n) => { const before = p.res; p.res = Math.min(p.stats.maxRes, p.res + n); p.susGot = (p.susGot || 0) + (p.res - before); return p.res - before; };

/** The keys that open one of the class's chains (history chains + the Counter-state chains' opener). */
const OPENERS = {};
export function openersOf(cls) {
  if (OPENERS[cls]) return OPENERS[cls];
  const c = CLASSES[cls], s = new Set();
  for (const ch of c.chains) { if (ch.sp) continue; // (Special chains don't make their first key an opener; the Special's own cooldown is never cut)
    const k = ch.seq[0] === 'F+' ? 'F' : ch.seq[0]; if (c.skills[k]) s.add(k); }
  return (OPENERS[cls] = [...s]);
}

/** What the whole chain cost: the earlier steps at their listed skill cost (a Counter = Counter Guard's cost, basic swings
 *  and Backstabs = 0) plus what the finisher actually cost. */
export function chainCost(cls, ch, paid) {
  const c = CLASSES[cls];
  let t = paid;
  for (const k of ch.seq.slice(0, -1)) { const sk = c.skills[k === 'F+' ? 'F' : k]; if (sk) t += sk.cost; }
  return t;
}

/** A chain's finisher landed (combat.js, when its first non-basic hit connects). pend = p.chainPending. */
export function chainLanded(sim, p, pend) {
  if (!pend || sim.predicting) return null;
  const inUlt = noSustain(sim, p); // ult windows: skills are free already, so no refund - but the cooldown cuts still apply
  const ch = CLASSES[p.cls].chains.find((c) => c.id === pend.id);
  if (!ch) return null;
  const n = ch.seq.length;
  const C = CLASSES[p.cls];
  let refund = inUlt ? 0 : give(p, chainCost(p.cls, ch, pend.cost || 0) * lenOf(SUSTAIN.refund, n) * (C.pips ? SUSTAIN.pipMul : 1)); // (a free finisher: the share of the steps you paid for)
  if (C.rageRes && !ch.rage && !(p.rage > 0)) refund += give(p, C.rageRules.chain * (1 + (p.stats.rageGain || 0))); // Warrior: finishing a chain builds Rage (Rage chains spend it instead)
  if (C.edge) { const E = C.edge, before = p.edge || 0; p.edge = Math.min(E.max, before + E.chain); p.edgeT = sim.tick; if (p.edge !== before) sim.emit({ type: 'edge', pid: p.id, n: p.edge, x: Math.round(p.x), y: Math.round(p.y - 50), max: p.edge >= E.max && before < E.max ? 1 : undefined }); } // Blade Dancer: landed chains build Edge
  const cut = {};
  if (!CLASSES[p.cls].pips && !C.strings) for (const k of openersOf(p.cls)) { // (Warrior strings: rolling cooldowns at the string end instead, warrior.js endString)
    if (k === pend.key || !(p.cds[k] > 0)) continue;
    if (C.strings && ch.seq.includes(k)) continue; // Warrior strings: the keys of the string just played start fresh (no self-cut)
    const d = Math.min(p.cds[k], Math.max(SUSTAIN.cdCutMin, Math.round(p.cds[k] * lenOf(SUSTAIN.cdCut, n))));
    p.cds[k] -= d; cut[k] = d;
  }
  if (refund > 0 || Object.keys(cut).length) sim.emit({ type: 'sustain', pid: p.id, chain: ch.id, refund: Math.round(refund * 10) / 10, cut, x: Math.round(p.x), y: Math.round(p.y - 58) });
  return { refund, cut };
}

/** A skill hit landed on e (combat.js): the class-mechanic refund (Sundered / Quarried / Condemned enemies). */
export function sustainHit(sim, p, e, o, stacked) {
  const M = SUSTAIN.mech[p.cls];
  if (!M || !M.on || !stacked || o.basic || o.ult || o.clone || o.dot || noSustain(sim, p)) return 0;
  const d = win(sim, p);
  const room = M.cap - (d.susHit || 0);
  if (room <= 0) return 0;
  const g = give(p, Math.min(M.per, room));
  d.susHit = (d.susHit || 0) + Math.min(M.per, room);
  return g;
}

/** Stacks of `kind` were consumed (kit.js takeStacks): Mage Burn -> mana, Cleric Condemn -> Holy Charge. Capped per burst. */
export function sustainConsume(sim, p, kind, n) {
  const M = SUSTAIN.mech[p.cls];
  if (!M || M.consume !== kind || !n || noSustain(sim, p)) return 0;
  const per = M.perC ?? M.per, cap = M.capC ?? M.cap;
  const d = win(sim, p);
  const room = cap - (d.susCon || 0);
  if (room <= 0) return 0;
  const want = Math.min(per * n, room);
  d.susCon = (d.susCon || 0) + want;
  return give(p, want);
}

const P = (v) => Math.round(v * 100);
/** Short note for one chain (tooltips): what landing it gives back. */
export function sustainNote(cls, ch) {
  const c = CLASSES[cls], n = ch.seq.length, r = lenOf(SUSTAIN.refund, n);
  if (ch.route || !r) return '';
  if (c.focusRes) return `Skills are free (cooldowns only). Landing it cuts your other chain openers' cooldowns by ${P(lenOf(SUSTAIN.cdCut, n))}%; Focus comes from Stillness and perfect parries.`;
  if (c.bloodRes) return `Skills are free (cooldowns only). Landing it cuts your other chain openers' cooldowns by ${P(lenOf(SUSTAIN.cdCut, n))}%; dive hits fill Dragon Blood.`;
  if (c.inkRes) return `Skills are free (cooldowns only). Landing it cuts your other chain openers' cooldowns by ${P(lenOf(SUSTAIN.cdCut, n))}%; every summon and chain writes Ink.`;
  if (c.tempoRes) return `Skills are free (cooldowns only). Landing it cuts your other chain openers' cooldowns by ${P(lenOf(SUSTAIN.cdCut, n))}%; every skill and chain builds Tempo.`;
  if (c.chiRes) return `Skills are free (cooldowns only). Landing it cuts your other chain openers' cooldowns by ${P(lenOf(SUSTAIN.cdCut, n))}%; every hit feeds the hit counter and Chi.`;
  if (c.gloryRes) return 'Skills are free (cooldowns only). A landed chain gives Glory, and hitting with all three weapons in one rotation (a TRINITY) cuts every cooldown.';
  if (c.rageRes) { const R = c.rageRules; return ch.rage ? `🔥 Hold the last hit (${+(R.tap / 60).toFixed(2)} s+) with ${R.min}+ Rage: spends ${R.spendMin}-${R.spendMax} Rage (more the longer you hold) for ×${1 + R.spendMin / 100} to ×2 damage (free in Berserk).` : `Tap it: landing it gives +${R.chain} Rage and cuts your other skills' running cooldowns by ${P(lenOf(SUSTAIN.cdCut, n))}%.`; }
  if (c.pips) return `Landing it refunds ${P(r * SUSTAIN.pipMul)}% of the chain's pip cost and gives +${c.edge.chain} Edge (crit chance and crit damage).`;
  const share = P(r * (c.pips ? SUSTAIN.pipMul : 1));
  const cut = !c.pips && lenOf(SUSTAIN.cdCut, n) ? `, and cuts your other chain openers' cooldowns by ${P(lenOf(SUSTAIN.cdCut, n))}%` : '';
  return `Landing it refunds ${share}% of the chain's ${c.pips ? 'pip' : c.resource} cost${cut}.`;
}
/** Plain-words summary of how a class keeps its skills going (class select, tooltips, README). */
export function sustainText(cls) {
  const c = CLASSES[cls], M = SUSTAIN.mech[cls];
  const r2 = P(SUSTAIN.refund[2] * (c.pips ? SUSTAIN.pipMul : 1)), r3 = P(SUSTAIN.refund[3] * (c.pips ? SUSTAIN.pipMul : 1));
  if (c.gloryRes) return gloryText(c);
  if (c.focusRes) return focusText(c);
  if (c.chiRes) return chiText(c);
  if (c.bloodRes) return bloodText(c);
  if (c.inkRes) return inkText(c);
  if (c.tempoRes) return tempoText(c);
  if (c.rageRes) { const R = c.rageRules; return `Skills are free: Rage is built, not paid. Tapping builds it: +${R.basic} per basic hit, +${R.skill} per skill hit (up to ${R.skillCap} a skill), +${R.hurtBase}-${R.hurtCap} when you take a hit, +${R.chain} per landed named chain, +${R.string} for a full unnamed string${M ? ` and +${M.per} per skill hit on a Sundered enemy (up to ${M.cap} per burst)` : ''}. HOLD a skill (${+(R.tap / 60).toFixed(2)} s+) with ${R.min}+ Rage to spend it: ${R.spendMin} Rage at the threshold up to ${R.spendMax} at full charge (${+(R.full / 60).toFixed(2)} s), for ×${1 + R.spendMin / 100} to ×2 damage and a bigger hit (🔥). Nothing is spent unless you hold. Rage drains ${R.drain}/s after ${R.drainAfter / 60} s out of combat. Cooldowns start when a string ends; finishing a named chain cuts the cooldowns of your other skills by ${P(SUSTAIN.cdCut[3])}% (at least ${SUSTAIN.cdCutMin / 60} s), and Momentum cuts the other rush skills' cooldowns from earlier strings by 1 s.`; }
  if (c.pips) { const E = c.edge, K = c.critPips; return `No cooldowns. Landed chains refund ${r2}% (2-step) / ${r3}% (3-step) of their pip cost, and every crit refunds ${K.per} pip (up to ${K.perAction} per attack, ${K.perSec} a second; not from free casts or during Eclipse). Landed chains give +${E.chain} Edge, each Mark you apply +${E.mark} (max ${E.markCap} per attack) and each Mark you detonate +${E.pop}; every Edge stack is +${P(E.crit)}% crit chance and +${P(E.critDmg)}% crit damage (max ${E.max}, decays after ${E.decayAfter / 60} s idle). Basic attacks deal ${P(SUSTAIN.basicDmg)}% damage; the 5th cut returns ${c.resOnFinisher} pips.`; }
  const parts = [`Landed chains refund part of their cost: ${r2}% for 2-step, ${r3}% for 3-step chains (a 3-step chain about pays for its last step).`];
  if (!c.pips) parts.push(`Finishing a chain cuts the cooldowns of your other chain openers by ${P(SUSTAIN.cdCut[2])}% (2-step) or ${P(SUSTAIN.cdCut[3])}% (3-step), at least ${SUSTAIN.cdCutMin / 60} s.`);
  if (M && cls === 'ranger') parts.push(`Every skill hit on a Quarried enemy gives +${M.per} Energy (up to ${M.cap} per burst).`);
  if (M && cls === 'mage') parts.push(`Consuming Burn gives +${M.per} Mana per stack (up to ${M.cap} per burst).`);
  if (M && cls === 'cleric') parts.push(`Skill hits on Condemned enemies give +${M.per} Holy Charge (up to ${M.cap} per burst), and consuming Condemn gives +${M.perC} per stack (up to ${M.capC}).`);
  const basic = c.resOnBasic ?? c.resOnBasicHit;
  if (basic) parts.push(`Skill hits don't generate ${c.resource} on their own; basic attacks deal ${P(SUSTAIN.basicDmg)}% damage but give +${basic} per hit, so a broken chain means a few swings to recover.`);
  parts.push('No refunds during your ultimate (skills are free there).');
  return parts.join(' ');
}

/** One-line version for skill tooltips. */
export function sustainShort(cls) {
  const c = CLASSES[cls], M = SUSTAIN.mech[cls], k = c.pips ? SUSTAIN.pipMul : 1;
  if (c.bloodRes) return `Skills are free; only DIVE hits build Dragon Blood (+${c.blood.dive} per enemy, up to ${c.blood.diveCap} a move); the Skyborne chains spend all of it (the finishers scale with it).`;
  if (c.inkRes) return `Skills are free; summons (+${c.ink.cast}), chains (+${c.ink.chain}) and basic hits (+${c.ink.basic}) write Ink; a full book = INSCRIBED: the Inscribed chains spend it all and the next summon is empowered.`;
  if (c.tempoRes) return `Skills are free; skills (+${c.tempo.cast}), chains (+${c.tempo.chain}) and basic hits (+${c.tempo.basic}) build Tempo; full = IN TUNE: songs ×${c.tempo.tune} and the In Tune chains spend it all.`;
  if (c.chiRes) return `Skills are free; every hit feeds the hit counter (tiers at ${c.combo.tiers.join(' / ')} evolve your chains) and Chi; Hundred Hands Rush and Seven Seals spend all of it (the finishers scale with it).`;
  if (c.focusRes) return `Skills are free; Stillness (after Sheathe) and perfect parries (+${c.focus.parry}) build Focus; Petal Rain and Moment of Death spend all of it (the finishers scale with it).`;
  if (c.gloryRes) return `Skills are free; hits, chains and Trinities (+${c.glory.trinity}) build Glory; Warlord's Rally and Executioner's Verdict spend all of it (the finishers scale with it).`;
  if (c.rageRes) return `Skills are free; hits, hits taken and landed chains (+${c.rageRules.chain}) build Rage; at ${c.rageRules.ready}+ Rage chains become Rage versions that spend it all.`;
  if (c.pips) return `Crits refund pips (max ${c.critPips.perAction} per attack) and chains refund ${P(SUSTAIN.refund[2] * k)}% / ${P(SUSTAIN.refund[3] * k)}%; chains and Marks build Edge (+crit chance, +crit damage).`;
  const mech = { warrior: `+${M && M.per} Stamina per skill hit on Sundered enemies`, ranger: `+${M && M.per} Energy per skill hit on Quarried enemies`, mage: `+${M && M.per} Mana per Burn stack consumed`, cleric: `Holy Charge from Condemned hits and consumed Condemn`, bladedancer: '' }[cls];
  return `Chains refund ${P(SUSTAIN.refund[2] * k)}% / ${P(SUSTAIN.refund[3] * k)}% of their cost (2 / 3 steps)` + (c.pips ? '' : `, and cut your other openers' cooldowns ${P(SUSTAIN.cdCut[2])}% / ${P(SUSTAIN.cdCut[3])}%`) + (mech ? `; ${mech}` : '') + '.';
}

/** Warrior Glory rules in plain words. */
export function gloryText(c) {
  const G = c.glory, T = c.trinity;
  return `Skills only have cooldowns (Q Greatsword, E Twin Axes, R Warhammer). Glory is built, not paid: +${G.basic} per basic hit, +${G.skill} per skill hit (up to ${G.skillCap} a skill), +${G.chain} when a chain lands, +${G.second} when a rotation reaches its second weapon and +${G.trinity} for a TRINITY (hits with all three weapons in one rotation, gaps under ${T.gap / 60} s). A Trinity also cuts every cooldown by ${P(T.cdCut)}%, heals a little, charges your ult and starts Trinity Surge (${T.surge / 60} s: +${P(T.surgeMul - 1)}% damage). Warlord's Rally and Executioner's Verdict (the Warpath 3-step chains) spend ALL your Glory for up to ×${1 + (G.spendMax || 1)} damage; the ult finishers scale with it (up to +120%) without spending it. Glory drains after ${G.drainAfter / 60} s out of combat.`;
}

/** Monk Chi + hit counter rules in plain words. */
export function chiText(c) {
  const K = c.chi, B = c.combo;
  return `Skills only have cooldowns (Q Tiger Fist, E Crane Kick, R Flow State). Chi is built, not paid: every landed hit gives +${K.hit} Chi (×${K.tierMul[1]} at ${B.tiers[0]}+ hits, ×${K.tierMul[2]} at ${B.tiers[1]}+; up to ${K.hitCap} a skill) and +${K.dodge} for each Flow State dodge. The hit counter resets after ${B.reset / 60} s without a hit; at ${B.tiers[0]} and ${B.tiers[1]} hits every chain evolves into a bigger version. Hundred Hands Rush and Seven Seals spend all your Chi for up to ×2 damage; the finishers scale with it too. Chi drains after ${K.drainAfter / 60} s out of combat.`;
}

/** Dragoon Dragon Blood + Impaled rules in plain words. */
export function bloodText(c) {
  const K = c.blood;
  return `Skills only have cooldowns (Q Piercing Thrust, E Sweeping Arc, R Jump). Dragon Blood is built, not paid, and ONLY by dives: every enemy a dive hits gives +${K.dive} Blood (up to ${K.diveCap} a move; ×${K.ultMul} in Dragon Form). Dragon Dive, Nosedive Barrage, High Jump and Geirskogul spend ALL of it for up to ×${1 + K.spendMax} damage; the finishers scale with it (up to ×${1 + K.finMax}, kept). Blood drains after ${K.drainAfter / 60} s out of combat. Thrusts IMPALE enemies (pins); dives rip the pins out for bonus damage.`;
}

/** Grimoire Summoner Ink rules in plain words. */
export function inkText(c) {
  const K = c.ink;
  return `Skills only have cooldowns (Q Fire Sprites, E Frost Wyrm, R Thunder Roc, G Turn the Page). Ink is built, not paid: +${K.cast} per summon, +${K.chain} per chain, +${K.basic} per basic hit. A full book makes you INSCRIBED: Storm Front and Tri-Element Burst open (they spend all Ink for ×1.25), and the next summon is empowered like after Turn the Page. Landed chains cut the cooldowns of your other chain openers (40% / 65%). Ink fades out of combat; it is full during Grimoire Unbound.`;
}
/** Bard Tempo rules in plain words. */
export function tempoText(c) {
  const K = c.tempo;
  return `Skills only have cooldowns (Q Sonic Riff, E Echo Chord, R Healing Hymn, G Dissonance). Tempo is built, not paid: +${K.cast} per skill, +${K.chain} per chain, +${K.basic} per basic hit. Full Tempo = IN TUNE: songs play ×${K.tune} and Sour Note / Discord Ballad open (they spend all Tempo for ×1.25). Landed chains cut the cooldowns of your other chain openers (40% / 65%). Tempo fades out of combat; it is full during Encore.`;
}

/** Samurai Focus rules in plain words. */
export function focusText(c) {
  const F = c.focus, K = c.cut;
  return `Skills only have cooldowns (Q Iaido Slash, E Crescent Parry, R Sheathe). Focus is built, not paid: +${Math.round(F.still * 60)}/s while in Stillness (the 2 s after a Sheathe), +${F.parry} for a perfect parry (+${F.guard} with Moonlit Guard), +${F.burst} per Delayed Cut you burst (up to ${F.burstCap} a sheathe) and +${F.hit} per skill hit (up to ${F.hitCap} a skill). Petal Rain and Moment of Death spend ALL your Focus for up to ×${1 + F.spendMax} damage; the ult finishers scale with it (up to +${P(F.finMax)}%) without spending it. Delayed Cuts burst for ×${K.per} ATK each when you sheathe. Finishing a chain cuts the cooldowns of your other chain openers by ${P(SUSTAIN.cdCut[2])}% (2-step) or ${P(SUSTAIN.cdCut[3])}% (3-step). Focus drains after ${F.drainAfter / 60} s out of combat.`;
}
