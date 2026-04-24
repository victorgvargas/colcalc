#!/usr/bin/env node
/**
 * Build-time SEO generator.
 *
 * Reads public/cost-of-living.json and emits:
 *  - public/sitemap.xml    — every signal-6 city + curated comparison pairs
 *  - src/data/topCities.json — consumed by the Calculator page to render
 *    indexable anchor links to the most popular cities & comparisons.
 *
 * Run automatically before `vite build` via package.json's build script.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATASET = resolve(ROOT, 'public', 'cost-of-living.json');
const SITEMAP = resolve(ROOT, 'public', 'sitemap.xml');
const TOP_CITIES_OUT = resolve(ROOT, 'src', 'data', 'topCities.json');

const SITE_URL = (process.env.VITE_SITE_URL || 'https://colcalc.fly.dev').replace(/\/$/, '');

/**
 * Curated list of high-search-volume cities. Ranking these above the
 * alphabetical dataset order means the homepage anchor links land on
 * cities people actually search for, not `'s-Hertogenbosch`.
 */
const POPULAR_CITIES = [
  ['New York', 'United States'],
  ['London', 'United Kingdom'],
  ['Berlin', 'Germany'],
  ['Paris', 'France'],
  ['Amsterdam', 'Netherlands'],
  ['Lisbon', 'Portugal'],
  ['Madrid', 'Spain'],
  ['Barcelona', 'Spain'],
  ['Rome', 'Italy'],
  ['Milan', 'Italy'],
  ['Vienna', 'Austria'],
  ['Zurich', 'Switzerland'],
  ['Dublin', 'Ireland'],
  ['Copenhagen', 'Denmark'],
  ['Stockholm', 'Sweden'],
  ['Oslo', 'Norway'],
  ['Helsinki', 'Finland'],
  ['Prague', 'Czech Republic'],
  ['Warsaw', 'Poland'],
  ['Budapest', 'Hungary'],
  ['Athens', 'Greece'],
  ['Tallinn', 'Estonia'],
  ['Reykjavik', 'Iceland'],
  ['Toronto', 'Canada'],
  ['Vancouver', 'Canada'],
  ['Montreal', 'Canada'],
  ['San Francisco', 'United States'],
  ['Los Angeles', 'United States'],
  ['Chicago', 'United States'],
  ['Seattle', 'United States'],
  ['Austin', 'United States'],
  ['Miami', 'United States'],
  ['Mexico City', 'Mexico'],
  ['Sao Paulo', 'Brazil'],
  ['Buenos Aires', 'Argentina'],
  ['Tokyo', 'Japan'],
  ['Seoul', 'South Korea'],
  ['Singapore', 'Singapore'],
  ['Hong Kong', 'Hong Kong'],
  ['Bangkok', 'Thailand'],
  ['Kuala Lumpur', 'Malaysia'],
  ['Bali', 'Indonesia'],
  ['Sydney', 'Australia'],
  ['Melbourne', 'Australia'],
  ['Auckland', 'New Zealand'],
  ['Dubai', 'United Arab Emirates'],
  ['Istanbul', 'Turkey'],
  ['Tel Aviv-Yafo', 'Israel'],
  ['Mumbai', 'India'],
  ['Bangalore', 'India'],
  ['Cape Town', 'South Africa'],
];

