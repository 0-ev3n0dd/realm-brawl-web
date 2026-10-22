// "Play on your phone" helpers for the desktop page: phone link + QR code popup.
import qrcode from '../vendor/qrcode.mjs';

const $ = (id) => document.getElementById(id);
const isLocal = () => /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname);

/** QR code as a boolean matrix (true = dark). */
export function qrMatrix(text, ec = 'M') {
  const q = qrcode(0, ec); q.addData(text); q.make();
  const n = q.getModuleCount(), m = [];
  for (let y = 0; y < n; y++) { const row = []; for (let x = 0; x < n; x++) row.push(q.isDark(y, x)); m.push(row); }
  return m;
}
/** Draw a QR code (with a 4-module quiet zone) into a canvas. */
export function drawQr(canvas, text, px = 240) {
  const m = qrMatrix(text), n = m.length, q = 4, cell = Math.max(2, Math.floor(px / (n + q * 2)));
  const size = cell * (n + q * 2);
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
  g.fillStyle = '#000';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) g.fillRect((x + q) * cell, (y + q) * cell, cell, cell);
  return n;
}

/** Link a phone can open: the public invite link (host) or this site's own address (friends/LAN). */
export async function phoneUrl() {
  let url = null;
  try { url = (await (await fetch('/api/invite', { cache: 'no-store' })).json()).url; } catch {}
  if (!url && !isLocal()) url = location.origin + '/';
  return url ? url.replace(/\/?$/, '/') + 'mobile/' : null;
}

/** Popup with the friend link (optional) and a QR code for the phone link. */
export function showPhonePopup({ phone, friends = null }) {
  const pop = $('phonePop');
  if (!pop) return;
  $('phoneFriends').classList.toggle('hidden', !friends);
  if (friends) $('phoneFriendsUrl').textContent = friends;
  $('phoneUrl').textContent = phone;
  drawQr($('phoneQr'), phone, 232);
  pop.classList.remove('hidden');
  pop.onclick = (e) => { if (e.target === pop || e.target.id === 'phoneClose') pop.classList.add('hidden'); };
}

/** Menu footer note: "On your phone? ..." (QR when a public link exists). */
export async function setupPhoneLink() {
  const el = $('phoneLink');
  if (!el) return;
  const url = await phoneUrl();
  if (url) {
    el.innerHTML = 'On your phone? <a href="#" id="phoneQrBtn">scan the QR code</a> or open <b></b>';
    el.querySelector('b').textContent = url;
    $('phoneQrBtn').onclick = (e) => { e.preventDefault(); showPhonePopup({ phone: url }); };
  } else {
    el.innerHTML = 'On your phone? open <a href="/realm-brawl-web/mobile/">/mobile</a> on the invite link (start the game with "Play Realm Brawl.bat" to get one).';
  }
}
