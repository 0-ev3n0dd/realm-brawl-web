// The Wilds bestiary redrawn at the Dunes/Tomb detail level (art pass): slimes, goblins, sprouts, boars, skeletons,
// shrooms, golems, wisps, wolves, knights, imps, Grimtusk, plus the new world bosses (Thornmaw, Ashfang, Ankhara,
// Sekhem). Same code-drawn kit as dunesfx.js: light->shade gradients lit from the upper left (in the body's rotated
// frame via lightLocal), rim light, tidy ink outlines, texture strokes (fur, bark, stone, stitching) and decals.
// No shadowBlur: glows are cached glow sprites. Regular mobs are cached per facing / animation frame by art.js.
import { INK, circle, ellipse, rrect, shade, star, ENEMY_DRAW, drawSword, drawBow } from './art.js';
import { lgrad, rimArc, ink, ball, oval, poly, rimPoly, lightLocal } from './dunesfx.js';
import { glowSprite } from './wildsfx.js';
import { blit } from './sprite.js';

const TAU = Math.PI * 2;
const H = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const glow = (ctx, x, y, col, r) => blit(ctx, glowSprite(col, r), x, y);
/** Angry cartoon eyes with a highlight. (x = forward offset, sep = half distance) */
function eyes2(ctx, x, sep, r, col = '#fff', pupil = INK, la = 0) {
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.arc(x, s * sep, r, 0, TAU); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = Math.max(1.4, r * 0.45); ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.arc(x + r * 0.3, s * sep, r * 0.52, 0, TAU); ctx.fillStyle = pupil; ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.05, s * sep - r * 0.35, r * 0.22, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - r * 0.9, s * (sep - r * 1.2)); ctx.lineTo(x + r * 1.1, s * (sep - r * 0.35)); ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.6, r * 0.55); ctx.stroke();
  }
}
const fur = (ctx, x, y, r, n, col, len = 5, seed = 1, w = 1.5) => {
  ctx.beginPath();
  for (let i = 0; i < n; i++) { const a = H(seed, i) * TAU, d = r * Math.sqrt(H(i, seed + 3)), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.8; ctx.moveTo(px, py); ctx.lineTo(px - len, py + (H(i, seed) - 0.5) * len * 0.6); }
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
};

