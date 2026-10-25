// The Forge of Cinders (world expansion 2), classic code-drawn style: three round soot-black forge halls joined by a
// glowing slag channel, then Hephast's foundry: 6 conveyor belts x 10 cells, alternate belts running opposite ways, a
// crucible mouth glowing at each belt's far end. Ground (belts slide with the packed offsets), telegraphs (the CASTING
// POUR mould riding + shearing on the belts, drop-hammer columns, the tongs, bellows), slag drips, the strongbox, the
// forge-doors, the HUD tracker + Hephast's bar, the minimap and the forge event FX. State comes from packForge (local
// sim, memoised per tick) or the co-op snapshot (sim.emberV.f).
import { INK, circle, rrect, star } from './art.js';
import { bloom } from './fxglow.js';
import { lgrad, ink } from './dunesfx.js';
import { FORGE_ROOMS, FORGE_BOUNDS as FB, FORGE_X, FOUNDRY, FOUNDRY_COLS as NC, FOUNDRY_LANES as NL, FT, FHW, FHH, forgeDoor, inForgeArea, FORGE_NAME } from '../sim/emberconst.js';
import { packForge, FORGE, MOLDS, mouthCol, laneDir } from '../sim/forge.js';

const TAU = Math.PI * 2, FONT = "'Lilita One', sans-serif";
const H = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const W = NC * FT, LX = FOUNDRY.x - FHW, TY = FOUNDRY.y - FHH;
const mod = (a, m) => ((a % m) + m) % m;
export const forgeVisible = (view) => view.x1 > FB.x0 - 300 && view.x0 < FB.x1 + 300 && view.y1 > FB.y0 - 300 && view.y0 < FB.y1 + 300;
let memo = { k: -1, s: null, v: null };
export function forgeState(sim) {
  if (sim.emberV !== undefined) return (sim.emberV && sim.emberV.f) || null;
  if (memo.s === sim && memo.k === sim.tick) return memo.v;
  memo = { k: sim.tick, s: sim, v: packForge(sim) };
  return memo.v;
}

