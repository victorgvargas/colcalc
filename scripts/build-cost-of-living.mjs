#!/usr/bin/env node
/**
 * Downloads the Kaggle "Global Cost of Living" CSV (hosted on GitHub),
 * and emits public/cost-of-living.json — a compact per-city price index
 * consumed at runtime by src/api/costOfLiving.ts.
 *
 * Run: node scripts/build-cost-of-living.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '..', 'public', 'cost-of-living.json');
const SOURCE_URL =
  'https://raw.githubusercontent.com/navneeet94/cost-of-living/main/cost-of-living_v2.csv';

/**
 * x1..x55 -> { category, label } emitted into prices[].
 * Only columns that map to categories actually consumed by the calculator
 * (Rent, Markets, Transportation, Utilities, Internet, Mobile, Childcare)
 * are retained. Columns the UI doesn't use are dropped to shrink the bundle.
 */
const COLUMN_MAP = {
  // Markets (groceries)
  x9: { category: 'Markets', item: 'Milk (1L)' },
  x10: { category: 'Markets', item: 'Bread (500g)' },
  x11: { category: 'Markets', item: 'Rice (1kg)' },
  x12: { category: 'Markets', item: 'Eggs (12)' },
  x13: { category: 'Markets', item: 'Cheese (1kg)' },
  x14: { category: 'Markets', item: 'Chicken (1kg)' },
  x15: { category: 'Markets', item: 'Beef (1kg)' },
  x16: { category: 'Markets', item: 'Apples (1kg)' },
  x17: { category: 'Markets', item: 'Banana (1kg)' },
  x18: { category: 'Markets', item: 'Oranges (1kg)' },
  x19: { category: 'Markets', item: 'Tomato (1kg)' },
  x20: { category: 'Markets', item: 'Potato (1kg)' },
  x21: { category: 'Markets', item: 'Onion (1kg)' },
  x22: { category: 'Markets', item: 'Lettuce (1 head)' },

  // Transportation (monthly pass is the signal; single tickets are per-unit and get filtered out upstream)
  x29: { category: 'Transportation', item: 'Monthly Pass' },

  // Utilities, Internet, Mobile
  x36: { category: 'Utilities', item: 'Basic (Electricity, Heating, Water, Garbage)' },
  x37: { category: 'Mobile', item: '1 min Prepaid Mobile' },
  x38: { category: 'Internet', item: 'Internet (Unlimited, Cable/ADSL)' },

  // Childcare
  x42: { category: 'Childcare', item: 'Preschool (Full Day, Private, Monthly)' },

  // Rent — item text carries center/outskirts hint so the existing regex picks the right one
  x48: { category: 'Rent', item: 'Apartment (1 bedroom) in City Centre' },
  x49: { category: 'Rent', item: 'Apartment (1 bedroom) Outside of Centre' },
  x50: { category: 'Rent', item: 'Apartment (3 bedrooms) in City Centre' },
  x51: { category: 'Rent', item: 'Apartment (3 bedrooms) Outside of Centre' },
};

function parseCsvLine(line) {
  // Dataset has no quoted/escaped commas, verified — simple split is safe.
  return line.split(',');
}

async function main() {
  console.log(`Downloading ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  const header = parseCsvLine(lines[0]);
  const colIndex = Object.fromEntries(header.map((name, i) => [name, i]));

  const keptCols = Object.keys(COLUMN_MAP);
  for (const col of keptCols) {
    if (!(col in colIndex)) throw new Error(`Missing column ${col} in source CSV`);
  }

  const cityIndex = colIndex.city;
  const countryIndex = colIndex.country;

  const cities = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const cityName = row[cityIndex]?.trim();
    const countryName = row[countryIndex]?.trim();
    if (!cityName || !countryName) continue;

    const prices = [];
    for (const col of keptCols) {
      const raw = row[colIndex[col]];
      if (raw === undefined || raw === '' || raw === 'NA') continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) continue;
      const { category, item } = COLUMN_MAP[col];
      prices.push({ category, item, usd: Math.round(value * 100) / 100 });
    }
    if (!prices.length) continue;

    cities.push({ city: cityName, country: countryName, prices });
  }

  cities.sort((a, b) =>
    a.city.localeCompare(b.city) || a.country.localeCompare(b.country),
  );

  const payload = {
    source: SOURCE_URL,
    generatedAt: new Date().toISOString(),
    cityCount: cities.length,
    cities,
  };

  writeFileSync(OUT_PATH, JSON.stringify(payload));
  console.log(`Wrote ${OUT_PATH} (${cities.length} cities)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
