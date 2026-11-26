// Pyinsect Benchmark: Pyinsect (the website's model) runs on this device. An LLM's answers come from a results
// file that a grown-up makes with openrouter_test.py. This page never contacts OpenRouter and holds no key.
// Needs window.PYINSECT_MODEL (assets/models/), window.findInsect and the names in assets/species.js.

const MODEL = window.PYINSECT_MODEL;
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// The insects to choose from. "Other insect" is not one of them.
const SPECIES = MODEL.classes.filter((s) => s !== MODEL.otherClass);
const label = (s) => (s === MODEL.otherClass ? commonName(s) : `${commonName(s)} (${sciName(s)})`);
const byLabel = new Map(SPECIES.map((s) => [label(s).toLowerCase(), s]));
for (const s of SPECIES) $("names").append(new Option(label(s)));

const softmax = (values) => {
  const m = Math.max(...values), e = values.map((v) => Math.exp(v - m)), sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
};
const best3 = (probs, names) => [...probs.keys()].sort((a, b) => probs[b] - probs[a]).slice(0, 3)
  .map((i) => ({ species: names[i], confidence: probs[i] * 100 }));

/* ---------- Pyinsect: photos are prepared exactly like assets/app.js does it ---------- */
const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];
const roundHalfEven = (v) => { const f = Math.floor(v), d = v - f; return d > 0.5 || (d === 0.5 && f % 2) ? f + 1 : f; };

function pilCoeffs(inSize, outSize, from, count) {
  const scale = inSize / outSize, support = Math.max(scale, 1);
  const res = [];
  for (let o = from; o < from + count; o++) {
    const center = (o + 0.5) * scale;
    const min = Math.max(Math.trunc(center - support + 0.5), 0);
    const max = Math.min(Math.trunc(center + support + 0.5), inSize);
    const w = []; let sum = 0;
    for (let x = min; x < max; x++) {
      const t = Math.abs((x - center + 0.5) / support);
      const v = t < 1 ? 1 - t : 0; w.push(v); sum += v;
    }
    res.push({ min, w: w.map((v) => v / sum) });
  }
  return res;
}

function preprocess(bmp) {
  const { width: w, height: h } = bmp;
  let cx, cy;
  if (MODEL.resize === "squash") {
    cx = pilCoeffs(w, 224, 0, 224); cy = pilCoeffs(h, 224, 0, 224);
  } else {
    const [nw, nh] = w < h ? [256, Math.trunc(h * 256 / w)] : [Math.trunc(w * 256 / h), 256];
    cx = pilCoeffs(w, nw, roundHalfEven((nw - 224) / 2), 224); cy = pilCoeffs(h, nh, roundHalfEven((nh - 224) / 2), 224);
  }
  const y0 = cy[0].min, y1 = cy[223].min + cy[223].w.length, BAND = 64;
  const mid = new Uint8ClampedArray((y1 - y0) * 224 * 3);
  const c = document.createElement("canvas");
  c.width = w; c.height = Math.min(BAND, y1 - y0);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  for (let top = y0; top < y1; top += BAND) {   // in strips, so big phone photos don't run out of memory
    const rows = Math.min(BAND, y1 - top);
    ctx.clearRect(0, 0, w, c.height);
    ctx.drawImage(bmp, 0, top, w, rows, 0, 0, w, rows);
    const src = ctx.getImageData(0, 0, w, rows).data;
    for (let y = top; y < top + rows; y++) {
      const row = (y - top) * w * 4, outRow = (y - y0) * 224 * 3;
      for (let x = 0; x < 224; x++) {
        const { min, w: k } = cx[x];
        for (let ch = 0; ch < 3; ch++) {
          let v = 0;
          for (let i = 0; i < k.length; i++) v += src[row + (min + i) * 4 + ch] * k[i];
          mid[outRow + x * 3 + ch] = Math.round(v);
        }
      }
    }
  }
  c.width = c.height = 0;
  const out = new Float32Array(3 * 224 * 224), plane = 224 * 224;
  for (let y = 0; y < 224; y++) {
    const { min, w: k } = cy[y];
    for (let x = 0; x < 224; x++) {
      for (let ch = 0; ch < 3; ch++) {
        let v = 0;
        for (let i = 0; i < k.length; i++) v += mid[((min - y0 + i) * 224 + x) * 3 + ch] * k[i];
        v = Math.min(255, Math.max(0, Math.round(v)));
        out[ch * plane + y * 224 + x] = (v / 255 - MEAN[ch]) / STD[ch];
      }
    }
  }
  return new ort.Tensor("float32", out, [1, 3, 224, 224]);
}

