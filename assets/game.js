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
  // Added for the Pyinsect 2.8 Oregon model
  ips_typographus: { rarity: "rare", group: "beetle", emoji: "🪲",
    fact: "A small, hairy brown beetle that tunnels under spruce tree bark.",
    harm: "In Europe it has killed huge forests of spruce trees. It isn't in Oregon yet, and we want to keep it that way!",
    todo: "Look for tiny holes and reddish-brown sawdust on spruce trunks. Take a photo and report it." },
  lymantria_monacha: { rarity: "rare", group: "moth", emoji: "🦋",
    fact: "A white moth with black zigzag lines on its wings.",
    harm: "Its caterpillars eat the needles of pine and spruce trees and can harm whole forests.",
    todo: "Take a photo and report it. It isn't in North America yet, so every sighting matters!" },
  cydalima_perspectalis: { rarity: "rare", group: "moth", emoji: "🦋",
    fact: "A white moth with a brown border on its wings. Its green-and-black caterpillars live on boxwood bushes.",
    harm: "Its caterpillars eat boxwood leaves and can strip whole bushes bare.",
    todo: "Check boxwood bushes for webbing and chewed leaves. Take a photo and report it." },
  operophtera_brumata: { rarity: "common", group: "moth", emoji: "🦋",
    fact: "A small brown moth that flies in late fall and winter, when most moths are gone.",
    harm: "Its little green caterpillars eat the buds and young leaves of oaks, maples, and fruit trees in spring.",
    todo: "Take a photo. Look for moths near porch lights on mild winter nights." },
  scolytus_multistriatus: { rarity: "common", group: "beetle", emoji: "🪲",
    fact: "A tiny, shiny reddish-brown beetle that lives under elm tree bark.",
    harm: "It spreads Dutch elm disease, a fungus that has killed millions of elm trees.",
    todo: "Look for tiny round holes in elm bark. Take a photo and report it." },
  drosophila_melanogaster_suzukii: { rarity: "common", group: "fly", emoji: "🪰",
    fact: "A tiny fruit fly with red eyes. The males have a dark spot on each wing.",
    harm: "It lays eggs inside ripe berries and cherries, so the fruit turns mushy.",
    todo: "Take a photo. Pick ripe fruit quickly, and throw away mushy berries." },
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
  { id: "protector", emoji: "🛡️", name: "Nature Protector",  desc: "Find 5 bugs that aren't invasive.",              earned: g => g.protector >= 5 },
  { id: "trainer",   emoji: "⚔️", name: "Battle Buddy",      desc: "Win a battle against a trainer.",  earned: g => g.wins >= 1 },
  { id: "daily",     emoji: "📅", name: "Challenge Champ",   desc: "Finish a daily challenge.",        earned: g => g.dailyDone >= 1 },
  { id: "natives10", emoji: "🌼", name: "Friend of Natives", desc: "Find 10 kinds of bugs that aren't invasive.", earned: g => Object.keys(g.protectorDex).length >= 10 },
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
  { text: "Find a bug that isn't invasive (and leave it be!).", check: ev => ev.type === "native" },
  { text: "Win a battle against a trainer.",      check: ev => ev.type === "win" },
  { text: "Catch a Rare or Legendary bug.",       check: ev => ev.type === "catch" && SPECIES_FACTS[ev.species].rarity !== "common" },
  { text: "Catch a bug that stings or bites (an ant or wasp).", check: ev => ev.type === "catch" && ["ant", "wasp"].includes(SPECIES_FACTS[ev.species].group) },
];

// Battle strength by rarity, and each group's special move
const STATS = { common: { hp: 30, atk: 8 }, rare: { hp: 38, atk: 10 }, legendary: { hp: 46, atk: 12 } };
const SPECIAL_MOVES = { beetle: "Wood Drill", ant: "Swarm", wasp: "Sting", moth: "Leaf Munch", bug: "Sap Suck", termite: "Chomp", fly: "Fruit Dive" };
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

// Gyms are named after real Oregon places. You beat them in order: each one opens when your
// Innvadex has `unlock` kinds of bugs AND you've beaten the gym before it. Later gyms are harder:
//   level    = how smart the leader is (see foeMove)
//   bugLevel = how strong the leader's bugs are (yours go up to Lv 10, by catching the same bug again and again)
// For the cutscenes: `place` and `story` (where you are), `intro` (the leader says hello),
// `tip` (a real-world tip the leader gives you after you win).
const GYMS = [
  { id: "forestpark", emoji: "🌲", name: "Forest Park", place: "Forest Park", badge: "Forest Park Badge", leader: "Ranger Fern", face: "👩‍🌾",
    level: 1, bugLevel: 1, unlock: 1, reward: 50,
    team: ["exomala_orientalis", "anisandrus_dispar", "pieris_rapae"],
    story: "Forest Park is one of the biggest city forests in the country, right in Portland. Invasive beetles are sneaking in!",
    intro: "Hi! I'm Ranger Fern. I've hiked every single trail in Forest Park. That's more than 80 miles!",
    tip: "When you hike, brush off your boots and gear before you leave. Seeds and bugs love to hitchhike!",
    say: { hi: "Welcome to Forest Park! Let's see if you can protect it.", next: "The forest is counting on me!", lose: "You've earned the Forest Park Badge!", win: "Come back when you're stronger!" } },
  { id: "siuslaw", emoji: "🌊", name: "Siuslaw National Forest", place: "the Siuslaw National Forest", badge: "Siuslaw Badge", leader: "Ranger Tide", face: "🏄",
    level: 2, bugLevel: 1, unlock: 2, reward: 60,
    team: ["linepithema_humile", "harmonia_axyridis", "pieris_rapae", "halyomorpha_halys"],
    story: "The Siuslaw National Forest goes all the way to the ocean, with foggy forests and giant sand dunes.",
    intro: "Hey there! I'm Ranger Tide. When I'm not surfing, I'm watching for bugs that wash in from far away.",
    tip: "Never move plants, soil, or sand from one beach or forest to another. Tiny bugs can hide in them!",
    say: { hi: "Surf's up! Let's see if you can ride this wave.", next: "Here comes another wave!", lose: "Totally awesome! You've earned the Siuslaw Badge!", win: "Wiped out! Try again, dude!" } },
  { id: "tillamook", emoji: "🌧️", name: "Tillamook State Forest", place: "the Tillamook State Forest", badge: "Tillamook Badge", leader: "Ranger Moss", face: "🧔",
    level: 2, bugLevel: 2, unlock: 3, reward: 70,
    team: ["macrodactylus_subspinosus", "solenopsis_invicta", "adelges_piceae"],
    story: "The Tillamook State Forest grew back after giant fires long ago. People planted millions of trees here by hand!",
    intro: "Name's Ranger Moss. I like rain, mud, and trees. Lots and lots of trees.",
    tip: "Look for white fuzzy spots on fir and hemlock trees. That can mean tiny sap-sucking bugs are there.",
    say: { hi: "Rain or shine, I'm ready to battle!", next: "A little rain won't stop me!", lose: "You've earned the Tillamook Badge!", win: "The rain is on my side today!" } },
  { id: "gorge", emoji: "💦", name: "Columbia River Gorge", place: "the Columbia River Gorge", badge: "Gorge Badge", leader: "Ranger Falls", face: "🚣",
    level: 2, bugLevel: 2, unlock: 3, reward: 80,
    team: ["halyomorpha_halys", "polistes_dominula", "popillia_japonica", "macrodactylus_subspinosus"],
    story: "The Columbia River Gorge has more than 90 waterfalls on the Oregon side. Bugs ride in on boats and trucks here!",
    intro: "I'm Ranger Falls! I paddle the Columbia River every day. I've seen bugs hitch rides on boats!",
    tip: "Brown marmorated stink bugs crawl into houses in fall. Sealing cracks around windows keeps them out.",
    say: { hi: "My bugs are as strong as a waterfall. Ready to get splashed?", next: "Keep paddling!", lose: "What a ride! You've earned the Gorge Badge!", win: "Swept away! Try again!" } },
  { id: "umpqua", emoji: "🎣", name: "Umpqua National Forest", place: "the Umpqua National Forest", badge: "Umpqua Badge", leader: "Ranger River", face: "🧑‍🦱",
    level: 2, bugLevel: 2, unlock: 4, reward: 85,
    team: ["halyomorpha_halys", "exomala_orientalis", "polistes_dominula", "solenopsis_invicta"],
    story: "The Umpqua National Forest has rushing rivers and tall waterfalls, like Watson Falls, one of the tallest in Oregon.",
    intro: "I'm Ranger River. I fish, I hike, and I never, ever let an invasive bug get past me.",
    tip: "Fire ants build dirt mounds. Never poke one! Take a photo from far away and tell a grown-up.",
    say: { hi: "Let's see if you can swim upstream against my team!", next: "The river keeps flowing!", lose: "Good catch! You've earned the Umpqua Badge!", win: "The current was too strong! Try again." } },
  { id: "willamette", emoji: "🍄", name: "Willamette National Forest", place: "the Willamette National Forest", badge: "Willamette Badge", leader: "Ranger Cedar", face: "👩‍🦰",
    level: 3, bugLevel: 2, unlock: 4, reward: 90,
    team: ["xyleborus_monographus", "lymantria_dispar", "coptotermes_formosanus", "popillia_japonica"],
    story: "The Willamette National Forest has some of the oldest, tallest trees in Oregon. Some are hundreds of years old!",
    intro: "I'm Ranger Cedar. Some of my trees were already old before your great-great-grandparents were born.",
    tip: "Tiny holes and sawdust on an oak tree can mean a beetle is inside. Take a photo and report it!",
    say: { hi: "These are the bugs that worry us most in the Willamette. Show me what you know!", next: "My forest won't give up!", lose: "You've earned the Willamette Badge!", win: "Train a bit more, then come back!" } },
  { id: "rogue", emoji: "🪨", name: "Rogue River-Siskiyou National Forest", place: "the Rogue River-Siskiyou National Forest", badge: "Siskiyou Badge", leader: "Ranger Flint", face: "🤠",
    level: 3, bugLevel: 2, unlock: 5, reward: 100,
    team: ["lymantria_dispar", "popillia_japonica", "polistes_dominula", "adelges_piceae"],
    story: "The Rogue River-Siskiyou National Forest has wild rivers and rare plants that grow almost nowhere else on Earth.",
    intro: "Howdy, I'm Ranger Flint. These mountains are full of rare plants, and I aim to keep 'em safe.",
    tip: "Spongy moth caterpillars are hairy. Don't touch them, because the hairs can make your skin itchy!",
    say: { hi: "Rare plants need tough protectors. Let's see how tough you are!", next: "Don't get too comfortable, partner!", lose: "Well done, partner! You've earned the Siskiyou Badge!", win: "These mountains are rough. Try again!" } },
  { id: "deschutes", emoji: "🌋", name: "Deschutes National Forest", place: "the Deschutes National Forest", badge: "Deschutes Badge", leader: "Ranger Ember", face: "👩‍🚒",
    level: 3, bugLevel: 3, unlock: 5, reward: 110,
    team: ["lymantria_dispar", "coptotermes_formosanus", "solenopsis_invicta", "adelges_piceae", "xyleborus_monographus"],
    story: "The Deschutes National Forest has huge ponderosa pines growing next to old lava flows.",
    intro: "I'm Ranger Ember. I help protect this forest from wildfires, and from bugs that weaken the trees.",
    tip: "Trees weakened by invasive bugs can burn more easily. Healthy forests are safer forests!",
    say: { hi: "My bugs are hot as lava. Think you can handle the heat?", next: "Things are heating up!", lose: "You put out my fire! You've earned the Deschutes Badge!", win: "Too hot to handle! Cool off and try again." } },
  { id: "wallowa", emoji: "🏜️", name: "Wallowa-Whitman National Forest", place: "the Wallowa-Whitman National Forest", badge: "Wallowa Badge", leader: "Ranger Canyon", face: "👨‍🦳",
    level: 3, bugLevel: 3, unlock: 6, reward: 120,
    team: ["coptotermes_formosanus", "xyleborus_monographus", "solenopsis_invicta", "lymantria_dispar", "anoplophora_glabripennis"],
    story: "The Wallowa-Whitman National Forest includes Hells Canyon, the deepest river canyon in North America!",
    intro: "I'm Ranger Canyon. I've been a ranger out here for forty years. I've seen a lot of bugs come and go.",
    tip: "Buy firewood where you burn it. Moving firewood is one of the main ways tree-killing bugs spread.",
    say: { hi: "This canyon is deep, and so is my experience. Let's battle!", next: "We're just getting started!", lose: "You've got real skill. You've earned the Wallowa Badge!", win: "Experience wins today. Come back stronger!" } },
  { id: "craterlake", emoji: "💧", name: "Crater Lake", place: "Crater Lake", badge: "Crater Lake Badge", leader: "Ranger Blue", face: "🤿",
    level: 3, bugLevel: 3, unlock: 6, reward: 130,
    team: ["anoplophora_glabripennis", "lycorma_delicatula", "popillia_japonica", "lymantria_dispar", "solenopsis_invicta"],
    story: "Crater Lake is the deepest lake in the United States. It sits inside an old volcano!",
    intro: "I'm Ranger Blue. I study the lake and the forests around it. My strategies run deep!",
    tip: "Asian longhorned beetles leave perfectly round holes in trees. If you see them, report them!",
    say: { hi: "My strategy is as deep as Crater Lake. Dive in!", next: "We're going deeper!", lose: "You've earned the Crater Lake Badge!", win: "You sank! Come back up and try again." } },
  { id: "malheur", emoji: "🍂", name: "Malheur National Forest", place: "the Malheur National Forest", badge: "Malheur Badge", leader: "Ranger Morel", face: "🧑‍🔬",
    level: 3, bugLevel: 3, unlock: 6, reward: 140,
    team: ["anoplophora_glabripennis", "lycorma_delicatula", "vespa_mandarinia", "coptotermes_formosanus", "lymantria_dispar"],
    story: "The Malheur National Forest is home to a giant honey mushroom that spreads underground. It's one of the biggest living things on Earth!",
    intro: "I'm Ranger Morel. I study fungus, and some beetles carry fungus that can hurt trees. Fascinating, and dangerous!",
    tip: "Spotted lanternflies lay mud-like egg patches on cars and outdoor stuff. Check before you travel!",
    say: { hi: "My team grows stronger, like a giant mushroom. Let's battle!", next: "My roots run deep!", lose: "Amazing! You've earned the Malheur Badge!", win: "My fungus friends win this time!" } },
  { id: "mthood", emoji: "🏔️", name: "Mount Hood National Forest", place: "Mount Hood", badge: "Mount Hood Badge", leader: "Ranger Summit", face: "🧗",
    level: 3, bugLevel: 3, unlock: 6, reward: 150,
    team: ["agrilus_planipennis", "anoplophora_glabripennis", "lycorma_delicatula", "vespa_mandarinia", "coptotermes_formosanus", "popillia_japonica"],
    story: "Mount Hood is Oregon's tallest mountain. Only the best Bug Rangers make it this far!",
    intro: "I'm Ranger Summit. I've climbed to the top of Mount Hood more times than I can count.",
    tip: "Emerald ash borers leave D-shaped holes in ash trees. Spotting them early can save a whole forest!",
    say: { hi: "You made it to the top! My Legendary bugs are the toughest in Oregon.", next: "A Legendary bug never gives up!", lose: "Amazing! You've earned the Mount Hood Badge!", win: "The mountain wins this time. Keep training!" } },
  { id: "champion", emoji: "🏆", name: "Oregon Champion", place: "the Champion's Hall", badge: "Champion Trophy", leader: "Champion Juniper", face: "🦸", champion: true,
    level: 3, bugLevel: 10, unlock: 6, reward: 250,
    // Every bug in the game, all at Level 10 (the list comes from the model, so it's read when you battle)
    get team() { return gameSpecies(); },
    story: "This is the Champion's Hall. Only Bug Rangers with every forest badge are allowed inside.",
    intro: "I'm Juniper, the Oregon Champion. I've protected every forest in this state, from the coast to the mountains.",
    tip: "A real champion never stops learning. Keep watching for invasive bugs everywhere you go!",
    say: { hi: "You beat every forest. Now face me, with every bug in Oregon at Level 10! This is the final battle!", next: "A Champion never gives up!", lose: "Incredible! You are the new Oregon Champion!", win: "Not yet! Train hard and come back, Bug Ranger." } },
];
// One badge per gym
BADGES.push(...GYMS.map(gym => ({ id: `gym-${gym.id}`, emoji: gym.emoji, name: gym.badge, desc: "Win at {gym}.", gym: gym.name, earned: g => g.gyms.includes(gym.id) })));
const gymBefore = gym => GYMS[GYMS.indexOf(gym) - 1];
const gymOpen = (g, gym) => kindsCaught(g) >= gym.unlock && (!gymBefore(gym) || g.gyms.includes(gymBefore(gym).id));
// A gym's strongest bug, for its cutscene
// The cutscene before your first battle at a gym
function gymIntroScenes(gym) {
  const bug = signatureBug(gym), f = SPECIES_FACTS[bug];
  return [
    gym.champion
      ? { scene: gym.id, ...HAZEL, text: "This is it, {name}. The Champion's Hall. Everything you've learned comes down to this." }
      : { scene: gym.id, ...HAZEL, text: "Here we are, {name}: {place}! {story}", vars: { place: t(gym.place), story: t(gym.story) } },
    { scene: gym.id, who: `art:${bug}`, name: commonName(bug), text: "Watch out for my {bug}! {harm}", vars: { bug: commonName(bug), harm: t(f.harm) } },
    { scene: gym.id, who: gym.face, name: gym.leader, text: gym.say.hi },
  ];
}
const signatureBug = gym => [...gym.team].sort((a, b) => Object.keys(RARITY).indexOf(SPECIES_FACTS[b].rarity) - Object.keys(RARITY).indexOf(SPECIES_FACTS[a].rarity))[0];

// ---------- version 3: evolution, ranks, sounds ----------

// Catch the same kind of bug 3 times and it levels up. Each level makes it stronger in battles.
// Every 3 catches of the same bug is one more level, all the way to Level 10 (as strong as the Champion's)
const CATCHES_PER_LEVEL = 3, MAX_LEVEL = 10, LEVEL_BONUS = { hp: 6, atk: 2 };
const bugLevel = n => Math.min(MAX_LEVEL, 1 + Math.floor(n / CATCHES_PER_LEVEL));

// Ranks go up with your points
const RANKS = [
  [0, "🌱", "Rookie"], [25, "👀", "Bug Spotter"], [50, "🧭", "Explorer"], [100, "🥾", "Trail Scout"],
  [150, "🎒", "Ranger"], [225, "🌳", "Tree Defender"], [300, "🦸", "Bug Hero"], [450, "🌲", "Forest Guardian"],
  [600, "🏞️", "Habitat Hero"], [800, "🏅", "Nature Champion"], [1000, "👑", "Invasive Legend"],
  [1500, "🐉", "Mythic Ranger"], [2500, "🦫", "Guardian of Oregon"],
];
const rankOf = points => RANKS.filter(r => points >= r[0]).pop();

// ---------- version 4: cutscenes, trainer card ----------

// Avatars for the trainer card. Nicknames are short and saved only on this device.
const AVATARS = ["🧢", "🦊", "🐸", "🦉", "🐢", "🦄", "🐼", "🤖"];
const NAME_MAX = 16;

// Cutscene backgrounds: a sky color and a row of emoji along the ground
const SCENES = {
  lab:        { bg: "linear-gradient(180deg, #dfe9f3 0%, #c3d3e6 100%)", decor: "🔬 📚 🧪 🗺️ 🔭" },
  forest:     { bg: "linear-gradient(180deg, #bfe3c8 0%, #6fae7e 100%)", decor: "🌲 🌳 🌲 🌲 🌳 🌲" },
  danger:     { bg: "linear-gradient(180deg, #f6d2b8 0%, #d9826b 100%)", decor: "🪵 🌳 🪲 🌲 🐛 🌳" },
  forestpark: { bg: "linear-gradient(180deg, #cfe8d4 0%, #5f9e6e 100%)", decor: "🌲 🥾 🌲 🌳 🦌 🌲" },
  tillamook:  { bg: "linear-gradient(180deg, #b9c6cf 0%, #6d8a7a 100%)", decor: "🌧️ 🌲 🌧️ 🌲 🍄 🌲" },
  willamette: { bg: "linear-gradient(180deg, #d8e6c5 0%, #557a46 100%)", decor: "🍄 🌲 🌲 🦉 🌲 🍄" },
  mthood:     { bg: "linear-gradient(180deg, #d6e4f5 0%, #8aa9c9 100%)", decor: "🏔️ 🌲 ❄️ 🌲 🏔️" },
  victory:    { bg: "linear-gradient(180deg, #fff3c4 0%, #f2c94c 100%)", decor: "✨ 🎉 🏅 🎉 ✨" },
  siuslaw:    { bg: "linear-gradient(180deg, #d5eef5 0%, #e9d8a6 100%)", decor: "🌊 🏖️ 🌲 🌊 🦀 🌲" },
  gorge:      { bg: "linear-gradient(180deg, #cde6f0 0%, #4f8a8b 100%)", decor: "💦 🌲 🛶 🌲 💦 🐟" },
  deschutes:  { bg: "linear-gradient(180deg, #f7d9b5 0%, #a0522d 100%)", decor: "🌋 🌲 🪨 🌲 🔥 🌲" },
  craterlake: { bg: "linear-gradient(180deg, #a9cdf0 0%, #1f4e8c 100%)", decor: "💧 🌲 🏝️ 🌲 💧" },
  umpqua:     { bg: "linear-gradient(180deg, #d4ecef 0%, #3f7f6e 100%)", decor: "🎣 🌲 💦 🌲 🐟 🌲" },
  rogue:      { bg: "linear-gradient(180deg, #e6e2d3 0%, #7a6a4f 100%)", decor: "🪨 🌸 🌲 🪨 🌺 🌲" },
  wallowa:    { bg: "linear-gradient(180deg, #f3dcc0 0%, #9c5a3c 100%)", decor: "🏜️ 🌲 🦅 🏜️ 🐎 🌲" },
  malheur:    { bg: "linear-gradient(180deg, #efe1c7 0%, #8b6a3e 100%)", decor: "🍂 🍄 🌲 🍄 🦌 🍂" },
  champion:   { bg: "linear-gradient(180deg, #e3d4f7 0%, #6b4bb3 100%)", decor: "🏆 🌲 🌊 🌋 🏔️ 🏆" },
};

const HAZEL = { who: "👩‍🏫", name: "Professor Hazel" };
const PIP = { who: "art:Western bumble bee", name: "Pip" };   // Professor Hazel's helper, a native western bumble bee
const INTRO = [
  { scene: "lab",    ...HAZEL, text: "Hi there! I'm Professor Hazel, and I study insects here in Oregon." },
  { scene: "lab",    ...PIP,   text: "Bzz! And I'm Pip, a western bumble bee. I'm native here. My family has lived in Oregon for a very, very long time!" },
  { scene: "danger", who: "🪲", name: "Uh oh!", text: "But some bugs came from far away. They're called invasive species. Here, they have no natural enemies to keep them in check." },
  { scene: "danger", who: "🚚", name: "How do they get here?", text: "They hitchhike! They hide in firewood, shipping crates, plants, and even on cars." },
  { scene: "lab",    ...HAZEL, text: "That's where you come in, {name}! Here's your very own Innvadex." },
  { scene: "lab",    ...HAZEL, text: "Snap photos of bugs. If one is invasive, catch it! If it isn't, leave it be." },
  { scene: "forest", ...PIP,   text: "Quick quiz, {name}! You find a bug that isn't invasive. What do you do?",
    ask: [{ text: "Leave it be", right: true }, { text: "Catch it" }],
    yes: "That's right! Native bugs help nature, so we leave them be.", no: "Not quite! We only catch invasive bugs. Native bugs help nature." },
  { scene: "forest", ...PIP,   text: "I'll be cheering for you the whole way. Let's go, {name}!" },
];
// The first visit uses a short version of the intro. The whole story is in Settings → Watch intro.
const INTRO_SHORT = [INTRO[0], INTRO[2], INTRO[5], INTRO[6], INTRO[7]];
const FIRST_CATCH = [
  { scene: "victory", ...HAZEL, text: "You caught your first invasive bug, {name}! It's in your Innvadex now." },
  { scene: "lab",     ...HAZEL, text: "Tap it in your Innvadex to read its fact card. Knowing your bugs makes you a better Bug Ranger!" },
];
const FIRST_LEGENDARY = [
  { scene: "victory", who: "👑", name: "Legendary!", text: "Whoa! You caught a Legendary bug: the {bug}!" },
  { scene: "lab",     ...HAZEL, text: "Legendary bugs do the most harm. Experts really want to know where they are, so your report is a big deal!" },
];
// What Professor Hazel says when your rank goes up
const RANK_TALK = {
  "Bug Spotter": "Bug Spotter {name}! Your eyes are getting sharp. Look closely at leaves and bark.",
  Explorer: "You're an Explorer now, {name}! Keep looking under leaves and on tree bark.",
  "Trail Scout": "Trail Scout {name}! Remember to brush off your boots after a hike. Bugs and seeds hitchhike!",
  Ranger: "Ranger {name}! Rangers know that firewood can carry hidden bugs. Buy it where you burn it!",
  "Tree Defender": "Tree Defender {name}! Look for holes and sawdust on tree trunks. Those can be signs of beetles.",
  "Bug Hero": "Bug Hero {name}! Experts can set traps because of reports like yours.",
  "Forest Guardian": "Forest Guardian {name}! The trees of Oregon thank you.",
  "Habitat Hero": "Habitat Hero {name}! Protecting habitats keeps native bugs like Pip safe.",
  "Nature Champion": "Nature Champion {name}! You know more about invasive bugs than most grown-ups.",
  "Invasive Legend": "Invasive Legend! You reached a legendary rank. I'm speechless, {name}!",
  "Mythic Ranger": "Mythic Ranger {name}! People will tell stories about your bug-catching.",
  "Guardian of Oregon": "Guardian of Oregon! Like the beaver, our state animal, you work hard to protect our land. Thank you, {name}!",
};
const FINALE = [
  { scene: "champion", who: "🦸", name: "Champion Juniper", text: "From the coast to the mountains, you proved you can protect Oregon. You are the new Oregon Champion!" },
  { scene: "victory",  ...HAZEL, text: "{name}, I'm so proud of you. You've learned so much about invasive species." },
  { scene: "lab",      ...HAZEL, text: "Keep finding them. Every real report helps experts protect nature. Thank you, Champion!" },
  { scene: "victory",  ...HAZEL, text: "Open the Badges tab to print your Forest Protector certificate!" },
  { scene: "forest",   ...PIP,   text: "See you on the next adventure, {name}! Bzz!" },
];

// Cutscenes wait in line until the pop-ups are closed, then play one after another
// (a queued function, like a Team Tangle ambush, runs in its turn too)
let sceneQueue = [], playing = false;
const queueScene = slides => sceneQueue.push(slides);
async function playQueued() {
  if (playing) return;
  playing = true;
  try { while (sceneQueue.length) { const next = sceneQueue.shift(); await (typeof next === "function" ? next() : cutscene(next)); } }
  finally { playing = false; }
}

// Queues a cutscene for each gym that just opened
function checkUnlocks(g) {
  for (const gym of GYMS) {
    if (!gymOpen(g, gym) || g.unlockSeen.includes(gym.id)) continue;
    g.unlockSeen.push(gym.id);
    if (g.gyms.includes(gym.id)) continue;   // already beaten, no need to invite you
    queueScene([gym.champion
      ? { scene: gym.id, who: gym.face, name: gym.leader, text: "So you have all {n} forest badges, {name}? I'm Juniper, the Oregon Champion. Come find me in Battles & Forests!", vars: { n: GYMS.length - 1 } }
      : { scene: gym.id, who: gym.face, name: gym.leader, text: "I'm {leader}. {gym} is open now, {name}! Come battle me when you're ready.", vars: { leader: gym.leader, gym: t(gym.name) } }]);
  }
  // Team Tangle tells you about their next scheme
  TANGLE.forEach((sc, i) => {
    const id = `tangle-${sc.id}`;
    if (!tangleOpen(g, i) || g.unlockSeen.includes(id) || g.tangle.includes(sc.id)) return;
    g.unlockSeen.push(id);
    queueScene(i === 0
      ? [{ scene: "lab", ...HAZEL, text: "Uh oh, {name}. A sneaky group called Team Tangle is spreading invasive bugs on purpose!" },
         { scene: "lab", ...HAZEL, text: "Find them in the Battle tab, and stop their scheme!" }]
      : [{ scene: "tangle", ...BRAMBLE, text: "Ha ha! Team Tangle has a new plan: {scheme}! Come stop us if you can!", vars: { scheme: t(sc.name) }, sound: "tangle" }]);
  });
}

