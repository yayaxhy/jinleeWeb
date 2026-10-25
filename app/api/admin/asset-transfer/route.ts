import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { isAdminDiscordId } from '@/lib/admin';
import { readAdminJsonWrite } from '@/lib/admin-write-request';
import { AccountMigrationError, previewAccountMigrationTx, runAccountMigration } from '@/lib/account-migration';
import { fetchAccountMigrationRoleSnapshot } from '@/lib/account-migration-preflight';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) return response({ error: '无权访问' }, 403);
  const id = request.nextUrl.searchParams.get('requestId');
  if (!id) return response({ error: '缺少原迁移请求编号' }, 400);
  const record = await prisma.accountMigration.findUnique({ where: { id }, select: {
    id: true, sourceDlmId: true, targetDlmId: true, status: true, result: true, rolesStatus: true, rolesError: true, createdAt: true,
  } });
  return record ? response({ ok: true, record }) : response({ error: '未查到原迁移；这不能证明之前的请求一定失败，请稍后再查。' }, 404);
}
export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) return response({ error: '无权访问' }, 403);
  const parsed = await readAdminJsonWrite(request, process.env.SITE_ORIGIN);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  if (!['preview', 'execute'].includes(String(body.action))) return response({ error: '请先预览完整账号合并方案' }, 400);
  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  try {
    if (body.action === 'execute' && requestId) {
      const existing = await prisma.accountMigration.findUnique({ where: { id: requestId } });
      if (existing) {
        if (existing.mode !== 'ADMIN' || existing.actorDlmId !== session.dlmId || existing.actorDiscordId !== session.discordId ||
            existing.sourceDlmId !== body.sourceDlmId || existing.targetDlmId !== body.targetDlmId) return response({ error: '原请求编号与这次操作不符' }, 409);
        return response({ ok: true, result: existing.result, rolesStatus: existing.rolesStatus, rolesError: existing.rolesError });
      }
    }
    const sourceIdentifier = typeof body.sourceIdentifier === 'string' ? body.sourceIdentifier.trim() : '';
    const targetIdentifier = typeof body.targetIdentifier === 'string' ? body.targetIdentifier.trim() : '';
    if (!sourceIdentifier || !targetIdentifier || sourceIdentifier === targetIdentifier) return response({ error: '请输入不同的旧号和新号 DLM 或 Discord 编号' }, 400);
    const [source, target] = await Promise.all([sourceIdentifier, targetIdentifier].map(identifier => prisma.dlmUser.findFirst({
      where: { OR: [{ dlmId: identifier }, { discordUserId: identifier }] }, select: { dlmId: true, discordUserId: true },
    })));
    if (!source || !target) return response({ error: '账户不存在或已迁移；结果不明时请用原请求编号查询。' }, 404);
    if (body.action === 'execute' && (source.dlmId !== body.sourceDlmId || target.dlmId !== body.targetDlmId)) return response({ error: '账户归属已变化，请重新预览' }, 409);
    // A retired Discord ID may belong to a newly registered account. Detached
    // roles come only from the saved DETACH plan inside the merge transaction.
    const roleSnapshot = await fetchAccountMigrationRoleSnapshot(source.discordUserId, target.discordUserId);
    const input = { sourceDlmId: source.dlmId, targetDlmId: target.dlmId,
      actorDlmId: session.dlmId, actorDiscordId: session.discordId, mode: 'ADMIN' as const, roleSnapshot };
    if (body.action === 'preview') return response({ ok: true, preview: await prisma.$transaction(tx => previewAccountMigrationTx(tx, input), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000,
    }) });
    if (!requestId || typeof body.expectedPreviewHash !== 'string') return response({ error: '请重新预览并确认合并' }, 400);
    const result = await runAccountMigration(prisma, { ...input, requestId, expectedPreviewHash: body.expectedPreviewHash });
    return response({ ok: true, result });
  } catch (error) {
    if (error instanceof AccountMigrationError) return response({ error: error.message, code: error.code }, error.status);
    console.error('[account-migration] operation did not return a confirmed result', { requestId, name: error instanceof Error ? error.name : 'unknown' });
    return response({ error: body.action === 'execute' ? '无法确认本次迁移结果，请保留原编号查询，不要创建另一笔迁移。' : error instanceof Error ? error.message : '无法生成迁移预览', requestId: requestId || undefined }, body.action === 'execute' ? 503 : 400);
  }
}
