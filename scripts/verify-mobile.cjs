const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const sharp = require('sharp');
const { checkSpacing } = require('./check-spacing.cjs');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const qa = path.join(root, 'qa');
fs.mkdirSync(qa, { recursive: true });
const user = { id: 'test-admin', firstName: 'Jean', lastName: 'Dupont', email: 'test@example.test', role: 'admin', balance: 5000 };
const client = { _id: 'test-client', firstName: 'Marie', lastName: 'Martin', email: 'marie@example.test', phone: '+41 00 000 00 00', accountNumber: 'CH93 0076 2011 6238 5295 7', bankName: 'Banque de démonstration', bankAddress: 'Rue de la Paix', status: 'active', balance: 1234, currency: 'CHF', createdAt: new Date().toISOString() };
const operations = [{ _id: 'test-operation', type: 'deposit', amount: 1234567.89, currency: 'CHF', status: 'completed', clientId: client, description: 'Opération de démonstration', createdAt: new Date().toISOString(), sourceAccount: 'chf' }];
let updateVersion = false;
const assetFiles = fs.readdirSync(path.join(dist, 'assets')).filter(file => /\.(js|css)$/.test(file));
const renameAssets = html => assetFiles.reduce((content, file) => content.replaceAll('/assets/' + file, '/assets/updated-' + file), html);
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const staticPath = updateVersion && pathname.startsWith('/assets/updated-') ? pathname.replace('/assets/updated-', '/assets/') : pathname;
  const file = path.resolve(dist, '.' + (staticPath === '/' ? '/index.html' : staticPath));
  if (!file.startsWith(dist + path.sep)) { res.writeHead(403); return res.end(); }
  const missing = !fs.existsSync(file) || !fs.statSync(file).isFile() || updateVersion && pathname.startsWith('/assets/') && !pathname.startsWith('/assets/updated-');
  if (missing && /^\/(assets|images|api)(\/|$)/.test(pathname)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  const target = missing ? path.join(dist, 'index.html') : file;
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
  res.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  let content = fs.readFileSync(target);
  if (updateVersion && pathname === '/service-worker.js') content = renameAssets(content.toString().replace(/const CACHE_NAME = .+;/, "const CACHE_NAME = 'ubs-bank-qa-update';"));
  if (updateVersion && target.endsWith('index.html')) content = renameAssets(content.toString());
  res.end(content);
});

