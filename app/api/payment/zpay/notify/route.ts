import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/prisma';
import { buildSignaturePayload, buildZPaySignature, requiredZPayConfig, verifyZPaySignature } from '@/lib/zpay';

type PlainObject = Record<string, string>;

const toPlainObject = (input: Record<string, unknown>) => {
  const result: PlainObject = {};
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string') {
      result[key] = value;
    } else if (Array.isArray(value)) {
      const first = value.find((item) => typeof item === 'string');
      if (first) result[key] = first;
    } else {
      result[key] = String(value);
    }
  });
  return result;
};

const parseBody = async (request: Request) => {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await request.json();
    return toPlainObject(json);
  }
  const formData = await request.formData();
  const map: Record<string, unknown> = {};
  for (const [key, value] of formData) {
    if (typeof value === 'string') {
      map[key] = value;
    }
  }
  return toPlainObject(map);
};

const successResponse = () => new Response('success');
const failResponse = (reason?: string, details?: Record<string, unknown>) => {
  console.error('[zpay.notify] fail', reason ?? 'unknown', details);
  return new Response(reason ?? 'fail', { status: 400 });
};

const TRADE_SUCCESS_VALUES = new Set(['TRADE_SUCCESS', 'SUCCESS', 'PAID']);

async function handleNotify(params: PlainObject) {
  if (!params.out_trade_no || !params.money) {
    return failResponse('missing_fields');
  }

  const { secret } = requiredZPayConfig();
  console.log('[zpay.notify] raw params', params);

  const payloadForSign = { ...params };
  const providedSign = payloadForSign.sign;
  delete payloadForSign.sign;
  delete payloadForSign.sign_type;

  const signaturePayload = buildSignaturePayload(payloadForSign);
  const expectedSign = buildZPaySignature(payloadForSign, secret);
  console.log('[zpay.notify] signature debug', {
    payloadForSign,
    signaturePayload,
    expectedSign,
    providedSign,
    secretLength: secret.length,
  });

  const signValid = verifyZPaySignature(payloadForSign, secret, providedSign);
  if (!signValid) {
    console.error('[zpay.notify] signature mismatch', {
      outTradeNo: params.out_trade_no,
      expected: expectedSign,
      received: providedSign,
      payload: signaturePayload,
    });
    return failResponse('sign_error', { outTradeNo: params.out_trade_no });
  }

  const tradeStatus = (params.trade_status || params.status || '').toUpperCase();
  if (!TRADE_SUCCESS_VALUES.has(tradeStatus)) {
    return failResponse('invalid_status', { outTradeNo: params.out_trade_no, tradeStatus });
  }

  const order = await prisma.zPayRechargeOrder.findUnique({
    where: { outTradeNo: params.out_trade_no },
  });
  if (!order) {
    return failResponse('order_not_found', { outTradeNo: params.out_trade_no });
  }

  if (order.status === 'PAID') {
    console.log('[zpay.notify] already_paid', { outTradeNo: order.outTradeNo });
    return successResponse();
  }

  const amountDecimal = new Decimal(params.money).toDecimalPlaces(2);
  if (!order.amount.equals(amountDecimal)) {
    return failResponse('amount_mismatch', {
      outTradeNo: params.out_trade_no,
      expected: order.amount.toString(),
      received: params.money,
    });
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.zPayRechargeOrder.update({
      where: { outTradeNo: order.outTradeNo },
      data: {
        status: 'PAID',
        gatewayTradeNo: params.trade_no ?? params.tradeNo ?? null,
        notifyPayload: params,
        paidAt: new Date(),
      },
    });

    const memberSnapshot = await tx.member.upsert({
      where: { discordUserId: order.discordUserId },
      create: {
        discordUserId: order.discordUserId,
        recharge: amountDecimal,
        totalBalance: amountDecimal,
      },
      update: {
        recharge: { increment: amountDecimal },
        totalBalance: { increment: amountDecimal },
      },
      select: { totalBalance: true },
    });

    const hasPeiwan = await tx.pEIWAN.findUnique({
      where: { discordUserId: order.discordUserId },
      select: { PEIWANID: true },
    });
    if (hasPeiwan) {
      await tx.pEIWAN.update({
        where: { discordUserId: order.discordUserId },
        data: { balance: memberSnapshot.totalBalance },
      });
    }

    const balanceAfter = new Decimal(memberSnapshot.totalBalance ?? 0);
    const balanceBefore = balanceAfter.sub(amountDecimal);

    await tx.recharge.create({
      data: {
        amount: amountDecimal,
        toWhom: order.discordUserId,
        fromWhom: params.buyer ?? params.openid ?? 'zpay_gateway',
      },
    });

    await tx.individualTransaction.create({
      data: {
        discordId: order.discordUserId,
        thirdPartydiscordId: params.trade_no ?? 'zpay_gateway',
        balanceBefore,
        amountChange: amountDecimal,
        balanceAfter,
        typeOfTransaction: '充值',
      },
    });
  });

  console.log('[zpay.notify] success', { outTradeNo: order.outTradeNo });
  return successResponse();
}

export async function POST(request: Request) {
  try {
    const params = await parseBody(request);
    return await handleNotify(params);
  } catch (error) {
    console.error('[zpay.notify] POST error', error);
    return failResponse('internal_error');
  }
}

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    return await handleNotify(params);
  } catch (error) {
    console.error('[zpay.notify] GET error', error);
    return failResponse('internal_error');
  }
}
