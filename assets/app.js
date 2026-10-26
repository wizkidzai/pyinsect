// The Pyinsect identifier app, shared by every model page (index.html = newest model,
// 2.7/index.html, ...). The page loads a model config first (assets/models/*.js), which sets
// window.PYINSECT_MODEL.
const MODEL = window.PYINSECT_MODEL;
const MODEL_NAME = MODEL.name;
const MODEL_URL = MODEL.url;
const CLASS_NAMES = MODEL.classes;
const INVASIVE = new Set(MODEL.invasive);
// How photos are fitted to 224×224 must match how the model was trained:
//   "squash": stretch the whole photo to 224×224 (transforms.Resize((224, 224)))
//   "crop":   shortest side → 256, then the centre 224×224
const RESIZE_MODE = MODEL.resize;
const EXT = /\.(jpe?g|png|bmp|webp|tiff?)$/i;
const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];
const TOKEN_KEY = "pyinsect.token", PENDING_KEY = "pyinsect.pending", MINE_KEY = "pyinsect.mine";

const $ = id => document.getElementById(id);
let session = null, queue = Promise.resolve(), total = 0;

function setStatus(text, kind) {
  $("statusText").textContent = text;
  $("status").className = "status" + (kind ? " " + kind : "");
}
const eyebrow = document.querySelector(".eyebrow");
if (eyebrow) eyebrow.textContent = `${MODEL_NAME} · ${CLASS_NAMES.length} insect classes`;
const readyText = () => `${MODEL_NAME} ready · ${CLASS_NAMES.length} classes`;

// ---------- model ----------
// modelReady: done when the AI is ready (assets/flow.js waits for it before checking photos)
let modelLoaded;
const modelReady = new Promise((ok, bad) => { modelLoaded = { ok, bad }; });
modelReady.catch(() => {});   // pages that never wait for it shouldn't log an error twice
async function loadModel() {
  try {
    if (typeof ort === "undefined") throw new Error("the onnxruntime script did not load. Check your internet connection.");
    ort.env.wasm.numThreads = 1;
    const buf = await downloadModel(MODEL_URL, MODEL.size, "Loading model");
    setStatus("Starting model…", "busy");
    session = await ort.InferenceSession.create(buf, { executionProviders: ["wasm"] });
    setStatus(readyText(), "ready");
    for (const id of ["pickPhotos", "pickFolder", "openCamera"]) if ($(id)) $(id).disabled = false;
    modelLoaded.ok();
  } catch (e) {
    console.error(e);
    setStatus(`Model failed to load: ${e.message}`, "error");
    modelLoaded.bad(e);
  }
}

