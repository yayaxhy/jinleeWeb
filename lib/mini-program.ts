import {
  AccountProvider,
  DispatchCandidateStatus,
  DispatchRequestStatus,
  DispatchSource,
  MemberStatus,
  MiniAvailabilityStatus,
  MiniConversationType,
  MiniMessageSenderType,
  MiniMessageStatus,
  MiniModerationAction,
  OrderMode,
  OrderStatus,
  PeiwanStatus,
  Prisma,
  QuotationCode,
} from '@prisma/client';
import { QUOTATION_CODE_LABEL, QUOTATION_CODE_TO_FIELD, type QuotationCodeValue } from '@/constants/peiwan';
import { type CurrentJinleeUser } from '@/lib/current-jinlee-user';
import { ensureJinleeUserForDiscordMember } from '@/lib/jinlee-user';
import { postInternalBot } from '@/lib/internal-bot';
import { prisma } from '@/lib/prisma';
import { checkMiniProgramMessageSecurity } from '@/lib/wechat';
import { getJinleeWalletSnapshotTx } from '@/lib/jinlee-wallet';
import { notifyDispatchSubscribers, notifyMiniProgramUser } from '@/lib/mini-program-subscribe';

const DISPATCH_TTL_MINUTES = 20;
const DISPATCH_TAKE_LIMIT = 50;
const MESSAGE_TAKE_LIMIT = 100;
const SENSITIVE_MESSAGE_KEYWORDS = ['微信', 'vx', 'qq', '支付宝', '私下', '加我', '转账'];

const QUOTATION_LABEL_BY_CODE: Record<QuotationCodeValue, string> = {
  ...QUOTATION_CODE_LABEL,
  Q1: '默认单价',
};

const QUOTATION_CODE_BY_LABEL = Object.fromEntries(
  Object.entries(QUOTATION_LABEL_BY_CODE).map(([code, label]) => [label.toLowerCase(), code]),
) as Record<string, QuotationCodeValue>;

type DispatchWithRelations = Prisma.DispatchRequestGetPayload<{
  include: {
    ownerJinleeUser: { include: { member: true } };
    candidates: {
      include: {
        workerJinleeUser: { include: { member: true } };
        peiwan: {
          include: {
            member: { include: { receivedPeiwanReviews: true } };
            gameProfiles: true;
          };
        };
      };
    };
  };
}>;

type CandidateWithRelations = DispatchWithRelations['candidates'][number];

type ConversationWithRelations = Prisma.MiniConversationGetPayload<{
  include: {
    userA: { include: { member: true } };
    userB: { include: { member: true } };
    linkedOrder: { select: { displayNo: true; status: true } };
    messages: true;
  };
}>;

type ConversationSummary = Prisma.MiniConversationGetPayload<{
  include: {
    userA: { include: { member: true } };
    userB: { include: { member: true } };
    linkedOrder: { select: { displayNo: true; status: true } };
    messages: true;
  };
}>;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeSexRequirement(payload: Record<string, unknown>): string[] {
  const fromArray = toStringArray(payload.sexRequirement);
  if (fromArray.length) return fromArray;

  const result: string[] = [];
  if (payload.needMale) result.push('男生');
  if (payload.needFemale) result.push('女生');
  return result;
}

function normalizeTags(value: unknown): string[] {
  return toStringArray(value).slice(0, 8);
}

function displayNameForUser(
  user:
    | {
        jinleeId: string;
        discordDisplayName?: string | null;
        wechatDisplayName?: string | null;
        member?: { serverDisplayName?: string | null } | null;
      }
    | null
    | undefined,
) {
  return (
    user?.discordDisplayName?.trim() ||
    user?.member?.serverDisplayName?.trim() ||
    user?.wechatDisplayName?.trim() ||
    (user?.jinleeId ? `用户 ${user.jinleeId}` : '未知用户')
  );
}

function displayNameForCurrentUser(currentUser: CurrentJinleeUser) {
  return displayNameForUser(currentUser.jinleeUser);
}

function sexLabel(value?: string | null) {
  if (value === '小姐姐') return '女生';
  if (value === '小哥哥') return '男生';
  return value || '未填写';
}

