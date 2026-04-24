import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Layout from './index';

// Stub Assistant so this test doesn't depend on VITE_GEMINI_API_KEY or network.
vi.mock('../Assistant', () => ({
  default: () => <div data-testid="assistant" />,
}));
// SEO mixes react-router imports with react-router-dom; stub it out — we're not
// testing the Helmet output here.
vi.mock('../SEO', () => ({
  default: () => null,
}));
// Sidebar imports NavLink from react-router directly. Bridge it to whichever
// router provider the enclosing test set up by rendering raw anchor tags.
vi.mock('../Sidebar', () => ({
  default: ({ sections }: { sections: { title: string; items: { href: string; alt: string }[] }[] }) => (
    <nav>
      {sections.flatMap((s) => s.items).map((i) => (
        <a key={i.href} href={i.href}>
          {i.alt}
        </a>
      ))}
    </nav>
  ),
}));

describe('<Layout />', () => {
  it('renders the sidebar nav links + outlet content', () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/calculator']}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route path="calculator" element={<div>Outlet content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(screen.getByText('Outlet content')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Calculator' })).toHaveAttribute(
      'href',
      '/calculator',
    );
    expect(screen.getByRole('link', { name: 'Cities comparison' })).toHaveAttribute(
      'href',
      '/cities-comparison',
    );
    expect(screen.getByRole('link', { name: /purchasing power parity/i })).toHaveAttribute(
      'href',
      '/purchasing-power',
    );
    expect(screen.getByRole('link', { name: /tax calculator/i })).toHaveAttribute(
      'href',
      '/tax-calculator',
    );
    expect(screen.getByTestId('assistant')).toBeInTheDocument();
  });
});
