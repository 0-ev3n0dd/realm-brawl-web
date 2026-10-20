// Starter selection (2026-10-15): a new account picks one of three starter heroes (Brakka, Sylva, Orin) after naming
// itself. Their showcase models (client/heromodel.js, the approved display models) on three lit stages; hover / focus
// flares the hero, a pick fires its flourish and the gate burst, then the title screen shows that hero. All three starters
// unlock (sim/heroUnlock.js pickStarter); the other seven stay locked until the future unlock system.
import { CLASSES } from '../sim/data/classes.js';
import { heroOf } from '../sim/heroes.js';
import { heroFor } from '../sim/heroes.js';
import { STARTERS, pickStarter } from '../sim/heroUnlock.js';
import { profile } from './rewards.js';
import { ShowcaseView, fitScale, sheetKind, preloadModel, drawBurst } from './heromodel.js';
import { drawPlatform, rgba } from './heroshow.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CSS = `#starterPick{position:fixed;inset:0;z-index:8500;background:#000;font-family:'Lilita One',sans-serif;color:#fff4dc;user-select:none}
#starterPick canvas{position:absolute;inset:0;width:100%;height:100%}
#starterPick .sp-head{position:absolute;top:3.5vh;left:0;right:0;text-align:center;pointer-events:none;text-shadow:0 4px 0 #1a1226}
#starterPick .sp-head b{display:block;font-size:clamp(28px,4.6vw,60px);color:#ffd23f;letter-spacing:.02em;line-height:1}
#starterPick .sp-head span{display:block;font:clamp(13px,1.4vw,18px) system-ui,sans-serif;opacity:.85;margin-top:6px}
#starterPick .sp-row{position:absolute;inset:16vh 3vw 3vh;display:grid;grid-template-columns:repeat(3,1fr);gap:2vw}
#starterPick .sp-card{position:relative;border:3px solid rgba(255,255,255,.12);border-radius:22px;background:linear-gradient(rgba(255,255,255,.03),rgba(0,0,0,.25));cursor:pointer;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:0 0 2.2vh;transition:transform .18s,border-color .18s,box-shadow .18s;outline:none}
#starterPick .sp-card:hover,#starterPick .sp-card:focus,#starterPick .sp-card.hot{transform:translateY(-6px);border-color:var(--c);box-shadow:0 0 0 3px var(--c) inset,0 0 38px var(--g)}
#starterPick .sp-card.dim{opacity:.45}
#starterPick .sp-nm{text-align:center;text-shadow:0 3px 0 #1a1226;pointer-events:none}
#starterPick .sp-nm b{display:block;font-size:clamp(26px,3.2vw,46px);line-height:1}
#starterPick .sp-nm span{display:block;font-size:clamp(14px,1.5vw,21px);color:var(--c)}
#starterPick .sp-nm em{display:block;font:normal clamp(11px,1.05vw,14px) system-ui,sans-serif;opacity:.85;margin:6px 1.2vw 10px;line-height:1.3;max-width:28ch;margin-left:auto;margin-right:auto}
#starterPick .sp-go{font:inherit;font-size:clamp(16px,1.6vw,22px);padding:8px 26px;border-radius:12px;border:3px solid #1a1226;background:var(--c);color:#1a1226;cursor:pointer;box-shadow:0 4px 0 #1a1226}
#starterPick .sp-foot{position:absolute;bottom:1vh;left:0;right:0;text-align:center;font:12px system-ui,sans-serif;opacity:.6;pointer-events:none}
body.rb-mobile #starterPick .sp-row{inset:13vh 2vw 2vh}
@media (max-height:480px){#starterPick .sp-row{inset:21vh 2vw 2vh}#starterPick .sp-head{top:2vh}}`;
const BLURB = { warrior: 'Up close and loud. Cleaves packs, shrugs off hits and plants the hammer.', ranger: 'Picks targets apart from range. Fast, mobile, deadly crits.', mage: 'Bends the battlefield: huge spells that wipe whole packs.' };

/** show the screen; onPicked(heroChar) after the pick animation */
export function showStarterSelect({ storage, store, isMobile = false, onPicked } = {}) {
  if (document.getElementById('starterPick')) return;
  if (!document.getElementById('starterPickCss')) { const st = document.createElement('style'); st.id = 'starterPickCss'; st.textContent = CSS; document.head.appendChild(st); }
  const kind = sheetKind(isMobile); for (const c of STARTERS) preloadModel(c, kind);
  const el = document.createElement('div'); el.id = 'starterPick';
  el.innerHTML = `<canvas id="spCv"></canvas><div class="sp-head"><b>Choose Your Starter</b><span>Choose wisely - the others must be earned.</span></div>
    <div class="sp-row">${STARTERS.map((c, i) => { const H = heroOf(c), C = CLASSES[c]; return `<div class="sp-card" tabindex="0" data-cls="${c}" style="--c:${C.color};--g:${rgba(C.color, 0.45)}"><div class="sp-nm"><b>${esc(H.name)}</b><span>${esc(H.title)}</span><em>${esc(C.name)} · ${esc(H.role)}<br>${esc(BLURB[c] || '')}</em></div><button class="sp-go" data-go="${c}">Choose ${esc(H.name)}</button></div>`; }).join('')}</div>
    <div class="sp-foot">${isMobile ? 'Tap a hero' : 'Click a hero · ← → and Enter'}</div>`;
  document.body.appendChild(el);
  const cv = el.querySelector('#spCv'), g = cv.getContext('2d'), views = Object.fromEntries(STARTERS.map((c) => [c, new ShowcaseView()]));
  const cards = [...el.querySelectorAll('.sp-card')];
  let hot = 1, t = 0, lt = performance.now(), raf = 0, picked = null, pickT = 0, lastHot = -1;
  const setHot = (i) => { hot = (i + 3) % 3; cards.forEach((c, j) => c.classList.toggle('hot', j === hot)); if (hot !== lastHot) { lastHot = hot; views[STARTERS[hot]].flourish(STARTERS[hot], t); } };
  cards.forEach((c, i) => { c.onmouseenter = () => setHot(i); c.onfocus = () => setHot(i); c.onclick = () => choose(STARTERS[i]); });
  setHot(1);
  const sparks = Array.from({ length: 90 }, (_, i) => ({ s: i * 0.618 % 1, x: (i * 0.377) % 1, r: 1 + (i % 4) }));
  function draw() {
    const now = performance.now(), dt = Math.min(0.05, (now - lt) / 1000); lt = now; t += dt;
    const dpr = Math.min(isMobile ? 1.5 : 2, devicePixelRatio || 1), W = el.clientWidth, H = el.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    // backdrop: slow rotating god-rays + rising embers in the hot hero's colour
    const hc = CLASSES[STARTERS[hot]].color;
    const bg = g.createRadialGradient(W / 2, H * 0.6, 10, W / 2, H * 0.6, Math.max(W, H) * 0.75); bg.addColorStop(0, rgba(hc, 0.22)); bg.addColorStop(1, 'rgba(18,12,28,0)'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H * 1.05); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + Math.sin(t * 0.15 + i) * 0.05 + (i - 6.5) * 0.12; g.rotate(0); g.fillStyle = rgba(i % 2 ? hc : '#fff6d8', 0.035); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - 0.03) * H * 1.6, Math.sin(a - 0.03) * H * 1.6); g.lineTo(Math.cos(a + 0.03) * H * 1.6, Math.sin(a + 0.03) * H * 1.6); g.fill(); }
    g.restore();
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const p of sparks) { const u = (p.s + t * 0.06 * (1 + p.r * 0.2)) % 1; g.globalAlpha = (1 - u) * 0.7; g.fillStyle = p.r % 2 ? hc : '#ffe9a8'; g.beginPath(); g.arc(p.x * W + Math.sin(u * 9 + p.x * 20) * 18, H * (1 - u), p.r, 0, Math.PI * 2); g.fill(); }
    g.restore();
    // three stages: the model stands in its card above the name block
    const boxes = cards.map((c) => { const a = c.getBoundingClientRect(), o = el.getBoundingClientRect(), nm = c.querySelector('.sp-nm').getBoundingClientRect(); return { x: a.left - o.left, y: a.top - o.top, w: a.width, h: a.height, top: nm.top - o.top }; });
    let k = Infinity;
    for (let i = 0; i < 3; i++) { const b = boxes[i]; k = Math.min(k, fitScale([STARTERS[i]], { x: b.x + b.w / 2, y: b.top - 10, bounds: [b.x + 8, b.y + 8, b.x + b.w - 8, b.top - 4], max: H / 620 })); }
    for (let i = 0; i < 3; i++) {
      const c = STARTERS[i], b = boxes[i], col = CLASSES[c].color, x = b.x + b.w / 2, fy = b.top - 10, on = i === hot, pr = Math.min(b.w * 0.36, 120);
      drawPlatform(g, x, fy, pr, col, t + i, { spot: on });
      if (on || picked === c) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, fy - pr * 1.6, 0, x, fy - pr * 1.6, pr * 2.6); gr.addColorStop(0, rgba(col, 0.35 + 0.1 * Math.sin(t * 3))); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(b.x, b.y, b.w, b.h); g.restore(); }
      views[c].draw(g, c, { x, y: fy, k: k * (on ? 1.04 : 0.96), t: t + i * 0.37, kind, alpha: picked && picked !== c ? 0.35 : on ? 1 : 0.8 });
      if (picked === c) { const fa = Math.min(1, (t - pickT) / 0.9); drawBurst(g, x, fy - pr * 1.4, H * 1.2, col, fa); }
    }
    if (picked && t - pickT > 1.0) return finish();
    raf = requestAnimationFrame(draw);
  }
  function choose(cls) {
    if (picked) return;
    const pr = profile.load(); if (!pickStarter(pr, cls)) return; profile.save();
    picked = cls; pickT = t; setHot(STARTERS.indexOf(cls)); views[cls].flourish(cls, t); cards.forEach((c) => c.classList.toggle('dim', c.dataset.cls !== cls));
  }
  function finish() {
    cancelAnimationFrame(raf); removeEventListener('keydown', onKey, true); el.remove();
    const ch = heroFor(store, picked); if (onPicked) onPicked(ch);
  }
  const onKey = (e) => { if (!document.getElementById('starterPick')) return; e.stopPropagation();
    if (e.key === 'ArrowLeft') { e.preventDefault(); setHot(hot - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); setHot(hot + 1); } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(STARTERS[hot]); } };
  addEventListener('keydown', onKey, true);
  void storage;
  raf = requestAnimationFrame(draw);
}
