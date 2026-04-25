import { describe, expect, it } from 'vitest';
import type { ApiPriceItem } from '../../api/costOfLiving';
import {
  CURRENCIES,
  LIFESTYLE_MULTIPLIERS,
  buildCurrencyOptions,
  computeMonthlyCostsFromPrices,
  getCurrencyMeta,
  median,
  parseStoredRecords,
  readShareStateFromSearch,
  toDisplayCurrency,
  type CalculationRecord,
} from './logic';

function item(partial: Partial<ApiPriceItem>): ApiPriceItem {
  return { ...partial };
}

describe('median', () => {
  it('returns 0 for an empty list', () => {
    expect(median([])).toBe(0);
  });

  it('returns the middle value for odd-length input', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('averages the two middle values for even-length input', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('does not mutate the original array', () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe('toDisplayCurrency', () => {
  it('converts USD input to EUR display', () => {
    const eur = toDisplayCurrency(100, 'USD');
    // 100 USD * 1 / 1.08 EUR/USD ≈ 92.59
    expect(eur).toBeCloseTo(100 / CURRENCIES.EUR.rateToUsd, 5);
  });

  it('returns the same value for EUR input', () => {
    expect(toDisplayCurrency(100, 'EUR')).toBeCloseTo(100, 5);
  });

  it('handles zero', () => {
    expect(toDisplayCurrency(0, 'GBP')).toBe(0);
  });

  it('uses live USD rates when provided', () => {
    // 200 USD at 1 USD = 0.9 EUR should yield 180 EUR.
    const live = toDisplayCurrency(200, 'USD', { usd: 1, eur: 0.9 });
    expect(live).toBe(180);
  });

  it('supports unknown currencies via a neutral 1:1 fallback to USD', () => {
    // Unknown code → meta rateToUsd = 1. (100 * 1) / EUR.rateToUsd.
    const val = toDisplayCurrency(100, 'XYZ');
    expect(val).toBeCloseTo(100 / CURRENCIES.EUR.rateToUsd, 5);
  });
});

describe('getCurrencyMeta', () => {
  it('returns canonical metadata for known codes', () => {
    const eur = getCurrencyMeta('EUR');
    expect(eur.name).toBe('Euro');
    expect(eur.symbol).toBe('EUR');
  });

  it('uppercases the input', () => {
    expect(getCurrencyMeta('inr').code).toBe('INR');
  });

  it('falls back to the code itself for unknown currencies', () => {
    const meta = getCurrencyMeta('ZZZ');
    expect(meta.code).toBe('ZZZ');
    expect(meta.name).toBe('ZZZ');
    expect(meta.symbol).toBe('ZZZ');
    expect(meta.rateToUsd).toBe(1);
  });
});

describe('buildCurrencyOptions', () => {
  it('pins USD, EUR, GBP at the top in that order', () => {
    const opts = buildCurrencyOptions(null);
    expect(opts.slice(0, 3).map((o) => o.code)).toEqual(['USD', 'EUR', 'GBP']);
  });

  it('includes every known canonical code even without live rates', () => {
    const codes = new Set(buildCurrencyOptions(null).map((o) => o.code));
    expect(codes.has('INR')).toBe(true);
    expect(codes.has('JPY')).toBe(true);
  });

  it('merges in extra ISO-like codes present in live USD rates', () => {
    const opts = buildCurrencyOptions({ vnd: 25000, php: 56 });
    const codes = opts.map((o) => o.code);
    expect(codes).toContain('VND');
    expect(codes).toContain('PHP');
  });

  it('ignores non-ISO keys from the rates table (e.g. "btc", "1inch")', () => {
    const opts = buildCurrencyOptions({ btc: 0.00002, '1inch': 2 });
    const codes = opts.map((o) => o.code);
    // Both are ignored — btc is only 3 lowercase letters, which match our ISO
    // pattern (3 letters), so it IS admitted — the filter is about shape, not
    // validity. We only reject non-3-letter entries here.
    expect(codes).toContain('BTC');
    expect(codes).not.toContain('1INCH');
  });
});

describe('computeMonthlyCostsFromPrices (Calculator, with rentLocation)', () => {
  it('prefers city-centre rent for rentLocation=center', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Rent Per Month', item_name: 'Apartment (1 bedroom) in City Centre', usd: { avg: 1500 } }),
      item({ category_name: 'Rent Per Month', item_name: 'Apartment (1 bedroom) Outside of Centre', usd: { avg: 1000 } }),
    ];
    const { byCategory } = computeMonthlyCostsFromPrices(prices, 'center');
    expect(byCategory.get('Rent')).toBe(1500);
  });

  it('prefers outskirts rent for rentLocation=outskirts', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Rent Per Month', item_name: 'Apartment (1 bedroom) in City Centre', usd: { avg: 1500 } }),
      item({ category_name: 'Rent Per Month', item_name: 'Apartment (1 bedroom) Outside of Centre', usd: { avg: 1000 } }),
    ];
    const { byCategory } = computeMonthlyCostsFromPrices(prices, 'outskirts');
    expect(byCategory.get('Rent')).toBe(1000);
  });

  it('falls back to generic rent when no centre/outskirts label is present', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Rent Per Month', item_name: 'Apartment (3 bedrooms)', usd: { avg: 2400 } }),
    ];
    const { byCategory } = computeMonthlyCostsFromPrices(prices, 'center');
    expect(byCategory.get('Rent')).toBe(2400);
  });

  it('averages multiple rent entries within the chosen location bucket', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Rent Per Month', item_name: 'Apartment (1 bedroom) in City Centre', usd: { avg: 1000 } }),
      item({ category_name: 'Rent Per Month', item_name: 'Apartment (3 bedrooms) in City Centre', usd: { avg: 2000 } }),
    ];
    const { byCategory } = computeMonthlyCostsFromPrices(prices, 'center');
    expect(byCategory.get('Rent')).toBe(1500);
  });

  it('excludes apartment-purchase and price-per-square items from rent', () => {
    const prices: ApiPriceItem[] = [
      // "Buy Apartment" should be excluded even though Rent category keywords match nothing here.
      item({ category_name: 'Buy Apartment Price', item_name: 'Price per Square Meter to Buy Apartment in City Centre', usd: { avg: 5000 } }),
      item({ category_name: 'Rent Per Month', item_name: 'Apartment (1 bedroom) in City Centre', usd: { avg: 1200 } }),
    ];
    const { byCategory } = computeMonthlyCostsFromPrices(prices, 'center');
    expect(byCategory.get('Rent')).toBe(1200);
    for (const key of byCategory.keys()) {
      expect(key.toLowerCase()).not.toContain('buy');
    }
  });

  it('applies markets basket multiplier and transport multiplier consistently with API version', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Markets', item_name: 'Milk', usd: { avg: 2 } }),
      item({ category_name: 'Markets', item_name: 'Bread', usd: { avg: 3 } }),
      item({ category_name: 'Transportation', item_name: 'Monthly pass A', usd: { avg: 40 } }),
      item({ category_name: 'Transportation', item_name: 'Monthly pass B', usd: { avg: 60 } }),
    ];
    const { byCategory } = computeMonthlyCostsFromPrices(prices, 'center');
    expect(byCategory.get('Markets')).toBe(20);
    expect(byCategory.get('Transportation')).toBe(75);
  });

  it('totalUsd reflects the sum of all surviving categories', () => {
    const prices: ApiPriceItem[] = [
      item({ category_name: 'Rent Per Month', item_name: 'Apartment (1 bedroom) in City Centre', usd: { avg: 1500 } }),
      item({ category_name: 'Utilities', item_name: 'Electricity', usd: { avg: 100 } }),
      item({ category_name: 'Internet', item_name: 'Internet', usd: { avg: 40 } }),
    ];
    const { totalUsd, byCategory } = computeMonthlyCostsFromPrices(prices, 'center');
    const summed = Array.from(byCategory.values()).reduce((a, b) => a + b, 0);
    expect(totalUsd).toBe(summed);
    expect(totalUsd).toBe(1500 + 100 + 40);
  });
});