function peiwanStatusLabel(value?: PeiwanStatus | string | null) {
  return value === PeiwanStatus.free || value === 'free' ? '可接' : '忙碌';
}

function decimalToNumber(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Prisma.Decimal) return value.toNumber();
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function getUnitPrice(peiwan: Record<string, unknown>, code: QuotationCodeValue): number | null {
  const field = QUOTATION_CODE_TO_FIELD[code];
  const value = decimalToNumber(peiwan[field]);
  return value != null && value > 0 ? value : null;
}

function getDefaultPrice(peiwan: Record<string, unknown> & { defaultQuotationCode: QuotationCode }) {
  return getUnitPrice(peiwan, peiwan.defaultQuotationCode as QuotationCodeValue);
}

function formatPrice(value: number | null) {
  return value == null ? '价格待定' : `${value.toFixed(0)} 币/小时`;
}

function getQuoteOptions(peiwan: Record<string, unknown>) {
  return (Object.keys(QUOTATION_CODE_TO_FIELD) as QuotationCodeValue[])
    .map((code) => {
      const price = getUnitPrice(peiwan, code);
      if (price == null) return null;
      return {
        code,
        label: QUOTATION_LABEL_BY_CODE[code],
        price,
        display: `${QUOTATION_LABEL_BY_CODE[code]} · ${price.toFixed(0)} 币/小时`,
      };
    })
    .filter((item): item is { code: QuotationCodeValue; label: string; price: number; display: string } => Boolean(item));
}

function resolveQuotationCode(raw: unknown, fallback: QuotationCode): QuotationCodeValue {
  const text = String(raw || '').trim();
  if ((Object.keys(QUOTATION_CODE_TO_FIELD) as string[]).includes(text)) {
    return text as QuotationCodeValue;
  }
  return QUOTATION_CODE_BY_LABEL[text.toLowerCase()] ?? (fallback as QuotationCodeValue);
}

function serializeCandidate(candidate: CandidateWithRelations) {
  const peiwan = candidate.peiwan;
  const name =
    candidate.workerDisplayName?.trim() ||
    peiwan.serverDisplayName?.trim() ||
    peiwan.member?.serverDisplayName?.trim() ||
    displayNameForUser(candidate.workerJinleeUser) ||
    `陪玩 #${peiwan.PEIWANID}`;
  const quoteOptions = getQuoteOptions(peiwan as unknown as Record<string, unknown>);
  const defaultPrice = getDefaultPrice(peiwan as unknown as Record<string, unknown> & { defaultQuotationCode: QuotationCode });
  const games = peiwan.gameProfiles.map((profile) => String(profile.gameCode));
  const gameTags = peiwan.gameProfiles.map((profile) => String(profile.tier));
  const reviews = peiwan.member.receivedPeiwanReviews
    .filter((review) => review.displayMode !== 'HIDDEN')
    .slice(0, 3)
    .map((review) => review.content);

  return {
    id: candidate.id,
    peiwanId: peiwan.PEIWANID,
    name,
    sex: sexLabel(peiwan.sex),
    level: peiwan.level,
    image: /^https?:\/\//.test(peiwan.MP_url || '') ? peiwan.MP_url : '',
    status: peiwanStatusLabel(peiwan.status),
    price: formatPrice(defaultPrice),
    games,
    tags: [sexLabel(peiwan.sex), peiwan.type, peiwan.level, ...gameTags].filter(Boolean),
    reviews,
    voicePreviewUrl: peiwan.voicePreviewUrl,
    intro: games.length ? `${peiwan.type} · 擅长 ${games.join(' / ')}` : `${name} · ${peiwan.level} · ${peiwan.type}`,
    quoteOptions: quoteOptions.map((item) => item.display),
    quoteCodeOptions: quoteOptions,
    grabbedAt: candidate.grabbedAt.getTime(),
    grabbedAtText: '',
    selected: candidate.status === DispatchCandidateStatus.SELECTED || Boolean(candidate.selectedOrderId),
    selectedQuote: candidate.selectedOrderId ? '已创建订单' : undefined,
    selectedOrderId: candidate.selectedOrderId,
  };
}

