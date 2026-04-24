import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Snackbar,
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
import {
  fetchCities,
  fetchPricesForCity,
  type ApiPriceItem,
} from '../../api/costOfLiving';
import {
  countryNameToCode,
  fetchIncomeTax,
  fetchTaxCountries,
  type RelTaxCountry,
} from '../../api/taxRates';
import TopCitiesDirectory from '../TopCitiesDirectory';

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
  /** Effective income-tax rate applied to `income` (0..1). Undefined = untaxed. */
  taxRate?: number;
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
        taxRate:
          typeof rec.taxRate === 'number' && Number.isFinite(rec.taxRate)
            ? Math.max(0, Math.min(1, rec.taxRate))
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

type PrefillState = {
  income?: number;
  currency?: string;
  city?: string;
  country?: string;
  numberOfKids?: number;
  rentLocation?: RentLocation;
  applyTax?: boolean;
};

const SHARE_PARAM_KEYS = [
  'income',
  'currency',
  'city',
  'country',
  'kids',
  'rent',
  'tax',
] as const;

function readShareStateFromSearch(search: string): PrefillState | null {
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

  return state;
}

function toDisplayCurrency(value: number, fromCurrency: CurrencyCode): number {
  return (value * CURRENCIES[fromCurrency].rateToUsd) / CURRENCIES.EUR.rateToUsd;
}

