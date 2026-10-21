// Skill / ult tooltips for the HUD (desktop hover, phone long-press). Pure: builds a model from the class data
// (skills[k].stats, cd, cost, desc, tip; basic combo; ult) and the sim's tuning constants, so the text follows
// balance changes. tooltipHTML() renders the model; both HUDs use it.
import { BR, BR_CLS, spChainOf } from '../sim/bossrot.js';
import { hordeAoeText } from '../sim/hordeaoe.js';
import { EVADE } from '../sim/evade.js'; // (sets evade: true on the dashing skills / ults / chains)
import { CLASSES, dodgeOf, TICKS_PER_SEC, BERSERK } from '../sim/data/classes.js';
import { SUSTAIN, sustainNote, sustainShort, gloryText, focusText, chiText, bloodText, inkText, tempoText } from '../sim/sustain.js';
import { SAM } from '../sim/samurai.js';
import { MONK } from '../sim/monk.js';
import { DRG } from '../sim/dragoon.js';
import { ARC } from '../sim/arcana.js';
import { SUNDER, BACKSTAB, ULT, ECLIPSE, RAGE as RAGE_X, HEARTSEEKER, MOMENTUM_MUL } from '../sim/combat.js';
import { WAR, RNG, MAG, CLR, FIN, STACKS, ULTWIN } from '../sim/kit.js';
import { GAP, SMITE_HEAL, JUDGMENT, WHIRL, VANISH, HEART, CUTS, TITAN, STORM, ULT_METEOR, ASCENSION, SHADOW, TTC, CRESCENT, RUSH, WSL, WBA } from '../sim/player.js';
// Melee defensive layers (sim/defense.js), shown on the Dodge tooltip
const DEF_TIPS = {
  warrior: [['Iron Rebuke', 'perfect dodge (first 0.15 s): 16% max-HP shield + 12 Glory; each chain +6% shield (max 25%); plate: -12% damage'], 'Iron Rebuke: dodge right as a hit lands to brace a big shield; every chain you finish stacks more shield.'],
  bladedancer: [['Shadow Time', 'perfect dodge: +0.4 s invulnerable, enemies within 240 slowed 55% for 1.2 s; crits heal 8% of their damage (max 5% HP/s)'], 'Shadow Time: a perfect dodge slows the world around you; crits leech life.'],
  samurai: [['Mirror Parry', 'Crescent Parry / Moonlit Guard also parry boss mechanics; a parry heals 10% max HP'], 'Mirror Parry: your parries now catch boss mechanics too and heal you.'],
  monk: [['Iron Body', '40% of every hit is soaked and drains slowly (never lethal); finishing a chain purges it and heals back 70%'], 'Iron Body: keep chaining to purge the soaked damage and heal it back.'],
  dragoon: [['Dragon Scale', 'every dive landing: 18% max-HP shield for 3 s (1.5 s cooldown); jumps are invulnerable'], 'Dragon Scale: land your dives to shield yourself.'],
};

const sec = (t) => +(t / TICKS_PER_SEC).toFixed(2);
const pct = (m) => Math.round(m * 100);
const num = (v) => +(+v).toFixed(2);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Values for the {placeholders} in the class data's tip texts. */
export function tipVars(cls) {
  const c = CLASSES[cls], bd = CLASSES.bladedancer;
  return {
    sunderDur: sec(SUNDER.ttl), sunderPct: pct(SUNDER.mul - 1), slamSunderPct: pct(SUNDER.slamMul - 1),
    momPct: pct(MOMENTUM_MUL - 1), rushCut: sec(RUSH.cut),
    meteorDelay: sec(CLASSES.mage.skills.R.stats.delay),
    smiteHeal: pct(SMITE_HEAL), sanctEvery: sec(CLASSES.cleric.skills.E.stats.every), shieldDur: sec(CLASSES.cleric.skills.R.stats.shield),
    judgMin: num(JUDGMENT.base), judgMax: num(JUDGMENT.base + JUDGMENT.perCharge), judgBossMin: num(JUDGMENT.vsBoss.base), judgBossMax: num(JUDGMENT.vsBoss.base + JUDGMENT.vsBoss.perCharge), judgHealMin: pct(JUDGMENT.healBase), judgHealMax: pct(JUDGMENT.healBase + JUDGMENT.healPerCharge),
    bsMul: num(BACKSTAB.mul), blossomMax: SHADOW.blossomMax, blossomTotal: CUTS.hops + SHADOW.blossomMax, markMax: SHADOW.markMax, markDur: sec(SHADOW.markDur), stepStealth: sec(SHADOW.stepStealth), cloneMulPct: Math.round(SHADOW.cloneMul * 100), eclVanish: ECLIPSE.vanishChains, stealthDur: sec(VANISH.stealth), cutsTargets: CUTS.maxTargets,
    edgeMax: bd.edge.max, edgeCrit: pct(bd.edge.crit), edgeCritDmg: pct(bd.edge.critDmg), critPipMax: bd.critPips.perAction, popBase: num(bd.markPop.base), popPer: num(bd.markPop.per),
    ...(c.lance ? { qlen: c.skills.Q.stats.len, qmul: c.skills.Q.stats.mul, pin: c.skills.Q.stats.pin, emul: c.skills.E.stats.mul, er: c.skills.E.stats.r, rmul: c.skills.R.stats.mul, rr: c.skills.R.stats.r, range: c.skills.R.stats.range, pinPer: DRG.pin.per, trange: c.skills.F.stats.range, tmul: c.skills.F.stats.mul, tpins: c.skills.F.stats.pins } : {}),
    ...(c.fist ? { hits: c.skills.Q.stats.hits, mul: c.skills.Q.stats.mul, chiDodge: c.chi.dodge, flowEmp: c.flowSt.emp, pr: c.skills.F.stats.r, pmul: c.skills.F.stats.mul } : {}),
    ...(c.blade ? { len: c.skills.Q.stats.len, mul: c.skills.E.stats.mul, wmul: c.skills.E.stats.wmul, focusParry: c.focus.parry, cutR: c.cut.r, cutPer: c.cut.per, kr: c.skills.F.stats.r, kmul: c.skills.F.stats.mul } : {}),
    gapRange: GAP.range, holyPerHit: c.resOnBasicHit || 0, finisherPip: c.resOnFinisher || 0, basicRes: c.resOnBasic ?? c.resOnBasicHit ?? c.resOnHit ?? 0,
  };
}
export function fillTip(text, vars) { return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)); }

const defaultKey = { basic: 'LMB', Q: 'Q', E: 'E', R: 'R', F: 'G', SP: 'F', dodge: 'SHIFT', ult: 'T' }; // (F = the Special; the old 4th skill moved to G)
const actionOf = { basic: 'attack', Q: 'skillQ', E: 'skillE', R: 'skillR', F: 'skillF', SP: 'special', dodge: 'dodge', ult: 'ult' };

/** Chains a slot takes part in ('B3'/'BS' steps belong to the basic combo, 'F+' to F). */
export function chainsFor(cls, slot) {
  const c = CLASSES[cls];
  const own = (step) => (slot === 'basic' ? /^B\d$/.test(step) || step === 'BS' : step === slot || (slot === 'F' && step === 'F+'));
  return (c.chains || []).filter((ch) => ch.seq.some(own)).map((ch) => {
    const i = ch.seq.findIndex(own);
    const note = sustainNote(cls, ch);
    const rageRole = ch.str ? `, 🔥 press the last hit on the beat (or hold it) with ${c.rageRules.min}+ Rage (spends it)` : `, with ${c.rageRules && c.rageRules.ready}+ Rage (spends it all)`;
    return { id: ch.id, evade: !!ch.evade, name: ch.name, seq: ch.seq, tier: ch.seq.filter((k) => !/^B/.test(k)).length + (ch.seq.some((k) => /^B/.test(k)) ? 1 : 0), five: !!ch.sp, refund: note, rage: !!ch.rage, kind: ch.kind || null, str: !!ch.str, role: (i === 0 ? 'starts' : i === ch.seq.length - 1 ? 'finishes' : 'middle') + (ch.rage ? rageRole : '') + (ch.kind ? ` · ${ch.kind === 'mob' ? 'vs packs' : 'vs bosses'}` : '') + (ch.stealth ? ', while hidden by Vanish' : ch.vanish ? ', while your Marks last' : ch.state ? `, during ${c.state.name}` : ''), desc: ch.desc, free: !!ch.free };
  });
}

