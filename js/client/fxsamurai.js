// Samurai VFX (rebuilt): black sumi-ink brush crescents, one blazing red slash line, a white-hot flash, sakura petals and
// glitter, kanji pops with red hanko seals, and grayscale TIME-STOP moments for the ult, Moment of Death, both route
// finishers and every 4- / 5-step finale. Hooks the sim's 'swing' (cls samurai), 'sam' / 'samx', 'spx' (cls samurai),
// 'chain', 'ult', 'skill' and big 'dmg' events. Drawing / pooling / textures live in fxns.js.
import { S, rnd, part, item, petals, glitter, sparks, splatter, glow, burst, crescent, stroke, slashLine, kanjiPop, ring, ghost,
  moment, climax, activeMoment, critText, warm, kanjiTex, hankoTex, petalTex, glitTex, burstCoreTex, glowTex, washTex, warmScreen, titleTex, samGhostTex, N } from './fxns.js';
const TAU = Math.PI * 2;
const C = { ink: '#0c070e', red: '#ff2b4e', pink: '#ff8fb0', petal: '#ffc2e0', hi: '#fff3fa', silver: '#dfe8ff', moon: '#bcd4ff', gold: '#ffe7a8' };
const GL = ['#ffffff', '#ff9cc6', '#ffd0e0', '#ff4d6d'];
const at = (x, y, ang, d) => [x + Math.cos(ang) * d, y + Math.sin(ang) * d];
let warmed = false;

/** The grayscale time-stop moment (the "Moment of Death" mockup): kanji + seal by the target, ink crescents, the red line. */
function samMoment(fx, me, ev, o) {
  const cur = activeMoment(fx); if (cur && cur.title === o.title && cur.t < 0.4) return cur; // (the generic + Special 'chain' events of one cast)
  return moment(fx, me, {
    cls: 'sam', pid: ev.pid, x: ev.x, y: ev.y, ang: ev.ang || 0, gray: 1, dim: o.dim ?? 0, wash: o.wash ?? 0.5, vig: '#000000', pal: o.pal || 'gold',
    title: o.title, sub: o.sub, kanji: o.kanji, seal: o.seal, sealCol: o.sealCol || '#c8142c', kanjiAt: 'focus', kanjiSize: o.kanjiSize || 0.34, kox: 0.3, koy: -0.17, sox: 0.09, soy: 0.16,
    kanjiStyle: { ink: '#0c070e' }, kanjiA: 0.9, screenPetals: o.screenPetals ?? 26, flash: o.flash ?? 0.32, life: o.life || 1.1, pre: o.pre || 0, tail: o.tail || 0.7,
    onClimax: (m) => samClimax(fx, m, o),
  });
}
/** The climax burst: two giant ink crescents around the target, one red slash line across the screen, a white-hot burst. */
function samClimax(fx, m, o = {}) {
  const x = m.x, y = m.y, big = o.big || 1;
  // ONE blazing red/pink slash across the whole screen, always a readable diagonal rising toward the aim side (the mockup's cut)
  const a = Math.cos(m.ang || 0) >= 0 ? -0.4 : Math.PI + 0.4;
  crescent(fx, x, y, 170 * big, a - 1.2, { dir: 1, red: false, life: 0.9, speed: 0.12, w: 1.3, v: 0 });
  crescent(fx, x + 20, y - 10, 205 * big, a + 2.1, { dir: -1, red: false, life: 0.85, speed: 0.14, w: 1.1, v: 1 });
  slashLine(fx, x, y, a, 3000, { w: o.lineW || 24, col: o.lineCol || C.red, mid: o.lineMid || '#ff9cbc', life: 0.8, grow: 0.07 });
  // the white-hot burst at the cut
  burst(fx, x, y, 210 * big, '#ffffff', 0.42, 0.9, 3); glow(fx, x, y, 150 * big, '#ffd0dc', 0.4, 0.55);
  sparks(fx, x, y, a, 14, '#ffffff', 760, 0.35); sparks(fx, x, y, a + Math.PI, 14, C.red, 760, 0.35);
  splatter(fx, x, y, 18, 120, C.ink, { sp: 520 }); petals(fx, x, y, 26 * big, 120, 460); glitter(fx, x, y - 30, 14, 260, GL, { sp: 140 });
  fx.shake(0.75); if (m.pid === fx.localPid) fx.slowmo(0.22, 0.3);
}
/** Small-chain flourish: a kanji pop by the hero with a seal, an ensō, petals; the chain banner. */
function chainPop(fx, me, ev, ch, name, seal) {
  const x = ev.x, y = ev.y;
  kanjiPop(fx, ch, x + 70, y - 90, 110, { life: 0.85, seal, sealCol: '#c8142c', rot: -0.08 });
  ring(fx, x, y + 6, 120, C.silver, { enso: true, life: 0.55 }); petals(fx, x, y, 14, 40, 240); glitter(fx, x, y - 20, 10, 80, GL);
  if (me) fx.banner(name.toUpperCase() + '!', '#ffc2e0', 'CHAIN COMBO', 1.1, 46);
}
const CHAIN = { // chain id -> small flourish kanji + seal
  wind_step: ['風', '疾'], blossom_burst: ['花', '咲'], counter_sheathe: ['返', '倍'], moonlit_guard: ['月', '守'], petal_rain: ['雨', '散'], twin_moons: ['双', '月'],
};
const FINALE = { // 4- / 5-step finales: screen-filling time-stop moments
  riposte_wave: { title: '★ RIPOSTE WAVE', sub: '4-STEP FINALE · A CRESCENT OF MOONLIGHT', kanji: '波', seal: '返' },
  void_echo: { title: '★ VOID ECHO', sub: '4-STEP FINALE · THE VOID CUTS TWICE', kanji: '響', seal: '虚' },
  stillwater_execution: { title: '★ STILLWATER EXECUTION', sub: '4-STEP FINALE · ONE PERFECT CUT', kanji: '静', seal: '死' },
  crescent_void: { title: '★ CRESCENT VOID', sub: '5-STEP FINALE · A FULL-MOON VOID SLASH', kanji: '月', seal: '虚', big: 1.15 },
  void_sheath: { title: '★ VOID SHEATH', sub: '5-STEP FINALE · THE BLADE CLICKS HOME', kanji: '納', seal: '斬', big: 1.15 },
};

