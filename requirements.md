# Requirements

This is our list of new features: who each one is for, why they need it, and how we decided to
build it. We add a feature here **before** we start building it.

To add one, ask your AI helper to help you plan a new feature. It will use
`skills/shared/plan-a-feature/SKILL.md`.

**Status:** Planned → Building → Done

---

## Innvadex: a bug-catching game

- **Status:** Building
- **Asked by:** Aadit, 2026-10-11
- **Who it's for:** Everyday people, kids or adults.
- **Problem:** They just want to have fun by playing a game.
- **Why it matters:** When you spot an invasive species, it gets reported, so groups that track
  invasive species (like the USDA, ODA, ODFW, or ODF) know where to place traps.
- **Our idea (first version):** Like Pokémon Go, but the creatures are invasive species.
  - Snap a photo of an invasive bug, then play a quick **minigame** to catch it.
  - Caught bugs go into your **Innvadex** with points, a **rarity** level (more harmful = rarer),
    and a **fact card** that says why it's a problem and what to do if you see one.
  - Earn **badges**, like "First Catch!".
  - An **Instructions** menu that explains how to play.
  - A **Learn about species** page with every invasive bug, even ones you haven't caught yet.
  - Everything saves on your own device. No accounts, and reports still stay private.
- **Version 2 (Building):**
  - **Battles against AI trainers:** your caught bugs are your team. Use Tackle or a special
    move (stronger, but it can miss). 8 trainers, from Easy to Hard. Harder trainers are
    smarter: they finish you off with a sure hit and save hurt bugs by switching. Trainers
    talk before, during, and after battles.
  - **Forests as gyms:** Forest Park, Tillamook, Willamette, and Mount Hood. Each one opens when
    you've caught enough kinds of bugs, and beating it earns a gym badge.
  - **Daily challenge:** a new challenge every day for bonus points.
  - **Protector points:** find a bug that isn't invasive, leave it be, and earn points.
  - **Real photos only:** photos that look AI-made don't count in the game.
- **Other ideas we talked about:**
  - Battles against real players: needs a server, accounts, and safety rules for kids. We chose
    AI trainers instead.
- **Done when:**
  - [ ] Upload a photo of an invasive bug, win the minigame, and it shows up in the Innvadex with
        points and a fact card.
  - [ ] Reload the page, and your Innvadex and badges are still there.
  - [ ] Catch your first bug, and you get the "First Catch!" badge.
  - [ ] The Instructions menu opens and explains how to play.
  - [ ] The Learn about species page lists every invasive bug with a fact card.
  - [ ] Version 2: beat a trainer in a battle and get points and the "Battle Buddy" badge.
  - [ ] Version 2: a forest gym stays locked until you've caught enough kinds of bugs.
  - [ ] Version 2: finish today's challenge and it says "Done! Come back tomorrow."
  - [ ] Version 2: a photo of a bug that isn't invasive gives protector points.
  - [ ] Version 2: an AI-made photo shows "doesn't count in the game".

## Innvadex version 3: map, evolution, quiz, sounds, ranks, and shop

- **Status:** Building
- **Asked by:** Aadit, 2026-10-11
- **Who it's for:** Everyday people, kids or adults, who play the Innvadex game.
- **Problem:** They want more things to do in the game, so it stays fun.
- **Why it matters:** The longer people play, the more invasive bugs get found and reported,
  and the more they learn about them.
- **Our idea:**
  - **Catch map:** a map of where you caught each bug. It starts **off**. You have to turn it on,
    and the browser asks first. Spots are saved only on your device, rounded to about a city
    block.
  - **Bug evolution:** catch the same kind of bug 3 times and it levels up (up to level 3).
    Higher levels are stronger in battles.
  - **Bug quiz:** quick questions about the bugs. Right answers earn points (up to 5 a day).
  - **Sounds:** sounds for catching, battles, and badges, made by the browser (no sound files),
    with a mute button.
  - **Ranks:** Rookie → Explorer → Ranger → Bug Hero → Forest Guardian → Invasive Legend.
  - **Item shop:** spend **coins** (you earn one coin for every point) on items like a Super Net.
    Spending coins never lowers your points or rank.
