import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminDiscordId } from '@/lib/admin';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import RechargeClient from '../RechargeClient';

export default async function StripeRechargePage() {
  const currentUser = await getCurrentJinleeUser();
  if (!currentUser) {
    redirect('/accounts/discord/login?callbackUrl=%2Frecharge%2Fstripe');
  }
  if (!isAdminDiscordId(currentUser.discordUserId)) {
    redirect('/recharge');
  }

  const username =
    currentUser.jinleeUser.discordDisplayName ??
    currentUser.jinleeUser.member?.serverDisplayName ??
    currentUser.jinleeUser.wechatDisplayName ??
    '微信用户';

  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-12">
      <section className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-left gap-4 text-center">
          <Link
            href="/recharge"
            className="rounded-full border border-black/10 px-5 py-2 text-xs uppercase tracking-[0.4em] hover:bg-black/5 transition"
          >
            返回普通充值
          </Link>
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-wide">Stripe 测试充值</h1>
            <p className="text-sm text-gray-500">
              当前页面仅用于测试信用卡/银行卡支付与自动到账流程
            </p>
          </div>
        </div>

        <RechargeClient
          username={username}
          hasPriorRecharge
          initialChannel="stripe"
          visibleChannelIds={['stripe']}
          stripeAmountOptions={[1]}
          stripeNotice="当前测试页仅开放 ¥1 充值。付款成功后，系统会自动加到余额。"
          paymentInstructionText="使用信用卡/银行卡完成支付，无需上传凭证。"
        />
      </section>
    </main>
  );
}
