// The raid (Vorthax in The Rift Sanctum): arena floor, colour-coded ground telegraphs, stack/spread markers, tethers,
// portals, and the HUD pieces (boss bar with phase pips, ward bar, enrage timer, big mechanic callouts). Reads the plain
// `sim.raid` / `sim.riftPortal` data (a local sim in solo, the snapshot copy in co-op); never mutates the sim.
import { CUE_RGB } from './telefx.js';
import { RAID_POS, RAID_R, inRaidArea } from '../sim/constants.js';
import { RAID, PHASES, RAID_COL, inSafe } from '../sim/raid.js';
import { INK, circle, rrect } from './art.js';
import { newCanvas } from './sprite.js';
import { WP, wpOn, wpPiece, wpProp, wpTile, wpPattern } from './worldpaint.js';

const TAU = Math.PI * 2;
const COL = { danger: CUE_RGB.away, safe: CUE_RGB.safe, charge: CUE_RGB.away, spread: CUE_RGB.spread, stack: CUE_RGB.close, soak: CUE_RGB.soak }; // (Part A1/A2: the game-wide colour grammar, client/telefx.js)
function hash(i) { let h = (i * 374761393) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export const nearRaid = (view) => view.y1 > RAID_POS.y - RAID_R - 400 && view.y0 < RAID_POS.y + RAID_R + 900;

// ---- pass 2: the static arena (void nebula + starfield + the carved obsidian platform) is baked once into two canvases;
// only the runes, the centre sigil and a few twinkling motes are painted live. Was ~300 path ops + a full-view radial
// gradient every frame; now 2 drawImage + ~40 small ops.
let RAID_BG = null, RAID_PLAT = null;
function bakeRaidBg() {
  const W = 3400, H = 2800, k = 0.5, c = newCanvas(W * k, H * k), g = c.getContext('2d');
  g.scale(k, k);
  const gr = g.createRadialGradient(W / 2, H / 2, RAID_R * 0.6, W / 2, H / 2, RAID_R * 3); gr.addColorStop(0, '#1b1240'); gr.addColorStop(0.5, '#0d0a24'); gr.addColorStop(1, '#05040f');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) { // nebula wisps
    const x = hash(i * 7 + 1) * W, y = hash(i * 7 + 2) * H, r = 300 + hash(i * 7 + 3) * 500;
    const n = g.createRadialGradient(x, y, 0, x, y, r); n.addColorStop(0, i % 3 ? 'rgba(120,60,220,.16)' : 'rgba(60,200,255,.12)'); n.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = n; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 420; i++) {
    const x = hash(i + 5000) * W, y = hash(i + 7000) * H;
    g.globalAlpha = 0.25 + 0.6 * hash(i + 9000);
    g.fillStyle = i % 7 === 0 ? '#5ff2ff' : i % 5 === 0 ? '#c05cff' : '#ffffff';
    g.beginPath(); g.arc(x, y, i % 11 === 0 ? 2.4 : 1.2, 0, TAU); g.fill();
  }
  c.W = W; c.H = H; return c;
}
function bakeRaidPlat() {
  const R = RAID_R, PAD = 30, W = 2 * R + PAD * 2, H = 2 * R + PAD * 2 + 170, k = 1.25;
  const c = newCanvas(Math.ceil(W * k), Math.ceil(H * k)), g = c.getContext('2d');
  g.scale(k, k); g.translate(W / 2, R + PAD); // origin = arena centre
  // underside: layered crags hanging into the void, lit from the upper left
  g.fillStyle = '#0a0718'; g.beginPath(); g.ellipse(0, 46, R + 10, R * 0.98 + 10, 0, 0, TAU); g.fill();
  for (let i = 0; i < 14; i++) {
    const a = Math.PI * (0.08 + i * 0.065), a2 = a + 0.07 + hash(i + 40) * 0.05, d = 80 + hash(i) * 110;
    const x0 = Math.cos(a) * R, y0 = Math.sin(a) * R + 30, x1 = Math.cos(a2) * R, y1 = Math.sin(a2) * R + 30;
    const tx = (x0 + x1) / 2 * 0.86, ty = Math.max(y0, y1) + d;
    g.fillStyle = i % 2 ? '#140f2c' : '#1a1338'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(tx, ty); g.lineTo(x1, y1); g.closePath(); g.fill();
    g.fillStyle = 'rgba(150,120,255,.10)'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(tx, ty); g.lineTo((x0 + tx) / 2 + 6, (y0 + ty) / 2); g.closePath(); g.fill();
    if (i % 3 === 0) { g.strokeStyle = 'rgba(95,242,255,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(tx, ty - d * 0.6); g.lineTo(tx + 3, ty - 8); g.stroke(); }
  }
  // side wall band (thickness)
  g.fillStyle = '#1a1436'; g.beginPath(); g.ellipse(0, 22, R + 8, R + 4, 0, 0, TAU); g.fill();
  // rim stonework: bevelled blocks
  const NB = 36;
  for (let i = 0; i < NB; i++) {
    const a0 = i * TAU / NB + 0.006, a1 = (i + 1) * TAU / NB - 0.006, r0 = R - 26, r1 = R + 8;
    g.beginPath(); g.arc(0, 0, r1, a0, a1); g.arc(0, 0, r0, a1, a0, true); g.closePath();
    const am = (a0 + a1) / 2, lit = Math.cos(am - (-2.3));
    g.fillStyle = `rgb(${46 + lit * 14 | 0},${36 + lit * 10 | 0},${86 + lit * 22 | 0})`; g.fill();
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2; g.stroke();
    g.strokeStyle = lit > 0 ? 'rgba(200,180,255,.25)' : 'rgba(0,0,0,.25)'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, r1 - 3, a0 + 0.01, a1 - 0.01); g.stroke();
  }
  g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, R + 8, 0, TAU); g.stroke();
  // floor
  g.save(); g.beginPath(); g.arc(0, 0, R - 26, 0, TAU); g.clip();
  const fg = g.createRadialGradient(-R * 0.3, -R * 0.35, 40, 0, 0, R); fg.addColorStop(0, '#3a2f6e'); fg.addColorStop(0.7, '#2c2356'); fg.addColorStop(1, '#201946');
  g.fillStyle = fg; g.fillRect(-R, -R, 2 * R, 2 * R);
  // staggered flagstones, each bevelled (light upper-left edge, dark lower-right), a few cracked or rune-veined
  const rings = [60, 175, 265, 345, 410, R - 26], per = [6, 12, 18, 24, 30];
  for (let ri = 0; ri < 5; ri++) {
    const ra = rings[ri], rb = rings[ri + 1], n = per[ri], off = ri % 2 ? 0.5 : 0;
    for (let j = 0; j < n; j++) {
      const a0 = (j + off) * TAU / n + 0.012, a1 = (j + 1 + off) * TAU / n - 0.012, h = hash(ri * 100 + j);
      g.beginPath(); g.arc(0, 0, rb - 3, a0, a1); g.arc(0, 0, ra + 3, a1, a0, true); g.closePath();
      g.fillStyle = `rgba(${h < 0.3 ? '20,14,46' : '70,58,130'},${0.12 + h * 0.18})`; g.fill();
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3; g.stroke();
      const am = (a0 + a1) / 2, lit = Math.cos(am + 2.3);
      g.strokeStyle = lit > 0 ? 'rgba(190,170,255,.16)' : 'rgba(0,0,0,.22)'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, ra + 5, a0 + 0.01, a1 - 0.01); g.stroke();
      if (h > 0.82) { // crack
        const mr = (ra + rb) / 2; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.5; g.beginPath();
        g.moveTo(Math.cos(a0 + 0.02) * mr, Math.sin(a0 + 0.02) * mr); g.lineTo(Math.cos(am) * (mr + 12), Math.sin(am) * (mr + 12)); g.lineTo(Math.cos(a1 - 0.03) * (mr - 8), Math.sin(a1 - 0.03) * (mr - 8)); g.stroke();
      } else if (h < 0.08) { // rune-veined stone
        const mr = (ra + rb) / 2; g.strokeStyle = 'rgba(95,242,255,.35)'; g.lineWidth = 2; g.beginPath();
        g.moveTo(Math.cos(a0 + 0.03) * mr, Math.sin(a0 + 0.03) * mr); g.quadraticCurveTo(Math.cos(am) * (mr - 14), Math.sin(am) * (mr - 14), Math.cos(a1 - 0.03) * mr, Math.sin(a1 - 0.03) * mr); g.stroke();
      }
    }
  }
  // engraved quadrant channels (Eclipse guides) with gold inlay
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 9; g.beginPath(); g.moveTo(dx * 200, dy * 200); g.lineTo(dx * (R - 30), dy * (R - 30)); g.stroke();
    g.strokeStyle = 'rgba(214,176,92,.35)'; g.lineWidth = 2.5; g.stroke();
  }
  // raised centre dais: octagon with gold trim and a bevel
  const oct = (r) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * TAU / 8; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); };
  oct(205); g.fillStyle = 'rgba(0,0,0,.35)'; g.fill();
  oct(196); const dg = g.createLinearGradient(-150, -150, 150, 150); dg.addColorStop(0, '#4a3d86'); dg.addColorStop(1, '#251d4c'); g.fillStyle = dg; g.fill();
  g.strokeStyle = '#d6b05c'; g.lineWidth = 3; g.stroke();
  oct(184); g.strokeStyle = 'rgba(255,230,160,.25)'; g.lineWidth = 1.5; g.stroke();
  g.restore();
  // rim shading: inner occlusion + rim light on the upper left
  g.save(); g.beginPath(); g.arc(0, 0, R - 26, 0, TAU); g.clip();
  const sg = g.createRadialGradient(0, 0, R - 90, 0, 0, R - 26); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = sg; g.fillRect(-R, -R, 2 * R, 2 * R);
  g.restore();
  g.strokeStyle = 'rgba(210,190,255,.35)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R + 5, Math.PI * 0.85, Math.PI * 1.65); g.stroke();
  c.W = W; c.H = H; c.OX = W / 2; c.OY = R + PAD; return c;
}

