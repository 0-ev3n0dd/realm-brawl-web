// Bard (Battle Conductor): music made visible. Pink + gold like the engine's own notes and song rings, but sharper and on the beat:
// five-line staffs sweeping out, vector notes, sound-wave arcs, stacked "chord" rings that pulse every 0.12 s, rising green-gold hymn halos,
// jagged glitch rings with sharps and flats for Dissonance, crescendo hairpins that swell, and a black-pink bell with dripping ink for the Requiem.
// Song colours follow the engine: Valor orange, Haste cyan, Mending green, Requiem violet.
import { TAU, clamp, seeded } from './fxsk_core.js';
import { bloom, ease } from './fxglow.js';

const PK = '#ff7ad9', HOT = '#ff4fa8', GD = '#ffe27a', GH = '#fff3b0', GR = '#7dff9a', GRH = '#e0ffd0', VI = '#b48cff', SR = '#a6ff3a', CY = '#7af0ff', OR = '#ff9a4a';
const SONGS = [OR, CY, GR, VI];
const BEAT = 0.12; // one beat: pieces of a phrase are staggered by this many seconds

// ------------------------------------------------------------------ small vector music drawing (no fonts)
function note(ctx, x, y, s, rot) { // an eighth note with the head at (x,y)
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.3, -0.4, 0, TAU); ctx.fill();
  ctx.fillRect(s * 0.3, -s * 1.15, s * 0.1, s * 1.15);
  ctx.beginPath(); ctx.moveTo(s * 0.4, -s * 1.15); ctx.quadraticCurveTo(s * 0.95, -s * 0.9, s * 0.7, -s * 0.4); ctx.quadraticCurveTo(s * 0.8, -s * 0.8, s * 0.4, -s * 0.85); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function notePair(ctx, x, y, s, rot) { // two beamed eighth notes
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
  for (const dx of [-s * 0.5, s * 0.5]) { ctx.beginPath(); ctx.ellipse(dx, 0, s * 0.4, s * 0.28, -0.4, 0, TAU); ctx.fill(); ctx.fillRect(dx + s * 0.28, -s * 1.1, s * 0.1, s * 1.1); }
  ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 1.1); ctx.lineTo(s * 0.78, -s * 1.1); ctx.lineTo(s * 0.78, -s * 0.8); ctx.lineTo(-s * 0.2, -s * 0.8); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function accid(ctx, flat, x, y, s, lw) { // a sharp or a flat sign
  ctx.lineCap = 'round'; ctx.lineWidth = lw; ctx.beginPath();
  if (flat) { ctx.moveTo(x - s * 0.2, y - s * 1.1); ctx.lineTo(x - s * 0.2, y + s * 0.75); ctx.moveTo(x - s * 0.2, y + s * 0.05); ctx.bezierCurveTo(x + s * 0.55, y - s * 0.4, x + s * 0.65, y + s * 0.55, x - s * 0.2, y + s * 0.78); ctx.stroke(); return; }
  ctx.moveTo(x - s * 0.2, y - s * 0.95); ctx.lineTo(x - s * 0.2, y + s * 1.05); ctx.moveTo(x + s * 0.2, y - s * 1.05); ctx.lineTo(x + s * 0.2, y + s * 0.95); ctx.stroke();
  ctx.lineWidth = lw * 1.9; ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.12); ctx.lineTo(x + s * 0.5, y - s * 0.4); ctx.moveTo(x - s * 0.5, y + s * 0.4); ctx.lineTo(x + s * 0.5, y + s * 0.12); ctx.stroke();
}

