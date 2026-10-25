// Mage (Arcane / Frost / Fire): the class is built from layered magic circles. Violet arcane glyph circles spin on the ground, cyan frost flakes and ice crystals
// freeze the area, orange meteors with burning ground fall from the sky, and time / gravity moves (chrono clock, singularity) pull everything inward.
// Violet = arcane (Blink, Arcane Blast), cyan = frost (Frost Nova), orange = fire (Meteors), the same colours the engine's own mage effects already use.
import { TAU, clamp, seeded } from './fxsk_core.js';
import { bloom, ease, ribbon } from './fxglow.js';

const C = { vio: '#9d7bff', cy: '#5ee0ff', or: '#ff7a2c', gold: '#ffd23f', ice: '#9fe8ff', hi: '#efe8ff', deep: '#120a2a', ember: '#ff9a3c', fire: '#fff1c8' };
const tgt = (k, range) => (k.dist <= range ? { x: k.tx, y: k.ty } : k.ahead(range)); // where a cursor skill lands

// ------------------------------------------------------------------ the class's own pieces
const poly = (ctx, n, r, rot, step = 1) => { ctx.beginPath(); for (let i = 0; i <= n; i++) { const an = rot + i * step / n * TAU - Math.PI / 2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * r, Math.sin(an) * r); } ctx.stroke(); };
const circ = (ctx, r) => { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); };