/** Stat rows [label, value] for a skill (from skills[k].stats and the sim constants), with ≈ damage from `atk`. */
function skillStats(cls, key, atk) {
  const c = CLASSES[cls], sk = c.skills[key], st = sk.stats || {}, rows = [];
  const dmg = (m) => `×${num(m)} ATK` + (atk ? ` (≈${Math.round(m * atk)})` : '');
  const cost = c.pips ? `${sk.cost} pip${sk.cost === 1 ? '' : 's'}` : c.rageRes || c.gloryRes || c.focusRes || c.chiRes || c.bloodRes || c.inkRes || c.tempoRes ? 'free' : `${sk.cost} ${c.resource}`;
  rows.push(['Cost', sk.id === 'judgment' ? `all ${c.resource} (min ${sk.cost})` : cost]);
  rows.push(['Cooldown', sk.cd > 0 ? `${sk.cd} s` + (sk.str ? ` (starts when the string ends; finishing a string cuts your OTHER skills' cooldowns by ${pct(c.flow.roll)}%, a 🔥 finisher resets one of them fully)` : '') : c.gcd ? `none (${sec(c.gcd)} s global recovery)` : 'none']);
  if (sk.str) rows.push(['String', sk.str.map((h, i) => `${i + 1}. ${h.name} ×${num(h.mul)}`).join(' → ') + ` (press ${key} again within ${sec(c.strings.window)} s; another string skill links into its hit of the same number; presses made during a hit are queued, never dropped)`]);
  if (sk.str && c.flow) rows.push(['Flow', `your 3rd basic swing lets this open at hit 2 (${sec(c.flow.weave)} s); basic swings and dodges cancel any hit and the string waits for you`]);
  if (c.arms) { // Warrior Weapon Master: the weapon, its hit and what it sets up
    const W = c.weapons[sk.w];
    if (W) rows.push(['Weapon', `${W.name} (${W.role}); drawing it also switches your basic combo`]);
    else rows.push(['Weapon', 'your last-drawn weapon (Greatsword / Twin Axes / Warhammer)']);
    if (sk.id === 'arsenal_toss') rows.push(['Toss', `${dmg(st.mul)} where it lands (${st.r} px), up to ${st.range} px`], ['Planted (automatic)', `${sec(st.life)} s. Greatsword: a ${dmg(st.cleave)} cleave (${st.cleaveR} px) every ${sec(st.cleaveEvery)} s. Twin Axes: +1 Bleed every ${sec(st.bleedEvery)} s within ${st.bleedR} px. Warhammer: a ${dmg(st.quake)} quake (${st.quakeR} px) every ${sec(st.quakeEvery)} s`], ['Recall (G again)', `${dmg(st.recall)} on everything along the return path; counts as that weapon's hit for the Trinity`]);
    if (sk.id === 'ax_flurry') rows.push(['Damage', dmg(st.mul) + ` × ${st.hits} cuts`], ['Bleed', `+${st.bleed} per cut: ×0.12 ATK per stack every 0.5 s (max ${c.stack.max}, bosses ${c.stack.bossMax})`], ['Cone', `${st.r} px`]);
    else rows.push(['Damage', dmg(st.mul)], ['Reach', `${st.r} px`]);
    if (st.stun) rows.push(['Stun', `${sec(st.stun)} s, +${st.poise} boss posture damage`]);
    const S = c.state;
    if (S && S.on === sk.id) rows.push([S.name, `${sec(S.dur)} s after Skullcrusher: Q → Seismic Arc → E Warlord's Rally; E → Thunder Hurl → Q Executioner's Verdict`]);
    rows.push(['Glory', `+${c.glory.skill} per hit (max ${c.glory.skillCap}), +${c.glory.chain} when a chain lands`]);
    return rows;
  }
  if (c.grim) { // Grimoire Summoner: Fire Sprites / Frost Wyrm / Thunder Roc / Turn the Page
    const K = c.ink;
    if (sk.id === 'fire_sprites') rows.push(['Damage', dmg(st.mul) + ` × ${st.hits} dives on up to ${st.n} enemies`], ['Range', `${st.range} px`], ['Turned page', `a Fire Elemental: 4 punches ${dmg(0.7 * ARC.insc)} + a slam ${dmg(1.4 * ARC.insc)}`]);
    if (sk.id === 'frost_wyrm') rows.push(['Damage', dmg(st.mul) + ` × ${st.pulses} breaths, slows`], ['Cone', `${st.r} px`], ['Chill', '+1 (turned page: frozen solid)']);
    if (sk.id === 'thunder_roc') rows.push(['Damage', dmg(st.mul) + ` × ${st.bolts} bolts (${st.r} px)`], ['Line', `${st.len} px`], ['Vs chilled', `×${ARC.shock} and always a crit`], ['Turned page', 'a storm: 8 wider bolts']);
    if (sk.id === 'turn_the_page') rows.push(['Page flurry', dmg(st.mul) + `, ${st.r} px`], ['Empowers', `your next summon ×${ARC.insc} with its turned-page form`]);
    rows.push(['Ink', `+${K.cast} per summon, +${K.chain} per chain, +${K.basic} per basic hit; full = INSCRIBED (Inscribed chains open, next summon empowered)`]);
    return rows;
  }
  if (c.bard) { // Bard: Sonic Riff / Echo Chord / Healing Hymn / Dissonance
    const K = c.tempo, S = ARC.songs;
    if (sk.id === 'sonic_riff') rows.push(['Damage', dmg(st.mul)], ['Line', `${st.len} px, ${st.w} px wide`]);
    if (sk.id === 'echo_chord') rows.push(['Damage', `${dmg(st.mul)}, +${pct(st.grow)}% per bounce`], ['Bounces', `${st.bounces} (${st.hop} px hops)`]);
    if (sk.id === 'healing_hymn') rows.push(['Heal', `${pct(st.heal)}% max HP + ${num(st.atk)}×ATK to everyone within ${st.r} px, cleanses stuns`], ['Pulse', `${dmg(st.mul)}, ${st.pr} px`]);
    if (sk.id === 'dissonance') rows.push(['Damage', dmg(st.mul) + `, stun ${sec(st.stun)} s`], ['Cone', `${st.r} px`], ['Dissonant', `+${pct(ARC.disso)}% damage taken from everyone, ${sec(st.vulnT)} s`]);
    rows.push(['Songs', `${sec(S.dur)} s on every ally within ${S.range} px: Valor +${pct(S.valor)}% dmg, Haste +${pct(S.haste)}% move / +${pct(S.hasteCd)}% cooldown speed, Mending ${num(S.mend * 100)}% HP every ${sec(S.mendEvery)} s, Requiem +${pct(S.req)}% damage taken (per strength)`]);
    rows.push(['Tempo', `+${K.cast} per skill, +${K.chain} per chain, +${K.basic} per basic hit; full = IN TUNE (songs ×${S.tune}, In Tune chains open)`]);
    return rows;
  }
  if (c.lance) { // Dragoon: Piercing Thrust / Sweeping Arc / Jump
    if (sk.id === 'spear_throw') rows.push(['Damage', dmg(st.mul) + ' on the first enemy'], ['Range', `${st.range} px`], [c.stack.name, `+${st.pins} pins + Scorched: your next Jump homes onto it (${sec(st.mark)} s)`]);
    if (sk.id === 'piercing_thrust') rows.push(['Damage', dmg(st.mul) + ', pierces'], ['Line', `${st.len} px lunge`], [c.stack.name, `+${st.pin} pin on everything hit`]);
    if (sk.id === 'sweeping_arc') rows.push(['Damage', dmg(st.mul) + ', big knockback'], ['Radius', `${st.r} px`]);
    if (sk.id === 'jump') { rows.push(['Dive', `${dmg(st.mul)}, ${st.r} px, invulnerable in the air (${sec(st.air)} s)`], ['Range', `${st.range} px (homes onto scorched enemies up to ${c.skills.SP.stats.diveRange} px after Dragon's Roar)`]); const S = c.state; rows.push([S.name, `${sec(S.dur)} s: next Skyborne chain ×${DRG.sky}; E → Dragon Dive (→ Q Geirskogul), Q → High Jump (→ E Nosedive Barrage)`]); }
    rows.push(['Pins', `dives rip them out: ×${num(DRG.pin.per)} ATK each (max ${c.stack.max}, bosses ${c.stack.bossMax})`]);
    rows.push(['Dragon Blood', `+${c.blood.dive} per enemy a dive hits (max ${c.blood.diveCap} a move)`]);
    return rows;
  }
  if (c.fist) { // Monk: Tiger Fist / Crane Kick / Flow State
    if (sk.id === 'iron_palm') rows.push(['Damage', dmg(st.mul)], ['Cone', `${st.r} px, ${st.step} px step`], ['Pressure Point', `+${st.pp} on everything hit`]);
    if (sk.id === 'tiger_fist') rows.push(['Damage', dmg(st.mul) + ` × ${st.hits} punches`], ['Cone', `${st.r} px`], ['Hit counter', `+${st.hits}`]);
    if (sk.id === 'crane_kick') rows.push(['Damage', dmg(st.mul) + ', launch'], ['Dash', `${st.dash} px (i-frames)`], ['Radius', `${st.r} px`]);
    if (sk.id === 'flow_state') { rows.push(['Chi push', `${dmg(st.mul)}, ${st.r} px`]); const S = c.state; rows.push([S.name, `${sec(S.dur)} s: moving = auto-dodge every attack (+${c.chi.dodge} Chi), next chain ×${c.flowSt.emp}; Q → E Hundred Hands Rush, E → Q Seven Seals`]); }
    rows.push(['Evolves', `at ${c.combo.tiers.join(' / ')} hits every chain upgrades (damage ×${MONK.tierMul.join(' / ×')}, more hits, bigger areas)`]);
    rows.push(['Chi', `+${c.chi.hit} per hit (×${c.chi.tierMul[1]} / ×${c.chi.tierMul[2]} at higher tiers, max ${c.chi.hitCap} a skill)`]);
    return rows;
  }
  if (c.blade) { // Samurai: Iaido / Crescent Parry / Sheathe
    const K = c.cut;
    if (sk.id === 'kesa_slash') rows.push(['Damage', dmg(st.mul)], ['Cone', `${st.r} px diagonal cut`], [c.stack.name, `+${st.cuts} on everything cut`]);
    if (sk.id === 'iaido') rows.push(['Damage', dmg(st.mul)], ['Line', `${st.len} px dash-through (i-frames), ${st.w} px wide`], [c.stack.name, `+${st.cuts} on everything cut`]);
    if (sk.id === 'crescent_parry') rows.push(['Block', `${sec(st.block)} s: a hit in it is parried (no damage)`], ['Perfect parry', `counter ${dmg(st.mul)} crit, +${st.cuts} cuts, +${c.focus.parry} Focus`], ['No hit', `crescent slash ${dmg(st.wmul)} (${st.wr} px), +${st.wcuts} cut`]);
    if (sk.id === 'sheathe') { rows.push(['Burst', `every Delayed Cut within ${K.r} px: ×${num(K.per)} ATK per cut` + (atk ? ` (≈${Math.round(K.per * atk)} each)` : '')], ['Ring', `${dmg(st.rmul)}, ${st.ring} px`]); const S = c.state; rows.push([S.name, `${sec(S.dur)} s after any sheathe (Sheathe, Blossom Burst, Counter Sheathe): +${Math.round(c.focus.still * 60)} Focus/s; Q → then E Petal Rain; E → Moonlit Guard → then Q Moment of Death`]); }
    rows.push(['Focus', `+${c.focus.hit} per skill hit (max ${c.focus.hitCap}); Stillness +${Math.round(c.focus.still * 60)}/s; perfect parry +${c.focus.parry}`]);
    return rows;
  }
  switch (sk.id) {
    case 'heartseeker': rows.push(['Damage', dmg(HEART.mul) + `, up to +${pct(HEARTSEEKER.maxBonus)}% below ${pct(HEARTSEEKER.loHp)}% HP`], ['Range', `${HEART.range} px`]); break;
    case 'vanish': rows.push(['Stealth', `${sec(VANISH.stealth)} s`], ['Backstab', `always a crit, ×${num(BACKSTAB.mul)} damage (pops Marks)`], ['Backflip', `${VANISH.dist} px`]); break;
    case 'thousandcuts': rows.push(['Damage', dmg(CUTS.mul) + ` per cut, ${CUTS.hops} cuts`], ['Targets', `up to ${CUTS.maxTargets}`], ['Eviscerate', `after Heartseeker: every cut on its target, +${pct(CUTS.evPer)}% per crit in the chain (max +${pct(CUTS.evMax)}%)`], ['Crimson Flurry', 'after Flicker: Marked enemies first, cuts on them always crit']); break;
    case 'judgment': rows.push(['Damage', `${dmg(JUDGMENT.base)} → ${dmg(JUDGMENT.base + JUDGMENT.perCharge)} at full charge`], ['vs bosses / elites', `${dmg(JUDGMENT.vsBoss.base)} → ${dmg(JUDGMENT.vsBoss.base + JUDGMENT.vsBoss.perCharge)} at full charge`], ['Heal', `${pct(JUDGMENT.healBase)}–${pct(JUDGMENT.healBase + JUDGMENT.healPerCharge)}% max HP (you + allies)`]); break;
    case 'charge': rows.push(['Damage', dmg(st.mul) + ' on impact'], ['Knock-up', `${sec(st.knockup)} s`]); break;
    case 'slam': rows.push(['Damage', dmg(st.mul) + `, +${pct(SUNDER.slamMul - 1)}% vs Sundered`], ['Knock-up', `${sec(st.knockup)} s`], ['Air time', `${sec(WSL.leap)} s of i-frames`]); break;
    case 'bash': rows.push(['Damage', dmg(st.mul) + ` (splash ${dmg(st.mul * WBA.splashMul)} within ${WBA.splashR} px)`], ['Stagger', `${sec(st.stagger)} s, +${st.poise} boss poise damage`]); break;
    case 'whirlwind': rows.push(['Damage', dmg(st.mul) + ' per spin hit'], ['Pull', `drags enemies within ${WHIRL.pullR} px in`], ['Moving', `steer it at ${pct(st.speed || 0.9)}% move speed (no input: drifts toward your aim); cancel into Q / E / R or a dodge after ${sec(st.cancel || 8)} s`]); break;
    case 'smite': rows.push(['Damage', dmg(st.mul)], ['Heal', `${pct(SMITE_HEAL)}% of damage dealt`]); break;
    case 'sanctuary': rows.push(['Heal', `${num(st.healPct * 100)}% max HP + ${num(st.healAtk)}×ATK per pulse`], ['Slow', `−${pct(1 - st.slowMul)}% speed`]); break;
    default: if (st.mul) rows.push(['Damage', dmg(st.mul) + (st.pulses ? ` per hit, ${st.pulses} hits` : '')]);
  }
  if (st.r) rows.push(['Radius', `${st.r} px`]);
  if (st.range) rows.push(['Range', `${st.range} px`]);
  if (st.dur) rows.push(['Duration', `${sec(st.dur)} s`]);
  if (st.pulses && st.every && sk.id === 'sanctuary') rows.push(['Duration', `${sec(st.pulses * st.every)} s (${st.pulses} pulses)`]);
  if (st.root) rows.push(['Root', `${sec(st.root)} s`]);
  if (st.life) rows.push(['Lasts', `${sec(st.life)} s`]);
  if (st.freeze) rows.push(['Freeze', `${sec(st.freeze)} s`]);
  if (st.delay) rows.push(['Lands after', `${sec(st.delay)} s`]);
  if (st.burnMul) rows.push(['Burn', `×${num(st.burnMul)} ATK × ${st.burnPulses}`]);
  if (st.shield) rows.push(['Shield', `${sec(st.shield)} s (you + allies passed)`]);
  if (st.iframes) rows.push(['I-frames', `${sec(st.iframes)} s`]);
  if (c.rageRules) { const R = c.rageRules; rows.push(['Tap', 'the normal hit: builds Rage'], ['On the beat 🔥', `the string's LAST hit pressed inside the flashing rhythm window (${sec(c.flow.rhythm.len)} s, opens as hit 2 recovers) with ${R.min}+ Rage: empowered at once (no hold), spends up to ${c.flow.rhythm.spend} Rage for ×${num(1 + c.flow.rhythm.spend / 100)}`], ['Hold 🔥', `hold ${sec(R.tap)} s+ with ${R.min}+ Rage: empowered hit, spends ${R.spendMin}-${R.spendMax} Rage (full charge ${sec(R.full)} s) for ×${num(1 + R.spendMin / 100)}-×2 damage; free in Berserk. Rage is never spent any other way`]); }
  if (c.edge) rows.push(['Edge', `max ${c.edge.max}: +${pct(c.edge.crit)}% crit, +${pct(c.edge.critDmg)}% crit dmg each (+${c.edge.chain}/chain, +${c.edge.mark}/Mark, +${c.edge.pop}/detonation)`], ['Crits', `+${c.critPips.per} pip (max ${c.critPips.perAction}/attack, ${c.critPips.perSec}/s); on a Marked enemy: detonate ×(${c.markPop.base} + ${c.markPop.per}/stack)`]);
  const S = c.state;
  if (S && S.on === 'impact' && RUSH.keys.includes(key)) rows.push([S.name, `${sec(S.dur)} s after a rush lands: other rush skills −${sec(RUSH.cut)} s, next one +${pct(MOMENTUM_MUL - 1)}%`]);
  else if (S && S.on === sk.id && S.steps && S.steps.base) rows.push([S.name, `${sec(S.dur)} s after ${S.on === 'counter' ? 'a successful Counter' : sk.name}: ` + Object.entries(S.steps.base).map(([k, v]) => `${k} → ${(c.chains.find((q) => q.id === v.chain) || {}).name}`).join(', ')]);
  const STK = { charge: `Sunder +1 (${sec(SUNDER.ttl)} s, +${pct(SUNDER.mul - 1)}% damage from you; Shoulder Breaker +2)`, slam: 'Sunder +1', bash: 'Sunder +1', pierce: "Quarry +1 per Hunter's Mark arrow", trap: 'Quarry +1 on trigger', meteor: `Burn +${MAG.burn.meteor} (Cataclysm +${MAG.burn.cataclysm}), +${MAG.burn.pulse} per burn pulse`, smite: `Condemn +${CLR.smiteStacks}`, judgment: `Final Verdict: ×(1 + ${CLR.verdictPer} per Condemn; ${CLR.verdictPerBoss} on bosses / elites) and uses it up` }[sk.id];
  if (STK && c.stack) rows.push([c.stack.name, STK + ` (max ${c.stack.max}${c.stack.bossMax !== c.stack.max ? `, bosses ${c.stack.bossMax}` : ''})`]);
  return rows;
}

