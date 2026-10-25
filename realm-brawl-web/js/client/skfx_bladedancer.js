// Ninja (bladedancer): silent and sharp. The existing look is crimson/magenta slashes, violet smoke, Marks and clones; this layer adds the quiet details:
// thin red cut lines that open a beat AFTER the blade passed, Mark seals that lock on and shatter, lotus smoke on the ground, shadow-clone silhouettes,
// kunai that pin the floor, a shattering mirror and an eclipsed moon. Everything is small and fast so it never fights the engine's big moments.
import { TAU, clamp, lerp, seeded } from './fxsk_core.js';
import { bloom, ease } from './fxglow.js';

const RED = '#ff2d55', MAG = '#ff3b8a', VIO = '#9a4aff', VIOH = '#d8b8ff', HOT = '#ff8ae0', HI = '#ffd6ec', DEEP = '#1a0214';
const SM = { col: '#8a2cff', b: MAG, hi: VIOH, deep: '#12021e' }; // violet smoke colours

/** A top-down ninja silhouette (shoulders, hood, scarf tail, twin daggers) facing `ang`: a dark body with a glowing outline. */
function ninja(ctx, x, y, ang, sz, a, col, hi, fillA) {
  if (a <= 0.01) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a * fillA; ctx.fillStyle = '#0b0212';
  ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.5, sz * 0.95, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(sz * 0.12, 0, sz * 0.42, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-sz * 0.3, -sz * 0.2); ctx.quadraticCurveTo(-sz * 1.2, -sz * 0.7, -sz * 1.9, -sz * 0.1); ctx.quadraticCurveTo(-sz * 1.2, -sz * 0.2, -sz * 0.3, sz * 0.18); ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'lighter'; bloom(ctx, 0, 0, sz * 2.2, col, 0.32 * a);
  ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.5, sz * 0.95, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(sz * 0.12, 0, sz * 0.42, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-sz * 0.3, -sz * 0.2); ctx.quadraticCurveTo(-sz * 1.2, -sz * 0.7, -sz * 1.9, -sz * 0.1); ctx.stroke();
  ctx.strokeStyle = hi || '#fff'; ctx.lineWidth = 1.6;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sz * 0.4, s * sz * 0.9); ctx.lineTo(sz * 1.35, s * sz * 0.66); ctx.stroke(); }
  ctx.restore();
}
/** A tapered diamond blade of light from (x0,y0) to (x1,y1), `off` px to the side. */
function dia(ctx, x0, y0, x1, y1, w, col, al, off) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, ox = nx * off, oy = ny * off, mx = (x0 + x1) / 2 + ox, my = (y0 + y1) / 2 + oy;
  ctx.globalAlpha = al; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0 + ox, y0 + oy); ctx.lineTo(mx + nx * w, my + ny * w); ctx.lineTo(x1 + ox, y1 + oy); ctx.lineTo(mx - nx * w, my - ny * w); ctx.closePath(); ctx.fill();
}

