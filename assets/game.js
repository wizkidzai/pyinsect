// Innvadex: a bug-catching game (see "Innvadex" in requirements.md).
// When the app finds an invasive bug, app.js calls Innvadex.encounter(). The player taps the
// bug in a quick minigame to catch it, and it goes into their Innvadex with points, a rarity and
// a fact card. Everything is saved on this device only (localStorage), so no accounts are needed.

const GAME_KEY = "pyinsect.game";

// Rarity: the more harm a bug does to nature, the rarer (and more valuable) it is
const RARITY = {
  common:    { label: "Common",    points: 10 },
  rare:      { label: "Rare",      points: 25 },
  legendary: { label: "Legendary", points: 50 },
};

// One fact card per invasive species. Keep these in sync with `invasive` in assets/models/.
const SPECIES_FACTS = {
  agrilus_planipennis: { rarity: "legendary", group: "beetle", emoji: "🪲",
    fact: "A shiny, bright green beetle about as long as a grain of rice.",
    harm: "Its babies (larvae) tunnel under ash tree bark and kill the tree. It has killed hundreds of millions of ash trees in North America.",
    todo: "Take a photo and report it. Don't move firewood to new places, because the larvae hide inside." },
  anoplophora_glabripennis: { rarity: "legendary", group: "beetle", emoji: "🪲",
    fact: "A big, shiny black beetle with white spots and very long black-and-white striped antennae.",
    harm: "It tunnels into maple trees and other hardwoods, which weakens and kills them.",
    todo: "Take a photo and report it. Look for perfectly round holes in tree trunks." },
  lycorma_delicatula: { rarity: "legendary", group: "bug", emoji: "🦗",
    fact: "Its gray front wings have black spots. When it flies, it shows bright red back wings.",
    harm: "It sucks sap from grapevines and trees and leaves sticky goo that grows black mold.",
    todo: "Take a photo and report it. Check cars and outdoor stuff for its mud-like egg patches." },
  vespa_mandarinia: { rarity: "legendary", group: "wasp", emoji: "🐝",
    fact: "The world's biggest hornet, almost as long as your thumb, with a big orange head.",
    harm: "A small group can wipe out a whole honeybee hive in a few hours.",
    todo: "Stay far away. Its sting is very painful. Take a photo from a safe distance and report it." },
  adelges_piceae: { rarity: "rare", group: "bug", emoji: "🐛",
    fact: "A tiny bug that hides under a fluffy white coat that looks like wool.",
    harm: "It sucks sap from fir trees, and over a few years the trees can die.",
    todo: "Look for white fuzzy spots on fir bark. Take a photo and report it." },
  coptotermes_formosanus: { rarity: "rare", group: "termite", emoji: "🐜",
    fact: "A termite that lives in giant colonies, sometimes with millions of termites.",
    harm: "It eats wood in houses and living trees, and it is very hard to get rid of.",
    todo: "Take a photo and report it. Swarms often fly around lights on spring evenings." },
  lymantria_dispar: { rarity: "rare", group: "moth", emoji: "🦋",
    fact: "A moth whose hairy caterpillars have rows of blue and red dots on their backs.",
    harm: "Its caterpillars eat the leaves of hundreds of kinds of trees and can strip whole forests bare.",
    todo: "Don't touch the caterpillars, because the hairs can make your skin itchy. Take a photo and report it." },
  popillia_japonica: { rarity: "rare", group: "beetle", emoji: "🪲",
    fact: "A shiny beetle with a green head and copper-colored wings.",
    harm: "It eats more than 300 kinds of plants. Its grubs eat grass roots under the ground.",
    todo: "Take a photo and report it. Oregon has worked hard to keep this beetle out." },
  solenopsis_invicta: { rarity: "rare", group: "ant", emoji: "🐜",
    fact: "A small reddish ant that builds big dirt mounds.",
    harm: "It pushes out native ants and other small animals, and it stings people and pets.",
    todo: "Never step on or poke the mounds. Its stings burn. Take a photo from a safe distance." },
  xyleborus_monographus: { rarity: "rare", group: "beetle", emoji: "🪲",
    fact: "A tiny brown beetle, smaller than a grain of rice, that bores into oak trees.",
    harm: "It brings a fungus into the tree that can kill Oregon white oaks.",
    todo: "Look for tiny holes and sawdust on oak trunks. Take a photo and report it." },
  anisandrus_dispar: { rarity: "common", group: "beetle", emoji: "🪲",
    fact: "A tiny beetle that drills holes into fruit and nut trees.",
    harm: "It grows fungus inside the tree to eat, and that weakens young trees.",
    todo: "Take a photo. Check orchards and young trees for tiny holes." },
  exomala_orientalis: { rarity: "common", group: "beetle", emoji: "🪲",
    fact: "A small beetle that can be tan, brown, or black, often with dark spots.",
    harm: "Its grubs eat the roots of grass and plants in lawns and gardens.",
    todo: "Take a photo. Grown-ups can check for grubs under brown lawn patches." },
  halyomorpha_halys: { rarity: "common", group: "bug", emoji: "🐞",
    fact: "A brown bug shaped like a shield that smells bad when it's squished.",
    harm: "It damages fruits and vegetables, and in fall big groups crawl into houses.",
    todo: "Take a photo. Seal cracks around windows to keep them out." },
  harmonia_axyridis: { rarity: "common", group: "beetle", emoji: "🐞",
    fact: "A ladybug that can be orange, red, or yellow. It often has a black \"M\" behind its head.",
    harm: "It eats native ladybugs' food and sometimes the native ladybugs too.",
    todo: "Take a photo. Look for the \"M\" mark to tell it apart from native ladybugs." },
  linepithema_humile: { rarity: "common", group: "ant", emoji: "🐜",
    fact: "A tiny brown ant that forms huge \"supercolonies\" that can stretch for miles.",
    harm: "It pushes out native ants that other animals depend on for food.",
    todo: "Take a photo. Keep food sealed so they don't move indoors." },
  macrodactylus_subspinosus: { rarity: "common", group: "beetle", emoji: "🪲",
    fact: "A thin, tan beetle with long, spiny orange legs.",
    harm: "It eats the flowers and leaves of roses, grapes, and fruit trees. It is poisonous to chickens.",
    todo: "Take a photo. Keep chickens away from it." },
  pieris_rapae: { rarity: "common", group: "moth", emoji: "🦋",
    fact: "A white butterfly with one or two black spots on each wing. It came from Europe.",
    harm: "Its green caterpillars munch cabbage, broccoli, and kale.",
    todo: "Take a photo. Check under garden leaves for small green caterpillars." },
  polistes_dominula: { rarity: "common", group: "wasp", emoji: "🐝",
    fact: "A yellow-and-black paper wasp that builds open, umbrella-shaped nests.",
    harm: "It pushes out native paper wasps and competes with them for food.",
    todo: "Don't swat it or touch the nest, because it can sting. Take a photo from a safe distance." },
};

