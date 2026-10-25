// Ninja (bladedancer) VFX (rebuilt): violet shadow, manga speed lines, shadow clones, 印 marks that detonate, katakana SFX,
// kanji pops with a 忍 seal, and the ECLIPSE moment (violet tint, black eclipse disc with a white core burst, 6 clones
// converging, a giant 影, ザンッ, big CRIT numbers). Returns true (handled), 2 (also run the core logic, banners muted)
// or false. Drawing / pooling / textures live in fxns.js.
import { S, rnd, part, petals, glitter, sparks, splatter, smoke, glow, burst, crescent, slashLine, kanjiPop, sfxPop, clone, markPop, ring, ghost,
  eclipseAt, streaks, moment, climax, activeMoment, critText, warm, kanjiTex, hankoTex, sfxTex, titleTex, eclipseTex, warmScreen, cloneTex, markTex, smokeTex, glitTex, burstCoreTex, N } from './fxns.js';
const TAU = Math.PI * 2;
const C = { vio: '#b28cff', pink: '#ff5ad2', hot: '#ff8ae0', pale: '#f5ecff', dark: '#1a0f2e', smoke: '#3c1460' };
const GL = ['#ffffff', '#ff8ae0', '#c9a8ff', '#ff5ad2'];
const SFXF = { fill: ['#ffffff', '#ffb0f0'], stroke: '#140620', glow: 'rgba(255,60,200,.85)' };
const at = (x, y, a, d) => [x + Math.cos(a) * d, y + Math.sin(a) * d];
const fmt = (n) => Math.round(n).toLocaleString('en-US');
let warmed = false;

