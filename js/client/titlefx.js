// Title-screen scenes (step 2): one classic-art themed room per class - a class-coloured hall with a big arch behind
// the hero, framing pillars, a tiled floor, class props and ambient particles - with the last-played hero idling large
// on a platform (client/heroshow.js). Pure canvas; client/title.js owns the DOM around it.
import { drawPlatform, rgba } from './heroshow.js';
import { ShowcaseView, fitScale, preloadAll } from './heromodel.js';

const view = new ShowcaseView(); // the title's showcase spot (fade-in, flourish as the title opens)

const INK = '#2b2433', TAU = Math.PI * 2;
/** per class: wall / floor colours, glow, arch fill, props left + right, particle kind */
export const THEMES = {
  warrior: { name: 'War Hall', wall: ['#5a2a2a', '#2a1418'], floor: ['#6b4a3a', '#3a2620'], glow: '#ff7a3a', arch: 'fire', props: ['rack', 'brazier'], right: ['banner', 'brazier'], fx: 'ember', bannerCol: '#c8322b' },
  ranger: { name: 'Forest Lodge', wall: ['#2f5a3a', '#14261a'], floor: ['#6b5a3a', '#352a1a'], glow: '#9dff6a', arch: 'forest', props: ['dummy', 'lantern'], right: ['fern', 'lantern'], fx: 'firefly', bannerCol: '#3f9a4a' },
  mage: { name: 'Arcane Sanctum', wall: ['#2e2a6a', '#14122e'], floor: ['#3e3a6a', '#1e1a38'], glow: '#7ab8ff', arch: 'rune', props: ['books', 'crystal'], right: ['crystal', 'books'], fx: 'spark', bannerCol: '#4a5ad8' },
  cleric: { name: 'Sunlit Cathedral', wall: ['#6a5a3a', '#2e2618'], floor: ['#8a7a5a', '#4a3e2a'], glow: '#ffe28a', arch: 'glass', props: ['candles', 'banner'], right: ['banner', 'candles'], fx: 'mote', bannerCol: '#e8c040' },
  bladedancer: { name: 'Moonlit Dojo', wall: ['#2a2a4a', '#0e0e1e'], floor: ['#4a3a3a', '#221a1e'], glow: '#c8b8ff', arch: 'moon', props: ['bamboo', 'paper'], right: ['paper', 'bamboo'], fx: 'petalDark', bannerCol: '#6a4ab8' },
  samurai: { name: 'Shrine Courtyard', wall: ['#6a2a3a', '#2a1018'], floor: ['#7a6a5a', '#3a2e26'], glow: '#ff9ab8', arch: 'torii', props: ['sakura', 'katana'], right: ['stoneLamp', 'sakura'], fx: 'sakura', bannerCol: '#d83a4a' },
  monk: { name: 'Mountain Temple', wall: ['#7a4a2a', '#2e1a10'], floor: ['#8a6a4a', '#46301e'], glow: '#ffb05a', arch: 'peaks', props: ['gong', 'incense'], right: ['incense', 'flags'], fx: 'smoke', bannerCol: '#e88a2a' },
  dragoon: { name: 'Dragon Keep', wall: ['#2a3a5a', '#101824'], floor: ['#4a5262', '#222832'], glow: '#6ad8ff', arch: 'dragon', props: ['spears', 'banner'], right: ['banner', 'brazierBlue'], fx: 'emberBlue', bannerCol: '#2a6ad8' },
  summoner: { name: 'Spirit Library', wall: ['#3e2a5a', '#160e24'], floor: ['#4a3a5a', '#22182e'], glow: '#7affd8', arch: 'sigil', props: ['scrolls', 'inkpot'], right: ['inkpot', 'scrolls'], fx: 'wisp', bannerCol: '#7a4ad8' },
  bard: { name: 'Tavern Stage', wall: ['#5a2a4a', '#24101e'], floor: ['#7a5236', '#3a2414'], glow: '#ffd27a', arch: 'stage', props: ['curtain', 'lute'], right: ['footlights', 'curtain'], fx: 'note', bannerCol: '#b8326a' },
};
export const themeOf = (cls) => THEMES[cls] || THEMES.warrior;