function serializeDispatch(dispatch: DispatchWithRelations, currentUser?: CurrentJinleeUser | null) {
  const sexRequirement = toStringArray(dispatch.sexRequirement);
  const tags = normalizeTags(dispatch.tags);
  const ownerDisplayName = dispatch.ownerDisplayName?.trim() || displayNameForUser(dispatch.ownerJinleeUser);

  return {
    id: dispatch.id,
    bossName: dispatch.anonymous ? '匿名老板' : ownerDisplayName,
    ownerId: currentUser && dispatch.ownerJinleeId === currentUser.jinleeId ? 'me' : dispatch.ownerJinleeId || dispatch.ownerDiscordUserId || '',
    anonymous: dispatch.anonymous,
    requirement: dispatch.requirement,
    sexRequirement,
    sexText: sexRequirement.join(' / ') || '不限',
    game: dispatch.game || '',
    tags,
    tagText: tags.join(' / ') || '未指定',
    createdAt: dispatch.createdAt.getTime(),
    expiresAt: dispatch.expiresAt.getTime(),
    status: dispatch.status,
    source: dispatch.source,
    candidateCount: dispatch.candidates.length,
    candidates: dispatch.candidates.map(serializeCandidate),
  };
}

async function getWechatOpenId(jinleeId: string) {
  const binding = await prisma.accountBinding.findFirst({
    where: {
      jinleeId,
      provider: AccountProvider.WECHAT_MINIPROGRAM,
    },
    select: { providerUserId: true },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

  return binding?.providerUserId ?? null;
}

const dispatchInclude = {
  ownerJinleeUser: { include: { member: true } },
  candidates: {
    include: {
      workerJinleeUser: { include: { member: true } },
      peiwan: {
        include: {
          member: { include: { receivedPeiwanReviews: true } },
          gameProfiles: true,
        },
      },
    },
    orderBy: { grabbedAt: 'asc' as const },
  },
} satisfies Prisma.DispatchRequestInclude;

export async function listDispatchRequests(currentUser: CurrentJinleeUser, scope: string | null) {
  const now = new Date();
  await prisma.dispatchRequest.updateMany({
    where: { status: DispatchRequestStatus.OPEN, expiresAt: { lte: now } },
    data: { status: DispatchRequestStatus.EXPIRED, closedAt: now },
  });
  const where: Prisma.DispatchRequestWhereInput =
    scope === 'mine'
      ? {
          ownerJinleeId: currentUser.jinleeId,
          status: DispatchRequestStatus.OPEN,
          expiresAt: { gt: now },
        }
      : scope === 'history'
        ? { ownerJinleeId: currentUser.jinleeId }
        : {
            status: DispatchRequestStatus.OPEN,
            expiresAt: { gt: now },
          };

  const rows = await prisma.dispatchRequest.findMany({
    where,
    include: dispatchInclude,
    orderBy: { createdAt: 'desc' },
    take: DISPATCH_TAKE_LIMIT,
  });

  return rows.map((item) => serializeDispatch(item, currentUser));
}

export async function createDispatchRequest(currentUser: CurrentJinleeUser, payload: Record<string, unknown>) {
  const sexRequirement = normalizeSexRequirement(payload);
  if (!sexRequirement.length) {
    return { ok: false, status: 400, error: '请选择男生或女生，至少选择一个。' };
  }

  const requirement = String(payload.requirement || '').trim();
  if (!requirement) {
    return { ok: false, status: 400, error: '请填写派单要求。' };
  }

  const now = new Date();
  const ownerWechatOpenId = await getWechatOpenId(currentUser.jinleeId);
  const dispatch = await prisma.dispatchRequest.create({
    data: {
      ownerJinleeId: currentUser.jinleeId,
      ownerDiscordUserId: currentUser.discordUserId,
      ownerWechatOpenId,
      ownerDisplayName: displayNameForCurrentUser(currentUser),
      anonymous: payload.anonymous !== false,
      requirement: requirement.slice(0, 500),
      sexRequirement,
      game: String(payload.game || '').trim() || null,
      tags: normalizeTags(payload.tags),
      status: DispatchRequestStatus.OPEN,
      source: DispatchSource.WECHAT_MINIPROGRAM,
      createdAt: now,
      expiresAt: new Date(now.getTime() + DISPATCH_TTL_MINUTES * 60 * 1000),
    },
    include: dispatchInclude,
  });

  postInternalBot('/internal/mini-program/dispatch-published', { dispatchId: dispatch.id }).catch((error) => {
    console.error('[mini-dispatch] Discord broadcast failed', { dispatchId: dispatch.id, error });
  });
  notifyDispatchSubscribers('接单大厅有新派单', requirement).catch((error) => {
    console.error('[mini-dispatch] subscription broadcast failed', { dispatchId: dispatch.id, error });
  });

  return {
    ok: true,
    dispatch: serializeDispatch(dispatch, currentUser),
  };
}

async function resolveCurrentPeiwan(currentUser: CurrentJinleeUser) {
  if (!currentUser.discordUserId) return null;

  return prisma.pEIWAN.findUnique({
    where: { discordUserId: currentUser.discordUserId },
    include: { member: true },
  });
}

export async function grabDispatchRequest(currentUser: CurrentJinleeUser, dispatchId: string) {
  const peiwan = await resolveCurrentPeiwan(currentUser);
  if (!peiwan || currentUser.jinleeUser.member?.status !== MemberStatus.PEIWAN) {
    return { ok: false, status: 403, error: '需要先完善陪玩资料后才能抢单。' };
  }

  const deleted = await prisma.peiwanDeletion.findUnique({ where: { peiwanId: peiwan.PEIWANID } });
  if (deleted) {
    return { ok: false, status: 403, error: '陪玩资料审核通过并可展示后才能抢单。' };
  }

  const runningOrder = await prisma.order.findFirst({
    where: {
      workerId: currentUser.discordUserId || peiwan.discordUserId,
      status: OrderStatus.RUNNING,
    },
    select: { id: true },
  });
  if (runningOrder) {
    return { ok: false, status: 409, error: '你有进行中订单，系统已强制显示忙碌。' };
  }

  try {
    const candidate = await prisma.$transaction(async (tx) => {
      const dispatch = await tx.dispatchRequest.findUnique({
        where: { id: dispatchId },
        select: {
          id: true,
          ownerJinleeId: true,
          ownerDiscordUserId: true,
          status: true,
          expiresAt: true,
        },
      });
      if (!dispatch) throw new Error('派单不存在。');
      if (dispatch.ownerJinleeId === currentUser.jinleeId) throw new Error('不能抢自己的派单。');
      if (dispatch.status !== DispatchRequestStatus.OPEN || dispatch.expiresAt <= new Date()) {
        throw new Error('派单已关闭。');
      }

      await tx.jinleeUser.update({
        where: { jinleeId: currentUser.jinleeId },
        data: { miniAvailability: MiniAvailabilityStatus.AVAILABLE },
      });
      await tx.pEIWAN.update({
        where: { PEIWANID: peiwan.PEIWANID },
        data: { status: PeiwanStatus.free },
      });

      const candidate = await tx.dispatchCandidate.create({
        data: {
          dispatchRequestId: dispatch.id,
          workerJinleeId: currentUser.jinleeId,
          workerDiscordUserId: currentUser.discordUserId,
          workerDisplayName: displayNameForCurrentUser(currentUser),
          peiwanId: peiwan.PEIWANID,
          status: DispatchCandidateStatus.ACTIVE,
        },
        include: {
          workerJinleeUser: { include: { member: true } },
          peiwan: {
            include: {
              member: { include: { receivedPeiwanReviews: true } },
              gameProfiles: true,
            },
          },
        },
      });
      if (dispatch.ownerJinleeId) {
        await createSystemNotificationTx(
          tx,
          dispatch.ownerJinleeId,
          `${displayNameForCurrentUser(currentUser)} 已抢单，打开“点单”查看陪玩名片。`,
        );
      }
      return {
        candidate,
        ownerJinleeId: dispatch.ownerJinleeId,
        ownerDiscordUserId: dispatch.ownerDiscordUserId,
      };
    });

    if (candidate.ownerDiscordUserId && currentUser.discordUserId) {
      postInternalBot('/internal/mini-program/dispatch-candidate', {
        ownerDiscordId: candidate.ownerDiscordUserId,
        workerDiscordId: currentUser.discordUserId,
        dispatchId,
      }).catch((error) => {
        console.error('[mini-dispatch] Discord candidate notification failed', { dispatchId, error });
      });
    }
    notifyMiniProgramUser(
      candidate.ownerJinleeId,
      'critical',
      '有陪玩抢单',
      `${displayNameForCurrentUser(currentUser)} 已进入候选列表`,
      'pages/orders/index',
    ).catch((error) => console.error('[mini-dispatch] owner subscription failed', error));

    return { ok: true, candidate: serializeCandidate(candidate.candidate) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, status: 409, error: '你已经抢过这条派单。' };
    }

    return { ok: false, status: 400, error: error instanceof Error ? error.message : '抢单失败。' };
  }
}

export async function selectDispatchCandidate(
  currentUser: CurrentJinleeUser,
  dispatchId: string,
  payload: Record<string, unknown>,
) {
  const candidateId = String(payload.candidateId || '').trim();
  if (!candidateId) {
    return { ok: false, status: 400, error: '缺少候选陪玩。' };
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "DispatchCandidate" WHERE "id" = ${candidateId} FOR UPDATE`;
    const candidate = await tx.dispatchCandidate.findUnique({
      where: { id: candidateId },
      include: {
        request: true,
        peiwan: { include: { member: true } },
      },
    });
    if (!candidate || candidate.dispatchRequestId !== dispatchId) {
      throw new Error('候选陪玩不存在。');
    }
    if (candidate.request.ownerJinleeId !== currentUser.jinleeId) {
      throw new Error('无权限选择该候选。');
    }
    if (candidate.selectedOrderId) {
      const existingOrder = await tx.order.findUnique({
        where: { id: candidate.selectedOrderId },
        select: { id: true, displayNo: true, quotationCode: true, unitPrice: true },
      });
      if (existingOrder) {
        return {
          order: existingOrder,
          quotationCode: existingOrder.quotationCode,
          unitPrice: existingOrder.unitPrice.toNumber(),
          workerJinleeId: candidate.workerJinleeId,
        };
      }
    }
    if (candidate.status !== DispatchCandidateStatus.ACTIVE) {
      throw new Error('该候选已失效。');
    }
    if (candidate.request.status !== DispatchRequestStatus.OPEN || candidate.request.expiresAt <= new Date()) {
      throw new Error('派单已关闭。');
    }
    if (!candidate.workerDiscordUserId) {
      throw new Error('该陪玩尚未绑定 Discord，暂不能创建订单。');
    }

    const quotationCode = resolveQuotationCode(payload.quotationCode || payload.quotation, candidate.peiwan.defaultQuotationCode);
    const unitPrice = getUnitPrice(candidate.peiwan as unknown as Record<string, unknown>, quotationCode);
    if (unitPrice == null || unitPrice <= 0) {
      throw new Error('该价格档位暂不可用。');
    }

    await tx.$executeRaw`SELECT 1 FROM "JinleeUser" WHERE "jinleeId" = ${currentUser.jinleeId} FOR UPDATE`;
    const wallet = await getJinleeWalletSnapshotTx(tx, {
      jinleeId: currentUser.jinleeId,
      discordUserId: currentUser.discordUserId,
    });
    if (wallet.totalBalance.lt(100)) {
      throw new Error('余额不足 100，请先充值后再点单。');
    }

    const order = await tx.order.create({
      data: {
        hostId: currentUser.discordUserId,
        hostJinleeId: currentUser.jinleeId,
        workerId: candidate.workerDiscordUserId,
        peiwanId: candidate.peiwanId,
        mode: candidate.request.anonymous ? OrderMode.ANONYMOUS : OrderMode.REALNAME,
        status: OrderStatus.PENDING,
        quotationCode,
        unitPrice,
        dispatchRequestId: candidate.request.id,
        dispatchCandidateId: candidate.id,
      },
      select: { id: true, displayNo: true },
    });

    await tx.dispatchCandidate.update({
      where: { id: candidate.id },
      data: {
        status: DispatchCandidateStatus.SELECTED,
        selectedAt: new Date(),
        selectedOrderId: order.id,
      },
    });
    if (candidate.workerJinleeId) {
      await createSystemNotificationTx(
        tx,
        candidate.workerJinleeId,
        `老板已选择你并创建订单 #${order.displayNo}，请尽快确认接单。`,
      );
    }

    return {
      order,
      quotationCode,
      unitPrice,
      workerJinleeId: candidate.workerJinleeId,
    };
  });

  notifyMiniProgramUser(
    result.workerJinleeId,
    'critical',
    '老板已选择你',
    `订单 #${result.order.displayNo} 等待确认`,
    'pages/my-orders/index',
  ).catch((error) => console.error('[mini-order] worker subscription failed', error));

  return {
    ok: true,
    order: {
      id: result.order.id,
      displayNo: result.order.displayNo,
      quotationCode: result.quotationCode,
      unitPrice: result.unitPrice,
    },
  };
}

