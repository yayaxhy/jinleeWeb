import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/prisma';
import { buildSignaturePayload, buildZPaySignature, requiredZPayConfig, verifyZPaySignature } from '@/lib/zpay';
import { NextResponse } from 'next/server';

type PlainObject = Record<string, string>;

// 简单的认证中间件
function authenticateRequest(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const expectedToken = `Bearer ${process.env.INTERNAL_API_KEY}`;
  
  if (!authHeader || authHeader !== expectedToken) {
    console.error('[internal] 认证失败:', {
      received: authHeader,
      expected: expectedToken
    });
    return false;
  }
  return true;
}

const successResponse = () => new Response('success');
const failResponse = (reason?: string, details?: Record<string, unknown>) => {
  console.error('[internal.zpay.notify] fail', reason ?? 'unknown', details);
  return new Response(reason ?? 'fail', { status: 400 });
};

const TRADE_SUCCESS_VALUES = new Set(['TRADE_SUCCESS', 'SUCCESS', 'PAID']);

async function handleInternalNotify(params: PlainObject) {
  if (!params.out_trade_no || !params.money) {
    return failResponse('missing_fields');
  }

  console.log('[internal.zpay.notify] 处理通知:', params);

  const { secret } = requiredZPayConfig();

  const payloadForSign = { ...params };
  const providedSign = payloadForSign.sign;
  delete payloadForSign.sign;
  delete payloadForSign.sign_type;

  const signaturePayload = buildSignaturePayload(payloadForSign);
  const expectedSign = buildZPaySignature(payloadForSign, secret);
  
  console.log('[internal.zpay.notify] 签名调试:', {
    signaturePayload,
    expectedSign,
    providedSign,
  });

  const signValid = verifyZPaySignature(payloadForSign, secret, providedSign);
  if (!signValid) {
    console.error('[internal.zpay.notify] 签名不匹配', {
      outTradeNo: params.out_trade_no,
      expected: expectedSign,
      received: providedSign,
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
    console.log('[internal.zpay.notify] 订单已支付:', order.outTradeNo);
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

  console.log('[internal.zpay.notify] 处理成功:', { outTradeNo: order.outTradeNo });
  return successResponse();
}

export async function POST(request: Request) {
  // 验证内部调用
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const params = await request.json();
    return await handleInternalNotify(params);
  } catch (error) {
    console.error('[internal.zpay.notify] POST error', error);
    return failResponse('internal_error');
  }
}
