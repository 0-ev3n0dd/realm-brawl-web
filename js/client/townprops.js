// Brightwater Village, 2026-10-09 layout: the new landmark + street-furniture props (classic art: ink outlines, flat
// fills with a light wash, small live accents). Pure drawing from sim/townconst.js geometry; townfx.js dispatches here.
import { INK, circle, shadow, rrect, shade } from './art.js';
import { sprite, blit } from './sprite.js';

const TAU = Math.PI * 2;
const R0 = (a, b) => ((Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1 + 1) % 1;

/** the Weekly Board: a roofed notice board with the week's featured mission pinned in gold */
export function weeklyBoard(ctx, o, t, hot) {
  const x = o.x, y = o.y;
  shadow(ctx, x + 6, y + 10, 56, 10, 0.25);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * 40, y + 8); ctx.lineTo(x + s * 40, y - 70); ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 5; ctx.stroke(); }
  rrect(ctx, x - 50, y - 70, 100, 58, 6); ctx.fillStyle = '#b07a45'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  rrect(ctx, x - 44, y - 64, 88, 46, 4); ctx.fillStyle = '#8a5a35'; ctx.fill();
  const cols = ['#fff4d6', '#e0f0ff', '#ffd0d0', '#e8ffd6'];
  for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(x - 38 + i * 13 + (i > 1 ? 30 : 0), y - 60 + (i % 2) * 8); ctx.rotate((i - 1.5) * 0.08); ctx.fillStyle = cols[i]; ctx.fillRect(0, 0, 12, 16); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(0, 0, 12, 16); circle(ctx, 6, 2, 1.6, '#e84c3d', 0); ctx.restore(); }
  // the featured poster (gold, gently glowing)
  ctx.save(); ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 10 + 6 * Math.sin(t * 3); rrect(ctx, x - 11, y - 62, 22, 30, 3); ctx.fillStyle = '#ffe9a0'; ctx.fill(); ctx.restore();
  rrect(ctx, x - 11, y - 62, 22, 30, 3); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.font = "15px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#b8860b'; ctx.fillText('★', x, y - 47);
  // little gabled roof + header
  ctx.beginPath(); ctx.moveTo(x - 60, y - 68); ctx.lineTo(x, y - 94); ctx.lineTo(x + 60, y - 68); ctx.closePath(); ctx.fillStyle = '#3a8ee8'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  rrect(ctx, x - 36, y - 86, 72, 16, 5); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
  ctx.font = "12px 'Lilita One', sans-serif"; ctx.fillStyle = INK; ctx.fillText('WEEKLY', x, y - 77.5);
  if (hot) for (let i = 0; i < 4; i++) { const k = (t * 0.7 + i / 4) % 1; circle(ctx, x - 30 + i * 20, y - 96 - k * 26, 2.2 * (1 - k) + 0.5, '#fff4c0', 0); }
}
export function barrel(ctx, o) {
  shadow(ctx, o.x + 3, o.y + 4, 15, 6, 0.22);
  rrect(ctx, o.x - 13, o.y - 30, 26, 32, 8); ctx.fillStyle = '#a8733f'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.strokeStyle = '#5a5f6b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(o.x - 13, o.y - 22); ctx.lineTo(o.x + 13, o.y - 22); ctx.moveTo(o.x - 13, o.y - 6); ctx.lineTo(o.x + 13, o.y - 6); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(o.x, o.y - 30, 12, 4, 0, 0, TAU); ctx.fillStyle = '#c08a4f'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
}
export function bench(ctx, o) {
  const x = o.x - o.w / 2, y = o.y;
  shadow(ctx, o.x + 4, y + 6, o.w * 0.55, 6, 0.2);
  for (const lx of [x + 6, x + o.w - 10]) { ctx.fillStyle = '#6b4a2a'; ctx.fillRect(lx, y - 12, 4, 14); }
  rrect(ctx, x, y - 16, o.w, 8, 3); ctx.fillStyle = '#b98248'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  rrect(ctx, x + 2, y - 30, o.w - 4, 7, 3); ctx.fillStyle = '#a8733f'; ctx.fill(); ctx.stroke();
  for (const lx of [x + 6, x + o.w - 10]) { ctx.beginPath(); ctx.moveTo(lx + 2, y - 23); ctx.lineTo(lx + 2, y - 16); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); }
}
export function rack(ctx, o, t) {
  const x = o.x - o.w / 2, y = o.y;
  shadow(ctx, o.x + 4, y + 6, o.w * 0.55, 7, 0.22);
  for (const lx of [x + 3, x + o.w - 3]) { ctx.beginPath(); ctx.moveTo(lx, y + 4); ctx.lineTo(lx, y - 46); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 3.5; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(x + o.w, y - 40); ctx.moveTo(x, y - 10); ctx.lineTo(x + o.w, y - 10); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#a8733f'; ctx.lineWidth = 3; ctx.stroke();
  const W = [['#cfd6e0', 0], ['#e0c070', 1], ['#cfd6e0', 2], ['#b0b8c4', 0]];
  W.forEach(([c, k], i) => {
    const wx = x + 12 + i * 13, top = y - 60 + (k === 1 ? -6 : 0);
    ctx.beginPath(); ctx.moveTo(wx, y - 4); ctx.lineTo(wx, top); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = k === 1 ? '#8a5a35' : c; ctx.lineWidth = 2.5; ctx.stroke();
    if (k === 1) { ctx.beginPath(); ctx.moveTo(wx - 5, top + 6); ctx.lineTo(wx, top - 6); ctx.lineTo(wx + 5, top + 6); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
    else if (k === 2) { ctx.beginPath(); ctx.arc(wx, top + 6, 7, Math.PI * 0.6, Math.PI * 1.9); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
    else { ctx.fillStyle = '#7a4a2a'; ctx.fillRect(wx - 5, top + 14, 10, 3); }
  });
  ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2.4); circle(ctx, x + 12, y - 58, 1.8, '#fff', 0); ctx.restore();
}
/** a training-ring fence post (the ropes are drawn on the ground pass) */
export function fpost(ctx, o) {
  shadow(ctx, o.x + 2, o.y + 3, 8, 3, 0.2);
  rrect(ctx, o.x - 5, o.y - 26, 10, 28, 3); ctx.fillStyle = '#8a5a35'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
  circle(ctx, o.x, o.y - 26, 5, '#a8733f', 2);
}
/** the hero statue on the west side of the plaza: a stone knight raising a sword, on a plinth with a plaque */
function statueStatic(g) {
  // plinth
  rrect(g, -30, -36, 60, 40, 5); const pg = g.createLinearGradient(-30, 0, 30, 0); pg.addColorStop(0, '#d8d4cc'); pg.addColorStop(1, '#9d978c'); g.fillStyle = pg; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
  rrect(g, -36, -42, 72, 10, 4); g.fillStyle = '#c4beb2'; g.fill(); g.stroke();
  rrect(g, -16, -24, 32, 14, 3); g.fillStyle = '#c9a45a'; g.fill(); g.lineWidth = 2; g.stroke();
  // figure (stone)
  const st = '#b9b4ab', dk = '#8f897f';
  g.lineJoin = 'round';
  g.beginPath(); g.moveTo(-14, -42); g.lineTo(-10, -84); g.lineTo(10, -84); g.lineTo(14, -42); g.closePath(); g.fillStyle = st; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); // legs / tabard
  g.beginPath(); g.moveTo(-18, -82); g.lineTo(-16, -112); g.lineTo(16, -112); g.lineTo(18, -82); g.closePath(); g.fillStyle = st; g.fill(); g.stroke(); // torso
  g.beginPath(); g.moveTo(-18, -110); g.quadraticCurveTo(-30, -96, -22, -70); g.lineTo(-14, -80); g.closePath(); g.fillStyle = dk; g.fill(); g.stroke(); // cape
  circle(g, 0, -122, 11, st, 3); g.fillStyle = dk; g.fillRect(-8, -126, 16, 4); // helm
  // raised sword arm
  g.beginPath(); g.moveTo(14, -108); g.lineTo(26, -136); g.strokeStyle = INK; g.lineWidth = 9; g.stroke(); g.strokeStyle = st; g.lineWidth = 5; g.stroke();
  g.beginPath(); g.moveTo(27, -138); g.lineTo(36, -186); g.strokeStyle = INK; g.lineWidth = 7; g.stroke(); g.strokeStyle = '#dcd8d0'; g.lineWidth = 3.5; g.stroke();
  g.beginPath(); g.moveTo(19, -136); g.lineTo(35, -140); g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
  // shield arm
  g.beginPath(); g.moveTo(-24, -104); g.quadraticCurveTo(-34, -96, -24, -80); g.quadraticCurveTo(-14, -92, -24, -104); g.fillStyle = dk; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
  // moss + light
  g.fillStyle = 'rgba(110,160,80,.55)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-26 + i * 10, -4 - (i % 2) * 3, 4, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-12, -110); g.lineTo(-10, -86); g.stroke();
}
export function statue(ctx, o, t) {
  shadow(ctx, o.x + 8, o.y + 4, 40, 12, 0.28);
  blit(ctx, sprite('town-statue', 110, 250, 55, 222, (g) => statueStatic(g)), o.x, o.y);
  // the gleam running up the blade
  const k = (t * 0.35) % 1; if (k < 0.3) { ctx.save(); ctx.globalAlpha = 1 - k / 0.3; circle(ctx, o.x + 27 + 9 * (k / 0.3), o.y - 138 - 48 * (k / 0.3), 3, '#fff', 0); ctx.restore(); }
}
/** the windmill on its hill: a tapered stone tower with a cap and four turning sails */
function millStatic(g) {
  g.lineJoin = 'round';
  g.beginPath(); g.moveTo(-50, 0); g.lineTo(-34, -170); g.lineTo(34, -170); g.lineTo(50, 0); g.closePath();
  const tg = g.createLinearGradient(-50, 0, 50, 0); tg.addColorStop(0, '#f2ead8'); tg.addColorStop(0.6, '#d9ccb0'); tg.addColorStop(1, '#b3a386'); g.fillStyle = tg; g.fill();
  g.save(); g.clip(); g.strokeStyle = 'rgba(80,60,40,.25)'; g.lineWidth = 1.5;
  for (let y = -10, r = 0; y > -170; y -= 16, r++) { g.beginPath(); g.moveTo(-60, y); g.lineTo(60, y); g.stroke(); for (let x = -60 + (r % 2) * 14; x < 60; x += 28) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 16); g.stroke(); } }
  g.restore();
  g.beginPath(); g.moveTo(-50, 0); g.lineTo(-34, -170); g.lineTo(34, -170); g.lineTo(50, 0); g.closePath(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
  rrect(g, -14, -44, 28, 44, 12); g.fillStyle = '#7d4f2e'; g.fill(); g.lineWidth = 3; g.stroke();
  for (const [wx, wy] of [[-12, -110], [10, -78]]) { rrect(g, wx - 7, wy - 9, 14, 18, 6); g.fillStyle = '#2e2a3a'; g.fill(); g.lineWidth = 2.5; g.stroke(); }
  // cap
  g.beginPath(); g.moveTo(-42, -166); g.quadraticCurveTo(0, -226, 42, -166); g.closePath(); g.fillStyle = '#d9483b'; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
  g.strokeStyle = shade('#d9483b', -0.25); g.lineWidth = 2; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 14, -168); g.lineTo(i * 6, -198); g.stroke(); }
}
export function windmill(ctx, o, t) {
  shadow(ctx, o.x + 16, o.y + 6, 70, 18, 0.28);
  blit(ctx, sprite('town-mill', 140, 260, 70, 240, (g) => millStatic(g)), o.x, o.y);
  // the sails (live): four lattice blades on a hub
  const hx = o.x, hy = o.y - 176, a0 = t * 0.6;
  ctx.save(); ctx.translate(hx, hy);
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.rotate(a0 + i * Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -120); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = '#8a5a35'; ctx.lineWidth = 3.5; ctx.stroke();
    rrect(ctx, 2, -118, 24, 92, 3); ctx.fillStyle = 'rgba(255,248,230,.92)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = 'rgba(138,90,53,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let k = 1; k < 6; k++) { ctx.moveTo(2, -118 + k * 15.3); ctx.lineTo(26, -118 + k * 15.3); } ctx.moveTo(14, -118); ctx.lineTo(14, -26); ctx.stroke();
    ctx.restore();
  }
  circle(ctx, 0, 0, 9, '#6b4a2a', 3); circle(ctx, 0, 0, 3, '#ffd23f', 0);
  ctx.restore();
}
/** the great oak of Elder's Garden: trunk + roots here (y-sorted); the canopy is drawn over everything (oakCanopy) */
export function oakTrunk(ctx, o) {
  shadow(ctx, o.x + 10, o.y + 6, 120, 40, 0.22);
  ctx.save(); ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(o.x - 34, o.y + 4); ctx.quadraticCurveTo(o.x - 20, o.y - 40, o.x - 22, o.y - 120); ctx.lineTo(o.x + 22, o.y - 120); ctx.quadraticCurveTo(o.x + 18, o.y - 40, o.x + 36, o.y + 4); ctx.quadraticCurveTo(o.x, o.y - 8, o.x - 34, o.y + 4); ctx.closePath();
  const g = ctx.createLinearGradient(o.x - 34, 0, o.x + 36, 0); g.addColorStop(0, '#8a5a35'); g.addColorStop(1, '#5a3a22'); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.strokeStyle = 'rgba(40,20,10,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o.x - 8, o.y - 10); ctx.quadraticCurveTo(o.x - 12, o.y - 60, o.x - 4, o.y - 110); ctx.moveTo(o.x + 10, o.y - 20); ctx.quadraticCurveTo(o.x + 6, o.y - 70, o.x + 12, o.y - 112); ctx.stroke();
  for (const [dx, dy, r] of [[-40, 6, 10], [44, 8, 9], [-10, 10, 7]]) { ctx.beginPath(); ctx.ellipse(o.x + dx, o.y + dy, r * 1.8, r * 0.6, 0, 0, TAU); ctx.fillStyle = '#6e4428'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.restore();
}
export function oakCanopy(ctx, o, t, alpha = 1) {
  const S = o.size || 120;
  ctx.save(); ctx.globalAlpha = alpha;
  const blobs = [[0, -190, 1], [-70, -160, 0.75], [70, -162, 0.78], [-38, -228, 0.7], [44, -226, 0.68], [0, -140, 0.7]];
  for (const [dx, dy, k] of blobs) circle(ctx, o.x + dx + Math.sin(t * 0.8 + dx) * 2, o.y + dy, S * 0.55 * k, '#3f9a4a', 4);
  for (const [dx, dy, k] of blobs) circle(ctx, o.x + dx - 10 + Math.sin(t * 0.8 + dx) * 2, o.y + dy - 12, S * 0.38 * k, '#5cbf5a', 0);
  for (let i = 0; i < 9; i++) circle(ctx, o.x - 80 + R0(i, 3) * 160, o.y - 250 + R0(i, 7) * 120, 5, i % 3 ? '#ff8fb1' : '#fff4c0', 1.5); // blossoms
  ctx.restore();
  // drifting petals
  for (let i = 0; i < 5; i++) { const k = ((t * 0.18 + i * 0.21) % 1); circle(ctx, o.x - 90 + i * 45 + Math.sin(t + i) * 14, o.y - 200 + k * 220, 2.4, '#ffb3c8', 0); }
}
/** the lily pond (ground pass): stone rim, water, lily pads, shimmer, a koi */
export function pond(ctx, o, t) {
  circle(ctx, o.x, o.y, o.r + 10, '#a8adb5', 4);
  for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; circle(ctx, o.x + Math.cos(a) * (o.r + 6), o.y + Math.sin(a) * (o.r + 6), 6, i % 2 ? '#bfc4cc' : '#9aa1ab', 1.5); }
  const g = ctx.createRadialGradient(o.x - 20, o.y - 20, 5, o.x, o.y, o.r); g.addColorStop(0, '#7fd8f5'); g.addColorStop(1, '#2f8fbf'); circle(ctx, o.x, o.y, o.r, g, 3);
  ctx.save(); ctx.beginPath(); ctx.arc(o.x, o.y, o.r - 2, 0, TAU); ctx.clip();
  for (let i = 0; i < 3; i++) { const f = (((t * 0.35 + i / 3) % 1) + 1) % 1; ctx.beginPath(); ctx.ellipse(o.x - 10 + i * 12, o.y + 6 - i * 10, 10 + f * 40, (10 + f * 40) * 0.5, 0, 0, TAU); ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - f)})`; ctx.lineWidth = 2; ctx.stroke(); }
  const ka = t * 0.7; ctx.save(); ctx.translate(o.x + Math.cos(ka) * 36, o.y + Math.sin(ka) * 22); ctx.rotate(ka + Math.PI / 2); ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, 0, 0, TAU); ctx.fillStyle = '#ff8a3a'; ctx.fill(); ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-15, -4); ctx.lineTo(-15, 4); ctx.closePath(); ctx.fill(); circle(ctx, 3, -1, 2, '#fff', 0); ctx.restore();
  ctx.restore();
  for (const [dx, dy, r] of [[-30, -20, 11], [26, 18, 9], [12, -36, 8], [-18, 30, 10]]) { ctx.beginPath(); ctx.arc(o.x + dx, o.y + dy, r, 0.4, TAU - 0.1); ctx.lineTo(o.x + dx, o.y + dy); ctx.closePath(); ctx.fillStyle = '#5cbf5a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
  circle(ctx, o.x - 26, o.y - 24, 4, '#ff8fb1', 1.5);
}
/** the smithy's hanging sign (an anvil on a board), by its door */
export function forgeSign(ctx, o, t) {
  const sx = o.x + o.w / 2 - 18, sy = o.y - o.h / 2 + 6, sw = Math.sin(t * 1.6) * 0.06;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 40, sy); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.save(); ctx.translate(sx + 30, sy); ctx.rotate(sw);
  ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-8, 8); ctx.moveTo(8, 0); ctx.lineTo(8, 8); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  rrect(ctx, -18, 8, 36, 26, 4); ctx.fillStyle = '#e8c070'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-11, 16); ctx.lineTo(10, 16); ctx.quadraticCurveTo(14, 17, 12, 20); ctx.lineTo(5, 21); ctx.lineTo(4, 27); ctx.lineTo(-6, 27); ctx.lineTo(-7, 21); ctx.lineTo(-11, 19); ctx.closePath(); ctx.fillStyle = '#4a4f5c'; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}
