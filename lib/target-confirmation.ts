import { createHmac, timingSafeEqual } from 'node:crypto';

export const TARGET_CONFIRMATION_TTL_MS = 5 * 60 * 1000;
export const TARGET_CONFIRMATION_MESSAGE = '目标确认已失效或账号绑定已变化，请重新查询并确认对象。';
const DOMAIN = 'jinlee-web:target-confirmation:v1\0';
const MAX_TOKEN_LENGTH = 8192;

export class TargetConfirmationError extends Error {
  constructor(message = TARGET_CONFIRMATION_MESSAGE, readonly status = 409, readonly code = 'TARGET_CONFIRMATION_REQUIRED') {
    super(message); this.name = 'TargetConfirmationError';
  }
}
const fail = (): never => { throw new TargetConfirmationError(); };
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
};
const keys = (value: Record<string, unknown>, allowed: string[], required = allowed) => {
  if (Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !(key in value))) fail();
};
const string = (value: unknown, max = 128): string => {
  if (typeof value !== 'string' || !value || value.length > max || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) return fail();
  return value;
};
const optional = (value: unknown, max = 128) => value === undefined || value === null || value === '' ? null : string(value, max);
const discord = (value: unknown): string => { const id = string(value, 20); return /^\d{17,20}$/.test(id) ? id : fail(); };

export type ConfirmationIdentity = { dlmId: string; discordUserId: string | null };
export type ConfirmationTarget = ConfirmationIdentity & { discordUserId: string; peiwanId?: number; displayName: string };
export type ConfirmationPayer = ConfirmationIdentity & { displayName: string };
export type ConfirmationVoucher = { source: 'coupon' | 'pointshop' | 'lottery'; voucherId: string; prizeName: string };
export type TargetConfirmationScope = {
  purpose: 'gift' | 'voucher' | 'delegated-gift'; target: string;
  prizeName: string | null; couponId: string | null; lotteryId: string | null;
  payerDlmId: string | null; giftName: string | null; quantity: number | null;
};
const SCOPE_KEYS = ['purpose', 'target', 'prizeName', 'couponId', 'lotteryId', 'payerDlmId', 'giftName', 'quantity'];

/** Keep the original normalized request scope separate from the exact selected
 * voucher. A legacy prize-only request is bound to one selected voucher too. */
export function normalizeTargetConfirmationScope(raw: unknown): TargetConfirmationScope {
  const value = object(raw); keys(value, SCOPE_KEYS, ['purpose', 'target']);
  const purpose = value.purpose;
  if (purpose !== 'gift' && purpose !== 'voucher' && purpose !== 'delegated-gift') return fail();
  const target = string(typeof value.target === 'string' ? value.target.trim() : value.target, 20);
  if (!/^\d{1,20}$/.test(target)) return fail();
  const normalizedText = (field: string, max = 128) => optional(typeof value[field] === 'string' ? value[field].trim() : value[field], max);
  const scope: TargetConfirmationScope = {
    purpose, target, prizeName: normalizedText('prizeName', 160), couponId: normalizedText('couponId'), lotteryId: normalizedText('lotteryId'),
    payerDlmId: normalizedText('payerDlmId'), giftName: normalizedText('giftName', 160),
    quantity: value.quantity == null ? null : typeof value.quantity === 'number' && Number.isFinite(value.quantity) && value.quantity > 0 && value.quantity <= Number.MAX_SAFE_INTEGER ? value.quantity : fail(),
  };
  if (purpose === 'delegated-gift') {
    if (!scope.payerDlmId || !scope.giftName || scope.quantity === null || scope.prizeName || scope.couponId || scope.lotteryId) return fail();
  } else {
    if (scope.payerDlmId || scope.giftName || scope.quantity !== null || (scope.couponId && scope.lotteryId)) return fail();
    if (purpose === 'gift' ? !scope.couponId && !scope.lotteryId : !scope.prizeName && !scope.couponId && !scope.lotteryId) return fail();
  }
  return scope;
}