function ninMoment(fx, me, ev, o) {
  const m = activeMoment(fx); if (m && m.title === o.title && m.t < 0.4) return m; // (the generic + Special 'chain' events of one cast)
  return moment(fx, me, {
    cls: 'nin', pid: ev.pid, x: ev.x, y: ev.y, ang: ev.ang ?? -0.3, colorize: 0.72, colorCol: '#8a5cd0', dim: 0, vig: '#12021e', speed: 1, speedDark: true, speedA: 0.8,
    eclipse: o.eclipse ?? true, eclipseR: o.eclipseR || 150, eox: 40, eoy: -60, bars: true, barCol: C.pink, pal: 'violet',
    title: o.title, sub: o.sub, kanji: o.kanji, seal: o.seal || '忍', sealCol: '#c8142c', kanjiAt: 'screen', kx: 0.24, ky: 0.56, kanjiSize: o.kanjiSize || 0.36,
    kanjiStyle: { ink: '#0a0212', edge: '#ffffff', glow: 'rgba(200,80,255,.9)' }, kanjiA: 0.95, sox: 0.14, soy: 0.24,
    sfx: o.sfx || 'ザンッ', sfxFill: SFXF.fill, sfxStroke: SFXF.stroke, sfxGlow: SFXF.glow, sfxAt: 'screen', sfxX: 0.72, sfxY: 0.74, sfxSize: o.sfxSize || 0.2, sfxRot: -0.14,
    flash: o.flash ?? 0.3, flashCol: '#f5ecff', life: o.life || 1.1, pre: o.pre || 0, tail: o.tail || 0.7,
    onClimax: (mm) => ninClimax(fx, mm, o),
  });
}
/** The Eclipse-style climax around (x,y): clones converge, a white core burst under a black disc, crossing violet slashes. */
function ninClimax(fx, m, o = {}) {
  const x = m.x, y = m.y, big = o.big || 1, n = o.clones ?? 6;
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + 0.3, d = 260 * big; clone(fx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, x + Math.cos(a) * 26, y + Math.sin(a) * 18, { dash: 0.16, hold: 0.02 * i, life: 0.5, size: 64, trail: 4, ang: a + Math.PI }); }
  eclipseAt(fx, x, y - 10, 70 * big, { life: 0.8 });
  burst(fx, x, y, 180 * big, '#ffffff', 0.4, 0.6, 21);
  for (let i = 0; i < 4; i++) slashLine(fx, x, y, -0.6 + i * 0.85 + rnd(-0.1, 0.1), 520 * big, { w: 10, col: i % 2 ? C.vio : C.pink, mid: C.hot, life: 0.45, grow: 0.06 });
  sparks(fx, x, y, 0, 30, '#ffffff', 820, Math.PI); glitter(fx, x, y, 34, 200, GL, { sp: 160 }); smoke(fx, x, y, 12, C.smoke, 90, 220, 0.8);
  if (o.marks !== false && fx.sim && fx.sim.enemies) for (const e of fx.sim.enemies) { if (e.dead || !e.mark || e.mark.pid !== m.pid) continue; if (Math.hypot(e.x - x, e.y - y) > 700) continue; markPop(fx, e.x, e.y - (e.r || 20) - 20, { det: true, life: 0.5, size: 60 }); burst(fx, e.x, e.y, 120, C.pink, 0.3, 0.8, 23); }
  fx.shake(0.7); if (m.pid === fx.localPid) fx.slowmo(0.2, 0.3);
}
function chainPop(fx, me, ev, ch, sfx, name) {
  kanjiPop(fx, ch, ev.x + 64, ev.y - 92, 104, { life: 0.8, seal: '忍', sealCol: '#c8142c', tex: { ink: '#0a0212', edge: '#ffffff', glow: 'rgba(200,80,255,.9)' } });
  if (sfx) sfxPop(fx, sfx, ev.x - 70, ev.y - 40, 64, { life: 0.6, ...SFXF });
  streaks(fx, ev.x - 120, ev.y, 0, 240, 10, C.pale, { life: 0.3, w: 60 }); glitter(fx, ev.x, ev.y - 20, 8, 70, GL);
  if (me) fx.banner(name.toUpperCase() + '!', '#e2c4ff', 'CHAIN COMBO', 1.1, 46);
}
const CHAIN = { shadow_strike: ['刺', 'ズバッ'], marked_for_death: ['印', 'ピキッ'], shadow_step: ['瞬', 'シュン'], shadow_pierce: ['貫', 'ドシュッ'], crimson_flurry: ['紅', 'ザザザッ'], death_blossom: ['華', 'パァン'], shadow_execution: ['刑', 'ザンッ'] };
const FINALE = {
  eviscerate: { title: '★ EVISCERATE', sub: '4-STEP FINALE · TORN APART', kanji: '裂', sfx: 'ズバァッ' },
  smoke_lotus: { title: '★ SMOKE LOTUS', sub: '4-STEP FINALE · A LOTUS OF SHADOW', kanji: '蓮', sfx: 'ドロン' },
  mirror_execution: { title: '★ MIRROR EXECUTION', sub: '4-STEP FINALE · THE CLONES STRIKE AS ONE', kanji: '鏡', sfx: 'ザンッ' },
  clone_barrage: { title: '★ CLONE BARRAGE', sub: '5-STEP FINALE · A HUNDRED SHADOWS', kanji: '分', sfx: 'ズババババッ', big: 1.25, clones: 8 },
  shadow_heartseeker: { title: '★ SHADOW HEARTSEEKER', sub: '5-STEP FINALE · ONE THRUST THROUGH THE HEART', kanji: '心', sfx: 'ドシュッ', big: 1.25 },
};