// Downloads a model file, showing how far along it is in the status line
async function downloadModel(url, expectedSize, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not download the model (${res.status})`);
  const size = Number(res.headers.get("content-length")) || expectedSize;
  const reader = res.body.getReader(), chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    setStatus(`${label}… ${Math.min(100, Math.round(got / size * 100))}%`, "busy");
  }
  const buf = new Uint8Array(got);
  let off = 0; for (const c of chunks) { buf.set(c, off); off += c.length; }
  return buf;
}

// The low-resolution model (models with a `lowres` setting): a copy trained on small photos.
// Downloaded the first time a small photo comes along.
let lowresSession = null;
async function getLowresSession() {
  if (!lowresSession) {
    lowresSession = downloadModel(MODEL.lowres.url, MODEL.lowres.size, "Loading the small-photo model")
      .then(buf => ort.InferenceSession.create(buf, { executionProviders: ["wasm"] }))
      .catch(e => { lowresSession = null; throw e; });
  }
  return lowresSession;
}

// What the answer is, like the Oregon executor: "not_listed" (the model picked "Other insect", or the
// photo is unlike every known insect), "unable" (less than minConfidence % sure), or "ok".
// sim is null when there's no fingerprint check (old models, or the low-res model).
function verdictFor(best, sim) {
  if (MODEL.otherClass && best.species === MODEL.otherClass) return "not_listed";
  if (sim != null && MODEL.notInListCutoff != null && sim < MODEL.notInListCutoff) return "not_listed";
  if (MODEL.minConfidence && best.confidence < MODEL.minConfidence) return "unable";
  return "ok";
}

// Pillow's BILINEAR resize weights for one axis (antialiased when shrinking), so this
// page sees exactly the pixels main.py sees. Returns weights for outputs [from, from+count).
function pilCoeffs(inSize, outSize, from, count) {
  const scale = inSize / outSize, fscale = Math.max(scale, 1), support = fscale;
  const res = [];
  for (let o = from; o < from + count; o++) {
    const center = (o + 0.5) * scale;
    const min = Math.max(Math.trunc(center - support + 0.5), 0);
    const max = Math.min(Math.trunc(center + support + 0.5), inSize);
    const w = []; let sum = 0;
    for (let x = min; x < max; x++) {
      const t = Math.abs((x - center + 0.5) / fscale);
      const v = t < 1 ? 1 - t : 0; w.push(v); sum += v;
    }
    res.push({ min, w: w.map(v => v / sum) });
  }
  return res;
}

// Pillow-style bilinear resize (as above), ImageNet normalisation, CHW
const roundHalfEven = v => { const f = Math.floor(v), d = v - f; return d > 0.5 || (d === 0.5 && f % 2) ? f + 1 : f; };

function preprocess(bmp) {
  const { width: w, height: h } = bmp;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const src = ctx.getImageData(0, 0, w, h).data;

  let cx, cy;
  if (RESIZE_MODE === "squash") {
    cx = pilCoeffs(w, 224, 0, 224); cy = pilCoeffs(h, 224, 0, 224);
  } else {
    const [nw, nh] = w < h ? [256, Math.trunc(h * 256 / w)] : [Math.trunc(w * 256 / h), 256];
    // torchvision's CenterCrop rounds with Python's round() (.5 goes to the even number), not down
    const left = roundHalfEven((nw - 224) / 2), top = roundHalfEven((nh - 224) / 2);
    cx = pilCoeffs(w, nw, left, 224); cy = pilCoeffs(h, nh, top, 224);
  }

  // Horizontal pass (rounded to 8-bit like Pillow), only over the source rows the crop needs
  const y0 = cy[0].min, y1 = cy[223].min + cy[223].w.length;
  const mid = new Uint8ClampedArray((y1 - y0) * 224 * 3);
  for (let y = y0; y < y1; y++) {
    const row = y * w * 4, outRow = (y - y0) * 224 * 3;
    for (let x = 0; x < 224; x++) {
      const { min, w: k } = cx[x];
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < k.length; i++) {
        const p = row + (min + i) * 4;
        r += src[p] * k[i]; g += src[p + 1] * k[i]; b += src[p + 2] * k[i];
      }
      mid[outRow + x * 3] = Math.round(r); mid[outRow + x * 3 + 1] = Math.round(g); mid[outRow + x * 3 + 2] = Math.round(b);
    }
  }

  // Vertical pass, then normalise into CHW
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

function softmax(logits) {
  const m = Math.max(...logits);
  const e = logits.map(v => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map(v => v / s);
}

// ---------- reporting ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
store.del(TOKEN_KEY);   // tokens were only needed before the relay existed

function showReportState() {
  const pending = store.get(PENDING_KEY, []).length;
  const st = $("reportState");
  $("retryReports").hidden = !pending || !RELAY_URL;
  if (!RELAY_URL) { st.textContent = "off. The report server isn't set up yet."; st.className = "state warn"; return; }
  st.textContent = pending ? `on · ${pending} report(s) waiting to send` : "on · reports are sent automatically";
  st.className = pending ? "state warn" : "state on";
}

// Reduced copy of the photo for the report (longest side 1024 px, JPEG)
function reportPhoto(bmp) {
  const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8).split(",")[1];
}

// A new report's id (UTC time + random letters) and its local time with the time zone
function reportIdAndTime() {
  const now = new Date(), pad = n => String(n).padStart(2, "0");
  const id = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}-${Math.random().toString(16).slice(2, 6)}`;
  const offset = -now.getTimezoneOffset(), sign = offset >= 0 ? "+" : "-";
  const timestamp = new Date(now.getTime() + offset * 60000).toISOString().slice(0, 19)
    + `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
  return { id, timestamp };
}
const APP_VERSION = "web-1.2";
const reportTop3 = top3 => top3.map(t => ({ species: t.species, name: commonName(t.species), confidence: Math.round(t.confidence * 100) / 100 }));

function buildReport(bmp, species, confidence, top3) {
  const { id, timestamp } = reportIdAndTime();
  return {
    report: {
      id, timestamp, species, name: commonName(species), ...(MODEL.scientific ? { scientific: sciName(species) } : {}),
      confidence: Math.round(confidence * 100) / 100,
      top3: reportTop3(top3),
      photo: `${id}.jpg`, model: MODEL_NAME, app_version: APP_VERSION,
    },
    photo: reportPhoto(bmp),
  };
}

// A photo from the old tree check (pages before the Detect steps). tree = { id, signs, name, signsText }.
// The relay makes its own name from the tree and signs; ours is only for this device.
function buildTreeReport(bmp, tree, top3, infested) {
  const { id, timestamp } = reportIdAndTime();
  return {
    report: {
      id, timestamp, kind: "tree", tree: tree.id, signs: tree.signs, name: tree.name,
      ...(infested ? { infested: true } : {}),   // the bug model found damage in the photo
      top3: reportTop3(top3),   // the bug model's guesses, as extra help for the team
      photo: `${id}.jpg`, model: MODEL_NAME, app_version: APP_VERSION,
    },
    photo: reportPhoto(bmp),
  };
}

// An infested tree (the bug model found tree damage, like emerald ash borer damage): not a bug, but
// a tree that needs action. tree = the tree settings (assets/trees/*.js) whose damageClass it found.
function buildInfestedReport(bmp, tree, top3) {
  const { id, timestamp } = reportIdAndTime(), best = top3[0];
  return {
    report: {
      id, timestamp, kind: "infested", tree: tree.id, species: best.species, name: `Infested ${tree.name}`,
      confidence: Math.round(best.confidence * 100) / 100,
      top3: reportTop3(top3),
      photo: `${id}.jpg`, model: MODEL_NAME, app_version: APP_VERSION,
    },
    photo: reportPhoto(bmp),
  };
}

let sending = null;
const dropPending = id => store.set(PENDING_KEY, store.get(PENDING_KEY, []).filter(p => p.report.id !== id));
const markReport = (id, text, cls) => {
  document.querySelectorAll(`[data-report="${id}"]`).forEach(e => { e.textContent = text; e.className = cls; });
  updateMine(id, { status: text, ok: cls.includes("ok") });
};

// Sends every waiting report to the relay, oldest first
function sendPending() {
  if (sending) return sending;
  sending = (async () => {
    let sent = 0, error = null;
    for (;;) {
      const list = store.get(PENDING_KEY, []);
      if (!list.length || !RELAY_URL) break;
      const { report, photo, photos } = list[0];
      try {
        await relaySend(report, photo, photos);
        dropPending(report.id);
        sent++;
        markReport(report.id, "Reported", "sent ok");
        updateMine(report.id, { level: "unchecked" });
      } catch (e) {
        // A Detect report sent before the relay was updated (version 15): keep it until the relay knows it
        const relayTooOld = report.kind === "check" && /Unknown kind/.test(e.message);
        if (e.rejected && !relayTooOld) {   // would fail forever; drop it so later reports still go out
          dropPending(report.id);
          markReport(report.id, `Not reported: ${e.message}`, "sent bad");
          continue;
        }
        error = relayTooOld ? "the report server needs an update. It will be sent after that." : e.message;
        markReport(report.id, `Waiting to send: ${error}`, "sent bad");
        break;
      }
    }
    showReportState();
    return { sent, error };
  })().finally(() => { sending = null; });
  return sending;
}

// ---------- rough area ----------
// Reports can carry a rounded spot: the middle of a grid square about 75 m wide (teamSpot). Only our
// team sees that. The public map rounds it again, to a square about 200 m wide (roughArea), so a
// stranger can't find anyone's house. The exact spot never leaves the phone. The relay rounds it to
// the same grids again (snapToGrid, AREA_DEG and SPOT_DEG in relay/worker.js must stay the same).
const AREA_KEY = "pyinsect.shareArea";
const AREA_DEG = 0.0018, SPOT_DEG = 0.0007;   // 0.0018° of latitude ≈ 200 m, 0.0007° ≈ 78 m
function snapToGrid(lat, lon, deg) {
  const row = Math.floor(lat / deg), rowLat = (row + 0.5) * deg;
  const lonStep = deg / Math.max(0.2, Math.cos(rowLat * Math.PI / 180));   // squares stay square
  const col = Math.floor(lon / lonStep);
  return { lat: +rowLat.toFixed(5), lon: +((col + 0.5) * lonStep).toFixed(5) };
}
const roughArea = (lat, lon) => snapToGrid(lat, lon, AREA_DEG);   // public map (~200 m)
const teamSpot = (lat, lon) => snapToGrid(lat, lon, SPOT_DEG);    // team only (~75 m)
// Ticked unless they unticked it. Pages without the checkbox (like 2.7/) never send an area.
const shareArea = () => !!document.querySelector(".area-box") && store.get(AREA_KEY, true);
let areaCache = null;   // { area, at }: one location ask is reused for 10 minutes

// The team spot (~75 m), or null (box unticked, location blocked, or no answer within 10 seconds)
function getArea() {
  if (!shareArea() || !navigator.geolocation) return Promise.resolve(null);
  if (areaCache && Date.now() - areaCache.at < 600000) return Promise.resolve(areaCache.area);
  return new Promise(resolve => navigator.geolocation.getCurrentPosition(
    pos => { areaCache = { area: teamSpot(pos.coords.latitude, pos.coords.longitude), at: Date.now() }; resolve(areaCache.area); },
    () => resolve(null),
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }));
}

// Every "rough area" checkbox on the page (camera screen, "Check it" screen) shows the same setting
function wireAreaBox(box) {
  box.checked = shareArea();
  box.onchange = () => {
    store.set(AREA_KEY, box.checked);
    document.querySelectorAll(".area-box").forEach(b => { b.checked = box.checked; });
  };
}
document.querySelectorAll(".area-box").forEach(wireAreaBox);

// r = a report from buildReport or buildTreeReport. detail = the small line under it in "Your reports".
// The rough area is added first (the browser may ask about location the first time).
async function fileReport(r, card, detail) {
  const line = el("span", "sent", "");
  card.querySelector(".info").append(line);
  if (!RELAY_URL) { line.textContent = "Not reported: the report server isn't set up yet."; return; }
  line.textContent = shareArea() ? "Adding your rough area…" : "Sending report…";
  const area = await getArea();
  if (area) r.report.spot = area;
  card.querySelector(".info").append(el("span", "area-line", area ? "📍 Rough area added (about 200 m on the map)" : "📍 Sent without an area, so it won't show on the map"));
  line.dataset.report = r.report.id;
  line.textContent = "Sending report…";
  queueReport(r, detail);
}

// Adds a report to "Your reports" and the waiting list, then sends it. r = { report, photo } or
// { report, photos } (a Detect report from assets/flow.js). Returns false if the phone had no room.
function queueReport(r, detail) {
  addMine(r, detail);
  const list = store.get(PENDING_KEY, []);
  list.push(r);
  if (!store.set(PENDING_KEY, list)) { markReport(r.report.id, "Not reported: this browser's storage is full.", "sent bad"); return false; }
  sendPending();
  return true;
}

// ---------- blur check ----------
// Sharpness = the highest Laplacian variance among a 4×4 grid of tiles on a grey copy (longest side
// 512 px), so a sharp insect on a soft background still counts as sharp. Oct 10 calibration on 300 of
// the user's photos: below 40 caught 297/300 lightly blurred copies and 300/300 strongly blurred ones,
// and flagged 3/300 originals (all genuinely soft).
const BLUR_THRESHOLD = 40;
function sharpness(bmp) {
  const s = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
  const w = Math.max(3, Math.round(bmp.width * s)), h = Math.max(3, Math.round(bmp.height * s));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114;
  const sum = new Float64Array(16), sq = new Float64Array(16), n = new Float64Array(16);
  for (let y = 1; y < h - 1; y++) {
    const ty = Math.min(3, Math.floor((y - 1) * 4 / (h - 2)));
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, v = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i];
      const t = ty * 4 + Math.min(3, Math.floor((x - 1) * 4 / (w - 2)));
      sum[t] += v; sq[t] += v * v; n[t]++;
    }
  }
  let best = 0;
  for (let t = 0; t < 16; t++) if (n[t]) best = Math.max(best, sq[t] / n[t] - (sum[t] / n[t]) ** 2);
  return best;
}

// An AI-made photo is never reported; the card says why
function blockReport(card, ai) {
  const info = card.querySelector(".info");
  info.querySelector(".flag")?.after(el("span", "flag ai", "AI-generated photo"));
  info.append(el("span", "sent bad", "Not reported: this photo looks AI-generated. " + ai.reasons[0]));
}

// ---------- your reports (this phone) ----------
// Reports sent from this phone, newest first, kept in localStorage so they're still there next
// time. Only a small copy of each photo is kept (storage is about 5 MB, shared with the game).
const MINE_MAX = 50, MINE_PHOTO = 320;   // newest 50 reports; photos 320 px on the long side
const mine = {
  get() { try { return JSON.parse(localStorage.getItem(MINE_KEY)) || []; } catch { return []; } },
  set(list) {
    // Photos are the big part; if storage is full, drop the oldest photos first
    for (let keep = list.length; keep >= 0; keep--) {
      try { localStorage.setItem(MINE_KEY, JSON.stringify(list.map((m, i) => i < keep ? m : { ...m, photo: null }))); return; } catch {}
    }
  },
};
// Reports from before this was saved on the phone (only kept while the tab was open): move them over
try {
  const old = JSON.parse(sessionStorage.getItem(MINE_KEY) || "[]");
  if (old.length) {
    const have = new Set(mine.get().map(m => m.id));
    mine.set([...old.filter(m => !have.has(m.id)), ...mine.get()].sort((a, b) => b.id.localeCompare(a.id)).slice(0, MINE_MAX));
    sessionStorage.removeItem(MINE_KEY);
  }
} catch {}

// A small copy of a report photo (base64 JPEG) for "Your reports"
function smallPhoto(base64) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MINE_PHOTO / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.75).split(",")[1]);
    };
    img.onerror = () => resolve(null);
    img.src = "data:image/jpeg;base64," + base64;
  });
}

// detail = the small line under the name, like "Agrilus planipennis · 91.2%" or the signs seen
// Added right away (so its "Reported" status can't get lost); the small photo follows a moment later
function addMine({ report, photo, photos }, detail) {
  const list = mine.get().filter(m => m.id !== report.id);
  // The map shows this phone's reports in the public ~200 m square, like everyone else's
  const area = report.spot ? roughArea(report.spot.lat, report.spot.lon) : report.area || null;
  list.unshift({ id: report.id, name: report.name, detail: detail || mineDetail(report), kind: report.kind || "invasive",
    area, timestamp: report.timestamp, model: report.model, photo: null, status: "Sending report…", ok: false });
  mine.set(list.slice(0, MINE_MAX));
  renderMine();
  const first = photo || photos?.[0];
  if (first) smallPhoto(first).then(small => { if (small) updateMine(report.id, { photo: small }); });
}

function updateMine(id, change) {
  const list = mine.get(), m = list.find(x => x.id === id);
  if (!m) return;
  Object.assign(m, change);
  mine.set(list);
  renderMine();
}

// Check levels for this phone's reports: asks the relay about their ids only (GET /status?ids=...)
const MINE_LEVELS = { unchecked: "⚪ Not checked yet", ai: "🔵 AI checked", verified: "🟢 Verified by our team", not_match: "✗ Not a match" };
async function refreshLevels() {
  const sent = mine.get().filter(m => m.ok).slice(0, 50);
  if (!RELAY_URL || !sent.length) return;
  try {
    const res = await fetch(`${RELAY_URL.replace(/\/$/, "")}/status?ids=${sent.map(m => m.id).join(",")}`, { cache: "no-store" });
    if (!res.ok) return;
    const levels = (await res.json()).levels || {};
    const all = mine.get();
    let changed = false;
    for (const m of all) if (levels[m.id] && m.level !== levels[m.id]) { m.level = levels[m.id]; changed = true; }
    if (changed) { mine.set(all); renderMine(); }
  } catch {}   // offline or an older relay: try again next time
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshLevels(); });

// Older saved entries have scientific + confidence instead of detail
const mineDetail = m => m.detail ?? [m.scientific, `${Number(m.confidence).toFixed(1)}%`].filter(Boolean).join(" · ");

function renderMine() {
  const list = mine.get(), box = $("mine");
  $("mineSection").hidden = !list.length;
  $("mineCount").textContent = `${list.length} report${list.length === 1 ? "" : "s"}`;
  box.innerHTML = "";
  for (const m of list) {
    const row = el("div", "row"), img = el("img"), what = el("div", "what"), side = el("div", "when");
    img.alt = ""; if (m.photo) img.src = "data:image/jpeg;base64," + m.photo;
    what.append(el("strong", null, m.name), el("span", "muted", mineDetail(m)));
    if (m.ok) what.append(el("span", "mine-level " + (m.level || "unchecked"), MINE_LEVELS[m.level || "unchecked"]));
    // Today: just the time. Earlier days: the date (the list stays for days now)
    const t = new Date(m.timestamp), today = !isNaN(t) && t.toDateString() === new Date().toDateString();
    side.append(el("span", "state " + (m.ok ? "on" : /^Sending/.test(m.status) ? "" : "warn"), m.ok ? "Reported" : m.status),
      el("span", null, isNaN(t) ? "" : today ? t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : t.toLocaleDateString([], { month: "short", day: "numeric" })));
    row.append(img, what, side);
    if (m.photo) {
      row.tabIndex = 0; row.setAttribute("role", "button"); row.title = "Show the photo";
      const open = () => openViewer(img.src, m.name, [mineDetail(m),
        isNaN(t) ? "" : t.toLocaleString(), m.ok ? "Reported" : m.status].filter(Boolean).join(" · "));
      row.onclick = open;
      row.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };
    }
    box.append(row);
  }
}

// ---------- full-photo viewer ----------
let viewerReturn = null;
function openViewer(src, title, details) {
  viewerReturn = document.activeElement;
  $("viewerImg").src = src; $("viewerImg").alt = title;
  const cap = $("viewerCaption"); cap.innerHTML = "";
  cap.append(el("strong", null, title));
  if (details) cap.append(el("span", null, details));
  $("viewer").hidden = false;
  document.body.style.overflow = "hidden";
  $("viewerClose").focus();
}
function closeViewer() {
  if ($("viewer").hidden) return;
  $("viewer").hidden = true;
  document.body.style.overflow = "";
  viewerReturn?.focus?.();
}
$("viewer").onclick = closeViewer;
document.addEventListener("keydown", e => { if (e.key === "Escape") closeViewer(); });

// ---------- results ----------
function makeCard(file) {
  $("empty")?.remove();
  const card = el("article", "card pending");
  const img = el("img"); img.alt = ""; img.src = URL.createObjectURL(file);
  img.tabIndex = 0; img.title = "Show the whole photo";
  const open = () => openViewer(img.src, card.querySelector(".name").textContent,
    [card.querySelector(".sci")?.textContent, card.querySelector(".alt .pct")?.textContent, file.webkitRelativePath || file.name].filter(Boolean).join(" · "));
  img.onclick = open;
  img.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };
  const info = el("div", "info");
  info.append(el("p", "name", "Analysing…"), el("span", "file", file.webkitRelativePath || file.name));
  card.append(img, info);
  $("cards").prepend(card);
  return card;
}

// The tree settings (assets/trees/*.js) whose damage class this is, like emerald ash borer damage
// for ash trees. null for bugs.
const damagedTree = species => (window.PYINSECT_TREES || []).find(t => t.damageClass === species) || null;

// The warning and what to do, for an infested tree (on photo cards and at the end of the tree check)
function infestedBox(tree) {
  const box = el("div", "infested-box"), list = el("ul");
  for (const tip of tree.infested.tips) list.append(el("li", null, tip));
  box.append(el("p", "infested-title", `⚠ ${tree.infested.title}`), el("p", null, tree.infested.text),
    el("p", "infested-what", "What to do:"), list);
  for (const l of tree.infested.links || []) {
    const a = el("a", null, l.text); a.href = l.url; a.target = "_blank"; a.rel = "noopener";
    const p = el("p"); p.append(a); box.append(p);
  }
  return box;
}

// A name in the "top 3" list: the scientific name in italics (models with scientific names), else
// the common name. "Other insect" isn't a species, so it keeps its plain name.
function altName(species) {
  if (!MODEL.scientific || species === MODEL.otherClass) return el("span", null, commonName(species));
  const name = el("span", "alt-sci", sciName(species));
  name.title = commonName(species);   // the common name shows when you point at it
  return name;
}

function fillCard(card, top3, verdict = "ok") {
  if (verdict !== "ok") return fillUnsureCard(card, top3, verdict);
  const best = top3[0], invasive = INVASIVE.has(best.species), sick = damagedTree(best.species);
  card.className = "card" + (invasive ? " invasive" : sick ? " infested" : "");
  const info = card.querySelector(".info"), fileLine = info.querySelector(".file");
  info.innerHTML = "";
  if (invasive) info.append(el("span", "flag", "Invasive"));
  if (sick) info.append(el("span", "flag infested", "⚠ Infested tree"));
  const alts = el("div", "alts");
  for (const t of top3) {
    const row = el("div", "alt"), track = el("div", "track"), fill = el("div", "fill");
    fill.style.width = `${t.confidence.toFixed(1)}%`; track.append(fill);
    row.append(altName(t.species), track, el("span", "pct", `${t.confidence.toFixed(1)}%`));
    alts.append(row);
  }
  info.append(el("p", "name", commonName(best.species)), ...(MODEL.scientific ? [el("span", "sci", sciName(best.species))] : []), fileLine, alts);
  if (sick) info.append(infestedBox(sick));
  return invasive;
}

// "Insect not in my list" or "Unable to determine": no report, and the closest guesses as hints
function fillUnsureCard(card, top3, verdict) {
  card.className = "card unsure";
  const info = card.querySelector(".info"), fileLine = info.querySelector(".file");
  info.innerHTML = "";
  const known = top3.filter(t => t.species !== MODEL.otherClass).slice(0, 2);
  const alts = el("div", "alts");
  for (const t of known) {
    const row = el("div", "alt"), track = el("div", "track"), fill = el("div", "fill");
    fill.style.width = `${t.confidence.toFixed(1)}%`; track.append(fill);
    row.append(altName(t.species), track, el("span", "pct", `${t.confidence.toFixed(1)}%`));
    alts.append(row);
  }
  const notListed = verdict === "not_listed";
  info.append(
    el("p", "name", notListed ? "Insect not in my list" : "Unable to determine"),
    el("span", "unsure-note", notListed
      ? "This doesn't look like any insect I know. Closest ones I know:"
      : `I'm not sure enough (best guess ${top3[0].confidence.toFixed(0)}%). Maybe:`),
    fileLine, alts);
  return false;
}

