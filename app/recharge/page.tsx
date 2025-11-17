import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import RechargeClient from './RechargeClient';

export default async function RechargePage() {
  const session = await getServerSession();
  if (!session?.discordId) {
    redirect('/');
  }

  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-12">
      <section className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Recharge</p>
            <h1 className="text-3xl font-semibold tracking-wide">余额充值</h1>
            <p className="text-sm text-gray-500">
              选择微信或支付宝二维码完成转账，支付完成后 Z-Pay 网关会自动回调并为你加款。
            </p>
          </div>
          <Link
            href="/profile"
            className="self-start rounded-full border border-black/10 px-5 py-2 text-xs uppercase tracking-[0.4em] hover:bg-black/5 transition"
          >
            返回个人中心
          </Link>
        </div>

        <RechargeClient username={session.username ?? session.discordId} />
      </section>
    </main>
  );
}
