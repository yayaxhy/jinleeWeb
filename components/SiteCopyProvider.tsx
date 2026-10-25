'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createSiteCopy, newerSiteCopySnapshot, type SiteCopySnapshot, type SiteCopyValues } from '@/lib/site-copy';

const defaultCopy = createSiteCopy();
const SiteCopyContext = createContext(defaultCopy);

export function SiteCopyProvider({ children, initialSnapshot }: { children: ReactNode; initialSnapshot: SiteCopySnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  useEffect(() => {
    setSnapshot((current) => newerSiteCopySnapshot(current, initialSnapshot));
  }, [initialSnapshot]);
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      try {
        const response = await fetch('/api/copy', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const next = await response.json() as SiteCopySnapshot;
        if (!Number.isSafeInteger(next.version) || next.version < 0 || !next.overrides || typeof next.overrides !== 'object' || Array.isArray(next.overrides)) return;
        if (!Object.values(next.overrides).every((value) => typeof value === 'string')) return;
        setSnapshot((current) => newerSiteCopySnapshot(current, next));
      } catch { /* Keep the last successfully loaded copy while offline. */ }
      finally { running = false; }
    };
    const interval = window.setInterval(() => { void refresh(); }, 15_000);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, []);
  const copy = useMemo(() => createSiteCopy(snapshot.overrides), [snapshot.overrides]);
  return <SiteCopyContext.Provider value={copy}>{children}</SiteCopyContext.Provider>;
}
export function useSiteCopy() { return useContext(SiteCopyContext); }

/** Explicit rendering boundary; values, routes and application state stay unchanged. */
export function SiteText({ copyKey, values, value, namespace }: {
  copyKey?: string; values?: SiteCopyValues; value?: ReactNode; namespace?: string;
}) {
  const copy = useSiteCopy();
  return copyKey ? copy(copyKey, values) : copy.text(value, namespace);
}
