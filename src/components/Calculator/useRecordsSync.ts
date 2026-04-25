import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { ApiError, syncRecords, type SyncRecord } from '../../api/backend';
import type { CalculationRecord } from './logic';
import type { RecordMeta, Tombstone } from './useCalculationRecords';

const LAST_PULL_STORAGE_KEY = 'colcalc_last_pull_at';

function readLastPull(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(LAST_PULL_STORAGE_KEY);
}

function writeLastPull(iso: string) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LAST_PULL_STORAGE_KEY, iso);
}

function clearLastPull() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(LAST_PULL_STORAGE_KEY);
}

function toSyncRecord(
  record: CalculationRecord,
  meta: RecordMeta | undefined,
): SyncRecord {
  return {
    ...record,
    updatedAt: meta?.updatedAt ?? new Date().toISOString(),
  };
}

function tombstoneToSync(t: Tombstone): SyncRecord {
  const { updatedAt, deletedAt, ...record } = t;
  return { ...(record as CalculationRecord), updatedAt, deletedAt };
}

type Params = {
  records: CalculationRecord[];
  metaById: Record<number, RecordMeta>;
  tombstones: Tombstone[];
  applySyncResult: (input: {
    pulled: SyncRecord[];
    conflicts: SyncRecord[];
    acceptedTombstoneIds: number[];
  }) => void;
};

/**
 * Drives two-way sync with the backend whenever the user is authenticated.
 *
 * Sync triggers:
 *   1. On auth state flipping to `authenticated` (initial reconcile).
 *   2. Whenever local records/meta/tombstones change while authenticated
 *      (debounced) — pushes pending mutations.
 *   3. On window `online` event — retry after reconnection.
 *
 * Failures are swallowed into a warning log: the client is offline-first, so
 * any unpushed state stays on disk until the next successful sync.
 */
export function useRecordsSync({
  records,
  metaById,
  tombstones,
  applySyncResult,
}: Params): void {
  const { user, status } = useAuth();
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const pushedBeforeRef = useRef(false);

  const syncNow = useCallback(
    async (opts: { fullPush: boolean }) => {
      if (inFlightRef.current) {
        pendingRef.current = true;
        return;
      }
      inFlightRef.current = true;

      try {
        const since = opts.fullPush ? null : readLastPull();

        // On the first sync after login we push *everything* the user has
        // locally so nothing is silently dropped. Subsequent syncs only push
        // records whose local updatedAt is newer than the server's last-known
        // timestamp — but in practice we just push everything we know about,
        // since the server does per-record LWW. Small volumes make this cheap.
        const push: SyncRecord[] = [
          ...records.map((r) => toSyncRecord(r, metaById[r.id])),
          ...tombstones.map(tombstoneToSync),
        ];

        const res = await syncRecords({ since, push });

        applySyncResult({
          pulled: res.pulled,
          conflicts: res.conflicts.map((c) => c.resolvedRecord),
          acceptedTombstoneIds: tombstones.map((t) => t.id),
        });

        writeLastPull(res.now);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Session died — let the AuthProvider reconcile on next /auth/me.
          return;
        }
        // eslint-disable-next-line no-console
        console.warn('Records sync failed:', err);
      } finally {
        inFlightRef.current = false;
        if (pendingRef.current) {
          pendingRef.current = false;
          void syncNow({ fullPush: false });
        }
      }
    },
    [records, metaById, tombstones, applySyncResult],
  );

  // Full push on login (fires once per authenticated session).
  useEffect(() => {
    if (status !== 'authenticated' || !user) {
      pushedBeforeRef.current = false;
      return;
    }
    if (pushedBeforeRef.current) return;
    pushedBeforeRef.current = true;
    void syncNow({ fullPush: true });
  }, [status, user, syncNow]);

  // Debounced re-sync whenever local state changes while authenticated.
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (!pushedBeforeRef.current) return; // first sync effect handles the initial push
    const t = setTimeout(() => {
      void syncNow({ fullPush: false });
    }, 600);
    return () => clearTimeout(t);
  }, [status, records, metaById, tombstones, syncNow]);

  // Retry on reconnection.
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (typeof window === 'undefined') return;
    const handler = () => {
      void syncNow({ fullPush: false });
    };
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [status, syncNow]);

  // When the session ends (logout), wipe the pull cursor so a future login
  // doesn't skip records changed in the meantime.
  useEffect(() => {
    if (status === 'anonymous') clearLastPull();
  }, [status]);
}
