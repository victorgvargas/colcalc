import { Helmet } from 'react-helmet-async';
import { useLocation, useMatch } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { fetchDatasetCities, type DatasetCity } from '../api/costOfLiving';
import { citySlug } from '../lib/slug';

const BASE_URL =
  typeof import.meta.env.VITE_SITE_URL === 'string' && import.meta.env.VITE_SITE_URL
    ? import.meta.env.VITE_SITE_URL.replace(/\/$/, '')
    : 'https://colcalc.fly.dev';

const OG_IMAGE = `${BASE_URL}/og-image.png`;

type PageMeta = {
  title: string;
  description: string;
  ogType: 'website' | 'article';
  keywords?: string;
};

const ROUTE_META: Record<string, PageMeta> = {
  '/': {
    title: 'Cost of Living Calculator',
    description:
      'Free cost of living calculator covering 4,800+ cities. Enter income, city, and family size to see monthly total costs and net budget.',
    ogType: 'website',
    keywords: 'cost of living calculator, monthly budget, expat budget, relocation calculator',
  },
  '/calculator': {
    title: 'Cost of Living Calculator',
    description:
      'Free cost of living calculator covering 4,800+ cities. Enter income, city, and family size to see monthly total costs and net budget.',
    ogType: 'article',
    keywords: 'cost of living calculator, monthly budget, expat budget, relocation calculator',
  },
  '/cities-comparison': {
    title: 'Compare Cost of Living Between Cities',
    description:
      'Side-by-side cost of living comparison across up to five cities. Rent, groceries, transport, utilities, and childcare in EUR.',
    ogType: 'article',
    keywords: 'cost of living comparison, compare cities, relocation comparison',
  },
  '/purchasing-power': {
    title: 'Purchasing Power Parity Calculator',
    description:
      'See what your income is worth in other cities. Purchasing power parity calculator using live cost-of-living data.',
    ogType: 'article',
    keywords: 'purchasing power parity, PPP calculator, salary comparison, international salary',
  },
  '/tax-calculator': {
    title: 'Income Tax Calculator (55 Countries)',
    description:
      'Estimate income tax and net salary in 55 countries, including the US, UK, Germany, France, Spain, Canada, Japan, and more.',
    ogType: 'article',
    keywords: 'income tax calculator, international tax calculator, net salary, take home pay',
  },
};

const DEFAULT_META: PageMeta = {
  title: 'ColCalc – Cost of Living & Tax Calculator',
  description:
    'Compare cost of living between cities, estimate income tax in 55 countries, and plan your budget. Free calculators covering 4,800+ cities.',
  ogType: 'website',
};

function parsePairSlug(slug: string | undefined): [string, string] | null {
  if (!slug) return null;
  const marker = '-vs-';
  const idx = slug.indexOf(marker);
  if (idx <= 0) return null;
  const a = slug.slice(0, idx);
  const b = slug.slice(idx + marker.length);
  return a && b ? [a, b] : null;
}

function useDatasetCities(): DatasetCity[] {
  const [cities, setCities] = useState<DatasetCity[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchDatasetCities()
      .then((d) => {
        if (!cancelled) setCities(d);
      })
      .catch(() => {
        /* absent dataset shouldn't crash SEO */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return cities;
}

export default function SEO() {
  const { pathname } = useLocation();
  const cityMatch = useMatch('/cost-of-living/:citySlug');
  const compareMatch = useMatch('/compare/:pairSlug');
  const cities = useDatasetCities();

  let meta: PageMeta = ROUTE_META[pathname] ?? DEFAULT_META;
  let canonical = `${BASE_URL}${pathname === '/' ? '' : pathname}`;
  let jsonLd: Record<string, unknown> | null = null;

  if (cityMatch?.params.citySlug) {
    const slug = cityMatch.params.citySlug;
    const entry = cities.find((c) => citySlug(c.city, c.country) === slug);
    if (entry) {
      meta = {
        title: `Cost of Living in ${entry.city}, ${entry.country}`,
        description: `Monthly cost of living in ${entry.city}, ${entry.country}. Rent, groceries, utilities, transport, and childcare estimates from our global dataset.`,
        ogType: 'article',
        keywords: `${entry.city} cost of living, ${entry.city} rent, living in ${entry.city}, ${entry.country} expenses`,
      };
      const rent = entry.prices.find((p) => p.category === 'Rent');
      jsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Place',
            name: `${entry.city}, ${entry.country}`,
            address: {
              '@type': 'PostalAddress',
              addressLocality: entry.city,
              addressCountry: entry.country,
            },
          },
          rent
            ? {
                '@type': 'MonetaryAmount',
                name: `Approximate monthly rent in ${entry.city}`,
                currency: 'USD',
                value: rent.usd,
              }
            : undefined,
        ].filter(Boolean),
      };
    } else {
      meta = {
        ...DEFAULT_META,
        title: 'City not found',
        description: 'The city you requested is not in our cost-of-living dataset.',
      };
    }
  } else if (compareMatch?.params.pairSlug) {
    const parsed = parsePairSlug(compareMatch.params.pairSlug);
    if (parsed) {
      const [slugA, slugB] = parsed;
      const a = cities.find((c) => citySlug(c.city, c.country) === slugA);
      const b = cities.find((c) => citySlug(c.city, c.country) === slugB);
      if (a && b) {
        meta = {
          title: `${a.city} vs ${b.city} — Cost of Living Comparison`,
          description: `Cost of living comparison between ${a.city}, ${a.country} and ${b.city}, ${b.country}. Rent, groceries, utilities, and monthly totals side by side.`,
          ogType: 'article',
          keywords: `${a.city} vs ${b.city}, ${a.city} cost of living, ${b.city} cost of living, compare ${a.city} and ${b.city}`,
        };
      }
    }
  } else if (pathname === '/calculator' || pathname === '/') {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'ColCalc Cost of Living Calculator',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      description: meta.description,
    };
  }

  const fullTitle = `${meta.title} | ColCalc`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={meta.description} />
      {meta.keywords && <meta name="keywords" content={meta.keywords} />}
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={meta.ogType} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:site_name" content="ColCalc" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={OG_IMAGE} />
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
