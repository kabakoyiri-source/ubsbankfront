const CACHE_NAME = 'ubs-bank-' + /*__BUILD_ID__*/ 'development';
const PRECACHE_URLS = /*__PWA_ASSETS__*/ [];
const RECOVERY_MARKER = '/__pwa_legacy_recovery__';

async function hasBrokenLegacyShell() {
  // v1/v2 cached only HTML and the logo, not Vite's hashed JS/CSS. After a
  // deployment those pages cannot boot, so there is no update button to click.
  for (const name of await caches.keys()) {
    if (!/^ubs-bank-v\d+$/.test(name)) continue;
    const cache = await caches.open(name);
    const shell = await cache.match('/index.html') || await cache.match('/');
    if (!shell) continue;
    const html = await shell.text();
    const assets = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/g)].map(match => match[1]);
    for (const path of assets) {
      const response = await cache.match(path);
      if (!response || !isValidResponse(path, response)) return true;
    }
  }
  return false;
}

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
      if (await hasBrokenLegacyShell()) {
        await cache.put(RECOVERY_MARKER, new Response('recover'));
        await self.skipWaiting();
      }
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

// Healthy installations wait for the user's refresh; broken legacy shells
// migrate automatically only after the replacement build is fully cached.
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const recover = !!(await cache.match(RECOVERY_MARKER));
    await cache.delete(RECOVERY_MARKER);
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('ubs-bank-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
    if (recover) {
      const clients = await self.clients.matchAll({ type: 'window' });
      // Navigation's fetch waits for activation to finish. Do not await it
      // inside this activation event, or both operations wait on each other.
      for (const client of clients) client.navigate(client.url).catch(() => {});
    }
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      /^\/api(?:\/|$)/.test(url.pathname) || request.headers.has('authorization')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      // A deliberate repair URL must reach fresh HTML, even when this worker
      // still controls the current document after unregister().
      if (url.searchParams.has('pwa-repair')) {
        try {
          const response = await fetch(new Request(request, { cache: 'reload' }));
          if (isValidResponse('/index.html', response)) return response;
        } catch { /* Keep the installed shell available offline. */ }
      }
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
