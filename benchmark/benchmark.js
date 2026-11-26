// Pyinsect Benchmark: Pyinsect (the website's model) against CLIP, a free general AI. Both run on this device.
// Needs window.PYINSECT_MODEL (assets/models/), window.findInsect and the names in assets/species.js.

const TRANSFORMERS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5";
const CLIP_ID = "Xenova/clip-vit-base-patch32";
const CLIP_VERSION = "6b7c523703ae26e39be4b03774966f8571c7f523";   // always the same copy, so scores stay comparable
const SCORES_KEY = "pyinsect.compare.2";

const MODEL = window.PYINSECT_MODEL;
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// The insects both AIs choose from. "Other insect" isn't an insect, so CLIP can't be asked about it.
const SPECIES = MODEL.classes.filter((s) => s !== MODEL.otherClass);
const label = (s) => (s === MODEL.otherClass ? commonName(s) : `${commonName(s)} (${sciName(s)})`);
const byLabel = new Map(SPECIES.map((s) => [label(s).toLowerCase(), s]));
for (const s of SPECIES) $("names").append(new Option(label(s)));

/* ---------- scores (only counts are saved, never photos) ---------- */
const blank = () => ({ top1: 0, top3: 0, ms: 0 });
const empty = () => ({ n: 0, pyinsect: blank(), clip: blank(), history: [] });
let scores = empty();
try { scores = JSON.parse(localStorage.getItem(SCORES_KEY)) || empty(); } catch { /* private window */ }
const saveScores = () => { try { localStorage.setItem(SCORES_KEY, JSON.stringify(scores)); } catch { /* not saved */ } };

