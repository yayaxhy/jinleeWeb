'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const TRACK_ENDPOINT = '/api/analytics/pageview';

function shouldTrackInBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.location.hostname) return false;
  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return false;
  return true;
}

function sendPageView(path: string, search: string) {
  const payload = JSON.stringify({
    path,
    search: search ? `?${search}` : null,
  });

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const queued = navigator.sendBeacon(
        TRACK_ENDPOINT,
        new Blob([payload], { type: 'application/json' }),
      );
      if (queued) return;
    }
  } catch {
    // Fallback to fetch below.
  }

  fetch(TRACK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
    credentials: 'same-origin',
  }).catch(() => {});
}

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastSentKeyRef = useRef<string>('');

  const search = searchParams?.toString() ?? '';

  useEffect(() => {
    if (!pathname) return;
    if (!shouldTrackInBrowser()) return;

    const key = `${pathname}?${search}`;
    if (lastSentKeyRef.current === key) return;
    lastSentKeyRef.current = key;

    sendPageView(pathname, search);
  }, [pathname, search]);

  return null;
}