- **Other ideas we talked about:** none yet.
- **Done when:**
  - [ ] Turn on the catch map, catch a bug, and it shows up on the map.
  - [ ] Catch the same bug 3 times and it says it leveled up.
  - [ ] Answer a quiz question right and get points.
  - [ ] Sounds play, and the mute button stops them.
  - [ ] Your rank goes up when you get enough points.
  - [ ] Buy a Super Net in the shop, and the next minigame has more time.

## Camera zoom and crop

- **Status:** Building
- **Asked by:** Eshan, 2026-10-12
- **Who it's for:** Anyone who takes or picks a photo of a bug or tree damage, new or returning.
- **Problem or need:** They can't zoom in on a small bug or a hole in the bark. The whole photo
  gets checked, so the bug is only a tiny part of it.
- **Why they have it:** The camera in the app shows the whole view with no zoom. Our AI shrinks
  the whole photo to a small square, so a small bug turns into a few dots and the AI guesses worse.
- **Our idea:**
  - **Zoom while taking the photo:** pinch the screen or use a slider. Use the camera's real zoom
    when the phone allows it. If it doesn't (like many iPhones), zoom by cutting out the middle
    of the picture (digital zoom).
  - **Tap to focus** on phones that allow it. On other phones, tapping does nothing and nothing
    breaks.
  - **Zoom in after the photo:** the photo shows with a box. Pinch or drag the box around the
    bug or damage, then tap **Check it**. This works for picked photos too.
  - **Check it** is ready right away, so people who don't want to zoom still need just one tap.
  - **Retake** goes back to the camera.
  - Best practices: big buttons that are easy to tap, works with touch, mouse, and keyboard,
    can't zoom so far that the photo is a blur, the original photo is never changed, and phones
    without zoom still work like today.
- **Other ideas we talked about:**
  - Only zoom after the photo: doesn't help when the bug is far away.
  - Only the camera's real zoom: doesn't work on many iPhones.
- **User flow:**
  1. Tap **Take photo**. The camera opens.
  2. Pinch or slide to zoom in. Tap the bug to focus (if the phone allows it).
  3. Tap the shutter button.
  4. The photo shows with a box around it. Drag or pinch the box around the bug, or leave it.
  5. Tap **Check it**. The app checks only what's in the box.
  6. Photo not good? Tap **Retake** to go back to step 2.
  - Picked a photo instead? Start at step 4.
- **Done when:**
  - [ ] On an Android phone, the zoom slider zooms the camera.
  - [ ] On an iPhone, zoom still works (digital zoom).
  - [ ] Draw a box around a bug, tap **Check it**, and the result shows the zoomed-in photo.
  - [ ] Tap **Check it** without moving the box, and the whole photo is checked, like today.

## Ash tree check

- **Status:** Building
- **Asked by:** Eshan, 2026-10-12
- **Who it's for:**
  - **New users:** people who care for their backyard and have an ash tree. They don't know if
    their tree is sick or in danger, and they're using the app for the first time.
  - **Returning users:** people who already know there's a problem and just want to report it.
  - Also nature clubs and anyone who cares for nature.
- **Problem or need:** New users want to know if they should worry and what to do next.
  Returning users want to report fast. And anyone can send a photo that isn't about nature at
  all, and the app still names a bug.
- **Why they have it:** The signs of the emerald ash borer are hard to spot: D-shaped holes in
  the bark and wavy tunnels (galleries) under it. Most people don't know to look for them. Our
  bug AI only knows bugs, so it always picks a bug, even for a photo of a dog.
