'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { OPENING_BENEFIT, type OpeningBenefitName, type OpeningBenefitsStatus } from '@/lib/opening-benefits';

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
      setMessage('已发放到背包。');
      router.refresh();
    } catch {
      setMessage('网络异常，请稍后重试。');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={claim}
        className="rounded-full bg-[#5c43a3] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#4d378b] disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {pending ? '领取中…' : '立即领取'}
      </button>
      {message ? <p className="text-xs text-[#5c43a3]" role="status">{message}</p> : null}
    </div>
  );
}

export function OpeningBenefitsPanel({ status }: { status: OpeningBenefitsStatus }) {
  const weeklyProgress = Math.min(
    100,
    (Number(status.weeklyCrown.actualSpend) / status.weeklyCrown.targetSpend) * 100,
  );

  return (
    <main className="min-h-screen bg-[#f7f3ef] px-6 py-16 text-[#171717]">
      <section className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.55em] text-gray-500">Opening Benefits</p>
            <h1 className="text-3xl font-semibold tracking-wide">开业福利</h1>
            <p className="max-w-2xl text-sm leading-6 text-gray-500">
              每日券以德国时间为准；已领取的券会直接进入背包，在背包中可查看数量和到期时间。
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/profile/bag"
              className="rounded-full bg-[#5c43a3] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#4d378b]"
            >
              前往背包
            </Link>
            <Link
              href="/profile"
              className="rounded-full border border-black/10 px-4 py-2 text-sm text-gray-600 transition hover:bg-black/5"
            >
              个人主页
            </Link>
          </div>
        </div>

        {!status.active ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            本期开业福利已结束。
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-[#5c43a3]">陪玩福利</p>
            <h2 className="mt-2 text-xl font-semibold">全陪玩 9% 平台抽成</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              活动期间，所有已登记陪玩均按 91% 到账计算，不区分是否独家。
            </p>
            <p className="mt-4 text-sm text-gray-500">
              {status.commission.eligible ? '你当前已具备陪玩活动资格。' : '该项福利仅面向已登记陪玩。'}
              结束：{formatBerlinTime(status.commission.endsAt)}（德国时间）
            </p>
          </article>

          <article className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-[#5c43a3]">每日领取</p>
            <h2 className="mt-2 text-xl font-semibold">每日一张特殊 9 折券</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              使用规则与抽奖特殊 9 折券一致：订单结单后返利，最高返 ¥50；每张券有效 30 天。
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                {status.dailyDiscount.claimedToday
                  ? `今日已领取，下次可领：${formatBerlinTime(status.dailyDiscount.nextClaimAt)}`
                  : `今日可领取；下次刷新：${formatBerlinTime(status.dailyDiscount.nextClaimAt)}`}
              </p>
              <ClaimButton
                benefit={OPENING_BENEFIT.DAILY_DISCOUNT}
                disabled={!status.dailyDiscount.eligible}
              />
            </div>
          </article>

          <article className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-[#5c43a3]">每周消费</p>
            <h2 className="mt-2 text-xl font-semibold">自然周满 ¥1,000 领一日冠 75 折券</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              按本周实际消费计算；订单、打赏等退款与优惠返利会从本周累计中扣回。每人每自然周限领一次。
            </p>
            <div className="mt-4 space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-[#ede8f6]">
                <div className="h-full rounded-full bg-[#5c43a3]" style={{ width: `${weeklyProgress}%` }} />
              </div>
              <p className="text-sm text-gray-500">
                本周实际消费 ¥{status.weeklyCrown.actualSpend} / ¥{status.weeklyCrown.targetSpend}；本周截止：
                {formatBerlinTime(status.weeklyCrown.weekEndsAt)}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                {status.weeklyCrown.claimedThisWeek ? '本周已领取。' : '达标后可领取。'}
              </p>
              <ClaimButton benefit={OPENING_BENEFIT.WEEKLY_CROWN} disabled={!status.weeklyCrown.eligible} />
            </div>
          </article>

          <article className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-[#5c43a3]">新用户首周</p>
            <h2 className="mt-2 text-xl font-semibold">完成 2 单，再送一张特殊 9 折券</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              仅限活动期间新注册用户，在注册后首 7 天内完成；奖励券同样有效 30 天。
            </p>
            <p className="mt-4 text-sm text-gray-500">
              进度：{status.newUserTask.completedOrders} / {status.newUserTask.targetOrders} 单
              {status.newUserTask.deadlineAt ? `；截止：${formatBerlinTime(status.newUserTask.deadlineAt)}` : ''}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                {status.newUserTask.claimed ? '新用户任务奖励已领取。' : '完成两单后即可领取。'}
              </p>
              <ClaimButton
                benefit={OPENING_BENEFIT.NEW_USER_TWO_ORDERS}
                disabled={!status.newUserTask.eligible}
              />
            </div>
          </article>

          <article className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm md:col-span-2">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-[#5c43a3]">充值返利</p>
            <h2 className="mt-2 text-xl font-semibold">充值返利由人工处理</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              本期不自动发放充值返利；如符合运营公布的返利条件，请联系工作人员人工处理。
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