const prims = {
  /** Layered arcane circle: stacked rings that spin against each other, each layer with its own polygon (hexagram, octagram, pentagram), ticks and glyph blocks. rise lifts the layers into the air. */
  mage_circle(ctx, c, k, time) {
    const outK = ease.in(clamp((1 - k) / 0.28)), hold = c.hold ?? 0.8, L = c.layers || 3, ext = k > hold ? 1 + (k - hold) * 1.3 : 1;
    for (let i = 0; i < L; i++) {
      const la = ease.out(clamp((k - i * 0.07) / 0.2)) * outK; if (la < 0.01) continue;
      const u = L > 1 ? i / (L - 1) : 0, r = c.R * (1 - u * 0.36) * (0.8 + 0.2 * la) * ext, dir = i % 2 ? -1 : 1, sp = time * (c.spin || 0.9) * dir * (1 + i * 0.35);
      const col = i % 2 ? (c.b || c.col) : c.col, y = c.y + 14 - (c.rise || 0) * i * la;
      ctx.save(); ctx.translate(c.x, y); ctx.scale(1, c.sq || 0.55); ctx.lineCap = 'round';
      ctx.globalAlpha = la * 0.85; ctx.strokeStyle = col; ctx.lineWidth = 6 - u * 2.5; circ(ctx, r);
      ctx.globalAlpha = la * 0.7; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; circ(ctx, r);
      ctx.globalAlpha = la * 0.7; ctx.strokeStyle = c.hi || col; ctx.lineWidth = 2; circ(ctx, r * 0.9);
      ctx.save(); ctx.rotate(sp * 0.5); ctx.lineWidth = 2;
      for (let t = 0; t < 36; t++) { const an = t / 36 * TAU, big = t % 3 === 0; ctx.globalAlpha = la * (big ? 0.8 : 0.45); ctx.strokeStyle = big ? '#fff' : (c.hi || col); ctx.beginPath(); ctx.moveTo(Math.cos(an) * r * (big ? 0.84 : 0.88), Math.sin(an) * r * (big ? 0.84 : 0.88)); ctx.lineTo(Math.cos(an) * r * 0.97, Math.sin(an) * r * 0.97); ctx.stroke(); }
      ctx.restore();
      ctx.save(); ctx.rotate(-sp * 0.8); ctx.globalAlpha = la * 0.9; ctx.strokeStyle = c.hi || col; ctx.lineWidth = 2.4;
      const kind = i % 3, rr = r * 0.74;
      if (kind === 0) { poly(ctx, 3, rr, 0); poly(ctx, 3, rr, Math.PI / 3); } else if (kind === 1) { poly(ctx, 4, rr, 0); poly(ctx, 4, rr, Math.PI / 4); } else poly(ctx, 5, rr, 0, 2);
      ctx.fillStyle = col; for (let g = 0; g < 8; g++) { const an = g / 8 * TAU, w = r * 0.035; ctx.save(); ctx.translate(Math.cos(an) * r * 0.62, Math.sin(an) * r * 0.62); ctx.rotate(an); ctx.globalAlpha = la * 0.8; ctx.fillRect(-w * 1.4, -w, w * 2.8, w * 2); ctx.restore(); }
      ctx.restore(); ctx.restore();
      if (!i) bloom(ctx, c.x, y, r * 1.1, col, 0.3 * la);
    }
  },
  /** A six-armed ice crystal that grows on the ground (or upright with up:true), then fades. */
  mage_flake(ctx, c, k, time) {
    const gr = ease.out(clamp(k / 0.3)), a = ease.in(clamp((1 - k) / 0.4)) * clamp(k / 0.05), R = c.R * gr; if (a < 0.01) return;
    ctx.save(); ctx.translate(c.x, c.y + (c.up ? 0 : 14)); ctx.scale(1, c.up ? 1 : 0.58); ctx.rotate((c.rot || 0) + time * 0.12); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const an = i * TAU / 6, ca = Math.cos(an), sa = Math.sin(an); ctx.moveTo(0, 0); ctx.lineTo(ca * R, sa * R); for (const [f, l] of [[0.35, 0.24], [0.6, 0.2], [0.82, 0.12]]) for (const s of [-1, 1]) { const bx = ca * R * f, by = sa * R * f, ba = an + s * 0.9; ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(ba) * R * l, by + Math.sin(ba) * R * l); } } };
    path(); ctx.globalAlpha = a * 0.4; ctx.strokeStyle = c.col; ctx.lineWidth = 12; ctx.stroke(); ctx.globalAlpha = a * 0.9; ctx.strokeStyle = c.hi || c.col; ctx.lineWidth = 4; ctx.stroke(); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.globalAlpha = a * 0.6; ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 6; i++) { const an = i * TAU / 6 + 0.52; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * R * 0.3, Math.sin(an) * R * 0.3); } ctx.stroke();
    ctx.restore(); bloom(ctx, c.x, c.y + (c.up ? 0 : 14), R * 0.9, c.col, 0.4 * a);
  },
  /** A rock of fire falling from angle `from` to (x,y): dark core, three flame plumes, then a rising fireball and ground shock. */
  mage_meteor(ctx, c, k, time) {
    const hit = c.hit ?? 0.6, S = c.size || 30, dx = Math.cos(c.from), dy = Math.sin(c.from), px = -dy, py = dx, c2 = c.col2 || c.b || c.col;
    if (k < hit) {
      const f = clamp(k / hit), pos = 1 - ease.in(f), hx = c.x + dx * c.len * pos, hy = c.y + dy * c.len * pos, tl = Math.min(c.len * 0.75, c.len * (1 - pos) + S * 4);
      for (let j = 0; j < 3; j++) {
        const off = (j - 1) * S * 0.5, pts = [];
        for (let i = 0; i <= 14; i++) { const u = 1 - i / 14, w = Math.sin(time * 16 + u * 9 + j * 2.1) * S * 0.22 * u; pts.push([hx + dx * tl * u + px * (off * (1 - u * 0.5) + w), hy + dy * tl * u + py * (off * (1 - u * 0.5) + w)]); }
        ribbon(ctx, pts, S * (j === 1 ? 1.1 : 0.7), j === 1 ? c.col : c2, 0.9, j === 1 ? c.hi : null);
      }
      bloom(ctx, hx, hy, S * 3.6, c.col, 0.85); ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.translate(hx, hy); ctx.rotate(time * 2);
      ctx.fillStyle = c.deep || '#2a0c12'; ctx.beginPath(); for (let i = 0; i < 9; i++) { const an = i / 9 * TAU, rr = S * (0.8 + 0.25 * Math.sin(i * 2.7)); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = c2; ctx.lineWidth = 3; ctx.globalAlpha = 0.9; ctx.stroke(); ctx.rotate(-time * 2); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(-dx * S * 0.35, -dy * S * 0.35, S * 0.28, 0, TAU); ctx.fill(); ctx.restore();
    } else {
      const u = clamp((k - hit) / (1 - hit)), a = 1 - u, R = c.impact || 100;
      for (let j = 0; j < 6; j++) { const f = j / 5, uu = clamp(u * 1.2 - f * 0.12); bloom(ctx, c.x + Math.sin(j * 2.1 + 1) * R * 0.32 * uu, c.y - uu * R * (0.35 + f * 0.9), R * (0.55 + 0.3 * f) * (1 - 0.45 * u), j % 2 ? c2 : c.col, 0.5 * a); }
      bloom(ctx, c.x, c.y, R * 0.6, '#fff', 0.6 * (1 - ease.out(u)), 1);
      ctx.save(); ctx.translate(c.x, c.y + 10); ctx.scale(1, 0.55); ctx.strokeStyle = c.hi || '#fff'; ctx.globalAlpha = a; ctx.lineWidth = 7 * a + 1; ctx.beginPath(); ctx.arc(0, 0, R * 1.25 * ease.out(u), 0, TAU); ctx.stroke();
      ctx.strokeStyle = c.col; ctx.lineWidth = 3; for (let i = 0; i < 14; i++) { const an = i / 14 * TAU + 0.2, r0 = R * (0.4 + 0.9 * ease.out(u)), r1 = r0 + R * 0.35 * a; ctx.globalAlpha = a * 0.8; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); ctx.stroke(); }
      ctx.restore();
    }
  },
  /** Gravity: rings and a spiral that run inward to a dark core with a bright lensing rim. */
  mage_pull(ctx, c, k, time) {
    const a = ease.out(clamp(k / 0.12)) * ease.in(clamp((1 - k) / 0.2)), R = c.R; if (a < 0.01) return;
    ctx.save(); ctx.translate(c.x, c.y + 10); ctx.scale(1, 0.55); ctx.lineCap = 'round';
    const nR = c.rings || 4, cyc = c.cycles || 2.2;
    for (let i = 0; i < nR; i++) { const f = (k * cyc + i / nR) % 1; ctx.globalAlpha = a * Math.sin(f * Math.PI) * 0.9; ctx.strokeStyle = i % 2 ? (c.hi || c.col) : c.col; ctx.lineWidth = 2 + (1 - f) * 6; circ(ctx, R * (1 - f * 0.92)); }
    for (let arm = 0; arm < 3; arm++) { ctx.beginPath(); for (let i = 0; i <= 26; i++) { const u = i / 26, r = R * (1 - u * 0.9), an = time * (c.spin || 2.5) + arm * TAU / 3 + u * 5.2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * r, Math.sin(an) * r); } ctx.globalAlpha = a * 0.4; ctx.strokeStyle = c.b || c.col; ctx.lineWidth = 9; ctx.stroke(); ctx.globalAlpha = a * 0.9; ctx.strokeStyle = c.hi || '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
    const cy = c.y - (c.lift ?? 30), cr = R * 0.17 * ease.out(clamp(k / 0.3));
    bloom(ctx, c.x, cy, cr * 4, c.col, 0.5 * a);
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.96 * a; ctx.fillStyle = '#05010c'; ctx.beginPath(); ctx.arc(c.x, cy, cr, 0, TAU); ctx.fill(); ctx.restore();
    ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(c.x, cy, cr * 1.04, 0, TAU); ctx.stroke(); ctx.strokeStyle = c.hi || c.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(c.x, cy, cr * 2.2, cr * 0.5, time * 0.8, 0, TAU); ctx.stroke();
  },
  /** A clock face on the ground: the hands spin back, slow, stop; frost cracks run across it. */
  mage_clock(ctx, c, k, time) {
    const a = ease.out(clamp(k / 0.15)) * ease.in(clamp((1 - k) / 0.25)), R = c.R * (0.85 + 0.15 * ease.out(clamp(k / 0.2))), stop = ease.out(clamp(k / 0.55)); if (a < 0.01) return;
    ctx.save(); ctx.translate(c.x, c.y + 14); ctx.scale(1, 0.58); ctx.lineCap = 'round';
    ctx.globalAlpha = a * 0.8; ctx.strokeStyle = c.col; ctx.lineWidth = 7; circ(ctx, R); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; circ(ctx, R); ctx.globalAlpha = a * 0.7; ctx.strokeStyle = c.b || c.col; ctx.lineWidth = 2.5; circ(ctx, R * 0.86);
    for (let i = 0; i < 12; i++) { const an = i / 12 * TAU - Math.PI / 2, big = i % 3 === 0; ctx.globalAlpha = a; ctx.strokeStyle = big ? '#fff' : c.hi; ctx.lineWidth = big ? 5 : 2.5; ctx.beginPath(); ctx.moveTo(Math.cos(an) * R * (big ? 0.7 : 0.78), Math.sin(an) * R * (big ? 0.7 : 0.78)); ctx.lineTo(Math.cos(an) * R * 0.94, Math.sin(an) * R * 0.94); ctx.stroke(); }
    const hand = (ang, len, w, col) => { ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * R * len, Math.sin(ang) * R * len); ctx.stroke(); };
    const spin = (1 - stop) * -time * 9 + stop * 0.9; hand(spin - Math.PI / 2, 0.82, 4, '#fff'); hand(spin * 0.2 + 1.4, 0.55, 6, c.hi);
    if (stop > 0.6) { const Rr = seeded(c.seed); ctx.strokeStyle = c.hi; ctx.lineWidth = 2; for (let i = 0; i < 9; i++) { let x = 0, y = 0, an = Rr() * TAU; ctx.globalAlpha = a * (stop - 0.6) * 2.2; ctx.beginPath(); ctx.moveTo(0, 0); for (let s = 0; s < 4; s++) { an += (Rr() - 0.5) * 1.1; x += Math.cos(an) * R * 0.24; y += Math.sin(an) * R * 0.24; ctx.lineTo(x, y); } ctx.stroke(); } }
    ctx.restore(); bloom(ctx, c.x, c.y + 14, R * 1.1, c.col, 0.35 * a);
  },
  /** A charging orb: motes rush inward, the orb swells, small stars circle it and a four-point flare opens. */
  mage_orb(ctx, c, k, time) {
    const g = ease.out(clamp(k / (c.grow || 0.6))), a = ease.in(clamp((1 - k) / 0.25)), R = c.R * g, ox = c.x, oy = c.y - (c.lift || 0); if (a < 0.01) return;
    if (k < 0.65) { const Rr = seeded(c.seed); for (let i = 0; i < 14; i++) { const an = Rr() * TAU, f = (k * 1.7 + Rr()) % 1, r0 = c.R * (4.2 - 3.6 * f), r1 = r0 - c.R * 0.8; ctx.globalAlpha = a * f; ctx.strokeStyle = i % 2 ? c.hi : c.col; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ox + Math.cos(an) * r0, oy + Math.sin(an) * r0 * 0.8); ctx.lineTo(ox + Math.cos(an) * r1, oy + Math.sin(an) * r1 * 0.8); ctx.stroke(); } }
    bloom(ctx, ox, oy, R * 3, c.col, 0.55 * a); ctx.globalAlpha = a * 0.9; ctx.fillStyle = c.col; ctx.beginPath(); ctx.arc(ox, oy, R, 0, TAU); ctx.fill(); ctx.globalAlpha = a * 0.5; ctx.fillStyle = c.hi || '#fff'; ctx.beginPath(); ctx.arc(ox, oy, R * 0.66, 0, TAU); ctx.fill(); ctx.globalAlpha = a * 0.8; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox, oy, R * 0.28, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) { const an = time * 4 + i * TAU / 3; bloom(ctx, ox + Math.cos(an) * R * 1.9, oy + Math.sin(an) * R * 0.8, R * 0.7, c.b || c.col, 0.8 * a); ctx.fillStyle = '#fff'; ctx.fillRect(ox + Math.cos(an) * R * 1.9 - 2, oy + Math.sin(an) * R * 0.8 - 2, 4, 4); }
    if (k > 0.55) { const f = ease.out(clamp((k - 0.55) / 0.3)), L = R * 5 * f; ctx.globalAlpha = a * 0.9; ctx.fillStyle = c.hi || '#fff'; for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + (c.rot || 0); ctx.beginPath(); ctx.moveTo(ox + Math.cos(an + 1.57) * R * 0.18, oy + Math.sin(an + 1.57) * R * 0.18); ctx.lineTo(ox + Math.cos(an) * L, oy + Math.sin(an) * L); ctx.lineTo(ox + Math.cos(an - 1.57) * R * 0.18, oy + Math.sin(an - 1.57) * R * 0.18); ctx.closePath(); ctx.fill(); } }
  },
  /** Faceted shards thrown outward from a point (ice, glass, broken crystal). */
  mage_shards(ctx, c, k) {
    const R = seeded(c.seed), e = ease.out(k), a = 1 - ease.in(clamp((k - 0.4) / 0.6));
    for (let i = 0; i < c.n; i++) { const an = R() * TAU, dist = c.R * (0.3 + R() * 0.7) * e, s = (c.size || 12) * (0.6 + R() * 0.8), rot = R() * TAU + k * 6 * (R() - 0.5), col = R() < 0.35 ? (c.col2 || c.hi) : c.col; const x = c.x + Math.cos(an) * dist, y = c.y + Math.sin(an) * dist * 0.7 + (c.g || 80) * k * k - 20 * Math.sin(k * Math.PI);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = a * 0.7; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.5, s * 0.7); ctx.lineTo(-s * 0.4, s * 0.5); ctx.closePath(); ctx.fill(); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
    bloom(ctx, c.x, c.y, c.R * 0.4 * (1 - k), c.col, 0.3 * (1 - k));
  },
  /** An upright ring of light: a portal that opens and closes (blinks, time tears). */
  mage_portal(ctx, c, k, time) {
    const a = ease.out(clamp(k / 0.22)) * ease.in(clamp((1 - k) / 0.45)), ry = c.R * a, rx = c.R * 0.42 * a; if (a < 0.02) return;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot || 0); bloom(ctx, 0, 0, c.R * 1.0, c.col, 0.25 * a); ctx.lineCap = 'round';
    ctx.globalAlpha = a * 0.9; ctx.strokeStyle = c.col; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = c.b || c.hi; ctx.lineWidth = 3; ctx.globalAlpha = a * 0.8; ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.66, ry * 0.7, 0, 0, TAU); ctx.stroke();
    const dir = c.dir || 1; for (let i = 0; i < 12; i++) { const an = i / 12 * TAU + time * 2.4 * dir; ctx.globalAlpha = a * 0.9; ctx.fillStyle = i % 3 ? c.hi || '#fff' : '#fff'; ctx.fillRect(Math.cos(an) * rx * 1.12 - 2, Math.sin(an) * ry * 1.12 - 3, 4, 6); }
    ctx.globalAlpha = a * 0.3; ctx.fillStyle = c.b || c.col; ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.66, ry * 0.7, 0, 0, TAU); ctx.fill(); ctx.restore();
  },
};

