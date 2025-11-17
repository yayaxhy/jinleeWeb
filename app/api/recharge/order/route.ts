import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/session';
import {
  SUPPORTED_CHANNELS,
  buildOutTradeNo,
  buildSignaturePayload,
  buildZPaySignature,
  buildZPayUrl,
  getZPayGatewayUrl,
  requiredZPayConfig,
  type ZPayChannel,
} from '@/lib/zpay';

const MIN_AMOUNT = Number(process.env.RECHARGE_MIN_AMOUNT ?? 0.01);
const PRODUCTION_ORIGIN = process.env.ZPAY_PRODUCTION_ORIGIN ?? 'https://3yweb-sample-u6de.vercel.app';

const resolveAbsoluteUrl = (raw: string | undefined, fallbackPath: string) => {
  const candidate = raw ?? `${PRODUCTION_ORIGIN}${fallbackPath}`;
  try {
    return new URL(candidate);
  } catch {
    throw new Error(`Invalid URL configured for ${fallbackPath}: ${candidate}`);
  }
};
const SITE_NAME = process.env.ZPAY_SITE_NAME ?? 'Jinlee Club';

const parseAmount = (raw: unknown) => {
  const amountNumber = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(amountNumber)) {
    return null;
  }
  return amountNumber;
};

const normalizeAmount = (value: number) => new Prisma.Decimal(value).toDecimalPlaces(2);

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { merchantId, secret } = requiredZPayConfig();

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const rawAmount = parseAmount(body?.amount);
  if (rawAmount === null || rawAmount <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 });
  }
  if (rawAmount < MIN_AMOUNT) {
    return NextResponse.json({ ok: false, error: 'amount_too_small', min: MIN_AMOUNT }, { status: 400 });
  }

  const requestedChannel: ZPayChannel = SUPPORTED_CHANNELS.includes(body?.channel as ZPayChannel)
    ? (body.channel as ZPayChannel)
    : 'alipay';

  const amountDecimal = normalizeAmount(rawAmount);
  const amountText = amountDecimal.toFixed(2);

  const outTradeNo = buildOutTradeNo(session.discordId);
  const notifyUrl = resolveAbsoluteUrl(process.env.ZPAY_NOTIFY_URL, '/api/payment/zpay/notify').toString();
  const returnUrlObject = resolveAbsoluteUrl(process.env.ZPAY_RETURN_URL, '/recharge/result');
  returnUrlObject.searchParams.set('order', outTradeNo);
  const returnUrl = returnUrlObject.toString();

  console.log('[zpay.order.create]', {
    pid: merchantId,
    type: requestedChannel,
    notify_url: notifyUrl,
    return_url: returnUrl,
    out_trade_no: outTradeNo,
    amount: amountText,
  });

  await prisma.zPayRechargeOrder.create({
    data: {
      outTradeNo,
      discordUserId: session.discordId,
      amount: amountDecimal,
      channel: requestedChannel,
    },
  });

  const params = {
    pid: merchantId,
    type: requestedChannel,
    notify_url: notifyUrl,
    return_url: returnUrl,
    out_trade_no: outTradeNo,
    name: `账户充值-${session.username ?? session.discordId}`,
    money: amountText,
    sitename: SITE_NAME,
  };

  const signaturePayload = buildSignaturePayload(params);
  const signature = buildZPaySignature(params, secret);
  console.log('[zpay.order.create] 签名参数字符串:', signaturePayload);
  console.log('[zpay.order.create] 生成的签名:', signature);

  const payUrl = buildZPayUrl(params, secret, getZPayGatewayUrl());
  console.log('[zpay.order.create] 最终支付链接:', payUrl);

  return NextResponse.json({
    ok: true,
    orderId: outTradeNo,
    payUrl,
    channel: requestedChannel,
    amount: amountText,
    returnUrl,
  });
}
