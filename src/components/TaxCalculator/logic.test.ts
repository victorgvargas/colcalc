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

  it('passes the result currency through when live rates know it', () => {
    const handoff = buildCalculatorHandoff({
      monthlyNet: 1000,
      resultCurrency: 'CZK',
      usdRates: { czk: 22, eur: 0.9 },
      city: 'Prague',
      country: 'Czech Republic',
    });
    expect(handoff?.currency).toBe('CZK');
    expect(handoff?.currencyConverted).toBe(false);
    expect(handoff?.income).toBe(1000);
  });

  it('returns null when live rates know the EUR target but not the source currency', () => {
    // Without a USD→source rate, we can't convert to any other currency.
    const handoff = buildCalculatorHandoff({
      monthlyNet: 1000,
      resultCurrency: 'CZK',
      usdRates: { eur: 0.9 },
      city: 'Prague',
      country: 'Czech Republic',
    });
    expect(handoff).toBeNull();
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
