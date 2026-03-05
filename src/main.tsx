import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout/index.tsx';
import Calculator from './components/Calculator/index.tsx';
import CitiesComparison from './components/CitiesComparison/index.tsx';
import TaxCalculator from './components/TaxCalculator/index.tsx';

const router = createBrowserRouter([
  {
    Component: Layout,
    children: [
      { index: true, Component: Calculator },
      { path: 'calculator', Component: Calculator },
      { path: 'cities-comparison', Component: CitiesComparison },
      { path: 'tax-calculator', Component: TaxCalculator },
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
