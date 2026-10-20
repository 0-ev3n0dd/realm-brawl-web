// The hub's Heroes tab (2026-10-07, a "Descendant screen"): the selected hero large in the centre (its front-facing
// showcase model idling on a platform - client/heromodel.js sprite-sheet loop, a signature flourish on select / swap) with name + title, level / gear power / mastery / skills / passives on the left
// (tooltips: hover, keyboard focus or tap), the roster of all ten heroes along the bottom (sort: level / name / role)
// and Use (In Use for the active one): an instant in-place swap - solo / phone through the sim's 'hero' command, co-op
// through the server (client/netgame.js swapHero). Works the same with a mouse, Keyboard-only mode (client/kbnav.js
// walks the buttons) and touch. Roster data: sim/heroes.js.
import { CLASSES } from '../sim/data/classes.js';
import { HEROES, HERO_SORTS, heroOf, heroList, heroFor, sortHeroes, mastery } from '../sim/heroes.js';
import { serializeCharacter } from '../sim/save.js';
import { itemPower } from '../sim/loot.js';
import { xpToNext } from '../sim/progression.js';
import { sustainText } from '../sim/sustain.js';
import { drawHeroThumb } from './art.js';
import { drawPlatform, rgba } from './heroshow.js';
import { iconStyle } from './uipaint.js';
import { rememberHero } from './lasthero.js';
import { PERKS, PERK_IDS, MASTERY, perksFree, respecCost, titleOf, emblemOf, nextMasteryReward, pickPerk } from '../sim/mastery.js';
import { profile } from './rewards.js';
import { rankOf } from '../sim/ascension.js';
import { ASC_TITLE } from '../sim/ascended.js'; // (Part B: the Ascended title)
import { ULT_TITLE } from '../sim/ultreward.js'; // (Part F3: the Ultimate's prestige title, account-wide)
import { isUnlocked, LOCKED_TEXT } from '../sim/heroUnlock.js';
import { progOf, mapOfHero, missing, surplusCount, openCache, craftPart, canCraftPart, canAssemble, assemble, exchange, sourcesOf, partCost, assembleCost, PARTS, PART_NAME, COMP_NEED, EXCHANGE_RATE } from '../sim/herocraft.js';
import { showHeroUnlocked } from './heroreveal.js';
import { ShowcaseView, drawPortrait, fitScale, elRect, sheetKind, preloadModel, preloadAll } from './heromodel.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clean = (s) => String(s || '').replace(/\s?\{\w+\}/g, '').replace(/\s+/g, ' ').trim();
const SK = [['Q', 'skillQ', 'Q'], ['E', 'skillE', 'E'], ['R', 'skillR', 'R'], ['F', 'skillF', 'G'], ['SP', 'special', 'F'], ['ULT', 'ult', 'T']];

