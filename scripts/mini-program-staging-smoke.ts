import assert from 'node:assert/strict';
import { MemberStatus, QuotationCode } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createWechatProgramSession } from '@/lib/wechat-program-session';
import { GET as getDispatches, POST as createDispatch } from '@/app/api/dispatch-requests/route';
import { POST as grabDispatch } from '@/app/api/dispatch-requests/[dispatchId]/candidates/route';
import { POST as selectWorker } from '@/app/api/dispatch-requests/[dispatchId]/select-worker/route';
import { GET as getOrders } from '@/app/api/app/orders/route';
import { GET as getConversations, POST as startConversation } from '@/app/api/messages/conversations/route';
import { GET as getConversation } from '@/app/api/messages/conversations/[conversationId]/route';
import { POST as sendMessage } from '@/app/api/messages/route';

const FIXTURE = {
  ownerJinleeId: 'stg_smoke_owner',
  ownerDiscordId: 'stg_smoke_owner_discord',
  workers: [
    { jinleeId: 'stg_smoke_worker_1', discordId: 'stg_smoke_worker_discord_1', peiwanId: 990001, name: '测试陪玩一' },
    { jinleeId: 'stg_smoke_worker_2', discordId: 'stg_smoke_worker_discord_2', peiwanId: 990002, name: '测试陪玩二' },
  ],
};

type JsonRecord = Record<string, unknown>;
type CandidatePayload = { id: string };
type DispatchPayload = {
  id: string;
  anonymous: boolean;
  createdAt: number;
  expiresAt: number;
  candidateCount: number;
  candidates: CandidatePayload[];
};
type ConversationSummaryPayload = {
  id: string;
  unread: number;
  peerAvatarUrl: string | null;
};

