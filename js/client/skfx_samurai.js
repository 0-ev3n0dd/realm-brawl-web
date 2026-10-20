// Samurai: restraint and precision. One thin white line, cuts that open AFTER the blade is already home, cherry petals, crescent moons,
// ink strokes, a parry that rings like a bell, and a void that is a black slit edged in white. Colours: moon white + steel, crimson accents, black ink.
// Complements the engine's own look (fxsamurai.js: fat ink crescents, the red slash line, finale moments): everything here is thin and quiet.
import { TAU, clamp, lerp, seeded } from './fxsk_core.js';
import { bloom, ease } from './fxglow.js';

const M = '#dfe8ff', S = '#9fb8ff', R = '#ff4a5a', P = '#ffd2e2', PK = '#ff9fc4', INK = '#05060f';

// a crescent moon path: the bulge is on the left, the tips point right (rotate with ctx.rotate)
function crescentPath(ctx, r, ph = 0.38, r2f = 0.9) {
  const d = r * ph, r2 = r * r2f, x = (d * d + r * r - r2 * r2) / (2 * d), y = Math.sqrt(Math.max(0, r * r - x * x)), t1 = Math.atan2(y, x);
  ctx.beginPath(); ctx.arc(0, 0, r, t1, TAU - t1, false); ctx.arc(d, 0, r2, Math.atan2(-y, x - d), Math.atan2(y, x - d), true); ctx.closePath();
}
// a tapered polygon along a polyline (widths per point)
function poly(ctx, pts, ws) {
  const n = pts.length, L = [], Rr = [];
  for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, w = ws[i] / 2; L.push([pts[i][0] - dy / d * w, pts[i][1] + dx / d * w]); Rr.push([pts[i][0] + dy / d * w, pts[i][1] - dx / d * w]); }
  ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]); for (let i = n - 1; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]); ctx.closePath(); ctx.fill();
}
const line = (ctx, pts) => { ctx.beginPath(); pts.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q[0], q[1])); ctx.stroke(); };
const dirOf = (k, s) => Math.atan2(s.y - k.y, s.x - k.x);