// ---------- version 7: bug types, seasons ----------

// Bug types. Each group is strong against some others: its attacks do 1.5× damage to them,
// and 0.67× (two thirds) the other way around.
const TYPES = {
  beetle: "🪲 Beetle", ant: "🐜 Ant", wasp: "🐝 Wasp", moth: "🦋 Moth & butterfly", bug: "🦗 True bug", termite: "🪵 Termite", fly: "🪰 Fly",
};
const STRONG_AGAINST = {
  wasp: ["moth", "bug", "fly"], // wasps hunt caterpillars, flies, and other soft bugs
  ant: ["termite", "moth"],    // ants raid termite nests and carry off caterpillars
  beetle: ["ant", "wasp"],     // a hard shell stops bites and stings
  bug: ["beetle"],             // a stinky smell scares beetles away
  termite: ["bug"],            // a big colony crowds them out
  moth: ["termite"],           // flying over the termites' heads
  fly: ["beetle"],             // too quick for slow beetles to catch
};
const typeBoost = (attacker, defender) => {
  const a = SPECIES_FACTS[attacker].group, d = SPECIES_FACTS[defender].group;
  return STRONG_AGAINST[a]?.includes(d) ? 1.5 : STRONG_AGAINST[d]?.includes(a) ? 0.67 : 1;
};

// Seasonal events: some groups of bugs give double points at certain times of the year
const SEASONS = [
  { months: [2, 3, 4],  emoji: "🌸", name: "Spring Hatch",      groups: ["moth"],          text: "Caterpillars are hatching! Moths and butterflies give double points." },
  { months: [5, 6, 7],  emoji: "☀️", name: "Beetle Summer",     groups: ["beetle"],        text: "Beetles are busy in the summer heat! Beetles give double points." },
  { months: [8, 9, 10], emoji: "🍂", name: "Stink Bug Season",  groups: ["bug", "wasp"],   text: "In fall, stink bugs crawl into houses and wasps are everywhere. True bugs and wasps give double points." },
  { months: [11, 0, 1], emoji: "❄️", name: "Winter Watch",      groups: ["ant", "termite"], text: "Ants and termites move indoors to stay warm. They give double points." },
];
const season = () => SEASONS.find(se => se.months.includes(new Date().getMonth()));

// ---------- version 8: Team Tangle, Swarm Boss, Bug Buddy, weather, night, outfits, minigames ----------

// Team Tangle: a goofy villain team that spreads invasive bugs on purpose. Each scheme shows a
// real way bugs spread, and what people do to stop it. They always lose in the end, and they
// never really take your bugs.
const BRAMBLE = { who: "🦹‍♀️", name: "Bramble" }, THISTLE = { who: "🦹‍♂️", name: "Thistle" };
const SQUAWK = { who: "🐦", name: "Squawk" };   // their pet European starling, an invasive bird
const BURDOCK = { who: "🕴️", name: "Boss Burdock" };
const TANGLE_MOTTO = [
  { scene: "tangle", ...BRAMBLE, text: "Bugs in the firewood, bugs on the truck!" },
  { scene: "tangle", ...THISTLE, text: "We're Team Tangle! We'll tangle them all!" },
  { scene: "tangle", ...SQUAWK, text: "Squawk! That's right! I'm an invasive starling, too!", sound: "tangle" },
];
// When they lose, they fly away in their firewood truck
const TANGLE_BLAST_OFF = [
  { scene: "tangle", ...BRAMBLE, text: "No fair! Our perfect plan!" },
  { scene: "sky", who: "🚚", name: "Team Tangle", text: "Team Tangle is tangled up agaaain! ✨", fly: true, sound: "fly" },
];
const TANGLE_SAY = { next: "Go, bug! Spread out!", lose: "No fair! We'll be back!", win: "Ha ha! Team Tangle wins this time!" };
// The schemes, in order. Each needs the one before it, and `gyms` gym badges.
const TANGLE = [
  { id: "firewood", emoji: "🪵", name: "The Firewood Scheme", gyms: 0, level: 1, bugLevel: 1, reward: 60,
    team: ["anisandrus_dispar", "xyleborus_monographus", "agrilus_planipennis"],
    plan: [
      { scene: "forest", ...HAZEL, text: "{name}, come quick! Someone is loading a big truck with firewood near the campground." },
      "motto",
      { scene: "tangle", ...THISTLE, text: "Our plan: drive this firewood all over Oregon! The beetles hiding inside will move into every forest!" },
      { scene: "tangle", ...PIP, text: "Quick, {name}! What's the rule for firewood?",
        ask: [{ text: "Buy it where you burn it", right: true }, { text: "Take it with you on trips" }],
        yes: "Yes! Moving firewood spreads tree-killing bugs, so buy it where you burn it.", no: "Nope! That's exactly how bugs spread. Try again!" },
    ],
    lesson: "Remember: buy firewood where you burn it, and never carry it to a new place." },
  { id: "cars", emoji: "🚗", name: "The Road Trip Scheme", gyms: 2, level: 2, bugLevel: 2, reward: 80,
    team: ["halyomorpha_halys", "lymantria_dispar", "lycorma_delicatula"],
    plan: [
      { scene: "road", ...HAZEL, text: "Team Tangle is back! They're at a rest stop on the highway." },
      { scene: "road", ...BRAMBLE, text: "This time we're sticking spotted lanternfly eggs on every car and camper! The bugs will ride along to new places!" },
      { scene: "road", ...PIP, text: "Bzz… those egg patches look like dried mud. People don't even notice them!" },
      { scene: "road", ...HAZEL, text: "Before a road trip, where should you check for egg patches?",
        ask: [{ text: "On cars and camping gear", right: true }, { text: "Only inside the fridge" }],
        yes: "Exactly! Egg patches hide on cars, trailers, and camping gear.", no: "Hmm, not there. Think about what goes on the trip!" },
    ],
    lesson: "Before a trip, check cars, trailers, and camping gear for egg patches. Spongy moths lay eggs on them too!" },
  { id: "crates", emoji: "📦", name: "The Shipping Crate Scheme", gyms: 5, level: 3, bugLevel: 2, reward: 100,
    team: ["coptotermes_formosanus", "solenopsis_invicta", "popillia_japonica", "anoplophora_glabripennis"],
    plan: [
      { scene: "port", ...HAZEL, text: "{name}! Team Tangle snuck into the shipping port with a pile of wooden crates!" },
      { scene: "port", ...THISTLE, text: "We'll hide bugs in these crates and ship them across the ocean. Bugs everywhere, all over the world!" },
      { scene: "port", ...HAZEL, text: "That's how the Asian longhorned beetle got to North America: inside wooden packing crates." },
    ],
    lesson: "Wooden crates from other countries must be heated to kill hidden bugs. They get a special stamp to show it was done!" },
  { id: "boss", emoji: "🏰", name: "Tangle Tower", boss: true, gyms: 9, level: 3, bugLevel: 3, reward: 150,
    team: ["lymantria_dispar", "agrilus_planipennis", "lycorma_delicatula", "anoplophora_glabripennis", "vespa_mandarinia"],
    plan: [
      { scene: "tower", ...HAZEL, text: "This is it, {name}. Tangle Tower, Team Tangle's secret hideout." },
      { scene: "tower", ...BURDOCK, text: "So, you're the one who keeps ruining my plans. I'm Boss Burdock." },
      { scene: "tower", ...BURDOCK, text: "I'm named after the burdock plant. Its prickly burrs stick to fur and socks, so it hitchhikes everywhere. Just like me!" },
      { scene: "tower", ...PIP, text: "Bzz! You stopped every plan so far. You can do this, {name}!" },
    ],
    ending: [
      { scene: "tower", ...BURDOCK, text: "Impossible! Beaten by a Bug Ranger!" },
      { scene: "tower", ...BRAMBLE, text: "Wait, Boss… are we the bad guys?" },
      { scene: "tower", ...SQUAWK, text: "Squawk! I'd like that!" },
    ],
    lesson: "Burdock is a real plant that came from far away. Its burrs hitchhike on socks and pets, so check them after a hike!",
    say: { next: "My bugs never give up!", lose: "Impossible!", win: "Ha! Come back when you're stronger, Bug Ranger." } },
];
const AMBUSH_CHANCE = 0.3, AMBUSH_REWARD = 25;

// The weekly Swarm Boss: one giant swarm a week. The damage you do is saved until the week ends.
const BOSS_HP = 400, BOSS_ATK = 13, BOSS_REWARD = 150, BOSS_UNLOCK = 3;
const BOSS_BUGS = ["agrilus_planipennis", "anoplophora_glabripennis", "lycorma_delicatula", "vespa_mandarinia"];

// Bug Buddy: a native bug that grows as you earn points. Stages start at these points.
const BUDDIES = {
  swallowtail: { name: "Oregon swallowtail", stages: ["🥚", "🐛", "🦋", "🦋"],
    fact: "Oregon's state insect! A big yellow-and-black butterfly that lives east of the Cascade Mountains." },
  ladybug: { name: "Convergent lady beetle", stages: ["🥚", "🐛", "🐞", "🐞"],
    fact: "A native ladybug with two white lines behind its head. It eats aphids that hurt plants." },
  groundbeetle: { name: "Ground beetle", stages: ["🥚", "🐛", "🪲", "🪲"],
    fact: "A fast native beetle that hunts slugs and garden pests at night." },
  // Squawk joins you after you beat Boss Burdock. Squawk is already grown up, so it's always Super.
  squawk: { name: "Squawk", stages: ["🐦", "🐦", "🐦", "🐦"], grown: true, unlock: g => g.tangle.includes("boss"),
    fact: "Team Tangle's old starling. Now Squawk helps you protect forests instead!" },
};
// What happens after you beat Boss Burdock for the first time
const SQUAWK_JOINS = [
  { scene: "forest", ...SQUAWK, text: "Squawk! Wait, {name}! Can I come with you? I want to help protect forests now!" },
  { scene: "victory", ...SQUAWK, text: "Squawk joined you as your Bug Buddy! Squawk cheers for your bugs in battles.", sound: "badge" },
];
const BUDDY_STAGES = [[0, "Egg"], [40, "Baby"], [150, "Grown-up"], [400, "Super"]];
const BUDDY_TIPS = [
  "Look under leaves. Lots of bugs hide there!",
  "Brush off your shoes after a hike, so no seeds or bugs hitchhike.",
  "Don't move firewood. Buy it where you burn it!",
  "Real photos only! AI-made photos don't count.",
  "Some types are strong against others. Check the fact cards!",
  "Bring a grown-up when you look for bugs.",
  "Moths come out at night. Try the game after dark!",
];

// Game weather: a new one each day, the same for everyone. It makes some types stronger in battles.
const WEATHER_BOOST = 1.2;
const WEATHER = [
  { emoji: "☀️", name: "Sunny", types: ["wasp", "beetle"], text: "Wasps and beetles love warm sun. They're 20% stronger in battles." },
  { emoji: "🌧️", name: "Rainy", types: ["ant", "termite"], text: "Bugs with wings hide from the rain. Ants and termites are 20% stronger in battles." },
  { emoji: "💨", name: "Windy", types: ["moth"], text: "Moths and butterflies ride the wind! They're 20% stronger in battles." },
  { emoji: "🌫️", name: "Foggy", types: ["bug"], text: "True bugs sneak around in the fog. They're 20% stronger in battles." },
];
// Night is from 8 PM to 6 AM. Moths come out, so they give double points.
const NIGHT_START = 20, NIGHT_END = 6;

// Minigames: the first win each day gives more points
const GAME_WIN_POINTS = 30, GAME_REPLAY_POINTS = 5;
// Trap Defense: bugs walk along the path to the forest (🌳). Traps catch bugs next to them.
const TRAP_COLS = 8, TRAP_ROWS = 5;
const TRAP_PATH = [[0, 1], [1, 1], [2, 1], [3, 1], [3, 2], [3, 3], [4, 3], [5, 3], [6, 3], [6, 2], [6, 1], [7, 1]];
const TRAPS = {
  sticky: { emoji: "🟨", name: "Sticky trap", cost: 2, desc: "Catches any bug a little." },
  prism:  { emoji: "🟪", name: "Purple prism trap", cost: 3, desc: "Beetles love purple! Catches beetles a lot, other bugs a little." },
};
const TRAP_WAVES = [5, 7, 9], TRAP_MONEY = 8, TRAP_HEARTS = 3, TRAP_HP = { common: 3, rare: 6, legendary: 12 };
const TRAP_TICK = 250, TRAP_RANGE = 1.5;
// Where's the Bug?: find the hidden bug in a grid of plants. Each round is bigger.
const HIDE_ROUNDS = [[6, 4], [7, 5], [8, 6]], HIDE_SECONDS = 15, HIDE_PENALTY = 2;
const HIDE_PLANTS = ["🌿", "🍃", "🌱", "🍂", "🌾", "🌳", "🌲", "🪨", "🍄", "🌼"];
// One minigame a day, the same for everyone (see dailyGame below)
const MINIGAMES = [
  { id: "traps", emoji: "🟪", name: "Trap Defense" },
  { id: "hide",  emoji: "🔎", name: "Where's the Bug?" },
  { id: "match", emoji: "🃏", name: "Bug Match" },
  { id: "sort",  emoji: "🌼", name: "Invasive or Native?" },
  { id: "pop",   emoji: "🕳️", name: "Bug Pop" },
];
// Oregon towns, to say where you caught a bug ("near Beaverton") without a map. The spot comes
// from the photo part of the app (a rough area about 1 km wide) and stays on this device.
const PLACES_KM = 30;   // farther than this from every town: show the numbers instead
const PLACES = [
  ["Portland", 45.52, -122.68], ["Beaverton", 45.49, -122.80], ["Hillsboro", 45.52, -122.99], ["Bethany", 45.56, -122.84],
  ["Gresham", 45.50, -122.43], ["Lake Oswego", 45.42, -122.67], ["Tigard", 45.43, -122.77], ["Tualatin", 45.38, -122.76],
  ["West Linn", 45.37, -122.61], ["Oregon City", 45.36, -122.61], ["Milwaukie", 45.45, -122.64], ["Happy Valley", 45.45, -122.53],
  ["Sherwood", 45.36, -122.84], ["Wilsonville", 45.30, -122.77], ["Forest Grove", 45.52, -123.11], ["Troutdale", 45.54, -122.39],
  ["Sandy", 45.40, -122.26], ["Canby", 45.26, -122.69], ["Newberg", 45.30, -122.97], ["McMinnville", 45.21, -123.20],
  ["St. Helens", 45.86, -122.81], ["Vancouver, Washington", 45.64, -122.66], ["Salem", 44.94, -123.04], ["Keizer", 44.99, -123.03],
  ["Woodburn", 45.14, -122.86], ["Silverton", 45.01, -122.78], ["Dallas", 44.92, -123.32], ["Albany", 44.64, -123.11],
  ["Corvallis", 44.56, -123.26], ["Lebanon", 44.54, -122.91], ["Eugene", 44.05, -123.09], ["Springfield", 44.05, -123.02],
  ["Cottage Grove", 43.80, -123.06], ["Roseburg", 43.22, -123.34], ["Grants Pass", 42.44, -123.33], ["Medford", 42.33, -122.87],
  ["Ashland", 42.19, -122.71], ["Klamath Falls", 42.22, -121.78], ["Lakeview", 42.19, -120.35], ["Bend", 44.06, -121.31],
  ["Redmond", 44.27, -121.17], ["Sisters", 44.29, -121.55], ["Prineville", 44.30, -120.83], ["Madras", 44.63, -121.13],
  ["Hood River", 45.71, -121.52], ["The Dalles", 45.60, -121.18], ["Pendleton", 45.67, -118.79], ["Hermiston", 45.84, -119.29],
  ["La Grande", 45.32, -118.09], ["Enterprise", 45.43, -117.28], ["Baker City", 44.77, -117.83], ["John Day", 44.42, -118.95],
  ["Ontario", 44.03, -116.96], ["Burns", 43.59, -119.05], ["Astoria", 46.19, -123.83], ["Seaside", 45.99, -123.92],
  ["Cannon Beach", 45.89, -123.96], ["Tillamook", 45.46, -123.84], ["Lincoln City", 44.96, -124.02], ["Newport", 44.64, -124.05],
  ["Florence", 43.98, -124.10], ["Coos Bay", 43.37, -124.22], ["Brookings", 42.05, -124.28],
];
// Native bugs for "Invasive or Native?" and Bug Pop. They belong in Oregon, so we leave them be.
const NATIVE_BUGS = [
  { emoji: "🐝", name: "Western bumble bee", fact: "Pip's family! It helps flowers make seeds." },
  { emoji: "🦋", name: "Oregon swallowtail", fact: "Oregon's state insect!" },
  { emoji: "🐞", name: "Convergent lady beetle", fact: "A native ladybug that eats aphids." },
  { emoji: "🐝", name: "Blue orchard mason bee", fact: "A shiny blue native bee that helps fruit trees make fruit." },
  { emoji: "🦋", name: "Western tiger swallowtail", fact: "A big yellow butterfly with black stripes, common in Oregon towns." },
  { emoji: "🪲", name: "Ten-lined June beetle", fact: "A big native beetle with white stripes. It squeaks if you pick it up!" },
  { emoji: "🐜", name: "Pacific dampwood termite", fact: "A native termite that eats wet, rotting logs and helps the forest recycle." },
  { emoji: "🪲", name: "Ground beetle", fact: "A fast native beetle that hunts slugs at night." },
];
const MATCH_PAIRS = 6;                                  // Bug Match: 12 cards
const SORT_ROUNDS = 10, SORT_TO_WIN = 8;                // Invasive or Native?: get 8 of 10 right
const POP_SECONDS = 30, POP_TO_WIN = 15, POP_HOLES = 9, POP_NATIVE_CHANCE = 0.3, POP_PENALTY = 2;   // Bug Pop

// New badges and scenes for version 8
BADGES.push(
  { id: "tangle", emoji: "🦹", name: "Tangle Buster",   desc: "Stop all of Team Tangle's schemes.",     earned: g => g.tangle.length >= TANGLE.length },
  { id: "traps",  emoji: "🟪", name: "Trap Master",     desc: "Win Trap Defense.",                       earned: g => g.trapWins >= 1 },
  { id: "hide",   emoji: "🔎", name: "Sharp Eyes",      desc: "Win Where's the Bug?",                    earned: g => g.hideWins >= 1 },
  { id: "swarm",  emoji: "👾", name: "Swarm Stopper",   desc: "Beat a weekly Swarm Boss.",               earned: g => g.bossWins >= 1 },
  { id: "match",  emoji: "🃏", name: "Memory Master",   desc: "Win Bug Match.",                          earned: g => g.miniWins.match >= 1 },
  { id: "sort",   emoji: "🌼", name: "Sorting Star",    desc: "Win Invasive or Native?",                 earned: g => g.miniWins.sort >= 1 },
  { id: "pop",    emoji: "🕳️", name: "Pop Star",        desc: "Win Bug Pop.",                            earned: g => g.miniWins.pop >= 1 },
  { id: "games5", emoji: "🎮", name: "Minigame Champ",  desc: "Win all 5 minigames.",                    earned: g => g.trapWins >= 1 && g.hideWins >= 1 && ["match", "sort", "pop"].every(k => g.miniWins[k] >= 1) },
  { id: "buddy",  emoji: "🐾", name: "Best Buddies",    desc: "Help your Bug Buddy grow all the way to Super.", earned: g => buddyStage(g) >= BUDDY_STAGES.length - 1 },
);
CHALLENGES.push({ text: "Win any minigame.", check: ev => ev.type === "minigame" });
Object.assign(SCENES, {
  tangle: { bg: "linear-gradient(180deg, #e2d3f2 0%, #6e4a8e 100%)", decor: "🚚 🪵 🪵 📦 🪵 🚚" },
  sky:    { bg: "linear-gradient(180deg, #9fd3ff 0%, #e8f6ff 100%)", decor: "☁️ ✨ ☁️ ✨ ☁️" },
  road:   { bg: "linear-gradient(180deg, #d9e8f2 0%, #8a8f8c 100%)", decor: "🚗 🚙 🛣️ 🚐 🏕️ 🚗" },
  port:   { bg: "linear-gradient(180deg, #cfe3f2 0%, #3d6a8c 100%)", decor: "🚢 📦 📦 🏗️ 📦 🌊" },
  tower:  { bg: "linear-gradient(180deg, #4b3a63 0%, #1f1630 100%)", decor: "🏰 🪵 📦 🕸️ 📦 🏰" },
});

// ---------- version 11: monthly challenges ----------
// New challenges come every month (3 a month, starting October 2026). Old ones never go away, so you
// can finish them later. A challenge starts when you connect the bugs in its shape, and only things
// you do after that count. Each kind says what counts (ev is something that just happened).
const MONTHLY_START = [2026, 10], MONTHLY_PER_MONTH = 3;
const MONTHLY_KINDS = [
  { id: "truebugs", emoji: "🦗", name: "True Bug Hunter", n: 5, text: "Catch {n} true bugs.",
    desc: "True bugs have mouths like straws, and many have backs shaped like a shield. Stink bugs and spotted lanternflies are true bugs. Look on fruit trees, grapevines, and the walls of houses.",
    check: ev => ev.type === "catch" && SPECIES_FACTS[ev.species].group === "bug" },
  { id: "beetles", emoji: "🪲", name: "Beetle Patrol", n: 5, text: "Catch {n} beetles.",
    desc: "Beetles have hard wing covers that meet in a straight line down their backs. Look on tree bark, leaves, and flowers.",
    check: ev => ev.type === "catch" && SPECIES_FACTS[ev.species].group === "beetle" },
  { id: "natives", emoji: "🌼", name: "Native Friend", n: 5, text: "Find {n} bugs that aren't invasive.",
    desc: "Most bugs are helpers, like bees and ladybugs. Take their photo, then leave them be!",
    check: ev => ev.type === "native" },
  { id: "moths", emoji: "🦋", name: "Moth Watch", n: 3, text: "Catch {n} moths or butterflies.",
    desc: "Moths often visit porch lights at night. Their caterpillars munch on leaves, so look for chewed leaves too.",
    check: ev => ev.type === "catch" && SPECIES_FACTS[ev.species].group === "moth" },
  { id: "rare", emoji: "💎", name: "Rare Finder", n: 2, text: "Catch {n} Rare or Legendary bugs.",
    desc: "Rare and Legendary bugs do the most harm, so experts really want to know where they are.",
    check: ev => ev.type === "catch" && SPECIES_FACTS[ev.species].rarity !== "common" },
  { id: "kinds", emoji: "🔍", name: "Bug Detective", n: 3, text: "Catch {n} different kinds of bugs.", distinct: true,
    desc: "Every kind of bug is different. Look in lots of places: gardens, parks, trees, and porch lights.",
    check: ev => ev.type === "catch" },
  { id: "wasps", emoji: "🐝", name: "Sting Squad", n: 2, text: "Catch {n} invasive wasps or hornets.",
    desc: "Wasps can sting, so always take their photo from far away, and bring a grown-up. Never go near a nest!",
    check: ev => ev.type === "catch" && SPECIES_FACTS[ev.species].group === "wasp" },
  { id: "any", emoji: "📸", name: "Snap Happy", n: 8, text: "Catch {n} invasive bugs.",
    desc: "Any invasive bug counts. Every one you find is reported, so experts know where to look.",
    check: ev => ev.type === "catch" },
];
// The shapes for "connect the bugs". The 9 bugs are numbered like this:
//   0 1 2
//   3 4 5
//   6 7 8
const SHAPES = [
  { name: "L", path: [0, 3, 6, 7, 8] },
  { name: "Z", path: [0, 1, 2, 4, 6, 7, 8] },
  { name: "U", path: [0, 3, 6, 7, 8, 5, 2] },
  { name: "V", path: [0, 4, 2] },
  { name: "N", path: [6, 3, 0, 4, 8, 5, 2] },
  { name: "7", path: [0, 1, 2, 4, 6] },
  { name: "square", path: [0, 1, 2, 5, 8, 7, 6, 3, 0] },
  { name: "C", path: [2, 1, 0, 3, 6, 7, 8] },
];
const SHAPE_BUGS = ["🐞", "🦋", "🪲", "🐝", "🦗", "🐜", "🐛", "🪰", "🐌"];
const LIVE_EVERY = 1500;   // the camera guesses the species this often (milliseconds)

