import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopCitiesDirectory from './index';
import directory from '../../data/topCities.json';

describe('<TopCitiesDirectory />', () => {
  it('links each city to its SEO page using the slug', () => {
    render(
      <MemoryRouter>
        <TopCitiesDirectory />
      </MemoryRouter>,
    );
    const first = directory.cities[0];
    const link = screen.getByRole('link', { name: first.city });
    expect(link).toHaveAttribute('href', `/cost-of-living/${first.slug}`);
  });

  it('renders as many city links as the directory contains', () => {
    render(
      <MemoryRouter>
        <TopCitiesDirectory />
      </MemoryRouter>,
    );
    for (const c of directory.cities) {
      expect(screen.getByRole('link', { name: c.city })).toHaveAttribute(
        'href',
        `/cost-of-living/${c.slug}`,
      );
    }
  });

  it('renders city-comparison links when pairs exist', () => {
    render(
      <MemoryRouter>
        <TopCitiesDirectory />
      </MemoryRouter>,
    );
    if (directory.pairs.length === 0) return;
    const heading = screen.getByRole('heading', { name: /popular city comparisons/i });
    expect(heading).toBeInTheDocument();
    const list = heading.nextElementSibling as HTMLElement;
    const pair = directory.pairs[0];
    const link = within(list).getByRole('link', {
      name: `${pair.a.city} vs ${pair.b.city}`,
    });
    expect(link).toHaveAttribute('href', `/compare/${pair.slug}`);
  });
});
