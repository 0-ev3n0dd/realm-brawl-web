// Part B3: the Shadow Duel, cinematic. Client-only (reads sim data, never changes HP / damage); every layer is gated on
// DC.seq / DC.arena, so normal play pays one null check per hook. Sequences (real time, seconds):
//   altar 8   camera push-in on the Altar, Core / Body / Soul rise, orbit and fuse into the sigil, light pillars, the
//             village dims, the music drops; the screen cracks and SHATTERS like glass (a snapshot of the frame in shards)
//   wait      the void while the sim opens the arena (the 'duel' command is sent at 7.6 s)
//   intro 6.5 you fall through a starfield, land on the mirrored floor (shockwave); your reflection peels up into the
//             dark mirror; close-up on its eyes; the '<Hero> — Shadow' card slams in with a sting, the duel theme starts
//             (= the sim's DUEL.intro: the mirror only fights after it)
//   beats     66% / 33% mirror HP: a per-class line in a dialogue bar + floor cracks / falling stars (no pause)
//   win 7.5   slow-mo on the killing blow, white flash, the shadow dissolves into stars that flow into you; you rise with
//             class-coloured light wings + halo, your aura ignites, ASCENDED + the rank banner;  back 3: pull back at the Altar
//   lost 3.4  the shadow stands over you, the screen cracks to black;  wake 2.4: you wake at the Altar, nothing lost
// Skippable once seen (Skip button on PC + phone, Esc / Enter / Space on PC); a skip also fast-forwards the sim's intro /
// outro ('duelGo' command). Options > Reduce screen flashes softens the white flash.
import { CLASSES } from '../sim/data/classes.js';
import { heroOf } from '../sim/heroes.js';
import { STATIONS } from '../sim/village.js';
import { AST_POS, AST_R, inAstArea } from '../sim/astraelconst.js';
import { drawHero, ENEMY_DRAW, INK, heroEyes, SHADOW_EYES } from './art.js';
import { glowSprite, blit } from './sprite.js';
import { MUSIC_HOLD } from './music.js';
import { vfxPref } from './fxns.js';
import { SONG, SONG_MAP as SM, preloadSong, songStart, songStop, songPos, songJump, songTick } from './duelsong.js';
export { preloadSong };

const TAU = Math.PI * 2;
const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v), ease = (v) => { v = cl(v); return v * v * (3 - 2 * v); }, seg = (t, a, b) => cl((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
function hash(i) { let h = (i * 374761393) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const ALT = (STATIONS.find((s) => s.id === 'altar') || { at: { x: 0, y: 0 } }).at;
export const DUEL_CINE_LEN = { altar: 8, intro: 6.5, win: 7.5, back: 3, lost: 3.4, wake: 2.4, wait: 3 };
const SEEN_KEY = 'realmbrawl.cineSeen';
const APP = { skin: 4, hairStyle: 3, hairColor: 6, outfit: 5 };
const PIECE_LOOK = [['◆', '#ff9a4a', 'Core'], ['⬢', '#7fd0ff', 'Body'], ['✦', '#d7c2ff', 'Soul']];

/** the mirror's lines, per class: [birth, 66%, 33%, its last words, standing over you] */
export const SHADOW_LINES = {
  warrior: ['Every swing you hold back, I let fall.', 'Your rage is mine. I never tire of it.', 'Break me, then. You never could break yourself.', 'So... the shield was never the strength. You were.', 'Kneel. You always wanted to.'],
  ranger: ['I see every shot before you draw.', 'You miss nothing - except me.', 'Run out of arrows, hunter. I never do.', 'A clean shot... I taught you that.', 'The hawk falls. The shadow waits.'],
  mage: ['I am the spell you were afraid to cast.', 'Your mana runs thin. Mine is endless night.', 'Burn brighter. Shadows only grow.', 'The light... it was always yours to keep.', 'Every spell you know, I knew first.'],
  cleric: ['Who heals the healer? No one. Only me.', 'Your prayers echo here. No one answers.', 'Pray harder. I am listening.', 'Your faith held... where mine could not.', 'Rest. I will keep your vigil now.'],
  bladedancer: ['Step for step, cut for cut. Dance with me.', 'You falter. I never miss a beat.', 'Faster. Faster! The song ends with one of us.', 'The last step... was yours.', 'The dance is over. Bow.'],
  samurai: ['One draw. One cut. One of us.', 'Your blade hesitates. Mine does not know how.', 'Steel remembers every doubt you swallowed.', 'A true cut. I accept it.', 'Sheathe your sword. It is done.'],
  monk: ['Your calm is a mask. I am the face beneath.', 'Breathe. I will take that too.', 'Still mind, shaking hands. I feel them.', 'Stillness... at last.', 'Even stone sleeps. Sleep.'],
  dragoon: ['Leap, and I will be the sky that drops you.', 'You fly. I am the fall.', 'The dragon in you is hungry. So am I.', 'You soared... above even me.', 'Grounded. As you always feared.'],
  summoner: ['Call your spirits. They answer me now.', 'Your circle is broken. I drew the cracks.', 'Every pact has a price. I am yours.', 'The bond holds... it was never mine.', 'Your spirits are quiet. Listen to them.'],
  bard: ['Play your song. I know every note.', 'Your melody wavers. Mine is the silence after.', 'Sing louder! The night is listening.', 'A finale... worthy of the stars.', 'The song ends. The silence was mine all along.'],
};
const lineOf = (cls, i) => (SHADOW_LINES[cls] || SHADOW_LINES.warrior)[i];
const loadSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch { return {}; } };
const saveSeen = (s) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(s)); } catch { /* private mode */ } };

