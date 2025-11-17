"use client";

import { useEffect, useMemo, useRef } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

const DEFAULT_CALLBACK = '/profile';

const resolveCallbackUrl = (raw?: string | null) => {
  if (!raw) return DEFAULT_CALLBACK;
  if (raw.startsWith('/')) return raw;

  if (typeof window !== 'undefined') {
    try {
      const parsed = new URL(raw, window.location.origin);
      if (parsed.origin === window.location.origin) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      // ignore invalid URLs
    }
  }

  return DEFAULT_CALLBACK;
};

export default function DiscordLoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(
    () => resolveCallbackUrl(searchParams?.get('callbackUrl')),
    [searchParams],
  );
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    signIn('discord', { callbackUrl });
  }, [callbackUrl]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white space-y-6 text-center px-6">
      <div className="space-y-4 max-w-md">
        <h1 className="text-3xl font-semibold tracking-wide">正在前往 Discord 登录…</h1>
        <p className="text-white/70">
          如果浏览器没有自动跳转，请点击下面的按钮手动启动授权流程。
        </p>
        <button
          className="inline-flex items-center justify-center rounded-full bg-[#5865F2] px-8 py-3 text-sm uppercase tracking-[0.4em] hover:bg-[#4753c7] transition"
          onClick={() => signIn('discord', { callbackUrl })}
        >
          Sign in with Discord
        </button>
      </div>
    </main>
  );
}