Object.assign(ENEMY_DRAW, {
  slime(ctx, e, t, col) {
    const la = lightLocal(e), r = e.r;
    const sq = e.state === 'wind' ? 1 + Math.sin(e.st * 0.9) * 0.15 : 1 + Math.sin(t * 5 + e.id) * 0.05;
    ctx.save(); ctx.scale(sq, 1 / sq);
    // jelly: dark rim, body gradient, inner core, bubbles, a drip, glossy glint
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.92, 0, 0, TAU); ctx.fillStyle = lgrad(ctx, 0, 0, r, col, la, 0.3, -0.42); ctx.fill(); ink(ctx, 3);
    ctx.beginPath(); ctx.ellipse(-r * 0.08, r * 0.05, r * 0.62, r * 0.55, 0, 0, TAU); ctx.fillStyle = 'rgba(20,60,30,.16)'; ctx.fill();
    for (let i = 0; i < 4; i++) { const a = H(i, 5) * TAU, d = r * 0.5 * H(5, i); circle(ctx, Math.cos(a) * d, Math.sin(a) * d, 1.4 + H(i, 9) * 2.2, 'rgba(255,255,255,.35)', 0); }
    ctx.beginPath(); ctx.ellipse(-r * 0.32, -r * 0.38, r * 0.34, r * 0.2, -0.5, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.fill();
    circle(ctx, -r * 0.05, -r * 0.58, r * 0.08, '#fff', 0);
    rimArc(ctx, 0, 0, r - 2.5, la, 'rgba(255,255,240,.55)', 2, 0.9);
    ctx.restore();
    eyes2(ctx, r * 0.35, r * 0.33, r * 0.22);
  },
  goblin(ctx, e, t, col) {
    const la = lightLocal(e), r = e.r;
    ctx.save(); ctx.translate(8, 14); ctx.rotate(e.state === 'lunge' ? 0 : 0.5); ctx.scale(0.55, 0.8); drawSword(ctx, 22); ctx.restore();
    // ragged leather tunic with stitches + belt
    oval(ctx, -2, 0, 10, 15, '#8b5a2b', la, 3, 0, 0.45);
    ctx.beginPath(); for (let i = -3; i <= 3; i++) { ctx.moveTo(-8, i * 3.6); ctx.lineTo(-5, i * 3.6 + 1); } ctx.strokeStyle = 'rgba(40,20,10,.5)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -13); ctx.lineTo(-6, 13); ctx.strokeStyle = '#4a2f18'; ctx.lineWidth = 3; ctx.stroke(); circle(ctx, -6, 0, 2.4, '#e8c35a', 1.2);
    // ears (inner pink, a notch)
    for (const s of [-1, 1]) { poly(ctx, [[-2, s * r * 0.6], [-11, s * r * 1.38], [6, s * r * 0.7]]); ctx.fillStyle = lgrad(ctx, -2, s * r, 8, col, la); ctx.fill(); ink(ctx, 2.6); poly(ctx, [[-2, s * r * 0.7], [-8, s * r * 1.18], [3, s * r * 0.76]]); ctx.fillStyle = 'rgba(240,140,140,.6)'; ctx.fill(); }
    ball(ctx, 2, 0, r * 0.8, col, la, 3, 0.55);
    circle(ctx, -3, -4, 1.3, shade(col, -0.3), 0); circle(ctx, -5, 3, 1, shade(col, -0.3), 0);
    ellipse(ctx, r * 0.72, 0, 3, 2.4, shade(col, -0.15), 1.6);
    eyes2(ctx, 7, 4.5, 3, '#ffe45c');
  },
  sprout(ctx, e, t, col) {
    const la = lightLocal(e), r = e.r, k = e.state === 'wind' ? 1 + e.st / 40 : 1;
    ball(ctx, 0, 0, r + 4, '#8a5a35', la, 3, 0.35);
    for (let i = 0; i < 6; i++) { const a = H(i, 3) * TAU; circle(ctx, Math.cos(a) * (r + 2), Math.sin(a) * (r + 2), 2 + H(3, i) * 1.5, '#6e4426', 1.2); }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + Math.sin(t * 2 + e.id) * 0.15;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(r * 0.25, 0); ctx.quadraticCurveTo(r * 0.9, -r * 0.42, r * 1.62, 0); ctx.quadraticCurveTo(r * 0.9, r * 0.42, r * 0.25, 0);
      ctx.fillStyle = lgrad(ctx, r * 0.9, 0, r * 0.7, shade(col, -0.08), la - a); ctx.fill(); ink(ctx, 2.6);
      ctx.beginPath(); ctx.moveTo(r * 0.3, 0); ctx.lineTo(r * 1.5, 0); for (let j = 1; j < 4; j++) { ctx.moveTo(r * (0.4 + j * 0.28), 0); ctx.lineTo(r * (0.55 + j * 0.28), -r * 0.16); ctx.moveTo(r * (0.4 + j * 0.28), 0); ctx.lineTo(r * (0.55 + j * 0.28), r * 0.16); }
      ctx.strokeStyle = 'rgba(30,70,20,.45)'; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.restore();
    }
    ball(ctx, 0, 0, r * 0.62 * k, '#ffcf3a', la, 3, 0.6);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; circle(ctx, Math.cos(a) * r * 0.36 * k, Math.sin(a) * r * 0.36 * k, 1.1, '#c9881a', 0); }
    circle(ctx, r * 0.3, 0, r * 0.25, INK, 0); circle(ctx, r * 0.33, 0, r * 0.12, '#7a1a1a', 0);
    eyes2(ctx, -1, 4, 2.2);
  },
  boar(ctx, e, t, col) {
    const la = lightLocal(e), r = e.r;
    // hooves peeking out
    for (const [x, y] of [[r * 0.6, -r * 0.8], [r * 0.6, r * 0.8], [-r * 0.7, -r * 0.75], [-r * 0.7, r * 0.75]]) ellipse(ctx, x, y, 5, 3.5, '#3a2a22', 2);
    oval(ctx, 0, 0, r * 1.25, r * 0.95, col, la, 3.5, 0, 0.5);
    // bristly mane ridge along the spine + flank fur strokes
    ctx.beginPath(); for (let i = 0; i < 14; i++) { const x = -r * 0.95 + i * r * 0.14; ctx.moveTo(x, -2); ctx.lineTo(x - 5, -7 + (i % 2) * 3); ctx.moveTo(x, 2); ctx.lineTo(x - 5, 7 - (i % 2) * 3); } ctx.strokeStyle = shade(col, -0.45); ctx.lineWidth = 2.2; ctx.stroke();
    fur(ctx, -r * 0.1, 0, r * 0.85, 18, shade(col, -0.28), 5, e.type.length, 1.3);
    // ears
    oval(ctx, r * 0.45, -r * 0.6, 6, 4, shade(col, -0.2), la, 2.5, 0.5, 0.4); oval(ctx, r * 0.45, r * 0.6, 6, 4, shade(col, -0.2), la, 2.5, -0.5, 0.4);
    // snout with nostrils + tusks
    ball(ctx, r * 1.1, 0, r * 0.42, '#e7a38a', la, 3, 0.5);
    ellipse(ctx, r * 1.24, -3, 2, 2.6, '#6a2a2a', 0); ellipse(ctx, r * 1.24, 3, 2, 2.6, '#6a2a2a', 0);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 1.0, s * r * 0.45); ctx.quadraticCurveTo(r * 1.5, s * r * 0.7, r * 1.55, s * r * 0.25); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#fff8e6'; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = 'rgba(160,130,90,.6)'; ctx.lineWidth = 1; ctx.stroke(); }
    eyes2(ctx, r * 0.65, r * 0.33, 2.8, '#fff', '#b00');
    // a scar decal
    ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.5); ctx.lineTo(-r * 0.05, -r * 0.2); ctx.moveTo(-r * 0.22, -r * 0.55); ctx.lineTo(-r * 0.32, -r * 0.4); ctx.strokeStyle = 'rgba(255,220,200,.55)'; ctx.lineWidth = 1.6; ctx.stroke();
  },
  skeleton(ctx, e, t, col) {
    const la = lightLocal(e), r = e.r;
    ctx.save(); ctx.translate(8, 0); ctx.scale(0.75, 0.75); drawBow(ctx, e.state === 'cast' || e.state === 'wind' ? 10 : 2); ctx.restore();
    circle(ctx, 16, 0, 4, col, 2.5);
    // ribcage
    oval(ctx, -3, 0, 8, 13, '#cfcabb', la, 3, 0, 0.4);
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(3, 0); for (let i = -2; i <= 2; i++) { if (!i) continue; ctx.moveTo(-6, i * 4); ctx.quadraticCurveTo(-2, i * 5.5, 1, i * 4); } ctx.strokeStyle = 'rgba(60,50,40,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
    // a tattered hood scrap
    poly(ctx, [[-10, -9], [-15, -2], [-12, 6], [-9, 11], [-6, 4]]); ctx.fillStyle = 'rgba(70,50,80,.75)'; ctx.fill(); ink(ctx, 1.8);
    ball(ctx, 1, 0, r * 0.85, col, la, 3, 0.55);
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(-r * 0.2, -r * 0.05); ctx.lineTo(-r * 0.3, r * 0.25); ctx.strokeStyle = 'rgba(70,60,50,.6)'; ctx.lineWidth = 1.4; ctx.stroke();
    circle(ctx, 6, -4, 3.3, INK, 0); circle(ctx, 6, 4, 3.3, INK, 0);
    glow(ctx, 6, -4, '#ff5e5b', 6); glow(ctx, 6, 4, '#ff5e5b', 6);
    circle(ctx, 6.5, -4, 1.3, '#ffb0a0', 0); circle(ctx, 6.5, 4, 1.3, '#ffb0a0', 0);
    ctx.beginPath(); for (let i = -2; i <= 2; i++) { ctx.moveTo(r * 0.72, i * 2); ctx.lineTo(r * 0.86, i * 2); } ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
  },
  shroom(ctx, e, t, col) {
    const k = e.state === 'wind' ? 1 + Math.min(1, e.st / 22) * 0.18 : 1 + Math.sin(t * 3 + e.id) * 0.03;
    ctx.rotate(-e.face);
    const r = e.r * k;
    // gills under the rim, cap gradient, spots with their own shading, a glossy highlight
    ctx.beginPath(); ctx.arc(0, 2, r * 1.02, 0, TAU); ctx.fillStyle = '#e8d2b8'; ctx.fill(); ink(ctx, 3);
    ctx.beginPath(); for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; ctx.moveTo(Math.cos(a) * r * 0.75, 2 + Math.sin(a) * r * 0.75); ctx.lineTo(Math.cos(a) * r * 0.98, 2 + Math.sin(a) * r * 0.98); } ctx.strokeStyle = 'rgba(120,80,60,.5)'; ctx.lineWidth = 1.2; ctx.stroke();
    ball(ctx, 0, -1, r * 0.92, col, -2.3, 3, 0.6);
    const spots = [[-0.4, -0.3, 0.22], [0.35, -0.35, 0.18], [0.1, 0.35, 0.26], [-0.45, 0.35, 0.14], [0.5, 0.2, 0.12]];
    for (const [x, y, rr] of spots) { ball(ctx, x * r * 0.92, y * r * 0.92 - 1, rr * r, '#fff4e8', -2.3, 1.8, 0.4); }
    ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.45, r * 0.3, r * 0.14, -0.5, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fill();
  },
  golem(ctx, e, t, col) {
    const la = lightLocal(e), r = e.r, wind = e.state === 'slamwind' ? Math.min(1, e.st / 50) : 0, fx = r * 0.9 + wind * 8;
    for (const s of [-1, 1]) {
      const pts = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3, rr = r * 0.42 * (0.88 + H(i, s + 5) * 0.24); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      poly(ctx, pts, fx, s * r * 0.85); ctx.fillStyle = lgrad(ctx, fx, s * r * 0.85, r * 0.42, shade(col, -0.12), la); ctx.fill(); ink(ctx, 3);
      ctx.beginPath(); ctx.moveTo(fx + r * 0.2, s * r * 0.7); ctx.lineTo(fx + r * 0.25, s * r * 1.0); ctx.strokeStyle = 'rgba(40,30,50,.45)'; ctx.lineWidth = 1.6; ctx.stroke();
    }
    const pts = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, rr = r * (0.9 + H(i, 7) * 0.14); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    poly(ctx, pts); ctx.fillStyle = lgrad(ctx, 0, 0, r, col, la); ctx.fill(); ink(ctx, 4);
    // facets, moss, cracks
    poly(ctx, pts.map(([x, y]) => [x * 0.55, y * 0.55]), -r * 0.08, -r * 0.05); ctx.fillStyle = 'rgba(255,250,230,.14)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(40,30,50,.3)'; ctx.stroke();
    for (let i = 0; i < 9; i += 2) { ctx.beginPath(); ctx.moveTo(pts[i][0] * 0.55 - r * 0.08, pts[i][1] * 0.55 - r * 0.05); ctx.lineTo(pts[i][0], pts[i][1]); ctx.strokeStyle = 'rgba(40,30,50,.3)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(-r * 0.45, r * 0.35, r * 0.3, r * 0.16, 0.4, 0, TAU); ctx.fillStyle = 'rgba(110,170,70,.6)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(-r * 0.1, 0); ctx.lineTo(-r * 0.4, r * 0.3); ctx.strokeStyle = '#ff9a3c'; ctx.lineWidth = 2; ctx.stroke();
    rimPoly(ctx, pts, 0, 0, 0.9);
    glow(ctx, r * 0.45, -r * 0.28, '#ff9a3c', 9); glow(ctx, r * 0.45, r * 0.28, '#ff9a3c', 9);
    circle(ctx, r * 0.45, -r * 0.28, 4, '#ffb347', 0); circle(ctx, r * 0.45, r * 0.28, 4, '#ffb347', 0);
    circle(ctx, r * 0.47, -r * 0.29, 1.6, '#fff3c0', 0); circle(ctx, r * 0.47, r * 0.27, 1.6, '#fff3c0', 0);
  },
  wisp(ctx, e, t, col) {
    const a = e.state === 'fade' ? 1 - e.st / 20 : 1;
    ctx.globalAlpha *= Math.max(0.1, a);
    glow(ctx, 0, 0, col, e.r * 2.2);
    for (let i = 3; i >= 1; i--) circle(ctx, -i * 6, Math.sin(t * 8 + i) * 3, e.r * (1 - i * 0.2), `rgba(111,211,255,${0.25 + 0.1 * (3 - i)})`, 0);
    ball(ctx, 0, 0, e.r, col, lightLocal(e), 3, 0.7);
    circle(ctx, 0, 0, e.r * 0.55, 'rgba(230,250,255,.55)', 0);
    circle(ctx, -3, -3, e.r * 0.3, 'rgba(255,255,255,.75)', 0);
    eyes2(ctx, 5, 4, 2.4, INK, '#fff');
  },
});

