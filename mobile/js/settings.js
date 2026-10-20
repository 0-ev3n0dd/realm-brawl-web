// Mobile-only persistent state. Separate localStorage namespace from the desktop game
// ("realmbrawl.save"), so a phone that also opens the desktop page never mixes the two.
export const MOBILE_SAVE_KEY = 'realmbrawl.mobile.save';
export const MOBILE_SETTINGS_KEY = 'realmbrawl.mobile.settings';
export const SETTINGS_VERSION = 1;

export const DEFAULT_SETTINGS = {
  sound: true,
  autoAim: true,
  joystick: 'M',      // S | M | L
  chains: 'auto',     // auto (tablets on, phones off) | on | off
  camera: 'normal',   // near | normal | far
  quality: 'auto',    // auto | high | low
  perfOverlay: false, // Options › Performance overlay (fps + frame-time breakdown)
};

export function loadSettings(storage) {
  let s = {};
  try { const raw = JSON.parse(storage.getItem(MOBILE_SETTINGS_KEY) || 'null'); if (raw && raw.version === SETTINGS_VERSION) s = raw.settings || {}; } catch {}
  const out = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (typeof s[k] === typeof DEFAULT_SETTINGS[k]) out[k] = s[k];
  return out;
}
export function saveSettings(storage, settings) {
  try { storage.setItem(MOBILE_SETTINGS_KEY, JSON.stringify({ version: SETTINGS_VERSION, settings })); } catch {}
}
