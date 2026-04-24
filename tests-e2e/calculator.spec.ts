import { expect, test } from '@playwright/test';
import { mockThirdParty, selectCity } from './helpers';

test.beforeEach(async ({ page, context }) => {
  await mockThirdParty(page);
  // Start each test from a clean slate so history assertions are deterministic.
  await context.addInitScript(() => {
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  });
});

test('calculator happy path: fills form, runs calculation, row lands in history', async ({
  page,
}) => {
  await page.goto('/calculator');

  await page.getByLabel(/Monthly Income/i).fill('5000');
  await selectCity(page, 'Berlin');

  await expect(page.getByLabel(/Country/i)).toHaveValue('Germany');

  await page.getByRole('button', { name: /^Calculate$/i }).click();

  // The Net budget copy appears once the costs are computed.
  await expect(page.getByText(/Net budget:/i).first()).toBeVisible();

  const historyRow = page.getByRole('row').filter({ hasText: 'Berlin' }).first();
  await expect(historyRow).toBeVisible();
  await expect(historyRow).toContainText('Germany');
});

test('applying tax produces a different net budget than gross', async ({ page }) => {
  await page.goto('/calculator');

  await page.getByLabel(/Monthly Income/i).fill('5000');
  await selectCity(page, 'Berlin');
  await expect(page.getByLabel(/Country/i)).toHaveValue('Germany');

  // First run without tax.
  await page.getByRole('button', { name: /^Calculate$/i }).click();
  const grossText = await page.getByText(/Net budget:/i).first().innerText();
  const grossValue = parseFloat(grossText.replace(/[^0-9.-]/g, ''));

  // Now toggle tax and re-run.
  await page.getByLabel(/Apply estimated income tax/i).check();
  await page.getByRole('button', { name: /^Calculate$/i }).click();

  // The per-rate caption shows with the mocked 30% rate.
  await expect(page.getByText(/Net income \(after 30\.0% tax\)/i)).toBeVisible();

  const taxedText = await page.getByText(/Net budget:/i).first().innerText();
  const taxedValue = parseFloat(taxedText.replace(/[^0-9.-]/g, ''));

  // 30% tax on 5000 should shave ~1500 off the budget — bigger gap than rounding.
  expect(grossValue - taxedValue).toBeGreaterThan(100);
});

test('share URL round-trips: copying the link prefills a fresh page that auto-runs', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  await page.goto('/calculator');
  await page.getByLabel(/Monthly Income/i).fill('4200');
  await selectCity(page, 'Berlin');
  await expect(page.getByLabel(/Country/i)).toHaveValue('Germany');

  await page.getByRole('button', { name: /Copy shareable link/i }).click();

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('income=4200');
  expect(copied).toContain('city=Berlin');
  expect(copied).toContain('currency=EUR');

  // Open the share URL in a fresh tab — the calculator auto-runs and populates history.
  const fresh = await context.newPage();
  await mockThirdParty(fresh);
  await fresh.goto(copied);
  await expect(fresh.getByLabel(/Monthly Income/i)).toHaveValue('4200');
  await expect(fresh.getByRole('row').filter({ hasText: 'Berlin' }).first()).toBeVisible({
    timeout: 15_000,
  });
});
