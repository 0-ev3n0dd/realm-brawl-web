import { drawCore } from './fissurefx.js';
// Procedural "ZombsRoyale-style" art: flat bright colours, chunky dark outlines, soft shadows.
import { APPEARANCE } from '../sim/data/classes.js';

export const INK = '#2b2433';
const TAU = Math.PI * 2;

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function circle(ctx, x, y, r, fill, lw = 3.5, stroke = INK) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}
export function ellipse(ctx, x, y, rx, ry, fill, lw = 3.5, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); }
}
export function shadow(ctx, x, y, rx, ry = rx * 0.5, a = 0.22) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = `rgba(20,30,20,${a})`; ctx.fill();
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export { rrect };
import { sprite, blit, LitBuffer, glowSprite, spriteBudget, whiteOf, flashK } from './sprite.js';
import { kickOf } from './feel.js';
const CAN_BUF = typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined';
const FLASH_BUF = new LitBuffer();
import { drawHeroCore, drawHeroLegs, drawHeroCape, drawHeroTails, heroFlashShape, heroGlove, heroSleeve, heroArm, walkK, heroEyeLocal, heroEyesHidden } from './herobody.js';
import { easeInOutSine, easeOutBack, easeOutCubic, smoothstep } from './smooth.js';
import { drawPaintedEnemy, paintedEnemyReady, enemyTop, ENEMY_ENV } from './enemypaint.js';
import { REC, heroArt, paintedReady, requestHeroArt, drawPaintedHero, drawHeroPortrait, recordGear } from './heropaint.js';
const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

// ------------------------------------------------------------------ hero
export function heroColors(app) {
  return {
    skin: APPEARANCE.skin[app.skin % APPEARANCE.skin.length],
    hair: APPEARANCE.hairColors[app.hairColor % APPEARANCE.hairColors.length],
    style: APPEARANCE.hairStyles[app.hairStyle % APPEARANCE.hairStyles.length],
    outfit: APPEARANCE.outfits[app.outfit % APPEARANCE.outfits.length],
  };
}

