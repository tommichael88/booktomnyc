const CACHE_NAME = 'booktom-v1';
const urlsToCache = [
  '/',
  '/index.html',
  'https://tommichael88.github.io/booktomnyc/External/styles.css',
  'https://tommichael88.github.io/booktomnyc/images/tht_logo.png?raw=true',
  'https://tommichael88.github.io/booktomnyc/images/TomKongerslev_nobg.png?raw=true',
  'https://github.com/tommichael88/booktomnyc/blob/main/images/pg_background7.png?raw=true',
  'https://github.com/tommichael88/booktomnyc/blob/main/images/service_schedule.png?raw=true',
  'https://github.com/tommichael88/booktomnyc/blob/main/images/manageVisitBtn.png?raw=true',
  'https://github.com/tommichael88/booktomnyc/blob/main/images/checkout.png?raw=true',
  'https://github.com/tommichael88/booktomnyc/blob/main/images/invoices.png?raw=true',
  'https://raw.githubusercontent.com/tommichael88/booktomnyc/refs/heads/main/images/tht_loglow.png',
  'https://tommichael88.github.io/booktomnyc/new_services.json' // dynamic data cache
];

// Install – cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate – clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch – stale-while-revalidate for HTML/JSON, cache-first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // For navigation requests (HTML) use network-first, fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For API/data JSON (like new_services.json) – network first, cache fallback
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For images, CSS, JS – cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => cachedResponse || fetch(event.request))
  );
});
