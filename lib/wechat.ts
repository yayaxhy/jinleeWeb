type Code2SessionResponse = {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
};

export class WeChatMiniProgramAuthError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const requiredMiniProgramConfig = () => {
  const appId = process.env.WECHAT_MINIPROGRAM_APPID;
  const appSecret = process.env.WECHAT_MINIPROGRAM_APP_SECRET;

  if (!appId || !appSecret) {
    throw new WeChatMiniProgramAuthError(
      'wechat_config_missing',
      'WECHAT_MINIPROGRAM_APPID and WECHAT_MINIPROGRAM_APP_SECRET must be set',
      500,
    );
  }

  return { appId, appSecret };
};

export const exchangeMiniProgramCode = async (code: string) => {
  const trimmedCode = code.trim();
  if (!trimmedCode) {
    throw new WeChatMiniProgramAuthError('invalid_code', 'Missing mini program login code', 400);
  }

  const { appId, appSecret } = requiredMiniProgramConfig();
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', appSecret);
  url.searchParams.set('js_code', trimmedCode);
  url.searchParams.set('grant_type', 'authorization_code');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new WeChatMiniProgramAuthError(
      'wechat_http_error',
      `WeChat code2Session failed with HTTP ${response.status}`,
      502,
    );
  }

  const payload = (await response.json()) as Code2SessionResponse;

  if (payload.errcode) {
    throw new WeChatMiniProgramAuthError(
      'wechat_code2session_failed',
      payload.errmsg ?? `code2Session failed with errcode ${payload.errcode}`,
      502,
    );
  }

  if (!payload.openid) {
    throw new WeChatMiniProgramAuthError(
      'wechat_openid_missing',
      'WeChat code2Session response did not include openid',
      502,
    );
  }

  return {
    openid: payload.openid,
    unionid: payload.unionid ?? null,
    sessionKey: payload.session_key ?? null,
  };
};
