'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { OPENING_BENEFIT, type OpeningBenefitName, type OpeningBenefitsStatus } from '@/lib/opening-benefits';

const specialCouponImage = '/lottery-fusion/business/抽奖特殊9折券.PNG';
const crownCouponImage = '/lottery-fusion/business/一日冠75折.PNG';
const cakeImage = '/lottery-fusion/business/小蛋糕.png';

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

function ClaimButton({ benefit, disabled }: { benefit: OpeningBenefitName; disabled: boolean }) {
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
      const data = (await response.json().catch(() => ({}))) as { error?: string };
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
      {message ? <p className="text-xs font-medium text-[#ba4a6d]" role="status">{message}</p> : null}
    </div>
  );
}

function TinyLabel({ children, tone = 'pink' }: { children: ReactNode; tone?: 'pink' | 'cream' | 'lavender' }) {
  const tones = {
    pink: 'bg-[#ffe0e9] text-[#c64e72]',
    cream: 'bg-[#fff0c6] text-[#a46722]',
    lavender: 'bg-[#e9e2ff] text-[#725aa6]',
  };
  return <p className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black tracking-[0.17em] ${tones[tone]}`}>{children}</p>;
}

export function OpeningBenefitsPanel({ status }: { status: OpeningBenefitsStatus }) {
  const weeklyProgress = Math.min(
    100,
    (Number(status.weeklyCrown.actualSpend) / status.weeklyCrown.targetSpend) * 100,
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#fff7f2] px-4 py-8 text-[#563b4c] sm:px-6 sm:py-12">
      <section className="mx-auto max-w-6xl">
        <div className="relative isolate overflow-hidden rounded-[2.5rem] border border-[#ffc3d3] bg-[#fff1f3] px-6 py-8 shadow-[0_24px_70px_rgba(234,103,139,0.19)] sm:px-10 sm:py-10">
          <div className="absolute inset-0 -z-10 opacity-35 [background-image:radial-gradient(#f3a0b9_1.15px,transparent_1.15px)] [background-size:17px_17px]" />
          <div className="absolute -left-20 -top-24 -z-10 h-64 w-64 rounded-full bg-[#ffd2df] blur-2xl" />
          <div className="absolute -bottom-24 right-1/4 -z-10 h-52 w-52 rounded-full bg-[#ffe5a8]/75 blur-2xl" />
          <Image
            src={cakeImage}
            alt=""
            width={200}
            height={200}
            className="pointer-events-none absolute -left-6 bottom-[-34px] hidden w-36 -rotate-[18deg] drop-shadow-[0_13px_14px_rgba(184,73,113,0.22)] sm:block"
          />

          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <TinyLabel>WELCOME TO THE PARTY</TinyLabel>
              <h1 className="mt-4 text-4xl font-black leading-[0.98] tracking-[-0.065em] text-[#5e3149] sm:text-6xl">
                开业福利<br />
                <span className="text-[#e75d86]">可爱上线</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#8d6476] sm:text-base">
                每日券以德国时间为准。已领取的券会直接放进背包，券的数量与到期时间都可以随时查看。
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
              <p className="mt-1 text-sm font-black text-[#6a3b52]">一张特殊 9 折券</p>
            </div>
            <div className="rounded-2xl bg-white/75 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs font-bold text-[#ba718c]">本周攒满</p>
              <p className="mt-1 text-sm font-black text-[#6a3b52]">¥1,000 领日冠券</p>
            </div>
            <div className="rounded-2xl bg-white/75 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs font-bold text-[#ba718c]">陪玩福利</p>
              <p className="mt-1 text-sm font-black text-[#6a3b52]">全陪玩 91% 到账</p>
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
              <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#63394f]">全陪玩 9% 平台抽成</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#896476]">
                活动期间，所有已登记陪玩均按 91% 到账计算，不区分是否独家。
              </p>
              <p className="mt-5 rounded-2xl bg-[#fff7e5] px-4 py-3 text-sm font-bold text-[#9a692c]">
                {status.commission.eligible ? '你已经具备这项陪玩福利资格啦！' : '该项福利仅面向已登记陪玩。'}
              </p>
              <p className="mt-3 text-xs text-[#aa7b8c]">结束：{formatBerlinTime(status.commission.endsAt)}（德国时间）</p>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[2rem] border border-[#ffc3d4] bg-white p-6 shadow-[0_12px_30px_rgba(225,105,143,0.1)] sm:p-7">
            <Image
              src={specialCouponImage}
              alt="特殊九折券"
              width={650}
              height={433}
              className="pointer-events-none absolute -right-14 -bottom-8 w-[52%] rotate-[10deg] opacity-95 drop-shadow-[0_13px_12px_rgba(160,62,96,0.16)] sm:w-[46%]"
            />
            <div className="relative max-w-[62%] sm:max-w-[60%]">
              <TinyLabel>每日领取</TinyLabel>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#63394f]">今日的特殊 9 折券</h2>
              <p className="mt-3 text-sm leading-6 text-[#896476]">
                使用规则与抽奖特殊 9 折券一致：订单结单后返利，最高返 ¥50；每张券有效 30 天。
              </p>
              <p className="mt-4 text-xs leading-5 text-[#aa7b8c]">
                {status.dailyDiscount.claimedToday
                  ? `今日已领取；下次可领：${formatBerlinTime(status.dailyDiscount.nextClaimAt)}`
                  : `今日可领取；零点刷新：${formatBerlinTime(status.dailyDiscount.nextClaimAt)}`}
              </p>
              <div className="mt-4"><ClaimButton benefit={OPENING_BENEFIT.DAILY_DISCOUNT} disabled={!status.dailyDiscount.eligible} /></div>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[2rem] border border-[#d9cbff] bg-[#faf8ff] p-6 shadow-[0_12px_30px_rgba(117,91,189,0.1)] sm:p-7">
            <Image
              src={crownCouponImage}
              alt="日冠七五折券"
              width={650}
              height={433}
              className="pointer-events-none absolute -right-16 -bottom-9 w-[50%] rotate-[9deg] opacity-95 drop-shadow-[0_13px_12px_rgba(113,79,173,0.15)]"
            />
            <div className="relative max-w-[62%] sm:max-w-[61%]">
              <TinyLabel tone="lavender">每周消费</TinyLabel>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#5a477c]">满 ¥1,000 领日冠券</h2>
              <p className="mt-3 text-sm leading-6 text-[#796b92]">
                按本周实际消费计算；退款与优惠返利会从本周累计中扣回。每人每自然周限领一次。
              </p>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#e5ddfb] p-0.5">
                <div className="h-full rounded-full bg-gradient-to-r from-[#b18af0] to-[#7c60c4]" style={{ width: `${weeklyProgress}%` }} />
              </div>
              <p className="mt-2 text-xs leading-5 text-[#8e7bad]">
                本周实际消费 ¥{status.weeklyCrown.actualSpend} / ¥{status.weeklyCrown.targetSpend}<br />
                本周截止：{formatBerlinTime(status.weeklyCrown.weekEndsAt)}
              </p>
              <div className="mt-4"><ClaimButton benefit={OPENING_BENEFIT.WEEKLY_CROWN} disabled={!status.weeklyCrown.eligible} /></div>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[2rem] border border-[#bfe9df] bg-[#f4fffb] p-6 shadow-[0_12px_30px_rgba(66,159,137,0.1)] sm:p-7">
            <Image
              src={cakeImage}
              alt="新用户任务奖励"
              width={200}
              height={200}
              className="pointer-events-none absolute -right-2 bottom-3 w-36 rotate-[10deg] drop-shadow-[0_13px_12px_rgba(55,135,116,0.16)] sm:right-3 sm:w-40"
            />
            <div className="relative max-w-[63%] sm:max-w-[60%]">
              <TinyLabel tone="cream">新用户首周任务</TinyLabel>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#3b756b]">完成 2 单，再送一张券</h2>
              <p className="mt-3 text-sm leading-6 text-[#63867f]">
                仅限活动期间新注册用户，在注册后首 7 天内完成。奖励券同样有效 30 天。
              </p>
              <p className="mt-4 text-xs leading-5 text-[#5f9a8e]">
                进度：{status.newUserTask.completedOrders} / {status.newUserTask.targetOrders} 单
                {status.newUserTask.deadlineAt ? `；截止：${formatBerlinTime(status.newUserTask.deadlineAt)}` : ''}
              </p>
              <div className="mt-4"><ClaimButton benefit={OPENING_BENEFIT.NEW_USER_TWO_ORDERS} disabled={!status.newUserTask.eligible} /></div>
            </div>
          </article>
        </div>

        <article className="relative mt-5 overflow-hidden rounded-[2rem] border border-[#ffd7a0] bg-[#fff9ed] px-6 py-6 sm:px-8">
          <div className="absolute right-8 top-6 text-5xl text-[#f4bc54] opacity-70" aria-hidden>✦</div>
          <TinyLabel tone="cream">充值返利</TinyLabel>
          <h2 className="mt-3 text-xl font-black tracking-[-0.035em] text-[#74532b]">充值返利由人工处理</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#987647]">
            本期不自动发放充值返利；如符合运营公布的返利条件，请联系工作人员人工处理。
          </p>
        </article>
      </section>
    </main>
  );
}
