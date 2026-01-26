import Link from 'next/link';
import { redirect } from 'next/navigation';
import WithdrawForm from '@/components/profile/WithdrawForm';
import { WithdrawAccountsManager } from '@/components/profile/WithdrawAccountsManager';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const formatNumber = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export default async function WithdrawPage() {
  const session = await getServerSession();
  const discordId = session?.discordId;
  if (!discordId) {
    redirect('/');
  }

  const member = await prisma.member.findUnique({
    where: { discordUserId: discordId },
    select: { totalBalance: true, income: true },
  });
  if (!member) {
    redirect('/');
  }

  const withdrawCooldownMs = 3 * 24 * 60 * 60 * 1000;
  const lastWithdraw = await prisma.withdraw.findFirst({
    where: { discordId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const lastWithdrawAt = lastWithdraw?.createdAt ?? null;
  const nextAvailableAt =
    lastWithdrawAt !== null ? new Date(lastWithdrawAt.getTime() + withdrawCooldownMs) : null;

  const lastWithdrawAtIso = lastWithdrawAt?.toISOString() ?? null;
  const nextAvailableAtIso = nextAvailableAt?.toISOString() ?? null;
  const savedAccounts = await prisma.withdrawalAccount.findUnique({
    where: { discordUserId },
    select: { account1: true, account2: true, account3: true },
  });

  return (
    <main className="min-h-screen bg-[#f7f3ef] text-[#171717] px-6 py-16">
      <section className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Withdraw</p>
            <h1 className="text-3xl font-semibold tracking-wide">提现</h1>
          </div>
          <Link
            href="/profile"
            className="text-xs uppercase tracking-[0.4em] text-gray-500 hover:text-black transition"
          >
            返回个人主页
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-black/5 bg-white p-6 space-y-2">
            <p className="text-xs tracking-[0.4em] text-gray-500">账户余额</p>
            <p className="text-3xl font-mono">{formatNumber(member.totalBalance)}</p>
          </div>
          <div className="rounded-3xl border border-black/5 bg-white p-6 space-y-2">
            <p className="text-xs tracking-[0.4em] text-gray-500">可提现余额</p>
            <p className="text-3xl font-mono">{formatNumber(member.income)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-8 space-y-4 shadow-sm">
          <h2 className="text-xl font-semibold tracking-wide text-[#5c43a3]">提交提现</h2>
          
          <WithdrawForm
            maxAmount={String(member.income ?? '0')}
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