let RAID_PLAT_P = null;
function paintRaidFloor() {
  const src = RAID_PLAT || bakeRaidPlat(), c = newCanvas(src.width, src.height), g = c.getContext('2d'), R = RAID_R, k = src.width / src.W;
  g.drawImage(src, 0, 0);
  g.setTransform(k, 0, 0, k, src.OX * k, src.OY * k);
  g.save(); g.beginPath(); g.arc(0, 0, R - 26, 0, TAU); g.clip();
  g.globalAlpha = 0.9; g.fillStyle = wpPattern(g, 'T11', 360); g.fillRect(-R, -R, 2 * R, 2 * R); g.globalAlpha = 1;
  const sg = g.createRadialGradient(0, 0, R * 0.35, 0, 0, R - 26); sg.addColorStop(0, 'rgba(40,20,90,.05)'); sg.addColorStop(1, 'rgba(10,5,30,.45)'); g.fillStyle = sg; g.fillRect(-R, -R, 2 * R, 2 * R);
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 8; g.beginPath(); g.moveTo(dx * 200, dy * 200); g.lineTo(dx * (R - 30), dy * (R - 30)); g.stroke(); g.strokeStyle = 'rgba(214,176,92,.4)'; g.lineWidth = 2.5; g.stroke(); }
  const oct = (r) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * TAU / 8; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); };
  oct(198); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 6; g.stroke(); g.strokeStyle = '#d6b05c'; g.lineWidth = 3; g.stroke();
  g.restore();
  c.W = src.W; c.H = src.H; c.OX = src.OX; c.OY = src.OY; c.ep = WP.epoch; return c;
}
/** The void + the floating obsidian platform. */
export function drawRaidGround(ctx, view, time, sim) {
  if (!nearRaid(view)) return;
  const cx = RAID_POS.x, cy = RAID_POS.y, R = RAID_R;
  if (!RAID_BG) { RAID_BG = bakeRaidBg(); RAID_PLAT = bakeRaidPlat(); }
  ctx.save();
  ctx.fillStyle = '#05040f'; ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  ctx.drawImage(RAID_BG, cx - RAID_BG.W / 2, cy - RAID_BG.H / 2, RAID_BG.W, RAID_BG.H);
  for (let i = 0; i < 40; i++) { // a few drifting / twinkling rift motes
    const x = cx + (hash(i) - 0.5) * 3000, y = cy + (hash(i + 999) - 0.5) * 2400 - ((time * (8 + hash(i + 7) * 20)) % 2400) * (i % 2);
    if (x < view.x0 || x > view.x1 || y < view.y0 || y > view.y1) continue;
    ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(time * (0.5 + hash(i + 3)) + i));
    ctx.fillStyle = i % 3 ? '#c05cff' : '#5ff2ff'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;
  let PL = RAID_PLAT;
  if (wpOn() && wpTile('T11')) { // painted: the same crags / rim, the floor in the painted Rift Sanctum stone (T11)
    if (!RAID_PLAT_P || RAID_PLAT_P.ep !== WP.epoch) RAID_PLAT_P = paintRaidFloor();
    PL = RAID_PLAT_P;
  }
  ctx.drawImage(PL, cx - PL.OX, cy - PL.OY, PL.W, PL.H);
  // live: centre sigil
  ctx.strokeStyle = `rgba(95,242,255,${0.28 + 0.1 * Math.sin(time * 2)})`; ctx.lineWidth = 3;
  ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i * TAU / 6 * 2; const x = cx + Math.cos(a) * 120, y = cy + Math.sin(a) * 120; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 170, 0, TAU); ctx.setLineDash([10, 14]); ctx.lineDashOffset = -time * 12; ctx.stroke(); ctx.setLineDash([]);
  // rim runes
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 24; i++) { const a = i * TAU / 24 + time * 0.05, ca = Math.cos(a), sa = Math.sin(a), px = cx + ca * (R - 13), py = cy + sa * (R - 13);
    ctx.save();
    ctx.translate(px, py); ctx.rotate(a + Math.PI / 2); ctx.globalAlpha = 0.55 + 0.35 * Math.sin(time * 3 + i); ctx.strokeStyle = i % 3 ? '#5ff2ff' : '#c05cff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(0, 5); ctx.lineTo(5, -5); ctx.moveTo(0, -6); ctx.lineTo(0, 1); ctx.stroke(); ctx.restore(); }
  ctx.globalAlpha = 1; ctx.strokeStyle = '#5ff2ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  ctx.restore();
  // exit rift once the fight is over (south rim)
  const Rd = sim && sim.raid;
  if (Rd && Rd.st === 'victory') drawPortal(ctx, cx, cy + R - 40, time, '#ffe27a', 'EXIT');
}

