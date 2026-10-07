const CACHE_NAME = 'ubs-bank-' + /*__BUILD_ID__*/ 'development';
const PRECACHE_URLS = /*__PWA_ASSETS__*/ [];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const results = await Promise.allSettled(PRECACHE_URLS.map(async path => {
        const response = await fetch(new Request(path, { cache: 'reload' }));
        if (!isValidResponse(path, response)) throw new Error('Invalid PWA asset: ' + path);
        await cache.put(path, response);
      }));
      const failed = results.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
});

function isValidResponse(path, response) {
  if (!response.ok || response.type === 'opaque') return false;
  const type = (response.headers.get('content-type') || '').split(';')[0].trim();
  if (/\.js$/.test(path)) return /^(application|text)\/(javascript|ecmascript)$/.test(type);
  if (/\.css$/.test(path)) return type === 'text/css';
  if (/\.png$/.test(path)) return type === 'image/png';
  if (/\.json$/.test(path)) return type === 'application/json' || type === 'application/manifest+json';
  if (path === '/' || path.endsWith('.html')) return type === 'text/html';
  return true;
}

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
      // The HTML and its hashed assets must always belong to this worker's build.
      // New deployments stay in a waiting worker until the user refreshes.
      const cache = await caches.open(CACHE_NAME);
      const shell = await cache.match('/index.html');
      if (shell && isValidResponse('/index.html', shell)) return shell;
      return fetch(new Request(request, { cache: 'reload' }));
    })());
    return;
  }

  // Only the public application shell is cached; banking API data stays online.
  if (!PRECACHE_URLS.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached && isValidResponse(url.pathname, cached)) return cached;
    if (cached) await cache.delete(request, { ignoreSearch: true });
    const response = await fetch(request);
    if (!isValidResponse(url.pathname, response)) return Response.error();
    if (response.type === 'basic') await cache.put(request, response.clone());
    return response;
  })());
});
