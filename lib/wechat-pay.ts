import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const WECHAT_PAY_API_BASE = 'https://api.mch.weixin.qq.com';
const SIGNATURE_TOLERANCE_SECONDS = 60 * 5;

type WechatPayConfig = {
  appId: string;
  mchId: string;
  apiV3Key: string;
  certificateSerialNo: string;
  privateKeyPem: string;
  publicKeyPem: string;
  publicKeyId?: string;
  notifyUrl: string;
  orderDescriptionPrefix: string;
};

type NativePrepayResponse = {
  code_url: string;
};

type QueryTransactionResponse = {
  appid: string;
  mchid: string;
  out_trade_no: string;
  transaction_id?: string;
  trade_state: string;
  trade_type?: string;
  amount: {
    total: number;
    currency?: string;
    payer_total?: number;
    payer_currency?: string;
  };
  payer?: {
    openid?: string;
  };
};

type VerifySignatureInput = {
  serial: string;
  signature: string;
  timestamp: string;
  nonce: string;
  body: string;
};

type WechatPayResource = {
  algorithm: string;
  ciphertext: string;
  nonce: string;
  associated_data?: string;
  original_type?: string;
};

export class WechatPayApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'WechatPayApiError';
    this.status = status;
    this.body = body;
  }
}

const resolveAbsoluteUrl = (raw: string | undefined, fallback: string) => {
  const base = process.env.SITE_ORIGIN ?? 'https://jinlee.vip';
  const candidate = raw ?? `${base}${fallback}`;
  try {
    return new URL(candidate).toString();
  } catch {
    throw new Error(`Invalid URL configured: ${candidate}`);
  }
};

const resolveFilePath = (filePath: string) =>
  path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

const readPemFile = async (envName: string) => {
  const filePath = process.env[envName];
  if (!filePath) {
    throw new Error(`${envName} is not configured`);
  }
  return fs.readFile(resolveFilePath(filePath), 'utf8');
};

const loadWechatPayConfig = async (): Promise<WechatPayConfig> => {
  const appId = process.env.WECHAT_PAY_APP_ID;
  const mchId = process.env.WECHAT_PAY_MCH_ID;
  const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY;
  const certificateSerialNo = process.env.WECHAT_PAY_CERT_SERIAL_NO;

  if (!appId || !mchId || !apiV3Key || !certificateSerialNo) {
    throw new Error(
      'WECHAT_PAY_APP_ID/WECHAT_PAY_MCH_ID/WECHAT_PAY_API_V3_KEY/WECHAT_PAY_CERT_SERIAL_NO are required',
    );
  }

  const [privateKeyPem, publicKeyPem] = await Promise.all([
    readPemFile('WECHAT_PAY_PRIVATE_KEY_PATH'),
    readPemFile('WECHAT_PAY_PUBLIC_KEY_PATH'),
  ]);

  return {
    appId,
    mchId,
    apiV3Key,
    certificateSerialNo,
    privateKeyPem,
    publicKeyPem,
    publicKeyId: process.env.WECHAT_PAY_PUBLIC_KEY_ID || undefined,
    notifyUrl: resolveAbsoluteUrl(process.env.WECHAT_PAY_NOTIFY_URL, '/api/payment/wechat/notify'),
    orderDescriptionPrefix: process.env.WECHAT_PAY_ORDER_DESCRIPTION_PREFIX ?? '锦鲤俱乐部账户充值',
  };
};

const buildSignatureMessage = (
  method: string,
  canonicalUrl: string,
  timestamp: string,
  nonce: string,
  body: string,
) => `${method}\n${canonicalUrl}\n${timestamp}\n${nonce}\n${body}\n`;

const signMessage = (privateKeyPem: string, message: string) => {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(message);
  signer.end();
  return signer.sign(privateKeyPem, 'base64');
};

const verifyMessageSignature = (publicKeyPem: string, message: string, signature: string) => {
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(message);
  verifier.end();
  return verifier.verify(publicKeyPem, signature, 'base64');
};

const assertFreshTimestamp = (timestamp: string) => {
  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp)) {
    throw new Error('invalid_signature_timestamp');
  }

  const ageInSeconds = Math.abs(Math.floor(Date.now() / 1000) - numericTimestamp);
  if (ageInSeconds > SIGNATURE_TOLERANCE_SECONDS) {
    throw new Error('signature_expired');
  }
};

const verifyWechatPaySignature = async (input: VerifySignatureInput) => {
  const config = await loadWechatPayConfig();

  if (config.publicKeyId && input.serial !== config.publicKeyId) {
    throw new Error(`unexpected_wechatpay_serial:${input.serial}`);
  }

  assertFreshTimestamp(input.timestamp);

  const verificationMessage = `${input.timestamp}\n${input.nonce}\n${input.body}\n`;
  if (!verifyMessageSignature(config.publicKeyPem, verificationMessage, input.signature)) {
    throw new Error('signature_verification_failed');
  }
};

