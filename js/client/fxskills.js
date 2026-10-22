// Skill + chain VFX layer: one entry point (skFx) called for every sim event; class modules (skfx_<class>.js) supply the per-skill recipes.
//   skill  -> the class module's recipe for that skill id   (unless the cast completes a chain: then the chain's recipe plays instead)
//   chain  -> the chain's themes (class module list or keywords from its name), a trace line through the steps, tier extras; 5-step finishers get a full moment
//   ult    -> the class module's ult recipe;   attack -> its basic-combo recipe
import { makeKit, addPiece, SK_CINE, SK_UNDER, hash, TAU, seeded, registerPrims } from './fxsk_core.js';
import { THEMES, themesFromName } from './fxsk_themes.js';
import { chainById } from '../sim/data/classes.js';
import { momRoute } from './fxmoment.js';
import warrior from './skfx_warrior.js';
import ranger from './skfx_ranger.js';
import mage from './skfx_mage.js';
import cleric from './skfx_cleric.js';
import bladedancer from './skfx_bladedancer.js';
import samurai from './skfx_samurai.js';
import monk from './skfx_monk.js';
import dragoon from './skfx_dragoon.js';
import summoner from './skfx_summoner.js';
import bard from './skfx_bard.js';

export { SK_CINE, SK_UNDER };
export const SK_CLASSES = { warrior, ranger, mage, cleric, bladedancer, samurai, monk, dragoon, summoner, bard };
for (const m of Object.values(SK_CLASSES)) registerPrims(m.prims, m.underPrims);
const ALIAS = { ninja: 'bladedancer', paladin: 'cleric' };
const clsOf = (id) => SK_CLASSES[id] || SK_CLASSES[ALIAS[id]];

const TIER = { 2: { sc: 1.0, n: 1.0 }, 3: { sc: 1.25, n: 1.1 }, 4: { sc: 1.55, n: 1.25 }, 5: { sc: 1.9, n: 1.4 } };
const SELF_CHAIN_TARGET = new Set(['cyclone', 'wings', 'ward', 'blink']);

/** Returns what it drew ('skill' | 'chain' | 'route' | 'ult' | 'attack', or undefined): fx.js skips the old generic look for the same event. */
/** Public: the themes a chain will use (for the preview page's labels). */
export function chainThemes(cls, ch) {
  const m = clsOf(cls), spec = m && m.chains && m.chains[ch.id];
  if (typeof spec === 'function') return ['custom'];
  if (spec && spec.themes) return spec.themes;
  return themesFromName(ch.name);
}

function history(fx, pid) { const H = fx._skH || (fx._skH = new Map()); let h = H.get(pid); if (!h) H.set(pid, h = []); return h; }

export function skFx(fx, ev, me, sim) {
  const t = ev.type;
  if (t !== 'skill' && t !== 'chain' && t !== 'ult' && t !== 'attack') return;
  if (ev.cls == null && t !== 'chain') return;
  let cls = ev.cls;
  if (!cls) { const p = sim && sim.players && sim.players.get(ev.pid); cls = p && p.cls; }
  if (!cls) return;
  const mod = clsOf(cls); if (!mod) return;
  const hist = history(fx, ev.pid);
  if (t === 'skill') {
    hist.push({ x: ev.x, y: ev.y, ang: ev.ang, key: ev.key, time: fx.time || 0 }); if (hist.length > 8) hist.shift();
    if (ev.chain) return; // the chain event replaces the cast's own look
    const f = mod.skills && mod.skills[ev.skill]; if (!f) return;
    f(makeKit(fx, ev, sim, mod.pal), ev); return 'skill';
  }
  if (t === 'ult') { if (!mod.ult) return; mod.ult(makeKit(fx, { ...ev, ang: ev.ang ?? (hist.length ? hist[hist.length - 1].ang : 0) }, sim, mod.pal), ev); return 'ult'; }
  if (t === 'attack') { if (!mod.basic) return; mod.basic(makeKit(fx, ev, sim, mod.pal), ev); return 'attack'; }
  // ---- chain
  const ch = chainById(cls, ev.id) || chainById(ALIAS[cls] || cls, ev.id); if (!ch) return;
  const last = hist.length ? hist[hist.length - 1] : { x: ev.x, y: ev.y, ang: 0 };
  const k = makeKit(fx, { x: last.x, y: last.y, ang: last.ang, pid: ev.pid }, sim, mod.pal), tier = TIER[Math.min(5, ch.seq.length)] || TIER[2];
  const isRoute = !!ev.fin || !!ch.route || ch.seq.length >= 5, boss = ch.kind === 'boss' || isRoute, h = hash(ch.id), v = (h % 1000) / 1000;
  const s = { sc: tier.sc, n: tier.n, x: k.tx, y: k.ty, boss, v, a0: v * TAU, tier: Math.min(5, ch.seq.length) };
  // the trace through the steps this chain used
  const steps = hist.slice(-Math.min(hist.length, ch.seq.length)); const pts = steps.map((q, i) => ({ x: q.x, y: q.y, key: ch.seq[i] === 'SP' ? '★' : (/^B\d$/.test(ch.seq[i]) ? 'B' : ch.seq[i]) }));
  if (pts.length >= 2) { pts[pts.length - 1] = { x: k.tx, y: k.ty, key: '★' }; k.trace({ pts, col: mod.pal.a, hi: mod.pal.hi, life: 1.2 }); }
  const spec = mod.chains && mod.chains[ch.id];
  if (typeof spec === 'function') spec(k, s, ch);
  else { const names = (spec && spec.themes) || themesFromName(ch.name); const o = spec || {}; names.forEach((nm, i) => { const T = THEMES[nm]; if (!T) return; const ss = { ...s, sc: s.sc * (o.sc || 1) * (i ? 0.8 : 1), n: s.n * (o.n || 1), a0: s.a0 + i * 1.7, ...(SELF_CHAIN_TARGET.has(nm) && !boss ? { x: k.x + k.ca * 120, y: k.y + k.sa * 120 } : {}) }; try { T(k, o.col ? { ...ss } : ss); } catch (e) { /* a theme must never break the sim */ } }); }
  if (tier.sc >= 1.25) k.ring({ x: k.tx, y: k.ty, R: 150 * tier.sc, n: 2, col: mod.pal.a, d: 0.05 });
  if (tier.sc >= 1.55) { k.burst({ x: k.tx, y: k.ty - 20, n: 12, len: 190 * tier.sc, col: mod.pal.a, hi: mod.pal.hi, d: 0.08 }); k.kick(0.045); k.shake(0.5); }
  if (isRoute && momRoute(fx, { x: k.tx, y: k.ty, pid: ev.pid }, { id: ch.id, name: ch.name, cls, me: k.me, pal: mod.pal, route: mod.routes && mod.routes[ch.id] })) return 'route';
  return 'chain';
}
