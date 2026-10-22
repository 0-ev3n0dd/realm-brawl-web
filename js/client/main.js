// Bootstrap: character select <-> game session. Exposes window.__rb for automated playtests.
import './benchmode.js';
import { bootAscTest } from './asctest.js';
import { serializeCharacter } from '../sim/save.js';
import { createSaveStore } from '../sim/save.js';
import { Sim } from '../sim/sim.js';
import { Menu } from './menu.js';
import { ensureHeroes, asHero } from '../sim/heroes.js';
import { Game } from './game.js';
import { NetGame } from './netgame.js';
import { netTestParams } from './net.js';
import { Input } from './input.js';
import { Keybinds } from './keybinds.js';
import { controlMode } from './kbmode.js';
import { KbNav } from './kbnav.js';
import { Options } from './options.js';
import { Audio, bindUiSounds } from './audio.js';
import { menuMusic } from './music.js';
import { Renderer } from './render.js';
import { FX } from './fx.js';
import { setupPhoneLink } from './phone.js';
import { TitleScreen } from './title.js';
import { lastHero, rememberHero, wantTitle, needsAccountName } from './lasthero.js';
import { promptAccountName } from './acctprompt.js';
import { profile } from './rewards.js';
import { migrateHeroUnlocks, isUnlocked, needsStarter } from '../sim/heroUnlock.js';
import { showStarterSelect } from './starterpick.js';
import { IntroPlayer, Theme, introWorld } from './intro.js';
import { wantIntro, introPref } from './introflow.js';

const canvas = document.getElementById('game');
bootAscTest(); // (the Ascension Test save: seeded on first entry, before the save is read)
const heroFold = ensureHeroes(window.localStorage); // 2026-10-07: the save becomes the ten-hero roster (once; sim/heroes.js)
if (heroFold) console.info('heroes: save folded into the roster', heroFold);
const store = createSaveStore(window.localStorage);
// hero unlocks (2026-10-15): the account's per-hero unlock record (sim/heroUnlock.js); old saves keep every played hero
try { const pr0 = profile.load(); migrateHeroUnlocks(pr0, store.list()); profile.save(); } catch (e) { console.warn('hero unlocks', e); }
const heroOk = (cls) => { try { return isUnlocked(profile.load(), cls); } catch { return true; } };
window.__heroOk = heroOk;
const audio = new Audio();
bindUiSounds(audio);
const keybinds = new Keybinds(window.localStorage, controlMode.value); // rebindable controls (Options menu), saved in localStorage; one profile per Control mode (kbmode.js)
const input = new Input(canvas, keybinds);
const options = new Options(keybinds, input);
const kbnav = new KbNav({ capturing: () => !!input.capture }); // arrows / Enter / Delete in the menus (Keyboard-only mode; kbnav.js)
options.audio = audio; // (Options > Feel & audio: the music / SFX sliders)
// key labels shown in the DOM (title-screen controls line, loot "Take all (G)")
function refreshKeyLabels() {
  const L = (id) => keybinds.label(id);
  const foot = document.getElementById('menuFoot');
  if (foot) foot.textContent = `${L('up')}${L('left')}${L('down')}${L('right')} move · Mouse aim · ${L('attack')} combo · ${['skillQ', 'skillE', 'skillR', 'skillF'].map(L).join(' ')} skills · ${L('special')} SPECIAL · ${L('dodge')} dodge · ${L('ult')} ultimate · ${L('inventory')} inventory · ${L('combos')} combos · ${L('realmMap')} world map · ${L('chat')} chat (co-op) · Esc menu`;
  document.querySelectorAll('[data-keylabel]').forEach((el) => { el.textContent = L(el.dataset.keylabel); });
}
keybinds.onChange(refreshKeyLabels);
refreshKeyLabels();
document.getElementById('menuOptionsBtn').onclick = () => options.open();
addEventListener('pointerdown', () => audio.ensure(), { capture: true });
addEventListener('keydown', () => audio.ensure(), { capture: true });

