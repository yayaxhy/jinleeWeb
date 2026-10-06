import Link from "next/link";
import { Fragment } from "react";
import {
  Prisma,
  SettlementPayoutStatus,
  SettlementReconciliationStatus,
  SettlementTransferStatus,
} from "@prisma/client";
import { redirect } from "next/navigation";
import { getAdminDiscordIds } from "@/lib/admin";
import { ReceiptPasteUploader } from "@/components/admin/ReceiptPasteUploader";
import { LocalDayDivider } from "@/components/admin/LocalDayDivider";
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
  "exceptions",
  "confirmed-receipts",
  "transfers",
  "payouts",
  "paid-payouts",
  "forex",
  "audit",
] as const;
const PROCESSED_RECONCILIATION_STATUSES =
  new Set<SettlementReconciliationStatus>([
    SettlementReconciliationStatus.FINANCE_CONFIRMED,
    SettlementReconciliationStatus.OWNER_CONFIRMED,
    SettlementReconciliationStatus.INVALIDATED,
  ]);
type ReconciliationTab = (typeof tabs)[number];
type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
type AuditRow = {
  id: string;
  occurredAt: Date;
  category: string;
  action: string;
  subject: string;
  amount: Prisma.Decimal | null;
  actorDiscordId: string;
  note: string | null;
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
      title={ownerId}
      className={compact ? "text-xs text-white/55" : "text-sm text-white/70"}
    >
      {ownerName(ownerId)}
    </span>
  );
}

function BossIdentity({
  discord,
  wechat,
}: {
  discord?: {
    serverDisplayName: string | null;
    discordUsername: string | null;
  } | null;
  wechat?: { displayName: string | null; wechatContact: string | null } | null;
}) {
  if (discord) {
    return (
      <>
        <p className="font-medium text-white">
          {discord.serverDisplayName ??
            discord.discordUsername ??
            "Discord 用户"}
        </p>
        <p className="mt-1 font-mono text-white/50">
          @{discord.discordUsername ?? "用户名待同步"}
        </p>
      </>
    );
  }

  if (wechat) {
    return (
      <p className="font-medium text-white">
        微信 · {wechat.displayName ?? wechat.wechatContact ?? "老板"}
      </p>
    );
  }

  return <span className="text-white/50">用户资料待同步</span>;
}

