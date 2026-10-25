// Class-depth VFX (Warrior / Ranger / Mage / Cleric): state + stack feedback, the transformed chains and the ult-route
// finishers. Everything is driven by sim events (so every co-op client sees the same show) and drawn on canvas in the
// game's thick-ink style. The FX core calls `classFx` for these event types and the CINE / UNDER tables for cinematics.
import { INK, circle } from './art.js';
import { CLASSES } from '../sim/data/classes.js';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const S = (ticks) => ticks / 60;
const STACK_COL = { sunder: '#ff5a3c', quarry: '#7dff6a', burn: '#ff9a2a', condemn: '#ffd84a', bleed: '#ff2a44', chal: '#ffb52e', cut: '#ff8cc6' };
const STATE_COL = { warrior: '#ff8a2a', ranger: '#b8ff7a', mage: '#8fdcff', cleric: '#ffe27a', samurai: '#ffd6ec', monk: '#ffe58a', dragoon: '#bcd4ff', summoner: '#3ff0c8', bard: '#ff7ab8' };

export const CLASS_EVENTS = new Set(['fin', 'stack', 'classState', 'ultEnd', 'earthsplitter', 'maelstrom', 'skullsplitter', 'rageSpend', 'berserkFinale', 'rhythm', 'weave', 'weaveReady', 'strEnd', 'stormLance', 'deadeye', 'glacialCascade', 'shatterChain', 'supernova', 'holyNova', 'verdict',
  'snareWeb', 'ricochet', 'hawkstorm', 'steamBurst', 'cometStep', 'chronoField', 'divineStorm', 'aegisThrow', 'angel', 'absolution']);

// ------------------------------------------------------------------ helpers
function dark(fx, pid, life, a, col) { fx.cine.push({ kind: 'dark', t: 0, life, a, pid, col }); }
function endDark(fx, pid, after = 0.5) { for (const c of fx.cine) if (c.kind === 'dark' && c.pid === pid) c.life = Math.min(c.life, c.t + after); }
function flashMe(fx, me, k, col) { if (me) { fx.flash = Math.max(fx.flash || 0, k); fx.flashColor = col; } }
function bigNum(fx, x, y, n, col, size = 96, stroke = INK) { if (n > 0) fx.text(x, y, `${n}!!`, { size, color: col, pop: 3, life: 2.1, vy: -24, vx: 0, stroke }); }
function inward(fx, x, y, R, n, col, speed = 900) { // streaks rushing into a point (pulls)
  for (let i = 0; i < n; i++) { const a = rnd(0, TAU), d = rnd(R * 0.5, R); fx.add({ type: 'spark', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: -Math.cos(a) * speed, vy: -Math.sin(a) * speed, life: Math.min(0.5, d / speed), size: rnd(3, 6), color: col, drag: 1 }); }
}
function shards(fx, x, y, n, col, edge, sp = 420) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU); fx.add({ type: 'shard', x, y, vx: Math.cos(a) * rnd(sp * 0.4, sp), vy: Math.sin(a) * rnd(sp * 0.4, sp), life: rnd(0.4, 0.75), size: rnd(6, 13), color: col, edge, ang: a, drag: 0.9 }); } }
function plusses(fx, x, y, n, col = '#b8ffb0') { for (let i = 0; i < n; i++) fx.add({ type: 'plus', x: x + rnd(-40, 40), y: y + rnd(-30, 20), vy: rnd(-90, -40), vx: rnd(-20, 20), life: rnd(0.6, 1.1), size: rnd(5, 9), color: col, drag: 0.97 }); }
function capOf(kind, boss) { const C = { sunder: 'warrior', quarry: 'ranger', burn: 'mage', condemn: 'cleric', bleed: 'warrior', chal: 'warrior', impaled: 'dragoon', cut: 'samurai', pp: 'monk', chill: 'summoner', disso: 'bard' }[kind] || 'warrior'; const st = CLASSES[C].stack; return boss ? st.bossMax || st.max : st.max; }

