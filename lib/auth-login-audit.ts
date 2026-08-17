import crypto from 'node:crypto';
import { isIP } from 'node:net';
import { AccountProvider } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const MAX_USER_AGENT_LENGTH = 500;
const MAX_REFERRER_LENGTH = 500;
const VISITOR_COOKIE_NAME = 'jl_vid';

const getEncryptionKey = () => {
  const configured = process.env.AUTH_LOGIN_AUDIT_ENCRYPTION_KEY?.trim();
  if (!configured) {
    throw new Error('AUTH_LOGIN_AUDIT_ENCRYPTION_KEY is not configured');
  }

  const key = Buffer.from(configured, 'base64');
  if (key.length !== 32) {
    throw new Error('AUTH_LOGIN_AUDIT_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  return key;
};

const normalizeVisitorId = (value?: string | null) => {
  const normalized = value?.trim() ?? '';
  return /^[A-Za-z0-9_-]{8,128}$/.test(normalized) ? normalized : null;
};

const readCookie = (request: Request, name: string) => {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  const entry = cookieHeader.split(';').find((item) => item.trim().startsWith(`${name}=`));
  if (!entry) return null;
  return entry.slice(entry.indexOf('=') + 1);
};

export const getTrustedClientIp = (request: Request) => {
  // The production app listens only on localhost; Nginx overwrites this header with the remote IP.
  const value = request.headers.get('x-real-ip')?.trim();
  return value && isIP(value) ? value : null;
};

export const encryptAuthAuditIp = (ipAddress: string) => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(ipAddress, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const ipHash = crypto.createHmac('sha256', key).update(ipAddress, 'utf8').digest('base64url');

  return {
    encrypted: `v1.${iv.toString('base64url')}.${authTag.toString('base64url')}.${ciphertext.toString('base64url')}`,
    hash: `v1.${ipHash}`,
  };
};

export const decryptAuthAuditIp = (encryptedValue?: string | null) => {
  if (!encryptedValue) return null;
  try {
    const [version, rawIv, rawTag, rawCiphertext] = encryptedValue.split('.');
    if (version !== 'v1' || !rawIv || !rawTag || !rawCiphertext) return null;

    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(rawIv, 'base64url'));
    decipher.setAuthTag(Buffer.from(rawTag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(rawCiphertext, 'base64url')), decipher.final()]).toString('utf8');
  } catch (error) {
    console.error('[auth.login-audit] failed to decrypt IP address', error);
    return null;
  }
};

export const recordAuthLoginEvent = async (input: {
  request: Request;
  jinleeId: string;
  discordUserId?: string | null;
  provider: AccountProvider;
}) => {
  const ipAddress = getTrustedClientIp(input.request);
  let encryptedIp: { encrypted: string; hash: string } | null = null;
  if (ipAddress) {
    try {
      encryptedIp = encryptAuthAuditIp(ipAddress);
    } catch (error) {
      console.error('[auth.login-audit] IP encryption is unavailable', error);
    }
  }

  await prisma.authLoginEvent.create({
    data: {
      jinleeId: input.jinleeId,
      discordUserId: input.discordUserId ?? null,
      provider: input.provider,
      ipAddressEncrypted: encryptedIp?.encrypted ?? null,
      ipHash: encryptedIp?.hash ?? null,
      userAgent: input.request.headers.get('user-agent')?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
      referrer: input.request.headers.get('referer')?.slice(0, MAX_REFERRER_LENGTH) ?? null,
      visitorId: normalizeVisitorId(readCookie(input.request, VISITOR_COOKIE_NAME)),
    },
  });
};

export const getAuthLoginAuditRetentionDays = () => {
  const configured = Number(process.env.AUTH_LOGIN_AUDIT_RETENTION_DAYS ?? '365');
  if (!Number.isInteger(configured)) return 365;
  return Math.min(Math.max(configured, 30), 3650);
};

export const purgeExpiredAuthLoginEvents = async () => {
  const retentionDays = getAuthLoginAuditRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.authLoginEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return { deleted: result.count, retentionDays, cutoff };
};