// ---------- limited-time badges: 5 new ones every 3 months ----------
// Each season (3 months, starting November 2026) has 5 badges. Only what you do during those 3
// months counts, like limited-time awards. New seasons keep coming by themselves.
const SEASON_BADGE_START = [2026, 11];
const SEASON_NAMES = ["Winter", "Spring", "Summer", "Fall"];   // Nov–Jan, Feb–Apr, May–Jul, Aug–Oct
const SEASON_GOALS = [
  { key: "catch",   n: 5, desc: "Catch {n} invasive bugs between {start} and {end}." },
  { key: "natives", n: 3, desc: "Find {n} bugs that aren't invasive between {start} and {end}." },
  { key: "wins",    n: 5, desc: "Win {n} battles between {start} and {end}." },
  { key: "games",   n: 3, desc: "Win {n} minigames between {start} and {end}." },
  { key: "kinds",   n: 3, desc: "Catch {n} different kinds of invasive bugs between {start} and {end}." },
];
const SEASON_BADGE_NAMES = {
  Winter: ["Snowflake Seeker", "Winter Friend", "Frosty Fighter", "Cozy Gamer", "Icy Investigator"],
  Spring: ["Blossom Bug Hunter", "Spring Helper", "Spring Battler", "Rainy Day Gamer", "Sprout Spotter"],
  Summer: ["Sunshine Seeker", "Summer Protector", "Summer Champion", "Beach Day Gamer", "Sunny Scout"],
  Fall:   ["Falling Leaf Finder", "Harvest Helper", "Autumn Ace", "Spooky Season Gamer", "Acorn Explorer"],
};
// Which 3-month season a date is in, like { id: "2026-11", index: 0, season: "Winter", start, end }
function seasonBlock(date = new Date()) {
  const months = (date.getFullYear() - SEASON_BADGE_START[0]) * 12 + date.getMonth() + 1 - SEASON_BADGE_START[1];
  if (months < 0) return null;
  const index = Math.floor(months / 3), first = new Date(SEASON_BADGE_START[0], SEASON_BADGE_START[1] - 1 + index * 3, 1);
  const end = new Date(first.getFullYear(), first.getMonth() + 3, 0);   // the last day of the third month
  const id = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}`;
  return { id, index, season: SEASON_NAMES[index % 4], start: first, end, year: first.getFullYear() };
}
// Every season's 5 badges, from November 2026 to now
function seasonBadges() {
  const list = [], now = seasonBlock();
  for (let k = 0; now && k <= now.index; k++) {
    const block = seasonBlock(new Date(SEASON_BADGE_START[0], SEASON_BADGE_START[1] - 1 + k * 3, 1));
    SEASON_GOALS.forEach((goal, j) => list.push({
      id: `s${block.id}-${goal.key}`, block, goal, limited: true, emoji: ["❄️", "🌸", "☀️", "🍂"][k % 4],
      name: SEASON_BADGE_NAMES[block.season][j], desc: goal.desc,
      earned: g => (goal.key === "kinds" ? (g.seasonCounts?.[block.id]?.kinds || []).length : g.seasonCounts?.[block.id]?.[goal.key] || 0) >= goal.n,
    }));
  }
  return list;
}
BADGES.push(...seasonBadges());
// Counts things you do toward this season's badges. Called by progress().
// Badges from seasons that are over stay open: what you do now counts toward the ones you missed,
// so you can still catch up and earn them.
function seasonProgress(g, ev) {
  const now = seasonBlock();
  if (!now) return;
  const blocks = new Map(BADGES.filter(b => b.limited).map(b => [b.block.id, b.block]));
  for (const block of blocks.values()) {
    const open = block.id === now.id || BADGES.some(b => b.limited && b.block.id === block.id && !g.badges.includes(b.id));
    if (!open) continue;
    const c = g.seasonCounts[block.id] ??= { catch: 0, natives: 0, wins: 0, games: 0, kinds: [] };
    if (ev.type === "catch") { c.catch++; if (!c.kinds.includes(ev.species)) c.kinds.push(ev.species); }
    if (ev.type === "native") c.natives++;
    if (ev.type === "win") c.wins++;
    if (ev.type === "minigame") c.games++;
  }
}
// A badge's "why you got it" words (season badges say their dates)
function badgeDesc(b) {
  if (b.monthly) return `${t(b.monthly.kind.text, { n: b.monthly.kind.n })} ${t("Made in {month}", { month: monthName(b.monthly.month) })}`;
  const day = d => d.toLocaleDateString(langTag(), { month: "long", day: "numeric", year: "numeric" });
  const words = t(b.desc, { gym: b.gym && t(b.gym), ...(b.limited ? { n: b.goal.n, start: day(b.block.start), end: day(b.block.end) } : {}) });
  return b.limited && b.block.id !== seasonBlock()?.id ? `${words} ${t("This season is over, but you can still catch up and earn it!")}` : words;
}

// ---------- saving ----------
function loadGame() {
  let g = null;
  try { g = JSON.parse(localStorage.getItem(GAME_KEY)); } catch {}
  g = { points: 0, caught: {}, badges: [], protector: 0, wins: 0, gyms: [], daily: null, dailyDone: 0,
    spots: [], muted: false, trainer: { name: "", avatar: AVATARS[0] }, unlockSeen: null,
    protectorDex: {}, bigText: false, tangle: [], trapWins: 0, hideWins: 0, bossWins: 0, boss: null,
    buddy: null, readAloud: true, games: {}, miniWins: {}, ambushDay: null, monthly: {}, monthlyView: "icons", badgeDates: {}, seasonCounts: {}, ...(g || {}) };
  // Read aloud is on for everyone (once). After that, turning it off in Settings keeps it off.
  if (!g.readAloudOnce) { g.readAloud = true; g.readAloudOnce = true; }
  // Things from older versions that the game doesn't use anymore
  for (const old of ["items", "coins", "quiz", "streak", "missions", "outfits", "useMap"]) delete g[old];
  // Gyms that were already open before gym cutscenes existed don't need one
  if (!g.unlockSeen) g.unlockSeen = GYMS.filter(gym => gymOpen(g, gym)).map(gym => gym.id);
  return g;
}
function saveGame(g) { try { localStorage.setItem(GAME_KEY, JSON.stringify(g)); } catch {} }

// The bugs in the game: the invasive ones this model knows that have a fact card
const gameSpecies = () => (window.PYINSECT_MODEL?.invasive || []).filter(s => SPECIES_FACTS[s])
  .sort((a, b) => Object.keys(RARITY).indexOf(SPECIES_FACTS[b].rarity) - Object.keys(RARITY).indexOf(SPECIES_FACTS[a].rarity) || commonName(a).localeCompare(commonName(b)));
const totalCaught = g => Object.values(g.caught).reduce((a, b) => a + b, 0);
const kindsCaught = g => Object.keys(g.caught).length;
const caughtRarity = (g, r) => Object.keys(g.caught).some(s => SPECIES_FACTS[s]?.rarity === r);
// Points count toward your rank
// Your Bug Buddy grows with the points you earn
const addPoints = (g, n) => { g.points += n; if (g.buddy) g.buddy.xp += n; };
const dayKey = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const todayKey = () => dayKey(0);
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
    lines.push(t("📅 Daily challenge done! +{pts} points", { pts: DAILY_REWARD }));
  }
  lines.push(...monthlyProgress(g, ev));
  seasonProgress(g, ev);
  const had = new Set(g.badges);
  const fresh = BADGES.filter(b => !had.has(b.id) && b.earned(g));
  g.badges.push(...fresh.map(b => b.id));
  for (const b of fresh) g.badgeDates[b.id] = new Date().toISOString();   // shown on the back of the badge
  lines.push(...fresh.map(b => `${b.emoji} ${t("New badge: {badge}", { badge: t(b.name) })}`));
  const rank = rankOf(g.points);
  if (rank[2] !== rankBefore) {
    lines.push(`${rank[1]} ${t("Rank up! Your new rank: {rank}", { rank: t(rank[2]) })}`);
    if (RANK_TALK[rank[2]]) queueScene([{ scene: "victory", ...HAZEL, text: RANK_TALK[rank[2]] }]);
  }
  g.rankSeen = rank[2];
  if (g.buddy && buddyStage(g) > g.buddy.seen) {
    g.buddy.seen = buddyStage(g);
    lines.push(`${buddyFace(g)} ${t("Your Bug Buddy grew! It's now: {stage}", { stage: t(BUDDY_STAGES[g.buddy.seen][1]) })}`);
  }
  if (lines.length) { sound("badge"); confetti(); }
  return lines;
}

// ---------- cartoon bugs ----------
// Each bug gets its own cartoon, drawn to look like the real bug (colors, spots, stripes, wings,
// long antennae...), instead of one emoji for every beetle. They're simple SVG drawings, seen from
// above with the head at the top, built from a few parts: a body shape plus its pattern.
const BUG_ART = {
  // Invasive bugs
  agrilus_planipennis:       { kind: "beetle", w: 13, l: 25, color: "#1fa64b", head: "#178a3c", shine: true },   // slim, shiny green
  anoplophora_glabripennis:  { kind: "beetle", w: 17, l: 24, color: "#1b1d22", head: "#1b1d22", spots: "#f4f4f4", antenna: "long-banded", legs: "#4a6c9e", shine: true },
  lycorma_delicatula:        { kind: "lanternfly" },
  vespa_mandarinia:          { kind: "wasp", big: true, head: "#f08c1a", thorax: "#3b2a1a", bands: ["#f2b51b", "#3b2a1a"] },
  adelges_piceae:            { kind: "woolly" },
  coptotermes_formosanus:    { kind: "termite", head: "#e0902f", body: "#f3dfaa" },
  lymantria_dispar:          { kind: "caterpillar", color: "#6b5a49", dots: ["#3b6fd6", "#3b6fd6", "#d23b3b", "#d23b3b", "#d23b3b"] },
  popillia_japonica:         { kind: "beetle", w: 17, l: 20, color: "#c8742a", pronotum: "#21a35c", head: "#21a35c", tufts: true, shine: true },
  solenopsis_invicta:        { kind: "ant", color: "#b2401f", gaster: "#5a2516" },
  xyleborus_monographus:     { kind: "beetle", w: 11, l: 16, color: "#7b4a25", head: "#5d3519", round: true },
  anisandrus_dispar:         { kind: "beetle", w: 11, l: 15, color: "#2c1f19", head: "#2c1f19", round: true },
  exomala_orientalis:        { kind: "beetle", w: 17, l: 19, color: "#c9a56a", head: "#6b4a2b", blotches: "#5b3d22" },
  halyomorpha_halys:         { kind: "shield", color: "#8a6a4c", mottle: "#5e4532", edge: "#f1e7d2" },
  harmonia_axyridis:         { kind: "ladybug", color: "#f07d1d", spots: 9, mark: true },
  linepithema_humile:        { kind: "ant", color: "#8a5a35", gaster: "#6b4428", small: true },
  macrodactylus_subspinosus: { kind: "beetle", w: 12, l: 21, color: "#cdb37a", head: "#9c8350", legs: "#e0782a", longLegs: true },
  pieris_rapae:              { kind: "moth", wing: "#fbfbf5", body: "#3a3a3a", wingSpots: "#1d1d1d", tips: "#2a2a2a" },
  polistes_dominula:         { kind: "wasp", head: "#f2c81b", thorax: "#1e1e1e", bands: ["#f2c81b", "#1e1e1e"], antenna: "#e0782a" },
  ips_typographus:           { kind: "beetle", w: 12, l: 18, color: "#5b3a22", head: "#3f2716", round: true, hairy: true },
  lymantria_monacha:         { kind: "moth", wing: "#f4f1ea", body: "#2a2a2a", zigzag: "#1f1f1f" },
  cydalima_perspectalis:     { kind: "moth", wing: "#fbfbf8", body: "#6b4a2b", border: "#7a4f28" },
  operophtera_brumata:       { kind: "moth", wing: "#b49a76", body: "#7b6347", lines: "#8d7655", small: true },
  scolytus_multistriatus:    { kind: "beetle", w: 10, l: 15, color: "#8f3b1f", head: "#6b2a15", round: true, shine: true },
  drosophila_melanogaster_suzukii: { kind: "fly", color: "#c8a36a", eyes: "#d22a2a", wingSpot: true },
  // Native bugs (for the minigames, Bug Buddy, and Pip)
  "Western bumble bee":        { kind: "bee", bands: ["#f2c51b", "#1e1e1e", "#1e1e1e", "#f4f1e6"] },
  "Oregon swallowtail":        { kind: "moth", wing: "#f6d23b", body: "#1e1e1e", stripes: "#1e1e1e", tails: true },
  "Convergent lady beetle":    { kind: "ladybug", color: "#d8321f", spots: 12, lines: true },
  "Blue orchard mason bee":    { kind: "bee", bands: ["#2b4f8f", "#2b4f8f", "#1f3a6e"], small: true },
  "Western tiger swallowtail": { kind: "moth", wing: "#f8de3a", body: "#1e1e1e", stripes: "#1e1e1e", tails: true },
  "Ten-lined June beetle":     { kind: "beetle", w: 18, l: 24, color: "#6b4a2b", head: "#4d331c", stripes: "#f6f2e6" },
  "Pacific dampwood termite":  { kind: "termite", head: "#8f3b1f", body: "#c98a5a", big: true },
  "Ground beetle":             { kind: "beetle", w: 15, l: 23, color: "#1c1c22", head: "#1c1c22", shine: true, grooves: true },
  // Bug Buddy stages: an egg, then a baby bug (larva) that looks like the real one
  egg:                              { kind: "egg" },
  "Oregon swallowtail caterpillar": { kind: "caterpillar", color: "#7cc243", headColor: "#5f9e2f", smooth: true, band: "#1e1e1e", dots: ["#f08c1a", "#f08c1a", "#f08c1a", "#f08c1a", "#f08c1a", "#f08c1a"] },
  "Convergent lady beetle larva":   { kind: "caterpillar", color: "#2b2b33", headColor: "#1b1b20", dots: [null, "#f07d1d", null, "#f07d1d", null, null], spiky: true },
  "Ground beetle larva":            { kind: "caterpillar", color: "#6b5236", headColor: "#3a2a1a", smooth: true, dots: [], band: "#4a3826" },
  Squawk:                           { kind: "bird" },   // Team Tangle's old starling
};
const svgArt = {};   // drawings are made once, then reused

// Cute cartoon eyes: white with a dark pupil and a shine
const eyes = (x, y, r, gap, iris = "#1b1b1b") => [-1, 1].map(s =>
  `<circle cx="${x + s * gap}" cy="${y}" r="${r}" fill="#fff" stroke="#1b1b1b" stroke-width="1"/><circle cx="${x + s * gap + s * .3}" cy="${y + .6}" r="${r * .55}" fill="${iris}"/><circle cx="${x + s * gap + s * .3 - .8}" cy="${y - .4}" r="${r * .2}" fill="#fff"/>`).join("");
// Six legs, three on each side
const legs = (ys, reach, color, width = 2.2) => ys.map((y, i) => [-1, 1].map(s =>
  `<path d="M${s * 4} ${y} q ${s * reach * .55} ${-3 + i * 3} ${s * reach} ${-6 + i * 8}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round"/>`).join("")).join("");
// Two antennae from the head (banded = black and white stripes, like the Asian longhorned beetle)
function antennae(y, len, color, banded) {
  return [-1, 1].map(s => {
    const d = `M${s * 3} ${y} q ${s * len * .35} ${-len * .55} ${s * len * .6} ${-len}`;
    return `<path d="${d}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      (banded ? `<path d="${d}" stroke="#f4f4f4" stroke-width="2.2" fill="none" stroke-dasharray="3 3"/>` : "");
  }).join("");
}

