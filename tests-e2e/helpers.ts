import { type Page, type Route } from '@playwright/test';

/**
 * Stable network stubs for third-party services the app uses.
 *
 * - `/cost-of-living.json` is served by the dev server from `public/`, so we
 *   leave it untouched.
 * - The live USD rates come from jsdelivr; we stub with a deterministic map.
 * - `rel.tax` stubs: `/countries` returns Germany; `/calculate/de` returns a
 *   30% effective rate.
 */
export async function mockThirdParty(page: Page): Promise<void> {
  await page.route(/jsdelivr\.net.*currencies\/usd\.min\.json/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ usd: { eur: 0.9, gbp: 0.8, usd: 1 } }),
    }),
  );

  await page.route(/rel\.tax\/v1\/countries/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        countries: [
          { code: 'de', name: 'Germany', currency: 'EUR', taxYear: 2026 },
          { code: 'fr', name: 'France', currency: 'EUR', taxYear: 2026 },
        ],
      }),
    }),
  );

  await page.route(/rel\.tax\/v1\/calculate\/de/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        country: 'DE',
        currency: 'EUR',
        taxYear: 2026,
        yearly: { gross: 60000, net: 42000, incomeTax: 18000 },
        monthly: { net: 3500 },
        rates: { effectiveTaxRate: 0.3 },
      }),
    }),
  );
}

/**
 * Fill the Calculator's City Autocomplete. Types the name and picks the
 * matching option from the dropdown. Country auto-fills.
 */
export async function selectCity(page: Page, cityName: string): Promise<void> {
  // MUI's Autocomplete renders both an <input role="combobox"> and a <ul
  // role="listbox" aria-labelledby="City"> once opened. Scope to the input.
  const cityInput = page.locator('input[role="combobox"]').first();
  await cityInput.click();
  await cityInput.fill(cityName);
  await page.getByRole('option', { name: cityName, exact: true }).first().click();
}
