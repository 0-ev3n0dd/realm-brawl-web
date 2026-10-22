// Presentation slow-motion for the big finisher moments. Solo (game.js): the sim itself steps slower. Co-op (netgame.js): the
// server sim keeps real time, so only the local presentation slows (fx.slowmo: particles and numbers), capped at
// >= 0.4x for <= 0.6 s and only for your own events.
// Shared by the game session and the showcase page. Returns { sec, scale } for an event, or null.
export function slowFor(ev, localPid) {
  if (ev.pid !== undefined && ev.pid !== localPid && ev.type !== 'loot') return null;
  switch (ev.type) {
    case 'chain': return ev.fin ? { sec: 0.6, scale: 0.2 } : { sec: 0.12, scale: 0.35 }; // a 5-step route finisher hangs for a beat
    case 'ttcStart': return { sec: 0.4, scale: 0.3 };
    case 'crescentImpact': return { sec: 0.35, scale: 0.25 };
    case 'death': return ev.boss ? { sec: 0.8, scale: 0.25 } : null;
    // signature finishers (fxmoment.js): the wind-up slows down, the impact hangs
    case 'drg': if (ev.ph === 'hit' && ev.fx === 'nidmark') return { sec: 1.15, scale: 0.35 }; break;
    case 'drgx': if (ev.ph === 'nidhogg') return { sec: 1.0, scale: 0.15 }; break;
    case 'monk': if (ev.ph === 'hit' && ev.fx === 'palmcharge') return { sec: 0.95, scale: 0.4 }; break;
    case 'monkx': if (ev.ph === 'heaven') return { sec: 1.1, scale: 0.15 }; break;
    case 'arcx':
      if (ev.ph === 'hit' && ev.look === 'chapterhit') return { sec: 0.18, scale: 0.45 };
      if (ev.ph === 'hit' && ev.look === 'bookslam') return { sec: 1.0, scale: 0.15 };
      break;
  }
  return null;
}
