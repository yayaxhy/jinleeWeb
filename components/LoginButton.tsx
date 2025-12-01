"use client";

import { useState } from 'react';
import { useSessionContext } from './SessionProvider';

const buildLoginUrl = () => {
  if (typeof window === 'undefined') return '/api/discord/login';
  const callback = `${window.location.pathname}${window.location.search}`;
  const url = new URL('/api/discord/login', window.location.origin);
  url.searchParams.set('callbackUrl', callback || '/profile');
  return url.toString();
};

type LoginButtonProps = {
  className?: string;
};

export function LoginButton({ className }: LoginButtonProps) {
  const { session, loading } = useSessionContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const baseClass =
    className ??
    'whitespace-nowrap font-semibold uppercase tracking-[0.22em] text-black transition-colors duration-150 hover:text-neutral-500';

  const handleLogin = () => {
    window.location.href = buildLoginUrl();
  };

  const handleLogout = async () => {
    setIsProcessing(true);
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/';
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading || isProcessing) {
    return (
      <button className={`${baseClass} opacity-60`} disabled>
        ...
      </button>
    );
  }

  if (session) {
    return (
      <button
        className={baseClass}
        onClick={handleLogout}
        title="点击退出登录"
      >
        {session.username}
      </button>
    );
  }

  return (
    <button
      className={baseClass}
      onClick={handleLogin}
    >
      登录
    </button>
  );
}
