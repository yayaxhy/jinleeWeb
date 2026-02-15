import { NextResponse } from 'next/server';
import {
  addPointShopCartItem,
  checkoutPointShopCart,
  clearPointShopCart,
  getPointShopDashboard,
  removePointShopCartItem,
} from '@/lib/pointShop';
import { getServerSession } from '@/lib/session';

const parseQuantity = (value: unknown, fallback = 1) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
};

export async function GET() {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const data = await getPointShopDashboard(session.discordId);
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const action = typeof body.action === 'string' ? body.action.trim() : '';

  if (action === 'add') {
    const sku = typeof body.sku === 'string' ? body.sku : '';
    const quantity = parseQuantity(body.quantity, 1);
    if (!sku || quantity === null) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    const result = await addPointShopCartItem({
      userId: session.discordId,
      sku,
      quantity,
    });
    return NextResponse.json({ ok: true, result });
  }

  if (action === 'remove') {
    const sku = typeof body.sku === 'string' ? body.sku : '';
    const quantity = parseQuantity(body.quantity, 1);
    if (!sku || quantity === null) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    const result = await removePointShopCartItem({
      userId: session.discordId,
      sku,
      quantity,
    });
    return NextResponse.json({ ok: true, result });
  }

  if (action === 'clear') {
    const result = await clearPointShopCart(session.discordId);
    return NextResponse.json({ ok: true, result });
  }

  if (action === 'checkout') {
    const requestKey = typeof body.requestKey === 'string' ? body.requestKey : null;
    const result = await checkoutPointShopCart({
      userId: session.discordId,
      requestKey,
    });
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ error: 'unsupported_action' }, { status: 400 });
}
