import type { ApiPriceItem } from '../../api/costOfLiving';

export const CURRENCIES = {
  USD: { name: 'US Dollar', symbol: 'USD', rateToUsd: 1 },
  EUR: { name: 'Euro', symbol: 'EUR', rateToUsd: 1.08 },
  GBP: { name: 'British Pound', symbol: 'GBP', rateToUsd: 1.27 },
  JPY: { name: 'Japanese Yen', symbol: 'JPY', rateToUsd: 0.0067 },
  CHF: { name: 'Swiss Franc', symbol: 'CHF', rateToUsd: 1.12 },
  CAD: { name: 'Canadian Dollar', symbol: 'CAD', rateToUsd: 0.74 },
  AUD: { name: 'Australian Dollar', symbol: 'AUD', rateToUsd: 0.65 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const RECORDS_STORAGE_KEY = 'colcalc_records';

export type RentLocation = 'center' | 'outskirts';

export type LifestyleLevel = 'frugal' | 'average' | 'comfortable';

/**
 * Lifestyle multipliers tune the heuristics that turn individual price points
 * into monthly spend. "Average" is the historical baseline; "frugal" and
 * "comfortable" scale markets and transport up/down. All other categories
 * (rent, utilities, internet, childcare) are unaffected.
 */
export const LIFESTYLE_MULTIPLIERS: Record<
  LifestyleLevel,
  { marketsBasket: number; transportMonthly: number }
> = {
  frugal: { marketsBasket: 3, transportMonthly: 1.0 },
  average: { marketsBasket: 4, transportMonthly: 1.5 },
  comfortable: { marketsBasket: 5, transportMonthly: 2.0 },
};

export type CalculationRecord = {
  id: number;
  city: string;
  country: string;
  income: number;
  numberOfKids: number;
  totalCosts: number;
  netBudget: number;
  currency: CurrencyCode;
  /** For recalculating when editing numberOfKids */
  baseCostsInRecordCurrency?: number;
  childcarePerChildInRecordCurrency?: number;
  /** Per-category costs in record currency for pie chart */
  costBreakdown?: { name: string; value: number }[];
  /** Effective income-tax rate applied to `income` (0..1). Undefined = untaxed. */
  taxRate?: number;
  /** Lifestyle level used when the record was computed. */
  lifestyle?: LifestyleLevel;
};

export type PrefillState = {
  income?: number;
  currency?: string;
  city?: string;
  country?: string;
  numberOfKids?: number;
  rentLocation?: RentLocation;
  applyTax?: boolean;
  lifestyle?: LifestyleLevel;
};

const PRICE_KEYS = [
  'avg',
  'avg_price',
  'average_price',
  'price',
  'value',
  'usd_price',
  'amount',
  'min',
  'max',
] as const;

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

/** Categories that represent monthly recurring expenses (include in total). */
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

/** Categories/items to exclude (one-time, per-unit, or not monthly). */
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

/** Per-unit / one-off item patterns: exclude these from Transport/Childcare. */
const PER_UNIT_OR_ONE_OFF = [
  'per liter',
  'per km',
  'per mile',
  'one-way',
  'one way',
  '1 liter',
  '1 km',
  'gasoline',
  'gas ',
  'tire',
  'taxi ',
  'single ticket',
];

/** Plausible monthly range in USD: exclude car prices, annual fees, per-trip. */
const TRANSPORT_MONTHLY_CAP_USD = 600;
const CHILDCARE_MONTHLY_CAP_USD = 4000;

function looksLikeMonthlyItem(p: ApiPriceItem): boolean {
  const item = ((p.item_name ?? p.item ?? '') as string).toLowerCase();
  const cat = ((p.category_name ?? p.category ?? '') as string).toLowerCase();
  const combined = `${cat} ${item}`;
  for (const ex of PER_UNIT_OR_ONE_OFF) {
    if (combined.includes(ex)) return false;
  }
  return true;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/**
 * Compute monthly cost from prices: only include recurring categories.
 * Rent: average of rent items in the chosen location bucket.
 * Transport/Childcare: median of items in plausible monthly range (avoids car
 * price, annual, per-trip). Utilities/Internet/Mobile: sum.
 */
export function computeMonthlyCostsFromPrices(
  priceItems: ApiPriceItem[],
  rentLocation: RentLocation = 'center',
  lifestyle: LifestyleLevel = 'average',
): { totalUsd: number; byCategory: Map<string, number> } {
  const { marketsBasket, transportMonthly } = LIFESTYLE_MULTIPLIERS[lifestyle];
  const sumByCategory = new Map<string, number>();
  const listByCategory = new Map<string, number[]>();
  const rentCenter: number[] = [];
  const rentOutskirts: number[] = [];
  const rentGeneric: number[] = [];

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
      const itemText = ((p.item_name ?? p.item ?? category) as string).toLowerCase();
      const isCenterRent =
        /city centre|city center|centre|center/.test(itemText) &&
        !/outside|out of centre|out of center/.test(itemText);
      const isOutskirtsRent =
        /outside of centre|outside centre|outside of center|outside center|out of centre|out of center/.test(
          itemText,
        );
      if (isCenterRent) {
        rentCenter.push(value);
      } else if (isOutskirtsRent) {
        rentOutskirts.push(value);
      } else {
        rentGeneric.push(value);
      }
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
      if (cat === 'Transportation') {
        const base = median(list);
        const val = base * transportMonthly;
        byCategory.set('Transportation', (byCategory.get('Transportation') ?? 0) + val);
      } else if (cat === 'MarketsRaw') {
        const rawSum = list.reduce((a, b) => a + b, 0);
        const monthlyMarkets = rawSum * marketsBasket;
        byCategory.set('Markets', (byCategory.get('Markets') ?? 0) + monthlyMarkets);
      } else {
        const val = median(list);
        byCategory.set(cat, (byCategory.get(cat) ?? 0) + val);
      }
    }
  }

  let chosenRentList: number[] = [];
  if (rentLocation === 'center') {
    if (rentCenter.length) chosenRentList = rentCenter;
    else if (rentGeneric.length) chosenRentList = rentGeneric;
    else chosenRentList = rentOutskirts;
  } else {
    if (rentOutskirts.length) chosenRentList = rentOutskirts;
    else if (rentGeneric.length) chosenRentList = rentGeneric;
    else chosenRentList = rentCenter;
  }

  if (chosenRentList.length) {
    const avgRent = chosenRentList.reduce((a, b) => a + b, 0) / chosenRentList.length;
    byCategory.set('Rent', (byCategory.get('Rent') ?? 0) + avgRent);
  }

  const totalUsd = Array.from(byCategory.values()).reduce((a, b) => a + b, 0);
  return { totalUsd, byCategory };
}

export function parseStoredRecords(raw: string | null): CalculationRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((r) => {
        const rec = r as Record<string, unknown>;
        const id = typeof rec.id === 'number' ? rec.id : Date.now() + Math.random();
        const numberOfKids = typeof rec.numberOfKids === 'number' ? rec.numberOfKids : 0;
        return {
          id,
          city: typeof rec.city === 'string' ? rec.city : '',
          country: typeof rec.country === 'string' ? rec.country : '',
          income: typeof rec.income === 'number' ? rec.income : 0,
          numberOfKids,
          totalCosts: typeof rec.totalCosts === 'number' ? rec.totalCosts : 0,
          netBudget: typeof rec.netBudget === 'number' ? rec.netBudget : 0,
          currency: (typeof rec.currency === 'string' && rec.currency in CURRENCIES
            ? rec.currency
            : 'EUR') as CurrencyCode,
          baseCostsInRecordCurrency:
            typeof rec.baseCostsInRecordCurrency === 'number'
              ? rec.baseCostsInRecordCurrency
              : undefined,
          childcarePerChildInRecordCurrency:
            typeof rec.childcarePerChildInRecordCurrency === 'number'
              ? rec.childcarePerChildInRecordCurrency
              : undefined,
          costBreakdown: Array.isArray(rec.costBreakdown)
            ? (rec.costBreakdown as { name: string; value: number }[]).filter(
                (x) => x && typeof x.name === 'string' && typeof x.value === 'number',
              )
            : undefined,
          taxRate:
            typeof rec.taxRate === 'number' && Number.isFinite(rec.taxRate)
              ? Math.max(0, Math.min(1, rec.taxRate))
              : undefined,
          lifestyle: (rec.lifestyle === 'frugal' ||
          rec.lifestyle === 'average' ||
          rec.lifestyle === 'comfortable'
            ? rec.lifestyle
            : undefined) as LifestyleLevel | undefined,
        };
      })
      .filter((r) => r.city && r.country);
  } catch {
    return [];
  }
}

