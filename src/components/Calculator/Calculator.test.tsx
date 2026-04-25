import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Calculator from './index';
import type { ApiPriceItem } from '../../api/costOfLiving';

// Module mocks so the component never hits the real network.
vi.mock('../../api/costOfLiving', async () => {
  const actual = await vi.importActual<typeof import('../../api/costOfLiving')>(
    '../../api/costOfLiving',
  );
  return {
    ...actual,
    fetchCities: vi.fn(),
    fetchPricesForCity: vi.fn(),
    fetchDatasetMeta: vi.fn(),
  };
});

vi.mock('../../api/exchangeRates', () => ({
  getUsdRates: vi.fn(),
  getUsdToCurrencyRate: (
    rates: Record<string, number> | null,
    code: string,
    fallback: number,
  ) => {
    const rate = rates?.[code.toLowerCase()];
    return typeof rate === 'number' && rate > 0 ? rate : fallback;
  },
}));

vi.mock('../../api/taxRates', () => ({
  fetchTaxCountries: vi.fn(),
  fetchIncomeTax: vi.fn(),
  countryNameToCode: vi.fn(),
}));

// Keep the JSDOM-heavy directory out of the way — only test the Calculator here.
vi.mock('../TopCitiesDirectory', () => ({
  default: () => null,
}));

import { fetchCities, fetchDatasetMeta, fetchPricesForCity } from '../../api/costOfLiving';
import { getUsdRates } from '../../api/exchangeRates';
import {
  countryNameToCode,
  fetchIncomeTax,
  fetchTaxCountries,
} from '../../api/taxRates';

function renderCalculator(initialEntry = '/calculator') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/calculator" element={<Calculator />} />
      </Routes>
    </MemoryRouter>,
  );
}

const berlinPrices: ApiPriceItem[] = [
  { category_name: 'Rent Per Month', item_name: 'Apartment (1 bedroom) in City Centre', usd: { avg: 1200 } },
  { category_name: 'Rent Per Month', item_name: 'Apartment (1 bedroom) Outside of Centre', usd: { avg: 800 } },
  { category_name: 'Utilities (Monthly)', item_name: 'Electricity', usd: { avg: 200 } },
  { category_name: 'Internet', item_name: 'Home internet', usd: { avg: 40 } },
];

beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetchCities).mockResolvedValue([
    { cityName: 'Berlin', countryName: 'Germany' },
    { cityName: 'Paris', countryName: 'France' },
  ]);
  vi.mocked(fetchPricesForCity).mockResolvedValue({
    prices: berlinPrices,
    exchangeRate: null,
    pricePointCount: berlinPrices.length,
  });
  vi.mocked(fetchDatasetMeta).mockResolvedValue({
    source: 'https://example.com/dataset',
    generatedAt: '2026-04-24T10:00:00.000Z',
    cityCount: 4869,
  });
  vi.mocked(getUsdRates).mockResolvedValue({ eur: 0.9, usd: 1 });
  vi.mocked(fetchTaxCountries).mockResolvedValue([
    { code: 'de', name: 'Germany', currency: 'EUR', taxYear: 2026 },
  ]);
  vi.mocked(fetchIncomeTax).mockResolvedValue({
    country: 'DE',
    currency: 'EUR',
    taxYear: 2026,
    rates: { effectiveTaxRate: 0.3 },
  });
  vi.mocked(countryNameToCode).mockReturnValue('de');
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('<Calculator /> happy path', () => {
  it('runs a calculation and writes a record into the history table', async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.type(screen.getByLabelText(/Monthly Income/i), '5000');
    await user.type(screen.getByRole('combobox', { name: /City/i }), 'Berlin');
    await user.keyboard('{Enter}');

    // Country should auto-fill now that the city is recognized.
    const countryInput = screen.getByLabelText(/Country/i) as HTMLInputElement;
    await waitFor(() => expect(countryInput.value).toBe('Germany'));

    await user.click(screen.getByRole('button', { name: /Calculate/i }));

    await waitFor(() => {
      expect(fetchPricesForCity).toHaveBeenCalledWith('Berlin', 'Germany');
    });

    // History row should appear with city/country values.
    const table = screen.getByRole('table');
    const bodyRow = within(table).getAllByRole('row').find((r) => within(r).queryByText('Berlin'));
    expect(bodyRow).toBeTruthy();
    expect(within(bodyRow!).getByText('Germany')).toBeInTheDocument();
  });

  it('defaults to city-centre rent and uses that in the total', async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.type(screen.getByLabelText(/Monthly Income/i), '5000');
    await user.type(screen.getByRole('combobox', { name: /City/i }), 'Berlin');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect((screen.getByLabelText(/Country/i) as HTMLInputElement).value).toBe('Germany'),
    );
    await user.click(screen.getByRole('button', { name: /Calculate/i }));

    // Centre rent 1200 + utilities 200 + internet 40 = 1440 USD
    // Converted to EUR at 0.9 per USD = 1296
    await waitFor(() => {
      expect(screen.getByText(/Total costs: 1296\.00 EUR/)).toBeInTheDocument();
    });
  });
});