function ink(g, w) { g.strokeStyle = INK; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; }
function poly(g, pts, fill, w) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fillStyle = fill; g.fill(); if (w) { ink(g, w); g.stroke(); } }
function rect(g, x, y, w, h, fill, lw, r = 0) { g.beginPath(); if (r && g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fillStyle = fill; g.fill(); if (lw) { ink(g, lw); g.stroke(); } }
function disc(g, x, y, r, fill, lw) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = fill; g.fill(); if (lw) { ink(g, lw); g.stroke(); } }
function flame(g, x, y, s, t, c1 = '#ffd23f', c2 = '#ff6a2a') {
  const f = 1 + Math.sin(t * 13 + x) * 0.08 + Math.sin(t * 7.3 + y) * 0.06;
  g.save(); g.translate(x, y); g.scale(s, s * f);
  g.fillStyle = c2; g.beginPath(); g.moveTo(-14, 0); g.quadraticCurveTo(-16, -22, 0, -44); g.quadraticCurveTo(16, -22, 14, 0); g.closePath(); g.fill(); ink(g, 3 / s); g.stroke();
  g.fillStyle = c1; g.beginPath(); g.moveTo(-7, 0); g.quadraticCurveTo(-8, -14, 0, -26); g.quadraticCurveTo(8, -14, 7, 0); g.closePath(); g.fill();
  g.restore();
  g.save(); const gr = g.createRadialGradient(x, y - 20 * s, 2, x, y - 20 * s, 90 * s); gr.addColorStop(0, rgba(c2, 0.35)); gr.addColorStop(1, rgba(c2, 0)); g.fillStyle = gr; g.fillRect(x - 90 * s, y - 110 * s, 180 * s, 180 * s); g.restore();
}