function drawBug(a, id) {
  const k = a.kind;
  if (k === "beetle" || k === "ladybug") {
    const w = k === "ladybug" ? 21 : a.w, l = k === "ladybug" ? 20 : a.l, cy = 10;
    const head = a.head || "#222", pro = a.pronotum || (k === "ladybug" ? "#f6f1e6" : head);
    let s = legs([cy - 6, cy + 2, cy + 10], a.longLegs ? 22 : 15, a.legs || "#2b2b2b", a.longLegs ? 2.6 : 2.2);
    s += antennae(cy - l - 10, a.antenna === "long-banded" ? 44 : 12, a.antenna === "long-banded" ? "#1b1d22" : head, a.antenna === "long-banded");
    s += `<ellipse cx="0" cy="${cy}" rx="${w}" ry="${l}" fill="${a.color}" stroke="#1b1b1b" stroke-width="1.5"/>`;
    if (k !== "ladybug") s += `<line x1="0" y1="${cy - l + 3}" x2="0" y2="${cy + l - 1}" stroke="#1b1b1b" stroke-width="1" opacity=".55"/>`;
    if (a.grooves) for (const x of [-9, -5, 5, 9]) s += `<line x1="${x}" y1="${cy - l + 6}" x2="${x * .8}" y2="${cy + l - 5}" stroke="#55555f" stroke-width=".8"/>`;
    if (a.stripes) for (const x of [-11, -6, 6, 11]) s += `<path d="M${x} ${cy - l + 6} q ${x * .1} ${l} ${x * .5} ${l * 1.75}" stroke="${a.stripes}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    if (a.spots && typeof a.spots === "string") for (const [x, y, r] of [[-8, 0, 2.6], [7, -4, 2.2], [-5, 14, 2.4], [9, 10, 2.8], [-10, 22, 2], [4, 24, 2.3], [0, 4, 1.8]]) s += `<circle cx="${x}" cy="${cy + y - 6}" r="${r}" fill="${a.spots}"/>`;
    if (k === "ladybug") {
      const spots = [[-9, 2], [9, 2], [-12, 13], [12, 13], [-5, 20], [5, 20], [-6, 8], [6, 8], [0, 26], [-13, 22], [13, 22], [0, 14]].slice(0, a.spots);
      for (const [x, y] of spots) s += `<circle cx="${x}" cy="${cy + y - 8}" r="2.6" fill="#1b1b1b"/>`;
      s += `<line x1="0" y1="${cy - l + 2}" x2="0" y2="${cy + l}" stroke="#1b1b1b" stroke-width="1.2"/>`;
    }
    if (a.blotches) for (const [x, y, rx] of [[-8, -2, 4], [8, 4, 3.5], [-6, 12, 3], [7, 16, 4], [0, 22, 3]]) s += `<ellipse cx="${x}" cy="${cy + y - 6}" rx="${rx}" ry="${rx * .7}" fill="${a.blotches}" opacity=".85"/>`;
    if (a.tufts) for (const y of [0, 7, 14, 21]) for (const x of [-1, 1]) s += `<circle cx="${x * (w - 1)}" cy="${cy + y - 8}" r="2" fill="#fff"/>`;
    if (a.hairy) for (let i = 0; i < 14; i++) s += `<line x1="${(i % 7 - 3) * 3}" y1="${cy - l + 4 + Math.floor(i / 7) * l}" x2="${(i % 7 - 3) * 3.4}" y2="${cy - l + 1 + Math.floor(i / 7) * l}" stroke="#c9a77a" stroke-width=".8"/>`;
    if (a.shine) s += `<ellipse cx="${-w * .4}" cy="${cy - l * .35}" rx="${w * .22}" ry="${l * .32}" fill="#fff" opacity=".35"/>`;
    s += `<ellipse cx="0" cy="${cy - l - 2}" rx="${w * .78}" ry="7" fill="${pro}" stroke="#1b1b1b" stroke-width="1.4"/>`;
    if (a.mark) s += `<path d="M-5 ${cy - l - 1} l2 -4 l3 3 l3 -3 l2 4" stroke="#1b1b1b" stroke-width="1.6" fill="none" stroke-linejoin="round"/>`;
    if (a.lines) s += `<path d="M-6 ${cy - l + 1} l3 -4 M6 ${cy - l + 1} l-3 -4" stroke="#fff" stroke-width="1.6"/>`;
    s += `<circle cx="0" cy="${cy - l - 10}" r="6.5" fill="${head}" stroke="#1b1b1b" stroke-width="1.4"/>` + eyes(0, cy - l - 11, 2.4, 3.2);
    return s;
  }
  if (k === "shield") {   // stink bugs: a shield shape with banded antennae and a speckled back
    let s = legs([-2, 8, 18], 16, "#5a4232") + antennae(-26, 14, "#5a4232", true);
    s += `<path d="M0 -24 L22 -10 L20 6 L0 34 L-20 6 L-22 -10 Z" fill="${a.color}" stroke="#1b1b1b" stroke-width="1.5" stroke-linejoin="round"/>`;
    s += `<path d="M-10 -4 L10 -4 L0 18 Z" fill="${a.mottle}" opacity=".6"/>`;
    for (const [x, y] of [[-12, -8], [12, -6], [-8, 10], [9, 12], [-3, 2], [4, -12], [-14, 2], [14, 3], [0, 24]]) s += `<circle cx="${x}" cy="${y}" r="1.4" fill="${a.mottle}"/>`;
    for (const y of [-6, 2]) for (const x of [-1, 1]) s += `<rect x="${x * 21 - 1.5}" y="${y}" width="3" height="3" fill="${a.edge}"/>`;
    s += `<circle cx="0" cy="-26" r="5.5" fill="${a.mottle}" stroke="#1b1b1b" stroke-width="1.4"/>` + eyes(0, -27, 2.1, 2.8);
    return s;
  }
  if (k === "lanternfly") {   // gray front wings with black spots, and red back wings peeking out
    let s = legs([2, 8, 14], 12, "#2a2a2a") + antennae(-24, 8, "#2a2a2a");
    s += `<path d="M0 -10 Q -30 10 -24 36 Q -10 30 0 22 Q 10 30 24 36 Q 30 10 0 -10 Z" fill="#d6372b" stroke="#1b1b1b" stroke-width="1.2"/>`;
    s += `<path d="M0 -16 Q -26 4 -16 34 Q -6 26 0 18 Q 6 26 16 34 Q 26 4 0 -16 Z" fill="#c9c1b4" stroke="#1b1b1b" stroke-width="1.4"/>`;
    for (const [x, y] of [[-8, -2], [8, -2], [-12, 8], [12, 8], [-6, 12], [6, 12], [-10, 20], [10, 20], [-3, 4], [3, 4]]) s += `<circle cx="${x}" cy="${y}" r="1.9" fill="#1b1b1b"/>`;
    s += `<path d="M-14 26 l5 6 l4 -5 l4 5 l3 -5 l4 5 l4 -6" stroke="#1b1b1b" stroke-width="1" fill="none" opacity=".6"/>`;
    s += `<circle cx="0" cy="-20" r="6" fill="#2a2a2a" stroke="#1b1b1b" stroke-width="1.2"/>` + eyes(0, -21, 2.3, 3, "#c22");
    return s;
  }
  if (k === "wasp" || k === "bee") {
    const big = a.big ? 1.2 : a.small ? .85 : 1;
    let s = `<g transform="scale(${big})">`;
    s += `<ellipse cx="-13" cy="-4" rx="12" ry="6" transform="rotate(-25 -13 -4)" fill="#dceefb" opacity=".75" stroke="#7a8a99" stroke-width=".8"/>`;
    s += `<ellipse cx="13" cy="-4" rx="12" ry="6" transform="rotate(25 13 -4)" fill="#dceefb" opacity=".75" stroke="#7a8a99" stroke-width=".8"/>`;
    s += legs([-4, 2, 8], 13, "#2a2a2a", 1.8) + antennae(-20, 12, a.antenna || "#1e1e1e");
    const bands = a.bands, bee = k === "bee";
    const ab = bee ? `<ellipse cx="0" cy="12" rx="13" ry="15"/>` : `<ellipse cx="0" cy="14" rx="9" ry="17"/>`;
    s += `<clipPath id="bug-${id}">${ab}</clipPath><g clip-path="url(#bug-${id})">`;
    bands.forEach((c, i) => { s += `<rect x="-16" y="${-4 + i * (34 / bands.length)}" width="32" height="${34 / bands.length + .5}" fill="${c}"/>`; });
    s += `</g>` + ab.replace("/>", ` fill="none" stroke="#1b1b1b" stroke-width="1.4"/>`);
    if (bee) s += `<ellipse cx="0" cy="12" rx="13" ry="15" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="1 2" opacity=".6"/>`;
    s += `<ellipse cx="0" cy="-8" rx="${bee ? 11 : 8}" ry="7" fill="${a.thorax || bands[0]}" stroke="#1b1b1b" stroke-width="1.4"/>`;
    s += `<circle cx="0" cy="-19" r="${a.big ? 8 : 6.5}" fill="${a.head || "#1e1e1e"}" stroke="#1b1b1b" stroke-width="1.4"/>` + eyes(0, -20, 2.4, 3.3);
    return s + "</g>";
  }
  if (k === "ant") {
    const sc = a.small ? .85 : 1;
    let s = `<g transform="scale(${sc})">` + legs([-6, -1, 4], 14, a.color, 1.8);
    s += [-1, 1].map(x => `<path d="M${x * 3} -20 l${x * 6} -8 l${x * 6} -2" stroke="${a.color}" stroke-width="2" fill="none" stroke-linecap="round"/>`).join("");
    s += `<ellipse cx="0" cy="20" rx="10" ry="13" fill="${a.gaster}" stroke="#1b1b1b" stroke-width="1.4"/>`;
    s += `<circle cx="0" cy="5" r="2.8" fill="${a.color}" stroke="#1b1b1b" stroke-width="1"/>`;
    s += `<ellipse cx="0" cy="-4" rx="5" ry="7" fill="${a.color}" stroke="#1b1b1b" stroke-width="1.4"/>`;
    s += `<circle cx="0" cy="-17" r="7" fill="${a.color}" stroke="#1b1b1b" stroke-width="1.4"/>` + eyes(0, -18, 2.3, 3);
    return s + "</g>";
  }
  if (k === "termite") {
    const sc = a.big ? 1.1 : 1;
    let s = `<g transform="scale(${sc})">` + legs([-8, -3, 2], 13, "#b88a5a", 1.8) + antennae(-24, 10, a.head);
    s += `<ellipse cx="0" cy="14" rx="10" ry="18" fill="${a.body}" stroke="#1b1b1b" stroke-width="1.4"/>`;
    for (let y = 2; y < 30; y += 5) s += `<line x1="-8" y1="${y}" x2="8" y2="${y}" stroke="#b88a5a" stroke-width=".8"/>`;
    s += `<ellipse cx="0" cy="-6" rx="6" ry="5" fill="${a.body}" stroke="#1b1b1b" stroke-width="1.2"/>`;
    s += `<ellipse cx="0" cy="-17" rx="8" ry="8" fill="${a.head}" stroke="#1b1b1b" stroke-width="1.4"/>` + eyes(0, -18, 2.2, 3);
    return s + "</g>";
  }
  if (k === "moth") {   // moths and butterflies, wings open
    const sc = a.small ? .85 : 1;
    let s = `<g transform="scale(${sc})">`;
    const wing = (side, front) => {
      const x = side, d = front ? `M0 -8 Q ${x * 30} -34 ${x * 40} -10 Q ${x * 34} 8 0 4 Z` : `M0 2 Q ${x * 34} 6 ${x * 26} 26 Q ${x * 10} 32 0 12 Z`;
      return d;
    };
    for (const side of [-1, 1]) for (const front of [false, true]) {
      s += `<path d="${wing(side, front)}" fill="${a.wing}" stroke="${a.border || "#1b1b1b"}" stroke-width="${a.border ? 3 : 1.3}" stroke-linejoin="round"/>`;
      if (a.border) s += `<path d="${wing(side, front)}" fill="none" stroke="#1b1b1b" stroke-width=".8"/>`;
    }
    if (a.tails) for (const x of [-1, 1]) s += `<path d="M${x * 18} 26 l${x * 3} 10" stroke="${a.wing}" stroke-width="3.5" stroke-linecap="round"/><path d="M${x * 18} 26 l${x * 3} 10" stroke="#1b1b1b" stroke-width="1" fill="none"/>`;
    if (a.stripes) for (const x of [-1, 1]) for (const t of [10, 18, 27]) s += `<path d="M${x * 4} -6 L${x * t} ${-20 + t * .25}" stroke="${a.stripes}" stroke-width="2.4"/>`;
    if (a.wingSpots) for (const x of [-1, 1]) { s += `<circle cx="${x * 22}" cy="-10" r="2.8" fill="${a.wingSpots}"/><circle cx="${x * 16}" cy="14" r="2.2" fill="${a.wingSpots}"/>`; }
    if (a.tips) for (const x of [-1, 1]) s += `<path d="M${x * 30} -24 Q ${x * 40} -18 ${x * 40} -10 Q ${x * 34} -16 ${x * 30} -24 Z" fill="${a.tips}"/>`;
    if (a.zigzag) for (const x of [-1, 1]) for (const y of [-14, -4, 12]) s += `<path d="M${x * 6} ${y} l${x * 5} -4 l${x * 5} 4 l${x * 5} -4 l${x * 5} 4 l${x * 5} -4" stroke="${a.zigzag}" stroke-width="1.6" fill="none"/>`;
    if (a.lines) for (const x of [-1, 1]) for (const y of [-12, -2]) s += `<path d="M${x * 6} ${y} q ${x * 14} -6 ${x * 28} 2" stroke="${a.lines}" stroke-width="1.2" fill="none"/>`;
    s += antennae(-18, 12, a.body);
    s += `<ellipse cx="0" cy="6" rx="4.5" ry="20" fill="${a.body}" stroke="#1b1b1b" stroke-width="1.2"/>`;
    s += `<circle cx="0" cy="-16" r="5.5" fill="${a.body}" stroke="#1b1b1b" stroke-width="1.2"/>` + eyes(0, -17, 2, 2.6);
    return s + "</g>";
  }
  if (k === "caterpillar") {   // a hairy caterpillar with pairs of colored dots
    let s = "";
    const segs = 7;
    for (let i = segs - 1; i >= 0; i--) {
      const y = 30 - i * 9, x = Math.sin(i * .9) * 5;
      if (!a.smooth) for (let h = -3; h <= 3; h++) s += `<line x1="${x + h * 2}" y1="${y - 6}" x2="${x + h * 3.2}" y2="${y - (a.spiky ? 11 : 13)}" stroke="${a.spiky ? "#1b1b20" : "#a89884"}" stroke-width="${a.spiky ? 1.6 : 1}"/>`;
      s += `<circle cx="${x}" cy="${y}" r="8" fill="${a.color}" stroke="#1b1b1b" stroke-width="1.2"/>`;
      if (a.band) s += `<path d="M${x - 7} ${y - 3} q 7 -3 14 0" stroke="${a.band}" stroke-width="2.4" fill="none"/>`;
      if (i > 0 && a.dots[i - 1]) for (const d of [-1, 1]) s += `<circle cx="${x + d * 3.5}" cy="${y - 1}" r="2" fill="${a.dots[i - 1]}"/>`;
    }
    const hx = Math.sin(6 * .9) * 5;
    s += `<circle cx="${hx}" cy="-28" r="8.5" fill="${a.headColor || "#3b2e24"}" stroke="#1b1b1b" stroke-width="1.2"/>` + eyes(hx, -29, 2.4, 3.2);
    return s;
  }
  if (k === "fly") {   // a little fruit fly with big red eyes and spots on its wings
    let s = legs([0, 5, 10], 12, "#4a3a2a", 1.6);
    for (const x of [-1, 1]) {
      s += `<ellipse cx="${x * 13}" cy="6" rx="14" ry="6" transform="rotate(${x * 30} ${x * 13} 6)" fill="#e8f2fa" opacity=".85" stroke="#7a8a99" stroke-width=".8"/>`;
      if (a.wingSpot) s += `<circle cx="${x * 23}" cy="12" r="2.6" fill="#2a2a2a"/>`;
    }
    s += `<ellipse cx="0" cy="12" rx="8" ry="12" fill="${a.color}" stroke="#1b1b1b" stroke-width="1.3"/>`;
    for (const y of [10, 15, 20]) s += `<line x1="-6" y1="${y}" x2="6" y2="${y}" stroke="#5a4532" stroke-width="1.4"/>`;
    s += `<ellipse cx="0" cy="-4" rx="7" ry="6" fill="${a.color}" stroke="#1b1b1b" stroke-width="1.3"/>`;
    s += `<circle cx="0" cy="-14" r="6.5" fill="${a.color}" stroke="#1b1b1b" stroke-width="1.3"/>`;
    for (const x of [-1, 1]) s += `<circle cx="${x * 4.5}" cy="-15" r="4" fill="${a.eyes}" stroke="#1b1b1b" stroke-width="1"/><circle cx="${x * 4.5 - .8}" cy="-16" r="1.1" fill="#fff"/>`;
    return s;
  }
  if (k === "egg") {   // a sleepy egg, before the buddy hatches
    let s = `<ellipse cx="0" cy="4" rx="22" ry="29" fill="#fbf3dc" stroke="#1b1b1b" stroke-width="1.6"/>`;
    for (const [x, y, r] of [[-8, -12, 3], [9, -4, 2.4], [-4, 14, 2.8], [10, 16, 2], [-12, 4, 1.8]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#e8c98a"/>`;
    s += `<ellipse cx="-9" cy="-12" rx="5" ry="9" fill="#fff" opacity=".6"/>`;
    s += [-1, 1].map(x => `<path d="M${x * 7 - 3} 6 q 3 3 6 0" stroke="#1b1b1b" stroke-width="1.6" fill="none" stroke-linecap="round"/>`).join("");
    return s + `<path d="M-3 13 q 3 2 6 0" stroke="#1b1b1b" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  }
  if (k === "bird") {   // Squawk: a European starling, dark and shiny with white speckles
    let s = `<path d="M-6 30 l-6 12 l6 -3 l6 3 l-6 -12 Z" fill="#2b2a3f" stroke="#1b1b1b" stroke-width="1.2"/>`;
    s += [-1, 1].map(x => `<path d="M${x * 4} 30 l${x * 2} 9 m${-x * 3} 0 l${x * 6} 0" stroke="#e0782a" stroke-width="2" stroke-linecap="round"/>`).join("");
    s += `<ellipse cx="0" cy="10" rx="20" ry="24" fill="#2b2a3f" stroke="#1b1b1b" stroke-width="1.6"/>`;
    s += [-1, 1].map(x => `<path d="M${x * 16} 0 q ${x * 14} 12 ${x * 4} 28 q ${-x * 8} -10 ${-x * 4} -26 Z" fill="#3c3a5c" stroke="#1b1b1b" stroke-width="1.2"/>`).join("");
    s += `<ellipse cx="-6" cy="4" rx="7" ry="12" fill="#5b4f8f" opacity=".35"/><ellipse cx="6" cy="16" rx="6" ry="9" fill="#3f8f6a" opacity=".3"/>`;
    for (const [x, y] of [[-8, 14], [6, 6], [-3, 22], [9, 20], [0, 10], [-11, 4], [4, 28]]) s += `<path d="M${x} ${y} l1.5 -2 l1.5 2 l-1.5 2 Z" fill="#fff"/>`;
    s += `<circle cx="0" cy="-16" r="13" fill="#2b2a3f" stroke="#1b1b1b" stroke-width="1.6"/>` + eyes(0, -18, 3.2, 5);
    return s + `<path d="M-4 -10 L4 -10 L0 0 Z" fill="#f2c81b" stroke="#1b1b1b" stroke-width="1.2" stroke-linejoin="round"/>`;
  }
  if (k === "woolly") {   // a tiny bug hiding under a fluffy white coat
    let s = "";
    for (const [x, y, r] of [[-12, 4, 11], [12, 4, 11], [0, -6, 13], [0, 14, 12], [-16, -8, 8], [16, -8, 8], [-8, 22, 8], [8, 22, 8]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fbfbfb" stroke="#a9a9a9" stroke-width="1.4"/>`;
    s += `<ellipse cx="0" cy="-18" rx="8" ry="6" fill="#3a2e28" stroke="#1b1b1b" stroke-width="1.2"/>` + eyes(0, -19, 2.2, 3);
    return s;
  }
  return "";
}

// The cartoon for a bug (a species name, or a native bug's English name), as an element.
// Bugs without a cartoon get their emoji instead.
function bugArt(key, cls = "") {
  const a = BUG_ART[key], span = el("span", `bug-art ${cls}`.trim());
  span.setAttribute("aria-hidden", "true");
  if (!a) { span.textContent = SPECIES_FACTS[key]?.emoji || "🐞"; span.classList.add("emoji"); return span; }
  span.innerHTML = svgArt[key] ??= `<svg viewBox="-50 -50 100 100" xmlns="http://www.w3.org/2000/svg">${drawBug(a, key.replace(/\W/g, ""))}</svg>`;
  return span;
}

// ---------- building blocks ----------
function rarityTag(species) {
  const r = SPECIES_FACTS[species].rarity;
  return el("span", `rarity ${r}`, t(RARITY[r].label));
}

function factCard(species, caughtCount) {
  const f = SPECIES_FACTS[species];
  const card = el("article", "factcard");
  const head = el("div", "factcard-head");
  head.append(bugArt(species, "bug-emoji"), el("div", null));
  head.lastChild.append(el("strong", null, commonName(species)), el("span", "sci", sciName(species)));
  const tags = el("div", "tags");
  const strong = STRONG_AGAINST[f.group].map(ty => t(TYPES[ty])).join(", ");
  tags.append(rarityTag(species), el("span", "pts", t(TYPES[f.group])), el("span", "pts", t("{pts} points", { pts: RARITY[f.rarity].points })));
  tags.title = t("Strong against: {types}", { types: strong });
  if (caughtCount) tags.append(el("span", "pts", t("Caught ×{n} · Lv {lv}", { n: caughtCount, lv: bugLevel(caughtCount) })));
  const facts = el("dl", "facts");
  for (const [k, v] of [["What it is", t(f.fact)], ["Why it's a problem", t(f.harm)], ["If you see one", t(f.todo)],
    ["Battle type", t("{type}. Strong against: {types}.", { type: t(TYPES[f.group]), types: strong })]])
    facts.append(el("dt", null, t(k)), el("dd", null, v));
  card.append(head, tags, facts);
  return card;
}

// ---------- the Innvadex panel ----------
let justCaught = null;   // the bug you just caught gets a little "pop" animation
function renderGame() {
  const g = loadGame(), all = gameSpecies();
  setLanguage(g.lang);
  $("gamePoints").textContent = t("{pts} points", { pts: g.points });
  const rank = rankOf(g.points), next = RANKS[RANKS.indexOf(rank) + 1];
  $("gameRank").textContent = `${rank[1]} ${t(rank[2])}${next ? ` · ${t("{n} to {rank}", { n: next[0] - g.points, rank: t(next[2]) })}` : ""}`;
  $("trainerBtn").textContent = `${trainerLook(g)} ${g.trainer.name || t("Make your trainer card")}`;
  $("gameProgress").textContent = t("{n} of {total} caught", { n: kindsCaught(g), total: all.length });
  $("gameProtector").textContent = `🛡️ ${t("{n} protector", { n: g.protector })}`;
  const doneToday = g.daily === todayKey();
  $("dailyText").textContent = t(todaysChallenge().text);
  $("dailyState").textContent = doneToday ? t("✅ Done! Come back tomorrow.") : t("+{pts} points", { pts: DAILY_REWARD });
  $("daily").classList.toggle("done", doneToday);
  const se = season();
  $("seasonText").textContent = `${se.emoji} ${t(se.name)}: ${t(se.text)}`;
  renderProtectorDex(g);
  applyBigText(g);
  renderWorld(g);
  renderBuddy(g);
  renderDailyGame(g);
  renderHome(g);
  renderCertificate(g);

  const dex = $("dexGrid"); dex.innerHTML = "";
  // Caught bugs first, then a small ❓ for each one still to find
  for (const s of [...all.filter(sp => g.caught[sp]), ...all.filter(sp => !g.caught[sp])]) {
    const n = g.caught[s] || 0;
    const slot = el("button", "dex-slot" + (n ? " caught" : "") + (s === justCaught ? " pop" : ""));
    slot.type = "button";
    if (n) {
      slot.append(bugArt(s, "bug-emoji"), el("strong", null, commonName(s)), rarityTag(s),
        el("span", "count", t("Lv {lv} · ×{n}", { lv: bugLevel(n), n })));
      slot.onclick = () => showFact(s, n, g.spots.filter(sp => sp.species === s));
    } else {
      slot.classList.add("empty-slot");
      slot.append(el("span", "bug-emoji", "❓"));
      slot.setAttribute("aria-label", t("Not caught yet"));
      slot.disabled = true;
    }
    dex.append(slot);
  }

  const badges = $("badgeList"); badges.innerHTML = "";
  renderSeasonBadges(g);
  renderMonthlyBadges(g);
  for (const b of BADGES.filter(x => !x.limited)) {
    const has = g.badges.includes(b.id);
    const item = el("button", "medal-item" + (has ? " earned" : ""));
    item.type = "button";
    item.setAttribute("aria-label", `${t(b.name)}: ${has ? t("Badge earned") : t("Badge not earned yet")}`);
    item.append(medalFace(b, has), el("strong", null, t(b.name)));
    item.onclick = () => showMedal(b);
    badges.append(item);
  }

  $("learnSub").textContent = t("Fact cards for all {n} invasive bugs", { n: all.length });
  $("learnIntro").textContent = t("What each invasive bug looks like, why it's a problem, and what to do if you see one.");
  const learn = $("learnList"); learn.innerHTML = "";
  for (const s of all) learn.append(factCard(s, g.caught[s] || 0));

  renderBattles(g);
}

// The Battle tab: practice trainers, then the forest gyms
function renderBattles(g) {
  const list = $("battleList"); list.innerHTML = "";
  const kinds = kindsCaught(g);
  if (!kinds) list.append(el("p", "empty", t("Catch your first invasive bug to start battling. Your caught bugs are your battle team!")));
  const row = (foe, gym) => {
    const item = el("div", "foe" + (gym && g.gyms.includes(foe.id) ? " beaten" : ""));
    const who = el("div", "foe-who");
    const level = foe.champion ? `👑 ${t("Champion")}` : `${"⭐".repeat(foe.level)} ${t(["Easy", "Medium", "Hard"][foe.level - 1])}`;
    const bugs = `${t(foe.team.length === 1 ? "{n} bug" : "{n} bugs", { n: foe.team.length })}${foe.bugLevel > 1 ? ` (${t("Lv {lv}", { lv: foe.bugLevel })})` : ""}`;
    who.append(el("strong", null, gym ? t(foe.name) : foe.name), el("span", "muted", `${gym ? `${t("Leader: {leader}", { leader: foe.leader })} · ` : ""}${bugs} · ${level}`));
    const needKinds = kinds < foe.unlock, needGym = gym && !needKinds && !gymOpen(g, foe);
    const locked = needKinds || needGym;
    const b = el("button", "btn" + (locked ? "" : " primary"),
      needKinds ? `🔒 ${t(foe.unlock === 1 ? "Catch {n} kind" : "Catch {n} kinds", { n: foe.unlock })}` : needGym ? `🔒 ${t("Beat {leader} first", { leader: gymBefore(foe).leader })}`
        : gym && g.gyms.includes(foe.id) ? `✅ ${t("Battle again")}` : t("Battle!"));
    b.type = "button"; b.disabled = locked;
    b.onclick = () => gym && !g.gyms.includes(foe.id)
      ? cutscene(gymIntroScenes(foe)).then(() => battle(foe, gym))
      : battle(foe, gym);
    item.append(el("span", "bug-emoji", foe.emoji), who, b);
    list.append(item);
  };
  // Quick battles: a friend online, or a bot (assets/game-online.js)
  if (typeof onlineBattleRows === "function") onlineBattleRows(list, g);
  list.append(el("h3", null, t("Trainers")));
  TRAINERS.forEach(tr => row(tr, false));
  list.append(el("h3", null, t("Forests (beat them in order)")));
  GYMS.forEach(gym => row(gym, true));

  // Team Tangle's schemes, in order
  const simpleRow = (emoji, name, about, label, locked, beaten, onClick) => {
    const item = el("div", "foe" + (beaten ? " beaten" : ""));
    const who = el("div", "foe-who");
    who.append(el("strong", null, name), el("span", "muted", about));
    const b = el("button", "btn" + (locked ? "" : " primary"), label);
    b.type = "button"; b.disabled = locked; b.onclick = onClick;
    item.append(typeof emoji === "string" ? el("span", "bug-emoji", emoji) : emoji, who, b);
    list.append(item);
  };
  list.append(el("h3", null, `🦹 ${t("Team Tangle's schemes")}`));
  TANGLE.forEach((sc, i) => {
    const done = g.tangle.includes(sc.id), open = tangleOpen(g, i);
    const label = done ? `✅ ${t("Battle again")}` : open ? t("Stop them!")
      : kinds < 2 ? `🔒 ${t("Catch {n} kinds", { n: 2 })}` : i && !g.tangle.includes(TANGLE[i - 1].id) ? `🔒 ${t("Stop the last scheme first")}`
      : `🔒 ${t("Get {n} forest badges first", { n: sc.gyms })}`;
    const about = `${sc.boss ? BURDOCK.name : "Bramble & Thistle"} · ${t("{n} bugs", { n: sc.team.length })}${sc.bugLevel > 1 ? ` (${t("Lv {lv}", { lv: sc.bugLevel })})` : ""}`;
    simpleRow(sc.emoji, t(sc.name), about, label, !open && !done, done,
      () => done ? battle(tangleFoe(sc), false) : cutscene(tanglePlan(sc)).then(() => battle(tangleFoe(sc), false)));
  });

  // The weekly Swarm Boss
  list.append(el("h3", null, `👾 ${t("Weekly Swarm Boss")}`));
  const sw = swarm({ ...g });
  simpleRow(bugArt(sw.species, "bug-emoji"), t("Mega Swarm: {bug}", { bug: commonName(sw.species) }),
    sw.beaten ? t("Beaten this week! A new swarm comes on Monday.") : t("{hp} of {max} HP left. Your damage is saved all week!", { hp: sw.hp, max: BOSS_HP }),
    sw.beaten ? `✅ ${t("Beaten")}` : kinds < BOSS_UNLOCK ? `🔒 ${t("Catch {n} kinds", { n: BOSS_UNLOCK })}` : t("Battle!"),
    sw.beaten || kinds < BOSS_UNLOCK, sw.beaten, () => battle(swarmFoe(loadGame()), false));
}

// ---------- pop-up windows ----------
function openPopup(content, buttons) {
  const pop = $("gamePopup"), box = $("gamePopupBox");
  box.innerHTML = "";
  box.append(...content);
  const bar = el("div", "actions");
  for (const [text, primary, onClick] of buttons) {
    const b = el("button", "btn" + (primary ? " primary" : ""), t(text));
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

// A caught bug's fact card, with where and when you caught it
function showFact(species, n, spots = []) {
  const where = el("div", "caught-where");
  if (spots.length) {
    where.append(el("strong", null, `📍 ${t("Where you caught it")}`));
    const list = el("ul");
    for (const sp of spots.slice(-5).reverse()) list.append(el("li", null, placeText(sp)));
    where.append(list);
  } else where.append(el("p", "muted", `📍 ${t("Catch it again with location on to see where you found it.")}`));
  openPopup([factCard(species, n), where], [["Close", true]]);
}

// How to play: a short cutscene with Professor Hazel and Pip
const HOW_TO_PLAY = [
  { scene: "lab",     ...HAZEL, text: "Here's how to play, {name}!" },
  { scene: "lab",     ...HAZEL, text: "Tap the camera at the top of the Game screen, and point it at a bug. Its name shows at the top." },
  { scene: "forest",  ...PIP,   text: "Let's practice! Tap the beetle 3 times to catch it.", tap: "popillia_japonica", got: "Gotcha! That's how you catch a bug in the game." },
  { scene: "forest",  ...PIP,   text: "If it isn't invasive, leave it be. You still get protector points!" },
  { scene: "lab",     ...HAZEL, text: "Do the daily challenge and today's minigame for bonus points." },
  { scene: "victory", ...HAZEL, text: "Start a monthly challenge by connecting the bugs in the shape shown. Finish it to give its badge color!" },
  { scene: "forest",  ...PIP,   text: "Catch the same bug again and again to level it up. Every 3 catches is one more level, all the way to Level 10!" },
  { scene: "mthood",  ...HAZEL, text: "Battle trainers and the {n} forests with the bugs you caught, then face the Oregon Champion!", vars: { n: GYMS.length - 1 } },
  { scene: "danger",  ...PIP,   text: "Don't touch bugs with bare hands. Some sting or bite." },
  { scene: "forest",  ...PIP,   text: "I'll be cheering for you the whole way. Let's go, {name}!" },
];
const showInstructions = () => cutscene(HOW_TO_PLAY);

// ---------- badge shapes and cartoons ----------
// Every badge has its own shape (no two are the same) and its own cartoon. They're drawn as SVG.
// After the list runs out, new badges get new shapes made from a pattern, so no two ever match
const badgeShape = i => i < BADGE_SHAPES.length ? BADGE_SHAPES[i]
  : [{ kind: "star", n: 13 + Math.floor((i - BADGE_SHAPES.length) / 3), inner: .86 }, { kind: "flower", n: 13 + Math.floor((i - BADGE_SHAPES.length) / 3) },
    { kind: "gear", n: 13 + Math.floor((i - BADGE_SHAPES.length) / 3) }][(i - BADGE_SHAPES.length) % 3];
const BADGE_SHAPES = [
  { kind: "circle" }, { kind: "poly", n: 6 }, { kind: "shield" }, { kind: "poly", n: 8 }, { kind: "star", n: 5, inner: .62 },
  { kind: "flower", n: 8 }, { kind: "heart" }, { kind: "poly", n: 4, rot: 0 }, { kind: "star", n: 6, inner: .7 }, { kind: "flower", n: 6 },
  { kind: "poly", n: 5 }, { kind: "poly", n: 7 }, { kind: "gear", n: 10 }, { kind: "star", n: 8, inner: .75 }, { kind: "flower", n: 10 },
  { kind: "poly", n: 3 }, { kind: "star", n: 4, inner: .55 }, { kind: "flower", n: 12 }, { kind: "star", n: 7, inner: .68 }, { kind: "poly", n: 9 },
  { kind: "poly", n: 12 }, { kind: "star", n: 10, inner: .8 }, { kind: "squircle" }, { kind: "leaf" }, { kind: "flower", n: 5 },
  { kind: "star", n: 12, inner: .84 }, { kind: "oval" }, { kind: "gear", n: 8 }, { kind: "cross" }, { kind: "flower", n: 7 },
  { kind: "star", n: 9, inner: .78 }, { kind: "poly", n: 10 }, { kind: "gear", n: 12 }, { kind: "flower", n: 9 }, { kind: "star", n: 6, inner: .55 },
  { kind: "poly", n: 11 }, { kind: "gear", n: 6 }, { kind: "flower", n: 4 },
];
// The outline of a shape, as an SVG path, about 46 wide from the middle
function shapePath(sh, r = 46) {
  const pts = [], P = (a, rr) => [Math.sin(a) * rr, -Math.cos(a) * rr];
  if (sh.kind === "circle") for (let i = 0; i < 48; i++) pts.push(P(i / 48 * Math.PI * 2, r));
  if (sh.kind === "oval") for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; pts.push([Math.sin(a) * r * .8, -Math.cos(a) * r]); }
  if (sh.kind === "poly") for (let i = 0; i < sh.n; i++) pts.push(P((i + (sh.rot ?? .5)) / sh.n * Math.PI * 2 + (sh.n % 2 ? Math.PI / sh.n : 0) - (sh.rot === 0 ? 0 : Math.PI / sh.n), r));
  if (sh.kind === "star") for (let i = 0; i < sh.n * 2; i++) pts.push(P(i / (sh.n * 2) * Math.PI * 2, i % 2 ? r * sh.inner : r));
  if (sh.kind === "flower") for (let i = 0; i < 96; i++) { const a = i / 96 * Math.PI * 2; pts.push(P(a, r * (.84 + .16 * Math.abs(Math.cos(a * sh.n / 2))))); }
  if (sh.kind === "gear") for (let i = 0; i < sh.n * 4; i++) pts.push(P((i + .5) / (sh.n * 4) * Math.PI * 2, i % 4 < 2 ? r : r * .82));
  if (sh.kind === "squircle") for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); pts.push([Math.sign(s) * Math.abs(s) ** .45 * r * .92, -Math.sign(c) * Math.abs(c) ** .45 * r * .92]); }
  if (sh.kind === "seal") for (let i = 0; i < 160; i++) { const a = i / 160 * Math.PI * 2; pts.push(P(a, r * (.93 + .07 * Math.cos(a * sh.n)))); }
  if (sh.kind === "shield") return `M0 ${-r} L${r * .9} ${-r * .72} L${r * .82} ${r * .2} Q${r * .5} ${r * .78} 0 ${r} Q${-r * .5} ${r * .78} ${-r * .82} ${r * .2} L${-r * .9} ${-r * .72} Z`;
  if (sh.kind === "heart") return `M0 ${r * .95} C${-r * 1.3} ${r * .1} ${-r * .9} ${-r * 1.05} 0 ${-r * .45} C${r * .9} ${-r * 1.05} ${r * 1.3} ${r * .1} 0 ${r * .95} Z`;
  if (sh.kind === "leaf") return `M0 ${-r} C${r * .95} ${-r * .55} ${r * .95} ${r * .55} 0 ${r} C${-r * .95} ${r * .55} ${-r * .95} ${-r * .55} 0 ${-r} Z`;
  if (sh.kind === "cross") { const a = r * .38; return `M${-a} ${-r} H${a} V${-a} H${r} V${a} H${a} V${r} H${-a} V${a} H${-r} V${-a} H${-a} Z`; }
  return "M" + pts.map(p => p.map(v => v.toFixed(1)).join(" ")).join(" L") + " Z";
}

// Little drawing pieces for the badge cartoons
const ink = 'stroke="#1b1b1b" stroke-width="1.5" stroke-linejoin="round"';
const bugG = (key, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${drawBug(BUG_ART[key], `b${key.replace(/\W/g, "")}${x}${y}`.replace(/[-.]/g, "m"))}</g>`;
const starAt = (x, y, r, c = "#ffd23f") => `<path d="${shapePath({ kind: "star", n: 5, inner: .45 }, r)}" transform="translate(${x} ${y})" fill="${c}" ${ink}/>`;
const pine = (x, y, s, c = "#2f8a4c") => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2" y="4" width="4" height="7" fill="#7a4a24"/><path d="M0 -16 L10 0 L5 0 L12 8 L-12 8 L-5 0 L-10 0 Z" fill="${c}" ${ink}/></g>`;
const ground = (c = "#7cc06a") => `<path d="M-40 18 Q0 8 40 18 L40 40 L-40 40 Z" fill="${c}" ${ink}/>`;
const sky = c => `<rect x="-40" y="-40" width="80" height="80" fill="${c}"/>`;
const landscape = parts => parts;   // (the medal's shape clips the picture)

// The cartoon for each badge (gym badges get a little picture of their forest)
const BADGE_ART = {
  first: () => ORB_SVG.replace("<svg ", '<svg x="-34" y="-34" width="68" height="68" ').replace(/orbGlass/g, "ORBg").replace(/orbShade/g, "ORBs"),
  five: () => `<g ${ink}><path d="M-14 26 Q-20 6 -16 -2 L-12 -2 L-10 8 L-9 -22 Q-5 -26 -2 -22 L-1 4 L1 -28 Q5 -31 8 -27 L8 4 L11 -22 Q15 -25 17 -21 L16 8 L20 -8 Q24 -10 25 -6 L20 18 Q14 30 -14 26 Z" fill="#f6c99c"/></g>${starAt(-26, -22, 7)}${starAt(28, -26, 6)}`,
  kinds3: () => bugG("popillia_japonica", -6, 6, .55) + `<circle cx="10" cy="-6" r="16" fill="#bfe6ff" fill-opacity=".45" stroke="#3b3b3b" stroke-width="4"/><line x1="21" y1="5" x2="34" y2="20" stroke="#7a4a24" stroke-width="7" stroke-linecap="round"/>`,
  rare: () => `<g ${ink}><path d="M-22 -10 L-12 -24 L12 -24 L22 -10 L0 26 Z" fill="#5fd3f3"/><path d="M-22 -10 L22 -10 M-12 -24 L-6 -10 L0 26 L6 -10 L12 -24" fill="none"/></g><path d="M-14 -20 L-8 -12" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  legendary: () => bugG("agrilus_planipennis", 0, 14, .55) + `<path d="M-20 -14 L-14 -32 L-6 -20 L0 -36 L6 -20 L14 -32 L20 -14 Z" fill="#ffd23f" ${ink}/>`,
  points100: () => `<text x="0" y="12" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="32" fill="#fff" stroke="#1b1b1b" stroke-width="1.5">100</text>${starAt(-24, -20, 8)}${starAt(0, -26, 8)}${starAt(24, -20, 8)}`,
  half: () => `<g ${ink}><path d="M-26 -18 L0 -12 L26 -18 L26 22 L0 28 L-26 22 Z" fill="#fffaf0"/><path d="M0 -12 L0 28" fill="none"/><path d="M-26 -18 L0 -12 L0 28 L-26 22 Z" fill="#7cc06a"/></g>${bugG("harmonia_axyridis", -13, 6, .3)}`,
  all: () => `<g ${ink}><path d="M-18 -24 H18 V-6 Q18 12 0 14 Q-18 12 -18 -6 Z" fill="#ffd23f"/><path d="M-18 -18 Q-30 -18 -26 -6 Q-22 2 -16 0 M18 -18 Q30 -18 26 -6 Q22 2 16 0" fill="none" stroke-width="3"/><rect x="-5" y="14" width="10" height="8" fill="#e0a800"/><rect x="-14" y="22" width="28" height="8" rx="2" fill="#8a5a32"/></g>${starAt(0, -9, 7, "#fff")}`,
  protector: () => `<path d="${shapePath({ kind: "shield" }, 28)}" fill="#5aa9e6" ${ink}/><path d="M0 -14 C14 -8 12 10 0 16 C-12 10 -14 -8 0 -14 Z M0 -14 L0 16" fill="#7cc06a" ${ink}/>`,
  trainer: () => `<g ${ink}><path d="M-24 -24 L14 14 L10 18 L-28 -20 Z" fill="#d9dee5"/><path d="M24 -24 L-14 14 L-10 18 L28 -20 Z" fill="#d9dee5"/><rect x="4" y="12" width="14" height="5" transform="rotate(45 11 14)" fill="#8a5a32"/><rect x="-18" y="12" width="14" height="5" transform="rotate(-45 -11 14)" fill="#8a5a32"/></g>`,
  daily: () => `<g ${ink}><rect x="-24" y="-20" width="48" height="44" rx="5" fill="#fff"/><path d="M-24 -20 h48 v12 h-48 Z" fill="#e84a4a"/><line x1="-12" y1="-26" x2="-12" y2="-14" stroke-width="3"/><line x1="12" y1="-26" x2="12" y2="-14" stroke-width="3"/></g><path d="M-10 6 L-3 13 L12 -2" stroke="#2f8a4c" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  natives10: () => `<g ${ink}>${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-14" rx="8" ry="13" fill="#ffffff" transform="rotate(${a})"/>`).join("")}<circle r="8" fill="#ffd23f"/></g>${bugG("Western bumble bee", 18, -18, .35)}`,
  tangle: () => `<g ${ink}><rect x="-26" y="-6" width="34" height="20" rx="2" fill="#8e5bd0"/><rect x="8" y="0" width="16" height="14" rx="2" fill="#6b3fa8"/><circle cx="-16" cy="16" r="5" fill="#333"/><circle cx="14" cy="16" r="5" fill="#333"/>${[-20, -12, -4].map(x => `<rect x="${x}" y="-14" width="7" height="8" rx="2" fill="#a0683a"/>`).join("")}</g><path d="M-30 -24 L30 24" stroke="#e84a4a" stroke-width="6" stroke-linecap="round"/><circle r="30" fill="none" stroke="#e84a4a" stroke-width="6"/>`,
  traps: () => `<g ${ink}><path d="M-14 -26 L14 -26 L18 26 L-18 26 Z" fill="#8e5bd0"/><path d="M0 -26 L0 26" stroke="#6b3fa8" stroke-width="3"/></g>${bugG("agrilus_planipennis", 0, 2, .4)}`,
  hide: () => `<g ${ink}><path d="M-30 0 Q0 -28 30 0 Q0 28 -30 0 Z" fill="#fff"/><circle r="11" fill="#5aa9e6"/><circle r="5" fill="#1b1b1b"/></g><circle cx="-4" cy="-4" r="3" fill="#fff"/>`,
  swarm: () => [[-16, -14, .3], [14, -18, .26], [0, 4, .34], [-18, 16, .24], [18, 14, .28]].map(([x, y, s]) => bugG("vespa_mandarinia", x, y, s)).join(""),
  buddy: () => bugG("Oregon swallowtail", 0, 4, .62) + `<path d="M0 -20 C-8 -30 -20 -22 -12 -12 L0 -2 L12 -12 C20 -22 8 -30 0 -20 Z" transform="translate(20 -8) scale(.55)" fill="#e84a4a" ${ink}/>`,
  match: () => `<g ${ink}><rect x="-26" y="-22" width="26" height="36" rx="4" fill="#8e5bd0" transform="rotate(-12)"/><rect x="0" y="-20" width="26" height="36" rx="4" fill="#fff" transform="rotate(10)"/></g>${bugG("harmonia_axyridis", 12, -1, .36)}`,
  sort: () => `<g ${ink}><rect x="-30" y="-14" width="26" height="30" rx="5" fill="#ffd6d6"/><rect x="4" y="-14" width="26" height="30" rx="5" fill="#d8f5d8"/></g>${bugG("halyomorpha_halys", -17, 2, .3)}${bugG("Convergent lady beetle", 17, 2, .3)}`,
  pop: () => `<ellipse cx="0" cy="20" rx="26" ry="9" fill="#3b2a1a" ${ink}/>${bugG("popillia_japonica", 0, -2, .5)}<path d="M-30 -24 l6 6 M30 -24 l-6 6 M0 -38 v8" stroke="#ffd23f" stroke-width="4" stroke-linecap="round"/>`,
  games5: () => `<g ${ink}><path d="M-30 -6 Q-30 -16 -20 -16 H20 Q30 -16 30 -6 L32 12 Q32 22 22 20 L14 10 H-14 L-22 20 Q-32 22 -32 12 Z" fill="#5aa9e6"/><rect x="-21" y="-6" width="12" height="4" fill="#1b1b1b"/><rect x="-17" y="-10" width="4" height="12" fill="#1b1b1b"/><circle cx="14" cy="-6" r="3" fill="#e84a4a"/><circle cx="20" cy="0" r="3" fill="#ffd23f"/></g>`,
};
// A little picture of each forest for its badge
const GYM_ART = {
  forestpark: () => landscape(sky("#bfe6ff") + ground() + pine(-18, 4, 1.2) + pine(0, -2, 1.5) + pine(18, 4, 1.2)),
  siuslaw: () => landscape(sky("#bfe6ff") + `<path d="M-40 6 Q-20 -6 0 6 T40 6 L40 40 L-40 40 Z" fill="#f2dc9a" ${ink}/><path d="M-40 16 q10 -6 20 0 t20 0 t20 0 t20 0 L40 40 L-40 40 Z" fill="#4aa3e0" ${ink}/>` + pine(26, -4, .9)),
  tillamook: () => landscape(sky("#c9d6de") + ground("#5f9e6e") + pine(-16, 4, 1.3) + pine(14, 4, 1.3) + `<path d="M-20 -24 a10 10 0 0 1 18 -6 a9 9 0 0 1 16 6 z" fill="#fff" ${ink}/>` + [-14, -4, 6].map(x => `<line x1="${x}" y1="-18" x2="${x - 3}" y2="-10" stroke="#4aa3e0" stroke-width="2.5" stroke-linecap="round"/>`).join("")),
  gorge: () => landscape(sky("#bfe6ff") + `<path d="M-40 -10 L-12 -10 L-12 40 L-40 40 Z M40 -10 L12 -10 L12 40 L40 40 Z" fill="#7a6a4f" ${ink}/><rect x="-12" y="-10" width="24" height="50" fill="#7fd0f5"/><path d="M-8 -10 v40 M0 -10 v40 M8 -10 v40" stroke="#fff" stroke-width="2" opacity=".8"/>` + pine(-26, -18, .8) + pine(26, -18, .8)),
  umpqua: () => landscape(sky("#bfe6ff") + ground() + `<path d="M-40 26 Q-10 10 10 22 T40 18 L40 40 L-40 40 Z" fill="#4aa3e0" ${ink}/>` + `<path d="M-4 26 q6 -6 12 0 q-6 6 -12 0 l-4 -3 v6 z" fill="#f08c1a" ${ink}/>` + pine(-20, 2, 1) + pine(20, 0, 1)),
  willamette: () => landscape(sky("#d8f0d8") + ground("#5f9e6e") + pine(-22, 0, 1.5) + pine(22, 0, 1.5) + `<path d="M-10 18 q0 -16 10 -16 q10 0 10 16 z" fill="#e84a4a" ${ink}/><rect x="-3" y="18" width="6" height="10" fill="#f6efe0" ${ink}/><circle cx="-4" cy="10" r="2" fill="#fff"/><circle cx="4" cy="8" r="2" fill="#fff"/>`),
  rogue: () => landscape(sky("#bfe6ff") + ground("#a3c46a") + `<path d="M-30 18 L-18 -4 L-6 18 Z M2 18 L14 -12 L28 18 Z" fill="#9a8c7a" ${ink}/>` + [-20, 0, 22].map(x => `<circle cx="${x}" cy="26" r="4" fill="#ff7eb6" ${ink}/>`).join("")),
  deschutes: () => landscape(sky("#ffd9b5") + `<path d="M-34 30 L-8 -14 L8 -14 L34 30 Z" fill="#7a5a4a" ${ink}/><path d="M-8 -14 Q0 -22 8 -14 L4 -4 L-4 -4 Z" fill="#f05a28" ${ink}/><path d="M-4 -22 q-4 -8 2 -14 M4 -22 q6 -8 0 -14" stroke="#888" stroke-width="3" fill="none"/>` + pine(-26, 22, .8) + pine(26, 22, .8)),
  wallowa: () => landscape(sky("#ffe7c2") + `<path d="M-40 -6 L-10 -6 L-4 40 L-40 40 Z M40 -6 L10 -6 L4 40 L40 40 Z" fill="#c2643c" ${ink}/><path d="M-6 40 Q0 20 6 40 Z" fill="#4aa3e0"/>` + `<path d="M-20 -24 q4 -4 8 0 q4 -4 8 0" stroke="#1b1b1b" stroke-width="2" fill="none"/>`),
  craterlake: () => landscape(sky("#bfe6ff") + `<path d="M-40 4 L-24 -10 L24 -10 L40 4 L40 40 L-40 40 Z" fill="#8c7a6a" ${ink}/><ellipse cx="0" cy="10" rx="28" ry="12" fill="#1f5fae" ${ink}/><ellipse cx="8" cy="8" rx="5" ry="3" fill="#6a8a5a" ${ink}/>`),
  malheur: () => landscape(sky("#f5e6c8") + ground("#c9a55a") + `<path d="M-22 14 q0 -14 9 -14 q9 0 9 14 z" fill="#c98a3a" ${ink}/><rect x="-16" y="14" width="6" height="10" fill="#f6efe0" ${ink}/><path d="M4 18 q0 -20 12 -20 q12 0 12 20 z" fill="#a0683a" ${ink}/><rect x="13" y="18" width="7" height="12" fill="#f6efe0" ${ink}/>`),
  mthood: () => landscape(sky("#bfe6ff") + `<path d="M-38 30 L0 -26 L38 30 Z" fill="#7a8aa0" ${ink}/><path d="M-12 -8 L0 -26 L12 -8 L6 -4 L0 -10 L-6 -4 Z" fill="#fff" ${ink}/>` + pine(-24, 24, .9) + pine(24, 24, .9)),
  champion: () => BADGE_ART.all() + `<path d="M-14 -30 L-10 -40 L-4 -32 L0 -42 L4 -32 L10 -40 L14 -30 Z" fill="#ffd23f" ${ink}/>`,
};

// A season badge's cartoon: the season (snowflake, flower, sun, or leaf), what the goal is, and the year
function seasonArt(b) {
  const season = {
    Winter: `<rect x="-40" y="-40" width="80" height="80" fill="#cfe9ff"/>` + [0, 60, 120].map(a => `<g transform="rotate(${a})"><line x1="0" y1="-30" x2="0" y2="30" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M-6 -24 L0 -18 L6 -24 M-6 24 L0 18 L6 24" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/></g>`).join(""),
    Spring: `<rect x="-40" y="-40" width="80" height="80" fill="#e7f8de"/>` + [0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-17" rx="10" ry="15" fill="#ffc2dd" transform="rotate(${a})"/>`).join("") + `<circle r="8" fill="#ffd23f"/>`,
    Summer: `<rect x="-40" y="-40" width="80" height="80" fill="#fff1c2"/>` + [...Array(12)].map((_, k) => `<line x1="0" y1="-20" x2="0" y2="-34" stroke="#ffb020" stroke-width="5" stroke-linecap="round" transform="rotate(${k * 30})"/>`).join("") + `<circle r="18" fill="#ffd23f"/>`,
    Fall: `<rect x="-40" y="-40" width="80" height="80" fill="#ffe2c7"/><path d="M0 -32 L8 -14 L26 -18 L16 -2 L30 8 L10 10 L4 30 L0 18 L-4 30 L-10 10 L-30 8 L-16 -2 L-26 -18 L-8 -14 Z" fill="#f07d1d" opacity=".75"/>`,
  }[b.block.season];
  const goal = {
    catch: bugG("popillia_japonica", 0, -2, .45), natives: bugG("Western bumble bee", 0, -2, .45), kinds: BADGE_ART.kinds3().replace(/scale\(\.55\)/, "scale(.4)"),
    wins: `<g transform="scale(.7)">${BADGE_ART.trainer()}</g>`, games: `<g transform="scale(.7)">${BADGE_ART.games5()}</g>`,
  }[b.goal.key];
  const year = `<rect x="-22" y="22" width="44" height="14" rx="4" fill="#2f6b45" stroke="#1b1b1b" stroke-width="1.2"/><text x="0" y="33" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="11" fill="#fff">${b.block.year}</text>`;
  return season + goal + year;
}

