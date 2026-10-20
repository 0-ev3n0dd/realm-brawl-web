// The hero-unlock moment (2026-10-16, sim/herocraft.js assemble): a full-screen reveal - a white flash, class-colour god
// rays, a shock ring and embers round the hero's showcase model playing its flourish, "HERO UNLOCKED" slamming in.
// Click / key / tap (or ~5 s) closes it. Shared by PC and phone.
import { ShowcaseView, fitScale, sheetKind, preloadAll } from './heromodel.js';
import { heroOf } from '../sim/heroes.js';
import { CLASSES } from '../sim/data/classes.js';

const CSS = `#heroReveal{position:fixed;inset:0;z-index:9200;background:#000;cursor:pointer;font-family:'Lilita One',sans-serif;color:#fff;overflow:hidden}
#heroReveal canvas{position:absolute;inset:0;width:100%;height:100%}
#heroReveal .hr-t{position:absolute;left:0;right:0;top:7%;text-align:center;pointer-events:none}
#heroReveal .hr-t b{display:block;font-size:min(9vw,84px);letter-spacing:2px;color:#fff;text-shadow:0 0 30px var(--hc),0 6px 0 #1a1226;animation:hrSlam .55s cubic-bezier(.2,1.6,.4,1) both .25s}
#heroReveal .hr-n{position:absolute;left:0;right:0;bottom:9%;text-align:center;pointer-events:none;animation:hrUp .6s ease-out both .9s}
#heroReveal .hr-n b{display:block;font-size:min(7vw,58px);color:var(--hc);text-shadow:0 4px 0 #1a1226}
#heroReveal .hr-n span{font-family:system-ui,sans-serif;font-size:16px;opacity:.85}
#heroReveal .hr-n small{display:block;margin-top:10px;font-family:system-ui,sans-serif;font-size:12px;opacity:.55}
@keyframes hrSlam{0%{transform:scale(3);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes hrUp{0%{transform:translateY(30px);opacity:0}100%{transform:none;opacity:1}}`;
export function showHeroUnlocked(cls, { audio = null, isMobile = false, onClose = null, hold = 5200 } = {}) {
  if (document.getElementById('heroReveal')) return null;
  if (!document.getElementById('heroRevealCss')) { const st = document.createElement('style'); st.id = 'heroRevealCss'; st.textContent = CSS; document.head.appendChild(st); }
  const H = heroOf(cls), col = (CLASSES[cls] || {}).color || '#ffd23f';
  const el = document.createElement('div'); el.id = 'heroReveal'; el.style.setProperty('--hc', col);
  el.innerHTML = `<canvas></canvas><div class="hr-t"><b>HERO UNLOCKED!</b></div><div class="hr-n"><b>${H.name}</b><span>${H.title} · ${(CLASSES[cls] || {}).name || ''} · ${H.role}</span><small>${isMobile ? 'tap' : 'click'} to continue</small></div>`;
  document.body.appendChild(el);
  const cv = el.querySelector('canvas'), g = cv.getContext('2d'), view = new ShowcaseView(), kind = sheetKind(isMobile);
  try { preloadAll(kind, cls); } catch { /* */ }
  if (audio) try { audio.play('legendary'); setTimeout(() => audio.play('legendary'), 380); } catch { /* */ }
  const t0 = performance.now(), embers = Array.from({ length: 90 }, (_, i) => ({ a: (i * 2.399) % (Math.PI * 2), s: 0.3 + ((i * 37) % 100) / 100, r: 1 + (i % 4) }));
  let raf = 0, done = false, flo = false;
  const close = () => { if (done) return; done = true; cancelAnimationFrame(raf); el.style.transition = 'opacity .35s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 360); if (onClose) onClose(); removeEventListener('keydown', key, true); };
  const key = (e) => { e.preventDefault(); e.stopPropagation(); close(); };
  setTimeout(() => { el.onclick = close; addEventListener('keydown', key, true); }, 700);
  if (hold) setTimeout(close, hold);
  const frame = (now) => {
    const t = (now - t0) / 1000, dpr = Math.min(isMobile ? 1.5 : 2, devicePixelRatio || 1), W = el.clientWidth, Hh = el.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(Hh * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, W, Hh);
    const cx = W / 2, cy = Hh * 0.55, R = Math.max(W, Hh);
    // god rays
    g.save(); g.translate(cx, cy); g.rotate(t * 0.15); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) { g.rotate(Math.PI * 2 / 14); const gr = g.createLinearGradient(0, 0, R, 0); gr.addColorStop(0, col + 'aa'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(R, -R * 0.09); g.lineTo(R, R * 0.09); g.closePath(); g.globalAlpha = 0.25 + 0.15 * Math.sin(t * 2 + i); g.fill(); }
    g.restore(); g.globalAlpha = 1;
    // glow + shock rings
    const bg = g.createRadialGradient(cx, cy, 10, cx, cy, Hh * 0.55); bg.addColorStop(0, col + '88'); bg.addColorStop(1, col + '00'); g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
    for (const d of [0.2, 0.55, 0.9]) { const u = (t - d) / 1.1; if (u > 0 && u < 1) { g.strokeStyle = col; g.globalAlpha = 1 - u; g.lineWidth = 10 * (1 - u) + 2; g.beginPath(); g.arc(cx, cy, 30 + u * R * 0.6, 0, Math.PI * 2); g.stroke(); } }
    g.globalAlpha = 1;
    // embers
    for (const e of embers) { const u = (t * e.s * 0.35 + e.a) % 1, rr = 40 + u * R * 0.55; g.globalAlpha = (1 - u) * 0.9; g.fillStyle = e.r > 2 ? '#fff6d8' : col; g.beginPath(); g.arc(cx + Math.cos(e.a + t * 0.2) * rr, cy + Math.sin(e.a + t * 0.2) * rr * 0.7, e.r, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
    // the hero
    const y = Hh * 0.82; if (!flo && t > 0.35) { flo = true; view.flourish(cls, t); }
    const k = fitScale([cls], { x: cx, y, bounds: [W * 0.15, Hh * 0.2, W * 0.85, Hh * 0.86], max: Hh / 700 });
    view.draw(g, cls, { x: cx, y, k: k * (0.6 + 0.4 * Math.min(1, t / 0.5)), t, kind });
    // white flash
    if (t < 0.5) { g.globalAlpha = 1 - t / 0.5; g.fillStyle = '#fff'; g.fillRect(0, 0, W, Hh); g.globalAlpha = 1; }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { close };
}
