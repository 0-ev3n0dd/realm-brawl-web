// Map markers (2026-10-09 map-click fix): one list of the icons a map draws, in world units, with names and a hit
// radius, shared by the full-screen big map (client/bigmap.js) and the hub's World Map › This Region (client/menuhub.js),
// so every icon you can see can be hovered (tooltip) and clicked (info card). Hit areas are generous on purpose: at least
// MIN_HIT CSS px (MIN_HIT_TOUCH on phones) around the icon, nearest icon wins.
import { ENEMIES } from '../sim/data/enemies.js';
import { CLASSES } from '../sim/data/classes.js';
import { biomeMap, bossAlive } from './worldmap.js';
import { OPS_TYPE, BOSS_GATES } from '../sim/opsconst.js';
import { swarmState } from './sitesfx.js';
import { fissureMarkers } from './fissurefx.js';
import { STATIONS } from '../sim/village.js';
import { GATES } from '../sim/dunesconst.js';
import { TOWN_POS, COUNTER, CLERK } from '../sim/townconst.js';
import { INK, rrect } from './art.js';

export const MIN_HIT = 18, MIN_HIT_TOUCH = 26;
const SITE_TXT = { alive: 'Spawn site · enemies keep coming', active: 'Spawn site · fighting now', cleared: 'Spawn site · cleared', unknown: 'Spawn site' };

/** Every clickable icon of an open-world biome map (world units). sites: bigmap siteMarkers() output (optional). */
export function worldMarkers(sim, biome, p, sites = []) {
  const out = [];
  let M; try { M = biomeMap(biome, sim.world); } catch { return out; }
  const C = M.B.camp || (biome === 'wilds' ? { x: 0, y: 0 } : null);
  if (C) out.push({ kind: 'camp', x: C.x, y: C.y, name: biome === 'wilds' ? 'Campfire' : 'Camp', sub: 'Safe camp · the world\'s start point', col: '#ffe6a0', hr: 12, z: 1 });
  for (const s of sites) out.push({ kind: 'site', x: s.x, y: s.y, name: 'Spawn site', sub: SITE_TXT[s.st] || SITE_TXT.unknown, col: '#ff7a3c', hr: 8, z: 0 });
  for (const e of M.elites) out.push({ kind: 'elite', x: e.x, y: e.y, name: 'Elite pack', sub: 'Tougher pack · rare materials', col: '#ffcf3a', hr: 10, z: 2 });
  if (sim.world && sim.world.opsGates && !sim.noPortals) for (const g of sim.world.opsGates) {
    if (g.biome !== biome) continue;
    if (g.type === 'boss') { const B = BOSS_GATES[g.dungeon] || {}; out.push({ kind: 'gate', x: g.x, y: g.y, name: B.name || 'Boss dungeon', sub: 'Boss dungeon entrance · walk up and press Interact', col: B.col || '#fff', hr: 15, z: 4 }); }
    else { const T = OPS_TYPE[g.type] || {}; out.push({ kind: 'gate', x: g.x, y: g.y, name: `${T.name || 'Mission'} mission`, sub: `${T.mode || ''} · walk up and press Interact`, col: T.col || '#fff', hr: 15, z: 4 }); }
  }
  for (const b of M.B.bosses) {
    const st = M.B.sites(b), type = M.B.types[b], alive = sim.enemies ? bossAlive(sim, type) : true, E = ENEMIES[type] || {};
    out.push({ kind: 'boss', x: st.x, y: st.y, name: E.name || b, sub: alive ? 'World boss · up' : 'World boss · down (respawns later)', col: alive ? '#ff5e5b' : '#bbb', hr: 16, z: 5 });
  }
  const SW = swarmState(sim);
  if (SW && SW.st !== 'idle') out.push({ kind: 'swarm', x: SW.ch ? SW.ch[0] : SW.x, y: SW.ch ? SW.ch[1] : SW.y, name: 'Swarm event', sub: 'A horde is gathering · clear it for loot', col: '#ffb0a0', hr: 16, z: 6 });
  out.push(...fissureMarkers(sim)); // (Part A4)
  partyMarkers(out, sim, p);
  return out;
}
/** Brightwater Village: the services, the Mission Counter and the Realm Gates (classic layout). */
export function townMarkers(sim, p) {
  const out = [{ kind: 'npc', x: COUNTER.x, y: CLERK.y - 40, name: 'Mission Counter', sub: `${CLERK.name}, ${CLERK.title} · missions, trials and dungeons`, col: '#ffd23f', hr: 16, z: 4 }];
  for (const s of STATIONS) out.push({ kind: 'npc', x: s.at.x, y: s.at.y, name: s.name, sub: s.title, col: '#ffe6a0', hr: 13, z: 3 });
  for (const G of GATES) out.push({ kind: 'gate', x: TOWN_POS.x + G.dx, y: TOWN_POS.y + G.dy, name: `${G.name} gate`, sub: G.sub, col: G.col, hr: 12, z: 2 });
  partyMarkers(out, sim, p);
  return out;
}
function partyMarkers(out, sim, p) {
  if (sim.players) for (const q of sim.players.values()) { if (!p || q.id === p.id || q.dead) continue; const C = CLASSES[q.cls]; out.push({ kind: 'party', x: q.x, y: q.y, name: String(q.name || 'Ally'), sub: `Party · Lv ${q.level | 0} ${C ? C.name : ''}`, col: C ? C.color : '#fff', hr: 10, z: 7 }); }
  if (p) out.push({ kind: 'you', x: p.x, y: p.y, name: 'You', sub: String(p.name || ''), col: '#fff', hr: 11, z: 0 });
}
/**
 * The marker under (mx, my) (screen / CSS px). toS(wx, wy) -> {x, y}; s: the icon scale on this map; minR: the
 * smallest hit radius. The nearest centre (relative to its radius) wins; ties go to the higher z.
 */