- **Our idea:**
  - **Home page:** two equal choices at the top:
    - 📷 **Report a bug or damage**: the photo button like today, one tap. For returning users.
    - 🌳 **Help me check my ash tree**: starts the questions. For new users.
  - **Questions:** "Do you see any D-shaped holes?" (with a help picture). Yes → take a picture.
    No → "Do you see any wavy lines (galleries)?" Yes → take a picture. No → "Your tree looks
    healthy" with a **Still worried? Send us a picture anyway** button.
  - Every question page has **Skip, just take a picture**, so nobody gets stuck.
  - **Photo check:** a second, general AI model checks if the photo is about nature (a tree,
    bark, leaves, a bug, soil). We give it its labels as words, so we can change them without
    training it. A grown-up must okay adding this model to `model/`.
  - **Not about nature:** say "We couldn't tell what this is. Try a closer photo of the bug or
    the bark." Never say "nothing to worry about", because the app doesn't actually know.
  - **Keeping those photos:** ask "Can we keep this photo to help train our app?" We keep it only
    if they tap Yes. We never keep a photo that shows a person.
  - **Reports (built):** every photo from the tree check is sent to our team as a "tree check"
    report, because the person asked us to look. If they said yes to holes or lines, it's called
    "Possible emerald ash borer damage". If they were only still worried, it's "Ash tree to check".
    The bug AI's guesses go along for the team but aren't shown to the person, because on a photo
    of bark the bug AI just names whichever bug looks closest. Then the page says "Report made,
    thank you! 🙂". AI-made photos are still never reported. The relay accepts these reports and
    makes their names itself, so a grown-up needs to redeploy the relay.
  - **Ash trees only for now.** The questions, help pictures, and messages live in one settings
    file (`assets/trees/ash.js`), so the team can add other trees later without changing the
    code. A teammate is training a tree and damage AI that can plug in here later.
  - The Innvadex game stays below the tree check for now.
- **Other ideas we talked about:**
  - Photo first, with questions only when the AI sees an ash tree: we don't have a tree AI yet.
    A teammate is working on it.
  - Train our own AI to spot holes and galleries now: needs hundreds of photos. Saved for later.
  - Trust the answers and skip the general AI: then we can't tell when a photo isn't about
    nature.
- **User flow:**
  - **New user:**
    1. Opens the app and taps **Help me check my ash tree**.
    2. "Do you see any D-shaped holes in the bark?" (with a help picture). Yes → step 5. No → step 3.
    3. "Do you see any wavy lines (galleries) under the bark?" Yes → step 5. No → step 4.
    4. "Your tree looks healthy." Taps **Still worried? Send us a picture anyway** → step 5.
    5. Takes or picks a photo (with zoom and crop).
    6. The photo is about nature → the report is sent → "Report made, thank you 🙂".
    7. The photo isn't about nature → "We couldn't tell what this is. Try a closer photo."
       **Try again** goes to step 5. The app also asks "Can we keep this photo?" (Yes / No).
  - **Returning user:** taps **Report a bug or damage**, takes or picks a photo, then step 6 or 7.
  - **Getting back:** every page has **Back** and **Start over**.
- **Done when:**
  - [ ] Tap **Help me check my ash tree**, answer No and No, and see "Your tree looks healthy"
        with the **Still worried?** button.
  - [ ] Answer Yes to the D-shaped holes question, and the camera or photo picker opens.
  - [ ] Report a bug from the home page in one tap, like today.
  - [ ] A photo of something that isn't about nature (like a cup) shows "We couldn't tell what
        this is", and it isn't kept unless you tap Yes.
  - [ ] The questions come from `assets/trees/ash.js`, so changing that file changes the questions.

## Reports map

