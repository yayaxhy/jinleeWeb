import { NextResponse } from 'next/server';
import { AccountProvider, Prisma } from '@prisma/client';
import { ensureJinleeUserForWechatProgram, summarizeJinleeUser } from '@/lib/jinlee-user';
import { createWechatProgramSession } from '@/lib/wechat-program-session';
import { WeChatMiniProgramAuthError, exchangeMiniProgramCode } from '@/lib/wechat';
import { recordAuthLoginEvent } from '@/lib/auth-login-audit';

const normalizeString = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
};

const normalizeProfile = (raw: unknown) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      nickname: undefined as string | undefined,
      avatarUrl: undefined as string | undefined,
      payload: undefined as Prisma.InputJsonValue | undefined,
    };
  }

  const source = raw as Record<string, unknown>;
  const nickname = normalizeString(source.nickname, 64) ?? undefined;
  const avatarUrl = normalizeString(source.avatarUrl, 512) ?? undefined;
  const payload: Record<string, string> = {};

  if (nickname) {
    payload.nickname = nickname;
  }
  if (avatarUrl) {
    payload.avatarUrl = avatarUrl;
  }

  return {
    nickname,
    avatarUrl,
    payload: Object.keys(payload).length > 0 ? payload : undefined,
  };
};

export async function POST(request: Request) {
  let body: Record<string, unknown> | null = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const code = normalizeString(body?.code, 512);
  if (!code) {
    return NextResponse.json({ ok: false, error: 'missing_code' }, { status: 400 });
  }

  const profile = normalizeProfile(body?.profile);

  try {
    const loginData = await exchangeMiniProgramCode(code);
    const profilePayload: Record<string, string> = {
      openId: loginData.openid,
    };
    if (loginData.unionid) {
      profilePayload.unionId = loginData.unionid;
    }

    if (profile.payload && typeof profile.payload === 'object' && !Array.isArray(profile.payload)) {
      Object.assign(profilePayload, profile.payload as Record<string, string>);
    }

    const { jinleeUser, bindingId } = await ensureJinleeUserForWechatProgram({
      openId: loginData.openid,
      unionId: loginData.unionid,
      displayName: profile.nickname,
      avatarUrl: profile.avatarUrl,
      profile: profilePayload as Prisma.InputJsonValue,
    });

    const session = await createWechatProgramSession({
      jinleeId: jinleeUser.jinleeId,
      providerAccountId: bindingId,
    });
    await recordAuthLoginEvent({
      request,
      jinleeId: jinleeUser.jinleeId,
      discordUserId: jinleeUser.discordUserId,
      provider: AccountProvider.WECHAT_MINIPROGRAM,
    }).catch((error) => console.error('[wechat.mini-program.login] login audit failed', error));

    return NextResponse.json({
      ok: true,
      user: summarizeJinleeUser(jinleeUser),
      session: {
        token: session.token,
        expiresAt: session.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof WeChatMiniProgramAuthError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          message: error.message,
        },
        { status: error.status },
      );
    }

    console.error('[wechat.mini-program.login] unexpected error', error);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
