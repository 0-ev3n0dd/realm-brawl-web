// The Realm Gate world map (piece 4): an overview of every world reachable from Brightwater Village, painted in the
// classic ink-outline style on a canvas: the Wilds, Sunscorch Dunes, Frostveil Peaks and Emberdeep Caldera as islands
// round the village, the Star Sanctum floating above, each with its free hunt, dungeon, trials / extremes and raid as
// nodes. Every node shows its lock state (padlock + what opens it), clear marks (✔ + clears + best rank) and the
// exclusive loot it gives; picking an open node and pressing Travel sends { type:'mission', id, map:1 } (host only,
// anywhere in town: sim/hub.js). Opens from the Mission Counter board, the Realm Gate plaza prompt, or its key (G).
// Shared by the solo, co-op and phone clients (the phone gets it from the board); pure data helpers are exported for tests.
import { MISSION, GATE_ATTUNE, gateFound } from '../sim/hub.js';
import { KEYS, needsKey, keysOf, forgeKey, useKey, canPay, MATERIALS, matGrade, MAT_WHERE, ATTUNE, attuneGate } from '../sim/meta.js';
import { profile } from './rewards.js';
import { SETS } from '../sim/sets.js';
import { EXOTIC } from '../sim/exotic.js';
import { RARITIES } from '../sim/data/items.js';
import { INK } from './art.js';
import { clientTownBlock, townLabel, startTownTravel, inMission } from './towntravel.js';

