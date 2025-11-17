"use client";

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { SessionSnapshot } from '@/types/session';

type SessionContextValue = {
  session: SessionSnapshot | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setSession: (session: SessionSnapshot | null) => void;
};

const SessionContext = createContext<SessionContextValue>({
  session: null,
  loading: false,
  refresh: async () => {},
  setSession: () => {},
});

type SessionProviderProps = {
  children: ReactNode;
  initialSession: SessionSnapshot | null;
};

export function SessionProvider({ children, initialSession }: SessionProviderProps) {
  const [session, setSession] = useState<SessionSnapshot | null>(initialSession);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/session', { credentials: 'include' });
      if (response.ok) {
        const data = (await response.json()) as { session: SessionSnapshot | null };
        setSession(data.session ?? null);
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      loading,
      refresh,
      setSession,
    }),
    [session, loading, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSessionContext = () => useContext(SessionContext);