// Runs the AI on one photo: the top 3 guesses (confidence in %) and the verdict (see verdictFor).
// sim is null when there's no fingerprint check.
async function identify(file) {
  // The model gets the photo's raw colours, like Pillow in training and in the executor. Browsers
  // otherwise convert photos with a colour profile (like iPhone "Display P3") first, which changes
  // the answer. The report photo keeps the normal colours.
  const raw = await createImageBitmap(file, { colorSpaceConversion: "none" });
  // Small photos go to the low-res model (when this model has one), like the Oregon executor
  const small = MODEL.lowres && Math.min(raw.width, raw.height) < MODEL.lowres.smallPx;
  const s = small ? await getLowresSession() : session;
  const out = await s.run({ [s.inputNames[0]]: preprocess(raw) });
  raw.close?.();
  const probs = softmax(Array.from((out.logits || out[s.outputNames[0]]).data));
  const sim = !small && out.sim ? out.sim.data[0] : null;   // fingerprint check (main model only)
  const top3 = [...probs.keys()].sort((a, b) => probs[b] - probs[a]).slice(0, 3)
    .map(i => ({ species: CLASS_NAMES[i] ?? `idx_${i}`, confidence: probs[i] * 100 }));
  return { top3, sim, verdict: verdictFor(top3[0], sim) };
}

