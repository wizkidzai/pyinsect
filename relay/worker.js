// Pyinsect report relay (Cloudflare Worker).
// 1. The website sends each invasive-species report here; this worker checks it and saves it to
//    reports/ in a PRIVATE GitHub repo with a token that only Cloudflare knows.
// 2. The reports page lives here too, at a secret address and behind a password:
//    https://<this worker>/<VIEW_PATH>/
//
// Settings (Cloudflare → this worker → Settings → Variables and Secrets):
//   GITHUB_TOKEN    Secret. Fine-grained token, Contents: Read and write on REPORTS_REPO below.
//   (GITHUB_REPO is no longer used: the repo is fixed in the code, see REPORTS_REPO.)
//   (ALLOWED_ORIGIN is no longer used: the allowed sites are fixed in the code, see SITE_ORIGINS.)
//   VIEW_PASSWORD   Secret. Password for the reports page.
//   VIEW_PATH       Secret. The secret word in the reports page address (letters, digits, - and _).

// Must match `invasive` in assets/models/pyinsect-*.js (scientific names, as Pyinsect 2.8+ outputs them)
const INVASIVE = new Set([
  "adelges_piceae", "agrilus_planipennis", "anisandrus_dispar", "anoplophora_glabripennis",
  "coptotermes_formosanus", "exomala_orientalis", "halyomorpha_halys", "harmonia_axyridis",
  "linepithema_humile", "lycorma_delicatula", "lymantria_dispar", "macrodactylus_subspinosus",
  "pieris_rapae", "polistes_dominula", "popillia_japonica", "solenopsis_invicta",
  "vespa_mandarinia", "xyleborus_monographus",
  // Pyinsect 2.8 Oregon (Oct 16 2026)
  "agrilus_planipennis_damage", "cydalima_perspectalis", "drosophila_melanogaster_suzukii",
  "drosophila_suzukii", "ips_typographus", "lymantria_monacha", "operophtera_brumata",
  "scolytus_multistriatus",
  // Older names (Pyinsect 2.7 and before), so reports still waiting on a phone go through
  "ambrosia_beetle", "argentine_ant", "asian_giant_hornet", "asian_lady_beetle",
  "asian_longhorned_beetle", "balsam_woolly_adelgid", "brown_marmorated_stink_bug",
  "cabbage_white", "elm_leaf_beetle", "emerald_ash_borer", "european_paper_wasp",
  "fire_ant", "formosan_termite", "japanese_beetle", "oriental_beetle", "rose_chafer",
  "spongy_moth", "spotted_lanternfly",
]);
// Tree check reports (the "Help me check my tree" questions on the site). Must match the tree
// settings files, assets/trees/*.js: the tree id, its pest, and the id and sign of each question.
const TREE_CHECKS = {
  ash: { tree: "Ash tree", pest: "emerald ash borer", signs: { holes: "D-shaped holes", galleries: "wavy lines (galleries)" } },
};
// Tree damage classes of the bug model → the tree they mean (a key of TREE_CHECKS). Finding one
// means a tree is infested and someone must take action. Must match damageClass in assets/trees/*.js.
const INFESTED = { agrilus_planipennis_damage: "ash" };
// Infested tree reports, tree checks, and Detect reports where the AI saw the damage: "take action"
const needsAction = r => r.kind === "infested" || r.infested === true || r.found?.damage === true;
// Detect reports (kind "check", from the Detect steps on the site): up to 3 photos for each step.
// The emerald ash borer's class names (Pyinsect 2.8+, and older). The AI must be this sure (%) before
// the relay believes it found something.
const CHECK_STEPS = { tree: "Your tree", damage: "Signs of damage", bug: "The bug" };
const PHOTOS_PER_STEP = 3, SURE = 50;
const EAB = new Set(["agrilus_planipennis", "emerald_ash_borer"]);
// Detect reports where nothing was found are kept in their own private folder (they show where
// people use the app, but never go on the public map)
const NOTHING_DIR = "nothing-found";
// Where reports are saved. Fixed here (not a Cloudflare setting) because the setting kept pointing
// at the public site repo. Must stay a PRIVATE repo; the relay refuses to save anywhere public.
const REPORTS_REPO = "edafawd/pyinsect-reports-data";
// Websites allowed to send reports. The site moved to wizkidzai.github.io (Oct 11 2026); the old
// address stays on the list so reports still waiting on phones can go through.
const SITE_ORIGINS = ["https://wizkidzai.github.io", "https://edafawd.github.io"];
const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
const MAX_AGE_DAYS = 60;            // reports can wait offline on a phone for a while
const PER_IP_LIMIT = 30;            // reports per IP per hour (per Cloudflare server, best effort)
const WRONG_PASSWORD_LIMIT = 10;    // wrong passwords per IP per 15 minutes (best effort)
const SHOW = 40;                    // newest reports sent to the reports page
const LIST_CACHE_MS = 5000;         // GitHub is asked for the file list at most every 5 s

const ID_RE = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-[0-9a-f]{1,8}$/;
const SPECIES_RE = /^[a-z_]{1,48}$/;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
const recent = new Map(), wrong = new Map();
const reportCache = new Map();      // id → report JSON (reports never change)
let listCache = { at: 0, paths: null };
// map.json (in the private repo): one small line per report, for the reports map and check levels:
//   { id, kind: "invasive" | "tree" | "infested" | "check" | "nothing", name, area: { lat, lon } | null,
//     month: "2026-10", level, found (Detect reports only: { eab, damage, galleries }) }
// "check" = a Detect report that found something, "nothing" = a Detect report that found nothing.
// level: "unchecked" (just sent), "ai" (an AI thinks it's a match; not used yet),
//        "verified" (a person on the team confirmed it), "not_match" (a person said no).
const INDEX_PATH = "map.json", LEVELS = ["unchecked", "ai", "verified", "not_match"];
const INDEX_CACHE_MS = 30000;       // the public map reads map.json at most every 30 s
let indexCache = { at: 0, list: null };
let privateCheck = { repo: null, at: 0 };   // last time REPORTS_REPO was confirmed private

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const word = viewWord(env);
    const view = word ? "/" + word : null;
    if (view && (url.pathname === view || url.pathname.startsWith(view + "/"))) {
      return viewer(request, env, url.pathname.slice(view.length));
    }
    return submit(request, env);
  },
};

// ---------- receiving reports from the website ----------

