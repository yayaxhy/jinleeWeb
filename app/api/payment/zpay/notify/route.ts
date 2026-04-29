import { Decimal } from '@prisma/client/runtime/library';
import { buildSignaturePayload, buildZPaySignature, requiredZPayConfig, verifyZPaySignature } from '@/lib/zpay';
import { settleRechargeOrderPayment } from '@/lib/recharge-order';

type PlainObject = Record<string, string>;

const checkProxySecret = () => true;

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

  const settlement = await settleRechargeOrderPayment({
    outTradeNo: params.out_trade_no,
    amount: new Decimal(params.money).toDecimalPlaces(2),
    gatewayTradeNo: params.trade_no ?? params.tradeNo ?? null,
    notifyPayload: params,
    payerReference: params.buyer ?? params.openid ?? params.trade_no ?? 'zpay_gateway',
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
    if (!checkProxySecret()) {
      return new Response('forbidden', { status: 403 });
    }
    const params = await parseBody(request);
    return await handleNotify(params);
  } catch (error) {
    console.error('[zpay.notify] POST error', error);
    return failResponse('internal_error');
  }
}

export async function GET(request: Request) {
  try {
    if (!checkProxySecret()) {
      return new Response('forbidden', { status: 403 });
    }
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    return await handleNotify(params);
  } catch (error) {
    console.error('[zpay.notify] GET error', error);
    return failResponse('internal_error');
  }
}