// Badges: each one has a check that looks at the saved game
const BADGES = [
  { id: "first",     emoji: "🎉", name: "First Catch!",      desc: "Catch your first invasive bug.",   earned: g => totalCaught(g) >= 1 },
  { id: "five",      emoji: "🖐️", name: "High Five",         desc: "Catch 5 bugs.",                    earned: g => totalCaught(g) >= 5 },
  { id: "kinds3",    emoji: "🔍", name: "Bug Detective",     desc: "Catch 3 different kinds of bugs.", earned: g => kindsCaught(g) >= 3 },
  { id: "rare",      emoji: "💎", name: "Rare Find",         desc: "Catch a Rare bug.",                earned: g => caughtRarity(g, "rare") },
  { id: "legendary", emoji: "👑", name: "Legend Hunter",     desc: "Catch a Legendary bug.",           earned: g => caughtRarity(g, "legendary") },
  { id: "points100", emoji: "💯", name: "Point Pro",         desc: "Score 100 points.",                earned: g => g.points >= 100 },
  { id: "half",      emoji: "📗", name: "Halfway There",     desc: "Fill half your Innvadex.",         earned: g => kindsCaught(g) >= Math.ceil(gameSpecies().length / 2) },
  { id: "all",       emoji: "🏆", name: "Innvadex Master",   desc: "Catch every kind of bug.",         earned: g => kindsCaught(g) >= gameSpecies().length },
  { id: "protector", emoji: "🛡️", name: "Nature Protector",  desc: "Find 5 native bugs.",              earned: g => g.protector >= 5 },
  { id: "trainer",   emoji: "⚔️", name: "Battle Buddy",      desc: "Win a battle against a trainer.",  earned: g => g.wins >= 1 },
  { id: "daily",     emoji: "📅", name: "Challenge Champ",   desc: "Finish a daily challenge.",        earned: g => g.dailyDone >= 1 },
  // One badge per forest gym (see GYMS below)
  { id: "gym-forestpark", emoji: "🌲", name: "Forest Park Badge",  desc: "Beat the Forest Park gym.",  earned: g => g.gyms.includes("forestpark") },
  { id: "gym-tillamook",  emoji: "🌧️", name: "Tillamook Badge",    desc: "Beat the Tillamook gym.",    earned: g => g.gyms.includes("tillamook") },
  { id: "gym-willamette", emoji: "🍄", name: "Willamette Badge",   desc: "Beat the Willamette gym.",   earned: g => g.gyms.includes("willamette") },
  { id: "gym-mthood",     emoji: "🏔️", name: "Mount Hood Badge",   desc: "Beat the Mount Hood gym.",   earned: g => g.gyms.includes("mthood") },
];

const MINIGAME_TAPS = 3, MINIGAME_SECONDS = 10;

// ---------- version 2: protector points, daily challenges, AI trainers and forest gyms ----------

// Finding a native bug (one that belongs here) earns protector points. We never catch those.
const PROTECTOR_POINTS = 2, NATIVE_MIN_CONFIDENCE = 50;

// One challenge a day, the same for everyone. Each check looks at something that just happened.
const DAILY_REWARD = 20;
const CHALLENGES = [
  { text: "Catch any invasive bug.",              check: ev => ev.type === "catch" },
  { text: "Catch a beetle.",                      check: ev => ev.type === "catch" && SPECIES_FACTS[ev.species].group === "beetle" },
  { text: "Find a native bug (and leave it be!).", check: ev => ev.type === "native" },
  { text: "Win a battle against a trainer.",      check: ev => ev.type === "win" },
  { text: "Catch a Rare or Legendary bug.",       check: ev => ev.type === "catch" && SPECIES_FACTS[ev.species].rarity !== "common" },
  { text: "Catch a bug that stings or bites (an ant or wasp).", check: ev => ev.type === "catch" && ["ant", "wasp"].includes(SPECIES_FACTS[ev.species].group) },
];

// Battle strength by rarity, and each group's special move
const STATS = { common: { hp: 30, atk: 8 }, rare: { hp: 38, atk: 10 }, legendary: { hp: 46, atk: 12 } };
const SPECIAL_MOVES = { beetle: "Wood Drill", ant: "Swarm", wasp: "Sting", moth: "Leaf Munch", bug: "Sap Suck", termite: "Chomp" };
const SPECIAL_HIT_CHANCE = 0.7;
const TEAM_SIZE = 6;