// ------------------------------------------------------------------ events
export function classFx(fx, ev, me, sim) {
  switch (ev.type) {
    case 'stack': {
      const col = STACK_COL[ev.kind] || '#fff', e = sim && sim.enemyById ? sim.enemyById.get(ev.id) : sim && sim.enemies ? sim.enemies.find((q) => q.id === ev.id) : null;
      const cap = capOf(ev.kind, e && e.boss);
      fx.puffs(ev.x, ev.y + 10, 3, col, 7, 70, 0.3);
      const busy = fx.finStart && (fx.time || 0) - fx.finStart.t < 3; // no stack chatter over a finisher
      const seen = fx.maxSeen || (fx.maxSeen = new Map()), last = seen.get(ev.id + ev.kind);
      if (ev.n >= cap && !busy && !(last > (fx.time || 0) - 4)) { seen.set(ev.id + ev.kind, fx.time || 0); if (seen.size > 200) seen.clear(); fx.text(ev.x, ev.y - 6, `MAX ${ev.kind.toUpperCase()}!`, { size: 17, color: col, vy: -40, pop: 1.6, life: 0.9 }); fx.ring(ev.x, ev.y + 30, 44, col, 0.35, 6); }
      else if (me && !busy && ev.n < cap) fx.text(ev.x + 16, ev.y, `${ev.n}`, { size: 14, color: col, vy: -30, pop: 1.4, life: 0.5 });
      return true;
    }
    case 'classState': {
      const col = STATE_COL[CLASS_OF(sim, ev.pid)] || '#fff', name = stateName(sim, ev.pid);
      if (ev.fresh) { fx.ring(ev.x, ev.y + 10, 90, col, 0.4, 10); fx.sparks(ev.x, ev.y, -Math.PI / 2, 12, col, 360, Math.PI); if (me && name) fx.text(ev.x, ev.y - 70, name.toUpperCase() + '!', { size: 24, color: col, vy: -40, pop: 1.9, life: 1.0 }); }
      else fx.ring(ev.x, ev.y + 10, 60, col, 0.3, 6);
      return true;
    }
    case 'ultEnd': if (me && !ev.finisher) fx.text(ev.x, ev.y - 60, 'WINDOW CLOSED', { size: 15, color: '#c9b8d8', vy: -30, pop: 1.1, life: 0.8 }); return true;
    case 'verdict': fx.text(ev.x, ev.y, `VERDICT ×${ev.n}`, { size: 18 + Math.min(10, ev.n), color: '#ffd84a', vy: -45, pop: 1.8, life: 1.0 }); fx.add({ type: 'beam', x: ev.x, y: ev.y + 40, size: 34, color: 'rgba(255,230,120,.9)', life: 0.5 }); return true;

    // ---- Warrior
    case 'earthsplitter': {
      // five fissures tearing outward from the landing point, the ground splitting along each
      fx.shake(1); fx.slowmo(0.18, 0.35); flashMe(fx, me, 0.35, '#ffb070');
      fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.2, size: 320, color: '#ffe0b0' });
      fx.ring(ev.x, ev.y, ev.r, '#ff5a3c', 0.5, 16); fx.ring(ev.x, ev.y, ev.r * 1.6, '#fff1c4', 0.4, 8);
      for (const a of ev.angs || []) {
        const L = ev.len || 460, x2 = ev.x + Math.cos(a) * L, y2 = ev.y + Math.sin(a) * L;
        fx.add({ type: 'trail', x: ev.x, y: ev.y, x2, y2, life: 0.55, color: '#ff5a3c' });
        fx.add({ type: 'trail', x: ev.x, y: ev.y, x2, y2, life: 0.3, color: '#fff1c4' });
        for (let k = 1; k <= 3; k++) { const d = (k / 3) * L, cx = ev.x + Math.cos(a) * d, cy = ev.y + Math.sin(a) * d; fx.add({ type: 'crack', x: cx, y: cy, r: 60, life: 1.3, seed: rnd(0, 6), glow: true }); fx.chunks(cx, cy, 2, '#7a4a2a', 360); fx.puffs(cx, cy, 1, 'rgba(230,200,160,.85)', 12, 120, 0.5); }
      }
      fx.text(ev.x, ev.y - 100, `EARTHSPLITTER!${ev.n ? ' ×' + ev.n : ''}`, { size: 34, color: '#ff7a3c', vy: -40, pop: 2.2, life: 1.2, vx: 0 });
      return true;
    }
    case 'maelstrom':
      if (ev.ph === 'burst') {
        const c = fx.cine.find((q) => q.kind === 'tornado' && q.pid === ev.pid); if (c) c.life = Math.min(c.life, c.t + 0.15);
        fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.2, size: ev.r * 2.4, color: '#fff1c4' });
        fx.ring(ev.x, ev.y, ev.r + 40, '#ffffff', 0.45, 18); fx.ring(ev.x, ev.y, ev.r, '#ff8a2a', 0.5, 12);
        fx.sparks(ev.x, ev.y, 0, 34, '#ffd27a', 680, Math.PI); fx.puffs(ev.x, ev.y, 14, 'rgba(230,210,170,.9)', 22, 260, 0.6);
        fx.shake(0.9); flashMe(fx, me, 0.3, '#ffcf8a');
        fx.text(ev.x, ev.y - 100, `MAELSTROM BURST${ev.n ? ' ×' + ev.n : ''}!`, { size: 30, color: '#ffd27a', vy: -40, pop: 2.1, life: 1.1, vx: 0 });
        return true;
      }
      fx.cine.push({ kind: 'tornado', t: 0, life: 1.75, pid: ev.pid, x: ev.x, y: ev.y, r: ev.r, rt: ev.r });
      fx.text(ev.x, ev.y - 90, 'MAELSTROM!', { size: 30, color: '#ffd27a', vy: -40, pop: 2, life: 1.1, vx: 0 }); fx.shake(0.4);
      return true;
    case 'spin': {
      if (!ev.mael) return false;
      const c = fx.cine.find((q) => q.kind === 'tornado' && q.pid === ev.pid); if (c) { c.rt = ev.r; c.x = ev.x; c.y = ev.y; }
      if (Math.random() < 0.5) inward(fx, ev.x, ev.y, ev.r + 170, 3, '#e8d8b0', 700);
      return true;
    }
    case 'skullsplitter': {
      fx.add({ type: 'trail', x: ev.x, y: ev.y - 320, x2: ev.x, y2: ev.y, life: 0.25, color: '#ffae3b' });
      fx.add({ type: 'slash', x: ev.x, y: ev.y - 10, ang: Math.PI / 2, arc: 1.2, r: 70, life: 0.25, color: '#fff1c4', width: 20, dir: 1 });
      fx.ring(ev.x, ev.y, 180, '#ff5a3c', 0.5, 14); fx.ring(ev.x, ev.y, 110, '#fff1c4', 0.35, 10);
      fx.add({ type: 'crack', x: ev.x, y: ev.y + 10, r: 150, life: 1.4, seed: rnd(0, 6), glow: true });
      fx.sparks(ev.x, ev.y, -Math.PI / 2, 24, '#ffcf8a', 560, Math.PI); fx.chunks(ev.x, ev.y, 10, '#8a2a1a', 380);
      fx.shake(0.9); fx.slowmo(0.25, 0.25); flashMe(fx, me, 0.45, '#ffb070');
      bigNum(fx, ev.x, ev.y - 90, ev.dmg, '#ffcf6a', 78);
      fx.text(ev.x, ev.y - 40, `SKULLSPLITTER · ${ev.n} SUNDER · ×${ev.mul}`, { size: 18, color: '#ff8a5c', vy: -30, pop: 1.4, life: 1.4, vx: 0 });
      return true;
    }

    // ---- Ranger
    case 'stormLance':
      if (ev.ph === 'fire') {
        fx.add({ type: 'trail', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.4, color: '#c8ff9a' });
        fx.add({ type: 'trail', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.25, color: '#ffffff' });
        fx.cine.push({ kind: 'lance', t: 0, life: S(ev.t) + 0.1, fx: ev.fx, fy: ev.fy, x: ev.x, y: ev.y, dur: Math.max(0.05, S(ev.t)) });
        fx.ring(ev.x, ev.y, ev.r, 'rgba(160,255,120,.6)', 0.5, 5);
      } else {
        fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.16, size: 200, color: '#eaffd0' });
        fx.ring(ev.x, ev.y, ev.r, '#9dff6a', 0.45, 12);
        for (const [x, y] of ev.pts || []) { fx.add({ type: 'trail', x: ev.x, y: ev.y, x2: x, y2: y, life: 0.3, color: '#b8ff7a' }); fx.sparks(x, y, Math.atan2(y - ev.y, x - ev.x), 5, '#eaffd0', 380, 0.6); }
        fx.text(ev.x, ev.y - 70, `STORM LANCE ×${ev.n}`, { size: 26, color: '#b8ff7a', vy: -40, pop: 2, life: 1.1, vx: 0 }); fx.shake(0.5); flashMe(fx, me, 0.2, '#e0ffc0');
      }
      return true;
    case 'deadeye': {
      fx.cine.push({ kind: 'scope', t: 0, life: 0.5, x: ev.tx, y: ev.ty });
      fx.add({ type: 'trail', x: ev.x, y: ev.y, x2: ev.tx, y2: ev.ty, life: 0.35, color: '#e8ffb0' });
      fx.add({ type: 'trail', x: ev.x, y: ev.y, x2: ev.tx, y2: ev.ty, life: 0.2, color: '#ffffff' });
      fx.ring(ev.tx, ev.ty, 120, '#7dff6a', 0.4, 10); fx.sparks(ev.tx, ev.ty, Math.atan2(ev.ty - ev.y, ev.tx - ev.x), 20, '#eaffd0', 620, 0.7);
      fx.shake(0.6); fx.slowmo(0.2, 0.3); flashMe(fx, me, 0.3, '#f0ffd0');
      fx.text(ev.tx, ev.ty - 70, `DEADEYE · ${ev.n} QUARRY · ×${ev.mul}`, { size: 20, color: '#b8ff7a', vy: -35, pop: 1.8, life: 1.3, vx: 0 });
      return true;
    }

    // ---- Mage
    case 'glacialCascade': fx.ring(ev.x, ev.y, 160, '#bfefff', 0.45, 12); fx.text(ev.x, ev.y - 80, `GLACIAL CASCADE${ev.n ? ' ×' + ev.n : ''}`, { size: 26, color: '#9ad8ff', vy: -40, pop: 2, life: 1.1, vx: 0 }); fx.shake(0.4); flashMe(fx, me, 0.2, '#dff6ff'); return true;
    case 'shatterChain':
      if (ev.d > 0) fx.add({ type: 'trail', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.3, color: '#bfefff' });
      shards(fx, ev.x, ev.y, 10, '#dff6ff', '#6cc8ff', 460); fx.ring(ev.x, ev.y, (ev.r || 20) + 70, '#8fdcff', 0.35, 8); fx.shake(0.12);
      fx.text(ev.x, ev.y - 40, ev.d > 0 ? `CHAIN ${ev.d + 1}` : 'SHATTER', { size: 15, color: '#dff6ff', vy: -40, pop: 1.4, life: 0.7 });
      return true;
    case 'supernova':
      if (ev.ph === 'charge') { fx.cine.push({ kind: 'star', t: 0, life: S(ev.t) + 0.05, x: ev.x, y: ev.y, dur: Math.max(0.05, S(ev.t)) }); if (me) fx.text(ev.x, ev.y - 80, 'SUPERNOVA…', { size: 22, color: '#ffcf8a', vy: -20, pop: 1.5, life: 0.8, vx: 0 }); }
      else {
        fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.25, size: ev.r * 2.2, color: '#fff2c8' });
        fx.ring(ev.x, ev.y, ev.r * 1.3, '#ffffff', 0.5, 20); fx.ring(ev.x, ev.y, ev.r, '#ff9a2a', 0.55, 16); fx.ring(ev.x, ev.y, ev.r * 0.6, '#ff4a1a', 0.45, 12);
        fx.sparks(ev.x, ev.y, 0, 34, '#ffcf6a', 700, Math.PI); fx.puffs(ev.x, ev.y, 14, 'rgba(255,120,40,.8)', 26, 260, 0.7);
        fx.shake(1); fx.slowmo(0.3, 0.25); flashMe(fx, me, 0.6, '#ffe0a0');
        bigNum(fx, ev.x, ev.y - 90, ev.dmg, '#ffb03a', 80);
        fx.text(ev.x, ev.y - 36, `SUPERNOVA · ${ev.hits || 0} DETONATED`, { size: 18, color: '#fff', vy: -30, pop: 1.4, life: 1.4, vx: 0 });
      }
      return true;

    // ---- Cleric
    case 'holyNova':
      fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.22, size: ev.r * 2, color: '#fff8d8' });
      fx.ring(ev.x, ev.y, ev.r * 1.25, '#fff6c8', 0.5, 18); fx.ring(ev.x, ev.y, ev.r, '#ffd84a', 0.45, 12);
      for (let i = 0; i < 8; i++) { const a = i * (TAU / 8); fx.add({ type: 'beam', x: ev.x + Math.cos(a) * ev.r * 0.7, y: ev.y + Math.sin(a) * ev.r * 0.5, size: 26, color: 'rgba(255,240,170,.9)', life: 0.6 }); }
      plusses(fx, ev.x, ev.y, 14, '#fff3a0'); fx.shake(0.5); flashMe(fx, me, 0.35, '#fff6d0');
      fx.text(ev.x, ev.y - 90, 'HOLY NOVA!', { size: 30, color: '#ffe27a', vy: -40, pop: 2, life: 1.1, vx: 0 });
      return true;

    // ================= the 8th-chain set =================
    // ---- Warrior: Rage spent on a Rage chain / the Berserk Finale
    case 'rageSpend':
      if (ev.berserk) { // Berserk: every hit is empowered for free, so keep this one light (it fires on every cast; phones at 4x CPU)
        fx.ring(ev.x, ev.y + 10, 90, '#ff3b2b', 0.3, 8);
        fx.sparks(ev.x, ev.y, -Math.PI / 2, 6, '#ff5a3c', 420, Math.PI);
        if (me) fx.text(ev.x, ev.y - 84, `BERSERK ×${ev.mul}`, { size: 20, color: '#ff5a3c', vy: -35, pop: 1.6, life: 0.8, vx: 0 });
        return true;
      }
      if (ev.rhythm) { fx.ring(ev.x, ev.y + 10, 120, '#fff0a0', 0.3, 6); if (me) fx.text(ev.x, ev.y - 112, 'ON THE BEAT!', { size: 20, color: '#fff0a0', vy: -40, pop: 1.8, life: 0.7, vx: 0 }); }
      fx.ring(ev.x, ev.y + 10, 70 + (ev.spent || 0) * 0.8, '#ff3b2b', 0.4, 12);
      fx.sparks(ev.x, ev.y, -Math.PI / 2, 10 + Math.round((ev.spent || 0) / 6), '#ff5a3c', 460, Math.PI);
      fx.puffs(ev.x, ev.y, 6, 'rgba(255,70,40,.7)', 14, 160, 0.45);
      if (me) fx.text(ev.x, ev.y - 84, ev.berserk ? `BERSERK ×${ev.mul}` : `RAGE ${ev.spent} → ×${ev.mul}`, { size: 22, color: '#ff5a3c', vy: -35, pop: 1.9, life: 1.0, vx: 0 });
      fx.shake(0.25);
      return true;
    // ---- Warrior flow pass: rhythm press, basic-attack weave, rolling cooldowns (all light: they fire often)
    case 'rhythm': if (me) fx.ring(ev.x, ev.y + 70, 60, '#fff0a0', 0.22, 5); return true;
    case 'weaveReady': if (me) fx.ring(ev.x, ev.y + 70, 46, '#9dffb0', 0.25, 4); return true;
    case 'weave': if (me) fx.text(ev.x, ev.y - 30, `WEAVE → ${ev.key}②`, { size: 16, color: '#9dffb0', vy: -40, pop: 1.5, life: 0.6, vx: 0 }); return true;
    case 'strEnd':
      if (me && (ev.roll || ev.reset) && !ev.berserk) {
        const ks = Object.keys(ev.roll || {}).filter((k) => ev.roll[k] >= 6);
        if (ev.reset) fx.text(ev.x, ev.y - 150, `⟳ ${ev.reset} READY`, { size: 18, color: '#ffe27a', vy: -30, pop: 1.7, life: 0.9, vx: 0 });
        else if (ks.length) fx.text(ev.x, ev.y - 150, `ROLL ${ks.join(' ')} −70%`, { size: 15, color: '#8ff3ff', vy: -30, pop: 1.4, life: 0.7, vx: 0 });
      }
      return true;
    case 'berserkFinale':
      fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.25, size: ev.r * 2.6, color: '#ffd0a0' });
      fx.ring(ev.x, ev.y, ev.r * 1.3, '#fff1c4', 0.55, 20); fx.ring(ev.x, ev.y, ev.r, '#ff3b2b', 0.55, 16); fx.ring(ev.x, ev.y, ev.r * 0.55, '#ffae3b', 0.4, 10);
      fx.add({ type: 'crack', x: ev.x, y: ev.y + 10, r: ev.r, life: 1.8, seed: rnd(0, 6), glow: true });
      fx.chunks(ev.x, ev.y, 26, '#7a4a2a', 560); fx.sparks(ev.x, ev.y, -Math.PI / 2, 36, '#ffcf6a', 720, Math.PI);
      fx.shake(1); fx.slowmo(0.3, 0.3); flashMe(fx, me, 0.5, '#ff9a6a');
      fx.text(ev.x, ev.y - 120, 'BERSERK FINALE!', { size: 40, color: '#ff5a3c', vy: -30, pop: 2.4, life: 1.5, vx: 0 });
      return true;

    // ---- Ranger (forest green / spirit teal)
    case 'snareWeb':
      fx.cine.push({ kind: 'web', t: 0, life: 2.0, x: ev.x, y: ev.y, r: ev.r, traps: ev.traps || [] });
      for (const [x, y] of ev.traps || []) { fx.add({ type: 'flash', x, y, life: 0.16, size: 200, color: '#eaffd0' }); fx.ring(x, y, ev.tr, '#9dff6a', 0.45, 12); fx.sparks(x, y, -Math.PI / 2, 14, '#d8ff9a', 460, Math.PI); fx.add({ type: 'trail', x, y, x2: ev.x, y2: ev.y, life: 0.4, color: '#b8ff7a' }); }
      fx.ring(ev.x, ev.y, ev.r, '#b8ff7a', 0.5, 10); fx.shake(0.45); flashMe(fx, me, 0.22, '#e0ffc0');
      fx.text(ev.x, ev.y - 90, `SNARE WEB · ${ev.n} ROOTED`, { size: 26, color: '#b8ff7a', vy: -40, pop: 2, life: 1.2, vx: 0 });
      return true;
    case 'ricochet':
      if (ev.ph === 'fire') { fx.add({ type: 'trail', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.3, color: '#d8ff9a' }); fx.add({ type: 'trail', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.18, color: '#ffffff' }); }
      else if (ev.ph === 'hop') {
        fx.cine.push({ kind: 'beam2', t: 0, life: 0.28, fx: ev.fx, fy: ev.fy, x: ev.x, y: ev.y, w: 9 });
        fx.sparks(ev.x, ev.y, Math.atan2(ev.y - ev.fy, ev.x - ev.fx), 8, '#eaffb0', 420, 0.7); fx.ring(ev.x, ev.y, 46 + 6 * (ev.q || 0), '#7dff6a', 0.3, 6); fx.shake(0.12);
        fx.text(ev.x, ev.y - 44, `RICOCHET ${ev.i}${ev.q ? ' · Q' + ev.q : ''}`, { size: 14 + Math.min(10, ev.i * 1.5), color: '#d8ff9a', vy: -40, pop: 1.5, life: 0.6 });
      } else if (ev.i > 1) { fx.text(ev.x, ev.y - 80, `${ev.i}× RICOCHET!`, { size: 24, color: '#b8ff7a', vy: -40, pop: 2, life: 1.0, vx: 0 }); flashMe(fx, me, 0.15, '#e0ffc0'); }
      return true;
    case 'hawkstorm':
      if (ev.ph === 'call') {
        fx.ring(ev.x, ev.y, ev.r, 'rgba(120,255,220,.8)', 0.7, 6); fx.ring(ev.px, ev.py, 80, '#7dffd8', 0.4, 8);
        for (let i = 0; i < 10; i++) fx.add({ type: 'dot', x: ev.px + rnd(-30, 30), y: ev.py - 40, vx: rnd(-60, 60), vy: rnd(-420, -260), life: 0.6, size: rnd(3, 5), color: '#b8fff0', drag: 0.96 });
        flashMe(fx, me, 0.2, '#c8fff0'); fx.text(ev.x, ev.y - ev.r * 0.4 - 60, 'HAWKSTORM!', { size: 30, color: '#7dffd8', vy: -30, pop: 2.2, life: 1.3, vx: 0 });
      } else if (ev.ph === 'dive') fx.cine.push({ kind: 'hawk', t: 0, life: S(ev.fall) + 0.05, fx: ev.fx, fy: ev.fy, x: ev.x, y: ev.y, fall: S(ev.fall), side: ev.i % 2 ? 1 : -1 });
      else { fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.1, size: 110, color: '#dfffff' }); fx.ring(ev.x, ev.y, ev.r, '#7dffd8', 0.3, 7); fx.sparks(ev.x, ev.y, -Math.PI / 2, 8, '#b8fff0', 380, Math.PI); for (let k = 0; k < 4; k++) fx.add({ type: 'shard', x: ev.x, y: ev.y, vx: rnd(-200, 200), vy: rnd(-260, -80), life: 0.6, size: 7, color: '#e8fff8', edge: '#3ad0a8', ang: rnd(0, TAU), drag: 0.9 }); fx.shake(0.1); }
      return true;

    // ---- Mage (arcane blue / ember orange)
    case 'steamBurst':
      fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.2, size: ev.r * 2.2, color: '#f4fbff' });
      fx.ring(ev.x, ev.y, ev.r, '#bfefff', 0.5, 14); fx.ring(ev.x, ev.y, ev.r * 1.2, '#ff9a2a', 0.4, 6);
      for (const [x, y, n] of ev.hits || []) { fx.puffs(x, y, 6 + n, 'rgba(235,245,255,.85)', 26 + n * 3, 240, 0.9); fx.ring(x, y, 60 + n * 12, '#ffcf8a', 0.35, 8); fx.sparks(x, y, -Math.PI / 2, 6 + n, '#ffffff', 420, Math.PI); if (n >= 5) fx.text(x, y - 50, `STEAM ×${n}`, { size: 16 + n, color: '#ffe0c0', vy: -50, pop: 1.6, life: 0.8 }); }
      fx.puffs(ev.x, ev.y, 10, 'rgba(220,240,255,.6)', 30, 200, 1.1);
      fx.shake(0.4 + Math.min(0.5, (ev.hits || []).length * 0.08)); flashMe(fx, me, 0.25, '#e8f6ff');
      if (ev.dmg > 0) bigNum(fx, ev.x, ev.y - 110, ev.dmg, '#dff6ff', 64, '#1a3a5a');
      fx.text(ev.x, ev.y - 70, `STEAM BURST · ${(ev.hits || []).length} BOILED`, { size: 22, color: '#bfefff', vy: -40, pop: 1.9, life: 1.2, vx: 0 });
      return true;
    case 'cometStep':
      fx.cine.push({ kind: 'drop', t: 0, life: S(ev.t) + 0.02, x: ev.fx, y: ev.fy, fall: Math.max(0.05, S(ev.t)), style: 'meteor', r: ev.r });
      fx.cine.push({ kind: 'comet', t: 0, life: 0.9, x: ev.fx, y: ev.fy, r: ev.r, delay: S(ev.t) });
      fx.add({ type: 'trail', x: ev.fx, y: ev.fy, x2: ev.x, y2: ev.y, life: 0.35, color: '#8fdcff' });
      flashMe(fx, me, 0.2, '#cfeaff'); fx.text(ev.fx, ev.fy - 100, 'COMET STEP!', { size: 28, color: '#ffae5a', vy: -30, pop: 2, life: 1.1, vx: 0 });
      return true;
    case 'chronoField':
      if (ev.ph === 'start') {
        fx.cine.push({ kind: 'clock', t: 0, life: S(ev.t) + 0.1, x: ev.x, y: ev.y, r: ev.r, dur: S(ev.t) });
        fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.18, size: ev.r * 2, color: '#e8e0ff' }); fx.slowmo(0.2, 0.3); flashMe(fx, me, 0.25, '#d8d0ff');
        fx.text(ev.x, ev.y - ev.r - 30, `CHRONO FIELD${ev.n ? ' · ' + ev.n + ' FROZEN' : ''}`, { size: 26, color: '#c8b8ff', vy: -20, pop: 2, life: 1.2, vx: 0 });
      } else {
        fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.25, size: ev.r * 2.6, color: '#ffffff' });
        fx.ring(ev.x, ev.y, ev.r * 1.3, '#c8b8ff', 0.5, 16); fx.ring(ev.x, ev.y, ev.r, '#ff9a2a', 0.45, 10);
        for (const [x, y, n] of ev.hits || []) { shards(fx, x, y, 8 + n * 2, '#ece6ff', '#8a6cff', 520); if (n) fx.ring(x, y, 40 + n * 14, '#ffae5a', 0.35, 8); }
        fx.shake(0.8); fx.slowmo(0.25, 0.25); flashMe(fx, me, 0.45, '#ece6ff');
        if (ev.dmg > 0) bigNum(fx, ev.x, ev.y - 120, ev.dmg, '#d8c8ff', 76, '#2a1a5a');
        fx.text(ev.x, ev.y - 70, 'TIME SHATTERS!', { size: 22, color: '#fff', vy: -30, pop: 1.6, life: 1.2, vx: 0 });
      }
      return true;

    // ---- Cleric (holy gold / white)
    case 'divineStorm':
      if (ev.ph === 'call') { fx.ring(ev.x, ev.y, 90, '#fff6c8', 0.4, 10); fx.add({ type: 'beam', x: ev.x, y: ev.y, size: 40, color: 'rgba(255,245,200,.95)', life: 0.4 }); flashMe(fx, me, 0.25, '#fffbe0'); fx.text(ev.x, ev.y - 110, 'DIVINE STORM!', { size: 30, color: '#ffe27a', vy: -30, pop: 2.2, life: 1.2, vx: 0 }); }
      else {
        fx.cine.push({ kind: 'bolt', t: 0, life: 0.32, fx: ev.fx, fy: ev.fy, x: ev.x, y: ev.y, seed: rnd(0, 99) });
        fx.cine.push({ kind: 'bolt', t: 0, life: 0.22, fx: ev.x + rnd(-20, 20), fy: ev.y - 520, x: ev.x, y: ev.y, seed: rnd(0, 99) });
        fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.12, size: 150, color: '#fffbe8' }); fx.ring(ev.x, ev.y, 70, '#ffd84a', 0.3, 8);
        fx.sparks(ev.x, ev.y, -Math.PI / 2, 10, '#fff3a0', 460, Math.PI); if (ev.healed > 0) plusses(fx, ev.fx, ev.fy, 2, '#fff3a0'); fx.shake(0.18);
        if (ev.i > 0) fx.text(ev.x, ev.y - 50, `JUMP ${ev.i + 1}`, { size: 14 + Math.min(10, ev.i * 1.4), color: '#fff3a0', vy: -40, pop: 1.4, life: 0.6 });
      }
      return true;
    case 'aegisThrow':
      if (ev.ph === 'throw' || ev.ph === 'bounce' || ev.ph === 'return') fx.cine.push({ kind: 'disc', t: 0, life: ev.ph === 'return' ? 0.3 : 0.18, fx: ev.fx, fy: ev.fy, x: ev.x, y: ev.y });
      if (ev.ph === 'throw') { fx.text(ev.fx, ev.fy - 90, 'AEGIS THROW!', { size: 28, color: '#ffe27a', vy: -30, pop: 2, life: 1.1, vx: 0 }); flashMe(fx, me, 0.15, '#fffbe0'); }
      else if (ev.ph === 'bounce') { fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.1, size: 120, color: '#fff6c8' }); fx.ring(ev.x, ev.y, 60, '#ffd84a', 0.3, 8); fx.sparks(ev.x, ev.y, Math.atan2(ev.y - ev.fy, ev.x - ev.fx), 10, '#fff3a0', 480, 0.8); fx.shake(0.15); fx.text(ev.x, ev.y - 44, `CLANG ${ev.i}`, { size: 14 + Math.min(10, ev.i * 1.5), color: '#ffe27a', vy: -40, pop: 1.4, life: 0.6 }); }
      else if (ev.ph === 'return' && ev.n > 0) { fx.ring(ev.x, ev.y, 70, '#9fe0ff', 0.45, 10); fx.text(ev.x, ev.y - 70, `${ev.n} BOUNCES · +${ev.shield || 0} SHIELD`, { size: 18, color: '#cfefff', vy: -30, pop: 1.5, life: 1.1, vx: 0 }); }
      return true;
    case 'angel':
      if (ev.ph === 'summon') {
        fx.cine.push({ kind: 'angel', t: 0, life: S(ev.t), pid: ev.pid, x: ev.x, y: ev.y });
        fx.add({ type: 'beam', x: ev.x, y: ev.y, size: 70, color: 'rgba(255,248,210,.95)', life: 0.8 }); fx.ring(ev.x, ev.y, 130, '#fff6c8', 0.6, 12);
        plusses(fx, ev.x, ev.y, 10, '#fff3a0'); fx.shake(0.35); flashMe(fx, me, 0.35, '#fffbe8');
        fx.text(ev.x, ev.y - 140, 'GUARDIAN ANGEL!', { size: 30, color: '#fff3a0', vy: -30, pop: 2.2, life: 1.4, vx: 0 });
      } else if (ev.ph === 'echo') {
        fx.add({ type: 'trail', x: ev.px, y: ev.py - 90, x2: ev.x, y2: ev.y, life: 0.3, color: '#fff6c8' });
        fx.add({ type: 'beam', x: ev.x, y: ev.y, size: 34, color: 'rgba(255,245,200,.9)', life: 0.45 }); fx.ring(ev.x, ev.y, ev.r, '#fff6c8', 0.35, 8);
        fx.text(ev.x, ev.y - 60, 'ECHO', { size: 16, color: '#fff6c8', vy: -40, pop: 1.4, life: 0.6 });
      } else { for (const c of fx.cine) if (c.kind === 'angel' && c.pid === ev.pid) c.life = Math.min(c.life, c.t + 0.4); fx.sparks(ev.x, ev.y - 80, -Math.PI / 2, 12, '#fff6c8', 300, Math.PI); }
      return true;
    case 'absolution':
      fx.add({ type: 'flash', x: ev.x, y: ev.y, life: 0.25, size: ev.r * 2, color: '#fffbe8' });
      fx.ring(ev.x, ev.y, ev.r, '#ffd84a', 0.6, 10); fx.ring(ev.x, ev.y, ev.r * 0.5, '#fff6c8', 0.45, 16);
      for (const [x, y, n] of ev.hits || []) { fx.cine.push({ kind: 'drop', t: 0, life: 0.45, x, y, fall: 0.08, style: 'pillar', r: 50 + n * 8 }); fx.add({ type: 'trail', x, y, x2: ev.x, y2: ev.y, life: 0.45, color: '#fff3a0' }); fx.text(x, y - 50, `${n}`, { size: 18 + n * 2, color: '#ffd84a', vy: -50, pop: 1.8, life: 0.8 }); }
      plusses(fx, ev.x, ev.y, 10 + Math.min(20, ev.n || 0), '#b8ffb0'); fx.shake(0.7); fx.slowmo(0.2, 0.25); flashMe(fx, me, 0.45, '#fffbe0');
      if (ev.dmg > 0) bigNum(fx, ev.x, ev.y - 130, ev.dmg, '#ffe27a', 78);
      fx.text(ev.x, ev.y - 80, `ABSOLUTION · ${ev.n || 0} CONDEMN · +${ev.healed || 0} HP`, { size: 20, color: '#fff', vy: -30, pop: 1.5, life: 1.4, vx: 0 });
      return true;

    case 'fin': return finFx(fx, ev, me);
  }
  return false;
}
function CLASS_OF(sim, pid) { const p = sim && sim.players && sim.players.get(pid); return p ? p.cls : null; }
function stateName(sim, pid) { const c = CLASS_OF(sim, pid), st = c && CLASSES[c].state; return st ? st.name : ''; }

