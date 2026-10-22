// Class-flavoured 5-step finisher centrepieces. Every class gets its OWN screen-space spectacle (drawn before the shader so it blooms),
// replacing the old one-size-fits-all stack of spikes / shards / lightning / slashes:
//   warrior   a giant hammer slams down, lava cracks run out, rubble flies         ranger    a rain of arrows around a tightening reticle
//   mage      a colossal arcane circle that implodes into a beam of light          cleric    shafts of holy light, spread wings, a halo, feathers
//   ninja     dozens of hair-thin cuts crisscrossing under a crescent moon         samurai   one huge ink stroke before a red sun, sakura in the wind
//   monk      concentric chi ripples and a hundred bright fist-pops                dragoon   a falling lance, a ring of dragonfire, rising embers
//   summoner  a summoning gate with rune rings, spirit tendrils, orbiting pages    bard      equalizer bars, spotlights, sound rings, notes on a staff
// Pure presentation. Each draw is stateless: everything is derived from a seed + the elapsed time.
import { bloom, ease } from './fxglow.js';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seeded = (seed) => { let s = (seed * 9301 + 49297) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const lite = (fx) => fx.partMul !== undefined && fx.partMul < 1;
const env = (t, life, a = 0.1, b = 0.3) => clamp(t / a) * (1 - ease.in(clamp((t - (life - b)) / b)));

function ellipse(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); }
function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.closePath(); }
function jagged(R, x0, y0, x1, y1, amp, depth, out) { if (!depth) { out.push([x1, y1]); return; } const mx = (x0 + x1) / 2 + (R() - 0.5) * amp, my = (y0 + y1) / 2 + (R() - 0.5) * amp; jagged(R, x0, y0, mx, my, amp / 2, depth - 1, out); jagged(R, mx, my, x1, y1, amp / 2, depth - 1, out); }
function note(ctx, x, y, s, col, a, rot = 0) { // a quaver: head, stem, flag
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = s * 0.16;
  ellipse(ctx, 0, 0, s * 0.5, s * 0.36); ctx.save(); ctx.rotate(-0.4); ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.moveTo(s * 0.42, -s * 0.1); ctx.lineTo(s * 0.42, -s * 1.6); ctx.quadraticCurveTo(s * 1.1, -s * 1.3, s * 0.9, -s * 0.7); ctx.stroke(); ctx.restore();
}