/** Pre-build every texture the kit uses (called once when the local hero is a Ninja). */
export function ninWarm() {
  if (warmed) return; warmed = true;
  const K = { ink: '#0a0212', edge: '#ffffff', glow: 'rgba(200,80,255,.9)' };
  warm([() => kanjiTex('影', { ink: '#0a0212', edge: '#ffffff', glow: 'rgba(200,80,255,.9)' }), () => hankoTex('忍', '#c8142c'), () => sfxTex('ザンッ', SFXF.fill, SFXF.stroke, SFXF.glow), () => eclipseTex(), () => warmScreen('#12021e', true, true, 0.8), () => warmScreen('#12021e', false), () => cloneTex(false), () => cloneTex(true), () => markTex('#ff5ad2'), () => markTex('#ffffff'), () => smokeTex(C.smoke), () => burstCoreTex('#ffffff'), () => burstCoreTex(C.pink), ...GL.map((c) => () => glitTex(c)),
    ...['影', '忍', '分', '萬', '月', ...Object.values(FINALE).map((f) => f.kanji), ...Object.values(CHAIN).map((c) => c[0])].map((c) => () => kanjiTex(c, K)),
    ...['ザンッ', 'シュン', 'ズバッ', 'ドロン', 'ボンッ', 'シュッ', 'ザッ', 'ザザッ', 'グサッ', 'ドンッ', ...Object.values(FINALE).map((f) => f.sfx), ...Object.values(CHAIN).map((c) => c[1])].map((t) => () => sfxTex(t, SFXF.fill, SFXF.stroke, SFXF.glow)),
    () => titleTex('★ ECLIPSE', 'ULTIMATE · ALL SKILLS FREE · EVERY HIT A BACKSTAB', 'violet'), ...Object.values(FINALE).map((f) => () => titleTex(f.title, f.sub, 'violet'))]);
}
export function ninHandle(fx, ev, me) {
  switch (ev.type) {
    case 'swing': return basic(fx, ev, me);
    case 'skill': return true;
    case 'ult': return true; // (the Eclipse plays from its 'eclipse' event)
    case 'spin': crescent(fx, ev.x, ev.y, ev.r || 80, ev.t * 0.55, { dir: 1, red: true, hi: C.pink, life: 0.2, speed: 0.06, w: 0.5, ink: 0.85 }); return true;
    case 'dmg': {
      if (ev.team !== 'enemy' || ev.eclipse || ev.big) return false;
      if (ev.sharp) { // Ninja crit: a big gradient CRIT number + a white cross-cut on the target
        const big = !!activeMoment(fx);
        critText(fx, ev.x, ev.y - 14, (big ? 'CRIT ' : '') + fmt(ev.amount) + '!', big ? 58 : ev.heavy ? 48 : 40, 'nin');
        if (!fx._ninT || (fx.time || 0) - fx._ninT > 0.05) { fx._ninT = fx.time || 0; const a = rnd(-0.9, -0.5); slashLine(fx, ev.x, ev.y + 10, a, 110, { w: 6, col: C.pink, mid: C.hot, life: 0.2, grow: 0.04 }); glitter(fx, ev.x, ev.y, 3, 24, GL); }
        return true;
      }
      return false;
    }
    case 'chain': {
      if (ev.fin) return true; // routes (ttcStart / crescentStart carry their own moments)
      const F = FINALE[ev.id];
      if (F) { ninMoment(fx, me, ev, { ...F, pre: 0.5, life: 1.15, tail: 0.65 }); return true; }
      const K = CHAIN[ev.id]; if (K) chainPop(fx, me, ev, K[0], K[1], ev.name);
      return true;
    }
    case 'spx': return special(fx, ev, me);
    case 'flicker': { // Q Flicker Step: a clone trail through the group, speed streaks, シュン
      const a = Math.atan2(ev.y - ev.fy, ev.x - ev.fx), d = Math.hypot(ev.x - ev.fx, ev.y - ev.fy);
      clone(fx, ev.fx, ev.fy, ev.x, ev.y, { dash: 0.08, life: 0.32, trail: 4, size: 56 });
      streaks(fx, ev.fx, ev.fy, a, d, 12, C.pale, { life: 0.28, w: 46 });
      smoke(fx, ev.fx, ev.fy, 5, C.smoke, 40, 90, 0.5); glitter(fx, ev.x, ev.y, 5, 40, GL);
      sfxPop(fx, 'シュン', (ev.fx + ev.x) / 2, (ev.fy + ev.y) / 2 - 60, 54, { life: 0.5, ...SFXF });
      fx.shake(0.12); return true;
    }
    case 'mark': markPop(fx, ev.x, ev.y - 6, { size: 30 + Math.min(5, ev.n || 1) * 4, life: 0.55 }); if (ev.n >= 5) ring(fx, ev.x, ev.y + 20, 40, C.pink, { w: 4 }); return true;
    case 'markPop': { // a crit on a Marked enemy detonates the 印
      markPop(fx, ev.x, ev.y - (ev.r || 20) - 10, { det: true, size: 50 + ev.n * 6, life: 0.45 });
      burst(fx, ev.x, ev.y, 150 + ev.n * 16, C.pink, 0.3, 0.85, 24); for (let i = 0; i < 4; i++) slashLine(fx, ev.x, ev.y, i * (TAU / 8) + rnd(0, 0.3), 90 + ev.n * 10, { w: 5, col: C.pink, mid: C.hot, life: 0.22, grow: 0.04 });
      glitter(fx, ev.x, ev.y, 6 + ev.n, 50, GL); fx.shake(0.22);
      fx.text(ev.x, ev.y - 54, ev.n > 1 ? `DETONATE ×${ev.n}!` : 'DETONATE!', { size: 22 + Math.min(10, ev.n * 2), color: C.hot, vy: -45, pop: 2, life: 0.9, stroke: C.dark });
      return true;
    }
    case 'heartseeker': { // E: a lunging thrust - long speed streaks, a white thrust burst, ズバッ
      const [hx, hy] = at(ev.x, ev.y, ev.ang, 46), d = Math.hypot(ev.x - ev.fx, ev.y - ev.fy);
      if (d > 10) { clone(fx, ev.fx, ev.fy, ev.x, ev.y, { dash: 0.07, life: 0.28, trail: 3 }); streaks(fx, ev.fx, ev.fy, ev.ang, d + 40, 10, C.pale, { life: 0.25 }); }
      slashLine(fx, hx, hy, ev.ang, 200, { w: 12, col: C.pink, mid: C.hot, life: 0.26, grow: 0.04, from: 'start' });
      burst(fx, hx + Math.cos(ev.ang) * 30, hy + Math.sin(ev.ang) * 30, 160, '#ffffff', 0.24, 0.8, 25); sparks(fx, hx, hy, ev.ang, 14, '#ffffff', 600, 0.4);
      sfxPop(fx, 'ズバッ', hx + 30, hy - 70, 60, { life: 0.5, ...SFXF }); fx.shake(0.2); if (me) fx.punch(ev.ang, 5); return true;
    }
    case 'vanish': { // R: smoke bomb + ドロン + 忍
      smoke(fx, ev.x, ev.y, 18, C.smoke, 80, 200, 0.9); smoke(fx, ev.x, ev.y, 8, '#8a6ac8', 50, 120, 0.7);
      ring(fx, ev.x, ev.y + 10, 90, C.vio, { w: 8 }); glitter(fx, ev.x, ev.y - 20, 10, 60, GL);
      kanjiPop(fx, '忍', ev.x + 56, ev.y - 84, 76, { life: 0.7, tex: { ink: '#0a0212', edge: '#ffffff', glow: 'rgba(200,80,255,.9)' } });
      sfxPop(fx, 'ドロン', ev.x - 50, ev.y - 50, 58, { life: 0.6, ...SFXF });
      return true;
    }
    case 'unstealth': smoke(fx, ev.x, ev.y, 6, C.smoke, 40, 80, 0.4); return true;
    case 'perfectDodge': ghost(fx, ev.x, ev.y + 30, 0, { a: 0.7, life: 0.4, size: 60 }); ring(fx, ev.x, ev.y + 30, 60, C.hot, { w: 8 }); glitter(fx, ev.x, ev.y, 8, 50, GL); fx.text(ev.x, ev.y - 10, 'PERFECT DODGE!', { size: 24, color: '#ff9ee0', vy: -60, pop: 2, life: 1.0 }); return true;
    case 'cut': { // G Thousand Cuts: blink-cuts between targets - streak + clone + cross slash, ザッ every few cuts
      const a = Math.atan2(ev.ty - ev.y, ev.tx - ev.x), d = Math.hypot(ev.x - ev.fx, ev.y - ev.fy), ma = Math.atan2(ev.y - ev.fy, ev.x - ev.fx);
      clone(fx, ev.fx, ev.fy, ev.x, ev.y, { dash: 0.06, life: 0.24, trail: 3, size: 52 }); if (d > 10) streaks(fx, ev.fx, ev.fy, ma, d, 6, C.pale, { life: 0.2, w: 30 });
      slashLine(fx, ev.tx, ev.ty, a + Math.PI / 2 + rnd(-0.3, 0.3), 120, { w: 7, col: ev.cf ? '#ff2b4e' : C.pink, mid: C.hot, life: 0.22, grow: 0.04 });
      sparks(fx, ev.tx, ev.ty, a, 5, '#ffffff', 420, 0.8); if (ev.cf) petals(fx, ev.tx, ev.ty, 3, 20, 160);
      if ((ev.n | 0) % 3 === 0) sfxPop(fx, ev.cf ? 'ザザッ' : 'ザッ', ev.tx + rnd(-30, 30), ev.ty - 60, 46, { life: 0.4, ...SFXF });
      fx.shake(0.1); return true;
    }
    case 'blossom': fx.text(ev.x, ev.y - 60, `+1 CUT (${ev.n})`, { size: 16 + Math.min(6, ev.n), color: '#ff5fb0', vy: -40, pop: 1.3, life: 0.7 }); ring(fx, ev.x, ev.y, 50 + ev.n * 8, C.hot, { w: 6 }); petals(fx, ev.x, ev.y, 6, 30, 200); return true;
    case 'shadowStep': { // Vanish -> Q: a shadow step
      const a = ev.ang ?? Math.atan2(ev.y - ev.fy, ev.x - ev.fx);
      smoke(fx, ev.fx, ev.fy, 10, C.smoke, 60, 120, 0.6); clone(fx, ev.fx, ev.fy, ev.x, ev.y, { dash: 0.1, life: 0.4, trail: 5 }); streaks(fx, ev.fx, ev.fy, a, Math.hypot(ev.x - ev.fx, ev.y - ev.fy), 12, C.vio, { life: 0.3 });
      return true;
    }
    case 'shadowPierce': { // Vanish -> E: a line pierce
      const d = Math.hypot(ev.x - ev.fx, ev.y - ev.fy);
      clone(fx, ev.fx, ev.fy, ev.x, ev.y, { dash: 0.08, life: 0.36, trail: 5 }); slashLine(fx, ev.fx, ev.fy, ev.ang, d + 60, { w: 14, col: C.vio, mid: C.hot, life: 0.34, from: 'start' });
      streaks(fx, ev.fx, ev.fy, ev.ang, d, 14, C.pale, { life: 0.3, w: 60 }); burst(fx, ev.x, ev.y, 170, C.vio, 0.3, 0.8, 26); fx.shake(0.25); return true;
    }
    case 'shadowPierceKill': if (me) fx.text(ev.x, ev.y - 60, `+${ev.refund} PIPS · HIDDEN`, { size: 16, color: '#ff8ad8', vy: -40, pop: 1.3, life: 0.9 }); smoke(fx, ev.x, ev.y, 8, C.smoke, 50, 100, 0.6); return true;
    case 'shadowExecution': if (ev.n > 0) { fx.text(ev.x, ev.y - 70, `×${ev.n} CLONES`, { size: 18 + Math.min(8, ev.n), color: '#d7b6ff', vy: -40, pop: 1.5, life: 0.9 }); smoke(fx, ev.x, ev.y, 10, C.smoke, 60, 120, 0.5); } return true;
    case 'cloneStab': { const a = Math.atan2(ev.y - ev.fy, ev.x - ev.fx); clone(fx, ev.fx, ev.fy, ev.x, ev.y, { dash: 0.12, hold: 0.04, life: 0.42, trail: 3 }); slashLine(fx, ev.x, ev.y, a + 1.2, 100, { w: 6, col: C.pink, mid: C.hot, life: 0.22, grow: 0.04 }); smoke(fx, ev.fx, ev.fy, 3, C.smoke, 30, 60, 0.4); fx.shake(0.06); return true; }
    case 'decoyHit': smoke(fx, ev.x, ev.y, 5, C.smoke, 40, 80, 0.4); return true;
    case 'backstab': {
      sfxPop(fx, 'グサッ', ev.x + 30, ev.y - 30, 58, { life: 0.55, ...SFXF }); burst(fx, ev.x, ev.y + 30, 160, C.pink, 0.3, 0.8, 27); ring(fx, ev.x, ev.y + 30, 70, C.hot, { w: 8 });
      fx.text(ev.x, ev.y - 10, 'BACKSTAB!', { size: 30, color: '#ff4fa3', vy: -55, pop: 2.4, life: 1.2, stroke: C.dark }); fx.shake(0.3);
      if (me && ev.refund) fx.text(ev.x, ev.y - 50, `+${ev.refund} INITIATIVE`, { size: 16, color: '#ffd6f0', vy: -40, pop: 1.3, life: 0.9 });
      return true;
    }
    case 'eclipse': { // T ULT: the mockup moment, aimed at the nearest enemy
      let tx = ev.x + 160, ty = ev.y - 20, best = 1e9;
      if (fx.sim && fx.sim.enemies) for (const e of fx.sim.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - ev.x, e.y - ev.y); if (d < best && d < 700) { best = d; tx = e.x; ty = e.y; } }
      ninMoment(fx, me, { ...ev, x: tx, y: ty, ang: Math.atan2(ty - ev.y, tx - ev.x) }, { title: '★ ECLIPSE', sub: 'ULTIMATE · ALL SKILLS FREE · EVERY HIT A BACKSTAB', kanji: '影', sfx: 'ザンッ', pre: 0.35, life: 1.2, tail: 0.8, big: 1.15, eclipseR: 175, kanjiSize: 0.42, sfxSize: 0.24 });
      smoke(fx, ev.x, ev.y, 20, C.smoke, 90, 240, 0.8); ring(fx, ev.x, ev.y, 180, C.vio, { w: 12, life: 0.5 });
      if (!me) ninClimax(fx, { x: tx, y: ty, pid: ev.pid }, { big: 0.8 });
      fx.shake(0.45); return true;
    }
    case 'eclipseShade': if (me) smoke(fx, ev.x, ev.y + 20, 4, C.smoke, 40, 80, 0.35); return true;
    case 'eclipseBurst': {
      eclipseAt(fx, ev.x, ev.y - 6, (ev.r || 30) + 20, { life: 0.5 }); burst(fx, ev.x, ev.y, (ev.r || 30) * 4 + 120, '#ffffff', 0.35, 0.8, 28);
      for (let i = 0; i < 4; i++) slashLine(fx, ev.x, ev.y, rnd(0, TAU), 120 + (ev.r || 30) * 2, { w: 7, col: C.pink, mid: C.hot, life: 0.3, grow: 0.05 });
      smoke(fx, ev.x, ev.y, 8, C.smoke, 50, 160, 0.6);
      const under = fx.finAt && fx.finAt.pid === ev.pid && fx.time - fx.finAt.t < 0.3;
      critText(fx, ev.x, under ? ev.y + (ev.r || 30) + 20 : ev.y - (ev.r || 30) - 30, 'ECLIPSE ' + fmt(ev.dmg) + '!', under ? 26 : 50, 'nin');
      fx.shake(0.35); return true;
    }
    case 'eclipseEnd': ring(fx, ev.x, ev.y, 120, C.vio, { w: 10 }); smoke(fx, ev.x, ev.y, 10, C.smoke, 60, 140, 0.6); if (me) fx.text(ev.x, ev.y - 70, 'PIPS FULL', { size: 20, color: '#ff9ee0', vy: -40, pop: 1.5, life: 1.0 }); return true;
    // Eclipse route finishers: the core keeps their timing logic (hanging crescents, the moon); banners muted, moments added
    case 'ttcStart':
      ninMoment(fx, me, ev, { title: '★ TEN THOUSAND CUTS', sub: `ROUTE FINISHER · ×${ev.n} SHADOWS`, kanji: '萬', sfx: 'シュババッ', life: 0.9, eclipse: false, flash: 0 });
      for (const [cx, cy] of ev.clones || []) clone(fx, ev.x, ev.y, cx, cy, { dash: 0.14, life: 0.6, trail: 3 });
      return 2;
    case 'ttcCut': if (ev.k > 0 && ev.k % 4 === 0) streaks(fx, ev.fx, ev.fy, Math.atan2(ev.y - ev.fy, ev.x - ev.fx), Math.hypot(ev.x - ev.fx, ev.y - ev.fy), 5, C.pale, { life: 0.2, w: 24 }); return 2;
    case 'ttcDetonate':
      ninMoment(fx, me, ev, { title: '★ TEN THOUSAND CUTS', sub: `${ev.cuts} CUTS · ${ev.hits} DETONATED`, kanji: '萬', sfx: 'ズババババッ', life: 1.0, big: 1.4, clones: 8, sfxSize: 0.18 });
      if (!me) ninClimax(fx, { x: ev.x, y: ev.y, pid: ev.pid }, { big: 1 });
      return 2;
    case 'crescentStart':
      ninMoment(fx, me, ev, { title: '★ CRESCENT EXECUTION', sub: `${ev.stacks} MARKS · ×${ev.mul} ATK · GUARANTEED CRIT`, kanji: '月', sfx: 'ゴゴゴ', life: 0.85, eclipse: false, flash: 0, marks: false });
      return 2;
    case 'crescentImpact':
      ninMoment(fx, me, ev, { title: '★ CRESCENT EXECUTION', sub: ev.killed ? 'EXECUTED' : `${ev.stacks} MARKS`, kanji: '月', sfx: 'ドンッ', life: 1.0, big: 1.3, eclipseR: 190 });
      if (!me) ninClimax(fx, { x: ev.x, y: ev.y, pid: ev.pid }, { big: 1 });
      return 2;
  }
  return false;
}

