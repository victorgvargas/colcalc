import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getUsdRates, getUsdToCurrencyRate } from './exchangeRates';

describe('getUsdToCurrencyRate', () => {
  it('returns the mapped rate when present and positive', () => {
    expect(getUsdToCurrencyRate({ eur: 0.9, gbp: 0.8 }, 'EUR', 1.5)).toBe(0.9);
  });

  it('lowercases the currency code before lookup', () => {
    expect(getUsdToCurrencyRate({ eur: 0.9 }, 'eur', 1.5)).toBe(0.9);
  });

  it('falls back when the rate is missing', () => {
    expect(getUsdToCurrencyRate({}, 'EUR', 1.23)).toBe(1.23);
  });

  it('falls back when the rate is not finite or zero', () => {
    expect(getUsdToCurrencyRate({ eur: 0 }, 'EUR', 1.5)).toBe(1.5);
    expect(getUsdToCurrencyRate({ eur: Number.NaN }, 'EUR', 1.5)).toBe(1.5);
    expect(getUsdToCurrencyRate({ eur: -1 }, 'EUR', 1.5)).toBe(1.5);
  });

  it('falls back when the rates map is null', () => {
    expect(getUsdToCurrencyRate(null, 'EUR', 1.5)).toBe(1.5);
  });
});

describe('getUsdRates', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    // Reset module cache so the in-module cached promise is cleared between tests.
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('resolves with the usd rates map on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ usd: { eur: 0.9, gbp: 0.8 } }),
    }) as unknown as typeof fetch;

    const mod = await import('./exchangeRates');
    const rates = await mod.getUsdRates();
    expect(rates).toEqual({ eur: 0.9, gbp: 0.8 });
  });

  it('returns empty object if payload does not include a usd field', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ other: {} }),
    }) as unknown as typeof fetch;

    const mod = await import('./exchangeRates');
    const rates = await mod.getUsdRates();
    expect(rates).toEqual({});
  });

  it('throws and allows retry on non-ok response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ usd: { eur: 0.9 } }) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const mod = await import('./exchangeRates');
    await expect(mod.getUsdRates()).rejects.toThrow(/503/);
    // Retry should work because the module clears its cached promise on error.
    const rates = await mod.getUsdRates();
    expect(rates).toEqual({ eur: 0.9 });
  });

  it('caches the promise across calls on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ usd: { eur: 0.9 } }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const mod = await import('./exchangeRates');
    await mod.getUsdRates();
    await mod.getUsdRates();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// Ensure the top-level import of getUsdRates above is still used even though
// the describe block re-imports a fresh module per test.
void getUsdRates;
