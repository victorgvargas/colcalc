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

test('partner income raises the net budget without changing total costs', async ({ page }) => {
  await page.goto('/calculator');
  await page.getByLabel(/Monthly Income/i).fill('5000');
  await selectCity(page, 'Berlin');
  await expect(page.getByLabel(/Country/i)).toHaveValue('Germany');

  await page.getByRole('button', { name: /^Calculate$/i }).click();

  const budget = page.getByText(/Net budget:/i).first();
  const before = parseFloat((await budget.innerText()).replace(/[^0-9.-]/g, ''));

  await page.getByLabel(/Partner income/i).fill('2000');

  await expect
    .poll(async () =>
      parseFloat((await budget.innerText()).replace(/[^0-9.-]/g, '')),
      { timeout: 5000 },
    )
    .toBe(before + 2000);
});

test('adults-in-household is shared via the URL', async ({ page }) => {
  await page.goto('/calculator?city=Berlin&country=Germany&income=5000&adults=2&partner=1500');

  await expect(page.getByLabel(/Adults in household/i)).toHaveValue('2');
  await expect(page.getByLabel(/Partner income/i)).toHaveValue('1500');
});