const SHARE_PARAM_KEYS = [
  'income',
  'currency',
  'city',
  'country',
  'kids',
  'rent',
  'tax',
  'lifestyle',
] as const;

export function readShareStateFromSearch(search: string): PrefillState | null {
  if (!search) return null;
  const params = new URLSearchParams(search);
  const hasAny = SHARE_PARAM_KEYS.some((k) => params.has(k));
  if (!hasAny) return null;

  const state: PrefillState = {};
  const income = params.get('income');
  if (income != null) {
    const n = Number(income);
    if (Number.isFinite(n) && n >= 0) state.income = n;
  }
  const currency = params.get('currency');
  if (currency && currency in CURRENCIES) state.currency = currency;
  const city = params.get('city');
  if (city) state.city = city;
  const country = params.get('country');
  if (country) state.country = country;
  const kids = params.get('kids');
  if (kids != null) {
    const n = parseInt(kids, 10);
    if (Number.isFinite(n) && n >= 0) state.numberOfKids = n;
  }
  const rent = params.get('rent');
  if (rent === 'center' || rent === 'outskirts') state.rentLocation = rent;
  const tax = params.get('tax');
  if (tax === '1' || tax === 'true') state.applyTax = true;
  const lifestyle = params.get('lifestyle');
  if (lifestyle === 'frugal' || lifestyle === 'average' || lifestyle === 'comfortable') {
    state.lifestyle = lifestyle;
  }

  return state;
}

export function toDisplayCurrency(value: number, fromCurrency: CurrencyCode): number {
  return (value * CURRENCIES[fromCurrency].rateToUsd) / CURRENCIES.EUR.rateToUsd;
}

export function getRecordIncomeDisplay(r: CalculationRecord): number {
  return typeof r.taxRate === 'number' ? r.income * (1 - r.taxRate) : r.income;
}