// ------------------------------------------------------------------ finishers (one cinematic each)
const BANNERS = {
  worldbreaker: ['WORLDBREAKER!', '#ffae3b'], titans_execution: ["TITAN'S EXECUTION", '#ff5a3c'],
  skyfall: ['SKYFALL!', '#b8ff7a'], heavens_arrow: ["HEAVEN'S ARROW", '#eaffb0'],
  armageddon: ['ARMAGEDDON!', '#ff8a2a'], singularity: ['SINGULARITY', '#c8a0ff'],
  rapture: ['RAPTURE!', '#ffe27a'], heavens_judgment: ["HEAVEN'S JUDGMENT", '#fff6c8'],
};
function finFx(fx, ev, me) {
  const [title, col] = BANNERS[ev.fid] || [ev.fid, '#fff'];
  const { x, y } = ev;
  if (ev.ph === 'start') fx.finStart = { pid: ev.pid, fid: ev.fid, t: fx.time || 0 };
  switch (ev.fid + ':' + ev.ph) {
    // ---- Warrior: Worldbreaker (sky leap, crater pull, three shockwave rings)
    case 'worldbreaker:start':
      dark(fx, ev.pid, 3.2, 0.5, 'rgba(30,10,0,');
      fx.cine.push({ kind: 'leap', t: 0, life: S(ev.leap) + 0.05, fx: ev.fx, fy: ev.fy, x, y, dur: S(ev.leap), r: 90 });
      fx.puffs(ev.fx, ev.fy + 10, 14, 'rgba(120,100,80,.8)', 20, 180, 0.6); fx.shake(0.3);
      if (me) fx.banner(title, col, 'THE WHOLE SCREEN FALLS IN', 1.4, 60);
      break;
    case 'worldbreaker:impact':
      fx.finAt = { pid: ev.pid, t: fx.time };
      fx.add({ type: 'flash', x, y, life: 0.2, size: 320, color: '#fff0c8' });
      fx.ring(x, y, ev.r, '#e0b070', 0.7, 22); fx.ring(x, y, 260, '#ff8a2a', 0.5, 18);
      inward(fx, x, y, ev.r, 60, '#d8b890', 1500); fx.chunks(x, y, 30, '#6d5a48', 620);
      fx.add({ type: 'crack', x, y: y + 10, r: 360, life: 2.6, seed: rnd(0, 6), glow: true });
      fx.cine.push({ kind: 'crater', t: 0, life: 2.4, x, y, R: 170 });
      fx.shake(1); fx.slowmo(0.3, 0.25); flashMe(fx, me, 0.7, '#ffe0b0');
      fx.text(x, y - 60, `${ev.n} PULLED`, { size: 22, color: '#ffd27a', vy: -30, pop: 1.6, life: 1.3, vx: 0 });
      break;
    case 'worldbreaker:ring':
      fx.ring(x, y, ev.r, ev.i % 2 ? '#fff0c8' : '#ff9a4a', 0.5, 18 - ev.i * 3);
      for (let i = 0; i < 18; i++) { const a = i * (TAU / 18) + ev.i; fx.chunks(x + Math.cos(a) * ev.r, y + Math.sin(a) * ev.r * 0.8, 1, '#7a6450', 220); }
      fx.puffs(x, y, 8, 'rgba(160,130,100,.6)', 26, ev.r * 1.6, 0.6); fx.shake(0.55);
      break;
    case 'worldbreaker:end': endDark(fx, ev.pid, 0.4); bigNum(fx, x, y - 120, ev.dmg, '#ffcf6a', 96); break;

    // ---- Warrior: Titan's Execution (a colossal sword drops from the sky)
    case 'titans_execution:start':
      dark(fx, ev.pid, S(ev.impact) + 1.2, 0.62, 'rgba(24,4,0,');
      fx.cine.push({ kind: 'sword', t: 0, life: S(ev.impact) + 1.3, x, y, fall: S(ev.impact), size: 1 + 0.12 * (ev.n || 0), gold: false, r: ev.r });
      if (me) fx.banner(title, col, `${ev.n} SUNDER · ×${ev.mul} ATK · GUARANTEED CRIT`, 1.2, 58);
      fx.shake(0.3);
      break;
    case 'titans_execution:impact': {
      fx.finAt = { pid: ev.pid, t: fx.time };
      const r = ev.r || 30;
      fx.add({ type: 'flash', x, y, life: 0.2, size: r * 3 + 170, color: '#fff0d0' });
      fx.ring(x, y, r + 300, '#fff1c4', 0.6, 26); fx.ring(x, y, r + 170, '#ff5a3c', 0.5, 18); fx.ring(x, y, 200, '#ff9a4a', 0.45, 12);
      fx.add({ type: 'crack', x, y: y + 10, r: 320, life: 2.4, seed: rnd(0, 6), glow: true });
      fx.sparks(x, y, -Math.PI / 2, 40, '#ffcf8a', 760, Math.PI); fx.chunks(x, y, 26, '#5a3a2a', 560);
      fx.shake(1); fx.slowmo(0.35, 0.2); flashMe(fx, me, 0.75, '#ffd8b0'); endDark(fx, ev.pid, 0.7);
      bigNum(fx, x, y - r - 30, ev.dmg, '#ffe07a', 86, '#3a0c00');
      fx.text(x, y - r - 4, ev.killed ? 'EXECUTED!' : `${ev.n} SUNDER`, { size: 24, color: '#ff8a5c', vy: -30, pop: 1.6, life: 1.6, vx: 0 });
      break;
    }

    // ---- Ranger: Skyfall (waves of exploding arrows across the screen)
    case 'skyfall:start':
      dark(fx, ev.pid, 2.4, 0.42, 'rgba(4,18,8,');
      fx.ring(x, y, ev.r, 'rgba(160,255,120,.5)', 0.8, 6); fx.sparks(x, y, -Math.PI / 2, 26, '#d8ffb0', 700, 0.3);
      if (me) fx.banner(title, col, 'THE SKY OPENS', 1.3, 60);
      break;
    case 'skyfall:wave':
      for (const [px, py] of ev.pts) fx.cine.push({ kind: 'drop', t: 0, life: S(ev.fall) + 0.02, x: px, y: py, fall: S(ev.fall), style: 'arrow' });
      fx.shake(0.12);
      break;
    case 'skyfall:end': fx.finAt = { pid: ev.pid, t: fx.time }; endDark(fx, ev.pid, 0.4); bigNum(fx, x, y - 140, ev.dmg, '#d8ff9a', 90); fx.text(x, y - 90, `${ev.n} ARROW HITS`, { size: 20, color: '#fff', vy: -30, pop: 1.4, life: 1.4, vx: 0 }); break;

    // ---- Ranger: Heaven's Arrow (charge, then one colossal beam shot)
    case 'heavens_arrow:start':
      dark(fx, ev.pid, S(ev.charge) + 1, 0.6, 'rgba(2,12,6,');
      fx.cine.push({ kind: 'charge', t: 0, life: S(ev.charge) + 0.1, x, y, tx: ev.tx, ty: ev.ty, dur: S(ev.charge), n: ev.n || 0 });
      if (me) fx.banner(title, col, `${ev.n} QUARRY`, 1.1, 58);
      break;
    case 'heavens_arrow:release':
      fx.finAt = { pid: ev.pid, t: fx.time };
      fx.cine.push({ kind: 'beam2', t: 0, life: 0.7, fx: ev.fx, fy: ev.fy, x: ev.x, y: ev.y, w: 60 + (ev.n || 0) * 6 });
      fx.add({ type: 'flash', x: ev.tx, y: ev.ty, life: 0.2, size: 240, color: '#f4ffe0' });
      fx.ring(ev.tx, ev.ty, 260, '#eaffb0', 0.55, 20); fx.ring(ev.tx, ev.ty, 150, '#7dff6a', 0.45, 14);
      fx.sparks(ev.tx, ev.ty, ev.ang, 40, '#f4ffe0', 900, 0.9);
      fx.shake(1); fx.slowmo(0.3, 0.2); flashMe(fx, me, 0.7, '#f4ffe0'); endDark(fx, ev.pid, 0.6);
      bigNum(fx, ev.tx, ev.ty - 80, ev.dmg, '#eaffb0', 86, '#0a2a08');
      fx.text(ev.tx, ev.ty - 40, ev.killed ? 'SKEWERED!' : `${ev.n} QUARRY · ×${ev.mul}${ev.others ? ` · +${ev.others} PIERCED` : ''}`, { size: 20, color: '#b8ff7a', vy: -30, pop: 1.5, life: 1.5, vx: 0 });
      break;

    // ---- Mage: Armageddon (a meteor shower)
    case 'armageddon:start':
      dark(fx, ev.pid, 2.2, 0.55, 'rgba(40,6,0,');
      fx.cine.push({ kind: 'redsky', t: 0, life: 2.0, pid: ev.pid });
      if (me) fx.banner(title, col, 'THE SKY BURNS', 1.3, 60);
      fx.shake(0.3);
      break;
    case 'armageddon:meteor': fx.cine.push({ kind: 'drop', t: 0, life: S(ev.fall) + 0.02, x, y, fall: S(ev.fall), style: 'meteor', r: ev.r }); break;
    case 'armageddon:land':
      fx.add({ type: 'flash', x, y, life: 0.16, size: ev.r * 2, color: '#ffe0a0' });
      fx.ring(x, y, ev.r * 1.3, '#ff9a2a', 0.45, 14); fx.chunks(x, y, 8, '#4a2a1a', 380); fx.puffs(x, y, 6, 'rgba(255,110,30,.85)', 22, 180, 0.6);
      fx.add({ type: 'crack', x, y: y + 6, r: ev.r * 1.4, life: 2, seed: rnd(0, 6), glow: true });
      fx.shake(0.28);
      break;
    case 'armageddon:end': fx.finAt = { pid: ev.pid, t: fx.time }; endDark(fx, ev.pid, 0.4); bigNum(fx, x, y - 140, ev.dmg, '#ffb03a', 90); fx.text(x, y - 90, `${ev.n} METEOR HITS`, { size: 20, color: '#fff', vy: -30, pop: 1.4, life: 1.4, vx: 0 }); break;

    // ---- Mage: Singularity (a black hole holds the boss, then collapses)
    case 'singularity:start':
      dark(fx, ev.pid, S(ev.hold) + 1, 0.55, 'rgba(10,0,24,');
      fx.cine.push({ kind: 'hole', t: 0, life: S(ev.hold) + 0.45, x, y, R: ev.r, hold: S(ev.hold), n: ev.n || 0 });
      if (me) fx.banner(title, col, `${ev.n} BURN`, 1.1, 58);
      fx.shake(0.4);
      break;
    case 'singularity:collapse':
      fx.finAt = { pid: ev.pid, t: fx.time };
      fx.add({ type: 'flash', x, y, life: 0.2, size: ev.r * 1.4, color: '#f0e0ff' });
      fx.ring(x, y, ev.r * 1.5, '#ffffff', 0.6, 24); fx.ring(x, y, ev.r, '#b28cff', 0.5, 18); fx.ring(x, y, ev.r * 0.5, '#ff9a2a', 0.4, 12);
      fx.sparks(x, y, 0, 44, '#e0c8ff', 820, Math.PI); fx.puffs(x, y, 16, 'rgba(90,40,160,.8)', 28, 300, 0.7);
      fx.shake(1); fx.slowmo(0.35, 0.2); flashMe(fx, me, 0.7, '#e8d8ff'); endDark(fx, ev.pid, 0.6);
      bigNum(fx, x, y - 90, ev.dmg, '#e0c8ff', 86, '#1a0033');
      fx.text(x, y - 46, ev.killed ? 'ERASED!' : `${ev.n} BURN · ×${ev.mul}`, { size: 22, color: '#ffb03a', vy: -30, pop: 1.5, life: 1.5, vx: 0 });
      break;

    // ---- Cleric: Rapture (pillars of light all over the screen, then a party heal)
    case 'rapture:start':
      dark(fx, ev.pid, 2.4, 0.4, 'rgba(30,24,0,');
      fx.cine.push({ kind: 'halo', t: 0, life: 2.2, pid: ev.pid, x, y });
      if (me) fx.banner(title, col, 'LIGHT FROM ABOVE', 1.3, 60);
      break;
    case 'rapture:pillar': fx.cine.push({ kind: 'drop', t: 0, life: S(ev.fall) + 0.35, x, y, fall: S(ev.fall), style: 'pillar', r: ev.r }); break;
    case 'rapture:end':
      fx.finAt = { pid: ev.pid, t: fx.time }; endDark(fx, ev.pid, 0.4);
      fx.ring(x, y, 520, '#fff6c8', 0.7, 20); fx.ring(x, y, 300, '#b8ffb0', 0.55, 14); plusses(fx, x, y, 26, '#c8ffb0');
      flashMe(fx, me, 0.45, '#fff8d8');
      bigNum(fx, x, y - 140, ev.dmg, '#ffe27a', 90);
      fx.text(x, y - 90, `PARTY HEALED +${ev.healed || 0}`, { size: 22, color: '#b8ffb0', vy: -30, pop: 1.6, life: 1.6, vx: 0 });
      break;

    // ---- Cleric: Heaven's Judgment (a winged sword of light)
    case 'heavens_judgment:start':
      dark(fx, ev.pid, S(ev.impact) + 1.2, 0.5, 'rgba(26,20,0,');
      fx.cine.push({ kind: 'sword', t: 0, life: S(ev.impact) + 1.3, x, y, fall: S(ev.impact), size: 1 + 0.08 * (ev.n || 0), gold: true, r: ev.r });
      if (me) fx.banner(title, col, `${ev.n} CONDEMN`, 1.2, 58);
      break;
    case 'heavens_judgment:impact': {
      fx.finAt = { pid: ev.pid, t: fx.time };
      const r = ev.r || 30;
      fx.add({ type: 'flash', x, y, life: 0.2, size: r * 3 + 180, color: '#fffbe8' });
      fx.ring(x, y, r + 320, '#fffbe8', 0.6, 26); fx.ring(x, y, r + 180, '#ffd84a', 0.5, 18);
      for (let i = 0; i < 10; i++) { const a = i * (TAU / 10); fx.add({ type: 'beam', x: x + Math.cos(a) * (r + 90), y: y + Math.sin(a) * (r + 60), size: 30, color: 'rgba(255,245,190,.95)', life: 0.8 }); }
      fx.sparks(x, y, -Math.PI / 2, 36, '#fff6c8', 700, Math.PI); plusses(fx, x, y, 16, '#fff3a0');
      fx.shake(1); fx.slowmo(0.35, 0.2); flashMe(fx, me, 0.75, '#fffbe8'); endDark(fx, ev.pid, 0.7);
      bigNum(fx, x, y - r - 30, ev.dmg, '#fff1a0', 86, '#3a2a00');
      fx.text(x, y - r - 4, `${ev.n} CONDEMN · ×${ev.mul}${ev.healed ? ` · +${ev.healed} HEALED` : ''}`, { size: 20, color: '#ffe27a', vy: -30, pop: 1.5, life: 1.6, vx: 0 });
      break;
    }
  }
  return true;
}

