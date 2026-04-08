import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ensureAppUserForMiniProgram, summarizeAppUser } from '@/lib/app-user';
import { createMiniProgramSession } from '@/lib/mini-program-session';
import { WeChatMiniProgramAuthError, exchangeMiniProgramCode } from '@/lib/wechat';

const normalizeString = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
};

const normalizeProfile = (raw: unknown) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      nickname: null,
      avatarUrl: null,
      payload: undefined as Prisma.InputJsonValue | undefined,
    };
  }

  const source = raw as Record<string, unknown>;
  const nickname = normalizeString(source.nickname, 64);
  const avatarUrl = normalizeString(source.avatarUrl, 512);
  const payload: Prisma.InputJsonObject = {};

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
    const profilePayload: Prisma.InputJsonObject = {
      openId: loginData.openid,
      unionId: loginData.unionid,
    };

    if (profile.payload && typeof profile.payload === 'object' && !Array.isArray(profile.payload)) {
      Object.assign(profilePayload, profile.payload);
    }

    const { user, bindingId } = await ensureAppUserForMiniProgram({
      openId: loginData.openid,
      unionId: loginData.unionid,
      displayName: profile.nickname,
      avatarUrl: profile.avatarUrl,
      profile: profilePayload,
    });

    const session = await createMiniProgramSession({
      userId: user.id,
      providerAccountId: bindingId,
    });

    return NextResponse.json({
      ok: true,
      user: summarizeAppUser(user),
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
