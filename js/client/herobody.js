// Hero body rig (pass 2): taller, less chibi heroes in the game's own code-drawn style. A smaller head on broad,
// angular shoulders; layered armour plates / cloth mantles with trim; folds; painted light->shade wash, a warm rim
// light on the lit silhouette and a cool occlusion edge. The torso + head (all the static layers) are painted once per
// look and facing bucket into the sprite cache and blitted; only the feet, capes and little wind-blown tails stay live.
import { INK, circle, shade, rrect, drawHair, hairDetail } from './art.js';
import { sprite, spriteBudget, spriteScale } from './sprite.js';
const TAU = Math.PI * 2, BUCKETS = 32; // light-direction buckets of the cached core (the blit itself rotates continuously)

/** per-class kit: cloth (null = the hero's outfit colour), plate metal, trim, armour style, glove + boot colours */
export const HERO_KIT = {
  warrior: { plate: '#aeb8c8', trim: '#e8c35a', armor: 'plate', glove: '#6d7484', boot: '#4a3426', cape: '#a3242f' },
  ranger: { plate: '#8a6038', trim: '#d9c08a', armor: 'leather', glove: '#6b4a2c', boot: '#4a3426', cape: '#3f6b34' },
  mage: { plate: '#e9d7a8', trim: '#f2d27a', armor: 'robe', glove: null, boot: '#3a2c4a', cape: '#4b2f86' },
  cleric: { cloth: '#f4efe2', plate: '#e9c45a', trim: '#fff6d0', armor: 'plate', glove: '#d9b24a', boot: '#6b5536', cape: '#f4efe2' },
  bladedancer: { plate: '#3a2a3e', trim: '#ff5fb0', armor: 'leather', glove: '#2e2232', boot: '#2e2232' },
  samurai: { cloth: '#2c2f4a', plate: '#a8323e', trim: '#ff8cc6', armor: 'lamellar', glove: '#2c2f4a', boot: '#2a2433' },
  monk: { cloth: '#ff9a2e', plate: '#c4501a', trim: '#ffd23f', armor: 'robe', glove: '#f4ead8', boot: '#7a3b12' },
  dragoon: { cloth: '#2f2785', plate: '#4a3bc4', trim: '#ff3b5c', armor: 'plate', glove: '#3a2fa8', boot: '#241c5c' },
  summoner: { cloth: '#2c4a7a', plate: '#1d8a7a', trim: '#f2b632', armor: 'robe', glove: null, boot: '#1c2a44' },
  bard: { cloth: '#e0528f', plate: '#ffd86a', trim: '#b8285f', armor: 'doublet', glove: '#7a1f4a', boot: '#4a2a1a' },
};
const kitOf = (cls) => HERO_KIT[cls] || HERO_KIT.warrior;
/** walk blend 0..1 (the renderer eases it: client/smooth.js), so the stride / sway fade in and out instead of popping */
export const walkK = (h) => (h.moveK != null ? h.moveK : h.moving ? 1 : 0);

/** the angular torso silhouette (hero frame: +x = facing) */
export function torsoPath(g) {
  g.beginPath(); g.moveTo(7.5, -9);
  g.quadraticCurveTo(6.5, -15, 1.5, -17.5); g.lineTo(-6, -18.6); g.quadraticCurveTo(-11, -17.4, -12.3, -11);
  g.quadraticCurveTo(-13.8, 0, -12.3, 11); g.quadraticCurveTo(-11, 17.4, -6, 18.6); g.lineTo(1.5, 17.5);
  g.quadraticCurveTo(6.5, 15, 7.5, 9); g.quadraticCurveTo(9.6, 0, 7.5, -9); g.closePath();
}
const wash = (g, la, base, r = 18, lo = 0.28, hi = -0.32) => {
  const c = Math.cos(la) * r, s = Math.sin(la) * r, gr = g.createLinearGradient(c, s, -c, -s);
  gr.addColorStop(0, shade(base, lo)); gr.addColorStop(0.5, base); gr.addColorStop(1, shade(base, hi)); return gr;
};
/** clip to the half-plane facing the light (k = offset along the light direction) */
const halfPlane = (g, la, k, flip = false) => { g.rotate(la); g.beginPath(); if (flip) g.rect(-60, -60, 60 - k, 120); else g.rect(k, -60, 60, 120); g.rotate(-la); g.clip(); };
function rim(g, la, path, col = 'rgba(255,244,214,.75)', w = 2.2) {
  g.save(); path(g); g.clip(); halfPlane(g, la, 3); path(g); g.strokeStyle = col; g.lineWidth = w * 2; g.stroke(); g.restore();
  g.save(); path(g); g.clip(); halfPlane(g, la, -3, true); path(g); g.strokeStyle = 'rgba(30,20,60,.32)'; g.lineWidth = w * 2.4; g.stroke(); g.restore();
}

