import crypto from 'crypto';

const DEFAULT_GATEWAY = 'https://z-pay.cn/submit.php';

export type ZPayChannel = 'alipay' | 'wxpay';

export const SUPPORTED_CHANNELS: ZPayChannel[] = ['alipay', 'wxpay'];

const md5 = (value: string) => crypto.createHash('md5').update(value, 'utf8').digest('hex');

type PlainParams = Record<string, string>;

export const buildSignaturePayload = (params: Record<string, string | undefined | null>) => {
  const keys = Object.keys(params)
    .filter((key) => {
      if (key === 'sign' || key === 'sign_type') return false;
      const value = params[key];
      return value !== undefined && value !== null;
    })
    .sort((a, b) => a.localeCompare(b));

  return keys.map((key) => `${key}=${params[key]}`).join('&');
};

export const buildZPaySignature = (params: Record<string, string | undefined | null>, secret: string) =>
  md5(buildSignaturePayload(params) + secret);

export const verifyZPaySignature = (
  params: Record<string, string | undefined | null>,
  secret: string,
  providedSign?: string | null,
) => {
  if (!providedSign) return false;
  const expected = buildZPaySignature(params, secret).toLowerCase();
  return expected === providedSign.toLowerCase();
};

export const buildZPayUrl = (params: PlainParams, secret: string, gateway = DEFAULT_GATEWAY) => {
  const sign = buildZPaySignature(params, secret);
  const searchParams = new URLSearchParams({ ...params, sign, sign_type: 'MD5' });
  return `${gateway}?${searchParams.toString()}`;
};

export const buildOutTradeNo = (discordId: string) => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const random = Math.floor(Math.random() * 900) + 100;
  const suffix = discordId.slice(-4);
  return `${timestamp}${random}${suffix}`;
};

export const getZPayGatewayUrl = () => process.env.ZPAY_GATEWAY_URL || DEFAULT_GATEWAY;

export const requiredZPayConfig = () => {
  const merchantId = process.env.ZPAY_MERCHANT_ID;
  const secret = process.env.ZPAY_SECRET_KEY;
  if (!merchantId || !secret) {
    throw new Error('ZPAY_MERCHANT_ID/ZPAY_SECRET_KEY are not configured');
  }
  return { merchantId, secret };
};
