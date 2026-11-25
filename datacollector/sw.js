// Keeps the Data Collector on the phone: open it once with internet, and after that it works offline.
// With internet the newest copy is used and saved again. A very slow connection falls back to the saved copy.
const PREFIX = 'pyinsect-collector-';
const CACHE = PREFIX + '14';
const FILES = ['./', 'index.html', 'style.css?v=10', 'jszip.min.js', 'app.js?v=19', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
// The auto zoom files (about 20 MB) have their own copy, so an app update doesn't download them again.
const AI_CACHE = PREFIX + 'ai-1';
const SITE = self.location.hostname.endsWith('github.io') ? new URL('../', self.location.href).href : 'https://wizkidzai.github.io/pyinsect/';
const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
const AI_FILES = [ORT + 'ort.wasm.min.js', ORT + 'ort-wasm-simd-threaded.mjs', ORT + 'ort-wasm-simd-threaded.wasm',
  SITE + 'assets/insect-finder.js', SITE + 'model/insect_finder_ssdlite_v2.onnx'];
// The website's fonts have their own copy too. They are saved the first time the page loads them.
const FONT_CACHE = PREFIX + 'fonts-1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await (await caches.open(CACHE)).addAll(FILES);
    const ai = await caches.open(AI_CACHE);
    // If one of these fails, the app still works, just without auto zoom until it can be downloaded.
    await Promise.allSettled(AI_FILES.map(async f => { if (!(await ai.match(f))) await ai.add(f); }));
    try {   // fonts: the style sheet, then the font files it names
      const fonts = await caches.open(FONT_CACHE);
      const page = await (await fetch('index.html', { cache: 'no-cache' })).text();
      const link = page.match(/https:\/\/fonts\.googleapis\.com\/css2[^"]+/)[0];
      const res = await fetch(link);
      const files = (await res.clone().text()).match(/https:\/\/fonts\.gstatic\.com[^)]+/g) || [];
      await fonts.put(link, res);
      await Promise.allSettled(files.map(f => fonts.add(f)));
    } catch (err) { /* no fonts yet: the app uses the phone's own font */ }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIX) && k !== CACHE && k !== AI_CACHE && k !== FONT_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (AI_FILES.includes(url.href)) {   // saved copy first
    e.respondWith((async () => {
      const ai = await caches.open(AI_CACHE);
      const hit = await ai.match(url.href);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) ai.put(url.href, res.clone());
      return res;
    })());
    return;
  }
  if (FONT_HOSTS.includes(url.hostname)) {   // saved copy first
    e.respondWith((async () => {
      const fonts = await caches.open(FONT_CACHE);
      const hit = await fonts.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') fonts.put(req, res.clone());
      return res;
    })());
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const cached = async () => (await c.match(req)) || (await c.match(req, { ignoreSearch: true })) ||
      (req.mode === 'navigate' ? await c.match('index.html') : undefined);
    const fresh = fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) c.put(req, res.clone()); return res; });
    const slow = new Promise(r => setTimeout(r, 3000)).then(cached);
    try {
      return (await Promise.race([fresh, slow])) || (await fresh);
    } catch (err) {
      return (await cached()) || Response.error();
    }
  })());
});