// ---- props (x = centre, y = floor line, u = unit scale) -------------------------------------------------------------
export const PROPS = {
  rack(g, x, y, u) { rect(g, x - 60 * u, y - 150 * u, 120 * u, 14 * u, '#7a5236', 4 * u, 4 * u); rect(g, x - 60 * u, y - 70 * u, 120 * u, 12 * u, '#7a5236', 4 * u, 4 * u); rect(g, x - 66 * u, y - 170 * u, 14 * u, 170 * u, '#5a3a26', 4 * u, 3 * u); rect(g, x + 52 * u, y - 170 * u, 14 * u, 170 * u, '#5a3a26', 4 * u, 3 * u);
    // sword, axe, hammer
    rect(g, x - 34 * u, y - 210 * u, 10 * u, 150 * u, '#d8dde8', 3.5 * u); rect(g, x - 46 * u, y - 70 * u, 34 * u, 8 * u, '#8a6a3a', 3.5 * u);
    rect(g, x - 2 * u, y - 200 * u, 8 * u, 150 * u, '#7a5236', 3.5 * u); poly(g, [x + 6 * u, y - 200 * u, x + 36 * u, y - 214 * u, x + 36 * u, y - 168 * u, x + 6 * u, y - 178 * u], '#c8ccd8', 3.5 * u);
    rect(g, x + 30 * u, y - 190 * u, 8 * u, 140 * u, '#7a5236', 3.5 * u); rect(g, x + 18 * u, y - 206 * u, 32 * u, 22 * u, '#9aa0b0', 3.5 * u, 3 * u); },
  brazier(g, x, y, u, t) { poly(g, [x - 30 * u, y - 70 * u, x + 30 * u, y - 70 * u, x + 18 * u, y - 40 * u, x - 18 * u, y - 40 * u], '#4a4250', 4 * u); rect(g, x - 6 * u, y - 40 * u, 12 * u, 40 * u, '#3a3240', 4 * u); rect(g, x - 22 * u, y - 6 * u, 44 * u, 8 * u, '#3a3240', 4 * u, 3 * u); flame(g, x, y - 70 * u, 1.3 * u, t); },
  brazierBlue(g, x, y, u, t) { poly(g, [x - 30 * u, y - 70 * u, x + 30 * u, y - 70 * u, x + 18 * u, y - 40 * u, x - 18 * u, y - 40 * u], '#3a4a5a', 4 * u); rect(g, x - 6 * u, y - 40 * u, 12 * u, 40 * u, '#2a3440', 4 * u); flame(g, x, y - 70 * u, 1.3 * u, t, '#bff4ff', '#3aa8ff'); },
  banner(g, x, y, u, t, T) { const sw = Math.sin(t * 1.4 + x) * 4 * u; rect(g, x - 50 * u, y - 330 * u, 100 * u, 10 * u, '#8a6a3a', 4 * u, 4 * u);
    poly(g, [x - 40 * u, y - 322 * u, x + 40 * u, y - 322 * u, x + 40 * u + sw, y - 130 * u, x + sw, y - 105 * u, x - 40 * u + sw, y - 130 * u], T.bannerCol, 4 * u);
    disc(g, x + sw * 0.6, y - 230 * u, 22 * u, '#ffd23f', 4 * u); poly(g, [x + sw * 0.6, y - 246 * u, x + 12 * u + sw * 0.6, y - 224 * u, x - 12 * u + sw * 0.6, y - 224 * u], INK); },
  dummy(g, x, y, u) { rect(g, x - 5 * u, y - 170 * u, 10 * u, 170 * u, '#7a5236', 4 * u); rect(g, x - 50 * u, y - 140 * u, 100 * u, 10 * u, '#7a5236', 4 * u, 3 * u); disc(g, x, y - 120 * u, 44 * u, '#e8d8a8', 4 * u); disc(g, x, y - 120 * u, 30 * u, '#d84a3a', 3 * u); disc(g, x, y - 120 * u, 16 * u, '#e8d8a8', 3 * u); disc(g, x, y - 120 * u, 6 * u, '#d84a3a', 2 * u);
    for (const [dx, dy, a] of [[8, -6, -0.4], [-14, 10, 0.3], [20, 18, -0.1]]) { g.save(); g.translate(x + dx * u, y - 120 * u + dy * u); g.rotate(a); rect(g, 0, -2 * u, 46 * u, 4 * u, '#5a3a26', 2.5 * u); poly(g, [46 * u, -7 * u, 58 * u, 0, 46 * u, 7 * u], '#f4f4f4', 2.5 * u); g.restore(); } },
  lantern(g, x, y, u, t) { rect(g, x - 5 * u, y - 210 * u, 10 * u, 210 * u, '#4a3a2a', 4 * u); rect(g, x - 5 * u, y - 210 * u, 40 * u, 8 * u, '#4a3a2a', 3.5 * u); const sw = Math.sin(t * 1.6 + x) * 0.08;
    g.save(); g.translate(x + 30 * u, y - 202 * u); g.rotate(sw); rect(g, -16 * u, 10 * u, 32 * u, 40 * u, '#ffe08a', 4 * u, 6 * u); rect(g, -20 * u, 6 * u, 40 * u, 8 * u, '#3a2a1a', 3 * u, 3 * u); g.restore();
    g.save(); const gr = g.createRadialGradient(x + 30 * u, y - 172 * u, 2, x + 30 * u, y - 172 * u, 120 * u); gr.addColorStop(0, 'rgba(255,224,138,.35)'); gr.addColorStop(1, 'rgba(255,224,138,0)'); g.fillStyle = gr; g.fillRect(x - 90 * u, y - 300 * u, 240 * u, 240 * u); g.restore(); },
  fern(g, x, y, u, t) { for (let i = -3; i <= 3; i++) { const a = -Math.PI / 2 + i * 0.32 + Math.sin(t + i) * 0.04; g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(60 * u, 0, 64 * u, 14 * u, 0, 0, TAU); g.fillStyle = i % 2 ? '#3f9a4a' : '#5ab85a'; g.fill(); ink(g, 3.5 * u); g.stroke(); g.restore(); } rect(g, x - 34 * u, y - 30 * u, 68 * u, 34 * u, '#a85a3a', 4 * u, 6 * u); },
  books(g, x, y, u) { rect(g, x - 80 * u, y - 300 * u, 160 * u, 300 * u, '#4a2e22', 4.5 * u, 6 * u); const cols = ['#c83a3a', '#3a6ac8', '#3aa85a', '#c8a03a', '#8a3ac8', '#e8e0c8'];
    for (let s = 0; s < 4; s++) { const sy = y - 290 * u + s * 72 * u; rect(g, x - 70 * u, sy + 60 * u, 140 * u, 8 * u, '#2e1c14', 3 * u); let bx = x - 66 * u; for (let i = 0; bx < x + 60 * u; i++) { const w = (10 + ((i * 7 + s * 3) % 9)) * u, h = (44 + ((i * 11 + s) % 14)) * u; rect(g, bx, sy + 60 * u - h, w, h, cols[(i + s * 2) % cols.length], 2.5 * u); bx += w + 1 * u; } } },
  crystal(g, x, y, u, t, T) { const f = Math.sin(t * 1.5 + x) * 10 * u; rect(g, x - 26 * u, y - 60 * u, 52 * u, 60 * u, '#4a4270', 4 * u, 4 * u);
    g.save(); const gr = g.createRadialGradient(x, y - 140 * u + f, 4, x, y - 140 * u + f, 110 * u); gr.addColorStop(0, rgba(T.glow, 0.45)); gr.addColorStop(1, rgba(T.glow, 0)); g.fillStyle = gr; g.fillRect(x - 110 * u, y - 250 * u + f, 220 * u, 220 * u); g.restore();
    poly(g, [x, y - 200 * u + f, x + 26 * u, y - 140 * u + f, x, y - 90 * u + f, x - 26 * u, y - 140 * u + f], T.glow, 4 * u); poly(g, [x, y - 200 * u + f, x + 8 * u, y - 140 * u + f, x, y - 90 * u + f], 'rgba(255,255,255,.45)'); },
  candles(g, x, y, u, t) { rect(g, x - 70 * u, y - 60 * u, 140 * u, 60 * u, '#6a5236', 4 * u, 4 * u); for (const [dx, h] of [[-48, 50], [-20, 76], [10, 60], [40, 86]]) { rect(g, x + dx * u - 7 * u, y - 60 * u - h * u, 14 * u, h * u, '#f4ecd8', 3 * u, 3 * u); flame(g, x + dx * u, y - 62 * u - h * u, 0.45 * u, t + dx); } },
  bamboo(g, x, y, u, t) { for (const [dx, h, c] of [[-30, 360, '#5a9a4a'], [0, 420, '#6ab85a'], [28, 330, '#4a8a3a']]) { const sw = Math.sin(t * 0.8 + dx) * 6 * u; g.save(); g.translate(x + dx * u, y); g.rotate(sw / (300 * u)); rect(g, -8 * u, -h * u, 16 * u, h * u, c, 4 * u, 4 * u); for (let k = 60; k < h; k += 64) { ink(g, 3 * u); g.beginPath(); g.moveTo(-8 * u, -k * u); g.lineTo(8 * u, -k * u); g.stroke(); } g.beginPath(); g.ellipse(22 * u, -h * u + 30 * u, 26 * u, 7 * u, -0.5, 0, TAU); g.fillStyle = '#7ac86a'; g.fill(); ink(g, 3 * u); g.stroke(); g.restore(); } },
  paper(g, x, y, u, t) { for (const [dx, dy] of [[-40, 300], [30, 250]]) { const sw = Math.sin(t * 1.3 + dx) * 0.07; g.save(); g.translate(x + dx * u, y - dy * u - 120 * u); g.rotate(sw); ink(g, 2.5 * u); g.beginPath(); g.moveTo(0, -80 * u); g.lineTo(0, 0); g.stroke();
    g.beginPath(); g.ellipse(0, 34 * u, 28 * u, 38 * u, 0, 0, TAU); g.fillStyle = '#ff6a4a'; g.fill(); ink(g, 4 * u); g.stroke(); g.fillStyle = 'rgba(255,230,160,.5)'; g.beginPath(); g.ellipse(-6 * u, 30 * u, 10 * u, 24 * u, 0, 0, TAU); g.fill(); rect(g, -14 * u, -6 * u, 28 * u, 8 * u, INK); rect(g, -14 * u, 70 * u, 28 * u, 8 * u, INK); g.restore(); } },
  sakura(g, x, y, u, t) { rect(g, x - 14 * u, y - 260 * u, 28 * u, 260 * u, '#5a3a2e', 4.5 * u, 6 * u); poly(g, [x, y - 200 * u, x + 70 * u, y - 280 * u, x + 78 * u, y - 270 * u, x + 8 * u, y - 186 * u], '#5a3a2e', 4 * u);
    for (const [dx, dy, r] of [[-60, 300, 70], [40, 330, 80], [100, 280, 60], [-10, 380, 70], [70, 240, 50], [-90, 250, 50]]) disc(g, x + dx * u + Math.sin(t * 0.7 + dx) * 2 * u, y - dy * u, r * u, dx % 20 ? '#ffb8d0' : '#ff9ac0', 4.5 * u); },
  katana(g, x, y, u) { rect(g, x - 70 * u, y - 40 * u, 140 * u, 40 * u, '#2a1a1a', 4 * u, 6 * u); for (const dy of [70, 110]) { rect(g, x - 62 * u, y - dy * u - 30 * u, 12 * u, 34 * u, '#2a1a1a', 3 * u); rect(g, x + 50 * u, y - dy * u - 30 * u, 12 * u, 34 * u, '#2a1a1a', 3 * u); g.save(); g.translate(x, y - dy * u - 26 * u); g.rotate(-0.04); rect(g, -84 * u, -5 * u, 120 * u, 10 * u, '#d8dde8', 3 * u, 4 * u); rect(g, 36 * u, -6 * u, 50 * u, 12 * u, '#c83a3a', 3 * u, 4 * u); g.restore(); } },
  stoneLamp(g, x, y, u, t) { rect(g, x - 34 * u, y - 24 * u, 68 * u, 24 * u, '#8a8a90', 4 * u, 4 * u); rect(g, x - 12 * u, y - 100 * u, 24 * u, 76 * u, '#9a9aa0', 4 * u); rect(g, x - 30 * u, y - 150 * u, 60 * u, 50 * u, '#9a9aa0', 4 * u, 4 * u); rect(g, x - 16 * u, y - 140 * u, 32 * u, 30 * u, '#ffe08a', 3 * u); poly(g, [x - 50 * u, y - 150 * u, x, y - 190 * u, x + 50 * u, y - 150 * u], '#7a7a80', 4 * u); flame(g, x, y - 114 * u, 0.4 * u, t); },
  gong(g, x, y, u, t) { rect(g, x - 80 * u, y - 280 * u, 14 * u, 280 * u, '#7a3a2a', 4 * u); rect(g, x + 66 * u, y - 280 * u, 14 * u, 280 * u, '#7a3a2a', 4 * u); rect(g, x - 96 * u, y - 296 * u, 192 * u, 20 * u, '#8a4a2a', 4 * u, 6 * u); const sw = Math.sin(t * 1.1) * 0.03;
    g.save(); g.translate(x, y - 276 * u); g.rotate(sw); ink(g, 3 * u); g.beginPath(); g.moveTo(-30 * u, 0); g.lineTo(-20 * u, 40 * u); g.moveTo(30 * u, 0); g.lineTo(20 * u, 40 * u); g.stroke(); disc(g, 0, 120 * u, 80 * u, '#e8a83a', 5 * u); disc(g, 0, 120 * u, 50 * u, '#f4c85a', 3 * u); disc(g, 0, 120 * u, 18 * u, '#c8862a', 3 * u); g.restore(); },
  incense(g, x, y, u, t) { rect(g, x - 40 * u, y - 50 * u, 80 * u, 50 * u, '#6a4a3a', 4 * u, 8 * u); rect(g, x - 48 * u, y - 58 * u, 96 * u, 14 * u, '#8a5a3a', 4 * u, 6 * u); for (const dx of [-14, 0, 14]) { ink(g, 3 * u); g.beginPath(); g.moveTo(x + dx * u, y - 58 * u); g.lineTo(x + dx * u * 1.6, y - 120 * u); g.stroke(); disc(g, x + dx * u * 1.6, y - 120 * u, 3 * u, '#ff6a2a'); } },
  flags(g, x, y, u, t) { rect(g, x - 5 * u, y - 340 * u, 10 * u, 340 * u, '#5a3a26', 4 * u); const cols = ['#e8463a', '#f4c83a', '#3aa85a', '#3a7ad8', '#f4f0e8']; for (let i = 0; i < 5; i++) { const sw = Math.sin(t * 2 + i) * 6 * u; poly(g, [x + 5 * u, y - 330 * u + i * 34 * u, x + 70 * u + sw, y - 324 * u + i * 34 * u, x + 70 * u + sw, y - 300 * u + i * 34 * u, x + 5 * u, y - 304 * u + i * 34 * u], cols[i], 3 * u); } },
  spears(g, x, y, u) { rect(g, x - 60 * u, y - 60 * u, 120 * u, 14 * u, '#4a4250', 4 * u, 4 * u); for (const dx of [-40, -14, 12, 38]) { rect(g, x + dx * u - 4 * u, y - 300 * u, 8 * u, 300 * u, '#6a5236', 3.5 * u); poly(g, [x + dx * u, y - 350 * u, x + dx * u + 12 * u, y - 300 * u, x + dx * u - 12 * u, y - 300 * u], '#c8d0e0', 3.5 * u); poly(g, [x + dx * u - 14 * u, y - 296 * u, x + dx * u + 14 * u, y - 296 * u, x + dx * u, y - 286 * u], '#2a6ad8', 3 * u); } },
  scrolls(g, x, y, u) { rect(g, x - 80 * u, y - 260 * u, 160 * u, 260 * u, '#3a2a4a', 4.5 * u, 6 * u); for (let s = 0; s < 4; s++) { const sy = y - 250 * u + s * 62 * u; rect(g, x - 72 * u, sy + 50 * u, 144 * u, 8 * u, '#22182e', 3 * u); for (let i = 0; i < 5; i++) { const cx = x - 54 * u + i * 27 * u; disc(g, cx, sy + 36 * u, 12 * u, i % 2 ? '#f4e8c8' : '#e8d8a8', 3 * u); disc(g, cx, sy + 36 * u, 4 * u, i % 3 ? '#c83a3a' : '#3a6ac8'); } } },
  inkpot(g, x, y, u, t, T) { rect(g, x - 60 * u, y - 70 * u, 120 * u, 70 * u, '#4a3a5a', 4 * u, 6 * u); disc(g, x - 20 * u, y - 84 * u, 18 * u, '#1a1424', 4 * u); ink(g, 3 * u); g.beginPath(); g.moveTo(x - 14 * u, y - 96 * u); g.lineTo(x + 20 * u, y - 170 * u); g.stroke(); poly(g, [x + 20 * u, y - 170 * u, x + 40 * u, y - 200 * u, x + 26 * u, y - 160 * u], '#f4f0e8', 2.5 * u);
    rect(g, x + 4 * u, y - 96 * u, 50 * u, 22 * u, '#f4e8c8', 3 * u, 3 * u); g.save(); g.globalAlpha = 0.6 + 0.3 * Math.sin(t * 2); g.fillStyle = T.glow; g.font = `${20 * u}px serif`; g.fillText('✦', x + 20 * u, y - 80 * u); g.restore(); },
  curtain(g, x, y, u, t, T) { const sw = Math.sin(t * 0.9 + x) * 5 * u, top = y - 660 * u;
    g.beginPath(); g.moveTo(x - 110 * u, top); g.lineTo(x + 110 * u, top); g.quadraticCurveTo(x + 60 * u + sw, y - 420 * u, x + 22 * u + sw, y - 250 * u); g.quadraticCurveTo(x + 50 * u + sw, y - 120 * u, x + 80 * u + sw, y); g.lineTo(x - 110 * u, y); g.closePath();
    g.fillStyle = T.bannerCol; g.fill(); ink(g, 5 * u); g.stroke();
    g.save(); g.clip(); g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 6 * u; for (let i = 0; i < 4; i++) { const fx = x - 80 * u + i * 40 * u; g.beginPath(); g.moveTo(fx, top); g.quadraticCurveTo(fx + 10 * u + sw * 0.5, y - 300 * u, fx + (i * 12) * u, y); g.stroke(); } g.restore();
    rect(g, x + 4 * u + sw, y - 262 * u, 30 * u, 18 * u, '#e8b83a', 3.5 * u, 6 * u);
    rect(g, x - 130 * u, top - 10 * u, 260 * u, 30 * u, '#e8b83a', 4.5 * u, 6 * u); for (let i = 0; i < 6; i++) poly(g, [x - 120 * u + i * 44 * u, top + 20 * u, x - 98 * u + i * 44 * u, top + 44 * u, x - 76 * u + i * 44 * u, top + 20 * u], '#c8322b', 3 * u); },
  lute(g, x, y, u) { rect(g, x - 6 * u, y - 70 * u, 12 * u, 70 * u, '#5a3a26', 3.5 * u); g.save(); g.translate(x, y - 150 * u); g.rotate(-0.35); g.beginPath(); g.ellipse(0, 40 * u, 44 * u, 56 * u, 0, 0, TAU); g.fillStyle = '#c8823a'; g.fill(); ink(g, 4.5 * u); g.stroke(); disc(g, 0, 30 * u, 13 * u, '#3a2414', 3 * u); rect(g, -7 * u, -110 * u, 14 * u, 110 * u, '#8a5a2a', 4 * u); rect(g, -12 * u, -130 * u, 24 * u, 26 * u, '#6a3a1e', 4 * u, 4 * u); g.restore(); },
  footlights(g, x, y, u, t) { rect(g, x - 120 * u, y - 28 * u, 240 * u, 28 * u, '#4a2a1a', 4 * u, 4 * u); for (let i = 0; i < 4; i++) { const cx = x - 90 * u + i * 60 * u; disc(g, cx, y - 30 * u, 12 * u, '#ffe08a', 3.5 * u); g.save(); g.globalAlpha = 0.18 + 0.06 * Math.sin(t * 3 + i); g.fillStyle = '#ffe08a'; g.beginPath(); g.moveTo(cx - 10 * u, y - 30 * u); g.lineTo(cx - 70 * u, y - 330 * u); g.lineTo(cx + 70 * u, y - 330 * u); g.lineTo(cx + 10 * u, y - 30 * u); g.fill(); g.restore(); } },
};

