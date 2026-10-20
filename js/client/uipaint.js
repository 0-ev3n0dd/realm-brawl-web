// Ornate painted UI (painted world stage): the U1 HUD frames (portrait, HP / resource bars, party frames, boss bar,
// skill tray + slots + ult orb, minimap ring, buff slots, chain-list plate), the U2 panel kit (windows, tooltips,
// buttons, tabs, rarity item slots, slider, checkbox, scrollbar, map frame: a CSS skin, body.pui in painted-ui.css),
// the U3 banners (logo, zone plaque, boss nameplate, victory / defeat) and the K / B / I / G icon sheet
// (assets/ui/icons.webp, 112 px cells). All text is still rendered by the game over the art, so it stays crisp.
// Art style = Classic turns all of it off (heroArt.mode).
import { heroArt } from './heropaint.js';

const hasDOM = typeof document !== 'undefined' && typeof Image !== 'undefined';
const BASE = hasDOM ? new URL('../../assets/ui/', import.meta.url).href : '';
export const UIP = { man: null, failed: false, epoch: 0 };
let manP = null;
const IMG = new Map();
export const uiOn = () => heroArt.painted && !UIP.failed;
function manifest() {
  if (!hasDOM || UIP.failed) return null;
  if (UIP.man) return UIP.man;
  if (!manP) manP = fetch(BASE + 'ui.json').then((r) => { if (!r.ok) throw new Error('ui.json ' + r.status); return r.json(); }).then((m) => { UIP.man = m; UIP.epoch++; }).catch((e) => { console.warn('[uipaint]', e.message); UIP.failed = true; });
  return null;
}
function img(file) {
  let s = IMG.get(file);
  if (s) return s.ok ? s.im : null;
  s = { ok: false, im: null }; IMG.set(file, s);
  const im = new Image(); im.decoding = 'async'; im.onload = () => { s.ok = true; s.im = im; UIP.epoch++; }; im.onerror = () => console.warn('[uipaint] failed', file); im.src = BASE + file;
  return null;
}
/** a UI piece image (null while loading / Classic) */
export function uiImg(name) { if (!uiOn()) return null; const m = manifest(); return m && m.pieces[name] ? img(name + '.webp') : null; }
/** inner content box of each frame (fractions of the piece): content is drawn there, the frame around it */
export const INNER = {
  skillslot: [0.133, 0.225, 0.867, 0.881], buffslot: [0.133, 0.2, 0.86, 0.86], ultorb: [0.264, 0.29, 0.736, 0.77], minimap: [0.13, 0.13, 0.87, 0.87],
  portraitC: [0.093, 0.252, 0.338, 0.782], portraitN: [0.397, 0.369, 0.892, 0.68], partyC: [0.094, 0.306, 0.307, 0.702], partyN: [0.392, 0.347, 0.865, 0.661],
  bossplate: [0.1, 0.6, 0.9, 0.85], victory: [0.17, 0.4, 0.83, 0.74], defeat: [0.1, 0.32, 0.9, 0.84], countersign: [0.08, 0.3, 0.92, 0.9],
  tooltip: [0.042, 0.102, 0.962, 0.888], window: [0.031, 0.091, 0.969, 0.895], scroll: [0.108, 0.209, 0.886, 0.791], mapframe: [0.05, 0.14, 0.95, 0.89],
};
const IN_KEY = { portrait: 'portraitC', partyframe: 'partyC' };
/** draw piece `name` so that its inner box (INNER[key]) covers the rect (x, y, w, h). Returns false while loading. */
export function uiAround(ctx, name, x, y, w, h, key = IN_KEY[name] || name, alpha = 1) {
  const im = uiImg(name), f = INNER[key]; if (!im || !f) return false;
  const W = w / (f[2] - f[0]), Hh = h / (f[3] - f[1]);
  const a0 = ctx.globalAlpha; if (alpha < 1) ctx.globalAlpha = a0 * alpha;
  ctx.drawImage(im, x - f[0] * W, y - f[1] * Hh, W, Hh);
  ctx.globalAlpha = a0;
  return true;
}
/** stretch a piece into a rect */
export function uiDraw(ctx, name, x, y, w, h, alpha = 1) {
  const im = uiImg(name); if (!im) return false;
  const a0 = ctx.globalAlpha; if (alpha < 1) ctx.globalAlpha = a0 * alpha;
  ctx.drawImage(im, x, y, w, h); ctx.globalAlpha = a0; return true;
}
/** nine-slice: source corner size s (px), destination corner size d */
export function ui9(ctx, name, x, y, w, h, s = 40, d = 20, alpha = 1) {
  const im = uiImg(name); if (!im) return false;
  const W = im.width, Hh = im.height, a0 = ctx.globalAlpha; if (alpha < 1) ctx.globalAlpha = a0 * alpha;
  d = Math.min(d, w / 2, h / 2);
  const sx = [0, s, W - s, W], sy = [0, s, Hh - s, Hh], dx = [x, x + d, x + w - d, x + w], dy = [y, y + d, y + h - d, y + h];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const sw = sx[i + 1] - sx[i], sh = sy[j + 1] - sy[j], dw = dx[i + 1] - dx[i], dh = dy[j + 1] - dy[j]; if (sw > 0 && sh > 0 && dw > 0 && dh > 0) ctx.drawImage(im, sx[i], sy[j], sw, sh, dx[i], dy[j], dw, dh); }
  ctx.globalAlpha = a0; return true;
}
/** three-slice horizontally: left cap [0,l], a stretched strip [m0,m1], right cap [r,W] (scaled to height h) */
export function ui3(ctx, name, x, y, w, h, l, m0, m1, r, alpha = 1) {
  const im = uiImg(name); if (!im) return false;
  const k = h / im.height, lw = l * k, rw = (im.width - r) * k, a0 = ctx.globalAlpha; if (alpha < 1) ctx.globalAlpha = a0 * alpha;
  ctx.drawImage(im, 0, 0, l, im.height, x, y, lw, h);
  ctx.drawImage(im, m0, 0, m1 - m0, im.height, x + lw, y, Math.max(0, w - lw - rw), h);
  ctx.drawImage(im, r, 0, im.width - r, im.height, x + w - rw, y, rw, h);
  ctx.globalAlpha = a0; return true;
}

