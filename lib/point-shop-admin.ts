import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { normalizeVoucherDecimal, parseCustomVoucherRule, type CustomVoucherRule } from './custom-voucher';
import type { PointShopAdminData } from './point-shop-admin-types';
import { assertCopyImagesExist, copyImageName } from './editable-copy-image-storage';

export class PointShopAdminError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
const invalid = () => new PointShopAdminError('请检查填写内容', 400);
const conflict = () => new PointShopAdminError('该券已被修改，请刷新后重试', 409);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min: number, max = 2147483647) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
function parseImageUrl(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !copyImageName(value)) throw invalid();
  return value;
}

export function parsePointShopAdminFields(body: unknown) {
  if (!isRecord(body)) throw invalid();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const pointsCost = normalizeVoucherDecimal(body.pointsCost);
  const rule: CustomVoucherRule | null = body.voucherRule === null ? null : parseCustomVoucherRule(body.voucherRule);
  if (!name || name.length > 100 || description.length > 1000 || !pointsCost || Number(pointsCost) <= 0 ||
      (body.stock !== null && !integer(body.stock, 0)) ||
      !integer(body.couponExpireDays, 1, 36500) || !integer(body.sortOrder, 0) ||
      typeof body.isActive !== 'boolean' || (body.voucherRule !== null && !rule)) throw invalid();
  return {
    name, description: description || null, pointsCost: new Prisma.Decimal(pointsCost),
    ...(Object.hasOwn(body, 'imageUrl') ? { imageUrl: parseImageUrl(body.imageUrl) } : {}),
    stock: body.stock as number | null, couponExpireDays: body.couponExpireDays as number,
    sortOrder: body.sortOrder as number, isActive: body.isActive, voucherRule: rule,
  };
}

export async function readPointShopAdmin(db: Pick<PrismaClient, 'pointShopItem' | 'gift'>): Promise<PointShopAdminData> {
  const [items, gifts] = await Promise.all([
    db.pointShopItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    db.gift.findMany({
      where: { active: true, staffOnlyGift: false, price: { gt: 0 } },
      select: { GiftName: true }, orderBy: { GiftName: 'asc' },
    }),
  ]);
  return {
    items: items.map((item) => ({
      id: item.id, name: item.name, description: item.description ?? '',
      imageUrl: item.imageUrl,
      canEditVoucher: item.deliveryType === 'COUPON' || item.sku === 'BLOCK_STACK_VOUCHER',
      pointsCost: item.pointsCost.toString(), stock: item.stock,
      couponExpireDays: item.couponExpireDays, sortOrder: item.sortOrder,
      isActive: item.isActive, voucherRule: parseCustomVoucherRule(item.voucherRule),
      updatedAt: item.updatedAt.toISOString(),
    })),
    gifts: gifts.map((gift) => gift.GiftName),
  };
}

export async function savePointShopAdmin(
  db: Pick<PrismaClient, '$transaction'>,
  body: unknown,
  create: boolean,
) {
  if (!isRecord(body)) throw invalid();
  const id = typeof body.id === 'string' ? body.id : '';
  const expectedUpdatedAt = typeof body.expectedUpdatedAt === 'string' ? new Date(body.expectedUpdatedAt) : null;
  const toggleOnly = !create && body.action === 'toggle';
  const imageOnly = !create && body.action === 'image';
  if (!create && (!id || !expectedUpdatedAt || !Number.isFinite(expectedUpdatedAt.getTime()))) throw invalid();
  if (toggleOnly && typeof body.isActive !== 'boolean') throw invalid();
  const fields = toggleOnly || imageOnly ? null : parsePointShopAdminFields(body);
  const imageUrl = imageOnly ? parseImageUrl(body.imageUrl) : fields?.imageUrl;
  if (imageUrl) await assertCopyImagesExist({ imageUrl }, new Set(['imageUrl']));
  if (create && !fields?.voucherRule) throw invalid();

  return db.$transaction(async (tx) => {
    const current = create ? null : await tx.pointShopItem.findUnique({ where: { id } });
    if (!create && (!current || current.updatedAt.getTime() !== expectedUpdatedAt!.getTime())) throw conflict();
    if (current && !imageOnly && current.deliveryType !== 'COUPON' && current.sku !== 'BLOCK_STACK_VOUCHER') throw invalid();
    // Legacy coupons keep their identity and names: some pre-enum gift coupons
    // still use the original name during fulfillment. Never convert them in place.
    if (current && fields && ((current.voucherRule === null) !== (fields.voucherRule === null))) throw invalid();
    if (!imageOnly && current?.voucherRule != null && !parseCustomVoucherRule(current.voucherRule)) throw invalid();
    const rule = fields?.voucherRule ?? parseCustomVoucherRule(current?.voucherRule);
    const active = fields?.isActive ?? body.isActive;
    if (!imageOnly && active && rule?.kind === 'GIFT') {
      const gift = await tx.gift.findUnique({ where: { GiftName: rule.giftName } });
      if (!gift?.active || gift.staffOnlyGift || !gift.price?.gt(0)) throw invalid();
    }
    if (create) {
      return tx.pointShopItem.create({ data: {
        ...fields!, imageUrl: fields!.imageUrl ?? null, voucherRule: fields!.voucherRule!,
        sku: `CUSTOM_${randomUUID().replaceAll('-', '').toUpperCase()}`,
        deliveryType: 'COUPON', couponType: null,
      }, select: { id: true } });
    }
    const data = imageOnly ? { imageUrl } : fields ? {
      ...fields,
      name: current!.voucherRule === null ? current!.name : fields.name,
      voucherRule: fields.voucherRule ?? Prisma.DbNull,
    } : { isActive: body.isActive as boolean };
    // updatedAt also changes when stock is consumed: a stale inventory editor
    // must not restore units that have already been redeemed.
    const changed = await tx.pointShopItem.updateMany({
      where: { id, updatedAt: expectedUpdatedAt! }, data,
    });
    if (changed.count !== 1) throw conflict();
    return { id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
