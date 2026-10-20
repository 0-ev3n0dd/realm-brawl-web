// Spawn sites + Swarm events, client side (spawns pass): the site landmarks baked into the ground tiles (ruins, camps,
// nests, dens, graves, obelisks, cairns, magma vents; classic style: flat fills + ink outlines), the fodder telegraph
// kinds (caster ward circle, fire pools, aim lines), the goblin spear, the ward bubble on shielded enemies, and the
// Swarm event: the marker + bonus chest in the world, the HUD callout / off-screen arrow, the minimap icon.
import { INK, circle } from './art.js';
import { packSwarm } from '../sim/sites.js';
const TAU = Math.PI * 2;
const PAL = {
  w: { st: '#bdb5a6', dk: '#8b8374', wd: '#9a6a3a', cl: '#c8503c', gr: 'rgba(70,58,40,.22)', ac: '#e8d9a8' },
  dunes: { st: '#e6c88e', dk: '#b8955a', wd: '#a87a44', cl: '#3a7bd5', gr: 'rgba(150,100,40,.20)', ac: '#ffd23f' },
  frost: { st: '#dcedf7', dk: '#9cc0d6', wd: '#7a5a40', cl: '#4a7ac8', gr: 'rgba(90,120,150,.20)', ac: '#bff4ff' },
  ember: { st: '#6a5852', dk: '#3e3232', wd: '#5a3a2a', cl: '#ff7a2c', gr: 'rgba(30,10,10,.30)', ac: '#ffb43c' },
  rift: { st: '#8a84b8', dk: '#4a3e7e', wd: '#5a4a8a', cl: '#b48cff', gr: 'rgba(20,10,50,.28)', ac: '#ffe27a' }, // (game loop C3)
};
const palOf = (key) => PAL[key && key[0] === 'w' ? 'w' : key] || PAL.w;
const rnd = (seed, i) => { const s = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return s - Math.floor(s); };

function stone(g, x, y, w, h, col, dk, jag = 0) { // a pillar stump: body + darker side + a broken top
  g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w / 2, y - h); g.lineTo(x - w / 6, y - h - jag); g.lineTo(x + w / 6, y - h + jag * 0.6); g.lineTo(x + w / 2, y - h - jag * 0.4); g.lineTo(x + w / 2, y); g.closePath();
  g.fillStyle = col; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  g.fillStyle = dk; g.fillRect(x + w / 6, y - h + 4, w / 3 - 2, h - 5);
  g.beginPath(); g.ellipse(x, y, w * 0.62, w * 0.2, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill();
}
function tent(g, x, y, s, cl, wd) {
  g.beginPath(); g.moveTo(x - s, y); g.lineTo(x, y - s * 1.1); g.lineTo(x + s, y); g.closePath(); g.fillStyle = cl; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.moveTo(x, y - s * 1.1); g.lineTo(x - s * 0.25, y); g.lineTo(x + s * 0.25, y); g.closePath(); g.fillStyle = INK; g.fill();
  g.beginPath(); g.moveTo(x, y - s * 1.1); g.lineTo(x - 6, y - s * 1.35); g.moveTo(x, y - s * 1.1); g.lineTo(x + 6, y - s * 1.35); g.strokeStyle = wd; g.lineWidth = 3; g.stroke();
}
function bones(g, x, y, a) {
  g.save(); g.translate(x, y); g.rotate(a); g.lineCap = 'round';
  g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(-9, 0); g.lineTo(9, 0); g.stroke();
  g.strokeStyle = '#f2ead6'; g.lineWidth = 3; g.stroke();
  for (const sx of [-9, 9]) { circle(g, sx, -2.5, 3, '#f2ead6', 1.6); circle(g, sx, 2.5, 3, '#f2ead6', 1.6); }
  g.restore();
}

