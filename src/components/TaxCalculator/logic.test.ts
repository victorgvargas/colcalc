import { describe, expect, it } from 'vitest';
import { buildCalculatorHandoff } from './index';

describe('buildCalculatorHandoff', () => {
  it('passes through a currency the calculator supports without converting', () => {
    const handoff = buildCalculatorHandoff({
      monthlyNet: 4000,
      resultCurrency: 'EUR',
      usdRates: { eur: 0.9 },
      city: 'Berlin',
      country: 'Germany',
    });
    expect(handoff).toEqual({
      income: 4000,
      currency: 'EUR',
      city: 'Berlin',
      country: 'Germany',
      currencyConverted: false,
    });
  });

  it('rounds to two decimals when converting currencies', () => {
    const handoff = buildCalculatorHandoff({
      monthlyNet: 1000,
      // rel.tax returns a currency the calculator doesn't list directly.
      resultCurrency: 'CZK',
      // 1 USD = 22 CZK, 1 USD = 0.9 EUR  => 1 CZK = 0.9 / 22 EUR ≈ 0.04091 EUR
      usdRates: { czk: 22, eur: 0.9 },
      city: 'Prague',
      country: 'Czech Republic',
    });
    expect(handoff?.currency).toBe('EUR');
    expect(handoff?.currencyConverted).toBe(true);
    expect(handoff?.income).toBeCloseTo(40.91, 2);
  });

  it('trims empty city/country to undefined', () => {
    const handoff = buildCalculatorHandoff({
      monthlyNet: 100,
      resultCurrency: 'EUR',
      usdRates: null,
      city: '   ',
      country: '',
    });
    expect(handoff?.city).toBeUndefined();
    expect(handoff?.country).toBeUndefined();
  });

  it('returns null when monthlyNet is not a positive finite number', () => {
    expect(
      buildCalculatorHandoff({
        monthlyNet: 0,
        resultCurrency: 'EUR',
        usdRates: null,
        city: 'Berlin',
        country: 'Germany',
      }),
    ).toBeNull();

    expect(
      buildCalculatorHandoff({
        monthlyNet: Number.NaN,
        resultCurrency: 'EUR',
        usdRates: null,
        city: 'Berlin',
        country: 'Germany',
      }),
    ).toBeNull();
  });

  it('returns null when conversion rates are unavailable for an unsupported currency', () => {
    const handoff = buildCalculatorHandoff({
      monthlyNet: 1000,
      resultCurrency: 'CZK',
      usdRates: null,
      city: 'Prague',
      country: 'Czech Republic',
    });
    expect(handoff).toBeNull();
  });
});
