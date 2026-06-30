// Service Worker — Estoque FEMSA Maringá
// Estratégia:
// - Assets estáticos (HTML/JS/CSS/lib): cache-first com revalidação
// - APIs (script.google.com): network-first, fallback pra cache se offline
const CACHE_NOME = 'femsa-estoque-v3';
const ASSETS_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NOME).then(c => c.addAll(ASSETS_CACHE).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NOME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Apps Script: network-first
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    e.respondWith(
      fetch(e.request).then(res => {
        // Não cacheia POST nem respostas com erro
        if (e.request.method === 'GET' && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NOME).then(c => c.put(e.request, clone)).catch(()=>{});
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Demais: cache-first com fallback rede
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (e.request.method === 'GET' && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NOME).then(c => c.put(e.request, clone)).catch(()=>{});
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