export function pickMarker(marks, mx, my, toS, s = 1, minR = MIN_HIT) {
  let best = null, bs = 1e9;
  for (const m of marks) {
    const q = toS(m.x, m.y), r = Math.max(minR, m.hr * s), k = Math.hypot(mx - q.x, my - q.y) / r;
    if (k >= 1) continue;
    const sc = k - 0.12 * (m.z || 0); // (crowded spots: a mission entrance / boss beats the spawn-site diamond next to it)
    if (sc < bs) { bs = sc; best = { ...m, sx: q.x, sy: q.y }; }
  }
  return best;
}
/** a hover / click card drawn on a canvas, kept inside [bx, by, bw, bh] */
export function drawMarkerTip(ctx, m, bx, by, bw, bh, pinned) {
  if (!m) return;
  ctx.save();
  ctx.font = 'bold 15px "Lilita One", "Trebuchet MS", sans-serif'; const w1 = ctx.measureText(m.name).width;
  ctx.font = '12px "Trebuchet MS", sans-serif'; const w2 = ctx.measureText(m.sub || '').width;
  const w = Math.min(bw - 8, Math.max(w1, w2) + 22), h = m.sub ? 46 : 28;
  let x = m.sx + 16, y = m.sy - h - 10; if (x + w > bx + bw - 4) x = m.sx - w - 16; if (x < bx + 4) x = bx + 4; if (y < by + 4) y = m.sy + 16; if (y + h > by + bh - 4) y = by + bh - h - 4;
  ctx.beginPath(); ctx.arc(m.sx, m.sy, Math.max(12, m.hr + 4), 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = pinned ? '#ffd23f' : 'rgba(255,255,255,.85)'; ctx.stroke();
  rrect(ctx, x, y, w, h, 8); ctx.fillStyle = 'rgba(18,12,28,.92)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = m.col || '#fff'; ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 15px "Lilita One", "Trebuchet MS", sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeText(m.name, x + 11, y + 15); ctx.fillStyle = m.col || '#fff'; ctx.fillText(m.name, x + 11, y + 15);
  if (m.sub) { ctx.font = '12px "Trebuchet MS", sans-serif'; ctx.fillStyle = '#e9e2ff'; ctx.fillText(m.sub, x + 11, y + 33, w - 18); }
  ctx.restore();
}