/** Special stat rows (from skills.SP.stats). */
function specialStats(cls, atk) {
  const c = CLASSES[cls], sp = c.skills.SP, st = sp.stats;
  const dmg = (m) => `×${num(m)} ATK` + (atk ? ` (≈${Math.round(m * atk)})` : '');
  const rows = [['Cost', 'free'], ['Cooldown', `${sp.cd} s`]];
  switch (sp.id) {
    case 'warlords_decree': rows.push(['Roar', dmg(st.mul) + `, pulls everything within ${st.r} px, taunts ${sec(st.taunt)} s`], ['Decree', `${sec(st.dur)} s: every chain also swings your other two weapons (${dmg(st.swing)} each, ${st.swingR} px; Axes +${st.bleed} Bleed, Hammer posture)`], ['Glory', `+${st.glory}`]); break;
    case 'storm_of_arrows': rows.push(['Damage', dmg(st.mul) + ` × ${st.pulses} waves (slows)`], ['Radius', `${st.r} px`], ['Range', `${st.range} px`], ['MARK', `${sec(st.markT)} s: +${pct(st.mark - 1)}% damage from you, +${st.quarry} Quarry; Deathmark Volley always crits it`]); break;
    case 'grand_meteor': rows.push(['Damage', dmg(st.mul) + `, knockdown, +${pct(st.frozen - 1)}% vs frozen`], ['Radius', `${st.r} px`], ['Lands after', `${sec(st.delay)} s (${sec(st.surgeDelay)} s in Arcane Surge)`], ['Burn', `+${st.burn}, then burning ground ${dmg(st.burnMul)} × ${st.burnPulses} (+1 Burn each)`]); break;
    case 'divine_hammer': rows.push(['Damage', dmg(st.mul) + `, stun ${sec(st.stun)} s (boss posture)`], ['Radius', `${st.r} px`], ['Lands after', `${sec(st.delay)} s`], ['Shield', `${pct(st.shield)}% max HP for ${sec(st.shieldT)} s, you + allies within ${st.shieldR} px (×${st.consec} in Consecration)`], ['Condemn', `+${st.condemn}`]); break;
    case 'shadow_clone': rows.push(['Smoke burst', dmg(st.mul) + `, ${st.r} px`], ['Clones', `${st.clones} clones copy your next ${st.chains} chains: every hit echoes at ${pct(st.echo)}% (max ${st.cap} per chain)`], ['Lasts', `${sec(st.dur)} s`]); break;
    case 'void_draw': rows.push(['Charge', `${sec(st.charge)} s (unstoppable)`], ['Damage', dmg(st.mul) + ` down a ${st.len} px line`], ['Delayed Cuts', `+${st.cuts} on everything hit (+${st.still} in Stillness, ×${st.stillMul} damage)`], ['Focus', `+${st.focus}`]); break;
    case 'legendary_page': rows.push(['Phoenix (packs)', `${st.passes} sweeps ${dmg(st.mul)} down a ${st.len} px line + burning ground`], ['Kraken (boss / elite near your aim)', `${st.squeezes} squeezes ${dmg(st.kmul)} (roots, frozen solid), then a crush ${dmg(st.crush)} (×${st.solid} if frozen solid)`], ['Ink', '+25']); break;
    case 'crescendo': rows.push(['Build-up', `${sec(st.charge)} s (unstoppable)`], ['Shockwave', `${dmg(st.mul)} × (1 + ${st.per} per active song, max 4), ${st.r} px`], ['Tempo', `+${st.tempo}`]); break;
    case 'dragons_descent': rows.push(['Leap', `up to ${st.range} px (i-frames)`], ['Damage', dmg(st.mul) + `, ${st.r} px, launch (×${st.flowMul} if Flow-empowered)`], ['Hit counter', 'jumps straight to the next tier (10 / 20)'], ['Chi', `+${st.chi}`], ['Pressure Points', `+${st.pp} on everything hit`]); break;
  }
  return rows;
}

