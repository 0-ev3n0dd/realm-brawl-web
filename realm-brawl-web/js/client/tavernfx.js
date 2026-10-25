// The painted tavern hub (Art style = Painted): the guild hall painting (assets/world/hall.webp) as the walkable floor
// and walls, Hana the Mission Clerk behind the Mission Counter (front / side / gesture poses; the counter is redrawn
// over her from the painting so she stands behind it), the ambient NPCs and the H2 furniture as y-sorted painted
// sprites, the two Realm Gates (the painted arches on the side walls) with live glow / seal overlays, travel pads and
// prompts, the counter's interact ring and the hall minimap. Geometry + collision live in sim/townconst.js
// (HALL_FLOOR, TAVERN_PROPS, HUB_GEO.tavern); this file only draws. Classic keeps Brightwater Village (townfx.js).
import { TOWN_POS as T, HALL_K, HALL_W, HALL_H, hallPt, TAVERN_PROPS, HUB_GEO, nearCounter, inTownArea, hubGatePos, TOWN_NAME } from '../sim/townconst.js';
import { GATES, GATE_R } from '../sim/dunesconst.js';
import { WP, wpHall, wpPiece, wpProp, wpOn } from './worldpaint.js';
// (a co-op guest on Classic still sees the host's tavern: the hall art is forced on while drawing it)
const F = (fn) => function (...a) { const f0 = WP.force; WP.force = true; try { return fn.apply(this, a); } finally { WP.force = f0; } };
import { INK, circle, rrect } from './art.js';
import { bloom } from './fxglow.js';

const TAU = Math.PI * 2, FONT = "'Lilita One', sans-serif";
const HW = (HALL_W * HALL_K) / 2, HH = (HALL_H * HALL_K) / 2;
/** is the tavern hub the one to draw (the world's layout is the tavern and the painting is loaded)? */
export const tavernOn = (sim) => !!(sim && sim.world && sim.world.hubLayout === 'tavern');
export const tavernVisible = (view) => view.x1 > T.x - HW - 60 && view.x0 < T.x + HW + 60 && view.y1 > T.y - HH - 60 && view.y0 < T.y + HH + 60;
let GATE_U = { dunes: false, frost: false, ember: false, rift: false };
export function setTavernUnlocks(u) { if (u) GATE_U = u; }
const gateOpen = (g) => !g.lock || !!GATE_U[g.lock];
// the painted arches (image px): centre of the portal surface + its half extents, the plaque spot above
const ARCH = { field: { cx: 108, cy: 300, rx: 70, ry: 150, plate: [112, 128] }, dunes: { cx: 1186, cy: 305, rx: 62, ry: 150, plate: [1186, 112] } };