export default {
  pal: { a: '#ff7ad9', b: '#ffe27a', hi: '#ffe9f8', deep: '#240a28', ink: '#14041a', edge: '#ffc0ee' },
  skills: {
    sonic_riff(k) { // a five-line staff shoots down the aim, three sound-wave arcs ride it on the beat, notes fly off the tip
      const tip = k.ahead(430);
      k.staff({ x: k.x, y: k.y - 16, ang: k.ang, len: 430, notes: 5, gap: 10, amp: 9, col: PK, hi: GH, d: 0.02, life: 0.7 });
      k.streak({ x: k.x, y: k.y - 14, ang: k.ang, len: 430, w: 9, col: PK, hi: '#fff', d: 0.02, life: 0.38, ticks: 4 });
      for (let i = 0; i < 3; i++) { const p = k.ahead(70 + i * 120); k.wave({ x: p.x, y: p.y - 10, ang: k.ang, arc: 1.1, r: 100, n: 1, w: 12, col: i % 2 ? GD : PK, hi: '#fff', d: 0.04 + i * BEAT, life: 0.42 }); }
      k.motes({ x: tip.x, y: tip.y, n: 9, type: 'note', spd: 200, size: 6, col: PK, col2: GD, ang: k.ang, spread: 1.2, g: -60, d: 0.14 });
      k.burst({ x: tip.x, y: tip.y - 8, n: 8, len: 70, col: GD, d: 0.16, opt: true });
    },
    echo_chord(k) { // a chord of stacked rings on the first target, then it hops zig-zag four times, each ring a little bigger (the bounce grows +25%)
      let px = k.tx, py = k.ty;
      k.bard_rings({ x: px, y: py, R: 120, n: 3, beat: BEAT, col: PK, hi: GH, d: 0.05 });
      k.bard_note({ x: px, y: py - 20, size: 20, rise: 90, col: GD, hi: '#fff', pair: true, d: 0.08, life: 0.7 });
      for (let i = 1; i <= 4; i++) {
        const an = k.ang + (i % 2 ? 0.8 : -0.8), nx = px + Math.cos(an) * 140, ny = py + Math.sin(an) * 100, d = 0.05 + i * BEAT;
        k.streak({ x: px, y: py - 14, ang: Math.atan2(ny - py, nx - px), len: Math.hypot(nx - px, ny - py), w: 7, col: i % 2 ? GD : PK, hi: '#fff', d: d - 0.06, life: 0.3, ticks: 2 });
        k.bard_rings({ x: nx, y: ny, R: 80 + i * 18, n: 2, beat: BEAT, col: i % 2 ? GD : PK, hi: GH, d });
        if (i % 2) k.motes({ x: nx, y: ny - 12, n: 4, type: 'note', spd: 120, size: 5, col: GD, col2: PK, g: -80, ang: -Math.PI / 2, spread: 1.6, d, opt: true });
        px = nx; py = ny;
      }
    },
    healing_hymn(k) { // three warm halos rise off the bard on the beat inside a green-gold rune circle, green-gold motes drift up
      k.sigil({ x: k.x, y: k.y, R: 300, n: 4, col: GR, hi: GRH, b: GD, life: 1.5, hold: 0.7 });
      k.bard_halo({ x: k.x, y: k.y, R: 150, h: 170, n: 3, beat: BEAT, col: GR, hi: GRH, b: GD, d: 0.04 });
      k.ring({ x: k.x, y: k.y, R: 380, n: 2, w: 16, col: GR, d: 0.1 });
      k.motes({ x: k.x, y: k.y, n: 30, type: 'star', spd: 70, g: -90, size: 5, col: GR, col2: GD, ang: -Math.PI / 2, spread: 2.6, R0: 260, mix: 0.5, life: 1.5 });
      k.motes({ x: k.x, y: k.y - 10, n: 6, type: 'note', spd: 80, g: -70, size: 6, col: GD, col2: '#fff', ang: -Math.PI / 2, spread: 2.2, R0: 120, d: 0.1, life: 1.4, opt: true });
    },
    dissonance(k) { // three jagged glitch arcs fill the 240 px cone on the beat, sour sharps and flats flicker up, violet bolts crack across it
      for (let i = 0; i < 3; i++) k.bard_zig({ x: k.x, y: k.y - 10, a0: k.ang - 0.7, sw: 1.4, R: 90 + i * 70, amp: 12 + i * 3, sq: 1, flat: false, col: VI, b: SR, hi: '#fff', d: 0.04 + i * BEAT, life: 0.55 });
      for (let i = 0; i < 4; i++) { const p = k.ahead(90 + i * 45, (i % 2 ? 1 : -1) * 55); k.bard_accid({ x: p.x, y: p.y, flat: i % 2 === 0, size: 24, rise: 60, col: i % 2 ? SR : VI, b: i % 2 ? VI : SR, d: 0.08 + i * 0.07, life: 0.65 }); }
      for (const s of [-1, 1]) { const p = k.ahead(230, s * 90); k.bolt({ x: k.x, y: k.y - 14, x2: p.x, y2: p.y, forks: 2, w: 4, col: VI, hi: SR, d: 0.06, life: 0.4 }); }
      k.motes({ x: k.ahead(120).x, y: k.ahead(120).y, n: 12, type: 'note', spd: 280, size: 6, col: VI, col2: SR, ang: k.ang, spread: 1.4, g: 80, d: 0.08, mix: 0.5 });
      k.shake(0.2);
    },
    crescendo(k) { // rings that get louder and louder: five staff rings on the beat (each thicker), four hairpins "<" swell outward, then the 330 px shockwave
      k.bard_rings({ x: k.x, y: k.y, R: 330, n: 5, beat: BEAT, rd: 0.6, grow: true, cols: [PK, GD, PK, GD, '#fff'], hi: GH, d: 0.3 });
      for (let i = 0; i < 5; i++) k.ring({ x: k.x, y: k.y, R: 90 + i * 60, n: 1, w: 10 + i * 5, col: i % 2 ? GD : PK, d: 0.3 + i * BEAT, opt: i > 2 });
      for (let i = 0; i < 4; i++) k.bard_hairpin({ x: k.x, y: k.y - 10, ang: i * TAU / 4 + 0.4, len: 330, spread: 0.3, col: PK, hi: GH, d: 0.3, life: 0.7 });
      k.burst({ x: k.x, y: k.y - 14, n: 14, len: 250, col: GD, hi: PK, d: 0.62 });
      k.motes({ x: k.x, y: k.y - 14, n: 30, type: 'note', spd: 450, size: 8, col: PK, col2: GD, spread: TAU, g: 120, d: 0.62, mix: 0.5 });
      k.kick(0.05); k.shake(0.6);
    },
  },
  basic(k, ev) { // a tiny strum: a short sound arc plus one note; the third strum (chord ring) stacks three thin staff rings
    if (ev.idx === 2) {
      k.bard_rings({ x: k.x, y: k.y, R: 150, n: 3, beat: 0.06, rd: 0.4, col: GD, hi: GH, d: 0.06 });
      k.motes({ x: k.x, y: k.y - 14, n: 6, type: 'note', spd: 200, size: 6, col: PK, col2: GD, spread: TAU, g: -30, d: 0.08 });
      return;
    }
    const p = k.ahead(28);
    k.wave({ x: p.x, y: p.y - 10, ang: k.ang, arc: 0.9, r: 64, n: 1, w: 6, col: ev.idx ? GD : PK, hi: '#fff', d: 0.03, life: 0.3 });
    k.bard_note({ x: p.x, y: p.y - 8, dx: Math.cos(k.ang) * 40, size: 11, rise: 34, col: ev.idx ? GD : PK, hi: '#fff', d: 0.04, life: 0.45 });
  },
  ult(k) { // Encore: a curtain call. Four song-coloured rings roll out on the beat, stage-light pillars, a gold rune circle, notes rising like applause
    const x = k.x, y = k.y;
    k.sigil({ x, y, R: 290, n: 8, col: GD, hi: '#fff', b: PK, d: 0.1, life: 2.2, hold: 0.8 });
    SONGS.forEach((c, i) => { k.ring({ x, y, R: 150 + i * 45, n: 2, w: 24, col: c, d: 0.3 + i * BEAT }); k.bard_rings({ x, y, R: 290, n: 1, rd: 0.7, col: c, hi: '#fff', d: 0.3 + i * BEAT }); });
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2; k.pillar({ x: x + Math.cos(a) * 230, y: y + Math.sin(a) * 140, h: 420, w: 6, col: i % 2 ? GD : PK, hi: '#fff', d: 0.2 + i * BEAT * 0.5, life: 1.0 }); }
    k.bard_hairpin({ x, y: y - 20, ang: -Math.PI / 2, len: 360, spread: 0.45, col: GD, hi: GH, d: 0.3, life: 0.9 });
    for (let i = 0; i < 4; i++) k.bard_note({ x: x + (i - 1.5) * 70, y: y - 30, size: 26, rise: 150 + i * 20, sway: 12, col: i % 2 ? GD : PK, hi: '#fff', pair: i % 2 === 0, d: 0.4 + i * BEAT, life: 1.1 });
    k.burst({ x, y: y - 20, n: 18, len: 290, col: GD, hi: GH, d: 0.3 });
    k.motes({ x, y, n: 36, type: 'star', spd: 80, g: -110, size: 6, col: GD, col2: PK, ang: -Math.PI / 2, spread: 2.8, R0: 230, d: 0.3, mix: 0.5, life: 1.8 });
    k.kick(0.05); k.shake(0.8);
  },
  chains: {
    power_chord(k, s) { // two riffs back to back (Valor orange + pink), landing as a power chord: two stacked notes over a root ring
      for (let i = 0; i < 2; i++) { const a = k.ang + (i ? 0.07 : -0.07); k.staff({ x: k.x, y: k.y - 16, ang: a, len: 460, notes: 4, gap: 13, amp: 8, col: i ? OR : PK, hi: i ? '#ffe0b8' : GH, d: i * BEAT, life: 0.65 }); k.streak({ x: k.x, y: k.y - 14, ang: a, len: 460, w: 12, col: i ? OR : PK, hi: '#fff', d: i * BEAT, life: 0.35, ticks: 3 }); }
      k.bard_rings({ x: s.x, y: s.y, R: 125, n: 3, beat: BEAT, cols: [OR, PK, GD], hi: GH, d: 0.12 });
      k.bard_note({ x: s.x - 14, y: s.y - 10, size: 26, rise: 70, col: OR, hi: '#fff', d: 0.14, life: 0.7 }); k.bard_note({ x: s.x + 20, y: s.y - 26, size: 26, rise: 80, col: PK, hi: '#fff', d: 0.14, life: 0.7 });
      k.burst({ x: s.x, y: s.y - 10, n: 10, len: 110, col: OR, d: 0.14 });
    },
    quickstep(k, s) { // a cyan dancing step: ghost silhouettes dash forward, a cyan riff follows, little footfall notes pop on the beat (Haste)
      const e = k.ahead(160);
      k.ghost({ x: k.x, y: k.y, x2: e.x, y2: e.y, n: 5, col: CY, hi: '#fff', size: 15, life: 0.55 });
      k.streak({ x: e.x, y: e.y - 14, ang: k.ang, len: 440, w: 10, col: CY, hi: '#fff', d: 0.1, life: 0.35, ticks: 4 });
      k.staff({ x: e.x, y: e.y - 16, ang: k.ang, len: 440, notes: 4, gap: 9, amp: 7, col: CY, hi: '#e8fdff', d: 0.1, life: 0.6 });
      for (let i = 0; i < 3; i++) { const p = k.ahead(30 + i * 55, (i % 2 ? 1 : -1) * 18); k.motes({ x: p.x, y: p.y + 8, n: 3, type: 'note', spd: 60, size: 5, col: CY, col2: '#fff', g: -90, ang: -Math.PI / 2, spread: 1.4, d: i * BEAT, life: 0.7 }); k.wave({ x: p.x, y: p.y, ang: k.ang + Math.PI, arc: 1.4, r: 50, n: 1, w: 6, col: CY, d: i * BEAT, life: 0.3 }); }
      k.motes({ x: s.x, y: s.y - 10, n: 12, type: 'spark', spd: 300, size: 6, col: CY, col2: '#fff', spread: TAU, d: 0.16 });
    },
    soft_refrain(k, s) { // a gentle refrain: four soft green-gold echoes on the beat, each one lifting a halo off the target and healing the party
      for (let i = 0; i < 4; i++) { k.bard_rings({ x: s.x, y: s.y, R: 80 + i * 14, n: 1, rd: 0.7, col: i % 2 ? GD : GR, hi: GRH, d: 0.05 + i * BEAT * 1.5 }); k.bard_note({ x: s.x + (i - 1.5) * 34, y: s.y - 10, size: 16, rise: 80, sway: 10, col: i % 2 ? GD : GR, hi: '#fff', d: 0.08 + i * BEAT * 1.5, life: 0.9 }); }
      k.bard_halo({ x: s.x, y: s.y, R: 90, h: 130, n: 4, beat: BEAT * 1.5, rd: 0.9, col: GR, hi: GRH, b: GD, d: 0.05 });
      k.motes({ x: s.x, y: s.y, n: 22, type: 'leaf', spd: 60, g: -50, size: 7, col: GR, col2: GD, ang: -Math.PI / 2, spread: 2.4, sway: 24, R0: 70, life: 1.5 });
      k.ring({ x: k.x, y: k.y, R: 160, col: GR, d: 0.1 });
    },
    sour_note(k, s) { // one horribly sour note crashes down on the target: glitched violet-green note, a flat and a sharp, jagged ring and cracked ground
      k.bard_note({ x: s.x, y: s.y - 6, size: 46, fall: 380, col: VI, hi: SR, d: 0.04, life: 0.95 });
      k.bard_zig({ x: s.x, y: s.y, R: 130, amp: 14, col: VI, b: SR, hi: '#fff', d: 0.38, life: 0.6 });
      k.crack({ x: s.x, y: s.y, R: 140, n: 7, col: VI, hi: SR, d: 0.38 });
      k.bard_accid({ x: s.x - 70, y: s.y - 20, flat: true, size: 30, rise: 80, col: SR, b: VI, d: 0.42, life: 0.7 });
      k.bard_accid({ x: s.x + 74, y: s.y - 20, flat: false, size: 30, rise: 90, col: VI, b: SR, d: 0.46, life: 0.7 });
      k.shake(0.3);
    },
    anthem_of_valor(k, s) { // a marching anthem: three orange-pink riffs fan across the aim, one per beat, with march-step rings and rising valor sparks
      [-0.28, 0, 0.28].forEach((da, i) => { const a = k.ang + da, c = [OR, PK, GD][i]; k.staff({ x: k.x, y: k.y - 16, ang: a, len: 440, notes: 4, gap: 11, amp: 8, col: c, hi: c === OR ? '#ffc890' : '#fff', d: i * BEAT, life: 0.6 }); k.streak({ x: k.x, y: k.y - 14, ang: a, len: 440, w: 11, col: c, hi: c === OR ? '#ffc890' : '#fff', d: i * BEAT, life: 0.35, ticks: 3 }); const p = k.ahead(150 + i * 90, (i - 1) * 60); k.ring({ x: p.x, y: p.y, R: 90, col: c, d: i * BEAT + 0.05 }); });
      k.bard_hairpin({ x: k.x, y: k.y - 14, ang: k.ang, len: 440, spread: 0.3, col: OR, hi: '#ffe0b8', d: 0.05, life: 0.7 });
      k.motes({ x: s.x, y: s.y, n: 22, type: 'star', spd: 120, g: -100, size: 6, col: OR, col2: GD, ang: -Math.PI / 2, spread: 2.6, R0: 90, d: 0.2, mix: 0.4, life: 1.2 });
      k.burst({ x: s.x, y: s.y - 10, n: 12, len: 130, col: OR, hi: '#ffe0b8', d: 0.3 });
    },
    battle_hymn(k, s) { // a choir burst: a pillar of green-gold light falls on the target inside a rune circle, halos rise on the beat, a valor-orange riff drives in
      k.streak({ x: k.x, y: k.y - 14, ang: Math.atan2(s.y - k.y, s.x - k.x), len: k.dist + 30, w: 10, col: OR, hi: '#fff', d: 0.02, life: 0.35, ticks: 3 });
      k.sigil({ x: s.x, y: s.y, R: 170, n: 6, col: GR, hi: GRH, b: GD, d: 0.15, life: 1.6, hold: 0.7 });
      k.pillar({ x: s.x, y: s.y + 10, h: 640, w: 9, col: GR, hi: GRH, d: 0.2, life: 1.0, down: true });
      k.bard_halo({ x: s.x, y: s.y, R: 120, h: 190, n: 3, beat: BEAT, col: GR, hi: GRH, b: GD, d: 0.25 });
      for (let i = 0; i < 5; i++) k.bard_note({ x: s.x + (i - 2) * 38, y: s.y - 20, size: 20, rise: 120 + (i % 2) * 40, sway: 10, col: i % 2 ? GD : GR, hi: '#fff', pair: i === 2, d: 0.3 + i * 0.06, life: 1.0, opt: i % 2 === 1 });
      k.motes({ x: s.x, y: s.y, n: 26, type: 'feather', spd: 100, g: -30, size: 8, col: GRH, col2: GD, ang: -Math.PI / 2, spread: 2.6, R0: 100, d: 0.25, life: 1.5 });
      k.burst({ x: s.x, y: s.y - 20, n: 10, len: 150, col: GR, hi: GRH, d: 0.22 });
    },
    discord_ballad(k, s) { // the second stun: a wide cone of glitching arcs (violet + sour green), bolts, sharps and flats, and a doubled glitch ring where both stuns meet
      for (let i = 0; i < 4; i++) k.bard_zig({ x: k.x, y: k.y - 10, a0: k.ang - 0.75, sw: 1.5, R: 80 + i * 60, amp: 14 + i * 3, sq: 1, flat: false, col: i % 2 ? SR : VI, b: i % 2 ? VI : SR, hi: '#fff', d: i * BEAT, life: 0.6 });
      for (const sd of [-1, 0, 1]) { const p = k.ahead(250, sd * 110); k.bolt({ x: k.x, y: k.y - 14, x2: p.x, y2: p.y, forks: 3, w: 4, col: VI, hi: SR, d: 0.1, life: 0.4 }); }
      for (let i = 0; i < 5; i++) { const p = k.ahead(80 + i * 40, (i % 2 ? 1 : -1) * 70); k.bard_accid({ x: p.x, y: p.y, flat: i % 2 === 0, size: 26, rise: 70, col: i % 2 ? SR : VI, b: i % 2 ? VI : SR, d: 0.1 + i * 0.06, life: 0.7 }); }
      k.bard_zig({ x: s.x, y: s.y, R: 120, amp: 12, col: SR, b: VI, hi: '#fff', d: 0.42, life: 0.55 }); k.bard_zig({ x: s.x, y: s.y, R: 80, amp: 10, col: VI, b: SR, hi: '#fff', d: 0.5, life: 0.5 });
      k.crack({ x: s.x, y: s.y, R: 150, n: 8, col: VI, hi: SR, d: 0.42 }); k.shake(0.35);
    },
    rondo(k, s) { // a round: three resonating pools bloom around the aim point (haste cyan, pink, gold) joined by a circling arc, each pulsing five times on the beat
      for (let i = 0; i < 3; i++) {
        const a = s.a0 + i * TAU / 3, px = s.x + Math.cos(a) * 130, py = s.y + Math.sin(a) * 85, c = [CY, PK, GD][i], d = i * BEAT * 2;
        k.bard_rings({ x: px, y: py, R: 150, n: 5, beat: BEAT, rd: 0.5, col: c, hi: '#fff', d: d + 0.05 });
        k.arc({ x: s.x, y: s.y, a0: a, sw: 2.2, r: 130, w: 14, col: c, hi: '#fff', d: d, life: 0.5, sq: 0.65 });
        k.bard_note({ x: px, y: py - 8, size: 20, rise: 90, col: c, hi: '#fff', pair: i === 1, d: d + 0.1, life: 0.9 });
      }
      k.motes({ x: s.x, y: s.y, n: 24, type: 'note', spd: 100, g: -80, size: 6, col: CY, col2: PK, ang: -Math.PI / 2, spread: 2.8, R0: 120, d: 0.2, mix: 0.5, life: 1.4 });
      k.flash({ x: s.x, y: s.y, R: 150, col: CY, d: 0.3, opt: true });
    },
    symphony_strike(k, s) { // the whole orchestra: four song-coloured staffs converge on the target from four sides on the beat, then a stacked chord detonates
      SONGS.forEach((c, i) => { const a = s.a0 + i * Math.PI / 2, d = i * BEAT; k.staff({ x: s.x - Math.cos(a) * 420, y: s.y - Math.sin(a) * 420 * 0.7 - 14, ang: Math.atan2(Math.sin(a) * 0.7, Math.cos(a)), len: 440, notes: 4, gap: 11, amp: 8, col: c, hi: '#fff', d, life: 0.55 }); k.streak({ x: s.x - Math.cos(a) * 420, y: s.y - Math.sin(a) * 420 * 0.7 - 14, ang: Math.atan2(Math.sin(a) * 0.7, Math.cos(a)), len: 420, w: 11, col: c, hi: '#fff', d, life: 0.35, ticks: 3 }); });
      const T = 4 * BEAT + 0.05;
      k.bard_rings({ x: s.x, y: s.y, R: 170, n: 4, beat: BEAT, cols: SONGS, hi: '#fff', d: T });
      for (let i = 0; i < 4; i++) k.bard_note({ x: s.x + (i - 1.5) * 34, y: s.y - 10 - (i % 2) * 24, size: 24, rise: 120, col: SONGS[i], hi: '#fff', d: T + i * 0.04, life: 0.9 });
      k.flash({ x: s.x, y: s.y, R: 190, col: GD, d: T }); k.burst({ x: s.x, y: s.y - 10, n: 16, len: 190, col: PK, hi: GH, d: T });
      k.motes({ x: s.x, y: s.y - 10, n: 24, type: 'note', spd: 380, size: 7, col: GD, col2: PK, spread: TAU, g: 100, d: T, mix: 0.5 }); k.shake(0.5);
    },
    ballad_of_heroes(k, s) { // a heroic ballad: golden angel-wings open behind the bard, a halo rises, and valor / haste / mending coloured rings roll out across 270 px
      k.wings({ x: k.x, y: k.y, span: 230, col: GD, hi: '#fff', life: 1.0 });
      k.bard_halo({ x: k.x, y: k.y, R: 120, h: 190, n: 3, beat: BEAT, col: GR, hi: GRH, b: GD, d: 0.1 });
      [OR, CY, GR].forEach((c, i) => k.ring({ x: k.x, y: k.y, R: 160 + i * 55, n: 2, w: 24, col: c, d: 0.25 + i * BEAT }));
      k.sigil({ x: k.x, y: k.y, R: 270, n: 3, col: GD, hi: '#fff', b: PK, d: 0.2, life: 1.8, hold: 0.7 });
      k.burst({ x: k.x, y: k.y - 30, n: 14, len: 250, col: GD, hi: GH, d: 0.3 });
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; k.bard_note({ x: k.x + Math.cos(a) * 140, y: k.y + Math.sin(a) * 80 - 10, size: 20, rise: 110, col: [OR, CY, GR][i % 3], hi: '#fff', d: 0.3 + i * 0.05, life: 1.0, opt: i % 2 === 1 }); }
      k.motes({ x: k.x, y: k.y, n: 28, type: 'star', spd: 80, g: -110, size: 6, col: GD, col2: '#fff', ang: -Math.PI / 2, spread: 2.8, R0: 200, d: 0.3, mix: 0.4, life: 1.6 });
      k.shake(0.3);
    },
    grand_overture(k, s) { // Overture: a giant golden five-line staff sweeps across the whole screen, crescendo hairpins swell above it, the target is struck by a chord
      const B = 0.45; // the full-screen finisher moment covers the first half second: the stage art lands after it
      const a = Math.atan2(s.y - k.y, s.x - k.x), L = Math.max(k.dist + 420, 900);
      k.staff({ x: k.x, y: k.y - 20, ang: a, len: L, notes: 11, gap: 30, amp: 22, col: GD, hi: GH, d: B + 0.02, life: 1.1 });
      k.staff({ x: k.x, y: k.y - 20, ang: a + 0.06, len: L, notes: 6, gap: 22, amp: 14, col: PK, hi: '#ffe9f8', d: B + BEAT, life: 1.0, opt: true });
      for (let i = 0; i < 2; i++) k.bard_hairpin({ x: k.x, y: k.y - 40, ang: a + (i ? 0.2 : -0.2), len: L * 0.8, spread: 0.2 + i * 0.1, col: i ? PK : GD, hi: '#fff', d: B + 0.1 + i * BEAT, life: 1.0 });
      k.bard_rings({ x: s.x, y: s.y, R: 240, n: 5, beat: BEAT, rd: 0.6, grow: true, cols: [GD, PK], hi: '#fff', d: B + 0.4 });
      for (let i = 0; i < 7; i++) k.bard_note({ x: s.x + (i - 3) * 60, y: s.y - 10, size: 24 + (i % 3) * 5, rise: 140 + (i % 3) * 40, sway: 10, col: i % 2 ? PK : GD, hi: '#fff', pair: i % 3 === 0, d: B + 0.4 + i * 0.05, life: 1.2, opt: i % 2 === 1 });
      k.burst({ x: s.x, y: s.y - 20, n: 18, len: 280, col: GD, hi: '#fff', d: B + 0.42 });
      k.sigil({ x: k.x, y: k.y, R: 280, n: 8, col: GD, hi: '#fff', b: PK, d: B + 0.05, life: 1.6, hold: 0.7 });
    },
    requiem_finale(k, s) { // a giant tuning fork strikes the target; violet-green sound arcs ring off its prongs, glitch rings and black-pink drips spread the Requiem
      const B = 0.45; // the full-screen finisher moment covers the first half second: the stage art lands after it
      k.bard_fork({ x: s.x, y: s.y + 40, size: 105, h: 360, col: VI, hi: '#d4bcff', d: B + 0.05, life: 1.7 });
      for (let i = 0; i < 4; i++) k.bard_zig({ x: s.x, y: s.y, R: 110 + i * 60, amp: 12 + i * 2, col: i % 2 ? SR : VI, b: i % 2 ? VI : SR, hi: '#fff', d: B + 0.4 + i * BEAT, life: 0.6 });
      k.crack({ x: s.x, y: s.y, R: 240, n: 10, col: VI, hi: SR, d: B + 0.4 });
      k.bard_drip({ x: s.x, y: s.y, R: 190, n: 10, h: 380, size: 8, col: VI, hi: HOT, d: B + 0.45, life: 1.3 });
      for (let i = 0; i < 4; i++) k.bard_accid({ x: s.x + (i - 1.5) * 90, y: s.y - 20, flat: i % 2 === 0, size: 30, rise: 100, col: i % 2 ? SR : VI, b: i % 2 ? VI : SR, d: B + 0.45 + i * 0.06, life: 0.9 });
      k.burst({ x: s.x, y: s.y - 20, n: 14, len: 240, col: VI, hi: SR, d: B + 0.4 }); k.shake(0.6);
    },
    fortissimo(k, s) { // ff: the sky becomes a stage. Five stage-light pillars, twin crescendo hairpins and a downpour of golden notes crashing across the screen on the beat
      const B = 0.45; // the full-screen finisher moment covers the first half second: the stage art lands after it
      for (let i = 0; i < 5; i++) k.pillar({ x: s.x + (i - 2) * 150, y: s.y + (i % 2) * 20, h: 700, w: 7, col: i % 2 ? PK : GD, hi: '#fff', d: B + i * BEAT * 0.6, life: 1.1 });
      for (let i = 0; i < 2; i++) k.bard_hairpin({ x: k.x, y: k.y - 30, ang: Math.atan2(s.y - k.y, s.x - k.x) + (i ? 0.16 : -0.16), len: Math.max(k.dist + 300, 700), spread: 0.22, col: i ? PK : GD, hi: '#fff', d: B + 0.04 + i * BEAT, life: 0.9 });
      for (let i = 0; i < 14; i++) k.bard_note({ x: s.x + ((i * 97) % 640) - 320, y: s.y + ((i * 53) % 160) - 80, size: 26 + (i % 3) * 6, fall: 330 + (i % 4) * 30, col: i % 2 ? PK : GD, hi: '#fff', pair: i % 4 === 0, d: B + 0.2 + i * 0.045, life: 0.9, opt: i % 3 === 2 });
      k.bard_rings({ x: s.x, y: s.y, R: 340, n: 6, beat: BEAT, rd: 0.6, grow: true, cols: [GD, PK, '#fff'], hi: '#fff', d: B + 0.8 });
      k.sigil({ x: k.x, y: k.y, R: 330, n: 8, col: GD, hi: '#fff', b: PK, d: B + 0.9, life: 1.6, hold: 0.6 });
      k.burst({ x: k.x, y: k.y - 20, n: 20, len: 340, col: GD, hi: '#fff', d: B + 0.9 });
    },
    death_knell(k, s) { // a black bell with a pink rim drops over the target and tolls three times; black-pink ink drips down around it and a grave rift opens underneath
      const B = 0.45; // the full-screen finisher moment covers the first half second: the stage art lands after it
      k.rift({ x: s.x, y: s.y, R: 190, ang: 0.2, tall: 0.5, col: HOT, hi: PK, deep: '#06010a', d: B + 0.1 });
      k.bard_bell({ x: s.x, y: s.y + 30, size: 80, R: 260, col: HOT, hi: PK, d: B + 0.05, life: 2.0 });
      k.bard_drip({ x: s.x, y: s.y, R: 210, n: 14, h: 420, size: 9, col: HOT, hi: PK, d: B + 0.5, life: 1.5 });
      k.pillar({ x: s.x, y: s.y + 10, h: 700, w: 12, col: VI, hi: PK, d: B + 0.9, life: 0.9, down: true });
      k.bard_rings({ x: s.x, y: s.y, R: 250, n: 3, beat: 0.35, rd: 0.7, cols: [HOT, VI, PK], hi: '#fff', d: B + 0.7 });
      k.motes({ x: s.x, y: s.y - 40, n: 14, type: 'note', spd: 120, g: 160, size: 7, col: HOT, col2: VI, spread: TAU, d: B + 0.7, life: 1.4 });
    },
  },
  routes: {
    fortissimo: { title: 'FORTISSIMO', sub: 'THE SKY BECOMES A STAGE  ·  PACK FINISHER', sfx: 'ジャァァン', kanji: '響', rot: -0.08 },
    death_knell: { title: 'DEATH KNELL', sub: 'THE BELL TOLLS THREE TIMES  ·  BOSS FINISHER', sfx: 'ゴォォン', kanji: '鐘', rot: 0.07 },
    grand_overture: { title: 'GRAND OVERTURE', sub: 'THE GOLDEN STAFF  ·  PACK FINISHER', sfx: 'ジャジャァン', kanji: '奏', rot: -0.06 },
    requiem_finale: { title: 'REQUIEM FINALE', sub: 'THE FORK HUMS  ·  BOSS FINISHER', sfx: 'ブゥゥゥン', kanji: '鎮', rot: 0.06 },
  },
  notes: {
    sonic_riff: 'A five-line music staff shoots down your aim with three pink and gold sound-wave arcs riding it on the beat, and notes fly off the tip.',
    echo_chord: 'A chord of stacked rings blooms on the first enemy, then hops zig-zag four more times, each ring a little bigger, with golden notes lifting off.',
    healing_hymn: 'Three warm green-gold halos rise off the bard on the beat inside a rune circle, with a soft column of light and star motes drifting up.',
    dissonance: 'Three jagged glitching arcs fill the cone, sour sharps and flats flicker up in violet and green, and violet lightning cracks across it.',
    crescendo: 'Five staff rings grow thicker and louder on the beat, four swelling hairpin marks open outward, then a gold starburst and a rain of notes mark the shockwave.',
    encore: 'A curtain call: four rings in the song colours roll out on the beat, five stage-light pillars stand up around a gold rune circle, and notes rise like applause.',
    basic: 'Each strum flicks a short sound arc and one note; the third strum stacks three thin staff rings around the bard.',
    power_chord: 'Two orange and pink riffs go back to back and land as a power chord: two stacked notes over three pulsing rings.',
    quickstep: 'Cyan afterimages dance forward, a cyan staff riff follows, and little footfall notes pop on each beat.',
    soft_refrain: 'Four soft green and gold echoes ring out on the target one after another, each lifting a halo and a note, with drifting leaves.',
    sour_note: 'A huge violet note with a green glitch crashes onto the target, leaving a jagged ring, cracked ground and a flat and a sharp sign.',
    anthem_of_valor: 'Three orange, pink and gold riffs fan out one per beat with march-step rings under them and a swelling hairpin along the aim.',
    battle_hymn: 'A pillar of green-gold choir light falls on the target inside a rune circle while halos, notes and feathers rise and an orange riff drives in.',
    discord_ballad: 'A wide cone of glitching violet and sour-green arcs with lightning and flickering sharps and flats, ending in doubled glitch rings on the target.',
    rondo: 'Three pools in cyan, pink and gold bloom around the aim point, joined by a circling arc, each pulsing five times on the beat.',
    symphony_strike: 'Four staffs in the song colours slide in from four sides on the beat, then a four-ring chord and four notes burst on the target.',
    ballad_of_heroes: 'Golden wings open behind the bard, a halo rises, and orange, cyan and green rings roll out in turn around a three-point rune.',
    grand_overture: 'A giant golden music staff sweeps across the screen under two swelling hairpins, then a chord of growing rings and notes hits the target.',
    requiem_finale: 'A giant violet tuning fork drops on the target and hums out sound arcs, glitch rings, cracked ground and black-pink drips.',
    fortissimo: 'Pack finisher: five stage lights, two huge swelling hairpins and a downpour of golden notes crash onto the pack, then growing rings and the full finisher moment.',
    death_knell: 'Boss finisher: a black bell with a pink rim drops over the target and tolls three times while black-pink ink drips down, then the full finisher moment.',
  },
  underPrims: ['bard_rings'],
  prims: {
    bard_note(ctx, c, k, time) { // a big glowing vector note (single or beamed pair) that rises and fades, or falls from the sky and lands with a ring
      const R = seeded(c.seed), ph = R() * TAU; let s = c.size || 20, x = c.x + (c.dx || 0) * ease.out(k), y, a;
      if (c.fall) {
        const f = clamp(k / 0.38); y = c.y - c.fall * (1 - ease.in(f)); a = clamp(k / 0.06) * (1 - ease.in(clamp((k - 0.55) / 0.45)));
        if (f >= 1) { const u = clamp((k - 0.38) / 0.62); s *= 1 + 0.4 * ease.out(u); ctx.save(); ctx.translate(c.x, c.y + 12); ctx.scale(1, 0.5); ctx.globalAlpha = (1 - u) * a; ctx.strokeStyle = c.col; ctx.lineWidth = 5 * (1 - u) + 1; ctx.beginPath(); ctx.arc(0, 0, s * 3 * ease.out(u), 0, TAU); ctx.stroke(); ctx.restore(); }
        else { ctx.globalAlpha = a * 0.6; ctx.strokeStyle = c.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - s * 0.4); ctx.lineTo(x, y - s * 0.4 - 120); ctx.stroke(); }
      } else { y = c.y - (c.rise ?? 90) * ease.out(k); x += Math.sin(k * 6 + ph) * (c.sway || 0); a = ease.out(clamp(k / 0.12)) * (1 - ease.in(clamp((k - 0.55) / 0.45))); }
      if (a <= 0.01) return;
      ctx.globalAlpha = 1; bloom(ctx, x, y - s * 0.4, s * 2.2, c.col, 0.5 * a);
      const rot = Math.sin(k * 9 + ph) * 0.15, draw = c.pair ? notePair : note;
      ctx.globalAlpha = a; ctx.fillStyle = c.col; draw(ctx, x, y, s, rot); ctx.globalAlpha = a * 0.85; ctx.fillStyle = c.hi || '#fff'; draw(ctx, x, y, s * 0.72, rot);
    },
    bard_rings(ctx, c, k, time) { // stacked staff rings on the ground: each beat releases one triple-line ring with a small note riding it (set grow:true to get louder each beat)
      const L = c.life - c.d, t = k * L, beat = c.beat || BEAT, n = c.n || 4, dur = c.rd || 0.55, gap = c.gap || 6;
      ctx.save(); ctx.translate(c.x, c.y + 14); ctx.scale(1, 0.62); ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const kk = clamp((t - i * beat) / dur); if (kk <= 0 || kk >= 1) continue;
        const loud = c.grow ? 0.6 + 0.4 * i / Math.max(1, n - 1) : 1, thick = c.grow ? 1 + i * 0.35 : 1, r = c.R * (n > 1 ? 0.45 + 0.55 * (i + 1) / n : 1) * ease.out(kk), al = (1 - kk) * loud * clamp(kk / 0.06);
        const col = c.cols ? c.cols[i % c.cols.length] : c.col;
        for (let l = -1; l <= 1; l++) { ctx.globalAlpha = al * (l ? 0.65 : 0.95); ctx.strokeStyle = l ? col : '#fff'; ctx.lineWidth = (l ? 2.4 : 2.8) * thick; ctx.beginPath(); ctx.arc(0, 0, Math.max(1, r + l * gap * thick), 0, TAU); ctx.stroke(); }
        const an = i * 2.3 + time * 3, nx = Math.cos(an) * r, ny = Math.sin(an) * r; ctx.globalAlpha = al; ctx.fillStyle = c.hi || '#fff'; ctx.beginPath(); ctx.arc(nx, ny, 4 + thick * 1.5, 0, TAU); ctx.fill(); ctx.fillRect(nx + 3, ny - 16, 2, 16);
      }
      ctx.restore(); ctx.globalAlpha = 1; bloom(ctx, c.x, c.y + 14, c.R * 0.6, c.cols ? c.cols[0] : c.col, 0.3 * (1 - k));
    },
    bard_zig(ctx, c, k, time) { // a jagged, glitchy ring or cone edge of discordant sound: triple-offset colours, flickering gaps
      const grow = ease.out(clamp(k / 0.3)), a = ease.in(clamp((1 - k) / 0.45)) * clamp(k / 0.05), Rn = c.R * grow; if (Rn < 3 || a <= 0.01) return;
      const R = seeded(Math.floor(time * 16) * 97 + c.seed), N = c.seg || 34, a0 = c.a0 ?? 0, sw = c.sw ?? TAU, amp = c.amp || 14, pts = [];
      for (let i = 0; i <= N; i++) { const an = a0 + sw * i / N, rr = Rn + (i % 2 ? 1 : -1) * amp * (0.4 + R() * 0.9); pts.push([Math.cos(an) * rr, Math.sin(an) * rr]); }
      ctx.save(); ctx.translate(c.x, c.y + (c.flat === false ? 0 : 14)); ctx.scale(1, c.sq ?? 0.62); ctx.lineJoin = 'miter';
      for (const [ox, col, al, lw] of [[-4, c.b || c.col, 0.6, 5], [4, c.col, 0.8, 5], [0, c.hi || '#fff', 0.95, 1.8]]) {
        ctx.strokeStyle = col; ctx.globalAlpha = a * al; ctx.lineWidth = lw; ctx.beginPath(); let pen = false;
        for (let i = 0; i < pts.length; i++) { if (R() < 0.1) { pen = false; continue; } const p = pts[i]; if (pen) ctx.lineTo(p[0] + ox, p[1]); else { ctx.moveTo(p[0] + ox, p[1]); pen = true; } }
        ctx.stroke();
      }
      ctx.restore(); ctx.globalAlpha = 1; bloom(ctx, c.x, c.y + (c.flat === false ? 0 : 14), Rn * 0.7, c.col, 0.3 * a);
    },
    bard_accid(ctx, c, k, time) { // a sharp or flat sign that drifts up, jittering in two clashing colours
      const a = ease.out(clamp(k / 0.1)) * (1 - ease.in(clamp((k - 0.5) / 0.5))), s = c.size || 26, R = seeded(Math.floor(time * 14) * 31 + c.seed); if (a <= 0.01) return;
      const x = c.x + (c.dx || 0) * ease.out(k), y = c.y - (c.rise || 70) * ease.out(k);
      ctx.globalAlpha = 1; bloom(ctx, x, y, s * 2.2, c.col, 0.3 * a);
      for (const [col, al, lw] of [[c.b || c.col, 0.7, 5], [c.col, 0.95, 5], ['#ffffff', 0.5, 1.3]]) { ctx.strokeStyle = col; ctx.globalAlpha = a * al; accid(ctx, !!c.flat, x + (R() - 0.5) * 6, y + (R() - 0.5) * 4, s, lw); }
    },
    bard_hairpin(ctx, c, k, time) { // a crescendo hairpin "<": two lines opening from a point along ang, dots inside that grow louder
      const g = ease.out(clamp(k / 0.4)), a = ease.in(clamp((1 - k) / 0.4)) * clamp(k / 0.05), L = c.len * g, h = Math.tan(c.spread || 0.3); if (a <= 0.01) return;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.ang); ctx.lineCap = 'round';
      const gr = ctx.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, c.col);
      ctx.globalAlpha = a * 0.3; ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, -h * L); ctx.lineTo(L, h * L); ctx.closePath(); ctx.fill();
      for (const [w, col, al] of [[9, c.col, 0.35], [4, c.hi || c.col, 0.8], [1.6, '#fff', 1]]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.globalAlpha = a * al; ctx.beginPath(); ctx.moveTo(L, -h * L); ctx.lineTo(0, 0); ctx.lineTo(L, h * L); ctx.stroke(); }
      for (let i = 0; i < 5; i++) { const u = (i + 1) / 6, px = u * L; if (px > L) continue; ctx.globalAlpha = a; ctx.fillStyle = i % 2 ? '#fff' : c.hi || c.col; ctx.beginPath(); ctx.arc(px, 0, 2 + u * 8, 0, TAU); ctx.fill(); }
      ctx.restore(); ctx.globalAlpha = 1; const ex = c.x + Math.cos(c.ang) * L, ey = c.y + Math.sin(c.ang) * L; bloom(ctx, ex, ey, 50 * g, c.col, 0.6 * a);
    },
    bard_halo(ctx, c, k) { // a healing halo: thin glowing rings that lift off the ground one per beat
      const L = c.life - c.d, t = k * L, beat = c.beat || BEAT, n = c.n || 3, dur = c.rd || 0.8;
      for (let i = 0; i < n; i++) {
        const kk = clamp((t - i * beat) / dur); if (kk <= 0 || kk >= 1) continue;
        const y = c.y + 12 - (c.h || 120) * ease.out(kk), r = c.R * (1 - 0.2 * kk), al = (1 - kk) * clamp(kk / 0.12);
        ctx.save(); ctx.translate(c.x, y); ctx.scale(1, 0.38);
        for (const [w, col, ga] of [[7, c.col, 0.4], [3, c.hi || c.col, 0.85], [1.4, '#fff', 1]]) { ctx.globalAlpha = al * ga; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
        ctx.restore(); ctx.globalAlpha = 1; bloom(ctx, c.x, y, r * 0.5, c.b || c.col, 0.28 * al);
      }
    },
    bard_bell(ctx, c, k, time) { // a dark bell with a glowing pink rim: drops in, swings and tolls three times (sound rings off the mouth and across the ground)
      const s = c.size || 70, drop = clamp(k / 0.22), a = clamp(k / 0.06) * (1 - ease.in(clamp((k - 0.8) / 0.2))); if (a <= 0.01) return;
      const swing = drop >= 1 ? Math.sin((k - 0.22) * 38) * 0.2 * (1 - clamp((k - 0.22) / 0.7)) : 0, hy = c.y - s * 1.5 - 300 * (1 - ease.out(drop));
      for (const tt of [0.3, 0.5, 0.7]) { const u = clamp((k - tt) / 0.24); if (u <= 0 || u >= 1) continue; ctx.save(); ctx.translate(c.x, c.y + 14); ctx.scale(1, 0.55); ctx.globalAlpha = (1 - u) * a; ctx.strokeStyle = c.col; ctx.lineWidth = 7 * (1 - u) + 1; ctx.beginPath(); ctx.arc(0, 0, (c.R || 220) * ease.out(u), 0, TAU); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); ctx.save(); ctx.translate(c.x, hy + s * 1.05); ctx.scale(1, 0.55); ctx.globalAlpha = (1 - u) * a * 0.9; ctx.strokeStyle = c.hi || c.col; ctx.lineWidth = 4 * (1 - u) + 1; ctx.beginPath(); ctx.arc(0, 0, s * (0.9 + 2.2 * ease.out(u)), 0, TAU); ctx.stroke(); ctx.restore(); }
      ctx.save(); ctx.translate(c.x, hy); ctx.rotate(swing);
      const body = () => { ctx.beginPath(); ctx.moveTo(-s * 0.25, 0); ctx.quadraticCurveTo(-s * 0.55, s * 0.1, -s * 0.6, s * 0.7); ctx.quadraticCurveTo(-s * 0.7, s * 0.95, -s * 0.95, s * 1.05); ctx.lineTo(s * 0.95, s * 1.05); ctx.quadraticCurveTo(s * 0.7, s * 0.95, s * 0.6, s * 0.7); ctx.quadraticCurveTo(s * 0.55, s * 0.1, s * 0.25, 0); ctx.closePath(); };
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a * 0.95; const g = ctx.createLinearGradient(-s, 0, s, 0); g.addColorStop(0, '#0a0210'); g.addColorStop(0.4, '#3a1048'); g.addColorStop(1, '#0a0210'); ctx.fillStyle = g; body(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; for (const [w, col, al] of [[7, c.col, 0.35], [3, c.hi || c.col, 0.85], [1.4, '#fff', 1]]) { ctx.globalAlpha = a * al; ctx.strokeStyle = col; ctx.lineWidth = w; body(); ctx.stroke(); }
      ctx.globalAlpha = a; ctx.fillStyle = GD; ctx.beginPath(); ctx.arc(Math.sin(-swing * 3) * s * 0.3, s * 1.12, s * 0.13, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(0, -s * 0.06, s * 0.14, 0, TAU); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1; bloom(ctx, c.x, hy + s * 0.6, s * 2, c.col, 0.35 * a);
    },
    bard_drip(ctx, c, k) { // black-pink ink drops fall from the sky and splat into rings on the ground
      const R = seeded(c.seed), out = 1 - ease.in(clamp((k - 0.8) / 0.2));
      for (let i = 0; i < c.n; i++) {
        const x = c.x + (R() - 0.5) * 2 * c.R, gy = c.y + (R() - 0.5) * c.R * 0.5, d0 = R() * 0.45, w = (c.size || 8) * (0.7 + R() * 0.6), u = clamp((k - d0) / 0.36); if (u <= 0) continue;
        if (u < 1) {
          const y = gy - (c.h || 300) * (1 - ease.in(u)); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = out * 0.95; ctx.fillStyle = '#0b0210'; ctx.beginPath(); ctx.moveTo(x, y - w * 2.6); ctx.bezierCurveTo(x + w * 1.1, y - w * 0.6, x + w, y + w * 0.6, x, y + w * 0.7); ctx.bezierCurveTo(x - w, y + w * 0.6, x - w * 1.1, y - w * 0.6, x, y - w * 2.6); ctx.fill();
          ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = c.col; ctx.lineWidth = 2.2; ctx.globalAlpha = out * 0.9; ctx.stroke(); ctx.globalAlpha = out * 0.4; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - w * 2.6); ctx.lineTo(x, y - w * 2.6 - 70); ctx.stroke(); ctx.globalAlpha = 1; bloom(ctx, x, y, w * 3, c.col, 0.5 * out);
        } else {
          const v = clamp((k - d0 - 0.36) / 0.34); if (v >= 1) continue; ctx.save(); ctx.translate(x, gy + 10); ctx.scale(1, 0.5);
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = (1 - v) * 0.7 * out; ctx.fillStyle = '#0b0210'; ctx.beginPath(); ctx.arc(0, 0, w * (1.5 + 3 * ease.out(v)), 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - v) * out; ctx.strokeStyle = c.hi || c.col; ctx.lineWidth = 3 * (1 - v) + 1; ctx.beginPath(); ctx.arc(0, 0, w * (2 + 4 * ease.out(v)), 0, TAU); ctx.stroke(); ctx.restore();
        }
      }
    },
    bard_fork(ctx, c, k, time) { // a giant tuning fork falls handle-first onto the point and hums: its prongs vibrate and send out sound arcs
      const s = c.size || 110, fall = clamp(k / 0.26), a = clamp(k / 0.05) * (1 - ease.in(clamp((k - 0.78) / 0.22))); if (a <= 0.01) return;
      const hit = k >= 0.26, y0 = c.y + 6 - (c.h || 420) * (1 - ease.in(fall)), hum = hit ? (1 - clamp((k - 0.26) / 0.6)) : 0, v = Math.sin(time * 90) * s * 0.05 * hum, ty = y0 - s * 2.0, px = s * 0.22;
      if (hit) {
        const u = clamp((k - 0.26) / 0.5); ctx.save(); ctx.translate(c.x, c.y + 12); ctx.scale(1, 0.5); ctx.globalAlpha = (1 - u) * a; ctx.strokeStyle = c.col; ctx.lineWidth = 8 * (1 - u) + 1; ctx.beginPath(); ctx.arc(0, 0, s * 2.6 * ease.out(u), 0, TAU); ctx.stroke(); ctx.restore();
        for (const sd of [-1, 1]) for (let j = 0; j < 3; j++) { const w = clamp((k - 0.26 - j * BEAT) / 0.5); if (w <= 0 || w >= 1) continue; ctx.globalAlpha = (1 - w) * a * 0.9; ctx.strokeStyle = j % 2 ? c.hi : c.col; ctx.lineWidth = 6 * (1 - w) + 1.5; ctx.beginPath(); ctx.arc(c.x + sd * px, ty, s * (0.3 + 1.5 * ease.out(w)), sd > 0 ? -0.9 : Math.PI - 0.9, sd > 0 ? 0.9 : Math.PI + 0.9); ctx.stroke(); }
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [w, col, al] of [[s * 0.22, c.col, 0.5], [s * 0.1, c.hi || c.col, 0.85], [s * 0.03, '#fff', 0.8]]) { ctx.strokeStyle = col; ctx.globalAlpha = a * al; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(c.x, y0); ctx.lineTo(c.x, y0 - s * 0.95); ctx.moveTo(c.x - px - v, ty); ctx.lineTo(c.x - px, y0 - s * 1.25); ctx.quadraticCurveTo(c.x, y0 - s * 0.85, c.x + px, y0 - s * 1.25); ctx.lineTo(c.x + px + v, ty); ctx.stroke(); }
      ctx.globalAlpha = 1; bloom(ctx, c.x - px, ty, s * 0.7, c.col, 0.6 * a); bloom(ctx, c.x + px, ty, s * 0.7, c.col, 0.6 * a); bloom(ctx, c.x, y0 - s, s * 1.6, c.col, 0.35 * a);
    },
  },
};
