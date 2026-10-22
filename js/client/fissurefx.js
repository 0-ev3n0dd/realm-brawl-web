// Part A4: Astral Fissures, drawn. The fissure on the ground (a violet pixel crack with drifting star motes + the wave
// pips), the core's art, the map / minimap marker data and the callouts. Reads sim.fis (solo) or the co-op snapshot
// (sim.fisV), never mutates the sim.
import { packFissures } from '../sim/fissure.js';
const TAU = Math.PI * 2, VIO = '#c06bff', PALE = '#e8dcff', INK = '#120c18';
export function fisState(sim) { if (sim.fisV !== undefined) return sim.fisV || []; return sim.fis ? packFissures(sim) : []; }
const px = (ctx, x, y, s, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); };
export function drawFissureGround(ctx, sim, time, view) {
  const L = fisState(sim); if (!L.length) return;
  for (const f of L) {
    if (view && (f.x < view.x0 - 300 || f.x > view.x1 + 300 || f.y < view.y0 - 300 || f.y > view.y1 + 300)) continue;
    ctx.save();
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 + f.id);
    const g = ctx.createRadialGradient(f.x, f.y, 10, f.x, f.y, 190); g.addColorStop(0, 'rgba(192,107,255,.45)'); g.addColorStop(1, 'rgba(192,107,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, 190, 0, TAU); ctx.fill();
    // the crack: a jagged pixel zig-zag
    ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.lineJoin = 'miter'; ctx.beginPath();
    const P = []; for (let i = -5; i <= 5; i++) P.push([f.x + i * 18, f.y + ((i & 1) ? -10 : 10) + Math.sin(i * 1.7 + f.id) * 6]);
    P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.strokeStyle = VIO; ctx.lineWidth = 6; ctx.stroke(); ctx.globalAlpha = 0.6 + 0.4 * pulse; ctx.strokeStyle = PALE; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
    // motes rising out of it
    for (let i = 0; i < 14; i++) { const u = ((time * 0.6 + i / 14) % 1), x = f.x + (((i * 37) % 200) - 100), y = f.y - u * 140; ctx.globalAlpha = 1 - u; px(ctx, x, y, i % 3 ? 3 : 5, i % 2 ? PALE : VIO); }
    ctx.globalAlpha = 1;
    // engage ring + label + wave pips
    if (f.st === 'open') { ctx.setLineDash([10, 10]); ctx.lineDashOffset = -time * 30; ctx.strokeStyle = 'rgba(232,220,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, 420, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    ctx.font = "15px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK;
    const tx = f.st === 'open' ? 'ASTRAL FISSURE' : f.st === 'core' ? 'BREAK THE CORE' : `WAVE ${f.wave}/${f.nw}`;
    ctx.strokeText(tx, f.x, f.y - 70); ctx.fillStyle = PALE; ctx.fillText(tx, f.x, f.y - 70);
    for (let i = 0; i < f.nw; i++) { const done = f.st === 'core' || i < f.wave - 1, cur = f.st === 'waves' && i === f.wave - 1; px(ctx, f.x + (i - (f.nw - 1) / 2) * 16, f.y - 52, 10, INK); px(ctx, f.x + (i - (f.nw - 1) / 2) * 16, f.y - 52, 6, done ? VIO : cur ? PALE : '#3a2f52'); }
    ctx.restore();
  }
}
/** the core (ENEMY_DRAW.fissurecore): a faceted violet crystal over the crack */
export function drawCore(ctx, e, t) {
  const r = e.r || 34, x = e.x, y = e.y, bob = Math.sin(t * 2.2) * 4;
  ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.7, r * 0.8, r * 0.25, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  const cy = y - r * 0.4 + bob, pts = [[0, -r * 1.2], [r * 0.7, -r * 0.2], [r * 0.4, r * 0.7], [-r * 0.4, r * 0.7], [-r * 0.7, -r * 0.2]];
  ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(x + a, cy + b) : ctx.moveTo(x + a, cy + b))); ctx.closePath();
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : VIO; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, cy - r * 1.2); ctx.lineTo(x + r * 0.15, cy + r * 0.7); ctx.moveTo(x - r * 0.7, cy - r * 0.2); ctx.lineTo(x + r * 0.7, cy - r * 0.2); ctx.lineWidth = 2; ctx.strokeStyle = PALE; ctx.stroke();
  for (let i = 0; i < 3; i++) { const a = t * 2 + i * TAU / 3; px(ctx, x + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * 0.5, 4, PALE); }
  ctx.restore();
}
/** map / minimap markers (client/mapmarkers.js + bigmap.js) */
export function fissureMarkers(sim) { return fisState(sim).map((f) => ({ kind: 'fissure', x: f.x, y: f.y, name: 'Astral Fissure', sub: f.st === 'open' ? 'Astral mobs are breaking through · close it for Astral Dust' : f.st === 'core' ? 'Break the core' : `Wave ${f.wave}/${f.nw}`, col: VIO, hr: 16, z: 6 })); }
export function fissureIcon(ctx, x, y, s, t) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + t; ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7); ctx.lineTo(Math.cos(a + TAU / 8) * 3, Math.sin(a + TAU / 8) * 3); } ctx.closePath(); ctx.fillStyle = VIO; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = PALE; ctx.stroke(); ctx.restore(); }
/** the callouts (client/fx.js) */
export const FIS_CALL = {
  spawn: () => ['ASTRAL FISSURE', VIO, 'Astral mobs are breaking through nearby · close it for Astral Dust', 3, 44],
  wave: (ev) => [`FISSURE · WAVE ${ev.wave}/${ev.nw}`, VIO, ev.el ? `${ev.el} affixed elite${ev.el > 1 ? 's' : ''} in this wave` : 'Weaker Astral mobs · clear them', 1.8, 52],
  core: () => ['BREAK THE CORE', PALE, 'The fissure core is exposed · step out of its red pulse', 2, 52],
  closed: (ev) => ['FISSURE CLOSED', '#7dffb0', `+${ev.n} Astral Dust`, 2.4, 52],
};