export function drawHair(ctx, style, color) {
  ctx.fillStyle = color; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  switch (style) {
    case 'short':
      ctx.beginPath(); ctx.arc(-1, 0, 12.5, Math.PI * 0.42, Math.PI * 1.58); ctx.quadraticCurveTo(4, 0, -1 + Math.cos(Math.PI * 0.42) * 12.5, Math.sin(Math.PI * 0.42) * 12.5); ctx.fill(); ctx.stroke();
      break;
    case 'spiky': {
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI * 0.35 + (i / 12) * Math.PI * 1.3;
        const r = i % 2 ? 11 : 16.5;
        const x = -2 + Math.cos(a) * r, y = Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.quadraticCurveTo(3, 0, -2 + Math.cos(Math.PI * 0.35) * 11, Math.sin(Math.PI * 0.35) * 11);
      ctx.fill(); ctx.stroke();
      break;
    }
    case 'long':
      ctx.beginPath(); ctx.moveTo(2, -12); ctx.quadraticCurveTo(-20, -18, -24, 0); ctx.quadraticCurveTo(-20, 18, 2, 12); ctx.quadraticCurveTo(-4, 0, 2, -12); ctx.fill(); ctx.stroke();
      break;
    case 'mohawk':
      rrect(ctx, -15, -4, 22, 8, 4); ctx.fill(); ctx.stroke();
      break;
    case 'bun':
      ctx.beginPath(); ctx.arc(-1, 0, 12.5, Math.PI * 0.45, Math.PI * 1.55); ctx.quadraticCurveTo(3, 0, -1 + Math.cos(Math.PI * 0.45) * 12.5, Math.sin(Math.PI * 0.45) * 12.5); ctx.fill(); ctx.stroke();
      circle(ctx, -14, 0, 6.5, color, 3);
      break;
    case 'bald':
      ctx.beginPath(); ctx.ellipse(-3, -4, 4, 2.5, -0.5, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill();
      break;
  }
}

/** Weapon glow without shadowBlur (perf pass 2): one cached radial sprite stretched along the weapon from x0 to x1. */
function weaponGlow(ctx, col, x0, x1, w = 13) {
  if (typeof col !== 'string' || !/^#[0-9a-f]{6}$/i.test(col)) return;
  const c = glowSprite(col, 32), a = ctx.globalAlpha; ctx.globalAlpha = a * 0.6;
  ctx.drawImage(c, x0 - 10, -w, x1 - x0 + 20, w * 2); ctx.globalAlpha = a;
}
/** Cached soft glow (no shadowBlur); silently skipped for non-#rrggbb colours. */
function softGlow(ctx, x, y, col, r) { if (typeof col === 'string' && /^#[0-9a-f]{6}$/i.test(col)) blit(ctx, glowSprite(col, r), x, y); }
export function drawSword(ctx, len = 40, glow = null) {
  if (REC.on) return REC.w(ctx, 'sword', len, glow);
  // along +x from origin (hand)
  ctx.lineJoin = 'round';
  if (glow) { ctx.save(); weaponGlow(ctx, glow, 0, len + 8); }
  ctx.beginPath(); ctx.moveTo(6, -4.5); ctx.lineTo(len, -3.5); ctx.lineTo(len + 8, 0); ctx.lineTo(len, 3.5); ctx.lineTo(6, 4.5); ctx.closePath();
  ctx.fillStyle = '#e9eef5'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  if (glow) ctx.restore();
  // art pass: shaded lower bevel, bright upper edge, fuller line, tip glint, wrapped grip, pommel
  ctx.beginPath(); ctx.moveTo(8, 0.6); ctx.lineTo(len + 2, 0.4); ctx.lineTo(len, 3.1); ctx.lineTo(7, 3.6); ctx.closePath(); ctx.fillStyle = 'rgba(120,140,170,.35)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(9, -3.3); ctx.lineTo(len - 1, -2.5); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(len + 2, 0); ctx.strokeStyle = 'rgba(160,175,195,.9)'; ctx.lineWidth = 1.6; ctx.stroke();
  circle(ctx, len + 3.5, -0.8, 1.2, '#ffffff', 0);
  rrect(ctx, 2, -9, 5, 18, 2); ctx.fillStyle = '#f2b632'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = '#ffe9a0'; ctx.fillRect(3, -7.5, 1.4, 15); circle(ctx, 4.5, 0, 1.6, '#c8323f', 0);
  rrect(ctx, -8, -2.5, 11, 5, 2); ctx.fillStyle = '#7a4a2a'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); for (let i = -6; i < 2; i += 2.6) { ctx.moveTo(i, -2.3); ctx.lineTo(i + 1.4, 2.3); } ctx.strokeStyle = '#4a2c1a'; ctx.lineWidth = 1; ctx.stroke();
  circle(ctx, -9, 0, 2.8, '#f2b632', 2);
}
/** A throwing hatchet along +x from the hand: short wooden haft (leather grip, butt knob) and a compact bearded single-bit head
 *  at the tip. side = +1 puts the blade on +y, -1 on -y (the two hands are mirrored so each blade faces inward, toward the body's centre line). */
function drawHatchet(ctx, len = 22, glow = null, side = 1) {
  if (REC.on) return REC.w(ctx, 'hatchet', len, glow, side);
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (side < 0) ctx.scale(1, -1);
  // haft + knob + grip wrap
  rrect(ctx, -5, -2.4, len + 8, 4.8, 2.4); ctx.fillStyle = '#9a6538'; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(len * 0.35, -0.6); ctx.lineTo(len - 2, -0.9); ctx.strokeStyle = 'rgba(80,45,20,.55)'; ctx.lineWidth = 1; ctx.stroke();
  circle(ctx, -5.5, 0, 3.1, '#6e4222', 2.2);
  rrect(ctx, 0, -2.9, 9, 5.8, 1.5); ctx.fillStyle = '#4a2c1a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, -2.6); ctx.lineTo(1.5, 2.6); ctx.moveTo(6.5, -2.6); ctx.lineTo(5, 2.6); ctx.strokeStyle = '#7a5236'; ctx.lineWidth = 1.2; ctx.stroke();
  // poll: a small flat block on the back of the head (single-bit: the only blade is on +y)
  const x0 = len - 1;
  rrect(ctx, x0 - 3, -5, 6, 3.4, 1); ctx.fillStyle = '#8f99a8'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  // compact bearded blade on +y
  if (glow) { ctx.save(); weaponGlow(ctx, glow, len - 8, len + 8); }
  ctx.beginPath(); ctx.moveTo(x0 - 3.5, 1.8); ctx.lineTo(x0 - 3.5, 6.5);
  ctx.quadraticCurveTo(x0 - 5, 10.5, x0 - 8, 13.5);    // short beard hooking back toward the hand
  ctx.quadraticCurveTo(x0 - 0.5, 17, x0 + 6, 13);      // curved cutting edge
  ctx.quadraticCurveTo(x0 + 3.5, 7, x0 + 3.5, 1.8); ctx.closePath();
  ctx.fillStyle = '#dde4ec'; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke();
  if (glow) ctx.restore();
  ctx.beginPath(); ctx.moveTo(x0 - 6.5, 13.3); ctx.quadraticCurveTo(x0 - 0.5, 15.6, x0 + 4.6, 12.4); ctx.strokeStyle = glow || '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); // bright edge
  ctx.beginPath(); ctx.moveTo(x0 - 1.5, 5); ctx.quadraticCurveTo(x0 + 0.5, 8, x0 + 1.8, 5); ctx.strokeStyle = 'rgba(120,130,145,.8)'; ctx.lineWidth = 1.2; ctx.stroke(); // cheek bevel
  rrect(ctx, x0 - 6.8, -3.1, 3, 6.2, 1); ctx.fillStyle = '#c8323f'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke(); // red wrap under the head
  ctx.restore();
}
export function drawHammer(ctx, len = 40, glow = null) {
  if (REC.on) return REC.w(ctx, 'hammer', len, glow);
  ctx.lineJoin = 'round';
  rrect(ctx, -10, -2.8, len + 4, 5.6, 2.5); ctx.fillStyle = '#6a4024'; ctx.fill(); ctx.lineWidth = 2.8; ctx.strokeStyle = INK; ctx.stroke();
  if (glow) { ctx.save(); weaponGlow(ctx, glow, len - 8, len + 12); }
  rrect(ctx, len - 6, -13, 16, 26, 3); ctx.fillStyle = '#b9c2cf'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  if (glow) ctx.restore();
  rrect(ctx, len - 4, -13, 3, 26, 1); ctx.fillStyle = '#f2b632'; ctx.fill();
  // art pass: lit face, shaded underside, rivets, haft grain + grip
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(len + 1, -11, 7, 3.2);
  ctx.fillStyle = 'rgba(40,50,80,.28)'; ctx.fillRect(len - 1, 6, 9, 5);
  for (const yy of [-8, 8]) circle(ctx, len + 5, yy, 1.3, '#5d6675', 0);
  ctx.beginPath(); ctx.moveTo(-4, -0.8); ctx.lineTo(len - 8, -1); ctx.strokeStyle = 'rgba(255,220,170,.35)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); for (let i = -8; i < 2; i += 2.6) { ctx.moveTo(i, -2.6); ctx.lineTo(i + 1.4, 2.6); } ctx.strokeStyle = '#3a2214'; ctx.lineWidth = 1; ctx.stroke();
}
/** The Summoner's grimoire: a thick leather book with gold corners, a teal rune on the cover, pages fanned when open. */
export function drawGrimoire(ctx, open = 0, t = 0, glow = null) {
  if (REC.on) return REC.w(ctx, 'book', 0, glow, open);
  const o = Math.max(0, Math.min(1, open));
  if (glow) { ctx.save(); weaponGlow(ctx, glow, -2, 18); }
  // back cover + page block + front cover hinged on the spine (x = 0)
  rrect(ctx, -2, -11, 20, 22, 3); ctx.fillStyle = '#3a1f4a'; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
  rrect(ctx, 0, -9.5, 16.5, 19, 2); ctx.fillStyle = '#f4ecd6'; ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke();
  if (glow) ctx.restore();
  ctx.strokeStyle = 'rgba(120,100,70,.6)'; ctx.lineWidth = 1; for (const yy of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(3, yy); ctx.lineTo(14, yy); ctx.stroke(); }
  const fw = 20 * (1 - o * 1.6); // the front cover swings open (foreshortened)
  ctx.beginPath(); ctx.moveTo(-2, -11); ctx.lineTo(-2 + fw, -11 - o * 4); ctx.lineTo(-2 + fw, 11 + o * 4); ctx.lineTo(-2, 11); ctx.closePath(); ctx.fillStyle = '#4a2a5e'; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
  if (o < 0.5) { ctx.beginPath(); ctx.arc(-2 + fw * 0.5, 0, 4, 0, Math.PI * 2); ctx.strokeStyle = glow || '#3ff0c8'; ctx.lineWidth = 1.8; ctx.stroke(); ctx.beginPath(); ctx.moveTo(-2 + fw * 0.5, -4); ctx.lineTo(-2 + fw * 0.5, 4); ctx.stroke(); }
  ctx.fillStyle = '#f2b632'; for (const [cx, cy] of [[-2 + fw, -11 - o * 4], [-2 + fw, 11 + o * 4]]) { ctx.beginPath(); ctx.arc(cx, cy, 2.2, 0, Math.PI * 2); ctx.fill(); }
  if (o > 0.3) for (let i = 0; i < 2; i++) { const fa = ((t * 3 + i * 0.5) % 1) * Math.PI; ctx.save(); ctx.globalAlpha *= 0.8; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(Math.cos(fa) * 15, -9 - Math.sin(fa) * 5); ctx.lineTo(Math.cos(fa) * 15, 9 - Math.sin(fa) * 5); ctx.lineTo(0, 9); ctx.closePath(); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.restore(); }
}
/** The Bard's lute: a pear-shaped body with a rosette, a long neck with tuning pegs, glinting strings. */
export function drawLute(ctx, strum = 0, glow = null) {
  if (REC.on) return REC.w(ctx, 'lute', 0, glow, strum);
  if (glow) { ctx.save(); weaponGlow(ctx, glow, -6, 30); }
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.bezierCurveTo(-14, -12, 2, -11, 6, -5); ctx.lineTo(6, 5); ctx.bezierCurveTo(2, 11, -14, 12, -14, 0); ctx.closePath();
  const g = ctx.createLinearGradient(-14, -10, 6, 10); g.addColorStop(0, '#d9893a'); g.addColorStop(1, '#8a4a1a'); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2.8; ctx.strokeStyle = INK; ctx.stroke();
  if (glow) ctx.restore();
  ctx.beginPath(); ctx.arc(-5, 0, 3.4, 0, Math.PI * 2); ctx.fillStyle = '#3a1a08'; ctx.fill(); ctx.strokeStyle = '#f2b632'; ctx.lineWidth = 1.2; ctx.stroke();
  rrect(ctx, 5, -2.2, 22, 4.4, 1.5); ctx.fillStyle = '#5a3018'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(27, -2.5); ctx.lineTo(33, -4.5); ctx.lineTo(33, 4.5); ctx.lineTo(27, 2.5); ctx.closePath(); ctx.fillStyle = '#5a3018'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f2b632'; for (const px of [29, 31.5]) { ctx.beginPath(); ctx.arc(px, -5, 1.3, 0, Math.PI * 2); ctx.arc(px, 5, 1.3, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = glow || '#fff6e0'; ctx.lineWidth = 0.8;
  for (const yy of [-1.2, 0, 1.2]) { ctx.beginPath(); ctx.moveTo(-11, yy); ctx.quadraticCurveTo(-5, yy + Math.sin(strum * 40 + yy) * strum * 2.5, 30, yy * 1.4); ctx.stroke(); }
}
function drawStaff(ctx, orb, t) {
  if (REC.on) return REC.w(ctx, 'staff', 0, orb);
  rrect(ctx, -14, -2.8, 50, 5.6, 2.8); ctx.fillStyle = '#8a5a35'; ctx.fill(); ctx.lineWidth = 2.8; ctx.strokeStyle = INK; ctx.stroke();
  softGlow(ctx, 40, 0, orb, 20); ctx.save();
  circle(ctx, 40, 0, 7 + Math.sin(t * 6) * 0.8, orb, 3);
  ctx.restore();
  circle(ctx, 38, -2, 2.2, 'rgba(255,255,255,.85)', 0);
  ctx.beginPath(); ctx.moveTo(33, -6); ctx.lineTo(36, 0); ctx.lineTo(33, 6); ctx.strokeStyle = '#f2b632'; ctx.lineWidth = 3; ctx.stroke();
}
export function drawBow(ctx, pull) {
  if (REC.on) return REC.w(ctx, 'bow', 0, null, pull);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(14, -20); ctx.quadraticCurveTo(-4 - pull, 0, 14, 20); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, -20); ctx.quadraticCurveTo(32, 0, 14, 20);
  ctx.strokeStyle = INK; ctx.lineWidth = 7.5; ctx.stroke();
  ctx.strokeStyle = '#a0632f'; ctx.lineWidth = 4; ctx.stroke();
  if (pull > 1) { // nocked arrow
    ctx.beginPath(); ctx.moveTo(4 - pull, 0); ctx.lineTo(30, 0); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = '#e6d3a3'; ctx.lineWidth = 2; ctx.stroke();
  }
}

function drawMace(ctx, len = 34, glow = null) {
  if (REC.on) return REC.w(ctx, 'mace', len, glow);
  // along +x from origin (hand): wooden haft + spiked steel head with a gold band
  ctx.lineJoin = 'round';
  rrect(ctx, -8, -2.8, len - 2, 5.6, 2.8); ctx.fillStyle = '#8a5a35'; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
  if (glow) { ctx.save(); weaponGlow(ctx, glow, len - 10, len + 8); }
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, r = i % 2 ? 7.5 : 11.5; ctx.lineTo(len + 4 + Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fillStyle = '#c9d2dd'; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
  if (glow) ctx.restore();
  circle(ctx, len + 4, 0, 5, '#e9eef5', 2.2);
  circle(ctx, len + 2.5, -1.5, 1.6, 'rgba(255,255,255,.9)', 0);
  rrect(ctx, len - 7, -4, 4, 8, 1.5); ctx.fillStyle = '#f2b632'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
}
function drawShield(ctx, r = 11, glow = null) {
  if (REC.on) return REC.w(ctx, 'shield', r, glow);
  // round kite-ish shield seen from above: gold rim, white face, golden cross
  if (glow) { ctx.save(); weaponGlow(ctx, glow, -r, r); }
  circle(ctx, 0, 0, r, '#f2b632', 3);
  if (glow) ctx.restore();
  circle(ctx, 0, 0, r - 3.2, '#f7f3e8', 0);
  ctx.beginPath(); ctx.moveTo(-r * 0.55, 0); ctx.lineTo(r * 0.55, 0); ctx.moveTo(0, -r * 0.55); ctx.lineTo(0, r * 0.55);
  ctx.strokeStyle = '#e0a21f'; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.stroke();
  circle(ctx, -r * 0.35, -r * 0.35, 1.8, 'rgba(255,255,255,.9)', 0);
}
function drawDagger(ctx, len = 22, glow = null) {
  if (REC.on) return REC.w(ctx, 'dagger', len, glow);
  // short curved blade along +x from the hand
  ctx.lineJoin = 'round';
  if (glow) { ctx.save(); weaponGlow(ctx, glow, 0, len + 4); }
  ctx.beginPath(); ctx.moveTo(5, -3.4); ctx.quadraticCurveTo(len * 0.7, -4.6, len + 5, 1.5); ctx.quadraticCurveTo(len * 0.6, 3.4, 5, 3.4); ctx.closePath();
  ctx.fillStyle = glow ? '#fff4fb' : '#e9eef5'; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
  if (glow) ctx.restore();
  ctx.beginPath(); ctx.moveTo(8, -0.6); ctx.quadraticCurveTo(len * 0.7, -1.4, len + 1, 1); ctx.strokeStyle = 'rgba(160,175,195,.9)'; ctx.lineWidth = 1.3; ctx.stroke();
  rrect(ctx, 1.5, -6, 4, 12, 2); ctx.fillStyle = '#ff5fb0'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
  rrect(ctx, -6, -2.2, 8, 4.4, 2); ctx.fillStyle = '#3b2a44'; ctx.fill(); ctx.stroke();
}

/** Dragoon spear: a long dark haft (crimson grip wraps), a steel leaf blade with a dragon-wing guard and a crimson tassel. Drawn along +x from the grip. */
export function drawSpear(ctx, len = 70, glow = null, back = 26) {
  if (REC.on) return REC.w(ctx, 'spear', len, glow, back);
  ctx.save(); ctx.lineCap = 'round';
  if (glow) { weaponGlow(ctx, glow, 0, len + 10); }
  ctx.beginPath(); ctx.moveTo(-back, 0); ctx.lineTo(len, 0); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke();
  ctx.strokeStyle = '#2b2350'; ctx.lineWidth = 4; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#c4243f'; ctx.lineWidth = 4.4; for (const x0 of [-6, 4, 14]) { ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 3, 0); ctx.stroke(); }
  circle(ctx, -back, 0, 3.2, '#8f7cff', 2); // pommel
  // dragon-wing guard
  ctx.beginPath(); ctx.moveTo(len - 4, 0); ctx.lineTo(len - 10, -8); ctx.lineTo(len - 2, -3); ctx.lineTo(len + 2, 0); ctx.lineTo(len - 2, 3); ctx.lineTo(len - 10, 8); ctx.closePath(); ctx.fillStyle = '#6b55e0'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  // leaf blade
  ctx.beginPath(); ctx.moveTo(len, 0); ctx.quadraticCurveTo(len + 8, -6, len + 22, 0); ctx.quadraticCurveTo(len + 8, 6, len, 0); ctx.closePath();
  if (glow) { weaponGlow(ctx, glow, -back, 0); }
  ctx.fillStyle = '#e9ecff'; ctx.fill(); ctx.shadowBlur = 0; ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(len + 2, 0); ctx.lineTo(len + 18, 0); ctx.strokeStyle = glow || '#ff3b5c'; ctx.lineWidth = 1.4; ctx.stroke();
  // tassel
  ctx.beginPath(); ctx.moveTo(len - 8, 2); ctx.quadraticCurveTo(len - 14, 10, len - 20, 13); ctx.strokeStyle = '#e0283f'; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
}
function drawKatana(ctx, len = 46, glow = null) {
  if (REC.on) return REC.w(ctx, 'katana', len, glow);
  // a slim, gently curved katana along +x from the hand: wrapped tsuka behind, round gold tsuba, silver blade with a hamon line
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  rrect(ctx, -9, -2.4, 12, 4.8, 2); ctx.fillStyle = '#2a1a33'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = '#ff8cc6'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-7 + i * 3.6, 0); ctx.lineTo(-5.2 + i * 3.6, -1.8); ctx.lineTo(-3.4 + i * 3.6, 0); ctx.lineTo(-5.2 + i * 3.6, 1.8); ctx.fill(); }
  if (glow) { ctx.save(); weaponGlow(ctx, glow, 0, len + 6); }
  ctx.beginPath(); ctx.moveTo(5, -2.6); ctx.quadraticCurveTo(len * 0.55, -4.2, len + 5, -2.4); ctx.lineTo(len + 2, 0.4); ctx.quadraticCurveTo(len * 0.55, 0.2, 5, 2.2); ctx.closePath();
  ctx.fillStyle = glow ? '#fff6fb' : '#e8eef7'; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke();
  if (glow) ctx.restore();
  ctx.beginPath(); ctx.moveTo(8, -0.2); for (let x = 8; x < len; x += 5) ctx.lineTo(x + 2.5, -0.9 - ((x / 5) % 2) * 0.8); ctx.strokeStyle = 'rgba(170,185,210,.95)'; ctx.lineWidth = 1.1; ctx.stroke(); // hamon
  ctx.beginPath(); ctx.ellipse(4, 0, 2.2, 5.2, 0, 0, TAU); ctx.fillStyle = '#e8c35a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); // tsuba
}
/** The saya (scabbard) at the left hip, angled back; `hilt`: the katana is inside (its handle sticks out forward). */
function drawSaya(ctx, hilt, glow = null) {
  if (REC.on) return REC.w(ctx, 'saya', 0, glow, hilt);
  ctx.save(); ctx.translate(3, -15); ctx.rotate(Math.PI + 0.22);
  if (glow) { weaponGlow(ctx, glow, -30, 0); }
  rrect(ctx, -2, -3, 40, 6, 3); ctx.fillStyle = '#1d1226'; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ff8cc6'; ctx.fillRect(4, -3.2, 3, 6.4); ctx.fillStyle = '#dfe8ff'; ctx.fillRect(34, -3, 4, 6); // sageo cord + silver kojiri
  ctx.beginPath(); ctx.moveTo(6, 3); ctx.quadraticCurveTo(10, 10, 16, 7); ctx.strokeStyle = '#ff8cc6'; ctx.lineWidth = 1.8; ctx.stroke();
  if (hilt) { ctx.rotate(Math.PI); ctx.beginPath(); ctx.ellipse(1, 0, 2, 4.6, 0, 0, TAU); ctx.fillStyle = '#e8c35a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); rrect(ctx, 3, -2.3, 12, 4.6, 2); ctx.fillStyle = '#2a1a33'; ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ff8cc6'; ctx.fillRect(6, -1, 2, 2); ctx.fillRect(10, -1, 2, 2); }
  ctx.restore();
}

/**
 * h: { x, y, ang, cls, app, anim:{kind,id,idx,t,dur,hit}, flash, iframes, moving, time, jump, scale, glow }
 */
export { drawMace, drawShield, drawDagger, drawHatchet };
REC.proc = { hatchet: drawHatchet, hammer: drawHammer, shadow }; // (the painted renderer has no painted twin axes / warhammer yet)
// ---- hero detail pass helpers (layered shading, cloth folds, hair strands, rim light) - drawn in the hero's rotated frame
export function hairDetail(ctx, style, color, la) {
  if (style === 'bald') return;
  ctx.save(); ctx.lineCap = 'round';
  const dk = shade(color, -0.35), hi = shade(color, 0.4);
  ctx.beginPath();
  if (style === 'long') { for (let i = -2; i <= 2; i++) { ctx.moveTo(-2, i * 4); ctx.quadraticCurveTo(-12, i * 6, -20, i * 5.5); } }
  else if (style === 'mohawk') { for (let i = 0; i < 5; i++) { ctx.moveTo(-13 + i * 4.5, -2); ctx.lineTo(-11 + i * 4.5, 2); } }
  else { for (let i = 0; i < 6; i++) { const a = Math.PI * 0.6 + i * (Math.PI * 0.8 / 5); ctx.moveTo(-1 + Math.cos(a) * 5, Math.sin(a) * 5); ctx.lineTo(-1 + Math.cos(a) * 11, Math.sin(a) * 11); } }
  ctx.strokeStyle = dk; ctx.globalAlpha *= 0.6; ctx.lineWidth = 1.3; ctx.stroke(); ctx.globalAlpha /= 0.6;
  ctx.beginPath(); ctx.arc(-2, 0, 8.5, la - 0.6, la + 0.6); ctx.strokeStyle = hi; ctx.globalAlpha *= 0.7; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}
/** Leap height (0..~2.6) of a hero's current move: slams, leaps, flips. */
export function heroJump(h) {
  const a = h.anim;
  let jump = 0;
  if (a && a.id === 'slam' && a.t < 18) jump = Math.sin((a.t / 18) * Math.PI) * 1.8; // Leap Slam: a real leap to the aim point
  if (a && a.id === 'judgment' && a.t < 24) jump = Math.sin(Math.min(1, a.t / 24) * Math.PI) * 0.7;
  if (a && a.id === 'heartseeker' && a.t < 11) jump = Math.sin((a.t / 11) * Math.PI) * 0.9; // Heartseeker leap
  if (a && a.id === 'vanish' && a.t < 12) jump = Math.sin((a.t / 12) * Math.PI) * 0.8;       // Vanish backflip
  if (a && h.cls === 'warrior' && a.kind !== 'basic' && a.kind !== 'dodge') {
    const L = { earthshatter_recall: 10, warlord: 22, titanfall: 40, executioners_verdict: 14, rift_cleave: 8 }[a.chain || a.id];
    if (L && a.t < L) jump = Math.sin((a.t / L) * Math.PI) * ((a.chain || a.id) === 'titanfall' ? 2.6 : a.chain === 'rift_cleave' ? 0.6 : 1.8);
  }
  if (a && a.id === 'berserk' && a.t < 22) jump = Math.sin((a.t / 22) * Math.PI) * 2.6; // Berserk leap
  return jump;
}
/** The hero's ground shadow (drawn outside the lit buffer). */
export function heroShadow(ctx, h) { const s = h.scale || 1, j = heroJump(h); shadow(ctx, h.x, h.y + 10, 19 * s * (1 - j * 0.3), 9 * s * (1 - j * 0.3)); }
/** The drawn facing of a hero: its smoothed facing, spun by whirlwinds / spinning kicks / flips. */
export function heroAngle(h) {
  const a = h.anim;
  let ang = h.ang;
  if (a && a.id === 'whirlwind') ang = a.t * 0.55;
  if (a && h.cls === 'warrior' && ['cyclone_cleave', 'crimson_tempest', 'warlords_rally', 'ax_flurry', 'rift_cleave'].includes(a.chain || a.id) && a.t < (a.dur || 30) - 4) ang = h.ang + a.t * 0.6;
  if (a && a.id === 'vanish' && a.t < 12) ang = h.ang + Math.PI + ease(a.t / 12) * TAU; // flip away
  if (a && h.cls === 'monk' && ['crane_kick', 'cyclone_kick', 'dragon_sweep'].includes(a.chain || a.id) && a.t < (a.dur || 24) - 6) ang = h.ang + a.t * ((a.chain || a.id) === 'cyclone_kick' ? 0.75 : 0.55); // spinning kicks
  if (a && h.cls === 'dragoon' && ['sweeping_arc', 'tempest_spin', 'searing_cyclone'].includes(a.chain || a.id) && a.t < (a.dur || 24) - 5) ang = h.ang + a.t * ((a.chain || a.id) === 'sweeping_arc' ? 0.42 : 0.7); // spear spins
  if (a && h.cls === 'dragoon' && (a.chain || a.id) === 'whirling_lance' && a.t < 12) ang = h.ang + a.t * 0.55;
  if (a && h.cls === 'bladedancer' && a.kind === 'basic' && a.idx === 3) ang = h.ang + ease(Math.min(1, a.t / Math.max(1, a.hit + 3))) * TAU;
  return ang;
}
/** Weapon + hands, class specific (hero frame: +x = facing). The painted renderer runs this against a recording context
 *  (client/heropaint.js: REC) to get the exact weapon transforms / swing easing without drawing anything. */
function heroGear(ctx, h, c, t, a, ang, mk, bob, jump, LL) {
  const glove = heroGlove(h.cls, c.skin), sleeve = heroSleeve(h.cls, c.outfit), hand = (x, y) => { if (REC.on) return; heroArm(ctx, x, y, sleeve, LL); circle(ctx, x, y, 4.5, glove, 2.6); ctx.beginPath(); ctx.arc(x, y, 3.4, LL - 0.9, LL + 0.9); ctx.strokeStyle = 'rgba(255,248,226,.5)'; ctx.lineWidth = 1.1; ctx.stroke(); };
  let orbColor = '#7cd8ff';
  if (h.cls === 'warrior') {
    // Weapon Master: the weapon in hand follows the stance (G greatsword / A twin axes / H warhammer)
    const st = h.wst || 'G';
    const SC = { G: '#7fd6ff', A: '#ff5a5a', H: '#ffc14d' }[st];
    let len = st === 'G' ? 50 : st === 'H' ? 40 : 22, glow = h.surge ? SC : null;
    const skill = a && a.kind !== 'basic' && a.kind !== 'dodge';
    if (a && a.kind === 'basic' && a.idx === 2) { len += st === 'A' ? 3 : 6; glow = SC; }
    if (skill) { len += st === 'A' ? 4 : 6; glow = SC; }
    if (h.rage && !glow) glow = '#ff7a5c';
    if (st === 'A') {
      // twin hatchets, one per hand, mirrored: each blade faces inward, toward the body's centre line. Idle/walk: held low and wide;
      // basics: right hand slashes outward (1), left hand (2), both in an outward X (3); skills: both sweep out together.
      const walk = Math.sin(t * 14) * 0.14 * mk, rest = 0.9;
      const poseAt = (tt) => {
        if (a && a.kind === 'basic') {
          const w = Math.min(1, tt / Math.max(1, a.hit - 2));
          return tt < a.hit - 2 ? rest + (-0.45 - rest) * easeInOutSine(w) : -0.45 + 2.4 * easeOutBack((tt - a.hit + 2) / 5.5);
        }
        if (skill) { const k = Math.min(1, Math.max(0, tt) / Math.max(6, (a.dur || 30) * 0.45)); return k < 0.3 ? rest + (-0.5 - rest) * ease(k / 0.3) : -0.5 + 2.5 * ease((k - 0.3) / 0.7); }
        return rest;
      };
      const useR = !a || a.kind !== 'basic' || a.idx !== 1, useL = !a || a.kind !== 'basic' || a.idx !== 0;
      const pr = poseAt(a ? a.t : 0), R0 = useR ? pr : rest, L0 = useL ? pr : rest;
      const one = (sw, side, alpha) => {
        const hx = Math.cos(sw) * 17, hy = Math.sin(sw) * 17 * side;
        ctx.save(); if (alpha < 1) ctx.globalAlpha *= alpha; ctx.translate(hx, hy); ctx.rotate(sw * 0.85 * side); drawHatchet(ctx, len, alpha < 1 ? null : glow, -side); ctx.restore();
        if (alpha >= 1) hand(hx, hy);
      };
      if (a && (a.kind === 'basic' ? a.t >= a.hit - 2 && a.t < a.hit + 5 : skill && a.t < (a.dur || 30) * 0.6)) { // motion afterimages of the swing
        for (const [dt, al] of [[2.5, 0.32], [5, 0.14]]) { const g = poseAt(a.t - dt); if (useR) one(g, 1, al); if (useL) one(g, -1, al); }
      }
      one(R0 - (a ? 0 : walk), 1, 1); one(L0 + (a ? 0 : walk), -1, 1);
    } else {
      const swAt = (tt) => {
        if (a && a.kind === 'basic') {
          const from = [-1.9, 1.5, -2.4][a.idx] || -1.9, to = [1.5, -1.9, 1.9][a.idx] || 1.5;
          const wind = Math.min(1, tt / Math.max(1, a.hit - 2));
          return tt < a.hit - 2 ? 0.9 + (from - 0.9) * easeInOutSine(wind) : from + (to - from) * easeOutBack((tt - a.hit + 2) / 5.5); // wind-up eases in, the strike follows through
        }
        if (skill) { const k = Math.min(1, Math.max(0, tt) / Math.max(6, (a.dur || 30) * 0.45)); return st === 'H' ? (k < 0.6 ? -0.3 - jump * 1.2 : 1.2) : -1.9 + 3.4 * ease(k); }
        return 0.9;
      };
      const sw = swAt(a ? a.t : 0);
      const draw = (s0, g) => { const hx = Math.cos(s0) * 17, hy = Math.sin(s0) * 17; ctx.save(); ctx.translate(hx, hy); ctx.rotate(s0 * 0.85); if (st === 'H') drawHammer(ctx, len, g); else drawSword(ctx, len, g); ctx.restore(); return [hx, hy]; };
      if (a && a.kind !== 'dodge' && (a.kind === 'basic' ? a.t >= a.hit - 2 && a.t < a.hit + 5 : skill && a.t < (a.dur || 30) * 0.6)) {
        for (const [dt, al] of [[2.5, 0.3], [5, 0.13]]) { const g = swAt(a.t - dt); if (Math.abs(g - sw) > 0.08) { ctx.save(); ctx.globalAlpha *= al; draw(g, null); ctx.restore(); } }
      }
      const [hx, hy] = draw(sw, glow);
      hand(hx, hy);
      hand(9, -14 + bob);
    }
  } else if (h.cls === 'ranger') {
    let pull = 6, bowKick = 0;
    if (a && (a.kind === 'basic' || a.id === 'pierce' || a.id === 'dashshot')) {
      const hitT = a.kind === 'basic' ? a.hit : a.id === 'pierce' ? 10 : 4;
      pull = a.t < hitT ? 4 + easeInOutSine(a.t / hitT) * (a.id === 'pierce' ? 16 : 10) : 0;
      if (a.t >= hitT) bowKick = 1 - easeOutCubic((a.t - hitT) / 7); // release recoil: the bow kicks back and settles
    }
    ctx.save(); ctx.translate(8 - bowKick * 4, 0); drawBow(ctx, pull); ctx.restore();
    hand(22, 0);
    hand(10 - pull, 3);
  } else if (h.cls === 'cleric') {
    // mace in the right hand (swings like the warrior's sword), round shield on the left arm
    let sw = 0.95, len = 32, glow = null, shx = 7, shy = -18, shGlow = null;
    if (a && a.kind === 'basic') {
      const from = [-1.9, 0.9, -2.5][a.idx], to = [1.5, 0.9, 1.7][a.idx];
      const wind = Math.min(1, a.t / Math.max(1, a.hit - 2));
      sw = a.t < a.hit - 2 ? 0.95 + (from - 0.95) * easeInOutSine(wind) : from + (to - from) * easeOutBack((a.t - a.hit + 2) / 5.5);
      if (a.idx === 1) { const k = a.t < a.hit ? a.t / a.hit : Math.max(0, 1 - (a.t - a.hit) / 8); shx = 7 + 14 * k; shy = -18 + 12 * k; shGlow = k > 0.6 ? '#fff3a0' : null; }
      if (a.idx === 2) { len = 36; glow = '#fff3a0'; }
    } else if (a && a.id === 'smite') { sw = a.t < 11 ? -2.2 + a.t * 0.02 : 0; len = 36; glow = '#ffe27a'; }
    else if (a && a.id === 'shieldrush') { shx = 22; shy = -4; sw = 1.6; shGlow = '#9fe0ff'; }
    else if (a && a.id === 'judgment') { sw = a.t < 24 ? -Math.PI / 2 - jump * 0.6 : 0.2; len = 38; glow = '#fff6c8'; }
    else if (a && a.id === 'sanctuary') { sw = 0.5; glow = '#ffe27a'; }
    ctx.save(); ctx.translate(shx, shy); drawShield(ctx, 11.5, shGlow); ctx.restore();
    const hx = Math.cos(sw) * 16, hy = Math.sin(sw) * 16;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(sw * 0.85); drawMace(ctx, len, glow || (h.glow ? '#ffe27a' : null)); ctx.restore();
    hand(hx, hy);
  } else if (h.cls === 'bladedancer') {
    // twin daggers: right hand +y side, left hand -y side; scarf drawn with the body
    let r = 0.75, l = -0.75, rr = 0.9, lr = -0.9, glow = h.glow ? '#ff9ee0' : null, reach = 15;
    if (a && a.kind === 'basic') {
      const k = a.t < a.hit ? ease(a.t / Math.max(1, a.hit)) : 1 - Math.min(1, (a.t - a.hit) / 8) * 0.5;
      if (a.idx === 0) { r = 1.6 - 2.4 * k; rr = r * 0.9; }
      else if (a.idx === 1) { l = -1.6 + 2.4 * k; lr = l * 0.9; }
      else if (a.idx === 2) { r = 0.3; l = -0.3; rr = 0.05; lr = -0.05; reach = 15 + 9 * k; }
      else if (a.idx === 3) { r = 1.4; l = -1.4; rr = 1.6; lr = -1.6; }
      else { r = 1.7 - 2.9 * k; l = -1.7 + 2.9 * k; rr = r; lr = l; reach = 16 + 4 * k; glow = glow || (k > 0.5 ? '#ffd6f0' : null); }
    } else if (a && a.id === 'heartseeker') { const k = Math.min(1, a.t / 10); r = 0.25; l = -0.25; rr = 0.05; lr = -0.05; reach = 12 + 12 * k; glow = glow || '#ff5fb0'; }
    else if (a && (a.id === 'flicker' || a.id === 'thousandcuts')) { r = 0.35; l = -0.35; rr = 0.2; lr = -0.2; reach = 20; glow = glow || '#ffd6f0'; }
    else if (a && a.id === 'vanish') { r = 2.2; l = -2.2; rr = 2.6; lr = -2.6; }
    else if (a && a.kind === 'dodge') { r = 1.9; l = -1.9; rr = 2.4; lr = -2.4; }
    for (const [ang2, rot] of [[r, rr], [l, lr]]) {
      const hx = Math.cos(ang2) * reach, hy = Math.sin(ang2) * reach;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(rot); drawDagger(ctx, 21, glow); ctx.restore();
      hand(hx, hy);
    }
  } else if (h.cls === 'samurai') {
    // katana + saya at the left hip. Sheathed (Stillness / Sheathe): right hand on the hilt at the hip, iaido stance.
    const glow = h.uw ? '#dfe8ff' : h.glow ? '#ffc2e0' : null;
    if (h.sheathed) {
      drawSaya(ctx, true, glow);
      hand(14, -13); hand(1, -18);
    } else {
      drawSaya(ctx, false);
      const skill = a && a.kind === 'skill';
      const swAt = (tt) => {
        if (a && a.kind === 'basic') {
          const from = [-2.2, 1.6, -2.6][a.idx] ?? -2.2, to = [1.4, -1.8, 1.9][a.idx] ?? 1.4;
          const wind = Math.min(1, tt / Math.max(1, a.hit - 2));
          return tt < a.hit - 2 ? 0.7 + (from - 0.7) * easeInOutSine(wind) : from + (to - from) * easeOutBack((tt - a.hit + 2) / 4.5);
        }
        if (a && a.id === 'crescent_parry') return tt < 18 ? -0.15 : -0.15 + 2 * ease(Math.min(1, (tt - 18) / 6)); // blade held across the front, then the crescent
        if (a && a.id === 'iaido') return tt < 4 ? -2.6 + 0.4 * tt : 0.15; // the quick draw from the hip
        if (skill) { const k = Math.min(1, Math.max(0, tt) / Math.max(6, (a.dur || 24) * 0.4)); return -2.4 + 3.2 * ease(k); }
        return 0.7; // guard: blade low and forward
      };
      const sw = swAt(a ? a.t : 0), len = 48 + (skill ? 4 : 0), g = glow || (skill || (a && a.kind === 'basic' && a.idx === 2) ? '#ffc2e0' : null);
      const draw = (s0, gg) => { const hx = Math.cos(s0) * 16, hy = Math.sin(s0) * 16; ctx.save(); ctx.translate(hx, hy); ctx.rotate(s0 * 0.85); drawKatana(ctx, len, gg); ctx.restore(); return [hx, hy]; };
      if (a && a.kind !== 'dodge' && (a.kind === 'basic' ? a.t >= a.hit - 2 && a.t < a.hit + 5 : skill && a.t < (a.dur || 24) * 0.6)) {
        for (const [dt, al] of [[2, 0.34], [4, 0.15]]) { const q = swAt(a.t - dt); if (Math.abs(q - sw) > 0.08) { ctx.save(); ctx.globalAlpha *= al; draw(q, null); ctx.restore(); } }
      }
      const [hx, hy] = draw(sw, g);
      hand(hx, hy);
      hand(a && a.id === 'crescent_parry' ? hx - 4 : 8, a && a.id === 'crescent_parry' ? hy - 7 : -14 + bob);
    }
  } else if (h.cls === 'monk') {
    // wrapped fists (no weapon): guard at the chin; punches shoot a fist forward with a motion streak; kicks show a foot
    const glow = h.uw ? '#ffd76a' : h.glow ? '#ffc24a' : null;
    const fist = (x, y, big = 1) => { if (REC.on) { REC.fist(ctx, x, y, big, glow); return; } heroArm(ctx, x, y, c.skin, LL); circle(ctx, x, y, 5.4 * big, c.skin, 3); ctx.beginPath(); ctx.arc(x, y, 5.4 * big, -1.1, 1.1); ctx.strokeStyle = '#f4ead8'; ctx.lineWidth = 3.2; ctx.stroke(); if (glow) { ctx.save(); ctx.globalAlpha *= 0.5; circle(ctx, x, y, 8 * big, glow, 0); ctx.restore(); circle(ctx, x, y, 5.4 * big, c.skin, 3); } };
    const streak = (x, y, len, col = '#ffe7a8') => { ctx.save(); ctx.globalAlpha *= 0.55; ctx.lineCap = 'round'; for (const [oy, w] of [[-4, 2.5], [0, 4], [4, 2.5]]) { ctx.beginPath(); ctx.moveTo(x - len, y + oy); ctx.lineTo(x - 6, y + oy * 0.6); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); } ctx.restore(); };
    const id = a && (a.chain || a.id), tt = a ? a.t : 0;
    let R = [13, 10 + bob], L = [14, -10 - bob], foot = null, bigR = 1;
    const punchAt = (every, n0 = 2) => { const k = ((tt - n0) % every + every) % every / every, ext = k < 0.45 ? ease(k / 0.45) : 1 - ease((k - 0.45) / 0.55), side = Math.floor((tt - n0) / every) % 2; return { ext, side }; };
    if (a && a.kind === 'basic') { const w = tt < a.hit ? ease(tt / Math.max(1, a.hit)) : Math.max(0, 1 - (tt - a.hit) / 6); if (a.idx === 1) L = [14 + 16 * w, -10 + 6 * w]; else if (a.idx === 2) { R = [14 + 18 * w, 5]; L = [14 + 18 * w, -5]; bigR = 1 + 0.25 * w; } else R = [13 + 16 * w, 10 - 6 * w]; if (w > 0.6) streak(a.idx === 1 ? L[0] : R[0], a.idx === 1 ? L[1] : R[1], 26); }
    else if (id === 'tiger_fist' || id === 'rapid_strikes' || id === 'hundred_hands' || id === 'hundred_fists' || id === 'sweeppunch') { const { ext, side } = punchAt(id === 'rapid_strikes' ? 3 : 4); const X = 13 + 17 * ext; if (side) L = [X, -6]; else R = [X, 6]; if (ext > 0.5) streak(X, side ? -6 : 6, 30 + ext * 10, glow || '#ffe7a8'); }
    else if (id === 'crane_kick' || id === 'cyclone_kick' || id === 'dragon_sweep' || id === 'palmkick') { foot = [24, 8]; R = [4, 16]; L = [6, -16]; }
    else if (id === 'shockwave_palm' || id === 'heaven_splitting_palm' || id === 'nerve_strike' || id === 'seven_seals') { const w = Math.min(1, tt / 10); R = [14 + 14 * w, 5]; L = [14 + 14 * w, -5]; bigR = 1.1 + 0.2 * w; if (w > 0.7) streak(R[0], 0, 34, glow || '#fff3c4'); }
    else if (id === 'rising_dragon') { const w = Math.min(1, tt / 8); R = [12 + 18 * w, 8 - 10 * w]; L = [10, -14]; bigR = 1.3; if (w > 0.6) streak(R[0], R[1], 30, '#ffb347'); }
    else if (id === 'flow_state' || id === 'awakened_spirit') { R = [16, 3]; L = [16, -3]; } // palms together
    else if (a && a.kind === 'dodge') { R = [2, 16]; L = [2, -16]; }
    if (foot) { ellipse(ctx, foot[0], foot[1], 8, 5.5, '#7a3b12', 3); ctx.beginPath(); ctx.moveTo(4, 8); ctx.lineTo(foot[0] - 4, foot[1]); ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = '#ff9a2e'; ctx.lineWidth = 5; ctx.stroke(); }
    fist(L[0], L[1]); fist(R[0], R[1], bigR);
  } else if (h.cls === 'dragoon') {
    // the long spear in both hands: guard = levelled forward; thrusts drive it out, dives point it straight down (forward), the haft sweeps for spins
    const glow = h.uw ? '#ff5a3c' : h.glow ? '#b9a8ff' : null;
    const id = a && (a.chain || a.id), tt = a ? a.t : 0;
    let ext = 0, rot = 0.12, oy = 9, gl = glow;
    const thrust = (hitT, out = 18) => (tt < hitT ? -6 * easeInOutSine(tt / Math.max(1, hitT)) : tt < hitT + 2 ? -6 + (out + 6) * easeOutCubic((tt - hitT) / 2) : out * (1 - easeInOutSine((tt - hitT - 2) / 9)));
    if (a && a.kind === 'basic') { const hitT = a.hit || 6; if (a.idx === 1) { rot = tt < hitT ? -1.2 + 1.2 * ease(tt / hitT) : 0.9 * Math.min(1, (tt - hitT) / 6); } else ext = thrust(hitT, a.idx === 2 ? 24 : 16); if (a.idx === 2) gl = gl || '#ff3b5c'; }
    else if (id === 'piercing_thrust' || id === 'impale_rush' || id === 'dragonfang_lance') { ext = thrust(id === 'impale_rush' ? (tt < 12 ? 7 : 17) : id === 'dragonfang_lance' ? 12 : 6, 26); if (id === 'impale_rush' && tt >= 12) ext = thrust(17, 26) ; gl = gl || '#ff3b5c'; rot = 0; oy = 4; }
    else if (id === 'whirling_lance') { if (tt >= 12) { ext = thrust(17, 30); rot = 0; oy = 4; } gl = gl || '#b9a8ff'; }
    else if (id === 'spineshatter') { if (tt < 10) { ext = thrust(4, 22); rot = 0; } else { rot = 0; ext = 10; } gl = gl || '#ff3b5c'; }
    else if (id === 'jump' || id === 'dragon_dive' || id === 'high_jump' || id === 'nosedive_barrage' || id === 'wyrmstorm' || id === 'nidhoggs_fall' || id === 'dragon_form') { rot = 0; ext = 14; oy = 2; gl = gl || '#ff5a3c'; } // dive: spearhead first
    else if (id === 'geirskogul' || id === 'crimson_comet') { rot = -0.5 + Math.min(1, tt / 18) * 0.5; ext = 18; gl = '#ff5a3c'; }
    else if (id === 'dragons_roar') { rot = -1.3; ext = -4; oy = 14; }
    else if (a && a.kind === 'dodge') { rot = 0.5; ext = -6; }
    ctx.save(); ctx.translate(ext, oy); ctx.rotate(rot); drawSpear(ctx, 52, gl, 30); ctx.restore();
    hand(ext + Math.cos(rot) * 2, oy + Math.sin(rot) * 2); hand(ext + Math.cos(rot) * 20, oy + Math.sin(rot) * 20 - 1);
  } else if (h.cls === 'summoner') {
    // the grimoire floats at the front hand; it snaps open on casts and summons, pages flutter; the other hand traces runes
    const id = a && (a.chain || a.id), tt = a ? a.t : 0, cast = a && (a.kind === 'skill' || a.kind === 'basic' || a.kind === 'ult' || a.kind === 'special');
    const open = h.uw ? 1 : cast ? Math.min(1, tt / 4) * (a.kind === 'basic' && a.idx < 2 ? 0.6 : 1) : 0.15 + 0.1 * Math.sin(t * 2);
    const fl = Math.sin(t * 3) * 1.5, gl = h.uw ? '#ffd86a' : h.glow ? '#3ff0c8' : cast && tt < 10 ? '#3ff0c8' : null;
    ctx.save(); ctx.translate(16, 9 + fl); ctx.rotate(-0.25 + (cast ? 0.25 : 0)); drawGrimoire(ctx, open, t, gl); ctx.restore();
    hand(12, 12 + fl);
    const rx = 16 + (cast ? 6 * Math.sin(tt * 0.5) : 0), ry = -13 + bob + (cast ? 3 * Math.cos(tt * 0.5) : 0);
    hand(rx, ry);
    if (cast && tt < 12) { ctx.save(); ctx.strokeStyle = '#9ff8e0'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(rx + 4, ry, 6, tt * 0.6, tt * 0.6 + 4.2); ctx.stroke(); ctx.restore(); }
    void id;
  } else if (h.cls === 'bard') {
    // the lute across the body; basics / skills strum (strings shiver, the picking hand sweeps); Encore holds it high
    const tt = a ? a.t : 0, play = a && (a.kind === 'skill' || a.kind === 'basic' || a.kind === 'special' || a.kind === 'ult');
    const strum = play ? Math.max(0, 1 - Math.abs(tt - (a.hit || 5)) / 6) : 0, gl = h.uw ? '#ffd86a' : h.glow ? '#ff7ab8' : play && strum > 0.3 ? '#ff7ab8' : null;
    const lift = h.uw ? -3 : 0;
    ctx.save(); ctx.translate(6, 4 + lift); ctx.rotate(-0.55); drawLute(ctx, strum, gl); ctx.restore();
    hand(6 + 18 * Math.cos(-0.55), 4 + lift + 18 * Math.sin(-0.55)); // fretting hand on the neck
    hand(2 + strum * 3, 6 + lift + Math.sin(tt * 1.4) * 4 * strum); // picking hand over the rosette
  } else {
    let push = 0;
    if (a && (a.kind === 'basic' || a.kind === 'skill')) { const hitT = a.kind === 'basic' ? a.hit : 6; push = a.t < hitT ? easeOutCubic(a.t / hitT) * 8 : 8 * (1 - easeInOutSine((a.t - hitT) / 8)); }
    orbColor = a && a.id === 'nova' ? '#bff4ff' : a && a.id === 'meteor' ? '#ff9a3c' : '#9d7bff';
    ctx.save(); ctx.translate(4 + push, 15); ctx.rotate(-0.12); drawStaff(ctx, orbColor, t); ctx.restore();
    hand(8 + push, 15);
    hand(12 + push * 0.5, -13 + bob);
    if (push > 2) { softGlow(ctx, 14 + push * 0.5, -13, orbColor, 14); ctx.save(); circle(ctx, 14 + push * 0.5, -13, 4, orbColor, 0); ctx.restore(); }
  }

}
/** The weapon draws (kind, hero-frame transform, glow...) the painted renderer gets for hero h (tests / tools). */
export function heroGearRecord(h) { const ang = heroAngle(h), t = h.time || 0, mk = h.moveK || 0; return recordGear(ang, (g) => heroGear(g, h, heroColors(h.app || {}), t, h.anim, ang, mk, Math.sin(t * 14) * 1.6 * mk, heroJump(h), -2.3 - ang)); }
/** Lobby / save-card thumbnail on a square canvas: the painted head-and-shoulders portrait (redrawn once its atlas loads),
 *  else the procedural hero. */
export function drawHeroThumb(cv, cls, app) {
  app = { skin: 0, hairColor: 0, hairStyle: 0, outfit: 0, ...(app || {}) };
  const g = cv.getContext('2d'), k = cv.width / 56;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.scale(k, k);
  if (drawHeroPortrait(g, cls, 28, 28, 27)) return;
  drawHero(g, { x: 28, y: 26, ang: Math.PI / 2 - 0.5, cls, app: app || {}, time: 0, classic: true });
  if (heroArt.painted) requestHeroArt(cls).then((ok) => { if (ok) drawHeroThumb(cv, cls, app); });
}
/** where the hero's eyes are, relative to h.x, h.y (screen-up = -y), following drawHero's own transform (jump, bob, scale,
 *  facing). vis 0..1: 0 when the face points away from the camera (the back of the head is towards it) */
/** shadow id -> its eyes as last drawn (heroEyes; client/shadowfx.js writes, the duel close-up reads) */
export const SHADOW_EYES = new Map();
export function heroEyes(h) {
  const t = h.time || 0, s = h.scale || 1, jump = heroJump(h), mk = walkK(h), ang = heroAngle(h), k = s * (1 + jump * 0.18), ca = Math.cos(ang), sa = Math.sin(ang);
  const dy = -jump * 22 - (1 - Math.cos(t * 28)) * 0.65 * mk;
  const pts = heroEyeLocal(h.cls).map((q) => ({ x: (q.x * ca - q.y * sa) * k, y: dy + (q.x * sa + q.y * ca) * k }));
  const vis = heroEyesHidden(h.cls) ? 0 : Math.max(0, Math.min(1, (sa + 0.55) / 0.35)); // (the mage: under the brim, like her eyes) // facing up-screen (sin < -0.55) = turned away
  return { pts, vis, r: 2.2 * k / 1.2 };
}
export function drawHero(ctx, h) {
  if (heroArt.painted && !h.classic) { // painted hero art (client/heropaint.js); the procedural rig below is the fallback while it loads
    if (paintedReady(h.cls)) { h.jumpH = heroJump(h); return drawPaintedHero(ctx, h, heroAngle(h), (g, ang, mk, bob, jump) => h.noWeapon || heroGear(g, h, heroColors(h.app || {}), h.time || 0, h.anim, ang, mk, bob, jump, -2.3 - ang)); }
    requestHeroArt(h.cls);
  }
  const c = heroColors(h.app);
  const t = h.time || 0;
  const s = h.scale || 1;
  const a = h.anim;
  const jump = heroJump(h);
  ctx.save();
  ctx.translate(h.x, h.y);
  if (!h.noShadow) shadow(ctx, 0, 10, 19 * s * (1 - jump * 0.3), 9 * s * (1 - jump * 0.3));
  const mk = walkK(h); // walk blend (eased by the renderer)
  ctx.translate(0, -jump * 22 - (1 - Math.cos(t * 28)) * 0.65 * mk); // + a soft walk bob, twice per stride (the shadow stays put)
  ctx.scale(s * (1 + jump * 0.18), s * (1 + jump * 0.18));
  if (h.iframes) ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 40);
  const ang = heroAngle(h);
  ctx.rotate(ang);
  const bob = Math.sin(t * 14) * 1.6 * mk;

  // Shoulder Bash: lean into it with a motion streak
  if (a && a.id === 'bash' && a.t < 14) { ctx.save(); ctx.globalAlpha *= 0.5; ctx.beginPath(); ctx.moveTo(-34, -10); ctx.lineTo(-58, -6); ctx.moveTo(-34, 10); ctx.lineTo(-58, 6); ctx.moveTo(-30, 0); ctx.lineTo(-64, 0); ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore(); }

  const LL = -2.3 - ang; // the light direction in the hero's rotated frame (detail pass)
  // feet (striding), then the cloak / quiver behind the body (pass 2 rig: client/herobody.js)
  drawHeroLegs(ctx, h, t);
  drawHeroCape(ctx, h, t);
  if (h.cls === 'ranger') { rrect(ctx, -19, -12, 7, 15, 2.5); ctx.fillStyle = '#6b4a2c'; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke(); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-17.5 + i * 1.6, -12); ctx.lineTo(-19 + i * 1.6, -17); ctx.strokeStyle = '#f4f0e6'; ctx.lineWidth = 1.6; ctx.stroke(); } }
  void LL;

  heroGear(ctx, h, c, t, a, ang, mk, bob, jump, LL);

  // body (shoulders) + head
  if (h.cls === 'bladedancer') { // flowing scarf trailing behind
    const wv = Math.sin(t * 9) * 5 + (Math.sin(t * 17) * 3 * mk);
    ctx.beginPath(); ctx.moveTo(-6, -4); ctx.quadraticCurveTo(-22, -8 + wv, -36, -2 + wv * 1.4); ctx.lineTo(-33, 5 + wv * 1.2); ctx.quadraticCurveTo(-20, 3 + wv * 0.6, -6, 4); ctx.closePath();
    ctx.fillStyle = '#ff5fb0'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  }
  if (h.cls === 'dragoon') { // crimson dragon-scale cape behind the armor, its edge rippling
    const wv = Math.sin(t * 8) * 3 + (Math.sin(t * 16) * 2.5 * mk);
    ctx.beginPath(); ctx.moveTo(-6, -15); ctx.quadraticCurveTo(-24, -14 + wv, -32, -6 + wv); ctx.lineTo(-28, 0); ctx.lineTo(-33, 7 - wv); ctx.quadraticCurveTo(-24, 14 - wv, -6, 15); ctx.closePath();
    ctx.fillStyle = '#a3192f'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,120,140,.5)'; ctx.lineWidth = 1.4; for (const yy of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(-10, yy); ctx.lineTo(-24, yy + wv * 0.4); ctx.stroke(); }
  }
  if (h.cls === 'summoner') { // a long scholar's robe trailing behind, with ink-teal lining and a glowing hem
    const wv = Math.sin(t * 6) * 2.5 + (Math.sin(t * 14) * 2 * mk);
    ctx.beginPath(); ctx.moveTo(-4, -17); ctx.quadraticCurveTo(-22, -16 + wv, -30, -8 + wv); ctx.lineTo(-30, 8 - wv); ctx.quadraticCurveTo(-22, 16 - wv, -4, 17); ctx.closePath();
    ctx.fillStyle = '#20345a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-30, -8 + wv); ctx.lineTo(-30, 8 - wv); ctx.strokeStyle = '#3ff0c8'; ctx.lineWidth = 2; ctx.stroke();
  }
  if (h.cls === 'bard') { // a short swishing cape: crimson outside, gold trim
    const wv = Math.sin(t * 9) * 3.5 + (Math.sin(t * 17) * 3 * mk);
    ctx.beginPath(); ctx.moveTo(-6, -15); ctx.quadraticCurveTo(-20, -14 + wv, -27, -6 + wv * 1.2); ctx.lineTo(-27, 6 - wv * 0.8); ctx.quadraticCurveTo(-20, 14 - wv, -6, 15); ctx.closePath();
    ctx.fillStyle = '#b8285f'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-27, -6 + wv * 1.2); ctx.lineTo(-27, 6 - wv * 0.8); ctx.strokeStyle = '#ffd86a'; ctx.lineWidth = 2; ctx.stroke();
  }
  drawHeroCore(ctx, h, c, ang); // torso + armour + head: cached per look and facing bucket
  drawHeroTails(ctx, h, c, t);

  if (h.flash) {
    ctx.globalAlpha = (h.flash >= 5 ? 1 : smoothstep(h.flash / 5)) * 0.85; // crisp: solid for the first ticks, then a fast smooth fade
    ctx.fillStyle = '#ffffff'; heroFlashShape(ctx);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ enemies
function eyes(ctx, x, sep, r, angry = true, color = '#fff', pupil = INK) {
  circle(ctx, x, -sep, r, color, 2.5); circle(ctx, x, sep, r, color, 2.5);
  circle(ctx, x + r * 0.35, -sep, r * 0.5, pupil, 0); circle(ctx, x + r * 0.35, sep, r * 0.5, pupil, 0);
  if (angry) {
    ctx.beginPath(); ctx.moveTo(x - r * 1.2, -sep - r * 1.3); ctx.lineTo(x + r * 0.9, -sep - r * 0.2);
    ctx.moveTo(x - r * 1.2, sep + r * 1.3); ctx.lineTo(x + r * 0.9, sep + r * 0.2);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  }
}

export const ENEMY_DRAW = {
  fissurecore: (ctx, e, t) => drawCore(ctx, e, t), // (Part A4: client/fissurefx.js)
  /** the village Training Dummy: drawn upright (the sim facing is ignored), a straw sack on a post with a painted target */
  dummy(ctx, e, t, col) {
    ctx.rotate(-(e.face || 0));
    const hit = e.flash > 0 ? Math.sin(e.flash * 1.3) * 0.12 : 0;
    ctx.translate(0, 12); ctx.rotate(hit); ctx.translate(0, -12);
    rrect(ctx, -4, -6, 8, 26, 3); ctx.fillStyle = '#8a5a35'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); // post
    rrect(ctx, -26, -30, 52, 8, 4); ctx.fillStyle = '#9b6a3f'; ctx.fill(); ctx.stroke(); // the arm beam
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 24, -26); ctx.lineTo(s * 30, -20); ctx.lineTo(s * 26, -16); ctx.strokeStyle = '#e6c46a'; ctx.lineWidth = 3; ctx.stroke(); }
    ellipse(ctx, 0, -14, 15, 19, col); // straw body
    ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 1.5; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 5, -30); ctx.lineTo(i * 6, 2); ctx.stroke(); }
    circle(ctx, 0, -14, 9, '#fff4e0', 2.5); circle(ctx, 0, -14, 5.5, '#ff5e5b', 0); circle(ctx, 0, -14, 2.5, '#fff4e0', 0); // target
    ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(10, -2); ctx.strokeStyle = '#7a4a28'; ctx.lineWidth = 3; ctx.stroke(); // rope belt
    circle(ctx, 0, -40, 10, '#e2c48a'); // sack head
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, -43); ctx.lineTo(-2, -40); ctx.moveTo(-2, -43); ctx.lineTo(-5, -40); ctx.moveTo(2, -43); ctx.lineTo(5, -40); ctx.moveTo(5, -43); ctx.lineTo(2, -40); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -35, 3, 0.2, Math.PI - 0.2); ctx.stroke();
    void t;
  },
  slime(ctx, e, t, col) {
    const sq = e.state === 'wind' ? 1 + Math.sin(e.st * 0.9) * 0.15 : 1 + Math.sin(t * 5 + e.id) * 0.05;
    ctx.scale(sq, 1 / sq);
    ellipse(ctx, 0, 0, e.r, e.r * 0.92, col);
    ctx.beginPath(); ctx.ellipse(-e.r * 0.3, -e.r * 0.35, e.r * 0.35, e.r * 0.22, -0.5, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fill();
    eyes(ctx, e.r * 0.35, e.r * 0.33, e.r * 0.24, true);
  },
  goblin(ctx, e, t, col) {
    // dagger
    ctx.save(); ctx.translate(8, 14); ctx.rotate(e.state === 'lunge' ? 0 : 0.5); ctx.scale(0.55, 0.8); drawSword(ctx, 22); ctx.restore();
    ellipse(ctx, -2, 0, 10, 15, '#8b5a2b');
    ctx.beginPath(); ctx.moveTo(-2, -e.r * 0.6); ctx.lineTo(-10, -e.r * 1.35); ctx.lineTo(6, -e.r * 0.7); ctx.closePath();
    ctx.moveTo(-2, e.r * 0.6); ctx.lineTo(-10, e.r * 1.35); ctx.lineTo(6, e.r * 0.7); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    circle(ctx, 2, 0, e.r * 0.8, col);
    eyes(ctx, 7, 4.5, 3.2, true, '#ffe45c');
  },
  sprout(ctx, e, t, col) {
    const k = e.state === 'wind' ? 1 + e.st / 40 : 1;
    circle(ctx, 0, 0, e.r + 4, '#8a5a35', 3);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + Math.sin(t * 2 + e.id) * 0.15;
      ctx.save(); ctx.rotate(a); ellipse(ctx, e.r * 0.9, 0, e.r * 0.7, e.r * 0.35, shade(col, -0.1), 3); ctx.restore();
    }
    circle(ctx, 0, 0, e.r * 0.62 * k, '#ffcf3a', 3);
    circle(ctx, e.r * 0.3, 0, e.r * 0.25, INK, 0);
    eyes(ctx, -1, 4, 2.4, true);
  },
  boar(ctx, e, t, col) {
    ellipse(ctx, 0, 0, e.r * 1.25, e.r * 0.95, col);
    ctx.beginPath(); ctx.ellipse(-e.r * 0.3, 0, e.r * 0.7, e.r * 0.28, 0, 0, TAU); ctx.fillStyle = shade(col, -0.35); ctx.fill();
    // ears
    ellipse(ctx, e.r * 0.45, -e.r * 0.6, 6, 4, shade(col, -0.2), 2.5, 0.5); ellipse(ctx, e.r * 0.45, e.r * 0.6, 6, 4, shade(col, -0.2), 2.5, -0.5);
    circle(ctx, e.r * 1.1, 0, e.r * 0.42, '#e7a38a', 3);
    circle(ctx, e.r * 1.2, -3, 2, INK, 0); circle(ctx, e.r * 1.2, 3, 2, INK, 0);
    ctx.beginPath(); ctx.moveTo(e.r * 1.0, -e.r * 0.45); ctx.quadraticCurveTo(e.r * 1.5, -e.r * 0.7, e.r * 1.55, -e.r * 0.25);
    ctx.moveTo(e.r * 1.0, e.r * 0.45); ctx.quadraticCurveTo(e.r * 1.5, e.r * 0.7, e.r * 1.55, e.r * 0.25);
    ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#fff8e6'; ctx.lineWidth = 3; ctx.stroke();
    eyes(ctx, e.r * 0.65, e.r * 0.33, 3, true, '#fff', '#b00');
  },
  skeleton(ctx, e, t, col) {
    ctx.save(); ctx.translate(8, 0); ctx.scale(0.75, 0.75); drawBow(ctx, e.state === 'cast' || e.state === 'wind' ? 10 : 2); ctx.restore();
    circle(ctx, 16, 0, 4, col, 2.5);
    ellipse(ctx, -3, 0, 8, 13, '#cfcabb');
    circle(ctx, 1, 0, e.r * 0.85, col);
    circle(ctx, 6, -4, 3.2, INK, 0); circle(ctx, 6, 4, 3.2, INK, 0);
    circle(ctx, 6, -4, 1.2, '#ff5e5b', 0); circle(ctx, 6, 4, 1.2, '#ff5e5b', 0);
  },
  shroom(ctx, e, t, col) {
    const k = e.state === 'wind' ? 1 + Math.min(1, e.st / 22) * 0.18 : 1 + Math.sin(t * 3 + e.id) * 0.03;
    ctx.rotate(-e.face);
    circle(ctx, 0, 0, e.r * k, col);
    const spots = [[-0.4, -0.3, 0.22], [0.35, -0.35, 0.18], [0.1, 0.35, 0.26], [-0.45, 0.35, 0.14], [0.5, 0.2, 0.12]];
    for (const [x, y, r] of spots) circle(ctx, x * e.r * k, y * e.r * k, r * e.r * k, '#fff4e8', 2);
  },
  golem(ctx, e, t, col) {
    const wind = e.state === 'slamwind' ? Math.min(1, e.st / 50) : 0;
    const fx = e.r * 0.9 + wind * 8;
    circle(ctx, fx, -e.r * 0.85, e.r * 0.42, shade(col, -0.12));
    circle(ctx, fx, e.r * 0.85, e.r * 0.42, shade(col, -0.12));
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const r = e.r * (0.92 + ((i * 37) % 7) / 50); i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-e.r * 0.5, -e.r * 0.2); ctx.lineTo(-e.r * 0.1, 0); ctx.lineTo(-e.r * 0.4, e.r * 0.3); ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); 
    circle(ctx, e.r * 0.45, -e.r * 0.28, 4, '#ffb347', 0); circle(ctx, e.r * 0.45, e.r * 0.28, 4, '#ffb347', 0);
    ctx.restore();
  },
  wisp(ctx, e, t, col) {
    const a = e.state === 'fade' ? 1 - e.st / 20 : 1;
    ctx.globalAlpha *= Math.max(0.1, a);
    for (let i = 3; i >= 1; i--) circle(ctx, -i * 6, Math.sin(t * 8 + i) * 3, e.r * (1 - i * 0.2), `rgba(111,211,255,${0.25 + 0.1 * (3 - i)})`, 0);
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 18; circle(ctx, 0, 0, e.r, col, 3); ctx.restore();
    circle(ctx, -3, -3, e.r * 0.4, 'rgba(255,255,255,.6)', 0);
    eyes(ctx, 5, 4, 2.6, true, INK, '#fff');
  },
  wolf(ctx, e, t, col) {
    const wag = Math.sin(t * 12 + e.id) * 0.4;
    ctx.save(); ctx.translate(-e.r * 1.1, 0); ctx.rotate(Math.PI + wag); ellipse(ctx, 8, 0, 11, 4.5, shade(col, 0.1), 3); ctx.restore();
    ellipse(ctx, -2, 0, e.r * 1.1, e.r * 0.75, col);
    ctx.beginPath(); ctx.ellipse(-4, 0, e.r * 0.7, e.r * 0.3, 0, 0, TAU); ctx.fillStyle = shade(col, -0.25); ctx.fill();
    circle(ctx, e.r * 0.9, 0, e.r * 0.6, shade(col, 0.1));
    ctx.beginPath(); ctx.moveTo(e.r * 0.8, -e.r * 0.4); ctx.lineTo(e.r * 0.45, -e.r * 0.95); ctx.lineTo(e.r * 1.1, -e.r * 0.5); ctx.closePath();
    ctx.moveTo(e.r * 0.8, e.r * 0.4); ctx.lineTo(e.r * 0.45, e.r * 0.95); ctx.lineTo(e.r * 1.1, e.r * 0.5); ctx.closePath();
    ctx.fillStyle = shade(col, -0.1); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    circle(ctx, e.r * 1.45, 0, 3, INK, 0);
    eyes(ctx, e.r * 1.05, 4, 2.2, true, '#ffe45c');
  },
  knight(ctx, e, t, col) {
    // shield
    ctx.save(); ctx.translate(e.r * 0.6, -e.r * 0.85); ctx.rotate(0.3);
    rrect(ctx, -6, -11, 12, 22, 5); ctx.fillStyle = '#5b5f7e'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    circle(ctx, 0, 0, 3.5, '#e84c3d', 2); ctx.restore();
    // sword
    let sw = 0.9;
    if (e.state === 'swing') sw = e.st < 34 ? 0.9 + Math.min(1, e.st / 30) * 1.2 : -1.2;
    ctx.save(); ctx.translate(Math.cos(sw) * e.r * 0.8, Math.sin(sw) * e.r * 0.8); ctx.rotate(sw * 0.8); drawSword(ctx, 44, e.state === 'swing' ? '#ff5e5b' : null); ctx.restore();
    circle(ctx, 0, 0, e.r, col, 4);
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.7, -1.2, 1.2); ctx.strokeStyle = shade(col, 0.25); ctx.lineWidth = 3; ctx.stroke();
    rrect(ctx, e.r * 0.35, -e.r * 0.5, 6, e.r, 3); ctx.fillStyle = INK; ctx.fill();
    ctx.save(); rrect(ctx, e.r * 0.4, -e.r * 0.4, 3.5, e.r * 0.8, 2); ctx.fillStyle = '#ff5e5b'; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-e.r * 0.2, 0); ctx.lineTo(-e.r * 1.2, 0); ctx.strokeStyle = '#e84c3d'; ctx.lineWidth = 5; ctx.stroke();
  },
  imp(ctx, e, t, col) {
    const flap = Math.sin(t * 18 + e.id) * 0.35;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.rotate(s * (2.2 + flap));
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(e.r * 1.6, -6); ctx.lineTo(e.r * 1.3, 2); ctx.lineTo(e.r * 1.7, 8); ctx.closePath();
      ctx.fillStyle = '#7a2a3a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
    }
    circle(ctx, 0, 0, e.r, col);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(2, s * e.r * 0.6); ctx.lineTo(-6, s * e.r * 1.25); ctx.lineTo(-3, s * e.r * 0.5); ctx.closePath(); ctx.fillStyle = '#ffe9c9'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); }
    eyes(ctx, 5, 4.5, 2.8, true, '#ffe45c');
  },
  /** Vorthax, the Riftbound Tyrant (raid boss): a floating obsidian tyrant with a cracked indigo shell, cyan rift runes,
   *  a crown of floating shards and two blade-arms; the core flares magenta during the Rift Lance and cyan in the Ward. */
  raidboss(ctx, e, t, col) {
    const r = e.r, W = e.ward || (e.raidWard), lanceT = e.raidLance;
    const bob = Math.sin(t * 2.2) * 4;
    ctx.save(); ctx.translate(0, bob * 0.2);
    // rift aura
    ctx.save(); ctx.globalAlpha *= 0.35 + 0.1 * Math.sin(t * 3); const g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 1.9); g.addColorStop(0, 'rgba(95,242,255,.55)'); g.addColorStop(1, 'rgba(60,20,140,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.9, 0, TAU); ctx.fill(); ctx.restore();
    // blade arms (sweep during the cleave windup)
    const sw = 0.9 + Math.sin(t * 1.7) * 0.12;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.rotate(s * sw); ctx.translate(r * 0.55, 0);
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(r * 1.35, -3); ctx.lineTo(r * 1.55, 0); ctx.lineTo(r * 1.35, 3); ctx.lineTo(0, 9); ctx.closePath();
      ctx.fillStyle = '#1a1433'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.1, 0); ctx.lineTo(r * 1.45, 0); ctx.strokeStyle = '#5ff2ff'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
    }
    // body: obsidian shell
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, rr = r * (i % 2 ? 0.86 : 1.0); i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.95) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.95); }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(10,6,30,.45)'; ctx.fillRect(-r * 1.2, 0, r * 2.4, r * 1.2); ctx.restore();
    // rune cracks
    ctx.strokeStyle = '#5ff2ff'; ctx.lineWidth = 2.5; ctx.globalAlpha *= 0.85 + 0.15 * Math.sin(t * 6);
    for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35); ctx.lineTo(Math.cos(a + 0.25) * r * 0.62, Math.sin(a + 0.25) * r * 0.62); ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.86); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // core eye
    const core = lanceT ? '#ff4fd8' : W ? '#8ff3ff' : '#5ff2ff';
    circle(ctx, r * 0.18, 0, r * 0.34, '#0c0820', 4);
    circle(ctx, r * 0.24, 0, r * 0.2 + Math.sin(t * 8) * 1.5, core, 0);
    circle(ctx, r * 0.3, -r * 0.05, r * 0.07, '#ffffff', 0);
    // crown of floating shards
    for (let i = 0; i < 7; i++) {
      const a = t * 0.9 + (i / 7) * TAU, x = Math.cos(a) * r * 1.2, y = Math.sin(a) * r * 1.2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + t);
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(5, 0); ctx.lineTo(0, 9); ctx.lineTo(-5, 0); ctx.closePath();
      ctx.fillStyle = i % 2 ? '#5ff2ff' : '#c05cff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  },
  boss(ctx, e, t, col) {
    const r = e.r;
    const rage = e.phase === 3;
    if (rage) { ctx.save(); ctx.globalAlpha *= 0.35 + 0.15 * Math.sin(t * 10); circle(ctx, 0, 0, r * 1.35, '#ff3b1f', 0); ctx.restore(); }
    // club
    let sw = 0.8;
    if (e.state === 'slam') sw = e.st < 50 ? 0.8 - Math.min(1, e.st / 40) * 2.2 : 0.1;
    if (e.state === 'charge') sw = 0.2;
    ctx.save(); ctx.translate(Math.cos(sw) * r * 0.9, Math.sin(sw) * r * 0.9); ctx.rotate(sw * 0.7);
    rrect(ctx, -6, -9, 80, 18, 9); ctx.fillStyle = '#6d4a2c'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    circle(ctx, 76, 0, 20, '#5a3d24', 4);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.beginPath(); ctx.moveTo(76 + Math.cos(a) * 18, Math.sin(a) * 18); ctx.lineTo(76 + Math.cos(a) * 29, Math.sin(a) * 29); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.restore();
    circle(ctx, r * 0.55, -r * 0.8, r * 0.3, '#b98c6a');
    circle(ctx, r * 0.55, r * 0.8, r * 0.3, '#b98c6a');
    // body
    ellipse(ctx, -r * 0.1, 0, r * 0.85, r, col, 5);
    // pauldrons
    for (const s of [-1, 1]) {
      circle(ctx, -r * 0.05, s * r * 0.72, r * 0.38, '#474a5e', 4.5);
      for (let i = 0; i < 3; i++) { const a = s * (0.8 + i * 0.5); ctx.beginPath(); ctx.moveTo(-r * 0.05 + Math.cos(a) * r * 0.3, s * r * 0.72 + Math.sin(a) * r * 0.3); ctx.lineTo(-r * 0.05 + Math.cos(a) * r * 0.62, s * r * 0.72 + Math.sin(a) * r * 0.62); ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = '#d6dae3'; ctx.lineWidth = 4; ctx.stroke(); }
    }
    // head
    circle(ctx, r * 0.25, 0, r * 0.45, '#9b7fb4', 4.5);
    // helm horns
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.1, s * r * 0.3); ctx.quadraticCurveTo(-r * 0.3, s * r * 0.9, r * 0.2, s * r * 1.05); ctx.quadraticCurveTo(-r * 0.05, s * r * 0.6, r * 0.3, s * r * 0.38); ctx.closePath(); ctx.fillStyle = '#f1e6cf'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke(); }
    // tusks
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.55, s * r * 0.12); ctx.lineTo(r * 0.82, s * r * 0.24); ctx.lineTo(r * 0.58, s * r * 0.26); ctx.closePath(); ctx.fillStyle = '#fff8e6'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
    ctx.save(); 
    circle(ctx, r * 0.45, -r * 0.16, 5, rage ? '#ff3b1f' : '#ffcf3a', 0); circle(ctx, r * 0.45, r * 0.16, 5, rage ? '#ff3b1f' : '#ffcf3a', 0);
    ctx.restore();
  },
};

