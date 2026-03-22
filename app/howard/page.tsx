import Link from 'next/link';
import { AdminPeiwanActions } from '@/components/admin/AdminPeiwanActions';
import { DeletePeiwanCard } from '@/components/admin/DeletePeiwanCard';
import { SyncAllPeiwanTagsCard } from '@/components/admin/SyncAllPeiwanTagsCard';
import { getServerSession } from '@/lib/session';
import { isHowardReadOnlyDiscordId } from '@/lib/admin';

export const metadata = {
  title: 'Howard 工作台 - 功能入口',
};

export default async function HowardPage() {
  const session = await getServerSession();
  const readOnly = isHowardReadOnlyDiscordId(session?.discordId);

  return (
    <div className="space-y-8 text-white">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Howard 功能</h2>
        <p className="text-sm text-white/70">
          可查看收益、流水、抢单记录、可退回打赏、邀请人管理，并进行陪玩管理操作。
        </p>
        {readOnly ? (
          <p className="text-sm text-rose-300">当前账号为只读权限，无法保存陪玩或邀请人修改。</p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70">查看收益</p>
              <p className="text-xs text-white/50">查看当月汇总、抽成与图表数据</p>
            </div>
            <Link
              href="/admin/revenue"
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            >
              前往查看
            </Link>
          </div>
        </div>

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

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70">邀请人管理</p>
              <p className="text-xs text-white/50">查询/维护邀请关系</p>
            </div>
            <Link
              href="/admin/referrals"
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            >
              前往查看
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <AdminPeiwanActions readOnly={readOnly} />
        <div className="grid gap-6 lg:grid-cols-2">
          <SyncAllPeiwanTagsCard readOnly={readOnly} />
          <DeletePeiwanCard readOnly={readOnly} />
        </div>
      </div>
    </div>
  );
}
