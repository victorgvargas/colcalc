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

test('calculator form shows dataset provenance (source, city count, updated date)', async ({
  page,
}) => {
  await page.goto('/calculator');

  // Footer caption should appear once fetchDatasetMeta resolves.
  await expect(page.getByText(/Data from/i)).toBeVisible();
  await expect(page.getByText(/2 cities/)).toBeVisible();
  await expect(page.getByText(/updated 2026-04-25/)).toBeVisible();

  const link = page.getByRole('link', { name: /open Cost of Living dataset/i });
  await expect(link).toHaveAttribute('href', 'https://example.com/open-dataset');
});

test('breakdown card shows per-city price-point count after a calculation', async ({ page }) => {
  await page.goto('/calculator');
  await page.getByLabel(/Monthly Income/i).fill('5000');
  await selectCity(page, 'Berlin');
  await expect(page.getByLabel(/Country/i)).toHaveValue('Germany');

  await page.getByRole('button', { name: /^Calculate$/i }).click();

  // Our fixture has 6 price points for Berlin.
  await expect(page.getByText(/Based on 6 price points/)).toBeVisible();
});