async function submit(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const cors = {
    "Access-Control-Allow-Origin": SITE_ORIGINS.includes(origin) ? origin : SITE_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  const reply = (status, body) => new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method === "GET" && url.pathname === "/map") {
    // Public: every Detect report that found something, has a rough area, and hasn't been marked
    // "not a match". Only what, where (the ~200 m square), when (the month), and how well it was
    // checked. No ids, photos, or team spots. (Reports from before the Detect steps were tests, so
    // the map starts empty, like our numbers.)
    try {
      const list = (await readIndexCached(env)).filter(e => e.kind === "check" && e.area && e.level !== "not_match")
        .map(e => ({ kind: e.kind, name: e.name, lat: e.area.lat, lon: e.area.lon, month: e.month, level: e.level }));
      return reply(200, { reports: list });
    } catch (e) {
      return reply(502, { error: e.message });
    }
  }
  if (request.method === "GET" && url.pathname === "/stats") {
    // Public: our numbers for the map screen, from Detect reports not marked "not a match".
    // "trees" counts every Detect report, including the private "nothing found" ones.
    try {
      const list = (await readIndexCached(env)).filter(e => (e.kind === "check" || e.kind === "nothing") && e.level !== "not_match");
      const stats = { eab: 0, damage: 0, galleries: 0, trees: list.length };
      for (const e of list) {
        if (e.found?.eab) stats.eab++;
        if (e.found?.damage) stats.damage++;
        stats.galleries += Math.min(PHOTOS_PER_STEP, Number(e.found?.galleries) || 0);
      }
      return reply(200, stats);
    } catch (e) {
      return reply(502, { error: e.message });
    }
  }
  if (request.method === "GET" && url.pathname === "/status") {
    // A phone asks for the check levels of its own reports (it knows their ids). Up to 50 at a time.
    const ids = (url.searchParams.get("ids") || "").split(",").filter(id => ID_RE.test(id)).slice(0, 50);
    try {
      const list = await readIndexCached(env), levels = {};
      for (const id of ids) { const e = list.find(x => x.id === id); if (e) levels[id] = e.level; }
      return reply(200, { levels });
    } catch (e) {
      return reply(502, { error: e.message });
    }
  }
  if (request.method === "GET") {
    // Says whether the reports page is set up, never what its address or password is
    return reply(200, { ok: true, service: "pyinsect-relay", version: 15, reports_page: Boolean(viewWord(env) && env.VIEW_PASSWORD) });
  }
  if (request.method !== "POST") return reply(405, { error: "Use POST." });
  if (!SITE_ORIGINS.includes(origin)) return reply(403, { error: "Reports are only accepted from the Pyinsect site." });
  if (!env.GITHUB_TOKEN) return reply(500, { error: "The relay isn't set up yet (GITHUB_TOKEN missing)." });

  const ip = request.headers.get("CF-Connecting-IP") || "?";
  if (!allow(recent, ip, 3600000, PER_IP_LIMIT)) return reply(429, { error: "Too many reports from this network. Try again later." });

  let body;
  try { body = await request.json(); } catch { return reply(400, { error: "Not valid JSON." }); }
  const checked = checkReport(body);
  if (checked.error) return reply(400, { error: checked.error });
  count(recent, ip, 3600000);

  const { report, photo, photos } = checked;
  // Never save into a public repo (it happened when the old GITHUB_REPO setting was reset). Not a 400, so the
  // site keeps the report and sends it again once the setting is fixed.
  try {
    if (!(await repoIsPrivate(env))) {
      return reply(503, { error: "The relay's reports repo isn't private, so the report is held back. REPORTS_REPO in the relay code must be a private repo." });
    }
  } catch (e) {
    return reply(502, { error: e.message });
  }
  try {
    // Photos first, so the reports page only lists a report once its photos exist
    const dir = report.kind === "nothing" ? NOTHING_DIR : "reports";
    const files = photos || [photo];
    for (let i = 0; i < files.length; i++) {
      await githubCreate(env, `${dir}/${photoName(report.id, i)}`, files[i], `Photo ${i + 1} for ${report.name} report`);
    }
    await githubCreate(env, `${dir}/${report.id}.json`, toBase64(JSON.stringify(report, null, 1)),
      `${report.kind === "nothing" ? "Detect report, nothing found" : report.kind === "check" ? "Detect report" : needsAction(report) ? "Infested tree report" : report.kind === "tree" ? "Tree check report" : "Invasive species report"}: ${report.name}`);
  } catch (e) {
    return reply(502, { error: e.message });
  }
  listCache.at = 0;
  // Add it to map.json. If that fails, the report is still saved (and gets added when it's checked).
  try {
    await updateIndex(env, list => { if (!list.some(e => e.id === report.id)) list.push(indexEntry(report, "unchecked")); });
  } catch (e) {
    console.log("map.json not updated:", e.message);
  }
  return reply(201, { ok: true, id: report.id });
}

// A report's photo files: the first is <id>.jpg, then <id>-2.jpg, <id>-3.jpg, ...
const photoName = (id, i) => i ? `${id}-${i + 1}.jpg` : `${id}.jpg`;