function pauldron(g, sy, la, plate, trim, k, cloth) {
  // k = 0 (top plate) .. 2 (lowest); each plate is an angular cap, stacked down the upper arm
  const o = k * 1.7, w = 1 - k * 0.08;
  const path = (q) => { q.beginPath(); q.moveTo(5.5 - o, sy * (10.5 + o * 0.6)); q.quadraticCurveTo(4.5 - o, sy * (20.5 + o), -3 - o, sy * (21.5 + o * 0.9) * w + sy * (1 - w) * 18); q.lineTo(-10.5 - o * 0.6, sy * (19 + o * 0.5)); q.quadraticCurveTo(-12.5 - o * 0.4, sy * (14 + o * 0.4), -10 - o * 0.3, sy * (10 + o * 0.3)); q.closePath(); };
  path(g); g.fillStyle = wash(g, la, cloth ? cloth : plate, 14, 0.35 - k * 0.12, -0.3 - k * 0.08); g.fill(); g.lineWidth = 2.1; g.strokeStyle = INK; g.stroke();
  if (k === 0) { // trim band + rivets on the top plate
    g.beginPath(); g.moveTo(4.6, sy * 12); g.quadraticCurveTo(3.4, sy * 19, -3.2, sy * 19.8); g.lineTo(-9, sy * 17.6); g.strokeStyle = trim; g.lineWidth = 1.4; g.stroke();
    if (!cloth) for (const [x, y] of [[1.5, 15], [-6, 17]]) { circle(g, x, sy * y, 0.9, shade(trim, 0.3), 0); }
  }
  // rim highlight on the outer edge when that shoulder faces the light
  const lit = Math.sin(la) * sy;
  if (lit > -0.2) { g.beginPath(); g.moveTo(4.8 - o, sy * (12 + o * 0.6)); g.quadraticCurveTo(3.8 - o, sy * (20.6 + o), -3 - o, sy * (21 + o * 0.9)); g.strokeStyle = `rgba(255,248,226,${(0.35 + lit * 0.45).toFixed(2)})`; g.lineWidth = 1.3; g.stroke(); }
}
function mantle(g, sy, la, cloth, trim) {
  // soft cloth shoulders: two overlapping draped layers with fold lines
  for (let k = 1; k >= 0; k--) {
    const o = k * 2.2;
    g.beginPath(); g.moveTo(6 - o, sy * 9.5); g.quadraticCurveTo(5 - o, sy * (19 + o), -4 - o, sy * (20.5 + o * 0.6)); g.quadraticCurveTo(-11.5 - o * 0.5, sy * (18 + o * 0.4), -11.8, sy * 9); g.closePath();
    g.fillStyle = wash(g, la, k ? shade(cloth, -0.18) : cloth, 14, 0.3, -0.3); g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
  }
  g.beginPath(); for (const f of [-7, -2.5, 2]) { g.moveTo(f, sy * 11); g.quadraticCurveTo(f - 1, sy * 16, f - 2.6, sy * 19.5); } g.strokeStyle = 'rgba(30,15,40,.35)'; g.lineWidth = 1.1; g.stroke();
  g.beginPath(); g.moveTo(5.3, sy * 11); g.quadraticCurveTo(4.4, sy * 18.6, -4, sy * 20); g.strokeStyle = trim; g.lineWidth = 1.5; g.stroke();
}