/** Pre-build every texture the kit uses (called once when the local hero is a Samurai). */
export function samWarm() {
  if (warmed) return; warmed = true;
  const K = { ink: '#0c070e' };
  warm([() => kanjiTex('斬', { ink: '#0c070e' }), () => kanjiTex('虚', { ink: '#0c070e' }), () => hankoTex('死', '#c8142c'), () => hankoTex('刀', '#c8142c'), () => burstCoreTex('#ff5a7a'), () => burstCoreTex('#ffffff'), () => burstCoreTex('#9fb8ff'), () => glowTex('#ffd0dc'), () => washTex(), () => warmScreen('#000000', false), () => samGhostTex(), ...['#ff9cc6', '#ffc2e0', '#ff6fa8', '#ffe4f0'].map((c) => () => petalTex(c)), ...GL.map((c) => () => glitTex(c)),
    ...['斬', '虚', '極', '散', '閃', '桜', '断', '弾', '返', '納', '風', '花', '月', '雨', '双', ...Object.values(FINALE).map((f) => f.kanji)].map((c) => () => kanjiTex(c, K)),
    ...['死', '刀', '一', '千', '虚', '斬', '返', '疾', '咲', '倍', '守', '散', '月'].map((c) => () => hankoTex(c, '#c8142c')),
    () => titleTex('★ MOMENT OF DEATH', 'TIME STOPS · ONE PERFECT CUT', 'gold'), () => titleTex('★ BLADE OF THE VOID', 'TIME STOPS · FREE SHEATHES · FOCUS ×2 · 10 s', 'gold'),
    () => titleTex('★ IAIJUTSU · VOID DRAW', 'ONE CUT ACROSS THE WHOLE SCREEN', 'gold'), ...Object.values(FINALE).map((f) => () => titleTex(f.title, f.sub, 'gold'))]);
}
export function samHandle(fx, ev, me) {
  switch (ev.type) {
    case 'swing': return basic(fx, ev, me);
    case 'skill': return true; // (the cast looks are on the skill's own events)
    case 'ult': return true; // (Blade of the Void plays from its 'sam' cast)
    case 'dmg': {
      if (ev.team !== 'enemy') return false;
      if (ev.big) { critText(fx, ev.x, ev.y - 40, ev.amount.toLocaleString('en-US') + '!!', 86, 'sam'); return true; } // Moment of Death / One Perfect Cut
      if (ev.crit && activeMoment(fx)) { critText(fx, ev.x, ev.y - 16, 'CRIT ' + ev.amount.toLocaleString('en-US'), ev.heavy ? 48 : 40, 'sam'); return true; }
      return false;
    }
    case 'chain': {
      if (ev.fin) return true; // routes: the 'sam' fin event
      const F = FINALE[ev.id];
      if (F) { samMoment(fx, me, ev, { ...F, pre: 0.5, life: 1.15, tail: 0.65, big: F.big }); if (!me) { petals(fx, ev.x, ev.y, 16, 40, 260); ring(fx, ev.x, ev.y, 160, C.silver, { enso: true }); } return true; }
      if (ev.id === 'moment_of_death') { // the mockup: time stops, 斬 + 死, ONE perfect cut
        samMoment(fx, me, ev, { title: '★ MOMENT OF DEATH', sub: 'TIME STOPS · ONE PERFECT CUT', kanji: '斬', seal: '死', pre: 0.55, life: 1.2, tail: 0.7 });
        return true;
      }
      const K = CHAIN[ev.id]; if (K) chainPop(fx, me, ev, K[0], ev.name, K[1]);
      return true;
    }
    case 'spx': return special(fx, ev, me);
    case 'sam': case 'samx': return samEv(fx, ev, me);
  }
  return false;
}

