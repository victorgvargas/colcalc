export const MIN_CITIES = 2;
export const MAX_CITIES = 5;

export type CityEntry = { cityName: string; countryName: string };

/**
 * Read `?city1=Berlin&country1=Germany&city2=Paris&country2=France&...` from
 * the URL. Keys are 1-indexed and capped at MAX_CITIES. Entries without a
 * cityName are dropped. Returns `null` if no recognized params are present.
 */
export function readComparisonEntriesFromSearch(search: string): CityEntry[] | null {
  if (!search) return null;
  const params = new URLSearchParams(search);
  const entries: CityEntry[] = [];
  for (let i = 1; i <= MAX_CITIES; i += 1) {
    const cityName = params.get(`city${i}`)?.trim() ?? '';
    const countryName = params.get(`country${i}`)?.trim() ?? '';
    if (!cityName) continue;
    entries.push({ cityName, countryName });
  }
  return entries.length > 0 ? entries : null;
}
