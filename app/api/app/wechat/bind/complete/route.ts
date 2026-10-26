import { NextResponse } from 'next/server';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import {
  isDiscordBindingError,
  mergeWechatProgramDlmUserIntoDlmUser,
} from '@/lib/discord-binding';
import { summarizeDlmUser } from '@/lib/dlm-user';
import { verifyWechatBindToken } from '@/lib/wechat-bind-token';
import { verifyWechatBindSceneCode } from '@/lib/wechat-bind-scene';
import { prisma } from '@/lib/prisma';

const statusForBindingError = (code: string) => {
  switch (code) {
    case 'canonical_user_not_found':
    case 'wechat_user_not_found':
      return 404;
    case 'dlm_user_already_bound_to_other_wechat':
      return 409;
    default:
      return 400;
  }
};

export async function POST(request: Request) {
  const currentUser = await getCurrentDlmUser(request);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (currentUser.sessionSource !== 'wechat_program') {
    return NextResponse.json({ ok: false, error: 'unsupported_session_source' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { bindToken?: string; bindCode?: string } | null;
  const bindToken = body?.bindToken?.trim();
  const bindCode = body?.bindCode?.trim();
  const tokenPayload = verifyWechatBindToken(bindToken);
  const scenePayload = tokenPayload ? null : verifyWechatBindSceneCode(bindCode);

  let canonicalDlmId: string | null = tokenPayload?.dlmId ?? null;
  if (!canonicalDlmId && scenePayload) {
    const canonicalUser = await prisma.dlmUser.findUnique({
      where: { discordUserId: scenePayload.discordUserId },
      select: { dlmId: true },
    });
    canonicalDlmId = canonicalUser?.dlmId ?? null;
  }

  if (!canonicalDlmId) {
    return NextResponse.json({ ok: false, error: bindCode ? 'invalid_bind_code' : 'invalid_bind_token' }, { status: 400 });
  }

  if (currentUser.dlmId === canonicalDlmId) {
    return NextResponse.json({
      ok: true,
      alreadyBound: true,
      user: summarizeDlmUser(currentUser.dlmUser),
    });
  }

  try {
    const mergedUser = await mergeWechatProgramDlmUserIntoDlmUser({
      canonicalDlmId,
      incomingWechatDlmId: currentUser.dlmId,
    });

    return NextResponse.json({
      ok: true,
      alreadyBound: false,
      user: summarizeDlmUser(mergedUser),
    });
  } catch (error) {
    if (isDiscordBindingError(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
        },
        { status: statusForBindingError(error.code) },
      );
    }

    console.error('[wechat.bind.complete] failed', error);
    return NextResponse.json({ ok: false, error: 'bind_failed' }, { status: 500 });
  }
}