const Calculator: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prefillConsumedRef = useRef(false);

  const routerPrefill =
    location.state && typeof location.state === 'object'
      ? (location.state as PrefillState)
      : null;
  const urlPrefill = readShareStateFromSearch(location.search);
  const initialPrefill = routerPrefill ?? urlPrefill ?? null;

  const initialCurrency: CurrencyCode =
    initialPrefill?.currency && initialPrefill.currency in CURRENCIES
      ? (initialPrefill.currency as CurrencyCode)
      : 'EUR';

  const [income, setIncome] = useState<string>(
    initialPrefill?.income != null ? String(initialPrefill.income) : '',
  );
  const [incomeCurrency, setIncomeCurrency] = useState<CurrencyCode>(initialCurrency);
  const [city, setCity] = useState<string>(initialPrefill?.city ?? '');
  const [country, setCountry] = useState<string>(initialPrefill?.country ?? '');
  const [numberOfKids, setNumberOfKids] = useState<number>(initialPrefill?.numberOfKids ?? 0);
  const [rentLocation, setRentLocation] = useState<RentLocation>(
    initialPrefill?.rentLocation ?? 'center',
  );
  const [applyTax, setApplyTax] = useState<boolean>(initialPrefill?.applyTax ?? false);
  const shouldAutoRunRef = useRef<boolean>(
    Boolean(urlPrefill && urlPrefill.income && urlPrefill.city),
  );

  useEffect(() => {
    // Consume the router state / URL params once so refreshing doesn't re-prefill.
    if (!prefillConsumedRef.current && (routerPrefill || urlPrefill)) {
      prefillConsumedRef.current = true;
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [routerPrefill, urlPrefill, location.pathname, navigate]);

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
    const handler = (e: StorageEvent) => {
      if (e.key !== RECORDS_STORAGE_KEY) return;
      setRecords(parseStoredRecords(localStorage.getItem(RECORDS_STORAGE_KEY)));
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

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

  const [taxCountries, setTaxCountries] = useState<RelTaxCountry[]>([]);
  const [taxEffectiveRate, setTaxEffectiveRate] = useState<number | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxError, setTaxError] = useState<string | null>(null);

  useEffect(() => {
    if (!applyTax || taxCountries.length > 0) return;
    let cancelled = false;
    fetchTaxCountries()
      .then((list) => {
        if (!cancelled) setTaxCountries(list);
      })
      .catch(() => {
        if (!cancelled) setTaxCountries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [applyTax, taxCountries.length]);

  const [shareSnackOpen, setShareSnackOpen] = useState(false);

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
    fetchCities()
      .then(setAllCities)
      .catch(() => {
        setAllCities([]);
        citiesLoadedRef.current = false;
      })
      .finally(() => setCitiesLoading(false));
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

  const grossIncomeValue = Number(income) || 0;
  const netIncomeAfterTax = useMemo(() => {
    if (!applyTax || taxEffectiveRate == null) return grossIncomeValue;
    const rate = Math.max(0, Math.min(1, taxEffectiveRate));
    return grossIncomeValue * (1 - rate);
  }, [applyTax, grossIncomeValue, taxEffectiveRate]);

  const netBudget = useMemo(
    () => netIncomeAfterTax - totalCostsInCurrency,
    [netIncomeAfterTax, totalCostsInCurrency],
  );

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

  const getRecordIncomeDisplay = useCallback(
    (r: CalculationRecord): number =>
      typeof r.taxRate === 'number' ? r.income * (1 - r.taxRate) : r.income,
    [],
  );

  const filteredAndSortedRecords = useMemo(() => {
    const search = citySearch.trim().toLowerCase();

    let data = records;
    if (search) {
      data = data.filter((r) => r.city.toLowerCase().includes(search));
    }

    const sorted = [...data].sort((a, b) => {
      const rawAVal = sortKey === 'income' ? getRecordIncomeDisplay(a) : a[sortKey];
      const rawBVal = sortKey === 'income' ? getRecordIncomeDisplay(b) : b[sortKey];
      const aVal =
        sortKey === 'city'
          ? rawAVal
          : toDisplayCurrency(rawAVal as number, a.currency);
      const bVal =
        sortKey === 'city'
          ? rawBVal
          : toDisplayCurrency(rawBVal as number, b.currency);

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
  }, [records, citySearch, sortKey, sortDirection, getRecordIncomeDisplay]);

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
      let resolvedTaxRate: number | null = null;
      if (applyTax) {
        setTaxError(null);
        setTaxLoading(true);
        try {
          const countries =
            taxCountries.length > 0 ? taxCountries : await fetchTaxCountries();
          if (taxCountries.length === 0) setTaxCountries(countries);
          const code = countryNameToCode(country.trim(), countries);
          if (!code) {
            setTaxError(
              `rel.tax doesn't cover ${country.trim()}; net budget will use gross income.`,
            );
          } else {
            // rel.tax expects annual income in local currency. The calculator currency
            // may differ from the country's local currency, but the *effective rate*
            // is what we need — it's roughly invariant to the currency nominal value
            // at a given bracket, so we pass annualized income in the user's currency.
            const annualIncome = numericIncome * 12;
            const calc = await fetchIncomeTax(code, annualIncome);
            const rate = calc.rates?.effectiveTaxRate;
            if (typeof rate === 'number' && Number.isFinite(rate) && rate >= 0) {
              resolvedTaxRate = Math.max(0, Math.min(1, rate));
              setTaxEffectiveRate(resolvedTaxRate);
            } else {
              setTaxError('Tax API did not return an effective rate.');
            }
          }
        } catch (taxErr) {
          setTaxError(
            taxErr instanceof Error
              ? `Tax lookup failed: ${taxErr.message}`
              : 'Tax lookup failed.',
          );
        } finally {
          setTaxLoading(false);
        }
      } else {
        setTaxEffectiveRate(null);
        setTaxError(null);
      }

      const { prices: fetchedPrices } = await fetchPricesForCity(
        city.trim(),
        country.trim(),
      );

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

      const effectiveNetIncome =
        resolvedTaxRate != null
          ? numericIncome * (1 - resolvedTaxRate)
          : numericIncome;

      const record: CalculationRecord = {
        id: Date.now(),
        city: city.trim(),
        country: country.trim(),
        income: numericIncome,
        numberOfKids: kids,
        totalCosts: totalCostsInRecordCurrency,
        netBudget: effectiveNetIncome - totalCostsInRecordCurrency,
        currency: incomeCurrency,
        baseCostsInRecordCurrency,
        childcarePerChildInRecordCurrency,
        costBreakdown,
        taxRate: resolvedTaxRate ?? undefined,
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

  const buildShareUrl = useCallback((): string | null => {
    const numericIncome = Number(income);
    if (!numericIncome || !city.trim()) return null;
    const params = new URLSearchParams();
    params.set('income', String(numericIncome));
    params.set('currency', incomeCurrency);
    params.set('city', city.trim());
    if (country.trim()) params.set('country', country.trim());
    if (numberOfKids > 0) params.set('kids', String(numberOfKids));
    if (rentLocation !== 'center') params.set('rent', rentLocation);
    if (applyTax) params.set('tax', '1');
    const base =
      typeof window !== 'undefined'
        ? `${window.location.origin}${location.pathname}`
        : location.pathname;
    return `${base}?${params.toString()}`;
  }, [income, incomeCurrency, city, country, numberOfKids, rentLocation, applyTax, location.pathname]);

  const handleShare = useCallback(async () => {
    const url = buildShareUrl();
    if (!url) {
      setError('Enter income and city before sharing.');
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      setShareSnackOpen(true);
    } catch {
      setShareSnackOpen(true);
    }
  }, [buildShareUrl]);

  // Auto-run the calculation when the user lands via a share link.
  useEffect(() => {
    if (!shouldAutoRunRef.current) return;
    if (!income || !city.trim() || !country.trim()) return;
    shouldAutoRunRef.current = false;
    // Synthesize a form event so handleSubmit's path runs unchanged.
    void handleSubmit({ preventDefault: () => {} } as React.FormEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [income, city, country]);

  const handleReset = () => {
    setIncome('');
    setIncomeCurrency('EUR');
    setCity('');
    setCountry('');
    setNumberOfKids(0);
    setPrices([]);
    setError(null);
    setApplyTax(false);
    setTaxEffectiveRate(null);
    setTaxError(null);
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
        const effectiveIncome =
          typeof r.taxRate === 'number' ? newIncome * (1 - r.taxRate) : newIncome;
        const newNetBudget = effectiveIncome - newTotalCosts;
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
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={applyTax}
                    onChange={(e) => setApplyTax(e.target.checked)}
                  />
                }
                label="Apply estimated income tax (rel.tax)"
              />
              {applyTax && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
                  Treats your income as gross. We fetch an effective tax rate for the
                  selected country and subtract it from income before computing net budget.
                  US figures assume self-employment.
                </Typography>
              )}
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
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isLoading || taxLoading}
                >
                  {isLoading || taxLoading ? 'Calculating…' : 'Calculate'}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={handleReset}
                  disabled={isLoading}
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  variant="text"
                  onClick={handleShare}
                  disabled={!Number(income) || !city.trim()}
                >
                  Copy shareable link
                </Button>
              </Box>
              <Box textAlign={{ xs: 'left', sm: 'right' }}>
                <Typography variant="subtitle1">
                  Total costs: {totalCostsInCurrency.toFixed(2)} {CURRENCIES[incomeCurrency].symbol}
                </Typography>
                {applyTax && taxEffectiveRate != null && (
                  <Typography variant="body2" color="text.secondary">
                    Net income (after {(taxEffectiveRate * 100).toFixed(1)}% tax):{' '}
                    {netIncomeAfterTax.toFixed(2)} {CURRENCIES[incomeCurrency].symbol}
                  </Typography>
                )}
                <Typography
                  variant="subtitle1"
                  color={netBudget >= 0 ? 'success.main' : 'error.main'}
                >
                  Net budget: {netBudget.toFixed(2)} {CURRENCIES[incomeCurrency].symbol}
                </Typography>
              </Box>
            </Box>
            {taxError && (
              <Typography color="warning.main" sx={{ mt: 2 }}>
                {taxError}
              </Typography>
            )}
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
                      {getRecordIncomeDisplay(record).toFixed(2)}{' '}
                      {CURRENCIES[record.currency].symbol}
                      {typeof record.taxRate === 'number' && (
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          net of {(record.taxRate * 100).toFixed(1)}% tax
                        </Typography>
                      )}
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

      <TopCitiesDirectory />

      <Dialog open={editModalRecord !== null} onClose={handleEditModalClose} maxWidth="sm" fullWidth>
        <DialogTitle>Edit record</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label={
                typeof editModalRecord?.taxRate === 'number'
                  ? 'Gross income'
                  : 'Income'
              }
              type="number"
              fullWidth
              value={editIncome}
              onChange={(e) => setEditIncome(e.target.value)}
              inputProps={{ min: 0, step: 100 }}
              helperText={
                typeof editModalRecord?.taxRate === 'number'
                  ? `Net budget applies ${(editModalRecord.taxRate * 100).toFixed(1)}% tax`
                  : undefined
              }
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

      <Snackbar
        open={shareSnackOpen}
        autoHideDuration={2500}
        onClose={() => setShareSnackOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message="Shareable link copied to clipboard"
      />
    </Box>
  );
};

export default Calculator;