const parseJsonBody = <T>(body: string) => {
  if (!body) {
    return {} as T;
  }
  return JSON.parse(body) as T;
};

const requestWechatPay = async <T>(
  method: 'GET' | 'POST',
  requestPath: string,
  body?: Record<string, unknown>,
) => {
  const config = await loadWechatPayConfig();
  const url = new URL(requestPath, WECHAT_PAY_API_BASE);
  const requestBody = body ? JSON.stringify(body) : '';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(16).toString('hex');
  const canonicalUrl = `${url.pathname}${url.search}`;
  const signatureMessage = buildSignatureMessage(method, canonicalUrl, timestamp, nonce, requestBody);
  const signature = signMessage(config.privateKeyPem, signatureMessage);

  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization:
        `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",` +
        `nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${config.certificateSerialNo}",` +
        `signature="${signature}"`,
      'User-Agent': 'jinlee.vip/1.0',
    },
    body: requestBody || undefined,
  });

  const responseBody = await response.text();
  const responseSignature = response.headers.get('Wechatpay-Signature');
  const responseTimestamp = response.headers.get('Wechatpay-Timestamp');
  const responseNonce = response.headers.get('Wechatpay-Nonce');
  const responseSerial = response.headers.get('Wechatpay-Serial');

  if (!responseSignature || !responseTimestamp || !responseNonce || !responseSerial) {
    throw new Error('wechatpay_response_signature_missing');
  }

  await verifyWechatPaySignature({
    serial: responseSerial,
    signature: responseSignature,
    timestamp: responseTimestamp,
    nonce: responseNonce,
    body: responseBody,
  });

  if (!response.ok) {
    throw new WechatPayApiError(
      `Wechat Pay API request failed with status ${response.status}`,
      response.status,
      responseBody,
    );
  }

  return parseJsonBody<T>(responseBody);
};

export const buildWechatPayOrderDescription = (name?: string | null) => {
  const base = (name ?? '').trim();
  const prefix = process.env.WECHAT_PAY_ORDER_DESCRIPTION_PREFIX ?? '锦鲤俱乐部账户充值';
  const description = base ? `${prefix}-${base}` : prefix;
  return description.slice(0, 127);
};

export const createNativeRechargeOrder = async (params: {
  outTradeNo: string;
  amountFen: number;
  description: string;
}) => {
  const config = await loadWechatPayConfig();
  const response = await requestWechatPay<NativePrepayResponse>('POST', '/v3/pay/transactions/native', {
    appid: config.appId,
    mchid: config.mchId,
    description: params.description,
    out_trade_no: params.outTradeNo,
    notify_url: config.notifyUrl,
    amount: {
      total: params.amountFen,
      currency: 'CNY',
    },
  });

  if (!response.code_url) {
    throw new Error('wechatpay_native_code_url_missing');
  }

  return {
    codeUrl: response.code_url,
  };
};

export const queryNativeRechargeOrder = async (outTradeNo: string) => {
  const config = await loadWechatPayConfig();
  const encodedOutTradeNo = encodeURIComponent(outTradeNo);
  return requestWechatPay<QueryTransactionResponse>(
    'GET',
    `/v3/pay/transactions/out-trade-no/${encodedOutTradeNo}?mchid=${encodeURIComponent(config.mchId)}`,
  );
};

export const verifyWechatPayCallbackSignature = async (headers: Headers, body: string) => {
  const signature = headers.get('Wechatpay-Signature');
  const timestamp = headers.get('Wechatpay-Timestamp');
  const nonce = headers.get('Wechatpay-Nonce');
  const serial = headers.get('Wechatpay-Serial');

  if (!signature || !timestamp || !nonce || !serial) {
    throw new Error('wechatpay_callback_signature_missing');
  }

  await verifyWechatPaySignature({
    serial,
    signature,
    timestamp,
    nonce,
    body,
  });
};

export const decryptWechatPayResource = async <T>(resource: WechatPayResource) => {
  const config = await loadWechatPayConfig();
  if (resource.algorithm !== 'AEAD_AES_256_GCM') {
    throw new Error(`unsupported_wechatpay_algorithm:${resource.algorithm}`);
  }

  const ciphertext = Buffer.from(resource.ciphertext, 'base64');
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16);

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(config.apiV3Key, 'utf8'),
    Buffer.from(resource.nonce, 'utf8'),
  );

  decipher.setAAD(Buffer.from(resource.associated_data ?? '', 'utf8'));
  decipher.setAuthTag(authTag);

  const plainText = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  return JSON.parse(plainText) as T;
};

export const getWechatPayIdentity = async () => {
  const config = await loadWechatPayConfig();
  return {
    appId: config.appId,
    mchId: config.mchId,
  };
};
