import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PointShopAdminManager } from '@/components/admin/PointShopAdminManager';
import { canManagePointShop } from '@/lib/admin';
import { getServerSession } from '@/lib/session';

export const metadata = { title: '积分商城管理' };
export const dynamic = 'force-dynamic';

export default async function PointShopAdminPage() {
  const session = await getServerSession();
  if (!canManagePointShop(session?.discordId)) redirect('/');
  return <div className="space-y-6 text-white">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold">积分商城管理</h1>
      <Link href="/admin" className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10">返回后台</Link>
    </div>
    <PointShopAdminManager />
  </div>;
}