export default {
  pal: { a: '#ff3b8a', b: '#9a4aff', hi: '#ffd6ec', deep: '#1a0214', ink: '#0c0108', edge: '#ff8fc0' },
  prims: {
    /** A thin red cut line: a white hairline snaps across, then the cut slowly opens into a glowing slit. */
    bd_cut(ctx, c, k) {
      const grow = ease.out(clamp(k / 0.1)), a = 1 - ease.in(clamp((k - 0.22) / 0.78)); if (a <= 0.01) return;
      const ca = Math.cos(c.ang), sa = Math.sin(c.ang), h = c.len / 2, w = c.w * (1 - 0.45 * k), x0 = c.x - ca * h, y0 = c.y - sa * h, x1 = x0 + ca * c.len * grow, y1 = y0 + sa * c.len * grow;
      const slit = ease.out(clamp((k - 0.08) / 0.5)) * c.w * 1.3;
      dia(ctx, x0, y0, x1, y1, w * 3, c.col, 0.26 * a, 0);
      if (slit > 1) { dia(ctx, x0, y0, x1, y1, w * 0.9, c.hi || c.col, 0.85 * a, slit); dia(ctx, x0, y0, x1, y1, w * 0.9, c.hi || c.col, 0.85 * a, -slit); dia(ctx, x0, y0, x1, y1, w * 0.6, c.col, 0.35 * a, 0); }
      else dia(ctx, x0, y0, x1, y1, w * 1.1, c.hi || c.col, 0.85 * a, 0);
      dia(ctx, x0, y0, x1, y1, w * 0.4, '#ffffff', (1 - clamp(k / 0.5)) * a, 0);
      bloom(ctx, x1, y1, w * 5, c.hi || c.col, 0.8 * (1 - clamp(k / 0.3)));
      bloom(ctx, c.x, c.y, Math.min(c.len * 0.4, 70), c.col, 0.35 * a);
    },
    /** A Mark seal (ring, diamond, ticks). mode 'lock': a wide ring closes on the point. 'stamp': it pops in and holds. pop:true: it shatters near the end. */
    bd_mark(ctx, c, k, time) {
      const R = c.R || 26, lock = c.mode === 'lock', popAt = c.pop ? 0.6 : 9, inK = ease.out(clamp(k / (lock ? 0.42 : 0.15))), out = 1 - ease.in(clamp((k - (c.pop ? 0.8 : 0.7)) / 0.3));
      if (k > popAt) { // shatter: the ring flies outward in four shards with a white pop
        const u = clamp((k - popAt) / (1 - popAt)), a = 1 - u, r = R * (1 + 1.6 * ease.out(u));
        bloom(ctx, c.x, c.y, R * 2.4 * (1 - u * 0.5), c.col, 0.8 * a); bloom(ctx, c.x, c.y, R, '#fff', 0.9 * (1 - ease.out(clamp(u / 0.4))), 1);
        ctx.lineCap = 'round'; ctx.strokeStyle = c.hi || '#fff'; ctx.globalAlpha = a; ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) { const an = i * TAU / 4 + Math.PI / 4; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(an) * r * 0.7, c.y + Math.sin(an) * r * 0.7); ctx.lineTo(c.x + Math.cos(an) * r * 1.25, c.y + Math.sin(an) * r * 1.25); ctx.stroke(); }
        ctx.strokeStyle = c.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke(); return;
      }
      const r = lock ? R * (3.2 - 2.2 * inK) : R * (1 + 0.8 * (1 - inK)), a = inK * out; if (a <= 0.01) return;
      bloom(ctx, c.x, c.y, r * 1.6, c.col, 0.4 * a);
      ctx.lineCap = 'round'; ctx.globalAlpha = a; ctx.strokeStyle = c.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(c.x, c.y, r * 1.18, 0, TAU); ctx.stroke();
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(lock ? time * 1.6 : Math.PI / 4); ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 2; ctx.beginPath(); const q = r * 0.62; ctx.moveTo(0, -q); ctx.lineTo(q, 0); ctx.lineTo(0, q); ctx.lineTo(-q, 0); ctx.closePath(); ctx.stroke(); ctx.restore();
      for (let i = 0; i < 4; i++) { const an = i * TAU / 4; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(an) * r * 1.1, c.y + Math.sin(an) * r * 1.1); ctx.lineTo(c.x + Math.cos(an) * r * 1.5, c.y + Math.sin(an) * r * 1.5); ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.13, 0, TAU); ctx.fill();
      if (lock && k > 0.4) bloom(ctx, c.x, c.y, R * 2, '#fff', 0.7 * (1 - clamp((k - 0.4) / 0.2)), 1);
    },
    /** A lotus of smoke on the ground: dark petals with a glowing rim unfold outward, two layers turning against each other. */
    bd_lotus(ctx, c, k) {
      const open = ease.out(clamp(k / 0.3)), a = ease.in(clamp((1 - k) / 0.55)); if (a < 0.01) return;
      ctx.save(); ctx.translate(c.x, c.y + 10); ctx.scale(1, 0.6); const n = c.n || 8;
      for (let layer = 0; layer < 2; layer++) {
        const L = c.R * (layer ? 0.6 : 1) * open, wd = L * 0.3;
        for (let i = 0; i < n; i++) {
          ctx.save(); ctx.rotate(i / n * TAU + layer * Math.PI / n + k * 0.5 * (layer ? -1 : 1));
          ctx.beginPath(); ctx.moveTo(L * 0.1, 0); ctx.quadraticCurveTo(L * 0.55, -wd * 1.6, L, 0); ctx.quadraticCurveTo(L * 0.55, wd * 1.6, L * 0.1, 0); ctx.closePath();
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a * (layer ? 0.5 : 0.62); ctx.fillStyle = c.deep || DEEP; ctx.fill();
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.8; ctx.strokeStyle = layer ? c.hi || '#fff' : c.col; ctx.lineWidth = 2.4; ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore(); bloom(ctx, c.x, c.y + 10, c.R * 0.7 * open, c.b || c.col, 0.3 * a);
    },
    /** A shadow-clone silhouette. appears in a puff; x2,y2 makes it dash there; rev:true makes it dissolve instead of appear. */
    bd_clone(ctx, c, k) {
      const sz = c.size || 30, hold = c.hold ?? 0.6, a = c.rev ? 1 - ease.in(clamp(k / 0.7)) : ease.out(clamp(k / 0.12)) * (1 - ease.in(clamp((k - hold) / (1 - hold))));
      let x = c.x, y = c.y, ang = c.ang;
      if (c.x2 !== undefined) {
        const t0 = c.t0 ?? 0.15, mv = ease.in(clamp((k - t0) / 0.22)); x = lerp(c.x, c.x2, mv); y = lerp(c.y, c.y2, mv); ang = Math.atan2(c.y2 - c.y, c.x2 - c.x);
        if (mv > 0 && mv < 1) for (let j = 1; j <= 3; j++) { const u = Math.max(0, mv - j * 0.13); ninja(ctx, lerp(c.x, c.x2, u), lerp(c.y, c.y2, u), ang, sz, a * 0.4 / j, c.col, c.hi, 0.4); }
      }
      if (!c.rev) bloom(ctx, c.x, c.y, sz * 3, c.col, 0.7 * (1 - clamp(k / 0.25)), 1);
      ninja(ctx, x, y, ang, sz, a, c.col, c.hi, 0.7);
    },
    /** A kunai thrown from (x,y) to (x2,y2): a thin trail while it flies, then it stays stuck in the ground with a small flash. */
    bd_kunai(ctx, c, k) {
      const fl = c.fl || 0.35, f = clamp(k / fl), out = 1 - ease.in(clamp((k - 0.75) / 0.25)), p = ease.in(f), x = lerp(c.x, c.x2, p), y = lerp(c.y, c.y2, p), an = Math.atan2(c.y2 - c.y, c.x2 - c.x), L = (c.size || 11) * 2.4, w = L * 0.2;
      if (f < 1) { const bx = lerp(c.x, c.x2, Math.max(0, p - 0.35)), by = lerp(c.y, c.y2, Math.max(0, p - 0.35)); dia(ctx, bx, by, x, y, 3, c.col, 0.7, 0); dia(ctx, bx, by, x, y, 1.2, '#fff', 0.9, 0); }
      else { const u = clamp((k - fl) / 0.25); bloom(ctx, c.x2, c.y2, 46 * (1 - u * 0.5), c.col, 0.8 * (1 - u) * out); }
      ctx.save(); ctx.translate(x, y); ctx.rotate(an); ctx.globalAlpha = out; bloom(ctx, 0, 0, L * 1.3, c.col, 0.4);
      ctx.fillStyle = '#e6e0f4'; ctx.beginPath(); ctx.moveTo(L, 0); ctx.lineTo(0, -w); ctx.lineTo(-L * 0.18, 0); ctx.lineTo(0, w); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.col; ctx.fillRect(-L * 0.55, -w * 0.5, L * 0.4, w); ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(-L * 0.72, 0, L * 0.17, 0, TAU); ctx.stroke(); ctx.restore();
    },
    /** An eclipsed moon: a dark disc with a thin bright rim, a brighter crescent on one side and a short corona of rays. */
    bd_moon(ctx, c, k, time) {
      const a = ease.out(clamp(k / 0.22)) * ease.in(clamp((1 - k) / 0.3)), R = c.R * (0.85 + 0.15 * ease.out(clamp(k / 0.3))); if (a < 0.01) return;
      bloom(ctx, c.x, c.y, R * 2, c.col, 0.45 * a);
      const rs = seeded(c.seed); ctx.lineCap = 'round'; ctx.strokeStyle = c.hi || '#fff';
      for (let i = 0; i < 20; i++) { const an = i / 20 * TAU + time * 0.15, l0 = R * 1.05, l1 = R * (1.2 + rs() * 0.45); ctx.globalAlpha = a * (0.3 + rs() * 0.4); ctx.lineWidth = 1.5 + rs() * 1.5; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(an) * l0, c.y + Math.sin(an) * l0); ctx.lineTo(c.x + Math.cos(an) * l1, c.y + Math.sin(an) * l1); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.92 * a; ctx.fillStyle = '#05000a'; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8 * a; ctx.strokeStyle = c.col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.stroke();
      ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.stroke();
      const ph = c.ph ?? -0.6; ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(c.x, c.y, R * 0.97, ph - 0.85, ph + 0.85); ctx.stroke();
      bloom(ctx, c.x + Math.cos(ph) * R, c.y + Math.sin(ph) * R, R * 0.5, '#fff', 0.6 * a);
    },
    /** A pane of dark glass that cracks and shatters into shards (mirror strike). */
    bd_mirror(ctx, c, k) {
      const H = c.h || 210, W = H * 0.46, fadeIn = ease.out(clamp(k / 0.25)), crack = clamp((k - 0.3) / 0.15), sh = clamp((k - 0.46) / 0.54), rs = seeded(c.seed);
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot || 0);
      if (sh <= 0) {
        const a = fadeIn; ctx.globalAlpha = 0.16 * a; ctx.fillStyle = c.col; ctx.fillRect(-W / 2, -H / 2, W, H);
        ctx.globalAlpha = a; ctx.strokeStyle = c.col; ctx.lineWidth = 3; ctx.strokeRect(-W / 2, -H / 2, W, H); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.strokeRect(-W / 2 + 4, -H / 2 + 4, W - 8, H - 8);
        const g = ease.out(clamp((k - 0.1) / 0.3)); ctx.globalAlpha = a * (1 - g) * 0.9; ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-W / 2 + W * g, -H / 2); ctx.lineTo(-W / 2 + W * g - W * 0.5, H / 2); ctx.stroke();
        ctx.globalAlpha = a * crack; ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 1.8; ctx.beginPath();
        for (let i = 0; i < 6; i++) { let x = 0, y = 0, an = rs() * TAU; ctx.moveTo(0, 0); for (let s = 0; s < 3; s++) { an += (rs() - 0.5) * 1.1; x += Math.cos(an) * H * 0.2 * crack; y += Math.sin(an) * H * 0.2 * crack; ctx.lineTo(x, y); } } ctx.stroke();
        bloom(ctx, 0, 0, H * 0.6, c.col, 0.25 * a);
      } else {
        const a = 1 - sh; bloom(ctx, 0, 0, H * 0.5, '#fff', 0.8 * (1 - ease.out(clamp(sh / 0.3))), 1); ctx.fillStyle = c.hi || '#fff'; ctx.strokeStyle = c.col; ctx.lineWidth = 1.6;
        for (let i = 0; i < 16; i++) { const an = rs() * TAU, v = (80 + rs() * 220) * ease.out(sh), sx = Math.cos(an) * v * 0.9, sy = Math.sin(an) * v, sz = 8 + rs() * 16, rot = rs() * TAU + sh * (rs() - 0.5) * 8; ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot); ctx.globalAlpha = a * 0.9; ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.6, sz * 0.5); ctx.lineTo(-sz * 0.4, -sz * 0.6); ctx.closePath(); ctx.globalAlpha = a * 0.55; ctx.fill(); ctx.globalAlpha = a; ctx.stroke(); ctx.restore(); }
      }
      ctx.restore();
    },
  },
  skills: {
    flicker(k) { // a violet afterimage dash, then thin red cuts open across the path and Mark seals blink above the cut enemies
      const e = k.ahead(280), a = k.ang;
      k.flash({ x: k.x, y: k.y, R: 70, col: VIO, d: 0 });
      k.ghost({ x: k.x, y: k.y, x2: e.x, y2: e.y, n: 5, size: 15, col: '#7a2ad0', hi: VIOH, d: 0.02, life: 0.55 });
      k.streak({ x: k.x, y: k.y, ang: a, len: 280, w: 7, col: MAG, hi: HI, d: 0.04, life: 0.3, ticks: 3 });
      for (let i = 0; i < 3; i++) {
        const sd = i % 2 ? 1 : -1, p = k.ahead(90 + i * 80, sd * 8);
        k.bd_cut({ x: p.x, y: p.y, ang: a + sd * 1.05, len: 130, w: 5, col: RED, hi: HI, d: 0.18 + i * 0.09, life: 0.55 });
        k.bd_mark({ x: p.x, y: p.y - 34, R: 15, col: MAG, hi: HI, mode: 'stamp', d: 0.26 + i * 0.09, life: 0.8, opt: i > 0 });
      }
      k.flash({ x: e.x, y: e.y, R: 70, col: MAG, d: 0.12 });
    },
    heartseeker(k) { // a seal locks on the heart, a thin streak leaps in, and a single red cut drops through it a beat later
      const t = { x: k.tx, y: k.ty }, an = Math.atan2(t.y - k.y, t.x - k.x);
      k.bd_mark({ x: t.x, y: t.y - 30, R: 32, col: RED, hi: HI, mode: 'lock', d: 0.02, life: 0.6 });
      k.streak({ x: k.x, y: k.y - 10, ang: an, len: k.dist + 30, w: 8, col: MAG, hi: HI, d: 0.06, life: 0.3, ticks: 2 });
      k.bd_cut({ x: t.x, y: t.y - 30, ang: Math.PI / 2, len: 170, w: 6, col: RED, hi: HI, d: 0.34, life: 0.6 });
      k.motes({ x: t.x, y: t.y - 30, n: 12, type: 'spark', spd: 280, size: 6, col: RED, col2: '#fff', spread: TAU, g: 260, d: 0.34 });
      k.burst({ x: t.x, y: t.y - 30, n: 6, len: 90, col: RED, hi: HI, d: 0.34, life: 0.5 });
    },
    vanish(k) { // a lotus of smoke opens on the ground, the body dissolves into rising pixels and a pale afterimage backflips away
      const b = k.ahead(-190);
      k.bd_lotus({ x: k.x, y: k.y, R: 150, n: 8, ...SM, d: 0, life: 1.0, under: true });
      k.bd_clone({ x: k.x, y: k.y, ang: k.ang, size: 28, col: VIO, hi: VIOH, rev: true, d: 0.02, life: 0.6 });
      k.ring({ x: k.x, y: k.y, R: 130, col: VIO, d: 0.04 });
      k.ghost({ x: k.x, y: k.y, x2: b.x, y2: b.y, n: 4, size: 14, col: '#5a1eb0', hi: VIOH, d: 0.06, life: 0.5 });
      k.motes({ x: k.x, y: k.y - 10, n: 22, type: 'pix', spd: 130, g: -120, size: 6, col: VIO, col2: HOT, ang: -Math.PI / 2, spread: 2.6, R0: 36, d: 0.04 });
    },
    thousandcuts(k) { // a cage of thin red lines: nine cuts open one after another around the target while shadows blink from point to point
      const x = k.tx, y = k.ty, R = seeded((k.ev.x | 0) + 7), pts = [];
      for (let i = 0; i < 4; i++) { const an = i / 4 * TAU + 0.5; pts.push({ x: x + Math.cos(an) * 105, y: y + Math.sin(an) * 70 }); }
      for (let i = 0; i < 4; i++) { const p = pts[i], q = pts[(i + 1) % 4]; k.flash({ x: p.x, y: p.y, R: 50, col: MAG, d: 0.04 + i * 0.1 }); k.streak({ x: p.x, y: p.y, ang: Math.atan2(q.y - p.y, q.x - p.x), len: Math.hypot(q.x - p.x, q.y - p.y), w: 5, col: VIO, hi: VIOH, d: 0.06 + i * 0.1, life: 0.25 }); }
      for (let i = 0; i < 9; i++) k.bd_cut({ x: x + (R() - 0.5) * 50, y: y + (R() - 0.5) * 40 - 10, ang: i * 0.7 + R() * 0.3, len: 150 + R() * 70, w: 4.5, col: RED, hi: HI, d: 0.1 + i * 0.06, life: 0.55 });
      k.sigil({ x, y, R: 130, n: 5, col: RED, hi: HI, b: VIO, d: 0.08, life: 1.0, hold: 0.6, opt: true });
      k.burst({ x, y: y - 10, n: 10, len: 130, col: RED, hi: HI, d: 0.6, life: 0.5 });
    },
    shadow_clone(k) { // a lotus smoke bomb at the 160 px blast edge and two clone silhouettes stepping out beside the ninja
      k.bd_lotus({ x: k.x, y: k.y, R: 170, n: 10, ...SM, d: 0.1, life: 1.1, under: true });
      k.sigil({ x: k.x, y: k.y, R: 150, n: 4, col: VIO, hi: VIOH, b: MAG, d: 0.1, life: 1.4, hold: 0.7 });
      for (const s of [-1, 1]) { const p = k.ahead(-10, s * 95); k.bd_clone({ x: p.x, y: p.y, ang: k.ang, size: 28, col: s < 0 ? VIO : MAG, hi: VIOH, d: 0.22, life: 1.6, hold: 0.7 }); k.motes({ x: p.x, y: p.y, n: 8, type: 'pix', spd: 120, g: -80, size: 6, col: VIO, ang: -Math.PI / 2, spread: 2.4, d: 0.22 }); }
      k.ring({ x: k.x, y: k.y, R: 160, col: VIO, d: 0.1 });
      k.motes({ x: k.x, y: k.y, n: 10, type: 'shuriken', spd: 300, size: 6, col: VIO, spread: TAU, d: 0.14, opt: true });
    },
  },
  basic(k, ev) { // a single thin red cut after the dagger; the 5th (Crossing Fang) is an X and a pop
    const i = ev.idx | 0, p = k.ahead(48), sd = i % 2 ? 1 : -1;
    if (i === 4) { k.bd_cut({ x: p.x, y: p.y, ang: k.ang + 0.9, len: 110, w: 5, col: RED, hi: HI, d: 0.05, life: 0.45 }); k.bd_cut({ x: p.x, y: p.y, ang: k.ang - 0.9, len: 110, w: 5, col: RED, hi: HI, d: 0.1, life: 0.45 }); k.burst({ x: p.x, y: p.y, n: 6, len: 60, col: RED, hi: HI, d: 0.1, life: 0.4, opt: true }); }
    else if (i === 2) k.bd_cut({ x: p.x + k.ca * 14, y: p.y + k.sa * 14, ang: k.ang, len: 100, w: 4, col: MAG, hi: HI, d: 0.04, life: 0.4 });
    else if (i === 3) k.arc({ x: k.x, y: k.y, a0: k.ang - 2.2, sw: 4.4, r: 62, w: 7, col: VIO, hi: VIOH, d: 0.03, life: 0.3, sq: 0.9 });
    else k.bd_cut({ x: p.x, y: p.y, ang: k.ang + sd * 1.1, len: 90, w: 4, col: RED, hi: HI, d: 0.05, life: 0.4 });
  },
  ult(k) { // Eclipse: kunai pin a ring of the floor around the ninja, a sigil of seals lights between them and a thin crimson halo turns overhead (the big moment is the engine's)
    const x = k.x, y = k.y, n = 8;
    k.sigil({ x, y, R: 270, n: 8, col: VIO, hi: VIOH, b: RED, d: 0.1, life: 2.0, hold: 0.8 });
    for (let i = 0; i < n; i++) { const a = i / n * TAU + 0.2, tx = x + Math.cos(a) * 230, ty = y + Math.sin(a) * 140; k.bd_kunai({ x: tx + Math.cos(a) * 30 - 40, y: ty - 340, x2: tx, y2: ty, size: 12, col: RED, hi: HI, fl: 0.3, d: 0.12 + i * 0.045, life: 1.2 }); }
    k.arc({ x, y: y - 20, a0: -2.8, sw: TAU, r: 200, w: 6, col: RED, hi: HI, d: 0.3, life: 0.8, sq: 0.5 });
    k.ring({ x, y, R: 300, n: 2, w: 20, col: VIO, d: 0.55 });
    k.motes({ x, y, n: 18, type: 'shuriken', spd: 380, size: 7, col: VIO, col2: HOT, spread: TAU, d: 0.5, opt: true });
  },
  chains: {
    shadow_strike(k, s) { // flicker's trail ends in a lock-on seal, then a cross of two cuts pops the Mark
      k.ghost({ x: k.x, y: k.y, x2: s.x, y2: s.y, n: 4, size: 15, col: '#7a2ad0', hi: VIOH });
      k.bd_mark({ x: s.x, y: s.y - 34, R: 34, col: RED, hi: HI, mode: 'lock', pop: true, d: 0.1, life: 0.8 });
      k.bd_cut({ x: s.x, y: s.y - 20, ang: Math.PI / 2 + 0.25, len: 190, w: 6, col: RED, hi: HI, d: 0.4, life: 0.6 });
      k.bd_cut({ x: s.x, y: s.y - 20, ang: Math.PI / 2 - 0.25, len: 190, w: 6, col: RED, hi: HI, d: 0.46, life: 0.6 });
      k.motes({ x: s.x, y: s.y - 30, n: 14, type: 'spark', spd: 320, size: 6, col: RED, col2: '#fff', spread: TAU, g: 260, d: 0.42 });
    },
    marked_for_death(k, s) { // five seals stamp one by one in a ring above the target; the last one holds under a thin cut
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2, p = { x: s.x + Math.cos(a) * 90, y: s.y - 46 + Math.sin(a) * 44 }; k.bd_mark({ x: p.x, y: p.y, R: 20, col: i === 4 ? RED : MAG, hi: HI, mode: 'stamp', d: 0.05 + i * 0.11, life: 1.0 }); k.bd_cut({ x: p.x, y: p.y + 10, ang: a + 1.5, len: 80, w: 4, col: RED, hi: HI, d: 0.12 + i * 0.11, life: 0.5, opt: i % 2 > 0 }); }
      k.bd_mark({ x: s.x, y: s.y - 46, R: 44, col: RED, hi: HI, mode: 'lock', pop: true, d: 0.65, life: 0.8 });
      k.sigil({ x: s.x, y: s.y, R: 120, n: 5, col: MAG, hi: HI, b: VIO, d: 0.05, life: 1.3, hold: 0.7 });
    },
    shadow_step(k, s) { // a decoy silhouette is left behind in smoke while a ghost path ends with a pale flash behind the target
      const bx = s.x + k.ca * 80, by = s.y + k.sa * 80;
      k.bd_clone({ x: k.x, y: k.y, ang: k.ang, size: 26, col: VIO, hi: VIOH, d: 0, life: 1.4, hold: 0.7 });
      k.bd_lotus({ x: k.x, y: k.y, R: 90, n: 6, ...SM, d: 0, life: 0.8, under: true });
      k.ghost({ x: k.x, y: k.y, x2: bx, y2: by, n: 5, size: 14, col: '#5a1eb0', hi: VIOH, d: 0.04 });
      k.flash({ x: bx, y: by, R: 90, col: VIO, d: 0.16 });
      k.bd_cut({ x: s.x, y: s.y, ang: k.ang + Math.PI / 2 + 0.3, len: 130, w: 5, col: RED, hi: HI, d: 0.32, life: 0.5 });
    },
    shadow_pierce(k, s) { // a long line through the whole row: a thin streak, and a short red cut crosses it at each enemy a moment later
      const L = Math.max(k.dist, 120) + 220;
      k.streak({ x: k.x, y: k.y, ang: k.ang, len: L, w: 8, col: VIO, hi: VIOH, d: 0.02, life: 0.35, ticks: 4 });
      for (let i = 0; i < 4; i++) { const p = k.ahead(120 + i * (L - 160) / 3); k.bd_cut({ x: p.x, y: p.y, ang: k.ang + Math.PI / 2 + (i % 2 ? 0.35 : -0.35), len: 110, w: 5, col: RED, hi: HI, d: 0.2 + i * 0.07, life: 0.5 }); k.motes({ x: p.x, y: p.y, n: 6, type: 'spark', spd: 220, size: 5, col: RED, spread: TAU, d: 0.2 + i * 0.07, g: 200, opt: i > 1 }); }
    },
    crimson_flurry(k, s) { // marked enemies are hunted: a hopping red path jumps between small seals and each hop leaves a cut
      const pts = []; for (let i = 0; i < 5; i++) { const a = s.a0 + i * 2.5; pts.push({ x: s.x + Math.cos(a) * (70 + (i % 2) * 40), y: s.y + Math.sin(a) * (45 + (i % 2) * 25) }); }
      pts.forEach((p, i) => { k.bd_mark({ x: p.x, y: p.y - 30, R: 14, col: MAG, hi: HI, mode: 'stamp', pop: true, d: 0.03 + i * 0.09, life: 0.7 }); if (i) k.bd_cut({ x: (p.x + pts[i - 1].x) / 2, y: (p.y + pts[i - 1].y) / 2, ang: Math.atan2(p.y - pts[i - 1].y, p.x - pts[i - 1].x), len: Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) + 40, w: 5, col: RED, hi: HI, d: 0.1 + i * 0.09, life: 0.5 }); });
      k.motes({ x: s.x, y: s.y - 10, n: 18, type: 'petal', spd: 200, g: 120, size: 7, col: RED, col2: HOT, spread: TAU, d: 0.4, life: 1.3, opt: true });
    },
    death_blossom(k, s) { // five cuts cross through one point like the lines of a flower, with dark red petals rising from it
      const R = s.sc;
      for (let i = 0; i < 5; i++) k.bd_cut({ x: s.x, y: s.y - 10, ang: s.a0 + i * Math.PI / 5, len: 220 * R / 1.25, w: 5, col: i % 2 ? MAG : RED, hi: HI, d: 0.06 + i * 0.07, life: 0.6 });
      k.motes({ x: s.x, y: s.y, n: 30, type: 'petal', spd: 240, g: -50, size: 9, col: '#c4143c', col2: HOT, sway: 24, ang: -Math.PI / 2, spread: 3.2, d: 0.35, life: 1.6, R0: 40 });
      k.bd_lotus({ x: s.x, y: s.y, R: 120, n: 5, col: RED, hi: HI, b: MAG, deep: '#2a0210', d: 0.1, life: 1.0, under: true });
    },
    shadow_execution(k, s) { // clones step in from every side one after another, each stabbing the Marked target; a dark tear and a last cut close it
      const n = 5;
      for (let i = 0; i < n; i++) { const a = s.a0 + i / n * TAU, d = 190; k.bd_clone({ x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d * 0.65, x2: s.x + Math.cos(a) * 36, y2: s.y + Math.sin(a) * 24, size: 24, col: i % 2 ? VIO : MAG, hi: VIOH, t0: 0.12, d: i * 0.08, life: 0.8, hold: 0.55 }); k.bd_cut({ x: s.x, y: s.y - 10, ang: a + Math.PI / 2 * 0.6, len: 120, w: 4, col: RED, hi: HI, d: 0.18 + i * 0.08, life: 0.5, opt: i > 2 }); }
      k.rift({ x: s.x, y: s.y, R: 110, ang: s.a0, tall: 0.3, col: MAG, hi: HI, deep: '#12021e', d: 0.5 });
      k.bd_cut({ x: s.x, y: s.y - 30, ang: Math.PI / 2, len: 260, w: 7, col: RED, hi: HI, d: 0.62, life: 0.7 });
    },
    eviscerate(k, s) { // every cut piles onto one spot: a fan of red cuts at growing lengths and blood spray, then a deep vertical rip
      for (let i = 0; i < 7; i++) k.bd_cut({ x: s.x, y: s.y - 14, ang: -1.2 + i * 0.4 + (i % 2) * 0.1, len: 120 + i * 24, w: 3.5 + i * 0.5, col: RED, hi: HI, d: 0.04 + i * 0.07, life: 0.55 });
      k.motes({ x: s.x, y: s.y - 14, n: 28, type: 'ember', spd: 360, g: 520, size: 6, col: '#e02040', col2: '#fff', spread: 3.4, ang: -Math.PI / 2, d: 0.2, life: 1.0 });
      k.bd_cut({ x: s.x, y: s.y - 20, ang: Math.PI / 2, len: 340, w: 9, col: RED, hi: HI, d: 0.62, life: 0.8 });
      k.ring({ x: s.x, y: s.y, R: 130, col: RED, d: 0.62 });
    },
    smoke_lotus(k, s) { // a big lotus of smoke blooms around the target, kunai fly out along every petal and pin the ground
      k.bd_lotus({ x: s.x, y: s.y, R: 250, n: 10, ...SM, d: 0.05, life: 1.4, under: true });
      k.bd_lotus({ x: s.x, y: s.y, R: 160, n: 8, col: RED, hi: HI, b: MAG, deep: '#2a0210', d: 0.25, life: 1.1, under: true });
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + 0.15, tx = s.x + Math.cos(a) * 210, ty = s.y + Math.sin(a) * 130; k.bd_kunai({ x: s.x, y: s.y - 20, x2: tx, y2: ty, size: 11, col: i % 2 ? VIO : RED, hi: HI, fl: 0.25, d: 0.32 + i * 0.03, life: 1.0 }); }
      k.motes({ x: s.x, y: s.y, n: 22, type: 'pix', spd: 120, g: -100, size: 6, col: VIO, col2: HOT, ang: -Math.PI / 2, spread: 2.8, R0: 100, d: 0.1 });
    },
    mirror_execution(k, s) { // a pane of dark glass stands at the target with a clone on each side; it shatters and a mirrored X of cuts lands
      const sp = 150;
      k.bd_mirror({ x: s.x, y: s.y - 70, h: 230, rot: 0.12, col: VIO, hi: VIOH, d: 0.02, life: 1.1 });
      for (const sd of [-1, 1]) { k.bd_clone({ x: s.x + sd * sp, y: s.y + 6, ang: sd < 0 ? 0 : Math.PI, size: 27, col: sd < 0 ? MAG : VIO, hi: VIOH, d: 0.05, life: 1.1, hold: 0.6 }); k.bd_cut({ x: s.x, y: s.y - 20, ang: sd * 0.75 - Math.PI / 2 + 0.6 * sd, len: 250, w: 6, col: RED, hi: HI, d: 0.6 + (sd > 0 ? 0.06 : 0), life: 0.6 }); }
      k.bd_mark({ x: s.x, y: s.y - 40, R: 40, col: RED, hi: HI, mode: 'lock', pop: true, d: 0.35, life: 0.8 });
      k.burst({ x: s.x, y: s.y - 30, n: 8, len: 120, col: RED, hi: HI, d: 0.62, life: 0.5 });
    },
    clone_barrage(k, s) { // eight shadow copies close a circle and dash in; kunai rain on the middle in a red-and-violet burst
      const n = 8;
      for (let i = 0; i < n; i++) { const a = i / n * TAU + s.a0, d = 230; k.bd_clone({ x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d * 0.62, x2: s.x + Math.cos(a) * 30, y2: s.y + Math.sin(a) * 20, size: 25, col: i % 2 ? VIO : MAG, hi: VIOH, t0: 0.14, d: i * 0.05, life: 0.85, hold: 0.55 }); }
      k.bd_lotus({ x: s.x, y: s.y, R: 220, n: 9, ...SM, d: 0.1, life: 1.2, under: true });
      for (let i = 0; i < 5; i++) { const a = i * 1.3 + s.a0, tx = s.x + Math.cos(a) * 70, ty = s.y + Math.sin(a) * 45; k.bd_kunai({ x: tx + 40, y: ty - 360, x2: tx, y2: ty, size: 11, col: RED, hi: HI, fl: 0.28, d: 0.45 + i * 0.05, life: 0.9 }); }
      for (let i = 0; i < 6; i++) k.bd_cut({ x: s.x, y: s.y - 12, ang: s.a0 + i * 0.52, len: 260, w: 4.5, col: RED, hi: HI, d: 0.5 + i * 0.04, life: 0.55, opt: i > 3 });
      k.motes({ x: s.x, y: s.y, n: 26, type: 'shuriken', spd: 460, size: 7, col: VIO, col2: HOT, spread: TAU, d: 0.5, life: 1.0 });
    },
    shadow_heartseeker(k, s) { // the whole screen narrows to one point: a wide seal closes to the heart and a single long thin beam pierces straight through it
      const an = Math.atan2(s.y - k.y, s.x - k.x);
      k.bd_mark({ x: s.x, y: s.y - 30, R: 50, col: RED, hi: HI, mode: 'lock', d: 0.02, life: 0.7 });
      k.bd_mark({ x: s.x, y: s.y - 30, R: 30, col: MAG, hi: HI, mode: 'lock', pop: true, d: 0.12, life: 0.85 });
      k.sigil({ x: s.x, y: s.y, R: 180, n: 7, col: RED, hi: HI, b: VIO, d: 0.05, life: 1.2, hold: 0.6 });
      k.beam({ x: s.x - Math.cos(an) * 520, y: s.y - 30 - Math.sin(an) * 520, x2: s.x + Math.cos(an) * 320, y2: s.y - 30 + Math.sin(an) * 320, w: 9, col: RED, hi: HI, d: 0.5, life: 0.6 });
      k.bd_cut({ x: s.x, y: s.y - 30, ang: Math.PI / 2, len: 300, w: 6, col: RED, hi: HI, d: 0.55, life: 0.7 });
      k.motes({ x: s.x, y: s.y - 30, n: 24, type: 'petal', spd: 260, g: 90, size: 8, col: RED, col2: HOT, spread: TAU, d: 0.55, life: 1.4 });
    },
    ten_thousand_cuts(k, s) { // light route entry: a swarm of crescents and cuts in the air that the engine's finale then detonates
      const R = seeded(1031);
      for (let i = 0; i < 9; i++) k.arc({ x: s.x + (R() - 0.5) * 300, y: s.y - 40 + (R() - 0.5) * 160, a0: R() * TAU, sw: 1.8 + R(), r: 34 + R() * 34, w: 5, col: RED, hi: HI, d: 0.05 + i * 0.07, life: 0.5, sq: 0.8, opt: i > 4 });
      for (let i = 0; i < 6; i++) k.bd_cut({ x: s.x + (R() - 0.5) * 120, y: s.y - 10 + (R() - 0.5) * 80, ang: R() * TAU, len: 220, w: 4, col: RED, hi: HI, d: 0.1 + i * 0.07, life: 0.55 });
      k.bd_lotus({ x: s.x, y: s.y, R: 260, n: 12, ...SM, d: 0.05, life: 1.3, under: true });
    },
    crescent_execution(k, s) { // light route entry: an eclipsed moon rises behind the target and three clones ring it
      k.bd_moon({ x: s.x, y: s.y - 230, R: 120, col: MAG, hi: HI, ph: -0.7, d: 0.02, life: 1.6 });
      for (let i = 0; i < 3; i++) { const a = s.a0 + i / 3 * TAU; k.bd_clone({ x: s.x + Math.cos(a) * 170, y: s.y + Math.sin(a) * 110, x2: s.x + Math.cos(a) * 36, y2: s.y + Math.sin(a) * 24, size: 26, col: i % 2 ? VIO : MAG, hi: VIOH, t0: 0.3, d: 0.1 + i * 0.07, life: 0.9, hold: 0.55 }); }
      k.bd_cut({ x: s.x, y: s.y - 40, ang: Math.PI / 2, len: 360, w: 8, col: RED, hi: HI, d: 0.6, life: 0.8 });
    },
  },
  routes: {
    ten_thousand_cuts: { title: 'TEN THOUSAND CUTS', sub: 'ECLIPSE  ·  A MOON OF CRESCENTS  ·  PACK FINISHER', sfx: 'ザザザザッ', kanji: '萬', rot: -0.14 },
    crescent_execution: { title: 'CRESCENT EXECUTION', sub: 'ECLIPSE  ·  THE MOON FALLS  ·  BOSS FINISHER', sfx: 'ズバァッ', kanji: '月', rot: 0.1 },
  },
  notes: {
    flicker: 'A violet afterimage dash, then thin red cuts open across the path a beat late with a small Mark seal blinking above each one.',
    heartseeker: 'A seal closes on the target, a thin streak leaps in, and one red cut drops through the heart a moment later with a few sparks.',
    vanish: 'A lotus of smoke opens on the ground while the ninja dissolves into rising pixels and a pale afterimage flips backward.',
    thousandcuts: 'Shadows blink between four points around the target while nine thin red cuts open one after another, then a small seal circle closes.',
    shadow_clone: 'A lotus of violet smoke opens with a rune circle, and two dark clone silhouettes step out on either side of the ninja.',
    basic: 'Each swing leaves one thin red cut line a moment after the blade; the fifth makes a small X with a pop.',
    eclipse: 'Eight kunai drop and pin a ring of the floor around the ninja inside a rune circle, with a thin crimson halo and a ground ring.',
    shadow_strike: 'The dash trail ends in a seal that locks on and shatters, then two red cuts cross through the target.',
    marked_for_death: 'Five Mark seals stamp one at a time in a ring above the target, each with a small cut, then a big seal locks in the middle and shatters.',
    shadow_step: 'A smoky decoy silhouette stays behind while a ghost path ends in a violet flash behind the target.',
    shadow_pierce: 'A long violet streak runs through the whole row and a short red cut crosses it at every enemy a moment later.',
    crimson_flurry: 'A hopping red path jumps between small Mark seals around the target, leaving a cut and a shattering seal at each stop.',
    death_blossom: 'Five thin red cuts cross at one point like the lines of a flower while dark red petals rise from a smoke lotus.',
    shadow_execution: 'Five clones dash in from every side one after another, a dark tear opens under the target and one long cut falls through it.',
    eviscerate: 'A fan of seven red cuts of growing length piles onto one spot with blood spray, then one deep vertical rip.',
    smoke_lotus: 'A huge lotus of violet and red smoke blooms at the target and ten kunai fly out along the petals and pin the ground.',
    mirror_execution: 'A pane of dark glass stands at the target with a clone on each side, shatters into shards, and a mirrored pair of cuts lands.',
    clone_barrage: 'Eight shadow copies close a circle and dash in while kunai rain on the middle and a burst of red cuts and shuriken flies out.',
    shadow_heartseeker: 'Two seals close on the heart, then one long thin red beam pierces straight through it with a vertical cut and falling petals.',
    ten_thousand_cuts: 'Pack finisher: a swarm of small red crescents and cut lines hangs in the air over a wide smoke lotus before the full finisher moment.',
    crescent_execution: 'Boss finisher: an eclipsed moon rises behind the target, three clones dash in, and one tall red cut falls before the full finisher moment.',
  },
};
