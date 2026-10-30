// Pyinsect checks. Run before sharing work:   node scripts/check.js
// GitHub runs the same checks on every pull request (.github/workflows/checks.yml).
// Each check prints ✅ or ❌ with what to fix. No installs needed, just Node.js.

const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
process.chdir(ROOT);

let failed = 0;
function report(name, problems, fix) {
  if (problems.length === 0) return console.log(`✅ ${name}`);
  failed++;
  console.log(`❌ ${name}`);
  for (const p of problems) console.log(`   - ${p}`);
  if (fix) console.log(`   How to fix: ${fix}`);
}

// Every file in the project, including new files not added to git yet (but not ignored ones).
// Submodules (like skills/shared) show up as folders, so we skip anything that isn't a file.
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .split("\n").filter(f => f && fs.existsSync(f) && fs.statSync(f).isFile());
const strings = text => [...text.replace(/\/\/.*$/gm, "").matchAll(/"([^"]*)"/g)].map(m => m[1]);
const listIn = (text, start) => {
  const i = text.indexOf(start);
  return i < 0 ? null : strings(text.slice(i, text.indexOf("]", i)));
};

// 1. JavaScript has no typing mistakes
{
  const problems = [];
  for (const f of files.filter(f => f.endsWith(".js"))) {
    const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
    if (r.status !== 0) problems.push(`${f}: ${(r.stderr.split("\n").find(l => /Error/.test(l)) || "syntax error").trim()}`);
  }
  report("JavaScript has no typing mistakes", problems,
    "open the file, go to the line it names, and look for a missing bracket, quote, or comma.");
}

// 2. The invasive lists match, every invasive species is a real class, and model sizes are right
{
  const problems = [];
  const worker = listIn(fs.readFileSync("relay/worker.js", "utf8"), "const INVASIVE");
  for (const f of files.filter(f => /^assets\/models\/.*\.js$/.test(f))) {
    const text = fs.readFileSync(f, "utf8");
    const classes = listIn(text, "classes:") || [];
    for (const s of listIn(text, "invasive:") || []) {
      if (!worker.includes(s)) problems.push(`"${s}" is invasive in ${f} but missing from INVASIVE in relay/worker.js`);
      if (!classes.includes(s)) problems.push(`"${s}" is invasive in ${f} but isn't one of its classes (spelling?)`);
    }
    const url = text.match(/new URL\("(?:\.\.\/)+([^"]+)"/), size = text.match(/size:\s*(\d+)/);
    if (url && size && fs.existsSync(url[1]) && fs.statSync(url[1]).size !== Number(size[1]))
      problems.push(`${f} says size ${size[1]}, but ${url[1]} is ${fs.statSync(url[1]).size} bytes`);
  }
  report("Invasive lists match and model settings are right", problems,
    "add the species to both lists (see rule 5 in AGENTS.md), or fix the size in the model settings file.");
}

// 2b. The tree checks match: each assets/trees/*.js file is in TREE_CHECKS in relay/worker.js, with
// the same pest and the same question ids (the relay refuses reports with signs it doesn't know)
{
  const vm = require("vm");
  const problems = [];
  const worker = fs.readFileSync("relay/worker.js", "utf8");
  const start = worker.indexOf("const TREE_CHECKS = ");
  let relayTrees = {};
  try { relayTrees = vm.runInNewContext("(" + worker.slice(start + 20, worker.indexOf("\n};", start) + 2) + ")"); }
  catch { problems.push("couldn't read TREE_CHECKS in relay/worker.js"); }
  for (const f of files.filter(f => /^assets\/trees\/.*\.js$/.test(f))) {
    const sandbox = { window: {} };
    try { vm.runInNewContext(fs.readFileSync(f, "utf8"), sandbox); }
    catch (e) { problems.push(`${f}: ${e.message}`); continue; }
    for (const t of sandbox.window.PYINSECT_TREES || []) {
      const r = relayTrees[t.id];
      if (!r) { problems.push(`"${t.id}" in ${f} is missing from TREE_CHECKS in relay/worker.js`); continue; }
      if (r.pest !== t.pest) problems.push(`${f} says the pest is "${t.pest}", but relay/worker.js says "${r.pest}"`);
      const ids = t.questions.map(q => q.id).sort().join(), relayIds = Object.keys(r.signs).sort().join();
      if (ids !== relayIds) problems.push(`${f} has questions [${ids}], but relay/worker.js has signs [${relayIds}]`);
    }
  }
  report("Tree checks match the relay", problems,
    "make TREE_CHECKS in relay/worker.js match the tree settings file (see rule 5 in AGENTS.md). A grown-up then redeploys the relay.");
}

