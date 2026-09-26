"use client";

import Link from 'next/link';
import Image from 'next/image';
import { LoginButton } from './LoginButton';
import { SITE_ALTERNATE_NAME, SITE_LOGO, SITE_NAME } from '@/lib/site';

const links = [
  { href: '/', label: 'HOME' },
  { href: '/oufu-peiwan', label: '欧服陪玩' },
  { href: '/profile', label: '个人主页' },
  { href: '/recharge', label: '充值中心' },
];

export function NavBar() {
  return (
    <header className="relative z-20 w-full">
      <div className="h-[3px] bg-black" />
      <div className="border-b border-black/70 bg-white/95 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur">
        <nav className="flex items-center gap-4 sm:gap-8 px-4 sm:px-8 py-4 text-xs sm:text-sm uppercase tracking-[0.22em] text-black w-full">
          <Link
            href="/"
            aria-label={`${SITE_NAME}首页`}
            className="mr-4 flex shrink-0 items-center gap-2 leading-tight transition-colors duration-150 hover:text-neutral-600"
          >
            <Image src={SITE_LOGO} alt={SITE_NAME} width={52} height={52} className="rounded-xl object-contain" />
            <span className="flex flex-col gap-1">
              <span className="text-xl sm:text-2xl font-bold normal-case tracking-[0.08em]">{SITE_ALTERNATE_NAME}</span>
              <span className="text-[10px] sm:text-xs tracking-[0.12em]">{SITE_NAME}</span>
            </span>
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
