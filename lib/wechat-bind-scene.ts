import crypto from 'crypto';

type WechatBindScenePayload = {
  discordUserId: string;
  expiresAt: number;
};

const WECHAT_BIND_SCENE_TTL_MS = 1000 * 60 * 10;
const EXPIRY_LENGTH = 6;
const SIGNATURE_LENGTH = 6;
const DISCORD_ID_RE = /^\d{17,20}$/;

const getSecret = () => {
  const secret = process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET (or NEXTAUTH_SECRET) must be set');
  }
  return secret;
};

const getExpiryBucket = (timestamp: number) => Math.floor(timestamp / (60 * 1000));

const signPayload = (discordUserId: string, expiryCode: string) =>
  crypto.createHmac('sha256', getSecret()).update(`${discordUserId}.${expiryCode}`).digest('hex').slice(0, SIGNATURE_LENGTH);

export const createWechatBindSceneCode = (discordUserId: string) => {
  if (!DISCORD_ID_RE.test(discordUserId)) {
    throw new Error('invalid_discord_id');
  }

  const expiresAt = Date.now() + WECHAT_BIND_SCENE_TTL_MS;
  const expiryCode = getExpiryBucket(expiresAt).toString(36).padStart(EXPIRY_LENGTH, '0').slice(-EXPIRY_LENGTH);
  const signature = signPayload(discordUserId, expiryCode);

  return {
    code: `${discordUserId}${expiryCode}${signature}`,
    expiresAt: new Date(expiresAt),
  };
};

export const verifyWechatBindSceneCode = (code?: string | null): WechatBindScenePayload | null => {
  if (!code || typeof code !== 'string') {
    return null;
  }

  const normalized = code.trim();
  if (normalized.length <= EXPIRY_LENGTH + SIGNATURE_LENGTH) {
    return null;
  }

  const expiryCode = normalized.slice(-(EXPIRY_LENGTH + SIGNATURE_LENGTH), -SIGNATURE_LENGTH);
  const signature = normalized.slice(-SIGNATURE_LENGTH);
  const discordUserId = normalized.slice(0, -(EXPIRY_LENGTH + SIGNATURE_LENGTH));

  if (!DISCORD_ID_RE.test(discordUserId) || !/^[0-9a-z]{6}$/i.test(expiryCode) || !/^[0-9a-f]{6}$/i.test(signature)) {
    return null;
  }

  const expectedSignature = signPayload(discordUserId, expiryCode);
  if (expectedSignature !== signature.toLowerCase()) {
    return null;
  }

  const expiryBucket = Number.parseInt(expiryCode, 36);
  if (!Number.isFinite(expiryBucket)) {
    return null;
  }

  const expiresAt = expiryBucket * 60 * 1000;
  if (expiresAt < Date.now()) {
    return null;
  }

  return {
    discordUserId,
    expiresAt,
  };
};
