import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLotteryFusionHistoryPageData } from '@/lib/lottery-fusion-page-data';
import type { LotteryFusionSourceKind } from '@/lib/lottery-fusion';

const ROME_TIMEZONE = 'Europe/Rome';

const POOL_LABEL: Record<string, string> = {
  NORMAL: '银色',
  MEDIUM: '金色',
  ADVANCED: '高级',
  SPECIAL: '特殊',
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  UNUSED: {
    label: '未使用',
    className: 'border-[#ead8c7] bg-[#fff7f1] text-[#a9704f]',
  },
  USED: {
    label: '已使用',
    className: 'border-[#d5d7de] bg-[#f6f7fb] text-[#6c7287]',
  },
  EXPIRED: {
    label: '已过期',
    className: 'border-[#efcfcb] bg-[#fff3f1] text-[#c56b60]',
  },
};

const SOURCE_LABEL: Record<LotteryFusionSourceKind, string> = {
  lottery: '抽奖',
  coupon: '券',
  pointshop: '积分商城',
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', {
    timeZone: ROME_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LotteryFusionHistoryPage() {
  const data = await getLotteryFusionHistoryPageData();
  if (!data) {
    redirect('/');
  }

  return (
    <main className="min-h-screen bg-[#f7f3ef] px-4 py-10 text-[#171717] sm:px-6 sm:py-12 lg:px-6 lg:py-16">
      <section className="mx-auto max-w-[1280px] space-y-6">
        <div className="flex flex-col gap-4 rounded-[32px] border border-[#f0ddd0] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(255,249,245,0.96))] p-6 shadow-[0_18px_46px_rgba(238,221,206,0.36)] md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.36em] text-[#b1917f]">Fusion History</p>
            <h1
              className="mt-3 text-[32px] font-semibold text-[#74452f] sm:text-[42px]"
              style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}
            >
              重铸记录
            </h1>
            <p className="mt-3 max-w-[720px] text-sm leading-7 text-[#8e6a58] sm:text-[15px]">
              查看每次重铸消耗了哪些券或奖品、产出了什么结果，以及当前结果的使用状态。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/profile/lottery-fusion"
              className="inline-flex items-center justify-center rounded-full border border-[#ead7c8] bg-white px-5 py-3 text-sm font-medium text-[#7b5643] shadow-[0_10px_24px_rgba(232,215,201,0.26)] transition hover:translate-y-[-1px]"
            >
              返回重铸页
            </Link>
            <Link
              href="/profile/bag"
              className="inline-flex items-center justify-center rounded-full border border-[#e2c1a8] bg-[linear-gradient(180deg,_#a95a5c,_#8d444a)] px-5 py-3 text-sm font-medium text-white shadow-[0_12px_28px_rgba(166,92,95,0.26)] transition hover:translate-y-[-1px]"
            >
              查看背包
            </Link>
          </div>
        </div>

        {data.historyEntries.length === 0 ? (
          <div className="rounded-[32px] border border-[#f0ddd0] bg-white/95 p-10 text-center text-[#a07b68] shadow-[0_18px_46px_rgba(238,221,206,0.36)]">
            暂无重铸记录。
          </div>
        ) : (
          <div className="space-y-5">
            {data.historyEntries.map((entry) => {
              const statusMeta = STATUS_META[entry.result.status] ?? STATUS_META.UNUSED;

              return (
                <article
                  key={entry.drawId}
                  className="rounded-[32px] border border-[#f0ddd0] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(255,249,245,0.96))] p-5 shadow-[0_18px_46px_rgba(238,221,206,0.36)] lg:p-6"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2
                          className="text-[28px] font-semibold text-[#74452f]"
                          style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}
                        >
                          {entry.result.prizeName}
                        </h2>
                        <span className="rounded-full border border-[#ead9cb] bg-[#fff7f1] px-3 py-1 text-xs font-semibold text-[#b27b58]">
                          {POOL_LABEL[entry.result.pool] ?? entry.result.pool}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm text-[#8f6d5a]">
                        <p>重铸时间：{formatDateTime(entry.createdAt)}</p>
                        <p>重铸规则：{entry.rule ? `${entry.rule.title} · ${entry.rule.detail}` : `${entry.fusionCount} 个融合`}</p>
                        <p>结果到期：{formatDateTime(entry.result.expiresAt)}</p>
                        <p>结果使用：{formatDateTime(entry.result.consumeAt)}</p>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#f0ddd0] bg-[#fffaf6] px-5 py-4 text-sm text-[#8d6a59] xl:min-w-[320px]">
                      <p className="font-semibold text-[#754834]">本次消耗 {entry.sourceItems.length} 个券/奖品</p>
                      <p className="mt-2 leading-7">
                        {entry.rule?.detail ?? '本次记录未匹配到标准的 3 / 4 / 6 档规则，可能是历史数据。'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {entry.sourceItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="rounded-[24px] border border-[#efe0d2] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(240,224,210,0.28)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full border border-[#f0ddcf] bg-[#fff8f2] px-3 py-1 text-[11px] font-semibold text-[#b27b58]">
                            {SOURCE_LABEL[item.sourceKind]} {index + 1}
                          </span>
                          <span className="text-xs text-[#b89a86]">{POOL_LABEL[item.pool] ?? item.pool}</span>
                        </div>
                        <p
                          className="mt-4 overflow-hidden text-ellipsis whitespace-nowrap text-[18px] font-semibold text-[#73452f]"
                          style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}
                          title={item.prizeName}
                        >
                          {item.prizeName}
                        </p>
                        <p className="mt-2 text-xs leading-6 text-[#9a7a68]">消耗时间：{formatDateTime(item.consumeAt)}</p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
