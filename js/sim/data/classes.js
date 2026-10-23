// Class definitions: pure data consumed by sim/player.js (logic) and the client (UI text).
// skills[k].stats holds the base numbers the sim reads (damage multiplier `mul`, radius `r`, cast `range` in px,
// durations in ticks), so tooltips can show them and stay in sync with balance changes.
// Durations are in ticks (60/s). `hit` = tick the blow lands, `cancel` = tick after which the
// move can be cancelled into another basic/skill/dodge (animation-cancel combos, BDO style).
import { SPECIAL_KIT, SPK } from './specials-data.js';
const S = 60;

export const CLASSES = {
  warrior: {
    guardDodge: { window: 9, ttl: 0 }, // Iron Rebuke (sim/defense.js): a perfect-timed dodge braces a shield
    id: 'warrior', name: 'Warrior', weapon: 'sword', resource: 'Glory', resColor: '#ffc93b',
    color: '#ff6b4a',
    blurb: 'Weapon Master and Warlord. Q swings the Greatsword (wide cleaves for packs), E the Twin Axes (fast flurries that stack Bleed), R the Warhammer (stuns and boss breaks; it also opens Warpath). Chain the weapons into each other for named chains, land all three weapons in one rotation for a TRINITY, and let War Cry, Rally and Challenge ring out as chain payoffs.',
    base: { maxHp: 230, maxRes: 100, atk: 20, def: 10, spd: 1, crit: 0.08, critDmg: 1.6, hpRegen: 2, resRegen: 0 },
    growth: { maxHp: 30, atk: 3.3, def: 2.4, crit: 0.002, hpRegen: 0.25 },
    // Weapon Master (sim/warrior.js). Each skill draws its weapon (the basic combo swings the drawn weapon). Glory (the resource):
    // starts empty, built by fighting, drains out of combat; the two Warpath 3-step chains and the finishers spend ALL of it.
    arms: true, gloryRes: true, resOnHit: 0, resOnBasic: 0,
    glory: { basic: 1, skill: 1, skillCap: 3, chain: 6, second: 4, trinity: 25, mark: 2, markCap: 4, ally: 1, hurt: 2, drainAfter: 300, drain: 6, spendMax: 1.0 },
    // Trinity tracker: hits with gaps under `gap` ticks are one rotation; landing hits with all 3 weapons = TRINITY.
    trinity: { gap: 180, surge: 300, surgeMul: 1.2, cdCut: 0.4, trinityCd: 150, ult: 12 },
    weaponOrder: ['G', 'A', 'H'],
    weapons: {
      G: { id: 'greatsword', name: 'Greatsword', short: 'GS', key: 'Q', color: '#5ec8ff', role: 'mob clearing',
        basic: [
          { name: 'Sweep', melee: true, mul: 1.1, dur: 22, hit: 9, cancel: 13, range: 102, arc: 2.8, kb: 170, lunge: 120, hitstop: 4 },
          { name: 'Backsweep', melee: true, mul: 1.2, dur: 22, hit: 9, cancel: 13, range: 102, arc: 2.8, kb: 170, lunge: 120, hitstop: 4 },
          { name: 'Overhead Cleave', melee: true, mul: 2.0, dur: 32, hit: 14, cancel: 20, range: 122, arc: 3.4, kb: 420, stagger: 22, lunge: 200, hitstop: 8, heavy: true },
        ] },
      A: { id: 'axes', name: 'Twin Axes', short: 'AX', key: 'E', color: '#ff4d5e', role: 'Bleed stacking',
        basic: [
          { name: 'Chop', melee: true, mul: 0.7, dur: 13, hit: 5, cancel: 8, range: 84, arc: 2.0, kb: 60, lunge: 100, hitstop: 2 },
          { name: 'Chop', melee: true, mul: 0.75, dur: 13, hit: 5, cancel: 8, range: 84, arc: 2.0, kb: 60, lunge: 100, hitstop: 2 },
          { name: 'Double Rend', melee: true, mul: 1.35, dur: 22, hit: 8, cancel: 13, range: 92, arc: 2.6, kb: 260, stagger: 16, lunge: 170, hitstop: 5, heavy: true },
        ] },
      H: { id: 'hammer', name: 'Warhammer', short: 'HM', key: 'R', color: '#ffb52e', role: 'boss breaking',
        basic: [
          { name: 'Hammer Swing', melee: true, mul: 1.5, dur: 28, hit: 12, cancel: 18, range: 94, arc: 2.2, kb: 220, lunge: 120, hitstop: 5, poise: 4 },
          { name: 'Backswing', melee: true, mul: 1.6, dur: 28, hit: 12, cancel: 18, range: 94, arc: 2.2, kb: 220, lunge: 120, hitstop: 5, poise: 4 },
          { name: 'Crushing Blow', melee: true, mul: 2.8, dur: 40, hit: 18, cancel: 26, range: 104, arc: 1.7, kb: 380, stagger: 40, lunge: 200, hitstop: 10, heavy: true, poise: 12 },
        ] },
    },
    dodge: { cost: 0 },
    basicTip: 'Hold to keep swinging the weapon you drew last (Greatsword: wide sweeps, Twin Axes: fast chops that Bleed, Warhammer: slow crushing blows). The 3rd swing staggers. The first swing dashes to a target up to {gapRange} px away. Every hit builds Glory and counts toward the Trinity.',
    basic: null, // (set below: the Greatsword combo; the sim swings the drawn weapon's combo, all three are 3 hits)
    skills: {
      Q: { id: 'gs_cleave', name: 'Sweeping Cleave', weaponName: 'Greatsword', w: 'G', cd: 3, cost: 0, stats: { mul: 1.9, r: 155, arc: 5.2, hitT: 9, dur: 24, cancel: 15 },
        tip: 'Draw the Greatsword and cleave almost all the way around you. After Twin Axes it becomes Cyclone Cleave (War Cry); after Arsenal Toss it becomes Riftcleave (through the planted weapon).', desc: 'A huge 300° cleave: ×1.9 ATK within 155 px, big knockback.' },
      E: { id: 'ax_flurry', name: 'Rending Flurry', weaponName: 'Twin Axes', w: 'A', cd: 3.5, cost: 0, stats: { mul: 0.55, r: 120, arc: 2.4, hits: 5, every: 5, bleed: 1, step: 70 },
        tip: 'Draw the Twin Axes: 5 lightning cuts, each adds 1 Bleed. Then Greatsword = Cyclone Cleave (War Cry), Arsenal Toss = Reaver\'s Return (bursts the Bleed).', desc: 'A 5-hit flurry (×0.55 ATK each, 120 px cone) stepping forward, +1 Bleed per hit.' },
      R: { id: 'hm_skull', name: 'Skullcrusher', weaponName: 'Warhammer', w: 'H', cd: 5, cost: 0, stats: { mul: 2.8, r: 115, arc: 1.4, stun: 50, poise: 30, hitT: 16, dur: 34, cancel: 22 },
        tip: 'Draw the Warhammer: a crushing overhead that stuns and breaks boss posture, then WARPATH for 2 s: Greatsword = Seismic Arc, Twin Axes = Thunder Hurl (Challenge); keep going for Warlord\'s Rally or Executioner\'s Verdict.', desc: 'Overhead smash in front of you: ×2.8 ATK, 0.8 s stun, +30 boss posture damage. Opens Warpath (2 s).' },
      F: { id: 'arsenal_toss', name: 'Arsenal Toss', cd: 6, cost: 0, stats: { range: 380, fly: 12, r: 95, mul: 1.3, life: 360, recall: 1.5, rw: 90, cleave: 0.6, cleaveR: 165, cleaveEvery: 60, quake: 1.0, quakeR: 215, quakeEvery: 90, bleedR: 150, bleedEvery: 40 },
        tip: 'Hurl your last-drawn weapon to your aim: it lands with a hit and stays PLANTED for 6 s, working ON ITS OWN. Planted Greatsword: a spectral cleave around it every second. Planted Twin Axes: a Bleed aura (+1 Bleed on everything near it every 0.67 s). Planted Warhammer: a quake every 1.5 s. Press the skill again to RECALL it: it flies back in an arc hitting everything on its path (counts as that weapon for the Trinity). Toss → Greatsword = Riftcleave; Toss → Warhammer → Recall = Earthshatter Recall; Twin Axes → Toss = Reaver\'s Return.', desc: 'Throw the drawn weapon up to 380 px (×1.3 ATK, 95 px). Planted 6 s and it acts by itself: Greatsword = a ×0.6 cleave (165 px) every 1 s, Axes = Bleed aura (150 px), Hammer = a ×1.0 quake (215 px) every 1.5 s. G again: recall arc (×1.5 ATK on the path).' },
    },
    ult: { id: 'warlord', name: "Warlord's Trinity", tip: 'Leap in with all three weapons, then for 10 s skills cool down 3× faster and the next route step is ready at once. Finish with a route (shown on screen): Crimson Tempest for packs, Titanfall Execution for bosses. Both scale with your Glory (kept) for extra damage. Basic attacks between steps are fine; a wrong skill breaks a route.',
      desc: "Leap to the target point and slam with all three weapons (×4 ATK, 220 px, knock-up, +60 Glory). For 10 s after casting, skills cool down 3× faster. Two finisher routes end it: Warhammer → Seismic Arc → Warlord's Rally → Greatsword → Twin Axes = Crimson Tempest (mobs); Warhammer → Thunder Hurl → Executioner's Verdict → Twin Axes → Warhammer = Titanfall Execution (bosses)." },
    state: { id: 'warpath', name: 'Warpath', dur: 120, color: '#ffb52e', on: 'hm_skull',
      desc: "The Warhammer (Skullcrusher, Skyfall Slam, Rupture Smash) opens 2 s of Warpath: the next skill transforms (Greatsword = Seismic Arc → Warlord's Rally, Twin Axes = Thunder Hurl → Executioner's Verdict).",
      steps: { base: { Q: { chain: 'seismic_arc', to: 'arc' }, E: { chain: 'thunder_hurl', to: 'hurl' } }, arc: { E: { chain: 'warlords_rally' } }, hurl: { Q: { chain: 'executioners_verdict' } } } },
    stack: { id: 'bleed', name: 'Bleed', max: 8, bossMax: 12, desc: 'Twin Axes hits (basics, Rending Flurry and the axe chains) add Bleed: every 0.5 s a bleeding enemy takes ×0.12 ATK per stack (max 8, bosses 12). Rupture Smash bursts it, Executioner\'s Verdict and the finishers use it up.' },
    chains: [
      { id: 'rift_cleave', name: 'Riftcleave', kind: 'mob', seq: ['F', 'Q'], window: 110, w: 'G', desc: 'Arsenal Toss → Greatsword: dash through to the planted weapon (or your aim) cutting the line (×1.0 ATK), then a 360° rift cleave around it (×1.8 ATK, 200 px, big knockback). A planted Greatsword adds its free cleave on top.' },
      { id: 'cyclone_cleave', name: 'Cyclone Cleave', kind: 'mob', seq: ['E', 'Q'], window: 90, desc: 'Twin Axes → Greatsword: WAR CRY + a spinning 360° cleave. Everything within 360 px is dragged in and taunted for 3 s (×0.9 ATK twice, 185 px), and you take 30% less damage for 4 s.' },
      { id: 'reavers_return', name: "Reaver's Return", kind: 'mob', seq: ['R', 'Q', 'E', 'F'], window: 140, w: 'A', desc: "Warlord's Rally (Warhammer → Greatsword → Twin Axes) → Arsenal Toss: the axes are hurled as a spinning reaver onto your target (3 hits × 0.7 ATK, +1 Bleed each), then boomerang back through it and RUPTURE every Bleed stack they pass (×0.35 ATK per stack, the Bleed stays)." },
      { id: 'earthshatter_recall', name: 'Earthshatter Recall', kind: 'boss', seq: ['F', 'R', 'F'], window: 130, desc: 'Arsenal Toss → Warhammer → Arsenal Toss: the planted weapon erupts in a quake (×2.4 ATK, 220 px, long stun, heavy posture damage), then rips back to your hand in a recall arc (×2.0 ATK on the path).' },
      // Warpath chains: a skill cast in the 2 s Warpath after a Warhammer skill transforms
      { id: 'seismic_arc', name: 'Seismic Arc', kind: 'mob', seq: ['R', 'Q'], window: 120, state: 'warpath', desc: 'Warhammer → Greatsword (in Warpath): an upward cleave (×2.2 ATK, 230 px, 155° wide) that launches everything in front.' },
      { id: 'thunder_hurl', name: 'Thunder Hurl', kind: 'boss', seq: ['R', 'E'], window: 120, state: 'warpath', desc: 'Warhammer → Twin Axes (in Warpath): hurl the hammer 380 px down your aim (×1.8 ATK, stun, +2 Bleed) and CHALLENGE the boss / elite it hits (else the toughest one hit): for 8 s it takes +20% damage from you and your allies, and every hit on it feeds you Glory.' },
      { id: 'warlords_rally', name: "Warlord's Rally", kind: 'mob', seq: ['R', 'Q', 'E'], window: 120, state: 'warpath', from: 'arc', desc: "Warhammer → Seismic Arc → Twin Axes (in Warpath): a 1 s axe whirlwind that drags the pack in (8 hits of ×0.6 ATK in 170 px, +1 Bleed each), ending in a RALLY: you and allies within 480 px get +20% damage, +20% move speed and +15% defense for 6 s and heal 8%. Spends ALL your Glory: up to ×2 damage." },
      { id: 'executioners_verdict', name: "Executioner's Verdict", kind: 'boss', seq: ['R', 'E', 'Q'], window: 120, state: 'warpath', from: 'hurl', desc: "Warhammer → Thunder Hurl → Greatsword (in Warpath): leap onto your target (the Challenged one first) and impale it: ONE guaranteed crit of ×(3 + 0.4 per Bleed stack, +2 if it is stunned or Challenged) ATK. Uses up its Bleed. Spends ALL your Glory: up to ×2 damage." },
    ],
    // Ult-window finisher routes (like the Blade Dancer's Eclipse routes): `chains` = the chain each step plays; the last step is the finisher.
    routes: [
      { id: 'crimson_tempest', name: 'Crimson Tempest', route: 'mob', seq: ['R', 'Q', 'E', 'Q', 'E'], chains: [null, 'seismic_arc', 'warlords_rally', null, 'crimson_tempest'],
        desc: "Warlord's Trinity → Warhammer → Seismic Arc → Warlord's Rally → Greatsword → Twin Axes: an axe cyclone drags every enemy within 480 px in (Bleed each hit), three greatsword crescents roll out, then the hammer drops from the sky in a 600 px quake that detonates all Bleed. Scales with your Glory (up to +120% damage at 100; the Glory is kept). Ends the window." },
      { id: 'titanfall', name: 'Titanfall Execution', route: 'boss', seq: ['R', 'E', 'Q', 'E', 'R'], chains: [null, 'thunder_hurl', 'executioners_verdict', null, 'titanfall'],
        desc: "Warlord's Trinity → Warhammer → Thunder Hurl → Executioner's Verdict → Twin Axes → Warhammer: an axe flurry on your target (Bleed), a greatsword impale, then you leap into the sky and bring the hammer down for ONE guaranteed crit of ×(8 + 0.5 per Bleed stack, +3 if it is stunned / broken / Challenged). Scales with your Glory (up to +120% damage at 100; the Glory is kept). Ends the window." },
    ],
  },
  ranger: {
    id: 'ranger', name: 'Ranger', weapon: 'bow', resource: 'Energy', resColor: '#7cf07a',
    color: '#4fd06a',
    blurb: 'Nimble archer. Rapid shots, evasive dash-shots, piercing arrows and arrow rain.',
    base: { maxHp: 185, maxRes: 100, atk: 18, def: 6, spd: 1.06, crit: 0.12, critDmg: 1.7, hpRegen: 1.6, resRegen: 5 },
    growth: { maxHp: 23, maxRes: 2, atk: 3.1, def: 1.6, crit: 0.003, hpRegen: 0.2 },
    resOnHit: 0, resOnBasic: 3.5,
    basicTip: "Hold to keep firing; the 3rd shot fires 3 arrows. Piercing Arrow right after it = Rapid Finale. Basic hits restore {basicRes} Energy each (skill hits don't).",
    basic: [
      { name: 'Quick Shot', mul: 0.8, dur: 11, hit: 3, cancel: 7, proj: { speed: 780, range: 560, r: 6, style: 'arrow' }, kb: 60, hitstop: 2 },
      { name: 'Quick Shot', mul: 0.8, dur: 11, hit: 3, cancel: 7, proj: { speed: 780, range: 560, r: 6, style: 'arrow' }, kb: 60, hitstop: 2 },
      { name: 'Triple Shot', mul: 0.7, dur: 18, hit: 4, cancel: 11, count: 3, spread: 0.2, proj: { speed: 820, range: 580, r: 6, style: 'arrow' }, kb: 180, stagger: 10, hitstop: 4, heavy: true },
    ],
    skills: {
      Q: { id: 'dashshot', name: 'Dash Shot', cd: 1, cost: 10, stats: { mul: 2.1 }, tip: "Escape with i-frames while hitting back. Follow with Arrow Volley for an instant, stronger volley (Evasive Barrage).", desc: 'Backflip away (i-frames) while firing a heavy arrow.' },
      E: { id: 'pierce', name: 'Piercing Arrow', cd: 1, cost: 14, stats: { mul: 2.6 }, tip: "Line enemies up. Strongest right after the 3rd basic shot (Rapid Finale) or on a trapped enemy (Hunter's Mark: 3 arrows that crit rooted targets).", desc: 'A charged arrow that pierces every enemy in a line.' },
      R: { id: 'volley', name: 'Arrow Volley', cd: 2, cost: 18, stats: { mul: 0.68, r: 115, range: 430, pulses: 7, every: 8, slowMul: 0.5 }, tip: "Aim at packs or a boss; everything inside is slowed. Right after Dash Shot it lands instantly (Evasive Barrage).", desc: 'Rain arrows at the cursor: repeated hits + slow.' },
      F: { id: 'trap', name: 'Snare Trap', cd: 1.5, cost: 10, stats: { mul: 1.6, r: 85, range: 170, root: 100, life: 1200 }, tip: "Drop it in a chaser's path (max 2 traps). Then Piercing Arrow the rooted enemy (Hunter's Mark).", desc: 'Place a trap that roots and damages the first enemy to step on it.' },
    },
    ult: { id: 'arrowstorm', name: 'Arrow Storm', tip: "Cast it on a pack or a boss, then keep shooting: the storm keeps them slowed while you kite. Then finish with a route (shown on screen): Skyfall for packs, Heaven's Arrow for bosses (Quarry powers it). Basic attacks between steps are fine; a wrong skill breaks a route.", desc: 'Arrows rain on a large area for 4s (damage + slow). You keep fighting normally. For 10s after casting, skills are free and cool down 3× faster. Two finisher routes end it: Dash Shot → Evasive Barrage → Storm Lance → Dash Shot → Volley = Skyfall (mobs); Trap → Hunter\'s Mark → Trap → Hunter\'s Mark → Dash Shot = Heaven\'s Arrow (bosses).' },
    state: { id: 'focus', name: 'Focus', dur: 120, color: '#9dffb0', on: 'dashshot',
      desc: 'Dash Shot grants 2 s of Focus: skills cast during it transform (Volley = Evasive Barrage → Storm Lance, Piercing Arrow = Hawkstorm).',
      steps: { base: { R: { chain: 'evasive_barrage', to: 'barrage' }, E: { chain: 'hawkstorm' } }, barrage: { E: { chain: 'storm_lance' } } } },
    stack: { id: 'quarry', name: 'Quarry', max: 5, bossMax: 10, desc: "Your arrows add Quarry to rooted or trapped enemies; each Hunter's Mark arrow adds 1 on anything (max 5, bosses 10). Each stack: +3% damage from you. Deadeye and Heaven's Arrow use it up." },
    chains: [
      { id: 'evasive_barrage', name: 'Evasive Barrage', kind: 'mob', seq: ['Q', 'R'], window: 80, desc: 'Dash Shot → Volley: volley lands instantly with +40% damage.' },
      { id: 'rapid_finale', name: 'Rapid Finale', kind: 'boss', seq: ['B3', 'E'], window: 50, desc: 'Triple Shot (3rd) → Piercing Arrow: +50% damage and knockdown.' },
      { id: 'hunters_mark', name: "Hunter's Mark", kind: 'boss', seq: ['Q', 'E', 'F', 'E'], window: 200, desc: 'Hawkstorm (Dash Shot → Piercing Arrow) → Snare Trap → Piercing Arrow: fires 3 piercing arrows; crits vs rooted.' },
      { id: 'deadeye', name: 'Deadeye', kind: 'boss', seq: ['F', 'E', 'Q'], window: 240, cond: 'quarry', desc: "Trap → Hunter's Mark (builds Quarry) → Dash Shot on an enemy with your Quarry: flip back and fire ONE sniper round at the most-Quarried enemy: guaranteed crit, ×(3 + 1.2 per Quarry stack) ATK, pierces. Uses up its Quarry." },
      // Focus chains: a skill cast during the 2 s Focus state after Dash Shot transforms
      { id: 'storm_lance', name: 'Storm Lance', kind: 'mob', seq: ['Q', 'R', 'E'], window: 120, state: 'focus', from: 'barrage', desc: 'Dash Shot → Evasive Barrage → Piercing Arrow (in Focus): a lightning arrow flies into your volley zone and splits into a new arrow for EVERY enemy inside (max 12), each ×1.9 ATK and piercing.' },
      { id: 'hawkstorm', name: 'Hawkstorm', kind: 'boss', seq: ['Q', 'E'], window: 120, state: 'focus', desc: 'Dash Shot → Piercing Arrow (in Focus): you whistle and 8 spectral hawks dive out of the sky onto enemies around your aim (300 px), each ×1.0 ATK in a 60 px burst and +1 Quarry. They spread over the pack, or all hit a lone boss.' },
      { id: 'snare_web', name: 'Snare Web', kind: 'mob', seq: ['F', 'R'], window: 180, desc: 'Snare Trap → Arrow Volley: the volley lands as a net: 0.25 s later a web bursts (190 px) that roots EVERY enemy inside for 2 s (×0.8 ATK), and each of your placed traps detonates into its own web (150 px, ×1.6 ATK). Rooted enemies take Quarry from your arrows. The volley still rains (+20%).' },
      { id: 'ricochet', name: 'Ricochet', kind: 'mob', seq: ['E', 'R', 'E'], window: 120, desc: 'Piercing Arrow → Arrow Volley → Piercing Arrow: one glowing arrow that ricochets up to 8 times, always jumping to the enemy with the most Quarry (then the nearest) within 420 px: each hit ×(1.5 + 0.25 per Quarry stack) ATK (crits at 2+ stacks) and +1 Quarry. A lone target is hit up to 3 times.' },
    ],
    routes: [
      { id: 'skyfall', name: 'Skyfall', route: 'mob', seq: ['Q', 'R', 'E', 'Q', 'R'], chains: [null, 'evasive_barrage', 'storm_lance', null, 'skyfall'],
        desc: 'Arrow Storm → Dash Shot → Evasive Barrage → Storm Lance → Dash Shot → Volley: you loose one arrow into the clouds and the sky answers: 9 waves of exploding arrows rain across 650 px (×1.1 ATK each, 72 px blasts), guided onto enemies. Ends the ult window.' },
      { id: 'heavens_arrow', name: "Heaven's Arrow", route: 'boss', seq: ['F', 'E', 'F', 'E', 'Q'], chains: [null, 'hunters_mark', null, 'hunters_mark', 'heavens_arrow'],
        desc: "Arrow Storm → Trap → Hunter's Mark → Trap → Hunter's Mark → Dash Shot: you plant your feet and draw a blazing arrow for 0.9 s, then release ONE guaranteed crit of ×(8 + 2.5 per Quarry stack on the target) ATK (×33 at 10), piercing a 700 px line (others take half). Uses up its Quarry; ends the ult window." },
    ],
  },
  mage: {
    id: 'mage', name: 'Mage', weapon: 'staff', resource: 'Mana', resColor: '#5ab4ff',
    color: '#7c6bff',
    blurb: 'Glass-cannon caster. Bolt combos, blink, freezing novas and meteors.',
    base: { maxHp: 170, maxRes: 130, atk: 22, def: 5, spd: 1.0, crit: 0.1, critDmg: 1.65, hpRegen: 1.5, resRegen: 7 },
    growth: { maxHp: 21, maxRes: 4, atk: 3.6, def: 1.3, crit: 0.002, hpRegen: 0.18 },
    resOnHit: 0, resOnBasic: 4.5,
    basicTip: "Hold to keep casting; the 3rd cast is an exploding orb. Basic hits restore {basicRes} Mana each (skill hits don't).",
    basic: [
      { name: 'Arcane Bolt', mul: 1.0, dur: 16, hit: 5, cancel: 9, proj: { speed: 580, range: 520, r: 8, style: 'bolt' }, kb: 70, hitstop: 2 },
      { name: 'Arcane Bolt', mul: 1.0, dur: 16, hit: 5, cancel: 9, proj: { speed: 580, range: 520, r: 8, style: 'bolt' }, kb: 70, hitstop: 2 },
      { name: 'Arcane Orb', mul: 1.7, dur: 26, hit: 9, cancel: 16, proj: { speed: 450, range: 500, r: 13, style: 'orb', explode: 66 }, kb: 260, stagger: 16, hitstop: 5, heavy: true },
    ],
    skills: {
      Q: { id: 'blink', name: 'Blink', cd: 1, cost: 12, stats: { range: 240, iframes: 22 }, tip: "Escape or reposition through danger (i-frames). Blink → Frost Nova is free and much larger (Blink Nova).", desc: 'Teleport toward the cursor with brief invulnerability.' },
      E: { id: 'blast', name: 'Arcane Blast', cd: 1, cost: 20, stats: { mul: 2.3, r: 105, range: 390 }, tip: "Freeze first: Frost Nova → Arcane Blast (Shatter) is bigger and deals +100% to frozen enemies. Arcane Blast → Meteor = Cataclysm.", desc: 'Detonate the ground at the cursor: knockback + stagger.' },
      R: { id: 'meteor', name: 'Meteor', cd: 3, cost: 35, stats: { mul: 4.0, r: 140, range: 430, delay: 60, burnMul: 0.3, burnPulses: 8, burnEvery: 20 }, tip: "Slow to land ({meteorDelay} s): freeze or knock enemies down first, or cast Arcane Blast → Meteor (Cataclysm) so it drops 2.5× faster.", desc: 'Call a meteor at the cursor: huge damage + knockdown + burn.' },
      F: { id: 'nova', name: 'Frost Nova', cd: 1.5, cost: 20, stats: { mul: 1.2, r: 150, freeze: 80 }, tip: "Freeze everything around you, then Arcane Blast for Shatter. Blink in first for a free, much bigger nova (Blink Nova).", desc: 'Freeze all nearby enemies solid, then slow them.' },
    },
    ult: { id: 'ultmeteor', name: 'Meteor', tip: "Aim at the densest pack; the telegraph gives enemies time to move, so freeze or knock them down first. Then finish with a route (shown on screen): Armageddon for packs, Singularity for bosses (Burn powers it). Basic attacks between steps are fine; a wrong skill breaks a route.", desc: 'A giant meteor falls on the target after a short telegraph: massive AoE damage + knockdown, then 4s of burning ground. For 10s after casting, skills are free and cool down 3× faster. Two finisher routes end it: Blink → Blink Nova → Glacial Cascade → Blink → Meteor = Armageddon (mobs); Blast → Cataclysm → Nova → Shatter → Meteor = Singularity (bosses).' },
    state: { id: 'surge', name: 'Arcane Surge', dur: 120, color: '#b89cff', on: 'blink',
      desc: 'Blink grants 2 s of Arcane Surge: skills cast during it transform (Frost Nova = Blink Nova → Glacial Cascade, Meteor = Comet Step).',
      steps: { base: { F: { chain: 'blink_nova', to: 'blinknova' }, R: { chain: 'comet_step' } }, blinknova: { E: { chain: 'glacial_cascade' } } } },
    stack: { id: 'burn', name: 'Burn', max: 8, bossMax: 12, desc: 'Meteor adds 2 Burn (Cataclysm 3), every burning-ground pulse adds 1 (max 8, bosses 12). Supernova and Singularity detonate it.' },
    chains: [
      { id: 'shatter', name: 'Shatter', kind: 'boss', seq: ['F', 'E'], window: 120, desc: 'Frost Nova → Arcane Blast: bigger blast, +100% vs frozen & guaranteed crit.' },
      { id: 'cataclysm', name: 'Cataclysm', kind: 'mob', seq: ['E', 'R'], window: 100, desc: 'Arcane Blast → Meteor: meteor falls 2.5x faster with +30% damage.' },
      { id: 'blink_nova', name: 'Blink Nova', kind: 'mob', seq: ['Q', 'F'], window: 60, desc: 'Blink → Frost Nova: free cast and a much larger nova.' },
      { id: 'supernova', name: 'Supernova', kind: 'boss', seq: ['E', 'R', 'E'], window: 420, cond: 'burn', desc: 'Arcane Blast → Cataclysm (builds Burn) → Arcane Blast while enemies carry your Burn: the blast becomes a star that detonates EVERY Burn stack on every enemy within 560 px: ×(1.2 + 0.9 per stack) ATK crit each. Uses up the Burn.' },
      // Arcane Surge chains: a skill cast during the 2 s Arcane Surge after Blink transforms
      { id: 'glacial_cascade', name: 'Glacial Cascade', kind: 'mob', seq: ['Q', 'F', 'E'], window: 120, state: 'surge', from: 'blinknova', desc: 'Blink → Blink Nova → Arcane Blast (in Arcane Surge): frozen enemies caught in the blast shatter (×2.4 ATK crit) and set off every frozen enemy within 170 px of them, in a chain (up to 24).' },
      { id: 'comet_step', name: 'Comet Step', kind: 'boss', seq: ['Q', 'R'], window: 120, state: 'surge', desc: 'Blink → Meteor (in Arcane Surge): you blink AGAIN (i-frames) and a comet crashes down on the spot you just left almost instantly: ×3.6 ATK (150 px), knockdown, +3 Burn and burning ground. Blink out of a pack and bury it.' },
      { id: 'steam_burst', name: 'Steam Burst', kind: 'mob', seq: ['E', 'F', 'R', 'F'], window: 180, desc: 'Arcane Blast → Frost Nova → Meteor → Frost Nova: fire meets ice. Every enemy in the nova (200 px) carrying your Burn explodes in scalding steam: ×(1.4 + 0.5 per Burn stack) ATK crit and ×0.8 to others within 110 px. Uses up the Burn; everything is frozen and your burning ground boils into a slowing steam cloud.' },
      { id: 'chrono_field', name: 'Chrono Field', kind: 'boss', seq: ['F', 'E', 'F'], window: 120, desc: 'Frost Nova (Shatter) → Arcane Blast → Frost Nova: time freezes in a 190 px field where the blast landed (or around you) for 1.4 s. Everything inside is stopped (bosses too, briefly) and remembers the damage you deal it; then the field shatters: 40% of that damage again + ×(1 + 0.8 per Burn stack) ATK crit each. Uses up the Burn.' },
    ],
    routes: [
      { id: 'armageddon', name: 'Armageddon', route: 'mob', seq: ['Q', 'F', 'E', 'Q', 'R'], chains: [null, 'blink_nova', 'glacial_cascade', null, 'armageddon'],
        desc: 'Meteor → Blink → Blink Nova → Glacial Cascade → Blink → Meteor: the sky splits and 16 meteors crash across 650 px around you (×2.4 ATK each, 110 px, knockdown, +2 Burn), aimed at enemies. Ends the ult window.' },
      { id: 'singularity', name: 'Singularity', route: 'boss', seq: ['E', 'R', 'F', 'E', 'R'], chains: [null, 'cataclysm', null, 'shatter', 'singularity'],
        desc: 'Meteor → Arcane Blast → Cataclysm → Frost Nova → Shatter → Meteor: a black hole opens on your target, holding it in place and sucking in everything within 380 px for 1.1 s (×0.35 ATK ticks), then collapses: ONE crit of ×(6 + 2 per Burn stack on the target) ATK (×30 at 12), half to the rest. Uses up the Burn; ends the ult window.' },
    ],
  },
  cleric: {
    id: 'cleric', name: 'Paladin', weapon: 'mace', resource: 'Holy Charge', resColor: '#ffe27a',
    color: '#f2b93b',
    blurb: 'Combat healer with mace and shield. Every basic hit builds Holy Charge; skills spend it to smite, shield and heal the party.',
    base: { maxHp: 215, maxRes: 100, atk: 20, def: 9, spd: 0.98, crit: 0.07, critDmg: 1.6, hpRegen: 1.8, resRegen: 2 },
    growth: { maxHp: 28, maxRes: 2, atk: 3.2, def: 2.2, crit: 0.002, hpRegen: 0.22 },
    // Holy Charge comes from the basic combo (per enemy hit); skills do not refill it.
    resOnHit: 0, resOnBasicHit: 14,
    dodge: { cost: 0, cd: 14 }, // dodging never spends Holy Charge (slightly longer cooldown instead)
    basicTip: "Every enemy hit builds {holyPerHit} Holy Charge (skills don't refill it). The 3rd swing (Holy Hammer) → Smite = Righteous Fury. The first swing dashes to a target up to {gapRange} px away.",
    basic: [
      { name: 'Mace Swing', melee: true, mul: 1.1, dur: 21, hit: 8, cancel: 12, range: 84, arc: 2.2, kb: 150, lunge: 110, hitstop: 3 },
      { name: 'Shield Bash', melee: true, mul: 1.05, dur: 21, hit: 8, cancel: 12, range: 76, arc: 1.9, kb: 220, stagger: 12, lunge: 130, hitstop: 4 },
      { name: 'Holy Hammer', melee: true, mul: 2.1, dur: 31, hit: 13, cancel: 20, range: 100, arc: 2.8, kb: 380, stagger: 22, lunge: 200, hitstop: 7, heavy: true },
    ],
    skills: {
      Q: { id: 'smite', name: 'Smite', cd: 1, cost: 16, stats: { mul: 2.4, r: 95 }, tip: "Heals you and allies within 280 px for {smiteHeal}% of the damage dealt (capped). Best after the 3rd basic swing (Righteous Fury: +50%, double healing).", desc: 'Hammer slam in front: AoE damage; heals you and nearby allies for part of the damage dealt.' },
      E: { id: 'sanctuary', name: 'Sanctuary', cd: 2.5, cost: 22, stats: { r: 125, range: 300, pulses: 8, every: 30, healPct: 0.03, healAtk: 0.3, slowMul: 0.45 }, tip: "Heals everyone inside every {sanctEvery} s and slows enemies. Shield Rush → Sanctuary is free, bigger and heals more (Bulwark).", desc: 'Place a glowing circle for 4s: heals allies inside, slows enemies inside.' },
      R: { id: 'shieldrush', name: 'Shield Rush', cd: 1.5, cost: 22, stats: { mul: 1.4, knockdown: 60, shield: 300 }, tip: "Rush through allies to shield them too (the shield lasts {shieldDur} s). Follow with Sanctuary for Bulwark.", desc: 'Charge forward knocking enemies down; you and allies you pass get a damage-absorb shield.' },
      F: { id: 'judgment', name: 'Judgment', cd: 3, cost: 20, stats: { r: 150 }, tip: "Build Holy Charge first: ×{judgMin} ATK with none, up to ×{judgMax} at full charge (bosses and elites: ×{judgBossMin} up to ×{judgBossMax}), and heals {judgHealMin}–{judgHealMax}% max HP. Smite → Judgment lands faster (Final Verdict).", desc: 'Finisher: consumes ALL Holy Charge. Damage scales with charge; big heal for you and nearby allies.' },
    },
    ult: { id: 'ascension', name: 'Divine Ascension', tip: "Stay in the fight: allies near you heal every 0.5 s and every skill is free for the whole aura. Then finish with a route (shown on screen): Rapture for packs, Heaven's Judgment for bosses (Condemn powers it). Basic attacks between steps are fine; a wrong skill breaks a route.", desc: '10s holy aura: heals allies and burns enemies around you every 0.5s; skills cost no Holy Charge. Skills also cool down 3× faster. Two finisher routes end it: Shield Rush → Bulwark → Holy Nova → Shield Rush → Sanctuary = Rapture (mobs); Smite → Shield Rush → Bulwark → Smite → Judgment = Heaven\'s Judgment (bosses). Both heal the party.' },
    state: { id: 'consecration', name: 'Consecration', dur: 120, color: '#fff2a8', on: 'shieldrush',
      desc: 'Shield Rush grants 2 s of Consecration: skills cast during it transform (Sanctuary = Bulwark → Holy Nova, Smite = Guardian Angel).',
      steps: { base: { E: { chain: 'bulwark', to: 'bulwark' }, Q: { chain: 'guardian_angel' } }, bulwark: { Q: { chain: 'holy_nova' } } } },
    stack: { id: 'condemn', name: 'Condemn', max: 8, bossMax: 10, desc: 'Every basic hit adds 1 Condemn, Smite adds 2 (max 8, bosses 10). Each stack: +2% damage from you. Final Verdict and Heaven\'s Judgment use it up.' },
    chains: [
      { id: 'righteous_fury', name: 'Righteous Fury', kind: 'mob', seq: ['B3', 'Q'], window: 50, desc: 'Holy Hammer (3rd swing) → Smite: +50% damage and double healing.' },
      { id: 'bulwark', name: 'Bulwark', kind: 'boss', seq: ['R', 'E'], window: 90, desc: 'Shield Rush → Sanctuary: free, bigger circle, stronger heals.' , free: true },
      { id: 'final_verdict', name: 'Final Verdict', kind: 'boss', seq: ['Q', 'F'], window: 100, desc: 'Smite → Judgment: lands faster with +25% damage (+60% on bosses and elites), and uses up every Condemn stack on each enemy hit: ×(1 + 0.3 per stack) more damage to it (×3.4 at 8; bosses and elites ×(1 + 0.4 per stack), ×5 at a boss\'s 10).' },
      // Consecration chains: a skill cast during the 2 s Consecration after Shield Rush transforms
      { id: 'holy_nova', name: 'Holy Nova', kind: 'mob', seq: ['R', 'E', 'Q'], window: 120, state: 'consecration', from: 'bulwark', desc: 'Shield Rush → Bulwark → Smite (in Consecration): your Sanctuary circle EXPLODES: ×3 ATK crit + knockdown to every enemy in it, and heals every ally near it for 12% max HP + 0.6×ATK.' },
      { id: 'guardian_angel', name: 'Guardian Angel', kind: 'mob', seq: ['R', 'Q'], window: 120, state: 'consecration', desc: 'Shield Rush → Smite (in Consecration): an angel descends beside you for 8 s. Every Smite you cast while it is there (this one too) is echoed by the angel 0.25 s later at 70% damage, healing included.' },
      { id: 'divine_storm', name: 'Divine Storm', kind: 'mob', seq: ['Q', 'E', 'R'], window: 110, desc: 'Smite → Sanctuary → Shield Rush: raise your shield and call holy lightning that chains up to 8 times, jumping to enemies carrying your Condemn first (360 px): each strike ×(1.3 + 0.15 per Condemn stack) ATK (crits at 3+), +1 Condemn, and heals you and nearby allies 1.5% max HP. A lone target is struck up to 3 times.' },
      { id: 'aegis_throw', name: 'Aegis Throw', kind: 'boss', seq: ['B3', 'Q', 'F', 'R'], window: 150, desc: 'Holy Hammer (3rd swing) → Smite → Judgment (Final Verdict) → Shield Rush: hurl your shield instead: it bounces between up to 6 enemies (300 px), each ×1.4 ATK, stagger and +1 Condemn, then flies back and shields you for 5% max HP per bounce (max 30%).' },
      { id: 'absolution', name: 'Absolution', kind: 'boss', seq: ['R', 'E', 'Q', 'F'], window: 180, cond: 'condemn', desc: 'Holy Nova (Shield Rush → Sanctuary → Smite) → Judgment: Judgment detonates EVERY Condemn stack on every enemy within 420 px: ×(0.8 + 0.4 per stack) ATK crit each (Holy Charge adds up to +50%), and heals the party (600 px) for 2% max HP per stack detonated (max 45%). Uses up the Condemn.' },

    ],
    routes: [
      { id: 'rapture', name: 'Rapture', route: 'mob', seq: ['R', 'E', 'Q', 'R', 'E'], chains: [null, 'bulwark', 'holy_nova', null, 'rapture'],
        desc: 'Divine Ascension → Shield Rush → Bulwark → Holy Nova → Shield Rush → Sanctuary: you rise and 18 pillars of light slam down across 620 px (×1.9 ATK crit each, 80 px), each also healing allies it touches for 5%; then the whole party is healed for 25% max HP. Ends the aura.' },
      { id: 'heavens_judgment', name: "Heaven's Judgment", route: 'boss', seq: ['Q', 'R', 'E', 'Q', 'F'], chains: [null, null, 'bulwark', null, 'heavens_judgment'],
        desc: "Divine Ascension → Smite → Shield Rush → Bulwark → Smite → Judgment: a giant sword of light descends on your target: ONE guaranteed crit of ×(30 + 4 per Condemn stack on it) ATK (×70 at 10), then it heals the party for 30% max HP and shields them. Uses up its Condemn; ends the aura." },
    ],
  },
  bladedancer: {
    bossForm: true, // skill rework: moving skills cut with a shadow while the Ninja stays put near a boss (sim/skillform.js)
    id: 'bladedancer', name: 'Ninja', weapon: 'daggers', resource: 'Initiative', resColor: '#ff8ad8',
    color: '#ff5fb0',
    blurb: 'Fragile, lightning-fast twin-dagger thief built on critical hits: Mark enemies, crit them to detonate the Marks, then finish. Chains and Marks build Edge (crit chance and crit damage), and every crit refunds a pip.',
    // Initiative: 12 pips, +1/s, no skill cooldowns (only a tiny global recovery). Gear never changes the pip count or regen.
    base: { maxHp: 172, maxRes: 12, atk: 18, def: 6, spd: 1.14, crit: 0.14, critDmg: 1.7, hpRegen: 1.6, resRegen: 1 },
    growth: { maxHp: 21, atk: 3.1, def: 1.5, crit: 0.003, hpRegen: 0.2 },
    pips: true, gcd: 9, resOnHit: 0, resOnFinisher: 2,
    // Edge: crit stacks. +crit chance / +crit damage per stack; built by landed chains, Marks applied and Mark detonations; decays when idle.
    edge: { max: 10, crit: 0.04, critDmg: 0.1, chain: 2, mark: 1, markCap: 2, pop: 1, decayAfter: 240, decayEvery: 60 },
    // Crits refund pips: `per` per crit, at most `perAction` per attack and `perSec` a second (never from free casts, clones or Eclipse).
    critPips: { per: 1, perAction: 2, perSec: 3 },
    // Mark detonation: a crit on one of your Marked enemies pops the Mark for an extra ×(base + per × stacks) ATK crit.
    markPop: { base: 0.6, per: 0.5 },
    // free dodge with a short cooldown; dodging through an attack in the first ticks = perfect dodge -> next hit crits + 2 pips
    dodge: { cost: 0, cd: 3 },
    perfectDodge: { window: 9, ttl: 180, refund: 2 },
    basicTip: "5 fast cuts; the 5th (Crossing Fang) staggers and returns {finisherPip} pips. Out of stealth your first hit is a Backstab (always a crit). Crits refund pips and pop your Marks. The first cut dashes to a target up to {gapRange} px away.",
    basic: [
      { name: 'Quick Cut', melee: true, mul: 0.6, dur: 12, hit: 4, cancel: 7, range: 72, arc: 1.9, kb: 60, lunge: 90, hitstop: 2 },
      { name: 'Reverse Cut', melee: true, mul: 0.62, dur: 12, hit: 4, cancel: 7, range: 72, arc: 1.9, kb: 60, lunge: 90, hitstop: 2 },
      { name: 'Twin Stab', melee: true, mul: 0.7, dur: 13, hit: 5, cancel: 8, range: 78, arc: 1.2, kb: 80, lunge: 120, hitstop: 2 },
      { name: 'Spin Slash', melee: true, mul: 0.75, dur: 14, hit: 5, cancel: 9, range: 80, arc: 3.4, kb: 90, lunge: 60, hitstop: 3 },
      { name: 'Crossing Fang', melee: true, mul: 1.45, dur: 22, hit: 8, cancel: 14, range: 90, arc: 2.6, kb: 300, stagger: 18, lunge: 190, hitstop: 6, heavy: true },
    ],
    skills: {
      Q: { id: 'flicker', name: 'Flicker Step', cd: 0, cost: 3, stats: { mul: 1.3 }, tip: "The opener: dash through a group and Mark everyone you cut. Then Heartseeker (Shadow Strike: free, a guaranteed crit that pops the Mark) or Thousand Cuts (Crimson Flurry). From Vanish: Shadow Step (stay hidden for {stepStealth} s or more, leave a decoy).", desc: 'Fast i-frame dash toward the aim that cuts and Marks everything along the path. Chain them back to back.' },
      E: { id: 'heartseeker', name: 'Heartseeker', cd: 0, cost: 3, tip: "The crit finisher: up to +100% below 25% HP. After Flicker it is free and always crits (Shadow Strike); then Thousand Cuts = Eviscerate. While your Marks are up: Shadow Execution (a clone stab per Mark, {cloneMulPct}% each with the full low-HP bonus).", desc: 'Leaping stab at the target. Deals more the lower its HP: up to +100% below 25%.' },
      R: { id: 'vanish', name: 'Vanish', cd: 0, cost: 4, tip: "Vanish, then attack: your first hit is a Backstab (always a crit, ×{bsMul} damage). Enemies lose you for {stealthDur} s. Or, still hidden, cast a Vanish chain (every hit a crit): Flicker = Shadow Step (blink behind, stay hidden, leave a decoy), Heartseeker = Shadow Pierce (a line of crits; a kill re-hides you), Thousand Cuts = Marked for Death (each cut Marks its target, up to {markMax} stacks for {markDur} s; then Heartseeker = Shadow Execution). Vanish → Shadow Step → Thousand Cuts = Death Blossom (every cut Backstabs, +1 cut per outright kill up to {blossomTotal}).", desc: 'Smoke bomb and backflip away into 2s of stealth: enemies lose you. Your first attack out of stealth is a Backstab: guaranteed crit, +100% damage.' },
      F: { id: 'thousandcuts', name: 'Thousand Cuts', cd: 0, cost: 6, tip: "Cuts up to {cutsTargets} enemies with i-frames throughout. After Flicker = Crimson Flurry (hunts your Marked enemies, cuts on them always crit); after Heartseeker = Eviscerate (every cut on the target, stronger per crit). From Vanish: Marked for Death; from Shadow Step: Death Blossom.", desc: 'Teleport between up to 5 nearby enemies slashing each (i-frames throughout).' },
    },
    ult: { id: 'eclipse', name: 'Eclipse', tip: "Use it with pips low, then cast freely: every cast re-stealths you for another Backstab. Backstab many enemies for a big end burst. A free Vanish opens Vanish chains too (up to {eclVanish} per Eclipse, no meter from them). Then finish with a route (shown on screen during Eclipse): Ten Thousand Cuts for packs, Crescent Execution for bosses. Basic attacks between steps are fine; a wrong skill breaks a route.", desc: '8s: skills cost no pips, and every cast (and Eclipse itself) slips you into 0.5s of stealth, so your next hit is a Backstab (on the first hit of each attack; no pip refund). When it ends, each enemy you Backstabbed takes 25% of the damage you dealt it during Eclipse, and your pips refill. A perfect dodge adds 1s (once). Up to 3 Vanish chains per Eclipse (they give no ult meter); after that, skills out of Vanish just Backstab. Two finisher routes (not counted in that cap), each ends Eclipse: Vanish → Flicker → Thousand Cuts → Flicker → Thousand Cuts = Ten Thousand Cuts (mobs); Vanish → Thousand Cuts → Heartseeker → Thousand Cuts → Heartseeker = Crescent Execution (bosses).' },
    chains: [
      { id: 'shadow_strike', name: 'Shadow Strike', kind: 'boss', seq: ['Q', 'E'], window: 60, free: true, desc: 'Flicker Step → Heartseeker: free, and a guaranteed crit (it pops the Mark Flicker just left).' },
      { id: 'crimson_flurry', name: 'Crimson Flurry', kind: 'mob', seq: ['E', 'Q', 'F'], window: 90, desc: 'Heartseeker → Flicker Step → Thousand Cuts: the flurry hunts your Marked enemies first, and every cut on a Marked enemy is a guaranteed crit (popping its Mark).' },
      { id: 'eviscerate', name: 'Eviscerate', kind: 'boss', seq: ['Q', 'E', 'Q', 'F'], window: 150, desc: 'Shadow Strike (Flicker Step → Heartseeker) → Flicker Step → Thousand Cuts: every cut piles onto the Heartseeker target, +15% per crit already landed in the chain (max +90%).' },
      // Vanish chains: a skill cast while stealthed from Vanish (or Shadow Pierce's re-stealth) uses up the stealth instead of Backstabbing
      { id: 'marked_for_death', name: 'Marked for Death', kind: 'boss', seq: ['R', 'F'], window: 150, stealth: true, desc: 'Vanish → Thousand Cuts (in stealth): every cut puts a Mark on its target (stacks up to 5, lasts 5s). Follow with Heartseeker for Shadow Execution.' },
      { id: 'shadow_step', name: 'Shadow Step', kind: 'mob', seq: ['R', 'Q'], window: 150, stealth: true, desc: 'Vanish → Flicker Step (in stealth): blink behind the target without breaking stealth (your next hit still Backstabs) and leave a 1.5s decoy that draws enemies and projectiles.' },
      { id: 'death_blossom', name: 'Death Blossom', kind: 'mob', seq: ['R', 'Q', 'F'], window: 150, stealth: true, from: 'shadow', desc: 'Vanish → Shadow Step → Thousand Cuts (still hidden): every cut is a Backstab (crit, ×2). Base 5 cuts, +1 per cut that kills outright (max 11). Costs 13 pips in total: crits refund some on the way.' },
      { id: 'shadow_execution', name: 'Shadow Execution', kind: 'boss', seq: ['R', 'F', 'E'], window: 150, vanish: true, cond: 'marked', desc: 'Marked for Death → Heartseeker (any time while your Marks last, even after other attacks): you stab your target and a shadow clone stabs every marked enemy once per Mark (0.08s apart), each at 50% of Heartseeker with the full low-HP bonus. Consumes the Marks.' },
      { id: 'shadow_pierce', name: 'Shadow Pierce', kind: 'mob', seq: ['R', 'E'], window: 150, stealth: true, desc: 'Vanish → Heartseeker (in stealth): lunge through every enemy in a line, each hit a guaranteed crit with the low-HP bonus (popping Marks). A kill re-stealths you for 1.7s (chain another Vanish skill).' },
    ],
    // Eclipse finisher routes: skill-key sequences tracked during Eclipse (basic attacks between steps are fine, a wrong skill
    // breaks the route). `chains` = the chain each step plays (null = the plain skill); the last step is the finisher itself.
    routes: [
      { id: 'ten_thousand_cuts', name: 'Ten Thousand Cuts', route: 'mob', seq: ['R', 'Q', 'F', 'Q', 'F'], chains: [null, 'shadow_step', 'death_blossom', 'shadow_step', 'ten_thousand_cuts'],
        desc: 'Eclipse → Vanish → Shadow Step → Death Blossom → Shadow Step → Thousand Cuts: time slows, you split into a shadow clone per enemy killed on the way (3-8) and all of you Thousand Cuts everything within 600 at once (every cut a Backstab, kills add cuts). Every cut leaves a crescent in the air; the last one detonates them all, +4% per crit you landed during Eclipse (max ×2). Ends Eclipse.' },
      { id: 'crescent_execution', name: 'Crescent Execution', route: 'boss', seq: ['R', 'F', 'E', 'F', 'E'], chains: [null, 'marked_for_death', 'shadow_execution', 'marked_for_death', 'crescent_execution'],
        desc: 'Eclipse → Vanish → Marked for Death → Shadow Execution → Thousand Cuts (re-mark) → Heartseeker: an eclipsed moon rises behind the target, a ring of clones (one per Mark stack used on it this route, min 3) and you dash in for ONE huge guaranteed crit: Heartseeker × (4 + 1 per stack, max 12, + 0.5 per crit you landed during Eclipse, max +8). Ends Eclipse.' },
    ],
  },
  samurai: {
    id: 'samurai', name: 'Samurai', weapon: 'katana', resource: 'Focus', resColor: '#ffd6ec',
    color: '#f2a6c8',
    blurb: 'Iaido swordsman of petals and moonlight. Every draw of the katana leaves DELAYED CUTS glowing on what it passed; R sheathes the blade and bursts them all at once, then STILLNESS (2 s) builds Focus and transforms your next skill. E is a 0.4 s Crescent Parry: block a hit for a counter-slash and Focus (no hit: it still ends in a crescent slash).',
    base: { maxHp: 205, maxRes: 100, atk: 21, def: 8, spd: 1.06, crit: 0.1, critDmg: 1.65, hpRegen: 1.8, resRegen: 0 },
    growth: { maxHp: 25, atk: 3.3, def: 1.9, crit: 0.0025, hpRegen: 0.22 },
    // Samurai (sim/samurai.js). Skills only have cooldowns. Focus (the resource) starts empty, is built in Stillness and by perfect
    // parries (plus a little per hit), drains out of combat; Petal Rain and Moment of Death spend ALL of it (up to x2 damage), the
    // finishers scale with it (kept).
    blade: true, focusRes: true, resOnHit: 0, resOnBasic: 0,
    focus: { still: 0.22, parry: 25, guard: 30, burst: 2, burstCap: 16, hit: 1, hitCap: 3, drainAfter: 300, drain: 6, spendMax: 1.0, finMax: 1.0, ult: 50, ultMul: 2 },
    cut: { per: 0.42, r: 720, splash: 0.25, splashR: 90 },
    dodge: { cost: 0, cd: 12 },
    basicTip: 'Three quick katana cuts, each leaves a Delayed Cut; the 3rd (Rising Moon) staggers. The first cut dashes to a target up to {gapRange} px away. Sheathe (R) bursts every cut you left.',
    basic: [
      { name: 'Draw Cut', melee: true, mul: 0.85, dur: 17, hit: 6, cancel: 10, range: 96, arc: 2.3, kb: 110, lunge: 120, hitstop: 3, cut: 1 },
      { name: 'Return Cut', melee: true, mul: 0.9, dur: 17, hit: 6, cancel: 10, range: 96, arc: 2.3, kb: 110, lunge: 120, hitstop: 3, cut: 1 },
      { name: 'Rising Moon', melee: true, mul: 1.55, dur: 27, hit: 11, cancel: 17, range: 112, arc: 2.9, kb: 330, stagger: 20, lunge: 190, hitstop: 7, heavy: true, cut: 1 },
    ],
    skills: {
      Q: { id: 'iaido', name: 'Iaido Slash', cd: 1.2, cost: 0, stats: { mul: 1.5, len: 250, w: 70, cuts: 1, dur: 18, cancel: 12 },
        tip: 'Quick-draw: dash {len} px down your aim and cut everything you pass (1 Delayed Cut each). Iaido again = Wind Step; Kesa Slash → Iaido = Twin Moons. In Stillness (after a Sheathe): Iaido → Parry = Petal Rain.', desc: 'A lightning line-cut: ×1.5 ATK to everything on a 250 px line, you dash through (i-frames), +1 Delayed Cut each.' },
      E: { id: 'crescent_parry', name: 'Crescent Parry', cd: 1.8, cost: 0, stats: { block: 24, mul: 2.4, r: 150, arc: 2.6, cuts: 2, wmul: 1.0, wr: 125, warc: 2.3, wcuts: 1 },
        tip: 'Raise the blade for 0.4 s. A hit landing in that window is PARRIED (no damage): counter-slash ×{mul} ATK crit, +2 Delayed Cuts and +{focusParry} Focus. No hit: the parry still ends in a crescent slash (×{wmul} ATK, +1 cut). Then Kesa Slash = Riposte Wave, Sheathe = Counter Sheathe.', desc: '0.4 s block. Perfect parry = crit counter-slash (×2.4, +2 cuts, +25 Focus); otherwise a crescent slash (×1.0, +1 cut) when it ends.' },
      R: { id: 'sheathe', name: 'Sheathe', cd: 2.8, cost: 0, stats: { per: 0.42, r: 720, ring: 110, rmul: 0.8, dur: 22, cancel: 14 },
        tip: 'Click the katana home: EVERY Delayed Cut you left on enemies within {cutR} px bursts at once (×{cutPer} ATK per cut), and a small ring cuts around you. Then STILLNESS for 2 s: Focus builds, Iaido → Parry = Petal Rain, Parry = Moonlit Guard → Iaido = Moment of Death.', desc: 'Bursts every Delayed Cut (×0.42 ATK per cut), a ×0.8 ring around you, then 2 s of Stillness.' },
      F: { id: 'kesa_slash', name: 'Kesa Slash', cd: 5, cost: 0, stats: { mul: 1.2, r: 160, arc: 2.0, cuts: 1, dur: 20, cancel: 13 },
        tip: 'A diagonal kesa-giri cut from shoulder to hip ({kr} px, ×{kmul} ATK): leaves a Delayed Cut on every enemy hit. Then Sheathe = Blossom Burst. Crescent Parry → Kesa Slash = Riposte Wave; Iaido → Kesa Slash → Iaido = Twin Moons.', desc: 'A wide diagonal cut (×1.2 ATK, 160 px, 115°), +1 Delayed Cut on everything hit.' },
    },
    ult: { id: 'void_blade', name: 'Blade of the Void', tip: 'A void-black draw cuts the whole line, then for 10 s: Sheathe has no cooldown (free sheathes), other skills cool down 3× faster, Focus builds twice as fast (+50 at once). Finish with a route (shown on screen): Thousand Petal Storm for packs, One Perfect Cut for bosses. Both scale with your Focus (kept). A wrong skill breaks a route; basic attacks are fine. No route: the window ends in a Void Sheathe that bursts every cut.',
      desc: 'Draw a void blade down your aim (×3.5 ATK, 440 px line, +3 Delayed Cuts, +50 Focus). For 10 s: free sheathes, skills cool down 3× faster, Focus gain ×2. Two finisher routes end it: Sheathe → Iaido → Petal Rain → Iaido → Parry = Thousand Petal Storm (mobs); Sheathe → Moonlit Guard → Moment of Death → Parry → Sheathe = One Perfect Cut (bosses).' },
    state: { id: 'stillness', name: 'Stillness', dur: 120, color: '#ffe3f1', on: 'sheathe',
      desc: 'Sheathe (and Blossom Burst / Counter Sheathe) opens 2 s of Stillness: Focus builds, and the next skill transforms (Iaido → then Parry = Petal Rain; Parry = Moonlit Guard → then Iaido = Moment of Death).',
      steps: { base: { Q: { chain: null, to: 'draw' }, E: { chain: 'moonlit_guard', to: 'guard' } }, draw: { E: { chain: 'petal_rain' } }, guard: { Q: { chain: 'moment_of_death' } } } },
    stack: { id: 'cut', name: 'Delayed Cuts', max: 8, bossMax: 16, desc: 'Katana hits leave glowing slash marks (Delayed Cuts, max 8, bosses 16, 8 s). They do nothing until you SHEATHE: then every one bursts at once (×0.42 ATK per cut). Counter Sheathe bursts them at double damage; Moment of Death and One Perfect Cut feed on them. Bosses, during Blade of the Void: hits leave 2× the cuts and Sheathes HOLD the cuts built in the window (no burst) for One Perfect Cut.' },
    chains: [
      { id: 'wind_step', name: 'Wind Step', kind: 'mob', seq: ['Q', 'Q'], window: 110, desc: 'Iaido → Iaido: dash through the pack and back again: two line cuts (×1.1 ATK each), +2 Delayed Cuts per pass.' },
      { id: 'blossom_burst', name: 'Blossom Burst', kind: 'mob', seq: ['F', 'R'], window: 100, desc: 'Kesa Slash → Sheathe: a last draw (×1.0 ATK, +1 cut) then the sheathe blooms: every burst also blossoms onto enemies around it (25% of the burst, 90 px). Opens Stillness.' },
      { id: 'riposte_wave', name: 'Riposte Wave', kind: 'mob', seq: ['R', 'Q', 'E', 'F'], window: 140, desc: 'Petal Rain (Sheathe → Iaido Slash → Crescent Parry) → Kesa Slash: a crescent wave rolls 420 px down your aim (×1.8 ATK, +1 cut each); after a perfect parry it is ×1.5 bigger and leaves +2 cuts.' },
      { id: 'petal_rain', name: 'Petal Rain', kind: 'mob', seq: ['R', 'Q', 'E'], window: 120, state: 'stillness', from: 'draw', desc: 'Sheathe → Iaido → Parry (in Stillness): 8 dash-cuts flurry across the pack (×0.75 ATK each, +1 cut each, i-frames). Spends ALL your Focus: up to ×2 damage.' },
      { id: 'counter_sheathe', name: 'Counter Sheathe', kind: 'boss', seq: ['E', 'R'], window: 100, desc: 'Crescent Parry → Sheathe: the parry flows into the sheathe: every Delayed Cut bursts at DOUBLE damage (×0.84 ATK per cut). Opens Stillness.' },
      { id: 'moonlit_guard', name: 'Moonlit Guard', kind: 'boss', seq: ['R', 'E'], window: 120, state: 'stillness', desc: 'Sheathe → Parry (in Stillness): a 0.8 s moonlit guard. A hit in it is parried: +5 Delayed Cuts on the attacker (+2 on everything near), ×2.4 ATK crit counter and +30 Focus. No hit: a moon-crescent slash (×1.4 ATK, +2 cuts).' },
      { id: 'moment_of_death', name: 'Moment of Death', kind: 'boss', seq: ['R', 'E', 'Q'], window: 120, state: 'stillness', from: 'guard', desc: 'Sheathe → Moonlit Guard → Iaido (in Stillness): time freezes (enemies stop for 1 s) and ONE guaranteed-crit cut hits your target for ×(3 + 0.5 per Delayed Cut on it) ATK (×11 at 16). Uses up its cuts. Spends ALL your Focus: up to ×2 damage.' },
      { id: 'twin_moons', name: 'Twin Moons', kind: 'boss', seq: ['Q', 'F', 'Q'], window: 100, desc: 'Iaido → Kesa Slash → Iaido: two crossing moon-cuts on one target (×1.7 ATK each, +2 cuts each; the second always crits). Fast single-target damage.' },
    ],
    routes: [
      { id: 'thousand_petal_storm', name: 'Thousand Petal Storm', route: 'mob', seq: ['R', 'Q', 'E', 'Q', 'E'], chains: [null, null, 'petal_rain', null, 'thousand_petal_storm'],
        desc: 'Blade of the Void → Sheathe → Iaido → Petal Rain → Iaido → Parry: you vanish into a storm of petals: hundreds of cuts rain across 650 px (each hit ×0.3 ATK, +2 Delayed Cuts), then ONE sheathe click bursts them all (×(1.2 + 0.6 per cut) ATK each). Scales with your Focus (up to +100%; kept). Ends the window.' },
      { id: 'one_perfect_cut', name: 'One Perfect Cut', route: 'boss', seq: ['R', 'E', 'Q', 'E', 'R'], chains: [null, 'moonlit_guard', 'moment_of_death', null, 'one_perfect_cut'],
        desc: 'Blade of the Void → Sheathe → Moonlit Guard → Moment of Death → Parry → Sheathe: the screen goes black, a single white line crosses your target and it splits open: ONE guaranteed crit of ×(10 + 0.6 per Delayed Cut on it) ATK; inside a Void Mark (Void Sheath) every cut counts twice and the mark is spent. Scales with your Focus (up to +100%; kept). Ends the window.' },
    ],
  },
  monk: {
    id: 'monk', name: 'Monk', weapon: 'fists', resource: 'Chi', resColor: '#ffc24a',
    color: '#ff9a2e',
    blurb: 'Saffron-robed brawler of flowing strikes. Every landed hit feeds the HIT COUNTER (it resets after 2 s without a hit): at 10 and 20 hits EVERY chain evolves into a bigger version. Every 5 hits on one target plant a PRESSURE POINT that finishers pop. R is Flow State: 2 s of auto-dodging while you move, and your next chain hits harder.',
    base: { maxHp: 215, maxRes: 100, atk: 20, def: 9, spd: 1.08, crit: 0.08, critDmg: 1.6, hpRegen: 2, resRegen: 0 },
    growth: { maxHp: 26, atk: 3.2, def: 2, crit: 0.0025, hpRegen: 0.24 },
    // Monk (sim/monk.js). Skills only have cooldowns. Chi (the resource) starts empty and grows with every hit (faster at a higher
    // hit-counter tier); Hundred Hands Rush and Seven Seals spend ALL of it (up to x2 damage), the finishers scale with it (kept).
    fist: true, chiRes: true, resOnHit: 0, resOnBasic: 0,
    chi: { hit: 1.4, tierMul: [1, 1.5, 2], hitCap: 7, dodge: 6, drainAfter: 300, drain: 8, spendMax: 1.0, finMax: 1.0, ult: 50, ultMul: 2 },
    combo: { reset: 120, tiers: [10, 20], perTick: 2, ult: 20, names: ['Calm', 'Surging', 'Transcendent'] },
    pp: { every: 5, per: 0.55 },
    flowSt: { emp: 1.3 },
    dodge: { cost: 0, cd: 10 },
    basicTip: 'Jab, cross, palm strike: three fast hits that feed the hit counter. The first one dashes to a target up to {gapRange} px away.',
    basic: [
      { name: 'Jab', melee: true, mul: 0.8, dur: 14, hit: 5, cancel: 8, range: 92, arc: 1.9, kb: 70, lunge: 110, hitstop: 3 },
      { name: 'Cross', melee: true, mul: 0.85, dur: 14, hit: 5, cancel: 8, range: 92, arc: 1.9, kb: 80, lunge: 110, hitstop: 3 },
      { name: 'Palm Strike', melee: true, mul: 1.5, dur: 24, hit: 10, cancel: 15, range: 108, arc: 2.3, kb: 300, stagger: 18, lunge: 170, hitstop: 7, heavy: true },
    ],
    skills: {
      Q: { id: 'tiger_fist', name: 'Tiger Fist', cd: 1.0, cost: 0, stats: { mul: 0.62, hits: 3, every: 4, r: 110, arc: 1.7, kb: 45, step: 34 },
        tip: 'A 3-punch flurry with a light push ({hits} hits × {mul} ATK). Tiger Fist again = Rapid Strikes. In Flow State: Tiger Fist → Crane Kick = Hundred Hands Rush.', desc: 'Three fast punches in a cone (×0.62 ATK each), a light push. 3 hits for the counter.' },
      E: { id: 'crane_kick', name: 'Crane Kick', cd: 1.4, cost: 0, stats: { mul: 1.35, r: 125, dash: 130, knockup: 26 },
        tip: 'A short dash into a spinning launch kick (×{mul} ATK around you, a small launch). Crane Kick again = Cyclone Kick; then Iron Palm = Shockwave Palm; then Flow State = Rising Dragon. In Flow State: Crane Kick → Tiger Fist = Seven Seals.', desc: 'Dash 130 px and spin-kick everything around you (×1.35 ATK, launch).' },
      R: { id: 'flow_state', name: 'Flow State', cd: 3.0, cost: 0, stats: { r: 140, mul: 0.7, dur: 18, cancel: 10 },
        tip: 'A chi push around you (×{mul} ATK), then FLOW STATE for 2 s: while you move, every attack that would hit you is dodged (+{chiDodge} Chi each), and your next chain hits ×{flowEmp}. In Flow: Tiger Fist → Crane Kick = Hundred Hands Rush, Crane Kick → Tiger Fist = Seven Seals.', desc: 'A ×0.7 chi push, then 2 s of Flow State: auto-dodge while moving, next chain ×1.3.' },
      F: { id: 'iron_palm', name: 'Iron Palm', cd: 4.5, cost: 0, stats: { mul: 1.7, r: 125, arc: 1.1, pp: 1, step: 40 },
        tip: 'A stepping iron palm strike ({pr} px cone, ×{pmul} ATK) that PLANTS a Pressure Point on everything it hits. Then Crane Kick = Dragon Sweep, Flow State = Nerve Strike. Crane Kick → Iron Palm = Shockwave Palm.', desc: 'Step in with a palm strike (×1.7 ATK, 125 px cone), +1 Pressure Point on everything hit.' },
    },
    ult: { id: 'awakened_spirit', name: 'Awakened Spirit', tip: 'A giant golden spirit rises behind you and slams the ground, your hit counter jumps to the top tier, +50 Chi. For 10 s the spirit MIRRORS every hit you land (a golden echo for 45%), skills cool down 3× faster and Chi builds twice as fast. Finish with a route (shown on screen): Hundred Fists for packs, Heaven-Splitting Palm for bosses. Both scale with your Chi (kept). A wrong skill breaks a route; basics between steps are fine.',
      desc: 'The spirit slams (×3.5 ATK, 230 px), hit counter to 20, +50 Chi. For 10 s: every hit you land is mirrored by the spirit (45%), skills cool down 3× faster, Chi gain ×2. Two finisher routes end it: Flow → Tiger Fist → Hundred Hands Rush → Tiger Fist → Crane Kick = Hundred Fists (mobs); Flow → Crane Kick → Seven Seals → Crane Kick → Flow = Heaven-Splitting Palm (bosses).' },
    state: { id: 'flow', name: 'Flow State', dur: 120, color: '#ffe7a8', on: 'flow_state',
      desc: 'Flow State (Flow State, Nerve Strike, Rising Dragon) lasts 2 s: while you move you auto-dodge every attack, your next chain hits ×1.3, and the next skills transform (Tiger Fist → then Crane Kick = Hundred Hands Rush; Crane Kick → then Tiger Fist = Seven Seals).',
      steps: { base: { Q: { chain: null, to: 'rush' }, E: { chain: null, to: 'seal' } }, rush: { E: { chain: 'hundred_hands' } }, seal: { Q: { chain: 'seven_seals' } } } },
    stack: { id: 'pp', name: 'Pressure Points', max: 5, bossMax: 10, desc: 'Every 5 hits you land on the same target plant a Pressure Point (max 5, bosses 10, 10 s). Shockwave Palm, Rising Dragon and Seven Seals pop them (×0.55 ATK each, more with Pressure Point Damage gear); the ult finishers pop every one.' },
    chains: [
      { id: 'dragon_sweep', name: 'Dragon Sweep', kind: 'mob', seq: ['F', 'E'], window: 100, desc: 'Iron Palm → Crane Kick: a driving punch into a whirlwind kick that hits everything around you (×1.4 ATK). Evolves: wider whirlwind at 10 hits, a second whirl at 20.' },
      { id: 'cyclone_kick', name: 'Cyclone Kick', kind: 'mob', seq: ['Q', 'E', 'E'], window: 150, desc: 'Tiger Fist → Crane Kick → Crane Kick: a double spin kick that pulls the pack in (2 spins × 0.95 ATK). Evolves: 3 spins at 10 hits, 4 bigger spins at 20.' },
      { id: 'hundred_hands', name: 'Hundred Hands Rush', kind: 'mob', seq: ['R', 'Q', 'E'], window: 120, state: 'flow', desc: 'Flow State → Tiger Fist → Crane Kick (in Flow): you dash between enemies punching each (8 dashes × 0.7 ATK, i-frames). Spends ALL your Chi: up to ×2 damage. Evolves: 10 dashes at 10 hits, 12 at 20.' },
      { id: 'shockwave_palm', name: 'Shockwave Palm', kind: 'mob', seq: ['E', 'F'], window: 100, desc: 'Crane Kick → Iron Palm: a kick into a palm that fires a cone shockwave (×1.8 ATK, 300 px) and pops the Pressure Points it hits. Evolves: a longer cone at 10 hits, a second wave at 20.' },
      { id: 'rapid_strikes', name: 'Rapid Strikes', kind: 'boss', seq: ['Q', 'Q'], window: 100, desc: 'Tiger Fist → Tiger Fist: 6 lightning jabs on one target (×0.5 ATK each); every jab counts double toward Pressure Points. Evolves: 8 jabs at 10 hits, 10 at 20.' },
      { id: 'nerve_strike', name: 'Nerve Strike', kind: 'boss', seq: ['F', 'R'], window: 100, desc: 'Iron Palm → Flow State: dash in with a nerve punch (×1.7 ATK, slows the target by 40% for 3 s, +1 Pressure Point), then flip out into Flow State. Evolves: +2 / +3 Pressure Points.' },
      { id: 'seven_seals', name: 'Seven Seals', kind: 'boss', seq: ['R', 'E', 'Q'], window: 120, state: 'flow', desc: 'Flow State → Crane Kick → Tiger Fist (in Flow): 7 golden seals mark your target and explode one after another (×0.9 ATK each); the 7th pops every Pressure Point on it at double value. Spends ALL your Chi: up to ×2 damage. Evolves: stronger seals, each seal bursts twice at 20.' },
      { id: 'rising_dragon', name: 'Rising Dragon', kind: 'boss', seq: ['Q', 'E', 'E', 'R'], window: 180, desc: 'Cyclone Kick (Tiger Fist → Crane Kick → Crane Kick) → Flow State: a dragon uppercut (×2.3 ATK, launch, big posture damage) that INTERRUPTS the boss and pops its Pressure Points, then a dodge back into Flow State. Evolves: a bigger dragon at 10 / 20 hits.' },
    ],
    routes: [
      { id: 'hundred_fists', name: 'Hundred Fists', route: 'mob', seq: ['R', 'Q', 'E', 'Q', 'E'], chains: [null, null, 'hundred_hands', null, 'hundred_fists'],
        desc: 'Awakened Spirit → Flow State → Tiger Fist → Hundred Hands Rush → Tiger Fist → Crane Kick: the spirit pummels EVERYTHING on screen (a rain of golden fists, ×0.35 ATK each within 700 px), then slams both palms down: ×(2 + 0.55 per Pressure Point) ATK on each enemy. Scales with your Chi (up to +100%; kept). Ends the window.' },
      { id: 'heaven_splitting_palm', name: 'Heaven-Splitting Palm', route: 'boss', seq: ['R', 'E', 'Q', 'E', 'R'], chains: [null, null, 'seven_seals', null, 'heaven_splitting_palm'],
        desc: 'Awakened Spirit → Flow State → Crane Kick → Seven Seals → Crane Kick → Flow State: every Pressure Point on screen pops in sequence, then ONE palm detonates your target: a guaranteed crit of ×(10 + 1 per Pressure Point it had) ATK. Scales with your Chi (up to +100%; kept). Ends the window.' },
    ],
  },
  dragoon: {
    id: 'dragoon', name: 'Dragoon', weapon: 'spear', resource: 'Dragon Blood', resColor: '#ff3b5c',
    color: '#5b4bd6',
    blurb: 'Armored dragon-helmed lancer. Spear thrusts IMPALE enemies (pins); every DIVE rips the pins out for bonus damage and fills DRAGON BLOOD. R is Jump: leap off screen (invulnerable), crash at your aim and open SKYBORNE for 2 s, where Q and E become dives from the sky. F summons your dragon: everything it burns becomes a dive target your Jump homes onto.',
    base: { maxHp: 225, maxRes: 100, atk: 20, def: 10, spd: 1.04, crit: 0.08, critDmg: 1.6, hpRegen: 2, resRegen: 0 },
    growth: { maxHp: 27, atk: 3.2, def: 2.1, crit: 0.0025, hpRegen: 0.24 },
    // Dragoon (sim/dragoon.js). Skills only have cooldowns. Dragon Blood (the resource) starts empty and is built ONLY by landing
    // dive hits; the four Skyborne chains spend ALL of it (up to x1.6 damage), the finishers scale with it (kept).
    lance: true, bloodRes: true, resOnHit: 0, resOnBasic: 0,
    blood: { dive: 6, diveCap: 18, drainAfter: 300, drain: 8, spendMax: 0.6, finMax: 1.0, ult: 50, ultMul: 2 },
    dodge: { cost: 0, cd: 10 },
    basicTip: 'Thrust, sweep, lance drive: a long-reach spear combo; the third hit IMPALES (+1 pin). The first one lunges to a target up to {gapRange} px away.',
    basic: [
      { name: 'Spear Thrust', melee: true, mul: 0.8, dur: 15, hit: 6, cancel: 9, range: 122, arc: 1.2, kb: 70, lunge: 120, hitstop: 3 },
      { name: 'Haft Sweep', melee: true, mul: 0.85, dur: 15, hit: 6, cancel: 9, range: 110, arc: 2.4, kb: 90, lunge: 100, hitstop: 3 },
      { name: 'Lance Drive', melee: true, mul: 1.5, dur: 25, hit: 10, cancel: 16, range: 138, arc: 1.3, kb: 280, stagger: 18, lunge: 170, hitstop: 7, heavy: true },
    ],
    skills: {
      Q: { id: 'piercing_thrust', name: 'Piercing Thrust', cd: 1.2, cost: 0, stats: { mul: 1.3, len: 260, w: 60, lunge: 70, pin: 1 },
        tip: 'A long-reach lunge that pierces the whole line ({qlen} px, ×{qmul} ATK) and IMPALES everything hit (+{pin} pin). Spear Throw next = Impale Rush. In Skyborne (after a Jump): Piercing Thrust = High Jump, then Sweeping Arc = Nosedive Barrage.', desc: 'Lunge and pierce a 260 px line (×1.3 ATK), +1 Impaled pin on everything hit.' },
      E: { id: 'sweeping_arc', name: 'Sweeping Arc', cd: 1.5, cost: 0, stats: { mul: 1.25, r: 170, kb: 300 },
        tip: 'A wide spear spin around you (×{emul} ATK, {er} px) with big knockback. Sweeping Arc again = Tempest Spin; then Spear Throw = Whirling Lance. In Skyborne: Sweeping Arc = Dragon Dive, then Piercing Thrust = Geirskogul.', desc: 'Spin the spear (×1.25 ATK, 170 px), knocks everything back.' },
      R: { id: 'jump', name: 'Jump', cd: 3.0, cost: 0, stats: { mul: 1.6, r: 150, range: 420, air: 26 },
        tip: 'Leap off the screen (invulnerable) and crash down at your aim up to {range} px away: a DIVE (×{rmul} ATK, {rr} px) that rips out the pins (×{pinPer} ATK each) and fills Dragon Blood. Opens SKYBORNE for 2 s: Sweeping Arc = Dragon Dive, Piercing Thrust = High Jump. After Dragon\'s Roar it homes onto scorched enemies.', desc: 'Leap off screen (invulnerable), crash at the aim: ×1.6 ATK dive in 150 px. Opens Skyborne.' },
      F: { id: 'spear_throw', name: 'Spear Throw', cd: 3.5, cost: 0, stats: { mul: 1.6, range: 560, w: 50, pins: 2, mark: 180 },
        tip: 'Hurl a spear down your aim ({trange} px): it pierces the first enemy (×{tmul} ATK), PINS it (+{tpins} pins) and SCORCHES it: a dive target your next Jump homes onto (3 s). Then Jump = Spineshatter. Piercing Thrust → Spear Throw = Impale Rush; Sweeping Arc → Spear Throw = Whirling Lance.', desc: 'Throw a spear up to 560 px: ×1.6 ATK on the first enemy, +2 Impaled pins, and it becomes a dive target for your next Jump (3 s).' },
    },
    ult: { id: 'dragon_form', name: 'Dragon Form', tip: 'Your dragon descends and you crash down with it, +50 Dragon Blood. For 10 s: Jump is nearly free (0.4 s cooldown), every dive is followed by the dragon spirit\'s fire burst (60%), skills cool down 3× faster and Blood builds twice as fast. Finish with a route (shown on screen): Wyrmstorm for packs, Nidhogg\'s Fall for bosses.',
      desc: 'Crash down with the dragon (×3.5 ATK, 300 px, launch), +50 Dragon Blood. For 10 s: Jump cooldown 0.4 s, every dive gets a dragon fire burst (×0.6 ATK, 170 px), skills cool down 3× faster, Blood gain ×2. Two finisher routes end it: Jump → Piercing Thrust (High Jump) → Sweeping Arc (Nosedive Barrage) → Piercing Thrust → Sweeping Arc = Wyrmstorm (mobs); Jump → Sweeping Arc (Dragon Dive) → Piercing Thrust (Geirskogul) → Sweeping Arc → Jump = Nidhogg\'s Fall (bosses). No finisher: Dragon\'s Wrath (a parting firestorm that rips out every pin).' },
    state: { id: 'skyborne', name: 'Skyborne', dur: 150, color: '#b9a8ff', on: 'jump',
      desc: 'Skyborne (after Jump or Spineshatter) lasts 2 s after you land: your next Skyborne chain hits ×1.2 and Q / E become dives from the sky: Sweeping Arc = Dragon Dive (then Piercing Thrust = Geirskogul), Piercing Thrust = High Jump (then Sweeping Arc = Nosedive Barrage).',
      steps: { base: { Q: { chain: 'high_jump', to: 'soar' }, E: { chain: 'dragon_dive', to: 'dive' } }, soar: { E: { chain: 'nosedive_barrage' } }, dive: { Q: { chain: 'geirskogul' } } } },
    stack: { id: 'impaled', name: 'Impaled', max: 5, bossMax: 10, desc: 'Piercing Thrust, Impale Rush, Whirling Lance, Spineshatter\'s thrust, Dragonfang Lance and every 3rd basic hit pin enemies (max 5, bosses 10, 8 s). Every DIVE (Jump landings, Dragon Dive, Nosedive hops, High Jump, Geirskogul, Spineshatter, Crimson Comet, the finishers) rips them out: ×0.4 ATK per pin (more with Impaled Damage gear).' },
    chains: [
      { id: 'whirling_lance', name: 'Whirling Lance', kind: 'mob', seq: ['R', 'Q', 'E', 'F'], window: 140, desc: 'Nosedive Barrage (Jump → Piercing Thrust → Sweeping Arc) → Spear Throw: a spin (×0.9 ATK, 160 px) into a lunging whirl-throw: the lance flies 380 px down your aim (×1.9 ATK, pierces, +1 pin).' },
      { id: 'tempest_spin', name: 'Tempest Spin', kind: 'mob', seq: ['Q', 'E', 'E'], window: 120, desc: 'Piercing Thrust → Sweeping Arc → Sweeping Arc: three spear spins that DRAG the pack in (190 px, ×0.8 ATK each), the last one hurls them away (×1.12).' },
      { id: 'dragon_dive', name: 'Dragon Dive', kind: 'mob', seq: ['R', 'E'], window: 120, state: 'skyborne', desc: 'Jump → Sweeping Arc (in Skyborne): a second, higher leap that crashes in a huge shockwave (240 px, ×2.6 ATK dive, launch). Spends ALL your Dragon Blood: up to ×1.6. Then Piercing Thrust = Geirskogul.' },
      { id: 'nosedive_barrage', name: 'Nosedive Barrage', kind: 'mob', seq: ['R', 'Q', 'E'], window: 120, state: 'skyborne', from: 'soar', desc: 'Jump → High Jump → Sweeping Arc (in Skyborne): three quick hops across the pack, each a dive (135 px, ×1.5 ATK, i-frames). Spends ALL your Dragon Blood: up to ×1.6.' },
      { id: 'impale_rush', name: 'Impale Rush', kind: 'boss', seq: ['Q', 'F'], window: 100, desc: 'Piercing Thrust → Spear Throw: step in and drive two thrusts into your target (×1.4 ATK each), +2 Impaled pins per thrust.' },
      { id: 'spineshatter', name: 'Spineshatter', kind: 'boss', seq: ['F', 'R'], window: 100, desc: 'Spear Throw → Jump: a pinning spear cast (×1.2 ATK, +1 pin), then up and straight down onto the target (×2.2 ATK dive) - the pins burst at ×1.6. Opens Skyborne.' },
      { id: 'high_jump', name: 'High Jump', kind: 'boss', seq: ['R', 'Q'], window: 120, state: 'skyborne', desc: 'Jump → Piercing Thrust (in Skyborne): soar out of sight for up to 1.2 s (steer with your aim, attack to crash early): ×2.0 ATK, up to ×4.8 the longer you stay airborne (a dive). Spends ALL your Dragon Blood: up to ×1.6. Then Sweeping Arc = Nosedive Barrage.' },
      { id: 'geirskogul', name: 'Geirskogul', kind: 'boss', seq: ['R', 'E', 'Q'], window: 120, state: 'skyborne', from: 'dive', desc: 'Jump → Dragon Dive → Piercing Thrust (in Skyborne): rise and fire a piercing dragon beam down your aim from the sky (760 px, ×3.6 ATK, counts as a dive: rips the pins out). Spends ALL your Dragon Blood: up to ×1.6.' },
    ],
    routes: [
      { id: 'wyrmstorm', name: 'Wyrmstorm', route: 'mob', seq: ['R', 'Q', 'E', 'Q', 'E'], chains: [null, 'high_jump', 'nosedive_barrage', null, 'wyrmstorm'],
        desc: 'Dragon Form → Jump → High Jump → Nosedive Barrage → Piercing Thrust → Sweeping Arc: 8 dives across the pack (×1.15 ATK each, pins burst) while the dragon rains fire over the whole screen (×0.35 ATK per bolt), then one crash: ×(2.5 + 0.4 per pin) ATK on everything within 320 px. Scales with your Dragon Blood (up to +100%; kept). Ends the window.' },
      { id: 'nidhoggs_fall', name: "Nidhogg's Fall", route: 'boss', seq: ['R', 'E', 'Q', 'E', 'R'], chains: [null, 'dragon_dive', 'geirskogul', null, 'nidhoggs_fall'],
        desc: "Dragon Form → Jump → Dragon Dive → Geirskogul → Sweeping Arc → Jump: you vanish into the sky; the world holds its breath; dragon and lancer crash down together in ONE strike: a guaranteed crit of ×(10 + 1 per pin) ATK on your target, ×2 in a 260 px ring. Scales with your Dragon Blood (up to +100%; kept). Ends the window." },
    ],
  },
  summoner: {
    id: 'summoner', name: 'Grimoire Summoner', weapon: 'grimoire', resource: 'Ink', resColor: '#7b5cff',
    color: '#21b59e',
    blurb: 'A scholar with a floating spellbook where every page is a creature. Summons are short-lived and hit hard: Fire Sprites, a Frost Wyrm, a Thunder Roc and, on the Special, a Legendary Page (phoenix for packs, kraken for bosses). Every summon writes INK; a full book makes you INSCRIBED: the bigger routes open and your next summon is empowered. Turn the Page (G) empowers the next summon by hand.',
    base: { maxHp: 180, maxRes: 100, atk: 21, def: 6, spd: 1.02, crit: 0.1, critDmg: 1.65, hpRegen: 1.6, resRegen: 0 },
    growth: { maxHp: 22, atk: 3.5, def: 1.4, crit: 0.0025, hpRegen: 0.19 },
    // Grimoire Summoner (sim/arcana.js). Skills only have cooldowns. Ink (the resource) starts empty and is written by summoning;
    // a full book = INSCRIBED (the Inscribed chains need it and spend it; the first summon after filling it is empowered).
    grim: true, inkRes: true, resOnHit: 0, resOnBasic: 0,
    ink: { cast: 12, chain: 10, basic: 3, basicCap: 6, drainAfter: 360, drain: 6, insc: 1.4, ult: 100 },
    dodge: { cost: 0, cd: 11 },
    basicTip: 'Razor paper pages fly out of the book; every 3rd hit the book SNAPS SHUT with a rune burst ({gapRange} px is not used: it is a ranged combo). Basic hits write a little Ink.',
    basic: [
      { name: 'Paper Cut', mul: 0.85, dur: 13, hit: 4, cancel: 8, proj: { speed: 760, range: 540, r: 7, style: 'page' }, kb: 60, hitstop: 2 },
      { name: 'Paper Cut', mul: 0.85, dur: 13, hit: 4, cancel: 8, proj: { speed: 760, range: 540, r: 7, style: 'page' }, kb: 60, hitstop: 2 },
      { name: 'Snap Shut', mul: 1.6, dur: 22, hit: 7, cancel: 14, proj: { speed: 640, range: 520, r: 12, style: 'rune', explode: 80 }, kb: 240, stagger: 14, hitstop: 5, heavy: true },
    ],
    skills: {
      Q: { id: 'fire_sprites', name: 'Fire Sprites', cd: 1.0, cost: 0, stats: { n: 3, hits: 3, every: 7, mul: 0.5, range: 460, burn: 1 },
        tip: 'Three fire sprites swarm the {n} enemies nearest your aim and burn them ({hits} hits × ×{mul} ATK each). Fast filler. Sprites again = Wildfire; then Turn the Page = Elemental Rise. Turned page: a FIRE ELEMENTAL instead.', desc: '3 sprites swarm the nearest enemies: 3 burning hits of ×0.5 ATK each.' },
      E: { id: 'frost_wyrm', name: 'Frost Wyrm', cd: 1.4, cost: 0, stats: { r: 270, arc: 1.25, pulses: 3, every: 5, mul: 0.62, slow: 120 },
        tip: 'A serpent coils out of the page and breathes an ice cone ({r} px): {pulses} waves × ×{mul} ATK, slows and CHILLS (the Roc deals bonus shock damage to chilled enemies). Then Thunder Roc = Frozen Thunder. Turned page: the wyrm FREEZES SOLID.', desc: 'An ice-breath cone (270 px): 3 × 0.62 ATK, slow + Chill.' },
      R: { id: 'thunder_roc', name: 'Thunder Roc', cd: 2.0, cost: 0, stats: { len: 540, w: 100, bolts: 4, every: 4, r: 85, mul: 0.95, shock: 1.5 },
        tip: 'A giant bird swoops down your aim ({len} px) dropping {bolts} lightning bolts (×{mul} ATK each, {r} px). Chilled enemies take ×{shock} shock damage and are always crit. Then Frost Wyrm = Storm Front (Inscribed). Turned page: a whole STORM.', desc: 'A swooping roc drops 4 bolts down a 540 px line (×0.95 ATK each); chilled enemies take ×1.5 and are crit.' },
      F: { id: 'turn_the_page', name: 'Turn the Page', cd: 3.0, cost: 0, stats: { r: 150, mul: 0.6 },
        tip: 'Flip the grimoire: a flurry of pages cuts around you (×{mul} ATK, {r} px) and your NEXT summon is empowered: Sprites become a Fire Elemental, the Wyrm freezes solid, the Roc becomes a storm. Fire Sprites → Turn the Page = Elemental Rise.', desc: 'A page flurry (×0.6 ATK, 150 px); the next summon is empowered.' },
    },
    ult: { id: 'grimoire_unbound', name: 'Grimoire Unbound', tip: 'The book tears open and EVERY page comes alive for the whole ult window: sprites, the wyrm, the roc, the phoenix and the kraken fight on their own. Skills cool down 3× faster, Ink is full. Finish with a route (shown on screen): Bestiary Stampede for packs, The Final Chapter for bosses.',
      desc: 'The grimoire bursts open (×3.4 ATK, 300 px) and Ink fills. For 10 s every page fights by itself (a creature strikes every 0.4 s, ×0.7–1.4 ATK), skills cool down 3× faster. Two finisher routes end it: Thunder Roc → Fire Sprites → Frost Wyrm → Fire Sprites → Frost Wyrm = Bestiary Stampede (mobs); Thunder Roc → Frost Wyrm → Fire Sprites → Frost Wyrm → Thunder Roc = The Final Chapter (bosses). No finisher: the Last Page (every creature at once).' },
    stack: { id: 'chill', name: 'Chill', max: 2, bossMax: 2, desc: 'Frost Wyrm breath CHILLS (1); a turned-page wyrm, Glacier Coil and Wyrm\'s Embrace FREEZE SOLID (2). Thunder Roc lightning deals ×1.5 to chilled enemies and always crits; frozen-solid enemies also take +30% from your summons.' },
    chains: [
      { id: 'wildfire', name: 'Wildfire', kind: 'mob', seq: ['Q', 'Q'], window: 110, desc: 'Fire Sprites → Fire Sprites: the sprites split into 6 and spread fire: 6 burning dives on the pack (×0.7 ATK each, 95 px), then the ground burns.',
        fx: { dur: 30, cancel: 20, steps: [{ t: 6, n: 6, every: 3, at: 'aim', range: 460, shape: 'circle', r: 95, mul: 0.7, o: { kb: 60 }, look: 'sprite', spread: 150 }], area: { t: 20, kind: 'burn', shape: 'circle', r: 170, delay: 4, pulses: 5, every: 15, o: { mul: 0.3, hitstop: 0 }, aim: true } } },
      { id: 'frozen_thunder', name: 'Frozen Thunder', kind: 'boss', seq: ['E', 'R'], window: 110, desc: 'Frost Wyrm → Thunder Roc: the roc dives onto your target: 3 bolts (×1.25 ATK each, 110 px); every bolt on a chilled enemy is a guaranteed crit.',
        fx: { dur: 30, cancel: 20, steps: [{ t: 8, n: 3, every: 6, at: 'tgt', range: 520, shape: 'circle', r: 110, mul: 1.25, o: { stagger: 10, critChill: true, shock: true }, look: 'roc' }] } },
      { id: 'elemental_rise', name: 'Elemental Rise', kind: 'boss', seq: ['Q', 'F'], window: 110, desc: 'Fire Sprites → Turn the Page: the sprites fuse into a FIRE ELEMENTAL on your target: 5 burning punches (×0.6 ATK each) and a ×1.5 ATK slam.',
        fx: { dur: 34, cancel: 24, steps: [{ t: 4, n: 5, every: 4, at: 'tgt', range: 460, shape: 'circle', r: 90, mul: 0.6, o: { kb: 30 }, look: 'elemental' }, { t: 26, at: 'tgt', range: 460, shape: 'circle', r: 120, mul: 1.5, o: { stagger: 24, heavy: true, hitstop: 7 }, look: 'elementalslam' }] } },
      { id: 'storm_front', name: 'Storm Front', kind: 'mob', seq: ['R', 'E'], window: 110, need: 'inscribed', desc: 'Thunder Roc → Frost Wyrm (INSCRIBED): the roc drags a blizzard down your aim: 5 waves of hail (560 px line, 170 wide, ×0.7 ATK each, slows + Chill). Spends all Ink.',
        fx: { dur: 34, cancel: 24, steps: [{ t: 4, n: 5, every: 5, at: 'self', shape: 'line', len: 560, w: 170, mul: 0.7, o: { slow: 150, slowMul: 0.45, kb: 40 }, stack: ['chill', 1], look: 'blizzard' }] } },
      { id: 'glacier_coil', name: 'Glacier Coil', kind: 'boss', seq: ['E', 'F', 'E'], window: 150, desc: 'Frost Wyrm → Turn the Page → Frost Wyrm: the wyrm coils around your target and FREEZES IT SOLID (×1.2 ATK), then a second breath (×2.0 ATK, ×1.5 vs frozen).',
        fx: { dur: 34, cancel: 24, steps: [{ t: 6, at: 'tgt', range: 460, shape: 'circle', r: 110, mul: 1.2, o: { freeze: 90, stagger: 20 }, stack: ['chill', 2], look: 'coil' }, { t: 20, at: 'tgt', range: 460, shape: 'circle', r: 130, mul: 2.0, o: { bonusVsFrozen: 1.5, solidBonus: 1.5, heavy: true, hitstop: 7 }, look: 'breath' }] } },
      { id: 'firestorm_flight', name: 'Firestorm Flight', kind: 'mob', seq: ['Q', 'R', 'Q'], window: 150, desc: 'Fire Sprites → Thunder Roc → Fire Sprites: the roc flies over your aim and drops the sprites as fire bombs: 6 blasts (×0.95 ATK each, 110 px).',
        fx: { dur: 34, cancel: 24, steps: [{ t: 6, n: 6, every: 4, at: 'aim', range: 480, shape: 'circle', r: 110, mul: 0.95, o: { kb: 120 }, look: 'firebomb', spread: 170 }] } },
      { id: 'tri_element', name: 'Tri-Element Burst', kind: 'mob', seq: ['Q', 'E', 'R'], window: 150, need: 'inscribed', desc: 'Fire Sprites → Frost Wyrm → Thunder Roc (INSCRIBED): fire, ice and lightning collide at your aim: three explosions (230 px, ×1.3 ATK each: burn, Chill, then a crit-on-chilled thunderclap). Spends all Ink.',
        fx: { dur: 34, cancel: 24, steps: [{ t: 6, at: 'aim', range: 460, shape: 'circle', r: 230, mul: 1.3, o: { kb: 100 }, look: 'trifire' }, { t: 14, at: 'aim', range: 460, shape: 'circle', r: 230, mul: 1.3, o: { slow: 120 }, stack: ['chill', 1], look: 'triice' }, { t: 22, at: 'aim', range: 460, shape: 'circle', r: 230, mul: 1.3, o: { kb: 260, critChill: true, shock: true, heavy: true, hitstop: 8 }, look: 'trithunder' }] } },
      { id: 'thunderhead', name: 'Thunderhead', kind: 'mob', seq: ['R', 'F', 'R', 'E'], window: 170, desc: 'Thunder Roc → Turn the Page → Thunder Roc → Frost Wyrm: a storm cloud gathers over your aim and hails (8 × ×0.45 ATK, 240 px, slows), then 3 lightning strikes (×1.0 ATK each, crit on chilled).',
        fx: { dur: 50, cancel: 40, steps: [{ t: 4, n: 8, every: 4, at: 'aim', range: 480, shape: 'circle', r: 240, mul: 0.45, o: { slow: 90 }, stack: ['chill', 1], look: 'hail' }, { t: 30, n: 3, every: 5, at: 'aim', range: 480, shape: 'circle', r: 150, mul: 1.0, o: { critChill: true, shock: true, kb: 120 }, look: 'thunder', spread: 90 }] } },
      { id: 'living_inferno', name: 'Living Inferno', kind: 'boss', seq: ['Q', 'F', 'Q', 'R'], window: 170, desc: 'Fire Sprites → Turn the Page → Fire Sprites → Thunder Roc: the fire elemental GRABS your target (4 crushing burns × 0.6 ATK, roots), then lightning detonates it (×2.6 ATK, 150 px).',
        fx: { dur: 46, cancel: 36, steps: [{ t: 4, n: 4, every: 5, at: 'tgt', range: 460, shape: 'circle', r: 90, mul: 0.6, o: { root: 30 }, look: 'grab' }, { t: 30, at: 'tgt', range: 460, shape: 'circle', r: 150, mul: 2.6, o: { stagger: 30, heavy: true, hitstop: 9, critChill: true, shock: true }, look: 'detonate' }] } },
      { id: 'wyrms_embrace', name: "Wyrm's Embrace", kind: 'boss', seq: ['E', 'R', 'F', 'E'], window: 170, desc: "Frost Wyrm → Thunder Roc → Turn the Page → Frost Wyrm: the wyrm coils around your target and freezes it solid while the roc strikes 4 times (×0.85 ATK each, crit on chilled), then one last breath (×1.8 ATK).",
        fx: { dur: 48, cancel: 38, steps: [{ t: 4, at: 'tgt', range: 460, shape: 'circle', r: 100, mul: 0.6, o: { freeze: 80 }, stack: ['chill', 2], look: 'coil' }, { t: 12, n: 4, every: 5, at: 'tgt', range: 460, shape: 'circle', r: 100, mul: 0.85, o: { critChill: true, shock: true }, look: 'roc' }, { t: 36, at: 'tgt', range: 460, shape: 'circle', r: 140, mul: 1.8, o: { solidBonus: 1.5, heavy: true, hitstop: 8 }, look: 'breath' }] } },
    ],
    routes: [
      { id: 'bestiary_stampede', name: 'Bestiary Stampede', route: 'mob', seq: ['R', 'Q', 'E', 'Q', 'E'], chains: [null, 'wildfire', 'storm_front', null, 'bestiary_stampede'],
        desc: 'Grimoire Unbound → Thunder Roc → Wildfire → Storm Front → Fire Sprites → Frost Wyrm: every creature in the book stampedes across the screen: 12 charges (×1.2 ATK each, 110 px) aimed at enemies within 650 px, then the phoenix bursts over the pack (×2.6 ATK, 330 px). Scales with your Ink (up to +100%). Ends the window.' },
      { id: 'final_chapter', name: 'The Final Chapter', route: 'boss', seq: ['R', 'E', 'Q', 'E', 'R'], chains: [null, 'glacier_coil', null, null, 'final_chapter'],
        desc: 'Grimoire Unbound → Thunder Roc → Glacier Coil → Fire Sprites → Frost Wyrm → Thunder Roc: the kraken drags your target down, every creature strikes it, then the book slams shut on it: ONE guaranteed crit of ×(9 + 1.5 if frozen solid) ATK, ×2 to everything within 240 px. Scales with your Ink (up to +100%). Ends the window.' },
    ],
  },
  bard: {
    id: 'bard', name: 'Bard', weapon: 'lute', resource: 'Tempo', resColor: '#ffcf4a',
    color: '#e0528f',
    blurb: 'Battle Conductor. Skills are notes; finishing a chain plays its SONG as an 8 s party buff (co-op allies too): Valor (damage), Haste (speed + cooldowns), Mending (heal over time + a shield) and Requiem (enemies take more damage). Several songs run at once. Playing builds TEMPO; full Tempo puts you IN TUNE: songs get stronger and the In Tune chains open.',
    base: { maxHp: 198, maxRes: 100, atk: 19, def: 7, spd: 1.05, crit: 0.09, critDmg: 1.6, hpRegen: 1.9, resRegen: 0 },
    growth: { maxHp: 25, atk: 3.2, def: 1.7, crit: 0.0022, hpRegen: 0.22 },
    // Bard (sim/arcana.js). Skills only have cooldowns. Tempo (the resource) starts empty and is built by playing; full = IN TUNE
    // (songs ×1.5, the In Tune chains need and spend it). Songs: p.songs on every player in range.
    bard: true, tempoRes: true, resOnHit: 0, resOnBasic: 0,
    tempo: { cast: 10, chain: 12, basic: 3, basicCap: 6, drainAfter: 360, drain: 6, tune: 1.5, ult: 100 },
    dodge: { cost: 0, cd: 10 },
    basicTip: 'Strum glowing notes at your aim; the 3rd strum is a CHORD RING that bursts around you. In Encore every note explodes. Basic hits build a little Tempo.',
    basic: [
      { name: 'Strum', mul: 0.85, dur: 13, hit: 4, cancel: 8, proj: { speed: 620, range: 430, r: 8, style: 'note' }, kb: 50, hitstop: 2 },
      { name: 'Strum', mul: 0.85, dur: 13, hit: 4, cancel: 8, proj: { speed: 620, range: 430, r: 8, style: 'note' }, kb: 50, hitstop: 2 },
      { name: 'Chord Ring', melee: true, mul: 1.45, dur: 22, hit: 8, cancel: 14, range: 150, arc: 6.3, kb: 230, stagger: 14, lunge: 0, hitstop: 5, heavy: true, ring: true },
    ],
    skills: {
      Q: { id: 'sonic_riff', name: 'Sonic Riff', cd: 1.0, cost: 0, stats: { len: 430, w: 74, mul: 1.5 },
        tip: 'A searing riff: a sound wave down your aim ({len} px, ×{mul} ATK). Your main damage. Riff again = Power Chord; Echo Chord → Riff = Quickstep.', desc: 'A 430 px sound-wave line: ×1.5 ATK.' },
      E: { id: 'echo_chord', name: 'Echo Chord', cd: 1.6, cost: 0, stats: { bounces: 5, hop: 320, mul: 0.7, grow: 0.25 },
        tip: 'A ring of sound that bounces between up to {bounces} enemies, each bounce +{grow}× stronger (×{mul} ATK first). Then Sonic Riff = Quickstep (Haste). Healing Hymn → Echo Chord = Soft Refrain.', desc: 'A bouncing chord: 5 bounces, ×0.7 ATK growing +25% per bounce.' },
      R: { id: 'healing_hymn', name: 'Healing Hymn', cd: 2.4, cost: 0, stats: { r: 380, heal: 0.08, atk: 0.5, mul: 0.6, pr: 170 },
        tip: 'Heal yourself and every ally within {r} px for {healPct}% max HP + {hatk}× ATK and CLEANSE stuns and slows; a pulse of sound hits enemies near you (×{mul} ATK). Then Echo Chord = Soft Refrain (Mending).', desc: 'Party heal (8% max HP + 0.5×ATK) + cleanse; a ×0.6 ATK pulse around you.' },
      F: { id: 'dissonance', name: 'Dissonance', cd: 2.5, cost: 0, stats: { r: 240, arc: 1.4, mul: 1.0, stun: 50, vuln: 0.15, vulnT: 300 },
        tip: 'A jarring cone ({r} px): ×{mul} ATK, STUNS for 0.8 s and leaves enemies DISSONANT: +{vulnPct}% damage taken from everyone for 5 s. In Tune: Dissonance → Sonic Riff = Sour Note, Dissonance → Echo → Dissonance = Discord Ballad.', desc: 'A stun cone (240 px, ×1.0 ATK); Dissonant enemies take +15% damage for 5 s.' },
    },
    ult: { id: 'encore', name: 'Encore', tip: 'Take a bow, then play it again: every active song is REPLAYED at double strength for the party (no songs up: Valor + Haste), Tempo fills, and for 10 s your basic notes explode in an area. Skills cool down 3× faster. Finish with a route (shown on screen): Fortissimo for packs, Death Knell for bosses.',
      desc: 'A curtain-call shockwave (×3.0 ATK, 290 px). Every active song is replayed at ×2 strength (none: Valor + Haste). For 10 s: basics are area notes (70 px), skills cool down 3× faster, Tempo full. Two finisher routes end it: Healing Hymn → Sonic Riff → Echo Chord → Sonic Riff → Echo Chord = Fortissimo (mobs); Healing Hymn → Echo Chord → Sonic Riff → Echo Chord → Healing Hymn = Death Knell (bosses). No finisher: a Final Bow (a parting chord around you).' },
    stack: { id: 'disso', name: 'Dissonant', max: 1, bossMax: 1, desc: 'Dissonance (and Sour Note / Discord Ballad) leaves enemies DISSONANT for 5 s: +15% damage from everyone. Requiem stacks with it.' },
    chains: [
      { id: 'power_chord', name: 'Power Chord', kind: 'mob', seq: ['Q', 'Q'], window: 110, song: ['valor', 1], desc: 'Sonic Riff → Sonic Riff: a power chord: two wide riffs (460 px, 120 wide, ×1.2 ATK each). Song: VALOR.',
        fx: { dur: 24, cancel: 16, steps: [{ t: 4, n: 2, every: 8, at: 'self', shape: 'line', len: 460, w: 120, mul: 1.2, o: { kb: 120 }, look: 'riff' }] } },
      { id: 'quickstep', name: 'Quickstep', kind: 'mob', seq: ['E', 'Q'], window: 110, song: ['haste', 1], desc: 'Echo Chord → Sonic Riff: a dancing step forward (160 px, i-frames) into a riff (440 px, ×1.6 ATK). Song: HASTE.',
        fx: { dur: 22, cancel: 14, dash: { dist: 160, T: 6, iframes: 12 }, steps: [{ t: 8, at: 'self', shape: 'line', len: 440, w: 90, mul: 1.6, o: { kb: 140 }, look: 'riff' }] } },
      { id: 'soft_refrain', name: 'Soft Refrain', kind: 'boss', seq: ['R', 'E'], window: 110, song: ['mending', 1], heal: 0.03, desc: 'Healing Hymn → Echo Chord: a gentle refrain on your target: 4 echoes (×0.8 ATK each, 110 px), each healing the party 3% max HP. Song: MENDING.',
        fx: { dur: 30, cancel: 22, steps: [{ t: 4, n: 4, every: 6, at: 'tgt', range: 460, shape: 'circle', r: 110, mul: 0.8, o: { kb: 40 }, look: 'refrain' }] } },
      { id: 'sour_note', name: 'Sour Note', kind: 'boss', seq: ['F', 'Q'], window: 110, need: 'intune', song: ['requiem', 1], desc: 'Dissonance → Sonic Riff (IN TUNE): one horribly sour note on your target (×2.6 ATK, 130 px, stagger, Dissonant). Song: REQUIEM. Spends all Tempo.',
        fx: { dur: 26, cancel: 18, steps: [{ t: 8, at: 'tgt', range: 460, shape: 'circle', r: 130, mul: 2.6, o: { stagger: 30, heavy: true, hitstop: 8 }, stack: ['disso', 1], look: 'sour' }] } },
      { id: 'anthem_of_valor', name: 'Anthem of Valor', kind: 'mob', seq: ['Q', 'E', 'Q'], window: 150, song: ['valor', 2], desc: 'Sonic Riff → Echo Chord → Sonic Riff: a marching anthem: three riffs fanned across your aim (440 px, ×1.0 ATK each). Song: VALOR at DOUBLE strength.',
        fx: { dur: 28, cancel: 20, steps: [{ t: 4, n: 3, every: 6, at: 'self', shape: 'line', len: 440, w: 100, mul: 1.0, o: { kb: 100 }, look: 'anthem', fan: 0.28 }] } },
      { id: 'battle_hymn', name: 'Battle Hymn', kind: 'boss', seq: ['R', 'Q', 'R'], window: 150, song: ['mending', 1], song2: ['valor', 1], heal: 0.06, desc: 'Healing Hymn → Sonic Riff → Healing Hymn: a hymn that heals the party (6% max HP) and strikes your target with a choir burst (×2.1 ATK, 140 px). Songs: MENDING + VALOR.',
        fx: { dur: 30, cancel: 22, steps: [{ t: 10, at: 'tgt', range: 460, shape: 'circle', r: 140, mul: 2.1, o: { stagger: 24, heavy: true, hitstop: 7 }, look: 'hymn' }] } },
      { id: 'discord_ballad', name: 'Discord Ballad', kind: 'boss', seq: ['F', 'E', 'F'], window: 150, need: 'intune', song: ['requiem', 1.5], songT: 720, desc: 'Dissonance → Echo Chord → Dissonance (IN TUNE): a second stun cone (260 px, ×1.8 ATK); enemies hit by BOTH stuns take ×1.6 and are crit. Song: a LONG REQUIEM (12 s, ×1.5). Spends all Tempo.',
        fx: { dur: 30, cancel: 22, steps: [{ t: 8, at: 'self', shape: 'cone', r: 260, arc: 1.5, mul: 1.8, o: { stagger: 50, critVsCC: true, ccBonus: 1.6, heavy: true, hitstop: 8 }, stack: ['disso', 1], look: 'discord' }] } },
      { id: 'rondo', name: 'Rondo', kind: 'mob', seq: ['E', 'Q', 'E', 'R'], window: 170, song: ['haste', 1], desc: 'Echo Chord → Sonic Riff → Echo Chord → Healing Hymn: three resonating sound pools bloom around your aim (150 px each, 5 pulses × 0.45 ATK, slows). Song: HASTE.',
        fx: { dur: 30, cancel: 22, steps: [{ t: 6, n: 3, every: 5, at: 'aim', range: 460, shape: 'circle', r: 150, mul: 0.9, o: { kb: 60 }, look: 'pool', spread: 150, pool: { pulses: 5, every: 14, mul: 0.45 } }] } },
      { id: 'symphony_strike', name: 'Symphony Strike', kind: 'boss', seq: ['Q', 'E', 'F', 'Q'], window: 170, desc: 'Sonic Riff → Echo Chord → Dissonance → Sonic Riff: the whole orchestra hits your target at once: ×(2.0 + 0.7 per active song) ATK (150 px), crit while 3+ songs play.',
        fx: { dur: 30, cancel: 22, steps: [{ t: 12, at: 'tgt', range: 460, shape: 'circle', r: 150, mul: 2.0, o: { stagger: 30, heavy: true, hitstop: 9, perSong: 0.7 }, look: 'symphony' }] } },
      { id: 'ballad_of_heroes', name: 'Ballad of Heroes', kind: 'mob', seq: ['R', 'E', 'Q', 'R'], window: 170, song: ['valor', 1], song2: ['haste', 1], song3: ['mending', 1], heal: 0.1, desc: 'Healing Hymn → Echo Chord → Sonic Riff → Healing Hymn: an heroic ballad: the party heals 10% max HP and a golden shockwave rolls out (270 px, ×1.5 ATK). Songs: VALOR + HASTE + MENDING.',
        fx: { dur: 30, cancel: 22, steps: [{ t: 8, at: 'self', shape: 'circle', r: 270, mul: 1.5, o: { kb: 260 }, look: 'ballad' }] } },
    ],
    routes: [
      { id: 'fortissimo', name: 'Fortissimo', route: 'mob', seq: ['R', 'Q', 'E', 'Q', 'E'], chains: [null, 'power_chord', null, 'quickstep', 'fortissimo'],
        desc: 'Encore → Healing Hymn → Power Chord → Echo Chord → Quickstep → Echo Chord: the sky becomes a stage: 20 golden notes crash across 650 px (×1.1 ATK each, 95 px) and a final chord explodes around you (×2.6 ATK, 340 px). ×(1 + 0.15 per active song). Ends the window.' },
      { id: 'death_knell', name: 'Death Knell', route: 'boss', seq: ['R', 'E', 'Q', 'E', 'R'], chains: [null, 'soft_refrain', null, null, 'death_knell'],
        desc: 'Encore → Healing Hymn → Soft Refrain → Sonic Riff → Echo Chord → Healing Hymn: a giant bell tolls three times over your target, then ONE guaranteed crit of ×(9 + 1 per active song) ATK, ×2 to everything within 250 px. Ends the window.' },
    ],
  },
};

