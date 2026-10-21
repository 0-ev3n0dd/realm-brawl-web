// CONCEPT mock-up: standalone scripted animation (not the game sim). Placeholder numbers.
(() => {
const INK = '#2b2433', PINK = '#ff8cc6', W = 1100, H = 560, T0 = -2.5, T1 = 60;
const CH = { 'Moonlit Guard': 3, 'Twin Moons': 4, 'Void Echo': 5, 'Moment of Death': 6, 'Stillwater Execution': 8 };
const HIT = 2600, PER_CUT = 420, OPC_MUL = 2, RESH = 6, SPEC_CD = 20;
function route(kind) {
  const ev = [];
  const chain = (t, n) => ev.push({ t, k: 'chain', n });
  const spec = (t) => { [0, .5, 1].forEach((d, i) => ev.push({ t: t + d, k: 'wave', i })); ev.push({ t: t + 1.5, k: 'fin' }); ev.push({ t, k: 'spec' }); };
  if (kind === 'good') {
    ev.push({ t: -2.2, k: 'draw' }, { t: -0.2, k: 'drawbank', n: 3 });
    for (const s of [0, 20, 40]) {
      spec(s);
      const third = s === 40;
      chain(s + 2.5, 'Stillwater Execution'); chain(s + 4.5, 'Moment of Death');
      if (third) ev.push({ t: s + 6.8, k: 'opc' }); else chain(s + 6.5, 'Void Echo');
      if (s < 40) { chain(s + 9, 'Twin Moons'); chain(s + 11, 'Moonlit Guard'); chain(s + 13, 'Stillwater Execution'); chain(s + 15.5, 'Moment of Death'); chain(s + 17.5, 'Void Echo'); }
      else { chain(s + 9, 'Twin Moons'); chain(s + 11, 'Stillwater Execution'); chain(s + 13.5, 'Moment of Death'); chain(s + 15.5, 'Void Echo'); chain(s + 17.5, 'Moonlit Guard'); }
    }
  } else {
    chain(1, 'Moonlit Guard'); spec(3); chain(6, 'Twin Moons'); chain(9.5, 'Moonlit Guard'); chain(13, 'Void Echo'); chain(17, 'Twin Moons'); chain(21, 'Moment of Death');
    spec(26); chain(29, 'Twin Moons'); chain(32.5, 'Moonlit Guard'); ev.push({ t: 36, k: 'opc' }); chain(40, 'Void Echo'); chain(44, 'Twin Moons');
    spec(49); chain(52.5, 'Moonlit Guard'); chain(56, 'Void Echo'); chain(59, 'Twin Moons');
  }
  return ev.sort((a, b) => a.t - b.t);
}
// pure simulation of a route -> state over time
function play(ev, upTo, on) {
  let bank = 0, dmg = 0, resh = -99, lastSpec = -99, waveBase = 0;
  for (const e of ev) {
    if (e.t > upTo) break;
    let rel = 0, add = 0;
    if (e.k === 'drawbank') add = e.n;
    if (e.k === 'chain') { add = CH[e.n] * (e.t < resh + RESH && e.t >= resh ? 2 : 1); dmg += HIT * (1 + CH[e.n] / 8); }
    if (e.k === 'spec') { lastSpec = e.t; waveBase = bank; }
    if (e.k === 'wave') { rel = Math.min(bank, Math.round(waveBase * 0.2)); dmg += HIT; }
    if (e.k === 'fin') { rel = bank; resh = e.t; dmg += HIT * 2; }
    if (e.k === 'opc') { const inR = e.t >= resh && e.t < resh + RESH; rel = bank; dmg += rel * PER_CUT * ((inR ? OPC_MUL : 1) - 1) + HIT * 2; e.mul = inR ? OPC_MUL : 1; }
    bank += add; bank -= rel; dmg += rel * PER_CUT;
    if (on) on(e, add, rel);
  }
  return { bank, dmg, resh, lastSpec };
}
const routes = { good: route('good'), sloppy: route('sloppy') };
const totals = { good: play(routes.good, 99).dmg, sloppy: play(routes.sloppy, 99).dmg };
// ---------- render state ----------
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let kind = 'good', t = T0, speed = 1, paused = false, fxs = [], seen = 0, last = performance.now();
const P = { x: 400, y: 330 }, B = { x: 730, y: 320 };
function reset() { t = T0; fxs = []; seen = 0; }
function spawn(e, add, rel) {
  if (e.k === 'chain') fxs.push({ k: 'slash', t: e.t, d: 0.35 }, { k: 'title', t: e.t, d: 1.1, s: e.n }, { k: 'plus', t: e.t, d: 0.9, s: `+${add} cuts${add > CH[e.n] ? ' (x2)' : ''}` });
  if (e.k === 'drawbank') fxs.push({ k: 'plus', t: e.t, d: 1.2, s: `+${add} cuts` }, { k: 'title', t: e.t, d: 1.1, s: 'Held draw (pre-pull)' });
  if (e.k === 'spec') fxs.push({ k: 'title', t: e.t, d: 1.8, s: 'Iaijutsu: Void Draw', big: 1 }, { k: 'line', t: e.t, d: 0.5 });
  if (e.k === 'wave' || e.k === 'fin') fxs.push({ k: 'burst', t: e.t, d: 0.55, n: rel, big: e.k === 'fin' }, { k: 'num', t: e.t, d: 1, dy: (e.i || 0) * -34, s: (rel * PER_CUT).toLocaleString(), big: e.k === 'fin' });
  if (e.k === 'fin') fxs.push({ k: 'title', t: e.t, d: 1.3, s: 'Resheathe: 6 s of double banking' });
  if (e.k === 'opc') fxs.push({ k: 'title', t: e.t, d: 1.8, s: `One Perfect Cut ×${e.mul}`, big: 1 }, { k: 'line', t: e.t, d: 0.7, w: 1 }, { k: 'burst', t: e.t, d: 0.9, n: rel, big: 1 }, { k: 'num', t: e.t, d: 1.3, s: (rel * PER_CUT * e.mul).toLocaleString(), big: 1 });
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function text(s, x, y, size, col = '#fff', al = 'center') { ctx.font = `800 ${size}px "Baloo 2",system-ui,sans-serif`; ctx.textAlign = al; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = INK; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y); }
function blob(x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); }
function samurai(pose, sheathed) {
  const { x, y } = P; ctx.save(); ctx.translate(x, y);
  blob(0, 52, 34, 9, 'rgba(0,0,0,.25)'); ctx.lineWidth = 0;
  blob(0, 22, 26, 30, '#c2384f'); // hakama
  blob(0, -6, 22, 20, '#efe6f2'); // gi
  blob(0, -40, 22, 21, '#ffd9c2'); // head
  ctx.beginPath(); ctx.ellipse(0, -52, 22, 11, 0, Math.PI, 0); ctx.fillStyle = INK; ctx.fill();
  blob(0, -66, 7, 7, INK);
  ctx.fillStyle = INK; ctx.fillRect(5, -42, 4, 6); ctx.fillRect(12, -42, 4, 6);
  ctx.lineCap = 'round';
  if (sheathed) { ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-26, 16); ctx.lineTo(30, -2); ctx.stroke(); ctx.strokeStyle = '#4a3a6a'; ctx.lineWidth = 5; ctx.stroke(); }
  else { ctx.rotate(pose); ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(92, -10); ctx.stroke(); ctx.strokeStyle = '#eef3ff'; ctx.lineWidth = 4; ctx.stroke(); }
  ctx.restore();
}
function boar(hitk) {
  const { x, y } = B, sh = hitk > 0 ? Math.sin(hitk * 40) * 5 * hitk : 0; ctx.save(); ctx.translate(x + sh, y);
  blob(0, 78, 95, 16, 'rgba(0,0,0,.25)');
  blob(0, 10, 92, 70, hitk > 0.6 ? '#b98a6c' : '#8a5a3c');
  blob(-70, -6, 40, 36, hitk > 0.6 ? '#c99a78' : '#9c6a48');
  ctx.beginPath(); ctx.moveTo(-96, 6); ctx.quadraticCurveTo(-118, -12, -104, -36); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#f4ead6'; ctx.stroke();
  blob(-78, -18, 5, 5, '#ffcf4a');
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-10 + i * 20, -58); ctx.lineTo(-2 + i * 20, -78); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.restore(); text('GRIMTUSK', x, y - 110, 15, '#ffd6a8');
}
function cutMarks(n) { // banked cuts drawn on the boss as faint pink nicks
  const m = Math.min(n, 30); for (let i = 0; i < m; i++) { const a = i * 2.39, r = 18 + (i * 37 % 55); const x = B.x + Math.cos(a) * r * 1.2, y = B.y + 10 + Math.sin(a) * r * 0.8;
    ctx.strokeStyle = 'rgba(255,140,198,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 7, y + 5); ctx.lineTo(x + 7, y - 5); ctx.stroke(); }
}
function hud(st) {
  const x = W / 2 - 170, y = H - 104, w = 340, h = 22, max = 40;
  // cycle/Resheathe indicator sits on top of the cuts bar
  const since = t - st.lastSpec, inR = t >= st.resh && t < st.resh + RESH;
  const cdk = st.lastSpec < -50 ? 1 : Math.min(1, since / SPEC_CD);
  rr(x + 40, y - 16, w - 80, 9, 4); ctx.fillStyle = INK; ctx.fill();
  rr(x + 42, y - 14, (w - 84) * cdk, 5, 3); ctx.fillStyle = inR ? '#dfe8ff' : cdk >= 1 ? PINK : '#7c5a9c'; ctx.fill();
  text(inR ? `RESHEATHE ${(st.resh + RESH - t).toFixed(1)}s · cuts x2` : cdk >= 1 ? 'VOID DRAW READY' : `VOID DRAW ${(SPEC_CD - since).toFixed(0)}s`, x + w / 2, y - 26, 12, inR ? '#dfe8ff' : '#ffd6ec');
  if (inR) { ctx.save(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 10); rr(x - 3, y - 3, w + 6, h + 6, 14); ctx.strokeStyle = '#dfe8ff'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); }
  rr(x, y, w, h, h / 2); ctx.fillStyle = INK; ctx.fill();
  const k = Math.min(1, st.bank / max);
  if (k > 0) { ctx.save(); rr(x + 2, y + 2, w - 4, h - 4, 9); ctx.clip(); const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#b0467e'); g.addColorStop(.55, PINK); g.addColorStop(1, '#fff3fa'); ctx.fillStyle = g; ctx.fillRect(x + 2, y + 2, (w - 4) * k, h - 4); ctx.restore(); }
  text(`DELAYED CUTS ${st.bank}`, x + w / 2, y + h / 2 + 1, 13);
}
function timeline(ev) {
  const x = 40, y = H - 40, w = W - 80;
  const X = (tt) => x + (tt - T0) / (T1 - T0) * w;
  rr(x, y - 6, w, 12, 6); ctx.fillStyle = 'rgba(43,36,51,.85)'; ctx.fill();
  for (const e of ev) {
    if (e.k === 'fin') { ctx.fillStyle = 'rgba(223,232,255,.35)'; ctx.fillRect(X(e.t), y - 6, X(e.t + RESH) - X(e.t), 12); }
  }
  for (const e of ev) {
    if (e.k === 'chain') { ctx.fillStyle = PINK; ctx.fillRect(X(e.t) - 1, y - 4, 2 + CH[e.n] * 0.5, 8); }
    if (e.k === 'spec') text('◆', X(e.t), y, 13, '#ffd6ec');
    if (e.k === 'opc') text('★', X(e.t), y, 15, '#ffe27a');
    if (e.k === 'draw') text('◇', X(e.t), y, 12, '#dfe8ff');
  }
  for (let s = 0; s <= 60; s += 10) text(`${s}s`, X(s), y + 18, 10, '#bfb2cf');
  ctx.fillStyle = '#fff'; ctx.fillRect(X(Math.min(t, T1)) - 1.5, y - 12, 3, 24);
}
function side(st) {
  const x = W - 24; text('CONCEPT', x, 26, 13, PINK, 'right');
  const tt = Math.max(0.5, Math.min(t, T1));
  text(`${kind === 'good' ? 'Clean' : 'Sloppy'} route · ${Math.max(0, t).toFixed(1)}s`, x, 48, 14, '#fff', 'right');
  text(`DPS ${Math.round(st.dmg / tt).toLocaleString()}`, x, 70, 16, '#ffe27a', 'right');
  text(`60 s: clean ${Math.round(totals.good / 60).toLocaleString()} · sloppy ${Math.round(totals.sloppy / 60).toLocaleString()} DPS`, x, 92, 12, '#bfb2cf', 'right');
  text('◆ Void Draw   ★ One Perfect Cut   ▮ chain (wider = more cuts)   ▭ Resheathe', 40, H - 70, 11, '#bfb2cf', 'left');
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!paused) { t += dt * speed; if (t > T1 + 2) reset(); }
  const ev = routes[kind];
  // recompute state up to t, and spawn FX for newly crossed events
  const fresh = []; const st = play(ev, t, (e, a, r) => { if (!e._spawned || e._spawned.k !== kind || e._spawned.r !== runId) fresh.push([e, a, r]); });
  for (const [e, a, r] of fresh) { e._spawned = { k: kind, r: runId }; if (t - e.t < 0.3) spawn(e, a, r); }
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a2f4d'); g.addColorStop(1, '#241d30'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4a3d5e'; ctx.beginPath(); ctx.ellipse(W / 2, 400, 470, 70, 0, 0, 7); ctx.fill();
  fxs = fxs.filter((f) => t - f.t < f.d && t >= f.t - 0.01);
  const hitk = Math.max(0, ...fxs.filter((f) => f.k === 'burst' || f.k === 'slash').map((f) => 1 - (t - f.t) / f.d));
  boar(hitk); cutMarks(st.bank);
  const recent = ev.filter((e) => e.t <= t && t - e.t < 0.35 && (e.k === 'chain' || e.k === 'wave' || e.k === 'opc'));
  const drawing = ev.some((e) => e.k === 'draw' && t >= e.t && t < e.t + 2);
  const inR = t >= st.resh && t < st.resh + RESH;
  samurai(recent.length ? -0.9 + (t - recent[recent.length - 1].t) * 5 : 0.4, drawing || (inR && !recent.length));
  if (drawing) { ctx.save(); ctx.globalAlpha = 0.4 + 0.3 * Math.sin(t * 12); blob(P.x, P.y, 44 + 6 * Math.sin(t * 6), 64, 'rgba(223,232,255,.12)'); ctx.restore(); }
  for (const f of fxs) {
    const k = (t - f.t) / f.d;
    if (f.k === 'slash') { ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fff'; ctx.lineWidth = 7 * (1 - k) + 1; ctx.beginPath(); ctx.arc(B.x - 40, B.y, 110, -1.1, -1.1 + 2.2 * Math.min(1, k * 3)); ctx.stroke(); ctx.restore(); }
    if (f.k === 'line') { ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.w ? '#ffe27a' : '#dfe8ff'; ctx.lineWidth = (f.w ? 16 : 10) * (1 - k) + 2; ctx.beginPath(); ctx.moveTo(60, B.y + 20); ctx.lineTo(W - 60, B.y - 30); ctx.stroke(); ctx.restore(); }
    if (f.k === 'burst') { ctx.save(); ctx.globalAlpha = 1 - k; const n = Math.min(14, 4 + f.n); for (let i = 0; i < n; i++) { const a = i / n * 6.28 + f.t; const r0 = 30 + k * (f.big ? 150 : 100); ctx.strokeStyle = i % 2 ? PINK : '#fff'; ctx.lineWidth = f.big ? 5 : 3; ctx.beginPath(); ctx.moveTo(B.x + Math.cos(a) * r0, B.y + Math.sin(a) * r0 * 0.8); ctx.lineTo(B.x + Math.cos(a) * (r0 + 26), B.y + Math.sin(a) * (r0 + 26) * 0.8); ctx.stroke(); } ctx.restore(); }
    if (f.k === 'num') { ctx.save(); ctx.globalAlpha = Math.min(1, 2 * (1 - k)); text(f.s, B.x + 120, B.y - 40 + (f.dy || 0) - k * 40, f.big ? 28 : 20, f.big ? '#ffe27a' : '#ffd6ec'); ctx.restore(); }
    if (f.k === 'plus') { ctx.save(); ctx.globalAlpha = Math.min(1, 2 * (1 - k)); text(f.s, B.x - 130, B.y - 50 - k * 30, 16, PINK); ctx.restore(); }
  }
  const titles = fxs.filter((f) => f.k === 'title'); const ti = titles[titles.length - 1];
  if (ti) { const k = (t - ti.t) / ti.d; ctx.save(); ctx.globalAlpha = Math.min(1, 3 * (1 - k)); text(ti.s, W / 2, 70, ti.big ? 30 : 22, ti.big ? '#ffe27a' : '#fff'); ctx.restore(); }
  hud(st); timeline(ev); side(st);
  window.__cuts = { t, kind, bank: st.bank, dmg: st.dmg, totals };
  requestAnimationFrame(frame);
}
let runId = 0; const _reset = reset; reset = function () { runId++; _reset(); };
document.getElementById('play').onclick = (e) => { paused = !paused; e.target.textContent = paused ? '▶ Play' : '❚❚ Pause'; };
document.getElementById('restart').onclick = () => reset();
document.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { speed = +b.dataset.s; document.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', x === b)); });
document.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { kind = b.dataset.r; reset(); document.querySelectorAll('[data-r]').forEach((x) => x.classList.toggle('on', x === b)); });
window.__cutsCtl = { seek: (s) => { runId++; fxs = []; t = s; }, setKind: (k) => { kind = k; reset(); }, pause: (v) => { paused = v; } };
requestAnimationFrame(frame);
})();