// ------------------------------------------------------------------ ground
export function drawForgeGround(ctx, view, t, sim) {
  if (!forgeVisible(view)) return false;
  const T = forgeState(sim);
  const x0 = Math.max(view.x0, FB.x0 - 300), x1 = Math.min(view.x1, FB.x1 + 300), y0 = Math.max(view.y0, FB.y0 - 300), y1 = Math.min(view.y1, FB.y1 + 300);
  if (x1 > x0 && y1 > y0) {
    const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#140a08'); g.addColorStop(1, '#22100a'); ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    const S = 140; // drifting sparks in the dark
    for (let gx = Math.floor(x0 / S) * S; gx < x1; gx += S) for (let gy = Math.floor(y0 / S) * S; gy < y1; gy += S) {
      const h = H(gx / S, gy / S); if (h > 0.4) continue;
      const sx = gx + H(gy, gx) * S, sy = gy + S - ((H(gx + 3, gy) * S + t * 20 * (0.5 + h)) % S);
      ctx.globalAlpha = 0.3 + 0.5 * h; ctx.fillStyle = h < 0.12 ? '#ffd36a' : '#ff6a1a'; ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  // the slag channel joining the halls
  ctx.save(); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(FORGE_X, FORGE_ROOMS[0].y); ctx.lineTo(FORGE_X, FOUNDRY.y); ctx.lineWidth = 150; ctx.strokeStyle = '#2e1a14'; ctx.stroke(); ctx.lineWidth = 60; ctx.strokeStyle = '#a8301a'; ctx.stroke(); ctx.lineWidth = 24; ctx.strokeStyle = '#ff8a2a'; ctx.stroke();
  ctx.setLineDash([30, 40]); ctx.lineDashOffset = -t * 30; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,240,170,.6)'; ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  for (let i = 0; i < 3; i++) hall(ctx, FORGE_ROOMS[i], i, T, t, view);
  foundry(ctx, T, t, view);
  return true;
}
function hall(ctx, R, i, T, t, view) {
  if (R.x + R.r + 200 < view.x0 || R.x - R.r - 200 > view.x1 || R.y + R.r + 200 < view.y0 || R.y - R.r - 200 > view.y1) return;
  bloom(ctx, R.x, R.y, R.r + 160, '#ff5a1a', 0.18);
  circle(ctx, R.x, R.y, R.r + 34, '#3a2420', 5);
  for (let k = 0; k < 20; k++) { const a = (k / 20) * TAU, x = R.x + Math.cos(a) * (R.r + 22), y = R.y + Math.sin(a) * (R.r + 22); rrect(ctx, x - 13, y - 13, 26, 26, 4); ctx.fillStyle = k % 2 ? '#5a4a48' : '#4a3a38'; ctx.fill(); ink(ctx, 2); }
  const g = ctx.createRadialGradient(R.x - R.r * 0.3, R.y - R.r * 0.3, 20, R.x, R.y, R.r); g.addColorStop(0, '#6a524a'); g.addColorStop(0.7, '#4e3a34'); g.addColorStop(1, '#3a2a26');
  circle(ctx, R.x, R.y, R.r, g, 4);
  ctx.save(); ctx.beginPath(); ctx.arc(R.x, R.y, R.r, 0, TAU); ctx.clip();
  const S = 80; ctx.strokeStyle = 'rgba(20,10,8,.35)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = R.x - R.r; x <= R.x + R.r; x += S) { ctx.moveTo(x, R.y - R.r); ctx.lineTo(x, R.y + R.r); } for (let y = R.y - R.r; y <= R.y + R.r; y += S) { ctx.moveTo(R.x - R.r, y); ctx.lineTo(R.x + R.r, y); } ctx.stroke();
  for (let k = 0; k < 7; k++) { const a = H(i, k) * TAU, rr = R.r * (0.2 + H(k, i) * 0.65), x = R.x + Math.cos(a) * rr, y = R.y + Math.sin(a) * rr; ctx.beginPath(); ctx.ellipse(x, y, 26 + H(k, 3) * 20, 14, a, 0, TAU); ctx.fillStyle = 'rgba(255,110,30,.28)'; ctx.fill(); ctx.strokeStyle = 'rgba(20,8,6,.5)'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
  const D = forgeDoor(i), open = T && T.room === i && T.door;
  ctx.save(); ctx.translate(D.x, D.y - 40);
  rrect(ctx, -54, -40, 108, 80, 12); ctx.fillStyle = open ? '#ffb43c' : '#3a2e2c'; ctx.fill(); ink(ctx, 4);
  if (open) { bloom(ctx, 0, 0, 120, '#ff8a2a', 0.7 + 0.3 * Math.sin(t * 4)); star(ctx, 0, 0, 16, '#fff2a0', 2); }
  else { for (let k = -1; k <= 1; k++) { ctx.fillStyle = '#6a6468'; ctx.fillRect(k * 28 - 5, -36, 10, 72); } ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-54, -6, 108, 12); }
  ctx.restore();
  ctx.font = `14px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(R.name.toUpperCase(), R.x, R.y + R.r + 26); ctx.fillStyle = '#ffd08a'; ctx.fillText(R.name.toUpperCase(), R.x, R.y + R.r + 26);
}
function foundry(ctx, T, t, view) {
  const R = FOUNDRY;
  if (R.x + FHW + 300 < view.x0 || R.x - FHW - 300 > view.x1 || R.y + FHH + 300 < view.y0 || R.y - FHH - 300 > view.y1) return;
  const Bd = T && T.b, shrink = (Bd && Bd.shrink) || 0, off = (Bd && Bd.off) || [], v = (Bd && Bd.v) || Array.from({ length: NL }, (_, j) => laneDir(j) * FORGE.boss.belt[1]);
  bloom(ctx, R.x, R.y, FHW * 1.6, '#ff5a1a', 0.22);
  rrect(ctx, LX - 60, TY - 120, W + 120, FHH * 2 + 180, 18); ctx.fillStyle = lgrad(ctx, R.x, R.y, FHW + 60, '#4a3a38'); ctx.fill(); ink(ctx, 5);
  // the smith's dais (north)
  rrect(ctx, R.x - 150, TY - 110, 300, 100, 14); ctx.fillStyle = '#5a4642'; ctx.fill(); ink(ctx, 3);
  for (let j = 0; j < NL; j++) {
    const y = TY + j * FT, vj = v[j] || 0, mc = mouthCol(vj, shrink);
    // the belt bed
    ctx.fillStyle = j % 2 ? '#3e3436' : '#463c3e'; ctx.fillRect(LX, y, W, FT);
    // slats sliding with the belt offset
    ctx.save(); ctx.beginPath(); ctx.rect(LX, y + 4, W, FT - 8); ctx.clip();
    const o = mod(off[j] || 0, 36); ctx.fillStyle = 'rgba(20,12,12,.45)';
    for (let x = LX - 36 + o; x < LX + W; x += 36) ctx.fillRect(x, y + 6, 6, FT - 12);
    // chevrons showing the way the belt runs
    ctx.globalAlpha = 0.45; ctx.strokeStyle = vj >= 0 ? '#ffb36a' : '#9fd8ff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const dir = Math.sign(vj || laneDir(j)), co = mod((off[j] || 0), 110);
    for (let x = LX - 110 + co; x < LX + W + 110; x += 110) { ctx.beginPath(); ctx.moveTo(x - dir * 10, y + FT * 0.3); ctx.lineTo(x + dir * 10, y + FT * 0.5); ctx.lineTo(x - dir * 10, y + FT * 0.7); ctx.stroke(); }
    ctx.restore();
    // rollers at the belt ends + the crucible mouth
    for (let i = 0; i < NC; i++) {
      const x = LX + i * FT, dead = i < shrink || i >= NC - shrink;
      if (dead) { const lg = ctx.createLinearGradient(x, y, x + FT, y + FT); lg.addColorStop(0, '#ff8a2a'); lg.addColorStop(1, '#c8401a'); ctx.fillStyle = lg; ctx.fillRect(x, y, FT, FT); ctx.fillStyle = 'rgba(255,240,170,.5)'; ctx.fillRect(x + 10 + 10 * Math.sin(t * 2 + j), y + 30, 30, 6); continue; }
      if (i === mc) { const k = 0.7 + 0.3 * Math.sin(t * 6 + j); const gr = ctx.createRadialGradient(x + FT / 2, y + FT / 2, 4, x + FT / 2, y + FT / 2, FT * 0.62); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(0.5, '#ff8a2a'); gr.addColorStop(1, '#6a1a10'); ctx.globalAlpha = k; ctx.fillStyle = gr; ctx.fillRect(x + 6, y + 6, FT - 12, FT - 12); ctx.globalAlpha = 1; ctx.lineWidth = 3; ctx.strokeStyle = '#ff4b1f'; ctx.strokeRect(x + 6, y + 6, FT - 12, FT - 12); }
    }
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.moveTo(LX, y); ctx.lineTo(LX + W, y); ctx.stroke();
  }
  // cell grid
  ctx.strokeStyle = 'rgba(255,200,150,.1)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let i = 1; i < NC; i++) { ctx.moveTo(LX + i * FT, TY); ctx.lineTo(LX + i * FT, TY + FHH * 2); } ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeRect(LX, TY, W, FHH * 2);
  // side rails with rivets
  for (const sx of [LX - 24, LX + W + 8]) { rrect(ctx, sx, TY - 6, 16, FHH * 2 + 12, 6); ctx.fillStyle = '#6a6468'; ctx.fill(); ink(ctx, 2.4); for (let j = 0; j <= NL; j++) circle(ctx, sx + 8, TY + j * FT, 3, '#bdb6b8', 1.2); }
  if (Bd && Bd.st === 'victory') { const D = forgeDoor(3); bloom(ctx, D.x, D.y, 120, '#ffb43c', 0.8); circle(ctx, D.x, D.y, 46, 'rgba(255,210,140,.6)', 4, '#fff2a0'); ctx.font = `16px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText('EXIT', D.x, D.y + 6); ctx.fillStyle = '#fff'; ctx.fillText('EXIT', D.x, D.y + 6); }
}

