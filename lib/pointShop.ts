import {
  CouponStatus,
  CouponType,
  PointShopCartStatus,
  PointShopDeliveryStatus,
  PointShopDeliveryType,
  PointShopOrderStatus,
  PointShopPointLedgerType,
  Prisma,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

const DEC = (value: Prisma.Decimal | number | string) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);

const DEFAULT_COUPON_EXPIRE_DAYS = 30;
const MAX_CART_QTY_PER_ITEM = 99;
const MAX_CHECKOUT_RETRIES = 3;
const POINT_SHOP_SYSTEM_ACCOUNT = 'SYSTEM';
const BLOCK_STACK_VOUCHER_SKUS = new Set(['BLOCK_STACK_VOUCHER']);

class CheckoutAbortError extends Error {
  result: CheckoutCartResult;

  constructor(result: CheckoutCartResult) {
    super(result.status);
    this.name = 'CheckoutAbortError';
    this.result = result;
  }
}

export type PointShopItemView = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  pointsCost: Prisma.Decimal;
  stock: number | null;
  deliveryType: PointShopDeliveryType;
  balanceCreditAmount: Prisma.Decimal | null;
};

export type PointShopCartLineView = {
  itemId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPoints: Prisma.Decimal;
  subtotalPoints: Prisma.Decimal;
  stock: number | null;
};

export type PointShopCartView = {
  cartId: string;
  version: number;
  updatedAt: Date;
  lines: PointShopCartLineView[];
  totalQuantity: number;
  totalPoints: Prisma.Decimal;
};

export type PointShopDashboard = {
  points: Prisma.Decimal;
  items: PointShopItemView[];
  cart: PointShopCartView | null;
};

export type AddCartItemResult =
  | { status: 'ok'; cart: PointShopCartView }
  | { status: 'item_not_found' }
  | { status: 'quantity_invalid' }
  | { status: 'stock_insufficient'; available: number };

export type RemoveCartItemResult =
  | { status: 'ok'; cart: PointShopCartView }
  | { status: 'empty_cart' }
  | { status: 'item_not_in_cart' }
  | { status: 'quantity_invalid' };

export type ClearCartResult =
  | { status: 'ok'; cart: PointShopCartView }
  | { status: 'empty_cart' };

export type CheckoutCartResult =
  | {
      status: 'ok';
      requestKey: string;
      orderId: string;
      totalPoints: Prisma.Decimal;
      totalItems: number;
      deliveredItems: number;
      pendingItems: number;
      pointsBefore: Prisma.Decimal;
      pointsAfter: Prisma.Decimal;
    }
  | {
      status: 'already_processed';
      requestKey: string;
      orderId: string;
      totalPoints: Prisma.Decimal;
      totalItems: number;
    }
  | {
      status: 'empty_cart';
      requestKey: string;
    }
  | {
      status: 'insufficient_points';
      requestKey: string;
      have: Prisma.Decimal;
      need: Prisma.Decimal;
    }
  | {
      status: 'item_unavailable';
      requestKey: string;
      sku: string;
      reason: 'inactive' | 'missing';
    }
  | {
      status: 'stock_insufficient';
      requestKey: string;
      sku: string;
      available: number;
    };

const normalizeSku = (input: string) => input.trim().toUpperCase();
const isBlockStackVoucherSku = (sku: string) => BLOCK_STACK_VOUCHER_SKUS.has(normalizeSku(sku));

const normalizeRequestKey = (input?: string | null) => {
  const value = (input ?? '').trim();
  if (!value) return null;
  return value.slice(0, 120);
};

const isRetryableTxError = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';

async function withSerializableRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      return await fn();
    } catch (err) {
      if (!isRetryableTxError(err) || attempt >= MAX_CHECKOUT_RETRIES) throw err;
    }
  }
}

