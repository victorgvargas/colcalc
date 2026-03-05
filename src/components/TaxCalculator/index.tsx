import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  countryNameToCode,
  type FilingStatus,
  type IncomeTaxCalculatorResponse,
} from '../../api/taxRates';
import { fetchCities, type CityOption } from '../../api/costOfLiving';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

const CA_PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

const FILING_STATUSES: { value: FilingStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married (filing jointly)' },
  { value: 'married_separate', label: 'Married (filing separately)' },
  { value: 'head_of_household', label: 'Head of household' },
];

const TaxCalculator: React.FC = () => {
  const [allCities, setAllCities] = useState<CityOption[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const citiesLoadedRef = useRef(false);

  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single');
  const [income, setIncome] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IncomeTaxCalculatorResponse | null>(null);

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

  const filteredCityOptions = useMemo(() => {
    const q = city.trim().toLowerCase();
    if (!q) return allCities;
    return allCities.filter((c) => c.cityName.toLowerCase().includes(q));
  }, [allCities, city]);

  useEffect(() => {
    const trimmed = city.trim();
    if (!trimmed) {
      setCountry('');
      setRegion('');
      return;
    }
    const found = allCities.find(
      (c) => c.cityName.toLowerCase() === trimmed.toLowerCase(),
    );
    if (found) {
      setCountry(found.countryName ?? '');
    } else {
      setCountry('');
      setRegion('');
    }
  }, [city, allCities]);

  const countryCode = useMemo(() => countryNameToCode(country), [country]);
  const isUS = countryCode === 'US';
  const isCA = countryCode === 'CA';
  const supportedCountry = isUS || isCA;
  const regionOptions = isUS ? US_STATES : isCA ? CA_PROVINCES : [];

  const handleCalculate = async () => {
    const cityTrim = city.trim();
    const countryTrim = country.trim();
    const incomeNum = Number(income);

    if (!cityTrim || !countryTrim) {
      setError('Please select a city (country is filled automatically).');
      setResult(null);
      return;
    }
    if (!supportedCountry) {
      setError('Income tax calculator supports United States and Canada only.');
      setResult(null);
      return;
    }
    if (!region && supportedCountry) {
      setError('Please select a state or province.');
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
      const data = await fetchIncomeTax(
        countryCode!,
        region,
        incomeNum,
        filingStatus,
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tax calculation.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h5" fontWeight={600} color="#444">
        Tax calculator
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: -0.5, mb: 0.5 }}>
        Results are shown in EUR.
      </Typography>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom color="#444">
            Estimate income tax by location and income
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Uses the{' '}
            <a
              href="https://api-ninjas.com/api/incometaxcalculator"
              target="_blank"
              rel="noopener noreferrer"
            >
              API-Ninjas Income Tax Calculator
            </a>{' '}
            (US and Canada only).
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
                  setRegion('');
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="City"
                  placeholder={citiesLoading ? 'Loading cities…' : 'Type or select city'}
                  required
                />
              )}
            />
            <TextField
              label="Country"
              value={country}
              disabled
              fullWidth
              helperText="Filled automatically from the selected city"
            />
            {supportedCountry && (
              <FormControl fullWidth required>
                <InputLabel id="tax-region-label">
                  {isUS ? 'State' : 'Province'}
                </InputLabel>
                <Select
                  labelId="tax-region-label"
                  value={region}
                  label={isUS ? 'State' : 'Province'}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  {regionOptions.map((code) => (
                    <MenuItem key={code} value={code}>
                      {code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {isUS && (
              <FormControl fullWidth>
                <InputLabel id="filing-status-label">Filing status</InputLabel>
                <Select
                  labelId="filing-status-label"
                  value={filingStatus}
                  label="Filing status"
                  onChange={(e) => setFilingStatus(e.target.value as FilingStatus)}
                >
                  {FILING_STATUSES.map(({ value, label }) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <TextField
              label="Annual income"
              type="number"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              placeholder="e.g. 50000"
              inputProps={{ min: 0, step: 1000 }}
              fullWidth
              required
            />
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !supportedCountry}
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
            const total =
              typeof result.total_taxes_owed === 'number'
                ? result.total_taxes_owed
                : [result.federal_taxes_owed, result.region_taxes_owed, result.fica_total]
                    .filter((n): n is number => typeof n === 'number')
                    .reduce((a, b) => a + b, 0);
            return (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Estimated income tax
              </Typography>
              {total > 0 && (
                <Typography variant="h6" color="primary">
                  Total taxes owed: ${total.toFixed(2)}
                </Typography>
              )}
              {typeof result.income_after_tax === 'number' && (
                <Typography variant="body1" sx={{ mt: 1 }}>
                  Income after tax: ${result.income_after_tax.toFixed(2)}
                </Typography>
              )}
              {typeof result.total_effective_tax_rate === 'number' && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Effective tax rate: {(result.total_effective_tax_rate * 100).toFixed(1)}%
                </Typography>
              )}
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                {typeof result.federal_taxes_owed === 'number' && (
                  <Typography variant="body2">
                    Federal: ${result.federal_taxes_owed.toFixed(2)}
                    {typeof result.federal_effective_rate === 'number' &&
                      ` (${(result.federal_effective_rate * 100).toFixed(1)}%)`}
                  </Typography>
                )}
                {typeof result.region_taxes_owed === 'number' && result.region_taxes_owed > 0 && (
                  <Typography variant="body2">
                    State/Provincial: ${result.region_taxes_owed.toFixed(2)}
                    {typeof result.region_effective_rate === 'number' &&
                      ` (${(result.region_effective_rate * 100).toFixed(1)}%)`}
                  </Typography>
                )}
                {typeof result.fica_total === 'number' && result.fica_total > 0 && (
                  <Typography variant="body2">FICA: ${result.fica_total.toFixed(2)}</Typography>
                )}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {result.region} {result.country && `• ${result.country}`}
              </Typography>
            </Box>
            );
          })()}
        </CardContent>
      </Card>
    </Box>
  );
};

export default TaxCalculator;
