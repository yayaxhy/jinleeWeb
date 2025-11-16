"use client";

import Link from 'next/link';
import { LoginButton } from './LoginButton';

export function NavBar() {
  return (
    <nav className="sm:text-[1.8rem] mt-10 flex flex-wrap items-center justify-center gap-40 text-lg tracking-[0.2em]">
      <Link className="transition-transform duration-200 hover:scale-150 hover:text-white/70" href="/">
        HOME
      </Link>
      <Link className="transition-transform duration-200 hover:scale-150 hover:text-white/70" href="/join">
        加入我们
      </Link>
      <Link className="transition-transform duration-200 hover:scale-130 hover:text-white/70" href="/partners">
        陪玩列表
      </Link>
      <Link className="transition-transform duration-200 hover:scale-150 hover:text-white/70" href="/profile">
        个人主页
      </Link>
      <LoginButton />
    </nav>
  );
}
