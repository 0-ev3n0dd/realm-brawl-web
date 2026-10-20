// Account reset (2026-10-15): Options > Account & Online > Reset account. Two steps (a warning, then type the account
// name or RESET), then every account key in this browser is wiped - PC and phone share the origin, so both go - while
// device prefs (graphics, audio, controls, keybinds, phone settings, intro) stay. The page then reloads into the account
// name prompt and the starter screen. Not offered during a co-op session.
export const ACCOUNT_KEYS = [
  'realmbrawl.save', 'realmbrawl.profile', 'realmbrawl.stash', 'realmbrawl.unlocks', 'realmbrawl.lastHero',
  'realmbrawl.profileName', 'realmbrawl.net.tokens', 'realmbrawl.mode',
  'realmbrawl.mobile.save', 'realmbrawl.mobile.unlocks',
];
/** device prefs that survive (documented for the test; everything not in ACCOUNT_KEYS stays anyway) */
export const KEEP_KEYS = ['rb.audio', 'rb.gl', 'rb.feel', 'rb.controlMode', 'rb.heroArt', 'rb.introOnLaunch', 'realmbrawl.keybinds.v1', 'realmbrawl.keybinds.kb.v1', 'realmbrawl.quality', 'realmbrawl.mobile.settings'];
const isAcct = (k) => ACCOUNT_KEYS.includes(k);
/** wipe (pure on storage); returns the keys removed. Afterwards a latch drops late autosaves (pagehide / unload) of
 *  account keys until the reload, so a running game can't write the old hero back. */
export function resetAccount(storage = localStorage, latch = true) {
  const gone = [];
  for (const k of ACCOUNT_KEYS) if (storage.getItem(k) !== null) { storage.removeItem(k); gone.push(k); }
  if (latch && typeof Storage !== 'undefined' && !Storage.prototype.__rbLatch) {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (isAcct(k)) return; return set.call(this, k, v); };
    Storage.prototype.__rbLatch = true;
  }
  return gone;
}
/** the typed confirmation: the account name (case-insensitive) or RESET */
export const confirmOk = (typed, name) => { const t = String(typed || '').trim(); return t === 'RESET' || (!!name && t.toLowerCase() === String(name).trim().toLowerCase()); };

const CSS = `#acctReset{position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;background:rgba(20,4,8,.7);font-family:'Lilita One',sans-serif}
#acctReset .ar-box{width:min(460px,92vw);background:linear-gradient(#4a2230,#2a1220);border:4px solid #1a0a10;border-radius:16px;box-shadow:0 0 0 3px #e84c3d inset,0 18px 50px rgba(0,0,0,.6);padding:22px 24px;color:#fff4dc;text-align:center}
#acctReset h2{margin:0 0 6px;font-size:28px;color:#ff6b5b;text-shadow:0 3px 0 #1a0a10}
#acctReset p,#acctReset li{font-family:system-ui,sans-serif;font-size:14px;opacity:.9;text-align:left}
#acctReset ul{margin:6px 0 10px 18px;padding:0}
#acctReset input{width:100%;box-sizing:border-box;font:inherit;font-size:22px;padding:10px;border-radius:10px;border:3px solid #1a0a10;background:#fff4dc;color:#2a1220;text-align:center;outline:none}
#acctReset .ar-row{display:flex;gap:10px;justify-content:center;margin-top:14px}
#acctReset button{font:inherit;font-size:19px;padding:8px 20px;border-radius:10px;border:3px solid #1a0a10;cursor:pointer;background:#6b5a86;color:#fff4dc}
#acctReset button.ar-go{background:#e84c3d;color:#fff;box-shadow:0 4px 0 #9e2a1f}
#acctReset button:disabled{opacity:.45;cursor:default;box-shadow:none}`;
/** the two-step dialog. name = the account name; onWipe() runs after the wipe (default: reload the page) */
export function showAccountReset({ name = '', storage = localStorage, onWipe = null } = {}) {
  if (document.getElementById('acctReset')) return;
  if (!document.getElementById('acctResetCss')) { const st = document.createElement('style'); st.id = 'acctResetCss'; st.textContent = CSS; document.head.appendChild(st); }
  const el = document.createElement('div'); el.id = 'acctReset'; document.body.appendChild(el);
  const close = () => el.remove();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const step1 = () => {
    el.innerHTML = `<div class="ar-box" role="alertdialog" aria-modal="true"><h2>⚠ Reset account?</h2>
      <p>This permanently deletes ${name ? `<b>${esc(name)}</b>'s` : 'this'} account on this device (PC and phone):</p>
      <ul><li>every hero, their level, gear and progress</li><li>hero unlocks, mastery and account level</li><li>stash, collection, weekly board and gate unlocks</li></ul>
      <p>Graphics, audio and control settings are kept. This cannot be undone.</p>
      <div class="ar-row"><button id="arX">Cancel</button><button class="ar-go" id="arNext">Continue…</button></div></div>`;
    el.querySelector('#arX').onclick = close; el.querySelector('#arNext').onclick = step2;
  };
  const step2 = () => {
    el.innerHTML = `<div class="ar-box" role="alertdialog" aria-modal="true"><h2>Final confirmation</h2>
      <p>Type ${name ? `your account name <b>${esc(name)}</b> or ` : ''}<b>RESET</b> to delete everything.</p>
      <input id="arIn" spellcheck="false" autocomplete="off" placeholder="${name ? esc(name) + ' or ' : ''}RESET">
      <div class="ar-row"><button id="arX">Cancel</button><button class="ar-go" id="arGo" disabled>Reset account</button></div></div>`;
    const inp = el.querySelector('#arIn'), go = el.querySelector('#arGo');
    inp.oninput = () => { go.disabled = !confirmOk(inp.value, name); };
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' && !go.disabled) go.click(); if (e.key === 'Escape') close(); };
    el.querySelector('#arX').onclick = close;
    go.onclick = () => { if (!confirmOk(inp.value, name)) return; resetAccount(storage); close(); if (onWipe) onWipe(); else location.reload(); };
    setTimeout(() => inp.focus(), 30);
  };
  step1();
}