const POPULAR_PAIRS = [
  ['Berlin', 'Germany', 'Lisbon', 'Portugal'],
  ['Amsterdam', 'Netherlands', 'Berlin', 'Germany'],
  ['London', 'United Kingdom', 'Berlin', 'Germany'],
  ['New York', 'United States', 'San Francisco', 'United States'],
  ['New York', 'United States', 'London', 'United Kingdom'],
  ['London', 'United Kingdom', 'New York', 'United States'],
  ['Paris', 'France', 'Berlin', 'Germany'],
  ['Madrid', 'Spain', 'Lisbon', 'Portugal'],
  ['Barcelona', 'Spain', 'Lisbon', 'Portugal'],
  ['Zurich', 'Switzerland', 'Berlin', 'Germany'],
  ['Amsterdam', 'Netherlands', 'Lisbon', 'Portugal'],
  ['Singapore', 'Singapore', 'Hong Kong', 'Hong Kong'],
  ['Tokyo', 'Japan', 'Seoul', 'South Korea'],
  ['Sydney', 'Australia', 'Melbourne', 'Australia'],
  ['Toronto', 'Canada', 'Vancouver', 'Canada'],
  ['Austin', 'United States', 'San Francisco', 'United States'],
  ['Dubai', 'United Arab Emirates', 'Singapore', 'Singapore'],
  ['Mexico City', 'Mexico', 'Madrid', 'Spain'],
  ['Prague', 'Czech Republic', 'Berlin', 'Germany'],
  ['Bangkok', 'Thailand', 'Bali', 'Indonesia'],
];

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

function comparisonSlug(a, b) {
  return `${citySlug(a.city, a.country)}-vs-${citySlug(b.city, b.country)}`;
}

function signalScore(priceItems) {
  const cats = new Set(priceItems.map((p) => p.category));
  return ['Rent', 'Markets', 'Utilities', 'Internet', 'Transportation', 'Childcare']
    .filter((k) => cats.has(k)).length;
}

function xmlEscape(s) {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function main() {
  const dataset = JSON.parse(readFileSync(DATASET, 'utf8'));
  const cities = Array.isArray(dataset.cities) ? dataset.cities : [];

  const byKey = new Map();
  for (const c of cities) {
    byKey.set(`${c.city.toLowerCase()}|${c.country.toLowerCase()}`, c);
  }

  const lookup = (city, country) => byKey.get(`${city.toLowerCase()}|${country.toLowerCase()}`);

  // Resolve curated lists against the dataset so we never link to a missing page.
  const topCities = POPULAR_CITIES
    .map(([city, country]) => lookup(city, country))
    .filter(Boolean)
    .map((c) => ({ city: c.city, country: c.country, slug: citySlug(c.city, c.country) }));

  const topPairs = POPULAR_PAIRS
    .map(([ca, co, cb, cob]) => {
      const a = lookup(ca, co);
      const b = lookup(cb, cob);
      if (!a || !b) return null;
      return {
        a: { city: a.city, country: a.country },
        b: { city: b.city, country: b.country },
        slug: comparisonSlug(
          { city: a.city, country: a.country },
          { city: b.city, country: b.country },
        ),
      };
    })
    .filter(Boolean);

  // All cities in the dataset that have enough pricing signal to render a useful page.
  const indexableCities = cities.filter((c) => signalScore(c.prices) >= 5);

  // Curated pairs only in the sitemap to avoid spammy combinations.
  const indexablePairs = topPairs;

  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/calculator', priority: '0.9', changefreq: 'weekly' },
    { loc: '/cities-comparison', priority: '0.9', changefreq: 'weekly' },
    { loc: '/purchasing-power', priority: '0.8', changefreq: 'weekly' },
    { loc: '/tax-calculator', priority: '0.8', changefreq: 'weekly' },
    ...indexableCities.map((c) => ({
      loc: `/cost-of-living/${citySlug(c.city, c.country)}`,
      priority: '0.6',
      changefreq: 'monthly',
    })),
    ...indexablePairs.map((p) => ({
      loc: `/compare/${p.slug}`,
      priority: '0.7',
      changefreq: 'monthly',
    })),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n    <loc>${xmlEscape(`${SITE_URL}${u.loc}`)}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
      )
      .join('\n') +
    `\n</urlset>\n`;

  writeFileSync(SITEMAP, xml);
  console.log(`Wrote ${SITEMAP} (${urls.length} URLs)`);

  mkdirSync(dirname(TOP_CITIES_OUT), { recursive: true });
  writeFileSync(
    TOP_CITIES_OUT,
    JSON.stringify({ cities: topCities, pairs: topPairs }, null, 2),
  );
  console.log(`Wrote ${TOP_CITIES_OUT} (${topCities.length} cities, ${topPairs.length} pairs)`);
}

main();
