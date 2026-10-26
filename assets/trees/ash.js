// Tree check settings for ash trees: the questions, help pictures, and words people see.
// The code that shows the Detect steps is assets/flow.js. (The questions below are the damage
// signs people can mark on their photos, and older pages still send them.)
//
// To add another tree: copy this file (like assets/trees/oak.js), change the words and
// pictures, and add a <script> line for it in index.html next to this one.
// Pictures are drawn with SVG (shapes written as code), so we don't need anyone's permission
// to use them. You can swap in your own photo with: picture: '<img src="assets/trees/my-photo.png" alt="...">'
// (use .png or .svg: scripts/check.js refuses .jpg files, so report photos never get saved here by mistake)
window.PYINSECT_TREES = window.PYINSECT_TREES || [];
window.PYINSECT_TREES.push({
  id: "ash",
  name: "ash tree",
  pest: "emerald ash borer",
  start: {
    title: "Help me check my ash tree",
    text: "Not sure if your ash tree is sick? Answer two quick questions, and we'll help you check.",
  },
  howToTell: "Ash trees have leaves made of 5 to 11 small leaflets on one stem. Branches grow in pairs, " +
    "right across from each other. Older ash trees have bark with a diamond pattern.",
  // Real photos, shown with howToTell. These are Oregon ash (Fraxinus latifolia) in Hillsboro, Oregon.
  // License CC BY 2.0: we must show the credit and license (photoCredit), and say we changed them
  // (we made them smaller). Keep the credit if you keep the photos.
  howToTellPhotos: [
    { src: "assets/trees/ash-leaves.jpg", label: "Ash leaf and tree",
      alt: "An ash leaf against the sky: 7 leaflets on one stem, in pairs with one at the tip, and a whole ash tree behind it" },
    { src: "assets/trees/ash-bark.jpg", label: "Ash trunk and bark",
      alt: "The trunk of a big Oregon ash tree with rough bark in crisscross ridges, next to a dirt path" },
  ],
  photoCredit: {
    text: "Photos: born1945, Hillsboro, Oregon (made smaller)",
    links: [
      { text: "leaf photo", url: "https://commons.wikimedia.org/wiki/File:Oregon_Ash,_Oregon_03.jpg" },
      { text: "trunk photo", url: "https://commons.wikimedia.org/wiki/File:Oregon_Ash,_Oregon_04.jpg" },
      { text: "CC BY 2.0", url: "https://creativecommons.org/licenses/by/2.0/" },
    ],
  },
  // Shown with howToTell, under the photos. Three panels: a leaf, the branches, and the bark.
  howToTellPicture: `<svg viewBox="0 0 480 190" role="img" aria-label="Drawings of how to spot an ash tree: a leaf made of 7 leaflets on one stem, branches growing in pairs across from each other, and bark with a diamond pattern">
    <defs>
      <pattern id="ashBarkDiamonds" width="24" height="40" patternUnits="userSpaceOnUse">
        <path d="M0 0 L12 20 L0 40 M24 0 L12 20 L24 40" stroke="#5e4630" stroke-width="4" fill="none"/>
      </pattern>
    </defs>
    <g font-size="14" font-weight="600" text-anchor="middle">
      <rect x="4" y="4" width="148" height="182" rx="12" fill="#eef3e6"/>
      <line x1="78" y1="150" x2="78" y2="22" stroke="#4a6b3a" stroke-width="3" stroke-linecap="round"/>
      <g fill="#6a9a52" stroke="#4a6b3a" stroke-width="1.5">
        <ellipse cx="54" cy="125" rx="22" ry="9" transform="rotate(25 54 125)"/><ellipse cx="102" cy="125" rx="22" ry="9" transform="rotate(-25 102 125)"/>
        <ellipse cx="54" cy="95" rx="22" ry="9" transform="rotate(25 54 95)"/><ellipse cx="102" cy="95" rx="22" ry="9" transform="rotate(-25 102 95)"/>
        <ellipse cx="54" cy="65" rx="22" ry="9" transform="rotate(25 54 65)"/><ellipse cx="102" cy="65" rx="22" ry="9" transform="rotate(-25 102 65)"/>
        <ellipse cx="78" cy="32" rx="9" ry="21"/>
      </g>
      <text x="78" y="174" fill="#2d3b27">5–11 leaflets</text>

      <rect x="166" y="4" width="148" height="182" rx="12" fill="#eef3e6"/>
      <g stroke="#6b4f36" stroke-width="5" stroke-linecap="round" fill="none">
        <path d="M240 152 V20"/>
        <path d="M240 120 L200 88 M240 120 L280 88"/><path d="M240 76 L208 50 M240 76 L272 50"/>
      </g>
      <g fill="#6a9a52"><circle cx="198" cy="86" r="8"/><circle cx="282" cy="86" r="8"/><circle cx="206" cy="48" r="7"/><circle cx="274" cy="48" r="7"/><circle cx="240" cy="18" r="6"/></g>
      <text x="240" y="174" fill="#2d3b27">Branches in pairs</text>

      <rect x="328" y="4" width="148" height="182" rx="12" fill="#8a6a4a"/>
      <rect x="328" y="4" width="148" height="150" rx="12" fill="url(#ashBarkDiamonds)"/>
      <rect x="328" y="154" width="148" height="32" rx="12" fill="#5e4630"/>
      <text x="402" y="174" fill="#fff">Diamond bark</text>
    </g>
  </svg>`,
  // Asked in order. "Yes" to any question goes to the photo step. "No" goes to the next question,
  // and "No" to the last question goes to the healthy page. yes / no = the words on the two
  // answer buttons (say what they answer, so they can't be mixed up with other help on the page).
  questions: [
    {
      id: "holes",
      yes: "Yes, I see holes",
      no: "No holes",
      // The dash in "D-shaped" on the next two lines is a special one that never splits across two lines.
      sign: "D‑shaped holes",
      question: "Do you see any D‑shaped holes in the bark?",
      // Real photo: U.S. Fish and Wildlife Service, public domain (free to use; we credit it anyway)
      photos: [
        { src: "assets/trees/ash-exit-hole-oregon.jpg", label: "A real D-shaped hole in an Oregon tree, 2022",
          alt: "Close-up of gray tree bark with one small hole: round on top and flat on the bottom, like the letter D on its side" },
      ],
      photoCredit: {
        text: "Photo: Tom Brumbelow, U.S. Fish and Wildlife Service (public domain, made smaller)",
        links: [{ text: "photo", url: "https://commons.wikimedia.org/wiki/File:Emerald_ash_borer_hole_(52484864986).jpg" }],
      },
      help: "Look for tiny holes shaped like the letter D, about the size of a pea (3 to 4 mm). " +
        "Adult emerald ash borers chew them when they come out of the tree.",
      picture: `<svg viewBox="0 0 320 180" role="img" aria-label="Drawing of tree bark with three small D-shaped holes">
        <rect width="320" height="180" rx="14" fill="#8a6a4a"/>
        <g stroke="#5e4630" stroke-width="5" stroke-linecap="round" fill="none">
          <path d="M30 0 C40 60 22 120 34 180"/><path d="M95 0 C86 70 104 120 92 180"/>
          <path d="M160 0 C170 50 150 130 162 180"/><path d="M228 0 C218 60 238 110 226 180"/>
          <path d="M292 0 C300 70 284 130 296 180"/>
        </g>
        <g fill="#24170c" stroke="#d9c3a5" stroke-width="2">
          <path d="M120 52 v26 a13 13 0 0 0 0 -26 z"/>
          <path d="M190 104 v22 a11 11 0 0 0 0 -22 z"/>
          <path d="M58 118 v20 a10 10 0 0 0 0 -20 z"/>
        </g>
      </svg>`,
    },
    {
      id: "galleries",
      yes: "Yes, I see lines",
      no: "No lines",
      sign: "wavy lines (galleries)",
      question: "Do you see any wavy lines under the bark?",
      // Real photos (optional, any question can have them). Credit: the Oregon photo is public domain
      // (U.S. Fish and Wildlife Service); the close-up is CC BY 4.0, so we must show the credit and
      // license and say we changed it (made it smaller). Keep the credit if you keep the photos.
      photos: [
        { src: "assets/trees/ash-gallery-oregon.jpg", label: "In Oregon, 2022",
          alt: "Bark peeled off an infested Oregon ash tree, showing one winding S-shaped tunnel dug by an emerald ash borer larva" },
        { src: "assets/trees/ash-galleries-closeup.jpg", label: "Close up",
          alt: "Close-up of wood under peeled bark covered in many winding tunnels, called galleries" },
      ],
      photoCredit: {
        text: "Photos: Tom Brumbelow, U.S. Fish and Wildlife Service (public domain); ImagePerson (made smaller)",
        links: [
          { text: "Oregon photo", url: "https://commons.wikimedia.org/wiki/File:Emerald_ash_borer_path_(52485411368).jpg" },
          { text: "close-up photo", url: "https://commons.wikimedia.org/wiki/File:Trackways_of_Emerald_Ash_Borer_Agrilus_planipennis_1164.jpg" },
          { text: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
        ],
      },
      help: "Where the bark is cracked or peeled off, look for winding S-shaped tunnels, called galleries. " +
        "Young emerald ash borers (larvae) dig them while they eat the inside of the tree.",
      picture: `<svg viewBox="0 0 320 180" role="img" aria-label="Drawing of wood under peeled bark with winding S-shaped tunnels">
        <rect width="320" height="180" rx="14" fill="#8a6a4a"/>
        <rect x="40" y="18" width="240" height="144" rx="22" fill="#e6cfa8"/>
        <g stroke="#9b7650" stroke-width="7" stroke-linecap="round" fill="none">
          <path d="M70 40 c30 0 30 30 60 30 s30 -30 60 -30 s30 30 60 30"/>
          <path d="M64 100 c22 -18 44 18 66 0 s44 18 66 0 s30 -24 54 -6"/>
          <path d="M90 140 c25 10 40 -20 65 -10 s35 25 60 10"/>
        </g>
      </svg>`,
    },
  ],
  // The 3 Detect steps (assets/flow.js): the title, a short tip, the camera button's words, and the
  // carousel photos. Every photo needs its credit: public domain photos are free to use (we credit
  // them anyway), and CC BY photos must show the author and license, and say we changed them (made
  // them smaller). Keep the credit if you keep the photo.
  detect: {
    tree: {
      title: "Check your tree",
      tip: "Is it an ash tree? Look for leaves made of 5 to 11 small leaflets, branches in pairs, and bark with a diamond pattern.",
      button: "Take a picture of the tree",
      photos: [
        { src: "assets/trees/ash-whole-tree.jpg", label: "A whole Oregon ash tree", alt: "A tall, leafy Oregon ash tree with bunches of pale seeds, against a blue sky",
          credit: "born1945, CC BY 2.0, made smaller", url: "https://commons.wikimedia.org/wiki/File:Oregon_Ash,_Oregon_01.jpg" },
        { src: "assets/trees/ash-leaves.jpg", label: "Leaves: 5 to 11 leaflets on one stem", alt: "An ash leaf against the sky: 7 leaflets on one stem",
          credit: "born1945, CC BY 2.0, made smaller", url: "https://commons.wikimedia.org/wiki/File:Oregon_Ash,_Oregon_03.jpg" },
        { src: "assets/trees/ash-bark.jpg", label: "Bark with a diamond pattern", alt: "The trunk of a big Oregon ash tree with rough bark in crisscross ridges",
          credit: "born1945, CC BY 2.0, made smaller", url: "https://commons.wikimedia.org/wiki/File:Oregon_Ash,_Oregon_04.jpg" },
      ],
    },
    damage: {
      title: "Check for signs of damage",
      tip: "Look for small D-shaped holes in the bark (about 1/8 inch wide), and wavy tunnels called galleries where the bark is loose or peeled.",
      button: "Take a picture of the damage",
      photos: [
        { src: "assets/trees/ash-gallery-oregon.jpg", label: "A gallery (wavy tunnel) in Oregon", alt: "Bark peeled off an Oregon ash tree, showing one winding S-shaped tunnel",
          credit: "Tom Brumbelow, U.S. Fish and Wildlife Service, public domain", url: "https://commons.wikimedia.org/wiki/File:Emerald_ash_borer_path_(52485411368).jpg" },
        { src: "assets/trees/ash-exit-holes.jpg", label: "D-shaped holes", alt: "Gray ash bark with four small D-shaped holes next to a fingertip",
          credit: "Daniel Herms, The Ohio State University, Bugwood.org, CC BY 3.0, made smaller", url: "https://commons.wikimedia.org/wiki/File:Eabexithole.jpg" },
        { src: "assets/trees/ash-exit-hole-oregon.jpg", label: "A D-shaped hole in Oregon", alt: "Close-up of gray bark with one small hole, round on top and flat on the bottom",
          credit: "Tom Brumbelow, U.S. Fish and Wildlife Service, public domain", url: "https://commons.wikimedia.org/wiki/File:Emerald_ash_borer_hole_(52484864986).jpg" },
        { src: "assets/trees/ash-galleries-closeup.jpg", label: "Lots of galleries, close up", alt: "Wood under peeled bark covered in many winding tunnels",
          credit: "ImagePerson, CC BY 4.0, made smaller", url: "https://commons.wikimedia.org/wiki/File:Trackways_of_Emerald_Ash_Borer_Agrilus_planipennis_1164.jpg" },
      ],
    },
    bug: {
      title: "Check for an EAB",
      tip: "The emerald ash borer is shiny metallic green, slim, and about 1/2 inch long. Under its wings, its body is purple-red.",
      button: "Take a picture of the EAB",
      photos: [
        { src: "assets/trees/eab-on-bark.jpg", label: "On ash bark", alt: "A slim, shiny green emerald ash borer on pale tree bark",
          credit: "USDA APHIS, public domain", url: "https://commons.wikimedia.org/wiki/File:Plant_Protection_and_Quarantine_(34954841290).jpg" },
        { src: "assets/trees/eab-on-leaf.jpg", label: "On a leaf", alt: "An emerald ash borer on the edge of a green leaf",
          credit: "USDA APHIS, public domain", url: "https://commons.wikimedia.org/wiki/File:Plant_Protection_and_Quarantine_(34954851500).jpg" },
        { src: "assets/trees/eab-wings-open.jpg", label: "Wings open: a purple-red body", alt: "An emerald ash borer from above with its green wing covers open, showing a shiny purple-red body",
          credit: "USDA APHIS, public domain", url: "https://commons.wikimedia.org/wiki/File:EmeraldAshBorerdorsal.jpg" },
        { src: "assets/trees/eab-top.jpg", label: "Real size: about 1/2 inch long", alt: "An emerald ash borer on a white table",
          credit: "Shenandoah National Park, public domain", url: "https://commons.wikimedia.org/wiki/File:Emerald_Ash_Borer_(45568489611).jpg" },
      ],
    },
  },
  photo: {
    title: "Take a close photo",
    text: "Get close to what you saw, so it fills most of the photo. After you take it, you can zoom in on it.",
  },
  healthy: {
    title: "Your tree looks healthy",
    text: "We didn't find the signs of the emerald ash borer. Great news! Check your tree again " +
      "every few months, especially in late spring and summer, when the beetles come out.",
  },
  worried: "Still worried? Send us a picture anyway",
  // The bug model's class for photos of emerald ash borer damage. When the AI finds it (on the main
  // page or in this tree check), the tree is infested: the card shows the warning and tips below, and
  // the team gets an "Infested tree" report right away. Must match INFESTED in relay/worker.js.
  damageClass: "agrilus_planipennis_damage",
  // Calm words on purpose: we tell them what we saw and what helps, without scaring anyone
  infested: {
    title: "Your ash tree may have the emerald ash borer",
    text: "This looks like emerald ash borer damage. Your report helps experts find and care for sick trees. " +
      "Here's what you can do next.",
    tips: [
      "Tell a grown-up who looks after the tree.",
      "Don't move the tree's wood, branches, or firewood to another place. That's how the beetles spread.",
      "We pass your report on to the experts. If you'd like to contact them yourself, use the Oregon Invasive Species Hotline (link below).",
      "Ask a certified arborist (a tree doctor) to look at it. If the tree is still mostly healthy, " +
        "a treatment can often save it.",
      "If the tree is badly damaged, have a professional take it down. Dead ash trees break easily and can fall.",
      "Tell neighbors with ash trees to check theirs too.",
    ],
    links: [{ text: "Oregon Invasive Species Hotline", url: "https://oregoninvasiveshotline.org/" }],
  },
});
