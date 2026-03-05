import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  SvgIcon,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  MenuItem,
} from '@mui/material';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { getUsdRates, getUsdToCurrencyRate } from '../../api/exchangeRates';

type ApiPriceItem = {
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

type ApiPricesResponse = {
  city_id?: number;
  city_name?: string;
  country_name?: string;
  exchange_rate?: Record<string, number>;
  prices?: ApiPriceItem[];
  error?: string | null;
  [key: string]: unknown;
};

type CityOption = {
  cityName: string;
  countryName: string;
  cityId?: number;
};

type RentLocation = 'center' | 'outskirts';

type CalculationRecord = {
  id: number;
  city: string;
  country: string;
  income: number;
  numberOfKids: number;
  totalCosts: number;
  netBudget: number;
  currency: keyof typeof CURRENCIES;
  /** For recalculating when editing numberOfKids */
  baseCostsInRecordCurrency?: number;
  childcarePerChildInRecordCurrency?: number;
  /** Per-category costs in record currency for pie chart */
  costBreakdown?: { name: string; value: number }[];
};

const RECORDS_STORAGE_KEY = 'colcalc_records';

function parseStoredRecords(raw: string | null): CalculationRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r) => {
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
        currency: (typeof rec.currency === 'string' && rec.currency in CURRENCIES ? rec.currency : 'EUR') as keyof typeof CURRENCIES,
        baseCostsInRecordCurrency: typeof rec.baseCostsInRecordCurrency === 'number' ? rec.baseCostsInRecordCurrency : undefined,
        childcarePerChildInRecordCurrency: typeof rec.childcarePerChildInRecordCurrency === 'number' ? rec.childcarePerChildInRecordCurrency : undefined,
        costBreakdown: Array.isArray(rec.costBreakdown)
          ? (rec.costBreakdown as { name: string; value: number }[]).filter(
              (x) => x && typeof x.name === 'string' && typeof x.value === 'number',
            )
          : undefined,
      };
    }).filter((r) => r.city && r.country);
  } catch {
    return [];
  }
}

type SortKey = 'city' | 'income' | 'totalCosts' | 'netBudget';
type SortDirection = 'asc' | 'desc';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AA46BE', '#FF6F91'];

function EditIconSvg() {
  return (
    <SvgIcon fontSize="small" sx={{ verticalAlign: 'middle' }}>
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.995.995 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </SvgIcon>
  );
}

function DeleteIconSvg() {
  return (
    <SvgIcon fontSize="small" sx={{ verticalAlign: 'middle' }}>
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </SvgIcon>
  );
}

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

/**
 * Compute monthly cost from prices: only include recurring categories.
 * Rent: average of rent items. Transport/Childcare: median of items in plausible monthly range (avoids car price, annual, per-trip).
 * Utilities, Internet, Mobile: sum.
 */
