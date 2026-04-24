import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  fetchIncomeTax,
  fetchTaxCountries,
  countryNameToCode,
  type RelTaxCalculation,
  type RelTaxCountry,
} from '../../api/taxRates';
import { fetchCities, type CityOption } from '../../api/costOfLiving';
import { getUsdRates, getUsdToCurrencyRate } from '../../api/exchangeRates';

/** Currency codes the Cost of Living Calculator accepts directly. */
const CALCULATOR_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD',
]);

export type CalculatorHandoff = {
  income: number;
  currency: string;
  city?: string;
  country?: string;
  currencyConverted: boolean;
};

/**
 * Map a rel.tax result into a payload the Cost of Living Calculator accepts.
 * When rel.tax returns a currency the calculator doesn't support, convert to EUR
 * via the USD-denominated rate table.
 */
function buildCalculatorHandoff(input: {
  monthlyNet: number;
  resultCurrency: string;
  usdRates: Record<string, number> | null;
  city: string;
  country: string;
}): CalculatorHandoff | null {
  const { monthlyNet, resultCurrency, usdRates, city, country } = input;
  if (!Number.isFinite(monthlyNet) || monthlyNet <= 0) return null;

  if (CALCULATOR_CURRENCIES.has(resultCurrency)) {
    return {
      income: Math.round(monthlyNet * 100) / 100,
      currency: resultCurrency,
      city: city.trim() || undefined,
      country: country?.trim() || undefined,
      currencyConverted: false,
    };
  }

  // Convert result -> USD -> EUR using the live rate table.
  const usdPerResult = 1 / getUsdToCurrencyRate(usdRates, resultCurrency, Number.NaN);
  const eurPerUsd = getUsdToCurrencyRate(usdRates, 'EUR', Number.NaN);
  if (!Number.isFinite(usdPerResult) || !Number.isFinite(eurPerUsd)) return null;

  const eurAmount = monthlyNet * usdPerResult * eurPerUsd;
  if (!Number.isFinite(eurAmount) || eurAmount <= 0) return null;

  return {
    income: Math.round(eurAmount * 100) / 100,
    currency: 'EUR',
    city: city.trim() || undefined,
    country: country?.trim() || undefined,
    currencyConverted: true,
  };
}

