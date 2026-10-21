// Boss rotation cycle (user-approved 2026-10-21, from the concepts/boss-rotations.html concept): BOSS TARGETS ONLY (boss form,
// sim/skillform.js bossNear). Mobbing is untouched.
//  * Bank: every chain finisher near a boss banks units of the class's signature mechanic (heavier chains bank more:
//    steps - 1, +1 for a boss chain). Banked units also fill the ult meter (+ULT per unit), so the opener fills the first ult.
//  * Hinge: the class's boss Special chain (the boss chain with the Special in it). The Special press releases the bank in
//    waves, the chain's finisher releases the rest and opens the class window (6 s): chains bank double inside it.
//    Near a boss the Special's cooldown is the cycle (BR.cd), so one Special per ~20 s.
//  * Ult: the real ultimate cast inside the window releases the whole bank ×BR.ultMul when the ult window ends. Classes
//    with `hold` (chosen by the optimizer) bank on the Special instead of releasing when the ult is ready, so the ult releases big.
import { CLASSES, SPK } from './data/classes.js';
import { hitEnemy, ROUTE_IDS, ULT } from './combat.js';
import { bossNear } from './skillform.js';

export const BR = { win: 360, waves: 3, wave: 0.2, waveGap: 18, per: 0.3, ultMul: 2.5, ultPerUnit: 3, spMeter: 12, cd: 16, spBank: 4, max: 80, grace: 240 };
/** per class: the bank's name (its real signature mechanic), the window's name, hold = bank on the Special in ult cycles */
export const BR_CLS = {
  samurai: { unit: 'Delayed Cuts', win: 'Resheathe', hold: true, mech: 'Delayed Cuts' },
  warrior: { unit: 'Bleed', win: 'Warpath Fury', hold: true, mech: 'Bleed' },
  ranger: { unit: 'Quarry', win: 'Deadeye Focus', hold: true, mech: 'Quarry' },
  mage: { unit: 'Burn', win: 'Kindled Surge', hold: true, mech: 'Burn' },
  cleric: { unit: 'Condemn', win: 'Dawnlight', hold: true, mech: 'Condemn' },
  bladedancer: { unit: 'Shadow Marks', win: 'Nightfall', hold: false, mech: 'Initiative / Marked for Death' },
  monk: { unit: 'Pressure Points', win: 'Open Meridians', hold: false, mech: 'Pressure Points' },
  dragoon: { unit: 'Impaled', win: "Wyrm's Ascent", hold: true, mech: 'Impaled' },
  summoner: { unit: 'Inked Pages', win: 'Open Grimoire', hold: true, mech: 'Ink + Chill' },
  bard: { unit: 'Crescendo', win: 'Fermata', hold: true, mech: 'Tempo + Dissonant' },
};
const SP_CHAIN = Object.fromEntries(Object.entries(CLASSES).map(([id, C]) => [id, (C.chains || []).find((c) => c.kind === 'boss' && c.seq.includes(SPK)) || null]));
export const spChainOf = (cls) => SP_CHAIN[cls];
export const bankOf = (ch) => Math.max(1, ch.seq.length - 1 + (ch.kind === 'boss' ? 1 : 0));

function st(p) { return p.br || (p.br = { bank: 0, win: 0, winEnd: -1, waves: [], base: 0, hold: false, ultIn: false, ultSp: -1, sp: 0, last: false, ults: 0 }); }
function bossOf(sim, p) {
  let best = null, bd = 1e9;
  for (const e of (sim.targetables ? sim.targetables() : sim.enemies)) if ((e.boss || e.raid) && !e.dead) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
  return best;
}
export const brActive = (sim, p) => !!(BR_CLS[p.cls] && !sim.predicting && !sim.noBossRot && bossNear(sim, p)); // (noBossRot: the concept preview page runs its own layer)
/** the window is open (or the chain that started inside it is still finishing) */
export const brWindow = (sim, p) => !!(p.br && (p.br.win > 0 || (p.br.last && sim.tick < p.br.winEnd + BR.grace)));

