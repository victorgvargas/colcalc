const DATASET_URL = '/cost-of-living.json';

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
  usd?: {
    min?: number | string;
    max?: number | string;
    avg?: number | string;
    avg_price?: number | string;
    average_price?: number | string;
    price?: number | string;
    value?: number | string;
    [key: string]: unknown;
  };
  currency_code?: string;
  [key: string]: unknown;
};

const PRICE_KEYS = [
  'avg', 'avg_price', 'average_price', 'price', 'value', 'usd_price', 'amount', 'min', 'max',
] as const;

export type CityOption = {
  cityName: string;
  countryName: string;
};

type DatasetEntry = {
  city: string;
  country: string;
  prices: { category: string; item: string; usd: number }[];
};

type Dataset = {
  source?: string;
  generatedAt?: string;
  cityCount?: number;
  cities: DatasetEntry[];
};

function getPriceFromItem(p: ApiPriceItem): number {
  if (p.usd && typeof p.usd === 'object') {
    const usd = p.usd as Record<string, unknown>;
    for (const key of PRICE_KEYS) {
      const v = usd[key];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
      if (typeof v === 'string') {
        const n = parseFloat(v);
        if (Number.isFinite(n) && n >= 0) return n;
      }
    }
  }

  for (const key of PRICE_KEYS) {
    // Fallback to local-currency fields if USD values are missing
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

let datasetPromise: Promise<Dataset> | null = null;

function loadDataset(): Promise<Dataset> {
  if (datasetPromise) return datasetPromise;
  datasetPromise = fetch(DATASET_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status}`);
      return res.json() as Promise<Dataset>;
    })
    .catch((err) => {
      datasetPromise = null;
      throw err;
    });
  return datasetPromise;
}

function cityKey(cityName: string, countryName: string): string {
  return `${cityName.trim().toLowerCase()}|${countryName.trim().toLowerCase()}`;
}

export async function fetchCities(): Promise<CityOption[]> {
  const { cities } = await loadDataset();
  return cities.map((c) => ({ cityName: c.city, countryName: c.country }));
}

export type DatasetCity = {
  city: string;
  country: string;
  prices: { category: string; item: string; usd: number }[];
};

export async function fetchDatasetCities(): Promise<DatasetCity[]> {
  const { cities } = await loadDataset();
  return cities;
}

export type CityPricesResult = {
  prices: ApiPriceItem[];
  exchangeRate: Record<string, number> | null;
};

export async function fetchPricesForCity(
  cityName: string,
  countryName: string,
): Promise<CityPricesResult> {
  const { cities } = await loadDataset();
  const key = cityKey(cityName, countryName);
  const entry = cities.find(
    (c) => cityKey(c.city, c.country) === key,
  );
  if (!entry) {
    throw new Error(`No price data for ${cityName}, ${countryName}.`);
  }
  const prices: ApiPriceItem[] = entry.prices.map((p) => ({
    category_name: p.category,
    item_name: p.item,
    usd: { avg: p.usd },
  }));
  return { prices, exchangeRate: null };
}