/** Ult stat rows from the sim constants. */
function ultStats(cls, atk) {
  const dmg = (m) => `×${num(m)} ATK` + (atk ? ` (≈${Math.round(m * atk)})` : '');
  switch (CLASSES[cls].ult.id) {
    case 'berserk': return [['Slam', dmg(TITAN.mul) + `, radius ${TITAN.r} px, knock-up`], ['Leap range', `${TITAN.range} px`], ['Berserk', `${sec(TITAN.rage)} s: Rage locked at 100 (every hit is 🔥 empowered at ×2 for free, no hold needed; strings loop with NO cooldowns and play their 🔥 chains), swings ${pct(1 / BERSERK.speed - 1)}% faster and ×${num(BERSERK.mul)}, ${pct(RAGE_X.lifesteal)}% lifesteal, pull aura ${RAGE_X.pullR} px`], ['Berserk Finale', `if no route finisher lands: ${dmg(WAR.finale.mul)} shockwave, ${WAR.finale.r} px, knock-up`], ['After', `Rage drops to ${CLASSES.warrior.rageRules.afterBerserk}`]];
    case 'arrowstorm': return [['Damage', dmg(STORM.mul) + ` × ${STORM.pulses} pulses`], ['Duration', `${sec(STORM.pulses * STORM.every)} s`], ['Radius', `${STORM.r} px`], ['Range', `${STORM.range} px`], ['Slow', `−${pct(1 - STORM.slowMul)}%`]];
    case 'ultmeteor': return [['Impact', dmg(ULT_METEOR.mul) + `, radius ${ULT_METEOR.r} px`], ['Lands after', `${sec(ULT_METEOR.delay)} s`], ['Burn', `×${num(ULT_METEOR.burnMul)} ATK × ${ULT_METEOR.burnPulses}`], ['Range', `${ULT_METEOR.range} px`]];
    case 'ascension': return [['Duration', `${sec(ASCENSION.dur)} s`], ['Pulse', `every ${sec(ASCENSION.every)} s, radius ${ASCENSION.r} px`], ['Heal', `${pct(ASCENSION.healPct)}% max HP + ${num(ASCENSION.healAtk)}×ATK`], ['Burn', dmg(ASCENSION.mul) + ' per pulse'], ['Skills', 'cost nothing']];
    case 'eclipse': return [['Duration', `${sec(ECLIPSE.dur)} s (+${sec(ECLIPSE.extPerDodge)} s on a perfect dodge, once)`], ['Skills', 'cost 0 pips'], ['Stealth per cast', `${sec(ECLIPSE.stealth)} s`], ['End burst', `${pct(ECLIPSE.burst)}% of your damage to each Backstabbed enemy`],
      ['Ten Thousand Cuts', `you + ${TTC.minClones}–${TTC.maxClones} clones (1 per kill on the route) within ${TTC.r} px: ${TTC.cuts} cuts + ${TTC.cloneCuts} per clone, each ${dmg(CUTS.mul)} (clones ×${num(TTC.cloneMul)}) as a Backstab crit, kills add cuts; then every crescent detonates (up to ${dmg(TTC.detMax)} crit, +${pct(TTC.perCrit)}% per crit landed during Eclipse, max ×${TTC.critMax})`],
      ['Crescent Execution', `one Backstab crit of Heartseeker × (${CRESCENT.base} + ${CRESCENT.perStack} per Mark stack used on the target this route, max ${CRESCENT.maxStacks}, + ${CRESCENT.perCrit} per crit landed during Eclipse, max +${CRESCENT.critMax}): ${dmg(HEART.mul * CRESCENT.base)} → ${dmg(HEART.mul * (CRESCENT.maxStacks * CRESCENT.perStack + CRESCENT.base + CRESCENT.critMax))} maxed`]];
    case 'warlord': return [['Slam', dmg(4) + ', 220 px radius, knock-up'], ['Leap range', '320 px'], ['Glory', '+60']];
    case 'awakened_spirit': return [['Spirit slam', dmg(MONK.spirit.mul) + `, ${MONK.spirit.r} px, launch`], ['Hit counter', `jumps to ${CLASSES.monk.combo.ult} (top tier: every chain fully evolved) and stays there`], ['Mirror', `the spirit repeats every hit you land for ${pct(MONK.spirit.mirror)}%`], ['Chi', `+${CLASSES.monk.chi.ult} at once, ×${CLASSES.monk.chi.ultMul} Chi gain in the window (the spenders keep it)`], ['No finisher', `Spirit Release pops every Pressure Point at ×${MONK.release}`]];
    case 'dragon_form': return [['Crash', dmg(DRG.form.mul) + `, ${DRG.form.r} px, launch`], ['Dragon Blood', `+${CLASSES.dragoon.blood.ult} at once, ×${CLASSES.dragoon.blood.ultMul} gain in the window`], ['Jump', `cooldown ${sec(DRG.form.rjump)} s for 10 s`], ['Dragon spirit', `every dive: a fire burst ${dmg(DRG.form.echo)} in ${DRG.form.echoR} px`]];
    case 'grimoire_unbound': return [['Burst', dmg(3.4) + ', 300 px'], ['Unbound', `a creature strikes by itself every ${sec(ARC.unbound.every)} s within ${ARC.unbound.r} px (×${ARC.unbound.muls[0]}–×${ARC.unbound.muls[4]} ATK)`], ['Ink', 'full for the window']];
    case 'encore': return [['Curtain call', dmg(3.0) + ', 290 px'], ['Encore', `every active song replayed at ×${ARC.songs.encore} (none: Valor + Haste)`], ['Notes', 'basic notes explode (70 px) in the window'], ['Tempo', 'full for the window']];
    case 'void_blade': return [['Void cut', dmg(SAM.voidCut.mul) + `, ${SAM.voidCut.len} px line, +${SAM.voidCut.cuts} Delayed Cuts`], ['Focus', `+${CLASSES.samurai.focus.ult} at once, ×${CLASSES.samurai.focus.ultMul} Focus gain in the window (the spenders keep it)`], ['Free sheathes', 'Sheathe has no cooldown in the window'], ['Void Sheathe', `no route finisher: the window ends by bursting every cut at ×${SAM.voidEnd}`]];
    default: return [];
  }
}
/** Ult-window + finisher rows for the classes with ult routes outside Eclipse. */
function windowStats(cls, atk) {
  const c = CLASSES[cls];
  if (!c.routes || c.ult.id === 'eclipse') return [];
  const dmg = (m) => `×${num(m)} ATK` + (atk ? ` (≈${Math.round(m * atk)})` : '');
  const rows = [['Ult window', c.flow ? `${sec(ULTWIN.dur)} s: no cooldowns (strings loop), no ult meter; any ${c.flow.berserkHits} hits that end on a route's two keys finish it` : `${sec(ULTWIN.dur)} s: skills free, cooldowns ×${ULTWIN.cdMul} faster, each route's next step ready at once, no ult meter`]];
  const F = FIN;
  const routeKeys = (id) => { const r = c.routes.find((q) => q.id === id); return r ? (r.end ? `Berserk → any ${c.flow.berserkHits - r.end.length} hits → ${r.end.join(' → ')}` : ['Berserk', ...r.seq].join(' → ')) : ''; };
  const fin = {
    worldbreaker: `(${routeKeys('worldbreaker')}) crater pull ${F.worldbreaker.pullR} px, ${dmg(F.worldbreaker.mul)} +${F.worldbreaker.perStack}/Sunder crit, then ${F.worldbreaker.rings.length} rings ${dmg(F.worldbreaker.ringMul)}`,
    titans_execution: `(${routeKeys('titans_execution')}) one crit of ×(${F.titans_execution.base} + ${F.titans_execution.perStack}/Sunder, max ${F.titans_execution.maxStacks}) ATK: ${dmg(F.titans_execution.base)} → ${dmg(F.titans_execution.base + F.titans_execution.perStack * F.titans_execution.maxStacks)}`,
    skyfall: `${F.skyfall.waves} waves × ${F.skyfall.perWave} exploding arrows over ${F.skyfall.r} px, ${dmg(F.skyfall.mul)} each`,
    heavens_arrow: `one crit of ×(${F.heavens_arrow.base} + ${F.heavens_arrow.perStack}/Quarry, max ${F.heavens_arrow.maxStacks}) ATK: ${dmg(F.heavens_arrow.base)} → ${dmg(F.heavens_arrow.base + F.heavens_arrow.perStack * F.heavens_arrow.maxStacks)}, half to the rest of the line`,
    armageddon: `${F.armageddon.count} meteors over ${F.armageddon.r} px, ${dmg(F.armageddon.mul)} each (+${MAG.burn.meteor} Burn)`,
    singularity: `holds ${sec(F.singularity.hold)} s, then one crit of ×(${F.singularity.base} + ${F.singularity.perStack}/Burn, max ${F.singularity.maxStacks}) ATK: ${dmg(F.singularity.base)} → ${dmg(F.singularity.base + F.singularity.perStack * F.singularity.maxStacks)}`,
    rapture: `${F.rapture.pillars} pillars ${dmg(F.rapture.mul)} crit over ${F.rapture.r} px (+${pct(F.rapture.heal)}% heal each), then a ${pct(F.rapture.finalHeal)}% party heal`,
    thousand_petal_storm: `${Math.floor((SAM.storm.to - SAM.storm.from) / SAM.storm.every) + 1} storm cuts over ${SAM.storm.r} px (${dmg(SAM.storm.mul)}, +${SAM.storm.cuts} Delayed Cuts each), then one sheathe click bursts them all: ×(${SAM.storm.base} + ${SAM.storm.per}/cut) ATK each; up to +${pct(CLASSES.samurai.focus.finMax)}% with Focus`,
    one_perfect_cut: `black screen, one white line: ONE crit of ×(${SAM.perfect.base} + ${SAM.perfect.per}/Delayed Cut) ATK: ${dmg(SAM.perfect.base)} → ${dmg(SAM.perfect.base + SAM.perfect.per * CLASSES.samurai.stack.bossMax)} at ${CLASSES.samurai.stack.bossMax} cuts; up to +${pct(CLASSES.samurai.focus.finMax)}% with Focus`,
    hundred_fists: `${Math.floor((MONK.fists.to - MONK.fists.from) / MONK.fists.every) + 1} spirit fists over ${MONK.fists.r} px (${dmg(MONK.fists.mul)} each), then a double-palm slam: ×(${MONK.fists.base} + ${CLASSES.monk.pp.per}/Pressure Point) ATK on every enemy; up to +${pct(CLASSES.monk.chi.finMax)}% with Chi`,
    heaven_splitting_palm: `every other Pressure Point on screen pops in sequence, then ONE palm: a crit of ×(${MONK.palmFin.base} + ${MONK.palmFin.per}/Pressure Point) ATK: ${dmg(MONK.palmFin.base)} → ${dmg(MONK.palmFin.base + MONK.palmFin.per * CLASSES.monk.stack.bossMax)} at ${CLASSES.monk.stack.bossMax} (in the window Seven Seals PLANTS a point per seal instead of popping them); up to +${pct(CLASSES.monk.chi.finMax)}% with Chi`,
    wyrmstorm: `${DRG.storm.dives} dives (${dmg(DRG.storm.mul)} each, pins burst) while ${Math.floor((DRG.storm.rainTo - DRG.storm.rainFrom) / DRG.storm.rainEvery) + 1} dragonfire bolts rain over ${DRG.storm.range} px (${dmg(DRG.storm.rainMul)} each), then a crash: ×(${DRG.storm.crashMul} + ${DRG.pin.per}/pin) ATK in ${DRG.storm.crashR} px`,
    nidhoggs_fall: `vanish into the sky, then dragon and lancer crash as ONE strike: a crit of ×(${DRG.nid.base} + ${DRG.nid.per}/pin) ATK: ${dmg(DRG.nid.base)} → ${dmg(DRG.nid.base + DRG.nid.per * CLASSES.dragoon.stack.bossMax)}, ${dmg(DRG.nid.ringMul)} in a ${DRG.nid.ringR} px ring`,
    bestiary_stampede: `${ARC.stampede.n} creature charges (${dmg(ARC.stampede.mul)} each, ${ARC.stampede.r} px) across ${ARC.stampede.range} px, then the phoenix bursts (${dmg(ARC.stampede.burstMul)}, ${ARC.stampede.burstR} px); ×1.5 with a full book`,
    final_chapter: `the kraken drags your target down (frozen solid), ${ARC.chapter.hits} creature strikes (${dmg(ARC.chapter.hitMul)}), then the book slams shut: ONE crit of ×(${ARC.chapter.base} + ${ARC.chapter.solid} if frozen solid) ATK, ${dmg(ARC.chapter.splash)} within ${ARC.chapter.splashR} px; ×1.5 with a full book`,
    fortissimo: `${ARC.fort.n} golden notes (${dmg(ARC.fort.mul)} each, ${ARC.fort.r} px) over ${ARC.fort.range} px, then a final chord (${dmg(ARC.fort.chordMul)}, ${ARC.fort.chordR} px); +${pct(ARC.fort.per)}% per active song`,
    death_knell: `a bell tolls ${ARC.knell.tolls}× (${dmg(ARC.knell.tollMul)}, Dissonant), then ONE crit of ×(${ARC.knell.base} + ${ARC.knell.per}/active song) ATK, ${dmg(ARC.knell.splash)} within ${ARC.knell.splashR} px`,
    heavens_judgment: `one crit of ×(${F.heavens_judgment.base} + ${F.heavens_judgment.perStack}/Condemn, max ${F.heavens_judgment.maxStacks}) ATK: ${dmg(F.heavens_judgment.base)} → ${dmg(F.heavens_judgment.base + F.heavens_judgment.perStack * F.heavens_judgment.maxStacks)}; ${pct(F.heavens_judgment.heal)}% party heal + shield`,
  };
  for (const r of c.routes) rows.push([r.name, fin[r.id] || r.desc]);
  return rows;
}