function meter(sim, p, n) {
  if (p.uw || p.eclipse || p.ult >= ULT.max || !(n > 0)) return;
  const b = p.ult; p.ult = Math.min(ULT.max, p.ult + n); p.ultGained = (p.ultGained || 0) + (p.ult - b);
  if (p.ult >= ULT.max) sim.emit({ type: 'ultGain', pid: p.id, x: p.x, y: p.y - 44, amount: Math.round((p.ult - b) * 10) / 10, bonus: 0, chain: null, full: true, br: 1 });
}
function release(sim, p, n, mul, ph) {
  const S = st(p); n = Math.min(S.bank, n); if (!(n > 0)) return 0;
  S.bank -= n; const e = bossOf(sim, p);
  if (e) hitEnemy(sim, p, e, { mul: n * BR.per * mul, ult: true, noPop: true, noFm: true, hitstop: ph === 'wave' ? 2 : 6, stagger: 8, kb: 0, br: ph, style: p.cls === 'samurai' ? 'samburst' : null });
  sim.emit({ type: 'brx', ph, pid: p.id, n, mul, bank: S.bank, x: e ? Math.round(e.x) : p.x, y: e ? Math.round(e.y) : p.y });
  return n;
}
/** a chain fired (sim/player.js startSkill / startBasic) */
export function brChain(sim, p, chain) {
  if (!chain || ROUTE_IDS.has(chain.id) || !brActive(sim, p)) return;
  const S = st(p), sp = SP_CHAIN[p.cls];
  if (sp && chain.id === sp.id) {
    if (S.hold) { S.hold = false; S.bank = Math.min(BR.max, S.bank + BR.spBank); sim.emit({ type: 'brx', ph: 'hold', pid: p.id, n: BR.spBank, bank: S.bank, x: p.x, y: p.y }); }
    else { S.waves = []; release(sim, p, S.bank, 1, 'fin'); }
    S.win = BR.win; S.winEnd = sim.tick + BR.win; S.last = false; meter(sim, p, BR.spMeter);
    sim.emit({ type: 'brx', ph: 'win', pid: p.id, bank: S.bank, x: p.x, y: p.y });
    return;
  }
  // a chain whose first press landed inside the window banks double (start ≈ now - 1 s GCD per extra step)
  const dbl = S.win > 0 || sim.tick - (chain.seq.length - 1) * 60 <= S.winEnd; S.last = dbl;
  const n = bankOf(chain) * (dbl ? 2 : 1); S.bank = Math.min(BR.max, S.bank + n); meter(sim, p, n * BR.ultPerUnit);
  sim.emit({ type: 'brx', ph: 'bank', pid: p.id, n, dbl: dbl ? 1 : undefined, bank: S.bank, x: p.x, y: p.y });
}
/** the Special was pressed (startSkill, key SP) */
export function brSpecial(sim, p) {
  if (!brActive(sim, p)) return;
  const S = st(p); S.sp++;
  S.hold = !!(BR_CLS[p.cls].hold && p.ult >= ULT.max);
  p.cds[SPK] = Math.round(BR.cd * 60); // near a boss the Special is the cycle
  S.base = S.bank; S.waves = S.hold ? [] : Array.from({ length: BR.waves }, (_, i) => sim.tick + i * BR.waveGap);
}
export function brUlt(sim, p) { if (!p.br && !brActive(sim, p)) return; const S = st(p); S.ultIn = brWindow(sim, p); S.ultSp = S.sp; S.ultCyc = S.sp; S.ults++; }
export function brUltEnd(sim, p) { const S = p.br; if (!S || S.ultSp < 0 || !brActive(sim, p)) return; release(sim, p, S.bank, S.ultIn ? BR.ultMul : 1, 'ult'); S.ultSp = -1; S.ultIn = false; S.last = false; }
/** per tick (updatePlayer) */
export function brTick(sim, p) {
  const S = p.br; if (!S) return;
  if (S.waves.length && sim.tick >= S.waves[0]) { S.waves.shift(); release(sim, p, Math.max(S.bank ? 1 : 0, Math.round(S.base * BR.wave)), 1, 'wave'); }
  if (S.win > 0) S.win--;
  if (!bossNear(sim, p) && (S.bank || S.win)) { S.bank = 0; S.win = 0; S.waves = []; S.last = false; } // leaving the boss drops the cycle
}
/** the bot / HUD: is the ult worth casting now (inside the window, one per Special cycle) */
export function brUltReady(sim, p) { const S = p.br; return !!(S && brWindow(sim, p) && S.ultCyc !== S.sp); }
