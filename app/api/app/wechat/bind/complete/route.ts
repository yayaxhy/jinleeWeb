import { NextResponse } from 'next/server';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import {
  isDiscordBindingError,
  mergeWechatProgramJinleeUserIntoJinleeUser,
} from '@/lib/discord-binding';
import { summarizeJinleeUser } from '@/lib/jinlee-user';
import { verifyWechatBindToken } from '@/lib/wechat-bind-token';
import { verifyWechatBindSceneCode } from '@/lib/wechat-bind-scene';
import { prisma } from '@/lib/prisma';

const statusForBindingError = (code: string) => {
  switch (code) {
    case 'canonical_user_not_found':
    case 'wechat_user_not_found':
      return 404;
    case 'jinlee_user_already_bound_to_other_wechat':
      return 409;
    default:
      return 400;
  }
};

export async function POST(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
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

  let canonicalJinleeId: string | null = tokenPayload?.jinleeId ?? null;
  if (!canonicalJinleeId && scenePayload) {
    const canonicalUser = await prisma.jinleeUser.findUnique({
      where: { discordUserId: scenePayload.discordUserId },
      select: { jinleeId: true },
    });
    canonicalJinleeId = canonicalUser?.jinleeId ?? null;
  }

  if (!canonicalJinleeId) {
    return NextResponse.json({ ok: false, error: bindCode ? 'invalid_bind_code' : 'invalid_bind_token' }, { status: 400 });
  }

  if (currentUser.jinleeId === canonicalJinleeId) {
    return NextResponse.json({
      ok: true,
      alreadyBound: true,
      user: summarizeJinleeUser(currentUser.jinleeUser),
    });
  }

  try {
    const mergedUser = await mergeWechatProgramJinleeUserIntoJinleeUser({
      canonicalJinleeId,
      incomingWechatJinleeId: currentUser.jinleeId,
    });

    return NextResponse.json({
      ok: true,
      alreadyBound: false,
      user: summarizeJinleeUser(mergedUser),
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
