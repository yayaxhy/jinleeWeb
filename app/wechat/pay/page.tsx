import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import WechatNativePayClient from './WechatNativePayClient';

export default async function WechatPayPage() {
  const currentUser = await getCurrentJinleeUser();
  if (!currentUser) {
    redirect('/accounts/discord/login?callbackUrl=%2Fwechat%2Fpay');
  }

  const username =
    currentUser.jinleeUser.discordDisplayName ??
    currentUser.jinleeUser.member?.serverDisplayName ??
    currentUser.jinleeUser.wechatDisplayName ??
    '微信用户';

  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-12">
      <section className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-left gap-4 text-center">
          <Link
            href="/recharge"
            className="rounded-full border border-black/10 px-5 py-2 text-xs uppercase tracking-[0.4em] transition hover:bg-black/5"
          >
            返回充值中心
          </Link>
          <Link
            href="/profile"
            className="rounded-full border border-black/10 px-5 py-2 text-xs uppercase tracking-[0.4em] transition hover:bg-black/5"
          >
            返回个人中心
          </Link>
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-wide">微信支付</h1>
            <p className="text-sm text-gray-500">
              使用微信官方扫码支付，创建订单后请直接使用微信扫一扫。
            </p>
          </div>
        </div>

        <WechatNativePayClient username={username} />
      </section>
    </main>
  );
}
