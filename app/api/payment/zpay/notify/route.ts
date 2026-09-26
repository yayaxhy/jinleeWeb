import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/prisma';
import { requiredZPayConfig, verifyZPaySignature } from '@/lib/zpay';
import { settleRechargeOrderPayment } from '@/lib/recharge-order';

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

async function handleNotify(params: PlainObject) {
  if (!params.out_trade_no || !params.money || !params.pid || !params.type || !params.trade_no || !params.trade_status) {
    return failResponse('missing_fields');
  }

  if (!/^\d{1,32}$/.test(params.out_trade_no)) {
    return failResponse('invalid_order_number');
  }

  if (params.sign_type !== undefined && params.sign_type !== 'MD5') {
    return failResponse('unsupported_sign_type', { outTradeNo: params.out_trade_no });
  }

  const { merchantId, secret } = requiredZPayConfig();
  if (!verifyZPaySignature(params, secret, params.sign)) {
    return failResponse('sign_error', { outTradeNo: params.out_trade_no });
  }

  if (params.pid !== merchantId) {
    return failResponse('merchant_identity_mismatch', { outTradeNo: params.out_trade_no });
  }

  if (params.trade_status !== 'TRADE_SUCCESS') {
    return failResponse('invalid_status', { outTradeNo: params.out_trade_no });
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(params.money)) {
    return failResponse('invalid_amount', { outTradeNo: params.out_trade_no });
  }
  const amount = new Decimal(params.money);
  if (!amount.isFinite() || amount.lte(0)) {
    return failResponse('invalid_amount', { outTradeNo: params.out_trade_no });
  }

  const order = await prisma.zPayRechargeOrder.findUnique({
    where: { outTradeNo: params.out_trade_no },
    select: { channel: true },
  });
  if (!order) {
    return failResponse('order_not_found', { outTradeNo: params.out_trade_no });
  }
  if (params.type !== order.channel) {
    return failResponse('channel_mismatch', { outTradeNo: params.out_trade_no });
  }

  const settlement = await settleRechargeOrderPayment({
    outTradeNo: params.out_trade_no,
    amount,
    gatewayTradeNo: params.trade_no,
    notifyPayload: {
      pid: params.pid,
      out_trade_no: params.out_trade_no,
      trade_no: params.trade_no,
      type: params.type,
      money: amount.toFixed(2),
      trade_status: params.trade_status,
    },
    payerReference: params.trade_no,
    transactionType: '网站充值',
  });

  if (settlement.kind === 'not_found') {
    return failResponse('order_not_found', { outTradeNo: params.out_trade_no });
  }

  if (settlement.kind === 'amount_mismatch') {
    return failResponse('amount_mismatch', {
      outTradeNo: params.out_trade_no,
      expected: settlement.expected,
      received: settlement.received,
    });
  }

  if (settlement.kind === 'invalid_order') {
    return failResponse('invalid_order', {
      outTradeNo: params.out_trade_no,
      reason: settlement.reason,
    });
  }

  if (settlement.kind === 'already_paid') {
    console.log('[zpay.notify] already_paid', { outTradeNo: params.out_trade_no });
    return successResponse();
  }

  console.log('[zpay.notify] success', { outTradeNo: params.out_trade_no });
  return successResponse();
}

export async function POST(request: Request) {
  try {
    const params = await parseBody(request);
    return await handleNotify(params);
  } catch (error) {
    return failResponse('internal_error', { errorName: error instanceof Error ? error.name : 'UnknownError' });
  }
}

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    return await handleNotify(params);
  } catch (error) {
    return failResponse('internal_error', { errorName: error instanceof Error ? error.name : 'UnknownError' });
  }
}
