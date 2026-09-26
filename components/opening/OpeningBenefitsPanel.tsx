'use client';

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
        setMessage(data.error ?? '领取失败，请稍后重试。');
        return;
      }
      setMessage('已放进背包啦。');
      router.refresh();
    } catch {
      setMessage('网络异常，请稍后重试。');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="shrink-0 space-y-2 text-right">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={claim}
        className="rounded-full bg-[#eb6089] px-5 py-2.5 text-sm font-black text-white shadow-[0_5px_0_#be4165] transition hover:-translate-y-0.5 hover:bg-[#f27198] active:translate-y-1 active:shadow-[0_2px_0_#be4165] disabled:cursor-not-allowed disabled:bg-[#d9c6cf] disabled:shadow-none"
      >
        {pending ? '装进背包中…' : '立即领取'}
      </button>
      {message ? (
        <p className="text-xs font-medium text-[#ba4a6d]" role="status">
          {message}
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
          <div className="pointer-events-none absolute bottom-5 left-5 hidden h-28 w-28 overflow-hidden rounded-[1.8rem] bg-white shadow-[0_13px_14px_rgba(103,80,177,0.2)] sm:block">
            <Image
              src={characterArt}
              alt="抽奖角色插画"
              fill
              sizes="176px"
              unoptimized
              className="object-contain"
            />
          </div>

          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <TinyLabel>WELCOME TO DLM CLUB</TinyLabel>
              <h1 className="mt-4 text-4xl font-black leading-[0.98] tracking-[-0.065em] text-[#e75d86] sm:text-6xl">
                开业福利
                <br />
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#8d6476] sm:text-base">
                已领取的券会直接放进背包，券的数量与到期时间可以前往背包查看。
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/profile/bag"
                className="rounded-full bg-[#e95d86] px-4 py-2.5 text-sm font-black text-white shadow-[0_5px_0_#be4165] transition hover:-translate-y-0.5 hover:bg-[#f17097]"
              >
                去背包看看 ↗
              </Link>
              <Link
                href="/profile"
                className="rounded-full border border-[#f2c4d2] bg-white/75 px-4 py-2.5 text-sm font-bold text-[#956178] transition hover:bg-white"
              >
                个人主页
              </Link>
            </div>
          </div>

          <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/75 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs font-bold text-[#ba718c]">每日打开</p>
              <p className="mt-1 text-sm font-black text-[#6a3b52]">
                一张特殊 9 折券
              </p>
            </div>
            <div className="rounded-2xl bg-white/75 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs font-bold text-[#ba718c]">本周攒满</p>
              <p className="mt-1 text-sm font-black text-[#6a3b52]">
                ¥1,000 领日冠券
              </p>
            </div>
            <div className="rounded-2xl bg-white/75 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs font-bold text-[#ba718c]">陪玩福利</p>
              <p className="mt-1 text-sm font-black text-[#6a3b52]">
                全陪玩 91% 到账
              </p>
            </div>
          </div>
        </div>

        {!status.active ? (
          <div className="mt-5 rounded-2xl border border-[#f1cd83] bg-[#fff5d8] px-5 py-4 text-sm font-medium text-[#855c20]">
            本期开业福利已结束。
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <article className="relative overflow-hidden rounded-[2rem] border border-[#ffc3d4] bg-white p-6 shadow-[0_12px_30px_rgba(225,105,143,0.1)] sm:p-7">
            <div className="absolute -right-14 -top-12 h-40 w-40 rounded-full bg-[#ffe1a4]/65" />
            <div className="relative">
              <TinyLabel tone="cream">陪玩福利 · 直到 12 月 1 日</TinyLabel>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#63394f]">
                全陪玩 9% 平台抽成
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#896476]">
                活动期间，所有已登记陪玩均按 91% 到账计算，不区分是否独家。
              </p>
              <p className="mt-5 rounded-2xl bg-[#fff7e5] px-4 py-3 text-sm font-bold text-[#9a692c]">
                {status.commission.eligible
                  ? '你已经具备这项陪玩福利啦！'
                  : '该项福利仅面向已入职陪玩。'}
              </p>
              <p className="mt-3 text-xs text-[#aa7b8c]">
                结束：{formatBerlinTime(status.commission.endsAt)}
              </p>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[2rem] border border-[#ffc3d4] bg-white p-6 shadow-[0_12px_30px_rgba(225,105,143,0.1)] sm:p-7">
            <Image
              src={specialCouponImage}
              alt="特殊九折券"
              width={650}
              height={433}
              className="pointer-events-none absolute bottom-5 right-5 w-[42%] opacity-95 drop-shadow-[0_13px_12px_rgba(160,62,96,0.16)] sm:bottom-6 sm:right-6 sm:w-[40%]"
            />
            <div className="relative max-w-[56%] sm:max-w-[57%]">
              <TinyLabel>每日领取</TinyLabel>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#63394f]">
                今日的特殊 9 折券
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#896476]">
                使用规则与抽奖特殊 9 折券一致：订单结单后返利，最高返
                ¥50；每张券有效 30 天。
              </p>
              <p className="mt-4 text-xs leading-5 text-[#aa7b8c]">
                {status.dailyDiscount.claimedToday
                  ? `今日已领取；下次可领：${formatBerlinTime(status.dailyDiscount.nextClaimAt)}`
                  : `今日可领取；零点刷新：${formatBerlinTime(status.dailyDiscount.nextClaimAt)}`}
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
              alt="日冠七五折券"
              width={650}
              height={433}
              className="pointer-events-none absolute bottom-5 right-5 w-[42%] opacity-95 drop-shadow-[0_13px_12px_rgba(113,79,173,0.15)] sm:bottom-6 sm:right-6 sm:w-[40%]"
            />
            <div className="relative max-w-[56%] sm:max-w-[57%]">
              <TinyLabel tone="lavender">每周消费</TinyLabel>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#5a477c]">
                每周消费满 ¥1,000 领日冠券
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#796b92]">
                按本周实际消费计算；每人每周限领一次。
              </p>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#e5ddfb] p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#b18af0] to-[#7c60c4]"
                  style={{ width: `${weeklyProgress}%` }}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-[#8e7bad]">
                本周实际消费 ¥{status.weeklyCrown.actualSpend} / ¥
                {status.weeklyCrown.targetSpend}
                <br />
                本周截止：{formatBerlinTime(status.weeklyCrown.weekEndsAt)}
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
            <div className="pointer-events-none absolute bottom-5 right-5 h-32 w-32 overflow-hidden rounded-[1.75rem] bg-white shadow-[0_13px_12px_rgba(55,135,116,0.16)] sm:bottom-6 sm:right-6 sm:h-36 sm:w-36">
              <Image
                src={characterArt}
                alt="抽奖角色插画"
                fill
                sizes="192px"
                unoptimized
                className="object-contain"
              />
            </div>
            <div className="relative max-w-[56%] sm:max-w-[57%]">
              <TinyLabel tone="cream">全员两单任务</TinyLabel>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#3b756b]">
                两笔消费超 ¥100，再送一张券
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#63867f]">
                活动期间所有用户均可参加；点单或打赏每笔实付超过
                ¥100，任意两笔可混合累计。奖励仅可领取一次，券有效 30 天。
              </p>
              <p className="mt-4 text-xs leading-5 text-[#5f9a8e]">
                符合条件的消费：{status.twoOrderTask.qualifyingTransactions} /{' '}
                {status.twoOrderTask.targetTransactions} 笔（每笔 &gt; ¥
                {status.twoOrderTask.minimumAmount}）
              </p>
              <p className="mt-1 text-xs font-medium text-[#5f9a8e]">
                {status.twoOrderTask.claimed
                  ? '奖励已领取；活动期间仅限一次。'
                  : '活动期间，所有用户均可领取一次。'}
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
          <TinyLabel tone="cream">充值返利</TinyLabel>
          <h2 className="mt-3 text-xl font-black tracking-[-0.035em] text-[#74532b]">
            充值返利由人工处理
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#987647]">
            充值返利需要联系客服充值哦～
          </p>
        </article>
      </section>
    </main>
  );
}