// AI trainers. `level` is how smart they are (1 = easy, 2 = medium, 3 = hard, see foeMove()).
// `unlock` is how many kinds of bugs you need in your Innvadex to battle them.
// `say` is what they say: before the battle, when they send out a new bug, when you win, when they win.
const TRAINERS = [
  { id: "sam",   emoji: "🧒", name: "Bug Catcher Sam", level: 1, unlock: 1, reward: 15, team: ["pieris_rapae"],
    say: { hi: "I just caught my first bug! Let's battle!", next: "Uh oh… go, buddy!", lose: "Wow, you're good! I'll keep practicing.", win: "Yay, I won! Good game!" } },
  { id: "rosa",  emoji: "🌻", name: "Gardener Rosa",   level: 1, unlock: 1, reward: 15, team: ["exomala_orientalis", "pieris_rapae"],
    say: { hi: "These pests keep eating my vegetables! Show me what you've got.", next: "Don't give up, little cabbage-muncher!", lose: "You're a great gardener's helper!", win: "My garden bugs are tougher than they look!" } },
  { id: "jo",    emoji: "🥾", name: "Hiker Jo",        level: 1, unlock: 1, reward: 15, team: ["harmonia_axyridis", "linepithema_humile"],
    say: { hi: "I found these on the trail. Ready?", next: "Here comes my next one!", lose: "Good battle! See you on the trail.", win: "Ha! Hiking makes you strong!" } },
  { id: "ben",   emoji: "🚜", name: "Farmer Ben",      level: 2, unlock: 2, reward: 20, team: ["halyomorpha_halys", "popillia_japonica", "anisandrus_dispar"],
    say: { hi: "These bugs damage my crops every year. Let's see if you can handle them!", next: "Next one's from the apple orchard!", lose: "You'd make a fine farmer!", win: "Farm work makes my bugs tough!" } },
  { id: "lee",   emoji: "🔬", name: "Scientist Lee",   level: 2, unlock: 3, reward: 20, team: ["halyomorpha_halys", "polistes_dominula", "popillia_japonica"],
    say: { hi: "I've studied these bugs for years. Let's test your skills!", next: "Interesting… try this one!", lose: "Fascinating! You've earned my respect.", win: "Science wins this time!" } },
  { id: "ana",   emoji: "🍯", name: "Beekeeper Ana",   level: 2, unlock: 3, reward: 25, team: ["polistes_dominula", "linepithema_humile", "solenopsis_invicta"],
    say: { hi: "These invaders bother my honeybees. Let's see how you do!", next: "Careful, this one stings!", lose: "My bees thank you!", win: "Buzz buzz, I win!" } },
  { id: "kai",   emoji: "🌳", name: "Arborist Kai",    level: 3, unlock: 4, reward: 30, team: ["adelges_piceae", "xyleborus_monographus", "agrilus_planipennis"],
    say: { hi: "I take care of trees. These bugs are the worst for them. Bring your best!", next: "Trees need protecting. Next!", lose: "You really know your tree pests!", win: "Learn more about tree pests and come back!" } },
  { id: "hazel", emoji: "🎓", name: "Professor Hazel", level: 3, unlock: 6, reward: 40,
    team: ["lymantria_dispar", "coptotermes_formosanus", "anoplophora_glabripennis", "lycorma_delicatula", "vespa_mandarinia"],
    say: { hi: "I teach about invasive species. This is my final exam. Are you ready?", next: "Excellent. Now, try this one!", lose: "You pass with flying colors!", win: "Study the Learn about species page and try again!" } },
];

// Gyms are named after real Oregon forests. Each one opens when your Innvadex has enough kinds of bugs.
const GYMS = [
  { id: "forestpark", emoji: "🌲", name: "Forest Park Gym",        leader: "Ranger Fern",   level: 1, unlock: 1, reward: 50,
    team: ["exomala_orientalis", "anisandrus_dispar"],
    say: { hi: "Welcome to Forest Park! Let's see if you can protect it.", next: "The forest is counting on me!", lose: "You've earned the Forest Park Badge!", win: "Come back when you're stronger!" } },
  { id: "tillamook",  emoji: "🌧️", name: "Tillamook Forest Gym",   leader: "Ranger Moss",   level: 2, unlock: 3, reward: 50,
    team: ["macrodactylus_subspinosus", "solenopsis_invicta", "adelges_piceae"],
    say: { hi: "Rain or shine, I'm ready to battle!", next: "A little rain won't stop me!", lose: "You've earned the Tillamook Badge!", win: "The rain is on my side today!" } },
  { id: "willamette", emoji: "🍄", name: "Willamette Forest Gym",  leader: "Ranger Cedar",  level: 3, unlock: 5, reward: 75,
    team: ["xyleborus_monographus", "lymantria_dispar", "coptotermes_formosanus", "popillia_japonica"],
    say: { hi: "These are the bugs that worry us most in the Willamette. Show me what you know!", next: "My forest won't give up!", lose: "You've earned the Willamette Badge!", win: "Train a bit more, then come back!" } },
  { id: "mthood",     emoji: "🏔️", name: "Mount Hood Forest Gym",  leader: "Ranger Summit", level: 3, unlock: 8, reward: 100,
    team: ["agrilus_planipennis", "anoplophora_glabripennis", "lycorma_delicatula", "vespa_mandarinia"],
    say: { hi: "You made it to the top! My Legendary bugs are the toughest in Oregon.", next: "A Legendary bug never gives up!", lose: "Amazing! You've earned the Mount Hood Badge!", win: "The mountain wins this time. Keep training!" } },
];

// ---------- version 3: evolution, ranks, shop, quiz, map, sounds ----------

// Catch the same kind of bug 3 times and it levels up. Each level makes it stronger in battles.
const CATCHES_PER_LEVEL = 3, MAX_LEVEL = 3, LEVEL_BONUS = { hp: 6, atk: 2 };
const bugLevel = n => Math.min(MAX_LEVEL, 1 + Math.floor(n / CATCHES_PER_LEVEL));

// Ranks go up with your points (coins you spend don't count against them)
const RANKS = [
  [0, "🌱", "Rookie"], [50, "🧭", "Explorer"], [150, "🎒", "Ranger"],
  [300, "🦸", "Bug Hero"], [600, "🌲", "Forest Guardian"], [1000, "👑", "Invasive Legend"],
];
const rankOf = points => RANKS.filter(r => points >= r[0]).pop();

// The item shop. Items are used up automatically the next time they can help.
const ITEMS = [
  { id: "supernet",  emoji: "🥅", name: "Super Net",  price: 30, desc: "Your next minigame gets 5 extra seconds." },
  { id: "stickynet", emoji: "🍯", name: "Sticky Net", price: 40, desc: "Your next minigame needs only 2 taps." },
  { id: "snack",     emoji: "🍃", name: "Bug Snack",  price: 25, desc: "In a battle, heal your bug all the way. Uses your turn." },
];
const SUPERNET_SECONDS = 5, STICKYNET_TAPS = 2;

// The quiz: right answers earn points, up to a few a day
const QUIZ_POINTS = 5, QUIZ_DAILY_MAX = 5;

// The catch map: spots are rounded to 3 decimal places (about a city block) and saved only here
const MAP_DECIMALS = 3;

// ---------- saving ----------
function loadGame() {
  let g = null;
  try { g = JSON.parse(localStorage.getItem(GAME_KEY)); } catch {}
  g = { points: 0, caught: {}, badges: [], protector: 0, wins: 0, gyms: [], daily: null, dailyDone: 0,
    items: {}, spots: [], useMap: false, muted: false, quiz: { day: null, right: 0 }, ...(g || {}) };
  if (g.coins == null) g.coins = g.points;   // games saved before the shop existed
  return g;
}
function saveGame(g) { try { localStorage.setItem(GAME_KEY, JSON.stringify(g)); } catch {} }

