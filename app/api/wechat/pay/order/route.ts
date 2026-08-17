import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/prisma';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import {
  buildWechatNativeOutTradeNo,
  buildWechatPayOrderDescription,
  createNativeRechargeOrder,
  WechatPayApiError,
} from '@/lib/wechat-pay';

const MIN_AMOUNT = Number(process.env.RECHARGE_MIN_AMOUNT ?? 0.01);
const WECHAT_NATIVE_ORDER_TTL_MS = 60 * 60 * 1000;

const parseAmount = (raw: unknown) => {
  const amountNumber = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(amountNumber)) {
    return null;
  }
  return amountNumber;
};

const normalizeAmount = (value: number) => new Decimal(value).toDecimalPlaces(2);

export async function POST(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const rawAmount = parseAmount(body.amount);
  if (rawAmount === null || rawAmount <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 });
  }
  if (rawAmount < MIN_AMOUNT) {
    return NextResponse.json({ ok: false, error: 'amount_too_small', min: MIN_AMOUNT }, { status: 400 });
  }

  const amountDecimal = normalizeAmount(rawAmount);
  const amountText = amountDecimal.toFixed(2);
  const amountFen = Math.round(Number(amountText) * 100);
  const outTradeNo = buildWechatNativeOutTradeNo(currentUser.jinleeId);
  const expiresAt = new Date(Date.now() + WECHAT_NATIVE_ORDER_TTL_MS);

  await prisma.wechatNativePayment.create({
    data: {
      outTradeNo,
      discordUserId: currentUser.discordUserId,
      jinleeId: currentUser.jinleeId,
      rechargeAmount: amountDecimal,
      expiresAt,
    },
  });

  const orderDisplayName =
    currentUser.jinleeUser.discordDisplayName ??
    currentUser.jinleeUser.member?.serverDisplayName ??
    currentUser.jinleeUser.wechatDisplayName ??
    currentUser.jinleeId;

  try {
    const { codeUrl } = await createNativeRechargeOrder({
      outTradeNo,
      amountFen,
      description: buildWechatPayOrderDescription(orderDisplayName),
      expiresAt,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(codeUrl, {
      margin: 1,
      width: 360,
    });

    return NextResponse.json({
      ok: true,
      orderId: outTradeNo,
      payUrl: codeUrl,
      qrCodeDataUrl,
      channel: 'wechat_native',
      amount: amountText,
      expiresAt,
      displayMode: 'qrcode',
    });
  } catch (error) {
    const failureMessage =
      error instanceof WechatPayApiError
        ? `微信支付下单失败（${error.status}${error.code ? ` ${error.code}` : ''}${error.apiMessage ? `：${error.apiMessage}` : ''}）`
        : error instanceof Error
          ? error.message
          : '微信支付下单失败';

    await prisma.wechatNativePayment.updateMany({
      where: { outTradeNo, status: 'PENDING' },
      data: {
        status: 'FAILED',
        paymentStatus: 'FAILED',
        failedReason: failureMessage,
      },
    });

    console.error('[wechat.native.order.create] failed', error);
    return NextResponse.json({ ok: false, error: failureMessage }, { status: 500 });
  }
}
