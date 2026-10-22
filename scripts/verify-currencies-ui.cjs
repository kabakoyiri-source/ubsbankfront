const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { checkEnglish } = require('./check-english.cjs');

exports.verifyCurrenciesUi = async ({ base, token, browserType, device, engine }) => {
  const browser = await browserType.launch(engine === 'Chrome' ? { channel: 'chrome', headless: true } : { headless: true });
  const balances = { CHF: 0, EUR: 0, USD: 0 };
  const fundingRequests = [];
  try {
    const context = await browser.newContext({ ...device, serviceWorkers: 'block' });
    await context.addInitScript(token => localStorage.setItem('token', token), token);
    let failLegacyUsd = true;
    await context.route('**/rest/v1/rpc/*', async route => {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': '*' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const url = new URL(route.request().url());
      const args = route.request().postDataJSON();
      // Each reload represents a fresh authenticated fixture document. Real
      // session revocation is tested by verify-supabase-ui separately.
      if (url.pathname.endsWith('/usb_logout')) return route.fulfill({ headers: cors, json: { success: true } });
      if (args.p_action === 'operations.create' && args.p_payload.currency === 'USD' && failLegacyUsd) {
        failLegacyUsd = false;
        return route.fulfill({ status: 400, headers: cors, json: { code: 'PT400', message: 'Impossible d’ajouter les fonds. Réessayez.' } });
      }
      const response = await route.fetch({ url: base + url.pathname });
      if (args.p_action === 'operations.create' && response.ok()) fundingRequests.push(args.p_payload);
      await route.fulfill({ response, headers: { ...response.headers(), ...cors } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const go = async route => { await page.waitForLoadState('networkidle'); await page.goto(base + route); };
    const money = value => value.toFixed(2);
    const home = async currency => {
      await page.locator('.portfolio-amount').waitFor();
      assert.equal(await page.getByRole('button', { name: currency, exact: true }).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.portfolio-amount').innerText(), `${currency} ${money(balances[currency])}`);
      await checkEnglish(page);
    };
    for (const [currency, amount] of [['CHF',100.50], ['EUR',200.75], ['USD',300.25]]) {
      await go('/settings');
      await page.locator('#funds-currency').selectOption(currency);
      await page.locator('#funds-amount').fill(currency === 'CHF' ? '100,50' : money(amount));
      assert.equal(await page.locator('#funds-amount').inputValue(), money(amount));
      await page.getByRole('button', { name: 'Add funds', exact: true }).click();
      if (currency === 'USD') {
        await page.getByRole('alert').filter({ hasText: 'Unable to add funds. Try again.' }).waitFor();
        await checkEnglish(page);
        assert.equal(await page.locator('#funds-amount').inputValue(), money(amount));
        await page.getByRole('button', { name: 'Add funds', exact: true }).click();
      }
      await page.getByRole('status').filter({ hasText: `${money(amount)} ${currency} added to your account.` }).waitFor();
      balances[currency] += amount;
      for (const [i, code] of ['CHF','EUR','USD'].entries()) assert.equal(await page.locator('.settings-balances dd').nth(i).innerText(), `${money(balances[code])} ${code}`);
      await page.getByRole('link', { name: 'Home', exact: true }).click();
      await home(currency);
      await page.waitForLoadState('networkidle');
      await page.reload();
      await home(currency);
      await go('/operations/new');
      await page.waitForLoadState('networkidle');
      await page.locator('#adminAccountType').waitFor();
      assert.equal(await page.locator('#adminAccountType').inputValue(), currency.toLowerCase(), 'Transfers must start with the funded currency');
    }
    for (const [currency, amount] of [['EUR',10.25], ['USD',20.50], ['CHF',5]]) {
      await go('/balance/load');
      await page.locator('#currency').selectOption(currency);
      await page.locator('#amount').fill(money(amount));
      await page.locator('input[name="cardHolder"]').fill('TEST USER');
      await page.locator('input[name="cardNumber"]').fill('4242424242424242');
      await page.locator('input[name="expiryDate"]').fill('1230');
      await page.locator('input[name="cvc"]').fill('123');
      await page.locator('.load-balance-form button[type="submit"]').click();
      await page.locator('.security-modal input').fill('0131');
      await page.getByRole('button', { name: 'Confirm payment', exact: true }).click();
      await page.waitForURL(base + '/');
      balances[currency] += amount;
      await home(currency);
    }
    const response = await fetch(base + '/rest/v1/rpc/usb_api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      p_action: 'clients.create', p_session_token: token,
      p_payload: { firstName: 'Currency', lastName: 'Beneficiary', bankName: 'Test bank', accountNumber: 'TEST-CURRENCY-ACCOUNT', swiftCode: 'TESTBANK', bankAddress: 'Test address' },
    }) });
    const clientId = (await response.json()).data._id;
    for (const currency of ['EUR','USD','CHF']) {
      await go('/balance/load');
      await page.getByRole('button', { name: 'Manual transfer', exact: true }).click();
      await page.locator('#currency').selectOption(currency);
      await page.locator('#clientId').selectOption(clientId);
      await page.locator('#amount').fill('1.25');
      await page.locator('#reason').fill('Currency regression check');
      await page.locator('.load-balance-form button[type="submit"]').click();
      await page.waitForURL(base + '/');
      balances[currency] -= 1.25;
      await home(currency);
      assert.equal(fundingRequests.at(-1).currency, currency, 'The manual transfer must send its selected currency');
    }
    for (const [currency, amount] of [['EUR',2.25], ['USD',3.75]]) {
      await go('/operations/new');
      await page.locator('#clientId').selectOption(clientId);
      await page.locator('#adminAccountType').selectOption(currency.toLowerCase());
      await page.locator('input[name="amount"]').fill(money(amount));
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm transfer', exact: true }).click();
      await page.waitForURL('**/operations');
      balances[currency] -= amount;
      await page.getByRole('link', { name: 'Home', exact: true }).click();
      await home(currency);
    }
    await go('/accounts');
    await page.locator('.account-card').first().waitFor();
    const showButtons = page.getByRole('button', { name: 'Show balance', exact: true });
    while (await showButtons.count()) await showButtons.first().click();
    for (const [i, currency] of ['CHF','EUR','USD'].entries()) assert.equal(await page.locator('.account-balance').nth(i).innerText(), `${currency} ${money(balances[currency])}`);
    await checkEnglish(page);
    const qa = path.resolve(__dirname, '../qa');
    fs.mkdirSync(qa, { recursive: true });
    await page.screenshot({ path: path.join(qa, `accounts-currencies-${engine.toLowerCase()}.png`), fullPage: true });
    assert.equal(fundingRequests.length, 9);
    assert(fundingRequests.every(request => ['CHF','EUR','USD'].includes(request.currency)));
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS: ${engine} CHF/EUR/USD funding in Settings and Top up; currency retention, manual and instant transfers, reloads and displayed balances.`);
    return balances;
  } finally { await browser.close(); }
};
