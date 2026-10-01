import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { SUPPORT_DISCORD_PROFILE_URL } from '@/lib/site';

const PAYMENT_CODES = [
  {
    name: '微信收款码',
    image: '/recharge/wechat-payment-qr.png',
    width: 828,
    height: 1124,
  },
  {
    name: '支付宝收款码',
    image: '/recharge/alipay-payment-qr.png',
    width: 1280,
    height: 1919,
  },
] as const;

export default async function WechatAlipayRechargePage() {
  const currentUser = await getCurrentDlmUser();
  if (!currentUser) {
    redirect('/accounts/discord/login?callbackUrl=%2Frecharge%2Fwechat-alipay');
  }

  return (
    <main className="min-h-screen bg-[#f7f3ef] px-6 py-12 text-[#171717]">
      <section className="mx-auto max-w-5xl space-y-8">
        <Link
          href="/recharge"
          className="inline-flex rounded-full border border-black/10 px-5 py-2 text-xs uppercase tracking-[0.32em] transition hover:bg-black/5"
        >
          返回充值中心
        </Link>

        <header className="mx-auto max-w-3xl space-y-3 text-center">
          <p className="text-xs font-medium tracking-[0.32em] text-[#2563eb]">手动扫码充值</p>
          <h1 className="text-3xl font-semibold tracking-wide">微信/支付宝充值</h1>
          <p className="text-sm leading-7 text-gray-600">
            微信/支付宝的自动充值还在完善中。如需微信/支付宝充值，可以扫描下方两个二维码；转账成功后，请将转账成功的截图在 DC 私信发送给客服即可，
            <a
              href={SUPPORT_DISCORD_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#2563eb] underline decoration-[#2563eb]/40 underline-offset-4 transition hover:text-[#1d4ed8]"
            >
              点击这里联系客服
            </a>
            。
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {PAYMENT_CODES.map((code) => (
            <article key={code.name} className="overflow-hidden rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-center text-lg font-semibold">{code.name}</h2>
              <div className="rounded-[20px] bg-[#f8fafc] p-3">
                <Image
                  src={code.image}
                  alt={code.name}
                  width={code.width}
                  height={code.height}
                  sizes="(min-width: 768px) 440px, 100vw"
                  className="h-auto w-full rounded-[14px]"
                  priority
                />
              </div>
            </article>
          ))}
        </div>

        <p className="text-center text-sm text-gray-500">
          请选择与付款方式对应的收款码。客服确认截图后会协助为你的账户处理充值。
        </p>
      </section>
    </main>
  );
}
