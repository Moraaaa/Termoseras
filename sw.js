// sw.js (root del sito)
const CACHE_VERSION = 'v1.0.0';             // ↑ cambia quando aggiorni asset
const PRECACHE_NAME = `precache-${CACHE_VERSION}`;
const RUNTIME_NAME  = `runtime-${CACHE_VERSION}`;

const BASE = new URL(self.registration.scope).pathname;

// ✅ Elenco degli asset "di sito" da scaricare UNA volta alla prima visita
// Metti file realmente usati su tutto il sito (logo, css, js, font, immagini comuni).
const PRECACHE_URLS = [
  `${BASE}`,                 // homepage (verrà aggiornata con strategia runtime)
  `${BASE}style.css`,
  `${BASE}assets/logo.svg`,
  `${BASE}assets/soloscritta.svg`,
  `${BASE}assets/logotrea.svg`,
  `${BASE}assets/darklogo.png`,
  `${BASE}assets/lightlogo.png`,

  // Font self-hosted (se li hai). Se usi Google Fonts, meglio runtime cache.
  // '/assets/fonts/montserrat-400.woff2',
  // '/assets/fonts/montserrat-600.woff2',

  // Immagini ricorrenti in più pagine:
  `${BASE}assets/noccioli.jpg`,
  `${BASE}assets/scopini.jpg`,
  `${BASE}assets/riccipvc.jpg`,
  `${BASE}assets/qualità.jpg`,
  `${BASE}assets/compatibilità.jpg`,
  `${BASE}assets/tempiecontrollo.jpg`,
  `${BASE}assets/fotoinarrivo.svg`,
  `${BASE}assets/videoinarrivo.svg`,
  `${BASE}assets/1.png`,
  `${BASE}assets/controlloqualità.jpg`,
  `${BASE}assets/hero-chisiamo.svg`,
  `${BASE}assets/hero-contatti.svg`,
  `${BASE}assets/stock.jpg`,

  // JS comuni (se esistono), icone, sprite, ecc.
  // '/scripts/main.js',
];

// ❗ Evita di precache-are video grossi (mp4/webm): pesanti e inutili a tutti.
// Meglio farli arrivare via rete con cache HTTP o runtime caching mirato.

// Install: scarica e mette in cache gli asset UNA volta
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE_NAME);
    // addAll fallisce se 1 URL non esiste: in alternativa fai add one-by-one
    await cache.addAll(PRECACHE_URLS);
    // Attiva subito la nuova SW
    await self.skipWaiting();
  })());
});

// Activate: pulizia vecchie versioni
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => ![PRECACHE_NAME, RUNTIME_NAME].includes(k))
          .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// Strategia di caching:
// - HTML: Stale-While-Revalidate (apre subito, aggiorna in background)
// - CSS/JS/IMG/Font: Cache-First (usa cache; se manca va in rete e poi salva)
// - Video: passa diretto alla rete (evita di intasare cache; i browser gestiscono range)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo stessa origine
  if (url.origin !== self.location.origin) {
    // Esempio: cache leggera per Google Fonts (opzionale)
    if (url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('fonts.googleapis.com')) {
      event.respondWith(fontsRuntime(req));
    }
    return;
  }

  // Navigazioni (document HTML)
  if (req.mode === 'navigate') {
    event.respondWith(htmlStrategy(req));
    return;
  }

  switch (req.destination) {
    case 'style':
    case 'script':
    case 'image':
    case 'font':
      event.respondWith(cacheFirst(req));
      break;
    case 'video':
      // Lascia gestire al browser (range requests); puoi aggiungere una SWR leggera se vuoi
      // event.respondWith(staleWhileRevalidate(req));
      break;
    default:
      // per tutto il resto: SWR
      event.respondWith(staleWhileRevalidate(req));
  }
});

async function htmlStrategy(req) {
  // Stale-While-Revalidate per documenti
  const cache = await caches.open(RUNTIME_NAME);
  const cached = await cache.match(req);
  const netFetch = fetch(req).then(res => {
    // Salva solo 200 OK e basic (stessa origine)
    if (res && res.status === 200 && res.type === 'basic') {
      cache.put(req, res.clone());
    }
    return res;
  }).catch(() => cached); // offline → fallback alla cache se esiste

  return cached || netFetch;
}

async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;

  const res = await fetch(req, { cache: 'no-store' });
  if (res && res.status === 200 && res.type === 'basic') {
    cache.put(req, res.clone());
  }
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_NAME);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then(res => {
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  }).catch(() => cached); // offline

  return cached || fetchPromise;
}

// Cache leggera per Google Fonts (opzionale)
async function fontsRuntime(req) {
  const cache = await caches.open(RUNTIME_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req, { mode: 'no-cors' }).catch(() => null);
  if (res) cache.put(req, res.clone());
  return res || cached || fetch(req);
}