- **Status:** Building
- **Asked by:** Eshan, 2026-10-12 (updated 2026-10-13: show other people's reports, with checking)
- **Who it's for:** Anyone who visits the app, especially biologists who study invasive species,
  nature clubs, and backyard owners.
- **Problem or need:** They want to see where invasive bugs and tree damage have been reported
  by everyone, which reports have been checked by a person, and their own past reports.
- **Why they have it:** Biologists need to know where invasive species are so they can track
  them and place traps. Nature clubs want to help and tell others. Backyard owners want to know
  if something was found near them. Today, reports have no location, nobody but our team can
  see them, and "Your reports" disappears when you close the tab.
- **Our idea:**
  - **Rough area:** a checkbox **📍 Add my rough area to my report (about 1 km)** on the screens
    where the photo is taken and checked (the camera and the "Check it" screen). It's ticked at
    first, people can untick it, and the phone remembers their choice. The browser also asks
    before sharing a location.
  - The location is rounded **on the phone** to about a 1 km square before it's sent, so the
    exact spot never leaves the phone and nobody can find someone's house.
  - **Checking reports:** on the team's password-protected reports page, a team member looks at
    each report and taps **Verify ✓** or **Not a match ✗**. Anyone with the team reports
    password can do this.
  - **Three levels,** so an AI can help later without redoing the map:
    - ⚪ **Not checked yet:** just sent.
    - 🔵 **AI checked:** an AI thinks it's a match. Not built now; only after a grown-up
      approves an AI service.
    - 🟢 **Verified:** a person on our team confirmed it.
    - "Not a match" reports are taken off the public map.
  - **Reports map (public, anyone can see it):** colored squares about 1 km big with a count,
    not pins. Tap one to see what was found there, the month, and how well it was checked.
    Bugs and tree damage both show. **No photos and no exact spots.**
  - **My reports:** the reports sent from this phone, with their check level. When you open the
    app again later, they're still there. They're saved only on this phone. On the map, your
    own reports show in their own color, but only on your phone.
  - The relay gets a public list with only those safe details (what, rough square, month, check
    level). Photos stay private. A grown-up needs to redeploy the relay.
  - The map uses Leaflet, the same map tool as the game's map.
- **Other ideas we talked about:**
  - A pin for each report: could show where someone lives.
  - A map only for our team: biologists and nature clubs need to see it too.
  - Showing only verified reports: we chose to show everything, but clearly marked, so the map
    isn't empty while the team checks.
  - An AI that verifies right away: AI can be wrong, and it would send photos to an AI company
    with a secret key and costs. Saved for later, as the "AI checked" level.
  - A separate password for verifying: one more secret to set up; the team password is enough.
  - A box that starts unticked: the team chose ticked so more reports have an area, and
    people can still untick it.
- **User flow:**
  - **Someone sending a report:**
    1. Take or pick a photo. The camera and the "Check it" screen show the 📍 rough area box,
       already ticked.
    2. When a report is sent, the browser asks for location the first time → Allow → the
       report goes with a rough 1 km square. Untick the box or tap Don't allow → it goes
       without an area (and doesn't show on the map).
  - **A team member checking:**
    1. Open the team reports page and log in with the team password.
    2. Look at a report's photo, then tap **Verify ✓** or **Not a match ✗**. Changed your mind?
       Tap the other one.
  - **Anyone looking at the map:**
    1. Open **Reports map**. See squares in three colors with counts, and a key that explains
       the colors.
    2. Tap a square: "2 Emerald ash borer damage, verified · 1 not checked yet · October 2026".
  - **Coming back later:** open **My reports**. The reports this phone sent are still there,
    each with "Not checked yet", "Verified ✓", or "Not a match".
- **Done when:**
  - [ ] Send a report with the box ticked, and a square shows up on the map near you (marked
        "not checked yet"), but not on your exact spot.
  - [ ] Untick the box, send a report, and it doesn't show up on the map.
  - [ ] Verify it on the team page, and the square on the map turns green ("verified").
  - [ ] Mark one "Not a match", and it disappears from the public map.
  - [ ] Someone on another phone sees the verified report on the map too.
  - [ ] Close the browser, open the app again, and **My reports** still lists your reports with
        their check level.
  - [ ] The map never shows photos or exact spots.

## Team AI check switch

- **Status:** Done
- **Changed:** 2026-10-13, edafawd asked for the AI check to be **on for everyone**, with no switch.
  Now every photo card says "Verified by AI: …". The checker (172 MB) downloads with the first photo
  someone checks, not just for opening the page, and the browser keeps it for later visits.
- **Asked by:** edafawd, 2026-10-13
- **Who it's for:** Our team.
- **Problem or need:** A way to turn on AI checking on the main page.
- **Why they have it:** We test lots of photos on the main page and want to spot AI-made ones right
  away, but the AI checker is big (172 MB), so it should stay off for normal visitors.
- **Our idea:** A hidden switch. It only shows when the site is opened with `?team` at the end of
  the link (or when it's already on). When it's on, every photo card says "Verified by AI:" and what
  the AI checker found, like "AI-made (95%)" or "Real (98%)". It never stops a report, because the
  checker sometimes calls real photos AI-made (about 1 in 5 in our test).
- **Other ideas we talked about:**
  - A switch everyone can see: normal visitors might turn it on and download 172 MB by mistake.
  - An "AI check" button on each photo: more tapping when we test lots of photos.
  - Not reporting AI-made photos: some real finds would be lost, because the checker makes mistakes.
- **User flow:**
  1. A team member opens `https://wizkidzai.github.io/Pyinsect-Site/?team`.
  2. A "Team: AI check" switch shows near the top. They tick it, and their device remembers it.
  3. The first time, the AI checker downloads (172 MB) and shows how far along it is.
  4. They add a photo like normal. The card says "Verified by AI: AI-made (95%)" or "Verified by AI: Real (98%)".
  5. To stop, they untick the switch. Visitors without `?team` never see the switch.
- **Done when:**
  - [x] Without `?team`, there's no switch and nothing extra downloads.
  - [x] With `?team`, tick the switch, add a photo, and the card says "Verified by AI: …".
  - [x] Reload the page with the switch ticked, and it's still on.
  - [x] On for everyone: open the normal link (no `?team`), add a photo, and the card says "Verified by AI: …".
  - [x] On for everyone: just opening the page doesn't download the AI checker.

## Pyinsect 2.8 Oregon model

- **Asked by:** edafawd, 2026-10-16
- **Who it's for:** Everyone who uses the identifier.
- **Problem or need:** A new, better model (Pyinsect 2.8 EAB Oregon) and its program ("executor v3")
  should run on the website, and the website should give the same answers as that program.
- **Why they have it:** The old model always picked one of its insects, even for a photo of something
  it doesn't know. The new one can say when it doesn't know.
- **Our idea:** Use the new model on the main page. Like the executor, the card can now say:
  - "Insect not in my list" when the model picks "Other insect", or the photo doesn't look like any
    insect it learned (a "fingerprint" check).
  - "Unable to determine" when it's less than 50% sure.
  - These two answers are never reported. Small photos (shorter side under 200 pixels) use a second
    model made for small photos, which downloads only when needed.
- **Other ideas we talked about:**
  - Keep showing the best guess even when unsure: people might report insects that aren't there.
- **User flow:**
  1. Someone adds a photo on the main page.
  2. The card shows the insect, or "Insect not in my list", or "Unable to determine" with the closest guesses.
  3. If it's an invasive insect, it's reported like before.
- **Done when:**
  - [x] On 43 test photos (normal, small and not-insect pictures), the website and executor v3 give the same answer.
  - [x] "Insect not in my list" and "Unable to determine" cards don't send a report.
  - [ ] A grown-up redeployed the relay (version 12) before this was merged.

## Infested tree alert (emerald ash borer damage)

- **Status:** Building
- **Asked by:** edafawd, 2026-10-20
- **Who it's for:** People in Oregon with an ash tree, and our team, who looks at the reports.
- **Problem or need:** When the AI sees emerald ash borer damage, the site called it "Invasive", like a
  bug. But it's not a bug: it means a tree is already infested and someone must do something about it.
- **Why they have it:** An infested ash tree can die in a few years, and dead ash trees break and fall.
  The owner needs to know what to do, and the team needs to know about the tree right away.
- **Our idea:**
  - When the answer is "Emerald Ash Borer damage", the card says "⚠ Infested tree" (orange, not the red
    "Invasive"), warns that the tree is infested and needs action, and lists tips on what to do.
  - The report is sent right away as an "Infested tree" report. On the team's reports page it gets an
    orange "Infested tree: take action" label, and a banner at the top counts them.
  - In the ash tree check, if the AI sees the damage in the photo, the last step says "Warning: your ash
    tree is infested" with the same tips, and the report is marked as an infested tree.
  - The tips live in the tree settings file (`assets/trees/ash.js`), so they're easy to change.
- **Other ideas we talked about:**
  - Keep calling it "Invasive": that's wrong, damage isn't a bug, and the owner gets no tips.
  - Ask before sending: the team should know about an infested tree right away.
- **User flow:**
  1. Someone adds a photo of damaged ash bark on the main page, or answers the ash tree check and takes a photo.
  2. The AI finds emerald ash borer damage.
  3. They see "Warning: your ash tree is infested" and tips on what to do.
  4. The report goes to the team right away, labelled "Infested tree: take action".
- **Done when:**
  - [x] A damage photo on the main page shows "⚠ Infested tree" (not "Invasive"), the warning, and the tips.
  - [x] Its report reaches the relay as an infested tree report and shows "Infested tree: take action" on the reports page.
  - [x] In the tree check, a damage photo ends with the warning and tips; a healthy-bark photo still says "Report made, thank you".
  - [ ] A grown-up redeployed the relay (version 13) before this was merged.

## New user flow: splash, menu bar, home, Detect, results, and map

- **Status:** Building
- **Asked by:** Eshan, 2026-10-25 (from our notebook sketches; checked with a grown-up)
- **Who it's for:** The same people as before: everyday people (kids and adults), people in Oregon
  with an ash tree, and biologists who look at the map.
- **Problem or need:** The app was one long page. People didn't know where to start, and the steps
  for checking a tree for the emerald ash borer (EAB) weren't clear.
- **Why they have it:** Apps like iNaturalist and Seek guide people one step at a time, with a menu
  bar, pictures, and numbers. Our page had everything stacked up, so it was hard to follow.
- **Our idea:**
  - **Splash screen** (first visit only): the Pyinsect name and logo, then two short boxes to read,
    "Report" and "Games", each with a picture. Only **Continue** is a button.
  - **Permissions screen** (first visit only): says why we use the camera (to find invasive species)
    and location (to map reports). **Continue** makes the browser ask right away. If they block it:
    "That's okay! You can still choose photos."
  - **Menu bar**, always at the bottom of every screen (even on computers): Home, Detect, Game, Map.
    Each icon has a word under it and looks like a button. The screen you're on lights up.
  - **Home screen**: a parallax background (the EAB picture moves slower than the words, so it looks
    3D), a short "What is the EAB?" with a picture, expert facts (from the Oregon Department of
    Forestry and USDA), EAB and damage pictures, "Is EAB near you?" (your county, and whether EAB
    has been found there), and "What you can do", with pictures. The last tip is "Report it with
    Pyinsect", and it opens Detect. Not much scrolling. A link to the old Pyinsect 2.7 stays at the bottom.
  - **Detect 1, 2, 3**: "Check your tree", "Check for signs of damage", and "Check for an EAB". Each
    has a swipeable carousel of real photos, **Take a picture**, **Choose a photo**, and **Skip**. After
    a photo: **Retake** or **Next**. Up to 3 photos per step. Leaving Detect starts again at Detect 1.
  - **Results pop-up**: the AI checks all the photos at the end. Calm words (no scary warnings). A
    **Send report** button sends **one report with all the photos**. Skipping everything says "No activity"
    and sends nothing. Other invasive bugs are named and reported too.
  - **Map**: our own numbers at the top (EAB reports, damage reports, galleries found, trees checked,
    all starting at 0), then the map with + / − zoom and a **📍 Find me** button. Reports are squares,
    not pins, because we only know the rough area. Colors: your new report, your older reports, and
    everyone else's.
  - **Location privacy**: the public map rounds to squares about **200 m** wide. The private team copy
    keeps a spot rounded to about **75 m**. "Nothing found" checks are private (team only) and kept in
    their own section, but they count in "trees checked".
  - We pass reports on to the experts, and the results also show how to contact them directly.
- **Other ideas we talked about:**
  - Pins on the map: they look exact, but our data is a rough area, so squares are more honest.
  - 50 m squares on the public map: a stranger could find a kid's house. A grown-up agreed on 200 m.
  - The AI checking each photo right away: we chose to show everything together in the results.
  - Ask for camera and location the first time they're needed: we chose to ask right away.
- **User flow:**
  1. A new visitor sees the splash screen and taps Continue.
  2. They see the permissions screen, tap Continue, and the browser asks for camera and location.
  3. They land on the home screen. The menu bar is at the bottom with Home lit up.
  4. They tap Detect (or "Report it with Pyinsect") and see Detect 1, "Check your tree".
  5. They take or choose up to 3 photos (Retake or Next after each one), or tap Skip.
  6. Same for Detect 2 (damage) and Detect 3 (the EAB).
  7. The results pop-up shows what the AI found in each photo, in calm words.
  8. They tap Send report (or see "No activity" if they skipped everything).
  9. The map opens with their new report in its own color.
  10. On their next visit they go straight to the home screen.
- **Done when:**
  - [x] A first-time visitor sees the splash and permissions screens. On a second visit they go straight to Home.
  - [x] The menu bar stays at the bottom of every screen, and the screen you're on is lit up.
  - [x] Detect takes you through 3 steps, each with Take a picture, Choose a photo, Skip, and up to 3 photos.
  - [x] Skipping all 3 steps shows "No activity" and sends nothing.
  - [x] After "Send report", the map opens and your new report is a different color.
  - [ ] Tried on a real phone (camera, location, and sending a real report).
  - [ ] A grown-up redeployed the relay (version 15) before this was merged.
