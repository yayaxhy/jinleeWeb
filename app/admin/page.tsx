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