/** a site landmark, baked into the ground tile cache (ground.js paintGround) */
export function drawLandmark(g, d) {
  const P = palOf(d.key), s = d.variant || 1, x = d.x, y = d.y;
  g.save();
  // trampled ground: the swarm's patch
  g.beginPath(); for (let i = 0; i <= 18; i++) { const a = (i / 18) * TAU, r = 120 + 26 * rnd(s, i); i ? g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.62) : g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.62); }
  g.closePath(); g.fillStyle = P.gr; g.fill();
  switch (d.lm) {
    case 'ruin': case 'obelisk': {
      g.beginPath(); g.ellipse(x, y + 6, 74, 40, 0, 0, TAU); g.fillStyle = P.dk; g.globalAlpha = 0.45; g.fill(); g.globalAlpha = 1; g.lineWidth = 2.5; g.strokeStyle = INK; g.setLineDash([10, 8]); g.stroke(); g.setLineDash([]);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + rnd(s, 40) , px = x + Math.cos(a) * 66, py = y + 6 + Math.sin(a) * 36; if (rnd(s, i) < 0.3) continue; stone(g, px, py, 18, 22 + 30 * rnd(s, i + 9), P.st, P.dk, 6 + 8 * rnd(s, i + 3)); }
      if (d.lm === 'obelisk') { stone(g, x, y, 26, 78, P.st, P.dk, 2); g.beginPath(); g.moveTo(x - 13, y - 78); g.lineTo(x, y - 96); g.lineTo(x + 13, y - 78); g.closePath(); g.fillStyle = P.ac; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); circle(g, x, y - 50, 5, P.ac, 2); }
      else { g.save(); g.translate(x + 10, y + 18); g.rotate(-0.35); g.fillStyle = P.st; g.fillRect(-36, -9, 72, 18); g.lineWidth = 3; g.strokeStyle = INK; g.strokeRect(-36, -9, 72, 18); g.fillStyle = P.dk; g.fillRect(-36, 3, 72, 6); g.beginPath(); g.moveTo(-12, -9); g.lineTo(-8, 9); g.moveTo(14, -9); g.lineTo(18, 9); g.lineWidth = 2; g.stroke(); g.restore(); }
      break;
    }
    case 'camp': {
      tent(g, x - 46, y - 8, 30, P.cl, P.wd); tent(g, x + 44, y - 18, 26, P.cl, P.wd);
      for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; circle(g, x + Math.cos(a) * 20, y + 22 + Math.sin(a) * 11, 5, P.st, 2); }
      circle(g, x, y + 22, 11, '#3a2a20', 0); g.beginPath(); g.moveTo(x - 9, y + 26); g.quadraticCurveTo(x - 6, y + 4, x, y - 2); g.quadraticCurveTo(x + 6, y + 6, x + 9, y + 26); g.closePath(); g.fillStyle = '#ff8a3c'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.moveTo(x - 4, y + 24); g.quadraticCurveTo(x - 2, y + 12, x + 1, y + 8); g.quadraticCurveTo(x + 4, y + 14, x + 4, y + 24); g.closePath(); g.fillStyle = '#ffd23f'; g.fill();
      for (let i = 0; i < 3; i++) { const sx = x + 70 + i * 9; g.beginPath(); g.moveTo(sx, y + 30); g.lineTo(sx + 4, y - 22); g.lineWidth = 5; g.strokeStyle = INK; g.stroke(); g.lineWidth = 2.5; g.strokeStyle = P.wd; g.stroke(); g.beginPath(); g.moveTo(sx + 4, y - 22); g.lineTo(sx + 1, y - 32); g.lineTo(sx + 8, y - 24); g.closePath(); g.fillStyle = '#d6dae3'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke(); }
      bones(g, x - 70, y + 34, 0.6);
      break;
    }
    case 'nest': case 'den': {
      if (d.lm === 'den') { // a rock mound with a dark cave mouth
        g.beginPath(); g.moveTo(x - 80, y + 10); g.quadraticCurveTo(x - 70, y - 64, x, y - 70); g.quadraticCurveTo(x + 70, y - 64, x + 82, y + 10); g.closePath(); g.fillStyle = P.st; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
        g.beginPath(); g.moveTo(x - 30, y + 10); g.quadraticCurveTo(x, y - 46, x + 30, y + 10); g.closePath(); g.fillStyle = '#1c1622'; g.fill(); g.lineWidth = 3; g.stroke();
        g.beginPath(); g.moveTo(x - 60, y - 20); g.lineTo(x - 40, y - 40); g.moveTo(x + 46, y - 34); g.lineTo(x + 62, y - 14); g.strokeStyle = P.dk; g.lineWidth = 3; g.stroke();
      } else { // a twig nest with eggs
        for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU, r = 46 + 10 * rnd(s, i); g.beginPath(); g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6); g.lineTo(x + Math.cos(a + 0.5) * (r + 8), y + Math.sin(a + 0.5) * (r + 8) * 0.6); g.lineWidth = 5; g.strokeStyle = INK; g.stroke(); g.lineWidth = 2.5; g.strokeStyle = P.wd; g.stroke(); }
        g.beginPath(); g.ellipse(x, y, 42, 24, 0, 0, TAU); g.fillStyle = 'rgba(40,24,12,.45)'; g.fill();
        for (let i = 0; i < 4; i++) { const ex = x - 18 + i * 12, ey = y - 4 + (i % 2) * 8; g.beginPath(); g.ellipse(ex, ey, 7, 9, 0.2, 0, TAU); g.fillStyle = P.ac; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke(); }
      }
      bones(g, x + 64, y + 30, -0.4); bones(g, x - 58, y + 36, 0.9);
      break;
    }
    case 'grave': {
      for (let i = 0; i < 6; i++) { const gx = x - 70 + (i % 3) * 66 + 10 * rnd(s, i), gy = y - 24 + Math.floor(i / 3) * 50; g.save(); g.translate(gx, gy); g.rotate((rnd(s, i + 5) - 0.5) * 0.4); g.beginPath(); g.moveTo(-12, 10); g.lineTo(-12, -10); g.arc(0, -10, 12, Math.PI, 0); g.lineTo(12, 10); g.closePath(); g.fillStyle = P.st; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); g.fillStyle = INK; g.fillRect(-1.5, -14, 3, 12); g.fillRect(-6, -10, 12, 3); g.restore(); }
      g.beginPath(); g.moveTo(x + 4, y + 30); g.lineTo(x + 2, y - 30); g.lineTo(x - 18, y - 52); g.moveTo(x + 2, y - 18); g.lineTo(x + 24, y - 40); g.lineWidth = 7; g.strokeStyle = INK; g.stroke(); g.lineWidth = 3.5; g.strokeStyle = '#6a5040'; g.stroke();
      break;
    }
    case 'cairn': {
      for (const [ox, oy, n] of [[-50, 10, 3], [0, -6, 4], [52, 14, 3]]) for (let k = 0; k < n; k++) { const w = 26 - k * 5; g.beginPath(); g.ellipse(x + ox, y + oy - k * 13, w, 9, 0, 0, TAU); g.fillStyle = k % 2 ? P.dk : P.st; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke(); }
      for (let i = 0; i < 5; i++) { const sx = x - 80 + i * 40, sy = y + 34 + 6 * rnd(s, i); g.beginPath(); g.moveTo(sx - 7, sy); g.lineTo(sx, sy - 24 - 10 * rnd(s, i + 2)); g.lineTo(sx + 7, sy); g.closePath(); g.fillStyle = P.ac; g.fill(); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke(); }
      g.beginPath(); g.moveTo(x, y - 58); g.lineTo(x, y - 110); g.lineWidth = 5; g.strokeStyle = INK; g.stroke(); g.lineWidth = 2.5; g.strokeStyle = P.wd; g.stroke();
      g.beginPath(); g.moveTo(x, y - 110); g.lineTo(x + 30, y - 102); g.lineTo(x, y - 92); g.closePath(); g.fillStyle = P.cl; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
      break;
    }
    case 'vent': {
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + rnd(s, i), L0 = 50 + 40 * rnd(s, i + 7); g.beginPath(); g.moveTo(x, y); let px = x, py = y; for (let k = 1; k <= 4; k++) { px = x + Math.cos(a + (rnd(s, i * 9 + k) - 0.5) * 0.6) * L0 * k / 4; py = y + Math.sin(a + (rnd(s, i * 9 + k) - 0.5) * 0.6) * L0 * k / 4 * 0.6; g.lineTo(px, py); } g.lineWidth = 7; g.strokeStyle = INK; g.stroke(); g.lineWidth = 3.5; g.strokeStyle = '#ff7a2c'; g.stroke(); g.lineWidth = 1.4; g.strokeStyle = '#ffd23f'; g.stroke(); }
      circle(g, x, y, 22, '#2a1a18', 3.5); circle(g, x, y, 12, '#ff7a2c', 0); circle(g, x - 3, y - 3, 5, '#ffd23f', 0);
      for (const [ox, oy, h] of [[-70, -10, 44], [66, -20, 56], [30, 40, 30]]) stone(g, x + ox, y + oy, 22, h, P.st, P.dk, 4);
      break;
    }
    default: break;
  }
  g.restore();
}

