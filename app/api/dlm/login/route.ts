import { NextRequest, NextResponse } from 'next/server';
import { attachDlmPortalSession } from '@/lib/dlm-portal-session';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  let body: { dlmId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式无效。' }, { status: 400 });
  }
  const dlmId = String(body?.dlmId ?? '').trim().toLowerCase();
  if (!/^dlm[a-z0-9]+$/.test(dlmId)) {
    return NextResponse.json({ error: '请输入有效的 DLM ID。' }, { status: 400 });
  }
  const user = await prisma.dlmUser.findUnique({
    where: { dlmId },
    select: { dlmId: true, sessionVersion: true },
  });
  if (!user) return NextResponse.json({ error: '未找到该 DLM ID。' }, { status: 404 });

  const response = NextResponse.json({ ok: true, redirectTo: '/dlm/profile' });
  attachDlmPortalSession(response, user);
  return response;
}
