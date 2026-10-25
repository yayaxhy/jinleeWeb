'use client';
import { SiteText, useSiteCopy } from "@/components/SiteCopyProvider";


import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import {
  OPENING_BENEFIT,
  type OpeningBenefitName,
  type OpeningBenefitsStatus,
} from '@/lib/opening-benefits';

const specialCouponImage = '/brand/dlm-v1/prizes/13-special-9-zhe-voucher.png';
const crownCouponImage = '/brand/dlm-v1/prizes/17-day-crown-75-voucher.png';
const characterArt = '/brand/dlm-v1/operations/18-thankBoss.gif';

const firstRechargeBenefits = [
  ['288 点点券', '15 点点券'],
  ['688 点点券', '35 点点券'],
  ['2288 点点券', '150 点点券'],
  ['3888 点点券', '280 点点券'],
  ['6888 点点券', '500 点点券'],
] as const;

function DiscordEmoji({
  id,
  name,
  animated = false,
}: {
  id: string;
  name: string;
  animated?: boolean;
}) {
  return (
    <img
      src={`https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'webp'}?size=64&quality=lossless`}
      alt={name}
      width={22}
      height={22}
      className="inline-block h-[1.1em] w-[1.1em] align-[-0.18em]"
    />
  );
}

const formatBerlinTime = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