CLASSES.warrior.basic = CLASSES.warrior.weapons.G.basic;
export const CLASS_IDS = Object.keys(CLASSES);
/** Player-facing renames (Blade Dancer -> Ninja, Cleric -> Paladin): the internal ids stay 'bladedancer' / 'cleric' so saves, gear and
 *  co-op keep working; these aliases map the new names back to the ids if they ever show up as a class id (saves, joins, weapons). */
export const CLASS_ALIAS = { ninja: 'bladedancer', paladin: 'cleric', blade_dancer: 'bladedancer', bladeDancer: 'bladedancer' };
export const classId = (c) => (typeof c === 'string' && !Object.prototype.hasOwnProperty.call(CLASSES, c) && CLASS_ALIAS[c]) || c;
// The SPECIAL (4th slot, key 'SP' = F by default) + its 4 Special chains per class (data/specials-data.js).
// Chains v2 (every class: four 2-step + three 3-step + three 4-step + two 5-step chains; ONLY the 5-steps use the Special).
export const FIVE = { k: 1.6, window: 220 }; // 5-step chains: the Special chain's steps ×1.5, then the finale step
const fmtN = (v) => String(Math.round(v * 100) / 100);
function fiveOf(c, sp, ch) {
  const f = ch.fx, F = ch.fin, last = ch.seq[ch.seq.length - 1], pre = c.chains.find((q) => q.id === ch.pre);
  const steps = f.steps.map((st) => ({ ...st, mul: st.mul * FIVE.k, ...(st.pop ? { pop: { ...st.pop, per: st.pop.per * FIVE.k } } : {}) }));
  steps.push({ t: f.dur + 4, at: F.at, range: F.range || 420, shape: 'circle', r: F.r, mul: F.mul, o: { heavy: true, hitstop: 10, bigNum: true, ...(F.o || {}) }, ...(F.stack ? { stack: F.stack } : {}), ...(F.pop ? { pop: F.pop } : {}), ...(F.wm ? { wm: F.wm } : {}), look: 'finale', fin: 1 });
  const dur = f.dur + 18;
  const eff = ch.desc.slice(ch.desc.indexOf(': ') + 2).replace(/×(\d+(?:\.\d+)?) ATK/g, (m, v) => `×${fmtN(v * FIVE.k)} ATK`);
  const where = F.at === 'tgt' ? 'on your target' : F.at === 'aim' ? 'at the cursor' : 'around you';
  const desc = `${pre ? pre.name : ch.seq.slice(0, 3).join(' ')} → ${sp.name} → ${c.skills[last].name}: ${eff.replace(/\.$/, '')}. FINALE: ${F.txt} (${where}, ${F.r} px, ×${F.mul} ATK).`;
  return { ...ch, five: true, window: FIVE.window, desc, fx: { ...f, dur, cancel: dur - 6, steps } };
}
/** 4-step chains (a tier between the 3-steps and the 5-steps; never the Special): every hit ×FOUR.mul (combat.js). */
export const FOUR = { mul: 1.35 };
function fourOf(c, ch) {
  const pre = c.chains.find((q) => q.id === ch.pre), last = ch.seq[ch.seq.length - 1];
  const eff = ch.desc.slice(ch.desc.indexOf(': ') + 2);
  return { ...ch, sp: undefined, desc: `${pre ? pre.name : ch.seq.slice(0, 3).join(' ')} → ${c.skills[last].name}: ${eff}` };
}
const BUCKET = (ch) => Math.min(ch.seq.length, 5);
for (const [id, k] of Object.entries(SPECIAL_KIT)) {
  const c = CLASSES[id];
  c.skills[SPK] = k.special;
  for (const ch of k.chains) c.chains.push(ch.seq.length === 5 ? fiveOf(c, k.special, { ...ch, sp: true }) : ch.four ? fourOf(c, ch) : ch.sp === false ? { ...ch, sp: undefined } : { ...ch, sp: true });
  for (const ch of c.chains) if (ch.seq.length === 4) ch.tier4 = true;
  c.chains = c.chains.map((ch, i) => [ch, i]).sort((a, b) => BUCKET(a[0]) - BUCKET(b[0]) || a[1] - b[1]).map((x) => x[0]); // panel order: 2-step, 3-step, 4-step, 5-step
}
export { SPK, SPECIAL_KIT };
export const SKILL_KEYS = ['Q', 'E', 'R', 'F', SPK];
/** A class's chain or Eclipse-route finisher by id (the finishers live in `routes`, outside the chain list). */
export function chainById(cls, id) { const c = CLASSES[cls] || cls; return (c.chains || []).find((q) => q.id === id) || (c.routes || []).find((q) => q.id === id) || null; }
/** Warrior Berserk (the ult; `p.rage` is its timer): basic swings are faster, longer-reaching and hit harder. */
export const RAGE = { speed: 0.75, range: 1.3, mul: 1.3, arc: 1.15 };
export const BERSERK = RAGE;
/** Warrior: a hold would empower (enough Rage to spend, or Berserk: every hit is empowered for free). */
export function rageOn(p) { const c = CLASSES[p.cls]; return !!(c && c.rageRes && (p.rage > 0 || p.res >= c.rageRules.min)); }
/** An empowered hit's damage multiplier from the Rage it spends (0-100 -> x1-x2); `bonus` = the Rage-spend damage gear stat. */
export const rageMulOf = (spent, bonus = 0) => 1 + (Math.max(0, Math.min(100, spent)) / 100) * (1 + (bonus || 0));
/** Rage a hold of `charge` ticks spends (0 = a tap): spendMin at the hold threshold, rising to spendMax at full charge, capped by
 *  what you have. Berserk: always a full, free 100. Returns 0 when it is not an empowered cast. */
