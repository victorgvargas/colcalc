import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Snackbar, Typography } from '@mui/material';
import { getUsdRates, getUsdToCurrencyRate } from '../../api/exchangeRates';
import { fetchCities, fetchPricesForCity, type ApiPriceItem } from '../../api/costOfLiving';
import {
  countryNameToCode,
  fetchIncomeTax,
  fetchTaxCountries,
  type RelTaxCountry,
} from '../../api/taxRates';
import TopCitiesDirectory from '../TopCitiesDirectory';
import CalculatorForm, { type CityOption } from './CalculatorForm';
import EditRecordDialog from './EditRecordDialog';
import ExpenditureBreakdown from './ExpenditureBreakdown';
import HistoryTable from './HistoryTable';
import {
  CURRENCIES,
  RECORDS_STORAGE_KEY,
  computeMonthlyCostsFromPrices,
  parseStoredRecords,
  readShareStateFromSearch,
  toDisplayCurrency,
  type CalculationRecord,
  type CurrencyCode,
  type PrefillState,
  type RentLocation,
} from './logic';

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
    if (typeof localStorage !== 'undefined') {
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
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [editModalRecord, setEditModalRecord] = useState<CalculationRecord | null>(null);

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
      getUsdToCurrencyRate(usdRates, code, 1 / CURRENCIES[code].rateToUsd),
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

  const liveChartData = useMemo(() => {
    if (!monthlyByCategory.size) return [];
    return Array.from(monthlyByCategory.entries())
      .map(([name, valueUsd]) => ({ name, value: valueUsd * eurPerUsdForChart }))
      .filter(({ value }) => value > 0);
  }, [monthlyByCategory, eurPerUsdForChart]);

  const selectedRecord = useMemo(
    () =>
      selectedRecordId != null
        ? records.find((r) => r.id === selectedRecordId) ?? null
        : null,
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
    return liveChartData;
  }, [selectedRecord, liveChartData]);

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
            // rel.tax wants annual income in local currency. We pass the user's
            // income × 12 in their chosen currency; the effective rate we use
            // is roughly invariant to the nominal at a given bracket.
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
        return { name, value: baseValueUsd * currencyPerUsdRate };
      });

      const effectiveNetIncome =
        resolvedTaxRate != null ? numericIncome * (1 - resolvedTaxRate) : numericIncome;

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

  const handleEditRecord = useCallback((record: CalculationRecord) => {
    setEditModalRecord(record);
  }, []);

  const handleEditModalSave = useCallback(
    ({ income: newIncome, numberOfKids: newKids }: { income: number; numberOfKids: number }) => {
      if (!editModalRecord) return;
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
    },
    [editModalRecord],
  );

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

      <CalculatorForm
        income={income}
        setIncome={setIncome}
        incomeCurrency={incomeCurrency}
        setIncomeCurrency={setIncomeCurrency}
        city={city}
        setCity={setCity}
        country={country}
        setCountry={setCountry}
        numberOfKids={numberOfKids}
        setNumberOfKids={setNumberOfKids}
        rentLocation={rentLocation}
        setRentLocation={setRentLocation}
        applyTax={applyTax}
        setApplyTax={setApplyTax}
        allCities={allCities}
        filteredCityOptions={filteredCityOptions}
        citiesLoading={citiesLoading}
        loadCities={loadCities}
        totalCostsInCurrency={totalCostsInCurrency}
        netIncomeAfterTax={netIncomeAfterTax}
        netBudget={netBudget}
        taxEffectiveRate={taxEffectiveRate}
        onSubmit={handleSubmit}
        onReset={handleReset}
        onShare={handleShare}
        isLoading={isLoading}
        taxLoading={taxLoading}
        error={error}
        taxError={taxError}
      />

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3,
        }}
      >
        <Box sx={{ flex: { xs: '0 0 auto', md: '0 0 40%' } }}>
          <ExpenditureBreakdown data={pieChartData} selectedRecord={selectedRecord} />
        </Box>

        <Box sx={{ flex: 1 }}>
          <HistoryTable
            records={records}
            selectedRecordId={selectedRecordId}
            onSelectRecord={setSelectedRecordId}
            onEditRecord={handleEditRecord}
            onDeleteRecord={handleDeleteRecord}
          />
        </Box>
      </Box>

      <TopCitiesDirectory />

      <EditRecordDialog
        record={editModalRecord}
        onClose={() => setEditModalRecord(null)}
        onSave={handleEditModalSave}
      />

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
