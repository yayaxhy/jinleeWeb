import type { ReactNode } from 'react';
import '../admin/admin.css';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { isKefuDiscordId } from '@/lib/admin';

export const metadata = {
  title: '客服后台',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function KefuLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  if (!session?.discordId || !isKefuDiscordId(session.discordId)) {
    redirect('/');
  }

  return (
    <section className="min-h-screen bg-[#020204] text-white">
      <div className="admin-shell mx-auto flex max-w-[1400px] flex-col gap-10 px-6 py-12">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.6em] text-white/60">SUPPORT</p>
          <h1 className="text-3xl font-semibold">客服工作台</h1>
          <p className="text-sm text-white/60">仅允许授权 Discord ID 登录</p>
        </header>
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
          {children}
        </div>
      </div>
    </section>
  );
}
