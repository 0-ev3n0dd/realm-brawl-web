// WebSocket connection to the co-op server, with optional artificial latency for testing:
//   ?lag=120&jitter=20   -> each direction delayed by lag/2 + random(0..jitter) ms (order preserved, like TCP)
export function netTestParams() {
  const q = new URLSearchParams(location.search);
  return { lag: Math.max(0, Math.min(2000, +q.get('lag') || 0)), jitter: Math.max(0, Math.min(1000, +q.get('jitter') || 0)) };
}

export class Net {
  constructor({ lag = 0, jitter = 0 } = {}) {
    this.lag = lag; this.jitter = jitter;
    this.ws = null;
    this.onmessage = null;
    this.onclose = null;
    this.outAt = 0; this.inAt = 0;
    this.bytesIn = 0; this.msgsIn = 0;
    this.closedByUs = false;
  }
  url() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'; }
  connect(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      let done = false;
      const ws = new WebSocket(this.url());
      this.ws = ws;
      const to = setTimeout(() => { if (!done) { done = true; try { ws.close(); } catch {} reject(new Error('Connection timed out')); } }, timeoutMs);
      ws.onopen = () => { if (done) return; done = true; clearTimeout(to); resolve(); };
      ws.onerror = () => { if (!done) { done = true; clearTimeout(to); reject(new Error('Could not connect to the game server')); } };
      ws.onmessage = (e) => {
        this.bytesIn += e.data.length; this.msgsIn++;
        this.delay('inAt', () => { let m; try { m = JSON.parse(e.data); } catch { return; } this.onmessage && this.onmessage(m); });
      };
      ws.onclose = (e) => { clearTimeout(to); if (!done) { done = true; reject(new Error('Connection closed')); } this.delay('inAt', () => this.onclose && this.onclose(e, this.closedByUs)); };
    });
  }
  delay(key, fn) {
    if (!this.lag && !this.jitter) return fn();
    const now = performance.now();
    const at = Math.max(this[key], now + this.lag / 2 + Math.random() * this.jitter);
    this[key] = at;
    setTimeout(fn, at - now);
  }
  send(obj) {
    const s = JSON.stringify(obj);
    this.delay('outAt', () => { if (this.ws && this.ws.readyState === 1) this.ws.send(s); });
  }
  get open() { return !!this.ws && this.ws.readyState === 1; }
  close() { this.closedByUs = true; try { this.ws && this.ws.close(1000, 'leave'); } catch {} }
}
