import { MemberStatus, QuotationCode } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { createWechatProgramSession } from '@/lib/wechat-program-session';
import { POST as createDispatch } from '@/app/api/dispatch-requests/route';
import { POST as grabDispatch } from '@/app/api/dispatch-requests/[dispatchId]/candidates/route';
import { POST as startConversation } from '@/app/api/messages/conversations/route';
import { POST as sendMessage } from '@/app/api/messages/route';

const FIXTURE = {
  owner: {
    dlmId: 'stg_ui_owner',
    discordId: 'stg_ui_owner_discord',
    name: '界面测试老板',
  },
  workers: [
    { dlmId: 'stg_ui_worker_1', discordId: 'stg_ui_worker_discord_1', peiwanId: 990021, name: '界面测试陪玩一' },
    { dlmId: 'stg_ui_worker_2', discordId: 'stg_ui_worker_discord_2', peiwanId: 990022, name: '界面测试陪玩二' },
  ],
};

function request(url: string, token: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function responseBody<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Fixture route failed (${response.status}): ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function cleanup() {
  const dlmIds = [FIXTURE.owner.dlmId, ...FIXTURE.workers.map((worker) => worker.dlmId)];
  const discordIds = [FIXTURE.owner.discordId, ...FIXTURE.workers.map((worker) => worker.discordId)];
  const dispatches = await prisma.dispatchRequest.findMany({
    where: { ownerDlmId: FIXTURE.owner.dlmId },
    select: { id: true },
  });
  const dispatchIds = dispatches.map((dispatch) => dispatch.id);

  await prisma.order.deleteMany({
    where: {
      OR: [
        { dispatchRequestId: { in: dispatchIds } },
        { hostDlmId: FIXTURE.owner.dlmId },
        { workerId: { in: FIXTURE.workers.map((worker) => worker.discordId) } },
      ],
    },
  });
  await prisma.dispatchRequest.deleteMany({ where: { id: { in: dispatchIds } } });
  await prisma.miniConversation.deleteMany({
    where: { OR: [{ userAId: { in: dlmIds } }, { userBId: { in: dlmIds } }] },
  });
  await prisma.wechatProgramSession.deleteMany({ where: { dlmId: { in: dlmIds } } });
  await prisma.accountBinding.deleteMany({ where: { dlmId: { in: dlmIds } } });
  await prisma.dlmUser.deleteMany({ where: { dlmId: { in: dlmIds } } });
  await prisma.pEIWAN.deleteMany({ where: { PEIWANID: { in: FIXTURE.workers.map((worker) => worker.peiwanId) } } });
  await prisma.member.deleteMany({ where: { discordUserId: { in: discordIds } } });
}

async function seed() {
  await cleanup();

  await prisma.member.create({
    data: {
      discordUserId: FIXTURE.owner.discordId,
      status: MemberStatus.LAOBAN,
      serverDisplayName: FIXTURE.owner.name,
      totalBalance: 3000,
      recharge: 3000,
    },
  });
  await prisma.dlmUser.create({
    data: {
      dlmId: FIXTURE.owner.dlmId,
      discordUserId: FIXTURE.owner.discordId,
      discordDisplayName: FIXTURE.owner.name,
      totalBalance: 3000,
      recharge: 3000,
    },
  });

  for (const [index, worker] of FIXTURE.workers.entries()) {
    await prisma.member.create({
      data: {
        discordUserId: worker.discordId,
        status: MemberStatus.PEIWAN,
        serverDisplayName: worker.name,
      },
    });
    await prisma.dlmUser.create({
      data: {
        dlmId: worker.dlmId,
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
        quotation_Q1: 120 + index * 20,
      },
    });
  }

  const ownerSession = await createWechatProgramSession({ dlmId: FIXTURE.owner.dlmId });
  const workerSessions = await Promise.all(
    FIXTURE.workers.map((worker) => createWechatProgramSession({ dlmId: worker.dlmId })),
  );

  const dispatchResponse = await createDispatch(request(
    'http://staging.local/api/dispatch-requests',
    ownerSession.token,
    {
      anonymous: true,
      requirement: '今晚需要两名陪玩测试完整派单流程',
      sexRequirement: ['男生', '女生'],
      game: 'LOL',
      tags: ['技术', '聊天'],
    },
  ));
  const dispatchId = (await responseBody<{ dispatch: { id: string } }>(dispatchResponse)).dispatch.id;

  for (const session of workerSessions) {
    await responseBody(await grabDispatch(
      request(`http://staging.local/api/dispatch-requests/${dispatchId}/candidates`, session.token, {}),
      { params: Promise.resolve({ dispatchId }) },
    ));
  }

  const conversationResponse = await startConversation(request(
    'http://staging.local/api/messages/conversations',
    ownerSession.token,
    { peerDlmId: FIXTURE.workers[0].dlmId },
  ));
  const conversationId = (
    await responseBody<{ conversation: { id: string } }>(conversationResponse)
  ).conversation.id;
  await responseBody(await sendMessage(request(
    'http://staging.local/api/messages',
    workerSessions[0].token,
    { conversationId, text: '老板您好，我已经抢单，可以先沟通需求。' },
  )));

  console.log(JSON.stringify({
    ok: true,
    dispatchId,
    conversationId,
    owner: { ...FIXTURE.owner, session: ownerSession },
    workers: FIXTURE.workers.map((worker, index) => ({ ...worker, session: workerSessions[index] })),
  }, null, 2));
}

async function main() {
  if (process.env.DLM_ENV !== 'staging') {
    throw new Error('Refusing to run unless DLM_ENV=staging.');
  }

  if (process.argv.includes('--cleanup')) {
    await cleanup();
    console.log(JSON.stringify({ ok: true, cleaned: true }));
    return;
  }

  await seed();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
