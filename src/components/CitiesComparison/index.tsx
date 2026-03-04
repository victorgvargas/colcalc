import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
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
} from '../../api/costOfLiving';

const MIN_CITIES = 2;
const MAX_CITIES = 5;
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AA46BE'];

type CityEntry = { cityName: string; countryName: string };

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
  const [categoryData, setCategoryData] = useState<{ category: string; [cityLabel: string]: string | number }[]>([]);
  const [cityLabels, setCityLabels] = useState<string[]>([]);

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
      const results = await Promise.all(
        validEntries.map(async (e) => {
          const prices = await fetchPricesForCity(e.cityName, e.countryName);
          const { byCategory } = computeMonthlyCostsFromPrices(prices);
          const label = `${e.cityName}, ${e.countryName}`;
          return { label, byCategory };
        }),
      );

      const categorySet = new Set<string>();
      results.forEach((r) => {
        r.byCategory.forEach((_, cat) => categorySet.add(cat));
      });
      const categories = Array.from(categorySet).sort();

      const labels = results.map((r) => r.label);
      setCityLabels(labels);

      const chartData = categories.map((category) => {
        const row: { category: string; [cityLabel: string]: string | number } = {
          category,
        };
        labels.forEach((label, i) => {
          const value = results[i]?.byCategory.get(category) ?? 0;
          row[label] = Math.round(value * 100) / 100;
        });
        return row;
      });

      setCategoryData(chartData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cost data.');
      setCategoryData([]);
      setCityLabels([]);
    } finally {
      setCompareLoading(false);
    }
  };

  const getFilteredOptions = useCallback((query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return allCities;
    return allCities.filter((c) => c.cityName.toLowerCase().includes(q));
  }, [allCities]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h5" fontWeight={600} color="#444">
        Cities comparison
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: -0.5, mb: 0.5 }}>
        Results are shown in local currency.
      </Typography>

      <Card>
        <CardContent>
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
              variant="contained"
              onClick={handleCompare}
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
                    formatter={(value: number) => [`$${Number(value).toFixed(2)}`, '']}
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
