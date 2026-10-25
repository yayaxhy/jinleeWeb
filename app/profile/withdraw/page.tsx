
import { SiteText } from "@/components/SiteCopyProvider";
import Link from 'next/link';
import { redirect } from 'next/navigation';
import WithdrawForm from '@/components/profile/WithdrawForm';
import { WithdrawAccountsManager } from '@/components/profile/WithdrawAccountsManager';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { formatAmountDown2 } from '@/lib/numberFormat';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const formatNumber = (value: unknown) => {
  return formatAmountDown2(value);
};

export default async function WithdrawPage() {
  const currentUser = await getCurrentDlmUser();
  if (!currentUser) {
    redirect('/');
  }

  const totalBalance = currentUser.dlmUser.member?.totalBalance ?? currentUser.dlmUser.totalBalance;
  const income = currentUser.dlmUser.member?.income ?? currentUser.dlmUser.income;

  const withdrawCooldownMs = 3 * 24 * 60 * 60 * 1000;
  const lastWithdraw = await prisma.withdraw.findFirst({
    where: { dlmId: currentUser.dlmId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const lastWithdrawAt = lastWithdraw?.createdAt ?? null;
  const nextAvailableAt =
    lastWithdrawAt !== null ? new Date(lastWithdrawAt.getTime() + withdrawCooldownMs) : null;

  const lastWithdrawAtIso = lastWithdrawAt?.toISOString() ?? null;
  const nextAvailableAtIso = nextAvailableAt?.toISOString() ?? null;
  const legacyAccounts =
    currentUser.discordUserId &&
    !currentUser.dlmUser.withdrawAccount1 &&
    !currentUser.dlmUser.withdrawAccount2 &&
    !currentUser.dlmUser.withdrawAccount3
      ? await prisma.withdrawalAccount.findUnique({
          where: { discordUserId: currentUser.discordUserId },
          select: { account1: true, account2: true, account3: true },
        })
      : null;
  const savedAccounts = {
    account1: currentUser.dlmUser.withdrawAccount1 ?? legacyAccounts?.account1 ?? null,
    account2: currentUser.dlmUser.withdrawAccount2 ?? legacyAccounts?.account2 ?? null,
    account3: currentUser.dlmUser.withdrawAccount3 ?? legacyAccounts?.account3 ?? null,
  };

  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-16">
      <section className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500"><SiteText copyKey="site.app.profile.withdraw.page.47e564194604" /></p>
            <h1 className="text-3xl font-semibold tracking-wide"><SiteText copyKey="site.app.profile.withdraw.page.a471daf080b6" /></h1>
          </div>
          <Link
            href="/profile"
            className="text-xs uppercase tracking-[0.4em] text-gray-500 hover:text-black transition"
          ><SiteText copyKey="site.app.profile.withdraw.page.425652af65a9" /></Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-black/5 bg-white p-6 space-y-2">
            <p className="text-xs tracking-[0.4em] text-gray-500"><SiteText copyKey="site.app.profile.withdraw.page.870c0ab88bd9" /></p>
            <p className="text-3xl font-mono">{formatNumber(totalBalance)}</p>
          </div>
          <div className="rounded-3xl border border-black/5 bg-white p-6 space-y-2">
            <p className="text-xs tracking-[0.4em] text-gray-500"><SiteText copyKey="site.app.profile.withdraw.page.c098616830c3" /></p>
            <p className="text-3xl font-mono">{formatNumber(income)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-8 space-y-4 shadow-sm">
          <h2 className="text-xl font-semibold tracking-wide text-[#5c43a3]"><SiteText copyKey="site.app.profile.withdraw.page.39aa2acc468b" /></h2>
          
          <WithdrawForm
            maxAmount={String(income ?? '0')}
            lastWithdrawAt={lastWithdrawAtIso}
            nextAvailableAt={nextAvailableAtIso}
            savedAccounts={savedAccounts ?? undefined}
          />
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-8 space-y-6 shadow-sm">
          <WithdrawAccountsManager initialAccounts={savedAccounts ?? {}} />
        </div>
      </section>
    </main>
  );
}