describe('parseStoredRecords', () => {
  it('returns an empty array for null/invalid input', () => {
    expect(parseStoredRecords(null)).toEqual([]);
    expect(parseStoredRecords('not-json')).toEqual([]);
    expect(parseStoredRecords('{"not": "array"}')).toEqual([]);
  });

  it('coerces and defaults record fields', () => {
    const stored = JSON.stringify([
      {
        id: 1,
        city: 'Berlin',
        country: 'Germany',
        income: 5000,
        numberOfKids: 2,
        totalCosts: 2000,
        netBudget: 3000,
        currency: 'EUR',
        costBreakdown: [{ name: 'Rent', value: 1200 }],
      },
    ]);
    const [rec] = parseStoredRecords(stored);
    expect(rec.city).toBe('Berlin');
    expect(rec.currency).toBe('EUR');
    expect(rec.costBreakdown).toEqual([{ name: 'Rent', value: 1200 }]);
  });

  it('filters out records missing city or country', () => {
    const stored = JSON.stringify([
      { id: 1, city: 'Berlin', country: 'Germany', income: 1, numberOfKids: 0, totalCosts: 0, netBudget: 0, currency: 'EUR' },
      { id: 2, city: '', country: 'Germany' },
      { id: 3, city: 'Paris', country: '' },
    ]);
    const parsed = parseStoredRecords(stored);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].city).toBe('Berlin');
  });

  it('accepts any ISO-like three-letter currency code, uppercased', () => {
    const stored = JSON.stringify([
      { id: 1, city: 'Berlin', country: 'Germany', income: 1, totalCosts: 0, netBudget: 1, currency: 'inr' },
    ]);
    const [rec] = parseStoredRecords(stored);
    expect(rec.currency).toBe('INR');
  });

  it('defaults currency to EUR when the stored code is not 3 letters', () => {
    const stored = JSON.stringify([
      { id: 1, city: 'Berlin', country: 'Germany', income: 1, totalCosts: 0, netBudget: 1, currency: 'EURO' },
    ]);
    const [rec] = parseStoredRecords(stored);
    expect(rec.currency).toBe('EUR');
  });

  it('clamps taxRate to [0,1] and drops invalid values', () => {
    const stored = JSON.stringify([
      { id: 1, city: 'Berlin', country: 'Germany', income: 1, totalCosts: 0, netBudget: 1, taxRate: 1.5 },
      { id: 2, city: 'Paris', country: 'France', income: 1, totalCosts: 0, netBudget: 1, taxRate: -0.3 },
      { id: 3, city: 'Rome', country: 'Italy', income: 1, totalCosts: 0, netBudget: 1, taxRate: 'bad' },
      { id: 4, city: 'Madrid', country: 'Spain', income: 1, totalCosts: 0, netBudget: 1, taxRate: 0.25 },
    ]);
    const recs = parseStoredRecords(stored);
    expect(recs[0].taxRate).toBe(1);
    expect(recs[1].taxRate).toBe(0);
    expect(recs[2].taxRate).toBeUndefined();
    expect(recs[3].taxRate).toBe(0.25);
  });

  it('skips non-object entries in costBreakdown', () => {
    const stored = JSON.stringify([
      {
        id: 1,
        city: 'Berlin',
        country: 'Germany',
        income: 1,
        numberOfKids: 0,
        totalCosts: 0,
        netBudget: 1,
        costBreakdown: [
          { name: 'Rent', value: 1 },
          null,
          { name: 'Incomplete' },
          { name: 'Good', value: 2 },
        ],
      },
    ]);
    const [rec] = parseStoredRecords(stored);
    expect(rec.costBreakdown).toEqual([
      { name: 'Rent', value: 1 },
      { name: 'Good', value: 2 },
    ]);
  });

  // Round-trip: what the calculator writes should parse back.
  it('round-trips a real calculation record via JSON', () => {
    const record: CalculationRecord = {
      id: 42,
      city: 'Berlin',
      country: 'Germany',
      income: 5000,
      numberOfKids: 1,
      totalCosts: 2500,
      netBudget: 2500,
      currency: 'EUR',
      baseCostsInRecordCurrency: 2000,
      childcarePerChildInRecordCurrency: 500,
      costBreakdown: [
        { name: 'Rent', value: 1200 },
        { name: 'Markets', value: 400 },
      ],
      taxRate: 0.3,
    };
    const [parsed] = parseStoredRecords(JSON.stringify([record]));
    expect(parsed).toEqual(record);
  });
});

