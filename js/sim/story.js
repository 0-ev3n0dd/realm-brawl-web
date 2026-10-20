// Experience pass 4: the story chain (pure data + rules; dialogue / journal / tracker UI live in client/story.js).
// Seven chapters, Wilds -> Dunes -> Tomb -> Frostveil -> Emberdeep -> Vorthax -> Astrael (game loop C2: in ladder order). Each has a giver in Brightwater Village, an objective (clear
// that mission: a free hunt clears when its boss falls), intro + turn-in dialogue, and a reward (gold, account XP,
// materials) plus unlocks that feed the rest of the game: Quartermaster shop tiers and Forge recipes (story patterns
// open recipes early; the account milestones still open them too).
// Progress lives in the browser profile (rewards.js): profile.story = { v, done: { chapterId: 'claimed' | 'legacy' }, seen, news }.
// Existing saves slot in: anything already cleared (pass-2 records, or the old unlock flags) counts as done, its unlocks
// apply, and only its gold / XP are skipped (no windfall for old clears).
import { hasMilestone } from './meta.js';

export const NPCS = {
  hana: { name: 'Hana', title: 'Mission Clerk', cls: 'cleric', app: { skin: 1, hairStyle: 4, hairColor: 2, outfit: 6 } },
  smith: { name: 'Borin', title: 'Blacksmith', cls: 'warrior', app: { skin: 3, hairStyle: 2, hairColor: 0, outfit: 1 } },
  qm: { name: 'Dorrik', title: 'Quartermaster', cls: 'ranger', app: { skin: 2, hairStyle: 5, hairColor: 3, outfit: 4 } },
  elder: { name: 'Elder Maren', title: 'Village Elder', cls: 'mage', app: { skin: 0, hairStyle: 7, hairColor: 5, outfit: 3 } },
  you: { name: 'You', title: '', cls: null },
};
// unlock id -> what it does (shown on the turn-in screen and in the journal)
export const UNLOCKS = {
  shop2: { name: 'Dorrik restocks', text: 'Elixir of Fortune on sale at the Quartermaster' },
  shop3: { name: 'Dorrik restocks', text: "Scholar's Tonic on sale at the Quartermaster" },
  shop4: { name: 'Dorrik restocks', text: 'Greater Health Potions (heal 70%) at the Quartermaster' },
  pat_wild: { name: 'Wildwarden Pattern', text: 'Borin can forge the Wildwarden set' },
  pat_dune: { name: 'Sunglass Patterns', text: 'Borin can forge Sunglass gear and the Duneborn set' },
  pat_tomb: { name: 'Royal Tomb Patterns', text: 'Borin can forge tier-5 Royal Tomb gear' },
  pat_rift: { name: 'Riftforged Pattern', text: 'Borin can forge Riftforged gear from Rift Cores' },
  pat_star: { name: 'Starforged Pattern', text: 'Borin can forge Starforged Legendaries from Star Shards' },
  title: { name: 'Title: Starbreaker', text: 'Shown on your reward screen and in the journal' },
};
const L = (who, text) => [who, text];
export const CHAPTERS = [
  { id: 'grimtusk', n: 1, title: 'The Warlord of the Wilds', giver: 'hana', mission: 'field', goal: 'Hunt Grimtusk, the boar warlord, in the Wilds',
    where: 'Depart for The Wilds at the Mission Counter (or the green Realm Gate). Grimtusk camps on the north coast.',
    intro: [L('hana', "Oh, thank the tides, a hunter! Brightwater's supply carts haven't made it through the Wilds in a week."),
      L('hana', "It's Grimtusk. That boar warlord has rallied every goblin and tusker between here and the north coast."),
      L('elder', "He is a symptom, child, not the sickness. Something is stirring the beasts. But one fire at a time."),
      L('hana', 'Hunt Grimtusk and the roads open again. Come back to me when he falls, and Brightwater will pay you properly.')],
    outro: [L('hana', "You did it! The first cart rolled in an hour ago. Dorrik is already haggling over the cabbages."),
      L('smith', "And I've had a look at those tusks you hauled back. Bring me Greenwood and Ashstone: I can make Wildwarden plate now."),
      L('hana', 'Here is your bounty from the village purse. But Dorrik wants a word: something about the Dunes.')],
    reward: { gold: 500, xp: 1500, mats: { greenwood: 6, ashstone: 3 } }, unlocks: ['shop2', 'pat_wild'] },
  { id: 'dunes', n: 2, title: 'Sand in the Ledgers', giver: 'qm', mission: 'dunes', goal: 'Hunt Khepra, the Sandwurm Queen, in the Sunscorch Dunes',
    where: 'Grimtusk drops Warlord Tusks: attune the gold Realm Gate with 3 of them (Realm Gate map). Khepra burrows near the rim, far from the oasis.',
    intro: [L('qm', "Grimtusk was bad for business, but the Dunes are worse. My sunglass caravans vanish into the sand."),
      L('qm', "The survivors talk about a queen. A wurm the size of the counter hall, swallowing wagons whole."),
      L('you', "Khepra. I'll hunt her."),
      L('qm', "Bring her down and I'll stock the good stuff. Sunglass for Borin, too, if you can carry it.")],
    outro: [L('qm', "Khepra's dead? The caravans are moving! I can finally restock: Scholar's Tonics, fresh from the oasis."),
      L('smith', 'Sunglass and chitin! I can work Sunglass gear and the Duneborn set with this.'),
      L('elder', "Before you spend it all: the caravan drivers found a doorway in the sand. Old, sealed, humming. Come and see me.")],
    reward: { gold: 900, xp: 3000, mats: { sunglass: 6, chitin: 3 } }, unlocks: ['shop3', 'pat_dune'] },
  { id: 'tomb', n: 3, title: 'The Sun-Eaten King', giver: 'elder', mission: 'tomb', goal: 'Clear the Tomb of the Sun-Eaten King and defeat Neferakh',
    where: 'The Tomb entrance stands in the Dunes by the Oasis (a gold crown on the map), always open. After your first clear, the Tomb is at the Mission Counter too.',
    intro: [L('elder', "That doorway is the Tomb of Neferakh, the king who tried to swallow the sun. My grandmother sang of it."),
      L('elder', "The beasts, Grimtusk, the queen: all of them were fleeing something. I believe Neferakh's tomb is breaking open."),
      L('elder', 'The Tomb entrance stands open in the Dunes, by the Oasis. Go down. Three chambers, then the king himself. He turns day into night.'),
      L('you', 'And if he wakes up angry?'),
      L('elder', 'Then make him sleep again. Permanently, if you can manage it.')],
    outro: [L('elder', "Neferakh is dust. But his tomb wasn't the source; it was a lid. Something in the rift beneath was pushing up."),
      L('smith', "Royal linen and solar embers... I'll need a bigger anvil. Tier-five Royal Tomb gear, whenever you're ready."),
      L('qm', "And I've got Greater Health Potions in. You'll want them for whatever comes next.")],
    reward: { gold: 1400, xp: 5000, mats: { tomb_linen: 6, solar_ember: 1 } }, unlocks: ['shop4', 'pat_tomb'] },
  // game loop C2: two new chapters in ladder order (Frostveil 20-30, Emberdeep 30-40) before the rift; Vorthax / Astrael move to 6-7
  { id: 'frost', n: 4, title: 'The Wyrm Under the Ice', giver: 'qm', mission: 'frost', goal: 'Hunt Skaldra, the Rime Wyrm, in Frostveil Peaks',
    where: 'Attune the frost Realm Gate with 2 Sunbound Sigils (Neferakh Unbound, at the Mission Counter), then hunt Skaldra on the high glacier. Frostveil is a level 20-30 map.',
    intro: [L('qm', "Neferakh's gone quiet, so now the cold's coming down the passes instead. My fur traders came back frozen to their mules."),
      L('qm', 'They swear a wyrm of pure rime coils on the high glacier. Skaldra, the mountain folk call her. She breathes winter.'),
      L('elder', 'The tomb was a lid, and the lid is off. Whatever pushed the beasts south is reaching for the peaks now.'),
      L('you', "Then I'll go up the mountain."),
      L('qm', 'Take warm socks. And Neferakh\'s sigils: the frost gate only opens for a sun-brand.')],
    outro: [L('qm', 'Skaldra down! The passes are open and the fur is flowing. You have no idea what frostpelt goes for in the Dunes.'),
      L('smith', "Rimeshard and wyrm scale. Cold enough to burn my tongs. I can work Rimeforged steel with this, and the Rimewarden set."),
      L('elder', 'The ice told me something while you were gone. Below the mountains the earth is boiling. Go and see Borin.')],
    reward: { gold: 1700, xp: 6000, mats: { rimeshard: 8, frostpelt: 4, wyrm_scale: 1 } }, unlocks: [] },
  { id: 'ember', n: 5, title: 'Heart of the Caldera', giver: 'smith', mission: 'ember', goal: 'Hunt Pyrrhex, the Caldera Heart, in Emberdeep',
    where: "Attune the ember Realm Gate with 2 Rimebound Sigils (Skaldra's Trial), then hunt Pyrrhex in the heart of the caldera. Emberdeep is a level 30-40 map.",
    intro: [L('smith', "Feel that? The anvil's warm and I haven't lit the forge. Something under Emberdeep is beating like a heart."),
      L('smith', "Pyrrhex. The caldera itself, woken up and angry. Every vent in the realm is pumping in time with it."),
      L('elder', 'Rifts, ice, and now fire. Someone is pulling the realm apart, one seam at a time.'),
      L('you', 'Then I stop the heartbeat.'),
      L('smith', "Bring me back cinderglass. If I'm going to be cooked, I want to be cooked making something good.")],
    outro: [L('smith', "The anvil's cold again. Ha! And look at this cinderglass: tier-six work, finally. Cinderforged and the Caldera Warplate."),
      L('qm', "The vents are quiet and the hot springs are back to just hot. I'm putting Emberdeep salts on the shelf."),
      L('hana', 'And the Elder found where all of it was coming from: a rift. A real one. I\'ve put it on the board.')],
    reward: { gold: 2200, xp: 8000, mats: { cinderglass: 8, basalt_core: 4, heart_ember: 1 } }, unlocks: [] },
  { id: 'vorthax', n: 6, title: 'The Riftbound Tyrant', giver: 'hana', mission: 'vorthax', goal: 'Defeat Vorthax in the Rift Sanctum',
    where: "Attune the violet Realm Gate to the Astral Rift with 2 Cinder Sigils (Pyrrhex's Trial). The Rift Sanctum's entrance stands in the Rift (a crown on the map), always open. The Astral Rift is a level 40-50 map; Vorthax is level 49.",
    intro: [L('hana', "The Elder sent word. Past Emberdeep the sky is torn open: a whole land of broken stars, the Astral Rift. And at its heart, a sanctum with something on a throne."),
      L('hana', "Vorthax. Every scout we send comes back talking about wards, lanes, and a countdown. Most come back."),
      L('elder', 'He is the hand that pushed the beasts out of the Wilds. Close the rift and the realm can breathe.'),
      L('hana', "Pyrrhex's sigils will tune the violet gate to the Rift. Cross it, find the Sanctum, and be careful. Please.")],
    outro: [L('hana', "The rift is closing! The whole village felt it. The fountain is running clear for the first time in years."),
      L('smith', "Rift cores! Do you know what I can do with these? Riftforged gear. It hums when you swing it."),
      L('elder', 'Yet the stars over the sanctum are wrong. One of them is watching us. Keep two of those cores: they open the way to her. Come to me when you have rested.')],
    reward: { gold: 2000, xp: 7000, mats: { rift_core: 3 } }, unlocks: ['pat_rift'] },
  { id: 'astrael', n: 7, title: 'The Watching Star', giver: 'elder', mission: 'astrael', goal: 'Win the Trial of Astrael in the Star Sanctum',
    where: 'Attune the Astral Sanctum with 2 Rift Cores (Vorthax drops them) on the Realm Gate map, then pick Astrael at the Mission Counter. She is level 50. Push her HP to skip her acts; the Extreme trial opens after your first win.',
    intro: [L('elder', "Vorthax was a jailer, not a king. He was holding a door shut. Behind it waits Astrael, the Watching Star."),
      L('elder', 'She does not hate us. She is testing us. Three acts, my grandmother said, and a final light.'),
      L('you', 'Then I pass the test.'),
      L('elder', 'Then you will be the first. Go with the whole village behind you.')],
    outro: [L('elder', 'She yielded. The star has gone quiet, and it is just a star again. You did what my grandmother only sang about.'),
      L('hana', "Brightwater has a new name for you: Starbreaker. I've already painted it on the mission board."),
      L('smith', "Star shards. I'll forge you something worthy of the name. Starforged, and nothing less than legendary."),
      L('qm', "And for the record, the village purse is covering this one. Don't get used to it.")],
    reward: { gold: 3000, xp: 10000, mats: { star_shard: 3 } }, unlocks: ['pat_star', 'title'] },
];
export const CHAPTER = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));
/** small talk when an NPC has nothing story-related to say (cycled) */
export const IDLE = {
  hana: ['Need a mission? The board is right here.', 'Carts are moving again, thanks to you.', 'Remember: free hunts clear when their boss falls.'],
  smith: ["Upgrades past +7 can crack. That's metal for you.", 'Salvage your spares. Good ore is good ore.', 'Bring me materials, I bring you steel.'],
  qm: ['Potions! Get your potions!', "Elixirs don't drink themselves, friend.", 'I buy anything that is not nailed down. And some things that are.'],
  elder: ['The old songs are older than the village.', 'Rest, child. The realm will still need saving tomorrow.', 'Every chain of deeds starts with one step.'],
};

