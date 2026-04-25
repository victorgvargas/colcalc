import { expect, test } from '@playwright/test';
import { mockThirdParty, selectCity } from './helpers';

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

test('currency dropdown includes non-canonical currencies from live USD rates', async ({ page }) => {
  await page.goto('/calculator');

  // Open the Currency select.
  await page.getByLabel('Currency', { exact: true }).click();

  // Canonical codes + extras from our stubbed usdRates (inr, vnd) should appear.
  await expect(page.getByRole('option', { name: /Indian Rupee \(INR\)/i })).toBeVisible();
  await expect(page.getByRole('option', { name: 'VND', exact: true })).toBeVisible();
});

test('calculating in INR labels the totals with INR', async ({ page }) => {
  await page.goto('/calculator');

  await page.getByLabel('Currency', { exact: true }).click();
  await page.getByRole('option', { name: /Indian Rupee \(INR\)/i }).click();

  await page.getByLabel(/Monthly Income/i).fill('500000');
  await selectCity(page, 'Berlin');
  await expect(page.getByLabel(/Country/i)).toHaveValue('Germany');

  await page.getByRole('button', { name: /^Calculate$/i }).click();

  await expect(page.getByText(/Total costs:.*INR/).first()).toBeVisible();
  await expect(page.getByText(/Net budget:.*INR/).first()).toBeVisible();

  // History row should also show INR symbols.
  const row = page.getByRole('row').filter({ hasText: 'Berlin' }).first();
  await expect(row).toContainText('INR');
});
