import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  fetchCities,
  fetchPricesForCity,
  computeMonthlyCostsFromPrices,
  type CityOption,
  type CityPricesResult,
} from '../../api/costOfLiving';
import { getUsdRates, getUsdToCurrencyRate } from '../../api/exchangeRates';

const MIN_CITIES = 2;
const MAX_CITIES = 5;
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AA46BE'];
const TOTAL_CATEGORY_KEY = 'Total costs';
const CHILDCARE_CATEGORY_KEY = 'Childcare';
const FALLBACK_EUR_PER_USD = 1 / 1.08;

type CityEntry = { cityName: string; countryName: string };

type CityComparisonResult = {
  label: string;
  byCategory: Map<string, number>;
  totalUsd: number;
};

const CitiesComparison: React.FC = () => {
  const [allCities, setAllCities] = useState<CityOption[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const citiesLoadedRef = useRef(false);

  const [entries, setEntries] = useState<CityEntry[]>([
    { cityName: '', countryName: '' },
    { cityName: '', countryName: '' },
  ]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonResults, setComparisonResults] = useState<CityComparisonResult[]>([]);
  const [cityLabels, setCityLabels] = useState<string[]>([]);
  const [includeChildcare, setIncludeChildcare] = useState(true);
  const [usdRates, setUsdRates] = useState<Record<string, number> | null>(null);

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
      const results: {
        label: string;
        byCategory: Map<string, number>;
        totalUsd: number;
      }[] = await Promise.all(
        validEntries.map(async (e) => {
          const { prices }: CityPricesResult = await fetchPricesForCity(
            e.cityName,
            e.countryName,
          );
          const { byCategory, totalUsd } = computeMonthlyCostsFromPrices(prices);
          const label = `${e.cityName}, ${e.countryName}`;
          return { label, byCategory, totalUsd };
        }),
      );

      const labels = results.map((r) => r.label);
      setCityLabels(labels);
      setComparisonResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cost data.');
      setComparisonResults([]);
      setCityLabels([]);
    } finally {
      setCompareLoading(false);
    }
  };

  const categoryData = useMemo(
    () => {
      if (!comparisonResults.length || !cityLabels.length) return [];

      const eurPerUsdRate = getUsdToCurrencyRate(usdRates, 'EUR', FALLBACK_EUR_PER_USD);

      const categorySet = new Set<string>();
      comparisonResults.forEach((r) => {
        r.byCategory.forEach((_, cat) => {
          if (!includeChildcare && cat === CHILDCARE_CATEGORY_KEY) return;
          categorySet.add(cat);
        });
      });
      const categories = Array.from(categorySet).sort();
      categories.push(TOTAL_CATEGORY_KEY);

      return categories.map((category) => {
        const row: { category: string; [cityLabel: string]: string | number } = {
          category,
        };
        cityLabels.forEach((label) => {
          const cityResult = comparisonResults.find((r) => r.label === label);
          const childcareUsd = cityResult?.byCategory.get(CHILDCARE_CATEGORY_KEY) ?? 0;
          const baseTotalUsd = cityResult?.totalUsd ?? 0;

          let valueUsd: number;
          if (category === TOTAL_CATEGORY_KEY) {
            valueUsd = includeChildcare ? baseTotalUsd : baseTotalUsd - childcareUsd;
          } else {
            valueUsd = cityResult?.byCategory.get(category) ?? 0;
          }

          row[label] = Math.round(valueUsd * eurPerUsdRate * 100) / 100;
        });
        return row;
      });
    },
    [comparisonResults, cityLabels, includeChildcare],
  );

  const getFilteredOptions = useCallback((query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return allCities;
    return allCities.filter((c) => c.cityName.toLowerCase().includes(q));
  }, [allCities]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography component="h1" variant="h5" fontWeight={600} color="#444">
        Cities comparison
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: -0.5, mb: 0.5 }}>
        Results are shown in EUR.
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

      {categoryData.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom color="#444">
              Monthly costs by category
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={includeChildcare}
                    onChange={(event) => setIncludeChildcare(event.target.checked)}
                  />
                }
                label="Include childcare"
              />
            </Box>
            <Box sx={{ width: '100%', height: 400, overflow: 'hidden' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryData}
                  margin={{ top: 16, right: 16, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [`€${Number(value).toFixed(2)}`, '']}
                    contentStyle={{ maxWidth: '100%' }}
                  />
                  <Legend wrapperStyle={{ overflow: 'hidden' }} />
                  {cityLabels.map((label, i) => (
                    <Bar
                      key={label}
                      dataKey={label}
                      name={label}
                      fill={COLORS[i % COLORS.length]}
                      radius={[2, 2, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default CitiesComparison;