const CSS = `
.hh{display:flex;flex-direction:column;height:100%;gap:10px;min-height:0}
.hh-main{flex:1;display:grid;grid-template-columns:minmax(272px,340px) 1fr;gap:12px;min-height:0}
.hh-left{display:flex;flex-direction:column;gap:8px;overflow:auto;padding:12px;min-height:0}
.hh-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.hh-st{background:rgba(0,0,0,.28);border-radius:10px;padding:6px 8px;text-align:center}
.hh-st span{display:block;font-size:11px;opacity:.75;text-transform:uppercase;letter-spacing:.06em}
.hh-st b{font:22px 'Lilita One',sans-serif;color:#ffd23f}
.hh-st i{display:block;height:4px;border-radius:2px;background:rgba(255,255,255,.12);margin-top:3px;overflow:hidden}
.hh-st i em{display:block;height:100%;background:var(--hc,#ffd23f)}
.hh-left h4{margin:4px 0 0;font:15px 'Lilita One',sans-serif;letter-spacing:.04em;opacity:.9}
.hh-skills,.hh-pass{display:flex;flex-wrap:wrap;gap:5px;padding-top:4px}
.hh-sk,.hh-ps{position:relative;width:42px;height:42px;flex:0 0 auto;border-radius:10px;border:2px solid rgba(255,255,255,.18);background:#2a2236 center/cover no-repeat;color:#fff;cursor:pointer;padding:0;font:18px 'Lilita One',sans-serif}
.hh-sk canvas{width:100%;height:100%;display:block;pointer-events:none}
.hh-sk kbd{z-index:1;position:absolute;left:-4px;top:-6px;font:11px 'Lilita One',sans-serif;background:#ffd23f;color:#2b2433;border-radius:5px;padding:0 4px;min-width:12px}
.hh-sk.ult{border-color:#ffd23f}.hh-sk.sp{border-color:#7ee0ff}
.hh-ps{border-radius:50%;width:44px;height:44px;background:radial-gradient(circle at 35% 30%,var(--hc,#888),#241c30 75%)}
.hh-sk.on,.hh-ps.on{outline:2px solid #ffd23f}
.hh-mas{background:rgba(0,0,0,.28);border-radius:10px;padding:6px 8px;display:flex;flex-direction:column;gap:5px}
.hh-mh{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.hh-mh b{font:16px 'Lilita One',sans-serif;color:#ffd23f}.hh-mh span{font:13px 'Lilita One',sans-serif;color:var(--emc,#e6ddf5)}.hh-mh small{margin-left:auto;font-size:11px;opacity:.85}
.hh-perks{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.hh-pk{display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px 2px;border-radius:9px;border:2px solid rgba(255,255,255,.18);background:#2a2236;color:#fff;cursor:pointer;font-family:inherit}
.hh-pk i{font-style:normal;font-size:16px;line-height:1}.hh-pk b{font:12px 'Lilita One',sans-serif;font-weight:normal}.hh-pk small{font-size:10.5px;color:#bfe9a8}
.hh-pk.can{border-color:#ffd23f;box-shadow:0 0 8px rgba(255,210,63,.35)}.hh-pk[disabled]{cursor:default;opacity:.8}
.hh-mf{display:flex;align-items:center;gap:6px;font-size:11px}.hh-mf span{flex:1;opacity:.85}.hh-mf .btn{font-size:12px;padding:2px 8px;min-height:0}
.hh-tip{flex:none;min-height:84px;background:rgba(0,0,0,.32);border-radius:10px;padding:8px 10px;font-size:13px;line-height:1.35}
.hh-tip b{color:#ffd23f;font-family:'Lilita One',sans-serif;font-weight:normal;font-size:15px}
.hh-center{position:relative;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}
.hh-center canvas{position:absolute;inset:0;width:100%;height:100%}
.hh-name{position:absolute;top:8px;left:0;right:0;text-align:center;pointer-events:none;text-shadow:0 3px 0 #1d1626}
.hh-name b{display:block;font:clamp(30px,4.2vw,56px) 'Lilita One',sans-serif;line-height:1;color:#fff}
.hh-name span{display:block;font:clamp(16px,1.8vw,24px) 'Lilita One',sans-serif;color:var(--hc,#ffd23f)}
.hh-name em{font-style:normal;font-size:13px;opacity:.8;letter-spacing:.08em;text-transform:uppercase}
.hh-use{position:relative;z-index:2;margin-bottom:10px;min-width:200px;width:auto!important;padding-left:36px;padding-right:36px;font-size:22px}
.hh-use.inuse{background:#3a3347;color:#bfe9a8;border-color:#6fe05a;cursor:default}
.hh-msg{position:relative;z-index:2;min-height:18px;font-size:13px;color:#bfe9a8;margin-bottom:4px}
.hh-roster{flex:0 0 auto;padding:8px 10px}
.hh-rhead{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.hh-rhead b{font:16px 'Lilita One',sans-serif}.hh-rhead label{margin-left:auto;font-size:13px}
.hh-cards{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 6px;scroll-snap-type:x proximity}
.hh-card{flex:0 0 auto;width:104px;border-radius:12px;border:2px solid rgba(255,255,255,.14);background:linear-gradient(#352b45,#221b2d);color:#fff;padding:4px 4px 6px;cursor:pointer;text-align:center;scroll-snap-align:start;position:relative}
.hh-card canvas{width:72px;height:72px;display:block;margin:0 auto}
.hh-card b{display:block;font:15px 'Lilita One',sans-serif;line-height:1.1}
.hh-card small{display:block;font-size:11px;opacity:.8}
.hh-card .lv{position:absolute;top:4px;left:6px;font:13px 'Lilita One',sans-serif;color:#ffd23f}
.hh-card .use{position:absolute;top:4px;right:4px;font-size:10px;background:#6fe05a;color:#1d2a14;border-radius:6px;padding:0 4px;font-weight:bold}
.hh-card.locked{filter:grayscale(1) brightness(.6)}.hh-card.locked canvas{filter:brightness(.15)}.hh-card .lk{position:absolute;top:2px;left:4px;font-size:14px}
.hh-craft{background:rgba(0,0,0,.22);border:2px solid rgba(255,255,255,.08);border-radius:12px;padding:8px 10px;margin-bottom:8px;font-size:13px}
.hh-craft h4{margin:0 0 6px;color:var(--hc)}.hh-craft h4 small{color:#cbbfe0;font-weight:400;margin-left:6px}
.hc-cache{display:flex;flex-wrap:wrap;align-items:center;gap:6px;background:rgba(255,210,63,.08);border:1px dashed #ffd23f66;border-radius:9px;padding:6px 8px;margin-bottom:6px}.hc-cache b{color:#ffd23f}.hc-cache span{flex:1 1 100%;font-size:11px;opacity:.75}
.hc-row{display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:8px;background:rgba(255,255,255,.04);margin:3px 0}.hc-row i{font-style:normal;width:20px;text-align:center}.hc-row b{flex:1}.hc-row span{font-size:12px;opacity:.85}.hc-row.have{background:rgba(93,255,122,.1)}.hc-row.have span{color:#5dff7a}.hc-row em{font-size:11px;color:#ff8a7a}
.hc-src{margin-top:6px;font-size:12px}.hc-src ul{margin:2px 0 0 16px;padding:0}.hc-src small{color:#ffd23f}.hc-ex{margin-top:6px;font-size:11px;opacity:.75}
.hh-use.hh-asm{background:linear-gradient(#ffe06a,#ffb52e);color:#2b1a05;animation:hhAsm 1.2s ease-in-out infinite}@keyframes hhAsm{50%{box-shadow:0 0 22px #ffd23f}}
.hh-use.locked{background:#3a3347;color:#cbbfe0;border-color:#6b5a86;cursor:default;font-size:18px!important}
.hh-card.sel{border-color:var(--hc,#ffd23f);box-shadow:0 0 0 2px var(--hc,#ffd23f),0 0 16px rgba(255,210,63,.35);background:linear-gradient(#4a3b60,#2a2138)}
body.rb-mobile .hh-main,.hub.mobile .hh-main{grid-template-columns:minmax(210px,36%) 1fr}
@media (max-height:520px){
.hh-mas{padding:4px 6px;gap:3px}.hh-pk{padding:2px 1px}.hh-pk small{display:none}.hh-mh small{font-size:10px}
.hh{gap:6px}.hh-main{gap:8px}.hh-left{padding:8px;gap:5px}
.hh-st{padding:3px 4px}.hh-st b{font-size:16px}.hh-st span{font-size:9px}
.hh-kit{display:flex;gap:8px;flex-wrap:wrap}.hh-kit h4{display:none}
.hh-sk{width:36px;height:36px;border-radius:8px}.hh-ps{width:32px;height:32px;font-size:14px}.hh-sk kbd{font-size:9px}
.hh-tip{min-height:0;font-size:11px;padding:5px 7px;line-height:1.25}.hh-tip b{font-size:13px}
.hh-name{top:4px;left:10px;right:auto;text-align:left;max-width:46%}.hh-name b{font-size:28px}.hh-name span{font-size:15px}.hh-name em{font-size:10px}
.hh .hh-use{position:absolute;right:10px;bottom:8px;margin:0;font-size:17px!important;min-width:110px;min-height:0!important;height:auto!important;padding:6px 20px!important}.hh-msg{position:absolute;left:8px;bottom:8px;font-size:11px;min-height:0;margin:0}
.hh-st i{margin-top:1px}.hh-stats{gap:4px}
.hh-roster{padding:4px 8px}.hh-rhead{margin-bottom:2px;gap:8px}.hh-rhead b{font-size:13px}.hh-rhead .hint{font-size:11px}
.hh-cards{gap:6px;padding:2px 2px 4px}.hh-card{width:74px;padding:2px 2px 3px;border-radius:9px}.hh-card canvas{width:40px;height:40px}.hh-card b{font-size:12px}.hh-card small{font-size:9px}.hh-card .lv{font-size:11px;top:1px;left:4px}.hh-card .use{font-size:8px;top:2px;right:2px}
}
`;

