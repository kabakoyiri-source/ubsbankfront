const CACHE_NAME = 'ubs-bank-' + /*__BUILD_ID__*/ 'development';
const PRECACHE_URLS = /*__PWA_ASSETS__*/ [];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)));
});

// Updates wait until the user chooses to refresh, preserving unsaved forms.
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('ubs-bank-') && key !== CACHE_NAME).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      /^\/api(?:\/|$)/.test(url.pathname) || request.headers.has('authorization')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (!response.ok) throw new Error('Navigation unavailable');
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match('/index.html') || Response.error();
      }
    })());
    return;
  }

  // Only the public application shell is cached; banking API data stays online.
  if (!PRECACHE_URLS.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
    return response;
  })());
});
