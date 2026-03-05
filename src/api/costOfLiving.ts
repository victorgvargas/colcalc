export const API_BASE = 'https://cost-of-living-and-prices.p.rapidapi.com';
export const API_HEADERS = {
  'x-rapidapi-key': 'bf8010588dmsh35bf3ec00a6a414p1d2bb4jsn76cf746787c2',
  'x-rapidapi-host': 'cost-of-living-and-prices.p.rapidapi.com',
} as const;

export type ApiPriceItem = {
  category_name?: string;
  category?: string;
  item_name?: string;
  item?: string;
  avg?: number;
  avg_price?: number;
  average_price?: number;
  min?: number;
  max?: number;
  price?: number;
  value?: number;
  usd_price?: number;
  [key: string]: unknown;
};

const PRICE_KEYS = [
  'avg', 'avg_price', 'average_price', 'price', 'value', 'usd_price', 'amount', 'min', 'max',
] as const;

export type ApiPricesResponse = {
  city_id?: number;
  city_name?: string;
  country_name?: string;
  exchange_rate?: Record<string, number>;
  prices?: ApiPriceItem[];
  error?: string | null;
  [key: string]: unknown;
};

export type CityOption = {
  cityName: string;
  countryName: string;
  cityId?: number;
};

function getPriceFromItem(p: ApiPriceItem): number {
  for (const key of PRICE_KEYS) {
    const v = p[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
    if (typeof v === 'string') {
      const n = parseFloat(v);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return 0;
}

function getCategoryFromItem(p: ApiPriceItem): string {
  const name = (p.category_name ?? p.category ?? p.item_name ?? p.item ?? 'Other') as string;
  return name || 'Other';
}

const MONTHLY_CATEGORY_PATTERNS = [
  'rent',
  'utilities',
  'transport',
  'internet',
  'mobile',
  'phone',
  'childcare',
  'markets',
] as const;

const EXCLUDE_PATTERNS = [
  'buy apartment',
  'price per square',
  'price per sq',
  'restaurants',
  'clothing',
  'sports',
  'cinema',
  'one-time',
  'purchase',
] as const;

function isMonthlyRecurringCategory(p: ApiPriceItem): boolean {
  const cat = ((p.category_name ?? p.category ?? '') as string).toLowerCase();
  const item = ((p.item_name ?? p.item ?? '') as string).toLowerCase();
  const combined = `${cat} ${item}`;
  for (const ex of EXCLUDE_PATTERNS) {
    if (combined.includes(ex)) return false;
  }
  for (const pattern of MONTHLY_CATEGORY_PATTERNS) {
    if (cat.includes(pattern) || item.includes(pattern)) return true;
  }
  if (/rent|1 bedroom|3 bedroom|apartment.*(monthly|rent)/i.test(combined)) return true;
  return false;
}

const PER_UNIT_OR_ONE_OFF = [
  'per liter', 'per km', 'per mile', 'one-way', 'one way', '1 liter', '1 km',
  'gasoline', 'gas ', 'tire', 'taxi ', 'single ticket',
];

const TRANSPORT_MONTHLY_CAP_USD = 600;
const CHILDCARE_MONTHLY_CAP_USD = 4000;

// Heuristic multipliers to turn unit prices into a more realistic monthly spend.
const MARKETS_BASKET_MULTIPLIER = 4;
const TRANSPORT_MONTHLY_MULTIPLIER = 1.5;

function looksLikeMonthlyItem(p: ApiPriceItem): boolean {
  const item = ((p.item_name ?? p.item ?? '') as string).toLowerCase();
  const cat = ((p.category_name ?? p.category ?? '') as string).toLowerCase();
  const combined = `${cat} ${item}`;
  for (const ex of PER_UNIT_OR_ONE_OFF) {
    if (combined.includes(ex)) return false;
  }
  return true;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export function computeMonthlyCostsFromPrices(
  priceItems: ApiPriceItem[],
): { totalUsd: number; byCategory: Map<string, number> } {
  const sumByCategory = new Map<string, number>();
  const listByCategory = new Map<string, number[]>();

  for (const p of priceItems) {
    const category = getCategoryFromItem(p);
    const value = getPriceFromItem(p);
    if (!value || !Number.isFinite(value)) continue;

    const catLower = category.toLowerCase();
    const isRent =
      catLower.includes('rent') ||
      /apartment|1 bedroom|3 bedroom|1 bed|3 bed/i.test(catLower);
    const isTransport = catLower.includes('transport');
    const isChildcare = catLower.includes('childcare');
    const isMarkets = catLower.includes('markets');

    if (!isMonthlyRecurringCategory(p)) continue;

    if (isRent) {
      const list = listByCategory.get('Rent') ?? [];
      list.push(value);
      listByCategory.set('Rent', list);
    } else if (isMarkets) {
      const list = listByCategory.get('MarketsRaw') ?? [];
      list.push(value);
      listByCategory.set('MarketsRaw', list);
    } else if (isTransport) {
      if (!looksLikeMonthlyItem(p)) continue;
      if (value > TRANSPORT_MONTHLY_CAP_USD) continue;
      const list = listByCategory.get('Transportation') ?? [];
      list.push(value);
      listByCategory.set('Transportation', list);
    } else if (isChildcare) {
      if (!looksLikeMonthlyItem(p)) continue;
      if (value > CHILDCARE_MONTHLY_CAP_USD) continue;
      const list = listByCategory.get('Childcare') ?? [];
      list.push(value);
      listByCategory.set('Childcare', list);
    } else {
      sumByCategory.set(category, (sumByCategory.get(category) ?? 0) + value);
    }
  }

  const byCategory = new Map<string, number>(sumByCategory);
  for (const [cat, list] of listByCategory) {
    if (list.length > 0) {
      if (cat === 'Rent') {
        const avgRent = list.reduce((a, b) => a + b, 0) / list.length;
        byCategory.set('Rent', (byCategory.get('Rent') ?? 0) + avgRent);
      } else if (cat === 'Transportation') {
        const base = median(list);
        const val = base * TRANSPORT_MONTHLY_MULTIPLIER;
        byCategory.set('Transportation', (byCategory.get('Transportation') ?? 0) + val);
      } else if (cat === 'MarketsRaw') {
        const rawSum = list.reduce((a, b) => a + b, 0);
        const monthlyMarkets = rawSum * MARKETS_BASKET_MULTIPLIER;
        byCategory.set('Markets', (byCategory.get('Markets') ?? 0) + monthlyMarkets);
      } else {
        const val = median(list);
        byCategory.set(cat, (byCategory.get(cat) ?? 0) + val);
      }
    }
  }

  const totalUsd = Array.from(byCategory.values()).reduce((a, b) => a + b, 0);
  return { totalUsd, byCategory };
}

export async function fetchCities(): Promise<CityOption[]> {
  const res = await fetch(`${API_BASE}/cities`, { method: 'GET', headers: API_HEADERS });
  if (!res.ok) throw new Error(`Cities fetch failed: ${res.status}`);
  const data: unknown = await res.json();
  const options: CityOption[] = [];
  const raw = Array.isArray(data)
    ? data
    : (data && typeof data === 'object' && 'cities' in data
        ? (data as { cities: unknown }).cities
        : data);
  const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : []);
  for (const item of list) {
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const cityName = (o.city_name ?? o.cityName ?? o.name ?? o.city ?? '') as string;
      const countryName = (o.country_name ?? o.countryName ?? o.country ?? '') as string;
      if (cityName && countryName) {
        options.push({
          cityName: String(cityName).trim(),
          countryName: String(countryName).trim(),
          cityId: typeof o.city_id === 'number' ? o.city_id : undefined,
        });
      }
    }
  }
  return options;
}

export type CityPricesResult = {
  prices: ApiPriceItem[];
  exchangeRate: Record<string, number> | null;
};

export async function fetchPricesForCity(
  cityName: string,
  countryName: string,
): Promise<CityPricesResult> {
  const url = new URL(`${API_BASE}/prices`);
  url.searchParams.set('city_name', cityName.trim());
  url.searchParams.set('country_name', countryName.trim());
  const response = await fetch(url.toString(), { method: 'GET', headers: API_HEADERS });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  const data = (await response.json()) as ApiPricesResponse;
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : 'API returned an error.');
  }
  let fetchedPrices: ApiPriceItem[] = [];
  if (Array.isArray(data.prices)) {
    fetchedPrices = data.prices;
  } else if (data.prices && typeof data.prices === 'object' && !Array.isArray(data.prices)) {
    const vals = Object.values(data.prices);
    fetchedPrices = vals.flat().filter(
      (x): x is ApiPriceItem => x != null && typeof x === 'object',
    );
  }

  const exchangeRate =
    data.exchange_rate && typeof data.exchange_rate === 'object'
      ? data.exchange_rate
      : null;

  return { prices: fetchedPrices, exchangeRate };
}