function classify(file) {
  total++;
  $("count").textContent = `${total} photo${total === 1 ? "" : "s"}`;
  const card = makeCard(file);
  queue = queue.then(async () => {
    try {
      setStatus(`Analysing ${file.name}…`, "busy");
      const bmp = await createImageBitmap(file);   // for the report photo (normal colours)
      const { top3, sim, verdict } = await identify(file);
      if (file.tree) {
        await treePhoto(file, bmp, top3, card, sim);
        bmp.close?.();
        setStatus(readyText(), "ready");
        return;
      }
      const invasive = fillCard(card, top3, verdict);
      const infested = verdict === "ok" ? damagedTree(top3[0].species) : null;   // tree damage: not a bug, but a tree that needs action
      window.teamAI?.check(file, card);   // team AI check switch (assets/teamai.js)
      if (sharpness(bmp) < BLUR_THRESHOLD) {
        card.querySelector(".info .name").after(el("span", "blurry", "Blurry photo: try to get a clearer image."));
      }
      if (invasive || infested) {
        // Photos from the in-page camera come straight from the camera; uploads are checked for AI labels
        const ai = file.fromCamera ? { verdict: "camera", reasons: [] } : await checkAI(file.original || file).catch(() => ({ verdict: "unknown", reasons: [] }));
        if (ai.verdict === "ai") { blockReport(card, ai); window.Innvadex?.fakePhoto(); }
        else if (infested) {
          // Sent right away, so the team knows about the infested tree
          fileReport(buildInfestedReport(bmp, infested, top3), card, "Infested tree: action needed");
        } else {
          fileReport(buildReport(bmp, top3[0].species, top3[0].confidence, top3), card);
          window.Innvadex?.encounter(top3[0].species, card.querySelector("img").src);   // the game (assets/game.js)
        }
      } else if (window.Innvadex && verdict === "ok") {
        // Not invasive: protector points in the game, but only for real (not AI-made) photos
        const ai = file.fromCamera ? { verdict: "camera" } : await checkAI(file.original || file).catch(() => ({ verdict: "unknown" }));
        if (ai.verdict === "ai") window.Innvadex.fakePhoto();
        else window.Innvadex.native(top3[0].species, top3[0].confidence);
      }
      bmp.close?.();
      setStatus(readyText(), "ready");
    } catch (e) {
      console.error(e);
      card.className = "card";
      card.querySelector(".name").textContent = "Couldn't read this image";
      setStatus(`${file.name}: ${e.message}`, "error");
    }
  });
}

