const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

// Called by the backend verification, against its temporary MongoDB database.
exports.verifyFundsUi = async function verifyFundsUi(base, token) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
    await context.addInitScript(token => localStorage.setItem('token', token), token);
    let failList = true;
    let failCreation = true;
    let failRemoval = true;
    let removalRequests = 0;
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/clients/') && route.request().method() === 'DELETE') {
        removalRequests++;
        if (failRemoval) {
          failRemoval = false;
          return route.fulfill({ status: 503, json: { success: false, message: 'Suppression temporairement indisponible. Réessayez.' } });
        }
      }
      if (url.pathname === '/api/clients' && ((route.request().method() === 'GET' && failList) || (route.request().method() === 'POST' && failCreation))) {
        if (route.request().method() === 'GET') failList = false;
        else failCreation = false;
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Service temporairement indisponible. Réessayez.' }) });
      }
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
    await page.getByRole('alert').filter({ hasText: 'Impossible de charger les bénéficiaires' }).waitFor();
    assert(await page.locator('#clientId').isDisabled());
    await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
    await page.getByText('Ajoutez votre premier bénéficiaire pour effectuer un virement.', { exact: true }).waitFor();
    assert(await page.getByRole('button', { name: 'Continuer', exact: true }).isDisabled());
    await page.locator('input[name="amount"]').fill('25,25');
    await page.locator('#adminAccountType').selectOption('eur');
    await page.getByText('Virement en 2 jours ouvrables', { exact: true }).click();
    await page.locator('#description').fill('Test du bénéficiaire mobile');
    await page.getByRole('button', { name: 'Ajouter un bénéficiaire', exact: true }).click();
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await page.getByText('Ajoutez votre premier bénéficiaire pour effectuer un virement.', { exact: true }).waitFor();
    assert.equal(await page.locator('input[name="amount"]').inputValue(), '25,25');
    assert.equal(await page.locator('#adminAccountType').inputValue(), 'eur');
    assert(await page.locator('input[value="delayed"]').isChecked());
    await page.getByRole('button', { name: 'Ajouter un bénéficiaire', exact: true }).click();
    const fillBeneficiary = async () => {
      await page.locator('#firstName').fill('Mobile');
      await page.locator('#lastName').fill('Beneficiary');
      await page.locator('#bankName').fill('Test bank');
      await page.locator('#accountNumber').fill('ch93 0076 2011 6238 5295 7');
      await page.locator('#swiftCode').fill('ubs wchzh80a');
      await page.locator('#bankAddress').fill('Test address');
    };
    await fillBeneficiary();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(qa, 'add-beneficiary-mobile.png'), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Créer le bénéficiaire', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Service temporairement indisponible' }).waitFor();
    assert.equal(await page.locator('#accountNumber').inputValue(), 'ch93 0076 2011 6238 5295 7');
    await page.getByRole('button', { name: 'Créer le bénéficiaire', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/operations/new' && url.searchParams.has('clientId'));
    const clientId = new URL(page.url()).searchParams.get('clientId');
    await page.waitForFunction(id => document.querySelector('#clientId')?.value === id && !document.querySelector('#clientId').disabled, clientId);
    assert.equal(await page.locator('#clientId option:checked').innerText(), 'Mobile Beneficiary');
    assert.equal(await page.locator('input[name="amount"]').inputValue(), '25,25');
    assert.equal(await page.locator('#adminAccountType').inputValue(), 'eur');
    assert(await page.locator('input[value="delayed"]').isChecked());
    assert.equal(await page.locator('#description').inputValue(), 'Test du bénéficiaire mobile');
    await page.getByRole('status').filter({ hasText: 'Bénéficiaire ajouté et sélectionné' }).waitFor();
    await page.screenshot({ path: path.join(qa, 'beneficiary-selected-mobile.png'), fullPage: true, animations: 'disabled' });
    await page.locator('#adminAccountType').selectOption('chf');
    await page.getByText('Virement instantané', { exact: true }).click();
    await page.locator('input[name="amount"]').fill('200');
    await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
    await page.getByText(/Solde insuffisant sur le compte CHF/).waitFor();
    assert.equal(await page.locator('.confirmation-modal').count(), 0);
    await page.locator('input[name="amount"]').fill('25,25'.replace(',', '.'));
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmer le virement', exact: true }).click();
    await page.waitForURL('**/operations');
    await page.goto(base + '/clients');
    await page.getByText('Mobile Beneficiary', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('Mobile Beneficiary', { exact: true }).waitFor();
    assert.equal(await page.locator('.client-card').count(), 1);
    await page.goto(base + '/clients/new');
    await fillBeneficiary();
    await page.getByRole('button', { name: 'Créer le bénéficiaire', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Ce numéro de compte est déjà enregistré' }).waitFor();
    assert.equal(await page.locator('#accountNumber').inputValue(), 'ch93 0076 2011 6238 5295 7');
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await page.getByText('Mobile Beneficiary', { exact: true }).waitFor();
    assert.equal(await page.locator('.client-card').count(), 1);
    await page.goto(base + '/operations/transfer');
    await page.getByLabel('Bénéficiaire', { exact: false }).selectOption(clientId);
    assert.equal(await page.locator('#clientId').inputValue(), clientId);
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

    await page.goto(base + '/clients');
    await page.getByRole('button', { name: 'Ajouter aux favoris', exact: true }).click();
    await page.getByRole('button', { name: 'Supprimer Mobile Beneficiary', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor();
    assert(await dialog.getByRole('button', { name: 'Annuler', exact: true }).evaluate(button => button === document.activeElement));
    await page.keyboard.press('Shift+Tab');
    assert(await dialog.getByRole('button', { name: 'Supprimer le bénéficiaire', exact: true }).evaluate(button => button === document.activeElement));
    await page.keyboard.press('Tab');
    assert(await dialog.getByRole('button', { name: 'Annuler', exact: true }).evaluate(button => button === document.activeElement));
    await page.keyboard.press('Escape');
    assert.equal(await dialog.count(), 0);
    assert.equal(removalRequests, 0, 'Cancelling must never remove a beneficiary');
    assert(await page.getByRole('button', { name: 'Supprimer Mobile Beneficiary', exact: true }).evaluate(button => button === document.activeElement));
    await page.getByRole('button', { name: 'Supprimer Mobile Beneficiary', exact: true }).click();
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await dialog.getByRole('button', { name: 'Supprimer le bénéficiaire', exact: true }).scrollIntoViewIfNeeded();
      const bounds = await dialog.getByRole('button', { name: 'Supprimer le bénéficiaire', exact: true }).boundingBox();
      assert(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height + 1, 'Confirmation must stay reachable in landscape');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(qa, 'delete-beneficiary-mobile.png'), animations: 'disabled' });
    await dialog.getByRole('button', { name: 'Supprimer le bénéficiaire', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: 'Suppression temporairement indisponible' }).waitFor();
    assert.equal(await page.locator('.client-card').count(), 1, 'A failed removal must preserve the beneficiary');
    await dialog.getByRole('button', { name: 'Supprimer le bénéficiaire', exact: true }).evaluate(button => { button.click(); button.click(); });
    await page.getByRole('status').filter({ hasText: 'Bénéficiaire supprimé.' }).waitFor();
    assert.equal(removalRequests, 2, 'Repeated taps must not send duplicate removal requests');
    assert.equal(await page.locator('.client-card').count(), 0);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('beneficiaryFavorites'))), []);
    await page.reload();
    await page.getByText('Aucun bénéficiaire trouvé', { exact: true }).waitFor();
    await page.goto(base + '/operations/new?clientId=' + clientId);
    await page.getByText('Ajoutez votre premier bénéficiaire pour effectuer un virement.', { exact: true }).waitFor();
    assert.equal(await page.locator('#clientId option[value="' + clientId + '"]').count(), 0);

    // The same IBAN can be re-added, and removal is also exposed on its detail page.
    await page.goto(base + '/clients/new');
    await fillBeneficiary();
    await page.getByRole('button', { name: 'Créer le bénéficiaire', exact: true }).click();
    await page.waitForURL('**/clients');
    await page.getByRole('link', { name: /Mobile Beneficiary CH9300762011623852957/ }).click();
    await page.waitForURL('**/clients/' + clientId);
    await page.getByRole('heading', { name: 'Mobile Beneficiary', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Supprimer le bénéficiaire', exact: true }).click();
    await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert.equal(await dialog.count(), 0);
    await page.getByRole('button', { name: 'Supprimer le bénéficiaire', exact: true }).click();
    await dialog.getByRole('button', { name: 'Supprimer le bénéficiaire', exact: true }).click();
    await page.waitForURL('**/clients');
    await page.getByRole('status').filter({ hasText: 'Bénéficiaire supprimé.' }).waitFor();
    assert.equal(await page.locator('.client-card').count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS: mobile funds, beneficiary creation and transfer; removal from list and detail, cancellation, focus, retry, repeated taps, persistence, favorite cleanup, re-adding and small-screen confirmation.');
    return clientId;
  } finally { await browser.close(); }
};