// The bugs in the game: the invasive ones this model knows that have a fact card
const gameSpecies = () => (window.PYINSECT_MODEL?.invasive || []).filter(s => SPECIES_FACTS[s])
  .sort((a, b) => Object.keys(RARITY).indexOf(SPECIES_FACTS[b].rarity) - Object.keys(RARITY).indexOf(SPECIES_FACTS[a].rarity) || commonName(a).localeCompare(commonName(b)));
const totalCaught = g => Object.values(g.caught).reduce((a, b) => a + b, 0);
const kindsCaught = g => Object.keys(g.caught).length;
const caughtRarity = (g, r) => Object.keys(g.caught).some(s => SPECIES_FACTS[s]?.rarity === r);
// Points count toward your rank, and you get the same number of coins to spend in the shop
const addPoints = (g, n) => { g.points += n; g.coins += n; };
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const todaysChallenge = () => {
  const d = new Date();
  return CHALLENGES[Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5) % CHALLENGES.length];
};

// After something happens (a catch, a native bug, a battle win), check the daily challenge and
// the badges. Changes the saved game `g` and returns the messages to show.
function progress(g, ev) {
  const lines = [], rankBefore = g.rankSeen ?? rankOf(g.points - (ev.pts || 0))[2];
  if (g.daily !== todayKey() && todaysChallenge().check(ev)) {
    g.daily = todayKey(); g.dailyDone++; addPoints(g, DAILY_REWARD);
    lines.push(`📅 Daily challenge done! +${DAILY_REWARD} points`);
  }
  const had = new Set(g.badges);
  const fresh = BADGES.filter(b => !had.has(b.id) && b.earned(g));
  g.badges.push(...fresh.map(b => b.id));
  lines.push(...fresh.map(b => `${b.emoji} New badge: ${b.name.replace(/!$/, "")}!`));
  const rank = rankOf(g.points);
  if (rank[2] !== rankBefore) lines.push(`${rank[1]} Rank up! You're now ${/^[AEIOU]/.test(rank[2]) ? "an" : "a"} ${rank[2]}!`);
  g.rankSeen = rank[2];
  if (lines.length) sound("badge");
  return lines;
}

// ---------- building blocks ----------
function rarityTag(species) {
  const r = SPECIES_FACTS[species].rarity;
  return el("span", `rarity ${r}`, RARITY[r].label);
}

function factCard(species, caughtCount) {
  const f = SPECIES_FACTS[species];
  const card = el("article", "factcard");
  const head = el("div", "factcard-head");
  head.append(el("span", "bug-emoji", f.emoji), el("div", null));
  head.lastChild.append(el("strong", null, commonName(species)), el("span", "sci", sciName(species)));
  const tags = el("div", "tags");
  tags.append(rarityTag(species), el("span", "pts", `${RARITY[f.rarity].points} points`));
  if (caughtCount) tags.append(el("span", "pts", `Caught ×${caughtCount} · Lv ${bugLevel(caughtCount)}`));
  const facts = el("dl", "facts");
  for (const [k, v] of [["What it is", f.fact], ["Why it's a problem", f.harm], ["If you see one", f.todo]])
    facts.append(el("dt", null, k), el("dd", null, v));
  card.append(head, tags, facts);
  return card;
}

// ---------- the Innvadex panel ----------
function renderGame() {
  const g = loadGame(), all = gameSpecies();
  $("gamePoints").textContent = `${g.points} points`;
  const rank = rankOf(g.points), next = RANKS[RANKS.indexOf(rank) + 1];
  $("gameRank").textContent = `${rank[1]} ${rank[2]}${next ? ` · ${next[0] - g.points} to ${next[2]}` : ""}`;
  $("gameCoins").textContent = `🪙 ${g.coins} coins`;
  $("muteBtn").textContent = g.muted ? "🔇 Sound off" : "🔊 Sound on";
  $("muteBtn").setAttribute("aria-pressed", g.muted);
  $("gameProgress").textContent = `${kindsCaught(g)} of ${all.length} caught`;
  $("gameProtector").textContent = `🛡️ ${g.protector} protector`;
  const doneToday = g.daily === todayKey();
  $("dailyText").textContent = todaysChallenge().text;
  $("dailyState").textContent = doneToday ? "✅ Done! Come back tomorrow." : `+${DAILY_REWARD} points`;
  $("daily").classList.toggle("done", doneToday);

  const dex = $("dexGrid"); dex.innerHTML = "";
  for (const s of all) {
    const n = g.caught[s] || 0;
    const slot = el("button", "dex-slot" + (n ? " caught" : ""));
    slot.type = "button";
    if (n) {
      slot.append(el("span", "bug-emoji", SPECIES_FACTS[s].emoji), el("strong", null, commonName(s)), rarityTag(s),
        el("span", "count", `Lv ${bugLevel(n)} · ×${n}`));
      slot.onclick = () => showFact(s, n);
    } else {
      slot.append(el("span", "bug-emoji", "❓"), el("strong", null, "???"), el("span", "count", "Not caught yet"));
      slot.disabled = true;
    }
    dex.append(slot);
  }

  const badges = $("badgeList"); badges.innerHTML = "";
  for (const b of BADGES) {
    const has = g.badges.includes(b.id);
    const item = el("div", "badge" + (has ? " earned" : ""));
    item.title = b.desc;
    item.append(el("span", "badge-emoji", has ? b.emoji : "🔒"), el("strong", null, b.name), el("span", null, b.desc));
    badges.append(item);
  }

  const learn = $("learnList"); learn.innerHTML = "";
  for (const s of all) learn.append(factCard(s, g.caught[s] || 0));

  renderBattles(g);
  renderShop(g);
  renderMapPanel(g);
}