export const FIN = {
  // ------------------------------------------------------------------ WARRIOR: the hammer falls, the ground splits
  warrior(ctx, c, W, H, s, P, fx) {
    const t = c.t, U = Math.min(W, H), R = seeded(c.seed), fall = 0.26, hit = t >= fall;
    ctx.globalCompositeOperation = 'lighter';
    // a red-gold column of speed above the falling head
    if (t < fall + 0.1) {
      const k = ease.in(clamp(t / fall)), hy = s.y - U * 1.0 * (1 - k) - U * 0.08, a = 1 - clamp((t - fall) / 0.1);
      const g = ctx.createLinearGradient(0, hy - U * 0.9, 0, hy); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, P.a);
      ctx.globalAlpha = 0.6 * a; ctx.fillStyle = g; ctx.fillRect(s.x - U * 0.12, hy - U * 0.9, U * 0.24, U * 0.9);
    }
    // the hammer: handle + steel block with a gold rim
    const k = ease.in(clamp(t / fall)), hy = s.y - U * 0.95 * (1 - k) - U * 0.06, out = 1 - ease.in(clamp((t - 0.9) / 0.5));
    if (out > 0.01) {
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = out;
      ctx.fillStyle = P.deep; ctx.fillRect(s.x - U * 0.018, hy - U * 1.05, U * 0.036, U * 1.05);
      ctx.fillStyle = '#c9a85a'; for (let i = 0; i < 6; i++) ctx.fillRect(s.x - U * 0.022, hy - U * (0.08 + i * 0.07), U * 0.044, U * 0.012);
      const bw = U * 0.19, bh = U * 0.105;
      poly(ctx, [[s.x - bw, hy - bh], [s.x + bw, hy - bh], [s.x + bw * 1.08, hy + bh * 0.2], [s.x - bw * 1.08, hy + bh * 0.2]]);
      const g = ctx.createLinearGradient(0, hy - bh, 0, hy + bh * 0.2); g.addColorStop(0, '#9aa3b4'); g.addColorStop(0.5, '#5d6578'); g.addColorStop(1, '#2c3040'); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = U * 0.008; ctx.strokeStyle = P.hi; ctx.stroke();
      ctx.fillStyle = P.a; ctx.globalAlpha = out * 0.9; ctx.fillRect(s.x - bw * 0.7, hy - bh * 0.15, bw * 1.4, bh * 0.16); // glowing red band
      ctx.globalCompositeOperation = 'lighter'; bloom(ctx, s.x, hy, U * 0.3, P.a, 0.45 * out);
    }
    if (!hit) return;
    const u = t - fall, e = ease.out(clamp(u / 0.35));
    ctx.globalCompositeOperation = 'lighter';
    // lava cracks radiating over the ground (flattened for the top-down view)
    const n = lite(fx) ? 8 : 14;
    for (let i = 0; i < n; i++) {
      const an = (i / n) * TAU + (R() - 0.5) * 0.35, L = U * (0.28 + R() * 0.3) * e, pts = [[s.x, s.y]];
      const ex = s.x + Math.cos(an) * L, ey = s.y + Math.sin(an) * L * 0.55; jagged(R, s.x, s.y, ex, ey, L * 0.28, 3, pts);
      const a = 1 - ease.in(clamp((t - 1.1) / 0.5));
      for (const [w, col, al] of [[U * 0.014, P.a, 0.55], [U * 0.006, P.b, 0.95], [U * 0.0022, '#ffffff', 1]]) { ctx.globalAlpha = al * a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((q, j) => ctx[j ? 'lineTo' : 'moveTo'](q[0], q[1])); ctx.stroke(); }
    }
    bloom(ctx, s.x, s.y, U * 0.28 * e, P.b, 0.55 * (1 - clamp(u / 1.1)));
    // a dust ring + the rubble
    ctx.globalAlpha = 0.7 * (1 - clamp(u / 0.7)); ctx.strokeStyle = '#ffe8c0'; ctx.lineWidth = U * 0.012; ellipse(ctx, s.x, s.y, U * 0.52 * e, U * 0.52 * e * 0.5); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    const rn = lite(fx) ? 12 : 24;
    for (let i = 0; i < rn; i++) {
      const an = R() * TAU, sp = U * (0.35 + R() * 0.8), life = 0.9 + R() * 0.6, sz = U * (0.014 + R() * 0.03), rot = R() * TAU, spin = (R() - 0.5) * 9; if (u > life) continue;
      const x = s.x + Math.cos(an) * sp * u * 0.9, y = s.y + Math.sin(an) * sp * u * 0.35 - (U * 0.9 * u) + U * 1.5 * u * u, a = 1 - ease.in(clamp(u / life));
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot + spin * u); ctx.globalAlpha = a; poly(ctx, [[-sz, -sz * 0.6], [sz * 0.8, -sz], [sz, sz * 0.5], [-sz * 0.4, sz]]);
      ctx.fillStyle = '#4a3b36'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = P.b; ctx.stroke(); ctx.restore();
    }
  },

  // ------------------------------------------------------------------ RANGER: a rain of arrows around a tightening reticle
  ranger(ctx, c, W, H, s, P, fx) {
    const t = c.t, U = Math.min(W, H), R = seeded(c.seed), n = lite(fx) ? 18 : 40, dx = 0.32, dl = Math.hypot(dx, 1);
    ctx.globalCompositeOperation = 'lighter';
    // the reticle closes on the target
    const rk = ease.out(clamp(t / 0.55)), rr = U * (0.46 - 0.3 * rk), ra = env(t, c.life, 0.05, 0.5);
    ctx.strokeStyle = P.hi; ctx.lineWidth = U * 0.006; ctx.globalAlpha = ra * 0.9;
    ellipse(ctx, s.x, s.y, rr, rr * 0.58); ctx.stroke(); ellipse(ctx, s.x, s.y, rr * 0.6, rr * 0.6 * 0.58); ctx.globalAlpha = ra * 0.5; ctx.stroke();
    ctx.globalAlpha = ra; for (let i = 0; i < 4; i++) { const an = i * TAU / 4 + 0.78 * rk; ctx.beginPath(); ctx.moveTo(s.x + Math.cos(an) * rr * 0.75, s.y + Math.sin(an) * rr * 0.75 * 0.58); ctx.lineTo(s.x + Math.cos(an) * rr * 1.25, s.y + Math.sin(an) * rr * 1.25 * 0.58); ctx.stroke(); }
    // the arrows
    for (let i = 0; i < n; i++) {
      const lx = s.x + (R() - 0.5) * U * 1.0, ly = s.y + (R() - 0.5) * U * 0.46, d = 0.05 + R() * 0.5, fl = 0.2 + R() * 0.08, len = U * (0.1 + R() * 0.05), u = (t - d) / fl; if (u < 0) continue;
      const a = 1 - ease.in(clamp((t - (c.life - 0.5)) / 0.5));
      if (u < 1) { // in flight: a long streak along the fall direction
        const k = ease.in(u), hx = lx - dx * U * 1.1 * (1 - k), hy = ly - U * 1.1 * (1 - k), tx = hx - dx / dl * len * 2.6, ty = hy - 1 / dl * len * 2.6;
        const g = ctx.createLinearGradient(tx, ty, hx, hy); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, P.a); ctx.globalAlpha = a * 0.75; ctx.strokeStyle = g; ctx.lineWidth = U * 0.012; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = U * 0.004; ctx.beginPath(); ctx.moveTo(hx - dx / dl * len, hy - len / dl); ctx.lineTo(hx, hy); ctx.stroke();
        bloom(ctx, hx, hy, U * 0.025, P.hi, 0.7 * a);
      } else { // stuck in the ground: a short shaft with fletching and a ripple
        const age = u - 1, st = 0.28 * len, tipx = lx, tipy = ly, bx = lx - dx / dl * st * 1.6, by = ly - st * 1.6 / dl * 1.0;
        ctx.globalAlpha = a * (1 - clamp(age / 3) * 0.2); ctx.strokeStyle = '#e9ffe0'; ctx.lineWidth = U * 0.0045; ctx.beginPath(); ctx.moveTo(tipx, tipy); ctx.lineTo(bx, by); ctx.stroke();
        ctx.strokeStyle = P.a; ctx.lineWidth = U * 0.008; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - dx / dl * st * 0.5 + sd * st * 0.35, by - st * 0.5 / dl); ctx.stroke(); }
        const rp = clamp(age / 0.12); if (rp < 1) { ctx.globalAlpha = (1 - rp) * a; ctx.strokeStyle = P.hi; ctx.lineWidth = 2; ellipse(ctx, lx, ly, U * 0.045 * rp, U * 0.045 * rp * 0.5); ctx.stroke(); bloom(ctx, lx, ly, U * 0.05, P.a, 0.6 * (1 - rp)); }
      }
    }
    // leaves lifted by the wind of the volley
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < (lite(fx) ? 8 : 20); i++) {
      const sp = R() * TAU, r0 = U * (0.05 + R() * 0.4), u = clamp((t - 0.25 - R() * 0.3) / 1.3), sz = U * (0.012 + R() * 0.012), col = R() < 0.5; if (u <= 0 || u >= 1) continue;
      const an = sp + u * 3.2, x = s.x + Math.cos(an) * r0 * (1 + u * 0.5), y = s.y + Math.sin(an) * r0 * 0.45 - u * U * 0.35;
      ctx.save(); ctx.translate(x, y); ctx.rotate(an * 2); ctx.globalAlpha = Math.sin(u * Math.PI) * 0.9; ctx.fillStyle = col ? P.a : P.b; ellipse(ctx, 0, 0, sz * 1.6, sz * 0.7); ctx.fill(); ctx.restore();
    }
  },

  // ------------------------------------------------------------------ MAGE: a colossal arcane circle, imploding into a beam
  mage(ctx, c, W, H, s, P, fx) {
    const t = c.t, U = Math.min(W, H), R = seeded(c.seed), open = ease.out(clamp(t / 0.35)), imp = ease.in(clamp((t - 0.85) / 0.3)), rr = U * 0.62 * open * (1 - imp * 0.97), sq = 0.5;
    const a = clamp(t / 0.1) * (1 - imp * 0.4);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const ring = (r, w, col, al, spin, dash) => { ctx.save(); ctx.translate(s.x, s.y); ctx.scale(1, sq); ctx.rotate(spin); ctx.globalAlpha = al * a; ctx.strokeStyle = col; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.arc(0, 0, Math.max(0.1, r), 0, TAU); ctx.stroke(); ctx.restore(); };
    ring(rr, U * 0.016, P.a, 0.5, 0); ring(rr, U * 0.005, '#ffffff', 0.95, 0); ring(rr * 0.86, U * 0.006, P.hi, 0.8, t * 0.5, [U * 0.02, U * 0.012]); ring(rr * 0.5, U * 0.01, P.b, 0.7, -t * 0.8, [U * 0.04, U * 0.015]);
    ctx.save(); ctx.translate(s.x, s.y); ctx.scale(1, sq); ctx.rotate(t * 0.35);
    // rune blocks around the rim and a {7/3} star inside
    ctx.fillStyle = P.hi; for (let i = 0; i < 24; i++) { const an = i / 24 * TAU, w = U * (0.012 + (i % 3) * 0.006); ctx.globalAlpha = a * 0.85; ctx.save(); ctx.translate(Math.cos(an) * rr * 0.93, Math.sin(an) * rr * 0.93); ctx.rotate(an); ctx.fillRect(-w, -w * 0.45, w * 2, w * 0.9); ctx.restore(); }
    ctx.strokeStyle = P.hi; ctx.lineWidth = U * 0.005; ctx.globalAlpha = a * 0.9; ctx.beginPath(); for (let i = 0; i <= 7; i++) { const an = (i * 3 % 7) / 7 * TAU - Math.PI / 2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr * 0.72, Math.sin(an) * rr * 0.72); } ctx.stroke();
    ctx.restore();
    bloom(ctx, s.x, s.y, rr * 0.9, P.a, 0.22 * a);
    // meteors of arcane light fall into the circle
    for (let i = 0; i < (lite(fx) ? 3 : 7); i++) {
      const d = 0.3 + i * 0.09, lx = s.x + (R() - 0.5) * rr * 1.3, ly = s.y + (R() - 0.5) * rr * 0.55, u = clamp((t - d) / 0.28); if (u <= 0 || u >= 1.4) continue; const k = Math.min(1, u), hx = lx + U * 0.5 * (1 - k) * 0.5, hy = ly - U * 0.9 * (1 - k), al = u > 1 ? Math.max(0, 1.4 - u) / 0.4 : 1;
      const g = ctx.createLinearGradient(hx + U * 0.25, hy - U * 0.45, hx, hy); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, P.hi); ctx.globalAlpha = al * 0.85; ctx.strokeStyle = g; ctx.lineWidth = U * 0.02; ctx.beginPath(); ctx.moveTo(hx + U * 0.25, hy - U * 0.45); ctx.lineTo(hx, hy); ctx.stroke(); bloom(ctx, hx, hy, U * 0.05, '#ffffff', al * 0.9);
      if (u >= 1) { const q = clamp(u - 1, 0, 0.4) / 0.4; ctx.globalAlpha = (1 - q) * 0.8; ctx.strokeStyle = P.hi; ctx.lineWidth = 3; ellipse(ctx, lx, ly, U * 0.08 * q, U * 0.04 * q); ctx.stroke(); }
    }
    // the implosion: everything is drawn into one rising column
    if (t > 0.9) { const k = clamp((t - 0.9) / 0.9), w = U * 0.11 * Math.sin(Math.min(1, k * 1.2) * Math.PI) + U * 0.01, al = 1 - ease.in(clamp((k - 0.55) / 0.45));
      const g = ctx.createLinearGradient(0, s.y, 0, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, P.hi); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.95 * al; ctx.fillStyle = g; ctx.fillRect(s.x - w / 2, 0, w, s.y); ctx.globalAlpha = 0.45 * al; ctx.fillStyle = P.a; ctx.fillRect(s.x - w * 1.3, 0, w * 2.6, s.y); bloom(ctx, s.x, s.y, U * 0.3, '#ffffff', 0.8 * al); }
  },

  // ------------------------------------------------------------------ CLERIC: shafts of holy light, spread wings, a halo
  cleric(ctx, c, W, H, s, P, fx) {
    const t = c.t, U = Math.min(W, H), R = seeded(c.seed), a = env(t, c.life, 0.12, 0.6);
    ctx.globalCompositeOperation = 'lighter';
    // three broad shafts of light from above
    for (let i = 0; i < 3; i++) {
      const d = i * 0.08, k = ease.out(clamp((t - d) / 0.22)), cx = s.x + (i - 1) * U * 0.36, top = U * 0.05 + Math.abs(i - 1) * U * 0.03, wt = U * 0.05, wb = U * (i === 1 ? 0.3 : 0.2);
      const g = ctx.createLinearGradient(0, 0, 0, s.y + U * 0.08); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, P.hi); g.addColorStop(1, P.a);
      ctx.globalAlpha = a * (i === 1 ? 0.6 : 0.4) * k * (0.85 + 0.15 * Math.sin(t * 7 + i)); ctx.fillStyle = g;
      const bx = s.x + (cx - s.x) * 0.35; poly(ctx, [[cx - wt, 0], [cx + wt, 0], [bx + wb, s.y + U * 0.06], [bx - wb, s.y + U * 0.06]]); ctx.fill();
    }
    // the cross flare
    const ck = ease.out(clamp(t / 0.18)), cl = U * 0.95 * ck;
    ctx.globalAlpha = a * 0.95; ctx.fillStyle = '#ffffff'; poly(ctx, [[s.x, s.y - cl], [s.x + U * 0.014, s.y], [s.x, s.y + cl * 0.6], [s.x - U * 0.014, s.y]]); ctx.fill();
    poly(ctx, [[s.x - cl * 0.75, s.y], [s.x, s.y - U * 0.008], [s.x + cl * 0.75, s.y], [s.x, s.y + U * 0.008]]); ctx.fill();
    bloom(ctx, s.x, s.y, U * 0.22 * ck, P.hi, 0.7 * a);
    // wings of feathers fanning from the target
    const wk = ease.out(clamp((t - 0.12) / 0.4)), nf = lite(fx) ? 6 : 9;
    for (const sd of [-1, 1]) for (let i = 0; i < nf; i++) {
      const f = i / (nf - 1), an = -0.15 - f * 1.25, L = U * (0.34 - f * 0.12 + (i % 2) * 0.03) * wk, w = U * 0.032;
      ctx.save(); ctx.translate(s.x + sd * U * 0.03, s.y - U * 0.06); ctx.scale(sd, 1); ctx.rotate(an); ctx.globalAlpha = a * 0.8;
      const g = ctx.createLinearGradient(0, 0, L, 0); g.addColorStop(0, P.hi); g.addColorStop(1, P.a); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * 0.5, -w, L, 0); ctx.quadraticCurveTo(L * 0.5, w * 1.1, 0, 0); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4; ctx.globalAlpha = a * 0.7; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * 0.95, 0); ctx.stroke(); ctx.restore();
    }
    // a halo that settles above and drifting feathers
    const hk = ease.out(clamp((t - 0.25) / 0.3)), hy = s.y - U * (0.62 - 0.1 * hk);
    ctx.globalAlpha = a * hk; ctx.strokeStyle = P.hi; ctx.lineWidth = U * 0.014; ellipse(ctx, s.x, hy, U * 0.17, U * 0.05); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = U * 0.004; ellipse(ctx, s.x, hy, U * 0.17, U * 0.05); ctx.stroke(); bloom(ctx, s.x, hy, U * 0.2, P.a, 0.35 * a * hk);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < (lite(fx) ? 8 : 22); i++) { const u = clamp((t - 0.2 - R() * 0.6) / 1.4), x0 = s.x + (R() - 0.5) * U * 1.1, sz = U * (0.012 + R() * 0.012); if (u <= 0 || u >= 1) continue; const y = U * 0.1 + u * (s.y + U * 0.1), x = x0 + Math.sin(u * 9 + i) * U * 0.04;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(u * 7 + i) * 0.8); ctx.globalAlpha = Math.sin(u * Math.PI) * 0.9; ctx.fillStyle = '#fffbe8'; ellipse(ctx, 0, 0, sz * 0.5, sz * 1.5); ctx.fill(); ctx.restore(); }
  },

  // ------------------------------------------------------------------ NINJA: a flurry of hair-thin cuts under a crescent moon
  bladedancer(ctx, c, W, H, s, P, fx) {
    const t = c.t, U = Math.min(W, H), R = seeded(c.seed), a = env(t, c.life, 0.03, 0.4);
    // the world goes dim and violet for a beat
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.38 * a * (1 - ease.in(clamp((t - 0.9) / 0.5))); ctx.fillStyle = P.deep; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // the crescent moon
    const mk = ease.out(clamp(t / 0.4)); ctx.save(); ctx.translate(s.x + U * 0.28, s.y - U * 0.4); ctx.globalAlpha = 0.6 * a * mk; ctx.fillStyle = P.hi; ctx.beginPath(); ctx.arc(0, 0, U * 0.2, 0, TAU); ctx.arc(U * 0.07, -U * 0.03, U * 0.18, 0, TAU, true); ctx.fill('evenodd'); ctx.restore();
    bloom(ctx, s.x + U * 0.28, s.y - U * 0.4, U * 0.3, P.a, 0.3 * a * mk);
    // the cuts: each one snaps across the screen, then holds as a glowing seam
    const n = lite(fx) ? 8 : 16;
    for (let i = 0; i < n; i++) {
      const d = 0.04 + i * 0.045, an = (i / n) * Math.PI + (R() - 0.5) * 0.4 + (i % 2 ? 0.04 : 0), len = U * (0.8 + R() * 0.5), off = (R() - 0.5) * U * 0.14, u = (t - d) / 0.07; if (u < 0) continue;
      const nx = -Math.sin(an) * off, ny = Math.cos(an) * off;
      const hold = 1 - ease.in(clamp((t - d - 0.35) / 0.55)), head = ease.out(clamp(u)), tail = ease.in(clamp((t - d - 0.1) / 0.5)) * 0.4;
      const x0 = s.x + nx + Math.cos(an) * len * (-0.5 + tail), y0 = s.y + ny * 0.7 + Math.sin(an) * len * (-0.5 + tail) * 0.8, x1 = s.x + nx + Math.cos(an) * len * (-0.5 + head), y1 = s.y + ny * 0.7 + Math.sin(an) * len * (-0.5 + head) * 0.8;
      ctx.lineCap = 'round'; for (const [w, col, al] of [[U * 0.012, P.a, 0.4], [U * 0.004, '#ffffff', 1]]) { ctx.globalAlpha = al * hold; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
      if (u < 1.2) bloom(ctx, x1, y1, U * 0.035, '#ffffff', 0.9 * hold);
    }
    // the last cut: a heavy X through the target
    if (t > 0.85) { const k = ease.out(clamp((t - 0.85) / 0.12)), al = 1 - ease.in(clamp((t - 1.1) / 0.4)); ctx.globalAlpha = al; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = U * 0.012; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s.x - sd * U * 0.4 * k, s.y - U * 0.22 * k); ctx.lineTo(s.x + sd * U * 0.4 * k, s.y + U * 0.22 * k); ctx.stroke(); } bloom(ctx, s.x, s.y, U * 0.3 * k, P.a, 0.8 * al); }
    // shuriken flung out
    for (let i = 0; i < (lite(fx) ? 4 : 9); i++) { const an = R() * TAU, u = clamp((t - 0.3 - R() * 0.3) / 0.8), dd = U * (0.3 + R() * 0.4); if (u <= 0 || u >= 1) continue; const d = ease.out(u) * dd, x = s.x + Math.cos(an) * d, y = s.y + Math.sin(an) * d * 0.7, sz = U * 0.022, rot = t * 18 + i;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = 1 - u; ctx.fillStyle = P.hi; poly(ctx, [[0, -sz], [sz * 0.3, -sz * 0.3], [sz, 0], [sz * 0.3, sz * 0.3], [0, sz], [-sz * 0.3, sz * 0.3], [-sz, 0], [-sz * 0.3, -sz * 0.3]]); ctx.fill(); ctx.restore(); }
  },

  // ------------------------------------------------------------------ SAMURAI: one stroke of ink before a red sun
  samurai(ctx, c, W, H, s, P, fx) {
    const t = c.t, U = Math.min(W, H), R = seeded(c.seed), a = env(t, c.life, 0.05, 0.5), ang = -0.32, ca = Math.cos(ang), sa = Math.sin(ang);
    // the red sun rises behind the target
    const sk = ease.out(clamp(t / 0.4)); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * a * sk; ctx.fillStyle = P.a; ctx.beginPath(); ctx.arc(s.x, s.y - U * 0.18, U * 0.3 * (0.8 + 0.2 * sk), 0, TAU); ctx.fill(); bloom(ctx, s.x, s.y - U * 0.18, U * 0.5, P.a, 0.4 * a * sk);
    // the single stroke: a tapered black ink brush with a white-hot core
    const L = Math.hypot(W, H) * 1.1, head = ease.out(clamp((t - 0.12) / 0.09)), x1 = -L / 2 + L * head, hold = 1 - ease.in(clamp((t - 0.6) / 0.8));
    if (head > 0) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(ang); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.88 * hold; ctx.fillStyle = '#0a0508';
      const wmax = U * 0.07; ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.quadraticCurveTo(0, -wmax, x1, 0); ctx.quadraticCurveTo(0, wmax * 0.8, -L / 2, 0); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = hold; for (const [w, col] of [[U * 0.016, P.a], [U * 0.006, '#ffffff']]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.lineTo(x1, 0); ctx.stroke(); }
      bloom(ctx, x1, 0, U * 0.12, '#ffffff', 0.9 * hold); ctx.restore();
    }
    // the sundering: the frame's light parts along the cut
    if (t > 0.2) { const k = ease.out(clamp((t - 0.2) / 0.3)), al = 1 - ease.in(clamp((t - 0.5) / 0.7)); ctx.globalCompositeOperation = 'lighter'; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(ang); ctx.globalAlpha = 0.55 * al; const g = ctx.createLinearGradient(0, -U * 0.12 * k, 0, U * 0.12 * k); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(-L / 2, -U * 0.12 * k, L, U * 0.24 * k); ctx.restore(); }
    // sakura carried on the wind of the blade
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < (lite(fx) ? 14 : 36); i++) { const u = clamp((t - 0.15 - R() * 0.4) / 1.4), x0 = R() * W, y0 = R() * H * 0.9, sz = U * (0.008 + R() * 0.012); if (u <= 0 || u >= 1) continue; const x = x0 + u * W * 0.25 * ca + Math.sin(u * 8 + i) * U * 0.03, y = y0 + u * H * 0.2 + Math.cos(u * 6 + i) * U * 0.02;
      ctx.save(); ctx.translate(x, y); ctx.rotate(u * 7 + i); ctx.globalAlpha = Math.sin(u * Math.PI) * 0.9; ctx.fillStyle = i % 3 ? '#ffc2d6' : '#fff0f5'; ellipse(ctx, 0, 0, sz * 1.3, sz * 0.8); ctx.fill(); ctx.restore(); }
  },

  // ------------------------------------------------------------------ MONK: chi ripples and a hundred bright fist-pops
  monk(ctx, c, W, H, s, P, fx) {
    const t = c.t, U = Math.min(W, H), R = seeded(c.seed), a = env(t, c.life, 0.05, 0.4);
    ctx.globalCompositeOperation = 'lighter';
    // wisps of chi spiral in, then ripples roll out
    for (let i = 0; i < (lite(fx) ? 4 : 7); i++) { const u = clamp(t / 0.5); if (u >= 1) break; ctx.globalAlpha = (1 - u) * 0.8; ctx.strokeStyle = i % 2 ? P.b : P.hi; ctx.lineWidth = U * 0.008; ctx.beginPath();
      for (let j = 0; j <= 20; j++) { const f = j / 20, r = U * (0.5 - 0.45 * u) * (1 - f * 0.9) + U * 0.02, an = i / 7 * TAU + f * 3.5 - u * 3; ctx[j ? 'lineTo' : 'moveTo'](s.x + Math.cos(an) * r, s.y + Math.sin(an) * r * 0.55); } ctx.stroke(); }
    for (let i = 0; i < 6; i++) { const d = 0.35 + i * 0.1, u = clamp((t - d) / 0.9); if (u <= 0 || u >= 1) continue; const r = U * 0.75 * ease.out(u); ctx.globalAlpha = (1 - u) * a; ctx.strokeStyle = i % 2 ? P.a : P.hi; ctx.lineWidth = U * (0.02 - 0.014 * u); ellipse(ctx, s.x, s.y, r, r * 0.55); ctx.stroke(); }
    bloom(ctx, s.x, s.y, U * 0.25, P.a, 0.4 * a);
    // the hundred fists: quick bright pops scattered around the target
    const n = lite(fx) ? 18 : 48;
    for (let i = 0; i < n; i++) {
      const d = 0.3 + i * 0.018, u = (t - d) / 0.28, ax = R() * TAU, rr = U * (0.04 + R() * 0.34), x = s.x + Math.cos(ax) * rr, y = s.y + Math.sin(ax) * rr * 0.55; if (u < 0 || u > 1) continue;
      const k = ease.out(clamp(u)), al = 1 - ease.in(clamp((u - 0.3) / 0.7));
      ctx.globalAlpha = al; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, U * 0.012 * (1.4 - u), 0, TAU); ctx.fill(); bloom(ctx, x, y, U * 0.05, P.a, 0.7 * al);
      ctx.strokeStyle = P.hi; ctx.lineWidth = 2; ctx.beginPath(); for (let j = 0; j < 8; j++) { const an = j / 8 * TAU + ax; ctx.moveTo(x + Math.cos(an) * U * 0.02 * k, y + Math.sin(an) * U * 0.02 * k); ctx.lineTo(x + Math.cos(an) * U * 0.05 * k, y + Math.sin(an) * U * 0.05 * k); } ctx.stroke();
      ctx.globalAlpha = al * 0.6; ctx.strokeStyle = P.b; ellipse(ctx, x, y, U * 0.045 * k, U * 0.025 * k); ctx.stroke();
    }
  },

  // ------------------------------------------------------------------ DRAGOON: a falling lance, a ring of dragonfire
  dragoon(ctx, c, W, H, s, P, fx) {
    const t = c.t, U = Math.min(W, H), R = seeded(c.seed), a = env(t, c.life, 0.04, 0.5), fall = 0.24;
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const lance = (x, y, len, k, al, wd) => { // a spear driving straight down; (x,y) is the tip
      const tipY = y - (1 - k) * U * 1.0, shaftTop = tipY - len;
      const g = ctx.createLinearGradient(0, shaftTop - len * 0.8, 0, tipY); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, P.a); ctx.globalAlpha = al * 0.6; ctx.fillStyle = g; ctx.fillRect(x - wd * 2.2, shaftTop - len * 0.8, wd * 4.4, len * 1.8);
      ctx.globalAlpha = al; ctx.fillStyle = '#ffeede'; ctx.fillRect(x - wd * 0.5, shaftTop, wd, len * 0.82);
      poly(ctx, [[x, tipY], [x - wd * 1.6, tipY - len * 0.2], [x - wd * 0.5, tipY - len * 0.26], [x + wd * 0.5, tipY - len * 0.26], [x + wd * 1.6, tipY - len * 0.2]]); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.fillStyle = P.a; poly(ctx, [[x - wd * 2.4, tipY - len * 0.3], [x, tipY - len * 0.22], [x + wd * 2.4, tipY - len * 0.3], [x, tipY - len * 0.4]]); ctx.fill(); // wing guard
      bloom(ctx, x, tipY, wd * 7, P.hi, 0.7 * al);
    };
    for (let i = 0; i < (lite(fx) ? 3 : 7); i++) { const d = 0.1 + i * 0.05, k = ease.in(clamp((t - d) / 0.2)), x = s.x + (i ? (R() - 0.5) * U * 0.9 : 0), y = s.y + (i ? (R() - 0.5) * U * 0.3 : 0); if (k <= 0) continue; lance(x, y, U * (i ? 0.26 : 0.5), k, a * (i ? 0.85 : 1), U * (i ? 0.012 : 0.022)); }
    if (t < fall) return;
    const u = t - fall, e = ease.out(clamp(u / 0.3));
    // the ring of dragonfire and its tongues
    ctx.globalAlpha = a * 0.9; ctx.strokeStyle = P.b; ctx.lineWidth = U * 0.02; ellipse(ctx, s.x, s.y, U * 0.5 * e, U * 0.5 * e * 0.5); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = U * 0.004; ctx.stroke();
    const nt = lite(fx) ? 14 : 30;
    for (let i = 0; i < nt; i++) {
      const an = i / nt * TAU + R() * 0.2, rr = U * 0.5 * e * (0.9 + R() * 0.15), bx = s.x + Math.cos(an) * rr, by = s.y + Math.sin(an) * rr * 0.5, ph = R() * 6, h = U * (0.1 + R() * 0.12) * (0.75 + 0.25 * Math.sin(t * 14 + ph)) * Math.min(1, u / 0.25) * (1 - ease.in(clamp((t - 1.2) / 0.5)));
      if (h <= 1) continue; const w = U * 0.02, sway = Math.sin(t * 9 + ph) * w * 0.8;
      const g = ctx.createLinearGradient(0, by, 0, by - h); g.addColorStop(0, P.a); g.addColorStop(0.6, P.b); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.globalAlpha = a * 0.75;
      ctx.beginPath(); ctx.moveTo(bx - w, by); ctx.quadraticCurveTo(bx - w * 0.6 + sway, by - h * 0.5, bx + sway * 1.5, by - h); ctx.quadraticCurveTo(bx + w * 0.6 + sway, by - h * 0.5, bx + w, by); ctx.fill();
    }
    bloom(ctx, s.x, s.y, U * 0.35 * e, P.a, 0.5 * a * (1 - clamp(u / 1.2)));
    // embers rising
    for (let i = 0; i < (lite(fx) ? 10 : 28); i++) { const k = clamp((u - R() * 0.4) / 1.2), an = R() * TAU, rr = U * 0.5 * R(), x = s.x + Math.cos(an) * rr + Math.sin(k * 8 + i) * U * 0.02, y = s.y + Math.sin(an) * rr * 0.5 - k * U * (0.3 + R() * 0.5); if (k <= 0 || k >= 1) continue; ctx.globalAlpha = Math.sin(k * Math.PI); ctx.fillStyle = i % 3 ? P.b : '#ffffff'; ctx.fillRect(x - 2, y - 2, 4, 4); }
  },

  // ------------------------------------------------------------------ SUMMONER: a summoning gate, spirit tendrils, orbiting pages
  summoner(ctx, c, W, H, s, P, fx) {
    const t = c.t, U = Math.min(W, H), R = seeded(c.seed), a = env(t, c.life, 0.1, 0.55), open = ease.out(clamp(t / 0.4)), rr = U * 0.5 * open, sq = 0.5;
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.globalAlpha = 0.5 * a; ctx.fillStyle = P.deep; ctx.save(); ctx.translate(s.x, s.y); ctx.scale(1, sq); ctx.beginPath(); ctx.arc(0, 0, rr * 0.95, 0, TAU); ctx.fill(); ctx.restore(); // the dark of the gate
    for (const [r, w, col, al, spin, dash] of [[1, 0.014, P.a, 0.55, 0], [1, 0.005, '#ffffff', 0.95, 0], [0.82, 0.005, P.hi, 0.8, t * 0.6, [0.022, 0.012]], [0.6, 0.008, P.b, 0.7, -t * 0.9, [0.04, 0.012]]]) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.scale(1, sq); ctx.rotate(spin); ctx.globalAlpha = al * a; ctx.strokeStyle = col; ctx.lineWidth = U * w; ctx.setLineDash(dash ? dash.map((v) => v * U) : []); ctx.beginPath(); ctx.arc(0, 0, rr * r, 0, TAU); ctx.stroke(); ctx.restore(); }
    // an eye opens in the gate
    const ek = ease.out(clamp((t - 0.3) / 0.3)) * (1 - ease.in(clamp((t - 1.3) / 0.4)));
    if (ek > 0.01) { ctx.globalAlpha = a * ek; ctx.fillStyle = P.b; ctx.beginPath(); ctx.moveTo(s.x - rr * 0.38, s.y); ctx.quadraticCurveTo(s.x, s.y - rr * 0.34 * ek, s.x + rr * 0.38, s.y); ctx.quadraticCurveTo(s.x, s.y + rr * 0.34 * ek, s.x - rr * 0.38, s.y); ctx.fill(); ctx.fillStyle = P.deep; ellipse(ctx, s.x, s.y, rr * 0.035, rr * 0.2 * ek); ctx.fill(); bloom(ctx, s.x, s.y, rr * 0.5, P.b, 0.5 * a * ek); }
    // spirit tendrils rising from the rim
    const nt = lite(fx) ? 6 : 12;
    for (let i = 0; i < nt; i++) { const an = i / nt * TAU + R() * 0.3, bx = s.x + Math.cos(an) * rr * 0.9, by = s.y + Math.sin(an) * rr * 0.9 * sq, h = U * (0.25 + R() * 0.3) * ease.out(clamp((t - 0.2 - R() * 0.2) / 0.5)), ph = R() * 6; if (h < 2) continue;
      for (const [w, col, al] of [[U * 0.014, P.a, 0.4], [U * 0.004, P.hi, 0.9]]) { ctx.globalAlpha = al * a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); for (let j = 0; j <= 12; j++) { const f = j / 12; ctx[j ? 'lineTo' : 'moveTo'](bx + Math.sin(f * 5 + t * 4 + ph) * U * 0.03 * f + (s.x - bx) * f * 0.25, by - h * f); } ctx.stroke(); }
      bloom(ctx, bx + (s.x - bx) * 0.25 + Math.sin(5 + t * 4 + ph) * U * 0.03, by - h, U * 0.03, P.hi, 0.7 * a); }
    // pages spiralling up out of the gate
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < (lite(fx) ? 8 : 18); i++) { const u = clamp((t - 0.25 - i * 0.04) / 1.2); if (u <= 0 || u >= 1) continue; const an = i * 1.1 + u * 5, r = rr * (0.8 - 0.35 * u), x = s.x + Math.cos(an) * r, y = s.y + Math.sin(an) * r * sq - u * U * 0.5, sz = U * 0.024;
      ctx.save(); ctx.translate(x, y); ctx.rotate(an * 1.5); ctx.scale(1, Math.abs(Math.cos(an * 2)) * 0.7 + 0.3); ctx.globalAlpha = Math.sin(u * Math.PI) * 0.95; ctx.fillStyle = '#f4ecd0'; ctx.fillRect(-sz, -sz * 1.2, sz * 2, sz * 2.4); ctx.fillStyle = P.deep; ctx.globalAlpha *= 0.5; for (let l = 0; l < 3; l++) ctx.fillRect(-sz * 0.7, -sz * 0.7 + l * sz * 0.6, sz * 1.4, sz * 0.14); ctx.restore(); }
  },

  // ------------------------------------------------------------------ BARD: the stage lights up
  bard(ctx, c, W, H, s, P, fx) {
    const t = c.t, U = Math.min(W, H), R = seeded(c.seed), a = env(t, c.life, 0.12, 0.5);
    ctx.globalCompositeOperation = 'lighter';
    // spotlights swing in from the top and lock on the target
    for (let i = 0; i < 3; i++) { const k = ease.out(clamp((t - i * 0.07) / 0.3)), top = W * (0.18 + i * 0.32), sw = (1 - k) * (i - 1) * W * 0.3, tx = s.x + sw, hw = U * 0.1;
      const g = ctx.createLinearGradient(top, 0, tx, s.y); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, i === 1 ? P.a : P.b); ctx.globalAlpha = a * 0.3 * (0.8 + 0.2 * Math.sin(t * 9 + i)); ctx.fillStyle = g; poly(ctx, [[top - U * 0.015, 0], [top + U * 0.015, 0], [tx + hw, s.y], [tx - hw, s.y]]); ctx.fill(); }
    // the equaliser: bars bounce along the bottom
    const nb = lite(fx) ? 16 : 30, bw = W / nb;
    for (let i = 0; i < nb; i++) { const k = clamp(t / 0.15), h = (0.2 + 0.8 * Math.abs(Math.sin(t * (7 + (i % 5) * 1.3) + i * 0.9))) * H * 0.38 * k, g = ctx.createLinearGradient(0, H, 0, H - h); g.addColorStop(0, P.a); g.addColorStop(1, P.b); ctx.globalAlpha = a * 0.5; ctx.fillStyle = g; ctx.fillRect(i * bw + bw * 0.12, H - h, bw * 0.76, h); ctx.globalAlpha = a * 0.9; ctx.fillStyle = '#ffffff'; ctx.fillRect(i * bw + bw * 0.12, H - h, bw * 0.76, 3); }
    // round sound rings
    for (let i = 0; i < 4; i++) { const u = clamp((t - i * 0.14) / 0.8); if (u <= 0 || u >= 1) continue; const r = U * 0.75 * ease.out(u); ctx.globalAlpha = (1 - u) * a; ctx.strokeStyle = i % 2 ? P.b : P.hi; ctx.lineWidth = U * 0.012; ctx.setLineDash([U * 0.03, U * 0.02]); ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    bloom(ctx, s.x, s.y, U * 0.3, P.a, 0.4 * a);
    // a staff sweeps across with notes riding it, plus notes drifting up
    const sk = ease.out(clamp((t - 0.1) / 0.25)); ctx.strokeStyle = P.hi; ctx.lineWidth = 2; ctx.globalAlpha = a * 0.7; for (let l = 0; l < 5; l++) { const y = s.y - U * 0.35 + l * U * 0.018; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W * sk, y); ctx.stroke(); }
    for (let i = 0; i < 9; i++) { const x = ((i + 0.5) / 9) * W, y = s.y - U * 0.35 + ((i * 7) % 5) * U * 0.018 + Math.sin(t * 8 + i) * U * 0.012; if (x > W * sk) continue; note(ctx, x, y, U * 0.03, i % 2 ? P.b : '#ffffff', a); }
    for (let i = 0; i < (lite(fx) ? 6 : 14); i++) { const u = clamp((t - 0.2 - R() * 0.5) / 1.2), nx = (R() - 0.5) * U * 0.9, ns = U * (0.026 + R() * 0.02); if (u <= 0 || u >= 1) continue; note(ctx, s.x + nx + Math.sin(u * 7 + i) * U * 0.03, s.y + U * 0.05 - u * U * 0.6, ns, i % 2 ? P.a : P.hi, Math.sin(u * Math.PI), Math.sin(u * 5 + i) * 0.3); }
  },
};