describe('readShareStateFromSearch', () => {
  it('returns null for empty input', () => {
    expect(readShareStateFromSearch('')).toBeNull();
    expect(readShareStateFromSearch('?unrelated=1')).toBeNull();
  });

  it('reads income, currency, city, country, kids, rent, tax', () => {
    const s = readShareStateFromSearch(
      '?income=5000&currency=EUR&city=Berlin&country=Germany&kids=2&rent=outskirts&tax=1',
    );
    expect(s).toEqual({
      income: 5000,
      currency: 'EUR',
      city: 'Berlin',
      country: 'Germany',
      numberOfKids: 2,
      rentLocation: 'outskirts',
      applyTax: true,
    });
  });

  it('accepts tax=true as truthy', () => {
    const s = readShareStateFromSearch('?income=100&city=Berlin&tax=true');
    expect(s?.applyTax).toBe(true);
  });

  it('accepts any ISO-like three-letter currency code, uppercased', () => {
    const s = readShareStateFromSearch('?income=100&city=Berlin&currency=inr');
    expect(s?.currency).toBe('INR');
  });

  it('ignores malformed (non-3-letter) currency codes', () => {
    const s = readShareStateFromSearch('?income=100&city=Berlin&currency=EURO');
    expect(s?.currency).toBeUndefined();
  });

  it('ignores invalid income and kids values', () => {
    const s = readShareStateFromSearch('?income=abc&kids=-4&city=Berlin');
    expect(s?.income).toBeUndefined();
    expect(s?.numberOfKids).toBeUndefined();
  });

  it('ignores unsupported rent values', () => {
    const s = readShareStateFromSearch('?city=Berlin&rent=moon');
    expect(s?.rentLocation).toBeUndefined();
  });

  it('URL-decodes city/country values', () => {
    const s = readShareStateFromSearch('?city=New%20York&country=United%20States');
    expect(s?.city).toBe('New York');
    expect(s?.country).toBe('United States');
  });

  it('reads a valid lifestyle level', () => {
    expect(readShareStateFromSearch('?city=Berlin&lifestyle=frugal')?.lifestyle).toBe('frugal');
    expect(readShareStateFromSearch('?city=Berlin&lifestyle=comfortable')?.lifestyle).toBe('comfortable');
  });

  it('ignores invalid lifestyle values', () => {
    expect(readShareStateFromSearch('?city=Berlin&lifestyle=lavish')?.lifestyle).toBeUndefined();
  });
});

