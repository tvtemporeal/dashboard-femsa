// Service Worker — Estoque FEMSA Maringá
// Estratégia:
// - index.html / navegação: NETWORK-FIRST (sempre pega a versão nova online; usa cache só offline)
// - libs e demais assets: cache-first com revalidação em segundo plano
// - dados (api.github/raw): sempre rede (não cacheia aqui; o app já controla)
const CACHE_NOME = 'femsa-estoque-v4';
const ASSETS_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './exceljs.min.js',
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
    ).then(() => self.clients.claim())
  );
});

function ehHTML(req) {
  return req.mode === 'navigate' ||
         (req.destination === 'document') ||
         (req.url.endsWith('/') || req.url.endsWith('index.html'));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Dados: nunca serve versão em cache velha (o app controla frescor)
  if (url.hostname.includes('api.github.com') || url.hostname.includes('raw.githubusercontent.com') ||
      url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // HTML / navegação: NETWORK-FIRST
  if (ehHTML(req)) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NOME).then(c => c.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Demais assets: cache-first com revalidação
  e.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NOME).then(c => c.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
