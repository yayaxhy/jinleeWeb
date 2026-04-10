import { NextResponse } from 'next/server';
import {
  addPointShopCartItem,
  checkoutPointShopCart,
  clearPointShopCart,
  getPointShopDashboard,
  removePointShopCartItem,
} from '@/lib/pointShop';
import { getCurrentJinleeUser } from '@/lib/current-jinlee-user';

const parseQuantity = (value: unknown, fallback = 1) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
};

export async function GET(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const data = await getPointShopDashboard({
    jinleeId: currentUser.jinleeId,
    discordUserId: currentUser.discordUserId,
  });
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentJinleeUser(request);
  if (!currentUser) {
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
      identity: {
        jinleeId: currentUser.jinleeId,
        discordUserId: currentUser.discordUserId,
      },
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
      identity: {
        jinleeId: currentUser.jinleeId,
        discordUserId: currentUser.discordUserId,
      },
      sku,
      quantity,
    });
    return NextResponse.json({ ok: true, result });
  }

  if (action === 'clear') {
    const result = await clearPointShopCart({
      jinleeId: currentUser.jinleeId,
      discordUserId: currentUser.discordUserId,
    });
    return NextResponse.json({ ok: true, result });
  }

  if (action === 'checkout') {
    const requestKey = typeof body.requestKey === 'string' ? body.requestKey : null;
    const result = await checkoutPointShopCart({
      identity: {
        jinleeId: currentUser.jinleeId,
        discordUserId: currentUser.discordUserId,
      },
      requestKey,
    });
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ error: 'unsupported_action' }, { status: 400 });
}