// ---- the big arch behind the hero -------------------------------------------------------------------------------------
function drawArch(g, cx, fy, u, T, t, W, H) {
  const aw = 230 * u, top = fy - 560 * u;
  g.save();
  g.beginPath(); g.moveTo(cx - aw, fy - 40 * u); g.lineTo(cx - aw, top + aw); g.arc(cx, top + aw, aw, Math.PI, 0); g.lineTo(cx + aw, fy - 40 * u); g.closePath();
  g.save(); g.clip();
  const sky = g.createLinearGradient(0, top, 0, fy); sky.addColorStop(0, rgba(T.glow, 0.55)); sky.addColorStop(1, rgba(T.wall[1], 0.9)); g.fillStyle = sky; g.fillRect(cx - aw, top, aw * 2, fy - top);
  const k = T.arch;
  if (k === 'moon' || k === 'torii' || k === 'peaks' || k === 'forest' || k === 'dragon') {
    g.fillStyle = k === 'moon' ? '#f4f0ff' : k === 'torii' ? '#ffd8e4' : '#fff4d8'; g.beginPath(); g.arc(cx + 60 * u, top + 150 * u, 70 * u, 0, TAU); g.fill();
    if (k === 'peaks' || k === 'dragon') { poly(g, [cx - aw, fy - 120 * u, cx - 120 * u, top + 260 * u, cx - 20 * u, fy - 180 * u, cx + 80 * u, top + 220 * u, cx + aw, fy - 140 * u, cx + aw, fy, cx - aw, fy], rgba(T.wall[1], 0.85)); poly(g, [cx - 150 * u, top + 300 * u, cx - 120 * u, top + 260 * u, cx - 92 * u, top + 300 * u], '#f4f4f4'); }
    if (k === 'forest') for (let i = 0; i < 6; i++) { const tx = cx - aw + i * 90 * u, th = 200 + (i * 53) % 120; poly(g, [tx - 50 * u, fy - 40 * u, tx, fy - (th + 160) * u, tx + 50 * u, fy - 40 * u], rgba('#14261a', 0.8)); }
    if (k === 'torii') { const ty = fy - 120 * u; rect(g, cx - 130 * u, ty - 230 * u, 20 * u, 230 * u, '#c8322b', 4 * u); rect(g, cx + 110 * u, ty - 230 * u, 20 * u, 230 * u, '#c8322b', 4 * u); rect(g, cx - 170 * u, ty - 260 * u, 340 * u, 22 * u, '#c8322b', 4 * u, 6 * u); rect(g, cx - 150 * u, ty - 210 * u, 300 * u, 14 * u, '#c8322b', 4 * u); }
    if (k === 'dragon') { g.save(); g.globalAlpha = 0.5; g.fillStyle = INK; g.beginPath(); g.moveTo(cx - 160 * u, top + 200 * u); g.quadraticCurveTo(cx - 60 * u, top + 120 * u + Math.sin(t) * 10 * u, cx + 40 * u, top + 210 * u); g.lineTo(cx - 10 * u, top + 190 * u); g.lineTo(cx - 60 * u, top + 230 * u); g.lineTo(cx - 90 * u, top + 190 * u); g.closePath(); g.fill(); g.restore(); }
  } else if (k === 'glass') {
    const cols = ['#e8c040', '#d84a3a', '#4a7ad8', '#3aa85a', '#b84ad8'];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 7; j++) { g.fillStyle = rgba(cols[(i + j) % 5], 0.55); g.fillRect(cx - aw + i * aw * 0.4, top + j * 80 * u, aw * 0.4, 80 * u); }
    ink(g, 6 * u); for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(cx - aw + i * aw * 0.4, top); g.lineTo(cx - aw + i * aw * 0.4, fy); g.stroke(); } for (let j = 1; j < 7; j++) { g.beginPath(); g.moveTo(cx - aw, top + j * 80 * u); g.lineTo(cx + aw, top + j * 80 * u); g.stroke(); }
    disc(g, cx, top + 170 * u, 80 * u, rgba('#fff4c8', 0.7), 6 * u);
  } else { // rune / sigil / fire / stage: a turning glyph circle
    g.save(); g.translate(cx, top + 240 * u); g.rotate(t * 0.15); g.strokeStyle = rgba(k === 'fire' ? '#ffd23f' : '#ffffff', 0.55); g.lineWidth = 5 * u;
    g.beginPath(); g.arc(0, 0, 150 * u, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, 110 * u, 0, TAU); g.stroke();
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.beginPath(); g.moveTo(Math.cos(a) * 150 * u, Math.sin(a) * 150 * u); g.lineTo(Math.cos(a + TAU / 3) * 150 * u, Math.sin(a + TAU / 3) * 150 * u); g.stroke(); }
    g.restore();
  }
  g.restore();
  ink(g, 10 * u); g.stroke(); g.strokeStyle = rgba('#ffffff', 0.12); g.lineWidth = 4 * u; g.stroke();
  // keystone + stones
  rect(g, cx - 26 * u, top - 18 * u, 52 * u, 50 * u, T.wall[0], 5 * u, 6 * u); disc(g, cx, top + 8 * u, 10 * u, T.glow, 3 * u);
  g.restore();
}

