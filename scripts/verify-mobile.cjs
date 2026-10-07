const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const qa = path.join(root, 'qa');
fs.mkdirSync(qa, { recursive: true });
const user = { id: 'test-admin', firstName: 'Jean', lastName: 'Dupont', email: 'test@example.test', role: 'admin', balance: 5000 };
const client = { _id: 'test-client', firstName: 'Marie', lastName: 'Martin', email: 'marie@example.test', phone: '+41 00 000 00 00', accountNumber: 'CH93 0076 2011 6238 5295 7', bankName: 'Banque de démonstration', bankAddress: 'Rue de la Paix', status: 'active', balance: 1234, currency: 'CHF', createdAt: new Date().toISOString() };
const operations = [{ _id: 'test-operation', type: 'deposit', amount: 1234567.89, currency: 'CHF', status: 'completed', clientId: client, description: 'Opération de démonstration', createdAt: new Date().toISOString(), sourceAccount: 'chf' }];
let updateVersion = false;
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(dist + path.sep)) { res.writeHead(403); return res.end(); }
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(dist, 'index.html');
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
  res.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  let content = fs.readFileSync(target);
  if (updateVersion && pathname === '/service-worker.js') content = content.toString().replace(/const CACHE_NAME = .+;/, "const CACHE_NAME = 'ubs-bank-qa-update';");
  res.end(content);
});

async function mockApi(context, state = {}) {
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (state.offline) return route.abort('internetdisconnected');
    if (state.failData && !url.pathname.startsWith('/api/auth')) return route.fulfill({ status: 503, json: { message: 'Indisponible' } });
    if (url.pathname === '/api/auth/me') {
      if (state.delayAuth) await new Promise(resolve => setTimeout(resolve, 500));
      return route.fulfill({ json: { success: true, user } });
    }
    if (url.pathname === '/api/auth/login') return route.fulfill({ status: 401, json: { success: false, message: 'Identifiants incorrects' } });
    const data = url.pathname === '/api/clients/test-client' ? client : url.pathname.startsWith('/api/clients') ? [client] : operations;
    return route.fulfill({ json: { success: true, data } });
  });
  await context.route('https://**', route => route.abort());
}

async function verifyAssets() {
  const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json')));
  assert.equal(manifest.theme_color, '#ffffff');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const file = path.join(dist, icon.src);
    const meta = await sharp(file).metadata();
    assert.equal(icon.sizes, meta.width + 'x' + meta.height);
    assert.equal(meta.width, meta.height);
    const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([...data.subarray(0, 3)], [255, 255, 255]);
    if (icon.purpose === 'maskable') {
      for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels;
        if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) {
          assert(Math.hypot(x - info.width / 2, y - info.height / 2) <= info.width * .4, 'Logo outside maskable safe zone');
        }
      }
    }
  }
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const links = [...html.matchAll(/href="(\/images\/splash\/([^"/]+))" media="([^"]+)"/g)];
  assert.equal(links.length, 38);
  for (const [, url, filename] of links) {
    const meta = await sharp(path.join(dist, url)).metadata();
    assert.equal(filename.split('-')[0], meta.width + 'x' + meta.height);
  }
  const sw = fs.readFileSync(path.join(dist, 'service-worker.js'), 'utf8');
  assert(!sw.includes('__PWA_ASSETS__'));
  assert(!sw.includes('__BUILD_ID__'));
  assert(sw.includes('/assets/index-') && sw.includes('.css') && sw.includes('.js'));
}

