import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { isAdminDiscordId } from '@/lib/admin';
import {
  executeAssetTransfer,
  loadAssetAccountSummary,
} from '@/lib/admin-asset-transfer';
import { normalizeDiscordId, isDiscordSnowflake } from '@/lib/discord-id';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';

const INTERNAL_HOST = process.env.INTERNAL_API_HOST ?? '127.0.0.1';
const INTERNAL_PORT = process.env.INTERNAL_API_PORT;
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN;

const ensureAdminSession = async () => {
  const session = await getServerSession();
  if (!session?.discordId || !isAdminDiscordId(session.discordId)) {
    return null;
  }
  return session;
};

type AssetTransferBody = {
  sourceDiscordId?: string;
  targetDiscordId?: string;
  forceMerge?: boolean;
};

const callInternalSpentRoleSync = async (discordId: string) => {
  if (!INTERNAL_PORT || !INTERNAL_TOKEN) {
    return '内部 spent-role 同步未配置，数据库已完成转移，但 Discord 角色需要后续手动同步。';
  }

  const endpoint = `http://${INTERNAL_HOST}:${INTERNAL_PORT}/internal/spent-role/sync`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
    },
    body: JSON.stringify({
      discordId,
      includeSpendRoles: true,
      announceVipUpgrade: false,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof result?.error === 'string' ? result.error : `内部接口错误 (${response.status})`;
    return `spent-role 同步失败（${discordId}）：${message}`;
  }

  return null;
};

export async function POST(request: NextRequest) {
  const session = await ensureAdminSession();
  if (!session) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  let body: AssetTransferBody;
  try {
    body = (await request.json()) as AssetTransferBody;
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const sourceDiscordId = normalizeDiscordId(body?.sourceDiscordId);
  const targetDiscordId = normalizeDiscordId(body?.targetDiscordId);
  const forceMerge = body?.forceMerge === true;

  if (!isDiscordSnowflake(sourceDiscordId) || !isDiscordSnowflake(targetDiscordId)) {
    return NextResponse.json({ error: '请输入 17-20 位纯数字 Discord 雪花 ID' }, { status: 400 });
  }

  if (sourceDiscordId === targetDiscordId) {
    return NextResponse.json({ error: '源账号和目标账号不能相同' }, { status: 400 });
  }

  const [sourceSummary, targetSummary] = await Promise.all([
    loadAssetAccountSummary(prisma, sourceDiscordId),
    loadAssetAccountSummary(prisma, targetDiscordId),
  ]);

  if (!sourceSummary.memberExists || !sourceSummary.jinleeId) {
    return NextResponse.json({ error: '源账号不存在，或尚未建立 Jinlee 身份' }, { status: 404 });
  }

  if (sourceSummary.peiwan.exists && targetSummary.peiwan.exists) {
    return NextResponse.json(
      { error: '源账号和目标账号都存在独立陪玩档案，当前不支持自动合并两套陪玩身份。' },
      { status: 400 },
    );
  }

  if (!sourceSummary.hasTransferableData) {
    return NextResponse.json({ error: '源账号当前没有可转移的资产' }, { status: 400 });
  }

  if (!targetSummary.memberExists || !targetSummary.jinleeId) {
    return NextResponse.json({ error: '目标账号不存在，或尚未建立 Jinlee 身份' }, { status: 404 });
  }

  if (targetSummary.hasTransferableData && !forceMerge) {
    return NextResponse.json(
      {
        error: '目标账号已经有可转移资产。确认后会按规则合并钱包/消费额/积分，并覆盖基础抽成与 VIP 配置。',
        requiresForceMerge: true,
        source: sourceSummary,
        target: targetSummary,
      },
      { status: 409 },
    );
  }

  try {
    const result = await prisma.$transaction(
      (tx) =>
        executeAssetTransfer(tx, {
          operatorDiscordId: session.discordId ?? null,
          sourceDiscordId,
          targetDiscordId,
          forceMerge,
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const syncWarnings = (
      await Promise.all([callInternalSpentRoleSync(sourceDiscordId), callInternalSpentRoleSync(targetDiscordId)])
    ).filter((warning): warning is string => Boolean(warning));

    return NextResponse.json({
      message: '资产转移完成',
      auditId: result.auditId,
      transferred: result.transferred,
      changed: result.changed,
      warnings: [...result.warnings, ...syncWarnings],
      source: result.source,
      target: result.target,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '资产转移失败，请稍后再试' },
      { status: 400 },
    );
  }
}
