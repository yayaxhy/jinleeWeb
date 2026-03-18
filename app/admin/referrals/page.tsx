import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ReferralManager } from '@/components/admin/ReferralManager';
import { ReferralPolicyManager } from '@/components/admin/ReferralPolicyManager';
import { getServerSession } from '@/lib/session';
import { canViewReferrals, isHowardReadOnlyDiscordId } from '@/lib/admin';

export const metadata = {
  title: '邀请人管理 - 锦鲤管理后台',
};

export default async function AdminReferralsPage() {
  const session = await getServerSession();
  if (!session?.discordId || !canViewReferrals(session.discordId)) {
    redirect('/');
  }
  const readOnly = isHowardReadOnlyDiscordId(session.discordId);

  return (
    <section className="min-h-screen bg-[#020204] text-white px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.6em] text-white/60">ADMIN</p>
            <h1 className="text-3xl font-semibold">邀请人管理</h1>
            <p className="text-sm text-white/60">插入 / 查询 / 修改 / 删除 邀请 记录。</p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm tracking-[0.2em] text-white hover:bg-white/10"
          >
            返回管理首页
          </Link>
        </div>

        <ReferralManager readOnly={readOnly} />
        <ReferralPolicyManager readOnly={readOnly} />
      </div>
    </section>
  );
}