// The whole medal: its shape filled with shiny metal, a rim, and the cartoon inside
let medalCount = 0;
function medalSVG(b, has, i) {
  const sh = b.shape || badgeShape(i), id = `m${++medalCount}`, { colors } = medalStyle(b);
  const d = shapePath(sh), inner = shapePath(sh, 36);
  const art = has ? (b.art || (b.limited ? () => seasonArt(b) : null) || b.gym ? GYM_ART[b.id.slice(4)] : BADGE_ART[b.id])?.() || `<text y="12" text-anchor="middle" font-size="34">${b.emoji}</text>` : `<text y="12" text-anchor="middle" font-size="30">🔒</text>`;
  return `<svg viewBox="-50 -50 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><radialGradient id="${id}g" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${colors[0]}"/><stop offset=".8" stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[1]}" stop-opacity=".9"/></radialGradient>
    <clipPath id="${id}c"><path d="${inner}"/></clipPath></defs>
    <path d="${d}" fill="url(#${id}g)" stroke="#1b1b1b" stroke-width="2"/>
    <path d="${d}" fill="none" stroke="${colors[1]}" stroke-width="6" transform="scale(.9)" opacity=".9"/>
    <path d="${inner}" fill="#fff" fill-opacity=".25"/>
    <g clip-path="url(#${id}c)" transform="scale(.82)">${art.replace(/url\(#CLIP\)/g, `url(#${id}c)`).replace(/id="b/g, `id="${id}b`).replace(/url\(#b/g, `url(#${id}b`).replace(/ORB([gs])/g, `${id}orb$1`)}</g>
  </svg>`;
}

// ---------- badges as medals (like Apple Watch awards) ----------
// Each badge is a shiny medal with its own colors. Tap one to see why you got it, and drag it to
// spin it around: the back is engraved with the date and time you earned it.
const MEDAL_COLORS = [["#ffe17a", "#d39b12"], ["#f3f5f8", "#9aa3ad"], ["#f6b48a", "#b8652e"], ["#8ee3a8", "#2f8f55"],
  ["#9fd0ff", "#2f6fb3"], ["#d6b5ff", "#7a4bc2"], ["#ff9e9e", "#c2403a"], ["#9ff0e6", "#25a08f"]];
const medalStyle = b => ({ colors: MEDAL_COLORS[(b.colorIndex ?? BADGES.indexOf(b)) % MEDAL_COLORS.length] });
// The front of a medal (small, for the badge list)
function medalFace(b, has) {
  const m = el("span", `medal${has ? "" : " locked"}`);
  m.innerHTML = medalSVG(b, has, BADGES.indexOf(b));
  return m;
}
// The big medal in its own pop-up. Drag it (or use the arrow keys or the button) to spin it.
function showMedal(b) {
  const g = loadGame(), has = b.isEarned ? b.isEarned(g) : g.badges.includes(b.id), when = b.when ? b.when(g) : g.badgeDates[b.id];
  const { colors } = medalStyle(b), calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sh = b.shape || badgeShape(BADGES.indexOf(b)), outline = shapePath(sh);
  const stage = el("div", "medal3d"), spin = el("div", `medal-spin${has ? "" : " locked"}`);
  stage.tabIndex = 0;
  stage.setAttribute("role", "img");
  stage.setAttribute("aria-label", `${t(b.name)}. ${t("Drag to spin the badge.")}`);
  spin.style.setProperty("--m1", colors[0]); spin.style.setProperty("--m2", colors[1]);
  // A medal is a stack of thin layers, so it looks thick when it turns
  for (let k = 0; k < 10; k++) {
    const layer = el("span", "medal-edge"); layer.style.transform = `translateZ(${k - 5}px)`;
    layer.innerHTML = `<svg viewBox="-50 -50 100 100"><path d="${outline}" fill="${colors[1]}" stroke="#1b1b1b" stroke-width="1"/></svg>`;
    spin.append(layer);
  }
  const front = el("span", "medal-side medal-front"), back = el("span", "medal-side medal-back");
  front.innerHTML = medalSVG(b, has, BADGES.indexOf(b));
  const backArt = el("span", "medal-back-art");
  backArt.innerHTML = `<svg viewBox="-50 -50 100 100"><defs><radialGradient id="mbg" cx="65%" cy="30%" r="80%"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></radialGradient></defs>
    <path d="${outline}" fill="url(#mbg)" stroke="#1b1b1b" stroke-width="2"/><path d="${outline}" fill="none" stroke="${colors[1]}" stroke-width="6" transform="scale(.9)"/></svg>`;
  back.append(backArt);
  const date = when ? new Date(when) : null;
  back.append(el("span", "medal-engrave", has ? t("Earned by {name}", { name: g.trainer.name || t("Ranger") }) : t("Badge not earned yet")),
    el("strong", "medal-date", !has ? "🔒" : date ? date.toLocaleDateString(langTag(), { year: "numeric", month: "long", day: "numeric" }) : t("Earned before the game saved dates")),
    el("span", "medal-engrave", has && date ? date.toLocaleTimeString(langTag(), { hour: "numeric", minute: "2-digit" }) : ""));
  spin.append(front, back);
  stage.append(spin);
  // Spinning: drag to turn it, it keeps going a little after you let go, then settles face up or face down
  let angle = 0, speed = 0, dragging = false, lastX = 0, frame = null, faceUp = false, goal = null;
  const draw = () => { spin.style.setProperty("--a", `${angle}deg`); spin.style.setProperty("--shine", `${50 + Math.sin(angle * Math.PI / 180) * 45}%`); };
  const settle = () => {
    cancelAnimationFrame(frame);
    const step = () => {
      if (dragging) return;
      if (goal != null) { angle += (goal - angle) * .12; if (Math.abs(goal - angle) < .3) { angle = goal; goal = null; draw(); return; } }
      else if (Math.abs(speed) > .3) { angle += speed; speed *= .95; }
      else { const unit = faceUp ? 360 : 180, target = Math.round(angle / unit) * unit; angle += (target - angle) * .15; if (Math.abs(target - angle) < .3) { angle = target; draw(); return; } }
      draw(); frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };
  // The arrow keys and the Spin button turn it to an exact stop: half a turn shows the other side
  const turn = by => { faceUp = false; speed = 0; goal = Math.round((angle + by) / 180) * 180; if (calm) { angle = goal; goal = null; draw(); return; } settle(); };
  stage.addEventListener("pointerdown", e => { dragging = true; faceUp = false; goal = null; lastX = e.clientX; speed = 0; stage.setPointerCapture(e.pointerId); cancelAnimationFrame(frame); });
  stage.addEventListener("pointermove", e => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; angle += dx * .9; speed = dx * .9; draw(); });
  for (const ev of ["pointerup", "pointercancel"]) stage.addEventListener(ev, () => { if (!dragging) return; dragging = false; sound("tick"); settle(); });
  stage.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); turn(e.key === "ArrowLeft" ? -180 : 180); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); turn(180); }
  });
  const spinBtn = el("button", "btn", `🔄 ${t("Spin")}`);
  spinBtn.type = "button"; spinBtn.onclick = () => turn(360 + 180);
  const why = el("div", "medal-why");
  why.append(el("strong", null, t("Why you got it")), el("p", null, badgeDesc(b)));
  openPopup([stage, el("h2", null, t(b.name)), why, el("p", "muted medal-hint", t("Drag to spin the badge. The back shows when you got it.")), spinBtn],
    [["Close", true], ...(b.monthly ? [["Open challenge", false, () => goGame(`challenge/${b.monthly.id}`)]] : [])]);
  draw();
  if (!calm) { angle = -360; speed = 0; faceUp = true; draw(); requestAnimationFrame(() => { speed = 14; settle(); }); }   // it spins in when it opens
  sound(has ? "badge" : "tick");
}

// Every monthly challenge as a medal for the Badges page (its own seal shape, and a cartoon of its goal)
const MONTHLY_ART = { truebugs: () => bugG("halyomorpha_halys", 0, -4, .5), beetles: () => bugG("agrilus_planipennis", 0, -4, .5),
  natives: () => bugG("Western bumble bee", 0, -4, .5), moths: () => bugG("pieris_rapae", 0, -4, .5), rare: () => BADGE_ART.rare(),
  kinds: () => BADGE_ART.kinds3(), wasps: () => bugG("polistes_dominula", 0, -4, .5), any: () => BADGE_ART.first() };
function monthlyMedals() {
  return monthlyChallenges().slice().reverse().map((ch, k) => ({
    id: `mc-${ch.id}`, name: ch.kind.name, emoji: ch.kind.emoji, monthly: ch, colorIndex: k + 3, shape: { kind: "seal", n: 9 + k },
    isEarned: g => challengeStatus(g, ch) === "done", when: g => challengeState(g, ch)?.doneAt,
    art: () => `<rect x="-40" y="-40" width="80" height="80" fill="#f4f8ef"/>` + MONTHLY_ART[ch.kind.id]() +
      `<rect x="-24" y="22" width="48" height="14" rx="4" fill="#2f6fb3" stroke="#1b1b1b" stroke-width="1.2"/><text x="0" y="32.5" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="9" fill="#fff">${new Date(...ch.month.split("-").map((v, i) => i ? v - 1 : +v), 15).toLocaleDateString(langTag(), { month: "short", year: "numeric" })}</text>`,
  })).reverse();
}
function renderMonthlyBadges(g) {
  const grid = $("monthlyBadges"); grid.innerHTML = "";
  for (const b of monthlyMedals()) {
    const has = b.isEarned(g), st = challengeState(g, b.monthly), item = el("button", "medal-item" + (has ? " earned" : ""));
    item.type = "button";
    item.setAttribute("aria-label", `${t(b.name)}: ${has ? t("Badge earned") : t("Badge not earned yet")}`);
    item.append(medalFace(b, has), el("strong", null, t(b.name)), el("span", "muted medal-month", monthName(b.monthly.month)),
      el("span", "medal-progress", has ? "✅" : `${st?.count || 0}/${b.monthly.kind.n}`));
    item.onclick = () => showMedal(b);
    grid.append(item);
  }
}

// The limited-time badges, newest season first, with their dates. Missed ones stay grey.
function renderSeasonBadges(g) {
  const box = $("seasonBadges"); box.innerHTML = "";
  const now = seasonBlock(), blocks = [...new Map(BADGES.filter(b => b.limited).map(b => [b.block.id, b.block])).values()].reverse();
  const day = d => d.toLocaleDateString(langTag(), { month: "long", day: "numeric" });
  for (const block of blocks) {
    const current = block.id === now?.id;
    box.append(el("h3", "season-badges-title", `${["❄️", "🌸", "☀️", "🍂"][block.index % 4]} ${t("{season} {year}", { season: t(block.season), year: block.year })} · ${current
      ? t("Ends {date}", { date: day(block.end) }) : `${t("Ended {date}", { date: day(block.end) })} · ${t("You can still catch up!")}`}`));
    const grid = el("div", "badge-list");
    for (const b of BADGES.filter(x => x.limited && x.block.id === block.id)) {
      const has = g.badges.includes(b.id), item = el("button", "medal-item" + (has ? " earned" : current ? "" : " late"));
      item.type = "button";
      item.setAttribute("aria-label", `${t(b.name)}: ${has ? t("Badge earned") : t("Badge not earned yet")}`);
      const c = g.seasonCounts?.[block.id], count = b.goal.key === "kinds" ? (c?.kinds || []).length : c?.[b.goal.key] || 0;
      item.append(medalFace(b, has), el("strong", null, t(b.name)), el("span", "medal-progress", has ? "✅" : `${Math.min(count, b.goal.n)}/${b.goal.n}${current ? "" : ` · ${t("Catch up")}`}`));
      item.onclick = () => showMedal(b);
      grid.append(item);
    }
    box.append(grid);
  }
}

// ---------- the Innva-Orb ----------
// Our catching orb: a glowing crystal ball where green and purple swirl together, with a glowing leaf inside.
const ORB_SVG = `<svg viewBox="0 0 40 40" aria-hidden="true">
  <defs>
    <linearGradient id="orbGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5cf0a0"/><stop offset=".5" stop-color="#3fb4a8"/><stop offset="1" stop-color="#8e4fe0"/></linearGradient>
    <radialGradient id="orbShade" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#2a0f55" stop-opacity=".55"/></radialGradient>
  </defs>
  <circle cx="20" cy="20" r="17" fill="url(#orbGlass)"/>
  <path d="M6 24 C 12 14, 22 30, 34 15" stroke="#c9a6ff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".75"/>
  <path d="M7 15 C 15 22, 25 8, 33 25" stroke="#b8ffd6" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".6"/>
  <circle cx="20" cy="20" r="17" fill="url(#orbShade)"/>
  <path class="orb-core" d="M20 12 C 26 15, 26 24, 20 28 C 14 24, 14 15, 20 12 Z M20 14 L20 27" fill="#f2fff6" stroke="#1d7a4a" stroke-width="1" stroke-linejoin="round"/>
  <path d="M28 7 l1 2.5 2.5 1 -2.5 1 -1 2.5 -1 -2.5 -2.5 -1 2.5 -1z" fill="#fff" opacity=".9"/>
  <circle cx="11" cy="29" r="1.2" fill="#fff" opacity=".8"/>
</svg>`;
function makeOrb() {
  const o = el("span", "innva-orb");
  o.innerHTML = ORB_SVG;
  return o;
}
function throwOrb(arena, x, y, keep) {
  const j = makeOrb(), w = arena.clientWidth, h = arena.clientHeight;
  const sx = w / 2, sy = h - 24, mx = (sx + x) / 2, my = Math.min(sy, y) - 70;
  arena.append(j);
  const fly = j.animate([
    { transform: `translate(${sx}px, ${sy}px) rotate(0deg) scale(.7)` },
    { transform: `translate(${mx}px, ${my}px) rotate(400deg) scale(.95)`, offset: .55 },
    { transform: `translate(${x}px, ${y}px) rotate(720deg) scale(1)` },
  ], { duration: 380, easing: "cubic-bezier(.3,.6,.4,1)", fill: "forwards" });
  return fly.finished.then(() => {
    if (!keep) { j.animate([{ opacity: 1 }, { opacity: 0, transform: `translate(${x}px, ${y + 30}px) rotate(760deg) scale(.8)` }], { duration: 250 }).finished.then(() => j.remove()); }
    return j;
  });
}
// Where the bug is right now, in the arena's own coordinates
const bugCenter = (arena, bug) => {
  const a = arena.getBoundingClientRect(), b = bug.getBoundingClientRect();
  return [b.left - a.left + b.width / 2, b.top - a.top + b.height / 2];
};

// ---------- the minigame ----------
// The bug (the player's own photo) hops around the box. Tap it 3 times before time runs out.
function minigame(species, photo) {
  return new Promise(resolve => {
    const arena = el("div", "arena");
    const bug = el("button", "wild-bug");
    bug.type = "button";
    bug.setAttribute("aria-label", t("Catch the {bug}", { bug: commonName(species) }));
    const img = el("img"); img.src = photo; img.alt = "";
    bug.append(img);
    arena.append(bug);
    // Items from the shop are used up here, if you have them
    const g = loadGame();
    if (g.buddy) { const cheer = el("span", "arena-buddy"); cheer.append(buddyArt(g)); arena.append(cheer); }   // your Bug Buddy cheers you on
    const needTaps = MINIGAME_TAPS, seconds = MINIGAME_SECONDS;
    const info = el("p", "arena-info", t("Tap it {taps} times! {s} seconds left", { taps: needTaps, s: seconds }));
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
      const close = () => { popupDone = () => resolve(won); closePopup(); };
      if (!won || slow) return close();
      // The catch: the last orb flies at the bug, the bug shrinks inside, the orb wobbles 3 times, then click!
      bug.disabled = true;
      const [x, y] = bugCenter(arena, bug);
      throwOrb(arena, x, y, true).then(async jar => {
        jar.getAnimations().forEach(a => a.cancel());
        jar.style.left = `${x}px`; jar.style.top = `${y}px`;
        jar.classList.add("landed");
        arena.classList.add("catching");
        info.textContent = t("Gotcha…?");
        await wait(450);
        for (let k = 0; k < 3; k++) {
          jar.classList.remove("wobble"); void jar.offsetWidth; jar.classList.add("wobble");
          sound("tick");
          await wait(520);
        }
        jar.classList.add("clicked");
        sound("click");
        info.textContent = t("Gotcha!");
        await wait(700);
        close();
      });
    };
    bug.onclick = () => {
      taps++;
      if (taps >= needTaps) return end(true);
      // Throw an Innva-Orb: it bonks the bug, which shakes and hops away
      if (!slow) { const [x, y] = bugCenter(arena, bug); throwOrb(arena, x, y, false); }
      bug.classList.remove("hit"); void bug.offsetWidth; bug.classList.add("hit");
      sound("hit");
      info.textContent = t(needTaps - taps === 1 ? "{n} more tap!" : "{n} more taps!", { n: needTaps - taps });
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
    const hint = el("p", "muted orb-hint");
    hint.append(makeOrb(), t("Tap the bug to throw your Innva-Orb!"));
    openPopup([el("h2", null, t("A wild {bug} appeared!", { bug: commonName(species) })), rarityTag(species), hint, arena, bar, info],
      [["Let it go", false, () => end(false)]]);
    $("gamePopupBox").querySelector(".actions button").onclick = () => end(false);
    popupDone = () => end(false);   // closing the pop-up (Escape) lets the bug go
    bug.focus();
  });
}

// ---------- catching ----------
let encounters = Promise.resolve();

// Called by app.js when a photo shows an invasive bug. Bugs found together wait their turn.
// Photos of a bug's damage count as finding that bug
const SPECIES_ALIAS = { agrilus_planipennis_damage: "agrilus_planipennis" };
function encounter(species, photo) {
  species = SPECIES_ALIAS[species] || species;
  if (!SPECIES_FACTS[species]) return;
  encounters = encounters.then(async () => {
    const won = await minigame(species, photo);
    if (!won) {
      sound("lose");
      await new Promise(r => { popupDone = r; openPopup([el("h2", null, t("It got away!")),
        el("p", null, t("Don't worry, it was still reported. Find another one and try again."))], [["OK", true]]); });
      return;
    }
    sound("catch");
    const spot = await here();   // a rough area from the photo part of the app, or null
    const g = loadGame();
    const se = season(), seasonal = se.groups.includes(SPECIES_FACTS[species].group);
    const nightly = !seasonal && isNight() && SPECIES_FACTS[species].group === "moth";
    const pts = RARITY[SPECIES_FACTS[species].rarity].points * (seasonal || nightly ? 2 : 1);
    const before = bugLevel(g.caught[species] || 0), firstEver = totalCaught(g) === 0;
    const firstLegend = SPECIES_FACTS[species].rarity === "legendary" && !caughtRarity(g, "legendary");
    g.caught[species] = (g.caught[species] || 0) + 1;
    addPoints(g, pts);
    g.spots.push({ species, ...(spot || {}), when: new Date().toLocaleDateString() });
    // Story cutscenes for big moments (they play after the pop-up, in this order)
    if (firstEver) queueScene(FIRST_CATCH);
    if (firstLegend) queueScene(FIRST_LEGENDARY.map(sl => ({ ...sl, vars: { bug: commonName(species) } })));
    const lines = seasonal ? [`${se.emoji} ${t("{season}: double points!", { season: t(se.name) })}`] : nightly ? [`🌙 ${t("Night Watch: double points!")}`] : [];
    if (g.caught[species] > 1 && bugLevel(g.caught[species]) > before)
      lines.push(`⬆️ ${t("Your {bug} leveled up to Lv {lv}! It's stronger in battles now.", { bug: commonName(species), lv: bugLevel(g.caught[species]) })}`);
    lines.push(...progress(g, { type: "catch", species, pts }));
    if (spot) lines.push(`📍 ${placeText({ ...spot, when: null })}`);
    checkUnlocks(g);
    if (!firstEver) maybeAmbush(g, species);
    const extra = lines.map(l => el("p", "new-badge", l));
    saveGame(g);
    justCaught = species;
    renderGame();
    justCaught = null;
    confetti();

    await new Promise(r => { popupDone = r; openPopup([el("h2", null, t("Gotcha! +{pts} points", { pts })), ...extra, factCard(species, g.caught[species])],
      [["Open Innvadex", true, () => { goGame(); setTimeout(() => $("dexGrid").scrollIntoView({ behavior: "smooth", block: "center" }), 100); }], ["Keep playing", false]]); });
    await playQueued();
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
  g.protectorDex[species] = (g.protectorDex[species] || 0) + 1;
  const lines = [`🛡️ ${t("{bug} isn't invasive. Leave it be! +{pts} protector points", { bug: commonName(species), pts: PROTECTOR_POINTS })}`, ...progress(g, { type: "native", species })];
  saveGame(g);
  renderGame();
  toast(lines);
  playQueued();
}

// Called by app.js when a photo looks AI-made: it doesn't count in the game
function fakePhoto() {
  toast([`🤖 ${t("That photo looks AI-made, so it doesn't count in the game. Real photos only!")}`]);
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

// Returns a promise that finishes when the result pop-up is closed
function battle(foe, gym) {
  return new Promise(battleDone => {
  const g = loadGame(), mine = myTeam(g), theirs = foe.fighters || foe.team.filter(s => SPECIES_FACTS[s]).map(s => fighter(s, foe.bugLevel || 1));
  if (!mine.length || !theirs.length) return battleDone();
  const foeName = gym ? foe.leader : foe.name;
  let me = 0, them = 0, busy = false, over = false, fx = null;
  const youLabel = `${trainerLook(g)} ${g.trainer.name || t("You")}`;
  // A grown-up Bug Buddy cheers, which makes your bugs a little stronger
  const cheer = buddyBoost(g);
  for (const f of mine) f.atk += cheer;
  const buddyTip = el("p", "buddy-tip");

  const field = el("div", "battle-field");
  const bubble = el("p", "speech");
  const talk = text => { bubble.textContent = `${foe.emoji} ${foeName}: “${t(text)}”`; };
  talk(foe.say.hi);
  const log = el("p", "battle-log", t("{foe} wants to battle!", { foe: foeName }) + (cheer ? ` ${t("{buddy} cheers! Your bugs get +{n} attack.", { buddy: buddyName(g), n: cheer })}` : ""));
  log.setAttribute("aria-live", "polite");
  const say = text => { log.textContent = text; };
  const side = (team, i, label, cls) => {
    const f = team[i], box = el("div", `fighter ${cls}${f.hp <= 0 ? " fainted" : ""}`);
    const hp = el("div", "track"), fill = el("div", "fill" + (f.hp / f.max < 0.3 ? " low" : ""));
    fill.style.width = `${f.hp / f.max * 100}%`; hp.append(fill);
    const left = team.filter(tm => tm.hp > 0).length;
    box.append(el("span", "muted", label), bugArt(f.species, "bug-emoji"),
      el("strong", null, `${commonName(f.species)}${f.level > 1 ? ` · ${t("Lv {lv}", { lv: f.level })}` : ""}`),
      el("span", "type-tag", t(TYPES[SPECIES_FACTS[f.species].group])),
      hp, el("span", "hp", `HP ${f.hp}/${f.max} · ${t(team.length === 1 ? "{n} of {total} bug left" : "{n} of {total} bugs left", { n: left, total: team.length })}`));
    return box;
  };
  const moves = el("div", "battle-moves");
  const btn = (text, onClick) => { const b = el("button", "btn", text); b.type = "button"; b.onclick = onClick; moves.append(b); return b; };
  const tackle = btn(t("Tackle"), () => turn("tackle"));
  const special = btn("", () => turn("special"));
  const swap = btn(t("Switch bug"), () => turn("switch"));
  tackle.classList.add("primary");
  const draw = () => {
    field.innerHTML = "";
    field.append(side(theirs, them, foeName, "them"), side(mine, me, youLabel, "you"));
    // Attack animation: the attacker lunges, the bug that got hit shakes, and the damage floats up
    if (fx) {
      const hit = field.querySelector(`.fighter.${fx.target}`), from = field.querySelector(`.fighter.${fx.target === "you" ? "them" : "you"}`);
      from.classList.add(fx.target === "you" ? "lunge-down" : "lunge-up");
      if (fx.hit) hit.classList.add("shake");
      hit.append(el("span", "dmg" + (fx.hit ? "" : " miss"), fx.text));
      fx = null;
    }
    special.textContent = t("{move} (strong, can miss)", { move: t(specialMove(mine[me])) });
    for (const b of [tackle, special]) b.disabled = busy || over;
    swap.disabled = busy || over || nextAlive(mine, me) < 0 || nextAlive(mine, me) === me;
    // Your Bug Buddy gives a type tip
    buddyTip.hidden = !g.buddy;
    if (g.buddy) {
      const boost = typeBoost(mine[me].species, theirs[them].species), vars = { bug: commonName(mine[me].species), foe: commonName(theirs[them].species) };
      buddyTip.textContent = `${buddyName(g)}: ${boost > 1 ? t("Your {bug} is strong against {foe}. Attack!", vars)
        : typeBoost(theirs[them].species, mine[me].species) > 1 ? t("Uh oh, {foe} is strong against your {bug}. Try switching!", vars) : t("You can do it!")}`;
      buddyTip.prepend(buddyArt(g, "tip-art"));
    }
  };

  // One attack. A special move hits harder but can miss.
  const attack = (a, d, useSpecial, owner) => {
    const move = t(useSpecial ? specialMove(a) : "Tackle"), bug = commonName(a.species);
    const who = owner ? t("{owner}'s {bug}", { owner, bug }) : t("Your {bug}", { bug });
    const target = d === mine[me] ? "you" : "them";
    if (useSpecial && Math.random() > SPECIAL_HIT_CHANCE) { fx = { target, text: t("Miss!") }; return say(t("{who} used {move}… but missed!", { who, move })); }
    const boost = typeBoost(a.species, d.species);   // the weather can make some types stronger, too
    const dmg = Math.max(1, Math.round((useSpecial ? a.atk * 1.8 + (Math.random() * 6 - 3) : a.atk + (Math.random() * 4 - 2)) * boost * weatherBoost(a.species)));
    d.hp = Math.max(0, d.hp - dmg);
    fx = { target, text: `-${dmg}`, hit: true };
    sound("hit");
    say(`${t("{who} used {move}! It did {dmg} damage.", { who, move, dmg })}${boost > 1 ? ` ${t("It's super effective!")}` : boost < 1 ? ` ${t("It's not very effective…")}` : ""}`);
  };

  async function turn(kind) {
    if (busy || over) return;
    busy = true;
    if (kind === "switch") { me = nextAlive(mine, me); say(t("Go, {bug}!", { bug: commonName(mine[me].species) })); }
    else attack(mine[me], theirs[them], kind === "special", null);
    draw(); await wait(900); if (over) return;
    if (theirs[them].hp <= 0) {
      say(t("{owner}'s {bug} fainted!", { owner: foeName, bug: commonName(theirs[them].species) })); draw(); await wait(900); if (over) return;
      const n = nextAlive(theirs, them);
      if (n < 0) return finish(true);
      them = n; say(t("{foe} sends out {bug}!", { foe: foeName, bug: commonName(theirs[them].species) })); talk(foe.say.next);
      busy = false; return draw();
    }
    // The AI trainer's turn (see foeMove)
    let choice = foeMove(foe.level, theirs, them, mine[me]);
    // (Trainers and gyms never heal their bugs: once a bug is hurt, it stays hurt)
    if (choice === "switch") {
      them = nextHealthiest(theirs, them);
      say(t("{foe} switches to {bug}!", { foe: foeName, bug: commonName(theirs[them].species) })); talk(foe.say.next);
    }
    const f = theirs[them], p = mine[me];
    if (choice === "tackle" || choice === "special") attack(f, p, choice === "special", foeName);
    draw(); await wait(900); if (over) return;
    if (p.hp <= 0) {
      say(t("Your {bug} fainted!", { bug: commonName(p.species) })); draw(); await wait(900); if (over) return;
      const n = nextAlive(mine, me);
      if (n < 0) return finish(false);
      me = n; say(t("Go, {bug}!", { bug: commonName(mine[me].species) }));
    }
    busy = false; draw();
  }

  let firstGymWin = false, firstTangleWin = false;
  function finish(won, ran) {
    if (over) return;
    over = true; popupDone = null;
    const lines = [];
    let title = t(ran ? "You ran away." : "You lost this time. Catch more bugs and try again!");
    const g = loadGame();
    if (foe.swarm) {   // the swarm keeps its damage until the week is over
      swarm(g);   // starts this week's swarm in the save, if it isn't there yet
      g.boss.hp = theirs[0].hp;
      if (!won) title = t("The swarm has {hp} of {max} HP left. Come back and battle again!", { hp: g.boss.hp, max: BOSS_HP });
    }
    if (won) {
      const beatenBefore = gym ? g.gyms.includes(foe.id) : foe.tangle ? g.tangle.includes(foe.tangle) : false;
      const pts = beatenBefore ? 10 : foe.reward;
      firstGymWin = gym && !beatenBefore;
      firstTangleWin = !!foe.tangle && !beatenBefore;
      g.wins++; addPoints(g, pts);
      if (gym && !beatenBefore) g.gyms.push(foe.id);
      if (firstTangleWin) g.tangle.push(foe.tangle);
      if (firstTangleWin && foe.boss) g.buddy = { kind: "squawk", xp: g.buddy?.xp || 0, seen: BUDDY_STAGES.length - 1 };   // Squawk joins you!
      if (foe.swarm) { g.boss.beaten = true; g.bossWins++; }
      lines.push(...progress(g, { type: "win", pts }));
      checkUnlocks(g);
      title = t("You beat {foe}! +{pts} points", { foe: foeName, pts });
    }
    if (foe.ambush && !won) lines.push(`😅 ${t("Team Tangle tried to grab your {bug}, but it slipped away and hid in your Innvadex. Phew!", { bug: commonName(foe.bug) })}`);
    saveGame(g); renderGame();
    const tipBug = foe.team[Math.floor(Math.random() * foe.team.length)];
    sound(won ? "win" : "lose");
    const said = ran ? null : el("p", "speech", `${foe.emoji} ${foeName}: “${t(won ? foe.say.lose : foe.say.win)}”`);
    const result = () => {
      if (won) confetti();
      openPopup([el("h2", null, title), ...(said ? [said] : []), ...lines.map(l => el("p", "new-badge", l)),
        el("p", "muted", t("Did you know? {bug}: {harm}", { bug: commonName(tipBug), harm: t(SPECIES_FACTS[tipBug].harm) }))], [["OK", true]]);
      popupDone = () => { battleDone(); playQueued(); };
    };
    // Team Tangle flies away when they lose
    if (won && foe.villain) { $("gamePopup").hidden = true; return cutscene(blastOff(foe, firstTangleWin)).then(result); }
    if (!(won && firstGymWin)) return result();
    // Beating a gym for the first time: a victory cutscene (and the ending after the last gym)
    $("gamePopup").hidden = true;
    if (foe.champion) return cutscene(FINALE).then(result);
    const next = GYMS[GYMS.indexOf(foe) + 1];
    cutscene([
      { scene: "victory", who: foe.emoji, name: foe.badge, text: "You got the {badge}! That's {n} of {total} forest badges.",
        vars: { badge: t(foe.badge), n: loadGame().gyms.filter(id => GYMS.some(gy => gy.id === id && !gy.champion)).length, total: GYMS.length - 1 } },
      { scene: foe.id, who: foe.face, name: foe.leader, text: "One more thing, a real-world tip: {tip}", vars: { tip: t(foe.tip) } },
      next.champion
        ? { scene: next.id, ...HAZEL, text: "You have all {n} forest badges! There's only one battle left: the Oregon Champion.", vars: { n: GYMS.length - 1 } }
        : { scene: next.id, ...HAZEL, text: "Next stop: {place}. {leader} is waiting for you there!", vars: { place: t(next.place), leader: next.leader } },
    ]).then(result);
  }

  openPopup([el("h2", null, `${foe.emoji} ${gym ? t(foe.name) : foe.name}`), bubble, buddyTip, field, log, moves], [["Run away", false]]);
  popupDone = () => finish(false, true);   // "Run away" or Escape
  draw();
  tackle.focus();
  });
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
  tick:   [[660, .04]],
  click:  [[1568, .05], [2093, .12]],
  tangle: [[294, .12], [277, .12], [262, .12], [247, .3]],
  fly:    [[880, .05], [1175, .05], [1568, .05], [2093, .05], [2637, .15]],
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

// ---------- where you caught it ----------
// Uses the rough area (about 1 km) from the photo part of the app (getArea in app.js), so the
// game never asks for location on its own. It's saved only on this device.
function here() {
  return typeof getArea === "function" ? getArea().catch(() => null) : Promise.resolve(null);
}
// "Caught near Beaverton on 10/16/2026", using the closest town in PLACES
function placeText(sp) {
  const km = (a, b) => Math.hypot((a[0] - b[0]) * 111, (a[1] - b[1]) * 111 * Math.cos(a[0] * Math.PI / 180));
  let where = null;
  if (sp.lat != null) {
    const near = PLACES.map(([name, lat, lon]) => [name, km([sp.lat, sp.lon], [lat, lon])]).sort((a, b) => a[1] - b[1])[0];
    where = near[1] <= PLACES_KM ? t("near {place}", { place: near[0] }) : `${sp.lat.toFixed(2)}, ${sp.lon.toFixed(2)}`;
  }
  if (!sp.when) return t("Caught {where}", { where });
  return where ? t("Caught {where} on {date}", { where, date: sp.when }) : t("Caught on {date}", { date: sp.when });
}

// ---------- confetti ----------
let lastConfetti = 0;
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || Date.now() - lastConfetti < 800) return;
  lastConfetti = Date.now();
  const box = el("div", "confetti");
  box.setAttribute("aria-hidden", "true");
  const colors = ["#e74c3c", "#f1c40f", "#2ecc71", "#3498db", "#9b59b6", "#ff8c42"];
  for (let i = 0; i < 60; i++) {
    const c = el("i");
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${Math.random() * 0.3}s`;
    c.style.animationDuration = `${1.2 + Math.random() * 0.8}s`;
    c.style.setProperty("--x", `${Math.random() * 200 - 100}px`);
    c.style.setProperty("--r", `${Math.random() * 720}deg`);
    box.append(c);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 2600);
}

