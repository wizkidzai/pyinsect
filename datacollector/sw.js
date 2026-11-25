// Keeps the Data Collector on the phone: open it once with internet, and after that it works offline.
// With internet the newest copy is used and saved again. A very slow connection falls back to the saved copy.
const PREFIX = 'pyinsect-collector-';
const CACHE = PREFIX + '9';
const FILES = ['./', 'index.html', 'style.css?v=8', 'jszip.min.js', 'app.js?v=16', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const cached = async () => (await c.match(req)) || (await c.match(req, { ignoreSearch: true })) ||
      (req.mode === 'navigate' ? await c.match('index.html') : undefined);
    const fresh = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; });
    const slow = new Promise(r => setTimeout(r, 3000)).then(cached);
    try {
      return (await Promise.race([fresh, slow])) || (await fresh);
    } catch (err) {
      return (await cached()) || Response.error();
    }
  })());
});
