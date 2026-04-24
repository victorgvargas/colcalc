/**
 * rel.tax — free income-tax calculator covering ~55 countries.
 * @see https://rel.tax/
 *
 * No auth, CORS-enabled. Country code is ISO 3166-1 alpha-2 (lowercase).
 * US calculation assumes self-employment (not W-2 payroll); surface that in the UI.
 */

const REL_TAX_BASE = 'https://rel.tax/v1';

export type RelTaxCountry = {
  code: string;
  name: string;
  currency: string;
  taxYear: number;
};

export type RelTaxCalculation = {
  country: string;
  currency: string;
  taxYear: number;
  input?: Record<string, unknown>;
  details?: Record<string, unknown>;
  monthly?: Record<string, number>;
  yearly?: {
    gross?: number;
    net?: number;
    incomeTax?: number;
    totalDeductions?: number;
    [key: string]: unknown;
  };
  rates?: {
    effectiveTaxRate?: number;
    [key: string]: unknown;
  };
};

let countriesPromise: Promise<RelTaxCountry[]> | null = null;

export async function fetchTaxCountries(): Promise<RelTaxCountry[]> {
  if (countriesPromise) return countriesPromise;
  countriesPromise = (async () => {
    const res = await fetch(`${REL_TAX_BASE}/countries`);
    if (!res.ok) throw new Error(`Countries fetch failed: ${res.status}`);
    const data = (await res.json()) as { countries?: RelTaxCountry[] };
    const list = Array.isArray(data.countries) ? [...data.countries] : [];
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  })().catch((err) => {
    countriesPromise = null;
    throw err;
  });
  return countriesPromise;
}

export async function fetchIncomeTax(
  countryCode: string,
  income: number,
): Promise<RelTaxCalculation> {
  const url = new URL(`${REL_TAX_BASE}/calculate/${countryCode.toLowerCase()}`);
  url.searchParams.set('income', String(Math.max(0, income)));

  const response = await fetch(url.toString(), { method: 'GET' });
  if (!response.ok) {
    let msg = `Tax API error (${response.status})`;
    try {
      const body = await response.json() as { error?: string };
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await response.json()) as RelTaxCalculation;
}

/** Map country name from the city dataset to a rel.tax ISO code. */
export function countryNameToCode(
  countryName: string,
  countries: RelTaxCountry[],
): string | null {
  const n = countryName.trim().toLowerCase();
  if (!n) return null;
  const exact = countries.find((c) => c.name.toLowerCase() === n);
  if (exact) return exact.code;
  // Common aliases from the cost-of-living dataset
  const aliases: Record<string, string> = {
    usa: 'us',
    'united states of america': 'us',
    uk: 'gb',
    britain: 'gb',
    'great britain': 'gb',
    'south korea': 'kr',
    'czech republic': 'cz',
    czechia: 'cz',
  };
  return aliases[n] ?? null;
}
