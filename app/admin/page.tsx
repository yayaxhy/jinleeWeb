import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminPeiwanActions } from '@/components/admin/AdminPeiwanActions';
import { DeletePeiwanCard } from '@/components/admin/DeletePeiwanCard';
import { getServerSession } from '@/lib/session';
import { isAdminDiscordId } from '@/lib/admin';

export default async function AdminHomePage() {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    redirect('/');
  }

  return (
    <div className="space-y-6 text-white">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">欢迎进入管理后台</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70">查询流水</p>
              <p className="text-xs text-white/50">默认展示全部流水，可选条件筛选</p>
            </div>
            <Link
              href="/admin/transactions"
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            >
              前往查询
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70">查看收益</p>
              <p className="text-xs text-white/50">积木游戏、充值、抽奖的当月汇总</p>
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
              <p className="text-sm text-white/70">网站浏览量</p>
              <p className="text-xs text-white/50">查看公开页面/全部页面的 PV 与 UV</p>
            </div>
            <Link
              href="/admin/traffic"
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
              <p className="text-xs text-white/50">查看派单内容与陪玩抢单名单</p>
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
              <p className="text-sm text-white/70">老板专属派单区</p>
              <p className="text-xs text-white/50">绑定频道ID与老板Discord ID</p>
            </div>
            <Link
              href="/admin/order-channel-bindings"
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            >
              前往设置
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70">正在进行的订单</p>
              <p className="text-xs text-white/50">查看 RUNNING 状态订单</p>
            </div>
            <Link
              href="/admin/running-orders"
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            >
              前往查看
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70">礼物管理</p>
              <p className="text-xs text-white/50">新增礼物、分类、上下架与图片更新</p>
            </div>
            <Link
              href="/admin/gifts"
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            >
              前往管理
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70">可退回打赏</p>
              <p className="text-xs text-white/50">查看 Gift Audit 记录（已隐藏内部字段）</p>
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
              <p className="text-sm text-white/70">可撤回订单</p>
              <p className="text-xs text-white/50">查看已结单记录（仅查看，不提供网页撤回）</p>
            </div>
            <Link
              href="/admin/refundable-orders"
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
              <p className="text-xs text-white/50">插入 / 查询 / 修改 / 删除 Referral 记录</p>
            </div>
            <Link
              href="/admin/referrals"
              className="inline-flex items-center justify-center rounded-full bg-[#5c43a3] px-4 py-2 text-sm text-white hover:bg-[#4a3388]"
            >
              点击前往
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/70">账号迁移</p>
              <p className="text-xs text-white/50">将旧 Discord ID 的全部数据迁移到新 ID</p>
            </div>
            <Link
              href="/admin/migrate-discord"
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            >
              前往迁移
            </Link>
          </div>
        </div>
      </div>

      <AdminPeiwanActions />
      <DeletePeiwanCard />
      <p className="text-xs text-white/60">
        如需更多菜单，可手动访问 <code className="bg-white/10 px-1">/admin/peiwan/new</code> 或 <code className="bg-white/10 px-1">/admin/peiwan/&lt;DiscordID&gt;</code>。
      </p>

      <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold">管理陪玩名片</h3>
          <p className="text-sm text-white/70">上传或更新陪玩名片与推荐位名片，文件会直接写入 public 目录。</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div>
              <p className="text-lg font-semibold">陪玩列表名片</p>
              <p className="text-sm text-white/60">批量上传陪玩列表名片，遇到同名文件会覆盖。</p>
            </div>
            <Link
              href="/admin/cards/list"
              className="inline-flex w-full items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            >
              前往上传
            </Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div>
              <p className="text-lg font-semibold">陪玩推荐名片</p>
              <p className="text-sm text-white/60">上传前会清空推荐位文件夹，最多 8 张。</p>
            </div>
            <Link
              href="/admin/cards/recommend"
              className="inline-flex w-full items-center justify-center rounded-full bg-[#5c43a3] px-4 py-2 text-sm text-white hover:bg-[#4a3388]"
            >
              前往上传
            </Link>
          </div>
        </div>
      </div>

      <div>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-2 text-sm tracking-[0.2em] text-white hover:bg-white/10"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