function sectionLink(
  tab: ReconciliationTab,
  page = 1,
  ownerDiscordId?: string,
) {
  const query = new URLSearchParams({ tab });
  if (
    (tab === "recharges" ||
      tab === "processed" ||
      tab === "exceptions" ||
      tab === "confirmed-receipts" ||
      tab === "paid-payouts" ||
      tab === "audit") &&
    page > 1
  ) {
    query.set("page", String(page));
  }
  if (ownerDiscordId) query.set("owner", ownerDiscordId);
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
  const requestedOwnerDiscordId =
    isFinance && typeof searchParams.owner === "string"
      ? searchParams.owner
      : undefined;
  const requestedPage =
    typeof searchParams.page === "string" ? Number(searchParams.page) : 1;
  const notice =
    typeof searchParams.notice === "string" ? searchParams.notice : "";
  const error =
    typeof searchParams.error === "string" ? searchParams.error : "";

  const [
    loadedAccounts,
    loadedManualRecharges,
    transfers,
    recoveries,
    payouts,
    withdrawals,
    auditEvents,
    zPayRechargeReferences,
    stripeRechargeReferences,
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
        dlmUser: {
          select: {
            manualWechatBoss: {
              select: { displayName: true, wechatContact: true },
            },
          },
        },
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
      include: {
        settlementPayout: true,
        dlmUser: {
          select: {
            manualWechatBoss: {
              select: { displayName: true, wechatContact: true },
            },
          },
        },
      },
    }),
    prisma.settlementReconciliationEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        reconciliation: {
          include: { account: true },
        },
      },
    }),
    prisma.zPayRechargeOrder.findMany({
      select: { outTradeNo: true, gatewayTradeNo: true },
    }),
    prisma.stripePayment.findMany({
      select: {
        outTradeNo: true,
        paymentIntentId: true,
        checkoutSessionId: true,
      },
    }),
  ]);

  const automatedRechargeReferences = new Set(
    [
      ...zPayRechargeReferences.flatMap((payment) => [
        payment.outTradeNo,
        payment.gatewayTradeNo,
      ]),
      ...stripeRechargeReferences.flatMap((payment) => [
        payment.outTradeNo,
        payment.paymentIntentId,
        payment.checkoutSessionId,
      ]),
    ].filter((reference): reference is string => Boolean(reference)),
  );
  const rawRecharges = loadedManualRecharges.filter(
    (recharge) => !automatedRechargeReferences.has(recharge.fromWhom),
  );

  const accounts = [...loadedAccounts].sort((left, right) => {
    const leftPriority = ACCOUNT_DISPLAY_PRIORITY.get(left.name) ?? 100;
    const rightPriority = ACCOUNT_DISPLAY_PRIORITY.get(right.name) ?? 100;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    if (left.active !== right.active) return left.active ? -1 : 1;
    return left.name.localeCompare(right.name, "zh-CN");
  });
  const relatedDiscordIds = Array.from(
    new Set(
      [
        ...rawRecharges.flatMap((recharge) => [
          recharge.toWhom,
          recharge.fromWhom,
        ]),
        ...withdrawals.map((withdrawal) => withdrawal.discordId),
        ...transfers.flatMap((transfer) => [
          transfer.initiatedBy,
          transfer.receiverConfirmedBy,
          transfer.receiverDisputedBy,
          transfer.canceledBy,
        ]),
        ...recoveries.map((recovery) => recovery.recordedBy),
        ...payouts.flatMap((payout) => [payout.paidBy, payout.voidedBy]),
        ...auditEvents.map((event) => event.actorDiscordId),
      ].filter((discordUserId): discordUserId is string =>
        Boolean(discordUserId),
      ),
    ),
  );
  const relatedMembers = relatedDiscordIds.length
    ? await prisma.member.findMany({
        where: { discordUserId: { in: relatedDiscordIds } },
        select: {
          discordUserId: true,
          serverDisplayName: true,
          discordUsername: true,
        },
      })
    : [];
  const relatedMemberByDiscordId = new Map(
    relatedMembers.map((member) => [member.discordUserId, member]),
  );
  const displayNameForDiscordId = (discordUserId?: string | null) => {
    const member = discordUserId
      ? relatedMemberByDiscordId.get(discordUserId)
      : null;
    return (
      member?.serverDisplayName?.trim() ||
      member?.discordUsername ||
      "资料待同步"
    );
  };

  const ownedAccounts = accounts.filter(
    (account) => account.ownerDiscordId === session.discordId,
  );
  if (!isFinance && !ownedAccounts.length) redirect("/");

  const ownerIds = Array.from(
    new Set(accounts.map((account) => account.ownerDiscordId)),
  );
  const viewedOwnerId = ownerIds.includes(requestedOwnerDiscordId ?? "")
    ? requestedOwnerDiscordId
    : undefined;
  const isOwnerReadOnlyView = Boolean(viewedOwnerId);
  const isAllFinanceView = isFinance && !isOwnerReadOnlyView;
  const currentOwnerId = viewedOwnerId ?? session.discordId;
  const allowedTabs: ReconciliationTab[] = isAllFinanceView
    ? [...tabs]
    : [
        "overview",
        "confirmations",
        "exceptions",
        "confirmed-receipts",
        "transfers",
        "payouts",
        "paid-payouts",
      ];
  const activeTab = allowedTabs.includes(requestedTab)
    ? requestedTab
    : "overview";
  const viewedOwnerAccounts = accounts.filter(
    (account) => account.ownerDiscordId === currentOwnerId,
  );
  const canActAsCurrentOwner =
    isFinance || currentOwnerId === session.discordId;
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
    .filter(
      ({ row }) => row && PROCESSED_RECONCILIATION_STATUSES.has(row.status),
    )
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
  const visibleOwners = isAllFinanceView
    ? ownerSummaryEntries
    : ownerSummaryEntries.filter((row) => row.ownerId === currentOwnerId);
  const visibleAccounts = isAllFinanceView ? accounts : viewedOwnerAccounts;
  const confirmationRows = pendingOwnerRows.filter(
    ({ row }) => isAllFinanceView || row?.ownerDiscordId === currentOwnerId,
  );
  const exceptionRows = disputedRows
    .filter(
      ({ row }) => isAllFinanceView || row?.ownerDiscordId === currentOwnerId,
    )
    .sort(
      ({ row: left }, { row: right }) =>
        (right?.ownerDisputedAt?.getTime() ?? right?.updatedAt.getTime() ?? 0) -
        (left?.ownerDisputedAt?.getTime() ?? left?.updatedAt.getTime() ?? 0),
    );
  const confirmedReceiptRows = rechargesWithRows
    .filter(
      ({ row }) =>
        row?.status === SettlementReconciliationStatus.OWNER_CONFIRMED &&
        (isAllFinanceView || row.ownerDiscordId === currentOwnerId),
    )
    .sort(
      ({ row: left }, { row: right }) =>
        (right?.ownerConfirmedAt?.getTime() ?? 0) -
        (left?.ownerConfirmedAt?.getTime() ?? 0),
    );
  const ownerTransferInbox = transfers.filter(
    (transfer) =>
      transfer.toAccount.ownerDiscordId === currentOwnerId &&
      transfer.status ===
        SettlementTransferStatus.PENDING_RECEIVER_CONFIRMATION,
  );
  const visibleTransfers = isAllFinanceView
    ? transfers.slice(0, 50)
    : transfers
        .filter(
          (transfer) =>
            transfer.fromAccount.ownerDiscordId === currentOwnerId ||
            transfer.toAccount.ownerDiscordId === currentOwnerId,
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
      ownerId === currentOwnerId && !withdrawal.settlementPayout,
  );
  const payoutRows = isAllFinanceView
    ? withdrawalItems.filter(({ withdrawal }) => !withdrawal.settlementPayout)
    : pendingPayouts;
  const paidPayoutRows = withdrawalItems
    .filter(
      ({ withdrawal, ownerId }) =>
        withdrawal.settlementPayout?.status === SettlementPayoutStatus.PAID &&
        (isAllFinanceView || ownerId === currentOwnerId),
    )
    .sort(
      ({ withdrawal: left }, { withdrawal: right }) =>
        (right.settlementPayout?.paidAt?.getTime() ?? 0) -
        (left.settlementPayout?.paidAt?.getTime() ?? 0),
    );
  const withdrawalById = new Map(
    withdrawals.map((withdrawal) => [withdrawal.id, withdrawal]),
  );
  const auditRows: AuditRow[] = [
    ...auditEvents.map((event) => ({
      id: `reconciliation-${event.id}`,
      occurredAt: event.createdAt,
      category: "充值对账",
      action: statusLabel[event.toStatus],
      subject: `充值 ${event.reconciliation.rechargeId}${event.reconciliation.account ? ` · ${event.reconciliation.account.name}` : ""}`,
      amount: event.reconciliation.rmbAmount,
      actorDiscordId: event.actorDiscordId,
      note: event.note,
    })),
    ...transfers.flatMap((transfer) => {
      const subject = `${transfer.fromAccount.name} → ${transfer.toAccount.name}`;
      const entries: AuditRow[] = [
        {
          id: `transfer-created-${transfer.id}`,
          occurredAt: transfer.createdAt,
          category: "内部转账",
          action: "发起转账",
          subject,
          amount: transfer.amount,
          actorDiscordId: transfer.initiatedBy,
          note: null,
        },
      ];
      if (transfer.receiverConfirmedAt && transfer.receiverConfirmedBy) {
        entries.push({
          id: `transfer-confirmed-${transfer.id}`,
          occurredAt: transfer.receiverConfirmedAt,
          category: "内部转账",
          action: "收款人确认",
          subject,
          amount: transfer.amount,
          actorDiscordId: transfer.receiverConfirmedBy,
          note: null,
        });
      }
      if (transfer.receiverDisputedAt && transfer.receiverDisputedBy) {
        entries.push({
          id: `transfer-disputed-${transfer.id}`,
          occurredAt: transfer.receiverDisputedAt,
          category: "内部转账",
          action: "收款异常",
          subject,
          amount: transfer.amount,
          actorDiscordId: transfer.receiverDisputedBy,
          note: transfer.disputeReason,
        });
      }
      if (transfer.canceledAt && transfer.canceledBy) {
        entries.push({
          id: `transfer-canceled-${transfer.id}`,
          occurredAt: transfer.canceledAt,
          category: "内部转账",
          action: "已撤销",
          subject,
          amount: transfer.amount,
          actorDiscordId: transfer.canceledBy,
          note: null,
        });
      }
      return entries;
    }),
    ...recoveries.map((recovery) => ({
      id: `forex-${recovery.id}`,
      occurredAt: recovery.recoveredAt,
      category: "外汇归还",
      action: "登记归还",
      subject: `${recovery.fromAccount.name} → ${recovery.toAccount.name}`,
      amount: recovery.rmbAmount,
      actorDiscordId: recovery.recordedBy,
      note: `${formatAmountDown2(recovery.foreignAmount)} ${recovery.foreignCurrency}${recovery.note ? ` · ${recovery.note}` : ""}`,
    })),
    ...payouts.flatMap((payout) => {
      const withdrawal = withdrawalById.get(payout.withdrawalId);
      const subject = `${withdrawal?.method.split(":")[0] ?? "提现"} · 提现 ${payout.withdrawalId}`;
      const entries: AuditRow[] = [
        {
          id: `payout-paid-${payout.id}`,
          occurredAt: payout.paidAt,
          category: "提现发放",
          action: "标记已发放",
          subject,
          amount: payout.amount,
          actorDiscordId: payout.paidBy,
          note: null,
        },
      ];
      if (payout.voidedAt && payout.voidedBy) {
        entries.push({
          id: `payout-voided-${payout.id}`,
          occurredAt: payout.voidedAt,
          category: "提现发放",
          action: "撤销发放",
          subject,
          amount: payout.amount,
          actorDiscordId: payout.voidedBy,
          note: payout.voidReason,
        });
      }
      return entries;
    }),
  ].sort(
    (left, right) => right.occurredAt.getTime() - left.occurredAt.getTime(),
  );
  const activeOwnerSummary = ownerSummaryEntries.find(
    (row) => row.ownerId === currentOwnerId,
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
  const isHistoryListTab =
    activeTab === "confirmed-receipts" ||
    activeTab === "paid-payouts" ||
    activeTab === "exceptions" ||
    activeTab === "audit";
  const historyRowCount =
    activeTab === "confirmed-receipts"
      ? confirmedReceiptRows.length
      : activeTab === "paid-payouts"
        ? paidPayoutRows.length
        : activeTab === "exceptions"
          ? exceptionRows.length
          : activeTab === "audit"
            ? auditRows.length
            : 0;
  const historyPageCount = Math.max(
    1,
    Math.ceil(historyRowCount / RECHARGES_PER_PAGE),
  );
  const historyPage =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.min(Math.floor(requestedPage), historyPageCount)
      : 1;
  const confirmedReceiptSlice = confirmedReceiptRows.slice(
    (historyPage - 1) * RECHARGES_PER_PAGE,
    historyPage * RECHARGES_PER_PAGE,
  );
  const paidPayoutSlice = paidPayoutRows.slice(
    (historyPage - 1) * RECHARGES_PER_PAGE,
    historyPage * RECHARGES_PER_PAGE,
  );
  const exceptionSlice = exceptionRows.slice(
    (historyPage - 1) * RECHARGES_PER_PAGE,
    historyPage * RECHARGES_PER_PAGE,
  );
  const auditSlice = auditRows.slice(
    (historyPage - 1) * RECHARGES_PER_PAGE,
    historyPage * RECHARGES_PER_PAGE,
  );
  const redirectTo =
    activeTab === "recharges" ||
    activeTab === "processed" ||
    activeTab === "exceptions" ||
    activeTab === "confirmed-receipts" ||
    activeTab === "paid-payouts" ||
    activeTab === "audit"
      ? sectionLink(
          activeTab,
          isHistoryListTab ? historyPage : rechargePage,
          viewedOwnerId,
        )
      : sectionLink(activeTab, 1, viewedOwnerId);
  const tabItems = (
    isAllFinanceView
      ? [
          ["overview", "总览", 0],
          ["recharges", "充值处理", pendingFinanceCount],
          ["processed", "已处理充值", processedRechargeRows.length],
          ["confirmations", "负责人确认", pendingOwnerRows.length],
          ["exceptions", "异常处理", exceptionRows.length],
          ["confirmed-receipts", "已确认收款", confirmedReceiptRows.length],
          ["transfers", "内部转账", 0],
          ["payouts", "提现发放", payoutRows.length],
          ["paid-payouts", "已发提现", paidPayoutRows.length],
          ["forex", "外汇归还", 0],
          ["audit", "操作审计", auditRows.length],
        ]
      : [
          [
            "overview",
            isOwnerReadOnlyView
              ? `${ownerName(currentOwnerId)}的收款账号`
              : "我的收款账号",
            0,
          ],
          [
            "confirmations",
            isOwnerReadOnlyView ? "待确认收款" : "待我确认",
            confirmationRows.length,
          ],
          ["exceptions", "未收到 / 金额不符", exceptionRows.length],
          ["confirmed-receipts", "已确认收款", confirmedReceiptRows.length],
          ["transfers", "内部转账", ownerTransferInbox.length],
          [
            "payouts",
            isOwnerReadOnlyView ? "待发提现" : "待我发放",
            pendingPayouts.length,
          ],
          ["paid-payouts", "已发提现", paidPayoutRows.length],
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
                href={sectionLink(tab, 1, viewedOwnerId)}
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

        {isFinance ? (
          <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <span className="mr-1 text-sm text-white/55">负责人页面：</span>
            <Link
              href={sectionLink("overview")}
              className={`rounded-xl border px-3 py-2 text-sm transition ${isAllFinanceView ? "border-[#a78bfa]/60 bg-[#7356c6]/25 text-white" : "border-white/10 text-white/65 hover:bg-white/10"}`}
            >
              全部主财务视图
            </Link>
            {ownerSummaryEntries.map((owner) => (
              <Link
                key={owner.ownerId}
                href={sectionLink("overview", 1, owner.ownerId)}
                className={`rounded-xl border px-3 py-2 text-sm transition ${viewedOwnerId === owner.ownerId ? "border-[#a78bfa]/60 bg-[#7356c6]/25 text-white" : "border-white/10 text-white/65 hover:bg-white/10"}`}
              >
                {ownerName(owner.ownerId)}
              </Link>
            ))}
            {isOwnerReadOnlyView ? (
              <span className="ml-1 text-xs text-amber-100/80">
                {canActAsCurrentOwner
                  ? "主财务可代办该负责人的操作；操作记录会保留为主财务。"
                  : "只读查看；实际操作仍须由对应负责人登录。"}
              </span>
            ) : null}
          </section>
        ) : null}

        {activeTab === "overview" ? (
          <>
            <section className="grid gap-4 xl:grid-cols-4">
              {isAllFinanceView ? (
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
                      异常暂时仍计入；请在“异常处理”核对后重新确认或标无效。
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
                    <p className="text-sm text-[#ddd6fe]">
                      {isOwnerReadOnlyView
                        ? `${ownerName(currentOwnerId)}的负责人应有总额`
                        : "我的负责人应有总额"}
                    </p>
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
                    <p className="text-sm text-amber-100/80">
                      {isOwnerReadOnlyView ? "待确认收款" : "待我确认收款"}
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-amber-50">
                      {confirmationRows.length} 笔
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[#c4b5fd]/25 bg-[#7356c6]/10 p-5">
                    <p className="text-sm text-[#ddd6fe]">
                      {isOwnerReadOnlyView ? "待发放提现" : "待我发放提现"}
                    </p>
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
                    {isAllFinanceView ? "负责人资金总览" : "我的资金总览"}
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
                {isAllFinanceView ? (
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

            {isAllFinanceView ? (
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

        {(activeTab === "recharges" || activeTab === "processed") &&
        isAllFinanceView ? (
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
                      {positiveCashRows.length} · 扣减 {negativeCashRows.length}
                      ）
                    </p>
                    <p className="mt-1 text-amber-100">
                      待处理 {pendingFinanceCount} 笔 · 异常{" "}
                      {disputedRows.length} 笔
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
                    {isProcessedRechargeTab ? (
                      <>
                        <th className="px-3 py-3">对账状态</th>
                        <th className="px-3 py-3">凭证</th>
                      </>
                    ) : null}
                    <th className="px-3 py-3">
                      {isProcessedRechargeTab ? "最后处理 / 操作" : "本笔处理"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rechargeSlice.map(({ recharge, row }) => {
                    const isNegativeCash = recharge.amount.lt(0);
                    const boss = recharge.toWhom
                      ? relatedMemberByDiscordId.get(recharge.toWhom)
                      : null;
                    const wechatBoss = !boss
                      ? recharge.dlmUser?.manualWechatBoss
                      : null;

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
                            来源 {displayNameForDiscordId(recharge.fromWhom)}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-xs">
                          <BossIdentity discord={boss} wechat={wechatBoss} />
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
                        {isProcessedRechargeTab ? (
                          <>
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
                                  {row.financeNote ? (
                                    <p className="mt-2 max-w-52 whitespace-pre-wrap text-xs text-amber-100/80">
                                      财务备注：{row.financeNote}
                                    </p>
                                  ) : null}
                                  <p className="mt-2 text-xs text-white/45">
                                    最后处理：
                                    {formatDate(
                                      row.ownerConfirmedAt ??
                                        row.invalidatedAt ??
                                        row.financeConfirmedAt ??
                                        row.updatedAt,
                                    )}
                                  </p>
                                </>
                              ) : null}
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
                          </>
                        ) : null}
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
                                <label className="block">
                                  <span className="mb-1.5 block text-xs text-white/55">
                                    给负责人备注（可选，负责人确认收款时可见）
                                  </span>
                                  <input
                                    name="financeNote"
                                    defaultValue={row?.financeNote ?? ""}
                                    placeholder="例如：请核对 10 月 6 日的微信到账"
                                    maxLength={500}
                                    className={fieldClass}
                                  />
                                </label>
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
                  href={sectionLink(
                    activeTab,
                    Math.max(1, rechargePage - 1),
                    viewedOwnerId,
                  )}
                  className={`rounded-lg border px-3 py-2 ${rechargePage <= 1 ? "pointer-events-none border-white/5 text-white/25" : "border-white/15 hover:bg-white/10"}`}
                >
                  上一页
                </Link>
                <Link
                  aria-disabled={rechargePage >= rechargePageCount}
                  href={sectionLink(
                    activeTab,
                    Math.min(rechargePageCount, rechargePage + 1),
                    viewedOwnerId,
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
                    {isAllFinanceView
                      ? "负责人收款确认总览"
                      : isOwnerReadOnlyView
                        ? `${ownerName(currentOwnerId)}待确认的收款`
                        : "等待我确认的收款"}
                  </h2>
                  <p className="mt-1 text-sm text-amber-100/75">
                    {isAllFinanceView
                      ? "主财务可查看所有负责人待确认项，并可代办二次确认或提出异常；已反馈的异常请在“异常处理”查看。"
                      : isOwnerReadOnlyView && canActAsCurrentOwner
                        ? "主财务可代办确认或反馈异常；操作记录会保留为主财务。"
                        : "确认前请先核对你实际收款账号的到账记录。"}
                  </p>
                </div>
                <span className="text-sm text-amber-100">
                  待确认 {confirmationRows.length} 笔
                </span>
              </div>
              {confirmationRows.length ? (
                <div className="mt-4 overflow-x-auto rounded-2xl border border-amber-200/20 bg-black/20">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-amber-200/15 bg-amber-100/[0.03] text-xs text-amber-100/65">
                      <tr>
                        <th className="px-4 py-3 font-medium">收款账号</th>
                        <th className="px-4 py-3 font-medium">
                          老板 / 充值记录
                        </th>
                        <th className="px-4 py-3 font-medium">金额</th>
                        <th className="px-4 py-3 font-medium">转账截图</th>
                        <th className="px-4 py-3 font-medium">财务备注</th>
                        <th className="px-4 py-3 font-medium">时间</th>
                        <th className="px-4 py-3 font-medium">状态</th>
                        <th className="px-4 py-3 font-medium">处理</th>
                      </tr>
                    </thead>
                    <tbody>
                      {confirmationRows.map(({ recharge, row }, index) => {
                        if (!row) return null;
                        const boss = recharge.toWhom
                          ? relatedMemberByDiscordId.get(recharge.toWhom)
                          : null;
                        const wechatBoss = !boss
                          ? recharge.dlmUser?.manualWechatBoss
                          : null;

                        return (
                          <Fragment key={row.id}>
                            <LocalDayDivider
                              date={recharge.createdAt.toISOString()}
                              previousDate={confirmationRows[
                                index - 1
                              ]?.recharge.createdAt.toISOString()}
                              colSpan={8}
                            />
                            <tr className="border-b border-white/5 align-top last:border-0">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <p className="font-medium">
                                  {row.account?.name ?? "账号已停用"}
                                </p>
                                <p className="mt-1 text-xs text-amber-100/70">
                                  <OwnerIdentity
                                    ownerId={row.ownerDiscordId ?? ""}
                                    compact
                                  />
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-xs">
                                  <BossIdentity
                                    discord={boss}
                                    wechat={wechatBoss}
                                  />
                                </div>
                                <p className="mt-1 text-xs text-white/45">
                                  充值 {recharge.RechargeID}
                                </p>
                              </td>
                              <td className="px-4 py-3 font-medium whitespace-nowrap">
                                {formatMoney(row.rmbAmount)}
                              </td>
                              <td className="px-4 py-3">
                                {row.evidence.length ? (
                                  <div className="flex min-w-28 flex-wrap gap-2">
                                    {row.evidence.map((evidence) => (
                                      <a
                                        key={evidence.id}
                                        href={`/api/admin/cash-reconciliation/evidence/${evidence.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="点击放大查看转账截图"
                                        className="block overflow-hidden rounded-lg border border-white/15 bg-black/30 transition hover:border-[#c4b5fd]/70"
                                      >
                                        <img
                                          src={`/api/admin/cash-reconciliation/evidence/${evidence.id}`}
                                          alt="转账截图"
                                          className="h-14 w-14 object-cover"
                                        />
                                      </a>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-rose-200">
                                    未上传
                                  </span>
                                )}
                              </td>
                              <td className="max-w-56 px-4 py-3 text-xs whitespace-pre-wrap text-amber-100/80">
                                {row.financeNote ?? "—"}
                              </td>
                              <td className="px-4 py-3 text-xs text-white/60 whitespace-nowrap">
                                {formatDate(recharge.createdAt)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <StatusBadge status={row.status} />
                              </td>
                              <td className="px-4 py-3">
                                {isFinance ||
                                row.ownerDiscordId === session.discordId ? (
                                  <div className="flex min-w-52 flex-wrap gap-2">
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
                                        className="mt-2 grid min-w-52 gap-2"
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
                                  <span className="text-xs text-white/45">
                                    等待 {ownerName(row.ownerDiscordId ?? "")}{" "}
                                    操作
                                  </span>
                                )}
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-amber-100/70">
                  没有待确认的收款。
                </p>
              )}
            </section>
          </>
        ) : null}

        {activeTab === "exceptions" ? (
          <section className="rounded-3xl border border-rose-300/25 bg-rose-300/10 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-rose-50">
                  未收到 / 金额不符
                </h2>
                <p className="mt-1 text-sm text-rose-100/75">
                  负责人反馈异常后，款项暂时仍计入实收和负责人应有总额。主财务核对后可重新列为待确认，或确认无效。
                </p>
              </div>
              <span className="text-sm text-rose-100">
                异常 {exceptionRows.length} 笔
              </span>
            </div>
            {exceptionSlice.length ? (
              <>
                <div className="mt-4 overflow-x-auto rounded-2xl border border-rose-200/20 bg-black/20">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-rose-200/15 bg-rose-100/[0.03] text-xs text-rose-100/65">
                      <tr>
                        <th className="px-4 py-3 font-medium">收款账号</th>
                        <th className="px-4 py-3 font-medium">
                          老板 / 充值记录
                        </th>
                        <th className="px-4 py-3 font-medium">金额</th>
                        <th className="px-4 py-3 font-medium">转账截图</th>
                        <th className="px-4 py-3 font-medium">财务备注</th>
                        <th className="px-4 py-3 font-medium">异常反馈</th>
                        <th className="px-4 py-3 font-medium">处理</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exceptionSlice.map(({ recharge, row }) => {
                        if (!row) return null;
                        const boss = recharge.toWhom
                          ? relatedMemberByDiscordId.get(recharge.toWhom)
                          : null;
                        const wechatBoss = !boss
                          ? recharge.dlmUser?.manualWechatBoss
                          : null;

                        return (
                          <tr
                            key={row.id}
                            className="border-b border-white/5 align-top last:border-0"
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="font-medium">
                                {row.account?.name ?? "账号已停用"}
                              </p>
                              <p className="mt-1 text-xs text-rose-100/70">
                                <OwnerIdentity
                                  ownerId={row.ownerDiscordId ?? ""}
                                  compact
                                />
                              </p>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <BossIdentity
                                discord={boss}
                                wechat={wechatBoss}
                              />
                              <p className="mt-1 text-white/45">
                                充值 {recharge.RechargeID}
                              </p>
                            </td>
                            <td className="px-4 py-3 font-medium whitespace-nowrap">
                              {formatMoney(row.rmbAmount)}
                            </td>
                            <td className="px-4 py-3">
                              {row.evidence.length ? (
                                <div className="flex min-w-28 flex-wrap gap-2">
                                  {row.evidence.map((evidence) => (
                                    <a
                                      key={evidence.id}
                                      href={`/api/admin/cash-reconciliation/evidence/${evidence.id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="点击放大查看转账截图"
                                      className="block overflow-hidden rounded-lg border border-white/15 bg-black/30 transition hover:border-[#c4b5fd]/70"
                                    >
                                      <img
                                        src={`/api/admin/cash-reconciliation/evidence/${evidence.id}`}
                                        alt="转账截图"
                                        className="h-14 w-14 object-cover"
                                      />
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-white/40">
                                  未上传
                                </span>
                              )}
                            </td>
                            <td className="max-w-56 px-4 py-3 text-xs whitespace-pre-wrap text-amber-100/80">
                              {row.financeNote ?? "—"}
                            </td>
                            <td className="max-w-64 px-4 py-3 text-xs text-rose-100/85">
                              <p className="whitespace-pre-wrap">
                                {row.exceptionReason ?? "未填写原因"}
                              </p>
                              <p className="mt-2 text-rose-100/60">
                                {displayNameForDiscordId(row.ownerDisputedBy)} ·{" "}
                                {formatDate(row.ownerDisputedAt)}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              {isFinance ? (
                                <div className="flex min-w-52 flex-col gap-2">
                                  <details>
                                    <summary className="cursor-pointer rounded-lg bg-amber-300/15 px-3 py-2 text-center text-xs text-amber-50 hover:bg-amber-300/25">
                                      复核后仍计入实收
                                    </summary>
                                    <form
                                      action={ACTION_URL}
                                      method="post"
                                      className="mt-2 grid gap-2"
                                    >
                                      <input
                                        type="hidden"
                                        name="action"
                                        value="finance-retry-confirm"
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
                                        name="note"
                                        placeholder="复核说明（会再次等待负责人确认）"
                                        className={fieldClass}
                                      />
                                      <button className="rounded-lg bg-amber-300/20 px-3 py-2 text-xs text-amber-50">
                                        提交复核
                                      </button>
                                    </form>
                                  </details>
                                  <details>
                                    <summary className="cursor-pointer rounded-lg border border-rose-300/35 px-3 py-2 text-center text-xs text-rose-100 hover:bg-rose-300/10">
                                      财务确认无效
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
                                        placeholder="确认无效的原因"
                                        className={fieldClass}
                                      />
                                      <button className="rounded-lg bg-rose-400/20 px-3 py-2 text-xs text-rose-50">
                                        确认无效
                                      </button>
                                    </form>
                                  </details>
                                </div>
                              ) : (
                                <span className="text-xs text-rose-100/70">
                                  已反馈主财务，等待核对。
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-sm text-rose-100/75">
                  <span>
                    第 {historyPage} / {historyPageCount} 页，每页{" "}
                    {RECHARGES_PER_PAGE} 笔
                  </span>
                  <div className="flex gap-2">
                    <Link
                      aria-disabled={historyPage <= 1}
                      href={sectionLink(
                        activeTab,
                        Math.max(1, historyPage - 1),
                        viewedOwnerId,
                      )}
                      className={`rounded-lg border px-3 py-2 ${historyPage <= 1 ? "pointer-events-none border-rose-200/10 text-rose-100/30" : "border-rose-200/30 hover:bg-rose-300/10"}`}
                    >
                      上一页
                    </Link>
                    <Link
                      aria-disabled={historyPage >= historyPageCount}
                      href={sectionLink(
                        activeTab,
                        Math.min(historyPageCount, historyPage + 1),
                        viewedOwnerId,
                      )}
                      className={`rounded-lg border px-3 py-2 ${historyPage >= historyPageCount ? "pointer-events-none border-rose-200/10 text-rose-100/30" : "border-rose-200/30 hover:bg-rose-300/10"}`}
                    >
                      下一页
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-rose-100/70">
                当前没有“未收到 / 金额不符”的反馈。
              </p>
            )}
          </section>
        ) : null}

        {activeTab === "audit" && isAllFinanceView ? (
          <section className={cardClass}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">操作审计</h2>
                <p className="mt-1 text-sm text-white/60">
                  按时间倒序展示已落库的充值对账、内部转账、外汇归还及提现发放操作；充值对账最多保留最近
                  500 条状态记录。
                </p>
              </div>
              <span className="text-sm text-white/60">
                共 {auditRows.length} 条
              </span>
            </div>
            {auditSlice.length ? (
              <>
                <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-white/10 bg-white/[0.03] text-xs text-white/55">
                      <tr>
                        <th className="px-4 py-3 font-medium">时间</th>
                        <th className="px-4 py-3 font-medium">类别</th>
                        <th className="px-4 py-3 font-medium">操作</th>
                        <th className="px-4 py-3 font-medium">对象</th>
                        <th className="px-4 py-3 font-medium">金额</th>
                        <th className="px-4 py-3 font-medium">操作人</th>
                        <th className="px-4 py-3 font-medium">说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditSlice.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-white/5 align-top last:border-0"
                        >
                          <td className="px-4 py-3 text-xs text-white/60 whitespace-nowrap">
                            {formatDate(entry.occurredAt)}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#ddd6fe]">
                            {entry.category}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {entry.action}
                          </td>
                          <td className="px-4 py-3 text-xs text-white/75">
                            {entry.subject}
                          </td>
                          <td className="px-4 py-3 font-medium whitespace-nowrap">
                            {entry.amount ? formatMoney(entry.amount) : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-white/70 whitespace-nowrap">
                            {displayNameForDiscordId(entry.actorDiscordId)}
                          </td>
                          <td className="max-w-96 px-4 py-3 text-xs whitespace-pre-wrap text-white/55">
                            {entry.note ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-sm text-white/60">
                  <span>
                    第 {historyPage} / {historyPageCount} 页，每页{" "}
                    {RECHARGES_PER_PAGE} 条
                  </span>
                  <div className="flex gap-2">
                    <Link
                      aria-disabled={historyPage <= 1}
                      href={sectionLink(
                        activeTab,
                        Math.max(1, historyPage - 1),
                      )}
                      className={`rounded-lg border px-3 py-2 ${historyPage <= 1 ? "pointer-events-none border-white/5 text-white/25" : "border-white/15 hover:bg-white/10"}`}
                    >
                      上一页
                    </Link>
                    <Link
                      aria-disabled={historyPage >= historyPageCount}
                      href={sectionLink(
                        activeTab,
                        Math.min(historyPageCount, historyPage + 1),
                      )}
                      className={`rounded-lg border px-3 py-2 ${historyPage >= historyPageCount ? "pointer-events-none border-white/5 text-white/25" : "border-white/15 hover:bg-white/10"}`}
                    >
                      下一页
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-white/50">
                暂时没有可展示的操作记录。
              </p>
            )}
          </section>
        ) : null}

        {activeTab === "confirmed-receipts" ? (
          <section className="rounded-3xl border border-emerald-300/25 bg-emerald-300/10 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-emerald-50">
                  {isAllFinanceView
                    ? "全部负责人已确认收款"
                    : isOwnerReadOnlyView
                      ? `${ownerName(currentOwnerId)}已确认的收款`
                      : "我已确认的收款"}
                </h2>
                <p className="mt-1 text-sm text-emerald-100/75">
                  仅保留负责人确认已收到的款项，按确认时间倒序；截图和财务备注可继续查看。
                </p>
              </div>
              <span className="text-sm text-emerald-100">
                已确认 {confirmedReceiptRows.length} 笔
              </span>
            </div>
            {confirmedReceiptSlice.length ? (
              <>
                <div className="mt-4 overflow-x-auto rounded-2xl border border-emerald-200/20 bg-black/20">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-emerald-200/15 bg-emerald-100/[0.03] text-xs text-emerald-100/65">
                      <tr>
                        <th className="px-4 py-3 font-medium">收款账号</th>
                        <th className="px-4 py-3 font-medium">
                          老板 / 充值记录
                        </th>
                        <th className="px-4 py-3 font-medium">金额</th>
                        <th className="px-4 py-3 font-medium">转账截图</th>
                        <th className="px-4 py-3 font-medium">财务备注</th>
                        <th className="px-4 py-3 font-medium">确认时间</th>
                        <th className="px-4 py-3 font-medium">确认人</th>
                      </tr>
                    </thead>
                    <tbody>
                      {confirmedReceiptSlice.map(({ recharge, row }) => {
                        if (!row) return null;
                        const boss = recharge.toWhom
                          ? relatedMemberByDiscordId.get(recharge.toWhom)
                          : null;
                        const wechatBoss = !boss
                          ? recharge.dlmUser?.manualWechatBoss
                          : null;

                        return (
                          <tr
                            key={row.id}
                            className="border-b border-white/5 align-top last:border-0"
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="font-medium">
                                {row.account?.name ?? "账号已停用"}
                              </p>
                              <p className="mt-1 text-xs text-emerald-100/70">
                                <OwnerIdentity
                                  ownerId={row.ownerDiscordId ?? ""}
                                  compact
                                />
                              </p>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <BossIdentity
                                discord={boss}
                                wechat={wechatBoss}
                              />
                              <p className="mt-1 text-white/45">
                                充值 {recharge.RechargeID}
                              </p>
                            </td>
                            <td className="px-4 py-3 font-medium whitespace-nowrap">
                              {formatMoney(row.rmbAmount)}
                            </td>
                            <td className="px-4 py-3">
                              {row.evidence.length ? (
                                <div className="flex min-w-28 flex-wrap gap-2">
                                  {row.evidence.map((evidence) => (
                                    <a
                                      key={evidence.id}
                                      href={`/api/admin/cash-reconciliation/evidence/${evidence.id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="点击放大查看转账截图"
                                      className="block overflow-hidden rounded-lg border border-white/15 bg-black/30 transition hover:border-[#c4b5fd]/70"
                                    >
                                      <img
                                        src={`/api/admin/cash-reconciliation/evidence/${evidence.id}`}
                                        alt="转账截图"
                                        className="h-14 w-14 object-cover"
                                      />
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-white/40">
                                  未上传
                                </span>
                              )}
                            </td>
                            <td className="max-w-56 px-4 py-3 text-xs whitespace-pre-wrap text-emerald-100/80">
                              {row.financeNote ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-white/60 whitespace-nowrap">
                              {formatDate(row.ownerConfirmedAt)}
                            </td>
                            <td className="px-4 py-3 text-xs text-white/70 whitespace-nowrap">
                              {displayNameForDiscordId(row.ownerConfirmedBy)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-sm text-emerald-100/75">
                  <span>
                    第 {historyPage} / {historyPageCount} 页，每页{" "}
                    {RECHARGES_PER_PAGE} 笔
                  </span>
                  <div className="flex gap-2">
                    <Link
                      aria-disabled={historyPage <= 1}
                      href={sectionLink(
                        activeTab,
                        Math.max(1, historyPage - 1),
                        viewedOwnerId,
                      )}
                      className={`rounded-lg border px-3 py-2 ${historyPage <= 1 ? "pointer-events-none border-white/5 text-white/25" : "border-white/15 hover:bg-white/10"}`}
                    >
                      上一页
                    </Link>
                    <Link
                      aria-disabled={historyPage >= historyPageCount}
                      href={sectionLink(
                        activeTab,
                        Math.min(historyPageCount, historyPage + 1),
                        viewedOwnerId,
                      )}
                      className={`rounded-lg border px-3 py-2 ${historyPage >= historyPageCount ? "pointer-events-none border-white/5 text-white/25" : "border-white/15 hover:bg-white/10"}`}
                    >
                      下一页
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-emerald-100/70">
                当前没有已确认收款。
              </p>
            )}
          </section>
        ) : null}

        {activeTab === "transfers" ? (
          <>
            {viewedOwnerAccounts.filter(
              (account) => account.active && isRmbCurrency(account.currency),
            ).length ? (
              <section className="grid gap-5 xl:grid-cols-2">
                <div className={cardClass}>
                  <h2 className="text-xl font-semibold">
                    {canActAsCurrentOwner
                      ? isFinance && isOwnerReadOnlyView
                        ? `代 ${ownerName(currentOwnerId)} 发起内部人民币转账`
                        : "发起内部人民币转账"
                      : `${ownerName(currentOwnerId)}的内部转账`}
                  </h2>
                  <p className="mt-1 text-sm text-white/60">
                    {canActAsCurrentOwner
                      ? isFinance && isOwnerReadOnlyView
                        ? "主财务可从当前负责人的人民币账号发起转账；收款人确认前不计入双方总额。"
                        : "只能从你负责的人民币账号转入其他负责人的人民币账号；收款人确认前不计入双方总额。"
                      : "正在只读查看该负责人的人民币转账；实际发起与确认仍须由对应负责人登录。"}
                  </p>
                  {canActAsCurrentOwner ? (
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
                      <input
                        type="hidden"
                        name="redirectTo"
                        value={redirectTo}
                      />
                      <select
                        required
                        name="fromAccountId"
                        defaultValue=""
                        className={fieldClass}
                      >
                        <option value="" disabled>
                          转出账号
                        </option>
                        {viewedOwnerAccounts
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
                              account.ownerDiscordId !== currentOwnerId,
                          )
                          .map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name} ·{" "}
                              {ownerName(account.ownerDiscordId)}
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
                  ) : null}
                </div>
                <div className={cardClass}>
                  <h2 className="text-xl font-semibold">
                    {isOwnerReadOnlyView
                      ? `${ownerName(currentOwnerId)}待确认的内部转账`
                      : "等待我确认的内部转账"}
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
                            发起人{" "}
                            {displayNameForDiscordId(transfer.initiatedBy)} ·{" "}
                            {formatDate(transfer.createdAt)}
                          </p>
                          {canActAsCurrentOwner ? (
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
                          ) : (
                            <p className="mt-3 text-xs text-white/45">
                              等待 {ownerName(currentOwnerId)} 确认。
                            </p>
                          )}
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
                    {isAllFinanceView
                      ? "全部负责人内部转账流水"
                      : isOwnerReadOnlyView
                        ? `${ownerName(currentOwnerId)}的内部转账流水`
                        : "我的内部转账流水"}
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
                  {isAllFinanceView
                    ? "全部负责人待发提现"
                    : isOwnerReadOnlyView
                      ? `${ownerName(currentOwnerId)}待发的提现`
                      : "待我发放的提现"}
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
              <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-white/[0.03] text-xs text-white/55">
                    <tr>
                      <th className="px-4 py-3 font-medium">
                        提现记录 / 申请人
                      </th>
                      <th className="px-4 py-3 font-medium">提现方式</th>
                      <th className="px-4 py-3 font-medium">金额</th>
                      <th className="px-4 py-3 font-medium">申请时间</th>
                      <th className="px-4 py-3 font-medium">负责人</th>
                      <th className="px-4 py-3 font-medium">处理</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutRows.map(({ withdrawal, ownerId }) => {
                      const boss = withdrawal.discordId
                        ? relatedMemberByDiscordId.get(withdrawal.discordId)
                        : null;
                      const wechatBoss = !boss
                        ? withdrawal.dlmUser?.manualWechatBoss
                        : null;

                      return (
                        <tr
                          key={withdrawal.id}
                          className="border-b border-white/5 align-top last:border-0"
                        >
                          <td className="px-4 py-3 text-xs">
                            <p className="font-mono text-white/75">
                              提现 {withdrawal.id}
                            </p>
                            <div className="mt-1">
                              <BossIdentity
                                discord={boss}
                                wechat={wechatBoss}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {withdrawal.method.split(":")[0]}
                          </td>
                          <td className="px-4 py-3 font-medium whitespace-nowrap">
                            {formatMoney(withdrawal.amount)}
                          </td>
                          <td className="px-4 py-3 text-xs text-white/60 whitespace-nowrap">
                            {formatDate(withdrawal.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <OwnerIdentity ownerId={ownerId} compact />
                          </td>
                          <td className="px-4 py-3">
                            {isFinance || ownerId === session.discordId ? (
                              <form action={ACTION_URL} method="post">
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
                              <span className="text-xs text-white/45">
                                等待 {ownerName(ownerId)} 发放
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#ddd6fe]/75">
                当前没有待发提现。
              </p>
            )}
          </section>
        ) : null}

        {activeTab === "paid-payouts" ? (
          <section className={cardClass}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  {isAllFinanceView
                    ? "全部负责人已发提现"
                    : isOwnerReadOnlyView
                      ? `${ownerName(currentOwnerId)}已发的提现`
                      : "我已发的提现"}
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  仅保留实际标记为已发放的提现，金额已从对应负责人的应有总额扣除。
                </p>
              </div>
              <span className="text-sm text-white/60">
                已发 {paidPayoutRows.length} 笔
              </span>
            </div>
            {paidPayoutSlice.length ? (
              <>
                <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-white/10 bg-white/[0.03] text-xs text-white/55">
                      <tr>
                        <th className="px-4 py-3 font-medium">
                          提现记录 / 申请人
                        </th>
                        <th className="px-4 py-3 font-medium">提现方式</th>
                        <th className="px-4 py-3 font-medium">金额</th>
                        <th className="px-4 py-3 font-medium">负责人</th>
                        <th className="px-4 py-3 font-medium">实际发放人</th>
                        <th className="px-4 py-3 font-medium">发放时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paidPayoutSlice.map(({ withdrawal, ownerId }) => {
                        const payout = withdrawal.settlementPayout;
                        if (!payout) return null;
                        const boss = withdrawal.discordId
                          ? relatedMemberByDiscordId.get(withdrawal.discordId)
                          : null;
                        const wechatBoss = !boss
                          ? withdrawal.dlmUser?.manualWechatBoss
                          : null;

                        return (
                          <tr
                            key={withdrawal.id}
                            className="border-b border-white/5 align-top last:border-0"
                          >
                            <td className="px-4 py-3 text-xs">
                              <p className="font-mono text-white/75">
                                提现 {withdrawal.id}
                              </p>
                              <div className="mt-1">
                                <BossIdentity
                                  discord={boss}
                                  wechat={wechatBoss}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {withdrawal.method.split(":")[0]}
                            </td>
                            <td className="px-4 py-3 font-medium whitespace-nowrap">
                              {formatMoney(payout.amount)}
                            </td>
                            <td className="px-4 py-3">
                              <OwnerIdentity ownerId={ownerId} compact />
                            </td>
                            <td className="px-4 py-3 text-xs text-white/70 whitespace-nowrap">
                              {displayNameForDiscordId(payout.paidBy)}
                            </td>
                            <td className="px-4 py-3 text-xs text-white/60 whitespace-nowrap">
                              {formatDate(payout.paidAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-sm text-white/60">
                  <span>
                    第 {historyPage} / {historyPageCount} 页，每页{" "}
                    {RECHARGES_PER_PAGE} 笔
                  </span>
                  <div className="flex gap-2">
                    <Link
                      aria-disabled={historyPage <= 1}
                      href={sectionLink(
                        activeTab,
                        Math.max(1, historyPage - 1),
                        viewedOwnerId,
                      )}
                      className={`rounded-lg border px-3 py-2 ${historyPage <= 1 ? "pointer-events-none border-white/5 text-white/25" : "border-white/15 hover:bg-white/10"}`}
                    >
                      上一页
                    </Link>
                    <Link
                      aria-disabled={historyPage >= historyPageCount}
                      href={sectionLink(
                        activeTab,
                        Math.min(historyPageCount, historyPage + 1),
                        viewedOwnerId,
                      )}
                      className={`rounded-lg border px-3 py-2 ${historyPage >= historyPageCount ? "pointer-events-none border-white/5 text-white/25" : "border-white/15 hover:bg-white/10"}`}
                    >
                      下一页
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-white/50">当前没有已发提现。</p>
            )}
          </section>
        ) : null}

        {activeTab === "forex" && isAllFinanceView ? (
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
