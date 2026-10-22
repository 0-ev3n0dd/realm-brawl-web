// Experience pass 3: drawing the village services (classic art): Borin's forge hearth + anvil, Dorrik's crates, the Stash
// chest, the NPCs (with name plates when you are close) and the interact rings / minimap pins for every station.
import { INK, circle, shadow, rrect, shade, drawHero } from './art.js';
import { STATIONS, STATION, nearStation } from '../sim/village.js';

const TAU = Math.PI * 2;
function hearth(ctx, o, t) {
  const x = o.x - o.w / 2, y = o.y - o.h / 2;
  shadow(ctx, o.x + 5, o.y + o.h / 2 + 3, o.w * 0.55, 10, 0.25);
  rrect(ctx, x, y - 26, o.w, o.h + 26, 8); ctx.fillStyle = '#8d8f99'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { rrect(ctx, x + 4 + i * 15 + (j % 2) * 7, y - 22 + j * 14, 12, 10, 3); ctx.fillStyle = shade('#8d8f99', -0.12 - ((i + j) % 2) * 0.06); ctx.fill(); }
  // the glowing mouth
  ctx.save(); ctx.shadowColor = '#ff8a2a'; ctx.shadowBlur = 22;
  rrect(ctx, o.x - 17, y + 2, 34, 20, 9); const f = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 4.3);
  ctx.fillStyle = `rgba(255,${130 + (f * 70) | 0},40,1)`; ctx.fill(); ctx.restore();
  rrect(ctx, o.x - 17, y + 2, 34, 20, 9); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  // chimney smoke + sparks
  for (let i = 0; i < 3; i++) { const k = (t * 0.5 + i / 3) % 1; ctx.globalAlpha = 0.45 * (1 - k); circle(ctx, o.x + 18 + Math.sin(t + i) * 6, y - 34 - k * 60, 7 + k * 10, '#d8d8de', 0); }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 4; i++) { const k = (t * 1.3 + i * 0.27) % 1; circle(ctx, o.x - 8 + i * 6 + Math.sin(t * 3 + i) * 5, y - k * 40, 1.8, '#ffcf4a', 0); }
}
function anvil(ctx, o, t) {
  shadow(ctx, o.x + 3, o.y + 10, 24, 7, 0.25);
  rrect(ctx, o.x - 8, o.y - 6, 16, 16, 3); ctx.fillStyle = '#6b4a2a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(o.x - 22, o.y - 18); ctx.lineTo(o.x + 14, o.y - 18); ctx.quadraticCurveTo(o.x + 26, o.y - 16, o.x + 24, o.y - 10); ctx.lineTo(o.x + 10, o.y - 8); ctx.lineTo(o.x + 8, o.y - 4); ctx.lineTo(o.x - 12, o.y - 4); ctx.lineTo(o.x - 14, o.y - 9); ctx.lineTo(o.x - 22, o.y - 12); ctx.closePath();
  ctx.fillStyle = '#4a4f5c'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(o.x - 18, o.y - 16); ctx.lineTo(o.x + 12, o.y - 16); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
  // a glowing blade on it
  ctx.save(); ctx.shadowColor = '#ff9a3a'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(o.x - 14, o.y - 20); ctx.lineTo(o.x + 8, o.y - 21); ctx.strokeStyle = `rgba(255,${150 + 60 * Math.sin(t * 3) | 0},60,1)`; ctx.lineWidth = 3.5; ctx.stroke(); ctx.restore();
}
function crates(ctx, o) {
  shadow(ctx, o.x + 4, o.y + o.h / 2 + 3, o.w * 0.6, 8, 0.22);
  for (const [dx, dy, s] of [[-6, 4, 26], [10, 6, 22], [2, -14, 22]]) {
    rrect(ctx, o.x + dx - s / 2, o.y + dy - s / 2, s, s, 3); ctx.fillStyle = '#c08a4f'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(o.x + dx - s / 2 + 3, o.y + dy - s / 2 + 3); ctx.lineTo(o.x + dx + s / 2 - 3, o.y + dy + s / 2 - 3); ctx.strokeStyle = '#8a5a35'; ctx.lineWidth = 2; ctx.stroke();
  }
  circle(ctx, o.x - 18, o.y - 10, 6, '#ff5e7a', 2.5); circle(ctx, o.x - 10, o.y - 14, 5, '#7ee0ff', 2.5); // potion bottles
}
function chest(ctx, o, t, local) {
  const open = local && nearStation(local.x, local.y) === STATION.stash;
  const x = o.x - o.w / 2, y = o.y - o.h / 2;
  shadow(ctx, o.x + 4, o.y + o.h / 2 + 3, o.w * 0.6, 8, 0.25);
  rrect(ctx, x, y - 6, o.w, o.h + 6, 6); ctx.fillStyle = '#9b5f2e'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  if (open) { ctx.save(); ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 16; rrect(ctx, x + 4, y - 10, o.w - 8, 8, 3); ctx.fillStyle = '#ffe9a0'; ctx.fill(); ctx.restore(); }
  rrect(ctx, x - 2, y - (open ? 26 : 16), o.w + 4, 16, 8); ctx.fillStyle = '#b26f36'; ctx.fill(); ctx.stroke(); // lid
  for (const fx of [x + 8, x + o.w - 12]) { ctx.fillStyle = '#d7b35a'; ctx.fillRect(fx, y - (open ? 26 : 16), 4, o.h + (open ? 26 : 16)); }
  rrect(ctx, o.x - 5, y - 2, 10, 10, 2); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
  void t;
}
/** story marks over NPC heads: fn(stationId) -> '' | 'new' | 'ready' (set by client/story.js) */
let markFn = () => '';
export const setNpcMarks = (fn) => { markFn = fn || (() => ''); };
export const npcMark = (id) => markFn(id);
function npc(ctx, o, t, local) {
  const S = STATION[o.st]; if (!S) return;
  const near = local && nearStation(local.x, local.y) === S;
  const bob = Math.sin(t * 2.1 + o.x) * 1.4;
  const hammer = o.st === 'smith' && !near ? Math.max(0, Math.sin(t * 3.2)) : 0;
  drawHero(ctx, { x: S.at.x, y: S.at.y + bob, ang: local && Math.hypot(local.x - S.at.x, local.y - S.at.y) < 260 ? Math.atan2(local.y - S.at.y, local.x - S.at.x) : (o.st === 'smith' ? 0.2 : Math.PI / 2), cls: S.cls, app: S.app, time: t, anim: null, scale: 1.1, moving: false, noWeapon: o.st !== 'smith' });
  if (hammer > 0.92) { ctx.save(); for (let i = 0; i < 3; i++) circle(ctx, -268 + S.at.x + 332 + Math.cos(i * 2 + t) * 10, S.at.y - 22 + Math.sin(i * 2.4) * 6, 1.8, '#ffcf4a', 0); ctx.restore(); }
  // the bubble
  const by = S.at.y - 58 + Math.sin(t * 3 + o.x) * 3;
  const mk = markFn(o.st);
  ctx.save(); ctx.translate(S.at.x + 22, by); if (mk) ctx.scale(1.15 + Math.sin(t * 6) * 0.06, 1.15 + Math.sin(t * 6) * 0.06);
  circle(ctx, 0, 0, 14, mk === 'ready' ? '#7dff9a' : mk ? '#ffd23f' : near ? '#ffd23f' : '#fff', 3.2);
  ctx.font = "17px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
  ctx.fillText(mk === 'ready' ? '★' : mk ? '!' : o.st === 'smith' ? '⚒' : o.st === 'elder' ? '✦' : '$', 0, 1); ctx.restore();
}
/** Part B: the Ascension Altar - a stepped grey-stone plinth with a starlit basin (classic art) + drifting motes */
function altar(ctx, o, t, local) {
  const hot = local && nearStation(local.x, local.y) === STATION.altar, x = o.x, y = o.y;
  shadow(ctx, x + 4, y + 24, o.w * 0.62, 12, 0.28);
  rrect(ctx, x - 48, y - 4, 96, 30, 6); ctx.fillStyle = '#8a8496'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  rrect(ctx, x - 36, y - 22, 72, 24, 5); ctx.fillStyle = '#a7a1b4'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x, y - 24, 30, 9, 0, 0, TAU); ctx.fillStyle = '#2b2140'; ctx.fill(); ctx.stroke();
  const k = 0.55 + 0.25 * Math.sin(t * 2.2) + (hot ? 0.2 : 0);
  ctx.save(); ctx.globalAlpha = k; ctx.beginPath(); ctx.ellipse(x, y - 24, 24, 6, 0, 0, TAU); ctx.fillStyle = '#c9b6ff'; ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) { const u = ((t * 0.35 + i / 7) % 1), a = i * 2.4 + t * 0.6; ctx.globalAlpha = (1 - u) * 0.8; circle(ctx, x + Math.cos(a) * 18 * (1 - u), y - 26 - u * 70, 2.4 + (1 - u) * 1.6, i % 2 ? '#ffe9a8' : '#c9b6ff', 0); }
  ctx.restore();
  for (const sx of [-30, 30]) { ctx.fillStyle = '#d9d2ea'; ctx.beginPath(); ctx.moveTo(x + sx, y - 30); ctx.lineTo(x + sx + 4, y - 22); ctx.lineTo(x + sx, y - 14); ctx.lineTo(x + sx - 4, y - 22); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
}
/** townfx's prop switch defers the new kinds here */
export function drawVillageProp(ctx, o, t, local) {
  switch (o.kind) {
    case 'hearth': return hearth(ctx, o, t);
    case 'anvil': return anvil(ctx, o, t);
    case 'crates': return crates(ctx, o);
    case 'chest': return chest(ctx, o, t, local);
    case 'npc': return npc(ctx, o, t, local);
    case 'altar': return altar(ctx, o, t, local);
  }
}
const plate = (ctx, x, y, name, title, hot) => {
  ctx.save(); ctx.font = "16px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = Math.max(ctx.measureText(name).width, ctx.measureText(title).width * 0.8) + 18;
  rrect(ctx, x - w / 2, y - 16, w, 32, 9); ctx.fillStyle = hot ? 'rgba(255,210,63,.95)' : 'rgba(43,36,51,.82)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = hot ? INK : '#fff'; ctx.fillText(name, x, y - 5);
  ctx.font = "11px 'Lilita One', sans-serif"; ctx.fillStyle = hot ? '#5a3a10' : '#ffd23f'; ctx.fillText(title, x, y + 9); ctx.restore();
};
/** over everything: name plates for close stations and the dashed interact ring of the one you can use */
export function drawVillageOver(ctx, t, local) {
  if (!local) return;
  const hot = nearStation(local.x, local.y);
  for (const S of STATIONS) {
    const d = Math.hypot(local.x - S.at.x, local.y - S.at.y);
    if (d > 330) continue;
    const top = S.id === 'stash' ? 46 : S.id === 'dummy' ? 74 : S.id === 'lobby' ? 72 : S.id === 'weekly' ? 112 : S.id === 'altar' ? 70 : 92;
    if ((S.id !== 'lobby' && S.id !== 'weekly') || d < 200) plate(ctx, S.at.x, S.at.y - top, S.name, S.title, hot === S);
    if (hot === S && S.id !== 'dummy') { ctx.beginPath(); ctx.arc(S.use.x, S.use.y + 4, 38 + Math.sin(t * 4) * 3, 0, TAU); ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 30; ctx.strokeStyle = 'rgba(255,210,63,.95)'; ctx.lineWidth = 4; ctx.stroke(); ctx.setLineDash([]); }
  }
}
/** minimap pins (X / Y map world -> minimap) */
export function drawVillagePins(g, X, Y) {
  const ico = { smith: ['⚒', '#ff8a3a'], qm: ['$', '#ffd23f'], elder: ['✦', '#c8b8ff'], stash: ['▣', '#c08a4f'], dummy: ['◎', '#ff5e5b'], lobby: ['★', '#7ee0ff'], weekly: ['W', '#ffd23f'], altar: ['✦', '#c9b6ff'] };
  g.save(); g.font = "bold 10px 'Lilita One', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const S of STATIONS) { const mk = markFn(S.id); const [c, col] = mk ? [mk === 'ready' ? '★' : '!', mk === 'ready' ? '#7dff9a' : '#ffd23f'] : ico[S.id]; circle(g, X(S.at.x), Y(S.at.y), 6.5, col, 1.5); g.fillStyle = INK; g.fillText(c, X(S.at.x), Y(S.at.y) + 0.5); }
  g.restore();
}
