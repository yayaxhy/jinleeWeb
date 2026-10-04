import Link from 'next/link';
import { Prisma, SettlementPayoutStatus, SettlementReconciliationStatus, SettlementTransferStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import { getAdminDiscordIds, isAdminDiscordId } from '@/lib/admin';
import { formatAmountDown2 } from '@/lib/numberFormat';
import { newEntityOnlyTime } from '@/lib/operating-entity-cutover';
import { prisma } from '@/lib/prisma';
import {
  isReconciliationCounted,
  isRmbCurrency,
  resolveWithdrawalSettlementOwner,
} from '@/lib/settlement-reconciliation';
import { getServerSession } from '@/lib/session';

export const metadata = { title: '人工充值对账' };
export const dynamic = 'force-dynamic';

const ROME_TIMEZONE = 'Europe/Rome';
const ACTION_URL = '/api/admin/cash-reconciliation';
const MANUAL_RECHARGE_OPERATOR_IDS = getAdminDiscordIds();

const formatDate = (value?: Date | null) =>
  value
    ? value.toLocaleString('zh-CN', { timeZone: ROME_TIMEZONE })
    : '—';

const formatMoney = (value: Prisma.Decimal | number | string | null | undefined) =>
  `¥${formatAmountDown2(value ?? 0)}`;

const statusLabel: Record<SettlementReconciliationStatus, string> = {
  PENDING_FINANCE: '待财务处理',
  FINANCE_CONFIRMED: '待负责人确认',
  OWNER_CONFIRMED: '负责人已确认',
  OWNER_DISPUTED: '负责人提出异常',
  INVALIDATED: '财务确认无效',
};

const statusClass: Record<SettlementReconciliationStatus, string> = {
  PENDING_FINANCE: 'border-white/20 bg-white/10 text-white/75',
  FINANCE_CONFIRMED: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  OWNER_CONFIRMED: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100',
  OWNER_DISPUTED: 'border-rose-300/30 bg-rose-300/10 text-rose-100',
  INVALIDATED: 'border-white/15 bg-white/5 text-white/55',
};

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function CashReconciliationPage(props: PageProps) {
  const session = await getServerSession();
  if (!session?.discordId) redirect('/');
  const isFinance = isAdminDiscordId(session.discordId);
  const searchParams = (await props.searchParams) ?? {};
  const notice = typeof searchParams.notice === 'string' ? searchParams.notice : '';
  const error = typeof searchParams.error === 'string' ? searchParams.error : '';
  const redirectTo = '/admin/cash-reconciliation';

  const [accounts, rawRecharges, transfers, recoveries, payouts, withdrawals] = await Promise.all([
    prisma.settlementAccount.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
    prisma.recharge.findMany({
      where: {
        amount: { gt: 0 },
        fromWhom: { in: [...MANUAL_RECHARGE_OPERATOR_IDS] },
        createdAt: newEntityOnlyTime(),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        settlementReconciliation: {
          include: { account: true, evidence: { orderBy: { createdAt: 'desc' } } },
        },
      },
    }),
    prisma.settlementAccountTransfer.findMany({
      orderBy: { createdAt: 'desc' },
      include: { fromAccount: true, toAccount: true },
    }),
    prisma.settlementForexRecovery.findMany({
      orderBy: { recoveredAt: 'desc' },
      include: { fromAccount: true, toAccount: true },
    }),
    prisma.settlementWithdrawalPayout.findMany({ orderBy: { paidAt: 'desc' } }),
    prisma.withdraw.findMany({
      where: { createdAt: newEntityOnlyTime() },
      orderBy: { createdAt: 'desc' },
      include: { settlementPayout: true },
    }),
  ]);

  const ownedAccounts = accounts.filter((account) => account.ownerDiscordId === session.discordId);
  if (!isFinance && !ownedAccounts.length) redirect('/');

  const ownerIds = Array.from(new Set(accounts.map((account) => account.ownerDiscordId)));
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const rechargesWithRows = rawRecharges.map((recharge) => ({ recharge, row: recharge.settlementReconciliation }));
  const unassignedTotal = rechargesWithRows
    .filter(({ row }) => !row)
    .reduce((total, { recharge }) => total.add(recharge.amount), new Prisma.Decimal(0));

  const perAccount = new Map(
    accounts.map((account) => [account.id, {
      receivedRmb: new Prisma.Decimal(0),
      receivedOriginal: new Prisma.Decimal(0),
      pendingOwner: 0,
      disputed: 0,
      confirmed: 0,
    }]),
  );
  const ownerTotals = new Map(ownerIds.map((ownerId) => [ownerId, {
    incoming: new Prisma.Decimal(0),
    transferIn: new Prisma.Decimal(0),
    transferOut: new Prisma.Decimal(0),
    forexOut: new Prisma.Decimal(0),
    forexIn: new Prisma.Decimal(0),
    payouts: new Prisma.Decimal(0),
    foreignExpected: new Prisma.Decimal(0),
    foreignReturned: new Prisma.Decimal(0),
  }]));
  const getOwnerTotal = (ownerId: string) => {
    const current = ownerTotals.get(ownerId);
    if (current) return current;
    const created = {
      incoming: new Prisma.Decimal(0), transferIn: new Prisma.Decimal(0), transferOut: new Prisma.Decimal(0),
      forexOut: new Prisma.Decimal(0), forexIn: new Prisma.Decimal(0), payouts: new Prisma.Decimal(0),
      foreignExpected: new Prisma.Decimal(0), foreignReturned: new Prisma.Decimal(0),
    };
    ownerTotals.set(ownerId, created);
    return created;
  };

  for (const { row } of rechargesWithRows) {
    if (!row || !row.accountId || !row.ownerDiscordId || !row.rmbAmount || !isReconciliationCounted(row.status)) continue;
    const accountSummary = perAccount.get(row.accountId);
    if (accountSummary) {
      accountSummary.receivedRmb = accountSummary.receivedRmb.add(row.rmbAmount);
      accountSummary.receivedOriginal = accountSummary.receivedOriginal.add(row.originalReceivedAmount ?? row.rmbAmount);
      if (row.status === SettlementReconciliationStatus.FINANCE_CONFIRMED) accountSummary.pendingOwner += 1;
      if (row.status === SettlementReconciliationStatus.OWNER_DISPUTED) accountSummary.disputed += 1;
      if (row.status === SettlementReconciliationStatus.OWNER_CONFIRMED) accountSummary.confirmed += 1;
    }
    const ownerSummary = getOwnerTotal(row.ownerDiscordId);
    ownerSummary.incoming = ownerSummary.incoming.add(row.rmbAmount);
    const account = accountById.get(row.accountId);
    if (account && !isRmbCurrency(account.currency)) ownerSummary.foreignExpected = ownerSummary.foreignExpected.add(row.rmbAmount);
  }

  for (const transfer of transfers) {
    if (transfer.status !== SettlementTransferStatus.RECEIVER_CONFIRMED) continue;
    getOwnerTotal(transfer.fromAccount.ownerDiscordId).transferOut = getOwnerTotal(transfer.fromAccount.ownerDiscordId).transferOut.add(transfer.amount);
    getOwnerTotal(transfer.toAccount.ownerDiscordId).transferIn = getOwnerTotal(transfer.toAccount.ownerDiscordId).transferIn.add(transfer.amount);
  }
  for (const recovery of recoveries) {
    getOwnerTotal(recovery.fromAccount.ownerDiscordId).forexOut = getOwnerTotal(recovery.fromAccount.ownerDiscordId).forexOut.add(recovery.rmbAmount);
    getOwnerTotal(recovery.toAccount.ownerDiscordId).forexIn = getOwnerTotal(recovery.toAccount.ownerDiscordId).forexIn.add(recovery.rmbAmount);
    getOwnerTotal(recovery.fromAccount.ownerDiscordId).foreignReturned = getOwnerTotal(recovery.fromAccount.ownerDiscordId).foreignReturned.add(recovery.rmbAmount);
  }
  for (const payout of payouts) {
    if (payout.status === SettlementPayoutStatus.PAID) {
      getOwnerTotal(payout.ownerDiscordId).payouts = getOwnerTotal(payout.ownerDiscordId).payouts.add(payout.amount);
    }
  }

  const ownerSummaryEntries = [...ownerTotals.entries()].map(([ownerId, totals]) => ({
    ownerId,
    ...totals,
    expectedTotal: totals.incoming
      .add(totals.transferIn)
      .sub(totals.transferOut)
      .sub(totals.forexOut)
      .add(totals.forexIn)
      .sub(totals.payouts),
    foreignDue: totals.foreignExpected.sub(totals.foreignReturned),
  }));
  const visibleOwners = isFinance ? ownerSummaryEntries : ownerSummaryEntries.filter((row) => row.ownerId === session.discordId);
  const visibleAccounts = isFinance ? accounts : ownedAccounts;
  const ownerConfirmations = rechargesWithRows.filter(({ row }) =>
    row?.ownerDiscordId === session.discordId && row.status === SettlementReconciliationStatus.FINANCE_CONFIRMED,
  );
  const ownerTransferInbox = transfers.filter((transfer) =>
    transfer.toAccount.ownerDiscordId === session.discordId && transfer.status === SettlementTransferStatus.PENDING_RECEIVER_CONFIRMATION,
  );
  const pendingPayouts = withdrawals
    .map((withdrawal) => ({ withdrawal, ownerId: resolveWithdrawalSettlementOwner(withdrawal.method) }))
    .filter(({ withdrawal, ownerId }) => ownerId === session.discordId && !withdrawal.settlementPayout);

  return (
    <section className="min-h-screen bg-[#020204] px-6 py-12 text-white">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.45em] text-white/50">SETTLEMENT</p>
            <h1 className="mt-2 text-3xl font-semibold">人工充值与收款账户对账</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60">此页面只维护现实收款、外汇归还、内部转账和提现发放；不会修改老板的平台余额。</p>
          </div>
          <Link href="/admin" className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10">返回后台</Link>
        </header>

        {notice ? <p className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{notice}</p> : null}
        {error ? <p className="rounded-2xl border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5">
            <p className="text-sm text-amber-100/80">待财务处理实收（未归属）</p>
            <p className="mt-2 text-3xl font-semibold text-amber-50">{formatMoney(unassignedTotal)}</p>
            <p className="mt-2 text-xs leading-5 text-amber-100/70">已计入全局待处理实收；分配账号前不计入任何负责人应有总额。</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 lg:col-span-2">
            <p className="text-sm text-white/70">负责人应有总额</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {visibleOwners.map((owner) => (
                <div key={owner.ownerId} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="font-mono text-xs text-[#c4b5fd]">{owner.ownerId}</p>
                  <p className="mt-2 text-xl font-semibold">{formatMoney(owner.expectedTotal)}</p>
                  <p className="mt-1 text-xs text-white/50">外币尚应交回：{formatMoney(owner.foreignDue)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-xl font-semibold">收款账号概况</h2><p className="mt-1 text-sm text-white/60">账号卡片显示累计有效入账；提现按负责人总额扣减，不归属到单一账号。</p></div>
            {isFinance ? <span className="text-xs text-white/45">财务可新建账号，账号一经建立不会转让负责人。</span> : null}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {visibleAccounts.map((account) => {
              const summary = perAccount.get(account.id)!;
              return <div key={account.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{account.name}</p><p className="mt-1 text-xs text-white/50">{account.kind} · {account.currency} · {account.active ? '使用中' : '已停用'}</p></div><span className="font-mono text-[10px] text-[#c4b5fd]">{account.ownerDiscordId}</span></div>
                <p className="mt-4 text-lg font-semibold">入账折算 {formatMoney(summary.receivedRmb)}</p>
                <p className="mt-1 text-xs text-white/55">原币/原额累计：{formatAmountDown2(summary.receivedOriginal)} {account.currency}</p>
                <p className="mt-3 text-xs text-white/55">已确认 {summary.confirmed} · 待确认 {summary.pendingOwner} · 异常 {summary.disputed}</p>
              </div>;
            })}
          </div>
        </section>

        {isFinance ? <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-xl font-semibold">新建收款账号</h2>
          <form action={ACTION_URL} method="post" className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input type="hidden" name="action" value="account-create" /><input type="hidden" name="redirectTo" value={redirectTo} />
            <input required name="name" placeholder="账号名称，例如 新账号微信" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
            <input required name="ownerDiscordId" inputMode="numeric" placeholder="负责人 Discord ID" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
            <select required name="kind" defaultValue=""><option value="" disabled>账号类型</option><option value="WECHAT">微信</option><option value="ALIPAY">支付宝</option><option value="PAYPAL">PayPal</option><option value="BANK">银行卡</option></select>
            <input required name="currency" defaultValue="CNY" placeholder="币种，例如 CNY/EUR/GBP" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
            <button className="rounded-xl bg-[#7356c6] px-4 py-2 text-sm hover:bg-[#6045aa]">创建并绑定</button>
          </form>
        </section> : null}

        {isFinance ? <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div><h2 className="text-xl font-semibold">新开业以来的人工充值候选</h2><p className="mt-1 text-sm leading-6 text-white/60">每笔由客服或管理员写入的正向充值都会列出。财务上传截图、分配账号后即计入该账号实收；若是冲错后已反向充回，可标记无效并关联反向充值编号。</p></div>
          <div className="mt-5 overflow-x-auto"><table className="min-w-[1280px] text-left text-sm"><thead className="border-b border-white/10 text-xs text-white/50"><tr><th className="px-3 py-3">充值</th><th className="px-3 py-3">老板</th><th className="px-3 py-3">金额 / 时间</th><th className="px-3 py-3">状态</th><th className="px-3 py-3">凭证</th><th className="px-3 py-3">财务操作</th></tr></thead><tbody>
            {rechargesWithRows.map(({ recharge, row }) => <tr key={recharge.RechargeID} className="align-top border-b border-white/5"><td className="px-3 py-4 font-mono text-xs text-[#c4b5fd]">{recharge.RechargeID}<br /><span className="text-white/45">来源 {recharge.fromWhom}</span></td><td className="px-3 py-4 font-mono text-xs">{recharge.toWhom ?? recharge.dlmId ?? '—'}</td><td className="px-3 py-4">{formatMoney(recharge.amount)}<br /><span className="text-xs text-white/50">{formatDate(recharge.createdAt)}</span></td><td className="px-3 py-4">{row ? <><span className={`inline-flex rounded-full border px-2 py-1 text-xs ${statusClass[row.status]}`}>{statusLabel[row.status]}</span>{row.account ? <p className="mt-2 text-xs text-white/60">{row.account.name} · {row.ownerDiscordId}</p> : null}{row.exceptionReason ? <p className="mt-2 max-w-48 text-xs text-rose-200">异常：{row.exceptionReason}</p> : null}{row.invalidReason ? <p className="mt-2 max-w-48 text-xs text-white/55">无效：{row.invalidReason}</p> : null}</> : <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${statusClass.PENDING_FINANCE}`}>待财务处理</span>}</td><td className="px-3 py-4">{row?.evidence.length ? <div className="space-y-1">{row.evidence.map((evidence) => <a key={evidence.id} href={`/api/admin/cash-reconciliation/evidence/${evidence.id}`} target="_blank" className="block text-xs text-[#c4b5fd] underline">查看截图</a>)}</div> : <span className="text-xs text-white/40">未上传</span>}</td><td className="px-3 py-4">{row?.status !== SettlementReconciliationStatus.INVALIDATED && row?.status !== SettlementReconciliationStatus.OWNER_CONFIRMED ? <form action={ACTION_URL} method="post" encType="multipart/form-data" className="grid min-w-[330px] gap-2"><input type="hidden" name="action" value="finance-confirm" /><input type="hidden" name="redirectTo" value={redirectTo} /><input type="hidden" name="rechargeId" value={recharge.RechargeID} /><select required name="accountId" defaultValue={row?.accountId ?? ''} className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs"><option value="" disabled>选择实际收款账号</option>{accounts.filter((account) => account.active).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency} · {account.ownerDiscordId}</option>)}</select><input required readOnly name="rmbAmount" inputMode="decimal" value={recharge.amount.toString()} aria-label="老板平台充值金额（人民币）" className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white/60" /><input name="originalReceivedAmount" inputMode="decimal" defaultValue={row?.originalReceivedAmount?.toString() ?? ''} placeholder="外币账号必填：实际原币金额" className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs" /><input name="receipt" type="file" accept="image/png,image/jpeg,image/webp" className="text-xs text-white/70" /><button className="rounded-lg bg-[#7356c6] px-3 py-2 text-xs hover:bg-[#6045aa]">上传凭证并确认实收</button></form> : null}{row?.status !== SettlementReconciliationStatus.INVALIDATED ? <details className="mt-3 min-w-[330px]"><summary className="cursor-pointer text-xs text-white/55">标记无效 / 关联反向充值</summary><form action={ACTION_URL} method="post" className="mt-2 grid gap-2"><input type="hidden" name="action" value="finance-invalidate" /><input type="hidden" name="redirectTo" value={redirectTo} /><input type="hidden" name="rechargeId" value={recharge.RechargeID} /><input required name="reason" placeholder="无效原因，例如充错后已冲正" className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs" /><input name="reversalRechargeId" placeholder="反向充值编号（可选）" className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs" /><button className="rounded-lg border border-rose-300/30 px-3 py-2 text-xs text-rose-100">确认无效</button></form></details> : null}</td></tr>)}
          </tbody></table></div>
        </section> : null}

        {ownerConfirmations.length ? <section className="rounded-3xl border border-amber-300/25 bg-amber-300/10 p-5"><h2 className="text-xl font-semibold text-amber-50">等待你确认的收款</h2><div className="mt-4 grid gap-3 lg:grid-cols-2">{ownerConfirmations.map(({ recharge, row }) => row ? <div key={row.id} className="rounded-2xl border border-amber-200/20 bg-black/20 p-4"><p className="font-medium">{row.account?.name ?? '账号已停用'} · {formatMoney(row.rmbAmount)}</p><p className="mt-1 text-xs text-amber-100/70">充值 {recharge.RechargeID} · 老板 {recharge.toWhom ?? recharge.dlmId ?? '—'} · {formatDate(recharge.createdAt)}</p><div className="mt-3 flex flex-wrap gap-2"><form action={ACTION_URL} method="post"><input type="hidden" name="action" value="owner-confirm" /><input type="hidden" name="redirectTo" value={redirectTo} /><input type="hidden" name="reconciliationId" value={row.id} /><button className="rounded-lg bg-emerald-400/20 px-3 py-2 text-xs text-emerald-50">确认收到</button></form><details><summary className="cursor-pointer rounded-lg border border-rose-300/30 px-3 py-2 text-xs text-rose-100">未收到 / 金额不符</summary><form action={ACTION_URL} method="post" className="mt-2 grid gap-2"><input type="hidden" name="action" value="owner-dispute" /><input type="hidden" name="redirectTo" value={redirectTo} /><input type="hidden" name="reconciliationId" value={row.id} /><input required name="reason" placeholder="异常原因" className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs" /><button className="rounded-lg bg-rose-400/20 px-3 py-2 text-xs text-rose-50">提交异常</button></form></details></div></div> : null)}</div></section> : null}

        {ownedAccounts.filter((account) => account.active && isRmbCurrency(account.currency)).length ? <section className="grid gap-5 xl:grid-cols-2"><div className="rounded-3xl border border-white/10 bg-white/5 p-5"><h2 className="text-xl font-semibold">发起内部人民币转账</h2><p className="mt-1 text-sm text-white/60">只能从你负责的人民币账号转入其他负责人的人民币账号；收款人确认前不计入双方总额。</p><form action={ACTION_URL} method="post" className="mt-4 grid gap-3"><input type="hidden" name="action" value="transfer-create" /><input type="hidden" name="redirectTo" value={redirectTo} /><select required name="fromAccountId" defaultValue=""><option value="" disabled>转出账号</option>{ownedAccounts.filter((account) => account.active && isRmbCurrency(account.currency)).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><select required name="toAccountId" defaultValue=""><option value="" disabled>转入账号</option>{accounts.filter((account) => account.active && isRmbCurrency(account.currency) && account.ownerDiscordId !== session.discordId).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.ownerDiscordId}</option>)}</select><input required name="amount" inputMode="decimal" placeholder="人民币金额" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" /><button className="rounded-xl bg-[#7356c6] px-4 py-2 text-sm">提交转账</button></form></div><div className="rounded-3xl border border-white/10 bg-white/5 p-5"><h2 className="text-xl font-semibold">等待你确认的内部转账</h2>{ownerTransferInbox.length ? <div className="mt-4 space-y-3">{ownerTransferInbox.map((transfer) => <div key={transfer.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><p>{transfer.fromAccount.name} → {transfer.toAccount.name} · <strong>{formatMoney(transfer.amount)}</strong></p><p className="mt-1 text-xs text-white/50">发起人 {transfer.initiatedBy} · {formatDate(transfer.createdAt)}</p><div className="mt-3 flex gap-2"><form action={ACTION_URL} method="post"><input type="hidden" name="action" value="transfer-confirm" /><input type="hidden" name="redirectTo" value={redirectTo} /><input type="hidden" name="transferId" value={transfer.id} /><button className="rounded-lg bg-emerald-400/20 px-3 py-2 text-xs">确认收到</button></form><details><summary className="cursor-pointer rounded-lg border border-rose-300/30 px-3 py-2 text-xs text-rose-100">未收到</summary><form action={ACTION_URL} method="post" className="mt-2 flex gap-2"><input type="hidden" name="action" value="transfer-dispute" /><input type="hidden" name="redirectTo" value={redirectTo} /><input type="hidden" name="transferId" value={transfer.id} /><input required name="reason" placeholder="原因" className="min-w-0 rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs" /><button className="rounded-lg bg-rose-400/20 px-2 py-2 text-xs">提交</button></form></details></div></div>)}</div> : <p className="mt-4 text-sm text-white/50">没有待确认的内部转账。</p>}</div></section> : null}

        {isFinance ? <section className="rounded-3xl border border-white/10 bg-white/5 p-5"><h2 className="text-xl font-semibold">登记外汇归还至人民币账号</h2><p className="mt-1 text-sm text-white/60">这会减少外币账号负责人的“尚应交回”，并将实际归还的人民币计入目标账号负责人的应有总额。</p><form action={ACTION_URL} method="post" className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5"><input type="hidden" name="action" value="forex-recovery" /><input type="hidden" name="redirectTo" value={redirectTo} /><select required name="fromAccountId" defaultValue=""><option value="" disabled>外币来源账号</option>{accounts.filter((account) => account.active && !isRmbCurrency(account.currency)).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency} · {account.ownerDiscordId}</option>)}</select><input required name="foreignAmount" inputMode="decimal" placeholder="实际归还原币金额" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" /><select required name="toAccountId" defaultValue=""><option value="" disabled>进入的人民币账号</option>{accounts.filter((account) => account.active && isRmbCurrency(account.currency)).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.ownerDiscordId}</option>)}</select><input required name="rmbAmount" inputMode="decimal" placeholder="实际进入人民币金额" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" /><div className="flex gap-2"><input name="note" placeholder="备注（可选）" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" /><button className="rounded-xl bg-[#7356c6] px-4 py-2 text-sm">登记</button></div></form></section> : null}

        {pendingPayouts.length ? <section className="rounded-3xl border border-[#c4b5fd]/25 bg-[#7356c6]/10 p-5"><h2 className="text-xl font-semibold">待你发放的提现</h2><p className="mt-1 text-sm text-white/65">用户的提现申请不等于已发放；你点击发放后才从你的负责人应有总额扣除。</p><div className="mt-4 grid gap-3 lg:grid-cols-2">{pendingPayouts.map(({ withdrawal }) => <div key={withdrawal.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="font-medium">{formatMoney(withdrawal.amount)} · {withdrawal.method.split(':')[0]}</p><p className="mt-1 text-xs text-white/55">提现 {withdrawal.id} · 申请人 {withdrawal.discordId ?? withdrawal.dlmId ?? '—'} · {formatDate(withdrawal.createdAt)}</p><form action={ACTION_URL} method="post" className="mt-3"><input type="hidden" name="action" value="payout-paid" /><input type="hidden" name="redirectTo" value={redirectTo} /><input type="hidden" name="withdrawalId" value={withdrawal.id} /><button className="rounded-lg bg-[#7356c6] px-3 py-2 text-xs">标记已发放</button></form></div>)}</div></section> : null}

        {isFinance && recoveries.length ? <section className="rounded-3xl border border-white/10 bg-white/5 p-5"><h2 className="text-xl font-semibold">最近外汇归还记录</h2><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-white/10 text-xs text-white/50"><tr><th className="px-3 py-2">时间</th><th className="px-3 py-2">来源</th><th className="px-3 py-2">目标人民币账号</th><th className="px-3 py-2">原币</th><th className="px-3 py-2">实际人民币</th><th className="px-3 py-2">备注</th></tr></thead><tbody>{recoveries.slice(0, 30).map((recovery) => <tr key={recovery.id} className="border-b border-white/5"><td className="px-3 py-3 text-xs text-white/60">{formatDate(recovery.recoveredAt)}</td><td className="px-3 py-3">{recovery.fromAccount.name}</td><td className="px-3 py-3">{recovery.toAccount.name}</td><td className="px-3 py-3">{formatAmountDown2(recovery.foreignAmount)} {recovery.foreignCurrency}</td><td className="px-3 py-3">{formatMoney(recovery.rmbAmount)}</td><td className="px-3 py-3 text-white/60">{recovery.note ?? '—'}</td></tr>)}</tbody></table></div></section> : null}
      </div>
    </section>
  );
}
