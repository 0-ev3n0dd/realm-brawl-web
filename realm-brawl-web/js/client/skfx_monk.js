// Monk: gold chi + amber with white-hot cores. Tiger = a three-claw rake, Crane = wing fans and a rising kick arc, Dragon = a serpent ribbon,
// Flow = water-like flowing strands, Iron Palm = a glowing palm print, pressure points = four-point glints, fists = bursts of small rings.
// Chains stack those animal spirits: each one is built by hand so none of the twelve share a silhouette.
import { TAU, clamp, lerp, seeded } from './fxsk_core.js';
import { bloom, ease } from './fxglow.js';

const G = '#ffd23f', AM = '#ff9a2c', OR = '#ff7a1a', EM = '#ff5a1a', HI = '#fff6d8', CR = '#ffe7a8';

// ------------------------------------------------------------------ local drawing helpers
function band(ctx, pts, w0, w1) { // a tapered ribbon along a polyline
  const n = pts.length; if (n < 2) return;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, w = lerp(w0, w1, i / (n - 1)) / 2;
    L.push([pts[i][0] - dy / d * w, pts[i][1] + dx / d * w]); R.push([pts[i][0] + dy / d * w, pts[i][1] - dx / d * w]);
  }
  ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]); for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]); ctx.closePath(); ctx.fill();
}
function glowBand(ctx, pts, w, col, hi, a) { // wide colour, narrower highlight, white core
  ctx.globalAlpha = a * 0.4; ctx.fillStyle = col; band(ctx, pts, w * 0.2, w * 2.2);
  ctx.globalAlpha = a * 0.8; ctx.fillStyle = hi || col; band(ctx, pts, w * 0.1, w * 1.0);
  ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; band(ctx, pts, w * 0.05, w * 0.36);
}
function star4(ctx, x, y, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const an = rot + i * Math.PI / 4, rr = i % 2 ? r * 0.2 : r; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
  ctx.closePath(); ctx.fill();
}