// A photo from the tree check: always sent to the team, because the person asked us to look at it.
// The bug model's guesses go along for the team but aren't shown here: on a photo of bark, it would
// just name whichever bug looks closest, which would be confusing.
// If the bug model is sure it sees this tree's damage (like emerald ash borer damage), the tree is
// infested: the card and the tree check's last step warn and say what to do, and the report says so.
async function treePhoto(file, bmp, top3, card, sim) {
  const tree = file.tree, info = card.querySelector(".info"), fileLine = info.querySelector(".file");
  const sick = verdictFor(top3[0], sim) === "ok" ? damagedTree(top3[0].species) : null;
  const infested = sick?.id === tree.id;
  card.className = "card tree" + (infested ? " infested" : "");
  info.innerHTML = "";
  info.append(el("span", "flag tree", "Tree check"), ...(infested ? [el("span", "flag infested", "⚠ Infested tree")] : []),
    el("p", "name", infested ? `Infested ${sick.name}` : tree.name), fileLine, el("p", "tree-signs", tree.signsText),
    ...(infested ? [infestedBox(sick)] : []));
  window.teamAI?.check(file, card);   // team AI check switch (assets/teamai.js)
  if (sharpness(bmp) < BLUR_THRESHOLD) {
    info.querySelector(".name").after(el("span", "blurry", "Blurry photo: try to get a clearer image."));
  }
  const ai = file.fromCamera ? { verdict: "camera", reasons: [] } : await checkAI(file.original || file).catch(() => ({ verdict: "unknown", reasons: [] }));
  if (ai.verdict === "ai") { blockReport(card, ai); return; }
  fileReport(buildTreeReport(bmp, tree, top3, infested), card, infested ? "Infested tree: action needed" : tree.signsText);
  window.treeCheck?.reported(infested);
}