// 2c. The rough area grids (reports map) are the same on the site and the relay: both must round a
// spot to the same ~200 m square (public map) and ~75 m square (team spot), or the map would put
// reports in the wrong place
{
  const vm = require("vm");
  const problems = [];
  const load = f => {
    const text = fs.readFileSync(f, "utf8"), at = text.indexOf("function snapToGrid(");
    const deg = name => (text.match(new RegExp(name + " = ([\\d.]+)")) || [])[1];
    if (!deg("AREA_DEG") || !deg("SPOT_DEG") || at < 0) { problems.push(`${f}: couldn't find AREA_DEG, SPOT_DEG and snapToGrid`); return null; }
    const snap = vm.runInNewContext(`${text.slice(at, text.indexOf("\n}\n", at) + 2)}; snapToGrid`);
    return { area: (lat, lon) => snap(lat, lon, +deg("AREA_DEG")), spot: (lat, lon) => snap(lat, lon, +deg("SPOT_DEG")) };
  };
  const site = load("assets/app.js"), relay = load("relay/worker.js");
  if (site && relay) {
    for (const [lat, lon] of [[45.5231, -122.6765], [44.0521, -123.0868], [-33.8688, 151.2093], [0.004, 0.004], [89.99, 179.99], [-89.99, -179.99]]) {
      for (const grid of ["area", "spot"]) {
        const a = JSON.stringify(site[grid](lat, lon)), b = JSON.stringify(relay[grid](lat, lon));
        if (a !== b) problems.push(`spot ${lat}, ${lon} (${grid}): the site says ${a}, the relay says ${b}`);
      }
    }
  }
  report("Rough area grids match the relay", problems,
    "make snapToGrid, AREA_DEG and SPOT_DEG in assets/app.js and relay/worker.js exactly the same. A grown-up then redeploys the relay.");
}

// 3. No secrets (this code is public)
{
  const SECRET = new RegExp([
    "gh[pousr]_[A-Za-z0-9]{30,}", "github_pat_[A-Za-z0-9_]{30,}", "sk-ant-[A-Za-z0-9_-]{20,}",
    "AKIA[0-9A-Z]{16}", "-----BEGIN [A-Z ]*PRIVATE KEY-----",
  ].join("|"));
  const problems = [];
  for (const f of files) {
    if (f.startsWith("model/") || fs.statSync(f).size > 2e6) continue;
    fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      if (SECRET.test(line)) problems.push(`${f} line ${i + 1} looks like a password or token`);
    });
  }
  report("No secrets", problems,
    "delete it from the file and tell a grown-up right away, because the token may need to be replaced.");
}

// 4. No report photos or data, and no huge files
{
  const problems = [];
  for (const f of files) {
    const size = fs.statSync(f).size, mb = (size / 1e6).toFixed(1);
    if (f.startsWith("reports/")) problems.push(`${f}: reports must stay in the private reports repo`);
    // Small help photos for the tree check are allowed in assets/trees/ (reports never go there)
    else if (/^assets\/trees\/[^/]+\.jpe?g$/i.test(f)) { if (size > 300e3) problems.push(`${f} is ${(size / 1e3).toFixed(0)} KB; help photos must be under 300 KB (make it smaller)`); }
    else if (/\.(jpe?g|heic|webp)$/i.test(f)) problems.push(`${f}: photos look like reports; don't save them here`);
    else if (f.startsWith("model/") ? size > 95e6 : size > 5e6) problems.push(`${f} is ${mb} MB, which is too big`);
  }
  report("No report photos or huge files", problems,
    "remove the file from the project (ask a grown-up if it's a model file).");
}