describe('<Calculator /> tax integration', () => {
  it('applies effective tax rate to income when the toggle is on', async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.type(screen.getByLabelText(/Monthly Income/i), '5000');
    await user.type(screen.getByRole('combobox', { name: /City/i }), 'Berlin');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect((screen.getByLabelText(/Country/i) as HTMLInputElement).value).toBe('Germany'),
    );

    await user.click(screen.getByRole('checkbox', { name: /Apply estimated income tax/i }));
    await user.click(screen.getByRole('button', { name: /Calculate/i }));

    await waitFor(() => expect(fetchIncomeTax).toHaveBeenCalled());

    // 30% tax on 5000 EUR gross => 3500 EUR net, minus 1296 EUR total = 2204
    await waitFor(() => {
      expect(screen.getByText(/Net income \(after 30.0% tax\):/)).toBeInTheDocument();
      expect(screen.getByText(/Net budget: 2204\.00 EUR/)).toBeInTheDocument();
    });
  });

  it('warns but still calculates when the country is not in rel.tax', async () => {
    vi.mocked(countryNameToCode).mockReturnValue(null);
    const user = userEvent.setup();
    renderCalculator();

    await user.type(screen.getByLabelText(/Monthly Income/i), '5000');
    await user.type(screen.getByRole('combobox', { name: /City/i }), 'Berlin');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect((screen.getByLabelText(/Country/i) as HTMLInputElement).value).toBe('Germany'),
    );

    await user.click(screen.getByRole('checkbox', { name: /Apply estimated income tax/i }));
    await user.click(screen.getByRole('button', { name: /Calculate/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/rel\.tax doesn't cover Germany/i),
      ).toBeInTheDocument();
      // Falls back to gross: 5000 - 1296 = 3704
      expect(screen.getByText(/Net budget: 3704\.00 EUR/)).toBeInTheDocument();
    });

    // The history row should show gross income (no net-of-tax caption).
    const table = screen.getByRole('table');
    expect(within(table).queryByText(/net of .*% tax/i)).not.toBeInTheDocument();
  });
});

describe('<Calculator /> localStorage persistence', () => {
  it('reads existing records from localStorage on mount', async () => {
    localStorage.setItem(
      'colcalc_records',
      JSON.stringify([
        {
          id: 1,
          city: 'Rome',
          country: 'Italy',
          income: 3000,
          numberOfKids: 0,
          totalCosts: 2000,
          netBudget: 1000,
          currency: 'EUR',
        },
      ]),
    );

    renderCalculator();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Rome')).toBeInTheDocument();
    expect(within(table).getByText('Italy')).toBeInTheDocument();
  });

  it('persists a new record to localStorage after calculate', async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.type(screen.getByLabelText(/Monthly Income/i), '5000');
    await user.type(screen.getByRole('combobox', { name: /City/i }), 'Berlin');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect((screen.getByLabelText(/Country/i) as HTMLInputElement).value).toBe('Germany'),
    );
    await user.click(screen.getByRole('button', { name: /Calculate/i }));

    await waitFor(() => {
      const stored = localStorage.getItem('colcalc_records');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed[0].city).toBe('Berlin');
      expect(parsed[0].income).toBe(5000);
    });
  });
});

describe('<Calculator /> share link', () => {
  it('restores state from a share URL', () => {
    renderCalculator('/calculator?income=4000&currency=EUR&city=Berlin&country=Germany&kids=2&rent=outskirts');
    expect((screen.getByLabelText(/Monthly Income/i) as HTMLInputElement).value).toBe('4000');
    expect((screen.getByRole('combobox', { name: /City/i }) as HTMLInputElement).value).toBe('Berlin');
    expect((screen.getByLabelText(/Number of kids/i) as HTMLInputElement).value).toBe('2');
  });

  it('copies a shareable URL to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    expect(window.navigator.clipboard.writeText).toBe(writeText);

    renderCalculator('/calculator?income=4200&currency=EUR&city=Berlin&country=Germany');

    const shareButton = await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Copy shareable link/i });
      expect(btn).not.toBeDisabled();
      return btn;
    });
    fireEvent.click(shareButton);
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const url = writeText.mock.calls[0][0] as string;
    expect(url).toContain('income=4200');
    expect(url).toContain('city=Berlin');
    expect(url).toContain('currency=EUR');
  });
});

describe('<Calculator /> validation', () => {
  it('shows an error when income is missing', async () => {
    const user = userEvent.setup();
    renderCalculator();
    await user.click(screen.getByRole('button', { name: /Calculate/i }));
    expect(
      await screen.findByText(/Please provide a valid income, city, and country/i),
    ).toBeInTheDocument();
  });

  it('Reset clears the form and tax state', async () => {
    const user = userEvent.setup();
    renderCalculator();
    await user.type(screen.getByLabelText(/Monthly Income/i), '1234');
    await user.click(screen.getByRole('checkbox', { name: /Apply estimated income tax/i }));
    await user.click(screen.getByRole('button', { name: /Reset/i }));
    expect((screen.getByLabelText(/Monthly Income/i) as HTMLInputElement).value).toBe('');
    expect(
      (screen.getByRole('checkbox', { name: /Apply estimated income tax/i }) as HTMLInputElement)
        .checked,
    ).toBe(false);
  });
});

describe('<Calculator /> data provenance', () => {
  it('renders the "Data from … cities … updated …" caption once the metadata loads', async () => {
    renderCalculator();
    // Caption is rendered inside the form card, below the Calculate/Reset row.
    await waitFor(() => {
      expect(screen.getByText(/Data from/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/4,869 cities/)).toBeInTheDocument();
    expect(screen.getByText(/updated 2026-04-24/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /open Cost of Living dataset/i });
    expect(link).toHaveAttribute('href', 'https://example.com/dataset');
  });

  it('shows "Based on N price points" in the breakdown after a calculation', async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.type(screen.getByLabelText(/Monthly Income/i), '5000');
    await user.type(screen.getByRole('combobox', { name: /City/i }), 'Berlin');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect((screen.getByLabelText(/Country/i) as HTMLInputElement).value).toBe('Germany'),
    );
    await user.click(screen.getByRole('button', { name: /Calculate/i }));

    await waitFor(() => {
      expect(screen.getByText(/Based on 4 price points/)).toBeInTheDocument();
    });
  });
});