export function rageSpendFor(p, charge) {
  const c = CLASSES[p.cls], R = c && c.rageRules;
  if (!R) return 0;
  if (p.rage > 0) return 100;
  if (!(charge >= R.tap) || p.res < R.min) return 0;
  const k = Math.max(0, Math.min(1, (charge - R.tap) / Math.max(1, R.full - R.tap)));
  return Math.min(p.res, R.spendMin + (R.spendMax - R.spendMin) * k);
}
/** The string hit spec for skill `key`, hit `n` (1-3). */
export function strHit(cls, key, n) {
  const sk = CLASSES[cls] && CLASSES[cls].skills[key];
  if (!sk || !sk.str) return null;
  const i = Math.max(0, Math.min(sk.str.length - 1, n - 1));
  return i === 0 && sk.stats ? { ...sk.str[0], ...sk.stats } : sk.str[i]; // (hit 1 = the skill's own stats: the tooltip numbers)
}
const rageCache = new WeakMap();
/** The rage version of a basic-attack spec (cached so the object identity is stable). */
export function rageSpec(b) {
  let r = rageCache.get(b);
  if (!r) {
    const f = (v) => Math.max(1, Math.round(v * RAGE.speed));
    r = { ...b, dur: f(b.dur), hit: f(b.hit), cancel: f(b.cancel), mul: b.mul * RAGE.mul, range: (b.range || 0) * RAGE.range, arc: (b.arc || 0) * RAGE.arc, rage: true };
    rageCache.set(b, r);
  }
  return r;
}
// Dodge rework (2026-10-19): a real directional dash, 3x the old distance (old 18 ticks @ 620 = 97 px; now the same 18 ticks @ 1860 =
// 291 px), 3 charges that refill one at a time (recharge ticks per charge), and NO i-frames for just pressing it: the
// dodge grants `evade` ticks (0.3 s) of i-frames only when a hit actually lands on you during the dash (a proper evade;
// sim/combat.js damagePlayer). Hard enrages / wipe mechanics pass raw and are never evaded. (cd = the gap after a dash.)
export const DODGE = { cost: 15, dur: 18, iframes: 0, evade: 18, speed: 930, cd: 10, charges: 3, recharge: 90 }; // (Oct 19 9:19 PM: the dash halved, 291 -> ~146 px; dur kept at 18 ticks: the same action lockout as before, so no DPS lost to the longer dash)
/** the old dodge (before 2026-10-19), kept for the before/after comparison (tests, media) */
export const DODGE_OLD = { dur: 18, iframes: 15, speed: 620 };
/** Sprint (2026-10-19): out of combat only (no damage dealt / taken for `calm` ticks and no live boss within bossR) */
/** the global cooldown (ticks): a plain class-skill / Special press starts it; chains, basics, dodge, sprint, the ultimate are off it */
export const GCD = 60;
/** a skill pressed in the last GCD_QUEUE ticks of the GCD is queued and fires when it ends */
export const GCD_QUEUE = 30;
export const SPRINT = { mul: 1.45, calm: 240, bossR: 1400 };
/** Dodge parameters for a class (classes may override cost/cd, e.g. the Blade Dancer's short cooldown). */
/** chains abide by the GCD (Oct 19 10:24 PM): every chain step window is at least the GCD + 40 ticks of reaction, so each chain stays completable */
export const CHAIN_WIN_MIN = GCD + 40;
for (const C of Object.values(CLASSES)) for (const ch of C.chains || []) if (ch.window != null && ch.window < CHAIN_WIN_MIN) { ch.window0 = ch.window; ch.window = CHAIN_WIN_MIN; }
// Skill rework (user, 2026-10-20 1:05 AM): every class is in boss form (sim/skillform.js) - near a boss the shadow performs the skills, the hero is never locked > 0.3 s.
for (const C of Object.values(CLASSES)) C.bossForm = true;
export function dodgeOf(cls) { const c = CLASSES[cls]; return c && c.dodge ? { ...DODGE, ...c.dodge } : DODGE; }
/** Number of hits in a class's basic combo, and the key of its last (finisher) hit ('B3', 'B5'...). */
export function comboLen(cls) { return (CLASSES[cls] || CLASSES.warrior).basic.length; }
export function finisherKey(cls) { return 'B' + comboLen(cls); }
export const APPEARANCE = {
  skin: ['#ffdbb5', '#f5c190', '#e0a370', '#c07f4f', '#8d5a34', '#5e3b22'],
  hairStyles: ['short', 'spiky', 'long', 'mohawk', 'bun', 'bald'],
  hairColors: ['#2b1d14', '#6b3b1d', '#c9772e', '#f2d15c', '#e8e8e8', '#e0463c', '#3f7ae0', '#9d4fe0'],
  outfits: ['#e84c3d', '#3a8ee8', '#3cc15b', '#f4b42a', '#9b59d6', '#1fbfb8', '#ec6fb0', '#555b66'],
};
export { S as TICKS_PER_SEC };
