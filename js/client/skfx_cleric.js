// Paladin (class id cleric): heavy, dignified, bright. Gold and white light with a cool sky-blue for shields and wards.
// Smite is a hammer of light, Sanctuary a glowing dome, Shield Rush a golden shield bash, Judgment a beam from heaven; chains stack
// crosses, halos, wings, chime rings and pillars of light. Own pieces: cleric_hammer / shield / sword (silhouettes), cleric_halo, cleric_cross, cleric_dome.
import { TAU, clamp } from './fxsk_core.js';
import { bloom, ease } from './fxglow.js';

const GOLD = '#ffd45a', WHITE = '#fffbe6', SKY = '#8fd0ff', SKYHI = '#e4f4ff', WARM = '#ffb85a', DEEP = '#3a2a08';
const lerp = (a, b, t) => a + (b - a) * t;

function sparkle(ctx, x, y, r, rot, col) { // a four-point glint
  ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const an = rot + i * Math.PI / 4, rr = i % 2 ? r * 0.18 : r; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
  ctx.closePath(); ctx.fill();
}
const shieldPath = (ctx, s) => { // a heater shield, centred on the origin, 1 unit = s px
  ctx.beginPath(); ctx.moveTo(-0.85 * s, -1.0 * s); ctx.lineTo(0.85 * s, -1.0 * s); ctx.lineTo(0.85 * s, 0.1 * s);
  ctx.bezierCurveTo(0.85 * s, 0.72 * s, 0.3 * s, 1.05 * s, 0, 1.32 * s); ctx.bezierCurveTo(-0.3 * s, 1.05 * s, -0.85 * s, 0.72 * s, -0.85 * s, 0.1 * s); ctx.closePath();
};
// a point `max` px toward the target (or the aim)
const pt = (k, max) => { const d = Math.min(k.dist, max) || max, u = k.dist > 1 ? d / k.dist : 0; return k.dist > 1 ? { x: k.x + (k.tx - k.x) * u, y: k.y + (k.ty - k.y) * u } : k.ahead(d); };
const heal = (k, x, y, n = 14, d = 0) => k.motes({ x, y, n, type: 'star', spd: 60, g: -80, size: 6, col: SKY, col2: '#fff', spread: TAU, R0: 90, d, life: 1.4, opt: true });
const feathers = (k, x, y, n, o = {}) => k.motes({ x, y, n, type: 'feather', spd: 70, g: 45, size: 8, col: WHITE, col2: GOLD, spread: TAU, sway: 26, life: 1.9, pl: 1.5, ...o });

