// World maps for the bigger organic Wilds / Dunes (art & world pass): one prebuilt full-map canvas per biome (coast,
// danger bands, roads, ridge walls, woods, landmarks, boss arenas), a local minimap window that follows the player
// (bosses, elite packs, Tomb portals, loot, enemies, teammates, pings; off-window bosses pin to the rim as arrows) and a
// full-map render for previews / a big map view.
import { swarmState, swarmIcon } from './sitesfx.js';
import { uiOn, uiIcon } from './uipaint.js';
import { INK, circle } from './art.js';
import { WILDS_SHAPE, WILDS_RINGS, WILDS_ROADS, WILDS_RIVER, WILDS_BRIDGES, DUNES_SHAPE, DUNES_RINGS, DUNES_ROADS, wildsSite, dunesSite } from '../sim/mapshape.js';
import { ZONE_GROUND, shapePath, roadPath } from './wildsfx.js';
import { dunesState } from './dunesfx.js';
import { FROST_SHAPE, FROST_RINGS, FROST_ROADS, FROST_CAMP, frostSite } from '../sim/frostconst.js';
import { SNOW_BANDS } from './frostfx.js';
import { drawGateMarker } from './opsicons.js';
import { EMBER_SHAPE, EMBER_RINGS, EMBER_ROADS, EMBER_CAMP, EMBER_LAVA, emberSite } from '../sim/emberconst.js';
import { ASH_BANDS } from './emberfx.js';
import { RIFT_SHAPE, RIFT_RINGS, RIFT_ROADS, RIFT_CAMP, RIFT_TEARS, riftSite } from '../sim/riftconst.js';
import { RIFT_BANDS, RIFT_SEA } from './riftfx.js';
import { newCanvas } from './sprite.js';

const TAU = Math.PI * 2;
const SAND = ['#f8eabd', '#f2dba0', '#e8c787', '#dcae6b', '#c99158'];
export const BIOME = {
  wilds: { S: WILDS_SHAPE, rings: WILDS_RINGS, roads: WILDS_ROADS, cols: ZONE_GROUND, sites: wildsSite, bosses: ['grimtusk', 'thornmaw', 'ashfang'], types: { grimtusk: 'boss', thornmaw: 'thornmaw', ashfang: 'ashfang' }, land: ['lake', 'stones', 'tower', 'elderoak'], wall: 'cliff' },
  dunes: { S: DUNES_SHAPE, rings: DUNES_RINGS, roads: DUNES_ROADS, cols: SAND, sites: dunesSite, bosses: ['khepra', 'ankhara', 'sekhem'], types: { khepra: 'khepra', ankhara: 'ankhara', sekhem: 'sekhem' }, land: ['sphinx', 'crater', 'colossus'], wall: 'mesa' },
  frost: { S: FROST_SHAPE, rings: FROST_RINGS, roads: FROST_ROADS, cols: SNOW_BANDS, sites: frostSite, bosses: ['skaldra', 'vyrnhal', 'morwen'], types: { skaldra: 'skaldra', vyrnhal: 'vyrnhal', morwen: 'morwen' }, land: ['falls', 'ribs', 'shrine', 'spire'], wall: 'icecliff', camp: FROST_CAMP },
  ember: { S: EMBER_SHAPE, rings: EMBER_RINGS, roads: EMBER_ROADS, cols: ASH_BANDS, sites: emberSite, bosses: ['pyrrhex', 'solgrim', 'vitrea'], types: { pyrrhex: 'pyrrhex', solgrim: 'solgrim', vitrea: 'vitrea' }, land: ['falls', 'skull', 'shrine', 'obelisk'], wall: 'basaltcliff', camp: EMBER_CAMP },
  rift: { S: RIFT_SHAPE, rings: RIFT_RINGS, roads: RIFT_ROADS, cols: RIFT_BANDS, sites: riftSite, bosses: ['zerath', 'orrery', 'nyxara'], types: { zerath: 'zerath', orrery: 'orrery', nyxara: 'nyxara' }, land: ['star', 'colossus', 'shrine', 'monolith'], wall: 'voidcliff', camp: RIFT_CAMP }, // (game loop C3)
};
/** which world an obstacle / spawner belongs to */
const ofBiome = (o, biome) => biome === 'rift' ? !!o.rift : biome === 'ember' ? !!o.ember : biome === 'frost' ? !!o.frost : biome === 'dunes' ? !!o.dunes : !(o.dunes || o.tomb || o.frost || o.crypt || o.ember || o.forge || o.rift);
const isWall = (o, biome) => o.wall || (biome === 'ember' && o.kind === 'basaltcliff') || (biome === 'rift' && o.kind === 'voidcliff');
const LAND_COL = { wilds: '#f2dc9b', dunes: '#d6b77b', frost: '#bcd6e8', ember: '#4a3632', rift: '#3a3068' }, WALL_COL = { wilds: ['#6d6670', '#9a939a'], dunes: ['#8a4f30', '#c27a4c'], frost: ['#5f7fa8', '#a9c6e6'], ember: ['#2a2024', '#4e4246'], rift: ['#1e1838', '#4a3e7e'] }, ROAD_COL = { wilds: '#dcc290', dunes: '#f3dcaa', frost: '#e4d8c4', ember: '#b8a48a', rift: '#a69cd0' };
const MAPS = {}; export const SEA_COL = { ember: '#3a1810', rift: RIFT_SEA };
const PX = 1024;

