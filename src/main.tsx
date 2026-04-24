import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout/index.tsx';
import Calculator from './components/Calculator/index.tsx';
import CitiesComparison from './components/CitiesComparison/index.tsx';
import PurchasingPower from './components/PurchasingPower/index.tsx';
import TaxCalculator from './components/TaxCalculator/index.tsx';
import CityPage from './components/CityPage/index.tsx';
import ComparisonPage from './components/ComparisonPage/index.tsx';

const router = createBrowserRouter([
  {
    Component: Layout,
    children: [
      { index: true, Component: Calculator },
      { path: 'calculator', Component: Calculator },
      { path: 'cities-comparison', Component: CitiesComparison },
      { path: 'purchasing-power', Component: PurchasingPower },
      { path: 'tax-calculator', Component: TaxCalculator },
      { path: 'cost-of-living/:citySlug', Component: CityPage },
      { path: 'compare/:pairSlug', Component: ComparisonPage },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <RouterProvider router={router} />
    </HelmetProvider>
  </StrictMode>,
)