// ------------------------------------------------------------------ under the characters: telegraphs, slag shadows, the strongbox
export function drawForgeUnder(ctx, sim, local, t) {
  const T = forgeState(sim);
  if (!T) return;
  if (T.pend) for (const [x, y, el] of T.pend.pts) { const k = 1 - T.pend.t / FORGE.rise; ctx.save(); ctx.globalAlpha = 0.4 + 0.5 * k; ctx.beginPath(); ctx.ellipse(x, y, 30 + k * 12, (30 + k * 12) * 0.6, 0, 0, TAU); ctx.fillStyle = 'rgba(255,90,30,.4)'; ctx.fill(); ctx.setLineDash([8, 6]); ctx.lineWidth = 3; ctx.strokeStyle = el ? '#ffcf3a' : '#ffb36a'; ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
  for (const [x, y, ct, d] of T.sl) {
    if (ct > d) { ctx.save(); ctx.globalAlpha = 1 - (ct - d) / 10; circle(ctx, x, y, 50, 'rgba(255,140,40,.6)', 0); ctx.restore(); continue; }
    const k = ct / d, r = FORGE.slag.r;
    ctx.save(); ctx.globalAlpha = 0.25 + 0.35 * k; circle(ctx, x, y, r * (0.4 + 0.6 * k), 'rgba(60,20,10,.6)', 0); ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = '#ffb36a'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + k * TAU); ctx.lineWidth = 6; ctx.strokeStyle = '#ff4b1f'; ctx.stroke(); ctx.restore();
  }
  if (T.chest) strongbox(ctx, T.chest, t);
  const Bd = T.b;
  if (!Bd) return;
  for (const te of Bd.tele) tele(ctx, te, Bd, t, local);
}
function strongbox(ctx, c, t) {
  ctx.save(); ctx.translate(c.x, c.y);
  if (!c.open) bloom(ctx, 0, 0, 110, '#ffb43c', 0.5 + 0.3 * Math.sin(t * 3));
  rrect(ctx, -40, -22, 80, 46, 6); ctx.fillStyle = lgrad(ctx, 0, 0, 40, c.open ? '#5a4a48' : '#7a5a3a'); ctx.fill(); ink(ctx, 3.5);
  ctx.fillStyle = '#6a6468'; ctx.fillRect(-40, -6, 80, 8); ctx.fillRect(-26, -22, 8, 46); ctx.fillRect(18, -22, 8, 46);
  if (!c.open) { circle(ctx, 0, 2, 9, '#ffd36a', 2.4); ctx.fillStyle = INK; ctx.fillRect(-2, 0, 4, 7); }
  else { ctx.beginPath(); ctx.ellipse(0, -22, 34, 8, 0, 0, TAU); ctx.fillStyle = '#ffe27a'; ctx.fill(); ink(ctx, 2); }
  ctx.restore();
}
function tele(ctx, te, Bd, t, local) {
  const k = Math.min(1, te.t / Math.max(1, te.d)), done = te.done;
  if (te.sh === 'mold') { // the CASTING POUR: every cell floods except the mould, whose cells ride (and shear on) the belts
    const rows = MOLDS[te.mold], off = Bd.off || [];
    ctx.save();
    for (let j = 0; j < NL; j++) {
      const y = TY + j * FT, shift = (off[j] || 0) - ((te.o0 && te.o0[j]) || 0), base = LX + mod(shift + (te.s0 || 0) * FT, W);
      ctx.globalAlpha = done ? Math.max(0, 1 - (te.t - te.d) / 40) * 0.9 : 0.18 + 0.42 * k;
      ctx.fillStyle = done ? '#ffd36a' : 'rgba(214,28,52,.85)'; ctx.fillRect(LX, y + 3, W, FT - 6);
      if (!rows) continue;
      for (let c = 0; c < NC; c++) {
        if (rows[j][c] !== '#') continue;
        for (const wrap of [0, -W]) {
          const x = base + c * FT + wrap; if (x + FT <= LX || x >= LX + W) continue;
          const a = Math.max(LX, x), b = Math.min(LX + W, x + FT);
          ctx.globalAlpha = done ? Math.max(0, 1 - (te.t - te.d) / 40) : 0.95;
          ctx.fillStyle = '#2a3a4a'; ctx.fillRect(a, y + 6, b - a, FT - 12);
          ctx.lineWidth = 4; ctx.strokeStyle = '#5cff9d'; ctx.strokeRect(a + 2, y + 8, b - a - 4, FT - 16);
        }
      }
    }
    if (!done) { ctx.globalAlpha = 1; ctx.font = `22px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = INK; const s = (te.mold === 'none' ? 'MASTERWORK' : te.mold.toUpperCase()) + ` · ${Math.max(0, Math.ceil((te.d - te.t) / 60))}`; ctx.strokeText(s, FOUNDRY.x, TY + FHH * 2 + 34); ctx.fillStyle = '#ffd08a'; ctx.fillText(s, FOUNDRY.x, TY + FHH * 2 + 34); }
    ctx.restore(); return;
  }
  if (te.sh === 'cols') { // the drop hammers
    ctx.save();
    for (const c of te.c) {
      const x = LX + c * FT;
      if (done) { ctx.globalAlpha = Math.max(0, 1 - (te.t - te.d) / 30); ctx.fillStyle = '#fff2a0'; ctx.fillRect(x, TY, FT, FHH * 2); continue; }
      ctx.globalAlpha = 0.2 + 0.4 * k; ctx.fillStyle = 'rgba(255,77,94,.7)'; ctx.fillRect(x + 4, TY, FT - 8, FHH * 2);
      ctx.globalAlpha = 0.9; ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.strokeRect(x + 4, TY, FT - 8, FHH * 2);
      // the hammer head's shadow growing as it falls
      const hw = (FT - 20) * (0.4 + 0.6 * k); ctx.fillStyle = 'rgba(20,10,10,.45)'; ctx.fillRect(x + FT / 2 - hw / 2, TY + 6, hw, FHH * 2 - 12);
    }
    ctx.restore(); return;
  }
  if (te.sh === 'circle' && te.k === 'tongs') {
    ctx.save(); const r = 40 + 20 * (1 - k);
    ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(te.x, te.y, r, 0, TAU); ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 40; ctx.strokeStyle = '#ff4d5e'; ctx.stroke(); ctx.setLineDash([]);
    for (const sd of [-1, 1]) { ctx.save(); ctx.translate(te.x + sd * r * 0.9, te.y - 10); ctx.rotate(sd * (0.6 - k * 0.5)); ctx.beginPath(); ctx.moveTo(0, -40); ctx.quadraticCurveTo(sd * 18, -10, 0, 16); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#8a8488'; ctx.stroke(); ctx.restore(); }
    if (local && te.pid === local.id) { ctx.font = `16px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText('THE TONGS!', te.x, te.y - 70); ctx.fillStyle = '#ffb36a'; ctx.fillText('THE TONGS!', te.x, te.y - 70); }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ over the characters: falling slag
export function drawForgeOver(ctx, sim, local, t) {
  const T = forgeState(sim);
  if (!T) return;
  for (const [x, y, ct, d] of T.sl) {
    if (ct >= d) continue;
    const k = ct / d, hgt = (1 - k * k) * 520;
    ctx.save(); ctx.translate(x, y - hgt); ctx.globalAlpha = Math.min(1, k * 3);
    bloom(ctx, 0, 0, 40, '#ff8a2a', 0.7);
    ctx.beginPath(); ctx.moveTo(0, -46); ctx.quadraticCurveTo(16, 0, 0, 16); ctx.quadraticCurveTo(-16, 0, 0, -46); ctx.fillStyle = lgrad(ctx, 0, -10, 24, '#ffb43c'); ctx.fill(); ink(ctx, 3);
    ctx.restore();
  }
}

// ------------------------------------------------------------------ HUD (screen space)
export function drawForgeHud(ctx, sim, p, w, h, txt, bar, time) {
  const T = forgeState(sim);
  if (!T || !p || !inForgeArea(p.x, p.y)) return 0;
  let y = 92;
  if (T.st === 'room' || T.st === 'clear') {
    txt(ctx, `Hall ${T.room + 1}/3 · ${(FORGE_ROOMS[T.room] || {}).name || ''}`, w / 2, y + 18, 20, '#fff', 'center', 4);
    const wv = T.st === 'clear' ? 'CLEARED: take the forge-door north' : `Wave ${Math.max(1, T.wave)}/${T.nw}`;
    txt(ctx, wv, w / 2, y + 42, 16, T.st === 'clear' ? '#7dffb0' : '#ffb36a', 'center', 3);
    if (T.ch) {
      const cw = 320, cx = w / 2 - cw / 2, cy = y + 56, sl = T.ch.k === 'slag', done = sl ? T.ch.done : (T.ch.done || T.ch.n >= T.ch.need);
      rrect(ctx, cx, cy, cw, 40, 10); ctx.fillStyle = 'rgba(43,36,51,.8)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = done ? '#7dffb0' : sl ? '#ff8a7a' : '#ffb36a'; ctx.stroke();
      txt(ctx, `STRONGBOX · ${T.ch.text}`, cx + 12, cy + 17, 13, done ? '#7dffb0' : '#ffe6c8', 'left', 3);
      if (sl) txt(ctx, `Slag hits ${T.ch.n}/${T.ch.need}`, cx + 12, cy + 33, 12, T.ch.n > T.ch.need ? '#ff5e5b' : '#fff', 'left', 3);
      else for (let i = 0; i < T.ch.need; i++) { const px = cx + 14 + i * Math.min(24, (cw - 28) / T.ch.need); circle(ctx, px + 6, cy + 30, 5.5, i < T.ch.n ? (done ? '#7dffb0' : '#ffb36a') : 'rgba(255,255,255,.18)', 1.6); }
      if (done) txt(ctx, '✔', cx + cw - 22, cy + 26, 20, '#7dffb0', 'center', 3);
      y = cy + 44;
    } else y += 52;
  } else if (T.b) {
    const Bd = T.b, b = sim.enemies.find((e) => e.type === 'hephast' && !e.dead);
    const bbw = Math.min(640, w * 0.52), bbx = w / 2 - bbw / 2, bby = y;
    if (Bd.st === 'victory') { txt(ctx, 'THE FORGE GOES COLD', w / 2, bby - 4, 20, '#ffd08a', 'center', 4); txt(ctx, 'Grab the loot · the EXIT is at the south edge of the foundry', w / 2, bby + 18, 15, '#fff', 'center', 3); return bby + 30; }
    if (Bd.st === 'wipe') { txt(ctx, 'THE LINE STOPS · Hephast restarts the foundry', w / 2, bby + 10, 20, '#ff8a7a', 'center', 4); return bby + 30; }
    txt(ctx, 'Hephast, the Cinder Smith', w / 2, bby - 4, 22, '#ffd08a', 'center', 4);
    if (Bd.st === 'pull') txt(ctx, `The line starts in ${Math.ceil(Bd.pull / 60)}…`, w / 2, bby + 24, 18, '#fff', 'center', 3);
    else if (b) {
      bar(ctx, bbx, bby + 10, bbw, 22, b.hp / b.maxHp, Bd.flaw > 0 ? '#7dffb0' : '#ff9a4a', `${Math.ceil(b.hp)} / ${b.maxHp}`);
      for (const k of [0.66, 0.33]) { ctx.fillStyle = INK; ctx.fillRect(bbx + bbw * k - 2, bby + 8, 4, 26); }
      txt(ctx, `Phase ${Bd.phase}`, bbx + bbw + 8, bby + 22, 14, '#fff', 'left', 3);
      if (Bd.flaw > 0) txt(ctx, `FLAWLESS CAST · +50% damage · ${Math.ceil(Bd.flaw / 60)}s`, w / 2, bby + 54, 18, '#7dffb0', 'center', 4);
      else if (Bd.bellT > 0) txt(ctx, `BELLOWS · the belts run backwards at double speed · ${Math.ceil(Bd.bellT / 60)}s`, w / 2, bby + 54, 16, '#9fd8ff', 'center', 3);
      else txt(ctx, Bd.phase >= 3 ? 'The floor narrows · stand in the mould and ride it' : Bd.phase === 2 ? 'Faster belts · kill the Constructs' : 'Stand in the mould when the metal pours · the belts shear it apart', w / 2, bby + 54, 14, '#fff', 'center', 3);
      if (Bd.enraged) txt(ctx, 'MASTERWORK', w / 2, bby + 76, 16, '#ff5e5b', 'center', 3);
      else if (Bd.enr > 0 && Bd.enr < 60 * 60) txt(ctx, `Masterwork in ${Math.ceil(Bd.enr / 60)}s`, w / 2, bby + 76, 13, '#ff9a8a', 'center', 3);
    }
    y = bby + 96;
  }
  if (T.call && T.call.t > 0) {
    const a = Math.min(1, T.call.t / 30, (T.call.d - T.call.t + 6) / 12);
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    txt(ctx, T.call.txt, w / 2, h * 0.32, 40, T.call.col || '#fff', 'center', 8);
    if (T.call.sub) txt(ctx, T.call.sub, w / 2, h * 0.32 + 30, 18, '#fff', 'center', 4);
    ctx.restore();
  }
  void time;
  return y;
}

// ------------------------------------------------------------------ minimap
export function drawForgeMinimap(ctx, x, y, R, sim, p, CLASSES) {
  const T = forgeState(sim);
  circle(ctx, x, y, R + 5, INK, 0);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
  ctx.fillStyle = '#1a0c08'; ctx.fillRect(x - R, y - R, R * 2, R * 2);
  const cy = (FORGE_ROOMS[0].y + FOUNDRY.y) / 2, k = (R * 2 - 16) / 5000, X = (wx) => x + (wx - FORGE_X) * k, Y = (wy) => y + (wy - cy) * k;
  ctx.beginPath(); ctx.moveTo(X(FORGE_X), Y(FORGE_ROOMS[0].y)); ctx.lineTo(X(FORGE_X), Y(FOUNDRY.y)); ctx.strokeStyle = 'rgba(255,140,60,.5)'; ctx.lineWidth = 3; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
  const cur = T ? (T.b ? 3 : T.room) : -1;
  FORGE_ROOMS.forEach((Rm, i) => {
    const fill = cur === i ? '#c88a5a' : i < cur ? '#6a4a3a' : '#3a2420';
    if (Rm.foundry) { const sx = FHW * k, sy = FHH * k; ctx.fillStyle = fill; ctx.fillRect(X(Rm.x) - sx, Y(Rm.y) - sy, sx * 2, sy * 2); ctx.lineWidth = 2; ctx.strokeStyle = cur === i ? '#ffffff' : INK; ctx.strokeRect(X(Rm.x) - sx, Y(Rm.y) - sy, sx * 2, sy * 2); }
    else circle(ctx, X(Rm.x), Y(Rm.y), Rm.r * k, fill, 2, cur === i ? '#ffffff' : INK);
  });
  for (const e of sim.enemies) { if (e.dead || !inForgeArea(e.x, e.y)) continue; ctx.fillStyle = e.boss ? '#ff5e5b' : e.elite ? '#ffcf3a' : '#ff4d4d'; ctx.fillRect(X(e.x) - 1.5, Y(e.y) - 1.5, 3, 3); }
  if (sim.players) for (const q of sim.players.values()) if (q.id !== p.id && !q.dead) circle(ctx, X(q.x), Y(q.y), 3, CLASSES[q.cls] ? CLASSES[q.cls].color : '#fff', 1.2);
  circle(ctx, X(p.x), Y(p.y), 3.5, '#fff', 1.6);
  ctx.restore();
  circle(ctx, x, y, R + 3, null, 5, INK); circle(ctx, x, y, R, null, 2, 'rgba(255,255,255,.35)');
}

// ------------------------------------------------------------------ Hephast (registered into art.js ENEMY_DRAW from emberfx's registry)
import { ENEMY_DRAW, shade } from './art.js';
import { ball, oval } from './dunesfx.js';
/** Hephast, the Cinder Smith: a huge bald soot-black smith (top-down) in a leather apron, a glowing forge-hammer in one
 *  fist and long tongs in the other, his beard a curtain of embers; his apron cracks open on a flawless cast */
ENEMY_DRAW.hephast = function drawHephast(ctx, e, t, col) {
  const r = e.r; ctx.rotate(-(e.face || 0)); // (he always faces south, down the line)
  const stun = e.cc && e.cc.stun > 0, sw = Math.sin(t * 2.2) * 0.2;
  // tongs (west hand)
  ctx.save(); ctx.translate(-r * 0.95, r * 0.1); ctx.rotate(-0.4 + sw); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 0.2, r * 1.3); ctx.moveTo(r * 0.12, 0); ctx.lineTo(r * 0.02, r * 1.3); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 3.5; ctx.strokeStyle = '#8a8488'; ctx.stroke(); ctx.restore();
  // hammer (east hand)
  ctx.save(); ctx.translate(r * 0.95, r * 0.1); ctx.rotate(0.3 - sw); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, r * 1.1); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#7a5a3a'; ctx.stroke(); rrect(ctx, -r * 0.35, r * 1.0, r * 0.7, r * 0.4, 5); ctx.fillStyle = lgrad(ctx, 0, r * 1.2, r * 0.4, '#5a5458'); ctx.fill(); ink(ctx, 3); bloom(ctx, 0, r * 1.2, r * 0.5, '#ff8a2a', 0.7); ctx.restore();
  for (const sd of [-1, 1]) ball(ctx, sd * r * 0.85, r * 0.05, r * 0.32, '#5a4440', -2.3, 2.8, 0.3);
  oval(ctx, 0, 0, r * 0.95, r * 0.75, '#4a3632', -2.3, 3.6, 0, 0.4);
  // the apron
  ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.2); ctx.lineTo(r * 0.55, -r * 0.2); ctx.lineTo(r * 0.45, r * 0.7); ctx.lineTo(-r * 0.45, r * 0.7); ctx.closePath(); ctx.fillStyle = lgrad(ctx, 0, r * 0.2, r * 0.6, '#7a4a2a'); ctx.fill(); ink(ctx, 3);
  if (stun) { ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.1); ctx.lineTo(0, r * 0.25); ctx.lineTo(-r * 0.1, r * 0.6); ctx.moveTo(0, r * 0.25); ctx.lineTo(r * 0.25, r * 0.4); ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 3.5; ctx.stroke(); bloom(ctx, 0, r * 0.25, r * 0.7, '#7dffb0', 0.6); }
  // head + ember beard
  ball(ctx, 0, -r * 0.35, r * 0.4, '#8a6a5a', -2.3, 3, 0.4);
  for (let i = 0; i < 7; i++) { const a = Math.PI * 0.15 + (i / 6) * Math.PI * 0.7, fl = Math.sin(t * 12 + i) * 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.3, -r * 0.35 + Math.sin(a) * r * 0.3); ctx.lineTo(Math.cos(a) * r * 0.55 + fl, -r * 0.35 + Math.sin(a) * r * 0.62); ctx.lineWidth = 5; ctx.strokeStyle = i % 2 ? '#ff8a2a' : '#ffd36a'; ctx.lineCap = 'round'; ctx.stroke(); }
  for (const sd of [-1, 1]) { circle(ctx, sd * r * 0.14, -r * 0.42, r * 0.08, '#2a2020', 1.6); circle(ctx, sd * r * 0.14, -r * 0.42, r * 0.04, e.phase >= 3 ? '#ff3b1b' : '#ffd36a', 0); }
  void shade;
};

