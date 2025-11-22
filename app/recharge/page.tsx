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
        <div className="flex  items-left gap-4 text-center">
          <Link
            href="/profile"
            className="rounded-full border border-black/10 px-5 py-2 text-xs uppercase tracking-[0.4em] hover:bg-black/5 transition"
          >
            返回个人中心
          </Link>
          </div>
        <div className="flex flex-col items-center gap-4 text-center">
          
          <div className="space-y-2">
            
            <h1 className="text-3xl font-semibold tracking-wide">余额充值</h1>
            <p className="text-sm text-gray-500">
              网页支持支付宝与微信自动充值，如需外币或其他方式请联系客服
            </p>
          </div>
        </div>

        <RechargeClient username={session.username ?? session.discordId} />
      </section>
    </main>
  );
}