/** paint the static torso + head of a hero (hero frame, light angle la) */
function paintCore(g, cls, c, la, uw, tuck) {
  const K = kitOf(cls), cloth = K.cloth || c.outfit;
  // torso: painted cloth base
  torsoPath(g); g.fillStyle = wash(g, la, cloth); g.fill(); g.lineWidth = 3.2; g.strokeStyle = INK; g.stroke();
  // back folds / panels (cloth) - curved creases following the shoulder blades
  g.save(); torsoPath(g); g.clip();
  g.beginPath(); for (const y of [-11, -5.5, 0, 5.5, 11]) { g.moveTo(-12.5, y); g.quadraticCurveTo(-8, y + (y > 0 ? 2.4 : y < 0 ? -2.4 : 0) , -3.5, y * 0.9); } g.strokeStyle = 'rgba(30,15,45,.30)'; g.lineWidth = 1.2; g.stroke();
  g.beginPath(); for (const y of [-8.5, 3]) { g.moveTo(-12, y); g.quadraticCurveTo(-8, y + 1.5, -4, y + 0.6); } g.strokeStyle = 'rgba(255,245,225,.18)'; g.lineWidth = 1; g.stroke();
  // armour
  if (K.armor === 'plate') {
    // breastplate (front) with a raised keel, back plates in overlapping bands
    const bp = (q) => { q.beginPath(); q.moveTo(7.6, -8.6); q.quadraticCurveTo(9.8, 0, 7.6, 8.6); q.lineTo(0.5, 11.5); q.quadraticCurveTo(-2.5, 0, 0.5, -11.5); q.closePath(); };
    bp(g); g.fillStyle = wash(g, la, K.plate, 12, 0.4, -0.35); g.fill(); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.moveTo(1.5, 0); g.lineTo(8.6, 0); g.strokeStyle = 'rgba(30,20,50,.35)'; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.moveTo(1.5, -1.2); g.lineTo(8.4, -1.2); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 0.8; g.stroke();
    bp(g); g.save(); g.clip(); g.beginPath(); g.moveTo(7.6, -8.6); g.quadraticCurveTo(9.8, 0, 7.6, 8.6); g.strokeStyle = K.trim; g.lineWidth = 2.6; g.stroke(); g.restore();
    for (let i = 0; i < 3; i++) { const x = -4.5 - i * 3; g.beginPath(); g.moveTo(x, -15.5 + i); g.quadraticCurveTo(x - 1.6, 0, x, 15.5 - i); g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke(); g.beginPath(); g.moveTo(x + 0.9, -14.5 + i); g.quadraticCurveTo(x - 0.7, 0, x + 0.9, 14.5 - i); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1; g.stroke(); }
    for (const y of [-6, 6]) circle(g, 5.2, y, 0.95, shade(K.trim, 0.25), 0);
  } else if (K.armor === 'leather') {
    // brigandine vest with stitched seams + a bandolier across the chest
    g.beginPath(); g.moveTo(7.4, -8.5); g.quadraticCurveTo(9.4, 0, 7.4, 8.5); g.lineTo(-1, 12); g.quadraticCurveTo(-4, 0, -1, -12); g.closePath(); g.fillStyle = wash(g, la, K.plate, 12, 0.3, -0.35); g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
    g.setLineDash([1.6, 1.8]); g.beginPath(); g.moveTo(6.3, -7.5); g.quadraticCurveTo(8.2, 0, 6.3, 7.5); g.moveTo(0, -10.5); g.quadraticCurveTo(-2.6, 0, 0, 10.5); g.strokeStyle = shade(K.trim, -0.1); g.lineWidth = 0.9; g.stroke(); g.setLineDash([]);
    g.beginPath(); g.moveTo(-11.5, -14); g.lineTo(7.5, 11); g.strokeStyle = INK; g.lineWidth = 4.4; g.stroke(); g.strokeStyle = shade(K.plate, -0.25); g.lineWidth = 2.6; g.stroke();
    rrect(g, -3, -2.4, 4, 4.4, 0.8); g.fillStyle = K.trim; g.fill(); g.lineWidth = 1.1; g.strokeStyle = INK; g.stroke();
  } else if (K.armor === 'lamellar') {
    // laced lamellar rows over the back, an obi sash, kusazuri plates
    for (let r = 0; r < 4; r++) { const x = -11 + r * 3.2; g.beginPath(); g.moveTo(x, -15 + r * 0.6); g.lineTo(x, 15 - r * 0.6); g.strokeStyle = INK; g.lineWidth = 3.4; g.stroke(); g.strokeStyle = shade(K.plate, r % 2 ? -0.1 : 0.08); g.lineWidth = 2.2; g.stroke();
      g.beginPath(); for (let y = -13; y <= 13; y += 3.4) { g.moveTo(x - 1.2, y); g.lineTo(x + 1.2, y + 1.2); } g.strokeStyle = K.trim; g.lineWidth = 0.7; g.stroke(); }
    g.beginPath(); g.moveTo(1, -12); g.quadraticCurveTo(-2, 0, 1, 12); g.lineTo(4.5, 11); g.quadraticCurveTo(1.6, 0, 4.5, -11); g.closePath(); g.fillStyle = '#f6f1f7'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = INK; g.stroke();
    rrect(g, -1.5, -3.2, 6, 6.4, 1.6); g.fillStyle = K.trim; g.fill(); g.lineWidth = 1.4; g.strokeStyle = INK; g.stroke();
  } else if (K.armor === 'doublet') {
    g.beginPath(); g.moveTo(7.5, -8.4); g.quadraticCurveTo(9.4, 0, 7.5, 8.4); g.lineTo(0, 10.5); g.quadraticCurveTo(-2.5, 0, 0, -10.5); g.closePath(); g.fillStyle = wash(g, la, shade(cloth, -0.12), 12, 0.3, -0.3); g.fill(); g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke();
    g.beginPath(); for (let y = -7; y <= 7; y += 3.5) { g.moveTo(2, y - 1.5); g.lineTo(6.5, y + 1.5); g.moveTo(2, y + 1.5); g.lineTo(6.5, y - 1.5); } g.strokeStyle = K.plate; g.lineWidth = 1; g.stroke();
    g.beginPath(); g.moveTo(-1.5, -12); g.quadraticCurveTo(-4.5, 0, -1.5, 12); g.strokeStyle = K.plate; g.lineWidth = 2; g.stroke();
  } else { // robe: crossed lapels down the front, a sash, long vertical folds
    g.beginPath(); g.moveTo(4, -12.5); g.quadraticCurveTo(7.5, -4, 8.8, 1.5); g.moveTo(4, 12.5); g.quadraticCurveTo(7.5, 4, 8.8, -1.5); g.strokeStyle = INK; g.lineWidth = 3.4; g.stroke(); g.strokeStyle = K.trim; g.lineWidth = 1.8; g.stroke();
    g.beginPath(); g.moveTo(-1, -13); g.quadraticCurveTo(-4, 0, -1, 13); g.strokeStyle = INK; g.lineWidth = 4.6; g.stroke(); g.strokeStyle = K.plate; g.lineWidth = 3; g.stroke();
    g.beginPath(); for (const y of [-9, -3, 3, 9]) { g.moveTo(-3.5, y); g.quadraticCurveTo(-8, y * 1.15, -12.5, y * 1.25); } g.strokeStyle = 'rgba(25,10,40,.32)'; g.lineWidth = 1.1; g.stroke();
  }
  g.restore();
  // shoulders: layered plates (armoured kits) or draped mantles (robes)
  for (const sy of [-1, 1]) {
    if (K.armor === 'robe' || K.armor === 'doublet') mantle(g, sy, la, K.armor === 'doublet' ? K.plate : (cls === 'summoner' ? K.plate : shade(cloth, 0.08)), K.trim);
    else for (let k = 2; k >= 0; k--) pauldron(g, sy, la, K.plate, K.trim, k, K.armor === 'leather' ? shade(K.plate, k ? -0.15 : 0) : null);
  }
  // class emblems on the chest / back
  if (cls === 'cleric') { rrect(g, -12, -3.6, 9, 7.2, 2); g.fillStyle = '#f7f3e8'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke(); circle(g, -7.5, 0, 2.2, '#f2b632', 0); g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; g.moveTo(-7.5 + Math.cos(a) * 2.6, Math.sin(a) * 2.6); g.lineTo(-7.5 + Math.cos(a) * 3.6, Math.sin(a) * 3.6); } g.strokeStyle = '#f2b632'; g.lineWidth = 0.9; g.stroke(); }
  if (cls === 'dragoon') { g.beginPath(); g.moveTo(-10, 0); g.lineTo(-5, -3.6); g.lineTo(-2, 0); g.lineTo(-5, 3.6); g.closePath(); g.fillStyle = '#e0283f'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = INK; g.stroke(); }
  if (cls === 'monk') { for (let i = 0; i < 11; i++) { const q = -1.3 + i * (2.6 / 10); circle(g, 1 + Math.cos(q) * 12.5, Math.sin(q) * 12.5, 1.7, i === 5 ? '#ffd23f' : '#7a3b12', 1.1); } }
  if (cls === 'summoner') { rrect(g, -14, -5, 5.5, 10, 1.6); g.fillStyle = '#7a4a24'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = INK; g.stroke(); circle(g, -11.3, -5.6, 1.7, '#f4ecd6', 1); circle(g, -11.3, 5.6, 1.7, '#f4ecd6', 1); }
  rim(g, la, torsoPath);
  // gorget / collar under the head
  g.beginPath(); g.arc(2.5, 0, 9.2, -1.25, 1.25); g.strokeStyle = INK; g.lineWidth = 4.6; g.stroke(); g.strokeStyle = K.armor === 'robe' ? K.trim : shade(K.plate, 0.15); g.lineWidth = 2.6; g.stroke();
  // head: smaller (adult proportions), painted skin, then hair / helm (the old head art scaled to fit)
  g.save(); g.translate(HEAD_T.x, 0); g.scale(HEAD_T.k, HEAD_T.k); g.translate(HEAD_T.o, 0);
  paintHead(g, cls, c, la, uw, tuck);
  g.restore();
}
/** the head's place on the torso + the eyes on the head (the rig's own numbers: paintCore / paintHead draw from these) */
export const HEAD_T = { x: 2.5, k: 0.7, o: -1 };
export const EYE = { x: 9, y: 4.2 }; // (head space; the dragoon's helm hides them behind its visor slit: VISOR)
export const VISOR = { x: 11.5, y: 3 };
export const BRIM = { x: -1, rx: 17, ry: 16 }; // (the mage's wide hat brim, painted over the head + eyes)
/** true when the class's eyes are painted over (the mage's brim covers them in every facing) */
export function heroEyesHidden(cls) {
  if (cls !== 'mage') return false; return ((EYE.x - BRIM.x) / BRIM.rx) ** 2 + (EYE.y / BRIM.ry) ** 2 < 1; }