// While the tree check is waiting for its photo, new photos belong to it
const tagForTree = file => { if (window.treeCheck?.pending) file.tree = window.treeCheck.pending; return file; };

// Where a finished photo goes: the Detect steps (assets/flow.js sets window.photoHandler), or the
// results cards (checked right away).
const deliver = file => window.photoHandler ? window.photoHandler(file) : classify(file);

// source = where the photos came from ("pick", "drop", "capture" = the phone's camera app).
// One photo goes to the crop step first; many photos are checked straight away.
function handleFiles(list, source) {
  if (!session && !window.photoHandler) return;   // the Detect steps only need the AI at the end
  const files = [...list].filter(f => EXT.test(f.name)).sort((a, b) =>
    (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name));
  if (!files.length) { setStatus("No supported images found (jpg, png, bmp, webp).", "error"); return; }
  files.forEach(tagForTree);
  if (files.length === 1) showCrop(files[0], source);
  else files.forEach(deliver);
}

// ---------- camera ----------
// Live viewfinder in the page (getUserMedia). If the browser can't or won't share the camera,
// the phone's own camera app is offered instead (file input with capture).
let stream = null, facing = "environment";

function cameraMessage(text) {
  $("cameraMsg").textContent = text || "";
  $("cameraMsg").hidden = !text;
}

async function startCamera() {
  stopStream();
  $("shutter").disabled = true;
  cameraMessage("Starting camera…");
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    const video = $("cameraVideo");
    video.srcObject = stream;
    await video.play();
    video.classList.toggle("mirror", facing === "user");
    cameraMessage("");
    setupZoom();
    setupFocus();
    $("shutter").disabled = false;
    $("useCameraApp").hidden = true;
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput");
    $("switchCamera").hidden = cams.length < 2;
  } catch (e) {
    console.error(e);
    stopStream();
    cameraMessage(e && e.name === "NotAllowedError"
      ? "Camera access was blocked. Allow the camera for this site in your browser settings, or use your camera app instead."
      : e && e.name === "NotFoundError" ? "No camera found on this device."
      : "Couldn't start the camera here. You can use your camera app instead.");
    $("useCameraApp").hidden = false;
    $("switchCamera").hidden = true;
  }
}

function stopStream() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  $("cameraVideo").srcObject = null;
  resetZoom();
  resetFocus();
}

// ---------- camera zoom ----------
// Pinch the viewfinder, use the slider, or pinch a laptop trackpad. When the browser lets us
// control the camera's own zoom, we use it (sharpest). Otherwise we use "digital zoom": the
// preview is enlarged and takePhoto keeps only the middle of the picture.
const DIGITAL_ZOOM_MAX = 4, REAL_ZOOM_MAX = 10;   // past these, photos get too blurry to identify
let zoom = 1, realZoom = null;   // realZoom = the camera's own zoom range, when it has one

function setupZoom() {
  if (!$("zoom")) return;   // pages without the zoom slider (like 2.7/)
  const track = stream.getVideoTracks()[0];
  const range = track.getCapabilities?.().zoom;
  realZoom = range && range.max > range.min ? range : null;
  const slider = $("zoom");
  slider.min = realZoom ? realZoom.min : 1;
  slider.max = realZoom ? Math.min(realZoom.max, REAL_ZOOM_MAX) : DIGITAL_ZOOM_MAX;
  slider.step = realZoom?.step || 0.1;
  $("cameraVideo").style.setProperty("--zoom", 1);
  setZoom(realZoom ? track.getSettings().zoom ?? realZoom.min : 1);
  $("zoomBar").hidden = false;
}

function resetZoom() {
  zoom = 1; realZoom = null;
  $("cameraVideo").style.removeProperty("--zoom");
  if ($("zoomBar")) $("zoomBar").hidden = true;
}

function setZoom(value) {
  if (!stream || !$("zoom")) return;
  const slider = $("zoom");
  zoom = Math.min(Math.max(value, +slider.min), +slider.max);
  slider.value = zoom;
  $("zoomValue").textContent = `${+zoom.toFixed(1)}×`;
  if (realZoom) applyRealZoom();
  else $("cameraVideo").style.setProperty("--zoom", zoom);
}

// Asking the camera to zoom takes a moment. While it's busy, only the newest zoom is kept,
// so a fast pinch doesn't pile up dozens of requests.
let zoomBusy = false;
async function applyRealZoom() {
  if (zoomBusy) return;
  zoomBusy = true;
  let done = null;
  while (stream && realZoom && done !== zoom) {
    done = zoom;
    try { await stream.getVideoTracks()[0].applyConstraints({ advanced: [{ zoom: done }] }); }
    catch { break; }
  }
  zoomBusy = false;
}

// ---------- tap to focus ----------
// Some phones (mostly Android with Chrome) let a website choose where the camera focuses.
// Tap the bug, a ring shows where, and a few seconds later the camera goes back to focusing by
// itself. On other phones tapping does nothing, and no ring shows, so it never pretends to work.
let focusModes = [], focusTimer = 0, ringTimer = 0;

function setupFocus() {
  if (!$("focusRing")) return;
  const modes = stream.getVideoTracks()[0].getCapabilities?.().focusMode || [];
  const canAim = navigator.mediaDevices.getSupportedConstraints?.().pointsOfInterest;
  focusModes = canAim && (modes.includes("single-shot") || modes.includes("continuous")) ? modes : [];
}

function resetFocus() {
  focusModes = [];
  clearTimeout(focusTimer); clearTimeout(ringTimer);
  if ($("focusRing")) $("focusRing").hidden = true;
}

