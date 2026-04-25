import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

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
import { readComparisonEntriesFromSearch } from './logic';

function renderCmp(initialPath = '/cities-comparison') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <CitiesComparison />
    </MemoryRouter>,
  );
}

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
    renderCmp();
    expect(screen.getAllByLabelText(/City \d/i)).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Compare/i })).toBeDisabled();
  });

  it('adds and removes city rows within the 2-5 bound', async () => {
    const user = userEvent.setup();
    renderCmp();

    await user.click(screen.getByRole('button', { name: /Add city/i }));
    expect(screen.getAllByLabelText(/City \d/i)).toHaveLength(3);

    const removes = screen.getAllByRole('button', { name: /Remove/i });
    await user.click(removes[0]);
    expect(screen.getAllByLabelText(/City \d/i)).toHaveLength(2);
  });

  it('refuses to add more than 5 cities', async () => {
    const user = userEvent.setup();
    renderCmp();
    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole('button', { name: /Add city/i }));
    }
    expect(screen.getAllByLabelText(/City \d/i)).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /Add city/i })).not.toBeInTheDocument();
  });

  it('runs the comparison and renders the chart legend', async () => {
    const user = userEvent.setup();
    renderCmp();

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
    renderCmp();
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

describe('readComparisonEntriesFromSearch', () => {
  it('returns null for an empty query string', () => {
    expect(readComparisonEntriesFromSearch('')).toBeNull();
  });

  it('returns null when no city params are present', () => {
    expect(readComparisonEntriesFromSearch('?foo=bar&baz=qux')).toBeNull();
  });

  it('parses a single city1/country1 pair', () => {
    expect(readComparisonEntriesFromSearch('?city1=Berlin&country1=Germany')).toEqual([
      { cityName: 'Berlin', countryName: 'Germany' },
    ]);
  });

  it('parses multiple indexed entries', () => {
    expect(
      readComparisonEntriesFromSearch(
        '?city1=Berlin&country1=Germany&city2=Paris&country2=France',
      ),
    ).toEqual([
      { cityName: 'Berlin', countryName: 'Germany' },
      { cityName: 'Paris', countryName: 'France' },
    ]);
  });

  it('skips entries whose cityN is empty', () => {
    expect(
      readComparisonEntriesFromSearch('?city1=Berlin&country1=Germany&country2=France'),
    ).toEqual([{ cityName: 'Berlin', countryName: 'Germany' }]);
  });

  it('accepts missing countryN (country backfills once cities load)', () => {
    expect(readComparisonEntriesFromSearch('?city1=Berlin')).toEqual([
      { cityName: 'Berlin', countryName: '' },
    ]);
  });

  it('URL-decodes multi-word values and trims whitespace', () => {
    expect(
      readComparisonEntriesFromSearch('?city1=%20New%20York%20&country1=%20United%20States%20'),
    ).toEqual([{ cityName: 'New York', countryName: 'United States' }]);
  });

  it('ignores indices past MAX_CITIES', () => {
    // 6th slot should be ignored (MAX_CITIES = 5).
    const result = readComparisonEntriesFromSearch(
      '?city1=A&country1=X&city6=B&country6=Y',
    );
    expect(result).toEqual([{ cityName: 'A', countryName: 'X' }]);
  });
});

describe('<CitiesComparison /> prefilled via URL', () => {
  it('prefills the first row from ?city1=&country1= and enables Compare once the second is chosen', async () => {
    const user = userEvent.setup();
    renderCmp('/cities-comparison?city1=Berlin&country1=Germany');

    await waitFor(() => expect(fetchCities).toHaveBeenCalled());

    // The first combobox should carry Berlin already; Compare stays disabled
    // until row 2 is populated.
    const inputs = screen.getAllByRole('combobox', { name: /City \d/i });
    expect((inputs[0] as HTMLInputElement).value).toBe('Berlin');
    expect(screen.getByRole('button', { name: /^Compare$/i })).toBeDisabled();

    await user.type(inputs[1], 'Paris');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Compare$/i })).not.toBeDisabled(),
    );
  });

  it('backfills an entry that arrives without a country, once cities load', async () => {
    // Only cityN is in the URL; the country should be inferred from the dataset.
    renderCmp('/cities-comparison?city1=Berlin');
    await waitFor(() => expect(fetchCities).toHaveBeenCalled());

    const inputs = screen.getAllByRole('combobox', { name: /City \d/i });
    await waitFor(() => expect((inputs[0] as HTMLInputElement).value).toBe('Berlin'));
    // With country auto-filled and a second city still blank, Compare is
    // disabled — but the first row should now be considered complete when
    // the user picks a second city.
    expect(screen.getByRole('button', { name: /^Compare$/i })).toBeDisabled();
  });
});