// ------------------------------------------------------------------ cinematics (drawn over the world)
function drawSword(ctx, x, y, L, gold, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
  const blade = gold ? '#fffbe8' : '#d8dde8', edge = gold ? '#ffd84a' : '#ff5a3c', w = L * 0.09;
  // glow (layered strokes, no shadowBlur)
  ctx.globalAlpha = alpha * 0.25; ctx.fillStyle = edge; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 2.2, -L * 0.2); ctx.lineTo(w * 2.2, -L); ctx.lineTo(-w * 2.2, -L); ctx.lineTo(-w * 2.2, -L * 0.2); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, -L * 0.14); ctx.lineTo(w, -L * 0.78); ctx.lineTo(-w, -L * 0.78); ctx.lineTo(-w, -L * 0.14); ctx.closePath();
  ctx.fillStyle = blade; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -L * 0.04); ctx.lineTo(0, -L * 0.76); ctx.strokeStyle = edge; ctx.lineWidth = 3; ctx.stroke(); // fuller
  ctx.fillStyle = gold ? '#ffcf3a' : '#6a4a3a'; ctx.fillRect(-w * 3.4, -L * 0.82, w * 6.8, L * 0.05); ctx.strokeRect(-w * 3.4, -L * 0.82, w * 6.8, L * 0.05); // guard
  ctx.fillStyle = gold ? '#fff0a0' : '#3a2a22'; ctx.fillRect(-w * 0.7, -L * 0.98, w * 1.4, L * 0.16); ctx.strokeRect(-w * 0.7, -L * 0.98, w * 1.4, L * 0.16); // grip
  circle(ctx, 0, -L, w * 1.1, edge, 3, INK); // pommel
  if (gold) for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * w * 3.4, -L * 0.8); ctx.quadraticCurveTo(s * L * 0.5, -L * 1.1, s * L * 0.62, -L * 0.7); ctx.quadraticCurveTo(s * L * 0.35, -L * 0.78, s * w * 3.4, -L * 0.76); ctx.fillStyle = 'rgba(255,248,210,.85)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); } // wings
  ctx.restore();
}
export const CINE = {
  flag(fx, ctx, c, time) { // War Banner: a burning standard planted in the ground, pull radius dashed around it
    const k = Math.min(1, c.t / 0.18), out = Math.min(1, (c.life - c.t) / 0.4), x = c.x, y = c.y;
    ctx.save(); ctx.globalAlpha = 0.5 * out; ctx.strokeStyle = '#ff5a3c'; ctx.lineWidth = 3; ctx.setLineDash([14, 12]); ctx.lineDashOffset = time * 30;
    ctx.beginPath(); ctx.ellipse(x, y, c.r, c.r * 0.5, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.18 * out; ctx.fillStyle = '#ff6a1a'; ctx.beginPath(); ctx.ellipse(x, y, c.wr, c.wr * 0.5, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = out; const H = 150 * k, top = y - H;
    ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x, top); ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#6a4a3a'; ctx.stroke();
    circle(ctx, x, top - 4, 7, '#ffcf3a', 3, INK);
    const w = 70, h = 56, wave = Math.sin(time * 7) * 7; // the cloth
    ctx.beginPath(); ctx.moveTo(x, top + 4); ctx.quadraticCurveTo(x + w * 0.5, top + wave, x + w, top + 8 + wave); ctx.lineTo(x + w - 12, top + h * 0.55 + wave); ctx.lineTo(x + w + 4, top + h + wave); ctx.quadraticCurveTo(x + w * 0.5, top + h - 6 - wave, x, top + h);
    ctx.closePath(); ctx.fillStyle = '#c2261a'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#ffae3b'; ctx.beginPath(); ctx.moveTo(x + 24, top + 14 + wave * 0.5); ctx.lineTo(x + 40, top + 28 + wave * 0.5); ctx.lineTo(x + 24, top + 42 + wave * 0.5); ctx.lineTo(x + 30, top + 28 + wave * 0.5); ctx.closePath(); ctx.fill(); // sigil
    ctx.restore();
    if (Math.random() < 0.9) fx.add({ type: 'dot', x: x + rnd(0, 70), y: y - 150 * k + rnd(0, 56), vx: rnd(-20, 40), vy: rnd(-160, -80), life: rnd(0.4, 0.8), size: rnd(2, 5), color: Math.random() < 0.5 ? '#ff8a2a' : '#ffe27a', drag: 0.98 });
  },
  web(fx, ctx, c, time) { // Snare Web: a glowing net over the pack
    const k = Math.min(1, c.t / 0.2), out = Math.min(1, (c.life - c.t) / 0.5), R = c.r * (0.6 + 0.4 * k);
    ctx.save(); ctx.globalAlpha = 0.85 * out; ctx.strokeStyle = '#d8ff9a'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 10; i++) { const a = i * TAU / 10; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R * 0.6); ctx.stroke(); }
    for (let j = 1; j <= 4; j++) { ctx.beginPath(); for (let i = 0; i <= 10; i++) { const a = i * TAU / 10, rr = R * j / 4 * (i % 2 ? 0.92 : 1); const px = c.x + Math.cos(a) * rr, py = c.y + Math.sin(a) * rr * 0.6; if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke(); }
    ctx.strokeStyle = '#7dff6a'; ctx.lineWidth = 1.5; for (const [x, y] of c.traps) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(c.x, c.y); ctx.stroke(); }
    ctx.restore();
  },
  hawk(fx, ctx, c) { // Hawkstorm: a spectral hawk swooping down a curved path
    const k = Math.min(1, c.t / c.fall), ix = c.fx + (c.x - c.fx) * k + Math.sin(k * Math.PI) * 90 * c.side, iy = c.fy + (c.y - c.fy) * k * k;
    const a = Math.atan2(c.y - iy + 1, c.x - ix), flap = Math.sin(c.t * 60) * 0.6;
    ctx.save(); ctx.translate(ix, iy); ctx.rotate(a); ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#b8fff0'; ctx.strokeStyle = '#0c3a30'; ctx.lineWidth = 3;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-12, s * (26 + flap * 10), -30, s * (34 + flap * 14)); ctx.lineTo(-14, s * 6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.moveTo(18, -3); ctx.lineTo(26, 0); ctx.lineTo(18, 3); ctx.fill();
    ctx.restore();
    if (Math.random() < 0.8) fx.add({ type: 'dot', x: ix, y: iy, vx: 0, vy: 0, life: 0.3, size: 4, color: '#7dffd8', drag: 1 });
  },
  comet(fx, ctx, c) { // Comet Step: the landing flare once the comet hits
    if (c.t < c.delay) return;
    if (!c.boom) { c.boom = 1; fx.add({ type: 'flash', x: c.x, y: c.y, life: 0.2, size: c.r * 2.4, color: '#ffe8c0' }); fx.ring(c.x, c.y, c.r * 1.2, '#ff9a2a', 0.5, 16); fx.ring(c.x, c.y, c.r * 0.8, '#8fdcff', 0.4, 8); fx.chunks(c.x, c.y, 14, '#5a2a1a', 480); fx.sparks(c.x, c.y, -Math.PI / 2, 24, '#ffcf6a', 600, Math.PI); fx.shake(0.7); }
  },
  clock(fx, ctx, c, time) { // Chrono Field: a violet clock-face dome with a sweeping hand
    const k = Math.min(1, c.t / 0.15), prog = Math.min(1, c.t / c.dur), out = Math.min(1, (c.life - c.t) / 0.1);
    ctx.save(); ctx.globalAlpha = 0.22 * out; circle(ctx, c.x, c.y, c.r * k, '#8a6cff', 0);
    ctx.globalAlpha = 0.9 * out; ctx.strokeStyle = '#d8c8ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * k, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3; for (let i = 0; i < 12; i++) { const a = i * TAU / 12; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * c.r * 0.84, c.y + Math.sin(a) * c.r * 0.84); ctx.lineTo(c.x + Math.cos(a) * c.r * 0.96, c.y + Math.sin(a) * c.r * 0.96); ctx.stroke(); }
    ctx.strokeStyle = '#ffae5a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.9, -Math.PI / 2, -Math.PI / 2 + TAU * prog); ctx.stroke();
    const ha = -Math.PI / 2 + TAU * prog * 3; ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(ha) * c.r * 0.7, c.y + Math.sin(ha) * c.r * 0.7); ctx.stroke(); ctx.strokeStyle = '#ece6ff'; ctx.lineWidth = 3.5; ctx.stroke();
    circle(ctx, c.x, c.y, 8, '#ece6ff', 3, INK);
    ctx.restore();
    if (Math.random() < 0.5) { const a = rnd(0, TAU), d = rnd(0, c.r); fx.add({ type: 'dot', x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, vx: 0, vy: 0, life: 0.5, size: 3, color: '#d8c8ff', drag: 1 }); }
  },
  bolt(fx, ctx, c) { // Divine Storm: a jagged holy lightning bolt
    const k = c.t / c.life, n = 7, dx = c.x - c.fx, dy = c.y - c.fy, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pts = [[c.fx, c.fy]]; for (let i = 1; i < n; i++) { const j = Math.sin(c.seed * 13 + i * 7.1 + Math.floor(c.t * 30)) * L * 0.08; pts.push([c.fx + dx * i / n + nx * j, c.fy + dy * i / n + ny * j]); } pts.push([c.x, c.y]);
    for (const [w, col, al] of [[14, '#ffd84a', 0.35], [7, '#fff3a0', 0.9], [3, '#ffffff', 1]]) { ctx.globalAlpha = al * (1 - k); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
    ctx.restore();
  },
  disc(fx, ctx, c, time) { // Aegis Throw: a spinning golden shield flying between enemies
    const k = Math.min(1, c.t / c.life), x = c.fx + (c.x - c.fx) * k, y = c.fy + (c.y - c.fy) * k;
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c.fx + (c.x - c.fx) * Math.max(0, k - 0.5), c.fy + (c.y - c.fy) * Math.max(0, k - 0.5)); ctx.lineTo(x, y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.translate(x, y); ctx.rotate(time * 30); ctx.scale(1, 0.75);
    circle(ctx, 0, 0, 20, '#ffcf3a', 4, INK); circle(ctx, 0, 0, 11, '#fff6c8', 3, INK);
    ctx.fillStyle = INK; ctx.fillRect(-2, -16, 4, 32); ctx.fillRect(-16, -2, 32, 4);
    ctx.restore();
  },
  angel(fx, ctx, c, time) { // Guardian Angel: a winged figure hovering behind the cleric
    const p = fx.sim && fx.sim.players && fx.sim.players.get(c.pid), bx = p ? p.x : c.x, by = p ? p.y : c.y;
    const k = Math.min(1, c.t / 0.4), out = Math.min(1, (c.life - c.t) / 0.4), x = bx - 36, y = by - 92 + Math.sin(time * 3) * 6;
    ctx.save(); ctx.globalAlpha = 0.85 * k * out;
    const g = ctx.createRadialGradient(x, y, 4, x, y, 90); g.addColorStop(0, 'rgba(255,250,220,.6)'); g.addColorStop(1, 'rgba(255,240,170,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 90, 0, TAU); ctx.fill();
    const flap = Math.sin(time * 4) * 0.15;
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(x, y - 6); ctx.rotate(s * flap); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 40, -46, s * 66, -30); ctx.quadraticCurveTo(s * 50, -14, s * 58, 2); ctx.quadraticCurveTo(s * 36, 0, s * 44, 16); ctx.quadraticCurveTo(s * 20, 10, 0, 8); ctx.closePath(); ctx.fillStyle = '#fffbe8'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); }
    ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y); ctx.lineTo(x + 18, y + 40); ctx.lineTo(x - 18, y + 40); ctx.closePath(); ctx.fillStyle = '#fff6c8'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    circle(ctx, x, y - 12, 10, '#ffe8c0', 3, INK);
    ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.ellipse(x, y - 27, 12, 4, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    if (Math.random() < 0.4) fx.add({ type: 'dot', x: x + rnd(-40, 40), y: y + rnd(-20, 30), vx: 0, vy: rnd(-40, -10), life: 0.6, size: 3, color: '#fff3a0', drag: 1 });
  },
  tornado(fx, ctx, c, time) {
    c.r += (c.rt - c.r) * 0.2;
    const fade = Math.min(1, c.t / 0.15) * Math.min(1, (c.life - c.t) / 0.3), R = c.r;
    ctx.save(); ctx.globalAlpha = 0.18 * fade; circle(ctx, c.x, c.y, R, '#e8d8b0', 0);
    for (let k = 0; k < 3; k++) {
      ctx.globalAlpha = (0.75 - k * 0.2) * fade; ctx.strokeStyle = k === 0 ? '#fff6e0' : k === 1 ? '#e0c890' : '#ff9a4a'; ctx.lineWidth = 6 - k * 1.5; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const f = i / 40, a = time * (9 - k * 2) + f * TAU * 2.2 + k * 2.1, rr = R * (0.2 + 0.8 * f); ctx.lineTo(c.x + Math.cos(a) * rr, c.y - f * 70 + Math.sin(a) * rr * 0.45); }
      ctx.stroke();
    }
    ctx.restore();
  },
  lance(fx, ctx, c) {
    const m = Math.min(1, c.t / c.dur), x = c.fx + (c.x - c.fx) * m, y = c.fy + (c.y - c.fy) * m, a = Math.atan2(c.y - c.fy, c.x - c.fx);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#b8ff7a'; ctx.beginPath(); ctx.ellipse(-30, 0, 46, 11, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-4, -8); ctx.lineTo(-40, -3); ctx.lineTo(-40, 3); ctx.lineTo(-4, 8); ctx.closePath(); ctx.fillStyle = '#f4ffe0'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
  },
  scope(fx, ctx, c, time) {
    const k = c.t / c.life, R = 70 * (1.6 - k * 0.6);
    ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#eaffb0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(c.x, c.y, R * 0.35, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x - R * 1.3, c.y); ctx.lineTo(c.x + R * 1.3, c.y); ctx.moveTo(c.x, c.y - R * 1.3); ctx.lineTo(c.x, c.y + R * 1.3); ctx.stroke();
    ctx.restore();
  },
  star(fx, ctx, c, time) {
    const k = Math.min(1, c.t / c.dur), R = 16 + 60 * k * k;
    ctx.save();
    const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, R * 2.2); g.addColorStop(0, 'rgba(255,250,220,.95)'); g.addColorStop(0.35, 'rgba(255,160,60,.7)'); g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, R * 2.2, 0, TAU); ctx.fill();
    circle(ctx, c.x, c.y, R * (0.5 + 0.08 * Math.sin(time * 40)), '#fffbe8', 3, INK);
    if (Math.random() < 0.6) fx.add({ type: 'spark', x: c.x + rnd(-1, 1) * R * 3, y: c.y + rnd(-1, 1) * R * 3, vx: 0, vy: 0, life: 0.2, size: 3, color: '#ffcf6a' });
    ctx.restore();
  },
  leap(fx, ctx, c) { // shadow grows on the landing spot while the warrior arcs overhead
    const k = Math.min(1, c.t / c.dur), hx = c.fx + (c.x - c.fx) * k, hy = c.fy + (c.y - c.fy) * k - Math.sin(k * Math.PI) * 360;
    ctx.save(); ctx.globalAlpha = 0.35 + 0.4 * k; ctx.fillStyle = 'rgba(20,8,0,.7)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 10, c.r * (0.4 + k), c.r * (0.4 + k) * 0.45, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ff9a4a'; ctx.lineWidth = 4; ctx.setLineDash([12, 10]); ctx.beginPath(); ctx.arc(c.x, c.y, 650 * (1 - k * 0.2), 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.8; circle(ctx, hx, hy, 14, '#ffcf8a', 3, INK);
    ctx.restore();
  },
  sword(fx, ctx, c, time) {
    const L = 300 * c.size, k = Math.min(1, c.t / c.fall), e = k * k * k, gy = c.y + 6;
    const sy = gy - (1 - e) * 900; // falls from off-screen
    ctx.save(); // target shadow + rune circle
    ctx.globalAlpha = 0.3 + 0.5 * k; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.ellipse(c.x, gy, 40 + 60 * k * c.size, (40 + 60 * k * c.size) * 0.4, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = c.gold ? '#ffe27a' : '#ff5a3c'; ctx.lineWidth = 3; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.ellipse(c.x, gy, 130 * c.size, 52 * c.size, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([10, 8]); ctx.lineDashOffset = time * (c.gold ? -40 : 40); ctx.beginPath(); ctx.ellipse(c.x, gy, 100 * c.size, 40 * c.size, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    const stuck = c.t >= c.fall, out = stuck ? Math.max(0, 1 - (c.t - c.fall) / 1.2) : 1;
    if (!stuck && k > 0.4) { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = c.gold ? '#fff6c8' : '#ffcf8a'; ctx.fillRect(c.x - L * 0.05, sy - L - 400, L * 0.1, 400); ctx.restore(); } // speed streak
    drawSword(ctx, c.x, stuck ? gy + L * 0.12 : sy, L, c.gold, out);
  },
  charge(fx, ctx, c, time) {
    const k = Math.min(1, c.t / c.dur), a = Math.atan2(c.ty - c.y, c.tx - c.x);
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.6 * k; ctx.strokeStyle = '#eaffb0'; ctx.lineWidth = 2 + 6 * k; ctx.setLineDash([16, 12]); ctx.lineDashOffset = -time * 200;
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(a) * 760, c.y + Math.sin(a) * 760); ctx.stroke(); ctx.setLineDash([]);
    const R = 30 + 50 * (1 - k); ctx.globalAlpha = 0.9; ctx.strokeStyle = '#7dff6a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(c.x, c.y - 10, R, time * 6, time * 6 + Math.PI * 1.5); ctx.stroke();
    circle(ctx, c.x + Math.cos(a) * 30, c.y - 10 + Math.sin(a) * 30, 8 + 14 * k + 3 * Math.sin(time * 30), '#f4ffe0', 3, INK);
    ctx.restore();
    if (Math.random() < 0.8) { const an = rnd(0, TAU), d = rnd(90, 180); fx.add({ type: 'spark', x: c.x + Math.cos(an) * d, y: c.y - 10 + Math.sin(an) * d, vx: -Math.cos(an) * d * 4, vy: -Math.sin(an) * d * 4, life: 0.22, size: 3, color: '#d8ff9a', drag: 1 }); }
  },
  beam2(fx, ctx, c) {
    const k = c.t / c.life, w = c.w * (1 - k * 0.7);
    ctx.save(); ctx.lineCap = 'round';
    ctx.globalAlpha = (1 - k) * 0.45; ctx.strokeStyle = '#7dff6a'; ctx.lineWidth = w * 2; ctx.beginPath(); ctx.moveTo(c.fx, c.fy); ctx.lineTo(c.x, c.y); ctx.stroke();
    ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#eaffb0'; ctx.lineWidth = w; ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = w * 0.35; ctx.stroke();
    ctx.restore();
  },
  redsky(fx, ctx, c, time) { /* the dark layer tints; embers fall across the view */
    if (Math.random() < 0.7) fx.add({ type: 'dot', x: fx.view ? rnd(fx.view.x0, fx.view.x1) : rnd(-700, 700), y: fx.view ? fx.view.y0 - 10 : -420, vx: rnd(-40, 40), vy: rnd(260, 420), life: 1.4, size: rnd(2, 4), color: Math.random() < 0.5 ? '#ff9a2a' : '#ffe27a', drag: 1 });
  },
  halo(fx, ctx, c, time) {
    const k = Math.min(1, c.t / 0.3), p = fx.sim && fx.sim.players && fx.sim.players.get(c.pid), x = p ? p.x : c.x, y = p ? p.y : c.y;
    ctx.save(); ctx.globalAlpha = 0.85 * k * Math.min(1, (c.life - c.t) / 0.4); ctx.strokeStyle = '#fff6c8'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(x, y - 66, 26, 9, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha *= 0.4; ctx.fillStyle = '#fff6c8'; ctx.fillRect(x - 36, y - 800, 72, 800);
    ctx.restore();
  },
  hole(fx, ctx, c, time) {
    const k = Math.min(1, c.t / 0.4), collapse = c.t > c.hold ? Math.min(1, (c.t - c.hold) / 0.3) : 0, R = (40 + 30 * Math.min(1, c.n / 12)) * k * (1 - collapse * 0.9);
    ctx.save();
    const g = ctx.createRadialGradient(c.x, c.y, R * 0.8, c.x, c.y, R * 3.2); g.addColorStop(0, 'rgba(120,60,200,.55)'); g.addColorStop(1, 'rgba(120,60,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, R * 3.2, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.8 - i * 0.2; ctx.strokeStyle = i === 1 ? '#ff9a2a' : '#c8a0ff'; ctx.lineWidth = 5 - i; ctx.beginPath(); ctx.ellipse(c.x, c.y, R * (1.5 + i * 0.4), R * (0.5 + i * 0.15), time * (1.5 + i) * (i % 2 ? -1 : 1) * 0.3, time * (4 + i), time * (4 + i) + Math.PI * 1.3); ctx.stroke(); }
    ctx.globalAlpha = 0.88; circle(ctx, c.x, c.y, R * 0.8, '#05000c', 3, '#e0c8ff');
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#c8a0ff'; ctx.lineWidth = 2; ctx.setLineDash([6, 10]); ctx.lineDashOffset = time * 60; ctx.beginPath(); ctx.arc(c.x, c.y, c.R * (1 - collapse), 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    if (!collapse && Math.random() < 0.9) inward(fx, c.x, c.y, c.R, 1, Math.random() < 0.5 ? '#c8a0ff' : '#ff9a2a', 600);
  },
  drop(fx, ctx, c, time) {
    const k = Math.min(1, c.t / c.fall);
    if (c.style === 'arrow') {
      if (k < 1) { const y0 = c.y - 520 * (1 - k); ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(c.x - 12, y0 - 60); ctx.lineTo(c.x, y0); ctx.stroke(); ctx.strokeStyle = '#eaffb0'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(c.x, c.y, 16 * k + 4, (16 * k + 4) * 0.4, 0, 0, TAU); ctx.strokeStyle = '#7dff6a'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
      else if (!c.boom) { c.boom = 1; fx.add({ type: 'flash', x: c.x, y: c.y, life: 0.12, size: 110, color: '#eaffd0' }); fx.ring(c.x, c.y, 72, '#9dff6a', 0.3, 8); fx.sparks(c.x, c.y, -Math.PI / 2, 4, '#eaffb0', 300, Math.PI); }
    } else if (c.style === 'meteor') {
      const sx = c.x + 380 * (1 - k), sy = c.y - 620 * (1 - k), R = (c.r || 100) * 0.34;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.5 * k; ctx.fillStyle = 'rgba(255,90,20,.5)'; ctx.beginPath(); ctx.ellipse(c.x, c.y, (c.r || 100) * k, (c.r || 100) * k * 0.45, 0, 0, TAU); ctx.fill();
      if (k < 1) {
        ctx.globalAlpha = 0.6; ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = R * 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx + 160, sy - 260); ctx.lineTo(sx, sy); ctx.stroke();
        ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = R * 0.6; ctx.stroke();
        ctx.globalAlpha = 1; circle(ctx, sx, sy, R, '#5a2a1a', 4, INK); circle(ctx, sx - R * 0.3, sy - R * 0.3, R * 0.35, '#ff9a2a', 0);
      }
      ctx.restore();
    } else { // pillar of light: a narrow warning beam that swells into a column, then flashes
      const R = c.r || 80, land = c.t >= c.fall, after = land ? (c.t - c.fall) / 0.35 : 0;
      ctx.save();
      const w = land ? R * 1.2 * (1 - after) + 6 : 6 + R * 0.3 * k;
      ctx.globalAlpha = land ? 0.9 * (1 - after) : 0.35 + 0.4 * k;
      const g = ctx.createLinearGradient(0, c.y - 700, 0, c.y); g.addColorStop(0, 'rgba(255,250,220,0)'); g.addColorStop(1, 'rgba(255,240,170,1)');
      ctx.fillStyle = g; ctx.fillRect(c.x - w / 2, c.y - 700, w, 700);
      ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(c.x, c.y, R * (land ? 1 + after * 0.4 : k), R * (land ? 1 + after * 0.4 : k) * 0.42, 0, 0, TAU); ctx.stroke();
      ctx.restore();
      if (land && !c.boom) { c.boom = 1; fx.add({ type: 'flash', x: c.x, y: c.y, life: 0.14, size: R * 2, color: '#fffbe8' }); fx.ring(c.x, c.y, R * 1.2, '#fff6c8', 0.35, 10); plusses(fx, c.x, c.y, 2, '#fff3a0'); fx.shake(0.12); }
    }
  },
};
/** Ground layer (under characters): the Worldbreaker crater. */
export const UNDER = {
  crater(fx, ctx, c) {
    const a = Math.min(1, c.t / 0.1) * Math.min(1, (c.life - c.t) / 0.8);
    ctx.save(); ctx.globalAlpha = 0.7 * a;
    ctx.fillStyle = 'rgba(60,40,24,.8)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 10, c.R, c.R * 0.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,40,.35)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 10, c.R * 0.6, c.R * 0.3, 0, 0, TAU); ctx.fill();
    ctx.restore();
  },
};

// ------------------------------------------------------------------ sounds (Audio.handle calls this for class events)
export function classSound(au, ev, me) {
  if (!CLASS_EVENTS.has(ev.type) && !(ev.type === 'spin' && ev.mael)) return false;
  if (!au.ctx || au.muted) return true;
  switch (ev.type) {
    case 'classState': if (ev.fresh && me) au.tone('triangle', 520, 1040, 0.16, 0.1); return true;
    case 'stack': return true;
    case 'earthsplitter': au.play('slam'); au.tone('sawtooth', 70, 28, 0.7, 0.28); au.tone('square', 55, 30, 0.5, 0.12, 0.08); return true;
    case 'rageSpend': au.tone('sawtooth', 160, 420, 0.22, 0.12); if (ev.rhythm && me) au.tone('triangle', 880, 1320, 0.1, 0.1); return true;
    case 'rhythm': case 'weaveReady': return true;
    case 'weave': if (me) au.tone('triangle', 660, 990, 0.08, 0.06); return true;
    case 'strEnd': if (me && ev.reset) au.tone('triangle', 740, 1480, 0.12, 0.07); return true;
    case 'berserkFinale': au.play('boom'); au.tone('sawtooth', 90, 30, 0.8, 0.28); return true;
    case 'spin': au.play('swing'); return true;
    case 'maelstrom': au.hiss(300, 1800, 1.2, 0.3, 0.6); return true;
    case 'skullsplitter': au.play('crescentHit'); return true;
    case 'stormLance': if (ev.ph === 'fire') au.tone('triangle', 900, 1800, 0.18, 0.15); else { au.hiss(6000, 1500, 0.3, 0.3, 1); [880, 1175, 1568].forEach((f, i) => au.tone('triangle', f, f, 0.15, 0.08, i * 0.04)); } return true;
    case 'deadeye': au.tone('square', 1800, 400, 0.12, 0.12); au.play('boom'); return true;
    case 'glacialCascade': au.play('ice'); return true;
    case 'shatterChain': au.tone('sine', 2200 + ev.d * 200, 3200, 0.12, 0.08); au.hiss(9000, 4000, 0.12, 0.15, 2, 'highpass'); return true;
    case 'supernova': if (ev.ph === 'charge') au.tone('sine', 200, 900, ev.t / 60, 0.15); else au.play('detonate'); return true;
    case 'holyNova': [784, 988, 1175, 1568].forEach((f, i) => au.tone('triangle', f, f, 0.3, 0.1, i * 0.05)); au.play('boom'); return true;
    case 'verdict': au.tone('square', 660, 330, 0.2, 0.08); return true;
    case 'snareWeb': au.tone('triangle', 300, 1200, 0.12, 0.1); au.hiss(3000, 800, 0.35, 0.25, 1); au.play('boom'); return true;
    case 'ricochet': if (ev.ph === 'hop') au.tone('square', 1200 + (ev.i || 0) * 120, 2400, 0.06, 0.07); else if (ev.ph === 'fire') au.tone('triangle', 900, 1800, 0.12, 0.12); return true;
    case 'hawkstorm': if (ev.ph === 'call') { au.tone('sawtooth', 1800, 2600, 0.25, 0.08); au.tone('triangle', 2400, 1600, 0.3, 0.06, 0.12); } else if (ev.ph === 'hit') au.hiss(4000, 1500, 0.08, 0.14, 1); return true;
    case 'steamBurst': au.play('ice'); au.hiss(1200, 5000, 0.6, 0.35, 0.8, 'highpass'); au.play('boom'); return true;
    case 'cometStep': au.play('blink'); au.tone('sawtooth', 600, 80, 0.2, 0.15); au.play('boom'); return true;
    case 'chronoField': if (ev.ph === 'start') { au.tone('sine', 880, 220, 0.4, 0.12); [0, 0.12, 0.24, 0.36].forEach((d) => au.tone('square', 1760, 1760, 0.03, 0.05, d)); } else { au.hiss(9000, 3000, 0.4, 0.3, 2, 'highpass'); au.play('detonate'); } return true;
    case 'divineStorm': if (ev.ph === 'strike') { au.hiss(7000, 1200, 0.18, 0.28, 1); au.tone('square', 220, 110, 0.1, 0.1); } else [784, 1175].forEach((f, i) => au.tone('triangle', f, f, 0.2, 0.08, i * 0.05)); return true;
    case 'aegisThrow': if (ev.ph === 'bounce') au.tone('square', 900 + (ev.i || 0) * 90, 500, 0.08, 0.1); else if (ev.ph === 'throw') au.tone('triangle', 500, 900, 0.15, 0.1); else au.tone('sine', 660, 990, 0.2, 0.08); return true;
    case 'angel': if (ev.ph === 'summon') [523, 659, 784, 1046, 1318].forEach((f, i) => au.tone('triangle', f, f, 0.5, 0.08, i * 0.07)); else if (ev.ph === 'echo') au.tone('triangle', 1318, 1568, 0.2, 0.06); return true;
    case 'absolution': au.play('detonate'); [523, 784, 1046, 1568].forEach((f, i) => au.tone('triangle', f, f, 0.45, 0.1, i * 0.06)); return true;
    case 'ultEnd': return true;
    case 'fin':
      switch (ev.ph) {
        case 'start': au.play('moonRise'); au.tone('sawtooth', 110, 55, 1.0, 0.12); return true;
        case 'impact': case 'release': case 'collapse': au.play('crescentHit'); return true;
        case 'ring': au.play('slam'); return true;
        case 'wave': au.hiss(5000, 2500, 0.1, 0.18, 1); return true;
        case 'meteor': return true;
        case 'land': au.play('boom'); return true;
        case 'pillar': au.tone('triangle', 1046 + (ev.i % 5) * 131, 1568, 0.2, 0.06); return true;
        case 'end': au.play('detonate'); if (ev.fid === 'rapture') [523, 659, 784, 1046].forEach((f, i) => au.tone('triangle', f, f, 0.4, 0.12, i * 0.08)); return true;
      }
      return true;
  }
  return false;
}
