import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

const QUOTATION_FIELDS = [
  'quotation_Q1',
  'quotation_Q2',
  'quotation_Q3',
  'quotation_Q4',
  'quotation_Q5',
  'quotation_Q6',
  'quotation_Q7',
] as const;

const GAME_TAG_FIELDS = [
  'LOL',
  'CSGO',
  'Valorant',
  'Naraka',
  'OW2',
  'APEX',
  'deltaForce',
  'marvel',
  'singer',
  'PUBG',
  'TFT',
  'R6',
  'tarkov',
  'chat',
  'steam',
  'DOTA',
  'COD',
] as const;

export default async function Profile() {
  const session = await getServerSession(authOptions);
  const discordId = (session?.user as any)?.id as string | undefined;

  if (!discordId) {
    redirect('/');
  }

  const member = await prisma.member.findUnique({
    where: { discordUserId: discordId },
    include: {
      peiwan: true,
    },
  });

  if (!member) {
    return (
      <main className="min-h-screen bg-black text-white px-6 py-16 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-white/70">未找到该成员。</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-2 text-sm uppercase tracking-[0.2em] hover:bg-white/10"
          >
            返回主页
          </Link>
        </div>
      </main>
    );
  }

  const peiwan = member.peiwan;
  const isPeiwanMember = member.status === 'PEIWAN';
  const memberStatusLabel = member.status.toLowerCase();

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <section className="max-w-4xl mx-auto space-y-10">
        <header className="space-y-4">
          <h1 className="text-4xl font-bold tracking-wide text-[#2800ff]">My Profile</h1>
          <p className="text-white/70 leading-relaxed">
            展示当前账户在 Member 与 PEIWAN 表中的所有信息，方便快速查看资产、等级、报价以及陪玩标签。
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-2 text-sm uppercase tracking-[0.2em] hover:bg-white/10"
          >
            返回主页
          </Link>
        </header>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-4">
            <h2 className="text-2xl font-semibold text-[#a88bff]">Member</h2>
            <dl className="space-y-3 text-sm text-white/80">
              <div>
                <dt className="text-white/50">Discord ID</dt>
                <dd className="text-lg font-semibold">{member.discordUserId}</dd>
              </div>
              <div>
                <dt className="text-white/50">Status</dt>
                <dd className="text-lg font-semibold">{memberStatusLabel}</dd>
              </div>
              <div>
                <dt className="text-white/50">Total Balance</dt>
                <dd className="text-lg font-semibold">¥ {member.totalBalance.toString()}</dd>
              </div>
              <div>
                <dt className="text-white/50">Income</dt>
                <dd className="text-lg font-semibold">¥ {member.income.toString()}</dd>
              </div>
              <div>
                <dt className="text-white/50">Recharge</dt>
                <dd className="text-lg font-semibold">¥ {member.recharge.toString()}</dd>
              </div>
              <div>
                <dt className="text-white/50">Total Spent</dt>
                <dd className="text-lg font-semibold">¥ {member.totalSpent.toString()}</dd>
              </div>
              <div>
                <dt className="text-white/50">Commission Rate</dt>
                <dd className="text-lg font-semibold">{member.commissionRate.toString()}</dd>
              </div>
              <div>
                <dt className="text-white/50">VIP Role Opt-out</dt>
                <dd className="text-lg font-semibold">{member.VIPRoleOptOut ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </div>

          {isPeiwanMember && (
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-4">
              <h2 className="text-2xl font-semibold text-[#a88bff]">PEIWAN</h2>
              {peiwan ? (
                <dl className="space-y-3 text-sm text-white/80">
                  <div>
                    <dt className="text-white/50">PEIWAN ID</dt>
                    <dd className="text-lg font-semibold">{peiwan.PEIWANID}</dd>
                  </div>
                  <div>
                    <dt className="text-white/50">Default Quotation Code</dt>
                    <dd className="text-lg font-semibold">{peiwan.defaultQuotationCode}</dd>
                  </div>
                  {QUOTATION_FIELDS.map((field, index) => (
                    <div key={field}>
                      <dt className="text-white/50">{`Quotation Q${index + 1}`}</dt>
                      <dd className="text-lg font-semibold">
                        {(peiwan[field] as any)?.toString?.() ?? '—'}
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt className="text-white/50">Commission Rate</dt>
                    <dd className="text-lg font-semibold">{peiwan.commissionRate.toString()}</dd>
                  </div>
                  <div>
                    <dt className="text-white/50">Total Earn</dt>
                    <dd className="text-lg font-semibold">¥ {peiwan.totalEarn.toString()}</dd>
                  </div>
                  <div>
                    <dt className="text-white/50">Balance</dt>
                    <dd className="text-lg font-semibold">¥ {peiwan.balance.toString()}</dd>
                  </div>
                  <div>
                    <dt className="text-white/50">MP URL</dt>
                    <dd className="text-lg font-semibold break-all">{peiwan.MP_url ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-white/50">Status</dt>
                    <dd className="text-lg font-semibold">{peiwan.status}</dd>
                  </div>
                  <div>
                    <dt className="text-white/50">Tech Tag</dt>
                    <dd className="text-lg font-semibold">{peiwan.techTag ? 'Yes' : 'No'}</dd>
                  </div>
                  <div>
                    <dt className="text-white/50">Type</dt>
                    <dd className="text-lg font-semibold">{peiwan.type}</dd>
                  </div>
                  <div>
                    <dt className="text-white/50">Level</dt>
                    <dd className="text-lg font-semibold">{peiwan.level}</dd>
                  </div>
                  <div>
                    <dt className="text-white/50">Exclusive</dt>
                    <dd className="text-lg font-semibold">{peiwan.exclusive ? 'Yes' : 'No'}</dd>
                  </div>
                  <div className="space-y-2">
                    <dt className="text-white/50">Game Tags</dt>
                    <dd className="text-lg font-semibold flex flex-wrap gap-2">
                      {GAME_TAG_FIELDS.map((tag) => (
                        <span
                          key={tag}
                          className={`px-3 py-1 rounded-full text-sm border ${
                            (peiwan[tag] as boolean) ? 'border-[#fcba03]/100' : 'border-white/10 text-white/10'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-white/60">未找到该陪玩的信息。</p>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