// Enemy types whose idle body is cached: [dominant animation speed (rad/s), frames per cycle]
export const ENEMY_ANIM = { slime: [5, 6], goblin: [0, 1], sprout: [2, 6], boar: [0, 1], skeleton: [0, 1], shroom: [3, 6], golem: [0, 1], wisp: [8, 6], wolf: [12, 6], knight: [0, 1], imp: [18, 6], scarab: [22, 4], jackal: [16, 4], mummy: [5, 6], scarabling: [0, 1], mirage: [6, 6], sunpriest: [4, 6], sandwurm: [3, 4] };
// states whose pose is cached too (perf pass 2): keyed by state + a 3-tick step of the state timer; others draw live
const CACHE_ST = new Set(['wind', 'swing', 'cast', 'throw', 'lunge', 'dash', 'under', 'surface', 'shock', 'slamwind', 'charge', 'roll', 'dive', 'lash', 'snare', 'summon', 'fade', 'dazed']);
const ENEMY_LIT = { rim: 0.42, ao: 0.26, shade: 0.16 };
const BOSS_BUF = new LitBuffer();
let BOSS_LIT = false; // (per-frame lit buffer for bosses: off by default - the boss draws carry their own gradients + rim light; costly in software raster)
export const setBossLit = (v) => { BOSS_LIT = !!v; };
export function drawEnemy(ctx, e, def, t) {
  const down = e.cc.down > 0, stun = e.cc.stun > 0;
  const col = def.color;
  ctx.save();
  ctx.translate(e.x, e.y);
  // painted art (Options > Art style: Painted, once the biome atlas has loaded): a wider, flatter shadow under the taller body
  const painted = paintedEnemyReady(e.type) && !((e.type === 'sandwurm' && (e.state === 'under' || e.state === 'erupt' || e.state === 'idle')) || (e.type === 'khepra' && (e.state === 'under' || e.state === 'erupt')));
  if (painted) shadow(ctx, 0, e.r * 0.5, e.r * 1.25, e.r * 0.5, 0.28); else
  shadow(ctx, 0, e.r * 0.55, e.r * 1.1, e.r * 0.55);
  { const k = kickOf(e.id); if (k) { ctx.translate(k.dx, k.dy); if (k.sq) ctx.scale(1 + k.sq, 1 - k.sq); } } // impact kick along the hit (feel.js)
  const fk = e.flash > 0 && !(e.invuln > 0) ? flashK(e.flash) : 0; let flashed = false; // crisp silhouette hit flash
  if (e.elite) { ctx.save(); ctx.globalAlpha = 0.45 + 0.2 * Math.sin(t * 6); circle(ctx, 0, 0, e.r * 1.45, 'rgba(255,200,40,.25)', 3, '#ffcf3a'); ctx.restore(); }
  // telegraph glow while winding up
  const winding = ['wind', 'slamwind', 'swing', 'shock'].includes(e.state) || (e.boss && ['slam', 'charge', 'stomps'].includes(e.state) && e.st < 50);
  if (winding) { ctx.save(); ctx.globalAlpha = 0.35 + 0.35 * Math.abs(Math.sin(t * 16)); circle(ctx, 0, 0, e.r * 1.3, 'rgba(255,70,50,.45)', 0); ctx.restore(); }
  let ang = e.face;
  if (painted && drawPaintedEnemy(ctx, e, { t, dark: e.type === 'neferakh' && ENEMY_ENV.dark })) { ctx.restore(); enemyOverlays(ctx, e, t, stun, down, enemyTop(e)); return; }
  const anim = !down && !e.boss && ENEMY_ANIM[e.type];
  const idleK = anim && (e.state === 'idle' || e.state === 'recover' || !e.state) && !(e.cc.frozen) ? idleKey(e, ang, t, anim, col) : null;
  if (idleK && spriteBudget(idleK, 3)) { // (world 2 perf: at most 3 new idle sprites per frame; the rest draw live until their turn)
    // cached body (art & perf pass): painted once per facing bucket (32) x animation frame, lit by litPass, then blitted
    const B = TAU / 32, fb = Math.round(ang / B), fa = fb * B, [w, n] = anim;
    const fr = n > 1 ? Math.floor((((t * w) / TAU + e.id * 0.37) % 1) * n) : 0;
    const S = Math.ceil(e.r * 4.4 + 34), draw = ENEMY_DRAW[e.type];
    const c = sprite(idleK, S, S, S / 2, S / 2, (g) => {
      g.rotate(fa); draw(g, { ...e, x: 0, y: 0, face: fa, id: 0, state: 'idle', st: 0, flash: 0, invuln: 0 }, n > 1 ? (fr * TAU) / (w * n) : 0, col);
    }, ENEMY_LIT);
    blit(ctx, c, 0, 0); if (fk) { ctx.globalAlpha = fk; blit(ctx, whiteOf(c), 0, 0); ctx.globalAlpha = 1; flashed = true; } ctx.rotate(fa); // 32 facing buckets: no residual rotation -> axis-aligned blit (cheap)
  } else if (anim && CACHE_ST.has(e.state) && !e.cc.frozen && (CAN_BUF || !(e.flash > 0)) && spriteBudget(`en:${e.type}:${e.r}:${col}:${e.state}:${Math.min(40, e.st) / 3 | 0}:${((Math.round(ang / (TAU / 32)) % 32) + 32) % 32}`)) {
    const B = TAU / 32, fb = Math.round(ang / B), fa = fb * B, [w, n] = anim, stq = (Math.min(40, e.st) / 3) | 0;
    const S = Math.ceil(e.r * 4.4 + 60), draw = ENEMY_DRAW[e.type];
    const c = sprite(`en:${e.type}:${e.r}:${col}:${e.state}:${stq}:${((fb % 32) + 32) % 32}`, S, S, S / 2, S / 2, (g) => {
      g.rotate(fa); draw(g, { ...e, x: 0, y: 0, face: fa, id: 0, st: stq * 3, flash: 0, invuln: 0 }, n > 1 ? (stq * 3) / 60 : 0, col);
    }); // (transient poses: no lit pass, they only live a few frames)
    blit(ctx, c, 0, 0); if (fk) { ctx.globalAlpha = fk; blit(ctx, whiteOf(c), 0, 0); ctx.globalAlpha = 1; flashed = true; } ctx.rotate(fa);
  } else if (e.boss && BOSS_LIT && !down) {
    const S = Math.ceil(e.r * 5 + 120), g = BOSS_BUF.begin(S);
    g.rotate(ang); (ENEMY_DRAW[e.type] || ENEMY_DRAW.slime)(g, { ...e, x: 0, y: 0 }, t, col);
    BOSS_BUF.end(ctx, 0, 0, ENEMY_LIT);
    if (fk) { BOSS_BUF.flash(ctx, 0, 0, fk * 0.9); flashed = true; }
    ctx.rotate(ang);
  } else if (fk && CAN_BUF) { // a live pose that is flashing: paint it into a buffer so its silhouette can light up
    if (down) { ctx.scale(1.15, 0.7); ang += 0.4; }
    const g = FLASH_BUF.begin(Math.ceil(e.r * 5 + 120), e.type + ':' + e.r + ':' + e.state); g.rotate(ang);
    (ENEMY_DRAW[e.type] || ENEMY_DRAW.slime)(g, { ...e, x: 0, y: 0 }, t, col);
    FLASH_BUF.end(ctx, 0, 0, null); FLASH_BUF.flash(ctx, 0, 0, fk); flashed = true;
    ctx.rotate(ang);
  } else {
    if (down) { ctx.scale(1.15, 0.7); ang += 0.4; }
    ctx.rotate(ang);
    (ENEMY_DRAW[e.type] || ENEMY_DRAW.slime)(ctx, e, t, col);
  }
  if ((e.flash > 0 && !flashed) || e.invuln > 0) {
    ctx.globalAlpha = e.invuln > 0 ? 0.3 + 0.2 * Math.sin(t * 30) : Math.min(1, e.flash / 5) * 0.85;
    circle(ctx, 0, 0, e.r * (e.boss ? 1.05 : 1), '#ffffff', 0);
  }
  ctx.restore();
  enemyOverlays(ctx, e, t, stun, down, 0);
}
/** the cache key of an enemy's idle body sprite (facing bucket x animation frame) */
function idleKey(e, ang, t, anim, col) {
  const B = TAU / 32, fb = Math.round(ang / B), [w, n] = anim;
  const fr = n > 1 ? Math.floor((((t * w) / TAU + e.id * 0.37) % 1) * n) : 0;
  return `en:${e.type}:${e.r}:${col}:${((fb % 32) + 32) % 32}:${fr}`;
}
/** frozen / rooted / stun stars over an enemy (top: painted art height above the position, 0 = the top-down body) */
function enemyOverlays(ctx, e, t, stun, down, top) {
  if (e.cc.frozen) {
    ctx.save(); ctx.globalAlpha = 0.6; circle(ctx, e.x, e.y, e.r * 1.15, 'rgba(170,230,255,.55)', 3, '#dff7ff');
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r); }
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
  if (e.cc.rooted) {
    ctx.save(); ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.5; ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * e.r * 1.4, e.y + Math.sin(a) * e.r * 1.4); ctx.quadraticCurveTo(e.x + Math.cos(a + 0.8) * e.r, e.y + Math.sin(a + 0.8) * e.r, e.x, e.y); ctx.stroke(); }
    ctx.restore();
  }
  if ((stun && !e.cc.frozen) || down) {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i / 3) * TAU;
      star(ctx, e.x + Math.cos(a) * (top ? Math.max(e.r * 0.8, 22) : e.r * 0.8), (top ? e.y - top - 4 : e.y - e.r - 6) + Math.sin(a) * 4, top ? 7 : 5, '#ffe45c');
    }
  }
}