const TaxCalculator: React.FC = () => {
  const navigate = useNavigate();

  const [allCities, setAllCities] = useState<CityOption[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const citiesLoadedRef = useRef(false);

  const [countries, setCountries] = useState<RelTaxCountry[]>([]);
  const [countryCode, setCountryCode] = useState('');

  const [city, setCity] = useState('');
  const [income, setIncome] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RelTaxCalculation | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    fetchTaxCountries()
      .then((list) => {
        if (!cancelled) setCountries(list);
      })
      .catch(() => {
        if (!cancelled) setCountries([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCityOptions = useMemo(() => {
    const q = city.trim().toLowerCase();
    if (!q) return allCities;
    return allCities.filter((c) => c.cityName.toLowerCase().includes(q));
  }, [allCities, city]);

  // When the user selects a known city, infer the country if rel.tax supports it.
  useEffect(() => {
    const trimmed = city.trim();
    if (!trimmed || !countries.length) return;
    const found = allCities.find(
      (c) => c.cityName.toLowerCase() === trimmed.toLowerCase(),
    );
    if (!found) return;
    const inferred = countryNameToCode(found.countryName, countries);
    if (inferred) setCountryCode(inferred);
  }, [city, allCities, countries]);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.code === countryCode) ?? null,
    [countries, countryCode],
  );

  const handleCalculate = async () => {
    const incomeNum = Number(income);
    if (!countryCode) {
      setError('Please select a country.');
      setResult(null);
      return;
    }
    if (!Number.isFinite(incomeNum) || incomeNum < 0) {
      setError('Please enter a valid income (number ≥ 0).');
      setResult(null);
      return;
    }

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const data = await fetchIncomeTax(countryCode, incomeNum);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tax calculation.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const currencySymbol = result?.currency ?? selectedCountry?.currency ?? '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography component="h1" variant="h5" fontWeight={600} color="#444">
        Tax calculator
      </Typography>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom color="#444">
            Estimate income tax by country and income
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Uses the{' '}
            <a href="https://rel.tax/" target="_blank" rel="noopener noreferrer">
              rel.tax
            </a>{' '}
            public API — supports {countries.length || '55'} countries. US figures assume
            self-employment, not W-2 payroll; treat all results as estimates.
          </Typography>
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              handleCalculate();
            }}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}
          >
            <Autocomplete
              freeSolo
              fullWidth
              loading={citiesLoading}
              options={filteredCityOptions}
              filterOptions={(opts) => opts}
              onOpen={loadCities}
              getOptionLabel={(option) =>
                typeof option === 'string' ? option : option.cityName
              }
              value={
                city
                  ? (allCities.find(
                      (c) => c.cityName.toLowerCase() === city.trim().toLowerCase(),
                    ) ?? city)
                  : null
              }
              inputValue={city}
              onInputChange={(_, value) => setCity(value)}
              onChange={(_, newValue) => {
                if (newValue && typeof newValue === 'object' && 'cityName' in newValue) {
                  setCity((newValue as CityOption).cityName);
                } else if (typeof newValue === 'string') {
                  setCity(newValue);
                } else {
                  setCity('');
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="City (optional)"
                  placeholder={citiesLoading ? 'Loading cities…' : 'Type or select city'}
                  helperText="Selecting a city auto-fills the country when supported"
                />
              )}
            />
            <FormControl fullWidth required>
              <InputLabel id="tax-country-label">Country</InputLabel>
              <Select
                labelId="tax-country-label"
                value={countryCode}
                label="Country"
                onChange={(e) => setCountryCode(e.target.value)}
              >
                {countries.map((c) => (
                  <MenuItem key={c.code} value={c.code}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={`Annual income${currencySymbol ? ` (${currencySymbol})` : ''}`}
              type="number"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              placeholder="e.g. 50000"
              inputProps={{ min: 0, step: 1000 }}
              fullWidth
              required
              helperText={
                selectedCountry
                  ? `Enter income in ${selectedCountry.currency} (local currency)`
                  : undefined
              }
            />
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !countryCode}
              sx={{ alignSelf: 'flex-start' }}
            >
              {loading ? 'Calculating…' : 'Calculate tax'}
            </Button>
          </Box>

          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}

          {result && (() => {
            const yearlyGross = result.yearly?.gross;
            const yearlyNet = result.yearly?.net;
            const yearlyTax = result.yearly?.incomeTax;
            const totalDeductions = result.yearly?.totalDeductions;
            const monthlyNet = result.monthly?.net;
            const effectiveRate = result.rates?.effectiveTaxRate;
            const sym = result.currency;
            return (
              <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Estimated income tax — {selectedCountry?.name ?? result.country}
                  {result.taxYear ? ` (${result.taxYear})` : ''}
                </Typography>
                {typeof yearlyNet === 'number' && (
                  <Typography variant="h6" color="primary">
                    Net yearly: {yearlyNet.toFixed(2)} {sym}
                  </Typography>
                )}
                {typeof monthlyNet === 'number' && (
                  <Typography variant="body1" sx={{ mt: 1 }}>
                    Net monthly: {monthlyNet.toFixed(2)} {sym}
                  </Typography>
                )}
                {typeof effectiveRate === 'number' && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Effective tax rate: {(effectiveRate * 100).toFixed(1)}%
                  </Typography>
                )}
                <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                  {typeof yearlyGross === 'number' && (
                    <Typography variant="body2">
                      Gross yearly: {yearlyGross.toFixed(2)} {sym}
                    </Typography>
                  )}
                  {typeof yearlyTax === 'number' && (
                    <Typography variant="body2">
                      Income tax: {yearlyTax.toFixed(2)} {sym}
                    </Typography>
                  )}
                  {typeof totalDeductions === 'number' && (
                    <Typography variant="body2">
                      Total deductions (tax + social/health): {totalDeductions.toFixed(2)} {sym}
                    </Typography>
                  )}
                </Box>
                {typeof monthlyNet === 'number' && monthlyNet > 0 && (() => {
                  const handoff = buildCalculatorHandoff({
                    monthlyNet,
                    resultCurrency: sym,
                    usdRates,
                    city,
                    country: selectedCountry?.name ?? result.country,
                  });
                  if (!handoff) return null;
                  return (
                    <Box sx={{ mt: 2 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => navigate('/calculator', { state: handoff })}
                      >
                        Use net income in Cost of Living Calculator
                      </Button>
                      {handoff.currencyConverted && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          Converted from {sym} to {handoff.currency} using live rates.
                        </Typography>
                      )}
                    </Box>
                  );
                })()}
              </Box>
            );
          })()}
        </CardContent>
      </Card>
    </Box>
  );
};

export default TaxCalculator;
