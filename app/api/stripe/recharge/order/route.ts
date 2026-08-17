import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';
import {
  buildStripeOutTradeNo,
  createStripeCheckoutSession,
  getStripeFirstRechargeAmount,
  findStripeRechargePrice,
  getStripeSecretKey,
  isStripeRechargeAmountAllowed,
  StripeCheckoutSessionError,
} from '@/lib/stripe-recharge';

export const runtime = 'nodejs';

const STRIPE_SUPPORTED_CURRENCIES = new Set(['cad', 'usd', 'gbp', 'eur']);

const firstForwardedValue = (value: string | null) => value?.split(',')[0]?.trim() || null;

const resolveOrigin = (request: Request) => {
  const requestUrl = new URL(request.url);
  const host = firstForwardedValue(request.headers.get('x-forwarded-host')) ?? request.headers.get('host') ?? requestUrl.host;
  if (host) {
    const forwardedProtocol = firstForwardedValue(request.headers.get('x-forwarded-proto'));
    const requestProtocol = requestUrl.protocol.replace(':', '');
    const isLocalHost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
    const protocol = forwardedProtocol ?? (requestProtocol === 'http' && !isLocalHost ? 'https' : requestProtocol);
    return `${protocol}://${host}`;
  }
  return process.env.SITE_ORIGIN ?? process.env.NEXTAUTH_URL ?? process.env.ZPAY_PRODUCTION_ORIGIN ?? requestUrl.origin;
};

const parseAmount = (raw: unknown) => {
  try {
    if (typeof raw === 'number' || typeof raw === 'string') {
      const amount = new Prisma.Decimal(raw);
      if (amount.isFinite() && amount.gt(0)) return amount.toDecimalPlaces(2);
    }
  } catch {
    return null;
  }
  return null;
};

const parseCurrency = (raw: unknown) => {
  if (typeof raw !== 'string') return null;
  const currency = raw.trim().toLowerCase();
  return STRIPE_SUPPORTED_CURRENCIES.has(currency) ? currency : null;
};

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

  const amount = parseAmount(body.amount);
  if (!amount) {
    return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 });
  }

  const price = findStripeRechargePrice(amount);
  if (!price) {
    return NextResponse.json({ ok: false, error: 'unsupported_stripe_recharge_amount' }, { status: 400 });
  }
  const currency = parseCurrency(body.currency);
  if (!currency) {
    return NextResponse.json({ ok: false, error: 'unsupported_stripe_currency' }, { status: 400 });
  }

  const priorRechargeCount = await prisma.recharge.count({
    where: { jinleeId: currentUser.jinleeId },
  });
  const hasPriorRecharge = priorRechargeCount > 0;
  if (!isStripeRechargeAmountAllowed({ amount: price.amount, hasPriorRecharge })) {
    return NextResponse.json(
      { ok: false, error: 'stripe_first_recharge_limited', allowedAmount: getStripeFirstRechargeAmount().toFixed(2) },
      { status: 403 },
    );
  }

  const outTradeNo = buildStripeOutTradeNo(currentUser.jinleeId);

  await prisma.stripePayment.create({
    data: {
      outTradeNo,
      discordUserId: currentUser.discordUserId,
      jinleeId: currentUser.jinleeId,
      rechargeAmount: price.amount,
      priceId: price.priceId,
      selectedCurrency: currency,
    },
  });

  const origin = resolveOrigin(request);
  const successUrlBase = new URL('/recharge/result', origin);
  successUrlBase.searchParams.set('order', outTradeNo);
  const successUrl = `${successUrlBase.toString()}&stripe_session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = new URL('/recharge', origin);
  cancelUrl.searchParams.set('stripe_cancelled', '1');

  try {
    const session = await createStripeCheckoutSession({
      secretKey: getStripeSecretKey(),
      priceId: price.priceId,
      currency,
      outTradeNo,
      jinleeId: currentUser.jinleeId,
      discordUserId: currentUser.discordUserId,
      rechargeAmount: price.amountText,
      successUrl,
      cancelUrl: cancelUrl.toString(),
    });

    await prisma.stripePayment.update({
      where: { outTradeNo },
      data: {
        checkoutSessionId: session.id,
      },
    });

    return NextResponse.json({
      ok: true,
      orderId: outTradeNo,
      payUrl: session.url,
      channel: 'stripe_checkout',
      amount: price.amountText,
      returnUrl: successUrl,
      displayMode: 'redirect',
    });
  } catch (error) {
    if (error instanceof StripeCheckoutSessionError) {
      await prisma.stripePayment.updateMany({
        where: { outTradeNo, status: 'PENDING' },
        data: {
          status: 'FAILED',
          paymentStatus: 'FAILED',
          failedReason: error.code ?? error.stripeType ?? `http_${error.status}`,
        },
      });
      console.error('[stripe.recharge.order] stripe rejected checkout session', {
        code: error.code,
        param: error.param,
        status: error.status,
        type: error.stripeType,
        message: error.message,
      });
      if (error.code === 'amount_too_small') {
        return NextResponse.json(
          {
            ok: false,
            error: 'stripe_amount_too_small',
            message: 'Stripe 最低付款金额约为 50 美分，当前金额无法创建支付页面。请改用更高测试金额。',
          },
          { status: 400 },
        );
      }
    } else {
      console.error('[stripe.recharge.order] create failed', error);
    }
    return NextResponse.json({ ok: false, error: 'stripe_checkout_session_failed' }, { status: 500 });
  }
}
