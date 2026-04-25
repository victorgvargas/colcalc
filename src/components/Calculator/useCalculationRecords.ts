import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RECORDS_STORAGE_KEY,
  parseStoredRecords,
  type CalculationRecord,
} from './logic';

type RecordsUpdater = (prev: CalculationRecord[]) => CalculationRecord[];

/** LWW metadata per record id, persisted alongside the records. */
export type RecordMeta = { updatedAt: string };

/** Tombstone for a deleted record — retains the full record shape so the sync protocol can push it. */
export type Tombstone = CalculationRecord & {
  updatedAt: string;
  deletedAt: string;
};

/** Snapshot of everything the sync layer needs to push. */
export type SyncSnapshot = {
  records: CalculationRecord[];
  metaById: Record<number, RecordMeta>;
  tombstones: Tombstone[];
};

export const RECORDS_META_STORAGE_KEY = 'colcalc_records_meta';
export const RECORDS_TOMBSTONES_STORAGE_KEY = 'colcalc_records_tombstones';

type Result = {
  records: CalculationRecord[];
  metaById: Record<number, RecordMeta>;
  tombstones: Tombstone[];
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
  /**
   * Apply a sync result from the server: upsert pulled records, drop tombstones
   * the server has accepted, refresh meta for the affected ids. Does not stamp
   * new updatedAts — the caller passes the server-provided timestamps through
   * as-is so clocks stay consistent.
   */
  applySyncResult: (input: {
    pulled: (CalculationRecord & { updatedAt: string; deletedAt?: string | null })[];
    conflicts: (CalculationRecord & { updatedAt: string; deletedAt?: string | null })[];
    acceptedTombstoneIds: number[];
  }) => void;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

function parseTombstones(raw: unknown): Tombstone[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t): t is Tombstone =>
      !!t &&
      typeof t === 'object' &&
      typeof (t as Tombstone).id === 'number' &&
      typeof (t as Tombstone).updatedAt === 'string' &&
      typeof (t as Tombstone).deletedAt === 'string',
  );
}

/**
 * Single source of truth for persisted calculator records.
 *
 * - Initializes from localStorage on mount.
 * - Writes the full list to localStorage on every change.
 * - Stamps `updatedAt` metadata per record so the sync layer can do
 *   last-write-wins against the backend. Metadata and tombstones are tracked
 *   even when the user isn't signed in, so the first sync after login pushes
 *   the correct state.
 * - Listens for cross-tab `storage` events so a change in another tab is
 *   reflected here without a refresh.
 */