Object.assign(ENEMY_DRAW, {
  wolf(ctx, e, t, col) { wolfBody(ctx, e, t, col, e.r, false); },
  knight(ctx, e, t, col) {
    const la = lightLocal(e), r = e.r;
    // kite shield: steel rim, painted field, a boss stud and rivets
    ctx.save(); ctx.translate(r * 0.6, -r * 0.85); ctx.rotate(0.3);
    ctx.beginPath(); ctx.moveTo(-7, -12); ctx.lineTo(7, -12); ctx.lineTo(7, 4); ctx.quadraticCurveTo(0, 14, -7, 4); ctx.closePath(); ctx.fillStyle = lgrad(ctx, 0, 0, 12, '#5b5f7e', la - 0.3); ctx.fill(); ink(ctx, 3);
    ctx.beginPath(); ctx.moveTo(-4.5, -9.5); ctx.lineTo(4.5, -9.5); ctx.lineTo(4.5, 3); ctx.quadraticCurveTo(0, 10, -4.5, 3); ctx.closePath(); ctx.fillStyle = '#8e2f3a'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -9.5); ctx.lineTo(0, 8); ctx.moveTo(-4.5, -3); ctx.lineTo(4.5, -3); ctx.strokeStyle = '#e8c35a'; ctx.lineWidth = 1.6; ctx.stroke();
    circle(ctx, 0, -3, 2.6, '#d6dae3', 1.4);
    ctx.restore();
    let sw = 0.9;
    if (e.state === 'swing') sw = e.st < 34 ? 0.9 + Math.min(1, e.st / 30) * 1.2 : -1.2;
    ctx.save(); ctx.translate(Math.cos(sw) * r * 0.8, Math.sin(sw) * r * 0.8); ctx.rotate(sw * 0.8); drawSword(ctx, 44, e.state === 'swing' ? '#ff5e5b' : null); ctx.restore();
    // tabard tail behind
    poly(ctx, [[-r * 0.4, -r * 0.35], [-r * 1.3, -r * 0.25], [-r * 1.2, 0], [-r * 1.3, r * 0.25], [-r * 0.4, r * 0.35]]); ctx.fillStyle = lgrad(ctx, -r * 0.8, 0, r * 0.5, '#b8343f', la); ctx.fill(); ink(ctx, 2.6);
    ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(-r * 1.15, 0); ctx.strokeStyle = '#e8c35a'; ctx.lineWidth = 1.6; ctx.stroke();
    // pauldrons
    for (const s of [-1, 1]) { oval(ctx, -r * 0.05, s * r * 0.78, r * 0.36, r * 0.26, '#6b6f8e', la, 3, 0, 0.6); ctx.beginPath(); ctx.ellipse(-r * 0.05, s * r * 0.78, r * 0.22, r * 0.14, 0, 0, TAU); ctx.strokeStyle = 'rgba(30,25,45,.4)'; ctx.lineWidth = 1.3; ctx.stroke(); }
    // great helm: metallic gradient, a specular streak, the glowing visor slit, rivets, plume
    ball(ctx, 0, 0, r, col, la, 4, 0.75);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, -1.2, 1.2); ctx.strokeStyle = shade(col, 0.3); ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.55); ctx.quadraticCurveTo(-r * 0.1, -r * 0.8, r * 0.3, -r * 0.62); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2.4; ctx.stroke();
    for (let i = 0; i < 6; i++) { const a = -1.1 + i * 0.44; circle(ctx, Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, 1.3, '#e9eef5', 0.8); }
    rrect(ctx, r * 0.35, -r * 0.5, 6, r, 3); ctx.fillStyle = INK; ctx.fill();
    glow(ctx, r * 0.5, 0, '#ff3b3b', r * 0.7);
    rrect(ctx, r * 0.4, -r * 0.4, 3.5, r * 0.8, 2); ctx.fillStyle = '#ff5e5b'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r * 0.2, 0); ctx.quadraticCurveTo(-r * 0.8, -4, -r * 1.25, 0); ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = '#e84c3d'; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = 'rgba(255,200,190,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  },
  imp(ctx, e, t, col) {
    const la = lightLocal(e), r = e.r, flap = Math.sin(t * 18 + e.id) * 0.35;
    // tail with a spade tip
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.quadraticCurveTo(-r * 1.4, r * 0.5, -r * 1.8, Math.sin(t * 18 + e.id) * 3); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = shade(col, -0.2); ctx.lineWidth = 2.5; ctx.stroke();
    // membrane wings with finger bones
    for (const s of [-1, 1]) {
      ctx.save(); ctx.rotate(s * (2.2 + flap));
      poly(ctx, [[4, 0], [r * 1.6, -6], [r * 1.3, 2], [r * 1.7, 8], [r * 1.2, 10]]); ctx.fillStyle = lgrad(ctx, r, 2, r, '#7a2a3a', la - s * 2.2); ctx.fill(); ink(ctx, 2.5);
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(r * 1.6, -6); ctx.moveTo(4, 0); ctx.lineTo(r * 1.3, 2); ctx.moveTo(4, 0); ctx.lineTo(r * 1.7, 8); ctx.strokeStyle = 'rgba(255,190,170,.45)'; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.restore();
    }
    ball(ctx, 0, 0, r, col, la, 3, 0.6);
    ctx.beginPath(); ctx.ellipse(-r * 0.15, 0, r * 0.45, r * 0.55, 0, 0, TAU); ctx.fillStyle = 'rgba(255,200,150,.25)'; ctx.fill();
    for (const s of [-1, 1]) { poly(ctx, [[2, s * r * 0.6], [-6, s * r * 1.25], [-3, s * r * 0.5]]); ctx.fillStyle = lgrad(ctx, -2, s * r * 0.9, 5, '#ffe9c9', la); ctx.fill(); ink(ctx, 2.5); }
    eyes2(ctx, 5, 4.5, 2.6, '#ffe45c');
    ctx.beginPath(); ctx.moveTo(r * 0.75, -3); ctx.lineTo(r * 0.85, 0); ctx.lineTo(r * 0.75, 3); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
  },
  boss(ctx, e, t, col) { grimtusk(ctx, e, t, col); },
  thornmaw(ctx, e, t, col) { thornmaw(ctx, e, t, col); },
  ashfang(ctx, e, t, col) {
    const p2 = e.phase >= 2;
    if (p2) glow(ctx, 0, 0, '#ff5a2a', e.r * 1.6);
    wolfBody(ctx, e, t, col, e.r, true);
  },
  ankhara(ctx, e, t, col) { ankhara(ctx, e, t, col); },
  sekhem(ctx, e, t, col) { sekhem(ctx, e, t, col); },
});