function request(url: string, token: string, body?: JsonRecord) {
  return new Request(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function body<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function cleanup() {
  const jinleeIds = [FIXTURE.ownerJinleeId, ...FIXTURE.workers.map((worker) => worker.jinleeId)];
  const discordIds = [FIXTURE.ownerDiscordId, ...FIXTURE.workers.map((worker) => worker.discordId)];

  const dispatches = await prisma.dispatchRequest.findMany({
    where: { ownerJinleeId: FIXTURE.ownerJinleeId },
    select: { id: true },
  });
  const dispatchIds = dispatches.map((dispatch) => dispatch.id);

  await prisma.order.deleteMany({ where: { dispatchRequestId: { in: dispatchIds } } });
  await prisma.dispatchRequest.deleteMany({ where: { id: { in: dispatchIds } } });
  await prisma.miniConversation.deleteMany({
    where: { OR: [{ userAId: { in: jinleeIds } }, { userBId: { in: jinleeIds } }] },
  });
  await prisma.wechatProgramSession.deleteMany({ where: { jinleeId: { in: jinleeIds } } });
  await prisma.accountBinding.deleteMany({ where: { jinleeId: { in: jinleeIds } } });
  await prisma.jinleeUser.deleteMany({ where: { jinleeId: { in: jinleeIds } } });
  await prisma.pEIWAN.deleteMany({ where: { PEIWANID: { in: FIXTURE.workers.map((worker) => worker.peiwanId) } } });
  await prisma.member.deleteMany({ where: { discordUserId: { in: discordIds } } });
}

async function createFixtures() {
  await cleanup();

  await prisma.member.create({
    data: {
      discordUserId: FIXTURE.ownerDiscordId,
      status: MemberStatus.LAOBAN,
      serverDisplayName: '测试老板',
      totalBalance: 1000,
      recharge: 1000,
    },
  });
  await prisma.jinleeUser.create({
    data: {
      jinleeId: FIXTURE.ownerJinleeId,
      discordUserId: FIXTURE.ownerDiscordId,
      discordDisplayName: '测试老板',
      totalBalance: 1000,
      recharge: 1000,
    },
  });

  for (const worker of FIXTURE.workers) {
    await prisma.member.create({
      data: {
        discordUserId: worker.discordId,
        status: MemberStatus.PEIWAN,
        serverDisplayName: worker.name,
      },
    });
    await prisma.jinleeUser.create({
      data: {
        jinleeId: worker.jinleeId,
        discordUserId: worker.discordId,
        discordDisplayName: worker.name,
      },
    });
    await prisma.pEIWAN.create({
      data: {
        PEIWANID: worker.peiwanId,
        discordUserId: worker.discordId,
        serverDisplayName: worker.name,
        defaultQuotationCode: QuotationCode.Q1,
        quotation_Q1: 120,
      },
    });
  }

  const ownerSession = await createWechatProgramSession({ jinleeId: FIXTURE.ownerJinleeId });
  const workerSessions = await Promise.all(
    FIXTURE.workers.map((worker) => createWechatProgramSession({ jinleeId: worker.jinleeId })),
  );

  return {
    ownerToken: ownerSession.token,
    workerTokens: workerSessions.map((session) => session.token),
  };
}

async function run() {
  if (process.env.JINLEE_ENV !== 'staging') {
    throw new Error('This smoke test only runs with JINLEE_ENV=staging.');
  }

  const { ownerToken, workerTokens } = await createFixtures();
  const invalidResponse = await createDispatch(
    request('http://staging.local/api/dispatch-requests', ownerToken, { requirement: '应该被拒绝' }),
  );
  assert.equal(invalidResponse.status, 400);

  const createResponse = await createDispatch(
    request('http://staging.local/api/dispatch-requests', ownerToken, {
      anonymous: true,
      requirement: '需要两名陪玩进行 staging 流程验证',
      sexRequirement: ['男生', '女生'],
      game: 'LOL',
      tags: ['技术', '聊天'],
    }),
  );
  assert.equal(createResponse.status, 200);
  const created = await body<{ ok: boolean; dispatch: DispatchPayload }>(createResponse);
  assert.equal(created.ok, true);
  assert.equal(created.dispatch.anonymous, true);
  assert.ok(created.dispatch.expiresAt - created.dispatch.createdAt >= 19 * 60 * 1000);
  const dispatchId = String(created.dispatch.id);

  const publicList = await body<{ dispatches: DispatchPayload[] }>(
    await getDispatches(request('http://staging.local/api/dispatch-requests', workerTokens[0])),
  );
  assert.ok(publicList.dispatches.some((dispatch) => dispatch.id === dispatchId));

  const candidateIds: string[] = [];
  for (let index = 0; index < workerTokens.length; index += 1) {
    const response = await grabDispatch(
      request(`http://staging.local/api/dispatch-requests/${dispatchId}/candidates`, workerTokens[index], {}),
      { params: Promise.resolve({ dispatchId }) },
    );
    assert.equal(response.status, 200);
    candidateIds.push((await body<{ candidate: CandidatePayload }>(response)).candidate.id);
  }

  const mine = await body<{ dispatches: DispatchPayload[] }>(
    await getDispatches(request('http://staging.local/api/dispatch-requests?scope=mine', ownerToken)),
  );
  const mineDispatch = mine.dispatches.find((dispatch) => dispatch.id === dispatchId);
  assert.ok(mineDispatch);
  assert.equal(mineDispatch.candidateCount, 2);
  assert.deepEqual(mineDispatch.candidates.map((candidate) => candidate.id), candidateIds);

  const orderIds: string[] = [];
  for (const candidateId of candidateIds) {
    const response = await selectWorker(
      request(`http://staging.local/api/dispatch-requests/${dispatchId}/select-worker`, ownerToken, {
        candidateId,
        quotationCode: 'Q1',
      }),
      { params: Promise.resolve({ dispatchId }) },
    );
    assert.equal(response.status, 200);
    orderIds.push((await body<{ order: { id: string } }>(response)).order.id);
  }
  assert.equal(new Set(orderIds).size, 2);

  const repeatedSelection = await selectWorker(
    request(`http://staging.local/api/dispatch-requests/${dispatchId}/select-worker`, ownerToken, {
      candidateId: candidateIds[0],
      quotationCode: 'Q1',
    }),
    { params: Promise.resolve({ dispatchId }) },
  );
  assert.equal(repeatedSelection.status, 200);
  assert.equal((await body<{ order: { id: string } }>(repeatedSelection)).order.id, orderIds[0]);

  const orders = await body<{ orders: Array<{ id: string }> }>(
    await getOrders(request('http://staging.local/api/app/orders', ownerToken)),
  );
  assert.equal(orders.orders.filter((order) => orderIds.includes(order.id)).length, 2);

  const conversationResponse = await startConversation(
    request('http://staging.local/api/messages/conversations', ownerToken, {
      peerJinleeId: FIXTURE.workers[0].jinleeId,
    }),
  );
  assert.equal(conversationResponse.status, 200);
  const conversationId = (await body<{ conversation: { id: string } }>(conversationResponse)).conversation.id;

  const safeMessage = await sendMessage(
    request('http://staging.local/api/messages', ownerToken, {
      conversationId,
      text: '今晚可以开始吗',
    }),
  );
  assert.equal(safeMessage.status, 200);
  assert.equal((await body<{ blocked: boolean }>(safeMessage)).blocked, false);

  const blockedMessage = await sendMessage(
    request('http://staging.local/api/messages', ownerToken, {
      conversationId,
      text: '加我微信私下转账',
    }),
  );
  assert.equal(blockedMessage.status, 200);
  assert.equal((await body<{ blocked: boolean }>(blockedMessage)).blocked, true);

  const workerConversationList = await body<{ conversations: ConversationSummaryPayload[] }>(
    await getConversations(request('http://staging.local/api/messages/conversations', workerTokens[0])),
  );
  const unreadConversation = workerConversationList.conversations.find(
    (conversation) => conversation.id === conversationId,
  );
  if (!unreadConversation) throw new Error('Worker conversation was not returned.');
  assert.ok(unreadConversation.unread >= 2);
  assert.ok(unreadConversation.peerAvatarUrl === null || typeof unreadConversation.peerAvatarUrl === 'string');

  const conversationDetail = await getConversation(
    request(`http://staging.local/api/messages/conversations/${conversationId}`, workerTokens[0]),
    { params: Promise.resolve({ conversationId }) },
  );
  assert.equal(conversationDetail.status, 200);
  const detail = await body<{ conversation: { messages: Array<{ text: string }> } }>(conversationDetail);
  assert.equal(detail.conversation.messages.at(-1)?.text, '消息违规已拦截');

  const afterRead = await body<{ conversations: ConversationSummaryPayload[] }>(
    await getConversations(request('http://staging.local/api/messages/conversations', workerTokens[0])),
  );
  assert.equal(afterRead.conversations.find((conversation) => conversation.id === conversationId)?.unread, 0);

  const blockedRecord = await prisma.miniMessage.findFirst({
    where: { conversationId, status: 'BLOCKED' },
    select: { body: true, rawBody: true, moderationEvents: { select: { action: true, rawText: true } } },
  });
  assert.equal(blockedRecord?.body, '消息违规已拦截');
  assert.equal(blockedRecord?.rawBody, '加我微信私下转账');
  assert.equal(blockedRecord?.moderationEvents[0]?.action, 'BLOCK');

  console.log(JSON.stringify({
    ok: true,
    dispatchId,
    candidates: candidateIds.length,
    independentOrders: orderIds.length,
    duplicateSelectionIdempotent: true,
    conversationId,
    sensitiveMessageBlocked: true,
    unreadClearedAfterOpen: true,
  }, null, 2));
}

run()
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