// 5. Game translations: every sentence has Spanish and French, with the same {names}
if (fs.existsSync("assets/game-i18n.js")) {
  const problems = [];
  let dict = {};
  try { dict = new Function(fs.readFileSync("assets/game-i18n.js", "utf8") + "; return GAME_I18N;")(); }
  catch (e) { problems.push(`assets/game-i18n.js: ${e.message}`); }
  const holes = text => (text.match(/\{\w+\}/g) || []).sort().join(" ");
  for (const [en, list] of Object.entries(dict)) {
    if (!Array.isArray(list) || list.length !== 2 || list.some(x => !x)) { problems.push(`"${en}" needs 2 translations: [Spanish, French]`); continue; }
    list.forEach((x, i) => {
      if (holes(x) !== holes(en)) problems.push(`"${en}": the ${["Spanish", "French"][i]} needs the same {curly bracket} words as the English`);
    });
  }
  // Sentences written straight into t("...") in the game must be in the dictionary
  const game = fs.existsSync("assets/game.js") ? fs.readFileSync("assets/game.js", "utf8") : "";
  for (const m of game.matchAll(/\bt\("((?:[^"\\]|\\.)*)"[,)]/g)) {
    const en = JSON.parse(`"${m[1]}"`);
    if (!dict[en]) problems.push(`"${en}" is in assets/game.js but has no translation in assets/game-i18n.js`);
  }
  report("Game translations are complete", problems,
    "add the sentence to assets/game-i18n.js with [Spanish, French] (and to assets/i18n/zh.js for Mandarin), and keep {curly bracket} words the same.");
}

// 6. Game languages with their own file in assets/i18n/ (Mandarin): the same {names}, and every t("...") sentence
if (fs.existsSync("assets/i18n")) {
  const problems = [];
  const holes = text => (text.match(/\{\w+\}/g) || []).sort().join(" ");
  const base = fs.readFileSync("assets/game-i18n.js", "utf8");
  const game = fs.existsSync("assets/game.js") ? fs.readFileSync("assets/game.js", "utf8") : "";
  const literals = [...game.matchAll(/\bt\("((?:[^"\\]|\\.)*)"[,)]/g)].map(m => JSON.parse(`"${m[1]}"`));
  for (const f of fs.readdirSync("assets/i18n").filter(f => f.endsWith(".js"))) {
    let extra = {};
    try { extra = new Function(base + "\n" + fs.readFileSync(`assets/i18n/${f}`, "utf8") + "; return GAME_EXTRA;")(); }
    catch (e) { problems.push(`assets/i18n/${f}: ${e.message}`); continue; }
    for (const [lang, dict] of Object.entries(extra)) {
      for (const [en, x] of Object.entries(dict)) {
        if (!x) problems.push(`assets/i18n/${f}: "${en}" is empty`);
        else if (holes(x) !== holes(en)) problems.push(`assets/i18n/${f}: "${en}" needs the same {curly bracket} words as the English`);
      }
      for (const en of new Set(literals)) if (!dict[en]) problems.push(`assets/i18n/${f} (${lang}): "${en}" has no translation`);
    }
  }
  report("Other game languages are complete", problems,
    "add the sentence to the language's file in assets/i18n/, and keep {curly bracket} words the same.");
}

console.log(failed ? `\n${failed} check(s) need fixing.` : "\nAll checks passed!");
process.exit(failed ? 1 : 0);
