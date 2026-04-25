import { useCallback, useEffect, useState } from 'react';
import {
  RECORDS_STORAGE_KEY,
  parseStoredRecords,
  type CalculationRecord,
} from './logic';

type RecordsUpdater = (prev: CalculationRecord[]) => CalculationRecord[];

type Result = {
  records: CalculationRecord[];
  /** Replace or update the entire record set. */
  setRecords: (next: CalculationRecord[] | RecordsUpdater) => void;
  /** Prepend a new record. */
  addRecord: (record: CalculationRecord) => void;
  /** Remove a record by id. */
  deleteRecord: (id: number) => void;
  /** Apply a partial update to the record with the given id. */
  updateRecord: (id: number, updater: (r: CalculationRecord) => CalculationRecord) => void;
  /** Remove every record. */
  clearRecords: () => void;
};

/**
 * Single source of truth for persisted calculator records.
 *
 * - Initializes from localStorage on mount.
 * - Writes the full list to localStorage on every change.
 * - Listens for cross-tab `storage` events so a change in another tab is
 *   reflected here without a refresh.
 *
 * All mutation helpers go through `setRecords` so the persist effect fires
 * once per change.
 */
export function useCalculationRecords(): Result {
  const [records, setRecordsState] = useState<CalculationRecord[]>(() =>
    typeof localStorage !== 'undefined'
      ? parseStoredRecords(localStorage.getItem(RECORDS_STORAGE_KEY))
      : [],
  );

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
    }
  }, [records]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: StorageEvent) => {
      if (e.key !== RECORDS_STORAGE_KEY) return;
      setRecordsState(parseStoredRecords(localStorage.getItem(RECORDS_STORAGE_KEY)));
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setRecords = useCallback(
    (next: CalculationRecord[] | RecordsUpdater) => {
      setRecordsState((prev) => (typeof next === 'function' ? next(prev) : next));
    },
    [],
  );

  const addRecord = useCallback(
    (record: CalculationRecord) => setRecordsState((prev) => [record, ...prev]),
    [],
  );

  const deleteRecord = useCallback(
    (id: number) => setRecordsState((prev) => prev.filter((r) => r.id !== id)),
    [],
  );

  const updateRecord = useCallback(
    (id: number, updater: (r: CalculationRecord) => CalculationRecord) =>
      setRecordsState((prev) => prev.map((r) => (r.id === id ? updater(r) : r))),
    [],
  );

  const clearRecords = useCallback(() => setRecordsState([]), []);

  return { records, setRecords, addRecord, deleteRecord, updateRecord, clearRecords };
}