// The Battle tab: practice trainers, then the forest gyms
function renderBattles(g) {
  const list = $("battleList"); list.innerHTML = "";
  const kinds = kindsCaught(g);
  if (!kinds) list.append(el("p", "empty", "Catch your first invasive bug to start battling. Your caught bugs are your battle team!"));
  const row = (foe, gym) => {
    const item = el("div", "foe" + (gym && g.gyms.includes(foe.id) ? " beaten" : ""));
    const who = el("div", "foe-who");
    const level = ["Easy", "Medium", "Hard"][foe.level - 1];
    who.append(el("strong", null, foe.name), el("span", "muted", `${gym ? `Leader: ${foe.leader} · ` : ""}${foe.team.length} bug${foe.team.length === 1 ? "" : "s"} · ${"⭐".repeat(foe.level)} ${level}`));
    const locked = kinds < foe.unlock;
    const b = el("button", "btn" + (locked ? "" : " primary"), locked ? `🔒 Catch ${foe.unlock} kind${foe.unlock === 1 ? "" : "s"}` : gym && g.gyms.includes(foe.id) ? "✅ Battle again" : "Battle!");
    b.type = "button"; b.disabled = locked;
    b.onclick = () => battle(foe, gym);
    item.append(el("span", "bug-emoji", foe.emoji), who, b);
    list.append(item);
  };
  list.append(el("h3", null, "Trainers"));
  TRAINERS.forEach(t => row(t, false));
  list.append(el("h3", null, "Forest gyms"));
  GYMS.forEach(gym => row(gym, true));
}

function showTab(name) {
  for (const t of document.querySelectorAll(".game-tabs [data-tab]")) {
    const on = t.dataset.tab === name;
    t.setAttribute("aria-selected", on);
    $(`tab-${t.dataset.tab}`).hidden = !on;
  }
}

// ---------- pop-up windows ----------
function openPopup(content, buttons) {
  const pop = $("gamePopup"), box = $("gamePopupBox");
  box.innerHTML = "";
  box.append(...content);
  const bar = el("div", "actions");
  for (const [text, primary, onClick] of buttons) {
    const b = el("button", "btn" + (primary ? " primary" : ""), text);
    b.type = "button";
    b.onclick = () => { closePopup(); onClick?.(); };
    bar.append(b);
  }
  box.append(bar);
  pop.hidden = false;
  bar.querySelector("button")?.focus();
}
function closePopup() {
  $("gamePopup").hidden = true;
  const done = popupDone; popupDone = null; done?.();
}
let popupDone = null;

function showFact(species, n) {
  openPopup([factCard(species, n)], [["Close", true]]);
}

function showInstructions() {
  const list = el("ol", "howto");
  for (const step of [
    "Find a bug outside. Take a photo with “Take photo”, or pick one with “Select photos”.",
    "If the bug is invasive, a wild bug appears! Tap it 3 times in 10 seconds to catch it.",
    "Caught bugs go into your Innvadex with points. Common = 10, Rare = 25, Legendary = 50.",
    "Earn badges, like “First Catch!”, as you play.",
    "Find a bug that isn't invasive? Leave it be, and get protector points!",
    "Do the daily challenge for bonus points. There's a new one every day.",
    "Open “Battle” to battle trainers with your caught bugs. Catch more kinds to open the forest gyms.",
    "Catch the same bug 3 times and it levels up, which makes it stronger in battles.",
    "Earn coins as you play, and spend them in the “Shop” on items like the Super Net.",
    "Play the “Quiz” for bonus points, and turn on the “Map” to see where you caught your bugs.",
    "Open “Learn about species” to see every invasive bug, even ones you haven't caught yet.",
  ]) list.append(el("li", null, step));
  const safety = el("div", "safety");
  safety.append(el("strong", null, "Stay safe"));
  const tips = el("ul");
  for (const tip of [
    "Don't touch bugs with bare hands. Some sting or bite.",
    "Never carry an invasive bug (or firewood) to a new place.",
    "Bring a grown-up, and watch where you walk.",
  ]) tips.append(el("li", null, tip));
  safety.append(tips);
  const why = el("p", "muted", "Every invasive bug you find is also reported to the Pyinsect team, so experts can learn where invasive bugs are and where to put traps.");
  openPopup([el("h2", null, "How to play"), list, safety, why], [["Let's go!", true]]);
}

// ---------- the minigame ----------
// The bug (the player's own photo) hops around the box. Tap it 3 times before time runs out.
function minigame(species, photo) {
  return new Promise(resolve => {
    const arena = el("div", "arena");
    const bug = el("button", "wild-bug");
    bug.type = "button";
    bug.setAttribute("aria-label", `Catch the ${commonName(species)}`);
    const img = el("img"); img.src = photo; img.alt = "";
    bug.append(img);
    arena.append(bug);
    // Items from the shop are used up here, if you have them
    const g = loadGame(), used = [];
    let needTaps = MINIGAME_TAPS, seconds = MINIGAME_SECONDS;
    if (g.items.stickynet > 0) { g.items.stickynet--; needTaps = STICKYNET_TAPS; used.push("🍯 Sticky Net: only 2 taps!"); }
    if (g.items.supernet > 0) { g.items.supernet--; seconds += SUPERNET_SECONDS; used.push(`🥅 Super Net: +${SUPERNET_SECONDS} seconds!`); }
    if (used.length) { saveGame(g); renderGame(); }
    const info = el("p", "arena-info", `Tap it ${needTaps} times! ${seconds} seconds left`);
    const bar = el("div", "track"), fill = el("div", "fill");
    fill.style.width = "100%"; bar.append(fill);

    let taps = 0, left = seconds * 10, finished = false;
    const slow = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hop = () => {
      bug.style.left = `${5 + Math.random() * 70}%`;
      bug.style.top = `${5 + Math.random() * 65}%`;
    };
    const end = won => {
      if (finished) return;
      finished = true;
      clearInterval(timer); clearInterval(mover);
      popupDone = () => resolve(won);
      closePopup();
    };
    bug.onclick = () => {
      taps++;
      bug.classList.remove("hit"); void bug.offsetWidth; bug.classList.add("hit");
      sound("hit");
      if (taps >= needTaps) return end(true);
      info.textContent = `${needTaps - taps} more tap${needTaps - taps === 1 ? "" : "s"}!`;
      hop();
    };
    const timer = setInterval(() => {
      left--;
      fill.style.width = `${left / (seconds * 10) * 100}%`;
      if (left <= 0) end(false);
    }, 100);
    const mover = setInterval(hop, slow ? 1800 : 900);
    hop();

    sound("appear");
    openPopup([el("h2", null, `A wild ${commonName(species)} appeared!`), rarityTag(species), ...used.map(u => el("p", "new-badge", u)), arena, bar, info],
      [["Let it go", false, () => end(false)]]);
    $("gamePopupBox").querySelector(".actions button").onclick = () => end(false);
    popupDone = () => end(false);   // closing the pop-up (Escape) lets the bug go
    bug.focus();
  });
}

// ---------- catching ----------
let encounters = Promise.resolve();

