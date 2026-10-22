// Realm Brawl Mobile bootstrap: hero menu <-> solo game, settings, fullscreen/orientation,
// portrait hint, service worker (offline + update prompt). Loads no co-op/network code.
import '../../js/client/benchmode.js';
import { bootAscTest } from '../../js/client/asctest.js';
import { createSaveStore } from '../../js/sim/save.js';
import { ensureHeroes, asHero } from '../../js/sim/heroes.js';
import { Sim } from '../../js/sim/sim.js';
import { Audio, bindUiSounds } from '../../js/client/audio.js';
import { menuMusic } from '../../js/client/music.js';
import { MobileRenderer, MobileFX } from './mrender.js';
import { MobileMenu } from './mmenu.js';
import { MobileGame } from './mgame.js';
import { MOBILE_SAVE_KEY, loadSettings, saveSettings } from './settings.js';
import { wantIntro, introPref } from '../../js/client/introflow.js';
import { profile } from '../../js/client/rewards.js';
import { migrateHeroUnlocks, needsStarter } from '../../js/sim/heroUnlock.js';
import { needsAccountName } from '../../js/client/lasthero.js';
import { promptAccountName } from '../../js/client/acctprompt.js';
import { showStarterSelect } from '../../js/client/starterpick.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
bootAscTest(); // (the Ascension Test save)
ensureHeroes(window.localStorage, MOBILE_SAVE_KEY); // 2026-10-07: the ten-hero roster (sim/heroes.js; once)
const store = createSaveStore(window.localStorage, MOBILE_SAVE_KEY);
const settings = loadSettings(window.localStorage);
try { migrateHeroUnlocks(profile.load(), store.list()); profile.save(); } catch (e) { console.warn('hero unlocks', e); } // (hero unlocks, sim/heroUnlock.js)
const audio = new Audio();
bindUiSounds(audio);
audio.muted = !settings.sound;
const standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;

// ---- no browser gestures: scroll, pinch/double-tap zoom, long-press menus, text selection
const inScroll = (el) => el && el.closest && el.closest('.scroll, #hub, #village, #progress, #rewards, .rm-wrap, #missionBoard, #opsCard, #storyCard, #dialogue, .sheet-wrap'); // (parity pass: the PC panels scroll by touch)
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || !inScroll(e.target)) e.preventDefault(); }, { passive: false });
for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu', 'selectstart']) {
  document.addEventListener(ev, (e) => { if (ev === 'selectstart' && e.target && e.target.tagName === 'INPUT') return; e.preventDefault(); }, { passive: false });
}
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - lastTouchEnd < 300 && e.target && e.target.tagName === 'CANVAS') e.preventDefault(); lastTouchEnd = now; }, { passive: false }); // (double-tap zoom guard on the game canvas only: quick taps on panel buttons / NPC prompts must click)

// ---- safe-area insets (notch) as numbers for the canvas HUD
function safeInsets() {
  const cs = getComputedStyle($('safeProbe'));
  const n = (v) => parseFloat(v) || 0;
  return { t: n(cs.paddingTop), r: n(cs.paddingRight), b: n(cs.paddingBottom), l: n(cs.paddingLeft) };
}

// ---- first tap: audio unlock + fullscreen + landscape lock (where the browser allows it)
let triedFs = false;
function firstGesture() {
  audio.ensure();
  if (triedFs || standalone) return;
  triedFs = true;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || document.fullscreenElement) return;
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.then) p.then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch {} }).catch(() => {});
  } catch {}
}
addEventListener('touchend', firstGesture, { capture: true, passive: true });
addEventListener('click', firstGesture, { capture: true });
addEventListener('touchstart', () => audio.ensure(), { capture: true, passive: true });

// ---- portrait hint
let portraitOk = false;
function checkOrientation() {
  const portrait = innerHeight > innerWidth * 1.05;
  $('rotate').classList.toggle('hidden', !portrait || portraitOk);
}
$('rotateAnyway').onclick = () => { portraitOk = true; checkOrientation(); };
addEventListener('resize', checkOrientation);
addEventListener('orientationchange', () => setTimeout(checkOrientation, 200));
checkOrientation();

// ---- scenic backdrop behind the menu
const bg = { sim: null, r: null, fx: new MobileFX(), t: 0, on: true };
function backdrop() {
  if (!bg.on) return;
  if (!bg.sim) { bg.sim = new Sim({ seed: 1 }); bg.r = new MobileRenderer(canvas, { quality: 1 }); bg.r.resize(); addEventListener('resize', () => bg.r && bg.on && bg.r.resize()); }
  bg.t += 1 / 60;
  bg.r.time = bg.t;
  bg.r.cam.x = Math.cos(bg.t * 0.03) * 520; bg.r.cam.y = Math.sin(bg.t * 0.03) * 520;
  if (!document.hidden) bg.r.draw(bg.sim, { id: -1, x: 1e9, y: 1e9 }, 1, bg.fx, null);
  requestAnimationFrame(backdrop);
}

// ---- settings (pause menu, also opened from the hero list)
function renderSettings() {
  document.querySelectorAll('.seg').forEach((seg) => {
    const key = seg.dataset.set;
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(settings[key]) === b.dataset.v));
  });
}
document.querySelectorAll('.seg').forEach((seg) => {
  seg.querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      const key = seg.dataset.set, v = b.dataset.v;
      settings[key] = v === 'true' ? true : v === 'false' ? false : v;
      saveSettings(localStorage, settings);
      audio.muted = !settings.sound;
      renderSettings();
      if (game) game.applySettings();
    };
  });
});
renderSettings();

