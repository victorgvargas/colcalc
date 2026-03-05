export type UsdRatesMap = Record<string, number>;

const EXCHANGE_API_BASE =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1';

let usdRatesPromise: Promise<UsdRatesMap> | null = null;

export async function getUsdRates(): Promise<UsdRatesMap> {
  if (!usdRatesPromise) {
    usdRatesPromise = fetch(`${EXCHANGE_API_BASE}/currencies/usd.min.json`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch USD rates: ${res.status}`);
        }
        return res.json() as Promise<unknown>;
      })
      .then((data) => {
        if (
          data &&
          typeof data === 'object' &&
          'usd' in data &&
          data.usd &&
          typeof (data as { usd: unknown }).usd === 'object'
        ) {
          return (data as { usd: UsdRatesMap }).usd;
        }
        return {};
      })
      .catch((err) => {
        // Allow retry on next call
        usdRatesPromise = null;
        throw err;
      });
  }
  return usdRatesPromise;
}

export function getUsdToCurrencyRate(
  usdRates: UsdRatesMap | null,
  currencyCode: string,
  fallbackRate: number,
): number {
  const code = currencyCode.toLowerCase();
  const rate = usdRates?.[code];
  if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
    return rate;
  }
  return fallbackRate;
}