// x, y = where the tap was on the screen
function focusAt(x, y) {
  const video = $("cameraVideo"), box = document.querySelector(".viewfinder").getBoundingClientRect();
  if (!stream || !focusModes.length || !video.videoWidth) return;
  // The video is scaled to cover the box (object-fit: cover), then digitally zoomed around the
  // middle, and maybe mirrored. Undo each of those to find the spot in the camera's own picture,
  // where 0 is the left/top edge and 1 is the right/bottom edge.
  const fit = Math.max(box.width / video.videoWidth, box.height / video.videoHeight);
  const z = realZoom ? 1 : zoom, clamp = n => Math.min(Math.max(n, 0), 1);
  let fx = (x - box.left - box.width / 2) / z / (video.videoWidth * fit) + 0.5;
  const fy = (y - box.top - box.height / 2) / z / (video.videoHeight * fit) + 0.5;
  if (video.classList.contains("mirror")) fx = 1 - fx;

  const ring = $("focusRing");
  ring.hidden = true; void ring.offsetWidth;   // restart the ring's animation
  ring.style.left = `${x - box.left}px`; ring.style.top = `${y - box.top}px`;
  ring.hidden = false;
  clearTimeout(ringTimer); ringTimer = setTimeout(() => { ring.hidden = true; }, 1200);

  const track = stream.getVideoTracks()[0], once = focusModes.includes("single-shot");
  track.applyConstraints({ advanced: [{ pointsOfInterest: [{ x: clamp(fx), y: clamp(fy) }], focusMode: once ? "single-shot" : "continuous" }] }).catch(() => {});
  clearTimeout(focusTimer);
  if (once && focusModes.includes("continuous")) {
    focusTimer = setTimeout(() => { if (stream) track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {}); }, 5000);
  }
}

if ($("zoom")) {
  $("zoom").oninput = e => setZoom(+e.target.value);
  // Two-finger pinch: zoom grows or shrinks by how much the fingers spread apart.
  // One quick finger tap that doesn't slide: focus there.
  const viewfinder = document.querySelector(".viewfinder"), fingers = new Map();
  let pinch = null, tap = null;
  const spread = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  viewfinder.addEventListener("pointerdown", e => {
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    tap = fingers.size === 1 ? { id: e.pointerId, x: e.clientX, y: e.clientY, at: Date.now() } : null;
    if (fingers.size === 2) pinch = { spread: spread(), zoom };
  });
  viewfinder.addEventListener("pointermove", e => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 10) tap = null;
    if (pinch && fingers.size === 2) setZoom(pinch.zoom * spread() / pinch.spread);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(t => viewfinder.addEventListener(t, e => {
    if (t === "pointerup" && tap?.id === e.pointerId && Date.now() - tap.at < 500) focusAt(tap.x, tap.y);
    if (fingers.delete(e.pointerId)) tap = null;
    if (fingers.size < 2) pinch = null;
  }));
  // Laptop trackpads send a pinch as a mouse wheel with the Ctrl key held
  viewfinder.addEventListener("wheel", e => {
    if (!e.ctrlKey || !stream) return;
    e.preventDefault();
    setZoom(zoom * Math.exp(-e.deltaY / 100));
  }, { passive: false });
}

function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { $("captureInput").click(); return; }   // old browsers
  $("camera").hidden = false;
  $("camera").scrollIntoView({ behavior: "smooth", block: "start" });
  startCamera();
}

function closeCamera() {
  stopStream();
  $("camera").hidden = true;
}

// Grabs the current frame at the camera's full resolution as a JPEG file and identifies it
function takePhoto() {
  const video = $("cameraVideo");
  if (!stream || !video.videoWidth) return;
  // Digital zoom: keep only the middle part. (The camera's own zoom is already in the picture.)
  const z = realZoom ? 1 : zoom, vw = video.videoWidth, vh = video.videoHeight;
  const w = Math.round(vw / z), h = Math.round(vh / z);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(video, (vw - w) / 2, (vh - h) / 2, w, h, 0, 0, w, h);
  $("cameraFlash").classList.remove("go"); void $("cameraFlash").offsetWidth; $("cameraFlash").classList.add("go");
  c.toBlob(blob => {
    if (!blob) return;
    const d = new Date(), pad = n => String(n).padStart(2, "0");
    const name = `camera-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.jpg`;
    closeCamera();
    const photo = new File([blob], name, { type: "image/jpeg" });
    photo.fromCamera = true;
    showCrop(tagForTree(photo), "camera");
  }, "image/jpeg", 0.92);
}

// ---------- crop ----------
// After one photo is taken or picked, it shows with a box. Drag the box or its corners (or pinch)
// to frame just the bug, then tap "Check it": the AI sees the bug bigger and guesses better.
// Leaving the box alone checks the whole photo, like before. The original photo is never changed.
const MIN_CROP = 224;   // smallest box, in photo pixels: the AI looks at 224×224, so smaller is just blurry
let cropFile = null, cropSource = "", box = null, minBox = null;   // box and minBox are fractions of the photo

