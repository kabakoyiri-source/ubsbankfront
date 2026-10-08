const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, 'qa', 'browsers');
const { webkit, devices } = require('playwright');
const dist = path.join(root, 'dist');
const qa = path.join(root, 'qa');
const user = { id: 'test-user', firstName: 'Jean', lastName: 'Dupont', email: 'iphone@example.test' };
const client = { _id: 'test-client', firstName: 'Marie', lastName: 'Martin', bankName: 'Test bank', accountNumber: 'CH9300762011623852957', swiftCode: 'TESTBANK', bankAddress: 'Test address', status: 'active', balance: 1234 };
const operations = [{ _id: 'test-operation', type: 'deposit', currency: 'CHF', amount: 1234567.89, status: 'completed', createdAt: new Date().toISOString(), clientId: client }];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname);
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(dist, 'index.html');
  res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' }[path.extname(target)] || 'application/octet-stream');
  res.end(fs.readFileSync(target));
});

async function main() {
  fs.mkdirSync(qa, { recursive: true });
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const iconUrl = html.match(/rel="apple-touch-icon" sizes="180x180" href="([^"]+)"/)[1];
  assert.equal(iconUrl, '/images/apple-touch-icon-v5.png');
  assert.equal(Buffer.compare(fs.readFileSync(path.join(dist, iconUrl)), fs.readFileSync(path.join(dist, 'apple-touch-icon.png'))), 0);
  const icon = sharp(path.join(dist, iconUrl));
  const metadata = await icon.metadata();
  assert.equal(metadata.width, 180); assert.equal(metadata.height, 180); assert.equal(metadata.hasAlpha, false);
  const { data, info } = await icon.raw().toBuffer({ resolveWithObject: true });
  let minX = 180, maxX = 0;
  for (let y = 0; y < 180; y++) for (let x = 0; x < 180; x++) {
    const i = (y * 180 + x) * info.channels;
    if (data[i] < 230 || data[i + 1] < 230 || data[i + 2] < 230) { minX = Math.min(x, minX); maxX = Math.max(x, maxX); }
  }
  assert(maxX - minX + 1 >= 165 && minX >= 3 && maxX <= 176, 'iPhone logo must fill the square without cropping');
  assert(fs.readFileSync(path.join(dist, 'service-worker.js'), 'utf8').includes(iconUrl), 'Updated iOS icon must be precached');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await webkit.launch({ headless: true });
  const errors = [];
  let count = 0;
  const mock = async context => context.route('**/api/**', route => {
    const url = new URL(route.request().url());
    return route.fulfill({ json: url.pathname === '/api/auth/me' ? { success: true, user } : url.pathname === '/api/auth/login' ? { success: true, user, token: 'test-token' } : { success: true, data: url.pathname.startsWith('/api/clients') ? [client] : operations } });
  });
  try {
    const sizes = [
      { width: 320, height: 568, top: 20, bottom: 0 },
      { width: 375, height: 812, top: 44, bottom: 34 },
      { width: 390, height: 844, top: 47, bottom: 34 },
      { width: 393, height: 852, top: 59, bottom: 34 },
      { width: 430, height: 932, top: 59, bottom: 34 },
      { width: 440, height: 956, top: 62, bottom: 34 },
      { width: 844, height: 390, top: 0, bottom: 21, side: 47 },
    ];
    const routes = ['/', '/accounts', '/cards', '/more', '/settings', '/clients', '/clients/new', '/operations/new', '/operations/transfer', '/balance/load', '/history'];
    for (const standalone of process.argv.includes('--behavior-only') ? [] : [false, true]) {
      const context = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
      await mock(context);
      await context.addInitScript(({ standalone, operations }) => {
        localStorage.setItem('token', 'test-token');
        localStorage.setItem('selectedOperation', JSON.stringify(operations[0]));
        Object.defineProperty(navigator, 'standalone', { value: standalone });
      }, { standalone, operations });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      for (const size of sizes) {
        await page.setViewportSize({ width: size.width, height: size.height });
        for (const route of routes) {
          await page.goto(base + route);
          await page.waitForLoadState('networkidle');
          await page.locator('.app-bottom-nav').waitFor();
          await page.waitForFunction(() => !document.querySelector('.loading-container, .loading'));
          await page.evaluate(size => {
            const style = document.documentElement.style;
            style.setProperty('--app-safe-top', size.top + 'px');
            style.setProperty('--app-safe-bottom', size.bottom + 'px');
            style.setProperty('--app-safe-left', (size.side || 0) + 'px');
            style.setProperty('--app-safe-right', (size.side || 0) + 'px');
            window.scrollTo(0, document.documentElement.scrollHeight);
          }, size);
          await page.waitForFunction(() => !window.visualViewport || Math.abs(window.visualViewport.scale - 1) < .01);
          await page.waitForFunction(() => {
            window.scrollTo(0, document.documentElement.scrollHeight);
            const nav = document.querySelector('.app-bottom-nav').getBoundingClientRect();
            return Math.abs(nav.bottom - (visualViewport.height + visualViewport.offsetTop)) <= 1 && document.querySelector('.content-wrapper').getBoundingClientRect().bottom <= nav.top + 1;
          }, null, { timeout: 10000 });
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const metrics = await page.evaluate(() => {
            const nav = document.querySelector('.app-bottom-nav');
            const rect = nav.getBoundingClientRect();
            return { platform: document.documentElement.dataset.platform, mode: document.documentElement.dataset.displayMode,
              width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
              height: rect.height, bottom: rect.bottom, viewportBottom: visualViewport.height + visualViewport.offsetTop,
              offset: getComputedStyle(nav).bottom, anchor: document.querySelector('[data-viewport-anchor]').getBoundingClientRect().bottom, scroll: scrollY, innerHeight, clientHeight: document.documentElement.clientHeight,
              padding: parseFloat(getComputedStyle(nav).paddingBottom), mainBottom: document.querySelector('.content-wrapper').getBoundingClientRect().bottom, top: rect.top,
              links: [...nav.querySelectorAll('a')].map(link => link.getBoundingClientRect().toJSON()),
            };
          });
          count++;
          assert.equal(metrics.platform, 'ios'); assert.equal(metrics.mode, standalone ? 'standalone' : 'browser');
          assert(metrics.scrollWidth <= metrics.width + 1, `Horizontal overflow: ${route} ${size.width}`);
          assert(metrics.height <= 71, `iPhone navigation too tall: ${JSON.stringify(metrics)}`);
          assert(metrics.padding <= 24);
          assert(Math.abs(metrics.bottom - metrics.viewportBottom) <= 1, `Navigation must hug the visible viewport: ${route} ${JSON.stringify(size)} ${JSON.stringify(metrics)}`);
          assert(metrics.links.every(rect => rect.height >= 44 && rect.x >= (size.side || 0) && rect.right <= size.width - (size.side || 0)));
          assert(metrics.mainBottom <= metrics.top + 1, `End of content hidden by navigation: ${route} ${JSON.stringify(size)} ${JSON.stringify(metrics)}`);
          if (standalone && size.width === 393 && route === '/') await page.screenshot({ path: path.join(qa, 'iphone-webkit-navigation.png') });
        }
      }
      await context.close();
    }

    // Simulate OS chrome and keyboard viewport events, which headless WebKit
    // cannot open. Geometry still runs in WebKit, including focus and rotation.
    const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await mock(context);
    await context.addInitScript(() => {
      localStorage.setItem('token', 'test-token');
      const viewport = new EventTarget();
      Object.assign(viewport, { height: 844, offsetTop: 0, scale: 1 });
      Object.defineProperty(window, 'visualViewport', { value: viewport });
      window.testViewport = values => { Object.assign(viewport, values); viewport.dispatchEvent(new Event('resize')); };
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/operations/new');
    await page.locator('#amount').waitFor();
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--app-safe-bottom', '58px');
      testViewport({ height: 786 });
    });
    await page.waitForFunction(() => Math.abs(document.querySelector('.app-bottom-nav').getBoundingClientRect().bottom - 786) <= 1);
    assert(await page.locator('.app-bottom-nav').evaluate(nav => parseFloat(getComputedStyle(nav).paddingBottom) <= 12), 'Safari toolbar must not add a second blank strip');
    await page.locator('#amount').focus();
    await page.evaluate(() => testViewport({ height: 500, offsetTop: 40 }));
    await page.waitForFunction(() => document.documentElement.dataset.keyboard === 'open');
    assert(await page.locator('.app-bottom-nav').isHidden());
    await page.evaluate(() => {
      document.activeElement.blur();
      testViewport({ height: 844, offsetTop: 0 });
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    await page.waitForFunction(() => document.documentElement.dataset.keyboard === 'closed' && getComputedStyle(document.querySelector('.app-bottom-nav')).display !== 'none');
    assert.equal(await page.locator('.app-bottom-nav').evaluate(nav => nav.getBoundingClientRect().bottom), 844);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => testViewport({ height: 390 }));
    await page.waitForFunction(() => Math.abs(document.querySelector('.app-bottom-nav').getBoundingClientRect().bottom - 390) <= 1);
    await page.evaluate(() => testViewport({ height: 195, scale: 2 }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('.app-bottom-nav').evaluate(nav => nav.getBoundingClientRect().bottom), 390, 'Pinch zoom must not reposition the navigation');
    await context.close();
    const loginContext = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
    await mock(loginContext);
    let loginPage = await loginContext.newPage();
    loginPage.on('pageerror', error => errors.push(error.message));
    await loginPage.goto(base + '/login');
    await loginPage.getByLabel('Email', { exact: true }).fill('iphone@example.test');
    await loginPage.getByLabel('Mot de passe', { exact: true }).fill('test-password-ios');
    await loginPage.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await loginPage.locator('.favorites-section').waitFor();
    await loginPage.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    await loginPage.waitForFunction(() => document.querySelector('#login-email') && !document.querySelector('#login-email').disabled);
    assert.equal(await loginPage.evaluate(() => localStorage.getItem('token')), null);
    assert.equal(await loginPage.getByLabel('Email', { exact: true }).inputValue(), 'iphone@example.test');
    assert.equal(await loginPage.getByLabel('Mot de passe', { exact: true }).inputValue(), 'test-password-ios');
    await loginPage.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await loginPage.locator('.favorites-section').waitFor();
    await loginPage.close();
    loginPage = await loginContext.newPage();
    await loginPage.goto(base + '/accounts');
    await loginPage.waitForFunction(() => document.querySelector('#login-email') && !document.querySelector('#login-email').disabled);
    assert.equal(await loginPage.evaluate(() => localStorage.getItem('token')), null);
    assert.equal(await loginPage.getByLabel('Mot de passe', { exact: true }).inputValue(), 'test-password-ios');
    await loginContext.close();
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(qa, 'ios-verification.json'), JSON.stringify({ engine: 'WebKit', simulatedSystemInsets: true, count, errors, iconInkWidth: maxX - minX + 1 }, null, 2));
    console.log(`PASS: ${count} iPhone layouts in WebKit; Safari/standalone profiles, compact navigation, safe sides, reachable page ends, viewport/keyboard/rotation recovery, pinch zoom, enlarged opaque iOS icon, exit logout and remembered login.`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