// ---- particles -------------------------------------------------------------------------------------------------------
function particles(g, T, t, W, H, u) {
  const n = 46;
  g.save();
  for (let i = 0; i < n; i++) {
    const s = (i * 0.6180339) % 1, s2 = (i * 0.414) % 1, sp = 0.04 + s2 * 0.08;
    let x, y, a = 1;
    const k = T.fx;
    if (k === 'ember' || k === 'emberBlue' || k === 'spark' || k === 'mote' || k === 'smoke' || k === 'wisp' || k === 'note') { const v = (t * sp + s) % 1; x = s2 * W + Math.sin(t * (0.6 + s) + i) * 30 * u; y = H * (1.02 - v * 1.1); a = Math.sin(v * Math.PI); }
    else { const v = (t * sp * 0.9 + s) % 1; x = (s2 * W * 1.2 + v * W * 0.35 - W * 0.1) % W; y = H * (v * 1.1 - 0.05); a = Math.sin(v * Math.PI); }
    g.globalAlpha = Math.max(0, a) * (k === 'smoke' ? 0.12 : 0.85);
    if (k === 'ember') { g.fillStyle = i % 3 ? '#ff9a3a' : '#ffd23f'; g.fillRect(x, y, 4 * u, 4 * u); }
    else if (k === 'emberBlue') { g.fillStyle = i % 3 ? '#6ad8ff' : '#e8fbff'; g.fillRect(x, y, 4 * u, 4 * u); }
    else if (k === 'spark') { g.fillStyle = i % 2 ? '#9ac8ff' : '#d8a8ff'; g.beginPath(); g.moveTo(x, y - 6 * u); g.lineTo(x + 2 * u, y); g.lineTo(x, y + 6 * u); g.lineTo(x - 2 * u, y); g.fill(); }
    else if (k === 'mote') { g.fillStyle = '#fff0a8'; g.beginPath(); g.arc(x, y, 3 * u, 0, TAU); g.fill(); }
    else if (k === 'firefly') { const fx = s2 * W + Math.sin(t * 0.7 + i * 3) * 40 * u, fy = H * (0.3 + s * 0.6) + Math.cos(t * 0.9 + i) * 30 * u; g.globalAlpha = 0.4 + 0.5 * Math.max(0, Math.sin(t * 2 + i * 1.7)); g.fillStyle = '#d8ff8a'; g.beginPath(); g.arc(fx, fy, 3.5 * u, 0, TAU); g.fill(); }
    else if (k === 'smoke') { g.fillStyle = '#fff4e0'; g.beginPath(); g.ellipse(x, y, (16 + s * 18) * u, (10 + s * 10) * u, 0, 0, TAU); g.fill(); }
    else if (k === 'wisp') { g.fillStyle = i % 2 ? '#7affd8' : '#c8a8ff'; g.beginPath(); g.arc(x, y, 5 * u, 0, TAU); g.fill(); g.globalAlpha *= 0.4; g.beginPath(); g.arc(x, y + 8 * u, 3.5 * u, 0, TAU); g.fill(); }
    else if (k === 'note') { g.fillStyle = i % 2 ? '#ffd27a' : '#ff9ad8'; g.font = `${(18 + s * 10) * u}px serif`; g.fillText(i % 3 ? '♪' : '♫', x, y); }
    else { // sakura / dark petals / leaves
      g.save(); g.translate(x, y); g.rotate(t * (1 + s) + i); g.fillStyle = k === 'petalDark' ? (i % 2 ? '#8a6ad8' : '#c8b8ff') : k === 'sakura' ? (i % 2 ? '#ffb8d0' : '#ffd8e8') : '#7ac86a';
      g.beginPath(); g.ellipse(0, 0, 7 * u, 4 * u, 0, 0, TAU); g.fill(); g.restore();
    }
  }
  g.restore();
}

