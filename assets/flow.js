// The app's screens (requirements.md: "New user flow"): splash and permissions on the first visit,
// then Home, Detect, Game and Map, with the menu bar always at the bottom.
//   Detect = 3 steps (your tree, signs of damage, the EAB). Each step's words and carousel photos come
//   from the tree settings (assets/trees/ash.js, "detect"). Up to 3 photos per step, or Skip.
//   After step 3, the results pop-up runs the AI on every photo, then "Send report" sends ONE report
//   with all of them (kind "check", see checkDetect in relay/worker.js) and opens the map.
// Uses from app.js: $, el, store, session, modelReady, identify, openCamera, closeCamera, hideCrop,
// reportPhoto, reportIdAndTime, reportTop3, getArea, queueReport, sharpness, BLUR_THRESHOLD,
// MODEL_NAME, APP_VERSION, INVASIVE, commonName (species.js), checkAI (aicheck.js).
// Everything is wrapped in (() => { ... })() so its names don't clash with the other scripts.

(() => {
const TREE = (window.PYINSECT_TREES || []).find(t => t.id === "ash");
const STEPS = ["tree", "damage", "bug"];
const STEP_ICON = { tree: "🌳", damage: "🪵", bug: "🐛" };
const STEP_NAME = { tree: "Your tree", damage: "Signs of damage", bug: "The bug" };
const MAX_PHOTOS = 3;   // per step (the relay allows the same)
const SCREENS = ["home", "detect", "game", "map"];
const WELCOME_KEY = "pyinsect.welcomed";
const EAB = new Set(["agrilus_planipennis", "emerald_ash_borer"]);
const SURE = 50;   // the AI must be this sure (%) before we say it found something (same as the relay)
// Oregon counties where the emerald ash borer has been found. Oregon Department of Forestry (Sept 2024):
// Washington, Yamhill, Marion, Clackamas. News in 2026 (OPB, KOIN) added Multnomah (Northeast Portland).
// Check www.OregonEAB.com when it changes.
const EAB_COUNTIES = ["Washington", "Multnomah", "Clackamas", "Yamhill", "Marion"];

// ---------- screens and the menu bar ----------
let current = null;

// Closes anything open on top of a screen: the camera, the zoom step, and the photo viewer
function closeOverlays() {
  if (!$("camera").hidden) closeCamera();
  if (!$("crop").hidden) hideCrop();
  $("viewer").hidden || $("viewer").click();
}

function show(name) {
  if (!SCREENS.includes(name)) name = "home";
  closeOverlays();
  if (!$("results").hidden && !sending) closeResults();
  // Coming back to Detect from another screen starts again at Detect 1
  if (name === "detect" && current !== "detect") resetDetect();
  // Leaving the Game screen closes its pop-up (like "How to play"), so it doesn't cover the next screen
  if (current === "game" && name !== "game" && !$("gamePopup").hidden) window.Innvadex?.closePopup();
  current = name;
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
  document.querySelectorAll(".menubar a").forEach(a => {
    if (a.dataset.screen === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
  if (name === "detect") renderStep();
  if (name === "map") window.reportsMap?.show();
  if (name === "game") window.Innvadex?.firstHowTo();
  if (name === "home") autoNearby();
}

// The address ends in #home, #detect, #game or #map, so the phone's Back button works too
function go(name) {
  if (location.hash === "#" + name) show(name);
  else location.hash = name;
}
window.addEventListener("hashchange", () => { if (welcomed()) show(location.hash.slice(1)); });
document.addEventListener("click", e => {
  const b = e.target.closest("[data-go]");
  if (b) go(b.dataset.go);
});
window.flow = { go };

// ---------- first visit: splash and permissions ----------
const welcomed = () => !!store.get(WELCOME_KEY, false);

function startApp() {
  $("splash").hidden = $("perms").hidden = true;
  document.querySelector(".menubar").hidden = false;
  document.body.classList.remove("onboarding");
  show(location.hash.slice(1) || "home");
}

$("splashNext").onclick = () => {
  $("splash").hidden = true;
  $("perms").hidden = false;
  $("permsNext").focus();
};

// The browser asks for the camera, then the location. Whatever they answer, the app still works.
$("permsNext").onclick = async () => {
  const btn = $("permsNext"), msg = $("permsMsg");
  if (btn.dataset.done) { startApp(); return; }
  btn.disabled = true;
  msg.hidden = false; msg.textContent = "Your browser is asking now…";
  let camera = false, place = false;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    s.getTracks().forEach(t => t.stop());   // we only wanted to ask; the camera opens again when they take a photo
    camera = true;
  } catch {}
  place = await new Promise(ok => navigator.geolocation
    ? navigator.geolocation.getCurrentPosition(() => ok(true), () => ok(false), { timeout: 30000, maximumAge: 600000 })
    : ok(false));
  store.set(WELCOME_KEY, true);
  btn.disabled = false;
  if (camera && place) { startApp(); return; }
  msg.textContent = "That's okay! You can still choose photos." + (place ? "" : " Without your location, your reports just won't show on the map.");
  btn.textContent = "Go to the home screen";
  btn.dataset.done = "1";
  btn.focus();
};

// ---------- home: parallax and "Is EAB near you?" ----------
// The background picture moves slower than the page, so it looks deeper (parallax)
const still = window.matchMedia("(prefers-reduced-motion: reduce)");
const layer = document.querySelector(".parallax");
let ticking = false;
window.addEventListener("scroll", () => {
  if (ticking || current !== "home" || still.matches) return;
  ticking = true;
  requestAnimationFrame(() => { layer.style.transform = `translateY(${window.scrollY * 0.4}px) scale(1.15)`; ticking = false; });
}, { passive: true });

// Finds the county from the location, rounded to about 1 km first so nobody's exact spot is sent.
// The FCC (a U.S. government agency) answers with the county's name.
let nearbyDone = false;
async function checkNearby() {
  const text = $("nearbyText"), btn = $("nearbyBtn");
  btn.disabled = true;
  text.className = ""; text.textContent = "Finding your county…";
  try {
    if (!navigator.geolocation) throw new Error("no location");
    const pos = await new Promise((ok, bad) => navigator.geolocation.getCurrentPosition(ok, bad, { timeout: 15000, maximumAge: 600000 }));
    const lat = pos.coords.latitude.toFixed(2), lon = pos.coords.longitude.toFixed(2);
    let place;
    try {
      const res = await fetch(`https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&censusYear=2020&format=json`);
      place = (await res.json()).results?.[0];
    } catch {}
    if (!place) { text.textContent = "We couldn't find your county right now. Try again later."; btn.disabled = false; return; }
    const county = place.county_name.replace(/ County$/, "");
    nearbyDone = true;
    btn.hidden = true;
    if (place.state_code !== "OR") {
      text.textContent = `You're in ${place.county_name}, ${place.state_name}. Pyinsect tracks the emerald ash borer in Oregon. It has been found in many other states too, so keep an eye on ash trees!`;
    } else if (EAB_COUNTIES.includes(county)) {
      text.className = "nearby-yes";
      text.textContent = `You're in ${place.county_name}. The emerald ash borer has been found here. Check your ash trees!`;
    } else {
      text.className = "nearby-no";
      text.textContent = `You're in ${place.county_name}. The emerald ash borer hasn't been found here yet. Keep watching!`;
    }
  } catch {
    text.textContent = "Turn on location to see if EAB is near you.";
    btn.disabled = false;
  }
}
$("nearbyBtn").onclick = checkNearby;
// If they already allowed location, check right away (no question pops up)
async function autoNearby() {
  if (nearbyDone) return;
  try { if ((await navigator.permissions.query({ name: "geolocation" })).state === "granted") checkNearby(); } catch {}
}

// ---------- Detect: 3 steps ----------
let step = 0, photos = null;   // photos = { tree: [{ file, url, sign }], damage: [...], bug: [...] }

// keepPhotos: the game still needs the bug photos after a report is sent
function resetDetect(keepPhotos) {
  if (photos && !keepPhotos) for (const k of STEPS) photos[k].forEach(p => URL.revokeObjectURL(p.url));
  photos = { tree: [], damage: [], bug: [] };
  step = 0;
}
resetDetect();

// A finished photo (after the camera and zoom step, or chosen from the phone) joins the step we're on
window.photoHandler = file => {
  const list = photos[STEPS[step]];
  if (list.length >= MAX_PHOTOS) return;
  list.push({ file, url: URL.createObjectURL(file) });
  if (current === "detect") renderStep();
};

// Swipeable photos with dots under them. photos = [{ src, alt, label, credit, url }]
function carousel(slides) {
  const box = el("div", "carousel"), track = el("ul", "carousel-track"), dots = el("div", "carousel-dots");
  track.setAttribute("aria-label", "Example photos. Swipe to see more.");
  slides.forEach((p, i) => {
    const li = el("li", "slide"), img = el("img"), cap = el("div", "slide-cap");
    img.src = p.src; img.alt = p.alt; img.loading = i ? "lazy" : "eager";
    const credit = el("a", "slide-credit", "Photo: " + p.credit); credit.href = p.url; credit.target = "_blank"; credit.rel = "noopener";
    cap.append(el("strong", null, p.label), credit);
    li.append(img, cap);
    track.append(li);
    const dot = el("button", "dot-btn"); dot.type = "button"; dot.setAttribute("aria-label", `Photo ${i + 1}: ${p.label}`);
    dot.onclick = () => track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
    dots.append(dot);
  });
  const arrow = (cls, text, dir) => {
    const b = el("button", "carousel-arrow " + cls, text); b.type = "button"; b.setAttribute("aria-label", dir < 0 ? "Previous photo" : "Next photo");
    b.onclick = () => track.scrollBy({ left: dir * track.clientWidth, behavior: "smooth" });
    return b;
  };
  const mark = () => {
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    [...dots.children].forEach((d, j) => d.setAttribute("aria-current", j === i ? "true" : "false"));
  };
  track.addEventListener("scroll", mark, { passive: true });
  box.append(track, arrow("prev", "‹", -1), arrow("next", "›", 1), dots);
  requestAnimationFrame(mark);
  return box;
}

function renderStep() {
  const key = STEPS[step], d = TREE.detect[key], list = photos[key], box = $("detectStep");
  box.innerHTML = "";
  const count = el("div", "step-count");
  count.append(el("span", null, `Detect ${step + 1} of ${STEPS.length}`));
  const bar = el("div", "step-bar");
  STEPS.forEach((_, i) => bar.append(el("span", i < step ? "done" : i === step ? "now" : "")));
  count.append(bar);
  const title = el("h1", "screen-title", d.title);
  title.tabIndex = -1;
  box.append(count, title, carousel(d.photos), el("p", "step-tip", d.tip));

  // The photos they added for this step, with ✕ to remove one. Damage photos ask what they show.
  if (list.length) {
    const thumbs = el("div", "thumbs");
    list.forEach((p, i) => {
      const t = el("div", "thumb"), img = el("img"), del = el("button", "thumb-del", "✕");
      img.src = p.url; img.alt = `Your photo ${i + 1}`;
      del.type = "button"; del.setAttribute("aria-label", `Remove photo ${i + 1}`);
      del.onclick = () => { URL.revokeObjectURL(p.url); list.splice(i, 1); renderStep(); };
      t.append(img, del);
      if (key === "damage") {
        const q = el("div", "sign-pick");
        q.append(el("span", null, "What is it?"));
        for (const s of TREE.questions) {
          const b = el("button", "chip-btn", s.id === "holes" ? "D-shaped hole" : "Gallery"); b.type = "button";
          b.setAttribute("aria-pressed", p.sign === s.id ? "true" : "false");
          b.onclick = () => { p.sign = p.sign === s.id ? undefined : s.id; renderStep(); };
          q.append(b);
        }
        t.append(q);
      }
      thumbs.append(t);
    });
    box.append(el("p", "thumbs-title", `Your photos (${list.length} of ${MAX_PHOTOS})`), thumbs);
  }

  const actions = el("div", "step-actions");
  const button = (text, cls, onclick) => { const b = el("button", "btn " + cls, text); b.type = "button"; b.onclick = onclick; actions.append(b); return b; };
  if (list.length < MAX_PHOTOS) {
    const cam = button(list.length ? "📷 Add another photo" : `📷 ${d.button}`, list.length ? "big" : "primary big", () => openCamera());
    cam.classList.add("take");
  }
  const last = step === STEPS.length - 1;
  button(list.length ? (last ? "See results →" : "Next →") : "Skip", list.length ? "primary big next" : "big skip", nextStep);
  box.append(actions);
  if (list.length < MAX_PHOTOS) {
    const pick = el("button", "link", "Or choose a photo from your phone");
    pick.type = "button"; pick.onclick = () => $("photoInput").click();
    box.append(pick);
  }
  if (step > 0) {
    const back = el("button", "link back", "← Back");
    back.type = "button"; back.onclick = () => { step--; renderStep(); window.scrollTo(0, 0); };
    box.append(back);
  }
  if (document.activeElement === document.body || !box.contains(document.activeElement)) title.focus({ preventScroll: true });
}

function nextStep() {
  if (step < STEPS.length - 1) { step++; renderStep(); window.scrollTo(0, 0); return; }
  showResults();
}

// ---------- results pop-up ----------
let sending = false, checked = null;   // checked = the photos with what the AI found, ready to send

function openResults() {
  $("results").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeResults() {
  $("results").hidden = true;
  document.body.style.overflow = "";
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("results").hidden && !sending) closeResults(); });

function resultsActions(...buttons) {
  const bar = $("resultsActions"); bar.innerHTML = "";
  for (const [text, cls, onclick] of buttons) {
    const b = el("button", "btn " + cls, text); b.type = "button"; b.onclick = onclick; bar.append(b);
  }
  bar.querySelector(".primary")?.focus();
}

// What the AI found in one photo, in calm, simple words
function photoLine(p) {
  if (p.ai === "ai") return "This photo looks AI-made, so it won't be sent.";
  const best = p.top3[0], sure = p.verdict === "ok" && best.confidence >= SURE ? best.species : null;
  if (p.step === "tree") return "Photo saved. A person on our team will look at it.";
  if (sure && TREE.damageClass === sure) return "This looks like emerald ash borer damage.";
  if (p.step === "damage") {
    const said = p.sign === "holes" ? "a D-shaped hole" : p.sign === "galleries" ? "a gallery" : null;
    return said ? `You marked ${said}. Our team will take a close look.` : "The AI didn't find damage here. Our team will still look.";
  }
  if (!sure) return "We couldn't tell what bug this is. Our team will still look.";
  if (EAB.has(sure)) return "This looks like an emerald ash borer!";
  if (INVASIVE.has(sure)) return `This looks like a ${commonName(sure)}. It's invasive too, so we'll report it.`;
  return `This looks like a ${commonName(sure)}. It isn't invasive. Thanks for checking!`;
}

// What was found in all the photos (the relay works this out again by itself)
function summarize(list) {
  const found = { eab: false, damage: false, signs: false, others: [] };
  for (const p of list) {
    if (p.ai === "ai") continue;
    const best = p.top3[0], sure = p.verdict === "ok" && best.confidence >= SURE ? best.species : null;
    if (p.step === "bug" && EAB.has(sure)) found.eab = true;
    if (sure && sure === TREE.damageClass) found.damage = true;
    if (p.sign) found.signs = true;
    if (p.step === "bug" && sure && INVASIVE.has(sure) && !EAB.has(sure) && sure !== TREE.damageClass) {
      const name = commonName(sure);
      if (!found.others.includes(name)) found.others.push(name);
    }
  }
  found.name = found.eab && found.damage ? "Emerald ash borer and tree damage" : found.eab ? "Emerald ash borer"
    : found.damage ? "Emerald ash borer damage" : found.signs ? "Possible emerald ash borer damage"
    : found.others[0] || "Tree checked, nothing found";
  return found;
}

async function showResults() {
  const list = STEPS.flatMap(k => photos[k].map(p => ({ ...p, step: k })));
  const body = $("resultsBody");
  body.innerHTML = "";
  $("resultsArea").hidden = true;
  openResults();
  const title = el("h2", null, "Your results"); title.id = "resultsTitle";
  if (!list.length) {
    body.append(title, el("p", "big-note", "No activity"), el("p", null, "You skipped every step, so there's nothing to send. That's okay!"));
    resultsActions(["See the map", "primary", () => { closeResults(); go("map"); }], ["Back", "", closeResults]);
    return;
  }
  const wait = el("p", "checking", "Checking your photos…");
  body.append(title, wait);
  resultsActions();
  try {
    if (!session) wait.textContent = "Getting the AI ready… (the first time takes a minute)";
    await modelReady;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      wait.textContent = `Checking photo ${i + 1} of ${list.length}…`;
      const bmp = await createImageBitmap(p.file);
      Object.assign(p, await identify(p.file));
      p.blurry = sharpness(bmp) < BLUR_THRESHOLD;
      p.photo = reportPhoto(bmp);
      bmp.close?.();
      // Photos from the in-app camera come straight from the camera; chosen photos are checked for AI labels
      p.ai = p.file.fromCamera ? "camera" : (await checkAI(p.file.original || p.file).catch(() => ({ verdict: "unknown" }))).verdict;
    }
  } catch (e) {
    console.error(e);
    wait.textContent = "The AI couldn't check your photos. Check your internet and try again.";
    resultsActions(["Try again", "primary", showResults], ["Back", "", closeResults]);
    return;
  }
  wait.remove();
  checked = list;
  const found = summarize(list);

  for (const k of STEPS) {
    const mine = list.filter(p => p.step === k);
    const sec = el("section", "result-step");
    sec.append(el("h3", null, `${STEP_ICON[k]} ${STEP_NAME[k]}`));
    if (!mine.length) sec.append(el("p", "muted", "Skipped"));
    for (const p of mine) {
      const row = el("div", "result-row"), img = el("img"), words = el("div");
      img.src = p.url; img.alt = "";
      words.append(el("p", null, photoLine(p)));
      if (p.blurry && p.ai !== "ai") words.append(el("p", "muted", "A bit blurry, but we'll still send it."));
      row.append(img, words);
      sec.append(row);
    }
    body.append(sec);
  }

  // The calm summary, and how to reach the experts directly if they want to
  const note = el("div", "result-note");
  if (found.eab || found.damage || found.signs) {
    note.classList.add("care");
    note.append(el("p", null, `🌳 ${TREE.infested.text}`));
    const tips = el("ul");
    for (const t of TREE.infested.tips) tips.append(el("li", null, t));
    note.append(tips);
    for (const l of TREE.infested.links || []) {
      const a = el("a", null, l.text); a.href = l.url; a.target = "_blank"; a.rel = "noopener";
      const p = el("p"); p.append(a); note.append(p);
    }
  } else if (found.others.length) {
    note.append(el("p", null, `Thanks! Invasive bugs like the ${found.others.join(" and ")} are reported to the experts too.`));
  } else {
    note.append(el("p", null, "We didn't find signs of the emerald ash borer. Great news! Your report still helps: it shows where trees were checked."));
  }
  body.append(note);

  if (!list.some(p => p.ai !== "ai")) {
    body.append(el("p", "muted", "There are no photos left to send."));
    resultsActions(["Back", "primary", closeResults]);
    return;
  }
  $("resultsArea").hidden = false;
  resultsActions(["Send report", "primary", () => sendReport(found)], ["Back", "", closeResults]);
}

// One report with every photo (except AI-made ones), then the map
async function sendReport(found) {
  if (sending) return;
  sending = true;
  resultsActions(["Sending…", "primary", () => {}]);
  $("resultsActions").querySelector("button").disabled = true;
  const list = checked.filter(p => p.ai !== "ai");
  const { id, timestamp } = reportIdAndTime();
  const spot = await getArea();   // the ~75 m team spot, or null (box unticked or location blocked)
  const report = {
    id, timestamp, kind: "check", name: found.name,
    items: list.map(p => ({ step: p.step, ...(p.sign ? { sign: p.sign } : {}), top3: reportTop3(p.top3) })),
    ...(spot ? { spot } : {}),
    model: MODEL_NAME, app_version: APP_VERSION,
  };
  const detail = `${list.length} photo${list.length === 1 ? "" : "s"}` + (spot ? "" : " · no area, so it won't show on the map");
  const ok = queueReport({ report, photos: list.map(p => p.photo) }, detail);
  sending = false;
  const body = $("resultsBody");
  body.innerHTML = "";
  $("resultsArea").hidden = true;
  const title = el("h2", null, ok ? "✅ Report sent" : "Report not sent"); title.id = "resultsTitle";
  body.append(title, el("p", null, ok
    ? "Thank you for helping protect Oregon's trees! We pass reports on to the experts."
    : "This phone is out of storage space, so the report couldn't be saved. Try deleting some old photos or reports."));
  // Bugs from the bug step count in the Innvadex game too (assets/game.js)
  const bugs = list.filter(p => p.step === "bug" && p.verdict === "ok");
  resultsActions(["See the map", "primary", () => {
    closeResults();
    resetDetect(true);
    go("map");
    for (const p of bugs) {
      const s = p.top3[0].species;
      if (INVASIVE.has(s)) window.Innvadex?.encounter(s, p.url); else window.Innvadex?.native(s, p.top3[0].confidence);
    }
  }]);
}

// ---------- start ----------
if (welcomed()) startApp();
else {
  document.body.classList.add("onboarding");
  $("splash").hidden = false;
  $("splashNext").focus();
}
})();
