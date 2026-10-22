// The launch intro's flow rules (pure, no DOM: shared by client/main.js, client/intro.js, the phone build and the tests).
//   wantIntro(...)   should the intro play on this launch?
//   introPref        Options > 'Play intro on launch' (default on), saved in localStorage
//   skipInput(ev)    is this input a skip? (Esc, Space, Enter, a click / tap, any gamepad button)
//   pickTheme(can)   which file of the theme this browser plays (Opus .ogg, else AAC .m4a)
export const INTRO_PREF_KEY = 'rb.introOnLaunch';
export const THEME = { ogg: '/realm-brawl-web/audio/intro-theme.ogg', m4a: '/realm-brawl-web/audio/intro-theme.m4a' };

export function loadIntroPref(storage) {
  try { const v = storage && storage.getItem(INTRO_PREF_KEY); return v === null || v === undefined ? true : v !== '0'; } catch { return true; }
}
export function saveIntroPref(storage, on) {
  try { if (storage) storage.setItem(INTRO_PREF_KEY, on ? '1' : '0'); } catch { /* private mode */ }
  return !!on;
}
const hasLS = typeof localStorage !== 'undefined';
export const introPref = {
  on: loadIntroPref(hasLS ? localStorage : null),
  set(v) { this.on = saveIntroPref(hasLS ? localStorage : null, v); return this.on; },
};

/**
 * Play the intro on this launch?  ?nointro (or ?notitle: automation that drives the hero list) never; ?intro always;
 * otherwise the Options pref, and never under automation (webdriver) unless asked for with ?intro.
 */
export function wantIntro({ pref = true, params = null, webdriver = false } = {}) {
  const q = params || new URLSearchParams('');
  if (q.has('nointro') || q.has('notitle')) return false;
  if (q.has('intro')) return true;
  if (webdriver) return false;
  return !!pref;
}

const SKIP_CODES = new Set(['Escape', 'Space', 'Enter', 'NumpadEnter']);
/** a keydown / pointerdown / gamepad press that skips the intro (other keys - e.g. volume, F11 - do nothing) */
export function skipInput(ev) {
  if (!ev) return false;
  if (ev.type === 'keydown') return SKIP_CODES.has(ev.code) && !ev.repeat;
  if (ev.type === 'pointerdown' || ev.type === 'mousedown' || ev.type === 'touchstart' || ev.type === 'click') return ev.button === undefined || ev.button === 0 || ev.pointerType === 'touch';
  if (ev.type === 'gamepad') return !!ev.pressed;
  return false;
}
/** gamepad poll: true on the frame any button goes down (prev: the last frame's pressed flags, updated in place) */
export function gamepadEdge(pads, prev) {
  let hit = false;
  for (const gp of pads || []) {
    if (!gp || !gp.buttons) continue;
    const was = prev[gp.index] || [];
    const now = gp.buttons.map((b) => !!(b && (b.pressed || b.value > 0.5)));
    if (now.some((v, i) => v && !was[i])) hit = true;
    prev[gp.index] = now;
  }
  return hit;
}

/** the theme file for this browser: canPlayType = (mime) => '' | 'maybe' | 'probably' */
export function pickTheme(canPlayType) {
  const c = (m) => { try { return canPlayType ? canPlayType(m) : ''; } catch { return ''; } };
  if (c('audio/ogg; codecs="opus"') === 'probably') return THEME.ogg;
  if (c('audio/mp4; codecs="mp4a.40.2"')) return THEME.m4a;
  if (c('audio/ogg; codecs="opus"')) return THEME.ogg;
  return THEME.m4a;
}

/** where the theme loops back to once it ends under the title (the bass entrance: the track's first big section) */
export const loopPoint = (cues) => (cues && cues.hits && cues.hits.bassIn) || 0;
