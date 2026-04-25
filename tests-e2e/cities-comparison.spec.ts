import { expect, test } from '@playwright/test';
import { mockThirdParty } from './helpers';

test.beforeEach(async ({ page }) => {
  await mockThirdParty(page);
});

test('cities comparison: two cities render a chart', async ({ page }) => {
  await page.goto('/cities-comparison');

  // MUI renders each Autocomplete as <input role="combobox">; pick by index.
  const inputs = page.locator('input[role="combobox"]');

  async function pickCity(nth: number, name: string): Promise<void> {
    const input = inputs.nth(nth);
    await input.click();
    await input.pressSequentially(name, { delay: 10 });
    const option = page
      .getByRole('listbox')
      .getByRole('option', { name, exact: true })
      .first();
    await expect(option).toBeVisible();
    await option.click();
    await expect(input).toHaveValue(name);
  }

  await pickCity(0, 'Berlin');
  await pickCity(1, 'Paris');

  // When Playwright workers run in parallel against one dev server, React's
  // state-propagation can take a moment. Give the button up to 15s to become
  // enabled (it flips the moment both entries have a country attached).
  const compareBtn = page.getByRole('button', { name: /^Compare$/i });
  await expect(compareBtn).toBeEnabled({ timeout: 15_000 });
  await compareBtn.click();

  await expect(page.getByRole('heading', { name: /Monthly costs by category/i })).toBeVisible({
    timeout: 15_000,
  });
  // Both cities should appear in the chart legend.
  await expect(page.getByText(/Berlin, Germany/i).first()).toBeVisible();
  await expect(page.getByText(/Paris, France/i).first()).toBeVisible();
});
