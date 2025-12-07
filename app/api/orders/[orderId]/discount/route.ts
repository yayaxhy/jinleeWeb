import { NextResponse } from 'next/server';
import { applyDiscountForOrder, type DiscountKind } from '@/app/api/personal/discountService';
import { getServerSession } from '@/lib/session';

const mapErrorStatus = (status: string) => {
  switch (status) {
    case 'order_not_found':
      return { code: 404, message: '订单不存在' };
    case 'not_order_host':
      return { code: 403, message: '仅订单老板可使用优惠' };
    case 'order_not_ended':
      return { code: 400, message: '需先结单后再使用优惠' };
    case 'already_used':
      return { code: 409, message: '该订单已使用过优惠' };
    case 'no_coupon':
      return { code: 400, message: '没有可用优惠券' };
    case 'no_lottery':
      return { code: 400, message: '没有可用抽奖优惠' };
    case 'no_fee':
    case 'insufficient_data':
    default:
      return { code: 400, message: '无法使用优惠' };
  }
};

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { orderId: rawOrderId } = await context.params;
  const orderId = decodeURIComponent(rawOrderId);

  const body = (await request.json().catch(() => ({}))) as { kind?: DiscountKind };
  const kind = body.kind;
  if (kind !== 'coupon' && kind !== 'lottery') {
    return NextResponse.json({ error: '缺少或非法的 kind' }, { status: 400 });
  }

  const result = await applyDiscountForOrder({ orderId, userId: session.discordId, kind });

  if (result.status === 'applied') {
    return NextResponse.json(
      { amount: result.discountAmount.toString(), kind: result.kind },
      { status: 200 },
    );
  }

  const { code, message } = mapErrorStatus(result.status);
  return NextResponse.json({ error: message }, { status: code });
}