// Accepts only well-formed reports and rebuilds them from known fields. Four kinds:
//   "check": a Detect report, with photos of the tree, the damage, and the bug (see checkDetect)
//   invasive (no kind): the bug model found an invasive species
//   "tree": a photo from the tree check, with the signs the person said they saw (infested: true
//           when the bug model also found that tree's damage in the photo)
//   "infested": the bug model found tree damage (INFESTED), like emerald ash borer damage
function checkReport(body) {
  const r = body && body.report, photo = body && body.photo;
  if (!r || typeof r !== "object") return { error: "Missing report." };
  if (r.kind === "check") return checkDetect(r, body.photos);

  const idError = checkId(r);
  if (idError) return { error: idError };
  // hasOwn: only trees really in the list (not hidden names like "__proto__" that every object has)
  const tree = r.kind === "tree" && typeof r.tree === "string" && Object.hasOwn(TREE_CHECKS, r.tree) ? TREE_CHECKS[r.tree] : null;
  if (r.kind === "tree") {
    if (!tree) return { error: "Unknown tree check." };
    if (!Array.isArray(r.signs) || r.signs.length > Object.keys(tree.signs).length
        || !r.signs.every((s, i) => Object.hasOwn(tree.signs, s) && r.signs.indexOf(s) === i)) {
      return { error: "Bad list of signs." };
    }
  } else if (r.kind === "infested" || (r.kind === undefined && Object.hasOwn(INFESTED, r.species))) {
    // (No kind: sent by an older page that still called the damage invasive)
    if (typeof r.species !== "string" || !Object.hasOwn(INFESTED, r.species)) return { error: "Unknown tree damage." };
  } else if (r.kind !== undefined) {
    return { error: "Unknown kind of report." };
  } else if (!INVASIVE.has(r.species)) {
    return { error: "Only invasive species are reported." };
  }
  const pct = v => typeof v === "number" && v >= 0 && v <= 100;
  if (!tree && !pct(r.confidence)) return { error: "Bad confidence." };
  // Tree reports may send the bug model's guesses too (as extra help for the team), or none
  const top3Ok = Array.isArray(r.top3) && r.top3.length <= 3 && (tree || r.top3.length >= 1)
    && r.top3.every(t => t && SPECIES_RE.test(t.species) && pct(t.confidence));
  if (!top3Ok && !(tree && r.top3 === undefined)) return { error: "Bad top-3 list." };

  const where = checkSpot(r);
  if (where.error) return { error: where.error };
  const { area, spot } = where;
  const photoError = checkPhoto(photo);
  if (photoError) return { error: photoError };

  const short = (v, n) => typeof v === "string" ? v.slice(0, n) : "";
  // Display names come from the site; keep them short plain text, else fall back to the id
  const label = (v, species) => {
    const t = typeof v === "string" ? v.replace(/[^\p{L}\p{N} '().,-]/gu, "").trim().slice(0, 60) : "";
    return t || niceName(species);
  };
  const top3 = (r.top3 || []).map(t => ({ species: t.species, name: label(t.name, t.species), confidence: t.confidence }));
  if (tree) {
    // Only believed when the bug model's top guess really is this tree's damage
    const infested = r.infested === true && INFESTED[top3[0]?.species] === r.tree && top3[0].confidence >= 50;
    // The name is made here, never taken from the site, so it's always one of these three
    return {
      photo,
      report: {
        id: r.id,
        timestamp: r.timestamp,
        kind: "tree",
        tree: r.tree,
        name: infested ? `Infested ${tree.tree.toLowerCase()}` : r.signs.length ? `Possible ${tree.pest} damage` : `${tree.tree} to check`,
        ...(infested ? { infested: true } : {}),
        signs: r.signs,
        signs_text: r.signs.length ? r.signs.map(s => tree.signs[s]).join(", ") : "None. They were still worried and sent a photo.",
        ...(area ? { area, spot } : {}),
        pest: tree.pest,
        top3,
        photo: `${r.id}.jpg`,
        model: short(r.model, 40),
        app_version: short(r.app_version, 20),
      },
    };
  }
  if (Object.hasOwn(INFESTED, r.species)) {
    const sick = TREE_CHECKS[INFESTED[r.species]];
    return {
      photo,
      report: {
        id: r.id,
        timestamp: r.timestamp,
        kind: "infested",
        tree: INFESTED[r.species],
        species: r.species,
        name: `Infested ${sick.tree.toLowerCase()}`,
        pest: sick.pest,
        action: "Take action: this tree looks infested",
        confidence: r.confidence,
        top3,
        ...(area ? { area, spot } : {}),
        photo: `${r.id}.jpg`,
        model: short(r.model, 40),
        app_version: short(r.app_version, 20),
      },
    };
  }
  return {
    photo,
    report: {
      id: r.id,
      timestamp: r.timestamp,
      species: r.species,
      name: label(r.name, r.species),
      scientific: label(r.scientific, r.species),
      confidence: r.confidence,
      top3,
      ...(area ? { area, spot } : {}),
      photo: `${r.id}.jpg`,
      model: short(r.model, 40),
      app_version: short(r.app_version, 20),
    },
  };
}

// Shared checks for every kind of report. Each returns an error message, or nothing if it's fine.
function checkId(r) {
  const m = typeof r.id === "string" && r.id.match(ID_RE);
  if (!m) return "Bad report id.";
  const when = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  if (isNaN(when) || when > Date.now() + 3600000 || when < Date.now() - MAX_AGE_DAYS * 86400000) return "Report time is out of range.";
  if (typeof r.timestamp !== "string" || !TIMESTAMP_RE.test(r.timestamp)) return "Bad timestamp.";
}
function checkPhoto(photo) {
  if (typeof photo !== "string" || photo.length > MAX_PHOTO_BYTES * 4 / 3 + 4) return "Photo missing or too large.";
  let bytes;
  try { bytes = atob(photo); } catch { return "Photo isn't valid base64."; }
  if (bytes.charCodeAt(0) !== 0xFF || bytes.charCodeAt(1) !== 0xD8 || bytes.charCodeAt(2) !== 0xFF) return "Photo must be a JPEG.";
}
// Where the report came from (optional): "spot" from new pages, "area" from older ones. Rounded again
// here, so even a changed site can't save an exact spot: the team spot (~75 m, private) and the
// public map area (~200 m).
function checkSpot(r) {
  const given = r.spot ?? r.area;
  if (given === undefined || given === null) return { area: null, spot: null };
  const { lat, lon } = given || {};
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return { error: "Bad area." };
  const spot = teamSpot(lat, lon);
  return { spot, area: roughArea(spot.lat, spot.lon) };
}

// A Detect report: items[i] says which step photos[i] belongs to ("tree", "damage" or "bug"), the AI's
// top 3 guesses for it, and for damage photos what the person says it shows (sign: "holes" or
// "galleries", optional). What was found is worked out here from the guesses, never taken from the site.
function checkDetect(r, photos) {
  const idError = checkId(r);
  if (idError) return { error: idError };
  const items = r.items;
  const max = Object.keys(CHECK_STEPS).length * PHOTOS_PER_STEP;
  if (!Array.isArray(photos) || !photos.length || photos.length > max) return { error: "A Detect report needs 1 to " + max + " photos." };
  if (!Array.isArray(items) || items.length !== photos.length) return { error: "Each photo needs one item." };
  for (const photo of photos) { const e = checkPhoto(photo); if (e) return { error: e }; }
  const ash = TREE_CHECKS.ash, perStep = {};
  const pct = v => typeof v === "number" && v >= 0 && v <= 100;
  for (const it of items) {
    if (!it || !Object.hasOwn(CHECK_STEPS, it.step)) return { error: "Unknown Detect step." };
    if ((perStep[it.step] = (perStep[it.step] || 0) + 1) > PHOTOS_PER_STEP) return { error: "Too many photos for one step." };
    if (it.sign !== undefined && (it.step !== "damage" || !Object.hasOwn(ash.signs, it.sign))) return { error: "Bad sign." };
    if (!Array.isArray(it.top3) || it.top3.length < 1 || it.top3.length > 3
        || !it.top3.every(t => t && SPECIES_RE.test(t.species) && pct(t.confidence))) return { error: "Bad top-3 list." };
  }
  const where = checkSpot(r);
  if (where.error) return { error: where.error };

  const label = (v, species) => {
    const t = typeof v === "string" ? v.replace(/[^\p{L}\p{N} '().,-]/gu, "").trim().slice(0, 60) : "";
    return t || niceName(species);
  };
  const sure = it => it.top3[0].confidence >= SURE ? it.top3[0].species : null;
  const found = { eab: false, damage: false, galleries: 0, holes: 0, others: [] };
  const rebuilt = items.map((it, i) => {
    const best = sure(it);
    if (it.step === "bug" && EAB.has(best)) found.eab = true;
    if (best && INFESTED[best] === "ash") found.damage = true;
    if (it.step === "bug" && best && INVASIVE.has(best) && !EAB.has(best) && !Object.hasOwn(INFESTED, best)) {
      const name = label(it.top3[0].name, best);
      if (!found.others.includes(name)) found.others.push(name);
    }
    if (it.sign === "galleries") found.galleries++;
    if (it.sign === "holes") found.holes++;
    return {
      step: it.step, step_name: CHECK_STEPS[it.step], photo: photoName(r.id, i),
      ...(it.sign ? { sign: it.sign, sign_text: ash.signs[it.sign] } : {}),
      top3: it.top3.map(t => ({ species: t.species, name: label(t.name, t.species), confidence: t.confidence })),
    };
  });
  const something = found.eab || found.damage || found.galleries || found.holes || found.others.length;
  const name = found.eab && found.damage ? "Emerald ash borer and tree damage"
    : found.eab ? "Emerald ash borer"
    : found.damage ? "Emerald ash borer damage"
    : found.galleries || found.holes ? "Possible emerald ash borer damage"
    : found.others.length ? found.others[0]
    : "Tree checked, nothing found";
  const seen = [found.eab && "an emerald ash borer", found.damage && "emerald ash borer damage (AI)",
    found.holes && `${found.holes} photo(s) of D-shaped holes`, found.galleries && `${found.galleries} photo(s) of galleries`,
    ...found.others.map(o => `${o} (invasive)`)].filter(Boolean);
  const short = (v, n) => typeof v === "string" ? v.slice(0, n) : "";
  return {
    photos,
    report: {
      id: r.id,
      timestamp: r.timestamp,
      kind: something ? "check" : "nothing",
      name,
      found,
      found_text: seen.length ? seen.join(", ") : "Nothing found",
      pest: ash.pest,
      ...(where.area ? { area: where.area, spot: where.spot } : {}),
      items: rebuilt,
      photos: rebuilt.map(it => it.photo),
      photo: rebuilt[0].photo,
      model: short(r.model, 40),
      app_version: short(r.app_version, 20),
    },
  };
}

// ---------- the password-protected reports page ----------

async function viewer(request, env, rest) {
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };
  if (rest === "") return Response.redirect(new URL(request.url).href + "/", 301);
  if (rest === "/") return new Response(PAGE, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

  if (!rest.startsWith("/api/")) return new Response("Not found", { status: 404, headers });
  if (!env.VIEW_PASSWORD || !env.GITHUB_TOKEN) return json(500, { error: "The relay isn't fully set up (VIEW_PASSWORD / GITHUB_TOKEN)." });

  const ip = request.headers.get("CF-Connecting-IP") || "?";
  if (!allow(wrong, ip, 900000, WRONG_PASSWORD_LIMIT)) return json(429, { error: "Too many wrong passwords. Wait 15 minutes." });
  if (!(await samePassword(request.headers.get("X-Password") || "", env.VIEW_PASSWORD))) {
    count(wrong, ip, 900000);
    return json(401, { error: "Wrong password." });
  }

  try {
    if (rest === "/api/reports" || rest === "/api/nothing") {
      // The newest reports (or "nothing found" Detect reports), plus each one's check level from map.json
      const data = await latestReports(env, rest === "/api/nothing" ? NOTHING_DIR : "reports"), list = (await readIndex(env)).list;
      data.levels = Object.fromEntries(data.reports.map(r => [r.id, list.find(e => e.id === r.id)?.level || "unchecked"]));
      return json(200, data);
    }
    // A team member checked a report: { level: "verified" | "not_match" | "unchecked" }
    const check = rest.match(/^\/api\/check\/([0-9a-f-]{1,40})$/);
    if (check && request.method === "POST") {
      const id = check[1];
      let level;
      try { level = (await request.json()).level; } catch { return json(400, { error: "Not valid JSON." }); }
      if (!ID_RE.test(id) || !["verified", "not_match", "unchecked"].includes(level)) return json(400, { error: "Bad check." });
      // Reports sent before map.json existed aren't in it yet: add them from the saved report
      let saved = null;
      if (!(await readIndex(env)).list.some(e => e.id === id)) {
        const res = await githubRead(env, `reports/${id}.json`) || await githubRead(env, `${NOTHING_DIR}/${id}.json`);
        if (!res) return json(404, { error: "No such report." });
        saved = await res.json();
      }
      await updateIndex(env, list => {
        const e = list.find(x => x.id === id);
        if (e) e.level = level;
        else if (saved) list.push(indexEntry(saved, level));
      });
      return json(200, { ok: true, id, level });
    }
    // A photo: <id> (the first one) or <id>-2, <id>-3, ... (more photos of a Detect report)
    const photo = rest.match(/^\/api\/photo\/([0-9a-f-]{1,44})$/);
    const more = photo && !ID_RE.test(photo[1]) ? photo[1].match(/^(.+)-([2-9])$/) : null;
    if (photo && (ID_RE.test(photo[1]) || (more && ID_RE.test(more[1])))) {
      const res = await githubRead(env, `reports/${photo[1]}.jpg`) || await githubRead(env, `${NOTHING_DIR}/${photo[1]}.jpg`);
      if (!res) return json(404, { error: "No such photo." });
      return new Response(res.body, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable", "X-Robots-Tag": "noindex" } });
    }
    return json(404, { error: "Not found." });
  } catch (e) {
    return json(502, { error: e.message });
  }
}

// Newest reports in a folder ("reports" or NOTHING_DIR), read from the private repo with the token
// (5,000 GitHub requests an hour)
async function latestReports(env, dir) {
  if (!listCache.paths || Date.now() - listCache.at > LIST_CACHE_MS) {
    const res = await gh(env, `git/trees/HEAD?recursive=1`);
    let paths = [];
    if (res.ok) paths = ((await res.json()).tree || []).map(t => t.path);
    else if (res.status !== 404 && res.status !== 409) throw new Error(ghError(res.status));   // 404/409 = no files yet
    listCache = { at: Date.now(), paths };
  }
  const names = new Set(listCache.paths);
  const ids = listCache.paths.map(p => p.startsWith(dir + "/") && p.match(/\/(.+)\.json$/)).filter(Boolean).map(m => m[1])
    .filter(id => ID_RE.test(id) && names.has(`${dir}/${id}.jpg`))
    .sort().reverse();
  // Free Workers may make 50 outgoing requests per visit, and a redirect (old repo name) counts
  // twice, so load at most 20 new reports per visit; the page refreshes and gets the rest.
  const missing = ids.slice(0, SHOW).filter(id => !reportCache.has(id)).slice(0, 20);
  await Promise.all(missing.map(async id => {
    const res = await githubRead(env, `${dir}/${id}.json`);
    if (res) { try { reportCache.set(id, await res.json()); } catch {} }
  }));
  return { total: ids.length, reports: ids.slice(0, SHOW).filter(id => reportCache.has(id)).map(id => reportCache.get(id)) };
}

async function samePassword(given, real) {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([given, real].map(s => crypto.subtle.digest("SHA-256", enc.encode(s))));
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// ---------- GitHub ----------

function gh(env, path, init = {}) {
  return fetch(`https://api.github.com/repos/${REPORTS_REPO}${path ? "/" + path : ""}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "pyinsect-relay",
      ...(init.headers || {}),
    },
  });
}

function ghError(status) {
  if (status === 401) return "The relay's GitHub token was rejected (expired?).";
  if (status === 403 || status === 404) return "The relay's GitHub token can't use the reports repo (it needs access to " + REPORTS_REPO + ").";
  return `GitHub answered ${status}.`;
}

// True when REPORTS_REPO is a private repo (checked at most every 10 minutes per Cloudflare server)
async function repoIsPrivate(env) {
  if (privateCheck.repo === REPORTS_REPO && Date.now() - privateCheck.at < 600000) return true;
  const res = await gh(env, "");
  if (!res.ok) throw new Error(ghError(res.status));
  const info = await res.json();
  if (info.private !== true) return false;
  privateCheck = { repo: REPORTS_REPO, at: Date.now() };
  return true;
}

// Creates a file; never overwrites (GitHub answers 422 when the file already exists)
async function githubCreate(env, path, base64, message) {
  const res = await gh(env, `contents/${path}`, { method: "PUT", body: JSON.stringify({ message, content: base64 }) });
  if (res.status === 422) return;   // already saved on an earlier try
  if (!res.ok) throw new Error(ghError(res.status));
}

// ---------- map.json: the list for the reports map and check levels ----------

function indexEntry(report, level) {
  const detect = report.kind === "check" || report.kind === "nothing";
  return { id: report.id, kind: detect ? report.kind : needsAction(report) ? "infested" : report.kind === "tree" ? "tree" : "invasive", name: report.name,
    area: report.area || null, month: String(report.timestamp || report.id).replace(/^(\d{4})-?(\d{2}).*/, "$1-$2"), level,
    ...(detect ? { found: { eab: !!report.found?.eab, damage: !!report.found?.damage, galleries: report.found?.galleries || 0 } } : {}) };
}

// The list and its version (sha). GitHub needs the version to change the file, and refuses the
// change if someone else changed it first, so two updates can't erase each other.
async function readIndex(env) {
  const res = await gh(env, `contents/${INDEX_PATH}`);
  if (res.status === 404) return { list: [], sha: null };
  if (!res.ok) throw new Error(ghError(res.status));
  const file = await res.json();
  const text = new TextDecoder().decode(Uint8Array.from(atob((file.content || "").replace(/\s/g, "")), c => c.charCodeAt(0)));
  return { list: text.trim() ? JSON.parse(text) : [], sha: file.sha };
}

// Changes the list with change(list), then saves it. Tries again (up to 4 times) if someone else
// changed it at the same moment.
async function updateIndex(env, change) {
  for (let tries = 0; ; tries++) {
    const { list, sha } = await readIndex(env);
    change(list);
    const body = { message: "Update map.json", content: toBase64(JSON.stringify(list)), ...(sha ? { sha } : {}) };
    const res = await gh(env, `contents/${INDEX_PATH}`, { method: "PUT", body: JSON.stringify(body) });
    if (res.ok) { indexCache = { at: Date.now(), list }; return list; }
    if ((res.status === 409 || res.status === 422) && tries < 3) continue;
    throw new Error(ghError(res.status));
  }
}

async function readIndexCached(env) {
  if (!indexCache.list || Date.now() - indexCache.at > INDEX_CACHE_MS) indexCache = { at: Date.now(), list: (await readIndex(env)).list };
  return indexCache.list;
}

// Raw file contents, or null if it doesn't exist
async function githubRead(env, path) {
  const res = await gh(env, `contents/${path}`, { headers: { Accept: "application/vnd.github.raw" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(ghError(res.status));
  return res;
}

// ---------- helpers ----------

// The middle of the grid square around a spot: ~200 m squares for the public map (roughArea), ~75 m
// for the team (teamSpot). Must stay the same as in assets/app.js (scripts/check.js compares them).
const AREA_DEG = 0.0018, SPOT_DEG = 0.0007;   // 0.0018° of latitude ≈ 200 m, 0.0007° ≈ 78 m
function snapToGrid(lat, lon, deg) {
  const row = Math.floor(lat / deg), rowLat = (row + 0.5) * deg;
  const lonStep = deg / Math.max(0.2, Math.cos(rowLat * Math.PI / 180));   // squares stay square
  const col = Math.floor(lon / lonStep);
  return { lat: +rowLat.toFixed(5), lon: +((col + 0.5) * lonStep).toFixed(5) };
}
const roughArea = (lat, lon) => snapToGrid(lat, lon, AREA_DEG);   // public map (~200 m)
const teamSpot = (lat, lon) => snapToGrid(lat, lon, SPOT_DEG);    // team only (~75 m)

// VIEW_PATH as typed in Cloudflare, tolerating spaces, slashes or a whole pasted link
function viewWord(env) {
  return (env.VIEW_PATH || "").trim().replace(/^[a-z]+:\/\/[^/]+/i, "").replace(/^\/+|\/+$/g, "");
}

function allow(map, key, windowMs, limit) {
  const slot = Math.floor(Date.now() / windowMs), e = map.get(key);
  return !(e && e.slot === slot && e.n >= limit);
}
function count(map, key, windowMs) {
  const slot = Math.floor(Date.now() / windowMs), e = map.get(key);
  map.set(key, { slot, n: e && e.slot === slot ? e.n + 1 : 1 });
  if (map.size > 5000) map.clear();
}
function niceName(s) { return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
function toBase64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex">
<title>Pyinsect Reports</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Same look as the site's assets/site.css (copied so this page works on its own) */
:root {
  --bg: #f3f5ef;
  --surface: #ffffff;
  --ink: #1d2a22;
  --muted: #5d6b61;
  --line: #d6ddd2;
  --accent: #2f6b45;
  --accent-soft: #e2ede3;
  --alert: #b3261e;
  --alert-soft: #fbe7e4;
  --warn: #b45309;
  --warn-soft: #fdf0e1;
  --display: "Bricolage Grotesque", "Segoe UI", system-ui, sans-serif;
  --body: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121814; --surface: #1a221d; --ink: #e4ebe5; --muted: #9aa89e; --line: #2c3830;
    --accent: #7cc193; --accent-soft: #1f3226; --alert: #ff8a7a; --alert-soft: #3a1d1a;
    --warn: #ffb35c; --warn-soft: #3a2a14;
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }   /* .btn and others set display, which would beat the hidden attribute */
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--body); font-size: 15px; line-height: 1.5; }
.wrap { max-width: 820px; margin: 0 auto; padding: 32px 16px 64px; display: flex; flex-direction: column; gap: 28px; }
a { color: var(--accent); }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
header { display: flex; flex-direction: column; gap: 6px; }
nav { display: flex; gap: 16px; font-family: var(--mono); font-size: 13px; }
.eyebrow { font-family: var(--mono); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
h1 { font-family: var(--display); font-weight: 700; font-size: clamp(30px, 6vw, 44px); line-height: 1.05; margin: 0; text-wrap: balance; }
h2 { font-family: var(--display); font-weight: 500; font-size: 19px; margin: 0; }
.muted { color: var(--muted); }
.status { font-family: var(--mono); font-size: 13px; color: var(--muted); }
.status.error { color: var(--alert); }

.hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 24px; background: var(--surface); border: 1px solid var(--alert); border-radius: 14px; padding: 18px; box-shadow: inset 5px 0 0 var(--alert); }
.hero img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 10px; background: var(--alert-soft); display: block; }
.hero .info { min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.flag { align-self: flex-start; font-family: var(--mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; font-weight: 500; padding: 3px 9px; border-radius: 4px; background: var(--alert); color: var(--surface); }
.species { font-family: var(--display); font-weight: 700; font-size: clamp(28px, 5vw, 38px); line-height: 1.05; color: var(--alert); margin: 0; overflow-wrap: anywhere; }
.facts { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin: 0; font-size: 14px; }
.facts dt { font-family: var(--mono); font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; padding-top: 2px; }
.facts dd { margin: 0; font-variant-numeric: tabular-nums; }
.alts { display: flex; flex-direction: column; gap: 6px; }
.alt { display: grid; grid-template-columns: minmax(0, 1fr) 80px 46px; gap: 10px; align-items: center; font-size: 13px; }
.track { height: 6px; border-radius: 3px; background: var(--accent-soft); overflow: hidden; }
.fill { height: 100%; background: var(--accent); }
.pct { font-family: var(--mono); font-variant-numeric: tabular-nums; text-align: right; color: var(--muted); }

.ledger { display: flex; flex-direction: column; gap: 10px; }
.rows { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); overflow: hidden; }
.row { display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--line); }
.row:last-child { border-bottom: none; }
.row img { width: 56px; height: 56px; object-fit: cover; border-radius: 6px; background: var(--accent-soft); display: block; }
.row .what { min-width: 0; }
.row .what strong { display: block; overflow-wrap: anywhere; }
.row .when { font-family: var(--mono); font-size: 12px; color: var(--muted); text-align: right; white-space: nowrap; }
.tally { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { font-size: 13px; padding: 4px 10px; border-radius: 999px; background: var(--alert-soft); color: var(--alert); font-weight: 500; }
.empty { padding: 22px; border: 1px dashed var(--line); border-radius: 12px; background: var(--surface); color: var(--muted); }

.actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.btn { font: 500 14px var(--body); color: var(--ink); background: transparent; border: 1px solid var(--line); border-radius: 8px; padding: 9px 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
.btn:hover { border-color: var(--accent); color: var(--accent); }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--surface); }
.btn.primary:hover { filter: brightness(1.08); color: var(--surface); }
.btn:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn svg { width: 16px; height: 16px; }
@media (max-width: 600px) {
  .hero { grid-template-columns: 1fr; }
  .row { grid-template-columns: 48px minmax(0, 1fr); }
  .row img { width: 48px; height: 48px; }
  .row .when { grid-column: 2; text-align: left; }
}
.sci { font-style: italic; font-size: 14px; color: var(--muted); margin-top: -6px; overflow-wrap: anywhere; }
.hero img, .row { cursor: zoom-in; -webkit-tap-highlight-color: rgba(47, 107, 69, .15); touch-action: manipulation; }
@media (hover: none) { .hero img, .row, .viewer { cursor: pointer; } }
.row:hover { background: var(--accent-soft); }
.row:focus-visible, .hero img:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.viewer { position: fixed; top: 0; right: 0; bottom: 0; left: 0; width: 100%; height: 100%; z-index: 100; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 16px; background: rgba(8, 12, 10, .82); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); cursor: zoom-out; }
.viewer img { display: block; max-width: 100%; max-height: calc(100vh - 150px); object-fit: contain; border-radius: 10px; background: #000; }
.viewer .caption { max-width: 820px; width: 100%; color: #eef3ef; display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: baseline; justify-content: center; text-align: center; font-size: 14px; }
.viewer .caption strong { font-family: var(--display); font-size: 22px; color: #fff; }
.viewer .caption em { color: #c7d2ca; }
.viewer .caption span { font-family: var(--mono); font-size: 12px; color: #c7d2ca; }
.viewer .close { position: absolute; top: 12px; right: 12px; color: #fff; background: rgba(255, 255, 255, .14); border-color: rgba(255, 255, 255, .3); }
.login { display: flex; flex-direction: column; gap: 10px; max-width: 360px; padding: 18px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.login input[type=password] { font: 15px var(--mono); padding: 9px 11px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); }
.login label { font-size: 13px; color: var(--muted); display: flex; gap: 8px; align-items: center; }
.aibox { margin: -8px 0 18px; }
.aiwarn { color: var(--alert); font-weight: 600; }
/* Check level and Verify / Not a match buttons */
.checkbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 6px; }
.level { font-family: var(--mono); font-size: 12px; padding: 3px 10px; border-radius: 999px; border: 1px solid currentColor; }
.level.unchecked { color: var(--muted); }
.level.verified { color: #1f7a45; }
.level.not_match { color: var(--alert); }
.level.ai { color: #2f6fb3; }
.checkbar button { font: 600 13px var(--body); padding: 6px 12px; border-radius: 999px; cursor: pointer; border: 1.5px solid #1f7a45; background: transparent; color: inherit; }
.checkbar button.no { border-color: var(--alert); }
.checkbar button:disabled { opacity: .5; cursor: progress; }
/* Infested trees (tree damage found): a problem that needs action, in orange */
.flag.infested { background: var(--warn); }
.hero.infested { border-color: var(--warn); box-shadow: inset 5px 0 0 var(--warn); }
.hero.infested .species { color: var(--warn); }
.hero.infested .action { font-weight: 700; color: var(--warn); }
.row .infested-tag { color: var(--warn); font-weight: 700; }
.action-banner { margin: 0 0 18px; padding: 12px 16px; border-radius: 12px; background: var(--warn-soft); border-left: 5px solid var(--warn); color: var(--ink); font-weight: 600; }
/* Detect reports: every photo, with its step and the AI's best guess */
.strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
.strip figure { margin: 0; display: flex; flex-direction: column; gap: 3px; font-size: 12px; cursor: zoom-in; }
.strip img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; background: var(--accent-soft); display: block; }
.strip .muted { font-size: 11px; }
.flag.check { background: var(--accent); }
.flag.nothing { background: var(--muted); }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <span class="eyebrow">Pyinsect field reports · private</span>
    <h1>Latest report</h1>
    <span id="status" class="status">Loading…</span>
  </header>

  <div class="actions aibox" id="aiBox" hidden><span id="aiStatus" class="status"></span></div>

  <form id="login" class="login" hidden>
    <strong>Enter the reports password</strong>
    <input id="pw" type="password" autocomplete="current-password" required>
    <label><input id="remember" type="checkbox" checked> Remember on this device</label>
    <div class="actions"><button class="btn primary" type="submit">Open reports</button><span id="loginMsg" class="status error"></span></div>
  </form>

  <div id="actionBanner" class="action-banner" role="status" hidden></div>
  <section id="latest"></section>
  <section class="ledger" id="tallySection" hidden><h2 id="tallyTitle">Species reported</h2><div class="tally" id="tally"></div></section>
  <section class="ledger" id="earlierSection" hidden><h2>Earlier reports</h2><div class="rows" id="earlier"></div></section>
  <section class="ledger" id="nothingSection" hidden><h2>Trees checked, nothing found</h2><p class="muted">Private: these never go on the public map. They show where people use the app.</p><div class="rows" id="nothing"></div></section>
  <div class="actions" id="logoutBox" hidden><button id="logout" class="btn" type="button">Log out on this device</button></div>
</div>

<div id="viewer" class="viewer" role="dialog" aria-modal="true" aria-label="Full photo" hidden>
  <button id="viewerClose" class="btn close" type="button">Close</button>
  <img id="viewerImg" alt="">
  <div id="viewerCaption" class="caption"></div>
</div>

<script>
var REFRESH_MS = 15000, KEY = "pyinsect.viewpw";
var $ = function (id) { return document.getElementById(id); };
var password = null, timer = null, photoUrls = {};
try { password = localStorage.getItem(KEY) || sessionStorage.getItem(KEY); } catch (e) {}

function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function niceName(s) { return s.replace(/_/g, " ").replace(/\\b\\w/g, function (c) { return c.toUpperCase(); }); }
function when(iso) {
  var d = new Date(iso); if (isNaN(d)) return { ago: iso, full: iso };
  var m = Math.round((Date.now() - d) / 60000);
  var ago = m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " days ago";
  return { ago: ago, full: d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) };
}

function apiPost(path, body) {
  return fetch("api/" + path, { method: "POST", headers: { "X-Password": password || "", "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
var levels = {};   // report id -> check level, from the relay
var LEVEL_TEXT = { unchecked: "Not checked yet", ai: "AI checked", verified: "Verified", not_match: "Not a match" };

// The check level and the buttons to change it. Changing your mind? Tap the other button.
function checkBar(r) {
  var bar = el("div", "checkbar"), level = levels[r.id] || "unchecked";
  bar.append(el("span", "level " + level, LEVEL_TEXT[level] || level));
  function btn(text, cls, to) {
    var b = el("button", cls, text); b.type = "button";
    b.onclick = function (e) {
      e.stopPropagation();
      bar.querySelectorAll("button").forEach(function (x) { x.disabled = true; });
      apiPost("check/" + r.id, { level: to }).then(function (res) {
        if (res.status === 401) { showLogin("Wrong password."); return; }
        if (!res.ok) throw new Error("Error " + res.status);
        levels[r.id] = to; shownIds = ""; refresh();
      }).catch(function (err) {
        bar.querySelectorAll("button").forEach(function (x) { x.disabled = false; });
        $("status").className = "status error"; $("status").textContent = "Couldn't save the check: " + err.message;
      });
    };
    b.onkeydown = function (e) { e.stopPropagation(); };
    bar.append(b);
  }
  if (level !== "verified") btn("Verify ✓", "yes", "verified");
  if (level !== "not_match") btn("Not a match ✗", "no", "not_match");
  if (level === "verified" || level === "not_match") btn("Undo", "", "unchecked");
  return bar;
}

function api(path) {
  return fetch("api/" + path, { headers: { "X-Password": password || "" }, cache: path === "reports" ? "no-store" : "default" });
}

// Photos need the password header, so they're fetched as blobs (once each)
var photoBlobs = {};
function getPhoto(id) {
  if (!photoBlobs[id]) {
    photoBlobs[id] = api("photo/" + id).then(function (r) {
      if (!r.ok) throw new Error("photo " + r.status);
      return r.blob();
    }).then(function (b) { photoUrls[id] = URL.createObjectURL(b); return b; });
    photoBlobs[id].catch(function () { delete photoBlobs[id]; });
  }
  return photoBlobs[id];
}
function photo(img, id) { getPhoto(id).then(function () { img.src = photoUrls[id]; }, function () {}); }

// Tree check reports (kind "tree") have the signs the person saw instead of a confidence
function isTree(r) { return r.kind === "tree"; }
// Detect reports (the 3 Detect steps): several photos, and what was found in them
function isCheck(r) { return r.kind === "check" || r.kind === "nothing"; }
// Infested tree reports, and tree checks or Detect reports where the AI saw the damage: someone must take action
function needsAction(r) { return r.kind === "infested" || r.infested === true || (r.found && r.found.damage === true); }
function detail(r) {
  if (isCheck(r)) return "Found: " + (r.found_text || "nothing") + " · " + (r.items || []).length + " photo(s)";
  return isTree(r) ? "Signs seen: " + (r.signs_text || "none") : Number(r.confidence).toFixed(1) + "% confidence";
}
// A photo's key for /api/photo: "<id>" or "<id>-2"
function photoKey(file) { return file.replace(/\.jpg$/, ""); }

// Every photo of a Detect report, with its step, what the person said it shows, and the AI's best guess
function strip(r) {
  var box = el("div", "strip");
  (r.items || []).forEach(function (it) {
    var fig = el("figure"), img = el("img"), key = photoKey(it.photo), best = (it.top3 || [])[0];
    img.alt = it.step_name; img.loading = "lazy"; photo(img, key);
    fig.append(img, el("strong", null, it.step_name + (it.sign_text ? ": " + it.sign_text : "")));
    if (best) fig.append(el("span", "muted", "AI: " + (best.name || niceName(best.species)) + " " + Number(best.confidence).toFixed(0) + "%"));
    fig.tabIndex = 0; fig.title = "Show the whole photo";
    fig.onclick = function (e) { e.stopPropagation(); openViewer(r, key, it.step_name); };
    fig.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); openViewer(r, key, it.step_name); } };
    box.append(fig);
  });
  return box;
}
function flagFor(r) {
  if (needsAction(r)) return el("span", "flag infested", "Infested tree: take action");
  if (r.kind === "nothing") return el("span", "flag nothing", "Nothing found");
  if (r.kind === "check") return el("span", "flag check", "Detect report");
  return el("span", "flag", isTree(r) ? "Tree check" : "Invasive");
}

function hero(r) {
  var card = el("article", "hero" + (needsAction(r) ? " infested" : "")), img = el("img"), info = el("div", "info");
  img.alt = "Photo of the reported " + r.name; photo(img, r.id);
  info.append(flagFor(r), el("p", "species", r.name || niceName(r.species)));
  if (needsAction(r)) info.append(el("span", "action", "The AI found " + (r.pest || "pest") + " damage. This tree needs action soon."));
  else if (isTree(r) && r.pest) info.append(el("span", "sci", "Looking for signs of the " + r.pest));
  else if (r.scientific && r.scientific !== r.name) info.append(el("span", "sci", r.scientific));
  var w = when(r.timestamp), facts = el("dl", "facts");
  [["Reported", w.ago + " · " + w.full], isCheck(r) ? ["Found", r.found_text || "nothing"] : isTree(r) ? ["Signs seen", r.signs_text || "none"] : ["Confidence", Number(r.confidence).toFixed(1) + "%"],
    ["Team spot", r.spot ? r.spot.lat + ", " + r.spot.lon + " (about 75 m)" : "none"], ["Model", r.model || "—"], ["Report", r.id]]
    .forEach(function (kv) { facts.append(el("dt", null, kv[0]), el("dd", null, kv[1])); });
  var dd = el("dd"); dd.append(aiSpan(r.id));
  facts.append(el("dt", null, "AI check"), dd);
  info.append(facts);
  if (isCheck(r)) info.append(el("span", "eyebrow", "All photos (tap one to see it big)"), strip(r));
  if (!isCheck(r) && Array.isArray(r.top3) && r.top3.length) {
    info.append(el("span", "eyebrow", isTree(r) ? "Bug model's guesses (only useful if a bug is in the photo)" : "Model's top guesses"));
    var alts = el("div", "alts");
    r.top3.forEach(function (a) {
      var row = el("div", "alt"), track = el("div", "track"), fill = el("div", "fill");
      fill.style.width = Math.min(100, a.confidence) + "%"; track.append(fill);
      row.append(el("span", null, a.name || niceName(a.species)), track, el("span", "pct", Number(a.confidence).toFixed(0) + "%"));
      alts.append(row);
    });
    info.append(alts);
  }
  img.tabIndex = 0; img.title = "Show the whole photo";
  img.onclick = function () { openViewer(r); };
  img.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openViewer(r); } };
  info.append(checkBar(r));
  card.append(img, info);
  return card;
}

function row(r) {
  var x = el("div", "row"), img = el("img"), what = el("div", "what");
  img.alt = ""; img.loading = "lazy"; photo(img, r.id);
  what.append(el("strong", null, r.name || niceName(r.species)), ...(needsAction(r) ? [el("span", "infested-tag", "⚠ Take action · ")] : []),
    el("span", "muted", detail(r) + " · "), aiSpan(r.id), checkBar(r));
  if (isCheck(r)) what.append(strip(r));
  x.append(img, what, el("span", "when", when(r.timestamp).full));
  x.tabIndex = 0; x.setAttribute("role", "button"); x.title = "Show the whole photo";
  x.onclick = function () { openViewer(r); };
  x.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openViewer(r); } };
  return x;
}

var shownIds = "";
async function refresh() {
  var status = $("status");
  try {
    var res = await api("reports");
    if (res.status === 401) { showLogin("Wrong password."); return; }
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || ("Error " + res.status));
    $("login").hidden = true; $("logoutBox").hidden = false; $("aiBox").hidden = false;
    levels = data.levels || {};
    var list = data.reports, ids = list.map(function (r) { return r.id; }).join() + JSON.stringify(levels);
    lastList = list;
    if (ids !== shownIds) {
      shownIds = ids;
      // Infested trees in the newest reports that nobody marked "not a match"
      var sick = list.filter(function (r) { return needsAction(r) && levels[r.id] !== "not_match"; }).length;
      $("actionBanner").textContent = "⚠ " + sick + " infested tree" + (sick === 1 ? "" : "s") + " reported. " + (sick === 1 ? "It needs" : "They need") + " action: look for the orange “Take action” labels below.";
      $("actionBanner").hidden = !sick;
      var box = $("latest"); box.innerHTML = "";
      if (!list.length) box.append(el("div", "empty", "No reports yet. New invasive finds and tree checks appear here within seconds."));
      else box.append(hero(list[0]));
      var earlier = $("earlier"); earlier.innerHTML = "";
      list.slice(1).forEach(function (r) { earlier.append(row(r)); });
      $("earlierSection").hidden = list.length < 2;
      var counts = {};
      list.forEach(function (r) { var n = r.name || niceName(r.species); counts[n] = (counts[n] || 0) + 1; });
      var tally = $("tally"); tally.innerHTML = "";
      Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })
        .forEach(function (n) { tally.append(el("span", "chip", n + " × " + counts[n])); });
      $("tallyTitle").textContent = data.total > list.length ? "Species in the newest " + list.length + " reports" : "Species reported";
      $("tallySection").hidden = !list.length;
      aiScan(list);
    }
    refreshNothing();
    status.className = "status";
    status.textContent = data.total + " report" + (data.total === 1 ? "" : "s") + " · checked " +
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " · refreshes every 15 seconds";
  } catch (e) {
    status.className = "status error";
    status.textContent = e.message + " Retrying…";
  }
}

// "Nothing found" Detect reports: their own private list, under the others
var nothingIds = "";
async function refreshNothing() {
  try {
    var res = await api("nothing");
    if (!res.ok) return;
    var data = await res.json(), list = data.reports || [], ids = list.map(function (r) { return r.id; }).join();
    if (ids === nothingIds) return;
    nothingIds = ids;
    var box = $("nothing"); box.innerHTML = "";
    list.forEach(function (r) { box.append(row(r)); });
    $("nothingSection").hidden = !list.length;
  } catch (e) {}   // try again on the next refresh
}

function showLogin(msg) {
  clearInterval(timer); timer = null;
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (e) {}
  password = null; shownIds = "";
  ["latest", "earlier", "tally", "nothing"].forEach(function (id) { $(id).innerHTML = ""; });
  nothingIds = "";
  $("nothingSection").hidden = $("earlierSection").hidden = $("tallySection").hidden = $("logoutBox").hidden = $("aiBox").hidden = $("actionBanner").hidden = true;
  $("login").hidden = false; $("loginMsg").textContent = msg || "";
  $("status").className = "status"; $("status").textContent = "Password needed";
  $("pw").focus();
}

function start() {
  refresh();
  if (!timer) timer = setInterval(function () { if (!document.hidden) refresh(); }, REFRESH_MS);
}

$("login").onsubmit = function (e) {
  e.preventDefault();
  password = $("pw").value; $("pw").value = "";
  try { ($("remember").checked ? localStorage : sessionStorage).setItem(KEY, password); } catch (e) {}
  start();
};
$("logout").onclick = function () { showLogin(""); };
document.addEventListener("visibilitychange", function () { if (!document.hidden && timer) refresh(); });

// Full, uncropped photo with the report's details; click anywhere or press Esc to close.
// key and label: one photo of a Detect report (else its first photo)
var viewerReturn = null;
function openViewer(r, key, label) {
  viewerReturn = document.activeElement;
  var img = $("viewerImg");
  img.removeAttribute("src"); img.alt = "Photo of the reported " + (r.name || niceName(r.species));
  photo(img, key || r.id);
  var cap = $("viewerCaption"); cap.innerHTML = "";
  cap.append(el("strong", null, (r.name || niceName(r.species)) + (label ? " · " + label : "")));
  if (!isTree(r) && r.scientific && r.scientific !== r.name) cap.append(el("em", null, r.scientific));
  var w = when(r.timestamp);
  cap.append(el("span", null, detail(r) + " · " + w.full + " · " + (r.model || "")));
  var ai = aiSpan(r.id); if (ai.textContent) cap.append(ai);
  $("viewer").hidden = false;
  document.body.style.overflow = "hidden";
  $("viewerClose").focus();
}
function closeViewer() {
  if ($("viewer").hidden) return;
  $("viewer").hidden = true;
  document.body.style.overflow = "";
  if (viewerReturn && viewerReturn.focus) viewerReturn.focus();
}
$("viewer").onclick = closeViewer;
document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeViewer(); });

// Free AI detector (assets/aidetect.js on the Pyinsect site), always on. It runs here, in this browser,
// on the saved photos, so visitors download nothing and can't skip it. 172 MB the first time per device.
// The user chose plain "AI-made" / "Real" labels; the % is the detector's score (it does make mistakes).
var SITE = "https://wizkidzai.github.io/pyinsect/", AI_SCORES = "pyinsect.aiscores";
var aiOn = true, aiScores = {}, aiQueue = [], aiBusy = false, aiReady = null, lastList = [];
try { aiScores = JSON.parse(localStorage.getItem(AI_SCORES) || "{}") || {}; } catch (e) {}

function aiStatus(text, bad) { var s = $("aiStatus"); s.className = "status" + (bad ? " error" : ""); s.textContent = text; }
function aiSpan(id) { var e = el("span"); e.setAttribute("data-ai", id); aiShowEl(e); return e; }
function aiShowEl(e) {
  var v = aiScores[e.getAttribute("data-ai")];
  if (v == null) { e.className = "muted"; e.textContent = "AI check: checking…"; return; }
  var pct = Math.round(v * 100);
  e.className = v >= 0.7 ? "aiwarn" : "muted";
  e.textContent = v >= 0.7 ? "AI-made (" + pct + "%)" : "Real (" + (100 - pct) + "%)";
}
function aiShowAll() { document.querySelectorAll("[data-ai]").forEach(aiShowEl); }

function loadScript(src) {
  return new Promise(function (ok, bad) {
    var s = document.createElement("script"); s.src = src; s.onload = ok;
    s.onerror = function () { bad(new Error("could not load " + src)); };
    document.head.append(s);
  });
}
function aiLoad() {
  if (!aiReady) {
    aiReady = (typeof ort === "undefined" ? loadScript("https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.js") : Promise.resolve())
      .then(function () { return typeof AIDetect === "undefined" ? loadScript(SITE + "assets/aidetect.js?v=1") : null; })
      .then(function () { return AIDetect.load(function (p) { aiStatus("Loading the AI detector… " + p + "%"); }); });
    aiReady.catch(function () { aiReady = null; });
  }
  return aiReady;
}

function aiScan(list) {
  if (!aiOn) return;
  list.forEach(function (r) { if (aiScores[r.id] == null && aiQueue.indexOf(r.id) < 0) aiQueue.push(r.id); });
  aiNext();
}
async function aiNext() {
  if (aiBusy) return;
  aiBusy = true;
  try {
    if (aiQueue.length) await aiLoad();
    while (aiQueue.length && aiOn) {
      var id = aiQueue[0];
      aiStatus("Checking photos for AI… " + aiQueue.length + " left");
      try {
        aiScores[id] = Math.round((await AIDetect.score(await getPhoto(id))) * 1000) / 1000;
        var keep = Object.keys(aiScores).sort().slice(-300), small = {};
        keep.forEach(function (k) { small[k] = aiScores[k]; });
        try { localStorage.setItem(AI_SCORES, JSON.stringify(small)); } catch (e) {}
      } catch (e) {}
      aiQueue.shift();
      aiShowAll();
    }
    aiStatus("AI check: done");
  } catch (e) {
    aiQueue = [];
    aiStatus("The AI detector didn't load: " + e.message, true);
  }
  aiBusy = false;
}

if (password) start(); else showLogin("");
</script>
</body>
</html>`;
