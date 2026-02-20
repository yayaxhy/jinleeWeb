import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { canManageOrderChannelBindings } from '@/lib/admin';

const DISCORD_ID_RE = /^\d{17,20}$/;

function normalizeId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNote(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 200) : null;
}

async function ensureAdmin() {
  const session = await getServerSession();
  if (!session?.discordId || !canManageOrderChannelBindings(session.discordId)) {
    return null;
  }
  return session;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  const session = await ensureAdmin();
  if (!session) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const params = await context.params;
  const channelId = normalizeId(params.channelId);
  if (!DISCORD_ID_RE.test(channelId)) {
    return NextResponse.json({ error: '频道ID格式错误' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const data: { ownerId?: string; enabled?: boolean; note?: string | null } = {};

  if (body.ownerId !== undefined) {
    const ownerId = normalizeId(body.ownerId);
    if (!DISCORD_ID_RE.test(ownerId)) {
      return NextResponse.json({ error: '老板Discord ID格式错误' }, { status: 400 });
    }
    data.ownerId = ownerId;
  }

  if (body.enabled !== undefined) {
    data.enabled = Boolean(body.enabled);
  }

  if (body.note !== undefined) {
    data.note = normalizeNote(body.note);
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: '缺少可更新字段' }, { status: 400 });
  }

  try {
    const updated = await prisma.bossChannelBinding.update({
      where: { channelId },
      data,
    });
    return NextResponse.json({ ok: true, binding: updated });
  } catch {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  const session = await ensureAdmin();
  if (!session) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const params = await context.params;
  const channelId = normalizeId(params.channelId);
  if (!DISCORD_ID_RE.test(channelId)) {
    return NextResponse.json({ error: '频道ID格式错误' }, { status: 400 });
  }

  try {
    await prisma.bossChannelBinding.delete({ where: { channelId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }
}