/** The prebuilt full-map canvas for a biome (world units -> PX pixels over the shape's bounding square). */
export function biomeMap(biome, world) {
  const B = BIOME[biome], key = biome + ':' + (world && world.obstacles ? world.obstacles.length : 0);
  if (MAPS[biome] && MAPS[biome].key === key) return MAPS[biome];
  const S = B.S, half = S.max + 260, k = PX / (half * 2);
  const c = document.createElement('canvas'); c.width = c.height = PX;
  const g = c.getContext('2d');
  g.fillStyle = SEA_COL[biome] || '#3fa9e0'; g.fillRect(0, 0, PX, PX);
  g.setTransform(k, 0, 0, k, PX / 2 - S.cx * k, PX / 2 - S.cy * k);
  g.fillStyle = biome === 'rift' ? 'rgba(180,140,255,.4)' : biome === 'ember' ? 'rgba(255,120,40,.45)' : 'rgba(160,230,255,.5)'; g.fill(shapePath(S, B.rings[B.rings.length - 1], 140), 'evenodd');
  g.fillStyle = LAND_COL[biome]; g.fill(shapePath(S, B.rings[B.rings.length - 1], S.shore || 60), 'evenodd'); // (map fix: the beach band on the map = the walkable beach)
  g.save(); g.clip(shapePath(S, B.rings[B.rings.length - 1], 0), 'evenodd');
  g.fillStyle = B.cols[B.rings.length - 1]; g.fillRect(S.cx - half, S.cy - half, half * 2, half * 2);
  for (let i = B.rings.length - 2; i >= 1; i--) { g.fillStyle = B.cols[i]; g.fill(shapePath(S, B.rings[i], 0), 'evenodd'); }
  g.restore();
  { const C = B.camp || { x: S.cx, y: S.cy }; g.fillStyle = B.cols[0]; g.beginPath(); g.arc(C.x, C.y, B.rings[0], 0, TAU); g.fill(); }
  if (biome === 'dunes') { g.fillStyle = '#79bf55'; g.beginPath(); g.arc(S.cx, S.cy, 270, 0, TAU); g.fill(); g.fillStyle = '#2aa0d0'; g.beginPath(); g.ellipse(S.cx, S.cy, 150, 105, 0, 0, TAU); g.fill(); }
  // woods / rocks (soft dots), then the walls (dark ridge chains)
  if (world) for (const o of world.obstacles) {
    if (!ofBiome(o, biome)) continue;
    if (!S.inside(o.x, o.y, 400)) continue;
    if (isWall(o, biome) || o.kind === 'river') continue;
    g.fillStyle = o.kind === 'pine' ? 'rgba(30,80,70,.4)' : o.kind === 'tree' || o.kind === 'palm' ? 'rgba(30,90,30,.38)' : o.kind === 'cactus' ? 'rgba(40,110,50,.4)' : 'rgba(80,70,80,.42)';
    g.beginPath(); g.arc(o.x, o.y, Math.max(26, o.size * 0.9), 0, TAU); g.fill();
  }
  // the river (Wilds) then the roads + bridges
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (biome === 'wilds') { const rp = roadPath(WILDS_RIVER); g.save(); g.clip(shapePath(S, B.rings[B.rings.length - 1], 40), 'evenodd'); g.strokeStyle = '#7a6a48'; g.lineWidth = 200; g.stroke(rp); g.strokeStyle = '#2f8ed0'; g.lineWidth = 150; g.stroke(rp); g.restore(); }
  if (biome === 'ember') for (const pts of EMBER_LAVA) { const rp = roadPath(pts); g.strokeStyle = '#6a1a10'; g.lineWidth = 200; g.stroke(rp); g.strokeStyle = '#ff6a1a'; g.lineWidth = 140; g.stroke(rp); g.strokeStyle = '#ffd36a'; g.lineWidth = 40; g.stroke(rp); }
  if (biome === 'rift') for (const pts of RIFT_TEARS) { const rp = roadPath(pts); g.strokeStyle = '#b48cff'; g.lineWidth = 180; g.stroke(rp); g.strokeStyle = '#08061a'; g.lineWidth = 120; g.stroke(rp); }
  for (const pts of B.roads) { const p = roadPath(pts); g.strokeStyle = 'rgba(90,60,30,.35)'; g.lineWidth = 120; g.stroke(p); g.strokeStyle = ROAD_COL[biome]; g.lineWidth = 70; g.stroke(p); }
  if (biome === 'wilds') for (const q of WILDS_BRIDGES) { g.save(); g.translate(q.x, q.y); g.rotate(q.ang); g.fillStyle = '#5a3d24'; g.fillRect(-140, -60, 280, 120); g.fillStyle = '#b08050'; g.fillRect(-130, -45, 260, 90); g.restore(); }
  if (world) for (const o of world.obstacles) {
    if (!isWall(o, biome) || !ofBiome(o, biome)) continue;
    g.fillStyle = WALL_COL[biome][0]; g.beginPath(); g.arc(o.x, o.y, o.size * 1.05, 0, TAU); g.fill();
  }
  if (world) for (const o of world.obstacles) {
    if (!isWall(o, biome) || !ofBiome(o, biome)) continue;
    g.fillStyle = WALL_COL[biome][1]; g.beginPath(); g.arc(o.x - o.size * 0.2, o.y - o.size * 0.25, o.size * 0.72, 0, TAU); g.fill();
  }
  // danger ring lines
  g.setLineDash([140, 110]); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 26;
  g.save(); g.clip(shapePath(S, B.rings[B.rings.length - 1], 0), 'evenodd');
  for (let i = 1; i < B.rings.length - 1; i++) g.stroke(shapePath(S, B.rings[i], 0));
  g.restore();
  g.setLineDash([]);
  g.lineWidth = 30; g.strokeStyle = 'rgba(40,30,50,.45)'; g.stroke(shapePath(S, B.rings[B.rings.length - 1], 20));
  // boss arenas + landmarks
  for (const b of B.bosses) { const s = B.sites(b); g.fillStyle = biome === 'wilds' ? 'rgba(80,60,100,.75)' : biome === 'frost' ? 'rgba(60,90,150,.75)' : biome === 'ember' ? 'rgba(120,40,20,.8)' : biome === 'rift' ? 'rgba(70,40,140,.8)' : 'rgba(150,90,50,.75)'; g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill(); g.lineWidth = 34; g.strokeStyle = 'rgba(255,80,60,.8)'; g.stroke(); }
  for (const l of B.land) { const s = B.sites(l); if (l === 'lake') { g.fillStyle = '#3fa9e0'; g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill(); } else { g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(s.x, s.y, 70, 0, TAU); g.fill(); g.lineWidth = 20; g.strokeStyle = INK; g.stroke(); } }
  if (biome === 'rift') { g.fillStyle = '#c8c4e8'; g.beginPath(); g.arc(RIFT_CAMP.x, RIFT_CAMP.y, 170, 0, TAU); g.fill(); g.lineWidth = 24; g.strokeStyle = INK; g.stroke(); }
  if (biome === 'ember') { g.fillStyle = '#d8c0a0'; g.beginPath(); g.arc(EMBER_CAMP.x, EMBER_CAMP.y, 170, 0, TAU); g.fill(); g.lineWidth = 24; g.strokeStyle = INK; g.stroke(); }
  if (biome === 'frost') { g.fillStyle = '#f4efe4'; g.beginPath(); g.arc(FROST_CAMP.x, FROST_CAMP.y, 170, 0, TAU); g.fill(); g.lineWidth = 24; g.strokeStyle = INK; g.stroke(); }
  if (biome === 'wilds') { g.fillStyle = '#e6dcc3'; g.beginPath(); g.arc(0, 0, 170, 0, TAU); g.fill(); g.lineWidth = 24; g.strokeStyle = INK; g.stroke(); }
  const elites = world ? world.spawners.filter((s) => s.elitePack && ofBiome(s, biome)) : [];
  MAPS[biome] = { c, k, half, S, B, key, elites };
  return MAPS[biome];
}
export const biomeAt = (x, y) => (RIFT_SHAPE.inside(x, y, 400) ? 'rift' : EMBER_SHAPE.inside(x, y, 400) ? 'ember' : FROST_SHAPE.inside(x, y, 400) ? 'frost' : DUNES_SHAPE.inside(x, y, 400) ? 'dunes' : WILDS_SHAPE.inside(x, y, 500) ? 'wilds' : null);

