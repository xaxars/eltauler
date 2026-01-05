// Service Worker per El Tauler PWA
const CACHE_VERSION = '1.0.6';
const CACHE_NAME = `eltauler-${CACHE_VERSION}`; // He pujat la versió per forçar l'actualització
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  `./app.js?v=${CACHE_VERSION}`,
  `./manifest.json?v=${CACHE_VERSION}`,
  `./stockfish.js?v=${CACHE_VERSION}`, // <--- ARA APUNTA AL FITXER LOCAL
  'https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Cinzel:wght@500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.css',
  'https://code.jquery.com/jquery-3.6.0.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Instal·lació del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache obert');
        return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
          console.log('Error afegint al cache:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activació del Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminant cache antic:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratègia de cache: Network First amb fallback a cache
self.addEventListener('fetch', (event) => {
  // Ignorem les peticions de chrome-extension i altres no-http
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la resposta és vàlida, la guardem al cache
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si no hi ha xarxa, busquem al cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si és una navegació, tornem l'index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

// Missatge per actualitzar el cache manualment
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
