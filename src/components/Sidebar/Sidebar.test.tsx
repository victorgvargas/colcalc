import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Sidebar from './index';

function renderSidebar(sections: Parameters<typeof Sidebar>[0]['sections']) {
  return render(
    <MemoryRouter>
      <Sidebar sections={sections} />
    </MemoryRouter>,
  );
}

describe('<Sidebar />', () => {
  it('renders the header title and logo', () => {
    renderSidebar([]);
    expect(screen.getByText('ColCalc')).toBeInTheDocument();
    expect(screen.getByAltText('ColCalc Logo')).toBeInTheDocument();
  });

  it('renders all section items as links with the right hrefs', () => {
    renderSidebar([
      { title: 'Tools', items: [{ href: '/calculator', alt: 'Calculator' }] },
      { title: 'none', items: [{ href: '/purchasing-power', alt: 'Purchasing power' }] },
    ]);
    expect(screen.getByRole('link', { name: 'Calculator' })).toHaveAttribute('href', '/calculator');
    expect(screen.getByRole('link', { name: 'Purchasing power' })).toHaveAttribute(
      'href',
      '/purchasing-power',
    );
  });

  it('hides the section title when it equals "none"', () => {
    renderSidebar([{ title: 'none', items: [{ href: '/x', alt: 'X' }] }]);
    expect(screen.queryByRole('heading', { name: 'none' })).not.toBeInTheDocument();
  });

  it('shows the section title when not "none"', () => {
    renderSidebar([{ title: 'Tools', items: [{ href: '/x', alt: 'X' }] }]);
    expect(screen.getByText('Tools')).toBeInTheDocument();
  });

  it('renders the PayPal donate link with safe target/rel', () => {
    renderSidebar([]);
    const link = screen.getByRole('link', { name: /donate via paypal/i });
    expect(link).toHaveAttribute('href', 'https://www.paypal.me/VIctorVargas997');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