/** Current ult fill rules (from ULT and the class multiplier). */
export function ultRules(cls) {
  const m = ULT.classMul[cls] ?? 1, n1 = (v) => +(+v).toFixed(1), name = CLASSES[cls].name;
  const x = (base) => (m === 1 ? `+${n1(base)}` : `+${n1(base * m)} (${n1(base)} × ${m} for ${name})`), h = ULT.hitMul[cls] ?? 1;
  return [
    `Land a chain combo's finisher: ${x(ULT.gain)} (repeating your last chain: ${pct(ULT.repeatMul)}%).`,
    `Rotation bonus: land ${ULT.rotationLen} different chains within ${sec(ULT.rotationWindow)} s while losing under ${pct(ULT.heavyDmg)}% max HP: ${x(ULT.rotationBonus)}. Repeating a chain doesn't count (it restarts the dots).`,
    `Other hits trickle in a little: +${n1(ULT.hitBasic * h)} per basic hit, +${n1(ULT.hitSkill * h)} per skill hit (max ${n1(ULT.hitPerSec * h)}/s).`,
    `The meter fades after ${sec(ULT.decayAfter)} s out of combat; a full meter never fades.`,
  ];
}

/**
 * Tooltip model for a HUD element: slot = 'basic' | 'Q' | 'E' | 'R' | 'F' | 'dodge' | 'ult' | 'ultbar'.
 * opts: { keyLabel(actionId), stepLabel(step), p (player, for live ATK / meter / rotation), tick }
 */
