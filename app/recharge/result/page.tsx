import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';

type RechargeResultProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function RechargeResult(_: RechargeResultProps = {}) {
  const session = await getServerSession();
  if (!session?.discordId) {
    redirect('/');
  }

  return (
    <main className="min-h-screen bg-[#f7f3ef] px-6 py-12">
      <section className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.6em] text-gray-500">Recharge Result</p>
          <h1 className="text-3xl font-semibold tracking-wide">充值成功！</h1>
          <p className="text-xs text-gray-500">若没有到账请联系客服进行解决</p>
        </div>

        <div className="rounded-[32px] border border-black/5 bg-white p-8 space-y-6 text-center text-sm text-gray-500">
          <p>若没有到账请联系客服进行解决</p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/recharge"
              className="flex-1 rounded-full border border-black/10 px-5 py-2 text-xs uppercase tracking-[0.4em] text-center hover:bg-black/5 transition"
            >
              返回充值
            </Link>
            <Link
              href="/profile"
              className="flex-1 rounded-full bg-black px-5 py-2 text-xs uppercase tracking-[0.4em] text-white text-center hover:bg-black/80 transition"
            >
              查看余额
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
