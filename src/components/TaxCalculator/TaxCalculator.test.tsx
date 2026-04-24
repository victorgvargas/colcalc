import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TaxCalculator from './index';

vi.mock('../../api/costOfLiving', async () => {
  const actual = await vi.importActual<typeof import('../../api/costOfLiving')>(
    '../../api/costOfLiving',
  );
  return { ...actual, fetchCities: vi.fn() };
});
vi.mock('../../api/exchangeRates', () => ({
  getUsdRates: vi.fn(),
  getUsdToCurrencyRate: (
    rates: Record<string, number> | null,
    code: string,
    fallback: number,
  ) => rates?.[code.toLowerCase()] ?? fallback,
}));
vi.mock('../../api/taxRates', () => ({
  fetchTaxCountries: vi.fn(),
  fetchIncomeTax: vi.fn(),
  countryNameToCode: vi.fn(),
}));

import { fetchCities } from '../../api/costOfLiving';
import { getUsdRates } from '../../api/exchangeRates';
import {
  countryNameToCode,
  fetchIncomeTax,
  fetchTaxCountries,
} from '../../api/taxRates';

function renderTaxCalc() {
  return render(
    <MemoryRouter initialEntries={['/tax-calculator']}>
      <Routes>
        <Route path="/tax-calculator" element={<TaxCalculator />} />
        <Route path="/calculator" element={<div data-testid="calculator-route" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(fetchCities).mockResolvedValue([
    { cityName: 'Berlin', countryName: 'Germany' },
  ]);
  vi.mocked(getUsdRates).mockResolvedValue({ eur: 0.9 });
  vi.mocked(fetchTaxCountries).mockResolvedValue([
    { code: 'de', name: 'Germany', currency: 'EUR', taxYear: 2026 },
  ]);
  vi.mocked(countryNameToCode).mockReturnValue('de');
  vi.mocked(fetchIncomeTax).mockResolvedValue({
    country: 'DE',
    currency: 'EUR',
    taxYear: 2026,
    yearly: { gross: 60000, net: 42000, incomeTax: 18000 },
    monthly: { net: 3500 },
    rates: { effectiveTaxRate: 0.3 },
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('<TaxCalculator />', () => {
  it('renders the form heading and rel.tax attribution link', async () => {
    renderTaxCalc();
    expect(
      await screen.findByText(/Estimate income tax by country and income/i),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /rel\.tax/i });
    expect(link).toHaveAttribute('href', 'https://rel.tax/');
  });

  it('disables the calculate button until a country is chosen', async () => {
    renderTaxCalc();
    await waitFor(() => expect(fetchTaxCountries).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /Calculate tax/i })).toBeDisabled();
  });

  it('displays the API result and a handoff button', async () => {
    const user = userEvent.setup();
    renderTaxCalc();

    await waitFor(() => expect(fetchTaxCountries).toHaveBeenCalled());

    // Select the country via native select.
    const countrySelect = await screen.findByRole('combobox', { name: /Country/i });
    await user.click(countrySelect);
    const germanyOption = await screen.findByRole('option', { name: 'Germany' });
    await user.click(germanyOption);

    await user.type(screen.getByLabelText(/Annual income/i), '60000');
    await user.click(screen.getByRole('button', { name: /Calculate tax/i }));

    await waitFor(() => expect(fetchIncomeTax).toHaveBeenCalledWith('de', 60000));

    expect(await screen.findByText(/Net yearly: 42000\.00 EUR/)).toBeInTheDocument();
    expect(screen.getByText(/Net monthly: 3500\.00 EUR/)).toBeInTheDocument();
    expect(screen.getByText(/Effective tax rate: 30\.0%/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Use net income in Cost of Living Calculator/i }),
    ).toBeInTheDocument();
  });

  it('surfaces API errors', async () => {
    vi.mocked(fetchIncomeTax).mockRejectedValue(new Error('Unsupported country'));

    const user = userEvent.setup();
    renderTaxCalc();
    await waitFor(() => expect(fetchTaxCountries).toHaveBeenCalled());

    const countrySelect = await screen.findByRole('combobox', { name: /Country/i });
    await user.click(countrySelect);
    const option = await screen.findByRole('option', { name: 'Germany' });
    await user.click(option);

    await user.type(screen.getByLabelText(/Annual income/i), '50000');
    await user.click(screen.getByRole('button', { name: /Calculate tax/i }));

    expect(await screen.findByText('Unsupported country')).toBeInTheDocument();
  });
});
