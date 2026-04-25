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

async function readTotalCosts(page: import('@playwright/test').Page): Promise<number> {
  const text = await page.getByText(/Total costs:/i).first().innerText();
  return parseFloat(text.replace(/[^0-9.-]/g, ''));
}

test('lifestyle level changes total costs: frugal < average < comfortable', async ({ page }) => {
  await page.goto('/calculator');
  await page.getByLabel(/Monthly Income/i).fill('5000');
  await selectCity(page, 'Berlin');
  await expect(page.getByLabel(/Country/i)).toHaveValue('Germany');

  // MUI `TextField select` renders a hidden <input> plus a clickable <div>. Click the
  // label to focus/open the select, then pick from the listbox.
  const lifestyleField = page.getByLabel('Lifestyle', { exact: true });

  // Frugal
  await lifestyleField.click();
  await page.getByRole('option', { name: 'Frugal' }).click();
  await page.getByRole('button', { name: /^Calculate$/i }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Berlin' }).first()).toBeVisible();
  const frugalTotal = await readTotalCosts(page);

  // Comfortable
  await lifestyleField.click();
  await page.getByRole('option', { name: 'Comfortable' }).click();
  await page.getByRole('button', { name: /^Calculate$/i }).click();
  // Wait for the updated total to render. The best signal is that the total now
  // differs from the frugal one — poll until it does.
  await expect
    .poll(async () => readTotalCosts(page), { timeout: 8_000 })
    .toBeGreaterThan(frugalTotal);
});
