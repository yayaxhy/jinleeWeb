import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { isAdminDiscordId } from '@/lib/admin';
import { getServerSession } from '@/lib/session';

export const metadata = {
  title: '锦鲤管理后台',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    redirect('/');
  }

  return (
    <section className="min-h-screen bg-[#020204] text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.6em] text-white/60">ADMIN</p>
          <h1 className="text-3xl font-semibold">锦鲤公会管理后台</h1>
          <p className="text-sm text-white/60">仅允许预设 Discord ID 登录</p>
        </header>
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
          {children}
        </div>
      </div>
    </section>
  );
}