import { CACHE_MAPS } from '../sim/herocraft.js';
import { heroOf } from '../sim/heroes.js';
const TAU = Math.PI * 2;
export const MAP_W = 960, MAP_H = 560;
/** kind: world (free hunt) · dungeon · trial · extreme · raid */
export const REALMS = [
  { id: 'wilds', name: 'The Wilds', col: '#7ee06a', dark: '#3f9a45', x: 190, y: 360, rx: 150, ry: 105, seed: 1,
    nodes: [{ m: 'field', kind: 'world', dx: -70, dy: -20 }, { m: 'hollow', kind: 'dungeon', dx: -10, dy: 34 }, { m: 'vharokt', kind: 'trial', dx: 50, dy: -30 }, { m: 'vharokx', kind: 'extreme', dx: 96, dy: 18 }] },
  { id: 'dunes', name: 'Sunscorch Dunes', col: '#ffd27a', dark: '#d89a45', x: 300, y: 150, rx: 140, ry: 88, seed: 2,
    nodes: [{ m: 'dunes', kind: 'world', dx: -62, dy: 4 }, { m: 'tomb', kind: 'dungeon', dx: 8, dy: 34 }, { m: 'neferakht', kind: 'trial', dx: 30, dy: -34 }, { m: 'neferakhx', kind: 'extreme', dx: 92, dy: 30 }, { m: 'neferakhs', kind: 'savage', dx: 62, dy: -2 }] }, // (Part 0S: in Astral mode the Savage replaces the Trial + Extreme nodes)
  { id: 'frost', name: 'Frostveil Peaks', col: '#d8f3ff', dark: '#7fb8d8', x: 660, y: 150, rx: 160, ry: 92, seed: 3,
    nodes: [{ m: 'frost', kind: 'world', dx: -78, dy: 4 }, { m: 'crypt', kind: 'dungeon', dx: -8, dy: 34 }, { m: 'skaldrat', kind: 'trial', dx: 58, dy: -18 }, { m: 'skaldrax', kind: 'extreme', dx: 108, dy: 22 }] },
  { id: 'ember', name: 'Emberdeep Caldera', col: '#ff9a5a', dark: '#a8402a', x: 770, y: 370, rx: 160, ry: 100, seed: 4,
    nodes: [{ m: 'ember', kind: 'world', dx: -80, dy: -10 }, { m: 'forge', kind: 'dungeon', dx: -10, dy: 42 }, { m: 'pyrrhext', kind: 'trial', dx: 56, dy: -26 }, { m: 'pyrrhexx', kind: 'extreme', dx: 104, dy: 18 }] },
  // game loop C3: Map 5 (south of the village), with the Rift Sanctum (Vorthax) as its dungeon
  { id: 'rift', name: 'The Astral Rift', col: '#8a6ad8', dark: '#3e2a7a', x: 480, y: 486, rx: 150, ry: 54, seed: 6,
    nodes: [{ m: 'rift', kind: 'world', dx: -70, dy: -6 }, { m: 'vorthax', kind: 'dungeon', dx: 40, dy: 12 }] },
  { id: 'star', name: 'The Star Sanctum', col: '#3a3a8a', dark: '#1d1d55', x: 480, y: 62, rx: 92, ry: 40, seed: 5, sky: true,
    nodes: [{ m: 'astrael', kind: 'trial', dx: -34, dy: 4 }, { m: 'astraelx', kind: 'extreme', dx: 36, dy: 4 }, { m: 'ultimate', kind: 'ultimate', dx: 0, dy: -24 }] }, // (Part F: the Ultimate above the Sanctum)
];
export const VILLAGE = { x: 480, y: 330, name: 'Brightwater Village' };
/** 2026-10-09: the village is a flag node like every other map (pick it, then Travel = the 2 s Travel to Town channel) */
export const TOWN_NODE = { m: 'town', kind: 'town', realm: 'village', x: VILLAGE.x, y: VILLAGE.y - 10, r: 20 };
const KIND_COL = { town: '#ffd23f', world: '#7ee06a', dungeon: '#ffd23f', trial: RARITIES[6].color, extreme: RARITIES[7].color, savage: '#ff6a3d', raid: '#6ae6ff', ultimate: '#fff1b8' };
export const KIND_LABEL = { town: 'Town', world: 'Free hunt', dungeon: 'Dungeon', trial: 'Trial', extreme: 'Extreme', savage: 'Savage', raid: 'Raid', ultimate: 'Ultimate' };
/** the exclusive loot each node gives (shown in the side panel; all from the piece-4 tables in sim/exotic.js) */
export const NODE_LOOT = {
  town: [],
  field: [['Wildwarden Regalia (Forge, Wilds materials)', SETS.wildwarden.color]],
  hollow: [[`${SETS.mothwing.name} set (Lumivex guarantees one)`, SETS.mothwing.color], ['Glowspores · Lumen Scales', '#c9f27a']],
  vharokt: [['Storm Sigils → Stormbound Trial gear (30% direct drop)', EXOTIC.stormbound.color]],
  vharokx: [['Stormbound Trial gear (guaranteed)', EXOTIC.stormbound.color], ["Vharok's Thunder Heart → Skyfall Extreme gear (25% direct)", RARITIES[7].color]],
  dunes: [['Duneborn Panoply (Forge, Dunes materials)', SETS.duneborn.color]],
  tomb: [[`${SETS.sunscorch.name} set (Neferakh guarantees one)`, SETS.sunscorch.color]],
  neferakht: [['Sunbound Sigils → Sunbound Trial gear (30% direct drop) · 2 attune the Frostveil gate', EXOTIC.sunbound.color]],
  neferakhs: [['Savage coffer (first clear each week): a tier-7 Savage Black Sun piece, a slot you lack first', '#ff6a3d'], ['Savage Marks: 1 a clear, +4 weekly · 16 buy a Savage weapon (Quartermaster)', '#ffb27a'], ['Sunbound Trial gear (guaranteed) · Black Sun (50%) · Astral materials', EXOTIC.blacksun.color]],
  neferakhx: [['Sunbound Trial gear (guaranteed)', EXOTIC.sunbound.color], ["Neferakh's Eclipse Heart → Black Sun Extreme gear (25% direct)", RARITIES[7].color]],
  frost: [[`${SETS.frostveil.name} set (world bosses 20%, elites 3%)`, SETS.frostveil.color]],
  crypt: [[`${SETS.frostveil.name} set (Osric guarantees one)`, SETS.frostveil.color]],
  skaldrat: [['Rimebound Sigils → Rimebound Trial gear (30% direct drop)', EXOTIC.rimebound.color]],
  skaldrax: [['Rimebound Trial gear (guaranteed)', EXOTIC.rimebound.color], ["Skaldra's Frozen Heart → Zero-Point Extreme gear (25% direct)", RARITIES[7].color]],
  ember: [[`${SETS.emberdeep.name} set (world bosses 20%, elites 3%)`, SETS.emberdeep.color]],
  forge: [[`${SETS.emberdeep.name} set (Hephast guarantees one)`, SETS.emberdeep.color]],
  pyrrhext: [['Cinderbound Sigils → Cinderbound Trial gear (30% direct drop)', EXOTIC.cinderbound.color]],
  pyrrhexx: [['Cinderbound Trial gear (guaranteed)', EXOTIC.cinderbound.color], ["Pyrrhex's Molten Core → Worldheart Extreme gear (25% direct)", RARITIES[7].color]],
  rift: [[`${SETS.astral.name} set (world bosses 20%, elites 3%)`, SETS.astral.color], ['Riftglass · Starsilk · Void Crests (tier-7 crafting, Ascension to tier 8)', '#b48cff']],
  vorthax: [[`${SETS.astral.name} set (Vorthax guarantees one)`, SETS.astral.color], ['Rift Cores · 2 attune the Astral Sanctum', '#6ae6ff']],
  astrael: [['Star shards → Starbound Trial gear (30% direct drop)', EXOTIC.starbound.color]],
  astraelx: [['Starbound Trial gear (guaranteed)', EXOTIC.starbound.color], ['Astral Heart → Big Bang Extreme gear (25% direct)', RARITIES[7].color]],
  ultimate: [['Prestige only: the title "the Unwritten", its aura, a weapon glow and the Unwritten Regalia (cosmetic, no stats)', '#fff1b8'], ['Your clear record on the account card', '#c9b6ff']],
};
// hero caches by map (sim/herocraft.js CACHE_MAPS): every node of a map lists the heroes its caches build
for (const M of CACHE_MAPS) { const R = REALMS.find((r) => r.id === M.id); if (!R) continue; const line = [`Hero caches: ${M.heroes.map((c) => heroOf(c).name).join(' / ')} (locked ones only, split evenly)`, '#ffd23f']; for (const n of R.nodes) if (NODE_LOOT[n.m]) NODE_LOOT[n.m].push(line); }
/** Is a mission locked for this hub info (the same rule as the Mission Counter board)? */
export function nodeLocked(id, I) {
  const m = MISSION[id]; if (m && m.savage) return !astralUnlocked(); // (Part 0S: every Savage opens with Astral mode)
  if (!m || !m.lock) return false;
  return !(m.lock === 'astx' ? I && I.x : I && I.u && I.u[m.lock]);
}
/** Clear state of a node: { cleared, clears, rank } from the profile records (desktop) and the persisted clear flags. */
export function nodeClear(id, records, flags = {}, I = {}) {
  const r = records && records[id], u = (I && I.u) || {};
  const byFlag = { tomb: flags.tomb, crypt: flags.crypt, forge: flags.forge, astrael: flags.astx || (I && I.x), astraelx: flags.astxClear, skaldrat: flags.skx || u.skx, skaldrax: flags.skxc, pyrrhext: flags.pyx || u.pyx, pyrrhexx: flags.pyxc, neferakht: flags.nfx || u.nfx, neferakhx: flags.nfxc, neferakhs: flags.nfsc || u.nfsc, hollow: flags.hollow || u.hollow, ultimate: flags.ultc, vharokt: flags.vhx || u.vhx, vharokx: flags.vhxc,
    field: u.dunes, dunes: flags.frost, frost: u.ember || flags.ember, ember: u.pyt || flags.forge, rift: flags.vtx, vorthax: flags.vtx }[id];
  const clears = r ? r.clears | 0 : 0;
  return { cleared: !!(clears > 0 || byFlag), clears, rank: (r && r.rank) || '' };
}
/** All nodes flattened with their absolute map position. */
/** astral: the map's mode (null = every node, e.g. the tests); in a mode, the doors that mode hides are left out (sim/savage.js doorHidden) */
export function mapNodes(astral = null) {
  const out = [{ ...TOWN_NODE }];
  for (const R of REALMS) for (const n of R.nodes) if (astral == null || !doorHidden(n.m, astral)) out.push({ ...n, realm: R.id, x: R.x + n.dx, y: R.y + n.dy, r: n.kind === 'world' ? 21 : 17 });
  return out;
}
/** Why the local player can't travel to `id` right now ('' = can). */
export function travelBlock(id, I, inTown) {
  if (nodeLocked(id, I)) return (MISSION[id].lockText || 'Locked') + (I && I.host === false ? ' (the host must unlock it)' : '');
  if (I && I.host === false) return `Only the host${I.hostName ? ` (${I.hostName})` : ''} picks where the party travels`;
  if (!inTown) return 'Return to Brightwater Village to travel through the Realm Gates';
  return '';
}

