import crypto from 'crypto';

type WechatBindTokenPayload = {
  dlmId: string;
  issuedAt: number;
  expiresAt: number;
  sessionVersion: number;
  version: 2;
};

const WECHAT_BIND_TOKEN_TTL_MS = 1000 * 60 * 10;

const getSecret = () => {
  const secret = process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET (or NEXTAUTH_SECRET) must be set');
  }
  return secret;
};

const base64UrlEncode = (data: Buffer) => data.toString('base64url');
const base64UrlDecode = (value: string) => Buffer.from(value, 'base64url');

const signPayload = (payload: string) =>
  crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');

const encodeToken = (payload: WechatBindTokenPayload) => {
  const json = Buffer.from(JSON.stringify(payload));
  const encoded = base64UrlEncode(json);
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
};

export const createWechatBindToken = (dlmId: string, sessionVersion: number) => {
  const payload: WechatBindTokenPayload = {
    dlmId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + WECHAT_BIND_TOKEN_TTL_MS,
    sessionVersion,
    version: 2,
  };

  return {
    token: encodeToken(payload),
    expiresAt: new Date(payload.expiresAt),
  };
};

export const verifyWechatBindToken = (token?: string | null): WechatBindTokenPayload | null => {
  if (!token) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) {
    return null;
  }

  const expected = signPayload(encoded);
  const valid =
    Buffer.byteLength(expected) === Buffer.byteLength(signature) &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

  if (!valid) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encoded).toString()) as WechatBindTokenPayload;
    if (payload.version !== 2 || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now() || !payload.dlmId || !Number.isSafeInteger(payload.sessionVersion) || payload.sessionVersion < 1) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};
