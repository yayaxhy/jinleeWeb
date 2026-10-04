import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { isSettlementFinance, getSettlementReceiptStorageDir } from '@/lib/settlement-reconciliation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { evidenceId: string };

export async function GET(_request: Request, context: { params: Promise<RouteParams> }) {
  const session = await getServerSession();
  if (!session?.discordId) return NextResponse.json({ error: '无权访问' }, { status: 403 });

  const { evidenceId } = await context.params;
  const evidence = await prisma.settlementReceiptEvidence.findUnique({
    where: { id: evidenceId },
    include: { reconciliation: { select: { ownerDiscordId: true } } },
  });
  if (!evidence) return NextResponse.json({ error: '截图不存在' }, { status: 404 });
  if (!isSettlementFinance(session.discordId) && evidence.reconciliation.ownerDiscordId !== session.discordId) {
    return NextResponse.json({ error: '无权查看该截图' }, { status: 403 });
  }
  if (path.basename(evidence.storageFileName) !== evidence.storageFileName) {
    return NextResponse.json({ error: '截图路径无效' }, { status: 404 });
  }

  try {
    const image = await fs.readFile(path.join(getSettlementReceiptStorageDir(), evidence.storageFileName));
    return new NextResponse(image, {
      headers: {
        'Content-Type': evidence.mimeType,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: '截图文件不存在' }, { status: 404 });
    }
    return NextResponse.json({ error: '截图读取失败' }, { status: 500 });
  }
}