const sessions = {};
function session(url) {
  sessions[url] = sessions[url] || (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`could not download the model (${res.status})`);
    return ort.InferenceSession.create(await res.arrayBuffer(), { executionProviders: ["wasm"] });
  })().catch((e) => { delete sessions[url]; throw e; });
  return sessions[url];
}

// One look by Pyinsect. Small photos go to the low-resolution copy, like on the website.
async function pyinsectOnce(blob) {
  const raw = await createImageBitmap(blob, { colorSpaceConversion: "none" });
  const small = MODEL.lowres && Math.min(raw.width, raw.height) < MODEL.lowres.smallPx;
  const s = await session(small ? MODEL.lowres.url : MODEL.url);
  const out = await s.run({ [s.inputNames[0]]: preprocess(raw) });
  raw.close();
  return best3(softmax(Array.from((out.logits || out[s.outputNames[0]]).data)), MODEL.classes);
}

// Like the website: tree damage and egg masses are judged on the whole photo.
const wholeScene = (s) => /_(damage|egg_mass)$/.test(s) || (MODEL.wholeScene || []).includes(s);
async function pyinsect(cut, whole) {
  const result = await pyinsectOnce(cut);
  if (cut === whole) return result;
  const full = await pyinsectOnce(whole);
  return wholeScene(full[0].species) || wholeScene(result[0].species) ? full : result;
}

/* ---------- photos ---------- */
// The part of the photo with the insect (our insect finder), or the whole photo.
async function cutOut(file) {
  const bmp = await createImageBitmap(file);
  let box = null;
  try { box = await window.findInsect(bmp); } catch (e) { console.warn("insect finder:", e); }
  const c = document.createElement("canvas");
  if (box) {
    c.width = Math.max(1, Math.round(box.w * bmp.width));
    c.height = Math.max(1, Math.round(box.h * bmp.height));
    c.getContext("2d").drawImage(bmp, box.x * bmp.width, box.y * bmp.height, c.width, c.height, 0, 0, c.width, c.height);
  }
  bmp.close();
  return box ? new Promise((res) => c.toBlob(res, "image/png")) : file;
}

const timed = async (run) => {
  const t = performance.now();
  const top3 = await run();
  return { top3, ms: performance.now() - t };
};

