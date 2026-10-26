import { MiniConversationType, MiniMessageSenderType, MiniMessageStatus } from '@prisma/client';
import { NextResponse } from 'next/server';

import { canViewKefuWorkspace } from '@/lib/admin';
import { notifyMiniProgramUser } from '@/lib/mini-program-subscribe';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

type Params = { conversationId: string };

const nameOf = (user: { discordDisplayName: string | null; wechatDisplayName: string | null; member: { serverDisplayName: string | null } | null } | null) =>
  user?.discordDisplayName || user?.member?.serverDisplayName || user?.wechatDisplayName || '未知用户';

async function authorize() {
  const session = await getServerSession();
  return Boolean(session?.discordId && canViewKefuWorkspace(session.discordId));
}

async function loadConversation(conversationId: string) {
  return prisma.miniConversation.findFirst({
    where: { id: conversationId, type: MiniConversationType.SUPPORT },
    include: {
      userA: { include: { member: { select: { serverDisplayName: true } } } },
      messages: { orderBy: { createdAt: 'asc' }, take: 200 },
    },
  });
}

const serialize = (conversation: NonNullable<Awaited<ReturnType<typeof loadConversation>>>) => ({
  id: conversation.id,
  userName: nameOf(conversation.userA),
  userDlmId: conversation.userAId,
  messages: conversation.messages.map((message) => ({
    id: message.id,
    from: message.senderType === MiniMessageSenderType.ADMIN ? 'admin' : message.senderType === MiniMessageSenderType.SYSTEM ? 'system' : 'user',
    text: message.body,
    createdAt: message.createdAt.toISOString(),
  })),
});

export async function GET(_request: Request, context: { params: Promise<Params> }) {
  if (!await authorize()) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  const { conversationId } = await context.params;
  const conversation = await loadConversation(conversationId);
  if (!conversation) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, conversation: serialize(conversation) });
}

export async function POST(request: Request, context: { params: Promise<Params> }) {
  if (!await authorize()) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null) as { text?: unknown } | null;
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 1000) : '';
  if (!text) return NextResponse.json({ ok: false, error: 'message_required' }, { status: 400 });
  const { conversationId } = await context.params;
  const conversation = await prisma.miniConversation.findFirst({
    where: { id: conversationId, type: MiniConversationType.SUPPORT },
    select: { id: true, userAId: true },
  });
  if (!conversation?.userAId) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  await prisma.$transaction([
    prisma.miniMessage.create({
      data: {
        conversationId: conversation.id,
        senderType: MiniMessageSenderType.ADMIN,
        body: text,
        status: MiniMessageStatus.NORMAL,
      },
    }),
    prisma.miniConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }),
  ]);
  notifyMiniProgramUser(conversation.userAId, 'message', '公会客服', text, `pages/chat/index?id=${encodeURIComponent(conversation.id)}`)
    .catch((error) => console.error('[support] mini notification failed', error));
  const updated = await loadConversation(conversation.id);
  return NextResponse.json({ ok: true, conversation: updated ? serialize(updated) : null });
}
