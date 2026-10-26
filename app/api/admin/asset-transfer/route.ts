import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { canManageGuildOperations } from '@/lib/admin';
import { AccountMigrationError, previewAccountMigrationTx, runAccountMigration } from '@/lib/account-migration';
import { fetchAccountMigrationRoleSnapshot } from '@/lib/account-migration-preflight';
import { isSameOriginKnowledgeWrite } from '@/lib/knowledge-validation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

const failureMessage = '资产转移失败，请稍后再试';
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const requestIdValid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function publicResult(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const { warnings: _warnings, ...result } = value as Record<string, unknown>;
  void _warnings;
  return result;
}
async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json' || !request.body) throw new Error('invalid_json');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0; let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 16 * 1024) { await reader.cancel(); throw new Error('invalid_json'); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    const body: unknown = JSON.parse(text + decoder.decode());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_json');
    return body as Record<string, unknown>;
  } finally { reader.releaseLock(); }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !canManageGuildOperations(session.discordId)) return response({ error: '无权访问' }, 403);
  const requestId = request.nextUrl.searchParams.get('requestId') ?? '';
  if (!requestIdValid(requestId)) return response({ error: failureMessage, code: 'migration_request_id' }, 400);
  try {
    const record = await prisma.accountMigration.findUnique({ where: { id: requestId }, select: {
      id: true, mode: true, actorDlmId: true, actorDiscordId: true, sourceDlmId: true, targetDlmId: true, status: true, result: true, rolesStatus: true, createdAt: true,
    } });
    if (!record || record.mode !== 'ADMIN' || record.actorDlmId !== session.dlmId || record.actorDiscordId !== session.discordId) return response({ error: failureMessage, code: 'migration_not_found' }, 404);
    return response({ ok: true, record: { ...record, result: publicResult(record.result) } });
  } catch (error) {
    console.error('[account-migration] receipt read failed', { requestId, error });
    return response({ error: failureMessage, code: 'migration_lookup_failed' }, 503);
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId || !canManageGuildOperations(session.discordId)) return response({ error: '无权访问' }, 403);
  if (!isSameOriginKnowledgeWrite(request, process.env.SITE_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL)) return response({ error: '无权访问' }, 403);
  let body: Record<string, unknown>;
  try { body = await readBody(request); }
  catch { return response({ error: '请求体不是合法 JSON' }, 400); }
  if (body.action !== 'preview' && body.action !== 'execute') return response({ error: failureMessage, code: 'migration_action_invalid' }, 400);
  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  if (body.action === 'execute' && (!requestIdValid(requestId) || typeof body.expectedPreviewHash !== 'string')) {
    return response({ error: failureMessage, code: 'migration_request_id' }, 400);
  }
  try {
    if (body.action === 'execute') {
      const existing = await prisma.accountMigration.findUnique({ where: { id: requestId } });
      if (existing) {
        if (existing.mode !== 'ADMIN' || existing.actorDlmId !== session.dlmId || existing.actorDiscordId !== session.discordId ||
            existing.sourceDlmId !== body.sourceDlmId || existing.targetDlmId !== body.targetDlmId) return response({ error: failureMessage, code: 'migration_request_conflict' }, 409);
        return response({ ok: true, result: publicResult(existing.result), rolesStatus: existing.rolesStatus });
      }
    }
    const sourceIdentifier = typeof body.sourceIdentifier === 'string' ? body.sourceIdentifier.trim() : '';
    const targetIdentifier = typeof body.targetIdentifier === 'string' ? body.targetIdentifier.trim() : '';
    if (!sourceIdentifier) return response({ error: '源账号不存在，或尚未建立 DLMClub 身份' }, 404);
    if (!targetIdentifier) return response({ error: '目标账号不存在，或尚未建立 DLMClub 身份' }, 404);
    if (sourceIdentifier === targetIdentifier) return response({ error: '源账号和目标账号不能相同' }, 400);
    const [source, target] = await Promise.all([sourceIdentifier, targetIdentifier].map(identifier => prisma.dlmUser.findFirst({
      where: { OR: [{ dlmId: identifier }, { discordUserId: identifier }] }, select: { dlmId: true, discordUserId: true },
    })));
    if (!source) return response({ error: '源账号不存在，或尚未建立 DLMClub 身份' }, 404);
    if (!target) return response({ error: '目标账号不存在，或尚未建立 DLMClub 身份' }, 404);
    if (source.dlmId === target.dlmId) return response({ error: '源账号和目标账号不能相同' }, 400);
    if (body.action === 'execute' && (source.dlmId !== body.sourceDlmId || target.dlmId !== body.targetDlmId)) return response({ error: failureMessage, code: 'migration_owner_changed' }, 409);
    const roleSnapshot = await fetchAccountMigrationRoleSnapshot(source.discordUserId, target.discordUserId);
    const input = { sourceDlmId: source.dlmId, targetDlmId: target.dlmId,
      actorDlmId: session.dlmId, actorDiscordId: session.discordId, mode: 'ADMIN' as const, roleSnapshot };
    if (body.action === 'preview') {
      const preview = await prisma.$transaction(tx => previewAccountMigrationTx(tx, input), {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000,
      });
      const { notice: _notice, conflicts, ...summary } = preview;
      void _notice;
      return response({ ok: true, requestId: randomUUID(), preview: { ...summary, conflicts: conflicts.map(({ model, recordKey }) => ({ model, recordKey })) } });
    }
    const result = await runAccountMigration(prisma, { ...input, requestId, expectedPreviewHash: body.expectedPreviewHash as string });
    return response({ ok: true, result: publicResult(result) });
  } catch (error) {
    const code = error instanceof AccountMigrationError ? error.code : body.action === 'execute' ? 'migration_result_unknown' : 'migration_preview_failed';
    console.error('[account-migration] operation failed', { requestId, code, error });
    return response({ error: failureMessage, code, requestId: requestId || undefined }, error instanceof AccountMigrationError ? error.status : body.action === 'execute' ? 503 : 400);
  }
}
