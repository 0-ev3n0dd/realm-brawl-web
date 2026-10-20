// The carry set piece (sim/setpiece.js 'carry', Neferakh's SUNBEARER): the falling sun and its catch circle, the altar, the Wardens'
// sand bands across the route (the next band to sweep glows), the lanes as they charge, the bearer's halo, the sun's fuse.
// World layer (drawCarry) + HUD (carryHud: the fuse meter and the one line that tells YOU what to do).
import { SETPIECE } from '../sim/setpiece.js';
import { INK, circle } from './art.js';

const TAU = Math.PI * 2, clamp01 = (v) => Math.max(0, Math.min(1, v));
function sunOrb(ctx, x, y, r, t, hot) {
  ctx.save(); ctx.globalAlpha = 0.35; circle(ctx, x, y, r * 1.9, hot ? '#ff9a3a' : '#ffd86a', 0); ctx.globalAlpha = 1;
  ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = t * 1.4 + i / 12 * TAU, l = r * (1.35 + 0.18 * Math.sin(t * 7 + i)); ctx.moveTo(x + Math.cos(a - 0.12) * r * 0.95, y + Math.sin(a - 0.12) * r * 0.95); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.lineTo(x + Math.cos(a + 0.12) * r * 0.95, y + Math.sin(a + 0.12) * r * 0.95); }
  ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.6, '#ffd86a'); g.addColorStop(1, hot ? '#ff7a2a' : '#f0a020');
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
}
function tag(ctx, s, x, y, size, col) { ctx.save(); ctx.font = `bold ${size}px "Lilita One", "Arial Black", sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.restore(); }
/** the band geometry (matches setpiece.js tickCarry): band b crosses the landing -> altar route at 1/4, 1/2, 3/4 */
export function carryBand(sp, b) { const ux = sp.gx - sp.x, uy = sp.gy - sp.y, ul = Math.hypot(ux, uy) || 1, f = 0.25 + 0.25 * b; return { x: sp.x + ux * f, y: sp.y + uy * f, ang: Math.atan2(uy, ux) + Math.PI / 2, ux: ux / ul, uy: uy / ul }; }
export function drawCarry(ctx, sp, sim, local, time) {
  const S = SETPIECE.carry, tell = sp.ph === 'tell', k = tell ? clamp01(sp.t / S.tell) : 1, pulse = 0.5 + 0.5 * Math.sin(time * 6);
  const bearer = sp.bearer && sim.players && sim.players.get(sp.bearer), fuse = tell ? 1 : clamp01(1 - sp.t / (sp.life || S.life));
  ctx.save();
  // the route: a faint gold road from the landing to the altar
  ctx.globalAlpha = 0.35; ctx.setLineDash([22, 18]); ctx.lineDashOffset = -time * 50; ctx.lineWidth = 10; ctx.strokeStyle = '#ffe27a'; ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(sp.gx, sp.gy); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  // the three sand bands (where the Wardens sweep); the next one in the cycle glows
  const live = new Set((sp.lanes || []).filter((l) => l.t < l.d).map((l) => l.band));
  for (let b = 0; b < 3; b++) {
    const B = carryBand(sp, b), c = Math.cos(B.ang), s = Math.sin(B.ang), L = 520, hw = S.laneW / 2, nx = c * L / 2, ny = s * L / 2;
    if (live.has(b)) continue;
    const next = sp.order && sp.order[(sp.nextBand ?? 0) % 3] === b && !tell;
    ctx.beginPath(); ctx.moveTo(B.x - nx - B.ux * hw, B.y - ny - B.uy * hw); ctx.lineTo(B.x + nx - B.ux * hw, B.y + ny - B.uy * hw); ctx.lineTo(B.x + nx + B.ux * hw, B.y + ny + B.uy * hw); ctx.lineTo(B.x - nx + B.ux * hw, B.y - ny + B.uy * hw); ctx.closePath();
    ctx.fillStyle = next ? `rgba(255,140,60,${0.12 + 0.1 * pulse})` : 'rgba(200,150,80,.10)'; ctx.fill(); ctx.setLineDash([10, 10]); ctx.lineWidth = 2.5; ctx.strokeStyle = next ? '#ffb070' : 'rgba(240,200,130,.55)'; ctx.stroke(); ctx.setLineDash([]);
    if (next) tag(ctx, 'NEXT SWEEP', B.x + B.ux * (hw + 22), B.y + B.uy * (hw + 22), 15, '#ffb070');
  }
  // the lanes as they charge (sand pours across one band)
  for (const l of sp.lanes || []) {
    const c = Math.cos(l.ang), s = Math.sin(l.ang), hw = l.w / 2, kk = clamp01(l.t / l.d), done = l.t >= l.d;
    const path = (f) => { const L = l.len * f; ctx.beginPath(); ctx.moveTo(l.x - s * hw, l.y + c * hw); ctx.lineTo(l.x - s * hw + c * L, l.y + c * hw + s * L); ctx.lineTo(l.x + s * hw + c * L, l.y - c * hw + s * L); ctx.lineTo(l.x + s * hw, l.y - c * hw); ctx.closePath(); };
    if (done) { ctx.globalAlpha = clamp01(1 - (l.t - l.d) / 12) * 0.8; path(1); ctx.fillStyle = '#fff2c0'; ctx.fill(); ctx.globalAlpha = 1; continue; }
    path(1); ctx.fillStyle = 'rgba(255,77,94,.16)'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = '#ff4d5e'; ctx.stroke();
    path(kk); ctx.fillStyle = 'rgba(230,170,90,.55)'; ctx.fill();
  }
  // the altar
  { const r = S.goalR, x = sp.gx, y = sp.gy; ctx.globalAlpha = 0.25 + 0.15 * pulse; circle(ctx, x, y, r, '#7dffb0', 0); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = '#7dffb0'; ctx.setLineDash([16, 10]); ctx.lineDashOffset = time * 30; ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#c99a58'; ctx.fillRect(x - 34, y - 22, 68, 30); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeRect(x - 34, y - 22, 68, 30); ctx.fillStyle = '#e8c27a'; ctx.fillRect(x - 24, y - 36, 48, 14); ctx.strokeRect(x - 24, y - 36, 48, 14);
    circle(ctx, x, y - 50, 9 + 3 * pulse, '#ffd86a', 3); tag(ctx, 'ALTAR', x, y + r + 26, 18, '#9fffc8'); }
  // the sun
  if (tell) { // falling out of the eaten sky: the shadow grows, the catch circle closes
    ctx.globalAlpha = 0.3 + 0.4 * k; ctx.beginPath(); ctx.ellipse(sp.x, sp.y + 6, 20 + 50 * k, 8 + 16 * k, 0, 0, TAU); ctx.fillStyle = '#000'; ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(sp.x, sp.y, S.catchR, 0, TAU); ctx.fillStyle = `rgba(255,210,63,${0.12 + 0.2 * k})`; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#ffd23f'; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -time * 40; ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(sp.x, sp.y, S.catchR, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.lineWidth = 8; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    tag(ctx, 'CATCH IT', sp.x, sp.y + S.catchR + 28, 22, '#ffe27a');
    sunOrb(ctx, sp.x, sp.y - 560 * (1 - k) * (1 - k) - 40, 30, time, false);
  } else if (bearer) { // carried overhead: a halo on the bearer and the fuse ring round the sun
    const x = bearer.x, y = bearer.y - 70;
    ctx.globalAlpha = 0.4 + 0.2 * pulse; circle(ctx, bearer.x, bearer.y, 44, null, 5, '#ffd23f'); ctx.globalAlpha = 1;
    sunOrb(ctx, x, y, 26, time, fuse < 0.3);
    ctx.beginPath(); ctx.arc(x, y, 40, -Math.PI / 2, -Math.PI / 2 + TAU * fuse); ctx.lineWidth = 6; ctx.strokeStyle = fuse < 0.3 ? (pulse > 0.5 ? '#ff3b5c' : '#ffffff') : '#ffffff'; ctx.stroke();
    if (local && bearer.id === local.id) tag(ctx, 'TO THE ALTAR', x, y - 54, 18, '#ffe27a');
  } else { // on the ground: pick it up
    ctx.beginPath(); ctx.arc(sp.sx, sp.sy, S.catchR * 0.7, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = pulse > 0.5 ? '#ffd23f' : '#ffffff'; ctx.setLineDash([10, 8]); ctx.stroke(); ctx.setLineDash([]);
    sunOrb(ctx, sp.sx, sp.sy - 10, 26, time, true); tag(ctx, 'PICK IT UP', sp.sx, sp.sy + S.catchR * 0.7 + 26, 20, '#ffe27a');
  }
  ctx.restore();
}
/** HUD (a left-side panel, clear of the boss bar and the prompts): the fuse meter + what YOU do now. y0 = under the letterbox. */
export function carryHud(ctx, w, y0, sp, sim, local, h = 720) {
  const S = SETPIECE.carry, tell = sp.ph === 'tell', life = sp.life || S.life, left = tell ? life / 60 : Math.max(0, (life - sp.t) / 60), k = tell ? 1 : clamp01(1 - sp.t / life);
  const me = local && sp.bearer === local.id, carried = !!sp.bearer;
  const bw = 250, x = 22, y = Math.max(y0 + 64, Math.round(h * 0.22));
  const lines = tell ? ['A SUN FALLS', 'stand in the gold circle to catch it']
    : me ? ['YOU CARRY THE SUN', 'slow, no rolls, no attacks', 'cross a band right after it sweeps', 'touch an ally to pass it']
    : carried ? ['BREAK THE WARDENS', 'each one broken slows the sweeps', 'stay close: take the sun if it drops']
    : ['THE SUN IS ON THE GROUND', 'pick it up!'];
  ctx.save(); ctx.fillStyle = 'rgba(10,12,24,.78)'; ctx.fillRect(x - 10, y - 30, bw + 20, 64 + lines.length * 20); ctx.strokeStyle = me ? '#ffd23f' : 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.strokeRect(x - 10, y - 30, bw + 20, 64 + lines.length * 20);
  ctx.font = "15px 'Lilita One', sans-serif"; ctx.textAlign = 'left'; ctx.fillStyle = k < 0.3 ? '#ff8a8a' : '#fff'; ctx.fillText(`THE SUN BURNS · ${left.toFixed(0)}s`, x, y - 10);
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(x, y, bw, 16); const gr = ctx.createLinearGradient(x, 0, x + bw, 0); gr.addColorStop(0, '#ff4a3a'); gr.addColorStop(0.35, '#ffb43c'); gr.addColorStop(1, '#ffe27a'); ctx.fillStyle = gr; ctx.fillRect(x, y, bw * k, 16);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x, y, bw, 16);
  lines.forEach((l, i) => { ctx.font = i ? "14px 'Lilita One', sans-serif" : "18px 'Lilita One', sans-serif"; ctx.fillStyle = i ? '#e8ecff' : me ? '#ffe27a' : carried ? '#ffffff' : '#ffb070'; ctx.fillText(l, x, y + 38 + i * 20); });
  ctx.restore(); void w;
}
