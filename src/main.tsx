import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Home from './components/Home/index.tsx';
import Layout from './components/Layout/index.tsx';
import Calculator from './components/Calculator/index.tsx';
import CitiesComparison from './components/CitiesComparison/index.tsx';

const router = createBrowserRouter([
  {
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: 'calculator', Component: Calculator },
      { path: 'cities-comparison', Component: CitiesComparison },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <RouterProvider router={router} />
  </StrictMode>,
)
