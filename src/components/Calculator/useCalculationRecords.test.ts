import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RECORDS_STORAGE_KEY, type CalculationRecord } from './logic';
import { useCalculationRecords } from './useCalculationRecords';

function makeRecord(partial: Partial<CalculationRecord> = {}): CalculationRecord {
  return {
    id: Date.now() + Math.random(),
    city: 'Berlin',
    country: 'Germany',
    income: 5000,
    numberOfKids: 0,
    totalCosts: 2000,
    netBudget: 3000,
    currency: 'EUR',
    ...partial,
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('useCalculationRecords', () => {
  it('starts empty when localStorage is empty', () => {
    const { result } = renderHook(() => useCalculationRecords());
    expect(result.current.records).toEqual([]);
  });

  it('rehydrates from localStorage on mount', () => {
    const seed = [makeRecord({ id: 1, city: 'Rome', country: 'Italy' })];
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(seed));
    const { result } = renderHook(() => useCalculationRecords());
    expect(result.current.records).toHaveLength(1);
    expect(result.current.records[0].city).toBe('Rome');
  });

  it('addRecord prepends and writes back to storage', () => {
    const { result } = renderHook(() => useCalculationRecords());
    const rec = makeRecord({ id: 42, city: 'Paris', country: 'France' });
    act(() => {
      result.current.addRecord(rec);
    });
    expect(result.current.records[0]).toEqual(rec);
    const stored = JSON.parse(localStorage.getItem(RECORDS_STORAGE_KEY)!);
    expect(stored[0].id).toBe(42);
  });

  it('deleteRecord removes by id', () => {
    const a = makeRecord({ id: 1, city: 'Berlin', country: 'Germany' });
    const b = makeRecord({ id: 2, city: 'Paris', country: 'France' });
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify([a, b]));
    const { result } = renderHook(() => useCalculationRecords());
    act(() => {
      result.current.deleteRecord(1);
    });
    expect(result.current.records.map((r) => r.id)).toEqual([2]);
  });

  it('updateRecord applies the partial update to the matching id only', () => {
    const a = makeRecord({ id: 1, city: 'Berlin', country: 'Germany', income: 5000 });
    const b = makeRecord({ id: 2, city: 'Paris', country: 'France', income: 6000 });
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify([a, b]));
    const { result } = renderHook(() => useCalculationRecords());
    act(() => {
      result.current.updateRecord(2, (r) => ({ ...r, income: 9999 }));
    });
    expect(result.current.records.find((r) => r.id === 2)!.income).toBe(9999);
    expect(result.current.records.find((r) => r.id === 1)!.income).toBe(5000);
  });

  it('clearRecords empties the list and storage', () => {
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify([makeRecord({ id: 1 })]));
    const { result } = renderHook(() => useCalculationRecords());
    act(() => {
      result.current.clearRecords();
    });
    expect(result.current.records).toEqual([]);
    expect(JSON.parse(localStorage.getItem(RECORDS_STORAGE_KEY)!)).toEqual([]);
  });

  it('picks up cross-tab storage events', () => {
    const { result } = renderHook(() => useCalculationRecords());
    const next = [makeRecord({ id: 9, city: 'Tokyo', country: 'Japan' })];
    act(() => {
      localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new StorageEvent('storage', { key: RECORDS_STORAGE_KEY }));
    });
    expect(result.current.records.map((r) => r.city)).toEqual(['Tokyo']);
  });

  it('ignores storage events for unrelated keys', () => {
    const seed = [makeRecord({ id: 1, city: 'Berlin', country: 'Germany' })];
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(seed));
    const { result } = renderHook(() => useCalculationRecords());
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'some-other-key' }));
    });
    expect(result.current.records).toHaveLength(1);
  });
});