// ------------------------------------------------------------------ the Monk's own pieces
const prims = {
  /** Tiger claw: n parallel curved rakes (the middle one longest). x,y start, ang, len, gap, bend, w. */
  monk_claw(ctx, c, k) {
    const ca = Math.cos(c.ang), sa = Math.sin(c.ang), n = c.n || 3, mid = (n - 1) / 2;
    for (let j = 0; j < n; j++) {
      const kk = clamp((k - j * 0.045) / (1 - j * 0.045)), head = ease.out(clamp(kk / 0.32)), tail = ease.in(clamp((kk - 0.1) / 0.9)), a = 1 - ease.in(clamp((kk - 0.45) / 0.55));
      const off = (j - mid) * c.gap, L = c.len * (1 - 0.13 * Math.abs(j - mid)), pts = [];
      for (let i = 0; i <= 12; i++) { const u = lerp(tail, head, i / 12), al = u * L, bd = Math.sin(u * Math.PI) * (c.bend || 0) + off; pts.push([c.x + ca * al - sa * bd, c.y + sa * al + ca * bd]); }
      glowBand(ctx, pts, c.w, c.col, c.hi, a);
      const e = pts[12]; bloom(ctx, e[0], e[1], c.w * 2.6, c.hi || c.col, 0.7 * a);
    }
  },
  /** Rapid-fire fist impacts: n small rings popping one after another inside radius R. */
  monk_pulse(ctx, c, k) {
    const R = seeded(c.seed), n = c.n || 8;
    for (let i = 0; i < n; i++) {
      const px = c.x + (R() - 0.5) * 2 * c.R, py = c.y + (R() - 0.5) * 1.3 * c.R, s0 = (i / n) * 0.62 + R() * 0.04, u = clamp((k - s0) / 0.3);
      if (u <= 0 || u >= 1) continue;
      const rr = c.size * (0.4 + 0.9 * ease.out(u)), a = 1 - u;
      ctx.strokeStyle = c.col; ctx.globalAlpha = a; ctx.lineWidth = 3.2 * a + 1; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.globalAlpha = a * 0.8; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(px, py, rr * 0.62, 0, TAU); ctx.stroke();
      if (u < 0.4) { ctx.globalAlpha = 1 - u / 0.4; ctx.fillStyle = '#fff'; star4(ctx, px, py, c.size * 0.55, i); }
      bloom(ctx, px, py, c.size * 1.7, c.hi || c.col, 0.55 * a);
    }
  },
  /** Pressure-point glints: four-point twinkles with a lens cross and a tiny ring, one after another. */
  monk_glint(ctx, c, k) {
    const R = seeded(c.seed), n = c.n || 5;
    for (let i = 0; i < n; i++) {
      const an = R() * TAU, rr = c.R * (0.3 + 0.7 * Math.sqrt(R())), px = c.x + Math.cos(an) * rr, py = c.y + Math.sin(an) * rr * 0.62 - (c.lift || 0), s0 = (i / n) * 0.5, u = clamp((k - s0) / 0.45);
      if (u <= 0 || u >= 1) continue;
      const pop = Math.sin(u * Math.PI), L = (c.size || 30) * pop, a = pop;
      ctx.strokeStyle = c.hi || '#fff'; ctx.lineCap = 'round'; ctx.globalAlpha = a * 0.9; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px - L * 1.5, py); ctx.lineTo(px + L * 1.5, py); ctx.moveTo(px, py - L * 1.5); ctx.lineTo(px, py + L * 1.5); ctx.stroke();
      ctx.globalAlpha = a; ctx.fillStyle = '#fff'; star4(ctx, px, py, L * 0.8, Math.PI / 4);
      ctx.fillStyle = c.col; ctx.globalAlpha = a * 0.8; star4(ctx, px, py, L * 1.1, 0);
      ctx.strokeStyle = c.col; ctx.globalAlpha = a * 0.6; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(px, py, L * (0.6 + u), 0, TAU); ctx.stroke();
      bloom(ctx, px, py, L * 2.2, c.col, 0.6 * a);
    }
  },
  /** Flowing water-like strands: along a line (len, amp, gap) or spiralling round a centre (orbit, R, sw, sq). */
  monk_stream(ctx, c, k, time) {
    const n = c.n || 3, hd = ease.out(clamp(k / 0.45)), tl = ease.in(clamp((k - 0.35) / 0.65)), a = ease.in(clamp((1 - k) / 0.3)), ca = Math.cos(c.ang || 0), sa = Math.sin(c.ang || 0);
    for (let j = 0; j < n; j++) {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const u = lerp(tl, hd, i / 24);
        if (c.orbit) {
          const an = (c.a0 || 0) + j / n * TAU + u * (c.sw || 5) * (c.dir || 1), rr = c.R * (0.55 + 0.45 * u) * (1 + 0.1 * Math.sin(u * 10 + j * 2 + time * 7));
          pts.push([c.x + Math.cos(an) * rr, c.y + Math.sin(an) * rr * (c.sq || 0.5) - (c.lift || 0) * u]);
        } else {
          const al = u * c.len, off = Math.sin(al * (c.freq || 0.025) + j * 1.9 - time * (c.speed || 8)) * c.amp * Math.pow(Math.sin(u * Math.PI), 0.6) + (j - (n - 1) / 2) * (c.gap || 14);
          pts.push([c.x + ca * al - sa * off, c.y + sa * al + ca * off]);
        }
      }
      glowBand(ctx, pts, c.w || 8, c.col, c.hi, a * 0.9);
    }
  },
  /** Crane wings: two fans of curved feathers spreading to the sides of ang from (x,y). */
  monk_wing(ctx, c, k) {
    const sp = ease.out(clamp(k / 0.3)), a = ease.in(clamp((1 - k) / 0.45)), F = c.n || 6;
    for (const s of [-1, 1]) for (let i = 0; i < F; i++) {
      const u = i / (F - 1), an = c.ang + s * (Math.PI / 2 - 0.55 + u * 1.15) * (0.55 + 0.45 * sp), L = c.span * (0.55 + 0.45 * (1 - Math.abs(u - 0.55) * 1.2)) * sp, pts = [];
      for (let j = 0; j <= 10; j++) { const t = j / 10, al = L * t, bd = -s * L * 0.16 * t * t; pts.push([c.x + Math.cos(an) * al - Math.sin(an) * bd, c.y - (c.lift || 0) + (Math.sin(an) * al + Math.cos(an) * bd) * (c.sq || 0.8)]); }
      glowBand(ctx, pts, c.span * 0.07, c.col, c.hi, a * (0.95 - u * 0.2));
    }
    bloom(ctx, c.x, c.y - (c.lift || 0), c.span * 0.5, c.col, 0.35 * a);
  },
  /** A glowing palm print slammed down; fingers point along ang. size = hand length. */
  monk_palm(ctx, c, k) {
    const inK = ease.out(clamp(k / 0.2)), a = (1 - ease.in(clamp((k - 0.35) / 0.65))) * inK, s = c.size * (1 + 0.5 * (1 - inK));
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.ang || 0); ctx.lineCap = 'round';
    ctx.globalAlpha = a * 0.28; ctx.fillStyle = c.col; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.36, s * 0.4, 0, 0, TAU); ctx.fill();
    const F = [[-0.26, 0.4], [-0.09, 0.52], [0.09, 0.48], [0.26, 0.36]], T = [[0.05, -0.36], [0.22, -0.72]];
    for (const [w, col, al] of [[0.2, c.col, 0.3], [0.11, c.hi || c.col, 0.65], [0.04, '#fff', 1]]) {
      ctx.strokeStyle = col; ctx.globalAlpha = a * al; ctx.lineWidth = s * w;
      ctx.beginPath(); for (const [y0, L] of F) { ctx.moveTo(s * 0.3, s * y0); ctx.lineTo(s * (0.3 + L), s * y0 * 1.18); } ctx.moveTo(s * T[0][0], s * T[0][1] * 0.8); ctx.lineTo(s * T[1][0] * 1.3, s * T[1][1]); ctx.stroke();
    }
    ctx.restore(); bloom(ctx, c.x, c.y, s * 0.8, c.col, 0.5 * a); bloom(ctx, c.x, c.y, s * 0.3, '#fff', 0.5 * a, 1);
  },
};

// ------------------------------------------------------------------ helpers for recipes
const aimTo = (k, s) => Math.atan2(s.y - k.y, s.x - k.x);
const polar = (x, y, a, d, sq = 0.6) => ({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * sq });