// ------------------------------------------------------------------ shared compositions
const fireImpact = (k, x, y, R, d = 0, o = {}) => { // the burning crash: rings, cracks, flame tongues, embers
  k.ring({ x, y, R: R * 1.2, n: 3, w: 28, col: C.or, d });
  k.crack({ x, y, R: R * 1.1, n: 9, col: C.or, hi: C.fire, d });
  k.spires({ x, y, n: (o.n || 8), R: R * 0.8, h: R * 0.9, wd: 22, shape: 'flame', col: C.or, hi: C.fire, d, life: 1.2 });
  k.motes({ x, y, n: o.motes || 26, type: 'ember', spd: 260, g: 180, size: 7, col: C.ember, col2: '#fff3c0', ang: -Math.PI / 2, spread: 2.6, d, life: 1.3 });
};
const iceBloom = (k, x, y, R, d = 0, o = {}) => { // frost taking hold: crystal, spires, snow
  k.mage_flake({ x, y, R, col: C.cy, hi: C.ice, d, life: o.life || 1.2, rot: o.rot || 0 });
  k.spires({ x, y, n: o.n || 6, R: R * 0.8, R0: R * 0.2, h: R * 0.7, wd: 15, shape: 'ice', col: '#8fe8ff', hi: '#e8fbff', deep: '#0a2a44', d, life: 1.1 });
  k.motes({ x, y: y - 30, n: o.motes || 24, type: 'snow', spd: 110, g: 50, size: 6, col: '#cdf6ff', spread: TAU, d, life: 1.4 });
};

