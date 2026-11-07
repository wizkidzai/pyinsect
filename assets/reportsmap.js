// The map screen: our numbers at the top (from the relay's /stats), then everyone's Detect reports
// as squares about 200 m wide (from the relay's /map: no photos, ids, or exact spots). Squares, not
// pins, because we only know the rough area. This phone's own reports are added in their own colors,
// and only this phone sees those: the newest one, and the older ones.
// The map has + / − zoom buttons and a "Find me" button (your spot stays on this phone).
// Signed in as Team: the squares come from the relay's /team-map instead, about 50 m wide (the team
// spot), so our team can tell the experts where to look. Everyone else still sees 200 m.
// Uses $, el, RELAY_URL, mine, AREA_DEG, SPOT_DEG from app.js and reports.js, and account from
// account.js. flow.js calls reportsMap.show().

(() => {
const COLORS = { new: "#e8590c", older: "#8e44ad", everyone: "#2f6fb3" };
const LEVEL_TEXT = { verified: "Checked by our team", ai: "AI checked", unchecked: "Not checked yet" };
let map = null, layer = null, me = null, loading = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return loading ??= new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    const js = document.createElement("script");
    js.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    js.onload = resolve; js.onerror = () => { loading = null; reject(); };
    document.head.append(css, js);
  });
}

const relay = (path, headers = {}) => fetch(RELAY_URL.replace(/\/$/, "") + path, { cache: "no-store", headers }).then(res => {
  if (!res.ok) throw new Error(`the report server answered ${res.status}`);
  return res.json();
});

// Our numbers. They start at 0 and go up as people send reports.
async function showStats() {
  try {
    const s = await relay("/stats");
    $("statEab").textContent = (s.eab || 0).toLocaleString();
    $("statDamage").textContent = (s.damage || 0).toLocaleString();
    $("statGalleries").textContent = (s.galleries || 0).toLocaleString();
    $("statTrees").textContent = (s.trees || 0).toLocaleString();
    $("statsMsg").textContent = "From reports sent with Pyinsect.";
  } catch {
    $("statsMsg").textContent = "Couldn't get the newest numbers right now. Try again later.";
  }
}

// The corners of the grid square around a square's middle (the same grid as roughArea, or as
// teamSpot when size is "spot")
function squareBounds(lat, lon, size = "area") {
  const deg = size === "spot" ? SPOT_DEG : AREA_DEG, lonStep = deg / Math.max(0.2, Math.cos(lat * Math.PI / 180));
  return [[lat - deg / 2, lon - lonStep / 2], [lat + deg / 2, lon + lonStep / 2]];
}

// Team only: the reports at the ~50 m team spot, or null (not Team, or it didn't work)
async function teamReports() {
  if (window.account?.level() !== "team") return null;
  const { pass } = await account.pass();
  if (!pass) return null;
  return (await relay("/team-map", { "X-Pass": pass })).reports || [];
}
const monthName = m => { const d = new Date(m + "-15T12:00:00"); return isNaN(d) ? m : d.toLocaleDateString([], { month: "long", year: "numeric" }); };

// What's in one square, like "2 × Emerald ash borer damage · Not checked yet · October 2026"
function popup(sq) {
  const box = el("div", "map-popup"), groups = {};
  for (const r of sq.reports) { const k = `${r.name}|${r.level}|${r.month}`; groups[k] = (groups[k] || 0) + 1; }
  for (const [k, n] of Object.entries(groups).sort((a, b) => b[1] - a[1])) {
    const [name, level, month] = k.split("|"), line = el("p");
    line.append(el("strong", null, `${n > 1 ? n + " × " : ""}${name}`), el("br"), `${LEVEL_TEXT[level] || level} · ${monthName(month)}`);
    box.append(line);
  }
  if (sq.mine.length) {
    const newest = sq.mine.some(m => m.newest);
    box.append(el("p", "map-mine", `${newest ? "🟠 Your newest report" : "🟣 " + (sq.mine.length === 1 ? "Your report" : sq.mine.length + " of your reports")} (only you see this)`));
  }
  box.append(el("p", "map-note", sq.size === "spot" ? "⭐ Team view: about 50 m square. Only our team sees this."
    : "About 200 m square. The exact spot is never shared."));
  return box;
}

// reports = everyone's (from the relay); myReports = this phone's, newest first
function draw(reports, myReports) {
  layer?.remove();
  const squares = new Map();   // "size,lat,lon" → { lat, lon, size, reports: [], mine: [] }
  const square = (lat, lon, size = "area") => {
    const k = `${size},${lat},${lon}`;
    if (!squares.has(k)) squares.set(k, { lat, lon, size, reports: [], mine: [] });
    return squares.get(k);
  };
  for (const r of reports) square(r.lat, r.lon, r.size).reports.push(r);
  myReports.forEach((m, i) => square(m.area.lat, m.area.lon).mine.push({ ...m, newest: i === 0 }));
  layer = L.layerGroup();
  let newest = null;
  for (const sq of squares.values()) {
    // A square with your newest report is orange, with older ones of yours purple, else blue
    const kind = sq.mine.some(m => m.newest) ? "new" : sq.mine.length ? "older" : "everyone";
    const rect = L.rectangle(squareBounds(sq.lat, sq.lon, sq.size), { color: COLORS[kind], weight: kind === "everyone" ? 1.5 : 3, fillColor: COLORS[kind], fillOpacity: 0.45 });
    rect.bindPopup(popup(sq));
    const count = Math.max(sq.reports.length, sq.mine.length);
    const label = L.marker([sq.lat, sq.lon], { interactive: false, keyboard: false,
      icon: L.divIcon({ className: "map-count", html: String(count), iconSize: [26, 26] }) });
    layer.addLayer(rect).addLayer(label);
    if (kind === "new") newest = rect;
  }
  layer.addTo(map);
  if (newest) {
    map.setView(newest.getBounds().getCenter(), 15);   // your newest report, in the middle (tap it to see more)
  } else if (squares.size) {
    map.fitBounds(L.latLngBounds([...squares.values()].map(sq => squareBounds(sq.lat, sq.lon, sq.size)).flat()).pad(0.2), { maxZoom: 14 });
  } else {
    map.setView([44, -120.5], 6);   // Oregon
  }
  return squares.size;
}