export default {
  pal: { a: '#ffd23f', b: '#ff9a2c', hi: '#fff6d8', deep: '#2a1600', ink: '#140a00', edge: '#fff0b0' },
  prims,
  skills: {
    tiger_fist(k) { // three tiger-claw rakes cross the cone, then a rattle of small rings where the fists land
      const rake = (side, ang, d, len, bend, gap) => { const p = k.ahead(8, side); k.monk_claw({ x: p.x, y: p.y, ang: k.ang + ang, len, gap, w: 8, bend, col: AM, hi: HI, d, life: 0.42 }); };
      rake(-50, 0.34, 0.03, 150, -30, 16); rake(50, -0.34, 0.1, 150, 30, 16); rake(0, 0, 0.17, 178, 0, 20);
      const h = k.ahead(98);
      k.monk_pulse({ x: h.x, y: h.y, R: 46, n: 9, size: 24, col: G, hi: HI, d: 0.06, life: 0.55 });
      k.motes({ x: h.x, y: h.y, n: 12, type: 'spark', spd: 360, size: 5, col: AM, col2: '#fff', ang: k.ang, spread: 1.6, d: 0.1, g: 200, opt: true });
      k.flash({ x: h.x, y: h.y, R: 70, col: AM, d: 0.18 }); k.shake(0.12);
    },
    crane_kick(k) { // a dash with after-images, then wing fans open and a tall rising crescent marks the launch kick
      const L = k.ahead(130);
      k.ghost({ x: k.x, y: k.y, x2: L.x, y2: L.y, n: 4, size: 14, col: CR, hi: HI, life: 0.5 });
      k.monk_wing({ x: L.x, y: L.y, ang: k.ang, span: 175, col: AM, hi: CR, lift: 26, d: 0.1, life: 0.6 });
      k.arc({ x: L.x, y: L.y - 10, a0: Math.PI * 0.82, sw: 5.2, r: 118, w: 20, col: G, hi: '#fff', sq: 0.55, d: 0.1, life: 0.45 });
      k.arc({ x: L.x, y: L.y - 20, a0: -2.5, sw: 2.0, r: 70, w: 18, col: HI, hi: '#fff', sq: 1.9, d: 0.16, life: 0.45 });
      k.ring({ x: L.x, y: L.y, R: 135, col: CR, d: 0.12 });
      k.motes({ x: L.x, y: L.y - 20, n: 14, type: 'feather', spd: 150, g: -60, size: 8, col: HI, col2: G, ang: -Math.PI / 2, spread: 2.4, d: 0.14, life: 1.1 });
    },
    flow_state(k) { // a water-like shell: two opposed rivers of gold spiral round the monk, a calm sigil under the feet
      k.monk_stream({ x: k.x, y: k.y, orbit: true, R: 150, n: 3, sw: 5.2, sq: 0.5, w: 11, col: G, hi: HI, a0: 0.4, life: 0.9, lift: 40 });
      k.monk_stream({ x: k.x, y: k.y, orbit: true, R: 105, n: 2, sw: 5.2, dir: -1, sq: 0.5, w: 8, col: CR, hi: '#fff', a0: 2, d: 0.08, life: 0.85, lift: 30 });
      k.sigil({ x: k.x, y: k.y, R: 135, n: 8, col: CR, hi: HI, b: G, life: 1.3, hold: 0.7 });
      k.ring({ x: k.x, y: k.y, R: 150, col: HI, d: 0.1, n: 2, w: 14 });
      k.motes({ x: k.x, y: k.y, n: 18, type: 'pix', spd: 90, g: -90, size: 5, col: G, col2: '#fff', spread: TAU, R0: 110, life: 1.3, opt: true });
    },
    iron_palm(k) { // a step in behind a thrust of light; a glowing palm print lands, a shock cone rolls out and pressure points glint
      const P = k.ahead(86);
      k.streak({ x: k.x, y: k.y, ang: k.ang, len: 140, w: 24, col: OR, hi: HI, d: 0.03, life: 0.3, ticks: 4 });
      k.monk_palm({ x: P.x, y: P.y, ang: k.ang, size: 120, col: AM, hi: HI, d: 0.09, life: 0.6 });
      k.wave({ x: k.x, y: k.y, ang: k.ang, arc: 1.1, r: 150, n: 3, w: 16, col: OR, hi: HI, d: 0.1, life: 0.55 });
      k.monk_glint({ x: P.x, y: P.y, R: 52, n: 3, size: 24, col: G, hi: '#fff', d: 0.2, life: 0.55 });
      k.motes({ x: P.x, y: P.y, n: 14, type: 'spark', spd: 380, size: 5, col: OR, col2: '#fff', ang: k.ang, spread: 1.3, d: 0.1, g: 260 });
      k.shake(0.2);
    },
    dragons_descent(k) { // a chi dragon carries the leap in an arc, then coils round the crash site in a pillar and cracked ground
      const far = k.dist > 400, L = far ? k.ahead(400) : { x: k.tx, y: k.ty }, an = Math.atan2(L.y - k.y, L.x - k.x), d0 = Math.hypot(L.x - k.x, L.y - k.y);
      k.serpent({ x: k.x, y: k.y, ang: an, len: d0, amp: 30, freq: 0.014, w: 20, col: OR, hi: HI, life: 0.55 });
      k.serpent({ x: k.x, y: k.y - 14, ang: an, len: d0, amp: 22, freq: 0.014, w: 11, col: G, hi: '#fff', d: 0.04, life: 0.5, speed: -8 });
      k.ghost({ x: k.x, y: k.y, x2: L.x, y2: L.y, n: 5, size: 14, col: G, hi: HI, life: 0.55 });
      k.swirl({ x: L.x, y: L.y + 18, R: 150, h: 320, arms: 2, col: OR, hi: HI, spin: 7, w: 14, d: 0.38, life: 1.0 });
      k.pillar({ x: L.x, y: L.y, h: 500, w: 24, col: G, hi: HI, d: 0.38, life: 0.8 });
      k.crack({ x: L.x, y: L.y, R: 200, n: 9, col: OR, hi: HI, d: 0.38 });
      k.ring({ x: L.x, y: L.y, R: 225, n: 3, w: 26, col: G, d: 0.38 });
      k.burst({ x: L.x, y: L.y - 20, n: 12, len: 220, col: G, hi: HI, d: 0.38 });
      k.motes({ x: L.x, y: L.y, n: 26, type: 'pix', spd: 420, g: 520, size: 6, col: G, col2: '#fff', ang: -Math.PI / 2, spread: 2.6, d: 0.4 });
      k.shake(0.8); k.kick(0.05);
    },
  },
  basic(k, ev) { // light: jab and cross leave a short thrust and a rattle of rings; the palm strike prints a small palm
    const idx = ev.idx || 0;
    if (idx < 2) { const side = idx % 2 ? -12 : 12, h = k.ahead(78, side); k.streak({ x: k.x, y: k.y, ang: k.ang, len: 95, w: 8, col: G, hi: HI, d: 0.02, life: 0.22 }); k.monk_pulse({ x: h.x, y: h.y, R: 14, n: 3, size: 17, col: AM, hi: HI, d: 0.04, life: 0.3 }); }
    else { const h = k.ahead(90); k.monk_palm({ x: h.x, y: h.y, ang: k.ang, size: 70, col: AM, hi: HI, d: 0.05, life: 0.4 }); k.ring({ x: h.x, y: h.y, R: 100, col: G, d: 0.1 }); k.motes({ x: h.x, y: h.y, n: 8, type: 'spark', spd: 300, size: 5, col: G, spread: 1.6, ang: k.ang, d: 0.1, g: 240 }); }
  },
  ult(k) { // Awakened Spirit: tiger claws, crane wings and a dragon spiral arrive together over a double sigil; the ground rings under the slam
    const x = k.x, y = k.y;
    k.sigil({ x, y, R: 270, n: 8, col: G, hi: HI, b: OR, life: 2.2, hold: 0.82 });
    k.sigil({ x, y, R: 170, n: 5, col: AM, hi: '#fff', b: G, spin: -1.5, d: 0.1, life: 1.9, hold: 0.8 });
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU - Math.PI / 2, p = polar(x, y, a, 300, 0.6); k.monk_claw({ x: p.x, y: p.y - 20, ang: a + Math.PI - (i === 0 ? 0.1 : 0), len: 260, gap: 22, w: 11, bend: i % 2 ? 26 : -26, col: AM, hi: HI, d: 0.18 + i * 0.06, life: 0.5 }); }
    k.monk_wing({ x, y, ang: -Math.PI / 2, span: 280, col: CR, hi: HI, lift: 50, d: 0.3, life: 0.9 });
    k.swirl({ x, y: y + 20, R: 200, h: 430, arms: 3, col: G, hi: HI, spin: 8, w: 13, d: 0.3, life: 1.1 });
    k.pillar({ x, y, h: 600, w: 30, col: G, hi: HI, d: 0.42, life: 0.9 });
    k.ring({ x, y, R: 250, n: 3, w: 30, col: OR, d: 0.42 });
    k.monk_pulse({ x, y, R: 190, n: 14, size: 30, col: G, hi: HI, d: 0.42, life: 0.8 });
    k.burst({ x, y: y - 20, n: 14, len: 280, col: G, hi: HI, d: 0.42 });
    k.motes({ x, y, n: 30, type: 'feather', spd: 200, g: -50, size: 9, col: HI, col2: G, ang: -Math.PI / 2, spread: 2.8, d: 0.44, life: 1.5 });
    k.kick(0.06); k.shake(1.0);
  },
  chains: {
    dragon_sweep(k, s) { // a driving palm thrust, then a dragon ribbon whirls round the monk as a low spinning kick
      const x = k.x, y = k.y;
      k.streak({ x, y, ang: k.ang, len: 175, w: 22, col: OR, hi: HI, d: 0.02, life: 0.3, ticks: 4 });
      k.monk_stream({ x, y, orbit: true, R: 150, n: 3, sw: 5.5, sq: 0.5, w: 13, col: G, hi: HI, a0: s.a0, d: 0.12, life: 0.7 });
      k.monk_stream({ x, y, orbit: true, R: 105, n: 2, sw: 5.5, dir: -1, sq: 0.5, w: 9, col: OR, hi: '#fff', a0: s.a0 + 1, d: 0.16, life: 0.6 });
      k.arc({ x, y, a0: s.a0, sw: 5.6, r: 148, w: 24, col: OR, hi: '#fff', d: 0.14, sq: 0.6 });
      k.ring({ x, y, R: 170, col: G, d: 0.14 });
      k.motes({ x, y, n: 14, type: 'ember', spd: 260, g: 120, size: 5, col: OR, col2: '#fff', spread: TAU, d: 0.16 });
    },
    shockwave_palm(k, s) { // a palm print at the front of the cone, wave bands roll 300 px out, pressure points glint at the far end
      const a = k.ang, P = k.ahead(56), F = k.ahead(220);
      k.monk_palm({ x: P.x, y: P.y, ang: a, size: 115, col: AM, hi: HI, d: 0.04, life: 0.6 });
      k.wave({ x: k.x, y: k.y, ang: a, arc: 1.25, r: 310, n: 4, w: 14, col: G, hi: '#fff', d: 0.1, life: 0.8 });
      k.monk_glint({ x: F.x, y: F.y, R: 90, n: 5, size: 26, col: G, hi: '#fff', d: 0.24, life: 0.6 });
      k.ring({ x: F.x, y: F.y, R: 110, col: OR, d: 0.28 });
      k.motes({ x: F.x, y: F.y, n: 14, type: 'spark', spd: 340, g: 160, size: 5, col: AM, col2: '#fff', ang: a, spread: 1.4, d: 0.26 });
    },
    rapid_strikes(k, s) { // six jabs from alternating sides land as a drumroll of small rings with twinkling pressure points
      const a = aimTo(k, s);
      for (let i = 0; i < 6; i++) { const sd = i % 2 ? 1 : -1, an = a + sd * 0.45; k.streak({ x: s.x - Math.cos(an) * 150, y: s.y - Math.sin(an) * 150 - 20, ang: an, len: 150, w: 7, col: i % 2 ? G : AM, hi: '#fff', d: i * 0.07, life: 0.28, ticks: 2 }); }
      k.monk_pulse({ x: s.x, y: s.y - 20, R: 42, n: 14, size: 26, col: G, hi: HI, d: 0.05, life: 0.9 });
      k.monk_glint({ x: s.x, y: s.y - 10, R: 60, n: 4, size: 24, col: AM, hi: '#fff', d: 0.35, life: 0.5 });
    },
    nerve_strike(k, s) { // a dash in, nerve lines of lightning run out of the strike through the body ending in glints, a pale slow ring, a flip away
      const a = aimTo(k, s);
      k.ghost({ x: k.x, y: k.y, x2: s.x - Math.cos(a) * 60, y2: s.y - Math.sin(a) * 60, n: 5, size: 14, col: CR, hi: HI, life: 0.5 });
      for (let i = 0; i < 4; i++) { const an = s.a0 + i * 1.57, p = polar(s.x, s.y - 20, an, 130, 0.7); k.bolt({ x: s.x, y: s.y - 20, x2: p.x, y2: p.y, forks: 1, w: 3.5, col: G, hi: '#fff', d: 0.12 + i * 0.03, life: 0.5 }); k.monk_glint({ x: p.x, y: p.y + 20, R: 4, n: 1, size: 20, col: G, hi: '#fff', d: 0.2 + i * 0.04, life: 0.5 }); }
      k.flash({ x: s.x, y: s.y - 20, R: 120, col: G, d: 0.1 });
      k.ring({ x: s.x, y: s.y, R: 150, n: 2, col: CR, d: 0.2, w: 14 });
      k.monk_stream({ x: s.x, y: s.y, orbit: true, R: 110, n: 2, sw: 4, sq: 0.5, w: 8, col: CR, hi: '#fff', a0: s.a0, d: 0.3, life: 0.6 });
    },
    cyclone_kick(k, s) { // a double spin: the pack is pulled in by inward streaks, wing fans open at the middle of a gold twister
      const x = k.x, y = k.y, R = 135 * s.sc;
      for (let i = 0; i < 6; i++) { const an = s.a0 + i / 6 * TAU, p = polar(x, y, an, R * 2.1, 0.6); k.streak({ x: p.x, y: p.y, ang: Math.atan2((y - p.y), (x - p.x)) * 1, len: R * 1.5, w: 7, col: CR, hi: '#fff', d: 0.02 + i * 0.03, life: 0.35 }); }
      k.swirl({ x, y: y + 18, R, h: 270, arms: 3, col: G, hi: HI, spin: 10, w: 11, d: 0.1, life: 0.9 });
      k.monk_wing({ x, y, ang: k.ang, span: 190, col: CR, hi: HI, lift: 30, d: 0.18, life: 0.6 });
      k.arc({ x, y, a0: s.a0, sw: 5.4, r: R, w: 20, col: AM, hi: '#fff', d: 0.14, sq: 0.55 });
      k.arc({ x, y, a0: s.a0 + 3.1, sw: -5.4, r: R * 0.75, w: 14, col: G, hi: '#fff', d: 0.3, sq: 0.55 });
      k.ring({ x, y, R: R * 1.2, n: 2, col: G, d: 0.3 });
    },
    hundred_hands(k, s) { // a gold dash path hops between four stops, each one a burst of small rings
      const pts = []; for (let i = 0; i < 4; i++) pts.push(polar(s.x, s.y, s.a0 + i * 1.7, 120 * s.sc / 1.25, 0.6));
      let prev = { x: k.x, y: k.y };
      pts.forEach((p, i) => {
        k.streak({ x: prev.x, y: prev.y - 10, ang: Math.atan2(p.y - prev.y, p.x - prev.x), len: Math.hypot(p.x - prev.x, p.y - prev.y) + 20, w: 11, col: i % 2 ? OR : G, hi: HI, d: i * 0.13, life: 0.3 });
        k.monk_pulse({ x: p.x, y: p.y - 10, R: 30, n: 6, size: 22, col: i % 2 ? AM : G, hi: HI, d: 0.06 + i * 0.13, life: 0.5 });
        prev = p;
      });
      k.ghost({ x: k.x, y: k.y, x2: pts[3].x, y2: pts[3].y, n: 6, size: 14, col: G, hi: HI, life: 0.8 });
      k.burst({ x: pts[3].x, y: pts[3].y - 10, n: 10, len: 150 * s.sc / 1.25, col: G, hi: HI, d: 0.55 });
    },
    seven_seals(k, s) { // seven small seal circles ring the target and flash one after another; a big seal burns beneath
      const R = 125 * s.sc / 1.25;
      k.sigil({ x: s.x, y: s.y, R: R * 1.5, n: 7, col: G, hi: HI, b: AM, d: 0.0, life: 1.9, hold: 0.8 });
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + i / 7 * TAU, p = polar(s.x, s.y - 10, a, R, 0.6);
        k.sigil({ x: p.x, y: p.y, R: 34, n: 5, col: i === 6 ? '#fff' : G, hi: HI, b: AM, d: 0.1 + i * 0.1, life: 0.8, hold: 0.6, spin: 3 });
        k.flash({ x: p.x, y: p.y - 14, R: 60, col: G, d: 0.3 + i * 0.1 });
      }
      k.monk_glint({ x: s.x, y: s.y - 10, R: R, n: 7, size: 24, col: G, hi: '#fff', d: 0.7, life: 0.7 });
      k.pillar({ x: s.x, y: s.y, h: 420, w: 28, col: G, hi: HI, d: 0.95, life: 0.7 });
      k.burst({ x: s.x, y: s.y - 20, n: 12, len: 190, col: G, hi: HI, d: 0.95 });
    },
    rising_dragon(k, s) { // an uppercut throws one orange dragon straight up through flame spires and a coiling cone
      const x = s.x, y = s.y;
      k.spires({ x, y, n: 7, R: 110, h: 190, wd: 20, shape: 'flame', col: OR, hi: HI, d: 0.08, life: 1.0 });
      k.serpent({ x, y: y + 10, ang: -Math.PI / 2, len: 540, amp: 55, w: 28, col: OR, hi: HI, d: 0.1, life: 0.9, speed: 10 });
      k.serpent({ x: x + 8, y: y + 10, ang: -Math.PI / 2, len: 470, amp: 38, w: 14, col: G, hi: '#fff', d: 0.15, life: 0.8, speed: -9 });
      k.swirl({ x, y: y + 12, R: 120, h: 430, arms: 2, col: G, hi: HI, spin: 9, w: 11, cone: 1, d: 0.12, life: 1.0 });
      k.ring({ x, y, R: 210, n: 3, w: 26, col: OR, d: 0.1 });
      k.burst({ x, y: y - 440, n: 12, len: 190, col: G, hi: HI, d: 0.5 });
      k.motes({ x, y: y - 40, n: 24, type: 'ember', spd: 260, g: 120, size: 6, col: OR, col2: '#fff', ang: -Math.PI / 2, spread: 1.0, d: 0.12 });
      k.ghost({ x, y, x2: k.x, y2: k.y, n: 3, size: 13, col: CR, hi: HI, d: 0.5, life: 0.5 });
    },
    dragon_fang_barrage(k, s) { // two dragon heads close in like jaws while gold fangs rain onto the target and rise out of the ground
      const x = s.x, y = s.y, a = aimTo(k, s);
      for (const sd of [-1, 1]) { const an = a + sd * 1.0; k.serpent({ x: x - Math.cos(an) * 300, y: y - Math.sin(an) * 300, ang: an, len: 320, amp: 40, w: 17, col: sd > 0 ? OR : G, hi: HI, d: sd > 0 ? 0.06 : 0, life: 0.7 }); }
      for (let i = 0; i < 9; i++) k.comet({ x: x + (i - 4) * 38, y: y + ((i * 37) % 60) - 30, from: -1.95 + (i % 3) * 0.14, len: 560, size: 9, col: OR, hi: '#fff', impact: 46, d: 0.2 + i * 0.045, life: 0.55, hit: 0.5 });
      k.spires({ x, y, n: 10, R: 160, h: 150, wd: 15, shape: 'crystal', col: G, hi: HI, deep: '#4a2a00', d: 0.3 });
      k.ring({ x, y, R: 190, n: 2, col: G, d: 0.28 });
      k.monk_pulse({ x, y: y - 10, R: 80, n: 8, size: 24, col: G, hi: HI, d: 0.3, life: 0.7 });
    },
    heaven_dragon_palm(k, s) { // a golden dragon dives down a beam of heaven and a small palm print seals the target under a rune circle
      const x = s.x, y = s.y;
      k.beam({ x, y: y - 700, x2: x, y2: y, w: 38, col: G, hi: HI, d: 0.05, life: 0.8 });
      k.serpent({ x: x - 40, y: y - 640, ang: Math.PI / 2, len: 640, amp: 70, w: 24, col: OR, hi: HI, d: 0.0, life: 0.75, speed: 9 });
      k.swirl({ x, y: y + 16, R: 125, h: 600, arms: 2, col: G, hi: HI, spin: 7, w: 10, d: 0.1, life: 1.1 });
      k.sigil({ x, y, R: 210, n: 8, col: G, hi: HI, b: OR, d: 0.3, life: 1.8, hold: 0.8 });
      k.monk_palm({ x, y: y - 30, ang: -Math.PI / 2, size: 170, col: G, hi: HI, d: 0.38, life: 0.6 });
      k.monk_glint({ x, y: y - 10, R: 130, n: 6, size: 28, col: G, hi: '#fff', d: 0.5, life: 0.6 });
      k.ring({ x, y, R: 230, n: 3, w: 26, col: G, d: 0.4 });
      k.motes({ x, y, n: 20, type: 'feather', spd: 130, g: -40, size: 8, col: HI, col2: G, ang: -Math.PI / 2, spread: 2.4, d: 0.42, life: 1.4 });
    },
    dragon_tempest(k, s) { // a storm of gold dragons: two counter-turning twisters, orbiting dragon ribbons and lightning round a huge sigil
      const x = s.x, y = s.y;
      k.sigil({ x, y, R: 300, n: 8, col: G, hi: HI, b: OR, life: 2.0, hold: 0.8 });
      k.swirl({ x, y: y + 22, R: 250, h: 520, arms: 4, col: G, hi: HI, spin: 8, w: 15, d: 0.05, life: 1.3 });
      k.swirl({ x, y: y + 22, R: 150, h: 440, arms: 3, col: OR, hi: '#fff', spin: 10, dir: -1, w: 12, d: 0.1, life: 1.2 });
      k.monk_stream({ x, y, orbit: true, R: 260, n: 3, sw: 6.2, sq: 0.5, w: 15, col: OR, hi: HI, a0: s.a0, d: 0.1, life: 1.0, lift: 80 });
      for (let i = 0; i < 5; i++) { const u = i / 4 - 0.5; k.bolt({ x: x + u * 420, y: y - 560, x2: x + u * 120, y2: y, forks: 2, w: 4, col: G, hi: '#fff', d: 0.2 + i * 0.06, life: 0.5 }); }
      k.ring({ x, y, R: 330, n: 3, w: 30, col: OR, d: 0.3 });
      k.spires({ x, y, n: 8, R: 200, h: 180, wd: 20, shape: 'flame', col: OR, hi: HI, d: 0.3 });
      k.motes({ x, y, n: 36, type: 'ember', spd: 300, g: -60, size: 6, col: OR, col2: '#fff', spread: TAU, d: 0.3, life: 1.4 });
    },
    soaring_crane_dragon(k, s) { // two huge crane wings over the target while a gold and an orange dragon spiral up past them in a double helix
      const x = s.x, y = s.y;
      k.sigil({ x, y, R: 260, n: 6, col: CR, hi: HI, b: G, life: 2.0, hold: 0.8 });
      k.monk_wing({ x, y, ang: -Math.PI / 2, span: 360, col: CR, hi: HI, lift: 90, n: 7, d: 0.15, life: 1.2 });
      k.serpent({ x: x - 24, y, ang: -Math.PI / 2, len: 640, amp: 80, w: 24, col: G, hi: HI, d: 0.05, life: 1.0, speed: 9 });
      k.serpent({ x: x + 24, y, ang: -Math.PI / 2, len: 640, amp: 80, w: 24, col: OR, hi: HI, d: 0.1, life: 1.0, speed: -9 });
      k.pillar({ x, y, h: 760, w: 34, col: G, hi: HI, d: 0.2, life: 1.0 });
      k.arc({ x, y: y - 60, a0: -2.6, sw: 2.2, r: 100, w: 22, col: HI, hi: '#fff', sq: 2.2, d: 0.2, life: 0.5 });
      k.burst({ x, y: y - 520, n: 14, len: 260, col: G, hi: HI, d: 0.55 });
      k.ring({ x, y, R: 300, n: 3, w: 28, col: G, d: 0.3 });
      k.motes({ x, y: y - 30, n: 34, type: 'feather', spd: 230, g: -70, size: 9, col: HI, col2: G, ang: -Math.PI / 2, spread: 2.6, d: 0.3, life: 1.6 });
    },
    hundred_fists(k, s) { // a downpour of ring bursts over the whole pack with spirit streaks falling from above and a ten-point seal
      const x = s.x, y = s.y;
      k.sigil({ x, y, R: 330, n: 10, col: G, hi: HI, b: AM, life: 2.0, hold: 0.8 });
      k.monk_pulse({ x, y, R: 330, n: 30, size: 30, col: G, hi: HI, d: 0.1, life: 1.2 });
      k.monk_pulse({ x, y, R: 220, n: 20, size: 36, col: AM, hi: '#fff', d: 0.35, life: 1.0 });
      for (let i = 0; i < 10; i++) k.streak({ x: x + (i - 4.5) * 54, y: y - 520, ang: Math.PI / 2 + (i % 2 ? 0.1 : -0.1), len: 560, w: 12, col: i % 2 ? G : AM, hi: HI, d: 0.12 + i * 0.05, life: 0.35, ticks: 3 });
      k.ring({ x, y, R: 360, n: 3, w: 28, col: G, d: 0.5 });
    },
    heaven_splitting_palm(k, s) { // light layer: a pressure-point constellation glints under the finisher's own giant palm
      const x = s.x, y = s.y;
      k.sigil({ x, y, R: 280, n: 8, col: G, hi: HI, b: OR, life: 1.8, hold: 0.8 });
      k.monk_glint({ x, y: y - 10, R: 200, n: 10, size: 32, col: G, hi: '#fff', d: 0.2, life: 1.0 });
      k.motes({ x, y, n: 20, type: 'feather', spd: 160, g: -40, size: 9, col: HI, col2: G, ang: -Math.PI / 2, spread: 2.6, d: 0.3, life: 1.5 });
    },
  },
  routes: {
    hundred_fists: { title: 'HUNDRED FISTS', sub: 'THE SPIRIT RAINS  ·  PACK FINISHER', sfx: 'ドドドドッ', kanji: '拳', seal: '百', rot: -0.08 },
    heaven_splitting_palm: { title: 'HEAVEN-SPLITTING PALM', sub: 'THE SKY OPENS  ·  BOSS FINISHER', sfx: 'ドォォォン', kanji: '天', seal: '掌', rot: 0.06 },
    dragon_tempest: { title: 'DRAGON TEMPEST', sub: 'THE DRAGONS RISE  ·  PACK FINISHER', sfx: 'ゴォォォッ', kanji: '龍', seal: '嵐', rot: -0.1 },
    soaring_crane_dragon: { title: 'SOARING CRANE DRAGON', sub: 'WINGS AND SCALES  ·  BOSS FINISHER', sfx: 'バサァッ', kanji: '鶴', seal: '昇', rot: 0.08 },
  },
  notes: {
    tiger_fist: 'Three golden tiger-claw rakes cross the cone one after another, then a rattle of small impact rings pops where the fists land.',
    crane_kick: 'After-images mark the dash, then a pair of feathered crane wings opens, a spinning crescent circles the monk and a tall crescent rises with the kick.',
    flow_state: 'Two opposed ribbons of pale gold flow in spirals around the monk like water, over a calm rune circle with a soft ring and rising specks.',
    iron_palm: 'A thrust of light leads a glowing palm print onto the target, a shock cone rolls out and gold pressure-point glints twinkle where it lands.',
    dragons_descent: 'A gold and orange dragon carries the leap in an arc, then coils up around the crash site in a pillar of light, cracked ground and three shock rings.',
    basic: 'Jab and cross leave a short gold thrust and three tiny rings; the palm strike prints a small palm with a ring and a few sparks.',
    awakened_spirit: 'Tiger claws, crane wings and a dragon spiral arrive together over a double rune circle, then a column of light, rings, a barrage of small fist rings and feathers mark the slam.',
    dragon_sweep: 'A bright palm thrust leads into two counter-turning dragon ribbons that whirl around the monk with a spinning orange crescent and a ground ring.',
    shockwave_palm: 'A palm print opens the cone, four bright wave bands roll 300 pixels out, and pressure-point glints twinkle at the far end.',
    rapid_strikes: 'Six thin gold and amber jabs flash in from alternating sides and land as a quick drumroll of small rings with twinkling pressure points.',
    nerve_strike: 'After-images dash in, then thin lightning lines run out of the strike like nerves and end in glints, with a pale slowing ring and a spiral as the monk flips away.',
    cyclone_kick: 'Streaks pull toward the monk from all sides into a gold twister with crane wings at its middle and two spinning crescents.',
    hundred_hands: 'A gold dash path hops between four stops around the target, and each stop bursts into a rapid cluster of small rings.',
    seven_seals: 'Seven small rune circles light up around the target one after another, each flashing, then a column of light and seven glints close the seal.',
    rising_dragon: 'Flame spires and a coiling cone surround a single orange dragon that is thrown straight up with a thinner gold dragon winding around it, ending in a starburst high above.',
    dragon_fang_barrage: 'Two dragon heads close in like jaws while a rain of orange fang-shaped streaks hits the target and gold crystal fangs rise from the ground.',
    heaven_dragon_palm: 'A golden dragon dives down a beam of light, a rune circle opens on the ground and a palm print seals the target with six glints.',
    dragon_tempest: 'Two counter-turning gold and orange twisters, orbiting dragon ribbons, five bolts of lightning and flame spires rise around a huge rune circle.',
    soaring_crane_dragon: 'Huge crane wings spread over the target while a gold and an orange dragon spiral up past them in a column of light and feathers.',
    hundred_fists: 'Pack finisher: a downpour of small fist rings and streaks of golden light fall across the whole pack over a ten-point seal, then the full finisher moment.',
    heaven_splitting_palm: 'Boss finisher: a rune circle and a constellation of pressure-point glints sit beneath the finisher\'s own giant palm and split sky.',
  },
};
