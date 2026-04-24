import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/exchangeRates', () => ({
  getUsdRates: vi.fn(),
  getUsdToCurrencyRate: (
    rates: Record<string, number> | null,
    code: string,
    fallback: number,
  ) => rates?.[code.toLowerCase()] ?? fallback,
}));

vi.mock('../api/costOfLiving', async () => {
  const actual = await vi.importActual<typeof import('../api/costOfLiving')>(
    '../api/costOfLiving',
  );
  return {
    ...actual,
    fetchCities: vi.fn(),
    fetchPricesForCity: vi.fn(),
  };
});

vi.mock('../api/taxRates', () => ({
  fetchTaxCountries: vi.fn(),
  fetchIncomeTax: vi.fn(),
  countryNameToCode: vi.fn(),
}));

import { runTool, type AppActionContext } from './appActions';
import { getUsdRates } from '../api/exchangeRates';
import { fetchCities, fetchPricesForCity } from '../api/costOfLiving';
import { fetchTaxCountries, fetchIncomeTax } from '../api/taxRates';

function makeCtx(overrides: Partial<AppActionContext> = {}): AppActionContext {
  return {
    currentPath: '/calculator',
    navigate: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('runTool navigation tools', () => {
  it('get_current_page returns ctx.currentPath', async () => {
    const res = await runTool('get_current_page', {}, makeCtx({ currentPath: '/tax-calculator' }));
    expect(res).toEqual({ path: '/tax-calculator' });
  });

  it('navigate_to calls ctx.navigate for allowed paths', async () => {
    const navigate = vi.fn();
    const res = await runTool('navigate_to', { path: '/calculator' }, makeCtx({ navigate }));
    expect(res).toEqual({ ok: true, path: '/calculator' });
    expect(navigate).toHaveBeenCalledWith('/calculator');
  });

  it('navigate_to rejects unknown paths', async () => {
    const navigate = vi.fn();
    const res = await runTool('navigate_to', { path: '/secrets' }, makeCtx({ navigate }));
    expect(res).toEqual({ ok: false, error: expect.stringContaining('/secrets') });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('prefill_calculator rejects non-positive income', async () => {
    const navigate = vi.fn();
    const res = await runTool('prefill_calculator', { income: -5 }, makeCtx({ navigate }));
    expect(res.ok).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('prefill_calculator passes state to the calculator route', async () => {
    const navigate = vi.fn();
    const res = await runTool(
      'prefill_calculator',
      { income: 5000, currency: 'eur', city: 'Berlin', country: 'Germany' },
      makeCtx({ navigate }),
    );
    expect(res.ok).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/calculator', {
      income: 5000,
      currency: 'EUR',
      city: 'Berlin',
      country: 'Germany',
    });
  });
});

describe('runTool record tools', () => {
  it('list_saved_records returns empty list when storage is blank', async () => {
    const res = await runTool('list_saved_records', {}, makeCtx());
    expect(res).toEqual({ count: 0, records: [] });
  });

  it('list_saved_records reads and rounds values', async () => {
    localStorage.setItem(
      'colcalc_records',
      JSON.stringify([
        { id: 1, city: 'Berlin', country: 'Germany', income: 5000, numberOfKids: 0, totalCosts: 2499.999, netBudget: 2500.001, currency: 'EUR' },
      ]),
    );
    const res = await runTool('list_saved_records', {}, makeCtx()) as {
      count: number;
      records: Array<{ totalCosts: number; netBudget: number }>;
    };
    expect(res.count).toBe(1);
    expect(res.records[0].totalCosts).toBe(2500);
    expect(res.records[0].netBudget).toBe(2500);
  });

  it('delete_record removes a record and writes back', async () => {
    localStorage.setItem(
      'colcalc_records',
      JSON.stringify([
        { id: 1, city: 'Berlin', country: 'Germany', income: 1, numberOfKids: 0, totalCosts: 0, netBudget: 1, currency: 'EUR' },
        { id: 2, city: 'Paris', country: 'France', income: 1, numberOfKids: 0, totalCosts: 0, netBudget: 1, currency: 'EUR' },
      ]),
    );
    const res = await runTool('delete_record', { id: 1 }, makeCtx());
    expect(res).toEqual({ ok: true, deletedId: 1, remaining: 1 });
    const stored = JSON.parse(localStorage.getItem('colcalc_records')!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(2);
  });

  it('delete_record errors on unknown id', async () => {
    localStorage.setItem('colcalc_records', JSON.stringify([]));
    const res = await runTool('delete_record', { id: 99 }, makeCtx());
    expect(res.ok).toBe(false);
  });

  it('clear_all_records wipes storage', async () => {
    localStorage.setItem(
      'colcalc_records',
      JSON.stringify([
        { id: 1, city: 'Berlin', country: 'Germany', income: 1, numberOfKids: 0, totalCosts: 0, netBudget: 1, currency: 'EUR' },
      ]),
    );
    const res = await runTool('clear_all_records', {}, makeCtx());
    expect(res).toEqual({ ok: true, cleared: 1 });
    expect(JSON.parse(localStorage.getItem('colcalc_records')!)).toEqual([]);
  });

  it('clear_all_records is a no-op on empty storage', async () => {
    const res = await runTool('clear_all_records', {}, makeCtx());
    expect(res).toEqual({ ok: true, cleared: 0 });
  });
});

describe('runTool exchange / tax / search tools', () => {
  it('get_exchange_rate computes cross-rate via USD', async () => {
    vi.mocked(getUsdRates).mockResolvedValue({ eur: 0.9, gbp: 0.8 });
    const res = await runTool('get_exchange_rate', { from: 'EUR', to: 'GBP' }, makeCtx()) as {
      rate: number;
    };
    // 1 EUR = (0.8 / 0.9) GBP ≈ 0.8889
    expect(res.rate).toBeCloseTo(0.8889, 3);
  });

  it('get_exchange_rate errors on unsupported currencies', async () => {
    vi.mocked(getUsdRates).mockResolvedValue({ eur: 0.9 });
    const res = await runTool('get_exchange_rate', { from: 'XXX', to: 'EUR' }, makeCtx());
    expect(res.ok).toBe(false);
  });

  it('list_supported_tax_countries returns mapped entries', async () => {
    vi.mocked(fetchTaxCountries).mockResolvedValue([
      { code: 'de', name: 'Germany', currency: 'EUR', taxYear: 2026 },
    ]);
    const res = await runTool('list_supported_tax_countries', {}, makeCtx()) as {
      count: number;
      countries: { code: string; name: string; currency: string }[];
    };
    expect(res.count).toBe(1);
    expect(res.countries[0]).toEqual({ code: 'de', name: 'Germany', currency: 'EUR' });
  });

  it('estimate_income_tax surfaces rel.tax fields', async () => {
    vi.mocked(fetchIncomeTax).mockResolvedValue({
      country: 'DE',
      currency: 'EUR',
      taxYear: 2026,
      yearly: { gross: 60000, net: 40000 },
      monthly: { net: 3500 },
      rates: { effectiveTaxRate: 0.33 },
    });
    const res = await runTool(
      'estimate_income_tax',
      { countryCode: 'de', income: 60000 },
      makeCtx(),
    ) as { monthlyNet: number; effectiveTaxRate: number };
    expect(res.monthlyNet).toBe(3500);
    expect(res.effectiveTaxRate).toBe(0.33);
    expect(fetchIncomeTax).toHaveBeenCalledWith('de', 60000);
  });

  it('estimate_income_tax rejects missing country or invalid income', async () => {
    const res = await runTool('estimate_income_tax', { countryCode: '', income: -1 }, makeCtx());
    expect(res.ok).toBe(false);
  });

  it('search_cities filters by query against fetched list', async () => {
    vi.mocked(fetchCities).mockResolvedValue([
      { cityName: 'Berlin', countryName: 'Germany' },
      { cityName: 'Paris', countryName: 'France' },
      { cityName: 'Barcelona', countryName: 'Spain' },
    ]);
    const res = await runTool('search_cities', { query: 'ber' }, makeCtx()) as {
      count: number;
      matches: { cityName: string }[];
    };
    expect(res.count).toBe(1);
    expect(res.matches[0].cityName).toBe('Berlin');
  });

  it('search_cities rejects empty query', async () => {
    const res = await runTool('search_cities', { query: '   ' }, makeCtx());
    expect(res.ok).toBe(false);
  });

  it('compare_city_costs rejects fewer than 2 cities', async () => {
    const res = await runTool('compare_city_costs', { cities: [{ cityName: 'Berlin', countryName: 'Germany' }] }, makeCtx());
    expect(res.ok).toBe(false);
  });

  it('compare_city_costs returns per-city totals', async () => {
    vi.mocked(fetchPricesForCity).mockImplementation(async (city: string) => ({
      exchangeRate: null,
      prices: [
        { category_name: 'Utilities', item_name: 'Electricity', usd: { avg: city === 'Berlin' ? 150 : 250 } },
      ],
    }));
    const res = await runTool(
      'compare_city_costs',
      {
        cities: [
          { cityName: 'Berlin', countryName: 'Germany' },
          { cityName: 'Paris', countryName: 'France' },
        ],
      },
      makeCtx(),
    ) as { results: { city: string; totalMonthlyUsd: number }[] };
    expect(res.results).toHaveLength(2);
    expect(res.results[0].totalMonthlyUsd).toBe(150);
    expect(res.results[1].totalMonthlyUsd).toBe(250);
  });

  it('compare_city_costs rejects entries missing city or country name', async () => {
    const res = await runTool(
      'compare_city_costs',
      { cities: [{ cityName: 'Berlin' }, { cityName: 'Paris', countryName: 'France' }] },
      makeCtx(),
    );
    expect(res.ok).toBe(false);
  });
});

describe('runTool unknown tool', () => {
  it('returns error for unknown tool name', async () => {
    const res = await runTool('teleport', {}, makeCtx());
    expect(res).toEqual({ ok: false, error: expect.stringContaining('teleport') });
  });
});