/** 'Evasive dash' row: the ability carries you as a dash and you are invulnerable while it does (sim/evade.js). */
export const EVASIVE_ROW = ['Evasive dash', `invulnerable while it carries you, like Dodge (i-frames through the dash + ${sec(EVADE.tail)} s); perfect-dodge effects stay on the real Dodge`];
export function slotTooltip(cls, slot, opts = {}) {
  const t = slotTooltip0(cls, slot, opts), c = CLASSES[cls];
  if (!t || !c) return t;
  const ev = slot === 'basic' ? !!(c.basic[0] && c.basic[0].melee) : slot === 'ult' ? !!(c.ult && c.ult.evade) : c.skills[slot] ? !!c.skills[slot].evade : false;
  if (ev && t.stats) t.stats.push(slot === 'basic' ? ['Evasive dash', 'the gap-closer dash is invulnerable, like Dodge'] : EVASIVE_ROW);
  return t;
}
function slotTooltip0(cls, slot, opts = {}) {
  const c = CLASSES[cls];
  if (!c) return null;
  const vars = tipVars(cls);
  const p = opts.p || null, atk = p && p.stats ? p.stats.atk : 0;
  const key = slot === 'ultbar' ? (opts.keyLabel ? opts.keyLabel('ult') : 'T') : opts.keyLabel ? opts.keyLabel(actionOf[slot]) : defaultKey[slot];
  const step = opts.stepLabel || ((s) => s);
  const withSeq = (list) => list.map((ch) => ({ ...ch, keys: ch.seq.map(step) }));
  if (slot === 'basic') {
    const names = c.basic.map((b) => b.name);
    const muls = c.basic.map((b) => num(b.mul));
    const reach = c.basic[0].melee ? `${Math.max(...c.basic.map((b) => b.range || 0))} px (melee)` : `${Math.max(...c.basic.map((b) => (b.proj ? b.proj.range : 0)))} px`;
    const stats = [['Hits', names.join(' → ')], ['Damage', muls.map((m) => '×' + m).join(' / ') + ' ATK' + (atk ? ` (≈${Math.round(c.basic[c.basic.length - 1].mul * atk)} finisher)` : '')], ['Reach', reach]];
    if (c.basic[0].melee) stats.push(['Gap-closer', `first hit dashes up to ${GAP.range} px`]);
    if (c.resOnBasicHit) stats.push([c.resource, `+${c.resOnBasicHit} per enemy hit`]);
    else if (c.resOnFinisher) stats.push(['Pips', `+${c.resOnFinisher} per finisher hit`]);
    else if (c.rageRules) stats.push(['Rage', `+${c.rageRules.basic} per basic hit, +${c.rageRules.skill} per skill hit (max ${c.rageRules.skillCap} per skill), up to +${c.rageRules.hurtCap} when hit, +${c.rageRules.chain} per named chain landed; drains ${c.rageRules.drain}/s after ${sec(c.rageRules.drainAfter)} s out of combat. Spend it with the last string hit ON THE BEAT or by HOLDING a skill (never automatic)`]);
    else if (c.inkRes) stats.push(['Ink', `+${c.ink.basic} per basic hit (max ${ARC.basicCap} a swing); the 3rd (Snap Shut) bursts in an ${c.basic[2].proj.explode} px rune`]);
    else if (c.tempoRes) stats.push(['Tempo', `+${c.tempo.basic} per basic hit (max ${ARC.basicCap} a swing); Encore: every note explodes`]);
    else if (c.bloodRes) stats.push(['Impaled', 'the 3rd hit (Lance Drive) pins (+1); basics give no Dragon Blood (only dives do)']);
    else if (c.chiRes) stats.push(['Hit counter', `every hit counts (resets after ${sec(c.combo.reset)} s without one); +${c.chi.hit} Chi per hit`]);
    else if (c.focusRes) stats.push(['Delayed Cuts', `each hit leaves 1 (×${num(c.cut.per)} ATK when you Sheathe); basics give no Focus`]);
    else if (c.gloryRes) stats.push(['Glory', `+${c.glory.basic} per basic hit; the combo swings the weapon you drew last (Q Greatsword / E Twin Axes / R Warhammer)`]);
    else if (c.resOnBasic) stats.push([c.resource, `+${c.resOnBasic} per basic hit (skill hits: +${c.resOnHit || 0})`]);
    else if (c.resOnHit) stats.push([c.resource, `+${c.resOnHit} per hit`]);
    stats.push(['Fallback', `${pct(SUSTAIN.basicDmg)}% damage: your backup for refilling when a chain breaks`]);
    { const h = hordeAoeText(cls); if (h) stats.push(['Horde AoE', h]); }
    return { slot, kind: 'Basic combo', title: `${c.name} combo`, key, desc: `Hold ${key} to attack; the combo auto-continues while held.`, how: fillTip(c.basicTip, vars), stats, chains: withSeq(chainsFor(cls, 'basic')) };
  }
  if (slot === 'dodge') {
    const D = dodgeOf(cls);
    const stats = [['Cost', D.cost ? `${D.cost} ${c.resource}` : 'free'], ['Cooldown', `${sec(D.dur + D.cd)} s`], ['I-frames', `${sec(D.iframes)} s`]];
    let how = 'Dodge through attacks: invulnerable during the roll, and it cancels attack recovery.';
    { const dl = DEF_TIPS[c.id]; if (dl) { stats.push(dl[0]); how += ' ' + dl[1]; } }
    if (c.perfectDodge) { stats.push(['Perfect dodge', `within ${sec(c.perfectDodge.window)} s of a hit: next hit crits, +${c.perfectDodge.refund} pips`]); how += ' Ninja: dodge right as a hit lands for a perfect dodge (next hit crits, pips back; extends Eclipse once).'; }
    return { slot, kind: 'Dodge', title: 'Dodge', key, desc: 'Quick roll in your movement direction (or toward the aim if standing still).', how, stats, chains: [] };
  }
  if (slot === 'ult' || slot === 'ultbar') {
    const u = c.ult;
    const meter = p ? Math.floor(p.ult || 0) : null;
    const rot = p && p.ultRot ? p.ultRot.ids.map((id) => (c.chains.find((ch) => ch.id === id) || { name: id }).name) : [];
    const rotLeft = p && p.ultRot && p.ultRot.ids.length && opts.tick != null ? Math.max(0, sec(ULT.rotationWindow - (opts.tick - p.ultRot.start))) : null;
    const state = [];
    if (meter != null) state.push(meter >= ULT.max ? `READY: press ${key}` : `Meter ${meter}%`);
    if (p) state.push(`Rotation ${rot.length}/${ULT.rotationLen}` + (rot.length ? `: ${rot.join(', ')}` + (rotLeft != null ? ` (${rotLeft.toFixed(1)} s left)` : '') : ''));
    if (slot === 'ultbar') {
      return { slot, kind: 'Ultimate meter', title: `Ultimate meter: ${u.name}`, key, desc: `Fills from landing chain combos. Full = press ${key} for ${u.name}. The ${ULT.rotationLen} dots show chains landed in the current rotation.${(c.routes || []).length ? ` Finisher routes in the ult window: ${c.routes.map((r) => r.name).join(' (packs) and ')} (bosses).` : ''}`, how: '', rules: ultRules(cls), state, stats: c.trinity ? [['Trinity', `each Trinity adds +${c.trinity.ult} (Greatsword, Twin Axes and Warhammer hits in one rotation), on top of the chain credit`]] : [], chains: withSeq((c.chains || []).map((ch) => ({ id: ch.id, name: ch.name, seq: ch.seq, role: '', desc: ch.desc }))) };
    }
    const routes = (c.routes || []).map((r) => ({ id: r.id, evade: !!r.evade, name: r.name, seq: r.seq, role: r.route === 'mob' ? 'vs packs' : 'vs bosses', desc: r.desc, keys: [key, ...(r.disp || r.seq).map(step)] })); // Eclipse finisher routes
    return { slot, kind: 'Ultimate', title: u.name, key, desc: u.desc, how: fillTip(u.tip, vars), stats: [['Needs', `a full meter (${ULT.max})`], ...ultStats(cls, atk), ...windowStats(cls, atk)], rules: ultRules(cls).slice(0, 2), state, chains: routes, chainsTitle: routes.length ? `Finisher routes (during ${u.id === 'eclipse' ? 'Eclipse' : `the ${u.name} window`})` : null };
  }
  if ((c.inkRes && slot === 'ink') || (c.tempoRes && slot === 'tempo')) { // Summoner Ink / Bard Tempo bar
    const K = c.inkRes ? c.ink : c.tempo, ink = !!c.inkRes;
    return { slot, kind: 'Resource', title: ink ? 'Ink' : 'Tempo', key: '', desc: ink ? 'Written by summoning: every skill, chain and basic hit adds Ink. Skills are free. A FULL book = INSCRIBED: the next summon is empowered (×' + ARC.insc + ') and the Inscribed chains (Storm Front, Tri-Element Burst) unlock and spend it all for ×' + ARC.spend + ' damage.' : 'Built by playing: every skill, chain and basic hit adds Tempo. Skills are free. FULL Tempo = IN TUNE: songs play ×' + ARC.songs.tune + ' stronger and the In Tune chains (Sour Note, Discord Ballad) unlock and spend it all for ×' + ARC.spend + ' damage.', how: ink ? inkText(c) : tempoText(c), stats: [['Per skill', `+${K.cast}`], ['Per chain', `+${K.chain}`], ['Per basic hit', `+${K.basic} (max ${K.basicCap} a swing)`], ['Drain', `after ${sec(K.drainAfter)} s out of combat`]], chains: [] };
  }
  if (c.bloodRes && (slot === 'blood' || slot === 'impaled')) { // Dragoon: the Dragon Blood bar / Impaled pins
    const K = c.blood;
    if (slot === 'blood') return { slot, kind: 'Resource', title: 'Dragon Blood', key: '', desc: 'Built ONLY by landing dives (Jump landings, Dragon Dive, Nosedive hops, High Jump, Geirskogul, Spineshatter, Crimson Comet). Skills are free. The four Skyborne chains spend ALL of it; both ult finishers scale with it without spending it.', how: bloodText(c), stats: [['Per dive hit', `+${K.dive} (max ${K.diveCap} a move)`], ['Spend', `Skyborne chains: up to ×${1 + K.spendMax}`], ['Finishers', `up to ×${1 + K.finMax} (kept)`], ['Dragon Form', `+${K.ult} at once, ×${K.ultMul} gain`], ['Drain', `after ${sec(K.drainAfter)} s out of combat`]], chains: [] };
    return { slot, kind: 'Stacks', title: 'Impaled', key: '', desc: c.stack.desc, how: 'Pin first (Piercing Thrust, Impale Rush, Whirling Lance, Dragonfang Lance, the 3rd basic), then DIVE: every dive rips the pins out. Spineshatter bursts them at ×1.6, Nidhogg\'s Fall adds +1 ATK per pin.', stats: [['Per pin', `×${num(DRG.pin.per)} ATK when a dive rips it out`], ['Max', `${c.stack.max} (bosses ${c.stack.bossMax})`], ['Lasts', '8 s']], chains: [] };
  }
  if (c.chiRes && (slot === 'chi' || slot === 'combo' || slot === 'pp')) { // Monk: the Chi bar / the hit counter / Pressure Points
    const K = c.chi, B = c.combo, M = p && p.monk;
    if (slot === 'chi') return { slot, kind: 'Resource', title: 'Chi', key: '', desc: 'Grows with every hit you land (faster at a higher hit-counter tier) and every Flow dodge; skills are free. Hundred Hands Rush and Seven Seals spend ALL of it; both ult finishers scale with it without spending it.', how: chiText(c), stats: [['Chi chains', `×1 → ×${1 + K.spendMax} damage at 100 Chi`], ['Per hit', `+${K.hit} / +${num(K.hit * K.tierMul[1])} / +${num(K.hit * K.tierMul[2])} by tier (max ${K.hitCap} a skill)`], ['Flow dodge', `+${K.dodge}`], ['Ult', `+${K.ult}, ×${K.ultMul} gain`]], chains: [] };
    if (slot === 'combo') return { slot, kind: 'Hit counter', title: `Hit counter${M ? `: ${M.hc}` : ''}`, key: '', desc: `Every landed hit adds 1 (max ${B.perTick} per moment, so one big AoE doesn't jump it). It resets after ${sec(B.reset)} s without landing a hit.`, how: `Keep hitting: at ${B.tiers[0]} hits (${B.names[1]}) and ${B.tiers[1]} hits (${B.names[2]}) EVERY chain evolves: more hits, bigger areas, ×${MONK.tierMul[1]} / ×${MONK.tierMul[2]} damage and new looks. Awakened Spirit holds it at the top tier.`, stats: [['Tiers', `${B.names[0]} 0+ · ${B.names[1]} ${B.tiers[0]}+ · ${B.names[2]} ${B.tiers[1]}+`], ['Reset', `${sec(B.reset)} s without a hit`]], chains: [] };
    return { slot, kind: 'Stacks', title: 'Pressure Points', key: '', desc: c.stack.desc, how: 'Stack them with Rapid Strikes (every jab counts double) and Nerve Strike, then pop them with Shockwave Palm, Rising Dragon or Seven Seals (double value), or save them for Heaven-Splitting Palm.', stats: [['Plant', `1 per ${c.pp.every} hits on the same target`], ['Pop', `×${num(c.pp.per)} ATK each`], ['Max', `${c.stack.max} (bosses ${c.stack.bossMax})`]], chains: [] };
  }
  if (c.focusRes && (slot === 'focus' || slot === 'cuts')) { // Samurai: the Focus bar / the Delayed Cuts counter
    const F = c.focus;
    if (slot === 'focus') return { slot, kind: 'Resource', title: 'Focus', key: '', desc: 'Built in Stillness and by perfect parries (skills are free). Petal Rain and Moment of Death spend ALL of it; both ult finishers scale with it without spending it.', how: focusText(c), stats: [['Focus chains', `×1 → ×${1 + F.spendMax} damage at 100 Focus`], ['Finishers', `+0 → +${pct(F.finMax)}% damage at 100 Focus (kept)`], ['Drains', `after ${sec(F.drainAfter)} s out of combat`]], chains: withSeq(c.chains.filter((ch) => ch.id === 'petal_rain' || ch.id === 'moment_of_death').map((ch) => ({ ...ch, role: 'spends Focus' }))) };
    return { slot, kind: 'Stacks', title: 'Delayed Cuts', key: '', desc: c.stack.desc, how: 'Cut everything first (Iaido, Wind Step, Twin Moons, basics), then Sheathe: every cut bursts at once. Counter Sheathe doubles it.', stats: [['Per cut', `×${num(c.cut.per)} ATK on the sheathe`], ['Max', `${c.stack.max} (bosses ${c.stack.bossMax}), 8 s`]], chains: [] };
  }
  if (c.gloryRes && (slot === 'glory' || slot === 'trinity')) { // Warrior: the Glory bar / the Weapon Trinity tracker
    const G = c.glory, T = c.trinity;
    if (slot === 'glory') return { slot, kind: 'Resource', title: 'Glory', key: '', desc: "Built by fighting (skills are free). Warlord's Rally and Executioner's Verdict spend ALL of it; both ult finishers scale with it without spending it.", how: gloryText(c), stats: [['Glory chains', `×1 → ×${1 + (G.spendMax || 1)} damage at 100 Glory`], ['Finishers', '+0 → +120% damage at 100 Glory (kept)'], ['Drains', `after ${sec(G.drainAfter)} s out of combat`]], chains: withSeq(c.chains.filter((ch) => ch.id === 'warlords_rally' || ch.id === 'executioners_verdict').map((ch) => ({ ...ch, role: 'spends Glory' }))) };
    return { slot, kind: 'Weapon Trinity', title: 'Trinity', key: '', desc: 'Land hits with all three weapons (Greatsword, Twin Axes, Warhammer) in one rotation, each within ' + sec(T.gap) + ' s of the last.', how: 'Any chain that ends on the third weapon completes it, e.g. Greatsword → Twin Axes (Shatterstep) → Warhammer (Rupture Smash).', stats: [['Payoff', `+${G.trinity} Glory, every cooldown −${pct(T.cdCut)}%, heal ${pct(0.04)}%, +${T.ult} ult meter`], ['Trinity Surge', `${sec(T.surge)} s: +${pct(T.surgeMul - 1)}% damage`], ['Cooldown', `${sec(T.trinityCd)} s between Trinities`]], chains: [] };
  }
  if (slot === 'SP' && c.skills.SP) { // the SPECIAL (4th slot): stronger than Q/E/R, weaker than the ult, long cooldown
    const sp = c.skills.SP, live = p && p.spx && p.spx.t > 0 ? p.spx : null;
    const state = live ? [live.id === 'shadow_clone' ? `Clones active: ${live.n} chain${live.n === 1 ? '' : 's'} left to copy` : `Active: ${sec(live.t)} s left`] : [];
    const B = BR_CLS[cls], spc = spChainOf(cls);
    if (B && spc) state.push(p && p.br && p.br.win > 0 ? `${B.win}: ${sec(p.br.win)} s (chains bank ×2)` : `${B.unit} banked: ${p && p.br ? p.br.bank : 0}`);
    const boss = B && spc ? ` BOSS CYCLE: near a boss every chain finisher banks ${B.unit} (longer chains bank more; banking also fills the ult meter). ${spc.name} is the hinge (${BR.cd} s cooldown near a boss, about one per 20 s): the Special releases the bank in ${BR.waves} waves, the finisher releases the rest and opens ${B.win} (${sec(BR.win)} s, chains bank ×2). Cast your ultimate inside ${B.win}: when it ends the whole bank releases ×${BR.ultMul}${B.hold ? `; with the ult ready, ${spc.name} banks (+${BR.spBank}) instead of releasing so the ultimate gets it all` : ''}.` : '';
    return { slot, kind: 'SPECIAL skill', title: sp.name, key, desc: sp.desc, how: sp.tip + boss, state, stats: specialStats(cls, atk), chains: withSeq(chainsFor(cls, 'SP')), chainsTitle: 'Special chains (the Special, then…)' };
  }
  const sk = c.skills[slot];
  if (!sk) return null;
  return { slot, kind: `Skill (${slot === 'F' ? '4th' : slot} slot)`, title: sk.name, key, desc: sk.desc, how: fillTip(sk.tip, c.grim || c.bard ? { ...vars, ...(sk.stats || {}), healPct: pct((sk.stats || {}).heal || 0), hatk: (sk.stats || {}).atk, vulnPct: pct((sk.stats || {}).vuln || 0) } : vars), stats: [...skillStats(cls, slot, atk), ...(c.rageRules ? [] : [['Sustain', sustainShort(cls)]]), ...(hordeAoeText(cls) ? [['Horde AoE', hordeAoeText(cls)]] : [])], chains: withSeq(chainsFor(cls, slot)) };
}

