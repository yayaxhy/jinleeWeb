import { getSiteCopy } from "@/lib/site-copy-server";
import { wechatBindErrorMessage } from '@/lib/public-error-messages';
import QRCode from 'qrcode';
import { AccountProvider } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { prisma } from '@/lib/prisma';
import { createWechatBindToken } from '@/lib/wechat-bind-token';
import {
  WeChatMiniProgramAuthError,
  generateMiniProgramUrlLink,
} from '@/lib/wechat';

const resolveWechatBindingStatus = async (dlmId: string) => {
  const dlmUser = await prisma.dlmUser.findUnique({
    where: { dlmId },
    select: {
      wechatDisplayName: true,
      discordUserId: true,
      accountBindings: { select: { provider: true, providerUserId: true } },
    },
  });

  if (!dlmUser) {
    return null;
  }

  const bound = dlmUser.accountBindings.some(binding => binding.provider === AccountProvider.WECHAT_MINIPROGRAM || binding.provider === AccountProvider.WECHAT_WEB);
  const hasDiscordLogin = !!dlmUser.discordUserId && dlmUser.accountBindings.some(binding =>
    binding.provider === AccountProvider.DISCORD && binding.providerUserId === dlmUser.discordUserId);
  return { bound, wechatDisplayName: dlmUser.wechatDisplayName ?? null, canUnbind: bound && hasDiscordLogin };
};

const buildUnsupportedResponse = () =>
  NextResponse.json({ ok: false, error: 'unsupported_session_source' }, { status: 400 });

const isSchemePermissionError = (error: unknown) =>
  error instanceof WeChatMiniProgramAuthError &&
  error.code === 'wechat_generate_urllink_failed' &&
  error.message.toLowerCase().includes('no scheme permission');

const buildBindErrorResponse = async (error: unknown) => {
  const copy = await getSiteCopy();
  console.error('[wechat.bind] failed', error);
  if (error instanceof WeChatMiniProgramAuthError) {
    return NextResponse.json(
      {
        ok: false,
        error: error.code,
        message: copy.text(wechatBindErrorMessage(error.code), "site.lib.public.error.messages"),
      },
      { status: error.status },
    );
  }

  if (error instanceof Error && error.message === 'SESSION_SECRET (or NEXTAUTH_SECRET) must be set') {
    return NextResponse.json(
      {
        ok: false,
        error: 'bind_token_secret_missing',
        message: copy.text(wechatBindErrorMessage('bind_token_secret_missing'), "site.lib.public.error.messages"),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: false, error: 'bind_failed' }, { status: 500 });
};

export async function GET() {
  const currentUser = await getCurrentDlmUser();
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (currentUser.sessionSource !== 'web') {
    return buildUnsupportedResponse();
  }

  const status = await resolveWechatBindingStatus(currentUser.dlmId);
  if (!status) {
    return NextResponse.json({ ok: false, error: 'dlm_user_not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    ...status,
  });
}

export async function POST() {
  const currentUser = await getCurrentDlmUser();
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (currentUser.sessionSource !== 'web') {
    return buildUnsupportedResponse();
  }

  const status = await resolveWechatBindingStatus(currentUser.dlmId);
  if (!status) {
    return NextResponse.json({ ok: false, error: 'dlm_user_not_found' }, { status: 404 });
  }

  if (status.bound) {
    return NextResponse.json({
      ok: true,
      ...status,
    });
  }

  try {
    const { token, expiresAt } = createWechatBindToken(currentUser.dlmId, currentUser.dlmUser.sessionVersion);
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