async function main() {
  await verifyAssets();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const failures = [];
  const errors = [];
  let count = 0;
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await mockApi(context);
    await context.addInitScript(({ user, operations }) => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('selectedOperation', JSON.stringify(operations[0]));
    }, { user, operations });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const routes = ['/', '/accounts', '/cards', '/more', '/profile', '/about', '/clients', '/clients/new', '/clients/test-client', '/operations', '/operations/new', '/operations/transfer', '/balance/load', '/history', '/operation-details'];
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(viewport);
      for (const route of routes) {
        await page.goto(base + route);
        await page.locator('.app-bottom-nav').waitFor();
        await page.waitForFunction(() => !document.querySelector('.loading-container, .loading'));
        const metrics = await page.evaluate(() => {
          const nav = document.querySelector('.app-bottom-nav');
          return {
            width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
            navCount: document.querySelectorAll('.app-bottom-nav').length,
            linkCount: nav.querySelectorAll('a').length,
            navBottom: nav.getBoundingClientRect().bottom, height: innerHeight,
            activeCount: nav.querySelectorAll('[aria-current="page"]').length,
            overflow: [...document.querySelectorAll('main *')].filter(el => !el.closest('[inert]') && el.getBoundingClientRect().right > innerWidth + 1 && el.getBoundingClientRect().width > 0).slice(0, 8).map(el => el.className.baseVal || el.className || el.tagName),
          };
        });
        count++;
        if (metrics.scrollWidth > metrics.width + 1) failures.push({ route, viewport, metrics });
        assert.equal(metrics.navCount, 1);
        assert.equal(metrics.linkCount, 5);
        assert.equal(metrics.activeCount, 1);
        assert(Math.abs(metrics.navBottom - metrics.height) <= 1);
        if (viewport.width === 390 && ['/', '/cards', '/operations/new'].includes(route)) {
          await page.screenshot({ path: path.join(qa, route === '/' ? 'home-mobile.png' : route === '/cards' ? 'cards-mobile.png' : 'payments-mobile.png'), fullPage: true });
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    await page.locator('.favorites-section').waitFor();
    await page.addStyleTag({ content: ':root { --app-safe-top: 47px; --app-safe-bottom: 34px; --app-safe-left: 0px; --app-safe-right: 0px; }' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const safe = await page.evaluate(() => ({
      nav: document.querySelector('.app-bottom-nav').getBoundingClientRect().toJSON(),
      last: document.querySelector('.favorite-item:last-child').getBoundingClientRect().toJSON(),
      padding: getComputedStyle(document.querySelector('.app-bottom-nav')).paddingBottom,
      top: getComputedStyle(document.querySelector('.layout')).paddingTop,
    }));
    assert.equal(safe.padding, '34px');
    assert.equal(safe.top, '47px');
    assert(safe.last.bottom <= safe.nav.top, 'Last favorite obscured by bottom navigation');
    await page.screenshot({ path: path.join(qa, 'home-safe-area.png') });
    await page.goto(base + '/operations/new');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator('select[name="clientId"]').selectOption('test-client');
    await page.locator('input[name="amount"]').fill('123');
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
    await page.locator('.confirmation-modal').waitFor();
    await page.getByRole('button', { name: 'Confirmer le virement' }).scrollIntoViewIfNeeded();
    const confirmationVisible = await page.getByRole('button', { name: 'Confirmer le virement' }).evaluate(button => {
      const r = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });
    assert(confirmationVisible, 'Confirmation action hidden behind bottom navigation');
    await page.locator('.confirmation-modal').getByRole('button', { name: 'Annuler', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    await page.locator('.favorites-section').waitFor();
    await page.getByRole('button', { name: 'Ouvrir le menu' }).first().click();
    await page.locator('.sidebar-menu.open').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.sidebar-menu.open').count(), 0);
    await page.getByRole('button', { name: 'Ouvrir le menu' }).first().click();
    await page.getByRole('button', { name: 'Déconnexion' }).click();
    await page.getByRole('button', { name: 'Se connecter' }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('token')), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('selectedOperation')), null);
    await page.getByLabel('Email', { exact: true }).fill('wrong@example.test');
    await page.getByLabel('Mot de passe', { exact: true }).fill('incorrect');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.getByText('Identifiants incorrects').waitFor();
    assert.equal(await page.getByLabel('Email', { exact: true }).inputValue(), 'wrong@example.test');
    await page.screenshot({ path: path.join(qa, 'login-mobile.png'), fullPage: true });
    await context.close();

    // API failures have a visible retry state instead of false zero balances.
    const failureState = { failData: true, delayAuth: true };
    const failureContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await mockApi(failureContext, failureState);
    await failureContext.addInitScript(() => localStorage.setItem('token', 'test-token'));
    const failurePage = await failureContext.newPage();
    await failurePage.goto(base);
    await failurePage.locator('.startup-screen').waitFor();
    await failurePage.screenshot({ path: path.join(qa, 'startup-mobile.png') });
    assert.equal(await failurePage.locator('.auth-form').count(), 0);
    await failurePage.getByRole('button', { name: 'Réessayer' }).waitFor();
    assert.equal(await failurePage.locator('.favorite-amount').count(), 0);
    failureState.failData = false;
    await failurePage.getByRole('button', { name: 'Réessayer' }).click();
    await failurePage.locator('.favorites-section').waitFor();
    await failureContext.close();

    // Real service worker: precache, offline deep link, session retention.
    const offlineState = {};
    const pwaContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await mockApi(pwaContext, offlineState);
    await pwaContext.addInitScript(() => localStorage.setItem('token', 'test-token'));
    const pwaPage = await pwaContext.newPage();
    await pwaPage.goto(base);
    await pwaPage.evaluate(() => navigator.serviceWorker.ready);
    await pwaPage.waitForFunction(() => !!navigator.serviceWorker.controller);
    const cached = await pwaPage.evaluate(async () => {
      const keys = await caches.keys();
      const entries = await (await caches.open(keys[0])).keys();
      return entries.map(entry => new URL(entry.url).pathname);
    });
    assert(cached.some(url => url.endsWith('.js')) && cached.some(url => url.endsWith('.css')));
    assert(!cached.some(url => url.startsWith('/api')));
    await pwaPage.goto(base + '/operations/new');
    await pwaPage.locator('input[name="amount"]').fill('123');
    await pwaPage.evaluate(async () => {
      await caches.open('ubs-bank-v2');
      await caches.open('another-app');
    });
    updateVersion = true;
    await pwaPage.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await pwaPage.getByText('Une mise à jour est disponible.').waitFor();
    assert.equal(await pwaPage.locator('input[name="amount"]').inputValue(), '123');
    await pwaPage.getByRole('button', { name: 'Actualiser', exact: true }).click();
    await pwaPage.waitForFunction(async () => !(await caches.keys()).includes('ubs-bank-v2'));
    assert(await pwaPage.evaluate(async () => (await caches.keys()).includes('another-app')));
    await pwaPage.locator('.app-bottom-nav').waitFor();
    offlineState.offline = true;
    await pwaContext.setOffline(true);
    await pwaPage.goto(base + '/accounts');
    await pwaPage.getByRole('button', { name: 'Réessayer' }).waitFor();
    assert.equal(await pwaPage.evaluate(() => localStorage.getItem('token')), 'test-token');
    await pwaPage.getByText('Hors connexion. Les opérations nécessitent Internet.').waitFor();
    await pwaContext.close();

    assert.deepEqual(errors, [], 'Unexpected JavaScript errors');
    fs.writeFileSync(path.join(qa, 'verification.json'), JSON.stringify({ count, failures, errors, safe, cached }, null, 2));
    assert.deepEqual(failures, [], 'Horizontal overflow detected; see qa/verification.json');
    console.log('PASS: ' + count + ' responsive pages; icons, splash assets, safe areas, authentication, retry and offline PWA.');
  } finally { await browser.close(); server.close(); }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
