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

async function withDisplayNames(rows: Array<{ channelId: string; ownerId: string; enabled: boolean; note: string | null; createdAt: Date; updatedAt: Date }>) {
  const ownerIds = Array.from(new Set(rows.map((row) => row.ownerId))).filter(Boolean);
  const members = ownerIds.length
    ? await prisma.member.findMany({
        where: { discordUserId: { in: ownerIds } },
        select: { discordUserId: true, serverDisplayName: true },
      })
    : [];
  const displayMap = new Map(
    members.map((row) => [row.discordUserId, row.serverDisplayName?.trim() || null]),
  );

  return rows.map((row) => ({
    ...row,
    ownerDisplayName: displayMap.get(row.ownerId) ?? null,
  }));
}

export async function GET() {
  const session = await ensureAdmin();
  if (!session) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const rows = await prisma.bossChannelBinding.findMany({
    orderBy: [{ enabled: 'desc' }, { updatedAt: 'desc' }],
  });

  return NextResponse.json({
    bindings: await withDisplayNames(rows),
    total: rows.length,
  });
}

export async function POST(request: Request) {
  const session = await ensureAdmin();
  if (!session) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const channelId = normalizeId(body.channelId);
  const ownerId = normalizeId(body.ownerId);
  const enabled = body.enabled !== false;
  const note = normalizeNote(body.note);

  if (!DISCORD_ID_RE.test(channelId)) {
    return NextResponse.json({ error: '频道ID格式错误' }, { status: 400 });
  }
  if (!DISCORD_ID_RE.test(ownerId)) {
    return NextResponse.json({ error: '老板Discord ID格式错误' }, { status: 400 });
  }

  const row = await prisma.bossChannelBinding.upsert({
    where: { channelId },
    create: { channelId, ownerId, enabled, note },
    update: { ownerId, enabled, note },
  });

  const bindings = await withDisplayNames([row]);
  return NextResponse.json({ ok: true, binding: bindings[0] });
}