// ---- LMB: quick violet cuts with an afterimage; the 5th hit is an X-cut with シュッ
function basic(fx, ev, me) {
  const R = ev.range || 80, a = ev.ang, dir = ev.idx % 2 ? -1 : 1, [hx, hy] = at(ev.x, ev.y, a, R * 0.62);
  if (!ev.heavy) {
    crescent(fx, ev.x, ev.y, R * 0.78, a, { dir, red: true, hi: C.pink, life: 0.26, speed: 0.06, w: 0.45, ink: 0.85 });
    slashLine(fx, hx, hy, a + dir * 1.3 + rnd(-0.2, 0.2), 90, { w: 5, col: C.vio, mid: C.hot, life: 0.18, grow: 0.04 });
    ghost(fx, ev.x - Math.cos(a) * 14, ev.y - Math.sin(a) * 14, a, { a: 0.35, life: 0.2, size: 50 }); glitter(fx, hx, hy, 2, 20, GL);
  } else {
    slashLine(fx, hx, hy, a + 0.8, 170, { w: 10, col: C.pink, mid: C.hot, life: 0.3, grow: 0.05 }); slashLine(fx, hx, hy, a - 0.8, 170, { w: 10, col: C.vio, mid: C.hot, life: 0.3, grow: 0.05 });
    crescent(fx, ev.x, ev.y, R, a, { dir: -1, red: true, hi: C.pink, life: 0.32, speed: 0.07, w: 0.8, ink: 0.9 });
    burst(fx, hx, hy, 140, C.pink, 0.24, 0.8, 29); glitter(fx, hx, hy, 6, 40, GL); sparks(fx, hx, hy, a, 8, '#ffffff', 480, 0.7);
    sfxPop(fx, 'シュッ', hx + 20, hy - 60, 48, { life: 0.45, ...SFXF }); if (me) fx.shake(0.12);
  }
  return true;
}

