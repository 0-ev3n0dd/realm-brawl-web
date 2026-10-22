// Part D (A3): the Astral skill variant. Every hero that reaches rank A3 unlocks ONE alternate skill: an astral version
// of one of its skills (same key, same cooldown and cost) with its own shape and effect - a sidegrade, not a power spike
// (tools/balance/alt-dps.mjs keeps the class's boss DPS with the variant within +-10% of the base kit). It is swapped in
// at the Ascension Altar (chainSet.alt, so it is saved with the hero and each loadout preset) and off by default.
// Key chains still fire from the key as before (a chain cast runs the chain); the variant replaces the plain cast only.
// Pure sim code: the player's areas go through combat.js like any skill (ATK, crits, gear).
import { addArea, healPlayer } from './combat.js';
import { DT } from './constants.js';
import { ascRank } from './ascended.js';

const TAU = Math.PI * 2;
//   k: aim (circle at the aim point, within range) · self (circle / ring on you) · line (along the aim) · blink (blink, then a circle)
export const ASC_ALT = {
  warrior: { key: 'Q', base: 'gs_cleave', name: 'Comet Greatsword', k: 'aim', range: 220, r: 150, delay: 16, mul: 1.9, o: { kb: 200, stagger: 30, heavy: true, hitstop: 5 }, desc: 'Hurl the Greatsword up and bring it down as a comet at your aim (220 px): ×1.9 ATK in 150 px, big knockback.' },
  ranger: { key: 'F', base: 'trap', name: 'Star Snare', k: 'aim', range: 320, r: 120, delay: 20, mul: 3.4, o: { root: 70, stagger: 10 }, desc: 'A constellation net drops on your aim (320 px): ×3.4 ATK in 120 px and roots for 1.2 s (no trap stays behind).' },
  mage: { key: 'F', base: 'nova', name: 'Starfrost Ring', k: 'self', r0: 70, r: 210, delay: 8, mul: 1.2, o: { freeze: 50, kb: 80, heavy: true }, desc: 'A ring of starfrost bursts around you (70-210 px): ×1.2 ATK, freezes 0.8 s. The middle stays clear.' },
  cleric: { key: 'Q', base: 'smite', name: 'Sunlance', k: 'line', len: 380, w: 80, delay: 8, mul: 2.4, heal: 0.015, o: { stagger: 20, kb: 160, hitstop: 4, stack: ['condemn', 2] }, desc: 'A lance of dawn down your aim (380 px): ×2.4 ATK, +2 Condemn; heals you 1.5% max HP.' },
  bladedancer: { key: 'Q', base: 'flicker', name: 'Starstep', k: 'blink', range: 200, r: 115, delay: 2, mul: 2.3, iframes: 12, o: { stagger: 12, hitstop: 3 }, desc: 'Step through the stars to your aim (200 px, i-frames) and cut everything round you: ×2.3 ATK in 115 px.' },
  samurai: { key: 'F', base: 'kesa_slash', name: 'Falling Star Kesa', k: 'line', len: 340, w: 100, delay: 10, mul: 2.2, o: { stagger: 26, kb: 120, heavy: true, hitstop: 6 }, desc: 'A long diagonal draw that falls like a star (340 px, 100 wide): ×2.2 ATK.' },
  monk: { key: 'F', base: 'iron_palm', name: 'Starpalm Wave', k: 'line', len: 320, w: 90, delay: 6, mul: 2.4, o: { stagger: 22, kb: 220, hitstop: 5 }, desc: 'A palm strike that sends a wave of starlight forward (320 px): ×2.4 ATK, pushes back.' },
  dragoon: { key: 'F', base: 'spear_throw', name: 'Comet Lance', k: 'aim', range: 520, r: 130, delay: 30, mul: 2.6, o: { stagger: 30, kb: 140, heavy: true, hitstop: 6 }, desc: 'Throw the spear high: it falls as a comet at your aim (520 px) after 0.5 s: ×2.6 ATK in 130 px.' },
  summoner: { key: 'E', base: 'frost_wyrm', name: 'Starwyrm Coil', k: 'self', r0: 50, r: 230, delay: 6, pulses: 3, every: 6, mul: 0.9, o: { slow: 120, slowMul: 0.6 }, desc: 'A wyrm of starlight coils round you (50-230 px): 3 pulses of ×0.9 ATK, slows.' },
  bard: { key: 'E', base: 'echo_chord', name: 'Starlight Chord', k: 'aim', range: 420, r: 170, delay: 14, pulses: 2, every: 10, mul: 0.55, partyHeal: 0.02, o: { stagger: 8 }, desc: 'A chord of starlight rings at your aim (420 px): 2 pulses of ×0.55 ATK in 170 px; heals the party near you 2% max HP.' },
};
export const altId = (cls) => 'alt_' + cls;
/** the variant is live: rank A3+ and switched on (chainSet.alt) */
export function altOn(p) { return !!(p && ASC_ALT[p.cls] && p.chainSet && p.chainSet.alt === 1 && Math.max(p.asc | 0, ascRank(p)) >= 3); }
/** the skill a key casts for p: the variant (when live and on this key) or null */
const SKC = {};
export function altSkill(p, key, base) {
  if (!altOn(p)) return null; const A = ASC_ALT[p.cls]; if (A.key !== key) return null;
  const id = altId(p.cls); return SKC[id] || (SKC[id] = { id, name: A.name, cd: base.cd, cost: base.cost, stats: { mul: A.mul, r: A.r, r0: A.r0, range: A.range, len: A.len, w: A.w }, desc: A.desc, alt: 1, icon: base.id });
}
function aimPoint(p, a, range) {
  const tx = a.data && Number.isFinite(a.data.tx) ? a.data.tx : p.x + Math.cos(a.ang) * range, ty = a.data && Number.isFinite(a.data.ty) ? a.data.ty : p.y + Math.sin(a.ang) * range;
  const d = Math.hypot(tx - p.x, ty - p.y); if (d <= range) return { x: tx, y: ty };
  return { x: p.x + ((tx - p.x) / d) * range, y: p.y + ((ty - p.y) / d) * range };
}
/** the skill handlers (player.js merges them into SKILLS) */
export const ALT_SKILLS = {};
for (const [cls, A] of Object.entries(ASC_ALT)) {
  ALT_SKILLS[altId(cls)] = {
    start(sim, p, a) {
      a.dur = A.dur || 16; a.cancel = A.cancel || 10; a.moveMul = A.k === 'self' ? 0.2 : 0.3;
      if (A.k === 'blink') { const t = aimPoint(p, a, A.range); a.data.bx = t.x; a.data.by = t.y; p.iframes = Math.max(p.iframes | 0, A.iframes || 0); }
    },
    tick(sim, p, a) {
      if (A.k === 'blink' && a.t < 4) { const k = 1 / (4 - a.t); p.x += (a.data.bx - p.x) * k; p.y += (a.data.by - p.y) * k; }
      if (a.t !== 4) return;
      let geo;
      if (A.k === 'aim') { const t = aimPoint(p, a, A.range); geo = { shape: 'circle', x: t.x, y: t.y, r: A.r }; }
      else if (A.k === 'self') geo = A.r0 ? { shape: 'donut', x: p.x, y: p.y, r0: A.r0, r: A.r } : { shape: 'circle', x: p.x, y: p.y, r: A.r };
      else if (A.k === 'line') geo = { shape: 'line', x: p.x, y: p.y, ang: a.ang, len: A.len, w: A.w };
      else geo = { shape: 'circle', x: p.x, y: p.y, r: A.r };
      addArea(sim, { team: 'player', ownerId: p.id, kind: 'ascalt', ...geo, delay: A.delay, pulses: A.pulses || 1, every: A.every || 1, o: { mul: A.mul, ...(A.o || {}) } });
      if (!sim.predicting) {
        if (A.heal) healPlayer(sim, p, p.stats.maxHp * A.heal, p);
        if (A.partyHeal) for (const q of sim.players.values()) if (!q.dead && Math.hypot(q.x - p.x, q.y - p.y) < 320) healPlayer(sim, q, q.stats.maxHp * A.partyHeal, p);
      }
      sim.emit({ type: 'ascalt', pid: p.id, cls, name: A.name, ...geo, delay: A.delay });
    },
  };
}
void DT; void TAU;