/** Wolves (and Ashfang, scaled up with an ember-cracked ash coat, a spiky mane and scars). */
function wolfBody(ctx, e, t, col, r, alpha) {
  const la = lightLocal(e), wag = Math.sin(t * 12 + e.id) * 0.4, p2 = alpha && e.phase >= 2;
  // legs (a little trot)
  const step = Math.sin(t * 12 + e.id) * r * 0.12;
  for (const [x, y, s] of [[r * 0.55, -r * 0.62, 1], [r * 0.55, r * 0.62, -1], [-r * 0.65, -r * 0.6, -1], [-r * 0.65, r * 0.6, 1]]) ellipse(ctx, x + step * s, y, r * 0.22, r * 0.16, shade(col, -0.3), 2.2);
  // bushy tail
  ctx.save(); ctx.translate(-r * 1.1, 0); ctx.rotate(Math.PI + wag);
  oval(ctx, r * 0.5, 0, r * 0.7, r * 0.28, shade(col, 0.1), la - Math.PI - wag, 2.6, 0, 0.4);
  ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(r * (0.2 + i * 0.2), -r * 0.1); ctx.lineTo(r * (0.35 + i * 0.2), r * 0.05); } ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 1.3; ctx.stroke();
  circle(ctx, r * 1.1, 0, r * 0.14, alpha ? '#ff8a3c' : '#f2f2f2', 0);
  ctx.restore();
  oval(ctx, -2, 0, r * 1.1, r * 0.75, col, la, alpha ? 4 : 3, 0, 0.5);
  // darker saddle + fur strokes
  ctx.beginPath(); ctx.ellipse(-r * 0.2, 0, r * 0.7, r * 0.32, 0, 0, TAU); ctx.fillStyle = shade(col, -0.25); ctx.fill();
  fur(ctx, -r * 0.2, 0, r * 0.7, alpha ? 30 : 16, shade(col, -0.42), r * 0.25, 7, alpha ? 2 : 1.3);
  fur(ctx, -r * 0.4, -r * 0.2, r * 0.4, 8, 'rgba(255,255,255,.35)', r * 0.2, 9, 1.2);
  if (alpha) {
    // spiky mane + ember cracks + scars
    for (let i = 0; i < 11; i++) { const a = -1.4 + i * 0.28; poly(ctx, [[r * 0.25 + Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.55], [r * 0.05 + Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95], [r * 0.25 + Math.cos(a + 0.2) * r * 0.45, Math.sin(a + 0.2) * r * 0.55]]); ctx.fillStyle = shade(col, -0.35 + (i % 2) * 0.12); ctx.fill(); ink(ctx, 2); }
    ctx.beginPath(); for (let i = 0; i < 5; i++) { const x = -r * 0.7 + i * r * 0.3, y = (H(i, 2) - 0.5) * r * 0.6; ctx.moveTo(x, y); ctx.lineTo(x + r * 0.12, y + r * 0.1); ctx.lineTo(x + r * 0.08, y + r * 0.25); }
    ctx.strokeStyle = p2 ? '#ffb347' : '#ff7a3c'; ctx.lineWidth = 2.2; ctx.stroke();
  }
  // head, ears with inner fur, muzzle, nose, fangs
  ball(ctx, r * 0.9, 0, r * 0.6, shade(col, 0.1), la, alpha ? 3.6 : 3, 0.55);
  for (const s of [-1, 1]) { poly(ctx, [[r * 0.8, s * r * 0.4], [r * 0.45, s * r * 0.95], [r * 1.1, s * r * 0.5]]); ctx.fillStyle = lgrad(ctx, r * 0.8, s * r * 0.6, r * 0.3, shade(col, -0.1), la); ctx.fill(); ink(ctx, 2.5); poly(ctx, [[r * 0.8, s * r * 0.48], [r * 0.58, s * r * 0.82], [r * 1.0, s * r * 0.54]]); ctx.fillStyle = 'rgba(240,150,150,.55)'; ctx.fill(); }
  oval(ctx, r * 1.3, 0, r * 0.32, r * 0.26, shade(col, 0.25), la, 2.4, 0, 0.4);
  circle(ctx, r * 1.55, 0, r * 0.11 + 1, INK, 0); circle(ctx, r * 1.57, -1, 0.9, '#fff', 0);
  for (const s of [-1, 1]) { poly(ctx, [[r * 1.42, s * r * 0.12], [r * 1.5, s * r * 0.22], [r * 1.36, s * r * 0.2]]); ctx.fillStyle = '#fff8e6'; ctx.fill(); }
  if (alpha) { glow(ctx, r * 1.05, -r * 0.22, p2 ? '#ff5a2a' : '#ffcf3a', r * 0.35); glow(ctx, r * 1.05, r * 0.22, p2 ? '#ff5a2a' : '#ffcf3a', r * 0.35); }
  eyes2(ctx, r * 1.05, r * 0.22, Math.max(2.2, r * 0.12), alpha ? (p2 ? '#ff6a3c' : '#ffe45c') : '#ffe45c');
  if (alpha) { ctx.beginPath(); ctx.moveTo(r * 0.7, -r * 0.5); ctx.lineTo(r * 1.0, -r * 0.1); ctx.moveTo(r * 0.78, -r * 0.55); ctx.lineTo(r * 1.06, -r * 0.18); ctx.strokeStyle = 'rgba(255,230,220,.6)'; ctx.lineWidth = 1.6; ctx.stroke(); }
}

