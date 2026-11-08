import { expect, test } from '@playwright/test';
import { mockThirdParty } from './helpers';

test('household to saved report, reload, and mobile workspace', async ({ page }, testInfo) => {
  await mockThirdParty(page);
  await page.route('**/api/assistant/status', route => route.fulfill({ json: { available: false } }));
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/');
  await page.getByRole('link', { name: /Build my relocation plan/ }).click();
  await page.getByLabel('Adults', { exact: true }).fill('2');
  await page.getByLabel('Destination city').selectOption({ label: 'Germany · Berlin' });
  await page.getByLabel('Location preference').selectOption('center');
  await page.getByLabel('Expected household monthly net income (USD)').fill('4500');
  await page.getByRole('button', { name: /Create my destination report/ }).click();
  await expect(page.getByRole('heading', { name: 'Your next chapter in Berlin.' })).toBeVisible();
  await expect(page.getByText('Not yet known', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('relocation-report.png') });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your next chapter in Berlin.' })).toBeVisible();
  await page.getByRole('link', { name: '← Your workspace' }).click();
  await page.getByRole('checkbox').first().check();
  await page.reload();
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('link', { name: 'Read report' })).toBeVisible();
  await expect(page.getByRole('navigation')).toBeHidden();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('relocation-mobile.png'), fullPage: true });
});

test('old homepage calculator share links still open the calculator', async ({ page }) => {
  await mockThirdParty(page);
  await page.route('**/api/assistant/status', route => route.fulfill({ json: { available: false } }));
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/?income=4200&city=Berlin&country=Germany&currency=USD');
  await expect(page).toHaveURL(/\/calculator\?income=4200/);
  await expect(page.getByLabel(/Monthly Income/i)).toHaveValue('4200');
});
