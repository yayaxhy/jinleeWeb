import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import { canViewTransactions, isHowardReadOnlyDiscordId } from '@/lib/admin';

const DEFAULT_REDIRECT = '/admin/expenses';

const safeRedirectTo = (raw: string | null) => {
  if (!raw) return DEFAULT_REDIRECT;
  const text = raw.trim();
  if (!text.startsWith('/admin/expenses')) return DEFAULT_REDIRECT;
  return text;
};

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !canViewTransactions(session.discordId)) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }
  if (isHowardReadOnlyDiscordId(session.discordId)) {
    return NextResponse.json({ error: '只读账号不能修改' }, { status: 403 });
  }

  const formData = await request.formData();
  const id = typeof formData.get('id') === 'string' ? (formData.get('id') as string).trim() : '';
  const reason = typeof formData.get('reason') === 'string' ? (formData.get('reason') as string).trim() : '';
  const redirectTo = safeRedirectTo(typeof formData.get('redirectTo') === 'string' ? (formData.get('redirectTo') as string) : null);

  if (!id || !reason) {
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  await prisma.expense
    .update({
      where: { id },
      data: { reason },
    })
    .catch(() => null);

  return NextResponse.redirect(new URL(redirectTo, request.url));
}