export const STORY_VERSION = 2; // (game loop C2: the Frostveil / Emberdeep chapters; old saves re-run the migration so earlier clears count, no windfall)
export const newStory = () => ({ v: STORY_VERSION, done: {}, seen: {}, news: {} });
/** legacy flags (the old per-browser unlocks) that prove a clear: { dunes, tomb, astx, astxClear } */
export function clearedEver(pr, mission, legacy = {}) {
  const r = pr.records && pr.records[mission];
  if (r && r.clears > 0) return true;
  if (mission === 'field') return !!(legacy.dunes || legacy.tomb || legacy.astx); // the Dunes gate opens when Grimtusk falls
  if (mission === 'dunes') return !!(legacy.tomb || legacy.astx); // (a Tomb portal comes from the Dunes)
  if (mission === 'tomb') return !!legacy.tomb;
  if (mission === 'vorthax') return !!(legacy.astx || (pr.records && pr.records.astrael && pr.records.astrael.clears > 0));
  if (mission === 'astrael') return !!(legacy.astx || legacy.astxClear || (pr.records && pr.records.astraelx && pr.records.astraelx.clears > 0));
  return false;
}
/** first load: create the story, marking already-cleared chapters done (unlocks apply, no gold / XP) */
export function migrateStory(pr, legacy = {}) {
  if (pr.story && pr.story.v === STORY_VERSION) return pr.story;
  const st = { ...newStory(), ...(pr.story && typeof pr.story === 'object' ? pr.story : {}), v: STORY_VERSION };
  st.done = st.done && typeof st.done === 'object' ? st.done : {}; st.seen = st.seen || {}; st.news = st.news || {};
  for (const c of CHAPTERS) if (!st.done[c.id] && clearedEver(pr, c.mission, legacy)) { st.done[c.id] = 'legacy'; st.seen[c.id] = 1; for (const u of c.unlocks) st.news[u] = 1; }
  pr.story = st;
  return st;
}
export const current = (st) => CHAPTERS.find((c) => !st.done[c.id]) || null;
export const isDone = (st, id) => !!st.done[id];
export const allDone = (st) => CHAPTERS.every((c) => st.done[c.id]);
/** 'done' | 'ready' (objective met, turn it in) | 'active' (the current chapter) | 'cleared' (a later chapter already beaten) | 'locked' */
export function status(pr, c, legacy = {}) {
  const st = pr.story; if (st.done[c.id]) return 'done';
  const cur = current(st), met = clearedEver(pr, c.mission, legacy);
  if (cur === c) return met ? 'ready' : 'active';
  return met ? 'cleared' : 'locked';
}
/** every unlock earned so far */
export function storyUnlocks(st) { const out = new Set(); for (const c of CHAPTERS) if (st && st.done[c.id]) for (const u of c.unlocks) out.add(u); return out; }
export const storyHas = (pr, u) => !!(pr && pr.story && storyUnlocks(pr.story).has(u));
/** Forge recipes: the account milestone OR the story pattern opens them (story-only recipes need the pattern) */
const RECIPE_PATTERN = { set_wild: 'pat_wild', forge_dunes: 'pat_dune', set_dune: 'pat_dune', forge_tomb: 'pat_tomb', pat_rift: 'pat_rift', pat_star: 'pat_star' };
export function recipeOpen(pr, r) {
  if (r.story) return storyHas(pr, r.unlock);
  return hasMilestone(pr, r.unlock) || (RECIPE_PATTERN[r.unlock] ? storyHas(pr, RECIPE_PATTERN[r.unlock]) : false);
}
/** the Quartermaster's stock tier (1..4) */
export function shopTier(pr) { const u = pr && pr.story ? storyUnlocks(pr.story) : new Set(); return 1 + ['shop2', 'shop3', 'shop4'].filter((k) => u.has(k)).length; }
/** what an NPC wants to say right now: { kind: 'turnin' | 'intro' | 'news', ch?, unlocks? } or null */
export function pendingFor(pr, npc, legacy = {}) {
  const st = pr.story, c = current(st);
  if (c && c.giver === npc) { const s = status(pr, c, legacy); if (s === 'ready') return { kind: 'turnin', ch: c }; if (!st.seen[c.id]) return { kind: 'intro', ch: c }; }
  const mine = { smith: ['pat_wild', 'pat_dune', 'pat_tomb', 'pat_rift', 'pat_star'], qm: ['shop2', 'shop3', 'shop4'] }[npc];
  if (mine) { const fresh = mine.filter((u) => storyHas(pr, u) && !st.news[u]); if (fresh.length) return { kind: 'news', unlocks: fresh }; }
  return null;
}
/** hand in the current chapter: pays the reward into the profile; returns the summary (null if it is not ready) */
export function claim(pr, id, legacy = {}) {
  const c = CHAPTER[id]; if (!c || status(pr, c, legacy) !== 'ready') return null;
  pr.gold = (pr.gold | 0) + c.reward.gold; pr.accXp = (pr.accXp | 0) + c.reward.xp;
  for (const [k, n] of Object.entries(c.reward.mats)) pr.mats[k] = (pr.mats[k] | 0) + n;
  pr.story.done[c.id] = 'claimed'; pr.story.seen[c.id] = 1;
  return { ch: c, reward: c.reward, unlocks: c.unlocks.map((u) => ({ id: u, ...UNLOCKS[u] })), next: current(pr.story) };
}
