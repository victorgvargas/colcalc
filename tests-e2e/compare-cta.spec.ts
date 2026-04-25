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

test('Compare CTA carries the calculated city into /cities-comparison with its first row prefilled', async ({
  page,
}) => {
  await page.goto('/calculator');
  await page.getByLabel(/Monthly Income/i).fill('5000');
  await selectCity(page, 'Berlin');
  await expect(page.getByLabel(/Country/i)).toHaveValue('Germany');

  await page.getByRole('button', { name: /^Calculate$/i }).click();

  // The CTA shows after a calculation has run (record selected automatically).
  const cta = page.getByRole('button', { name: /Compare with another city/i });
  await expect(cta).toBeVisible();
  await cta.click();

  // We should have landed on /cities-comparison (the URL may be stripped after
  // React's "consume prefill" navigate), so assert on state — not the URL.
  await expect(page).toHaveURL(/\/cities-comparison/);
  const city1 = page.locator('input[role="combobox"]').nth(0);
  await expect(city1).toHaveValue('Berlin');
});
