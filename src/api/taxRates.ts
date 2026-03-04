/**
 * API-Ninjas Income Tax Calculator
 * @see https://api-ninjas.com/api/incometaxcalculator
 */

const API_NINJAS_BASE = 'https://api.api-ninjas.com';
const API_NINJAS_KEY =
  import.meta.env.VITE_API_NINJAS_KEY ?? 'ppPq0UlJLMKjLevmfW2uS8lVXfbuFMcs5WlvBVDu';

export type IncomeTaxCalculatorResponse = {
  country?: string;
  region?: string;
  income?: number;
  taxable_income?: number;
  deductions?: number;
  credits?: number;
  federal_effective_rate?: number;
  federal_taxes_owed?: number;
  fica_social_security?: number;
  fica_medicare?: number;
  fica_total?: number;
  region_effective_rate?: number;
  region_taxes_owed?: number;
  total_taxes_owed?: number;
  income_after_tax?: number;
  total_effective_tax_rate?: number;
  [key: string]: unknown;
};

export type FilingStatus = 'single' | 'married' | 'married_separate' | 'head_of_household';

/**
 * Calculates income tax for a given country, region, and income.
 * Supports US (with state) and Canada (with province).
 */
export async function fetchIncomeTax(
  countryCode: string,
  region: string,
  income: number,
  filingStatus: FilingStatus,
  taxYear?: number,
): Promise<IncomeTaxCalculatorResponse> {
  const url = new URL(`${API_NINJAS_BASE}/v1/incometaxcalculator`);
  url.searchParams.set('country', countryCode.toUpperCase());
  url.searchParams.set('region', region.toUpperCase());
  url.searchParams.set('income', String(Math.max(0, income)));
  if (countryCode.toUpperCase() === 'US') {
    url.searchParams.set('filing_status', filingStatus);
  }
  if (taxYear != null && Number.isFinite(taxYear)) {
    url.searchParams.set('tax_year', String(taxYear));
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'X-Api-Key': API_NINJAS_KEY },
  });

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    throw new Error('Tax API returned HTML instead of JSON.');
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tax API error (${response.status}): ${text || response.statusText}`);
  }

  let data: IncomeTaxCalculatorResponse;
  try {
    data = (await response.json()) as IncomeTaxCalculatorResponse;
  } catch {
    throw new Error('Tax API returned invalid JSON.');
  }

  return data;
}

/** Map country name (from cities API) to 2-letter code for API-Ninjas */
export function countryNameToCode(countryName: string): string | null {
  const n = countryName.trim().toLowerCase();
  if (n.includes('united states') || n === 'usa' || n === 'us') return 'US';
  if (n.includes('canada') || n === 'ca') return 'CA';
  return null;
}
