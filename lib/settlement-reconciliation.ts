import path from 'node:path';
import sharp from 'sharp';
import { Prisma, SettlementReconciliationStatus } from '@prisma/client';
import { isAdminDiscordId } from '@/lib/admin';
import { parseStoredWithdrawAccount } from '@/lib/withdrawAccounts';

export const SETTLEMENT_CNY = 'CNY';
export const SETTLEMENT_WECHAT_OWNER_ID = '308164614846414851';
export const SETTLEMENT_ALIPAY_OWNER_ID = '1008032640445710447';
export const MAX_SETTLEMENT_RECEIPT_BYTES = 10 * 1024 * 1024;

export const getSettlementReceiptStorageDir = () =>
  process.env.SETTLEMENT_RECEIPT_STORAGE_DIR?.trim() ||
  path.join(process.cwd(), 'storage', 'settlement-receipts');

export const isSettlementFinance = (discordId?: string | null) => isAdminDiscordId(discordId);

export const isRmbCurrency = (currency?: string | null) =>
  (currency ?? '').trim().toUpperCase() === SETTLEMENT_CNY;

export const normalizeCurrency = (value: unknown) =>
  typeof value === 'string' ? value.trim().toUpperCase().slice(0, 12) : '';

export const parsePositiveDecimal = (value: unknown) => {
  const raw = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
  if (!/^\d+(?:\.\d{1,4})?$/.test(raw)) return null;
  const parsed = new Prisma.Decimal(raw);
  return parsed.gt(0) ? parsed : null;
};

export const isReconciliationCounted = (status: SettlementReconciliationStatus) =>
  status !== SettlementReconciliationStatus.INVALIDATED;

export const resolveWithdrawalSettlementOwner = (storedMethod: string) => {
  const parsed = parseStoredWithdrawAccount(storedMethod);
  const method = (parsed?.method ?? storedMethod).trim().toLowerCase();
  if (method === '微信' || method === 'wechat') return SETTLEMENT_WECHAT_OWNER_ID;
  if (method === '支付宝' || method === 'alipay') return SETTLEMENT_ALIPAY_OWNER_ID;
  return null;
};

type ReceiptImage = {
  buffer: Buffer;
  extension: '.png' | '.jpg' | '.webp';
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
};

/** Validate actual image bytes rather than trusting a browser-provided MIME type. */
export async function validateSettlementReceipt(file: File): Promise<ReceiptImage> {
  if (!file || file.size <= 0 || file.size > MAX_SETTLEMENT_RECEIPT_BYTES) {
    throw new Error('截图必须是小于 10MB 的图片。');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(buffer, { failOn: 'error' }).metadata().catch(() => null);
  if (!metadata || !metadata.format || metadata.width === undefined || metadata.height === undefined) {
    throw new Error('上传文件不是有效图片。');
  }

  if (metadata.format === 'png') return { buffer, extension: '.png', mimeType: 'image/png' };
  if (metadata.format === 'jpeg') return { buffer, extension: '.jpg', mimeType: 'image/jpeg' };
  if (metadata.format === 'webp') return { buffer, extension: '.webp', mimeType: 'image/webp' };
  throw new Error('截图仅支持 PNG、JPG 或 WebP 格式。');
}

export const safeOriginalFileName = (value: string) => {
  const name = path.basename(value || 'receipt-image');
  return name.slice(0, 180) || 'receipt-image';
};
