import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ExpenditureBreakdown from './ExpenditureBreakdown';
import type { CalculationRecord } from './logic';

const record: CalculationRecord = {
  id: 1,
  city: 'Berlin',
  country: 'Germany',
  income: 5000,
  numberOfKids: 0,
  totalCosts: 2000,
  netBudget: 3000,
  currency: 'EUR',
  costBreakdown: [
    { name: 'Rent', value: 1200 },
    { name: 'Markets', value: 400 },
  ],
};

function LocationSpy() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

describe('<ExpenditureBreakdown /> Compare CTA', () => {
  it('does not render the CTA when no record is selected', () => {
    render(
      <MemoryRouter>
        <ExpenditureBreakdown data={[]} />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole('button', { name: /Compare with another city/i }),
    ).not.toBeInTheDocument();
  });

  it('renders the CTA when a record is selected', () => {
    render(
      <MemoryRouter>
        <ExpenditureBreakdown data={[{ name: 'Rent', value: 1200 }]} selectedRecord={record} />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('button', { name: /Compare with another city/i }),
    ).toBeInTheDocument();
  });

  it('navigates to /cities-comparison with the record prefilled in city1/country1', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/calculator']}>
        <Routes>
          <Route
            path="/calculator"
            element={
              <ExpenditureBreakdown data={[{ name: 'Rent', value: 1 }]} selectedRecord={record} />
            }
          />
          <Route path="/cities-comparison" element={<LocationSpy />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /Compare with another city/i }));

    const spy = screen.getByTestId('location');
    expect(spy.textContent).toContain('/cities-comparison');
    expect(spy.textContent).toContain('city1=Berlin');
    expect(spy.textContent).toContain('country1=Germany');
  });

  it('omits country1 when the record has no country (defensive)', async () => {
    const user = userEvent.setup();
    const recordWithoutCountry = { ...record, country: '' };
    render(
      <MemoryRouter initialEntries={['/calculator']}>
        <Routes>
          <Route
            path="/calculator"
            element={
              <ExpenditureBreakdown
                data={[{ name: 'Rent', value: 1 }]}
                selectedRecord={recordWithoutCountry}
              />
            }
          />
          <Route path="/cities-comparison" element={<LocationSpy />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /Compare with another city/i }));

    const spy = screen.getByTestId('location');
    expect(spy.textContent).toContain('city1=Berlin');
    expect(spy.textContent).not.toContain('country1=');
  });
});

describe('<ExpenditureBreakdown /> price-point caption', () => {
  it('renders "Based on N price points" when a record and count are provided', () => {
    render(
      <MemoryRouter>
        <ExpenditureBreakdown
          data={[{ name: 'Rent', value: 1 }]}
          selectedRecord={record}
          pricePointCount={23}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Based on 23 price points/)).toBeInTheDocument();
  });

  it('pluralizes correctly for 1', () => {
    render(
      <MemoryRouter>
        <ExpenditureBreakdown
          data={[{ name: 'Rent', value: 1 }]}
          selectedRecord={record}
          pricePointCount={1}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Based on 1 price point$/)).toBeInTheDocument();
  });

  it('hides the caption when no record is selected', () => {
    render(
      <MemoryRouter>
        <ExpenditureBreakdown data={[]} pricePointCount={10} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Based on/)).not.toBeInTheDocument();
  });

  it('hides the caption when count is missing even if a record is selected', () => {
    render(
      <MemoryRouter>
        <ExpenditureBreakdown
          data={[{ name: 'Rent', value: 1 }]}
          selectedRecord={record}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Based on/)).not.toBeInTheDocument();
  });
});
