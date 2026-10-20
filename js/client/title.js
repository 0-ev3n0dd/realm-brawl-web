// The title screen (step 2): on launch the last-played hero idles large in their class's themed hall (client/titlefx.js),
// class name + level big on the right with a big Start Game, the profile name top-right and key hints along the
// bottom (Hero List, Options, Exit / Credits). Start Game plays that hero (in the menu's current mode, so the co-op
// join flow is the same one); Hero List opens the existing character select. No hero -> main.js skips the title.
import { CLASSES } from '../sim/data/classes.js';
import { accountLevel } from '../sim/meta.js';
import { drawTitleScene, themeOf } from './titlefx.js';
import { profileName } from './lasthero.js';
import { promptAccountName } from './acctprompt.js';
import { heroSubtitle } from '../sim/acctname.js';
import { profile } from './rewards.js';
import { heroOf } from '../sim/heroes.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function buildDom() {
  if ($('title')) return $('title');
  const d = document.createElement('div');
  d.id = 'title'; d.className = 'title hidden';
  d.innerHTML = `<canvas id="titleCv"></canvas>
    <div class="tt-logo"><span class="t1">REALM</span><span class="t2">BRAWL</span></div>
    <div class="tt-profile" id="ttProfile"></div>
    <div class="tt-hero">
      <div class="tt-scene" id="ttScene"></div>
      <div class="tt-cls" id="ttCls"></div>
      <div class="tt-lv" id="ttLv"></div>
      <div class="tt-mode" id="ttMode" title="Click to switch Co-op / Solo"></div>
      <button class="tt-start" id="ttStart"><span>Start Game</span><i>▶</i></button>
      <p class="tt-msg hidden" id="ttMsg"></p>
    </div>
    <div class="tt-keys" id="ttKeys"></div>
    <div class="tt-credits hidden" id="ttCredits"><div class="panel">
      <h2>Realm Brawl</h2>
      <p>A cartoony co-op action brawler: ten classes, chains and finishers, open worlds, dungeons and trials.</p>
      <p class="dim">Made by Casual's crew. Font: Lilita One (SIL Open Font License). All art is drawn in code.</p>
      <p><b>Exit:</b> your heroes and progress are saved in this browser - just close the tab.</p>
      <button class="btn" id="ttCreditsClose">Back</button>
    </div></div>`;
  document.body.appendChild(d);
  return d;
}