// ------------------------------------------------------------------ telegraph kinds (render.js drawArea hook)
export function drawSiteArea(ctx, a, t) {
  if (a.kind === 'ward') { // a caster channelling its ward: a gold rune circle filling up
    const k = Math.min(1, a.t / Math.max(1, a.delay));
    ctx.save(); ctx.globalAlpha = 0.18; circle(ctx, a.x, a.y, a.r, '#ffe27a', 0); ctx.globalAlpha = 0.85;
    ctx.setLineDash([12, 10]); ctx.lineDashOffset = -t * 30; ctx.lineWidth = 3.5; ctx.strokeStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.35; circle(ctx, a.x, a.y, a.r * k, '#fff6c8', 0);
    ctx.globalAlpha = 0.9; for (let i = 0; i < 6; i++) { const an = t * 1.2 + i * (TAU / 6); ctx.save(); ctx.translate(a.x + Math.cos(an) * a.r * 0.82, a.y + Math.sin(an) * a.r * 0.82); ctx.rotate(an); ctx.fillStyle = '#fff6c8'; ctx.fillRect(-2, -7, 4, 14); ctx.restore(); }
    ctx.restore(); return true;
  }
  if (a.kind === 'fpool') { // an imp / moth fire pool: a red fill-up, then a burning puddle while it pulses
    if (a.t < a.delay) {
      const k = a.t / Math.max(1, a.delay);
      ctx.save(); ctx.globalAlpha = 0.22; circle(ctx, a.x, a.y, a.r, '#ff3b2b', 0); ctx.globalAlpha = 0.4; circle(ctx, a.x, a.y, a.r * k, '#ff7a2c', 0);
      ctx.globalAlpha = 0.9; ctx.lineWidth = 3; ctx.strokeStyle = '#ff3b2b'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke();
      const fy = a.y - 200 * (1 - k); circle(ctx, a.x + 30 * (1 - k), fy, 7 + 4 * k, '#ff8a3c', 2.5); // the falling ember
      ctx.restore(); return true;
    }
    const life = a.delay + (a.pulses - 1) * a.every, fade = Math.max(0, Math.min(1, (life + 10 - a.t) / 12));
    ctx.save(); ctx.globalAlpha = 0.55 * fade; circle(ctx, a.x, a.y, a.r, '#ff5e2b', 0); ctx.globalAlpha = 0.8 * fade; ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke();
    for (let i = 0; i < 6; i++) { const an = i * 1.7 + t * 2, rr = a.r * (0.25 + 0.55 * ((i * 0.37) % 1)), fx = a.x + Math.cos(an) * rr, fy = a.y + Math.sin(an) * rr * 0.7, h = 12 + 6 * Math.sin(t * 9 + i); ctx.beginPath(); ctx.moveTo(fx - 6, fy); ctx.quadraticCurveTo(fx - 4, fy - h * 0.6, fx, fy - h); ctx.quadraticCurveTo(fx + 4, fy - h * 0.6, fx + 6, fy); ctx.closePath(); ctx.fillStyle = i % 2 ? '#ffd23f' : '#ff8a3c'; ctx.fill(); }
    ctx.restore(); return true;
  }
  if (a.kind === 'spore') { // a shroom swelling up before its spore puff: a green ring with a mark per spore
    const k = Math.min(1, a.t / Math.max(1, a.delay));
    ctx.save(); ctx.globalAlpha = 0.18 + 0.2 * k; circle(ctx, a.x, a.y, a.r * (0.6 + 0.4 * k), '#9be36a', 0);
    ctx.globalAlpha = 0.85; ctx.lineWidth = 3; ctx.strokeStyle = '#5fa83a'; ctx.setLineDash([8, 7]); ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    const n = 5; for (let i = 0; i < n; i++) { const an = (a.ang || 0) + (i / n) * TAU; circle(ctx, a.x + Math.cos(an) * (a.r + 4 + 10 * k), a.y + Math.sin(an) * (a.r + 4 + 10 * k), 4 + 2 * k, '#c8f59a', 1.5); }
    ctx.restore(); return true;
  }
  if (a.kind === 'aim') { // a ranged fodder lining up a shot: a thin dashed sight line
    const k = Math.min(1, a.t / Math.max(1, a.delay)), c = Math.cos(a.ang), s = Math.sin(a.ang);
    ctx.save(); ctx.globalAlpha = 0.35 + 0.5 * k; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 60; ctx.lineCap = 'round';
    ctx.lineWidth = a.w * 0.5 + 2; ctx.strokeStyle = 'rgba(255,60,40,.9)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + c * a.len, a.y + s * a.len); ctx.stroke(); ctx.setLineDash([]);
    circle(ctx, a.x + c * a.len * k, a.y + s * a.len * k, 4, '#ffd23f', 1.5);
    ctx.restore(); return true;
  }
  return false;
}

