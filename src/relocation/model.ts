import type { DatasetCity, DatasetMeta } from '../api/costOfLiving';

export const MANUAL_BUDGETS = { groceries: 'Groceries', healthcare: 'Healthcare & insurance', mobile: 'Mobile phones', childcare: 'Childcare & schooling', other: 'Other recurring spending' } as const;
export type ManualBudgetKey = keyof typeof MANUAL_BUDGETS;

export const STORAGE_KEY = 'colcalc_relocation_v1';
export type Profile = {
  citizenships: string;
  residence: string;
  adults: number;
  children: number;
  employment: 'employed' | 'self-employed' | 'retired' | 'studying' | 'other';
  moveMonth: string;
  netIncomeUsd: number | null;
  bedrooms: '1' | '3';
  location: 'center' | 'outskirts';
  monthlyBudgets?: Partial<Record<ManualBudgetKey, number | null>>;
};
export type BudgetLine = { label: string; monthlyCents: number | null; basis: string };
export type Report = {
  id: string;
  createdAt: string;
  engineVersion: 1;
  city: string;
  country: string;
  profile: Profile;
  lines: BudgetLine[];
  source: DatasetMeta;
};
export type Workspace = { version: 1; profile: Profile; reports: Report[]; completedTasks: string[] };
export const INITIAL_PROFILE: Profile = {
  citizenships: '', residence: '', adults: 1, children: 0, employment: 'employed',
  moveMonth: '', netIncomeUsd: null, bedrooms: '1', location: 'outskirts',
};

export function validProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  const p = value as Profile;
  return typeof p.citizenships === 'string' && p.citizenships.length <= 300
    && typeof p.residence === 'string' && p.residence.length <= 150
    && Number.isInteger(p.adults) && p.adults >= 1 && p.adults <= 10
    && Number.isInteger(p.children) && p.children >= 0 && p.children <= 10
    && ['employed', 'self-employed', 'retired', 'studying', 'other'].includes(p.employment)
    && typeof p.moveMonth === 'string' && (p.moveMonth === '' || /^\d{4}-(0[1-9]|1[0-2])$/.test(p.moveMonth))
    && (p.netIncomeUsd === null || (Number.isFinite(p.netIncomeUsd) && p.netIncomeUsd >= 0 && p.netIncomeUsd <= 1e9))
    && (p.monthlyBudgets === undefined || (p.monthlyBudgets !== null && typeof p.monthlyBudgets === 'object' && !Array.isArray(p.monthlyBudgets)
      && Object.entries(p.monthlyBudgets).every(([key, amount]) => key in MANUAL_BUDGETS && (amount === null || (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && amount <= 1e9)))))
    && ['1', '3'].includes(p.bedrooms) && ['center', 'outskirts'].includes(p.location);
}

export function readWorkspace(raw: string | null): Workspace {
  const empty = (): Workspace => ({ version: 1, profile: { ...INITIAL_PROFILE }, reports: [], completedTasks: [] });
  if (!raw) return empty();
  try {
    const v = JSON.parse(raw) as Workspace;
    if (v.version !== 1 || !validProfile(v.profile) || !Array.isArray(v.reports) || v.reports.length > 50
      || !Array.isArray(v.completedTasks) || !v.completedTasks.every(x => typeof x === 'string')) return empty();
    if (!v.reports.every(r => r && typeof r.id === 'string' && !Number.isNaN(Date.parse(r.createdAt))
      && r.engineVersion === 1 && typeof r.city === 'string' && typeof r.country === 'string'
      && validProfile(r.profile) && r.source && typeof r.source === 'object'
      && Array.isArray(r.lines) && r.lines.length <= 30 && r.lines.every(l => l && typeof l.label === 'string'
        && typeof l.basis === 'string' && (l.monthlyCents === null || (Number.isSafeInteger(l.monthlyCents) && l.monthlyCents >= 0))))) return empty();
    return v;
  } catch { return empty(); }
}

/** Preliminary city basket. No invented healthcare, grocery consumption or legal fees. */
export function buildReport(city: DatasetCity, profile: Profile, source: DatasetMeta): Report {
  if (!validProfile(profile)) throw new Error('Please check your household details.');
  const price = (category: string, matches: (item: string) => boolean = () => true) => {
    const item = city.prices.find(p => (p.category === category || p.category.startsWith(`${category} `)) && matches(p.item.toLowerCase())
      && Number.isFinite(p.usd) && p.usd > 0);
    return item ? Math.round(item.usd * 100) : null;
  };
  const rent = price('Rent', item => item.includes(`${profile.bedrooms} bedroom`)
    && (profile.location === 'center' ? /city cent(er|re)/.test(item) && !item.includes('outside') : item.includes('outside')));
  const transport = price('Transportation', item => item.includes('monthly pass'));
  const manual = (key: ManualBudgetKey, basis: string): BudgetLine => {
    const value = profile.monthlyBudgets?.[key];
    return { label: MANUAL_BUDGETS[key], monthlyCents: value === null || value === undefined ? null : Math.round(value * 100), basis: value === null || value === undefined ? basis : 'Your monthly household budget; not an independently verified price' };
  };
  return {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(), engineVersion: 1,
    city: city.city, country: city.country, profile: structuredClone(profile), source: { ...source },
    lines: [
      { label: 'Housing', monthlyCents: rent, basis: `${profile.bedrooms} bedroom(s), ${profile.location === 'center' ? 'city center' : 'outside the center'}; city average, not a quote` },
      { label: 'Utilities', monthlyCents: price('Utilities'), basis: 'One household; dataset apartment size may differ from yours' },
      { label: 'Internet', monthlyCents: price('Internet'), basis: 'One household connection' },
      { label: 'Public transport', monthlyCents: transport === null ? null : transport * profile.adults, basis: `One monthly pass × ${profile.adults} adult(s); child fares excluded` },
      manual('groceries', 'Consumption quantities have not been reviewed for this household'),
      manual('healthcare', 'Coverage, eligibility and insurance quotes need confirmation'),
      manual('mobile', 'A per-minute rate is not a monthly subscription estimate'),
      ...(profile.children > 0 ? [manual('childcare', 'Child ages, care hours and school preferences need confirmation')] : []),
      manual('other', 'Dining, clothing, subscriptions and other obligations need your budget'),
    ],
  };
}

export function summarizeReport(report: Report) {
  const missing = report.lines.filter(l => l.monthlyCents === null).length;
  const knownCents = report.lines.reduce((sum, l) => sum + (l.monthlyCents ?? 0), 0);
  return { missing, knownCents, totalCents: missing ? null : knownCents };
}
export const money = (cents: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(cents / 100);

export const PLANNING_TASKS = [
  { id: 'rights', stage: 'Before you commit', title: 'Confirm your right to live and work', detail: 'Check citizenship rights, application location and the requirements of the responsible immigration authority. Reviewed pathway assessments are not available yet.' },
  { id: 'budget', stage: 'Before you commit', title: 'Complete your household budget', detail: 'Get current rental and insurance quotes, and fill in groceries, schooling and other recurring spending.' },
  { id: 'cash', stage: 'Before departure', title: 'Map the cash needed for your move', detail: 'Confirm official fees, deposits, travel and temporary housing. Keep refundable deposits and proof-of-funds separate from expenses.' },
  { id: 'arrival', stage: 'After arrival', title: 'Confirm local registration steps', detail: 'Ask the relevant authorities which residence, address, tax and healthcare registrations apply. This is a planning prompt, not a country-specific legal checklist.' },
] as const;
