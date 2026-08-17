import { Decimal } from '@prisma/client/runtime/library';
import { decryptWechatPayResource, getWechatPayIdentity, verifyWechatPayCallbackSignature } from '@/lib/wechat-pay';
import { settleRechargeOrderPayment } from '@/lib/recharge-order';
import { recordWechatNativePaymentSuccess } from '@/lib/wechat-native-payment';

type WechatPayNotification = {
  id: string;
  create_time: string;
  event_type: string;
  resource_type: string;
  summary: string;
  resource: {
    algorithm: string;
    ciphertext: string;
    nonce: string;
    associated_data?: string;
    original_type?: string;
  };
};

type WechatPayTransaction = {
  appid: string;
  mchid: string;
  out_trade_no: string;
  transaction_id: string;
  trade_type: string;
  trade_state: string;
  amount: {
    total: number;
    payer_total?: number;
    currency?: string;
    payer_currency?: string;
  };
  payer?: {
    openid?: string;
  };
};

const successResponse = () => new Response(null, { status: 200 });

const failResponse = (reason: string, details?: Record<string, unknown>, status = 400) => {
  console.error('[wechat.notify] fail', reason, details);
  return new Response(reason, { status });
};

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    await verifyWechatPayCallbackSignature(request.headers, rawBody);

    const payload = JSON.parse(rawBody) as WechatPayNotification;
    if (payload.event_type !== 'TRANSACTION.SUCCESS') {
      console.log('[wechat.notify] ignored event', {
        eventType: payload.event_type,
        resourceType: payload.resource_type,
      });
      return successResponse();
    }

    const transaction = await decryptWechatPayResource<WechatPayTransaction>(payload.resource);
    const identity = await getWechatPayIdentity();

    if (transaction.appid !== identity.appId || transaction.mchid !== identity.mchId) {
      return failResponse('merchant_identity_mismatch', {
        outTradeNo: transaction.out_trade_no,
        appid: transaction.appid,
        mchid: transaction.mchid,
      });
    }

    if (transaction.trade_state !== 'SUCCESS') {
      return successResponse();
    }

    if (transaction.trade_type !== 'NATIVE') {
      return failResponse('unexpected_trade_type', {
        outTradeNo: transaction.out_trade_no,
        tradeType: transaction.trade_type,
      });
    }

    const amountDecimal = new Decimal(transaction.amount.total).div(100).toDecimalPlaces(2);
    const payment = await recordWechatNativePaymentSuccess({
      outTradeNo: transaction.out_trade_no,
      transactionId: transaction.transaction_id,
      tradeState: transaction.trade_state,
      amountFen: transaction.amount.total,
      currency: transaction.amount.currency,
      wechatEventId: payload.id,
    });
    if (!payment) {
      return failResponse('order_not_found', { outTradeNo: transaction.out_trade_no });
    }

    const settlement = await settleRechargeOrderPayment({
      outTradeNo: transaction.out_trade_no,
      amount: amountDecimal,
      orderProvider: 'wechat_native',
      gatewayTradeNo: transaction.transaction_id,
      payerReference: transaction.transaction_id,
      transactionType: '微信Native充值',
    });

    if (settlement.kind === 'not_found') {
      return failResponse('order_not_found', { outTradeNo: transaction.out_trade_no });
    }

    if (settlement.kind === 'amount_mismatch') {
      return failResponse('amount_mismatch', {
        outTradeNo: transaction.out_trade_no,
        expected: settlement.expected,
        received: amountDecimal.toFixed(2),
      });
    }

    if (settlement.kind === 'invalid_order') {
      return failResponse('invalid_order', {
        outTradeNo: transaction.out_trade_no,
        reason: settlement.reason,
      });
    }

    if (settlement.kind === 'already_paid') {
      console.log('[wechat.notify] already_paid', { outTradeNo: transaction.out_trade_no });
      return successResponse();
    }

    console.log('[wechat.notify] success', {
      outTradeNo: transaction.out_trade_no,
      transactionId: transaction.transaction_id,
    });
    return successResponse();
  } catch (error) {
    console.error('[wechat.notify] unexpected error', error);
    return failResponse('internal_error', undefined, 500);
  }
}
