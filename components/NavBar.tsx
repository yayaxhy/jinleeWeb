"use client";

import Link from 'next/link';
import { LoginButton } from './LoginButton';

const links = [
  { href: '/', label: 'HOME' },
  { href: '/join', label: '加入我们' },
  { href: '/peiwanList', label: '陪玩列表' },
  { href: '/profile', label: '个人主页' },
];

export function NavBar() {
  return (
    <header className="relative z-20 w-full">
      <div className="h-[3px] bg-black" />
      <div className="border-b border-black/70 bg-white/95 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur">
        <nav className="flex items-center gap-4 sm:gap-8 px-4 sm:px-8 py-4 text-xs sm:text-sm uppercase tracking-[0.22em] text-black w-full">
          <Link
            href="/"
            className="mr-4 flex shrink-0 flex-col items-center font-serif leading-tight transition-colors duration-150 hover:text-neutral-600"
          >
            <span className="text-2xl sm:text-3xl tracking-[0.35em]">JINLEE</span>
            <span className="text-base sm:text-lg tracking-[0.5em] -mt-1">CLUB</span>
          </Link>
          <div className="text-xl sm:text-xl flex flex-1 items-center font-serif gap-4 sm:gap-16 overflow-x-auto">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap font-semibold transition-colors duration-150 hover:text-neutral-500"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="text-xl sm:text-xl ml-auto shrink-0">
            <LoginButton />
          </div>
        </nav>
      </div>
    </header>
  );
}