/** Which of the old generic layers each class keeps (the rest are replaced by its own centrepiece above). */
export const FIN_KEEP = {
  warrior: { vortex: 0.0, burst: 0, slashes: 0, bolts: 0, shards: 0, flare: 0, lines: 1 },
  ranger: { vortex: 0, burst: 0, slashes: 0, bolts: 0, shards: 0, flare: 0, lines: 0 },
  mage: { vortex: 0, burst: 1, slashes: 0, bolts: 0, shards: 0, flare: 1, lines: 0 },
  cleric: { vortex: 0, burst: 0, slashes: 0, bolts: 0, shards: 0, flare: 1, lines: 0 },
  bladedancer: { vortex: 0, burst: 0, slashes: 0, bolts: 0, shards: 0, flare: 0, lines: 0 },
  samurai: { vortex: 0, burst: 0, slashes: 0, bolts: 0, shards: 0, flare: 0, lines: 1 },
  monk: { vortex: 0.35, burst: 0, slashes: 0, bolts: 0, shards: 0, flare: 0, lines: 0 },
  dragoon: { vortex: 0.5, burst: 0, slashes: 0, bolts: 0, shards: 0, flare: 0, lines: 1 },
  summoner: { vortex: 0, burst: 0, slashes: 0, bolts: 0, shards: 0, flare: 0, lines: 0 },
  bard: { vortex: 0, burst: 1, slashes: 0, bolts: 0, shards: 0, flare: 0, lines: 0 },
};
export const FIN_LIFE = { warrior: 1.9, ranger: 2.0, mage: 2.0, cleric: 2.1, bladedancer: 1.7, samurai: 1.9, monk: 1.8, dragoon: 2.0, summoner: 2.1, bard: 2.0 };
