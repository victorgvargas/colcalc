import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const BASE_URL = typeof import.meta.env.VITE_SITE_URL === 'string' && import.meta.env.VITE_SITE_URL
  ? import.meta.env.VITE_SITE_URL.replace(/\/$/, '')
  : 'https://colcalc.fly.dev';

const ROUTE_META: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Cost of Living Calculator',
    description: 'Calculate monthly cost of living for any city. Enter your income in EUR, city, and number of kids to see total costs and net budget.',
  },
  '/calculator': {
    title: 'Cost of Living Calculator',
    description: 'Calculate monthly cost of living for any city. Enter your income in EUR, city, and number of kids to see total costs and net budget.',
  },
  '/cities-comparison': {
    title: 'Cities Comparison',
    description: 'Compare cost of living and quality of life across multiple cities. Plan your move or relocation with side-by-side city data in EUR.',
  },
  '/tax-calculator': {
    title: 'Tax Calculator',
    description: 'Estimate your tax burden and take-home pay. Tax calculator with results shown in EUR.',
  },
};

const DEFAULT_META = {
  title: 'ColCalc – Cost of Living & Tax Calculator',
  description: 'Compare cost of living between cities, estimate taxes, and plan your budget. Free calculators in EUR.',
};

export default function SEO() {
  const { pathname } = useLocation();
  const meta = ROUTE_META[pathname] ?? DEFAULT_META;
  const canonical = `${BASE_URL}${pathname === '/' ? '' : pathname}`;

  return (
    <Helmet>
      <title>{meta.title} | ColCalc</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={`${meta.title} | ColCalc`} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={canonical} />
      <meta name="twitter:title" content={`${meta.title} | ColCalc`} />
      <meta name="twitter:description" content={meta.description} />
    </Helmet>
  );
}