export default {
  pal: { a: '#ffd45a', b: '#8fd0ff', hi: '#fffbe6', deep: '#2a2208', ink: '#161004', edge: '#fff0b0' },
  prims: {
    /** A halo ring floating at (x,y) with a turning crown of glints. R radius, sq squash, rise px, grow (expands). */
    cleric_halo(ctx, c, k, time) {
      const a = ease.out(clamp(k / 0.18)) * ease.in(clamp((1 - k) / 0.35)), g = c.grow ? 0.35 + 0.65 * ease.out(clamp(k / 0.55)) : 1, R = c.R * g, y = c.y - (c.rise || 0) * ease.out(k), sq = c.sq ?? 0.3;
      if (a <= 0.01) return;
      ctx.save(); ctx.translate(c.x, y); ctx.scale(1, sq); ctx.lineCap = 'round';
      bloom(ctx, 0, 0, R * 1.15, c.col, 0.22 * a);
      for (const [r, w, col, al] of [[1, 11, c.col, 0.5], [1, 4, c.hi || '#fff', 0.95], [0.86, 2, '#fff', 0.7]]) { ctx.globalAlpha = a * al; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0, 0, R * r, 0, TAU); ctx.stroke(); }
      for (let i = 0; i < 28; i++) { const an = i / 28 * TAU + time * 0.5, r0 = R * 1.05, r1 = R * (1.13 + (i % 4 === 0 ? 0.12 : 0)); ctx.globalAlpha = a * (i % 4 === 0 ? 0.95 : 0.5); ctx.strokeStyle = i % 4 === 0 ? '#fff' : c.hi || c.col; ctx.lineWidth = i % 4 === 0 ? 3 : 1.6; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); ctx.stroke(); }
      ctx.restore();
      for (let i = 0; i < 3; i++) { const an = time * 0.9 + i * TAU / 3, x = c.x + Math.cos(an) * R, yy = y + Math.sin(an) * R * sq; ctx.globalAlpha = a; sparkle(ctx, x, yy, R * 0.12 + 5, time + i, '#fff'); bloom(ctx, x, yy, R * 0.22 + 8, c.col, 0.6 * a); }
    },
    /** A cross of light (long vertical, short horizontal, hot core): the paladin's glint. R = reach of the long arm. */
    cleric_cross(ctx, c, k) {
      const e = ease.out(clamp(k / 0.2)), a = Math.pow(1 - k, 1.3), L = c.R * e, w = c.R * 0.07 * (1 - k * 0.5);
      if (a <= 0.01) return;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot || 0);
      for (const [m, col, al] of [[1, c.col, 0.55], [0.5, c.hi || '#fff', 0.9], [0.22, '#fff', 1]]) {
        ctx.globalAlpha = a * al; ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(0, -L * 1.25 * m); ctx.lineTo(w * m * 1.4, 0); ctx.lineTo(0, L * 1.25 * m); ctx.lineTo(-w * m * 1.4, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-L * 0.85 * m, 0); ctx.lineTo(0, -w * m * 1.4); ctx.lineTo(L * 0.85 * m, 0); ctx.lineTo(0, w * m * 1.4); ctx.closePath(); ctx.fill();
      }
      ctx.restore(); bloom(ctx, c.x, c.y, c.R * 0.6 * (0.5 + 0.5 * e), c.col, 0.45 * a); bloom(ctx, c.x, c.y, c.R * 0.2, '#fff', 0.6 * a, 1);
    },
    /** A giant mace-hammer of light, head down, falling on (x,y). size = half width of the head. */
    cleric_hammer(ctx, c, k) {
      const hit = c.hit ?? 0.5, fall = clamp(k / hit), post = clamp((k - hit) / (1 - hit)), s = c.size, dy = k < hit ? -(1 - ease.in(fall)) * c.h : 0;
      const a = k < hit ? 0.35 + 0.65 * fall : 1 - ease.in(clamp((post - 0.2) / 0.8)); if (a <= 0.01) return;
      ctx.save(); ctx.translate(c.x, c.y + dy); ctx.scale(s, s);
      if (k < hit) { const g = ctx.createLinearGradient(0, -c.h / s * 0.9, 0, -1); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, c.col); ctx.globalAlpha = 0.28 * a * fall; ctx.fillStyle = g; ctx.fillRect(-0.55, -c.h / s * 0.9, 1.1, c.h / s * 0.9); }
      ctx.globalAlpha = a * 0.45; ctx.fillStyle = c.col; ctx.fillRect(-0.15, -4.3, 0.3, 3.3); // handle glow
      ctx.globalAlpha = a; ctx.fillStyle = c.hi || '#fff'; ctx.fillRect(-0.07, -4.2, 0.14, 3.2); ctx.beginPath(); ctx.arc(0, -4.3, 0.24, 0, TAU); ctx.fill();
      const head = () => { ctx.beginPath(); ctx.moveTo(-1.15, -0.85); ctx.lineTo(-0.95, -1.12); ctx.lineTo(0.95, -1.12); ctx.lineTo(1.15, -0.85); ctx.lineTo(1.15, -0.15); ctx.lineTo(0.95, 0.08); ctx.lineTo(-0.95, 0.08); ctx.lineTo(-1.15, -0.15); ctx.closePath(); };
      const gr = ctx.createLinearGradient(-1.15, 0, 1.15, 0); gr.addColorStop(0, c.col); gr.addColorStop(0.5, '#fff'); gr.addColorStop(1, c.col);
      ctx.globalAlpha = a * 0.7; ctx.fillStyle = gr; head(); ctx.fill();
      ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.07; head(); ctx.stroke();
      ctx.strokeStyle = c.col; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(-0.55, -0.5); ctx.lineTo(0.55, -0.5); ctx.moveTo(0, -0.88); ctx.lineTo(0, -0.1); ctx.stroke(); // holy cross on the face
      ctx.restore(); bloom(ctx, c.x, c.y + dy - s * 0.5, s * 2.6, c.col, 0.3 * a); bloom(ctx, c.x, c.y + dy - s * 0.5, s * 1.0, '#fff', 0.22 * a, 1);
    },
    /** A heater shield of light. Static (pulse) or flying from (x,y) to (x2,y2); flip = spins like a thrown disc. */
    cleric_shield(ctx, c, k, time) {
      const fly = c.x2 != null, u = fly ? ease.out(clamp(k / 0.65)) : 1, a = ease.out(clamp(k / 0.12)) * ease.in(clamp((1 - k) / 0.3)); if (a <= 0.01) return;
      const x = fly ? lerp(c.x, c.x2, u) : c.x, y = fly ? lerp(c.y, c.y2, u) : c.y, s = c.size * (fly ? 1 : 0.85 + 0.15 * ease.out(clamp(k / 0.3)) + 0.08 * Math.sin(k * 20));
      if (fly && u < 1) { const L = Math.hypot(c.x2 - c.x, c.y2 - c.y) * u * 0.55, an = Math.atan2(c.y2 - c.y, c.x2 - c.x); ctx.save(); ctx.translate(x, y); ctx.rotate(an); const g = ctx.createLinearGradient(-L, 0, 0, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, c.col); ctx.globalAlpha = a * 0.3; ctx.fillStyle = g; ctx.fillRect(-L, -s * 0.45, L, s * 0.9); ctx.restore(); }
      ctx.save(); ctx.translate(x, y); if (c.flip) ctx.scale(Math.max(0.25, Math.abs(Math.cos(time * 14 + (c.ph || 0)))), 1);
      ctx.globalAlpha = a * 0.2; ctx.fillStyle = c.col; shieldPath(ctx, s); ctx.fill();
      ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, s * 0.09); shieldPath(ctx, s); ctx.stroke();
      ctx.strokeStyle = c.hi || c.col; ctx.globalAlpha = a * 0.8; ctx.lineWidth = Math.max(1.5, s * 0.05); shieldPath(ctx, s * 0.72); ctx.stroke();
      ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.fillRect(-s * 0.07, -s * 0.62, s * 0.14, s * 1.15); ctx.fillRect(-s * 0.32, -s * 0.28, s * 0.64, s * 0.14);
      ctx.restore(); bloom(ctx, x, y, s * 2.2, c.col, 0.32 * a); bloom(ctx, x, y, s * 0.7, '#fff', 0.2 * a, 1);
    },
    /** A dome of light rising from the ground: a turning lattice of meridians and rings. R radius, H height. */
    cleric_dome(ctx, c, k, time) {
      const up = ease.out(clamp(k / 0.28)), a = up * ease.in(clamp((1 - k) / 0.3)), R = c.R, H = (c.H || R * 0.85) * up; if (a <= 0.01) return;
      ctx.save(); ctx.translate(c.x, c.y + 12); ctx.lineCap = 'round';
      const g = ctx.createRadialGradient(0, -H * 0.2, R * 0.1, 0, -H * 0.2, R * 1.05); g.addColorStop(0, 'rgba(255,255,255,0.02)'); g.addColorStop(0.75, c.col); g.addColorStop(1, c.col);
      ctx.globalAlpha = a * 0.08; ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, R, H, 0, Math.PI, TAU); ctx.fill();
      for (let j = 0; j < 4; j++) { const rx = R * Math.abs(Math.cos(time * 0.45 + j * Math.PI / 4)); ctx.globalAlpha = a * 0.4; ctx.strokeStyle = c.hi || c.col; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, 0, Math.max(2, rx), H, 0, Math.PI, TAU); ctx.stroke(); }
      for (let j = 1; j <= 3; j++) { const f = j / 4, r = R * Math.sqrt(1 - f * f); ctx.globalAlpha = a * 0.3; ctx.strokeStyle = c.col; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, -H * f, r, r * 0.3, 0, 0, TAU); ctx.stroke(); }
      for (const [w, col, al] of [[7, c.col, 0.35], [2.6, '#fff', 0.95]]) { ctx.globalAlpha = a * al; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.ellipse(0, 0, R, H, 0, Math.PI, TAU); ctx.stroke(); }
      ctx.globalAlpha = a * 0.7; ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.58, 0, 0, TAU); ctx.stroke();
      ctx.restore(); bloom(ctx, c.x, c.y - H * 0.55, R * 0.9, c.col, 0.14 * a); bloom(ctx, c.x, c.y + 12, R * 0.7, c.col, 0.16 * a);
    },
    /** A giant sword of light with feathered wings at the guard, plunging tip-down on (x,y). len blade length, w blade width, span wing reach. */
    cleric_sword(ctx, c, k, time) {
      const hit = c.hit ?? 0.55, fall = clamp(k / hit), post = clamp((k - hit) / (1 - hit)), L = c.len, w = c.w, dy = k < hit ? -(1 - ease.in(fall)) * c.h : 0;
      const a = k < hit ? 0.35 + 0.65 * fall : 1 - ease.in(clamp((post - 0.35) / 0.65)); if (a <= 0.01) return;
      ctx.save(); ctx.translate(c.x, c.y + dy);
      if (k < hit) { const g = ctx.createLinearGradient(0, -L - c.h * 0.6, 0, -L); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, c.col); ctx.globalAlpha = 0.45 * a * fall; ctx.fillStyle = g; ctx.fillRect(-w * 0.7, -L - c.h * 0.6, w * 1.4, c.h * 0.6); }
      for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { // feathered wing guard
        const ex = s * c.span * (1 - i * 0.13), ey = -L - 8 - i * L * 0.075, g = ctx.createLinearGradient(0, -L, ex, ey); g.addColorStop(0, '#fff'); g.addColorStop(0.6, c.hi || c.col); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = a * (0.85 - i * 0.08); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(s * w * 0.4, -L + 4); ctx.quadraticCurveTo(s * c.span * 0.55, -L + 20 - i * 6, ex, ey); ctx.quadraticCurveTo(s * c.span * 0.5, -L - 8 - i * 10, s * w * 0.4, -L - 12 - i * 5); ctx.closePath(); ctx.fill();
      }
      const blade = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.5, -L * 0.14); ctx.lineTo(w * 0.5, -L); ctx.lineTo(-w * 0.5, -L); ctx.lineTo(-w * 0.5, -L * 0.14); ctx.closePath(); };
      const gr = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, c.col); gr.addColorStop(0.5, '#fff'); gr.addColorStop(1, c.col);
      ctx.globalAlpha = a * 0.75; ctx.fillStyle = gr; blade(); ctx.fill(); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; blade(); ctx.stroke();
      ctx.globalAlpha = a * 0.9; ctx.fillStyle = '#fff'; ctx.fillRect(-w * 0.06, -L * 0.96, w * 0.12, L * 0.8); // fuller
      ctx.globalAlpha = a * 0.9; ctx.fillStyle = c.hi || c.col; ctx.fillRect(-w * 0.12, -L - L * 0.2, w * 0.24, L * 0.2); ctx.beginPath(); ctx.arc(0, -L - L * 0.22, w * 0.18, 0, TAU); ctx.fill(); ctx.fillRect(-w * 0.8, -L - 6, w * 1.6, 12); // grip, pommel, cross-guard
      ctx.restore(); bloom(ctx, c.x, c.y + dy - L * 0.5, L * 0.7, c.col, 0.4 * a); bloom(ctx, c.x, c.y + dy, w * 1.4, '#fff', 0.8 * a, 1);
      if (k >= hit) bloom(ctx, c.x, c.y, w * 3 * (1 - post * 0.5) + 30 * Math.sin(post * 9), c.col, 0.5 * (1 - post));
    },
  },
  skills: {
    smite(k) { // a hammer of light falls on the strike point: a glint cross, a pillar, a gold ring and a soft heal for the party
      const p = k.ahead(50);
      k.cleric_hammer({ x: p.x, y: p.y + 14, size: 42, h: 360, hit: 0.24, life: 0.8, col: GOLD, hi: WHITE });
      k.cleric_cross({ x: p.x, y: p.y - 24, R: 130, d: 0.18, life: 0.5, col: GOLD, hi: WHITE });
      k.ring({ x: p.x, y: p.y, R: 118, n: 2, w: 22, d: 0.18, col: GOLD });
      k.burst({ x: p.x, y: p.y - 10, n: 8, len: 140, rot: 0.2, d: 0.18, life: 0.45, col: GOLD, hi: WHITE });
      k.motes({ x: p.x, y: p.y, n: 14, type: 'pix', spd: 300, g: 380, size: 6, col: GOLD, col2: '#fff', ang: -Math.PI / 2, spread: 2.4, d: 0.19 });
      heal(k, k.x, k.y - 10, 10, 0.25); k.shake(0.3);
    },
    sanctuary(k) { // a glowing dome with a hex ward and six posts of light is raised on the spot, feathers drift up from it
      const p = pt(k, 300), R = 125;
      k.sigil({ x: p.x, y: p.y, R, n: 6, col: GOLD, hi: WHITE, b: SKY, d: 0.08, life: 2.6, hold: 0.85 });
      k.cleric_dome({ x: p.x, y: p.y, R, H: 120, col: GOLD, hi: WHITE, d: 0.1, life: 1.9 });
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.5; k.pillar({ x: p.x + Math.cos(a) * R, y: p.y + Math.sin(a) * R * 0.58, h: 190, w: 6, col: GOLD, hi: WHITE, d: 0.1 + i * 0.04, life: 0.9 }); }
      k.cleric_halo({ x: p.x, y: p.y - 40, R: 60, sq: 0.3, rise: 90, col: WHITE, hi: GOLD, d: 0.2, life: 1.3 });
      k.ring({ x: p.x, y: p.y, R: 160, n: 2, col: SKY, d: 0.1 });
      feathers(k, p.x, p.y + 10, 14, { type: 'feather', g: -45, spd: 50, R0: R * 0.8, d: 0.2 });
      k.motes({ x: p.x, y: p.y, n: 12, type: 'rune', spd: 40, g: -60, size: 8, col: SKYHI, spread: TAU, R0: R * 0.8, d: 0.2, opt: true });
    },
    shieldrush(k) { // the paladin lunges behind a golden shield: ghosts along the path, a bright wake and a shockwave at the end
      const e = k.ahead(205);
      k.cleric_shield({ x: k.x + k.ca * 24, y: k.y - 26, x2: e.x, y2: e.y - 26, size: 36, col: GOLD, hi: WHITE, life: 0.4 });
      k.ghost({ x: k.x, y: k.y, x2: e.x, y2: e.y, n: 5, size: 18, col: '#ffe9a0', hi: WHITE, life: 0.5 });
      k.streak({ x: k.x, y: k.y - 10, ang: k.ang, len: 230, w: 18, col: GOLD, hi: WHITE, d: 0.02, life: 0.32, ticks: 4 });
      k.wave({ x: e.x, y: e.y - 10, ang: k.ang, arc: 1.7, r: 170, n: 3, col: GOLD, hi: WHITE, w: 18, d: 0.17, life: 0.5 });
      k.ring({ x: e.x, y: e.y, R: 120, n: 2, w: 22, d: 0.17, col: GOLD });
      k.motes({ x: e.x, y: e.y - 10, n: 14, type: 'spark', spd: 380, g: 160, size: 6, col: GOLD, col2: '#fff', ang: k.ang, spread: 1.7, d: 0.17 });
      k.hex({ x: k.x, y: k.y, R: 70, col: SKY, hi: SKYHI, d: 0.05, life: 0.7, opt: true }); k.shake(0.3);
    },
    judgment(k) { // a beam of light comes down on the paladin and a cross, a halo and eight rays of verdict spread across the 150 px circle
      const x = k.x, y = k.y;
      k.cleric_halo({ x, y: y - 60, R: 70, sq: 0.3, rise: 110, col: WHITE, hi: GOLD, life: 0.5 });
      k.sigil({ x, y, R: 150, n: 7, col: GOLD, hi: WHITE, b: SKY, d: 0.1, life: 1.7, hold: 0.55 });
      k.beam({ x, y: y - 780, x2: x, y2: y, w: 46, col: GOLD, hi: WHITE, d: 0.36, life: 0.7 });
      k.cleric_cross({ x, y: y - 50, R: 230, d: 0.4, life: 0.6, col: GOLD, hi: WHITE });
      k.ring({ x, y, R: 170, n: 3, w: 26, d: 0.4, col: GOLD });
      for (let i = 0; i < 8; i++) k.streak({ x, y: y + 6, ang: i / 8 * TAU + 0.2, len: 190, w: 10, col: GOLD, hi: WHITE, d: 0.4 + (i % 2) * 0.04, life: 0.4, opt: true });
      k.wave({ x, y, ang: 0, arc: TAU, r: 190, n: 2, col: WHITE, hi: GOLD, w: 12, d: 0.42, life: 0.6 });
      feathers(k, x, y - 40, 14, { d: 0.42, g: -30, spd: 150 }); heal(k, x, y, 12, 0.45); k.shake(0.5);
    },
    divine_hammer(k) { // a giant hammer of light drops on a marked rune circle; a huge cross, crater cracks and a blue shield ring for the party
      const p = pt(k, 420), R = 190;
      k.sigil({ x: p.x, y: p.y, R, n: 8, col: GOLD, hi: WHITE, b: SKY, life: 1.6, hold: 0.55 });
      k.pillar({ x: p.x, y: p.y, h: 800, w: 12, col: GOLD, hi: WHITE, d: 0.05, life: 0.55 });
      k.cleric_hammer({ x: p.x, y: p.y + 16, size: 76, h: 760, hit: 0.8, life: 0.75, col: GOLD, hi: WHITE });
      k.cleric_cross({ x: p.x, y: p.y - 40, R: 340, d: 0.6, life: 0.7, col: GOLD, hi: WHITE });
      k.ring({ x: p.x, y: p.y, R: 230, n: 3, w: 32, d: 0.6, col: GOLD });
      k.crack({ x: p.x, y: p.y, R, n: 10, col: GOLD, hi: WHITE, d: 0.6 });
      k.spires({ x: p.x, y: p.y, n: 8, R: 160, R0: 40, h: 120, wd: 20, shape: 'crystal', col: GOLD, hi: WHITE, deep: DEEP, d: 0.6 });
      k.burst({ x: p.x, y: p.y - 14, n: 14, len: 280, rot: 0.15, d: 0.6, life: 0.55, col: GOLD, hi: WHITE });
      k.ring({ x: k.x, y: k.y, R: 340, n: 1, w: 18, col: SKY, d: 0.62, opt: true });
      k.motes({ x: p.x, y: p.y, n: 26, type: 'pix', spd: 420, g: 520, size: 7, col: GOLD, col2: '#fff', ang: -Math.PI / 2, spread: 2.6, d: 0.62 });
      k.kick(0.04); k.shake(0.9);
    },
  },
  basic(k, ev) { // three light mace swings: a gold arc, a blue-white shield bash wave, a heavy hammer arc that sets off a small cross
    const i = ev.idx || 0, p = k.ahead(78);
    if (i === 0) {
      k.arc({ x: k.x, y: k.y, a0: k.ang - 1.1, sw: 2.2, r: 78, w: 13, col: GOLD, hi: WHITE, d: 0.03, life: 0.3, sq: 0.9 });
      k.motes({ x: p.x, y: p.y, n: 4, type: 'pix', spd: 160, g: 120, size: 5, col: GOLD, col2: '#fff', spread: TAU, d: 0.08, life: 0.7 });
    } else if (i === 1) {
      k.wave({ x: k.x, y: k.y - 6, ang: k.ang, arc: 1.5, r: 100, n: 2, col: SKY, hi: WHITE, w: 14, d: 0.04, life: 0.35 });
      k.cleric_shield({ x: p.x, y: p.y - 20, size: 24, col: GOLD, hi: WHITE, d: 0.06, life: 0.26 });
    } else {
      k.arc({ x: k.x, y: k.y, a0: k.ang + 1.3, sw: -2.8, r: 108, w: 24, col: GOLD, hi: WHITE, d: 0.04, life: 0.36, sq: 0.9 });
      k.cleric_cross({ x: p.x + k.ca * 14, y: p.y - 14, R: 80, d: 0.13, life: 0.38, col: GOLD, hi: WHITE });
      k.ring({ x: p.x, y: p.y, R: 100, d: 0.13, col: GOLD, opt: true });
      k.motes({ x: p.x, y: p.y, n: 5, type: 'feather', spd: 120, g: -20, size: 7, col: WHITE, col2: GOLD, spread: TAU, d: 0.14, life: 1.0, opt: true });
    }
  },
  ult(k) { // Divine Ascension: a column of light, spread wings, a halo and a dome rise around the paladin and a cross opens overhead
    const x = k.x, y = k.y;
    k.pillar({ x, y, h: 950, w: 34, down: true, col: GOLD, hi: WHITE, life: 1.0 });
    k.sigil({ x, y, R: 260, n: 8, col: GOLD, hi: WHITE, b: SKY, life: 2.8, hold: 0.85 });
    k.cleric_dome({ x, y, R: 240, H: 230, col: GOLD, hi: WHITE, d: 0.1, life: 2.3 });
    k.wings({ x, y, span: 290, col: '#fff3c0', hi: '#ffffff', d: 0.15, life: 2.0 });
    k.cleric_halo({ x, y: y - 100, R: 90, sq: 0.3, rise: 80, col: WHITE, hi: GOLD, d: 0.2, life: 2.1 });
    k.cleric_cross({ x, y: y - 180, R: 260, d: 0.3, life: 0.9, col: GOLD, hi: WHITE });
    k.ring({ x, y, R: 320, n: 3, w: 30, d: 0.1, col: GOLD });
    k.burst({ x, y: y - 40, n: 16, len: 320, rot: 0.1, d: 0.12, life: 0.7, col: GOLD, hi: WHITE });
    feathers(k, x, y - 120, 34, { spd: 100, g: 30, R0: 200, d: 0.2, life: 2.4, pl: 2.0 });
    heal(k, x, y, 16, 0.3); k.kick(0.05); k.shake(0.6);
  },
  chains: {
    righteous_fury(k, s) { // Holy Hammer into Smite: a bigger hammer with a hot orange rim, a radiant crystal burst and a double (two ring) heal
      const x = s.x, y = s.y;
      k.cleric_hammer({ x, y: y + 16, size: 44, h: 520, hit: 0.4, life: 0.5, col: '#ffc045', hi: WHITE });
      k.cleric_cross({ x, y: y - 30, R: 200, d: 0.2, life: 0.6, col: GOLD, hi: WHITE });
      k.spires({ x, y, n: 7, R: 120, R0: 30, h: 150, wd: 18, shape: 'crystal', col: GOLD, hi: WHITE, deep: DEEP, d: 0.2 });
      k.burst({ x, y: y - 14, n: 12, len: 210, rot: 0.3, col: '#ff9a3a', hi: GOLD, d: 0.2, life: 0.55 });
      k.ring({ x, y, R: 170, n: 3, w: 26, d: 0.2, col: GOLD });
      k.ring({ x: k.x, y: k.y, R: 150, n: 1, col: SKY, d: 0.3 }); k.ring({ x: k.x, y: k.y, R: 230, n: 1, col: SKY, d: 0.42 });
      heal(k, k.x, k.y - 10, 16, 0.3);
    },
    bulwark(k, s) { // Shield Rush into Sanctuary: a taller blue-gold dome with a hex ward and a ring of six pillars rises around the paladin
      const x = k.x, y = k.y, R = 165;
      k.cleric_dome({ x, y, R, H: 155, col: SKY, hi: WHITE, d: 0.05, life: 1.9 });
      k.hex({ x, y, R, col: SKY, hi: SKYHI, d: 0.05, life: 2.0 });
      k.sigil({ x, y, R, n: 6, col: GOLD, hi: WHITE, b: SKY, d: 0.05, life: 2.3, hold: 0.8 });
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; k.pillar({ x: x + Math.cos(a) * R, y: y + Math.sin(a) * R * 0.58, h: 210, w: 8, col: SKY, hi: WHITE, d: 0.1 + i * 0.04, life: 0.9 }); }
      k.cleric_shield({ x, y: y - 70, size: 44, col: SKY, hi: WHITE, d: 0.1, life: 1.0 });
      k.ring({ x, y, R: 210, n: 2, col: SKY, d: 0.08 });
      k.motes({ x, y, n: 12, type: 'rune', spd: 40, g: -70, size: 8, col: SKYHI, spread: TAU, R0: R * 0.9, d: 0.2 });
    },
    final_verdict(k, s) { // Smite into Judgment: Condemn marks (small gold orbs) circle the target, are pulled in, and a single beam strikes
      const x = s.x, y = s.y;
      k.sigil({ x, y, R: 150, n: 7, col: GOLD, hi: WHITE, b: SKY, life: 1.7, hold: 0.55 });
      k.orbit({ x, y: y - 8, n: 8, R: 165, speed: 3, launch: 0.42, x2: x, y2: y - 10, size: 9, col: GOLD, hi: WHITE, life: 0.95 });
      k.beam({ x, y: y - 780, x2: x, y2: y, w: 48, col: GOLD, hi: WHITE, d: 0.58, life: 0.7 });
      k.cleric_cross({ x, y: y - 30, R: 220, d: 0.6, life: 0.6, col: GOLD, hi: WHITE });
      k.burst({ x, y: y - 10, n: 14, len: 240, d: 0.6, life: 0.5, col: GOLD, hi: WHITE });
      k.ring({ x, y, R: 190, n: 2, w: 26, d: 0.6, col: GOLD });
    },
    guardian_angel(k, s) { // Shield Rush into Smite: a white-blue angel's wings and halo open beside the paladin under a beam; feathers fall
      const x = k.x, y = k.y;
      k.pillar({ x: x + 56, y, h: 700, w: 26, down: true, col: SKY, hi: WHITE, life: 0.9 });
      k.wings({ x: x + 30, y, span: 250, col: '#d8ecff', hi: '#ffffff', d: 0.1, life: 2.0 });
      k.cleric_halo({ x: x + 30, y: y - 120, R: 46, sq: 0.3, rise: 24, col: GOLD, hi: WHITE, d: 0.15, life: 1.9 });
      k.sigil({ x, y, R: 120, n: 5, col: SKY, hi: WHITE, b: GOLD, d: 0.05, life: 1.9, hold: 0.7 });
      k.cleric_halo({ x, y: y - 30, R: 130, sq: 0.35, grow: true, col: SKYHI, hi: WHITE, d: 0.25, life: 0.8 });
      k.cleric_halo({ x, y: y - 30, R: 190, sq: 0.35, grow: true, col: SKYHI, hi: WHITE, d: 0.4, life: 0.8, opt: true });
      feathers(k, x + 30, y - 110, 24, { col: SKYHI, col2: '#fff', spd: 60, g: 40, R0: 90, d: 0.2 });
    },
    holy_nova(k, s) { // Sanctuary explodes: the circle closes in and bursts into a starburst, a halo, ring waves and eight pillars
      const x = k.x, y = k.y;
      k.sigil({ x, y, R: 175, n: 6, col: GOLD, hi: WHITE, b: SKY, life: 0.9, hold: 0.3 });
      k.flash({ x, y: y - 20, R: 330, col: GOLD, d: 0.3, life: 0.5 });
      k.burst({ x, y: y - 20, n: 20, len: 340, rot: 0.1, d: 0.3, life: 0.6, col: GOLD, hi: WHITE });
      k.cleric_halo({ x, y: y - 40, R: 250, sq: 0.38, grow: true, col: WHITE, hi: GOLD, d: 0.3, life: 0.75 });
      k.ring({ x, y, R: 270, n: 3, w: 34, d: 0.3, col: GOLD });
      k.wave({ x, y, ang: 0, arc: TAU, r: 310, n: 2, col: GOLD, hi: WHITE, w: 16, d: 0.32, life: 0.7 });
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2; k.pillar({ x: x + Math.cos(a) * 170, y: y + Math.sin(a) * 100, h: 380, w: 12, col: GOLD, hi: WHITE, d: 0.3 + i * 0.015, life: 0.7 }); }
      k.motes({ x, y: y - 10, n: 28, type: 'pix', spd: 430, g: 140, size: 6, col: GOLD, col2: '#fff', spread: TAU, d: 0.32 });
      heal(k, x, y, 18, 0.4); k.shake(0.5);
    },
    divine_storm(k, s) { // Smite, Sanctuary, Shield Rush: the shield is raised and holy lightning drops from the sky and jumps from strike to strike
      const pts = []; for (let i = 0; i < 5; i++) pts.push({ x: s.x + Math.cos(s.a0 + i * 1.9) * (50 + i * 28), y: s.y + Math.sin(s.a0 + i * 1.9) * (30 + i * 16) });
      k.cleric_shield({ x: k.x, y: k.y - 50, size: 40, col: SKY, hi: WHITE, life: 1.0 });
      pts.forEach((p, i) => {
        k.bolt({ x: p.x + 70, y: p.y - 580, x2: p.x, y2: p.y, w: 7, forks: 2, col: GOLD, hi: WHITE, d: 0.1 + i * 0.11, life: 0.45 });
        k.flash({ x: p.x, y: p.y, R: 90, col: GOLD, d: 0.12 + i * 0.11, life: 0.35 });
        k.ring({ x: p.x, y: p.y, R: 70, n: 1, col: GOLD, d: 0.12 + i * 0.11, opt: true });
        if (i < 4) k.bolt({ x: p.x, y: p.y - 10, x2: pts[i + 1].x, y2: pts[i + 1].y - 10, w: 4, forks: 1, col: SKY, hi: WHITE, d: 0.14 + i * 0.11, life: 0.35 });
      });
      heal(k, k.x, k.y - 10, 10, 0.3);
    },
    sanctified_judgment(k, s) { // Smite, Judgment, Smite: a three-point trinity sigil, three beams from three directions meeting on the target under a crown halo
      const x = s.x, y = s.y;
      k.sigil({ x, y, R: 190, n: 3, col: GOLD, hi: WHITE, b: SKY, life: 1.9, hold: 0.6 });
      for (let i = 0; i < 3; i++) {
        const a = s.a0 + i * TAU / 3, vx = x + Math.cos(a) * 190, vy = y + Math.sin(a) * 110;
        k.cleric_cross({ x: vx, y: vy - 10, R: 70, d: 0.05 + i * 0.12, life: 0.5, col: GOLD, hi: WHITE });
        k.beam({ x: x + Math.cos(a) * 330, y: y - 720, x2: x, y2: y, w: 20, col: GOLD, hi: WHITE, d: 0.2 + i * 0.14, life: 0.5 });
      }
      k.cleric_halo({ x, y: y - 40, R: 100, sq: 0.3, rise: 180, col: WHITE, hi: GOLD, d: 0.1, life: 1.5 });
      k.cleric_cross({ x, y: y - 40, R: 270, d: 0.64, life: 0.6, col: GOLD, hi: WHITE });
      k.burst({ x, y: y - 10, n: 12, len: 230, d: 0.64, life: 0.5, col: GOLD, hi: WHITE });
      k.ring({ x, y, R: 220, n: 3, w: 28, d: 0.64, col: GOLD });
    },
    aegis_throw(k, s) { // the shield is hurled and spins from enemy to enemy in a hexagon, flashing at every bounce, then flies back with a blue ward ring
      const sx = k.x, sy = k.y - 30, P = []; for (let i = 0; i < 6; i++) { const a = s.a0 + i * TAU / 6; P.push({ x: s.x + Math.cos(a) * 150, y: s.y + Math.sin(a) * 90 }); }
      const T = 0.13; let px = sx, py = sy;
      k.sigil({ x: s.x, y: s.y, R: 170, n: 6, col: GOLD, hi: WHITE, b: SKY, life: 1.3, hold: 0.9 });
      P.forEach((p, i) => {
        k.cleric_shield({ x: px, y: py, x2: p.x, y2: p.y - 24, size: 46, flip: true, ph: i, col: GOLD, hi: WHITE, d: i * T, life: 0.22 });
        k.flash({ x: p.x, y: p.y - 24, R: 100, col: GOLD, d: i * T + 0.12, life: 0.35 });
        k.motes({ x: p.x, y: p.y - 24, n: 6, type: 'spark', spd: 300, size: 5, col: GOLD, col2: '#fff', spread: TAU, d: i * T + 0.12, g: 200, opt: true });
        if (i % 2 === 0) k.ring({ x: p.x, y: p.y, R: 70, n: 1, col: GOLD, d: i * T + 0.12 });
        px = p.x; py = p.y - 24;
      });
      k.cleric_shield({ x: px, y: py, x2: k.x, y2: sy, size: 46, flip: true, ph: 7, col: SKY, hi: WHITE, d: 6 * T, life: 0.3 });
      k.hex({ x: k.x, y: k.y, R: 90, col: SKY, hi: SKYHI, d: 6 * T + 0.25, life: 0.9 });
      k.ring({ x: k.x, y: k.y, R: 150, n: 2, col: SKY, d: 6 * T + 0.25 });
    },
    absolution(k, s) { // Judgment cashes in every Condemn: crosses and pillars slam across the whole field, then a huge heal ring and falling feathers
      const x = s.x, y = s.y;
      k.sigil({ x, y, R: 280, n: 9, col: GOLD, hi: WHITE, b: SKY, life: 2.0, hold: 0.55 });
      k.cleric_halo({ x, y: y - 40, R: 240, sq: 0.34, rise: 150, grow: true, col: GOLD, hi: WHITE, life: 1.6 });
      for (let i = 0; i < 10; i++) {
        const a = s.a0 + i * 2.39996, r = 60 + (i % 5) * 52, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.55, d = 0.25 + i * 0.06;
        k.pillar({ x: px, y: py, h: 420, w: 8, col: GOLD, hi: WHITE, d, life: 0.65 });
        k.cleric_cross({ x: px, y: py - 20, R: 64, d: d + 0.03, life: 0.45, col: GOLD, hi: WHITE });
      }
      k.ring({ x, y, R: 500, n: 2, w: 28, col: SKY, d: 0.9 });
      k.wave({ x, y, ang: 0, arc: TAU, r: 540, n: 2, col: SKY, hi: WHITE, w: 14, d: 0.92, life: 0.8 });
      feathers(k, x, y - 250, 34, { R0: 260, spd: 60, g: 55, d: 0.8, life: 2.4, pl: 2.0 });
      heal(k, x, y, 20, 0.95); k.shake(0.6);
    },
    crusaders_verdict(k, s) { // a crusader's charge ends in a huge cross of light laid on the ground along the aim, with pillars at its five points
      const x = s.x, y = s.y, ca = Math.cos(k.ang), sa = Math.sin(k.ang), L = 230, T = 140;
      k.cleric_shield({ x: k.x + ca * 24, y: k.y - 26, x2: x, y2: y - 26, size: 38, col: GOLD, hi: WHITE, life: 0.4 });
      k.ghost({ x: k.x, y: k.y, x2: x, y2: y, n: 5, size: 18, col: '#ffe9a0', hi: WHITE, life: 0.5 });
      k.sigil({ x, y, R: 200, n: 4, col: GOLD, hi: WHITE, b: WARM, d: 0.25, life: 1.8, hold: 0.6 });
      k.streak({ x: x - ca * L, y: y - sa * L * 0.6, ang: Math.atan2(sa * 0.6, ca), len: L * 2.1, w: 18, col: GOLD, hi: WHITE, d: 0.3, life: 0.6 });
      k.streak({ x: x + sa * T, y: y - ca * T * 0.6, ang: Math.atan2(-ca * 0.6, sa) + Math.PI, len: T * 2, w: 14, col: GOLD, hi: WHITE, d: 0.38, life: 0.55 });
      for (const [px, py, h, w, d] of [[x - ca * L, y - sa * L * 0.6, 240, 9, 0.34], [x + ca * L, y + sa * L * 0.6, 240, 9, 0.36], [x + sa * T, y - ca * T * 0.6, 240, 9, 0.4], [x - sa * T, y + ca * T * 0.6, 240, 9, 0.42]]) k.pillar({ x: px, y: py, h, w, col: GOLD, hi: WHITE, d, life: 0.7 });
      k.pillar({ x, y, h: 760, w: 32, col: GOLD, hi: WHITE, d: 0.45, life: 0.8 });
      k.cleric_cross({ x, y: y - 40, R: 300, rot: k.ang, d: 0.45, life: 0.7, col: GOLD, hi: WHITE });
      k.ring({ x, y, R: 240, n: 3, w: 28, d: 0.45, col: GOLD });
      k.burst({ x, y: y - 14, n: 14, len: 270, d: 0.45, life: 0.5, col: GOLD, hi: WHITE }); k.shake(0.5);
    },
    hallowed_ground(k, s) { // the field is consecrated for good: two big circles, a golden dome, glowing cracks, crystal spires and a hammer that sets it all off
      const x = s.x, y = s.y;
      k.sigil({ x, y, R: 340, n: 8, col: GOLD, hi: WHITE, b: SKY, life: 3.0, hold: 0.85 });
      k.sigil({ x, y, R: 210, n: 6, col: SKY, hi: WHITE, b: GOLD, d: 0.1, life: 2.8, hold: 0.85 });
      k.cleric_dome({ x, y, R: 320, H: 270, col: GOLD, hi: WHITE, d: 0.2, life: 2.4 });
      k.cleric_hammer({ x, y: y + 16, size: 70, h: 640, hit: 0.45, life: 0.8, d: 0.15, col: GOLD, hi: WHITE });
      k.cleric_cross({ x, y: y - 40, R: 320, d: 0.51, life: 0.7, col: GOLD, hi: WHITE });
      k.ring({ x, y, R: 360, n: 3, w: 34, d: 0.51, col: GOLD });
      k.crack({ x, y, R: 310, n: 12, col: GOLD, hi: WHITE, d: 0.5, life: 2.0 });
      k.spires({ x, y, n: 16, R: 300, R0: 60, h: 140, wd: 14, shape: 'crystal', col: GOLD, hi: WHITE, deep: DEEP, d: 0.5, life: 1.8 });
      k.pillar({ x, y, h: 800, w: 40, col: GOLD, hi: WHITE, d: 0.5, life: 0.8 });
      k.motes({ x, y, n: 36, type: 'pix', spd: 80, g: -70, size: 6, col: GOLD, col2: '#fff', spread: TAU, R0: 280, d: 0.55, life: 2.3, pl: 1.9 });
      feathers(k, x, y - 120, 22, { R0: 250, spd: 50, g: 45, d: 0.6, life: 2.4, pl: 2.0 }); k.kick(0.04); k.shake(0.7);
    },
    hammer_of_dawn(k, s) { // a warm dawn rises behind the target (orange rays and a sun halo), then a huge hammer lands in a pillar of sunrise
      const x = s.x, y = s.y, DAWN = '#ff9a4a', DAWNHI = '#ffe3b4';
      k.flash({ x, y: y - 150, R: 560, col: DAWN, life: 1.1 });
      k.burst({ x, y: y - 150, n: 24, len: 600, rot: 0.05, col: DAWN, hi: DAWNHI, d: 0.08, life: 1.1 });
      k.cleric_halo({ x, y: y - 150, R: 140, sq: 1, col: DAWN, hi: DAWNHI, life: 1.3 });
      k.sigil({ x, y, R: 280, n: 7, col: GOLD, hi: WHITE, b: DAWN, d: 0.1, life: 2.0, hold: 0.6 });
      k.cleric_hammer({ x, y: y + 16, size: 90, h: 800, hit: 0.5, life: 0.95, d: 0.3, col: GOLD, hi: WHITE });
      k.pillar({ x, y, h: 900, w: 66, down: true, col: DAWN, hi: DAWNHI, d: 0.78, life: 0.8 });
      k.cleric_cross({ x, y: y - 50, R: 400, d: 0.78, life: 0.8, col: DAWN, hi: WHITE });
      k.ring({ x, y, R: 380, n: 3, w: 36, d: 0.78, col: DAWN });
      k.crack({ x, y, R: 290, n: 10, col: DAWN, hi: DAWNHI, d: 0.78 });
      k.spires({ x, y, n: 10, R: 220, R0: 40, h: 200, wd: 20, shape: 'crystal', col: GOLD, hi: WHITE, deep: DEEP, d: 0.78 });
      k.motes({ x, y, n: 36, type: 'ember', spd: 200, g: -110, size: 6, col: DAWN, col2: '#fff3c0', ang: -Math.PI / 2, spread: 2.6, R0: 170, d: 0.8 });
      k.kick(0.05); k.shake(0.9);
    },
    rapture(k, s) { // Rapture: huge wings and a halo open over the paladin while 14 pillars of light slam down across the field, then a big heal ring and falling feathers
      const x = k.x, y = k.y;
      k.wings({ x, y, span: 340, col: '#fff3c0', hi: '#ffffff', life: 2.4 });
      k.cleric_halo({ x, y: y - 110, R: 90, sq: 0.3, rise: 90, col: WHITE, hi: GOLD, life: 2.3 });
      k.sigil({ x, y, R: 340, n: 9, col: GOLD, hi: WHITE, b: SKY, life: 2.8, hold: 0.8 });
      for (let i = 0; i < 14; i++) {
        const a = s.a0 + i * 2.39996, r = 70 + 240 * Math.sqrt(i / 13), px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.6, d = 0.4 + i * 0.07;
        k.pillar({ x: px, y: py, h: 540, w: 17, col: GOLD, hi: WHITE, d, life: 0.8 });
        if (i % 2 === 0) k.ring({ x: px, y: py, R: 80, n: 1, w: 16, d: d + 0.1, col: GOLD, opt: true });
      }
      k.flash({ x, y: y - 40, R: 450, col: WHITE, d: 1.4, life: 0.5 });
      k.ring({ x, y, R: 560, n: 3, w: 30, d: 1.4, col: SKY });
      k.burst({ x, y: y - 40, n: 18, len: 400, d: 1.4, life: 0.7, col: GOLD, hi: WHITE });
      feathers(k, x, y - 260, 40, { R0: 300, spd: 70, g: 60, d: 0.6, life: 2.6, pl: 2.2 });
      heal(k, x, y, 24, 1.4); k.kick(0.05);
    },
    heavens_judgment(k, s) { // Heaven's Judgment: a feather-winged sword of light plunges into the target; a huge cross, rings, cracks and a rising pillar follow
      const x = s.x, y = s.y;
      k.sigil({ x, y, R: 280, n: 7, col: GOLD, hi: WHITE, b: SKY, life: 2.2, hold: 0.6 });
      k.cleric_halo({ x, y: y - 40, R: 150, sq: 0.32, rise: 260, grow: true, col: WHITE, hi: GOLD, life: 1.4 });
      k.cleric_sword({ x, y, len: 520, w: 70, span: 250, h: 900, hit: 0.6, life: 1.4, col: GOLD, hi: WHITE });
      k.pillar({ x, y, h: 1000, w: 90, down: true, col: GOLD, hi: WHITE, d: 0.84, life: 0.7 });
      k.cleric_cross({ x, y: y - 60, R: 520, d: 0.84, life: 0.9, col: GOLD, hi: WHITE });
      k.flash({ x, y: y - 20, R: 520, col: WHITE, d: 0.84, life: 0.5 });
      k.ring({ x, y, R: 440, n: 3, w: 36, d: 0.84, col: GOLD });
      k.crack({ x, y, R: 300, n: 12, col: GOLD, hi: WHITE, d: 0.84 });
      k.burst({ x, y: y - 20, n: 20, len: 540, d: 0.84, life: 0.7, col: GOLD, hi: WHITE });
      feathers(k, x, y - 120, 30, { R0: 120, spd: 220, g: 60, d: 0.86, life: 2.0 }); k.kick(0.06); k.shake(1.0);
    },
  },
  routes: {
    rapture: { title: 'RAPTURE', sub: 'LIGHT FROM ABOVE  ·  PACK FINISHER', sfx: 'リィィィン', kanji: '聖', seal: '光', rot: -0.06 },
    heavens_judgment: { title: "HEAVEN'S JUDGMENT", sub: 'THE SWORD OF DAWN  ·  BOSS FINISHER', sfx: 'ズバァァァン', kanji: '裁', seal: '天', rot: 0.07 },
  },
  notes: {
    smite: 'A glowing hammer of light falls on the strike point, followed by a gold cross glint, a thin pillar and a ring, while soft sparkles rise from the paladin as the heal.',
    sanctuary: 'A golden dome with a turning lattice rises over the circle with a blue hex ward, six posts of light, a floating halo and feathers drifting up.',
    shieldrush: 'A golden shield flies ahead with a bright wake and ghost trails, and a fan of gold shockwaves and sparks bursts out where the rush ends.',
    judgment: 'A halo gathers over the paladin, a beam of light comes down, and a big cross, eight rays and gold rings spread across the circle with falling feathers.',
    divine_hammer: 'A rune circle and a column mark the spot, then a giant hammer of light drops in with a huge cross, crater cracks, crystal spikes and a blue shield ring around the party.',
    basic: 'The first swing leaves a gold arc, the shield bash a blue-white shockwave with a small shield glint, and the heavy hammer a wide arc that pops a cross glint and a few feathers.',
    ascension: 'A column of light, spread wings, a halo and a golden dome rise around the paladin over a big rune circle, with a cross glint overhead and feathers falling.',
    righteous_fury: 'A bigger hammer with a hot orange rim lands in a crystal burst and a large cross, and two blue heal rings spread out from the paladin.',
    bulwark: 'A blue and gold dome with a hex ward and six pillars rises around the paladin, with a shield glowing in the middle.',
    final_verdict: 'Eight gold marks circle the target and get pulled into the centre, then a single beam of light strikes with a cross and a starburst.',
    guardian_angel: 'A white-blue angel appears in a beam beside the paladin with spread wings and a halo, expanding halo rings, and feathers falling.',
    holy_nova: 'The rune circle closes in, then bursts into a gold starburst with a huge halo, ring waves and eight pillars of light, and sparkles heal the party.',
    divine_storm: 'The paladin raises a blue shield while five gold lightning bolts drop from the sky and arc from one strike to the next.',
    sanctified_judgment: 'A three-pointed rune circle with three small crosses; three beams from three directions meet on the target under a crown halo, ending in a big cross.',
    aegis_throw: 'A gold shield spins from point to point around the target in a hexagon with a flash at each bounce, then flies back and raises a blue ward ring.',
    absolution: 'A big halo over a nine-point rune circle, ten pillars with small crosses slam down across the field, then a huge blue-white heal ring and feathers spread out.',
    crusaders_verdict: 'The paladin charges behind a shield and a giant cross of light is laid on the ground along the aim with a pillar at each point and a tall one in the middle.',
    hallowed_ground: 'Two big rune circles, a golden dome, cracked glowing ground, crystal spikes and a huge hammer consecrate the whole field with rising sparks and feathers.',
    hammer_of_dawn: 'A warm orange sunrise of rays and a sun halo rises behind the target, then a giant hammer lands in a pillar of dawn light with a cross, cracks and crystals.',
    rapture: 'Huge wings and a halo open over the paladin as fourteen pillars of light slam down across the field one after another, then a big blue heal ring and feathers.',
    heavens_judgment: 'A giant sword of light with feathered wings at the guard falls into the target, followed by a huge cross, shock rings, cracks and a rising pillar of light.',
  },
};
