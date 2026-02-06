import Link from 'next/link';

export const metadata = {
  title: 'Iria 工作台 - 功能入口',
};

export default function IriaPage() {
  return (
    <div className="space-y-6 text-white">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Iria 功能</h2>
        <p className="text-sm text-white/70">可查看流水、抢单记录与可退回打赏。</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70">查询流水</p>
              <p className="text-xs text-white/50">查看个人/时间范围内的流水记录</p>
            </div>
            <Link
              href="/admin/transactions"
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            >
              前往查看
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70">抢单记录</p>
              <p className="text-xs text-white/50">查询派单内容与陪玩抢单名单</p>
            </div>
            <Link
              href="/admin/order-requests"
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            >
              前往查看
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70">可退回打赏</p>
              <p className="text-xs text-white/50">查看 Gift Audit 记录</p>
            </div>
            <Link
              href="/admin/refundable-gifts"
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            >
              前往查看
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
