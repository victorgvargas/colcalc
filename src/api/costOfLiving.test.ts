import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeMonthlyCostsFromPrices,
  type ApiPriceItem,
} from './costOfLiving';

function item(partial: Partial<ApiPriceItem>): ApiPriceItem {
  return { ...partial };
}

describe('computeMonthlyCostsFromPrices (API version)', () => {
  it('averages rent items', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Rent Per Month', item_name: 'Apartment (1 bedroom) in City Centre', usd: { avg: 1000 } }),
      item({ category_name: 'Rent Per Month', item_name: 'Apartment (3 bedrooms) in City Centre', usd: { avg: 2000 } }),
    ];
    const { byCategory } = computeMonthlyCostsFromPrices(prices);
    expect(byCategory.get('Rent')).toBe(1500);
  });

  it('sums utilities and internet (non-list categories)', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Utilities (Monthly)', item_name: 'Electricity', usd: { avg: 50 } }),
      item({ category_name: 'Utilities (Monthly)', item_name: 'Water', usd: { avg: 25 } }),
      item({ category_name: 'Internet', item_name: 'Internet 60 Mbps', usd: { avg: 40 } }),
    ];
    const { byCategory } = computeMonthlyCostsFromPrices(prices);
    expect(byCategory.get('Utilities (Monthly)')).toBe(75);
    expect(byCategory.get('Internet')).toBe(40);
  });

  it('multiplies markets raw by basket multiplier (4x)', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Markets', item_name: 'Milk', usd: { avg: 2 } }),
      item({ category_name: 'Markets', item_name: 'Bread', usd: { avg: 3 } }),
    ];
    const { byCategory } = computeMonthlyCostsFromPrices(prices);
    expect(byCategory.get('Markets')).toBe(20); // (2+3) * 4
  });

  it('applies transport monthly multiplier (1.5x) on the median', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Transportation', item_name: 'Monthly pass', usd: { avg: 60 } }),
      item({ category_name: 'Transportation', item_name: 'Monthly pass discount', usd: { avg: 40 } }),
    ];
    const { byCategory } = computeMonthlyCostsFromPrices(prices);
    // median of [40, 60] = 50, times 1.5 = 75
    expect(byCategory.get('Transportation')).toBe(75);
  });

  it('drops per-unit transport items (gasoline, per liter)', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Transportation', item_name: 'Gasoline per liter', usd: { avg: 1.8 } }),
      item({ category_name: 'Transportation', item_name: 'Monthly Pass', usd: { avg: 100 } }),
    ];
    const { byCategory } = computeMonthlyCostsFromPrices(prices);
    // Only the $100 value survives; median of [100] * 1.5 = 150.
    expect(byCategory.get('Transportation')).toBe(150);
  });

  it('drops transport items over the monthly cap', () => {
    const prices: ApiPriceItem[] = [
      // 30000 looks like a car price — excluded.
      item({ category_name: 'Transportation', item_name: 'Toyota Corolla New', usd: { avg: 30000 } }),
      item({ category_name: 'Transportation', item_name: 'Monthly Pass', usd: { avg: 100 } }),
    ];
    const { byCategory } = computeMonthlyCostsFromPrices(prices);
    expect(byCategory.get('Transportation')).toBe(150);
  });

  it('drops childcare items above the cap', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Childcare', item_name: 'Preschool per month', usd: { avg: 800 } }),
      // Outrageous outlier — caps reject it.
      item({ category_name: 'Childcare', item_name: 'International school year', usd: { avg: 50000 } }),
    ];
    const { byCategory } = computeMonthlyCostsFromPrices(prices);
    expect(byCategory.get('Childcare')).toBe(800);
  });

  it('excludes restaurants, clothing, sports, cinema categories', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Restaurants', item_name: 'Dinner', usd: { avg: 40 } }),
      item({ category_name: 'Clothing', item_name: 'Jeans', usd: { avg: 60 } }),
      item({ category_name: 'Sports And Leisure', item_name: 'Gym', usd: { avg: 50 } }),
      item({ category_name: 'Cinema', item_name: 'Ticket', usd: { avg: 15 } }),
      // Still include an always-in category so the map isn't empty.
      item({ category_name: 'Utilities', item_name: 'Electricity', usd: { avg: 100 } }),
    ];
    const { byCategory, totalUsd } = computeMonthlyCostsFromPrices(prices);
    expect(byCategory.get('Restaurants')).toBeUndefined();
    expect(byCategory.get('Clothing')).toBeUndefined();
    expect(byCategory.get('Sports And Leisure')).toBeUndefined();
    expect(byCategory.get('Cinema')).toBeUndefined();
    expect(totalUsd).toBe(100);
  });

  it('ignores items with zero or invalid prices', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Utilities', item_name: 'Free', usd: { avg: 0 } }),
      item({ category_name: 'Utilities', item_name: 'Broken', usd: { avg: 'not-a-number' as unknown as number } }),
      item({ category_name: 'Utilities', item_name: 'OK', usd: { avg: 50 } }),
    ];
    const { byCategory } = computeMonthlyCostsFromPrices(prices);
    expect(byCategory.get('Utilities')).toBe(50);
  });

  it('parses string USD values', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Utilities', item_name: 'A', usd: { avg: '42.5' } }),
    ];
    const { byCategory } = computeMonthlyCostsFromPrices(prices);
    expect(byCategory.get('Utilities')).toBe(42.5);
  });

  it('falls back to local-currency fields when usd is missing', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Internet', item_name: 'Home internet', price: 25 }),
    ];
    const { byCategory } = computeMonthlyCostsFromPrices(prices);
    expect(byCategory.get('Internet')).toBe(25);
  });

  it('totalUsd equals the sum of byCategory values', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Rent Per Month', item_name: '1 bedroom city centre', usd: { avg: 1000 } }),
      item({ category_name: 'Utilities', item_name: 'Electricity', usd: { avg: 100 } }),
      item({ category_name: 'Markets', item_name: 'Milk', usd: { avg: 2 } }),
    ];
    const { byCategory, totalUsd } = computeMonthlyCostsFromPrices(prices);
    const sum = Array.from(byCategory.values()).reduce((a, b) => a + b, 0);
    expect(totalUsd).toBe(sum);
  });

  it('returns zero total for empty input', () => {
    const { totalUsd, byCategory } = computeMonthlyCostsFromPrices([]);
    expect(totalUsd).toBe(0);
    expect(byCategory.size).toBe(0);
  });
});

