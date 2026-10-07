const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

// Called by the backend verification, against its temporary MongoDB database.
exports.verifyFundsUi = async function verifyFundsUi(base, token, clientId) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
    await context.addInitScript(token => localStorage.setItem('token', token), token);
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: base + url.pathname + url.search });
      await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/more');
    await page.getByRole('button', { name: /Paramètres/ }).click();
    await page.getByLabel('Montant (CHF)', { exact: true }).waitFor();
    await page.getByLabel('Montant (CHF)', { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Ajouter les fonds', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'montant positif' }).waitFor();
    await page.getByLabel('Montant (CHF)', { exact: true }).fill('100,50');
    await page.getByRole('button', { name: 'Ajouter les fonds', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'ajoutés à votre compte' }).waitFor();
    assert.match(await page.locator('.settings-balances dd').first().innerText(), /100[.,]50 CHF/);
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const qa = path.resolve(__dirname, '../qa');
    fs.mkdirSync(qa, { recursive: true });
    await page.screenshot({ path: path.join(qa, 'settings-funds-mobile.png'), fullPage: true, animations: 'disabled' });
    await page.getByRole('link', { name: 'Effectuer un virement', exact: true }).click();
    await page.getByLabel('Bénéficiaire', { exact: false }).selectOption(clientId);
    await page.locator('input[name="amount"]').fill('200');
    await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
    await page.getByText(/Solde insuffisant sur le compte CHF/).waitFor();
    assert.equal(await page.locator('.confirmation-modal').count(), 0);
    await page.locator('input[name="amount"]').fill('25,25'.replace(',', '.'));
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmer le virement', exact: true }).click();
    await page.waitForURL('**/operations');
    await page.goto(base + '/settings');
    await page.getByLabel('Montant (CHF)', { exact: true }).waitFor();
    assert.match(await page.locator('.settings-balances dd').first().innerText(), /75[.,]25 CHF/);
    await page.getByLabel('Compte à alimenter').selectOption('EUR');
    await page.getByLabel('Montant (EUR)', { exact: true }).fill('20');
    await page.getByRole('button', { name: 'Ajouter les fonds', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '20,00 EUR ajoutés' }).waitFor();
    await page.reload();
    await page.getByLabel('Montant (CHF)', { exact: true }).waitFor();
    assert.match(await page.locator('.settings-balances dd').nth(1).innerText(), /20[.,]00 EUR/);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS: mobile Plus → Paramètres → add funds → transfer; balances persisted after reload; validation and small-screen layout.');
  } finally { await browser.close(); }
};
