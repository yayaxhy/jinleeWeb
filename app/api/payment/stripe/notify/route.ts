import { Prisma } from '@prisma/client';
import {
  getStripePaymentIntentId,
  getStripeSecretKey,
  getStripeWebhookSecret,
  retrieveStripePaymentAccounting,
  verifyStripeWebhookPayload,
  type StripeCheckoutSessionObject,
} from '@/lib/stripe-recharge';
import { settleRechargeOrderPayment } from '@/lib/recharge-order';
import {
  recordStripeCheckoutFailure,
  recordStripeDispute,
  recordStripePaymentSuccess,
  recordStripeRefund,
} from '@/lib/stripe-payment';

export const runtime = 'nodejs';

const successResponse = () => new Response(JSON.stringify({ received: true }), { status: 200 });

const failResponse = (reason: string, status = 400, details?: Record<string, unknown>) => {
  console.error('[stripe.notify] fail', reason, details);
  return new Response(JSON.stringify({ error: reason }), { status });
};

const isPaidCheckoutSession = (session: StripeCheckoutSessionObject) =>
  session.payment_status === 'paid';

const getSourceReference = (session: StripeCheckoutSessionObject) =>
  getStripePaymentIntentId(session) ?? session.id ?? 'stripe_checkout';

const getString = (object: Record<string, unknown>, field: string) => {
  const value = object[field];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

export async function POST(request: Request) {
  let rawBody = '';
  try {
    rawBody = await request.text();
    const event = verifyStripeWebhookPayload({
      rawBody,
      signatureHeader: request.headers.get('stripe-signature'),
      webhookSecret: getStripeWebhookSecret(),
    });

    if (event.type === 'refund.created' || event.type === 'charge.refunded') {
      const refund = event.data.object;
      const paymentIntentId = getString(refund, 'payment_intent');
      if (!paymentIntentId) return successResponse();

      const accounting = await retrieveStripePaymentAccounting({
        secretKey: getStripeSecretKey(),
        paymentIntentId,
      });
      await recordStripeRefund({
        paymentIntentId,
        accounting,
        stripeEventId: event.id,
      });
      console.warn('[stripe.notify] refund recorded', { paymentIntentId, eventId: event.id });
      return successResponse();
    }

    if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.closed') {
      const dispute = event.data.object;
      const disputeId = getString(dispute, 'id');
      if (!disputeId) return successResponse();

      const paymentIntentId = getString(dispute, 'payment_intent');
      const chargeId = getString(dispute, 'charge');
      await recordStripeDispute({
        paymentIntentId,
        chargeId,
        disputeId,
        disputeStatus: getString(dispute, 'status'),
        closed: event.type === 'charge.dispute.closed',
        stripeEventId: event.id,
      });
      console.warn('[stripe.notify] dispute recorded', { paymentIntentId, chargeId, disputeId, eventId: event.id });
      return successResponse();
    }

    if (event.type === 'checkout.session.async_payment_failed' || event.type === 'checkout.session.expired') {
      const session = event.data.object as StripeCheckoutSessionObject;
      const outTradeNo = session.client_reference_id ?? session.metadata?.out_trade_no;
      if (outTradeNo) {
        await recordStripeCheckoutFailure({
          outTradeNo,
          checkoutSessionId: session.id,
          paymentIntentId: getStripePaymentIntentId(session),
          expired: event.type === 'checkout.session.expired',
          reason: event.type,
          stripeEventId: event.id,
        });
      }
      return successResponse();
    }

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

    const paymentIntentId = getStripePaymentIntentId(session);
    if (!session.id || !paymentIntentId) {
      return failResponse('missing_stripe_payment_reference', 400, {
        sessionId: session.id,
        paymentIntentId,
        outTradeNo,
      });
    }

    const accounting = await retrieveStripePaymentAccounting({
      secretKey: getStripeSecretKey(),
      paymentIntentId,
    });
    const stripePayment = await recordStripePaymentSuccess({
      outTradeNo,
      checkoutSessionId: session.id,
      accounting,
      stripeEventId: event.id,
    });
    if (!stripePayment) {
      return failResponse('order_not_found', 400, { outTradeNo, sessionId: session.id });
    }
    if (stripePayment.paymentStatus !== 'SUCCEEDED') {
      console.warn('[stripe.notify] payment is not eligible for credit', {
        outTradeNo,
        paymentStatus: stripePayment.paymentStatus,
        sessionId: session.id,
      });
      return successResponse();
    }

    const settlement = await settleRechargeOrderPayment({
      outTradeNo,
      amount: new Prisma.Decimal(rechargeAmount).toDecimalPlaces(2),
      orderProvider: 'stripe',
      gatewayTradeNo: paymentIntentId,
      payerReference: getSourceReference(session),
      transactionType: '信用卡/银行卡充值',
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
