import Link from 'next/link';
import { redirect } from 'next/navigation';
import { WechatBossManager } from '@/components/admin/WechatBossManager';
import { isAdminDiscordId } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

export const metadata = { title: '微信老板充值' };

export default async function WechatBossesAdminPage() {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) redirect('/');

  const [bosses, gifts, peiwans, operations] = await Promise.all([
    prisma.manualWechatBoss.findMany({
      include: { dlmUser: { select: { totalBalance: true, recharge: true, loyaltyPoints: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.gift.findMany({
      where: { active: true, staffOnlyGift: false, price: { gt: 0 } },
      select: { GiftName: true, price: true },
      orderBy: { GiftName: 'asc' },
    }),
    prisma.pEIWAN.findMany({
      select: { PEIWANID: true, discordUserId: true, quotation_Q1: true, lolPrice: true, valPrice: true, deltaPrice: true, csgoPrice: true, narakaPrice: true, apexPrice: true, owPrice: true, tftPrice: true, steamPrice: true },
      orderBy: { PEIWANID: 'asc' },
    }),
    prisma.dlmAdminOperation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, dlmId: true, type: true, status: true, operatorDiscordId: true, details: true, createdAt: true },
    }),
  ]);

  const quotationFields = [
    ['Q1', 'quotation_Q1'], ['Q2', 'lolPrice'], ['Q3', 'valPrice'], ['Q4', 'deltaPrice'], ['Q5', 'csgoPrice'],
    ['Q6', 'narakaPrice'], ['Q7', 'apexPrice'], ['Q8', 'owPrice'], ['Q9', 'tftPrice'], ['Q10', 'steamPrice'],
  ] as const;

  return (
    <main className="min-h-screen bg-[#020204] px-5 py-10 text-white sm:px-8">
      <section className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs tracking-[0.35em] text-white/50">ADMIN</p><h1 className="mt-2 text-3xl font-semibold">微信老板充值与代操作</h1><p className="mt-2 text-sm text-white/60">为没有 Discord 的老板分配 DLM ID、人工微信入账，并执行可审计的代打赏/代点单。</p></div>
          <Link href="/admin" className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10">返回后台</Link>
        </header>
        <WechatBossManager
          bosses={bosses.map((boss) => ({ dlmId: boss.dlmId, wechatContact: boss.wechatContact, displayName: boss.displayName, totalBalance: boss.dlmUser.totalBalance.toFixed(2), recharge: boss.dlmUser.recharge.toFixed(2), loyaltyPoints: boss.dlmUser.loyaltyPoints.toFixed(2), createdAt: boss.createdAt.toISOString() }))}
          gifts={gifts.map((gift) => ({ name: gift.GiftName, price: gift.price?.toFixed(2) ?? '0.00' }))}
          peiwans={peiwans.map((peiwan) => ({ id: peiwan.PEIWANID, label: `陪玩 ${peiwan.PEIWANID} · ${peiwan.discordUserId}`, prices: Object.fromEntries(quotationFields.map(([code, field]) => [code, peiwan[field]?.toFixed(2) ?? ''])) }))}
          operations={operations.map((operation) => ({ id: operation.id, dlmId: operation.dlmId, type: operation.type, status: operation.status, operatorDiscordId: operation.operatorDiscordId, createdAt: operation.createdAt.toISOString(), details: operation.details ? JSON.stringify(operation.details) : '—' }))}
        />
      </section>
    </main>
  );
}
