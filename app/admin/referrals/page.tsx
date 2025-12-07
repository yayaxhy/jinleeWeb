import { ReferralManager } from '@/components/admin/ReferralManager';

export const metadata = {
  title: '邀请人管理 - 锦鲤管理后台',
};

export default function AdminReferralsPage() {
  return (
    <section className="min-h-screen bg-[#020204] text-white px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.6em] text-white/60">ADMIN</p>
          <h1 className="text-3xl font-semibold">邀请人管理</h1>
          <p className="text-sm text-white/60">插入 / 查询 / 修改 / 删除 邀请 记录。</p>
        </div>

        <ReferralManager />
      </div>
    </section>
  );
}