const identity = (raw: unknown): ConfirmationIdentity => {
  const value = object(raw); keys(value, ['dlmId', 'discordUserId']);
  return { dlmId: string(value.dlmId), discordUserId: value.discordUserId === null ? null : discord(value.discordUserId) };
};
const target = (raw: unknown): ConfirmationTarget => {
  const value = object(raw); keys(value, ['dlmId', 'discordUserId', 'peiwanId', 'displayName'], ['dlmId', 'discordUserId', 'displayName']);
  const peiwanId = value.peiwanId;
  if (peiwanId !== undefined && (typeof peiwanId !== 'number' || !Number.isSafeInteger(peiwanId) || peiwanId <= 0 || peiwanId > 2147483647)) return fail();
  return { dlmId: string(value.dlmId), discordUserId: discord(value.discordUserId), displayName: string(value.displayName, 256), ...(typeof peiwanId === 'number' ? { peiwanId } : {}) };
};
const payer = (raw: unknown): ConfirmationPayer | null => {
  if (raw === null) return null;
  const value = object(raw); keys(value, ['dlmId', 'discordUserId', 'displayName']);
  return { ...identity({ dlmId: value.dlmId, discordUserId: value.discordUserId }), displayName: string(value.displayName, 256) };
};
const voucher = (raw: unknown): ConfirmationVoucher | null => {
  if (raw === null) return null;
  const value = object(raw); keys(value, ['source', 'voucherId', 'prizeName']);
  if (value.source !== 'coupon' && value.source !== 'pointshop' && value.source !== 'lottery') return fail();
  return { source: value.source, voucherId: string(value.voucherId), prizeName: string(value.prizeName, 160) };
};
export type TargetConfirmationEvidence = {
  caller: ConfirmationIdentity; scope: TargetConfirmationScope; target: ConfirmationTarget;
  payer: ConfirmationPayer | null; selectedVoucher: ConfirmationVoucher | null;
};
type Claims = TargetConfirmationEvidence & { version: 1; issuedAt: number; expiresAt: number };
function claims(raw: unknown): Claims {
  const value = object(raw); keys(value, ['version', 'issuedAt', 'expiresAt', 'caller', 'scope', 'target', 'payer', 'selectedVoucher']);
  if (value.version !== 1 || typeof value.issuedAt !== 'number' || !Number.isSafeInteger(value.issuedAt) || value.issuedAt < 0 ||
      typeof value.expiresAt !== 'number' || !Number.isSafeInteger(value.expiresAt) || value.expiresAt - value.issuedAt !== TARGET_CONFIRMATION_TTL_MS) return fail();
  const result: Claims = { version: 1, issuedAt: value.issuedAt, expiresAt: value.expiresAt,
    caller: identity(value.caller), scope: normalizeTargetConfirmationScope(value.scope), target: target(value.target), payer: payer(value.payer), selectedVoucher: voucher(value.selectedVoucher) };
  if (result.scope.purpose === 'delegated-gift') {
    if (!result.payer || result.payer.dlmId !== result.scope.payerDlmId || !result.target.peiwanId || result.selectedVoucher) return fail();
  } else {
    if (result.payer || !result.selectedVoucher) return fail();
    const selected = result.selectedVoucher;
    if ((result.scope.prizeName && selected.prizeName !== result.scope.prizeName) ||
        (result.scope.couponId && (selected.source === 'lottery' || selected.voucherId !== result.scope.couponId)) ||
        (result.scope.lotteryId && (selected.source !== 'lottery' || selected.voucherId !== result.scope.lotteryId))) return fail();
  }
  return result;
}

/** No process env, DB, sessions or network: both clock and secret are injected. */
export function createTargetConfirmationCodec(deps: { secret: string; now?: () => number }) {
  if (!deps.secret) throw new Error('目标确认签名服务未配置');
  const now = deps.now ?? Date.now;
  const sign = (encoded: string) => createHmac('sha256', deps.secret).update(DOMAIN).update(encoded).digest();
  return {
    issue(evidence: TargetConfirmationEvidence) {
      const issuedAt = now();
      const payload = claims({ ...evidence, version: 1, issuedAt, expiresAt: issuedAt + TARGET_CONFIRMATION_TTL_MS });
      const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const confirmationToken = `${encoded}.${sign(encoded).toString('base64url')}`;
      if (confirmationToken.length > MAX_TOKEN_LENGTH) return fail();
      return { confirmationToken, expiresAt: new Date(payload.expiresAt).toISOString() };
    },
    verify(token: unknown, caller: ConfirmationIdentity, scope: TargetConfirmationScope): Claims {
      if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return fail();
      const [encoded, signature] = token.split('.');
      const actual = Buffer.from(signature, 'base64url');
      if (actual.length !== 32 || actual.toString('base64url') !== signature || !timingSafeEqual(actual, sign(encoded))) return fail();
      let payload: Claims;
      try {
        const bytes = Buffer.from(encoded, 'base64url');
        if (bytes.toString('base64url') !== encoded) return fail();
        payload = claims(JSON.parse(bytes.toString('utf8')));
      } catch { return fail(); }
      const currentTime = now();
      if (!Number.isSafeInteger(currentTime) || currentTime < payload.issuedAt || currentTime >= payload.expiresAt ||
          JSON.stringify(payload.caller) !== JSON.stringify(identity({ dlmId: caller.dlmId, discordUserId: caller.discordUserId })) ||
          JSON.stringify(payload.scope) !== JSON.stringify(normalizeTargetConfirmationScope(scope))) return fail();
      return payload;
    },
  };
}
export type TargetConfirmationCodec = ReturnType<typeof createTargetConfirmationCodec>;