async function mockApi(context, state = {}) {
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (state.offline) return route.abort('internetdisconnected');
    if (state.expired && !['/api/auth/login', '/api/auth/register'].includes(url.pathname)) return route.fulfill({ status: 401, json: { success: false } });
    if (state.failData && !url.pathname.startsWith('/api/auth')) return route.fulfill({ status: 503, json: { message: 'Indisponible' } });
    if (url.pathname === '/api/auth/me') {
      if (state.expired) return route.fulfill({ status: 401, json: { success: false } });
      if (state.delayAuth) await new Promise(resolve => setTimeout(resolve, 500));
      return route.fulfill({ json: { success: true, user } });
    }
    if (url.pathname === '/api/auth/login') {
      if (state.waitLogin) await state.waitLogin;
      if (state.acceptLogin) return route.fulfill({ json: { success: true, token: 'test-token', user } });
      return route.fulfill({ status: 401, json: { success: false, message: 'Identifiants incorrects' } });
    }
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
    const routes = ['/', '/accounts', '/cards', '/more', '/settings', '/profile', '/about', '/clients', '/clients/new', '/clients/test-client', '/operations', '/operations/new', '/operations/transfer', '/balance/load', '/history', '/operation-details'];
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
        await checkSpacing(page);
        if (viewport.width === 390 && ['/', '/cards', '/operations/new'].includes(route)) {
          await page.screenshot({ path: path.join(qa, route === '/' ? 'home-mobile.png' : route === '/cards' ? 'cards-mobile.png' : 'payments-mobile.png'), fullPage: true });
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    await page.locator('.favorites-section').waitFor();
    const alignment = await page.evaluate(() => {
      const rectangles = selector => [...document.querySelectorAll(selector)].map(element => element.getBoundingClientRect().toJSON());
      return {
        quick: rectangles('.quick-action-icon'), labels: rectangles('.quick-action-label'),
        header: rectangles('.profile-avatar, .header-icon-btn'),
        favorites: rectangles('.favorite-icon svg'), nav: document.querySelector('.app-bottom-nav').getBoundingClientRect().height,
      };
    });
    assert(alignment.nav <= 52, 'Navigation is too tall without a system inset');
    const centers = alignment.quick.map(rect => rect.x + rect.width / 2);
    assert(Math.abs((centers[1] - centers[0]) - (centers[2] - centers[1])) <= 1, 'Quick actions must be evenly spaced');
    assert(alignment.quick.every(rect => rect.width === 48 && rect.height === 48 && Math.abs(rect.top - alignment.quick[0].top) <= 1));
    assert(alignment.labels.every(rect => Math.abs(rect.top - alignment.labels[0].top) <= 1));
    const headerCenters = alignment.header.map(rect => rect.top + rect.height / 2);
    assert(Math.max(...headerCenters) - Math.min(...headerCenters) <= 1, 'Header controls must share the same center line');
    assert(alignment.favorites.every(rect => rect.width === 24 && rect.height === 24));
    const curves = [];
    const gains = [];
    for (const currency of ['CHF', 'EUR', 'USD']) {
      await page.getByRole('button', { name: currency, exact: true }).click();
      assert((await page.locator('.gain-amount').innerText()).startsWith(currency + ' '));
      assert((await page.locator('.portfolio-amount').innerText()).startsWith(currency + ' '));
      assert.equal(await page.getByRole('button', { name: currency, exact: true }).getAttribute('aria-pressed'), 'true');
      curves.push(await page.locator('.portfolio-svg polyline').getAttribute('points'));
      gains.push(await page.locator('.gain-percent').innerText());
    }
    assert.equal(new Set(curves).size, 3, 'Each currency needs a distinct illustrative curve');
    assert.equal(new Set(gains).size, 3);
    await page.getByRole('button', { name: 'CHF', exact: true }).click();
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
    const labelIcons = await page.locator('.form-group > label > svg').evaluateAll(icons => icons.map(icon => icon.getBoundingClientRect().toJSON()));
    assert.equal(labelIcons.length, 5);
    assert(labelIcons.every(icon => icon.width === 20 && icon.height === 20 && Math.abs(icon.x - labelIcons[0].x) <= 1));
    const amountInput = page.locator('input[name="amount"]');
    await amountInput.fill('583936926972');
    assert.equal(await amountInput.inputValue(), "583'936'926'972");
    await amountInput.fill("1'234'567,89");
    assert.equal(await amountInput.inputValue(), "1'234'567,89");
    await amountInput.fill('1234.56');
    await amountInput.evaluate(input => input.setSelectionRange(3, 3));
    await amountInput.pressSequentially('9');
    assert.equal(await amountInput.inputValue(), "12'934,56");
    await amountInput.press('Backspace');
    assert.equal(await amountInput.inputValue(), "1'234,56");
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

    // Credentials are restored after logout, reopening and session expiration.
    const memoryState = {};
    const memoryContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await mockApi(memoryContext, memoryState);
    let memoryPage = await memoryContext.newPage();
    memoryPage.on('pageerror', error => errors.push(error.message));
    const submitLogin = async (email, password) => {
      await memoryPage.getByLabel('Email', { exact: true }).fill(email);
      await memoryPage.getByLabel('Mot de passe', { exact: true }).fill(password);
      await memoryPage.getByRole('button', { name: 'Se connecter', exact: true }).click();
    };
    const logout = async () => {
      await memoryPage.getByRole('button', { name: 'Ouvrir le menu' }).first().click();
      await memoryPage.getByRole('button', { name: 'Déconnexion', exact: true }).click();
      await memoryPage.getByRole('button', { name: 'Se connecter', exact: true }).waitFor();
      await memoryPage.waitForFunction(() => !document.querySelector('#login-email').disabled);
    };
    const inspectRemembered = () => memoryPage.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('ubs-device-login', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const read = db.transaction('preferences').objectStore('preferences').get('login');
        read.onsuccess = () => {
          const entry = read.result;
          db.close();
          resolve(entry ? { enabled: entry.enabled, email: entry.email, extractable: entry.key?.extractable, encrypted: entry.password instanceof ArrayBuffer, decodedBytes: entry.password ? new TextDecoder().decode(entry.password) : null, keys: Object.keys(entry) } : null);
        };
      };
    }));
    await memoryPage.goto(base + '/login');
    await submitLogin('wrong@example.test', 'wrong-test-password');
    await memoryPage.getByText('Identifiants incorrects').waitFor();
    assert.equal(await inspectRemembered(), null, 'Failed login must not save credentials');
    memoryState.acceptLogin = true;
    await submitLogin('remember@example.test', 'test-password-123');
    await memoryPage.locator('.favorites-section').waitFor();
    const stored = await inspectRemembered();
    assert.equal(stored.encrypted, true);
    assert.equal(stored.extractable, false);
    assert.notEqual(stored.decodedBytes, 'test-password-123');
    assert.equal(await memoryPage.evaluate(() => JSON.stringify({ ...localStorage }).includes('test-password-123')), false);
    // Leaving the foreground or document ends the session, while device
    // credentials remain available for the next explicit login.
    for (const event of ['visibilitychange', 'pagehide']) {
      await memoryPage.evaluate(event => {
        if (event === 'visibilitychange') {
          Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
          document.dispatchEvent(new Event(event));
          Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
        } else window.dispatchEvent(new PageTransitionEvent(event, { persisted: true }));
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      }, event);
      await memoryPage.waitForFunction(() => document.querySelector('#login-email') && !document.querySelector('#login-email').disabled);
      assert.equal(await memoryPage.evaluate(() => localStorage.getItem('token')), null);
      assert.equal(await memoryPage.getByLabel('Mot de passe', { exact: true }).inputValue(), 'test-password-123');
      await memoryPage.getByRole('button', { name: 'Se connecter', exact: true }).click();
      await memoryPage.locator('.favorites-section').waitFor();
    }
    await memoryPage.goto(base + '/accounts');
    await memoryPage.waitForFunction(() => document.querySelector('#login-email') && !document.querySelector('#login-email').disabled);
    assert.equal(await memoryPage.evaluate(() => localStorage.getItem('token')), null, 'Leaving a document must clear its session');
    await memoryPage.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await memoryPage.locator('.favorites-section').waitFor();
    await memoryPage.close();
    memoryPage = await memoryContext.newPage();
    await memoryPage.goto(base + '/accounts');
    await memoryPage.waitForFunction(() => document.querySelector('#login-email') && !document.querySelector('#login-email').disabled);
    assert.equal(await memoryPage.evaluate(() => localStorage.getItem('token')), null, 'Closing and reopening must require login');
    assert.equal(await memoryPage.getByLabel('Mot de passe', { exact: true }).inputValue(), 'test-password-123');
    await memoryPage.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await memoryPage.locator('.favorites-section').waitFor();
    await logout();
    assert.equal(await memoryPage.getByLabel('Email', { exact: true }).inputValue(), 'remember@example.test');
    assert.equal(await memoryPage.getByLabel('Mot de passe', { exact: true }).inputValue(), 'test-password-123');
    assert.equal(await memoryPage.getByLabel('Mot de passe', { exact: true }).getAttribute('type'), 'password');
    await memoryPage.close();
    memoryPage = await memoryContext.newPage();
    await memoryPage.goto(base + '/login');
    await memoryPage.waitForFunction(() => !document.querySelector('#login-email').disabled);
    assert.equal(await memoryPage.getByLabel('Mot de passe', { exact: true }).inputValue(), 'test-password-123');
    await memoryPage.screenshot({ path: path.join(qa, 'remembered-login-mobile.png'), fullPage: true, animations: 'disabled' });
    await memoryPage.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await memoryPage.locator('.favorites-section').waitFor();
    memoryState.expired = true;
    await memoryPage.getByRole('link', { name: 'Comptes', exact: true }).click();
    await memoryPage.waitForFunction(() => document.querySelector('#login-email') && !document.querySelector('#login-email').disabled);
    assert.equal(await memoryPage.getByLabel('Email', { exact: true }).inputValue(), 'remember@example.test');
    assert.equal(await memoryPage.getByLabel('Mot de passe', { exact: true }).inputValue(), 'test-password-123');
    memoryState.expired = false;
    memoryState.acceptLogin = false;
    await submitLogin('new@example.test', 'failed-replacement');
    await memoryPage.getByText('Identifiants incorrects').waitFor();
    await memoryPage.reload();
    await memoryPage.waitForFunction(() => !document.querySelector('#login-email').disabled);
    assert.equal(await memoryPage.getByLabel('Mot de passe', { exact: true }).inputValue(), 'test-password-123');
    memoryState.acceptLogin = true;
    await submitLogin('new@example.test', 'new-test-password');
    await memoryPage.locator('.favorites-section').waitFor();
    await logout();
    assert.equal(await memoryPage.getByLabel('Email', { exact: true }).inputValue(), 'new@example.test');
    assert.equal(await memoryPage.getByLabel('Mot de passe', { exact: true }).inputValue(), 'new-test-password');
    await memoryPage.getByRole('button', { name: 'Oublier mes identifiants', exact: true }).click();
    await memoryPage.waitForFunction(() => !document.querySelector('#login-email').disabled && document.querySelector('#login-email').value === '');
    assert.deepEqual((await inspectRemembered()).keys, ['enabled']);
    await memoryPage.reload();
    await memoryPage.waitForFunction(() => !document.querySelector('#login-email').disabled);
    assert.equal(await memoryPage.getByLabel('Mot de passe', { exact: true }).inputValue(), '');
    assert.equal(await memoryPage.getByLabel('Mémoriser mes identifiants sur cet appareil').isChecked(), false);
    await submitLogin('unsaved@example.test', 'unsaved-test-password');
    await memoryPage.locator('.favorites-section').waitFor();
    await logout();
    assert.equal(await memoryPage.getByLabel('Email', { exact: true }).inputValue(), '');
    await memoryContext.close();

    // A successful response received after backgrounding must not reopen
    // the session. Hold the response to reproduce the race deterministically.
    let releaseLogin;
    const pendingContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await mockApi(pendingContext, { acceptLogin: true, waitLogin: new Promise(resolve => { releaseLogin = resolve; }) });
    const pendingPage = await pendingContext.newPage();
    await pendingPage.goto(base + '/login');
    await pendingPage.getByLabel('Email', { exact: true }).fill('pending@example.test');
    await pendingPage.getByLabel('Mot de passe', { exact: true }).fill('pending-test-password');
    const submitted = pendingPage.waitForRequest(request => request.url().endsWith('/api/auth/login'));
    await pendingPage.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await submitted;
    await pendingPage.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    });
    releaseLogin();
    await pendingPage.getByText('La page a été quittée. Appuyez sur « Se connecter » pour reprendre.', { exact: true }).waitFor();
    assert.equal(await pendingPage.evaluate(() => localStorage.getItem('token')), null);
    assert.equal(await pendingPage.locator('.app-bottom-nav').count(), 0);
    await pendingContext.close();

    // Storage support is optional and must not prevent normal login.
    const unavailableContext = await browser.newContext({ viewport: { width: 320, height: 568 }, serviceWorkers: 'block' });
    await mockApi(unavailableContext, { acceptLogin: true });
    await unavailableContext.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: undefined }));
    const unavailablePage = await unavailableContext.newPage();
    await unavailablePage.goto(base + '/login');
    await unavailablePage.getByText('La mémorisation est indisponible dans ce navigateur. Vous pouvez vous connecter normalement.').waitFor();
    await unavailablePage.getByLabel('Email', { exact: true }).fill('test@example.test');
    await unavailablePage.getByLabel('Mot de passe', { exact: true }).fill('test-password');
    await unavailablePage.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await unavailablePage.locator('.favorites-section').waitFor();
    await unavailableContext.close();

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
    // The host now serves HTML with new hashes and has removed the old files.
    // A navigation still has to use the active worker's matching cached build.
    await pwaPage.goto(base + '/accounts');
    await pwaPage.locator('.accounts-container').waitFor();
    const activeScript = await pwaPage.locator('script[type="module"]').getAttribute('src');
    assert(!activeScript.includes('updated-'), 'Active worker mixed a new HTML document with old assets');
    const missingAsset = await pwaContext.request.get(base + '/assets/' + assetFiles[0]);
    assert.equal(missingAsset.status(), 404);
    await pwaPage.goto(base + '/operations/new');
    await pwaPage.locator('input[name="amount"]').fill('123');
    await pwaPage.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await pwaPage.getByText('Une mise à jour est disponible.').waitFor();
    assert.equal(await pwaPage.locator('input[name="amount"]').inputValue(), '123');
    await pwaPage.getByRole('button', { name: 'Actualiser', exact: true }).click();
    await pwaPage.waitForFunction(async () => !(await caches.keys()).includes('ubs-bank-v2'));
    assert(await pwaPage.evaluate(async () => (await caches.keys()).includes('another-app')));
    await pwaPage.locator('.app-bottom-nav').waitFor();
    assert((await pwaPage.locator('script[type="module"]').getAttribute('src')).includes('updated-'));
    offlineState.offline = true;
    await pwaContext.setOffline(true);
    await pwaPage.goto(base + '/accounts');
    await pwaPage.getByRole('button', { name: 'Réessayer' }).waitFor();
    assert.equal(await pwaPage.evaluate(() => localStorage.getItem('token')), 'test-token');
    await pwaPage.getByText('Hors connexion. Les opérations nécessitent Internet.').waitFor();
    await pwaContext.close();

    // Even when JS cannot load, HTML alone offers recovery and retains credentials.
    const repairContext = await browser.newContext({ serviceWorkers: 'block' });
    let failScript = true;
    await repairContext.route('**/assets/*.js', route => failScript ? route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html>wrong deployment' }) : route.continue());
    const repairPage = await repairContext.newPage();
    await repairPage.goto(base + '/login');
    await repairPage.getByRole('button', { name: 'Réparer et recharger' }).waitFor();
    await repairPage.evaluate(async () => {
      localStorage.setItem('remember-repair-test', 'preserved');
      await caches.open('ubs-bank-broken');
      await caches.open('another-app-repair');
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('repair-retention-test', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('data');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('data', 'readwrite');
          tx.objectStore('data').put('preserved', 'remembered');
          tx.oncomplete = () => { db.close(); resolve(); };
        };
      });
    });
    await repairContext.setOffline(true);
    await repairPage.getByRole('button', { name: 'Réparer et recharger' }).click();
    await repairPage.getByText('Impossible de joindre l’application. Vérifiez Internet puis réessayez.').waitFor();
    assert((await repairPage.evaluate(() => caches.keys())).includes('ubs-bank-broken'), 'Offline repair must preserve the existing cache');
    await repairContext.setOffline(false);
    failScript = false;
    await repairPage.getByRole('button', { name: 'Réparer et recharger' }).click();
    await repairPage.getByRole('button', { name: 'Se connecter', exact: true }).waitFor();
    assert.equal(await repairPage.evaluate(() => localStorage.getItem('remember-repair-test')), 'preserved');
    const repairCacheKeys = await repairPage.evaluate(() => caches.keys());
    assert(!repairCacheKeys.includes('ubs-bank-broken'));
    assert(repairCacheKeys.includes('another-app-repair'));
    assert.equal(await repairPage.evaluate(() => new Promise(resolve => {
      const request = indexedDB.open('repair-retention-test', 1);
      request.onsuccess = () => {
        const db = request.result;
        const read = db.transaction('data').objectStore('data').get('remembered');
        read.onsuccess = () => { db.close(); resolve(read.result); };
      };
    })), 'preserved');
    await repairContext.close();

    assert.deepEqual(errors, [], 'Unexpected JavaScript errors');
    fs.writeFileSync(path.join(qa, 'verification.json'), JSON.stringify({ count, failures, errors, safe, cached }, null, 2));
    assert.deepEqual(failures, [], 'Horizontal overflow detected; see qa/verification.json');
    console.log('PASS: ' + count + ' responsive pages; icons, splash assets, safe areas, authentication, remembered credentials, retry and offline PWA.');
  } finally { await browser.close(); server.close(); }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
