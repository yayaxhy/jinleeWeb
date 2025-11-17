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

export function LoginButton() {
  const { session, loading } = useSessionContext();
  const [isProcessing, setIsProcessing] = useState(false);

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
      <button className="transition-transform duration-200 hover:scale-150 hover:text-white/70 opacity-70" disabled>
        ...
      </button>
    );
  }

  if (session) {
    return (
      <button
        className="transition-transform duration-200 hover:scale-150 hover:text-white/70"
        onClick={handleLogout}
        title="点击退出登录"
      >
        {session.username}
      </button>
    );
  }

  return (
    <button
      className="transition-transform duration-200 hover:scale-150 hover:text-white/70"
      onClick={handleLogin}
    >
      登录
    </button>
  );
}