export const DC = { clash: null, clashDone: {}, fin: false, finAt: null, pendCr: 0, songT: -1, seq: null, t: 0, cls: 'warrior', g: null, skip: false, arena: false, cracks: 0, stars: [], parts: null, shards: null, snapWant: false, cues: [], dlg: null, ok: true, rank: 1, ev: null, rend: null, lift: 0, hideHero: false, sent: false, send: null, ascT: -1, last: 0 };
// B4: the song drives the cinematic clocks (design seconds below are the B3 timings; knots = the song's bars)
const pw = (K, x) => { if (x <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (x <= K[i][0]) { const [a, u] = K[i - 1], [b, v] = K[i]; return u + (v - u) * (x - a) / (b - a); } return K[K.length - 1][1] + (x - K[K.length - 1][0]); };
const ALTAR_K = [[0, 0], [SM.downbeats[2], 4.6], [SM.shatter, 7.3]]; // the fuse flash on bar 3, the glass breaks on bar 4
const INTRO_K = [[SM.shatter, 0], [SM.land, 1.35], [SM.eyes, 3.4], [SM.title, 4.4], [SM.fight, 6.5]]; // land / eyes / title card / the fight on downbeats
/** per-class clash flavour: [the lock line, the colour of the sparks] */
export const CLASH_FLAVOR = { warrior: ['Steel on steel!', '#ffb14a'], ranger: ['Arrow splits arrow!', '#9cff7a'], mage: ['Spell meets spell!', '#7fc8ff'], cleric: ['Light against light!', '#fff2a8'], bladedancer: ['Blade to blade!', '#ff7ad1'], samurai: ['Iaido clash!', '#ff5a5a'], monk: ['Palm to palm!', '#ffd27a'], dragoon: ['Lance to lance!', '#7affea'], summoner: ['Spirit against spirit!', '#c79bff'], bard: ['Note against note!', '#ffa6f2'] };
export const duelCineOn = () => !!(DC.seq || DC.arena);

function play(n) { const g = DC.g; if (g && g.audio) g.audio.play(n); }
function shake(k) { const g = DC.g; if (g && g.fx && g.fx.shake) g.fx.shake(k); }
function start(seq) {
  const seen = loadSeen(); DC.skip = !!seen[seq] && seq !== 'wait' && seq !== 'back'; if (!seen[seq]) { seen[seq] = 1; saveSeen(seen); }
  DC.seq = seq; DC.t = 0; DC.cues = []; skipBtn();
}
const cue = (t, f) => DC.cues.push([t, f]);
function end() { DC.seq = null; DC.lift = 0; DC.hideHero = false; skipBtn(); }
function shadowOf(sim) { for (const e of sim.enemies || []) if (!e.dead && e.type && e.type.startsWith('shadow_')) return e; return null; }

/** the Altar's "Face your Shadow": the 8 s activation, then send() (the 'duel' command) */
export function startAltarCine(g, send) {
  if (DC.seq) return false;
  DC.g = g; DC.cls = g.player ? g.player.cls : 'warrior'; DC.send = send; DC.sent = false; DC.shards = null;
  start('altar'); MUSIC_HOLD.id = null; DC.clashDone = {}; DC.fin = false; DC.finAt = null; DC.pendCr = 0;
  if (!songStart(0)) { const L = preloadSong(g.audio); // (B4: the song starts at the Altar's activation; still decoding -> it joins in, in sync, once ready)
    if (L && L.then) L.then((b) => { if (!b || SONG.on) return; const inv = (K) => K.map(([a, v]) => [v, a]);
      if (DC.seq === 'altar') songStart(pw(inv(ALTAR_K), DC.t)); else if (DC.seq === 'intro') songStart(pw(inv(INTRO_K), DC.t)); else if (DC.arena && !DC.won) songStart(SM.loopA[0]); }); }
  cue(0, () => play('cineRumble')); cue(1.2, () => play('cineWhoosh')); cue(2.8, () => play('cineChoir')); cue(4.6, () => { play('cineFlash'); shake(0.25); });
  cue(6.6, () => play('cineCrack')); cue(7.0, () => play('cineCrack')); cue(7.3, () => { DC.snapWant = true; play('cineShatter'); shake(0.5); }); cue(7.6, () => fire());
  return true;
}
function fire() { if (DC.sent) return; DC.sent = true; if (DC.send) DC.send(); }

/** rewards.js routes every own 'duel' event here first; true = the cinematic shows it (no plain banner) */
export function duelCineEvent(ev, g) {
  DC.g = g || DC.g; const cls = ev.cls || DC.cls; DC.cls = cls; DC.ev = ev;
  if (ev.ph === 'start') {
    DC.arena = true; DC.won = false; DC.cracks = 0; DC.stars = []; DC.parts = null; DC.dlg = null; MUSIC_HOLD.id = null; MUSIC_HOLD.duel = true;
    start('intro'); DC.hideHero = true;
    cue(0, () => play('cineWhoosh')); cue(1.35, () => { DC.hideHero = false; play('cineLand'); shake(0.7); }); cue(1.9, () => play('cineDark'));
    cue(3.5, () => play('cineCrack')); cue(4.4, () => { play('cineSting'); shake(0.55); if (!SONG.on) MUSIC_HOLD.id = undefined; });
    return true;
  }
  if (ev.ph === 'beat') { DC.dlg = { t: 0, text: lineOf(cls, ev.n === 1 ? 1 : 2), life: 3.6 }; if (SONG.on) DC.pendCr = Math.max(DC.pendCr, ev.n | 0); else crackNow(ev.n | 0); return true; } // (B4: the line now, the arena cracks on the song's swell)
  if (ev.ph === 'fin') { DC.fin = true; return true; }
  if (ev.ph === 'clash') { clashFx(ev); return true; }
  if (ev.ph === 'fight') { if (DC.seq === 'intro' && DC.t < 4.4) { if (!SONG.on) MUSIC_HOLD.id = undefined; end(); } return true; }
  if (ev.ph === 'won') {
    DC.clash = null; DC.won = true;
    DC.ok = ev.ok !== false; DC.rank = ev.rank || 1; DC.ascT = -1; MUSIC_HOLD.id = null; DC.dlg = { t: 0, text: lineOf(cls, 3), life: 2.6 };
    if (DC.g && DC.g.slow) DC.g.slow(1.1, 0.25); // (the killing blow in slow motion: solo sim time)
    const p = DC.g && DC.g.player, S = []; const n = DC.g && DC.g.isMobile ? 46 : 70;
    for (let i = 0; i < n; i++) S.push({ x: ev.x + (hash(i) - 0.5) * 70, y: ev.y - 40 + (hash(i + 99) - 0.5) * 90, d: 0.3 + hash(i + 7) * 1.2, w: (hash(i + 3) - 0.5) * 260 });
    DC.parts = S; void p;
    start('win');
    cue(0, () => { play('cineFlash'); shake(0.6); }); cue(0.4, () => play('cineWhoosh')); cue(2.4, () => play('cineAscend')); cue(3.4, () => { play('cineSting'); shake(0.5); DC.ascT = DC.t; });
    return true;
  }
  if (ev.ph === 'lost') {
    DC.dlg = null;
    if (ev.why !== 'death') { songStop(1); DC.clash = null; MUSIC_HOLD.id = undefined; MUSIC_HOLD.duel = false; DC.arena = false; end(); return false; }
    MUSIC_HOLD.id = null; DC.clash = null; songStop(1.6); start('lost'); DC.dlg = { t: 0, text: lineOf(cls, 4), life: 2.4 };
    cue(0, () => play('cineDark')); cue(1.6, () => { play('cineCrack'); shake(0.3); }); cue(2.2, () => play('cineCrack')); cue(2.7, () => play('cineShatter'));
    return true;
  }
  return false;
}

/** the Skip control (PC + phone): only for a sequence you have seen before */
function skipBtn() {
  if (typeof document === 'undefined') return;
  let b = document.getElementById('dcSkip');
  if (!b) {
    b = document.createElement('button'); b.id = 'dcSkip'; b.type = 'button'; b.textContent = 'Skip ▸';
    b.style.cssText = 'position:fixed;right:18px;top:13%;z-index:60;font:16px "Lilita One",sans-serif;color:#fff;background:rgba(20,12,34,.72);border:2px solid #c9b6ff;border-radius:12px;padding:8px 16px;display:none;cursor:pointer;touch-action:manipulation';
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); skipNow(); });
    document.body.appendChild(b);
    const st = document.createElement('style'); st.textContent = '.dc-cine #death,.dc-cine #questTracker,.dc-cine #toast,.dc-cine .tu-prompt,.dc-cine #villagePrompt,.dc-cine #dpsCard,.dc-cine #pouchChip{display:none!important}'; document.head.appendChild(st);
    window.addEventListener('keydown', (e) => { if (DC.seq && DC.skip && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopImmediatePropagation(); skipNow(); } }, true);
  }
  b.style.display = DC.seq && DC.skip ? 'block' : 'none';
  document.body.classList.toggle('dc-cine', !!DC.seq); // (the cinematic owns the screen: no death card / quest pin / toasts)
}
export function skipNow() {
  const s = DC.seq, g = DC.g; if (!s || !DC.skip) return false;
  const go = () => { if (g && g.command) g.command({ type: 'duelGo' }); };
  if (s === 'altar') { DC.shards = null; fire(); start('wait'); if (SONG.on) songJump(SM.shatter, songPos()); }
  else if (s === 'intro') { go(); end(); if (SONG.on) songJump(SM.fight, songPos()); else MUSIC_HOLD.id = undefined; }
  else if (s === 'win') { go(); DC.ascT = 0; start('back'); DC.t = 1.6; }
  else if (s === 'lost') { go(); start('wake'); }
  else end();
  return true;
}