export default {
  pal: { a: '#9d7bff', b: '#5ee0ff', hi: '#efe8ff', deep: '#120a2a', ink: '#0a0618', edge: '#c8b8ff' },
  prims,
  underPrims: ['mage_circle', 'mage_flake', 'mage_clock', 'mage_pull'],
  skills: {
    blink(k) { // a portal ring closes behind you, a violet ghost trail runs 240 px, a cyan portal and a small circle open where you land
      const d = k.ahead(240);
      k.mage_portal({ x: k.x, y: k.y - 30, R: 74, col: C.vio, b: C.cy, life: 0.5 });
      k.ghost({ x2: d.x, y2: d.y, n: 6, size: 15, col: C.vio, hi: C.hi, d: 0.02, life: 0.55 });
      k.streak({ ang: k.ang, len: 240, w: 6, col: C.cy, hi: C.cy, d: 0.02, life: 0.35, ticks: 5 });
      k.mage_portal({ x: d.x, y: d.y - 30, R: 90, col: C.cy, b: C.vio, d: 0.1, life: 0.6, dir: -1 });
      k.mage_circle({ x: d.x, y: d.y, R: 84, layers: 2, col: C.vio, b: C.cy, hi: C.hi, d: 0.1, life: 0.9, hold: 0.6 });
      k.motes({ x: d.x, y: d.y - 20, n: 14, type: 'rune', spd: 130, g: -60, size: 8, col: C.cy, col2: C.hi, spread: TAU, d: 0.1, life: 1.0 });
      k.motes({ x: k.x, y: k.y, n: 10, type: 'star', spd: 150, size: 6, col: C.vio, col2: '#fff', spread: TAU, opt: true, life: 0.8 });
    },
    blast(k) { // the staff gathers an orb, a bolt flies to the target and detonates it inside a three-layer circle with a violet column and crystal spikes
      const t = tgt(k, 390), a = Math.atan2(t.y - k.y, t.x - k.x), h = k.ahead(26);
      k.mage_orb({ x: h.x, y: h.y, R: 12, col: C.vio, hi: C.hi, b: C.cy, life: 0.4, lift: 24, grow: 0.5 });
      k.streak({ x: h.x, y: h.y - 24, ang: a, len: Math.hypot(t.x - h.x, t.y - h.y), w: 10, col: C.vio, hi: '#fff', d: 0.14, life: 0.3, ticks: 4 });
      k.mage_circle({ x: t.x, y: t.y, R: 118, layers: 3, rise: 16, under: false, col: C.vio, b: C.cy, hi: C.hi, d: 0.2, life: 1.1, hold: 0.7 });
      k.pillar({ x: t.x, y: t.y, h: 300, w: 12, col: C.vio, hi: C.vio, d: 0.3, life: 0.6 });
      k.spires({ x: t.x, y: t.y, n: 8, R: 96, h: 110, wd: 14, shape: 'crystal', col: C.vio, hi: C.hi, deep: '#1a0e44', d: 0.3 });
      k.ring({ x: t.x, y: t.y, R: 125, n: 2, col: C.vio, d: 0.3 }); k.burst({ x: t.x, y: t.y - 20, n: 10, len: 130, col: C.vio, d: 0.3 });
      k.motes({ x: t.x, y: t.y - 20, n: 18, type: 'rune', spd: 200, g: 60, size: 8, col: C.cy, col2: '#fff', spread: TAU, d: 0.3, life: 1.0 }); k.shake(0.35);
    },
    meteor(k) { // an orange warning circle burns on the ground for a second, then a rock of fire crashes down in a fireball and leaves flames behind
      const t = tgt(k, 430);
      k.mage_circle({ x: t.x, y: t.y, R: 150, layers: 2, col: C.or, b: C.gold, hi: C.fire, life: 1.8, hold: 0.55, spin: 1.6 });
      k.mage_meteor({ x: t.x, y: t.y, from: -2.0, len: 820, size: 34, impact: 160, col: C.or, col2: C.gold, hi: C.fire, deep: '#2a0c12', hit: 0.6, d: 0.2, life: 1.5 });
      fireImpact(k, t.x, t.y, 150, 1.0); k.pillar({ x: t.x, y: t.y, h: 380, w: 18, col: C.or, hi: C.ember, d: 1.0, life: 0.6 });
      k.mage_circle({ x: t.x, y: t.y, R: 125, layers: 1, col: C.or, b: C.gold, hi: C.fire, d: 1.0, life: 2.2, hold: 0.7, spin: 0.5 });
      k.motes({ x: t.x, y: t.y, n: 14, type: 'ember', spd: 70, g: -120, size: 6, col: C.ember, col2: '#fff3c0', ang: -Math.PI / 2, spread: 2.4, R0: 110, d: 1.1, life: 2.0, stagger: 0.8 });
      k.shake(0.6);
    },
    nova(k) { // runes charge a frost circle around you, then it bursts: ice crystal across 150 px, a ring of ice spikes, shards and snow
      k.mage_circle({ R: 150, layers: 2, col: C.cy, b: C.vio, hi: C.ice, life: 1.1, hold: 0.7 });
      k.ring({ R: 175, n: 3, w: 24, col: C.cy, d: 0.18 }); k.burst({ y: k.y - 14, n: 14, len: 150, col: C.cy, hi: C.ice, d: 0.18 });
      iceBloom(k, k.x, k.y, 150, 0.18, { n: 8 });
      k.mage_shards({ x: k.x, y: k.y - 10, n: 16, R: 190, size: 11, col: C.cy, col2: '#fff', d: 0.18, life: 0.8 }); k.shake(0.3);
    },
    grand_meteor(k) { // the big one: a four-layer circle rises over the target, orbs gather, an enormous meteor with satellites falls, then a column of fire and a burning field
      const t = tgt(k, 470);
      k.mage_circle({ x: t.x, y: t.y, R: 230, layers: 4, rise: 20, under: false, col: C.or, b: C.vio, hi: C.fire, life: 2.4, hold: 0.55 });
      k.orbit({ x: t.x, y: t.y, R: 180, n: 6, size: 10, col: C.gold, hi: C.fire, speed: 3, launch: 0.55, x2: t.x, y2: t.y, life: 1.5, d: 0.1 });
      for (let i = 0; i < 3; i++) k.mage_meteor({ x: t.x + (i - 1) * 140, y: t.y + (i % 2 ? -50 : 60), from: -2.0 - (i - 1) * 0.25, len: 760, size: 16, impact: 70, col: C.or, col2: C.gold, hi: C.fire, hit: 0.6, d: 0.95 + i * 0.1, life: 1.2 });
      k.mage_meteor({ x: t.x, y: t.y, from: -1.9, len: 1000, size: 62, impact: 240, col: C.or, col2: C.vio, hi: C.fire, deep: '#1e0a18', hit: 0.7, d: 0.3, life: 1.9 });
      fireImpact(k, t.x, t.y, 230, 1.6, { n: 12, motes: 34 }); k.pillar({ x: t.x, y: t.y, h: 600, w: 30, col: C.or, hi: C.ember, d: 1.6, life: 0.9 }); k.burst({ x: t.x, y: t.y - 30, n: 16, len: 240, col: C.or, hi: C.ember, d: 1.6 });
      k.mage_circle({ x: t.x, y: t.y, R: 190, layers: 2, col: C.or, b: C.gold, hi: C.fire, d: 1.6, life: 3.0, hold: 0.75, spin: 0.5 }); k.kick(0.06); k.shake(1.0);
    },
  },
  basic(k, ev) { // a violet bolt with a cyan trail; the third cast is a big orb with a small rune circle at the feet
    const h = k.ahead(26);
    if (ev.idx === 2) {
      k.mage_orb({ x: h.x, y: h.y, R: 14, col: C.vio, hi: C.hi, b: C.cy, life: 0.4, lift: 24, grow: 0.45 });
      k.mage_circle({ R: 52, layers: 2, col: C.vio, b: C.cy, hi: C.hi, life: 0.6, hold: 0.5 });
      k.streak({ x: h.x, y: h.y - 24, ang: k.ang, len: 230, w: 13, col: C.vio, hi: '#fff', d: 0.04, life: 0.3, ticks: 3 });
      k.motes({ x: h.x, y: h.y - 24, n: 6, type: 'star', spd: 200, size: 6, col: C.vio, col2: C.cy, ang: k.ang, spread: 1.4, d: 0.04, life: 0.6, opt: true });
    } else {
      k.streak({ x: h.x, y: h.y - 24, ang: k.ang + (ev.idx ? 0.04 : -0.04), len: 170, w: 7, col: ev.idx ? C.cy : C.vio, hi: '#fff', d: 0.02, life: 0.28, ticks: 2 });
      k.motes({ x: h.x, y: h.y - 24, n: 4, type: 'pix', spd: 150, size: 5, col: C.cy, col2: '#fff', ang: k.ang, spread: 1.2, life: 0.5, opt: true });
    }
  },
  ult(k, ev) { // Meteor: a three-layer circle opens in the sky and on the ground, a violet-cored rock with two orange satellites falls, the crash leaves four seconds of fire
    const x = ev.tx ?? k.tx, y = ev.ty ?? k.ty;
    k.mage_circle({ x, y: y - 260, R: 190, layers: 3, rise: 12, under: false, col: C.vio, b: C.or, hi: C.hi, life: 1.2, hold: 0.7 });
    k.mage_circle({ x, y, R: 240, layers: 3, col: C.or, b: C.vio, hi: C.fire, life: 2.2, hold: 0.55, spin: 1.2 });
    for (const s of [-1, 1]) k.mage_meteor({ x: x + s * 150, y: y + 30, from: -2.0 - s * 0.35, len: 760, size: 22, impact: 90, col: C.or, col2: C.gold, hi: C.fire, hit: 0.6, d: 0.55, life: 1.2 });
    k.mage_meteor({ x, y, from: -Math.PI / 2 - 0.1, len: 1100, size: 70, impact: 270, col: C.vio, col2: C.or, hi: C.hi, deep: '#12081c', hit: 0.75, d: 0.1, life: 1.2 });
    fireImpact(k, x, y, 240, 1.0, { n: 12, motes: 36 }); k.mage_shards({ x, y: y - 20, n: 14, R: 260, size: 14, col: C.vio, col2: C.or, g: 160, d: 1.0, life: 1.0 });
    k.burst({ x, y: y - 30, n: 18, len: 260, col: C.vio, hi: C.vio, d: 1.0 });
    k.mage_circle({ x, y, R: 200, layers: 2, col: C.or, b: C.vio, hi: C.fire, d: 1.0, life: 4.0, hold: 0.8, spin: 0.4 }); k.kick(0.07); k.shake(1.1);
  },
  chains: {
    shatter(k, s) { // the frost crystal on the ground cracks and a white-violet X slash through it, the crystal flies apart in shards
      k.mage_flake({ x: s.x, y: s.y, R: 140, col: C.cy, hi: C.ice, life: 0.9, rot: s.a0 });
      k.streak({ x: s.x - 190, y: s.y - 170, ang: 0.72, len: 400, w: 15, col: C.vio, hi: '#fff', d: 0.28, life: 0.35, ticks: 6 });
      k.streak({ x: s.x + 190, y: s.y - 170, ang: 2.42, len: 400, w: 15, col: C.cy, hi: '#fff', d: 0.34, life: 0.35, ticks: 6 });
      k.mage_shards({ x: s.x, y: s.y - 20, n: 24, R: 210, size: 14, col: C.cy, col2: C.vio, d: 0.42, life: 0.9 });
      k.crack({ x: s.x, y: s.y, R: 150, n: 7, col: C.cy, hi: '#fff', d: 0.42 }); k.ring({ x: s.x, y: s.y, R: 170, n: 2, col: C.vio, d: 0.42 }); k.flash({ x: s.x, y: s.y, R: 140, col: C.ice, d: 0.42 });
    },
    cataclysm(k, s) { // the blast circle turns red, a meteor drops fast through it and the crash throws burning rubble
      k.mage_circle({ x: s.x, y: s.y, R: 130, layers: 2, col: C.vio, b: C.or, hi: C.fire, life: 1.0, hold: 0.6, spin: 1.6 });
      k.mage_meteor({ x: s.x, y: s.y, from: -2.1, len: 620, size: 38, impact: 165, col: C.or, col2: C.vio, hi: C.fire, hit: 0.65, d: 0.1, life: 0.95 });
      fireImpact(k, s.x, s.y, 150, 0.7, { n: 9 }); k.motes({ x: s.x, y: s.y, n: 18, type: 'pix', spd: 380, g: 520, size: 7, col: C.ember, col2: C.vio, ang: -Math.PI / 2, spread: 2.4, d: 0.7, life: 1.0 }); k.shake(0.5);
    },
    blink_nova(k, s) { // a portal at the start, a ghost path, then a huge frost circle and ice crystal bursting at the landing point
      const d = k.ahead(220);
      k.mage_portal({ x: k.x, y: k.y - 30, R: 80, col: C.vio, b: C.cy, life: 0.5 }); k.ghost({ x2: d.x, y2: d.y, n: 5, size: 14, col: C.cy, hi: C.hi, life: 0.5 });
      k.mage_circle({ x: d.x, y: d.y, R: 250, layers: 3, col: C.cy, b: C.vio, hi: C.ice, d: 0.1, life: 1.2, hold: 0.7 });
      k.ring({ x: d.x, y: d.y, R: 270, n: 3, w: 26, col: C.cy, d: 0.25 }); iceBloom(k, d.x, d.y, 230, 0.25, { n: 7, motes: 24 });
      k.mage_portal({ x: d.x, y: d.y - 30, R: 90, col: C.cy, b: C.vio, d: 0.1, life: 0.6, dir: -1 });
    },
    supernova(k, s) { // a star swells above the target, then detonates in a twelve-ray burst and gold rings; embers shoot out as the Burn is spent
      k.mage_circle({ x: s.x, y: s.y, R: 220, layers: 3, rise: 26, under: false, col: C.or, b: C.vio, hi: C.fire, life: 1.5, hold: 0.7 });
      k.mage_orb({ x: s.x, y: s.y, R: 34, lift: 90, col: C.gold, hi: C.fire, b: C.or, grow: 0.7, life: 1.2, rot: 0.4 });
      k.burst({ x: s.x, y: s.y - 90, n: 16, len: 300, col: C.gold, hi: C.gold, d: 0.95, rot: 0.15 });
      k.ring({ x: s.x, y: s.y, R: 330, n: 3, w: 30, col: C.or, d: 0.95 }); k.flash({ x: s.x, y: s.y - 90, R: 180, col: C.gold, d: 0.95 });
      for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 + s.a0; k.streak({ x: s.x, y: s.y - 90, ang: a, len: 280, w: 9, col: C.or, hi: C.fire, d: 0.95, life: 0.45, ticks: 3 }); }
      k.motes({ x: s.x, y: s.y - 90, n: 34, type: 'ember', spd: 380, g: 200, size: 7, col: C.ember, col2: '#fff3c0', spread: TAU, d: 0.95, life: 1.3 }); k.kick(0.05); k.shake(0.8);
    },
    glacial_cascade(k, s) { // ice bursts ripple outward from the target one after another, joined by cyan lightning (frozen enemies shattering in turn)
      let px = s.x, py = s.y; iceBloom(k, s.x, s.y, 110, 0, { n: 7, motes: 14 }); k.mage_shards({ x: s.x, y: s.y - 10, n: 12, R: 130, size: 11, col: C.cy, col2: '#fff', life: 0.7 });
      for (let i = 1; i <= 6; i++) { const a = s.a0 + i * 2.4, r = 110 + i * 38, x = s.x + Math.cos(a) * r, y = s.y + Math.sin(a) * r * 0.65, d = i * 0.1;
        k.bolt({ x: px, y: py - 10, x2: x, y2: y - 10, forks: 1, w: 3, col: C.cy, hi: '#fff', d: d - 0.05, life: 0.3 }); iceBloom(k, x, y, 70, d, { n: 5, motes: 6, life: 0.9, rot: i });
        k.mage_shards({ x, y: y - 10, n: 7, R: 80, size: 9, col: C.ice, col2: C.vio, d, life: 0.6, opt: i > 3 }); px = x; py = y; }
      k.mage_circle({ x: s.x, y: s.y, R: 260, layers: 2, col: C.cy, b: C.vio, hi: C.ice, life: 1.2, hold: 0.6 });
    },
    chrono_field(k, s) { // time stops: a clock circle, hands that spin back and halt, drifting snow in the stopped air, then the whole field cracks into shards
      k.mage_clock({ x: s.x, y: s.y, R: 195, col: C.cy, b: C.vio, hi: C.ice, life: 1.7 });
      k.mage_circle({ x: s.x, y: s.y, R: 220, layers: 2, rise: 34, under: false, col: C.vio, b: C.cy, hi: C.hi, life: 1.6, hold: 0.7, spin: 0.35 });
      k.motes({ x: s.x, y: s.y - 60, n: 30, type: 'snow', spd: 20, g: 8, size: 6, col: '#cdf6ff', col2: C.vio, spread: TAU, R0: 180, life: 1.5, stagger: 0.8 });
      k.ring({ x: s.x, y: s.y, R: 200, n: 2, col: C.vio, d: 0.1 });
      k.mage_shards({ x: s.x, y: s.y - 20, n: 30, R: 250, size: 16, col: C.cy, col2: C.vio, d: 1.35, life: 0.9 }); k.flash({ x: s.x, y: s.y, R: 150, col: C.cy, d: 1.35 }); k.ring({ x: s.x, y: s.y, R: 260, n: 3, col: C.cy, d: 1.35 }); k.shake(0.4);
    },
    steam_burst(k, s) { // fire and ice circles side by side collide, white steam boils up in a column and a hissing ring spreads out
      const x = s.x, y = s.y;
      k.mage_circle({ x: x - 80, y, R: 130, layers: 2, col: C.or, b: C.gold, hi: C.fire, life: 1.2, hold: 0.6 }); k.mage_circle({ x: x + 80, y, R: 130, layers: 2, col: C.cy, b: C.vio, hi: C.ice, life: 1.2, hold: 0.6 });
      k.streak({ x: x - 260, y: y - 30, ang: 0, len: 250, w: 18, col: C.or, hi: C.fire, d: 0.1, life: 0.35, ticks: 4 }); k.streak({ x: x + 260, y: y - 30, ang: Math.PI, len: 250, w: 18, col: C.cy, hi: C.ice, d: 0.1, life: 0.35, ticks: 4 });
      k.flash({ x, y: y - 20, R: 120, col: '#9fc8ff', d: 0.4 });
      k.swirl({ x, y: y + 20, R: 120, h: 300, arms: 3, col: '#9fd0ff', hi: '#d8ecff', spin: 5, w: 10, d: 0.4, life: 1.2, cone: 1 });
      k.motes({ x, y, n: 22, type: 'pix', spd: 200, g: -170, size: 7, col: '#a8d0ff', col2: C.ember, ang: -Math.PI / 2, spread: 2.0, R0: 90, d: 0.4, life: 1.5 });
      k.wave({ x, y, ang: 0, arc: TAU, r: 260, n: 3, w: 12, col: '#cfe8ff', hi: '#fff', d: 0.42 }); k.ring({ x, y, R: 240, n: 2, col: '#cfe8ff', d: 0.4 }); k.shake(0.5);
    },
    ember_blink(k, s) { // a trail of glowing embers marks the blink path, then you land in a ring of fire with ember sparks and a scorched circle
      const d = k.ahead(220);
      k.mage_portal({ x: k.x, y: k.y - 30, R: 78, col: C.or, b: C.gold, life: 0.5 }); k.ghost({ x2: d.x, y2: d.y, n: 7, size: 14, col: C.or, hi: C.fire, life: 0.55 });
      k.streak({ ang: k.ang, len: 220, w: 12, col: C.or, hi: C.fire, life: 0.35, ticks: 8 });
      for (let i = 0; i < 6; i++) { const f = (i + 1) / 7, p = k.ahead(220 * f); k.motes({ x: p.x, y: p.y - 10, n: 5, type: 'ember', spd: 80, g: -60, size: 6, col: C.ember, col2: '#fff3c0', ang: -Math.PI / 2, spread: 1.6, d: i * 0.04, life: 0.9 }); }
      k.mage_circle({ x: d.x, y: d.y, R: 230, layers: 3, col: C.or, b: C.gold, hi: C.fire, d: 0.12, life: 1.2, hold: 0.65, spin: 1.6 });
      k.mage_portal({ x: d.x, y: d.y - 30, R: 92, col: C.gold, b: C.or, d: 0.1, life: 0.6, dir: -1 });
      fireImpact(k, d.x, d.y, 200, 0.2, { n: 9, motes: 30 }); k.burst({ x: d.x, y: d.y - 20, n: 14, len: 180, col: C.or, hi: C.ember, d: 0.2 });
    },
    twin_star(k, s) { // an orange star and a cyan star fall from opposite sides, circle each other over the target and collide in a two-coloured burst
      const x = s.x, y = s.y;
      k.mage_circle({ x: x - 60, y, R: 150, layers: 2, col: C.or, b: C.gold, hi: C.fire, life: 1.3, hold: 0.6 }); k.mage_circle({ x: x + 60, y, R: 150, layers: 2, col: C.cy, b: C.vio, hi: C.ice, life: 1.3, hold: 0.6 });
      k.mage_meteor({ x, y, from: -2.35, len: 760, size: 32, impact: 150, col: C.or, col2: C.gold, hi: C.fire, hit: 0.6, d: 0.2, life: 1.2 });
      k.mage_meteor({ x, y, from: -0.8, len: 760, size: 32, impact: 150, col: C.cy, col2: C.vio, hi: C.ice, deep: '#082030', hit: 0.6, d: 0.2, life: 1.2 });
      k.burst({ x, y: y - 20, n: 12, len: 230, col: C.or, hi: C.ember, d: 0.92, rot: 0 }); k.burst({ x, y: y - 20, n: 12, len: 210, col: C.cy, hi: C.cy, d: 0.92, rot: 0.26 });
      k.ring({ x, y, R: 220, n: 2, col: C.or, d: 0.92 }); k.ring({ x, y, R: 280, n: 2, col: C.cy, d: 0.98 }); k.crack({ x, y, R: 200, n: 10, col: C.vio, hi: '#fff', d: 0.92 });
      k.motes({ x, y: y - 20, n: 26, type: 'star', spd: 340, g: 120, size: 8, col: C.or, col2: C.cy, spread: TAU, mix: 0.5, d: 0.92, life: 1.2 }); k.kick(0.05); k.shake(0.7);
    },
    frostfire_collapse(k, s) { // gravity pulls fire and ice inward on you, then it all explodes outward as alternating fire and ice spikes in a huge frostfire nova
      const x = k.x, y = k.y;
      k.mage_pull({ x, y, R: 300, col: C.or, b: C.cy, hi: '#fff', cycles: 3, life: 0.7, lift: 40 });
      k.mage_circle({ x, y, R: 300, layers: 4, col: C.cy, b: C.or, hi: C.hi, d: 0.1, life: 1.8, hold: 0.6, spin: 1.2 });
      k.flash({ x, y: y - 30, R: 180, col: C.cy, d: 0.6 }); k.mage_flake({ x, y, R: 280, col: C.cy, hi: C.ice, d: 0.6, life: 1.3, rot: 0.1 });
      k.spires({ x, y, n: 9, R: 120, R0: 130, h: 260, wd: 20, shape: 'ice', col: '#8fe8ff', hi: '#e8fbff', deep: '#0a2a44', d: 0.6, life: 1.2 }); k.spires({ x, y, n: 9, R: 120, R0: 130, h: 240, wd: 22, shape: 'flame', col: C.or, hi: C.fire, d: 0.65, life: 1.2 });
      k.ring({ x, y, R: 340, n: 3, w: 30, col: C.cy, d: 0.6 }); k.ring({ x, y, R: 300, n: 2, w: 24, col: C.or, d: 0.66 });
      k.motes({ x, y: y - 30, n: 34, type: 'star', spd: 420, g: 100, size: 8, col: C.cy, col2: C.or, spread: TAU, mix: 0.5, d: 0.6, life: 1.3 });
    },
    starfall_shatter(k, s) { // one huge white-gold star falls on the target, the sky lights and the ground crystal bursts into a hundred glass shards
      const x = s.x, y = s.y;
      k.mage_circle({ x, y: y - 40, R: 260, layers: 4, rise: 26, under: false, col: C.gold, b: C.cy, hi: '#fff', life: 1.8, hold: 0.55 });
      k.mage_meteor({ x, y, from: -1.75, len: 1100, size: 66, impact: 220, col: C.gold, col2: C.cy, hi: '#fff', deep: '#202a40', hit: 0.7, d: 0.2, life: 1.5 });
      for (let i = 0; i < 4; i++) k.comet({ x: x + (i - 1.5) * 150, y: y + (i % 2 ? 40 : -30), from: -2.0, len: 700, size: 9, col: C.cy, hi: '#fff', impact: 50, d: 0.2 + i * 0.06, life: 0.8, hit: 0.55 });
      k.flash({ x, y, R: 200, col: C.gold, d: 1.2 }); k.mage_flake({ x, y, R: 260, col: C.gold, hi: '#fff', d: 1.2, life: 1.0, rot: s.a0 });
      k.mage_shards({ x, y: y - 20, n: 40, R: 320, size: 18, col: C.gold, col2: C.cy, g: 160, d: 1.25, life: 1.2 }); k.mage_shards({ x, y: y - 20, n: 24, R: 220, size: 12, col: '#fff', col2: C.vio, d: 1.25, life: 1.0 });
      k.burst({ x, y: y - 30, n: 24, len: 320, col: C.gold, hi: C.gold, d: 1.2 }); k.ring({ x, y, R: 340, n: 3, w: 30, col: C.gold, d: 1.2 }); k.crack({ x, y, R: 300, n: 12, col: C.cy, hi: '#fff', d: 1.2 }); k.kick(0.06); k.shake(1.0);
    },
    armageddon(k, s) { // the sky opens in a four-layer circle over you, eight meteors of different sizes crash across the ground, embers rain down
      const x = k.x, y = k.y;
      k.mage_circle({ x, y: y - 70, R: 330, layers: 4, rise: 30, under: false, col: C.or, b: C.vio, hi: C.fire, life: 2.4, hold: 0.7 });
      k.sigil({ x, y, R: 300, n: 9, col: C.or, hi: C.fire, b: C.gold, life: 2.4, hold: 0.8 });
      const R = seeded(77);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.3, r = 90 + R() * 240, mx = x + Math.cos(a) * r * 1.15, my = y + Math.sin(a) * r * 0.6 + 20, d = 0.2 + i * 0.13;
        k.mage_meteor({ x: mx, y: my, from: -2.0 + (R() - 0.5) * 0.5, len: 800, size: 20 + R() * 18, impact: 90 + R() * 40, col: i % 3 ? C.or : C.vio, col2: C.gold, hi: C.fire, hit: 0.55, d, life: 1.0 });
        k.ring({ x: mx, y: my, R: 110, n: 2, col: C.or, d: d + 0.55 }); k.spires({ x: mx, y: my, n: 4, R: 60, h: 100, wd: 14, shape: 'flame', col: C.or, hi: C.fire, d: d + 0.55, life: 0.9, opt: true }); }
      k.motes({ x, y: y - 360, n: 40, type: 'spark', spd: 520, g: 700, size: 7, col: C.or, col2: '#fff3c0', ang: Math.PI / 2 + 0.3, spread: 0.5, R0: 300, d: 0.2, life: 1.8, stagger: 0.8, opt: true });
      k.mage_circle({ x, y, R: 320, layers: 2, col: C.or, b: C.gold, hi: C.fire, d: 1.0, life: 2.4, hold: 0.7, spin: 0.5 });
    },
    singularity(k, s) { // a black hole opens at the target: spiral light and rings fall into it, orbs are sucked in, then it collapses in a white flash
      const x = s.x, y = s.y;
      k.mage_circle({ x, y, R: 380, layers: 4, rise: 22, col: C.vio, b: C.or, hi: C.hi, life: 1.9, hold: 0.7, spin: 1.5 });
      k.mage_pull({ x, y, R: 380, col: C.vio, b: C.cy, hi: '#fff', cycles: 2.6, life: 1.25, lift: 50 });
      k.rift({ x, y, R: 150, ang: 0, tall: 0.3, col: C.vio, hi: C.hi, deep: '#05010c', life: 1.2 });
      k.orbit({ x, y, R: 280, n: 10, size: 9, col: C.or, hi: C.fire, speed: 3.4, launch: 0.5, x2: x, y2: y - 50, life: 1.2 });
      k.motes({ x, y: y - 40, n: 22, type: 'rune', spd: 60, g: 0, size: 8, col: C.hi, col2: C.vio, spread: TAU, R0: 300, life: 1.2, stagger: 0.6, opt: true });
      k.flash({ x, y: y - 50, R: 220, col: C.vio, d: 1.25 }); k.ring({ x, y, R: 420, n: 3, w: 32, col: C.vio, d: 1.25 }); k.ring({ x, y, R: 360, n: 2, w: 26, col: C.or, d: 1.3 });
      k.burst({ x, y: y - 50, n: 24, len: 340, col: C.vio, hi: C.vio, d: 1.25 }); k.mage_shards({ x, y: y - 50, n: 26, R: 330, size: 14, col: C.vio, col2: C.or, d: 1.25, life: 1.0 }); k.kick(0.07); k.shake(1.1);
    },
  },
  routes: {
    armageddon: { title: 'ARMAGEDDON', sub: 'THE SKY SPLITS  ·  PACK FINISHER', sfx: 'ゴゴゴゴッ', kanji: '滅', seal: '火', rot: -0.08 },
    singularity: { title: 'SINGULARITY', sub: 'THE VOID COLLAPSES  ·  BOSS FINISHER', sfx: 'ズゥゥゥン', kanji: '無', seal: '重', rot: 0.07 },
  },
  notes: {
    blink: 'A violet portal ring closes where you stood, a ghost trail runs along the jump, and a cyan portal with a small spinning rune circle opens where you land.',
    blast: 'A glowing orb forms at the staff and a bolt flies to the target, where a three-layer violet rune circle rises, a column of light shoots up and crystal spikes burst out.',
    meteor: 'An orange rune circle burns on the ground for a second, then a rock with a flame tail crashes into it in a fireball, shock ring and cracked floor, leaving small flames burning.',
    nova: 'A cyan rune circle charges around you, then a big ice crystal blooms across the ground with a ring of ice spikes, flying shards and falling snow.',
    grand_meteor: 'A four-layer circle rises over the target while gold orbs gather and small meteors fall, then a huge meteor lands in a tall column of fire, cracks the ground and leaves a burning field.',
    ultmeteor: 'Circles open both in the sky and on the ground, a violet-cored giant meteor falls with two orange ones beside it, and the crash throws glass-like shards and burns for four seconds.',
    basic: 'Each bolt is a short violet or cyan streak with a few pixel sparks; the third cast is a bigger orb with a small rune circle at your feet.',
    shatter: 'A frost crystal grows on the ground, a violet and a cyan slash cross it, and the crystal flies apart in shards with a ring and cracks.',
    cataclysm: 'The blast circle turns from violet to red, a meteor drops fast through it, and the fiery crash throws burning rubble.',
    blink_nova: 'A portal marks where you left, and at the landing spot a huge frost circle opens with ice crystal, spikes, shock rings and snow.',
    supernova: 'A golden star swells above the target inside a rising circle, then explodes in a twenty-ray burst, gold rings and streaks of embers.',
    glacial_cascade: 'Ice bursts pop up one after another in a ripple away from the target, linked by thin cyan lightning, each one throwing shards.',
    chrono_field: 'A clock circle appears on the ground, its hands spin backwards and stop while snow hangs in the air, then the whole field cracks into shards.',
    steam_burst: 'A fire circle and an ice circle slide together and collide in a white flash, then a column of steam boils up with a hissing ring.',
    ember_blink: 'Embers glow along your blink path, then you land in a ring of fire with a scorched three-layer circle and a burst of sparks.',
    twin_star: 'An orange star and a cyan star fall from opposite sides over two joined circles and crash together in a two-coloured starburst.',
    frostfire_collapse: 'Spiral light pulls fire and ice into you, then a frost crystal and alternating fire and ice spikes explode outward in a huge nova.',
    starfall_shatter: 'A white-gold star falls with cyan comets beside it, lands in a flash, and the ground crystal bursts into a hundred glass shards.',
    armageddon: 'Pack finisher: a four-layer circle opens in the sky over you, eight meteors of different sizes crash around the ground, then the full finisher moment.',
    singularity: 'Boss finisher: a black hole opens in a layered violet circle with spiral rings and orbs pulled into it, then it collapses in a white flash, then the full finisher moment.',
  },
};
