import { renderSiteCopy } from "@/lib/site-copy-server";
import { NextRequest, NextResponse } from 'next/server';
import { attachDlmPortalSession } from '@/lib/dlm-portal-session';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  let body: { dlmId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.dlm.login.route.95dd2195e084") }, { status: 400 });
  }
  const dlmId = String(body?.dlmId ?? '').trim().toLowerCase();
  if (!/^dlm[a-z0-9]+$/.test(dlmId)) {
    return NextResponse.json({ error: await renderSiteCopy("site.app.api.dlm.login.route.e9a61bdf0d87") }, { status: 400 });
  }
  const user = await prisma.dlmUser.findUnique({
    where: { dlmId },
    select: { dlmId: true, sessionVersion: true },
  });
  if (!user) return NextResponse.json({ error: await renderSiteCopy("site.app.api.dlm.login.route.10884bb3009e") }, { status: 404 });

  const response = NextResponse.json({ ok: true, redirectTo: '/profile' });
  attachDlmPortalSession(response, user);
  return response;
}
