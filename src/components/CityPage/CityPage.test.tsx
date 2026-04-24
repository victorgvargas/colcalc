import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../api/costOfLiving', async () => {
  const actual = await vi.importActual<typeof import('../../api/costOfLiving')>(
    '../../api/costOfLiving',
  );
  return { ...actual, fetchDatasetCities: vi.fn() };
});

import { fetchDatasetCities } from '../../api/costOfLiving';
import CityPage from './index';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/cost-of-living/:citySlug" element={<CityPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(fetchDatasetCities).mockResolvedValue([
    {
      city: 'Berlin',
      country: 'Germany',
      prices: [
        { category: 'Rent Per Month', item: 'Apartment (1 bedroom) in City Centre', usd: 1200 },
        { category: 'Utilities', item: 'Electricity', usd: 200 },
      ],
    },
  ]);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('<CityPage />', () => {
  it('shows the city heading and the monthly total', async () => {
    renderAt('/cost-of-living/berlin-germany');
    expect(
      await screen.findByRole('heading', { name: /Cost of living in Berlin, Germany/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/\$1400/)).toBeInTheDocument();
  });

  it('renders the category breakdown sorted by value desc', async () => {
    renderAt('/cost-of-living/berlin-germany');
    await screen.findByRole('heading', { name: /Cost of living in Berlin/i });
    const rent = await screen.findByText('Rent:');
    const utilities = screen.getByText('Utilities:');
    // Rent has the higher value, so it should appear first in the DOM order.
    const order = rent.compareDocumentPosition(utilities);
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows a not-found state for unknown slugs', async () => {
    renderAt('/cost-of-living/atlantis-mu');
    expect(
      await screen.findByRole('heading', { name: /City not found/i }),
    ).toBeInTheDocument();
  });

  it('shows loading, then content', async () => {
    // Long-running fetch — still resolve it so the test doesn't hang.
    vi.mocked(fetchDatasetCities).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve([
                {
                  city: 'Berlin',
                  country: 'Germany',
                  prices: [{ category: 'Utilities', item: 'Electricity', usd: 100 }],
                },
              ]),
            20,
          ),
        ),
    );
    renderAt('/cost-of-living/berlin-germany');
    expect(screen.getByText(/Loading city/i)).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: /Cost of living in Berlin/i }),
    ).toBeInTheDocument();
  });
});
