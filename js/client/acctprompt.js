// Account name prompt (2026-10-15): first launch, and older saves that never picked a valid name.
// A small modal over the title / hero list; also reused by Options > Account (rename).
import { validateAccountName, ACCT_MIN, ACCT_MAX } from '../sim/acctname.js';
import { accountName, setAccountName } from './lasthero.js';
import { profile } from './rewards.js';

const CSS = `#acctPrompt{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(10,6,20,.62);font-family:'Lilita One',sans-serif}
#acctPrompt .ap-box{width:min(420px,92vw);background:linear-gradient(#3a2d52,#251b38);border:4px solid #1a1226;border-radius:16px;box-shadow:0 0 0 3px #ffd23f inset,0 18px 50px rgba(0,0,0,.6);padding:22px 24px;color:#fff4dc;text-align:center}
#acctPrompt h2{margin:0 0 4px;font-size:28px;color:#ffd23f;letter-spacing:.5px;text-shadow:0 3px 0 #1a1226}
#acctPrompt p{margin:0 0 14px;font-family:system-ui,sans-serif;font-size:14px;opacity:.85}
#acctPrompt.ap-first{background:#000}
#acctPrompt input{width:100%;box-sizing:border-box;font:inherit;font-size:22px;padding:10px 12px;border-radius:10px;border:3px solid #1a1226;background:#fff4dc;color:#251b38;text-align:center;outline:none}
#acctPrompt input:focus{box-shadow:0 0 0 3px #ffd23f}
#acctPrompt .ap-err{min-height:18px;margin:8px 0 2px;font-family:system-ui,sans-serif;font-size:13px;color:#ff8a80}
#acctPrompt .ap-ex{font-family:system-ui,sans-serif;font-size:12px;opacity:.7;margin-top:2px}
#acctPrompt .ap-row{display:flex;gap:10px;justify-content:center;margin-top:12px}
#acctPrompt button{font:inherit;font-size:19px;padding:8px 22px;border-radius:10px;border:3px solid #1a1226;background:#ffd23f;color:#251b38;cursor:pointer}
#acctPrompt button.ap-x{background:#6b5a86;color:#fff4dc}
#acctPrompt button:disabled{opacity:.5;cursor:default}`;

let open = null;
export const accountPromptOpen = () => !!open;
/** show the prompt; resolves with the saved name (or null when cancelled: only allowed when a name already exists) */
export function promptAccountName({ storage = localStorage, rename = false, heroTitle = '', onSaved = null } = {}) {
  if (open) return open.p;
  if (!document.getElementById('acctPromptCss')) { const st = document.createElement('style'); st.id = 'acctPromptCss'; st.textContent = CSS; document.head.appendChild(st); }
  const cur = accountName(storage), el = document.createElement('div'); el.id = 'acctPrompt'; if (!rename) el.className = 'ap-first'; // (first launch / after a reset: solid black, the title stays hidden)
  el.innerHTML = `<div class="ap-box" role="dialog" aria-modal="true" aria-labelledby="apT">
    <h2 id="apT">${rename ? 'Change Account Name' : 'Choose Your Name'}</h2>
    <p>${rename ? 'Shown to other players on nameplates, the party list and chat.' : 'This is <b>your</b> name across every hero: nameplates, the party list and chat. Your hero keeps their own name as a subtitle.'}</p>
    <input id="apIn" maxlength="${ACCT_MAX}" spellcheck="false" autocomplete="nickname" placeholder="Your name" value="">
    <div class="ap-err" id="apErr"></div>
    <div class="ap-ex" id="apEx"></div>
    <div class="ap-row">${cur ? '<button class="ap-x" id="apX">Cancel</button>' : ''}<button id="apOk">Save</button></div></div>`;
  document.body.appendChild(el);
  const $ = (id) => el.querySelector('#' + id), inp = $('apIn');
  inp.value = cur;
  let resolve; const p = new Promise((r) => { resolve = r; });
  const check = () => { const v = validateAccountName(inp.value); const blank = !inp.value.trim();
    $('apErr').textContent = blank ? '' : v.err; $('apOk').disabled = !v.ok;
    $('apEx').textContent = v.ok ? `Others will see: ${v.name}${heroTitle ? ' - ' + heroTitle : ''}` : `${ACCT_MIN}-${ACCT_MAX} characters: letters, numbers, spaces, _ and -`; return v; };
  const close = (val) => { el.remove(); open = null; resolve(val); };
  const save = () => { const v = check(); if (!v.ok) return; const r = setAccountName(storage, v.name, profile); if (!r.ok) return; try { profile.load(); profile.data.acctName = r.name; profile.save(); } catch { /* */ } if (onSaved) onSaved(r.name); close(r.name); };
  inp.oninput = check;
  el.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); save(); } else if (e.key === 'Escape' && cur) close(null); }, true);
  el.addEventListener('keyup', (e) => e.stopPropagation(), true);
  $('apOk').onclick = save; if ($('apX')) $('apX').onclick = () => close(null);
  check(); setTimeout(() => { inp.focus(); inp.select(); }, 30);
  open = { p, el }; return p;
}
