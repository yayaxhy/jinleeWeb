'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const couponImage = '/brand/dlm-v1/prizes/13-special-9-zhe-voucher.png';
const characterArt = '/brand/dlm-v1/operations/17-lottery-special.png';

export function OpeningBenefitsModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!open || pathname === '/opening-benefits') return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opening-benefits-title"
    >
      <button
        type="button"
        aria-label="关闭开业福利提示"
        className="absolute inset-0 bg-[#301722]/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <section className="relative w-full max-w-md overflow-hidden rounded-[2.25rem] border-4 border-white bg-[#fff7f3] px-6 pb-7 pt-8 text-center text-[#5a3447] shadow-[0_30px_80px_rgba(45,15,28,0.46)] sm:px-9">
        <div className="absolute inset-0 -z-10 opacity-55 [background-image:radial-gradient(#f5a1ba_1px,transparent_1px)] [background-size:14px_14px]" />
        <div className="absolute -left-12 -top-12 -z-10 h-40 w-40 rounded-full bg-[#ffd6e1]" />
        <div className="absolute -bottom-20 -right-12 -z-10 h-48 w-48 rounded-full bg-[#ffe19e]" />
        <button
          type="button"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-sm text-[#9d6379] transition hover:bg-white"
          aria-label="关闭开业福利提示"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
        <div className="pointer-events-none absolute -left-4 top-10 h-20 w-20 -rotate-6 overflow-hidden rounded-2xl shadow-[0_8px_12px_rgba(72,61,151,0.16)]">
          <Image
            src={characterArt}
            alt="抽奖角色插画"
            fill
            sizes="80px"
            className="object-cover object-[72%_center]"
          />
        </div>
        <p className="relative text-xs font-black tracking-[0.26em] text-[#d64f79]">
          DLM OPENING PARTY
        </p>
        <h2
          id="opening-benefits-title"
          className="relative mt-3 text-3xl font-black tracking-[-0.055em]"
        >
          给你准备了一份
          <br />
          开业小礼物
        </h2>
        <p className="relative mt-3 text-sm leading-6 text-[#8d6274]">
          每日可领特殊 9 折券，消费满额还有日冠 75
          折券。打开福利页，看看今天能领什么吧！
        </p>
        <Image
          src={couponImage}
          alt="特殊九折券"
          width={650}
          height={433}
          className="relative mx-auto -mb-2 mt-2 w-[88%] rotate-[-3deg] drop-shadow-[0_15px_12px_rgba(168,64,96,0.24)]"
          priority
        />
        <Link
          href="/opening-benefits"
          onClick={() => setOpen(false)}
          className="relative mt-1 inline-flex w-full items-center justify-center rounded-full bg-[#e85c86] px-5 py-3 text-sm font-black text-white shadow-[0_8px_0_#bd4166] transition hover:-translate-y-0.5 hover:bg-[#f26d95] active:translate-y-1 active:shadow-[0_4px_0_#bd4166]"
        >
          打开开业福利
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="relative mt-5 text-xs font-medium text-[#a97789] underline-offset-4 hover:underline"
        >
          先逛逛，晚点再看
        </button>
      </section>
    </div>
  );
}