/* ---------- getting the AIs ready (the first time a photo is picked) ---------- */
let ready = null;
function getReady(status) {
  ready = ready || (async () => {
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
    status("Downloading Pyinsect…");
    await session(MODEL.url);
    if (MODEL.lowres) await session(MODEL.lowres.url);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}
const NOT_LOADED = "Pyinsect couldn't be loaded. Check the internet connection and try again.";

// Only one photo at a time.
let queue = Promise.resolve();
function check(file) {
  const job = queue.then(async () => {
    const cut = await cutOut(file);
    return timed(() => pyinsect(cut, file));
  });
  queue = job.catch(() => {});
  return job;
}

/* ---------- tabs ---------- */
function openTab(bench) {
  $("tabTry").setAttribute("aria-selected", String(!bench));
  $("tabBench").setAttribute("aria-selected", String(bench));
  $("pageTry").hidden = bench;
  $("pageBench").hidden = !bench;
}
$("tabTry").onclick = () => openTab(false);
$("tabBench").onclick = () => openTab(true);

/* ---------- Try it: one photo ---------- */
const AIS = [["pyinsect", "Pyinsect"], ["llm", "Llm"]];
function showGuesses(result) {
  const guesses = result ? result.top3 : [null, null, null];
  $("guessPyinsect").replaceChildren(...guesses.map((g) => {
    const li = el("li");
    li.append(el("span", null, g ? commonName(g.species) : "insect"), el("b", null, g ? `${g.confidence.toFixed(0)}%` : "__%"));
    return li;
  }));
  $("speedPyinsect").textContent = result ? `${(result.ms / 1000).toFixed(1)} s` : "–";
}
showGuesses(null);

let current = null;   // the photo on screen
function showPhoto(file) {
  if ($("shown").src) URL.revokeObjectURL($("shown").src);
  current = file;
  if (file) $("shown").src = URL.createObjectURL(file);
  else $("shown").removeAttribute("src");
  $("shown").alt = file ? file.name : "";
  $("shown").hidden = !file;
  $("placeholder").hidden = Boolean(file);
  $("remove").hidden = !file;
  showGuesses(null);
}
async function tryPhoto(file) {
  showPhoto(file);
  const status = (t) => { if (current === file) $("status").textContent = t; };
  try {
    await getReady(status);
  } catch (e) { console.error(e); status(NOT_LOADED); return; }
  try {
    status("Pyinsect is looking…");
    const results = await check(file);
    if (current !== file) return;   // removed, or another photo was picked
    showGuesses(results);
    status("Done.");
  } catch (e) { console.error(e); status("Couldn't check this photo. Try a JPG or PNG picture."); }
}
$("pick").onclick = () => $("file").click();
$("file").onchange = () => {
  const [file] = $("file").files;
  $("file").value = "";
  if (file) tryPhoto(file);
};
$("remove").onclick = () => { showPhoto(null); $("status").textContent = "Photo removed."; };

/* ---------- Benchmark: a folder or many photos ---------- */
// The right answer comes from the file name or a folder name, like "emerald ash borer/photo_01.jpg"
// or "agrilus_planipennis_003.jpg". The longest insect name found wins.
const plain = (text) => ` ${text.toLowerCase().replace(/[^a-z]+/g, " ").trim()} `;
const NAMES = SPECIES.flatMap((s) => [commonName(s), sciName(s), s].map((name) => [plain(name), s]))
  .sort((a, b) => b[0].length - a[0].length);
function truthFor(file) {
  const parts = (file.webkitRelativePath || file.name).split("/").reverse();   // the file name first, then folders
  for (const part of parts) {
    const text = plain(part.replace(/\.[a-z0-9]+$/i, ""));
    const found = NAMES.find(([name]) => text.includes(name));
    if (found) return found[1];
  }
  return null;
}

// The LLM's answers, loaded from the results file: file name -> { top3, seconds, cost }.
let llm = null;
// One point per photo: totals so far. Pyinsect's cost stays 0, because it runs on this device.
let totals = [];
const svg = (tag, attrs, text) => {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};
const money = (v) => (v === 0 ? "$0" : `$${v.toFixed(v < 0.1 ? 4 : 2)}`);
function drawGraphs() {
  const last = totals[totals.length - 1];
  const W = 240, H = 210, left = 14, right = 8, top = 8, bottom = 38;
  const most = Math.max(10, totals.length);
  const x = (n) => left + (n / most) * (W - left - right);
  // Each kind of line has one scale for both graphs.
  const biggest = (key) => (last ? Math.max(last.pyinsect[key], last.llm ? last.llm[key] : 0) : 0) || 1;
  const scale = { right: Math.max(1, totals.length), seconds: biggest("seconds"), cost: biggest("cost") };
  const y = (share) => top + (1 - share) * (H - top - bottom);
  for (const [ai, id] of AIS) {
    const has = Boolean(last && last[ai]);
    const graph = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
    graph.setAttribute("aria-label", `${ai === "llm" ? "LLM" : "Pyinsect"}: accuracy, speed and cost as photos are added`);
    graph.append(svg("path", { class: "axis", d: `M${left} ${top}V${y(0)}H${W - right}` }));
    for (const n of [0, Math.round(most / 2), most]) graph.append(svg("text", { x: x(n), y: y(0) + 16, "text-anchor": "middle" }, n));
    graph.append(svg("text", { x: (left + W - right) / 2, y: H - 4, "text-anchor": "middle" }, "Number of photos"));
    if (has || !totals.length) {
      for (const [kind, key] of [["accuracy", "right"], ["speed", "seconds"], ["cost", "cost"]]) {
        const points = [[0, 0], ...totals.map((t, i) => [i + 1, t[ai][key] / scale[key]])];
        graph.append(svg("polyline", { class: `line ${kind}`, points: points.map(([n, share]) => `${x(n)},${y(share)}`).join(" ") }));
      }
    }
    $(`graph${id}`).replaceChildren(graph);
    $(`sum${id}`).textContent = has
      ? `Right: ${last[ai].right} of ${totals.length} (${Math.round((100 * last[ai].right) / totals.length)}%). Time: ${last[ai].seconds.toFixed(1)} s. Cost: ${money(last[ai].cost)}.`
      : ai === "llm" && !llm ? "Load the grown-up's results file." : "No photos yet.";
  }
}
drawGraphs();

// The results file made by openrouter_test.py.
$("pickResults").onclick = () => $("results").click();
$("results").onchange = async () => {
  const [file] = $("results").files;
  $("results").value = "";
  if (!file || running) return;
  try {
    const data = JSON.parse(await file.text());
    const entries = Object.entries(data.photos);
    if (!entries.length || !entries.every(([, p]) => Array.isArray(p.top3))) throw new Error("not a results file");
    llm = { model: String(data.model), photos: new Map(entries) };
    $("llmName").textContent = llm.model;
    $("resultsStatus").textContent = `${entries.length} LLM answers loaded. Now select the same photos.`;
    totals = [];
    drawGraphs();
  } catch (e) {
    console.error(e);
    $("resultsStatus").textContent = "That isn't a results file. Pick openrouter-results.json.";
  }
};

let running = false, stopped = false;
async function runBenchmark(files) {
  const pictures = [...files].filter((f) => f.type.startsWith("image/")).sort((a, b) => a.name.localeCompare(b.name));
  const status = (t) => { $("benchStatus").textContent = t; };
  const typed = $("truth").value.trim().toLowerCase();
  if (typed && !byLabel.has(typed)) { status("Pick the correct insect from the list, or leave that box empty."); return; }
  const answers = pictures.map((file) => [file, truthFor(file) || byLabel.get(typed) || null]);
  const known = answers.filter(([, truth]) => truth);
  if (!pictures.length) { status("No photos found there."); return; }
  if (!known.length) { status("I can't tell the right answers. Name the folder after the insect, or pick the correct insect above."); return; }
  // With LLM results loaded, only photos the LLM also answered are counted, so the test is fair.
  const asked = llm ? known.filter(([file]) => llm.photos.has(file.name)) : known;
  if (!asked.length) { status("None of these photos are in the LLM results file."); return; }

  running = true;
  stopped = false;
  totals = [];
  drawGraphs();
  for (const id of ["pickFolder", "pickMany", "pickResults"]) $(id).disabled = true;
  $("stop").hidden = false;
  let failed = 0;
  try {
    await getReady(status);
    for (const [i, [file, truth]] of asked.entries()) {
      if (stopped) break;
      status(`Photo ${i + 1} of ${asked.length}…`);
      try {
        const result = await check(file);
        const before = totals[totals.length - 1];
        const add = (was, right, seconds, cost) => ({
          right: (was ? was.right : 0) + (right ? 1 : 0),
          seconds: (was ? was.seconds : 0) + seconds,
          cost: (was ? was.cost : 0) + cost,
        });
        const point = { pyinsect: add(before?.pyinsect, result.top3[0].species === truth, result.ms / 1000, 0) };
        if (llm) {
          const answer = llm.photos.get(file.name);
          point.llm = add(before?.llm, answer.top3[0]?.species === truth, Number(answer.seconds) || 0, Number(answer.cost) || 0);
        }
        totals.push(point);
        drawGraphs();
      } catch (e) { console.error(e); failed++; }
    }
    const skipped = pictures.length - known.length, unasked = known.length - asked.length;
    status(`${stopped ? "Stopped" : "Done"}: ${totals.length} photo${totals.length === 1 ? "" : "s"}.`
      + (skipped ? ` ${skipped} skipped (no insect name).` : "")
      + (unasked ? ` ${unasked} left out (no LLM answer).` : "")
      + (failed ? ` ${failed} couldn't be opened.` : "")
      + (totals.length < 30 ? " Too few to prove much yet." : ""));
  } catch (e) {
    console.error(e);
    status(NOT_LOADED);
  } finally {
    running = false;
    $("stop").hidden = true;
    for (const id of ["pickFolder", "pickMany", "pickResults"]) $(id).disabled = false;
  }
}
for (const [button, input] of [["pickFolder", "folder"], ["pickMany", "many"]]) {
  $(button).onclick = () => $(input).click();
  $(input).onchange = () => {
    const files = [...$(input).files];
    $(input).value = "";
    if (files.length && !running) runBenchmark(files);
  };
}
$("stop").onclick = () => { stopped = true; };
