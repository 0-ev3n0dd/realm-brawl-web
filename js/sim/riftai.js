// The Astral Rift's own mob skills (2026-10-15): each rift mob keeps its base movement AI (ai.js) and adds one signature
// skill on its own cooldown, telegraphed (no instant hits; every skill tells >= 1.0 s, combat audit step 1), with a {type:'rift'} event the client turns into its VFX:
//   Voidling      void blink    pops out of the void beside you, a small void burst where it lands
//   Rift Stalker  phase rend    a long void tear along its pounce line that erupts after the leap
//   Star Wisp     star nova     a slow ring of six homing star motes
//   Void Archer   rift arrow    a long piercing lane, then a three-bolt volley down it
//   Astral Knight constellation three star seals in a triangle round you that ignite in turn
//   Voidglass Golem gravity well  pulls you in toward a glass slam
import { AIH } from './ai.js';
import { evadeShove } from './combat.js';
const SK = {
  voidling:     { cd: 260, range: 380 },
  riftstalker:  { cd: 300, range: 420 },
  starwisp:     { cd: 280, range: 460 },
  voidarcher:   { cd: 300, range: 520 },
  astralknight: { cd: 330, range: 360 },
  voidgolem:    { cd: 360, range: 300 },
};
const r0 = Math.round;
export function riftSkill(sim, e, t) {
  const S = SK[e.type]; if (!S || !t || e.boss) return;
  const { angTo, dTo, area, shoot } = AIH;
  if (e.rsk == null) e.rsk = r0(S.cd * (0.4 + 0.6 * sim.rng.next()));
  if (e.rskT > 0) { e.rskT--; riftTick(sim, e, t); return; }
  if (--e.rsk > 0) return;
  const d = dTo(e, t); if (d > S.range) { e.rsk = 30; return; }
  e.rsk = S.cd; const a = angTo(e, t);
  switch (e.type) {
    case 'voidling': {
      const s = sim.rng.next() < 0.5 ? 1 : -1, nx = t.x + Math.cos(a + Math.PI / 2 * s) * 70, ny = t.y + Math.sin(a + Math.PI / 2 * s) * 70;
      sim.emit({ type: 'rift', ph: 'blinkOut', x: r0(e.x), y: r0(e.y), id: e.id });
      e.x = e.px = nx; e.y = e.py = ny; e.vx = e.vy = 0;
      area(sim, e, { shape: 'circle', x: nx, y: ny, r: 64, delay: 60, mul: 0.9, kb: 200, kind: 'voidpop' });
      sim.emit({ type: 'rift', ph: 'blinkIn', x: r0(nx), y: r0(ny), id: e.id });
      break;
    }
    case 'riftstalker':
      area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: a, len: 460, w: 44, delay: 60, mul: 1.0, kb: 240, stun: 10, kind: 'riftrend' });
      sim.emit({ type: 'rift', ph: 'rend', x: r0(e.x), y: r0(e.y), ang: +a.toFixed(3), id: e.id });
      break;
    case 'starwisp':
      e.rskT = 60; e.rskA = a; sim.emit({ type: 'rift', ph: 'novaCharge', x: r0(e.x), y: r0(e.y), id: e.id });
      break;
    case 'voidarcher':
      e.rskT = 60; e.rskA = a;
      area(sim, e, { shape: 'line', x: e.x, y: e.y, ang: a, len: 620, w: 34, delay: 60, visual: true, kind: 'riftlane' });
      sim.emit({ type: 'rift', ph: 'lane', x: r0(e.x), y: r0(e.y), ang: +a.toFixed(3), id: e.id });
      break;
    case 'astralknight':
      for (let i = 0; i < 3; i++) { const b = a + i * (Math.PI * 2 / 3), x = t.x + Math.cos(b) * 95, y = t.y + Math.sin(b) * 95;
        area(sim, e, { shape: 'circle', x, y, r: 70, delay: 60 + i * 16, mul: 0.95, kb: 220, stun: 8, kind: 'starseal' }); }
      sim.emit({ type: 'rift', ph: 'seals', x: r0(t.x), y: r0(t.y), ang: +a.toFixed(3), id: e.id });
      break;
    case 'voidgolem':
      e.rskT = 60; sim.emit({ type: 'rift', ph: 'gravity', x: r0(e.x), y: r0(e.y), id: e.id });
      area(sim, e, { shape: 'circle', x: e.x, y: e.y, r: 150, delay: 60, mul: 1.25, kb: 420, stun: 16, kind: 'glassslam', follow: e.id });
      break;
  }
  void shoot;
}
function riftTick(sim, e, t) {
  const { shoot, dTo } = AIH;
  if (e.type === 'starwisp' && e.rskT === 1) { for (let i = 0; i < 6; i++) shoot(sim, e, e.rskA + i * Math.PI / 3, 150, { r: 9, style: 'hex', homing: 0.35, life: 200, mul: 0.6 }); sim.emit({ type: 'rift', ph: 'nova', x: r0(e.x), y: r0(e.y), id: e.id }); }
  if (e.type === 'voidarcher' && (e.rskT === 1 || e.rskT === 6 || e.rskT === 11)) shoot(sim, e, e.rskA, 620, { r: 8, style: 'dark', mul: 0.55, life: 70 });
  if (e.type === 'voidgolem' && e.rskT > 1) for (const p of sim.players.values()) { if (p.dead || evadeShove(sim, p)) continue; const d = dTo(e, p); if (d < 340 && d > e.r + 30) { const a = Math.atan2(e.y - p.y, e.x - p.x); p.vx += Math.cos(a) * 26; p.vy += Math.sin(a) * 26; } }
}
