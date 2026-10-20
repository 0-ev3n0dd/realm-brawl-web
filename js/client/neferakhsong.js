// Neferakh Unbound's adaptive score (encounter revamp Part 1): "Sun-Eaten Throne" (client/chip/songs/suneaten.js) follows the fight.
// State-driven (works the same on a co-op snapshot as offline): every frame the trial view picks the section it wants and the song
// moves there on its next downbeat (client/adaptivesong.js). The first pull starts the intro offset by the pull's own clock, so the
// intro's five bars land on the sim's five intro beats (NEF.bar = one bar at 132 BPM).
//   pull (first) intro -> loopA · pull (re-pull) break · Phase 1 loopA · trans break · Phase 2 loopB · the Sunbearer set
//   sun-struck struck (-> loopC) · Phase 3 loopC · Phase 4 (Extreme) loopD · kill finale -> tail · wipe / leaving: fade out
//   Savage (V.sv, ./chip/songs/suneatens.js): the same map + the verdict cinematic 'court' (-> loopV, the key change) in Phase 5
import { SONGS } from './chip/songs/index.js';
import { songFor } from './adaptivesong.js';
import { ENC, setEncounterSong } from './encountercine.js';
import { trialView } from './trialfx.js';
import { trialAt } from '../sim/trialconst.js';
import { NEF } from '../sim/neferakh.js';
import { TRIAL_POS } from '../sim/trialconst.js';
import { nefIntroCam, nefVerdictCam, nefEclipseCam, nefEclipseSkip } from './neferakhfx.js';

const NS = { song: null, last: null, struck: 0, killed: 0 };
/** the section the fight wants now (null = silence) */
export function nefWant(V) {
  if (!V || V.k !== 'nf') return null;
  if (V.st === 'eclipse') return V.eShort ? 'eclShort' : 'eclipse'; // (Savage v2: the transformation - the held F, the swell, the new section)
  if (V.st === 'pull') return V.pull >= NEF.pull ? 'intro' : 'break';
  if (V.form) { // (Eclipse Ascendant: ./chip/songs/suneatene.js)
    if (V.st === 'trans') return V.ph === 3 ? 'court' : 'break';
    if (V.st === 'set') return 'set';
    if (V.st === 'kill' || V.st === 'victory') return 'finale';
    if (V.st === 'wipe') return null;
    if (V.st === 'fight' || V.st === 'enrage') { if (V.ph >= 4) return 'loopE4'; if (V.ph === 3) return V.o && V.o.struck ? 'struck' : 'loopE3'; return V.ph === 2 ? 'loopE2' : 'loopE1'; }
    return null;
  }
  if (V.st === 'trans') return V.sv && V.ph === 4 ? 'court' : 'break'; // (Savage: the verdict cinematic builds into the new key)
  if (V.st === 'set') return 'set';
  if (V.st === 'kill' || V.st === 'victory') return 'finale';
  if (V.st === 'wipe') return null;
  if (V.st === 'fight' || V.st === 'enrage') { if (V.sv && V.ph >= 5) return 'loopV'; if (V.ph >= 4) return 'loopD'; if (V.ph === 3) return V.o && V.o.struck ? 'struck' : 'loopC'; return V.ph === 2 ? 'loopB' : 'loopA'; }
  return null;
}
/** once a frame (render.js) */
export function nefSongTick(sim, local) {
  const V = trialView(sim), here = V && V.k === 'nf' && local && trialAt(local.x, local.y) === 'nf';
  const want = here ? nefWant(V) : null, S = NS.song;
  { const cam = here ? nefIntroCam(V, TRIAL_POS.nf, sim.enemyById && sim.enemyById.get(V.bid)) || nefEclipseCam(V, TRIAL_POS.nf, sim.enemyById && sim.enemyById.get(V.bid)) || nefVerdictCam(sim, TRIAL_POS.nf) : null; ENC.hold = !!cam; ENC.holdCam = cam; } // (the intro: letterbox + the camera push-in)
  nefEclipseSkip(here && V.st === 'eclipse' && V.eShort);
  if (!want) { if (S && S.on) S.stop(V && V.st === 'wipe' ? 1.2 : 0.8); NS.last = null; NS.struck = 0; NS.killed = 0; NS.court = 0; return; }
  if (!ENC.audio) return;
  const sid = V.sv && (V.form || V.st === 'eclipse') ? 'suneatene' : V.sv ? 'suneatens' : 'suneaten';
  if (!S || NS.sid !== sid) { if (S && S.on) S.stop(0.4); NS.song = songFor(SONGS[sid]); NS.sid = sid; } // (Part 1S: the Savage arrangement)
  const song = NS.song;
  if (!song.on) {
    const intro = want === 'intro' || want === 'eclipse' || want === 'eclShort', off = intro ? Math.max(0, (V.at - 1) / 60) : 0; // (the intro and the transformation start where the sim's clock is)
    if (!song.start(ENC.audio, want === 'struck' ? (V.form ? 'loopE3' : 'loopC') : want === 'finale' ? 'tail' : want, off)) return;
    setEncounterSong(song, { setpiece: null, win: null, respite: null, transition: null }); // (this fight drives its own song; the generic cues stay quiet)
    NS.last = want; return;
  }
  if (want === NS.last) return;
  // one-shots: the struck run plays once on the win (then the score flows into loopC); the finale once on the kill (then the tail)
  if (want === 'struck') { if (!NS.struck) { NS.struck = 1; song.go('struck'); } NS.last = want; return; }
  if (want === 'finale') { if (!NS.killed) { NS.killed = 1; song.go('finale'); } NS.last = want; return; }
  if ((want === 'loopC' || want === 'loopE3') && NS.last === 'struck') { NS.last = want; return; }
  if (want === 'loopE1' && (NS.last === 'eclipse' || NS.last === 'eclShort')) { NS.last = want; return; } // (the transformation flows into B1) // (already flowing there)
  if (want === 'court') { if (!NS.court) { NS.court = 1; song.go('court'); } NS.last = want; return; } // (one-shot: flows into loopV)
  if ((want === 'loopV' || want === 'loopE4') && NS.last === 'court') { NS.last = want; return; }
  song.go(want); NS.last = want;
}
export const __nefSong = NS;
if (typeof window !== "undefined") window.__nefSong = NS;