/** Grimtusk, the Ashen Warlord: banded war club, fur collar, plated armour, horned helm, tusks, ember eyes. */
function grimtusk(ctx, e, t, col) {
  const la = lightLocal(e), r = e.r, rage = e.phase === 3;
  if (rage) glow(ctx, 0, 0, '#ff3b1f', r * 1.5);
  let sw = 0.8;
  if (e.state === 'slam') sw = e.st < 50 ? 0.8 - Math.min(1, e.st / 40) * 2.2 : 0.1;
  if (e.state === 'charge') sw = 0.2;
  ctx.save(); ctx.translate(Math.cos(sw) * r * 0.9, Math.sin(sw) * r * 0.9); ctx.rotate(sw * 0.7);
  rrect(ctx, -6, -9, 80, 18, 9); ctx.fillStyle = lgrad(ctx, 34, 0, 20, '#6d4a2c', la - sw * 1.7 - 1.2); ctx.fill(); ink(ctx, 4);
  ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(2 + i * 13, -5); ctx.quadraticCurveTo(8 + i * 13, 0, 2 + i * 13, 5); } ctx.strokeStyle = 'rgba(40,20,10,.45)'; ctx.lineWidth = 1.4; ctx.stroke();
  for (const bx of [16, 44]) { rrect(ctx, bx, -10, 6, 20, 2); ctx.fillStyle = '#8d93a6'; ctx.fill(); ink(ctx, 2); }
  ball(ctx, 76, 0, 20, '#5a3d24', la - sw * 1.7, 4, 0.45);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.beginPath(); ctx.moveTo(76 + Math.cos(a) * 18, Math.sin(a) * 18); ctx.lineTo(76 + Math.cos(a) * 29, Math.sin(a) * 29); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.restore();
  for (const s of [-1, 1]) ball(ctx, r * 0.55, s * r * 0.8, r * 0.3, '#b98c6a', la, 3.5, 0.5);
  // body: plated cuirass over a fur collar
  oval(ctx, -r * 0.1, 0, r * 0.85, r, col, la, 5, 0, 0.55);
  ctx.save(); ctx.beginPath(); ctx.ellipse(-r * 0.1, 0, r * 0.85, r, 0, 0, TAU); ctx.clip();
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-r * 0.1 - i * r * 0.22, 0, r * 0.3, r * 1.1, 0, -1.2, 1.2); ctx.strokeStyle = 'rgba(30,20,40,.35)'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
  fur(ctx, r * 0.05, 0, r * 0.62, 34, '#5a4632', r * 0.16, 11, 2.4);
  fur(ctx, r * 0.05, 0, r * 0.55, 14, 'rgba(255,240,210,.35)', r * 0.12, 13, 1.4);
  for (const s of [-1, 1]) {
    ball(ctx, -r * 0.05, s * r * 0.72, r * 0.38, '#474a5e', la, 4.5, 0.7);
    for (let i = 0; i < 3; i++) { const a = s * (0.8 + i * 0.5); ctx.beginPath(); ctx.moveTo(-r * 0.05 + Math.cos(a) * r * 0.3, s * r * 0.72 + Math.sin(a) * r * 0.3); ctx.lineTo(-r * 0.05 + Math.cos(a) * r * 0.62, s * r * 0.72 + Math.sin(a) * r * 0.62); ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = '#d6dae3'; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.3; ctx.stroke(); }
  }
  ball(ctx, r * 0.25, 0, r * 0.45, '#9b7fb4', la, 4.5, 0.6);
  ctx.beginPath(); ctx.arc(r * 0.25, 0, r * 0.32, -1.3, 1.3); ctx.strokeStyle = 'rgba(40,25,60,.45)'; ctx.lineWidth = 2; ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(r * 0.1, s * r * 0.3); ctx.quadraticCurveTo(-r * 0.3, s * r * 0.9, r * 0.2, s * r * 1.05); ctx.quadraticCurveTo(-r * 0.05, s * r * 0.6, r * 0.3, s * r * 0.38); ctx.closePath(); ctx.fillStyle = lgrad(ctx, 0, s * r * 0.7, r * 0.4, '#f1e6cf', la); ctx.fill(); ink(ctx, 3.5);
    ctx.beginPath(); for (let i = 1; i < 4; i++) { const k = i / 4; ctx.moveTo(r * (0.1 - 0.25 * k), s * r * (0.35 + 0.5 * k)); ctx.lineTo(r * (0.22 - 0.2 * k), s * r * (0.32 + 0.45 * k)); } ctx.strokeStyle = 'rgba(120,100,70,.55)'; ctx.lineWidth = 1.3; ctx.stroke();
    poly(ctx, [[r * 0.55, s * r * 0.12], [r * 0.82, s * r * 0.24], [r * 0.58, s * r * 0.26]]); ctx.fillStyle = '#fff8e6'; ctx.fill(); ink(ctx, 3);
  }
  const ec = rage ? '#ff3b1f' : '#ffcf3a';
  glow(ctx, r * 0.45, -r * 0.16, ec, 12); glow(ctx, r * 0.45, r * 0.16, ec, 12);
  circle(ctx, r * 0.45, -r * 0.16, 5, ec, 0); circle(ctx, r * 0.45, r * 0.16, 5, ec, 0);
  circle(ctx, r * 0.47, -r * 0.17, 1.8, '#fff6d0', 0); circle(ctx, r * 0.47, r * 0.15, 1.8, '#fff6d0', 0);
}