/** A swirling rift portal (Grimtusk's arena after he falls, and the raid's exit). */
export function drawPortal(ctx, x, y, time, col = '#5ff2ff', label = 'RIFT') {
  ctx.save();
  if (wpOn() && wpPiece('riftportal')) { // painted: the violet crystal rift
    const g = ctx.createRadialGradient(x, y, 4, x, y, 90); g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(0.4, col + '55'); g.addColorStop(1, 'rgba(40,10,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + 20, 90, 50, 0, 0, TAU); ctx.fill();
    wpProp(ctx, 'riftportal', x, y + 40, 150 + Math.sin(time * 2) * 2);
    ctx.font = "15px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(label, x, y - 118); ctx.fillStyle = col; ctx.fillText(label, x, y - 118);
    ctx.restore(); return;
  }
  const g = ctx.createRadialGradient(x, y, 4, x, y, 62); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(40,10,90,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 58, 44, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y, 46 - i * 12, 34 - i * 9, 0, time * (2 + i) + i, time * (2 + i) + i + 4.2); ctx.strokeStyle = i === 1 ? '#c05cff' : '#ffffff'; ctx.lineWidth = 4 - i; ctx.stroke(); }
  ctx.font = "15px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(label, x, y - 56); ctx.fillStyle = col; ctx.fillText(label, x, y - 56);
  ctx.restore();
}