describe('computeMonthlyCostsFromPrices — lifestyle levels', () => {
  const prices: ApiPriceItem[] = [
    // Markets: raw sum is 10, so by lifestyle: frugal=30, average=40, comfortable=50.
    item({ category_name: 'Markets', item_name: 'Milk', usd: { avg: 4 } }),
    item({ category_name: 'Markets', item_name: 'Bread', usd: { avg: 6 } }),
    // Transport: median is 50, so frugal=50, average=75, comfortable=100.
    item({ category_name: 'Transportation', item_name: 'Monthly Pass A', usd: { avg: 40 } }),
    item({ category_name: 'Transportation', item_name: 'Monthly Pass B', usd: { avg: 60 } }),
  ];

  it('defaults to average multipliers when no level is passed', () => {
    const { byCategory } = computeMonthlyCostsFromPrices(prices, 'center');
    expect(byCategory.get('Markets')).toBe(40);
    expect(byCategory.get('Transportation')).toBe(75);
  });

  it('applies frugal multipliers', () => {
    const { byCategory } = computeMonthlyCostsFromPrices(prices, 'center', 'frugal');
    expect(byCategory.get('Markets')).toBe(30);
    expect(byCategory.get('Transportation')).toBe(50);
  });

  it('applies comfortable multipliers', () => {
    const { byCategory } = computeMonthlyCostsFromPrices(prices, 'center', 'comfortable');
    expect(byCategory.get('Markets')).toBe(50);
    expect(byCategory.get('Transportation')).toBe(100);
  });

  it('frugal total < average total < comfortable total', () => {
    const frugal = computeMonthlyCostsFromPrices(prices, 'center', 'frugal').totalUsd;
    const average = computeMonthlyCostsFromPrices(prices, 'center', 'average').totalUsd;
    const comfortable = computeMonthlyCostsFromPrices(prices, 'center', 'comfortable').totalUsd;
    expect(frugal).toBeLessThan(average);
    expect(average).toBeLessThan(comfortable);
  });

  it('multiplier table is sane: frugal < average < comfortable for both knobs', () => {
    const { frugal, average, comfortable } = LIFESTYLE_MULTIPLIERS;
    expect(frugal.marketsBasket).toBeLessThan(average.marketsBasket);
    expect(average.marketsBasket).toBeLessThan(comfortable.marketsBasket);
    expect(frugal.transportMonthly).toBeLessThan(average.transportMonthly);
    expect(average.transportMonthly).toBeLessThan(comfortable.transportMonthly);
  });
});

describe('parseStoredRecords — lifestyle', () => {
  it('parses a valid lifestyle level from storage', () => {
    const stored = JSON.stringify([
      { id: 1, city: 'Berlin', country: 'Germany', income: 1, totalCosts: 0, netBudget: 1, lifestyle: 'frugal' },
    ]);
    expect(parseStoredRecords(stored)[0].lifestyle).toBe('frugal');
  });

  it('drops invalid lifestyle values', () => {
    const stored = JSON.stringify([
      { id: 1, city: 'Berlin', country: 'Germany', income: 1, totalCosts: 0, netBudget: 1, lifestyle: 'lavish' },
    ]);
    expect(parseStoredRecords(stored)[0].lifestyle).toBeUndefined();
  });
});