/** Thornmaw, the Elder Treant: a bark-plated trunk crowned with leafy clumps, swaying root legs, ember-green eyes;
 *  phase 2: thorns burst out and the eyes turn red. */
function thornmaw(ctx, e, t, col) {
  const la = lightLocal(e), r = e.r, p2 = e.phase >= 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2, sw = Math.sin(t * 2.2 + i * 1.3) * 0.12, L = r * (1.35 + (i % 2) * 0.2);
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); ctx.quadraticCurveTo(Math.cos(a + 0.3 + sw) * L * 0.75, Math.sin(a + 0.3 + sw) * L * 0.75, Math.cos(a + sw) * L, Math.sin(a + sw) * L);
    ctx.strokeStyle = INK; ctx.lineWidth = 15; ctx.stroke(); ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 10; ctx.stroke(); ctx.strokeStyle = 'rgba(255,220,170,.25)'; ctx.lineWidth = 2.5; ctx.stroke();
  }
  // leafy crown clumps around the trunk
  for (let i = 0; i < 11; i++) { const a = (i / 11) * TAU + 0.15, d = r * 0.82; ball(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.34, i % 3 ? col : shade(col, 0.15), la, 3, 0.5); fur(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.24, 4, 'rgba(20,50,20,.45)', 4, i, 1.3); }
  if (p2) for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; poly(ctx, [[Math.cos(a - 0.06) * r * 0.95, Math.sin(a - 0.06) * r * 0.95], [Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3], [Math.cos(a + 0.06) * r * 0.95, Math.sin(a + 0.06) * r * 0.95]]); ctx.fillStyle = '#d9c9a0'; ctx.fill(); ink(ctx, 2); }
  // trunk: bark plates
  const pts = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, rr = r * 0.66 * (0.9 + H(i, 3) * 0.18); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  poly(ctx, pts); ctx.fillStyle = lgrad(ctx, 0, 0, r * 0.66, '#7a5232', la); ctx.fill(); ink(ctx, 5);
  ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + 0.13; ctx.moveTo(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18); ctx.quadraticCurveTo(Math.cos(a + 0.2) * r * 0.4, Math.sin(a + 0.2) * r * 0.4, Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); } ctx.strokeStyle = 'rgba(40,20,10,.5)'; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, r * (0.12 + i * 0.1), 0, TAU); ctx.strokeStyle = 'rgba(40,20,10,.35)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  rimPoly(ctx, pts, 0, 0, 0.9);
  ctx.beginPath(); ctx.ellipse(-r * 0.25, r * 0.2, r * 0.18, r * 0.1, 0.5, 0, TAU); ctx.fillStyle = 'rgba(110,170,70,.7)'; ctx.fill();
  // face: a knot mouth + two eyes facing forward
  const ec = p2 ? '#ff5a3a' : '#c6ff5c';
  glow(ctx, r * 0.36, -r * 0.18, ec, r * 0.3); glow(ctx, r * 0.36, r * 0.18, ec, r * 0.3);
  ellipse(ctx, r * 0.36, -r * 0.18, r * 0.09, r * 0.06, ec, 2); ellipse(ctx, r * 0.36, r * 0.18, r * 0.09, r * 0.06, ec, 2);
  ctx.beginPath(); ctx.ellipse(r * 0.5, 0, r * 0.06, r * 0.14, 0, 0, TAU); ctx.fillStyle = '#2a160c'; ctx.fill(); ink(ctx, 2);
}