// ---- LMB: Draw Cut / Return Cut (ink crescents with a red hairline), Rising Moon (a big crescent + 斬)
function basic(fx, ev, me) {
  const R = ev.range || 96, dir = ev.idx === 1 ? -1 : 1, a = ev.ang;
  if (!ev.heavy) {
    crescent(fx, ev.x, ev.y, R * 0.82, a, { dir, red: true, life: 0.36, speed: 0.085, w: 0.6 });
    const [hx, hy] = at(ev.x, ev.y, a, R * 0.7); petals(fx, hx, hy, 4, 20, 150); splatter(fx, hx, hy, 6, 30, C.ink, { sp: 260, size: 0.8 }); glitter(fx, hx, hy, 3, 30, GL);
  } else {
    crescent(fx, ev.x, ev.y, R * 1.05, a, { dir: -1, red: true, life: 0.46, speed: 0.1, w: 1.1 });
    crescent(fx, ev.x, ev.y, R * 0.72, a + 0.2, { dir: 1, life: 0.38, speed: 0.1, w: 0.6, v: 2 });
    const [hx, hy] = at(ev.x, ev.y, a, R * 0.8);
    slashLine(fx, hx, hy, a - 0.6, 210, { w: 8, life: 0.36, grow: 0.05 });
    burst(fx, hx, hy, 130, '#ff5a7a', 0.26, 0.7, 2); petals(fx, hx, hy, 10, 30, 240); splatter(fx, hx, hy, 12, 40);
    kanjiPop(fx, '斬', hx + 40, hy - 60, 62, { life: 0.55 });
    if (me) fx.shake(0.14);
  }
  return true;
}

// ---- F Special: Iaijutsu Void Draw (charge greys the screen, then a screen-length cut) + the Special chains' looks
function special(fx, ev, me) {
  switch (ev.ph) {
    case 'chain': { const F = FINALE[ev.id]; if (F) samMoment(fx, me, ev, { ...F, pre: 0.5, life: 1.15, tail: 0.65, big: F.big }); return true; }
    case 'cast':
      if (ev.id === 'void_draw') {
        moment(fx, me, { cls: 'sam', pid: ev.pid, x: ev.x, y: ev.y, ang: ev.ang, gray: 0.85, dim: 0, wash: 0, pre: (ev.charge || 40) / 60, life: (ev.charge || 40) / 60 + 0.7, tail: 0.6, flash: 0.3,
          title: '★ IAIJUTSU · VOID DRAW', sub: 'ONE CUT ACROSS THE WHOLE SCREEN', kanji: '閃', seal: '一', sealCol: '#c8142c', kanjiAt: 'focus', kanjiSize: 0.3, kox: 0.25, koy: -0.2, kanjiStyle: { ink: '#0c070e' }, screenPetals: 14 });
        ring(fx, ev.x, ev.y, 110, C.silver, { enso: true, life: (ev.charge || 40) / 60 });
        for (let i = 0; i < N(fx, 18); i++) { const a = rnd(0, TAU), d = rnd(90, 160); part(fx, { tex: petalTex('#ffc2e0'), x: ev.x + Math.cos(a) * d, y: ev.y + Math.sin(a) * d, vx: -Math.cos(a) * d * 1.4, vy: -Math.sin(a) * d * 1.4, drag: 1, s: rnd(8, 12), s1: 0.3, life: 0.6, rot: a, vr: 4 }); }
      }
      return true;
    case 'impact':
      if (ev.id === 'void_draw') {
        const L = ev.len || 900;
        stroke(fx, ev.x, ev.y - 6, ev.ang, L, (ev.w || 120) * 0.62, { life: 0.8, speed: 0.08 });
        slashLine(fx, ev.x, ev.y, ev.ang, L + 140, { w: 22, life: 0.75, grow: 0.07, from: 'start' });
        for (let d = 60; d < L; d += 90) { const [x, y] = at(ev.x, ev.y, ev.ang, d); petals(fx, x, y, 3, 20, 200); if (d % 180 < 90) glitter(fx, x, y, 3, 40, GL); }
        const [mx, my] = at(ev.x, ev.y, ev.ang, Math.min(L * 0.5, 360)); burst(fx, mx, my, 280, '#ff5a7a', 0.4, 0.8, 4); splatter(fx, mx, my, 24, 200, C.ink, { sp: 480 });
        climax(fx, ev.pid, mx, my, ev.ang);
        if (me) { fx.shake(0.8); fx.slowmo(0.18, 0.25); }
        fx.text(mx, my + 60, ev.still ? 'VOID DRAW · STILL' : 'VOID DRAW', { size: 26, color: C.hi, life: 1.1, vy: -20, pop: 2 });
      }
      return true;
    case 'hit': {
      const x = ev.x, y = ev.y, a = ev.ang || 0, r = ev.r || 140;
      if (ev.look === 'finale') { // 5-step finale: an ensō + three radiating crescents + the burst (the moment adds the screen)
        ring(fx, x, y, r * 1.1, C.ink, { enso: true, life: 0.7 }); for (let i = 0; i < 3; i++) crescent(fx, x, y, r * (0.7 + i * 0.15), a + i * 2.1, { dir: i % 2 ? -1 : 1, red: i === 1, life: 0.6, speed: 0.1, w: 1.2 });
        burst(fx, x, y, r * 1.8, '#ff5a7a', 0.45, 0.85, 5); petals(fx, x, y, 40, r * 0.5, 420); glitter(fx, x, y, 24, r, GL); splatter(fx, x, y, 26, r * 0.6);
        climax(fx, ev.pid, x, y, a); if (me) fx.shake(0.8); return true;
      }
      if (ev.look === 'void') { stroke(fx, x, y, a, ev.len || 480, (ev.w || 100) * 0.55, { red: true, life: 0.55 }); slashLine(fx, x, y, a, (ev.len || 480) + 100, { w: 12, life: 0.5, from: 'start' }); for (let i = 1; i <= 3; i++) { const [gx, gy] = at(x, y, a, (ev.len || 480) * i / 4); ghost(fx, gx, gy, a, { sam: true, a: 0.2 + i * 0.1 }); } petals(fx, ...at(x, y, a, (ev.len || 480) * 0.6), 12, 60, 260); }
      else if (ev.look === 'crescent') { crescent(fx, x, y, r * 0.95, a, { dir: ev.i % 2 ? -1 : 1, red: true, life: 0.5, w: 1.3 }); petals(fx, ...at(x, y, a, r * 0.7), 10, 50, 240); }
      else if (ev.look === 'x') { stroke(fx, x - 90, y - 70, 0.66, 230, 40, { red: true, life: 0.45 }); stroke(fx, x + 90, y - 70, Math.PI - 0.66, 230, 32, { red: true, life: 0.45 }); burst(fx, x, y, 200, '#ff5a7a', 0.35, 0.8, 6); petals(fx, x, y, 14, 40, 280); }
      else { crescent(fx, x, y, r, a, { red: true }); }
      if (ev.n) { glitter(fx, x, y, 8, 60, GL); sparks(fx, x, y, a, 10, '#ffffff', 520, 0.8); }
      if (FINALE[ev.id] && ev.last) climax(fx, ev.pid, x, y, a);
      if (me && ev.n) fx.shake(0.3);
      return true;
    }
    case 'pop': burst(fx, ev.x, ev.y, 140, '#ff5a7a', 0.3, 0.7, 7); fx.text(ev.x, ev.y + (ev.r || 30) + 50, `×${ev.n} CUTS BURST`, { size: 18, color: C.petal, life: 0.9, vy: -30 }); return true;
  }
  return true;
}