export function star(ctx, x, y, r, fill, lw = 2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); }
}

// ------------------------------------------------------------------ environment
const TREE_COL = {
  0: ['#4fb548', '#72d35c'], 1: ['#45a844', '#68c957'], 2: ['#3a8f46', '#57ad55'],
  3: ['#df8a2d', '#f4b24c'], 4: ['#6b5a7a', '#86749a'],
};
export function drawTreeShadow(ctx, o) { shadow(ctx, o.x + 8, o.y + 12, o.size * 0.95, o.size * 0.62, 0.2); }
export function drawTree(ctx, o, alpha = 1) {
  const [base, hi] = TREE_COL[o.zone] || TREE_COL[1];
  const s = o.size;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (o.zone === 2 && o.variant % 3 === 0) {
    // pine: layered star
    for (let layer = 0; layer < 3; layer++) {
      const r = s * (1 - layer * 0.28);
      ctx.beginPath();
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + layer * 0.2; const rr = i % 2 ? r * 0.78 : r; i ? ctx.lineTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr) : ctx.moveTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fillStyle = layer === 0 ? '#2f7a3d' : layer === 1 ? '#3b9149' : '#4fa855'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    }
  } else if (o.zone === 4 && o.variant % 2 === 0) {
    // gnarled dead tree: thick tapering branches + trunk + a few purple leaves
    ctx.lineCap = 'round';
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + o.variant * 0.37;
      const L = s * (0.6 + ((o.variant >> i) % 3) * 0.1);
      const mx = o.x + Math.cos(a) * L * 0.55, my = o.y + Math.sin(a) * L * 0.55;
      const ex = o.x + Math.cos(a + 0.35) * L, ey = o.y + Math.sin(a + 0.35) * L;
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.strokeStyle = INK; ctx.lineWidth = 15; ctx.stroke(); ctx.strokeStyle = '#6a5446'; ctx.lineWidth = 9; ctx.stroke();
      circle(ctx, ex, ey, 7, '#9a6fb8', 3);
    }
    circle(ctx, o.x, o.y, s * 0.3, '#6a5446', 4.5);
    circle(ctx, o.x, o.y, s * 0.17, '#57443a', 0);
    ctx.beginPath(); ctx.arc(o.x, o.y, s * 0.22, 0, TAU); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.stroke();
  } else {
    circle(ctx, o.x, o.y, s, base, 4.5);
    // bumpy highlight lobes
    ctx.fillStyle = hi;
    ctx.beginPath(); ctx.arc(o.x - s * 0.18, o.y - s * 0.2, s * 0.62, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(base, -0.12);
    const v = o.variant;
    for (let i = 0; i < 4; i++) { const a = v + i * 1.7; const rr = s * (0.35 + ((v >> i) % 3) * 0.12); circle(ctx, o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr, s * 0.1, shade(base, -0.12), 0); }
    ctx.beginPath(); ctx.arc(o.x - s * 0.3, o.y - s * 0.35, s * 0.18, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fill();
    if (o.zone === 3 && v % 4 === 0) for (let i = 0; i < 5; i++) circle(ctx, o.x + Math.cos(v + i * 2) * s * 0.5, o.y + Math.sin(v + i * 2) * s * 0.5, 4, '#ffdd66', 2);
    if (o.zone <= 1 && v % 5 === 0) for (let i = 0; i < 4; i++) circle(ctx, o.x + Math.cos(v + i * 1.6) * s * 0.55, o.y + Math.sin(v + i * 1.6) * s * 0.55, 4.5, '#ff5e5b', 2.5);
  }
  ctx.restore();
}

const ROCK_COL = { 0: '#a8adb5', 1: '#a3a9b2', 2: '#9aa1ab', 3: '#b09a84', 4: '#6d6a78' };
export function drawRock(ctx, o) {
  const s = o.size;
  shadow(ctx, o.x + 5, o.y + s * 0.55, s * 1.05, s * 0.5, 0.25);
  const col = ROCK_COL[o.zone] || ROCK_COL[2];
  ctx.beginPath();
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (o.variant % 10) * 0.1;
    const r = s * (0.85 + (((o.variant * (i + 3)) % 17) / 17) * 0.3);
    i ? ctx.lineTo(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r) : ctx.moveTo(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(o.x - s * 0.22, o.y - s * 0.25, s * 0.45, s * 0.3, -0.4, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(o.x + s * 0.1, o.y + s * 0.1); ctx.lineTo(o.x + s * 0.4, o.y + s * 0.3); ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 2.5; ctx.stroke();
}
export function drawPillar(ctx, o) {
  shadow(ctx, o.x + 6, o.y + 16, o.size * 1.1, o.size * 0.55, 0.3);
  circle(ctx, o.x, o.y, o.size, '#5d586b', 4.5);
  circle(ctx, o.x, o.y, o.size * 0.7, '#77718a', 3);
  circle(ctx, o.x - 5, o.y - 5, o.size * 0.3, 'rgba(255,255,255,.18)', 0);
  ctx.save(); circle(ctx, o.x, o.y, 5, '#ff5e3b', 0); ctx.restore();
}
const BUSH_COL = { 0: '#3fa33e', 1: '#3a9c3c', 2: '#4d8f3a', 3: '#b7822f', 4: '#5c4a66' };
export function drawBush(ctx, d) {
  const col = BUSH_COL[d.zone] || BUSH_COL[1];
  const s = d.size;
  shadow(ctx, d.x + 4, d.y + s * 0.4, s * 1.1, s * 0.45, 0.18);
  const lobes = [[-0.45, 0.1, 0.62], [0.45, 0.12, 0.6], [0, -0.3, 0.7]];
  ctx.beginPath(); for (const [x, y, r] of lobes) { ctx.moveTo(d.x + x * s + r * s, d.y + y * s); ctx.arc(d.x + x * s, d.y + y * s, r * s, 0, TAU); }
  ctx.lineWidth = 7.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = col; ctx.fill();
  circle(ctx, d.x - s * 0.1, d.y - s * 0.42, s * 0.3, 'rgba(255,255,255,.18)', 0);
  if (d.variant % 3 === 0 && d.zone <= 1) { circle(ctx, d.x + s * 0.3, d.y - s * 0.1, 3.5, '#ff6b8b', 2); circle(ctx, d.x - s * 0.4, d.y + s * 0.05, 3.5, '#ffe45c', 2); }
}

// ------------------------------------------------------------------ loot bag
export const BAG_COL = ['#b07a45', '#3f8cf0', '#a45cf0', '#ffb52e', '#1fbfa2', '#e8396a'];
export function drawBag(ctx, x, y, rarity, t) {
  const col = BAG_COL[rarity] || BAG_COL[0];
  const bob = Math.sin(t * 4 + x) * 2;
  shadow(ctx, x, y + 11, 14, 6, 0.28);
  if (rarity >= 2) { ctx.save(); ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 5); circle(ctx, x, y, 26, col, 0); ctx.restore(); }
  ctx.save(); ctx.translate(x, y + bob);
  ctx.beginPath(); ctx.moveTo(-13, 10); ctx.quadraticCurveTo(-16, -6, -6, -9); ctx.lineTo(6, -9); ctx.quadraticCurveTo(16, -6, 13, 10); ctx.quadraticCurveTo(0, 15, -13, 10); ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-7, -9); ctx.lineTo(-10, -16); ctx.lineTo(10, -16); ctx.lineTo(7, -9); ctx.fillStyle = shade(col, -0.2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8, -9); ctx.lineTo(8, -9); ctx.strokeStyle = '#ffe45c'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-5, 0, 3, 5, 0.3, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ item icons (inventory / tooltips)
export function drawItemIcon(ctx, item, size) {
  const cols = ['#d9dde3', '#4aa8ff', '#b86bff', '#ffb52e', '#2ee6c4', '#ff4f7b', '#ff6ad5', '#ff3b3b'];
  const rc = cols[item.rarity] || cols[0];
  if (item.slot === 'sigil') return drawSigilIcon(ctx, size);
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  const k = size / 48;
  ctx.scale(k, k);
  if (item.slot === 'weapon') {
    ctx.rotate(-Math.PI / 4);
    if (item.cls === 'warrior') { ctx.translate(-22, 0); drawSword(ctx, 34, item.rarity >= 2 ? rc : null); }
    else if (item.cls === 'ranger') { ctx.rotate(Math.PI / 4); ctx.translate(-12, 0); drawBow(ctx, 0); }
    else if (item.cls === 'cleric') { ctx.translate(-18, 0); drawMace(ctx, 26, item.rarity >= 2 ? rc : null); }
    else if (item.cls === 'monk') { for (const [dx, dy] of [[-8, 4], [8, -4]]) { ctx.beginPath(); ctx.arc(dx, dy, 11, 0, TAU); ctx.fillStyle = '#f0c9a0'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.beginPath(); ctx.arc(dx, dy, 11, -1.1, 1.1); ctx.strokeStyle = item.rarity >= 2 ? rc : '#f4ead8'; ctx.lineWidth = 5; ctx.stroke(); } }
    else if (item.cls === 'dragoon') { ctx.translate(-30, 0); drawSpear(ctx, 34, item.rarity >= 2 ? rc : null, 2); }
    else if (item.cls === 'samurai') { ctx.rotate(-Math.PI / 4); ctx.translate(-24, 0); drawKatana(ctx, 36, item.rarity >= 2 ? rc : null); }
    else if (item.cls === 'bladedancer') { ctx.save(); ctx.translate(-14, -7); drawDagger(ctx, 20, item.rarity >= 2 ? rc : null); ctx.restore(); ctx.translate(-14, 8); drawDagger(ctx, 20, item.rarity >= 2 ? rc : null); }
    else if (item.cls === 'summoner') { ctx.rotate(Math.PI / 4); ctx.scale(1.6, 1.6); ctx.translate(-8, 0); drawGrimoire(ctx, 0.2, 0, item.rarity >= 2 ? rc : null); }
    else if (item.cls === 'bard') { ctx.scale(1.3, 1.3); ctx.translate(-8, 0); drawLute(ctx, 0, item.rarity >= 2 ? rc : null); }
    else { ctx.translate(-18, 0); drawStaff(ctx, rc, 0); }
  } else if (GEAR_ICON[item.slot]) {
    GEAR_ICON[item.slot](ctx, rc, item); // gear expansion: off-hand (by class), helm, gloves, boots, amulet, relic
  } else if (item.slot === 'armor') {
    ctx.beginPath(); ctx.moveTo(-16, -14); ctx.lineTo(-6, -18); ctx.quadraticCurveTo(0, -12, 6, -18); ctx.lineTo(16, -14); ctx.lineTo(18, -2); ctx.lineTo(12, 0); ctx.lineTo(12, 18); ctx.lineTo(-12, 18); ctx.lineTo(-12, 0); ctx.lineTo(-18, -2); ctx.closePath();
    ctx.fillStyle = rc; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 18); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3; ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(0, 4, 13, 0, TAU); ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.stroke(); ctx.strokeStyle = '#f2c23a'; ctx.lineWidth = 5; ctx.stroke();
    ctx.save(); ctx.shadowColor = rc; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(8, -9); ctx.lineTo(0, 0); ctx.lineTo(-8, -9); ctx.closePath(); ctx.fillStyle = rc; ctx.fill(); ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  }
  if (item.set) setEmblem(ctx); // the Sunscorch sun-disc badge
  ctx.restore();
}

// ------------------------------------------------------------------ gear expansion icons (48-unit space, centred, ink outlines)
const ink = (ctx, w = 3) => { ctx.lineWidth = w; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); };
const inkShade = (ctx) => { ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3; ctx.stroke(); };
function iconShield(ctx, rc, round) {
  ctx.beginPath();
  if (round) ctx.arc(0, 0, 18, 0, TAU);
  else { ctx.moveTo(0, -19); ctx.quadraticCurveTo(12, -14, 17, -15); ctx.quadraticCurveTo(17, 8, 0, 20); ctx.quadraticCurveTo(-17, 8, -17, -15); ctx.quadraticCurveTo(-12, -14, 0, -19); ctx.closePath(); }
  ctx.fillStyle = rc; ctx.fill(); ink(ctx, 3.5);
  ctx.beginPath(); if (round) ctx.arc(0, 0, 6, 0, TAU); else { ctx.moveTo(0, -13); ctx.lineTo(0, 14); ctx.moveTo(-10, -4); ctx.lineTo(10, -4); }
  if (round) { ctx.fillStyle = '#e8e2d4'; ctx.fill(); ink(ctx, 2.5); } else { ctx.strokeStyle = '#f4ead8'; ctx.lineWidth = 3; ctx.stroke(); }
}
const OFF_ICON = {
  warrior: (ctx, rc) => iconShield(ctx, rc, false),
  cleric: (ctx, rc) => { iconShield(ctx, rc, false); ctx.beginPath(); ctx.arc(0, -2, 5, 0, TAU); ctx.fillStyle = '#ffd23f'; ctx.fill(); ink(ctx, 2); },
  dragoon: (ctx, rc) => iconShield(ctx, rc, true),
  ranger: (ctx, rc) => { ctx.rotate(0.35); ctx.beginPath(); ctx.roundRect(-8, -12, 16, 30, 4); ctx.fillStyle = '#8a5a32'; ctx.fill(); ink(ctx); for (const x of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(x, -12); ctx.lineTo(x, -20); ink(ctx, 2); ctx.beginPath(); ctx.moveTo(x - 3, -20); ctx.lineTo(x, -24); ctx.lineTo(x + 3, -20); ctx.closePath(); ctx.fillStyle = rc; ctx.fill(); ink(ctx, 1.5); } ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.strokeStyle = rc; ctx.lineWidth = 3; ctx.stroke(); },
  mage: (ctx, rc) => { ctx.beginPath(); ctx.moveTo(-10, 16); ctx.lineTo(10, 16); ctx.lineTo(6, 8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fillStyle = '#8a5a32'; ctx.fill(); ink(ctx, 2.5); ctx.save(); ctx.shadowColor = rc; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(0, -4, 12, 0, TAU); ctx.fillStyle = rc; ctx.fill(); ctx.restore(); ink(ctx); ctx.beginPath(); ctx.arc(-4, -8, 3.5, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill(); },
  bladedancer: (ctx, rc) => { for (let i = -3; i <= 3; i++) { const a = -Math.PI / 2 + i * 0.28; ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(Math.cos(a - 0.12) * 22, 14 + Math.sin(a - 0.12) * 22); ctx.lineTo(Math.cos(a + 0.12) * 22, 14 + Math.sin(a + 0.12) * 22); ctx.closePath(); ctx.fillStyle = i % 2 ? rc : '#f4ead8'; ctx.fill(); ink(ctx, 2); } ctx.beginPath(); ctx.arc(0, 14, 3, 0, TAU); ctx.fillStyle = INK; ctx.fill(); },
  samurai: (ctx, rc) => { ctx.rotate(-Math.PI / 4); ctx.translate(-16, 0); drawKatana(ctx, 24, rc); },
  monk: (ctx, rc) => { for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * 13, Math.sin(a) * 13 - 2, 4, 0, TAU); ctx.fillStyle = i % 4 ? '#8a5a32' : rc; ctx.fill(); ink(ctx, 1.8); } ctx.beginPath(); ctx.moveTo(0, 11); ctx.lineTo(0, 20); ctx.strokeStyle = rc; ctx.lineWidth = 3; ctx.stroke(); },
  summoner: (ctx, rc) => { ctx.rotate(-0.6); ctx.beginPath(); ctx.moveTo(0, 20); ctx.quadraticCurveTo(12, -2, 2, -20); ctx.quadraticCurveTo(-10, -2, 0, 20); ctx.closePath(); ctx.fillStyle = rc; ctx.fill(); ink(ctx); ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(1, -14); inkShade(ctx); },
  bard: (ctx, rc) => { ctx.beginPath(); ctx.roundRect(-15, -13, 30, 26, 3); ctx.fillStyle = rc; ctx.fill(); ink(ctx); ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(0, 13); inkShade(ctx); ctx.beginPath(); ctx.arc(-6, 4, 2.5, 0, TAU); ctx.arc(6, 1, 2.5, 0, TAU); ctx.fillStyle = INK; ctx.fill(); ctx.beginPath(); ctx.moveTo(-3.5, 4); ctx.lineTo(-3.5, -6); ctx.lineTo(8.5, -9); ctx.lineTo(8.5, 1); ink(ctx, 1.6); },
};
export const GEAR_ICON = {
  offhand: (ctx, rc, it) => (OFF_ICON[it.cls] || OFF_ICON.warrior)(ctx, rc),
  helm: (ctx, rc) => { ctx.beginPath(); ctx.moveTo(-16, 10); ctx.quadraticCurveTo(-17, -17, 0, -18); ctx.quadraticCurveTo(17, -17, 16, 10); ctx.lineTo(9, 10); ctx.lineTo(9, 16); ctx.lineTo(-9, 16); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fillStyle = rc; ctx.fill(); ink(ctx, 3.5); ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, -4); inkShade(ctx); },
  gloves: (ctx, rc) => { ctx.beginPath(); ctx.moveTo(-10, 18); ctx.lineTo(-11, 0); ctx.lineTo(-15, -6); ctx.quadraticCurveTo(-14, -10, -9, -6); ctx.lineTo(-9, -16); ctx.quadraticCurveTo(-6, -19, -4, -16); ctx.lineTo(-3, -19); ctx.quadraticCurveTo(0, -21, 2, -18); ctx.lineTo(3, -17); ctx.quadraticCurveTo(6, -19, 8, -15); ctx.lineTo(9, -11); ctx.quadraticCurveTo(12, -12, 12, -8); ctx.lineTo(11, 6); ctx.lineTo(10, 18); ctx.closePath(); ctx.fillStyle = rc; ctx.fill(); ink(ctx, 3); ctx.beginPath(); ctx.rect(-12, 10, 24, 8); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill(); ink(ctx, 2.5); },
  boots: (ctx, rc) => { ctx.beginPath(); ctx.moveTo(-8, -18); ctx.lineTo(6, -18); ctx.lineTo(6, 6); ctx.lineTo(18, 10); ctx.quadraticCurveTo(20, 18, 14, 18); ctx.lineTo(-10, 18); ctx.lineTo(-9, 6); ctx.closePath(); ctx.fillStyle = rc; ctx.fill(); ink(ctx, 3.5); ctx.beginPath(); ctx.moveTo(-9, -10); ctx.lineTo(6, -10); inkShade(ctx); ctx.beginPath(); ctx.moveTo(-10, 15); ctx.lineTo(18, 15); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 3; ctx.stroke(); },
  amulet: (ctx, rc) => { ctx.beginPath(); ctx.moveTo(-14, -20); ctx.quadraticCurveTo(-14, 0, 0, 4); ctx.quadraticCurveTo(14, 0, 14, -20); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#f2c23a'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.save(); ctx.shadowColor = rc; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(9, 9); ctx.lineTo(0, 20); ctx.lineTo(-9, 9); ctx.closePath(); ctx.fillStyle = rc; ctx.fill(); ctx.restore(); ink(ctx, 3); ctx.beginPath(); ctx.moveTo(-3, 7); ctx.lineTo(0, 4); inkShade(ctx); },
  relic: (ctx, rc) => { ctx.save(); ctx.globalAlpha = 0.35; const g = ctx.createRadialGradient(0, 0, 3, 0, 0, 24); g.addColorStop(0, rc); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(-24, -24, 48, 48); ctx.restore(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.lineTo(Math.cos(a + 0.2) * (i % 2 ? 16 : 21), Math.sin(a + 0.2) * (i % 2 ? 16 : 21)); ctx.lineTo(Math.cos(a + 0.4) * 9, Math.sin(a + 0.4) * 9); ctx.fillStyle = i % 2 ? '#d98a16' : '#ffcf4a'; ctx.fill(); ink(ctx, 1.5); } ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(9, 0); ctx.lineTo(0, 12); ctx.lineTo(-9, 0); ctx.closePath(); ctx.fillStyle = rc; ctx.fill(); ink(ctx, 3); ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 12); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.4; ctx.stroke(); },
};

