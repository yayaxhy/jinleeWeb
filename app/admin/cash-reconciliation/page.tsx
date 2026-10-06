import Link from "next/link";
import {
  Prisma,
  SettlementPayoutStatus,
  SettlementReconciliationStatus,
  SettlementTransferStatus,
} from "@prisma/client";
import { redirect } from "next/navigation";
import { getAdminDiscordIds } from "@/lib/admin";
import { ReceiptPasteUploader } from "@/components/admin/ReceiptPasteUploader";
import { formatAmountDown2 } from "@/lib/numberFormat";
import { newEntityOnlyTime } from "@/lib/operating-entity-cutover";
import { prisma } from "@/lib/prisma";
import {
  isReconciliationCounted,
  isRmbCurrency,
  isSettlementFinance,
  resolveWithdrawalSettlementOwner,
} from "@/lib/settlement-reconciliation";
import { getServerSession } from "@/lib/session";

export const metadata = { title: "人工充值对账" };
export const dynamic = "force-dynamic";

const ROME_TIMEZONE = "Europe/Rome";
const ACTION_URL = "/api/admin/cash-reconciliation";
const MANUAL_RECHARGE_OPERATOR_IDS = getAdminDiscordIds();
const RECHARGES_PER_PAGE = 40;
const ACCOUNT_DISPLAY_PRIORITY = new Map([
  ["小霍微信", 0],
  ["iria支付宝", 1],
]);

const tabs = [
  "overview",
  "recharges",
  "processed",
  "confirmations",
  "transfers",
  "payouts",
  "forex",
] as const;
const PROCESSED_RECONCILIATION_STATUSES = new Set<SettlementReconciliationStatus>([
  SettlementReconciliationStatus.FINANCE_CONFIRMED,
  SettlementReconciliationStatus.OWNER_CONFIRMED,
  SettlementReconciliationStatus.INVALIDATED,
]);
type ReconciliationTab = (typeof tabs)[number];
type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const formatDate = (value?: Date | null) =>
  value ? value.toLocaleString("zh-CN", { timeZone: ROME_TIMEZONE }) : "—";

const formatMoney = (
  value: Prisma.Decimal | number | string | null | undefined,
) => `¥${formatAmountDown2(value ?? 0)}`;

const ownerName = (ownerId: string) => {
  if (ownerId === "1008032640445710447") return "iria";
  if (ownerId === "308164614846414851") return "小霍";
  if (ownerId === "525770714574225408") return "鸭鸭（主财务）";
  return "负责人";
};

const statusLabel: Record<SettlementReconciliationStatus, string> = {
  PENDING_FINANCE: "待财务处理",
  FINANCE_CONFIRMED: "待负责人确认",
  OWNER_CONFIRMED: "负责人已确认",
  OWNER_DISPUTED: "负责人提出异常",
  INVALIDATED: "财务确认无效",
};

const statusClass: Record<SettlementReconciliationStatus, string> = {
  PENDING_FINANCE: "border-white/20 bg-white/10 text-white/75",
  FINANCE_CONFIRMED: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  OWNER_CONFIRMED: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  OWNER_DISPUTED: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  INVALIDATED: "border-white/15 bg-white/5 text-white/55",
};

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#a78bfa]/70";
const cardClass = "rounded-3xl border border-white/10 bg-white/5 p-5";

