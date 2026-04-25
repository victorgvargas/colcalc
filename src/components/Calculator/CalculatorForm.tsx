import React from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import {
  getCurrencyMeta,
  type CurrencyCode,
  type CurrencyMeta,
  type LifestyleLevel,
  type RentLocation,
} from './logic';
import type { DatasetMeta } from '../../api/costOfLiving';

export type CityOption = {
  cityName: string;
  countryName: string;
  cityId?: number;
};

type Props = {
  /** Form state */
  income: string;
  setIncome: (v: string) => void;
  incomeCurrency: CurrencyCode;
  setIncomeCurrency: (v: CurrencyCode) => void;
  city: string;
  setCity: (v: string) => void;
  country: string;
  setCountry: (v: string) => void;
  numberOfKids: number;
  setNumberOfKids: (v: number) => void;
  rentLocation: RentLocation;
  setRentLocation: (v: RentLocation) => void;
  lifestyle: LifestyleLevel;
  setLifestyle: (v: LifestyleLevel) => void;
  applyTax: boolean;
  setApplyTax: (v: boolean) => void;

  /** Options driving the Currency dropdown — built from live USD rates. */
  currencyOptions: CurrencyMeta[];

  /** Autocomplete data */
  allCities: CityOption[];
  filteredCityOptions: CityOption[];
  citiesLoading: boolean;
  loadCities: () => void;

  /** Derived display values */
  totalCostsInCurrency: number;
  netIncomeAfterTax: number;
  netBudget: number;
  taxEffectiveRate: number | null;

  /** Submit / reset / share actions */
  onSubmit: (event: React.FormEvent) => void;
  onReset: () => void;
  onShare: () => void;

  /** Flags */
  isLoading: boolean;
  taxLoading: boolean;
  error: string | null;
  taxError: string | null;

  /** Provenance shown under the result summary. */
  datasetMeta?: DatasetMeta | null;
};

const CalculatorForm: React.FC<Props> = ({
  income,
  setIncome,
  incomeCurrency,
  setIncomeCurrency,
  city,
  setCity,
  country,
  setCountry,
  numberOfKids,
  setNumberOfKids,
  rentLocation,
  setRentLocation,
  lifestyle,
  setLifestyle,
  applyTax,
  setApplyTax,
  currencyOptions,
  allCities,
  filteredCityOptions,
  citiesLoading,
  loadCities,
  totalCostsInCurrency,
  netIncomeAfterTax,
  netBudget,
  taxEffectiveRate,
  onSubmit,
  onReset,
  onShare,
  isLoading,
  taxLoading,
  error,
  taxError,
  datasetMeta,
}) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Enter your details
        </Typography>
        <Box component="form" onSubmit={onSubmit} sx={{ mt: 2 }} noValidate>
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
              {currencyOptions.map(({ code, name, symbol }) => (
                <MenuItem key={code} value={code}>
                  {name === code ? code : `${name} (${symbol})`}
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
                      (c) => c.cityName.toLowerCase() === city.trim().toLowerCase(),
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
            <TextField
              select
              label="Lifestyle"
              fullWidth
              value={lifestyle}
              onChange={(e) => setLifestyle(e.target.value as LifestyleLevel)}
              helperText="Scales groceries and transport"
            >
              <MenuItem value="frugal">Frugal</MenuItem>
              <MenuItem value="average">Average</MenuItem>
              <MenuItem value="comfortable">Comfortable</MenuItem>
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
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', ml: 4 }}
              >
                Treats your income as gross. We fetch an effective tax rate for the
                selected country and subtract it from income before computing net
                budget. US figures assume self-employment.
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
              <Button type="submit" variant="contained" disabled={isLoading || taxLoading}>
                {isLoading || taxLoading ? 'Calculating…' : 'Calculate'}
              </Button>
              <Button
                type="button"
                variant="outlined"
                onClick={onReset}
                disabled={isLoading}
              >
                Reset
              </Button>
              <Button
                type="button"
                variant="text"
                onClick={onShare}
                disabled={!Number(income) || !city.trim()}
              >
                Copy shareable link
              </Button>
            </Box>
            <Box textAlign={{ xs: 'left', sm: 'right' }}>
              <Typography variant="subtitle1">
                Total costs: {totalCostsInCurrency.toFixed(2)}{' '}
                {getCurrencyMeta(incomeCurrency).symbol}
              </Typography>
              {applyTax && taxEffectiveRate != null && (
                <Typography variant="body2" color="text.secondary">
                  Net income (after {(taxEffectiveRate * 100).toFixed(1)}% tax):{' '}
                  {netIncomeAfterTax.toFixed(2)} {getCurrencyMeta(incomeCurrency).symbol}
                </Typography>
              )}
              <Typography
                variant="subtitle1"
                color={netBudget >= 0 ? 'success.main' : 'error.main'}
              >
                Net budget: {netBudget.toFixed(2)}{' '}
                {getCurrencyMeta(incomeCurrency).symbol}
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
          {datasetMeta && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 2 }}
            >
              {renderProvenance(datasetMeta)}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

function renderProvenance(meta: DatasetMeta): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const sourceLabel = meta.source ? (
    <a
      key="src"
      href={meta.source}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'inherit' }}
    >
      open Cost of Living dataset
    </a>
  ) : (
    'open Cost of Living dataset'
  );
  parts.push(<>Data from {sourceLabel}</>);
  if (meta.cityCount != null) parts.push(`${meta.cityCount.toLocaleString()} cities`);
  const when = meta.generatedAt ? meta.generatedAt.slice(0, 10) : null;
  if (when) parts.push(`updated ${when}`);
  return parts.reduce<React.ReactNode[]>((acc, p, i) => {
    if (i === 0) return [p];
    return [...acc, ' · ', p];
  }, []);
}

export default CalculatorForm;