async function getOrCreateOpenCartTx(tx: Prisma.TransactionClient, userId: string) {
  const existing = await tx.pointShopCart.findFirst({
    where: { discordUserId: userId, status: PointShopCartStatus.OPEN },
    orderBy: { updatedAt: 'desc' },
  });
  if (existing) return existing;

  try {
    return await tx.pointShopCart.create({
      data: {
        discordUserId: userId,
        status: PointShopCartStatus.OPEN,
        version: 1,
      },
    });
  } catch (error) {
    // The DB enforces one OPEN cart per user via partial unique index.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const fallback = await tx.pointShopCart.findFirst({
        where: { discordUserId: userId, status: PointShopCartStatus.OPEN },
        orderBy: { updatedAt: 'desc' },
      });
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function loadOpenCartViewTx(tx: Prisma.TransactionClient, userId: string): Promise<PointShopCartView | null> {
  const cart = await tx.pointShopCart.findFirst({
    where: { discordUserId: userId, status: PointShopCartStatus.OPEN },
    orderBy: { updatedAt: 'desc' },
    include: {
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
              stock: true,
            },
          },
        },
      },
    },
  });

  if (!cart) return null;

  let totalPoints = DEC(0);
  let totalQuantity = 0;

  const lines: PointShopCartLineView[] = cart.items.map((line) => {
    const subtotalPoints = DEC(line.unitPoints).mul(line.quantity);
    totalPoints = totalPoints.add(subtotalPoints);
    totalQuantity += line.quantity;
    return {
      itemId: line.itemId,
      sku: line.item?.sku ?? line.itemId,
      name: line.item?.name ?? line.itemNameSnapshot,
      quantity: line.quantity,
      unitPoints: DEC(line.unitPoints),
      subtotalPoints,
      stock: line.item?.stock ?? null,
    };
  });

  return {
    cartId: cart.id,
    version: cart.version,
    updatedAt: cart.updatedAt,
    lines,
    totalQuantity,
    totalPoints,
  };
}

async function getCurrentPointsTx(tx: Prisma.TransactionClient, userId: string): Promise<Prisma.Decimal> {
  const row = await tx.loyaltyPoint.findUnique({
    where: { discordUserId: userId },
    select: { points: true },
  });
  return DEC(row?.points ?? 0);
}

export async function getPointShopDashboard(userId: string): Promise<PointShopDashboard> {
  return prisma.$transaction(async (tx) => {
    const [points, items, cart] = await Promise.all([
      getCurrentPointsTx(tx, userId),
      tx.pointShopItem.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          sku: true,
          name: true,
          description: true,
          pointsCost: true,
          stock: true,
          deliveryType: true,
          balanceCreditAmount: true,
        },
      }),
      loadOpenCartViewTx(tx, userId),
    ]);

    return {
      points,
      items,
      cart,
    };
  });
}

export async function addPointShopCartItem(params: {
  userId: string;
  sku: string;
  quantity: number;
}): Promise<AddCartItemResult> {
  const sku = normalizeSku(params.sku);
  const quantity = Math.trunc(params.quantity);
  if (!sku || !Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_CART_QTY_PER_ITEM) {
    return { status: 'quantity_invalid' };
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.pointShopItem.findFirst({
      where: {
        isActive: true,
        sku: { equals: sku, mode: 'insensitive' },
      },
      select: {
        id: true,
        sku: true,
        name: true,
        pointsCost: true,
        stock: true,
      },
    });
    if (!item) return { status: 'item_not_found' as const };

    const cart = await getOrCreateOpenCartTx(tx, params.userId);

    const existing = await tx.pointShopCartItem.findUnique({
      where: {
        cartId_itemId: {
          cartId: cart.id,
          itemId: item.id,
        },
      },
      select: { quantity: true },
    });

    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > MAX_CART_QTY_PER_ITEM) {
      return { status: 'quantity_invalid' as const };
    }

    if (item.stock !== null && nextQuantity > item.stock) {
      return { status: 'stock_insufficient' as const, available: item.stock };
    }

    await tx.pointShopCartItem.upsert({
      where: {
        cartId_itemId: {
          cartId: cart.id,
          itemId: item.id,
        },
      },
      create: {
        cartId: cart.id,
        itemId: item.id,
        quantity,
        unitPoints: item.pointsCost,
        itemNameSnapshot: item.name,
      },
      update: {
        quantity: { increment: quantity },
        unitPoints: item.pointsCost,
        itemNameSnapshot: item.name,
      },
    });

    await tx.pointShopCart.update({
      where: { id: cart.id },
      data: { version: { increment: 1 } },
    });

    const view = await loadOpenCartViewTx(tx, params.userId);
    return { status: 'ok' as const, cart: view! };
  });
}

