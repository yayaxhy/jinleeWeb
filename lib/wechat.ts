type Code2SessionResponse = {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
};

type ClientCredentialResponse = {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

type GenerateUrlLinkResponse = {
  url_link?: string;
  errcode?: number;
  errmsg?: string;
};

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

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

export const getMiniProgramAccessToken = async () => {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60 * 1000) {
    return cachedAccessToken.token;
  }

  const { appId, appSecret } = requiredMiniProgramConfig();
  const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
  url.searchParams.set('grant_type', 'client_credential');
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', appSecret);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new WeChatMiniProgramAuthError(
      'wechat_access_token_http_error',
      `WeChat access token request failed with HTTP ${response.status}`,
      502,
    );
  }

  const payload = (await response.json()) as ClientCredentialResponse;
  if (payload.errcode || !payload.access_token || !payload.expires_in) {
    throw new WeChatMiniProgramAuthError(
      'wechat_access_token_failed',
      payload.errmsg ?? `WeChat access token request failed with errcode ${payload.errcode ?? 'unknown'}`,
      502,
    );
  }

  cachedAccessToken = {
    token: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };

  return cachedAccessToken.token;
};

export const generateMiniProgramUrlLink = async (params: {
  path: string;
  query?: string;
  expireDays?: number;
  envVersion?: 'release' | 'trial' | 'develop';
}) => {
  const accessToken = await getMiniProgramAccessToken();
  const response = await fetch(
    `https://api.weixin.qq.com/wxa/generate_urllink?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        path: params.path,
        query: params.query ?? '',
        env_version: params.envVersion ?? (process.env.WECHAT_MINIPROGRAM_ENV_VERSION as 'release' | 'trial' | 'develop' | undefined) ?? 'release',
        expire_type: 1,
        expire_interval: Math.min(Math.max(params.expireDays ?? 1, 1), 30),
      }),
    },
  );

  if (!response.ok) {
    throw new WeChatMiniProgramAuthError(
      'wechat_generate_urllink_http_error',
      `WeChat generate_urllink failed with HTTP ${response.status}`,
      502,
    );
  }

  const payload = (await response.json()) as GenerateUrlLinkResponse;
  if (payload.errcode || !payload.url_link) {
    throw new WeChatMiniProgramAuthError(
      'wechat_generate_urllink_failed',
      payload.errmsg ?? `generate_urllink failed with errcode ${payload.errcode ?? 'unknown'}`,
      502,
    );
  }

  return payload.url_link;
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