function StatusBadge({ status }: { status: SettlementReconciliationStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-xs ${statusClass[status]}`}
    >
      {statusLabel[status]}
    </span>
  );
}

function OwnerIdentity({
  ownerId,
  compact = false,
}: {
  ownerId: string;
  compact?: boolean;
}) {
  return (
    <span
      className={compact ? "text-xs text-white/55" : "text-sm text-white/70"}
    >
      {ownerName(ownerId)}{" "}
      <span className="font-mono text-[#c4b5fd]">{ownerId}</span>
    </span>
  );
}

function sectionLink(tab: ReconciliationTab, page = 1) {
  const query = new URLSearchParams({ tab });
  if ((tab === "recharges" || tab === "processed") && page > 1) {
    query.set("page", String(page));
  }
  return `/admin/cash-reconciliation?${query.toString()}`;
}

export default async function CashReconciliationPage(props: PageProps) {
  const session = await getServerSession();
  if (!session?.discordId) redirect("/");

  const searchParams = (await props.searchParams) ?? {};
  const rawTab =
    typeof searchParams.tab === "string" ? searchParams.tab : "overview";
  const requestedTab = tabs.includes(rawTab as ReconciliationTab)
    ? (rawTab as ReconciliationTab)
    : "overview";
  const isFinance = isSettlementFinance(session.discordId);
  const allowedTabs: ReconciliationTab[] = isFinance
    ? [...tabs]
    : ["overview", "confirmations", "transfers", "payouts"];
  const activeTab = allowedTabs.includes(requestedTab)
    ? requestedTab
    : "overview";
  const requestedPage =
    typeof searchParams.page === "string" ? Number(searchParams.page) : 1;
  const notice =
    typeof searchParams.notice === "string" ? searchParams.notice : "";
  const error =
    typeof searchParams.error === "string" ? searchParams.error : "";

  const [
    loadedAccounts,
    rawRecharges,
    transfers,
    recoveries,
    payouts,
    withdrawals,
  ] = await Promise.all([
    prisma.settlementAccount.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.recharge.findMany({
      where: {
        amount: { not: 0 },
        fromWhom: { in: [...MANUAL_RECHARGE_OPERATOR_IDS] },
        createdAt: newEntityOnlyTime(),
      },
      orderBy: { createdAt: "desc" },
      include: {
        settlementReconciliation: {
          include: {
            account: true,
            evidence: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    }),
    prisma.settlementAccountTransfer.findMany({
      orderBy: { createdAt: "desc" },
      include: { fromAccount: true, toAccount: true },
    }),
    prisma.settlementForexRecovery.findMany({
      orderBy: { recoveredAt: "desc" },
      include: { fromAccount: true, toAccount: true },
    }),
    prisma.settlementWithdrawalPayout.findMany({
      orderBy: { paidAt: "desc" },
    }),
    prisma.withdraw.findMany({
      where: { createdAt: newEntityOnlyTime() },
      orderBy: { createdAt: "desc" },
      include: { settlementPayout: true },
    }),
  ]);

  const accounts = [...loadedAccounts].sort((left, right) => {
    const leftPriority = ACCOUNT_DISPLAY_PRIORITY.get(left.name) ?? 100;
    const rightPriority = ACCOUNT_DISPLAY_PRIORITY.get(right.name) ?? 100;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    if (left.active !== right.active) return left.active ? -1 : 1;
    return left.name.localeCompare(right.name, "zh-CN");
  });

  const ownedAccounts = accounts.filter(
    (account) => account.ownerDiscordId === session.discordId,
  );
  if (!isFinance && !ownedAccounts.length) redirect("/");

  const ownerIds = Array.from(
    new Set(accounts.map((account) => account.ownerDiscordId)),
  );
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const rechargesWithRows = rawRecharges.map((recharge) => ({
    recharge,
    row: recharge.settlementReconciliation,
  }));
  const positiveCashRows = rechargesWithRows.filter(({ recharge }) =>
    recharge.amount.gt(0),
  );
  const negativeCashRows = rechargesWithRows.filter(({ recharge }) =>
    recharge.amount.lt(0),
  );
  const unassignedTotal = rechargesWithRows
    .filter(({ row }) => !row)
    .reduce(
      (total, { recharge }) => total.add(recharge.amount),
      new Prisma.Decimal(0),
    );
  const pendingOwnerRows = rechargesWithRows.filter(
    ({ row }) =>
      row?.status === SettlementReconciliationStatus.FINANCE_CONFIRMED,
  );
  const disputedRows = rechargesWithRows.filter(
    ({ row }) => row?.status === SettlementReconciliationStatus.OWNER_DISPUTED,
  );
  const processingRechargeRows = rechargesWithRows.filter(
    ({ row }) => !row || !PROCESSED_RECONCILIATION_STATUSES.has(row.status),
  );
  const processedRechargeRows = rechargesWithRows
    .filter(({ row }) => row && PROCESSED_RECONCILIATION_STATUSES.has(row.status))
    .sort(({ row: left }, { row: right }) => {
      const leftProcessedAt =
        left?.ownerConfirmedAt ??
        left?.invalidatedAt ??
        left?.financeConfirmedAt ??
        left?.updatedAt ??
        new Date(0);
      const rightProcessedAt =
        right?.ownerConfirmedAt ??
        right?.invalidatedAt ??
        right?.financeConfirmedAt ??
        right?.updatedAt ??
        new Date(0);
      return rightProcessedAt.getTime() - leftProcessedAt.getTime();
    });
  const pendingFinanceCount = processingRechargeRows.length;

  const perAccount = new Map(
    accounts.map((account) => [
      account.id,
      {
        receivedRmb: new Prisma.Decimal(0),
        receivedOriginal: new Prisma.Decimal(0),
        pendingOwner: 0,
        disputed: 0,
        confirmed: 0,
      },
    ]),
  );
  const ownerTotals = new Map(
    ownerIds.map((ownerId) => [
      ownerId,
      {
        incoming: new Prisma.Decimal(0),
        transferIn: new Prisma.Decimal(0),
        transferOut: new Prisma.Decimal(0),
        forexOut: new Prisma.Decimal(0),
        forexIn: new Prisma.Decimal(0),
        payouts: new Prisma.Decimal(0),
        foreignExpected: new Prisma.Decimal(0),
        foreignReturned: new Prisma.Decimal(0),
      },
    ]),
  );
  const getOwnerTotal = (ownerId: string) => {
    const current = ownerTotals.get(ownerId);
    if (current) return current;
    const created = {
      incoming: new Prisma.Decimal(0),
      transferIn: new Prisma.Decimal(0),
      transferOut: new Prisma.Decimal(0),
      forexOut: new Prisma.Decimal(0),
      forexIn: new Prisma.Decimal(0),
      payouts: new Prisma.Decimal(0),
      foreignExpected: new Prisma.Decimal(0),
      foreignReturned: new Prisma.Decimal(0),
    };
    ownerTotals.set(ownerId, created);
    return created;
  };

  for (const { row } of rechargesWithRows) {
    if (
      !row ||
      !row.accountId ||
      !row.ownerDiscordId ||
      !row.rmbAmount ||
      !isReconciliationCounted(row.status)
    )
      continue;
    const accountSummary = perAccount.get(row.accountId);
    if (accountSummary) {
      accountSummary.receivedRmb = accountSummary.receivedRmb.add(
        row.rmbAmount,
      );
      accountSummary.receivedOriginal = accountSummary.receivedOriginal.add(
        row.originalReceivedAmount ?? row.rmbAmount,
      );
      if (row.status === SettlementReconciliationStatus.FINANCE_CONFIRMED)
        accountSummary.pendingOwner += 1;
      if (row.status === SettlementReconciliationStatus.OWNER_DISPUTED)
        accountSummary.disputed += 1;
      if (row.status === SettlementReconciliationStatus.OWNER_CONFIRMED)
        accountSummary.confirmed += 1;
    }
    const ownerSummary = getOwnerTotal(row.ownerDiscordId);
    ownerSummary.incoming = ownerSummary.incoming.add(row.rmbAmount);
    const account = accountById.get(row.accountId);
    if (account && !isRmbCurrency(account.currency))
      ownerSummary.foreignExpected = ownerSummary.foreignExpected.add(
        row.rmbAmount,
      );
  }

  for (const transfer of transfers) {
    if (transfer.status !== SettlementTransferStatus.RECEIVER_CONFIRMED)
      continue;
    getOwnerTotal(transfer.fromAccount.ownerDiscordId).transferOut =
      getOwnerTotal(transfer.fromAccount.ownerDiscordId).transferOut.add(
        transfer.amount,
      );
    getOwnerTotal(transfer.toAccount.ownerDiscordId).transferIn = getOwnerTotal(
      transfer.toAccount.ownerDiscordId,
    ).transferIn.add(transfer.amount);
  }
  for (const recovery of recoveries) {
    getOwnerTotal(recovery.fromAccount.ownerDiscordId).forexOut = getOwnerTotal(
      recovery.fromAccount.ownerDiscordId,
    ).forexOut.add(recovery.rmbAmount);
    getOwnerTotal(recovery.toAccount.ownerDiscordId).forexIn = getOwnerTotal(
      recovery.toAccount.ownerDiscordId,
    ).forexIn.add(recovery.rmbAmount);
    getOwnerTotal(recovery.fromAccount.ownerDiscordId).foreignReturned =
      getOwnerTotal(recovery.fromAccount.ownerDiscordId).foreignReturned.add(
        recovery.rmbAmount,
      );
  }
  for (const payout of payouts) {
    if (payout.status === SettlementPayoutStatus.PAID) {
      getOwnerTotal(payout.ownerDiscordId).payouts = getOwnerTotal(
        payout.ownerDiscordId,
      ).payouts.add(payout.amount);
    }
  }

  const ownerSummaryEntries = [...ownerTotals.entries()].map(
    ([ownerId, totals]) => ({
      ownerId,
      ...totals,
      accountCount: accounts.filter(
        (account) => account.ownerDiscordId === ownerId,
      ).length,
      expectedTotal: totals.incoming
        .add(totals.transferIn)
        .sub(totals.transferOut)
        .sub(totals.forexOut)
        .add(totals.forexIn)
        .sub(totals.payouts),
      foreignDue: totals.foreignExpected.sub(totals.foreignReturned),
    }),
  );
  const visibleOwners = isFinance
    ? ownerSummaryEntries
    : ownerSummaryEntries.filter((row) => row.ownerId === session.discordId);
  const visibleAccounts = isFinance ? accounts : ownedAccounts;
  const confirmationRows = pendingOwnerRows.filter(
    ({ row }) => isFinance || row?.ownerDiscordId === session.discordId,
  );
  const ownerTransferInbox = transfers.filter(
    (transfer) =>
      transfer.toAccount.ownerDiscordId === session.discordId &&
      transfer.status ===
        SettlementTransferStatus.PENDING_RECEIVER_CONFIRMATION,
  );
  const visibleTransfers = isFinance
    ? transfers.slice(0, 50)
    : transfers
        .filter(
          (transfer) =>
            transfer.fromAccount.ownerDiscordId === session.discordId ||
            transfer.toAccount.ownerDiscordId === session.discordId,
        )
        .slice(0, 50);
  const withdrawalItems = withdrawals
    .map((withdrawal) => ({
      withdrawal,
      ownerId: resolveWithdrawalSettlementOwner(withdrawal.method),
    }))
    .filter((item): item is typeof item & { ownerId: string } =>
      Boolean(item.ownerId),
    );
  const pendingPayouts = withdrawalItems.filter(
    ({ withdrawal, ownerId }) =>
      ownerId === session.discordId && !withdrawal.settlementPayout,
  );
  const payoutRows = isFinance
    ? withdrawalItems.filter(({ withdrawal }) => !withdrawal.settlementPayout)
    : pendingPayouts;
  const activeOwnerSummary = ownerSummaryEntries.find(
    (row) => row.ownerId === session.discordId,
  );
  const isProcessedRechargeTab = activeTab === "processed";
  const displayedRechargeRows = isProcessedRechargeTab
    ? processedRechargeRows
    : processingRechargeRows;
  const rechargePageCount = Math.max(
    1,
    Math.ceil(displayedRechargeRows.length / RECHARGES_PER_PAGE),
  );
  const rechargePage =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.min(Math.floor(requestedPage), rechargePageCount)
      : 1;
  const rechargeSlice = displayedRechargeRows.slice(
    (rechargePage - 1) * RECHARGES_PER_PAGE,
    rechargePage * RECHARGES_PER_PAGE,
  );
  const redirectTo =
    activeTab === "recharges" || activeTab === "processed"
      ? sectionLink(activeTab, rechargePage)
      : sectionLink(activeTab);
  const tabItems = (
    isFinance
      ? [
          ["overview", "总览", 0],
          ["recharges", "充值处理", pendingFinanceCount],
          ["processed", "已处理充值", processedRechargeRows.length],
          [
            "confirmations",
            "负责人确认",
            pendingOwnerRows.length + disputedRows.length,
          ],
          ["transfers", "内部转账", 0],
          ["payouts", "提现发放", payoutRows.length],
          ["forex", "外汇归还", 0],
        ]
      : [
          ["overview", "我的收款账号", 0],
          ["confirmations", "待我确认", confirmationRows.length],
          ["transfers", "内部转账", ownerTransferInbox.length],
          ["payouts", "待我发放", pendingPayouts.length],
        ]
  ) as Array<[ReconciliationTab, string, number]>;

  return (
    <section className="cash-reconciliation-page min-h-screen bg-[#020204] px-4 py-6 text-white sm:px-6 sm:py-10">
      <div className="flex w-full max-w-none flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.45em] text-white/50">
              SETTLEMENT
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold">人工充值与收款账户对账</h1>
              {isFinance ? (
                <span className="rounded-full border border-[#c4b5fd]/35 bg-[#7356c6]/15 px-3 py-1 text-xs text-[#ddd6fe]">
                  主财务 · 可查看全部负责人
                </span>
              ) : null}
            </div>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60">
              按“充值处理 → 负责人确认 →
              资金流转”顺序操作。页面仅做内部对账，不会改变老板的平台余额。
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            返回后台
          </Link>
        </header>

        {notice ? (
          <p className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-2xl border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        <nav
          aria-label="对账功能"
          className="sticky top-3 z-10 -mx-1 overflow-x-auto rounded-2xl border border-white/10 bg-[#0a0a0f]/95 p-1.5 shadow-2xl backdrop-blur"
        >
          <div className="flex min-w-max gap-1">
            {tabItems.map(([tab, label, count]) => (
              <Link
                key={tab}
                href={sectionLink(tab)}
                aria-current={activeTab === tab ? "page" : undefined}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition ${activeTab === tab ? "bg-[#7356c6] text-white shadow-lg shadow-[#7356c6]/25" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
              >
                {label}
                {count > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] ${activeTab === tab ? "bg-white/20 text-white" : "bg-amber-300/15 text-amber-100"}`}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </nav>

        {activeTab === "overview" ? (
          <>
            <section className="grid gap-4 xl:grid-cols-4">
              {isFinance ? (
                <>
                  <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5">
                    <p className="text-sm text-amber-100/80">待财务处理净额</p>
                    <p className="mt-2 text-3xl font-semibold text-amber-50">
                      {formatMoney(unassignedTotal)}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-amber-100/70">
                      {pendingFinanceCount}{" "}
                      笔正数或扣减账项尚未分配账号；金额按正负号汇总，分配前不属于任何负责人。
                    </p>
                  </div>
                  <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5">
                    <p className="text-sm text-amber-100/80">待负责人确认</p>
                    <p className="mt-2 text-3xl font-semibold text-amber-50">
                      {pendingOwnerRows.length} 笔
                    </p>
                    <p className="mt-2 text-xs leading-5 text-amber-100/70">
                      已计入实收，仍等待对应账号负责人二次确认。
                    </p>
                  </div>
                  <div className="rounded-3xl border border-rose-300/20 bg-rose-300/10 p-5">
                    <p className="text-sm text-rose-100/80">异常预警</p>
                    <p className="mt-2 text-3xl font-semibold text-rose-50">
                      {disputedRows.length} 笔
                    </p>
                    <p className="mt-2 text-xs leading-5 text-rose-100/70">
                      异常暂时仍计入；请在充值处理里核对后更正或标无效。
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[#c4b5fd]/25 bg-[#7356c6]/10 p-5">
                    <p className="text-sm text-[#ddd6fe]">待发放提现</p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {payoutRows.length} 笔
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[#ddd6fe]/75">
                      按微信、支付宝负责人分配；发放后才从负责人总额扣除。
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-3xl border border-[#c4b5fd]/25 bg-[#7356c6]/10 p-5">
                    <p className="text-sm text-[#ddd6fe]">我的负责人应有总额</p>
                    <p className="mt-2 text-3xl font-semibold">
                      {formatMoney(activeOwnerSummary?.expectedTotal)}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm text-white/65">外币尚应交回</p>
                    <p className="mt-2 text-3xl font-semibold">
                      {formatMoney(activeOwnerSummary?.foreignDue)}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5">
                    <p className="text-sm text-amber-100/80">待我确认收款</p>
                    <p className="mt-2 text-3xl font-semibold text-amber-50">
                      {confirmationRows.length} 笔
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[#c4b5fd]/25 bg-[#7356c6]/10 p-5">
                    <p className="text-sm text-[#ddd6fe]">待我发放提现</p>
                    <p className="mt-2 text-3xl font-semibold">
                      {pendingPayouts.length} 笔
                    </p>
                  </div>
                </>
              )}
            </section>

            <section className={cardClass}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">
                    {isFinance ? "负责人资金总览" : "我的资金总览"}
                  </h2>
                  <p className="mt-1 text-sm text-white/60">
                    应有总额 = 有效充值 + 已确认转入 − 已确认转出 − 外汇交回 +
                    外汇进入 − 已发放提现。
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleOwners.map((owner) => (
                  <div
                    key={owner.ownerId}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <OwnerIdentity ownerId={owner.ownerId} />
                    <p className="mt-3 text-2xl font-semibold">
                      {formatMoney(owner.expectedTotal)}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/55">
                      <span>账号 {owner.accountCount} 个</span>
                      <span>有效充值 {formatMoney(owner.incoming)}</span>
                      <span>已发提现 {formatMoney(owner.payouts)}</span>
                      <span>外币待交 {formatMoney(owner.foreignDue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={cardClass}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">收款账号概况</h2>
                  <p className="mt-1 text-sm text-white/60">
                    账号卡片统计累计有效入账；提现按负责人总额扣减，不归属到单一账号。
                  </p>
                </div>
                {isFinance ? (
                  <span className="text-xs text-white/45">
                    主财务可新建账号；账号一经建立不可转让负责人。
                  </span>
                ) : null}
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {visibleAccounts.map((account) => {
                  const summary = perAccount.get(account.id)!;
                  return (
                    <div
                      key={account.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{account.name}</p>
                          <p className="mt-1 text-xs text-white/50">
                            {account.kind} · {account.currency} ·{" "}
                            {account.active ? "使用中" : "已停用"}
                          </p>
                        </div>
                        <OwnerIdentity
                          ownerId={account.ownerDiscordId}
                          compact
                        />
                      </div>
                      <p className="mt-4 text-lg font-semibold">
                        入账折算 {formatMoney(summary.receivedRmb)}
                      </p>
                      <p className="mt-1 text-xs text-white/55">
                        原币/原额累计：
                        {formatAmountDown2(summary.receivedOriginal)}{" "}
                        {account.currency}
                      </p>
                      <p className="mt-3 text-xs text-white/55">
                        已确认 {summary.confirmed} · 待确认{" "}
                        {summary.pendingOwner} · 异常 {summary.disputed}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {isFinance ? (
              <section className={cardClass}>
                <h2 className="text-xl font-semibold">新建收款账号</h2>
                <p className="mt-1 text-sm text-white/60">
                  创建时直接绑定负责人。后续账号不会更换负责人。
                </p>
                <form
                  action={ACTION_URL}
                  method="post"
                  className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5"
                >
                  <input type="hidden" name="action" value="account-create" />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <input
                    required
                    name="name"
                    placeholder="账号名称，例如 新账号微信"
                    className={fieldClass}
                  />
                  <input
                    required
                    name="ownerDiscordId"
                    inputMode="numeric"
                    placeholder="负责人 Discord ID"
                    className={fieldClass}
                  />
                  <select
                    required
                    name="kind"
                    defaultValue=""
                    className={fieldClass}
                  >
                    <option value="" disabled>
                      账号类型
                    </option>
                    <option value="WECHAT">微信</option>
                    <option value="ALIPAY">支付宝</option>
                    <option value="PAYPAL">PayPal</option>
                    <option value="BANK">银行卡</option>
                  </select>
                  <input
                    required
                    name="currency"
                    defaultValue="CNY"
                    placeholder="币种，例如 CNY/EUR/GBP"
                    className={fieldClass}
                  />
                  <button className="rounded-xl bg-[#7356c6] px-4 py-2 text-sm hover:bg-[#6045aa]">
                    创建并绑定
                  </button>
                </form>
              </section>
            ) : null}
          </>
        ) : null}

        {(activeTab === "recharges" || activeTab === "processed") && isFinance ? (
          <section className={cardClass}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  {isProcessedRechargeTab ? "已处理充值" : "人工充值处理"}
                </h2>
                <p className="mt-1 max-w-4xl text-sm leading-6 text-white/60">
                  {isProcessedRechargeTab
                    ? "已确认实收、负责人已确认和已确认无效的记录都保留在此处；最新处理的记录排在最前。"
                    : "每笔 `!cash` 都独立分配收款账号与确认，正数和负数都需上传截图。负数为独立扣减账项，填写调整原因后按负数计入对应账号和负责人总额，例如同一账号的 +150 与 -50 会自然汇总为 ¥100。"}
                </p>
              </div>
              <div className="text-right text-sm text-white/60">
                {isProcessedRechargeTab ? (
                  <>
                    <p>已处理 {processedRechargeRows.length} 笔</p>
                    <p className="mt-1 text-emerald-100">按最后处理时间倒序</p>
                  </>
                ) : (
                  <>
                    <p>
                      历史记录共 {rechargesWithRows.length} 笔（正数{" "}
                      {positiveCashRows.length} · 扣减 {negativeCashRows.length}）
                    </p>
                    <p className="mt-1 text-amber-100">
                      待处理 {pendingFinanceCount} 笔 · 异常 {disputedRows.length}{" "}
                      笔
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="cash-table-scroll mt-5 rounded-2xl border border-white/10">
              <table className="cash-recharge-table text-left text-sm">
                <thead className="border-b border-white/10 bg-black/20 text-xs text-white/50">
                  <tr>
                    <th className="px-3 py-3">记录 / 来源</th>
                    <th className="px-3 py-3">老板</th>
                    <th className="px-3 py-3">金额 / 时间</th>
                    <th className="px-3 py-3">对账状态</th>
                    <th className="px-3 py-3">凭证</th>
                    <th className="px-3 py-3">
                      {isProcessedRechargeTab ? "最后处理 / 操作" : "本笔处理"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rechargeSlice.map(({ recharge, row }) => {
                    const isNegativeCash = recharge.amount.lt(0);

                    return (
                      <tr
                        key={recharge.RechargeID}
                        className="align-top border-b border-white/5 last:border-b-0"
                      >
                        <td className="px-3 py-4 font-mono text-xs text-[#c4b5fd]">
                          <div className="flex items-center gap-2">
                            <span>{recharge.RechargeID}</span>
                            <span
                              className={`rounded-full border px-1.5 py-0.5 text-[10px] ${isNegativeCash ? "border-rose-300/30 bg-rose-300/10 text-rose-100" : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"}`}
                            >
                              {isNegativeCash ? "扣减" : "充值"}
                            </span>
                          </div>
                          <span className="text-white/45">
                            来源 {recharge.fromWhom}
                          </span>
                        </td>
                        <td className="px-3 py-4 font-mono text-xs">
                          {recharge.toWhom ?? recharge.dlmId ?? "—"}
                        </td>
                        <td
                          className={`px-3 py-4 whitespace-nowrap ${isNegativeCash ? "text-rose-200" : ""}`}
                        >
                          {formatMoney(recharge.amount)}
                          <br />
                          <span className="text-xs text-white/50">
                            {formatDate(recharge.createdAt)}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          {row ? (
                            <>
                              <StatusBadge status={row.status} />
                              {row.account ? (
                                <p className="mt-2 text-xs text-white/60">
                                  {row.account.name} ·{" "}
                                  {ownerName(row.ownerDiscordId ?? "")}
                                </p>
                              ) : null}
                              {row.exceptionReason ? (
                                <p className="mt-2 max-w-52 text-xs text-rose-200">
                                  异常：{row.exceptionReason}
                                </p>
                              ) : null}
                              {row.invalidReason ? (
                                <p className="mt-2 max-w-52 text-xs text-white/55">
                                  无效：{row.invalidReason}
                                </p>
                              ) : null}
                              {isProcessedRechargeTab ? (
                                <p className="mt-2 text-xs text-white/45">
                                  最后处理：
                                  {formatDate(
                                    row.ownerConfirmedAt ??
                                      row.invalidatedAt ??
                                      row.financeConfirmedAt ??
                                      row.updatedAt,
                                  )}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <StatusBadge
                              status={
                                SettlementReconciliationStatus.PENDING_FINANCE
                              }
                            />
                          )}
                        </td>
                        <td className="px-3 py-4">
                          {row?.evidence.length ? (
                            <div className="space-y-1">
                              {row.evidence.map((evidence) => (
                                <a
                                  key={evidence.id}
                                  href={`/api/admin/cash-reconciliation/evidence/${evidence.id}`}
                                  target="_blank"
                                  className="block text-xs text-[#c4b5fd] underline"
                                >
                                  查看截图
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-white/40">
                              未上传
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-4">
                          <>
                            {row?.status !==
                            SettlementReconciliationStatus.OWNER_CONFIRMED ? (
                              <form
                                action={ACTION_URL}
                                method="post"
                                encType="multipart/form-data"
                                className="grid min-w-[300px] gap-2"
                              >
                                <input
                                  type="hidden"
                                  name="action"
                                  value="finance-confirm"
                                />
                                <input
                                  type="hidden"
                                  name="redirectTo"
                                  value={redirectTo}
                                />
                                <input
                                  type="hidden"
                                  name="rechargeId"
                                  value={recharge.RechargeID}
                                />
                                <select
                                  required
                                  name="accountId"
                                  defaultValue={row?.accountId ?? ""}
                                  className={fieldClass}
                                >
                                  <option value="" disabled>
                                    选择实际收款账号
                                  </option>
                                  {accounts
                                    .filter((account) => account.active)
                                    .map((account) => (
                                      <option
                                        key={account.id}
                                        value={account.id}
                                      >
                                        {account.name} · {account.currency} ·{" "}
                                        {ownerName(account.ownerDiscordId)}
                                      </option>
                                    ))}
                                </select>
                                <input
                                  readOnly
                                  value={recharge.amount.toString()}
                                  aria-label="本笔 cash 金额（人民币）"
                                  className={`${fieldClass} cursor-not-allowed text-white/60`}
                                />
                                {isNegativeCash ? (
                                  <input
                                    required
                                    name="adjustmentNote"
                                    placeholder="扣减/调整原因，例如 cash 录多 50 后更正"
                                    className={fieldClass}
                                  />
                                ) : null}
                                <input
                                  name="originalReceivedAmount"
                                  inputMode="decimal"
                                  defaultValue={
                                    isNegativeCash
                                      ? (row?.originalReceivedAmount
                                          ?.abs()
                                          .toString() ?? "")
                                      : (row?.originalReceivedAmount?.toString() ??
                                        "")
                                  }
                                  placeholder={
                                    isNegativeCash
                                      ? "外币账号必填：本笔原币调整绝对值"
                                      : "外币账号必填：实际原币金额"
                                  }
                                  className={fieldClass}
                                />
                                <ReceiptPasteUploader />
                                <button className="rounded-xl bg-[#7356c6] px-3 py-2 text-xs hover:bg-[#6045aa]">
                                  {isNegativeCash
                                    ? "上传凭证并确认扣减"
                                    : row?.status ===
                                        SettlementReconciliationStatus.INVALIDATED
                                      ? "恢复为实收并等待确认"
                                      : "上传凭证并确认实收"}
                                </button>
                              </form>
                            ) : null}
                            {row?.status !==
                            SettlementReconciliationStatus.INVALIDATED ? (
                              <details className="mt-3 min-w-[300px]">
                                <summary className="cursor-pointer text-xs text-white/55">
                                  标记本笔无效
                                </summary>
                                <form
                                  action={ACTION_URL}
                                  method="post"
                                  className="mt-2 grid gap-2"
                                >
                                  <input
                                    type="hidden"
                                    name="action"
                                    value="finance-invalidate"
                                  />
                                  <input
                                    type="hidden"
                                    name="redirectTo"
                                    value={redirectTo}
                                  />
                                  <input
                                    type="hidden"
                                    name="rechargeId"
                                    value={recharge.RechargeID}
                                  />
                                  <input
                                    required
                                    name="reason"
                                    placeholder="无效原因，例如错误的 cash 记录"
                                    className={fieldClass}
                                  />
                                  <button className="rounded-xl border border-rose-300/30 px-3 py-2 text-xs text-rose-100 hover:bg-rose-300/10">
                                    确认无效
                                  </button>
                                </form>
                              </details>
                            ) : null}
                          </>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-white/60">
              <span>
                第 {rechargePage} / {rechargePageCount} 页，每页{" "}
                {RECHARGES_PER_PAGE} 笔
              </span>
              <div className="flex gap-2">
                <Link
                  aria-disabled={rechargePage <= 1}
                  href={sectionLink(activeTab, Math.max(1, rechargePage - 1))}
                  className={`rounded-lg border px-3 py-2 ${rechargePage <= 1 ? "pointer-events-none border-white/5 text-white/25" : "border-white/15 hover:bg-white/10"}`}
                >
                  上一页
                </Link>
                <Link
                  aria-disabled={rechargePage >= rechargePageCount}
                  href={sectionLink(
                    activeTab,
                    Math.min(rechargePageCount, rechargePage + 1),
                  )}
                  className={`rounded-lg border px-3 py-2 ${rechargePage >= rechargePageCount ? "pointer-events-none border-white/5 text-white/25" : "border-white/15 hover:bg-white/10"}`}
                >
                  下一页
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "confirmations" ? (
          <>
            <section className="rounded-3xl border border-amber-300/25 bg-amber-300/10 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-amber-50">
                    {isFinance ? "负责人收款确认总览" : "等待我确认的收款"}
                  </h2>
                  <p className="mt-1 text-sm text-amber-100/75">
                    {isFinance
                      ? "主财务可查看所有负责人待确认项和异常；只有账号负责人可做二次确认或提出异常。"
                      : "确认前请先核对你实际收款账号的到账记录。"}
                  </p>
                </div>
                <span className="text-sm text-amber-100">
                  待确认 {confirmationRows.length} 笔
                </span>
              </div>
              {confirmationRows.length ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {confirmationRows.map(({ recharge, row }) =>
                    row ? (
                      <div
                        key={row.id}
                        className="rounded-2xl border border-amber-200/20 bg-black/20 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">
                              {row.account?.name ?? "账号已停用"} ·{" "}
                              {formatMoney(row.rmbAmount)}
                            </p>
                            <p className="mt-1 text-xs text-amber-100/70">
                              <OwnerIdentity
                                ownerId={row.ownerDiscordId ?? ""}
                                compact
                              />{" "}
                              · 充值 {recharge.RechargeID}
                            </p>
                          </div>
                          <StatusBadge status={row.status} />
                        </div>
                        <p className="mt-3 text-xs text-white/55">
                          老板 {recharge.toWhom ?? recharge.dlmId ?? "—"} ·{" "}
                          {formatDate(recharge.createdAt)}
                        </p>
                        {row.ownerDiscordId === session.discordId ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <form action={ACTION_URL} method="post">
                              <input
                                type="hidden"
                                name="action"
                                value="owner-confirm"
                              />
                              <input
                                type="hidden"
                                name="redirectTo"
                                value={redirectTo}
                              />
                              <input
                                type="hidden"
                                name="reconciliationId"
                                value={row.id}
                              />
                              <button className="rounded-lg bg-emerald-400/20 px-3 py-2 text-xs text-emerald-50 hover:bg-emerald-400/30">
                                确认收到
                              </button>
                            </form>
                            <details>
                              <summary className="cursor-pointer rounded-lg border border-rose-300/30 px-3 py-2 text-xs text-rose-100">
                                未收到 / 金额不符
                              </summary>
                              <form
                                action={ACTION_URL}
                                method="post"
                                className="mt-2 grid gap-2"
                              >
                                <input
                                  type="hidden"
                                  name="action"
                                  value="owner-dispute"
                                />
                                <input
                                  type="hidden"
                                  name="redirectTo"
                                  value={redirectTo}
                                />
                                <input
                                  type="hidden"
                                  name="reconciliationId"
                                  value={row.id}
                                />
                                <input
                                  required
                                  name="reason"
                                  placeholder="异常原因"
                                  className={fieldClass}
                                />
                                <button className="rounded-lg bg-rose-400/20 px-3 py-2 text-xs text-rose-50">
                                  提交异常
                                </button>
                              </form>
                            </details>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs text-white/45">
                            等待 {ownerName(row.ownerDiscordId ?? "")} 操作
                          </p>
                        )}
                      </div>
                    ) : null,
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-amber-100/70">
                  没有待确认的收款。
                </p>
              )}
            </section>
            {isFinance && disputedRows.length ? (
              <section className="rounded-3xl border border-rose-300/25 bg-rose-300/10 p-5">
                <h2 className="text-xl font-semibold text-rose-50">
                  负责人异常预警
                </h2>
                <p className="mt-1 text-sm text-rose-100/75">
                  异常金额暂时仍在实收和负责人应有总额内；请回到“充值处理”核对凭证后处理。
                </p>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {disputedRows.map(({ recharge, row }) =>
                    row ? (
                      <div
                        key={row.id}
                        className="rounded-2xl border border-rose-200/20 bg-black/20 p-4"
                      >
                        <p className="font-medium">
                          {row.account?.name ?? "账号已停用"} ·{" "}
                          {formatMoney(row.rmbAmount)}
                        </p>
                        <p className="mt-1 text-xs text-rose-100/75">
                          <OwnerIdentity
                            ownerId={row.ownerDiscordId ?? ""}
                            compact
                          />{" "}
                          · 充值 {recharge.RechargeID}
                        </p>
                        <p className="mt-3 text-sm text-rose-100">
                          异常：{row.exceptionReason ?? "未填写原因"}
                        </p>
                      </div>
                    ) : null,
                  )}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {activeTab === "transfers" ? (
          <>
            {ownedAccounts.filter(
              (account) => account.active && isRmbCurrency(account.currency),
            ).length ? (
              <section className="grid gap-5 xl:grid-cols-2">
                <div className={cardClass}>
                  <h2 className="text-xl font-semibold">发起内部人民币转账</h2>
                  <p className="mt-1 text-sm text-white/60">
                    只能从你负责的人民币账号转入其他负责人的人民币账号；收款人确认前不计入双方总额。
                  </p>
                  <form
                    action={ACTION_URL}
                    method="post"
                    className="mt-4 grid gap-3"
                  >
                    <input
                      type="hidden"
                      name="action"
                      value="transfer-create"
                    />
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <select
                      required
                      name="fromAccountId"
                      defaultValue=""
                      className={fieldClass}
                    >
                      <option value="" disabled>
                        转出账号
                      </option>
                      {ownedAccounts
                        .filter(
                          (account) =>
                            account.active && isRmbCurrency(account.currency),
                        )
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </select>
                    <select
                      required
                      name="toAccountId"
                      defaultValue=""
                      className={fieldClass}
                    >
                      <option value="" disabled>
                        转入账号
                      </option>
                      {accounts
                        .filter(
                          (account) =>
                            account.active &&
                            isRmbCurrency(account.currency) &&
                            account.ownerDiscordId !== session.discordId,
                        )
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} · {ownerName(account.ownerDiscordId)}
                          </option>
                        ))}
                    </select>
                    <input
                      required
                      name="amount"
                      inputMode="decimal"
                      placeholder="人民币金额"
                      className={fieldClass}
                    />
                    <button className="rounded-xl bg-[#7356c6] px-4 py-2 text-sm hover:bg-[#6045aa]">
                      提交转账
                    </button>
                  </form>
                </div>
                <div className={cardClass}>
                  <h2 className="text-xl font-semibold">
                    等待我确认的内部转账
                  </h2>
                  {ownerTransferInbox.length ? (
                    <div className="mt-4 space-y-3">
                      {ownerTransferInbox.map((transfer) => (
                        <div
                          key={transfer.id}
                          className="rounded-2xl border border-white/10 bg-black/20 p-4"
                        >
                          <p>
                            {transfer.fromAccount.name} →{" "}
                            {transfer.toAccount.name} ·{" "}
                            <strong>{formatMoney(transfer.amount)}</strong>
                          </p>
                          <p className="mt-1 text-xs text-white/50">
                            发起人 {transfer.initiatedBy} ·{" "}
                            {formatDate(transfer.createdAt)}
                          </p>
                          <div className="mt-3 flex gap-2">
                            <form action={ACTION_URL} method="post">
                              <input
                                type="hidden"
                                name="action"
                                value="transfer-confirm"
                              />
                              <input
                                type="hidden"
                                name="redirectTo"
                                value={redirectTo}
                              />
                              <input
                                type="hidden"
                                name="transferId"
                                value={transfer.id}
                              />
                              <button className="rounded-lg bg-emerald-400/20 px-3 py-2 text-xs">
                                确认收到
                              </button>
                            </form>
                            <details>
                              <summary className="cursor-pointer rounded-lg border border-rose-300/30 px-3 py-2 text-xs text-rose-100">
                                未收到
                              </summary>
                              <form
                                action={ACTION_URL}
                                method="post"
                                className="mt-2 flex gap-2"
                              >
                                <input
                                  type="hidden"
                                  name="action"
                                  value="transfer-dispute"
                                />
                                <input
                                  type="hidden"
                                  name="redirectTo"
                                  value={redirectTo}
                                />
                                <input
                                  type="hidden"
                                  name="transferId"
                                  value={transfer.id}
                                />
                                <input
                                  required
                                  name="reason"
                                  placeholder="原因"
                                  className={`${fieldClass} min-w-0`}
                                />
                                <button className="rounded-lg bg-rose-400/20 px-2 py-2 text-xs">
                                  提交
                                </button>
                              </form>
                            </details>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-white/50">
                      没有待确认的内部转账。
                    </p>
                  )}
                </div>
              </section>
            ) : null}
            <section className={cardClass}>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">
                    {isFinance ? "全部负责人内部转账流水" : "我的内部转账流水"}
                  </h2>
                  <p className="mt-1 text-sm text-white/60">
                    仅收款人确认过的转账会影响双方负责人总额。
                  </p>
                </div>
                <span className="text-sm text-white/50">
                  最近 {visibleTransfers.length} 笔
                </span>
              </div>
              {visibleTransfers.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-white/10 text-xs text-white/50">
                      <tr>
                        <th className="px-3 py-2">时间</th>
                        <th className="px-3 py-2">转出</th>
                        <th className="px-3 py-2">转入</th>
                        <th className="px-3 py-2">金额</th>
                        <th className="px-3 py-2">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTransfers.map((transfer) => (
                        <tr
                          key={transfer.id}
                          className="border-b border-white/5"
                        >
                          <td className="px-3 py-3 text-xs text-white/60">
                            {formatDate(transfer.createdAt)}
                          </td>
                          <td className="px-3 py-3">
                            {transfer.fromAccount.name}
                            <br />
                            <OwnerIdentity
                              ownerId={transfer.fromAccount.ownerDiscordId}
                              compact
                            />
                          </td>
                          <td className="px-3 py-3">
                            {transfer.toAccount.name}
                            <br />
                            <OwnerIdentity
                              ownerId={transfer.toAccount.ownerDiscordId}
                              compact
                            />
                          </td>
                          <td className="px-3 py-3 font-medium">
                            {formatMoney(transfer.amount)}
                          </td>
                          <td className="px-3 py-3 text-xs text-white/65">
                            {transfer.status ===
                            SettlementTransferStatus.RECEIVER_CONFIRMED
                              ? "已确认"
                              : transfer.status ===
                                  SettlementTransferStatus.RECEIVER_DISPUTED
                                ? "收款异常"
                                : "待收款人确认"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-white/50">
                  还没有内部转账记录。
                </p>
              )}
            </section>
          </>
        ) : null}

        {activeTab === "payouts" ? (
          <section className="rounded-3xl border border-[#c4b5fd]/25 bg-[#7356c6]/10 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  {isFinance ? "全部负责人待发提现" : "待我发放的提现"}
                </h2>
                <p className="mt-1 text-sm text-white/65">
                  提现申请不等于已发放；对应负责人点击“标记已发放”后才从该负责人应有总额扣除。
                </p>
              </div>
              <span className="text-sm text-[#ddd6fe]">
                待发 {payoutRows.length} 笔
              </span>
            </div>
            {payoutRows.length ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {payoutRows.map(({ withdrawal, ownerId }) => (
                  <div
                    key={withdrawal.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {formatMoney(withdrawal.amount)} ·{" "}
                          {withdrawal.method.split(":")[0]}
                        </p>
                        <p className="mt-1 text-xs text-white/55">
                          提现 {withdrawal.id} · 申请人{" "}
                          {withdrawal.discordId ?? withdrawal.dlmId ?? "—"} ·{" "}
                          {formatDate(withdrawal.createdAt)}
                        </p>
                      </div>
                      <OwnerIdentity ownerId={ownerId} compact />
                    </div>
                    {ownerId === session.discordId ? (
                      <form action={ACTION_URL} method="post" className="mt-3">
                        <input
                          type="hidden"
                          name="action"
                          value="payout-paid"
                        />
                        <input
                          type="hidden"
                          name="redirectTo"
                          value={redirectTo}
                        />
                        <input
                          type="hidden"
                          name="withdrawalId"
                          value={withdrawal.id}
                        />
                        <button className="rounded-lg bg-[#7356c6] px-3 py-2 text-xs hover:bg-[#6045aa]">
                          标记已发放
                        </button>
                      </form>
                    ) : (
                      <p className="mt-3 text-xs text-white/45">
                        等待 {ownerName(ownerId)} 发放
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#ddd6fe]/75">
                当前没有待发提现。
              </p>
            )}
          </section>
        ) : null}

        {activeTab === "forex" && isFinance ? (
          <>
            <section className={cardClass}>
              <h2 className="text-xl font-semibold">
                登记外汇归还至人民币账号
              </h2>
              <p className="mt-1 text-sm text-white/60">
                这会减少外币账号负责人的“尚应交回”，并将实际归还的人民币计入目标账号负责人的应有总额。
              </p>
              <form
                action={ACTION_URL}
                method="post"
                className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5"
              >
                <input type="hidden" name="action" value="forex-recovery" />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <select
                  required
                  name="fromAccountId"
                  defaultValue=""
                  className={fieldClass}
                >
                  <option value="" disabled>
                    外币来源账号
                  </option>
                  {accounts
                    .filter(
                      (account) =>
                        account.active && !isRmbCurrency(account.currency),
                    )
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {account.currency} ·{" "}
                        {ownerName(account.ownerDiscordId)}
                      </option>
                    ))}
                </select>
                <input
                  required
                  name="foreignAmount"
                  inputMode="decimal"
                  placeholder="实际归还原币金额"
                  className={fieldClass}
                />
                <select
                  required
                  name="toAccountId"
                  defaultValue=""
                  className={fieldClass}
                >
                  <option value="" disabled>
                    进入的人民币账号
                  </option>
                  {accounts
                    .filter(
                      (account) =>
                        account.active && isRmbCurrency(account.currency),
                    )
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {ownerName(account.ownerDiscordId)}
                      </option>
                    ))}
                </select>
                <input
                  required
                  name="rmbAmount"
                  inputMode="decimal"
                  placeholder="实际进入人民币金额"
                  className={fieldClass}
                />
                <div className="flex gap-2">
                  <input
                    name="note"
                    placeholder="备注（可选）"
                    className={`${fieldClass} min-w-0 flex-1`}
                  />
                  <button className="rounded-xl bg-[#7356c6] px-4 py-2 text-sm hover:bg-[#6045aa]">
                    登记
                  </button>
                </div>
              </form>
            </section>
            <section className={cardClass}>
              <h2 className="text-xl font-semibold">最近外汇归还记录</h2>
              {recoveries.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-white/10 text-xs text-white/50">
                      <tr>
                        <th className="px-3 py-2">时间</th>
                        <th className="px-3 py-2">来源</th>
                        <th className="px-3 py-2">目标人民币账号</th>
                        <th className="px-3 py-2">原币</th>
                        <th className="px-3 py-2">实际人民币</th>
                        <th className="px-3 py-2">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recoveries.slice(0, 30).map((recovery) => (
                        <tr
                          key={recovery.id}
                          className="border-b border-white/5"
                        >
                          <td className="px-3 py-3 text-xs text-white/60">
                            {formatDate(recovery.recoveredAt)}
                          </td>
                          <td className="px-3 py-3">
                            {recovery.fromAccount.name}
                            <br />
                            <OwnerIdentity
                              ownerId={recovery.fromAccount.ownerDiscordId}
                              compact
                            />
                          </td>
                          <td className="px-3 py-3">
                            {recovery.toAccount.name}
                            <br />
                            <OwnerIdentity
                              ownerId={recovery.toAccount.ownerDiscordId}
                              compact
                            />
                          </td>
                          <td className="px-3 py-3">
                            {formatAmountDown2(recovery.foreignAmount)}{" "}
                            {recovery.foreignCurrency}
                          </td>
                          <td className="px-3 py-3">
                            {formatMoney(recovery.rmbAmount)}
                          </td>
                          <td className="px-3 py-3 text-white/60">
                            {recovery.note ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-white/50">
                  还没有外汇归还记录。
                </p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </section>
  );
}