export async function removePointShopCartItem(params: {
  userId: string;
  sku: string;
  quantity: number;
}): Promise<RemoveCartItemResult> {
  const sku = normalizeSku(params.sku);
  const quantity = Math.trunc(params.quantity);
  if (!sku || !Number.isInteger(quantity) || quantity <= 0) {
    return { status: 'quantity_invalid' };
  }

  return prisma.$transaction(async (tx) => {
    const cart = await tx.pointShopCart.findFirst({
      where: { discordUserId: params.userId, status: PointShopCartStatus.OPEN },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    if (!cart) return { status: 'empty_cart' as const };

    const line = await tx.pointShopCartItem.findFirst({
      where: {
        cartId: cart.id,
        item: {
          sku: { equals: sku, mode: 'insensitive' },
        },
      },
      select: { id: true, quantity: true },
    });

    if (!line) return { status: 'item_not_in_cart' as const };

    if (quantity >= line.quantity) {
      await tx.pointShopCartItem.delete({ where: { id: line.id } });
    } else {
      await tx.pointShopCartItem.update({
        where: { id: line.id },
        data: { quantity: { decrement: quantity } },
      });
    }

    await tx.pointShopCart.update({
      where: { id: cart.id },
      data: { version: { increment: 1 } },
    });

    const view = await loadOpenCartViewTx(tx, params.userId);
    if (!view) return { status: 'empty_cart' as const };
    return { status: 'ok' as const, cart: view };
  });
}

export async function clearPointShopCart(userId: string): Promise<ClearCartResult> {
  return prisma.$transaction(async (tx) => {
    const cart = await tx.pointShopCart.findFirst({
      where: { discordUserId: userId, status: PointShopCartStatus.OPEN },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, version: true },
    });

    if (!cart) return { status: 'empty_cart' as const };

    await tx.pointShopCartItem.deleteMany({ where: { cartId: cart.id } });
    const updated = await tx.pointShopCart.update({
      where: { id: cart.id },
      data: { version: { increment: 1 } },
      select: { id: true, version: true, updatedAt: true },
    });

    return {
      status: 'ok' as const,
      cart: {
        cartId: updated.id,
        version: updated.version,
        updatedAt: updated.updatedAt,
        lines: [],
        totalQuantity: 0,
        totalPoints: DEC(0),
      },
    };
  });
}

async function deliverOrderItemTx(
  tx: Prisma.TransactionClient,
  params: {
    orderId: string;
    orderItemId: string;
    itemSku: string;
    itemName: string;
    ownerId: string;
    quantity: number;
    unitPoints: Prisma.Decimal;
    subtotalPoints: Prisma.Decimal;
    deliveryType: PointShopDeliveryType;
    couponType: CouponType | null;
    couponExpireDays: number | null;
    balanceCreditAmount: Prisma.Decimal | null;
  },
) {
  const {
    orderId,
    orderItemId,
    itemSku,
    itemName,
    ownerId,
    quantity,
    unitPoints,
    subtotalPoints,
    deliveryType,
    couponType,
    couponExpireDays,
    balanceCreditAmount,
  } = params;

  if (isBlockStackVoucherSku(itemSku)) {
    const days = couponExpireDays && couponExpireDays > 0 ? couponExpireDays : DEFAULT_COUPON_EXPIRE_DAYS;
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + days * 24 * 60 * 60 * 1000);

    await tx.pointShopGrant.createMany({
      data: Array.from({ length: quantity }, () => ({
        orderId,
        orderItemId,
        discordUserId: ownerId,
        deliveryType: PointShopDeliveryType.COUPON,
        itemSku,
        itemName,
        quantity: 1,
        unitPoints,
        subtotalPoints: unitPoints,
        deliveryStatus: PointShopDeliveryStatus.DELIVERED,
        deliveryNote: '自动发放（积木游戏代金券）',
        couponStatus: CouponStatus.ACTIVE,
        issuedAt,
        expiresAt,
      })),
    });

    await tx.pointShopOrderItem.update({
      where: { id: orderItemId },
      data: {
        deliveryStatus: PointShopDeliveryStatus.DELIVERED,
        deliveryNote: `自动发放 ${quantity} 张（积木游戏代金券）`,
      },
    });
    return;
  }

  if (deliveryType === PointShopDeliveryType.COUPON && couponType) {
    const days = couponExpireDays && couponExpireDays > 0 ? couponExpireDays : DEFAULT_COUPON_EXPIRE_DAYS;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await tx.pointShopGrant.createMany({
      data: Array.from({ length: quantity }, () => ({
        orderId,
        orderItemId,
        discordUserId: ownerId,
        deliveryType: PointShopDeliveryType.COUPON,
        itemSku,
        itemName,
        quantity: 1,
        unitPoints,
        subtotalPoints: unitPoints,
        deliveryStatus: PointShopDeliveryStatus.DELIVERED,
        deliveryNote: '自动发放（积分商城券）',
        couponType,
        couponStatus: CouponStatus.ACTIVE,
        issuedAt: new Date(),
        expiresAt,
      })),
    });

    await tx.pointShopOrderItem.update({
      where: { id: orderItemId },
      data: {
        deliveryStatus: PointShopDeliveryStatus.DELIVERED,
        deliveryNote: `自动发放 ${quantity} 张（积分商城券）`,
      },
    });
    return;
  }

  if (deliveryType === PointShopDeliveryType.COUPON && !couponType) {
    await tx.pointShopGrant.create({
      data: {
        orderId,
        orderItemId,
        discordUserId: ownerId,
        deliveryType: PointShopDeliveryType.COUPON,
        itemSku,
        itemName,
        quantity,
        unitPoints,
        subtotalPoints,
        deliveryStatus: PointShopDeliveryStatus.FAILED,
        deliveryNote: '配置错误：未设置券类型',
        issuedAt: new Date(),
      },
    });

    await tx.pointShopOrderItem.update({
      where: { id: orderItemId },
      data: {
        deliveryStatus: PointShopDeliveryStatus.FAILED,
        deliveryNote: '配置错误：未设置券类型',
      },
    });
    return;
  }

  if (deliveryType === PointShopDeliveryType.BALANCE) {
    const unitCredit = DEC(balanceCreditAmount ?? 0);
    if (unitCredit.lte(0)) {
      await tx.pointShopGrant.create({
        data: {
          orderId,
          orderItemId,
          discordUserId: ownerId,
          deliveryType: PointShopDeliveryType.BALANCE,
          itemSku,
          itemName,
          quantity,
          unitPoints,
          subtotalPoints,
          deliveryStatus: PointShopDeliveryStatus.FAILED,
          deliveryNote: '配置错误：未设置到账金额',
          issuedAt: new Date(),
        },
      });

      await tx.pointShopOrderItem.update({
        where: { id: orderItemId },
        data: {
          deliveryStatus: PointShopDeliveryStatus.FAILED,
          deliveryNote: '配置错误：未设置到账金额',
        },
      });
      return;
    }

    const amountChange = unitCredit.mul(quantity);
    const member = await tx.member.findUnique({
      where: { discordUserId: ownerId },
      select: { totalBalance: true },
    });
    const balanceBefore = DEC(member?.totalBalance ?? 0);
    const balanceAfter = balanceBefore.add(amountChange);

    await tx.member.update({
      where: { discordUserId: ownerId },
      data: {
        totalBalance: { increment: amountChange },
        recharge: { increment: amountChange },
      },
    });

    await tx.individualTransaction.create({
      data: {
        discordId: ownerId,
        thirdPartydiscordId: POINT_SHOP_SYSTEM_ACCOUNT,
        balanceBefore,
        amountChange,
        balanceAfter,
        typeOfTransaction: '积分商城余额兑换',
      },
    });

    const note = `自动到账 ${itemName} +${amountChange.toString()}`;
    await tx.pointShopGrant.create({
      data: {
        orderId,
        orderItemId,
        discordUserId: ownerId,
        deliveryType: PointShopDeliveryType.BALANCE,
        itemSku,
        itemName,
        quantity,
        unitPoints,
        subtotalPoints,
        deliveryStatus: PointShopDeliveryStatus.DELIVERED,
        deliveryNote: note,
        consumeAmount: amountChange,
        issuedAt: new Date(),
      },
    });

    await tx.pointShopOrderItem.update({
      where: { id: orderItemId },
      data: {
        deliveryStatus: PointShopDeliveryStatus.DELIVERED,
        deliveryNote: note,
      },
    });
    return;
  }

  await tx.pointShopGrant.create({
    data: {
      orderId,
      orderItemId,
      discordUserId: ownerId,
      deliveryType,
      itemSku,
      itemName,
      quantity,
      unitPoints,
      subtotalPoints,
      deliveryStatus: PointShopDeliveryStatus.PENDING,
      deliveryNote: '需人工发放',
      issuedAt: new Date(),
    },
  });

  await tx.pointShopOrderItem.update({
    where: { id: orderItemId },
    data: {
      deliveryStatus: PointShopDeliveryStatus.PENDING,
      deliveryNote: '需人工发放',
    },
  });
}

