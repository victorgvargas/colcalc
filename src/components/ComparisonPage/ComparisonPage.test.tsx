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
import ComparisonPage from './index';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/compare/:pairSlug" element={<ComparisonPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(fetchDatasetCities).mockResolvedValue([
    {
      city: 'Berlin',
      country: 'Germany',
      prices: [{ category: 'Utilities', item: 'Electricity', usd: 1000 }],
    },
    {
      city: 'Lisbon',
      country: 'Portugal',
      prices: [{ category: 'Utilities', item: 'Electricity', usd: 500 }],
    },
  ]);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('<ComparisonPage />', () => {
  it('renders the comparison heading and per-city totals', async () => {
    renderAt('/compare/berlin-germany-vs-lisbon-portugal');
    expect(
      await screen.findByRole('heading', {
        name: /Berlin, Germany vs Lisbon, Portugal/i,
      }),
    ).toBeInTheDocument();
    // "$1000" and "$500" appear in both the total and the category breakdown.
    expect(screen.getAllByText('$1000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$500').length).toBeGreaterThan(0);
  });

  it('computes a cheaper-city percentage', async () => {
    renderAt('/compare/berlin-germany-vs-lisbon-portugal');
    await screen.findByRole('heading', { name: /Berlin, Germany vs Lisbon/i });
    // (1000 - 500) / 1000 = 50%
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText(/Lisbon is about/i)).toBeInTheDocument();
  });

  it('shows a not-found state for malformed slugs', async () => {
    renderAt('/compare/berlin-germany');
    expect(
      await screen.findByRole('heading', { name: /Comparison not found/i }),
    ).toBeInTheDocument();
  });

  it('shows a not-found state when one of the cities is missing', async () => {
    renderAt('/compare/berlin-germany-vs-atlantis-mu');
    expect(
      await screen.findByRole('heading', { name: /Comparison not found/i }),
    ).toBeInTheDocument();
  });
});
