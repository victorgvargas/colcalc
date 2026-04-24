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
vi.mock('../../api/exchangeRates', () => ({
  getUsdRates: vi.fn(),
  getUsdToCurrencyRate: (
    rates: Record<string, number> | null,
    code: string,
    fallback: number,
  ) => rates?.[code.toLowerCase()] ?? fallback,
}));

import { fetchCities, fetchPricesForCity } from '../../api/costOfLiving';
import { getUsdRates } from '../../api/exchangeRates';
import CitiesComparison from './index';

beforeEach(() => {
  vi.mocked(fetchCities).mockResolvedValue([
    { cityName: 'Berlin', countryName: 'Germany' },
    { cityName: 'Paris', countryName: 'France' },
  ]);
  vi.mocked(getUsdRates).mockResolvedValue({ eur: 1 });
  vi.mocked(fetchPricesForCity).mockImplementation(async (city: string) => ({
    exchangeRate: null,
    prices: [
      {
        category_name: 'Utilities',
        item_name: 'Electricity',
        usd: { avg: city === 'Berlin' ? 100 : 200 },
      },
    ],
  }));
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('<CitiesComparison />', () => {
  it('renders two city inputs by default and a disabled Compare button', async () => {
    render(<CitiesComparison />);
    expect(screen.getAllByLabelText(/City \d/i)).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Compare/i })).toBeDisabled();
  });

  it('adds and removes city rows within the 2-5 bound', async () => {
    const user = userEvent.setup();
    render(<CitiesComparison />);

    await user.click(screen.getByRole('button', { name: /Add city/i }));
    expect(screen.getAllByLabelText(/City \d/i)).toHaveLength(3);

    const removes = screen.getAllByRole('button', { name: /Remove/i });
    await user.click(removes[0]);
    expect(screen.getAllByLabelText(/City \d/i)).toHaveLength(2);
  });

  it('refuses to add more than 5 cities', async () => {
    const user = userEvent.setup();
    render(<CitiesComparison />);
    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole('button', { name: /Add city/i }));
    }
    expect(screen.getAllByLabelText(/City \d/i)).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /Add city/i })).not.toBeInTheDocument();
  });

  it('runs the comparison and renders the chart legend', async () => {
    const user = userEvent.setup();
    render(<CitiesComparison />);

    await waitFor(() => expect(fetchCities).toHaveBeenCalled());

    const inputs = screen.getAllByRole('combobox', { name: /City \d/i });
    await user.type(inputs[0], 'Berlin');
    await user.keyboard('{Enter}');
    await user.type(inputs[1], 'Paris');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Compare/i })).not.toBeDisabled();
    });
    await user.click(screen.getByRole('button', { name: /Compare/i }));

    await waitFor(() => {
      expect(fetchPricesForCity).toHaveBeenCalledTimes(2);
    });
    // Heading for the chart appears once results arrive.
    expect(
      await screen.findByRole('heading', { name: /Monthly costs by category/i }),
    ).toBeInTheDocument();
  });

  it('surfaces an error when the API fails', async () => {
    vi.mocked(fetchPricesForCity).mockRejectedValueOnce(new Error('Dataset unreachable'));

    const user = userEvent.setup();
    render(<CitiesComparison />);
    await waitFor(() => expect(fetchCities).toHaveBeenCalled());

    const inputs = screen.getAllByRole('combobox', { name: /City \d/i });
    await user.type(inputs[0], 'Berlin');
    await user.keyboard('{Enter}');
    await user.type(inputs[1], 'Paris');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Compare/i })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: /Compare/i }));

    expect(await screen.findByText('Dataset unreachable')).toBeInTheDocument();
  });
});
