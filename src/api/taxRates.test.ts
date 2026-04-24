import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { countryNameToCode, type RelTaxCountry } from './taxRates';

const sampleCountries: RelTaxCountry[] = [
  { code: 'de', name: 'Germany', currency: 'EUR', taxYear: 2026 },
  { code: 'fr', name: 'France', currency: 'EUR', taxYear: 2026 },
  { code: 'us', name: 'United States', currency: 'USD', taxYear: 2026 },
  { code: 'gb', name: 'United Kingdom', currency: 'GBP', taxYear: 2026 },
  { code: 'cz', name: 'Czech Republic', currency: 'CZK', taxYear: 2026 },
  { code: 'kr', name: 'Korea', currency: 'KRW', taxYear: 2026 },
];

describe('countryNameToCode', () => {
  it('matches an exact country name case-insensitively', () => {
    expect(countryNameToCode('Germany', sampleCountries)).toBe('de');
    expect(countryNameToCode('germany', sampleCountries)).toBe('de');
  });

  it('resolves common aliases', () => {
    expect(countryNameToCode('USA', sampleCountries)).toBe('us');
    expect(countryNameToCode('United States of America', sampleCountries)).toBe('us');
    expect(countryNameToCode('UK', sampleCountries)).toBe('gb');
    expect(countryNameToCode('Great Britain', sampleCountries)).toBe('gb');
    expect(countryNameToCode('Britain', sampleCountries)).toBe('gb');
    expect(countryNameToCode('South Korea', sampleCountries)).toBe('kr');
    expect(countryNameToCode('Czechia', sampleCountries)).toBe('cz');
  });

  it('returns null for unknown names', () => {
    expect(countryNameToCode('Atlantis', sampleCountries)).toBeNull();
  });

  it('returns null for empty/whitespace input', () => {
    expect(countryNameToCode('', sampleCountries)).toBeNull();
    expect(countryNameToCode('   ', sampleCountries)).toBeNull();
  });

  it('trims whitespace before matching', () => {
    expect(countryNameToCode('  Germany  ', sampleCountries)).toBe('de');
  });
});

describe('fetchTaxCountries + fetchIncomeTax', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sorts countries alphabetically and caches the promise', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        countries: [
          { code: 'fr', name: 'France', currency: 'EUR', taxYear: 2026 },
          { code: 'de', name: 'Germany', currency: 'EUR', taxYear: 2026 },
          { code: 'au', name: 'Australia', currency: 'AUD', taxYear: 2026 },
        ],
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const mod = await import('./taxRates');
    const first = await mod.fetchTaxCountries();
    expect(first.map((c) => c.code)).toEqual(['au', 'fr', 'de']);
    const second = await mod.fetchTaxCountries();
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws and invalidates the cache on failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ countries: [{ code: 'de', name: 'Germany', currency: 'EUR', taxYear: 2026 }] }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const mod = await import('./taxRates');
    await expect(mod.fetchTaxCountries()).rejects.toThrow(/500/);
    const retry = await mod.fetchTaxCountries();
    expect(retry).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fetchIncomeTax encodes income and lowercases country code', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ country: 'DE', currency: 'EUR', taxYear: 2026 }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const mod = await import('./taxRates');
    await mod.fetchIncomeTax('DE', 50000);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/calculate/de');
    expect(url).toContain('income=50000');
  });

  it('fetchIncomeTax clamps negative income to zero', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const mod = await import('./taxRates');
    await mod.fetchIncomeTax('de', -500);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('income=0');
  });

  it('fetchIncomeTax surfaces API error messages', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Unsupported country' }),
    }) as unknown as typeof fetch;

    const mod = await import('./taxRates');
    await expect(mod.fetchIncomeTax('de', 1000)).rejects.toThrow(
      'Unsupported country',
    );
  });

  it('fetchIncomeTax throws a generic error when body has no error field', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('bad json');
      },
    }) as unknown as typeof fetch;

    const mod = await import('./taxRates');
    await expect(mod.fetchIncomeTax('de', 1000)).rejects.toThrow(/502/);
  });
});