// scenic backdrop behind the menu: the real world, slowly panning
const bg = { sim: null, r: null, fx: new FX(), t: 0, on: true };
function backdrop(now) {
  if (!bg.on) return;
  if (!bg.sim) { bg.sim = new Sim({ seed: 1 }); bg.r = new Renderer(canvas); bg.r.resize(); addEventListener('resize', () => bg.r && bg.r.resize()); }
  bg.t += 1 / 60;
  bg.r.time = bg.t;
  bg.r.cam.x = Math.cos(bg.t * 0.03) * 520; bg.r.cam.y = Math.sin(bg.t * 0.03) * 520;
  bg.r.draw(bg.sim, { id: -1, x: 1e9, y: 1e9 }, 1, bg.fx, null);
  requestAnimationFrame(backdrop);
}

let game = null;
let joining = false;
const $ = (id) => document.getElementById(id);
function showMenu() { if (!bg.on) { bg.on = true; requestAnimationFrame(backdrop); } menu.show(); }
/** leaving a game: back to the title (the hero just played), or the hero list when there is none */
function backToMenu(message) {
  menuMusic(audio);
  game = null;
  const h = lastHero(store, localStorage, heroOk);
  if (h && title.show(h, message || null)) { bg.on = false; menu.hide(); return; }
  showMenu();
  if (message) menu.showError(message);
}
const menu = new Menu({
  store,
  keyLabel: (id) => keybinds.label(id),
  onPlay(char, mode, opts = {}) {
    if (char && store.heroes()) char = asHero(char); // (the roster name + look, sim/heroes.js)
    rememberHero(localStorage, char); // the title screen shows this hero next launch
    theme.stop(1.5); // (the intro theme fades out under the zone music)
    const fromTitle = title.visible;
    if (mode === 'coop') {
      if (joining) return;
      joining = true;
      const msg = `Connecting ${char.name} to ${location.host}...`;
      if (fromTitle) title.setBusy(true, msg); else { $('connecting').classList.remove('hidden'); $('connectingMsg').textContent = msg; }
      menuMusic(audio, false); const g = new NetGame({ canvas, char, store, audio, input, options, onQuit: backToMenu, ...netTestParams() });
      g.start().then(() => {
        bg.on = false; game = g; menu.hide(); title.hide(); // (everyone starts in Brightwater Village; the host picks missions at the counter)
      }).catch((e) => {
        if (fromTitle && title.visible) { title.setBusy(false); title.msg(e.message || String(e), true); } else menu.showError(e.message || String(e));
      }).finally(() => { joining = false; $('connecting').classList.add('hidden'); if (title.visible && title.busy) title.setBusy(false); });
      return;
    }
    title.hide();
    menu.hide();
    bg.on = false;
    menuMusic(audio, false); game = new Game({ canvas, char, store, audio, input, options, onQuit: () => backToMenu() }); // starts in Brightwater Village
    void opts;
  },
});
keybinds.onChange(() => menu.refresh()); // class info shows the current skill keys
// step 2: the title screen (last-played hero) on launch; first-timers (no hero) go straight to hero creation
const title = new TitleScreen({
  store, storage: localStorage, menu, options, keyLabel: (id) => keybinds.label(id),
  onStart: (ch) => menu.play(ch),
  onHeroList: () => { title.hide(); showMenu(); },
  onWatchIntro: () => watchIntro(),
});
{
  const back = document.createElement('button'); back.className = 'btn small ghost menu-back'; back.id = 'menuBackTitle'; back.textContent = '◀ Title';
  back.onclick = () => { const h = lastHero(store, localStorage, heroOk); if (h && title.show(h)) { menu.hide(); bg.on = false; } };
  $('menu').appendChild(back);
  const sync = () => back.classList.toggle('hidden', !lastHero(store, localStorage, heroOk)); sync(); setInterval(sync, 1500);
}
// the launch intro (client/intro.js): plays before the title (Options > 'Play intro on launch'; ?nointro skips it,
// ?intro forces it, automation skips it). Its theme keeps playing under the title / hero list until a game starts.
const params = new URLSearchParams(location.search);
const theme = new Theme();
let intro = null;
const launchHero = lastHero(store, localStorage, heroOk);
/** the start screen: the title (last-played hero) or the hero list */
function showStart() {
  menuMusic(audio); // (the main theme on the title / menus)
  const h = lastHero(store, localStorage, heroOk);
  if (wantTitle({ hero: h, webdriver: !!navigator.webdriver, params })) { menu.hide(); bg.on = false; title.show(h); }
  else showMenu();
  maybeAccountName();
}
/** account names: ask once (first launch / older saves without one). Automation skips it unless ?acctprompt. */
function maybeAccountName() {
  if (!needsAccountName(localStorage) || (navigator.webdriver && !params.has('acctprompt'))) return maybeStarter();
  promptAccountName({ onSaved: () => { try { if (title.visible) title.renderProfile(); } catch { /* */ } } }).then(() => maybeStarter());
}
/** first account: after the name, pick a starter (Brakka / Sylva / Orin); then the title shows that hero */
function maybeStarter() {
  let pr; try { pr = profile.load(); } catch { return; }
  if (!needsStarter(pr) || (navigator.webdriver && !params.has('starterpick'))) return;
  title.hide(); menu.hide();
  showStarterSelect({ storage: localStorage, store, isMobile: document.body.classList.contains('rb-mobile') || /\/mobile\//.test(location.pathname), onPicked: (ch) => { rememberHero(localStorage, ch); if (!title.show(ch)) showMenu(); } });
}
/** play the intro; launch = on page load (the boot screen is still up: it becomes the 'click to start' gate if the
 *  browser blocks autoplay). From the title / Options (a click: autoplay is allowed) it just plays. */
function playIntro(launch) {
  menuMusic(audio, false);
  if (intro || game) return false;
  const capture = params.has('introcapture'); // (tools/intro-media.mjs: frames on a virtual clock, no audio)
  try { introWorld(); } catch (e) { console.warn('intro', e); return false; }
  menu.hide(); title.hide(); bg.on = false;
  const boot = () => { if (window.__boot) window.__boot.done(); };
  const begin = (music) => {
    if (intro || game) return;
    intro = new IntroPlayer({ theme: music ? theme : null, audio, capture, onDone: () => { intro = null; showStart(); } }).start();
    boot();
  };
  if (capture) { begin(false); return true; }
  theme.muted = audio.muted;
  theme.load().then((ok) => {
    if (!ok) return begin(false); // (no theme: the intro still plays, silent, on the wall clock)
    theme.play(0).then((playing) => {
      if (playing) return begin(true);
      // autoplay blocked (no gesture yet): the themed loading screen asks for one click / key, which starts the music
      if (launch && window.__boot && window.__boot.gate) window.__boot.gate('Click or press any key to start', () => { theme.play(0); begin(true); });
      else begin(false);
    });
  });
  return true;
}
function watchIntro() { if (options.isOpen()) options.close(); return playIntro(false); }
options.onWatchIntro = () => watchIntro();
options.canWatchIntro = () => !game && !intro;
const introOnLaunch = wantIntro({ pref: introPref.on, params, webdriver: !!navigator.webdriver });
if (introOnLaunch) { menu.hide(); bg.on = false; if (!playIntro(true)) showStart(); }
else if (wantTitle({ hero: launchHero, webdriver: !!navigator.webdriver, params })) { menu.hide(); bg.on = false; title.show(launchHero); }
else requestAnimationFrame(backdrop);
if (!introOnLaunch) maybeAccountName();
setupPhoneLink();

window.__rb = { store, menu, title, keybinds, options, input, kbnav, controlMode, theme, get intro() { return intro; }, playIntro: (launch = false) => playIntro(launch), get game() { return game; }, set game(v) {} };
/** the village Co-op Board: leave solo for the server's co-op world (or back), keeping the hero (saved first) */
window.__rb.switchMode = (mode) => {
  const g = game; if (!g || !g.player || joining) return false;
  const ch = serializeCharacter(g.player);
  g.onQuit = null; g.quit(); backToMenu();
  menu.onPlay(ch, mode === 'coop' ? 'coop' : 'solo');
  return true;
};

// loading-screen pass: the start screen (title / hero list / creation) is drawn underneath: fade the inline boot screen out
// (the intro fades it itself once it starts - or turns it into the 'click to start' gate)
if (!introOnLaunch) requestAnimationFrame(() => requestAnimationFrame(() => { if (window.__boot) window.__boot.done(); }));