/** Ankhara, the Glass Scorpion: segmented fused-glass body, 8 legs, two pincers and an arcing tail with a lit stinger. */
function ankhara(ctx, e, t, col) {
  const la = lightLocal(e), r = e.r, p2 = e.phase >= 2, glass = 'rgba(120,230,235,.92)';
  const step = Math.sin(t * 10 + e.id);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const bx = r * (0.35 - i * 0.3), a = s * (1.2 + i * 0.22) + step * 0.12 * (i % 2 ? 1 : -1), L = r * 0.95;
    const kx = bx + Math.cos(a) * L * 0.55, ky = Math.sin(a) * L * 0.55, ex = kx + Math.cos(a - s * 0.6) * L * 0.6, ey = ky + Math.sin(a - s * 0.6) * L * 0.6;
    ctx.beginPath(); ctx.moveTo(bx, s * r * 0.2); ctx.lineTo(kx, ky); ctx.lineTo(ex, ey); ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = '#3aa8b4'; ctx.lineWidth = 4.5; ctx.stroke(); ctx.strokeStyle = 'rgba(230,255,255,.6)'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  // tail: 5 segments arcing back over the body
  const ts = e.state === 'lines' ? Math.min(1, e.st / 20) : 0;
  let px = -r * 0.7, py = 0;
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i - 1) * 0.55 * (1 - ts * 0.5), d = r * 0.32;
    px += Math.cos(a) * d * (i < 2 ? 1 : -0.6); py += Math.sin(a) * d * 0.8;
    ball(ctx, px, py, r * (0.26 - i * 0.025), col, la, 3, 0.6);
  }
  const sc = p2 ? '#ff5ce1' : '#fff3a0';
  glow(ctx, px + r * 0.15, py, sc, r * 0.45);
  poly(ctx, [[px, py - r * 0.1], [px + r * 0.38, py], [px, py + r * 0.1]]); ctx.fillStyle = sc; ctx.fill(); ink(ctx, 2.4);
  // pincers
  for (const s of [-1, 1]) {
    const open = 0.3 + Math.sin(t * 3 + s) * 0.08 + (e.state === 'fan' ? 0.2 : 0);
    ctx.save(); ctx.translate(r * 0.7, s * r * 0.45); ctx.rotate(s * 0.35);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.45, 0); ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.stroke(); ctx.strokeStyle = '#3aa8b4'; ctx.lineWidth = 7; ctx.stroke();
    oval(ctx, r * 0.58, 0, r * 0.26, r * 0.18, col, la - s * 0.35, 3, 0, 0.6);
    for (const k of [-1, 1]) { ctx.save(); ctx.translate(r * 0.75, k * r * 0.06); ctx.rotate(k * open); poly(ctx, [[0, -r * 0.06], [r * 0.38, 0], [0, r * 0.06]]); ctx.fillStyle = glass; ctx.fill(); ink(ctx, 2.4); ctx.restore(); }
    ctx.restore();
  }
  // body: segmented carapace with glass facets
  for (let i = 0; i < 4; i++) {
    const x = r * (0.3 - i * 0.3), w = r * (0.5 - i * 0.06), h = r * (0.48 - i * 0.05);
    oval(ctx, x, 0, w, h, i % 2 ? shade(col, -0.08) : col, la, 3.5, 0, 0.65);
    ctx.beginPath(); ctx.moveTo(x - w * 0.6, -h * 0.5); ctx.lineTo(x + w * 0.2, 0); ctx.lineTo(x - w * 0.6, h * 0.5); ctx.strokeStyle = 'rgba(230,255,255,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - w * 0.3, -h * 0.6); ctx.lineTo(x + w * 0.3, -h * 0.3); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.8; ctx.stroke();
  }
  for (let i = 0; i < 3; i++) star(ctx, r * (0.2 - i * 0.35), -r * 0.2 + i * 4, 2.6, '#ffffff', 0);
  for (const s of [-1, 1]) { glow(ctx, r * 0.62, s * r * 0.14, p2 ? '#ff5ce1' : '#9ff3ff', 7); circle(ctx, r * 0.62, s * r * 0.14, 2.6, p2 ? '#ff5ce1' : '#e9ffff', 1.2); }
}

