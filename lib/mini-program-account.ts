import { MiniAvailabilityStatus, OrderStatus, PeiwanStatus, Prisma } from '@prisma/client';
import type { CurrentDlmUser } from '@/lib/current-dlm-user';
import { postInternalBot } from '@/lib/internal-bot';
import { formatPeiwanGameProfile } from '@/lib/peiwan/gameProfiles';
import { prisma } from '@/lib/prisma';
import { NEW_ENTITY_OPERATIONS_STARTED_AT, newEntityOnlyTime } from '@/lib/operating-entity-cutover';
import { formatTransactionType } from '@/lib/transaction-display';
import { notifyMiniProgramUser } from '@/lib/mini-program-subscribe';

const ORDER_TAKE_LIMIT = 100;
const TRANSACTION_TAKE_LIMIT = 100;

const availabilityLabels: Record<MiniAvailabilityStatus, string> = {
  AVAILABLE: '可接',
  BUSY: '忙碌',
  RESTING: '休息',
};

const availabilityByInput: Record<string, MiniAvailabilityStatus> = {
  AVAILABLE: MiniAvailabilityStatus.AVAILABLE,
  BUSY: MiniAvailabilityStatus.BUSY,
  RESTING: MiniAvailabilityStatus.RESTING,
  可接: MiniAvailabilityStatus.AVAILABLE,
  忙碌: MiniAvailabilityStatus.BUSY,
  休息: MiniAvailabilityStatus.RESTING,
};

function displayName(user: {
  dlmId?: string | null;
  discordDisplayName?: string | null;
  wechatDisplayName?: string | null;
  member?: { serverDisplayName?: string | null } | null;
} | null | undefined) {
  return user?.discordDisplayName || user?.member?.serverDisplayName || user?.wechatDisplayName || '用户';
}

async function hasRunningWorkerOrder(currentUser: CurrentDlmUser) {
  if (!currentUser.discordUserId) return false;
  return Boolean(await prisma.order.findFirst({
    where: { workerId: currentUser.discordUserId, status: OrderStatus.RUNNING, createdAt: newEntityOnlyTime() },
    select: { id: true },
  }));
}

export async function getMiniAvailability(currentUser: CurrentDlmUser) {
  const forcedBusy = await hasRunningWorkerOrder(currentUser);
  const selected = currentUser.dlmUser.miniAvailabilitySetAt
    ? currentUser.dlmUser.miniAvailability
    : MiniAvailabilityStatus.RESTING;
  const effective = forcedBusy ? MiniAvailabilityStatus.BUSY : selected;
  return {
    selected,
    selectedLabel: availabilityLabels[selected],
    effective,
    effectiveLabel: availabilityLabels[effective],
    forcedBusy,
    canGrab: Boolean(currentUser.discordUserId && currentUser.dlmUser.member?.status === 'PEIWAN' && !forcedBusy),
  };
}

export async function setMiniAvailability(currentUser: CurrentDlmUser, rawStatus: unknown) {
  const normalized = availabilityByInput[String(rawStatus || '').trim().toUpperCase()] ?? availabilityByInput[String(rawStatus || '').trim()];
  if (!normalized) {
    return { ok: false, status: 400, error: 'invalid_availability' } as const;
  }

  const forcedBusy = await hasRunningWorkerOrder(currentUser);
  if (forcedBusy && normalized === MiniAvailabilityStatus.AVAILABLE) {
    return { ok: false, status: 409, error: 'running_order_forces_busy' } as const;
  }

  await prisma.$transaction(async (tx) => {
    await tx.dlmUser.update({
      where: { dlmId: currentUser.dlmId },
      data: { miniAvailability: normalized, miniAvailabilitySetAt: new Date() },
    });

    if (currentUser.discordUserId && currentUser.dlmUser.member?.status === 'PEIWAN') {
      await tx.pEIWAN.updateMany({
        where: { discordUserId: currentUser.discordUserId },
        data: { status: normalized === MiniAvailabilityStatus.AVAILABLE && !forcedBusy ? PeiwanStatus.free : PeiwanStatus.busy },
      });
    }
  });

  const effective = forcedBusy ? MiniAvailabilityStatus.BUSY : normalized;
  return {
    ok: true,
    availability: {
      selected: normalized,
      selectedLabel: availabilityLabels[normalized],
      effective,
      effectiveLabel: availabilityLabels[effective],
      forcedBusy,
    },
  } as const;
}