/** Ground telegraphs, marker circles and tethers (under the characters). */
export function drawRaidUnder(ctx, sim, local, time) {
  if (sim.riftPortal) { // (fix pass: sealed while it arms or while someone still has the hunt's reward screen up)
    const rp = sim.riftPortal, sealed = rp.arm > 0 || (sim.players && typeof sim.players.values === 'function' && [...sim.players.values()].some((p) => p && !p.dead && p.rwHold > 0));
    drawPortal(ctx, rp.x, rp.y, time, sealed ? '#8a9bb0' : '#5ff2ff', sealed ? 'RIFT · opening…' : 'RIFT · Vorthax');
  }
  const R = sim.raid;
  if (!R) return;
  ctx.save(); ctx.beginPath(); ctx.arc(RAID_POS.x, RAID_POS.y, RAID_R + 4, 0, TAU); ctx.clip(); // telegraphs stay on the platform
  for (const t of R.tele || []) drawTele(ctx, t, time, sim, local);
  ctx.restore();
  for (const m of R.marks || []) drawMark(ctx, m, sim, time, local);
}
function fillCol(c, a) { return (COL[c] || COL.danger)[0] + a + ')'; }
function edgeCol(c) { return (COL[c] || COL.danger)[1]; }
function teleProg(t) { return Math.max(0, Math.min(1, t.t / Math.max(1, t.d))); }
function drawTele(ctx, t, time, sim, local) {
  const k = teleProg(t), done = t.done || t.t >= t.d, flash = done ? Math.max(0, 1 - (t.t - t.d) / 14) : 0;
  const c = t.col || 'danger';
  ctx.save();
  if (done) { // the hit: a bright flash of the shape
    ctx.globalAlpha = flash * 0.75; ctx.fillStyle = c === 'safe' ? 'rgba(255,60,50,.9)' : '#fff6f0';
    if (t.sh === 'safe') { safePath(ctx, t, true); ctx.fill('evenodd'); } else { shapePath(ctx, t); ctx.fill(); } ctx.restore(); return;
  }
  const pulse = 0.5 + 0.5 * Math.sin(time * (8 + k * 14));
  if (t.sh === 'safe') { // the whole arena red except the green zones (+ a sweeping fill showing time left)
    ctx.globalAlpha = 0.2 + 0.25 * k; ctx.fillStyle = 'rgba(255,50,40,1)'; safePath(ctx, t, true); ctx.fill('evenodd');
    ctx.globalAlpha = 0.35 + 0.3 * pulse; ctx.fillStyle = fillCol('safe', 0.5); safePath(ctx, t, false); ctx.fill('evenodd');
    ctx.globalAlpha = 1; ctx.lineWidth = 5; ctx.strokeStyle = CUE_RGB.safe[1]; safePath(ctx, t, false); ctx.stroke();
    // countdown ring on the rim
    ctx.beginPath(); ctx.arc(RAID_POS.x, RAID_POS.y, RAID_R - 6, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 8; ctx.stroke();
    const me = local && inSafe(t, local.x, local.y);
    if (local && !local.dead && Math.hypot(local.x - RAID_POS.x, local.y - RAID_POS.y) < RAID_R + 40) { ctx.font = "18px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(me ? 'SAFE' : 'MOVE!', local.x, local.y - 54); ctx.fillStyle = me ? '#4dff88' : '#ff5e5b'; ctx.fillText(me ? 'SAFE' : 'MOVE!', local.x, local.y - 54); }
    ctx.restore(); return;
  }
  if (t.k === 'lane') { // Starfall lanes: red columns with arrows, green gaps
    ctx.globalAlpha = c === 'safe' ? 0.28 + 0.18 * pulse : 0.14 + 0.2 * k; ctx.fillStyle = fillCol(c, 1); shapePath(ctx, t); ctx.fill();
    ctx.globalAlpha = c === 'safe' ? 0.9 : 0.5; ctx.strokeStyle = edgeCol(c); ctx.lineWidth = c === 'safe' ? 4 : 2; ctx.stroke();
    if (c !== 'safe') { ctx.globalAlpha = 0.6; ctx.translate(t.x, t.y); ctx.rotate(t.ang); ctx.strokeStyle = '#ff9a8a'; ctx.lineWidth = 3; for (let i = -3; i <= 3; i++) { const x = i * 120 + ((time * 160) % 120); ctx.beginPath(); ctx.moveTo(x - 12, -10); ctx.lineTo(x, 0); ctx.lineTo(x - 12, 10); ctx.stroke(); } }
    ctx.restore(); return;
  }
  if (t.k === 'lance') { // Rift Lance: magenta line (dashed while tracking, solid + bright once locked)
    ctx.globalAlpha = t.lock ? 0.35 + 0.3 * pulse : 0.18; ctx.fillStyle = fillCol('charge', 1); shapePath(ctx, t); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = CUE_RGB.away[1]; ctx.lineWidth = t.lock ? 5 : 3; if (!t.lock) { ctx.setLineDash([16, 12]); ctx.lineDashOffset = -time * 60; } ctx.stroke(); ctx.setLineDash([]);
    ctx.translate(t.x, t.y); ctx.rotate(t.ang); ctx.fillStyle = '#ffc8f4'; for (let i = -3; i <= 3; i++) { const x = i * 110 + ((time * 240) % 110); ctx.beginPath(); ctx.moveTo(x + 16, 0); ctx.lineTo(x - 6, -16); ctx.lineTo(x - 6, 16); ctx.closePath(); ctx.globalAlpha = 0.7; ctx.fill(); }
    ctx.restore(); return;
  }
  // circles / cones / donuts: filling-in telegraph (outline + growing inner fill = time left)
  ctx.globalAlpha = 0.16 + 0.12 * pulse; ctx.fillStyle = fillCol(c, 1); shapePath(ctx, t); ctx.fill();
  ctx.globalAlpha = 0.95; ctx.strokeStyle = edgeCol(c); ctx.lineWidth = 4; ctx.stroke();
  ctx.globalAlpha = 0.4; ctx.fillStyle = fillCol(c, 1); shapePath(ctx, t, k); ctx.fill();
  ctx.restore();
}
function shapePath(ctx, t, k = 1) {
  ctx.beginPath();
  if (t.sh === 'circle') ctx.arc(t.x, t.y, Math.max(1, t.r * k), 0, TAU);
  else if (t.sh === 'donut') { ctx.arc(t.x, t.y, t.r2, 0, TAU); ctx.arc(t.x, t.y, t.r2 - (t.r2 - t.r) * k, 0, TAU, true); }
  else if (t.sh === 'cone') { ctx.moveTo(t.x, t.y); ctx.arc(t.x, t.y, Math.max(1, t.len * k), t.ang - t.arc / 2, t.ang + t.arc / 2); ctx.closePath(); }
  else if (t.sh === 'rect') { ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.ang); ctx.rect(-t.len / 2, -t.w / 2, t.len * (k < 1 ? k : 1), t.w); ctx.restore(); }
}
/** Path of the safe zones (green) — or, with `danger`, the arena with the safe zones cut out. */
function safePath(ctx, t, danger) {
  const cx = RAID_POS.x, cy = RAID_POS.y, R = RAID_R;
  const disc = () => { ctx.moveTo(cx + R, cy); ctx.arc(cx, cy, R, 0, TAU); };
  ctx.beginPath();
  if (danger) disc(); // fill with 'evenodd': the arena minus the safe shapes
  if (t.z) for (const [x, y, r] of t.z) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
  if (t.q) for (const i of t.q) { const a0 = (t.rot || 0) + i * Math.PI / 2; ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a0 + Math.PI / 2); ctx.closePath(); }
  if (t.inR) { ctx.moveTo(cx + t.inR, cy); ctx.arc(cx, cy, t.inR, 0, TAU); }
  if (t.outR) { disc(); ctx.moveTo(cx + t.outR, cy); ctx.arc(cx, cy, t.outR, 0, TAU); }
}
function posOf(m, sim) { if (m.pid) { const p = sim.players.get(m.pid); if (p && !p.dead) return p; } return m.x != null ? m : null; }
function drawMark(ctx, m, sim, time, local) {
  const p = posOf(m, sim); if (!p) return;
  const k = Math.max(0, Math.min(1, m.t / Math.max(1, m.d)));
  ctx.save();
  if (m.k === 'spread') { // purple circle (the radius that will hit allies) with a filling timer
    ctx.globalAlpha = 0.14 + 0.1 * Math.sin(time * 10); circle(ctx, p.x, p.y, m.r, '#c05cff', 0);
    ctx.globalAlpha = 0.9; ctx.lineWidth = 4; ctx.strokeStyle = '#d98cff'; ctx.setLineDash(m.echo ? [10, 8] : []); ctx.beginPath(); ctx.arc(p.x, p.y, m.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.35; circle(ctx, p.x, p.y, m.r * k, '#c05cff', 0);
    ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, m.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    if (!m.echo) { // the brand icon over the head
      ctx.translate(p.x, p.y - 64); ctx.rotate(time * 2); ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = i * TAU / 5 * 2 - Math.PI / 2; const x = Math.cos(a) * 13, y = Math.sin(a) * 13; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fillStyle = '#c05cff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    } else { ctx.font = "13px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText('ECHO', p.x, p.y + 5); ctx.fillStyle = '#e6c2ff'; ctx.fillText('ECHO', p.x, p.y + 5); }
  } else if (m.k === 'stack') { // yellow ring with inward arrows (group up)
    ctx.globalAlpha = 0.18 + 0.12 * Math.sin(time * 8); circle(ctx, p.x, p.y, m.r, '#ffd84a', 0);
    ctx.globalAlpha = 1; ctx.lineWidth = 5; ctx.strokeStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(p.x, p.y, m.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, m.r + 7, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + time * 0.6, d = m.r + 26 - ((time * 40) % 22); ctx.save(); ctx.translate(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d); ctx.rotate(a + Math.PI); ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -10); ctx.lineTo(-6, 10); ctx.closePath(); ctx.fillStyle = '#ffd84a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); }
    const n = [...sim.players.values()].filter((q) => !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < m.r).length;
    ctx.font = "16px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; const s = m.need > 1 ? `STACK ${n}/${m.need}` : 'SOAK';
    ctx.strokeText(s, p.x, p.y - m.r - 14); ctx.fillStyle = '#ffd84a'; ctx.fillText(s, p.x, p.y - m.r - 14);
  }
  ctx.restore();
}
/** Tethers drawn over the characters (cyan chain, turns white-hot as it runs out; distance to break shown). */
export function drawRaidOver(ctx, sim, local, time) {
  const R = sim.raid;
  if (!R) return;
  for (const th of R.teth || []) {
    const A = sim.players.get(th.a), B = th.b ? sim.players.get(th.b) : { x: th.ax, y: th.ay };
    if (!A || !B) continue;
    const k = Math.min(1, th.t / Math.max(1, th.d)), d = Math.hypot(A.x - B.x, A.y - B.y), near = d / th.min;
    ctx.save(); ctx.lineCap = 'round';
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#5ff2ff'; ctx.lineWidth = 12 + 6 * k; ctx.beginPath(); ctx.moveTo(A.x, A.y - 10); ctx.lineTo(B.x, B.y - 10); ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = k > 0.7 ? '#ffffff' : '#bff9ff'; ctx.lineWidth = 4; ctx.setLineDash([14, 8]); ctx.lineDashOffset = -time * 80; ctx.stroke(); ctx.setLineDash([]);
    if (!th.b) { // the anchor pylon
      ctx.fillStyle = '#1b1240'; ctx.beginPath(); ctx.moveTo(B.x, B.y - 50); ctx.lineTo(B.x + 14, B.y); ctx.lineTo(B.x - 14, B.y); ctx.closePath(); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#5ff2ff'; ctx.stroke();
    }
    if (A === local || B === local || th.a === local.id || th.b === local.id) {
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 - 24;
      ctx.font = "16px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; const s = `${Math.round(d)} / ${th.min}`;
      ctx.strokeText(s, mx, my); ctx.fillStyle = near >= 0.85 ? '#4dff88' : '#5ff2ff'; ctx.fillText(s, mx, my);
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ HUD
const fmt = (ticks) => { const s = Math.max(0, Math.ceil(ticks / 60)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
/** Boss bar with phase pips (+ ward bar, enrage timer, current mechanic). Returns the bottom y used. */
export function drawRaidBar(ctx, sim, p, w, y, sc, txt, bar) {
  const R = sim.raid;
  if (!R || !inRaidArea(p.x, p.y)) return 0;
  const b = sim.enemies.find((e) => e.id === R.bid) || sim.enemies.find((e) => e.raid || e.type === 'raidboss');
  const bbw = Math.min(680 * sc, w * (sc < 1 ? 0.8 : 0.56)), bbx = w / 2 - bbw / 2, H = Math.round(20 * sc);
  txt(ctx, RAID.name, w / 2, y - 4 * sc, Math.round(22 * sc), '#8ff3ff', 'center');
  const k = b ? Math.max(0, b.hp / b.maxHp) : 0;
  bar(ctx, bbx, y + 10 * sc, bbw, H, k, R.phase === 3 ? '#ff4d6a' : R.phase === 2 ? '#c05cff' : '#5f8cff', b && sc >= 1 ? `${Math.ceil(b.hp)} / ${b.maxHp}` : null);
  for (const t of RAID.ward.at) { ctx.fillStyle = INK; ctx.fillRect(bbx + bbw * t - 2, y + 8 * sc, 4, H + 4); }
  // phase pips
  for (let i = 1; i <= 3; i++) {
    const px = bbx - 20 * sc - (3 - i) * 22 * sc, py = y + 10 * sc + H / 2, on = i <= R.phase;
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI / 4); ctx.fillStyle = on ? (i === 3 ? '#ff4d6a' : i === 2 ? '#c05cff' : '#5f8cff') : 'rgba(255,255,255,.15)'; ctx.fillRect(-7 * sc, -7 * sc, 14 * sc, 14 * sc); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeRect(-7 * sc, -7 * sc, 14 * sc, 14 * sc); ctx.restore();
  }
  // enrage timer + phase label (right)
  const enr = R.st === 'pull' ? R.pull : R.enr;
  txt(ctx, R.enraged ? 'ENRAGED' : R.st === 'pull' ? `PULL ${Math.ceil(enr / 60)}` : `⏱ ${fmt(enr)}`, bbx + bbw + 10 * sc, y + 10 * sc + H / 2, Math.round(16 * sc), R.enraged ? '#ff3b3b' : enr < 1800 && R.st !== 'pull' ? '#ffb52e' : '#fff', 'left', 3);
  let yy = y + 10 * sc + H + 8 * sc;
  const mid = R.mech && (typeof R.mech === 'string' ? R.mech : R.mech.id);
  txt(ctx, `PHASE ${R.phase} / 3${mid ? ' · ' + (MECH_LABEL[mid] || mid) : ''}`, w / 2, yy + 6 * sc, Math.round(13 * sc), '#d9c6ff', 'center', 3);
  yy += 16 * sc;
  if (R.ward) { // the interrupt check
    const wk = R.ward.hp / Math.max(1, R.ward.max), tk = 1 - R.ward.t / Math.max(1, R.ward.d);
    bar(ctx, bbx + bbw * 0.15, yy, bbw * 0.7, Math.round(14 * sc), wk, '#8ff3ff', sc >= 1 ? `RIFT WARD ${Math.ceil(R.ward.hp)}` : null);
    rrect(ctx, bbx + bbw * 0.15, yy + 18 * sc, bbw * 0.7 * tk, 5 * sc, 2); ctx.fillStyle = '#ff5e5b'; ctx.fill();
    yy += 28 * sc;
  }
  if (R.stun > 0) { txt(ctx, `STUNNED ${Math.ceil(R.stun / 60)}s · +50% DAMAGE`, w / 2, yy + 6 * sc, Math.round(15 * sc), '#ffe27a', 'center', 3); yy += 18 * sc; }
  return yy;
}
const MECH_LABEL = { cleave: 'Riftcleave', lanes: 'Starfall Lanes', spread: 'Rift Brand', stack: 'Convergence', lance: 'Rift Lance', eclipse: 'Eclipse', tether: 'Soul Chain', stackspread: 'Brand + Convergence', eclipselanes: 'Eclipse + Starfall', tetherlance: 'Chain + Lance', spiral: 'Void Spiral' };
/** The big centre callout ("SPREAD OUT!", "STACK!", "BREAK THE TETHER!", "BREAK THE WARD!"). */
export function drawRaidCallout(ctx, sim, p, w, h, sc, txt) {
  const R = sim.raid, c = R && R.call;
  if (!c || !inRaidArea(p.x, p.y)) return;
  const age = (c.d - c.t) / 60, pop = Math.max(0, 1 - age * 4), fade = Math.min(1, c.t / 20);
  ctx.save(); ctx.globalAlpha = fade;
  const y = h * (sc < 1 ? 0.3 : 0.27), s = 1 + pop * 0.35;
  ctx.translate(w / 2, y); ctx.scale(s, s);
  txt(ctx, c.txt, 0, 0, Math.round(44 * sc), c.col, 'center', Math.round(9 * sc));
  if (c.sub) txt(ctx, c.sub, 0, 36 * sc, Math.round(17 * sc), '#ffffff', 'center', 4);
  ctx.restore();
}
/** Minimap inside the raid: the arena disc, the boss and the party. */
export function drawRaidMinimap(ctx, x, y, R, sim, p, classes) {
  const k = (R - 6) / RAID_R;
  circle(ctx, x, y, R + 5, INK, 0); circle(ctx, x, y, R, '#1b1240', 0); circle(ctx, x, y, R - 6, '#2c2356', 2, '#5ff2ff');
  const rd = sim.raid;
  if (rd) { const b = sim.enemies.find((e) => e.id === rd.bid); if (b) circle(ctx, x + (b.x - RAID_POS.x) * k, y + (b.y - RAID_POS.y) * k, 6, '#c05cff', 2); }
  for (const q of sim.players.values()) if (!q.dead && inRaidArea(q.x, q.y)) circle(ctx, x + (q.x - RAID_POS.x) * k, y + (q.y - RAID_POS.y) * k, q.id === p.id ? 4.5 : 3.5, q.id === p.id ? '#ffffff' : (classes[q.cls] ? classes[q.cls].color : '#fff'), 1.5);
}
export { PHASES, RAID_COL };

/** Particle / shake / flash reactions to 'raid' sim events (called from fx.js). */
export function raidEventFx(fx, ev, me) {
  switch (ev.ph) {
    case 'portal': fx.banner('A RIFT HAS OPENED', '#5ff2ff', 'Step into it to face Vorthax', 3, 48); fx.ring(ev.x, ev.y, 160, '#5ff2ff', 0.8, 10); break;
    case 'enter': fx.ring(ev.x, ev.y, 90, '#5ff2ff', 0.5, 8); fx.puffs(ev.x, ev.y, 14, '#c05cff', 14, 140, 0.6); if (me) { fx.flash = Math.max(fx.flash || 0, 0.5); fx.flashColor = '#5ff2ff'; } break;
    case 'leave': fx.puffs(ev.x, ev.y, 10, '#5ff2ff', 12, 110, 0.5); break;
    case 'pull': fx.banner('VORTHAX AWAKENS', '#8ff3ff', 'The Rift Sanctum', 2.4, 58); break;
    case 'start': fx.shake(0.6); fx.ring(ev.x, ev.y - 110, 260, '#c05cff', 0.7, 14); break;
    case 'boom': {
      const col = ev.col === 'spread' ? '#c05cff' : ev.col === 'stack' ? '#ffd84a' : ev.col === 'safe' ? '#ff3b3b' : ev.col === 'charge' ? '#ff4fd8' : '#ff6a5a';
      if (ev.sh === 'circle' || ev.sh === 'donut') { fx.ring(ev.x, ev.y, (ev.r2 || ev.r || 100) * 1.1, col, 0.4, 10); fx.sparks(ev.x, ev.y, 0, 12, col, 360, Math.PI); }
      else if (ev.sh === 'cone') { fx.add({ type: 'slash', x: ev.x, y: ev.y, ang: ev.ang, arc: ev.arc, r: ev.len, life: 0.25, color: col, width: 26, dir: 1 }); }
      else if (ev.sh === 'safe') { fx.flash = Math.max(fx.flash || 0, 0.35); fx.flashColor = '#ff2a4a'; }
      fx.shake(ev.sh === 'safe' ? 0.5 : 0.22);
      break;
    }
    case 'hit': if (me) fx.text(ev.x, ev.y - 70, ev.what.toUpperCase(), { size: 18, color: '#ff8a7a', vy: -30, pop: 1.3, life: 1 }); break;
    case 'mend': fx.text(ev.x, ev.y - 64, 'CLEAN! RIFT MEND', { size: me ? 18 : 14, color: '#7dffb0', vy: -40, pop: 1.3, life: 1 }); fx.ring(ev.x, ev.y + 10, 50, '#7dffb0', 0.4, 5); break;
    case 'lanes': fx.shake(0.15); break;
    case 'lock': fx.ring(ev.x, ev.y, 90, '#ff4fd8', 0.3, 8); break;
    case 'lance': fx.shake(0.4); fx.add({ type: 'trail', x: ev.x, y: ev.y, x2: ev.x + Math.cos(ev.ang) * 900, y2: ev.y + Math.sin(ev.ang) * 900, life: 0.35, color: '#ff4fd8' }); break;
    case 'slam': fx.shake(0.7); fx.ring(ev.x, ev.y, 220, '#ff4fd8', 0.5, 14); fx.sparks(ev.x, ev.y, 0, 24, '#ffc8f4', 520, Math.PI); break;
    case 'snap': fx.sparks(ev.x, ev.y, 0, 18, '#bff9ff', 420, Math.PI); fx.text(ev.x, ev.y - 20, 'CHAIN BROKEN', { size: 18, color: '#5ff2ff', vy: -40, pop: 1.4, life: 0.9 }); break;
    case 'ward': fx.ring(ev.x, ev.y, 140, '#8ff3ff', 0.8, 12); fx.shake(0.4); break;
    case 'wardBreak': fx.shake(0.9); fx.ring(ev.x, ev.y, 260, '#ffe27a', 0.7, 16); fx.sparks(ev.x, ev.y, 0, 40, '#8ff3ff', 620, Math.PI); fx.flash = Math.max(fx.flash || 0, 0.45); fx.flashColor = '#bff9ff'; break;
    case 'collapse': fx.shake(1); fx.ring(ev.x, ev.y, 480, '#ff3b3b', 0.8, 18); fx.flash = Math.max(fx.flash || 0, 0.6); fx.flashColor = '#ff2a4a'; break;
    case 'phase': fx.shake(0.8); fx.ring(ev.x, ev.y, 360, ev.phase === 3 ? '#ff6a5a' : '#c05cff', 0.9, 16); fx.flash = Math.max(fx.flash || 0, 0.5); fx.flashColor = ev.phase === 3 ? '#ff4d6a' : '#c05cff'; break;
    case 'enrage': fx.shake(1); fx.flash = Math.max(fx.flash || 0, 0.7); fx.flashColor = '#ff0000'; break;
    case 'victory': fx.banner('VORTHAX FALLS!', '#ffe27a', `Cleared in ${ev.t}s — the exit rift is open`, 4, 62, 'victory'); fx.shake(1); fx.ring(ev.x, ev.y, 400, '#ffe27a', 1, 18); break;
    default: break;
  }
}
/** Sounds for 'raid' events (called from audio.js): telegraph pings, detonations, the ward shatter, phase roars. */
export function raidSound(au, ev, me) {
  switch (ev.ph) {
    case 'call': au.tone('triangle', 660, 880, 0.12, 0.18); au.tone('triangle', 880, 1100, 0.12, 0.14, 0.1); break;
    case 'boom': au.tone('sine', 120, 40, 0.35, 0.45); au.hiss(1400, 200, 0.3, 0.3); break;
    case 'hit': if (me) { au.tone('square', 220, 90, 0.18, 0.14); } break;
    case 'mend': if (me) { au.tone('sine', 880, 1320, 0.2, 0.12); } break;
    case 'lock': au.tone('sawtooth', 300, 900, 0.25, 0.12); break;
    case 'lance': case 'slam': au.tone('sine', 90, 30, 0.5, 0.55); au.hiss(900, 120, 0.45, 0.4); break;
    case 'snap': au.tone('triangle', 1400, 2200, 0.12, 0.16); au.hiss(6000, 3000, 0.1, 0.18); break;
    case 'ward': au.tone('sine', 300, 600, 0.6, 0.2); break;
    case 'wardBreak': au.hiss(7000, 1500, 0.6, 0.4); au.tone('triangle', 1800, 400, 0.5, 0.2); break;
    case 'collapse': case 'enrage': au.tone('sawtooth', 110, 30, 1, 0.35); au.hiss(600, 60, 0.9, 0.45); break;
    case 'phase': case 'pull': case 'start': au.tone('sawtooth', 70, 140, 0.8, 0.3); au.tone('sine', 55, 40, 1, 0.4); break;
    case 'portal': case 'enter': case 'leave': au.tone('sine', 400, 1200, 0.4, 0.2); au.tone('sine', 600, 1800, 0.4, 0.12, 0.08); break;
    case 'victory': [523, 659, 784, 1046].forEach((f, i) => au.tone('triangle', f, f, 0.3, 0.2, i * 0.12)); break;
    default: return false;
  }
  return true;
}

/** Pause-menu "Enter the Rift" / "Leave the Rift" button (desktop solo + co-op, mobile). Call when the menu opens. */
export function syncRaidButton(game) { // (old pause-menu button: replaced by the town's Mission Counter)
  const btn = typeof document !== 'undefined' && document.getElementById('raidBtn');
  if (btn) btn.classList.add('hidden');
  void game;
}
