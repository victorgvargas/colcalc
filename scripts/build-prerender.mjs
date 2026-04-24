#!/usr/bin/env node
/**
 * Post-build static HTML generator.
 *
 * For each high-value route we emit a copy of dist/index.html with per-route
 * <head> tags (title, description, canonical, Open Graph, JSON-LD) patched in.
 * The body stays empty — React hydrates it client-side — but bots crawling
 * without a JS runtime see correct metadata immediately.
 *
 * This is a pragmatic middle ground between "SPA with Helmet" (invisible to
 * flaky crawlers) and full SSG (painful on React Router 7 + Vite 7 today).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');
const DATASET = resolve(ROOT, 'public', 'cost-of-living.json');
const TOP_CITIES = resolve(ROOT, 'src', 'data', 'topCities.json');
const INDEX_HTML = join(DIST, 'index.html');

const SITE_URL = (process.env.VITE_SITE_URL || 'https://colcalc.vercel.app').replace(/\/$/, '');
const OG_IMAGE = `${SITE_URL}/og-image.png`;

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function citySlug(city, country) {
  return `${slugify(city)}-${slugify(country)}`;
}

function esc(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function buildHead({ title, description, canonical, ogType, jsonLd, keywords }) {
  const full = `${title} | ColCalc`;
  const ldTag = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    : '';
  const kwTag = keywords ? `<meta name="keywords" content="${esc(keywords)}" />` : '';
  return `
    <title>${esc(full)}</title>
    <meta name="description" content="${esc(description)}" />
    ${kwTag}
    <link rel="canonical" href="${esc(canonical)}" />
    <meta property="og:title" content="${esc(full)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:type" content="${esc(ogType)}" />
    <meta property="og:image" content="${esc(OG_IMAGE)}" />
    <meta property="og:site_name" content="ColCalc" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(full)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(OG_IMAGE)}" />
    ${ldTag}
  `.trim();
}

/**
 * Patch <head> in the built index.html: replace the default <title>, add the
 * route-specific tags. We key off the existing <title> tag and the meta
 * description so the order of tags we emit matches what react-helmet-async
 * would render at runtime.
 */
function emitRoute(template, pathname, head) {
  // Replace default title line.
  const withTitle = template.replace(
    /<title>[^<]*<\/title>/,
    '',
  );
  // Strip the default description we set in index.html so per-route one wins.
  const withoutStaticDescription = withTitle
    .replace(/<meta name="description"[^>]*\/>/, '')
    .replace(/<meta name="keywords"[^>]*\/>/, '')
    .replace(/<link rel="canonical"[^>]*\/>/, '');

  // Strip the default Open Graph / Twitter / JSON-LD blocks so we don't duplicate.
  const withoutOg = withoutStaticDescription
    .replace(/<meta property="og:[^"]+"[^>]*\/>/g, '')
    .replace(/<meta name="twitter:[^"]+"[^>]*\/>/g, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

  const patched = withoutOg.replace(
    /<\/head>/,
    `${head}\n  </head>`,
  );

  const outDir = pathname === '/' ? DIST : join(DIST, pathname.replace(/^\//, ''));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), patched);
}

function main() {
  const template = readFileSync(INDEX_HTML, 'utf8');
  const dataset = JSON.parse(readFileSync(DATASET, 'utf8'));
  const { cities: topCities, pairs: topPairs } = JSON.parse(readFileSync(TOP_CITIES, 'utf8'));
  const byKey = new Map();
  for (const c of dataset.cities) byKey.set(`${c.city.toLowerCase()}|${c.country.toLowerCase()}`, c);

  const routes = [];

  // Core routes.
  routes.push({
    path: '/calculator',
    head: buildHead({
      title: 'Cost of Living Calculator',
      description:
        'Free cost of living calculator covering 4,800+ cities. Enter income, city, and family size to see monthly total costs and net budget.',
      canonical: `${SITE_URL}/calculator`,
      ogType: 'article',
      keywords: 'cost of living calculator, monthly budget, expat budget, relocation calculator',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'ColCalc Cost of Living Calculator',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      },
    }),
  });

  routes.push({
    path: '/cities-comparison',
    head: buildHead({
      title: 'Compare Cost of Living Between Cities',
      description:
        'Side-by-side cost of living comparison across up to five cities. Rent, groceries, transport, utilities, and childcare in EUR.',
      canonical: `${SITE_URL}/cities-comparison`,
      ogType: 'article',
      keywords: 'cost of living comparison, compare cities, relocation comparison',
    }),
  });

  routes.push({
    path: '/purchasing-power',
    head: buildHead({
      title: 'Purchasing Power Parity Calculator',
      description:
        'See what your income is worth in other cities. Purchasing power parity calculator using live cost-of-living data.',
      canonical: `${SITE_URL}/purchasing-power`,
      ogType: 'article',
      keywords: 'purchasing power parity, PPP calculator, salary comparison',
    }),
  });

  routes.push({
    path: '/tax-calculator',
    head: buildHead({
      title: 'Income Tax Calculator (55 Countries)',
      description:
        'Estimate income tax and net salary in 55 countries, including the US, UK, Germany, France, Spain, Canada, Japan, and more.',
      canonical: `${SITE_URL}/tax-calculator`,
      ogType: 'article',
      keywords: 'income tax calculator, international tax calculator, net salary',
    }),
  });

  // City landings — only the curated top set gets per-file prerender (bots find
  // the rest via sitemap + React Helmet).
  for (const c of topCities) {
    const slug = c.slug;
    const entry = byKey.get(`${c.city.toLowerCase()}|${c.country.toLowerCase()}`);
    const rent = entry?.prices?.find((p) => p.category === 'Rent');
    routes.push({
      path: `/cost-of-living/${slug}`,
      head: buildHead({
        title: `Cost of Living in ${c.city}, ${c.country}`,
        description: `Monthly cost of living in ${c.city}, ${c.country}. Rent, groceries, utilities, transport, and childcare estimates from our global dataset.`,
        canonical: `${SITE_URL}/cost-of-living/${slug}`,
        ogType: 'article',
        keywords: `${c.city} cost of living, ${c.city} rent, living in ${c.city}, ${c.country} expenses`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Place',
              name: `${c.city}, ${c.country}`,
              address: { '@type': 'PostalAddress', addressLocality: c.city, addressCountry: c.country },
            },
            rent
              ? {
                  '@type': 'MonetaryAmount',
                  name: `Approximate monthly rent in ${c.city}`,
                  currency: 'USD',
                  value: rent.usd,
                }
              : null,
          ].filter(Boolean),
        },
      }),
    });
  }

  // Comparison pairs.
  for (const p of topPairs) {
    routes.push({
      path: `/compare/${p.slug}`,
      head: buildHead({
        title: `${p.a.city} vs ${p.b.city} — Cost of Living Comparison`,
        description: `Cost of living comparison between ${p.a.city}, ${p.a.country} and ${p.b.city}, ${p.b.country}. Rent, groceries, utilities, and monthly totals side by side.`,
        canonical: `${SITE_URL}/compare/${p.slug}`,
        ogType: 'article',
        keywords: `${p.a.city} vs ${p.b.city}, ${p.a.city} cost of living, ${p.b.city} cost of living`,
      }),
    });
  }

  for (const r of routes) emitRoute(template, r.path, r.head);

  console.log(`Prerendered ${routes.length} route HTML files.`);
}

main();