function showCrop(file, source) {
  if (!$("crop")) {   // pages without the crop step (like 2.7/): check it right away, as before
    deliver(file);
    if (source === "camera") $("cards")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  cropFile = file; cropSource = source;
  const img = $("cropImg");
  if (img.src) URL.revokeObjectURL(img.src);
  $("checkIt").disabled = true;
  img.onload = () => {
    minBox = { w: Math.min(1, MIN_CROP / img.naturalWidth), h: Math.min(1, MIN_CROP / img.naturalHeight) };
    setBox({ x: 0, y: 0, w: 1, h: 1 });
    $("checkIt").disabled = false;
    $("checkIt").focus({ preventScroll: true });
  };
  img.onerror = () => { hideCrop(); deliver(file); };   // classify shows "Couldn't read this image"
  img.src = URL.createObjectURL(file);
  $("cropRetake").textContent = source === "camera" || source === "capture" ? "Retake" : "Choose another";
  $("crop").hidden = false;
  $("crop").scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideCrop() {
  const img = $("cropImg");
  $("crop").hidden = true;
  if (img.src) { URL.revokeObjectURL(img.src); img.removeAttribute("src"); }
  cropFile = null;
}

// Keeps the box inside the photo and no smaller than minBox, then draws it
function setBox(b) {
  const w = Math.min(Math.max(b.w, minBox.w), 1), h = Math.min(Math.max(b.h, minBox.h), 1);
  box = { w, h, x: Math.min(Math.max(b.x, 0), 1 - w), y: Math.min(Math.max(b.y, 0), 1 - h) };
  Object.assign($("cropBox").style, { left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` });
}

// Grows or shrinks the box around its middle (scale < 1 = smaller box = more zoomed in)
function scaleBox(from, scale) {
  const w = Math.min(Math.max(from.w * scale, minBox.w), 1), h = Math.min(Math.max(from.h * scale, minBox.h), 1);
  setBox({ w, h, x: from.x + (from.w - w) / 2, y: from.y + (from.h - h) / 2 });
}

async function checkCrop() {
  const file = cropFile, b = box;
  if (!file) return;
  hideCrop();
  $("cards")?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (b.w > 0.999 && b.h > 0.999) { deliver(file); return; }   // box untouched: the whole photo
  try {
    const bmp = await createImageBitmap(file);
    const sx = Math.round(b.x * bmp.width), sy = Math.round(b.y * bmp.height);
    const sw = Math.round(b.w * bmp.width), sh = Math.round(b.h * bmp.height);
    const c = document.createElement("canvas");
    c.width = sw; c.height = sh;
    c.getContext("2d").drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
    bmp.close?.();
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.92));
    if (!blob) throw new Error("couldn't make the zoomed photo");
    const zoomed = new File([blob], file.name.replace(/\.[^.]+$/, "") + "-zoomed.jpg", { type: "image/jpeg" });
    zoomed.fromCamera = file.fromCamera;
    zoomed.tree = file.tree;
    zoomed.original = file;   // the AI-photo check reads labels that only the original file has
    deliver(zoomed);
  } catch (e) {
    console.error(e);
    deliver(file);   // zooming failed: use the whole photo instead
  }
}

function retake() {
  const source = cropSource;
  hideCrop();
  if (source === "camera") openCamera();
  else if (source === "capture") $("captureInput").click();
  else $("photoInput").click();
}

if ($("crop")) {
  $("checkIt").onclick = checkCrop;
  $("cropCancel").onclick = hideCrop;
  $("cropRetake").onclick = retake;
  $("cropWhole").onclick = () => setBox({ x: 0, y: 0, w: 1, h: 1 });

  // Drag the box to move it, drag a corner to resize it, or pinch with two fingers anywhere
  const stage = $("cropStage"), fingers = new Map();
  let drag = null, pinch = null;
  const spread = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  stage.addEventListener("pointerdown", e => {
    if (!box) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) { drag = null; pinch = { spread: spread(), box: { ...box } }; return; }
    const edge = e.target.dataset?.edge || (e.target === $("cropBox") ? "move" : null);
    if (!edge) return;
    e.preventDefault();
    try { stage.setPointerCapture(e.pointerId); } catch {}   // keeps the drag going if the finger slides off the photo
    drag = { id: e.pointerId, edge, x: e.clientX, y: e.clientY, box: { ...box } };
  });
  stage.addEventListener("pointermove", e => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && fingers.size === 2) { scaleBox(pinch.box, pinch.spread / spread()); return; }
    if (!drag || drag.id !== e.pointerId) return;
    const r = stage.getBoundingClientRect(), s = drag.box;
    const dx = (e.clientX - drag.x) / r.width, dy = (e.clientY - drag.y) / r.height;
    if (drag.edge === "move") { setBox({ ...s, x: s.x + dx, y: s.y + dy }); return; }
    // Corners: the opposite corner stays put
    let { x, y, w, h } = s;
    const right = s.x + s.w, bottom = s.y + s.h;
    if (drag.edge.includes("w")) { x = Math.min(Math.max(s.x + dx, 0), right - minBox.w); w = right - x; }
    if (drag.edge.includes("e")) w = Math.min(Math.max(s.w + dx, minBox.w), 1 - s.x);
    if (drag.edge.includes("n")) { y = Math.min(Math.max(s.y + dy, 0), bottom - minBox.h); h = bottom - y; }
    if (drag.edge.includes("s")) h = Math.min(Math.max(s.h + dy, minBox.h), 1 - s.y);
    setBox({ x, y, w, h });
  });
  ["pointerup", "pointercancel"].forEach(t => stage.addEventListener(t, e => {
    fingers.delete(e.pointerId);
    if (drag?.id === e.pointerId) drag = null;
    if (fingers.size < 2) pinch = null;
  }));

  // Keyboard: arrows move the box (Shift = faster), + and - resize it, Enter checks the photo
  $("cropBox").addEventListener("keydown", e => {
    if (!box) return;
    const step = e.shiftKey ? 0.1 : 0.02;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) setBox({ ...box, x: box.x + moves[e.key][0], y: box.y + moves[e.key][1] });
    else if (e.key === "+" || e.key === "=") scaleBox(box, 1.1);
    else if (e.key === "-" || e.key === "_") scaleBox(box, 0.9);
    else if (e.key === "Enter") checkCrop();
    else return;
    e.preventDefault();
  });
}

if ($("openCamera")) $("openCamera").onclick = openCamera;
$("closeCamera").onclick = closeCamera;
$("shutter").onclick = takePhoto;
$("switchCamera").onclick = () => { facing = facing === "environment" ? "user" : "environment"; startCamera(); };
$("useCameraApp").onclick = () => { closeCamera(); $("captureInput").click(); };
$("captureInput").onchange = e => { handleFiles(e.target.files, "capture"); e.target.value = ""; };
// Don't keep the camera running in a background tab
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopStream();
  else if (!$("camera").hidden && !stream) startCamera();
});

// ---------- wiring ----------
if ($("pickPhotos")) $("pickPhotos").onclick = () => $("photoInput").click();
$("photoInput").onchange = e => { handleFiles(e.target.files, "pick"); e.target.value = ""; };
if ($("pickFolder")) {  // only on pages that have the folder button
  $("pickFolder").onclick = () => $("folderInput").click();
  $("folderInput").onchange = e => { handleFiles(e.target.files, "pick"); e.target.value = ""; };
}
const tray = $("tray");
if (tray) {   // pages with the drop-photos box
  ["dragenter", "dragover"].forEach(t => tray.addEventListener(t, e => { e.preventDefault(); tray.classList.add("drag"); }));
  ["dragleave", "drop"].forEach(t => tray.addEventListener(t, e => { e.preventDefault(); tray.classList.remove("drag"); }));
  tray.addEventListener("drop", e => handleFiles(e.dataTransfer.files, "drop"));
}

$("retryReports").onclick = () => sendPending();
window.addEventListener("online", () => sendPending());

showReportState();
renderMine();
refreshLevels();
sendPending();
loadModel();