// ------------------------------------------------------------------ events (fx.js routes {type:'forge'} here; 'call' is drawn by the HUD)
export function forgeEventFx(fx, ev, me) {
  const x = ev.x, y = ev.y;
  switch (ev.ph) {
    case 'wave': for (const [px, py, el] of ev.pts || []) { fx.puffs(px, py, 8, '#ff8a2a', 14, 140, 0.7); if (el) fx.ring(px, py, 46, '#ffcf3a', 0.5, 5); } break;
    case 'roomClear': fx.ring(x, y, 320, '#ffd08a', 0.8, 8); break;
    case 'chest': fx.ring(x, y, 80, '#ffb43c', 0.6, 8); fx.sparks(x, y, -Math.PI / 2, 26, '#fff2a0', 420, 1.8); fx.shake(0.2); break;
    case 'chal': if (me) fx.text(x, y - 50, `CHAIN ${ev.n}/${ev.need}`, { size: 18, color: '#ffb36a', vy: -40, pop: 1, life: 0.9 }); break;
    case 'chalDone': fx.banner('CHALLENGE COMPLETE', '#7dffb0', 'Clear the hall to open the strongbox', 2.2, 36); break;
    case 'chalFail': fx.banner('CHALLENGE FAILED', '#ff8a7a', 'Too many slag hits: no strongbox this hall', 2.2, 36); break;
    case 'slag': fx.sparks(x, y, 0, 12, '#ffb43c', 300, TAU); fx.puffs(x, y, 6, '#4a3a38', 12, 120, 0.5); fx.ring(x, y, FORGE.slag.r, '#ff6a1a', 0.3, 4); fx.shake(0.06); break;
    case 'bossPull': fx.shake(0.3); break;
    case 'bossStart': fx.flashColor = '#ffd08a'; fx.flash = 0.5; fx.shake(0.4); fx.ring(x, y, 420, '#ff8a2a', 0.9, 14); break;
    case 'cast': if (ev.k === 'bellows') fx.shake(0.25); break;
    case 'bellows': fx.shake(0.35); fx.puffs(x, y, 20, '#e8e0d8', 24, 360, 0.9); break;
    case 'bellowsEnd': break;
    case 'tongs': fx.ring(x, y, 70, '#ffb36a', 0.4, 6); fx.sparks(x, y, -Math.PI / 2, 14, '#ff8a2a', 300, 1.4); break;
    case 'flawless': fx.ring(x, y, 160, '#7dffb0', 0.6, 10); fx.sparks(x, y, -Math.PI / 2, 20, '#7dffb0', 380, 1.6); fx.shake(0.25); break;
    case 'phase': fx.shake(0.5); fx.ring(x, y, 320, '#ffb36a', 0.7, 12); break;
    case 'shrink': fx.flashColor = '#ff6a1a'; fx.flash = 0.45; fx.shake(0.55); break;
    case 'enrage': fx.shake(0.5); break;
    case 'boom':
      if (ev.sh === 'mold') { fx.flashColor = '#ffb43c'; fx.flash = 0.35; fx.shake(0.3); for (let j = 0; j < NL; j++) fx.sparks(LX + W * (0.15 + 0.7 * H(j, 3)), TY + (j + 0.5) * FT, -Math.PI / 2, 4, '#ffd36a', 260, 1.6); }
      else if (ev.c) { for (const c of ev.c) for (let j = 0; j < NL; j += 2) fx.sparks(LX + (c + 0.5) * FT, TY + (j + 0.5) * FT, 0, 3, '#fff2a0', 240, TAU); fx.shake(0.22); }
      break;
    case 'hit': if (me) fx.text(x, y - 40, String(ev.what || 'Hit').toUpperCase(), { size: 16, color: '#ff9a8a', vy: -30, life: 0.8 }); break;
    case 'wipe': fx.banner('THE LINE STOPS', '#ff5e5b', 'Hephast restarts the foundry: try again', 2.6, 42, 'defeat'); break;
    case 'victory': fx.flashColor = '#ffd08a'; fx.flash = 0.8; fx.shake(0.7); fx.ring(x, y, 600, '#ff8a2a', 1.2, 20); fx.banner('THE CINDER SMITH FALLS', '#ffd08a', `${FORGE_NAME} cleared in ${ev.t || '?'}s`, 4, 50, 'victory'); break;
  }
}