export function skull(ctx, x, y, col, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.arc(0, -1, 6, 0, TAU); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = col; ctx.fillRect(-3.5, 3, 7, 4); ctx.strokeRect(-3.5, 3, 7, 4);
  circle(ctx, -2.2, -1.5, 1.6, INK, 0); circle(ctx, 2.2, -1.5, 1.6, INK, 0);
  ctx.restore();
}
export function crown(ctx, x, y, col, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-5, 3); ctx.lineTo(-6, -4); ctx.lineTo(-2.5, -1); ctx.lineTo(0, -5); ctx.lineTo(2.5, -1); ctx.lineTo(6, -4); ctx.lineTo(5, 3); ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
}
const MINI = {};
export const bossAlive = (sim, type) => sim.enemies.some((e) => e.type === type && !e.dead);

/** The HUD minimap for the Wilds / the Dunes: a ~W-unit window around the player. */
export function drawWorldMinimap(ctx, x, y, R, sim, p, CLASSES, pings, biome, W = 2600) {
  const M = biomeMap(biome, sim.world), k = R / W, X = (wx) => x + (wx - p.x) * k, Y = (wy) => y + (wy - p.y) * k;
  circle(ctx, x, y, R + 5, INK, 0);
  // perf: the clipped map window is baked into a small cached canvas (re-baked when the player moved ~1 map px),
  // so the per-frame cost is one axis-aligned blit instead of a clip mask + resampled drawImage
  const ts = ctx.getTransform ? Math.abs(ctx.getTransform().a) || 1 : 1, px = Math.max(16, Math.ceil(R * 2 * ts));
  let MC = MINI[biome];
  if (!MC || MC.px !== px || MC.W !== W || Math.abs(MC.x - p.x) > W / R || Math.abs(MC.y - p.y) > W / R) {
    const c = (MC && MC.px === px) ? MC.c : newCanvas(px, px), g = c.getContext('2d'), q = px / (R * 2);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, px, px); g.setTransform(q, 0, 0, q, 0, 0);
    g.save(); g.beginPath(); g.arc(R, R, R, 0, TAU); g.clip();
    g.fillStyle = SEA_COL[biome] || '#3fa9e0'; g.fillRect(0, 0, R * 2, R * 2);
    const mk = M.k, sx = PX / 2 + (p.x - W - M.S.cx) * mk, sy = PX / 2 + (p.y - W - M.S.cy) * mk;
    g.imageSmoothingEnabled = true; g.drawImage(M.c, sx, sy, W * 2 * mk, W * 2 * mk, 0, 0, R * 2, R * 2);
    for (const s of M.elites) if (Math.abs(s.x - p.x) < W && Math.abs(s.y - p.y) < W) crown(g, R + (s.x - p.x) * k, R + (s.y - p.y) * k, '#ffcf3a', 0.9);
    g.restore();
    MC = MINI[biome] = { c, px, W, x: p.x, y: p.y };
  }
  { const ox = (MC.x - p.x) * k, oy = (MC.y - p.y) * k; ctx.drawImage(MC.c, x - R + ox, y - R + oy, R * 2, R * 2); }
  ctx.save(); ctx.beginPath(); ctx.rect(x - R * 0.72, y - R * 0.72, R * 1.44, R * 1.44); ctx.clip(); // markers: cheap rect clip
  for (const b of sim.bags) if (b.ownerId === p.id) { ctx.fillStyle = ['#e8d2b0', '#4aa8ff', '#b86bff', '#ffb52e', '#2ee6c4', '#ff4f7b'][b.rarity] || '#fff'; ctx.fillRect(X(b.x) - 2, Y(b.y) - 2, 4, 4); }
  for (const e of sim.enemies) { if (e.boss || e.dead || Math.abs(e.x - p.x) > 900 || Math.abs(e.y - p.y) > 900) continue; ctx.fillStyle = e.elite ? '#ffcf3a' : '#ff4d4d'; ctx.fillRect(X(e.x) - 1.5, Y(e.y) - 1.5, 3, 3); }
  if (sim.world && sim.world.opsGates && !sim.noPortals) for (const g of sim.world.opsGates) if (g.biome === biome && Math.abs(g.x - p.x) < W && Math.abs(g.y - p.y) < W) drawGateMarker(ctx, g, X(g.x), Y(g.y), 0.62); // the fixed mission entrances (+ the boss dungeons)
  if (sim.players) for (const q of sim.players.values()) { if (q.id === p.id || q.dead) continue; circle(ctx, X(q.x), Y(q.y), 3.5, CLASSES[q.cls] ? CLASSES[q.cls].color : '#fff', 1.5); }
  if (pings) for (const pg of pings) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin((pg.t || 0) * 10); circle(ctx, X(pg.x), Y(pg.y), 5, '#ffd23f', 2); ctx.globalAlpha = 1; }
  ctx.restore();
  { const SW = swarmState(sim); if (SW && SW.st !== 'idle') { const sx0 = SW.ch ? SW.ch[0] : SW.x, sy0 = SW.ch ? SW.ch[1] : SW.y; let sx = X(sx0), sy = Y(sy0); const ddx = sx - x, ddy = sy - y, dd = Math.hypot(ddx, ddy); if (dd > R - 8) { sx = x + (ddx / dd) * (R - 6); sy = y + (ddy / dd) * (R - 6); } swarmIcon(ctx, sx, sy, dd > R - 8 ? 0.95 : 1.15, performance.now() / 1000); } } // Swarm event (client/sitesfx.js)
  // world bosses: a skull on the map, or pinned to the rim pointing the way when out of the window
  for (const b of M.B.bosses) {
    const s = M.B.sites(b), alive = bossAlive(sim, M.B.types[b]);
    let bx = X(s.x), by = Y(s.y); const dx = bx - x, dy = by - y, d = Math.hypot(dx, dy);
    if (d > R - 6) { bx = x + (dx / d) * (R - 4); by = y + (dy / d) * (R - 4); }
    if (!(uiOn() && uiIcon(ctx, 'g_boss', bx, by, d > R - 6 ? 15 : 18, 4, alive ? 1 : 0.45))) skull(ctx, bx, by, alive ? '#ff5e5b' : 'rgba(255,255,255,.55)', d > R - 6 ? 0.8 : 1); // (painted: the G1 boss marker)
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(p.aim || 0); ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-3, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  circle(ctx, x, y, R + 3, null, 5, INK); circle(ctx, x, y, R, null, 2, 'rgba(255,255,255,.35)');
}