let game = null;
function openMenuSettings() {
  $('pause').classList.remove('hidden');
  $('pauseTitle').textContent = 'Settings';
}
$('setDone').onclick = () => { $('pause').classList.add('hidden'); audio.ensure(); };

function backToMenu() {
  game = null;
  if (!bg.on) { bg.on = true; if (bg.r) bg.r.resize(); requestAnimationFrame(backdrop); }
  menu.show();
  firstRun();
}
/** phone parity: the account name prompt, then the starter selection (a new account), as on PC */
const fparams = new URLSearchParams(location.search);
function firstRun() {
  menuMusic(audio);
  const auto = navigator.webdriver;
  const starter = () => { let pr; try { pr = profile.load(); } catch { return; } if (!needsStarter(pr) || (auto && !fparams.has('starterpick'))) return; menu.hide(); showStarterSelect({ storage: localStorage, store, isMobile: true, onPicked: (ch) => { menu.pick = ch && ch.cls; menu.show(); } }); };
  if (needsAccountName(localStorage) && !(auto && !fparams.has('acctprompt'))) promptAccountName({}).then(starter); else starter();
}
const menu = new MobileMenu({
  store,
  onSettings: openMenuSettings,
  onPlay(char, opts = {}) {
    if (!char) return;
    char = asHero(char); // (the roster name + look, sim/heroes.js)
    menu.hide();
    bg.on = false;
    if (window.__rbm.theme) window.__rbm.theme.stop(1.5); // (the intro theme fades out under the zone music)
    menuMusic(audio, false); game = new MobileGame({ canvas, char, store, audio, settings, safe: safeInsets, onQuit: backToMenu });
    void opts; // (the game starts in Brightwater Village: missions are picked at the Mission Counter)
  },
});
requestAnimationFrame(backdrop);

// ---- install hint (iOS has no install prompt; Android Chrome shows its own)
if (!standalone) {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  $('installHint').textContent = ios ? 'Tip: tap the Share button in Safari, then "Add to Home Screen" to install it as an app (full screen, works offline).'
    : 'Tip: open the browser menu (⋮) and choose "Add to Home screen" / "Install app" to play full screen and offline.';
  $('installHint').classList.remove('hidden');
}

// ---- service worker: offline cache + "update available" prompt
const swState = { registered: false, version: null, updateShown: false };
let updateRequested = false;
function showUpdate(worker) {
  swState.updateShown = true;
  const el = $('update');
  el.classList.remove('hidden');
  el.onclick = () => { updateRequested = true; if (game) game.save(); el.textContent = 'Updating...'; worker.postMessage({ type: 'SKIP_WAITING' }); };
}
if ('serviceWorker' in navigator && (window.isSecureContext || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
    swState.registered = true;
    const watch = (w) => w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w); });
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    watch(reg.installing);
    reg.addEventListener('updatefound', () => watch(reg.installing));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    swState.reg = reg;
  }).catch((e) => console.warn('service worker not registered:', e && e.message));
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updateRequested) location.reload(); });
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'VERSION') { swState.version = e.data.version; $('verInfo').textContent = 'Version ' + e.data.version + ' · ' + (standalone ? 'installed app' : 'browser'); } });
  navigator.serviceWorker.ready.then((r) => r.active && r.active.postMessage({ type: 'GET_VERSION' })).catch(() => {});
}

// ---- the launch intro (client/intro.js, loaded on demand): a tap starts it with its music, any tap skips it
let intro = null;
const introParams = new URLSearchParams(location.search);
const introOn = wantIntro({ pref: introPref.on, params: introParams, webdriver: !!navigator.webdriver });
function playIntro(launch) {
  if (intro || game) return;
  bg.on = false; menu.hide();
  menuMusic(audio, false);
  import('../../js/client/intro.js').then(({ IntroPlayer, Theme, introWorld }) => {
    introWorld();
    const theme = window.__rbm.theme = window.__rbm.theme || new Theme();
    theme.muted = !settings.sound;
    const begin = (music) => {
      if (intro || game) return;
      intro = new IntroPlayer({ theme: music ? theme : null, audio, mobile: true, onDone: () => { intro = null; backToMenu(); } }).start();
      if (window.__boot) window.__boot.done();
    };
    theme.load().then((ok) => {
      if (!ok) return begin(false);
      theme.play(0).then((playing) => {
        if (playing) return begin(true);
        if (launch && window.__boot && window.__boot.gate) window.__boot.gate('Tap to start', () => { theme.play(0); begin(true); });
        else begin(false);
      });
    });
  }).catch((e) => { console.warn('intro', e); intro = null; backToMenu(); if (window.__boot) window.__boot.done(); });
}

window.__rbm = { store, menu, settings, swState, safeInsets, get game() { return game; }, get intro() { return intro; }, playIntro: () => playIntro(false), theme: null };
if (introOn) playIntro(true);

// loading-screen pass: the start screen (title / hero list / creation) is drawn underneath: fade the inline boot screen out
if (!introOn) requestAnimationFrame(() => requestAnimationFrame(() => { if (window.__boot) window.__boot.done(); }));
if (!introOn) firstRun();