// Called by app.js when a photo shows an invasive bug. Bugs found together wait their turn.
function encounter(species, photo) {
  if (!SPECIES_FACTS[species]) return;
  encounters = encounters.then(async () => {
    const won = await minigame(species, photo);
    if (!won) {
      sound("lose");
      await new Promise(r => { popupDone = r; openPopup([el("h2", null, "It got away!"),
        el("p", null, "Don't worry, it was still reported. Find another one and try again.")], [["OK", true]]); });
      return;
    }
    sound("catch");
    const spot = await here();   // null unless the catch map is turned on
    const g = loadGame();
    const pts = RARITY[SPECIES_FACTS[species].rarity].points;
    const before = bugLevel(g.caught[species] || 0);
    g.caught[species] = (g.caught[species] || 0) + 1;
    addPoints(g, pts);
    if (spot) g.spots.push({ species, ...spot, when: new Date().toLocaleDateString() });
    const lines = [];
    if (g.caught[species] > 1 && bugLevel(g.caught[species]) > before) lines.push(`⬆️ Your ${commonName(species)} leveled up to Lv ${bugLevel(g.caught[species])}! It's stronger in battles now.`);
    lines.push(...progress(g, { type: "catch", species, pts }));
    if (spot) lines.push("📍 Saved on your catch map.");
    const extra = lines.map(l => el("p", "new-badge", l));
    saveGame(g);
    renderGame();

    await new Promise(r => { popupDone = r; openPopup([el("h2", null, `Gotcha! +${pts} points`), ...extra, factCard(species, g.caught[species])],
      [["Open Innvadex", true, () => { showTab("dex"); if (window.flow) window.flow.go("game"); else $("game").scrollIntoView({ behavior: "smooth" }); }], ["Keep playing", false]]); });
  });
}

// ---------- bugs that aren't invasive ----------
let toastTimer = null;
function toast(lines) {
  const t = $("gameToast");
  t.innerHTML = "";
  for (const l of lines) t.append(el("p", null, l));
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 6000);
}

// Called by app.js when a real photo shows a bug that isn't on the invasive list
function native(species, confidence) {
  if (confidence < NATIVE_MIN_CONFIDENCE) return;   // not sure what it is, so no points
  const g = loadGame();
  g.protector++; addPoints(g, PROTECTOR_POINTS);
  const lines = [`🛡️ ${commonName(species)} isn't invasive. Leave it be! +${PROTECTOR_POINTS} protector points`, ...progress(g, { type: "native", species })];
  saveGame(g);
  renderGame();
  toast(lines);
}

// Called by app.js when a photo looks AI-made: it doesn't count in the game
function fakePhoto() {
  toast(["🤖 That photo looks AI-made, so it doesn't count in the game. Real photos only!"]);
}

// ---------- battles against AI trainers ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const fighter = (species, level = 1) => {
  const base = STATS[SPECIES_FACTS[species].rarity], hp = base.hp + (level - 1) * LEVEL_BONUS.hp;
  return { species, level, hp, max: hp, atk: base.atk + (level - 1) * LEVEL_BONUS.atk };
};
// Your team: up to 6 kinds you've caught, strongest first
const myTeam = g => gameSpecies().filter(s => g.caught[s])
  .sort((a, b) => bugLevel(g.caught[b]) - bugLevel(g.caught[a])).slice(0, TEAM_SIZE).map(s => fighter(s, bugLevel(g.caught[s])));
const nextAlive = (team, from) => { for (let i = 1; i <= team.length; i++) { const j = (from + i) % team.length; if (team[j].hp > 0) return j; } return -1; };
const specialMove = f => SPECIAL_MOVES[SPECIES_FACTS[f.species].group];

// The bug with the most HP left, not counting the one fighting now (-1 if none)
const nextHealthiest = (team, now) => team.reduce((best, t, i) => i !== now && t.hp > 0 && (best < 0 || t.hp > team[best].hp) ? i : best, -1);

// How the AI trainer picks its move. Smarter trainers think about more things:
//   Easy (1):   picks Tackle or its special move at random.
//   Medium (2): finishes your bug with Tackle when Tackle is sure to win (it never misses).
//               Otherwise it uses its special move, which does more damage on average.
//   Hard (3):   does all that, and also saves a badly hurt bug by switching to a healthier one.
function foeMove(level, team, now, target) {
  const f = team[now];
  if (level <= 1) return Math.random() < 0.5 ? "special" : "tackle";
  const tackleAlwaysKOs = target.hp <= f.atk - 2;
  if (tackleAlwaysKOs) return "tackle";
  if (level >= 3 && f.hp / f.max < 0.25) {
    const other = nextHealthiest(team, now);
    if (other >= 0 && team[other].hp / team[other].max > 0.5 && Math.random() < 0.7) return "switch";
  }
  return "special";
}

