
import { SiteText } from "@/components/SiteCopyProvider";
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import WechatNativePayClient from './WechatNativePayClient';

export default async function WechatPayPage() {
  const currentUser = await getCurrentDlmUser();
  if (!currentUser) {
    redirect('/accounts/login?callbackUrl=%2Fwechat%2Fpay');
  }

  const username =
    currentUser.dlmUser.discordDisplayName ??
    currentUser.dlmUser.member?.serverDisplayName ??
    currentUser.dlmUser.wechatDisplayName ??
    '微信用户';

  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-12">
      <section className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-left gap-4 text-center">
          <Link
            href="/recharge"
            className="rounded-full border border-black/10 px-5 py-2 text-xs uppercase tracking-[0.4em] transition hover:bg-black/5"
          ><SiteText copyKey="site.app.wechat.pay.page.badee45311aa" /></Link>
          <Link
            href="/profile"
            className="rounded-full border border-black/10 px-5 py-2 text-xs uppercase tracking-[0.4em] transition hover:bg-black/5"
          ><SiteText copyKey="site.app.wechat.pay.page.867271dd72c5" /></Link>
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-wide"><SiteText copyKey="site.app.wechat.pay.page.64aeba8fbc56" /></h1>
            <p className="text-sm text-gray-500"><SiteText copyKey="site.app.wechat.pay.page.e311b2bd2fe7" /></p>
          </div>
        </div>

        <WechatNativePayClient username={username} />
      </section>
    </main>
  );
}
