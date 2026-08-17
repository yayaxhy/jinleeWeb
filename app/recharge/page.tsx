import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { prisma } from '@/lib/prisma';
import RechargeClient from './RechargeClient';

export default async function RechargePage() {
  const currentUser = await getCurrentJinleeUser();
  if (!currentUser) {
    redirect('/accounts/discord/login?callbackUrl=%2Frecharge');
  }

  const username =
    currentUser.jinleeUser.discordDisplayName ??
    currentUser.jinleeUser.member?.serverDisplayName ??
    currentUser.jinleeUser.wechatDisplayName ??
    '微信用户';
  const hasPriorRecharge = await prisma.recharge.count({
    where: { jinleeId: currentUser.jinleeId },
  }).then((count) => count > 0);

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
              网页支持支付宝、微信与信用卡/银行卡自动充值，如需其他方式请联系客服
            </p>
          </div>
        </div>

        <RechargeClient
          username={username}
          hasPriorRecharge={hasPriorRecharge}
          visibleChannelIds={['wechat_native', 'alipay', 'stripe']}
          stripeCurrenciesByAmount={{
            500: ['gbp', 'eur', 'usd', 'cad'],
            1000: ['gbp', 'eur', 'usd', 'cad'],
            2000: ['gbp', 'eur', 'usd', 'cad'],
            5000: ['gbp', 'eur', 'usd', 'cad'],
          }}
        />
      </section>
    </main>
  );
}
