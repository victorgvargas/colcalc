import { expect, test } from '@playwright/test';
import { mockThirdParty } from './helpers';

test.beforeEach(async ({ page }) => {
  await mockThirdParty(page);
});

test('cities comparison: two cities render a chart', async ({ page }) => {
  await page.goto('/cities-comparison');

  // MUI renders each Autocomplete as <input role="combobox">; pick by index.
  const inputs = page.locator('input[role="combobox"]');
  await inputs.nth(0).click();
  await inputs.nth(0).fill('Berlin');
  await page.getByRole('option', { name: 'Berlin', exact: true }).first().click();

  await inputs.nth(1).click();
  await inputs.nth(1).fill('Paris');
  await page.getByRole('option', { name: 'Paris', exact: true }).first().click();

  const compareBtn = page.getByRole('button', { name: /^Compare$/i });
  await expect(compareBtn).toBeEnabled();
  await compareBtn.click();

  await expect(page.getByRole('heading', { name: /Monthly costs by category/i })).toBeVisible({
    timeout: 15_000,
  });
  // Both cities should appear in the chart legend.
  await expect(page.getByText(/Berlin, Germany/i).first()).toBeVisible();
  await expect(page.getByText(/Paris, France/i).first()).toBeVisible();
});