export default {
  pal: { a: '#dfe8ff', b: '#ff4a5a', hi: '#ffffff', deep: '#0c1020', ink: '#060812', edge: '#ffffff' },
  prims: {
    /** One hairline cut: the line appears at once, then OPENS into a thin lit gap (a cut that lands after the sword has passed). x,y start, ang, len, gap, w. */
    sam_hair(ctx, c, k) {
      const grow = ease.out(clamp(k / 0.1)), op = ease.out(clamp((k - 0.08) / 0.4)), a = 1 - ease.in(clamp((k - 0.55) / 0.45)); if (a <= 0.01) return;
      const ca = Math.cos(c.ang), sa = Math.sin(c.ang), Ln = c.len * grow, gap = (c.gap ?? 10) * op, N = 18, up = [], dn = [], mid = [];
      for (let i = 0; i <= N; i++) { const u = i / N, al = u * Ln, half = gap * 0.5 * Math.pow(Math.sin(Math.PI * u), 0.6), bx = c.x + ca * al, by = c.y + sa * al; up.push([bx - sa * half, by + ca * half]); dn.push([bx + sa * half, by - ca * half]); mid.push([bx, by]); }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.globalAlpha = a * 0.5 * Math.min(1, op * 2); ctx.fillStyle = c.col; ctx.beginPath(); up.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q[0], q[1])); for (let i = N; i >= 0; i--) ctx.lineTo(dn[i][0], dn[i][1]); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = c.col; ctx.lineWidth = 7; ctx.globalAlpha = a * 0.22; line(ctx, mid);
      if (gap > 2) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.3; ctx.globalAlpha = a * 0.85; line(ctx, up); line(ctx, dn); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = c.w || 2; ctx.globalAlpha = a * (1 - 0.5 * op); line(ctx, mid);
      const h = mid[N]; if (k < 0.3) bloom(ctx, h[0], h[1], 30, '#fff', 0.8 * (1 - k / 0.3));
      const m = mid[N >> 1]; bloom(ctx, m[0], m[1], 24 + gap * 2, c.col, 0.3 * a);
    },
    /** A crescent moon (or a full moon with full:true) that fades in, hovers and fades. r, rot (bulge faces rot+PI), rise, sq. */
    sam_moon(ctx, c, k) {
      const inn = ease.out(clamp(k / 0.22)), a = inn * (1 - ease.in(clamp((k - 0.62) / 0.38))); if (a <= 0.01) return;
      const r = c.r * (0.85 + 0.15 * inn), rise = (c.rise || 0) * ease.out(k);
      ctx.save(); ctx.translate(c.x, c.y - rise); ctx.scale(1, c.sq || 1); ctx.rotate(c.rot || 0);
      bloom(ctx, 0, 0, r * 1.9, c.col, (c.full ? 0.2 : 0.4) * a);
      if (c.full) {
        const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r); g.addColorStop(0, c.hi || '#fff'); g.addColorStop(0.85, c.col); g.addColorStop(1, c.col);
        ctx.globalAlpha = a * 0.34; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.globalAlpha = a * 0.75; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.globalAlpha = a * 0.3; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, TAU); ctx.stroke();
      } else {
        crescentPath(ctx, r); ctx.globalAlpha = a * 0.5; ctx.fillStyle = c.col; ctx.fill();
        ctx.save(); ctx.scale(0.9, 0.9); crescentPath(ctx, r); ctx.globalAlpha = a * 0.85; ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
        crescentPath(ctx, r); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
      }
      ctx.restore();
    },
    /** A parry: bell-like face-on shock rings with a ring of spark ticks. R, n ticks, w, sq. */
    sam_bell(ctx, c, k) {
      const sq = c.sq ?? 0.82, Rr = seeded(c.seed);
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, sq); ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const kk = clamp((k - i * 0.09) / 0.75); if (kk <= 0 || kk >= 1) continue;
        ctx.globalAlpha = (1 - kk) * (1 - i * 0.3); ctx.lineWidth = (c.w || 8) * (1 - kk) * (1 - i * 0.3) + 1.5; ctx.strokeStyle = i ? c.col : '#fff'; ctx.beginPath(); ctx.arc(0, 0, c.R * ease.out(kk) * (1 - i * 0.14), 0, TAU); ctx.stroke();
      }
      const kk = clamp(k / 0.6), n = c.n || 14;
      if (kk < 1) for (let j = 0; j < n; j++) { const an = j / n * TAU + Rr() * 0.3, r0 = c.R * ease.out(kk) * 0.92, r1 = r0 + 10 + 26 * (1 - kk) * (0.5 + Rr()); ctx.globalAlpha = (1 - kk); ctx.strokeStyle = j % 3 ? '#fff' : c.col; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); ctx.stroke(); }
      ctx.restore(); bloom(ctx, c.x, c.y, c.R * 0.8 * (0.5 + 0.5 * ease.out(k)), c.col, 0.45 * (1 - k)); bloom(ctx, c.x, c.y, c.R * 0.3, '#fff', 0.8 * (1 - clamp(k / 0.3)), 1);
    },
    /** A black ink brush stroke (drawn opaque, under actors): x,y start, ang, len, w, bend. */
    sam_ink(ctx, c, k) {
      const head = ease.out(clamp(k / 0.22)), a = (1 - ease.in(clamp((k - 0.5) / 0.5))) * (c.al ?? 0.8); if (a <= 0.01) return;
      const ca = Math.cos(c.ang), sa = Math.sin(c.ang), N = 20, pts = [], ws = [], Rr = seeded(c.seed);
      for (let i = 0; i <= N; i++) { const u = i / N * head, al = u * c.len, off = Math.sin(u * Math.PI) * (c.bend || 0); pts.push([c.x + ca * al - sa * off, c.y + sa * al + ca * off]); ws.push(c.w * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.06)), 0.5) * (1 - 0.55 * u)); }
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.globalAlpha = a; poly(ctx, pts, ws); ctx.lineCap = 'round';
      for (let s = 0; s < 4; s++) { const o = (Rr() - 0.5) * c.w * 1.2, i0 = (Rr() * N * 0.4) | 0, i1 = Math.min(N, i0 + 6 + ((Rr() * 8) | 0)); ctx.globalAlpha = a * 0.7; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = i0; i <= i1; i++) { const q = pts[i]; ctx[i > i0 ? 'lineTo' : 'moveTo'](q[0] - sa * o, q[1] + ca * o); } ctx.stroke(); }
      const e = pts[N]; for (let s = 0; s < 6; s++) { ctx.globalAlpha = a * 0.8; ctx.beginPath(); ctx.arc(e[0] + (Rr() - 0.3) * c.w * 2.4, e[1] + (Rr() - 0.5) * c.w * 1.4, 1.2 + Rr() * 3, 0, TAU); ctx.fill(); }
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.globalAlpha = a * 0.3; line(ctx, pts);
    },
    /** A black slit in the world edged in white (the void): centred on x,y, along ang, len, w. Drawn under actors. */
    sam_slit(ctx, c, k) {
      const open = ease.out(clamp(k / 0.2)) * (1 - ease.in(clamp((k - 0.68) / 0.32))); if (open < 0.02) return;
      const ca = Math.cos(c.ang), sa = Math.sin(c.ang), N = 24, up = [], dn = [], Rr = seeded(c.seed);
      for (let i = 0; i <= N; i++) { const u = i / N, al = (u - 0.5) * c.len, half = c.w * 0.5 * open * Math.pow(Math.sin(Math.PI * u), 0.85), bx = c.x + ca * al, by = c.y + sa * al; up.push([bx - sa * half, by + ca * half]); dn.push([bx + sa * half, by - ca * half]); }
      const path = () => { ctx.beginPath(); up.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q[0], q[1])); for (let i = N; i >= 0; i--) ctx.lineTo(dn[i][0], dn[i][1]); ctx.closePath(); };
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.93 * open; ctx.fillStyle = c.deep || INK; path(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
      ctx.strokeStyle = c.col; ctx.lineWidth = 6; ctx.globalAlpha = 0.3 * open; line(ctx, up); line(ctx, dn);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.9 * open; line(ctx, up); line(ctx, dn);
      for (let i = 0; i < 12; i++) { const u = 0.1 + Rr() * 0.8, v = (Rr() - 0.5) * 1.3, al = (u - 0.5) * c.len, half = c.w * 0.5 * open * Math.pow(Math.sin(Math.PI * u), 0.85) * v; ctx.globalAlpha = open * (0.4 + 0.5 * Math.sin(k * 24 + i * 2)) ** 2; ctx.fillStyle = '#fff'; ctx.fillRect(c.x + ca * al - sa * half - 1, c.y + sa * al + ca * half - 1, 2, 2); }
      bloom(ctx, up[0][0], up[0][1], 26, c.col, 0.5 * open); bloom(ctx, up[N][0], up[N][1], 26, c.col, 0.5 * open);
    },
    /** A delayed-cut mark: a small glowing slash that waits, and (at: when) snaps open in a flash. at>=1 = it only fades. s size, rot. */
    sam_mark(ctx, c, k) {
      const s = c.s || 24, at = c.at ?? 1.1, rot = c.rot || 0;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(rot); ctx.lineCap = 'round';
      if (k < at) {
        const arm = ease.out(clamp(k / 0.22)), pulse = 0.65 + 0.35 * Math.sin(k * 28), a = arm * (at >= 1 ? 1 - ease.in(clamp((k - 0.65) / 0.35)) : 1), L = s * arm;
        ctx.strokeStyle = c.col; ctx.lineWidth = 5; ctx.globalAlpha = a * 0.35 * pulse; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.globalAlpha = a * (0.6 + 0.35 * pulse); ctx.stroke();
        ctx.lineWidth = 1.2; ctx.globalAlpha = a * 0.7; ctx.beginPath(); ctx.moveTo(-s * 0.18 * arm, -s * 0.26 * arm); ctx.lineTo(s * 0.18 * arm, s * 0.26 * arm); ctx.stroke();
        ctx.restore(); bloom(ctx, c.x, c.y, s * 1.3, c.col, 0.3 * a * pulse); return;
      }
      const u = clamp((k - at) / (1 - at)), L = s * (1 + 2.4 * ease.out(u)), a = 1 - u;
      ctx.strokeStyle = c.col; ctx.lineWidth = 8 * a + 1; ctx.globalAlpha = a * 0.5; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4 * a + 0.6; ctx.globalAlpha = a; ctx.stroke();
      for (let i = 0; i < 6; i++) { const an = i / 6 * TAU + 0.4, r0 = s * 0.5 * ease.out(u), r1 = r0 + s * 0.7 * a; ctx.globalAlpha = a * 0.8; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); ctx.stroke(); }
      ctx.restore(); bloom(ctx, c.x, c.y, s * 2.8 * (0.5 + 0.5 * ease.out(u)), c.col, 0.7 * a); bloom(ctx, c.x, c.y, s * 0.9, '#fff', 0.9 * (1 - ease.out(clamp(u / 0.5))), 1);
    },
    /** A cherry blossom opening on the ground (n petals), turning slowly, then fading. R, n, rot. */
    sam_flower(ctx, c, k) {
      const op = ease.out(clamp(k / 0.4)), a = op * (1 - ease.in(clamp((k - 0.6) / 0.4))); if (a <= 0.01) return;
      const n = c.n || 5; ctx.save(); ctx.translate(c.x, c.y + 10); ctx.scale(1, c.sq ?? 0.62); ctx.rotate((c.rot || 0) + k * 0.6);
      for (let i = 0; i < n; i++) {
        ctx.save(); ctx.rotate(i / n * TAU); ctx.translate(c.R * 0.52 * op, 0);
        ctx.beginPath(); ctx.ellipse(0, 0, c.R * 0.48 * op, c.R * 0.2 * op, 0, 0, TAU); ctx.globalAlpha = a * 0.35; ctx.fillStyle = c.col; ctx.fill();
        ctx.beginPath(); ctx.ellipse(-c.R * 0.06 * op, 0, c.R * 0.3 * op, c.R * 0.09 * op, 0, 0, TAU); ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#fff'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, 0, c.R * 0.48 * op, c.R * 0.2 * op, 0, 0, TAU); ctx.globalAlpha = a * 0.8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.restore();
      }
      ctx.restore(); bloom(ctx, c.x, c.y + 10, c.R * 0.6, c.col, 0.4 * a); bloom(ctx, c.x, c.y + 10, c.R * 0.15, '#fff', 0.7 * a, 1);
    },
    /** A blade glint: a hairline cross of light with a soft core (the click of the sheath, a gleam on the edge). len, rot. */
    sam_glint(ctx, c, k) {
      const a = Math.pow(1 - k, 1.5), e = ease.out(clamp(k / 0.2)), L = c.len * e; if (a <= 0.01) return;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot || 0);
      const g = ctx.createLinearGradient(-L, 0, L, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(-L, -1.2, L * 2, 2.4);
      const g2 = ctx.createLinearGradient(0, -L * 0.4, 0, L * 0.4); g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(0.5, c.col); g2.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g2; ctx.globalAlpha = a * 0.8; ctx.fillRect(-1, -L * 0.4, 2, L * 0.8);
      ctx.restore(); bloom(ctx, c.x, c.y, L * 0.35, c.col, 0.6 * a); bloom(ctx, c.x, c.y, L * 0.12, '#fff', 0.9 * a, 1);
    },
  },
  underPrims: ['sam_ink', 'sam_slit', 'sam_flower'],

  skills: {
    iaido(k) { // the dash: steel afterimages down the line, one hairline that opens after the dash, then three delayed-cut marks glow in behind
      const a = k.ang, e = k.ahead(250);
      k.ghost({ x: k.x, y: k.y, x2: e.x, y2: e.y, n: 4, size: 14, col: S, hi: '#fff', d: 0.02, life: 0.5 });
      k.sam_hair({ x: k.x, y: k.y - 8, ang: a, len: 250, gap: 12, col: R, d: 0.07, life: 0.9 });
      for (let i = 0; i < 3; i++) { const p = k.ahead(70 + i * 80, (i % 2 ? 1 : -1) * 6); k.sam_mark({ x: p.x, y: p.y - 8, rot: a + (i % 2 ? -0.9 : 0.9), s: 22, col: R, d: 0.3 + i * 0.09, life: 1.3 }); }
      k.sam_glint({ x: e.x, y: e.y - 10, len: 80, rot: a, col: M, d: 0.1, life: 0.35 });
      k.motes({ x: e.x, y: e.y, n: 8, type: 'petal', spd: 130, g: 50, size: 7, col: P, col2: '#fff', ang: a, spread: 2.6, d: 0.1, life: 1.2 });
    },
    crescent_parry(k) { // a raised steel edge and a quiet ring while the guard waits, then a bell shockwave and a crescent moon when it ends
      const g = k.ahead(46), m = k.ahead(96);
      k.arc({ x: k.x, y: k.y - 6, a0: k.ang - 1.5, sw: 1.5, r: 60, w: 6, col: S, hi: '#fff', d: 0.0, life: 0.4, sq: 0.9 });
      k.sam_bell({ x: g.x, y: g.y - 14, R: 64, col: M, w: 4, n: 10, d: 0.05, life: 0.5 });
      k.arc({ x: k.x, y: k.y, a0: k.ang - 1.3, sw: 2.6, r: 125, w: 12, col: M, hi: '#fff', d: 0.4, life: 0.45, sq: 0.85 });
      k.sam_moon({ x: m.x, y: m.y - 14, r: 62, rot: k.ang + Math.PI, col: M, d: 0.42, life: 0.8, rise: 8 });
      k.sam_bell({ x: g.x, y: g.y - 14, R: 150, col: M, w: 10, n: 18, d: 0.42, life: 0.7 });
      k.motes({ x: m.x, y: m.y, n: 14, type: 'spark', spd: 360, size: 7, col: '#fff', col2: R, mix: 0.3, spread: TAU, d: 0.42, g: 200 });
    },
    sheathe(k) { // the blade clicks home (a glint on the hilt), a quiet ring, petals drift down and a small moon rises: the stillness
      k.sam_glint({ x: k.x + k.ca * 14, y: k.y - 18, len: 120, rot: k.ang, col: M, d: 0.14, life: 0.4 });
      k.ring({ x: k.x, y: k.y, R: 115, n: 2, w: 10, col: M, d: 0.16 });
      k.streak({ x: k.x - 46, y: k.y - 16, ang: 0, len: 92, w: 3, col: M, hi: '#fff', d: 0.12, life: 0.3 });
      k.motes({ x: k.x, y: k.y - 40, n: 18, type: 'petal', spd: 140, g: 40, size: 8, col: P, col2: '#fff', spread: TAU, sway: 26, R0: 60, d: 0.16, life: 1.8 });
      k.motes({ x: k.x, y: k.y - 90, n: 12, type: 'pix', spd: 16, g: 14, size: 4, col: '#fff', spread: TAU, R0: 120, d: 0.3, life: 2.0, opt: true });
      k.sam_moon({ x: k.x, y: k.y - 96, r: 30, rot: -0.5, col: M, d: 0.2, life: 1.9, rise: 18 });
    },
    kesa_slash(k) { // a shoulder-to-hip diagonal: a brush stroke under it, one hairline over it, two delayed marks that glow in afterwards
      const s0 = k.ahead(150, -110), s1 = k.ahead(60, 110), a = Math.atan2(s1.y - s0.y, s1.x - s0.x), L = Math.hypot(s1.x - s0.x, s1.y - s0.y) + 40;
      k.sam_ink({ x: s0.x, y: s0.y, ang: a, len: L, w: 34, bend: 10, d: 0.05, life: 0.7 });
      k.sam_hair({ x: s0.x, y: s0.y, ang: a, len: L, gap: 14, col: R, d: 0.1, life: 0.9 });
      k.arc({ x: k.x, y: k.y, a0: k.ang - 1.0, sw: 2.0, r: 130, w: 9, col: M, hi: '#fff', d: 0.07, life: 0.4, sq: 0.85 });
      for (let i = 0; i < 2; i++) { const p = k.ahead(100 + i * 36, (i ? 28 : -28)); k.sam_mark({ x: p.x, y: p.y - 8, rot: a + 0.5, s: 22, col: R, d: 0.38 + i * 0.1, life: 1.3 }); }
      k.motes({ x: s1.x, y: s1.y, n: 10, type: 'petal', spd: 140, g: 60, size: 7, col: P, col2: '#fff', ang: a, spread: 2.4, d: 0.12, life: 1.2 });
    },
    void_draw(k) { // moonlight gathers on the blade for the whole charge, then ONE screen-long hairline cuts through a black slit and marks glow along it
      const L = 900, a = k.ang, mid = k.ahead(L / 2);
      k.orbit({ x: k.x, y: k.y - 20, n: 6, R: 110, speed: 3, col: M, hi: '#fff', size: 8, launch: 2, life: 0.65 });
      k.sigil({ x: k.x, y: k.y, R: 150, n: 5, col: M, hi: '#fff', b: R, d: 0.0, life: 0.8, hold: 0.9 });
      k.sam_moon({ x: k.x, y: k.y - 110, r: 46, rot: 0.3, col: M, d: 0.05, life: 1.0, rise: 14 });
      k.sam_slit({ x: mid.x, y: mid.y - 8, ang: a, len: L, w: 90, col: S, d: 0.66, life: 1.2 });
      k.sam_hair({ x: k.x, y: k.y - 8, ang: a, len: L, gap: 18, w: 3, col: R, d: 0.66, life: 1.1 });
      k.streak({ x: k.x, y: k.y - 8, ang: a, len: L, w: 5, col: M, hi: '#fff', d: 0.66, life: 0.35 });
      for (let i = 0; i < 4; i++) { const p = k.ahead(150 + i * 200, (i % 2 ? 1 : -1) * 14); k.sam_mark({ x: p.x, y: p.y - 8, rot: a + 0.9, s: 26, col: R, d: 0.95 + i * 0.07, life: 1.3 }); k.motes({ x: p.x, y: p.y - 20, n: 5, type: 'petal', spd: 90, g: 50, size: 7, col: P, col2: '#fff', spread: TAU, sway: 20, d: 0.7 + i * 0.05, life: 1.4, opt: i > 1 }); }
      k.shake(0.3);
    },
  },
  basic(k, ev) { // a single thin steel arc per cut; the third swing (Rising Moon) adds a small crescent moon
    const heavy = ev.idx === 2, dir = ev.idx % 2 ? -1 : 1;
    k.arc({ x: k.x, y: k.y - 6, a0: k.ang - dir * 1.1, sw: dir * (heavy ? 2.4 : 2.0), r: heavy ? 104 : 82, w: heavy ? 9 : 5, col: heavy ? M : S, hi: '#fff', d: 0.04, life: 0.3, sq: 0.9 });
    if (heavy) { const p = k.ahead(90); k.sam_moon({ x: p.x, y: p.y - 10, r: 40, rot: k.ang + Math.PI, col: M, d: 0.1, life: 0.55, rise: 10 }); k.motes({ x: p.x, y: p.y, n: 5, type: 'petal', spd: 160, g: 60, size: 6, col: P, col2: '#fff', ang: k.ang, spread: 2.4, d: 0.1, life: 0.9, opt: true }); }
  },
  ult(k) { // Blade of the Void: a full moon stands over the caster, a black slit opens down the draw line edged in white, the whole field fills with falling petals
    const a = k.ang, mid = k.ahead(230);
    k.sam_moon({ x: k.x, y: k.y - 200, r: 78, full: true, col: M, d: 0.0, life: 1.7, rise: 14 });
    k.sigil({ x: k.x, y: k.y, R: 250, n: 8, col: M, hi: '#fff', b: R, d: 0.05, life: 1.7, hold: 0.8 });
    k.sam_slit({ x: mid.x, y: mid.y - 8, ang: a, len: 540, w: 120, col: S, d: 0.2, life: 1.3 });
    k.sam_hair({ x: k.x, y: k.y - 8, ang: a, len: 460, gap: 22, w: 3, col: R, d: 0.27, life: 1.1 });
    k.ring({ x: k.x, y: k.y, R: 300, n: 2, w: 14, col: R, d: 0.27 });
    for (let i = 0; i < 3; i++) { const p = k.ahead(120 + i * 130, (i - 1) * 16); k.sam_mark({ x: p.x, y: p.y - 8, rot: a + 0.9 - i * 0.6, s: 26, col: R, d: 0.5 + i * 0.08, life: 1.4 }); }
    k.motes({ x: k.x, y: k.y - 140, n: 36, type: 'petal', spd: 50, g: 45, size: 9, col: P, col2: '#fff', spread: TAU, R0: 280, sway: 26, d: 0.1, life: 2.2 });
  },

  chains: {
    wind_step(k, s) { // two hairlines, there and back, one slightly offset: a pass through the pack and the pass home
      const a = dirOf(k, s), L = Math.hypot(s.x - k.x, s.y - k.y) + 110, ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca, ex = k.x + ca * L, ey = k.y + sa * L;
      k.ghost({ x: k.x, y: k.y, x2: ex, y2: ey, n: 4, size: 14, col: S, hi: '#fff', d: 0.02, life: 0.5 }); k.ghost({ x: ex, y: ey, x2: k.x, y2: k.y, n: 4, size: 14, col: S, hi: '#fff', d: 0.2, life: 0.5 });
      k.sam_hair({ x: k.x + nx * 16, y: k.y - 8 + ny * 16, ang: a, len: L, gap: 12, col: S, d: 0.05, life: 0.8 });
      k.sam_hair({ x: ex - nx * 16, y: ey - 8 - ny * 16, ang: a + Math.PI, len: L, gap: 12, col: R, d: 0.22, life: 0.8 });
      k.motes({ x: s.x, y: s.y - 10, n: 14, type: 'feather', spd: 240, g: -10, size: 7, col: '#f4f8ff', col2: M, ang: a, spread: 1.2, d: 0.05, life: 1.2 });
      for (let i = 0; i < 2; i++) k.sam_mark({ x: s.x + (i ? 36 : -36), y: s.y - 14, rot: a + (i ? -0.8 : 0.8), s: 24, col: R, d: 0.4 + i * 0.1, life: 1.2 });
    },
    blossom_burst(k, s) { // the last diagonal draw, then the sheathe blooms into a five-petal blossom with petals thrown out of it
      k.sam_hair({ x: s.x - 100, y: s.y - 120, ang: 1.05, len: 250, gap: 10, col: R, d: 0.04, life: 0.8 });
      k.sam_glint({ x: k.x + k.ca * 14, y: k.y - 18, len: 110, rot: k.ang, col: M, d: 0.2, life: 0.4 });
      k.sam_flower({ x: s.x, y: s.y, R: 150, n: 5, col: PK, hi: '#fff', rot: s.a0, d: 0.3, life: 1.2 });
      k.ring({ x: s.x, y: s.y, R: 165, n: 1, w: 8, col: P, d: 0.3 });
      k.motes({ x: s.x, y: s.y - 20, n: 30, type: 'petal', spd: 240, g: 50, size: 8, col: PK, col2: '#fff', spread: TAU, sway: 24, d: 0.3, life: 1.5 });
    },
    counter_sheathe(k, s) { // the parry rings like a bell at your blade, the click, then the marks on the target snap open in two bright rings (double damage)
      k.sam_bell({ x: k.x + k.ca * 40, y: k.y - 18, R: 110, col: M, w: 8, n: 12, d: 0.0, life: 0.6 });
      k.sam_glint({ x: k.x + k.ca * 14, y: k.y - 18, len: 130, rot: k.ang, col: M, d: 0.18, life: 0.4 });
      for (let i = 0; i < 3; i++) k.sam_mark({ x: s.x + (i - 1) * 40, y: s.y - 14 - (i % 2) * 22, rot: s.a0 + i * 0.9, s: 28, col: R, at: 0.45, d: 0.05, life: 0.5 });
      k.ring({ x: s.x, y: s.y, R: 150, n: 2, w: 12, col: R, d: 0.27 }); k.sam_bell({ x: s.x, y: s.y - 14, R: 170, col: R, w: 8, n: 16, d: 0.27, life: 0.6 });
      k.motes({ x: s.x, y: s.y - 10, n: 14, type: 'spark', spd: 340, g: 200, size: 7, col: '#fff', col2: R, spread: TAU, d: 0.27 });
    },
    moonlit_guard(k) { // a full moon rises behind you, a ring of small runes and a bell ring close around the guard
      k.sam_moon({ x: k.x, y: k.y - 100, r: 84, full: true, col: M, d: 0.0, life: 1.2, rise: 10 });
      k.sam_bell({ x: k.x, y: k.y - 26, R: 125, col: M, w: 6, n: 14, d: 0.1, life: 0.8 });
      k.wave({ x: k.x, y: k.y - 20, ang: 0, arc: TAU, r: 170, n: 2, w: 5, col: M, hi: '#fff', d: 0.12 });
      k.motes({ x: k.x, y: k.y - 24, n: 12, type: 'rune', spd: 70, g: -30, size: 7, col: '#fff', col2: M, ang: -Math.PI / 2, spread: TAU, R0: 100, d: 0.1, life: 1.3, opt: true });
      k.arc({ x: k.x, y: k.y, a0: k.ang - 1.3, sw: 2.6, r: 120, w: 10, col: M, hi: '#fff', d: 0.4, life: 0.45, sq: 0.85 });
    },
    petal_rain(k, s) { // eight dash-cuts as a fan of crossing hairlines over the pack while petals fall and a blossom opens underneath
      for (let i = 0; i < 6; i++) { const an = -0.55 + i * 0.22 + (s.v - 0.5) * 0.3, off = (i - 2.5) * 34 * s.sc, ca = Math.cos(an), sa = Math.sin(an); k.sam_hair({ x: s.x - ca * 140 - sa * off, y: s.y - 10 - sa * 140 + ca * off, ang: an, len: 280, gap: 8, col: i % 2 ? M : R, d: 0.05 + i * 0.07, life: 0.7 }); }
      k.sam_flower({ x: s.x, y: s.y, R: 160 * s.sc / 1.25, n: 5, col: PK, hi: '#fff', rot: s.a0, d: 0.4, life: 1.2 });
      k.motes({ x: s.x, y: s.y - 200, n: 40, type: 'petal', spd: 55, g: 90, size: 8, col: PK, col2: '#fff', spread: TAU, R0: 220, sway: 30, d: 0.05, life: 1.9 });
    },
    moment_of_death(k, s) { // marks gather on the target, time stands still (petals hang in the air, a clock-moon watches), then one steep hairline opens a slit
      const an = -1.25, ca = Math.cos(an), sa = Math.sin(an);
      for (let i = 0; i < 3; i++) k.sam_mark({ x: s.x + [-42, 34, 6][i], y: s.y - [20, 36, -22][i], rot: s.a0 + i * 1.1, s: 24, col: R, at: 0.9, d: 0.0, life: 0.7 });
      k.sam_moon({ x: s.x, y: s.y - 210, r: 62, full: true, col: M, d: 0.0, life: 1.2 });
      k.motes({ x: s.x, y: s.y - 30, n: 26, type: 'petal', spd: 26, g: 0, size: 8, col: P, col2: '#fff', spread: TAU, R0: 230, d: 0.0, life: 1.3, stagger: 0.05 });
      k.sam_slit({ x: s.x, y: s.y - 24, ang: an, len: 520, w: 56, col: S, d: 0.62, life: 1.1 });
      k.sam_hair({ x: s.x - ca * 280, y: s.y - 28 - sa * 280, ang: an, len: 560, gap: 16, w: 3, col: R, d: 0.62, life: 1.1 });
      k.ring({ x: s.x, y: s.y, R: 210, n: 1, w: 8, col: '#fff', d: 0.62 });
    },
    twin_moons(k, s) { // two crescent moons face each other across the target and two crossing hairlines cut an X; the second is the brighter one
      const th = s.a0;
      for (let i = 0; i < 2; i++) k.sam_moon({ x: s.x + Math.cos(th + i * Math.PI) * 96, y: s.y - 26 + Math.sin(th + i * Math.PI) * 60, r: 68, rot: th + i * Math.PI - Math.PI, col: M, d: i * 0.14, life: 0.9, rise: 6 });
      for (let i = 0; i < 2; i++) { const an = (i ? -0.8 : 0.8), ca = Math.cos(an), sa = Math.sin(an); k.sam_hair({ x: s.x - ca * 170, y: s.y - 24 - sa * 170, ang: an, len: 340, gap: i ? 16 : 11, w: i ? 3 : 2, col: i ? R : S, d: 0.06 + i * 0.14, life: 0.8 }); }
      k.sam_glint({ x: s.x, y: s.y - 24, len: 150, rot: 0.8, col: M, d: 0.2, life: 0.4 });
      k.motes({ x: s.x, y: s.y - 20, n: 12, type: 'petal', spd: 220, g: 50, size: 7, col: P, col2: '#fff', spread: TAU, d: 0.2, life: 1.2 });
    },
    riposte_wave(k, s) { // four crescents of moonlight roll down the aim, growing as they go, with a thin line under them
      const a = k.ang, e = k.ahead(430);
      k.streak({ x: k.x, y: k.y - 10, ang: a, len: 430, w: 5, col: M, hi: '#fff', d: 0.04, life: 0.4, ticks: 3 });
      for (let i = 0; i < 4; i++) { const p = k.ahead(90 + i * 105); k.sam_moon({ x: p.x, y: p.y - 14, r: 46 + i * 12, rot: a + Math.PI, col: i === 3 ? R : M, d: 0.06 + i * 0.07, life: 0.55 }); }
      k.wave({ x: k.x, y: k.y - 10, ang: a, arc: 1.3, r: 430, n: 3, w: 8, col: M, hi: '#fff', d: 0.1 });
      k.sam_glint({ x: e.x, y: e.y - 12, len: 130, rot: a + 0.8, col: M, d: 0.35, life: 0.4 });
      k.motes({ x: e.x, y: e.y, n: 14, type: 'petal', spd: 200, g: 50, size: 7, col: P, col2: '#fff', ang: a, spread: 2.0, d: 0.3, life: 1.2 });
    },
    void_echo(k, s) { // a black slit opens along the draw and three hairlines echo through it, each thinner, with ripples of the void spreading around the target
      const a = dirOf(k, s), ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
      k.sam_slit({ x: s.x, y: s.y - 10, ang: a, len: 540, w: 100, col: '#b8c4ff', d: 0.06, life: 1.3 });
      for (let i = 0; i < 3; i++) k.sam_hair({ x: s.x - ca * 270 + nx * (i - 1) * 24, y: s.y - 10 - sa * 270 + ny * (i - 1) * 24, ang: a, len: 540, gap: 12 - i * 3, w: 2.4 - i * 0.5, col: i ? M : R, d: 0.08 + i * 0.18, life: 0.7 });
      for (let i = 0; i < 3; i++) k.sam_bell({ x: s.x, y: s.y - 14, R: 100 + i * 70, col: '#b8c4ff', w: 6, n: 10, sq: 0.6, d: 0.14 + i * 0.15, life: 0.7 });
      k.ghost({ x: k.x, y: k.y, x2: s.x + ca * 200, y2: s.y + sa * 200, n: 5, size: 14, col: S, hi: '#fff', d: 0.02, life: 0.5 });
    },
    stillwater_execution(k, s) { // still water: slow ripples spread from the target under a full moon, then one vertical cut and a drop of ink
      for (let i = 0; i < 3; i++) k.ring({ x: s.x, y: s.y, R: 110 + i * 70, n: 1, w: 6, col: '#bcd4ff', d: i * 0.15, life: 1.0 });
      k.sam_moon({ x: s.x, y: s.y - 220, r: 58, full: true, col: M, d: 0.0, life: 1.3 });
      k.sam_moon({ x: s.x, y: s.y + 6, r: 50, full: true, sq: 0.35, col: S, d: 0.1, life: 1.0 });
      k.sam_ink({ x: s.x, y: s.y - 280, ang: Math.PI / 2, len: 460, w: 24, bend: 6, d: 0.5, life: 0.9 });
      k.sam_hair({ x: s.x, y: s.y - 280, ang: Math.PI / 2, len: 460, gap: 14, w: 3, col: R, d: 0.55, life: 1.0 });
      k.motes({ x: s.x, y: s.y, n: 14, type: 'pix', spd: 200, g: 300, size: 5, col: '#fff', col2: M, ang: -Math.PI / 2, spread: 1.6, d: 0.58, life: 0.9 });
    },
    crescent_void(k, s) { // a full moon above, a wide black slit across the target edged in white, a thin crescent sweep and one hairline through it
      const an = -0.5 + (s.v - 0.5) * 0.3, ca = Math.cos(an), sa = Math.sin(an);
      k.sam_moon({ x: s.x, y: s.y - 210, r: 110, full: true, col: M, d: 0.0, life: 1.5, rise: 16 });
      k.sam_slit({ x: s.x, y: s.y - 10, ang: an, len: 720, w: 150, col: S, d: 0.3, life: 1.3 });
      k.arc({ x: s.x, y: s.y, a0: s.a0, sw: 5.4, r: 190, w: 14, col: M, hi: '#fff', d: 0.2, life: 0.6, sq: 0.75 });
      k.sam_hair({ x: s.x - ca * 360, y: s.y - 14 - sa * 360, ang: an, len: 720, gap: 24, w: 3, col: R, d: 0.32, life: 1.1 });
      k.motes({ x: s.x, y: s.y - 200, n: 24, type: 'petal', spd: 55, g: 80, size: 8, col: P, col2: '#fff', spread: TAU, R0: 240, sway: 26, d: 0.3, life: 1.7, opt: true });
    },
    void_sheath(k, s) { // eight marks ring the target and all snap open together at the click of the sheath; a thin horizontal line, a glint and a closing slit
      for (let i = 0; i < 8; i++) { const an = i / 8 * TAU + s.a0; k.sam_mark({ x: s.x + Math.cos(an) * 160, y: s.y - 14 + Math.sin(an) * 100, rot: an + 1.2, s: 26, col: R, at: 0.5, d: 0.0, life: 0.95 }); }
      k.sam_hair({ x: k.x - 200, y: k.y - 14, ang: 0, len: 400, gap: 8, w: 2, col: M, d: 0.5, life: 0.6 });
      k.sam_glint({ x: k.x + k.ca * 14, y: k.y - 18, len: 170, rot: k.ang, col: M, d: 0.5, life: 0.45 });
      k.sam_slit({ x: s.x, y: s.y - 14, ang: -Math.PI / 2, len: 340, w: 90, col: S, d: 0.5, life: 1.0 });
      k.sam_bell({ x: s.x, y: s.y - 14, R: 250, col: R, w: 10, n: 20, sq: 0.6, d: 0.5, life: 0.8 });
    },
    thousand_petal_storm(k, s) { // light: two cherry blossoms open on the ground, a ring and a slow fall of petals (the engine plays the storm itself)
      k.sam_flower({ x: s.x, y: s.y, R: 300, n: 5, col: PK, hi: '#fff', rot: s.a0, d: 0.1, life: 1.5 });
      k.sam_flower({ x: s.x, y: s.y, R: 190, n: 5, col: '#ffffff', hi: '#fff', rot: s.a0 + 0.6, d: 0.22, life: 1.4 });
      k.ring({ x: s.x, y: s.y, R: 340, n: 2, w: 10, col: P, d: 0.1 });
      k.motes({ x: s.x, y: s.y - 200, n: 30, type: 'petal', spd: 55, g: 90, size: 9, col: PK, col2: '#fff', spread: TAU, R0: 320, sway: 30, d: 0.1, life: 2.0, opt: true });
    },
    one_perfect_cut(k, s) { // light: one steep white line through a narrow black slit, and a single ring (the engine plays the split and the black screen)
      k.sam_slit({ x: s.x, y: s.y - 40, ang: Math.PI / 2, len: 700, w: 58, col: S, d: 0.7, life: 1.2 });
      k.sam_hair({ x: s.x, y: s.y - 390, ang: Math.PI / 2, len: 700, gap: 22, w: 3, col: R, d: 0.7, life: 1.2 });
      k.ring({ x: s.x, y: s.y, R: 230, n: 1, w: 8, col: '#fff', d: 0.72 });
    },
  },
  routes: {
    thousand_petal_storm: { title: 'THOUSAND PETAL STORM', sub: 'EVERY CUT BLOOMS AT ONCE  ·  PACK FINISHER', sfx: 'ザァァァッ', kanji: '桜', seal: '千', rot: -0.08 },
    crescent_void: { title: 'CRESCENT VOID', sub: 'A FULL-MOON SLASH  ·  PACK FINISHER', sfx: 'ズバァァッ', kanji: '月', seal: '虚', rot: -0.06 },
    void_sheath: { title: 'VOID SHEATH', sub: 'THE BLADE CLICKS HOME  ·  BOSS FINISHER', sfx: 'カチンッ', kanji: '納', seal: '虚', rot: 0.05 },
    one_perfect_cut: { title: 'ONE PERFECT CUT', sub: 'THE VOID SPLITS OPEN  ·  BOSS FINISHER', sfx: 'シィィィン', kanji: '斬', seal: '一', rot: 0.06 },
  },
  notes: {
    iaido: 'Steel afterimages streak down the dash, one thin white line opens a lit gap after you pass, and three small cut marks glow in behind.',
    crescent_parry: 'A thin steel edge and a quiet ring wait during the guard, then a bell-like shockwave with a ring of sparks and a crescent moon mark the counter.',
    sheathe: 'A glint flashes on the hilt as the blade clicks home, a soft ring spreads, petals drift down and a tiny moon rises for the stillness.',
    kesa_slash: 'A black ink brush stroke runs shoulder to hip with one thin white line opening over it, then two cut marks glow in afterwards.',
    void_draw: 'Moonlight orbs gather on the blade while it charges, then a single screen-long white line cuts through a black slit edged in white and cut marks glow along it.',
    void_blade: 'A full moon stands over you and a black slit edged in white opens down the draw line, with a crimson ring, cut marks and petals falling across the field.',
    basic: 'Each swing leaves one thin steel arc; the third swing (Rising Moon) adds a small crescent moon and a few petals.',
    wind_step: 'Two thin lines cut through the pack, there and back, with afterimages, drifting feathers and cut marks left on the target.',
    blossom_burst: 'One last diagonal line, a glint at the click of the sheath, then a five-petal blossom opens on the ground and throws petals outward.',
    counter_sheathe: 'The parry rings like a bell at your blade, then the marks on the target snap open in a flash with two crimson shockwave rings.',
    moonlit_guard: 'A full moon rises behind you, a bell ring and a ring of small runes close around the guard, and a moon-white arc follows.',
    petal_rain: 'A fan of crossing thin lines cuts over the pack one after another, petals fall from above and a blossom opens underneath.',
    moment_of_death: 'Marks gather on the target and petals hang motionless under a full moon, then one steep white line opens a black slit through it.',
    twin_moons: 'Two crescent moons face each other across the target and two crossing thin lines cut an X, the second one brighter and crimson.',
    riposte_wave: 'Four crescent moons roll down your aim growing larger, riding a thin line, ending in a glint and a spray of petals.',
    void_echo: 'A black slit edged in white opens along the draw, three thinner lines echo through it and rings of the void spread around the target.',
    stillwater_execution: 'Slow ripples spread across still water under a full moon, then one vertical white line falls with a drop of black ink.',
    crescent_void: 'A big full moon hangs above, a wide black slit edged in white lies across the target with one white line through it and a pale crescent sweeps around.',
    void_sheath: 'Eight cut marks ring the target and all snap open together at the click of the sheath, while a black slit closes and a crimson bell ring spreads.',
    thousand_petal_storm: 'Pack finisher: two cherry blossoms open on the ground with a ring and slowly falling petals, then the full finisher scene plays.',
    one_perfect_cut: 'Boss finisher: one steep white line through a narrow black slit and a single white ring, then the full finisher scene plays.',
  },
};
