import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  getCurrentUser,
  logout as apiLogout,
  requestMagicLink,
  type AuthUser,
} from '../api/backend';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  /** Request a magic link email. Resolves whether or not the email exists (server never leaks). */
  requestLink: (email: string) => Promise<void>;
  /** Clear the session cookie server-side and locally. */
  logout: () => Promise<void>;
  /** Refresh the current user from /auth/me. Useful after the callback redirect. */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const refresh = useCallback(async () => {
    try {
      const me = await getCurrentUser();
      setUser(me);
      setStatus(me ? 'authenticated' : 'anonymous');
    } catch {
      // Treat network / unexpected errors as anonymous so the UI still loads.
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const requestLink = useCallback(async (email: string) => {
    await requestMagicLink(email);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, requestLink, logout, refresh }),
    [user, status, requestLink, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const NOOP_AUTH: AuthContextValue = {
  user: null,
  status: 'anonymous',
  requestLink: async () => {},
  logout: async () => {},
  refresh: async () => {},
};

/**
 * Returns the current auth state. When no <AuthProvider> is mounted (e.g. in
 * isolated component tests) we return a permanent "anonymous, no-op" value so
 * consumers can render without needing test-specific wiring.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  return ctx ?? NOOP_AUTH;
}