describe('fetchCities + fetchPricesForCity', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetchCities returns city + country pairs', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        cities: [
          { city: 'Berlin', country: 'Germany', prices: [] },
          { city: 'Paris', country: 'France', prices: [] },
        ],
      }),
    }) as unknown as typeof fetch;

    const mod = await import('./costOfLiving');
    const list = await mod.fetchCities();
    expect(list).toEqual([
      { cityName: 'Berlin', countryName: 'Germany' },
      { cityName: 'Paris', countryName: 'France' },
    ]);
  });

  it('fetchPricesForCity returns prices in the expected shape', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        cities: [
          {
            city: 'Berlin',
            country: 'Germany',
            prices: [
              { category: 'Utilities', item: 'Electricity', usd: 100 },
            ],
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const mod = await import('./costOfLiving');
    const { prices, exchangeRate } = await mod.fetchPricesForCity('Berlin', 'Germany');
    expect(exchangeRate).toBeNull();
    expect(prices).toHaveLength(1);
    expect(prices[0].category_name).toBe('Utilities');
    expect(prices[0].usd).toEqual({ avg: 100 });
  });

  it('fetchPricesForCity matches case-insensitively and trims', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        cities: [{ city: 'Berlin', country: 'Germany', prices: [] }],
      }),
    }) as unknown as typeof fetch;

    const mod = await import('./costOfLiving');
    const { prices } = await mod.fetchPricesForCity('  berlin  ', 'GERMANY');
    expect(prices).toEqual([]);
  });

  it('fetchPricesForCity throws when city is not in dataset', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        cities: [{ city: 'Berlin', country: 'Germany', prices: [] }],
      }),
    }) as unknown as typeof fetch;

    const mod = await import('./costOfLiving');
    await expect(mod.fetchPricesForCity('Atlantis', 'Mu')).rejects.toThrow(
      /No price data/,
    );
  });

  it('throws on dataset fetch failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const mod = await import('./costOfLiving');
    await expect(mod.fetchCities()).rejects.toThrow(/500/);
  });

  it('fetchDatasetMeta returns provenance fields', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        source: 'https://example.com/dataset',
        generatedAt: '2026-04-24T10:47:30.079Z',
        cityCount: 4869,
        cities: [],
      }),
    }) as unknown as typeof fetch;

    const mod = await import('./costOfLiving');
    const meta = await mod.fetchDatasetMeta();
    expect(meta).toEqual({
      source: 'https://example.com/dataset',
      generatedAt: '2026-04-24T10:47:30.079Z',
      cityCount: 4869,
    });
  });

  it('fetchDatasetMeta falls back to cities.length when cityCount is missing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        source: 'https://example.com/dataset',
        cities: [
          { city: 'Berlin', country: 'Germany', prices: [] },
          { city: 'Paris', country: 'France', prices: [] },
        ],
      }),
    }) as unknown as typeof fetch;

    const mod = await import('./costOfLiving');
    const meta = await mod.fetchDatasetMeta();
    expect(meta.cityCount).toBe(2);
    expect(meta.generatedAt).toBeUndefined();
  });

  it('fetchPricesForCity returns the dataset price-point count', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        cities: [
          {
            city: 'Berlin',
            country: 'Germany',
            prices: [
              { category: 'Rent', item: '1 bedroom', usd: 1200 },
              { category: 'Markets', item: 'Milk', usd: 2 },
              { category: 'Markets', item: 'Bread', usd: 3 },
            ],
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const mod = await import('./costOfLiving');
    const result = await mod.fetchPricesForCity('Berlin', 'Germany');
    expect(result.pricePointCount).toBe(3);
    expect(result.prices).toHaveLength(3);
  });
});