export class TitleScreen {
  /** opts: { store, storage, menu, options, keyLabel, onStart(char), onHeroList(), onWatchIntro() } */
  constructor(opts) {
    this.o = opts; this.hero = null; this.visible = false; this.t = 0; this.busy = false;
    this.root = buildDom(); this.cv = $('titleCv');
    $('ttStart').onclick = () => this.start();
    $('ttMode').onclick = () => this.toggleMode();
    $('ttCreditsClose').onclick = () => this.credits(false);
    this.onKey = (e) => this.key(e);
    addEventListener('keydown', this.onKey);
    this.onResize = () => this.size();
    addEventListener('resize', this.onResize);
  }
  show(hero, message = null) {
    if (!hero) return false;
    this.hero = this.o.store.get(hero.id) || hero; this.busy = false;
    this.visible = true; this.root.classList.remove('hidden');
    this.render(); this.msg(message, !!message); this.size();
    if (this.o.menu && this.o.menu.refreshServer) this.o.menu.refreshServer().then(() => this.renderMode()).catch(() => {});
    if (!this.raf) { this.lastT = 0; this.raf = requestAnimationFrame((t) => this.loop(t)); }
    return true;
  }
  hide() { this.visible = false; this.root.classList.add('hidden'); this.credits(false); cancelAnimationFrame(this.raf); this.raf = 0; }
  msg(text, err = false) { const m = $('ttMsg'); m.textContent = text || ''; m.classList.toggle('hidden', !text); m.classList.toggle('err', !!err); }
  /** co-op connect in progress (main.js) / done */
  setBusy(v, text = null) { this.busy = v; $('ttStart').disabled = v; this.msg(text, false); }
  render() {
    const h = this.hero, C = CLASSES[h.cls] || CLASSES.warrior, T = themeOf(h.cls);
    this.root.style.setProperty('--cc', C.color);
    $('ttScene').textContent = T.name;
    const H = heroOf(h.cls); // 2026-10-07: the hero's roster name + title (sim/heroes.js)
    $('ttCls').innerHTML = `${esc(H.name)}<small class="tt-title">${esc(H.title)}</small>`;
    $('ttLv').innerHTML = `<span>Lv.</span><b>${h.level | 0 || 1}</b><em>${esc(C.name)} · ${esc(H.role)}</em>`;
    this.renderProfile(); this.renderMode(); this.renderKeys();
  }
  renderProfile() {
    const acc = accountLevel(profile.load().accXp), n = this.o.store.list().length;
    $('ttProfile').innerHTML = `<div class="tp-lv"><small>Acct</small><b>${acc.level}</b></div><div class="tp-nm"><b id="ttPName" title="Click to change your account name">${esc(profileName(this.o.storage))}</b><small>${n} hero${n === 1 ? '' : 'es'} · ${(profile.load().gold | 0).toLocaleString()} gold</small></div><button class="tp-edit" id="ttPEdit" title="Change account name">✎</button>`;
    const edit = () => promptAccountName({ storage: this.o.storage, rename: true, heroTitle: heroSubtitle(heroOf(this.hero && this.hero.cls)), onSaved: () => this.renderProfile() });
    $('ttPName').onclick = edit; $('ttPEdit').onclick = edit;
  }
  renderMode() {
    const M = this.o.menu; if (!M) { $('ttMode').classList.add('hidden'); return; }
    const coop = M.mode === 'coop' && M.server;
    $('ttMode').innerHTML = coop ? `<b>Co-op</b> shared world on ${esc(location.host)} <i>⇄</i>` : `<b>Solo</b> offline, in this browser${M.server ? ' <i>⇄</i>' : ''}`;
    $('ttMode').classList.toggle('coop', !!coop);
  }
  toggleMode() { const M = this.o.menu; if (!M || !M.server || this.busy) return; M.setMode(M.mode === 'coop' ? 'solo' : 'coop'); this.renderMode(); }
  renderKeys() { $('ttKeys').innerHTML = `<span data-k="start"><kbd>Enter</kbd> Start Game</span><span data-k="list"><kbd>H</kbd> Heroes</span><span data-k="opts"><kbd>O</kbd> Options</span>${this.o.onWatchIntro ? '<span data-k="intro" id="ttIntro"><kbd>I</kbd> Watch Intro</span>' : ''}<span data-k="credits"><kbd>Esc</kbd> Exit / Credits</span>`;
    const K = (k, f) => { const el = $('ttKeys').querySelector(`[data-k="${k}"]`); if (el) el.onclick = f; };
    K('start', () => this.start()); K('list', () => this.heroList()); K('opts', () => this.openOptions()); K('intro', () => this.watchIntro()); K('credits', () => this.credits(true)); }
  watchIntro() { if (!this.visible || this.busy || !this.o.onWatchIntro) return; this.o.onWatchIntro(); }
  credits(v) { $('ttCredits').classList.toggle('hidden', !v); }
  start() { if (!this.visible || this.busy || !this.hero) return; const ch = this.o.store.get(this.hero.id) || this.hero; this.o.onStart(ch); }
  heroList() { if (!this.visible || this.busy) return; this.o.onHeroList(); }
  openOptions() { if (this.o.options) this.o.options.open(); }
  key(e) {
    if (!this.visible) return;
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (this.o.options && this.o.options.isOpen()) return;
    const cr = !$('ttCredits').classList.contains('hidden');
    if (e.code === 'Escape') { e.preventDefault(); this.credits(!cr); return; }
    if (cr) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.credits(false); } return; }
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') { e.preventDefault(); this.start(); }
    else if (e.code === 'KeyH') { e.preventDefault(); this.heroList(); }
    else if (e.code === 'KeyO') { e.preventDefault(); this.openOptions(); }
    else if (e.code === 'KeyI') { e.preventDefault(); this.watchIntro(); }
    else if (e.code === 'KeyC') { e.preventDefault(); this.credits(true); }
  }
  size() {
    if (!this.visible) return;
    const dpr = Math.min(1.5, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    if (this.cv.width !== Math.round(W * dpr) || this.cv.height !== Math.round(H * dpr)) { this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); }
    this.dpr = dpr;
  }
  loop(now) {
    this.raf = 0; if (!this.visible) return;
    const dt = Math.min(0.05, (now - (this.lastT || now)) / 1000); this.lastT = now; this.t += dt;
    const g = this.cv.getContext('2d'), d = this.dpr || 1, W = this.cv.width / d, H = this.cv.height / d;
    g.setTransform(d, 0, 0, d, 0, 0);
    try { drawTitleScene(g, W, H, this.hero.cls, { cls: this.hero.cls, app: this.hero.appearance }, this.t); } catch (err) { if (!this.warned) { this.warned = true; console.warn('title scene', err); } }
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }
  destroy() { this.hide(); removeEventListener('keydown', this.onKey); removeEventListener('resize', this.onResize); }
}