// ---------- cutscenes ----------
// A cutscene is a list of slides: { scene, who (an emoji), name, text }. "{name}" in the text
// becomes the player's nickname. Tap, Enter or Space goes to the next slide. Skip or Escape ends it.
function cutscene(slides) {
  return new Promise(resolve => {
    const nick = loadGame().trainer.name || t("Ranger");
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wrap = el("div", "cutscene");
    wrap.setAttribute("role", "dialog"); wrap.setAttribute("aria-modal", "true"); wrap.setAttribute("aria-label", t("Story"));
    wrap.lang = langTag();
    // The 3D room: a classroom at Pyinsect University. The place in the story shows on the big screen.
    const stage = el("div", "cs-stage"), room = el("div", "cs-room"), cam = el("div", "cs-cam");
    const face3d = name => el("div", `cs-3d cs-${name}`);
    const back = face3d("back"), left = face3d("left"), right = face3d("right");
    const screen = el("div", "cs-screen"), screenDecor = el("div", "cs-decor"), screenPlace = el("div", "cs-screen-label");
    screen.append(screenDecor, screenPlace);
    const poster = el("div", "cs-poster");
    for (const k of ["agrilus_planipennis", "lycorma_delicatula", "harmonia_axyridis", "vespa_mandarinia"]) poster.append(bugArt(k));
    back.append(el("div", "cs-sign", t("Pyinsect University · Insect Lab")), screen, poster, el("div", "cs-clock"));
    for (let k = 0; k < 3; k++) left.append(el("div", "cs-window"));
    right.append(el("div", "cs-door"), el("div", "cs-shelf"));
    cam.append(face3d("floor"), face3d("ceiling"), left, right, back);
    room.append(cam);
    const actor = el("div", "cs-actor"), face = el("span", "cs-face"), play = el("div", "cs-play");
    actor.append(face);
    stage.append(room, play, actor);
    const box = el("div", "cs-box"), who = el("strong"), text = el("p"), choices = el("div", "cs-choices"), next = el("button", "btn primary");
    const skip = el("button", "btn cs-skip", `${t("Skip")} ⏭`);
    const logo = el("span", "logo-chip cs-logo"), logoImg = el("img");
    logoImg.src = "assets/favicon.svg"; logoImg.alt = ""; logoImg.width = logoImg.height = 22;
    logo.append(logoImg, "Pyinsect"); logo.setAttribute("aria-hidden", "true");
    next.type = skip.type = "button";
    text.setAttribute("aria-live", "polite");
    box.append(who, text, choices, next);
    wrap.append(stage, box, skip, logo);
    // The room is as big as the stage, and as deep as it is wide
    const fit = () => {
      const r = stage.getBoundingClientRect();
      cam.style.setProperty("--W", `${r.width}px`); cam.style.setProperty("--H", `${r.height}px`);
      cam.style.setProperty("--D", `${Math.max(r.width, r.height) * 1.2}px`);
    };
    addEventListener("resize", fit);
    // Camera shots, like a movie: the camera turns a little toward whoever is talking
    const SHOTS = [{ ry: -7, x: 30, z: 40 }, { ry: 6, x: -30, z: 60 }, { ry: 0, x: 0, z: 120 }, { ry: -3, x: 10, z: 0 }];
    let shot = 0;
    const aim = n => { const sh = SHOTS[n % SHOTS.length]; cam.style.setProperty("--ry", `${sh.ry}deg`); cam.style.setProperty("--x", `${sh.x}px`); cam.style.setProperty("--z", `${sh.z}px`); };

    let i = -1, typing = null, full = "", waiting = false;
    const finishTyping = () => { clearInterval(typing); typing = null; text.textContent = full; face.classList.remove("talking"); };
    const say = (words, speaker) => {
      full = words;
      face.classList.add("talking");
      speak(full, speaker);
      if (calm) return finishTyping();
      text.textContent = "";
      let c = 0;
      clearInterval(typing);
      typing = setInterval(() => { text.textContent = full.slice(0, ++c); if (c >= full.length) finishTyping(); }, 22);
    };
    const react = move => { actor.className = "cs-actor"; void actor.offsetWidth; actor.classList.add(move); };
    const done2 = () => { waiting = false; choices.innerHTML = ""; play.innerHTML = ""; next.hidden = false; next.focus(); };
    let fromLeft = true;
    function show(n) {
      i = n;
      if (i >= slides.length) return done();
      const s = slides[i], sc = SCENES[s.scene] || SCENES.forest;
      screen.style.background = sc.bg;
      screenDecor.textContent = sc.decor;
      // The place's name stays on the big screen until the scene changes
      if (s.vars?.place) screenPlace.textContent = s.vars.place.charAt(0).toUpperCase() + s.vars.place.slice(1);
      else if (i === 0 || slides[i - 1].scene !== s.scene) screenPlace.textContent = "";
      who.textContent = t(s.name);
      // How the character moves: a new speaker walks in from one side (then the other side next time).
      // The same speaker reacts to what they say: jump for "!", tilt for "?", spin for a win, or sway.
      const newSpeaker = i === 0 || slides[i - 1].who !== s.who;
      const words = t(s.text, s.vars).replaceAll("{name}", nick);
      const move = s.fly ? "fly-away" : newSpeaker ? (fromLeft ? "enter-left" : "enter-right")
        : s.scene === "victory" ? "spin" : /[!！]$/.test(words) ? "jump" : /[?？]$/.test(words) ? "tilt" : "sway";
      if (newSpeaker) { fromLeft = !fromLeft; aim(++shot); }
      // A bug that talks is its cartoon (who: "art:<species>"), everyone else is an emoji
      face.innerHTML = "";
      if (s.who.startsWith("art:")) face.append(bugArt(s.who.slice(4), "cs-art")); else face.textContent = s.who;
      react(move);
      if (s.sound) sound(s.sound);
      say(words, s.name);
      next.textContent = i === slides.length - 1 ? `${t("Done")} ✔` : `${t("Next")} ▶`;
      choices.innerHTML = ""; play.innerHTML = "";
      next.hidden = false;
      if (s.ask) askQuestion(s);
      if (s.tap) tapTheBug(s);
    }
    // Interactive: a question with buttons. A wrong answer explains why, and you can try again.
    function askQuestion(s) {
      waiting = true; next.hidden = true;
      for (const opt of shuffle(s.ask)) {
        const b = el("button", "btn cs-choice", t(opt.text));
        b.type = "button";
        b.onclick = e => {
          e.stopPropagation();
          if (opt.right) { sound("right"); react("jump"); confetti(); say(t(s.yes).replaceAll("{name}", nick), s.name); done2(); }
          else { sound("wrong"); b.disabled = true; react("tilt"); box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake"); say(t(s.no).replaceAll("{name}", nick), s.name); }
        };
        choices.append(b);
      }
      choices.querySelector("button")?.focus();
    }
    // Interactive: a bug runs around the room. Tap it 3 times to catch it.
    function tapTheBug(s) {
      waiting = true; next.hidden = true;
      const bug = el("button", "cs-bug"), need = 3;
      let taps = 0;
      bug.type = "button"; bug.setAttribute("aria-label", t("Catch the {bug}", { bug: commonName(s.tap) }));
      bug.append(bugArt(s.tap));
      const hop = () => { bug.style.left = `${10 + Math.random() * 70}%`; bug.style.top = `${15 + Math.random() * 45}%`; };
      const mover = setInterval(() => { if (!bug.isConnected) clearInterval(mover); else hop(); }, calm ? 2000 : 1100);
      bug.onclick = e => {
        e.stopPropagation();
        taps++; sound("hit");
        bug.classList.remove("hit"); void bug.offsetWidth; bug.classList.add("hit");
        if (taps < need) return hop();
        clearInterval(mover); sound("catch"); confetti(); react("jump");
        say(t(s.got).replaceAll("{name}", nick), s.name);
        setTimeout(done2, calm ? 0 : 400);
      };
      hop(); play.append(bug); bug.focus();
    }
    const advance = () => waiting ? null : typing ? finishTyping() : show(i + 1);
    function done() {
      clearInterval(typing);
      hush();
      removeEventListener("resize", fit);
      wrap.remove();
      resolve();
    }
    wrap.onclick = e => { if (e.target !== skip && !e.target.closest(".cs-choices, .cs-bug")) advance(); };
    skip.onclick = done;
    wrap.onkeydown = e => {
      if (e.key === "Escape") { e.stopPropagation(); done(); }
      else if ((e.key === "Enter" || e.key === " ") && e.target === next) { e.preventDefault(); advance(); }
      else if ((e.key === "Enter" || e.key === " ") && e.target === wrap) { e.preventDefault(); advance(); }
    };
    document.body.append(wrap);
    fit();
    show(0);
    next.focus();
  });
}

// ---------- trainer card ----------
function editTrainer(first) {
  return new Promise(resolve => {
    const g = loadGame();
    let avatar = g.trainer.avatar;
    const label = el("label", "trainer-label", t("Nickname"));
    const input = el("input", "trainer-input");
    input.type = "text"; input.maxLength = NAME_MAX; input.value = g.trainer.name;
    input.placeholder = t("Like BugBuster or LeafNinja"); input.id = "trainerName"; label.htmlFor = "trainerName";
    const picks = el("div", "avatar-picks");
    for (const a of AVATARS) {
      const b = el("button", "avatar-pick", a);
      b.type = "button"; b.setAttribute("aria-pressed", a === avatar); b.setAttribute("aria-label", `Avatar ${a}`);
      b.onclick = () => { avatar = a; for (const p of picks.children) p.setAttribute("aria-pressed", p === b); };
      picks.append(b);
    }
    const save = () => {
      const g = loadGame();
      g.trainer = { name: input.value.trim().slice(0, NAME_MAX), avatar };
      saveGame(g); renderGame();
    };
    popupDone = resolve;
    openPopup([el("h2", null, t("Your trainer card")),
      el("p", "muted", t("Pick a nickname. Don't use your real name, so you stay safe online. It's saved only on this device.")),
      label, input, el("p", "trainer-label", t("Pick your avatar")), picks],
      [["Save", true, save], ...(first ? [] : [["Cancel", false]])]);
    input.onkeydown = e => { if (e.key === "Enter") { save(); closePopup(); } };
    input.focus();
  });
}

// ---------- version 7: protector-dex, story gallery, big text ----------

// The Protector-dex: bugs you found that aren't invasive (you leave them be)
function renderProtectorDex(g) {
  const list = $("protectorList"); list.innerHTML = "";
  const found = Object.entries(g.protectorDex).sort((a, b) => commonName(a[0]).localeCompare(commonName(b[0])));
  $("protectorCount").textContent = found.length
    ? t(found.length === 1 ? "You've found {n} kind of bug that isn't invasive. Thanks for leaving it be!" : "You've found {n} kinds of bugs that aren't invasive. Thanks for leaving them be!", { n: found.length })
    : t("No bugs here yet. When a photo shows a bug that isn't invasive, it shows up here.");
  for (const [s, n] of found) {
    const slot = el("div", "dex-slot caught");
    slot.append(el("span", "bug-emoji", "🌼"), el("strong", null, commonName(s)), el("span", "sci", sciName(s)), el("span", "count", t("Found ×{n}", { n })));
    list.append(slot);
  }
}

// The story gallery: watch any cutscene you've unlocked again
function storyScenes(g) {
  const list = [{ name: `🎬 ${t("The beginning")}`, slides: INTRO }];
  if (totalCaught(g)) list.push({ name: `🫙 ${t("Your first catch")}`, slides: FIRST_CATCH });
  const legend = gameSpecies().find(sp => g.caught[sp] && SPECIES_FACTS[sp].rarity === "legendary");
  if (legend) list.push({ name: `👑 ${t("Your first Legendary")}`, slides: FIRST_LEGENDARY.map(sl => ({ ...sl, vars: { bug: commonName(legend) } })) });
  for (const gym of GYMS) {
    if (gymOpen(g, gym) || g.gyms.includes(gym.id)) list.push({ name: `${gym.emoji} ${t("Arriving at {place}", { place: t(gym.place) })}`, slides: gymIntroScenes(gym) });
    if (g.gyms.includes(gym.id) && gym.champion) list.push({ name: `🏆 ${t("The ending")}`, slides: FINALE });
  }
  if (g.tangle.length) list.push({ name: `🦹 ${t("Team Tangle's motto")}`, slides: TANGLE_MOTTO });
  for (const sc of TANGLE) if (g.tangle.includes(sc.id)) list.push({ name: `${sc.emoji} ${t(sc.name)}`, slides: [...tanglePlan(sc), ...blastOff(tangleFoe(sc), true)] });
  return list;
}
function applyBigText(g) { document.documentElement.classList.toggle("big-text", !!g.bigText); }

// ---------- version 8: Team Tangle, Swarm Boss, Bug Buddy, weather, night, outfits, minigames ----------

const pickOne = list => list[Math.floor(Math.random() * list.length)];
// Puts a list in random order (for cards, rounds, and teams)
const shuffle = list => list.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1]);
const dayNumber = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
const weekNumber = () => Math.floor((dayNumber() + 3) / 7);   // a new week starts each Monday
// The same "random" weather all day, for everyone
const weather = () => WEATHER[Math.floor(Math.abs(Math.sin(dayNumber() * 12.9898) * 43758.5453) % 1 * WEATHER.length)];
const weatherBoost = species => weather().types.includes(SPECIES_FACTS[species].group) ? WEATHER_BOOST : 1;
const isNight = () => { const h = new Date().getHours(); return h >= NIGHT_START || h < NIGHT_END; };
const gymCount = g => g.gyms.filter(id => id !== "champion").length;

// ---- weather and night ----
function renderWorld(g) {
  const w = weather(), night = isNight();
  $("weatherText").textContent = `${w.emoji} ${t("Today's weather: {weather}.", { weather: t(w.name) })} ${t(w.text)}`
    + (night ? `  🌙 ${t("Night Watch: moths and butterflies give double points.")}` : "");
  const se = season();
  $("conditionsText").textContent = `${se.emoji} ${t(se.name)} · ${w.emoji} ${t(w.name)}${night ? ` · 🌙 ${t("Night Watch")}` : ""}`;
  $("game").classList.toggle("night", night);
  // At night the whole page goes dark, not just the game (see "Night mode" in site.css)
  document.documentElement.classList.toggle("night", night);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", night ? "#0e1730" : "#2f6b45");
  if (night && !$("game").querySelector(".fireflies")) {
    const sky = el("div", "fireflies");
    sky.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 14; i++) {
      const f = el("i");
      f.style.left = `${Math.random() * 100}%`; f.style.top = `${Math.random() * 100}%`;
      f.style.animationDelay = `${Math.random() * 4}s`; f.style.animationDuration = `${3 + Math.random() * 3}s`;
      sky.append(f);
    }
    $("game").prepend(sky);
  }
  if (!night) $("game").querySelector(".fireflies")?.remove();
}

