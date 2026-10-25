// Keyboard navigation for the desktop menus (2026-10-06, for the Keyboard-only control mode; harmless with a mouse too).
// While a menu overlay is up (Options, the menu hub - Character / inventory, Stash, Forge, Map, Chains... -, the village
// services, Collection / Forge, the Realm Gate map, the Mission Counter, Pause), the arrow keys move a gold focus ring
// between its buttons / slots / tabs (spatial: the nearest one in that direction), Enter (or Space once something is
// focused) clicks it - equip from the bag, move to the stash, toggle a checkbox, pick a tab -, Delete / Backspace is the
// right-click (drop / salvage / save), and the focused item shows its tooltip like a hover. Esc keeps closing things
// (each panel's own handler); Q / E keep cycling the hub's tabs. Off while Options waits for a key to bind.
// pickDir() is pure (tests); KbNav is the DOM side.

export const NAV_ROOTS = ['#options', '#hub', '#village', '#progress', '#realmMap', '#missionBoard', '#opsCard', '#pause'];
export const NAV_SEL = 'button:not([disabled]), .slot, [data-hubtab], [data-btab], [data-stab], [data-ssub], [data-msub], [data-ccls], [data-pin], [data-focus], [data-mode], [data-undo], [data-tab], input[type=checkbox], input[type=range], select, a[href], [role=button], [tabindex]:not([tabindex="-1"])';
const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

/**
 * The best candidate in a direction: cands / cur are rect centres {x, y} (optionally with the rect's half extents hw / hh);
 * dir [dx, dy] (unit axis). Candidates must lie ahead (more than 4 px along the axis). Ones in the current item's "beam"
 * (their extent overlaps it across the axis: the cell below, the button under a tab) win outright, nearest first;
 * (ones flagged `same` - in the scrolled list the current item is in - first), otherwise the nearest inside a ~63 degree
 * cone by distance with the off-axis part weighted 1.5x. Returns the index or -1.
 */
export function pickDir(cands, cur, dir) {
  let best = -1, bs = Infinity;
  const cw = (dir[0] ? cur.hh : cur.hw) || 0;
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i], dx = c.x - cur.x, dy = c.y - cur.y;
    const along = dx * dir[0] + dy * dir[1];
    if (along <= 4) continue;
    const perp = Math.abs(dx * dir[1] - dy * dir[0]), ext = (dir[0] ? c.hh : c.hw) || 0;
    const inBeam = perp < cw + ext - 2 || perp < 1;
    if (!inBeam && perp > along * 2) continue; // (outside a ~63 degree cone: Right from the last gear slot is not the close button up in the corner)
    const s = inBeam ? along + perp * 0.25 - (c.same ? 5e4 : 0) : 1e5 + Math.hypot(along, perp * 1.5);
    if (s < bs) { bs = s; best = i; }
  }
  return best;
}
/** The first item of a list of rect centres in reading order (top row first, then left). */
export function firstIndex(cands) { let b = -1, bs = Infinity; for (let i = 0; i < cands.length; i++) { const s = Math.round(cands[i].y / 24) * 1e5 + cands[i].x; if (s < bs) { bs = s; b = i; } } return b; }

const CSS = `.kbfocus{outline:3px solid #ffd23f !important;outline-offset:2px;box-shadow:0 0 0 6px rgba(255,210,63,.33),0 0 18px rgba(255,210,63,.55) !important;position:relative;z-index:3}`;
const visible = (el) => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; if (el.closest('.hidden')) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0; };
const centre = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, hw: r.width / 2, hh: r.height / 2 }; };
/** The nearest scrolled ancestor (a list taller than its box) of el inside root, or null. */
const scroller = (el, root) => { for (let a = el.parentElement; a && a !== root.parentElement; a = a.parentElement) { const cs = getComputedStyle(a); if ((a.scrollHeight > a.clientHeight + 4 && /auto|scroll|hidden/.test(cs.overflowY)) || (a.scrollWidth > a.clientWidth + 4 && /auto|scroll|hidden/.test(cs.overflowX))) return a; } return null; };
/** Scrolled out of view: centre outside its scrolled ancestor's box. */
const clipped = (el, sc) => { if (!sc) return false; const r = el.getBoundingClientRect(), b = sc.getBoundingClientRect(), y = r.top + r.height / 2, x = r.left + r.width / 2; return y < b.top || y > b.bottom || x < b.left || x > b.right; };
const sigOf = (el) => { if (!el) return null; const d = Object.entries(el.dataset || {}).map(([k, v]) => `${k}=${v}`).join('&'); return `${el.tagName}#${el.id}|${d}|${d || el.id ? '' : (el.textContent || '').trim().slice(0, 40)}`; };