// "📍 Find me": moves the map to where you are. The blue dot is only on this phone.
function addFindMe() {
  const FindMe = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const b = L.DomUtil.create("button", "find-me");
      b.type = "button"; b.textContent = "📍 Find me"; b.title = "Move the map to where you are";
      L.DomEvent.disableClickPropagation(b);
      b.onclick = () => {
        if (!navigator.geolocation) { $("reportsMapMsg").textContent = "This browser can't find your location."; return; }
        b.disabled = true; b.textContent = "Finding you…";
        navigator.geolocation.getCurrentPosition(pos => {
          const here = [pos.coords.latitude, pos.coords.longitude];
          me?.remove();
          me = L.circleMarker(here, { radius: 8, color: "#fff", weight: 3, fillColor: "#1a73e8", fillOpacity: 1 }).addTo(map).bindTooltip("You are here (only you see this)");
          map.setView(here, 15);
          b.disabled = false; b.textContent = "📍 Find me";
        }, () => {
          $("reportsMapMsg").textContent = "Turn on location for this site to use Find me.";
          b.disabled = false; b.textContent = "📍 Find me";
        }, { timeout: 15000, maximumAge: 60000 });
      };
      return b;
    },
  });
  map.addControl(new FindMe());
}

async function show() {
  const msg = $("reportsMapMsg");
  showStats();
  msg.textContent = "Loading the map…";
  let reports = [], problem = "", note = "";
  try {
    await loadLeaflet();
    // Team gets the ~50 m squares. If that doesn't work, everyone's 200 m squares instead.
    const forTeam = await teamReports().catch(() => null);
    if (forTeam) note = "⭐ Team view: squares about 50 m wide. Only our team sees this. ";
    else if (window.account?.level() === "team") note = "Couldn't get the team view right now, so these are the 200 m squares. ";
    reports = forTeam || (await relay("/map")).reports || [];
  } catch (e) {
    if (!window.L) { msg.textContent = "The map couldn't load. Check your internet and try again."; return; }
    problem = `Couldn't get everyone's reports (${e.message}). Showing only yours.`;
  }
  const myReports = myMapReports();
  if (!map) {
    map = L.map("reportsMap", { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(map);
    addFindMe();
  }
  map.invalidateSize();
  const n = draw(reports, myReports);
  msg.textContent = problem || note + (n ? `${reports.length} report${reports.length === 1 ? "" : "s"} from everyone. Tap a square to see what's there.`
    : "No reports on the map yet. Yours will show here after you send one.");
}

// This phone's reports that have an area, newest first: from Detect, and bugs caught with the
// game's camera (assets/game.js). Only this phone sees them.
const myMapReports = () => mine.get().filter(m => m.area && m.level !== "not_match");

// A small copy of the map for the game (assets/game.js): everyone's squares, and (with you: true)
// a blue dot where you are. The dot stays on this phone. It can't be dragged or zoomed: tapping it
// opens the Map screen instead.
const minis = {};
async function mini(id, { you = false } = {}) {
  try { await loadLeaflet(); } catch { return; }
  let m = minis[id];
  if (!m) {
    m = minis[id] = { map: L.map(id, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
      boxZoom: false, keyboard: false, touchZoom: false }), layer: null, me: null };
    m.map.attributionControl.setPrefix(false);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(m.map);
    m.map.setView([44, -120.5], 6);   // Oregon
  }
  m.map.invalidateSize();
  let reports = [];
  try { reports = (await relay("/map")).reports || []; } catch {}
  // Everyone's squares in blue, then yours on top: your newest in orange, older ones in purple
  const square = (lat, lon, kind) => L.rectangle(squareBounds(lat, lon),
    { color: COLORS[kind], weight: kind === "everyone" ? 1 : 2, fillColor: COLORS[kind], fillOpacity: 0.5, interactive: false });
  const yours = myMapReports();
  m.layer?.remove();
  m.layer = L.layerGroup([...reports.map(r => square(r.lat, r.lon, "everyone")),
    ...yours.slice().reverse().map((r, i, all) => square(r.area.lat, r.area.lon, i === all.length - 1 ? "new" : "older"))]).addTo(m.map);
  if (!you) {
    if (yours.length) m.map.setView([yours[0].area.lat, yours[0].area.lon], 13);   // your newest report
    else if (reports.length) m.map.fitBounds(L.latLngBounds(reports.map(r => squareBounds(r.lat, r.lon)).flat()).pad(0.2), { maxZoom: 13 });
  }
  if (you && navigator.geolocation) navigator.geolocation.getCurrentPosition(pos => {
    const here = [pos.coords.latitude, pos.coords.longitude];
    m.me?.remove();
    m.me = L.circleMarker(here, { radius: 6, color: "#fff", weight: 2, fillColor: "#1a73e8", fillOpacity: 1, interactive: false }).addTo(m.map);
    m.map.setView(here, 14);
  }, () => {}, { timeout: 15000, maximumAge: 60000 });
}

window.reportsMap = { show, mini };
})();