function ClaimButton({
  benefit,
  disabled,
}: {
  benefit: OpeningBenefitName;
  disabled: boolean;
}) {
  const siteCopy = useSiteCopy();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const claim = async () => {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch('/api/opening-benefits/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benefit }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setMessage(data.error ?? siteCopy("site.components.opening.openingbenefitspanel.02a21b5df7ee"));
        return;
      }
      setMessage(siteCopy("site.components.opening.openingbenefitspanel.c3e38e116667"));
      router.refresh();
    } catch {
      setMessage(siteCopy("site.components.opening.openingbenefitspanel.885588aca878"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="shrink-0 space-y-2 text-center">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={claim}
        className="relative inline-flex min-w-36 items-center justify-center rounded-full border-2 border-[#fff0bd] bg-gradient-to-r from-[#e63e78] via-[#f16596] to-[#db3673] px-6 py-3 text-sm font-black text-white shadow-[0_7px_0_#9d204d,0_0_24px_rgba(244,113,163,0.48)] transition hover:-translate-y-1 hover:scale-105 hover:brightness-110 active:translate-y-1 active:shadow-[0_3px_0_#9d204d] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-none disabled:bg-[#d9c6cf] disabled:shadow-none before:absolute before:-inset-2 before:rounded-full before:border before:border-[#f28bab]/60 enabled:before:animate-ping"
      >
        {pending ? <SiteText copyKey="site.components.opening.openingbenefitspanel.ba4ab6109657" /> : <SiteText copyKey="site.components.opening.openingbenefitspanel.eee4885efef9" />}
      </button>
      {message ? (
        <p className="text-xs font-medium text-[#ba4a6d]" role="status">
          <SiteText namespace="site.components.opening.openingbenefitspanel" value={message} />
        </p>
      ) : null}
    </div>
  );
}

function TinyLabel({
  children,
  tone = 'pink',
}: {
  children: ReactNode;
  tone?: 'pink' | 'cream' | 'lavender';
}) {
  const tones = {
    pink: 'bg-[#ffe0e9] text-[#c64e72]',
    cream: 'bg-[#fff0c6] text-[#a46722]',
    lavender: 'bg-[#e9e2ff] text-[#725aa6]',
  };
  return (
    <p
      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black tracking-[0.17em] ${tones[tone]}`}
    >
      {children}
    </p>
  );
}

export function OpeningBenefitsPanel({
  status,
}: {
  status: OpeningBenefitsStatus;
}) {
  const siteCopy = useSiteCopy();
  const weeklyProgress = Math.min(
    100,
    (Number(status.weeklyCrown.actualSpend) / status.weeklyCrown.targetSpend) *
      100,
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#fff7f2] px-4 py-8 text-[#563b4c] sm:px-6 sm:py-12">
      <section className="mx-auto max-w-6xl">
        <div className="relative isolate overflow-hidden rounded-[2.5rem] border border-[#ffc3d3] bg-[#fff1f3] px-6 py-8 shadow-[0_24px_70px_rgba(234,103,139,0.19)] sm:px-10 sm:py-10">
          <div className="absolute inset-0 -z-10 opacity-35 [background-image:radial-gradient(#f3a0b9_1.15px,transparent_1.15px)] [background-size:17px_17px]" />
          <div className="absolute -left-20 -top-24 -z-10 h-64 w-64 rounded-full bg-[#ffd2df] blur-2xl" />
          <div className="absolute -bottom-24 right-1/4 -z-10 h-52 w-52 rounded-full bg-[#ffe5a8]/75 blur-2xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <TinyLabel><SiteText copyKey="site.components.opening.openingbenefitspanel.3fbd6fcc2409" /></TinyLabel>
              <h1 className="mt-4 text-4xl font-black leading-[0.98] tracking-[-0.065em] text-[#e75d86] sm:text-6xl"><SiteText copyKey="site.components.opening.openingbenefitspanel.3959f92bfef2" /><br />
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#8d6476] sm:text-base"><SiteText copyKey="site.components.opening.openingbenefitspanel.7b90a679f758" /></p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/profile/bag"
                className="rounded-full bg-[#e95d86] px-4 py-2.5 text-sm font-black text-white shadow-[0_5px_0_#be4165] transition hover:-translate-y-0.5 hover:bg-[#f17097]"
              ><SiteText copyKey="site.components.opening.openingbenefitspanel.ad3e36df50fb" /></Link>
              <Link
                href="/profile"
                className="rounded-full border border-[#f2c4d2] bg-white/75 px-4 py-2.5 text-sm font-bold text-[#956178] transition hover:bg-white"
              ><SiteText copyKey="site.components.opening.openingbenefitspanel.d04c1f47483e" /></Link>
            </div>
          </div>

          <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/75 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs font-bold text-[#ba718c]"><SiteText copyKey="site.components.opening.openingbenefitspanel.f03aa30dba88" /></p>
              <p className="mt-1 text-sm font-black text-[#6a3b52]"><SiteText copyKey="site.components.opening.openingbenefitspanel.b7fee1cda5f1" /></p>
            </div>
            <div className="rounded-2xl bg-white/75 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs font-bold text-[#ba718c]"><SiteText copyKey="site.components.opening.openingbenefitspanel.461d7470eebe" /></p>
              <p className="mt-1 text-sm font-black text-[#6a3b52]"><SiteText copyKey="site.components.opening.openingbenefitspanel.f9ae09da85d4" /></p>
            </div>
            <div className="rounded-2xl bg-white/75 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs font-bold text-[#ba718c]"><SiteText copyKey="site.components.opening.openingbenefitspanel.ceb1990c8923" /></p>
              <p className="mt-1 text-sm font-black text-[#6a3b52]"><SiteText copyKey="site.components.opening.openingbenefitspanel.bac5d824af50" /></p>
            </div>
          </div>
        </div>

        {!status.active ? (
          <div className="mt-5 rounded-2xl border border-[#f1cd83] bg-[#fff5d8] px-5 py-4 text-sm font-medium text-[#855c20]"><SiteText copyKey="site.components.opening.openingbenefitspanel.091ee6a74a99" /></div>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <article className="relative overflow-hidden rounded-[2rem] border border-[#ffc3d4] bg-white p-6 shadow-[0_12px_30px_rgba(225,105,143,0.1)] sm:p-7">
            <div className="absolute -right-14 -top-12 h-40 w-40 rounded-full bg-[#ffe1a4]/65" />
            <div className="relative">
              <TinyLabel tone="cream"><SiteText copyKey="site.components.opening.openingbenefitspanel.72bb1a767ed8" /></TinyLabel>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#63394f]"><SiteText copyKey="site.components.opening.openingbenefitspanel.24bd9fba4c49" /></h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#896476]"><SiteText copyKey="site.components.opening.openingbenefitspanel.5c19f50e1479" /></p>
              <p className="mt-5 rounded-2xl bg-[#fff7e5] px-4 py-3 text-sm font-bold text-[#9a692c]">
                {status.commission.eligible ? <SiteText copyKey="site.components.opening.openingbenefitspanel.71d2812e3060" /> : <SiteText copyKey="site.components.opening.openingbenefitspanel.22ed0628e383" />}
              </p>
              <p className="mt-3 text-xs text-[#aa7b8c]"><SiteText copyKey="site.components.opening.openingbenefitspanel.75090948a13f" />{formatBerlinTime(status.commission.endsAt)}
              </p>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[2rem] border border-[#ffc3d4] bg-white p-6 shadow-[0_12px_30px_rgba(225,105,143,0.1)] sm:p-7">
            <Image
              src={specialCouponImage}
              alt={siteCopy("site.components.opening.openingbenefitspanel.8fd8b9c4ee21")}
              width={650}
              height={433}
              className="pointer-events-none absolute right-5 top-1/2 w-[42%] -translate-y-1/2 opacity-95 drop-shadow-[0_13px_12px_rgba(160,62,96,0.16)] sm:right-6 sm:w-[40%]"
            />
            <div className="relative max-w-[56%] sm:max-w-[57%]">
              <TinyLabel><SiteText copyKey="site.components.opening.openingbenefitspanel.310543c2dc7d" /></TinyLabel>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#63394f]"><SiteText copyKey="site.components.opening.openingbenefitspanel.a55e3cd45e98" /></h2>
              <p className="mt-3 text-sm leading-6 text-[#896476]"><SiteText copyKey="site.components.opening.openingbenefitspanel.4121a8be5c21" /></p>
              <p className="mt-4 text-xs leading-5 text-[#aa7b8c]">
                {status.dailyDiscount.claimedToday ? <SiteText copyKey="site.components.opening.openingbenefitspanel.54c55d5ba479" /> : <SiteText copyKey="site.components.opening.openingbenefitspanel.de835703a0a2" />}
              </p>
              <div className="mt-4">
                <ClaimButton
                  benefit={OPENING_BENEFIT.DAILY_DISCOUNT}
                  disabled={!status.dailyDiscount.eligible}
                />
              </div>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[2rem] border border-[#d9cbff] bg-[#faf8ff] p-6 shadow-[0_12px_30px_rgba(117,91,189,0.1)] sm:p-7">
            <Image
              src={crownCouponImage}
              alt={siteCopy("site.components.opening.openingbenefitspanel.f602e55b23ce")}
              width={650}
              height={433}
              className="pointer-events-none absolute right-5 top-1/2 w-[42%] -translate-y-1/2 opacity-95 drop-shadow-[0_13px_12px_rgba(113,79,173,0.15)] sm:right-6 sm:w-[40%]"
            />
            <div className="relative max-w-[56%] sm:max-w-[57%]">
              <TinyLabel tone="lavender"><SiteText copyKey="site.components.opening.openingbenefitspanel.461d7470eebe" /></TinyLabel>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#5a477c]"><SiteText copyKey="site.components.opening.openingbenefitspanel.c9bc33879ec6" /></h2>
              <p className="mt-3 text-sm leading-6 text-[#796b92]"><SiteText copyKey="site.components.opening.openingbenefitspanel.dc29e5b2bfce" /></p>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#e5ddfb] p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#b18af0] to-[#7c60c4]"
                  style={{ width: `${weeklyProgress}%` }}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-[#8e7bad]"><SiteText copyKey="site.components.opening.openingbenefitspanel.3fb7c4a59bf1" />{status.weeklyCrown.actualSpend} / ¥
                {status.weeklyCrown.targetSpend}
                <br /><SiteText copyKey="site.components.opening.openingbenefitspanel.550c53bd25df" />{formatBerlinTime(status.weeklyCrown.weekEndsAt)}
              </p>
              <p className="mt-1 text-xs font-medium text-[#8e7bad]">
                {status.weeklyCrown.claimed ? <SiteText copyKey="site.components.opening.openingbenefitspanel.9b7a4b1da563" /> : <SiteText copyKey="site.components.opening.openingbenefitspanel.7fa11e415170" />}
              </p>
              <div className="mt-4">
                <ClaimButton
                  benefit={OPENING_BENEFIT.WEEKLY_CROWN}
                  disabled={!status.weeklyCrown.eligible}
                />
              </div>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[2rem] border border-[#bfe9df] bg-[#f4fffb] p-6 shadow-[0_12px_30px_rgba(66,159,137,0.1)] sm:p-7">
            <div className="pointer-events-none absolute right-5 top-1/2 h-32 w-32 -translate-y-1/2 overflow-hidden rounded-[1.75rem] bg-white shadow-[0_13px_12px_rgba(55,135,116,0.16)] sm:right-6 sm:h-36 sm:w-36">
              <Image
                src={characterArt}
                alt={siteCopy("site.components.opening.openingbenefitspanel.a731b36ba6d9")}
                fill
                sizes="192px"
                unoptimized
                className="object-contain"
              />
            </div>
            <div className="relative max-w-[56%] sm:max-w-[57%]">
              <TinyLabel tone="cream"><SiteText copyKey="site.components.opening.openingbenefitspanel.06a2e6f8406e" /></TinyLabel>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#3b756b]"><SiteText copyKey="site.components.opening.openingbenefitspanel.bd4b07c26100" /></h2>
              <p className="mt-3 text-sm leading-6 text-[#63867f]"><SiteText copyKey="site.components.opening.openingbenefitspanel.7935f2412dc9" /></p>
              <p className="mt-4 text-xs leading-5 text-[#5f9a8e]"><SiteText copyKey="site.components.opening.openingbenefitspanel.6e3c10145a67" />{status.twoOrderTask.qualifyingTransactions} /{' '}
                {status.twoOrderTask.targetTransactions}<SiteText copyKey="site.components.opening.openingbenefitspanel.26288733feda" />{status.twoOrderTask.minimumAmount}）
              </p>
              <p className="mt-1 text-xs font-medium text-[#5f9a8e]">
                {status.twoOrderTask.claimed ? <SiteText copyKey="site.components.opening.openingbenefitspanel.8f740011331d" /> : <SiteText copyKey="site.components.opening.openingbenefitspanel.54b14313d26c" />}
              </p>
              <div className="mt-4">
                <ClaimButton
                  benefit={OPENING_BENEFIT.TWO_ORDERS}
                  disabled={!status.twoOrderTask.eligible}
                />
              </div>
            </div>
          </article>
        </div>

        <article className="relative mt-5 overflow-hidden rounded-[2rem] border border-[#ffd7a0] bg-[#fff9ed] px-6 py-6 sm:px-8">
          <div
            className="absolute right-8 top-6 text-5xl text-[#f4bc54] opacity-70"
            aria-hidden
          >
            ✦
          </div>
          <TinyLabel tone="cream"><SiteText copyKey="site.components.opening.openingbenefitspanel.0abcd259cb78" /></TinyLabel>
          <h2 className="mt-3 text-xl font-black tracking-[-0.035em] text-[#74532b]"><SiteText copyKey="site.components.opening.openingbenefitspanel.2408ade865d3" /></h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#987647]"><SiteText copyKey="site.components.opening.openingbenefitspanel.48e9a30f31b1" /></p>
          <div className="relative mt-5 max-w-4xl rounded-[1.5rem] border border-[#f2d7a4] bg-white/75 p-4 shadow-sm sm:p-5">
            <h3 className="flex flex-wrap items-center gap-2 text-lg font-black text-[#74532b] sm:text-xl">
              <DiscordEmoji id="1516466617825890394" name="owo" /><SiteText copyKey="site.components.opening.openingbenefitspanel.33815fa256e1" /><DiscordEmoji id="1516466617825890394" name="owo" />
            </h3>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {firstRechargeBenefits.map(([recharge, bonus]) => (
                <p
                  key={recharge}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-[#fff8e9] px-4 py-3 text-sm font-bold text-[#865d2a]"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <DiscordEmoji
                      id="1140459660860731402"
                      name="im_frog_vibe"
                      animated
                    />
                    {recharge}
                  </span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[#bd6b36]">
                    <DiscordEmoji id="1552040534288240692" name="emoji" />
                    <code className="rounded bg-[#ffe8b9] px-1.5 py-0.5 font-sans text-xs font-black">{"赠"}</code>
                    {bonus}
                  </span>
                </p>
              ))}
            </div>

            <div className="mt-4 border-t border-[#f2dfbc] pt-4 text-sm leading-6 text-[#8c6736]">
              <p className="font-black text-[#77501f]">
                <DiscordEmoji id="1552053520344027186" name="912405punkbunnyheart" />{' '}<SiteText copyKey="site.components.opening.openingbenefitspanel.d12cc4933413" /></p>
              <p className="mt-2"><SiteText copyKey="site.components.opening.openingbenefitspanel.421255f3735f" />{' '}
                <DiscordEmoji id="1101206805683642381" name="im_blobcat_2cool4u" />{' '}<SiteText copyKey="site.components.opening.openingbenefitspanel.706640bd205c" /></p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
