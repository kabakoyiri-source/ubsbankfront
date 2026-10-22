const assert = require('node:assert/strict');
const path = require('node:path');
const { routeSupabase } = require('./supabase-route-fixture.cjs');

exports.verifyBeneficiaryWebkit = async ({ browser, base, device, client, user, operations, sizes, qa }) => {
  for (const standalone of [false, true]) {
    const context = await browser.newContext({ ...device, serviceWorkers: 'block' });
    let removed = false;
    let requests = 0;
    await context.addInitScript(standalone => {
      localStorage.setItem('token', 'test-token');
      Object.defineProperty(navigator, 'standalone', { value: standalone });
    }, standalone);
    await routeSupabase(context, route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/auth/me') return route.fulfill({ json: { success: true, user } });
      if (route.request().method() === 'DELETE' && url.pathname === '/api/clients/' + client._id) {
        requests++;
        if (requests === 1) return route.fulfill({ status: 503, json: { success: false, message: "Try deleting again." } });
        removed = true;
        return route.fulfill({ json: { success: true } });
      }
      return route.fulfill({ json: { success: true, data: url.pathname === '/api/clients/' + client._id ? client : url.pathname === '/api/clients' ? (removed ? [] : [client]) : operations } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      for (const size of sizes) {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.goto(base + '/clients');
        const remove = page.getByRole('button', { name: "Delete Marie Martin", exact: true });
        await remove.waitFor();
        await page.evaluate(size => {
          const root = document.documentElement.style;
          root.setProperty('--app-safe-top', size.top + 'px');
          root.setProperty('--app-safe-bottom', size.bottom + 'px');
          root.setProperty('--app-safe-left', (size.side || 0) + 'px');
          root.setProperty('--app-safe-right', (size.side || 0) + 'px');
          window.dispatchEvent(new Event('resize'));
        }, size);
        await remove.click();
        const dialog = page.getByRole('alertdialog');
        await dialog.waitFor();
        assert(await dialog.getByRole('button', { name: "Cancel", exact: true }).evaluate(button => button === document.activeElement));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        const confirm = dialog.getByRole('button', { name: "Delete beneficiary", exact: true });
        await confirm.scrollIntoViewIfNeeded();
        const bounds = await confirm.boundingBox();
        assert(bounds.x >= (size.side || 0) && bounds.x + bounds.width <= size.width - (size.side || 0) + 1, 'iPhone confirmation must respect side insets');
        assert(bounds.y >= 0 && bounds.y + bounds.height <= size.height + 1, 'iPhone confirmation must stay reachable');
        if (size.width === 390) await page.screenshot({ path: path.join(qa, `ios-beneficiary-dialog-${standalone ? 'standalone' : 'safari'}.png`), animations: 'disabled' });
        await dialog.getByRole('button', { name: "Cancel", exact: true }).click();
        assert.equal(await dialog.count(), 0);
        assert.equal(requests, 0);
      }
      await page.getByRole('link', { name: /Marie Martin/ }).click();
      await page.getByRole('heading', { name: 'Marie Martin', exact: true }).waitFor();
      await page.getByRole('button', { name: "Delete beneficiary", exact: true }).click();
      const dialog = page.getByRole('alertdialog');
      await dialog.getByRole('button', { name: "Delete beneficiary", exact: true }).click();
      await dialog.getByRole('alert').filter({ hasText: 'Try deleting again.' }).waitFor();
      await dialog.getByRole('button', { name: "Delete beneficiary", exact: true }).click();
      await page.waitForURL('**/clients');
      await page.getByText("No beneficiaries found", { exact: true }).waitFor();
      assert.equal(requests, 2);
      await page.reload();
      await page.getByText("No beneficiaries found", { exact: true }).waitFor();
      await page.goto(base + '/operations/new');
      await page.getByText("Add your first beneficiary to make a transfer.", { exact: true }).waitFor();
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  console.log('PASS: beneficiary confirmation, cancellation, retry and removal in WebKit across iPhone sizes and both Safari/standalone profiles.');
};