/** the two eye points of a class in the hero's rotated body frame (+x = facing), unscaled */
export function heroEyeLocal(cls) { const E = cls === 'dragoon' ? VISOR : EYE; return [-1, 1].map((sy) => ({ x: HEAD_T.x + HEAD_T.k * (E.x + HEAD_T.o), y: sy * HEAD_T.k * E.y })); }
function paintHead(g, cls, c, la, uw, tuck) {
  circle(g, 1, 0, 12.5, c.skin, 3.6);
  { const cc = Math.cos(la) * 12, s = Math.sin(la) * 12, gr = g.createLinearGradient(1 + cc, s, 1 - cc, -s); gr.addColorStop(0, 'rgba(255,248,230,.38)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(110,45,40,.34)'); g.beginPath(); g.arc(1, 0, 10.9, 0, TAU); g.fillStyle = gr; g.fill(); }
  // brow ridge + nose bridge (a sharper, older face than the old round one)
  g.beginPath(); g.moveTo(8.5, -7.5); g.quadraticCurveTo(11.6, 0, 8.5, 7.5); g.strokeStyle = 'rgba(80,40,30,.32)'; g.lineWidth = 1.6; g.stroke();
  g.beginPath(); g.moveTo(10.5, 0); g.lineTo(14.2, 0); g.strokeStyle = shade(c.skin, -0.25); g.lineWidth = 3; g.stroke(); g.strokeStyle = shade(c.skin, 0.2); g.lineWidth = 1; g.stroke();
  if (cls === 'monk') {
    g.beginPath(); g.ellipse(-2, -4, 5, 3.4, -0.5, 0, TAU); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
    circle(g, -12, 0, 3.8, shade(c.hair, -0.1), 2.4); circle(g, 4, 0, 1.6, '#ff9a2e', 0);
  } else if (cls === 'dragoon') {
    circle(g, 1, 0, 13.2, '#3a2fa8', 3.6);
    { const cc = Math.cos(la) * 12, s = Math.sin(la) * 12, gr = g.createLinearGradient(1 + cc, s, 1 - cc, -s); gr.addColorStop(0, 'rgba(210,200,255,.45)'); gr.addColorStop(0.55, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(10,5,40,.4)'); g.beginPath(); g.arc(1, 0, 11.8, 0, TAU); g.fillStyle = gr; g.fill(); }
    g.beginPath(); g.moveTo(-10, 0); g.lineTo(12, 0); g.strokeStyle = 'rgba(20,10,60,.5)'; g.lineWidth = 1.4; g.stroke();
    for (const sy of [-1, 1]) { g.beginPath(); g.moveTo(-2, sy * 9); g.quadraticCurveTo(-14, sy * 17, -26, sy * 12); g.quadraticCurveTo(-14, sy * 11, -6, sy * 6); g.closePath(); g.fillStyle = '#d8d2ff'; g.fill(); g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke(); g.beginPath(); g.moveTo(-4, sy * 9); g.quadraticCurveTo(-14, sy * 14.5, -23, sy * 12.4); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; g.stroke(); }
    g.beginPath(); g.moveTo(10, -6); g.quadraticCurveTo(13, 0, 10, 6); g.strokeStyle = INK; g.lineWidth = 4.5; g.stroke(); g.strokeStyle = uw ? '#ffb43a' : '#ff3b5c'; g.lineWidth = 2.2; g.stroke();
    g.beginPath(); g.moveTo(13, 0); g.lineTo(18, 0); g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); g.strokeStyle = '#6f5cf0'; g.lineWidth = 2; g.stroke();
    return;
  } else if (cls === 'summoner') {
    drawHair(g, c.style, c.hair); hairDetail(g, c.style, c.hair, la);
    g.beginPath(); g.arc(-1, 0, 14.5, Math.PI * 0.42, Math.PI * 1.58); g.quadraticCurveTo(-23, -6, -26, 0); g.quadraticCurveTo(-23, 6, -1 + 14.5 * Math.cos(Math.PI * 0.42), 14.5 * Math.sin(Math.PI * 0.42)); g.closePath();
    g.fillStyle = wash(g, la, '#20345a', 14, 0.3, -0.3); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
    g.beginPath(); for (const y of [-6, 0, 6]) { g.moveTo(-6, y * 1.6); g.quadraticCurveTo(-14, y * 1.3, -22, y * 0.7); } g.strokeStyle = 'rgba(0,0,20,.35)'; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.arc(-1, 0, 14.5, Math.PI * 0.42, Math.PI * 1.58); g.strokeStyle = '#f2b632'; g.lineWidth = 1.8; g.stroke();
  } else if (cls === 'bard') {
    drawHair(g, c.style, c.hair); hairDetail(g, c.style, c.hair, la);
    g.beginPath(); g.moveTo(16, -3); g.quadraticCurveTo(15, -15, -1, -16); g.quadraticCurveTo(-19, -15, -19, 0); g.quadraticCurveTo(-19, 15, -1, 16); g.quadraticCurveTo(15, 15, 16, 3); g.closePath(); g.fillStyle = wash(g, la, '#7a1f4a', 16); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.ellipse(-3, 0, 10, 9, 0, 0, TAU); g.fillStyle = wash(g, la, '#a82a62', 10); g.fill(); g.lineWidth = 2; g.stroke();
    g.beginPath(); g.ellipse(-3, 0, 10, 9, 0, Math.PI * 0.35, Math.PI * 0.65); g.strokeStyle = '#ffd86a'; g.lineWidth = 2.4; g.stroke();
  } else { drawHair(g, c.style, c.hair); hairDetail(g, c.style, c.hair, la); }
  if (cls === 'warrior') { // a steel half-helm band with a nasal guard
    g.beginPath(); g.arc(1, 0, 12.6, -1.15, 1.15); g.strokeStyle = INK; g.lineWidth = 5.5; g.stroke(); g.strokeStyle = '#b7c0ce'; g.lineWidth = 3.4; g.stroke();
    g.beginPath(); g.moveTo(12, 0); g.lineTo(16.5, 0); g.strokeStyle = INK; g.lineWidth = 4.4; g.stroke(); g.strokeStyle = '#d8dee8'; g.lineWidth = 2.2; g.stroke();
  }
  if (cls === 'ranger') { // a hood thrown back onto the shoulders
    g.beginPath(); g.arc(-3, 0, 14, Math.PI * 0.55, Math.PI * 1.45); g.quadraticCurveTo(-24, -4, -24, 0); g.quadraticCurveTo(-24, 4, -3 + 14 * Math.cos(Math.PI * 0.55), 14 * Math.sin(Math.PI * 0.55)); g.closePath(); g.fillStyle = wash(g, la, '#3f6b34', 14); g.fill(); g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke();
  }
  if (cls === 'mage') { // a pointed wide hat seen from above: brim ring + a creased crown leaning back
    g.beginPath(); g.ellipse(BRIM.x, 0, BRIM.rx, BRIM.ry, 0, 0, TAU); g.fillStyle = wash(g, la, '#4b2f86', 17); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.moveTo(5, -8); g.quadraticCurveTo(-6, -6, -20, 1); g.quadraticCurveTo(-6, 7, 5, 8); g.quadraticCurveTo(8, 0, 5, -8); g.fillStyle = wash(g, la, '#6a45b8', 12); g.fill(); g.lineWidth = 2.2; g.stroke();
    g.beginPath(); g.ellipse(-1, 0, 11.5, 11, 0, Math.PI * 0.3, Math.PI * 1.7, true); g.strokeStyle = '#f2d27a'; g.lineWidth = 2.2; g.stroke();
    circle(g, -20, 1, 2.2, '#f2d27a', 1.4);
  }
  if (cls === 'cleric') { g.beginPath(); g.arc(1, 0, 15.5, 0, TAU); g.strokeStyle = '#ffe27a'; g.lineWidth = 2.6; g.stroke(); }
  if (cls === 'bladedancer') { g.beginPath(); g.arc(1, 0, 12.5, Math.PI * 0.62, Math.PI * 1.38); g.strokeStyle = INK; g.lineWidth = 6; g.stroke(); g.strokeStyle = '#ff5fb0'; g.lineWidth = 3.5; g.stroke(); g.beginPath(); g.moveTo(12, -6); g.quadraticCurveTo(15, 0, 12, 6); g.strokeStyle = INK; g.lineWidth = 5; g.stroke(); g.strokeStyle = '#3a2a3e'; g.lineWidth = 3; g.stroke(); }
  if (cls === 'samurai') { circle(g, -9, 0, 4.2, shade(c.hair, -0.1), 2.6); g.beginPath(); g.arc(1, 0, 12.5, Math.PI * 0.6, Math.PI * 1.4); g.strokeStyle = INK; g.lineWidth = 6; g.stroke(); g.strokeStyle = '#f6f1f7'; g.lineWidth = 3.6; g.stroke(); } // (no pink nose mark: removed)
  // eyes (narrower, set under the brow); tuck (the Shadow Duel's mirror): eyes the headwear covers stay under it
  if (!(tuck && heroEyesHidden(cls))) for (const sy of [-1, 1]) { g.beginPath(); g.ellipse(EYE.x, sy * EYE.y, 1.3, 2.1, 0, 0, TAU); g.fillStyle = INK; g.fill(); circle(g, EYE.x + 0.3, sy * EYE.y - 0.6, 0.55, '#fff', 0); }
  g.beginPath(); g.moveTo(10.8, -6.6); g.lineTo(10.2, -2.6); g.moveTo(10.8, 6.6); g.lineTo(10.2, 2.6); g.strokeStyle = 'rgba(43,36,51,.65)'; g.lineWidth = 1.2; g.stroke();
}

/** blit (or paint live when the build budget is spent) the hero's static torso + head for facing `ang` */
export function drawHeroCore(ctx, h, c, ang) {
  const b = ((Math.round((ang / TAU) * BUCKETS) % BUCKETS) + BUCKETS) % BUCKETS, aq = (b / BUCKETS) * TAU, la = -2.3 - aq;
  const key = `hb2:${h.cls}:${c.outfit}:${c.skin}:${c.hair}:${c.style}:${h.uw ? 1 : 0}:${b}${h.tuckEyes ? ':t' : ''}`;
  const m = ctx.getTransform(), zk = Math.hypot(m.a, m.b);
  if (h.live || globalThis.__heroLive || zk > spriteScale() * 1.25 || !spriteBudget(key, 4)) { paintCore(ctx, h.cls, c, -2.3 - ang, h.uw, h.tuckEyes); return; }
  const spr = sprite(key, 76, 76, 38, 38, (g) => paintCore(g, h.cls, c, la, h.uw, h.tuckEyes));
  ctx.drawImage(spr, -spr.ox, -spr.oy, spr.sw, spr.sh);
}
/** feet: two boots striding along the facing (drawn first, under everything) */
export function drawHeroLegs(ctx, h, t) {
  const K = kitOf(h.cls), st = Math.sin(t * 14) * 8.5 * walkK(h);
  for (const [sy, s] of [[-1, st], [1, -st]]) {
    const x = 2 + s, y = sy * 7.2;
    ctx.beginPath(); ctx.ellipse(x, y, 7, 3.9, 0, 0, TAU); ctx.fillStyle = K.boot; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 2, y - 1, 3, 1.3, 0, 0, TAU); ctx.fillStyle = 'rgba(255,240,220,.35)'; ctx.fill();
  }
}
/** a class cape / cloak behind the body with folds and a rippling hem (live: it moves) */
export function drawHeroCape(ctx, h, t) {
  const K = kitOf(h.cls); if (!K.cape) return;
  const wv = Math.sin(t * 8) * 2.6 + (Math.sin(t * 16) * 2.4 * walkK(h)), L = h.cls === 'mage' ? 30 : h.cls === 'cleric' ? 28 : 31;
  ctx.beginPath(); ctx.moveTo(-6, -16); ctx.quadraticCurveTo(-L * 0.7, -17 + wv * 0.5, -L, -10 + wv); ctx.quadraticCurveTo(-L - 2, -3 + wv * 0.4, -L + 1, 0); ctx.quadraticCurveTo(-L - 2, 4 - wv * 0.4, -L, 10 - wv); ctx.quadraticCurveTo(-L * 0.7, 17 - wv * 0.5, -6, 16); ctx.closePath();
  ctx.fillStyle = K.cape; ctx.fill(); ctx.lineWidth = 2.8; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); for (const y of [-9, -3, 3, 9]) { ctx.moveTo(-10, y * 1.1); ctx.quadraticCurveTo(-L * 0.6, y * 1.25 + wv * 0.3, -L + 2, y * 1.05 + (y < 0 ? wv : -wv) * 0.5); } ctx.strokeStyle = 'rgba(20,10,30,.32)'; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-L, -10 + wv); ctx.quadraticCurveTo(-L - 2, -3 + wv * 0.4, -L + 1, 0); ctx.quadraticCurveTo(-L - 2, 4 - wv * 0.4, -L, 10 - wv); ctx.strokeStyle = h.cls === 'cleric' ? '#e8c35a' : 'rgba(255,230,190,.45)'; ctx.lineWidth = 1.6; ctx.stroke();
}
/** the little wind-blown bits over the cached head (tails, plumes, crests) */
export function drawHeroTails(ctx, h, c, t) {
  const S = 0.7, hx = (x) => 2.5 + (x - 1) * S;
  const wv = Math.sin(t * 7) * 2.5 + (Math.sin(t * 15) * 2 * walkK(h));
  ctx.lineCap = 'round';
  if (h.cls === 'samurai') { ctx.beginPath(); ctx.moveTo(hx(-11), 1 * S); ctx.quadraticCurveTo(hx(-18), (4 + wv) * S, hx(-25), (3 + wv * 1.3) * S); ctx.moveTo(hx(-11), 2 * S); ctx.quadraticCurveTo(hx(-17), (8 + wv) * S, hx(-23), (9 + wv) * S); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#f6f1f7'; ctx.lineWidth = 2.2; ctx.stroke(); }
  else if (h.cls === 'bladedancer') { const w2 = Math.sin(t * 8) * 2; ctx.beginPath(); ctx.moveTo(hx(-11), 0); ctx.lineTo(hx(-20), (-5 + w2) * S); ctx.moveTo(hx(-11), 0); ctx.lineTo(hx(-20), (5 + Math.sin(t * 8 + 1) * 2) * S); ctx.strokeStyle = '#ff5fb0'; ctx.lineWidth = 2.4; ctx.stroke(); }
  else if (h.cls === 'dragoon') { const cw = Math.sin(t * 7) * 2; ctx.beginPath(); ctx.moveTo(hx(6), 0); ctx.quadraticCurveTo(hx(-8), -3 * S, hx(-24), cw * S); ctx.quadraticCurveTo(hx(-8), 3 * S, hx(6), 0); ctx.fillStyle = '#e0283f'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke(); }
  else if (h.cls === 'bard') { const pw = Math.sin(t * 6) * 3 + (Math.sin(t * 13) * 2 * walkK(h)); ctx.beginPath(); ctx.moveTo(hx(-4), -6 * S); ctx.quadraticCurveTo(hx(-18), (-14 + pw) * S, hx(-32), (-10 + pw * 1.4) * S); ctx.quadraticCurveTo(hx(-18), (-8 + pw * 0.6) * S, hx(-4), -3 * S); ctx.closePath(); ctx.fillStyle = '#fff3c8'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke(); ctx.beginPath(); ctx.moveTo(hx(-5), -5 * S); ctx.quadraticCurveTo(hx(-18), (-10 + pw) * S, hx(-30), (-10 + pw * 1.4) * S); ctx.strokeStyle = '#ff7ab8'; ctx.lineWidth = 1; ctx.stroke(); }
  else if (h.cls === 'monk') { ctx.beginPath(); ctx.moveTo(hx(-15), 0); ctx.lineTo(hx(-20), Math.sin(t * 6) * 1.2); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke(); }
}
/** hit flash overlay in the hero frame */
export function heroFlashShape(ctx) { torsoPath(ctx); ctx.fill(); ctx.beginPath(); ctx.arc(2.5, 0, 9, 0, TAU); ctx.fill(); }
export const heroGlove = (cls, skin) => kitOf(cls).glove || skin;
/** sleeve colour of the arms (plate kits: the plate metal; cloth kits: the robe) */
export const heroSleeve = (cls, outfit) => { const K = kitOf(cls); return K.armor === 'plate' || K.armor === 'leather' || K.armor === 'lamellar' ? shade(K.plate, -0.08) : (K.cloth || outfit); };
/** an arm from the shoulder to the hand (drawn before the torso, so the pauldron covers the joint) */
export function heroArm(ctx, x, y, sleeve, la) {
  const sy = y < -1.5 ? -1 : y > 1.5 ? 1 : x > 0 ? 1 : -1, sx = -2.5, s0 = sy * 13.5;
  const mx = (sx + x) / 2 - 2.5, my = (s0 + y) / 2 + sy * 4.5;
  ctx.beginPath(); ctx.moveTo(sx, s0); ctx.quadraticCurveTo(mx, my, x, y); ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 8.4; ctx.stroke(); ctx.strokeStyle = sleeve; ctx.lineWidth = 5.4; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx + Math.cos(la) * 1.4, s0 + Math.sin(la) * 1.4); ctx.quadraticCurveTo(mx + Math.cos(la) * 1.4, my + Math.sin(la) * 1.4, x, y); ctx.strokeStyle = 'rgba(255,248,226,.32)'; ctx.lineWidth = 1.4; ctx.stroke();
}