// ---- F Special: Shadow Clone + the Special chains
function special(fx, ev, me) {
  switch (ev.ph) {
    case 'cast': smoke(fx, ev.x, ev.y, 12, C.smoke, 70, 160, 0.7); return 2;
    case 'impact': { // the clones appear: smoke bombs, ボンッ, 分, a short tint
      const r = ev.r || 90;
      for (const s of [-1, 1]) { const a = (ev.ang || 0) + s * 1.9, [cx, cy] = at(ev.x, ev.y, a, 70); smoke(fx, cx, cy, 10, C.smoke, 60, 140, 0.7); clone(fx, ev.x, ev.y, cx, cy, { dash: 0.1, life: 0.5, trail: 3, size: 60 }); }
      ring(fx, ev.x, ev.y, r + 60, C.vio, { w: 10 }); glitter(fx, ev.x, ev.y, 14, 80, GL);
      kanjiPop(fx, '分', ev.x + 70, ev.y - 100, 110, { life: 0.85, seal: '忍', sealCol: '#c8142c', tex: { ink: '#0a0212', edge: '#ffffff', glow: 'rgba(200,80,255,.9)' } });
      sfxPop(fx, 'ボンッ', ev.x - 70, ev.y - 50, 66, { life: 0.6, ...SFXF });
      moment(fx, me, { cls: 'nin', pid: ev.pid, x: ev.x, y: ev.y, colorize: 0.45, colorCol: '#b9a2e6', vig: '#12021e', life: 0.6, title: '★ SHADOW CLONE', sub: `SPECIAL · ${ev.n || 0} HIT · CLONES COPY YOUR NEXT CHAINS`, pal: 'violet', flash: 0 });
      fx.shake(0.3); return 2;
    }
    case 'echo': { const a = rnd(0, TAU); slashLine(fx, ev.x, ev.y, a, 80 + (ev.r || 24), { w: 6, col: ev.c ? C.pink : C.vio, mid: C.hot, life: 0.2, grow: 0.04 }); slashLine(fx, ev.x, ev.y, a + 1.57, 80 + (ev.r || 24), { w: 6, col: ev.c ? C.pink : C.vio, mid: C.hot, life: 0.2, grow: 0.04 }); return 2; }
    case 'cloneCopy': case 'clonesEnd': if (ev.ph === 'clonesEnd') smoke(fx, ev.x, ev.y, 8, C.smoke, 50, 120, 0.5); return 2;
    case 'chain': { const F = FINALE[ev.id]; if (F) ninMoment(fx, me, ev, { ...F, pre: 0.5, life: 1.15, tail: 0.65 }); return true; }
    case 'hit': {
      const x = ev.x, y = ev.y, a = ev.ang || 0, r = ev.r || 120;
      switch (ev.look) {
        case 'finale': { burst(fx, x, y, r * 2, '#ffffff', 0.4, 0.9, 30); for (let i = 0; i < 6; i++) slashLine(fx, x, y, (i / 6) * Math.PI + rnd(-0.1, 0.1), r * 2.4, { w: 10, col: i % 2 ? C.vio : C.pink, mid: C.hot, life: 0.4 }); glitter(fx, x, y, 24, r, GL); smoke(fx, x, y, 12, C.smoke, 80, 200, 0.7); climax(fx, ev.pid, x, y, a); if (me) fx.shake(0.8); return true; }
        case 'thrust': { const L = ev.len || 300; slashLine(fx, x, y, a, L, { w: 14, col: C.pink, mid: C.hot, life: 0.3, from: 'start' }); streaks(fx, x, y, a, L, 10, C.pale, { life: 0.25 }); burst(fx, ...at(x, y, a, L), 160, '#ffffff', 0.25, 0.8, 31); break; }
        case 'slash': { const [cx, cy] = at(x, y, a + Math.PI, 140); clone(fx, cx + rnd(-60, 60), cy + rnd(-60, 60), x, y, { dash: 0.08, life: 0.3, trail: 3 }); slashLine(fx, x, y, a + 1.2 + rnd(-0.4, 0.4), r * 1.6, { w: 8, col: C.vio, mid: C.hot, life: 0.25, grow: 0.04 }); break; }
        case 'lotus': { for (let i = 0; i < 8; i++) { const an = (i / 8) * TAU + (ev.i || 0) * 0.2; crescent(fx, x + Math.cos(an) * r * 0.4, y + Math.sin(an) * r * 0.3, r * 0.45, an, { dir: 1, red: true, hi: C.pink, life: 0.4, w: 0.5, ink: 0.8 }); } smoke(fx, x, y, 10, C.smoke, 70, 160, 0.7); break; }
        case 'x': { slashLine(fx, x, y, 0.75, r * 2.2, { w: 12, col: C.pink, mid: C.hot, life: 0.32 }); slashLine(fx, x, y, -0.75, r * 2.2, { w: 12, col: C.vio, mid: C.hot, life: 0.32 }); burst(fx, x, y, r * 1.5, C.pink, 0.3, 0.8, 32); for (let i = 0; i < 2; i++) clone(fx, x + (i ? 1 : -1) * 150, y - 40, x, y, { dash: 0.1, life: 0.3, trail: 3, pale: true }); break; }
        default: { burst(fx, x, y, r * 1.4, C.vio, 0.3, 0.8, 33); slashLine(fx, x, y, a + 1.3, r * 1.6, { w: 8, col: C.pink, mid: C.hot, life: 0.25 }); }
      }
      if (ev.n) { sparks(fx, x, y, a, 8, '#ffffff', 500, 0.9); glitter(fx, x, y, 4, 40, GL); }
      if (FINALE[ev.id] && ev.last) climax(fx, ev.pid, x, y, a);
      if (ev.n && ev.last) sfxPop(fx, 'ザンッ', x + 40, y - 70, 58, { life: 0.5, ...SFXF });
      fx.shake(ev.n ? 0.14 : 0.05); return true;
    }
    case 'pop': markPop(fx, ev.x, ev.y - (ev.r || 30) - 10, { det: true, size: 70, life: 0.45 }); burst(fx, ev.x, ev.y, 150, C.pink, 0.3, 0.8, 34); fx.text(ev.x, ev.y + (ev.r || 30) + 50, `×${ev.n} ${String(ev.kind || '').toUpperCase()} BURST`, { size: 18, color: C.hot, life: 0.9, vy: -30 }); return true;
  }
  return 2;
}
void S; void part; void splatter; void sfxTex; void critText;