function battle(foe, gym) {
  const g = loadGame(), mine = myTeam(g), theirs = foe.team.filter(s => SPECIES_FACTS[s]).map(s => fighter(s));
  if (!mine.length || !theirs.length) return;
  const foeName = gym ? foe.leader : foe.name;
  let me = 0, them = 0, busy = false, over = false;

  const field = el("div", "battle-field");
  const bubble = el("p", "speech");
  const talk = text => { bubble.textContent = `${foe.emoji} ${foeName}: “${text}”`; };
  talk(foe.say.hi);
  const log = el("p", "battle-log", `${foeName} wants to battle!`);
  log.setAttribute("aria-live", "polite");
  const say = text => { log.textContent = text; };
  const side = (team, i, label, cls) => {
    const f = team[i], box = el("div", `fighter ${cls}`);
    const hp = el("div", "track"), fill = el("div", "fill" + (f.hp / f.max < 0.3 ? " low" : ""));
    fill.style.width = `${f.hp / f.max * 100}%`; hp.append(fill);
    box.append(el("span", "muted", label), el("span", "bug-emoji", SPECIES_FACTS[f.species].emoji),
      el("strong", null, `${commonName(f.species)}${f.level > 1 ? ` · Lv ${f.level}` : ""}`), hp, el("span", "hp", `HP ${f.hp}/${f.max} · ${team.filter(t => t.hp > 0).length} of ${team.length} bug${team.length === 1 ? "" : "s"} left`));
    return box;
  };
  const moves = el("div", "battle-moves");
  const btn = (text, onClick) => { const b = el("button", "btn", text); b.type = "button"; b.onclick = onClick; moves.append(b); return b; };
  const tackle = btn("Tackle", () => turn("tackle"));
  const special = btn("", () => turn("special"));
  const swap = btn("Switch bug", () => turn("switch"));
  const snack = btn("", () => turn("snack"));
  const snacks = () => loadGame().items.snack || 0;
  tackle.classList.add("primary");
  const draw = () => {
    field.innerHTML = "";
    field.append(side(theirs, them, foeName, "them"), side(mine, me, "You", "you"));
    special.textContent = `${specialMove(mine[me])} (strong, can miss)`;
    for (const b of [tackle, special]) b.disabled = busy || over;
    swap.disabled = busy || over || nextAlive(mine, me) < 0 || nextAlive(mine, me) === me;
    snack.textContent = `🍃 Bug Snack (${snacks()})`;
    snack.hidden = !snacks();
    snack.disabled = busy || over || mine[me].hp === mine[me].max;
  };

  // One attack. A special move hits harder but can miss.
  const attack = (a, d, useSpecial, owner) => {
    const move = useSpecial ? specialMove(a) : "Tackle", name = `${owner} ${commonName(a.species)}`;
    if (useSpecial && Math.random() > SPECIAL_HIT_CHANCE) return say(`${name} used ${move}… but missed!`);
    const dmg = Math.max(1, Math.round(useSpecial ? a.atk * 1.8 + (Math.random() * 6 - 3) : a.atk + (Math.random() * 4 - 2)));
    d.hp = Math.max(0, d.hp - dmg);
    sound("hit");
    say(`${name} used ${move}! It did ${dmg} damage.`);
  };

  async function turn(kind) {
    if (busy || over) return;
    busy = true;
    if (kind === "switch") { me = nextAlive(mine, me); say(`Go, ${commonName(mine[me].species)}!`); }
    else if (kind === "snack") {
      const g = loadGame(); g.items.snack--; saveGame(g); renderGame();
      mine[me].hp = mine[me].max; sound("heal");
      say(`Your ${commonName(mine[me].species)} ate a Bug Snack and is all healed!`);
    }
    else attack(mine[me], theirs[them], kind === "special", "Your");
    draw(); await wait(900); if (over) return;
    if (theirs[them].hp <= 0) {
      say(`${foeName}'s ${commonName(theirs[them].species)} fainted!`); draw(); await wait(900); if (over) return;
      const n = nextAlive(theirs, them);
      if (n < 0) return finish(true);
      them = n; say(`${foeName} sends out ${commonName(theirs[them].species)}!`); talk(foe.say.next);
      busy = false; return draw();
    }
    // The AI trainer's turn (see foeMove)
    const choice = foeMove(foe.level, theirs, them, mine[me]);
    if (choice === "switch") {
      them = nextHealthiest(theirs, them);
      say(`${foeName} switches to ${commonName(theirs[them].species)}!`); talk(foe.say.next);
    }
    const f = theirs[them], p = mine[me];
    if (choice !== "switch") attack(f, p, choice === "special", `${foeName}'s`);
    draw(); await wait(900); if (over) return;
    if (p.hp <= 0) {
      say(`Your ${commonName(p.species)} fainted!`); draw(); await wait(900); if (over) return;
      const n = nextAlive(mine, me);
      if (n < 0) return finish(false);
      me = n; say(`Go, ${commonName(mine[me].species)}!`);
    }
    busy = false; draw();
  }

  function finish(won, ran) {
    if (over) return;
    over = true; popupDone = null;
    const lines = [];
    let title = ran ? "You ran away." : "You lost this time. Catch more bugs and try again!";
    if (won) {
      const g = loadGame();
      const beatenBefore = gym && g.gyms.includes(foe.id), pts = beatenBefore ? 10 : foe.reward;
      g.wins++; addPoints(g, pts);
      if (gym && !beatenBefore) g.gyms.push(foe.id);
      lines.push(...progress(g, { type: "win" }));
      saveGame(g); renderGame();
      title = `You beat ${foeName}! +${pts} points`;
    }
    const tipBug = foe.team[Math.floor(Math.random() * foe.team.length)];
    sound(won ? "win" : "lose");
    const said = ran ? null : el("p", "speech", `${foe.emoji} ${foeName}: “${won ? foe.say.lose : foe.say.win}”`);
    openPopup([el("h2", null, title), ...(said ? [said] : []), ...lines.map(l => el("p", "new-badge", l)),
      el("p", "muted", `Did you know? ${commonName(tipBug)}: ${SPECIES_FACTS[tipBug].harm}`)], [["OK", true]]);
  }

  openPopup([el("h2", null, `${foe.emoji} ${foe.name}`), bubble, field, log, moves], [["Run away", false]]);
  popupDone = () => finish(false, true);   // "Run away" or Escape
  draw();
  tackle.focus();
}

// ---------- sounds ----------
// Little beeps made by the browser, so there are no sound files to download
let audio = null;
const TUNES = {
  appear: [[523, .08], [659, .08], [784, .12]],
  hit:    [[880, .05]],
  catch:  [[523, .1], [659, .1], [784, .1], [1047, .2]],
  lose:   [[392, .15], [330, .15], [262, .25]],
  win:    [[523, .12], [523, .12], [784, .12], [1047, .3]],
  badge:  [[784, .1], [1047, .1], [1319, .2]],
  heal:   [[440, .1], [554, .1], [659, .15]],
  right:  [[659, .1], [880, .15]],
  wrong:  [[220, .25]],
  buy:    [[988, .08], [1319, .12]],
};
function sound(name) {
  if (loadGame().muted || !TUNES[name]) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    let t = audio.currentTime;
    for (const [freq, len] of TUNES[name]) {
      const osc = audio.createOscillator(), vol = audio.createGain();
      osc.type = "square"; osc.frequency.value = freq;
      vol.gain.setValueAtTime(0.06, t); vol.gain.exponentialRampToValueAtTime(0.001, t + len);
      osc.connect(vol).connect(audio.destination);
      osc.start(t); osc.stop(t + len);
      t += len;
    }
  } catch {}
}

