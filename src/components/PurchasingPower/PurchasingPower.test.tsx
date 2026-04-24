import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../api/costOfLiving', async () => {
  const actual = await vi.importActual<typeof import('../../api/costOfLiving')>(
    '../../api/costOfLiving',
  );
  return {
    ...actual,
    fetchCities: vi.fn(),
    fetchPricesForCity: vi.fn(),
  };
});

import { fetchCities, fetchPricesForCity } from '../../api/costOfLiving';
import PurchasingPower from './index';

beforeEach(() => {
  vi.mocked(fetchCities).mockResolvedValue([
    { cityName: 'Berlin', countryName: 'Germany' },
    { cityName: 'Lisbon', countryName: 'Portugal' },
  ]);
  vi.mocked(fetchPricesForCity).mockImplementation(async (city: string) => ({
    exchangeRate: null,
    prices: [
      {
        category_name: 'Utilities',
        item_name: 'Electricity',
        // Berlin baseline = 1000 USD total; Lisbon = 500 USD → Lisbon equivalent = 50% of base income.
        usd: { avg: city === 'Berlin' ? 1000 : 500 },
      },
    ],
  }));
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('<PurchasingPower />', () => {
  it('renders the 2-row setup and waits for both cities before enabling Compare', async () => {
    const user = userEvent.setup();
    render(<PurchasingPower />);
    expect(screen.getAllByLabelText(/City \d/i)).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Compare/i })).toBeDisabled();

    await waitFor(() => expect(fetchCities).toHaveBeenCalled());

    const inputs = screen.getAllByRole('combobox', { name: /City \d/i });
    await user.type(inputs[0], 'Berlin');
    await user.keyboard('{Enter}');
    await user.type(inputs[1], 'Lisbon');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Compare/i })).not.toBeDisabled(),
    );
  });

  it('computes equivalent incomes based on cost ratio', async () => {
    const user = userEvent.setup();
    render(<PurchasingPower />);
    await waitFor(() => expect(fetchCities).toHaveBeenCalled());

    const inputs = screen.getAllByRole('combobox', { name: /City \d/i });
    await user.type(inputs[0], 'Berlin');
    await user.keyboard('{Enter}');
    await user.type(inputs[1], 'Lisbon');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Compare/i })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: /Compare/i }));

    await screen.findByRole('heading', { name: /Equivalent incomes/i });
    await user.type(screen.getByLabelText(/Income in base city/i), '2000');

    // Lisbon cost is half of Berlin → equivalent income = 1000 EUR.
    await waitFor(() => {
      expect(screen.getByText(/Berlin, Germany: 2000\.00 EUR/)).toBeInTheDocument();
      expect(screen.getByText(/Lisbon, Portugal: 1000\.00 EUR/)).toBeInTheDocument();
    });
  });

  it('shows an API error when fetching fails', async () => {
    vi.mocked(fetchPricesForCity).mockRejectedValueOnce(new Error('Network down'));
    const user = userEvent.setup();
    render(<PurchasingPower />);
    await waitFor(() => expect(fetchCities).toHaveBeenCalled());

    const inputs = screen.getAllByRole('combobox', { name: /City \d/i });
    await user.type(inputs[0], 'Berlin');
    await user.keyboard('{Enter}');
    await user.type(inputs[1], 'Lisbon');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Compare/i })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: /Compare/i }));

    expect(await screen.findByText('Network down')).toBeInTheDocument();
  });
});