// ---- Bug Buddy ----
const buddyStage = g => !g.buddy ? -1 : BUDDIES[g.buddy.kind].grown ? BUDDY_STAGES.length - 1 : BUDDY_STAGES.filter(s => g.buddy.xp >= s[0]).length - 1;
const buddyFace = g => BUDDIES[g.buddy.kind].stages[buddyStage(g)];
// The buddy's cartoon at each stage (egg, baby, grown-up, Super). Super ones glow.
const BUDDY_ART = { swallowtail: ["egg", "Oregon swallowtail caterpillar", "Oregon swallowtail"], ladybug: ["egg", "Convergent lady beetle larva", "Convergent lady beetle"],
  groundbeetle: ["egg", "Ground beetle larva", "Ground beetle"], squawk: ["Squawk"] };
function buddyArt(g, cls = "") {
  const list = BUDDY_ART[g.buddy.kind] || [], st = buddyStage(g);
  const art = bugArt(list[Math.min(st, list.length - 1)], cls);
  if (st === BUDDY_STAGES.length - 1) art.classList.add("super-art");
  return art;
}
const buddyName = g => t(BUDDIES[g.buddy.kind].name);
const buddyBoost = g => Math.max(0, buddyStage(g) - 1);   // grown-up: +1 attack, super: +2

function renderBuddy(g) {
  const b = $("buddyBtn");
  b.classList.toggle("super", buddyStage(g) === BUDDY_STAGES.length - 1);
  b.textContent = g.buddy ? `${buddyName(g)} · ${t(BUDDY_STAGES[buddyStage(g)][1])}` : t("Pick a Bug Buddy");
  b.prepend(g.buddy ? buddyArt(g, "btn-art") : bugArt("egg", "btn-art"), " ");
}
// Pick a buddy, or switch to another one. Switching keeps the points your buddy has earned.
function pickBuddy() {
  const picks = el("div", "buddy-picks"), now = loadGame();
  for (const [kind, bd] of Object.entries(BUDDIES)) {
    if (bd.unlock && !bd.unlock(now)) continue;
    const b = el("button", "buddy-pick");
    b.type = "button";
    b.append(bugArt(BUDDY_ART[kind].at(-1), "bug-emoji"), el("strong", null, t(bd.name)), el("span", "muted", t(bd.fact)));
    b.onclick = () => {
      const g = loadGame(), had = g.buddy;
      g.buddy = { kind, xp: had?.xp || 0, seen: 0 };
      g.buddy.seen = buddyStage(g);
      saveGame(g); closePopup(); renderGame(); sound("badge");
      toast([had ? `${buddyFace(g)} ${t("{buddy} is your buddy now!", { buddy: t(bd.name) })}`
        : `🥚 ${t("Your {buddy} egg is ready! Earn points to help it grow.", { buddy: t(bd.name) })}`]);
    };
    picks.append(b);
  }
  openPopup([el("h2", null, t("Pick a Bug Buddy")),
    el("p", "muted", t("Your buddy is a native bug. It grows as you earn points, gives you tips, and cheers for you in battles.")), picks],
    [["Not now", false]]);
}
function showBuddy() {
  const g = loadGame();
  if (!g.buddy) return pickBuddy();
  const st = buddyStage(g), next = BUDDY_STAGES[st + 1], from = BUDDY_STAGES[st][0];
  const big = el("div", "buddy-big" + (next ? "" : " super"));
  big.append(buddyArt(g));
  const bar = el("div", "track"), fill = el("div", "fill");
  fill.style.width = next ? `${(g.buddy.xp - from) / (next[0] - from) * 100}%` : "100%";
  bar.append(fill);
  openPopup([big, el("h2", null, buddyName(g)),
    el("p", null, `${t(BUDDY_STAGES[st][1])} · ${next ? t("{n} more points to grow", { n: next[0] - g.buddy.xp }) : t("Fully grown!")}`), bar,
    el("p", "muted", t(BUDDIES[g.buddy.kind].fact)),
    (() => { const tip = el("p", "speech", `“${t(pickOne(BUDDY_TIPS))}”`); tip.prepend(buddyArt(g, "tip-art"), " "); return tip; })(),
    el("p", "muted", st >= 2 ? t("In battles, your buddy cheers: your bugs get +{n} attack.", { n: buddyBoost(g) }) : t("When your buddy is grown up, it cheers for your bugs in battles."))],
    [["Close", true], ["Switch buddy", false, pickBuddy]]);
  sound("right");
}

const trainerLook = g => g.trainer.avatar;

// ---- Team Tangle ----
const tangleOpen = (g, i) => kindsCaught(g) >= 2 && (i === 0 || g.tangle.includes(TANGLE[i - 1].id)) && gymCount(g) >= TANGLE[i].gyms;
const tanglePlan = sc => sc.plan.flatMap(s => s === "motto" ? TANGLE_MOTTO : [s]);
const tangleFoe = sc => ({ ...sc, tangle: sc.id, villain: true, emoji: sc.boss ? BURDOCK.who : "🦹", name: sc.boss ? BURDOCK.name : "Team Tangle",
  say: { hi: "Look out! Team Tangle is here!", ...TANGLE_SAY, ...(sc.say || {}) } });
// After Team Tangle loses: the boss's ending (the first time), the fly-away, and a real-world lesson
const blastOff = (foe, first) => [
  ...(first && foe.ending ? foe.ending : []),
  ...TANGLE_BLAST_OFF,
  ...(first && foe.lesson ? [{ scene: "lab", ...HAZEL, text: foe.lesson }] : []),
  ...(first && foe.boss ? SQUAWK_JOINS : []),
];
// Sometimes, after a catch, Team Tangle tries to grab your bug (once a day at most)
function maybeAmbush(g, species) {
  if (!g.tangle.length || g.ambushDay === todayKey() || totalCaught(g) < 3 || Math.random() > AMBUSH_CHANCE) return;
  g.ambushDay = todayKey();
  const bug = commonName(species);
  queueScene(() => cutscene([
    { scene: "tangle", ...BRAMBLE, text: "Not so fast! That {bug} is coming with us!", vars: { bug }, sound: "tangle" },
    { scene: "tangle", ...THISTLE, text: "We'll set it free in a brand-new forest! Ha ha!" },
    { scene: "forest", ...PIP, text: "Bzz! An invasive bug in a new forest? No way! Battle them, {name}!" },
  ]).then(() => battle({ id: "ambush", ambush: true, villain: true, bug: species, emoji: "🦹", name: "Team Tangle",
    level: 2, bugLevel: Math.min(3, 1 + Math.floor(gymCount(g) / 4)), reward: AMBUSH_REWARD,
    team: shuffle(gameSpecies()).slice(0, 3), say: { hi: "Hand it over, Bug Ranger!", ...TANGLE_SAY } }, false)));
}

// ---- the weekly Swarm Boss ----
function swarm(g) {
  const week = weekNumber();
  if (!g.boss || g.boss.week !== week) g.boss = { week, hp: BOSS_HP, beaten: false };
  return { ...g.boss, species: BOSS_BUGS[week % BOSS_BUGS.length] };
}
function swarmFoe(g) {
  const sw = swarm(g);
  return { id: "swarm", swarm: true, emoji: SPECIES_FACTS[sw.species].emoji, name: t("Mega Swarm: {bug}", { bug: commonName(sw.species) }),
    level: 2, reward: BOSS_REWARD, team: [sw.species], fighters: [{ species: sw.species, level: 4, hp: sw.hp, max: BOSS_HP, atk: BOSS_ATK }],
    say: { hi: "BZZZZZZZZ!", next: "BZZZ!", lose: "Bzz… bzz…", win: "BZZZZZZZZ!" } };
}

// ---- minigames: Trap Defense and Where's the Bug? ----
// Today's minigame, in the daily box
const dailyGame = () => MINIGAMES[dayNumber() % MINIGAMES.length];
const MINIGAME_PLAY = { traps: () => trapDefense(), hide: () => hideAndSeek(), match: () => bugMatch(), sort: () => invasiveOrNative(), pop: () => bugPop() };
function renderDailyGame(g) {
  const mg = dailyGame(), won = g.games.day === todayKey() && g.games[mg.id];
  $("dailyGameName").textContent = `${mg.emoji} ${t(mg.name)}`;
  $("dailyGameState").textContent = won ? t("✅ Won! Play again for fun.") : t("+{pts} points", { pts: GAME_WIN_POINTS });
  $("dailyGameBtn").disabled = !gameSpecies().length;
}

// Points for a minigame win: more for the first win of the day
function minigameWin(id) {
  const g = loadGame();
  if (g.games.day !== todayKey()) g.games = { day: todayKey() };
  const pts = g.games[id] ? GAME_REPLAY_POINTS : GAME_WIN_POINTS;
  g.games[id] = true;
  if (id === "traps") g.trapWins++;
  else if (id === "hide") g.hideWins++;
  else g.miniWins[id] = (g.miniWins[id] || 0) + 1;
  addPoints(g, pts);
  const lines = progress(g, { type: "minigame", pts });
  saveGame(g); renderGame();
  return [pts, lines];
}
function minigameResult(won, title, lines, again) {
  sound(won ? "win" : "lose");
  if (won) confetti();
  openPopup([el("h2", null, title), ...lines.map(l => el("p", won ? "new-badge" : "muted", l))], [["Play again", true, again], ["Close", false]]);
  popupDone = playQueued;
}

// Trap Defense: tap the grass to place traps. Traps catch bugs on the path next to them.
function trapDefense() {
  const species = gameSpecies();
  if (!species.length) return;
  const byRarity = r => species.filter(s => SPECIES_FACTS[s].rarity === r);
  // Wave 1: common bugs. Wave 2: some rare ones. Wave 3: a Legendary bug at the end.
  const waveBugs = w => Array.from({ length: TRAP_WAVES[w] }, (_, i) =>
    pickOne(w === TRAP_WAVES.length - 1 && i === TRAP_WAVES[w] - 1 ? byRarity("legendary") : w >= 1 && i % 2 ? byRarity("rare") : byRarity("common")) || pickOne(species));
  const onPath = new Map(TRAP_PATH.map(([c, r], i) => [`${c},${r}`, i]));
  const traps = new Map();
  let money = TRAP_MONEY, hearts = TRAP_HEARTS, wave = -1, queue = [], bugs = [], tick = 0, timer = null, over = false, kind = "sticky", note = "", caught = 0;

  const board = el("div", "trap-board");
  board.style.setProperty("--cols", TRAP_COLS); board.style.setProperty("--rows", TRAP_ROWS);
  const status = el("p", "arena-info");
  status.setAttribute("aria-live", "polite");
  const showStatus = () => {
    status.textContent = `${"❤️".repeat(hearts)}${"🖤".repeat(TRAP_HEARTS - hearts)} · 🪙 ${t("Trap points: {n}", { n: money })} · ${t("Wave {n} of {total}", { n: Math.max(1, wave + 1), total: TRAP_WAVES.length })}${note ? ` · ${note}` : ""}`;
  };
  let forest = null;
  for (let r = 0; r < TRAP_ROWS; r++) for (let c = 0; c < TRAP_COLS; c++) {
    const i = onPath.get(`${c},${r}`);
    if (i != null) {
      const cell = el("div", "trap-cell path" + (i === TRAP_PATH.length - 1 ? " forest" : ""), i === TRAP_PATH.length - 1 ? "🌳" : "");
      if (i === TRAP_PATH.length - 1) forest = cell;
      board.append(cell);
      continue;
    }
    const cell = el("button", "trap-cell");
    cell.type = "button";
    cell.setAttribute("aria-label", t("Grass: place a trap here"));
    cell.onclick = () => place(c, r, cell);
    board.append(cell);
  }
  const place = (c, r, cell) => {
    const key = `${c},${r}`, tr = TRAPS[kind];
    if (traps.has(key) || over) return;
    if (money < tr.cost) { note = t("Not enough trap points!"); sound("wrong"); return showStatus(); }
    money -= tr.cost; note = "";
    traps.set(key, { kind, c, r, cell });
    cell.textContent = tr.emoji; cell.classList.add("trap"); cell.setAttribute("aria-label", t(tr.name));
    sound("buy"); showStatus();
  };
  const picker = el("div", "trap-picker");
  for (const [id, tr] of Object.entries(TRAPS)) {
    const b = el("button", "btn", `${tr.emoji} ${t(tr.name)} · 🪙 ${tr.cost}`);
    b.type = "button"; b.setAttribute("aria-pressed", id === kind);
    b.onclick = () => { kind = id; for (const p of picker.children) p.setAttribute("aria-pressed", p === b); };
    picker.append(b);
  }
  const legend = el("p", "muted trap-legend", Object.values(TRAPS).map(tr => `${tr.emoji} ${t(tr.desc)}`).join("  "));

  // Bugs move smoothly along the path, one step at a time
  const where = b => {
    const i = Math.min(Math.floor(b.pos), TRAP_PATH.length - 1), f = b.pos - i;
    const [c1, r1] = TRAP_PATH[i], [c2, r2] = TRAP_PATH[Math.min(i + 1, TRAP_PATH.length - 1)];
    return [c1 + (c2 - c1) * f, r1 + (r2 - r1) * f];
  };
  const draw = b => {
    const [x, y] = where(b);
    b.el.style.left = `${(x + .5) / TRAP_COLS * 100}%`; b.el.style.top = `${(y + .5) / TRAP_ROWS * 100}%`;
    b.el.style.setProperty("--hp", b.hp / b.max);
  };
  const spawn = s => {
    const hp = TRAP_HP[SPECIES_FACTS[s].rarity];
    const b = { s, pos: 0, hp, max: hp, el: el("span", "trap-bug") };
    b.el.append(bugArt(s));
    b.el.title = commonName(s);
    board.append(b.el); bugs.push(b); draw(b);
  };
  const remove = b => { bugs.splice(bugs.indexOf(b), 1); b.el.classList.add("gone"); setTimeout(() => b.el.remove(), 300); };
  const replay = (cls, e) => { e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); };
  const step = () => {
    tick++;
    if (queue.length && tick % 6 === 1) spawn(queue.shift());
    for (const b of [...bugs]) {
      b.pos += SPECIES_FACTS[b.s].rarity === "legendary" ? .16 : .22;
      if (b.pos < TRAP_PATH.length - 1) { draw(b); continue; }
      remove(b); hearts--; sound("wrong"); replay("shake", forest);
      if (hearts <= 0) return end(false);
    }
    // Each trap catches the bug nearest the forest, about once a second
    if (tick % 4 === 0) for (const tr of traps.values()) {
      const target = bugs.filter(b => { const [x, y] = where(b); return Math.hypot(x - tr.c, y - tr.r) <= TRAP_RANGE; }).sort((a, b) => b.pos - a.pos)[0];
      if (!target) continue;
      target.hp -= tr.kind === "prism" && SPECIES_FACTS[target.s].group === "beetle" ? 3 : 1;
      replay("zap", tr.cell); replay("hit", target.el);
      if (target.hp > 0) { draw(target); continue; }
      remove(target); money++; caught++; sound("hit");
    }
    if (!queue.length && !bugs.length) {
      if (wave >= TRAP_WAVES.length - 1) return end(true);
      clearInterval(timer); timer = null;
      note = t("Wave cleared! Place more traps, then start the next wave.");
      setStart();
    }
    showStatus();
  };
  const start = el("button", "btn primary");
  start.type = "button";
  const setStart = () => { start.textContent = `▶ ${t("Start wave {n}", { n: wave + 2 })}`; start.hidden = false; start.focus(); };
  start.onclick = () => { wave++; queue = waveBugs(wave); tick = 0; note = ""; start.hidden = true; timer = setInterval(step, TRAP_TICK); showStatus(); };

  function end(won, quit) {
    if (over) return;
    over = true; clearInterval(timer); popupDone = null;
    if (quit) return;
    if (!won) return minigameResult(false, t("The bugs reached the forest!"),
      [t("Tip: put traps next to corners, where the path goes by more than once. Purple prism traps are best for beetles.")], trapDefense);
    const [pts, lines] = minigameWin("traps");
    minigameResult(true, t("You saved the forest! +{pts} points", { pts }), [t("Your traps caught {n} bugs.", { n: caught }), ...lines], trapDefense);
  }
  showStatus(); setStart();
  openPopup([el("h2", null, `🟪 ${t("Trap Defense")}`), el("p", "muted", t("Tap the grass to place traps. Stop the bugs before they reach the forest!")),
    picker, legend, board, status, start], [["Quit", false]]);
  popupDone = () => end(false, true);   // "Quit" or Escape
  start.focus();
}

// Where's the Bug?: one bug peeks out from the plants. Tapping the wrong spot costs 2 seconds.
function hideAndSeek() {
  const species = gameSpecies();
  if (!species.length) return;
  let round = 0, left = 0, paused = true, over = false;
  const clue = el("p", "speech"), grid = el("div", "hide-grid"), bar = el("div", "track"), fill = el("div", "fill"), info = el("p", "arena-info");
  bar.append(fill);
  info.setAttribute("aria-live", "polite");
  const startRound = () => {
    const [cols, rows] = HIDE_ROUNDS[round], n = cols * rows, target = pickOne(species), f = SPECIES_FACTS[target];
    clue.textContent = t("Find the {bug}! Clue: {fact}", { bug: commonName(target), fact: t(f.fact) });
    clue.prepend(bugArt(target, "clue-art"));
    const others = [...species.filter(sp => sp !== target && BUG_ART[sp]?.kind !== BUG_ART[target]?.kind), ...NATIVE_BUGS.map(nb => nb.name)];
    info.textContent = t("Round {n} of {total}", { n: round + 1, total: HIDE_ROUNDS.length });
    grid.innerHTML = ""; grid.style.setProperty("--cols", cols);
    const spot = Math.floor(Math.random() * n), decoys = new Set();
    while (decoys.size < 2 + round * 2) { const d = Math.floor(Math.random() * n); if (d !== spot) decoys.add(d); }
    for (let i = 0; i < n; i++) {
      const cell = el("button", "hide-cell", pickOne(HIDE_PLANTS));
      cell.type = "button";
      if (i === spot || decoys.has(i)) { const peek = el("span", "peek"); peek.append(bugArt(i === spot ? target : pickOne(others))); cell.append(peek); }
      cell.onclick = i === spot ? () => found(cell) : () => miss(cell);
      grid.append(cell);
    }
    left = HIDE_SECONDS * 10; paused = false;
  };
  const found = cell => {
    if (paused || over) return;
    paused = true; cell.classList.add("found"); sound("right");
    round++;
    if (round >= HIDE_ROUNDS.length) return setTimeout(() => end(true), 600);
    info.textContent = t("Found it!");
    setTimeout(startRound, 900);
  };
  const miss = cell => {
    if (paused || over) return;
    left -= HIDE_PENALTY * 10; sound("wrong");
    cell.classList.remove("shake"); void cell.offsetWidth; cell.classList.add("shake");
    info.textContent = t("Not there! −{n} seconds", { n: HIDE_PENALTY });
  };
  const timer = setInterval(() => {
    if (paused || over) return;
    left--;
    fill.style.width = `${Math.max(0, left) / (HIDE_SECONDS * 10) * 100}%`;
    if (left <= 0) end(false);
  }, 100);
  function end(won, quit) {
    if (over) return;
    over = true; clearInterval(timer); popupDone = null;
    if (quit) return;
    if (!won) return minigameResult(false, t("Time's up!"), [t("Tip: read the clue, then look for a tiny bug peeking out of the plants.")], hideAndSeek);
    const [pts, lines] = minigameWin("hide");
    minigameResult(true, t("Sharp eyes! You found all {n} bugs! +{pts} points", { n: HIDE_ROUNDS.length, pts }), lines, hideAndSeek);
  }
  startRound();
  openPopup([el("h2", null, `🔎 ${t("Where's the Bug?")}`), clue, grid, bar, info], [["Quit", false]]);
  popupDone = () => end(false, true);
}

// Bug Match: a memory game. Flip two cards; if they show the same bug, they stay up.
function bugMatch() {
  const kinds = shuffle(gameSpecies()).slice(0, MATCH_PAIRS);
  if (kinds.length < 2) return;
  let open = [], matched = 0, tries = 0, busy = false, over = false;
  const grid = el("div", "match-grid"), info = el("p", "arena-info");
  info.setAttribute("aria-live", "polite");
  const show = () => { info.textContent = t("Pairs found: {n} of {total} · Tries: {tries}", { n: matched, total: kinds.length, tries }); };
  for (const s of shuffle([...kinds, ...kinds])) {
    const card = el("button", "match-card"), front = el("span", "match-front"), back = el("span", "match-back");
    card.type = "button";
    card.setAttribute("aria-label", t("Hidden card"));
    back.append(makeOrb());
    front.append(bugArt(s, "bug-emoji"), el("small", null, commonName(s)));
    card.append(back, front);
    card.onclick = async () => {
      if (busy || over || card.classList.contains("flipped")) return;
      card.classList.add("flipped"); card.setAttribute("aria-label", commonName(s)); sound("tick");
      open.push([card, s]);
      if (open.length < 2) return;
      const [[a, sa], [b, sb]] = open;
      open = []; tries++;
      if (sa === sb) {
        a.classList.add("matched"); b.classList.add("matched"); matched++; sound("right"); show();
        if (matched === kinds.length) setTimeout(() => end(), 500);
        return;
      }
      show(); busy = true;
      await wait(850);
      for (const c of [a, b]) { c.classList.remove("flipped"); c.setAttribute("aria-label", t("Hidden card")); }
      busy = false;
    };
    grid.append(card);
  }
  function end(quit) {
    if (over) return;
    over = true; popupDone = null;
    if (quit) return;
    const [pts, lines] = minigameWin("match");
    minigameResult(true, t("You matched all the bugs! +{pts} points", { pts }), [t("It took you {n} tries.", { n: tries }), ...lines], bugMatch);
  }
  show();
  openPopup([el("h2", null, `🃏 ${t("Bug Match")}`), el("p", "muted", t("Flip two cards at a time. Find all the matching bug pairs!")), grid, info], [["Quit", false]]);
  popupDone = () => end(true);
}

// Invasive or Native?: sort 10 bugs. Half are invasive, half belong in Oregon.
function invasiveOrNative() {
  const inv = shuffle(gameSpecies()).slice(0, SORT_ROUNDS / 2)
    .map(s => ({ art: s, name: commonName(s), fact: t(SPECIES_FACTS[s].fact), invasive: true }));
  if (!inv.length) return;
  const nat = shuffle(NATIVE_BUGS).slice(0, SORT_ROUNDS - inv.length).map(b => ({ art: b.name, name: t(b.name), fact: t(b.fact), invasive: false }));
  const rounds = shuffle([...inv, ...nat]);
  let i = 0, right = 0, over = false;
  const card = el("div", "sort-card"), feedback = el("p", "quiz-result"), info = el("p", "arena-info"), buttons = el("div", "battle-moves");
  feedback.setAttribute("aria-live", "polite");
  const yes = el("button", "btn", `🚫 ${t("Invasive")}`), no = el("button", "btn", `🌼 ${t("Native")}`), next = el("button", "btn primary", t("Next"));
  yes.type = no.type = next.type = "button";
  buttons.append(yes, no, next);
  const status = () => { info.textContent = t("Bug {n} of {total} · {right} right", { n: i + 1, total: rounds.length, right }); };
  const showRound = () => {
    const r = rounds[i];
    card.innerHTML = "";
    card.append(bugArt(r.art, "bug-emoji"), el("strong", null, r.name));
    feedback.textContent = ""; yes.disabled = no.disabled = false; next.hidden = true;
    status(); yes.focus();
  };
  const answer = saidInvasive => {
    const r = rounds[i], ok = saidInvasive === r.invasive;
    if (ok) right++;
    sound(ok ? "right" : "wrong");
    yes.disabled = no.disabled = true;
    feedback.textContent = `${ok ? "✅" : "❌"} ${t(r.invasive ? "It's invasive! Catch it and report it." : "It's native! Leave it be.")} ${r.fact}`;
    status(); next.hidden = false; next.focus();
  };
  yes.onclick = () => answer(true);
  no.onclick = () => answer(false);
  next.onclick = () => { i++; if (i >= rounds.length) return end(); showRound(); };
  function end(quit) {
    if (over) return;
    over = true; popupDone = null;
    if (quit) return;
    if (right < SORT_TO_WIN) return minigameResult(false, t("You got {n} of {total} right.", { n: right, total: rounds.length }),
      [t("Get {n} right to win. Read the fact cards in Learn about species, then try again!", { n: SORT_TO_WIN })], invasiveOrNative);
    const [pts, lines] = minigameWin("sort");
    minigameResult(true, t("You got {n} of {total} right! +{pts} points", { n: right, total: rounds.length, pts }), lines, invasiveOrNative);
  }
  openPopup([el("h2", null, `🌼 ${t("Invasive or Native?")}`), card, buttons, feedback, info], [["Quit", false]]);
  popupDone = () => end(true);
  showRound();
}

// Bug Pop: bugs pop out of holes. Tap invasive ones (+1). Tapping a native bug costs 2 points.
function bugPop() {
  const species = gameSpecies();
  if (!species.length) return;
  let score = 0, left = POP_SECONDS * 10, tick = 0, over = false;
  const holes = el("div", "pop-grid"), info = el("p", "arena-info"), bar = el("div", "track"), fill = el("div", "fill");
  bar.append(fill);
  info.setAttribute("aria-live", "polite");
  const show = note => { info.textContent = `${t("Score: {n}", { n: score })} · ${t("Goal: {n}", { n: POP_TO_WIN })}${note ? ` · ${note}` : ""}`; };
  const cells = Array.from({ length: POP_HOLES }, (_, k) => {
    const h = el("button", "pop-hole");
    h.type = "button"; h.setAttribute("aria-label", t("Empty hole"));
    h.onclick = () => tap(k);
    holes.append(h);
    return { h, bug: null, timer: null };
  });
  const hide = k => { const c = cells[k]; c.bug = null; c.h.innerHTML = ""; c.h.className = "pop-hole"; c.h.setAttribute("aria-label", t("Empty hole")); };
  const pop = () => {
    const free = cells.map((c, k) => c.bug ? -1 : k).filter(k => k >= 0);
    if (!free.length) return;
    const k = pickOne(free), c = cells[k];
    const nb = Math.random() < POP_NATIVE_CHANCE ? pickOne(NATIVE_BUGS) : null, s = pickOne(species);
    const bug = nb ? { native: true, art: nb.name, name: t(nb.name) } : { native: false, art: s, name: commonName(s) };
    c.bug = bug;
    c.h.className = "pop-hole up";
    c.h.append(bugArt(bug.art, "bug-emoji"), el("small", null, bug.name));
    c.h.setAttribute("aria-label", bug.name);
    // Bugs stay up a little shorter as the game goes on
    c.timer = setTimeout(() => { if (c.bug === bug) hide(k); }, Math.max(800, 1600 - tick * 3));
  };
  const tap = k => {
    const c = cells[k];
    if (over || !c.bug || c.bug.gone) return;
    clearTimeout(c.timer);
    if (c.bug.native) { score = Math.max(0, score - POP_PENALTY); sound("wrong"); c.h.classList.add("oops"); show(t("That's a native bug! Leave it be.")); }
    else { score++; sound("hit"); c.h.classList.add("bonk"); show(); }
    c.bug = { gone: true };
    setTimeout(() => hide(k), 300);
  };
  const timer = setInterval(() => {
    if (over) return;
    tick++; left--;
    fill.style.width = `${left / (POP_SECONDS * 10) * 100}%`;
    if (tick % 7 === 0 || (tick > 100 && tick % 11 === 0)) pop();
    if (left <= 0) end();
  }, 100);
  function end(quit) {
    if (over) return;
    over = true; clearInterval(timer); cells.forEach(c => clearTimeout(c.timer)); popupDone = null;
    if (quit) return;
    if (score < POP_TO_WIN) return minigameResult(false, t("Time's up! You scored {n}.", { n: score }),
      [t("Get {n} to win. Tap invasive bugs fast, and leave native bugs alone!", { n: POP_TO_WIN })], bugPop);
    const [pts, lines] = minigameWin("pop");
    minigameResult(true, t("You scored {n}! +{pts} points", { n: score, pts }), lines, bugPop);
  }
  show(); pop();
  openPopup([el("h2", null, `🕳️ ${t("Bug Pop")}`), el("p", "muted", t("Tap the invasive bugs when they pop up. Don't tap native bugs, like Pip's family!")), holes, bar, info], [["Quit", false]]);
  popupDone = () => end(true);
}