function computeMonthlyCostsFromPrices(
  priceItems: ApiPriceItem[],
  rentLocation: RentLocation = 'center',
): { totalUsd: number; byCategory: Map<string, number> } {
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

const API_BASE = 'https://cost-of-living-and-prices.p.rapidapi.com';
const API_HEADERS = {
  'x-rapidapi-key': 'bf8010588dmsh35bf3ec00a6a414p1d2bb4jsn76cf746787c2',
  'x-rapidapi-host': 'cost-of-living-and-prices.p.rapidapi.com',
};

const CURRENCIES = {
  USD: { name: 'US Dollar', symbol: 'USD', rateToUsd: 1 },
  EUR: { name: 'Euro', symbol: 'EUR', rateToUsd: 1.08 },
  GBP: { name: 'British Pound', symbol: 'GBP', rateToUsd: 1.27 },
  JPY: { name: 'Japanese Yen', symbol: 'JPY', rateToUsd: 0.0067 },
  CHF: { name: 'Swiss Franc', symbol: 'CHF', rateToUsd: 1.12 },
  CAD: { name: 'Canadian Dollar', symbol: 'CAD', rateToUsd: 0.74 },
  AUD: { name: 'Australian Dollar', symbol: 'AUD', rateToUsd: 0.65 },
} as const;

type CurrencyCode = keyof typeof CURRENCIES;

function toDisplayCurrency(value: number, fromCurrency: CurrencyCode): number {
  return (value * CURRENCIES[fromCurrency].rateToUsd) / CURRENCIES.EUR.rateToUsd;
}

const Calculator: React.FC = () => {
  const [income, setIncome] = useState<string>('');
  const [incomeCurrency, setIncomeCurrency] = useState<CurrencyCode>('EUR');
  const [city, setCity] = useState<string>('');
  const [country, setCountry] = useState<string>('');
  const [numberOfKids, setNumberOfKids] = useState<number>(0);
  const [rentLocation, setRentLocation] = useState<RentLocation>('center');

  const [allCities, setAllCities] = useState<CityOption[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const citiesLoadedRef = useRef(false);

  const [cityInputDebounced, setCityInputDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setCityInputDebounced(city), 300);
    return () => clearTimeout(t);
  }, [city]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prices, setPrices] = useState<ApiPriceItem[]>([]);
  const [usdRates, setUsdRates] = useState<Record<string, number> | null>(null);
  const [records, setRecords] = useState<CalculationRecord[]>(() =>
    typeof localStorage !== 'undefined'
      ? parseStoredRecords(localStorage.getItem(RECORDS_STORAGE_KEY))
      : [],
  );

  useEffect(() => {
    if (typeof localStorage !== 'undefined' && records.length >= 0) {
      localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
    }
  }, [records]);

  useEffect(() => {
    let cancelled = false;
    getUsdRates()
      .then((rates) => {
        if (!cancelled) setUsdRates(rates);
      })
      .catch(() => {
        if (!cancelled) setUsdRates(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [sortKey, setSortKey] = useState<SortKey>('city');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [citySearch, setCitySearch] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [editModalRecord, setEditModalRecord] = useState<CalculationRecord | null>(null);
  const [editIncome, setEditIncome] = useState('');
  const [editNumberOfKids, setEditNumberOfKids] = useState(0);

  const loadCities = useCallback(() => {
    if (citiesLoadedRef.current) return;
    citiesLoadedRef.current = true;
    setCitiesLoading(true);
    let cancelled = false;
    fetch(`${API_BASE}/cities`, { method: 'GET', headers: API_HEADERS })
      .then((res) => {
        if (!res.ok) throw new Error(`Cities fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (cancelled) return;
        const options: CityOption[] = [];
        const raw = Array.isArray(data) ? data : (data && typeof data === 'object' && 'cities' in data ? (data as { cities: unknown }).cities : data);
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
        setAllCities(options);
      })
      .catch(() => {
        if (!cancelled) {
          setAllCities([]);
          citiesLoadedRef.current = false;
        }
      })
      .finally(() => {
        if (!cancelled) setCitiesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredCityOptions = useMemo(() => {
    const q = cityInputDebounced.trim().toLowerCase();
    if (!q) return allCities;
    return allCities.filter((c) => c.cityName.toLowerCase().includes(q));
  }, [allCities, cityInputDebounced]);

  // Keep country in sync whenever city exactly matches a known option (click or Enter)
  useEffect(() => {
    const trimmed = city.trim();
    if (!trimmed) {
      setCountry('');
      return;
    }
    const found = allCities.find(
      (c) => c.cityName.toLowerCase() === trimmed.toLowerCase(),
    );
    setCountry(found ? found.countryName : '');
  }, [city, allCities]);

  const { totalUsd: rawTotalUsd, byCategory: rawByCategory } = useMemo(
    () => computeMonthlyCostsFromPrices(prices, rentLocation),
    [prices, rentLocation],
  );

  const { totalUsd: totalCostsUsd, byCategory: monthlyByCategory } = useMemo(() => {
    const childcarePerChildUsd = rawByCategory.get('Childcare') ?? 0;
    const kids = Math.max(0, numberOfKids);
    const childcareTotalUsd = childcarePerChildUsd * kids;
    const adjustedTotalUsd = rawTotalUsd - childcarePerChildUsd + childcareTotalUsd;
    const adjustedByCategory = new Map(rawByCategory);
    adjustedByCategory.set('Childcare', childcareTotalUsd);
    return { totalUsd: adjustedTotalUsd, byCategory: adjustedByCategory };
  }, [rawTotalUsd, rawByCategory, numberOfKids]);

  const getCurrencyPerUsd = useCallback(
    (code: CurrencyCode): number =>
      getUsdToCurrencyRate(
        usdRates,
        code,
        1 / CURRENCIES[code].rateToUsd,
      ),
    [usdRates],
  );

  const effectiveCurrencyPerUsd = getCurrencyPerUsd(incomeCurrency);

  const eurPerUsdForChart = getCurrencyPerUsd('EUR');
  const totalCostsInCurrency = totalCostsUsd * effectiveCurrencyPerUsd;
  const netBudget = useMemo(() => {
    const numericIncome = Number(income) || 0;
    return numericIncome - totalCostsInCurrency;
  }, [income, totalCostsInCurrency]);

  const chartData = useMemo(() => {
    if (!monthlyByCategory.size) return [];
    return Array.from(monthlyByCategory.entries())
      .map(([name, valueUsd]) => ({
        name,
        value: valueUsd * eurPerUsdForChart,
      }))
      .filter(({ value }) => value > 0);
  }, [monthlyByCategory, eurPerUsdForChart]);

  const selectedRecord = useMemo(
    () => (selectedRecordId != null ? records.find((r) => r.id === selectedRecordId) ?? null : null),
    [records, selectedRecordId],
  );

  const pieChartData = useMemo(() => {
    if (selectedRecord?.costBreakdown?.length) {
      const kids = selectedRecord.numberOfKids ?? 0;
      return selectedRecord.costBreakdown
        .filter((item) => {
          if (item.value <= 0) return false;
          if (kids === 0 && item.name === 'Childcare') return false;
          return true;
        })
        .map((item) => ({
          ...item,
          value: toDisplayCurrency(item.value, selectedRecord.currency),
        }));
    }
    return chartData;
  }, [selectedRecord, chartData]);

  const chartCurrency: CurrencyCode = 'EUR';

  const filteredAndSortedRecords = useMemo(() => {
    const search = citySearch.trim().toLowerCase();

    let data = records;
    if (search) {
      data = data.filter((r) => r.city.toLowerCase().includes(search));
    }

    const sorted = [...data].sort((a, b) => {
      const aVal =
        sortKey === 'city'
          ? a[sortKey]
          : toDisplayCurrency(a[sortKey] as number, a.currency);
      const bVal =
        sortKey === 'city'
          ? b[sortKey]
          : toDisplayCurrency(b[sortKey] as number, b.currency);

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        const cmp = aVal - bVal;
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      return 0;
    });

    return sorted;
  }, [records, citySearch, sortKey, sortDirection]);

  const paginatedRecords = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredAndSortedRecords.slice(start, start + rowsPerPage);
  }, [filteredAndSortedRecords, page, rowsPerPage]);

  const handleRequestSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setError(null);

    const numericIncome = Number(income);
    if (!numericIncome || !city.trim() || !country.trim()) {
      setError('Please provide a valid income, city, and country.');
      return;
    }

    setIsLoading(true);

    try {
      const url = new URL(`${API_BASE}/prices`);
      url.searchParams.set('city_name', city.trim());
      url.searchParams.set('country_name', country.trim());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: API_HEADERS,
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = (await response.json()) as ApiPricesResponse;
      if (data.error) {
        throw new Error(typeof data.error === 'string' ? data.error : 'API returned an error.');
      }
      let fetchedPrices: ApiPriceItem[] = [];
      if (Array.isArray(data.prices)) {
        fetchedPrices = data.prices;
      } else if (data.prices && typeof data.prices === 'object' && !Array.isArray(data.prices)) {
        const vals = Object.values(data.prices);
        fetchedPrices = vals.flat().filter((x): x is ApiPriceItem => x != null && typeof x === 'object');
      }

      setPrices(fetchedPrices);

      const { totalUsd: computedTotalCostsUsd, byCategory: computedByCategory } =
        computeMonthlyCostsFromPrices(fetchedPrices, rentLocation);
      const childcarePerChildUsd = computedByCategory.get('Childcare') ?? 0;
      const kids = Math.max(0, numberOfKids);
      const adjustedTotalUsd =
        computedTotalCostsUsd - childcarePerChildUsd + childcarePerChildUsd * kids;

      const currencyPerUsdRate = getCurrencyPerUsd(incomeCurrency);

      const totalCostsInRecordCurrency = adjustedTotalUsd * currencyPerUsdRate;
      const childcarePerChildInRecordCurrency = childcarePerChildUsd * currencyPerUsdRate;
      const baseCostsInRecordCurrency =
        totalCostsInRecordCurrency - kids * childcarePerChildInRecordCurrency;

      const costBreakdown: { name: string; value: number }[] = Array.from(
        computedByCategory.entries(),
      ).map(([name, valueUsd]) => {
        const baseValueUsd =
          name === 'Childcare' ? childcarePerChildUsd * kids : valueUsd;
        return {
          name,
          value: baseValueUsd * currencyPerUsdRate,
        };
      });

      const record: CalculationRecord = {
        id: Date.now(),
        city: city.trim(),
        country: country.trim(),
        income: numericIncome,
        numberOfKids: kids,
        totalCosts: totalCostsInRecordCurrency,
        netBudget: numericIncome - totalCostsInRecordCurrency,
        currency: incomeCurrency,
        baseCostsInRecordCurrency,
        childcarePerChildInRecordCurrency,
        costBreakdown,
      };

      setRecords((prev) => [record, ...prev]);
      setSelectedRecordId(record.id);
      setPage(0);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong while fetching data.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setIncome('');
    setIncomeCurrency('EUR');
    setCity('');
    setCountry('');
    setNumberOfKids(0);
    setPrices([]);
    setError(null);
  };

  const handleDeleteRecord = useCallback((id: number) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleEditClick = useCallback((record: CalculationRecord) => {
    setEditModalRecord(record);
    setEditIncome(String(record.income));
    setEditNumberOfKids(record.numberOfKids ?? 0);
  }, []);

  const handleEditModalClose = useCallback(() => {
    setEditModalRecord(null);
  }, []);

  const handleEditModalSave = useCallback(() => {
    if (!editModalRecord) return;
    const newIncome = Number(editIncome);
    const newKids = Math.max(0, Math.floor(Number(editNumberOfKids)) || 0);
    if (!Number.isFinite(newIncome) || newIncome < 0) return;

    setRecords((prev) =>
      prev.map((r) => {
        if (r.id !== editModalRecord.id) return r;
        const hasChildcareData =
          typeof r.baseCostsInRecordCurrency === 'number' &&
          typeof r.childcarePerChildInRecordCurrency === 'number';
        const newTotalCosts = hasChildcareData
          ? r.baseCostsInRecordCurrency! + newKids * r.childcarePerChildInRecordCurrency!
          : r.totalCosts;
        const newNetBudget = newIncome - newTotalCosts;
        const costBreakdown =
          r.costBreakdown?.length && typeof r.childcarePerChildInRecordCurrency === 'number'
            ? r.costBreakdown.map((item) =>
                item.name === 'Childcare'
                  ? { ...item, value: newKids * r.childcarePerChildInRecordCurrency! }
                  : item,
              )
            : r.costBreakdown;
        return {
          ...r,
          income: newIncome,
          numberOfKids: newKids,
          totalCosts: newTotalCosts,
          netBudget: newNetBudget,
          costBreakdown,
        };
      }),
    );
    setEditModalRecord(null);
  }, [editModalRecord, editIncome, editNumberOfKids]);

  return (
    <Box
      component="div"
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        minHeight: 0,
      }}
    >
      <Typography component="h1" variant="h4" gutterBottom>
        Cost of Living Calculator
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Enter your details
          </Typography>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }} noValidate>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(5, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              <TextField
                label="Monthly Income"
                type="number"
                fullWidth
                required
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                inputProps={{ min: 0, step: 100 }}
              />
              <TextField
                select
                label="Currency"
                fullWidth
                value={incomeCurrency}
                onChange={(e) => setIncomeCurrency(e.target.value as CurrencyCode)}
              >
                {Object.entries(CURRENCIES).map(([code, { name, symbol }]) => (
                  <MenuItem key={code} value={code}>
                    {name} ({symbol})
                  </MenuItem>
                ))}
              </TextField>
              <Autocomplete
                freeSolo
                fullWidth
                loading={citiesLoading}
                options={filteredCityOptions}
                onOpen={() => loadCities()}
                getOptionLabel={(option) =>
                  typeof option === 'string' ? option : option.cityName
                }
                value={
                  city
                    ? allCities.find(
                        (c) =>
                          c.cityName.toLowerCase() === city.trim().toLowerCase(),
                      ) ?? city
                    : null
                }
                inputValue={city}
                onInputChange={(_, value) => setCity(value)}
                onChange={(_, newValue) => {
                  if (newValue && typeof newValue === 'object' && 'cityName' in newValue) {
                    const option = newValue as CityOption;
                    setCity(option.cityName);
                    setCountry(option.countryName ?? '');
                  } else if (typeof newValue === 'string') {
                    setCity(newValue);
                    const found = allCities.find(
                      (c) => c.cityName.toLowerCase() === newValue.trim().toLowerCase(),
                    );
                    setCountry(found ? found.countryName : '');
                  } else {
                    setCity('');
                    setCountry('');
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="City"
                    required
                    placeholder={
                      citiesLoading ? 'Loading cities…' : 'Type or select city'
                    }
                  />
                )}
              />
              <TextField
                label="Country"
                fullWidth
                required
                disabled
                value={country}
                placeholder="Auto-filled when you select a city"
              />
              <TextField
                label="Number of kids"
                type="number"
                fullWidth
                value={numberOfKids}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setNumberOfKids(Number.isNaN(n) || n < 0 ? 0 : n);
                }}
                inputProps={{ min: 0, step: 1 }}
                helperText="Childcare cost × this number"
              />
              <TextField
                select
                label="Apartment location"
                fullWidth
                value={rentLocation}
                onChange={(e) => setRentLocation(e.target.value as RentLocation)}
                helperText="Which rent to use in the calculation"
              >
                <MenuItem value="center">City centre</MenuItem>
                <MenuItem value="outskirts">Outside centre</MenuItem>
              </TextField>
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                mt: 2,
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isLoading}
                >
                  {isLoading ? 'Calculating…' : 'Calculate'}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={handleReset}
                  disabled={isLoading}
                >
                  Reset
                </Button>
              </Box>
              <Box textAlign={{ xs: 'left', sm: 'right' }}>
                <Typography variant="subtitle1">
                  Total costs: {totalCostsInCurrency.toFixed(2)} {CURRENCIES[incomeCurrency].symbol}
                </Typography>
                <Typography
                  variant="subtitle1"
                  color={netBudget >= 0 ? 'success.main' : 'error.main'}
                >
                  Net budget: {netBudget.toFixed(2)} {CURRENCIES[incomeCurrency].symbol}
                </Typography>
              </Box>
            </Box>
            {error && (
              <Typography color="error" sx={{ mt: 2 }}>
                {error}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3,
        }}
      >
        <Box sx={{ flex: { xs: '0 0 auto', md: '0 0 40%' } }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: 360 }}>
              <Typography variant="h6" gutterBottom>
                Expenditure breakdown
                {selectedRecord && (
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    — {selectedRecord.city}, {selectedRecord.country}
                  </Typography>
                )}
              </Typography>
              {pieChartData.length ? (
                <Box sx={{ height: '85%', minHeight: 0, overflow: 'hidden' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                      <Pie
                        data={pieChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius="75%"
                        isAnimationActive
                      >
                        {pieChartData.map((_, index) => (
                          <Cell
                            // eslint-disable-next-line react/no-array-index-key
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${Number(value).toFixed(2)} ${CURRENCIES[chartCurrency].symbol}`,
                          name,
                        ]}
                        contentStyle={{ maxWidth: '100%' }}
                        wrapperStyle={{ outline: 'none' }}
                      />
                      <Legend
                        wrapperStyle={{ overflow: 'hidden' }}
                        formatter={(value: string) => <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              ) : selectedRecord ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  No breakdown stored for this record.
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Run a calculation to see the cost breakdown pie chart.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
              }}
            >
              <Typography variant="h6">Calculation history</Typography>
              <TextField
                size="small"
                label="Search by city"
                value={citySearch}
                onChange={(e) => {
                  setCitySearch(e.target.value);
                  setPage(0);
                }}
              />
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sortDirection={sortKey === 'city' ? sortDirection : false}>
                    <TableSortLabel
                      active={sortKey === 'city'}
                      direction={sortKey === 'city' ? sortDirection : 'asc'}
                      onClick={() => handleRequestSort('city')}
                    >
                      City
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Country</TableCell>
                  <TableCell
                    align="right"
                    sortDirection={sortKey === 'income' ? sortDirection : false}
                  >
                    <TableSortLabel
                      active={sortKey === 'income'}
                      direction={sortKey === 'income' ? sortDirection : 'asc'}
                      onClick={() => handleRequestSort('income')}
                    >
                      Income
                    </TableSortLabel>
                  </TableCell>
                  <TableCell
                    align="right"
                    sortDirection={sortKey === 'totalCosts' ? sortDirection : false}
                  >
                    <TableSortLabel
                      active={sortKey === 'totalCosts'}
                      direction={sortKey === 'totalCosts' ? sortDirection : 'asc'}
                      onClick={() => handleRequestSort('totalCosts')}
                    >
                      Total costs
                    </TableSortLabel>
                  </TableCell>
                  <TableCell
                    align="right"
                    sortDirection={sortKey === 'netBudget' ? sortDirection : false}
                  >
                    <TableSortLabel
                      active={sortKey === 'netBudget'}
                      direction={sortKey === 'netBudget' ? sortDirection : 'asc'}
                      onClick={() => handleRequestSort('netBudget')}
                    >
                      Net budget
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center" sx={{ width: 100 }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedRecords.map((record) => (
                  <TableRow
                    key={record.id}
                    hover
                    selected={selectedRecordId === record.id}
                    onClick={() => setSelectedRecordId(record.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{record.city}</TableCell>
                    <TableCell>{record.country}</TableCell>
                    <TableCell align="right">
                      {record.income.toFixed(2)} {CURRENCIES[record.currency].symbol}
                    </TableCell>
                    <TableCell align="right">
                      {record.totalCosts.toFixed(2)} {CURRENCIES[record.currency].symbol}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color:
                          record.netBudget >= 0 ? 'success.main' : 'error.main',
                      }}
                    >
                      {record.netBudget.toFixed(2)} {CURRENCIES[record.currency].symbol}
                    </TableCell>
                    <TableCell align="center" sx={{ width: 100 }} onClick={(e) => e.stopPropagation()}>
                      <IconButton
                        size="small"
                        aria-label="Edit"
                        onClick={() => handleEditClick(record)}
                      >
                        <EditIconSvg />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label="Delete"
                        color="error"
                        onClick={() => handleDeleteRecord(record.id)}
                      >
                        <DeleteIconSvg />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!paginatedRecords.length && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No records yet. Run a calculation to populate the table.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={filteredAndSortedRecords.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25]}
            />
          </Paper>
        </Box>
      </Box>

      <Dialog open={editModalRecord !== null} onClose={handleEditModalClose} maxWidth="sm" fullWidth>
        <DialogTitle>Edit record</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Income"
              type="number"
              fullWidth
              value={editIncome}
              onChange={(e) => setEditIncome(e.target.value)}
              inputProps={{ min: 0, step: 100 }}
            />
            <TextField
              label="Number of kids"
              type="number"
              fullWidth
              value={editNumberOfKids}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setEditNumberOfKids(Number.isNaN(n) || n < 0 ? 0 : n);
              }}
              inputProps={{ min: 0, step: 1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditModalClose}>Cancel</Button>
          <Button variant="contained" onClick={handleEditModalSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Calculator;