/**
 * Bridge between the assistant and the rest of the app.
 * Exposes read-only snapshots of app state + a handful of navigation/action handlers
 * that the Gemini model can invoke via function calling.
 */
import { getUsdRates, getUsdToCurrencyRate } from '../api/exchangeRates';
import { fetchCities, fetchPricesForCity, computeMonthlyCostsFromPrices } from '../api/costOfLiving';
import { fetchTaxCountries, fetchIncomeTax } from '../api/taxRates';

const RECORDS_STORAGE_KEY = 'colcalc_records';

export type StoredRecord = {
  id: number;
  city: string;
  country: string;
  income: number;
  numberOfKids: number;
  totalCosts: number;
  netBudget: number;
  currency: string;
};

function readRecords(): StoredRecord[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredRecord[]) : [];
  } catch {
    return [];
  }
}

function writeRecords(records: StoredRecord[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
  // Notify Calculator (listens via its own localStorage sync) and any other surfaces.
  window.dispatchEvent(new StorageEvent('storage', { key: RECORDS_STORAGE_KEY }));
}

export type AppActionContext = {
  currentPath: string;
  navigate: (path: string, state?: unknown) => void;
};

export type ToolResult = Record<string, unknown>;

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AppActionContext,
): Promise<ToolResult> {
  switch (name) {
    case 'get_current_page':
      return { path: ctx.currentPath };

    case 'navigate_to': {
      const path = String(args.path ?? '');
      const allowed = ['/calculator', '/cities-comparison', '/purchasing-power', '/tax-calculator'];
      if (!allowed.includes(path)) {
        return { ok: false, error: `Unknown path: ${path}` };
      }
      ctx.navigate(path);
      return { ok: true, path };
    }

    case 'list_saved_records': {
      const records = readRecords();
      return {
        count: records.length,
        records: records.map((r) => ({
          id: r.id,
          city: r.city,
          country: r.country,
          income: r.income,
          currency: r.currency,
          totalCosts: Math.round(r.totalCosts * 100) / 100,
          netBudget: Math.round(r.netBudget * 100) / 100,
          numberOfKids: r.numberOfKids,
        })),
      };
    }

    case 'delete_record': {
      const id = Number(args.id);
      if (!Number.isFinite(id)) return { ok: false, error: 'Invalid id' };
      const records = readRecords();
      const next = records.filter((r) => r.id !== id);
      if (next.length === records.length) return { ok: false, error: `No record with id ${id}` };
      writeRecords(next);
      return { ok: true, deletedId: id, remaining: next.length };
    }

    case 'clear_all_records': {
      const records = readRecords();
      if (!records.length) return { ok: true, cleared: 0 };
      writeRecords([]);
      return { ok: true, cleared: records.length };
    }

    case 'prefill_calculator': {
      const income = Number(args.income);
      const currency = String(args.currency ?? 'EUR').toUpperCase();
      const city = typeof args.city === 'string' ? args.city : undefined;
      const country = typeof args.country === 'string' ? args.country : undefined;
      if (!Number.isFinite(income) || income <= 0) {
        return { ok: false, error: 'income must be a positive number' };
      }
      ctx.navigate('/calculator', { income, currency, city, country });
      return { ok: true, income, currency, city, country };
    }

    case 'get_exchange_rate': {
      const from = String(args.from ?? '').toUpperCase();
      const to = String(args.to ?? '').toUpperCase();
      if (!from || !to) return { ok: false, error: 'Provide from and to currency codes' };
      const rates = await getUsdRates();
      const usdToFrom = getUsdToCurrencyRate(rates, from, Number.NaN);
      const usdToTarget = getUsdToCurrencyRate(rates, to, Number.NaN);
      if (!Number.isFinite(usdToFrom) || !Number.isFinite(usdToTarget)) {
        return { ok: false, error: 'Unsupported currency code' };
      }
      const rate = usdToTarget / usdToFrom;
      return { from, to, rate: Math.round(rate * 10000) / 10000 };
    }

    case 'list_supported_tax_countries': {
      const list = await fetchTaxCountries();
      return {
        count: list.length,
        countries: list.map((c) => ({ code: c.code, name: c.name, currency: c.currency })),
      };
    }

    case 'estimate_income_tax': {
      const code = String(args.countryCode ?? '').toLowerCase();
      const income = Number(args.income);
      if (!code || !Number.isFinite(income) || income < 0) {
        return { ok: false, error: 'Provide countryCode and a non-negative income' };
      }
      const data = await fetchIncomeTax(code, income);
      return {
        country: data.country,
        currency: data.currency,
        taxYear: data.taxYear,
        yearly: data.yearly,
        monthlyNet: data.monthly?.net,
        effectiveTaxRate: data.rates?.effectiveTaxRate,
      };
    }

    case 'compare_city_costs': {
      const citiesArg = Array.isArray(args.cities) ? args.cities : [];
      if (citiesArg.length < 2 || citiesArg.length > 5) {
        return { ok: false, error: 'Provide between 2 and 5 city entries' };
      }
      const entries = citiesArg
        .map((c) => {
          if (c && typeof c === 'object') {
            const o = c as Record<string, unknown>;
            return {
              cityName: String(o.cityName ?? o.city ?? ''),
              countryName: String(o.countryName ?? o.country ?? ''),
            };
          }
          return null;
        })
        .filter((e): e is { cityName: string; countryName: string } => !!(e && e.cityName && e.countryName));
      if (entries.length !== citiesArg.length) {
        return { ok: false, error: 'Each entry needs cityName and countryName' };
      }
      const results = await Promise.all(
        entries.map(async (e) => {
          const { prices } = await fetchPricesForCity(e.cityName, e.countryName);
          const { totalUsd, byCategory } = computeMonthlyCostsFromPrices(prices);
          return {
            city: e.cityName,
            country: e.countryName,
            totalMonthlyUsd: Math.round(totalUsd * 100) / 100,
            breakdownUsd: Object.fromEntries(
              Array.from(byCategory.entries()).map(([k, v]) => [k, Math.round(v * 100) / 100]),
            ),
          };
        }),
      );
      return { results };
    }

    case 'search_cities': {
      const query = String(args.query ?? '').trim().toLowerCase();
      if (!query) return { ok: false, error: 'query is required' };
      const cities = await fetchCities();
      const matches = cities
        .filter(
          (c) =>
            c.cityName.toLowerCase().includes(query) ||
            c.countryName.toLowerCase().includes(query),
        )
        .slice(0, 20);
      return { count: matches.length, matches };
    }

    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}

export const TOOL_DECLARATIONS = [
  {
    name: 'get_current_page',
    description: 'Return the current app route the user is viewing.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'navigate_to',
    description: 'Navigate the user to one of the app pages.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: {
          type: 'STRING',
          enum: ['/calculator', '/cities-comparison', '/purchasing-power', '/tax-calculator'],
          description: 'Target route',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_saved_records',
    description:
      'List the cost-of-living records the user has saved (from /calculator history). Returns city, country, income, totals, and id.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'delete_record',
    description: 'Delete a saved calculator record by id. Only call after confirming with the user.',
    parameters: {
      type: 'OBJECT',
      properties: { id: { type: 'NUMBER', description: 'Record id from list_saved_records' } },
      required: ['id'],
    },
  },
  {
    name: 'clear_all_records',
    description: 'Delete ALL saved calculator records. Destructive — confirm with the user first.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'prefill_calculator',
    description:
      'Navigate to /calculator and prefill income, currency, city, country. Useful after showing a tax estimate.',
    parameters: {
      type: 'OBJECT',
      properties: {
        income: { type: 'NUMBER', description: 'Monthly income amount' },
        currency: {
          type: 'STRING',
          enum: ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'],
        },
        city: { type: 'STRING' },
        country: { type: 'STRING' },
      },
      required: ['income', 'currency'],
    },
  },
  {
    name: 'get_exchange_rate',
    description: 'Return the live exchange rate between two currency codes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        from: { type: 'STRING', description: 'ISO 4217 code, e.g. USD' },
        to: { type: 'STRING', description: 'ISO 4217 code, e.g. EUR' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'list_supported_tax_countries',
    description: 'List countries for which the tax calculator can estimate income tax.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'estimate_income_tax',
    description:
      'Estimate yearly and monthly net income after tax for a country. countryCode is ISO 3166-1 alpha-2 (lowercase).',
    parameters: {
      type: 'OBJECT',
      properties: {
        countryCode: { type: 'STRING', description: 'e.g. us, de, fr' },
        income: { type: 'NUMBER', description: 'Yearly gross income in local currency' },
      },
      required: ['countryCode', 'income'],
    },
  },
  {
    name: 'compare_city_costs',
    description:
      'Compute monthly cost-of-living totals (USD) for 2-5 cities using the bundled dataset.',
    parameters: {
      type: 'OBJECT',
      properties: {
        cities: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              cityName: { type: 'STRING' },
              countryName: { type: 'STRING' },
            },
            required: ['cityName', 'countryName'],
          },
        },
      },
      required: ['cities'],
    },
  },
  {
    name: 'search_cities',
    description: 'Find cities in the bundled cost-of-living dataset by partial city or country name.',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING' } },
      required: ['query'],
    },
  },
] as const;
