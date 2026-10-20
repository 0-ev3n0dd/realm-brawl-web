// Part F3: the Ultimate's prestige looks (sim/ultreward.js): Unwritten Pages (aura, ground), Quillfire (weapon glow) and
// the Unwritten Regalia (mantle + quill crown). Classic code-drawn outline style with a light bloom; cheap (a few arcs and
// paths), lighter still with fx.lite. Drawn by client/render.js for any hero with the clear (local or remote).
const TAU = Math.PI * 2, INKC = 'rgba(43,36,51,.8)';
export function drawUltAura(ctx, x, y, t, lite = false) {
  ctx.save(); ctx.translate(x, y + 12); ctx.scale(1, 0.42);
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(43,36,51,.5)'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2.6; ctx.strokeStyle = '#f2cf72'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.stroke();
  ctx.setLineDash([3, 7]); ctx.lineDashOffset = t * 14; ctx.lineWidth = 1.4; ctx.strokeStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  const n = lite ? 3 : 5;
  for (let i = 0; i < n; i++) {
    const a = t * 0.8 + (i * TAU) / n, px = x + Math.cos(a) * 34, py = y + 12 + Math.sin(a) * 14 - 6 - Math.sin(t * 2 + i) * 3;
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.sin(t * 1.7 + i) * 0.5);
    ctx.fillStyle = '#fbf3dc'; ctx.strokeStyle = INKC; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.rect(-4, -5, 8, 10); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,160,80,.7)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(2, -2); ctx.moveTo(-2, 1); ctx.lineTo(2, 1); ctx.stroke();
    ctx.restore();
  }
}
export function drawUltRegalia(ctx, x, y, ang, t, lite = false) {
  // the quill crown: three gold quills over the head, slowly turning
  ctx.save(); ctx.translate(x, y - 40 + Math.sin(t * 2) * 2);
  if (!lite) { const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 20); g.addColorStop(0, 'rgba(255,226,140,.45)'); g.addColorStop(1, 'rgba(255,226,140,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill(); }
  for (let i = -1; i <= 1; i++) {
    ctx.save(); ctx.rotate(i * 0.42 + Math.sin(t * 1.3) * 0.06);
    ctx.fillStyle = i ? '#f2cf72' : '#fff1b8'; ctx.strokeStyle = INKC; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.quadraticCurveTo(5, -6, 0, -15); ctx.quadraticCurveTo(-5, -6, 0, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,80,30,.8)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(0, -13); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  // the mantle: ink shoulders with a gold hem, behind-facing flare opposite the aim
  ctx.save(); ctx.translate(x, y + 2); ctx.rotate(ang + Math.PI);
  ctx.globalAlpha = 0.85; ctx.fillStyle = '#2a1f46'; ctx.strokeStyle = '#f2cf72'; ctx.lineWidth = 2;
  const fl = 4 + Math.sin(t * 3) * 2;
  ctx.beginPath(); ctx.moveTo(-6, -13); ctx.quadraticCurveTo(20 + fl, -16, 24 + fl, 0); ctx.quadraticCurveTo(20 + fl, 16, -6, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
export function drawQuillfire(ctx, x, y, ang, t, lite = false) {
  const hx = x + Math.cos(ang) * 20, hy = y - 4 + Math.sin(ang) * 20;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < (lite ? 2 : 4); i++) {
    const u = (t * 1.6 + i * 0.25) % 1, r = 7 * (1 - u) + 2;
    ctx.globalAlpha = 0.55 * (1 - u); ctx.fillStyle = i % 2 ? '#ffe28a' : '#fff6d6';
    ctx.beginPath(); ctx.arc(hx + Math.sin(t * 5 + i) * 2, hy - u * 16, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