/** A full-map image (previews / a map screen): the biome canvas + boss skulls, elite crowns, landmarks, optional player. */
export function renderFullMap(ctx, size, biome, world, sim, p) {
  const M = biomeMap(biome, world), s = size / PX;
  ctx.drawImage(M.c, 0, 0, size, size);
  const X = (wx) => (PX / 2 + (wx - M.S.cx) * M.k) * s, Y = (wy) => (PX / 2 + (wy - M.S.cy) * M.k) * s;
  for (const e of M.elites) crown(ctx, X(e.x), Y(e.y), '#ffcf3a', 1.8);
  for (const b of M.B.bosses) { const st = M.B.sites(b); skull(ctx, X(st.x), Y(st.y), sim ? (bossAlive(sim, M.B.types[b]) ? '#ff5e5b' : '#ddd') : '#ff5e5b', 2.2); }
  if (sim) { const SW = swarmState(sim); if (SW) swarmIcon(ctx, X(SW.x), Y(SW.y), 2.2, 0); } // Swarm event
  if (world && world.opsGates) for (const g of world.opsGates) if (g.biome === biome) drawGateMarker(ctx, g, X(g.x), Y(g.y), Math.max(0.9, size / 420)); // mission entrances
  if (p) circle(ctx, X(p.x), Y(p.y), 6, '#fff', 2);
  return M;
}