// ---------- the shop ----------
function renderShop(g) {
  const list = $("shopList"); list.innerHTML = "";
  for (const it of ITEMS) {
    const row = el("div", "foe");
    const who = el("div", "foe-who");
    who.append(el("strong", null, `${it.name} · you have ${g.items[it.id] || 0}`), el("span", "muted", it.desc));
    const b = el("button", "btn" + (g.coins >= it.price ? " primary" : ""), `🪙 ${it.price}`);
    b.type = "button"; b.disabled = g.coins < it.price;
    b.setAttribute("aria-label", `Buy ${it.name} for ${it.price} coins`);
    b.onclick = () => buy(it.id);
    row.append(el("span", "bug-emoji", it.emoji), who, b);
    list.append(row);
  }
}
function buy(id) {
  const it = ITEMS.find(i => i.id === id), g = loadGame();
  if (!it || g.coins < it.price) return;
  g.coins -= it.price;
  g.items[id] = (g.items[id] || 0) + 1;
  saveGame(g); renderGame(); sound("buy");
  toast([`${it.emoji} You bought a ${it.name}!`]);
}

// ---------- the quiz ----------
// Shows a clue about one bug and four names to pick from. Clues come from the fact cards.
const shuffle = list => list.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1]);
function newQuestion() {
  const all = gameSpecies(), answer = all[Math.floor(Math.random() * all.length)];
  const kind = Math.random() < 0.5 ? "fact" : "harm";
  const options = shuffle([answer, ...shuffle(all.filter(s => s !== answer)).slice(0, 3)]);
  const box = $("quizBox"); box.innerHTML = "";
  box.append(el("p", "quiz-q", kind === "fact" ? "Which bug is this?" : "Which bug causes this problem?"),
    el("p", "speech", SPECIES_FACTS[answer][kind]));
  const choices = el("div", "quiz-choices"), result = el("p", "quiz-result");
  result.setAttribute("aria-live", "polite");
  const next = el("button", "btn primary", "Next question");
  next.type = "button"; next.hidden = true;
  next.onclick = newQuestion;
  for (const s of options) {
    const b = el("button", "btn", commonName(s));
    b.type = "button";
    b.onclick = () => {
      for (const c of choices.children) c.disabled = true;
      const g = loadGame();
      if (g.quiz.day !== todayKey()) g.quiz = { day: todayKey(), right: 0 };
      if (s === answer) {
        b.classList.add("right"); sound("right");
        if (g.quiz.right < QUIZ_DAILY_MAX) {
          g.quiz.right++; addPoints(g, QUIZ_POINTS);
          const lines = progress(g, { type: "quiz", pts: QUIZ_POINTS });
          result.textContent = [`✅ Right! +${QUIZ_POINTS} points (${g.quiz.right} of ${QUIZ_DAILY_MAX} today)`, ...lines].join("  ");
        } else result.textContent = "✅ Right! You've earned all your quiz points for today. Keep practicing!";
        saveGame(g); renderGame();
      } else {
        b.classList.add("wrong"); sound("wrong");
        [...choices.children].find(c => c.textContent === commonName(answer))?.classList.add("right");
        result.textContent = `Not quite. It's the ${commonName(answer)}.`;
      }
      next.hidden = false; next.focus();
    };
    choices.append(b);
  }
  box.append(choices, result, next);
}

// ---------- the catch map ----------
// Asks the browser where you are, but only if you turned the map on. Gives up after 8 seconds.
function here() {
  if (!loadGame().useMap || !navigator.geolocation) return Promise.resolve(null);
  return new Promise(resolve => navigator.geolocation.getCurrentPosition(
    p => resolve({ lat: +p.coords.latitude.toFixed(MAP_DECIMALS), lon: +p.coords.longitude.toFixed(MAP_DECIMALS) }),
    () => resolve(null), { timeout: 8000, maximumAge: 60000 }));
}

function renderMapPanel(g) {
  $("mapToggle").checked = g.useMap;
  $("mapCount").textContent = g.spots.length ? `${g.spots.length} catch${g.spots.length === 1 ? "" : "es"} on your map.` : "No catches on your map yet.";
  if (map) drawSpots(g);
}

// The map library (Leaflet) and the map pictures (OpenStreetMap) load only when you open the Map tab
let map = null, mapLayer = null, mapLoading = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return mapLoading ??= new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    const js = document.createElement("script");
    js.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    js.onload = resolve; js.onerror = () => { mapLoading = null; reject(); };
    document.head.append(css, js);
  });
}
async function openMap() {
  const g = loadGame();
  if (!g.spots.length) return;
  try { await loadLeaflet(); } catch { $("mapCount").textContent = "The map couldn't load. Check your internet."; return; }
  $("catchMap").hidden = false;
  if (!map) {
    map = L.map("catchMap");
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(map);
  }
  map.invalidateSize();
  drawSpots(g);
}
function drawSpots(g) {
  if (!g.spots.length) return;
  mapLayer?.remove();
  mapLayer = L.layerGroup(g.spots.map(sp => L.marker([sp.lat, sp.lon], { title: commonName(sp.species) })
    .bindPopup(`${SPECIES_FACTS[sp.species]?.emoji || "🐞"} ${commonName(sp.species)}<br>${sp.when}`))).addTo(map);
  map.fitBounds(L.latLngBounds(g.spots.map(sp => [sp.lat, sp.lon])).pad(0.3), { maxZoom: 15 });
}

// ---------- wiring ----------
for (const t of document.querySelectorAll(".game-tabs [data-tab]")) t.onclick = () => {
  showTab(t.dataset.tab);
  if (t.dataset.tab === "quiz" && !$("quizBox").children.length) newQuestion();
  if (t.dataset.tab === "map") openMap();
};
$("muteBtn").onclick = () => { const g = loadGame(); g.muted = !g.muted; saveGame(g); renderGame(); };
$("mapToggle").onchange = e => {
  const g = loadGame(); g.useMap = e.target.checked; saveGame(g);
  // Ask for permission now, so it doesn't pop up in the middle of a catch
  if (g.useMap) navigator.geolocation?.getCurrentPosition(() => {}, () => toast(["📍 Location is blocked, so catches can't go on the map. You can allow it in your browser settings."]));
};
$("howToPlay").onclick = showInstructions;
$("gamePopup").addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); closePopup(); } });
renderGame();
// "How to play", the first time only. With the app screens (assets/flow.js) it waits until they open
// the Game screen, so it doesn't cover the home screen.
function firstHowTo() { if (!loadGame().seenHowTo) { const g = loadGame(); g.seenHowTo = true; saveGame(g); showInstructions(); } }
if (!$("screen-game")) firstHowTo();

window.Innvadex = { encounter, native, fakePhoto, firstHowTo, closePopup };
