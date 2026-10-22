// Auto-salvage on pickup (step 4), client side: the rules live in the profile (sim/autosalvage.js); every gear pickup
// of this hero is checked once it is in the bag, and a match goes through the village's normal salvage path
// (VillageUI.takeOut -> the sim's 'bagTake' command, which refuses locked items) - so co-op stays server-checked.
// The pickup feed shows "Auto-salvaged X → materials"; the last few land in a log the Stash tab can undo.
import { autoSalvageCheck, logSalvage, undoSalvage, normAutoSalvage } from '../sim/autosalvage.js';
import { itemName } from '../sim/meta.js';
import { profile } from './rewards.js';

/** bag items the rules match right now (master switch ignored: 'Salvage matching now'): [{ idx, rule }]; the same
 *  guards as pickup (locked, relics unless allowed, Trial / Extreme, upgraded / crafted, key items, better than worn) */
export function bagMatches(inv, cfg, p) {
  const c = { ...normAutoSalvage(cfg), on: true }, out = [];
  (inv || []).forEach((it, idx) => { if (!it) return; const r = autoSalvageCheck(it, c, p); if (r.ok) out.push({ idx, rule: r.rule }); });
  return out;
}

export class AutoSalvager {
  constructor(game, village) { this.g = game; this.v = village; this.q = []; this.recent = []; }
  get cfg() { const pr = profile.load(); if (!pr.autoSalvage || !pr.autoSalvage.rules) pr.autoSalvage = normAutoSalvage(pr.autoSalvage); return pr.autoSalvage; }
  /** a pickup event of ours: queue its items (they are checked once they show up in the bag) */
  onPickup(ev) {
    if (!this.cfg.on || !ev.items) return;
    const now = performance.now();
    for (const it of ev.items) if (it && it.uid) this.q.push({ uid: it.uid, at: now });
  }
  update() {
    if (!this.q.length) return;
    const p = this.g.player, now = performance.now(); if (!p) { this.q.length = 0; return; }
    const cfg = this.cfg;
    for (let k = this.q.length - 1; k >= 0; k--) {
      const e = this.q[k], idx = p.inventory.findIndex((it) => it && it.uid === e.uid);
      if (idx < 0) { if (now - e.at > 3000) this.q.splice(k, 1); continue; } // (co-op: the bag update may trail the event)
      this.q.splice(k, 1);
      const it = p.inventory[idx], r = autoSalvageCheck(it, cfg, p);
      if (r.ok) this.v.takeOut(idx, 'salvage', { auto: r.rule });
    }
  }
  /** 'Salvage matching now' (Stash › Auto-Salvage): every bag item the rules match goes through the same salvage path
   *  as a pickup (logged, so the undo list covers it). Returns how many were sent. */
  salvageNow() {
    const p = this.g.player; if (!p) return 0;
    let n = 0; for (const m of bagMatches(p.inventory, this.cfg, p)) if (this.v.takeOut(m.idx, 'salvage', { auto: m.rule || 'now' })) n++;
    return n;
  }
  /** the village's 'bag' event confirmed an auto-salvage: log it (undo) + the pickup feed line */
  done(item, value) {
    const cfg = this.cfg; logSalvage(cfg, item, value); profile.save();
    const fx = this.g.fx, L = fx && fx.loot;
    if (L && L.add) L.add('as:' + item.uid, `Auto-salvaged ${itemName(item)} → materials`, 1, '#c9a8ff', item.rarity | 0);
    this.recent.unshift({ name: itemName(item), t: performance.now() }); if (this.recent.length > 5) this.recent.length = 5;
    if (this.onChange) this.onChange();
  }
  /** undo log entry k: the gold + materials go back, the item returns to the bag (the sim's validated 'unstash') */
  undo(k) {
    const p = this.g.player; if (!p) return 'No hero';
    const pr = profile.load(), r = undoSalvage(this.cfg, pr, k, p.inventory.filter((x) => !x).length);
    if (r.err) return r.err === 'bag' ? 'Your bag is full' : r.err === 'spent' ? 'Those materials are already spent' : 'Nothing to undo';
    profile.save();
    if (this.v && this.v.sendUnstash) this.v.sendUnstash(r.item); else this.g.command({ type: 'unstash', item: r.item }); // (bugpass: a full bag puts it in the stash, never loses it)
    if (this.g.audio) this.g.audio.play('pickup');
    if (this.onChange) this.onChange();
    return '';
  }
}
