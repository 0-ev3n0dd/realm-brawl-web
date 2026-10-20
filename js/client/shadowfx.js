// Part B: the Shadow Duel's look. The mirror is your hero's own model (client/art.js drawHero, classic rig) in a
// corrupted palette: drained to near-black violet, a smoky aura under it, a violet rim glow and burning eyes. Registered
// into ENEMY_DRAW for every shadow_<class> type (sim/shadowduel.js), so it rides the normal enemy draw (hit flash, HP bar).
import { ENEMY_DRAW, drawHero, heroEyes, SHADOW_EYES, circle } from './art.js';
import { glowSprite, blit } from './sprite.js';
import { CLASSES } from '../sim/data/classes.js';
import { shadowAlpha } from './duelcine.js';
const TAU = Math.PI * 2;

const APP = { skin: 4, hairStyle: 3, hairColor: 6, outfit: 5 };
function drawShadow(ctx, e, t) {
  const cls = e.type.slice(7), face = e.face || 0;
  if (!e._peel) { const sa = shadowAlpha(); if (sa <= 0) return; if (sa < 1) ctx.globalAlpha *= sa; } // (B3: hidden until its reflection peels up into it)
  ctx.rotate(-face); // (upright: the hero rig faces by its own angle)
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + t * 0.8, u = (t * 0.5 + i / 6) % 1; ctx.globalAlpha = (1 - u) * 0.35; circle(ctx, Math.cos(a) * 18 * u, 10 - u * 46, 9 + u * 10, '#5b2a8a', 0); }
  ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 3); blit(ctx, glowSprite('#8a3cff', 46), 0, -14);
  ctx.restore();
  ctx.save(); ctx.filter = 'brightness(0.5) saturate(0.6) contrast(1.35)';
  const H = { tuckEyes: true, x: 0, y: 0, ang: face, cls: CLASSES[cls] ? cls : 'warrior', app: APP, time: t, anim: e.state === 'cast' ? { kind: 'skill', id: 'cast', t: Math.min(20, e.st | 0), dur: 24 } : null, scale: 1.2, moving: e.state !== 'cast', classic: true };
  drawHero(ctx, H);
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const k = 0.7 + 0.3 * Math.sin(t * 9);
  const EY = heroEyes(H); if (!e._peel && e.id != null) SHADOW_EYES.set(e.id, EY); // (B5: on the rig's real eyes; the duel close-up reads this too)
  if (EY.vis > 0) for (const q of EY.pts) { ctx.globalAlpha = k * EY.vis; blit(ctx, glowSprite('#ff2b4e', 9), q.x, q.y); circle(ctx, q.x, q.y, EY.r, '#ff3b5c', 0); }
  ctx.restore();
}
for (const c of Object.keys(CLASSES)) ENEMY_DRAW['shadow_' + c] = drawShadow;
export const shadowfxReady = true;
void TAU;