/** the goblin spear (enemy projectile style 'spear') */
export function drawSpear(ctx, pr, x, y) {
  if (pr.style !== 'spear') return false;
  const ang = Math.atan2(pr.vy, pr.vx);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(8, 0); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#a8743c'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(5, -5); ctx.lineTo(5, 5); ctx.closePath(); ctx.fillStyle = '#d6dae3'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-27, -4); ctx.moveTo(-22, 0); ctx.lineTo(-27, 4); ctx.strokeStyle = '#ff5e5b'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore(); return true;
}

/** a warded (shielded) enemy: a gold bubble */
export function wardBubble(ctx, x, y, r, t) {
  ctx.save(); ctx.globalAlpha = 0.22; circle(ctx, x, y, r + 7, '#ffe27a', 0);
  ctx.globalAlpha = 0.85; ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x, y, r + 7, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(x, y, r + 7, -1.2 + t * 2, -0.4 + t * 2); ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ Swarm event
export function swarmState(sim) {
  if (sim.swarmV !== undefined) return sim.swarmV;
  return sim.horde ? packSwarm(sim) : null;
}
function chest(ctx, x, y, t, open = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1.3, 1.3);
  ctx.globalAlpha = 0.6 + 0.2 * Math.sin(t * 4); ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-16, -210); ctx.lineTo(16, -210); ctx.lineTo(30, 0); ctx.closePath();
  const gr = ctx.createLinearGradient(0, 0, 0, -210); gr.addColorStop(0, 'rgba(255,210,63,.8)'); gr.addColorStop(1, 'rgba(255,210,63,0)'); ctx.fillStyle = gr; ctx.fill(); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.ellipse(0, 14, 34, 10, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill();
  ctx.fillStyle = '#8a5a2a'; ctx.fillRect(-28, -14, 56, 28); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.strokeRect(-28, -14, 56, 28);
  ctx.beginPath(); ctx.moveTo(-28, -14); ctx.quadraticCurveTo(0, -38 - open * 10, 28, -14); ctx.closePath(); ctx.fillStyle = '#a8703a'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd23f'; for (const bx of [-22, 16]) { ctx.fillRect(bx, -24, 6, 38); ctx.strokeRect(bx, -24, 6, 38); }
  ctx.fillRect(-6, -10, 12, 12); ctx.strokeRect(-6, -10, 12, 12);
  for (let i = 0; i < 5; i++) { const ph = (t * 0.8 + i / 5) % 1, an = i * 2.4; ctx.globalAlpha = 1 - ph; circle(ctx, Math.cos(an) * 26, -20 - ph * 70, 3, '#fff6c8', 0); }
  ctx.restore();
}
/** the marker / wave ring / chest in the world (render.js, under the entities) */
export function drawSwarmUnder(ctx, sim, t, view) {
  const S = swarmState(sim); if (!S) return;
  if (S.x < view.x0 - 900 || S.x > view.x1 + 900 || S.y < view.y0 - 900 || S.y > view.y1 + 900) return;
  ctx.save();
  if (S.st === 'marked') {
    const R = 420, p = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.globalAlpha = 0.12 + 0.06 * p; circle(ctx, S.x, S.y, R, '#ff5e2b', 0);
    ctx.globalAlpha = 0.9; ctx.setLineDash([22, 14]); ctx.lineDashOffset = -t * 40; ctx.lineWidth = 6; ctx.strokeStyle = '#ff7a2c'; ctx.beginPath(); ctx.arc(S.x, S.y, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1; swarmBanner(ctx, S.x, S.y - 10, t);
  } else if (S.st === 'fight') {
    ctx.globalAlpha = 0.5; ctx.setLineDash([16, 18]); ctx.lineDashOffset = t * 30; ctx.lineWidth = 4; ctx.strokeStyle = '#ff3b2b'; ctx.beginPath(); ctx.arc(S.x, S.y, 700, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1; swarmBanner(ctx, S.x, S.y - 10, t);
  } else if (S.st === 'chest' && S.ch) chest(ctx, S.ch[0], S.ch[1], t);
  ctx.restore();
}
function swarmBanner(ctx, x, y, t) { // a war-banner pole with crossed swords on a red flag
  ctx.beginPath(); ctx.moveTo(x, y + 20); ctx.lineTo(x, y - 120); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3.5; ctx.strokeStyle = '#8a5a2a'; ctx.stroke();
  const w = Math.sin(t * 4) * 5;
  ctx.beginPath(); ctx.moveTo(x, y - 118); ctx.lineTo(x + 56, y - 108 + w); ctx.lineTo(x + 46, y - 92 + w * 0.6); ctx.lineTo(x + 56, y - 76 + w); ctx.lineTo(x, y - 70); ctx.closePath(); ctx.fillStyle = '#d8342c'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  swords(ctx, x + 24, y - 94 + w * 0.5, 0.8, '#fff6d8');
}
function swords(ctx, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round';
  for (const r of [-0.8, 0.8]) { ctx.save(); ctx.rotate(r); ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -14); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, 7); ctx.lineTo(6, 7); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); }
  ctx.restore();
}
/** minimap / map icon: crossed swords in a red disc (pinned to the rim with `pin`) */
export function swarmIcon(ctx, x, y, s = 1, t = 0, dim = false) {
  ctx.save(); ctx.globalAlpha = dim ? 0.6 : 1;
  const p = 1 + 0.12 * Math.sin(t * 6);
  circle(ctx, x, y, 8 * s * p, '#d8342c', 2.2);
  swords(ctx, x, y, 0.42 * s, '#fff6d8');
  ctx.restore();
}
const LM_NAME = { ruin: 'Ruins', obelisk: 'Obelisk', camp: 'Camp', nest: 'Nest', den: 'Den', grave: 'Graveyard', cairn: 'Cairn', vent: 'Magma Vent' };
const fmt = (ticks) => { const s = Math.max(0, Math.ceil(ticks / 60)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const dirName = (dx, dy) => { const a = Math.atan2(dy, dx), i = Math.round(a / (Math.PI / 4)) & 7; return ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][i]; };
function hudTxt(ctx, s, x, y, size, col, align = 'center') {
  ctx.font = `bold ${size}px "Lilita One", "Trebuchet MS", sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.22); ctx.strokeStyle = INK; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y);
}
/** the HUD callout (top centre, under the zone name) + an arrow at the screen edge pointing to the swarm */
export function drawSwarmHud(ctx, w, h, sim, p, t, sc = 1) {
  const S = swarmState(sim); if (!S || !p) return false;
  const dx = S.x - p.x, dy = S.y - p.y, dist = Math.hypot(dx, dy);
  let title, sub, col;
  if (S.st === 'marked') { title = 'SWARM GATHERING'; col = '#ff9a4c'; sub = `${LM_NAME[S.lm] || 'Site'} · ${(dist / 1000).toFixed(1)}k ${dirName(dx, dy)} · go there to start it · ${fmt(S.end)}`; }
  else if (S.st === 'fight') { title = `SWARM · WAVE ${Math.min(S.wave, S.nw)}/${S.nw}`; col = '#ff5e5b'; sub = `${S.left} left · bonus chest in ${fmt(S.end)}${dist > 900 ? ` · ${(dist / 1000).toFixed(1)}k ${dirName(dx, dy)}` : ''}`; }
  else if (S.st === 'chest') { title = 'SWARM CLEARED'; col = '#ffd23f'; sub = `Open the bonus chest${dist > 300 ? ` · ${(dist / 1000).toFixed(1)}k ${dirName(dx, dy)}` : ''} · ${fmt(S.end)}`; }
  else return false;
  ctx.save(); ctx.translate(w / 2, 118 * sc); ctx.scale(sc, sc); // (below the quest tracker)
  ctx.globalAlpha = 0.82; ctx.fillStyle = 'rgba(26,16,40,.78)'; const bw = 430; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-bw / 2, -20, bw, 52, 12) : ctx.rect(-bw / 2, -20, bw, 52); ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.stroke();
  swarmIcon(ctx, -bw / 2 + 24, 6, 1.6, t);
  hudTxt(ctx, title, 12, -3, 20, col); hudTxt(ctx, sub, 12, 18, 13, '#fff');
  ctx.restore();
  // off-screen arrow
  if (dist > 650 && (S.st !== 'chest' || dist > 300)) {
    const a = Math.atan2(dy, dx), R = Math.min(w, h) * 0.4, ax = w / 2 + Math.cos(a) * R, ay = Math.max(184 * sc, h / 2 + Math.sin(a) * R); // (kept below the quest tracker + this panel)
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 6);
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-8, -12); ctx.lineTo(-3, 0); ctx.lineTo(-8, 12); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
    swarmIcon(ctx, ax - Math.cos(a) * 26, ay - Math.sin(a) * 26, 1.3, t);
  }
  return true;
}