/** once per frame from the renderer (real time) */
export function duelCineTick(dt, sim, local) {
  { const now = typeof performance !== 'undefined' ? performance.now() / 1000 : 0; if (DC.last && now > DC.last) dt = Math.min(0.25, Math.max(dt, now - DC.last)); DC.last = now; } // (real time, even on a slow frame)
  if (SONG.on || DC.clash) songDrive(sim, local);
  if (!DC.seq && !DC.dlg && !DC.shards && !DC.clash && !(DC.arena && DC.cracks >= 2)) return;
  if (DC.clash) DC.clash.rt += dt;
  if (DC.dlg) { DC.dlg.t += dt; if (DC.dlg.t > DC.dlg.life) DC.dlg = null; }
  if (DC.shards) { for (const s of DC.shards.list) { s.vy += 1500 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.a += s.va * dt; } if ((DC.shards.t += dt) > 1.8) DC.shards = null; }
  if (DC.arena && DC.cracks >= 2) { // falling stars (cosmetic): ~3 a second over the arena
    if (Math.random() < dt * 3.2 && DC.stars.length < 10) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (AST_R - 80); DC.stars.push({ x: AST_POS.x + Math.cos(a) * r, y: AST_POS.y + Math.sin(a) * r, t: 0 }); }
    for (const s of DC.stars) s.t += dt; DC.stars = DC.stars.filter((s) => s.t < 1.4);
  }
  if (!DC.seq) return;
  if (DC.hold && DC.hold[0] === DC.seq && DC.t >= DC.hold[1]) return; // (media tooling: hold a beat for a still)
  const t0 = DC.t; DC.t += dt;
  { const sp = SONG.on ? songPos() : -1; if (sp >= 0 && DC.seq === 'altar') DC.t = Math.max(t0, pw(ALTAR_K, sp)); else if (sp >= 0 && DC.seq === 'intro' && sp >= SM.shatter - 0.5) DC.t = Math.max(t0, Math.min(DC.t + 0.3, pw(INTRO_K, sp))); } // (B4: beat-locked to the song)
  for (const c of DC.cues) if (c[0] >= t0 && c[0] < DC.t || (t0 === 0 && c[0] === 0)) c[1]();
  const inArena = local && inAstArea(local.x, local.y);
  switch (DC.seq) {
    case 'altar': if (DC.t >= DUEL_CINE_LEN.altar) start('wait'); break;
    case 'wait': if (DC.t >= DUEL_CINE_LEN.wait) { MUSIC_HOLD.id = undefined; end(); if (DC.g && DC.g.fx) DC.g.fx.banner('THE ALTAR WAITS', '#c9b6ff', 'The Star Sanctum is busy: try again in a moment', 2.6, 34); } break;
    case 'intro': if (DC.t >= DUEL_CINE_LEN.intro) { if (DC.g && DC.g.command) DC.g.command({ type: 'duelGo' }); if (!SONG.on) MUSIC_HOLD.id = undefined; end(); } break; // (the fight starts on the song's pickup bar)
    case 'win': DC.lift = 46 * ease(seg(DC.t, 2.6, 4.2)); if ((DC.t > 6.6 && !inArena) || DC.t >= DUEL_CINE_LEN.win + 6) { start('back'); DC.lift = 0; } break; // (the pull-back plays once the sim has you at the Altar)
    case 'back': if (DC.t >= DUEL_CINE_LEN.back && !(SONG.on && songPos() < SM.hit + 1.5 && songPos() > SM.run - 0.5)) { if (SONG.on && !SONG.fadeAt) songStop(2.5); DC.arena = false; MUSIC_HOLD.id = undefined; MUSIC_HOLD.duel = false; end(); } break;
    case 'lost': if (DC.t >= DUEL_CINE_LEN.lost && (!inArena || DC.t > DUEL_CINE_LEN.lost + 3)) start('wake'); break;
    case 'wake': if (DC.t >= DUEL_CINE_LEN.wake) { songStop(0.5); DC.arena = false; MUSIC_HOLD.id = undefined; MUSIC_HOLD.duel = false; end(); } break;
  }
  void sim;
}

function crackNow(n) { DC.cracks = Math.max(DC.cracks, n); play('cineCrack'); shake(0.45); DC.swellT = 0.9; DC.swellN = n; }
const clashKind = (T) => (SM.clashes.indexOf(T) % 3 === 2 ? 'mash' : 'press');
/** B4: the song's bars drive the swells, the clashes and the final clash (the fight itself never pauses) */
function songDrive(sim, local) {
  const b = shadowOf(sim), hp = b ? b.hp / b.maxHp : null;
  const where = songTick({ hp, won: !!DC.won, fin: DC.fin && !DC.won });
  if (where) DC.finAt = where === 'peak' ? SM.peak : SM.hit;
  const s = SONG.on ? songPos() : -1, s0 = DC.songT; DC.songT = s;
  const crossed = (x) => s0 >= 0 && s >= x && s0 < x && s - s0 < 1;
  if (DC.pendCr >= 1 && DC.cracks < 1 && crossed(SM.swell1)) crackNow(1);
  if (DC.pendCr >= 2 && DC.cracks < 2 && (crossed(SM.swell2) || (DC.cracks >= 1 && crossed(SM.swell1)))) crackNow(2);
  if (DC.pendCr >= 1 && DC.cracks < 1 && s > SM.swell1 + 0.5) crackNow(1); // (safety: a swell the song jumped past)
  if (DC.pendCr >= 2 && DC.cracks < 2 && s > SM.swell2 + 0.5) crackNow(2);
  if (DC.won || DC.seq || !b || s < SM.fight) { if (DC.clash && (DC.won || !b)) DC.clash = null; return; }
  const lead = 2 * SM.beatSec; // the prompt shows 2 beats ahead of the hit
  if (!DC.clash) {
    let T = null, fin = false;
    if (DC.fin && DC.finAt && s >= DC.finAt - lead - 0.05 && s < DC.finAt - lead + 0.6) { T = DC.finAt; fin = true; }
    else if (!DC.fin) for (const x of SM.clashes) if (s >= x - lead - 0.05 && s < x - lead + 0.4 && !(DC.clashDone[x] > performance.now() - 6000)) { T = x; break; }
    if (T != null && local && !local.dead) {
      DC.clashDone[T] = performance.now();
      const kind = fin ? 'press' : clashKind(T);
      DC.clash = { T, fin, kind, need: kind === 'mash' ? 6 : 1, n: 0, ok: null, hitAt: null, rt: 0, sent: false, res: null, resT: 0 };
      play('cineWhoosh'); shake(0.2); clashBtn(true);
    }
    return;
  }
  const K = DC.clash, d = s - K.T; // d < 0: the window is open; at the hit (d >= 0) it resolves on the beat
  if (!K.sent && (d >= 0 || (s < 0 && K.rt > lead + 0.5))) {
    K.sent = true; const ok = K.ok === true || (K.kind === 'mash' && K.n >= K.need);
    if (DC.g && DC.g.command) DC.g.command({ type: 'duelClash', ok, fin: K.fin }); K.res = ok; K.resT = 0;
    clashBtn(false); play(ok ? 'cineFlash' : 'cineCrack'); shake(ok ? 0.7 : 0.4);
  }
  if (K.sent) { K.resT += 1 / 60; if (d > 0.95 || K.rt > lead + 2.2) DC.clash = null; }
}
/** a key press / tap during a clash window (generous: ±0.5 s around the hit for a press; any count for a mash) */
export function clashInput() {
  const K = DC.clash; if (!K || K.sent) return false; const s = SONG.on ? songPos() : -1, d = s >= 0 ? s - K.T : K.rt - 2 * SM.beatSec;
  if (K.kind === 'mash') { K.n++; play('hit'); return true; }
  if (K.ok == null) { K.ok = d > -0.6 && d < 0.5; K.hitAt = d; play(K.ok ? 'crit' : 'evade'); }
  return true;
}
function clashFx(ev) { const fx = DC.g && DC.g.fx; if (!fx) return; const H = heroOf(DC.cls);
  if (ev.fin && ev.ok) return; // (the kill cinematic takes it from here)
  fx.banner(ev.ok ? (ev.fin ? 'FINAL BLOW' : 'COUNTER!') : 'CLASH LOST', ev.ok ? (CLASH_FLAVOR[DC.cls] || ['', '#ffd23f'])[1] : '#ff4d5e', ev.ok ? 'Your Shadow staggers' : `The Shadow of ${H.name} breaks through`, 1.2, 40); }
