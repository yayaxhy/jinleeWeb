import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { canManageOrderChannelBindings } from '@/lib/admin';
import { OrderChannelBindingManager } from '@/components/admin/OrderChannelBindingManager';

export default async function OrderChannelBindingsPage() {
  const session = await getServerSession();
  if (!session?.discordId || !canManageOrderChannelBindings(session.discordId)) {
    redirect('/');
  }

  return (
    <div className="space-y-6 text-white">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.6em] text-white/60">ADMIN</p>
          <h1 className="text-3xl font-semibold">老板专属派单区设置</h1>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm text-white hover:bg-white/10"
        >
          返回管理首页
        </Link>
      </div>

      <OrderChannelBindingManager />
    </div>
  );
}