function buildDirectPeerKey(a: string, b: string) {
  return [a, b].sort().join(':');
}

async function createSystemNotificationTx(
  tx: Prisma.TransactionClient,
  jinleeId: string,
  body: string,
) {
  return tx.miniConversation.upsert({
    where: {
      type_peerKey: {
        type: MiniConversationType.SYSTEM,
        peerKey: `system:${jinleeId}`,
      },
    },
    update: {
      updatedAt: new Date(),
      messages: {
        create: {
          senderType: MiniMessageSenderType.SYSTEM,
          body: body.slice(0, 1000),
          status: MiniMessageStatus.NOTICE,
        },
      },
    },
    create: {
      type: MiniConversationType.SYSTEM,
      peerKey: `system:${jinleeId}`,
      userAId: jinleeId,
      messages: {
        create: {
          senderType: MiniMessageSenderType.SYSTEM,
          body: body.slice(0, 1000),
          status: MiniMessageStatus.NOTICE,
        },
      },
    },
  });
}

function canAccessConversation(conversation: { userAId?: string | null; userBId?: string | null }, currentUser: CurrentJinleeUser) {
  return conversation.userAId === currentUser.jinleeId || conversation.userBId === currentUser.jinleeId;
}

function getPeer(conversation: ConversationWithRelations | ConversationSummary, currentUser: CurrentJinleeUser) {
  if (conversation.type === MiniConversationType.SYSTEM) return null;
  if (conversation.userAId === currentUser.jinleeId) return conversation.userB;
  return conversation.userA;
}

