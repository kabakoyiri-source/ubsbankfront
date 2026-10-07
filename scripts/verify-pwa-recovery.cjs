const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright');

const dist = path.resolve(__dirname, '../dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(dist, 'service-worker.js'), 'utf8');
const legacyHtml = '<!doctype html><html><body><div id="root"></div><script type="module" src="/assets/index-removed.js"></script></body></html>';
// Reproduce the original v2 strategy: HTML-only precache, cache-first fetch.
const legacyWorker = `
const CACHE_NAME = 'ubs-bank-v2';
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(['/', '/index.html']))));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method === 'GET' && new URL(e.request.url).origin === self.location.origin)
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});`;
let version = 'legacy';
let freshHtml = false;
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Cache-Control', 'no-store');
  if (pathname === '/service-worker.js') {
    res.setHeader('Content-Type', 'application/javascript');
    return res.end(version === 'legacy' ? legacyWorker : version === 'invalid' ? worker.replace(/const CACHE_NAME = .+;/, "const CACHE_NAME = 'ubs-bank-qa-invalid';") : worker);
  }
  if (pathname === '/' || pathname === '/index.html' || !path.extname(pathname)) {
    res.setHeader('Content-Type', 'text/html');
    return res.end(version === 'legacy' ? legacyHtml : freshHtml ? html.replace('<html lang="fr">', '<html lang="fr" data-network-fresh="true">') : html);
  }
  if (pathname.endsWith('.js') && version === 'invalid') {
    res.setHeader('Content-Type', 'text/html');
    return res.end('<!doctype html>Missing deployment asset');
  }
  const target = path.resolve(dist, '.' + pathname);
  if (!target.startsWith(dist + path.sep) || !fs.existsSync(target)) {
    res.writeHead(404); return res.end();
  }
  res.setHeader('Content-Type', { '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' }[path.extname(target)] || 'text/plain');
  res.end(fs.readFileSync(target));
});

async function remember(page) {
  await page.evaluate(async () => {
    localStorage.setItem('recovery-retained', 'yes');
    await caches.open('unrelated-cache');
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const password = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode('test-recovery-password'));
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('ubs-device-login', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('preferences');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('preferences', 'readwrite');
        tx.objectStore('preferences').put({ enabled: true, email: 'recovery@example.test', password, iv, key }, 'login');
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    });
  });
}

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ ...devices['Pixel 7'] });
    const page = await context.newPage();
    await page.goto(base);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/service-worker.js');
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await remember(page);
    await page.reload();
    await page.reload();
    assert.equal(await page.locator('#root').innerHTML(), '', 'Legacy shell must reproduce the blank page');
    version = 'invalid';
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const failedInstall = new Promise(resolve => registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'redundant') resolve();
        });
      }, { once: true }));
      await registration.update();
      await failedInstall;
    });
    assert((await page.evaluate(() => caches.keys())).includes('ubs-bank-v2'), 'Failed replacement must retain the legacy cache');
    assert.equal(await page.locator('#root').innerHTML(), '');
    version = 'current';
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.getByRole('button', { name: 'Se connecter', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('input[name="username"]')?.value === 'recovery@example.test');
    assert.equal(await page.locator('input[name="password"]').inputValue(), 'test-recovery-password');
    const keys = await page.evaluate(() => caches.keys());
    assert(!keys.includes('ubs-bank-v2'));
    assert(keys.includes('unrelated-cache'));
    assert.equal(await page.evaluate(() => localStorage.getItem('recovery-retained')), 'yes');
    assert(await page.locator('#root').isVisible());
    freshHtml = true;
    await page.goto(base);
    await page.getByRole('button', { name: 'Se connecter', exact: true }).waitFor();
    assert.equal(await page.locator('html').getAttribute('data-network-fresh'), null, 'Normal navigation must use the cached matching build');
    await page.goto(base + '/?pwa-repair=1');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).waitFor();
    assert.equal(await page.locator('html').getAttribute('data-network-fresh'), 'true', 'Repair navigation must bypass the active cached shell');
    await context.setOffline(true);
    await page.goto(base + '/?pwa-repair=offline');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).waitFor();
    assert.equal(await page.locator('html').getAttribute('data-network-fresh'), null, 'Offline repair URL must retain the cached shell');
    freshHtml = false;
    await context.close();

    // Late JS must restore a root hidden by the standalone startup watchdog.
    const lateContext = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await lateContext.route('**/assets/*.js', async route => { await gate; await route.continue(); });
    const latePage = await lateContext.newPage();
    await latePage.goto(base, { waitUntil: 'commit' });
    await latePage.getByRole('button', { name: 'Réparer et recharger' }).waitFor();
    release();
    await latePage.getByRole('button', { name: 'Se connecter', exact: true }).waitFor();
    assert(await latePage.locator('#root').isVisible(), 'Late successful startup must unhide React');
    assert(!await latePage.locator('#startup-recovery').isVisible());
    await lateContext.close();

    // A failed CSS file cannot be dismissed merely because React has mounted.
    const cssContext = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
    await cssContext.route('**/assets/*.css', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>Wrong asset' }));
    const cssPage = await cssContext.newPage();
    await cssPage.goto(base);
    await cssPage.getByRole('button', { name: 'Réparer et recharger' }).waitFor();
    assert(!await cssPage.locator('#root').isVisible());
    await cssContext.close();
    console.log('PASS: Android legacy blank page migrates automatically; invalid updates preserve caches; encrypted credentials retained; late JS and missing CSS recovery.');
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