// ---- 'sam' / 'samx'
function samEv(fx, ev, me) {
  const ph = ev.ph;
  if (ph === 'cast') {
    if (ev.id === 'void_blade') { // ULT: Blade of the Void - the full grayscale time-stop (虚 + 刀), then the void-black draw
      samMoment(fx, me, ev, { title: '★ BLADE OF THE VOID', sub: 'TIME STOPS · FREE SHEATHES · FOCUS ×2 · 10 s', kanji: '虚', seal: '刀', pre: 0.4, life: 1.15, tail: 0.75, big: 1.1 });
      ring(fx, ev.x, ev.y, 190, C.ink, { enso: true, life: 0.8 }); petals(fx, ev.x, ev.y, 24, 80, 340); if (me) fx.shake(0.35);
    } else { glow(fx, ev.x + Math.cos(ev.ang) * 20, ev.y + Math.sin(ev.ang) * 20, ev.chain ? 90 : 50, C.pink, 0.22, 0.5); if (ev.chain) petals(fx, ev.x, ev.y, 5, 20, 120); }
    if (ev.fm && me) fx.text(ev.x, ev.y - 96, `FOCUS ×${ev.fm}`, { size: 22, color: C.gold, pop: 2, life: 0.9, vy: -30 });
    return true;
  }
  if (ph === 'fin') { // route finishers
    if (ev.route === 'boss') { // One Perfect Cut: the screen goes black first (the moment itself starts on the white line)
      moment(fx, me, { cls: 'sam', pid: ev.pid, x: ev.x, y: ev.y, ang: ev.ang, gray: 1, dim: 0.86, dimCol: '#020104', life: 0.75, title: '★ ONE PERFECT CUT', sub: `ROUTE FINISHER · FOCUS ×${ev.fm || 1}`, pal: 'gold' });
      ghost(fx, ev.x, ev.y, ev.ang, { sam: true, a: 0.8, life: 0.8 });
    } else { // Thousand Petal Storm: the opening (the burst gets its own moment)
      moment(fx, me, { cls: 'sam', pid: ev.pid, x: ev.x, y: ev.y, ang: ev.ang, colorize: 1, colorCol: '#c4a3b1', wash: 0.3, life: 0.9, kanji: '桜', seal: '千', kanjiAt: 'screen', kx: 0.2, ky: 0.5, kanjiSize: 0.5, kanjiStyle: { ink: '#0c070e' }, screenPetals: 50, title: '★ THOUSAND PETAL STORM', sub: `ROUTE FINISHER · FOCUS ×${ev.fm || 1}`, pal: 'gold', flash: 0 });
      petals(fx, ev.x, ev.y, 60, 200, 420); ring(fx, ev.x, ev.y, 300, C.ink, { enso: true, life: 0.7 });
    }
    if (me) fx.shake(0.3);
    return true;
  }
  if (ph === 'hit') return samHit(fx, ev, me);
  switch (ph) {
    case 'focus': if (me) fx.text(ev.x, ev.y, `+${ev.n} Focus`, { size: ev.why === 'parry' ? 22 : 15, color: C.gold, life: 0.8, vy: -40 }); return true;
    case 'parry': { // PERFECT PARRY: blades clash - white star, the counter kanji 弾
      const x = ev.tx ?? ev.x, y = ev.ty ?? ev.y;
      burst(fx, x, y, 240, ev.moon ? '#9fb8ff' : '#ff8fb0', 0.3, 0.9, 8); sparks(fx, x, y, ev.ang + Math.PI, 26, '#ffffff', 640, 1.3); glitter(fx, x, y, 10, 60, ['#ffffff', C.moon, '#ff9cc6']);
      ring(fx, x, y, 120, ev.moon ? C.moon : C.silver, { w: 8 });
      kanjiPop(fx, ev.moon ? '月' : '弾', x + 40, y - 80, 96, { life: 0.7, seal: '返' });
      fx.text(ev.x, ev.y - 92, ev.moon ? 'MOONLIT GUARD!' : 'PARRY!', { size: me ? 34 : 24, color: '#ffffff', pop: 2.6, life: 1, stroke: C.ink });
      if (me) { fx.slowmo(0.16, 0.25); fx.punch(ev.ang + Math.PI, 6); } fx.shake(0.3);
      return true;
    }
    case 'burst': { // Delayed Cuts burst: the marks slash open - crossing ink strokes with red edges
      const n = ev.n || 1, r = (ev.r || 20) + 14, col = ev.dbl ? '#ffd23f' : C.red;
      const m = Math.min(3, 1 + Math.floor(n / 3));
      for (let i = 0; i < m; i++) { const a = -0.7 + i * 1.1 + rnd(-0.2, 0.2); stroke(fx, ev.x - Math.cos(a) * r * 1.6, ev.y - 6 - Math.sin(a) * r * 1.6, a, r * 3.2, 14 + n, { red: true, hi: col, life: 0.4, speed: 0.06 }); }
      burst(fx, ev.x, ev.y, 90 + n * 10, ev.dbl ? '#ffd23f' : '#ff5a7a', 0.26, 0.7, 9); petals(fx, ev.x, ev.y, 3 + Math.min(8, n), r, 200); splatter(fx, ev.x, ev.y, 4 + n, r);
      fx.text(ev.x, ev.y - r - 34, `${n} CUT${n > 1 ? 'S' : ''}${ev.dbl ? ' ×2' : ''}`, { size: 16 + Math.min(14, n * 1.2), color: ev.dbl ? C.gold : C.petal, pop: 1.8, life: 0.9, vx: 0, stroke: C.ink });
      fx.shake(0.05 + Math.min(0.2, n * 0.02)); return true;
    }
    case 'bloom': ring(fx, ev.x, ev.y, ev.r, C.petal, { w: 5 }); petals(fx, ev.x, ev.y, 6, ev.r * 0.5, 160); return true;
    case 'sheathed': if (ev.n > 0) { fx.text(ev.x, ev.y - 104, `${ev.bl ? 'BLOSSOM · ' : ''}${ev.n} CUTS BURST${ev.dbl ? ' ×2' : ''}`, { size: me ? 22 : 16, color: ev.dbl ? C.gold : C.petal, pop: 1.8, life: 1, vy: -30, stroke: C.ink }); if (me) fx.slowmo(0.08, 0.4); } return true;
    case 'death': { // Moment of Death lands: the climax (the moment draws the screen; others see the world-space burst)
      const m = climax(fx, ev.pid, ev.x, ev.y, ev.ang);
      if (!m) samClimax(fx, { x: ev.x, y: ev.y, ang: ev.ang, pid: ev.pid }, { big: 0.8 });
      fx.text(ev.x, ev.y + 90, `MOMENT OF DEATH · ${ev.n} CUT${ev.n === 1 ? '' : 'S'} · ×${ev.mul}`, { size: 22, color: '#ffffff', vy: -26, pop: 1.6, life: 1.5, vx: 0, stroke: C.ink });
      return true;
    }
    case 'split': { // One Perfect Cut: the boss splits along the white line
      const m = climax(fx, ev.pid, ev.x, ev.y, ev.ang);
      if (!m) samClimax(fx, { x: ev.x, y: ev.y, ang: ev.ang, pid: ev.pid }, { big: 1 });
      for (let i = 0; i < 3; i++) ring(fx, ev.x, ev.y, 180 + i * 100, i % 2 ? C.pink : '#ffffff', { w: 12 - i * 3, life: 0.5 + i * 0.12 });
      fx.text(ev.x, ev.y + (ev.r || 30) + 80, `ONE PERFECT CUT · ${ev.n} CUT${ev.n === 1 ? '' : 'S'} · ×${ev.mul}`, { size: me ? 28 : 22, color: '#ffffff', pop: 2.4, life: 1.8, vx: 0, vy: -20, stroke: C.ink });
      return true;
    }
    case 'stormburst': { // Thousand Petal Storm: one click, every cut bursts
      samMoment(fx, me, ev, { title: '★ THOUSAND PETALS', sub: `${ev.n} CUTS BURST AT ONCE`, kanji: '散', seal: '千', life: 1.0, screenPetals: 60, big: 1.4 });
      if (!me) samClimax(fx, { x: ev.x, y: ev.y, ang: -0.4, pid: ev.pid }, { big: 1.2 });
      for (let i = 0; i < 4; i++) ring(fx, ev.x, ev.y, 220 + i * 130, i % 2 ? C.pink : C.ink, { enso: i % 2 === 0, w: 10, life: 0.5 + i * 0.12 });
      petals(fx, ev.x, ev.y, 80, 480, 520);
      fx.text(ev.x, ev.y + 100, `THOUSAND PETALS · ${ev.n} CUTS`, { size: me ? 32 : 24, color: C.petal, pop: 2.6, life: 1.6, vx: 0, vy: -20, stroke: C.ink });
      return true;
    }
  }
  return true;
}

