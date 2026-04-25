import { expect, test } from '@playwright/test';
import { mockThirdParty } from './helpers';

test.beforeEach(async ({ page, context }) => {
  await mockThirdParty(page);
  await context.addInitScript(() => {
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  });
});

test('Export is disabled when history is empty; Import lands a record in history', async ({
  page,
}) => {
  await page.goto('/calculator');

  await expect(page.getByRole('button', { name: /^Export$/i })).toBeDisabled();

  // Upload a small JSON file through the hidden Import input.
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    records: [
      {
        id: 9001,
        city: 'Imported City',
        country: 'Importland',
        income: 4000,
        numberOfKids: 0,
        totalCosts: 2000,
        netBudget: 2000,
        currency: 'EUR',
      },
    ],
  };

  await page
    .getByLabel('Import records', { exact: true })
    .setInputFiles({
      name: 'records.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(payload)),
    });

  // Success notice + the imported row appears.
  await expect(page.getByText(/Imported 1 record\./)).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: 'Imported City' }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText('Importland');

  // Now Export enables.
  await expect(page.getByRole('button', { name: /^Export$/i })).toBeEnabled();
});

test('Import shows an error for an unreadable file', async ({ page }) => {
  await page.goto('/calculator');
  await page
    .getByLabel('Import records', { exact: true })
    .setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('definitely not json'),
    });
  await expect(page.getByText(/Could not read records from that file\./)).toBeVisible();
});
