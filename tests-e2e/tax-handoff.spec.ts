import { expect, test } from '@playwright/test';
import { mockThirdParty } from './helpers';

test.beforeEach(async ({ page }) => {
  await mockThirdParty(page);
});

test('tax calculator hands net income off to the calculator', async ({ page }) => {
  await page.goto('/tax-calculator');

  // Pick Germany from the country select.
  await page.getByRole('combobox', { name: /Country/i }).click();
  await page.getByRole('option', { name: 'Germany' }).click();

  await page.getByLabel(/Annual income/i).fill('60000');
  await page.getByRole('button', { name: /Calculate tax/i }).click();

  await expect(page.getByText(/Net yearly: 42000\.00 EUR/)).toBeVisible();

  // Click the handoff — should land us on /calculator with income prefilled.
  await page
    .getByRole('button', { name: /Use net income in Cost of Living Calculator/i })
    .click();

  await expect(page).toHaveURL(/\/calculator/);
  await expect(page.getByLabel(/Monthly Income/i)).toHaveValue('3500');
});