/** HTML for a tooltip model (all text escaped). */
export function tooltipHTML(t) {
  if (!t) return '';
  let h = `<div class="tt-head"><span class="tt-title">${esc(t.title)}</span><span class="tt-key">${esc(t.key)}</span></div><div class="tt-kind">${esc(t.kind)}</div>`;
  if (t.desc) h += `<div class="tt-desc">${esc(t.desc)}</div>`;
  if (t.how) h += `<div class="tt-how"><b>How to use:</b> ${esc(t.how)}</div>`;
  if (t.state && t.state.length) h += `<div class="tt-state">${t.state.map(esc).join(' · ')}</div>`;
  if (t.stats && t.stats.length) h += `<table class="tt-stats">${t.stats.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>`;
  if (t.rules && t.rules.length) h += `<ul class="tt-rules">${t.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`;
  if (t.chains && t.chains.length) {
    h += `<div class="tt-sub">${esc(t.chainsTitle || (t.slot === 'ultbar' ? 'Your chains' : 'Chain combos'))}</div>`;
    h += t.chains.map((ch) => `<div class="tt-chain"><span class="tt-seq">${ch.keys.map(esc).join(' › ')}</span> ${ch.tier ? `<span class="tt-tier">${ch.five ? '★ 5-step' : ch.tier + '-step'}</span> ` : ''}<b>${esc(ch.name)}</b>${ch.evade ? ' <span class="tt-evade">· Evasive dash</span>' : ''}${ch.role ? ` <i>(${ch.role})</i>` : ''}<div class="tt-cdesc">${esc(ch.desc)}</div></div>`).join('');
  }
  return h;
}
