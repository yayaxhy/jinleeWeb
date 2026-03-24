import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { FARM_SEEDS, type FarmSeedTypeValue } from '@/lib/farmConfig';
import {
  exchangeBalanceToCoins,
  exchangeCoinsToPoints,
  exchangePointsToCoins,
  expandFarm,
  getFarmDashboard,
  plantFarmSeed,
  harvestFarmPlot,
} from '@/lib/farm';

const isFarmSeedType = (value: unknown): value is FarmSeedTypeValue =>
  typeof value === 'string' && value in FARM_SEEDS;

export async function GET() {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const dashboard = await getFarmDashboard(session.discordId);
    return NextResponse.json({ ok: true, dashboard });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.discordId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? '').trim();

  try {
    let dashboard;
    let message = '操作成功';
    switch (action) {
      case 'exchange_balance': {
        dashboard = await exchangeBalanceToCoins(session.discordId, body?.amount);
        message = '已将余额兑换为金币';
        break;
      }
      case 'exchange_points': {
        dashboard = await exchangePointsToCoins(session.discordId, body?.amount);
        message = '已将积分兑换为金币';
        break;
      }
      case 'exchange_coins_to_points': {
        dashboard = await exchangeCoinsToPoints(session.discordId, body?.amount);
        message = '已将金币兑换为积分';
        break;
      }
      case 'plant': {
        if (!isFarmSeedType(body?.seedType)) {
          return NextResponse.json({ error: '未知种子' }, { status: 400 });
        }
        dashboard = await plantFarmSeed(session.discordId, Number(body?.plotIndex), body.seedType);
        message = '种植成功';
        break;
      }
      case 'harvest': {
        dashboard = await harvestFarmPlot(session.discordId, Number(body?.plotIndex));
        message = '收获成功';
        break;
      }
      case 'expand': {
        dashboard = await expandFarm(session.discordId);
        message = '扩地成功';
        break;
      }
      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message, dashboard });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
