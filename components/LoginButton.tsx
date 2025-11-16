"use client";

import { signIn, signOut, useSession } from 'next-auth/react';

export function LoginButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <button className="transition-transform duration-200 hover:scale-150 hover:text-white/70 opacity-70">
        ...
      </button>
    );
  }

  if (session?.user) {
    const displayName = session.user.name ?? (session.user as any).id;
    return (
      <button
        className="transition-transform duration-200 hover:scale-150 hover:text-white/70"
        onClick={() => signOut()}
        title="点击退出登录"
      >
        {displayName}
      </button>
    );
  }

  return (
    <button
      className="transition-transform duration-200 hover:scale-150 hover:text-white/70"
      onClick={() => signIn('discord')}
    >
      登录
    </button>
  );
}
