// Part C2: the Astral boss layer's telegraphs (sim/astralboss.js), drawn with the one telegraph renderer (client/telefx.js:
// the colour grammar + the white time-to-impact sweep + the caption with its countdown). Local sims read sim.ab; net
// clients read the packed copy (server/room.js msg.ab -> sim.abV). Nothing is drawn outside the Astral World.
import { drawTele } from './telefx.js';
import { packAstralBoss } from '../sim/astralboss.js';

export function abTele(sim) { if (sim.abV !== undefined) return sim.abV || []; return sim.ab && sim.ab.tele.length ? packAstralBoss(sim) || [] : []; }
export function drawAstralBossTele(ctx, sim, time, view) {
  const L = abTele(sim); if (!L.length) return;
  for (const t of L) {
    if (view && t.r < 1000 && (t.x < view.x0 - t.r - 80 || t.x > view.x1 + t.r + 80 || t.y < view.y0 - t.r - 80 || t.y > view.y1 + t.r + 80)) continue;
    if (t.k === 'burst' && !t.done) { // the soft enrage: a violet flare that swallows the screen, the shard at its heart
      ctx.save(); const k = Math.min(1, t.t / t.d); ctx.globalAlpha = 0.18 + 0.3 * k; ctx.fillStyle = 'rgba(150,90,255,.5)'; ctx.beginPath(); ctx.arc(t.x, t.y, 260 + 1200 * k, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      drawTele(ctx, { ...t, r: 70 }, time); continue;
    }
    drawTele(ctx, t, time);
  }
}
/** the HUD's small ASTRAL tag (next to the zone name, PC + phone): a violet pill with a star, left edge at x, centred on y */
export function drawAstralTag(ctx, x, y, s = 1, time = 0) {
  const h = Math.round(20 * s), f = Math.round(12 * s), label = 'ASTRAL';
  ctx.save(); ctx.font = `${f}px 'Lilita One', sans-serif`; const w = Math.round(ctx.measureText(label).width + 30 * s);
  const top = Math.round(y - h / 2), r = h / 2;
  ctx.beginPath(); ctx.moveTo(x + r, top); ctx.arcTo(x + w, top, x + w, top + h, r); ctx.arcTo(x + w, top + h, x, top + h, r); ctx.arcTo(x, top + h, x, top, r); ctx.arcTo(x, top, x + w, top, r); ctx.closePath();
  ctx.fillStyle = 'rgba(58,26,120,.92)'; ctx.fill(); ctx.lineWidth = Math.max(1.5, 2 * s); ctx.strokeStyle = '#b89cff'; ctx.stroke();
  const cx = x + 11 * s, k = 0.75 + 0.25 * Math.sin(time * 3); ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); // a 4-point star
  for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, rr = (i % 2 ? 2 : 6) * s * k; ctx.lineTo(cx + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = '#140a26'; ctx.strokeText(label, x + 19 * s, y + 1); ctx.fillStyle = '#efe6ff'; ctx.fillText(label, x + 19 * s, y + 1);
  ctx.restore(); return w;
}
