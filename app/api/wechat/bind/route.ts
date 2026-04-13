import QRCode from 'qrcode';
import { AccountProvider } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import { prisma } from '@/lib/prisma';
import { createWechatBindSceneCode } from '@/lib/wechat-bind-scene';
import { createWechatBindToken } from '@/lib/wechat-bind-token';
import {
  WeChatMiniProgramAuthError,
  generateMiniProgramCodeDataUrl,
  generateMiniProgramUrlLink,
} from '@/lib/wechat';

const resolveWechatBindingStatus = async (jinleeId: string) => {
  const jinleeUser = await prisma.jinleeUser.findUnique({
    where: { jinleeId },
    select: {
      wechatDisplayName: true,
      accountBindings: {
        where: {
          provider: AccountProvider.WECHAT_MINIPROGRAM,
        },
        select: {
          providerUserId: true,
        },
      },
    },
  });

  if (!jinleeUser) {
    return null;
  }

  return {
    bound: jinleeUser.accountBindings.length > 0,
    wechatDisplayName: jinleeUser.wechatDisplayName ?? null,
    canUnbind: jinleeUser.accountBindings.length > 0,
  };
};

const buildUnsupportedResponse = () =>
  NextResponse.json({ ok: false, error: 'unsupported_session_source' }, { status: 400 });

const isSchemePermissionError = (error: unknown) =>
  error instanceof WeChatMiniProgramAuthError &&
  error.code === 'wechat_generate_urllink_failed' &&
  error.message.toLowerCase().includes('no scheme permission');

const buildBindErrorResponse = (error: unknown) => {
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

  if (error instanceof Error && error.message === 'SESSION_SECRET (or NEXTAUTH_SECRET) must be set') {
    return NextResponse.json(
      {
        ok: false,
        error: 'bind_token_secret_missing',
        message: error.message,
      },
      { status: 500 },
    );
  }

  console.error('[wechat.bind] failed', error);
  return NextResponse.json({ ok: false, error: 'bind_failed' }, { status: 500 });
};

export async function GET() {
  const currentUser = await getCurrentJinleeUser();
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (currentUser.sessionSource !== 'web') {
    return buildUnsupportedResponse();
  }

  const status = await resolveWechatBindingStatus(currentUser.jinleeId);
  if (!status) {
    return NextResponse.json({ ok: false, error: 'jinlee_user_not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    ...status,
  });
}

export async function POST() {
  const currentUser = await getCurrentJinleeUser();
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (currentUser.sessionSource !== 'web') {
    return buildUnsupportedResponse();
  }

  const status = await resolveWechatBindingStatus(currentUser.jinleeId);
  if (!status) {
    return NextResponse.json({ ok: false, error: 'jinlee_user_not_found' }, { status: 404 });
  }

  if (status.bound) {
    return NextResponse.json({
      ok: true,
      ...status,
    });
  }

  try {
    const { token, expiresAt } = createWechatBindToken(currentUser.jinleeId);
    try {
      const urlLink = await generateMiniProgramUrlLink({
        path: 'pages/wechat-bind/index',
        query: `bindToken=${encodeURIComponent(token)}`,
        expireDays: 1,
      });

      const qrCodeDataUrl = await QRCode.toDataURL(urlLink, {
        margin: 1,
        width: 360,
      });

      return NextResponse.json({
        ok: true,
        bound: false,
        canUnbind: false,
        wechatDisplayName: null,
        qrCodeDataUrl,
        urlLink,
        expiresAt: expiresAt.toISOString(),
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (isSchemePermissionError(error)) {
        try {
          const scene = createWechatBindSceneCode(currentUser.discordUserId ?? '');
          const qrCodeDataUrl = await generateMiniProgramCodeDataUrl({
            page: 'pages/wechat-bind/index',
            scene: scene.code,
            width: 360,
          });

          return NextResponse.json({
            ok: true,
            bound: false,
            canUnbind: false,
            wechatDisplayName: null,
            fallbackMode: 'mini_program_code',
            qrCodeDataUrl,
            expiresAt: scene.expiresAt.toISOString(),
            generatedAt: new Date().toISOString(),
          });
        } catch (codeError) {
          console.error('[wechat.bind] mini program code fallback failed', codeError);
        }

        return NextResponse.json({
          ok: true,
          bound: false,
          canUnbind: false,
          wechatDisplayName: null,
          fallbackMode: 'manual_code',
          bindToken: token,
          expiresAt: expiresAt.toISOString(),
          generatedAt: new Date().toISOString(),
          warning: 'wechat_no_scheme_permission',
        });
      }

      throw error;
    }
  } catch (error) {
    return buildBindErrorResponse(error);
  }
}