function serializeMiniMessage(message: ConversationWithRelations['messages'][number], currentUser: CurrentJinleeUser) {
  const from =
    message.senderType === MiniMessageSenderType.SYSTEM || message.senderType === MiniMessageSenderType.BOT
      ? 'system'
      : message.senderJinleeId === currentUser.jinleeId
        ? 'me'
        : 'peer';

  return {
    id: message.id,
    from,
    text: message.body,
    status: message.status.toLowerCase(),
    createdAt: message.createdAt.getTime(),
  };
}

function serializeConversationSummary(conversation: ConversationSummary, currentUser: CurrentJinleeUser, unread = 0) {
  const peer = getPeer(conversation, currentUser);
  const latestMessage = conversation.messages[0] ?? null;

  return {
    id: conversation.id,
    peerId: peer?.jinleeId ?? 'system',
    peerName: peer ? displayNameForUser(peer) : '机器人通知',
    peerRole: peer?.member?.status === MemberStatus.PEIWAN ? '陪玩' : conversation.type === MiniConversationType.SYSTEM ? '系统' : '用户',
    linkedOrder: conversation.linkedOrder ? `订单 #${conversation.linkedOrder.displayNo}` : conversation.type === MiniConversationType.SYSTEM ? '系统通知' : '未下单聊天',
    adminWatched: conversation.adminWatched,
    unread,
    updatedAt: conversation.updatedAt.getTime(),
    lastMessage: latestMessage?.body ?? '',
  };
}