function serializeOrder(order: Prisma.OrderGetPayload<{
  include: {
    hostDlmUser: { include: { member: true } };
    worker: true;
    peiwan: true;
  };
}>, currentUser: CurrentDlmUser) {
  const isHost = order.hostDlmId === currentUser.dlmId || Boolean(currentUser.discordUserId && order.hostId === currentUser.discordUserId);
  const isWorker = Boolean(currentUser.discordUserId && order.workerId === currentUser.discordUserId);
  const actions: string[] = [];

  if (isWorker && order.status === OrderStatus.PENDING) actions.push('accept', 'decline');
  if (isHost && order.status === OrderStatus.PENDING) actions.push('cancel');
  if ((isHost || isWorker) && order.status === OrderStatus.RUNNING) actions.push('end');

  return {
    id: order.id,
    displayNo: order.displayNo,
    status: order.status,
    role: isHost ? '老板' : '陪玩',
    mode: order.mode,
    counterpartName: isHost
      ? order.peiwan.serverDisplayName || order.worker.serverDisplayName || `陪玩 #${order.peiwanId}`
      : displayName(order.hostDlmUser),
    peiwanId: order.peiwanId,
    quotationCode: order.quotationCode,
    unitPrice: order.unitPrice.toString(),
    createdAt: order.createdAt.toISOString(),
    acceptedAt: order.acceptedAt?.toISOString() ?? null,
    endedAt: order.endedAt?.toISOString() ?? null,
    totalMinutes: order.totalMinutes,
    grossAmount: order.grossAmount?.toString() ?? null,
    actions,
  };
}

export async function listMiniOrders(currentUser: CurrentDlmUser) {
  const participantWhere: Prisma.OrderWhereInput[] = [{ hostDlmId: currentUser.dlmId }];
  if (currentUser.discordUserId) {
    participantWhere.push({ hostId: currentUser.discordUserId }, { workerId: currentUser.discordUserId });
  }

  const rows = await prisma.order.findMany({
    where: { OR: participantWhere, createdAt: newEntityOnlyTime() },
    include: {
      hostDlmUser: { include: { member: true } },
      worker: true,
      peiwan: true,
    },
    orderBy: { createdAt: 'desc' },
    take: ORDER_TAKE_LIMIT,
  });

  return rows.map((row) => serializeOrder(row, currentUser));
}

export async function performMiniOrderAction(
  currentUser: CurrentDlmUser,
  orderId: string,
  action: unknown,
) {
  const normalizedAction = String(action || '').trim().toLowerCase();
  if (!['accept', 'decline', 'cancel', 'end'].includes(normalizedAction)) {
    return { ok: false, status: 400, error: 'invalid_order_action' } as const;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      displayNo: true,
      hostId: true,
      hostDlmId: true,
      workerId: true,
      status: true,
      createdAt: true,
      worker: { select: { dlmUser: { select: { dlmId: true } } } },
    },
  });
  if (!order || order.createdAt.getTime() <= NEW_ENTITY_OPERATIONS_STARTED_AT.getTime()) {
    return { ok: false, status: 404, error: 'order_not_found' } as const;
  }

  const isHost = order.hostDlmId === currentUser.dlmId || Boolean(currentUser.discordUserId && order.hostId === currentUser.discordUserId);
  const isWorker = Boolean(currentUser.discordUserId && order.workerId === currentUser.discordUserId);
  const requiresWorker = normalizedAction === 'accept' || normalizedAction === 'decline';
  const requiresHost = normalizedAction === 'cancel';
  if ((requiresWorker && !isWorker) || (requiresHost && !isHost) || (!requiresWorker && !requiresHost && !isHost && !isWorker)) {
    return { ok: false, status: 403, error: 'not_order_participant' } as const;
  }

  const result = await postInternalBot<{ ok: true; order: Record<string, unknown> }>(
    '/internal/mini-program/orders/action',
    {
      orderId,
      action: normalizedAction,
      actorDlmId: currentUser.dlmId,
      actorDiscordId: currentUser.discordUserId,
    },
  );
  const notificationText = normalizedAction === 'accept'
    ? `订单 #${order.displayNo} 已被陪玩接受，订单开始计时。`
    : normalizedAction === 'decline'
      ? `订单 #${order.displayNo} 已被陪玩拒绝，可以返回派单继续选择。`
      : normalizedAction === 'cancel'
        ? `订单 #${order.displayNo} 已取消。`
      : `订单 #${order.displayNo} 已结束，结算结果已写入账户流水。`;
  await Promise.allSettled([
    notifyMiniProgramUser(order.hostDlmId, 'critical', `订单 #${order.displayNo}`, notificationText, 'pages/my-orders/index'),
    notifyMiniProgramUser(order.worker.dlmUser?.dlmId, 'critical', `订单 #${order.displayNo}`, notificationText, 'pages/my-orders/index'),
  ]);
  return { ok: true, order: result.order } as const;
}

export async function listMiniTransactions(currentUser: CurrentDlmUser) {
  const rows = await prisma.individualTransaction.findMany({
    where: {
      AND: [
        currentUser.discordUserId
          ? { OR: [{ dlmId: currentUser.dlmId }, { discordId: currentUser.discordUserId }] }
          : { dlmId: currentUser.dlmId },
        { timeCreatedAt: newEntityOnlyTime() },
      ],
    },
    orderBy: { timeCreatedAt: 'desc' },
    take: TRANSACTION_TAKE_LIMIT,
  });

  return rows.map((row) => ({
    id: row.transactionId,
    type: formatTransactionType(row.typeOfTransaction),
    amount: row.amountChange.toString(),
    balanceBefore: row.balanceBefore.toString(),
    balanceAfter: row.balanceAfter.toString(),
    createdAt: row.timeCreatedAt.toISOString(),
  }));
}

