import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Home from './components/Home/index.tsx';
import Layout from './components/Layout/index.tsx';
import './index.css';

const router = createBrowserRouter([
  {
    Component: Layout,
    children: [
      { index: true, Component: Home },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <RouterProvider router={router} />
  </StrictMode>,
)