function serializeConversation(conversation: ConversationWithRelations, currentUser: CurrentJinleeUser) {
  return {
    ...serializeConversationSummary(conversation, currentUser),
    messages: conversation.messages.map((message) => serializeMiniMessage(message, currentUser)),
  };
}

export async function listConversations(currentUser: CurrentJinleeUser) {
  const rows = await prisma.miniConversation.findMany({
    where: {
      OR: [{ userAId: currentUser.jinleeId }, { userBId: currentUser.jinleeId }],
    },
    include: {
      userA: { include: { member: true } },
      userB: { include: { member: true } },
      linkedOrder: { select: { displayNo: true, status: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: DISPATCH_TAKE_LIMIT,
  });

  return Promise.all(rows.map(async (row) => {
    const lastReadAt = row.userAId === currentUser.jinleeId ? row.userALastReadAt : row.userBLastReadAt;
    const unread = await prisma.miniMessage.count({
      where: {
        conversationId: row.id,
        OR: [
          { senderJinleeId: { not: currentUser.jinleeId } },
          { senderJinleeId: null },
        ],
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      },
    });
    return serializeConversationSummary(row, currentUser, unread);
  }));
}

export async function getConversation(currentUser: CurrentJinleeUser, conversationId: string) {
  const conversation = await prisma.miniConversation.findUnique({
    where: { id: conversationId },
    include: {
      userA: { include: { member: true } },
      userB: { include: { member: true } },
      linkedOrder: { select: { displayNo: true, status: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        take: MESSAGE_TAKE_LIMIT,
      },
    },
  });

  if (!conversation || !canAccessConversation(conversation, currentUser)) return null;
  await prisma.miniConversation.update({
    where: { id: conversation.id },
    data: conversation.userAId === currentUser.jinleeId
      ? { userALastReadAt: new Date() }
      : { userBLastReadAt: new Date() },
  });
  return serializeConversation(conversation, currentUser);
}

export async function startConversation(currentUser: CurrentJinleeUser, payload: Record<string, unknown>) {
  const peiwanId = Number(payload.peiwanId);
  let peerJinleeId = String(payload.peerJinleeId || '').trim();

  if (!peerJinleeId && Number.isInteger(peiwanId) && peiwanId > 0) {
    const peiwan = await prisma.pEIWAN.findUnique({
      where: { PEIWANID: peiwanId },
      include: { member: true },
    });
    if (!peiwan) {
      return { ok: false, status: 404, error: '未找到陪玩。' };
    }

    const ensured = await ensureJinleeUserForDiscordMember({
      discordUserId: peiwan.discordUserId,
      displayName: peiwan.serverDisplayName ?? peiwan.member.serverDisplayName,
    });
    peerJinleeId = ensured.jinleeId;
  }

  if (!peerJinleeId || peerJinleeId === currentUser.jinleeId) {
    return { ok: false, status: 400, error: '无法发起该聊天。' };
  }

  const peer = await prisma.jinleeUser.findUnique({
    where: { jinleeId: peerJinleeId },
    include: { member: true },
  });
  if (!peer) {
    return { ok: false, status: 404, error: '未找到聊天对象。' };
  }

  const peerKey = buildDirectPeerKey(currentUser.jinleeId, peer.jinleeId);
  const conversation = await prisma.miniConversation.upsert({
    where: {
      type_peerKey: {
        type: MiniConversationType.DIRECT,
        peerKey,
      },
    },
    update: {},
    create: {
      type: MiniConversationType.DIRECT,
      peerKey,
      userAId: currentUser.jinleeId < peer.jinleeId ? currentUser.jinleeId : peer.jinleeId,
      userBId: currentUser.jinleeId < peer.jinleeId ? peer.jinleeId : currentUser.jinleeId,
      adminWatched: true,
      ...(currentUser.jinleeId < peer.jinleeId
        ? { userALastReadAt: new Date() }
        : { userBLastReadAt: new Date() }),
      messages: {
        create: {
          senderType: MiniMessageSenderType.SYSTEM,
          body: '未下单前聊天已通知管理员监控。',
          status: MiniMessageStatus.NOTICE,
        },
      },
    },
    include: {
      userA: { include: { member: true } },
      userB: { include: { member: true } },
      linkedOrder: { select: { displayNo: true, status: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        take: MESSAGE_TAKE_LIMIT,
      },
    },
  });

  await prisma.miniConversation.update({
    where: { id: conversation.id },
    data: conversation.userAId === currentUser.jinleeId
      ? { userALastReadAt: new Date() }
      : { userBLastReadAt: new Date() },
  });

  return { ok: true, conversation: serializeConversation(conversation, currentUser) };
}

function shouldBlockMessage(text: string) {
  const value = text.toLowerCase();
  return SENSITIVE_MESSAGE_KEYWORDS.some((keyword) => value.includes(keyword));
}

async function moderateMessage(currentUser: CurrentJinleeUser, text: string) {
  if (shouldBlockMessage(text)) {
    return {
      blocked: true,
      review: false,
      riskLabels: ['sensitive_contact_or_payment'],
      reason: '命中联系方式或绕过平台交易关键词',
    };
  }

  const openId = await getWechatOpenId(currentUser.jinleeId);
  if (!openId) {
    return { blocked: false, review: true, riskLabels: ['security_check_unavailable'], reason: '微信内容安全校验缺少 openId' };
  }

  try {
    const result = await checkMiniProgramMessageSecurity({ openId, content: text });
    return {
      blocked: result.blocked,
      review: result.review,
      riskLabels: [
        `wechat_suggest_${result.suggest}`,
        ...(result.label == null ? [] : [`wechat_label_${result.label}`]),
      ],
      reason: result.blocked ? '微信内容安全判定为高风险' : result.review ? '微信内容安全要求人工复核' : '微信内容安全校验通过',
    };
  } catch (error) {
    console.error('[mini-message] WeChat security check failed', error);
    return { blocked: false, review: true, riskLabels: ['security_check_failed'], reason: '微信内容安全校验暂不可用，已转人工预警' };
  }
}

export async function sendMiniMessage(currentUser: CurrentJinleeUser, payload: Record<string, unknown>) {
  const conversationId = String(payload.conversationId || '').trim();
  const text = String(payload.text || payload.body || '').trim();
  if (!conversationId || !text) {
    return { ok: false, status: 400, error: '消息不能为空。' };
  }

  const conversation = await prisma.miniConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userAId: true, userBId: true, adminWatched: true },
  });
  if (!conversation || !canAccessConversation(conversation, currentUser)) {
    return { ok: false, status: 404, error: '会话不存在。' };
  }

  const moderation = await moderateMessage(currentUser, text);
  const blocked = moderation.blocked;
  const body = blocked ? '消息违规已拦截' : text;
  const shouldAlert = blocked || moderation.review || conversation.adminWatched;
  const result = await prisma.$transaction(async (tx) => {
    const message = await tx.miniMessage.create({
      data: {
        conversationId,
        senderJinleeId: currentUser.jinleeId,
        senderType: MiniMessageSenderType.USER,
        body,
        rawBody: text,
        status: blocked ? MiniMessageStatus.BLOCKED : MiniMessageStatus.NORMAL,
      },
    });
    const event = shouldAlert
      ? await tx.miniMessageModerationEvent.create({
          data: {
            messageId: message.id,
            conversationId,
            action: blocked ? MiniModerationAction.BLOCK : MiniModerationAction.ALERT,
            riskLabels: moderation.riskLabels.concat(conversation.adminWatched ? ['admin_watched_chat'] : []),
            rawText: text,
            reason: moderation.reason,
          },
        })
      : null;
    await tx.miniConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return { message, event };
  });

  if (result.event) {
    try {
      await postInternalBot('/internal/mini-program/moderation-alert', {
        eventId: result.event.id,
        conversationId,
        senderJinleeId: currentUser.jinleeId,
        action: result.event.action,
        reason: result.event.reason,
        rawText: text,
      });
      await prisma.miniMessageModerationEvent.update({
        where: { id: result.event.id },
        data: { notifiedAt: new Date(), notificationError: null },
      });
    } catch (error) {
      await prisma.miniMessageModerationEvent.update({
        where: { id: result.event.id },
        data: { notificationError: error instanceof Error ? error.message.slice(0, 500) : 'moderation_delivery_failed' },
      });
    }
  }

  const peerJinleeId = conversation.userAId === currentUser.jinleeId
    ? conversation.userBId
    : conversation.userAId;
  notifyMiniProgramUser(
    peerJinleeId,
    'message',
    displayNameForCurrentUser(currentUser),
    body,
    `pages/chat/index?id=${encodeURIComponent(conversationId)}`,
  ).catch((error) => console.error('[mini-message] subscription failed', error));

  return {
    ok: true,
    blocked,
    message: serializeMiniMessage(result.message, currentUser),
  };
}
