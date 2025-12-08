"use client";

import Link from 'next/link';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = () => setMenuOpen(true);
  const closeMenu = () => setMenuOpen(false);
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
      <div
        className="relative"
        onMouseEnter={openMenu}
        onMouseLeave={closeMenu}
        onFocus={openMenu}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            closeMenu();
          }
        }}
      >
        <Link
          href="/profile"
          className={`${baseClass} inline-flex items-center`}
          title="进入个人主页"
        >
          {session.username}
        </Link>
        <div
          className={`absolute right-0 mt-2 w-44 rounded-md border border-black/10 bg-white/95 text-sm shadow-lg transition duration-150 ease-out ${
            menuOpen
              ? 'pointer-events-auto opacity-100 translate-y-0'
              : 'pointer-events-none opacity-0 translate-y-1'
          }`}
          onMouseEnter={openMenu}
          onMouseLeave={closeMenu}
        >
          <Link
            href="/profile"
            className="block w-full px-4 py-2 text-left text-black hover:bg-neutral-100"
          >
            个人主页
          </Link>
          <button
            className="block w-full px-4 py-2 text-left text-black hover:bg-neutral-100"
            onClick={handleLogout}
          >
            退出登录
          </button>
        </div>
      </div>
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