// ------------------------------------------------------------------ icons (K skills, B debuffs / buffs, I items, G glyphs)
function iconSheet() { if (!uiOn()) return null; const m = manifest(); return m ? img('icons.webp') : null; }
export function hasIcon(key) { const m = uiOn() && manifest(); return !!(m && key in m.icons); }
/** draw icon `key` centred at (x, y), size s (square, optional rounded clip r). Returns false if missing / loading. */
export function uiIcon(ctx, key, x, y, s, r = s * 0.16, alpha = 1) {
  const sh = iconSheet(), m = UIP.man; if (!sh || !m || !(key in m.icons)) return false;
  const i = m.icons[key], c = m.icon, sx = (i % m.cols) * c, sy = Math.floor(i / m.cols) * c;
  ctx.save(); if (alpha < 1) ctx.globalAlpha *= alpha;
  if (r > 0) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - s / 2, y - s / 2, s, s, r) : ctx.rect(x - s / 2, y - s / 2, s, s); ctx.clip(); }
  ctx.drawImage(sh, sx + 2, sy + 2, c - 4, c - 4, x - s / 2, y - s / 2, s, s);
  ctx.restore(); return true;
}
/** CSS for a DOM element showing icon `key` at size s px (background sprite), or '' */
export function iconStyle(key, s) {
  const m = uiOn() && manifest(); if (!m || !(key in m.icons)) return '';
  iconSheet();
  const i = m.icons[key], k = s / m.icon;
  return `background:url(${BASE}icons.webp) ${-(i % m.cols) * m.icon * k}px ${-Math.floor(i / m.cols) * m.icon * k}px / ${m.cols * m.icon * k}px ${m.rows * m.icon * k}px no-repeat;`;
}
/** skill icon key for a HUD slot (Q E R F = the class skills, SP = the Special, ULT, basic = the class weapon) */
export function skillIconKey(clsId, slot) {
  if (slot === 'basic' || slot === 'LMB') return 'w_' + clsId;
  if (slot === 'ult' || slot === 'T') return clsId + '_ULT';
  if (slot === 'dodge' || slot === 'SHIFT') return null;
  return clsId + '_' + slot;
}
/** painted item icon key: I1 base gear (weapon per class, armour / ring by rarity), I2 legendary, I3 set + Trial Sigil */
export function itemIconKey(item) {
  if (!item) return null;
  const r = item.rarity | 0, cls = item.cls || 'warrior', h = [...String(item.uid ?? item.name ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0);
  if (item.slot === 'sigil' || r === 5) return 'sigil';
  if (!['weapon', 'armor', 'ring'].includes(item.slot)) return null; // (gear expansion slots: the classic vector icons, client/art.js GEAR_ICON)
  if (r === 4) return item.slot === 'weapon' ? 'sw_' + cls : item.slot === 'armor' ? 'sarmor' : 'sring';
  if (r === 3) return item.slot === 'weapon' ? 'lw_' + cls : item.slot === 'armor' ? 'larmor' + (h % 2) : 'lring' + (h % 2);
  return item.slot === 'weapon' ? 'w_' + cls : item.slot === 'armor' ? 'armor' + Math.min(2, r) : 'ring' + Math.min(2, r);
}
/** buff / debuff status keys → B1 / B2 icons */
export const STATUS_ICON = {
  bleed: 'bleed', burn: 'burn', chill: 'chill', slow: 'slow', frozen: 'frozen', freeze: 'frozen', stun: 'stun', root: 'root', mark: 'mark', marked: 'mark', cut: 'cut', cuts: 'cut', pp: 'pp', impaled: 'impaled', condemn: 'condemn', dissonant: 'dissonant', scorched: 'scorched', down: 'down', glyph: 'glyph',
  shield: 'shield', stealth: 'stealth', valor: 'valor', haste: 'haste', mending: 'mending', requiem: 'requiem', intune: 'intune', warpath: 'warpath', decree: 'decree', trinity: 'trinity', stillness: 'stillness', flow: 'flow', skyborne: 'skyborne', quarry: 'quarry', aura: 'aura', ult: 'ultactive',
};

// ------------------------------------------------------------------ the DOM skin (painted-ui.css: body.pui)
function syncBody() { if (hasDOM && document.body) document.body.classList.toggle('pui', uiOn()); }
if (hasDOM) { heroArt.listeners.add(() => { syncBody(); if (uiOn()) uiPreload(); }); if (document.body) syncBody(); else addEventListener('DOMContentLoaded', syncBody); }
/** warm the HUD frames + icon sheet (called at game start) */
export function uiPreload() { if (!uiOn()) return; manifest(); for (const n of ['portrait', 'hpbar', 'resbar', 'skillslot', 'ultorb', 'minimap', 'skilltray', 'bossbar', 'zoneplaque', 'bossplate', 'buffslot', 'window']) img(n + '.webp'); iconSheet(); }

// ------------------------------------------------------------------ segmented frames (bars / trays keep their caps and centre crests unstretched)
// segs: [srcX0, srcX1, stretch?] across the piece; ix: the source x span of the inner box; iy: its height fractions
const SEG = {
  hpbar: { segs: [[0, 46, 0], [200, 260, 1], [417, 472, 0]], ix: [40, 423], iy: [0.2, 0.787] },
  resbar: { segs: [[0, 50, 0], [200, 240, 1], [397, 447, 0]], ix: [44, 403], iy: [0.186, 0.767] },
  bossbar: { segs: [[0, 60, 0], [100, 140, 1], [405, 465, 0]], ix: [44, 421], iy: [0.47, 0.73] }, // (the centre crest is left out: the U3 boss nameplate sits there)
  skilltray: { segs: [[0, 66, 0], [137, 147, 1], [478, 544, 0]], ix: [62, 482], iy: [0.12, 0.88] },
  ribbon_red: { segs: [[0, 120, 0], [240, 280, 1], [398, 518, 0]], ix: [104, 414], iy: [0.2, 0.75] },
  ribbon_blue: { segs: [[0, 120, 0], [240, 280, 1], [400, 520, 0]], ix: [104, 416], iy: [0.2, 0.75] },
  zoneplaque: { segs: [[0, 200, 0], [215, 225, 1], [225, 354, 0], [354, 364, 1], [379, 579, 0]], ix: [100, 479], iy: [0.3, 0.78] },
};
/** a segmented frame whose inner box covers (x, y, w, h); false while loading */
export function uiSeg(ctx, name, x, y, w, h, alpha = 1) {
  const im = uiImg(name), S = SEG[name]; if (!im || !S) return false;
  const k = h / ((S.iy[1] - S.iy[0]) * im.height), Hh = im.height * k, y0 = y - S.iy[0] * im.height * k;
  const total = w + (S.ix[0] + im.width - S.ix[1]) * k;
  let fixed = 0, nS = 0; for (const s of S.segs) if (s[2]) nS++; else fixed += (s[1] - s[0]) * k;
  const sw = Math.max(0, (total - fixed) / Math.max(1, nS));
  const a0 = ctx.globalAlpha; if (alpha < 1) ctx.globalAlpha = a0 * alpha;
  let dx = x - S.ix[0] * k;
  for (const s of S.segs) { const dw = s[2] ? sw : (s[1] - s[0]) * k; if (dw > 0.5) ctx.drawImage(im, s[0], 0, s[1] - s[0], im.height, dx, y0, dw + 0.6, Hh); dx += dw; }
  ctx.globalAlpha = a0; return true;
}
/** inner box → frame box for SEG pieces (for layout: returns {x, y, w, h} of the whole art) */
export function uiSegBox(name, x, y, w, h) {
  const m = UIP.man, S = SEG[name]; if (!m || !S || !m.pieces[name]) return null;
  const P = m.pieces[name], k = h / ((S.iy[1] - S.iy[0]) * P.h);
  return { x: x - S.ix[0] * k, y: y - S.iy[0] * P.h * k, w: w + (S.ix[0] + P.w - S.ix[1]) * k, h: P.h * k };
}

// ------------------------------------------------------------------ G1 glyphs on the DOM menu buttons
const GLYPH_IDS = { resumeBtn: 'g_star', townBtn: 'g_town', optionsBtn: 'g_options', menuOptionsBtn: 'g_options', menuSettings: 'g_options', muteBtn: 'g_sound', quitBtn: 'g_quit', inviteBtn: 'g_invite', btnInv: 'g_inventory', btnPause: 'g_options', newHero: 'g_star' };
let glyphCss = false;
function glyphStyles(m) {
  if (glyphCss || !hasDOM) return; glyphCss = true;
  const rules = Object.entries(m.icons).filter(([k]) => k.startsWith('g_')).map(([k, i]) => `.pui [data-g="${k}"]::before{background-image:url(${BASE}icons.webp);background-size:${m.cols * 100}% ${m.rows * 100}%;background-position:${((i % m.cols) / (m.cols - 1)) * 100}% ${(Math.floor(i / m.cols) / (m.rows - 1)) * 100}%}`);
  rules.push(`.pui .tt-icon{background-image:url(${BASE}icons.webp)}`);
  const st = document.createElement('style'); st.id = 'pui-glyphs'; st.textContent = rules.join('\n'); document.head.appendChild(st);
}
/** tag the menu buttons with their G1 glyph (the leading emoji is wrapped so the painted skin can hide it) */
export function applyGlyphs(root = hasDOM ? document : null) {
  if (!root || !uiOn()) return;
  const m = manifest(); if (!m) { if (manP) manP.then(() => applyGlyphs(root)); return; }
  glyphStyles(m); iconSheet();
  for (const [id, g] of Object.entries(GLYPH_IDS)) {
    const el = root.getElementById ? root.getElementById(id) : null; if (!el || el.dataset.g) continue;
    el.dataset.g = g;
    const t = el.firstChild;
    if (t && t.nodeType === 3) { const mm = t.textContent.match(/^\s*(?:(?:\p{Extended_Pictographic}|[\u2190-\u21FF\u2600-\u27BF])\uFE0F?\s*)+/u); if (mm) { const sp = document.createElement('span'); sp.className = 'emo'; sp.textContent = mm[0]; t.textContent = t.textContent.slice(mm[0].length); el.insertBefore(sp, t); } }
  }
}
if (hasDOM) { const go = () => applyGlyphs(); if (document.readyState === 'loading') addEventListener('DOMContentLoaded', go); else setTimeout(go, 0); heroArt.listeners.add(go); }

/** resolves once ui.json is in (null in Classic / no DOM) */
export function uiReady() { if (!uiOn()) return Promise.resolve(null); manifest(); return manP ? manP.then(() => UIP.man) : Promise.resolve(UIP.man); }
/** class select: the class's K icons (skills in key order, Special, Ultimate) as a strip of small painted plates */
export function skillStripHTML(cls, C) {
  if (!uiOn() || !C) return '';
  const keys = [...['Q', 'E', 'R', 'F', 'SP'].filter((k) => C.skills[k]), 'ULT'];
  const parts = keys.map((k) => { const st = iconStyle(cls + '_' + k, 34); const nm = k === 'ULT' ? (C.ult ? C.ult.name : 'Ultimate') : C.skills[k].name; return st ? `<span class="ki" style="${st}" title="${nm.replace(/"/g, '')}"></span>` : ''; }).join('');
  return parts ? `<div class="kstrip">${parts}</div>` : '';
}
/** class select cards: the K5 crest badge in the corner (painted) */
export function crestBadges(root) {
  if (!hasDOM) return;
  for (const d of root.querySelectorAll('.class-card')) {
    let b = d.querySelector('.cc-crest');
    const st = uiOn() ? iconStyle(d.dataset.cls + '_crest', 24) : '';
    if (!st) { if (b) b.remove(); continue; }
    if (!b) { b = document.createElement('span'); b.className = 'cc-crest'; d.appendChild(b); }
    b.setAttribute('style', st);
  }
}