// ------------------------------------------------------------------ exclusive-tier icons (Sunscorch Set badge, Trial Sigil)
/** A small winged sun-disc badge in the icon's corner (drawn in the 48-unit icon space). */
function setEmblem(ctx) {
  ctx.save(); ctx.translate(13, -13);
  ctx.beginPath(); ctx.moveTo(-15, 0); ctx.quadraticCurveTo(-9, -7, -4, -2); ctx.quadraticCurveTo(-9, 3, -15, 0); ctx.moveTo(15, 0); ctx.quadraticCurveTo(9, -7, 4, -2); ctx.quadraticCurveTo(9, 3, 15, 0);
  ctx.fillStyle = '#2ee6c4'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7); g.addColorStop(0, '#fff6c8'); g.addColorStop(0.6, '#ffcf4a'); g.addColorStop(1, '#d98a16');
  ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, TAU); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2.2; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 4.5, -2.6, -1.2); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.restore();
}
/** The Trial Sigil: a rose-gold medallion, an eclipsed sun with a cracked eye of Neferakh, rays and rim light. */
function drawSigilIcon(ctx, size) {
  ctx.save(); ctx.clearRect(0, 0, size, size); ctx.translate(size / 2, size / 2); const k = size / 48; ctx.scale(k, k);
  ctx.save(); ctx.globalAlpha = 0.35; const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 24); halo.addColorStop(0, '#ff4f7b'); halo.addColorStop(1, 'rgba(255,79,123,0)'); ctx.fillStyle = halo; ctx.fillRect(-24, -24, 48, 48); ctx.restore();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.12) * 15, Math.sin(a - 0.12) * 15); ctx.lineTo(Math.cos(a) * (i % 2 ? 20 : 23), Math.sin(a) * (i % 2 ? 20 : 23)); ctx.lineTo(Math.cos(a + 0.12) * 15, Math.sin(a + 0.12) * 15); ctx.closePath(); ctx.fillStyle = i % 2 ? '#d98a16' : '#ffcf4a'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke(); }
  const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, 17); g.addColorStop(0, '#ffd0dc'); g.addColorStop(0.55, '#ff4f7b'); g.addColorStop(1, '#8a1f45');
  ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 12.5, 0, TAU); ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 1.6; ctx.stroke();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12.5, Math.sin(a) * 12.5); ctx.lineTo(Math.cos(a) * 14.5, Math.sin(a) * 14.5); ctx.strokeStyle = 'rgba(43,36,51,.55)'; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, TAU); ctx.fillStyle = '#2a1033'; ctx.fill(); ctx.beginPath(); ctx.arc(2.5, -1.5, 8, 0, TAU); ctx.fillStyle = '#ffe9a0'; ctx.globalAlpha = 0.9; ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, TAU); ctx.clip(); ctx.beginPath(); ctx.arc(-3.5, 1.5, 8, 0, TAU); ctx.fillStyle = '#2a1033'; ctx.restore(); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.ellipse(0, 0, 6.5, 3.4, 0, 0, TAU); ctx.fillStyle = '#ffe9a0'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, TAU); ctx.fillStyle = '#ff4f7b'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-1, -16); ctx.lineTo(1, -10); ctx.lineTo(-1.5, -6); ctx.moveTo(6, 7); ctx.lineTo(9, 12); ctx.strokeStyle = 'rgba(43,36,51,.7)'; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 16, -2.7, -1.0); ctx.strokeStyle = 'rgba(255,240,245,.85)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 16, 0.5, 1.6); ctx.strokeStyle = 'rgba(46,230,196,.7)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.restore();
}
