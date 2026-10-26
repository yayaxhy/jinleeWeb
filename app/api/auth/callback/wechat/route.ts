import crypto from 'node:crypto';
import { AccountProvider, Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { recordAuthLoginEvent } from '@/lib/auth-login-audit';
import { ensureDlmUserForWechatWeb } from '@/lib/dlm-user';
import {
  attachSessionToResponse,
  clearWechatWebLoginRedirectCookie,
  clearWechatWebLoginStateCookie,
  getWechatWebLoginRedirectCookie,
  getWechatWebLoginStateCookie,
  normalizeRedirectTarget,
} from '@/lib/session';

const WECHAT_OAUTH_TOKEN_URL = 'https://api.weixin.qq.com/sns/oauth2/access_token';
const WECHAT_USER_INFO_URL = 'https://api.weixin.qq.com/sns/userinfo';

class WechatWebLoginError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

const getOrigin = (request: Request) => {
  const configured = process.env.SITE_ORIGIN?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (!configured) return new URL(request.url).origin;

  try {
    return new URL(configured).origin;
  } catch {
    return new URL(request.url).origin;
  }
};

const stringValue = (data: Record<string, unknown>, key: string, maxLength: number) => {
  const value = data[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const readWechatResponse = async (url: URL) => {
  const response = await fetch(url, { cache: 'no-store' });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== 'object' || Array.isArray(body)) {
    throw new WechatWebLoginError('wechat_oauth');
  }

  const data = body as Record<string, unknown>;
  const errorCode = data.errcode;
  if ((typeof errorCode === 'number' && errorCode !== 0) || (typeof errorCode === 'string' && errorCode !== '0')) {
    throw new WechatWebLoginError('wechat_oauth');
  }

  return data;
};

const sameState = (provided: string | null, expected: string | null) => {
  if (!provided || !expected || provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
};

const buildErrorRedirect = (origin: string, code: string) => {
  const loginUrl = new URL('/accounts/login', origin);
  loginUrl.searchParams.set('error', code);
  const response = NextResponse.redirect(loginUrl, { status: 302 });
  clearWechatWebLoginRedirectCookie(response);
  clearWechatWebLoginStateCookie(response);
  return response;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getOrigin(request);

  if (url.searchParams.get('error')) {
    return buildErrorRedirect(origin, 'wechat_denied');
  }

  const code = url.searchParams.get('code');
  const expectedState = await getWechatWebLoginStateCookie();
  if (!code || !sameState(url.searchParams.get('state'), expectedState)) {
    return buildErrorRedirect(origin, 'invalid_state');
  }

  const appId = process.env.WECHAT_WEB_APP_ID?.trim();
  const appSecret = process.env.WECHAT_WEB_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    return buildErrorRedirect(origin, 'wechat_not_configured');
  }

  try {
    const tokenUrl = new URL(WECHAT_OAUTH_TOKEN_URL);
    tokenUrl.searchParams.set('appid', appId);
    tokenUrl.searchParams.set('secret', appSecret);
    tokenUrl.searchParams.set('code', code);
    tokenUrl.searchParams.set('grant_type', 'authorization_code');
    const tokenData = await readWechatResponse(tokenUrl);
    const accessToken = stringValue(tokenData, 'access_token', 1024);
    const openId = stringValue(tokenData, 'openid', 256);
    if (!accessToken || !openId) {
      throw new WechatWebLoginError('wechat_oauth');
    }

    let userInfo: Record<string, unknown> = {};
    try {
      const userInfoUrl = new URL(WECHAT_USER_INFO_URL);
      userInfoUrl.searchParams.set('access_token', accessToken);
      userInfoUrl.searchParams.set('openid', openId);
      userInfoUrl.searchParams.set('lang', 'zh_CN');
      userInfo = await readWechatResponse(userInfoUrl);
    } catch (error) {
      // Token exchange can still identify an already-linked account. The
      // login must not depend on a cosmetic profile refresh.
      if (!(error instanceof WechatWebLoginError)) throw error;
    }

    const unionId = stringValue(tokenData, 'unionid', 256) ?? stringValue(userInfo, 'unionid', 256);
    const displayName = stringValue(userInfo, 'nickname', 64);
    const avatarUrl = stringValue(userInfo, 'headimgurl', 512);
    const profile: Record<string, string> = { openId };
    if (unionId) profile.unionId = unionId;
    if (displayName) profile.nickname = displayName;
    if (avatarUrl) profile.avatarUrl = avatarUrl;

    const { dlmUser } = await ensureDlmUserForWechatWeb({
      openId,
      unionId,
      displayName,
      avatarUrl,
      profile: profile as Prisma.InputJsonValue,
    });

    await recordAuthLoginEvent({
      request,
      dlmId: dlmUser.dlmId,
      discordUserId: dlmUser.discordUserId,
      provider: AccountProvider.WECHAT_WEB,
    }).catch((error) => console.error('[wechat.web.callback] login audit failed', error));

    const redirectTarget = normalizeRedirectTarget(await getWechatWebLoginRedirectCookie(), '/profile');
    const response = NextResponse.redirect(new URL(redirectTarget, origin), { status: 302 });
    attachSessionToResponse(response, {
      dlmId: dlmUser.dlmId,
      authProvider: 'wechat_web',
      discordId: dlmUser.discordUserId,
      username: displayName ?? dlmUser.wechatDisplayName ?? '微信用户',
      avatar: avatarUrl ?? dlmUser.wechatAvatarUrl ?? null,
      sessionVersion: dlmUser.sessionVersion,
    });
    clearWechatWebLoginRedirectCookie(response);
    clearWechatWebLoginStateCookie(response);
    return response;
  } catch (error) {
    if (error instanceof WechatWebLoginError) {
      return buildErrorRedirect(origin, error.code);
    }
    if (error instanceof Error && error.message === 'WECHAT_WEB_UNIONID_REQUIRED') {
      // Never create a separate wallet account when the Website Application
      // and mini program are not linked under one WeChat Open Platform entity.
      return buildErrorRedirect(origin, 'wechat_unionid_missing');
    }
    if (error instanceof Error && error.message === 'WECHAT_WEB_ACCOUNT_MISMATCH') {
      return buildErrorRedirect(origin, 'wechat_account_mismatch');
    }

    console.error('[wechat.web.callback] OAuth callback failed', error);
    return buildErrorRedirect(origin, 'wechat_oauth');
  }
}