function samHit(fx, ev, me) {
  const n = ev.n || 0, R = ev.r || 120, emp = ev.emp ? 1.2 : 1, L = ev.len || 200, a = ev.ang || 0;
  const ex = ev.x + Math.cos(a) * L, ey = ev.y + Math.sin(a) * L;
  switch (ev.fx) {
    case 'iaido': case 'wind': case 'wind2': { // Q quick-draw: one ink stroke down the line, a red hairline, grey afterimages
      const w = (ev.lw || 70) * 0.62 * emp, moon = ev.fx !== 'iaido';
      stroke(fx, ev.x, ev.y, a, L + 40, w, { red: true, hi: moon ? '#9fb8ff' : C.red, life: 0.5, speed: 0.07 });
      slashLine(fx, ev.x, ev.y, a, L + 120, { w: 7, col: moon ? '#7f9cff' : C.red, mid: moon ? C.moon : C.pink, life: 0.38, grow: 0.06, from: 'start' });
      for (let i = 1; i <= 3; i++) { const [gx, gy] = at(ev.x, ev.y, a, L * i / 4); ghost(fx, gx, gy, a, { sam: true, a: 0.15 + i * 0.1, life: 0.22 + i * 0.05 }); }
      for (let d = 30; d < L; d += 55) { const [x, y] = at(ev.x, ev.y, a, d); petals(fx, x, y, 1, 14, 90); }
      if (n) { const [hx, hy] = at(ev.x, ev.y, a, L * 0.7); burst(fx, hx, hy, 150, moon ? '#9fb8ff' : '#ff5a7a', 0.25, 0.7, 10); glitter(fx, hx, hy, 6, 50, GL); splatter(fx, hx, hy, 8, 40); }
      if (ev.fx === 'wind2') kanjiPop(fx, '風', ex, ey - 70, 80, { life: 0.6 });
      fx.shake(n ? 0.16 : 0.08); if (n && me) fx.punch(a, 4); return true;
    }
    case 'kesa': { // G Kesa Slash: a diagonal shoulder-to-hip brush cut, a wide crescent, a 断 pop
      const arc = Math.min(ev.arc || 2, TAU), d = a + 0.5;
      crescent(fx, ev.x, ev.y, R * 0.92, a, { dir: -1, red: true, life: 0.46, speed: 0.1, w: 1.2 * emp });
      const x1 = ev.x + Math.cos(d - 1.2) * R, y1 = ev.y + Math.sin(d - 1.2) * R, x2 = ev.x + Math.cos(d + 0.6) * R * 0.4, y2 = ev.y + Math.sin(d + 0.6) * R * 0.4, la = Math.atan2(y2 - y1, x2 - x1);
      stroke(fx, x1, y1, la, Math.hypot(x2 - x1, y2 - y1) + 80, 34 * emp, { red: true, life: 0.5, speed: 0.08 });
      const [ix, iy] = at(ev.x, ev.y, a, R * 0.6); petals(fx, ix, iy, 10, 50, 240); splatter(fx, ix, iy, 10, 50);
      if (n) { burst(fx, ix, iy, 170, '#ff5a7a', 0.28, 0.75, 11); glitter(fx, ix, iy, 8, 60, GL); sparks(fx, ix, iy, la, 12, '#ffffff', 560, 0.7); }
      kanjiPop(fx, '断', ix + 50, iy - 70, 72, { life: 0.55 }); void arc;
      fx.shake(n ? 0.2 : 0.1); if (n && me) fx.punch(la, 5); return true;
    }
    case 'crescent': case 'drawcut': case 'mooncrescent': { // E whiff / Blossom draw / Moonlit Guard whiff: wide ink crescents
      const moon = ev.fx === 'mooncrescent', arc = Math.min(ev.arc || 2.4, TAU);
      crescent(fx, ev.x, ev.y, R * 0.9, a, { dir: 1, red: true, hi: moon ? '#9fb8ff' : C.red, life: 0.44, w: 1.1 * emp });
      crescent(fx, ev.x, ev.y, R * 0.6, a, { dir: -1, life: 0.36, w: 0.5, v: 2 });
      const [ix, iy] = at(ev.x, ev.y, a, R * 0.7); petals(fx, ix, iy, 6, 50, 180); if (moon) { ring(fx, ev.x, ev.y, R, C.moon, { w: 5 }); glitter(fx, ix, iy, 8, 70, ['#ffffff', C.moon]); }
      if (n) sparks(fx, ix, iy, a, 10, '#ffffff', 460); fx.shake(0.12 + (n ? 0.06 : 0)); void arc; return true;
    }
    case 'counter': case 'mooncounter': { // the counter-slash after a perfect parry
      const moon = ev.fx === 'mooncounter';
      crescent(fx, ev.x, ev.y, R, a, { dir: 1, red: true, hi: moon ? '#9fb8ff' : C.red, life: 0.5, w: 1.4, speed: 0.08 });
      crescent(fx, ev.x, ev.y, R * 0.7, a + 0.3, { dir: -1, life: 0.42, w: 0.8, v: 1 });
      const [ix, iy] = at(ev.x, ev.y, a, R * 0.7); slashLine(fx, ix, iy, a - 1.2, 320, { w: 10, life: 0.4 });
      burst(fx, ix, iy, 230, moon ? '#9fb8ff' : '#ff5a7a', 0.34, 0.85, 12); glitter(fx, ix, iy, 14, 90, GL); petals(fx, ix, iy, 14, 50, 320); splatter(fx, ix, iy, 14, 60);
      if (me) fx.punch(a, 8); fx.shake(0.35); return true;
    }
    case 'click': { // R: the blade clicks home - a short horizon stroke and 納
      stroke(fx, ev.x - 56, ev.y - 14, 0, 112, 10, { life: 0.32, speed: 0.05 }); ring(fx, ev.x, ev.y, ev.emp ? 96 : 66, C.silver, { w: 4, life: 0.26 });
      kanjiPop(fx, '納', ev.x + 46, ev.y - 70, 54, { life: 0.5 }); glitter(fx, ev.x, ev.y - 14, 4, 30, ['#ffffff', C.silver]);
      return true;
    }
    case 'ring': case 'petalring': case 'voidend': { // the sheathe shockwave: an ink ensō + a petal ring
      const rr = ev.fx === 'voidend' ? 230 : R;
      ring(fx, ev.x, ev.y, rr * 1.05, C.ink, { enso: true, life: 0.5 }); ring(fx, ev.x, ev.y, rr, C.petal, { w: 5 });
      for (let i = 0; i < N(fx, ev.fx === 'petalring' ? 20 : 12); i++) { const an = (i / 12) * TAU; part(fx, { tex: petalTex(i % 2 ? '#ffc2e0' : '#ff9cc6'), x: ev.x + Math.cos(an) * 20, y: ev.y + Math.sin(an) * 16, vx: Math.cos(an) * rr * 2.4, vy: Math.sin(an) * rr * 1.9, drag: 0.88, s: rnd(9, 14), rot: an, vr: rnd(-6, 6), life: rnd(0.6, 1), sway: 1 }); }
      if (ev.fx === 'voidend') { kanjiPop(fx, '虚', ev.x + 80, ev.y - 100, 110, { life: 0.9, seal: '納' }); fx.text(ev.x, ev.y - 120, 'VOID SHEATHE', { size: 26, color: C.silver, pop: 2, life: 1.1 }); fx.shake(0.4); }
      else fx.shake(0.14);
      return true;
    }
    case 'wave': case 'wavebig': { // Riposte Wave: crescents of moonlight rolling down a line
      const big = ev.fx === 'wavebig' ? 1.35 : 1;
      for (let i = 0; i < 4; i++) { const d = L * (0.2 + i * 0.22); const [x, y] = at(ev.x, ev.y, a, d - 40); crescent(fx, x, y, 50 * big + i * 8, a, { dir: 1, red: i === 3, hi: '#9fb8ff', life: 0.34 + i * 0.07, w: 0.8, speed: 0.08 }); }
      stroke(fx, ev.x, ev.y, a, L, 22 * big, { life: 0.4 }); glitter(fx, ex, ey, 10, 70, ['#ffffff', C.moon, '#ff9cc6']); petals(fx, ex, ey, 8, 60, 220);
      climax(fx, ev.pid, ev.x + Math.cos(a) * L * 0.5, ev.y + Math.sin(a) * L * 0.5, a);
      if (big > 1) fx.text(ev.x, ev.y - 90, 'RIPOSTE!', { size: 26, color: C.moon, pop: 2, life: 0.9 });
      fx.shake(0.2 * big); if (me) fx.punch(a, 5); return true;
    }
    case 'petal': { // Petal Rain: one dash-cut of the flurry
      const x0 = ev.fx0 ?? ev.x, y0 = ev.fy0 ?? ev.y, a2 = Math.atan2(ev.y - y0, ev.x - x0), d = Math.hypot(ev.x - x0, ev.y - y0);
      stroke(fx, x0, y0, a2, d + 30, 18, { red: (ev.i || 0) % 2 === 0, life: 0.34, speed: 0.05 }); ghost(fx, x0, y0, a2, { sam: true, a: 0.35 }); petals(fx, ev.x, ev.y, 5, 30, 200);
      if (n) { burst(fx, ev.x, ev.y, 100, '#ff5a7a', 0.2, 0.6, 13); glitter(fx, ev.x, ev.y, 3, 30, GL); }
      fx.shake(0.06); return true;
    }
    case 'freeze': { // Moment of Death begins: petals freeze in the air
      ring(fx, ev.x, ev.y, 280, '#ffffff', { w: 4, life: 0.5 });
      for (let i = 0; i < N(fx, 24); i++) part(fx, { tex: petalTex(i % 3 ? '#ffc2e0' : '#ffffff'), x: ev.x + rnd(-320, 320), y: ev.y + rnd(-220, 200), drag: 1, s: rnd(8, 13), rot: rnd(0, TAU), life: 1.0 });
      if (me) fx.slowmo(0.3, 0.2); return true;
    }
    case 'deathline': stroke(fx, ev.x, ev.y, a, L + 60, 34, { red: true, life: 0.6, speed: 0.05 }); ghost(fx, ev.x, ev.y, a, { sam: true, a: 0.6, life: 0.4 }); fx.shake(0.3); return true;
    case 'moonA': case 'moonB': { // Twin Moons
      const b = ev.fx === 'moonB';
      crescent(fx, ev.x, ev.y, R, a, { dir: b ? -1 : 1, red: b, hi: C.red, life: 0.45, w: b ? 1.3 : 0.9 });
      const [ix, iy] = at(ev.x, ev.y, a, R * 0.75);
      if (b) { burst(fx, ix, iy, 200, '#ff5a7a', 0.3, 0.8, 14); kanjiPop(fx, '双', ix + 40, iy - 70, 76, { life: 0.6, seal: '月' }); slashLine(fx, ix, iy, a + 1.1, 300, { w: 9, life: 0.4 }); }
      if (n) { glitter(fx, ix, iy, 8, 60, GL); petals(fx, ix, iy, 8, 40, 240); } fx.shake(b ? 0.3 : 0.14); if (me && b) fx.punch(a, 7); return true;
    }
    case 'void': { // the ult's void-black draw
      stroke(fx, ev.x, ev.y, a, L + 60, 64, { red: true, hi: '#8f7cff', life: 0.7, speed: 0.07 });
      slashLine(fx, ev.x, ev.y, a, L + 260, { w: 18, life: 0.6, from: 'start' });
      for (let d = 60; d < L; d += 80) { const [x, y] = at(ev.x, ev.y, a, d); petals(fx, x, y, 2, 20, 220); }
      burst(fx, ex, ey, 190, '#ff5a7a', 0.38, 0.8, 15); splatter(fx, ex, ey, 18, 80);
      climax(fx, ev.pid, ev.x + Math.cos(a) * L * 0.6, ev.y + Math.sin(a) * L * 0.6, a);
      fx.shake(0.45); if (me) fx.punch(a, 8); return true;
    }
    case 'storm': { // Thousand Petal Storm: cuts all over the screen
      const i = ev.i || 0;
      if (i % 2 === 0) crescent(fx, ev.x, ev.y, 34 + (i % 5) * 6, a, { dir: i % 4 ? 1 : -1, red: i % 3 === 0, life: 0.5, speed: 0.05, w: 0.5 });
      if (i % 3 === 0) petals(fx, ev.x, ev.y, 2, 30, 120); if (n && i % 2) sparks(fx, ev.x, ev.y, a, 3, '#ffffff', 320);
      if (i % 6 === 0) fx.shake(0.05); return true;
    }
    case 'stormpose': ghost(fx, ev.x, ev.y, a, { sam: true, a: 0.7, life: 0.6 }); ring(fx, ev.x, ev.y, 70, C.silver, { w: 4, life: 0.5 }); return true;
    case 'stormclick': stroke(fx, ev.x - 90, ev.y - 16, 0, 180, 12, { life: 0.45, speed: 0.05 }); kanjiPop(fx, '納', ev.x + 60, ev.y - 90, 90, { life: 0.8 }); burst(fx, ev.x, ev.y - 14, 180, '#ffffff', 0.25, 0.6, 16); return true;
    case 'whiteline': { // One Perfect Cut: the single white line - the grey moment starts and waits for the split
      const cx = ev.x + Math.cos(a) * L * 0.5, cy = ev.y + Math.sin(a) * L * 0.5;
      slashLine(fx, cx, cy, a, 2600, { w: 5, col: '#9fb8ff', mid: '#ffffff', life: 1.0, grow: 0.14 });
      samMoment(fx, me, { ...ev, x: cx, y: cy }, { title: '★ ONE PERFECT CUT', sub: 'THE SCREEN GOES BLACK · ONE WHITE LINE', kanji: '極', seal: '死', pre: 0.62, life: 1.2, tail: 0.58, dim: 0.5, wash: 0.25, big: 1.2, flash: 0.36 });
      if (me) fx.slowmo(0.4, 0.3); return true;
    }
    case 'splitline': stroke(fx, ev.x, ev.y, a, L, 40, { red: true, hi: '#ffffff', life: 0.6 }); return true;
    default: crescent(fx, ev.x, ev.y, R, a, { red: true }); return true;
  }
}