function showScores() {
  const { n } = scores;
  $("scored").textContent = n
    ? `${n} photo${n === 1 ? "" : "s"} scored.${n < 30 ? " Too few to prove much yet." : ""}`
    : "No photos scored yet.";
  const pct = (k) => (n ? `${Math.round((100 * k) / n)}% (${k} of ${n})` : "–");
  fill("board", [
    ["Right first time", (a) => pct(scores[a].top1)],
    ["Right in top 3", (a) => pct(scores[a].top3)],
    ["Time per photo", (a) => (n ? `${(scores[a].ms / n / 1000).toFixed(1)} s` : "–")],
  ]);
  drawChart();
}
function fill(id, rows) {
  $(id).replaceChildren(...rows.map(([name, value]) => {
    const tr = el("tr"), th = el("th", null, name);
    th.scope = "row";
    tr.append(th, el("td", null, value("pyinsect")), el("td", null, value("clip")));
    return tr;
  }));
}
// Line graph: after each scored photo, what percent has each AI got right first time so far?
// Each point in scores.history is [photos scored, Pyinsect right, CLIP right].
const svg = (tag, attrs, text) => {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};
function drawChart() {
  const points = scores.history || [];
  if (!points.length) { $("chart").replaceChildren(el("p", "muted", "Score a photo to see the graph.")); return; }
  const W = 440, H = 220, left = 40, right = 44, top = 10, bottom = 36;
  const first = points[0][0], last = points[points.length - 1][0];
  const x = (n) => (first === last ? (left + W - right) / 2 : left + ((n - first) / (last - first)) * (W - left - right));
  const y = (percent) => top + (1 - percent / 100) * (H - top - bottom);
  const percent = (point, i) => Math.round((100 * point[i]) / point[0]);
  const say = (point) => `After ${point[0]} photo${point[0] === 1 ? "" : "s"}: Pyinsect ${percent(point, 1)}%, CLIP ${percent(point, 2)}%`;

  const graph = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Right first time. ${say(points[points.length - 1])}` });
  for (const p of [0, 50, 100]) {
    graph.append(svg("line", { class: "grid", x1: left, x2: W - right, y1: y(p), y2: y(p) }));
    graph.append(svg("text", { x: left - 6, y: y(p) + 4, "text-anchor": "end" }, `${p}%`));
  }
  for (const n of first === last ? [first] : [first, last]) graph.append(svg("text", { x: x(n), y: H - 20, "text-anchor": "middle" }, n));
  graph.append(svg("text", { x: (left + W - right) / 2, y: H - 4, "text-anchor": "middle" }, "Photos scored"));
  // CLIP is dashed, so both lines can still be seen when they sit on top of each other.
  for (const [ai, i] of [["pyinsect", 1], ["clip", 2]]) {
    graph.append(svg("polyline", { class: `line ${ai}`, points: points.map((p) => `${x(p[0])},${y(percent(p, i))}`).join(" ") }));
    for (const p of points.length > 20 ? [points[points.length - 1]] : points) {
      graph.append(svg("circle", { class: `dot ${ai}`, cx: x(p[0]), cy: y(percent(p, i)), r: 4 }));
    }
  }
  // The latest numbers at the end of each line, pushed apart if they would overlap.
  const end = points[points.length - 1];
  const ends = [y(percent(end, 1)), y(percent(end, 2))];
  if (Math.abs(ends[0] - ends[1]) < 14) {
    const middle = (ends[0] + ends[1]) / 2, up = ends[0] <= ends[1] ? 0 : 1;
    ends[up] = middle - 7;
    ends[1 - up] = middle + 7;
  }
  ends.forEach((at, i) => graph.append(svg("text", { class: "end", x: x(end[0]) + 8, y: at + 4 }, `${percent(end, i + 1)}%`)));

  // Point at (or tap) the graph to read the numbers for one photo.
  const readout = el("p", "readout muted", say(end));
  const slot = points.length > 1 ? (W - left - right) / (points.length - 1) : W - left - right;
  for (const p of points) {
    const hit = svg("rect", { x: x(p[0]) - slot / 2, y: top, width: slot, height: H - top - bottom, fill: "transparent" });
    hit.append(svg("title", {}, say(p)));
    hit.addEventListener("pointerenter", () => { readout.textContent = say(p); });
    hit.addEventListener("click", () => { readout.textContent = say(p); });
    graph.append(hit);
  }
  $("chart").replaceChildren(el("p", "group-title", "Right first time, so far"), graph, readout);
}
$("reset").onclick = () => {
  if (!confirm("Reset all the scores?")) return;
  scores = empty();
  saveScores();
  showScores();
};
showScores();

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

/* ---------- CLIP: picks the insect name that matches the photo best ---------- */
let clip = null;
async function loadClip(progress) {
  const T = await import(TRANSFORMERS);
  const opts = (dtype) => ({
    revision: CLIP_VERSION, dtype,
    progress_callback: (p) => {
      if (p.status !== "progress" || !p.total) return;
      progress(`Downloading CLIP… ${p.file.split("/").pop()} ${Math.round(p.progress)}%`);
    },
  });
  const tokenizer = await T.AutoTokenizer.from_pretrained(CLIP_ID, opts());
  const processor = await T.AutoProcessor.from_pretrained(CLIP_ID, opts());
  const vision = await T.CLIPVisionModelWithProjection.from_pretrained(CLIP_ID, opts("fp16"));
  const text = await T.CLIPTextModelWithProjection.from_pretrained(CLIP_ID, opts("q8"));

  // The names only have to be read once.
  const embeds = [];
  for (let i = 0; i < SPECIES.length; i += 16) {
    progress(`CLIP is reading the insect names… ${i} of ${SPECIES.length}`);
    const prompts = SPECIES.slice(i, i + 16).map((s) => `a photo of ${commonName(s)}, ${sciName(s)}`);
    const { text_embeds } = await text(tokenizer(prompts, { padding: true, truncation: true }));
    embeds.push(...text_embeds.normalize(2, -1).tolist());
  }
  clip = { T, processor, vision, embeds };
}

async function runClip(blob) {
  const image = await clip.T.RawImage.fromBlob(blob);
  const { image_embeds } = await clip.vision(await clip.processor(image));
  const [v] = image_embeds.normalize(2, -1).tolist();
  const sims = clip.embeds.map((e) => 100 * e.reduce((sum, x, i) => sum + x * v[i], 0));
  return best3(softmax(sims), SPECIES);
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

function column(name, result) {
  const box = el("div"), list = el("ol");
  for (const g of result.top3) {
    const li = el("li", null, `${commonName(g.species)} (${g.confidence.toFixed(0)}% sure)`);
    li.dataset.species = g.species;
    list.append(li);
  }
  box.append(el("h3", null, name), list, el("p", null, `Took ${(result.ms / 1000).toFixed(1)} s`));
  return box;
}

// The visitor says what the insect really is. Each photo is scored once.
function answerRow(card, results) {
  const row = el("div", "answer-row"), input = el("input");
  const ok = el("button", "btn primary", "Score it"), skip = el("button", "btn", "I don't know");
  const note = el("p", "muted", "What is it really? Type a name and pick it from the list.");
  input.setAttribute("list", "names");
  input.setAttribute("aria-label", "The correct insect");
  input.placeholder = "The correct insect";
  ok.type = skip.type = "button";
  ok.onclick = () => {
    const truth = byLabel.get(input.value.trim().toLowerCase());
    if (!truth) { note.textContent = "Pick a name from the list. If it isn't there, tap I don't know."; return; }
    scores.n++;
    for (const ai of ["pyinsect", "clip"]) {
      const { top3, ms } = results[ai];
      scores[ai].top1 += top3[0].species === truth ? 1 : 0;
      scores[ai].top3 += top3.some((g) => g.species === truth) ? 1 : 0;
      scores[ai].ms += ms;
    }
    (scores.history ||= []).push([scores.n, scores.pyinsect.top1, scores.clip.top1]);
    saveScores();
    showScores();
    for (const li of card.querySelectorAll("li")) li.classList.toggle("right", li.dataset.species === truth);
    row.remove();
    note.textContent = `Scored. The answer was ${label(truth)}. Right guesses are shown in green.`;
  };
  skip.onclick = () => { row.remove(); note.textContent = "Not scored."; };
  row.append(input, ok, skip);
  card.append(note, row);
}

let queue = Promise.resolve();
function addPhoto(file) {
  const card = el("section", "panel result"), img = el("img"), wait = el("p", "muted", "Waiting…");
  img.src = URL.createObjectURL(file);
  img.alt = file.name;
  card.append(img, wait);
  $("results").prepend(card);
  queue = queue.then(async () => {
    try {
      wait.textContent = "Both AIs are looking…";
      const cut = await cutOut(file);
      const results = { pyinsect: await timed(() => pyinsect(cut, file)), clip: await timed(() => runClip(cut)) };
      const versus = el("div", "versus");
      versus.append(column("Pyinsect", results.pyinsect), column("CLIP", results.clip));
      wait.replaceWith(versus);
      answerRow(card, results);
    } catch (e) {
      console.error(e);
      wait.textContent = "Couldn't check this photo. Try a JPG or PNG picture.";
    }
  });
}

$("load").onclick = async () => {
  const status = (t) => { $("status").textContent = t; };
  $("load").disabled = true;
  try {
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
    status("Downloading Pyinsect…");
    await session(MODEL.url);
    if (MODEL.lowres) await session(MODEL.lowres.url);
    await loadClip(status);
    showScores();
    status("Ready. Choose some insect photos.");
    $("load").hidden = true;
    $("pick").hidden = false;
  } catch (e) {
    console.error(e);
    status("The AIs couldn't be loaded. Check the internet connection and try again.");
    $("load").disabled = false;
  }
};
$("pick").onclick = () => $("files").click();
$("files").onchange = () => {
  for (const f of $("files").files) addPhoto(f);
  $("files").value = "";
};