function clashBtn(on) { // the phone's on-screen clash button (PC: Space / Enter / J, or click it too)
  if (typeof document === 'undefined') return;
  let b = document.getElementById('dcClash');
  if (!b) {
    b = document.createElement('button'); b.id = 'dcClash'; b.type = 'button';
    b.style.cssText = 'position:fixed;left:50%;bottom:16%;transform:translateX(-50%);z-index:61;font:22px "Lilita One",sans-serif;color:#1a0f24;background:#ffe27a;border:4px solid #2b2433;border-radius:999px;padding:14px 34px;display:none;touch-action:manipulation;box-shadow:0 0 24px #ffb84a';
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); clashInput(); });
    document.body.appendChild(b);
    window.addEventListener('keydown', (e) => { if (DC.clash && !DC.clash.sent && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyJ')) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat || DC.clash.kind === 'mash') clashInput(); } }, true);
  }
  const K = DC.clash, mob = DC.g && DC.g.isMobile; b.textContent = K && K.kind === 'mash' ? 'MASH!' : 'CLASH!'; b.style.display = on && mob ? 'block' : 'none';
}
/** the cinematic camera: { z, k, x, y } (zoom multiplier, pull 0..1 towards x, y) or null */
export function duelCamera(sim, local) {
  if (!DC.seq && DC.clash && local) { const K = DC.clash, b = shadowOf(sim); if (!b) return null; const k = ease(cl(K.rt / 0.35)) * (K.sent ? 1 - ease(cl((K.resT - 0.4) / 0.5)) : 1); return { z: lerp(1, 1.85, k), k, x: (local.x + b.x) / 2, y: (local.y + b.y) / 2 - 20 }; } // (B4: the clash close-up; the fight keeps running)
  const s = DC.seq; if (!s || !local) return null; const t = DC.t;
  const b = shadowOf(sim), bx = b ? b.x : AST_POS.x, by = b ? b.y : AST_POS.y - 160;
  if (s === 'altar' || s === 'wait') return { z: 1 + 0.75 * ease(seg(t, 0, 6.5)) + (s === 'wait' ? 0.75 : 0), k: s === 'wait' ? 1 : ease(seg(t, 0, 1.6)), x: ALT.x, y: ALT.y - 30 };
  if (s === 'intro') {
    if (t < 1.35) return { z: 1.6, k: 1, x: local.x, y: local.y };
    if (t < 1.9) return { z: lerp(1.6, 1.2, ease(seg(t, 1.35, 1.9))), k: 1, x: local.x, y: local.y };
    if (t < 3.4) return { z: 1.15, k: 1, x: lerp(local.x, (local.x + bx) / 2, ease(seg(t, 1.9, 2.6))), y: lerp(local.y, (local.y + by) / 2, ease(seg(t, 1.9, 2.6))) };
    if (t < 4.4) { const k = ease(seg(t, 3.4, 3.8)); return { z: lerp(1.15, 2.4, k), k: 1, x: lerp((local.x + bx) / 2, bx, k), y: lerp((local.y + by) / 2, by - 30, k) }; }
    const k = ease(seg(t, 4.4, 6.4)); return { z: lerp(1.5, 1, k), k: 1 - k, x: (local.x + bx) / 2, y: (local.y + by) / 2 };
  }
  if (s === 'win') { const ev = DC.ev || local; if (t < 1) return { z: 1.5, k: 1, x: ev.x, y: ev.y - 20 }; const k = ease(seg(t, 1, 2.6)); return { z: lerp(1.5, 1.45, k), k: 1, x: lerp(ev.x, local.x, k), y: lerp(ev.y - 20, local.y - 120, k) }; }
  if (s === 'back') { const k = ease(seg(t, 0, DUEL_CINE_LEN.back)); return { z: lerp(1.9, 1, k), k: 1 - k, x: local.x, y: local.y - 40 }; }
  if (s === 'lost') return { z: lerp(1.2, 1.7, ease(seg(t, 0, 2))), k: 1, x: local.x, y: local.y - 20 };
  if (s === 'wake') { const k = ease(seg(t, 0.4, 2.4)); return { z: lerp(1.5, 1, k), k: 1 - k, x: local.x, y: local.y }; }
  return null;
}
/** the renderer asks: lift / hide the local hero (the rise, the fall) */
export const duelHeroLift = () => (DC.hideHero ? { h: 0, hide: true } : DC.lift > 0 ? { h: DC.lift } : null);
/** the mirror's alpha (hidden until its reflection has peeled up into it) */
export const shadowAlpha = () => (DC.seq === 'intro' ? ease(seg(DC.t, 3.0, 3.5)) : 1);

// ------------------------------------------------------------------ world space
const CRACKS = (() => { const out = []; for (let i = 0; i < 14; i++) { const a0 = hash(i * 7 + 1) * TAU, pts = [[0, 0]]; let a = a0, r = 0; for (let j = 0; j < 7; j++) { r += 40 + hash(i * 31 + j) * 70; a += (hash(i * 13 + j) - 0.5) * 0.7; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } out.push(pts); } return out; })();
const FLOOR_STARS = (() => { const o = []; for (let i = 0; i < 140; i++) { const a = hash(i) * TAU, r = Math.sqrt(hash(i + 500)) * (AST_R - 40); o.push([Math.cos(a) * r, Math.sin(a) * r, 0.6 + hash(i + 900) * 1.8, hash(i + 77)]); } return o; })();
function reflect(ctx, x, y, f, a) { ctx.save(); ctx.translate(x, y + 6); ctx.scale(1, -0.55); ctx.globalAlpha = a; f(); ctx.restore(); }
/** the mirrored floor (cracks, reflections, the landing shockwave, the peel): over the Star Sanctum ground, under the actors */
export function drawDuelFloor(ctx, sim, local, time) {
  if (!DC.arena) return;
  const C = AST_POS, R = AST_R - 30, s = DC.seq, t = DC.t;
  ctx.save();
  // the glossy black mirror + its reflected starfield
  const g = ctx.createRadialGradient(C.x, C.y, 40, C.x, C.y, R); g.addColorStop(0, 'rgba(34,20,58,0.82)'); g.addColorStop(0.8, 'rgba(14,8,28,0.86)'); g.addColorStop(1, 'rgba(120,90,200,0.55)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(C.x, C.y, R, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, r, ph] of FLOOR_STARS) { ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(time * 1.6 + ph * 20)); ctx.fillStyle = ph > 0.8 ? '#ffd8f0' : '#cfe0ff'; ctx.fillRect(C.x + x - r / 2, C.y + y - r / 2, r, r); }
  ctx.globalAlpha = 0.35; ctx.strokeStyle = '#a58cff'; ctx.lineWidth = 2;
  for (const rr of [R * 0.35, R * 0.68, R - 4]) { ctx.beginPath(); ctx.arc(C.x, C.y, rr, 0, TAU); ctx.stroke(); }
  ctx.globalAlpha = 0.18; for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + time * 0.02; ctx.beginPath(); ctx.moveTo(C.x + Math.cos(a) * R * 0.35, C.y + Math.sin(a) * R * 0.35); ctx.lineTo(C.x + Math.cos(a) * R, C.y + Math.sin(a) * R); ctx.stroke(); }
  // the cracks (66%: violet, 33%: red-hot)
  if (DC.cracks >= 1) {
    const n = DC.cracks >= 2 ? 14 : 7;
    for (let i = 0; i < n; i++) { const P = CRACKS[i]; ctx.globalAlpha = 0.85; ctx.strokeStyle = i >= 7 ? '#ff5d7a' : '#c9a8ff'; ctx.lineWidth = i >= 7 ? 3 : 2.4; ctx.beginPath(); P.forEach(([x, y], j) => (j ? ctx.lineTo(C.x + x, C.y + y) : ctx.moveTo(C.x + x, C.y + y))); ctx.stroke();
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(time * 4 + i); ctx.lineWidth = 9; ctx.stroke(); }
  }
  ctx.globalCompositeOperation = 'source-over';
  // reflections: you + the mirror, upside down in the glass
  const b = shadowOf(sim), sa = shadowAlpha();
  if (local && !(s === 'intro' && t < 1.35)) reflect(ctx, local.x, local.y, () => drawHero(ctx, { x: 0, y: 0, ang: local.aim || 0, cls: local.cls, app: local.app || APP, time, scale: 1.2, classic: true, noShadow: true }), (s === 'intro' && t > 1.9 && t < 3.4 ? 0.28 * (1 - seg(t, 1.9, 2.4)) : 0.28));
  if (b && sa > 0 && ENEMY_DRAW[b.type]) reflect(ctx, b.x, b.y, () => ENEMY_DRAW[b.type](ctx, { ...b, _peel: true }, time), 0.22 * sa);
  // the landing shockwave
  if (s === 'intro' && local && t > 1.35 && t < 2.6) {
    const k = seg(t, 1.35, 2.6); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { const kk = cl(k * 1.3 - i * 0.15); ctx.globalAlpha = (1 - kk) * 0.9; ctx.strokeStyle = i ? '#b9a0ff' : '#ffffff'; ctx.lineWidth = 10 * (1 - kk) + 2; ctx.beginPath(); ctx.ellipse(local.x, local.y, 30 + kk * 460, (30 + kk * 460) * 0.55, 0, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = (1 - k) * 0.7; blit(ctx, glowSprite('#c9b6ff', 90), local.x, local.y);
  }
  // the peel: your reflection lifts out of the floor, flips upright and slides to where the mirror stands
  if (s === 'intro' && local && b && t > 1.9 && t < 3.6) {
    const k = ease(seg(t, 1.9, 3.3)), x = lerp(local.x, b.x, k), y = lerp(local.y + 10, b.y, k), sy = lerp(-0.55, 1, ease(seg(t, 1.9, 2.8)));
    ctx.save(); ctx.translate(x, y); ctx.scale(1, sy); ctx.globalAlpha = 0.9 * (1 - seg(t, 3.3, 3.6)); if (ENEMY_DRAW[b.type]) ENEMY_DRAW[b.type](ctx, { ...b, x: 0, y: 0, _peel: true }, time); ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) { const u = (k + i / 10) % 1; ctx.globalAlpha = (1 - u) * 0.5; ctx.fillStyle = '#7a3cff'; ctx.beginPath(); ctx.arc(lerp(local.x, x, u) + Math.sin(i * 3 + time * 3) * 14, lerp(local.y, y, u), 6 + 10 * (1 - u), 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

function wings(ctx, x, y, col, k, time) { // class-coloured light wings: 7 feathers a side, beating slowly
  ctx.save(); ctx.translate(x, y); ctx.globalCompositeOperation = 'lighter';
  const flap = Math.sin(time * 2.2) * 0.08;
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) {
    const a = s * (0.5 + i * 0.17 + flap) - Math.PI / 2, L = (120 + i * 26 - i * i * 2.6) * k;
    ctx.globalAlpha = (0.55 - i * 0.04) * k; ctx.fillStyle = i % 2 ? '#ffffff' : col;
    ctx.beginPath(); ctx.moveTo(s * 6, -6); ctx.quadraticCurveTo(Math.cos(a + s * 0.25) * L * 0.6 + s * 6, Math.sin(a + s * 0.25) * L * 0.6 - 6, Math.cos(a) * L, Math.sin(a) * L - 6);
    ctx.quadraticCurveTo(Math.cos(a - s * 0.18) * L * 0.5, Math.sin(a - s * 0.18) * L * 0.5, s * 3, 4); ctx.fill();
  }
  ctx.restore();
}
/** over the actors: the Altar's pieces, sigil and pillars; falling stars; the dissolve into you; wings, halo, aura */
export function drawDuelOver(ctx, sim, local, time) {
  const s = DC.seq, t = DC.t;
  if (!s && !DC.clash && !(DC.arena && DC.stars.length)) return;
  ctx.save();
  if (DC.clash && local) { // B4: the blade-lock: two crossed streaks of light at the point between you, sparks, the on-beat shockwave
    const K = DC.clash, b = shadowOf(sim);
    if (b) { const fl = CLASH_FLAVOR[DC.cls] || ['', '#ffd23f'], col = (CLASSES[DC.cls] || {}).color || '#ffd23f', mx = (local.x + b.x) / 2, my = (local.y + b.y) / 2 - 24, a = Math.atan2(b.y - local.y, b.x - local.x), L = 64, sh = Math.sin(time * 40) * 3;
      ctx.globalCompositeOperation = 'lighter';
      for (const [da, c] of [[0.55, col], [-0.55, '#b07aff']]) { ctx.save(); ctx.translate(mx + sh, my); ctx.rotate(a + Math.PI / 2 + da); ctx.globalAlpha = 0.95; ctx.fillStyle = c; ctx.fillRect(-L, -4, L * 2, 8); ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff'; ctx.fillRect(-L, -1.5, L * 2, 3); ctx.restore(); }
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 30); blit(ctx, glowSprite(fl[1], 40), mx, my);
      for (let i = 0; i < 14; i++) { const u = (time * 3 + hash(i)) % 1, aa = hash(i + 17) * TAU, r = 10 + u * 70; ctx.globalAlpha = 1 - u; ctx.fillStyle = i % 3 ? fl[1] : '#ffffff'; ctx.fillRect(mx + Math.cos(aa) * r, my + Math.sin(aa) * r + u * u * 30, 3, 3); }
      if (K.sent) { const k = cl(K.resT / 0.7); ctx.globalAlpha = 1 - k; ctx.strokeStyle = K.res ? fl[1] : '#ff4d5e'; ctx.lineWidth = 12 * (1 - k) + 2; ctx.beginPath(); ctx.ellipse(mx, my + 24, 30 + k * 420, (30 + k * 420) * 0.55, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = (1 - k) * 0.8; blit(ctx, glowSprite(K.res ? '#ffffff' : '#ff4d5e', 90), mx, my); }
      ctx.globalCompositeOperation = 'source-over'; }
  }
  if (s === 'altar' || s === 'wait') {
    const X = ALT.x, Y = ALT.y - 34, tt = s === 'wait' ? 8 : t, sig = ease(seg(tt, 3.6, 4.8));
    { const dk = 0.62 * ease(seg(tt, 0.5, 3)), rg = ctx.createRadialGradient(X, Y, 50, X, Y, 900); rg.addColorStop(0, 'rgba(6,3,16,0)'); rg.addColorStop(0.3, `rgba(6,3,16,${dk * 0.6})`); rg.addColorStop(1, `rgba(6,3,16,${dk})`); ctx.fillStyle = rg; ctx.fillRect(X - 3000, Y - 3000, 6000, 6000); } // the village dims (world space: under the pillars)
    ctx.globalCompositeOperation = 'lighter';
    // the sigil: two counter-rotating rune rings on the basin
    if (tt > 0.6) {
      const k = ease(seg(tt, 0.6, 2)); ctx.globalAlpha = 0.35 + 0.6 * sig; ctx.strokeStyle = sig > 0.5 ? '#fff2c4' : '#c9b6ff'; ctx.lineWidth = 3;
      for (const [r, dir, n] of [[64 * k, 1, 8], [92 * k, -1, 12]]) { ctx.beginPath(); ctx.ellipse(X, Y + 30, r, r * 0.42, 0, 0, TAU); ctx.stroke();
        for (let i = 0; i < n; i++) { const a = i * TAU / n + dir * tt * 0.7; ctx.beginPath(); ctx.arc(X + Math.cos(a) * r, Y + 30 + Math.sin(a) * r * 0.42, 3.5, 0, TAU); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); } }
    }
    // Core / Body / Soul: rise, orbit, converge
    if (tt < 4.8) PIECE_LOOK.forEach(([ico, col], i) => {
      const rise = ease(seg(tt, 0.5 + i * 0.25, 2.4)), conv = ease(seg(tt, 3.4, 4.6)), a = i * TAU / 3 + tt * 1.6, r = 78 * (1 - conv);
      const x = X + Math.cos(a) * r * rise, y = Y - 70 * rise + Math.sin(a) * r * 0.35 * rise;
      ctx.globalAlpha = rise * (1 - seg(tt, 4.4, 4.8)); blit(ctx, glowSprite(col, 34), x, y);
      ctx.globalCompositeOperation = 'source-over'; ctx.font = "26px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeText(ico, x, y); ctx.fillStyle = col; ctx.fillText(ico, x, y); ctx.globalCompositeOperation = 'lighter';
    });
    // the fuse flash + light pillars
    if (tt > 4.5) {
      const f = 1 - seg(tt, 4.5, 5.3); ctx.globalAlpha = f; blit(ctx, glowSprite('#ffffff', 160), X, Y - 70);
      const pk = ease(seg(tt, 4.7, 5.6));
      for (let i = -3; i <= 3; i++) { const w = i ? 16 : 46, x = X + i * 44, h = (i ? 520 : 900) * pk, al = (i ? 0.25 : 0.55) * (0.8 + 0.2 * Math.sin(time * 6 + i));
        const lg = ctx.createLinearGradient(0, Y + 30, 0, Y + 30 - h); lg.addColorStop(0, i ? '#9f86ff' : '#fff3c8'); lg.addColorStop(1, 'rgba(160,130,255,0)');
        ctx.globalAlpha = al; ctx.fillStyle = lg; ctx.fillRect(x - w / 2, Y + 30 - h, w, h); }
      for (let i = 0; i < 18; i++) { const u = (time * 0.6 + hash(i)) % 1; ctx.globalAlpha = (1 - u) * pk; ctx.fillStyle = '#fff6d8'; ctx.fillRect(X + (hash(i + 40) - 0.5) * 200, Y + 20 - u * 380, 3, 3); }
    }
  }
  // falling stars (33%)
  for (const st of DC.stars) {
    ctx.globalCompositeOperation = 'lighter';
    if (st.t < 0.8) { const k = st.t / 0.8, y = st.y - 620 * (1 - k), x = st.x + 260 * (1 - k); ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffe7b0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 70, y - 160); ctx.lineTo(x, y); ctx.stroke(); blit(ctx, glowSprite('#ffd890', 22), x, y); }
    else { const k = (st.t - 0.8) / 0.6; ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffd890'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(st.x, st.y, 20 + k * 90, (20 + k * 90) * 0.5, 0, 0, TAU); ctx.stroke(); blit(ctx, glowSprite('#ffb070', 40), st.x, st.y); }
  }
  if (s === 'lost') { const b = shadowOf(sim); if (b) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 + 0.2 * Math.sin(time * 5); blit(ctx, glowSprite('#9a3cff', 80), b.x, b.y - 20); ctx.globalAlpha = 0.9; for (const sx of [-1, 1]) blit(ctx, glowSprite('#ff2b4e', 12), b.x + sx * 5, b.y - 36); } }
  // the win: the shadow dissolves into stars that stream into you, then wings / halo / aura
  if (s === 'win' && local) {
    const col = (CLASSES[DC.cls] || {}).color || '#ffd23f', hx = local.x, hy = local.y - DC.lift - 30;
    ctx.globalCompositeOperation = 'lighter';
    if (DC.parts) for (const p of DC.parts) { const k = ease(seg(t, p.d, p.d + 1.3)); if (k >= 1) continue; const mx = (p.x + hx) / 2 + p.w, my = Math.min(p.y, hy) - 120; const x = lerp(lerp(p.x, mx, k), lerp(mx, hx, k), k), y = lerp(lerp(p.y, my, k), lerp(my, hy, k), k);
      ctx.globalAlpha = 0.95 * (t > p.d ? 1 : 0.5); ctx.fillStyle = k > 0.6 ? '#ffffff' : '#d9c4ff'; ctx.fillRect(x - 3, y - 3, 6, 6); ctx.globalAlpha = 0.6; blit(ctx, glowSprite(k > 0.6 ? '#ffffff' : '#9a6cff', 16), x, y); }
    if (t > 2.4) {
      const k = ease(seg(t, 2.6, 3.6)); const lg = ctx.createLinearGradient(0, local.y, 0, local.y - 900); lg.addColorStop(0, col); lg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = lg;
      for (const [wd, al] of [[110, 0.12], [70, 0.16], [36, 0.22], [14, 0.4]]) { ctx.globalAlpha = al * k; ctx.fillRect(hx - wd / 2, local.y - 900, wd, 900); } // (a soft column: stacked widths, no hard edge)
      ctx.globalAlpha = 0.7 * k; blit(ctx, glowSprite(col, 70), hx, hy);
      wings(ctx, hx, hy - 8, col, k, time);
      ctx.globalAlpha = k; ctx.strokeStyle = '#fff6c8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(hx, hy - 50, 20, 7, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 0.5 * k; blit(ctx, glowSprite(col, 30), hx, hy - 50);
    }
    if (DC.ascT >= 0) { const k = cl((t - DC.ascT) / 1.1); ctx.globalAlpha = 1 - k; ctx.strokeStyle = col; ctx.lineWidth = 12 * (1 - k) + 2; for (const m of [1, 0.6]) { ctx.beginPath(); ctx.ellipse(local.x, local.y, 40 + k * 380 * m, (40 + k * 380 * m) * 0.5, 0, 0, TAU); ctx.stroke(); }
      for (let i = 0; i < 24; i++) { const a = i * TAU / 24, r = k * 260; ctx.fillStyle = i % 2 ? '#ffffff' : col; ctx.fillRect(local.x + Math.cos(a) * r - 3, hy + Math.sin(a) * r * 0.6 - 3, 6, 6); } }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ screen space
/** the render loop asks for a frame snapshot (the glass shatter) right after the world draw */
export function duelCineSnap(canvas, w, h) {
  if (!DC.snapWant) return; DC.snapWant = false;
  try {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; c.getContext('2d').drawImage(canvas, 0, 0);
    const list = [], cx = w / 2, cy = h / 2, N = 18, R = Math.hypot(w, h);
    for (let i = 0; i < N; i++) { const a0 = i * TAU / N + (hash(i) - 0.5) * 0.2, a1 = (i + 1) * TAU / N + (hash(i + 1) - 0.5) * 0.2, r1 = R * (0.18 + hash(i + 50) * 0.12);
      for (const [ra, rb] of [[0, r1], [r1, R]]) { const pts = [[cx + Math.cos(a0) * ra, cy + Math.sin(a0) * ra], [cx + Math.cos(a0) * rb, cy + Math.sin(a0) * rb], [cx + Math.cos(a1) * rb, cy + Math.sin(a1) * rb], [cx + Math.cos(a1) * ra, cy + Math.sin(a1) * ra]];
        const mx = pts.reduce((s, p) => s + p[0], 0) / 4, my = pts.reduce((s, p) => s + p[1], 0) / 4, d = Math.hypot(mx - cx, my - cy) || 1;
        list.push({ pts: pts.map(([x, y]) => [x - mx, y - my]), ox: mx, oy: my, x: 0, y: 0, vx: (mx - cx) / d * (160 + hash(i * 3) * 300), vy: (my - cy) / d * 200 - 260 - hash(i + 9) * 200, a: 0, va: (hash(i + 21) - 0.5) * 5 }); } }
    DC.shards = { c, list, t: 0, sx: canvas.width / w, sy: canvas.height / h };
  } catch { DC.shards = null; }
}
function voidBg(ctx, w, h, time, k = 1) { // the starfield you fall through: streaks rushing up
  ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = '#05030c'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 90; i++) { const x = hash(i) * w, sp = 0.6 + hash(i + 300) * 1.6, y = h - ((time * 900 * sp + hash(i + 600) * h * 2) % (h * 1.4)), L = 30 + sp * 60; ctx.globalAlpha = k * (0.3 + 0.5 * hash(i + 1)); ctx.fillStyle = i % 5 ? '#bcd0ff' : '#e3c8ff'; ctx.fillRect(x, y, 2, L); }
  ctx.restore();
}
function cracks(ctx, w, h, x0, y0, k, col = '#ffffff') {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.95; const s = Math.max(w, h) / 600;
  for (let i = 0; i < CRACKS.length; i++) { const P = CRACKS[i], n = Math.max(1, Math.floor(P.length * k)); ctx.beginPath(); for (let j = 0; j < n; j++) { const [x, y] = P[j]; j ? ctx.lineTo(x0 + x * s * 1.3, y0 + y * s * 1.3) : ctx.moveTo(x0, y0); } ctx.stroke(); }
  ctx.restore();
}
function bars(ctx, w, h, k) { if (k <= 0) return; const bh = Math.round(h * 0.1 * k); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, bh); ctx.fillRect(0, h - bh, w, bh); }
function title(ctx, w, h, sc, txt, str, sub, col, t, life = 2) {
  const k = cl(t / 0.18), z = lerp(2.4, 1, ease(k)), out = 1 - seg(t, life - 0.45, life); if (out <= 0) return;
  ctx.save(); ctx.globalAlpha = out;
  const bh = 92 * sc; const lg = ctx.createLinearGradient(0, 0, w, 0); lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.5, 'rgba(10,4,22,0.86)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, h * 0.42 - bh / 2, w, bh * 1.35);
  ctx.fillStyle = col; ctx.globalAlpha = out * 0.9; ctx.fillRect(w * 0.5 - w * 0.36 * ease(seg(t, 0.1, 0.5)), h * 0.42 + bh * 0.42, w * 0.72 * ease(seg(t, 0.1, 0.5)), 3 * sc);
  ctx.globalAlpha = out; ctx.translate(w / 2, h * 0.42); ctx.scale(z, z); txt(ctx, str, 0, 0, Math.round(54 * sc), col, 'center', 9); ctx.setTransform(ctx.getTransform());
  ctx.restore();
  if (sub) { ctx.save(); ctx.globalAlpha = out * seg(t, 0.35, 0.7); txt(ctx, sub, w / 2, h * 0.42 + bh * 0.72, Math.round(19 * sc), '#efe6ff', 'center'); ctx.restore(); }
}
function dialogue(ctx, w, h, sc, txt, name, D) {
  const a = cl(D.t / 0.25) * (1 - seg(D.t, D.life - 0.3, D.life)); if (a <= 0) return;
  const bw = Math.min(w * 0.86, 720 * sc), bh = 64 * sc, x = w / 2 - bw / 2, y = h * 0.2;
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(14,6,26,0.86)'; ctx.strokeStyle = '#8a5cff'; ctx.lineWidth = 3 * sc;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, bw, bh, 12 * sc) : ctx.rect(x, y, bw, bh); ctx.fill(); ctx.stroke();
  const n = Math.min(D.text.length, Math.floor(D.t * 48));
  txt(ctx, name, x + 16 * sc, y + 18 * sc, Math.round(14 * sc), '#ff6b86', 'left'); txt(ctx, D.text.slice(0, n), x + 16 * sc, y + 44 * sc, Math.round(18 * sc), '#ffffff', 'left');
  ctx.restore();
}
/** everything screen-space: letterbox, the village dim, cracks + shards, the void, the eyes, the title card, the dialogue
 *  bar, the white flash, ASCENDED + rank, the defeat crack-to-black and the wake. sc = UI scale (phone < 1). */
export function drawDuelHud(ctx, w, h, sc, txt, time) {
  const s = DC.seq, t = DC.t, R = DC.rend; if (!s && !DC.dlg && !DC.shards && !DC.clash && !(DC.swellT > 0)) return;
  const H = heroOf(DC.cls), col = (CLASSES[DC.cls] || {}).color || '#c9b6ff', g = DC.g, local = g && g.player, flashK = vfxPref.reduceFlash ? 0.35 : 1;
  const sp = (x, y) => (R ? R.worldToScreen(x, y) : { x: w / 2, y: h / 2 });
  ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; if (ctx.filter !== undefined) ctx.filter = 'none';
  if (s === 'altar') {
    const a = sp(ALT.x, ALT.y - 40), dk = 0.62 * ease(seg(t, 0.5, 3)); // the village dims: dark everywhere but a hole of light at the Altar
    const rg = ctx.createRadialGradient(a.x, a.y, 40 * sc, a.x, a.y, Math.max(w, h) * 0.55); rg.addColorStop(0, 'rgba(6,3,16,0)'); rg.addColorStop(0.35, `rgba(6,3,16,${dk * 0.6})`); rg.addColorStop(1, `rgba(6,3,16,${dk})`);
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
    if (t > 4.5 && t < 5.2) { ctx.globalAlpha = (1 - seg(t, 4.5, 5.2)) * 0.55 * flashK; ctx.fillStyle = '#fff6dc'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    if (t > 6.6) cracks(ctx, w, h, w / 2, h / 2, seg(t, 6.6, 7.3));
    bars(ctx, w, h, ease(seg(t, 0, 0.8)));
  }
  if (DC.shards || s === 'wait' || (s === 'intro' && t < 1.35)) { // the void behind / after the glass
    voidBg(ctx, w, h, time, s === 'intro' ? 1 - seg(t, 1.2, 1.35) : 1);
    if (local && (s === 'wait' || s === 'intro')) { const k = s === 'intro' ? seg(t, 0, 1.35) : 0; ctx.save(); ctx.translate(w / 2, h * 0.45); const z = (1.2 + 1.8 * k) * sc; ctx.scale(z, z); ctx.rotate(Math.sin(time * 3) * 0.15); drawHero(ctx, { x: 0, y: 0, ang: Math.PI / 2, cls: local.cls, app: local.app || APP, time, scale: 1.2, classic: true, noShadow: true }); ctx.restore(); }
  }
  if (DC.shards) { const S = DC.shards; for (const p of S.list) { ctx.save(); ctx.translate(p.ox + p.x, p.oy + p.y); ctx.rotate(p.a); ctx.beginPath(); p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.save(); ctx.clip(); ctx.rotate(-p.a); ctx.translate(-(p.ox + p.x), -(p.oy + p.y)); ctx.drawImage(S.c, 0, 0, S.c.width, S.c.height, p.x, p.y, w, h); ctx.restore(); ctx.strokeStyle = 'rgba(230,220,255,0.9)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); } }
  if (s === 'wait') bars(ctx, w, h, 1);
  if (s === 'intro') {
    if (t > 1.35 && t < 1.7) { ctx.globalAlpha = (1 - seg(t, 1.35, 1.7)) * 0.8 * flashK; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    const b = shadowOf(g ? g.sim : { enemies: [] });
    if (t > 3.4 && t < 4.6 && b) { // the eyes
      const vk = ease(seg(t, 3.4, 3.7)) * (1 - seg(t, 4.3, 4.6)); ctx.fillStyle = `rgba(0,0,0,${0.55 * vk})`; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter'; const EY = SHADOW_EYES.get(b.id) || heroEyes({ cls: DC.cls, ang: b.face || 0, scale: 1.2, time: 0 }); // (B5: the real eye points of the rig, as the shadow last drew them)
      if (EY && EY.vis > 0) for (const q of EY.pts) { const e = sp(b.x + q.x, b.y + q.y); ctx.globalAlpha = vk * EY.vis; blit(ctx, glowSprite('#ff2b4e', 34), e.x, e.y); blit(ctx, glowSprite('#ff7a90', 14), e.x, e.y); ctx.fillStyle = '#ffe0e6'; ctx.fillRect(e.x - 2, e.y - 1.5, 4, 3); }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (t > 4.4) title(ctx, w, h, sc, txt, `${H.name} — Shadow`, lineOf(DC.cls, 0), '#ff6b86', t - 4.4, 2.1);
    bars(ctx, w, h, 1 - seg(t, 6.0, 6.5));
  }
  if (s === 'win' || s === 'back') {
    const T = s === 'win' ? t : DUEL_CINE_LEN.win + t;
    if (s === 'win' && t < 0.7) { ctx.globalAlpha = (1 - seg(t, 0.05, 0.7)) * flashK; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    if (s === 'win' && t < 1.1) { const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,8,40,0.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h); } // (the slow-mo vignette)
    if (T > 3.5) { const k = seg(T, 3.5, 3.7), out = 1 - seg(T, DUEL_CINE_LEN.win + 2.2, DUEL_CINE_LEN.win + 3);
      ctx.save(); ctx.globalAlpha = out; ctx.translate(w / 2, h * 0.22); const z = lerp(2, 1, ease(k)); ctx.scale(z, z);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = out * 0.6; blit(ctx, glowSprite(col, 120 * sc), 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = out;
      txt(ctx, DC.ok ? 'ASCENDED' : 'SHADOW BANISHED', 0, 0, Math.round(72 * sc), DC.ok ? col : '#c9b6ff', 'center', 10); ctx.restore();
      ctx.save(); ctx.globalAlpha = out * seg(T, 3.9, 4.3); const rw = Math.min(w * 0.8, 520 * sc), ry = h * 0.22 + 48 * sc; ctx.fillStyle = 'rgba(16,8,30,0.88)'; ctx.fillRect(w / 2 - rw / 2, ry - 18 * sc, rw, 36 * sc); ctx.fillStyle = col; ctx.fillRect(w / 2 - rw / 2, ry + 16 * sc, rw, 3 * sc);
      txt(ctx, DC.ok ? `✦ RANK A${DC.rank} · ${H.name}, Ascended ✦` : 'The Altar could not take its price: nothing was spent', w / 2, ry + 6 * sc, Math.round(18 * sc), '#fff6d8', 'center'); ctx.restore(); }
    bars(ctx, w, h, s === 'win' ? 1 : 1 - seg(t, 1.6, DUEL_CINE_LEN.back));
  }
  if (s === 'lost') {
    ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = ease(seg(t, 0, 1)); ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over';
    const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, h * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(10,0,10,${0.45 * ease(seg(t, 0, 1.4))})`); ctx.globalAlpha = 1; ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    if (t > 1.6) cracks(ctx, w, h, w / 2, h * 0.48, seg(t, 1.6, 2.6), '#f0e8ff');
    if (t > 2.5) { ctx.globalAlpha = ease(seg(t, 2.5, 3.3)); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    bars(ctx, w, h, 1);
  }
  if (s === 'wake') {
    ctx.globalAlpha = 1 - ease(seg(t, 0.2, 1.4)); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
    ctx.save(); ctx.globalAlpha = seg(t, 0.3, 0.7) * (1 - seg(t, 2, 2.4)); txt(ctx, 'You wake at the Altar', w / 2, h * 0.36, Math.round(32 * sc), '#e9ddff', 'center', 7); txt(ctx, 'Nothing was lost · face your Shadow again when you are ready', w / 2, h * 0.36 + 32 * sc, Math.round(16 * sc), '#ffffff', 'center'); ctx.restore();
    bars(ctx, w, h, 1 - seg(t, 1, 2.4));
  }
  if (DC.clash && !DC.clash.sent) { // B4: the QTE prompt: a ring closing on the beat; the key (PC) / the button (phone)
    const K = DC.clash, sp2 = SONG.on ? songPos() : -1, d = sp2 >= 0 ? K.T - sp2 : 2 * SM.beatSec - K.rt, k = cl(d / (2 * SM.beatSec)), fl = CLASH_FLAVOR[DC.cls] || ['Clash!', '#ffd23f'];
    const cx = w / 2, cy = h * 0.58, R0 = 46 * sc;
    ctx.save(); ctx.fillStyle = 'rgba(10,4,20,0.35)'; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4 * sc; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = fl[1]; ctx.lineWidth = 6 * sc; ctx.beginPath(); ctx.arc(cx, cy, R0 + 120 * sc * k, 0, TAU); ctx.stroke();
    const mob = g && g.isMobile, key = K.kind === 'mash' ? (mob ? 'MASH' : 'MASH SPACE') : (mob ? 'TAP' : 'SPACE');
    txt(ctx, key, cx, cy + 8 * sc, Math.round(22 * sc), '#ffffff', 'center', 6);
    txt(ctx, K.fin ? 'FINAL CLASH' : fl[0], cx, cy - R0 - 20 * sc, Math.round(26 * sc), fl[1], 'center', 7);
    if (K.kind === 'mash') txt(ctx, `${Math.min(K.n, K.need)} / ${K.need}`, cx, cy + R0 + 28 * sc, Math.round(18 * sc), '#ffe27a', 'center', 5);
    else if (K.ok != null) txt(ctx, K.ok ? 'ON BEAT!' : 'OFF BEAT', cx, cy + R0 + 28 * sc, Math.round(18 * sc), K.ok ? '#9cff7a' : '#ff6b86', 'center', 5);
    ctx.restore();
  }
  if (DC.swellT > 0) { ctx.save(); ctx.globalAlpha = 0.5 * DC.swellT * (vfxPref.reduceFlash ? 0.4 : 1); ctx.fillStyle = DC.swellN >= 2 ? '#ffd890' : '#c9a8ff'; ctx.fillRect(0, 0, w, h); ctx.restore(); DC.swellT = Math.max(0, DC.swellT - 0.03); } // (the on-swell pulse)
  if (DC.dlg) dialogue(ctx, w, h, sc, txt, `Shadow of ${H.name}`, DC.dlg);
  ctx.restore();
}
