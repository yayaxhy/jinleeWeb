
import { SiteText } from "@/components/SiteCopyProvider";
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { prisma } from '@/lib/prisma';
import RechargeClient from './RechargeClient';

export default async function RechargePage() {
  const currentUser = await getCurrentDlmUser();
  if (!currentUser) {
    redirect('/accounts/login?callbackUrl=%2Frecharge');
  }

  const hasPriorRecharge = await prisma.recharge.count({
    where: { dlmId: currentUser.dlmId },
  }).then((count) => count > 0);

  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-12">
      <section className="max-w-5xl mx-auto space-y-8">
        <div className="flex  items-left gap-4 text-center">
          <Link
            href="/profile"
            className="rounded-full border border-black/10 px-5 py-2 text-xs uppercase tracking-[0.4em] hover:bg-black/5 transition"
          ><SiteText copyKey="site.app.recharge.page.867271dd72c5" /></Link>
          </div>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-wide"><SiteText copyKey="site.app.recharge.page.b7a52389ccbc" /></h1>
            <p className="text-sm text-gray-500"><SiteText copyKey="site.app.recharge.page.81d8581d636f" /></p>
          </div>
        </div>

        <Link
          href="/recharge/wechat-alipay"
          className="group block rounded-[28px] border border-[#4f8ef7]/30 bg-[linear-gradient(135deg,_#eff6ff,_#f0fdf4)] p-6 transition hover:-translate-y-0.5 hover:border-[#4f8ef7]/60 hover:shadow-[0_16px_36px_rgba(59,130,246,0.12)]"
        >
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <div>
              <p className="text-xs font-medium tracking-[0.24em] text-[#2563eb]"><SiteText copyKey="site.app.recharge.page.7fd093fba143" /></p>
              <h2 className="mt-2 text-xl font-semibold text-[#172554]"><SiteText copyKey="site.app.recharge.page.f7276d412b7d" /></h2>
              <p className="mt-2 text-sm text-[#475569]"><SiteText copyKey="site.app.recharge.page.724fcc2d141f" /></p>
            </div>
            <span className="rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white transition group-hover:bg-[#1d4ed8]"><SiteText copyKey="site.app.recharge.page.9257e8380fdb" /></span>
          </div>
        </Link>

        <RechargeClient
          hasPriorRecharge={hasPriorRecharge}
          initialChannel="stripe"
          visibleChannelIds={['stripe']}
          paymentInstructionText="使用信用卡/银行卡完成支付，无需上传凭证。"
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