// ------------------------------------------------------------------ Realm Gate keys (horde pass 2)
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** the host needs a key for a Trial / Extreme attempt (guests travel with the host's) */
export function keyBlock(id, I) { return needsKey(id) && !(I && I.host === false) && I.m !== id && keysOf(profile.load(), id) <= 0 ? `Forge a ${KEYS[id].name} first` : ''; }
/** game loop A1: a found-but-not-attuned map gate (the host attunes it once, with the previous rung's trophy) */
export function attuneState(id, flags) {
  const A = ATTUNE[id]; if (!A || !GATE_ATTUNE[id]) return null;
  const P = { unlocks: flags || {} };
  return { found: gateFound(P, id), done: !!(flags && flags[A.flag]), A };
}
function attuneBox(id, I, inTown, flags) {
  const S = attuneState(id, flags); if (!S || S.done || (I && I.host === false)) return '';
  const pr = profile.load(), c = S.A.cost;
  const chips = `<div class="fg-cost"><span class="${pr.gold >= c.gold ? 'ok' : 'no'}">${c.gold} gold</span>${Object.entries(c.mats).map(([k, n]) => `<span class="${(pr.mats[k] | 0) >= n ? 'ok' : 'no'}" style="--mc:${MATERIALS[k].color}" title="${esc(MATERIALS[k].name)} · ${esc(MAT_WHERE[k] || '')}"><i></i>${n} ${esc(MATERIALS[k].name)}</span>`).join('')}</div>`;
  return `<div class="rm-key rm-att"><b>⛩ Attune the ${esc(S.A.name)}</b> · ${S.found ? 'found! one-time, for this account' : 'find it first'} · the attuning trophy comes from ${esc(S.A.from)}
    ${chips}<button class="btn small" id="rmAttune"${!S.found || !inTown || !canPay(pr, c) ? ' disabled style="opacity:.5"' : ''}>Attune gate</button></div>`;
}
function keyBox(id, I, inTown) {
  if (!needsKey(id)) return '';
  const pr = profile.load(), K = KEYS[id], have = keysOf(pr, id), c = K.cost;
  if (I && I.host === false) return `<div class="rm-key"><b>${esc(K.name)}</b> · the host spends one per attempt</div>`;
  const chips = `<div class="fg-cost"><span class="${pr.gold >= c.gold ? 'ok' : 'no'}">${c.gold} gold</span>${Object.entries(c.mats).map(([k, n]) => `<span class="${(pr.mats[k] | 0) >= n ? 'ok' : 'no'}" style="--mc:${MATERIALS[k].color}" title="${esc(MATERIALS[k].name)} (${matGrade(k)}) · ${esc(MAT_WHERE[k] || '')}"><i></i>${n} ${esc(MATERIALS[k].name)} <small>(${pr.mats[k] | 0}/${n})</small></span>`).join('')}</div>`;
  return `<div class="rm-key"><b>🗝 ${esc(K.name)}</b> · you own <b>${have}</b> · one attempt each
    ${chips}<button class="btn small" id="rmKey"${!inTown || !canPay(pr, c) ? ' disabled style="opacity:.5"' : ''}>Forge key</button></div>`;
}

// ------------------------------------------------------------------ painting (classic: flat fills, thick ink)
function blob(ctx, x, y, rx, ry, seed, n = 14) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU, w = 1 + 0.09 * Math.sin(a * 3 + seed * 1.7) + 0.06 * Math.sin(a * 5 + seed * 3.1);
    const px = x + Math.cos(a) * rx * w, py = y + Math.sin(a) * ry * w;
    if (i === 0) ctx.moveTo(px, py); else { const a0 = ((i - 0.5) / n) * TAU, w0 = 1 + 0.09 * Math.sin(a0 * 3 + seed * 1.7) + 0.06 * Math.sin(a0 * 5 + seed * 3.1); ctx.quadraticCurveTo(x + Math.cos(a0) * rx * w0 * 1.04, y + Math.sin(a0) * ry * w0 * 1.04, px, py); }
  }
  ctx.closePath();
}
function label(ctx, s, x, y, size, col = '#fff', align = 'center') {
  ctx.font = `bold ${size}px 'Lilita One', 'Trebuchet MS', sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.28); ctx.strokeStyle = INK; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function decor(ctx, R, t) {
  const { x, y } = R;
  ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = INK;
  if (R.id === 'wilds') for (const [dx, dy, s] of [[-95, 30, 1], [-70, 55, 0.8], [10, -55, 0.9], [100, -20, 1], [-10, 70, 0.7], [-110, -15, 0.8]]) { // trees
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(x + dx - 2, y + dy, 4, 10 * s);
    ctx.beginPath(); ctx.arc(x + dx, y + dy - 4 * s, 11 * s, 0, TAU); ctx.fillStyle = '#4fb34a'; ctx.fill(); ctx.stroke();
  }
  if (R.id === 'dunes') { ctx.fillStyle = '#f0b860'; for (const [dx, dy] of [[-90, 40], [10, -45], [90, 40]]) { ctx.beginPath(); ctx.moveTo(x + dx - 26, y + dy + 10); ctx.quadraticCurveTo(x + dx, y + dy - 14, x + dx + 26, y + dy + 10); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x + 95, y - 30); ctx.lineTo(x + 118, y + 2); ctx.lineTo(x + 72, y + 2); ctx.closePath(); ctx.fillStyle = '#e8c070'; ctx.fill(); ctx.stroke(); } // a pyramid
  if (R.id === 'frost') for (const [dx, dy, s] of [[-30, -50, 1.1], [20, -60, 0.9], [-130, -30, 0.8], [130, -40, 0.8]]) { // peaks
    ctx.beginPath(); ctx.moveTo(x + dx - 26 * s, y + dy + 22 * s); ctx.lineTo(x + dx, y + dy - 18 * s); ctx.lineTo(x + dx + 26 * s, y + dy + 22 * s); ctx.closePath(); ctx.fillStyle = '#9cc6e0'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + dx - 9 * s, y + dy - 4 * s); ctx.lineTo(x + dx, y + dy - 18 * s); ctx.lineTo(x + dx + 9 * s, y + dy - 4 * s); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
  }
  if (R.id === 'rift') { // game loop C3: void tears + crystal spires + a star
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 120, y + 18); ctx.quadraticCurveTo(x - 40, y - 6, x + 10, y + 20); ctx.quadraticCurveTo(x + 70, y + 40, x + 125, y + 6); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#1a0e3a'; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#c9a8ff'; ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = INK;
    for (const [dx, dy, s] of [[-30, -20, 1], [70, -18, 0.8], [118, -26, 0.7]]) { ctx.beginPath(); ctx.moveTo(x + dx - 8 * s, y + dy + 10 * s); ctx.lineTo(x + dx, y + dy - 22 * s); ctx.lineTo(x + dx + 8 * s, y + dy + 10 * s); ctx.closePath(); ctx.fillStyle = '#9ad8ff'; ctx.fill(); ctx.stroke(); }
    const tw = 0.6 + 0.4 * Math.sin(t * 3); ctx.globalAlpha = tw; ctx.fillStyle = '#ffe27a'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, rr = i % 2 ? 4 : 10; ctx.lineTo(x - 100 + Math.cos(a) * rr, y - 22 + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (R.id === 'ember') { // the crater + lava rivers
    ctx.beginPath(); ctx.moveTo(x + 10, y - 70); ctx.lineTo(x + 40, y - 30); ctx.lineTo(x - 22, y - 30); ctx.closePath(); ctx.fillStyle = '#5a3030'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 9, y - 66, 9, 4, 0, 0, TAU); ctx.fillStyle = `rgba(255,${150 + 60 * Math.sin(t * 3) | 0},60,1)`; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#ff6a2a'; ctx.beginPath(); ctx.moveTo(x - 40, y + 70); ctx.quadraticCurveTo(x + 10, y + 20, x + 80, y + 66); ctx.stroke();
  }
  if (R.id === 'star') { ctx.fillStyle = '#fff6c8'; for (let i = 0; i < 14; i++) { const a = i * 2.4 + R.seed, rr = 30 + (i * 37) % 60; const tw = 0.5 + 0.5 * Math.sin(t * 2 + i); ctx.globalAlpha = 0.4 + 0.6 * tw; ctx.fillRect(x + Math.cos(a) * rr * 1.2, y + Math.sin(a) * rr * 0.4, 2.5, 2.5); } ctx.globalAlpha = 1; }
  ctx.restore();
}
function nodeShape(ctx, n, r) {
  ctx.beginPath();
  if (n.kind === 'savage') { for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? r * 0.78 : r * 1.3; ctx[i ? 'lineTo' : 'moveTo'](n.x + Math.cos(a) * rr, n.y + Math.sin(a) * rr); } ctx.closePath(); }
  else if (n.kind === 'trial' || n.kind === 'extreme') { ctx.moveTo(n.x, n.y - r * 1.15); ctx.lineTo(n.x + r * 1.05, n.y); ctx.lineTo(n.x, n.y + r * 1.15); ctx.lineTo(n.x - r * 1.05, n.y); ctx.closePath(); }
  else if (n.kind === 'dungeon') { ctx.moveTo(n.x - r, n.y + r * 0.9); ctx.lineTo(n.x - r, n.y - r * 0.2); ctx.arc(n.x, n.y - r * 0.2, r, Math.PI, 0); ctx.lineTo(n.x + r, n.y + r * 0.9); ctx.closePath(); }
  else if (n.kind === 'ultimate') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.55 : r * 1.25; ctx[i ? 'lineTo' : 'moveTo'](n.x + Math.cos(a) * rr, n.y + Math.sin(a) * rr); } ctx.closePath(); } // (Part F: a five-point star, one point per phase)
  else ctx.arc(n.x, n.y, r, 0, TAU);
}
const GLYPH = { town: '⚑', world: '⚑', dungeon: '⛫', trial: '◆', extreme: '✦', raid: '◎', ultimate: '✧' };
/**
 * Paint the whole map. st: { I (hub info), records, flags, sel (mission id), hover, here (the mission the party is in), t }
 * Returns the node list with positions (for hit tests).
 */
export function drawRealmMap(ctx, st) {
  const t = st.t || 0, I = st.I || { u: {} };
  ctx.save();
  // sea + parchment frame
  const g = ctx.createLinearGradient(0, 0, 0, MAP_H); g.addColorStop(0, '#2d3f78'); g.addColorStop(0.35, '#3d77b0'); g.addColorStop(1, '#4fa0c8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, MAP_W, MAP_H);
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) { const wx = (i * 173 + t * 12) % (MAP_W + 60) - 30, wy = 150 + (i * 97) % 400; ctx.beginPath(); ctx.arc(wx, wy, 9, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  // routes: village -> each realm (dashed, gold when open)
  const nodes = mapNodes(st.astral == null ? mapAstral(I) : st.astral);
  for (const R of REALMS) {
    const first = R.nodes[0], open = !nodeLocked(first.m, I);
    ctx.setLineDash([10, 9]); ctx.lineDashOffset = -t * 18; ctx.lineWidth = 6; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(VILLAGE.x, VILLAGE.y); ctx.quadraticCurveTo((VILLAGE.x + R.x) / 2, (VILLAGE.y + R.y) / 2 + (R.sky ? 0 : 40), R.x + first.dx, R.y + first.dy); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = open ? '#ffd23f' : 'rgba(200,200,220,.45)'; ctx.stroke();
  }
  ctx.setLineDash([]);
  // islands
  for (const R of REALMS) {
    ctx.save();
    if (R.sky) { ctx.shadowColor = 'rgba(160,140,255,.9)'; ctx.shadowBlur = 22; }
    else { blob(ctx, R.x, R.y + 12, R.rx, R.ry, R.seed); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill(); }
    blob(ctx, R.x, R.y, R.rx, R.ry, R.seed); ctx.fillStyle = R.dark; ctx.fill(); ctx.restore();
    blob(ctx, R.x, R.y - 6, R.rx * 0.94, R.ry * 0.9, R.seed); ctx.fillStyle = R.col; ctx.fill();
    blob(ctx, R.x, R.y, R.rx, R.ry, R.seed); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    const locked = nodeLocked(R.nodes[0].m, I);
    decor(ctx, R, t);
    if (locked) { blob(ctx, R.x, R.y, R.rx, R.ry, R.seed); ctx.fillStyle = 'rgba(40,36,60,.5)'; ctx.fill(); }
    label(ctx, R.name, R.x, R.y - R.ry - (R.sky ? 4 : 10), R.sky ? 17 : 20, locked ? '#b8b0cc' : '#fff6c8');
  }
  // the village (hub)
  ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = INK;
  blob(ctx, VILLAGE.x, VILLAGE.y, 70, 46, 9); ctx.fillStyle = '#8fd46a'; ctx.fill(); ctx.stroke();
  for (const [dx, dy, c] of [[-46, -4, '#e05a4a'], [44, -6, '#4a8ae0']]) { ctx.fillStyle = '#f4e6c8'; ctx.fillRect(VILLAGE.x + dx - 10, VILLAGE.y + dy, 20, 16); ctx.strokeRect(VILLAGE.x + dx - 10, VILLAGE.y + dy, 20, 16); ctx.beginPath(); ctx.moveTo(VILLAGE.x + dx - 14, VILLAGE.y + dy); ctx.lineTo(VILLAGE.x + dx, VILLAGE.y + dy - 13); ctx.lineTo(VILLAGE.x + dx + 14, VILLAGE.y + dy); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.stroke(); }
  // the four Realm Gates
  for (let i = 0; i < 5; i++) { const gx = VILLAGE.x - 52 + i * 26, gy = VILLAGE.y + 26, R = REALMS[i], open = !nodeLocked(R.nodes[0].m, I); ctx.beginPath(); ctx.ellipse(gx, gy, 8, 11, 0, 0, TAU); ctx.fillStyle = open ? R.dark : '#555'; ctx.fill(); ctx.stroke(); if (open) { ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 4 + i); ctx.beginPath(); ctx.ellipse(gx, gy, 4, 7, 0, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1; } }
  ctx.restore();
  label(ctx, VILLAGE.name, VILLAGE.x, VILLAGE.y + 58, 17, '#ffd23f');
  // nodes (UI pass: name labels no longer overprint each other - a label that would hit an earlier one or the legend goes above its node)
  const placed = [{ x: VILLAGE.x - 90, y: VILLAGE.y + 48, w: 180, h: 20 }]; // (the village name)
  ctx.font = 'bold 12px "Lilita One", "Trebuchet MS", sans-serif';
  const LBL = {};
  for (const n of nodes) {
    const m = MISSION[n.m]; if (!m) continue;
    const r0 = n.r, txt = m.name.replace(/ \((Trial|Extreme|Savage)\)$/, ''), w = ctx.measureText(txt).width + 6, two = n.kind === 'trial' || n.kind === 'extreme' || n.kind === 'savage';
    const box = (up) => (up ? { x: n.x - w / 2, y: n.y - r0 - (two ? 40 : 26), w, h: two ? 30 : 16 } : { x: n.x - w / 2, y: n.y + r0 + 5, w, h: two ? 30 : 16 });
    const hit = (b) => placed.some((q) => b.x < q.x + q.w && b.x + b.w > q.x && b.y < q.y + q.h && b.y + b.h > q.y) || b.y + b.h > MAP_H - 30;
    let up = false; if (hit(box(false)) && !hit(box(true))) up = true;
    placed.push(box(up)); LBL[n.m] = up; n.lup = up;
  }
  for (const n of nodes) {
    const locked = nodeLocked(n.m, I), c = nodeClear(n.m, st.records, st.flags, I), sel = st.sel === n.m, hov = st.hover === n.m;
    const r = n.r * (hov || sel ? 1.15 : 1), col = KIND_COL[n.kind];
    if ((n.kind === 'extreme' || n.kind === 'savage') && !locked) { ctx.save(); ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 6); nodeShape(ctx, n, r + 7); ctx.fillStyle = col; ctx.fill(); ctx.restore(); }
    if (sel) { ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = '#fff6c8'; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 20; ctx.beginPath(); ctx.arc(n.x, n.y, r + 12, 0, TAU); ctx.stroke(); ctx.restore(); }
    nodeShape(ctx, { ...n, y: n.y + 4 }, r); ctx.fillStyle = INK; ctx.fill();
    nodeShape(ctx, n, r); ctx.fillStyle = locked ? '#6a6480' : col; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    label(ctx, locked ? '🔒' : GLYPH[n.kind], n.x, n.y + 1, locked ? r * 0.85 : r * 1.0, '#fff');
    if (c.cleared) { ctx.save(); ctx.translate(n.x + r * 0.85, n.y - r * 0.85); ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fillStyle = '#3fd27a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); label(ctx, '✔', 0, 1, 11, '#fff'); ctx.restore(); }
    if (c.rank) label(ctx, c.rank, n.x - r * 0.9, n.y - r * 0.85, 13, c.rank === 'S' ? '#ffd23f' : '#7ee0ff');
    const m = MISSION[n.m], up = LBL[n.m], two = n.kind === 'trial' || n.kind === 'extreme' || n.kind === 'savage', ly = up ? n.y - r - (two ? 30 : 13) : n.y + r + 13;
    if (m) label(ctx, m.name.replace(/ \((Trial|Extreme)\)$/, ''), n.x, ly, 12, locked ? '#c8c0d8' : '#fff');
    if (two) label(ctx, n.kind === 'trial' ? 'TRIAL' : n.kind === 'savage' ? 'SAVAGE' : 'EXTREME', n.x, ly + 13, 10, col);
    if ((st.here || 'town') === n.m) { const b = Math.sin(t * 5) * 4; ctx.save(); ctx.translate(n.x, n.y - r - 22 + b); youPin(ctx); ctx.restore(); }
  }
  // legend
  ctx.save(); ctx.translate(16, MAP_H - 22);
  let lx = 0; for (const k of ['town', 'world', 'dungeon', 'raid', 'trial', 'extreme']) { const n = { kind: k, x: lx + 9, y: 0 }; nodeShape(ctx, n, 8); ctx.fillStyle = KIND_COL[k]; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); label(ctx, KIND_LABEL[k], lx + 22, 1, 12, '#fff', 'left'); lx += 22 + KIND_LABEL[k].length * 7.4 + 18; }
  label(ctx, '✔ cleared   🔒 locked', lx + 6, 1, 12, '#fff', 'left');
  ctx.restore();
  ctx.restore();
  return nodes;
}
function youPin(ctx) {
  ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(-9, -2); ctx.arc(0, -4, 9.5, Math.PI * 0.8, Math.PI * 2.2); ctx.closePath(); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  label(ctx, 'YOU', 0, -24, 11, '#ffd23f');
}

// ------------------------------------------------------------------ hit testing (2026-10-09 map-click fix)
// The canvas is CSS-sized (width 100%, aspect-ratio, max-height, flex-stretched by a tall side panel) and drawn with
// object-fit: contain, so the drawn map is letterboxed inside its box (and inset by the 4 px border). Clicks used to be
// mapped over the whole border box: on wide windows and whenever the side panel grew taller (Rift / Star Sanctum
// nodes), every click landed off its icon. mapPoint maps through the real drawn rectangle instead.
/** the drawn map rectangle of the canvas (client px): border + padding off, then object-fit: contain */
export function contentBox(cv) {
  const b = cv.getBoundingClientRect(), cs = typeof getComputedStyle === 'function' ? getComputedStyle(cv) : null;
  const num = (k) => (cs ? parseFloat(cs[k]) || 0 : 0);
  const l = num('borderLeftWidth') + num('paddingLeft'), r = num('borderRightWidth') + num('paddingRight'), t = num('borderTopWidth') + num('paddingTop'), bo = num('borderBottomWidth') + num('paddingBottom');
  const W = Math.max(1, b.width - l - r), H = Math.max(1, b.height - t - bo), sc = Math.min(W / MAP_W, H / MAP_H);
  return { x: b.left + l + (W - MAP_W * sc) / 2, y: b.top + t + (H - MAP_H * sc) / 2, w: MAP_W * sc, h: MAP_H * sc, sc };
}
/** client px -> map units */
export function mapPoint(cv, cx, cy) { const c = contentBox(cv); return { x: (cx - c.x) / c.sc, y: (cy - c.y) / c.sc, sc: c.sc }; }
/** the node under p (map units): the icon, its name label below it, and at least 22 / 30 (touch) screen px around it */
export function pickNode(nodes, p, touch) {
  const minPx = touch ? 30 : 22, sc = p.sc || 1;
  let best = null, bd = 1e9;
  for (const n of nodes) {
    const R = Math.max(n.r + 10, minPx / sc), d = Math.hypot(p.x - n.x, p.y - n.y);
    const onLabel = Math.abs(p.x - n.x) < Math.max(46, n.r * 2.4) && (n.lup ? p.y < n.y && p.y > n.y - n.r - 34 : p.y > n.y && p.y < n.y + n.r + 32); // the name (+ TRIAL / EXTREME) under the icon
    const inVillage = n.kind === 'town' && (((p.x - VILLAGE.x) / 74) ** 2 + ((p.y - VILLAGE.y) / 50) ** 2 < 1 || (Math.abs(p.x - VILLAGE.x) < 90 && Math.abs(p.y - (VILLAGE.y + 58)) < 12)); // (the whole village + its name)
    const k = d < R ? d / R : onLabel || inVillage ? 0.95 : 9;
    if (k < 1 && k < bd) { bd = k; best = n; }
  }
  return best;
}

// ------------------------------------------------------------------ the overlay (DOM: canvas + side panel)
const CSS = `
.rm-wrap { position: fixed; inset: 0; z-index: 41; display: flex; align-items: center; justify-content: center; background: rgba(10,8,20,.6); }
.rm-wrap .panel { width: min(1240px, 97vw); max-height: 96vh; display: flex; flex-direction: column; gap: 8px; position: relative; padding: 12px 14px; }
.rm-head { display: flex; align-items: center; gap: 12px; } .rm-head h2 { margin: 0; font-size: 28px; color: #ffd23f; text-shadow: 0 3px 0 #2b2433; }
.rm-head .rm-hint { font-family: 'Trebuchet MS', sans-serif; font-size: 13px; color: #e6ddf5; flex: 1; }
.rm-body { display: flex; gap: 12px; min-height: 0; }
.rm-body canvas { flex: 1; min-width: 0; width: 100%; aspect-ratio: 960 / 560; border: 4px solid #2b2433; border-radius: 14px; box-shadow: 0 5px 0 rgba(0,0,0,.35); cursor: pointer; background: #3d77b0; max-height: 78vh; object-fit: contain; align-self: flex-start; touch-action: manipulation; }
.rm-side { width: 280px; flex: none; display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,.07); border: 4px solid #2b2433; border-radius: 14px; padding: 10px 12px; font-family: 'Trebuchet MS', sans-serif; font-size: 13px; overflow: auto; }
.rm-side .rm-kind { font-family: inherit; font-size: 11px; letter-spacing: 1px; font-weight: bold; }
.rm-side .rm-name { font-family: 'Lilita One', 'Trebuchet MS', sans-serif; font-size: 22px; text-shadow: 0 2px 0 #2b2433; }
.rm-side .rm-stars { color: #ffd23f; letter-spacing: 2px; } .rm-side .rm-st { font-weight: bold; } .rm-side ul { margin: 2px 0 0 16px; padding: 0; }
.rm-side .btn { margin-top: auto; font-size: 20px; font-family: 'Lilita One', 'Trebuchet MS', sans-serif; } .rm-side .rm-why { color: #ffb8d8; font-size: 12px; }
/* mounted as the hub's World Map tab */
.rm-wrap.in-hub { position: relative; inset: auto; z-index: auto; background: none; width: 100%; height: 100%; }
.rm-wrap.in-hub .panel { width: 100%; max-height: 100%; } .rm-wrap.in-hub #rmClose, .rm-wrap.in-hub .rm-head { display: none; }
@media (max-height: 520px) { .rm-wrap .panel { padding: 6px 8px; } .rm-head h2 { font-size: 20px; } .rm-head .rm-hint { display: none; } .rm-side { width: 210px; font-size: 11.5px; } .rm-side .rm-name { font-size: 17px; } .rm-body canvas { max-height: 80vh; } }
`;
import { astralRow, setAstralWanted, ASTRAL_CSS, astralWanted, astralUnlocked } from './astralui.js';
import { doorHidden } from '../sim/savage.js';
/** the map's mode: the host's own toggle; a guest sees the host's (hubInfo().as) */
export const mapAstral = (I) => (I && I.host === false ? !!I.as : astralWanted());
export class RealmMap {
  /** game: same shape TownUI gets; opts: { records() -> profile records (desktop), flags() -> persisted clear flags, inTown() } */
  constructor(game, opts = {}) {
    this.game = game; this.opts = opts; this.open = false; this.sel = 'field'; this.hover = null; this.nodes = mapNodes(); this.raf = 0;
    if (typeof document === 'undefined') return;
    if (!document.getElementById('realmmap-css')) { const st = document.createElement('style'); st.id = 'realmmap-css'; st.textContent = CSS + ASTRAL_CSS; document.head.appendChild(st); }
    const w = this.root = document.createElement('div'); w.id = 'realmMap'; w.className = 'rm-wrap hidden';
    w.innerHTML = `<div class="panel"><button class="btn small ghost tu-x" id="rmClose">✕</button><div class="rm-head"><h2>Realm Gate Map</h2><div class="rm-hint">Every world, dungeon, trial and extreme. Pick a node, then Travel (host, from anywhere in town).</div></div>
      <div class="rm-body"><canvas id="rmCanvas" width="${MAP_W}" height="${MAP_H}"></canvas><div class="rm-side" id="rmSide"></div></div></div>`;
    w.addEventListener('pointerdown', (e) => { if (e.target === w && !this.inHub) this.hide(); });
    w.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    document.body.appendChild(w);
    this.cv = w.querySelector('#rmCanvas'); this.side = w.querySelector('#rmSide');
    w.querySelector('#rmClose').onclick = () => this.hide();
    const at = (e) => mapPoint(this.cv, e.clientX, e.clientY);
    const hit = (p, touch) => pickNode(this.nodes, p, touch);
    this.cv.addEventListener('pointermove', (e) => { const n = hit(at(e), e.pointerType === 'touch'); this.hover = n ? n.m : null; this.cv.style.cursor = n ? 'pointer' : 'default'; this.cv.title = n ? (n.m === 'town' ? VILLAGE.name : MISSION[n.m] ? MISSION[n.m].name : '') : ''; });
    this.cv.addEventListener('pointerleave', () => { this.hover = null; });
    this.cv.addEventListener('pointerdown', (e) => { const n = hit(at(e), e.pointerType === 'touch'); if (n) { this.sel = n.m; this.renderSide(); if (this.game.audio && this.game.audio.play) this.game.audio.play('ui'); } });
    this.onKey = (e) => { if (this.open && !this.inHub && e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.hide(); } };
    addEventListener('keydown', this.onKey, { capture: true });
  }
  get info() { return this.game.hubInfo ? this.game.hubInfo() : { m: 'town', host: true, x: false, u: {} }; }
  records() { try { return this.opts.records ? this.opts.records() : null; } catch { return null; } }
  flags() { try { return this.opts.flags ? this.opts.flags() : {}; } catch { return {}; } }
  inTown() { return this.opts.inTown ? !!this.opts.inTown() : this.info.m === 'town'; }
  show(sel) {
    if (!this.root) return;
    if (sel) this.sel = sel; else { const h = this.info.m; if (h && h !== 'town' && MISSION[h]) this.sel = h; }
    this.open = true; this.root.classList.remove('hidden'); this.renderSide();
    if (this.game.onBoard) this.game.onBoard(true);
    const loop = () => { if (!this.open) return; this.draw(); this.raf = requestAnimationFrame(loop); }; cancelAnimationFrame(this.raf); loop();
  }
  hide() { if (!this.root || !this.open) return; this.open = false; this.root.classList.add('hidden'); cancelAnimationFrame(this.raf); if (this.game.onBoard) this.game.onBoard(false); }
  toggle() { if (this.open) this.hide(); else this.show(); }
  draw() {
    // crisp on HiDPI / big windows: the backing store follows the drawn size (the map is laid out in MAP_W x MAP_H units)
    const ctx = this.cv.getContext('2d'), I = this.info, c = contentBox(this.cv), dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    const k = Math.max(1, Math.min(2.5, Math.round((c.w * dpr / MAP_W) * 4) / 4 || 1));
    if (this.cv.width !== Math.round(MAP_W * k)) { this.cv.width = Math.round(MAP_W * k); this.cv.height = Math.round(MAP_H * k); }
    if (this.sel === 'town' && (this.tf = (this.tf || 0) + 1) % 15 === 0) { const sig = JSON.stringify(this.townState()); if (sig !== this.tsig) { this.tsig = sig; this.renderTown(); } } // (the village flag's Travel follows the live rules)
    ctx.setTransform(k, 0, 0, k, 0, 0); this.nodes = drawRealmMap(ctx, { I, records: this.records(), flags: this.flags(), sel: this.sel, hover: this.hover, here: I.m, t: performance.now() / 1000 }); }
  renderSide() {
    if (this.sel === 'town') return this.renderTown();
    const id = this.sel, m = MISSION[id], n = this.nodes.find((x) => x.m === id); if (!m || !n) return;
    const I = this.info, locked = nodeLocked(id, I), c = nodeClear(id, this.records(), this.flags(), I), why = travelBlock(id, I, this.inTown());
    const stars = '★'.repeat(m.stars) + '<span style="opacity:.3">' + '★'.repeat(5 - m.stars) + '</span>';
    const realm = REALMS.find((R) => R.id === n.realm);
    const loot = (NODE_LOOT[id] || []).map(([s, col]) => `<li style="color:${col}">${s}</li>`).join('');
    const st = locked ? `<span style="color:#ffb8d8">🔒 Locked: ${m.lockText || 'Locked'}</span>` : c.cleared ? `<span style="color:#7dffb0">✔ Cleared${c.clears ? ` ×${c.clears}` : ''}${c.rank ? ` · best rank ${c.rank}` : ''}</span>` : '<span style="color:#ffe7a0">Open · not cleared yet</span>';
    this.side.innerHTML = `<div class="rm-kind" style="color:${KIND_COL[n.kind]}">${KIND_LABEL[n.kind].toUpperCase()} · ${realm ? realm.name : ''}</div>
      <div class="rm-name">${m.name}</div><div class="rm-stars">${stars}</div><div class="dim">${m.sub}</div>
      <div class="rm-st">${st}</div><div>${m.desc}</div>
      ${astralRow(I)}
      ${loot ? `<div><b style="color:#ffd23f">Exclusive loot</b><ul>${loot}</ul></div>` : ''}
      ${attuneBox(id, I, this.inTown(), this.flags())}${keyBox(id, I, this.inTown())}
      ${why ? `<div class="rm-why">${why}</div>` : ''}
      <button class="btn" id="rmGo"${why || keyBlock(id, I) ? ' disabled style="opacity:.5"' : ''}>${I.m === id ? 'You are here' : needsKey(id) && I.host !== false ? `Travel (uses 1 key)` : 'Travel'}</button>`;
    const go = this.side.querySelector('#rmGo');
    go.onclick = () => { if (go.disabled || I.m === id) return; this.travel(id); };
    for (const b of this.side.querySelectorAll('[data-astral]')) b.onclick = () => { setAstralWanted(this.game, b.dataset.astral === '1'); if (this.game.audio && this.game.audio.play) this.game.audio.play('ui'); this.renderSide(); };
    const at = this.side.querySelector('#rmAttune');
    if (at) at.onclick = () => { if (at.disabled || (this.attPend && this.attPend.id === id && Date.now() - this.attPend.t < 4000)) return; const pr = profile.load(); if (!attuneGate(pr, id)) return; profile.save(); this.attPend = { id, t: Date.now() }; at.disabled = true; /* bugpass: co-op confirms the attune a few ticks later; a 2nd click no longer pays twice */ this.game.command({ type: 'attune', id }); if (this.game.audio) { this.game.audio.play('slam'); this.game.audio.play('legendary'); } setTimeout(() => this.renderSide(), 120); };
    const fk = this.side.querySelector('#rmKey');
    if (fk) fk.onclick = () => { if (fk.disabled) return; if (forgeKey(profile.load(), id)) { profile.save(); if (this.game.audio) { this.game.audio.play('slam'); this.game.audio.play('loot'); } } this.renderSide(); };
  }
  /** the Brightwater Village flag: Travel = the 2 s Travel to Town channel (sim/hub.js townTravelBlock has the rules:
   *  open worlds only, not inside a dungeon / trial / mission, not next to a live world boss; co-op: the host brings the party) */
  townState() {
    const I = this.info, g = this.game, p = g && g.player;
    if (I.m === 'town' && (!p || this.inTown())) return { here: true, why: '' };
    if (inMission(g)) return { why: 'Not during a mission, trial or dungeon. To leave one: Options › Abandon mission.' };
    const why = clientTownBlock(g);
    return { here: why === 'You are already in town', why: why === 'You are already in town' ? '' : why };
  }
  renderTown() {
    const I = this.info, S = this.townState(), coop = !!I.coop || I.host === false;
    const lbl = townLabel(this.game).replace(/^Travel to Town/, 'Travel');
    const st = S.here ? '<span style="color:#7dffb0">● You are here</span>' : S.why ? '<span style="color:#ffb8d8">Travel is blocked right now</span>' : '<span style="color:#ffe7a0">Open · 2 s channel, hold still</span>';
    this.side.innerHTML = `<div class="rm-kind" style="color:${KIND_COL.town}">TOWN · THE HUB</div>
      <div class="rm-name">${VILLAGE.name}</div><div class="dim">Safe zone · the Mission Counter, Forge, Stash, Quartermaster and every Realm Gate</div>
      <div class="rm-st">${st}</div>
      <div>Travel back from any open world: a 2 s channel (moving or a hit cancels it). Not during a mission, trial or dungeon, and not next to a live world boss.${coop ? (I.host === false ? ' As a guest you go alone.' : ' As the host you bring the whole party.') : ''}</div>
      ${S.why ? `<div class="rm-why">${esc(S.why)}</div>` : ''}
      <button class="btn" id="rmGo"${S.here || S.why ? ' disabled style="opacity:.5"' : ''}>${S.here ? 'You are here' : esc(lbl)}</button>`;
    const go = this.side.querySelector('#rmGo');
    go.onclick = () => { if (go.disabled) return; if (startTownTravel(this.game)) { this.hide(); if (this.inHub && this.game.menuHub) this.game.menuHub.close(); } else this.renderTown(); };
  }
  travel(id) {
    try { setAstralWanted(this.game, !!profile.load().astralOn); } catch { /* */ } // (Part C: the mode goes with the travel request)
    if (needsKey(id) && this.info.host !== false) { const pr = profile.load(); if (!useKey(pr, id)) return; profile.keyPend = id; profile.save(); } // (a Trial / Extreme attempt spends a key; refunded if the sim refuses)
    this.game.command({ type: 'mission', id, map: 1 }); this.hide(); if (this.inHub && this.game.menuHub) this.game.menuHub.close(); if (this.opts.onTravel) this.opts.onTravel(id);
  }
  destroy() { this.hide(); if (this.onKey) removeEventListener('keydown', this.onKey, { capture: true }); if (this.root) this.root.remove(); this.root = null; }
}
