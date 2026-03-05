import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import {
  fetchCities,
  fetchPricesForCity,
  computeMonthlyCostsFromPrices,
  type CityOption,
  type CityPricesResult,
} from '../../api/costOfLiving';

const MIN_CITIES = 2;
const MAX_CITIES = 5;

const PPP_CURRENCIES = {
  EUR: { name: 'Euro', symbol: 'EUR' },
  USD: { name: 'US Dollar', symbol: 'USD' },
  GBP: { name: 'British Pound', symbol: 'GBP' },
  CHF: { name: 'Swiss Franc', symbol: 'CHF' },
} as const;

type PppCurrencyCode = keyof typeof PPP_CURRENCIES;

type CityEntry = { cityName: string; countryName: string };

type CityTotalResult = {
  label: string;
  totalUsd: number;
};

const PurchasingPower: React.FC = () => {
  const [allCities, setAllCities] = useState<CityOption[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const citiesLoadedRef = useRef(false);

  const [entries, setEntries] = useState<CityEntry[]>([
    { cityName: '', countryName: '' },
    { cityName: '', countryName: '' },
  ]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CityTotalResult[]>([]);
  const [pppIncome, setPppIncome] = useState<string>('');
  const [pppCurrency, setPppCurrency] = useState<PppCurrencyCode>('EUR');

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

  useEffect(() => {
    loadCities();
  }, [loadCities]);

  const validEntries = useMemo(
    () =>
      entries.filter((e) => e.cityName.trim() && e.countryName.trim()),
    [entries],
  );

  const canAddCity = entries.length < MAX_CITIES;
  const canRemoveCity = entries.length > MIN_CITIES;

  const addCity = () => {
    if (!canAddCity) return;
    setEntries((prev) => [...prev, { cityName: '', countryName: '' }]);
  };

  const removeCity = (index: number) => {
    if (!canRemoveCity) return;
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof CityEntry, value: string) => {
    setEntries((prev) => {
      const next = prev.map((e, i) => (i === index ? { ...e, [field]: value } : e));
      if (field === 'cityName') {
        const entry = next[index];
        if (entry && value.trim()) {
          const found = allCities.find(
            (c) => c.cityName.toLowerCase() === value.trim().toLowerCase(),
          );
          if (found) {
            return next.map((e, i) =>
              i === index ? { ...e, countryName: found.countryName } : e,
            );
          }
        }
      }
      return next;
    });
  };

  const setEntryFromOption = (index: number, option: CityOption | null) => {
    if (!option) {
      setEntries((prev) =>
        prev.map((e, i) => (i === index ? { cityName: '', countryName: '' } : e)),
      );
      return;
    }
    setEntries((prev) =>
      prev.map((e, i) =>
        i === index
          ? { cityName: option.cityName, countryName: option.countryName }
          : e,
      ),
    );
  };

  const handleCompare = async () => {
    if (validEntries.length < MIN_CITIES) {
      setError(`Please select at least ${MIN_CITIES} cities to compare.`);
      return;
    }
    setError(null);
    setCompareLoading(true);
    try {
      const totals: CityTotalResult[] = await Promise.all(
        validEntries.map(async (e) => {
          const { prices }: CityPricesResult = await fetchPricesForCity(
            e.cityName,
            e.countryName,
          );
          const { totalUsd } = computeMonthlyCostsFromPrices(prices);
          const label = `${e.cityName}, ${e.countryName}`;
          return { label, totalUsd };
        }),
      );
      setResults(totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cost data.');
      setResults([]);
    } finally {
      setCompareLoading(false);
    }
  };

  const pppRows = useMemo(
    () => {
      if (!results.length) return [];
      const base = results[0];
      const baseTotalUsd = base.totalUsd;
      const income = Number(pppIncome);
      if (!baseTotalUsd || !Number.isFinite(income) || income <= 0) return [];

      return results.map((result, index) => {
        if (!result.totalUsd || result.totalUsd <= 0) {
          return { label: result.label, income: 0 };
        }
        const ratio = result.totalUsd / baseTotalUsd;
        const cityIncome = index === 0 ? income : income * ratio;
        return { label: result.label, income: cityIncome };
      });
    },
    [results, pppIncome],
  );

  const getFilteredOptions = useCallback((query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return allCities;
    return allCities.filter((c) => c.cityName.toLowerCase().includes(q));
  }, [allCities]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography component="h1" variant="h5" fontWeight={600} color="#444">
        Purchasing power parity
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: -0.5, mb: 0.5 }}>
        Select cities, set an income in the first city, and see equivalent incomes in the others.
      </Typography>

      <Card>
        <CardContent
          component="form"
          onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void handleCompare();
          }}
        >
          <Typography variant="h6" gutterBottom color="#444">
            Select cities (2 to 5)
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {entries.map((entry, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  flexWrap: 'wrap',
                }}
              >
                <Autocomplete
                  sx={{ minWidth: 280, flex: 1 }}
                  freeSolo
                  loading={citiesLoading}
                  options={getFilteredOptions(entry.cityName)}
                  filterOptions={(opts) => opts}
                  getOptionLabel={(option) =>
                    typeof option === 'string' ? option : option.cityName
                  }
                  onOpen={loadCities}
                  value={
                    entry.cityName
                      ? (allCities.find(
                          (c) =>
                            c.cityName.toLowerCase() === entry.cityName.trim().toLowerCase(),
                        ) ?? entry.cityName)
                      : null
                  }
                  inputValue={entry.cityName}
                  onInputChange={(_, value) => updateEntry(index, 'cityName', value)}
                  onChange={(_, newValue) => {
                    const option =
                      newValue && typeof newValue === 'object' && 'cityName' in newValue
                        ? (newValue as CityOption)
                        : null;
                    setEntryFromOption(index, option);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={`City ${index + 1}`}
                      placeholder={citiesLoading ? 'Loading cities…' : 'Type or select city'}
                    />
                  )}
                />
                {canRemoveCity && (
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    onClick={() => removeCity(index)}
                  >
                    Remove
                  </Button>
                )}
              </Box>
            ))}
            {canAddCity && (
              <Button variant="outlined" onClick={addCity} size="small">
                Add city
              </Button>
            )}
          </Box>
          <Box sx={{ mt: 2 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={compareLoading || validEntries.length < MIN_CITIES}
            >
              {compareLoading ? 'Loading…' : 'Compare'}
            </Button>
          </Box>
          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom color="#444">
              Equivalent incomes
            </Typography>
            {results.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                Base city: {results[0].label}
              </Typography>
            )}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 2,
                mt: 2,
              }}
            >
              <TextField
                label="Income in base city"
                type="number"
                value={pppIncome}
                onChange={(event) => setPppIncome(event.target.value)}
                fullWidth
                inputProps={{ min: 0, step: 100 }}
              />
              <TextField
                select
                label="Currency"
                fullWidth
                value={pppCurrency}
                onChange={(event) => setPppCurrency(event.target.value as PppCurrencyCode)}
              >
                {Object.entries(PPP_CURRENCIES).map(([code, { name, symbol }]) => (
                  <MenuItem key={code} value={code}>
                    {name} ({symbol})
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            {pppRows.length > 0 && (
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {pppRows.map((row) => (
                  <Typography key={row.label} variant="body2">
                    {row.label}: {row.income.toFixed(2)} {PPP_CURRENCIES[pppCurrency].symbol}
                  </Typography>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default PurchasingPower;

