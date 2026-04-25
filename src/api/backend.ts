import type { CalculationRecord } from '../components/Calculator/logic';

/**
 * Base URL of the ColCalc backend API. In dev this is typically
 * `http://localhost:3000/api`; in prod it should be same-origin (e.g. the
 * reverse proxy in front of the FE exposes `/api`). When unset, calls fall
 * back to `/api` on the current origin.
 */
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  '/api';

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'INTERNAL'
  | 'NETWORK';

export class ApiError extends Error {
  readonly code: ApiErrorCode | string;
  readonly status: number;

  constructor(code: ApiErrorCode | string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

type ErrorEnvelope = { error?: { code?: string; message?: string } };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      ...init,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network request failed';
    throw new ApiError('NETWORK', message, 0);
  }

  // 204 / empty body short-circuit.
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const parsed: unknown = text ? safeJsonParse(text) : undefined;

  if (!res.ok) {
    const env = (parsed && typeof parsed === 'object' ? parsed : {}) as ErrorEnvelope;
    const code = env.error?.code ?? `HTTP_${res.status}`;
    const message = env.error?.message ?? `Request failed (${res.status})`;
    throw new ApiError(code, message, res.status);
  }

  return (parsed ?? undefined) as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export type AuthUser = { id: string; email: string };

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    return await request<AuthUser>('/auth/me', { method: 'GET' });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export async function requestMagicLink(email: string): Promise<void> {
  await request<{ ok: true }>('/auth/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function logout(): Promise<void> {
  await request<{ ok: true }>('/auth/logout', { method: 'POST' });
}

export async function deleteAccount(): Promise<void> {
  await request<{ ok: true }>('/account', { method: 'DELETE' });
}

/**
 * Wire record shape — mirrors CalculationRecord with LWW sync metadata.
 * `id` is the original client-side Date.now() integer; keep it stable when
 * round-tripping through the server.
 */
export type SyncRecord = CalculationRecord & {
  updatedAt: string;
  deletedAt?: string | null;
};

export type SyncResponse = {
  now: string;
  pulled: SyncRecord[];
  conflicts: { id: number; resolvedRecord: SyncRecord }[];
};

export type SyncRequest = {
  since?: string | null;
  push?: SyncRecord[];
};

export async function syncRecords(body: SyncRequest): Promise<SyncResponse> {
  return request<SyncResponse>('/records/sync', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listRecords(): Promise<SyncRecord[]> {
  const res = await request<{ records: SyncRecord[] }>('/records', { method: 'GET' });
  return res.records;
}

export async function deleteRecordRemote(id: number): Promise<{ deletedAt: string }> {
  return request<{ deletedAt: string }>(`/records/${id}`, { method: 'DELETE' });
}