export function useCalculationRecords(): Result {
  const [records, setRecordsState] = useState<CalculationRecord[]>(() =>
    typeof localStorage !== 'undefined'
      ? parseStoredRecords(localStorage.getItem(RECORDS_STORAGE_KEY))
      : [],
  );
  const [metaById, setMetaById] = useState<Record<number, RecordMeta>>(() =>
    readJson<Record<number, RecordMeta>>(RECORDS_META_STORAGE_KEY, {}),
  );
  const [tombstones, setTombstones] = useState<Tombstone[]>(() =>
    parseTombstones(readJson<unknown>(RECORDS_TOMBSTONES_STORAGE_KEY, [])),
  );

  // Stamp synthetic updatedAts for any record that lacks metadata (fresh upgrades).
  const stampedMissingRef = useRef(false);
  useEffect(() => {
    if (stampedMissingRef.current) return;
    stampedMissingRef.current = true;
    setMetaById((prev) => {
      const next = { ...prev };
      let changed = false;
      const now = new Date().toISOString();
      for (const r of records) {
        if (!next[r.id]) {
          next[r.id] = { updatedAt: now };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [records]);

  useEffect(() => {
    writeJson(RECORDS_STORAGE_KEY, records);
  }, [records]);

  useEffect(() => {
    writeJson(RECORDS_META_STORAGE_KEY, metaById);
  }, [metaById]);

  useEffect(() => {
    writeJson(RECORDS_TOMBSTONES_STORAGE_KEY, tombstones);
  }, [tombstones]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: StorageEvent) => {
      if (e.key === RECORDS_STORAGE_KEY) {
        setRecordsState(parseStoredRecords(localStorage.getItem(RECORDS_STORAGE_KEY)));
      } else if (e.key === RECORDS_META_STORAGE_KEY) {
        setMetaById(readJson<Record<number, RecordMeta>>(RECORDS_META_STORAGE_KEY, {}));
      } else if (e.key === RECORDS_TOMBSTONES_STORAGE_KEY) {
        setTombstones(parseTombstones(readJson<unknown>(RECORDS_TOMBSTONES_STORAGE_KEY, [])));
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const stampMeta = useCallback((ids: number[]) => {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setMetaById((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = { updatedAt: now };
      return next;
    });
  }, []);

  const setRecords = useCallback(
    (next: CalculationRecord[] | RecordsUpdater) => {
      setRecordsState((prev) => {
        const result = typeof next === 'function' ? next(prev) : next;
        // Stamp any newly-present ids, and keep existing stamps otherwise.
        const prevIds = new Set(prev.map((r) => r.id));
        const added = result.filter((r) => !prevIds.has(r.id)).map((r) => r.id);
        if (added.length > 0) stampMeta(added);
        return result;
      });
    },
    [stampMeta],
  );

  const addRecord = useCallback(
    (record: CalculationRecord) => {
      setRecordsState((prev) => [record, ...prev]);
      stampMeta([record.id]);
    },
    [stampMeta],
  );

  const deleteRecord = useCallback(
    (id: number) => {
      setRecordsState((prev) => {
        const target = prev.find((r) => r.id === id);
        if (target) {
          const now = new Date().toISOString();
          setTombstones((ts) => {
            const filtered = ts.filter((t) => t.id !== id);
            return [...filtered, { ...target, updatedAt: now, deletedAt: now }];
          });
        }
        return prev.filter((r) => r.id !== id);
      });
      setMetaById((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [],
  );

  const updateRecord = useCallback(
    (id: number, updater: (r: CalculationRecord) => CalculationRecord) => {
      setRecordsState((prev) => prev.map((r) => (r.id === id ? updater(r) : r)));
      stampMeta([id]);
    },
    [stampMeta],
  );

  const clearRecords = useCallback(() => {
    setRecordsState((prev) => {
      if (prev.length > 0) {
        const now = new Date().toISOString();
        setTombstones((ts) => {
          const byId = new Map(ts.map((t) => [t.id, t] as const));
          for (const r of prev) byId.set(r.id, { ...r, updatedAt: now, deletedAt: now });
          return Array.from(byId.values());
        });
      }
      return [];
    });
    setMetaById({});
  }, []);

  const applySyncResult = useCallback<Result['applySyncResult']>(
    ({ pulled, conflicts, acceptedTombstoneIds }) => {
      const incoming = [...pulled, ...conflicts];
      if (incoming.length === 0 && acceptedTombstoneIds.length === 0) return;

      const incomingMeta: Record<number, RecordMeta> = {};
      const toUpsert: CalculationRecord[] = [];
      const toDelete = new Set<number>();

      for (const item of incoming) {
        incomingMeta[item.id] = { updatedAt: item.updatedAt };
        if (item.deletedAt) {
          toDelete.add(item.id);
        } else {
          const { updatedAt: _u, deletedAt: _d, ...rest } = item;
          toUpsert.push(rest as CalculationRecord);
        }
      }

      if (toUpsert.length > 0 || toDelete.size > 0) {
        setRecordsState((prev) => {
          const byId = new Map(prev.map((r) => [r.id, r] as const));
          for (const r of toUpsert) byId.set(r.id, r);
          for (const id of toDelete) byId.delete(id);
          return Array.from(byId.values()).sort((a, b) => b.id - a.id);
        });
      }

      if (Object.keys(incomingMeta).length > 0) {
        setMetaById((prev) => {
          const next = { ...prev };
          for (const [idStr, meta] of Object.entries(incomingMeta)) {
            const id = Number(idStr);
            if (toDelete.has(id)) {
              delete next[id];
            } else {
              next[id] = meta;
            }
          }
          return next;
        });
      }

      if (acceptedTombstoneIds.length > 0) {
        const accepted = new Set(acceptedTombstoneIds);
        setTombstones((prev) => prev.filter((t) => !accepted.has(t.id)));
      }
    },
    [],
  );

  return {
    records,
    metaById,
    tombstones,
    setRecords,
    addRecord,
    deleteRecord,
    updateRecord,
    clearRecords,
    applySyncResult,
  };
}