export async function checkoutPointShopCart(params: {
  userId: string;
  requestKey?: string | null;
}): Promise<CheckoutCartResult> {
  try {
    return await withSerializableRetry(() =>
      prisma.$transaction(async (tx) => {
      const cartRows = await tx.$queryRaw<Array<{ id: string; version: number }>>(
        Prisma.sql`
          SELECT "id", "version"
          FROM "PointShopCart"
          WHERE "discordUserId" = ${params.userId}
            AND "status" = 'OPEN'
          ORDER BY "updatedAt" DESC
          LIMIT 1
          FOR UPDATE
        `,
      );

      const cart = cartRows[0];
      const requestKey = normalizeRequestKey(params.requestKey) ?? `auto:${cart?.id ?? 'none'}:v${cart?.version ?? 0}`;

      if (!cart) {
        return { status: 'empty_cart' as const, requestKey };
      }

      const existing = await tx.pointShopOrder.findUnique({
        where: {
          discordUserId_requestKey: {
            discordUserId: params.userId,
            requestKey,
          },
        },
        select: {
          id: true,
          totalPoints: true,
          totalItems: true,
        },
      });

      if (existing) {
        return {
          status: 'already_processed' as const,
          requestKey,
          orderId: existing.id,
          totalPoints: existing.totalPoints,
          totalItems: existing.totalItems,
        };
      }

      const lines = await tx.pointShopCartItem.findMany({
        where: { cartId: cart.id },
        include: {
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
              isActive: true,
              stock: true,
              deliveryType: true,
              couponType: true,
              couponExpireDays: true,
              balanceCreditAmount: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!lines.length) {
        return { status: 'empty_cart' as const, requestKey };
      }

      let totalPoints = DEC(0);
      let totalItems = 0;
      for (const line of lines) {
        const item = line.item;
        if (!item) {
          return {
            status: 'item_unavailable' as const,
            requestKey,
            sku: line.itemId,
            reason: 'missing' as const,
          };
        }
        if (!item.isActive) {
          return {
            status: 'item_unavailable' as const,
            requestKey,
            sku: item.sku,
            reason: 'inactive' as const,
          };
        }

        totalPoints = totalPoints.add(DEC(line.unitPoints).mul(line.quantity));
        totalItems += line.quantity;
      }

      const pointsRow = await tx.loyaltyPoint.findUnique({
        where: { discordUserId: params.userId },
        select: { points: true },
      });
      const pointsBefore = DEC(pointsRow?.points ?? 0);

      if (pointsBefore.lt(totalPoints)) {
        return {
          status: 'insufficient_points' as const,
          requestKey,
          have: pointsBefore,
          need: totalPoints,
        };
      }

      for (const line of lines) {
        const item = line.item;
        if (!item) {
          return {
            status: 'item_unavailable' as const,
            requestKey,
            sku: line.itemId,
            reason: 'missing' as const,
          };
        }

        if (item.stock === null) continue;

        const reserved = await tx.pointShopItem.updateMany({
          where: {
            id: item.id,
            isActive: true,
            stock: { gte: line.quantity },
          },
          data: {
            stock: { decrement: line.quantity },
          },
        });

        if (reserved.count === 0) {
          const latest = await tx.pointShopItem.findUnique({
            where: { id: item.id },
            select: { stock: true, sku: true, isActive: true },
          });
          if (!latest?.isActive) {
            throw new CheckoutAbortError({
              status: 'item_unavailable' as const,
              requestKey,
              sku: latest?.sku ?? item.sku,
              reason: 'inactive' as const,
            });
          }
          throw new CheckoutAbortError({
            status: 'stock_insufficient' as const,
            requestKey,
            sku: latest?.sku ?? item.sku,
            available: latest?.stock ?? 0,
          });
        }
      }

      const pointsAfter = pointsBefore.sub(totalPoints);
      if (pointsRow) {
        await tx.loyaltyPoint.update({
          where: { discordUserId: params.userId },
          data: { points: pointsAfter },
        });
      } else {
        await tx.loyaltyPoint.create({
          data: { discordUserId: params.userId, points: pointsAfter },
        });
      }

      const order = await tx.pointShopOrder.create({
        data: {
          discordUserId: params.userId,
          cartId: cart.id,
          requestKey,
          status: PointShopOrderStatus.SUCCESS,
          totalPoints,
          totalItems,
        },
        select: { id: true },
      });

      await tx.pointShopPointLedger.create({
        data: {
          discordUserId: params.userId,
          orderId: order.id,
          ledgerType: PointShopPointLedgerType.DEBIT,
          deltaPoints: totalPoints,
          balanceBefore: pointsBefore,
          balanceAfter: pointsAfter,
          reason: '积分商城兑换',
        },
      });

      const createdItems = await Promise.all(
        lines.map((line) =>
          tx.pointShopOrderItem.create({
            data: {
              orderId: order.id,
              itemId: line.itemId,
              itemSku: line.item?.sku ?? line.itemId,
              itemName: line.item?.name ?? line.itemNameSnapshot,
              unitPoints: line.unitPoints,
              quantity: line.quantity,
              subtotalPoints: DEC(line.unitPoints).mul(line.quantity),
              deliveryStatus: PointShopDeliveryStatus.PENDING,
            },
            include: {
              item: {
                select: {
                  deliveryType: true,
                  couponType: true,
                  couponExpireDays: true,
                  balanceCreditAmount: true,
                },
              },
            },
          }),
        ),
      );

      for (const item of createdItems) {
        await deliverOrderItemTx(tx, {
          orderId: order.id,
          orderItemId: item.id,
          itemSku: item.itemSku,
          itemName: item.itemName,
          ownerId: params.userId,
          quantity: item.quantity,
          unitPoints: DEC(item.unitPoints),
          subtotalPoints: DEC(item.subtotalPoints),
          deliveryType: item.item?.deliveryType ?? PointShopDeliveryType.MANUAL,
          couponType: item.item?.couponType ?? null,
          couponExpireDays: item.item?.couponExpireDays ?? null,
          balanceCreditAmount: item.item?.balanceCreditAmount ?? null,
        });
      }

      await tx.pointShopCart.update({
        where: { id: cart.id },
        data: {
          status: PointShopCartStatus.CHECKED_OUT,
          checkedOutAt: new Date(),
          version: { increment: 1 },
        },
      });

      const deliveredItems = await tx.pointShopOrderItem.count({
        where: { orderId: order.id, deliveryStatus: PointShopDeliveryStatus.DELIVERED },
      });
      const pendingItems = await tx.pointShopOrderItem.count({
        where: { orderId: order.id, deliveryStatus: PointShopDeliveryStatus.PENDING },
      });

      return {
        status: 'ok' as const,
        requestKey,
        orderId: order.id,
        totalPoints,
        totalItems,
        deliveredItems,
        pendingItems,
        pointsBefore,
        pointsAfter,
      };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
    );
  } catch (error) {
    if (error instanceof CheckoutAbortError) {
      return error.result;
    }
    throw error;
  }
}