/** the hall floor + walls (under everything). Returns true when drawn (else the caller can fall back to the village). */
export const drawTavernGround = F(function drawTavernGround(ctx, view, t) {
  if (!tavernVisible(view)) return false;
  const im = wpHall();
  ctx.fillStyle = '#120c0a'; ctx.fillRect(Math.max(view.x0, T.x - HW - 400), Math.max(view.y0, T.y - HH - 400), Math.min(view.x1, T.x + HW + 400) - Math.max(view.x0, T.x - HW - 400), Math.min(view.y1, T.y + HH + 400) - Math.max(view.y0, T.y - HH - 400));
  if (im) ctx.drawImage(im, T.x - HW, T.y - HH, HW * 2, HH * 2);
  else { ctx.fillStyle = '#3a2618'; ctx.fillRect(T.x - HW, T.y - HH, HW * 2, HH * 2); }
  // hearth + candle flicker (cheap additive glows over the painted fire and chandeliers)
  const f = 0.5 + 0.25 * Math.sin(t * 9) + 0.15 * Math.sin(t * 23);
  const p = hallPt(318, 262); bloom(ctx, p.x, p.y, 120, '#ff9a3a', 0.18 + 0.1 * f);
  for (const [ix, iy] of [[200, 60], [1010, 60]]) { const q = hallPt(ix, iy); bloom(ctx, q.x, q.y, 90, '#ffd27a', 0.1 + 0.05 * Math.sin(t * 7 + ix)); }
  // the cartouche over the counter gets its sign (crisp text over the art)
  const s = hallPt(640, 66);
  ctx.save(); ctx.font = `26px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(30,16,8,.9)'; ctx.strokeText('MISSION COUNTER', s.x, s.y); ctx.fillStyle = '#ffe2a0'; ctx.fillText('MISSION COUNTER', s.x, s.y);
  ctx.font = `13px ${FONT}`; ctx.lineWidth = 3; ctx.strokeText(TOWN_NAME.toUpperCase() + ' GUILD HALL', s.x, s.y + 22); ctx.fillStyle = '#d9b77a'; ctx.fillText(TOWN_NAME.toUpperCase() + ' GUILD HALL', s.x, s.y + 22); ctx.restore();
  for (const g of GATES) gateFloor(ctx, g, t);
  return true;
});
function gateFloor(ctx, g, t) {
  const o = hubGatePos(g, 'tavern'), open = gateOpen(g), R = GATE_R + 8;
  ctx.save(); ctx.translate(o.x, o.y); ctx.scale(1, 0.5);
  ctx.beginPath(); ctx.arc(0, 0, R + 10, 0, TAU); ctx.fillStyle = open ? 'rgba(20,14,10,.35)' : 'rgba(20,14,10,.45)'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 24; ctx.strokeStyle = open ? g.col : '#77708a'; ctx.lineWidth = 4; ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  if (open) bloom(ctx, o.x, o.y, R * 1.8, g.col, 0.3 + 0.08 * Math.sin(t * 3));
}

/** y-sorted entries: furniture, NPCs, Hana (with the counter front redrawn over her) */
export function tavernSprites(view, local) {
  if (!tavernVisible(view)) return [];
  const out = [];
  for (const o of TAVERN_PROPS) out.push({ kind: 'tavprop', o, y: o.y + (o.sh === 'rect' ? o.h / 2 : o.r * 0.3) });
  const c = HUB_GEO.tavern.clerk;
  out.push({ kind: 'tavprop', o: { kind: 'clerk' }, y: c.y, local });
  return out;
}
export const drawTavernSprite = F(function drawTavernSprite(ctx, s, t, local) {
  const o = s.o;
  if (o.kind === 'clerk') return hana(ctx, t, local);
  const fy = o.y + (o.foot || 0);
  ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#100806'; ctx.beginPath(); ctx.ellipse(o.x, fy - 2, (o.sh === 'rect' ? o.w * 0.55 : o.r * 1.6), (o.sh === 'rect' ? o.h * 0.5 : o.r * 0.6), 0, 0, TAU); ctx.fill(); ctx.restore();
  if (o.kind === 'npc') {
    const br = 1 + 0.012 * Math.sin(t * 2.1 + o.x);
    ctx.save(); ctx.translate(o.x, fy); ctx.scale(1, br); wpProp(ctx, o.art, 0, 0, o.ht); ctx.restore();
    if (local && Math.hypot(local.x - o.x, local.y - o.y) < 230) nameTag(ctx, o.x, fy - o.ht - 10, o.name, o.title);
    return;
  }
  wpProp(ctx, o.art, o.x, fy, o.ht);
  if (o.kind === 'candles') bloom(ctx, o.x, fy - o.ht * 0.85, 46, '#ffd27a', 0.35 + 0.08 * Math.sin(t * 8 + o.x));
});
function nameTag(ctx, x, y, name, title) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `15px ${FONT}`; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(name, x, y); ctx.fillStyle = '#ffe9a0'; ctx.fillText(name, x, y);
  ctx.font = `11px ${FONT}`; ctx.lineWidth = 3; ctx.strokeText(title, x, y + 13); ctx.fillStyle = '#e8d6b8'; ctx.fillText(title, x, y + 13);
  ctx.restore();
}
/** Hana: front pose by default, a glance to the side now and then, the welcoming gesture when you walk up */
function hana(ctx, t, local) {
  const c = HUB_GEO.tavern.clerk, near = local && nearCounter(local.x, local.y, 40, 'tavern');
  const cyc = t % 9, pose = near ? 'npc_hana_gesture' : cyc > 6.5 && cyc < 8.3 ? 'npc_hana_side' : 'npc_hana';
  const feet = c.y + 22, ht = pose === 'npc_hana_gesture' ? 150 : 146, br = 1 + 0.01 * Math.sin(t * 2.2);
  ctx.save(); ctx.translate(c.x + (pose === 'npc_hana_gesture' ? 8 : 0), feet); ctx.scale(1, br); wpProp(ctx, pose, 0, 0, ht); ctx.restore();
  const im = wpHall(); // the counter's front, cut from the painting, so Hana stands behind it
  if (im) { const ix = 458, iy = 276, iw = 360, ih = 74, p = hallPt(ix, iy); ctx.drawImage(im, ix, iy, iw, ih, p.x, p.y, iw * HALL_K, ih * HALL_K); }
  // speech bubble
  const by = feet - ht - 16 + Math.sin(t * 3) * 3;
  ctx.save(); ctx.translate(c.x + 40, by);
  circle(ctx, 0, 0, 15, near ? '#ffd23f' : '#fff', 3.5);
  ctx.font = `20px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.fillText(near ? '…' : '!', 0, 1);
  ctx.restore();
  if (local && Math.hypot(local.x - c.x, local.y - c.y) < 260) nameTag(ctx, c.x, by - 24, c.name, c.title);
}

/** over the characters: the gates' live glow / seal + plaques + prompts, the counter's interact ring */
export const drawTavernOver = F(function drawTavernOver(ctx, view, t, local) {
  if (!tavernVisible(view)) return;
  for (const g of GATES) {
    const A = ARCH[g.id]; if (!A) continue;
    const c = hallPt(A.cx, A.cy), rx = A.rx * HALL_K, ry = A.ry * HALL_K, open = gateOpen(g);
    if (open) {
      bloom(ctx, c.x, c.y, Math.max(rx, ry) * 1.3, g.col, 0.16 + 0.07 * Math.sin(t * 2.4 + c.x));
      ctx.save(); ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU); ctx.clip();
      for (let i = 0; i < 9; i++) { const ph = (t * 0.35 + i / 9) % 1, x = c.x + Math.sin(i * 2.7 + t) * rx * 0.6, y = c.y + ry * (0.8 - ph * 1.6); ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.8; circle(ctx, x, y, 2.4, '#fffbe0', 0); }
      ctx.restore(); ctx.globalAlpha = 1;
    } else { // sealed: the portal dimmed under a chained glyph seal
      ctx.save(); ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU); ctx.fillStyle = 'rgba(24,16,30,.72)'; ctx.fill();
      ctx.clip(); for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(c.x - rx, c.y - ry * 0.5 * sd); ctx.lineTo(c.x + rx, c.y + ry * 0.5 * sd); ctx.setLineDash([7, 5]); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#9aa1ab'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]); }
      ctx.restore();
      rrect(ctx, c.x - 10, c.y - 8, 20, 17, 3); ctx.fillStyle = '#d9a33a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.arc(c.x, c.y - 8, 6, Math.PI, TAU); ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.stroke();
    }
    const pl = hallPt(A.plate[0], A.plate[1]);
    rrect(ctx, pl.x - 70, pl.y - 18, 140, 36, 8); ctx.fillStyle = 'rgba(28,18,14,.82)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = open ? g.col : '#77708a'; ctx.stroke();
    ctx.font = `15px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = open ? '#fff' : '#b9b3c6'; ctx.fillText(g.name.toUpperCase(), pl.x, pl.y - 1);
    ctx.font = `11px ${FONT}`; ctx.fillStyle = open ? g.col : '#9a93ab'; ctx.fillText(open ? g.sub : 'SEALED', pl.x, pl.y + 12);
    const o = hubGatePos(g, 'tavern');
    if (local && Math.hypot(local.x - o.x, local.y - o.y) < 130) {
      const s = open ? `Walk into the gate: ${g.name}` : g.lockText;
      ctx.font = `14px ${FONT}`; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(s, o.x, o.y + 44); ctx.fillStyle = open ? '#ffe9a0' : '#ff9a8a'; ctx.fillText(s, o.x, o.y + 44);
    }
  }
  if (local && inTownArea(local.x, local.y)) {
    const C = HUB_GEO.tavern.counter, near = nearCounter(local.x, local.y, 0, 'tavern');
    ctx.save(); ctx.translate(C.x, C.y); ctx.scale(1, 0.5);
    ctx.beginPath(); ctx.arc(0, 0, 62 + Math.sin(t * 4) * 4, 0, TAU);
    ctx.setLineDash([12, 9]); ctx.lineDashOffset = -t * 30; ctx.strokeStyle = near ? 'rgba(255,210,63,.95)' : 'rgba(255,240,210,.45)'; ctx.lineWidth = near ? 6 : 4; ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
});
/** the camera frames the hall: centred when the view is bigger than the hall, else clamped to its walls */
export function tavernCamera(cam, w, h) {
  const vw = w / 2 / cam.zoom, vh = h / 2 / cam.zoom;
  cam.x = vw >= HW ? T.x : Math.max(T.x - HW + vw, Math.min(T.x + HW - vw, cam.x));
  cam.y = vh >= HH ? T.y : Math.max(T.y - HH + vh, Math.min(T.y + HH - vh, cam.y));
}

// ------------------------------------------------------------------ minimap: the hall painting with markers
export const drawTavernMinimap = F(function drawTavernMinimap(g, S, p, others) {
  const im = wpHall(), k = S / (HW * 2 + 40), cx = S / 2, cy = S / 2;
  g.fillStyle = '#120c0a'; g.fillRect(0, 0, S, S);
  const X = (x) => cx + (x - T.x) * k, Y = (y) => cy + (y - T.y) * k;
  if (im) g.drawImage(im, X(T.x - HW), Y(T.y - HH), HW * 2 * k, HH * 2 * k);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X(T.x - HW), Y(T.y - HH), HW * 2 * k, HH * 2 * k);
  for (const gt of GATES) { const o = hubGatePos(gt, 'tavern'); circle(g, X(o.x), Y(o.y), Math.max(4, 30 * k), gateOpen(gt) ? gt.col : '#77708a', 1.5); }
  const C = HUB_GEO.tavern.counter;
  g.save(); g.translate(X(C.x), Y(C.y) - 8); g.font = `bold 14px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  circle(g, 0, 0, 8, '#ff5e5b', 2); g.fillStyle = '#fff'; g.fillText('!', 0, 1); g.restore();
  for (const o of TAVERN_PROPS) if (o.kind === 'npc') circle(g, X(o.x), Y(o.y), 3, '#ffd23f', 1.2);
  for (const o of others) circle(g, X(o.x), Y(o.y), 4, '#3a8ee8', 2);
  circle(g, X(p.x), Y(p.y), 5, '#fff', 2.5);
});
export const tavernReady = () => wpOn() && !!wpHall() && !!wpPiece('npc_hana');