/** Paint one frame of the class scene; hero = { cls, app } (or null: an empty hall). */
export function drawTitleScene(g, W, H, cls, hero, t) {
  const T = themeOf(cls), u = H / 900, fy = H * 0.8, cx = W * 0.36;
  // back wall
  const wall = g.createLinearGradient(0, 0, 0, fy); wall.addColorStop(0, T.wall[1]); wall.addColorStop(1, T.wall[0]); g.fillStyle = wall; g.fillRect(0, 0, W, fy);
  // brick courses
  g.save(); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3 * u; const bh = 46 * u;
  for (let r = 0, y = fy; y > 0; r++, y -= bh) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); for (let x = (r % 2) * 60 * u; x < W; x += 120 * u) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - bh); g.stroke(); } }
  g.restore();
  drawArch(g, cx, fy, u, T, t, W, H);
  // pillars framing the hall
  for (const px of [W * 0.04, W * 0.68]) { rect(g, px, -10, 70 * u, fy + 10, T.wall[0], 6 * u); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(px + 10 * u, 0, 14 * u, fy); rect(g, px - 12 * u, fy - 40 * u, 94 * u, 40 * u, T.floor[0], 5 * u, 4 * u); }
  // floor
  const fl = g.createLinearGradient(0, fy, 0, H); fl.addColorStop(0, T.floor[0]); fl.addColorStop(1, T.floor[1]); g.fillStyle = fl; g.fillRect(0, fy, W, H - fy);
  ink(g, 5 * u); g.beginPath(); g.moveTo(0, fy); g.lineTo(W, fy); g.stroke();
  g.save(); g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 3 * u;
  for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(cx + i * 90 * u, fy); g.lineTo(cx + i * 260 * u, H); g.stroke(); }
  for (const f of [0.12, 0.3, 0.55, 0.85]) { const y = fy + (H - fy) * f; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.restore();
  // props: two on the left, two on the right (behind the text panel)
  const L = T.props, R = T.right;
  const at = [[W * 0.12, L[0], -1], [W * 0.2, L[1], -1], [W * 0.56, R[0], 1], [W * 0.93, R[1], 1]];
  for (const [x, k, side] of at) if (PROPS[k]) { g.save(); try { PROPS[k](g, x, fy + 6 * u, u * 1.05, t, T, side); } catch { /* keep the scene up */ } g.restore(); }
  // the hero on the platform
  drawPlatform(g, cx, fy + 40 * u, 170 * u, T.glow, t, { top: T.floor[0], side: T.floor[1] });
  if (hero) { // the last-used hero's showcase model (client/heromodel.js), clear of the logo and the text panel
    const y = fy + 34 * u, kind = hero.kind || 'pc';
    if (!view.started) { view.started = true; preloadAll(kind, hero.cls); view.flourish(hero.cls, t + 0.5); }
    const k = fitScale([hero.cls], { x: cx, y, bounds: [W * 0.02, H * 0.11, W * 0.64, H], max: H / 760 });
    view.draw(g, hero.cls, { x: cx, y, k, t, kind });
  }
  particles(g, T, t, W, H, u);
  // vignette + a soft glow wash in the class colour
  const v = g.createRadialGradient(W * 0.45, H * 0.5, H * 0.3, W * 0.5, H * 0.5, Math.max(W, H) * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  // right-side darkening so the text panel reads
  const rs = g.createLinearGradient(W * 0.55, 0, W, 0); rs.addColorStop(0, 'rgba(10,6,16,0)'); rs.addColorStop(1, 'rgba(10,6,16,.55)'); g.fillStyle = rs; g.fillRect(W * 0.55, 0, W * 0.45, H);
}
