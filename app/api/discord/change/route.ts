import { renderSiteCopy } from "@/lib/site-copy-server";
import { NextResponse } from 'next/server';
import { AccountProvider } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { readAdminJsonWrite } from '@/lib/admin-write-request';
import { destroySession } from '@/lib/session';
import { readDiscordChangeProof, clearDiscordChangeProof } from '@/lib/discord-change-http';
import { previewAccountMigrationTx, runAccountMigration, AccountMigrationError, type AccountMigrationInput } from '@/lib/account-migration';
import { fetchAccountMigrationRoleSnapshot } from '@/lib/account-migration-preflight';
import type { DiscordChangeProof } from '@/lib/discord-change-proof';

class ChangeValidationError extends Error {}
const publicFailure = (error: unknown, fallback: string) => error instanceof AccountMigrationError || error instanceof ChangeValidationError ? error.message : fallback;

const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
async function verifiedInput(proof: DiscordChangeProof): Promise<AccountMigrationInput> {
  if (!proof.targetDlmId || !proof.targetDiscordId || !proof.targetSessionVersion) throw new ChangeValidationError('请先完成目标 Discord 授权');
  const [source, target] = await Promise.all([
    prisma.dlmUser.findUnique({ where: { dlmId: proof.sourceDlmId }, select: { discordUserId: true, sessionVersion: true } }),
    prisma.dlmUser.findUnique({ where: { dlmId: proof.targetDlmId }, select: { discordUserId: true, sessionVersion: true } }),
  ]);
  if (!source || !target || source.sessionVersion !== proof.sourceSessionVersion || target.sessionVersion !== proof.targetSessionVersion || target.discordUserId !== proof.targetDiscordId) throw new ChangeValidationError('账号登录或绑定状态已变化，请重新授权');
  return { sourceDlmId: proof.sourceDlmId, targetDlmId: proof.targetDlmId, actorDlmId: proof.sourceDlmId,
    actorDiscordId: source.discordUserId, mode: 'SELF_SERVICE',
    expectedSourceSessionVersion: proof.sourceSessionVersion, expectedTargetSessionVersion: proof.targetSessionVersion,
    roleSnapshot: await fetchAccountMigrationRoleSnapshot(source.discordUserId, target.discordUserId),
  };
}
async function currentStatus() {
  const current = await getCurrentDlmUser();
  if (!current) return response({ ok: false, error: await renderSiteCopy("site.app.api.discord.change.route.71ec2312b34c") }, 401);
  const bindings = await prisma.accountBinding.findMany({ where: { dlmId: current.dlmId }, select: { provider: true } });
  return response({ ok: true, stage: 'idle', source: { dlmId: current.dlmId, discordId: current.discordUserId },
    canUnbind: !!current.discordUserId && bindings.some(b => b.provider === AccountProvider.WECHAT_WEB || b.provider === AccountProvider.WECHAT_MINIPROGRAM) });
}
export async function GET() {
  const proof = await readDiscordChangeProof();
  if (!proof?.targetDlmId) return currentStatus();
  try {
    const completed = await prisma.accountMigration.findUnique({ where: { id: proof.requestId } });
    if (completed && completed.sourceDlmId === proof.sourceDlmId && completed.targetDlmId === proof.targetDlmId && completed.mode === 'SELF_SERVICE' && completed.actorDlmId === proof.sourceDlmId) return response({ ok: true, stage: 'completed', result: completed.result });
    if (proof.sourceDlmId === proof.targetDlmId) return response({ ok: true, stage: 'same_account', source: { dlmId: proof.sourceDlmId, discordId: proof.targetDiscordId } });
    const input = await verifiedInput(proof);
    const preview = await prisma.$transaction(tx => previewAccountMigrationTx(tx, input));
    return response({ ok: true, stage: 'preview', preview });
  } catch (error) { return response({ ok: false, error: publicFailure(error, '读取预览失败，请稍后重新核实') }, error instanceof AccountMigrationError ? error.status : 409); }
}
export async function POST(request: Request) {
  const parsed = await readAdminJsonWrite(request, process.env.NEXTAUTH_URL); if (!parsed.ok) return parsed.response;
  const proof = await readDiscordChangeProof();
  if (!proof?.targetDlmId || !proof.targetDiscordId) return response({ ok: false, error: await renderSiteCopy("site.app.api.discord.change.route.28023cbe1088") }, 401);
  if (parsed.body.confirmed !== true || typeof parsed.body.expectedPreviewHash !== 'string') return response({ ok: false, error: await renderSiteCopy("site.app.api.discord.change.route.8d432e0dae29") }, 400);
  try {
    // A lost response can be queried using this exact signed request, even
    // after the merge invalidated/deleted the original account sessions.
    const existing = await prisma.accountMigration.findUnique({ where: { id: proof.requestId } });
    let result;
    if (existing) {
      if (existing.sourceDlmId !== proof.sourceDlmId || existing.targetDlmId !== proof.targetDlmId || existing.mode !== 'SELF_SERVICE' || existing.actorDlmId !== proof.sourceDlmId || existing.previewHash !== parsed.body.expectedPreviewHash) throw new ChangeValidationError('原请求记录与当前授权不一致');
      result = existing.result;
    } else {
      const input = await verifiedInput(proof);
      result = await runAccountMigration(prisma, { ...input, requestId: proof.requestId, expectedPreviewHash: parsed.body.expectedPreviewHash });
    }
    const res = response({ ok: true, result, requiresReauthentication: true });
    // Keep the short-lived request proof so a lost response can still recover
    // this exact result, even if response headers already cleared login cookies.
    destroySession(res); return res;
  } catch (error) {
    console.error('[discord.change] confirmation failed', error);
    return response({ ok: false, error: publicFailure(error, '未能确认合并结果，请查询原请求后重试') }, error instanceof AccountMigrationError ? error.status : 409);
  }
}
export async function DELETE(request: Request) {
  const parsed = await readAdminJsonWrite(request, process.env.NEXTAUTH_URL); if (!parsed.ok) return parsed.response;
  const res = response({ ok: true }); clearDiscordChangeProof(res); return res;
}
