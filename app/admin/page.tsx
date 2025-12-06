import Link from 'next/link';
import { AdminPeiwanActions } from '@/components/admin/AdminPeiwanActions';

export default function AdminHomePage() {
  return (
    <div className="space-y-6 text-white">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">欢迎进入管理后台</h2>
        <p className="text-sm text-white/70">
          请选择操作：可直接新增陪玩，或输入 Discord ID 修改对应信息。
        </p>
      </div>
      <AdminPeiwanActions />
      <p className="text-xs text-white/60">
        如需更多菜单，可手动访问 <code className="bg-white/10 px-1">/admin/peiwan/new</code> 或 <code className="bg-white/10 px-1">/admin/peiwan/&lt;DiscordID&gt;</code>。
      </p>

      <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold">管理陪玩名片</h3>
          <p className="text-sm text-white/70">上传或更新陪玩名片与推荐位名片，文件会直接写入 public 目录。</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
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

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div>
              <p className="text-lg font-semibold">查询流水</p>
              <p className="text-sm text-white/60">输入 Discord ID，查看该用户的全部 individual transactions。</p>
            </div>
            <Link
              href="/admin/transactions"
              className="inline-flex w-full items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
            >
              前往查询
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
