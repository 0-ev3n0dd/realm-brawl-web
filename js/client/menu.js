// Hero select (DOM) with a live procedural preview. 2026-10-07: creation + naming removed - the ten fixed heroes
// (sim/heroes.js) are listed; in game the hub's Heroes tab swaps between them.
import { isUnlocked, LOCKED_TEXT } from '../sim/heroUnlock.js';
import { profile as acctProfile } from './rewards.js';
const heroOk = (cls) => { try { return isUnlocked(acctProfile.load(), cls); } catch { return true; } };
import { skillStripHTML, crestBadges, uiReady } from './uipaint.js'; // painted K icons + crests on the class select
import { CLASSES } from '../sim/data/classes.js';
import { sanitizeChar } from '../sim/save.js';
import { heroOf, heroList, heroFor } from '../sim/heroes.js';
import { sustainText } from '../sim/sustain.js';
import { drawHeroThumb } from './art.js';
import { drawPortrait, ShowcaseView, fitScale, sheetKind, preloadAll, modelOf } from './heromodel.js';
import { MODELS } from './heromodeldata.js';

const $ = (id) => document.getElementById(id);
const MODE_KEY = 'realmbrawl.mode';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Menu {
  constructor({ store, onPlay, keyLabel = null }) {
    this.keyLabel = keyLabel || ((id) => ({ attack: 'LMB' }[id] || id.replace('skill', '')));
    this.store = store;
    this.onPlay = onPlay;
    this.sel = { cls: 'warrior' };
    this.t = 0;
    this.demoT = 0;
    this.view = new ShowcaseView(); // the hero preview: the front-facing showcase model (client/heromodel.js), never the classic body
    this.build();
    this.renderSaves();
    this.setupMode();
    this.active = true;
    requestAnimationFrame((t) => this.loop(t));
  }

  // 2026-10-07: no hero creation / naming any more - ten fixed heroes (sim/heroes.js); pick one and play
  build() {
    uiReady().then(() => this.refresh && this.sel && this.refresh());
    $('playHero').onclick = () => this.play(heroFor(this.store, this.sel.cls));
    this.refresh();
  }

  refresh() {
    const cls = this.sel.cls, c = CLASSES[cls], H = heroOf(cls), ch = heroList(this.store).find((x) => x.cls === cls);
    Object.assign(this.sel, (ch && ch.appearance) || H.look);
    document.querySelectorAll('#saveList .save-card').forEach((d) => d.classList.toggle('sel', d.dataset.cls === cls));
    $('heroHead').innerHTML = `<b>${esc(H.name)}</b><span style="color:${c.color}">${esc(H.title)}</span><small>Lv ${ch ? ch.level : 1} ${esc(c.name)} · ${esc(H.role)}</small>`;
    $('playHero').textContent = heroOk(cls) ? `Play ${H.name}` : `🔒 ${LOCKED_TEXT}`; $('playHero').disabled = !heroOk(cls);
    $('classInfo').innerHTML = skillStripHTML(cls, c) + `<b>${c.name}</b> — ${c.blurb}<br>` +
      Object.entries(c.skills).map(([k, s]) => `<span class="k">${this.keyLabel(k === 'SP' ? 'special' : 'skill' + k)}</span>${k === 'SP' ? '<b>SPECIAL</b> ' : ''}${s.name}`).join(' &nbsp;') + ` &nbsp;<span class="k">${this.keyLabel('ult')}</span><b>ULTIMATE</b> ${c.ult ? c.ult.name : ''}` +
      `<br><b>Sustain:</b> ${sustainText(cls)}`;
  }

  play(ch) { if (ch && !heroOk(ch.cls)) { this.showError(`${heroOf(ch.cls).name} is locked: ${LOCKED_TEXT}.`); return; } this.showError(null); this.onPlay(ch, this.mode); }
  hide() { this.active = false; $('menu').classList.add('hidden'); }
  show() { const was = this.active; this.active = true; $('menu').classList.remove('hidden'); this.renderSaves(); this.refreshServer(); if (!was) requestAnimationFrame((t) => this.loop(t)); }
  showError(msg) { const e = $('menuError'); e.textContent = msg || ''; e.classList.toggle('hidden', !msg); }

  // ---- play mode: Co-op (this server's shared world) or Solo (entirely in the browser)
  setupMode() {
    const q = new URLSearchParams(location.search).get('mode');
    let saved = null; try { saved = localStorage.getItem(MODE_KEY); } catch {}
    this.mode = q === 'solo' || q === 'coop' ? q : saved === 'solo' ? 'solo' : 'coop';
    $('modeCoop').onclick = () => { if (!this.server) return; this.setMode('coop'); };
    $('modeSolo').onclick = () => this.setMode('solo');
    this.setMode(this.mode, false);
    this.refreshServer();
  }
  setMode(m, remember = true) {
    this.mode = m;
    if (remember) try { localStorage.setItem(MODE_KEY, m); } catch {}
    $('modeCoop').classList.toggle('sel', m === 'coop'); $('modeSolo').classList.toggle('sel', m === 'solo');
    this.renderServerInfo();
    this.renderHostHeroes();
  }
  async refreshServer() {
    try {
      const r = await fetch('/api/info', { cache: 'no-store' });
      this.server = r.ok ? await r.json() : null;
      if (this.server && !this.server.mp) this.server = null;
    } catch { this.server = null; }
    $('modeCoop').classList.toggle('disabled', !this.server);
    if (!this.server && this.mode === 'coop') this.setMode('solo', false);
    this.renderServerInfo();
    this.refreshHostHeroes();
  }

  // ---- heroes this host remembers from earlier sessions (the invite link changes every launch,
  //      and browsers keep saves per address, so friends can take their hero back from here)
  async refreshHostHeroes() {
    let list = [];
    if (this.server) try { const r = await fetch('/api/heroes', { cache: 'no-store' }); if (r.ok) list = (await r.json()).heroes || []; } catch {}
    this.hostHeroes = list;
    this.renderHostHeroes();
  }
  renderHostHeroes() {
    const local = new Set(this.store.list().map((c) => c.id));
    const list = this.store.heroes && this.store.heroes() ? [] : (this.hostHeroes || []).filter((h) => !local.has(h.id) && CLASSES[h.cls]); // (Heroes roster: one hero per class - no copies from the host)
    const el = $('hostHeroList'); el.innerHTML = '';
    $('hostHeroes').classList.toggle('hidden', !list.length || this.mode !== 'coop');
    for (const h of list) {
      const d = document.createElement('div'); d.className = 'save-card';
      const cv = document.createElement('canvas'); cv.width = cv.height = 112;
      drawPortrait(cv, h.cls, (k) => drawHeroThumb(k, h.cls, h.appearance || {}));
      d.appendChild(cv);
      const info = document.createElement('div'); info.className = 'info';
      info.textContent = String(h.name || 'Hero');
      const sm = document.createElement('small'); sm.textContent = `Lv ${h.level} ${CLASSES[h.cls].name}`; info.appendChild(sm);
      d.appendChild(info);
      const take = document.createElement('button'); take.className = 'btn small'; take.textContent = 'Take';
      take.title = 'Copy this hero into this browser';
      take.onclick = async () => {
        try {
          const r = await fetch('/api/heroes/' + encodeURIComponent(h.id), { cache: 'no-store' });
          if (!r.ok) throw new Error('gone');
          const ch = sanitizeChar((await r.json()).char);
          if (!ch) throw new Error('invalid');
          this.store.upsert(ch); this.renderSaves();
        } catch { this.showError('Could not copy that hero. Try again.'); }
      };
      d.appendChild(take);
      el.appendChild(d);
    }
  }
  renderServerInfo() {
    const el = $('serverInfo'), s = this.server;
    if (this.mode === 'solo') { el.innerHTML = '<b>Solo:</b> play alone, entirely in this browser. Saves stay in this browser.'; return; }
    if (!s) { el.innerHTML = 'Co-op server not reachable. Solo still works.'; return; }
    const names = s.names && s.names.length ? ' (' + s.names.map((n) => n.replace(/[<>&"]/g, '')).join(', ') + ')' : '';
    el.innerHTML = `<b>Co-op:</b> ${s.players}/${s.max} playing now${names}. Pick a hero from this browser and join the shared world. Progress saves to this browser.`;
  }

  renderSaves() {
    const list = heroList(this.store), el = $('saveList'); el.innerHTML = '';
    $('noSaves').classList.add('hidden');
    for (const ch of list) {
      const H = heroOf(ch.cls), C = CLASSES[ch.cls], lk = !heroOk(ch.cls);
      const d = document.createElement('div'); d.className = 'save-card' + (lk ? ' locked' : ''); d.dataset.cls = ch.cls; d.style.setProperty('--c', C.color);
      const cv = document.createElement('canvas'); cv.width = cv.height = 112;
      drawPortrait(cv, ch.cls, (k) => drawHeroThumb(k, ch.cls, ch.appearance));
      d.appendChild(cv);
      const info = document.createElement('div'); info.className = 'info';
      info.innerHTML = `${esc(H.name)} <span class="ttl" style="color:${C.color}">${esc(H.title)}</span><small>${lk ? `🔒 ${LOCKED_TEXT}` : `Lv ${ch.level} ${C.name} · ${H.role} · ${ch.kills} kills`}</small>`;
      d.appendChild(info);
      d.onclick = () => { this.sel.cls = ch.cls; this.refresh(); };
      const play = document.createElement('button'); play.className = 'btn small'; play.textContent = lk ? '🔒' : 'Play'; play.disabled = lk; if (lk) play.title = LOCKED_TEXT; play.onclick = (e) => { e.stopPropagation(); this.play(heroFor(this.store, ch.cls)); };
      d.appendChild(play);
      el.appendChild(d);
    }
    this.refresh();
    this.renderHostHeroes();
  }

  // the selected hero's showcase model on a soft stage in its glow colour (idle loop; the still while the loop decodes)
  drawPreview(cv) {
    const mobile = /\/mobile\//.test(location.pathname) || document.body.classList.contains('rb-touch'), kind = sheetKind(mobile);
    const dpr = Math.min(mobile ? 1.5 : 2, window.devicePixelRatio || 1), W = Math.max(64, Math.round((cv.clientWidth || 260) * dpr)), H = Math.max(64, Math.round((cv.clientHeight || 260) * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const cls = this.sel.cls, M = MODELS[modelOf(cls)], glow = (M && M.glow) || '#ffd23f', g = cv.getContext('2d');
    if (!this.preloaded) { this.preloaded = true; preloadAll(kind, cls); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2a2236'); bg.addColorStop(1, '#151019'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const fy = H * 0.9, cx = W / 2;
    const halo = g.createRadialGradient(cx, H * 0.5, 0, cx, H * 0.5, H * 0.62); halo.addColorStop(0, glow + '55'); halo.addColorStop(1, glow + '00'); g.fillStyle = halo; g.fillRect(0, 0, W, H);
    g.save(); g.translate(cx, fy); g.scale(1, 0.26); const fl = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.4); fl.addColorStop(0, glow + '66'); fl.addColorStop(1, glow + '00'); g.fillStyle = fl; g.beginPath(); g.arc(0, 0, W * 0.4, 0, Math.PI * 2); g.fill(); g.restore();
    const k = fitScale([cls], { x: cx, y: fy, bounds: [4, 4, W - 4, H - 2], max: H / 640 });
    this.view.draw(g, cls, { x: cx, y: fy, k, t: this.t, kind });
  }

  loop(now) {
    if (!this.active) return;
    const dt = Math.min(0.05, (now - (this.lastT || now)) / 1000); this.lastT = now;
    this.t += dt;
    const cv = $('preview'); if (cv) try { this.drawPreview(cv); } catch { /* cosmetic */ }
    requestAnimationFrame((t) => this.loop(t));
  }
}
