import { describe, expect, it } from 'vitest';
import { buildReport, INITIAL_PROFILE, readWorkspace, summarizeReport } from './model';
import type { DatasetCity } from '../api/costOfLiving';

const city: DatasetCity = { city: 'Example', country: 'Exampleland', prices: [
  { category: 'Rent', item: 'Apartment (1 bedroom) in City Centre', usd: 1200 },
  { category: 'Rent', item: 'Apartment (1 bedroom) Outside of Centre', usd: 900 },
  { category: 'Rent', item: 'Apartment (3 bedrooms) Outside of Centre', usd: 1800 },
  { category: 'Utilities', item: 'Basic utilities', usd: 100 },
  { category: 'Internet', item: 'Unlimited', usd: 30 },
  { category: 'Transportation', item: 'Monthly Pass', usd: 50 },
  { category: 'Mobile', item: '1 min Prepaid Mobile', usd: 0.2 },
] };

describe('relocation report snapshots', () => {
  it('selects the requested home, scales only adult transit, and preserves unknown spending', () => {
    const report = buildReport(city, { ...INITIAL_PROFILE, adults: 2, children: 1, bedrooms: '3' }, {});
    expect(report.lines.find(l => l.label === 'Housing')?.monthlyCents).toBe(180000);
    expect(report.lines.find(l => l.label === 'Public transport')?.monthlyCents).toBe(10000);
    expect(report.lines.find(l => l.label === 'Mobile phones')?.monthlyCents).toBeNull();
    expect(report.lines.find(l => l.label === 'Childcare & schooling')?.monthlyCents).toBeNull();
    expect(summarizeReport(report)).toEqual({ knownCents: 203000, missing: 5, totalCents: null });
  });
  it('distinguishes city-center rent and never substitutes a different size when missing', () => {
    const report = buildReport(city, { ...INITIAL_PROFILE, location: 'center' }, {});
    expect(report.lines[0].monthlyCents).toBe(120000);
    const missing = buildReport(city, { ...INITIAL_PROFILE, location: 'center', bedrooms: '3' }, {});
    expect(missing.lines[0].monthlyCents).toBeNull();
  });
  it('snapshots profile, source and prices independently of subsequent edits', () => {
    const profile = { ...INITIAL_PROFILE };
    const source = { source: 'Example source' };
    const report = buildReport(city, profile, source);
    profile.adults = 4;
    source.source = 'Changed';
    expect(report.profile.adults).toBe(1);
    expect(report.source.source).toBe('Example source');
  });
  it('round trips reports and rejects malformed or future storage versions', () => {
    const report = buildReport(city, INITIAL_PROFILE, {});
    const saved = { version: 1, profile: INITIAL_PROFILE, reports: [report], completedTasks: ['rights'] };
    expect(readWorkspace(JSON.stringify(saved))).toEqual(saved);
    expect(readWorkspace(JSON.stringify({ ...saved, version: 2 })).reports).toEqual([]);
    expect(readWorkspace(JSON.stringify({ ...saved, reports: [{ ...report, lines: [{ label: 'Rent', basis: 'bad', monthlyCents: -1 }] }] })).reports).toEqual([]);
    expect(readWorkspace('{')).toEqual(readWorkspace(null));
  });
  it('uses explicit user budgets, preserves zero, and computes a total only when no categories are missing', () => {
    const profile = { ...INITIAL_PROFILE, monthlyBudgets: { groceries: 300, healthcare: 0, mobile: 20, other: 150 } };
    const report = buildReport(city, profile, {});
    expect(report.lines.find(l => l.label === 'Healthcare & insurance')?.monthlyCents).toBe(0);
    expect(summarizeReport(report)).toEqual({ knownCents: 155000, totalCents: 155000, missing: 0 });
    profile.monthlyBudgets.groceries = 999;
    expect(report.profile.monthlyBudgets?.groceries).toBe(300);
  });
  it('rejects invalid household values before producing a report', () => {
    expect(() => buildReport(city, { ...INITIAL_PROFILE, adults: 0 }, {})).toThrow();
    expect(() => buildReport(city, { ...INITIAL_PROFILE, netIncomeUsd: NaN }, {})).toThrow();
  });
});