export class KbNav {
  /** o: { capturing: () => true while Options waits for a key to bind } */
  constructor(o = {}) {
    this.o = o; this.cur = null; this.sig = null;
    if (typeof document === 'undefined') return;
    if (!document.getElementById('kbnav-css')) { const st = document.createElement('style'); st.id = 'kbnav-css'; st.textContent = CSS; document.head.appendChild(st); }
    this.onKey = (e) => this.key(e);
    addEventListener('keydown', this.onKey, { capture: true }); // (registered before the menu hub's: it sees the arrows first)
  }
  root() { for (const s of NAV_ROOTS) { const el = document.querySelector(s); if (el && visible(el)) return el; } return null; }
  items(root) { return [...root.querySelectorAll(NAV_SEL)].filter((el) => visible(el) && !el.matches('.br-arr')); } // (the bag row's page arrows: stepping through the cells scrolls it)
  key(e) {
    if (this.o.capturing && this.o.capturing()) return;
    const t = e.target, tag = t && t.tagName;
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && !/^(checkbox|range|button)$/i.test(t.type || ''))) return; // (typing: a stash tab / loadout name)
    const root = this.root();
    if (!root) { this.drop(); return; }
    if (this.cur && (!this.cur.isConnected || !root.contains(this.cur))) this.refind(root);
    const code = e.code;
    if (DIRS[code]) {
      if (this.cur && this.cur.matches('input[type=range]') && (code === 'ArrowLeft' || code === 'ArrowRight')) { // a slider: left / right change it
        const r = this.cur, st = +r.step || 1; r.value = String(Math.max(+r.min || 0, Math.min(+r.max || 100, +r.value + (code === 'ArrowLeft' ? -st : st)))); r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true }));
      } else this.move(root, DIRS[code]);
      e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    if (!this.cur) return; // (nothing focused yet: Enter / Space / Delete keep their normal meaning)
    if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) this.activate(); return; }
    if (code === 'Delete' || code === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) this.alt(); }
  }
  move(root, dir) {
    // items scrolled out of a list are reachable only by stepping through that list (it scrolls along), not by jumping in from outside it
    const curSc = this.cur ? scroller(this.cur, root) : null;
    const list = [], cs = [];
    for (const el of this.items(root)) { const sc = scroller(el, root), same = !!curSc && sc === curSc; if (clipped(el, sc) && !same) continue; list.push(el); cs.push({ ...centre(el), same }); }
    if (!list.length) return;
    let i;
    if (!this.cur) { // first press: the panel's content in reading order (not the hub's tab bar / header buttons above it)
      const body = list.map((el, k) => (el.closest('.hub-tabs, .hub-head, .hub-top') ? -1 : k)).filter((k) => k >= 0);
      i = body.length ? body[firstIndex(body.map((k) => cs[k]))] : firstIndex(cs);
    }
    else { i = pickDir(cs, centre(this.cur), dir); if (i < 0) return; }
    this.focus(list[i]);
  }
  refind(root) {
    const sig = this.sig, list = this.items(root);
    const el = sig ? list.find((x) => sigOf(x) === sig) : null;
    if (el) this.focus(el, false); else this.drop();
  }
  focus(el, tip = true) {
    if (this.cur === el) return;
    const prev = this.cur;
    if (prev) { prev.classList.remove('kbfocus'); if (prev.isConnected) prev.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false })); }
    this.cur = el; this.sig = sigOf(el);
    el.classList.add('kbfocus');
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch { /* old browsers */ }
    if (tip) { const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, clientX: r.right, clientY: r.top + r.height / 2 })); }
  }
  activate() {
    const el = this.cur; if (!el) return;
    if (el.matches('select')) { el.focus(); return; }
    el.click();
    setTimeout(() => { const root = this.root(); if (root && this.cur && !this.cur.isConnected) this.refind(root); }, 0); // (panels re-render on a click)
  }
  alt() { const el = this.cur; if (!el) return; const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); setTimeout(() => { const root = this.root(); if (root && this.cur && !this.cur.isConnected) this.refind(root); }, 0); }
  drop() { if (this.cur) { this.cur.classList.remove('kbfocus'); this.cur = null; } }
}