export class HeroesTab {
  constructor(hub) { this.h = hub; this.sel = null; this.sort = 'level'; this.sig = ''; this.tipKey = null; this.msg = ''; this.t = 0; this.view = new ShowcaseView(); this.inject(); }
  get g() { return this.h.g; }
  inject() { if (typeof document === 'undefined' || $('hh-css')) return; const s = document.createElement('style'); s.id = 'hh-css'; s.textContent = CSS; document.head.appendChild(s); }
  player() { return this.g.player; }
  store() { return this.g.store; }
  /** the ten heroes; the active one is the live player (its level / gear right now) */
  heroes() {
    const p = this.player(); let list = [];
    try { list = this.store() ? heroList(this.store()) : []; } catch { list = []; }
    if (p) { const live = { ...serializeCharacter(p), id: p.charId || p.id }; const i = list.findIndex((c) => c.cls === p.cls); if (i >= 0) list[i] = live; else list.push(live); }
    return list;
  }
  enter() { const p = this.player(); if (!this.sel || !CLASSES[this.sel]) this.sel = p ? p.cls : 'warrior'; this.sig = ''; this.msg = ''; this.render(); }
  keyLabel(id, def) { const kb = this.h.kb; if (this.g.isMobile || !kb) return def; try { return kb.label(id) || def; } catch { return def; } }
  render(force = false) {
    const root = $('hubHeroes'); if (!root) return;
    const p = this.player(), list = this.heroes(), active = p ? p.cls : null;
    const sel = list.find((c) => c.cls === this.sel) || list[0]; if (!sel) { root.innerHTML = '<p class="dim">No heroes.</p>'; return; }
    this.sel = sel.cls;
    const sig = JSON.stringify([this.sel, this.sort, active, this.msg, this.tipKey, list.map((c) => [c.cls, c.level, c.xp | 0, c.kills, Math.floor(c.mxp || 0), JSON.stringify(c.mperks || {}), Object.values(c.equipment || {}).map((i) => i && i.uid + (i.up | 0)).join()])]);
    if (!force && sig === this.sig) return; this.sig = sig;
    const C = CLASSES[sel.cls], H = heroOf(sel.cls), M = mastery(sel), need = xpToNext(sel.level), xp = sel.xp | 0;
    const power = Object.values(sel.equipment || {}).reduce((n, it) => n + (it ? itemPower(it) : 0), 0);
    const skills = SK.filter(([k]) => (k === 'ULT' ? C.ult : C.skills[k])).map(([k, id, def]) => {
      const s = k === 'ULT' ? C.ult : C.skills[k], st = iconStyle(sel.cls + '_' + k, 52);
      return `<button class="hh-sk${k === 'ULT' ? ' ult' : k === 'SP' ? ' sp' : ''}${this.tipKey === k ? ' on' : ''}" data-hk="${k}" style="${st}" aria-label="${esc(s.name)}"><kbd>${esc(this.keyLabel(id, def))}</kbd>${st ? '' : `<canvas width="104" height="104" data-ico="${esc(s.id || '')}"></canvas>`}</button>`;
    }).join('');
    const pas = this.passives(sel.cls).map((x, i) => `<button class="hh-ps${this.tipKey === 'p' + i ? ' on' : ''}" data-hk="p${i}" aria-label="${esc(x.name)}">${x.ico}</button>`).join('');
    const sorted = sortHeroes(list, this.sort);
    root.style.setProperty('--hc', C.color);
    root.innerHTML = `
      <div class="hh-main">
        <div class="hh-left panel-in"${this.ok(sel.cls) ? '' : ' style="overflow-y:auto"'}>
          ${this.ok(sel.cls) ? '' : this.craftHtml(sel.cls)}
          <div class="hh-stats"${this.ok(sel.cls) ? '' : ' style="display:none"'}>
            <div class="hh-st"><span>Level</span><b>${sel.level}</b><i><em style="width:${isFinite(need) ? Math.min(100, (xp / Math.max(1, need)) * 100).toFixed(0) : 100}%"></em></i></div>
            <div class="hh-st"><span>Gear Power</span><b>${power}</b></div>
            <div class="hh-st"><span>Mastery</span><b>${M.rank}</b><i><em style="width:${(M.frac * 100).toFixed(0)}%"></em></i></div>
          </div>
          ${this.ok(sel.cls) ? this.masteryHtml(sel, M) : ''}
          <div class="hh-kit"><div><h4>Skills</h4><div class="hh-skills">${skills}</div></div><div><h4>Passives</h4><div class="hh-pass">${pas}</div></div></div>
          <div class="hh-tip" id="hhTip">${this.tipHtml(sel.cls, this.tipKey) || `<b>${esc(C.name)}</b><br>${esc(clean(C.blurb))}`}</div>
        </div>
        <div class="hh-center">
          <canvas id="hhHero"></canvas>
          <div class="hh-name"><b>${esc(H.name)}</b><span>${esc(H.title)}</span><em>${esc(C.name)} · ${esc(H.role)} · Mastery ${M.rank} (${M.kills} kills)</em></div>
          <div class="hh-msg" id="hhMsg">${esc(this.msg)}</div>
          ${this.ok(sel.cls) ? `<button class="btn big hh-use${sel.cls === active ? ' inuse' : ''}" id="hhUse"${sel.cls === active ? ' aria-disabled="true"' : ''}>${sel.cls === active ? '✔ In Use' : 'Use'}</button>` : (canAssemble(profile.load(), sel.cls) ? `<button class="btn big hh-use hh-asm" id="hhUse">⚒ Assemble ${esc(H.name)} · ${assembleCost(sel.cls).toLocaleString('en-US')}g</button>` : `<button class="btn big hh-use locked" id="hhUse" aria-disabled="true" disabled>🔒 Blueprint + 3 parts to unlock</button>`)}
        </div>
      </div>
      <div class="hh-roster panel-in">
        <div class="hh-rhead"><b>Heroes · ${list.length}</b><span class="hint">${this.g.isMobile ? 'Tap a hero, then Use' : 'Click a hero (or arrows + Enter), then Use · double-click: use at once'}</span>
          <label>Sort <select id="hhSort">${HERO_SORTS.map((o) => `<option value="${o.id}"${o.id === this.sort ? ' selected' : ''}>${o.label}</option>`).join('')}</select></label></div>
        <div class="hh-cards">${sorted.map((c) => { const h = heroOf(c.cls); return `<button class="hh-card${c.cls === this.sel ? ' sel' : ''}${this.ok(c.cls) ? '' : ' locked'}" data-hero="${c.cls}" style="--hc:${CLASSES[c.cls].color}"${this.ok(c.cls) ? '' : ` title="${LOCKED_TEXT}"`}>${this.ok(c.cls) ? `<span class="lv">${c.level}</span>` : '<span class="lk">🔒</span>'}${c.cls === active ? '<span class="use">IN USE</span>' : ''}<canvas width="144" height="144" data-thumb="${c.cls}"></canvas><b>${esc(h.name)}</b><small>${esc(h.role)}</small></button>`; }).join('')}</div>
      </div>`;
    preloadAll(this.kind(), this.sel); this._fitKey = '';
    root.querySelectorAll('canvas[data-thumb]').forEach((cv) => { const cls = cv.dataset.thumb, c = list.find((x) => x.cls === cls); drawPortrait(cv, cls, (k) => { try { drawHeroThumb(k, cls, c ? c.appearance : HEROES[cls].look); } catch { /* art not ready */ } }); });
    const hud = this.g.hud; // the classic HUD skill glyphs (client/hud.js iconDraw), the same ones as the skill bar
    root.querySelectorAll('canvas[data-ico]').forEach((cv) => { const g = cv.getContext('2d'), k = cv.width / 64; g.setTransform(k, 0, 0, k, 0, 0); try { if (hud && hud.iconDraw) hud.iconDraw(g, cv.dataset.ico, 32, 32, C, false); } catch { /* unknown icon */ } });
    root.querySelectorAll('[data-hero]').forEach((b) => {
      b.onpointerenter = () => preloadModel(b.dataset.hero, this.kind()); // (warm the sheet before the click)
      b.onclick = () => { // (keyboard: Enter on the selected card = Use; mouse: a double-click = Use)
        const cls = b.dataset.hero, now = performance.now(), again = this.lastCls === cls && now - (this.lastClick || 0) < 450;
        this.lastClick = now; this.lastCls = cls;
        if (this.sel === cls && (b.classList.contains('kbfocus') || again)) this.use(); else this.select(cls);
      };
    });
    root.querySelectorAll('[data-hk]').forEach((b) => {
      b.onmouseenter = () => this.tip(b.dataset.hk); b.onfocus = () => this.tip(b.dataset.hk);
      b.onclick = () => { this.tipKey = this.tipKey === b.dataset.hk && !b.classList.contains('kbfocus') ? null : b.dataset.hk; this.render(true); };
    });
    $('hhSort').onchange = (e) => { this.sort = e.target.value; this.h.state.sub.heroes = this.sort; this.render(true); };
    $('hhUse').onclick = () => (this.ok(this.sel) ? this.use() : this.assemble(this.sel));
    root.querySelectorAll('[data-hc]').forEach((b) => (b.onclick = () => this.craftAct(b.dataset.hc, b.dataset.k)));
    root.querySelectorAll('[data-pk]').forEach((b) => (b.onclick = () => this.perk(sel, b.dataset.pk)));
    const rs = root.querySelector('#hhRespec'); if (rs) rs.onclick = () => this.respec(sel);
    this.size();
  }
  /** hero unlocks (sim/herocraft.js): a locked hero's Blueprint + parts, caches, sources, exchange */
  craftHtml(cls) {
    const pr = profile.load(), g = progOf(pr, cls), H = heroOf(cls), miss = missing(pr, cls), sur = surplusCount(pr), gold = pr.gold | 0;
    const row = (k) => {
      if (k === 'bp') return `<div class="hc-row${g.bp ? ' have' : ''}"><i>📜</i><b>${esc(H.name)} Blueprint</b><span>${g.bp ? '✔ owned' : '0 / 1'}</span>${!g.bp && sur >= EXCHANGE_RATE ? `<button class="btn small ghost" data-hc="ex" data-k="bp">Exchange ${EXCHANGE_RATE}→1</button>` : ''}</div>`;
      const done = g.p[k], n = g.c[k], can = canCraftPart(pr, cls, k);
      return `<div class="hc-row${done ? ' have' : ''}"><i>${{ helm: '⛑', core: '◈', armor: '🛡' }[k]}</i><b>${PART_NAME[k]}</b><span>${done ? '✔ crafted' : `${n} / ${COMP_NEED} components`}</span>`
        + (done ? '' : can ? `<button class="btn small" data-hc="part" data-k="${k}">Craft · ${partCost(cls)}g</button>` : miss[k] && sur >= EXCHANGE_RATE ? `<button class="btn small ghost" data-hc="ex" data-k="${k}">Exchange ${EXCHANGE_RATE}→1</button>` : n >= COMP_NEED ? `<em>${partCost(cls)}g</em>` : '') + '</div>';
    };
    const MP = mapOfHero(cls), lockedN = MP ? MP.heroes.filter((c) => !isUnlocked(pr, c)) : [], srcHead = MP ? `<b>Cache drops from ${esc(MP.name)}</b><small>each drop goes to one of the map's still-locked heroes, split evenly (${lockedN.map((c) => esc(heroOf(c).name)).join(' / ') || 'none'})</small>` : '<b>Cache drops from</b>';
    const src = sourcesOf(cls).map((x) => `<li>${esc(x.name)} <small>${Math.round(x.p * 100)}%</small></li>`).join('');
    return `<div class="hh-craft"><h4>Unlock ${esc(H.name)} <small>Blueprint + Helm + Core + Armor</small></h4>
      <div class="hc-cache"><b>${esc(H.name)} Cache × ${g.cache}</b><span>each opens 1 piece: Blueprint / Helm / Core / Armor component (1/4 each)</span>
        <button class="btn small${g.cache ? '' : ' ghost'}" data-hc="open" data-k=""${g.cache ? '' : ' disabled'}>Open cache</button>${g.cache > 1 ? `<button class="btn small ghost" data-hc="openall" data-k="">Open all</button>` : ''}</div>
      ${['bp', ...PARTS].map(row).join('')}
      <div class="hc-src">${srcHead}<ul>${src}</ul></div>
      <div class="hc-ex">Quartermaster exchange: ${sur} surplus piece${sur === 1 ? '' : 's'} · ${EXCHANGE_RATE} surplus → 1 missing piece of your choice · gold ${gold.toLocaleString('en-US')}</div></div>`;
  }
  craftAct(act, k) {
    const pr = profile.load(), cls = this.sel, H = heroOf(cls);
    if (act === 'open' || act === 'openall') {
      const got = []; do { const r = openCache(pr, cls); if (!r) break; got.push(r); } while (act === 'openall');
      if (got.length) { profile.save(); this.msg = 'Cache: ' + got.map((x) => (x === 'bp' ? 'Blueprint' : PART_NAME[x] + ' component')).join(', '); if (this.g.audio) this.g.audio.play('legendary'); }
    } else if (act === 'part') { if (craftPart(pr, cls, k)) { profile.save(); this.msg = `${H.name} ${PART_NAME[k]} crafted`; if (this.g.audio) this.g.audio.play('legendary'); } else this.msg = 'Not enough components or gold'; }
    else if (act === 'ex') { if (exchange(pr, cls, k)) { profile.save(); this.msg = `Exchanged ${EXCHANGE_RATE} surplus pieces for a ${k === 'bp' ? 'Blueprint' : PART_NAME[k] + ' component'}`; } else this.msg = 'Not enough surplus to exchange'; }
    this.render(true);
  }
  assemble(cls) {
    const pr = profile.load(); if (!assemble(pr, cls)) { this.msg = 'Needs the Blueprint, all 3 parts and the gold'; this.render(true); return; }
    profile.save(); this.msg = `${heroOf(cls).name} unlocked!`; this.render(true);
    try { showHeroUnlocked(cls, { audio: this.g.audio, isMobile: !!this.g.isMobile }); } catch (e) { console.warn('unlock fx', e); }
  }
  /** game loop B1: Mastery rank, title, the 4 perks (+1% per pick), the next emblem / title, respec */
  masteryHtml(c, M) {
    const free = perksFree(c), m = c.mperks || {}, em = emblemOf(M.rank), nx = nextMasteryReward(M.rank), title = [(profile.load().ult || {}).n > 0 ? ULT_TITLE : '', rankOf(profile.load(), c.cls) >= 1 ? ASC_TITLE : '', titleOf(M.rank)].filter(Boolean).join(' · '), cost = respecCost(c);
    const perks = PERK_IDS.map((k) => { const P = PERKS[k], n = m[k] | 0; return `<button class="hh-pk${free ? ' can' : ''}" data-pk="${k}"${free ? '' : ' disabled'} title="${esc(P.text)} per pick"><i>${P.ico}</i><b>${esc(P.name)}</b><small>+${n}%</small></button>`; }).join('');
    return `<div class="hh-mas" style="--emc:${em ? em[3] : '#e6ddf5'}"><div class="hh-mh"><b>Mastery ${M.rank}</b>${title ? `<span>${esc(title)}</span>` : ''}${em ? `<span>· ${esc(em[2])}</span>` : ''}<small>${free ? `<b style="font-size:12px">${free} pick${free === 1 ? '' : 's'} free</b> · ` : ''}${M.rank >= MASTERY.cap ? 'max rank' : `${M.pts.toLocaleString('en-US')} / ${M.next.toLocaleString('en-US')} pts`}</small></div>
      <div class="hh-perks">${perks}</div>
      <div class="hh-mf"><span>${nx ? `Rank ${nx.rank}: ${esc(nx.text)}` : 'Every reward on the track earned'} · kills + XP past the level cap</span>${cost ? `<button class="btn small ghost" id="hhRespec" title="Reset every pick (gold)">Respec ${cost.toLocaleString('en-US')}g</button>` : ''}</div></div>`;
  }
  /** spend a pick: the active hero through the sim (stats update live), a benched hero in the save */
  perk(c, id) {
    const g = this.g, p = this.player();
    if (p && p.cls === c.cls) { if (perksFree(p) <= 0) return; g.command({ type: 'mastery', op: 'pick', id }); if (g.sim && g.sim.flushCommands) g.sim.flushCommands(); }
    else { const ch = heroFor(g.store, c.cls); if (!ch || !pickPerk(ch, id)) return; try { g.store.upsert(ch); } catch { /* full */ } }
    this.msg = `${PERKS[id].name}: ${PERKS[id].text}`; setTimeout(() => this.render(true), 60); this.render(true);
  }
  respec(c) {
    const g = this.g, p = this.player(), cost = respecCost(c), pr = profile.load();
    if (!cost || (this.resAt && Date.now() - this.resAt < 2000)) return; // (bugpass: co-op shows the reset a few ticks later; a 2nd click no longer pays twice)
    if ((pr.gold | 0) < cost) { this.msg = `Respec needs ${cost.toLocaleString('en-US')} gold`; this.render(true); return; }
    pr.gold -= cost; profile.save(); this.resAt = Date.now();
    if (p && p.cls === c.cls) { g.command({ type: 'mastery', op: 'respec' }); if (g.sim && g.sim.flushCommands) g.sim.flushCommands(); }
    else { const ch = heroFor(g.store, c.cls); if (ch) { ch.mperks = {}; try { g.store.upsert(ch); } catch { /* full */ } } }
    this.msg = `Mastery picks reset (−${cost.toLocaleString('en-US')} gold)`; setTimeout(() => this.render(true), 60); this.render(true);
  }
  passives(cls) {
    const C = CLASSES[cls], out = [];
    if (C.state && C.state.name) out.push({ ico: '✦', name: C.state.name, tip: C.state.desc });
    if (C.stack && C.stack.name) out.push({ ico: '◆', name: C.stack.name, tip: C.stack.desc });
    out.push({ ico: '♥', name: 'Sustain', tip: sustainText(cls) });
    if (C.basicTip) out.push({ ico: '⚔', name: 'Basic combo', tip: C.basicTip });
    if (C.pips && !C.state) out.push({ ico: '●', name: C.resource, tip: `${C.resource}: your skills spend pips; basic hits and finishers earn them back.` });
    return out.slice(0, 4);
  }
  tipHtml(cls, k) {
    if (!k) return '';
    const C = CLASSES[cls];
    if (k[0] === 'p') { const x = this.passives(cls)[+k.slice(1)]; return x ? `<b>${esc(x.name)}</b> <span class="dim">· passive</span><br>${esc(clean(x.tip))}` : ''; }
    const row = SK.find((r) => r[0] === k), s = k === 'ULT' ? C.ult : C.skills[k]; if (!s || !row) return '';
    const kind = k === 'ULT' ? 'Ultimate' : k === 'SP' ? 'Special' : 'Skill';
    const meta = [s.cd ? `${s.cd}s cooldown` : '', s.cost ? `${s.cost} ${C.resource}` : ''].filter(Boolean).join(' · ');
    return `<b>${esc(s.name)}</b> <span class="dim">· ${kind} [${esc(this.keyLabel(row[1], row[2]))}]${meta ? ' · ' + esc(meta) : ''}</span><br>${esc(clean(s.tip || s.desc))}`;
  }
  tip(k) { const el = $('hhTip'); if (!el) return; const sel = this.sel; const html = this.tipHtml(sel, k); if (html) el.innerHTML = html; }
  select(cls) { if (!CLASSES[cls]) return; if (cls !== this.sel) this.view.flourish(cls, this.t); this.sel = cls; this.msg = ''; this.render(true); }
  kind() { return sheetKind(!!this.g.isMobile); }
  /** hero unlocks (sim/heroUnlock.js): is this hero unlocked on the account? */
  ok(cls) { try { return isUnlocked(profile.load(), cls); } catch { return true; } }
  dpr() { return Math.min(this.g.isMobile ? 1.5 : 2, devicePixelRatio || 1); }
  /** Use: swap to the selected hero right here (no reload) */
  use() {
    const g = this.g, p = this.player(), cls = this.sel;
    if (!p || !cls || p.cls === cls || !g.store || !this.ok(cls)) return false; // (hero unlocks: a locked hero can't be used)
    if (g.swapHero) { // co-op: the server swaps; netgame.onHero -> after()
      const ch = heroFor(g.store, cls); g.onHeroSwap = () => this.after(); this.msg = 'Swapping…'; this.render(true);
      return g.swapHero(ch);
    }
    try { g.store.upsert(serializeCharacter(p)); } catch { /* full */ }
    const ch = heroFor(g.store, cls);
    g.command({ type: 'hero', char: ch });
    if (g.sim && g.sim.flushCommands) g.sim.flushCommands();
    if (g.save) g.save();
    this.after();
    return true;
  }
  after() {
    const g = this.g, p = this.player(); if (!p) return;
    const ch = serializeCharacter(p); g.char = ch;
    try { rememberHero(localStorage, ch); } catch { /* private mode */ }
    if (g.relayout) try { g.relayout(); } catch { /* */ }
    if (g.ui) { g.ui.lastSig = ''; if (g.ui.clearPick) g.ui.clearPick(); }
    this.h.lastGear = ''; if (this.h.loBar) this.h.loBar.sig = ''; this.h.chainCls = null;
    const H = heroOf(p.cls); this.msg = `Now playing ${H.name}, ${H.title}`; this.sel = p.cls; this.view.flourish(p.cls, this.t);
    if (g.audio && g.audio.play) try { g.audio.play('levelup'); } catch { /* */ }
    if (g.fx && g.fx.banner) try { g.fx.banner(H.name.toUpperCase(), CLASSES[p.cls].color, H.title, 1.6, 40); } catch { /* */ }
    this.render(true);
  }
  size() {
    const cv = $('hhHero'); if (!cv) return;
    const r = cv.getBoundingClientRect(), dpr = this.dpr();
    if (r.width > 0 && r.height > 0 && (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr))) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  }
  draw(dt) {
    this.size(); // (charpreview fix: keep the backing store matched to the element, see menuhub.js sizeCv)
    this.t += dt;
    const cv = $('hhHero'); if (!cv || !cv.width) { this.size(); return; }
    const sel = this.heroes().find((c) => c.cls === this.sel); if (!sel) return;
    const dpr = this.dpr(), W = cv.width / dpr, H = cv.height / dpr, g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const col = (CLASSES[sel.cls] || {}).color || '#ffd23f', t = this.t;
    const bg = g.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, Math.max(W, H) * 0.6);
    bg.addColorStop(0, rgba(col, 0.3)); bg.addColorStop(1, rgba(col, 0)); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // compact (phone landscape): name top-left, the model larger and right of centre; else centred under the name
    const compact = H < 330, cx = compact ? W * 0.56 : W / 2, fy = H * (compact ? 0.86 : 0.78), pr = Math.min(W * 0.26, H * 0.22);
    if (this._fitKey !== W + 'x' + H) { // UI the model must stay clear of: the name block (+ Use / message when compact)
      this._fitKey = W + 'x' + H; const root = $('hubHeroes');
      this.avoid = [elRect(root.querySelector('.hh-name'), cv, 6), ...(compact ? [elRect($('hhUse'), cv), elRect($('hhMsg'), cv)] : [])].filter(Boolean);
    }
    drawPlatform(g, cx, fy, pr, col, t);
    g.save(); for (let i = 0; i < 16; i++) { const u = (t * 0.22 + i * 0.137) % 1, x = cx + Math.sin(i * 12.9 + t * 0.5) * pr * 0.9, y = fy - u * H * 0.55; g.globalAlpha = (1 - u) * 0.6; g.fillStyle = i % 3 ? col : '#fff6d8'; g.beginPath(); g.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2); g.fill(); } g.restore();
    const kind = this.kind(), y = fy - pr * 0.05;
    // one scale for all ten (they keep their relative size), the largest at which none covers the name / buttons
    const k = fitScale(Object.keys(CLASSES).filter((c) => HEROES[c]), { x: cx, y, bounds: [4, 4, W - 4, H - 2], avoid: this.avoid || [], max: H / 700 });
    if (!this.ok(sel.cls)) { // locked: a dark silhouette + the placeholder
      const oc = this._oc || (this._oc = document.createElement('canvas')); if (oc.width !== cv.width || oc.height !== cv.height) { oc.width = cv.width; oc.height = cv.height; }
      const og = oc.getContext('2d'); og.setTransform(dpr, 0, 0, dpr, 0, 0); og.clearRect(0, 0, W, H); this.view.draw(og, sel.cls, { x: cx, y, k, t, kind });
      og.globalCompositeOperation = 'source-atop'; og.fillStyle = '#120c1c'; og.fillRect(0, 0, W, H); og.globalCompositeOperation = 'source-over';
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.92; g.drawImage(oc, 0, 0); g.restore();
      g.save(); g.textAlign = 'center'; g.font = `${Math.round(Math.min(64, H * 0.12))}px 'Lilita One', sans-serif`; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText('🔒', cx, y - H * 0.28); g.restore();
      return;
    }
    this.view.draw(g, sel.cls, { x: cx, y, k, t, kind });
  }
}