// ---- read aloud ----
// The browser reads the cutscenes out loud, in the game's language (if the device has that voice).
// Devices often have several voices. The good ones sound like real people ("Natural", "Neural",
// Google, Siri, and so on), and the old ones sound like robots, so we pick the best one we can.
const VOICE_LANG = GAME_LANG_TAGS;   // en-US, es-ES, ... (see assets/game-i18n.js)
// Small changes only. Pitch that's very high or very low is what makes a voice sound robotic.
const VOICE_STYLE = { Pip: { pitch: 1.2, rate: 1.05 }, Squawk: { pitch: 1.3, rate: 1.1 }, Bramble: { pitch: 1.1 }, Thistle: { pitch: .92 }, "Boss Burdock": { pitch: .85, rate: .92 } };
// Characters who get a different voice than Professor Hazel, when the device has more than one good voice
const VOICE_SLOT = { Pip: 1, Bramble: 1, Squawk: 1, Thistle: 2, "Boss Burdock": 2 };
const VOICE_GOOD = /natural|neural|premium|enhanced|online|google|siri|samantha|aria|jenny|guy|libby|sonia|denise|elvira|madhur|swara/i;
const VOICE_BAD = /espeak|compact|robot|novelty|zarvox|trinoids|whisper|bells|bad news|bubbles|cellos|jester|organ|superstar/i;
let voices = [];
if (window.speechSynthesis) {
  voices = speechSynthesis.getVoices();
  // The list often isn't ready when the page opens, so listen for it
  speechSynthesis.addEventListener?.("voiceschanged", () => { voices = speechSynthesis.getVoices(); });
}
function voiceScore(v, lang) {
  const l = v.lang.replace("_", "-").toLowerCase(), want = lang.toLowerCase();
  if (!l.startsWith(want.slice(0, 2))) return -1;           // wrong language
  return (l === want ? 2 : 1) + (VOICE_GOOD.test(v.name) ? 4 : 0) - (VOICE_BAD.test(v.name) ? 5 : 0) + (v.localService ? 0 : 1);
}
function pickVoice(lang, who) {
  const scored = voices.map(v => [v, voiceScore(v, lang)]).filter(x => x[1] >= 0).sort((a, b) => b[1] - a[1]);
  if (!scored.length) return null;
  const best = scored.filter(x => x[1] === scored[0][1]).map(x => x[0]);   // the voices tied for best
  return best[(VOICE_SLOT[who] || 0) % best.length];
}
function speak(text, who) {
  if (!window.speechSynthesis || !loadGame().readAloud) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, "").replace(/…/g, "..."));
  u.lang = VOICE_LANG[gameLang] || "en-US";
  const voice = pickVoice(u.lang, who);
  if (voice) { u.voice = voice; u.lang = voice.lang; }
  const style = VOICE_STYLE[who] || {};
  u.pitch = style.pitch || 1; u.rate = style.rate || 1;
  speechSynthesis.speak(u);
}
const hush = () => window.speechSynthesis?.cancel();

// ---- the certificate ----
function renderCertificate(g) {
  const box = $("certBox"); box.innerHTML = "";
  if (!g.gyms.includes("champion")) return box.append(el("p", "muted", `🔒 ${t("Beat the Oregon Champion to unlock your printable Forest Protector certificate.")}`));
  const b = el("button", "btn primary", `🖨️ ${t("Print your certificate")}`);
  b.type = "button"; b.onclick = showCertificate;
  box.append(b);
}
function showCertificate() {
  const g = loadGame();
  const cert = el("div", "certificate");
  const sign = el("div", "cert-sign");
  sign.append(el("span", null, "👩‍🏫 Professor Hazel"), el("span", null, new Date().toLocaleDateString(langTag())), el("span", null, "🦸 Champion Juniper"));
  cert.append(el("p", "cert-top", "🌲 🦫 🌲"), el("h2", null, t("Forest Protector Certificate")), el("p", null, t("This certificate goes to")),
    el("p", "cert-name", `${trainerLook(g)} ${g.trainer.name || t("Ranger")}`),
    el("p", null, t("for beating all {n} forests, becoming the Oregon Champion, and helping protect Oregon from invasive bugs.", { n: GYMS.length - 1 })),
    el("p", "cert-stats", t("{kinds} kinds of bugs caught · {badges} badges · {pts} points", { kinds: kindsCaught(g), badges: g.badges.length, pts: g.points })),
    sign, el("p", "cert-foot", "Pyinsect · Innvadex"));
  const print = el("button", "btn primary", `🖨️ ${t("Print")}`);
  print.type = "button";
  print.onclick = () => { document.body.classList.add("printing"); window.print(); };
  openPopup([cert, print], [["Close", false]]);
}
addEventListener("afterprint", () => document.body.classList.remove("printing"));

// ---------- version 11: the game's pages (home, challenge, camera) ----------
// The Game screen has its own pages. Their addresses start with #game, so the phone's Back button works:
//   #game                    the game home
//   #game/challenge/<id>     one monthly challenge
//   #game/battles            Battles & Forests
//   #game/badges             Badges
//   #game/camera[/<id>]      the camera (for a challenge, when there's an id)
// assets/flow.js calls route() when the address changes.
const goGame = path => {
  const hash = "#game" + (path ? "/" + path : "");
  if (window.flow) location.hash = hash; else route(path ? path.split("/") : []);
};
let gamePage = null;
function route(sub) {
  const [page, id] = sub || [];
  if (page !== "camera") stopGameCamera();
  if (!sub) return;   // another screen is open
  const pages = { challenge: "gameChallenge", battles: "gameBattles", badges: "gameBadges", learn: "gameLearn" };
  // The camera opens over the page you were on, so the page under it doesn't change
  if (page !== "camera") {
    gamePage = pages[page] ? page : null;
    for (const [p, elId] of Object.entries({ home: "gameHome", ...pages })) $(elId).hidden = p !== (gamePage || "home");
    window.scrollTo(0, 0);
  }
  if (page === "challenge") renderChallenge(id);
  if (page === "camera") openGameCamera(id);
  if (!gamePage && page !== "camera") window.reportsMap?.mini?.("gameMiniMap");
}

// ---- monthly challenges ----
const monthId = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
const monthName = id => { const [y, m] = id.split("-").map(Number); return new Date(y, m - 1, 15).toLocaleDateString(langTag(), { month: "long", year: "numeric" }); };
// Every month's challenges, from the first month to this one (newest first).
// ahead = 1 also makes next month's, for the preview (they can't be started yet).
function monthlyChallenges(ahead = 0) {
  const list = [], now = new Date(), last = new Date(now.getFullYear(), now.getMonth() + ahead, 1);
  let [y, m] = MONTHLY_START, i = 0;
  while (y < last.getFullYear() || (y === last.getFullYear() && m <= last.getMonth() + 1)) {
    for (let k = 0; k < MONTHLY_PER_MONTH; k++) {
      const n = i * MONTHLY_PER_MONTH + k, kind = MONTHLY_KINDS[n % MONTHLY_KINDS.length];
      list.push({ id: `${monthId(y, m)}-${kind.id}`, month: monthId(y, m), kind, shape: SHAPES[n % SHAPES.length] });
    }
    i++; m++;
    if (m > 12) { m = 1; y++; }
  }
  return list.reverse();
}
// Next month's challenges, and the day they start
const comingChallenges = () => { const now = new Date(), next = monthId(now.getFullYear() + (now.getMonth() === 11), (now.getMonth() + 1) % 12 + 1); return monthlyChallenges(1).filter(ch => ch.month === next); };
const startDay = ch => { const [y, m] = ch.month.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString(langTag(), { month: "long", day: "numeric" }); };
const challengeState = (g, ch) => g.monthly[ch.id] || null;
const challengeStatus = (g, ch) => { const st = challengeState(g, ch); return !st ? "new" : st.done ? "done" : "going"; };
const STATUS_NAMES = { done: "Completed", going: "In progress", new: "Not started" };

// Counts something that just happened toward every challenge that has started. Called by progress().
function monthlyProgress(g, ev) {
  const lines = [];
  for (const ch of monthlyChallenges()) {
    const st = challengeState(g, ch);
    if (!st || st.done || !ch.kind.check(ev)) continue;
    if (ch.kind.distinct) { st.kinds = st.kinds || []; if (st.kinds.includes(ev.species)) continue; st.kinds.push(ev.species); }
    st.count++;
    if (st.count >= ch.kind.n) {
      st.done = new Date().toLocaleDateString(langTag()); st.doneAt = new Date().toISOString();
      lines.push(`${ch.kind.emoji} ${t("Monthly challenge done: {name}! Its badge has its color now.", { name: t(ch.kind.name) })}`);
    }
  }
  return lines;
}

// A challenge's badge: no color until it's done
function badgeSlot(ch, done, big) {
  const b = el("span", "badge-slot" + (done ? " done" : "") + (big ? " big" : ""), ch.kind.emoji);
  b.setAttribute("aria-label", done ? t("Badge earned") : t("Badge not earned yet"));
  return b;
}

// The monthly challenges on the game home: grouped by status, as icons or a list
function renderMonthly(g) {
  const list = $("monthlyList"), icons = g.monthlyView !== "list";
  list.innerHTML = "";
  $("monthlyView").textContent = icons ? `☰ ${t("List view")}` : `▦ ${t("Icon view")}`;
  $("monthlyView").setAttribute("aria-label", icons ? t("Show as a list") : t("Show as icons"));
  const all = monthlyChallenges(), coming = comingChallenges();
  for (const status of ["done", "coming", "going", "new"]) {
    const group = status === "coming" ? coming : all.filter(ch => challengeStatus(g, ch) === status);
    if (!group.length) continue;
    list.append(el("h3", "monthly-group", status === "coming"
      ? `🔜 ${t("Coming next month")}` : `${t(STATUS_NAMES[status])} (${group.length})`));
    const box = el("div", (icons ? "monthly-icons" : "monthly-rows") + (status === "coming" ? " coming" : ""));
    for (const ch of group) {
      const st = challengeState(g, ch), item = el("button", "monthly-item");
      item.type = "button";
      item.onclick = () => goGame(`challenge/${ch.id}`);
      const name = el("strong", null, t(ch.kind.name)), when = el("span", "muted", monthName(ch.month));
      if (icons) item.append(badgeSlot(ch, status === "done"), name, when);
      else {
        const info = el("span", "monthly-info"), bar = el("div", "track"), fill = el("div", "fill");
        fill.style.width = `${Math.min(1, (st?.count || 0) / ch.kind.n) * 100}%`; bar.append(fill);
        info.append(name, el("span", "muted", `${t(ch.kind.text, { n: ch.kind.n })} · ${monthName(ch.month)}`), bar);
        item.append(badgeSlot(ch, status === "done"), info, el("span", "monthly-count", status === "coming" ? "🔒" : `${st?.count || 0}/${ch.kind.n}`));
      }
      box.append(item);
    }
    list.append(box);
  }
}

// ---- the challenge page ----
function renderChallenge(id) {
  const page = $("gameChallenge"), ch = monthlyChallenges(1).find(c => c.id === id);
  const soon = comingChallenges().some(c => c.id === id);   // next month's: a preview only
  page.innerHTML = "";
  if (!ch) { goGame(); return; }
  const g = loadGame(), st = challengeState(g, ch), status = challengeStatus(g, ch);
  const top = el("div", "game-top");
  const back = el("a", "btn back-btn", "←"); back.href = "#game"; back.setAttribute("aria-label", t("Back"));
  const brand = el("span", "brand small"), logo = el("img"); logo.src = "assets/favicon.svg"; logo.alt = ""; logo.width = logo.height = 32;
  brand.append(logo, "Pyinsect");
  const gear = el("button", "gear-btn", "⚙️"); gear.type = "button"; gear.dataset.settings = ""; gear.setAttribute("aria-label", t("Settings"));
  top.append(back, brand, gear);
  // The heading, when it was made, and the badge (no color until it's done)
  const head = el("div", "challenge-head"), words = el("div");
  words.append(el("h1", null, t(ch.kind.name)), el("p", "muted", soon ? t("Coming next month") : t("Made in {month}", { month: monthName(ch.month) })));
  head.append(words, badgeSlot(ch, status === "done", true));
  // Connect the bugs to start (or keep going)
  const pad = el("section", "connect");
  const said = soon ? `🔒 ${t("This challenge starts on {date}. Come back then!", { date: startDay(ch) })}`
    : status === "done" ? `✅ ${t("You finished this challenge on {date}!", { date: st.done })}`
    : status === "going" ? t("{count} of {n} done. Connect the bugs to open the camera.", { count: st.count, n: ch.kind.n })
    : t("Connect the bugs in the shape to start the challenge!");
  pad.append(el("p", "connect-say", said));
  if (status === "going") { const bar = el("div", "track"), fill = el("div", "fill"); fill.style.width = `${st.count / ch.kind.n * 100}%`; bar.append(fill); pad.append(bar); }
  if (status !== "done" && !soon) pad.append(connectPad(ch.shape, () => {
    const g = loadGame();
    if (!g.monthly[ch.id]) { g.monthly[ch.id] = { started: new Date().toLocaleDateString(langTag()), count: 0 }; saveGame(g); renderGame(); }
    sound("badge");
    goGame(`camera/${ch.id}`);
  }));
  // What the challenge is
  const about = el("section", "challenge-about");
  about.append(el("h2", null, t(ch.kind.text, { n: ch.kind.n })), el("p", null, t(ch.kind.desc)));
  page.append(top, head, pad, about);
}

// "Connect the bugs": draw a line through the bugs in the shape shown (either direction), or tap
// them one at a time. A wrong bug starts it over.
function connectPad(shape, done) {
  const box = el("div", "connect-pad"), svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 300 300"); svg.setAttribute("aria-hidden", "true");
  const xy = i => [50 + (i % 3) * 100, 50 + Math.floor(i / 3) * 100];
  const line = (pts, cls) => { const pl = document.createElementNS(svg.namespaceURI, "polyline"); pl.setAttribute("points", pts.map(i => xy(i).join(",")).join(" ")); pl.setAttribute("class", cls); svg.append(pl); return pl; };
  line(shape.path, "guide");
  const drawn = line([], "drawn");
  box.append(svg);
  const dots = SHAPE_BUGS.map((bug, i) => {
    const d = el("button", "connect-dot" + (i === shape.path[0] || i === shape.path[shape.path.length - 1] ? " ends" : ""), bug);
    d.type = "button"; d.dataset.i = i;
    d.style.left = `${xy(i)[0] / 3}%`; d.style.top = `${xy(i)[1] / 3}%`;
    d.setAttribute("aria-label", t("Bug {n}", { n: i + 1 }));
    box.append(d);
    return d;
  });
  const hint = el("p", "muted connect-hint", t("Start at a glowing bug and follow the dotted line."));
  let path = [], drawing = false;
  const want = [shape.path, [...shape.path].reverse()];
  const show = () => {
    drawn.setAttribute("points", path.map(i => xy(i).join(",")).join(" "));
    dots.forEach((d, i) => d.classList.toggle("on", path.includes(i)));
  };
  const fits = () => want.some(w => path.every((p, k) => w[k] === p));
  const reset = () => { path = []; show(); };
  const add = i => {
    if (path[path.length - 1] === i) return;
    // Going straight past a bug (like 0 to 2) also connects the one in the middle (1)
    const last = path[path.length - 1];
    if (last != null) { const [ax, ay] = xy(last), [bx, by] = xy(i), mid = SHAPE_BUGS.findIndex((_, k) => { const [mx, my] = xy(k); return mx === (ax + bx) / 2 && my === (ay + by) / 2; }); if (mid >= 0 && mid !== last && mid !== i) path.push(mid); }
    path.push(i);
    if (!fits()) { sound("wrong"); box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake"); hint.textContent = t("Not quite. Follow the dotted line!"); return reset(); }
    sound("tick"); show();
    if (path.length === shape.path.length) { box.classList.add("connected"); drawing = false; setTimeout(done, 600); }
  };
  const dotAt = (x, y) => { const e = document.elementFromPoint(x, y)?.closest?.(".connect-dot"); return e && box.contains(e) ? +e.dataset.i : null; };
  box.addEventListener("pointerdown", e => { const i = dotAt(e.clientX, e.clientY); if (i == null) return; e.preventDefault(); drawing = true; add(i); });
  box.addEventListener("pointermove", e => { if (!drawing) return; const i = dotAt(e.clientX, e.clientY); if (i != null) add(i); });
  for (const ev of ["pointerup", "pointercancel"]) box.addEventListener(ev, () => { drawing = false; });
  // Keyboard: tab to a bug and press Enter, one at a time
  dots.forEach((d, i) => d.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); add(i); } }));
  const wrap = el("div", "connect-wrap");
  wrap.append(box, hint);
  return wrap;
}

// ---- the camera ----
// It shows the species it sees at the top (it guesses every 1.5 seconds), and takes or picks photos.
// Invasive bugs start a catch and are reported, like before. Other bugs give protector points.
let camStream = null, camFacing = "environment", camTimer = null, camGuessing = false, camChallenge = null, camTorch = false;
let camQuietUntil = 0;   // the live guess waits, so a photo's result stays on screen
async function openGameCamera(challengeId) {
  camChallenge = monthlyChallenges().find(c => c.id === challengeId) || null;   // (next month's previews aren't in this list)
  $("gameCamera").hidden = false;
  document.body.classList.add("camera-open");
  renderCameraChallenge();
  window.reportsMap?.mini?.("gcMiniMap", { you: true });
  await startGameStream();
  clearInterval(camTimer);
  camTimer = setInterval(liveGuess, LIVE_EVERY);
}
function renderCameraChallenge() {
  const box = $("gcChallenge"), g = loadGame();
  box.hidden = !camChallenge;
  if (!camChallenge) return;
  const st = challengeState(g, camChallenge);
  box.textContent = `${camChallenge.kind.emoji} ${t(camChallenge.kind.name)} · ${st?.count || 0}/${camChallenge.kind.n}`;
}
async function startGameStream() {
  camStream?.getTracks().forEach(tr => tr.stop());
  camStream = null; camTorch = false;
  const video = $("gameVideo"), say = $("gcSpecies");
  say.textContent = t("Starting the camera…");
  $("gcShoot").disabled = true;
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: camFacing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    if ($("gameCamera").hidden) { camStream.getTracks().forEach(tr => tr.stop()); camStream = null; return; }   // closed while starting
    video.srcObject = camStream;
    await video.play().catch(() => {});
    const track = camStream.getVideoTracks()[0], caps = track.getCapabilities?.() || {};
    $("gcFlash").hidden = !caps.torch;   // only phones that allow it
    $("gcFlash").setAttribute("aria-pressed", "false");
    const cams = (await navigator.mediaDevices.enumerateDevices().catch(() => [])).filter(d => d.kind === "videoinput");
    $("gcFlip").hidden = cams.length < 2;
    $("gcShoot").disabled = false;
    say.textContent = t("Point the camera at a bug.");
  } catch {
    say.textContent = t("The camera is off. You can still select images.");
    $("gcFlash").hidden = $("gcFlip").hidden = true;
  }
}
function stopGameCamera() {
  clearInterval(camTimer); camTimer = null;
  camStream?.getTracks().forEach(tr => tr.stop());
  camStream = null;
  if ($("gameCamera")) $("gameCamera").hidden = true;
  document.body.classList.remove("camera-open");
}
// Leaves the camera: back to the challenge it came from, or the game home
// Invasive bugs, and damage that invasive bugs leave (like ash borer holes), start a catch
const gameInvasive = species => INVASIVE.has(species) || !!(typeof damagedTree === "function" && damagedTree(species));
const closeGameCamera = () => goGame(camChallenge ? `challenge/${camChallenge.id}` : "");

// The picture in the camera right now, on a canvas (smaller for the live guess)
function grabFrame(maxSide) {
  const v = $("gameVideo"), s = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s);
  c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
  return c;
}
async function liveGuess() {
  const v = $("gameVideo");
  if (camGuessing || Date.now() < camQuietUntil || !camStream || !v.videoWidth || typeof identify !== "function") return;
  camGuessing = true;
  try {
    await modelReady;
    const { top3, verdict } = await identify(grabFrame(640));
    if ($("gameCamera").hidden || Date.now() < camQuietUntil) return;
    const best = top3[0], s = SPECIES_ALIAS[best.species] || best.species;
    $("gcSpecies").textContent = verdict !== "ok" ? t("Looking for a bug…")
      : `${SPECIES_FACTS[s]?.emoji || "🐞"} ${commonName(best.species)} · ${Math.round(best.confidence)}%` + (gameInvasive(best.species) ? ` · 🚫 ${t("Invasive")}` : ` · 🌼 ${t("Native")}`);
  } catch {} finally { camGuessing = false; }
}
// A photo from the camera or from "select images"
async function gamePhoto(file, fromCamera) {
  const say = $("gcSpecies");
  say.textContent = t("Checking your photo…");
  camQuietUntil = Infinity;
  while (camGuessing) await wait(50);   // one guess at a time
  try {
    await modelReady;
    const { top3, verdict } = await identify(file);
    const best = top3[0], s = SPECIES_ALIAS[best.species] || best.species;
    if (verdict !== "ok") { say.textContent = t("I couldn't tell what that is. Try getting closer!"); sound("wrong"); return; }
    // AI-made pictures don't count in the game (photos from the camera are real)
    if (!fromCamera && typeof checkAI === "function") {
      const ai = await checkAI(file).catch(() => ({ verdict: "unknown" }));
      if (ai.verdict === "ai") { fakePhoto(); say.textContent = t("Point the camera at a bug."); return; }
    }
    if (!gameInvasive(best.species)) {
      native(best.species, best.confidence);
      say.textContent = `🌼 ${t("{bug} isn't invasive. Leave it be!", { bug: commonName(best.species) })}`;
      renderCameraChallenge();
      return;
    }
    gameReport(file, best, top3);
    const url = URL.createObjectURL(file);
    closeGameCamera();
    encounter(s, url);
  } catch {
    say.textContent = t("Something went wrong. Try again!");
  } finally {
    camQuietUntil = Date.now() + 4000;   // keep the result on screen for 4 seconds
  }
}
// Reports an invasive bug (or tree damage) from the game's camera, the same way the app does
async function gameReport(file, best, top3) {
  if (typeof queueReport !== "function" || typeof RELAY_URL === "undefined" || !RELAY_URL) return;
  try {
    const bmp = await createImageBitmap(file), tree = damagedTree(best.species);
    const r = tree ? buildInfestedReport(bmp, tree, top3) : buildReport(bmp, best.species, best.confidence, top3);
    bmp.close?.();
    const area = await getArea();
    if (area) r.report.spot = area;
    queueReport(r, `${t("From the game")} · ${area ? "📍" : t("no area")}`);
  } catch {}
}

// ---- settings ----
// One pop-up for every ⚙️ button: language, sound, big text, read aloud, how to play, the story
function openSettings() {
  const g = loadGame(), items = [];
  const pick = el("label", "lang-pick"), sel = el("select");
  for (const [code, label] of Object.entries(GAME_LANGS)) { const o = el("option", null, label); o.value = code; sel.append(o); }
  sel.value = gameLang;
  sel.onchange = () => { const g = loadGame(); g.lang = sel.value; saveGame(g); renderGame(); refreshPage(); openSettings(); };
  pick.append("🌐 ", sel);
  const toggle = (on, onText, offText, flip) => {
    const b = el("button", "btn", on ? onText : offText); b.type = "button"; b.setAttribute("aria-pressed", on);
    b.onclick = () => { const g = loadGame(); flip(g); saveGame(g); renderGame(); openSettings(); };
    return b;
  };
  items.push(pick,
    toggle(!g.muted, `🔊 ${t("Sound on")}`, `🔇 ${t("Sound off")}`, g => { g.muted = !g.muted; }),
    toggle(!!g.bigText, `🔠 ${t("Big text")} ✓`, `🔠 ${t("Big text")}`, g => { g.bigText = !g.bigText; }));
  if (window.speechSynthesis) items.push(toggle(!!g.readAloud, `🗣️ ${t("Read aloud")} ✓`, `🗣️ ${t("Read aloud")}`, g => { g.readAloud = !g.readAloud; if (!g.readAloud) hush(); }));
  const action = (text, fn) => { const b = el("button", "btn", text); b.type = "button"; b.onclick = () => { closePopup(); fn(); }; return b; };
  items.push(action(`✏️ ${t("Your trainer card")}`, () => editTrainer(false)), action(`❓ ${t("How to play")}`, showInstructions));
  const box = el("div", "settings-list");
  box.append(...items);
  openPopup([el("h2", null, `⚙️ ${t("Settings")}`), box], [["Close", true]]);
}
// Draws the game page that's open again (after the language changes)
function refreshPage() {
  if (gamePage === "challenge") renderChallenge(location.hash.split("/")[2]);
  if (!$("gameCamera").hidden) renderCameraChallenge();
}

// ---- the game home ----
// The cutscenes under the map: How to play, then every story cutscene you've unlocked
function renderScenes(g) {
  const list = $("sceneList");
  list.innerHTML = "";
  for (const sc of [{ name: `❓ ${t("How to play")}`, slides: HOW_TO_PLAY }, ...storyScenes(g)]) {
    const [emoji, ...words] = sc.name.split(" ");
    const b = el("button", "scene-card");
    b.type = "button";
    b.append(el("span", "scene-emoji", emoji), el("strong", null, words.join(" ")), el("span", "scene-play", "▶"));
    b.onclick = () => cutscene(sc.slides);
    list.append(b);
  }
  $("sceneMore").textContent = t("Keep playing to unlock more of the story!");
}
function renderHome(g) {
  const next = GYMS.find(gy => gymOpen(g, gy) && !g.gyms.includes(gy.id));
  $("battlesSub").textContent = !kindsCaught(g) ? t("Catch a bug to start battling")
    : next ? t("Next: {leader}", { leader: next.leader }) : t("All forests beaten!");
  $("badgesSub").textContent = t("{n} badges · {rank}", { n: g.badges.length, rank: t(rankOf(g.points)[2]) });
  $("dexCount").textContent = t("{n} of {total} caught", { n: kindsCaught(g), total: gameSpecies().length });
  renderMonthly(g);
  renderScenes(g);
  // The challenge page shows progress too, so draw it again if it's open
  if (gamePage === "challenge") renderChallenge(location.hash.split("/")[2]);
}

// ---------- wiring ----------
// Every ⚙️ button opens the settings
document.addEventListener("click", e => { if (e.target.closest("[data-settings]")) openSettings(); });
$("gameCameraBtn").onclick = () => goGame("camera");
$("battlesTile").onclick = () => goGame("battles");
$("badgesTile").onclick = () => goGame("badges");
$("learnTile").onclick = () => goGame("learn");
$("monthlyView").onclick = () => { const g = loadGame(); g.monthlyView = g.monthlyView === "list" ? "icons" : "list"; saveGame(g); renderGame(); };
$("gcClose").onclick = closeGameCamera;
$("gcShoot").onclick = () => {
  if (!camStream) return;
  const c = grabFrame(4096);
  sound("click");
  c.toBlob(blob => blob && gamePhoto(blob, true), "image/jpeg", 0.92);
};
$("gcPick").onchange = async e => { for (const f of [...e.target.files]) await gamePhoto(f, false); e.target.value = ""; };
$("gcFlip").onclick = () => { camFacing = camFacing === "environment" ? "user" : "environment"; startGameStream(); };
$("gcFlash").onclick = async () => {
  const track = camStream?.getVideoTracks()[0];
  if (!track) return;
  try { await track.applyConstraints({ advanced: [{ torch: !camTorch }] }); camTorch = !camTorch; $("gcFlash").setAttribute("aria-pressed", camTorch); } catch {}
};
$("gameCamera").addEventListener("keydown", e => { if (e.key === "Escape" && $("gamePopup").hidden) closeGameCamera(); });
$("buddyBtn").onclick = showBuddy;
$("dailyGameBtn").onclick = () => MINIGAME_PLAY[dailyGame().id]();
// Night starts and ends while you play, so check the clock every minute
setInterval(() => renderWorld(loadGame()), 60000);
$("gamePopup").addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); closePopup(); } });
renderGame();
$("trainerBtn").onclick = () => editTrainer(false);
// The first time you open the Game screen: a short intro, then pick a nickname.
// assets/flow.js calls this when the Game screen opens (so it doesn't cover the Home screen).
function firstHowTo() {
  const g = loadGame();
  if (g.seenIntro) return;
  g.seenIntro = true; g.seenHowTo = true; saveGame(g);
  cutscene(INTRO_SHORT).then(() => g.trainer.name ? null : editTrainer(true));
}
if (!$("screen-game")) firstHowTo();

window.Innvadex = { encounter, native, fakePhoto, firstHowTo, closePopup, route };