export function getMiniNotificationSettings(currentUser: CurrentDlmUser) {
  return {
    critical: currentUser.dlmUser.miniCriticalNotifications,
    messages: currentUser.dlmUser.miniMessageNotifications,
    dispatches: currentUser.dlmUser.miniDispatchNotifications,
  };
}

export async function setMiniNotificationSettings(currentUser: CurrentDlmUser, payload: Record<string, unknown>) {
  const updated = await prisma.dlmUser.update({
    where: { dlmId: currentUser.dlmId },
    data: {
      miniCriticalNotifications: payload.critical === true,
      miniMessageNotifications: payload.messages === true,
      miniDispatchNotifications: payload.dispatches === true,
    },
    select: {
      miniCriticalNotifications: true,
      miniMessageNotifications: true,
      miniDispatchNotifications: true,
    },
  });

  return {
    critical: updated.miniCriticalNotifications,
    messages: updated.miniMessageNotifications,
    dispatches: updated.miniDispatchNotifications,
  };
}

export async function getOwnPeiwanCard(currentUser: CurrentDlmUser) {
  if (!currentUser.discordUserId) return { exists: false, reason: 'discord_not_bound' };

  const row = await prisma.pEIWAN.findUnique({
    where: { discordUserId: currentUser.discordUserId },
    include: { gameProfiles: true },
  });
  if (!row) return { exists: false, reason: 'peiwan_profile_missing' };

  const deleted = await prisma.peiwanDeletion.findUnique({ where: { peiwanId: row.PEIWANID } });
  return {
    exists: true,
    approved: !deleted,
    id: row.PEIWANID,
    name: row.serverDisplayName,
    status: row.status === PeiwanStatus.free ? '可接' : '忙碌',
    sex: row.sex,
    type: row.type,
    level: row.level,
    voicePreviewUrl: row.voicePreviewUrl,
    gameProfiles: row.gameProfiles.map((profile) => ({
      gameCode: profile.gameCode,
      tier: profile.tier,
      label: formatPeiwanGameProfile(profile),
    })),
  };
}

export async function getHomePendingTask(currentUser: CurrentDlmUser) {
  if (currentUser.discordUserId) {
    const pendingWorkerOrder = await prisma.order.findFirst({
      where: { workerId: currentUser.discordUserId, status: OrderStatus.PENDING, createdAt: newEntityOnlyTime() },
      orderBy: { createdAt: 'asc' },
      select: { id: true, displayNo: true },
    });
    if (pendingWorkerOrder) {
      return {
        type: 'ORDER_CONFIRMATION',
        title: `订单 #${pendingWorkerOrder.displayNo} 等待你确认`,
        body: '老板已经选择你，请确认接单或拒绝。',
        action: '立即处理',
        target: '/pages/my-orders/index',
      };
    }
  }

  const runningOrder = await prisma.order.findFirst({
    where: {
      status: OrderStatus.RUNNING,
      createdAt: newEntityOnlyTime(),
      OR: [
        { hostDlmId: currentUser.dlmId },
        ...(currentUser.discordUserId ? [{ hostId: currentUser.discordUserId }, { workerId: currentUser.discordUserId }] : []),
      ],
    },
    orderBy: { acceptedAt: 'asc' },
    select: { displayNo: true },
  });
  if (runningOrder) {
    return {
      type: 'RUNNING_ORDER',
      title: `订单 #${runningOrder.displayNo} 正在进行`,
      body: '订单正在计时，完成后由老板或陪玩手动结束。',
      action: '查看订单',
      target: '/pages/my-orders/index',
    };
  }

  const dispatch = await prisma.dispatchRequest.findFirst({
    where: {
      ownerDlmId: currentUser.dlmId,
      status: 'OPEN',
      expiresAt: { gt: new Date() },
      candidates: { some: { status: 'ACTIVE' } },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, requirement: true, _count: { select: { candidates: true } } },
  });
  if (dispatch) {
    return {
      type: 'DISPATCH_CANDIDATES',
      title: `${dispatch._count.candidates} 位陪玩已抢单`,
      body: dispatch.requirement,
      action: '选择陪玩',
      target: '/pages/orders/index',
    };
  }

  return null;
}

export async function getHomeRecommendationIds(currentUser: CurrentDlmUser) {
  const where: Prisma.OrderWhereInput = {
    ...(currentUser.discordUserId
      ? { OR: [{ hostDlmId: currentUser.dlmId }, { hostId: currentUser.discordUserId }] }
      : { hostDlmId: currentUser.dlmId }),
    createdAt: newEntityOnlyTime(),
  };
  const rows = await prisma.order.findMany({
    where,
    select: { peiwanId: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const counts = new Map<number, number>();
  rows.forEach((row) => counts.set(row.peiwanId, (counts.get(row.peiwanId) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([peiwanId]) => peiwanId)
    .slice(0, 12);
}
