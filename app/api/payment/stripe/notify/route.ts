import { Prisma } from '@prisma/client';
import {
  getStripePaymentIntentId,
  getStripeWebhookSecret,
  verifyStripeWebhookPayload,
  type StripeCheckoutSessionObject,
} from '@/lib/stripe-recharge';
import { settleRechargeOrderPayment } from '@/lib/recharge-order';

export const runtime = 'nodejs';

const successResponse = () => new Response(JSON.stringify({ received: true }), { status: 200 });

const failResponse = (reason: string, status = 400, details?: Record<string, unknown>) => {
  console.error('[stripe.notify] fail', reason, details);
  return new Response(JSON.stringify({ error: reason }), { status });
};

const isPaidCheckoutSession = (session: StripeCheckoutSessionObject) =>
  session.payment_status === 'paid';

const getSourceReference = (session: StripeCheckoutSessionObject) =>
  session.customer_details?.email ??
  session.customer_email ??
  getStripePaymentIntentId(session) ??
  session.id ??
  'stripe_checkout';

export async function POST(request: Request) {
  let rawBody = '';
  try {
    rawBody = await request.text();
    const event = verifyStripeWebhookPayload({
      rawBody,
      signatureHeader: request.headers.get('stripe-signature'),
      webhookSecret: getStripeWebhookSecret(),
    });

    if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') {
      return successResponse();
    }

    const session = event.data.object as StripeCheckoutSessionObject;
    if (!isPaidCheckoutSession(session)) {
      return successResponse();
    }

    const outTradeNo = session.client_reference_id ?? session.metadata?.out_trade_no;
    const rechargeAmount = session.metadata?.recharge_amount;
    if (!outTradeNo || !rechargeAmount) {
      return failResponse('missing_stripe_recharge_metadata', 400, {
        sessionId: session.id,
        outTradeNo,
        rechargeAmount,
      });
    }

    const settlement = await settleRechargeOrderPayment({
      outTradeNo,
      amount: new Prisma.Decimal(rechargeAmount).toDecimalPlaces(2),
      gatewayTradeNo: getStripePaymentIntentId(session) ?? session.id ?? null,
      notifyPayload: event as Prisma.InputJsonValue,
      payerReference: getSourceReference(session),
      transactionType: 'Stripe充值',
    });

    if (settlement.kind === 'not_found') {
      return failResponse('order_not_found', 400, { outTradeNo, sessionId: session.id });
    }

    if (settlement.kind === 'amount_mismatch') {
      return failResponse('amount_mismatch', 400, {
        outTradeNo,
        expected: settlement.expected,
        received: settlement.received,
      });
    }

    if (settlement.kind === 'invalid_order') {
      return failResponse('invalid_order', 400, {
        outTradeNo,
        reason: settlement.reason,
      });
    }

    if (settlement.kind === 'already_paid') {
      console.log('[stripe.notify] already_paid', { outTradeNo, sessionId: session.id });
      return successResponse();
    }

    console.log('[stripe.notify] success', { outTradeNo, sessionId: session.id });
    return successResponse();
  } catch (error) {
    console.error('[stripe.notify] unexpected error', error, { rawBodyLength: rawBody.length });
    return failResponse('internal_error', 500);
  }
}