/** Sekhem, the Sun Colossus: a sandstone giant with gold-banded arms, glyph-carved plates and a blazing sun-disc head. */
function sekhem(ctx, e, t, col) {
  const la = lightLocal(e), r = e.r, p2 = e.phase >= 2, slam = e.state === 'slam' ? Math.min(1, e.st / 40) : 0;
  glow(ctx, r * 0.15, 0, p2 ? '#ff7a2a' : '#ffcf4a', r * (1.1 + 0.08 * Math.sin(t * 3)));
  // arms + fists
  for (const s of [-1, 1]) {
    const fx = r * (0.75 + slam * 0.25), fy = s * r * 0.95;
    ctx.beginPath(); ctx.moveTo(0, s * r * 0.6); ctx.lineTo(fx, fy); ctx.strokeStyle = INK; ctx.lineWidth = r * 0.42 + 6; ctx.stroke(); ctx.strokeStyle = '#c99a5e'; ctx.lineWidth = r * 0.42; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx * 0.45, s * r * 0.78); ctx.lineTo(fx * 0.55, s * r * 0.8); ctx.strokeStyle = '#e8c35a'; ctx.lineWidth = r * 0.44; ctx.stroke();
    const pts = []; for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, rr = r * 0.32 * (0.9 + H(i, s + 2) * 0.2); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    poly(ctx, pts, fx, fy); ctx.fillStyle = lgrad(ctx, fx, fy, r * 0.32, '#d4a56a', la); ctx.fill(); ink(ctx, 3.5);
  }
  // shoulders / torso plates with glyphs
  oval(ctx, -r * 0.1, 0, r * 0.62, r * 0.82, col, la, 5, 0, 0.6);
  for (const s of [-1, 1]) { oval(ctx, -r * 0.05, s * r * 0.58, r * 0.34, r * 0.28, shade(col, 0.08), la, 3.5, 0, 0.6); ctx.beginPath(); ctx.ellipse(-r * 0.05, s * r * 0.58, r * 0.34, r * 0.28, 0, 0, TAU); ctx.strokeStyle = '#e8c35a'; ctx.lineWidth = 2.4; ctx.stroke(); }
  ctx.beginPath(); for (let i = -2; i <= 2; i++) { ctx.moveTo(-r * 0.5, i * r * 0.14); ctx.lineTo(-r * 0.25, i * r * 0.16); } ctx.strokeStyle = 'rgba(80,45,20,.45)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.3); ctx.lineTo(-r * 0.25, -r * 0.05); ctx.lineTo(-r * 0.35, r * 0.2); ctx.strokeStyle = p2 ? '#ff8a3c' : 'rgba(80,45,20,.55)'; ctx.lineWidth = 2.2; ctx.stroke();
  // sun-disc head: rays, gold disc, face mask
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + t * 0.6; poly(ctx, [[r * 0.2 + Math.cos(a - 0.12) * r * 0.36, Math.sin(a - 0.12) * r * 0.36], [r * 0.2 + Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62], [r * 0.2 + Math.cos(a + 0.12) * r * 0.36, Math.sin(a + 0.12) * r * 0.36]]); ctx.fillStyle = i % 2 ? '#ffcf4a' : '#ff9a3c'; ctx.fill(); ink(ctx, 2); }
  ball(ctx, r * 0.2, 0, r * 0.38, p2 ? '#ff9a3c' : '#ffcf4a', la, 4, 0.75);
  ctx.beginPath(); ctx.arc(r * 0.2, 0, r * 0.27, 0, TAU); ctx.strokeStyle = 'rgba(150,80,10,.5)'; ctx.lineWidth = 2; ctx.stroke();
  for (const s of [-1, 1]) { ellipse(ctx, r * 0.32, s * r * 0.11, r * 0.07, r * 0.045, INK, 0); circle(ctx, r * 0.33, s * r * 0.11, r * 0.025 + 1, '#fff6c8', 0); }
  ctx.beginPath(); ctx.moveTo(r * 0.42, -r * 0.05); ctx.lineTo(r * 0.48, 0); ctx.lineTo(r * 0.42, r * 0.05); ctx.strokeStyle = 'rgba(120,60,10,.6)'; ctx.lineWidth = 1.6; ctx.stroke();
}
